/* =====================================================================
   章節測驗引擎（版型單一來源）
   ---------------------------------------------------------------------
   這支負責「長什麼樣子」與「怎麼跑」，完全不含任何課程內容。
   內容一律由 content/*.js 提供 window.QUIZ_CONTENT。

   用法（頁面外殼只要三行）：
     <script src="content/ethics.js"></script>        內容資料
     <script src="shared/quiz-engine.js"></script>    版型與流程（本檔）
     <script type="module" src="shared/quiz-firebase.js"></script>  資料庫接線

   ★ 這裡就是正本，改這裡就好。
     ⚠️ 這幾行本來寫著「請改 _shared/quiz-engine.js 再執行 sync_shared.py」——
        那是 2026-07 併成單一 repo **之前**的做法，那支檔案和那個腳本都已經不存在。
        照著做的話會去改一個不存在的檔案，然後以為改好了（見 docs/01 §3）。

   ⚠️ 本檔刻意寫成「一般 script」而非 module：
      module 會被延後執行，已登入的學生會先看到空白畫面再跳章節頁。
      一般 script 解析到就執行，畫面不會閃。
   ===================================================================== */
(function () {
  'use strict';

  var C = window.QUIZ_CONTENT;
  if (!C) { console.error('[quiz-engine] 找不到 window.QUIZ_CONTENT，請先載入內容資料檔'); return; }

  /* ★★ 讀完就把它從 window 上拿掉（老師 2026-08-17 問「還有什麼漏洞」）。
     ⚠️ 原本題庫掛在全域，學生在 Console 打一行 `QUIZ_CONTENT`，
        370 題一次全部帶走 —— 擋複製擋的是一題一題，這裡是整批。
     ★ 拿掉之後題目只活在這個閉包裡，Console 讀不到。
     ⚠️ 但這**不是**把題庫藏起來了：content/*.js 本身還是公開的檔案，
        view-source 或直接開 GitHub 都拿得到（repo 是公開的）。
        這一步擋的是「在考試當下順手一行帶走」，不是「拿不到題庫」。
     ⚠️ quiz-firebase.js 是 module，會在這支之後才執行 ——
        它只用 window.QUIZ 檢查引擎在不在，不讀 QUIZ_CONTENT（已確認）。 */
  try { delete window.QUIZ_CONTENT; }
  catch (e) { window.QUIZ_CONTENT = undefined; }

  // ── 預設值：內容資料沒寫的就用這些 ────────────────────────
  var TARGET    = C.target   || 10;   // 目標連對題數
  var MAX_WRONG = C.maxWrong || 20;   // 容錯上限，超過就跳學習警示單
  var KEEP      = C.keepRecords || 3; // 每個章節保留幾筆闖關紀錄

  /* ===================================================================
     色票：不用字串拼接組 class，避免 Tailwind CDN 掃不到而失效
     每個模組色都要在這裡登記一組，對照《設計規範》的模組代表色
     =================================================================== */
  var PALETTE = {
    pink:    { text:'text-pink-600',    textDark:'text-pink-700',    hover:'hover:text-pink-500',    bg:'bg-pink-600',    bgHover:'hover:bg-pink-700',    soft:'bg-pink-50',    softText:'text-pink-700',    softHover:'hover:bg-pink-600',    chip:'bg-pink-100 text-pink-700 border-pink-300',       border:'border-pink-500',    optHover:'hover:bg-pink-50 hover:border-pink-300',       optSel:['bg-pink-100','border-pink-500','text-pink-800'],       shadow:'shadow-pink-100' },
    blue:    { text:'text-blue-600',    textDark:'text-blue-700',    hover:'hover:text-blue-500',    bg:'bg-blue-600',    bgHover:'hover:bg-blue-700',    soft:'bg-blue-50',    softText:'text-blue-700',    softHover:'hover:bg-blue-600',    chip:'bg-blue-100 text-blue-700 border-blue-300',       border:'border-blue-500',    optHover:'hover:bg-blue-50 hover:border-blue-300',       optSel:['bg-blue-100','border-blue-500','text-blue-800'],       shadow:'shadow-blue-100' },
    emerald: { text:'text-emerald-600', textDark:'text-emerald-700', hover:'hover:text-emerald-500', bg:'bg-emerald-600', bgHover:'hover:bg-emerald-700', soft:'bg-emerald-50', softText:'text-emerald-700', softHover:'hover:bg-emerald-600', chip:'bg-emerald-100 text-emerald-700 border-emerald-300', border:'border-emerald-500', optHover:'hover:bg-emerald-50 hover:border-emerald-300', optSel:['bg-emerald-100','border-emerald-500','text-emerald-800'], shadow:'shadow-emerald-100' },
    purple:  { text:'text-purple-600',  textDark:'text-purple-700',  hover:'hover:text-purple-500',  bg:'bg-purple-600',  bgHover:'hover:bg-purple-700',  soft:'bg-purple-50',  softText:'text-purple-700',  softHover:'hover:bg-purple-600',  chip:'bg-purple-100 text-purple-700 border-purple-300',   border:'border-purple-500',  optHover:'hover:bg-purple-50 hover:border-purple-300',   optSel:['bg-purple-100','border-purple-500','text-purple-800'],   shadow:'shadow-purple-100' },
    orange:  { text:'text-orange-600',  textDark:'text-orange-700',  hover:'hover:text-orange-500',  bg:'bg-orange-600',  bgHover:'hover:bg-orange-700',  soft:'bg-orange-50',  softText:'text-orange-700',  softHover:'hover:bg-orange-600',  chip:'bg-orange-100 text-orange-700 border-orange-300',   border:'border-orange-500',  optHover:'hover:bg-orange-50 hover:border-orange-300',   optSel:['bg-orange-100','border-orange-500','text-orange-800'],   shadow:'shadow-orange-100' },
    teal:    { text:'text-teal-600',    textDark:'text-teal-700',    hover:'hover:text-teal-500',    bg:'bg-teal-600',    bgHover:'hover:bg-teal-700',    soft:'bg-teal-50',    softText:'text-teal-700',    softHover:'hover:bg-teal-600',    chip:'bg-teal-100 text-teal-700 border-teal-300',       border:'border-teal-500',    optHover:'hover:bg-teal-50 hover:border-teal-300',       optSel:['bg-teal-100','border-teal-500','text-teal-800'],       shadow:'shadow-teal-100' }
  };
  var MAIN = PALETTE[C.color] || PALETTE.pink;   // 全站主色（登入頁、測驗頁、通關卡）
  function pal(name) { return PALETTE[name] || MAIN; }

  /* ===================================================================
     1. 樣式：版型的一部分，跟著引擎走，不放在各頁
     =================================================================== */
  var STYLE = ''
    + "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');"
    + "body{font-family:'Noto Sans TC',sans-serif;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);min-height:100vh}"
    + ".glass-card{background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-radius:1.5rem;box-shadow:0 15px 35px rgba(0,0,0,.1)}"
    + ".pass-card{background:#fff;border:4px solid #3b82f6;position:relative;overflow:hidden}"
    + ".pass-card::before{content:'PASSED';position:absolute;top:30px;right:-40px;transform:rotate(45deg);background:#10b981;color:#fff;padding:8px 50px;font-weight:900;font-size:1rem;box-shadow:0 4px 6px rgba(0,0,0,.1);z-index:10}"
    + ".study-note-box{background:#fffdf5;border-left:6px solid #f59e0b}"
    + ".study-note-box h4{color:#b45309;font-weight:900;margin-top:1rem;margin-bottom:.5rem;font-size:1.1rem}"
    + ".study-note-box ul{list-style-type:disc;padding-left:1.5rem;margin-bottom:1rem}"
    + ".study-note-box p{margin-bottom:.5rem}"
    + ".study-note-box .sec-head{margin-top:2rem;padding-top:1rem;border-top:2px dashed #fcd34d;color:#92400e;font-weight:900;font-size:1.25rem}"
    + ".study-note-box .sec-head:first-child{margin-top:0;padding-top:0;border-top:0}"
    + "@keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}"
    + ".animate-pop{animation:pop .4s cubic-bezier(.175,.885,.32,1.275) forwards}"
    + ".pdf-link{display:inline-flex;align-items:center;background-color:#ef4444;color:#fff;font-size:.75rem;padding:4px 12px;border-radius:9999px;margin-left:12px;font-weight:700;transition:all .2s;box-shadow:0 2px 4px rgba(239,68,68,.2);text-decoration:none}"
    + ".pdf-link:hover{background-color:#b91c1c;transform:translateY(-2px);box-shadow:0 4px 6px rgba(185,28,28,.3)}"
    + ".hl{background:linear-gradient(transparent 52%,rgba(250,204,21,.65) 52%);font-weight:800}"
    + ".hl-b{background:linear-gradient(transparent 52%,rgba(147,197,253,.7) 52%);font-weight:800}";

  /* ===================================================================
     2. 章節資料整理：把內容資料攤平成引擎好用的形式
     =================================================================== */
  var NODES = {};    // id -> { id, title, notes, questions }
  var ORDER = [];    // 所有可挑戰的 id，順序即畫面順序（用來算「已通關 n / 全部」）

  C.chapters.forEach(function (ch) {
    var secs = ch.sections || [];
    secs.forEach(function (s) {
      NODES[s.id] = { id:s.id, title:s.title, notes:s.notes || '', questions:s.questions || [] };
      ORDER.push(s.id);
    });
    if (ch.challenge) {
      var cg = ch.challenge;
      // 整章挑戰沒給題庫就自動合併小節題庫；沒給教材就自動串接小節教材
      var qs = cg.questions || secs.reduce(function (a, s) { return a.concat(s.questions || []); }, []);
      var nt = cg.notes;
      if (!nt) {
        nt = secs.map(function (s) {
          return '<div class="sec-head">' + s.title + '</div>' + (s.notes || '');
        }).join('');
      }
      NODES[cg.id] = { id:cg.id, title:cg.title || ch.title, notes:nt, questions:qs };
      ORDER.push(cg.id);
    }
  });

  /* ===================================================================
     3. 版型：整個畫面由這裡產生，兩個學期共用同一份
     =================================================================== */
  function chapterCard(ch) {
    var p = pal(ch.color);
    var secs = ch.sections || [];
    var cg = ch.challenge;
    var html = '<div class="p-5 border-2 border-slate-50 rounded-2xl bg-white shadow-sm hover:shadow-md transition">';

    // 大標題（本身就是整章測驗的入口）
    if (cg && cg.style !== 'block') {
      html += '<div class="flex justify-between items-start mb-4"><div class="flex flex-wrap items-center">'
           +    '<button data-ch="' + cg.id + '" class="qz-open text-xl font-black ' + p.textDark
           +    ' text-left ' + p.hover + ' hover:underline transition flex items-center cursor-pointer">'
           +    ch.title
           +    '<span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ' + p.chip + '">'
           +    (cg.label || '🎯 點我挑戰整章測驗') + '</span></button>'
           +    (ch.pdf ? '<a href="' + ch.pdf + '" target="_blank" class="pdf-link">課本教材 PDF</a>' : '')
           +  '</div></div>';
    } else {
      html += '<div class="flex justify-between items-start mb-4"><div class="flex flex-wrap items-center">'
           +    '<h3 class="text-xl font-black ' + p.textDark + '">' + ch.title + '</h3>'
           +    (ch.pdf ? '<a href="' + ch.pdf + '" target="_blank" class="pdf-link">課本教材 PDF</a>' : '')
           +  '</div></div>';
    }

    // 小節按鈕：一律兩欄起跳，桌機最多三欄（版型固定，不由內容決定）
    if (secs.length) {
      html += '<div class="grid grid-cols-2 md:grid-cols-3 gap-3">';
      secs.forEach(function (s) {
        html += '<button data-ch="' + s.id + '" class="qz-open py-2 ' + p.soft + ' ' + p.softText
             +  ' rounded-lg font-bold text-xs ' + p.softHover + ' hover:text-white transition">' + s.title + '</button>';
      });
      html += '</div>';
    }

    // 沒有小節、只有一顆大按鈕的章節（例如總整理與綜合測驗）
    if (cg && cg.style === 'block') {
      html += '<button data-ch="' + cg.id + '" class="qz-open w-full py-3 ' + p.soft + ' ' + p.softText
           +  ' rounded-lg font-bold text-sm ' + p.softHover + ' hover:text-white transition">'
           +  (cg.label || '開始挑戰') + '</button>';
    }
    return html + '</div>';
  }

  function render() {
    var s = document.createElement('style'); s.textContent = STYLE; document.head.appendChild(s);
    if (C.siteTitle) document.title = C.siteTitle;
    document.body.className = 'p-4 md:p-8 text-slate-800';

    var hubHref = (C.hubPage || 'hub.html');
    var html = ''

    // 返回基地：固定左上，每頁只放一顆
    + '<a id="back-to-hub" href="' + hubHref + '" title="返回闖關基地" style="position:fixed;top:1rem;left:1rem;z-index:9999;display:inline-flex;align-items:center;gap:.35rem;background:#1e293b;color:#fff;font-weight:700;font-size:.875rem;padding:.5rem .875rem;border-radius:9999px;box-shadow:0 10px 15px -3px rgba(0,0,0,.2);text-decoration:none;">&#8592; 返回基地</a>'

    + '<div id="app" class="max-w-2xl mx-auto">'

    // 1. 身分確認
    +   '<div id="login-screen" class="glass-card p-10 max-w-md mx-auto mt-8 text-center">'
    +     '<span class="' + MAIN.text + ' font-bold tracking-widest uppercase text-sm">' + (C.schoolLine || '') + '</span>'
    +     '<h1 class="text-3xl font-black text-slate-800 mt-2 leading-tight">' + (C.headline || '') + '</h1>'
    +     '<p id="sso-msg" class="mt-8 text-slate-500 font-bold">正在從闖關基地確認身分…</p>'
    +   '</div>'

    // 2. 章節選擇
    +   '<div id="chapter-screen" class="glass-card p-10 hidden animate-pop">'
    +     '<div class="text-center mb-8">'
    +       '<h2 id="welcome-info" class="text-lg font-bold text-slate-500 mb-2"></h2>'
    +       '<h2 class="text-2xl font-black text-slate-800">請選擇學習章節</h2>'
    +       '<p id="chapter-progress" class="mt-2 text-sm font-bold text-slate-500">讀取進度中…</p>'
    +       '<p class="mt-1 text-xs text-slate-400 leading-relaxed">💡 小提示：<span class="hl">章節大標題也是測驗</span>，點下去可一次挑戰整章；下方小方塊則是單一小節的測驗。</p>'
    +     '</div>'
    +     '<div class="space-y-6">' + C.chapters.map(chapterCard).join('') + '</div>'
    +   '</div>'

    // 3. 章節重點閱讀
    +   '<div id="study-screen" class="glass-card p-8 hidden animate-pop">'
    +     '<h2 id="study-title" class="text-2xl font-black text-slate-800 mb-6 border-b-4 ' + MAIN.border + ' pb-2 inline-block">章節重點</h2>'
    +     '<div id="study-content" class="study-note-box p-6 mb-8 text-slate-700 leading-relaxed space-y-4 text-lg max-h-[60vh] overflow-y-auto"></div>'
    +     '<div class="flex space-x-4">'
    +       '<button id="back-chapters-btn" class="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">返回目錄</button>'
    +       '<button id="start-quiz-btn" class="flex-2 px-10 py-4 ' + MAIN.bg + ' text-white font-black rounded-xl ' + MAIN.bgHover + ' shadow-lg ' + MAIN.shadow + ' transition transform active:scale-95">開始測驗挑戰</button>'
    +     '</div>'
    +   '</div>'

    // 4. 測驗
    +   '<div id="quiz-screen" class="glass-card p-8 hidden animate-pop">'
    +     '<div class="flex justify-between items-center mb-8 border-b pb-6">'
    +       '<div class="max-w-[70%]">'
    +         '<div id="current-chapter-title" class="' + MAIN.text + ' font-black text-xl leading-tight"></div>'
    +         '<div class="flex items-center space-x-3 mt-2">'
    +           '<span id="score-counter" class="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-black shadow-sm">連對: 0 / ' + TARGET + '</span>'
    +           '<span id="target-counter" class="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full font-bold">目標連對: ' + TARGET + '</span>'
    +           '<span id="wrong-counter" class="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-bold shadow-sm">容錯: ' + MAX_WRONG + '</span>'
    +         '</div>'
    +       '</div>'
    +       '<div id="timer" class="text-red-500 font-mono font-black text-2xl bg-red-50 px-4 py-1 rounded-lg border border-red-100">00:00</div>'
    +     '</div>'
    +     '<div id="question-container" class="min-h-[300px]"></div>'
    +     '<div class="mt-10 flex justify-end">'
    +       '<button id="next-btn" class="px-10 py-4 ' + MAIN.bg + ' text-white font-black rounded-xl shadow-xl ' + MAIN.bgHover + ' transition transform active:scale-95">送出答案</button>'
    +     '</div>'
    +   '</div>'

    // 5. 通關卡
    +   '<div id="result-screen" class="glass-card p-8 hidden animate-pop">'
    +     '<div class="pass-card rounded-[2rem] p-8 shadow-2xl">'
    +       '<div class="text-center mb-6">'
    +         '<h2 class="text-4xl font-black ' + MAIN.text + ' italic underline tracking-tighter uppercase">QUIZ PASS CARD</h2>'
    +         '<p class="text-[10px] text-slate-400 font-bold tracking-[0.3em] mt-1">INFORMATION TECHNOLOGY LEARNING SYSTEM</p>'
    +       '</div>'
    +       '<div class="bg-slate-50/50 border-y-4 border-double border-slate-100 rounded-xl p-6 mb-6">'
    +         '<div class="flex justify-around items-center mb-4">'
    +           '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">Class</span><span id="res-class" class="text-2xl font-black text-slate-800"></span></div>'
    +           '<div class="h-8 w-[2px] bg-slate-200"></div>'
    +           '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">No.</span><span id="res-no" class="text-2xl font-black text-slate-800"></span></div>'
    +           '<div class="h-8 w-[2px] bg-slate-200"></div>'
    +           '<div class="text-center"><span class="block text-[10px] text-slate-400 font-black uppercase mb-1">Name</span><span id="res-name" class="text-2xl font-black text-slate-800"></span></div>'
    +         '</div>'
    +         '<div class="text-center pt-2 border-t border-slate-100"><span class="text-[10px] text-slate-400 font-black uppercase mr-2">Challenge Date:</span><span id="res-date" class="text-sm font-bold text-slate-600 tracking-widest"></span></div>'
    +       '</div>'
    +       '<div class="space-y-4 mb-8">'
    +         '<div class="bg-slate-50 p-5 rounded-2xl border border-slate-100"><span class="text-[10px] text-slate-400 font-black uppercase block mb-1">Completed Chapter</span><span id="res-chapter" class="font-black ' + MAIN.textDark + ' text-lg leading-tight"></span></div>'
    +         '<div class="grid grid-cols-2 gap-4">'
    +           '<div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center"><span class="text-[10px] text-slate-400 font-black block mb-1">DURATION</span><span id="res-duration" class="font-black text-orange-600 text-lg"></span></div>'
    +           '<div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center"><span class="text-[10px] text-slate-400 font-black block mb-1">ACCURACY</span><span id="res-rate" class="font-black text-green-600 text-lg">0%</span></div>'
    +         '</div>'
    +       '</div>'
    +       '<div class="grid grid-cols-2 gap-4 text-center mb-8">'
    +         '<div><div class="text-[10px] text-slate-400 font-bold">CORRECT</div><div id="res-correct" class="text-2xl font-black text-green-500">0</div></div>'
    +         '<div><div class="text-[10px] text-slate-400 font-bold">TOTAL Q.</div><div id="res-total" class="text-2xl font-black text-slate-800">0</div></div>'
    +       '</div>'
    +       '<p id="pass-msg" class="text-center text-sm text-slate-400 mb-8 italic font-bold"></p>'
    +       '<button id="cert-return-btn" class="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-black transition transform active:scale-95">完成挑戰</button>'
    +     '</div>'
    +   '</div>'

    // 6. 學習狀態警示單
    +   '<div id="warning-screen" class="glass-card p-8 hidden animate-pop">'
    +     '<div class="bg-white border-4 border-red-500 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">'
    +       '<div class="absolute top-0 left-0 w-full h-4 bg-red-500"></div>'
    +       '<div class="text-center mb-6 mt-4"><h2 class="text-4xl font-black text-red-600 italic tracking-tighter uppercase">LEARNING WARNING</h2><p class="text-xs text-red-400 font-bold tracking-[0.2em] mt-2">學習狀態警示單</p></div>'
    +       '<div class="bg-red-50 p-6 rounded-xl border border-red-100 text-center mb-8">'
    +         '<div class="text-6xl mb-4">⚠️</div>'
    +         '<h3 class="text-2xl font-black text-slate-800 mb-3">累積答錯已達 ' + MAX_WRONG + ' 題！</h3>'
    +         '<p class="text-slate-600 font-bold leading-relaxed text-lg">看來學習遇到了一點小瓶頸呢。<br>請先暫停測驗，<span class="text-red-600 underline">重新閱讀課本</span>或<span class="text-red-600 underline">仔細查看重點整理</span>後，準備好再來挑戰吧！</p>'
    +       '</div>'
    +       '<button id="warn-back-btn" class="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-red-700 transition transform active:scale-95">返回閱讀重點</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'

    // 提示框
    + '<div id="modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center p-4 z-50 backdrop-blur-sm">'
    +   '<div class="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border-4 ' + MAIN.border + '">'
    +     '<h3 id="modal-title" class="text-2xl font-black mb-4 ' + MAIN.text + '">提示</h3>'
    +     '<p id="modal-msg" class="text-slate-600 font-bold mb-8 text-lg"></p>'
    +     '<div class="flex justify-end"><button id="modal-ok" class="w-full py-3 ' + MAIN.bg + ' text-white rounded-xl font-black ' + MAIN.bgHover + ' transition">我知道了</button></div>'
    +   '</div>'
    + '</div>'

    // 闖關紀錄
    + '<div id="action-modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center p-4 z-50 backdrop-blur-sm">'
    +   '<div class="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-emerald-500">'
    +     '<h3 class="text-2xl font-black mb-2 text-emerald-600">過關紀錄查詢</h3>'
    +     '<p class="text-slate-600 font-bold mb-6 text-sm">你已經通過這個章節了，這是你的輝煌紀錄！</p>'
    +     '<div id="history-list" class="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2"></div>'
    +     '<div class="flex space-x-3">'
    +       '<button id="hist-close" class="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-black hover:bg-slate-300 transition shadow-sm">返回目錄</button>'
    +       '<button id="hist-again" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition shadow-sm">再次闖關</button>'
    +     '</div>'
    +   '</div>'
    + '</div>';

    // ⚠️ 用「附加容器」而不是覆寫 body.innerHTML：
    //    覆寫會把後面還沒執行的 <script type="module"> 一起清掉，資料庫就接不上了。
    var root = document.createElement('div');
    root.id = 'qz-root';
    root.innerHTML = html;
    document.body.appendChild(root);

    if (window.self !== window.top) {
      var b = document.getElementById('back-to-hub'); if (b) b.style.display = 'none';
    }
  }

  /* ===================================================================
     4. 狀態
     =================================================================== */
  var user = { cls:'', no:'', name:'' };
  var currentId = '';
  var pool = [], current = null, streak = 0, score = 0, wrong = 0, picked = -1;
  /* 這一次挑戰的逐題紀錄 { 題id: {n, ok} }。挑戰結束才寫出去，見 saveStat()。 */
  var runStat = {};
  var timer = null, seconds = 0;
  // 闖關紀錄直接讀 progress 文件的 history（原本另開 quiz_records 集合，已廢除）
  var recent = [];           // 目前章節最近幾次的紀錄，由新到舊
  var identified = false;

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { $(id).classList.remove('hidden'); };
  var hide = function (id) { $(id).classList.add('hidden'); };

  function showModal(title, msg) {
    $('modal-title').textContent = title; $('modal-msg').textContent = msg;
    $('modal').classList.remove('hidden'); $('modal').classList.add('flex');
  }

  /* ===================================================================
     5. 畫面流程
     =================================================================== */
  function enterChapters() {
    hide('login-screen'); show('chapter-screen');
    $('welcome-info').textContent = user.cls + '班 ' + user.no + '號 ' + user.name + '，歡迎登入';
    setTimeout(paintBadges, 300);
  }

  function openChapter(id) {
    currentId = id;

    // 沒接上進度模組（或讀不到）就直接進閱讀頁，不擋學生
    if (!window.REPORT) { proceedToStudy(id); return; }

    window.REPORT.history(C.moduleId, id).then(function (list) {
      recent = (list || []).slice(0, KEEP);
      if (!recent.length) { proceedToStudy(id); return; }

      $('history-list').innerHTML = recent.map(function (h, i) {
        var d = new Date(h.at).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        return '<div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-3 shadow-sm flex justify-between items-center gap-2">'
             +   '<div><div class="text-xs text-slate-400 font-black mb-1 tracking-wider uppercase">History ' + (i+1) + ' &bull; ' + d + '</div>'
             +   '<div class="flex items-center gap-3 mt-1"><span class="text-emerald-700 font-black text-sm md:text-lg">正確率: ' + (h.score || 0) + '%</span>'
             +   '<span class="text-orange-500 font-bold bg-white px-2 py-1 rounded-md text-xs md:text-sm border border-orange-100">耗時: ' + (h.duration || '—') + '</span></div></div>'
             +   '<button data-rec="' + i + '" class="qz-cert shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-lg transition shadow-sm">檢視證書</button>'
             + '</div>';
      }).join('');
      $('action-modal').classList.remove('hidden'); $('action-modal').classList.add('flex');
    }).catch(function (e) {
      console.error('讀取闖關紀錄失敗', e);
      proceedToStudy(id);
    });
  }

  function proceedToStudy(id) {
    var n = NODES[id || currentId];
    $('study-title').textContent = n ? n.title : '建置中';
    $('study-content').innerHTML = n && n.notes ? n.notes : '內容尚未建置';
    hide('chapter-screen'); show('study-screen');
  }

  function closeActionModal() {
    $('action-modal').classList.remove('flex'); $('action-modal').classList.add('hidden');
  }

  function viewCertificate(idx) {
    var h = recent[idx];
    if (!h) return;
    closeActionModal(); hide('chapter-screen');
    // 班級／座號／姓名不必存進每一筆紀錄：這份 progress 文件本來就是這位學生的
    $('res-class').textContent = user.cls; $('res-no').textContent = user.no; $('res-name').textContent = user.name;
    var d = new Date(h.at);
    $('res-date').textContent = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
    $('res-chapter').textContent = (NODES[h.unit] && NODES[h.unit].title) || h.unit;
    $('res-duration').textContent = h.duration || '—';
    $('res-rate').textContent = (h.score || 0) + '%';
    $('res-correct').textContent = (h.correct === undefined ? '—' : h.correct);
    $('res-total').textContent = (h.total === undefined ? '—' : h.total);
    $('pass-msg').textContent = praise(h.correct !== undefined && h.correct === h.total, h.score || 0);
    $('cert-return-btn').textContent = '返回目錄';
    show('result-screen');
  }

  function praise(perfect, rate) {
    if (perfect) return 'PERFECT! 零失誤完美通關！';
    if (rate >= 80) return 'GREAT! 表現出色，順利完成挑戰！';
    return 'GOOD! 雖然有波折，但還是成功達成連對目標！';
  }

  /* ── 測驗 ────────────────────────────────────────────── */
  /* ── 作答過程的紀錄（老師 2026-08-17 要的）───────────────
     ⚠️⚠️ 這幾個數字**不是作弊判定**，是給老師看的參考。
        · 切出視窗可能只是通知跳出來、切輸入法
        · 秒數快可能是他真的會
        ⇒ 系統**不封鎖、不扣分、不跳警告**，只把它記下來。
          任何「自動抓作弊」的做法都會冤枉到人，而被冤枉一次
          比讓一個人抄到還糟。
     ★ 真正有訊號的是**對照**：整份都 3 秒、只有難題 40 秒，那才值得問一句。 */
  var behav = { t: [], copy: 0, away: 0 };
  var qStart = 0;

  function startQuiz() {
    var n = NODES[currentId];
    if (!n || !n.questions.length) { showModal('題庫建置中', '本小節題庫尚未建置完成，敬請期待！'); return; }
    pool = shuffle(n.questions.slice());
    streak = 0; score = 0; wrong = 0; seconds = 0; runStat = {};
    behav = { t: [], copy: 0, away: 0 };
    hide('study-screen'); show('quiz-screen');
    $('current-chapter-title').textContent = n.title;
    startTimer(); loadQuestion();
  }

  function shuffle(a) { return a.sort(function () { return 0.5 - Math.random(); }); }

  /* ── 題目不給複製 ─────────────────────────────────────
     ★ 老師 2026-08-17：「不能複製呢？」
     ⚠️ 刻意**不用** user-select:none —— 那會讓螢幕朗讀器、翻譯工具、
        放大鏡一起失效，而這一章正好在教「資訊近用權」與「數位包容」。
        ⇒ 改成攔 copy 事件：選取照常（輔具正常），但剪貼簿裡放的是一句話。
     ⚠️ 這擋不掉截圖 —— 現在的 AI 讀得懂截圖，按 Win+Shift+S 只要兩秒。
        它擋的是「最省事的那一條」，不是全部。 */
  function isQuizOn() {
    var el = document.getElementById('quiz-screen');
    return !!el && !el.classList.contains('hidden');
  }
  var CLIP_MSG = '（題目請自己讀 😉 這一份要看的是你想得到什麼）';

  /* ★ 為什麼攔的是 copy 而不是右鍵（老師 2026-08-17 問的）
     copy 是**出口**：不管走 Ctrl+C、右鍵選單的「複製」、還是編輯選單，
     最後都會經過這個事件。攔它一個，那幾條路一起擋掉。
     ⚠️ 反過來說，攔 contextmenu（右鍵選單）幾乎沒有多擋到什麼 ——
        複製那條路已經擋了，而右鍵選單裡還有「朗讀所選文字」「翻譯」，
        手機的長按選字也是同一個事件。關掉它是把輔具的入口一起關掉。
     ⇒ 不攔右鍵。 */
  document.addEventListener('copy', function (e) {
    if (!isQuizOn()) return;
    behav.copy++;
    try {
      (e.clipboardData || window.clipboardData).setData('text/plain', CLIP_MSG);
      e.preventDefault();
    } catch (err) { /* 瀏覽器不給改剪貼簿就算了，至少數字記到了 */ }
  });
  /* 剪下：題目區沒有可編輯的欄位，理論上不會發生 —— 但成本是一行。 */
  document.addEventListener('cut', function (e) {
    if (!isQuizOn()) return;
    behav.copy++;
    try {
      (e.clipboardData || window.clipboardData).setData('text/plain', CLIP_MSG);
      e.preventDefault();
    } catch (err) {}
  });
  /* ⚠️⚠️ 這一條是老師問「那滑鼠右鍵呢」的時候才想到的漏洞：
     選取文字之後**直接用滑鼠拖進另一個視窗**（例如 AI 的輸入框），
     那是 dragstart，**不會觸發 copy** —— 前面那兩道都攔不到。
     ★ 只擋題目區的文字拖曳；拼圖那邊的積木拖曳在別的頁面，不受影響。 */
  document.addEventListener('dragstart', function (e) {
    if (!isQuizOn()) return;
    var box = document.getElementById('question-container');
    if (box && box.contains(e.target)) { behav.copy++; e.preventDefault(); }
  });
  /* 切出視窗（換分頁、切到別的 App）。同樣只記次數，不做任何處置。 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && isQuizOn()) behav.away++;
  });

  /** 把每題的秒數濃縮成兩個數字 —— 不存整個陣列（history 有長度上限） */
  function pace() {
    var a = behav.t.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    return { med: a[Math.floor(a.length / 2)], min: a[0], n: a.length };
  }

  function startTimer() {
    clearInterval(timer); paintTimer();
    timer = setInterval(function () { seconds++; paintTimer(); }, 1000);
  }
  function paintTimer() {
    $('timer').textContent = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
  }

  function loadQuestion() {
    picked = -1;
    $('score-counter').textContent = '連對: ' + streak + ' / ' + TARGET;
    $('wrong-counter').textContent = '容錯: ' + (MAX_WRONG - wrong);
    if (!pool.length) pool = shuffle(NODES[currentId].questions.slice());
    current = pool.shift();

    var opts = current.options.map(function (t, i) { return { text:t, orig:i }; });
    current.shuffled = shuffle(opts);

    var html = '<h3 class="text-xl md:text-2xl font-black mb-6 text-slate-800 leading-relaxed">' + current.q + '</h3><div class="space-y-3">';
    current.shuffled.forEach(function (o, i) {
      html += '<div data-opt="' + i + '" id="opt-' + i + '" class="qz-opt p-4 border-2 border-slate-200 rounded-xl cursor-pointer '
           +  MAIN.optHover + ' transition text-lg font-bold text-slate-700 select-none">' + o.text + '</div>';
    });
    $('question-container').innerHTML = html + '</div>';
    qStart = Date.now();          // ★ 這一題從現在開始計時
  }

  function selectOption(i) {
    picked = i;
    document.querySelectorAll('.qz-opt').forEach(function (el, idx) {
      MAIN.optSel.forEach(function (c) { el.classList.remove(c); });
      if (idx === i) MAIN.optSel.forEach(function (c) { el.classList.add(c); });
    });
  }

  /**
   * 這一題答對了沒。
   * ★ 2026-08-17 起，題庫裡**沒有明碼答案** —— 只有一段雜湊（a）。
   *   判分改成「對學生選的那個選項算一次雜湊，和 a 比」。
   *   為什麼：這個 repo 是公開的，原本 `correct: 2` 按 F12 就看得到，
   *   學生根本不必問 AI。詳見 shared/anskey.js 開頭。
   * ⚠️ 舊題庫（還沒跑 hash-answers.js 的）仍然吃 correct ——
   *    不然忘了轉換就整份題庫判錯，那比洩題還糟。
   *    anskey.test.js 會盯著「內容檔裡不可以還有明碼答案」。
   */
  function isRight(item, picked) {
    if (window.ANSKEY && item.a) {
      return window.ANSKEY.check(item.q, item.shuffled[picked].text, item.a);
    }
    return item.shuffled[picked].orig === item.correct;
  }

  function checkAnswer() {
    if (picked === -1) { showModal('尚未作答', '請先選擇一個選項再送出！'); return; }
    /* 這一題想了幾秒（上限 600 —— 中間去上廁所不必記成兩小時） */
    if (qStart) behav.t.push(Math.min(600, Math.round((Date.now() - qStart) / 1000)));
    var right = isRight(current, picked);

    /* ★ 逐題記一筆（2026-08-11）——「這一節下次該重講什麼」只有這個答得出來。
       ⚠️ 只累加在記憶體裡，**不是每答一題就寫 Firestore**。
          一次挑戰要連對 10 題、容錯 20 題，實際上可能作答幾十次；
          每次都寫的話，一堂課三十個人就是上千次寫入，
          而寫入額度是整個專案共用的。挑戰結束才寫一次。
       ⚠️ 沒載到 qstat.js 就跳過，不要讓它擋住答題。 */
    /* ⚠️ 一定要 window. 前綴。
       這一支的外殼是 `(function () {…})()` —— **沒有 global 參數**，
       而我第一版照著 combo.js／qstat.js 的樣子寫成 global.QSTAT，
       於是每按一次「送出答案」就丟 ReferenceError：
       global is not defined。
       症狀是「送出答案沒有反應」，而題目照樣停在畫面上。 */
    if (window.QSTAT) window.QSTAT.bump(runStat, current.q, right);

    if (right) {
      score++; streak++;
      if (streak >= TARGET) { showResult(); return; }
    } else {
      wrong++; streak = 0;
      pool = shuffle(NODES[currentId].questions.slice());   // 答錯就重新洗牌，避免背題序
      if (wrong >= MAX_WRONG) {
        /* ⚠️ 這一條路（累積答錯太多 → 學習警示）以前直接離開，
           什麼都沒存。而**答錯 20 題的人，正是最需要知道他錯在哪的那一個** ——
           統計裡少掉的偏偏是最該看到的資料。 */
        saveStat();
        clearInterval(timer); hide('quiz-screen'); show('warning-screen'); return;
      }
    }
    loadQuestion();
  }

  /** 把這一次挑戰累積的逐題紀錄寫進進度文件（只寫一次） */
  function saveStat() {
    if (!window.QSTAT || !window.REPORT || !Object.keys(runStat).length) return;
    var m = runStat;
    runStat = {};                       // 先清掉，避免重複送出同一批
    window.REPORT.qstat(C.moduleId, m).catch(function (e) {
      /* 統計存不進去不可以影響闖關 —— 它是給老師看的，不是學生的成績。 */
      console.warn('[qstat] 題目統計沒存成功（不影響闖關）', e);
    });
  }

  function showResult() {
    clearInterval(timer);
    hide('quiz-screen'); show('result-screen');

    $('res-class').textContent = user.cls; $('res-no').textContent = user.no; $('res-name').textContent = user.name;
    var t = new Date();
    $('res-date').textContent = t.getFullYear() + '/' + String(t.getMonth()+1).padStart(2,'0') + '/' + String(t.getDate()).padStart(2,'0');
    $('res-chapter').textContent = NODES[currentId].title;

    var dur = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
    var total = score + wrong;
    var rate = Math.round((score / total) * 100);

    $('res-duration').textContent = dur;
    $('res-rate').textContent = rate + '%';
    $('res-correct').textContent = score; $('res-total').textContent = total;
    $('pass-msg').textContent = praise(wrong === 0, rate);
    $('cert-return-btn').textContent = '完成挑戰';

    saveStat();          // ★ 逐題統計：一次挑戰只寫這一次

    // 回報到統一進度（hub 才會亮燈）；星等一律走 GRADING，不在這裡寫死門檻。
    // extra 的欄位只寫進 history，供事後檢視證書用（原本是另一個 quiz_records 集合）。
    if (window.REPORT && window.GRADING) {
      var star = window.GRADING.ethicsStar(rate);
      window.REPORT.unit(C.moduleId, currentId, {
        star: star, score: rate,
        /* ★ pace／copy／away 是給老師看的參考，不影響星等，也不影響過關。 */
        extra: { duration: dur, correct: score, total: total,
                 pace: pace(), copy: behav.copy, away: behav.away }
      }).then(paintBadges)
        .catch(function (e) { console.error('回報進度失敗', e); });
    }
  }

  /* ── 通關標記 ────────────────────────────────────────── */
  function paintBadges() {
    if (!window.REPORT) return Promise.resolve();
    return window.REPORT.get(C.moduleId).then(function (mod) {
      var units = (mod && mod.units) || {}, done = 0;
      document.querySelectorAll('.qz-open').forEach(function (btn) {
        var id = btn.getAttribute('data-ch');
        btn.querySelectorAll('.pass-badge').forEach(function (el) { el.remove(); });
        btn.classList.remove('ring-2','ring-emerald-400');
        var u = units[id];
        if (u && (u.star || 0) > 0) {
          done++;
          var badge = document.createElement('span');
          badge.className = 'pass-badge ml-1 whitespace-nowrap text-amber-500 font-black';
          badge.textContent = '✅' + '★'.repeat(u.star);
          btn.appendChild(badge);
          btn.classList.add('ring-2','ring-emerald-400');
        }
      });
      var info = $('chapter-progress');
      if (info) {
        info.innerHTML = done
          ? '已通關 <span class="hl-b">' + done + '</span> / ' + ORDER.length + ' 個章節，累積 <span class="text-amber-500 font-black">⭐ ' + ((mod && mod.stars) || 0) + '</span>'
          : '還沒有通關的章節，挑一個開始吧！';
      }
    }).catch(function (e) { console.error('讀取進度失敗', e); });
  }

  /* ===================================================================
     6. 事件（全部用委派，不在 HTML 裡寫 onclick）
     =================================================================== */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('.qz-open');   if (t) { openChapter(t.getAttribute('data-ch')); return; }
      var c = e.target.closest('.qz-cert');   if (c) { viewCertificate(c.getAttribute('data-rec')); return; }
      var o = e.target.closest('.qz-opt');    if (o) { selectOption(+o.getAttribute('data-opt')); return; }
    });
    $('start-quiz-btn').addEventListener('click', startQuiz);
    $('next-btn').addEventListener('click', checkAnswer);
    $('back-chapters-btn').addEventListener('click', function () { hide('study-screen'); show('chapter-screen'); });
    $('warn-back-btn').addEventListener('click', function () { hide('warning-screen'); show('study-screen'); });
    $('cert-return-btn').addEventListener('click', function () { hide('result-screen'); show('chapter-screen'); });
    $('modal-ok').addEventListener('click', function () {
      $('modal').classList.remove('flex'); $('modal').classList.add('hidden');
    });
    $('hist-close').addEventListener('click', closeActionModal);
    $('hist-again').addEventListener('click', function () { proceedToStudy(); closeActionModal(); });
  }

  /* ===================================================================
     7. 對外介面：給 quiz-firebase.js 用
     =================================================================== */
  window.QUIZ = {
    /* ⚠️ 這裡**刻意不再暴露 content 與 nodes**。
       原本寫著 content: C, nodes: NODES —— 那等於把剛才 delete 掉的
       題庫又從另一個名字端出去（Console 打 QUIZ.content 一樣整批帶走）。
       ★ 沒有任何呼叫端在用它們（quiz-firebase 只檢查 window.QUIZ 在不在）。
         真的有人要用，請傳「要用的那一小塊」，不要整份。 */
    moduleId: C.moduleId,
    // 身分確定後呼叫（快取或名冊都走這裡）
    setUser: function (me) {
      if (!me) return;
      user.cls = me.cls; user.no = me.no; user.name = me.name;
      identified = true;
      enterChapters();
    },
    isIdentified: function () { return identified; },
    failIdentity: function (msg) {
      var el = $('sso-msg'); if (el) el.textContent = msg || '無法確認身分，請回闖關基地重新登入。';
    },
    refreshBadges: paintBadges
  };

  /* ===================================================================
     8. 啟動
     =================================================================== */
  render();
  bind();

  // 快速通道：闖關基地已快取身分時直接進章節頁，不讓學生看到「正在確認身分…」
  var cached = (window.SSO && window.SSO.me) ? window.SSO.me() : null;
  if (cached) window.QUIZ.setUser(cached);

})();
