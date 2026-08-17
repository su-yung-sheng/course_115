/* =====================================================================
   實作體驗：100 個人（第 5 關 6-1-1 的最後一步）
   ---------------------------------------------------------------------
   ★ 為什麼第 5 關的最後一步不是「上傳作品」
     課本 6-1 是**觀念導入**，不寫程式 —— 這一關的程式其實就是
     第 6 關（選擇排序）和第 7 關（插入排序）。
     但每一關的最後一步都叫學生「在 Scratch 做出來並上傳」，
     第 5 關沒有東西可交，學生會卡在那裡。
     ⇒ 換成一段**體驗**，而且是這一關唯一做得到、
       前面幾步做不到的事：把資料量放大。

   ★★ 這一段要讓學生撞到的那句話
     概念檢測寫著：「五個人你看一眼就好，五萬個人呢？
     那時候『怎麼比』才會變成問題。」
     五個人的實驗室（minlab）證明不了這句話 —— 五個人**真的**一眼就看完。
     一百個人才會痛。痛過一次，第 6 關要寫的迴圈才有理由。

   三題（老師 2026-08-17 選的）：
     ① 找出最矮的　　　　→ 用眼睛掃一百個，會漏
     ② 已排好 10 個，找第 11 個 → 那就是選擇排序的第 11 回合
     ③ 比速度：你 vs 電腦　→ 重點不是誰快，是**電腦不會漏看**

   ⚠️ 「電腦比較快」不是這一段的結論。
      國中生按幾下就知道電腦快，那不必教。
      要教的是：你掃一百個會漏、會眼花、會想放棄，
      而電腦做 99 次比較，每一次都一樣。

   用法：
     BIGFIND.mount(host, { n: 100, onPass: fn })
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-bigfind';

  /* ── 規則（純函式）───────────────────────────────── */

  /**
   * 出一題。
   * ⚠️ 身高不可以重複：有兩個並列最矮的話，「最矮的是誰」有兩個答案，
   *    而學生點到另一個會被判錯 —— 那是系統的錯，不是他的。
   */
  function makeCase(n, rnd) {
    rnd = rnd || Math.random;
    n = n || 100;
    /* 120～199 公分共 80 個整數，不夠 100 個人用 ——
       所以配到 0.5 公分，剛好也更像真的身高。 */
    var pool = [];
    for (var v = 1200; v <= 1995; v += 5) pool.push(v / 10);
    /* 洗牌後取前 n 個 */
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n).map(function (h, k) {
      return { id: k, h: h };
    });
  }

  /** 最矮的是第幾個（索引）。 */
  function minOf(items, skip) {
    skip = skip || {};
    var best = -1;
    for (var i = 0; i < items.length; i++) {
      if (skip[items[i].id]) continue;
      if (best < 0 || items[i].h < items[best].h) best = i;
    }
    return best;
  }

  /**
   * 前 k 矮的那幾個（第 ② 題「已經排好的」那一排）。
   * 回傳的是 id 的集合，方便畫面上標記與排除。
   */
  function lowestK(items, k) {
    var sorted = items.slice().sort(function (a, b) { return a.h - b.h; });
    var set = {};
    sorted.slice(0, k).forEach(function (p) { set[p.id] = true; });
    return set;
  }

  /** 電腦要比幾次（一個一個看，第一個直接記住）。 */
  function compares(n) { return n - 1; }

  /* ── 三題的定義 ───────────────────────────────────── */
  var TASKS = [
    { key: 'min', icon: '🔎', name: '找出最矮的',
      ask: '這 <b>%n</b> 個人裡，<b>最矮</b>的是誰？點他一下。',
      why: '五個人你一眼就看完了。一百個人呢？' +
           '你剛才是不是也「掃了好幾遍、怕漏掉」——<b>那個感覺就是重點</b>。' },
    { key: 'next', icon: '📥', name: '找下一個',
      ask: '最矮的 <b>10</b> 個已經被搬到「已排序」了（畫面上<b>打勾</b>的那些）。' +
           '<br>剩下的人裡面，<b>下一個</b>該搬走的是誰？',
      why: '這就是選擇排序的<b>第 11 回合</b> —— ' +
           '每一回合都在剩下的人裡面挑最矮的。做十一次，就排好十一個。' },
    { key: 'race', icon: '⏱️', name: '你 vs 電腦',
      ask: '再找一次最矮的 —— 這次<b>計時</b>。找到之後，讓電腦也做一次。',
      why: '重點不是誰比較快。<b>電腦不會漏看</b> —— ' +
           '它做 %c 次比較，每一次都一模一樣；而你掃到第五十個的時候已經開始眼花了。' }
  ];

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.bf{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.bf-tip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:11px 14px;',
    '  font-size:13.5px;line-height:1.9;margin-bottom:12px}',
    '.bf-tip b{color:#4338ca}',
    '.bf-head{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
    '.bf-step{font-size:12px;font-weight:900;padding:4px 11px;border-radius:9999px;',
    '  background:#e2e8f0;color:#475569}',
    '.bf-step.on{background:#6366f1;color:#fff}',
    '.bf-step.ok{background:#dcfce7;color:#166534}',
    '.bf-timer{margin-left:auto;font-size:13px;font-weight:900;color:#6366f1}',
    /* 100 個人排成網格。
       ⚠️ 一定要**擠**：排得鬆的話一眼就掃完，那就沒有痛感了。
          但格子不能小於 32px —— 電腦教室有觸控螢幕，比手指小就點不到。 */
    '.bf-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;',
    '  margin-bottom:11px}',
    '@media (max-width:560px){.bf-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}',
    '.bf-p{position:relative;min-height:38px;padding:5px 2px;border:1px solid #e2e8f0;',
    '  background:#fff;border-radius:7px;font-family:inherit;cursor:pointer;',
    '  font-size:11.5px;font-weight:700;color:#475569;transition:.1s;line-height:1.25}',
    '.bf-p:hover{border-color:#6366f1;background:#eef2ff;transform:scale(1.12);z-index:2}',
    '.bf-p .no{display:block;font-size:9px;color:#cbd5e1;font-weight:900}',
    /* 宣告順序：done（已排序）→ scan（電腦掃到）→ best（電腦手上最矮的）→ bad/good
       ⚠️ 反過來的話後面的狀態會被前面的蓋掉，畫面上看不出電腦在做什麼。 */
    '.bf-p.done{background:#f1f5f9;border-color:#cbd5e1;color:#94a3b8}',
    '.bf-p.done .no{color:#e2e8f0}',
    '.bf-p.scan{background:#e0e7ff;border-color:#6366f1}',
    '.bf-p.best{background:#fef3c7;border-color:#f59e0b;color:#92400e}',
    '.bf-p.bad{background:#fee2e2;border-color:#ef4444;color:#991b1b}',
    '.bf-p.good{background:#dcfce7;border-color:#22c55e;color:#166534}',
    '.bf-msg{font-size:13.5px;line-height:1.85;padding:10px 13px;border-radius:10px;margin-bottom:10px}',
    '.bf-msg.good{background:#dcfce7;color:#166534}',
    '.bf-msg.bad{background:#fee2e2;color:#991b1b}',
    '.bf-msg.info{background:#f1f5f9;color:#475569}',
    '.bf-bar{display:flex;gap:8px;flex-wrap:wrap}',
    '.bf-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:9px 16px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.bf-btn:hover{background:#4f46e5}',
    '.bf-btn:disabled{background:#cbd5e1;cursor:default}',
    '.bf-btn.ghost{background:#fff;border:2px solid #cbd5e1;color:#475569}',
    '.bf-race{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px}',
    '.bf-race div{flex:1;min-width:130px;background:#f8fafc;border:2px solid #e2e8f0;',
    '  border-radius:11px;padding:9px 12px}',
    '.bf-race .lb{font-size:11.5px;font-weight:900;color:#64748b}',
    '.bf-race .vl{font-size:20px;font-weight:900;color:#4338ca}',
    '.bf-done{background:#ecfdf5;border:2px solid #6ee7b7;border-radius:14px;',
    '  padding:14px 16px;font-size:14px;line-height:1.95;color:#065f46}',
    '.bf-big .bf-p{min-height:46px;font-size:13px;padding:7px 3px}',
    '.bf-big .bf-tip{font-size:14.5px;padding:14px 17px}',
    '.bf-big .bf-msg{font-size:14.5px}'
  ].join('');

  function injectCSS() {
    if (global.document.getElementById('bigfind-css')) return;
    var s = global.document.createElement('style');
    s.id = 'bigfind-css';
    s.textContent = CSS;
    global.document.head.appendChild(s);
  }

  function mount(host, opts) {
    opts = opts || {};
    injectCSS();

    var n = opts.n || 100;
    var items = makeCase(n, opts.rnd);
    var at = 0;                    // 第幾題（0～2）
    var cleared = {};              // 過了哪幾題
    var msg = '', kind = 'info';
    var tries = 0;                 // 這一題點錯幾次
    var mark = {};                 // 畫面上的臨時標記（點錯／點對）
    var doneSet = {};              // 第 ② 題：已經排序好的那 10 個
    var t0 = 0, mySec = 0;         // 第 ③ 題的計時
    var auto = null, autoAt = -1, autoBest = -1;   // 電腦示範

    function task() { return TASKS[at]; }

    /* 這一題的正解（索引） */
    function answer() {
      if (task().key === 'next') return minOf(items, doneSet);
      return minOf(items);
    }

    function render() {
      host.className = 'bf' + (opts.big ? ' bf-big' : '');
      host.innerHTML =
        tipHTML() +
        headHTML() +
        (task().key === 'race' ? raceHTML() : '') +
        '<div class="bf-grid" id="bf-grid"></div>' +
        (msg ? '<div class="bf-msg ' + kind + '">' + msg + '</div>' : '') +
        (allDone() ? doneHTML() : '') +
        barHTML();
      grid();
      wire();
    }

    function allDone() { return cleared.min && cleared.next && cleared.race; }

    function tipHTML() {
      if (allDone()) return '';
      var t = task();
      return '<div class="bf-tip">' + t.icon + ' <b>' + t.name + '</b>　' +
             t.ask.replace('%n', n) + '</div>';
    }

    function headHTML() {
      return '<div class="bf-head">' +
        TASKS.map(function (t, i) {
          var cls = cleared[t.key] ? ' ok' : (i === at ? ' on' : '');
          return '<span class="bf-step' + cls + '">' +
                 (cleared[t.key] ? '✔ ' : (i + 1) + '. ') + t.name + '</span>';
        }).join('') +
        (t0 && !cleared.race && task().key === 'race'
          ? '<span class="bf-timer" id="bf-t">計時中…</span>' : '') +
        '</div>';
    }

    function raceHTML() {
      return '<div class="bf-race">' +
        '<div><span class="lb">你花的時間</span>' +
          '<span class="vl">' + (mySec ? mySec.toFixed(1) + ' 秒' : '—') + '</span></div>' +
        '<div><span class="lb">電腦比較次數</span>' +
          '<span class="vl">' + (autoAt >= 0 ? autoAt : '—') +
          ' / ' + compares(n) + '</span></div>' +
        '</div>';
    }

    function grid() {
      var box = host.querySelector('#bf-grid');
      if (!box) return;
      box.innerHTML = items.map(function (p, i) {
        var cls = 'bf-p';
        if (task().key === 'next' && doneSet[p.id]) cls += ' done';
        if (i === autoAt) cls += ' scan';
        if (i === autoBest) cls += ' best';
        if (mark[i] === 'bad') cls += ' bad';
        if (mark[i] === 'good') cls += ' good';
        return '<button class="' + cls + '" data-i="' + i + '">' +
               '<span class="no">' + (i + 1) + '</span>' +
               (task().key === 'next' && doneSet[p.id] ? '✔ ' : '') +
               p.h + '</button>';
      }).join('');
      [].forEach.call(box.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { tap(Number(el.dataset.i)); };
      });
    }

    function tap(i) {
      if (allDone() || auto) return;
      var t = task();
      if (t.key === 'race' && !t0) {
        say('info', '先按「⏱️ 開始計時」再找。');
        return;
      }
      if (t.key === 'next' && doneSet[items[i].id]) {
        say('info', '打勾的那些<b>已經排好了</b> —— 要在剩下的人裡面挑。');
        return;
      }
      var want = answer();
      if (i === want) {
        mark = {}; mark[i] = 'good';
        if (t.key === 'race') { mySec = (Date.now() - t0) / 1000; }
        cleared[t.key] = true;
        say('good', '✔ 第 ' + (i + 1) + ' 個，' + items[i].h + ' 公分 —— 對了。<br>' +
                    t.why.replace('%c', compares(n)));
        return;
      }
      tries++;
      mark = {}; mark[i] = 'bad';
      var d = items[i].h - items[want].h;
      say('bad', '第 ' + (i + 1) + ' 個是 ' + items[i].h + ' 公分，' +
                 '但還有人比他矮 <b>' + d.toFixed(1) + ' 公分</b>。' +
                 (tries >= 2
                   ? '<br>⚠️ 一個一個看很累對不對？<b>那正是這一關要你體會的事。</b>'
                   : '<br>再找找看。'));
    }

    function say(k, m) { kind = k; msg = m; render(); }

    /**
     * 三題都過了之後的收尾。
     * ★ 要把這一段和第 6、7 關**接起來** ——
     *   不接的話，學生只覺得剛才玩了一個小遊戲。
     */
    function doneHTML() {
      return '<div class="bf-done">' +
        '🎉 <b>三題都過了。</b>' +
        '<br>你剛才做的事，就是<b>選擇排序法</b>的一回合：' +
        '在還沒排好的人裡面找出最矮的，把他搬到已排好的那一排。' +
        '<br>做一百次，一百個人就排好了 —— ' +
        '而<b>第 6 關</b>要做的，就是把這件事寫成 Scratch 積木，讓電腦自己跑一百次。' +
        '<div style="margin-top:8px;font-size:13px">' +
        '⚠️ 這一關<b>沒有程式作品要交</b>（課本這一節是觀念導入）。' +
        '按下面的按鈕就算完成，<b>第 6 關會打開</b>。</div>' +
        '</div>';
    }

    function barHTML() {
      var t = task();
      var b = [];
      if (allDone()) {
        b.push('<button class="bf-btn" data-a="finish">完成，回闖關地圖 →</button>');
      } else if (cleared[t.key]) {
        b.push('<button class="bf-btn" data-a="next">下一題 →</button>');
      } else if (t.key === 'race') {
        if (!t0) b.push('<button class="bf-btn" data-a="start">⏱️ 開始計時</button>');
      }
      if (t.key === 'race' && cleared.race && autoAt < 0) {
        b.push('<button class="bf-btn ghost" data-a="auto">▶ 讓電腦做一次</button>');
      }
      return '<div class="bf-bar">' + b.join('') + '</div>';
    }

    function wire() {
      [].forEach.call(host.querySelectorAll('[data-a]'), function (el) {
        el.onclick = function () { act(el.dataset.a); };
      });
    }

    function act(a) {
      if (a === 'start') {
        t0 = Date.now();
        say('info', '開始了 —— 找出最矮的那一個。');
        return;
      }
      if (a === 'next') {
        at++;
        if (at >= TASKS.length) at = TASKS.length - 1;
        tries = 0; mark = {}; msg = ''; kind = 'info';
        if (TASKS[at].key === 'next') doneSet = lowestK(items, 10);
        render();
        return;
      }
      if (a === 'auto') { runAuto(); return; }
      if (a === 'finish') {
        if (opts.onPass) opts.onPass();
        return;
      }
    }

    /**
     * 電腦示範：一個一個看，手上永遠記著目前最矮的。
     * ⚠️ 要**慢到看得見**。瞬間跑完的話學生只看到結果，
     *    看不到「它一個都沒有跳過」—— 而那才是這一段的結論。
     */
    function runAuto() {
      autoAt = 0; autoBest = 0;
      msg = ''; kind = 'info';
      render();
      auto = global.setInterval(function () {
        autoAt++;
        if (autoAt >= items.length) {
          global.clearInterval(auto); auto = null;
          autoAt = compares(n);
          say('good', '電腦做完了：<b>' + compares(n) + ' 次比較</b>，' +
                      '最矮的是第 ' + (autoBest + 1) + ' 個（' + items[autoBest].h + ' 公分）。' +
                      '<br>★ 你花了 ' + mySec.toFixed(1) + ' 秒。' +
                      '<b>但真正的差別不是快慢 —— 是它一個都沒有跳過。</b>' +
                      '<br>第 6 關就是把這件事寫成 Scratch 積木。');
          return;
        }
        if (items[autoAt].h < items[autoBest].h) autoBest = autoAt;
        render();
      }, 28);
    }

    render();

    return {
      destroy: function () { if (auto) global.clearInterval(auto); host.innerHTML = ''; },
      _s: function () {
        return { at: at, cleared: cleared, items: items, doneSet: doneSet,
                 tries: tries, mySec: mySec, autoAt: autoAt, done: allDone() };
      }
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅）。 */
  function goal(cfg) {
    var n = (cfg && cfg.n) || 100;
    return {
      why: '前面的實驗室只有 5 個人 —— 五個人你**真的**一眼就看完了，' +
           '證明不了「為什麼需要演算法」。' +
           '這一段給你 <b>' + n + '</b> 個人：' +
           '用眼睛掃會漏、會眼花、會想放棄，那個感覺就是第 6 關存在的理由。',
      pass: '三題都答對：<br>' +
            '① 找出最矮的　② 已排好 10 個，找下一個該搬的　③ 計時比一次，再讓電腦做一次'
    };
  }

  global.BIGFIND = {
    VERSION: VERSION,
    mount: mount,
    goal: goal,
    makeCase: makeCase,
    minOf: minOf,
    lowestK: lowestK,
    compares: compares,
    TASKS: TASKS
  };
})(typeof window !== 'undefined' ? window : this);
