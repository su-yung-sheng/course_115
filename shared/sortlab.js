/* =====================================================================
   排序實驗室（第 6、7 關）：手動挑戰 ＋ 30 筆自動播放
   ---------------------------------------------------------------------
   ★ 來歷
     這兩樣原本都在 11502/sort.html（一支獨立的「排序大冒險」頁面）。
     2026-08-07 先把手動挑戰抽出來共用；
     2026-08-12 再把自動排序動畫改寫進來，然後**刪掉 sort.html**。
     ⚠️ 中間一度是把整支 sort.html 用 iframe 嵌進關卡 ——
        那不叫整合，只是把它藏起來：用詞、判定、畫面都還是兩套。
        真正的整合是「挑出對得上課本的那一段，用系統自己的樣子重寫」。

   ★ 選擇排序法跟課本走：兩個清單
     原本 sort.html 的選擇排序是「和邊界那一格對調」（原地交換），
     課本（翰林 114 資科 2 下 6-2）是
       從「未排序」找到最小值 → 加到「已排序」的最後一項 → 從未排序刪掉。
     兩種都叫選擇排序法，但寫成 Scratch 積木完全不同。
     學生玩的、課本寫的、第 6 關要拼的必須是同一件事，
     所以這裡一律照課本。

     （氣泡與插入兩種本來就和課本一致，維持原樣。）

   用法：
     SORTLAB.mount(host, { mode:'selection', order:'asc', items:[...], onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-07-sortlab';

  /* ── 規則（純函式，沒有畫面，可以單獨測）───────────── */

  /** 由小到大就找最小、由大到小就找最大 */
  function bestOf(list, order) {
    if (!list.length) return [];
    var vals = list.map(Number);
    var m = (order === 'desc') ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    var out = [];
    vals.forEach(function (v, i) { if (v === m) out.push(i); });
    return out;                       // 並列的都算對
  }

  /**
   * 選擇排序（課本版）：從未排序挑一個搬到已排序的最後面。
   * ★ 錯的時候不講正確位置 —— 講了，下一回合他照樣不會找。
   */
  function checkSelection(unsorted, i, order) {
    if (!unsorted.length) return { ok: false, msg: '沒有東西可以挑了。' };
    if (bestOf(unsorted, order).indexOf(i) >= 0) return { ok: true, msg: '' };
    return { ok: false,
             msg: '你選的是 ' + unsorted[i] + '，但未排序裡還有更' +
                  (order === 'desc' ? '大' : '小') + '的 —— 再看一次。' };
  }

  /**
   * 氣泡排序：只能交換「相鄰」的兩個。
   * ★ 只擋「不相鄰」，不擋「換了沒有變好」——
   *   換錯方向讓資料變亂，本來就是學生該自己看見的事。
   */
  function checkBubble(a, b) {
    if (a === b) return { ok: false, msg: '要選兩個不同的。' };
    if (Math.abs(a - b) !== 1) {
      return { ok: false, msg: '氣泡排序只能交換<b>相鄰</b>的兩個 —— 你選的這兩個中間還隔著別人。' };
    }
    return { ok: true, msg: '' };
  }

  /**
   * 插入排序：把邊界上那一張「新牌」插進左邊已排好的位置。
   * pos = 要插到第幾格（0 ～ boundary）
   */
  function checkInsertion(arr, boundary, pos, order) {
    if (pos > boundary) return { ok: false, msg: '新牌只能往<b>左邊已排好</b>的那一段插。' };
    var v = Number(arr[boundary]);
    var left = pos > 0 ? Number(arr[pos - 1]) : null;
    var right = pos < boundary ? Number(arr[pos]) : null;
    var okL = left === null || (order === 'desc' ? left >= v : left <= v);
    var okR = right === null || (order === 'desc' ? v >= right : v <= right);
    if (okL && okR) return { ok: true, msg: '' };
    if (!okL) {
      return { ok: false, msg: '插在這裡的話，左邊的 ' + left + ' 會排在 ' + v + ' 的' +
                              (order === 'desc' ? '前面 —— 但它比較小。' : '前面 —— 但它比較大。') };
    }
    return { ok: false, msg: '再往' + (order === 'desc' ? '左' : '左') + '一點 —— 右邊的 ' + right +
                            (order === 'desc' ? ' 比它大。' : ' 比它小。') };
  }

  /** 插入排序：把第 from 張抽出來插到第 pos 格 */
  function doInsert(arr, from, pos) {
    var out = arr.slice();
    var v = out.splice(from, 1)[0];
    out.splice(pos, 0, v);
    return out;
  }

  function sorted(arr, order) {
    for (var i = 1; i < arr.length; i++) {
      if (order === 'desc' ? Number(arr[i - 1]) < Number(arr[i])
                           : Number(arr[i - 1]) > Number(arr[i])) return false;
    }
    return true;
  }

  /** 隨機出題 —— 一開始就排好的話等於白玩，所以排好了就重抽 */
  function makeItems(n, order) {
    n = n || 6;
    for (var t = 0; t < 30; t++) {
      var a = [];
      var seen = {};
      while (a.length < n) {
        var v = 10 + Math.floor(Math.random() * 90);
        if (!seen[v]) { seen[v] = 1; a.push(v); }   // 不重複，免得「最小的是誰」有兩個答案
      }
      if (!sorted(a, order)) return a;
    }
    return [42, 17, 93, 28, 61, 35];
  }

  /* ── 自動播放：30 筆資料跑一遍 ─────────────────────
     ★ 為什麼手動之外還要有這個
       手動只排得動六個 —— 而六個排起來一點都不費力，
       學生不會覺得「排序很花時間」。
       課本 p.12 的教學叮嚀就建議用動畫讓學生對大量資料有感。
       ⇒ 30 筆自動跑一遍，而且**把比較次數印出來**。
         那個數字接得上第 10 關的搜尋大比拼 ——
         排序與搜尋都在問同一件事：資料變多的時候，要比幾次？

     ★ 為什麼先算好每一格畫面，再播
       原本 sort.html 是把 await sleep() 混在演算法裡 ——
       演算法和動畫綁在一起，就沒辦法單獨測「它排得對不對」。
       ⇒ plan() 是純函式：吃一個陣列，吐出每一步的畫面。
         播放器只負責一格一格放。演算法對不對，測試裡直接驗。

     一格畫面（frame）：
       arr      這一刻的排列
       cmp      這一刻正在比的兩個位置（畫成高亮）
       best     目前找到的最小值位置（只有選擇排序用）
       done     第 done 項之前都排好了（畫成綠色）
       n        到這一刻為止比了幾次 */
  function plan(items, mode, order) {
    var a = items.slice().map(Number), n = a.length, frames = [], cmp = 0;
    /* ★ 每一格都要帶一句「這一步發生了什麼」。
       ⚠️ 只有動畫沒有解說的話，學生看到的是一堆長條在跳 ——
          他知道「有事情在發生」，但不知道發生的是什麼。
          按「下一步」慢慢看的人，讀的就是這一句。 */
    function shot(c, best, done, note) {
      frames.push({ arr: a.slice(), cmp: c || null,
                    best: (best == null ? null : best), done: done || 0,
                    n: cmp, note: note || '' });
    }
    var better = function (x, y) {
      return order === 'desc' ? x > y : x < y;
    };
    var W = (order === 'desc') ? '大' : '小';       // 由大到小就是找最大
    var no = function (i) { return i + 1; };        // 畫面上用第幾項（1 起算）

    if (mode === 'bubble') {
      shot(null, null, 0, '氣泡排序：從頭開始，每次比<b>相鄰</b>的兩個。');
      for (var i = 0; i < n - 1; i++) {
        for (var j = 0; j < n - 1 - i; j++) {
          cmp++;
          shot([j, j + 1], null, i ? n - i : 0,
               '比第 ' + no(j) + '、' + no(j + 1) + ' 項（' + a[j] + ' 和 ' + a[j + 1] + '）。');
          if (better(a[j + 1], a[j])) {
            var big = a[j], small = a[j + 1];
            var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
            shot([j, j + 1], null, i ? n - i : 0,
                 '順序不對 —— ' + small + ' 比 ' + big + W + '，<b>交換</b>。');
          } else {
            frames[frames.length - 1].note +=
              ' 順序本來就對，<b>不用換</b>。';
          }
        }
        shot(null, null, n - 1 - i,
             '跑完第 ' + (i + 1) + ' 回合 —— 最' + (order === 'desc' ? '小' : '大') +
             '的那個已經被推到<b>最後面</b>，之後不必再看它。');
      }
    } else if (mode === 'insertion') {
      shot(null, null, 1, '插入排序：左邊那一段當成「已經排好的手牌」，' +
                          '每次<b>抽一張新牌</b>插進去。');
      for (var k = 1; k < n; k++) {
        var key = a[k], p = k - 1;
        shot([k, k], null, k, '抽第 ' + no(k) + ' 張牌：<b>' + key + '</b>。' +
                              '要把它插進左邊那 ' + k + ' 張裡。');
        while (p >= 0) {
          cmp++;
          shot([p, k], null, k,
               '和左邊的 ' + a[p] + ' 比：' +
               (better(key, a[p]) ? '<b>' + key + ' 比較' + W + '</b>，' + a[p] + ' 要往右讓一格。'
                                  : '<b>' + key + ' 沒有比較' + W + '</b> —— 位置就在這裡，停。'));
          if (!better(key, a[p])) break;
          a[p + 1] = a[p]; p--;
          shot([p + 1, k], null, k, a[p + 2] + ' 往右移了一格，空出位子。');
        }
        a[p + 1] = key;
        shot(null, null, k + 1, '<b>' + key + '</b> 插進第 ' + no(p + 1) + ' 個位置。' +
                                '左邊 ' + (k + 1) + ' 張現在都排好了。');
      }
    } else {
      /* 選擇排序照課本的兩清單版：從未排序找最小 → 搬到已排序的最後一項。
         畫面上已排好的留在左邊不動，未排序的整段往左遞補。 */
      shot(null, null, 0, '選擇排序：每一回合從<b>還沒排好</b>的那一段裡挑出最' + W + '的。');
      for (var s = 0; s < n; s++) {
        var best = s;
        shot(null, best, s, '第 ' + (s + 1) + ' 回合開始。先假設第 ' + no(s) +
                            ' 項（' + a[s] + '）最' + W + '。');
        for (var q = s + 1; q < n; q++) {
          cmp++;
          var hit = better(a[q], a[best]);
          shot([q, best], best, s,
               '拿第 ' + no(q) + ' 項（' + a[q] + '）和目前最' + W + '的第 ' + no(best) +
               ' 項（' + a[best] + '）比 —— ' +
               (hit ? '<b>更' + W + '了，換人。</b>' : '沒有更' + W + '，不換。'));
          if (hit) { best = q; shot([q, best], best, s,
               '目前最' + W + '的換成第 ' + no(best) + ' 項（' + a[best] + '）。'); }
        }
        var v = a.splice(best, 1)[0];
        a.splice(s, 0, v);
        shot(null, null, s + 1,
             '整段看完了，最' + W + '的是 <b>' + v + '</b> —— ' +
             '把它搬到已排好那一段的<b>最後面</b>，並從未排序刪掉。');
      }
    }
    shot(null, null, n, '沒有東西可以挑了 —— <b>排好了</b>。總共比了 ' + cmp + ' 次。');
    return { frames: frames, compares: cmp };
  }

  /* ── 變數追蹤：電腦怎麼找出最小值 ───────────────────
     ★ 玩法來自 11502/search.html（逐步執行＋程式碼行高亮＋變數面板）。
       但那一頁追的是「找最大值」，和課本對不上 ——
       ⇒ 玩法留下來，內容換成課本備課用書 p.193／p.198 的
         「找出最小值位置」副程式（資料位置／最小值位置）。
       課本那張「第一次～第五次」的比對表，這裡是一步一步走出來的。

     ★ 為什麼第 6 關特別需要這個
       手動挑戰時學生是「用眼睛挑最小的」——
       他做得到，但那不是電腦做的事。
       這一段把同一件事拆成電腦的動作：兩個變數、一次比一個。
       ⇒ 接下來的拼圖要拼的正是這段程式。

     一步（step）：
       line  這一步在跑程式的第幾行（畫面上高亮那一行）
       dp    資料位置
       mp    最小值位置
       note  這一步發生了什麼（課本用詞）
       cmp   這一步有沒有做比較（拿來數比較次數） */
  var TRACE_CODE = [
    '定義 找出最小值位置',
    '　變數 資料位置 設為 1',
    '　變數 最小值位置 設為 1',
    '　重複 清單 原始資料 的長度 次',
    '　　如果 第(資料位置)項 < 第(最小值位置)項 那麼',
    '　　　變數 最小值位置 設為 資料位置',
    '　　變數 資料位置 改變 1'
  ];

  function traceMin(items, order) {
    var a = items.map(Number), n = a.length, steps = [], cmp = 0;
    var better = function (x, y) { return order === 'desc' ? x > y : x < y; };
    var word = (order === 'desc') ? '大' : '小';

    steps.push({ line: 1, dp: 1, mp: null, cmp: false,
                 note: '資料位置設為 1 —— 從第 1 項開始看。' });
    steps.push({ line: 2, dp: 1, mp: 1, cmp: false,
                 note: '最小值位置也設為 1 —— 先假設第 1 項最' + word + '。' });
    for (var i = 1, mp = 1; i <= n; i++) {
      cmp++;
      var hit = (i !== mp) && better(a[i - 1], a[mp - 1]);
      steps.push({ line: 4, dp: i, mp: mp, cmp: true,
                   note: '第 ' + i + ' 項是 ' + a[i - 1] + '，目前最' + word +
                         '的是第 ' + mp + ' 項（' + a[mp - 1] + '）—— ' +
                         (i === mp ? '就是它自己，不必比。'
                                   : (hit ? '比較' + word + '，換人。'
                                          : '沒有比較' + word + '，維持不變。')) });
      if (hit) {
        mp = i;
        steps.push({ line: 5, dp: i, mp: mp, cmp: false,
                     note: '最小值位置改成第 ' + mp + ' 項。' });
      }
      steps.push({ line: 6, dp: i + 1, mp: mp, cmp: false,
                   note: '資料位置往下一格 → 第 ' + (i + 1) + ' 項。' });
    }
    var last = steps[steps.length - 1];
    steps.push({ line: 3, dp: last.dp, mp: last.mp, cmp: false, done: true,
                 note: '每一項都看過了。最' + word + '的在第 ' + last.mp +
                       ' 項，數字是 ' + a[last.mp - 1] + '。' });
    return { steps: steps, compares: cmp, at: last.mp, value: a[last.mp - 1] };
  }

  /* ── 驗收挑戰的三關（第 6、7 關）───────────────────
     ⚠️ 排序的「次數」和搜尋不一樣：手動挑戰是一回合挑一個，
        不是一次一次比。所以第 1 關問的是
        「這一組資料用這個排序法**總共**要比幾次」——
        而答案就在下面的自動播放裡，他可以自己按來驗證。
        ★ 預測 → 自己驗證，比我直接給答案有用得多。

     ⭐   預測：這一組（6 筆）要比幾次
     ⭐⭐  零失誤：換一題手動排完，全程不能點錯
     ⭐⭐⭐ 最壞情況：10 筆要比幾次（n×(n−1)÷2 = 45）
          ⚠️ 不必教公式。選擇與氣泡每一對都要比一次，
             10 個裡任兩個配對就是 45 —— 數得出來。 */
  var TESTS = {
    worstSize: 10,
    worstAsk: '一組有 <b>10</b> 筆資料。用<b>選擇排序法</b>把它排好，' +
              '總共要比幾次？',
    worstWhy: '選擇排序每一輪都要把剩下的全部看一遍：9＋8＋7＋…＋1 ＝ 45 次。' +
              '（也就是「10 個裡任兩個配對」的數目。）',
    worstAns: function (n) { return n * (n - 1) / 2; }
  };

  /* ── 三種排序法的說明（沿用 sort.html 原本的文案）───── */
  var INFO = {
    selection: {
      name: '選擇排序法', icon: '🎯',
      rule: '每一回合從<b>未排序</b>裡點出最小的，它會被搬到<b>已排序</b>的最後一項。',
      why: '反覆從未排序數列中找出「最小值」，把它加到已排序數列的最後一項，' +
           '再從未排序數列裡刪掉。重複到未排序清空為止。',
      /* ⚠️ 生活案例照課本 6-2（華森向麗娜學理牌的兩種方法）。
         原本這裡寫的是「整理書箱」—— 我自己編的，課本沒有。
         ★ 兩種排序法要用**同一個情境**才看得出差別，
           那正是課本用同一副撲克牌示範兩次的用意。 */
      life: '理牌方法一：在翻開的所有牌裡找出最小的那張，抽出來排好；'
          + '再從剩下的裡面找最小的，接在後面。'
    },
    bubble: {
      name: '氣泡排序法', icon: '🫧',
      rule: '只能交換<b>相鄰</b>的兩個。點一個，再點它旁邊那個。',
      why: '從第一筆開始，逐一比較相鄰兩筆，順序有誤就交換。' +
           '跑完一回合，最後一筆一定就位。',
      life: '體育課排隊，老師說「看旁邊的同學，比較高的往後站」，大家兩兩互換。'
    },
    insertion: {
      name: '插入排序法', icon: '🃏',
      rule: '點<b>橘框</b>那張新牌，再點左邊已排好的那一段裡<b>該插進去的位置</b>。',
      why: '逐一把新資料插進已排序好的資料中：和前面已排好的一一比較，找到對的位置插入。',
      /* 課本 6-2 的理牌方法二 —— 和選擇排序同一副牌，差別才看得出來。 */
      life: '理牌方法二：蓋著的牌堆每次抽一張，'
          + '直接插進手上已經排好的牌裡該去的位置。'
    }
  };

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.sl{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.sl-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.sl-tip b{color:#4338ca}',
    '.sl-sub{font-size:12.5px;color:#64748b;line-height:1.85;margin-top:6px}',
    '.sl-round{font-size:12.5px;font-weight:900;color:#6366f1;margin:10px 0 6px}',
    '.sl-row{display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap}',
    '.sl-tag{font-size:11px;font-weight:700;color:#64748b;min-width:52px}',
    '.sl-cell{min-width:44px;padding:9px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;color:#334155;',
    '  cursor:pointer;transition:.12s}',
    '.sl-cell:hover{border-color:#6366f1;background:#eef2ff}',
    /* ⚠️ 這四條的**順序就是規則**（同權重，後面的贏）。
       2026-08-12 踩到：原本 .card 排在 .sel 後面 ——
       學生點下「橘框那張新牌」，畫面除了浮起 3px 之外**什麼都沒變**，
       因為 .card 的橘色又把 .sel 的靛藍蓋回去了。
       說明寫著「點橘框那張」，他點了卻看不出有沒有點到。
       ⇒ 正確順序：已排好 → 橘框（這一張要處理）→ 點選中 → 出錯閃爍。
          出錯一定要排最後，不然閃爍會被別的狀態蓋掉。 */
    '.sl-cell.done{border-color:#34d399;background:#dcfce7;color:#166534;cursor:default}',
    '.sl-cell.done:hover{background:#dcfce7}',
    /* 橘框＝這一回合要處理的那一張新牌（INFO.insertion.rule 講的就是它） */
    '.sl-cell.card{border-color:#f97316;background:#fff7ed;color:#9a3412}',
    '.sl-cell.sel{border-color:#6366f1;background:#e0e7ff;color:#3730a3;transform:translateY(-3px)}',
    /* ⚠️ 出錯用**紅色**，不要用琥珀色 —— 琥珀和橘框太像，
       學生會分不出「這是要處理的那張」和「你點錯了」。 */
    '.sl-cell.bad{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    '.sl-slot{width:16px;height:38px;border:2px dashed #cbd5e1;border-radius:6px;',
    '  background:transparent;cursor:pointer;padding:0}',
    '.sl-slot:hover{border-color:#6366f1;background:#eef2ff}',
    '.sl-empty{font-size:12px;color:#cbd5e1}',
    '.sl-msg{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.sl-msg.good{background:#dcfce7;color:#166534}',
    '.sl-msg.bad{background:#fef3c7;color:#92400e}',
    '.sl-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.sl-btn:hover{background:#4f46e5}',
    /* 自動播放 */
    '.sl-auto{margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:14px}',
    '.sl-auto h4{font-size:14px;font-weight:900;color:#4338ca;margin:0 0 4px}',
    '.sl-auto .lead{font-size:12.5px;color:#64748b;line-height:1.8;margin-bottom:10px}',
    '.sl-bars{display:flex;align-items:flex-end;gap:2px;height:150px;',
    '  background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px}',
    '.sl-bar{flex:1;background:#c7d2fe;border-radius:2px 2px 0 0;transition:height .06s}',
    '.sl-bar.cmp{background:#f59e0b}',      /* 正在比的兩個 */
    '.sl-bar.best{background:#ef4444}',     /* 目前最小的 */
    '.sl-bar.ok{background:#34d399}',       /* 已經排好的 */
    '.sl-ctrl{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:9px}',
    '.sl-ctrl button{background:#fff;border:2px solid #cbd5e1;color:#334155;border-radius:8px;',
    '  padding:5px 11px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.sl-ctrl button:hover{border-color:#6366f1;background:#eef2ff}',
    '.sl-ctrl button.on{border-color:#6366f1;background:#e0e7ff;color:#4338ca}',
    '.sl-ctrl .num{font-size:12.5px;color:#4338ca;font-weight:900;margin-left:auto}',
    '.sl-ctrl .num b{font-size:16px}',
    /* 解說列：固定高度，不然按「下一步」整頁會彈 */
    '.sl-say{background:#eef2ff;border:1px solid #c7d2fe;border-radius:9px;',
    '  padding:9px 12px;margin-top:9px;font-size:13px;line-height:1.8;',
    '  color:#3730a3;min-height:46px}',
    '.sl-say b{color:#4338ca}',
    /* 變數追蹤（玩法沿用 search.html：程式碼行高亮＋變數面板＋逐步執行） */
    '.sl-tr{margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:14px}',
    '.sl-tr h4{font-size:14px;font-weight:900;color:#0f766e;margin:0 0 4px}',
    '.sl-tr .lead{font-size:12.5px;color:#64748b;line-height:1.8;margin-bottom:10px}',
    '.sl-var{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px}',
    '.sl-var span{background:#f0fdfa;border:2px solid #5eead4;border-radius:9px;',
    '  padding:5px 12px;font-size:13px;font-weight:700;color:#0f766e}',
    '.sl-var span b{font-size:16px;color:#0d9488}',
    '.sl-code{background:#0f172a;border-radius:10px;padding:9px 4px;margin:9px 0;',
    '  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.85}',
    '.sl-code div{color:#94a3b8;padding:1px 10px;white-space:pre-wrap;border-radius:4px}',
    '.sl-code div.now{background:#134e4a;color:#5eead4;font-weight:700}',
    '.sl-cell.dp{border-color:#0d9488;background:#ccfbf1;color:#0f766e}',
    '.sl-cell.mp{border-color:#ef4444;background:#fee2e2;color:#991b1b}',
    '.sl-note{font-size:12.5px;line-height:1.8;padding:8px 11px;border-radius:9px;',
    '  background:#f0fdfa;color:#0f766e;margin-top:8px}',
    /* ── 放大版（關卡頁的「動手試一次」那一步）───────── */
    '.sl-big .sl-cell{min-width:62px;padding:15px 16px;font-size:21px;border-width:3px}',
    '.sl-big .sl-slot{width:22px;height:56px}',
    '.sl-big .sl-row{gap:10px;margin-bottom:12px}',
    '.sl-big .sl-tag{font-size:13px;min-width:64px}',
    '.sl-big .sl-round{font-size:14.5px}',
    '.sl-big .sl-tip{font-size:14.5px;padding:14px 17px}',
    '.sl-big .sl-sub{font-size:13.5px}',
    '.sl-big .sl-msg{font-size:15px;padding:12px 15px;min-height:50px}',
    '.sl-big .sl-btn{padding:11px 20px;font-size:15px}',
    /* 自動播放的長條圖：150 → 300，資料量大的時候差距才看得出來 */
    '.sl-big .sl-bars{height:300px;padding:12px;gap:3px}',
    '.sl-big .sl-auto h4{font-size:16px}',
    '.sl-big .sl-auto .lead{font-size:13.5px}',
    '.sl-big .sl-ctrl button{padding:8px 15px;font-size:14px}',
    '.sl-big .sl-ctrl .num{font-size:14.5px}',
    '.sl-big .sl-ctrl .num b{font-size:22px}',
    '.sl-big .sl-say{font-size:15px;padding:12px 16px;min-height:58px}',
    /* 變數追蹤：程式碼要看得清楚，它等一下就是要拼的那一段 */
    '.sl-big .sl-tr h4{font-size:16px}',
    '.sl-big .sl-tr .lead{font-size:13.5px}',
    '.sl-big .sl-code{font-size:14.5px;padding:13px 6px}',
    '.sl-big .sl-code div{padding:3px 14px}',
    '.sl-big .sl-var span{padding:8px 16px;font-size:14.5px}',
    '.sl-big .sl-var span b{font-size:21px}',
    '.sl-big .sl-note{font-size:14.5px;padding:12px 15px;min-height:48px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('sl-style')) return;
    var s = document.createElement('style');
    s.id = 'sl-style';
    /* 挑戰與證書的樣式在 shared/labtest.js —— 三支實驗室共用一份。 */
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
    var mode = opts.mode || 'selection';
    var order = opts.order || 'asc';
    var info = INFO[mode] || INFO.selection;

    var items = (opts.items && opts.items.length) ? opts.items.slice() : makeItems(opts.size || 6, order);
    var unsorted = items.slice(), done = [];        // 選擇排序用
    var arr = items.slice(), boundary = 1, sel = null;  // 氣泡／插入用
    var round = 0, passed = false;
    /* ── 驗收挑戰（手動排完才開）─────────────────
       ★ 「排得完」只證明他會操作。真正的證據是
         他能不能在動手之前說出「這一組要比幾次」。
       三個難度的定義在 shared/labtest.js（三支實驗室共用）。 */
    var freePassed = false, lvNow = 0, cleared = {}, guess = null, errs = 0;
    var testMsg = '', testKind = 'info';
    /* 自動播放的狀態。
       ⚠️ 一定要在 render() 之前宣告 —— render() 會叫 auto()，
          而 var 只提升宣告不提升賦值，放在後面的話 algo 會是 undefined。 */
    var pl = null, at = 0, timer = null, algo = mode, speed = 60;

    host.className = 'sl' + (opts.big ? ' sl-big' : '');
    render();

    function render() {
      round++;
      host.innerHTML =
        '<div class="sl-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="sl-sub">📝 ' + info.why + '<br>🎒 ' + info.life + '</div></div>' +
        '<div id="sl-body"></div>' +
        '<div id="sl-msg"></div>' +
        (opts.newRound !== false ? '<button class="sl-btn" id="sl-new">🎲 換一題</button>' : '') +
        '<div id="sl-test"></div>' +
        '<div id="sl-trace"></div>' +
        '<div id="sl-auto"></div>';
      body();
      test();
      trace();
      auto();
      var nb = host.querySelector('#sl-new');
      if (nb) nb.onclick = function () {
        items = makeItems(opts.size || 6, order);
        unsorted = items.slice(); done = []; arr = items.slice();
        boundary = 1; sel = null; round = 0;
        /* ⚠️ 挑戰開著的時候不要把 passed 清掉 ——
           清掉的話 finish() 會再跑一次 openTest()，挑戰就被重置了。 */
        if (!lvNow) passed = false;
        errs = 0;                    // 新的一題，失誤重新算
        render();
      };
    }

    function body() {
      var b = host.querySelector('#sl-body');
      if (mode === 'selection') b.innerHTML = selHtml(); else b.innerHTML = lineHtml();
      [].forEach.call(b.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { click(Number(el.dataset.i), el); };
      });
      [].forEach.call(b.querySelectorAll('[data-slot]'), function (el) {
        el.onclick = function () { slot(Number(el.dataset.slot)); };
      });
    }

    function selHtml() {
      return '<div class="sl-round">第 ' + round + ' 回合</div>' +
        row('未排序', unsorted, true) + row('已排序', done, false);
    }
    function row(tag, list, live) {
      return '<div class="sl-row"><span class="sl-tag">' + tag + '</span>' +
        (list.length
          ? list.map(function (v, i) {
              return '<button class="sl-cell' + (live ? '' : ' done') + '"' +
                (live ? ' data-i="' + i + '"' : '') + '>' + esc(v) + '</button>';
            }).join('')
          : '<span class="sl-empty">（空的）</span>') + '</div>';
    }

    /* 氣泡與插入：一整排，插入模式在已排好的那一段之間放插入點 */
    function lineHtml() {
      var out = '<div class="sl-row">';
      arr.forEach(function (v, i) {
        if (mode === 'insertion' && i <= boundary - 1) {
          out += '<button class="sl-slot" data-slot="' + i + '" title="插在這裡"></button>';
        }
        var cls = 'sl-cell';
        if (mode === 'insertion') {
          if (i < boundary) cls += ' done';
          else if (i === boundary) cls += ' card';
        }
        if (sel === i) cls += ' sel';
        out += '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button>';
      });
      if (mode === 'insertion' && boundary > 0) {
        out += '<button class="sl-slot" data-slot="' + boundary + '" title="插在這裡"></button>';
      }
      return out + '</div>';
    }

    function say(ok, msg) {
      var m = host.querySelector('#sl-msg');
      m.className = 'sl-msg ' + (ok ? 'good' : 'bad');
      m.innerHTML = (ok ? '✓ ' : '✗ ') + msg;
    }
    function flash(el) {
      errs++;                     // 零失誤那一關要數
      if (!el) return;
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 650);
    }
    function finish() {
      /* 挑戰第 2 關（零失誤）：排完這一題就結算。 */
      if (lvNow === 2) {
        if (errs === 0) {
          cleared[2] = true; lvNow = 3;
          tsay('good', '整題零失誤 ⭐⭐<br>最後一關：不必真的排，直接算給我看。');
        } else {
          tsay('bad', '這一題點錯了 ' + errs + ' 次。按「🎲 換一題」再挑戰一次。');
        }
        return;
      }
      if (passed) return;
      passed = true;
      say(true, '排好了！' + info.why);
      trace(); auto();             // ★ 通關才出現這兩區，這裡要重畫一次
      openTest();
    }

    function click(i, el) {
      if (mode === 'selection') {
        var r = checkSelection(unsorted, i, order);
        if (!r.ok) { flash(el); say(false, r.msg); return; }
        done.push(unsorted.splice(i, 1)[0]);
        if (unsorted.length) {
          say(true, '把 ' + done[done.length - 1] + ' 加到「已排序」的最後一項，並從「未排序」刪掉。');
          body();
        } else { body(); finish(); }
        return;
      }
      if (mode === 'bubble') {
        if (sel === null) { sel = i; body(); return; }
        var rb = checkBubble(sel, i);
        if (!rb.ok) { flash(el); say(false, rb.msg); sel = null; body(); return; }
        var t = arr[sel]; arr[sel] = arr[i]; arr[i] = t;
        sel = null; body();
        if (sorted(arr, order)) finish(); else say(true, '交換了。');
        return;
      }
      // insertion：只能點橘框那一張
      if (i !== boundary) {
        flash(el);
        say(false, '這一回合要處理的是<b>橘框</b>那一張新牌。');
        return;
      }
      sel = i; body();
      say(true, '選好了。現在點左邊要插進去的位置（虛線框）。');
    }

    function slot(pos) {
      if (mode !== 'insertion') return;
      if (sel === null) { say(false, '先點橘框那張新牌。'); return; }
      var r = checkInsertion(arr, boundary, pos, order);
      if (!r.ok) { say(false, r.msg); return; }
      arr = doInsert(arr, boundary, pos);
      sel = null; boundary++;
      body();
      if (boundary >= arr.length) finish();
      else say(true, '插好了。換下一張新牌。');
    }

    /* ── 驗收挑戰 ──────────────────────────────────
       ★ 手動排完才開。三關，一關一顆星。
       ⚠️ 第 1 關的答案就在下面的自動播放裡 ——
          預測完自己按來驗證，比我直接給答案有用得多。 */
    function openTest() {
      if (freePassed) return;
      freePassed = true;
      if (!global.LABTEST) { finishAll(); return; }
      lvNow = 1;
      render();
    }
    function finishAll() {
      if (opts.onPass) opts.onPass(stars());
    }
    function stars() { return global.LABTEST ? global.LABTEST.starsOf(cleared) : 0; }

    function test() {
      var box = host.querySelector('#sl-test');
      if (!box) return;
      if (!lvNow) { box.innerHTML = ''; return; }
      if (lvNow > 3) {
        box.innerHTML = global.LABTEST.certificate(3, { title: info.name + '　驗收挑戰' });
        return;
      }
      var L = global.LABTEST.LEVELS[lvNow - 1];
      var head = '<div class="lt-box"><div class="h">' + L.icon +
                 ' 驗收挑戰 ' + lvNow + '／3　' + L.name + '（目前 ' + stars() + ' ★）</div>';
      if (lvNow === 1) {
        box.innerHTML = head +
          '<div class="q">上面那 <b>' + items.length + '</b> 筆資料，用<b>' + info.name +
          '</b>排好，總共要<b>比幾次</b>？' +
          '<br><span style="font-size:12.5px">想不出來？下面的自動播放會幫你數 ——' +
          '但先自己猜一個。</span></div>' +
          '<div class="row"><input id="sl-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="1">送出預測</button></div></div>';
      } else if (lvNow === 2) {
        box.innerHTML = head +
          '<div class="q">按「🎲 換一題」拿一組新的，<b>全程不能點錯</b>。' +
          '<br>目前這一題已經錯了 <b>' + errs + '</b> 次。</div></div>';
      } else {
        box.innerHTML = head +
          '<div class="q">' + TESTS.worstAsk +
          '<br><span style="font-size:12.5px">這一關<b>不必真的排</b> ——' +
          '想想每一輪要看幾個。</span></div>' +
          '<div class="row"><input id="sl-g" type="number" min="1" placeholder="次數">' +
          '<button data-g="3">送出答案</button></div></div>';
      }
      box.innerHTML += '<div class="lt-say ' + testKind + '" id="sl-tsay">' +
                       (testMsg || '　') + '</div>';
      [].forEach.call(box.querySelectorAll('[data-g]'), function (el) {
        el.onclick = function () { submit(Number(el.dataset.g)); };
      });
    }

    function submit(which) {
      var inp = host.querySelector('#sl-g');
      var v = Number(inp && inp.value);
      if (!(v > 0)) { tsay('info', '先填一個數字。'); return; }
      if (which === 1) {
        var real = plan(items, mode, order).compares;
        if (v === real) {
          cleared[1] = true; lvNow = 2; errs = 0;
          tsay('good', '猜中了 —— 真的是 <b>' + real + '</b> 次 ⭐<br>' +
                       '下一關：按「🎲 換一題」拿一組新的，<b>全程不能點錯</b>。');
        } else {
          tsay('bad', '你猜 ' + v + '，實際是 <b>' + real + '</b> 次。' +
                      '<br>用下面的自動播放按「下一步」數一遍，看看差在哪 —— 然後再猜一次。');
        }
        return;
      }
      var want = TESTS.worstAns(TESTS.worstSize);
      if (v === want) {
        cleared[3] = true; lvNow = 4;
        tsay('good', '對了 —— <b>' + want + '</b> 次。' + TESTS.worstWhy +
                     '<br>三關全過，證書拿到了 ★★★');
        render(); finishAll();
      } else {
        tsay('bad', '不是 ' + v + ' 次。' + TESTS.worstWhy + '<br>再想一次。');
      }
    }
    function tsay(kind, msg) { testKind = kind; testMsg = msg; render(); }

    /* ── 變數追蹤區（只有第 6 關開）─────────────────
       ★ 位置在「手動」和「自動」中間，順序是刻意的：
         你剛才用眼睛挑最小的 → 電腦怎麼挑 → 30 筆跑一遍。
       ⚠️ 一樣要通關才出現。還沒自己挑過就先看程式，
          他看到的只是一段沒有來由的積木。 */
    var tr = null, tAt = 0;

    function trace() {
      var box = host.querySelector('#sl-trace');
      if (!box) return;
      if (!opts.trace || !passed) { box.innerHTML = ''; return; }
      /* 用課本的那一組（8、5、10、1、7）—— 學生對得回課本 p.193 的表。 */
      if (!tr) { tr = traceMin(opts.traceItems || [8, 5, 10, 1, 7], order); tAt = 0; }
      var s = tr.steps[tAt], vals = opts.traceItems || [8, 5, 10, 1, 7];
      var last = tAt >= tr.steps.length - 1;

      box.className = 'sl-tr';
      box.innerHTML =
        '<h4>🔬 電腦是怎麼「看出」最小的那一個？</h4>' +
        '<div class="lead">你剛剛是<b>一眼</b>就挑出來的。電腦沒有眼睛 ——' +
        '它只能一次比一個，而且要用<b>兩個變數</b>記著。一步一步看下去。</div>' +
        '<div class="sl-row">' + vals.map(function (v, i) {
          var cls = 'sl-cell';
          if (s.mp === i + 1) cls += ' mp';
          else if (s.dp === i + 1) cls += ' dp';
          return '<span class="' + cls + '">' + esc(v) + '</span>';
        }).join('') + '</div>' +
        '<div class="sl-var">' +
        '<span>資料位置 <b>' + (s.dp > vals.length ? '—' : s.dp) + '</b></span>' +
        '<span>最小值位置 <b>' + (s.mp || '—') + '</b></span>' +
        '<span>比較次數 <b>' + tr.steps.slice(0, tAt + 1).filter(function (x) { return x.cmp; }).length + '</b></span>' +
        '</div>' +
        '<div class="sl-code">' + TRACE_CODE.map(function (t, i) {
          return '<div' + (i === s.line ? ' class="now"' : '') + '>' + esc(t) + '</div>';
        }).join('') + '</div>' +
        '<div class="sl-note">' + s.note + '</div>' +
        '<div class="sl-ctrl">' +
        (last ? '<button data-treset="1">↺ 再看一次</button>'
              : '<button data-tstep="1">▶ 下一步</button>' +
                '<button data-tall="1">⏭ 一路跑完</button>') +
        '</div>';
      var b1 = box.querySelector('[data-tstep]'), b2 = box.querySelector('[data-tall]'),
          b3 = box.querySelector('[data-treset]');
      if (b1) b1.onclick = function () { tAt++; trace(); };
      if (b2) b2.onclick = function () { tAt = tr.steps.length - 1; trace(); };
      if (b3) b3.onclick = function () { tr = null; trace(); };
    }

    /* ── 自動播放區 ────────────────────────────────
       ★ 先手動、後自動 —— 順序是刻意的。
         先看動畫的話，學生會覺得「原來這麼快」，
         然後在手動那一關卡住卻不知道自己卡在哪。
         自己排過六個之後再看 30 個跑，他看的是**自己剛做過的事**。
       ⚠️ 所以這一區在通關之前不出現。 */
    function auto() {
      var box = host.querySelector('#sl-auto');
      if (!box) return;
      if (opts.auto === false || !passed) { box.innerHTML = ''; return; }
      if (!pl) { pl = plan(makeItems(opts.autoSize || 30, order), algo, order); at = 0; }
      var f = pl.frames[at];
      box.className = 'sl-auto';
      var last = at >= pl.frames.length - 1;
      box.innerHTML =
        '<h4>📺 換 ' + f.arr.length + ' 筆資料，一步一步看它怎麼排</h4>' +
        '<div class="lead">你剛剛用手排六個。同樣的方法，' + f.arr.length + ' 筆要比幾次？' +
        '<br><b>看不懂就按「下一步」</b> —— 每一步下面都會告訴你它剛才做了什麼。' +
        '想快轉再按「自動播放」。</div>' +
        '<div class="sl-bars" id="sl-bars"></div>' +
        /* ★ 解說列。⚠️ 給固定高度 —— 文字長短不一，
           不固定的話按一下「下一步」整頁就往上下彈一格。 */
        '<div class="sl-say" id="sl-say">' + (f.note || '　') + '</div>' +
        '<div class="sl-ctrl">' +
        ['selection', 'insertion', 'bubble'].map(function (m) {
          return '<button data-algo="' + m + '"' + (m === algo ? ' class="on"' : '') + '>' +
                 INFO[m].icon + ' ' + INFO[m].name + '</button>';
        }).join('') +
        (last ? '<button data-again="1">↺ 再看一次</button>'
              : '<button data-step="1">⏭ 下一步</button>' +
                '<button data-play="1">' + (timer ? '⏸ 暫停' : '▶ 自動播放') + '</button>') +
        '<button data-new="1">🎲 換一組</button>' +
        '<span class="num">第 ' + at + ' 步　比較次數 <b>' + f.n + '</b>' +
        (last ? '　✅ 排好了' : '') + '</span></div>';
      bars(f);
      [].forEach.call(box.querySelectorAll('[data-algo]'), function (el) {
        el.onclick = function () { stop(); algo = el.dataset.algo; pl = null; auto(); };
      });
      var b;
      if ((b = box.querySelector('[data-step]'))) b.onclick = function () { stop(); step(); };
      if ((b = box.querySelector('[data-play]'))) b.onclick = toggle;
      if ((b = box.querySelector('[data-again]'))) b.onclick = function () { at = 0; auto(); };
      if ((b = box.querySelector('[data-new]'))) b.onclick = function () { stop(); pl = null; auto(); };
    }

    /* 走一步 —— 按鈕和自動播放共用同一條路，不會有兩套走法。 */
    function step() {
      if (at >= pl.frames.length - 1) return;
      at++;
      auto();
    }

    function bars(f) {
      var b = host.querySelector('#sl-bars');
      if (!b) return;
      var max = Math.max.apply(null, f.arr);
      b.innerHTML = f.arr.map(function (v, i) {
        var cls = 'sl-bar';
        if (i < f.done) cls += ' ok';
        else if (f.best === i) cls += ' best';
        else if (f.cmp && (f.cmp[0] === i || f.cmp[1] === i)) cls += ' cmp';
        return '<div class="' + cls + '" style="height:' +
               Math.round(v / max * 100) + '%"></div>';
      }).join('');
    }

    function toggle() { timer ? stop() : play(); auto(); }
    function play() {
      if (at >= pl.frames.length - 1) { at = 0; }
      timer = setInterval(function () {
        at++;
        if (at >= pl.frames.length - 1) { at = pl.frames.length - 1; stop(); auto(); return; }
        bars(pl.frames[at]);
        /* 自動播放時只換會變的那幾塊，不整段重畫 ——
           整段重畫會讓按鈕在腳下閃爍，按不準。 */
        var num = host.querySelector('.sl-ctrl .num b');
        if (num) num.textContent = pl.frames[at].n;
        var st = host.querySelector('.sl-ctrl .num');
        if (st) st.innerHTML = '第 ' + at + ' 步　比較次數 <b>' + pl.frames[at].n + '</b>';
        var say = host.querySelector('#sl-say');
        if (say) say.innerHTML = pl.frames[at].note || '　';
      }, speed);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    return { destroy: function () { stop(); host.innerHTML = ''; },
             _auto: function () { return { algo: algo, at: at, frames: pl && pl.frames.length,
                                           compares: pl && pl.compares, playing: !!timer,
                                           tAt: tAt, tSteps: tr && tr.steps.length }; } };
  }

  global.SORTLAB = {
    VERSION: VERSION,
    INFO: INFO,
    mount: mount,
    TESTS: TESTS,
    _plan: plan,
    _traceMin: traceMin,
    TRACE_CODE: TRACE_CODE,
    _bestOf: bestOf,
    _checkSelection: checkSelection,
    _checkBubble: checkBubble,
    _checkInsertion: checkInsertion,
    _doInsert: doInsert,
    _sorted: sorted,
    _makeItems: makeItems
  };

})(typeof window !== 'undefined' ? window : this);
