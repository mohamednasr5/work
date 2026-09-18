# -*- coding: utf-8 -*-
"""Compatibility launcher.

The original bot.py remains untouched. This launcher wraps only:
1) handle_media -> adds AI analysis for NEW images only.
2) button_handler -> adds AI review/approve/cancel actions.

Existing uploads to an existing request continue through the original
handle_media unchanged.
"""

import asyncio
from datetime import datetime
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

import bot as legacy_bot
from ai_document_processor import analyze_image

_original_handle_media = legacy_bot.handle_media
_original_button_handler = legacy_bot.button_handler

def _is_image_document(msg):
    if not msg.document:
        return False
    mime = (msg.document.mime_type or "").lower()
    name = (msg.document.file_name or "").lower()
    return mime.startswith("image/") or name.endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp"))

def _review_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ اعتماد وحفظ", callback_data="ai_approve"),
            InlineKeyboardButton("❌ إلغاء", callback_data="ai_cancel"),
        ],
        [InlineKeyboardButton("🔄 إعادة التحليل", callback_data="ai_retry")],
    ])

def _type_label(value):
    return legacy_bot.TYPE_MAP.get(value, value or "—")

def _review_text(data):
    lines = [
        "🤖 *تم تحليل المستند بالذكاء الاصطناعي*",
        "━━━━━━━━━━━━━━━━━━━━",
        f"📝 *العنوان:* {data.get('title') or '—'}",
        f"📅 *التاريخ:* {data.get('reqDate') or 'غير موجود'}",
        f"📌 *النوع:* {_type_label(data.get('requestType'))}",
        f"🏛 *الجهة:* {data.get('authority') or '—'}",
    ]
    if data.get("applicantName"):
        lines.append(f"👤 *مقدم الطلب:* {data['applicantName']}")
    if data.get("jobTitle"):
        lines.append(f"💼 *الوظيفة:* {data['jobTitle']}")
    if data.get("workplace"):
        lines.append(f"🏢 *جهة العمل:* {data['workplace']}")
    lines += [
        "",
        "📄 *التفاصيل:*",
        (data.get("details") or "—")[:1800],
        "",
        "💬 *الرد المقترح:*",
        (data.get("suggestedReply") or "لا يوجد اقتراح")[:1200],
        "",
        f"🎯 *ثقة التحليل:* {data.get('confidence', 0)}%",
        f"🧠 *النموذج:* {data.get('aiModel', '—')}",
        "",
        "راجع البيانات قبل الاعتماد. الذكاء الاصطناعي لا يملك صلاحية نشر الطلب تلقائيًا."
    ]
    return "\n".join(lines)

async def ai_handle_media(update, context):
    user = update.effective_user
    if not legacy_bot.is_authenticated(user.id):
        return

    state = legacy_bot.user_state.get(user.id, {})

    # CRITICAL SAFETY: preserve the existing upload flow exactly.
    if state.get("step") == "awaiting_file":
        return await _original_handle_media(update, context)

    msg = update.message
    if not (msg.photo or _is_image_document(msg)):
        return await _original_handle_media(update, context)

    status = await msg.reply_text("🤖 جاري قراءة المستند واستخراج البيانات...")

    try:
        if msg.photo:
            tg_file = await context.bot.get_file(msg.photo[-1].file_id)
            file_id = msg.photo[-1].file_id
            filename = f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.jpg"
            mime = "image/jpeg"
        else:
            tg_file = await context.bot.get_file(msg.document.file_id)
            file_id = msg.document.file_id
            filename = msg.document.file_name or f"ai_request_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.jpg"
            mime = msg.document.mime_type or "image/jpeg"

        data_bytes = bytes(await tg_file.download_as_bytearray())
        hint = msg.caption or ""

        result = await asyncio.to_thread(analyze_image, data_bytes, mime, hint)

        # Store only in the user's temporary session until explicit approval.
        context.user_data["ai_pending_request"] = {
            "data": result,
            "file_id": file_id,
            "filename": filename,
            "filetype": "photo" if msg.photo else "document",
            "caption": msg.caption or "",
        }

        await status.edit_text(
            _review_text(result),
            parse_mode="Markdown",
            reply_markup=_review_keyboard(),
        )

    except Exception as exc:
        await status.edit_text(
            "❌ تعذر تحليل المستند.\n\n"
            f"`{str(exc)[:700]}`\n\n"
            "يمكنك استخدام طريقة رفع المستند الحالية كما هي.",
            parse_mode="Markdown",
        )

async def ai_button_handler(update, context):
    query = update.callback_query
    data = query.data

    if not data.startswith("ai_"):
        return await _original_button_handler(update, context)

    await query.answer()
    user = query.from_user

    if not legacy_bot.is_authenticated(user.id):
        await query.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return

    pending = context.user_data.get("ai_pending_request")
    if not pending:
        await query.message.edit_text("❌ لا يوجد مستند AI بانتظار المراجعة.")
        return

    if data == "ai_cancel":
        context.user_data.pop("ai_pending_request", None)
        await query.message.edit_text("❌ تم إلغاء التحليل ولم يتم إنشاء أي طلب.")
        return

    if data == "ai_retry":
        # The same image is analyzed again, without touching Firebase or existing requests.
        try:
            await query.message.edit_text("🔄 جاري إعادة تحليل المستند...")
            tg_file = await context.bot.get_file(pending["file_id"])
            image_bytes = bytes(await tg_file.download_as_bytearray())
            result = await asyncio.to_thread(
                analyze_image,
                image_bytes,
                "image/jpeg" if pending["filetype"] == "photo" else "image/jpeg",
                pending.get("caption", ""),
            )
            pending["data"] = result
            context.user_data["ai_pending_request"] = pending
            await query.message.edit_text(
                _review_text(result),
                parse_mode="Markdown",
                reply_markup=_review_keyboard(),
            )
        except Exception as exc:
            await query.message.edit_text(
                f"❌ فشل إعادة التحليل: `{str(exc)[:600]}`",
                parse_mode="Markdown",
                reply_markup=_review_keyboard(),
            )
        return

    if data == "ai_approve":
        result = pending["data"]

        # Generate the next request number exactly like the existing manual flow.
        all_reqs = legacy_bot.get_all_requests()
        max_id = max(
            (int(r.get("reqId") or 0) for r in all_reqs),
            default=0,
        )

        req_data = {
            "reqId": str(max_id + 1),
            "reqDate": result.get("reqDate") or datetime.utcnow().strftime("%Y-%m-%d"),
            "requestType": result.get("requestType") or "special",
            "status": "execution",
            "authority": result.get("authority") or "غير محددة",
            "title": result.get("title") or "طلب رسمي",
            "details": result.get("details") or "",
            "hasDocuments": False,
            "aiGenerated": True,
            "aiModel": result.get("aiModel"),
            "aiConfidence": result.get("confidence", 0),
            "aiSuggestedReply": result.get("suggestedReply") or "",
            "applicantName": result.get("applicantName"),
            "jobTitle": result.get("jobTitle"),
            "workplace": result.get("workplace"),
        }

        fire_key = legacy_bot.add_request(req_data)
        if not fire_key:
            await query.message.edit_text("❌ فشل حفظ الطلب في Firebase. لم يتم نشر المستند.")
            return

        # Publish the original uploaded file only AFTER the request is explicitly approved.
        channel_msg_id = None
        channel_sent = False
        try:
            ch_cap = (
                f"📋 طلب #{req_data['reqId']}\n"
                f"📝 {req_data['title']}\n"
                f"🏛 {req_data['authority']}"
            )
            if pending.get("caption"):
                ch_cap += f"\n💬 {pending['caption']}"

            if pending["filetype"] == "photo":
                sent = await context.bot.send_photo(
                    legacy_bot.TELEGRAM_CHANNEL_ID,
                    pending["file_id"],
                    caption=ch_cap,
                )
            else:
                sent = await context.bot.send_document(
                    legacy_bot.TELEGRAM_CHANNEL_ID,
                    pending["file_id"],
                    caption=ch_cap,
                )

            channel_msg_id = sent.message_id
            channel_sent = True
        except Exception as exc:
            legacy_bot.logger.error(f"AI channel send error: {exc}")

        file_key = legacy_bot.save_file_to_firebase(
            req_data["reqId"],
            pending["file_id"],
            pending["filename"],
            pending["filetype"],
            pending.get("caption", ""),
            channel_msg_id,
        )

        if file_key:
            legacy_bot.update_request(fire_key, {"hasDocuments": True})

        context.user_data.pop("ai_pending_request", None)

        channel_text = "✅ تم النشر" if channel_sent else "⚠️ لم يتم النشر"
        await query.message.edit_text(
            "✅ *تم اعتماد الطلب وإنشاؤه بنجاح*\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            f"🔢 رقم الطلب: `{req_data['reqId']}`\n"
            f"📝 {req_data['title']}\n"
            f"📌 النوع: {_type_label(req_data['requestType'])}\n"
            f"🏛 الجهة: {req_data['authority']}\n"
            f"🎯 ثقة AI: {req_data['aiConfidence']}%\n"
            f"📢 القناة: {channel_text}\n"
            f"💾 المستند: {'✅ محفوظ' if file_key else '⚠️ تعذر حفظ بيانات الملف'}",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    "📋 فتح الطلب",
                    callback_data=f"view_req:{fire_key}"
                ),
                InlineKeyboardButton("🔙 القائمة", callback_data="back_main"),
            ]]),
        )

# Patch only the two entry points used by bot.main().
legacy_bot.handle_media = ai_handle_media
legacy_bot.button_handler = ai_button_handler

if __name__ == "__main__":
    legacy_bot.main()
