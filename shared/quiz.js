/* =====================================================================
   概念檢測：程式拼圖之前的五題
   ---------------------------------------------------------------------
   ★ 它決定的是「這一關最多能拿幾星」，不是「拿幾星」
     實際星數由 Scratch 作品的批改給（Colab 讀 .sb3）。
     這裡只封頂 —— 規則在 shared/grading.js 的 starCap()。
     意思是：**程式做出來了但概念沒懂，就是 2 星。**

   ★ 題目：題庫 2 題 ＋ AI 3 題
     · 題庫那 2 題是老師寫的，每個學生都一樣、可以事先審、不花額度
     · AI 那 3 題針對這一關的重點即時出，比較難背

   ⚠️ AI 出的題目**一定要能在本機判分**，所以要求它回「選擇題＋正解」。
      開放式問答在這裡不能用 —— 那會變成「AI 評分決定成績」，
      而 AI 會失守、會過載、會額度用完（2026-08-07 全都遇過）。

   ⚠️ AI 失敗（額度、過載、格式不對）→ **整份退回題庫**。
      學生不該因為 AI 今天不舒服就考不了試、拿不到星。
      所以每一關的題庫至少要有 5 題。

   ★ 不到門檻不是「當掉」，是「回去重讀」
     訊息要講「哪個概念還沒穩」，不是只說「不及格」——
     說不出哪裡不懂的話，他重讀也只是再看一遍。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-10-quiz';
  var N_AI = 3;            // 想跟 AI 要幾題
  var N_TOTAL = 5;

  function G() { return global.GRADING || {}; }
  function pass() { return G().QUIZ_PASS || 3; }
  function full() { return G().QUIZ_FULL || 4; }

  /* 洗牌。★ 選項順序固定的話，第二次考會變成「背 B」。 */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** 一題：{ q, options:[…], answer:正解的原文 } → 洗過選項的題目 */
  function prep(item) {
    var ans = item.options[item.answer];
    var opts = shuffle(item.options);
    return { q: item.q, options: opts, answer: opts.indexOf(ans), why: item.why || '' };
  }

  /* ── 題目從哪來 ───────────────────────────────────
     回一個 Promise，永遠會 resolve —— AI 出事就整份用題庫。 */
  function build(lv, unitId, student) {
    var bank = (lv && lv.quiz) || [];
    if (bank.length < N_TOTAL) {
      /* 題庫不足 5 題就不辦這一關的概念檢測 —— 硬湊會出現重複題。
         ⚠️ 不是「少考幾題」：題數變動的話，「答對 3 題」的意義就不固定了。 */
      return Promise.resolve(null);
    }
    var fixed = shuffle(bank).slice(0, N_TOTAL - N_AI).map(prep);

    if (!(global.ASKAI && global.ASKAI.enabled() && global.ASKAI.quiz)) {
      return Promise.resolve({ items: shuffle(fixed.concat(shuffle(bank).slice(N_TOTAL - N_AI, N_TOTAL).map(prep))), ai: 0 });
    }
    return global.ASKAI.quiz(unitId, N_AI, student)
      .then(function (list) {
        var ok = (list || []).filter(valid).slice(0, N_AI).map(prep);
        if (ok.length < N_AI) throw new Error('AI 回的題目不夠或格式不對');
        return { items: shuffle(fixed.concat(ok)), ai: ok.length };
      })
      .catch(function () {
        /* 退回全題庫。學生完全感覺不到 AI 出過事 —— 這是刻意的。 */
        var rest = shuffle(bank).slice(0, N_TOTAL).map(prep);
        return { items: rest, ai: 0 };
      });
  }

  /** AI 回來的東西長得對不對。⚠️ 只要有一題不對就整份不用。 */
  function valid(x) {
    return x && typeof x.q === 'string' && x.q.length > 4
        && Array.isArray(x.options) && x.options.length === 4
        && x.options.every(function (o) { return typeof o === 'string' && o.length > 0; })
        && typeof x.answer === 'number' && x.answer >= 0 && x.answer < 4;
  }

  /* ── 畫面 ─────────────────────────────────────────
     opts: { unit, student, hint, onPass(score), onFail(score), onNone() } */
  function mount(host, lv, opts) {
    opts = opts || {};
    if (!host) return;
    ensureStyle();
    host.innerHTML = '<p class="qz-load">出題中…</p>';

    build(lv, opts.unit, opts.student).then(function (set) {
      if (!set) { host.innerHTML = ''; if (opts.onNone) opts.onNone(); return; }
      run(host, set, opts);
    });
  }

  function run(host, set, opts) {
    var items = set.items;
    var picked = items.map(function () { return -1; });

    host.innerHTML =
      '<h2 class="qz-h">✅ 概念檢測</h2>' +
      '<p class="qz-lead">五題，答對 <b>' + pass() + ' 題</b>才能往下做；' +
      '答對 <b>' + full() + ' 題</b>以上，這一關才拿得到 <b>3 顆星</b>。<br>' +
      '<span class="qz-note">這不是考試分數 —— 它決定的是「你這一關最多能拿幾星」。</span></p>' +
      '<ol class="qz-list">' + items.map(function (it, i) {
        return '<li><div class="qz-q">' + esc(it.q) + '</div>' +
          '<div class="qz-opts" data-q="' + i + '">' + it.options.map(function (o, j) {
            return '<button class="qz-o" data-i="' + j + '">' + esc(o) + '</button>';
          }).join('') + '</div></li>';
      }).join('') + '</ol>' +
      '<div class="qz-foot"><button id="qz-go" class="qz-btn" disabled>還有 ' + items.length + ' 題沒作答</button></div>' +
      '<div id="qz-out"></div>';

    host.querySelectorAll('.qz-opts').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.qz-o');
        if (!b || host.__locked) return;
        box.querySelectorAll('.qz-o').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        picked[+box.dataset.q] = +b.dataset.i;
        var left = picked.filter(function (x) { return x < 0; }).length;
        var go = host.querySelector('#qz-go');
        go.disabled = left > 0;
        go.textContent = left > 0 ? ('還有 ' + left + ' 題沒作答') : '送出';
      });
    });

    host.querySelector('#qz-go').onclick = function () {
      host.__locked = true;
      var score = 0;
      items.forEach(function (it, i) {
        var box = host.querySelectorAll('.qz-opts')[i];
        var right = it.answer === picked[i];
        if (right) score++;
        /* ★ 對錯都要標出來，而且要標出「正解是哪一個」——
           只告訴他錯了，他重讀時不知道要找什麼。 */
        box.querySelectorAll('.qz-o').forEach(function (b, j) {
          if (j === it.answer) b.classList.add('right');
          else if (j === picked[i]) b.classList.add('wrong');
          b.disabled = true;
        });
      });
      show(host, items, picked, score, opts);
    };
  }

  function show(host, items, picked, score, opts) {
    var out = host.querySelector('#qz-out');
    var okPass = score >= pass();
    var cap = score >= full() ? 3 : 2;
    var wrong = items.filter(function (it, i) { return it.answer !== picked[i]; });

    out.innerHTML =
      '<div class="qz-res ' + (okPass ? 'good' : 'bad') + '">' +
        '<div class="qz-score">答對 ' + score + ' / ' + items.length + '</div>' +
        (okPass
          ? '這一關最多可以拿 <b>' + cap + ' 顆星</b>' +
            (cap === 2 ? '（答對 ' + full() + ' 題以上才有 3 星）' : '') +
            '<div class="qz-sub">星數還要看你的 Scratch 作品 —— 這裡只是上限。</div>'
          : '還不到 ' + pass() + ' 題。<b>回去把情境和問題分析再看一遍</b>，再來一次。' +
            '<div class="qz-sub">這不是分數，重考幾次都可以。</div>') +
        (wrong.length ? '<div class="qz-miss"><b>還沒穩的地方：</b><ul>' +
          wrong.map(function (w) { return '<li>' + esc(w.why || w.q) + '</li>'; }).join('') +
          '</ul></div>' : '') +
      '</div>' +
      '<button id="qz-next" class="qz-btn">' +
        (okPass ? '往下做 →' : '回去重讀') + '</button>';

    out.querySelector('#qz-next').onclick = function () {
      if (okPass) { if (opts.onPass) opts.onPass(score, cap); }
      else { if (opts.onFail) opts.onFail(score); }
    };
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  var styled = false;
  function ensureStyle() {
    if (styled || typeof document === 'undefined') return;
    styled = true;
    var css = [
      '.qz-h{font-size:20px;font-weight:900;margin:0 0 8px}',
      '.qz-lead{font-size:14px;line-height:1.9;color:#475569;margin:0 0 16px}',
      '.qz-note{font-size:12.5px;color:#64748b}',
      '.qz-load{color:#94a3b8;font-size:14px}',
      '.qz-list{padding-left:20px;margin:0}',
      '.qz-list > li{margin-bottom:18px}',
      '.qz-q{font-weight:800;font-size:15px;line-height:1.8;margin-bottom:8px}',
      '.qz-opts{display:grid;gap:7px}',
      '.qz-o{text-align:left;padding:9px 13px;border:2px solid #e2e8f0;border-radius:11px;',
      '  background:#fff;font-family:inherit;font-size:14px;line-height:1.7;cursor:pointer}',
      '.qz-o:hover:not(:disabled){border-color:#a5b4fc}',
      '.qz-o.on{border-color:#6366f1;background:#eef2ff}',
      '.qz-o.right{border-color:#10b981;background:#ecfdf5}',
      '.qz-o.wrong{border-color:#f43f5e;background:#fff1f2}',
      '.qz-o:disabled{cursor:default}',
      '.qz-foot{margin-top:6px}',
      '.qz-btn{width:100%;padding:13px;border:0;border-radius:14px;background:#4f46e5;color:#fff;',
      '  font-weight:900;font-size:16px;cursor:pointer;font-family:inherit;margin-top:10px}',
      '.qz-btn:disabled{background:#cbd5e1;cursor:not-allowed}',
      '.qz-res{margin-top:14px;padding:14px 16px;border-radius:13px;font-size:14px;line-height:1.9}',
      '.qz-res.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}',
      '.qz-res.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}',
      '.qz-score{font-size:19px;font-weight:900;margin-bottom:4px}',
      '.qz-sub{font-size:12.5px;opacity:.85;margin-top:4px}',
      '.qz-miss{margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.1);font-size:13px}',
      '.qz-miss ul{margin:4px 0 0;padding-left:20px}'
    ].join('\n');
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  global.QUIZ = {
    VERSION: VERSION,
    N_TOTAL: N_TOTAL,
    N_AI: N_AI,
    mount: mount,
    _build: build,
    _valid: valid,
    _prep: prep
  };

})(typeof window !== 'undefined' ? window : this);
