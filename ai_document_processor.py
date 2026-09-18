# -*- coding: utf-8 -*-
"""Free Vision AI processor for new Telegram document uploads.

IMPORTANT:
- This module does NOT touch existing request records.
- It is called only for a newly sent image when the current user is not
  already in the existing "awaiting_file" upload flow.
"""

import base64
import json
import os
import re
from typing import Any, Dict

import requests

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Both models are currently listed by OpenRouter as free multimodal models.
MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
]

SYSTEM_PROMPT = r"""
أنت محلل مستندات عربية رسمية. اقرأ صورة الخطاب بدقة واستخرج بيانات منظمة.

قواعد صارمة:
1. لا تخترع أي معلومة غير موجودة.
2. إذا تعذر قراءة معلومة اجعلها null.
3. حافظ على أسماء الأشخاص والجهات كما تظهر في المستند.
4. استخرج مضمون الطلب، وليس وصف الصورة.
5. العنوان مختصر وواضح ويصف موضوع الطلب.
6. requestType واحد فقط من:
   special, general, briefing, urgent, interrogation
7. إذا كان الطلب شخصيًا بوضوح استخدم special، وإذا كان متعلقًا بخدمة/موضوع عام
   استخدم general، ولا تغيّر التصنيف دون دليل من المستند.
8. suggestedReply مجرد رد مقترح من الذكاء الاصطناعي وليس ردًا صادرًا.
9. confidence رقم من 0 إلى 100.
10. أخرج JSON فقط.

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

def analyze_image(image_bytes: bytes, mime_type: str = "image/jpeg", hint: str = "") -> Dict[str, Any]:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY غير موجود في GitHub Secrets")

    data_url = (
        f"data:{mime_type or 'image/jpeg'};base64,"
        f"{base64.b64encode(image_bytes).decode('ascii')}"
    )

    prompt = SYSTEM_PROMPT
    if hint:
        prompt += "\nملاحظة المستخدم عن المستند:\n" + hint[:1000]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/mohamednasr5/work",
        "X-Title": "Work Telegram Requests AI",
    }

    errors = []

    for model in MODELS:
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }],
            "temperature": 0,
            "max_tokens": 1800,
            "response_format": {"type": "json_object"},
        }

        try:
            response = requests.post(
                OPENROUTER_URL,
                headers=headers,
                json=payload,
                timeout=90,
            )
            if response.status_code >= 400:
                errors.append(f"{model}: HTTP {response.status_code}")
                continue

            body = response.json()
            content = (
                body.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            parsed = _extract_json(content)
            if parsed:
                result = _normalize(parsed)
                result["aiModel"] = model
                return result

            errors.append(f"{model}: JSON غير صالح")

        except Exception as exc:
            errors.append(f"{model}: {exc}")

    raise RuntimeError("تعذر تحليل المستند: " + " | ".join(errors)[:900])
