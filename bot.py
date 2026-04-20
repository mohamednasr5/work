#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ============================================================
# بوت تليجرام - نظام إدارة طلبات البرلمان
# برمجة وتطوير: مهندس محمد حماد
# يعمل على GitHub Actions - بدون استضافة خارجية
# ============================================================

import os, json, logging, time
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, db
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes, ConversationHandler, CallbackQueryHandler,
    PicklePersistence
)

# ─── إعداد السجل ──────────────────────────────────────────────
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ─── الإعدادات من متغيرات البيئة ─────────────────────────────
BOT_TOKEN    = os.environ["BOT_TOKEN"]
PASSWORD     = os.getenv("BOT_PASSWORD", "521988")
FIREBASE_URL = os.getenv("FIREBASE_URL", "https://hedor-bea3c-default-rtdb.firebaseio.com")
FIREBASE_JSON = os.environ["FIREBASE_CREDENTIALS_JSON"]   # محتوى ملف الـ credentials

# ─── حالات المحادثة ───────────────────────────────────────────
(
    WAIT_PASSWORD,
    MAIN_MENU,
    SEARCH_QUERY,
    ADD_ID, ADD_TITLE, ADD_DETAILS, ADD_AUTHORITY,
    ADD_DATE, ADD_REQ_TYPE, ADD_STATUS,
    ADD_DOCS_CONFIRM, ADD_DOC_TYPE, ADD_DOC_DATE, ADD_DOC_DESC, ADD_DOC_MORE,
    CONFIRM_SAVE,
) = range(16)

# ─── تخزين مؤقت ──────────────────────────────────────────────
temp: dict = {}           # بيانات الإضافة المؤقتة (في الذاكرة فقط — لا تحتاج persistence)

def is_auth(ctx) -> set:
    """يعيد set المستخدمين المصادق عليهم من bot_data (محفوظ عبر PicklePersistence)"""
    return ctx.bot_data.setdefault("authenticated", set())

def set_auth(ctx, uid: int):
    is_auth(ctx).add(uid)

def check_auth(ctx, uid: int) -> bool:
    return uid in is_auth(ctx)

# ─── تهيئة Firebase ──────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(FIREBASE_JSON))
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_URL})
        logger.info("✅ Firebase initialized")

def get_all() -> list:
    try:
        data = db.reference("parliament-requests").get()
        if not data:
            return []
        return [{**v, "firebaseKey": k} for k, v in data.items() if isinstance(v, dict)]
    except Exception as e:
        logger.error(f"get_all error: {e}")
        return []

def add_to_firebase(data: dict) -> bool:
    try:
        ref = db.reference("parliament-requests").push()
        ref.set({**data, "firebaseKey": ref.key,
                 "createdAt": datetime.now().isoformat(),
                 "updatedAt": datetime.now().isoformat()})
        return True
    except Exception as e:
        logger.error(f"add error: {e}")
        return False

# ─── دوال مساعدة ─────────────────────────────────────────────
MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
             "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]

def fmt_date(s: str) -> str:
    if not s: return "غير محدد"
    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d")
        return f"{d.day} {MONTHS_AR[d.month-1]} {d.year}"
    except:
        return s

STATUS = {
    "execution": "⏳ قيد التنفيذ",
    "review":    "🔍 قيد المراجعة",
    "completed": "✅ مكتمل",
    "rejected":  "❌ مرفوض",
}
REQ_TYPE = {
    "special":   "🟣 طلب خاص",
    "general":   "🔵 طلب عام",
    "briefing":  "🟠 طلب إحاطة",
    "urgent":    "🔴 بيان عاجل",
}

DOC_TYPE = {
    "official-request": "📄 طلب رسمي",
    "response":         "📩 رد الجهة",
    "follow-up":        "🔄 متابعة",
    "other":            "📋 أخرى",
}

def deadline_text(sub: str) -> str:
    if not sub: return "غير محدد"
    try:
        d = datetime.strptime(sub[:10], "%Y-%m-%d") + timedelta(days=90)
        days = (d - datetime.now().replace(hour=0,minute=0,second=0,microsecond=0)).days
        fd = fmt_date(d.strftime("%Y-%m-%d"))
        if days < 0:  return f"⚠️ تجاوز الموعد بـ {abs(days)} يوم"
        if days == 0: return "⚠️ اليوم هو الموعد النهائي"
        return f"{fd} ({days} يوم متبقي)"
    except:
        return "غير محدد"

def get_next_req_id(reqs: list) -> str:
    """
    يستنتج رقم الطلب التالي تلقائياً بناءً على آخر طلب مضاف.
    يدعم أنماط متعددة:
      - أرقام بحتة:       "25"       → "26"
      - بادئة + رقم:      "REQ-25"   → "REQ-26"
      - سنة + رقم:        "2024-15"  → "2024-16"
      - سنة/رقم:          "2024/15"  → "2024/16"
      - أي نمط آخر:       يُقترح العدد الكلي + 1
    """
    if not reqs:
        return "1"

    ids = [str(r.get("reqId", "")).strip() for r in reqs if r.get("reqId")]
    if not ids:
        return str(len(reqs) + 1)

    import re

    best_num = 0
    best_id  = ids[-1]   # fallback: آخر إدخال

    for rid in ids:
        # استخرج آخر سلسلة أرقام في النص
        nums = re.findall(r'\d+', rid)
        if nums:
            n = int(nums[-1])
            if n > best_num:
                best_num = n
                best_id  = rid

    if best_num == 0:
        return str(len(reqs) + 1)

    # أعد بناء الرقم التالي بنفس النمط
    import re as _re
    # استبدل آخر تكرار للرقم بالرقم التالي
    next_num = str(best_num + 1)
    # احتفظ بنفس عدد الأصفار البادئة إن وُجدت
    last_match = list(_re.finditer(r'\d+', best_id))[-1]
    old_num_str = last_match.group()
    if old_num_str.startswith('0') and len(old_num_str) > 1:
        next_num = next_num.zfill(len(old_num_str))

    next_id = best_id[:last_match.start()] + next_num + best_id[last_match.end():]
    return next_id


def search(query: str, reqs: list) -> list:
    """بحث ذكي في كل الحقول مع دعم البحث التقريبي"""
    q = query.strip().lower()
    if not q: return []

    exact, fuzzy = [], []
    for r in reqs:
        text = " ".join(filter(None, [
            str(r.get("reqId", "")),
            r.get("title", ""),
            r.get("authority", ""),
            r.get("details", ""),
            STATUS.get(r.get("status",""), ""),
            REQ_TYPE.get(r.get("requestType",""), ""),
            fmt_date(r.get("submissionDate", "")),
        ])).lower()
        # بحث في المستندات
        for doc in (r.get("documents") or []):
            text += " " + " ".join(filter(None,[
                DOC_TYPE.get(doc.get("type",""),""),
                doc.get("description",""),
                fmt_date(doc.get("date",""))
            ])).lower()

        if q in text:
            exact.append(r)
        elif any(q in word or word in q
                 for word in text.split() if len(word) > 2):
            fuzzy.append(r)

    return exact if exact else fuzzy

def format_request(r: dict, short=False) -> str:
    """تنسيق الطلب للعرض في تليجرام"""
    s = STATUS.get(r.get("status",""), r.get("status","غير محدد"))
    lines = [
        f"📌 *رقم الطلب:* `{r.get('reqId','—')}`",
        f"🗂️ *نوع الطلب:* {REQ_TYPE.get(r.get('requestType',''), 'غير محدد')}",
        f"📝 *العنوان:* {r.get('title','—')}",
        f"🏛️ *الجهة:* {r.get('authority','—')}",
        f"📅 *تاريخ التقديم:* {fmt_date(r.get('submissionDate',''))}",
        f"⏰ *الموعد النهائي:* {deadline_text(r.get('submissionDate',''))}",
        f"🔖 *الحالة:* {s}",
    ]
    if short:
        return "\n".join(lines)

    if r.get("details"):
        lines.append(f"\n📄 *التفاصيل:*\n{r['details']}")

    docs = r.get("documents") or []
    if r.get("hasDocuments") and docs:
        lines.append(f"\n📎 *المرفقات ({len(docs)}):*")
        for i, doc in enumerate(docs, 1):
            lines.append(
                f"  {i}. {DOC_TYPE.get(doc.get('type',''),'—')} │ "
                f"{fmt_date(doc.get('date',''))} │ "
                f"{doc.get('description','بدون وصف')}"
            )

    ts = r.get("createdAt","")
    if ts:
        try:
            dt = datetime.fromisoformat(ts)
            lines.append(f"\n🕒 *أُضيف:* {dt.strftime('%Y-%m-%d %H:%M')}")
        except: pass
    if r.get("updatedAt") and r.get("updatedAt") != r.get("createdAt"):
        try:
            dt = datetime.fromisoformat(r["updatedAt"])
            lines.append(f"✏️ *آخر تعديل:* {dt.strftime('%Y-%m-%d %H:%M')}")
        except: pass

    return "\n".join(lines)

def main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔍 بحث عن طلب", callback_data="search")],
        [InlineKeyboardButton("➕ إضافة طلب جديد", callback_data="add")],
        [InlineKeyboardButton("📊 إحصائيات", callback_data="stats")],
    ])

def cancel_keyboard():
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("❌ إلغاء", callback_data="cancel")
    ]])

def yes_no_keyboard():
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ نعم", callback_data="yes"),
        InlineKeyboardButton("❌ لا", callback_data="no"),
    ]])

# ═══════════════════════════════════════════════════════════════
# ─── المعالجات ────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if check_auth(ctx, uid):
        await update.message.reply_text(
            "👋 أهلاً بعودتك!\nاختر ما تريد:",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU

    await update.message.reply_text(
        "🔐 *نظام إدارة طلبات البرلمان*\n\n"
        "أهلاً بك! يرجى إدخال كلمة المرور للمتابعة:",
        parse_mode="Markdown"
    )
    return WAIT_PASSWORD

async def check_password(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if update.message.text.strip() == PASSWORD:
        set_auth(ctx, uid)
        await update.message.reply_text(
            "✅ *تم التحقق بنجاح!*\n\nمرحباً بك في نظام إدارة الطلبات.\nاختر ما تريد:",
            parse_mode="Markdown",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU
    else:
        await update.message.reply_text("❌ كلمة المرور غير صحيحة. حاول مرة أخرى:")
        return WAIT_PASSWORD

async def main_menu_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id

    if not check_auth(ctx, uid):
        await query.edit_message_text("⛔ انتهت جلستك. أرسل /start للبدء من جديد.")
        return ConversationHandler.END

    if query.data == "search":
        await query.edit_message_text(
            "🔍 *البحث في الطلبات*\n\n"
            "أدخل اسم الطلب أو رقمه أو الجهة أو أي كلمة ذات صلة:",
            parse_mode="Markdown",
            reply_markup=cancel_keyboard()
        )
        return SEARCH_QUERY

    elif query.data == "add":
        temp[uid] = {"documents": []}
        # اقترح رقم الطلب التالي تلقائياً
        all_r = get_all()
        suggested = get_next_req_id(all_r)
        temp[uid]["_suggested_id"] = suggested
        await query.edit_message_text(
            f"➕ *إضافة طلب جديد*\n\n"
            f"الخطوة 1/7 — *رقم الطلب*\n\n"
            f"📌 الرقم المقترح تلقائياً: `{suggested}`\n\n"
            f"اضغط ✅ *تأكيد* لقبوله، أو اكتب رقماً مختلفاً:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(f"✅ تأكيد الرقم {suggested}", callback_data="confirm_id")],
                [InlineKeyboardButton("❌ إلغاء", callback_data="cancel")],
            ])
        )
        return ADD_ID

    elif query.data == "stats":
        reqs = get_all()
        total = len(reqs)
        comp  = sum(1 for r in reqs if r.get("status") == "completed")
        exec_ = sum(1 for r in reqs if r.get("status") == "execution")
        rev   = sum(1 for r in reqs if r.get("status") == "review")
        rej   = sum(1 for r in reqs if r.get("status") == "rejected")
        overdue = sum(1 for r in reqs
                      if r.get("status") not in ("completed","rejected")
                      and "تجاوز" in deadline_text(r.get("submissionDate","")))

        text = (
            f"📊 *إحصائيات النظام*\n\n"
            f"📁 إجمالي الطلبات: *{total}*\n"
            f"✅ مكتملة: *{comp}*\n"
            f"⏳ قيد التنفيذ: *{exec_}*\n"
            f"🔍 قيد المراجعة: *{rev}*\n"
            f"❌ مرفوضة: *{rej}*\n"
            f"⚠️ تجاوزت الموعد: *{overdue}*"
        )
        await query.edit_message_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
            ]])
        )
        return MAIN_MENU

    elif query.data in ("cancel", "back_main"):
        await query.edit_message_text(
            "🏠 *القائمة الرئيسية*\nاختر ما تريد:",
            parse_mode="Markdown",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU

# ─── البحث ────────────────────────────────────────────────────
async def do_search(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if not check_auth(ctx, uid):
        return ConversationHandler.END

    q = update.message.text.strip()
    reqs = get_all()
    results = search(q, reqs)

    if not results:
        await update.message.reply_text(
            f"🔍 لم يتم العثور على نتائج لـ: *{q}*",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
            ]])
        )
        return MAIN_MENU

    # إذا نتيجة واحدة — عرض تفاصيل كاملة
    if len(results) == 1:
        text = f"✅ *تم العثور على طلب واحد:*\n\n{format_request(results[0])}"
        await update.message.reply_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
            ]])
        )
        return MAIN_MENU

    # إذا نتائج متعددة — قائمة للاختيار
    ctx.user_data["search_results"] = results
    buttons = [
        [InlineKeyboardButton(
            f"#{r.get('reqId','—')} — {r.get('title','')[:35]}",
            callback_data=f"view_{r['firebaseKey']}"
        )]
        for r in results[:10]
    ]
    buttons.append([InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")])
    await update.message.reply_text(
        f"🔍 *وُجد {len(results)} نتيجة لـ: \"{q}\"*\nاختر طلباً لعرض تفاصيله:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    return MAIN_MENU

async def view_request(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.replace("view_", "")
    results = ctx.user_data.get("search_results", [])
    req = next((r for r in results if r.get("firebaseKey") == key), None)
    if not req:
        # fallback: اجلب من Firebase مباشرة
        all_r = get_all()
        req = next((r for r in all_r if r.get("firebaseKey") == key), None)
    if not req:
        await query.edit_message_text("❌ لم يتم العثور على الطلب.")
        return MAIN_MENU

    text = format_request(req)
    await query.edit_message_text(
        text, parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
        ]])
    )
    return MAIN_MENU

# ─── إضافة طلب — خطوة بخطوة ─────────────────────────────────

async def add_id_confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """المستخدم ضغط زر ✅ تأكيد الرقم المقترح"""
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    suggested = temp[uid].get("_suggested_id", "1")
    temp[uid]["reqId"] = suggested
    await query.edit_message_text(
        f"✅ تم تأكيد رقم الطلب: `{suggested}`\n\n"
        f"الخطوة 2/7 — أدخل *عنوان الطلب*:",
        parse_mode="Markdown",
        reply_markup=cancel_keyboard()
    )
    return ADD_TITLE

async def add_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """المستخدم كتب رقماً مختلفاً يدوياً"""
    uid = update.effective_user.id
    req_id = update.message.text.strip()
    all_r = get_all()
    if any(r.get("reqId") == req_id for r in all_r):
        suggested = temp[uid].get("_suggested_id", "")
        await update.message.reply_text(
            f"❌ رقم الطلب *{req_id}* موجود مسبقاً!\n\n"
            f"📌 الرقم المقترح: `{suggested}`\n"
            f"اضغط تأكيد أو اكتب رقماً آخر:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(f"✅ تأكيد الرقم {suggested}", callback_data="confirm_id")],
                [InlineKeyboardButton("❌ إلغاء", callback_data="cancel")],
            ])
        )
        return ADD_ID
    temp[uid]["reqId"] = req_id
    await update.message.reply_text(
        f"✅ رقم الطلب: `{req_id}`\n\n"
        f"الخطوة 2/7 — أدخل *عنوان الطلب*:",
        parse_mode="Markdown",
        reply_markup=cancel_keyboard()
    )
    return ADD_TITLE

async def add_title(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    temp[uid]["title"] = update.message.text.strip()
    await update.message.reply_text(
        "الخطوة 3/7 — أدخل *تفاصيل الطلب*:",
        parse_mode="Markdown", reply_markup=cancel_keyboard()
    )
    return ADD_DETAILS

async def add_details(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    temp[uid]["details"] = update.message.text.strip()
    await update.message.reply_text(
        "الخطوة 4/7 — أدخل *الجهة المعنية*:",
        parse_mode="Markdown", reply_markup=cancel_keyboard()
    )
    return ADD_AUTHORITY

async def add_authority(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    temp[uid]["authority"] = update.message.text.strip()
    await update.message.reply_text(
        "الخطوة 5/7 — أدخل *تاريخ التقديم* (مثال: 2024-06-15):",
        parse_mode="Markdown", reply_markup=cancel_keyboard()
    )
    return ADD_DATE

async def add_date(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    date_str = update.message.text.strip()
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except:
        await update.message.reply_text(
            "❌ صيغة التاريخ غير صحيحة.\nأدخل التاريخ بصيغة: YYYY-MM-DD\nمثال: 2024-06-15",
            reply_markup=cancel_keyboard()
        )
        return ADD_DATE
    temp[uid]["submissionDate"] = date_str
    await update.message.reply_text(
        "الخطوة 6/8 — اختر *نوع الطلب*:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🟣 طلب خاص",     callback_data="rtype_special")],
            [InlineKeyboardButton("🔵 طلب عام",      callback_data="rtype_general")],
            [InlineKeyboardButton("🟠 طلب إحاطة",   callback_data="rtype_briefing")],
            [InlineKeyboardButton("🔴 بيان عاجل",   callback_data="rtype_urgent")],
        ])
    )
    return ADD_REQ_TYPE

async def add_req_type(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    temp[uid]["requestType"] = query.data.replace("rtype_", "")
    chosen = REQ_TYPE.get(temp[uid]["requestType"], "")
    await query.edit_message_text(
        f"✅ نوع الطلب: {chosen}\n\nالخطوة 7/8 — اختر *حالة الطلب*:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("⏳ قيد التنفيذ",  callback_data="status_execution")],
            [InlineKeyboardButton("🔍 قيد المراجعة", callback_data="status_review")],
            [InlineKeyboardButton("✅ مكتمل",         callback_data="status_completed")],
            [InlineKeyboardButton("❌ مرفوض",         callback_data="status_rejected")],
        ])
    )
    return ADD_STATUS

async def add_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    temp[uid]["status"] = query.data.replace("status_", "")
    await query.edit_message_text(
        "الخطوة 8/8 — هل تريد إضافة *مستندات / مرفقات*؟",
        parse_mode="Markdown",
        reply_markup=yes_no_keyboard()
    )
    return ADD_DOCS_CONFIRM

async def add_docs_confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id

    if query.data == "no":
        temp[uid]["hasDocuments"] = False
        return await show_summary(query, uid)
    else:
        temp[uid]["hasDocuments"] = True
        temp[uid]["documents"] = []
        await query.edit_message_text(
            "📄 *إضافة مستند*\n\nاختر *نوع المستند*:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📄 طلب رسمي",  callback_data="dt_official-request")],
                [InlineKeyboardButton("📩 رد الجهة",  callback_data="dt_response")],
                [InlineKeyboardButton("🔄 متابعة",    callback_data="dt_follow-up")],
                [InlineKeyboardButton("📋 أخرى",      callback_data="dt_other")],
            ])
        )
        return ADD_DOC_TYPE

async def add_doc_type(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    ctx.user_data["cur_doc"] = {"type": query.data.replace("dt_", "")}
    await query.edit_message_text(
        "📅 أدخل *تاريخ المستند* (مثال: 2024-06-15):",
        parse_mode="Markdown", reply_markup=cancel_keyboard()
    )
    return ADD_DOC_DATE

async def add_doc_date(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    date_str = update.message.text.strip()
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except:
        await update.message.reply_text(
            "❌ صيغة التاريخ غير صحيحة. مثال: 2024-06-15",
            reply_markup=cancel_keyboard()
        )
        return ADD_DOC_DATE
    ctx.user_data["cur_doc"]["date"] = date_str
    await update.message.reply_text(
        "📝 أدخل *وصف المستند* (أو أرسل - للتخطي):",
        parse_mode="Markdown", reply_markup=cancel_keyboard()
    )
    return ADD_DOC_DESC

async def add_doc_desc(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    desc = update.message.text.strip()
    ctx.user_data["cur_doc"]["description"] = "" if desc == "-" else desc
    temp[uid]["documents"].append(ctx.user_data.pop("cur_doc"))
    n = len(temp[uid]["documents"])
    await update.message.reply_text(
        f"✅ تم إضافة المستند رقم {n}.\nهل تريد إضافة مستند آخر؟",
        reply_markup=yes_no_keyboard()
    )
    return ADD_DOC_MORE

async def add_doc_more(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    if query.data == "yes":
        await query.edit_message_text(
            "📄 اختر *نوع المستند*:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📄 طلب رسمي",  callback_data="dt_official-request")],
                [InlineKeyboardButton("📩 رد الجهة",  callback_data="dt_response")],
                [InlineKeyboardButton("🔄 متابعة",    callback_data="dt_follow-up")],
                [InlineKeyboardButton("📋 أخرى",      callback_data="dt_other")],
            ])
        )
        return ADD_DOC_TYPE
    return await show_summary(query, uid)

async def show_summary(query, uid):
    d = temp[uid]
    docs = d.get("documents", [])
    doc_text = ""
    if docs:
        doc_text = f"\n📎 *المستندات:* {len(docs)}\n"
        for i, doc in enumerate(docs, 1):
            doc_text += f"  {i}. {DOC_TYPE.get(doc['type'],'—')} — {fmt_date(doc.get('date',''))} — {doc.get('description','')}\n"
    else:
        doc_text = "\n📎 *المستندات:* لا يوجد\n"

    summary = (
        f"📋 *ملخص الطلب قبل الحفظ:*\n\n"
        f"🔢 *الرقم:* {d.get('reqId','')}\n"
        f"🗂️ *نوع الطلب:* {REQ_TYPE.get(d.get('requestType',''), 'غير محدد')}\n"
        f"📝 *العنوان:* {d.get('title','')}\n"
        f"🏛️ *الجهة:* {d.get('authority','')}\n"
        f"📅 *التاريخ:* {fmt_date(d.get('submissionDate',''))}\n"
        f"🔖 *الحالة:* {STATUS.get(d.get('status',''),'—')}\n"
        f"📄 *التفاصيل:* {d.get('details','')[:200]}\n"
        f"{doc_text}\n"
        f"هل تريد حفظ هذا الطلب؟"
    )
    await query.edit_message_text(
        summary, parse_mode="Markdown",
        reply_markup=yes_no_keyboard()
    )
    return CONFIRM_SAVE

async def confirm_save(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id

    if query.data == "no":
        temp.pop(uid, None)
        await query.edit_message_text(
            "🚫 تم إلغاء الإضافة.\nاختر ما تريد:",
            reply_markup=main_keyboard()
        )
        return MAIN_MENU

    data = temp.pop(uid, {})
    if add_to_firebase(data):
        await query.edit_message_text(
            f"✅ *تم إضافة الطلب بنجاح!*\n\n"
            f"رقم الطلب: `{data.get('reqId','')}`\n"
            f"العنوان: {data.get('title','')}\n\n"
            f"الطلب متاح الآن في التطبيق فوراً.",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_main")
            ]])
        )
    else:
        await query.edit_message_text(
            "❌ حدث خطأ أثناء الحفظ. حاول مرة أخرى.",
            reply_markup=main_keyboard()
        )
    return MAIN_MENU

async def cancel_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    temp.pop(uid, None)
    await query.edit_message_text(
        "🏠 *القائمة الرئيسية*\nاختر ما تريد:",
        parse_mode="Markdown",
        reply_markup=main_keyboard()
    )
    return MAIN_MENU

async def unknown_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if not check_auth(ctx, uid):
        await update.message.reply_text("أرسل /start للبدء.")
        return
    await update.message.reply_text(
        "اختر من القائمة:",
        reply_markup=main_keyboard()
    )
    return MAIN_MENU

# ═══════════════════════════════════════════════════════════════
# ─── تشغيل البوت ─────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════
def main():
    init_firebase()

    persistence = PicklePersistence(filepath="bot_data.pkl")
    app = Application.builder().token(BOT_TOKEN).persistence(persistence).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        name="main_conv",
        persistent=True,
        states={
            WAIT_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, check_password)],
            MAIN_MENU: [
                CallbackQueryHandler(main_menu_callback, pattern="^(search|add|stats|cancel|back_main)$"),                CallbackQueryHandler(view_request, pattern="^view_"),
            ],
            SEARCH_QUERY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, do_search),
                CallbackQueryHandler(cancel_handler, pattern="^cancel$"),
            ],
            ADD_ID:        [MessageHandler(filters.TEXT & ~filters.COMMAND, add_id),
                            CallbackQueryHandler(add_id_confirm, pattern="^confirm_id$"),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_TITLE:     [MessageHandler(filters.TEXT & ~filters.COMMAND, add_title),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_DETAILS:   [MessageHandler(filters.TEXT & ~filters.COMMAND, add_details),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_AUTHORITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_authority),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_DATE:      [MessageHandler(filters.TEXT & ~filters.COMMAND, add_date),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_REQ_TYPE:  [CallbackQueryHandler(add_req_type, pattern="^rtype_"),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_STATUS:    [CallbackQueryHandler(add_status, pattern="^status_")],
            ADD_DOCS_CONFIRM: [CallbackQueryHandler(add_docs_confirm, pattern="^(yes|no)$")],
            ADD_DOC_TYPE:  [CallbackQueryHandler(add_doc_type, pattern="^dt_"),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_DOC_DATE:  [MessageHandler(filters.TEXT & ~filters.COMMAND, add_doc_date),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_DOC_DESC:  [MessageHandler(filters.TEXT & ~filters.COMMAND, add_doc_desc),
                            CallbackQueryHandler(cancel_handler, pattern="^cancel$")],
            ADD_DOC_MORE:  [CallbackQueryHandler(add_doc_more, pattern="^(yes|no)$")],
            CONFIRM_SAVE:  [CallbackQueryHandler(confirm_save, pattern="^(yes|no)$")],
        },
        fallbacks=[
            CommandHandler("start", start),
            MessageHandler(filters.TEXT & ~filters.COMMAND, unknown_text),
        ],
        allow_reentry=True,
        per_user=True,
    )

    app.add_handler(conv)

    logger.info("🤖 البوت يعمل الآن...")
    # تشغيل لمدة 55 دقيقة (حد GitHub Actions = 6 ساعات، لكن نفضل run كل ساعة)
    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        timeout=300,
        poll_interval=1,
        stop_signals=None,
        close_loop=False,
    )

if __name__ == "__main__":
    main()
