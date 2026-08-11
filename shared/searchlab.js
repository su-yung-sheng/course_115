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
               msg: '這一格<b>已經比過了</b>。循序搜尋不會回頭 —— 往下一個。' };
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
    if (opts.course) {
      return { items: [8, 5, 10, 1, 7], target: opts.course === 'miss' ? 9 : 10 };
    }
    var n = opts.size || 8;
    var a = [], seen = {};
    while (a.length < n) {
      var v = 1 + Math.floor(Math.random() * 99);
      if (!seen[v]) { seen[v] = 1; a.push(v); }   // 不重複，免得「第幾個」有兩個答案
    }
    /* 排好了就打散 —— 循序搜尋的資料不該看起來像排序過的 */
    var tries = 0;
    while (isSorted(a) && tries++ < 20) a.sort(function () { return Math.random() - 0.5; });

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

  /* ── 說明文案 ─────────────────────────────────────── */
  var INFO = {
    sequential: {
      name: '循序搜尋法', icon: '🔍',
      rule: '從<b>第 1 格</b>開始，一格一格往右點，' +
            '把它和目標比一比 —— <b>不可以跳</b>。',
      why: '從第一個元素開始取出，依序逐個與目標資料比較，' +
           '直到找到所要的元素，或所有資料都找完為止。',
      life: '交換禮物要選第一個挑的人：從 1 號開始，一個一個問他的紙牌是幾號，' +
            '問到那個數字為止。'
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
    '.qs-cell.bad{border-color:#f59e0b;background:#fef3c7}',
    '.qs-msg{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.qs-msg.good{background:#dcfce7;color:#166534}',
    '.qs-msg.bad{background:#fef3c7;color:#92400e}',
    '.qs-msg.none{background:#e2e8f0;color:#475569}',
    '.qs-btn{background:#06b6d4;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px}',
    '.qs-btn:hover{background:#0891b2}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('qs-style')) return;
    var s = document.createElement('style');
    s.id = 'qs-style'; s.textContent = CSS;
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
    /* ★ 要「找到一次」＋「找不到一次」才算通過。
       只找到過的學生，不會知道迴圈為什麼需要結束條件。 */
    var sawHit = false, sawMiss = false;

    reset(opts.items && opts.items.length
            ? { items: opts.items.slice(), target: opts.target }
            : makeCase(opts));

    host.className = 'qs';
    render();

    function reset(c) {
      items = c.items; target = c.target;
      next = 0; tried = 0; ended = false;
    }

    function render() {
      host.innerHTML =
        '<div class="qs-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="qs-sub">📝 ' + info.why + '<br>🎁 ' + info.life + '</div></div>' +
        '<div class="qs-goal"><span class="lb">目標資料</span>' +
        '<span class="qs-target">' + esc(target) + '</span>' +
        '<span class="qs-count" id="qs-cnt"></span></div>' +
        '<div id="qs-body"></div>' +
        '<div id="qs-msg"></div>' +
        (opts.newRound !== false ? '<button class="qs-btn" id="qs-new">🎲 換一題</button>' : '');
      body();
      count();
      var nb = host.querySelector('#qs-new');
      if (nb) nb.onclick = function () { reset(makeCase(opts)); render(); };
    }

    function body() {
      var b = host.querySelector('#qs-body');
      b.innerHTML = '<div class="qs-row">' + items.map(function (v, i) {
        var cls = 'qs-cell';
        if (ended && i === next && String(v) === String(target)) cls += ' hit';
        else if (i < next) cls += ' past';
        else if (i === next && !ended) cls += ' now';
        return '<div class="qs-box"><span class="qs-idx">第 ' + (i + 1) + ' 項</span>' +
               '<button class="' + cls + '" data-i="' + i + '">' + esc(v) + '</button></div>';
      }).join('') + '</div>';
      [].forEach.call(b.querySelectorAll('[data-i]'), function (el) {
        el.onclick = function () { click(Number(el.dataset.i), el); };
      });
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
      var r = checkSequential(items, next, i);
      if (!r.ok) { flash(el); say('bad', r.msg); return; }

      tried++;
      var s = stepResult(items, target, i);
      if (s.found) {
        ended = true; sawHit = true;
        body(); count();
        say('good', '找到了 —— <b>' + esc(target) + '</b> 在第 <b>' + (i + 1) + '</b> 項。' +
                    '總共比了 <b>' + tried + '</b> 次。' +
                    '<br>⚠️ 找到就<b>停</b>，後面那幾格不必再比。');
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

    function maybePass() {
      if (passed) return;
      /* 找得到、找不到兩種都遇過才算走完一輪。 */
      if (!(sawHit && sawMiss)) {
        var need = sawHit ? '找<b>不到</b>' : '找<b>得到</b>';
        say2('還差一種情況：再換一題，試一次' + need + '的。' +
             '兩條路都走過，才知道迴圈為什麼需要結束條件。');
        return;
      }
      passed = true;
      if (opts.onPass) opts.onPass();
    }
    function say2(extra) {
      var m = host.querySelector('#qs-msg');
      if (m) m.innerHTML += '<br>· ' + extra;
    }

    return {
      destroy: function () { host.innerHTML = ''; },
      _state: function () {
        return { items: items, target: target, next: next, tried: tried,
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
    _makeCase: makeCase,
    _isSorted: isSorted
  };
})(typeof window !== 'undefined' ? window : this);
