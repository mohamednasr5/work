# -*- coding: utf-8 -*-
"""Document OCR + AI processor for NEW Telegram requests.

Pipeline:
1) OCR.space (Arabic OCR, Engine 3) extracts the actual document text.
2) OpenRouter/Gemma structures that OCR text into the request schema.
3) If OCR.space fails, the existing multimodal Vision path is used as a fallback.

This module NEVER writes to Firebase. Existing requests are untouched.
"""

import base64
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OCR_SPACE_URL = "https://api.ocr.space/parse/image"

# Text-only calls are much lighter than Vision calls. Keep the user's preferred
# Gemma models first, then let OpenRouter choose a compatible free model.
TEXT_MODELS = [
    "openrouter/free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
]

VISION_MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",
]

SYSTEM_PROMPT = r"""
أنت أداة استخراج بيانات من مستندات عربية رسمية، ولست كاتباً ولا محرراً.

الهدف الأساسي:
- انقل النص المقروء من المستند كما هو.
- املأ حقول نموذج الطلب فقط من معلومات موجودة فعلياً في المستند.
- ممنوع تماماً اختراع أسماء أو جهات أو وظائف أو تواريخ أو وقائع أو ردود.
- ممنوع تلخيص أو إعادة صياغة نص الطلب داخل details؛ سيتم حفظ النص الكامل المستخرج من OCR كما هو.
- لا تكتب أي رد مقترح من عندك.
- إذا كانت معلومة غير موجودة أو غير مقروءة اجعلها null.
- أي قيمة تستخرجها لحقول title/authority/applicantName/jobTitle/workplace يجب أن تكون منقولة حرفياً من المستند قدر الإمكان، وليست صياغة جديدة.
- requestType يحدد فقط من صيغة المستند إن كان ذلك واضحاً، وإلا استخدم special.
- إذا كان على المستند رد فعلي من جهة خارجية، فاستخرجه فقط إذا كان النص مقروءاً فعلاً، ولا تنشئ رداً جديداً. قد يكون الرد مطبوعاً أو مكتوباً بخط اليد بالقلم الأزرق.
- hasOfficialReply = true فقط إذا كان هناك رد فعلي ظاهر/مقروء على المستند؛ لا تعتمد على التخمين.
- officialReplyText يجب أن يكون النص الفعلي للرد فقط، وليس اقتراحاً.
- requestNumber استخرج رقم الطلب إن كان مكتوباً في المستند.
- أخرج JSON فقط.

الصيغة:
{
  "title": null,
  "reqDate": null,
  "requestType": "special",
  "authority": null,
  "applicantName": null,
  "jobTitle": null,
  "workplace": null,
  "details": "",
  "requestNumber": null,
  "hasOfficialReply": false,
  "officialReplyText": null,
  "confidence": 0
}
"""


def _extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        pass

    # Remove common markdown fences before trying a balanced JSON object.
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text, flags=re.I)
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            value = json.loads(match.group(0))
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _grounded(value: Any, source_text: str) -> bool:
    """Return True only when an extracted value is actually present in OCR text."""
    if value is None:
        return False
    v = _norm_for_grounding(value)
    s = _norm_for_grounding(source_text)
    return bool(v and s and v in s)


def _norm_for_grounding(value: Any) -> str:
    s = "" if value is None else str(value)
    s = re.sub(r"[\u064B-\u065F\u0670]", "", s)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\w\u0600-\u06FF]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip().lower()


def _normalize(data: Dict[str, Any]) -> Dict[str, Any]:
    allowed = {"special", "general", "briefing", "urgent", "interrogation"}
    request_type = data.get("requestType")
    if request_type not in allowed:
        request_type = "special"

    try:
        confidence = int(float(data.get("confidence", 0)))
    except (TypeError, ValueError):
        confidence = 0

    return {
        "title": _clean(data.get("title")) or "طلب رسمي",
        "reqDate": _clean(data.get("reqDate")),
        "requestType": request_type,
        "authority": _clean(data.get("authority")) or "غير محددة",
        "applicantName": _clean(data.get("applicantName")),
        "jobTitle": _clean(data.get("jobTitle")),
        "workplace": _clean(data.get("workplace")),
        "details": _clean(data.get("details")) or "",
        "requestNumber": _clean(data.get("requestNumber")),
        "hasOfficialReply": bool(data.get("hasOfficialReply")),
        "officialReplyText": _clean(data.get("officialReplyText")),
        "confidence": max(0, min(100, confidence)),
    }


def _compress_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> tuple[bytes, str]:
    """Keep OCR.space free-tier uploads below its 1 MB file limit."""
    if Image is None:
        return image_bytes, mime_type or "image/jpeg"

    try:
        from io import BytesIO
        src = Image.open(BytesIO(image_bytes))
        src = src.convert("RGB")

        # Downscale very large phone scans while preserving enough detail for OCR.
        max_side = 1800
        if max(src.size) > max_side:
            ratio = max_side / float(max(src.size))
            src = src.resize((max(1, int(src.width * ratio)), max(1, int(src.height * ratio))), Image.LANCZOS)

        quality = 88
        while quality >= 55:
            out = BytesIO()
            src.save(out, format="JPEG", quality=quality, optimize=True)
            data = out.getvalue()
            if len(data) <= 700_000:
                return data, "image/jpeg"
            quality -= 7

        return data, "image/jpeg"
    except Exception:
        return image_bytes, mime_type or "image/jpeg"


def _pdf_pages_as_images(document_bytes: bytes, max_pages: int = 3) -> List[bytes]:
    """Render PDF pages to OCR-friendly JPEGs so each request stays under 1 MB."""
    if fitz is None:
        raise RuntimeError("دعم PDF غير مثبت في بيئة التشغيل.")

    try:
        pdf = fitz.open(stream=document_bytes, filetype="pdf")
    except Exception as exc:
        raise RuntimeError(f"تعذر فتح ملف PDF: {exc}") from exc

    pages = []
    try:
        if pdf.page_count == 0:
            raise RuntimeError("ملف PDF فارغ.")

        for page_index in range(min(pdf.page_count, max_pages)):
            page = pdf.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
            jpg = pix.tobytes("jpeg", jpg_quality=78)
            jpg, _ = _compress_image(jpg, "image/jpeg")
            pages.append(jpg)
    finally:
        pdf.close()

    return pages


def _ocr_api_key() -> str:
    # helloworld is documented by OCR.space for quick testing only and is
    # severely rate limited. A user's free API key should be stored in Secrets.
    return os.environ.get("OCR_SPACE_API_KEY", "").strip() or "helloworld"


def _ocr_one(image_bytes: bytes, filename: str, api_key: str) -> str:
    files = {
        "file": (filename, image_bytes, "image/jpeg"),
    }
    data = {
        "language": "ara",
        "OCREngine": "3",
        "detectOrientation": "true",
        "scale": "false",
        "isOverlayRequired": "false",
        "isTable": "false",
    }
    headers = {"apikey": api_key}

    response = requests.post(
        OCR_SPACE_URL,
        headers=headers,
        files=files,
        data=data,
        timeout=30,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"OCR.space HTTP {response.status_code}: {response.text[:500]}")

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
    """Extract Arabic text from image/PDF using OCR.space free API."""
    mime = (mime_type or "").lower().split(";", 1)[0].strip()
    api_key = _ocr_api_key()

    if mime == "application/pdf":
        pages = _pdf_pages_as_images(document_bytes, max_pages=3)
        page_texts = [""] * len(pages)

        with ThreadPoolExecutor(max_workers=min(3, len(pages) or 1)) as pool:
            futures = {
                pool.submit(_ocr_one, page, f"page_{index}.jpg", api_key): index
                for index, page in enumerate(pages, start=1)
            }
            for future in as_completed(futures):
                index = futures[future]
                try:
                    text = future.result()
                    page_texts[index - 1] = f"[الصفحة {index}]\n{text}"
                except Exception as exc:
                    page_texts[index - 1] = (
                        f"[الصفحة {index}]\n[تعذر OCR لهذه الصفحة: {exc}]"
                    )
        full_text = "\n\n".join(page_texts).strip()
        if not full_text:
            raise RuntimeError("تعذر استخراج النص من صفحات PDF.")
        return {
            "text": full_text,
            "pages": len(pages),
            "engine": "ocr.space-engine-1",
        }

    if not mime.startswith("image/"):
        raise RuntimeError("التحليل التلقائي يدعم الصور وملفات PDF فقط.")

    compressed, _ = _compress_image(document_bytes, mime)
    text = _ocr_one(compressed, "telegram_document.jpg", api_key)
    return {
        "text": text,
        "pages": 1,
        "engine": "ocr.space-engine-1",
    }


def _openrouter_headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/mohamednasr5/work",
        "X-Title": "Work Telegram Requests AI",
    }


def _analyze_ocr_text(text: str, hint: str = "") -> Dict[str, Any]:
    """Structured extraction with a strict JSON response and one fast retry."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY غير موجود في GitHub Secrets")

    source_text = text.strip()
    prompt = SYSTEM_PROMPT + "\n\nنص المستند المستخرج بواسطة OCR:\n---\n" + source_text[:18000] + "\n---"
    if hint:
        prompt += "\nملاحظة المستخدم:\n" + hint[:800]

    payload = {
        "model": TEXT_MODELS[0],
        "models": TEXT_MODELS[1:],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 1400,
        "provider": {"allow_fallbacks": True},
        "response_format": {"type": "json_object"},
    }

    def call(body):
        try:
            return requests.post(
                OPENROUTER_URL,
                headers=_openrouter_headers(api_key),
                json=body,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"OpenRouter connection error: {exc}") from exc

    response = call(payload)

    # Some free models do not implement response_format. Retry once without it.
    if response.status_code == 400 and "response_format" in response.text.lower():
        payload.pop("response_format", None)
        response = call(payload)

    if response.status_code >= 400:
        raise RuntimeError(
            f"OpenRouter HTTP {response.status_code}: {response.text[:900]}"
        )

    body = response.json()
    message = body.get("choices", [{}])[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, list):
        content = "\n".join(
            str(x.get("text", ""))
            for x in content
            if isinstance(x, dict) and x.get("text")
        )

    parsed = _extract_json(content)

    # A second, deliberately tiny repair request handles models that returned
    # prose/markdown despite the JSON constraint. It does not receive any new
    # information, so it cannot legitimately add facts.
    if not parsed:
        repair_prompt = (
            "حوّل النص التالي إلى JSON فقط وفق الحقول المحددة. "
            "ممنوع إضافة أو تخمين أي معلومة غير موجودة. "
            "لا تكتب شرحاً ولا Markdown.\n"
            + SYSTEM_PROMPT
            + "\nالنص:\n---\n"
            + source_text[:18000]
            + "\n---"
        )
        repair_payload = {
            "model": TEXT_MODELS[0],
            "models": TEXT_MODELS[1:],
            "messages": [{"role": "user", "content": repair_prompt}],
            "temperature": 0,
            "max_tokens": 1400,
            "provider": {"allow_fallbacks": True},
            "response_format": {"type": "json_object"},
        }
        repair_response = call(repair_payload)
        if repair_response.status_code == 400 and "response_format" in repair_response.text.lower():
            repair_payload.pop("response_format", None)
            repair_response = call(repair_payload)
        if repair_response.status_code >= 400:
            raise RuntimeError(
                f"OpenRouter repair HTTP {repair_response.status_code}: {repair_response.text[:900]}"
            )
        repair_body = repair_response.json()
        repair_message = repair_body.get("choices", [{}])[0].get("message", {})
        repair_content = repair_message.get("content", "")
        if isinstance(repair_content, list):
            repair_content = "\n".join(
                str(x.get("text", ""))
                for x in repair_content
                if isinstance(x, dict) and x.get("text")
            )
        parsed = _extract_json(repair_content)
        if not parsed:
            raise RuntimeError("AI returned invalid JSON after repair attempt")
        body = repair_body

    result = _normalize(parsed)

    # Ground every extracted field in the OCR. If the model invents a value
    # that does not occur in the source text, discard that value.
    for field in ("title", "authority", "applicantName", "jobTitle", "workplace", "requestNumber", "officialReplyText"):
        value = result.get(field)
        if value and not _grounded(value, source_text):
            result[field] = None

    # The details field is NEVER generated by AI: it is the complete OCR text.
    result["details"] = source_text
    if not result.get("officialReplyText"):
        result["hasOfficialReply"] = False
        result["officialReplyText"] = None

    result["aiModel"] = body.get("model") or TEXT_MODELS[0]
    result["aiRequestedModel"] = TEXT_MODELS[0]
    return result

def _document_data_urls(document_bytes: bytes, mime_type: str) -> list[str]:
    """Legacy Vision fallback: render PDF pages as compact images."""
    mime = (mime_type or "").lower().split(";", 1)[0].strip()
    if mime == "application/pdf":
        if fitz is None:
            raise RuntimeError("دعم PDF غير مثبت في بيئة التشغيل.")
        pdf = fitz.open(stream=document_bytes, filetype="pdf")
        urls = []
        try:
            for page_index in range(min(pdf.page_count, 8)):
                page = pdf.load_page(page_index)
                pix = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
                jpg = pix.tobytes("jpeg", jpg_quality=78)
                urls.append("data:image/jpeg;base64," + base64.b64encode(jpg).decode("ascii"))
        finally:
            pdf.close()
        return urls

    if not mime.startswith("image/"):
        raise RuntimeError("التحليل التلقائي يدعم الصور وملفات PDF فقط.")
    return ["data:" + ("image/jpeg" if mime == "image/jpg" else mime) + ";base64," + base64.b64encode(document_bytes).decode("ascii")]


def _analyze_vision(document_bytes: bytes, mime_type: str, hint: str = "") -> Dict[str, Any]:
    """Original Vision fallback kept intact as a secondary route."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY غير موجود في GitHub Secrets")

    data_urls = _document_data_urls(document_bytes, mime_type)
    prompt = SYSTEM_PROMPT
    if hint:
        prompt += "\nملاحظة المستخدم عن المستند:\n" + hint[:1200]

    content = [{"type": "text", "text": prompt}] + [
        {"type": "image_url", "image_url": {"url": url}} for url in data_urls
    ]

    payload = {
        "model": VISION_MODELS[0],
        "models": VISION_MODELS[1:],
        "messages": [{"role": "user", "content": content}],
        "temperature": 0,
        "max_tokens": 2400,
        "provider": {"allow_fallbacks": True},
        "response_format": {"type": "json_object"},
    }

    last_error = ""
    for attempt in range(3):
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers=_openrouter_headers(api_key),
                json=payload,
                timeout=150,
            )
            if response.status_code == 400 and "response_format" in response.text:
                payload.pop("response_format", None)
                response = requests.post(
                    OPENROUTER_URL,
                    headers=_openrouter_headers(api_key),
                    json=payload,
                    timeout=150,
                )

            if response.status_code == 429:
                last_error = response.text[:700].replace("\n", " ")
                if attempt < 2:
                    time.sleep(4 * (attempt + 1))
                    continue
                raise RuntimeError("Vision provider rate-limited: " + last_error)

            if response.status_code >= 400:
                raise RuntimeError(f"Vision HTTP {response.status_code}: {response.text[:900]}")

            body = response.json()
            message = body.get("choices", [{}])[0].get("message", {})
            content_out = message.get("content", "")
            if isinstance(content_out, list):
                content_out = "\n".join(
                    str(x.get("text", "")) for x in content_out
                    if isinstance(x, dict) and x.get("text")
                )
            parsed = _extract_json(content_out)
            if not parsed:
                raise RuntimeError("AI returned invalid JSON")

            result = _normalize(parsed)
            result["aiModel"] = body.get("model") or VISION_MODELS[0]
            result["aiRequestedModel"] = VISION_MODELS[0]
            result["pagesAnalyzed"] = len(data_urls)
            return result

        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            break
        except Exception as exc:
            last_error = str(exc)
            break

    raise RuntimeError("تعذر تحليل المستند عبر Vision. " + last_error[:1200])


def analyze_document(document_bytes: bytes, mime_type: str = "image/jpeg", hint: str = "") -> Dict[str, Any]:
    """Fast path: Arabic OCR -> one OpenRouter text request.

    Vision remains implemented for compatibility, but is intentionally not
    auto-triggered here because free-provider fallback chains can be slow.
    """
    ocr = ocr_document(document_bytes, mime_type)
    result = _analyze_ocr_text(ocr["text"], hint)
    result["pagesAnalyzed"] = ocr["pages"]
    result["ocrEngine"] = ocr["engine"]
    result["ocrText"] = ocr["text"]
    return result


# Backward-compatible alias for existing callers.
def analyze_image(image_bytes: bytes, mime_type: str = "image/jpeg", hint: str = "") -> Dict[str, Any]:
    return analyze_document(image_bytes, mime_type, hint)
