/* =====================================================================
   5016B「硬體行為模擬」的三個任務（老師 2026-11-25）
   ---------------------------------------------------------------------
   ★ 老師：「模擬互動目前沒有強制，加入讓學生互動到特定數值的操作流程，
          設計三個（數字可在範圍內隨機）」
     ⇒ 第 1～4 節的模擬器上方各掛三個任務，**依序**完成；三個都完成才打開動手檢核。
        流程：暖身 → 模擬任務 → 動手檢核 → 程式碼＋實作。
   ★ 任務的數字每個人不同（?seed= 時全班同題），「再玩一次」會換一組。
   ★ 判定一律要**停住**一下（hold）—— 滑桿一路刷過去碰到目標不算，
     要真的停在那裡、看到結果才算。

   怎麼接：
     · 模擬器每次變化呼叫 SIMTASK.report('u1', 狀態) —— 只回報，不管任務。
     · 頁面呼叫 SIMTASK.mount(box, { unit, seed, onDone }) 掛任務面板。
       沒掛（第 5 節、或已經完成）的時候 report 什麼都不做。
   各節回報的狀態：
     u1 { dist, open, moving }          距離（公分）、門開著沒、馬達正在轉沒
     u2 { mode, dist, bright, led, keep, lit }  模式 1／2、距離、亮度、燈號、拿掉最後一行沒、亮著的燈
     u3 { pot, speed, angle }           A7 讀到 0～1023、轉速 −250～250、指針角度 0～180
     u4 { mode, pot, led | hue, rgb }   模式 1／2、A7、燈號 1～8｜顏色 0～359 與紅綠藍
   ⚠️ 不計分、不給星：完成只寫 modules.arduino.uN.sim（頁面的 LABSAVE 寫）。
   ===================================================================== */
(function (global) {
  'use strict';

  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var B = function (t) { return '<b class="text-indigo-700">' + t + '</b>'; };
  /* Arduino map()：整數運算、小數捨去 —— 和 5016b.html 第二節模擬器同一條（測試會比對） */
  function amap(x, a, b, c, d) { return Math.trunc((x - a) * (d - c) / (b - a)) + c; }
  function brightAt(d) { return amap(d, 55, 1, 1, 200); }

  /* 第四節用的顏色：照程式的 sin 公式，這幾個角度剛好是純色（2026-11-25 改；原本是一般色相 60／120／…） */
  var COLORS = [
    { name: '黃色', hue: 30, css: '#ca8a04' }, { name: '紅色', hue: 90, css: '#ef4444' },
    { name: '洋紅色', hue: 150, css: '#c026d3' }, { name: '藍色', hue: 210, css: '#3b82f6' },
    { name: '青色', hue: 270, css: '#0891b2' }, { name: '綠色', hue: 330, css: '#16a34a' }
  ];


  /* ── 各節的三個任務 ─────────────────────────────────────
     make(rng) → 這一次的數字；text(p, mem) → 題目；ok(s, p, mem) → 現在算不算達成。
     ⚠️ 範圍都要在模擬器拉得到的地方，而且要**拉得到剛好**（測試逐一驗證）。 */
  var TASKS = {
    /* 第一節：感應大門（模擬器 距離 5～60 公分；10 公分內開門、30 公分外關門、馬達轉 2 秒）
       ★ 三個任務連起來就是「遲滯」：開門 → 中間地帶不動 → 走遠才關。 */
    u1: [
      { key: 'open', make: function (rng) { return { x: ri(rng, 5, 9) }; },
        text: function (p) { return '人走過來：把距離調到 ' + B(p.x + ' 公分') + '，讓門打開（等馬達轉完）。'; },
        ok: function (s, p) { return s.dist === p.x && s.open && !s.moving; } },
      { key: 'middle', hold: 1500, make: function (rng) { return { x: ri(rng, 12, 28) }; },
        text: function (p) { return '門開著的時候，退到 ' + B(p.x + ' 公分') + ' 停住 —— 看看門會不會關？'; },
        ok: function (s, p) { return s.dist === p.x && s.open && !s.moving; } },
      { key: 'close', make: function (rng) { return { x: ri(rng, 32, 55) }; },
        text: function (p) { return '人走遠了：退到 ' + B(p.x + ' 公分') + '，讓門關上（等馬達轉完）。'; },
        ok: function (s, p) { return s.dist === p.x && !s.open && !s.moving; } }
    ],
    /* 第二節：迎賓走廊（模擬器照程式跑：距離 1～55 公分；按 1 亮度＝對應(距離,55→1,1→200)、
       按 2 位置＝對應(距離,55→1,1→8)；模式二可以拿掉最後一行，走過的燈會留著）
       ★ 老師 2026-11-25「讓兩邊一致」：舊版是「10～100 公分 → 亮幾顆」，和程式對不起來。 */
    u2: [
      { key: 'bright', make: function (rng) { return { n: brightAt(ri(rng, 5, 50)) }; },
        text: function (p) { return '<b>按 1</b> 切到亮度模式，讓亮度剛好是 ' + B(p.n) + '。'; },
        ok: function (s, p) { return s.mode === 1 && s.bright === p.n; } },
      { key: 'led', make: function (rng) { return { n: ri(rng, 2, 7) }; },
        text: function (p) { return '<b>按 2</b> 切到位置模式，讓' + B('第 ' + p.n + ' 顆') + '燈亮。'; },
        ok: function (s, p) { return s.mode === 2 && s.led === p.n; } },
      { key: 'trail', make: function (rng) { return { n: ri(rng, 4, 8) }; },
        text: function (p) {
          return '勾選「<b>拿掉程式最後一行</b>」，從遠處慢慢走近，讓' + B('第 1～' + p.n + ' 顆') + '都亮著、停在第 ' + p.n + ' 顆。' +
                 '<span class="text-xs text-slate-500">（一開始站太近、或走過頭的話：先退到最遠，按「🔄 清掉燈條」再走一次）</span>';
        },
        ok: function (s, p) {
          if (!(s.mode === 2 && s.keep && s.led === p.n && s.lit && s.lit.length === p.n)) return false;
          for (var i = 1; i <= p.n; i++) if (s.lit.indexOf(i) < 0) return false;
          return true;
        } }
    ],
    /* 第三節：無段風扇（模擬器照程式跑：A7 0～1023；轉速＝類比對應(A7,−250,250)，中間停、兩邊正反轉；
       指針角度＝類比對應(A7,0,180)）。★ 老師 2026-11-25「讓兩邊一致」：舊版是 PWM 0～255、只會正轉。 */
    u3: [
      { key: 'speed', make: function (rng) { var n = ri(rng, 40, 200); return { n: rng() < 0.5 ? -n : n }; },
        text: function (p) {
          return '轉旋鈕，讓轉速剛好是 ' + B(p.n) + '（' + (p.n < 0 ? '◀ 反轉' : '正轉 ▶') + '）。' +
                 '<span class="text-xs text-slate-500">（拉不準的話，點一下滑桿再按鍵盤的 ← →）</span>';
        },
        ok: function (s, p) { return s.speed === p.n; } },
      { key: 'angle', make: function (rng) { return { n: ri(rng, 2, 16) * 10 }; },
        text: function (p) { return '讓舞台上的指針面向 ' + B(p.n + ' 度') + '（0＝朝上、90＝朝右、180＝朝下）。'; },
        ok: function (s, p) { return s.angle === p.n; } },
      { key: 'flip', make: function (rng) { return { n: ri(rng, 60, 200) }; },
        text: function (p, mem) {
          return '先讓風扇<b>反轉到最快</b>（轉速 −250）' + (mem.min ? ' <span class="text-emerald-600">✓</span>' : '') +
                 '，再轉到<b>正轉</b>、轉速剛好 ' + B(p.n) + '。';
        },
        ok: function (s, p, mem) { if (s.speed === -250) mem.min = true; return !!mem.min && s.speed === p.n; } }
    ],
    /* 第四節：情境照明（模擬器照程式跑：按 1 燈號＝類比對應(A7,1,8)；按 2 顏色＝類比對應(A7,0,359)，
       紅綠藍用程式那三行 sin 算 —— 30 黃、90 紅、150 洋紅、210 藍、270 青、330 綠）。
       ★ 老師 2026-11-25「讓兩邊一致」：舊版用一般色相（0 紅、120 綠），和實機顏色不一樣。 */
    u4: [
      { key: 'led', make: function (rng) { return { n: ri(rng, 2, 7) }; },
        text: function (p) { return '<b>按 1</b>（燈號移動），讓' + B('第 ' + p.n + ' 顆') + '亮。'; },
        ok: function (s, p) { return s.mode === 1 && s.led === p.n; } },
      { key: 'color', make: function (rng) { var c = COLORS[ri(rng, 0, COLORS.length - 1)]; return { name: c.name, hue: c.hue, css: c.css }; },
        text: function (p) { return '<b>按 2</b>（混色），把燈條調成「<b style="color:' + p.css + '">' + p.name + '</b>」—— 顏色是多少要自己找（差 6 以內都算）。'; },
        ok: function (s, p) { return s.mode === 2 && Math.abs(s.hue - p.hue) <= 6; } },
      { key: 'full', make: function (rng) { var k = ri(rng, 0, 2); return { k: k, name: ['紅', '綠', '藍'][k] }; },
        text: function (p) {
          return '<b>按 2</b>，讓三盞小燈裡的「<b>' + p.name + '</b>」開到<b>最亮（255）</b> —— 看下面的紅綠藍數字找。';
        },
        ok: function (s, p) { return s.mode === 2 && s.rgb && s.rgb[p.k] === 255; } }
    ]
  };
  var HOLD = 800;      // 停住多久才算（毫秒）

  var cur = null;      // 現在掛著的那一組（一次只有一個單元）

  function rngFor(seed, unit) {
    var U = global.ULTRALAB;
    return U && U.rngFrom ? U.rngFrom(seed == null || seed === '' ? null : (seed + '-sim-' + unit)) : Math.random;
  }

  /** 出一組題目（三個任務的數字） */
  function makeSet(unit, rng) {
    return (TASKS[unit] || []).map(function (t) { return { t: t, p: t.make(rng), mem: {} }; });
  }

  /** 掛任務面板。opts: { unit, seed, onDone() }。回傳 { report, step, set } */
  function mount(box, opts) {
    opts = opts || {};
    var unit = opts.unit, list = TASKS[unit];
    if (!box || !list) return null;
    var me = { unit: unit, set: makeSet(unit, rngFor(opts.seed, unit)), i: 0, since: 0, timer: null, last: null, done: false };
    cur = me;

    function paint(holding) {
      var rows = me.set.map(function (x, k) {
        var st = k < me.i ? 'done' : (k === me.i && !me.done ? 'now' : (me.done ? 'done' : 'todo'));
        var cls = st === 'done' ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : st === 'now' ? 'bg-amber-50 border-amber-400 text-slate-800 shadow'
                : 'bg-slate-50 border-slate-200 text-slate-400';
        var icon = st === 'done' ? '✅' : (st === 'now' ? '👉' : '🔒');
        var body = st === 'todo' ? '完成上一個任務才會出現' : x.t.text(x.p, x.mem);
        var tip = st === 'now' && holding ? '<div class="text-xs font-black text-amber-700 mt-1 animate-pulse">✋ 對了！停住別動…</div>' : '';
        return '<li class="flex gap-2 items-start border-2 rounded-xl p-3 ' + cls + '" data-task="' + k + '" data-st="' + st + '">' +
               '<span class="text-lg leading-none">' + icon + '</span>' +
               '<div class="flex-1 text-sm leading-relaxed"><b>任務 ' + (k + 1) + '</b>　' + body + tip + '</div></li>';
      }).join('');
      box.innerHTML =
        '<div class="flex items-center justify-between flex-wrap gap-2 mb-2">' +
          '<div class="font-black text-slate-800">🎮 模擬任務 <span class="text-sm text-slate-500 font-bold">' + Math.min(me.i, 3) + '／3</span></div>' +
          '<div class="text-xs text-slate-500">三個任務都完成，下面的<b>動手檢核</b>才會打開</div>' +
        '</div><ol class="space-y-2">' + rows + '</ol>';
    }

    function finishStep() {
      me.since = 0; me.timer = null;
      me.i++;
      if (me.i >= me.set.length) {
        me.done = true; paint(false);
        if (cur === me) cur = null;
        if (opts.onDone) opts.onDone({ unit: unit });
        return;
      }
      paint(false);
      if (me.last) judge(me.last);     // 下一個任務：用現在的狀態再判一次（不必再動一下才算）
    }

    function judge(s) {
      if (me.done) return;
      me.last = s;
      var x = me.set[me.i], hit = !!x.t.ok(s, x.p, x.mem);
      if (!hit) {
        if (me.timer) { clearTimeout(me.timer); me.timer = null; }
        if (me.since) { me.since = 0; paint(false); }
        else if (x.mem.min) paint(false);   // 前半段完成的 ✓ 要畫出來
        return;
      }
      if (me.since) return;            // 已經在等了
      me.since = Date.now();
      paint(true);
      var hold = x.t.hold || HOLD, token = me;
      me.timer = setTimeout(function () {
        if (cur !== token || token.done) return;          // 換單元、重來了 ⇒ 這個計時作廢
        var y = token.set[token.i];
        if (y === x && token.last && x.t.ok(token.last, x.p, x.mem)) finishStep();
        else { token.since = 0; paint(false); }
      }, hold);
    }

    me.report = judge;
    paint(false);
    return { report: judge, step: function () { return me.i; }, set: me.set };
  }

  /** 模擬器呼叫：回報現在的狀態。沒有掛任務、或不是這一節的 ⇒ 不做事。 */
  function report(unit, s) {
    if (cur && cur.unit === unit && cur.report) cur.report(s);
  }
  /** 離開單元時呼叫：計時器作廢 */
  function stop() { if (cur && cur.timer) clearTimeout(cur.timer); cur = null; }

  var api = { TASKS: TASKS, amap: amap, HOLD: HOLD, COLORS: COLORS, makeSet: makeSet, mount: mount, report: report, stop: stop, esc: esc };
  try { Object.freeze(api); } catch (e) {}
  global.SIMTASK = api;
})(typeof window !== 'undefined' ? window : globalThis);
