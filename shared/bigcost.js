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

  var SIZES = [10, 100, 1000];

  /* 四個小段 */
  var STEPS = [
    { key: 'sort',   icon: '😰', name: '排序有多貴' },
    { key: 'twosort', icon: '⚖️', name: '兩種排序比一比' },
    { key: 'search', icon: '🔍', name: '搜尋差幾倍' },
    { key: 'plan',   icon: '🤔', name: '先排序划算嗎' }
  ];

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
    var planK = null;           // 第 ④ 段：目前在問「查幾次」

    function step() { return STEPS[at]; }
    function allDone() { return STEPS.every(function (s) { return cleared[s.key]; }); }

    function render() {
      host.className = 'bc' + (opts.big ? ' bc-big' : '');
      host.innerHTML =
        barHTML() +
        (allDone() ? doneHTML() : tipHTML() + bodyHTML()) +
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
        sort: '第 6、7 關你排過 5 個人。<b>100 個人</b>呢？' +
              '<br>選一個資料量，先<b>自己猜</b>選擇排序要比幾次。',
        twosort: '選擇排序和插入排序，<b>最壞情況</b>哪一種比較省？' +
                 '<br>（想一想第 7 關那副撲克牌 —— 剛好完全相反的順序。）',
        search: '同樣這批資料，<b>循序搜尋</b>和<b>二元搜尋</b>最壞各要比幾次？',
        plan: '⚠️ 但二元搜尋<b>要先排好序</b> —— 而排序那幾千次是先付掉的。' +
              '<br>所以真正的問題是：<b>你要查幾次？</b>'
      }[step().key];
      return '<div class="bc-tip">' + step().icon + ' <b>' + step().name + '</b>　' + t + '</div>';
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
      if (k === 'sort') {
        return sizesHTML() +
          (cleared.sort
            ? numsHTML([['選擇排序（' + comma(n) + ' 筆）', comma(selCompares(n)), '次比較', 'hot'],
                        ['第 5 關只找一個最矮的', comma(n - 1), '次比較', 'cool']])
            : '') +
          '<div class="bc-ask">' +
            '<b>' + comma(n) + '</b> 筆資料，用<b>選擇排序</b>排好，總共要比幾次？' +
            '<br><span style="font-size:12px">💡 第 5 關學過：找一個最小值要比 ' + comma(n - 1) +
            ' 次。而排序要把這件事做幾遍？</span>' +
            '<div class="yn"><input class="bc-in" id="bc-g" type="number" min="1" placeholder="次數">' +
            '<button class="bc-btn" data-a="ans">送出</button></div></div>';
      }
      if (k === 'twosort') {
        return sizesHTML() +
          (cleared.twosort
            ? numsHTML([['選擇排序', comma(selCompares(n)), '不管資料長怎樣', 'hot'],
                        ['插入排序（最壞）', comma(insWorst(n)), '完全相反的順序', 'hot'],
                        ['插入排序（最好）', comma(insBest(n)), '本來就排好了', 'cool']])
            : '') +
          '<div class="bc-ask">' +
            '<b>最壞情況</b>下，哪一種排序比較省？' +
            '<div class="yn">' +
            '<button class="bc-btn ghost" data-a="sel">選擇排序</button>' +
            '<button class="bc-btn ghost" data-a="ins">插入排序</button>' +
            '<button class="bc-btn ghost" data-a="tie">一樣</button>' +
            '</div></div>';
      }
      if (k === 'search') {
        return sizesHTML() +
          '<div class="bc-bars">' +
            bar('循序搜尋', seqWorst(n), seqWorst(n), '#f59e0b') +
            bar('二元搜尋', binWorst(n), seqWorst(n), '#22c55e') +
          '</div>' +
          '<div class="bc-ask">' +
            comma(n) + ' 筆資料，<b>二元搜尋</b>最壞要比幾次？' +
            '<br><span style="font-size:12px">💡 每比一次砍掉一半 —— 砍幾次才會砍完？</span>' +
            '<div class="yn"><input class="bc-in" id="bc-g" type="number" min="1" placeholder="次數">' +
            '<button class="bc-btn" data-a="ans">送出</button></div></div>';
      }
      /* plan */
      /* ⚠️⚠️ 第二個情境的「查幾次」**不可以寫死**。
         我第一版寫 50，但 100 筆的損益兩平點是 **54 次** ——
         查 50 次的正確答案其實是「不要排」，題目和答案剛好相反。
         ⚠️ 而且損益兩平點跟著資料量跑：10 筆是 8 次、1000 筆是 505 次。
         ⇒ 取「損益兩平點的兩倍」，不管選哪個資料量都穩穩落在「該排序」那一邊。 */
      var k1 = 1, k2 = breakEven(n) * 2;
      var kk = planK === null ? k1 : planK;
      return sizesHTML() +
        '<div class="bc-bars">' +
          bar('不排序，每次都循序找', costPlain(n, kk), Math.max(costPlain(n, kk), costSorted(n, kk)), '#f59e0b') +
          bar('先排序，之後都二元找', costSorted(n, kk), Math.max(costPlain(n, kk), costSorted(n, kk)), '#22c55e') +
        '</div>' +
        '<div class="bc-ask">' +
          '這批 <b>' + comma(n) + '</b> 筆資料，你要查 <b>' + kk + '</b> 次。' +
          '<b>要不要先排序？</b>' +
          '<div class="yn">' +
          '<button class="bc-btn ghost" data-a="plain">不排，直接循序找</button>' +
          '<button class="bc-btn ghost" data-a="sorted">先排序，再二元找</button>' +
          '</div></div>';
    }

    function numsHTML(rows) {
      return '<div class="bc-nums">' + rows.map(function (r) {
        return '<div class="bc-num ' + (r[3] || '') + '"><span class="lb">' + r[0] + '</span>' +
               '<span class="vl">' + r[1] + '</span><span class="sub">' + r[2] + '</span></div>';
      }).join('') + '</div>';
    }

    function doneHTML() {
      var be = breakEven(n);
      return '<div class="bc-done">' +
        '🎉 <b>四段都過了。</b>' +
        '<br>這一章的結論不是「二元搜尋比較快」——' +
        '<br>而是 <b>「看你要查幾次」</b>：' +
        '<br>· 只查一兩次 → <b>不必排序</b>，直接循序找比較省' +
        '<br>· 要查很多次 → <b>先排序划算</b>（' + comma(n) + ' 筆的話，查 <b>' + be +
        '</b> 次以上就值得了）' +
        '<br>⚠️ 課本說「二元搜尋比較快」是有前提的：<b>資料要先排好</b>。' +
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
          /* ⚠️ 換資料量就要重答 —— 不然學生用 10 筆過關，
             卻沒看到 1000 筆才會出現的那個差距。 */
          cleared[step().key] = false;
          tries = 0; msg = ''; kind = 'info';
          render();
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

      if (key === 'sort' && a === 'ans') {
        var v = num('#bc-g');
        if (v === null) return;
        var want = selCompares(n);
        if (v === want) {
          cleared.sort = true;
          say('good', '對了 —— <b>' + comma(want) + '</b> 次。' +
              '<br>第 5 關找<b>一個</b>最矮的要比 ' + comma(n - 1) + ' 次；' +
              '排序是把那件事做 ' + (n - 1) + ' 遍，' +
              '每一遍要比的愈來愈少，加起來就是 ' + comma(n) + '×' + comma(n - 1) + '÷2。');
        } else {
          tries++;
          say('bad', '不是 ' + comma(v) + ' 次。' +
              (v === n - 1
                ? '<br>那是<b>找一個</b>最小值的次數（第 5 關）。排序要找 ' + (n - 1) + ' 遍。'
                : (tries >= 2
                    ? '<br>💡 第一遍比 ' + (n - 1) + ' 次、第二遍 ' + (n - 2) +
                      ' 次……一路加到 1。加起來是 ' + comma(n) + '×' + comma(n - 1) + '÷2。'
                    : '<br>再想一次：每一遍要比幾次？總共幾遍？')));
        }
        return;
      }

      if (key === 'twosort') {
        if (a === 'tie') {
          cleared.twosort = true;
          say('good', '對了 —— <b>最壞情況一樣</b>，都是 ' + comma(selCompares(n)) + ' 次。' +
              '<br>★ 但它們有一個真正的差別：資料<b>本來就排好</b>的時候，' +
              '插入排序只要比 <b>' + comma(insBest(n)) + '</b> 次，' +
              '而選擇排序<b>還是</b> ' + comma(selCompares(n)) + ' 次 —— ' +
              '它不管資料長什麼樣，每一遍都要從頭找一次最小的。');
        } else {
          say('bad', '不是。<b>最壞情況</b>下兩種都是 ' + comma(selCompares(n)) + ' 次 —— ' +
              '插入排序遇到完全相反的順序時，每一張新牌都要一路比到最前面。' +
              '<br>💡 再選一次。');
        }
        return;
      }

      if (key === 'search' && a === 'ans') {
        var v2 = num('#bc-g');
        if (v2 === null) return;
        var want2 = binWorst(n);
        if (v2 === want2) {
          cleared.search = true;
          say('good', '對了 —— <b>' + want2 + '</b> 次。' +
              '循序最壞要 <b>' + comma(seqWorst(n)) + '</b> 次，' +
              '差了 <b>' + Math.round(seqWorst(n) / want2) + ' 倍</b>。' +
              '<br>⚠️ 但先別急著說二元比較好 —— 下一段就是那個「但是」。');
        } else {
          tries++;
          say('bad', '不是 ' + v2 + ' 次。' +
              (tries >= 2
                ? '<br>💡 ' + comma(n) + ' → ' + Math.floor(n / 2) + ' → ' +
                  Math.floor(n / 4) + ' → …… 一直砍到 0，數數看砍了幾次。'
                : '<br>每比一次砍掉一半，砍到範圍空掉為止。'));
        }
        return;
      }

      if (key === 'plan') {
        var kk = planK === null ? 1 : planK;
        var right = better(n, kk);
        var picked = (a === 'plain') ? 'plain' : 'sorted';
        if (picked === right) {
          if (planK === null) {
            /* 第一題（查 1 次）過了 → 換第二題（查很多次）。
               ⚠️ 次數要現算（見 bodyHTML 裡的說明）。 */
            planK = breakEven(n) * 2;
            say('good', '對了 —— 查 <b>1</b> 次的話，' +
                '不排序只要 ' + comma(costPlain(n, 1)) + ' 次，' +
                '先排序反而要 ' + comma(costSorted(n, 1)) + ' 次。' +
                '<br>★ 現在換一個情境：<b>要查 ' + comma(planK) + ' 次</b>呢？');
          } else {
            cleared.plan = true;
            say('good', '對了 —— 查 <b>' + comma(kk) + '</b> 次的話，' +
                '不排序要 ' + comma(costPlain(n, kk)) + ' 次，' +
                '先排序只要 ' + comma(costSorted(n, kk)) + ' 次。' +
                '<br>★ 同一批資料、同樣兩種方法，' +
                '<b>答案卻不一樣 —— 因為要查的次數不一樣。</b>');
          }
        } else {
          say('bad', '再看一次上面那兩條長條。' +
              '<br>不排序＝每次都循序找 ' + comma(seqWorst(n)) + ' 次 × ' + kk + ' 次 = ' +
              comma(costPlain(n, kk)) + '；' +
              '<br>先排序＝排序 ' + comma(selCompares(n)) + ' 次 ＋ 每次二元 ' + binWorst(n) +
              ' 次 × ' + kk + ' 次 = ' + comma(costSorted(n, kk)) + '。');
        }
        return;
      }
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
        return { at: at, cleared: cleared, n: n, planK: planK, done: allDone() };
      }
    };
  }

  /** 這一步的目標與過關標準（關卡頁的橫幅）。 */
  function goal() {
    return {
      why: '第 6～9 關你各學了一個演算法，但<b>沒有人把它們放在一起看過</b>。' +
           '這一段把四關綁起來問一個問題：' +
           '<b>資料變多的時候，這些差別會變成什麼樣子？</b>' +
           '<br>⚠️ 結論不是「二元搜尋比較快」—— 那句話是有前提的。',
      pass: '四段都答對：<br>' +
            '① 排序有多貴　② 兩種排序最壞情況比一比　' +
            '③ 搜尋差幾倍　④ 先排序划不划算（查 1 次／查 50 次各一題）'
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
