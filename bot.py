from flask import Flask
from threading import Thread
import os
import json
import logging
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, db

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters,
    ConversationHandler, CallbackQueryHandler, PicklePersistence
)

# ============================================================
# Flask
# ============================================================
web_app = Flask(__name__)

@web_app.route("/")
def home():
    return "Bot Running"

def run_web():
    web_app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))

# ============================================================
# Logging
# ============================================================
logging.basicConfig(format='%(asctime)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# متغيرات البيئة
# ============================================================
BOT_TOKEN          = os.environ["BOT_TOKEN"]
PASSWORD           = os.getenv("BOT_PASSWORD", "521988")
FIREBASE_URL       = os.environ["FIREBASE_URL"]
FIREBASE_JSON      = os.environ["FIREBASE_CREDENTIALS_JSON"]

# ============================================================
# حالات المحادثة
# ============================================================
(
    WAIT_PASSWORD, MAIN_MENU, SEARCH_QUERY,
    EDIT_VALUE, ADD_TITLE, ADD_TYPE, ADD_AUTH, ADD_DETAILS, ADD_CONFIRM,
) = range(9)

# ============================================================
# Firebase
# ============================================================
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(FIREBASE_JSON))
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_URL})
        logger.info("Firebase initialized")

def get_all():
    try:
        data = db.reference("parliament-requests").get()
        if not data:
            return []
        return [{"firebaseKey": k, **v} for k, v in data.items() if isinstance(v, dict)]
    except Exception as e:
        logger.error(f"get_all error: {e}")
        return []

def get_req(key):
    try:
        return db.reference(f"parliament-requests/{key}").get()
    except:
        return None

def update_req(key, field, value):
    db.reference(f"parliament-requests/{key}").update({field: value})

def delete_req(key):
    db.reference(f"parliament-requests/{key}").delete()

def add_req(data):
    db.reference("parliament-requests").push(data)

# ============================================================
# تنسيق
# ============================================================
MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
             "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]

def fmt_date(s):
    if not s: return "غير محدد"
    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d")
        return f"{d.day} {MONTHS_AR[d.month-1]} {d.year}"
    except:
        return s

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

def format_req(r, short=False):
    s     = STATUS.get(r.get("status",""), r.get("status","غير محدد"))
    rtype = REQ_TYPE.get(r.get("requestType",""), r.get("requestType","غير محدد"))
    lines = [
        f"📌 رقم الطلب: {r.get('reqId','—')}",
        f"🗂️ النوع: {rtype}",
        f"📝 العنوان: {r.get('title','—')}",
        f"🏛️ الجهة: {r.get('authority','—')}",
        f"📅 التاريخ: {fmt_date(r.get('reqDate',''))}",
        f"🔖 الحالة: {s}",
    ]
    if not short and r.get("details"):
        lines.append(f"\n📄 التفاصيل:\n{r['details'][:600]}")
    return "\n".join(lines)

def stats_text():
    reqs = get_all()
    total = len(reqs)
    by_status, by_type = {}, {}
    for r in reqs:
        st = r.get("status","?"); rt = r.get("requestType","?")
        by_status[st] = by_status.get(st, 0) + 1
        by_type[rt]   = by_type.get(rt, 0) + 1
    lines = [f"📊 *إحصائيات الطلبات*\n\n🔢 الإجمالي: *{total}*\n", "*حسب الحالة:*"]
    for k, v in by_status.items():
        lines.append(f"  {STATUS.get(k,k)}: {v}")
    lines.append("\n*حسب النوع:*")
    for k, v in by_type.items():
        lines.append(f"  {REQ_TYPE.get(k,k)}: {v}")
    return "\n".join(lines)

# ============================================================
# لوحات مفاتيح
# ============================================================
def main_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔍 بحث", callback_data="search"),
         InlineKeyboardButton("📊 إحصائيات", callback_data="stats")],
        [InlineKeyboardButton("📋 كل الطلبات", callback_data="list_all"),
         InlineKeyboardButton("🔽 فلترة", callback_data="filter")],
        [InlineKeyboardButton("➕ إضافة طلب", callback_data="add")],
    ])

def req_kb(key):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✏️ تعديل الحالة",  callback_data=f"edit_status:{key}"),
         InlineKeyboardButton("✏️ تعديل العنوان", callback_data=f"edit_title:{key}")],
        [InlineKeyboardButton("🗑️ حذف", callback_data=f"delete:{key}"),
         InlineKeyboardButton("🏠 القائمة",        callback_data="home")],
    ])

def status_kb(key=""):
    prefix = f"setstatus:{key}:" if key else "filter_status:"
    buttons = [[InlineKeyboardButton(v, callback_data=f"{prefix}{k}")] for k, v in STATUS.items()]
    buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="home")])
    return InlineKeyboardMarkup(buttons)

def type_kb(prefix="filter_type:"):
    buttons = [[InlineKeyboardButton(v, callback_data=f"{prefix}{k}")] for k, v in REQ_TYPE.items()]
    buttons.append([InlineKeyboardButton("🔙 رجوع", callback_data="home")])
    return InlineKeyboardMarkup(buttons)

# ============================================================
# مساعد إرسال
# ============================================================
async def send(update, text, kb=None, edit=False, md=False):
    kw = {"reply_markup": kb}
    if md: kw["parse_mode"] = "Markdown"
    if edit and update.callback_query:
        try:
            await update.callback_query.edit_message_text(text, **kw)
            return
        except:
            pass
    target = update.callback_query.message if update.callback_query else update.message
    await target.reply_text(text, **kw)

# ============================================================
# مصادقة
# ============================================================
def check_auth(ctx, uid):
    return uid in ctx.bot_data.get("auth", set())

def set_auth(ctx, uid):
    ctx.bot_data.setdefault("auth", set()).add(uid)

# ============================================================
# /start
# ============================================================
async def start(update, ctx):
    uid = update.effective_user.id
    if check_auth(ctx, uid):
        await send(update, "🏠 القائمة الرئيسية", main_kb())
        return MAIN_MENU
    await send(update, "🔐 أدخل كلمة المرور:")
    return WAIT_PASSWORD

async def check_password(update, ctx):
    uid  = update.effective_user.id
    text = update.message.text.strip()
    try: await update.message.delete()
    except: pass
    if text == PASSWORD:
        set_auth(ctx, uid)
        await update.effective_chat.send_message("✅ تم تسجيل الدخول", reply_markup=main_kb())
        return MAIN_MENU
    await update.effective_chat.send_message("❌ كلمة المرور غير صحيحة")
    return WAIT_PASSWORD

# ============================================================
# Callbacks القائمة الرئيسية
# ============================================================
async def main_cb(update, ctx):
    q    = update.callback_query
    data = q.data
    await q.answer()

    # بحث
    if data == "search":
        await send(update, "🔍 أرسل كلمة البحث:", edit=True)
        return SEARCH_QUERY

    # إحصائيات
    elif data == "stats":
        await send(update, stats_text(),
                   InlineKeyboardMarkup([[InlineKeyboardButton("🏠 القائمة", callback_data="home")]]),
                   edit=True, md=True)
        return MAIN_MENU

    # كل الطلبات
    elif data == "list_all":
        reqs = sorted(get_all(), key=lambda x: int(x.get("reqId","0") or 0))
        if not reqs:
            await send(update, "لا توجد طلبات.", edit=True)
            return MAIN_MENU
        await q.message.reply_text(f"📋 إجمالي الطلبات: {len(reqs)}\n(يُعرض آخر 10)")
        for r in reqs[-10:]:
            await q.message.reply_text(format_req(r, short=True), reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    # فلترة
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
                      key=lambda x: int(x.get("reqId","0") or 0))
        await q.message.reply_text(f"{STATUS.get(st,st)}: {len(reqs)} طلب")
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True), reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    elif data.startswith("filter_type:"):
        rt   = data.split(":")[1]
        reqs = sorted([r for r in get_all() if r.get("requestType") == rt],
                      key=lambda x: int(x.get("reqId","0") or 0))
        await q.message.reply_text(f"{REQ_TYPE.get(rt,rt)}: {len(reqs)} طلب")
        for r in reqs[-15:]:
            await q.message.reply_text(format_req(r, short=True), reply_markup=req_kb(r["firebaseKey"]))
        await q.message.reply_text("🏠", reply_markup=main_kb())
        return MAIN_MENU

    # إضافة طلب
    elif data == "add":
        ctx.user_data["new_req"] = {}
        await send(update, "📝 أدخل *عنوان* الطلب:", edit=True, md=True)
        return ADD_TITLE

    # تعديل الحالة
    elif data.startswith("edit_status:"):
        key = data.split(":")[1]
        await send(update, "اختر الحالة الجديدة:", status_kb(key), edit=True)
        return MAIN_MENU

    elif data.startswith("setstatus:"):
        parts = data.split(":")
        key, st = parts[1], parts[2]
        update_req(key, "status", st)
        await send(update, f"✅ تم تحديث الحالة إلى: {STATUS.get(st,st)}", main_kb(), edit=True)
        return MAIN_MENU

    # تعديل العنوان
    elif data.startswith("edit_title:"):
        key = data.split(":")[1]
        ctx.user_data["edit_key"]   = key
        ctx.user_data["edit_field"] = "title"
        await send(update, "✏️ أدخل العنوان الجديد:", edit=True)
        return EDIT_VALUE

    # حذف
    elif data.startswith("delete:"):
        key = data.split(":")[1]
        r   = get_req(key)
        txt = f"⚠️ هل تريد حذف هذا الطلب؟\n\n{r.get('title','') if r else key}"
        await send(update, txt,
                   InlineKeyboardMarkup([
                       [InlineKeyboardButton("✅ نعم، احذف", callback_data=f"confirm_delete:{key}"),
                        InlineKeyboardButton("❌ إلغاء",      callback_data="home")],
                   ]), edit=True)
        return MAIN_MENU

    elif data.startswith("confirm_delete:"):
        key = data.split(":")[1]
        delete_req(key)
        await send(update, "🗑️ تم حذف الطلب.", main_kb(), edit=True)
        return MAIN_MENU

    # الرئيسية
    elif data == "home":
        await send(update, "🏠 القائمة الرئيسية", main_kb(), edit=True)
        return MAIN_MENU

    return MAIN_MENU

# ============================================================
# البحث
# ============================================================
async def do_search(update, ctx):
    q    = update.message.text.strip().lower()
    reqs = get_all()
    results = [
        r for r in reqs
        if q in " ".join(filter(None, [
            str(r.get("reqId","")), r.get("title",""),
            r.get("authority",""), r.get("details",""),
        ])).lower()
    ]
    if not results:
        await update.message.reply_text("❌ لا توجد نتائج", reply_markup=main_kb())
        return MAIN_MENU
    await update.message.reply_text(f"🔍 وجدت {len(results)} نتيجة:")
    for r in results[:10]:
        await update.message.reply_text(format_req(r, short=True), reply_markup=req_kb(r["firebaseKey"]))
    await update.message.reply_text("🏠", reply_markup=main_kb())
    return MAIN_MENU

# ============================================================
# تعديل القيمة
# ============================================================
async def do_edit_value(update, ctx):
    key   = ctx.user_data.get("edit_key")
    field = ctx.user_data.get("edit_field", "title")
    if key:
        update_req(key, field, update.message.text.strip())
        await update.message.reply_text("✅ تم التحديث.", reply_markup=main_kb())
    return MAIN_MENU

# ============================================================
# إضافة طلب
# ============================================================
async def add_title(update, ctx):
    ctx.user_data["new_req"]["title"] = update.message.text.strip()
    await update.message.reply_text("🗂️ اختر *نوع* الطلب:", reply_markup=type_kb("add_type:"), parse_mode="Markdown")
    return ADD_TYPE

async def add_type_cb(update, ctx):
    q  = update.callback_query
    await q.answer()
    ctx.user_data["new_req"]["requestType"] = q.data.split(":")[1]
    await q.message.reply_text("🏛️ أدخل *الجهة* المعنية:", parse_mode="Markdown")
    return ADD_AUTH

async def add_auth(update, ctx):
    ctx.user_data["new_req"]["authority"] = update.message.text.strip()
    await update.message.reply_text("📄 أدخل *التفاصيل* (أو أرسل - للتخطي):", parse_mode="Markdown")
    return ADD_DETAILS

async def add_details(update, ctx):
    val = update.message.text.strip()
    ctx.user_data["new_req"]["details"] = "" if val == "-" else val
    req = ctx.user_data["new_req"]
    summary = (
        f"📋 *ملخص الطلب:*\n\n"
        f"📝 {req.get('title')}\n"
        f"🗂️ {REQ_TYPE.get(req.get('requestType',''),'')}\n"
        f"🏛️ {req.get('authority')}\n\n"
        f"هل تريد الحفظ؟"
    )
    await update.message.reply_text(summary,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ حفظ", callback_data="confirm_add"),
             InlineKeyboardButton("❌ إلغاء", callback_data="home")],
        ]), parse_mode="Markdown")
    return ADD_CONFIRM

async def confirm_add(update, ctx):
    q = update.callback_query
    await q.answer()
    if q.data == "confirm_add":
        reqs   = get_all()
        max_id = max((int(r.get("reqId","0") or 0) for r in reqs), default=0)
        req    = ctx.user_data.get("new_req", {})
        req.update({"reqId": str(max_id + 1), "status": "execution",
                    "reqDate": datetime.now().strftime("%Y-%m-%d"), "hasDocuments": False})
        add_req(req)
        await send(update, f"✅ تم إضافة الطلب رقم {req['reqId']}", main_kb(), edit=True)
    else:
        await send(update, "🏠 القائمة الرئيسية", main_kb(), edit=True)
    ctx.user_data.pop("new_req", None)
    return MAIN_MENU

# ============================================================
# Fallback
# ============================================================
async def fallback(update, ctx):
    await send(update, "🏠 القائمة الرئيسية", main_kb())
    return MAIN_MENU

# ============================================================
# main
# ============================================================
def main():
    Thread(target=run_web).start()
    init_firebase()
    persistence = PicklePersistence(filepath="bot_data.pkl")
    app = Application.builder().token(BOT_TOKEN).persistence(persistence).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            WAIT_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, check_password)],
            MAIN_MENU: [
                CallbackQueryHandler(main_cb),
                MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
            ],
            SEARCH_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, do_search)],
            EDIT_VALUE:   [MessageHandler(filters.TEXT & ~filters.COMMAND, do_edit_value)],
            ADD_TITLE:    [MessageHandler(filters.TEXT & ~filters.COMMAND, add_title)],
            ADD_TYPE:     [CallbackQueryHandler(add_type_cb, pattern="^add_type:")],
            ADD_AUTH:     [MessageHandler(filters.TEXT & ~filters.COMMAND, add_auth)],
            ADD_DETAILS:  [MessageHandler(filters.TEXT & ~filters.COMMAND, add_details)],
            ADD_CONFIRM:  [CallbackQueryHandler(confirm_add, pattern="^(confirm_add|home)$")],
        },
        fallbacks=[
            CommandHandler("start", start),
            MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
        ],
        allow_reentry=True,
    )

    app.add_handler(conv)
    logger.info("Bot Running...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
