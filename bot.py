"""
بوت تليجرام احترافي - إدارة الطلبات البرلمانية
يعمل على Render / Railway / VPS مع uptime مستمر
"""

import os
import json
import logging
import signal
import sys
from datetime import datetime
from threading import Thread

import firebase_admin
from firebase_admin import credentials, db

from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    ConversationHandler, CallbackQueryHandler
)
from telegram.constants import ParseMode

# ─────────────────────────────────────────
# Logging احترافي
# ─────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("ParliamentBot")

# ─────────────────────────────────────────
# متغيرات البيئة
# ─────────────────────────────────────────
BOT_TOKEN    = os.environ["BOT_TOKEN"]
PASSWORD     = os.getenv("BOT_PASSWORD", "521988")
FIREBASE_URL = os.environ["FIREBASE_URL"]
FIREBASE_JSON = os.environ["FIREBASE_CREDENTIALS_JSON"]

# ⚠️ تأكد أن هذا هو المسار الصحيح لبياناتك في Firebase
# افتح Firebase Console وتحقق من اسم المسار الفعلي
FIREBASE_PATH = os.getenv("FIREBASE_PATH", "parliament-requests")

# المشرفون الذين يُسمح لهم بالوصول (Telegram user IDs)
# يمكن تركها فارغة للسماح لأي شخص يعرف كلمة السر
ADMIN_IDS: set[int] = set(
    int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
)

# ─────────────────────────────────────────
# حالات المحادثة
# ─────────────────────────────────────────
(
    WAIT_PASSWORD, MAIN_MENU, SEARCH_QUERY,
    EDIT_VALUE, ADD_TITLE, ADD_TYPE, ADD_AUTH, ADD_DETAILS, ADD_CONFIRM,
) = range(9)

# ─────────────────────────────────────────
# Firebase
# ─────────────────────────────────────────
def init_firebase() -> None:
    """تهيئة Firebase مرة واحدة فقط"""
    if firebase_admin._apps:
        return
    try:
        cred_data = json.loads(FIREBASE_JSON)
        cred = credentials.Certificate(cred_data)
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_URL})
        logger.info("✅ Firebase initialized successfully")
    except Exception as e:
        logger.critical(f"❌ Firebase init failed: {e}")
        raise


def get_all() -> list[dict]:
    """جلب كل الطلبات من Firebase"""
    try:
        data = db.reference(FIREBASE_PATH).get()
        if not data:
            logger.warning(f"⚠️ No data found at path: '{FIREBASE_PATH}' — check FIREBASE_PATH env var")
            return []
        if isinstance(data, dict):
            return [{"firebaseKey": k, **v} for k, v in data.items() if isinstance(v, dict)]
        logger.warning(f"⚠️ Unexpected data type at '{FIREBASE_PATH}': {type(data)}")
        return []
    except Exception as e:
        logger.error(f"get_all error: {e}")
        return []


def get_req(key: str) -> dict | None:
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
    lines = [
        f"📌 *رقم الطلب:* {r.get('reqId', '—')}",
        f"🗂️ *النوع:* {rtype}",
        f"📝 *العنوان:* {r.get('title', '—')}",
        f"🏛️ *الجهة:* {r.get('authority', '—')}",
        f"📅 *التاريخ:* {fmt_date(r.get('reqDate', ''))}",
        f"🔖 *الحالة:* {s}",
    ]
    if not short and r.get("details"):
        lines.append(f"\n📄 *التفاصيل:*\n{r['details'][:600]}")
    return "\n".join(lines)


def build_stats() -> str:
    reqs = get_all()
    total = len(reqs)
    by_status: dict[str, int] = {}
    by_type:   dict[str, int] = {}
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
        label = STATUS.get(k, k)
        pct   = round(v / total * 100) if total else 0
        lines.append(f"  {label}: *{v}* ({pct}%)")

    lines.append("\n*🗂️ حسب النوع:*")
    for k, v in by_type.items():
        label = REQ_TYPE.get(k, k)
        pct   = round(v / total * 100) if total else 0
        lines.append(f"  {label}: *{v}* ({pct}%)")

    return "\n".join(lines)


# ─────────────────────────────────────────
# لوحات المفاتيح
# ─────────────────────────────────────────
def main_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔍 بحث",          callback_data="search"),
            InlineKeyboardButton("📊 إحصائيات",     callback_data="stats"),
        ],
        [
            InlineKeyboardButton("📋 كل الطلبات",   callback_data="list_all"),
            InlineKeyboardButton("🔽 فلترة",         callback_data="filter"),
        ],
        [
            InlineKeyboardButton("➕ إضافة طلب",    callback_data="add"),
        ],
    ])


def req_kb(key: str) -> InlineKeyboardMarkup:
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
            InlineKeyboardButton("🗑️ حذف",              callback_data=f"delete:{key}"),
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
    """إرسال أو تعديل رسالة بدعم Markdown"""
    kw: dict = {"parse_mode": ParseMode.MARKDOWN, "reply_markup": kb}
    if edit and update.callback_query:
        try:
            await update.callback_query.edit_message_text(text, **kw)
            return
        except Exception:
            pass  # إذا فشل التعديل نرسل رسالة جديدة
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
# /start و /help
# ─────────────────────────────────────────
async def cmd_start(update, ctx) -> int:
    uid = update.effective_user.id
    if check_auth(ctx, uid):
        await send(update, "🏠 *القائمة الرئيسية*", main_kb())
        return MAIN_MENU

    name = update.effective_user.first_name or "مستخدم"
    await send(update, f"👋 مرحباً *{name}*\n\n🔐 أدخل كلمة المرور للوصول:")
    return WAIT_PASSWORD


async def cmd_help(update, ctx) -> None:
    text = (
        "📖 *تعليمات الاستخدام*\n\n"
        "• /start — بدء البوت أو العودة للقائمة\n"
        "• /stats — إحصائيات سريعة\n"
        "• /search [كلمة] — بحث مباشر\n"
        "• /logout — تسجيل الخروج\n\n"
        "_جميع البيانات متزامنة مع Firebase في الوقت الفعلي._"
    )
    await send(update, text)


async def cmd_stats(update, ctx) -> int:
    if not check_auth(ctx, update.effective_user.id):
        await send(update, "🔐 سجّل دخولك أولاً. أرسل /start")
        return WAIT_PASSWORD
    await send(update, build_stats(), InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]))
    return MAIN_MENU


async def cmd_logout(update, ctx) -> int:
    uid = update.effective_user.id
    ctx.bot_data.get("auth", set()).discard(uid)
    await send(update, "✅ تم تسجيل الخروج. أرسل /start للعودة.")
    return WAIT_PASSWORD


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

    uid = update.effective_user.id
    if not check_auth(ctx, uid):
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
                "تأكد من:\n"
                "1️⃣ متغير `FIREBASE_PATH` صحيح\n"
                "2️⃣ قاعدة البيانات تحتوي على بيانات\n"
                "3️⃣ صلاحيات Firebase Rules",
                InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]),
                edit=True)
            return MAIN_MENU

        await q.message.reply_text(
            f"📋 إجمالي الطلبات: *{len(reqs)}*\n_(يُعرض آخر 10)_",
            parse_mode=ParseMode.MARKDOWN
        )
        for r in reqs[-10:]:
            await q.message.reply_text(
                format_req(r, short=True),
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=req_kb(r["firebaseKey"])
            )
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
        reqs = sorted(
            [r for r in get_all() if r.get("status") == st],
            key=lambda x: int(x.get("reqId", "0") or 0)
        )
        label = STATUS.get(st, st)
        if not reqs:
            await send(update, f"لا توجد طلبات بحالة: {label}", main_kb(), edit=True)
            return MAIN_MENU
        await q.message.reply_text(f"{label}: *{len(reqs)}* طلب", parse_mode=ParseMode.MARKDOWN)
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True), parse_mode=ParseMode.MARKDOWN, reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    elif data.startswith("filter_type:"):
        rt   = data.split(":")[1]
        reqs = sorted(
            [r for r in get_all() if r.get("requestType") == rt],
            key=lambda x: int(x.get("reqId", "0") or 0)
        )
        label = REQ_TYPE.get(rt, rt)
        if not reqs:
            await send(update, f"لا توجد طلبات من نوع: {label}", main_kb(), edit=True)
            return MAIN_MENU
        await q.message.reply_text(f"{label}: *{len(reqs)}* طلب", parse_mode=ParseMode.MARKDOWN)
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True), parse_mode=ParseMode.MARKDOWN, reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    # ── إضافة طلب ────────────────────────────
    elif data == "add":
        ctx.user_data["new_req"] = {}
        await send(update, "📝 أدخل *عنوان* الطلب:", edit=True)
        return ADD_TITLE

    # ── عرض الطلب كامل ──────────────────────
    elif data.startswith("view_full:"):
        key = data.split(":")[1]
        r   = get_req(key)
        if not r:
            await send(update, "❌ لم يُعثر على الطلب.", main_kb(), edit=True)
            return MAIN_MENU
        text = format_req(r, short=False)
        back_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📎 المستندات", callback_data=f"view_docs:{key}"),
             InlineKeyboardButton("🔙 رجوع",      callback_data="home")],
        ])
        await send(update, text, back_kb, edit=True)
        return MAIN_MENU

    # ── عرض المستندات المرفقة ────────────────
    elif data.startswith("view_docs:"):
        key  = data.split(":")[1]
        r    = get_req(key)
        if not r:
            await send(update, "❌ لم يُعثر على الطلب.", main_kb(), edit=True)
            return MAIN_MENU
        req_id  = r.get("reqId", "—")
        docs    = r.get("documents") or r.get("attachments") or []
        back_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📄 عرض الطلب", callback_data=f"view_full:{key}"),
             InlineKeyboardButton("🔙 رجوع",       callback_data="home")],
        ])
        header = f"📎 *مستندات الطلب رقم {req_id}*\n"
        if not docs and not r.get("hasDocuments"):
            await send(update, header + "\nلا توجد مستندات مرفقة بهذا الطلب.", back_kb, edit=True)
            return MAIN_MENU
        if isinstance(docs, list) and docs:
            lines = [header]
            for i, doc in enumerate(docs, 1):
                if isinstance(doc, str):
                    lines.append(f"{i}. {doc}")
                elif isinstance(doc, dict):
                    name = doc.get("name", f"مستند {i}")
                    url  = doc.get("url", "")
                    lines.append(f"{i}. [{name}]({url})" if url else f"{i}. {name}")
            await send(update, "\n".join(lines), back_kb, edit=True)
        elif isinstance(docs, dict):
            lines = [header]
            for i, (k2, v2) in enumerate(docs.items(), 1):
                url  = v2.get("url", "") if isinstance(v2, dict) else str(v2)
                name = v2.get("name", k2) if isinstance(v2, dict) else k2
                lines.append(f"{i}. [{name}]({url})" if url else f"{i}. {name}")
            await send(update, "\n".join(lines), back_kb, edit=True)
        else:
            await send(update,
                header + "\n_يرجى مراجعة لوحة التحكم لعرض المستندات._",
                back_kb, edit=True)
        return MAIN_MENU

        # ── تعديل الحالة ─────────────────────────
    elif data.startswith("edit_status:"):
        key = data.split(":")[1]
        await send(update, "اختر الحالة الجديدة:", status_kb(key), edit=True)
        return MAIN_MENU

    elif data.startswith("setstatus:"):
        parts = data.split(":")
        key, st = parts[1], parts[2]
        ok = update_req(key, "status", st)
        msg = f"✅ تم تحديث الحالة إلى: {STATUS.get(st, st)}" if ok else "❌ فشل التحديث. حاول مرة أخرى."
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
        msg = "🗑️ تم حذف الطلب بنجاح." if ok else "❌ فشل الحذف. حاول مرة أخرى."
        await send(update, msg, main_kb(), edit=True)
        return MAIN_MENU

    # ── الرئيسية ─────────────────────────────
    elif data == "home":
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
        return MAIN_MENU

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
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=main_kb()
        )
        return MAIN_MENU

    await update.message.reply_text(
        f"🔍 وُجد *{len(found)}* نتيجة:",
        parse_mode=ParseMode.MARKDOWN
    )
    for r in found[:10]:
        await update.message.reply_text(
            format_req(r, short=True),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=req_kb(r["firebaseKey"])
        )
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
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=type_kb("add_type:")
    )
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
        parse_mode=ParseMode.MARKDOWN
    )
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
        summary,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ حفظ",  callback_data="confirm_add"),
             InlineKeyboardButton("❌ إلغاء", callback_data="home")],
        ])
    )
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
            "createdBy":    update.effective_user.id,
        })
        ok  = add_req(req)
        msg = f"✅ تم إضافة الطلب رقم *{req['reqId']}* بنجاح." if ok else "❌ فشل الحفظ. حاول مرة أخرى."
        await send(update, msg, main_kb(), edit=True)
    else:
        await send(update, "🏠 *القائمة الرئيسية*", main_kb(), edit=True)
    ctx.user_data.pop("new_req", None)
    return MAIN_MENU


# ─────────────────────────────────────────
# Fallback
# ─────────────────────────────────────────
async def fallback(update, ctx) -> int:
    uid = update.effective_user.id
    if not check_auth(ctx, uid):
        await send(update, "🔐 أرسل /start لتسجيل الدخول.")
        return WAIT_PASSWORD
    await send(update, "🏠 *القائمة الرئيسية*", main_kb())
    return MAIN_MENU


# ─────────────────────────────────────────
# تسجيل أوامر البوت (BotFather commands)
# ─────────────────────────────────────────
async def post_init(application) -> None:
    await application.bot.set_my_commands([
        BotCommand("start",  "🏠 القائمة الرئيسية"),
        BotCommand("stats",  "📊 إحصائيات الطلبات"),
        BotCommand("search", "🔍 بحث"),
        BotCommand("logout", "🚪 تسجيل الخروج"),
        BotCommand("help",   "📖 المساعدة"),
    ])
    logger.info("✅ Bot commands registered")


# ─────────────────────────────────────────
# main
# ─────────────────────────────────────────
def main() -> None:
    # تشغيل Flask بـ gunicorn أو development حسب البيئة
    port = int(os.environ.get("PORT", 10000))
    flask_mode = os.getenv("FLASK_ENV", "production")

    def run_web():
        if flask_mode == "development":
            from flask import Flask as _Flask
            _app = _Flask(__name__)
            @_app.route("/")
            def home(): return "✅ Bot is running", 200
            _app.run(host="0.0.0.0", port=port)
        else:
            # gunicorn يُشغَّل من خارج البوت — هذا مجرد health-check thread
            import http.server
            import socketserver

            class Handler(http.server.BaseHTTPRequestHandler):
                def do_GET(self):
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"OK")
                def log_message(self, *_):
                    pass  # إسكات سجلات HTTP

            with socketserver.TCPServer(("", port), Handler) as s:
                s.serve_forever()

    Thread(target=run_web, daemon=True).start()
    logger.info(f"🌐 Health-check server on port {port}")

    init_firebase()

    # لا نستخدم PicklePersistence مع GitHub Actions
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start",  cmd_start),
            CommandHandler("stats",  cmd_stats),
            CommandHandler("logout", cmd_logout),
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
        },
        fallbacks=[
            CommandHandler("start",  cmd_start),
            CommandHandler("logout", cmd_logout),
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
