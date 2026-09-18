# -*- coding: utf-8 -*-
"""Vision AI processor for new Telegram request documents.

The module only analyzes a newly received image. It never writes to Firebase.
Existing-request upload flow remains in bot.py and is intentionally untouched.
"""

import base64
import json
import os
import re
from typing import Any, Dict

import requests

try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    fitz = None

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",
]

SYSTEM_PROMPT = r"""
أنت محلل مستندات عربية رسمية. اقرأ صورة الخطاب بدقة واستخرج بيانات منظمة.

قواعد صارمة:
1. لا تخترع أي معلومة غير موجودة في المستند.
2. إذا تعذر قراءة معلومة اجعلها null.
3. حافظ على أسماء الأشخاص والجهات كما تظهر في المستند.
4. استخرج مضمون الطلب، وليس وصف الصورة.
5. اجعل العنوان مختصرًا وواضحًا ويصف موضوع الطلب.
6. requestType واحد فقط من: special, general, briefing, urgent, interrogation.
7. suggestedReply رد مقترح فقط، وليس ردًا صادرًا فعليًا.
8. confidence رقم صحيح من 0 إلى 100.
9. أخرج JSON فقط.

الصيغة:
{
  "title": "",
  "reqDate": null,
  "requestType": "special",
  "authority": "",
  "applicantName": null,
  "jobTitle": null,
  "workplace": null,
  "details": "",
  "suggestedReply": "",
  "confidence": 0
}
"""


def _extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return {}
        try:
            value = json.loads(match.group(0))
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}


def _clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


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
        "suggestedReply": _clean(data.get("suggestedReply")) or "",
        "confidence": max(0, min(100, confidence)),
    }


def _document_data_urls(document_bytes: bytes, mime_type: str) -> list[str]:
    """Return one or more compact image data URLs for the vision model."""
    mime = (mime_type or "").lower().split(";", 1)[0].strip()
    if mime == "application/pdf":
        if fitz is None:
            raise RuntimeError("دعم PDF غير مثبت في بيئة التشغيل.")
        try:
            pdf = fitz.open(stream=document_bytes, filetype="pdf")
        except Exception as exc:
            raise RuntimeError(f"تعذر فتح ملف PDF: {exc}") from exc
        urls = []
        try:
            if pdf.page_count == 0:
                raise RuntimeError("ملف PDF فارغ.")
            for page_index in range(min(pdf.page_count, 8)):
                page = pdf.load_page(page_index)
                pix = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
                jpg = pix.tobytes("jpeg", jpg_quality=78)
                urls.append(
                    "data:image/jpeg;base64," + base64.b64encode(jpg).decode("ascii")
                )
        finally:
            pdf.close()
        return urls
    if not mime.startswith("image/"):
        raise RuntimeError("التحليل التلقائي يدعم الصور وملفات PDF فقط.")
    safe_mime = "image/jpeg" if mime == "image/jpg" else (mime or "image/jpeg")
    return [
        f"data:{safe_mime};base64,{base64.b64encode(document_bytes).decode('ascii')}"
    ]


def analyze_image(image_bytes: bytes, mime_type: str = "image/jpeg", hint: str = "") -> Dict[str, Any]:
    """Analyze a NEW document with resilient model + provider failover."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY غير موجود في GitHub Secrets")
    if not image_bytes:
        raise RuntimeError("المستند فارغ.")

    data_urls = _document_data_urls(image_bytes, mime_type)
    prompt = SYSTEM_PROMPT
    if len(data_urls) > 1:
        prompt += f"\nتم تحليل {len(data_urls)} صفحات من المستند."
    if hint:
        prompt += "\nملاحظة المستخدم عن المستند:\n" + hint[:1200]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/mohamednasr5/work",
        "X-Title": "Work Telegram Requests AI",
    }

    content = [{"type": "text", "text": prompt}] + [
        {"type": "image_url", "image_url": {"url": url}}
        for url in data_urls
    ]

    # OpenRouter supports model-level fallback. A provider 429 is therefore
    # allowed to fall through to another provider/model before we fail.
    payload = {
        "model": MODELS[0],
        "models": MODELS[1:],
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
                headers=headers,
                json=payload,
                timeout=150,
            )
            if response.status_code == 429:
                last_error = response.text[:700].replace("\n", " ")
                if attempt < 2:
                    import time
                    time.sleep(4 * (attempt + 1))
                    continue
                raise RuntimeError(
                    "OpenRouter/AI provider rate-limited the request (429). "
                    "سيتم استخدام المسار الاحتياطي في المحاولة التالية. " + last_error
                )

            if response.status_code == 400 and "response_format" in response.text:
                # Some free providers do not implement JSON response_format.
                payload.pop("response_format", None)
                response = requests.post(
                    OPENROUTER_URL,
                    headers=headers,
                    json=payload,
                    timeout=150,
                )

            if response.status_code >= 400:
                raise RuntimeError(
                    f"HTTP {response.status_code}: {response.text[:900].replace(chr(10), ' ')}"
                )

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
            result["aiModel"] = body.get("model") or MODELS[0]
            result["aiRequestedModel"] = MODELS[0]
            result["pagesAnalyzed"] = len(data_urls)
            return result

        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt < 2:
                import time
                time.sleep(3 * (attempt + 1))
                continue
            break
        except Exception as exc:
            last_error = str(exc)
            break

    raise RuntimeError(
        "تعذر تحليل المستند بعد استخدام مسارات الذكاء الاحتياطية. "
        + last_error[:1200]
    )

# Backward-compatible alias for existing callers.
def analyze_document(document_bytes: bytes, mime_type: str = "image/jpeg", hint: str = "") -> Dict[str, Any]:
    return analyze_image(document_bytes, mime_type, hint)
