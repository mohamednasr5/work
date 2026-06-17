"""
بوت تليجرام - إدارة الطلبات البرلمانية
Parliamentary Requests Management Bot
برمجة: Claude AI - بناءً على نظام مهندس محمد حماد
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from io import BytesIO

import firebase_admin
from firebase_admin import credentials, db

from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    InputFile, ReplyKeyboardMarkup, KeyboardButton
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters, ContextTypes
)
from telegram.constants import ParseMode

# ─────────────────────────────────────────
# الإعداد والتهيئة
# ─────────────────────────────────────────

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN    = os.environ["BOT_TOKEN"]
CHANNEL_ID   = os.environ["TELEGRAM_CHANNEL_ID"]   # مثال: @mychannel أو -100xxxxxxx
FIREBASE_URL = os.environ["FIREBASE_URL"]           # https://hedor-bea3c-default-rtdb.firebaseio.com
FIREBASE_PATH = os.environ.get("FIREBASE_PATH", "parliament-requests")

# ─── تهيئة Firebase ───
cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
if cred_json:
    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_URL})
else:
    firebase_admin.initialize_app(options={"databaseURL": FIREBASE_URL})

def get_db_ref():
    return db.reference(FIREBASE_PATH)

# ─────────────────────────────────────────
# ثوابت الحالات (ConversationHandler)
# ─────────────────────────────────────────
(
    MAIN_MENU,
    ADD_TITLE, ADD_TYPE, ADD_DATE, ADD_AUTHORITY,
    ADD_DETAILS, ADD_DOCS, ADD_CONFIRM,
    SEARCH_QUERY,
    EDIT_SELECT, EDIT_FIELD, EDIT_VALUE,
    DEL_CONFIRM,
    UPLOAD_REQ_ID, UPLOAD_FILE, UPLOAD_CONFIRM,
    REPLY_REQ_ID, REPLY_TEXT,
) = range(18)

# ─────────────────────────────────────────
# خرائط الترجمة
# ─────────────────────────────────────────
TYPE_MAP = {
    "طلب إحاطة":   "briefing",
    "طلب عام":     "general",
    "طلب عاجل":    "urgent",
    "طلب خاص":    "special",
}
TYPE_MAP_REV = {v: k for k, v in TYPE_MAP.items()}

STATUS_MAP = {
    "execution": "⏳ قيد التنفيذ",
    "completed": "✅ مكتمل",
    "replied":   "💬 تم الرد",
}
STATUS_EMOJI = {
    "execution": "⏳",
    "completed": "✅",
    "replied":   "💬",
}
TYPE_EMOJI = {
    "briefing": "📋",
    "general":  "📄",
    "urgent":   "🚨",
    "special":  "⭐",
}

# ─────────────────────────────────────────
# أدوات Firebase
# ─────────────────────────────────────────

def fb_get_all() -> dict:
    data = get_db_ref().get() or {}
    return data  # {firebaseKey: {...}}

def fb_get_one(key: str) -> dict | None:
    return get_db_ref().child(key).get()

def fb_add(data: dict) -> str:
    ref = get_db_ref().push()
    now = datetime.utcnow().isoformat()
    data.update({"firebaseKey": ref.key, "createdAt": now, "updatedAt": now})
    ref.set(data)
    return ref.key

def fb_update(key: str, data: dict):
    data["updatedAt"] = datetime.utcnow().isoformat()
    get_db_ref().child(key).update(data)

def fb_delete(key: str):
    get_db_ref().child(key).delete()

def next_req_id() -> str:
    data = fb_get_all()
    if not data:
        return "1"
    ids = []
    for v in data.values():
        try:
            ids.append(int(v.get("reqId", 0)))
        except (ValueError, TypeError):
            pass
    return str(max(ids) + 1) if ids else "1"

def search_requests(query: str) -> list:
    query = query.strip().lower()
    results = []
    for key, req in fb_get_all().items():
        req["firebaseKey"] = key
        if (
            query in req.get("title", "").lower()
            or query in req.get("details", "").lower()
            or query in req.get("reqId", "").lower()
            or query in req.get("authority", "").lower()
        ):
            results.append(req)
    return results

# ─────────────────────────────────────────
# تنسيق الرسائل
# ─────────────────────────────────────────

def format_request_card(req: dict, short=False) -> str:
    t_emoji = TYPE_EMOJI.get(req.get("requestType", ""), "📄")
    s_emoji = STATUS_EMOJI.get(req.get("status", ""), "⏳")
    t_label = TYPE_MAP_REV.get(req.get("requestType", ""), req.get("requestType", ""))
    s_label = STATUS_MAP.get(req.get("status", ""), req.get("status", ""))
    docs_icon = "📎" if req.get("hasDocuments") else ""

    card = (
        f"{t_emoji} *{req.get('title', 'بدون عنوان')}* {docs_icon}\n"
        f"🔢 رقم الطلب: `{req.get('reqId', '—')}`\n"
        f"📅 التاريخ: {req.get('reqDate', '—')}\n"
        f"🏛 الجهة: {req.get('authority', '—')}\n"
        f"🗂 النوع: {t_label}\n"
        f"📌 الحالة: {s_label}\n"
    )
    if not short:
        details = req.get("details", "")
        if details:
            preview = details[:400] + ("…" if len(details) > 400 else "")
            card += f"\n📝 *التفاصيل:*\n{preview}\n"
        replies = req.get("repliesList", [])
        if replies:
            card += f"\n💬 *الردود ({len(replies)}):*\n"
            for i, r in enumerate(replies[-2:], 1):
                card += f"  {i}. {r[:200]}{'…' if len(r)>200 else ''}\n"
    return card

def format_channel_post(req: dict) -> str:
    t_emoji = TYPE_EMOJI.get(req.get("requestType", ""), "📄")
    t_label = TYPE_MAP_REV.get(req.get("requestType", ""), req.get("requestType", ""))
    s_label = STATUS_MAP.get(req.get("status", ""), req.get("status", ""))

    return (
        f"{'='*35}\n"
        f"{t_emoji} *{req.get('title', '')}*\n"
        f"{'='*35}\n\n"
        f"🔢 *رقم الطلب:* {req.get('reqId', '—')}\n"
        f"📅 *التاريخ:* {req.get('reqDate', '—')}\n"
        f"🏛 *الجهة المختصة:* {req.get('authority', '—')}\n"
        f"🗂 *نوع الطلب:* {t_label}\n"
        f"📌 *الحالة:* {s_label}\n\n"
        f"📝 *تفاصيل الطلب:*\n{req.get('details', '—')}\n\n"
        f"#طلب_{req.get('reqId','')}"
    )

# ─────────────────────────────────────────
# لوحة المفاتيح الرئيسية
# ─────────────────────────────────────────

def main_keyboard():
    return ReplyKeyboardMarkup([
        [KeyboardButton("➕ إضافة طلب"),    KeyboardButton("🔍 بحث عن طلب")],
        [KeyboardButton("📋 عرض الطلبات"),  KeyboardButton("📤 رفع ملف لطلب")],
        [KeyboardButton("💬 إضافة رد"),      KeyboardButton("📊 الإحصائيات")],
        [KeyboardButton("📡 نشر على القناة"), KeyboardButton("🗑 حذف طلب")],
    ], resize_keyboard=True)

# ─────────────────────────────────────────
# /start
# ─────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data.clear()
    await update.message.reply_text(
        "🏛 *مرحباً بك في بوت إدارة الطلبات البرلمانية*\n\n"
        "اختر من القائمة أدناه:",
        reply_markup=main_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )
    return MAIN_MENU

# ─────────────────────────────────────────
# الإحصائيات
# ─────────────────────────────────────────

async def stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = fb_get_all()
    total = len(data)
    by_status = {}
    by_type = {}
    with_docs = 0
    for v in data.values():
        st = v.get("status", "unknown")
        tp = v.get("requestType", "unknown")
        by_status[st] = by_status.get(st, 0) + 1
        by_type[tp] = by_type.get(tp, 0) + 1
        if v.get("hasDocuments"):
            with_docs += 1

    msg = f"📊 *إحصائيات النظام*\n\n🔢 إجمالي الطلبات: *{total}*\n📎 مع ملفات: *{with_docs}*\n\n"
    msg += "*حسب الحالة:*\n"
    for st, cnt in by_status.items():
        msg += f"  {STATUS_MAP.get(st, st)}: {cnt}\n"
    msg += "\n*حسب النوع:*\n"
    for tp, cnt in by_type.items():
        msg += f"  {TYPE_EMOJI.get(tp,'📄')} {TYPE_MAP_REV.get(tp, tp)}: {cnt}\n"

    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=main_keyboard())
    return MAIN_MENU

# ─────────────────────────────────────────
# عرض الطلبات
# ─────────────────────────────────────────

async def list_requests(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = fb_get_all()
    if not data:
        await update.message.reply_text("لا توجد طلبات حالياً.", reply_markup=main_keyboard())
        return MAIN_MENU

    # أحدث 10 طلبات
    sorted_reqs = sorted(data.values(), key=lambda x: x.get("reqDate",""), reverse=True)[:10]
    buttons = []
    for req in sorted_reqs:
        key = req.get("firebaseKey", "")
        label = f"{STATUS_EMOJI.get(req.get('status',''), '⏳')} #{req.get('reqId','?')} {req.get('title','')[:30]}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"view:{key}")])

    await update.message.reply_text(
        f"📋 *أحدث {len(sorted_reqs)} طلبات:*",
        reply_markup=InlineKeyboardMarkup(buttons),
        parse_mode=ParseMode.MARKDOWN,
    )
    return MAIN_MENU

# ─────────────────────────────────────────
# عرض طلب واحد (callback)
# ─────────────────────────────────────────

async def view_request_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    req = fb_get_one(key)
    if not req:
        await query.edit_message_text("❌ الطلب غير موجود.")
        return MAIN_MENU

    req["firebaseKey"] = key
    card = format_request_card(req)

    actions = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✏️ تعديل",  callback_data=f"edit:{key}"),
            InlineKeyboardButton("🗑 حذف",    callback_data=f"del:{key}"),
        ],
        [
            InlineKeyboardButton("📤 نشر في القناة", callback_data=f"publish:{key}"),
            InlineKeyboardButton("💬 إضافة رد",      callback_data=f"reply:{key}"),
        ],
        [InlineKeyboardButton("🔙 رجوع", callback_data="back:main")],
    ])

    # إذا كان هناك مستندات، أرسلها
    docs = req.get("documents", [])
    if docs:
        await query.message.reply_text(f"📎 *المستندات المرفقة ({len(docs)}):*", parse_mode=ParseMode.MARKDOWN)
        for doc in docs:
            fid = doc.get("file_id")
            ftype = doc.get("file_type", "photo")
            caption = f"📁 {doc.get('file_name','ملف')} | {doc.get('uploadedAt','')[:10]}"
            try:
                if ftype == "photo":
                    await query.message.reply_photo(fid, caption=caption)
                elif ftype == "document":
                    await query.message.reply_document(fid, caption=caption)
                elif ftype == "video":
                    await query.message.reply_video(fid, caption=caption)
            except Exception as e:
                await query.message.reply_text(f"⚠️ تعذر عرض الملف: {doc.get('file_name')}\n`{e}`", parse_mode=ParseMode.MARKDOWN)

    await query.edit_message_text(card, reply_markup=actions, parse_mode=ParseMode.MARKDOWN)
    return MAIN_MENU

# ─────────────────────────────────────────
# البحث
# ─────────────────────────────────────────

async def search_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔍 أدخل كلمة البحث (عنوان / رقم الطلب / الجهة / الكلمات المفتاحية):",
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("🔙 رجوع")]], resize_keyboard=True),
    )
    return SEARCH_QUERY

async def search_execute(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query_text = update.message.text.strip()
    if query_text == "🔙 رجوع":
        await update.message.reply_text("تم الرجوع.", reply_markup=main_keyboard())
        return MAIN_MENU

    results = search_requests(query_text)
    if not results:
        await update.message.reply_text("❌ لا توجد نتائج. حاول بكلمة أخرى.", reply_markup=main_keyboard())
        return MAIN_MENU

    buttons = []
    for req in results[:15]:
        key = req.get("firebaseKey", "")
        label = f"{STATUS_EMOJI.get(req.get('status',''), '⏳')} #{req.get('reqId','?')} {req.get('title','')[:35]}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"view:{key}")])

    await update.message.reply_text(
        f"🔍 نتائج البحث عن: *{query_text}*\nوُجد: {len(results)} طلب",
        reply_markup=InlineKeyboardMarkup(buttons),
        parse_mode=ParseMode.MARKDOWN,
    )
    return MAIN_MENU

# ─────────────────────────────────────────
# إضافة طلب جديد
# ─────────────────────────────────────────

async def add_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data["new_req"] = {}
    await update.message.reply_text(
        "➕ *إضافة طلب جديد*\n\nأدخل *عنوان الطلب:*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return ADD_TITLE

async def add_title(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    ctx.user_data["new_req"]["title"] = update.message.text.strip()
    types_kb = ReplyKeyboardMarkup(
        [[KeyboardButton(t)] for t in TYPE_MAP] + [[KeyboardButton("❌ إلغاء")]],
        resize_keyboard=True,
    )
    await update.message.reply_text("🗂 *نوع الطلب:*", parse_mode=ParseMode.MARKDOWN, reply_markup=types_kb)
    return ADD_TYPE

async def add_type(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    t = TYPE_MAP.get(update.message.text)
    if not t:
        await update.message.reply_text("اختر من القائمة.")
        return ADD_TYPE
    ctx.user_data["new_req"]["requestType"] = t
    await update.message.reply_text(
        "📅 *تاريخ الطلب* (مثال: 2026-06-17):",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton(datetime.now().strftime("%Y-%m-%d"))], [KeyboardButton("❌ إلغاء")]],
            resize_keyboard=True,
        ),
    )
    return ADD_DATE

async def add_date(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    ctx.user_data["new_req"]["reqDate"] = update.message.text.strip()
    await update.message.reply_text(
        "🏛 *الجهة المختصة:*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return ADD_AUTHORITY

async def add_authority(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    ctx.user_data["new_req"]["authority"] = update.message.text.strip()
    await update.message.reply_text(
        "📝 *تفاصيل الطلب:*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return ADD_DETAILS

async def add_details(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    ctx.user_data["new_req"]["details"] = update.message.text.strip()
    ctx.user_data["new_req"]["documents"] = []
    ctx.user_data["new_req"]["hasDocuments"] = False

    await update.message.reply_text(
        "📎 هل تريد إرفاق مستندات؟\nأرسل الصور/الملفات الآن أو اضغط *انتهيت*:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton("✅ انتهيت - حفظ الطلب")], [KeyboardButton("❌ إلغاء")]],
            resize_keyboard=True,
        ),
    )
    return ADD_DOCS

async def add_docs_receive(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """استقبال ملفات المستندات أثناء إنشاء الطلب"""
    msg = update.message
    doc_entry = None

    if msg.photo:
        photo = msg.photo[-1]
        doc_entry = {
            "file_id": photo.file_id,
            "file_type": "photo",
            "file_name": f"صورة_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }
    elif msg.document:
        doc_entry = {
            "file_id": msg.document.file_id,
            "file_type": "document",
            "file_name": msg.document.file_name or "ملف",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }
    elif msg.video:
        doc_entry = {
            "file_id": msg.video.file_id,
            "file_type": "video",
            "file_name": f"فيديو_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }

    if doc_entry:
        ctx.user_data["new_req"]["documents"].append(doc_entry)
        ctx.user_data["new_req"]["hasDocuments"] = True
        count = len(ctx.user_data["new_req"]["documents"])
        await msg.reply_text(
            f"✅ تم إرفاق الملف ({count} ملف حتى الآن). أرسل المزيد أو اضغط *انتهيت*:",
            parse_mode=ParseMode.MARKDOWN,
        )
    return ADD_DOCS

async def add_confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)

    req = ctx.user_data.get("new_req", {})
    req["reqId"] = next_req_id()
    req["status"] = "execution"

    # معاينة
    card = format_request_card(req)
    await update.message.reply_text(
        f"📋 *معاينة الطلب:*\n\n{card}\n\nهل تريد الحفظ؟",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ حفظ",    callback_data="confirm_add:yes"),
                InlineKeyboardButton("❌ إلغاء",   callback_data="confirm_add:no"),
            ]
        ]),
    )
    return ADD_CONFIRM

async def add_confirmed_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "confirm_add:no":
        await query.edit_message_text("❌ تم إلغاء إضافة الطلب.")
        ctx.user_data.clear()
        await query.message.reply_text("القائمة الرئيسية:", reply_markup=main_keyboard())
        return MAIN_MENU

    req = ctx.user_data.get("new_req", {})
    key = fb_add(req)
    await query.edit_message_text(
        f"✅ *تم حفظ الطلب بنجاح!*\nرقم الطلب: `{req['reqId']}`\nFirebase Key: `{key}`",
        parse_mode=ParseMode.MARKDOWN,
    )
    ctx.user_data.clear()
    await query.message.reply_text("القائمة الرئيسية:", reply_markup=main_keyboard())
    return MAIN_MENU

# ─────────────────────────────────────────
# رفع ملف لطلب موجود
# ─────────────────────────────────────────

async def upload_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data["upload"] = {}
    await update.message.reply_text(
        "📤 *رفع ملف لطلب موجود*\n\nأدخل رقم الطلب:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return UPLOAD_REQ_ID

async def upload_req_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    req_id = update.message.text.strip()
    # البحث عن الطلب
    found = None
    found_key = None
    for key, v in fb_get_all().items():
        if str(v.get("reqId", "")) == req_id:
            found = v
            found_key = key
            break
    if not found:
        await update.message.reply_text(f"❌ لم يُعثر على طلب رقم {req_id}. حاول مرة أخرى:")
        return UPLOAD_REQ_ID

    ctx.user_data["upload"]["key"] = found_key
    ctx.user_data["upload"]["req"] = found
    await update.message.reply_text(
        f"✅ وُجد الطلب: *{found.get('title','')[:50]}*\n\nأرسل الملف/الصورة الآن:",
        parse_mode=ParseMode.MARKDOWN,
    )
    return UPLOAD_FILE

async def upload_file_receive(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    msg = update.message
    doc_entry = None

    if msg.photo:
        photo = msg.photo[-1]
        doc_entry = {
            "file_id": photo.file_id,
            "file_type": "photo",
            "file_name": f"صورة_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }
    elif msg.document:
        doc_entry = {
            "file_id": msg.document.file_id,
            "file_type": "document",
            "file_name": msg.document.file_name or "ملف",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }
    elif msg.video:
        doc_entry = {
            "file_id": msg.video.file_id,
            "file_type": "video",
            "file_name": f"فيديو_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "caption": msg.caption or "",
            "uploadedAt": datetime.utcnow().isoformat(),
        }

    if not doc_entry:
        await msg.reply_text("⚠️ أرسل صورة أو ملف أو فيديو.")
        return UPLOAD_FILE

    ctx.user_data["upload"]["doc"] = doc_entry

    req = ctx.user_data["upload"]["req"]
    await msg.reply_text(
        f"📎 تأكيد رفع الملف *{doc_entry['file_name']}*\nإلى الطلب: *{req.get('title','')[:50]}*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ رفع", callback_data="confirm_upload:yes"),
                InlineKeyboardButton("❌ إلغاء", callback_data="confirm_upload:no"),
            ]
        ]),
    )
    return UPLOAD_CONFIRM

async def upload_confirmed_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "confirm_upload:no":
        await query.edit_message_text("❌ تم إلغاء الرفع.")
        ctx.user_data.clear()
        await query.message.reply_text("القائمة:", reply_markup=main_keyboard())
        return MAIN_MENU

    upload = ctx.user_data.get("upload", {})
    key = upload["key"]
    doc_entry = upload["doc"]

    # جلب الطلب الحالي وإضافة الملف
    req = fb_get_one(key) or {}
    docs = req.get("documents", []) or []
    docs.append(doc_entry)
    fb_update(key, {"documents": docs, "hasDocuments": True})

    # نشر الملف على القناة مع معلومات الطلب
    req_data = upload["req"]
    caption = (
        f"📎 *ملف جديد مرفق*\n"
        f"طلب رقم: {req_data.get('reqId')}\n"
        f"{req_data.get('title','')}\n"
        f"#ملف_طلب_{req_data.get('reqId','')}"
    )
    try:
        fid = doc_entry["file_id"]
        ftype = doc_entry["file_type"]
        if ftype == "photo":
            await query.get_bot().send_photo(CHANNEL_ID, fid, caption=caption, parse_mode=ParseMode.MARKDOWN)
        elif ftype == "document":
            await query.get_bot().send_document(CHANNEL_ID, fid, caption=caption, parse_mode=ParseMode.MARKDOWN)
        elif ftype == "video":
            await query.get_bot().send_video(CHANNEL_ID, fid, caption=caption, parse_mode=ParseMode.MARKDOWN)
        channel_note = f" وتم نشره على القناة ✅"
    except Exception as e:
        channel_note = f"\n⚠️ لم يتم النشر على القناة: {e}"

    await query.edit_message_text(f"✅ تم رفع الملف بنجاح!{channel_note}", parse_mode=ParseMode.MARKDOWN)
    ctx.user_data.clear()
    await query.message.reply_text("القائمة:", reply_markup=main_keyboard())
    return MAIN_MENU

# ─────────────────────────────────────────
# إضافة رد على طلب
# ─────────────────────────────────────────

async def reply_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data["reply"] = {}
    await update.message.reply_text(
        "💬 *إضافة رد على طلب*\n\nأدخل رقم الطلب:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return REPLY_REQ_ID

async def reply_req_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    req_id = update.message.text.strip()
    found = None
    found_key = None
    for key, v in fb_get_all().items():
        if str(v.get("reqId", "")) == req_id:
            found = v
            found_key = key
            break
    if not found:
        await update.message.reply_text(f"❌ لم يُعثر على طلب {req_id}.")
        return REPLY_REQ_ID
    ctx.user_data["reply"]["key"] = found_key
    ctx.user_data["reply"]["req"] = found
    await update.message.reply_text(
        f"✅ طلب: *{found.get('title','')[:50]}*\n\nأدخل نص الرد:",
        parse_mode=ParseMode.MARKDOWN,
    )
    return REPLY_TEXT

async def reply_text_receive(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    reply_data = ctx.user_data.get("reply", {})
    key = reply_data["key"]
    req = fb_get_one(key) or {}
    replies = req.get("repliesList", []) or []
    replies.append(update.message.text.strip())
    fb_update(key, {"repliesList": replies, "status": "replied"})
    await update.message.reply_text(
        f"✅ تم إضافة الرد وتحديث حالة الطلب إلى 'تم الرد'.",
        reply_markup=main_keyboard(),
    )
    ctx.user_data.clear()
    return MAIN_MENU

# ─────────────────────────────────────────
# نشر طلب على القناة
# ─────────────────────────────────────────

async def publish_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📡 *نشر طلب على القناة*\n\nأدخل رقم الطلب:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    ctx.user_data["publish_step"] = True
    return SEARCH_QUERY  # نعيد استخدام مرحلة الإدخال

async def publish_from_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """نشر من زر الطلب المعروض"""
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    req = fb_get_one(key)
    if not req:
        await query.edit_message_text("❌ الطلب غير موجود.")
        return MAIN_MENU
    req["firebaseKey"] = key
    await _do_publish(query.get_bot(), req, query)
    return MAIN_MENU

async def _do_publish(bot, req: dict, origin=None):
    """الدالة الفعلية للنشر على القناة"""
    post = format_channel_post(req)
    try:
        msg = await bot.send_message(CHANNEL_ID, post, parse_mode=ParseMode.MARKDOWN)

        # نشر الملفات المرفقة
        docs = req.get("documents", []) or []
        for doc in docs:
            fid = doc.get("file_id")
            ftype = doc.get("file_type", "photo")
            caption = f"📁 {doc.get('file_name','ملف')} — طلب رقم {req.get('reqId','')}"
            try:
                if ftype == "photo":
                    await bot.send_photo(CHANNEL_ID, fid, caption=caption)
                elif ftype == "document":
                    await bot.send_document(CHANNEL_ID, fid, caption=caption)
                elif ftype == "video":
                    await bot.send_video(CHANNEL_ID, fid, caption=caption)
            except Exception:
                pass

        result_text = f"✅ تم النشر على القناة بنجاح!\nرابط: {msg.link if hasattr(msg,'link') else '—'}"
    except Exception as e:
        result_text = f"❌ فشل النشر: {e}"

    if origin:
        try:
            await origin.edit_message_text(result_text)
        except Exception:
            await origin.message.reply_text(result_text)

# ─────────────────────────────────────────
# حذف طلب
# ─────────────────────────────────────────

async def delete_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data["del"] = {}
    await update.message.reply_text(
        "🗑 *حذف طلب*\n\nأدخل رقم الطلب:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("❌ إلغاء")]], resize_keyboard=True),
    )
    return DEL_CONFIRM

async def delete_req_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ إلغاء":
        return await cancel(update, ctx)
    req_id = update.message.text.strip()
    found = None
    found_key = None
    for key, v in fb_get_all().items():
        if str(v.get("reqId", "")) == req_id:
            found = v
            found_key = key
            break
    if not found:
        await update.message.reply_text(f"❌ لم يُعثر على طلب {req_id}.")
        return DEL_CONFIRM
    ctx.user_data["del"] = {"key": found_key, "req": found}
    await update.message.reply_text(
        f"⚠️ هل أنت متأكد من حذف الطلب:\n*{found.get('title','')}*؟\n\n(لا يمكن التراجع)",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🗑 نعم، احذف", callback_data="confirm_del:yes"),
                InlineKeyboardButton("❌ لا", callback_data="confirm_del:no"),
            ]
        ]),
    )
    return DEL_CONFIRM

async def delete_confirmed_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "confirm_del:no":
        await query.edit_message_text("❌ تم إلغاء الحذف.")
    else:
        key = ctx.user_data.get("del", {}).get("key")
        if key:
            fb_delete(key)
            await query.edit_message_text("✅ تم حذف الطلب بنجاح.")
    ctx.user_data.clear()
    await query.message.reply_text("القائمة:", reply_markup=main_keyboard())
    return MAIN_MENU

async def delete_from_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    req = fb_get_one(key)
    if not req:
        await query.edit_message_text("❌ الطلب غير موجود.")
        return MAIN_MENU
    ctx.user_data["del"] = {"key": key, "req": req}
    await query.edit_message_text(
        f"⚠️ هل أنت متأكد من حذف الطلب:\n*{req.get('title','')}*؟",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🗑 نعم، احذف", callback_data="confirm_del:yes"),
                InlineKeyboardButton("❌ لا",         callback_data="confirm_del:no"),
            ]
        ]),
    )
    return DEL_CONFIRM

# ─────────────────────────────────────────
# تعديل طلب
# ─────────────────────────────────────────

async def edit_from_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    req = fb_get_one(key)
    if not req:
        await query.edit_message_text("❌ الطلب غير موجود.")
        return MAIN_MENU
    ctx.user_data["edit"] = {"key": key, "req": req}
    fields_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("📌 الحالة",     callback_data="edit_field:status")],
        [InlineKeyboardButton("🏛 الجهة",      callback_data="edit_field:authority")],
        [InlineKeyboardButton("📝 التفاصيل",   callback_data="edit_field:details")],
        [InlineKeyboardButton("📅 التاريخ",    callback_data="edit_field:reqDate")],
        [InlineKeyboardButton("📋 العنوان",    callback_data="edit_field:title")],
        [InlineKeyboardButton("🔙 رجوع",       callback_data="back:main")],
    ])
    await query.edit_message_text(
        f"✏️ *تعديل الطلب #{req.get('reqId','')}*\n\nاختر الحقل:",
        reply_markup=fields_kb,
        parse_mode=ParseMode.MARKDOWN,
    )
    return EDIT_FIELD

async def edit_field_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    field = query.data.split(":", 1)[1]
    ctx.user_data["edit"]["field"] = field

    if field == "status":
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("⏳ قيد التنفيذ", callback_data="edit_val:execution")],
            [InlineKeyboardButton("✅ مكتمل",        callback_data="edit_val:completed")],
            [InlineKeyboardButton("💬 تم الرد",      callback_data="edit_val:replied")],
        ])
        await query.edit_message_text("اختر الحالة الجديدة:", reply_markup=kb)
        return EDIT_VALUE
    else:
        label_map = {
            "authority": "الجهة المختصة",
            "details":   "التفاصيل",
            "reqDate":   "التاريخ",
            "title":     "العنوان",
        }
        await query.message.reply_text(f"أدخل قيمة {label_map.get(field, field)} الجديدة:")
        return EDIT_VALUE

async def edit_value_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    edit = ctx.user_data.get("edit", {})
    key = edit.get("key")
    field = edit.get("field")
    if not key or not field:
        return MAIN_MENU
    fb_update(key, {field: update.message.text.strip()})
    await update.message.reply_text(f"✅ تم تحديث الحقل بنجاح.", reply_markup=main_keyboard())
    ctx.user_data.clear()
    return MAIN_MENU

async def edit_value_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    edit = ctx.user_data.get("edit", {})
    key = edit.get("key")
    new_val = query.data.split(":", 1)[1]
    fb_update(key, {"status": new_val})
    await query.edit_message_text(f"✅ تم تحديث الحالة إلى: {STATUS_MAP.get(new_val, new_val)}")
    await query.message.reply_text("القائمة:", reply_markup=main_keyboard())
    ctx.user_data.clear()
    return MAIN_MENU

# ─────────────────────────────────────────
# رجوع وإلغاء
# ─────────────────────────────────────────

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data.clear()
    await update.message.reply_text("❌ تم الإلغاء.", reply_markup=main_keyboard())
    return MAIN_MENU

async def back_main_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("تم الرجوع.")
    await query.message.reply_text("القائمة الرئيسية:", reply_markup=main_keyboard())
    return MAIN_MENU

# ─────────────────────────────────────────
# المُوزِّع الرئيسي للنصوص في MAIN_MENU
# ─────────────────────────────────────────

async def main_menu_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "➕ إضافة طلب":
        return await add_start(update, ctx)
    elif text == "🔍 بحث عن طلب":
        return await search_start(update, ctx)
    elif text == "📋 عرض الطلبات":
        return await list_requests(update, ctx)
    elif text == "📤 رفع ملف لطلب":
        return await upload_start(update, ctx)
    elif text == "💬 إضافة رد":
        return await reply_start(update, ctx)
    elif text == "📊 الإحصائيات":
        return await stats(update, ctx)
    elif text == "📡 نشر على القناة":
        return await publish_start(update, ctx)
    elif text == "🗑 حذف طلب":
        return await delete_start(update, ctx)
    else:
        await update.message.reply_text("اختر من القائمة.", reply_markup=main_keyboard())
        return MAIN_MENU

# ─────────────────────────────────────────
# تجميع وتشغيل البوت
# ─────────────────────────────────────────

def build_app():
    app = Application.builder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start", start),
            MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu_handler),
        ],
        states={
            MAIN_MENU: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu_handler),
                CallbackQueryHandler(view_request_cb,      pattern=r"^view:"),
                CallbackQueryHandler(edit_from_callback,   pattern=r"^edit:"),
                CallbackQueryHandler(delete_from_callback, pattern=r"^del:"),
                CallbackQueryHandler(publish_from_callback,pattern=r"^publish:"),
                CallbackQueryHandler(edit_from_callback,   pattern=r"^reply_from:"),
                CallbackQueryHandler(back_main_cb,         pattern=r"^back:main"),
            ],
            ADD_TITLE:  [MessageHandler(filters.TEXT & ~filters.COMMAND, add_title)],
            ADD_TYPE:   [MessageHandler(filters.TEXT & ~filters.COMMAND, add_type)],
            ADD_DATE:   [MessageHandler(filters.TEXT & ~filters.COMMAND, add_date)],
            ADD_AUTHORITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_authority)],
            ADD_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_details)],
            ADD_DOCS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, add_confirm),
                MessageHandler(filters.PHOTO | filters.Document.ALL | filters.VIDEO, add_docs_receive),
            ],
            ADD_CONFIRM: [
                CallbackQueryHandler(add_confirmed_cb, pattern=r"^confirm_add:"),
            ],
            SEARCH_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, search_execute)],
            EDIT_FIELD: [
                CallbackQueryHandler(edit_field_cb, pattern=r"^edit_field:"),
                CallbackQueryHandler(back_main_cb,  pattern=r"^back:main"),
            ],
            EDIT_VALUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, edit_value_text),
                CallbackQueryHandler(edit_value_cb, pattern=r"^edit_val:"),
            ],
            DEL_CONFIRM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, delete_req_id),
                CallbackQueryHandler(delete_confirmed_cb, pattern=r"^confirm_del:"),
            ],
            UPLOAD_REQ_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_req_id)],
            UPLOAD_FILE: [
                MessageHandler(filters.PHOTO | filters.Document.ALL | filters.VIDEO, upload_file_receive),
                MessageHandler(filters.TEXT & ~filters.COMMAND, lambda u, c: u.message.reply_text("أرسل ملفاً أو صورة.")),
            ],
            UPLOAD_CONFIRM: [
                CallbackQueryHandler(upload_confirmed_cb, pattern=r"^confirm_upload:"),
            ],
            REPLY_REQ_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, reply_req_id)],
            REPLY_TEXT:   [MessageHandler(filters.TEXT & ~filters.COMMAND, reply_text_receive)],
        },
        fallbacks=[CommandHandler("start", start)],
        allow_reentry=True,
    )

    app.add_handler(conv)
    return app


if __name__ == "__main__":
    logger.info("🚀 Starting Parliamentary Bot...")
    application = build_app()
    application.run_polling(drop_pending_updates=True)
