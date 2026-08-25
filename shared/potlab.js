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

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pt-wrap{font-size:15px}' +
  '.pt-q{font-size:16px;font-weight:900;color:#0f172a;line-height:1.9;margin-bottom:10px}' +
  '.pt-stage{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:12px 0}' +
  /* 一條電阻＋一個會滑動的刷片 —— 分壓的樣子 */
  '.pt-bar{position:relative;height:26px;border-radius:13px;margin:26px 0 10px;' +
    'background:linear-gradient(90deg,#334155,#f59e0b)}' +
  '.pt-end{position:absolute;top:32px;font-size:12px;font-weight:900;color:#64748b}' +
  '.pt-end.l{left:0}.pt-end.r{right:0}' +
  '.pt-wiper{position:absolute;top:-14px;width:4px;height:54px;background:#0891b2;border-radius:2px}' +
  '.pt-wiper b{position:absolute;left:50%;transform:translateX(-50%);top:-20px;' +
    'font-size:13px;font-weight:900;color:#0891b2;white-space:nowrap}' +
  '.pt-wiper.at-l b{left:0;transform:none}' +
  '.pt-wiper.at-r b{left:auto;right:0;transform:none}' +
  '.pt-knob{width:100%;height:34px;margin:14px 0 2px;accent-color:#0891b2;cursor:pointer}' +
  '.pt-read{text-align:center;font-size:26px;font-weight:900;color:#0f172a;margin:6px 0}' +
  '.pt-read span{font-size:14px;color:#64748b}' +
  /* 接線練習 */
  '.pt-wire{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;' +
    'font-weight:900;font-size:15px}' +
  '.pt-hole{display:inline-block;min-width:34px;text-align:center;padding:6px 10px;' +
    'border-radius:9px;background:#0f172a;color:#fff;font-weight:900}' +
  '.pt-pick{font-size:16px;font-weight:900;padding:8px 10px;border:2px solid #cbd5e1;' +
    'border-radius:10px;background:#fff}' +
  '.pt-legs{display:flex;gap:8px;justify-content:center;margin:10px 0 4px}' +
  '.pt-leg{width:74px;text-align:center;font-size:13px;font-weight:900;color:#64748b}' +
  '.pt-leg b{display:block;font-size:20px;color:#0f172a}' +
  '.pt-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;' +
    'border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;' +
    'font-weight:800;cursor:pointer}' +
  '.pt-opt:hover{border-color:#0891b2;background:#ecfeff}' +
  '.pt-go{background:#0891b2;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;' +
    'border:none;border-radius:12px;cursor:pointer}' +
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

  /** 分壓的樣子：一條電阻，一根會滑動的刷片。 */
  function barHtml(pct) {
    var edge = pct < 12 ? ' at-l' : (pct > 88 ? ' at-r' : '');
    return '<div class="pt-bar">' +
      '<div class="pt-end l">腳 1（接地 0V）</div>' +
      '<div class="pt-end r">腳 3（電源）</div>' +
      '<div class="pt-wiper' + edge + '" style="left:' + pct + '%"><b>腳 2 刷片</b></div>' +
      '</div>';
  }
  function dots(node, done) {
    return '<div class="pt-dots">' + [1, 2, 3].map(function (n) {
      return '<div class="pt-dot ' + (done >= n ? 'ok' : (node === n ? 'on' : '')) + '"></div>';
    }).join('') + '</div>';
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

    function view(msg, cls) {
      var body;
      if (node === 1) {
        var list = q1.opts.slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">🎛️ 可變電阻裡面是<b>一條電阻</b>，兩端接電源和接地，' +
          '中間有一支會滑動的<b>刷片</b>。<br>' +
          '旋鈕在轉的，就是那支刷片 —— 它滑到哪裡，就把電壓<b>按比例切一段</b>出來。<br>' +
          '⚠️ 先轉轉看（兩端都要轉到），再回答問題。</div>' +
          '<div class="pt-stage">' +
            '<input type="range" class="pt-knob" id="pt-knob" min="0" max="100" value="' + pct + '">' +
            '<div id="pt-bar">' + barHtml(pct) + '</div>' +
            '<div class="pt-read" id="pt-read">' + readAt(pct) +
              ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span></div>' +
          '</div>' +
          (turned.lo && turned.hi
            ? '<div class="pt-q">' + q1.q + '</div>' +
              list.map(function (o) {
                return '<button class="pt-opt" data-k="' + o.k + '">' + esc(o.t) + '</button>';
              }).join('')
            : '<div class="pt-msg bad">⚠️ 兩端都轉到才會出題（' +
              (turned.lo ? '✅' : '⬜') + ' 轉到底左　' +
              (turned.hi ? '✅' : '⬜') + ' 轉到底右）</div>');
      } else if (node === 2) {
        body =
          '<div class="pt-q">🔌 這一節的可變電阻<b>不在模組上</b>，要自己接三條線到開發板。<br>' +
          '⚠️ 面對旋鈕，三支腳由左到右是 <b>1</b>、<b>2</b>、<b>3</b>。' +
          '把開發板的三個孔各接到哪一支？</div>' +
          '<div class="pt-stage">' +
            barHtml(50) +
            '<div class="pt-legs">' + LEGS.map(function (n) {
              return '<div class="pt-leg"><b>' + n + '</b>' +
                     (n === 2 ? '中間（刷片）' : '一端') + '</div>';
            }).join('') + '</div>' +
          '</div>' +
          WIRING.map(function (w) {
            return '<div class="pt-wire"><span class="pt-hole">' + w.hole + '</span>' +
              esc(w.name) + (w.hole === 'S' ? '（→ ' + PIN + '）' : '') + ' 接到腳 ' +
              '<select class="pt-pick" data-hole="' + w.hole + '">' +
              '<option value="">?</option>' +
              LEGS.map(function (n) {
                return '<option value="' + n + '"' +
                  (String(pick[w.hole]) === String(n) ? ' selected' : '') + '>' + n + '</option>';
              }).join('') + '</select></div>';
          }).join('') +
          '<div><button class="pt-go" id="pt-run">接好了，檢查</button></div>';
      } else {
        var lw = optsWhy().slice().sort(function () { return rng() - 0.5; });
        body =
          '<div class="pt-q">最後一題 —— 下面哪一種接錯，會讓旋鈕轉了<b>數字完全不會變</b>？</div>' +
          lw.map(function (o) {
            return '<button class="pt-opt" data-w="' + o.k + '">' + esc(o.t) + '</button>';
          }).join('');
      }
      el.innerHTML = '<div class="pt-wrap">' + dots(node, node - 1) + body +
        (msg ? '<div class="pt-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    /* ⚠️ 轉旋鈕時**只換那一塊**，不整個重畫 —— 重畫會讓拉桿失焦。 */
    function onTurn(v) {
      pct = Number(v);
      var b = el.querySelector('#pt-bar');
      if (b) b.innerHTML = barHtml(pct);
      var r = el.querySelector('#pt-read');
      if (r) r.innerHTML = readAt(pct) + ' <span>／ ' + ADC_MAX + '（' + PIN + ' 讀到的）</span>';
      var was = turned.lo && turned.hi;
      if (pct <= 5) turned.lo = true;
      if (pct >= 95) turned.hi = true;
      /* 剛好湊滿兩端 → 這時候才需要整個重畫（把題目放出來）。 */
      if (!was && turned.lo && turned.hi) view('', '');
    }

    function bind() {
      var k = el.querySelector('#pt-knob');
      if (k) k.addEventListener('input', function () { onTurn(k.value); });
      var run = el.querySelector('#pt-run');
      if (run) run.addEventListener('click', doWire);
      el.querySelectorAll('.pt-pick').forEach(function (sel) {
        sel.addEventListener('change', function () {
          pick[sel.getAttribute('data-hole')] = sel.value;
        });
      });
      el.querySelectorAll('[data-k]').forEach(function (b) {
        b.addEventListener('click', function () { doQ1(b.getAttribute('data-k')); });
      });
      el.querySelectorAll('[data-w]').forEach(function (b) {
        b.addEventListener('click', function () { doWhy(b.getAttribute('data-w')); });
      });
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
        view('✅ 接對了！★ 記住這一組：G→1、P→3、**S→2（中間那支）**。', 'good');
        return;
      }
      view(sayWire(pick), 'bad');
    }

    function doWhy(k) {
      tries++;
      if (judgeWhy(k)) {
        /* ⚠️ 這一段要過 md() —— 直接塞 innerHTML 的話，**粗體**會原樣顯示。 */
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
             q1: function () { return q1; } };
  }

  global.POTLAB = {
    ADC_MAX: ADC_MAX, PIN: PIN, WIRING: WIRING, LEGS: LEGS, Q1: Q1,
    readAt: readAt, judgeWire: judgeWire, sayWire: sayWire,
    optsWhy: optsWhy, judgeWhy: judgeWhy, sayWhy: sayWhy, caseQ1: caseQ1,
    mount: mount
  };

})(window);
