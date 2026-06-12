(function () {
  'use strict';

  /* ────────────────────────────────────────
     CONFIG — عدّل هذه القيم فقط
  ──────────────────────────────────────── */
  const BOT_USERNAME = 'AhmedAlHadidiBot';
  const BOT_DISPLAY  = 'بوت إدارة الطلبات';
  const OPEN_ON_LOAD = false; // true = يفتح تلقائياً عند تحميل الصفحة

  /* ────────────────────────────────────────
     STYLES
  ──────────────────────────────────────── */
  const css = `
    #tg-fab-btn {
      position: fixed;
      bottom: 24px;
      left: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #229ED9;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(34,158,217,.4);
      z-index: 9999;
      transition: transform .2s;
    }
    #tg-fab-btn:hover { transform: scale(1.08); }
    #tg-fab-btn svg { width: 28px; height: 28px; fill: #fff; }
    #tg-fab-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e24b4a;
      color: #fff;
      font-size: 10px;
      font-family: sans-serif;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #f0f2f5;
    }
    #tg-chat-box {
      position: fixed;
      bottom: 90px;
      left: 24px;
      width: 320px;
      height: 420px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,.14);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 9998;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px) scale(.97);
      transition: opacity .22s ease, transform .22s ease;
    }
    #tg-chat-box.tg-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    #tg-chat-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #229ED9;
      flex-shrink: 0;
    }
    #tg-chat-header .tg-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.25);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #tg-chat-header .tg-avatar svg { width: 20px; height: 20px; fill: #fff; }
    #tg-chat-header .tg-info { flex: 1; }
    #tg-chat-header .tg-name { font-size: 14px; font-weight: 600; color: #fff; }
    #tg-chat-header .tg-status { font-size: 11px; color: rgba(255,255,255,.8); }
    #tg-chat-header .tg-close {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.8); font-size: 20px; line-height: 1;
      padding: 2px 4px; border-radius: 6px;
    }
    #tg-chat-header .tg-close:hover { color: #fff; background: rgba(255,255,255,.15); }
    #tg-msgs {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f0f2f5;
      scroll-behavior: smooth;
    }
    .tg-msg { max-width: 80%; display: flex; flex-direction: column; gap: 2px; }
    .tg-msg.tg-bot { align-self: flex-start; }
    .tg-msg.tg-user { align-self: flex-end; }
    .tg-bubble {
      padding: 8px 12px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      direction: rtl;
      text-align: right;
    }
    .tg-bot .tg-bubble {
      background: #fff;
      color: #1a1a1a;
      border-bottom-left-radius: 4px;
    }
    .tg-user .tg-bubble {
      background: #229ED9;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .tg-time { font-size: 10px; color: #999; }
    .tg-user .tg-time { text-align: right; }
    .tg-typing {
      display: flex; gap: 4px; align-items: center;
      padding: 8px 12px;
      background: #fff;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }
    .tg-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: #aaa;
      animation: tgBounce 1s infinite;
    }
    .tg-typing span:nth-child(2) { animation-delay: .2s; }
    .tg-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes tgBounce {
      0%,80%,100% { transform: translateY(0); }
      40%          { transform: translateY(-5px); }
    }
    #tg-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #fff;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    #tg-input {
      flex: 1;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      direction: rtl;
      outline: none;
      font-family: inherit;
    }
    #tg-input:focus { border-color: #229ED9; }
    #tg-send {
      width: 36px; height: 36px; border-radius: 50%;
      background: #229ED9; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity .2s;
    }
    #tg-send:hover { opacity: .85; }
    #tg-send svg { width: 18px; height: 18px; fill: #fff; }
    #tg-open-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px;
      background: #f0f2f5;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #229ED9;
      text-decoration: none;
      flex-shrink: 0;
      cursor: pointer;
    }
    #tg-open-link:hover { background: #e5e7eb; }
    @media (max-width: 400px) {
      #tg-chat-box { width: calc(100vw - 24px); left: 12px; right: 12px; }
      #tg-fab-btn  { bottom: 16px; left: 16px; }
    }
  `;

  /* ────────────────────────────────────────
     ICONS (inline SVG — no external deps)
  ──────────────────────────────────────── */
  const iconTelegram = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>`;
  const iconSend     = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const iconRobot    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><path d="M8 8V6"/><path d="M16 8V6"/><circle cx="9" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.5" fill="currentColor" stroke="none"/><path d="M9 17h6"/></svg>`;
  const iconClose    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  const iconExternal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>`;

  /* ────────────────────────────────────────
     AUTO-REPLIES (بدون اتصال بـ API)
      — يمكن تخصيصها أو حذفها
  ──────────────────────────────────────── */
  const autoReplies = {
    '/start' : `أهلاً بك في بوت الطلبات البرلمانية 🏛️\n\nيمكنك:\n• إرسال رقم الطلب للبحث\n• /status للتحقق من الحالة\n• /help لعرض المساعدة`,
    '/help'  : `الأوامر المتاحة:\n/start — البداية\n/status — حالة النظام\n\nأو أرسل رقم الطلب مباشرةً للبحث عنه`,
    '/status': `✅ البوت يعمل بشكل طبيعي\n🔗 قاعدة البيانات: متصلة`,
  };

  /* ────────────────────────────────────────
     BUILD DOM
  ──────────────────────────────────────── */
  function now() {
    const d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  function build() {
    // inject styles
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // FAB button
    const fab = document.createElement('button');
    fab.id = 'tg-fab-btn';
    fab.setAttribute('aria-label', 'فتح البوت');
    fab.innerHTML = iconTelegram + `<span id="tg-fab-badge">1</span>`;
    document.body.appendChild(fab);

    // Chat box
    const box = document.createElement('div');
    box.id = 'tg-chat-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'محادثة البوت');
    box.innerHTML = `
      <div id="tg-chat-header">
        <div class="tg-avatar">${iconRobot.replace('stroke="currentColor"','stroke="#fff"')}</div>
        <div class="tg-info">
          <div class="tg-name">${BOT_DISPLAY}</div>
          <div class="tg-status">متصل الآن</div>
        </div>
        <button class="tg-close" id="tg-close-btn" aria-label="إغلاق">${iconClose.replace('stroke="currentColor"','stroke="#fff"')}</button>
      </div>
      <div id="tg-msgs"></div>
      <div id="tg-input-row">
        <button id="tg-send" aria-label="إرسال">${iconSend}</button>
        <input id="tg-input" type="text" placeholder="اكتب رسالة..." dir="rtl" maxlength="500" />
      </div>
      <a id="tg-open-link" href="https://t.me/${BOT_USERNAME}" target="_blank" rel="noopener">
        ${iconExternal.replace('stroke="currentColor"','stroke="#229ED9"').replace(/width=".*?" height=".*?"/,'')}
        <span style="width:14px;height:14px;display:inline-flex">
          ${iconExternal.replace('stroke="currentColor"','stroke="#229ED9"')}
        </span>
        فتح @${BOT_USERNAME} في تليجرام
      </a>
    `;
    document.body.appendChild(box);

    // Wire events
    fab.addEventListener('click', toggle);
    document.getElementById('tg-close-btn').addEventListener('click', close);
    document.getElementById('tg-send').addEventListener('click', sendMsg);
    document.getElementById('tg-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

    // Welcome message
    addBotMsg(autoReplies['/start']);

    if (OPEN_ON_LOAD) open();
  }

  /* ────────────────────────────────────────
     CHAT LOGIC
  ──────────────────────────────────────── */
  let isOpen = false;

  function toggle() { isOpen ? close() : open(); }

  function open() {
    isOpen = true;
    document.getElementById('tg-chat-box').classList.add('tg-open');
    document.getElementById('tg-fab-badge').style.display = 'none';
    document.getElementById('tg-input').focus();
  }

  function close() {
    isOpen = false;
    document.getElementById('tg-chat-box').classList.remove('tg-open');
  }

  function addMsg(text, from) {
    const container = document.getElementById('tg-msgs');
    const div = document.createElement('div');
    div.className = 'tg-msg tg-' + from;
    div.innerHTML = `<div class="tg-bubble">${text.replace(/\n/g,'<br>')}</div><div class="tg-time">${now()}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addBotMsg(text) { addMsg(text, 'bot'); }

  function showTyping() {
    const container = document.getElementById('tg-msgs');
    const div = document.createElement('div');
    div.className = 'tg-msg tg-bot';
    div.id = 'tg-typing';
    div.innerHTML = '<div class="tg-typing"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('tg-typing');
    if (t) t.remove();
  }

  function sendMsg() {
    const input = document.getElementById('tg-input');
    const text  = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    botReply(text);
  }

  function botReply(userText) {
    showTyping();
    setTimeout(() => {
      removeTyping();
      const t = userText.trim().toLowerCase();

      // أوامر محددة
      if (autoReplies[t]) {
        addBotMsg(autoReplies[t]);
        return;
      }

      // البحث برقم الطلب في requestsData (إذا كان متاحاً في الصفحة)
      if (/^\d+$/.test(t) && window.requestsData) {
        const req = window.requestsData.find(r => r.reqId == t);
        if (req) {
          const statusMap = { pending:'قيد الانتظار', approved:'موافق عليه', rejected:'مرفوض', inprogress:'قيد التنفيذ' };
          addBotMsg(
            `📋 طلب رقم #${req.reqId}\n` +
            `📌 العنوان: ${req.title}\n` +
            `🏛️ الجهة: ${req.authority || '—'}\n` +
            `📅 التاريخ: ${req.reqDate || '—'}\n` +
            `🔵 الحالة: ${statusMap[req.status] || req.status}`
          );
        } else {
          addBotMsg(`⚠️ لم يُعثر على طلب برقم #${t}.\nتحقق من الرقم وأعد المحاولة.`);
        }
        return;
      }

      // رد افتراضي
      addBotMsg('لم أفهم رسالتك 🤔\nأرسل /help لعرض الأوامر المتاحة،\nأو رقم الطلب للبحث عنه.');
    }, 800);
  }

  /* ────────────────────────────────────────
     INIT
  ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
