/* =====================================================================
   套餐工廠：用速食店的套餐體驗「模組化」
   ---------------------------------------------------------------------
   ★ 為什麼要有這一段
     「把重複的那一段包起來」對國中生太抽象 ——
     他還沒寫過幾行程式，「重複」對他來說不是痛苦，只是一句話。
     但速食店的套餐他每個人都點過，而且**他本來就知道套餐是怎麼組的**：
       主餐 ＋ 配餐 ＋ 飲料
     這一段做的事，是把他已經有的直覺搬到程式上，不是教他新東西。

   ★ 三層，剛好對上課本的三個概念
     ① 組套餐        → 模組化：一份餐＝三個模組拼起來
     ② 換一個模組     → 改一個地方，其他都不用動
     ③ 主餐再拆開     → 模組裡面還有模組（漢堡＝麵包＋肉排＋醬）
                       這一層就是「副程式裡可以再呼叫副程式」

   ★ 為什麼要讓他自己動手拼，不是看圖說故事
     「看懂」和「做得出來」中間的距離，就是這個站台存在的理由。
     他自己組出 3 種套餐之後，「六個正方形共用同一段」那句話
     才會落在他已經有的經驗上。

   ⚠️ 這一支完全不碰 AI、不碰 Firestore、不算分。
      它是體驗，不是考試 —— 一加上分數，學生就會開始猜答案。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-10-combo';

  /* ── 材料 ─────────────────────────────────────────
     ★ 主餐要能再拆開，所以它有 parts；配餐和飲料沒有。
       這個不對稱是刻意的 —— 學生要看到「有些模組裡面還有模組」。 */
  var MAIN = [
    { id: 'burger', name: '牛肉漢堡', icon: '🍔',
      parts: [
        { name: '麵包', icon: '🥯' },
        { name: '牛肉排', icon: '🥩' },
        { name: '生菜', icon: '🥬' },
        { name: '醬', icon: '🧴' }
      ] },
    { id: 'chicken', name: '雞腿堡', icon: '🍗',
      parts: [
        { name: '麵包', icon: '🥯' },
        { name: '炸雞腿', icon: '🍗' },
        { name: '生菜', icon: '🥬' },
        { name: '醬', icon: '🧴' }
      ] },
    { id: 'fish', name: '鱈魚堡', icon: '🐟',
      parts: [
        { name: '麵包', icon: '🥯' },
        { name: '魚排', icon: '🐟' },
        { name: '起司', icon: '🧀' },
        { name: '醬', icon: '🧴' }
      ] }
  ];
  var SIDE = [
    { id: 'fries', name: '薯條', icon: '🍟' },
    { id: 'nugget', name: '雞塊', icon: '🍤' },
    { id: 'salad', name: '沙拉', icon: '🥗' }
  ];
  var DRINK = [
    { id: 'cola', name: '可樂', icon: '🥤' },
    { id: 'tea', name: '紅茶', icon: '🧋' },
    { id: 'milk', name: '牛奶', icon: '🥛' }
  ];

  var SLOTS = [
    { key: 'main',  name: '主餐',  items: MAIN },
    { key: 'side',  name: '配餐',  items: SIDE },
    { key: 'drink', name: '飲料',  items: DRINK }
  ];

  /* ── 三個關卡 ───────────────────────────────────── */
  var STAGES = [
    {
      title: '① 組一份套餐',
      ask: '三個位置各挑一個，組成一份套餐。',
      /* ★ 目標是 3 份「不一樣的」套餐。
         組出三份之後，他會自己發現：換的只是其中一格。 */
      goal: 3,
      done: '你組了 3 份不一樣的套餐 —— 但每一份都是<b>同樣三個位置</b>：主餐、配餐、飲料。' +
            '<br>店員不必為每一種組合重學一次，因為<b>套餐的「架構」只有一種</b>。'
    },
    {
      title: '② 換掉一個模組',
      ask: '把飲料換成別的，主餐和配餐<b>不要動</b>。',
      goal: 2,
      done: '你只動了一格，其他兩格完全沒碰。<br>' +
            '<b>這就是模組化最實際的好處：改一個地方，其他都不用動。</b>'
    },
    {
      title: '③ 打開主餐看看',
      ask: '點一下你的主餐，看看它裡面是什麼。',
      goal: 1,
      done: '主餐自己也是拼出來的：麵包 ＋ 肉 ＋ 配料 ＋ 醬。<br>' +
            '<b>模組裡面還可以有模組</b> —— 等一下你會看到，' +
            '副程式裡面也可以再呼叫另一個副程式。'
    }
  ];

  /* ── 畫面 ───────────────────────────────────────── */
  function mount(host, opts) {
    opts = opts || {};
    if (!host) return;
    ensureStyle();

    var st = 0;                        // 現在第幾關
    var pick = { main: null, side: null, drink: null };
    var made = [];                     // 組過哪些套餐（用 id 串起來比對）
    var swaps = 0;                     // 第 2 關換過幾次飲料
    var opened = false;                // 第 3 關打開過主餐沒
    var doneAll = false;

    draw();

    function draw() {
      var s = STAGES[st];
      host.innerHTML =
        '<div class="cb-top">' +
          '<div class="cb-steps">' + STAGES.map(function (x, i) {
            return '<span class="cb-dot ' + (i < st ? 'ok' : i === st ? 'now' : '') + '"></span>';
          }).join('') + '</div>' +
          '<h3 class="cb-title">🍔 ' + s.title + '</h3>' +
          '<p class="cb-ask">' + s.ask + '</p>' +
        '</div>' +
        '<div class="cb-tray">' + SLOTS.map(function (sl) {
          var got = pick[sl.key];
          return '<div class="cb-slot' + (got ? ' has' : '') + '" data-slot="' + sl.key + '">' +
            '<div class="cb-slot-h">' + sl.name + '</div>' +
            '<div class="cb-slot-b">' + (got ? '<span class="cb-ic">' + got.icon + '</span>' +
              '<span class="cb-nm">' + got.name + '</span>' : '<span class="cb-empty">還沒選</span>') +
            '</div></div>';
        }).join('') + '</div>' +
        '<div class="cb-picks">' + SLOTS.map(function (sl) {
          return '<div class="cb-row"><div class="cb-row-h">' + sl.name + '</div>' +
            '<div class="cb-row-b">' + sl.items.map(function (it) {
              var on = pick[sl.key] && pick[sl.key].id === it.id;
              return '<button class="cb-chip' + (on ? ' on' : '') + '" data-k="' + sl.key +
                     '" data-id="' + it.id + '">' + it.icon + ' ' + it.name + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>' +
        '<div id="cb-open"></div>' +
        '<div id="cb-log" class="cb-log"></div>' +
        '<div id="cb-msg"></div>';

      host.querySelectorAll('.cb-chip').forEach(function (b) {
        b.onclick = function () { choose(b.dataset.k, b.dataset.id); };
      });
      /* 第 3 關：點托盤上的主餐就會展開它的零件。 */
      var mainSlot = host.querySelector('[data-slot="main"]');
      if (mainSlot && st === 2) {
        mainSlot.classList.add('clickable');
        mainSlot.onclick = openMain;
      }
      paintLog();
      if (st === 2 && opened) showParts();
    }

    function choose(key, id) {
      var sl = SLOTS.filter(function (x) { return x.key === key; })[0];
      var it = sl.items.filter(function (x) { return x.id === id; })[0];
      var was = pick[key];
      pick[key] = it;

      if (st === 1 && key === 'drink' && was && was.id !== it.id) swaps++;
      /* ⚠️ 第 2 關動到主餐或配餐 → 不算數，而且要說出來為什麼。
         只是不加分的話，他不知道自己違反了什麼。 */
      if (st === 1 && key !== 'drink') {
        note('bad', '這一關只換<b>飲料</b>喔 —— 主餐和配餐請保持原樣。' +
                    '（模組化的重點就是「動一格，其他不動」）');
      }
      draw();
      check();
    }

    function full() { return pick.main && pick.side && pick.drink; }
    function sig() { return full() ? pick.main.id + '+' + pick.side.id + '+' + pick.drink.id : ''; }

    function check() {
      if (st === 0) {
        var k = sig();
        if (k && made.indexOf(k) < 0) { made.push(k); paintLog(); }
        if (made.length >= STAGES[0].goal) return finish();
      }
      if (st === 1 && swaps >= STAGES[1].goal) return finish();
    }

    function openMain() {
      if (!pick.main) { note('bad', '先選一個主餐，才有東西可以打開。'); return; }
      opened = true;
      showParts();
      finish();
    }

    function showParts() {
      var m = pick.main;
      host.querySelector('#cb-open').innerHTML =
        '<div class="cb-open">' +
          '<div class="cb-open-h">' + m.icon + ' ' + m.name + ' 裡面是：</div>' +
          '<div class="cb-parts">' + m.parts.map(function (p) {
            return '<span class="cb-part">' + p.icon + ' ' + p.name + '</span>';
          }).join('<span class="cb-plus">＋</span>') + '</div>' +
        '</div>';
    }

    function paintLog() {
      var box = host.querySelector('#cb-log');
      if (!box) return;
      if (st !== 0 || !made.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="cb-log-h">你組過的套餐（' + made.length + ' / ' +
        STAGES[0].goal + '）</div>' + made.map(function (k) {
          var p = k.split('+');
          return '<div class="cb-log-i">' + icon(MAIN, p[0]) + ' ＋ ' + icon(SIDE, p[1]) +
                 ' ＋ ' + icon(DRINK, p[2]) + '</div>';
        }).join('');
    }
    function icon(list, id) {
      var x = list.filter(function (y) { return y.id === id; })[0];
      return x ? x.icon + ' ' + x.name : id;
    }

    function note(kind, html) {
      var box = host.querySelector('#cb-msg');
      if (box) box.innerHTML = '<div class="cb-note ' + kind + '">' + html + '</div>';
    }

    function finish() {
      note('good', STAGES[st].done +
        '<button id="cb-next" class="cb-btn">' +
        (st < STAGES.length - 1 ? '下一關 →' : '我懂了，開始這一關 →') + '</button>');
      var b = host.querySelector('#cb-next');
      if (!b) return;
      b.onclick = function () {
        if (st < STAGES.length - 1) {
          st++;
          if (st === 1) swaps = 0;
          draw();
          return;
        }
        doneAll = true;
        if (opts.onDone) opts.onDone();
      };
    }

    /* 給測試用：不必模擬點擊也走得完 */
    host.__combo = {
      state: function () { return { st: st, made: made.slice(), swaps: swaps, opened: opened, done: doneAll }; },
      choose: choose,
      openMain: openMain
    };
  }

  var styled = false;
  function ensureStyle() {
    if (styled || typeof document === 'undefined') return;
    styled = true;
    var css = [
      '.cb-top{margin-bottom:12px}',
      '.cb-steps{display:flex;gap:6px;margin-bottom:8px}',
      '.cb-dot{width:26px;height:6px;border-radius:99px;background:#e2e8f0}',
      '.cb-dot.now{background:#f59e0b}.cb-dot.ok{background:#10b981}',
      '.cb-title{font-size:17px;font-weight:900;margin:0 0 4px}',
      '.cb-ask{font-size:14px;color:#475569;line-height:1.8;margin:0}',
      '.cb-tray{display:flex;gap:8px;margin:12px 0}',
      '.cb-slot{flex:1;border:2px dashed #cbd5e1;border-radius:14px;padding:8px;text-align:center;background:#fff}',
      '.cb-slot.has{border-style:solid;border-color:#fbbf24;background:#fffbeb}',
      '.cb-slot.clickable{cursor:pointer}',
      '.cb-slot.clickable:hover{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15)}',
      '.cb-slot-h{font-size:11.5px;font-weight:900;color:#94a3b8;margin-bottom:3px}',
      '.cb-ic{display:block;font-size:26px;line-height:1.2}',
      '.cb-nm{font-size:12.5px;font-weight:800}',
      '.cb-empty{font-size:12.5px;color:#cbd5e1;display:block;padding:9px 0}',
      '.cb-row{margin-bottom:8px}',
      '.cb-row-h{font-size:11.5px;font-weight:900;color:#64748b;margin-bottom:4px}',
      '.cb-row-b{display:flex;gap:6px;flex-wrap:wrap}',
      '.cb-chip{border:2px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 12px;',
      '  font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.cb-chip:hover{border-color:#fbbf24}',
      '.cb-chip.on{border-color:#f59e0b;background:#fef3c7}',
      '.cb-log{margin-top:10px}',
      '.cb-log-h{font-size:11.5px;font-weight:900;color:#64748b;margin-bottom:4px}',
      '.cb-log-i{font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;',
      '  padding:5px 10px;margin-bottom:4px}',
      '.cb-open{margin-top:10px;background:#eff6ff;border:2px solid #bfdbfe;border-radius:13px;padding:11px 13px}',
      '.cb-open-h{font-size:13.5px;font-weight:900;color:#1e3a8a;margin-bottom:6px}',
      '.cb-parts{display:flex;flex-wrap:wrap;align-items:center;gap:4px}',
      '.cb-part{background:#fff;border:1px solid #bfdbfe;border-radius:9px;padding:4px 9px;font-size:13px;font-weight:700}',
      '.cb-plus{color:#60a5fa;font-weight:900;font-size:12px}',
      '.cb-note{margin-top:11px;padding:11px 13px;border-radius:12px;font-size:13.5px;line-height:1.9}',
      '.cb-note.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}',
      '.cb-note.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}',
      '.cb-btn{display:block;width:100%;margin-top:9px;padding:10px;border:0;border-radius:12px;',
      '  background:#f59e0b;color:#fff;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit}'
    ].join('\n');
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  global.COMBO = {
    VERSION: VERSION,
    STAGES: STAGES,
    MAIN: MAIN, SIDE: SIDE, DRINK: DRINK,
    mount: mount
  };

})(typeof window !== 'undefined' ? window : this);
