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
    /* ── 回顧那三條橫條（老師 2026-08-18：「調整為更有可讀性」）──
       ⚠️ 前一版是三張並排的數字卡，4,950／100／7 **字級一樣大** ——
          而這一段唯一要傳達的就是「排序遠比搜尋貴」。
          三個一樣大的數字，正好把那件事藏起來。
       ⇒ 按比例的橫條：排序那一條滿出去，另外兩條擠在最左邊。 */
    '.bc-lines{background:#fff;border:2px solid #e2e8f0;border-radius:14px;',
    '  padding:12px 14px;margin-bottom:11px}',
    '.bc-lines .hd{font-size:13px;font-weight:900;color:#334155;margin-bottom:10px;',
    '  padding-bottom:7px;border-bottom:1px dashed #e2e8f0}',
    '.bc-line{margin-bottom:11px}',
    '.bc-line:last-child{margin-bottom:0}',
    '.bc-line .lh{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:12.5px;margin-bottom:3px}',
    '.bc-line .nm{font-weight:900;color:#334155}',
    '.bc-line .src{font-size:11px;font-weight:800;color:#6366f1;',
    '  background:#eef2ff;border-radius:9999px;padding:1px 8px}',
    '.bc-line .lb2{display:flex;align-items:center;gap:9px}',
    '.bc-line .track{flex:1;background:#f1f5f9;border-radius:7px;overflow:hidden;height:22px}',
    '.bc-line .fill{display:block;height:100%;border-radius:7px;transition:width .45s ease-out}',
    '.bc-line .vv{flex:0 0 auto;min-width:74px;text-align:right;font-size:17px;',
    '  font-weight:900;color:#334155;font-family:ui-monospace,monospace}',
    '.bc-line .nt{font-size:11.5px;color:#94a3b8;line-height:1.6;margin-top:2px}',
    /* 「和上一個資料量比」—— 切過去卻沒東西告訴他變多少，等於白切 */
    '.bc-grow{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;',
    '  padding:11px 13px;margin-bottom:11px;font-size:13px;line-height:1.95;color:#7c2d12;',
    '  font-family:ui-monospace,"Noto Sans TC",monospace}',
    '.bc-grow b{color:#92400e}',
    '.bc-big .bc-line .vv{font-size:20px}',
    /* ── 兩張收據（老師 2026-08-18：「公式也不太好理解」）──────
       ★ 把 4,950 ＋ 7 × 100 拆成看得懂的兩行：
         排序費（只付一次）／查詢費（每查一次加一筆）。
       ⚠️ 兩張要**並排**，不是上下 —— 上下排的話沒辦法一眼比大小，
          而「哪一張比較便宜」正是這一段唯一要看的事。
       ⚠️ 手機上放不下兩欄 → 自動變成上下，但總計那一行加粗留住對比。 */
    '.bc-bills{display:flex;gap:10px;margin-bottom:11px;flex-wrap:wrap}',
    '.bc-bill{flex:1;min-width:190px;background:#fff;border:2px solid #e2e8f0;',
    '  border-radius:14px;padding:11px 13px}',
    '.bc-bill.win{border-color:#22c55e;background:#f0fdf4;box-shadow:0 2px 10px rgba(34,197,94,.18)}',
    '.bc-bill .bh{font-size:13px;font-weight:900;color:#334155;margin-bottom:8px;',
    '  padding-bottom:6px;border-bottom:1px dashed #e2e8f0}',
    '.bc-bill .br{display:flex;justify-content:space-between;align-items:baseline;',
    '  font-size:13px;color:#475569;font-weight:700}',
    '.bc-bill .br span:last-child{font-family:ui-monospace,monospace;font-size:14.5px;',
    '  font-weight:900;color:#334155}',
    /* 每一筆下面那一行小字：講「這筆錢是怎麼來的」 */
    '.bc-bill .bn{font-size:11px;color:#94a3b8;margin:1px 0 7px;line-height:1.6}',
    '.bc-bill .br.tot{border-top:2px solid #cbd5e1;margin-top:4px;padding-top:7px;font-size:14px}',
    '.bc-bill .br.tot span:last-child{font-size:19px;color:#4338ca}',
    '.bc-bill.win .br.tot span:last-child{color:#166534}',
    '.bc-bill .bw{font-size:12.5px;font-weight:900;color:#166534;text-align:right;',
    '  margin-top:4px;min-height:19px}',
    /* ── 目標橫幅（老師 2026-08-18：「太開放式了，感覺會亂按」）──
       ★ 「還差幾次」要現算 —— 有數字在跳，學生才知道自己在往哪裡走。 */
    '.bc-goal{display:flex;justify-content:space-between;align-items:center;gap:10px;',
    '  background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;',
    '  padding:10px 14px;margin-bottom:11px;font-size:13.5px;color:#3730a3;',
    '  flex-wrap:wrap}',
    '.bc-goal b{color:#4338ca}',
    '.bc-goal .left{font-size:13px;font-weight:900;background:#fff;border-radius:9999px;',
    '  padding:4px 12px;white-space:nowrap}',
    '.bc-goal .left b{font-size:17px;color:#4338ca}',
    '.bc-goal.done{background:#ecfdf5;border-color:#6ee7b7;color:#065f46}',
    '.bc-goal.done b{color:#166534}',
    /* 建議按哪一顆 —— 只是加亮，不鎖住其他顆 */
    '.bc-kbar button.hint{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.28)}',
    '.bc-kbar button.hint:hover{background:#d97706}',
    /* 資料量：看過的打勾、還沒看的標出來（同一個道理） */
    '.bc-sizes button.ok{border-color:#86efac;background:#f0fdf4;color:#166534}',
    '.bc-sizes button.todo{border-color:#f59e0b;background:#fffbeb;color:#92400e}',
    '.bc-sizes button .tag{font-size:10px;font-weight:900;margin-left:5px;',
    '  background:#fde68a;color:#92400e;border-radius:9999px;padding:1px 6px}',
    '.bc-sizes button.on .tag{background:#fff;color:#4338ca}',
    /* 「＋ 再查幾次」那一排 */
    '.bc-kbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:11px}',
    '.bc-kbar .lb{font-size:13px;font-weight:800;color:#334155;margin-right:2px}',
    '.bc-kbar .lb b{color:#4338ca;font-size:16px}',
    '.bc-kbar button{background:#4f46e5;color:#fff;border:0;border-radius:9px;',
    '  padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}',
    '.bc-kbar button:hover{background:#4338ca}',
    '.bc-kbar button.ghost{background:#fff;border:2px solid #cbd5e1;color:#64748b;',
    '  font-weight:700}',
    '.bc-big .bc-bill .br.tot span:last-child{font-size:22px}',
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
    /* 「換邊了」那句話只講一次 —— 每按一下都跳同一句的話，
       學生會停止讀它，而那句正是這一段的結論。 */
    var msgShownFlip = false;

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
        /* ★ 順序就是流程：先按到兩邊各贏一次，最後才回答分界點。
           ⚠️ 清單的順序要和畫面上的順序一樣 ——
              不一樣的話學生會照清單去找，但畫面上還沒出現那一題。 */
        rows = [
          '<li class="' + (won.plain ? 'ok' : '') + '">' + (won.plain ? '✅' : '⬜') +
          ' 看到一次<b>不排序比較省</b>（查很少次的時候）</li>',
          '<li class="' + (won.sorted ? 'ok' : '') + '">' + (won.sorted ? '✅' : '⬜') +
          ' 看到一次<b>先排序比較省</b>（按「＋」把次數加上去）</li>',
          '<li class="' + (guess !== null ? 'ok' : '') + '">' + (guess !== null ? '✅' : '⬜') +
          ' 最後一題：分界點大概在哪裡' +
          (won.plain && won.sorted ? '' : '<span>（兩邊都看過才會出現）</span>') + '</li>'
        ];
      }
      var done = rows.filter(function (r) { return r.indexOf('✅') >= 0; }).length;
      return '<div class="bc-todo"><div class="th">這一段要完成 ' + done + ' / ' + rows.length +
             '</div><ul>' + rows.join('') + '</ul></div>';
    }

    /* ⚠️ 老師 2026-08-18：「兩個階段目前太開放式了，感覺會亂按，
       是不是有個目標式的按鍵引導。」
       ★ 三顆一樣的按鈕不會告訴學生「下一顆該按哪一顆」——
         看過的打勾、還沒看的加提示，路就只剩一條。 */
    function sizesHTML() {
      return '<div class="bc-sizes">' + SIZES.map(function (v) {
        var now = (v === n), done = !!seen[v];
        var cls = now ? 'on' : (done ? 'ok' : 'todo');
        return '<button data-n="' + v + '" class="' + cls + '">' +
               (done && !now ? '✓ ' : '') + comma(v) + ' 筆' +
               (!done ? '<span class="tag">還沒看</span>' : '') + '</button>';
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
      if (k === 'recap') return recapHTML();

      /* ── ② 結帳 ─────────────────────────────────────
         ★ 兩張收據，一次加一筆。
           ⚠️ 「先猜分界點」那一題搬到**最後**（老師 2026-08-18 選的）——
              先按到自己看見換邊，才有東西可以猜。 */
      if (k === 'plan') {
        return planHTML() + (won.plain && won.sorted ? guessHTML() : '');
      }

      return '';
    }

    /* ── 回顧：三條橫條 ────────────────────────────────
       ★★ 老師 2026-08-18：「📋 把四關的數字擺在一起，這個部份也調整為更有可讀性。」
       ⚠️ 前一版是三張並排的數字卡：4,950 / 100 / 7 三個數字**字級一樣大**，
          可是這一段唯一要傳達的就是「排序遠比搜尋貴」——
          而那件事在三張一樣大的卡片上完全看不出來。
          （這和搜尋那邊「進度條看不出量級」是同一個毛病。）
       ⇒ 改成三條**按比例**的橫條：排序那一條長到滿出來，另外兩條幾乎看不見。
       ★★ 而且補上這一段本來缺的東西：**切資料量時「變了多少」**。
          原本切過去只是數字換了，沒有任何東西告訴他差多少 ——
          而「排序漲 36 倍、二元只多 3 次」正是要他看的。 */
    function recapHTML() {
      var sortN = selCompares(n), seqN = seqWorst(n), binN = binWorst(n);
      var mx = Math.max(sortN, seqN, binN);
      var row = function (icon, name, from, val, color, note) {
        /* ⚠️ 最小寬度給 1.2% —— 二元搜尋只有 7 次，
           照比例算出來是 0.14%，畫出來會是一條看不見的線，
           學生會以為那一項「沒有資料」。 */
        var w = Math.max(1.2, val / mx * 100);
        return '<div class="bc-line">' +
          '<div class="lh"><span class="nm">' + icon + ' ' + name + '</span>' +
          '<span class="src">' + from + '</span></div>' +
          '<div class="lb2"><span class="track"><span class="fill" style="width:' + w +
          '%;background:' + color + '"></span></span>' +
          '<span class="vv">' + comma(val) + '</span></div>' +
          '<div class="nt">' + note + '</div></div>';
      };
      var out = sizesHTML() +
        '<div class="bc-lines"><div class="hd">同樣 <b>' + comma(n) +
        '</b> 筆資料，要比幾次？</div>' +
        row('🔢', '排好序（選擇排序）', '第 6、7 關', sortN, '#f59e0b',
            '排一次的成本 —— 但排完之後就不用再排') +
        row('🚶', '循序搜尋（最壞）', '第 8 關', seqN, '#0ea5e9',
            '每查一次都要付這麼多') +
        row('✂️', '二元搜尋（最壞）', '第 9 關', binN, '#22c55e',
            '每查一次只要這麼多 —— 但資料得先排好') +
        '</div>' +
        '<div class="bc-ask">⚠️ ' + hl('排序那一條長到看不完') +
        '，另外兩條擠在最左邊。' +
        /* ⚠️ 兩條搜尋被壓到看不出差別 —— 600 筆時 600 對 10 也還是兩條短線。
           ★ 不要為了「畫得出來」去動比例尺（那會讓排序那條的震撼消失）；
             改成**把被壓掉的那個差距用字講出來**。
             這一段要傳達的是「排序 ≫ 搜尋」，而不是「循序 ≈ 二元」。 */
        '<br>（那兩條其實差 ' + hlb(comma(Math.round(seqN / binN)) + ' 倍') +
        '，只是和排序比起來都太短了 —— <b>那正是重點</b>。）' +
        '<br>可是<b>二元搜尋非得先排好不可</b> —— ' +
        '那條最長的，就是它的入場費。' +
        '<br><span style="font-size:12px;color:#94a3b8">' +
        '這三個數字你在「動手試一次」都量過，這裡只是擺在一起。</span></div>';

      /* ★★ 切了資料量就要看得到「變了多少」——
         這一段的重點不是三個數字，是它們**長大的速度不一樣**。 */
      out += growHTML();

      var left = SIZES.filter(function (v) { return !seen[v]; });
      out += left.length
        ? '<div class="bc-msg info">還有 ' +
          left.map(function (v) { return comma(v) + ' 筆'; }).join('、') +
          ' 沒看過 —— 切過去，看那三條長度怎麼變。</div>'
        : goBox('🧾 開始結帳', '三種資料量都看過了。' +
            '現在用這些數字算一筆你沒算過的帳：<b>到底要不要先排序？</b>', 'recapdone');
      return out;
    }

    /** 和**前一個**資料量比：誰長得快、誰幾乎不動 */
    function growHTML() {
      var i = SIZES.indexOf(n);
      if (i <= 0 || !seen[SIZES[i - 1]]) return '';
      var pv = SIZES[i - 1];
      var f = function (a, b) {
        var r = b / a;
        return r >= 2 ? ('<b>' + comma(Math.round(r)) + ' 倍</b>')
                      : ('只多 <b>' + comma(b - a) + '</b> 次');
      };
      return '<div class="bc-grow">📈 從 <b>' + comma(pv) + '</b> 筆變成 <b>' +
        comma(n) + '</b> 筆（' + comma(Math.round(n / pv)) + ' 倍）：' +
        '<br>· 排序　　' + comma(selCompares(pv)) + ' → ' + comma(selCompares(n)) +
        '　' + hl(f(selCompares(pv), selCompares(n))) +
        '<br>· 循序搜尋 ' + comma(seqWorst(pv)) + ' → ' + comma(seqWorst(n)) +
        '　' + f(seqWorst(pv), seqWorst(n)) +
        '<br>· 二元搜尋 ' + binWorst(pv) + ' → ' + binWorst(n) +
        '　' + hl(f(binWorst(pv), binWorst(n))) + '</div>';
    }

    /* ── 結帳：兩張收據 ────────────────────────────────
       ★★ 老師 2026-08-18：「🧾 結帳還是不太會操作，總覺得流程不太順手，
         公式也不太好理解，操作後還是不太理解。」
       ⚠️ 前一版壞在**開場**和**呈現**兩件事：
         ① 一進來就要他猜「查幾次以上先排序才划算」——
            那是兩條直線的交點。國中生手上沒有任何可以依靠的直覺，
            只能亂填一個數字，然後被告知答案。猜不出來的猜測沒有教學功能。
         ② 畫面上是「4,950 ＋ 7 × 100 ＝ 5,650」這種算式。
            那是**結果**的寫法，不是**過程**的寫法 ——
            學生看不出 4,950 為什麼只出現一次、7 為什麼要乘。
       ⇒ 改成兩張並排的收據，一次加一筆：
           排序費　只在「先排序」那一張出現，而且**只付一次**
           查詢費　每查一次就往上加一筆
         按「＋ 再查一次」兩張的總計各自往上跳，換邊的那一刻標出來。
       ★ 沒有乘法算式 —— 只有一直加上去的數字。
         「排序費只付一次、查詢費每次都要付」這件事，用收據看一眼就懂。 */
    function planHTML() {
      var kk = planK || 1;
      var sortFee = selCompares(n);          // 排序費：只付一次
      var perPlain = seqWorst(n);            // 不排序：每查一次的價錢
      var perSorted = binWorst(n);           // 先排序：每查一次的價錢
      var totPlain = costPlain(n, kk);
      var totSorted = costSorted(n, kk);
      var side = better(n, kk);

      var bill = function (cls, name, fee, per, tot, win) {
        return '<div class="bc-bill ' + cls + (win ? ' win' : '') + '">' +
          '<div class="bh">' + name + '</div>' +
          '<div class="br"><span>排序費</span><span>' +
            (fee ? comma(fee) : '0') + '</span></div>' +
          '<div class="bn">' + (fee ? '只付一次' : '不用排序') + '</div>' +
          '<div class="br"><span>查詢費</span><span>' + comma(per * kk) + '</span></div>' +
          '<div class="bn">一次 ' + comma(per) + ' × ' + comma(kk) + ' 次</div>' +
          '<div class="br tot"><span>總計</span><span>' + comma(tot) + '</span></div>' +
          '<div class="bw">' + (win ? '✅ 比較便宜' : '　') + '</div></div>';
      };

      /* ⚠️ 加幾次的按鈕要跨好幾個量級 —— 只有 ＋1 的話，
         100 筆要按五十幾下才看得到換邊，那不是體驗是懲罰。
         ★ 三種資料量的分界點分別是 8／54／305，
           所以 ＋100 按三下之內一定看得到換邊。
         ⚠️ 哪天資料量加大（分界點跑到上千），這裡要再加一格 ——
            不然學生又會落到「按到煩」那一邊。 */
      var STEPS_K = [1, 10, 100];

      /* ── 目標橫幅（老師 2026-08-18：「太開放式了，感覺會亂按，
           是不是有個目標式的按鍵引導」）─────────────────────
         ⚠️ 前一版畫面上只有三顆「＋」和兩張收據 ——
            學生不知道要按到什麼時候，也不知道按下去要看什麼，
            那就只能亂按。
         ★ 給一個**看得到終點的目標**：讓「先排序」那一張變便宜。
           而且把「還差幾次」現算出來 —— 有數字在跳，就不是亂按。
         ⚠️ 不要直接把分界點寫出來（那是最後一題的答案）——
            只講「還差幾次」，他自己按到 0 的時候就知道答案了。 */
      var be = breakEven(n);
      var left = Math.max(0, be - kk);
      var goalBar = won.sorted
        ? '<div class="bc-goal done">🎯 目標達成！你已經看過<b>兩邊各贏一次</b> —— ' +
          '下面最後一題就是問這個。</div>'
        : '<div class="bc-goal">🎯 <b>目標：讓「先排序」那一張變便宜</b>' +
          '<span class="left">還差 <b>' + comma(left) + '</b> 次</span></div>';

      /* ★ 建議按哪一顆：還差很多就推 ＋100，快到了就推 ＋1。
         ⚠️ 只是**加亮**，不是鎖住其他顆 —— 自己亂按也要能玩。 */
      var pick = left >= 100 ? 100 : (left >= 10 ? 10 : 1);

      return sizesHTML() + goalBar +
        '<div class="bc-kbar"><span class="lb">你要查 <b>' + comma(kk) + '</b> 次</span>' +
        STEPS_K.map(function (v) {
          var hint = (!won.sorted && v === pick);
          return '<button data-add="' + v + '"' + (hint ? ' class="hint"' : '') + '>' +
                 (hint ? '👉 ' : '') + '＋' + comma(v) + ' 次</button>';
        }).join('') +
        '<button data-add="reset" class="ghost">↺ 回到 1 次</button></div>' +
        '<div class="bc-bills">' +
          bill('plain', '🚶 不排序，每次循序找', 0, perPlain, totPlain, side === 'plain') +
          bill('sorted', '📚 先排序，之後二元找', sortFee, perSorted, totSorted, side === 'sorted') +
        '</div>' +
        '<div class="bc-ask">' + planSay(kk, side, totPlain, totSorted) + '</div>';
    }

    /** 收據下面那一句話 —— 講**剛剛發生了什麼**，不是講公式 */
    function planSay(kk, side, tp, ts) {
      if (side === 'same') {
        return '查 <b>' + comma(kk) + '</b> 次的話，兩邊' + hl('剛好一樣貴') +
               ' —— 這就是分界點。再多查一次，先排序就開始划算了。';
      }
      if (side === 'plain') {
        return '查 <b>' + comma(kk) + '</b> 次：' + hl('不排序比較省') +
               '（' + hlb(comma(tp)) + ' 對 ' + hlb(comma(ts)) + '）。' +
               '<br>⚠️ 因為那筆<b>排序費</b>還沒被攤平 —— 查太少次，先付的錢划不來。' +
               '<br>👉 按上面的「＋」再多查幾次看看。';
      }
      return '查 <b>' + comma(kk) + '</b> 次：' + hl('先排序比較省') +
             '（' + hlb(comma(ts)) + ' 對 ' + hlb(comma(tp)) + '）。' +
             '<br>★ 排序費只付了一次，但它幫你把<b>每一次</b>的查詢費從 ' +
             comma(seqWorst(n)) + ' 降到 ' + binWorst(n) + ' —— 查愈多次賺愈多。';
    }

    /* ── 最後才問分界點 ──────────────────────────────
       ★ 老師 2026-08-18 選的：「拿掉，改成最後才問」——
         先讓他按到自己看見換邊，再問「那分界點大概在哪裡？」。
       ⚠️ 有過經驗才猜得出來。一開場就問，他只能亂填一個數字。 */
    function guessHTML() {
      var be = breakEven(n);
      return '<div class="bc-ask"><b>最後一題：</b>' +
        '你剛才看到兩邊換邊了。' +
        '這批 <b>' + comma(n) + '</b> 筆資料，' +
        '<b>查幾次以上</b>，先排序才開始划算？' +
        '<br><span style="font-size:12px">💡 用「＋」把次數調到剛好換邊的那一格，就看得出來。' +
        '答案在 ' + comma(Math.max(1, be - 20)) + ' ～ ' + comma(be + 20) + ' 之間都算對。</span>' +
        '<div class="yn"><input class="bc-in" id="bc-g" type="number" min="1" placeholder="查幾次">' +
        '<button class="bc-btn" data-a="guess">送出</button></div></div>';
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
      /* ⚠️⚠️ 老師 2026-08-18：「實作體驗結束後，為什麼是『完成，回闖關地圖』？
         不是應該進入 🏁 期末檢核？」
         —— 行為是對的（關卡頁會 advance 到期末檢核），**字是錯的**。
         ★ 這種錯最傷：學生照著字判斷「這一關結束了」，
           按下去卻跳到一個他以為不存在的步驟；
           或者更糟 —— 他以為按了會離開，所以不敢按。
         ⇒ 按鈕的字由呼叫端決定（它才知道後面還有沒有東西）。 */
      if (allDone()) {
        return '<div class="bc-bar"><button class="bc-btn" data-a="finish">' +
               (opts.nextLabel || '完成，回闖關地圖 →') + '</button></div>';
      }
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
          if (step().key === 'plan') { guess = null; planK = 1; won = {}; msgShownFlip = false; }
          tries = 0; msg = ''; kind = 'info';
          render();
        };
      });
      /* 「＋ 再查幾次」—— 這是結帳那一段真正在玩的東西 */
      [].forEach.call(host.querySelectorAll('[data-add]'), function (el) {
        el.onclick = function () { act('add:' + el.dataset.add); };
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

      /* ── 結帳：加次數 ──────────────────────────────
         ★ 一次加一筆 —— 沒有公式，只有一直加上去的數字。 */
      if (key === 'plan' && a && a.indexOf('add:') === 0) {
        var d = a.slice(4);
        planK = (d === 'reset') ? 1 : (planK || 1) + Number(d);
        var side = better(n, planK);
        if (side === 'plain' || side === 'sorted') won[side] = true;
        if (won.plain && won.sorted && !msgShownFlip) {
          msgShownFlip = true;
          say('good', '看到了嗎？' + hl('同一批資料、同樣兩種做法，答案換邊了') +
                      '。<br>差別只在<b>你要查幾次</b> —— 下面最後一題就是問這個。');
          return;
        }
        msg = ''; render(); return;
      }

      /* ── 結帳的最後一題：分界點 ─────────────────────
         ⚠️ 這一題**猜錯也不擋** —— 它要的是他先給一個數字，
            而且答案給一個區間（±20），不是要他算到剛好那一格。 */
      if (key === 'plan' && a === 'guess') {
        var v = num('#bc-g');
        if (v === null) return;
        var be = breakEven(n);
        guess = v;
        var near = Math.abs(v - be) <= 20;
        cleared.plan = true;
        say('good',
            (near ? '對了 —— ' : '答案是 ') + hl('查 ' + comma(be) + ' 次以上') +
            '（' + comma(n) + ' 筆的話）。' + (near ? '' : '（你猜 ' + comma(v) + ' 次）') +
            '<br>★ 在那之前，排序費還沒被攤平；在那之後，' +
            '每多查一次都在賺 ' + comma(seqWorst(n) - binWorst(n)) + ' 次。');
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
      /* ⚠️ 過關標準的順序要和畫面上的順序一樣（老師 2026-08-18 反映流程不順）——
         不一樣的話學生會照著標準去找，但畫面上那一題還沒出現。 */
      pass: '① 三種資料量的數字都看過；<br>' +
            '② 按「<b>＋ 再查幾次</b>」，把<b>不排序比較省</b>和' +
            '<b>先排序比較省</b>兩種畫面<b>都找出來</b>；<br>' +
            '③ 最後回答：<b>查幾次以上</b>先排序才划算（答在附近就算對）。'
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
