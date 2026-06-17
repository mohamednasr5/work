#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بوت تيليجرام - نظام إدارة الطلبات البرلمانية
✅ عرض الملفات مباشرة عند الضغط عليها
✅ زر ثابت "📎 رفع مستند لطلب" في Reply Keyboard
✅ رفع الملفات على قناة + حفظ message_id في Firebase
"""

import os
import logging
import json
import asyncio
import time
import io
from datetime import datetime
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    InputMediaPhoto, BotCommand, ReplyKeyboardMarkup, KeyboardButton,
    ReplyKeyboardRemove
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters, ContextTypes
)
import firebase_admin
from firebase_admin import credentials, db as firebase_db
import requests as req_lib

# ══════════════════════════════════════════════
#  ⚙️  الإعدادات - عدّلها من GitHub Secrets
# ══════════════════════════════════════════════
BOT_TOKEN        = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
BOT_PASSWORD     = os.environ.get("BOT_PASSWORD", "521988")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "@your_channel")
FIREBASE_URL     = os.environ.get("FIREBASE_URL", "https://hedor-bea3c-default-rtdb.firebaseio.com")
FIREBASE_PATH    = os.environ.get("FIREBASE_PATH", "parliament-requests")

# Firebase credentials from secret
FIREBASE_CREDS_JSON = os.environ.get("FIREBASE_CREDENTIALS_JSON", "{}")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[
        logging.FileHandler("bot.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════
#  🔥 تهيئة Firebase
# ══════════════════════════════════════════════
def init_firebase():
    if not firebase_admin._apps:
        try:
            creds_dict = json.loads(FIREBASE_CREDS_JSON)
            cred = credentials.Certificate(creds_dict)
            firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_URL})
            logger.info("✅ Firebase initialized successfully")
        except Exception as e:
            logger.error(f"❌ Firebase init error: {e}")

def get_all_requests():
    try:
        ref = firebase_db.reference(FIREBASE_PATH)
        data = ref.get()
        if not data:
            return []
        requests = []
        for key, val in data.items():
            if isinstance(val, dict):
                val["firebaseKey"] = key
                requests.append(val)
        requests.sort(key=lambda x: int(x.get("reqId", 0) or 0), reverse=True)
        return requests
    except Exception as e:
        logger.error(f"❌ Error fetching requests: {e}")
        return []

def get_request_by_id(req_id):
    requests = get_all_requests()
    for r in requests:
        if str(r.get("reqId", "")) == str(req_id):
            return r
    return None

def search_requests(query, filter_type="all", filter_status="all"):
    requests = get_all_requests()
    query = query.strip().lower()
    results = []
    for r in requests:
        title     = str(r.get("title", "")).lower()
        authority = str(r.get("authority", "")).lower()
        req_id    = str(r.get("reqId", "")).lower()
        details   = str(r.get("details", "")).lower()

        match_text = (not query or
                      query in title or
                      query in authority or
                      query in req_id or
                      query in details)
        match_type   = (filter_type == "all" or r.get("requestType") == filter_type)
        match_status = (filter_status == "all" or r.get("status") == filter_status)

        if match_text and match_type and match_status:
            results.append(r)
    return results

def add_request(data: dict):
    try:
        ref = firebase_db.reference(FIREBASE_PATH)
        new_ref = ref.push(data)
        firebase_db.reference(f"{FIREBASE_PATH}/{new_ref.key}/firebaseKey").set(new_ref.key)
        return new_ref.key
    except Exception as e:
        logger.error(f"❌ Error adding request: {e}")
        return None

def update_request(firebase_key: str, data: dict):
    try:
        ref = firebase_db.reference(f"{FIREBASE_PATH}/{firebase_key}")
        ref.update(data)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating request: {e}")
        return False

def delete_request(firebase_key: str):
    try:
        ref = firebase_db.reference(f"{FIREBASE_PATH}/{firebase_key}")
        ref.delete()
        return True
    except Exception as e:
        logger.error(f"❌ Error deleting request: {e}")
        return False

def get_stats():
    requests = get_all_requests()
    stats = {
        "total":         len(requests),
        "special":       sum(1 for r in requests if r.get("requestType") == "special"),
        "general":       sum(1 for r in requests if r.get("requestType") == "general"),
        "briefing":      sum(1 for r in requests if r.get("requestType") == "briefing"),
        "urgent":        sum(1 for r in requests if r.get("requestType") == "urgent"),
        "interrogation": sum(1 for r in requests if r.get("requestType") == "interrogation"),
        "completed":     sum(1 for r in requests if r.get("status") == "completed"),
        "execution":     sum(1 for r in requests if r.get("status") == "execution"),
        "review":        sum(1 for r in requests if r.get("status") == "review"),
        "rejected":      sum(1 for r in requests if r.get("status") == "rejected"),
        "with_docs":     sum(1 for r in requests if r.get("hasDocuments") or r.get("documents")),
    }
    return stats

def save_file_to_firebase(req_id: str, file_id: str, filename: str,
                           filetype: str, caption: str = "",
                           channel_msg_id: int = None):
    """
    يحفظ بيانات الملف في Firebase مع message_id من القناة لعرضه لاحقاً.
    """
    try:
        ref = firebase_db.reference(f"archive/{req_id}")
        entry = {
            "fileid":          file_id,
            "filename":        filename,
            "filetype":        filetype,
            "caption":         caption,
            "uploadedAt":      datetime.utcnow().isoformat(),
        }
        if channel_msg_id:
            entry["channelMsgId"] = channel_msg_id
        new_ref = ref.push(entry)
        return new_ref.key
    except Exception as e:
        logger.error(f"❌ Error saving file metadata: {e}")
        return None

def _normalize_file(f: dict) -> dict:
    """يوحّد مفاتيح الملف — يدعم الصيغة القديمة (file_id/file_type/file_name) والجديدة."""
    return {
        "fileid":       f.get("fileid") or f.get("file_id", ""),
        "filename":     f.get("filename") or f.get("file_name", "—"),
        "filetype":     f.get("filetype") or f.get("file_type", "document"),
        "caption":      f.get("caption", ""),
        "uploadedAt":   f.get("uploadedAt", ""),
        "channelMsgId": f.get("channelMsgId"),
    }

def get_request_files(req_id: str):
    """
    يجلب ملفات الطلب مع دعم صيغتين من Firebase:
    - الصيغة القديمة: file_id / file_type / file_name
    - الصيغة الجديدة: fileid / filetype / filename
    بنية Firebase: archive/{req_id} قد يكون list أو dict أو dict من dicts
    """
    try:
        ref  = firebase_db.reference(f"archive/{req_id}")
        data = ref.get()
        if not data:
            return []

        if isinstance(data, list):
            raw_items = [f for f in data if f is not None]
        elif isinstance(data, dict):
            raw_items = list(data.values())
        else:
            return []

        normalized = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            # إذا كانت القيمة تحتوي dict داخلها (pushKey → data)، نفك الطبقة
            first_val = next(iter(item.values()), None)
            if isinstance(first_val, dict):
                for sub in item.values():
                    if isinstance(sub, dict):
                        n = _normalize_file(sub)
                        if n["fileid"]:
                            normalized.append(n)
            else:
                n = _normalize_file(item)
                if n["fileid"]:
                    normalized.append(n)

        return normalized
    except Exception as e:
        logger.error(f"❌ Error fetching files: {e}")
        return []

# ══════════════════════════════════════════════
#  🔤 الخرائط (عربي)
# ══════════════════════════════════════════════
TYPE_MAP = {
    "special":       "🌟 خاص",
    "general":       "📢 عام",
    "briefing":      "📜 إحاطة",
    "urgent":        "🚨 عاجل",
    "interrogation": "🎤 استجواب",
}
STATUS_MAP = {
    "execution": "⚙️ قيد التنفيذ",
    "review":    "🔍 قيد المراجعة",
    "replied":   "✉️ تم الرد",
    "completed": "✅ مكتمل",
    "rejected":  "❌ مرفوض",
}
STATUS_EMOJI = {
    "execution": "⚙️", "review": "🔍", "replied": "✉️",
    "completed": "✅", "rejected": "❌",
}

def format_request(r: dict, compact=False) -> str:
    req_type   = TYPE_MAP.get(r.get("requestType", ""), r.get("requestType", "—"))
    req_status = STATUS_MAP.get(r.get("status", ""),    r.get("status", "—"))

    if compact:
        return (
            f"📋 *#{r.get('reqId', '?')}* — {r.get('title', 'بدون عنوان')[:50]}\n"
            f"   🏛 {r.get('authority', '—')[:40]} | {req_type} | {req_status}"
        )

    text = (
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 *الطلب رقم:* `{r.get('reqId', '?')}`\n"
        f"📅 *التاريخ:* {r.get('reqDate', '—')}\n"
        f"📌 *النوع:* {req_type}\n"
        f"📊 *الحالة:* {req_status}\n"
        f"🏛 *الجهة:* {r.get('authority', '—')}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📝 *العنوان:*\n{r.get('title', 'بدون عنوان')}\n\n"
    )

    if r.get("details"):
        details = r["details"][:600]
        if len(r["details"]) > 600:
            details += "..."
        text += f"📄 *التفاصيل:*\n{details}\n\n"

    if r.get("repliesList"):
        replies = r["repliesList"]
        if isinstance(replies, list):
            text += f"💬 *الردود ({len(replies)}):*\n"
            for rep in replies[:3]:
                text += f"  • {str(rep)[:100]}\n"
            if len(replies) > 3:
                text += f"  _(وأيضاً {len(replies)-3} ردود أخرى)_\n"
            text += "\n"

    if r.get("hasDocuments") or r.get("documents"):
        docs = r.get("documents", {})
        count = len(docs) if isinstance(docs, dict) else 0
        text += f"📎 *الملفات:* {count if count else 'يوجد'} ملف مرفق\n"

    return text

# ══════════════════════════════════════════════
#  🔐 إدارة الجلسات (محفوظة في Firebase)
# ══════════════════════════════════════════════
user_state = {}
pending_uploads = {}

def is_authenticated(user_id: int) -> bool:
    """
    يتحقق من تسجيل الدخول في Firebase.
    في حال فشل الاتصال، يُعيد False فقط (لا يُعيد True بشكل افتراضي لأسباب أمنية).
    """
    for attempt in range(2):  # محاولتان
        try:
            ref = firebase_db.reference(f"sessions/{user_id}")
            val = ref.get()
            return bool(val and val.get("authenticated"))
        except Exception as e:
            logger.warning(f"is_authenticated attempt {attempt+1} failed: {e}")
            if attempt == 0:
                time.sleep(1)  # انتظر ثانية قبل المحاولة الثانية
    return False

def set_authenticated(user_id: int, value: bool):
    try:
        ref = firebase_db.reference(f"sessions/{user_id}")
        if value:
            ref.set({"authenticated": True, "loginAt": datetime.utcnow().isoformat()})
        else:
            ref.delete()
    except Exception as e:
        logger.error(f"Session save error: {e}")

# ══════════════════════════════════════════════
#  ⌨️ لوحات المفاتيح
# ══════════════════════════════════════════════

# ✅ القائمة الثابتة (Reply Keyboard) - تظهر دائماً أسفل الشاشة
def persistent_keyboard():
    """لوحة المفاتيح الثابتة في أسفل الشاشة"""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📎 رفع مستند لطلب"), KeyboardButton("📋 قائمة الطلبات")],
            [KeyboardButton("🔍 بحث"), KeyboardButton("📊 إحصائيات")],
            [KeyboardButton("📱 القائمة الرئيسية")],
        ],
        resize_keyboard=True,
    )

def main_menu_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📎 رفع مستند لطلب", callback_data="upload_file"),
        ],
        [
            InlineKeyboardButton("📋 قائمة الطلبات", callback_data="list_requests"),
            InlineKeyboardButton("🔍 بحث",           callback_data="search_mode"),
        ],
        [
            InlineKeyboardButton("➕ إضافة طلب",     callback_data="add_request"),
            InlineKeyboardButton("📊 إحصائيات",      callback_data="stats"),
        ],
        [
            InlineKeyboardButton("🔎 فلترة",          callback_data="filter_menu"),
            InlineKeyboardButton("📢 نشر على القناة", callback_data="publish_channel"),
        ],
        [
            InlineKeyboardButton("⚙️ إعدادات",       callback_data="settings"),
        ],
    ])

def request_actions_keyboard(firebase_key: str, req_id: str):
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✏️ تعديل الحالة",  callback_data=f"edit_status:{firebase_key}"),
            InlineKeyboardButton("📁 ملفات الطلب",   callback_data=f"view_files:{req_id}:{firebase_key}"),
        ],
        [
            InlineKeyboardButton("📤 رفع ملف للطلب", callback_data=f"upload_for:{req_id}:{firebase_key}"),
            InlineKeyboardButton("📢 نشر في القناة", callback_data=f"publish:{firebase_key}"),
        ],
        [
            InlineKeyboardButton("🗑 حذف الطلب",    callback_data=f"delete_req:{firebase_key}"),
            InlineKeyboardButton("🔙 القائمة",       callback_data="back_main"),
        ],
    ])

def status_keyboard(firebase_key: str):
    statuses = [
        ("⚙️ قيد التنفيذ", "execution"),
        ("🔍 قيد المراجعة", "review"),
        ("✉️ تم الرد",      "replied"),
        ("✅ مكتمل",        "completed"),
        ("❌ مرفوض",        "rejected"),
    ]
    buttons = [
        [InlineKeyboardButton(label, callback_data=f"set_status:{firebase_key}:{val}")]
        for label, val in statuses
    ]
    buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_main")])
    return InlineKeyboardMarkup(buttons)

def filter_type_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🌟 خاص",    callback_data="filter_type:special"),
            InlineKeyboardButton("📢 عام",    callback_data="filter_type:general"),
        ],
        [
            InlineKeyboardButton("📜 إحاطة",  callback_data="filter_type:briefing"),
            InlineKeyboardButton("🚨 عاجل",   callback_data="filter_type:urgent"),
        ],
        [
            InlineKeyboardButton("🎤 استجواب", callback_data="filter_type:interrogation"),
            InlineKeyboardButton("📋 الكل",    callback_data="filter_type:all"),
        ],
        [InlineKeyboardButton("🔙 رجوع",      callback_data="back_main")],
    ])

def filter_status_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⚙️ تنفيذ",   callback_data="filter_status:execution"),
            InlineKeyboardButton("🔍 مراجعة",  callback_data="filter_status:review"),
        ],
        [
            InlineKeyboardButton("✅ مكتمل",   callback_data="filter_status:completed"),
            InlineKeyboardButton("❌ مرفوض",   callback_data="filter_status:rejected"),
        ],
        [InlineKeyboardButton("📋 الكل",       callback_data="filter_status:all")],
        [InlineKeyboardButton("🔙 رجوع",       callback_data="back_main")],
    ])

def pagination_keyboard(page: int, total_pages: int,
                        prefix: str = "page", extra_data: str = ""):
    buttons = []
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("⬅️ السابق",
                   callback_data=f"{prefix}:{page-1}:{extra_data}"))
    nav.append(InlineKeyboardButton(f"📄 {page+1}/{total_pages}",
               callback_data="noop"))
    if page < total_pages - 1:
        nav.append(InlineKeyboardButton("➡️ التالي",
                   callback_data=f"{prefix}:{page+1}:{extra_data}"))
    if nav:
        buttons.append(nav)
    buttons.append([InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")])
    return InlineKeyboardMarkup(buttons)

def files_list_keyboard(files: list, req_id: str, fire_key: str):
    """
    لوحة مفاتيح لعرض الملفات - كل ملف زر يمكن الضغط عليه لعرضه مباشرة.
    """
    icons = {"photo": "🖼", "document": "📄", "video": "🎬", "audio": "🔊"}
    buttons = []
    for i, f in enumerate(files[:10]):
        icon = icons.get(f.get("filetype", ""), "📎")
        name = f.get("filename", f"ملف {i+1}")[:30]
        buttons.append([
            InlineKeyboardButton(
                f"{icon} {i+1}. {name}",
                callback_data=f"show_file:{req_id}:{i}"
            )
        ])
    buttons.append([
        InlineKeyboardButton("📤 رفع ملف جديد", callback_data=f"upload_for:{req_id}:{fire_key}"),
        InlineKeyboardButton("🔙 رجوع",         callback_data="back_main"),
    ])
    return InlineKeyboardMarkup(buttons)

# ══════════════════════════════════════════════
#  🤖 معالجات الأوامر
# ══════════════════════════════════════════════
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if is_authenticated(user.id):
        # ✅ المستخدم مسجّل - أظهر القائمة مباشرة بدون طلب كلمة مرور
        await update.message.reply_text(
            f"مرحباً *{user.first_name}* 👋",
            parse_mode="Markdown",
            reply_markup=persistent_keyboard()
        )
        await update.message.reply_text(
            "📱 *القائمة الرئيسية*",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
        return
    # ✅ غير مسجّل - اطلب كلمة المرور مرة واحدة فقط
    await update.message.reply_text(
        "🔐 *مرحباً بك في بوت إدارة الطلبات البرلمانية*\n\n"
        "أرسل كلمة المرور للدخول:",
        parse_mode="Markdown"
    )

async def password_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    args = context.args
    if not args:
        await update.message.reply_text("❓ أرسل: /password كلمة_المرور")
        return
    if args[0] == BOT_PASSWORD:
        set_authenticated(user.id, True)
        await update.message.reply_text(
            f"✅ *تم تسجيل الدخول بنجاح!*\n\nمرحباً *{user.first_name}*",
            parse_mode="Markdown",
            reply_markup=persistent_keyboard()
        )
        await update.message.reply_text(
            "📱 *القائمة الرئيسية*",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
    else:
        await update.message.reply_text("❌ كلمة المرور غير صحيحة.")

async def logout_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    set_authenticated(user.id, False)
    user_state.pop(user.id, None)
    await update.message.reply_text(
        "👋 تم تسجيل الخروج.",
        reply_markup=ReplyKeyboardRemove()
    )

async def menu_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        await update.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return
    await update.message.reply_text(
        "📱 *القائمة الرئيسية*",
        parse_mode="Markdown",
        reply_markup=main_menu_keyboard()
    )

async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        await update.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return
    await send_stats(update.message, context)

async def search_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        await update.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return
    query = " ".join(context.args).strip()
    if not query:
        await update.message.reply_text(
            "🔍 أرسل: `/search نص البحث`\nمثال: `/search قانون العمل`",
            parse_mode="Markdown"
        )
        return
    await do_search(update.message, context, query)

async def request_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        await update.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return
    if not context.args:
        await update.message.reply_text("❓ أرسل: /request رقم_الطلب")
        return
    req = get_request_by_id(context.args[0])
    if not req:
        await update.message.reply_text(f"❌ لم يُعثر على الطلب رقم {context.args[0]}")
        return
    text = format_request(req)
    kbd  = request_actions_keyboard(req["firebaseKey"], str(req.get("reqId")))
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kbd)

async def list_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        await update.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return
    await send_request_page(update.message, context, 0)

# ══════════════════════════════════════════════
#  🛠  دوال مساعدة للعرض
# ══════════════════════════════════════════════
PAGE_SIZE = 8

async def send_stats(message, context):
    stats = get_stats()
    text = (
        "📊 *إحصائيات النظام*\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 إجمالي الطلبات: *{stats['total']}*\n\n"
        f"*حسب النوع:*\n"
        f"  🌟 خاص: *{stats['special']}*\n"
        f"  📢 عام: *{stats['general']}*\n"
        f"  📜 إحاطة: *{stats['briefing']}*\n"
        f"  🚨 عاجل: *{stats['urgent']}*\n"
        f"  🎤 استجواب: *{stats['interrogation']}*\n\n"
        f"*حسب الحالة:*\n"
        f"  ✅ مكتملة: *{stats['completed']}*\n"
        f"  ⚙️ قيد التنفيذ: *{stats['execution']}*\n"
        f"  🔍 قيد المراجعة: *{stats['review']}*\n"
        f"  ❌ مرفوضة: *{stats['rejected']}*\n"
        f"  📎 طلبات بملفات: *{stats['with_docs']}*\n"
        "━━━━━━━━━━━━━━━━━━━━"
    )
    kbd = InlineKeyboardMarkup([[
        InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
    ]])
    await message.reply_text(text, parse_mode="Markdown", reply_markup=kbd)

async def send_request_page(message, context, page: int,
                             filter_type="all", filter_status="all", query=""):
    requests = search_requests(query, filter_type, filter_status)
    if not requests:
        await message.reply_text(
            "📭 لا توجد طلبات.",
            reply_markup=main_menu_keyboard()
        )
        return

    total_pages = (len(requests) + PAGE_SIZE - 1) // PAGE_SIZE
    page = max(0, min(page, total_pages - 1))
    start_idx = page * PAGE_SIZE
    page_reqs = requests[start_idx: start_idx + PAGE_SIZE]

    title_line = f"📋 *قائمة الطلبات* ({len(requests)} طلب)"
    if query:
        title_line += f"\n🔍 نتائج: _{query}_"
    text = f"{title_line}\n━━━━━━━━━━━━━━━━━━━━\n\n"

    buttons = []
    for r in page_reqs:
        st_emoji = STATUS_EMOJI.get(r.get("status", ""), "")
        btn_text = f"#{r.get('reqId','?')} {st_emoji} {str(r.get('title',''))[:35]}"
        buttons.append([InlineKeyboardButton(
            btn_text,
            callback_data=f"view_req:{r['firebaseKey']}"
        )])
        text += f"{format_request(r, compact=True)}\n\n"

    extra   = f"{filter_type}|{filter_status}|{query}"
    nav_kbd = pagination_keyboard(page, total_pages, "list_page", extra)
    full_kbd = InlineKeyboardMarkup(buttons + nav_kbd.inline_keyboard)
    await message.reply_text(text, parse_mode="Markdown", reply_markup=full_kbd)

async def do_search(message, context, query: str):
    results = search_requests(query)
    if not results:
        await message.reply_text(
            f"🔍 لا نتائج لـ: *{query}*",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
        return

    text  = f"🔍 *نتائج:* _{query}_\n*{len(results)} نتيجة*\n━━━━━━━━━━━━━━━━━━━━\n\n"
    buttons = []
    for r in results[:15]:
        st = STATUS_EMOJI.get(r.get("status", ""), "")
        btn_text = f"#{r.get('reqId','?')} {st} {str(r.get('title',''))[:35]}"
        buttons.append([InlineKeyboardButton(
            btn_text, callback_data=f"view_req:{r['firebaseKey']}"
        )])
        text += f"{format_request(r, compact=True)}\n\n"

    if len(results) > 15:
        text += f"\n_... و {len(results)-15} نتائج أخرى. خصّص البحث._"

    buttons.append([InlineKeyboardButton("🔙 القائمة", callback_data="back_main")])
    await message.reply_text(
        text, parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(buttons)
    )

# ══════════════════════════════════════════════
#  📝 معالج النصوص
# ══════════════════════════════════════════════
async def handle_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text.strip()

    # ✅ قبول الباسورد كنص مباشر
    if not is_authenticated(user.id):
        if text == BOT_PASSWORD:
            set_authenticated(user.id, True)
            await update.message.reply_text(
                f"✅ *تم تسجيل الدخول بنجاح!*\n\nمرحباً *{user.first_name}*",
                parse_mode="Markdown",
                reply_markup=persistent_keyboard()
            )
            await update.message.reply_text(
                "📱 *القائمة الرئيسية*",
                parse_mode="Markdown",
                reply_markup=main_menu_keyboard()
            )
            return
        # ❌ كلمة مرور خاطئة أو لم يُسجّل بعد
        await update.message.reply_text(
            "🔐 كلمة المرور غير صحيحة.\nأرسل كلمة المرور للدخول:"
        )
        return

    # ══════════════════════════════════════════
    #  أزرار القائمة الثابتة (Reply Keyboard)
    # ══════════════════════════════════════════
    if text == "📎 رفع مستند لطلب":
        user_state[user.id] = {"step": "upload_req_id_input"}
        await update.message.reply_text(
            "📎 *رفع مستند لطلب*\n\nأرسل *رقم الطلب* الذي تريد إرفاق مستند له:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if text == "📋 قائمة الطلبات":
        await send_request_page(update.message, context, 0)
        return

    if text == "🔍 بحث":
        user_state[user.id] = {"step": "search_input"}
        await update.message.reply_text(
            "🔍 أرسل نص البحث (رقم، عنوان، جهة، تفاصيل):",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if text == "📊 إحصائيات":
        await send_stats(update.message, context)
        return

    if text == "📱 القائمة الرئيسية":
        await update.message.reply_text(
            "📱 *القائمة الرئيسية*",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
        return

    # ══════════════════════════════════════════
    #  معالجة حالات المستخدم
    # ══════════════════════════════════════════
    state = user_state.get(user.id, {})
    step  = state.get("step", "")

    if step == "search_input":
        user_state.pop(user.id, None)
        await do_search(update.message, context, text)
        return

    if step == "add_title":
        state["data"]["title"] = text
        state["step"] = "add_date"
        user_state[user.id] = state
        await update.message.reply_text(
            f"✅ العنوان: _{text}_\n\nالخطوة 2/5: أرسل *تاريخ* الطلب (مثل: 2026-06-17):",
            parse_mode="Markdown"
        )
        return

    if step == "add_date":
        state["data"]["reqDate"] = text
        state["step"] = "add_type"
        user_state[user.id] = state
        type_kbd = InlineKeyboardMarkup([
            [InlineKeyboardButton("🌟 خاص",    callback_data="ntype:special"),
             InlineKeyboardButton("📢 عام",    callback_data="ntype:general")],
            [InlineKeyboardButton("📜 إحاطة",  callback_data="ntype:briefing"),
             InlineKeyboardButton("🚨 عاجل",   callback_data="ntype:urgent")],
            [InlineKeyboardButton("🎤 استجواب", callback_data="ntype:interrogation")],
        ])
        await update.message.reply_text(
            "الخطوة 3/5: اختر *نوع* الطلب:",
            parse_mode="Markdown", reply_markup=type_kbd
        )
        return

    if step == "add_authority":
        state["data"]["authority"] = text
        state["step"] = "add_details"
        user_state[user.id] = state
        await update.message.reply_text(
            f"✅ الجهة: _{text}_\n\nالخطوة 5/5: أرسل *تفاصيل* الطلب:",
            parse_mode="Markdown"
        )
        return

    if step == "add_details":
        state["data"]["details"]      = text
        state["data"]["status"]       = "execution"
        state["data"]["hasDocuments"] = False
        all_reqs = get_all_requests()
        max_id   = max((int(r.get("reqId") or 0) for r in all_reqs), default=0)
        state["data"]["reqId"] = str(max_id + 1)
        user_state.pop(user.id, None)

        confirm_text = (
            "📋 *مراجعة الطلب الجديد*\n━━━━━━━━━━━━━━━━━━━━\n"
            f"🔢 رقم: `{state['data']['reqId']}`\n"
            f"📝 العنوان: {state['data']['title']}\n"
            f"📅 التاريخ: {state['data']['reqDate']}\n"
            f"📌 النوع: {TYPE_MAP.get(state['data'].get('requestType',''),'')}\n"
            f"🏛 الجهة: {state['data']['authority']}\n\n"
            f"📄 التفاصيل:\n{text[:200]}\n\nهل تريد *حفظ* هذا الطلب؟"
        )
        context.user_data["pending_new_req"] = state["data"]
        await update.message.reply_text(
            confirm_text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ حفظ",   callback_data="confirm_add"),
                 InlineKeyboardButton("❌ إلغاء", callback_data="back_main")],
            ])
        )
        return

    if step == "upload_caption":
        # المستخدم أرسل نصاً - نحفظه كوصف ثم ننتظر الملف
        req_id   = state.get("upload_req_id", "")
        fire_key = state.get("upload_fire_key", "")
        user_state[user.id] = {
            "step": "awaiting_file",
            "upload_req_id": req_id,
            "upload_fire_key": fire_key,
            "caption": text if text != "0" else ""
        }
        await update.message.reply_text(
            "📎 الآن أرسل الملف (صورة، مستند، فيديو):",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if step == "upload_req_id_input":
        req = get_request_by_id(text)
        if not req:
            await update.message.reply_text(
                f"❌ لم يُعثر على طلب برقم *{text}*\nتأكد من الرقم وأعد المحاولة:",
                parse_mode="Markdown"
            )
            return
        req_id   = str(req.get("reqId"))
        fire_key = req.get("firebaseKey", "")
        user_state[user.id] = {
            "step": "awaiting_file",   # ✅ نتخطى خطوة الوصف مباشرة
            "upload_req_id": req_id,
            "upload_fire_key": fire_key,
            "caption": ""
        }
        await update.message.reply_text(
            f"✅ *الطلب #{req_id}* — _{req.get('title','')[:60]}_\n\n"
            f"📤 الآن أرسل الملف (صورة، مستند، فيديو):",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if step == "publish_req_id":
        req = get_request_by_id(text)
        user_state.pop(user.id, None)
        if not req:
            await update.message.reply_text(f"❌ لم يُعثر على الطلب رقم {text}")
            return
        try:
            channel_text = (
                f"📋 *طلب رقم:* #{req.get('reqId')}\n"
                f"📅 *التاريخ:* {req.get('reqDate','')}\n"
                f"📌 *النوع:* {TYPE_MAP.get(req.get('requestType',''),'')}\n"
                f"📊 *الحالة:* {STATUS_MAP.get(req.get('status',''),'')}\n"
                f"🏛 *الجهة:* {req.get('authority','')}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📝 *{req.get('title','')}*\n\n{req.get('details','')[:800]}"
            )
            await context.bot.send_message(
                chat_id=TELEGRAM_CHANNEL_ID,
                text=channel_text,
                parse_mode="Markdown"
            )
            await update.message.reply_text(
                "✅ تم النشر على القناة بنجاح!",
                reply_markup=main_menu_keyboard()
            )
        except Exception as e:
            await update.message.reply_text(f"❌ فشل النشر: {str(e)[:100]}")
        return

    # بحث تلقائي بالنص
    if len(text) >= 3 and not text.startswith("/"):
        await do_search(update.message, context, text)

# ══════════════════════════════════════════════
#  📁 معالجة الملفات المرسلة
# ══════════════════════════════════════════════
async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_authenticated(user.id):
        return

    state = user_state.get(user.id, {})

    # ✅ إذا أرسل المستخدم ملفاً أثناء خطوة الوصف، نقبله مباشرة بدون وصف
    if state.get("step") == "upload_caption":
        user_state[user.id] = {
            "step": "awaiting_file",
            "upload_req_id":   state.get("upload_req_id", ""),
            "upload_fire_key": state.get("upload_fire_key", ""),
            "caption": ""
        }
        state = user_state[user.id]

    if state.get("step") != "awaiting_file":
        await update.message.reply_text(
            "📁 لرفع ملف على طلب، استخدم زر *📎 رفع مستند لطلب* من القائمة الثابتة\n"
            "أو اختر الطلب ← 📤 رفع ملف للطلب",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
        return

    msg      = update.message
    req_id   = state.get("upload_req_id", "")
    fire_key = state.get("upload_fire_key", "")
    caption  = state.get("caption", "") or msg.caption or ""

    if msg.photo:
        file_obj = msg.photo[-1]
        filetype = "photo"
        filename = f"photo_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        file_id  = file_obj.file_id
    elif msg.document:
        file_obj = msg.document
        filetype = "document"
        filename = file_obj.file_name or f"doc_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        file_id  = file_obj.file_id
    elif msg.video:
        file_obj = msg.video
        filetype = "video"
        filename = f"video_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        file_id  = file_obj.file_id
    elif msg.audio:
        file_obj = msg.audio
        filetype = "audio"
        filename = file_obj.file_name or f"audio_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        file_id  = file_obj.file_id
    elif msg.voice:
        file_obj = msg.voice
        filetype = "audio"
        filename = f"voice_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        file_id  = file_obj.file_id
    else:
        await msg.reply_text("❌ نوع الملف غير مدعوم.")
        return

    # ✅ رفع الملف على القناة أولاً للحصول على message_id
    channel_msg_id = None
    channel_sent   = False
    try:
        req = get_request_by_id(req_id)
        ch_cap = (
            f"📋 طلب #{req_id}\n"
            f"📝 {req.get('title','') if req else ''}\n"
            f"🏛 {req.get('authority','') if req else ''}"
        )
        if caption:
            ch_cap += f"\n💬 {caption}"

        sent_msg = None
        if filetype == "photo":
            sent_msg = await context.bot.send_photo(TELEGRAM_CHANNEL_ID, file_id, caption=ch_cap)
        elif filetype == "document":
            sent_msg = await context.bot.send_document(TELEGRAM_CHANNEL_ID, file_id, caption=ch_cap)
        elif filetype == "video":
            sent_msg = await context.bot.send_video(TELEGRAM_CHANNEL_ID, file_id, caption=ch_cap)
        else:
            # audio/voice - send as document fallback
            sent_msg = await context.bot.send_document(TELEGRAM_CHANNEL_ID, file_id, caption=ch_cap)

        if sent_msg:
            channel_msg_id = sent_msg.message_id
            channel_sent   = True
    except Exception as e:
        logger.error(f"Channel send error: {e}")

    # ✅ حفظ في Firebase مع message_id للقناة
    file_key = save_file_to_firebase(req_id, file_id, filename, filetype, caption, channel_msg_id)
    saved = bool(file_key)

    if fire_key and saved:
        update_request(fire_key, {"hasDocuments": True})

    user_state.pop(user.id, None)

    # رسالة التأكيد مع زر عرض الملفات
    channel_link = ""
    if channel_sent and channel_msg_id and TELEGRAM_CHANNEL_ID.startswith("@"):
        ch_name = TELEGRAM_CHANNEL_ID.lstrip("@")
        channel_link = f"\n🔗 [عرض في القناة](https://t.me/{ch_name}/{channel_msg_id})"

    await msg.reply_text(
        f"{'✅' if saved else '⚠️'} *تم رفع الملف* `{filename}`\n\n"
        f"  🗂 الطلب: `#{req_id}`\n"
        f"  📦 النوع: {filetype}\n"
        f"  📢 القناة: {'✅ تم النشر' if channel_sent else '⚠️ لم يُنشر'}"
        f"{channel_link}\n"
        f"  💾 Firebase: {'✅ محفوظ' if saved else '❌ فشل'}",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📁 ملفات الطلب", callback_data=f"view_files:{req_id}:{fire_key}"),
            InlineKeyboardButton("🔙 القائمة",     callback_data="back_main"),
        ]])
    )

# ══════════════════════════════════════════════
#  🔘 معالجات الأزرار
# ══════════════════════════════════════════════
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user  = query.from_user
    data  = query.data
    await query.answer()

    if not is_authenticated(user.id):
        await query.message.reply_text("🔐 أرسل كلمة المرور للدخول:")
        return

    if data == "back_main":
        user_state.pop(user.id, None)
        await query.message.edit_text(
            "📱 *القائمة الرئيسية*",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard()
        )
        return

    if data == "noop":
        return

    if data == "stats":
        stats = get_stats()
        text = (
            "📊 *إحصائيات النظام*\n━━━━━━━━━━━━━━━━━━━━\n"
            f"📋 الإجمالي: *{stats['total']}*\n\n"
            f"🌟 خاص: *{stats['special']}*  📢 عام: *{stats['general']}*\n"
            f"📜 إحاطة: *{stats['briefing']}*  🚨 عاجل: *{stats['urgent']}*\n\n"
            f"✅ مكتمل: *{stats['completed']}*\n"
            f"⚙️ تنفيذ: *{stats['execution']}*  🔍 مراجعة: *{stats['review']}*\n"
            f"❌ مرفوض: *{stats['rejected']}*\n"
            f"📎 بملفات: *{stats['with_docs']}*\n━━━━━━━━━━━━━━━━━━━━"
        )
        await query.message.edit_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
            ]])
        )
        return

    if data == "list_requests":
        await query.message.delete()
        await send_request_page(query.message, context, 0)
        return

    if data.startswith("list_page:"):
        parts    = data.split(":", 2)
        page     = int(parts[1])
        extra    = parts[2] if len(parts) > 2 else "all|all|"
        ep       = extra.split("|", 2)
        f_type   = ep[0] if len(ep) > 0 else "all"
        f_status = ep[1] if len(ep) > 1 else "all"
        q_text   = ep[2] if len(ep) > 2 else ""
        await query.message.delete()
        await send_request_page(query.message, context, page, f_type, f_status, q_text)
        return

    if data.startswith("view_req:"):
        fire_key = data.split(":", 1)[1]
        requests = get_all_requests()
        req = next((r for r in requests if r.get("firebaseKey") == fire_key), None)
        if not req:
            await query.message.edit_text("❌ لم يُعثر على الطلب.")
            return
        text = format_request(req)
        kbd  = request_actions_keyboard(req["firebaseKey"], str(req.get("reqId")))
        await query.message.edit_text(text, parse_mode="Markdown", reply_markup=kbd)
        return

    if data.startswith("edit_status:"):
        fire_key = data.split(":", 1)[1]
        await query.message.edit_text(
            "📊 *اختر الحالة الجديدة:*",
            parse_mode="Markdown",
            reply_markup=status_keyboard(fire_key)
        )
        return

    if data.startswith("set_status:"):
        _, fire_key, new_status = data.split(":")
        ok  = update_request(fire_key, {"status": new_status})
        txt = f"{'✅ تم تغيير الحالة إلى: ' + STATUS_MAP.get(new_status,'') if ok else '❌ فشل تغيير الحالة'}"
        await query.message.edit_text(
            txt, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
            ]])
        )
        return

    # ══════════════════════════════════════════
    #  📁 عرض قائمة الملفات مع أزرار قابلة للضغط
    # ══════════════════════════════════════════
    if data.startswith("view_files:"):
        parts    = data.split(":")
        req_id   = parts[1]
        fire_key = parts[2] if len(parts) > 2 else ""
        files    = get_request_files(req_id)

        # حفظ الملفات في context لاستخدامها عند الضغط
        context.user_data[f"files_{req_id}"] = files

        if not files:
            await query.message.edit_text(
                f"📁 لا توجد ملفات للطلب `#{req_id}`",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("📤 رفع ملف", callback_data=f"upload_for:{req_id}:{fire_key}"),
                    InlineKeyboardButton("🔙 رجوع",    callback_data="back_main"),
                ]])
            )
            return

        icons = {"photo": "🖼", "document": "📄", "video": "🎬", "audio": "🔊"}
        text  = f"📁 *ملفات الطلب #{req_id}* ({len(files)} ملف)\n━━━━━━━━━━━━━━━━━━━━\n\n"
        text += "اضغط على أي ملف لعرضه مباشرة 👇\n\n"

        for i, f in enumerate(files[:10]):
            icon = icons.get(f.get("filetype", ""), "📎")
            text += f"{i+1}. {icon} `{f.get('filename', '—')}`\n"
            text += f"   📅 {f.get('uploadedAt','')[:10]}"
            if f.get("caption"):
                text += f"  💬 _{f['caption'][:40]}_"
            text += "\n\n"

        await query.message.edit_text(
            text, parse_mode="Markdown",
            reply_markup=files_list_keyboard(files, req_id, fire_key)
        )
        return

    # ══════════════════════════════════════════
    #  🖼 عرض الملف مباشرة عند الضغط عليه
    # ══════════════════════════════════════════
    if data.startswith("show_file:"):
        parts  = data.split(":")
        req_id = parts[1]
        idx    = int(parts[2])

        files = context.user_data.get(f"files_{req_id}", [])
        if not files:
            # أعد جلب الملفات من Firebase
            files = get_request_files(req_id)
            context.user_data[f"files_{req_id}"] = files

        if idx >= len(files):
            await query.message.reply_text("❌ الملف غير موجود.")
            return

        f = files[idx]
        filetype = f.get("filetype", "")
        file_id  = f.get("fileid", "")
        caption  = f.get("caption", "") or f.get("filename", "")
        channel_msg_id = f.get("channelMsgId")

        # ✅ إذا كان الملف منشوراً في القناة نوجّه المستخدم مباشرة
        # ولكن أيضاً نرسل الملف مباشرة في المحادثة
        try:
            if filetype == "photo":
                await context.bot.send_photo(
                    chat_id=query.message.chat_id,
                    photo=file_id,
                    caption=f"🖼 {caption}" if caption else None
                )
            elif filetype == "video":
                await context.bot.send_video(
                    chat_id=query.message.chat_id,
                    video=file_id,
                    caption=f"🎬 {caption}" if caption else None
                )
            elif filetype == "audio":
                await context.bot.send_audio(
                    chat_id=query.message.chat_id,
                    audio=file_id,
                    caption=f"🔊 {caption}" if caption else None
                )
            else:
                # document
                await context.bot.send_document(
                    chat_id=query.message.chat_id,
                    document=file_id,
                    caption=f"📄 {caption}" if caption else None
                )

            # إضافة رابط القناة إن وجد
            extra_kbd = []
            if channel_msg_id and TELEGRAM_CHANNEL_ID.startswith("@"):
                ch_name = TELEGRAM_CHANNEL_ID.lstrip("@")
                channel_url = f"https://t.me/{ch_name}/{channel_msg_id}"
                extra_kbd.append(
                    InlineKeyboardButton("🔗 عرض في القناة", url=channel_url)
                )

            back_kbd = InlineKeyboardMarkup([
                [extra_kbd[0]] if extra_kbd else [],
                [InlineKeyboardButton("🔙 رجوع للملفات", callback_data=f"view_files:{req_id}:")]
            ] if extra_kbd else [
                [InlineKeyboardButton("🔙 رجوع للملفات", callback_data=f"view_files:{req_id}:")]
            ])

            await query.message.reply_text(
                f"✅ تم عرض الملف: `{f.get('filename','')}`",
                parse_mode="Markdown",
                reply_markup=back_kbd
            )

        except Exception as e:
            logger.error(f"Show file error: {e}")
            await query.message.reply_text(
                f"❌ تعذّر عرض الملف: `{str(e)[:100]}`\n\n"
                f"🆔 File ID: `{file_id}`",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🔙 رجوع", callback_data=f"view_files:{req_id}:")
                ]])
            )
        return

    if data.startswith("upload_for:"):
        parts    = data.split(":")
        req_id   = parts[1]
        fire_key = parts[2] if len(parts) > 2 else ""
        user_state[user.id] = {
            "step": "awaiting_file",
            "upload_req_id": req_id,
            "upload_fire_key": fire_key,
            "caption": ""
        }
        await query.message.edit_text(
            f"📤 *رفع ملف للطلب* `#{req_id}`\n\nأرسل الملف الآن (صورة، مستند، فيديو):",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if data.startswith("publish:"):
        fire_key = data.split(":", 1)[1]
        requests = get_all_requests()
        req = next((r for r in requests if r.get("firebaseKey") == fire_key), None)
        if not req:
            await query.message.edit_text("❌ لم يُعثر على الطلب.")
            return
        try:
            channel_text = (
                f"📋 *طلب رقم:* #{req.get('reqId')}\n"
                f"📅 *التاريخ:* {req.get('reqDate','')}\n"
                f"📌 *النوع:* {TYPE_MAP.get(req.get('requestType',''),'')}\n"
                f"📊 *الحالة:* {STATUS_MAP.get(req.get('status',''),'')}\n"
                f"🏛 *الجهة:* {req.get('authority','')}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📝 *{req.get('title','')}*\n\n{req.get('details','')[:800]}"
            )
            await context.bot.send_message(
                chat_id=TELEGRAM_CHANNEL_ID,
                text=channel_text,
                parse_mode="Markdown"
            )
            files = get_request_files(str(req.get("reqId")))
            for f in files[:5]:
                try:
                    ftype = f.get("filetype","")
                    fid   = f.get("fileid","")
                    cap   = f.get("caption", f"ملف الطلب #{req.get('reqId')}")
                    if ftype == "photo":
                        await context.bot.send_photo(TELEGRAM_CHANNEL_ID, fid, caption=cap)
                    elif ftype == "document":
                        await context.bot.send_document(TELEGRAM_CHANNEL_ID, fid, caption=cap)
                    elif ftype == "video":
                        await context.bot.send_video(TELEGRAM_CHANNEL_ID, fid, caption=cap)
                except Exception as fe:
                    logger.error(f"File send error: {fe}")
            await query.message.edit_text(
                f"✅ *تم النشر على القناة* `{TELEGRAM_CHANNEL_ID}`!",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
                ]])
            )
        except Exception as e:
            await query.message.edit_text(
                f"❌ فشل النشر: `{str(e)[:100]}`",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
                ]])
            )
        return

    if data == "publish_channel":
        user_state[user.id] = {"step": "publish_req_id"}
        await query.message.edit_text(
            "📢 أرسل رقم الطلب الذي تريد نشره على القناة:",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if data.startswith("delete_req:"):
        fire_key = data.split(":", 1)[1]
        await query.message.edit_text(
            "⚠️ *تأكيد الحذف* — هل أنت متأكد؟",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🗑 نعم، احذف", callback_data=f"confirm_delete:{fire_key}"),
                 InlineKeyboardButton("❌ لا",         callback_data="back_main")],
            ])
        )
        return

    if data.startswith("confirm_delete:"):
        fire_key = data.split(":", 1)[1]
        ok = delete_request(fire_key)
        await query.message.edit_text(
            "✅ تم الحذف بنجاح." if ok else "❌ فشل الحذف.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
            ]])
        )
        return

    if data == "add_request":
        user_state[user.id] = {"step": "add_title", "data": {}}
        await query.message.edit_text(
            "➕ *إضافة طلب جديد*\n\nالخطوة 1/5: أرسل *عنوان* الطلب:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="cancel_add")
            ]])
        )
        return

    if data == "cancel_add":
        user_state.pop(user.id, None)
        await query.message.edit_text(
            "❌ تم الإلغاء.",
            reply_markup=main_menu_keyboard()
        )
        return

    if data.startswith("ntype:"):
        req_type = data.split(":", 1)[1]
        state = user_state.get(user.id, {})
        state["data"]["requestType"] = req_type
        state["step"] = "add_authority"
        user_state[user.id] = state
        await query.message.edit_text(
            f"✅ النوع: *{TYPE_MAP.get(req_type,req_type)}*\n\nالخطوة 4/5: أرسل *اسم الجهة*:",
            parse_mode="Markdown"
        )
        return

    if data == "confirm_add":
        req_data = context.user_data.get("pending_new_req")
        if not req_data:
            await query.message.edit_text("❌ انتهت صلاحية البيانات. أعد المحاولة.")
            return
        fire_key = add_request(req_data)
        if fire_key:
            await query.message.edit_text(
                f"✅ *تم إضافة الطلب!*\n🔢 الرقم: `{req_data.get('reqId')}`\n📝 {req_data.get('title','')[:80]}",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("📁 رفع ملف", callback_data=f"upload_for:{req_data.get('reqId')}:{fire_key}"),
                    InlineKeyboardButton("🔙 القائمة", callback_data="back_main"),
                ]])
            )
        else:
            await query.message.edit_text("❌ فشل الحفظ في Firebase.")
        context.user_data.pop("pending_new_req", None)
        return

    if data == "search_mode":
        user_state[user.id] = {"step": "search_input"}
        await query.message.edit_text(
            "🔍 أرسل نص البحث (رقم، عنوان، جهة، تفاصيل):",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if data == "filter_menu":
        await query.message.edit_text(
            "🔎 *فلترة حسب:*",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📌 النوع",  callback_data="show_filter_type"),
                 InlineKeyboardButton("📊 الحالة", callback_data="show_filter_status")],
                [InlineKeyboardButton("🔙 رجوع",   callback_data="back_main")],
            ])
        )
        return

    if data == "show_filter_type":
        await query.message.edit_text(
            "📌 *اختر النوع:*", parse_mode="Markdown",
            reply_markup=filter_type_keyboard()
        )
        return

    if data == "show_filter_status":
        await query.message.edit_text(
            "📊 *اختر الحالة:*", parse_mode="Markdown",
            reply_markup=filter_status_keyboard()
        )
        return

    if data.startswith("filter_type:"):
        f_type = data.split(":", 1)[1]
        await query.message.delete()
        await send_request_page(query.message, context, 0, filter_type=f_type)
        return

    if data.startswith("filter_status:"):
        f_status = data.split(":", 1)[1]
        await query.message.delete()
        await send_request_page(query.message, context, 0, filter_status=f_status)
        return

    if data == "upload_file":
        user_state[user.id] = {"step": "upload_req_id_input"}
        await query.message.edit_text(
            "📎 *رفع مستند لطلب*\n\nأرسل رقم الطلب:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ إلغاء", callback_data="back_main")
            ]])
        )
        return

    if data == "settings":
        await query.message.edit_text(
            f"⚙️ *إعدادات البوت*\n━━━━━━━━━━━━━━━━━━━━\n"
            f"📢 القناة: `{TELEGRAM_CHANNEL_ID}`\n"
            f"🔥 Firebase: `{FIREBASE_URL}`\n"
            f"📂 المسار: `{FIREBASE_PATH}`\n\n"
            f"_عدّل من GitHub Secrets_",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة", callback_data="back_main")
            ]])
        )
        return

# ══════════════════════════════════════════════
#  🚀 نقطة التشغيل
# ══════════════════════════════════════════════
async def post_init(application: Application):
    await application.bot.set_my_commands([
        BotCommand("start",    "بدء البوت"),
        BotCommand("menu",     "القائمة الرئيسية"),
        BotCommand("list",     "قائمة الطلبات"),
        BotCommand("search",   "البحث في الطلبات"),
        BotCommand("request",  "عرض طلب بالرقم"),
        BotCommand("stats",    "الإحصائيات"),
        BotCommand("password", "تسجيل الدخول"),
        BotCommand("logout",   "تسجيل الخروج"),
    ])

def kill_other_instances():
    """
    يحذف الـ webhook ويرسل getUpdates بـ timeout=0 لإنهاء أي نسخة أخرى شغالة،
    ثم ينتظر ثانيتين للتأكد من انتهائها.
    """
    import urllib.request
    import urllib.error
    base = f"https://api.telegram.org/bot{BOT_TOKEN}"
    try:
        # 1) حذف أي webhook قائم
        urllib.request.urlopen(f"{base}/deleteWebhook?drop_pending_updates=false", timeout=10)
        logger.info("🔪 deleteWebhook done")
    except Exception as e:
        logger.warning(f"deleteWebhook error: {e}")
    try:
        # 2) استدعاء getUpdates بـ timeout=0 يُنهي أي polling آخر (يسبب Conflict له)
        urllib.request.urlopen(f"{base}/getUpdates?offset=-1&timeout=0&limit=1", timeout=10)
        logger.info("🔪 getUpdates kick done")
    except Exception as e:
        logger.warning(f"getUpdates kick error: {e}")
    # 3) انتظر 3 ثوانٍ حتى تنتهي النسخة الأخرى
    logger.info("⏳ Waiting 3s for other instances to die...")
    time.sleep(3)
    logger.info("✅ Ready to start polling")


def main():
    init_firebase()
    kill_other_instances()
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )
    app.add_handler(CommandHandler("start",    start))
    app.add_handler(CommandHandler("password", password_cmd))
    app.add_handler(CommandHandler("logout",   logout_cmd))
    app.add_handler(CommandHandler("menu",     menu_cmd))
    app.add_handler(CommandHandler("stats",    stats_cmd))
    app.add_handler(CommandHandler("search",   search_cmd))
    app.add_handler(CommandHandler("request",  request_cmd))
    app.add_handler(CommandHandler("list",     list_cmd))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(
        filters.PHOTO | filters.Document.ALL | filters.VIDEO |
        filters.AUDIO | filters.VOICE,
        handle_media
    ))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_input))
    logger.info("🚀 Bot started!")
    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=False,
    )

if __name__ == "__main__":
    main()
