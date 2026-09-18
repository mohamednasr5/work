# -*- coding: utf-8 -*-
"""Fast, fail-safe OCR processor for NEW Telegram requests.

Important design rule:
- OCR is the source of truth.
- No AI/provider failure may block creating a reviewable extraction.
- This module never writes to Firebase and never changes existing requests.
- AI enrichment is OFF by default. It can be enabled later with
  ENABLE_AI_ENRICHMENT=1, but the bot must still work if the AI provider is
  unavailable or rate-limited.
"""

import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from typing import Any, Dict, List

import requests

try:
    import pymupdf as fitz
except ImportError:
    fitz = None

try:
    from PIL import Image
except ImportError:
    Image = None


OCR_SPACE_URL = "https://api.ocr.space/parse/image"


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _ocr_api_key() -> str:
    return os.environ.get("OCR_SPACE_API_KEY", "").strip() or "helloworld"


def _compress_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> tuple[bytes, str]:
    """Shrink large Telegram images without making OCR unusably blurry."""
    if Image is None:
        return image_bytes, mime_type or "image/jpeg"

    try:
        src = Image.open(BytesIO(image_bytes)).convert("RGB")
        max_side = 1500
        if max(src.size) > max_side:
            ratio = max_side / float(max(src.size))
            src = src.resize(
                (
                    max(1, int(src.width * ratio)),
                    max(1, int(src.height * ratio)),
                ),
                Image.LANCZOS,
            )

        # OCR.space free upload limit is 1 MB. Aim well below it.
        quality = 88
        data = image_bytes
        while quality >= 55:
            out = BytesIO()
            src.save(out, format="JPEG", quality=quality, optimize=True)
            data = out.getvalue()
            if len(data) <= 500_000:
                return data, "image/jpeg"
            quality -= 7
        return data, "image/jpeg"
    except Exception:
        return image_bytes, mime_type or "image/jpeg"


def _pdf_pages_as_images(document_bytes: bytes) -> List[bytes]:
    if fitz is None:
        raise RuntimeError("دعم PDF غير مثبت في بيئة التشغيل.")

    try:
        pdf = fitz.open(stream=document_bytes, filetype="pdf")
    except Exception as exc:
        raise RuntimeError(f"تعذر فتح ملف PDF: {exc}") from exc

    pages: List[bytes] = []
    try:
        if pdf.page_count == 0:
            raise RuntimeError("ملف PDF فارغ.")

        # Do not silently discard pages. Process the complete document.
        for page_index in range(pdf.page_count):
            page = pdf.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.30, 1.30), alpha=False)
            jpg = pix.tobytes("jpeg", jpg_quality=78)
            jpg, _ = _compress_image(jpg, "image/jpeg")
            pages.append(jpg)
    finally:
        pdf.close()

    return pages


def _ocr_one(image_bytes: bytes, filename: str, api_key: str) -> str:
    response = requests.post(
        OCR_SPACE_URL,
        headers={"apikey": api_key},
        files={"file": (filename, image_bytes, "image/jpeg")},
        data={
            "language": "ara",
            "OCREngine": "3",
            "detectOrientation": "true",
            "scale": "false",
            "isOverlayRequired": "false",
            "isTable": "false",
        },
        timeout=30,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"OCR.space HTTP {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    if body.get("IsErroredOnProcessing"):
        msg = body.get("ErrorMessage") or body.get("ErrorDetails") or "OCR.space processing error"
        if isinstance(msg, list):
            msg = " ".join(str(x) for x in msg)
        raise RuntimeError(str(msg)[:700])

    texts = []
    for item in body.get("ParsedResults", []) or []:
        text = (item.get("ParsedText") or "").strip()
        if text:
            texts.append(text)

    result = "\n\n".join(texts).strip()
    if not result:
        raise RuntimeError("OCR.space لم يستخرج نصاً من المستند.")
    return result


def ocr_document(document_bytes: bytes, mime_type: str) -> Dict[str, Any]:
    """OCR Arabic image/PDF. No generative AI is involved in this step."""
    mime = (mime_type or "").lower().split(";", 1)[0].strip()
    api_key = _ocr_api_key()

    if mime == "application/pdf":
        pages = _pdf_pages_as_images(document_bytes)
        page_texts = [""] * len(pages)

        # Parallel OCR keeps multi-page documents reasonably fast.
        with ThreadPoolExecutor(max_workers=min(4, len(pages) or 1)) as pool:
            futures = {
                pool.submit(_ocr_one, page, f"page_{index}.jpg", api_key): index
                for index, page in enumerate(pages, start=1)
            }
            for future in as_completed(futures):
                index = futures[future]
                try:
                    page_texts[index - 1] = (
                        f"[الصفحة {index}]\n{future.result()}"
                    )
                except Exception as exc:
                    # Preserve page position and make the failure visible.
                    page_texts[index - 1] = (
                        f"[الصفحة {index}]\n[تعذر OCR لهذه الصفحة: {exc}]"
                    )

        full_text = "\n\n".join(page_texts).strip()
        if not full_text:
            raise RuntimeError("تعذر استخراج النص من صفحات PDF.")

        return {
            "text": full_text,
            "pages": len(pages),
            "engine": "ocr.space-engine-3",
        }

    if not mime.startswith("image/"):
        raise RuntimeError("التحليل التلقائي يدعم الصور وملفات PDF فقط.")

    compressed, _ = _compress_image(document_bytes, mime)
    text = _ocr_one(compressed, "telegram_document.jpg", api_key)
    return {
        "text": text,
        "pages": 1,
        "engine": "ocr.space-engine-3",
    }


def _line_value(text: str, labels: List[str]) -> str | None:
    """Read a value only when it follows an explicit label."""
    label = "(?:" + "|".join(re.escape(x) for x in labels) + ")"
    match = re.search(
        rf"{label}\s*[:：\-#]?\s*([^\n\r]+)",
        text,
        flags=re.IGNORECASE,
    )
    return _clean(match.group(1)) if match else None


def _extract_request_number(text: str) -> str | None:
    match = re.search(
        r"(?:رقم\s*(?:الطلب|الخطاب|الصادر)|رقم)\s*[:：#\-]?\s*([0-9٠-٩]+)",
        text,
        flags=re.IGNORECASE,
    )
    return _clean(match.group(1)) if match else None


def _extract_date(text: str) -> str | None:
    match = re.search(
        r"(?:التاريخ|تاريخ\s*(?:الطلب|التقديم|الخطاب))\s*[:：\-]?\s*([^\n\r]+)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return _clean(match.group(1))

    match = re.search(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
        text,
    )
    return _clean(match.group(1)) if match else None


def _today_egypt() -> str:
    """Return today's date in Egypt, not the document's printed date."""
    return datetime.now(ZoneInfo("Africa/Cairo")).strftime("%Y-%m-%d")


def _header_person(text: str) -> str | None:
    """Extract the person named after 'مقدمة لسيادتكم' for special requests."""
    match = re.search(
        r"مقدمة\s*(?:ل|إلى)?\s*سيادتكم\s*[/\\:：-]?\s*([^\n\r]+)",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    value = _clean(match.group(1))
    if not value:
        return None

    # Stop before phone/address/contact lines when OCR places them nearby.
    value = re.split(r"\s+(?:ت|تليفون|هاتف|موبايل|قومي|الرقم القومي)\s*[/\\:：-]?", value, maxsplit=1, flags=re.IGNORECASE)[0]
    return _clean(value)


def _recipient_header(text: str) -> tuple[str | None, str | None]:
    """Extract recipient person and the job/title written after him."""
    match = re.search(
        r"(?:إلى|الى|السيد|السيد/|مقدم(?:ة)?\s+إلى|مقدمة\s+إلى)\s*(?:السيد\s*[/\\:]?\s*)?([^\n\r]+)",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None

    line = _clean(match.group(1))
    if not line:
        return None, None

    # Typical form: 'اسم الشخص - الوظيفة' or 'اسم الشخص الوظيفة'.
    line = re.split(r"\s+(?:ت|تليفون|هاتف|موبايل|قومي|الرقم القومي)\s*[/\\:：-]?", line, maxsplit=1, flags=re.IGNORECASE)[0]
    parts = [p.strip() for p in re.split(r"\s*[-–—|،,]\s*", line) if p.strip()]
    if len(parts) >= 2:
        return parts[0], parts[1]

    # If there is no separator, recognize common official job phrases.
    job_match = re.search(
        r"(.+?)\s+(وزير|محافظ|رئيس|نائب|وكيل|مدير|رئيس مجلس|سكرتير|رئيس الجهاز|رئيس الهيئة|العميد|اللواء|الدكتور|المهندس|الأستاذ)(?:\s+.*)?$",
        line,
        flags=re.IGNORECASE,
    )
    if job_match:
        person = _clean(job_match.group(1))
        job = _clean(line[len(job_match.group(1)):])
        return person, job

    return line, None


def _extract_authority(text: str, request_type: str) -> str | None:
    """Extract the receiving authority, independently from the applicant."""
    # In a special request, the presence of 'مقدمة لسيادتكم' wins over the
    # existence of an 'إلى السيد...' header. The recipient header identifies
    # the authority; it is NOT a general request.
    top_lines = []
    for line in text.splitlines()[:12]:
        line = line.strip()
        if not line:
            continue
        if re.search(r"تحية\s+طيبة|وبعد", line, flags=re.IGNORECASE):
            break
        top_lines.append(line)
    top = "\n".join(top_lines)

    # Explicit Egyptian governorate pattern. For example:
    # 'السيد ... - محافظ الدقهلية' -> 'محافظ الدقهلية'
    governor = re.search(
        r"محافظ\s+(الدقهلية|القاهرة|الجيزة|الإسكندرية|البحيرة|الشرقية|الغربية|المنوفية|القليوبية|كفر\s+الشيخ|دمياط|بورسعيد|الإسماعيلية|السويس|شمال\s+سيناء|جنوب\s+سيناء|مطروح|الفيوم|بني\s+سويف|المنيا|أسيوط|سوهاج|قنا|الأقصر|أسوان|الوادي\s+الجديد)",
        top,
        flags=re.IGNORECASE,
    )
    if governor:
        return _clean(governor.group(0))

    # Otherwise use the recipient's explicitly written job/title.
    _, recipient_job = _recipient_header(top)
    if recipient_job:
        return recipient_job

    return _line_value(
        text, ["الجهة", "الجهة المعنية", "الجهة المختصة", "الوزارة", "المؤسسة"]
    )


def _extract_general_title(text: str) -> str | None:
    """For general requests, title = the actual requested objective."""
    explicit = _line_value(text, ["الموضوع", "موضوع الطلب", "المطلوب", "الطلب"])
    if explicit:
        return explicit[:500]

    # Prefer a line that clearly states the requested work/service.
    objective_pattern = re.compile(
        r"(?:إنشاء|انشاء|رصف|ترصيف|توفير|إقامة|اقامة|إنارة|انارة|إصلاح|اصلاح|تركيب|توصيل|مد\s+خط|عمل\s+كوبري|إنشاء\s+كوبري|تطوير|رفع\s+كفاءة|تخصيص|إحلال|احلال|تمهيد|ازدواج|توسعة|توسيع)",
        re.IGNORECASE,
    )
    for line in text.splitlines():
        line = line.strip()
        if line and objective_pattern.search(line):
            return line[:500]
    return None


def _extract_title(text: str, request_type: str) -> str | None:
    """Apply the parliamentary document naming rules."""
    if request_type == "special":
        # Special request: the name after 'مقدمة لسيادتكم' is the title.
        person = _header_person(text)
        if person:
            return person

    return _extract_general_title(text)


def _detect_request_type(text: str) -> str:
    """Detect the parliamentary document type from the document heading."""
    # A document headed 'طلب إحاطة' is explicitly an إحاطة request.
    # Check the beginning because OCR may find the phrase elsewhere in the body.
    top = "\n".join(text.splitlines()[:8])
    if re.search(r"طلب\s+إحاطة|طلب\s+احاطة", top, flags=re.IGNORECASE):
        return "briefing"

    # Special request: the name after 'مقدمة لسيادتكم' is the title.
    if re.search(r"مقدمة\s*(?:ل|إلى)?\s*سيادتكم", text, flags=re.IGNORECASE):
        return "special"

    # General request: addressed to a person/official and asking for an objective.
    if re.search(
        r"(?:إلى|الى)\s*(?:السيد\s*)?[/\\:]?",
        text,
        flags=re.IGNORECASE,
    ):
        return "general"

    return "special"


def _extract_reply(text: str) -> tuple[bool, str | None]:
    """Detect an actual reply section only when OCR contains reply markers."""
    patterns = [
        r"(?:الرد|رد\s*الجهة|رد\s*الوزارة|رد\s*الإدارة)\s*[:：\-]?\s*([^\n]+(?:\n(?!\s*(?:مقدم الطلب|الموضوع|التاريخ|رقم الطلب)\b)[^\n]+){0,5})",
        r"(?:نفيدكم|بالإشارة إلى|إفادة)\s*[:：\-]?\s*([^\n]+(?:\n[^\n]+){0,3})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = _clean(match.group(1))
            if value:
                return True, value

    # Common official closing phrases can indicate an OCR-visible response.
    if re.search(r"(?:لا مانع|تمت الموافقة|جار(?:ي|ى) اتخاذ|تم اتخاذ|نفيدكم بأنه|يتعذر|تعذر|مرفوض)", text):
        # Do not pretend the whole document is a reply. Return only an explicit
        # reply marker if one exists; otherwise leave it for manual review.
        return False, None

    return False, None


def _basic_extract_from_ocr(source_text: str) -> Dict[str, Any]:
    """Deterministic extraction following the user's request-form rules."""
    reply_found, reply_text = _extract_reply(source_text)
    request_type = _detect_request_type(source_text)

    special_person = _header_person(source_text)
    recipient_person, recipient_job = _recipient_header(source_text)

    # In general requests, the authority is the recipient's official job/title
    # when it is explicitly present in the opening 'إلى السيد...' line.
    authority = _extract_authority(source_text, request_type)

    applicant = special_person or _line_value(
        source_text, ["مقدم الطلب", "اسم مقدم الطلب", "الاسم"]
    )

    result: Dict[str, Any] = {
        # The request date is ALWAYS today's Egypt date.
        "title": _extract_title(source_text, request_type),
        "reqDate": _today_egypt(),
        "requestType": request_type,
        "authority": authority,
        "applicantName": applicant,
        "jobTitle": _line_value(
            source_text, ["الوظيفة", "المسمى الوظيفي", "الدرجة الوظيفية"]
        ),
        "workplace": _line_value(
            source_text, ["جهة العمل", "مكان العمل", "محل العمل"]
        ),
        "details": source_text,
        "requestNumber": _extract_request_number(source_text),
        "hasOfficialReply": reply_found,
        "officialReplyText": reply_text,
        "confidence": 0,
        "aiModel": "ocr-only",
        "aiRequestedModel": None,
    }

    # For a general request, recipient job/title is the authority by rule.
    if request_type == "general" and recipient_job:
        result["authority"] = recipient_job

    filled = sum(
        1
        for key in (
            "title",
            "reqDate",
            "authority",
            "applicantName",
            "jobTitle",
            "workplace",
            "requestNumber",
        )
        if result.get(key)
    )
    result["confidence"] = min(100, filled * 12)
    return result

    filled = sum(
        1
        for key in (
            "title",
            "reqDate",
            "authority",
            "applicantName",
            "jobTitle",
            "workplace",
            "requestNumber",
        )
        if result.get(key)
    )
    result["confidence"] = min(100, filled * 12)
    return result


def _optional_ai_enrichment(text: str, base: Dict[str, Any], hint: str = "") -> Dict[str, Any]:
    """Optional AI enhancement. Disabled by default and never required.

    This deliberately uses no JSON parsing. If the provider returns 429,
    malformed output, or times out, the OCR result is returned unchanged.
    """
    if os.environ.get("ENABLE_AI_ENRICHMENT", "0").strip().lower() not in {
        "1", "true", "yes", "on"
    }:
        return base

    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return base

    # Keep this feature opt-in. The critical upload path must not depend on it.
    # We only ask for tagged values that can be grounded against OCR.
    prompt = (
        "استخرج من النص التالي فقط القيم الموجودة حرفياً، بدون اختراع أو تلخيص. "
        "لا تكتب JSON. أخرج هذه الوسوم فقط: "
        "<title>...</title><date>...</date><authority>...</authority>"
        "<applicant>...</applicant><job>...</job><workplace>...</workplace>"
        "<requestNumber>...</requestNumber>. "
        "لا تستخرج أو تنشئ أي رد.\n---\n"
        + text[:14000]
        + "\n---"
    )
    if hint:
        prompt += "\nملاحظة: " + hint[:500]

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/mohamednasr5/work",
                "X-Title": "Work Telegram Requests AI",
            },
            json={
                "model": "openrouter/free",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "max_tokens": 500,
            },
            timeout=4,
        )
        if response.status_code >= 400:
            return base

        body = response.json()
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "\n".join(
                str(x.get("text", ""))
                for x in content
                if isinstance(x, dict) and x.get("text")
            )

        tags = {
            "title": "title",
            "date": "reqDate",
            "authority": "authority",
            "applicant": "applicantName",
            "job": "jobTitle",
            "workplace": "workplace",
            "requestNumber": "requestNumber",
        }
        enriched = dict(base)
        for tag, field in tags.items():
            match = re.search(
                rf"<{re.escape(tag)}>\s*(.*?)\s*</{re.escape(tag)}>",
                str(content),
                flags=re.IGNORECASE | re.DOTALL,
            )
            value = _clean(match.group(1)) if match else None
            if value and _grounded(value, text):
                enriched[field] = value

        enriched["aiModel"] = body.get("model") or "openrouter/free"
        enriched["aiRequestedModel"] = "openrouter/free"
        return enriched
    except Exception:
        return base


def _grounded(value: Any, source_text: str) -> bool:
    if value is None:
        return False
    return _normalize_for_grounding(value) in _normalize_for_grounding(source_text)


def _normalize_for_grounding(value: Any) -> str:
    s = "" if value is None else str(value)
    s = re.sub(r"[\u064B-\u065F\u0670]", "", s)
    s = (
        s.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
    )
    s = re.sub(r"[^\w\u0600-\u06FF]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip().lower()


def analyze_document(
    document_bytes: bytes,
    mime_type: str = "image/jpeg",
    hint: str = "",
) -> Dict[str, Any]:
    """Main entry point used by bot_launcher.py.

    The returned result is always usable after successful OCR, even when
    OpenRouter is completely unavailable or rate-limited.
    """
    ocr = ocr_document(document_bytes, mime_type)
    result = _basic_extract_from_ocr(ocr["text"])
    result = _optional_ai_enrichment(ocr["text"], result, hint)

    result["details"] = ocr["text"]
    result["ocrText"] = ocr["text"]
    result["pagesAnalyzed"] = ocr["pages"]
    result["ocrEngine"] = ocr["engine"]
    return result


def analyze_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    hint: str = "",
) -> Dict[str, Any]:
    return analyze_document(image_bytes, mime_type, hint)
