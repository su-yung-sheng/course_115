/* =====================================================================
   可變電阻：原理 ＋ 接線練習（11501 第三節「無段風扇」暖身）
   ---------------------------------------------------------------------
   ★ 老師 2026-08-24：「第三關的可變電阻因為開發板沒有，這裡增加了一個接線動作，
     連接到開發板上的 A7。開發板上的腳位順序 G P S 對應可變電阻目前的腳位(1 3 2)，
     以使用者面對旋鈕方向。設計一個接線練習當成暖身活動，並簡介可變電阻原理」

   ⚠️⚠️ 這是**五節課裡第一次要學生自己接線**（前兩節都在模組上，不必接）。
      所以暖身的重點不只是「知道原理」，是**接對**。

   接線對照（老師 2026-08-24 提供，面對旋鈕方向）：
       開發板 G（接地）→ 可變電阻 腳 1
       開發板 P（電源）→ 可變電阻 腳 3
       開發板 S（訊號）→ 可變電阻 腳 2   ★ 中間那支＝刷片
   ★★ 學生最自然的錯是「G-P-S 照順序對 1-2-3」——
      那會把**電源接到刷片上**。這正是這個練習存在的理由。

   三個節點：
     ① 原理　　可變電阻在做什麼（拉旋鈕看讀值 ＋ 概念題）
     ② 接線　　把 G／P／S 接到對的腳
     ③ 接錯會怎樣　三選一

   ★ 接回第二節：可變電阻本身就是**一把尺**（0～1023），
     第三節要把它換算成 PWM（0～255）—— 又是「兩把尺對齊」。
   ===================================================================== */
(function (global) {
  'use strict';

  var ADC_MAX = 1023;            // 類比輸入的解析度（0～1023）
  var PIN = 'A7';                // 老師指定：訊號接 A7

  /* 接線對照。★ 這一份是**唯一的來源** —— 畫面、判定、回饋都讀它。 */
  var WIRING = [
    { hole: 'G', name: '接地', leg: 1, why: '電阻的一端接到地（0V）' },
    { hole: 'P', name: '電源', leg: 3, why: '電阻的另一端接到電源' },
    { hole: 'S', name: '訊號', leg: 2, why: '★ 中間那支是**刷片**，旋鈕轉的就是它' }
  ];
  var LEGS = [1, 2, 3];

  function LK() {
    if (!global.LABKIT) throw new Error('potlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function rngFrom(seed) {
    if (global.ULTRALAB && global.ULTRALAB.rngFrom) return global.ULTRALAB.rngFrom(seed);
    return Math.random;
  }

  /** 旋鈕轉到某個比例時讀到的數字。★ 就是分壓：轉到幾分之幾，就讀到幾分之幾。 */
  function readAt(pct) {
    return Math.round(ADC_MAX * Math.max(0, Math.min(100, pct)) / 100);
  }

  /** ② 判接線：三條線都要接對。回傳哪幾條錯了。 */
  function judgeWire(pick) {
    pick = pick || {};
    var wrong = WIRING.filter(function (w) { return Number(pick[w.hole]) !== w.leg; });
    /* ⚠️ 沒接完不算錯，只是還沒好 —— 兩者的回饋要分開。 */
    var done = WIRING.every(function (w) { return pick[w.hole]; });
    return { ok: done && wrong.length === 0, done: done,
             wrong: wrong.map(function (w) { return w.hole; }) };
  }
  /** 接錯時的回饋。★ 要指出**是什麼後果**，不是只說「錯了」。 */
  function sayWire(pick) {
    var r = judgeWire(pick);
    if (r.ok) return '✅ 三條都對了。';
    if (!r.done) return '還有線沒接完 —— 三個孔都要接到一支腳。';
    /* ★★ 最危險、也最常見的那一種：電源接到刷片上。 */
    if (Number(pick.S) !== 2 && Number(pick.P) === 2)
      return '⚠️⚠️ 你把**電源接到中間那支腳**了。中間是**刷片** —— ' +
             '旋鈕一轉，它和接地之間的電阻會變得很小，' +
             '等於把電源直接接到地。⚠️ 這樣會**發熱**，先拔掉再重接。';
    if (Number(pick.S) !== 2)
      return '⚠️ 訊號（S）沒有接到中間那支腳。' +
             '兩端那兩支是**固定不動**的，旋鈕怎麼轉它們都一樣 —— ' +
             '要讀出「轉到哪裡」，只能接刷片。';
    /* S 對了但 G／P 顛倒 —— 這一種不會壞，只是方向相反。 */
    return '⚠️ 訊號接對了（中間那支），但**接地和電源接反了**。' +
           '這樣讀到的數字會倒過來：往右轉反而變小。' +
           '⚠️ 它不會壞掉，所以光看接線看不出問題 —— 要轉一下才發現。';
  }

  /* ③ 接錯會怎樣。★ 三個選項都是真的會發生的事。 */
  function optsWhy() {
    return [
      { k: 'wiper', good: true,
        t: '訊號接到兩端那兩支的其中一支',
        after: '讀到的數字**完全不會變** —— 那兩支是固定的，旋鈕怎麼轉都一樣。' },
      { k: 'swap', good: false,
        t: '接地和電源對調',
        after: '會動，但**方向相反**：往右轉數字反而變小。⚠️ 不會壞，所以很難發現。' },
      { k: 'power', good: false,
        t: '電源接到中間那支腳',
        after: '⚠️ 旋鈕轉到底時，等於把電源直接接到地 —— 會發熱。' }
    ];
  }
  /** ③ 的題目：問「哪一種接法會讓數字完全不會變」。 */
  function judgeWhy(ans) { return String(ans) === 'wiper'; }
  function sayWhy(ans) {
    if (String(ans) === 'swap')
      return '對調會讓數字**倒過來**，但它還是會變。再想一次：' +
             '哪一種接法會讓旋鈕轉了**完全沒反應**？';
    if (String(ans) === 'power')
      return '那一種很危險（會發熱），但數字還是會變。' +
             '這一題問的是「**完全不會變**」的那一種。';
    return '想想看：三支腳裡，哪兩支是旋鈕轉了也不會動的？';
  }

  /* ① 原理的概念題。★ 隨機挑一組（正解只有一個，但問法會換）。 */
  var Q1 = [
    { q: '旋鈕往右轉到底，A7 讀到的數字會是多少？',
      opts: [{ k: 'max', good: true, t: String(ADC_MAX) + '（最大）' },
             { k: 'zero', good: false, t: '0' },
             { k: 'half', good: false, t: '一半（約 512）' }],
      why: '刷片滑到最上面，量到的就是整條電阻的電壓 —— 也就是滿格。' },
    { q: '旋鈕轉到**正中間**，讀到的數字大約是多少？',
      opts: [{ k: 'half', good: true, t: '約 512（一半）' },
             { k: 'max', good: false, t: String(ADC_MAX) },
             { k: 'zero', good: false, t: '0' }],
      why: '刷片停在一半的位置，量到的就是一半的電壓。' },
    { q: '可變電阻真正在做的事情是什麼？',
      opts: [{ k: 'split', good: true, t: '把電壓**按比例切一段**出來給程式讀' },
             { k: 'gen', good: false, t: '自己產生電' },
             { k: 'count', good: false, t: '數旋鈕轉了幾圈' }],
      why: '它不產生電，也不計數 —— 它只是把既有的電壓分掉一部分。' }
  ];
  function caseQ1(rng, prev) { return LK().pick(rng, Q1, prev, function (x) { return x.q; }); }

  /* ═══ 畫面 ═══════════════════════════════════════════
     ★ 老師 2026-08-24 的三點回饋：
       ① 真實可變電阻是**旋轉式**，左右拉比較無感 → ① 改成真的會轉的旋鈕
       ② 接線要能**連連看**，畫出可變電阻 → ② 改成上下對照、點兩下連一條線
       ③ 第三步驟的圖示放大 → ③ 每個選項配一張大圖 */
  var CSS = '' +
  '.pt-wrap{font-size:15px}' +
  '.pt-q{font-size:16px;font-weight:900;color:#0f172a;line-height:1.9;margin-bottom:10px}' +
  '.pt-stage{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:12px 0}' +
  /* ── ① 旋鈕（真的會轉）───────────────────────────
     ⚠️ 老師：「真實可變電阻是旋轉式，這裡使用左右拉比較無感」——
        拉桿和實物的操作感差太多，學生轉不出「這是同一個東西」。 */
  '.pt-dial{display:block;margin:0 auto;width:190px;max-width:60vw;cursor:grab;touch-action:none}' +
  '.pt-dial:active{cursor:grabbing}' +
  '.pt-hint{text-align:center;font-size:13px;font-weight:900;color:#94a3b8;margin-top:2px}' +
  '.pt-read{text-align:center;font-size:30px;font-weight:900;color:#0f172a;margin:8px 0 2px}' +
  '.pt-read span{font-size:14px;color:#64748b}' +
  /* 分壓那條尺（旋鈕轉的時候跟著動）*/
  '.pt-bar{position:relative;height:22px;border-radius:11px;margin:22px 8px 8px;' +
    'background:linear-gradient(90deg,#334155,#f59e0b)}' +
  '.pt-end{position:absolute;top:28px;font-size:12px;font-weight:900;color:#64748b}' +
  '.pt-end.l{left:0}.pt-end.r{right:0}' +
  '.pt-wiper{position:absolute;top:-12px;width:4px;height:46px;background:#0891b2;border-radius:2px}' +
  '.pt-wiper b{position:absolute;left:50%;transform:translateX(-50%);top:-19px;' +
    'font-size:13px;font-weight:900;color:#0891b2;white-space:nowrap}' +
  '.pt-wiper.at-l b{left:0;transform:none}' +
  '.pt-wiper.at-r b{left:auto;right:0;transform:none}' +
  /* ── ② 連連看 ────────────────────────────────── */
  '.pt-link{display:block;width:100%;max-width:520px;margin:0 auto;touch-action:manipulation}' +
  '.pt-node{cursor:pointer}' +
  '.pt-node circle{transition:fill .12s,stroke .12s}' +
  '.pt-node.sel circle{fill:#fde68a;stroke:#d97706;stroke-width:4}' +
  '.pt-wireline{stroke:#0891b2;stroke-width:5;stroke-linecap:round}' +
  '.pt-legend{text-align:center;font-size:13px;font-weight:900;color:#64748b;margin-top:4px}' +
  /* ── ③ 大圖選項（老師：圖示可以放大）────────────── */
  '.pt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:10px 0}' +
  '.pt-card{border:2px solid #e2e8f0;border-radius:14px;background:#fff;padding:12px;' +
    'cursor:pointer;text-align:center}' +
  '.pt-card:hover{border-color:#0891b2;background:#ecfeff}' +
  '.pt-card svg{width:100%;height:120px}' +
  '.pt-card div{font-size:15px;font-weight:900;color:#0f172a;line-height:1.7;margin-top:6px}' +
  '.pt-go{background:#0891b2;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;' +
    'border:none;border-radius:12px;cursor:pointer}' +
  '.pt-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;' +
    'border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;' +
    'font-weight:800;cursor:pointer}' +
  '.pt-opt:hover{border-color:#0891b2;background:#ecfeff}' +
  '.pt-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;' +
    'font-weight:700;line-height:1.9}' +
  '.pt-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.pt-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.pt-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.pt-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.pt-dot.on{background:#0891b2}.pt-dot.ok{background:#10b981}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('potlab-css')) return;
    var st = document.createElement('style');
    st.id = 'potlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* 旋鈕轉的角度範圍。★ 真實的旋鈕大約轉 270 度（−135 到 +135）。 */
  var SWEEP = 270;
  function angleOf(pct) { return -SWEEP / 2 + SWEEP * pct / 100; }
  /* 角度 → 百分比。
     ⚠️⚠️ 一定要**夾住**：從最左再往左轉，角度會繞到 −170 度那一帶，
        不夾的話百分比會突然跳到另一端 —— 手指還在往左，旋鈕卻彈到最右。
     ★ 抽成純函式是為了測得到（jsdom 量不到滑鼠座標）。 */
  function pctFromAngle(deg) {
    if (deg < -SWEEP / 2) deg = -SWEEP / 2;
    if (deg > SWEEP / 2) deg = SWEEP / 2;
    return Math.round((deg + SWEEP / 2) / SWEEP * 100);
  }

  /** ① 的旋鈕（SVG，會跟著轉）。 */
  function dialHtml(pct) {
    var a = angleOf(pct);
    var ticks = '';
    for (var i = 0; i <= 10; i++) {
      var t = -SWEEP / 2 + SWEEP * i / 10;
      ticks += '<line x1="60" y1="14" x2="60" y2="21" stroke="#cbd5e1" stroke-width="2" ' +
               'transform="rotate(' + t + ' 60 60)"/>';
    }
    return '<svg class="pt-dial" viewBox="0 0 120 128" role="img" aria-label="可變電阻旋鈕">' +
      ticks +
      '<circle cx="60" cy="60" r="34" fill="#e7e5e4" stroke="#78716c" stroke-width="3"/>' +
      '<g transform="rotate(' + a + ' 60 60)">' +
        '<line x1="60" y1="60" x2="60" y2="32" stroke="#0891b2" stroke-width="7" stroke-linecap="round"/>' +
      '</g>' +
      '<circle cx="60" cy="60" r="9" fill="#a8a29e"/>' +
      /* 三支腳（朝下），和實物一樣由左到右 1、2、3 */
      '<line x1="44" y1="92" x2="44" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
      '<line x1="60" y1="94" x2="60" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
      '<line x1="76" y1="92" x2="76" y2="112" stroke="#94a3b8" stroke-width="4"/>' +
      '<text x="44" y="126" text-anchor="middle" font-size="12" font-weight="900" fill="#64748b">1</text>' +
      '<text x="60" y="126" text-anchor="middle" font-size="12" font-weight="900" fill="#0891b2">2</text>' +
      '<text x="76" y="126" text-anchor="middle" font-size="12" font-weight="900" fill="#64748b">3</text>' +
    '</svg>';
  }
  /** 分壓那條尺 */
  function barHtml(pct) {
    var edge = pct < 12 ? ' at-l' : (pct > 88 ? ' at-r' : '');
    return '<div class="pt-bar">' +
      '<div class="pt-end l">腳 1（接地 0V）</div>' +
      '<div class="pt-end r">腳 3（電源）</div>' +
      '<div class="pt-wiper' + edge + '" style="left:' + pct + '%"><b>腳 2 刷片</b></div>' +
      '</div>';
  }

  /* ── ② 連連看的座標 ────────────────────────────
     ★ 可變電阻在**上**（腳 1 2 3 由左到右，和實物一致），
       開發板在**下**（孔 G P S 由左到右）。
     ★★ 這樣正解的連線會**交叉**（P→3 和 S→2 交叉），
        而「照順序接」是三條直的 —— 一眼就看得出差別。 */
  var LEG_X = { 1: 130, 2: 200, 3: 270 }, LEG_Y = 132;
  var HOLE_X = { G: 130, P: 200, S: 270 }, HOLE_Y = 232;

  function linkHtml(pick, sel) {
    var lines = WIRING.map(function (w) {
      var leg = Number(pick[w.hole]);
      if (!leg) return '';
      return '<line class="pt-wireline" x1="' + HOLE_X[w.hole] + '" y1="' + HOLE_Y +
             '" x2="' + LEG_X[leg] + '" y2="' + LEG_Y + '"/>';
    }).join('');
    var legs = LEGS.map(function (n) {
      return '<g class="pt-node' + (sel === 'leg' + n ? ' sel' : '') + '" data-leg="' + n + '">' +
        '<circle cx="' + LEG_X[n] + '" cy="' + LEG_Y + '" r="15" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3"/>' +
        '<text x="' + LEG_X[n] + '" y="' + (LEG_Y + 6) + '" text-anchor="middle" font-size="17" ' +
        'font-weight="900" fill="#0f172a">' + n + '</text></g>';
    }).join('');
    var holes = WIRING.map(function (w) {
      return '<g class="pt-node' + (sel === 'hole' + w.hole ? ' sel' : '') + '" data-hole="' + w.hole + '">' +
        '<circle cx="' + HOLE_X[w.hole] + '" cy="' + HOLE_Y + '" r="17" fill="#0f172a" stroke="#334155" stroke-width="3"/>' +
        '<text x="' + HOLE_X[w.hole] + '" y="' + (HOLE_Y + 6) + '" text-anchor="middle" font-size="17" ' +
        'font-weight="900" fill="#fff">' + w.hole + '</text>' +
        '<text x="' + HOLE_X[w.hole] + '" y="' + (HOLE_Y + 34) + '" text-anchor="middle" font-size="12" ' +
        'font-weight="900" fill="#64748b">' + w.name + '</text></g>';
    }).join('');
    return '<svg class="pt-link" viewBox="0 0 400 280">' +
      /* 可變電阻本體（上） */
      '<circle cx="200" cy="62" r="46" fill="#e7e5e4" stroke="#78716c" stroke-width="4"/>' +
      '<rect x="188" y="6" width="24" height="22" rx="6" fill="#a8a29e"/>' +
      '<text x="200" y="68" text-anchor="middle" font-size="14" font-weight="900" fill="#78716c">10K</text>' +
      '<line x1="130" y1="106" x2="130" y2="117" stroke="#94a3b8" stroke-width="5"/>' +
      '<line x1="200" y1="108" x2="200" y2="117" stroke="#94a3b8" stroke-width="5"/>' +
      '<line x1="270" y1="106" x2="270" y2="117" stroke="#94a3b8" stroke-width="5"/>' +
      '<text x="200" y="128" text-anchor="middle" font-size="0"> </text>' +
      lines + legs +
      /* 開發板（下） */
      '<rect x="96" y="208" width="208" height="48" rx="10" fill="none" stroke="#cbd5e1" stroke-width="3"/>' +
      holes +
      '<text x="200" y="200" text-anchor="middle" font-size="13" font-weight="900" fill="#94a3b8">開發板</text>' +
    '</svg>';
  }

  /* ── ③ 三張大圖（老師：第三步驟的圖示可以放大）────── */
  function miniHtml(kind) {
    /* 一顆簡化的可變電阻 ＋ 三條線，用顏色標出接到哪。 */
    var w = { wiper: { 1: '#0891b2', 2: '#94a3b8', 3: '#94a3b8' },
              swap:  { 1: '#dc2626', 2: '#0891b2', 3: '#16a34a' },
              power: { 1: '#16a34a', 2: '#dc2626', 3: '#94a3b8' } }[kind];
    return '<svg viewBox="0 0 120 100">' +
      '<circle cx="60" cy="34" r="24" fill="#e7e5e4" stroke="#78716c" stroke-width="3"/>' +
      '<circle cx="60" cy="34" r="7" fill="#a8a29e"/>' +
      [1, 2, 3].map(function (n) {
        var x = 36 + (n - 1) * 24;
        return '<line x1="' + x + '" y1="56" x2="' + x + '" y2="84" stroke="' + w[n] +
               '" stroke-width="6" stroke-linecap="round"/>' +
               '<text x="' + x + '" y="96" text-anchor="middle" font-size="11" ' +
               'font-weight="900" fill="#64748b">' + n + '</text>';
      }).join('') +
    '</svg>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var rng = rngFrom(opts.seed);
    var node = 1, tries = 0;
    var pct = 50, turned = { lo: false, hi: false };
    var q1 = caseQ1(rng, null);
    var pick = { G: '', P: '', S: '' };
    var sel = null;                 // 連連看：現在選了哪一顆（'holeG' / 'leg2'）

    function dots(n, done) {
      return '<div class="pt-dots">' + [1, 2, 3].map(function (i) {
        return '<div class="pt-dot ' + (done >= i ? 'ok' : (n === i ? 'on' : '')) + '"></div>';
      }).join('') + '</div>';
    }
    function stageHtml() {
      return '<div id="pt-dial">' + dialHtml(pct) + '</div>' +
             '<div class="pt-hint">↻ 用手指或滑鼠<b>轉動旋鈕</b>（也可以用方向鍵）</div>' +
             '<div class="pt-read" id="pt-read">' + readAt(pct) +
               ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span></div>' +
             '<div id="pt-bar">' + barHtml(pct) + '</div>';
    }

    function view(msg, cls) {
      var body;
      if (node === 1) {
        var list = q1.opts.slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">🎛️ 可變電阻裡面是<b>一條電阻</b>，兩端接電源和接地，' +
          '中間有一支會滑動的<b>刷片</b>。<br>' +
          '旋鈕在轉的，就是那支刷片 —— 它滑到哪裡，就把電壓<b>按比例切一段</b>出來。<br>' +
          '⚠️ 先轉轉看（兩端都要轉到），再回答問題。</div>' +
          '<div class="pt-stage">' + stageHtml() + '</div>' +
          (turned.lo && turned.hi
            ? '<div class="pt-q">' + q1.q + '</div>' +
              list.map(function (o) {
                return '<button class="pt-opt" data-k="' + o.k + '">' + esc(o.t) + '</button>';
              }).join('')
            : '<div class="pt-msg bad">⚠️ 兩端都轉到才會出題（' +
              (turned.lo ? '✅' : '⬜') + ' 轉到最左　' +
              (turned.hi ? '✅' : '⬜') + ' 轉到最右）</div>');
      } else if (node === 2) {
        /* ★ 老師 2026-08-24：「接線能類似連連看? 畫出可變電阻，
           不然只寫 1 2 3 很難對照」⇒ 點一個孔、再點一支腳，就連一條線。 */
        body =
          '<div class="pt-q">🔌 這一節的可變電阻<b>不在模組上</b>，要自己接三條線。<br>' +
          '⚠️ 點一下開發板的孔，再點一下要接的那支腳 —— 就連起來了。<br>' +
          '（面對旋鈕，三支腳由左到右是 <b>1</b>、<b>2</b>、<b>3</b>；' +
          '<b>中間那支是刷片</b>。）</div>' +
          '<div class="pt-stage">' + linkHtml(pick, sel) +
            '<div class="pt-legend">已接 ' +
              WIRING.filter(function (w) { return pick[w.hole]; }).length +
              ' ／ 3 條' +
              (WIRING.filter(function (w) { return pick[w.hole]; }).length
                ? '　·　再點同一個孔可以拆掉重接' : '') +
            '</div>' +
          '</div>' +
          '<div style="text-align:center"><button class="pt-go" id="pt-run">接好了，檢查</button></div>';
      } else {
        var lw = optsWhy().slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">最後一題 —— 下面哪一種接錯，會讓旋鈕轉了<b>數字完全不會變</b>？<br>' +
          '<span style="font-size:13px;color:#64748b;font-weight:700">' +
          '（圖上藍色＝訊號、綠色＝電源、紅色＝接地、灰色＝沒接）</span></div>' +
          '<div class="pt-cards">' + lw.map(function (o) {
            return '<div class="pt-card" data-w="' + o.k + '">' + miniHtml(o.k) +
                   '<div>' + esc(o.t) + '</div></div>';
          }).join('') + '</div>';
      }
      el.innerHTML = '<div class="pt-wrap">' + dots(node, node - 1) + body +
        (msg ? '<div class="pt-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    /* ⚠️ 轉的時候**只換那三塊**，不整個重畫 —— 重畫會讓拖曳中斷。 */
    function paint() {
      var d = el.querySelector('#pt-dial'); if (d) d.innerHTML = dialHtml(pct);
      var b = el.querySelector('#pt-bar');  if (b) b.innerHTML = barHtml(pct);
      var r = el.querySelector('#pt-read');
      if (r) r.innerHTML = readAt(pct) + ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span>';
    }
    function setPct(v) {
      var was = turned.lo && turned.hi;
      pct = Math.max(0, Math.min(100, v));
      if (pct <= 5) turned.lo = true;
      if (pct >= 95) turned.hi = true;
      if (!was && turned.lo && turned.hi) { view('', ''); return; }
      paint();
    }
    /* 由滑鼠／手指的位置算出旋鈕轉到幾 %。
       ⚠️ 旋鈕只轉 270 度（−135～135），超出範圍要夾住 ——
          不夾的話從最左再往左會突然跳到最右。 */
    function pctFromPoint(svg, cx, cy) {
      var r = svg.getBoundingClientRect();
      var dx = cx - (r.left + r.width / 2);
      var dy = cy - (r.top + r.height * 0.47);
      var deg = Math.atan2(dx, -dy) * 180 / Math.PI;   // 12 點鐘方向為 0
      return pctFromAngle(deg);
    }

    function bind() {
      /* ── ① 旋鈕：拖曳轉動 ── */
      var svg = el.querySelector('.pt-dial');
      if (svg) {
        var dragging = false;
        var move = function (e) {
          if (!dragging) return;
          e.preventDefault();
          setPct(pctFromPoint(svg, e.clientX, e.clientY));
        };
        svg.addEventListener('pointerdown', function (e) {
          dragging = true;
          if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
          setPct(pctFromPoint(svg, e.clientX, e.clientY));
        });
        svg.addEventListener('pointermove', move);
        svg.addEventListener('pointerup', function () { dragging = false; });
        svg.addEventListener('pointercancel', function () { dragging = false; });
        /* ★ 鍵盤也要能轉 —— 有些學生用觸控板拖不順。 */
        svg.setAttribute('tabindex', '0');
        svg.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setPct(pct - 5); e.preventDefault(); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setPct(pct + 5); e.preventDefault(); }
          if (e.key === 'Home') { setPct(0); e.preventDefault(); }
          if (e.key === 'End')  { setPct(100); e.preventDefault(); }
        });
      }
      /* ── ② 連連看：點孔 → 點腳 ── */
      el.querySelectorAll('[data-hole]').forEach(function (g) {
        g.addEventListener('click', function () { tapHole(g.getAttribute('data-hole')); });
      });
      el.querySelectorAll('[data-leg]').forEach(function (g) {
        g.addEventListener('click', function () { tapLeg(g.getAttribute('data-leg')); });
      });
      var run = el.querySelector('#pt-run');
      if (run) run.addEventListener('click', doWire);
      /* ── ①③ 的選項 ── */
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () { doQ1(b.getAttribute('data-k')); });
      });
      el.querySelectorAll('[data-w]').forEach(function (b) {
        b.addEventListener('click', function () { doWhy(b.getAttribute('data-w')); });
      });
    }

    /* 點孔：
       · 已經接過 → **拆掉，並且選起來**等著接新的一支腳
         ⚠️ 第一版是「拆掉但不選起來」，結果想改接的人點了孔、
            再點腳完全沒反應，得回頭再點一次孔（測試當場抓到）。
            「我要改這一條」本來就該一步到位。
       · 還沒接 → 選起來（再點一次取消）。 */
    function tapHole(h) {
      if (pick[h]) { pick[h] = ''; sel = 'hole' + h; view('', ''); return; }
      sel = (sel === 'hole' + h) ? null : 'hole' + h;
      view('', '');
    }
    /* 點腳：如果已經選了一個孔就連起來。
       ⚠️ 一支腳只能接一個孔 —— 接第二條的話，前一條要自動拆掉，
          不然畫面上會出現「一支腳兩條線」，那在實物上做不到。 */
    function tapLeg(n) {
      if (sel && sel.indexOf('hole') === 0) {
        var h = sel.slice(4);
        WIRING.forEach(function (w) {
          if (String(pick[w.hole]) === String(n)) pick[w.hole] = '';
        });
        pick[h] = String(n);
        sel = null;
      } else {
        sel = (sel === 'leg' + n) ? null : 'leg' + n;
      }
      view('', '');
    }

    function doQ1(k) {
      tries++;
      var o = q1.opts.filter(function (x) { return x.k === k; })[0];
      if (o && o.good) {
        node = 2;
        view('✅ 對了：' + q1.why + '<br>' +
             '★ 也就是說，可變電阻就是**一把 0～' + ADC_MAX + ' 的尺** —— ' +
             '和上一節那兩把尺是同一件事。', 'good');
        return;
      }
      var old = q1;
      q1 = caseQ1(rng, q1);       // ★ 答錯換一題
      view('⚠️ 不對。' + old.why + '　**換一題**再試一次。', 'bad');
    }

    function doWire() {
      tries++;
      var r = judgeWire(pick);
      if (r.ok) {
        node = 3;
        view('✅ 接對了！★ 記住這一組：G→1、P→3、**S→2（中間那支）**。<br>' +
             '⚠️ 注意剛才那三條線 —— **P 和 S 是交叉的**。' +
             '照順序接（G-P-S 對 1-2-3）三條線會是直的，那就錯了。', 'good');
        return;
      }
      view(sayWire(pick), 'bad');
    }

    function doWhy(k) {
      tries++;
      if (judgeWhy(k)) {
        el.innerHTML = '<div class="pt-wrap">' + dots(3, 3) +
          '<div class="pt-msg good">' + md(
            '🎉 暖身完成！\n你會了三件事：可變電阻是**把電壓按比例切一段**、' +
            '**S 一定要接中間那支刷片**、而接到兩端的話**旋鈕轉了也沒反應**。\n' +
            '⚠️ 上機前再檢查一次：G→1、P→3、S→2。'
          ).replace(/\n/g, '<br>') + '</div></div>';
        if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
        return;
      }
      view(sayWhy(k), 'bad');
    }

    view('', '');
    return { node: function () { return node; }, tries: function () { return tries; },
             pct: function () { return pct; }, pick: function () { return pick; },
             q1: function () { return q1; },
             tapHole: tapHole, tapLeg: tapLeg, setPct: setPct };
  }

  global.POTLAB = {
    ADC_MAX: ADC_MAX, PIN: PIN, WIRING: WIRING, LEGS: LEGS, Q1: Q1,
    readAt: readAt, judgeWire: judgeWire, sayWire: sayWire,
    SWEEP: SWEEP, angleOf: angleOf, pctFromAngle: pctFromAngle,
    optsWhy: optsWhy, judgeWhy: judgeWhy, sayWhy: sayWhy, caseQ1: caseQ1,
    mount: mount
  };

})(window);
