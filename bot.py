from flask import Flask
from threading import Thread
import os
import json
import logging
import asyncio
from datetime import datetime, timedelta

import firebase_admin
from firebase_admin import credentials, db

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup
)

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler,
    PicklePersistence
)

# ============================================================
# إعداد Flask لـ Render Free Web Service
# ============================================================

web_app = Flask(__name__)

@web_app.route("/")
def home():
    return "Telegram Bot Running Successfully"

def run_web():
    web_app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 10000))
    )

# ============================================================
# إعدادات السجل
# ============================================================

logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

logger = logging.getLogger(__name__)

# ============================================================
# متغيرات البيئة
# ============================================================

BOT_TOKEN = os.environ["BOT_TOKEN"]

PASSWORD = os.getenv(
    "BOT_PASSWORD",
    "521988"
)

FIREBASE_URL = os.getenv(
    "FIREBASE_URL",
    ""
)

FIREBASE_JSON = os.environ[
    "FIREBASE_CREDENTIALS_JSON"
]

ARCHIVE_CHANNEL_ID = os.getenv(
    "ARCHIVE_CHANNEL_ID",
    ""
)

# ============================================================
# حالات المحادثة
# ============================================================

(
    WAIT_PASSWORD,
    MAIN_MENU,
    SEARCH_QUERY,
) = range(3)

# ============================================================
# تخزين مؤقت
# ============================================================

temp = {}

_cache = {
    "data": None,
    "ts": 0
}

CACHE_TTL = 30

# ============================================================
# المصادقة
# ============================================================

def is_auth(ctx):
    return ctx.bot_data.setdefault(
        "authenticated",
        set()
    )

def set_auth(ctx, uid):
    is_auth(ctx).add(uid)

def check_auth(ctx, uid):
    return uid in is_auth(ctx)

# ============================================================
# Firebase
# ============================================================

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(
            json.loads(FIREBASE_JSON)
        )
        firebase_admin.initialize_app(
            cred,
            {
                "databaseURL": FIREBASE_URL
            }
        )
        logger.info("Firebase initialized")

# ============================================================
# جلب البيانات
# ============================================================

def get_all(force=False):

    global _cache

    now = datetime.now().timestamp()

    if (
        not force
        and _cache["data"] is not None
        and (now - _cache["ts"]) < CACHE_TTL
    ):
        return _cache["data"]

    try:
        data = db.reference(
            "parliament-requests"
        ).get()

        result = []

        if data:
            result = [
                {
                    **v,
                    "firebaseKey": k
                }
                for k, v in data.items()
                if isinstance(v, dict)
            ]

        _cache = {
            "data": result,
            "ts": now
        }

        return result

    except Exception as e:
        logger.error(f"get_all error: {e}")
        return _cache["data"] or []

# ============================================================
# التنسيق
# ============================================================

MONTHS_AR = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر"
]

def fmt_date(s):
    if not s:
        return "غير محدد"
    try:
        d = datetime.strptime(
            s[:10],
            "%Y-%m-%d"
        )
        return f"{d.day} {MONTHS_AR[d.month-1]} {d.year}"
    except:
        return s

STATUS = {
    "execution": "⏳ قيد التنفيذ",
    "review": "🔍 قيد المراجعة",
    "completed": "✅ مكتمل",
    "rejected": "❌ مرفوض",
}

REQ_TYPE = {
    "special": "🟣 طلب خاص",
    "general": "🔵 طلب عام",
    "briefing": "🟠 طلب إحاطة",
    "urgent": "🔴 بيان عاجل",
}

# ============================================================
# البحث
# ============================================================

def search(query, reqs):

    q = query.strip().lower()

    if not q:
        return []

    results = []

    for r in reqs:
        text = " ".join(
            filter(
                None,
                [
                    str(r.get("reqId", "")),
                    r.get("title", ""),
                    r.get("authority", ""),
                    r.get("details", "")
                ]
            )
        ).lower()

        if q in text:
            results.append(r)

    return results

# ============================================================
# تنسيق الطلب
# ============================================================

def format_request(r):

    s = STATUS.get(
        r.get("status", ""),
        "غير محدد"
    )

    rtype = REQ_TYPE.get(
        r.get("requestType", ""),
        "غير محدد"
    )

    lines = [
        f"📌 رقم الطلب: {r.get('reqId','—')}",
        f"🗂️ النوع: {rtype}",
        f"📝 العنوان: {r.get('title','—')}",
        f"🏛️ الجهة: {r.get('authority','—')}",
        f"📅 التاريخ: {fmt_date(r.get('submissionDate',''))}",
        f"🔖 الحالة: {s}",
    ]

    if r.get("details"):
        lines.append(
            f"\n📄 التفاصيل:\n{r['details']}"
        )

    return "\n".join(lines)

# ============================================================
# الكيبورد
# ============================================================

def main_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "🔍 بحث",
                callback_data="search"
            )
        ],
        [
            InlineKeyboardButton(
                "📊 إحصائيات",
                callback_data="stats"
            )
        ],
    ])

# ============================================================
# START
# ============================================================

async def start(update, ctx):

    uid = update.effective_user.id

    if check_auth(ctx, uid):
        await update.message.reply_text(
            "🏠 القائمة الرئيسية",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU

    await update.message.reply_text(
        "🔐 أدخل كلمة المرور:"
    )

    return WAIT_PASSWORD

# ============================================================
# كلمة المرور
# ============================================================

async def check_password(update, ctx):

    uid = update.effective_user.id
    text = update.message.text.strip()

    try:
        await update.message.delete()
    except:
        pass

    if text == PASSWORD:
        set_auth(ctx, uid)
        await ctx.bot.send_message(
            chat_id=update.effective_chat.id,
            text="✅ تم تسجيل الدخول",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU
    else:
        await ctx.bot.send_message(
            chat_id=update.effective_chat.id,
            text="❌ كلمة المرور غير صحيحة"
        )
        return WAIT_PASSWORD

# ============================================================
# القائمة الرئيسية
# ============================================================

async def main_menu_callback(update, ctx):

    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "search":
        await query.edit_message_text(
            "🔍 أرسل كلمة البحث:"
        )
        return SEARCH_QUERY

    elif data == "stats":
        reqs = get_all()
        await query.edit_message_text(
            f"📊 إجمالي الطلبات: {len(reqs)}",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU

# ============================================================
# البحث
# ============================================================

async def do_search(update, ctx):

    q = update.message.text.strip()
    reqs = get_all()
    results = search(q, reqs)

    if not results:
        await update.message.reply_text(
            "❌ لا توجد نتائج"
        )
        return MAIN_MENU

    for r in results[:10]:
        await update.message.reply_text(
            format_request(r)
        )

    await update.message.reply_text(
        "🏠 القائمة الرئيسية",
        reply_markup=main_keyboard()
    )

    return MAIN_MENU

# ============================================================
# رسائل غير معروفة
# ============================================================

async def unknown_text(update, ctx):
    await update.message.reply_text(
        "🏠 اختر من القائمة",
        reply_markup=main_keyboard()
    )
    return MAIN_MENU

# ============================================================
# التشغيل الرئيسي
# ============================================================

def main():

    Thread(target=run_web).start()

    init_firebase()

    persistence = PicklePersistence(
        filepath="bot_data.pkl"
    )

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .persistence(persistence)
        .build()
    )

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start", start)
        ],
        states={
            WAIT_PASSWORD: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    check_password
                )
            ],
            MAIN_MENU: [
                CallbackQueryHandler(main_menu_callback)
            ],
            SEARCH_QUERY: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    do_search
                )
            ],
        },
        fallbacks=[
            CommandHandler("start", start),
            MessageHandler(
                filters.TEXT & ~filters.COMMAND,
                unknown_text
            )
        ],
        allow_reentry=True
    )

    app.add_handler(conv)

    logger.info("Bot Running...")

    app.run_polling(
        drop_pending_updates=True
    )

# ============================================================
# التشغيل
# ============================================================

if __name__ == "__main__":
    main()
