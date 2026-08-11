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
    function shot(c, best, done) {
      frames.push({ arr: a.slice(), cmp: c || null,
                    best: (best == null ? null : best), done: done || 0, n: cmp });
    }
    var better = function (x, y) {
      return order === 'desc' ? x > y : x < y;
    };

    shot(null, null, 0);
    if (mode === 'bubble') {
      for (var i = 0; i < n - 1; i++) {
        for (var j = 0; j < n - 1 - i; j++) {
          cmp++; shot([j, j + 1], null, i ? n - i : 0);
          if (better(a[j + 1], a[j])) {
            var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
            shot([j, j + 1], null, i ? n - i : 0);
          }
        }
      }
    } else if (mode === 'insertion') {
      for (var k = 1; k < n; k++) {
        var key = a[k], p = k - 1;
        shot([k, k], null, k);
        while (p >= 0) {
          cmp++; shot([p, k], null, k);
          if (!better(key, a[p])) break;
          a[p + 1] = a[p]; p--;
          shot([p + 1, k], null, k);
        }
        a[p + 1] = key;
        shot(null, null, k + 1);
      }
    } else {
      /* 選擇排序照課本的兩清單版：從未排序找最小 → 搬到已排序的最後一項。
         畫面上已排好的留在左邊不動，未排序的整段往左遞補。 */
      for (var s = 0; s < n; s++) {
        var best = s;
        shot(null, best, s);
        for (var q = s + 1; q < n; q++) {
          cmp++; shot([q, best], best, s);
          if (better(a[q], a[best])) { best = q; shot([q, best], best, s); }
        }
        var v = a.splice(best, 1)[0];
        a.splice(s, 0, v);
        shot(null, null, s + 1);
      }
    }
    shot(null, null, n);
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

  /* ── 三種排序法的說明（沿用 sort.html 原本的文案）───── */
  var INFO = {
    selection: {
      name: '選擇排序法', icon: '🎯',
      rule: '每一回合從<b>未排序</b>裡點出最小的，它會被搬到<b>已排序</b>的最後一項。',
      why: '反覆從未排序數列中找出「最小值」，把它加到已排序數列的最後一項，' +
           '再從未排序數列裡刪掉。重複到未排序清空為止。',
      life: '整理很重的書箱：先在剩下的書裡找出最輕的，搬到另一個箱子，每次只搬對的那一本。'
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
      life: '玩撲克牌，抽一張新牌之後，直接把它插進手上已經排好順序的牌堆裡。'
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
    '.sl-cell.done{border-color:#34d399;background:#dcfce7;color:#166534;cursor:default}',
    '.sl-cell.done:hover{background:#dcfce7}',
    '.sl-cell.sel{border-color:#6366f1;background:#e0e7ff;transform:translateY(-3px)}',
    '.sl-cell.card{border-color:#f97316;background:#fff7ed}',
    '.sl-cell.bad{border-color:#f59e0b;background:#fef3c7}',
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
    '  background:#f0fdfa;color:#0f766e;margin-top:8px}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('sl-style')) return;
    var s = document.createElement('style');
    s.id = 'sl-style'; s.textContent = CSS;
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
    /* 自動播放的狀態。
       ⚠️ 一定要在 render() 之前宣告 —— render() 會叫 auto()，
          而 var 只提升宣告不提升賦值，放在後面的話 algo 會是 undefined。 */
    var pl = null, at = 0, timer = null, algo = mode, speed = 60;

    host.className = 'sl';
    render();

    function render() {
      round++;
      host.innerHTML =
        '<div class="sl-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="sl-sub">📝 ' + info.why + '<br>🎒 ' + info.life + '</div></div>' +
        '<div id="sl-body"></div>' +
        '<div id="sl-msg"></div>' +
        (opts.newRound !== false ? '<button class="sl-btn" id="sl-new">🎲 換一題</button>' : '') +
        '<div id="sl-trace"></div>' +
        '<div id="sl-auto"></div>';
      body();
      trace();
      auto();
      var nb = host.querySelector('#sl-new');
      if (nb) nb.onclick = function () {
        items = makeItems(opts.size || 6, order);
        unsorted = items.slice(); done = []; arr = items.slice();
        boundary = 1; sel = null; round = 0; passed = false;
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
      if (!el) return;
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 650);
    }
    function finish() {
      if (passed) return;
      passed = true;
      say(true, '排好了！' + info.why);
      trace(); auto();             // ★ 通關才出現這兩區，這裡要重畫一次
      if (opts.onPass) opts.onPass();
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
      box.innerHTML =
        '<h4>📺 換 ' + f.arr.length + ' 筆資料，讓它自己跑一遍</h4>' +
        '<div class="lead">你剛剛用手排六個。' +
        '同樣的方法，' + f.arr.length + ' 筆要比幾次？' +
        '<b>一邊看一邊注意右邊那個數字。</b></div>' +
        '<div class="sl-bars" id="sl-bars"></div>' +
        '<div class="sl-ctrl">' +
        ['selection', 'insertion', 'bubble'].map(function (m) {
          return '<button data-algo="' + m + '"' + (m === algo ? ' class="on"' : '') + '>' +
                 INFO[m].icon + ' ' + INFO[m].name + '</button>';
        }).join('') +
        '<button data-play="1">' + (timer ? '⏸ 暫停' : '▶ 開始') + '</button>' +
        '<button data-again="1">🎲 換一組</button>' +
        '<span class="num">比較次數 <b>' + f.n + '</b>' +
        (at >= pl.frames.length - 1 ? '　✅ 排好了' : '') + '</span></div>';
      bars(f);
      [].forEach.call(box.querySelectorAll('[data-algo]'), function (el) {
        el.onclick = function () { stop(); algo = el.dataset.algo; pl = null; auto(); };
      });
      box.querySelector('[data-play]').onclick = toggle;
      box.querySelector('[data-again]').onclick = function () { stop(); pl = null; auto(); };
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
        var num = host.querySelector('.sl-ctrl .num b');
        if (num) num.textContent = pl.frames[at].n;
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
