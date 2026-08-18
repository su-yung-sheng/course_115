/* =====================================================================
   實作體驗：資料大爆炸（第 10 關 6-3-3 的最後一步）
   ---------------------------------------------------------------------
   ★ 這一關的定位變了（老師 2026-08-17）
     原本叫「搜尋大比拼」，還要學生再拼一支循序搜尋 ——
     但這一關比的是**第 8、9 關寫過的那兩支程式**，它自己不該再寫一支。
     而且它其實是**第 6 章的總結**：排序（6、7 關）＋ 搜尋（8、9 關）。
     ⇒ 改名「資料大爆炸」（五個字，和第 5～9 關同一個節奏），
     最後一步換成一段體驗。

   ★★ 這一段要讓學生撞到的那件事
     四關各自都學過了，但**沒有人把它們放在一起看過**：
       · 排序很**貴**：100 筆用選擇排序要比 4950 次
       · 搜尋差很多：同樣 100 筆，循序最多 100 次、二元只要 7 次
       · 但二元搜尋**要先排好序** —— 而排序那 4950 次是先付掉的
     ⇒ 所以真正的問題不是「哪一個比較快」，而是
       **「你要查幾次？」**
         查 1 次　 → 不必排（100 次 vs 4957 次）
         查 108 次 → 先排划算（10800 次 vs 5706 次）
       ⚠️ 那個分界點跟著資料量跑（100 筆是 54 次、1000 筆是 505 次）——
          所以第二個情境的次數是**現算**的，不可以寫死。
     那個「看情況」才是這一章真正的結論。

   ⚠️ 不要把它做成「二元搜尋比較好」。
      課本上那句「二元搜尋比較快」是有前提的 ——
      前提沒講的話，學生會以為排序是免費的。

   用法：
     BIGCOST.mount(host, { onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-bigcost';

  /* ── 規則（純函式）───────────────────────────────── */

  /**
   * 選擇排序要比幾次。
   * ★ 第一回合比 n-1 次、第二回合 n-2 次…… 加起來 n(n-1)/2。
   *   ⚠️ 和第 5 關的「找一個最小值要比 n-1 次」是**同一件事做 n 遍** ——
   *      這一段就是要學生看見那個「n 遍」有多可怕。
   */
  function selCompares(n) { return n * (n - 1) / 2; }

  /**
   * 插入排序**最壞情況**要比幾次（完全相反的順序）。
   * ★ 和選擇排序一樣是 n(n-1)/2 —— 這件事本身就是重點：
   *   兩種排序法在最壞情況下**一樣貴**，差別在平均與資料本來的樣子。
   * ⚠️ 所以這一段不要問「哪一種比較快」（沒有答案），
   *    要問「最壞情況一樣嗎」（一樣）。
   */
  function insWorst(n) { return n * (n - 1) / 2; }

  /**
   * 插入排序**最好情況**：資料本來就排好了，每張牌只要比 1 次。
   * ★ 這是兩種排序唯一真正的差別 ——
   *   選擇排序不管資料長什麼樣，都要比 n(n-1)/2 次。
   */
  function insBest(n) { return n - 1; }

  /** 循序搜尋最壞要比幾次 */
  function seqWorst(n) { return n; }

  /** 二元搜尋最壞要比幾次（每次砍一半，砍到空） */
  function binWorst(n) {
    var c = 0, left = n;
    while (left > 0) { left = Math.floor(left / 2); c++; }
    return c;
  }

  /**
   * 兩種策略的總成本。
   * @param n 資料量　@param k 要查幾次
   *   不排序：每次都用循序 → k × n
   *   先排序：排一次 + 每次用二元 → n(n-1)/2 + k × log2(n)
   */
  function costPlain(n, k) { return k * seqWorst(n); }
  function costSorted(n, k) { return selCompares(n) + k * binWorst(n); }

  /** 哪一種划算（'plain' / 'sorted' / 'same'） */
  function better(n, k) {
    var a = costPlain(n, k), b = costSorted(n, k);
    return a < b ? 'plain' : (b < a ? 'sorted' : 'same');
  }

  /**
   * 要查幾次以上，先排序才開始划算。
   * ⚠️ 用逐次試的，不用解不等式 —— 這裡的數字很小，而且
   *    寫成公式之後沒有人看得懂它在算什麼。
   */
  function breakEven(n) {
    for (var k = 1; k <= 100000; k++) if (better(n, k) === 'sorted') return k;
    return -1;
  }

  /* ⚠️ 資料量要和「排序大比拼」對齊（SORTLAB 的 10／100／600）——
     這一步是拿學生剛才量過的數字來算帳，
     數字對不上的話「你剛才量過」這句話就是假的。 */
  var SIZES = [10, 100, 600];

  /* ── 這一步只做一件事：結帳 ─────────────────────────
     ★★ 老師 2026-08-18：「這樣比起來，🎮 實作體驗的內容是不是太弱了？」
       —— 對，而且是我自己弄弱的。
       原本四段是：排序有多貴／兩種排序比一比／搜尋差幾倍／先排序划算嗎。
       在「動手試一次」被加厚（600 根長條的排序動畫、整排格子的搜尋動畫）之後，
       **前三段變成了實驗室的弱化重播**：
         · 排序有多貴（100 筆 4,950 次）→ 排序大比拼選 100 筆就是這個數字
         · 兩種排序比一比　　　　　　　→ 大比拼三種資料長相跑完就是這件事
         · 搜尋差幾倍　　　　　　　　　→ 搜尋大比拼＋賽跑動畫
       同一件事做兩遍，第二遍還比較不好看 —— 那不是複習，是拖時間。
     ★ 第四段才是這一章真正的結論，而且只有這裡有：
       「不是二元搜尋比較快，是**看你要查幾次**。」
     ⇒ 收斂成兩段：把數字擺在一起（回顧）→ 用那些數字算一筆帳（結帳）。
     ⚠️ 老師給的時間是「一節課的尾巴，5～10 分鐘」——
        所以回顧那一段**不問答**，只要求他把資料量切過才往下走。 */
  var STEPS = [
    { key: 'recap', icon: '📋', name: '把四關的數字擺在一起' },
    { key: 'plan',  icon: '🧾', name: '結帳：你要查幾次？' }
  ];

  /* 回顧那一段：至少要看過幾種資料量才算走過。
     ★ 只看 10 筆的話，45 對 9 —— 學生會覺得「好像也沒差多少」，
       而 600 筆是 179,700 對 599。那個跳法才是要他看的。 */
  var RECAP_NEED = 2;

  /* 結帳那一段：要親眼看到**兩邊各贏一次**才算走過。
     ⚠️ 只看到一邊贏的話，這一步的結論會被記成
        「先排序比較好」或「不要排比較好」—— 兩個都是錯的。 */
  var PLAN_NEED = ['plain', 'sorted'];

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.bc{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.bc-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.bc-tip b{color:#4338ca}',
    '.bc-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-step{font-size:12px;font-weight:900;padding:4px 11px;border-radius:9999px;',
    '  background:#e2e8f0;color:#475569}',
    '.bc-step.on{background:#6366f1;color:#fff}',
    '.bc-step.ok{background:#dcfce7;color:#166534}',
    /* 資料量的選擇 */
    '.bc-sizes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-sizes button{background:#fff;border:2px solid #cbd5e1;border-radius:11px;',
    '  padding:8px 16px;font-size:14px;font-weight:900;color:#475569;cursor:pointer;',
    '  font-family:inherit}',
    '.bc-sizes button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-sizes button.on{background:#6366f1;border-color:#6366f1;color:#fff}',
    /* 數字卡 */
    '.bc-nums{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:11px}',
    '.bc-num{flex:1;min-width:130px;background:#f8fafc;border:2px solid #e2e8f0;',
    '  border-radius:12px;padding:10px 13px}',
    '.bc-num .lb{display:block;font-size:11.5px;font-weight:900;color:#64748b}',
    '.bc-num .vl{display:block;font-size:24px;font-weight:900;color:#4338ca;line-height:1.2}',
    '.bc-num .sub{display:block;font-size:11px;color:#94a3b8;margin-top:2px}',
    '.bc-num.hot{border-color:#f59e0b;background:#fffbeb}',
    '.bc-num.hot .vl{color:#b45309}',
    '.bc-num.cool{border-color:#22c55e;background:#f0fdf4}',
    '.bc-num.cool .vl{color:#166534}',
    /* 長條圖：把倍數畫出來，數字看不出「幾倍」 */
    '.bc-bars{margin-bottom:11px}',
    '.bc-brow{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.bc-brow .nm{flex:0 0 82px;font-size:12px;font-weight:900;color:#475569}',
    '.bc-brow .track{flex:1;background:#f1f5f9;border-radius:6px;overflow:hidden;height:20px}',
    '.bc-brow .fill{height:100%;border-radius:6px;transition:width .5s ease-out}',
    '.bc-brow .vv{flex:0 0 auto;font-size:12px;font-weight:900;color:#334155;min-width:64px;text-align:right}',
    '.bc-ask{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;',
    '  padding:12px 14px;margin-bottom:10px;font-size:13.5px;line-height:1.9}',
    '.bc-ask .yn{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
    '.bc-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:9px 16px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.bc-btn:hover{background:#4f46e5}',
    '.bc-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.bc-in{width:110px;padding:8px 10px;border:2px solid #cbd5e1;border-radius:9px;',
    '  font-size:15px;font-weight:700;text-align:center;font-family:inherit}',
    '.bc-msg{font-size:13.5px;line-height:1.85;padding:10px 13px;border-radius:10px;margin-bottom:10px}',
    '.bc-msg.good{background:#dcfce7;color:#166534}',
    '.bc-msg.bad{background:#fee2e2;color:#991b1b}',
    '.bc-msg.info{background:#f1f5f9;color:#475569}',
    '.bc-done{background:#ecfdf5;border:2px solid #6ee7b7;border-radius:14px;',
    '  padding:14px 16px;font-size:14px;line-height:1.95;color:#065f46}',
    /* 「查幾次」的檔位 —— 結帳那一段真正在玩的東西 */
    '.bc-ks{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.bc-ks .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.bc-ks button{background:#fff;border:2px solid #cbd5e1;border-radius:9px;padding:7px 13px;',
    '  font-size:13.5px;font-weight:800;color:#334155;cursor:pointer;font-family:inherit}',
    '.bc-ks button:hover{border-color:#6366f1;background:#eef2ff}',
    '.bc-ks button.on{background:#6366f1;border-color:#6366f1;color:#fff}',
    /* ⚠️ 主要動作要自己佔一塊 —— 老師 2026-08-18 在排序那邊找不到播放鈕，
       原因就是主要動作只是一顆按鈕。這裡不要重蹈覆轍。 */
    '.bc-go{background:#eef2ff;border:2px dashed #c7d2fe;border-radius:14px;',
    '  padding:15px 14px;margin:13px 0;text-align:center}',
    '.bc-go button{padding:14px 26px;font-size:16px;font-weight:900;border-radius:11px;',
    '  box-shadow:0 3px 0 #3730a3}',
    '.bc-go button:active{transform:translateY(2px);box-shadow:0 1px 0 #3730a3}',
    '.bc-go .cap{font-size:12.5px;font-weight:700;color:#4338ca;line-height:1.8;margin-top:9px}',
    /* 還差什麼 —— 條件有幾項就有幾個勾 */
    '.bc-todo{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;',
    '  padding:9px 12px;margin-bottom:11px}',
    '.bc-todo .th{font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}',
    '.bc-todo ul{list-style:none;margin:0;padding:0}',
    '.bc-todo li{font-size:12.5px;line-height:1.9;color:#64748b}',
    '.bc-todo li.ok{color:#166534;font-weight:700}',
    '.bc-big .bc-tip{font-size:14.5px;padding:14px 17px}',
    '.bc-big .bc-num .vl{font-size:28px}',
    '.bc-big .bc-msg{font-size:14.5px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('bigcost-css')) return;
    var s = global.document.createElement('style');
    s.id = 'bigcost-css';
    s.textContent = CSS;
    global.document.head.appendChild(s);
  }

  function comma(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();

    var at = 0;                 // 第幾段
    var cleared = {};           // 過了哪幾段
    var n = 100;                // 目前選的資料量
    var msg = '', kind = 'info';
    var tries = 0;
    var seen = {};              // 回顧：看過哪幾種資料量
    seen[n] = true;
    var guess = null;           // 結帳：猜的損益兩平點（null＝還沒猜）
    var planK = null;           // 結帳：現在在算「查幾次」
    var won = {};               // 結帳：哪一邊已經贏過了（plain／sorted）

    function step() { return STEPS[at]; }
    function allDone() { return STEPS.every(function (s) { return cleared[s.key]; }); }

    function render() {
      host.className = 'bc' + (opts.big ? ' bc-big' : '');
      host.innerHTML =
        barHTML() +
        (allDone() ? doneHTML() : tipHTML() + todoHTML() + bodyHTML()) +
        (msg ? '<div class="bc-msg ' + kind + '">' + msg + '</div>' : '') +
        footHTML();
      wire();
    }

    function barHTML() {
      return '<div class="bc-bar">' + STEPS.map(function (s, i) {
        var cls = cleared[s.key] ? ' ok' : (i === at ? ' on' : '');
        return '<span class="bc-step' + cls + '">' +
               (cleared[s.key] ? '✔ ' : s.icon + ' ') + s.name + '</span>';
      }).join('') + '</div>';
    }

    function tipHTML() {
      var t = {
        recap: '前面四關的數字，你都自己量過了 —— 但<b>沒有擺在一起看過</b>。' +
               '<br>把資料量切過一輪，看它們各自怎麼長大。',
        plan: '⚠️ 二元搜尋<span class="hl">要先排好序</span> —— ' +
              '而排序那幾千次是<b>先付掉的</b>。' +
              '<br>所以真正的問題不是「哪一個比較快」，是 ' +
              '<span class="hl">你要查幾次？</span>'
      }[step().key];
      return '<div class="bc-tip">' + step().icon + ' <b>' + step().name + '</b>　' + t + '</div>';
    }

    /* ── 螢光筆（樣式在 shared/theme.css，這裡不要再寫一份）───── */
    function hl(t) { return '<span class="hl">' + t + '</span>'; }
    function hlb(t) { return '<span class="hl-b">' + t + '</span>'; }

    /* ⚠️ 「按這裡」要自己佔一塊 ——
       老師 2026-08-18 在排序那邊找不到播放鈕，就是因為主要動作只是一顆裸按鈕。 */
    function goBox(label, cap, action) {
      return '<div class="bc-go"><button class="bc-btn" data-a="' + action + '">' + label +
             '</button><div class="cap">' + cap + '</div></div>';
    }

    /* ── 還差什麼 ────────────────────────────────────
       ⚠️ 條件有幾項，畫面上就要有幾個勾（這是第四次寫這句話了）。 */
    function todoHTML() {
      var rows;
      if (step().key === 'recap') {
        rows = SIZES.map(function (v) {
          return '<li class="' + (seen[v] ? 'ok' : '') + '">' + (seen[v] ? '✅' : '⬜') +
                 ' 看過 ' + comma(v) + ' 筆的三個數字</li>';
        });
      } else {
        rows = [
          '<li class="' + (guess !== null ? 'ok' : '') + '">' + (guess !== null ? '✅' : '⬜') +
          ' 先猜一次：查幾次以上，先排序才划算</li>',
          '<li class="' + (won.plain ? 'ok' : '') + '">' + (won.plain ? '✅' : '⬜') +
          ' 看到一次<b>不排序比較省</b></li>',
          '<li class="' + (won.sorted ? 'ok' : '') + '">' + (won.sorted ? '✅' : '⬜') +
          ' 看到一次<b>先排序比較省</b></li>'
        ];
      }
      var done = rows.filter(function (r) { return r.indexOf('✅') >= 0; }).length;
      return '<div class="bc-todo"><div class="th">這一段要完成 ' + done + ' / ' + rows.length +
             '</div><ul>' + rows.join('') + '</ul></div>';
    }

    function sizesHTML() {
      return '<div class="bc-sizes">' + SIZES.map(function (v) {
        return '<button data-n="' + v + '" class="' + (v === n ? 'on' : '') + '">' +
               comma(v) + ' 筆</button>';
      }).join('') + '</div>';
    }

    /** 一列長條 */
    function bar(name, val, max, color) {
      var w = Math.max(1, Math.round(val / max * 100));
      return '<div class="bc-brow"><span class="nm">' + name + '</span>' +
        '<span class="track"><span class="fill" style="width:' + w + '%;background:' + color + '"></span></span>' +
        '<span class="vv">' + comma(val) + ' 次</span></div>';
    }

    function bodyHTML() {
      var k = step().key;

      /* ── ① 回顧：把四關的數字擺在一起 ────────────────
         ⚠️ 這一段**不問答**（老師給的時間是一節課的尾巴）——
            但也不能一鍵跳過：只看 10 筆的話 45 對 9，
            學生會覺得「好像也沒差多少」。⇒ 要求切過兩種資料量。 */
      if (k === 'recap') {
        var out = sizesHTML() +
          numsHTML([
            ['排好序（選擇排序）', comma(selCompares(n)), '次比較　← 第 6、7 關', 'hot'],
            ['循序搜尋（最壞）', comma(seqWorst(n)), '次比較　← 第 8 關', 'hot'],
            ['二元搜尋（最壞）', comma(binWorst(n)), '次比較　← 第 9 關', 'cool']
          ]) +
          '<div class="bc-ask">同樣 <b>' + comma(n) + '</b> 筆資料。' +
          '<br>搜尋那兩個差 ' + hlb(comma(Math.round(seqWorst(n) / binWorst(n))) + ' 倍') +
          '，可是<b>排序那一個比兩邊都大得多</b> —— ' +
          '而二元搜尋非得先排好不可。' +
          '<br><span style="font-size:12px;color:#94a3b8">' +
          '⚠️ 這三個數字你在「動手試一次」都量過，這裡只是擺在一起。</span></div>';
        var left = SIZES.filter(function (v) { return !seen[v]; });
        out += left.length
          ? '<div class="bc-msg info">還有 ' +
            left.map(function (v) { return comma(v) + ' 筆'; }).join('、') +
            ' 沒看過 —— 切過去看看那三個數字怎麼變。</div>'
          : goBox('🧾 開始結帳', '三種資料量都看過了。' +
              '現在用這些數字算一筆你沒算過的帳：<b>到底要不要先排序？</b>', 'recapdone');
        return out;
      }

      /* ── ② 結帳 ─────────────────────────────────────
         ★ 這一段是這一步唯一不重複實驗室的東西，所以做深：
           先猜損益兩平點 → 揭曉 → 自己拉「查幾次」看兩條長條交叉。 */
      if (k === 'plan') return planHTML();

      return '';
    }

    /* ── 結帳 ────────────────────────────────────────
       ★ 三段：① 先猜損益兩平點 ② 揭曉 ③ 自己拉「查幾次」看兩條長條交叉。
       ⚠️ 一定要讓他看到**兩邊各贏一次**。只看到一邊的話，
          這一步會被記成「先排序比較好」或「不要排比較好」—— 兩個都是錯的。 */
    function planHTML() {
      var be = breakEven(n);
      var out = sizesHTML();

      if (guess === null) {
        /* ⚠️ 不給選項 —— 選項會把答案的量級洩漏出去（和搜尋那邊同一個做法）。 */
        return out +
          '<div class="bc-ask">' +
          '這批 <b>' + comma(n) + '</b> 筆資料：<br>' +
          '· 不排序，每次都循序找 —— 一次 ' + comma(seqWorst(n)) + ' 次<br>' +
          '· 先排序（' + comma(selCompares(n)) + ' 次），之後每次二元找 —— 一次 ' +
          binWorst(n) + ' 次<br><br>' +
          '<b>要查幾次以上，「先排序」才開始划算？</b>' +
          '<br><span style="font-size:12px">💡 先猜一個數字 —— 猜錯沒關係，這一題就是要你猜。</span>' +
          '<div class="yn"><input class="bc-in" id="bc-g" type="number" min="1" placeholder="查幾次">' +
          '<button class="bc-btn" data-a="guess">送出</button></div></div>';
      }

      var kk = planK === null ? 1 : planK;
      var side = better(n, kk);
      var mx = Math.max(costPlain(n, kk), costSorted(n, kk));
      /* 「查幾次」的幾個檔位：1 次、剛好在分界點兩側、以及遠遠超過。
         ★ 分界點兩側各給一個 —— 那一格差一次就換邊，最有感。 */
      var KS = [1, Math.max(1, be - 1), be, be * 2, be * 10];
      out += '<div class="bc-ks"><span class="lb">你要查幾次</span>' +
        KS.map(function (v) {
          return '<button data-k="' + v + '"' + (v === kk ? ' class="on"' : '') + '>' +
                 comma(v) + ' 次</button>';
        }).join('') + '</div>' +
        '<div class="bc-bars">' +
          bar('不排序，每次循序找', costPlain(n, kk), mx, '#f59e0b') +
          bar('先排序，之後二元找', costSorted(n, kk), mx, '#22c55e') +
        '</div>' +
        '<div class="bc-ask">查 <b>' + comma(kk) + '</b> 次的話：' +
        '<br>· 不排序＝' + comma(seqWorst(n)) + ' × ' + comma(kk) + ' ＝ ' +
        hlb(comma(costPlain(n, kk))) + ' 次' +
        '<br>· 先排序＝' + comma(selCompares(n)) + ' ＋ ' + binWorst(n) + ' × ' + comma(kk) +
        ' ＝ ' + hlb(comma(costSorted(n, kk))) + ' 次' +
        '<br>⇒ ' + (side === 'same'
          ? hl('剛好一樣 —— 這就是分界點')
          : hl(side === 'plain' ? '不排序比較省' : '先排序比較省')) + '。</div>';
      return out;
    }

    function numsHTML(rows) {
      return '<div class="bc-nums">' + rows.map(function (r) {
        return '<div class="bc-num ' + (r[3] || '') + '"><span class="lb">' + r[0] + '</span>' +
               '<span class="vl">' + r[1] + '</span><span class="sub">' + r[2] + '</span></div>';
      }).join('') + '</div>';
    }

    /* ⚠️ 結論這一塊是整個第 6 章的收尾 —— 螢光筆就該畫在這裡。
       ★ 只畫兩處：那句「看你要查幾次」，和它的前提「資料要先排好」。
          數字用藍筆。畫太多的話，這一段又會變成一片黃。 */
    function doneHTML() {
      var be = breakEven(n);
      return '<div class="bc-done">' +
        '🎉 <b>結完帳了。</b>' +
        '<br>這一章的結論<b>不是</b>「二元搜尋比較快」——' +
        '<br>而是 ' + hl('看你要查幾次') + '：' +
        '<br>· 只查一兩次 → <b>不必排序</b>，直接循序找比較省' +
        '<br>· 要查很多次 → <b>先排序划算</b>（' + comma(n) + ' 筆的話，查 ' +
        hlb(comma(be)) + ' 次以上就值得了）' +
        '<br>⚠️ 課本說「二元搜尋比較快」是有前提的：' + hl('資料要先排好') + '。' +
        '那個排序的成本，就是第 6、7 關你排過的那件事。' +
        '</div>';
    }

    function footHTML() {
      if (allDone()) return '<div class="bc-bar"><button class="bc-btn" data-a="finish">完成，回闖關地圖 →</button></div>';
      if (cleared[step().key]) return '<div class="bc-bar"><button class="bc-btn" data-a="next">下一段 →</button></div>';
      return '';
    }

    function wire() {
      [].forEach.call(host.querySelectorAll('[data-n]'), function (el) {
        el.onclick = function () {
          n = Number(el.dataset.n);
          seen[n] = true;
          /* ⚠️ 換資料量就要重來 —— 不然學生用 10 筆過關，
             卻沒看到 600 筆才會出現的那個差距。
             ⚠️ 損益兩平點也跟著資料量跑（10 筆是 8 次、600 筆是 3,004 次），
                猜過的答案不能算數。 */
          cleared[step().key] = false;
          if (step().key === 'plan') { guess = null; planK = null; won = {}; }
          tries = 0; msg = ''; kind = 'info';
          render();
        };
      });
      /* 「查幾次」的檔位 —— 這是結帳那一段真正在玩的東西 */
      [].forEach.call(host.querySelectorAll('[data-k]'), function (el) {
        el.onclick = function () {
          planK = Number(el.dataset.k);
          var side = better(n, planK);
          /* ⚠️ 'same'（剛好在分界點）兩邊都不算贏 ——
             那一格是「一樣」，把它算成任一邊都會讓結論變成半個。 */
          if (side === 'plain' || side === 'sorted') won[side] = true;
          if (won.plain && won.sorted && !cleared.plan) {
            cleared.plan = true;
            say('good', '兩邊你都看到了 —— ' +
                hl('同一批資料、同樣兩種做法，答案卻不一樣') +
                '。<br>差別只在<b>你要查幾次</b>。');
            return;
          }
          msg = ''; render();
        };
      });
      [].forEach.call(host.querySelectorAll('[data-a]'), function (el) {
        el.onclick = function () { act(el.dataset.a); };
      });
    }

    function say(k2, m) { kind = k2; msg = m; render(); }

    function act(a) {
      if (a === 'next') {
        at = Math.min(at + 1, STEPS.length - 1);
        tries = 0; msg = ''; kind = 'info'; planK = null;
        render(); return;
      }
      if (a === 'finish') { if (opts.onPass) opts.onPass(); return; }

      var key = step().key;

      if (key === 'recap' && a === 'recapdone') {
        cleared.recap = true;
        say('good', '好 —— 數字都在手上了。' +
            '<br>接下來這一題，前面四關都沒問過你。');
        return;
      }

      /* ── 結帳：先猜損益兩平點 ───────────────────────── */
      if (key === 'plan' && a === 'guess') {
        var v = num('#bc-g');
        if (v === null) return;
        var be = breakEven(n);
        guess = v;
        planK = 1;                        // 揭曉後從「查 1 次」開始自己拉
        won = {};
        var off = v > be ? Math.round(v / be) : 0;
        say('good',
            '答案是 ' + hl('查 ' + comma(be) + ' 次以上') + '（' + comma(n) + ' 筆的話）。' +
            '（你猜 ' + comma(v) + ' 次）' +
            (off >= 10 ? '<br>差得有點多 —— 排序那筆帳比想像中好還。' : '') +
            '<br>★ 現在自己拉拉看「要查幾次」，' +
            '把<b>兩邊各贏一次</b>的畫面都找出來。');
        return;
      }

      return;
    }

    function num(sel) {
      var el = host.querySelector(sel);
      var v = Number(el && el.value);
      if (!(v > 0)) { say('info', '先填一個數字。'); return null; }
      return v;
    }

    render();

    return {
      destroy: function () { host.innerHTML = ''; },
      _s: function () {
        return { at: at, cleared: cleared, n: n, planK: planK, done: allDone(),
                 /* 測試要看得到這三個：猜過沒、看過哪幾種資料量、哪一邊贏過 */
                 guess: guess, seen: seen, won: won };
      }
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅）。 */
  function goal() {
    return {
      /* ⚠️ 這一步**不要**再講一次「排序有多貴、搜尋差幾倍」——
         那兩件事「動手試一次」已經用動畫做過了（老師 2026-08-18：
         「比起來，實作體驗的內容是不是太弱了？」）。
         ★ 這裡只做一件他沒做過的事：把那些數字加起來，算一筆帳。 */
      why: '前面你量到的都是<b>單一一件事</b>的成本：排序要比幾次、搜尋要比幾次。' +
           '<br>但真正要決定的是 —— <b>「這批資料，我到底要不要先排序？」</b>' +
           '<br>⚠️ 二元搜尋<span class="hl">要先排好序</span>，' +
           '而排序那幾千次是<b>先付掉的</b>。這一步就是把那筆帳算出來。' +
           /* ⚠️ 這一句一定要留著：課本那句「二元搜尋比較快」如果不先擋，
              學生會把整章記成那五個字，而排序的成本就被當成免費的。 */
           '<br>⚠️ 所以結論<b>不是</b>「二元搜尋比較快」—— 那句話是有前提的。',
      pass: '① 三種資料量的數字都看過；<br>' +
            '② <b>先猜</b>一次「查幾次以上先排序才划算」；<br>' +
            '③ 自己拉「查幾次」，把<b>不排序比較省</b>和<b>先排序比較省</b>' +
            '兩種畫面<b>都找出來</b>。'
    };
  }

  global.BIGCOST = {
    VERSION: VERSION,
    mount: mount,
    goal: goal,
    selCompares: selCompares,
    insWorst: insWorst,
    insBest: insBest,
    seqWorst: seqWorst,
    binWorst: binWorst,
    costPlain: costPlain,
    costSorted: costSorted,
    better: better,
    breakEven: breakEven,
    SIZES: SIZES,
    STEPS: STEPS
  };
})(typeof window !== 'undefined' ? window : this);
