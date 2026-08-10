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

  /* ── 追蹤每一輪（排序）─────────────────────────────
     ★ 為什麼要有這一步
       排序的難處從來不是「步驟順序」—— 課本把步驟寫得清清楚楚，
       學生照著念也念得出來。難的是「跑完一輪，資料到底變成什麼樣」。
       排流程圖完全碰不到這一點，念一遍步驟也碰不到。
       這裡讓學生一輪一輪自己動手，資料在眼前變。

     ★ 照課本的做法：兩個清單
       課本（翰林 114 資科 2 下 6-2）的選擇排序法是
       「從未排序找到最小值 → 加到已排序的最後一項 → 從未排序刪掉」，
       不是在同一個清單裡對調。兩者都叫選擇排序，但積木完全不同 ——
       這裡跟課本走，學生等一下拼的才是同一件事。 */

  /** 未排序清單裡最小的那幾個位置（可能有並列） */
  function minAt(list) {
    var m = Math.min.apply(null, list.map(function (x) { return num(x); }));
    var out = [];
    list.forEach(function (x, i) { if (num(x) === m) out.push(i); });
    return out;
  }
  function num(x) { return (x && typeof x === 'object') ? Number(x.v) : Number(x); }
  function label(x) { return (x && typeof x === 'object') ? String(x.t) : String(x); }

  /**
   * 學生點了第 i 個，對不對？
   * ★ 錯的時候要說「還有更小的」，不要說「答案是 3」——
   *   直接給位置的話，學生下一輪照樣不會找。
   */
  function pickMin(list, i) {
    if (!list.length) return { ok: false, msg: '沒有東西可以挑了。' };
    var want = minAt(list);
    if (want.indexOf(i) >= 0) return { ok: true, msg: '' };
    var m = num(list[want[0]]);
    return { ok: false, msg: '你選的是 ' + label(list[i]) + '，但還有更小的 —— 再看一次。' +
                            (num(list[i]) < m ? '' : '') };
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
    '  font-size:14px;line-height:1.9;color:#166534}',
    /* 問題拆解：編號用橘色圓圈，和課本「問題拆解①②③」對得起來 */
    '.dv-qs{list-style:none;counter-reset:dvq;margin:0;padding:0}',
    '.dv-qs>li{counter-increment:dvq;position:relative;padding:0 0 0 34px;margin:0 0 12px}',
    '.dv-qs>li::before{content:counter(dvq);position:absolute;left:0;top:1px;width:24px;height:24px;',
    '  border-radius:999px;background:#f97316;color:#fff;font-size:13px;font-weight:900;',
    '  display:flex;align-items:center;justify-content:center}',
    '.dv-qt{font-size:15px;font-weight:700;line-height:1.75;padding-top:2px}',
    '.dv-hint{margin-top:5px}',
    '.dv-hint summary{cursor:pointer;font-size:12.5px;color:#94a3b8;font-weight:700;list-style:none}',
    '.dv-hint summary::-webkit-details-marker{display:none}',
    '.dv-hint summary::before{content:"▸ "}',
    '.dv-hint[open] summary::before{content:"▾ "}',
    '.dv-hint summary:hover{color:#6366f1}',
    '.dv-hint>div{margin-top:5px;background:#f8fafc;border-left:3px solid #cbd5e1;',
    '  border-radius:0 8px 8px 0;padding:8px 12px;font-size:13px;line-height:1.9;color:#475569}',
    /* 圈選：一行一顆，點了會亮起來。長得像積木堆，和下面的拼圖對得起來 */
    '.dv-pick{margin-top:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}',
    '.dv-pt{font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:7px}',
    '.dv-line{display:block;width:100%;text-align:left;margin-bottom:5px;padding:7px 11px;',
    '  border:2px solid #e2e8f0;background:#f8fafc;border-radius:8px;font-size:13.5px;',
    '  font-family:inherit;cursor:pointer;transition:.12s;color:#334155}',
    '.dv-line:hover{border-color:#cbd5e1}',
    '.dv-line.on{background:#eef2ff;border-color:#6366f1;color:#3730a3;font-weight:700}',
    '.dv-line.on::before{content:"✓ ";font-weight:900}',
    /* 先寫再對照 */
    '.dv-write{margin-top:14px;background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:12px 14px}',
    '.dv-write textarea{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 11px;',
    '  border:2px solid #fde68a;border-radius:9px;font-family:inherit;font-size:13.5px;',
    '  line-height:1.8;resize:vertical}',
    '.dv-write textarea:focus{outline:none;border-color:#f59e0b}',
    '.dv-write textarea:disabled{background:#fff;color:#78350f}',
    /* 追蹤每一輪：兩排資料，未排序的可以點 */
    '.dv-round{font-size:12.5px;font-weight:900;color:#6366f1;margin:10px 0 6px}',
    '.dv-row2{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}',
    '.dv-tag{font-size:11px;font-weight:700;color:#64748b;min-width:52px}',
    '.dv-chip{min-width:44px;padding:8px 12px;border:2px solid #cbd5e1;background:#fff;',
    '  border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;color:#334155}',
    '.dv-chip.pickable{cursor:pointer}',
    '.dv-chip.pickable:hover{border-color:#6366f1;background:#eef2ff}',
    '.dv-chip.moved{border-color:#34d399;background:#dcfce7;color:#166534}',
    '.dv-chip.wrong{border-color:#f59e0b;background:#fef3c7}',
    '.dv-empty{font-size:12px;color:#cbd5e1}'
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
      else if (st.kind === 'sort')    box.innerHTML = head + '<div class="dv-sort"></div>' +
                                                      '<div class="dv-fb" style="display:none"></div>';
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

      if (st.kind === 'sort') { wireSort(box, st, i, say, pass); return; }

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

    /* 追蹤每一輪：學生從「未排序」點出最小的，看著它搬到「已排序」。 */
    function wireSort(box, st, i, say, passFn) {
      var left = (st.items || []).slice();      // 未排序
      var right = [];                            // 已排序
      var round = 0;
      var wrap = box.querySelector('.dv-sort');

      draw2();
      function draw2() {
        round++;
        wrap.innerHTML =
          '<div class="dv-round">第 ' + round + ' 回合</div>' +
          row('未排序', left, true) +
          row('已排序', right, false) +
          (left.length ? '<p class="dv-unit" style="font-size:12.5px;margin-top:4px">' +
             '點一下「未排序」裡<b>最小</b>的那一個。</p>' : '');
        [].forEach.call(wrap.querySelectorAll('[data-i]'), function (b) {
          b.onclick = function () { hit(Number(b.dataset.i), b); };
        });
      }
      function row(tag, list, pickable) {
        return '<div class="dv-row2"><span class="dv-tag">' + tag + '</span>' +
          (list.length
            ? list.map(function (x, k) {
                return '<button class="dv-chip' + (pickable ? ' pickable' : ' moved') + '"' +
                  (pickable ? ' data-i="' + k + '"' : '') + '>' + esc(label(x)) + '</button>';
              }).join('')
            : '<span class="dv-empty">（空的）</span>') + '</div>';
      }
      function hit(k, btn) {
        var r = pickMin(left, k);
        if (!r.ok) {
          btn.classList.add('wrong');
          say(false, r.msg);
          setTimeout(function () { btn.classList.remove('wrong'); }, 700);
          return;
        }
        right.push(left.splice(k, 1)[0]);
        if (left.length) {
          say(true, '找到最小值 ' + label(right[right.length - 1]) +
                    '，加到「已排序」的最後一項，並且從「未排序」刪掉。');
          draw2();
        } else {
          wrap.innerHTML = '<div class="dv-round">排好了</div>' + row('已排序', right, false);
          say(true, st.finish || '這就是選擇排序法：每一回合挑出最小的，搬到已排序的最後面。');
          st._got = right.map(label).join('、');
          setTimeout(function () { passFn(i); }, 900);
        }
      }
    }

    render();
    return { destroy: function () { if (anim) anim.cancel(); host.innerHTML = ''; } };
  }

  /* ── 問題拆解（課本的「問題分析」）─────────────────
     把一個大題目切成幾個小問題，這是這一章真正在教的東西
     （運算思維的「問題拆解」），不是拼積木的技巧。

     ★ 為什麼照課本的拆解，不自己排
       學生課堂上聽的、課本上印的就是這幾問。網站自己排一套順序，
       學生要在兩套講法之間翻譯 —— 那是白白多出來的負擔。

     ★ 為什麼提示要收起來
       五個問題連答案一起攤開，就變成「照著抄」。
       先讓學生自己想，想不出來才點開 ——
       點開這個動作本身也讓學生知道自己卡在第幾問。 */
  function renderAnalysis(host, data, opts) {
    ensureStyle();
    opts = opts || {};
    if (!host) return;
    if (!data || !(data.qs || []).length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    host.className = 'dv';

    /* 每一問底下可以掛一個小互動：
         pick  —— 圈出重複的那一段（有標準答案，判得出來）
         沒有掛的就只有問句和提示。
       ★ 為什麼不是每一問都掛
         五問全部要作答會變成問卷。只有「這一關真正的判斷」值得問 ——
         第 1 關是「哪一段一直重複」，第 2 關是「哪個數字每次都不一樣」。 */
    var picksLeft = data.qs.filter(function (x) { return x.pick; }).length;

    host.innerHTML =
      (data.intro ? '<div class="dv-intro">' + data.intro + '</div>' : '') +
      '<ol class="dv-qs">' + data.qs.map(function (it, i) {
        return '<li><div class="dv-qt">' + it.q + '</div>' +
          (it.pick ? pickHtml(it.pick, i) : '') +
          (it.hint
            ? '<details class="dv-hint"><summary>想不出來？點開看提示</summary><div>' +
              it.hint + '</div></details>'
            : '') +
          /* 有 keys 的那幾問才掛 AI ——
             keys 是「這一輪希望學生講到什麼」，沒有它，
             AI 只知道學生寫了什麼、不知道他還缺什麼，問出來會飄。 */
          ((it.keys || []).length ? '<div data-ai="' + i + '"></div>' : '') +
          '</li>';
      }).join('') + '</ol>' +
      (data.write ? writeHtml(data.write) : '') +
      (opts.onDone ? '<div id="dv-go"></div>' : '');

    data.qs.forEach(function (it, i) { if (it.pick) wirePick(host, it.pick, i); });
    wireAsk(host, data, opts);
    if (data.write) wireWrite(host, data.write, opts);
    refreshGo();

    function refreshGo() {
      var box = host.querySelector('#dv-go');
      if (!box || !opts.onDone) return;
      var wroteOk = !data.write || (host.__wrote || '').trim().length >= (data.write.min || 12);
      var ready = picksLeft === 0 && wroteOk;
      box.innerHTML = '<button class="dv-btn" style="width:100%;padding:11px" ' +
        (ready ? '' : 'disabled ') + 'id="dv-godo">' +
        (ready ? '想清楚了，開始動手 →'
               : (picksLeft > 0 ? '上面還有 ' + picksLeft + ' 題沒答對' : '先寫下你的想法'))
        + '</button>';
      var b = box.querySelector('#dv-godo');
      b.style.opacity = ready ? '' : '.5';
      b.style.cursor = ready ? 'pointer' : 'not-allowed';
      if (ready) b.onclick = function () { opts.onDone(host.__wrote || ''); };
    }

    /* 把「問問看」掛上去。
       ★ 為什麼要判 window.ASKAI 在不在
         這一頁在測試裡是單獨載入的（沒有 askai.js、沒有 CONFIG），
         直接呼叫會炸掉 —— 而問題拆解本身不該依賴 AI 才能用。
         AI 是加上去的東西，不是這個功能的前提。
       ★ 為什麼要判 enabled()
         config.js 的 AIGUIDE.KEY 留空 ＝ 這個功能關閉。
         關掉時整塊不出現，而不是出現一個按了會壞的按鈕。 */
    function wireAsk(root, d, o) {
      if (typeof window === 'undefined' || !window.ASKAI || !window.ASKAI.enabled()) return;
      if (!o.unit) return;              // 不知道是哪一關就問不了（GAS 靠它抓題目）
      d.qs.forEach(function (it, i) {
        if (!(it.keys || []).length) return;
        var box = root.querySelector('[data-ai="' + i + '"]');
        if (!box) return;
        window.ASKAI.mount(box, {
          unit: o.unit, qi: i, keys: it.keys, hint: it.hint,
          student: o.student || '',
          onAsked: o.onAsked || null
        });
      });
    }

    function wirePick(root, p, i) {
      var wrap = root.querySelector('[data-pick="' + i + '"]');
      var fb = wrap.querySelector('.dv-fb');
      var done = false;
      wrap.addEventListener('click', function (e) {
        var row = e.target.closest('[data-line]');
        if (row && !done) { row.classList.toggle('on'); return; }
        if (!e.target.closest('[data-check]') || done) return;
        var got = [].slice.call(wrap.querySelectorAll('[data-line].on'))
          .map(function (r) { return Number(r.dataset.line); }).sort();
        var want = (p.answer || []).slice().sort();
        fb.style.display = '';
        if (got.join() === want.join()) {
          done = true; picksLeft--;
          fb.className = 'dv-fb good';
          fb.innerHTML = '✓ ' + (p.ok || '對了。');
          wrap.querySelector('[data-check]').remove();
          refreshGo();
        } else {
          fb.className = 'dv-fb bad';
          fb.innerHTML = '✗ ' + missMsg(p, got, want);
        }
      });
    }

    function wireWrite(root, w, o) {
      var ta = root.querySelector('#dv-write');
      var btn = root.querySelector('#dv-wbtn');
      var out = root.querySelector('#dv-wout');
      btn.onclick = function () {
        var t = ta.value.trim();
        if (t.length < (w.min || 12)) {
          out.style.display = '';
          out.className = 'dv-fb bad';
          out.textContent = '再多寫一點 —— 至少 ' + (w.min || 12) + ' 個字。（現在 ' + t.length + ' 個字）';
          return;
        }
        host.__wrote = t;
        ta.disabled = true; btn.remove();
        out.style.display = '';
        out.className = 'dv-fb good';
        /* ★ 寫完才顯示課本的說法。
             先給答案的話，學生會照抄；而這一步的重點是「先有自己的想法」，
             寫得對不對反而是其次 —— 所以不判分，只讓他自己比對。 */
        out.innerHTML = '<b>你寫的：</b>' + esc(t) + '<div style="margin-top:8px">' +
          '<b>課本是這樣說的：</b>' + w.sample + '</div>' +
          '<div style="margin-top:6px;font-size:12px;opacity:.75">兩邊不一樣沒關係 —— 講得出自己的理由才是重點。</div>';
        if (o.onWrite) o.onWrite(t);
        refreshGo();
      };
    }
  }

  /** 圈選題：哪幾行是一直重複的 */
  function pickHtml(p, i) {
    return '<div class="dv-pick" data-pick="' + i + '">' +
      '<div class="dv-pt">' + (p.prompt || '點選你認為對的那幾行') + '</div>' +
      (p.lines || []).map(function (t, k) {
        return '<button data-line="' + k + '" class="dv-line">' + t + '</button>';
      }).join('') +
      '<button data-check class="dv-btn" style="margin-top:8px">確定</button>' +
      '<div class="dv-fb" style="display:none"></div></div>';
  }

  /* 錯的時候要講「哪裡不一樣」，不是只說錯。
     多選了或少選了是兩種不同的誤解，講反了會把學生推向反方向。 */
  function missMsg(p, got, want) {
    var extra = got.filter(function (x) { return want.indexOf(x) < 0; });
    var less = want.filter(function (x) { return got.indexOf(x) < 0; });
    if (extra.length && p.tooMany) return p.tooMany;
    if (less.length && p.tooFew) return p.tooFew;
    if (extra.length) return '多選了 ' + extra.length + ' 行。再想想那一行是不是這件事的一部分。';
    return '還少了 ' + less.length + ' 行。';
  }

  function writeHtml(w) {
    return '<div class="dv-write">' +
      '<div class="dv-qt">✍️ ' + w.q + '</div>' +
      '<textarea id="dv-write" rows="3" placeholder="用你自己的話寫，寫完才會看到課本怎麼說"></textarea>' +
      '<button id="dv-wbtn" class="dv-btn" style="margin-top:8px">寫好了，看看課本怎麼說</button>' +
      '<div id="dv-wout" class="dv-fb" style="display:none"></div></div>';
  }

  global.DERIVE = {
    VERSION: VERSION,
    mount: mount,
    renderAnalysis: renderAnalysis,
    _turnFor: turnFor,
    _closes: closes,
    _laps: laps,
    _checkAngle: checkAngle,
    _verdict: verdict,
    _polyPath: polyPath,
    _minAt: minAt,
    _pickMin: pickMin
  };

})(typeof window !== 'undefined' ? window : this);
