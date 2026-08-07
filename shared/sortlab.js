/* =====================================================================
   手動排序挑戰（sort.html 與程式設計關卡共用一份）
   ---------------------------------------------------------------------
   ★ 為什麼要抽出來
     這個挑戰原本寫死在 11502/sort.html 裡。第 6、7 關也需要同一件事，
     複製一份的話就有兩套規則 —— 而規則一旦不一致，
     學生在探索頁玩熟的做法，到了關卡頁會被判錯，
     他不會覺得是兩份程式不同，只會覺得自己記錯。

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
    '.sl-btn:hover{background:#4f46e5}'
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

    host.className = 'sl';
    render();

    function render() {
      round++;
      host.innerHTML =
        '<div class="sl-tip">' + info.icon + ' <b>' + info.name + '</b>　' + info.rule +
        '<div class="sl-sub">📝 ' + info.why + '<br>🎒 ' + info.life + '</div></div>' +
        '<div id="sl-body"></div>' +
        '<div id="sl-msg"></div>' +
        (opts.newRound !== false ? '<button class="sl-btn" id="sl-new">🎲 換一題</button>' : '');
      body();
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

    return { destroy: function () { host.innerHTML = ''; } };
  }

  global.SORTLAB = {
    VERSION: VERSION,
    INFO: INFO,
    mount: mount,
    _bestOf: bestOf,
    _checkSelection: checkSelection,
    _checkBubble: checkBubble,
    _checkInsertion: checkInsertion,
    _doInsert: doInsert,
    _sorted: sorted,
    _makeItems: makeItems
  };

})(typeof window !== 'undefined' ? window : this);
