"""
بوت تليجرام احترافي - إدارة الطلبات البرلمانية
"""

import os
import json
import logging
import sys
from datetime import datetime
from threading import Thread
import http.server
import socketserver

import firebase_admin
from firebase_admin import credentials, db, storage

from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    ConversationHandler, CallbackQueryHandler
)
from telegram.constants import ParseMode

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ParliamentBot")

# ─────────────────────────────────────────
# متغيرات البيئة
# ─────────────────────────────────────────
BOT_TOKEN      = os.environ["BOT_TOKEN"]
PASSWORD       = os.getenv("BOT_PASSWORD", "521988")
FIREBASE_URL   = os.environ["FIREBASE_URL"]
FIREBASE_JSON  = os.environ["FIREBASE_CREDENTIALS_JSON"]
FIREBASE_PATH  = os.getenv("FIREBASE_PATH", "parliament-requests")
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "")  # اختياري لرفع الملفات

# ─────────────────────────────────────────
# حالات المحادثة
# ─────────────────────────────────────────
(
    WAIT_PASSWORD, MAIN_MENU, SEARCH_QUERY,
    EDIT_VALUE, ADD_TITLE, ADD_TYPE, ADD_AUTH, ADD_DETAILS, ADD_CONFIRM,
    UPLOAD_WAIT,
) = range(10)

# ─────────────────────────────────────────
# Firebase
# ─────────────────────────────────────────
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


# ─────────────────────────────────────────
# ثوابت العرض
# ─────────────────────────────────────────
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
    "special":  "🟣 طلب خاص",
    "general":  "🔵 طلب عام",
    "briefing": "🟠 طلب إحاطة",
    "urgent":   "🔴 بيان عاجل",
}


def fmt_date(s: str) -> str:
    if not s:
        return "غير محدد"
    try:
        d = datetime.strptime(str(s)[:10], "%Y-%m-%d")
        return f"{d.day} {MONTHS_AR[d.month - 1]} {d.year}"
    except Exception:
        return str(s)


def format_req(r: dict, short: bool = False) -> str:
    s     = STATUS.get(r.get("status", ""), r.get("status", "غير محدد"))
    rtype = REQ_TYPE.get(r.get("requestType", ""), r.get("requestType", "غير محدد"))
    has_docs = "📎 نعم" if r.get("hasDocuments") else "لا"
    lines = [
        f"📌 *رقم الطلب:* {r.get('reqId', '—')}",
        f"🗂️ *النوع:* {rtype}",
        f"📝 *العنوان:* {r.get('title', '—')}",
        f"🏛️ *الجهة:* {r.get('authority', '—')}",
        f"📅 *التاريخ:* {fmt_date(r.get('reqDate', ''))}",
        f"🔖 *الحالة:* {s}",
        f"📎 *مستندات:* {has_docs}",
    ]
    if not short and r.get("details"):
        lines.append(f"\n📄 *التفاصيل:*\n{r['details'][:800]}")
    return "\n".join(lines)


def build_stats() -> str:
    reqs  = get_all()
    total = len(reqs)
    by_status: dict = {}
    by_type:   dict = {}
    for r in reqs:
        st = r.get("status", "?")
        rt = r.get("requestType", "?")
        by_status[st] = by_status.get(st, 0) + 1
        by_type[rt]   = by_type.get(rt, 0) + 1

    lines = [
        "📊 *إحصائيات الطلبات*\n",
        f"🔢 الإجمالي: *{total} طلب*\n",
        "*📋 حسب الحالة:*",
    ]
    for k, v in by_status.items():
        pct = round(v / total * 100) if total else 0
        lines.append(f"  {STATUS.get(k, k)}: *{v}* ({pct}%)")
    lines.append("\n*🗂️ حسب النوع:*")
    for k, v in by_type.items():
        pct = round(v / total * 100) if total else 0
        lines.append(f"  {REQ_TYPE.get(k, k)}: *{v}* ({pct}%)")
    return "\n".join(lines)


# ─────────────────────────────────────────
# لوحات المفاتيح
# ─────────────────────────────────────────
def main_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔍 بحث",        callback_data="search"),
            InlineKeyboardButton("📊 إحصائيات",   callback_data="stats"),
        ],
        [
            InlineKeyboardButton("📋 كل الطلبات", callback_data="list_all"),
            InlineKeyboardButton("🔽 فلترة",       callback_data="filter"),
        ],
        [
            InlineKeyboardButton("➕ إضافة طلب",  callback_data="add"),
        ],
    ])


def req_kb(key: str) -> InlineKeyboardMarkup:
    """لوحة مفاتيح الطلب الواحد — تحتوي على الزرين الجديدين"""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📄 عرض الطلب كامل",   callback_data=f"view_full:{key}"),
            InlineKeyboardButton("📎 المستندات المرفقة", callback_data=f"view_docs:{key}"),
        ],
        [
            InlineKeyboardButton("✏️ تعديل الحالة",     callback_data=f"edit_status:{key}"),
            InlineKeyboardButton("✏️ تعديل العنوان",    callback_data=f"edit_title:{key}"),
        ],
        [
            InlineKeyboardButton("📤 رفع مستند",        callback_data=f"upload_doc:{key}"),
            InlineKeyboardButton("🗑️ حذف",              callback_data=f"delete:{key}"),
        ],
        [
            InlineKeyboardButton("🏠 القائمة",           callback_data="home"),
        ],
    ])


def status_kb(key: str = "") -> InlineKeyboardMarkup:
    prefix  = f"setstatus:{key}:" if key else "filter_status:"
    buttons = [[InlineKeyboardButton(v, callback_data=f"{prefix}{k}")] for k, v in STATUS.items()]
    buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="home")])
    return InlineKeyboardMarkup(buttons)


def type_kb(prefix: str = "filter_type:") -> InlineKeyboardMarkup:
    buttons = [[InlineKeyboardButton(v, callback_data=f"{prefix}{k}")] for k, v in REQ_TYPE.items()]
    buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="home")])
    return InlineKeyboardMarkup(buttons)


# ─────────────────────────────────────────
# مساعد الإرسال
# ─────────────────────────────────────────
async def send(update, text: str, kb=None, edit: bool = False) -> None:
    kw = {"parse_mode": ParseMode.MARKDOWN, "reply_markup": kb}
    if edit and update.callback_query:
        try:
            await update.callback_query.edit_message_text(text, **kw)
            return
        except Exception:
            pass
    target = update.callback_query.message if update.callback_query else update.message
    await target.reply_text(text, **kw)


# ─────────────────────────────────────────
# المصادقة
# ─────────────────────────────────────────
def check_auth(ctx, uid: int) -> bool:
    return uid in ctx.bot_data.get("auth", set())


def set_auth(ctx, uid: int) -> None:
    ctx.bot_data.setdefault("auth", set()).add(uid)
    logger.info(f"User {uid} authenticated")


# ─────────────────────────────────────────
# /start  /help  /stats  /logout  /upload
# ─────────────────────────────────────────
async def cmd_start(update, ctx) -> int:
    uid = update.effective_user.id
    if check_auth(ctx, uid):
        await send(update, "🏠 *القائمة الرئيسية*", main_kb())
        return MAIN_MENU
    name = update.effective_user.first_name or "مستخدم"
    await send(update, f"👋 مرحباً *{name}*\n\n🔐 أدخل كلمة المرور:")
    return WAIT_PASSWORD


async def cmd_help(update, ctx) -> None:
    text = (
        "📖 *تعليمات الاستخدام*\n\n"
        "• /start — القائمة الرئيسية\n"
        "• /stats — إحصائيات سريعة\n"
        "• /upload [رقم الطلب] — رفع مستند لطلب\n"
        "• /logout — تسجيل الخروج\n"
        "• /help — هذه الرسالة\n\n"
        "_مثال: /upload 68 ثم أرسل الملف_"
    )
    await send(update, text)


async def cmd_stats(update, ctx) -> int:
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 سجّل دخولك أولاً. أرسل /start")
        return WAIT_PASSWORD
    await send(update, build_stats(),
               InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]))
    return MAIN_MENU


async def cmd_logout(update, ctx) -> int:
    ctx.bot_data.get("auth", set()).discard(update.effective_user.id)
    await send(update, "✅ تم تسجيل الخروج. أرسل /start للعودة.")
    return WAIT_PASSWORD


async def cmd_upload(update, ctx) -> int:
    """رفع مستند عبر الأمر: /upload 68"""
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 سجّل دخولك أولاً. أرسل /start")
        return WAIT_PASSWORD

    args = ctx.args
    if not args:
        await send(update,
            "📤 *رفع مستند*\n\n"
            "استخدم الأمر مع رقم الطلب:\n"
            "`/upload 68`\n\n"
            "أو اضغط زر *📤 رفع مستند* من داخل الطلب.")
        return MAIN_MENU

    req_id = args[0].strip()
    # ابحث عن الطلب بالرقم
    reqs = get_all()
    match = next((r for r in reqs if str(r.get("reqId", "")) == req_id), None)
    if not match:
        await send(update, f"❌ لم يُعثر على طلب رقم *{req_id}*.")
        return MAIN_MENU

    ctx.user_data["upload_key"]    = match["firebaseKey"]
    ctx.user_data["upload_req_id"] = req_id
    await send(update,
        f"📤 *رفع مستند للطلب رقم {req_id}*\n\n"
        "أرسل الملف الآن (PDF، صورة، Word، أي نوع)\n"
        "أو أرسل `/cancel` للإلغاء.")
    return UPLOAD_WAIT


# ─────────────────────────────────────────
# كلمة المرور
# ─────────────────────────────────────────
async def check_password(update, ctx) -> int:
    uid  = update.effective_user.id
    text = update.message.text.strip()
    try:
        await update.message.delete()
    except Exception:
        pass
    if text == PASSWORD:
        set_auth(ctx, uid)
        await update.effective_chat.send_message(
            "✅ *تم تسجيل الدخول بنجاح*\n\n🏠 القائمة الرئيسية:",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=main_kb()
        )
        return MAIN_MENU
    await update.effective_chat.send_message("❌ كلمة المرور غير صحيحة. حاول مرة أخرى:")
    return WAIT_PASSWORD


# ─────────────────────────────────────────
# Callback الرئيسي
# ─────────────────────────────────────────
async def main_cb(update, ctx) -> int:
    q    = update.callback_query
    data = q.data
    await q.answer()

    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 انتهت جلستك. أرسل /start", edit=True)
        return WAIT_PASSWORD

    # ── بحث ──────────────────────────────────
    if data == "search":
        await send(update, "🔍 أرسل كلمة البحث أو رقم الطلب:", edit=True)
        return SEARCH_QUERY

    # ── إحصائيات ─────────────────────────────
    elif data == "stats":
        await send(update, build_stats(),
                   InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]),
                   edit=True)
        return MAIN_MENU

    # ── كل الطلبات ───────────────────────────
    elif data == "list_all":
        reqs = sorted(get_all(), key=lambda x: int(x.get("reqId", "0") or 0))
        if not reqs:
            await send(update,
                "⚠️ *لا توجد طلبات*\n\n"
                "تأكد من متغير `FIREBASE_PATH` في Secrets.",
                InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]),
                edit=True)
            return MAIN_MENU
        await q.message.reply_text(
            f"📋 إجمالي الطلبات: *{len(reqs)}*\n_(يُعرض آخر 10)_",
            parse_mode=ParseMode.MARKDOWN)
        for r in reqs[-10:]:
            await q.message.reply_text(
                format_req(r, short=True),
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    # ── فلترة ────────────────────────────────
    elif data == "filter":
        await send(update, "اختر نوع الفلتر:",
                   InlineKeyboardMarkup([
                       [InlineKeyboardButton("🔖 بالحالة",  callback_data="filter_by_status")],
                       [InlineKeyboardButton("🗂️ بالنوع",  callback_data="filter_by_type")],
                       [InlineKeyboardButton("🏠 القائمة", callback_data="home")],
                   ]), edit=True)
        return MAIN_MENU

    elif data == "filter_by_status":
        await send(update, "اختر الحالة:", status_kb(), edit=True)
        return MAIN_MENU

    elif data == "filter_by_type":
        await send(update, "اختر النوع:", type_kb(), edit=True)
        return MAIN_MENU

    elif data.startswith("filter_status:"):
        st   = data.split(":")[1]
        reqs = sorted([r for r in get_all() if r.get("status") == st],
                      key=lambda x: int(x.get("reqId", "0") or 0))
        label = STATUS.get(st, st)
        if not reqs:
            await send(update, f"لا توجد طلبات بحالة: {label}", main_kb(), edit=True)
            return MAIN_MENU
        await q.message.reply_text(f"{label}: *{len(reqs)}* طلب", parse_mode=ParseMode.MARKDOWN)
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True),
                                       parse_mode=ParseMode.MARKDOWN,
                                       reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    elif data.startswith("filter_type:"):
        rt   = data.split(":")[1]
        reqs = sorted([r for r in get_all() if r.get("requestType") == rt],
                      key=lambda x: int(x.get("reqId", "0") or 0))
        label = REQ_TYPE.get(rt, rt)
        if not reqs:
            await send(update, f"لا توجد طلبات من نوع: {label}", main_kb(), edit=True)
            return MAIN_MENU
        await q.message.reply_text(f"{label}: *{len(reqs)}* طلب", parse_mode=ParseMode.MARKDOWN)
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True),
                                       parse_mode=ParseMode.MARKDOWN,
                                       reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    # ── إضافة طلب ────────────────────────────
    elif data == "add":
        ctx.user_data["new_req"] = {}
        await send(update, "📝 أدخل *عنوان* الطلب:", edit=True)
        return ADD_TITLE

    # ── عرض الطلب كامل ───────────────────────
    elif data.startswith("view_full:"):
        key = data.split(":")[1]
        r   = get_req(key)
        if not r:
            await send(update, "❌ لم يُعثر على الطلب.", main_kb(), edit=True)
            return MAIN_MENU
        await send(update, format_req(r, short=False), req_kb(key), edit=True)
        return MAIN_MENU

    # ── عرض المستندات المرفقة ────────────────
    elif data.startswith("view_docs:"):
        key    = data.split(":")[1]
        r      = get_req(key)
        if not r:
            await send(update, "❌ لم يُعثر على الطلب.", main_kb(), edit=True)
            return MAIN_MENU
        req_id = r.get("reqId", "—")
        docs   = r.get("documents") or []
        if isinstance(docs, dict):
            docs = list(docs.values())

        back_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📤 رفع مستند جديد", callback_data=f"upload_doc:{key}")],
            [InlineKeyboardButton("🔙 رجوع للطلب",     callback_data=f"view_full:{key}"),
             InlineKeyboardButton("🏠 القائمة",         callback_data="home")],
        ])

        if not docs:
            await send(update,
                f"📎 *مستندات الطلب رقم {req_id}*\n\nلا توجد مستندات مرفقة بعد.",
                back_kb, edit=True)
            return MAIN_MENU

        lines = [f"📎 *مستندات الطلب رقم {req_id}* ({len(docs)} مستند)\n"]
        for i, doc in enumerate(docs, 1):
            if isinstance(doc, dict):
                name     = doc.get("name", f"مستند {i}")
                url      = doc.get("url", "")
                date     = doc.get("date", "")
                doc_type = doc.get("type", "")
                line = f"{i}. *{name}*"
                if doc_type:
                    line += f" ({doc_type})"
                if date:
                    line += f" — {date}"
                if url:
                    line += f"\n    🔗 [فتح الملف]({url})"
                lines.append(line)
            else:
                lines.append(f"{i}. {doc}")

        await send(update, "\n".join(lines), back_kb, edit=True)
        return MAIN_MENU

    # ── رفع مستند (من زر الطلب) ──────────────
    elif data.startswith("upload_doc:"):
        key = data.split(":")[1]
        r   = get_req(key)
        if not r:
            await send(update, "❌ لم يُعثر على الطلب.", main_kb(), edit=True)
            return MAIN_MENU
        ctx.user_data["upload_key"]    = key
        ctx.user_data["upload_req_id"] = r.get("reqId", "—")
        await send(update,
            f"📤 *رفع مستند للطلب رقم {r.get('reqId', '—')}*\n\n"
            "أرسل الملف الآن:\n"
            "• PDF 📄\n• صورة 🖼️\n• Word / Excel 📊\n• أي ملف آخر 📁\n\n"
            "_أرسل /cancel للإلغاء_",
            edit=True)
        return UPLOAD_WAIT

    # ── تعديل الحالة ─────────────────────────
    elif data.startswith("edit_status:"):
        key = data.split(":")[1]
        await send(update, "اختر الحالة الجديدة:", status_kb(key), edit=True)
        return MAIN_MENU

    elif data.startswith("setstatus:"):
        parts   = data.split(":")
        key, st = parts[1], parts[2]
        ok  = update_req(key, "status", st)
        msg = f"✅ تم تحديث الحالة إلى: {STATUS.get(st, st)}" if ok else "❌ فشل التحديث."
        await send(update, msg, main_kb(), edit=True)
        return MAIN_MENU

    # ── تعديل العنوان ────────────────────────
    elif data.startswith("edit_title:"):
        key = data.split(":")[1]
        ctx.user_data["edit_key"]   = key
        ctx.user_data["edit_field"] = "title"
        await send(update, "✏️ أدخل العنوان الجديد:", edit=True)
        return EDIT_VALUE

    # ── حذف ──────────────────────────────────
    elif data.startswith("delete:"):
        key = data.split(":")[1]
        r   = get_req(key)
        txt = f"⚠️ *هل تريد حذف هذا الطلب؟*\n\n📝 {r.get('title', key) if r else key}"
        await send(update, txt,
                   InlineKeyboardMarkup([
                       [InlineKeyboardButton("✅ نعم، احذف",  callback_data=f"confirm_delete:{key}"),
                        InlineKeyboardButton("❌ إلغاء",       callback_data="home")],
                   ]), edit=True)
        return MAIN_MENU

    elif data.startswith("confirm_delete:"):
        key = data.split(":")[1]
        ok  = delete_req(key)
        msg = "🗑️ تم حذف الطلب بنجاح." if ok else "❌ فشل الحذف."
        await send(update, msg, main_kb(), edit=True)
        return MAIN_MENU

    # ── الرئيسية ─────────────────────────────
    elif data == "home":
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
        return MAIN_MENU

    return MAIN_MENU


# ─────────────────────────────────────────
# استقبال الملف المرفوع
# ─────────────────────────────────────────
async def handle_upload(update, ctx) -> int:
    """استقبال أي ملف (document / photo / video) وحفظ معلوماته في Firebase"""
    msg = update.message

    # إلغاء
    if msg.text and msg.text.strip().lower() in ["/cancel", "إلغاء"]:
        ctx.user_data.pop("upload_key", None)
        ctx.user_data.pop("upload_req_id", None)
        await msg.reply_text("❌ تم إلغاء الرفع.", reply_markup=main_kb())
        return MAIN_MENU

    key    = ctx.user_data.get("upload_key")
    req_id = ctx.user_data.get("upload_req_id", "—")

    if not key:
        await msg.reply_text("❌ حدث خطأ. ابدأ من جديد.", reply_markup=main_kb())
        return MAIN_MENU

    # تحديد نوع الملف
    file_obj  = None
    file_name = "مستند"
    file_type = "ملف"

    if msg.document:
        file_obj  = msg.document
        file_name = msg.document.file_name or "مستند"
        ext       = file_name.rsplit(".", 1)[-1].upper() if "." in file_name else "FILE"
        file_type = ext
    elif msg.photo:
        file_obj  = msg.photo[-1]  # أعلى دقة
        file_name = f"صورة_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        file_type = "صورة"
    elif msg.video:
        file_obj  = msg.video
        file_name = msg.video.file_name or f"فيديو_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        file_type = "فيديو"
    elif msg.audio:
        file_obj  = msg.audio
        file_name = msg.audio.file_name or "ملف صوتي"
        file_type = "صوت"
    else:
        await msg.reply_text(
            "⚠️ الرجاء إرسال ملف (PDF، صورة، Word...)\nأو /cancel للإلغاء.")
        return UPLOAD_WAIT

    # احصل على رابط الملف من تليجرام
    try:
        tg_file  = await file_obj.get_file()
        file_url = tg_file.file_path  # رابط تليجرام المباشر
    except Exception as e:
        logger.error(f"get_file error: {e}")
        await msg.reply_text("❌ فشل في الحصول على الملف. حاول مرة أخرى.")
        return UPLOAD_WAIT

    # احفظ المعلومات في Firebase
    doc_info = {
        "name":    file_name,
        "type":    file_type,
        "url":     file_url,
        "file_id": file_obj.file_id,
        "date":    datetime.now().strftime("%Y-%m-%d %H:%M"),
        "added_by": update.effective_user.id,
    }

    ok = add_document_to_req(key, doc_info)

    if ok:
        await msg.reply_text(
            f"✅ *تم رفع المستند بنجاح*\n\n"
            f"📄 *الاسم:* {file_name}\n"
            f"🗂️ *النوع:* {file_type}\n"
            f"📌 *الطلب رقم:* {req_id}",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📎 عرض مستندات الطلب", callback_data=f"view_docs:{key}")],
                [InlineKeyboardButton("🏠 القائمة",            callback_data="home")],
            ])
        )
    else:
        await msg.reply_text("❌ فشل حفظ المستند في قاعدة البيانات.", reply_markup=main_kb())

    ctx.user_data.pop("upload_key", None)
    ctx.user_data.pop("upload_req_id", None)
    return MAIN_MENU


# ─────────────────────────────────────────
# البحث
# ─────────────────────────────────────────
async def do_search(update, ctx) -> int:
    q     = update.message.text.strip().lower()
    reqs  = get_all()
    found = [
        r for r in reqs
        if q in " ".join(filter(None, [
            str(r.get("reqId", "")),
            r.get("title", ""),
            r.get("authority", ""),
            r.get("details", ""),
            r.get("status", ""),
        ])).lower()
    ]
    if not found:
        await update.message.reply_text(
            f"🔍 لا توجد نتائج لـ *{q}*",
            parse_mode=ParseMode.MARKDOWN, reply_markup=main_kb())
        return MAIN_MENU
    await update.message.reply_text(
        f"🔍 وُجد *{len(found)}* نتيجة:", parse_mode=ParseMode.MARKDOWN)
    for r in found[:10]:
        await update.message.reply_text(
            format_req(r, short=True),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=req_kb(r["firebaseKey"]))
    await update.message.reply_text("🏠", reply_markup=main_kb())
    return MAIN_MENU


# ─────────────────────────────────────────
# تعديل القيمة
# ─────────────────────────────────────────
async def do_edit_value(update, ctx) -> int:
    key   = ctx.user_data.get("edit_key")
    field = ctx.user_data.get("edit_field", "title")
    if key:
        ok  = update_req(key, field, update.message.text.strip())
        msg = "✅ تم التحديث بنجاح." if ok else "❌ فشل التحديث."
        await update.message.reply_text(msg, reply_markup=main_kb())
    ctx.user_data.pop("edit_key", None)
    ctx.user_data.pop("edit_field", None)
    return MAIN_MENU


# ─────────────────────────────────────────
# إضافة طلب
# ─────────────────────────────────────────
async def add_title(update, ctx) -> int:
    ctx.user_data["new_req"]["title"] = update.message.text.strip()
    await update.message.reply_text(
        "🗂️ اختر *نوع* الطلب:",
        parse_mode=ParseMode.MARKDOWN, reply_markup=type_kb("add_type:"))
    return ADD_TYPE


async def add_type_cb(update, ctx) -> int:
    q = update.callback_query
    await q.answer()
    ctx.user_data["new_req"]["requestType"] = q.data.split(":")[1]
    await q.message.reply_text("🏛️ أدخل *الجهة* المعنية:", parse_mode=ParseMode.MARKDOWN)
    return ADD_AUTH


async def add_auth(update, ctx) -> int:
    ctx.user_data["new_req"]["authority"] = update.message.text.strip()
    await update.message.reply_text(
        "📄 أدخل *التفاصيل* (أو أرسل `-` للتخطي):",
        parse_mode=ParseMode.MARKDOWN)
    return ADD_DETAILS


async def add_details(update, ctx) -> int:
    val = update.message.text.strip()
    ctx.user_data["new_req"]["details"] = "" if val == "-" else val
    req = ctx.user_data["new_req"]
    summary = (
        f"📋 *ملخص الطلب الجديد:*\n\n"
        f"📝 *العنوان:* {req.get('title')}\n"
        f"🗂️ *النوع:* {REQ_TYPE.get(req.get('requestType',''),'—')}\n"
        f"🏛️ *الجهة:* {req.get('authority')}\n"
        f"📄 *التفاصيل:* {req.get('details','—')[:200]}\n\n"
        "هل تريد الحفظ؟"
    )
    await update.message.reply_text(
        summary, parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ حفظ",  callback_data="confirm_add"),
             InlineKeyboardButton("❌ إلغاء", callback_data="home")],
        ]))
    return ADD_CONFIRM


async def confirm_add(update, ctx) -> int:
    q = update.callback_query
    await q.answer()
    if q.data == "confirm_add":
        reqs   = get_all()
        max_id = max((int(r.get("reqId", "0") or 0) for r in reqs), default=0)
        req    = ctx.user_data.get("new_req", {})
        req.update({
            "reqId":        str(max_id + 1),
            "status":       "execution",
            "reqDate":      datetime.now().strftime("%Y-%m-%d"),
            "hasDocuments": False,
            "documents":    [],
            "createdBy":    update.effective_user.id,
        })
        ok  = add_req(req)
        msg = f"✅ تم إضافة الطلب رقم *{req['reqId']}* بنجاح." if ok else "❌ فشل الحفظ."
        await send(update, msg, main_kb(), edit=True)
    else:
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
    ctx.user_data.pop("new_req", None)
    return MAIN_MENU


# ─────────────────────────────────────────
# Fallback
# ─────────────────────────────────────────
async def fallback(update, ctx) -> int:
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    await send(update, "🏠 *القائمة الرئيسية*", main_kb())
    return MAIN_MENU


# ─────────────────────────────────────────
# تسجيل أوامر البوت
# ─────────────────────────────────────────
async def post_init(application) -> None:
    await application.bot.set_my_commands([
        BotCommand("start",  "🏠 القائمة الرئيسية"),
        BotCommand("stats",  "📊 إحصائيات الطلبات"),
        BotCommand("upload", "📤 رفع مستند لطلب"),
        BotCommand("logout", "🚪 تسجيل الخروج"),
        BotCommand("help",   "📖 المساعدة"),
    ])
    logger.info("✅ Bot commands registered")


# ─────────────────────────────────────────
# main
# ─────────────────────────────────────────
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
    logger.info(f"🌐 Health-check server on port {port}")

    init_firebase()

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    # فلتر الملفات لحالة UPLOAD_WAIT
    file_filter = (
        filters.Document.ALL |
        filters.PHOTO |
        filters.VIDEO |
        filters.AUDIO
    )

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start",  cmd_start),
            CommandHandler("stats",  cmd_stats),
            CommandHandler("logout", cmd_logout),
            CommandHandler("upload", cmd_upload),
            CommandHandler("help",   cmd_help),
        ],
        states={
            WAIT_PASSWORD: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, check_password)
            ],
            MAIN_MENU: [
                CallbackQueryHandler(main_cb),
                MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
            ],
            SEARCH_QUERY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, do_search)
            ],
            EDIT_VALUE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, do_edit_value)
            ],
            ADD_TITLE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, add_title)
            ],
            ADD_TYPE: [
                CallbackQueryHandler(add_type_cb, pattern="^add_type:")
            ],
            ADD_AUTH: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, add_auth)
            ],
            ADD_DETAILS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, add_details)
            ],
            ADD_CONFIRM: [
                CallbackQueryHandler(confirm_add, pattern="^(confirm_add|home)$")
            ],
            UPLOAD_WAIT: [
                MessageHandler(file_filter, handle_upload),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_upload),
                CommandHandler("cancel", handle_upload),
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

    logger.info("🚀 Bot started — polling for updates...")
    app.run_polling(
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    main()
