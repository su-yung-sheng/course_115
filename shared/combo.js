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
     ★ 主餐自己也是拼出來的，所以它有四個**零件插槽**；配餐和飲料沒有。
       這個不對稱是刻意的 —— 學生要看到「有些模組裡面還有模組」。
       第 3 關會讓他打開主餐、換掉裡面的一個零件，
       那就是「副程式裡面再呼叫另一個副程式」的樣子。 */
  var PARTS = {
    bun:   { name: '麵包', items: [
      { id: 'plain',  name: '原味麵包', icon: '🥯' },
      { id: 'sesame', name: '芝麻麵包', icon: '🍞' },
      { id: 'muffin', name: '滿福堡',   icon: '🥞' }
    ] },
    /* ★ 主料決定這份主餐叫什麼（as / asIcon）。
       換掉裡面的肉排，外面看到的名字就跟著變 ——
       那正是「模組換掉，外面的行為就不一樣」最直接的樣子，
       而且學生會自己看到，不必用講的。 */
    patty: { name: '主料', items: [
      { id: 'beef',    name: '牛肉排', icon: '🥩', as: '牛肉漢堡', asIcon: '🍔' },
      { id: 'chicken', name: '炸雞腿', icon: '🍗', as: '雞腿堡',   asIcon: '🍗' },
      { id: 'fish',    name: '魚排',   icon: '🐟', as: '鱈魚堡',   asIcon: '🐟' },
      { id: 'veggie',  name: '素肉排', icon: '🫘', as: '蔬食堡',   asIcon: '🥬' }
    ] },
    veg:   { name: '蔬菜', items: [
      { id: 'lettuce', name: '生菜',   icon: '🥬' },
      { id: 'tomato',  name: '蕃茄',   icon: '🍅' },
      { id: 'onion',   name: '洋蔥',   icon: '🧅' },
      { id: 'none',    name: '不加菜', icon: '🚫' }
    ] },
    sauce: { name: '醬料', items: [
      { id: 'ketchup', name: '蕃茄醬',   icon: '🍅' },
      { id: 'mayo',    name: '美乃滋',   icon: '🥄' },
      { id: 'cheese',  name: '起司醬',   icon: '🧀' }
    ] }
  };
  var PART_KEYS = ['bun', 'patty', 'veg', 'sauce'];

  /* 主餐＝一組預設的零件。★ 三種主餐共用同一批零件 ——
     那正是「重複的部分可以共用」最直接的樣子。 */
  var MAIN = [
    { id: 'burger',  name: '牛肉漢堡', icon: '🍔',
      inner: { bun: 'plain',  patty: 'beef',    veg: 'lettuce', sauce: 'ketchup' } },
    { id: 'chicken', name: '雞腿堡',   icon: '🍗',
      inner: { bun: 'sesame', patty: 'chicken', veg: 'lettuce', sauce: 'mayo' } },
    { id: 'fish',    name: '鱈魚堡',   icon: '🐟',
      inner: { bun: 'plain',  patty: 'fish',    veg: 'tomato',  sauce: 'cheese' } }
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

  /* ── 訂單 ─────────────────────────────────────────
     ★ 不寫死題庫，直接列出**所有** 3×3×3 = 27 種組合。
       手寫十張的問題是「看起來都差不多」——
       十張裡有四張主餐都是漢堡，學生只覺得系統在跳針。

     ★ 抽出來的三張要**兩兩至少差兩格**。
       只差一格的兩張擺在一起，看起來就是同一張 ——
       而這一關要他看到的正好相反：同樣三個位置，內容可以差很多。 */
  function allOrders() {
    var out = [];
    MAIN.forEach(function (m) {
      SIDE.forEach(function (s) {
        DRINK.forEach(function (d) {
          out.push({ main: m.id, side: s.id, drink: d.id });
        });
      });
    });
    return out;
  }
  function diff(a, b) {
    return (a.main !== b.main ? 1 : 0) + (a.side !== b.side ? 1 : 0) + (a.drink !== b.drink ? 1 : 0);
  }
  /** 抽 n 張，兩兩至少差 minDiff 格 */
  function pickOrders(n, minDiff) {
    var pool = shuffle(allOrders()), out = [];
    pool.forEach(function (o) {
      if (out.length >= n) return;
      if (out.every(function (x) { return diff(x, o) >= minDiff; })) out.push(o);
    });
    /* 挑不滿就放寬 —— 卡在這裡比看到相似的訂單糟得多。 */
    while (out.length < n) out.push(pool[out.length]);
    return out;
  }
  var N_ORDER = 3;          // 一個學生要組幾張

  /* ── 三個關卡 ─────────────────────────────────── */
  var STAGES = [
    { title: '① 照訂單組套餐',
      ask: '客人點了這一份，三個位置各選對一個。',
      done: '三張訂單都組好了 —— 但每一張都是<b>同樣三個位置</b>：主餐、配餐、飲料。' +
            '<br>店員不必為每一種組合重學一次，因為<b>套餐的「架構」只有一種</b>。' },
    { title: '② 換掉一個模組',
      ask: '客人臨時改單：<b>只換飲料</b>，主餐和配餐不要動。',
      done: '你只動了一格，其他兩格完全沒碰。<br>' +
            '<b>這就是模組化最實際的好處：改一個地方，其他都不用動。</b>' },
    { title: '③ 打開主餐，換掉裡面一樣東西',
      ask: '點一下托盤上的主餐把它打開，然後<b>換掉裡面任何一個零件</b>。',
      done: '主餐自己也是拼出來的：麵包 ＋ 主料 ＋ 蔬菜 ＋ 醬料，' +
            '而且你只換了其中一格，其他三格沒動。' +
            '換掉主料的話，連<b>外面看到的名字都跟著變</b>了。<br>' +
            '<b>模組裡面還可以有模組</b> —— 等一下你會看到，' +
            '副程式裡面也可以再呼叫另一個副程式。' }
  ];

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function find(list, id) {
    return list.filter(function (x) { return x.id === id; })[0] || null;
  }
  function slotList(key) {
    return SLOTS.filter(function (x) { return x.key === key; })[0].items;
  }
  /** 這一份主餐現在叫什麼（由主料決定） */
  function mainNameOf(inner) {
    var p = find(PARTS.patty.items, inner.patty);
    return { name: (p && p.as) || '主餐', icon: (p && p.asIcon) || '🍔' };
  }

  function orderText(o) {
    return SLOTS.map(function (sl) {
      var it = find(sl.items, o[sl.key]);
      return '<b>' + it.icon + ' ' + it.name + '</b>';
    }).join(' ＋ ');
  }

  /* ── 畫面 ───────────────────────────────────────── */
  function mount(host, opts) {
    opts = opts || {};
    if (!host) return;
    ensureStyle();

    var st = 0;
    var orders = pickOrders(N_ORDER, 2);   // 這一次要組的三張（兩兩至少差兩格）
    var oi = 0;                                       // 現在第幾張
    var pick = { main: null, side: null, drink: null };
    var swapWant = null;      // 第 2 關要換成哪一種飲料
    var opened = false;
    var inner = {};           // 第 3 關：主餐裡面現在裝了什麼
    var innerBase = '';       // 打開時的原樣（用來判斷「換過了沒」）

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
        orderCard() +
        '<div class="cb-tray">' + SLOTS.map(function (sl) {
          var got = pick[sl.key];
          /* ★ 主餐打開之後，托盤上的名字要跟著裡面的主料變 ——
             不然學生換了炸雞腿，托盤還寫「牛肉漢堡」，那才是真的看不懂。 */
          var show = got;
          if (got && sl.key === 'main' && opened) {
            var nm = mainNameOf(inner);
            show = { icon: nm.icon, name: nm.name };
          }
          return '<div class="cb-slot' + (got ? ' has' : '') + '" data-slot="' + sl.key + '">' +
            '<div class="cb-slot-h">' + sl.name + '</div>' +
            '<div class="cb-slot-b">' + (show ? '<span class="cb-ic">' + show.icon + '</span>' +
              '<span class="cb-nm">' + show.name + '</span>' : '<span class="cb-empty">還沒選</span>') +
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
        '<div id="cb-msg"></div>';

      host.querySelectorAll('.cb-chip').forEach(function (b) {
        b.onclick = function () { choose(b.dataset.k, b.dataset.id); };
      });
      var mainSlot = host.querySelector('[data-slot="main"]');
      if (mainSlot && st === 2) {
        mainSlot.classList.add('clickable');
        mainSlot.onclick = openMain;
      }
      if (st === 2 && opened) showParts();
    }

    /** 訂單卡：學生要照著組的那一份 */
    function orderCard() {
      if (st === 0) {
        return '<div class="cb-order"><div class="cb-order-h">📋 訂單 ' +
          (oi + 1) + ' / ' + orders.length + '</div>' + orderText(orders[oi]) + '</div>';
      }
      if (st === 1) {
        if (!swapWant) swapWant = pickSwap();
        return '<div class="cb-order change"><div class="cb-order-h">🔁 改單</div>' +
          '飲料換成 <b>' + swapWant.icon + ' ' + swapWant.name + '</b>' +
          '<div class="cb-order-note">主餐和配餐維持原樣。</div></div>';
      }
      return '';
    }

    /** 第 2 關要換成哪一種：一定和現在這杯不一樣 */
    function pickSwap() {
      var now = pick.drink ? pick.drink.id : '';
      var others = slotList('drink').filter(function (x) { return x.id !== now; });
      return shuffle(others)[0];
    }

    function choose(key, id) {
      var it = find(slotList(key), id);
      var was = pick[key];

      /* ⚠️ 第 2 關動到主餐或配餐 → 擋下來，而且要說出為什麼。
         只是「不算數」的話，他不知道自己違反了什麼。 */
      if (st === 1 && key !== 'drink') {
        note('bad', '這一關只換<b>飲料</b> —— 主餐和配餐請保持原樣。' +
                    '（模組化的重點就是「動一格，其他不動」）');
        return;
      }
      pick[key] = it;
      draw();
      check(key, was);
    }

    function check(key, was) {
      if (st === 0) {
        var o = orders[oi];
        var okAll = SLOTS.every(function (sl) {
          return pick[sl.key] && pick[sl.key].id === o[sl.key];
        });
        if (!okAll) { note('', ''); return; }
        if (oi < orders.length - 1) {
          oi++;
          /* ★ 下一張訂單保留上一份的選擇 ——
             這樣他自己會看到「只要改動不一樣的那幾格」。 */
          note('good2', '✅ 訂單 ' + oi + ' 完成！接著是下一張。');
          draw();
          return;
        }
        finish();
        return;
      }
      if (st === 1 && key === 'drink' && swapWant && pick.drink.id === swapWant.id
          && (!was || was.id !== pick.drink.id)) {
        finish();
      }
    }

    function openMain() {
      if (!pick.main) { note('bad', '先選一個主餐，才有東西可以打開。'); return; }
      if (!opened) {
        opened = true;
        inner = {};
        PART_KEYS.forEach(function (k) { inner[k] = pick.main.inner[k]; });
        innerBase = JSON.stringify(inner);
      }
      showParts();
    }

    /** 換掉主餐裡面的一個零件 */
    function swapPart(key, id) {
      if (!opened) return;
      inner[key] = id;
      draw();            // 托盤上的名字也要跟著換
      showParts();
      /* 只要和原本不一樣就算完成 —— 換哪一格都可以。 */
      if (JSON.stringify(inner) !== innerBase) finish();
    }

    function showParts() {
      var nm = mainNameOf(inner);
      var renamed = nm.name !== pick.main.name;
      host.querySelector('#cb-open').innerHTML =
        '<div class="cb-open">' +
          '<div class="cb-open-h">' + nm.icon + ' ' + nm.name + ' 打開來看：' +
            (renamed ? '<span class="cb-renamed">名字變了！本來是 ' +
                       pick.main.icon + ' ' + pick.main.name + '</span>' : '') +
          '</div>' +
          '<div class="cb-parts">' + PART_KEYS.map(function (k) {
            var it = find(PARTS[k].items, inner[k]);
            return '<span class="cb-part">' + it.icon + ' ' + it.name + '</span>';
          }).join('<span class="cb-plus">＋</span>') + '</div>' +
          '<div class="cb-inner">' + PART_KEYS.map(function (k) {
            return '<div class="cb-row"><div class="cb-row-h">' + PARTS[k].name + '</div>' +
              '<div class="cb-row-b">' + PARTS[k].items.map(function (it) {
                return '<button class="cb-chip small' + (inner[k] === it.id ? ' on' : '') +
                  '" data-pk="' + k + '" data-pi="' + it.id + '">' +
                  it.icon + ' ' + it.name + '</button>';
              }).join('') + '</div></div>';
          }).join('') + '</div>' +
        '</div>';
      host.querySelectorAll('[data-pk]').forEach(function (b) {
        b.onclick = function () { swapPart(b.dataset.pk, b.dataset.pi); };
      });
    }

    function note(kind, html) {
      var box = host.querySelector('#cb-msg');
      if (!box) return;
      box.innerHTML = html ? '<div class="cb-note ' + (kind === 'good2' ? 'good' : kind) + '">' + html + '</div>' : '';
    }

    function finish() {
      note('good', STAGES[st].done +
        '<button id="cb-next" class="cb-btn">' +
        (st < STAGES.length - 1 ? '下一關 →' : '我懂了，開始這一關 →') + '</button>');
      var b = host.querySelector('#cb-next');
      if (!b) return;
      b.onclick = function () {
        if (st < STAGES.length - 1) { st++; draw(); return; }
        if (opts.onDone) opts.onDone();
      };
    }

    /* 給測試用：不必模擬點擊也走得完 */
    host.__combo = {
      state: function () {
        return { st: st, oi: oi, orders: orders, pick: pick, swapWant: swapWant, opened: opened };
      },
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
      '.cb-order{margin:0 0 12px;border:2px solid #fbbf24;border-radius:14px;background:#fffbeb;',
      '  padding:11px 13px;font-size:15px;color:#78350f}',
      '.cb-order.change{border-color:#60a5fa;background:#eff6ff;color:#1e3a8a}',
      '.cb-order-h{font-size:11.5px;font-weight:900;opacity:.75;margin-bottom:3px}',
      '.cb-order-note{font-size:12px;opacity:.8;margin-top:3px}',
      '.cb-log{margin-top:10px}',
      '.cb-log-h{font-size:11.5px;font-weight:900;color:#64748b;margin-bottom:4px}',
      '.cb-log-i{font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;',
      '  padding:5px 10px;margin-bottom:4px}',
      '.cb-open{margin-top:10px;background:#eff6ff;border:2px solid #bfdbfe;border-radius:13px;padding:11px 13px}',
      '.cb-renamed{display:block;font-size:11.5px;font-weight:800;color:#b45309;margin-top:2px}',
      '.cb-inner{margin-top:10px;padding-top:9px;border-top:1px dashed #bfdbfe}',
      '.cb-chip.small{padding:4px 9px;font-size:12px}',
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
    PARTS: PARTS, PART_KEYS: PART_KEYS,
    _allOrders: allOrders, _pickOrders: pickOrders, _diff: diff,
    _mainNameOf: mainNameOf,
    mount: mount
  };

})(typeof window !== 'undefined' ? window : this);
