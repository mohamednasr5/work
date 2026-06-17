"""
بوت تليجرام احترافي - إدارة الطلبات البرلمانية مع حفظ فوري على القناة
نسخة محسّنة: حفظ تلقائي على القناة بعد أي رفع ملف
"""

import os
import json
import logging
import sys
import time
from datetime import datetime
from threading import Thread
import http.server
import socketserver

import firebase_admin
from firebase_admin import credentials, db, storage

from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup, BotCommand, InputFile
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    ConversationHandler, CallbackQueryHandler
)
from telegram.constants import ParseMode

# -----------------------------------------
# Logging
# -----------------------------------------
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ParliamentBot")

# -----------------------------------------
# متغيرات البيئة
# -----------------------------------------
BOT_TOKEN      = os.environ["BOT_TOKEN"]
PASSWORD       = os.getenv("BOT_PASSWORD", "521988")
FIREBASE_URL   = os.environ["FIREBASE_URL"]
FIREBASE_JSON  = os.environ["FIREBASE_CREDENTIALS_JSON"]
FIREBASE_PATH  = os.getenv("FIREBASE_PATH", "parliament-requests")
ARCHIVE_PATH   = "archive"  # مسار قسم المستندات
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "")
CHANNEL_ID     = os.getenv("CHANNEL_ID", "-1003882612870")

# -----------------------------------------
# حالات المحادثة
# -----------------------------------------
(
    WAIT_PASSWORD, MAIN_MENU, SEARCH_QUERY,
    EDIT_VALUE, ADD_TITLE, ADD_TYPE, ADD_AUTH, ADD_DETAILS, ADD_CONFIRM,
    UPLOAD_WAIT, VIEW_ARCHIVE_DOCS, UPLOAD_REQ_ID, UPLOAD_FILE,
) = range(13)

# -----------------------------------------
# Firebase
# -----------------------------------------
def init_firebase() -> None:
    if firebase_admin._apps:
        return
    try:
        cred_data = json.loads(FIREBASE_JSON)
        cred = credentials.Certificate(cred_data)
        opts = {"databaseURL": FIREBASE_URL}
        if STORAGE_BUCKET:
            opts["storageBucket"] = STORAGE_BUCKET
        firebase_admin.initialize_app(cred, opts)
        logger.info("✅ Firebase initialized")
    except Exception as e:
        logger.critical(f"❌ Firebase init failed: {e}")
        raise


def get_all() -> list:
    try:
        data = db.reference(FIREBASE_PATH).get()
        if not data:
            logger.warning(f"⚠️ No data at: '{FIREBASE_PATH}'")
            return []
        if isinstance(data, dict):
            return [{"firebaseKey": k, **v} for k, v in data.items() if isinstance(v, dict)]
        return []
    except Exception as e:
        logger.error(f"get_all error: {e}")
        return []


def get_req(key: str):
    try:
        return db.reference(f"{FIREBASE_PATH}/{key}").get()
    except Exception as e:
        logger.error(f"get_req error: {e}")
        return None


def update_req(key: str, field: str, value) -> bool:
    try:
        db.reference(f"{FIREBASE_PATH}/{key}").update({field: value})
        return True
    except Exception as e:
        logger.error(f"update_req error: {e}")
        return False


def delete_req(key: str) -> bool:
    try:
        db.reference(f"{FIREBASE_PATH}/{key}").delete()
        return True
    except Exception as e:
        logger.error(f"delete_req error: {e}")
        return False


def add_req(data: dict) -> bool:
    try:
        db.reference(FIREBASE_PATH).push(data)
        return True
    except Exception as e:
        logger.error(f"add_req error: {e}")
        return False


def add_document_to_req(key: str, doc_info: dict) -> bool:
    """إضافة مستند لقائمة مستندات الطلب"""
    try:
        ref  = db.reference(f"{FIREBASE_PATH}/{key}")
        data = ref.get() or {}
        docs = data.get("documents", [])
        if not isinstance(docs, list):
            docs = list(docs.values()) if isinstance(docs, dict) else []
        docs.append(doc_info)
        ref.update({"documents": docs, "hasDocuments": True})
        return True
    except Exception as e:
        logger.error(f"add_document error: {e}")
        return False


def add_document_to_archive(req_id: str, doc_info: dict) -> bool:
    """إضافة مستند لقسم archive بناءً على رقم الطلب"""
    try:
        req_index = int(req_id)
        archive_ref = db.reference(ARCHIVE_PATH)
        
        # جلب البيانات الحالية
        archive_data = archive_ref.get() or []
        if isinstance(archive_data, dict):
            archive_data = list(archive_data.values())
        
        # التأكد من أن القائمة كبيرة بما يكفي
        while len(archive_data) <= req_index:
            archive_data.append(None)
        
        # إنشاء مفتاح فريد للمستند
        doc_key = archive_ref.child(str(req_index)).push().key
        
        # إضافة المستند
        if archive_data[req_index] is None:
            archive_data[req_index] = {}
        
        archive_data[req_index][doc_key] = doc_info
        
        # حفظ البيانات
        archive_ref.set(archive_data)
        logger.info(f"✅ تم حفظ المستند في archive للطلب {req_id}")
        return True
    except Exception as e:
        logger.error(f"add_document_to_archive error: {e}")
        return False


def get_archive_docs(req_id: str) -> list:
    """جلب جميع المستندات المرتبطة برقم طلب معين"""
    try:
        archive_data = db.reference(ARCHIVE_PATH).get()
        if not archive_data:
            logger.warning(f"⚠️ No archive data found")
            return []
        
        if isinstance(archive_data, list):
            archive_list = archive_data
        else:
            archive_list = list(archive_data.values()) if isinstance(archive_data, dict) else []
        
        try:
            req_index = int(req_id)
        except (ValueError, TypeError):
            logger.error(f"Invalid req_id: {req_id}")
            return []
        
        if req_index < 0 or req_index >= len(archive_list):
            logger.warning(f"req_index {req_index} out of range (max: {len(archive_list)-1})")
            return []
        
        req_docs = archive_list[req_index]
        
        if req_docs is None:
            return []
        
        if not isinstance(req_docs, dict):
            logger.warning(f"req_docs at index {req_index} is not a dict")
            return []
        
        docs = []
        for doc_key, doc_info in req_docs.items():
            if isinstance(doc_info, dict):
                docs.append({"doc_key": doc_key, **doc_info})
        
        logger.info(f"✅ Found {len(docs)} documents for req_id {req_id}")
        return docs
    except Exception as e:
        logger.error(f"get_archive_docs error: {e}")
        return []


# -----------------------------------------
# ثوابت العرض
# -----------------------------------------
MONTHS_AR = [
    "يناير","فبراير","مارس","أبريل","مايو","يونيو",
    "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"
]

STATUS = {
    "execution": "⏳ قيد التنفيذ",
    "completed": "✅ مكتمل",
    "replied":   "📩 تم الرد",
    "rejected":  "❌ مرفوض",
}

REQ_TYPE = {
    "complaint":     "🚨 شكوى",
    "suggestion":    "💡 اقتراح",
    "request":       "📋 طلب معلومات",
    "intervention":  "🆘 تدخل",
    "other":         "📌 أخرى",
}

FILE_TYPE_ICONS = {
    "document": "📄",
    "photo":    "🖼️",
    "video":    "🎬",
    "audio":    "🎵",
}


def fmt_date(date_str: str) -> str:
    """تنسيق التاريخ للعرض"""
    if not date_str:
        return "—"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{dt.day} {MONTHS_AR[dt.month - 1]} {dt.year}"
    except:
        return date_str


def fmt_req(req: dict, short: bool = False) -> str:
    """تنسيق بيانات الطلب"""
    req_id = req.get("reqId", "—")
    title = req.get("title", "—")
    auth = req.get("authority", "—")
    status = STATUS.get(req.get("status", "execution"), "—")
    req_type = REQ_TYPE.get(req.get("requestType", "other"), "—")
    req_date = fmt_date(req.get("reqDate", ""))
    
    if short:
        has_docs = "📎" if req.get("hasDocuments") else "—"
        return f"#{req_id} | {title} | {status} {has_docs}"
    
    text = f"📋 *الطلب رقم {req_id}*\n"
    text += f"{'-' * 40}\n"
    text += f"📝 *العنوان:* {title}\n"
    text += f"🏛️ *الجهة:* {auth}\n"
    text += f"🗂️ *النوع:* {req_type}\n"
    text += f"📊 *الحالة:* {status}\n"
    text += f"📅 *التاريخ:* {req_date}\n"
    
    details = req.get("details")
    if details:
        text += f"📄 *التفاصيل:* {details[:200]}\n"
    
    has_docs = req.get("hasDocuments")
    if has_docs:
        doc_count = len(req.get("documents", []))
        text += f"📎 *المستندات:* {doc_count}\n"
    
    text += f"{'-' * 40}\n"
    return text


def main_kb():
    """لوحة المفاتيح الرئيسية"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("➕ إضافة طلب",    callback_data="cmd|add"),
         InlineKeyboardButton("📂 عرض الطلبات",  callback_data="cmd|list")],
        [InlineKeyboardButton("🔍 بحث",           callback_data="cmd|search"),
         InlineKeyboardButton("📊 إحصائيات",     callback_data="cmd|stats")],
        [InlineKeyboardButton("📤 رفع ملف",      callback_data="cmd|upload"),
         InlineKeyboardButton("❓ المساعدة",     callback_data="cmd|help")],
    ])


def req_kb(key: str):
    """لوحة مفاتيح الطلب"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✏️ تعديل",        callback_data=f"edit:{key}"),
         InlineKeyboardButton("📎 المستندات",   callback_data=f"view_archive:{key}")],
        [InlineKeyboardButton("📢 رفع على القناة", callback_data=f"send_to_channel:{key}"),
         InlineKeyboardButton("🗑️ حذف",         callback_data=f"delete:{key}")],
        [InlineKeyboardButton("🏠 القائمة",      callback_data="home")],
    ])


def type_kb(prefix: str):
    """لوحة مفاتيح اختيار نوع الطلب"""
    buttons = []
    for key, label in REQ_TYPE.items():
        buttons.append([InlineKeyboardButton(label, callback_data=f"{prefix}{key}")])
    buttons.append([InlineKeyboardButton("❌ إلغاء", callback_data="home")])
    return InlineKeyboardMarkup(buttons)


# -----------------------------------------
# دوال مساعدة
# -----------------------------------------
def check_auth(ctx, user_id) -> bool:
    """التحقق من المصادقة"""
    return user_id in ctx.bot_data.get("authorized_users", [])


async def send(update, text: str, markup=None, edit: bool = False):
    """إرسال/تحرير رسالة"""
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(
            text=text,
            reply_markup=markup,
            parse_mode=ParseMode.MARKDOWN
        )
    elif update.message:
        await update.message.reply_text(
            text=text,
            reply_markup=markup,
            parse_mode=ParseMode.MARKDOWN
        )


# -----------------------------------------
# أوامر البوت
# -----------------------------------------
async def cmd_start(update, ctx) -> int:
    """أمر البدء"""
    user_id = update.effective_user.id
    if not ctx.bot_data.get("authorized_users"):
        ctx.bot_data["authorized_users"] = []
    
    if user_id in ctx.bot_data["authorized_users"]:
        await send(update, "🏠 *القائمة الرئيسية*", main_kb())
        return MAIN_MENU
    
    await update.message.reply_text("🔐 أرسل كلمة المرور:")
    return WAIT_PASSWORD


async def check_password(update, ctx) -> int:
    """التحقق من كلمة المرور"""
    if update.message.text.strip() == PASSWORD:
        user_id = update.effective_user.id
        if user_id not in ctx.bot_data.get("authorized_users", []):
            ctx.bot_data.setdefault("authorized_users", []).append(user_id)
        await update.message.reply_text("✅ تم التحقق بنجاح!", reply_markup=main_kb())
        return MAIN_MENU
    else:
        await update.message.reply_text("❌ كلمة مرور خاطئة، حاول مرة أخرى:")
        return WAIT_PASSWORD


async def cmd_logout(update, ctx) -> int:
    """تسجيل الخروج"""
    user_id = update.effective_user.id
    if user_id in ctx.bot_data.get("authorized_users", []):
        ctx.bot_data["authorized_users"].remove(user_id)
    await update.message.reply_text("👋 تم تسجيل الخروج.")
    await cmd_start(update, ctx)
    return WAIT_PASSWORD


async def cmd_help(update, ctx) -> int:
    """المساعدة"""
    help_text = """
📖 *المساعدة - El Ashry Pro Bot*

🔹 *الأوامر الرئيسية:*
• `/start` - القائمة الرئيسية
• `/upload` - رفع ملف لطلب
• `/stats` - عرض الإحصائيات
• `/logout` - تسجيل الخروج

🔹 *الميزات:*
✅ إضافة طلبات جديدة
✅ البحث عن الطلبات
✅ رفع مستندات وملفات
✅ حفظ تلقائي على القناة
✅ عرض المستندات والإحصائيات

🔹 *ملاحظات:*
• يتم حفظ جميع الملفات تلقائياً على القناة
• يمكنك تعديل حالة الطلب من أي وقت
• البحث يعمل على العنوان والجهة والتفاصيل

لأي استفسار، تواصل مع الدعم.
    """
    if update.message:
        await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)
    else:
        await send(update, help_text, main_kb(), edit=True)
    return MAIN_MENU


async def cmd_stats(update, ctx) -> int:
    """الإحصائيات"""
    reqs = get_all()
    if not reqs:
        await send(update, "📊 لا توجد طلبات", main_kb(), edit=bool(update.callback_query))
        return MAIN_MENU
    
    total = len(reqs)
    by_status = {}
    for r in reqs:
        status = r.get("status", "execution")
        by_status[status] = by_status.get(status, 0) + 1
    
    stats_text = f"📊 *الإحصائيات*\n\n*إجمالي الطلبات:* {total}\n\n"
    for status_key, label in STATUS.items():
        count = by_status.get(status_key, 0)
        stats_text += f"{label}: {count}\n"
    
    await send(update, stats_text, main_kb(), edit=bool(update.callback_query))
    return MAIN_MENU


async def cmd_upload(update, ctx) -> int:
    """أمر الرفع"""
    if not check_auth(ctx, update.effective_user.id):
        await update.message.reply_text("🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    await update.message.reply_text("📎 أدخل رقم الطلب:", parse_mode=ParseMode.MARKDOWN)
    return UPLOAD_REQ_ID


async def handle_upload_req_id(update, ctx) -> int:
    """استقبال رقم الطلب"""
    if not check_auth(ctx, update.effective_user.id):
        await update.message.reply_text("🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    req_id = update.message.text.strip()
    reqs = get_all()
    req = next((r for r in reqs if r.get("reqId") == req_id), None)
    
    if not req:
        await update.message.reply_text(
            f"❌ الطلب رقم *{req_id}* غير موجود.\n\nحاول مرة أخرى:",
            parse_mode=ParseMode.MARKDOWN)
        return UPLOAD_REQ_ID
    
    ctx.user_data["upload_req_id"] = req_id
    ctx.user_data["upload_req_key"] = req.get("firebaseKey")
    
    await update.message.reply_text(
        f"✅ تم التحقق من الطلب رقم *{req_id}*\n\n"
        f"📝 *العنوان:* {req.get('title')}\n"
        f"🏛️ *الجهة:* {req.get('authority')}\n\n"
        f"📤 الآن أرسل الملف أو الصورة\n\n"
        f"أو اكتب /cancel للإلغاء",
        parse_mode=ParseMode.MARKDOWN)
    return UPLOAD_FILE


async def handle_upload_file(update, ctx) -> int:
    """معالجة رفع الملف"""
    if not check_auth(ctx, update.effective_user.id):
        await update.message.reply_text("🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    # التحقق من الإلغاء
    if update.message.text and update.message.text.lower() == "/cancel":
        await update.message.reply_text("❌ تم الإلغاء.", reply_markup=main_kb())
        ctx.user_data.pop("upload_req_id", None)
        ctx.user_data.pop("upload_req_key", None)
        return MAIN_MENU
    
    # استخراج بيانات الملف
    doc_info = {}
    file_id = None
    file_name = "بدون اسم"
    file_type = "document"
    
    if update.message.document:
        file_id = update.message.document.file_id
        file_name = update.message.document.file_name or file_name
        file_type = "document"
    elif update.message.photo:
        file_id = update.message.photo[-1].file_id
        file_name = f"صورة_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        file_type = "photo"
    elif update.message.video:
        file_id = update.message.video.file_id
        file_name = update.message.video.file_name or "فيديو"
        file_type = "video"
    elif update.message.audio:
        file_id = update.message.audio.file_id
        file_name = update.message.audio.file_name or "صوت"
        file_type = "audio"
    elif update.message.text:
        await update.message.reply_text(
            "❌ يرجى إرسال ملف، صورة، أو فيديو.\n\nأو اكتب /cancel للإلغاء")
        return UPLOAD_FILE
    else:
        await update.message.reply_text(
            "❌ نوع الملف غير مدعوم.\n\nيرجى إرسال: PDF، صورة، فيديو، أو صوت\n\nأو اكتب /cancel للإلغاء")
        return UPLOAD_FILE
    
    # إنشاء معلومات المستند
    doc_info = {
        "file_id": file_id,
        "file_name": file_name,
        "file_type": file_type,
        "caption": update.message.caption or "",
        "uploadedAt": datetime.now().isoformat(),
    }
    
    req_key = ctx.user_data.get("upload_req_key")
    req_id = ctx.user_data.get("upload_req_id")
    req = get_req(req_key)
    
    # إضافة المستند للبيانات
    if not add_document_to_req(req_key, doc_info):
        await update.message.reply_text(
            "❌ فشل رفع المستند. حاول مرة أخرى.",
            reply_markup=main_kb())
        ctx.user_data.pop("upload_req_id", None)
        ctx.user_data.pop("upload_req_key", None)
        return MAIN_MENU
    
    # إضافة في archive
    try:
        add_document_to_archive(req_id, doc_info)
    except Exception as e:
        logger.warning(f"⚠️ فشل حفظ المستند في archive: {e}")
    
    # ✅ إرسال على القناة فوراً
    channel_sent = False
    if CHANNEL_ID:
        try:
            await send_file_to_channel(ctx, req_id, req, file_id, file_name, file_type)
            channel_sent = True
            logger.info(f"✅ تم إرسال الملف '{file_name}' للقناة فوراً")
        except Exception as e:
            logger.error(f"❌ فشل إرسال الملف للقناة: {e}")
    
    # رسالة النجاح
    if channel_sent:
        msg = f"✅ تم رفع *'{file_name}'* للطلب #{req_id}\n📎 محفوظ في قاعدة البيانات\n📢 تم الحفظ على القناة"
    else:
        msg = f"✅ تم رفع *'{file_name}'* للطلب #{req_id}\n📎 محفوظ في قاعدة البيانات"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=main_kb())
    
    # تنظيف
    ctx.user_data.pop("upload_req_id", None)
    ctx.user_data.pop("upload_req_key", None)
    
    return MAIN_MENU


async def send_file_to_channel(ctx, req_id: str, req: dict, file_id: str, 
                                file_name: str, file_type: str):
    """إرسال الملف على القناة مع معلومات الطلب"""
    
    # رسالة رأس الطلب
    header = (
        f"📌 *مستند جديد للطلب #{req_id}*\n\n"
        f"📝 *العنوان:* {req.get('title', '—')}\n"
        f"🏛️ *الجهة:* {req.get('authority', '—')}\n"
        f"🗂️ *النوع:* {REQ_TYPE.get(req.get('requestType', 'other'), '—')}\n"
        f"📊 *الحالة:* {STATUS.get(req.get('status', 'execution'), '—')}\n"
        f"⏰ *الوقت:* {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"{'-' * 40}\n"
        f"📎 *الملف:* {file_name}\n"
        f"🔤 *النوع:* {file_type}"
    )
    
    # إرسال الملف
    if file_type == "photo":
        await ctx.bot.send_photo(
            chat_id=CHANNEL_ID,
            photo=file_id,
            caption=header,
            parse_mode=ParseMode.MARKDOWN
        )
    elif file_type == "document":
        await ctx.bot.send_document(
            chat_id=CHANNEL_ID,
            document=file_id,
            caption=header,
            parse_mode=ParseMode.MARKDOWN
        )
    elif file_type == "video":
        await ctx.bot.send_video(
            chat_id=CHANNEL_ID,
            video=file_id,
            caption=header,
            parse_mode=ParseMode.MARKDOWN
        )
    elif file_type == "audio":
        await ctx.bot.send_audio(
            chat_id=CHANNEL_ID,
            audio=file_id,
            caption=header,
            parse_mode=ParseMode.MARKDOWN
        )


async def send_docs_to_channel(update, ctx, req_id: str, req_key: str):
    """رفع جميع مستندات الطلب على القناة"""
    if not CHANNEL_ID:
        await update.callback_query.answer("❌ لم يتم تعيين معرف القناة", show_alert=True)
        return
    
    docs = get_archive_docs(req_id)
    if not docs:
        await update.callback_query.answer("ℹ️ لا توجد مستندات لهذا الطلب", show_alert=True)
        return
    
    try:
        req = get_req(req_key)
        header_text = (
            f"📌 *جميع مستندات الطلب #{req_id}*\n\n"
            f"📝 *العنوان:* {req.get('title', '—')}\n"
            f"🏛️ *الجهة:* {req.get('authority', '—')}\n"
            f"📅 *التاريخ:* {fmt_date(req.get('reqDate', ''))}\n"
            f"📎 *العدد:* {len(docs)}\n"
            f"{'-' * 40}"
        )
        
        await ctx.bot.send_message(
            chat_id=CHANNEL_ID,
            text=header_text,
            parse_mode=ParseMode.MARKDOWN
        )
        
        # إرسال كل مستند
        for i, doc in enumerate(docs, 1):
            file_id = doc.get("file_id")
            file_name = doc.get("file_name", "مستند")
            file_type = doc.get("file_type", "document")
            
            doc_caption = f"*{i}. {file_name}*\n📁 {file_type}"
            
            try:
                if file_type == "photo":
                    await ctx.bot.send_photo(
                        chat_id=CHANNEL_ID,
                        photo=file_id,
                        caption=doc_caption,
                        parse_mode=ParseMode.MARKDOWN
                    )
                elif file_type == "document":
                    await ctx.bot.send_document(
                        chat_id=CHANNEL_ID,
                        document=file_id,
                        caption=doc_caption,
                        parse_mode=ParseMode.MARKDOWN
                    )
                elif file_type == "video":
                    await ctx.bot.send_video(
                        chat_id=CHANNEL_ID,
                        video=file_id,
                        caption=doc_caption,
                        parse_mode=ParseMode.MARKDOWN
                    )
                elif file_type == "audio":
                    await ctx.bot.send_audio(
                        chat_id=CHANNEL_ID,
                        audio=file_id,
                        caption=doc_caption,
                        parse_mode=ParseMode.MARKDOWN
                    )
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"Error sending doc {i}: {e}")
                continue
        
        await update.callback_query.answer("✅ تم رفع جميع المستندات", show_alert=True)
    except Exception as e:
        logger.error(f"send_docs_to_channel error: {e}")
        await update.callback_query.answer("❌ فشل الرفع", show_alert=True)


async def do_list_cases(update, ctx) -> int:
    """عرض قائمة الطلبات"""
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    reqs = get_all()
    if not reqs:
        await send(update, "📂 لا توجد طلبات", main_kb(), edit=bool(update.callback_query))
        return MAIN_MENU
    
    await send(update, f"📂 عدد الطلبات: *{len(reqs)}*", edit=bool(update.callback_query))
    
    for r in reqs[:15]:
        await send(update, fmt_req(r), req_kb(r["firebaseKey"]))
    
    if len(reqs) > 15:
        await send(update, f"⏳ عرض أول 15 من {len(reqs)}", main_kb())
    
    return MAIN_MENU


async def do_search(update, ctx) -> int:
    """البحث"""
    q = update.message.text.strip().lower()
    reqs = get_all()
    found = [r for r in reqs if q in " ".join(filter(None, [
        str(r.get("reqId", "")),
        r.get("title", ""),
        r.get("authority", ""),
        r.get("details", ""),
    ])).lower()]
    
    if not found:
        await update.message.reply_text(
            f"🔍 لا توجد نتائج لـ *{q}*",
            parse_mode=ParseMode.MARKDOWN, reply_markup=main_kb())
        return MAIN_MENU
    
    await update.message.reply_text(
        f"🔍 وُجد *{len(found)}* نتيجة:", parse_mode=ParseMode.MARKDOWN)
    
    for r in found[:10]:
        await update.message.reply_text(
            fmt_req(r, short=True),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=req_kb(r["firebaseKey"]))
    
    await update.message.reply_text("🏠", reply_markup=main_kb())
    return MAIN_MENU


async def handle_upload(update, ctx) -> int:
    """معالجة الرفع"""
    if not check_auth(ctx, update.effective_user.id):
        await update.message.reply_text("🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    await update.message.reply_text("📎 أدخل رقم الطلب:", parse_mode=ParseMode.MARKDOWN)
    return UPLOAD_REQ_ID


async def main_cb(update, ctx) -> int:
    """معالجة أزرار القائمة الرئيسية"""
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    q = update.callback_query
    await q.answer()
    action = q.data
    
    cmd_map = {
        "add": start_add_wizard,
        "list": do_list_cases,
        "search": lambda cid: [
            update.callback_query.message.reply_text("🔍 أدخل كلمة البحث:"),
        ],
        "stats": cmd_stats,
        "upload": cmd_upload,
        "help": cmd_help,
    }
    
    if action.startswith("cmd|"):
        cmd = action.split("|")[1]
        if cmd == "search":
            await update.callback_query.edit_message_text("🔍 أدخل كلمة البحث:")
            ctx.user_data["searching"] = True
            return SEARCH_QUERY
        elif cmd in cmd_map:
            await cmd_map[cmd](update, ctx)
            return MAIN_MENU
    
    if action.startswith("view_archive:"):
        key = action.split(":")[1]
        req = get_req(key)
        req_id = req.get("reqId") if req else "؟"
        docs = get_archive_docs(req_id)
        
        if not docs:
            await q.answer("ℹ️ لا توجد مستندات", show_alert=False)
            return MAIN_MENU
        
        buttons = []
        for i, doc in enumerate(docs, 1):
            doc_name = doc.get('file_name', 'بدون اسم')
            buttons.append([InlineKeyboardButton(f"📄 {i}. {doc_name[:30]}", callback_data=f"open_doc:{key}:{i-1}")])
        
        buttons.extend([
            [InlineKeyboardButton("📢 رفع على القناة", callback_data=f"send_to_channel:{key}")],
            [InlineKeyboardButton("🔙 عودة", callback_data="home")],
        ])
        
        await send(update,
            f"📎 *مستندات الطلب #{req_id}* ({len(docs)})",
            InlineKeyboardMarkup(buttons),
            edit=True)
        return MAIN_MENU
    
    if action.startswith("send_to_channel:"):
        key = action.split(":")[1]
        req = get_req(key)
        req_id = req.get("reqId") if req else "؟"
        await send_docs_to_channel(update, ctx, req_id, key)
        return MAIN_MENU
    
    if action.startswith("delete:"):
        key = action.split(":")[1]
        if delete_req(key):
            await send(update, "🗑️ تم الحذف.", main_kb(), edit=True)
        else:
            await q.answer("❌ فشل الحذف", show_alert=True)
        return MAIN_MENU
    
    if action == "home":
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
        return MAIN_MENU
    
    return MAIN_MENU


async def start_add_wizard(update, ctx) -> int:
    """بدء إضافة طلب جديد"""
    ctx.user_data["new_req"] = {}
    await update.callback_query.message.reply_text("📝 أدخل عنوان الطلب:")
    return ADD_TITLE


async def add_title(update, ctx) -> int:
    """استقبال العنوان"""
    ctx.user_data["new_req"]["title"] = update.message.text.strip()
    await update.message.reply_text("🗂️ اختر نوع الطلب:", reply_markup=type_kb("add_type:"))
    return ADD_TYPE


async def add_type_cb(update, ctx) -> int:
    """استقبال النوع"""
    q = update.callback_query
    await q.answer()
    ctx.user_data["new_req"]["requestType"] = q.data.split(":")[1]
    await q.message.reply_text("🏛️ أدخل اسم الجهة:")
    return ADD_AUTH


async def add_auth(update, ctx) -> int:
    """استقبال الجهة"""
    ctx.user_data["new_req"]["authority"] = update.message.text.strip()
    await update.message.reply_text("📄 أدخل التفاصيل (أو اكتب `-` للتخطي):")
    return ADD_DETAILS


async def add_details(update, ctx) -> int:
    """استقبال التفاصيل"""
    val = update.message.text.strip()
    ctx.user_data["new_req"]["details"] = "" if val == "-" else val
    req = ctx.user_data["new_req"]
    
    summary = (
        f"📋 *ملخص الطلب:*\n\n"
        f"📝 *العنوان:* {req.get('title')}\n"
        f"🗂️ *النوع:* {REQ_TYPE.get(req.get('requestType',''),'—')}\n"
        f"🏛️ *الجهة:* {req.get('authority')}\n"
        f"📄 *التفاصيل:* {req.get('details','—')[:200]}\n\n"
        f"هل تريد الحفظ؟"
    )
    
    await update.message.reply_text(
        summary,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ حفظ", callback_data="confirm_add"),
             InlineKeyboardButton("❌ إلغاء", callback_data="home")],
        ]))
    return ADD_CONFIRM


async def confirm_add(update, ctx) -> int:
    """تأكيد إضافة الطلب"""
    q = update.callback_query
    await q.answer()
    
    if q.data == "confirm_add":
        reqs = get_all()
        max_id = max((int(r.get("reqId", "0") or 0) for r in reqs), default=0)
        req = ctx.user_data.get("new_req", {})
        req.update({
            "reqId": str(max_id + 1),
            "status": "execution",
            "reqDate": datetime.now().strftime("%Y-%m-%d"),
            "hasDocuments": False,
            "documents": [],
            "createdBy": update.effective_user.id,
        })
        
        if add_req(req):
            msg = f"✅ تم إضافة الطلب رقم *{req['reqId']}* بنجاح!"
        else:
            msg = "❌ فشل الحفظ."
        
        await send(update, msg, main_kb(), edit=True)
    else:
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
    
    ctx.user_data.pop("new_req", None)
    return MAIN_MENU


async def fallback(update, ctx) -> int:
    """معالج بديل"""
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    
    if update.message.text.startswith("/"):
        return MAIN_MENU
    
    if ctx.user_data.get("searching"):
        result = await do_search(update, ctx)
        ctx.user_data.pop("searching", None)
        return result
    
    await send(update, "🏠 *القائمة الرئيسية*", main_kb())
    return MAIN_MENU


# -----------------------------------------
# تسجيل الأوامر
# -----------------------------------------
async def post_init(application) -> None:
    await application.bot.set_my_commands([
        BotCommand("start",  "🏠 القائمة الرئيسية"),
        BotCommand("stats",  "📊 الإحصائيات"),
        BotCommand("upload", "📤 رفع ملف"),
        BotCommand("logout", "🚪 تسجيل الخروج"),
        BotCommand("help",   "📖 المساعدة"),
    ])
    logger.info("✅ أوامر البوت تم تسجيلها")


# -----------------------------------------
# main
# -----------------------------------------
def main() -> None:
    port = int(os.environ.get("PORT", 10000))
    
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        def log_message(self, *_):
            pass
    
    def run_web():
        with socketserver.TCPServer(("", port), Handler) as s:
            s.serve_forever()
    
    Thread(target=run_web, daemon=True).start()
    logger.info(f"🌐 خادم الفحص على المنفذ {port}")
    
    init_firebase()
    
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    
    file_filter = filters.Document.ALL | filters.PHOTO | filters.VIDEO | filters.AUDIO
    
    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start",  cmd_start),
            CommandHandler("stats",  cmd_stats),
            CommandHandler("logout", cmd_logout),
            CommandHandler("upload", cmd_upload),
            CommandHandler("help",   cmd_help),
        ],
        states={
            WAIT_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, check_password)],
            MAIN_MENU: [
                CallbackQueryHandler(main_cb),
                MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
            ],
            SEARCH_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, do_search)],
            ADD_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_title)],
            ADD_TYPE: [CallbackQueryHandler(add_type_cb, pattern="^add_type:")],
            ADD_AUTH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_auth)],
            ADD_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_details)],
            ADD_CONFIRM: [CallbackQueryHandler(confirm_add, pattern="^(confirm_add|home)$")],
            UPLOAD_REQ_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_upload_req_id)],
            UPLOAD_FILE: [
                MessageHandler(file_filter, handle_upload_file),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_upload_file),
                CommandHandler("cancel", handle_upload_file),
            ],
        },
        fallbacks=[
            CommandHandler("start",  cmd_start),
            CommandHandler("logout", cmd_logout),
            CommandHandler("upload", cmd_upload),
            MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
        ],
        allow_reentry=True,
        name="main_conv",
    )
    
    app.add_handler(conv)
    app.add_handler(CommandHandler("help", cmd_help))
    
    logger.info("🚀 البوت جاهز...")
    app.run_polling(
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    main()
