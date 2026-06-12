(function () {
  'use strict';

  /* ─────────────────────────────────────────
     CONFIG — عدّل هذا السطر فقط
  ───────────────────────────────────────── */
  const WORKER_URL   = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev';
  const BOT_USERNAME = 'AhmedAlHadidiBot';
  const BOT_DISPLAY  = 'بوت إدارة الطلبات';

  /* ─────────────────────────────────────────
     STYLES
  ───────────────────────────────────────── */
  const css = `
    #tg-fab {
      position:fixed; bottom:24px; left:24px;
      width:56px; height:56px; border-radius:50%;
      background:#229ED9; border:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 20px rgba(34,158,217,.4);
      z-index:9999; transition:transform .2s;
    }
    #tg-fab:hover{transform:scale(1.08);}
    #tg-fab svg{width:28px;height:28px;fill:#fff;}
    #tg-badge{
      position:absolute;top:-2px;right:-2px;
      width:18px;height:18px;border-radius:50%;
      background:#e24b4a;color:#fff;font-size:10px;
      font-family:sans-serif;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;
    }
    #tg-box{
      position:fixed;bottom:90px;left:24px;
      width:320px;height:440px;
      background:#fff;border-radius:16px;
      box-shadow:0 8px 32px rgba(0,0,0,.15);
      display:flex;flex-direction:column;overflow:hidden;
      z-index:9998;font-family:'Segoe UI',Tahoma,sans-serif;
      opacity:0;pointer-events:none;
      transform:translateY(12px) scale(.97);
      transition:opacity .22s,transform .22s;
    }
    #tg-box.open{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}
    #tg-header{
      display:flex;align-items:center;gap:10px;
      padding:12px 14px;background:#229ED9;flex-shrink:0;
    }
    .tg-av{
      width:36px;height:36px;border-radius:50%;
      background:rgba(255,255,255,.25);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .tg-av svg{width:20px;height:20px;stroke:#fff;fill:none;}
    .tg-inf{flex:1;}
    .tg-name{font-size:14px;font-weight:600;color:#fff;}
    .tg-stat{font-size:11px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:4px;}
    .tg-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;}
    .tg-hbtn{
      background:none;border:none;cursor:pointer;
      color:rgba(255,255,255,.8);font-size:20px;
      line-height:1;padding:4px 6px;border-radius:6px;
    }
    .tg-hbtn:hover{background:rgba(255,255,255,.15);color:#fff;}
    #tg-msgs{
      flex:1;overflow-y:auto;padding:12px;
      display:flex;flex-direction:column;gap:8px;
      background:#f0f2f5;scroll-behavior:smooth;
    }
    .tm{max-width:82%;display:flex;flex-direction:column;gap:2px;}
    .tm.bot{align-self:flex-start;}
    .tm.usr{align-self:flex-end;}
    .tb{
      padding:9px 13px;border-radius:14px;
      font-size:13px;line-height:1.55;
      direction:rtl;text-align:right;word-break:break-word;
    }
    .bot .tb{background:#fff;color:#1a1a1a;border-bottom-left-radius:4px;}
    .usr .tb{background:#229ED9;color:#fff;border-bottom-right-radius:4px;}
    .tt{font-size:10px;color:#999;}
    .usr .tt{text-align:right;}
    .typing-wrap{align-self:flex-start;}
    .typing-dots{
      display:flex;gap:4px;align-items:center;
      padding:10px 14px;background:#fff;
      border-radius:14px;border-bottom-left-radius:4px;
    }
    .typing-dots span{
      width:7px;height:7px;border-radius:50%;background:#bbb;
      animation:tgb 1s infinite;
    }
    .typing-dots span:nth-child(2){animation-delay:.2s;}
    .typing-dots span:nth-child(3){animation-delay:.4s;}
    @keyframes tgb{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
    #tg-inp-row{
      display:flex;align-items:center;gap:8px;
      padding:10px 12px;background:#fff;
      border-top:1px solid #e5e7eb;flex-shrink:0;
    }
    #tg-inp{
      flex:1;border:1px solid #d1d5db;border-radius:20px;
      padding:8px 14px;font-size:13px;direction:rtl;
      outline:none;font-family:inherit;
    }
    #tg-inp:focus{border-color:#229ED9;}
    #tg-inp:disabled{background:#f9fafb;cursor:not-allowed;}
    #tg-send{
      width:36px;height:36px;border-radius:50%;
      background:#229ED9;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      transition:opacity .2s;
    }
    #tg-send:hover{opacity:.85;}
    #tg-send:disabled{opacity:.4;cursor:not-allowed;}
    #tg-send svg{width:17px;height:17px;fill:#fff;}
    #tg-footer{
      display:flex;align-items:center;justify-content:center;gap:6px;
      padding:7px 12px;background:#f8fafc;
      border-top:1px solid #e5e7eb;flex-shrink:0;
      text-decoration:none;font-size:11px;color:#229ED9;
      cursor:pointer;
    }
    #tg-footer:hover{background:#f0f2f5;}
    #tg-footer svg{width:13px;height:13px;stroke:#229ED9;fill:none;flex-shrink:0;}
    @media(max-width:400px){
      #tg-box{width:calc(100vw - 24px);left:12px;}
      #tg-fab{bottom:16px;left:16px;}
    }
  `;

  const svgTg = `<svg viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>`;
  const svgSend = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const svgBot  = `<svg viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1" fill="#fff" stroke="none"/><circle cx="9" cy="13" r="1.5" fill="#fff" stroke="none"/><circle cx="15" cy="13" r="1.5" fill="#fff" stroke="none"/><path d="M9 17h6" stroke-linecap="round"/></svg>`;
  const svgExt  = `<svg viewBox="0 0 24 24" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>`;

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */
  let isOpen    = false;
  let isBusy    = false;
  const chatId  = 'web_' + Math.random().toString(36).slice(2, 10);

  /* ─────────────────────────────────────────
     BUILD
  ───────────────────────────────────────── */
  function build() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // FAB
    const fab = document.createElement('button');
    fab.id = 'tg-fab';
    fab.setAttribute('aria-label', 'فتح البوت');
    fab.innerHTML = svgTg + `<span id="tg-badge">1</span>`;
    document.body.appendChild(fab);
    fab.addEventListener('click', toggle);

    // Box
    const box = document.createElement('div');
    box.id = 'tg-box';
    box.setAttribute('role','dialog');
    box.setAttribute('aria-label','محادثة البوت');
    box.innerHTML = `
      <div id="tg-header">
        <div class="tg-av">${svgBot}</div>
        <div class="tg-inf">
          <div class="tg-name">${BOT_DISPLAY}</div>
          <div class="tg-stat"><span class="tg-dot"></span>متصل الآن</div>
        </div>
        <button class="tg-hbtn" id="tg-close" aria-label="إغلاق">✕</button>
      </div>
      <div id="tg-msgs"></div>
      <div id="tg-inp-row">
        <button id="tg-send" aria-label="إرسال">${svgSend}</button>
        <input id="tg-inp" type="text" placeholder="اكتب رسالة..." dir="rtl" maxlength="500" />
      </div>
      <a id="tg-footer" href="https://t.me/${BOT_USERNAME}" target="_blank" rel="noopener">
        ${svgExt} فتح @${BOT_USERNAME} في تليجرام
      </a>
    `;
    document.body.appendChild(box);

    document.getElementById('tg-close').addEventListener('click', close);
    document.getElementById('tg-send').addEventListener('click', sendMsg);
    document.getElementById('tg-inp').addEventListener('keydown', e => { if (e.key === 'Enter' && !isBusy) sendMsg(); });

    // رسالة ترحيب أولى عبر الـ Worker
    sendToWorker('/start').then(reply => addMsg(reply, 'bot'));
  }

  /* ─────────────────────────────────────────
     TOGGLE
  ───────────────────────────────────────── */
  function toggle() { isOpen ? close() : open(); }

  function open() {
    isOpen = true;
    document.getElementById('tg-box').classList.add('open');
    document.getElementById('tg-badge').style.display = 'none';
    setTimeout(() => document.getElementById('tg-inp').focus(), 250);
  }

  function close() {
    isOpen = false;
    document.getElementById('tg-box').classList.remove('open');
  }

  /* ─────────────────────────────────────────
     MESSAGES
  ───────────────────────────────────────── */
  function now() {
    const d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  function addMsg(text, from) {
    const container = document.getElementById('tg-msgs');
    const wrap = document.createElement('div');
    wrap.className = 'tm ' + (from === 'bot' ? 'bot' : 'usr');
    // تحويل *bold* و줄 breaks
    const formatted = text
      .replace(/\*(.*?)\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');
    wrap.innerHTML = `<div class="tb">${formatted}</div><div class="tt">${now()}</div>`;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('tg-msgs');
    const wrap = document.createElement('div');
    wrap.className = 'tm bot typing-wrap';
    wrap.id = 'tg-typing';
    wrap.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('tg-typing');
    if (t) t.remove();
  }

  function setInputBusy(busy) {
    isBusy = busy;
    document.getElementById('tg-inp').disabled  = busy;
    document.getElementById('tg-send').disabled = busy;
  }

  /* ─────────────────────────────────────────
     SEND
  ───────────────────────────────────────── */
  async function sendMsg() {
    const inp  = document.getElementById('tg-inp');
    const text = inp.value.trim();
    if (!text || isBusy) return;

    addMsg(text, 'usr');
    inp.value = '';
    setInputBusy(true);
    showTyping();

    try {
      const reply = await sendToWorker(text);
      removeTyping();
      addMsg(reply, 'bot');
    } catch (err) {
      removeTyping();
      addMsg('❌ تعذّر الاتصال بالسيرفر.\nتحقق من اتصالك بالإنترنت.', 'bot');
    } finally {
      setInputBusy(false);
      inp.focus();
    }
  }

  /* ─────────────────────────────────────────
     WORKER API
  ───────────────────────────────────────── */
  async function sendToWorker(text) {
    const res = await fetch(`${WORKER_URL}/chat`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ chatId, text })
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    return data.reply || '...';
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
