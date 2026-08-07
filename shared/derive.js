/* =====================================================================
   推導活動：「這個數字是怎麼來的」
   ---------------------------------------------------------------------
   接在積木關卡前面的一小段。學生先想清楚數字從哪來，再去拼積木。

   ★ 為什麼不是排流程圖
     上學期排流程圖練的是「順序」。下學期這幾關的難處不在順序 ——
     2-1-3 的難處是「每畫一條邊要轉幾度」這件事本身，
     以及「為什麼是 360 ÷ N 而不是寫死 90」。
     排流程圖完全碰不到這一點。

   ★ 核心機制：答案直接餵進程式，不是答完就丟
     最後一步不比對標準答案 —— 學生填什麼角度，小貓就照那個角度走。
     對了圖形自己閉合，錯了就留一個開口。
     **不必系統說「答錯了」，圖形自己會說。**

     這也是防亂填的方法。前置活動最容易變成「答完才能玩」的過路費，
     國中生會亂按衝過去，那就退化成點擊練習。
     這裡亂填的結果是畫出開口，衝不過去，而且看得出來為什麼。

   ★ 一般化那一步用「代入三個數字」判定
     問「如果邊數是 N 呢」，學生寫出 ( ) ÷ ( )。
     系統代 N=4、6、10 各畫一次，三個都閉合才算對。
     右邊如果寫死 6，N=6 會過但 N=4 不會 —— 這正是要抓的誤解，
     而且抓出來的時候學生看得到那個沒閉合的圖。

   用法：
     DERIVE.mount(host, data, { onPass: fn })
   資料格式見 11502/content/blocks.js 裡的 derive 欄位。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-07-derive';

  /* ── 純計算（沒有畫面，可以單獨測） ───────────────── */

  /**
   * 算式 → 這一次要轉幾度。
   * f = { left: 數字或字串, right: 數字 或 'N' }
   * right 是 'N' 表示「跟著邊數走」，是數字表示學生寫死了。
   */
  function turnFor(f, n) {
    var L = parseFloat(f && f.left);
    var R = (f && String(f.right).trim().toUpperCase() === 'N') ? n : parseFloat(f && f.right);
    if (!isFinite(L) || !isFinite(R) || R === 0) return NaN;
    return L / R;
  }

  /**
   * 走 n 條邊、每次轉 turn 度，會不會剛好回到起點？
   *
   * ⚠️ 判定是「總共剛好轉一圈」，不是「有沒有回到起點」。
   *    n=6、turn=120 也會回到起點 —— 但那是把三角形描了兩遍，
   *    轉了 720 度。看起來是閉合的圖形，觀念卻是錯的。
   *    所以條件是 n × turn ≈ 360，一圈就是一圈。
   */
  function closes(turn, n) {
    if (!isFinite(turn) || !isFinite(n) || n < 3) return false;
    return Math.abs(n * turn - 360) < 0.5;
  }

  /** 多轉了幾圈（用來講「你轉了兩圈」這種話），沒閉合就回 0 */
  function laps(turn, n) {
    if (!isFinite(turn) || !isFinite(n)) return 0;
    var t = n * turn / 360;
    return Math.abs(t - Math.round(t)) < 0.01 ? Math.round(t) : 0;
  }

  /**
   * 單一數字的回饋。回傳 { ok, msg }。
   *
   * ★ 訊息要講「圖形怎麼了」，不要講「答案錯了」。
   *   學生看得到那張圖，訊息的工作是幫他把圖和數字連起來。
   */
  function checkAngle(turn, n) {
    if (!isFinite(turn)) return { ok: false, msg: '先填一個數字。' };
    if (closes(turn, n)) {
      return { ok: true, msg: '閉合了！' + n + ' 條邊 × ' + fmt(turn) + ' 度 = 360 度，剛好轉一整圈。' };
    }
    var L = laps(turn, n);
    if (L >= 2) {
      return { ok: false, msg: '它回到起點了，但轉了 ' + L + ' 圈 —— 圖形被描了 ' + L +
                              ' 遍。一圈是 360 度，不是 ' + (360 * L) + ' 度。' };
    }
    var tot = n * turn;
    return { ok: false, msg: '沒有閉合，留了一個開口。轉 ' + n + ' 次、每次 ' + fmt(turn) +
                            ' 度，總共只轉了 ' + fmt(tot) + ' 度，' +
                            (tot < 360 ? '不夠一圈（360 度）。' : '超過一圈（360 度）。') };
  }

  /**
   * 一般化那一步：代入好幾個邊數，全部都要閉合。
   *
   * 回傳 { ok, msg, bad }　bad = 第一個失敗的邊數（畫面拿它畫圖）
   */
  function verdict(f, ns) {
    ns = (ns && ns.length) ? ns : [4, 6, 10];
    var L = parseFloat(f && f.left);
    if (!isFinite(L)) return { ok: false, msg: '左邊要填一個數字。', bad: ns[0] };
    if (!String(f && f.right).trim()) return { ok: false, msg: '右邊還沒填。', bad: ns[0] };

    for (var i = 0; i < ns.length; i++) {
      if (!closes(turnFor(f, ns[i]), ns[i])) {
        var fixed = String(f.right).trim().toUpperCase() !== 'N';
        return {
          ok: false, bad: ns[i],
          msg: fixed
            ? ('代進 ' + ns[i] + ' 邊形就不閉合了 —— 右邊寫死成 ' + f.right +
               '，只有 ' + f.right + ' 邊形畫得出來。要放會跟著變的 N。')
            : ('代進 ' + ns[i] + ' 邊形不閉合。' + checkAngle(turnFor(f, ns[i]), ns[i]).msg)
        };
      }
    }
    return { ok: true, bad: 0,
             msg: '三種邊數代進去都閉合 —— 這個式子對任何邊數都成立。這就是要放進「右轉 ( ) 度」的東西。' };
  }

  function fmt(v) {
    if (!isFinite(v)) return '?';
    return (Math.round(v * 100) / 100).toString();
  }

  /* ── 畫圖：一隻很小的烏龜 ──────────────────────────
     沒有用 blocks.js 的引擎 —— 這裡只要「走 n 條邊、每次轉 t 度」，
     為了這件事去組一份假的積木程式反而更難懂也更難改。
     舞台比例仍然照 Scratch 的 480×360，學生換到積木關卡不會覺得換了世界。 */

  function polyPath(n, turn, side) {
    var pts = [[0, 0]], x = 0, y = 0, head = 0;   // head：0 = 朝右
    for (var i = 0; i < n; i++) {
      x += side * Math.cos(head * Math.PI / 180);
      y += side * Math.sin(head * Math.PI / 180);
      pts.push([x, y]);
      head -= turn;                                // Scratch 的右轉是順時針
    }
    return pts;
  }

  /** 把路徑縮放置中，塞進 w×h 的畫布 */
  function fitPath(pts, w, h, pad) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sw = Math.max(x1 - x0, 1), sh = Math.max(y1 - y0, 1);
    var k = Math.min((w - pad * 2) / sw, (h - pad * 2) / sh);
    if (!isFinite(k) || k <= 0) k = 1;
    return pts.map(function (p) {
      return [(p[0] - (x0 + x1) / 2) * k + w / 2, -(p[1] - (y0 + y1) / 2) * k + h / 2];
    });
  }

  /** 一邊一邊畫出來。回傳一個可以中止的 handle。 */
  function draw(cv, n, turn, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    var pts = fitPath(polyPath(n, turn, 60), w, h, 22);
    var stop = false, i = 0;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // 起點：畫一個小圈，這樣「有沒有回到這裡」看得出來
    function dot(p, color) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
    dot(pts[0], '#94a3b8');

    function step() {
      if (stop || i >= n) {
        if (!stop && opts.onDone) opts.onDone();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.strokeStyle = opts.color || '#4c97ff';
      ctx.stroke();
      i++;
      setTimeout(step, opts.speed || 130);
    }
    step();

    return { cancel: function () { stop = true; } };
  }

  /* ── 畫面 ─────────────────────────────────────────── */

  var CSS = [
    '.dv{font-family:"Noto Sans TC",system-ui,sans-serif;color:#1e293b}',
    '.dv-intro{background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;',
    '  padding:12px 14px;font-size:14px;line-height:1.9;margin-bottom:14px}',
    '.dv-step{background:#fff;border:2px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:10px}',
    '.dv-step.on{border-color:#6366f1;box-shadow:0 3px 12px rgba(99,102,241,.13)}',
    '.dv-step.ok{border-color:#34d399;background:#f0fdf4}',
    '.dv-step.off{opacity:.5}',
    '.dv-q{font-size:15px;font-weight:700;line-height:1.8;margin:0 0 10px}',
    '.dv-no{display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;',
    '  border-radius:999px;background:#6366f1;color:#fff;font-size:12px;font-weight:900;margin-right:7px}',
    '.dv-step.ok .dv-no{background:#10b981}',
    '.dv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.dv-in{width:88px;padding:7px 9px;border:2px solid #cbd5e1;border-radius:9px;',
    '  font-size:16px;font-weight:700;text-align:center;font-family:inherit}',
    '.dv-in:focus{outline:none;border-color:#6366f1}',
    '.dv-unit{font-size:14px;color:#64748b}',
    '.dv-btn{background:#6366f1;color:#fff;border:0;border-radius:9px;padding:8px 15px;',
    '  font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.dv-btn:hover{background:#4f46e5}',
    '.dv-btn.ghost{background:#e2e8f0;color:#475569}',
    '.dv-fb{margin-top:9px;font-size:13px;line-height:1.8;padding:8px 11px;border-radius:9px}',
    '.dv-fb.good{background:#dcfce7;color:#166534}',
    '.dv-fb.bad{background:#fef3c7;color:#92400e}',
    '.dv-why{margin-top:8px;font-size:12.5px;color:#64748b;line-height:1.8}',
    '.dv-cv{background:#fff;border:1px solid #e2e8f0;border-radius:12px;display:block;margin-top:10px}',
    /* 除法積木長得和調色盤裡那顆一樣 —— 學生等一下要去拿的就是它。
       ⚠️ 這裡不是裝飾：形狀一致，「原來就是這塊」才連得起來。 */
    '.dv-div{display:inline-flex;align-items:center;gap:6px;background:#59c059;',
    '  border-radius:999px;padding:5px 12px}',
    '.dv-div input{width:66px;padding:5px 7px;border:0;border-radius:999px;text-align:center;',
    '  font-size:15px;font-weight:700;font-family:inherit}',
    '.dv-div span{color:#fff;font-weight:900;font-size:16px}',
    '.dv-tok{background:#ff6680;color:#fff;border:0;border-radius:999px;padding:5px 13px;',
    '  font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.dv-done{background:#dcfce7;border:2px solid #34d399;border-radius:14px;padding:14px 16px;',
    '  font-size:14px;line-height:1.9;color:#166534}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('dv-style')) return;
    var s = document.createElement('style');
    s.id = 'dv-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, data, opts) {
    ensureStyle();
    opts = opts || {};
    data = data || {};
    var steps = data.steps || [];
    var at = 0;                 // 目前做到第幾步
    var anim = null;

    host.className = 'dv';
    host.innerHTML = '';

    if (data.intro) {
      var intro = document.createElement('div');
      intro.className = 'dv-intro';
      intro.innerHTML = data.intro;
      host.appendChild(intro);
    }

    var list = document.createElement('div');
    host.appendChild(list);

    var doneBox = document.createElement('div');
    host.appendChild(doneBox);

    function pass(i) {
      if (i !== at) return;
      at = i + 1;
      render();
      if (at >= steps.length) {
        doneBox.className = 'dv-done';
        doneBox.innerHTML = data.done || '推導完成，接下來把它拼成積木。';
        if (opts.onPass) opts.onPass();
      }
    }

    function render() {
      list.innerHTML = '';
      steps.forEach(function (st, i) {
        /* 只顯示做到的那一步和之前的。
           ★ 為什麼不整頁攤開：後面的題目會把前面的答案講出來
             （「正六邊形每次轉 60 度」這種），先看到就不用想了。 */
        if (i > at) return;
        list.appendChild(stepBox(st, i));
      });
    }

    function stepBox(st, i) {
      var box = document.createElement('div');
      box.className = 'dv-step ' + (i < at ? 'ok' : 'on');
      var head = '<p class="dv-q"><span class="dv-no">' + (i + 1) + '</span>' + st.q + '</p>';

      if (i < at) {
        // 過關的就收起來，只留答案，畫面不會愈滾愈長
        box.innerHTML = head + '<div class="dv-fb good">✓ ' + esc(st._got || '完成') + '</div>' +
          (st.why ? '<div class="dv-why">' + st.why + '</div>' : '');
        return box;
      }

      if (st.kind === 'ask')     box.innerHTML = head + askHtml(st);
      else if (st.kind === 'draw')    box.innerHTML = head + drawHtml(st);
      else if (st.kind === 'formula') box.innerHTML = head + formulaHtml(st);
      wire(box, st, i);
      return box;
    }

    /* ① 純問答：這種是「事實」，畫圖驗不出來（例如「一圈幾度」）*/
    function askHtml(st) {
      return '<div class="dv-row">' +
        '<input class="dv-in" type="number" inputmode="numeric" placeholder="?">' +
        (st.unit ? '<span class="dv-unit">' + esc(st.unit) + '</span>' : '') +
        '<button class="dv-btn" data-go>確定</button></div>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    /* ② 填角度 → 真的畫。過不過由圖形決定，不是由標準答案決定 */
    function drawHtml(st) {
      return '<div class="dv-row">' +
        '<span class="dv-unit">每次右轉</span>' +
        '<input class="dv-in" type="number" inputmode="decimal" placeholder="?">' +
        '<span class="dv-unit">度，走 ' + st.n + ' 條邊</span>' +
        '<button class="dv-btn" data-go>▶ 畫畫看</button></div>' +
        '<canvas class="dv-cv" width="330" height="240"></canvas>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    /* ③ 一般化：寫出算式，代入好幾個邊數一起驗 */
    function formulaHtml(st) {
      var ns = st.tests || [4, 6, 10];
      return '<div class="dv-row">' +
        '<span class="dv-div"><input data-l type="text" inputmode="numeric" placeholder="?">' +
        '<span>/</span><input data-r type="text" placeholder="?"></span>' +
        '<button class="dv-tok" data-fill="N">拿 N 來用</button>' +
        '<button class="dv-btn" data-go>▶ 代進去畫畫看</button></div>' +
        '<div class="dv-unit" style="margin-top:6px;font-size:12.5px">會用 ' +
        ns.join('、') + ' 邊形各畫一次，全部閉合才算對。</div>' +
        '<canvas class="dv-cv" width="330" height="240"></canvas>' +
        '<div class="dv-fb" style="display:none"></div>';
    }

    function wire(box, st, i) {
      var fb = box.querySelector('.dv-fb');
      var cv = box.querySelector('canvas');
      var go = box.querySelector('[data-go]');

      function say(ok, msg) {
        fb.style.display = '';
        fb.className = 'dv-fb ' + (ok ? 'good' : 'bad');
        fb.textContent = (ok ? '✓ ' : '✗ ') + msg;
      }
      function run(n, turn, after) {
        if (anim) anim.cancel();
        anim = draw(cv, n, turn, { onDone: after, color: closes(turn, n) ? '#10b981' : '#f59e0b' });
      }

      if (st.kind === 'ask') {
        var inp = box.querySelector('.dv-in');
        go.onclick = function () {
          var v = parseFloat(inp.value);
          if (!isFinite(v)) return say(false, '先填一個數字。');
          if (Math.abs(v - st.answer) < 1e-9) { st._got = v + (st.unit || ''); pass(i); }
          else say(false, st.miss || '再想一下。');
        };
        inp.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      }

      if (st.kind === 'draw') {
        var inp2 = box.querySelector('.dv-in');
        go.onclick = function () {
          var t = parseFloat(inp2.value);
          if (!isFinite(t)) return say(false, '先填一個角度。');
          run(st.n, t, function () {
            var r = checkAngle(t, st.n);
            say(r.ok, r.msg);
            if (r.ok) { st._got = '每次轉 ' + fmt(t) + ' 度'; setTimeout(function () { pass(i); }, 900); }
          });
        };
        inp2.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      }

      if (st.kind === 'formula') {
        var L = box.querySelector('[data-l]'), R = box.querySelector('[data-r]');
        var tok = box.querySelector('[data-fill]');
        // 「拿 N 來用」：一個按鈕就好，不必要求學生自己打對大小寫
        if (tok) tok.onclick = function () { R.value = 'N'; R.focus(); };
        go.onclick = function () {
          var f = { left: L.value, right: R.value };
          var v = verdict(f, st.tests);
          var n = v.ok ? (st.tests || [4, 6, 10])[1] : v.bad;
          run(n, turnFor(f, n), function () {
            say(v.ok, v.msg);
            if (v.ok) { st._got = fmt(f.left) + ' ÷ ' + String(f.right).trim(); setTimeout(function () { pass(i); }, 900); }
          });
        };
      }
    }

    render();
    return { destroy: function () { if (anim) anim.cancel(); host.innerHTML = ''; } };
  }

  global.DERIVE = {
    VERSION: VERSION,
    mount: mount,
    _turnFor: turnFor,
    _closes: closes,
    _laps: laps,
    _checkAngle: checkAngle,
    _verdict: verdict,
    _polyPath: polyPath
  };

})(typeof window !== 'undefined' ? window : this);
