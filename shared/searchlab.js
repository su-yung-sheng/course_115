/* =====================================================================
   搜尋實驗室（第 8～10 關共用一份）
   ---------------------------------------------------------------------
   ★ 為什麼是「操作」不是「拼圖」
     第 4 章那四關學的是「怎麼寫」，主角是程式拼圖。
     第 6 章這幾關學的是「這個演算法在做什麼」——
     把循序搜尋做成一支要拼的 Scratch 程式，學生會忙著找積木，
     而「從第一個開始，一個一個往下比」那件事反而看不見。
     ⇒ 所以這裡讓他**自己動手找一次**，再回頭看程式。

   ★ 課本的例子就是這裡的預設題（翰林 114 資科 2 下 6-3-1，p.204）
       原始資料　8、5、10、1、7　　目標資料　10
       第 1 回合　取出第 1 個元素 8，不是目標資料 10
       第 2 回合　取出第 2 個元素 5，不是目標資料 10
       第 3 回合　取出第 3 個元素 10，找到目標資料
     學生在網站上操作的、課本上讀到的，必須是同一組數字 ——
     不一樣的話，他會以為是兩件事。

   ⚠️ 這個實驗室真正在擋的只有一件事：**不准跳著點**。
      能亂點的話，學生會直接點中目標然後說「我找到了」——
      那是「用眼睛找」，不是循序搜尋。
      「循序」兩個字的全部意思就是「不能跳」，所以那是唯一要擋的。

   ⚠️ 找不到也要走得完。
      課本明講「直到找到所要的元素**或所有資料均尋找完**為止」。
      只出找得到的題目，學生永遠不會遇到「查無此資料」那條路 ——
      而那條路正是迴圈結束條件的來源。
      ⇒ 所以出題時會刻意留一部分是找不到的（見 makeCase）。

   用法：
     SEARCHLAB.mount(host, { mode:'sequential', items:[...], target: 10, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-searchlab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /**
   * 循序搜尋：這一步只能點第 next 個（0 起算）。
   * ★ 錯的時候不告訴他該點哪一個 —— 講了就變成照指示按，
   *   而「下一個是誰」正是這一關要他自己記住的事。
   */
  function checkSequential(list, next, i) {
    if (!list.length) return { ok: false, msg: '沒有資料可以找。' };
    if (i === next) return { ok: true, msg: '' };
    if (i < next) {
      return { ok: false,
               msg: '這一項<b>已經比過了</b>。循序搜尋不會回頭 —— 往下一項。' };
    }
    return { ok: false,
             msg: '不可以跳。循序搜尋是<b>從第一個開始、一個接一個</b>往下比，' +
                  '中間不能略過 —— 跳著找那是用眼睛找，不是演算法。' };
  }

  /**
   * 走一步的結果：找到了？還是繼續？還是找完了都沒有？
   * ★ 回傳的 done 是「這一輪結束了」，found 才是「有沒有找到」。
   *   兩個分開，因為「找完了沒找到」也是一種結束 —— 而那是課本要教的那一條。
   */
  function stepResult(list, target, i) {
    var hit = String(list[i]) === String(target);
    var last = (i >= list.length - 1);
    return { found: hit, done: hit || last, at: i };
  }

  /** 循序搜尋一定會比幾次（找到就停；找不到就是全部長度） */
  function countSequential(list, target) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]) === String(target)) return i + 1;
    }
    return list.length;
  }

  /* ── 二元搜尋（課本 6-3-2）─────────────────────────
     ⚠️ 這裡的位置一律用**課本的講法**：第 1 項是 1，不是 0。
        程式裡改成 0 起算的話，學生算出「(1+13)÷2＝7」
        卻要點第 8 格 —— 他會以為自己算錯。 */

  /** 二分位置 =（開始＋結束）÷2，取整數部分（無條件捨去，課本 p.208） */
  function midOf(lo, hi) { return Math.floor((lo + hi) / 2); }

  /**
   * 這一回合只能點二分位置。
   * ★ 算錯了不告訴他答案 —— 「（開始＋結束）÷2」正是這一關要他會的事。
   */
  function checkMid(lo, hi, i) {
    if (lo > hi) return { ok: false, msg: '範圍已經空了。' };
    if (i < lo || i > hi) {
      return { ok: false,
               msg: '這一項<b>已經被排除</b>了。這一回合只能在' +
                    '第 ' + lo + ' ～ ' + hi + ' 項之間找。' };
    }
    if (i === midOf(lo, hi)) return { ok: true, msg: '' };
    return { ok: false,
             msg: '不是這一項。二元搜尋每一回合都要點<b>正中間</b>那一項 —— ' +
                  '（開始位置＋結束位置）÷ 2，除不盡就取整數部分。' };
  }

  /** 比完之後該往哪一邊。'hit' 就是找到了 */
  function sideOf(value, target) {
    var v = Number(value), t = Number(target);
    if (v === t) return 'hit';
    return (v < t) ? 'right' : 'left';      // 中間值比較小 → 目標在右半
  }

  /**
   * 砍掉一半。
   * ⚠️ 新範圍**不包含**這一回合的二分位置（課本 p.207 教學叮嚀）——
   *    包含進去的話，同一格會被比第二次，範圍永遠縮不完。
   */
  function narrow(lo, hi, mid, side) {
    return (side === 'right') ? { lo: mid + 1, hi: hi } : { lo: lo, hi: mid - 1 };
  }

  /** 範圍空了（開始位置大於結束位置）＝ 查無此資料 */
  function empty(lo, hi) { return lo > hi; }

  /** 二元搜尋一定會比幾次（找到就停；找不到就是砍到範圍空掉） */
  function countBinary(list, target) {
    var lo = 1, hi = list.length, n = 0;
    while (lo <= hi) {
      var m = midOf(lo, hi);
      n++;
      var s = sideOf(list[m - 1], target);
      if (s === 'hit') return n;
      var r = narrow(lo, hi, m, s);
      lo = r.lo; hi = r.hi;
    }
    return n;
  }

  /* ── 大比拼（第 10 關）─────────────────────────────
     ★ 第 8、9 關各自都走完了，但學生還是不會有感覺 ——
       13 筆資料，4 次對 9 次，差距不夠大。
       這一關要問的是：**資料變成 1000 筆呢？**
       課本第 203 頁的開場就是這個（5 個一眼看到、100 個來不及）。

     ⚠️ 這裡刻意**不教 log**。國中生不必碰對數。
        砍半這件事他在第 9 關已經做過了 —— 這一關只是讓他
        一直砍下去、自己數按了幾次。數出來的就是答案。

     ⚠️ 循序那一邊不給他按。1000 筆要按 1000 次 ——
        而且「最壞就是全部比一遍」本來就一望即知，
        真正反直覺的是二元那個小得離譜的數字。 */

  /** 比完中間那筆之後還剩幾筆（新範圍不含中間那筆，和第 9 關同一條規則） */
  function afterCut(n) { return Math.ceil((n - 1) / 2); }

  /**
   * 二元搜尋最壞情況要比幾次 —— 一直砍到範圍空掉為止。
   * ★ 對得起課本的兩題：50 筆 → 6 次、1024 筆 → 11 次（p.220 習題）。
   */
  function worstBinary(n) {
    var c = 0;
    while (n > 0) { c++; n = afterCut(n); }
    return c;
  }

  /** 循序搜尋最壞情況：全部比一遍（找不到，或目標在最後一筆） */
  function worstSequential(n) { return n; }

  /* 大比拼要跑的幾種資料量。
     13 是課本 6-3-2 那一列；50 與 1024 是課本習題直接問過的數字。 */
  var SIZES = [13, 50, 100, 1024];

  /**
   * 出題。
   *   course:'hit'  → 課本 p.204 那一題：8、5、10、1、7 找 10（第 3 回合找到）
   *   course:'miss' → 課本 p.205 那一題：同一列資料找 9（五回合都沒有）
   * ★ 課本用**同一列資料**示範找得到與找不到，這裡照抄 ——
   *   換一列資料的話，「差別只在目標」這件事就看不出來了。
   * ⚠️ 資料**故意不排序** —— 循序搜尋的長處就是「不必先排序」，
   *    給他一列排好的資料，他會以為兩件事有關係。
   * ⚠️ 隨機題有三分之一是找不到的（見檔案開頭的說明）。
   */
  function makeCase(opts) {
    opts = opts || {};
    var binary = (opts.mode === 'binary');

    if (opts.course) {
      /* 課本 6-3-2 的那一列（13 個已排序的數字，p.208～p.211）：
           找 67 → 4 回合找到；找 40 → 4 回合之後範圍空掉，查無此數字 */
      if (binary) {
        return { items: [12, 13, 27, 34, 39, 42, 58, 60, 67, 71, 88, 92, 95],
                 target: opts.course === 'miss' ? 40 : 67 };
      }
      return { items: [8, 5, 10, 1, 7], target: opts.course === 'miss' ? 9 : 10 };
    }

    /* ★★ 資料量要**每題不同**。
       ⚠️ 2026-08-17 老師回報：原本寫死 binary→13、sequential→8，
          所以「換一題」拿到的永遠是 13 項 ——
          第一次的中間項**永遠是第 7 項**，學生背位置就好，不必真的算
          （開始位置＋結束位置）÷ 2。
       ★★ 而且 13 是奇數，(1+13)÷2 = 7 剛好整除 ——
          學生因此**永遠碰不到**「除不盡取整數部分」那件事，
          而那正是這個公式最容易錯的地方。
       ⇒ 隨機題從下面這組挑，**故意奇偶都有**。
          課本那一題（opts.course）不受影響，維持 13 筆，學生對得回課本。 */
    var SIZES = binary ? [8, 9, 11, 12, 14, 15] : [6, 7, 8, 9, 10];
    var n = opts.size || SIZES[Math.floor(Math.random() * SIZES.length)];
    var a = [], seen = {};
    while (a.length < n) {
      var v = 1 + Math.floor(Math.random() * 99);
      if (!seen[v]) { seen[v] = 1; a.push(v); }   // 不重複，免得「第幾個」有兩個答案
    }

    if (binary) {
      /* ⚠️ 二元搜尋的資料**一定要排序** —— 那是它的前提，不是巧合。
         給一列沒排序的資料，砍掉的那一半可能正好裝著目標。 */
      a.sort(function (x, y) { return x - y; });
    } else {
      /* 反過來：循序搜尋的資料排好了就打散。
         給他一列排好的，他會以為循序搜尋也要先排序。 */
      var tries = 0;
      while (isSorted(a) && tries++ < 20) a.sort(function () { return Math.random() - 0.5; });
    }

    var miss = (opts.miss != null) ? opts.miss : (Math.random() < 0.34);
    if (miss) {
      var t = 0;
      do { t = 1 + Math.floor(Math.random() * 99); } while (seen[t]);
      return { items: a, target: t };
    }
    return { items: a, target: a[Math.floor(Math.random() * a.length)] };
  }

  function isSorted(a) {
    for (var i = 1; i < a.length; i++) {
      if (Number(a[i - 1]) > Number(a[i])) return false;
    }
    return true;
  }

  /* ── 逐步示範：按「下一步」慢慢看一遍 ─────────────────
     ★ 為什麼是「求助」而不是「開場」
       這個實驗室本來就是要學生**自己動手**（不准跳、自己算二分位置）。
       一開場就先放示範，他會照著示範按 —— 那就沒有在想了。
       ⇒ 示範收在一顆按鈕後面，卡住才看。
         和第 4 關條件判斷實驗室的「慢動作重看」是同一個設計。

     ★ 為什麼每一步都要有一句話
       只有畫面在動、沒有解說的話，學生看到的是格子在變色 ——
       他知道「有事情在發生」，但不知道發生的是什麼。

     ⚠️ 示範用的一定是**課本那一組數字**（8、5、10、1、7 找 10；
        13 個數字找 67）—— 學生手上的書就是這樣寫的。 */
  function demoSteps(mode, items, target) {
    var out = [];
    if (mode === 'binary') {
      var lo = 1, hi = items.length, n = 0;
      out.push({ lo: lo, hi: hi, mid: 0, n: 0,
                 note: '資料<b>已經由小到大排好</b>了 —— 這是二元搜尋的前提。' +
                       '開始位置 1、結束位置 ' + hi + '，要找 <b>' + target + '</b>。' });
      while (lo <= hi) {
        var m = midOf(lo, hi), v = items[m - 1];
        n++;
        out.push({ lo: lo, hi: hi, mid: m, n: n,
                   note: '第 ' + n + ' 回合：二分位置 =（' + lo + '＋' + hi + '）÷ 2 = ' +
                         fmt((lo + hi) / 2) + ' → 取整數部分 <b>' + m + '</b>。' +
                         '第 ' + m + ' 項是 <b>' + v + '</b>。' });
        var side = sideOf(v, target);
        if (side === 'hit') {
          out.push({ lo: lo, hi: hi, mid: m, n: n, done: true, found: true,
                     note: '<b>' + v + ' = ' + target + '，找到了！</b>只比了 ' + n + ' 次 —— ' +
                           '同一列資料用循序搜尋要比 ' + countSequential(items, target) + ' 次。' });
          return out;
        }
        var r = narrow(lo, hi, m, side);
        out.push({ lo: r.lo, hi: r.hi, mid: m, n: n,
                   note: v + (side === 'right' ? ' 比 ' + target + ' <b>小</b> —— 目標只可能在<b>右邊</b>，'
                                               : ' 比 ' + target + ' <b>大</b> —— 目標只可能在<b>左邊</b>，') +
                         '另一半連同第 ' + m + ' 項整個<b>砍掉</b>。' +
                         (r.lo > r.hi ? '' : '剩下第 ' + r.lo + ' ～ ' + r.hi + ' 項（' +
                          (r.hi - r.lo + 1) + ' 筆）。') });
        lo = r.lo; hi = r.hi;
      }
      out.push({ lo: lo, hi: hi, mid: 0, n: n, done: true, found: false,
                 note: '開始位置（' + lo + '）已經<b>大於</b>結束位置（' + hi + '）—— ' +
                       '範圍空了，<b>查無此資料</b>。迴圈就是走到這裡才停的。' });
      return out;
    }
    /* 循序：從第 1 項一格一格往下 */
    out.push({ at: 0, n: 0,
               note: '循序搜尋：從<b>第 1 項</b>開始，一項一項往右比。要找 <b>' + target + '</b>。' });
    for (var i = 0; i < items.length; i++) {
      var hit = String(items[i]) === String(target);
      out.push({ at: i + 1, n: i + 1, done: hit || (i === items.length - 1), found: hit,
                 note: hit
                   ? '第 ' + (i + 1) + ' 項是 <b>' + items[i] + '</b>　＝　目標 ' + target +
                     ' —— <b>找到了，停。</b>後面那幾項不必再比。'
                   : '第 ' + (i + 1) + ' 項是 <b>' + items[i] + '</b>　≠　目標 ' + target +
                     (i === items.length - 1
                       ? ' —— 全部比完了都沒有，<b>查無此資料</b>。'
                       : ' —— 不是它，往下一個。') });
      if (hit) break;
    }
    return out;
  }
  /* 10.5 這種要印得出來（Math 直接印會變 10.5，但整數要印 7 不是 7.0） */
  function fmt(x) { return (Math.round(x * 10) / 10); }

  /* ── 驗收挑戰的三關 ───────────────────────────────
     ⚠️ 每一關考的東西不一樣，不是同一件事考三次：
       ⭐   預測：這一題**實際**要比幾次（要在腦子裡跑一遍）
       ⭐⭐  零失誤：換一題，全程不能點錯（會操作 ≠ 不出錯）
       ⭐⭐⭐ 最壞情況：這種資料量**最多**要比幾次（那是演算法的性質，
             和某一題無關 —— 這一關不必真的走）
     ★ 第 3 關的答案就是第 10 關「搜尋大比拼」在算的東西，
       兩關互相接得上。 */
  var TESTS = {
    sequential: {
      worstSize: 12,
      worstAsk: '一列有 <b>12</b> 筆資料（沒有排序）。用循序搜尋法找一個目標，' +
                '<b>最壞</b>的情況要比幾次？',
      worstWhy: '最壞就是目標在最後一項、或根本不在裡面 —— 兩種都得把 12 筆全部比過。',
      worstAns: function (n) { return worstSequential(n); }
    },
    binary: {
      worstSize: 15,
      worstAsk: '一列有 <b>15</b> 筆<b>已經排好序</b>的資料。用二元搜尋法找一個目標，' +
                '<b>最壞</b>的情況要比幾次？',
      worstWhy: '15 → 7 → 3 → 1 → 空，一直砍一半，砍四次範圍就空了。',
      worstAns: function (n) { return worstBinary(n); }
    }
  };

  /** 這一題實際會比幾次（挑戰第 1 關的答案） */
  function realCount(mode, items, target) {
    return (mode === 'binary') ? countBinary(items, target)
                               : countSequential(items, target);
  }

  /* ── 說明文案 ─────────────────────────────────────── */
  var INFO = {
    sequential: {
      name: '循序搜尋法', icon: '🔍',
      /* ⚠️ 用詞一律跟課本：「項」不是「格」。
         畫面上的標籤是「第 N 項」，說明卻寫「第 1 格」的話，
         學生會以為那是兩個不同的東西。 */
      rule: '從<b>第 1 項</b>開始，一項一項往右點，' +
            '把它和目標比一比 —— <b>不可以跳</b>。',
      why: '從第一個元素開始取出，依序逐個與目標資料比較，' +
           '直到找到所要的元素，或所有資料都找完為止。',
      life: '交換禮物要選第一個挑的人：從 1 號開始，一個一個問他的紙牌是幾號，' +
            '問到那個數字為止。'
    },
    binary: {
      name: '二元搜尋法', icon: '✂️',
      rule: '資料<b>已經排好序</b>。每一回合點<b>正中間</b>那一項 —— ' +
            '（開始位置＋結束位置）÷ 2，除不盡取整數部分 —— 再決定砍掉哪一半。',
      why: '對已排序的資料折半搜尋：比中間值大就取右半部，比中間值小就取左半部，' +
           '每一回合待搜尋的資料量馬上少一半。',
      /* ⚠️ 生活案例照課本 6-3 —— 交換禮物要選第一個挑禮物的人，
         學藝股長提的方法二：老師從 1～1000 指定一個數字，
         同學輪流說出範圍**中間位置**的數字，每回合範圍砍一半。
         ★ 第 8 關用的是同一個情境的方法一（依座號一個一個比）——
           兩關同情境不同方法，差別才看得出來。
         （猜數字是課本的補充資源，留著當第二個說法。） */
      life: '交換禮物選第一個挑的人，方法二：老師從 1～1000 指定一個數字，'
          + '同學輪流說出範圍中間位置的數字，說完範圍就砍掉一半。'
          + '和猜數字一樣：對方說 1～100，你先猜 50，他說「太小」，'
          + '1～50 就全部不必猜了。'
    },
    compare: {
      name: '搜尋大比拼', icon: '⚖️',
      rule: '選一個資料量，然後一直按<b>「比一次，砍掉一半」</b>，' +
            '直到範圍空掉 —— 按了幾下，就是二元搜尋最多要比幾次。',
      why: '循序搜尋最壞要把資料全部比一遍；二元搜尋每比一次就少掉一半。' +
           '資料愈多，兩者的差距愈誇張。',
      life: '在 1000 個人裡找一個人：一個一個問，最多問 1000 次；' +
            '如果大家按身高排好，用二元搜尋只要問 10 次。'
    }
  };

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.qs{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.qs-tip{background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.qs-tip b{color:#0e7490}',
    '.qs-sub{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:6px}',
    '.qs-goal{display:flex;align-items:center;gap:9px;margin-bottom:11px;flex-wrap:wrap}',
    '.qs-goal .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.qs-target{padding:7px 15px;border:2px solid #f59e0b;background:#fffbeb;',
    '  border-radius:10px;font-size:17px;font-weight:900;color:#b45309}',
    '.qs-count{font-size:12.5px;color:#0e7490;font-weight:700}',
    '.qs-row{display:flex;align-items:flex-end;gap:7px;margin-bottom:10px;flex-wrap:wrap}',
    '.qs-box{display:flex;flex-direction:column;align-items:center;gap:3px}',
    '.qs-idx{font-size:10.5px;color:#94a3b8;font-weight:700}',
    '.qs-cell{min-width:46px;padding:11px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:16px;font-weight:700;font-family:inherit;color:#334155;',
    '  cursor:pointer;transition:.12s}',
    '.qs-cell:hover{border-color:#06b6d4;background:#ecfeff}',
    /* 比過但不是目標：灰掉。★ 灰掉的格子仍然看得到數字 ——
       「我剛剛比過哪些」是學生數比較次數的依據。 */
    '.qs-cell.past{border-color:#e2e8f0;background:#f8fafc;color:#cbd5e1;cursor:default}',
    '.qs-cell.past:hover{background:#f8fafc;border-color:#e2e8f0}',
    '.qs-cell.now{border-color:#06b6d4;background:#cffafe;transform:translateY(-3px)}',
    '.qs-cell.hit{border-color:#22c55e;background:#dcfce7;color:#166534;cursor:default}',
    /* 出錯一律紅色（三支實驗室一致）。⚠️ 要排在其他狀態後面，
       不然閃爍會被 now／cut 蓋掉，學生點錯卻沒有任何反應。 */
    '.qs-cell.bad{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    /* 二元搜尋：被砍掉的那一半整個劃掉。
       ★ 劃掉但不刪除 —— 學生要看得見「這一刀砍掉了多少」，
         那正是二元搜尋和循序搜尋的差別。 */
    '.qs-cell.cut{border-color:#f1f5f9;background:#f8fafc;color:#e2e8f0;',
    '  text-decoration:line-through;cursor:default}',
    '.qs-cell.cut:hover{background:#f8fafc;border-color:#f1f5f9}',
    '.qs-range{font-size:12.5px;color:#0e7490;font-weight:700;margin-bottom:8px}',
    '.qs-range b{color:#155e75}',
    '.qs-side{display:flex;gap:9px;margin-top:10px;flex-wrap:wrap}',
    '.qs-side button{background:#fff;border:2px solid #06b6d4;color:#0e7490;border-radius:9px;',
    '  padding:8px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-side button:hover{background:#ecfeff}',
    /* 大比拼 */
    '.qs-pick{display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap;align-items:center}',
    '.qs-pick .lb{font-size:12px;font-weight:700;color:#64748b}',
    '.qs-pick button{background:#fff;border:2px solid #cbd5e1;color:#334155;border-radius:9px;',
    '  padding:6px 13px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-pick button:hover{border-color:#06b6d4;background:#ecfeff}',
    '.qs-pick button.on{border-color:#06b6d4;background:#cffafe;color:#0e7490}',
    '.qs-pick button.ok{border-color:#86efac;background:#dcfce7;color:#166534}',
    '.qs-left{font-size:15px;font-weight:700;color:#155e75;margin-bottom:10px}',
    '.qs-left b{font-size:22px;color:#0e7490}',
    '.qs-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}',
    '.qs-tbl th,.qs-tbl td{border:1px solid #e2e8f0;padding:6px 9px;text-align:center}',
    '.qs-tbl th{background:#f1f5f9;color:#475569;font-size:12px}',
    '.qs-tbl td.big{color:#b45309;font-weight:700}',
    '.qs-tbl td.small{color:#0e7490;font-weight:700}',
    '.qs-msg{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.qs-msg.good{background:#dcfce7;color:#166534}',
    '.qs-msg.bad{background:#fef3c7;color:#92400e}',
    '.qs-msg.none{background:#e2e8f0;color:#475569}',
    '.qs-btn{background:#06b6d4;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.qs-btn:hover{background:#0891b2}',
    /* 逐步示範 */
    '.qs-demo{background:#f0f9ff;border:1px solid #bae6fd;border-radius:11px;',
    '  padding:11px 14px;margin-bottom:10px}',
    '.qs-demo .h{font-size:13.5px;font-weight:900;color:#0369a1;margin-bottom:6px}',
    '.qs-demo .say{font-size:13px;line-height:1.85;color:#075985;min-height:44px}',
    '.qs-demo .say b{color:#0c4a6e}',
    '.qs-demo .row{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}',
    '.qs-demo button{background:#fff;border:2px solid #7dd3fc;color:#0369a1;border-radius:8px;',
    '  padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-demo button:hover{background:#e0f2fe}',
    '.qs-big .qs-demo{padding:14px 17px}',
    '.qs-big .qs-demo .h{font-size:15px}',
    '.qs-big .qs-demo .say{font-size:15px;min-height:56px}',
    '.qs-big .qs-demo button{padding:8px 17px;font-size:14.5px}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）─────────
       ★ 這一步是第 6 章那幾關的主角，畫面上就該長得像主角。
         原本的尺寸是給「順手嵌在別的東西旁邊」用的，
         單獨佔一整步時下面會空一大片，看起來像還沒載完。
       ⚠️ 放大的是高度與字級，**不是頁寬** —— 頁寬要和闖關地圖一致。 */
    '.qs-big .qs-cell{min-width:64px;padding:18px 14px;font-size:22px;border-width:3px}',
    '.qs-big .qs-idx{font-size:12.5px}',
    '.qs-big .qs-row{gap:10px;margin-bottom:16px}',
    '.qs-big .qs-target{padding:10px 22px;font-size:24px;border-width:3px}',
    '.qs-big .qs-goal{gap:12px;margin-bottom:16px}',
    '.qs-big .qs-goal .lb,.qs-big .qs-count{font-size:14px}',
    '.qs-big .qs-range{font-size:14.5px;margin-bottom:12px}',
    '.qs-big .qs-tip{font-size:14.5px;padding:14px 17px}',
    '.qs-big .qs-sub{font-size:13.5px}',
    '.qs-big .qs-msg{font-size:15px;padding:13px 16px;min-height:52px}',
    '.qs-big .qs-side button{padding:12px 20px;font-size:15px}',
    '.qs-big .qs-btn{padding:11px 20px;font-size:15px}',
    '.qs-big .qs-left{font-size:17px}',
    '.qs-big .qs-left b{font-size:28px}',
    '.qs-big .qs-pick button{padding:9px 18px;font-size:15px}',
    '.qs-big .qs-tbl{font-size:14.5px}',
    '.qs-big .qs-tbl th,.qs-big .qs-tbl td{padding:10px 12px}',
    /* ── 第 3 關的砍半計數器（答錯一次才出現）───────── */
    '.qs-aid{background:#fffbeb;border:1px solid #fcd34d;border-radius:11px;',
    '  padding:10px 13px;margin-top:9px}',
    '.qs-aid .h{font-size:13px;font-weight:900;color:#92400e;margin-bottom:6px}',
    '.qs-aid .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:6px;',
    '  font-size:13px;color:#78350f}',
    '.qs-aid .row b{font-size:19px;color:#b45309}',
    '.qs-aid button{background:#f59e0b;color:#fff;border:0;border-radius:8px;',
    '  padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.qs-aid button:hover{background:#d97706}',
    '.qs-aid button:disabled{background:#e2e8f0;color:#94a3b8;cursor:default}',
    '.qs-aid button.ghost{background:#fff;border:2px solid #fcd34d;color:#92400e}',
    '.qs-aid .say{font-size:12.5px;line-height:1.8;color:#92400e;margin-top:4px}',
    '.qs-big .qs-aid{padding:13px 16px}',
    '.qs-big .qs-aid .h{font-size:14.5px}',
    '.qs-big .qs-aid .row{font-size:14.5px}',
    '.qs-big .qs-aid .row b{font-size:24px}',
    '.qs-big .qs-aid button{padding:9px 18px;font-size:14.5px}',
    '.qs-big .qs-aid .say{font-size:13.5px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('qs-style')) return;
    var s = document.createElement('style');
    /* 挑戰與證書的樣式在 shared/labtest.js —— 三支實驗室共用一份，
       抄過來的話改一邊會忘另一邊。 */
    s.id = 'qs-style';
    s.textContent = CSS + ((global.LABTEST && global.LABTEST.css) || '');
    document.head.appendChild(s);
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var mode = opts.mode || 'sequential';
    var info = INFO[mode] || INFO.sequential;

    var items, target, next, tried, passed, ended;
    /* 二元搜尋用：目前的搜尋範圍（1 起算，照課本），還有這一回合停在哪一步。
       phase 'pick' = 該點二分位置了；'side' = 點完了，該決定砍哪一半。 */
    var lo, hi, phase, mid;
    /* 大比拼用：目前選的資料量、還剩幾筆、按了幾下，還有已經跑完的紀錄。 */
    var sizes = opts.sizes || SIZES;
    var size = 0, left = 0, cuts = 0, table = {};
    /* ★ 要「找到一次」＋「找不到一次」才算通過。
       只找到過的學生，不會知道迴圈為什麼需要結束條件。 */
    var sawHit = false, sawMiss = false;
    /* 逐步示範：dAt < 0 代表沒開。開了才算步數。 */
    var dAt = -1, dSteps = null;
    var usedMiss = false;      // 課本的第二題（找不到）出過了沒
    /* ── 驗收挑戰（自由玩通過之後才開）─────────────
       ⚠️ 「照規則走完」只證明他**會操作**。
          真正的證據是：動手之前先說得出「這一題要比幾次」。
       三個難度見 shared/labtest.js。 */
    var freePassed = false;    // 自由玩那一段過了沒
    var worstTries = 0;        // 第 3 關答錯幾次（答錯一次才給鷹架）
    var aidN = 0, aidC = 0;    // 鷹架的計數器：還剩幾項、已經比幾次
    var lvNow = 0;             // 正在挑戰第幾關（0＝還沒開始）
    var cleared = {};          // 過了哪幾關
    var guess = null;          // 這一關預測的數字
    var errs = 0;              // 這一題點錯幾次（零失誤那一關要）
    var testMsg = '', testKind = 'info';

    reset(opts.items && opts.items.length
            ? { items: opts.items.slice(), target: opts.target }
            : (mode === 'compare' ? { items: [], target: '' } : makeCase(opts)));

    host.className = 'qs' + (opts.big ? ' qs-big' : '');
    render();

    function reset(c) {
      items = c.items; target = c.target;
      next = 0; tried = 0; ended = false;
      lo = 1; hi = items.length; phase = 'pick'; mid = 0;
    }

    /* ── 換一題 ────────────────────────────────────
       ⚠️ 2026-08-12 抓到的當機級錯誤：
          原本是 `reset(makeCase(opts))` —— opts 裡還帶著 course:'hit'，
          所以 makeCase 每次都回課本那一題（8、5、10、1、7 找 10）。
          「換一題」按幾次都一樣，而通過條件要「找得到＋找不到各一次」
          ⇒ **這一關永遠過不了**，學生卡在這一步走不下去。
          ★ 而且畫面上完全看不出異常：題目長得好好的，
            只是每次都一樣，學生只會覺得「怎麼一直是這題」。

       ★ 換題的順序是設計過的：
         第 1 題　課本 p.204 那一題（找得到）——和他手上的書一樣
         第 2 題　課本 p.205 那一題（同一列資料找 9，找不到）
                  ⇒ 課本用同一列示範兩次，這裡照走一遍
         之後　　 隨機出題（三分之一是找不到的） */
    function nextCase() {
      if (opts.course && !usedMiss) {
        usedMiss = true;
        reset(makeCase({ mode: mode, course: 'miss' }));
      } else {
        /* ⚠️ 一定要把 course 拿掉，不然又回到同一題。 */
        var o = {};
        for (var k in opts) if (k !== 'course') o[k] = opts[k];
        reset(makeCase(o));
      }
      dAt = -1; dSteps = null;      // 換題就把示範收起來
      errs = 0;                     // 新的一題，失誤重新算
      render();
    }

    function render() {
      host.innerHTML =
        '<div class="qs-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="qs-sub">📝 ' + info.why + '<br>🎁 ' + info.life + '</div></div>' +
        (mode === 'compare' ? ''
          : '<div class="qs-goal"><span class="lb">目標資料</span>' +
            '<span class="qs-target">' + esc(target) + '</span>' +
            '<span class="qs-count" id="qs-cnt"></span></div>') +
        '<div id="qs-test"></div>' +
        '<div id="qs-demo"></div>' +
        '<div id="qs-body"></div>' +
        '<div id="qs-msg"></div>' +
        (opts.newRound !== false && mode !== 'compare'
          ? '<button class="qs-btn" id="qs-new">🎲 換一題</button>' : '');
      body();
      test();
      demo();
      count();
      var nb = host.querySelector('#qs-new');
      if (nb) nb.onclick = nextCase;
    }

    /* ── 驗收挑戰的畫面 ──────────────────────────
       ⚠️ 一次只出現一關。三關攤開的話，
          學生會先看第 3 關的題目，那一關就白出了。 */
    function test() {
      var box = host.querySelector('#qs-test');
      if (!box) return;
      if (!lvNow) { box.innerHTML = ''; return; }
      var T = TESTS[mode], L = global.LABTEST.LEVELS[lvNow - 1];

      if (lvNow > 3) {                       // 三關都過了 → 證書
        box.className = '';
        box.innerHTML = global.LABTEST.certificate(3,
          { title: INFO[mode].name + '　驗收挑戰' });
        return;
      }
      box.className = '';
      var head = '<div class="lt-box"><div class="h">' + L.icon +
                 ' 驗收挑戰 ' + lvNow + '／3　' + L.name +
                 '（目前 ' + stars() + ' ★，三關全過才能往下一步）</div>';

      if (lvNow === 1) {
        box.innerHTML = head +
          (guess === null
            ? '<div class="q">先別動手。<b>這一題</b>要比幾次才會結束？' +
              '（找到就停；找不到就是全部比完）</div>' +
              '<div class="row"><input id="qs-g" type="number" min="1" placeholder="次數">' +
              '<button data-g="1">送出預測</button></div>'
            : '<div class="q">你猜 <b>' + guess + '</b> 次。現在真的走一遍 —— ' +
              '走完就知道猜得準不準。</div>') +
          '</div>';
      } else if (lvNow === 2) {
        box.innerHTML = head +
          '<div class="q">換一題，<b>全程不能點錯</b>。' +
          '點錯一次就得重來（按「換一題」重新開始）。' +
          '<br>目前這一題已經錯了 <b>' + errs + '</b> 次。</div></div>';
      } else {
        /* ★★ 第 3 關是**實際的通關門檻**（onPass 只在這裡被扳動），
             所以它不可以是「想不出來就卡死」的一題。
           ⚠️ 2026-08-17 之前這裡只有題目和一句 worstWhy，
              答錯就只回「不是 N 次」—— 學生沒有任何東西可以推。
           ★ 現在：**答錯一次之後**才長出一個砍半計數器，
             讓他自己按、自己數。先給的話這一題就白出了；
             不給的話他只能亂猜數字，那更糟。 */
        box.innerHTML = head +
          '<div class="q">' + T.worstAsk + '<br>' +
          '<span style="font-size:12.5px">這一關<b>不必真的走</b> —— ' +
          '想想這個演算法最多會做幾次。</span></div>' +
          '<div class="row"><input id="qs-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="3">送出答案</button></div>' +
          (worstTries > 0 ? aidHTML() : '') +
          '</div>';
      }
      box.innerHTML += '<div class="lt-say ' + (testKind || 'info') + '" id="qs-tsay">' +
                       (testMsg || '　') + '</div>';
      [].forEach.call(box.querySelectorAll('[data-g]'), function (el) {
        el.onclick = function () { submit(Number(el.dataset.g)); };
      });
      [].forEach.call(box.querySelectorAll('[data-aid]'), function (el) {
        el.onclick = function () { aidTap(el.dataset.aid); };
      });
    }

    function submit(which) {
      var inp = host.querySelector('#qs-g');
      var v = Number(inp && inp.value);
      if (!(v > 0)) { tsay('info', '先填一個數字。'); return; }

      if (which === 1) {
        guess = v;
        tsay('info', '記下來了：<b>' + v + '</b> 次。現在真的走一遍。');
        render();
        return;
      }
      /* 第 3 關：最壞情況 */
      var want = TESTS[mode].worstAns(TESTS[mode].worstSize);
      if (v === want) {
        cleared[3] = true; lvNow = 4;
        tsay('good', '對了 —— <b>' + want + '</b> 次。' + TESTS[mode].worstWhy +
                     '<br>三關全過，證書拿到了 ★★★');
        render(); finishAll();
      } else {
        worstTries++;
        /* ★ 第一次答錯就把砍半計數器放出來（見 test() 裡的說明）。
           ⚠️ worstWhy 本來就寫著「15 → 7 → 3 → 1 → 空」——
              但那是一行字，學生讀過去不會停下來數。
              自己按四下才會。 */
        tsay('bad', '不是 ' + v + ' 次。' +
                    (worstTries === 1
                      ? '<br>下面給你一個工具：<b>自己按按看</b>，數數看按幾下範圍才會空。'
                      : TESTS[mode].worstWhy + '<br>用下面那個工具再數一次。'));
      }
    }

    /**
     * 第 3 關的鷹架：一個砍半（或逐一比）的計數器。
     * ★ 為什麼是「自己按」而不是把過程印出來
     *   印出來的話學生用讀的，讀完照樣不知道那個數字怎麼來的。
     *   按四下、看著範圍從 15 變成空的，那四下他自己數過。
     */
    function aidHTML() {
      var T = TESTS[mode];
      return '<div class="qs-aid">' +
        '<div class="h">🧮 自己數數看</div>' +
        '<div class="row">' +
          '<span>還剩 <b id="qs-aid-n">' + aidN + '</b> 項</span>' +
          '<span>已經比了 <b id="qs-aid-c">' + aidC + '</b> 次</span>' +
        '</div>' +
        '<div class="row">' +
          '<button data-aid="go"' + (aidN <= 0 ? ' disabled' : '') + '>' +
            (mode === 'binary' ? '比一次，砍掉一半' : '比一次，往下一項') + '</button>' +
          '<button data-aid="rst" class="ghost">↺ 重來</button>' +
        '</div>' +
        '<div class="say">' +
          (aidN <= 0
            ? '範圍空了 —— 你按了 <b>' + aidC + '</b> 次。那就是最壞的情況。'
            : (aidC === 0
                ? '從 ' + T.worstSize + ' 項開始。按一下看看剩幾項。'
                : '每比一次就' + (mode === 'binary' ? '砍掉一半' : '少一項') + '。繼續按。')) +
        '</div></div>';
    }

    function aidTap(what) {
      if (what === 'rst') { aidN = TESTS[mode].worstSize; aidC = 0; render(); return; }
      if (aidN <= 0) return;
      /* ⚠️ 這裡的算法要和 worstBinary／worstSequential **完全一致**，
         不然工具數出來的和答案對不起來 —— 那比沒有工具還糟。
         binary：比完中間那一項，剩下的一半是 floor(n/2)
         sequential：一次只排除一項 */
      aidN = (mode === 'binary') ? Math.floor(aidN / 2) : aidN - 1;
      aidC++;
      render();
    }
    function tsay(kind, msg) { testKind = kind; testMsg = msg; render(); }

    /* 走完一題之後，看看挑戰過了沒 */
    function afterRound() {
      if (!lvNow || lvNow > 3) return;
      var real = realCount(mode, items, target);
      if (lvNow === 1) {
        if (guess === null) return;          // 還沒預測就走完 → 不算
        if (guess === real) {
          cleared[1] = true; lvNow = 2; guess = null;
          tsay('good', '猜中了 —— 真的是 <b>' + real + '</b> 次 ⭐<br>' +
                       '下一關：換一題，<b>全程不能點錯</b>。');
        } else {
          tsay('bad', '你猜 ' + guess + '，實際是 <b>' + real + '</b> 次。' +
                      '<br>換一題再試一次 —— 這一關可以一直重來。');
          guess = null;
        }
        return;
      }
      if (lvNow === 2) {
        if (errs === 0) {
          cleared[2] = true; lvNow = 3;
          tsay('good', '整題零失誤 ⭐⭐<br>最後一關：不必真的走，直接算給我看。');
        } else {
          tsay('bad', '這一題點錯了 ' + errs + ' 次。換一題再挑戰一次。');
        }
      }
    }

    /* ── 逐步示範 ────────────────────────────────
       ★ 收在一顆按鈕後面：先自己試，卡住才看。
         一開場就放示範的話，學生會照著示範按 —— 那就沒有在想了。
       ⚠️ 只有循序與二元有；大比拼那一關本來就是一步一步按的。 */
    function demo() {
      var box = host.querySelector('#qs-demo');
      if (!box) return;
      if (mode === 'compare') { box.innerHTML = ''; return; }
      if (dAt < 0) {
        box.className = '';
        box.innerHTML = '<button class="qs-btn" id="qs-dgo" ' +
          'style="background:#0ea5e9;margin:0 0 10px">🐢 看一次逐步示範（用課本的例子）</button>';
        box.querySelector('#qs-dgo').onclick = function () {
          var c = makeCase({ mode: mode, course: 'hit' });
          dSteps = demoSteps(mode, c.items, c.target);
          dAt = 0; render();
        };
        return;
      }
      var st = dSteps[dAt], last = dAt >= dSteps.length - 1;
      box.className = 'qs-demo';
      box.innerHTML =
        '<div class="h">🐢 逐步示範　第 ' + dAt + ' 步 ／ 共 ' + (dSteps.length - 1) + ' 步' +
        (st.n ? '　比較次數 ' + st.n : '') + '</div>' +
        '<div class="say">' + st.note + '</div>' +
        '<div class="row">' +
        (last ? '<button data-d="0">↺ 再看一次</button>'
              : '<button data-d="1">⏭ 下一步</button><button data-d="9">⏩ 一路看完</button>') +
        '<button data-d="-1">關掉示範，自己試</button></div>';
      [].forEach.call(box.querySelectorAll('[data-d]'), function (el) {
        el.onclick = function () {
          var v = Number(el.dataset.d);
          if (v === -1) { dAt = -1; dSteps = null; }
          else if (v === 0) dAt = 0;
          else if (v === 9) dAt = dSteps.length - 1;
          else dAt = Math.min(dAt + 1, dSteps.length - 1);
          render();
        };
      });
    }

    function body() {
      var b = host.querySelector('#qs-body');
      if (mode === 'compare') { b.innerHTML = compareHtml(); wire(b); return; }
      b.innerHTML = (mode === 'binary' ? rangeHtml() : '') +
        '<div class="qs-row">' + items.map(cellHtml).join('') + '</div>' +
        (mode === 'binary' && phase === 'side' && !ended ? sideHtml() : '');
      [].forEach.call(b.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { click(Number(el.dataset.i), el); };
      });
      [].forEach.call(b.querySelectorAll('[data-side]'), function (el) {
        el.onclick = function () { pickSide(el.dataset.side); };
      });
    }

    /* ── 大比拼 ────────────────────────────────────── */
    function compareHtml() {
      var out = '<div class="qs-pick"><span class="lb">資料量</span>' +
        sizes.map(function (n) {
          var cls = (n === size) ? ' class="on"' : (table[n] ? ' class="ok"' : '');
          return '<button data-size="' + n + '"' + cls + '>' +
                 n + ' 筆' + (table[n] ? ' ✓' : '') + '</button>';
        }).join('') + '</div>';

      if (!size) {
        out += '<div class="qs-left">先選一個資料量。</div>';
      } else if (left > 0) {
        out += '<div class="qs-left">還要找的範圍：<b>' + left + '</b> 筆' +
               '　（已經比了 ' + cuts + ' 次）</div>' +
               '<div class="qs-side"><button data-cut="1">✂️ 比一次，砍掉一半</button></div>';
      } else {
        out += '<div class="qs-left">範圍空了 —— 二元搜尋最多比 <b>' + cuts + '</b> 次。</div>';
      }
      return out + tableHtml();
    }

    /* ★ 累積成一張表，讓差距自己長出來。
       只跑一種資料量看不出什麼；跑到 1024 筆那一列時，
       1024 對 11 —— 那個對比不必解釋。 */
    function tableHtml() {
      var done = sizes.filter(function (n) { return table[n]; });
      if (!done.length) return '';
      return '<table class="qs-tbl"><tr><th>資料量</th>' +
             '<th>循序搜尋<br>最多比幾次</th><th>二元搜尋<br>最多比幾次</th></tr>' +
             done.map(function (n) {
               return '<tr><td>' + n + ' 筆</td>' +
                      '<td class="big">' + worstSequential(n) + '</td>' +
                      '<td class="small">' + table[n] + '</td></tr>';
             }).join('') + '</table>';
    }

    function wire(b) {
      [].forEach.call(b.querySelectorAll('[data-size]'), function (el) {
        el.onclick = function () { startSize(Number(el.dataset.size)); };
      });
      [].forEach.call(b.querySelectorAll('[data-cut]'), function (el) {
        el.onclick = cut;
      });
    }

    function startSize(n) {
      size = n; left = n; cuts = 0;
      body();
      say('bad', '假設最倒楣的情況：目標在最後才找到，或根本不在裡面。' +
                 '<br>一直按下去，看看要按幾下才砍完 <b>' + n + '</b> 筆。');
    }

    function cut() {
      if (!size || left <= 0) return;
      cuts++;
      left = afterCut(left);         // 比完中間那筆，剩下的不含它
      if (left > 0) {
        body();
        say('good', '比了第 ' + cuts + ' 次，範圍剩 <b>' + left + '</b> 筆。');
        return;
      }
      table[size] = cuts;
      body();
      var seq = worstSequential(size);
      say('good', '<b>' + size + '</b> 筆資料：循序搜尋最多要比 <b>' + seq + '</b> 次，' +
                  '二元搜尋只要 <b>' + cuts + '</b> 次。' +
                  (seq >= cuts * 20
                    ? '<br>⚠️ 資料量是比較次數的 <b>' + Math.round(seq / cuts) + '</b> 倍 —— ' +
                      '那就是「每次砍一半」的威力。'
                    : ''));
      maybePass();
    }

    /* 開始位置／結束位置／二分位置 —— 課本每一回合都寫這三個數字，
       學生要跟著算，所以畫面上一定要看得到。 */
    function rangeHtml() {
      if (ended) return '';
      return '<div class="qs-range">第 <b>' + (tried + (phase === 'side' ? 0 : 1)) +
             '</b> 回合　開始位置：<b>' + lo + '</b>　結束位置：<b>' + hi + '</b>' +
             (phase === 'side'
               ? '　二分位置：<b>' + mid + '</b>（第 ' + mid + ' 項是 ' + esc(items[mid - 1]) + '）'
               : '　二分位置：<b>？</b>　←　自己算，然後點那一項') +
             '</div>';
    }

    function cellHtml(v, i) {
      var cls = 'qs-cell', n = i + 1;
      /* ★ 示範開著的時候，格子跟著示範走 ——
         不然畫面在講第 3 步，格子卻停在學生自己按到的地方。 */
      if (dAt >= 0 && dSteps) {
        var st = dSteps[dAt];
        if (mode === 'binary') {
          if (st.mid === n) cls += (st.found ? ' hit' : ' now');
          else if (n < st.lo || n > st.hi) cls += ' cut';
        } else {
          if (st.at === n) cls += (st.found ? ' hit' : ' now');
          else if (st.at && n < st.at) cls += ' past';
        }
        return '<div class="qs-box"><span class="qs-idx">第 ' + n + ' 項</span>' +
               '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button></div>';
      }
      if (mode === 'binary') {
        if (ended && n === mid && String(v) === String(target)) cls += ' hit';
        else if (n < lo || n > hi) cls += ' cut';        // 被砍掉的那一半：劃掉，但看得見
        else if (n === mid && phase === 'side') cls += ' now';
      } else {
        if (ended && i === next && String(v) === String(target)) cls += ' hit';
        else if (i < next) cls += ' past';
        else if (i === next && !ended) cls += ' now';
      }
      return '<div class="qs-box"><span class="qs-idx">第 ' + n + ' 項</span>' +
             '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button></div>';
    }

    function sideHtml() {
      return '<div class="qs-side">' +
             '<button data-side="left">◀ 取前（左）半部</button>' +
             '<button data-side="right">取後（右）半部 ▶</button></div>';
    }

    function count() {
      var c = host.querySelector('#qs-cnt');
      if (c) c.innerHTML = '　比較次數：<b>' + tried + '</b>';
    }
    function say(kind, msg) {
      var m = host.querySelector('#qs-msg');
      m.className = 'qs-msg ' + kind;
      m.innerHTML = (kind === 'good' ? '✓ ' : kind === 'bad' ? '✗ ' : '· ') + msg;
    }
    function flash(el) {
      if (!el) return;
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 650);
    }

    function click(i, el) {
      if (ended) return;
      if (mode === 'binary') return clickBinary(i, el);
      var r = checkSequential(items, next, i);
      if (!r.ok) { errs++; flash(el); say('bad', r.msg); return; }

      tried++;
      var s = stepResult(items, target, i);
      if (s.found) {
        ended = true; sawHit = true;
        body(); count();
        say('good', '找到了 —— <b>' + esc(target) + '</b> 在第 <b>' + (i + 1) + '</b> 項。' +
                    '總共比了 <b>' + tried + '</b> 次。' +
                    '<br>⚠️ 找到就<b>停</b>，後面那幾項不必再比。');
        maybePass();
        return;
      }
      if (s.done) {
        /* ★ 全部比完都沒有 —— 課本明講的另一條路 */
        ended = true; sawMiss = true;
        next = i + 1;
        body(); count();
        say('none', '全部 <b>' + items.length + '</b> 項都比過了，沒有 <b>' + esc(target) + '</b>。' +
                    '<br>這叫<b>查無此資料</b> —— 迴圈就是走到這裡才停的。');
        maybePass();
        return;
      }
      next = i + 1;
      body(); count();
      say('bad', '第 ' + (i + 1) + ' 項是 ' + esc(items[i]) + '，不是目標 ' + esc(target) +
                 ' —— 往下一個。');
    }

    /* ── 二元搜尋：一回合分兩步 ─────────────────────────
       ① 點二分位置（自己算（開始＋結束）÷2）
       ② 決定砍哪一半
       ⚠️ 兩步分開是刻意的。合成一步（點了就自動砍）的話，
          學生只練到「會算中間位置」，而「比中間值大就往右」
          那個判斷完全沒被考到 —— 那才是二元搜尋的核心。 */
    function clickBinary(i, el) {
      if (phase === 'side') {
        say('bad', '先決定要砍掉哪一半 —— 下面兩顆按鈕。');
        return;
      }
      var r = checkMid(lo, hi, i + 1);
      if (!r.ok) { errs++; flash(el); say('bad', r.msg); return; }

      mid = i + 1;
      tried++;
      var s = sideOf(items[mid - 1], target);
      if (s === 'hit') {
        ended = true; sawHit = true;
        body(); count();
        say('good', '找到了 —— <b>' + esc(target) + '</b> 在第 <b>' + mid + '</b> 項。' +
                    '總共只比了 <b>' + tried + '</b> 次。' +
                    '<br>⚠️ 資料有 ' + items.length + ' 筆，循序搜尋要比 ' +
                    countSequential(items, target) + ' 次 —— 差別就在每回合砍掉一半。');
        maybePass();
        return;
      }
      phase = 'side';
      body(); count();
      say('bad', '第 ' + mid + ' 項是 <b>' + esc(items[mid - 1]) + '</b>，' +
                 (Number(items[mid - 1]) < Number(target) ? '比目標<b>小</b>' : '比目標<b>大</b>') +
                 ' —— 那目標會在哪一半？');
    }

    function pickSide(pick) {
      if (ended || phase !== 'side') return;
      var want = sideOf(items[mid - 1], target);
      if (pick !== want) {
        errs++;
        /* ★ 砍錯邊 = 把目標砍掉了。這裡要講清楚後果，不只是說「錯」——
           因為錯的代價（永遠找不到）正是「資料要先排序」的理由。 */
        say('bad', '砍錯邊了。第 ' + mid + ' 項是 ' + esc(items[mid - 1]) +
                   '，資料<b>由小到大</b>排好 —— ' +
                   '比目標小的話，目標只可能在它<b>右邊</b>；比目標大就在<b>左邊</b>。' +
                   '<br>砍錯的話，目標就被你丟掉了，之後再怎麼找都找不到。');
        return;
      }
      var r = narrow(lo, hi, mid, want);
      lo = r.lo; hi = r.hi;
      phase = 'pick';

      if (empty(lo, hi)) {
        /* ★ 開始位置大於結束位置 → 查無此資料（課本 p.211） */
        ended = true; sawMiss = true;
        mid = 0;
        body(); count();
        say('none', '開始位置（' + lo + '）已經<b>大於</b>結束位置（' + hi + '）' +
                    '—— 範圍空了，沒有 <b>' + esc(target) + '</b>。' +
                    '<br>這叫<b>查無此資料</b>。二元搜尋的迴圈就是走到這裡才停的。');
        maybePass();
        return;
      }
      body(); count();
      say('good', '砍掉一半了。剩下第 <b>' + lo + '</b> ～ <b>' + hi + '</b> 項（' +
                  (hi - lo + 1) + ' 筆）—— 再算一次二分位置。');
    }

    function maybePass() {
      /* ★ 挑戰開著的時候，走完一題要先結算挑戰。
         ⚠️ 放在 maybePass 開頭 —— 三個「這一題結束了」的出口都會經過這裡，
            各自呼叫的話一定會漏掉其中一個。 */
      if (lvNow && lvNow <= 3) { afterRound(); return; }
      if (passed) return;

      if (mode === 'compare') {
        /* ★ 每一種資料量都要跑過。
           ⚠️ 只跑 13 筆的話，4 對 13 —— 差距不夠大，
              學生會覺得「好像也沒差多少」。
              一定要走到最大那一個，1024 對 11 才有感覺，
              而那正是這一關存在的理由。 */
        var miss = sizes.filter(function (n) { return !table[n]; });
        if (miss.length) {
          say2('還有 ' + miss.join('、') + ' 筆沒跑。' +
               '資料愈多差距愈大 —— 跑到最大那一個才看得出來。');
          return;
        }
        openTest();
        return;
      }

      /* 找得到、找不到兩種都遇過才算走完一輪。 */
      if (!(sawHit && sawMiss)) {
        var need = sawHit ? '找<b>不到</b>' : '找<b>得到</b>';
        say2('還差一種情況：再換一題，試一次' + need + '的。' +
             '兩條路都走過，才知道迴圈為什麼需要結束條件。');
        return;
      }
      openTest();
    }

    /* ── 驗收挑戰：自由玩過了才開 ──────────────────
       ★ 「照規則走完」只證明他**會操作**。
         真正的證據是：動手之前先說得出「這一題要比幾次」。
       三個難度的定義在 shared/labtest.js（三支實驗室共用）。
       ⚠️ 大比拼沒有挑戰 —— 它本來就是一步一步按著數的，
          再加一層等於同一件事做兩次。 */
    function openTest() {
      if (freePassed) return;
      freePassed = true;
      if (mode === 'compare' || !global.LABTEST) { finishAll(); return; }
      lvNow = 1;
      aidN = TESTS[mode] ? TESTS[mode].worstSize : 0; aidC = 0;
      render();
      /* ⚠️ 一定要講明這是**通關條件**。
         2026-08-17 老師試跑時卡住：自由玩走了三次還是不能往下一步，
         因為放行的開關（onPass）只在挑戰第 3 關答對時才會被扳動 ——
         而畫面上從來沒說過「三關全過才放行」。
         學生只會以為系統壞了，然後一直重玩自由玩那一段。 */
      say('good', '自由玩的部分過了 ✔<br><b>接下來是驗收挑戰</b> —— 三關，一關一顆星。' +
                  '<br>⚠️ <b>三關全過</b>才能進入下一步（實作測試）。');
    }
    function finishAll() {
      if (passed) return;
      passed = true;
      if (opts.onPass) opts.onPass(stars());
    }
    function stars() {
      return global.LABTEST ? global.LABTEST.starsOf(cleared) : 0;
    }
    function say2(extra) {
      var m = host.querySelector('#qs-msg');
      if (m) m.innerHTML += '<br>· ' + extra;
    }

    return {
      destroy: function () { host.innerHTML = ''; },
      _state: function () {
        return { items: items, target: target, next: next, tried: tried,
                 lo: lo, hi: hi, phase: phase, mid: mid,
                 size: size, left: left, cuts: cuts, table: table,
                 ended: ended, sawHit: sawHit, sawMiss: sawMiss, passed: !!passed };
      }
    };
  }

  global.SEARCHLAB = {
    VERSION: VERSION,
    INFO: INFO,
    mount: mount,
    _checkSequential: checkSequential,
    _stepResult: stepResult,
    _countSequential: countSequential,
    _midOf: midOf,
    _checkMid: checkMid,
    _sideOf: sideOf,
    _narrow: narrow,
    _empty: empty,
    _countBinary: countBinary,
    _demoSteps: demoSteps,
    TESTS: TESTS,
    /**
     * 這一步的「目標」與「過關標準」（關卡頁畫在最前面那條橫幅）。
     * ★ 為什麼寫在模組裡，不寫在關卡頁
     *   通過條件本來就是模組自己決定的（見 openTest／finishAll）。
     *   關卡頁再抄一份的話，改了一邊另一邊不會跟 ——
     *   而學生看到的是關卡頁那一份，也就是**錯的那一份**。
     * ⚠️ 2026-08-17 老師卡在第 9 關就是因為畫面上沒寫通過條件。
     */
    goal: function (lab) {
      var m = (lab && lab.mode) || 'sequential';
      if (m === 'compare') {
        return { why: '循序和二元到底差多少？用**同一批資料**跑兩種搜尋，' +
                      '資料愈多差距愈明顯 —— 這一步是要你親眼看到那個差距。',
                 pass: '四種資料量（13、50、100、1024 筆）**全部**跑過一次。' };
      }
      var name = INFO[m].name;
      return {
        why: '照著' + name + '的規則走一遍。' +
             '等一下概念檢測問的「為什麼不能跳」「找不到怎麼結束」，' +
             '都是你在這裡被擋過、走完過才答得出來的。',
        pass: '① 自由玩：<b>找得到</b>和<b>找不到</b>各走一次' +
              '（找不到那一種才看得出迴圈為什麼需要結束條件）<br>' +
              '② 驗收挑戰 <b>三關全過</b>：預測次數 → 零失誤 → 最壞情況'
      };
    },
    _realCount: realCount,
    _afterCut: afterCut,
    _worstBinary: worstBinary,
    _worstSequential: worstSequential,
    SIZES: SIZES,
    _makeCase: makeCase,
    _isSorted: isSorted
  };
})(typeof window !== 'undefined' ? window : this);
