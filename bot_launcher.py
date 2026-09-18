# -*- coding: utf-8 -*-
"""AI + duplicate-check + reply/action layer for the existing Telegram bot.

IMPORTANT:
- bot.py is NOT modified by this patch.
- Existing requests are never changed during duplicate detection.
- The original "awaiting_file" flow is passed to bot.py unchanged.
- New data is written only after the user explicitly approves an action.
"""

import asyncio
import re
import unicodedata
from datetime import datetime
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

import bot as legacy_bot
from ai_document_processor import analyze_document

_original_handle_media = legacy_bot.handle_media
_original_button_handler = legacy_bot.button_handler
_original_text_handler = legacy_bot.handle_text_input
_original_search_requests = legacy_bot.search_requests

# ---------------------------------------------------------------------------
# Arabic/text normalization and duplicate detection
# ---------------------------------------------------------------------------
def _norm(value) -> str:
    s = "" if value is None else str(value)
    s = unicodedata.normalize("NFKC", s).lower().strip()
    s = re.sub(r"[\u064B-\u065F\u0670]", "", s)
    s = s.replace("ـ", "")
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[\s\u200f\u200e]+", " ", s)
    s = re.sub(r"[\.,،؛;:!?؟()\[\]{}\"'`*_#\\/|]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _exact_fingerprint(r: dict):
    fields = (
        "title", "reqDate", "requestType", "authority", "applicantName",
        "jobTitle", "workplace", "details"
    )
    return tuple(_norm(r.get(k)) for k in fields)


def find_exact_duplicate(candidate: dict):
    fp = _exact_fingerprint(candidate)
    if not any(fp):
        return None
    for r in legacy_bot.get_all_requests():
        if _exact_fingerprint(r) == fp:
            return r
    return None


def _search_blob(r: dict) -> str:
    values = [
        r.get("reqId"), r.get("reqDate"), r.get("requestType"),
        r.get("status"), r.get("authority"), r.get("title"), r.get("details"),
        r.get("applicantName"), r.get("jobTitle"), r.get("workplace"),
        r.get("reply"), r.get("response"), r.get("repliesList"),
        r.get("replies"), r.get("replyHistory"), r.get("actions"),
        r.get("lastAction"), r.get("lastReplyAt"), r.get("lastActionAt"),
    ]
    return _norm(" ".join(str(v) for v in values if v is not None))


def broad_search_requests(query, filter_type="all", filter_status="all"):
    q = _norm(query)
    results = []
    for r in legacy_bot.get_all_requests():
        if filter_type != "all" and r.get("requestType") != filter_type:
            continue
        if filter_status != "all" and r.get("status") != filter_status:
            continue
        if not q or q in _search_blob(r):
            results.append(r)
    return results

legacy_bot.search_requests = broad_search_requests

# ---------------------------------------------------------------------------
# UI helpers
# ---------------------------------------------------------------------------
STATUS_LABELS = {
    "execution": "🔵 جاري التنفيذ",
    "executed": "✅ تم التنفيذ",
    "completed": "🟢 مكتمل",
    "follow_up": "🟡 قيد المتابعة",
    "stopped": "🔴 متوقف",
    "review": "🔍 قيد المراجعة",
    "replied": "✉️ تم الرد",
    "rejected": "❌ مرفوض",
}


def _is_ai_document(msg):
    if not msg.document:
        return False
    mime = (msg.document.mime_type or "").lower()
    name = (msg.document.file_name or "").lower()
    return (
        mime.startswith("image/")
        or mime == "application/pdf"
        or name.endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".pdf"))
    )


def _review_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✏️ تعديل نوع الطلب", callback_data="ai_edit:type"),
         InlineKeyboardButton("✏️ تعديل العنوان", callback_data="ai_edit:title")],
        [InlineKeyboardButton("✏️ تعديل الجهة المعنية", callback_data="ai_edit:authority"),
         InlineKeyboardButton("💬 تعديل الرد", callback_data="ai_edit:reply")],
        [InlineKeyboardButton("✅ اعتماد وحفظ", callback_data="ai_approve"),
         InlineKeyboardButton("❌ إلغاء", callback_data="ai_cancel")],
        [InlineKeyboardButton("🔄 إعادة التحليل", callback_data="ai_retry")],
    ])


def _type_label(value):
    return legacy_bot.TYPE_MAP.get(value, value or "—")


def _review_text(data):
    return "\n".join([
        "🤖 *تم تحليل المستند بالذكاء الاصطناعي*",
        "━━━━━━━━━━━━━━━━━━━━",
        f"📝 *العنوان:* {data.get('title') or '—'}",
        f"📅 *التاريخ:* {data.get('reqDate') or 'غير موجود'}",
        f"📌 *النوع:* {_type_label(data.get('requestType'))}",
        f"🏛 *الجهة:* {data.get('authority') or '—'}",
        f"👤 *مقدم الطلب:* {data.get('applicantName') or 'غير موجود'}",
        f"💼 *الوظيفة:* {data.get('jobTitle') or 'غير موجود'}",
        f"🏢 *جهة العمل:* {data.get('workplace') or 'غير موجود'}",
        "",
        "📄 *النص الكامل للمستند:*",
        (data.get('details') or "—")[:5000],
        "",
        "💬 *رد الجهة الموجود على المستند:*",
        (data.get('officialReplyText') or "❌ لا يوجد رد ظاهر/مقروء على المستند"),
        "",
        f"🎯 *ثقة الاستخراج:* {data.get('confidence', 0)}%",
        f"📄 *الصفحات المحللة:* {data.get('pagesAnalyzed', 1)}",
        f"🧠 *النموذج:* {data.get('aiModel', '—')}",
        "",
        "راجع البيانات قبل الاعتماد. لن يتم إنشاء الطلب قبل موافقتك.",
    ])


def _reply_exists(r: dict) -> bool:
    for key in ("reply", "response"):
        if _norm(r.get(key)):
            return True
    for key in ("repliesList", "replies", "replyHistory"):
        value = r.get(key)
        if isinstance(value, list) and len(value) > 0:
            return True
    return False


def _reply_count(r: dict) -> int:
    counts = []
    for key in ("repliesList", "replies", "replyHistory"):
        value = r.get(key)
        if isinstance(value, list):
            counts.append(len(value))
    return max(counts, default=1 if _reply_exists(r) else 0)


def _enhanced_request_text(r: dict) -> str:
    text = legacy_bot.format_request(r)
    text += "\n"
    if _reply_exists(r):
        text += f"💬 *الرد:* ✅ يوجد رد ({_reply_count(r)})\n"
    else:
        text += "💬 *الرد:* ❌ لا يوجد رد\n"
    actions = r.get("actions")
    if isinstance(actions, list) and actions:
        text += f"🆕 *الإجراءات:* {len(actions)} إجراء\n"
        last = r.get("lastAction")
        if isinstance(last, dict):
            text += f"   {STATUS_LABELS.get(last.get('status'), last.get('status', ''))}\n"
            if last.get("details"):
                text += f"   {str(last['details'])[:250]}\n"
    elif isinstance(r.get("lastAction"), dict) and r.get("lastAction"):
        last = r["lastAction"]
        text += f"🆕 *آخر إجراء:* {STATUS_LABELS.get(last.get('status'), last.get('status', ''))}\n"
    return text


def _request_management_keyboard(fire_key: str, req_id: str):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("💬 الرد", callback_data=f"req_reply:{fire_key}"),
         InlineKeyboardButton("🆕 إجراء جديد", callback_data=f"req_action:{fire_key}")],
        [InlineKeyboardButton("📋 عرض الطلب", callback_data=f"view_req_plus:{fire_key}"),
         InlineKeyboardButton("📁 الملفات", callback_data=f"view_files:{req_id}:{fire_key}")],
        [InlineKeyboardButton("📤 رفع ملف", callback_data=f"upload_for:{req_id}:{fire_key}"),
         InlineKeyboardButton("🔙 القائمة", callback_data="back_main")],
    ])


def _duplicate_text(r: dict) -> str:
    return (
        "⚠️ *هذا الطلب موجود بالفعل*\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "تم العثور على تطابق كامل مع طلب محفوظ مسبقاً.\n"
        "👇 الطلب الموجود كما هو:\n\n"
        + _enhanced_request_text(r)
        + "\n⚠️ لم يتم إنشاء طلب جديد ولم يتم تعديل الطلب الموجود."
    )


# ---------------------------------------------------------------------------
# Batch/album processing for NEW requests.
# ---------------------------------------------------------------------------
_album_buffers = {}
_album_tasks = {}


def _batch_review_text(items):
    chunks = [
        "🤖 *تم تحليل المستندات*",
        "━━━━━━━━━━━━━━━━━━━━",
        f"📦 عدد الطلبات: *${len(items)}*",
        "",
    ]
    for idx, item in enumerate(items, 1):
        data = item["data"]
        chunks.extend([
            f"*📄 الطلب ${idx}*",
            f"📝 العنوان: {data.get('title') or '—'}",
            f"📅 التاريخ: {data.get('reqDate') or 'غير موجود'}",
            f"📌 النوع: {_type_label(data.get('requestType'))}",
            f"🏛 الجهة: {data.get('authority') or '—'}",
            f"👤 مقدم الطلب: {data.get('applicantName') or 'غير موجود'}",
            f"💬 الرد: {data.get('officialReplyText') or 'لا يوجد رد ظاهر/مقروء'}",
            "",
        ])
    chunks.append("راجع الطلبات قبل الاعتماد. لن يتم إنشاء أي طلب قبل موافقتك.")
    return "\n".join(chunks)


def _batch_review_keyboard(count):
    rows = []
    for idx in range(count):
        n = idx + 1
        rows.append([
            InlineKeyboardButton(f"✏️ تعديل نوع ${n}", callback_data=f"ai_edit:${idx}:type"),
            InlineKeyboardButton(f"✏️ تعديل عنوان ${n}", callback_data=f"ai_edit:${idx}:title"),
        ])
        rows.append([
            InlineKeyboardButton(f"✏️ تعديل جهة ${n}", callback_data=f"ai_edit:${idx}:authority"),
            InlineKeyboardButton(f"💬 تعديل رد ${n}", callback_data=f"ai_edit:${idx}:reply"),
        ])
    rows.append([
        InlineKeyboardButton("✅ اعتماد وحفظ الكل", callback_data="ai_approve_all"),
        InlineKeyboardButton("❌ إلغاء الكل", callback_data="ai_cancel"),
    ])
    return InlineKeyboardMarkup(rows)


async def _process_media_album(user_id, chat_id, context, album_id):
    await asyncio.sleep(1.5)
    messages = _album_buffers.pop((user_id, album_id), [])
    _album_tasks.pop((user_id, album_id), None)
    if not messages:
        return

    status = await context.bot.send_message(
        chat_id,
        f"🤖 جاري قراءة ${len(messages)} مستندات واستخراج البيانات..."
    )
    items = []
    try:
        for msg in messages:
            if msg.photo:
                tg_file = await context.bot.get_file(msg.photo[-1].file_id)
                file_id = msg.photo[-1].file_id
                filename = f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.jpg"
                mime = "image/jpeg"
                filetype = "photo"
            elif _is_ai_document(msg):
                tg_file = await context.bot.get_file(msg.document.file_id)
                file_id = msg.document.file_id
                filename = msg.document.file_name or f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.jpg"
                mime = msg.document.mime_type or "image/jpeg"
                filetype = "document"
            else:
                continue

            data_bytes = bytes(await tg_file.download_as_bytearray())
            result = await asyncio.to_thread(analyze_document, data_bytes, mime, msg.caption or "")
            items.append({
                "data": result,
                "file_id": file_id,
                "filename": filename,
                "filetype": filetype,
                "mime": mime,
                "caption": msg.caption or "",
            })

        if not items:
            await status.edit_text("❌ لم أجد مستندات قابلة للتحليل في المجموعة.")
            return

        context.user_data["ai_pending_requests"] = items
        context.user_data.pop("ai_pending_request", None)
        await status.edit_text(
            _batch_review_text(items),
            parse_mode="Markdown",
            reply_markup=_batch_review_keyboard(len(items)),
        )
    except Exception as exc:
        await status.edit_text(
            "❌ تعذر تحليل مجموعة المستندات.\n\n"
            f"خطأ: ${str(exc)[:700]}",
        )


# ---------------------------------------------------------------------------
# Media: preserve existing upload flow; AI only for NEW image uploads.
# ---------------------------------------------------------------------------
async def ai_handle_media(update, context):
    user = update.effective_user
    if not legacy_bot.is_authenticated(user.id):
        return
    state = legacy_bot.user_state.get(user.id, {})
    if state.get("step") == "awaiting_file":
        return await _original_handle_media(update, context)

    msg = update.message
    if not (msg.photo or _is_ai_document(msg)):
        return await _original_handle_media(update, context)

    # Telegram albums share media_group_id. Collect the album briefly and
    # process all its documents in one review.
    album_id = getattr(msg, "media_group_id", None)
    if album_id:
        key = (user.id, str(album_id))
        _album_buffers.setdefault(key, []).append(msg)
        if key not in _album_tasks:
            _album_tasks[key] = asyncio.create_task(
                _process_media_album(user.id, msg.chat_id, context, str(album_id))
            )
        return

    status = await msg.reply_text("🤖 جاري قراءة المستند واستخراج البيانات...")
    try:
        if msg.photo:
            tg_file = await context.bot.get_file(msg.photo[-1].file_id)
            file_id = msg.photo[-1].file_id
            filename = f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.jpg"
            mime = "image/jpeg"
            filetype = "photo"
        else:
            tg_file = await context.bot.get_file(msg.document.file_id)
            file_id = msg.document.file_id
            filename = msg.document.file_name or f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.jpg"
            mime = msg.document.mime_type or "image/jpeg"
            filetype = "document"

        if getattr(msg.document, "file_size", None) and msg.document.file_size > 20 * 1024 * 1024:
            await status.edit_text(
                "❌ الملف أكبر من 20MB. Telegram Bot API لا يسمح للبوت بتنزيل ملفات بهذا الحجم."
            )
            return

        data_bytes = bytes(await tg_file.download_as_bytearray())
        result = await asyncio.to_thread(analyze_document, data_bytes, mime, msg.caption or "")
        context.user_data["ai_pending_request"] = {
            "data": result,
            "file_id": file_id,
            "filename": filename,
            "filetype": filetype,
            "mime": mime,
            "caption": msg.caption or "",
        }
        await status.edit_text(_review_text(result), parse_mode="Markdown", reply_markup=_review_keyboard())
    except Exception as exc:
        await status.edit_text(
            "❌ تعذر تحليل المستند.\n\n"
            f"`{str(exc)[:700]}`\n\n"
            "يمكنك استخدام طريقة رفع المستند الحالية كما هي.",
            parse_mode="Markdown",
        )

# ---------------------------------------------------------------------------
# Text: reply/action workflows, then fall back to original bot.py.
# ---------------------------------------------------------------------------
async def ai_text_handler(update, context):
    user = update.effective_user
    text = (update.message.text or "").strip()

    # Manual edits to the NEW AI review form. These edits only change the
    # pending in-memory draft; Firebase is untouched until explicit approval.
    state = legacy_bot.user_state.get(user.id, {})
    if state.get("step") == "ai_edit_field":
        pending = context.user_data.get("ai_pending_request")
        field = state.get("ai_field")
        if not pending or field not in {"type", "title", "authority", "reply"}:
            legacy_bot.user_state.pop(user.id, None)
            await update.message.reply_text("❌ انتهت جلسة تعديل المستند. أرسل المستند مرة أخرى.")
            return
        if not text:
            await update.message.reply_text("✍️ اكتب القيمة الجديدة أولاً.")
            return

        data = dict(pending.get("data") or {})
        if field == "type":
            # Accept the canonical Arabic labels too, while storing the
            # existing internal values used by the legacy system.
            type_aliases = {
                "خاص": "special", "عام": "general",
                "طلب إحاطة": "briefing", "احاطة": "briefing", "إحاطة": "briefing",
                "عاجل": "urgent", "استجواب": "interrogation",
                "special": "special", "general": "general",
                "briefing": "briefing", "urgent": "urgent", "interrogation": "interrogation",
            }
            key = text.strip()
            data["requestType"] = type_aliases.get(key, key)
        elif field == "title":
            data["title"] = text
        elif field == "authority":
            data["authority"] = text
        elif field == "reply":
            if text in {"لا يوجد رد", "لا يوجد", "بدون رد", "لا رد"}:
                data["hasOfficialReply"] = False
                data["officialReplyText"] = None
            else:
                data["hasOfficialReply"] = True
                data["officialReplyText"] = text

        pending["data"] = data
        context.user_data["ai_pending_request"] = pending
        legacy_bot.user_state.pop(user.id, None)

        # Immediately redraw the same review screen with the new value.
        await update.message.reply_text(
            "✅ تم تعديل الحقل.\n\n" + _review_text(data),
            parse_mode="Markdown",
            reply_markup=_review_keyboard(),
        )
        return
    state = legacy_bot.user_state.get(user.id, {})
    step = state.get("step", "")

    if step == "reply_input":
        fire_key = state.get("fire_key")
        req = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), None)
        if not req:
            legacy_bot.user_state.pop(user.id, None)
            await update.message.reply_text("❌ لم يُعثر على الطلب.")
            return
        if not text:
            await update.message.reply_text("✍️ اكتب الرد أولاً.")
            return

        replies = req.get("repliesList")
        if not isinstance(replies, list):
            replies = []
        replies = list(replies)
        replies.append(text)
        history = req.get("replyHistory")
        if not isinstance(history, list):
            history = []
        history = list(history)
        history.append({"text": text, "date": datetime.utcnow().isoformat()})
        ok = legacy_bot.update_request(fire_key, {
            "repliesList": replies,
            "replyHistory": history,
            "lastReplyAt": datetime.utcnow().isoformat(),
        })
        legacy_bot.user_state.pop(user.id, None)
        if ok:
            fresh = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), req)
            await update.message.reply_text(
                "✅ *تم حفظ الرد داخل نفس الطلب*\n\n" + _enhanced_request_text(fresh),
                parse_mode="Markdown",
                reply_markup=_request_management_keyboard(fire_key, str(fresh.get("reqId"))),
            )
        else:
            await update.message.reply_text("❌ تعذر حفظ الرد.")
        return

    if step == "action_details":
        fire_key = state.get("fire_key")
        action_status = state.get("action_status")
        req = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), None)
        if not req:
            legacy_bot.user_state.pop(user.id, None)
            await update.message.reply_text("❌ لم يُعثر على الطلب.")
            return
        if not text:
            await update.message.reply_text("✍️ اكتب تفاصيل الإجراء أولاً.")
            return

        actions = req.get("actions")
        if not isinstance(actions, list):
            actions = []
        actions = list(actions)
        now = datetime.utcnow().isoformat()
        action = {"status": action_status, "details": text, "date": now}
        actions.append(action)
        ok = legacy_bot.update_request(fire_key, {
            "actions": actions,
            "lastAction": action,
            "lastActionAt": now,
            "status": action_status,
        })
        legacy_bot.user_state.pop(user.id, None)
        if ok:
            fresh = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), req)
            await update.message.reply_text(
                "✅ *تم تسجيل الإجراء الجديد*\n\n" + _enhanced_request_text(fresh),
                parse_mode="Markdown",
                reply_markup=_request_management_keyboard(fire_key, str(fresh.get("reqId"))),
            )
        else:
            await update.message.reply_text("❌ تعذر حفظ الإجراء.")
        return

    await _original_text_handler(update, context)

# ---------------------------------------------------------------------------
# Manual edits for the AI review form.
# ---------------------------------------------------------------------------
EDIT_FIELD_LABELS = {
    "type": "نوع الطلب",
    "title": "عنوان الطلب",
    "authority": "الجهة المعنية",
    "reply": "الرد على الطلب",
}

async def _show_ai_review(message, context):
    batch = context.user_data.get("ai_pending_requests")
    if isinstance(batch, list) and batch:
        await message.edit_text(
            _batch_review_text(batch),
            parse_mode="Markdown",
            reply_markup=_batch_review_keyboard(len(batch)),
        )
        return
    pending = context.user_data.get("ai_pending_request")
    if not pending:
        await message.edit_text("❌ لا يوجد مستند بانتظار المراجعة.")
        return
    await message.edit_text(
        _review_text(pending["data"]),
        parse_mode="Markdown",
        reply_markup=_review_keyboard(),
    )



async def _approve_pending_item(item, context):
    """Save one approved new request and link its original Telegram document."""
    result = item["data"]
    candidate = {
        "reqDate": result.get("reqDate") or "",
        "requestType": result.get("requestType") or "special",
        "authority": result.get("authority") or "غير محددة",
        "title": result.get("title") or "طلب رسمي",
        "details": result.get("details") or "",
        "applicantName": result.get("applicantName"),
        "jobTitle": result.get("jobTitle"),
        "workplace": result.get("workplace"),
    }
    duplicate = find_exact_duplicate(candidate)
    if duplicate:
        return {"duplicate": duplicate, "created": False}

    all_reqs = legacy_bot.get_all_requests()
    max_id = max(
        (int(r.get("reqId") or 0) for r in all_reqs if str(r.get("reqId", "")).isdigit()),
        default=0,
    )
    req_data = {
        **candidate,
        "reqId": str(max_id + 1),
        "status": "replied" if result.get("hasOfficialReply") else "execution",
        "hasDocuments": False,
        "aiGenerated": True,
        "aiModel": result.get("aiModel"),
        "aiConfidence": result.get("confidence", 0),
        "hasOfficialReply": bool(result.get("hasOfficialReply")),
        "officialReplyText": result.get("officialReplyText"),
        "requestNumberFromDocument": result.get("requestNumber"),
        "ocrText": result.get("ocrText") or result.get("details") or "",
        "aiRequestedModel": result.get("aiRequestedModel"),
        "aiPagesAnalyzed": result.get("pagesAnalyzed", 1),
        "createdAt": datetime.utcnow().isoformat(),
    }
    fire_key = legacy_bot.add_request(req_data)
    if not fire_key:
        return {"error": "فشل حفظ الطلب في Firebase"}

    channel_msg_id = None
    channel_sent = False
    try:
        cap = f"📋 طلب #${req_data['reqId']}\n📝 ${req_data['title']}\n🏛 ${req_data['authority']}"
        if item.get("caption"):
            cap += f"\n💬 ${item['caption']}"
        if item["filetype"] == "photo":
            sent = await context.bot.send_photo(
                legacy_bot.TELEGRAM_CHANNEL_ID, item["file_id"], caption=cap
            )
        else:
            sent = await context.bot.send_document(
                legacy_bot.TELEGRAM_CHANNEL_ID, item["file_id"], caption=cap
            )
        channel_msg_id = sent.message_id
        channel_sent = True
    except Exception as exc:
        legacy_bot.logger.error(f"AI channel send error: ${exc}")

    file_key = legacy_bot.save_file_to_firebase(
        req_data["reqId"], item["file_id"], item["filename"],
        item["filetype"], item.get("caption", ""), channel_msg_id,
    )
    if file_key:
        legacy_bot.update_request(fire_key, {"hasDocuments": True})

    return {
        "created": True,
        "fire_key": fire_key,
        "req_data": req_data,
        "channel_sent": channel_sent,
        "file_key": file_key,
    }


# ---------------------------------------------------------------------------
# Callback layer.
# ---------------------------------------------------------------------------
async def ai_button_handler(update, context):
    query = update.callback_query
    data = query.data or ""
    user = query.from_user

    if not data.startswith(("ai_", "req_reply:", "req_action:", "action_status:", "view_req_plus:", "dup_open:")):
        return await _original_button_handler(update, context)


    if data == "ai_approve_all":
        batch = context.user_data.get("ai_pending_requests")
        if not isinstance(batch, list) or not batch:
            await query.answer("لا توجد مجموعة بانتظار الاعتماد.", show_alert=True)
            return
        results = []
        for item in batch:
            results.append(await _approve_pending_item(item, context))

        created = [x for x in results if x.get("created")]
        duplicates = [x for x in results if x.get("duplicate")]
        errors = [x for x in results if x.get("error")]
        lines = [
            "✅ *تمت معالجة المجموعة*",
            "━━━━━━━━━━━━━━━━━━━━",
            f"📦 إجمالي المستندات: ${len(batch)}",
            f"✅ تم إنشاء: ${len(created)}",
            f"⚠️ موجود مسبقًا: ${len(duplicates)}",
            f"❌ أخطاء: ${len(errors)}",
        ]
        if created:
            lines.append("🔢 أرقام الطلبات الجديدة: " + ", ".join(
                f"`${x['req_data']['reqId']}`" for x in created
            ))
        if duplicates:
            lines.append("⚠️ لم يتم إنشاء طلب مكرر لأي مستند موجود.")
        context.user_data.pop("ai_pending_requests", None)
        await query.message.edit_text(
            "\n".join(lines),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 القائمة", callback_data="back_main")]
            ]),
        )
        return

    # Manual editing of the pending NEW request. Nothing is written to
    # Firebase until the user presses "اعتماد وحفظ".
    if data.startswith("ai_edit:"):
        pending = context.user_data.get("ai_pending_request")
        if not pending:
            await query.answer("لا يوجد مستند بانتظار المراجعة.", show_alert=True)
            return
        field = data.split(":", 1)[1]
        if field not in EDIT_FIELD_LABELS:
            await query.answer("حقل غير معروف.", show_alert=True)
            return

        if field == "type":
            kbd = InlineKeyboardMarkup([
                [InlineKeyboardButton("🌟 خاص", callback_data="ai_set_type:special"),
                 InlineKeyboardButton("📢 عام", callback_data="ai_set_type:general")],
                [InlineKeyboardButton("📜 طلب إحاطة", callback_data="ai_set_type:briefing")],
                [InlineKeyboardButton("🚨 عاجل", callback_data="ai_set_type:urgent"),
                 InlineKeyboardButton("🎤 استجواب", callback_data="ai_set_type:interrogation")],
                [InlineKeyboardButton("✍️ كتابة النوع يدويًا", callback_data="ai_edit_text:type")],
                [InlineKeyboardButton("🔙 رجوع", callback_data="ai_back_review")],
            ])
            await query.message.edit_text(
                "✏️ *تعديل نوع الطلب*\n\nاختر النوع الصحيح:",
                parse_mode="Markdown",
                reply_markup=kbd,
            )
            return

        legacy_bot.user_state[user.id] = {
            "step": "ai_edit_field",
            "ai_field": field,
        }
        await query.message.edit_text(
            f"✏️ *تعديل {EDIT_FIELD_LABELS[field]}*\n\n"
            "اكتب القيمة الجديدة كما تريد حفظها:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("❌ إلغاء التعديل", callback_data="ai_back_review")]
            ]),
        )
        return

    if data.startswith("ai_edit_text:type"):
        legacy_bot.user_state[user.id] = {
            "step": "ai_edit_field",
            "ai_field": "type",
        }
        await query.message.edit_text(
            "✏️ *تعديل نوع الطلب*\n\nاكتب نوع الطلب كما تريد:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("❌ إلغاء التعديل", callback_data="ai_back_review")]
            ]),
        )
        return

    if data.startswith("ai_set_type:"):
        pending = context.user_data.get("ai_pending_request")
        if not pending:
            await query.message.edit_text("❌ لا يوجد مستند بانتظار المراجعة.")
            return
        value = data.split(":", 1)[1]
        if value not in legacy_bot.TYPE_MAP:
            await query.message.edit_text("❌ نوع الطلب غير صالح.")
            return
        pending["data"]["requestType"] = value
        context.user_data["ai_pending_request"] = pending
        legacy_bot.user_state.pop(user.id, None)
        await _show_ai_review(query.message, context)
        return

    if data == "ai_back_review":
        legacy_bot.user_state.pop(user.id, None)
        await _show_ai_review(query.message, context)
        return

    await query.answer()
    if not legacy_bot.is_authenticated(user.id):
        await query.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return

    if data.startswith("view_req_plus:") or data.startswith("dup_open:"):
        fire_key = data.split(":", 1)[1]
        req = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), None)
        if not req:
            await query.message.edit_text("❌ لم يُعثر على الطلب.")
            return
        await query.message.edit_text(
            _enhanced_request_text(req),
            parse_mode="Markdown",
            reply_markup=_request_management_keyboard(fire_key, str(req.get("reqId"))),
        )
        return

    if data.startswith("req_reply:"):
        fire_key = data.split(":", 1)[1]
        req = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), None)
        if not req:
            await query.message.edit_text("❌ لم يُعثر على الطلب.")
            return
        legacy_bot.user_state[user.id] = {"step": "reply_input", "fire_key": fire_key}
        await query.message.edit_text(
            f"💬 *الرد على الطلب #{req.get('reqId')}*\n\n"
            "أرسل نص الرد الذي تريد حفظه داخل نفس الطلب:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("❌ إلغاء", callback_data="back_main")]]),
        )
        return

    if data.startswith("req_action:"):
        fire_key = data.split(":", 1)[1]
        req = next((r for r in legacy_bot.get_all_requests() if r.get("firebaseKey") == fire_key), None)
        if not req:
            await query.message.edit_text("❌ لم يُعثر على الطلب.")
            return
        kbd = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔵 جاري التنفيذ", callback_data=f"action_status:{fire_key}:execution")],
            [InlineKeyboardButton("✅ تم التنفيذ", callback_data=f"action_status:{fire_key}:executed")],
            [InlineKeyboardButton("🟢 مكتمل", callback_data=f"action_status:{fire_key}:completed")],
            [InlineKeyboardButton("🟡 قيد المتابعة", callback_data=f"action_status:{fire_key}:follow_up")],
            [InlineKeyboardButton("🔍 قيد المراجعة", callback_data=f"action_status:{fire_key}:review")],
            [InlineKeyboardButton("✉️ تم الرد", callback_data=f"action_status:{fire_key}:replied")],
            [InlineKeyboardButton("🔴 متوقف", callback_data=f"action_status:{fire_key}:stopped")],
            [InlineKeyboardButton("❌ مرفوض", callback_data=f"action_status:{fire_key}:rejected")],
            [InlineKeyboardButton("❌ إلغاء", callback_data=f"view_req_plus:{fire_key}")],
        ])
        await query.message.edit_text(
            f"🆕 *إجراء جديد للطلب #{req.get('reqId')}*\n\nاختر حالة الإجراء:",
            parse_mode="Markdown",
            reply_markup=kbd,
        )
        return

    if data.startswith("action_status:"):
        _, fire_key, status = data.split(":", 2)
        legacy_bot.user_state[user.id] = {
            "step": "action_details",
            "fire_key": fire_key,
            "action_status": status,
        }
        await query.message.edit_text(
            f"🆕 *حالة الإجراء:* {STATUS_LABELS.get(status, status)}\n\n"
            "✍️ اكتب تفاصيل الإجراء الجديد:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("❌ إلغاء", callback_data=f"view_req_plus:{fire_key}")]]),
        )
        return

    # AI workflow
    pending = context.user_data.get("ai_pending_request")
    if not pending:
        await query.message.edit_text("❌ لا يوجد مستند AI بانتظار المراجعة.")
        return

    if data == "ai_cancel":
        context.user_data.pop("ai_pending_request", None)
        await query.message.edit_text("❌ تم الإلغاء ولم يتم إنشاء أي طلب.")
        return

    if data == "ai_retry":
        try:
            await query.message.edit_text("🔄 جاري إعادة تحليل المستند...")
            tg_file = await context.bot.get_file(pending["file_id"])
            image_bytes = bytes(await tg_file.download_as_bytearray())
            result = await asyncio.to_thread(
                analyze_document,
                image_bytes,
                pending.get("mime", "image/jpeg"),
                pending.get("caption", ""),
            )
            pending["data"] = result
            context.user_data["ai_pending_request"] = pending
            await query.message.edit_text(_review_text(result), parse_mode="Markdown", reply_markup=_review_keyboard())
        except Exception as exc:
            await query.message.edit_text(
                f"❌ فشل إعادة التحليل: `{str(exc)[:600]}`",
                parse_mode="Markdown", reply_markup=_review_keyboard(),
            )
        return

    if data == "ai_approve":
        result = pending["data"]
        candidate = {
            "reqDate": result.get("reqDate") or "",
            "requestType": result.get("requestType") or "special",
            "authority": result.get("authority") or "غير محددة",
            "title": result.get("title") or "طلب رسمي",
            "details": result.get("details") or "",
            "applicantName": result.get("applicantName"),
            "jobTitle": result.get("jobTitle"),
            "workplace": result.get("workplace"),
        }

        duplicate = find_exact_duplicate(candidate)
        if duplicate:
            context.user_data.pop("ai_pending_request", None)
            await query.message.edit_text(
                _duplicate_text(duplicate),
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("📋 عرض الطلب", callback_data=f"view_req_plus:{duplicate['firebaseKey']}")],
                    [InlineKeyboardButton("💬 الرد", callback_data=f"req_reply:{duplicate['firebaseKey']}"),
                     InlineKeyboardButton("🆕 إجراء جديد", callback_data=f"req_action:{duplicate['firebaseKey']}")],
                    [InlineKeyboardButton("🔙 القائمة", callback_data="back_main")],
                ]),
            )
            return

        all_reqs = legacy_bot.get_all_requests()
        max_id = max((int(r.get("reqId") or 0) for r in all_reqs if str(r.get("reqId", "")).isdigit()), default=0)
        req_data = {
            **candidate,
            "reqId": str(max_id + 1),
            "status": "replied" if result.get("hasOfficialReply") else "execution",
            "hasDocuments": False,
            "aiGenerated": True,
            "aiModel": result.get("aiModel"),
            "aiConfidence": result.get("confidence", 0),
            "hasOfficialReply": bool(result.get("hasOfficialReply")),
            "officialReplyText": result.get("officialReplyText"),
            "requestNumberFromDocument": result.get("requestNumber"),
            "ocrText": result.get("ocrText") or result.get("details") or "",
            "aiRequestedModel": result.get("aiRequestedModel"),
            "aiPagesAnalyzed": result.get("pagesAnalyzed", 1),
            "createdAt": datetime.utcnow().isoformat(),
        }

        fire_key = legacy_bot.add_request(req_data)
        if not fire_key:
            await query.message.edit_text("❌ فشل حفظ الطلب في Firebase. لم يتم نشر المستند.")
            return

        channel_msg_id = None
        channel_sent = False
        try:
            cap = f"📋 طلب #{req_data['reqId']}\n📝 {req_data['title']}\n🏛 {req_data['authority']}"
            if pending.get("caption"):
                cap += f"\n💬 {pending['caption']}"
            if pending["filetype"] == "photo":
                sent = await context.bot.send_photo(legacy_bot.TELEGRAM_CHANNEL_ID, pending["file_id"], caption=cap)
            else:
                sent = await context.bot.send_document(legacy_bot.TELEGRAM_CHANNEL_ID, pending["file_id"], caption=cap)
            channel_msg_id = sent.message_id
            channel_sent = True
        except Exception as exc:
            legacy_bot.logger.error(f"AI channel send error: {exc}")

        file_key = legacy_bot.save_file_to_firebase(
            req_data["reqId"], pending["file_id"], pending["filename"],
            pending["filetype"], pending.get("caption", ""), channel_msg_id,
        )
        if file_key:
            legacy_bot.update_request(fire_key, {"hasDocuments": True})

        context.user_data.pop("ai_pending_request", None)
        await query.message.edit_text(
            "✅ *تم اعتماد الطلب وإنشاؤه بنجاح*\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            f"🔢 رقم الطلب: `{req_data['reqId']}`\n"
            f"📝 {req_data['title']}\n"
            f"📌 النوع: {_type_label(req_data['requestType'])}\n"
            f"🏛 الجهة: {req_data['authority']}\n"
            f"🎯 ثقة AI: {req_data['aiConfidence']}%\n"
            f"📢 القناة: {'✅ تم النشر' if channel_sent else '⚠️ لم يتم النشر'}\n"
            f"💾 المستند: {'✅ محفوظ' if file_key else '⚠️ تعذر حفظ بيانات الملف'}",
            parse_mode="Markdown",
            reply_markup=_request_management_keyboard(fire_key, req_data["reqId"]),
        )
        return


# Install wrappers only; bot.py itself remains untouched.
legacy_bot.handle_media = ai_handle_media
legacy_bot.handle_text_input = ai_text_handler
legacy_bot.button_handler = ai_button_handler

if __name__ == "__main__":
    legacy_bot.main()
