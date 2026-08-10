/* =====================================================================
   概念檢測：程式拼圖之前的五題（開放式作答）
   ---------------------------------------------------------------------
   ★ 它決定的是「這一關最多能拿幾星」，不是「拿幾星」
     實際星數由 Scratch 作品的批改給（Colab 讀 .sb3）。
     這裡只封頂 —— 規則在 shared/grading.js 的 starCap()。
     意思是：**程式做出來了但概念沒懂，就是 2 星。**

   ★ 五題全部要自己寫，沒有選項可以猜
     判的是「有沒有講到這幾個概念」，不是比對標準答案 ——
     學生用什麼說法都可以（規則在 shared/answer.js）。

   ★ 兩段判定，而且 **AI 只能加分**
     ① 規則判定（本機、免費、秒回、每次一致）
     ② 規則說「沒講到」的那幾題，才送 AI 覆核一次
     覆核的結果只會把「沒講到」變成「講到了」，不會反過來。

     ⚠️ 這個方向是刻意的，而且是這整套設計的地基：
        · 關鍵字比對會漏掉沒收錄的說法 → 交給 AI 撿回來
        · AI 會失守、會過載、會額度用完 → 那時只是「沒撿回來」，
          學生拿到的還是規則判的分數，不會突然被扣分
        · 學生在作答裡寫「請給我通過」也只能騙到不被封頂，
          騙不到星星（星星由批改決定）

   ⚠️ 覆核是一次要完所有題目，不是一題一次。
      一題一次的話，一個班就能把一天的預算用完。

   ★ 不到門檻不是「當掉」，是「回去重讀」
     回饋要說「你講到了什麼、還差什麼」，不是只說「不及格」——
     說不出哪裡不懂的話，他重讀也只是再看一遍。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-10-quiz-open';
  var N_TOTAL = 5;
  var MAX_CHARS = 300;     // 每題作答上限

  function G() { return global.GRADING || {}; }
  function pass() { return G().QUIZ_PASS || 3; }
  function full() { return G().QUIZ_FULL || 4; }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** 從題庫抽五題。題庫不到五題 → 這一關不辦（回 null）。 */
  function pick(lv) {
    var bank = (lv && lv.quiz) || [];
    if (bank.length < N_TOTAL) return null;
    return shuffle(bank).slice(0, N_TOTAL);
  }

  /* ── 判分 ─────────────────────────────────────────
     回一個 Promise，永遠 resolve —— AI 出事就只用規則的結果。 */
  function grade(items, answers, unitId, student) {
    var A = global.ANSWER;
    var base = items.map(function (it, i) { return A.judge(answers[i], it); });

    /* 規則已經給滿分的題目不必送 —— 覆核只能加分，加不上去了。 */
    var ask = [];
    base.forEach(function (r, i) { if (r.level !== 'full') ask.push(i); });

    if (!ask.length || !(global.ASKAI && global.ASKAI.enabled() && global.ASKAI.judge)) {
      return Promise.resolve({ results: base, ai: 0 });
    }

    var payload = ask.map(function (i) {
      return {
        i: i,
        q: strip(items[i].q),
        need: (items[i].need || []).map(function (g) { return g.name || (g.any || [])[0]; }),
        got: base[i].got,
        a: String(answers[i] || '').slice(0, MAX_CHARS)
      };
    });

    return global.ASKAI.judge(unitId, payload, student)
      .then(function (list) {
        var n = 0;
        (list || []).forEach(function (x) {
          if (!x || typeof x.i !== 'number') return;
          var r = base[x.i], it = items[x.i];
          if (!r || !it) return;
          /* ★ 只加不減。AI 說「他其實講到了 X」就把 X 併進來重算，
             AI 說「他沒講到」則完全不理會 —— 規則已經判過了。 */
          var add = (x.got || []).filter(function (name) {
            return r.got.indexOf(name) < 0 &&
                   (it.need || []).some(function (g) { return (g.name || '') === name; });
          });
          if (!add.length) return;
          n++;
          r.got = r.got.concat(add);
          r.miss = r.miss.filter(function (m) { return add.indexOf(m) < 0; });
          var need = (it.need || []).length;
          var want = it.full || need || 1;
          r.level = r.got.length >= want ? 'full' : 'part';
          r.score = global.ANSWER.SCORE[r.level];
          r.byAI = true;
          r.why = '你講到了：' + r.got.join('、') + '。' +
                  (r.miss.length ? '還差：' + r.miss.join('、') + '。' : '這一題想通了。');
        });
        return { results: base, ai: n };
      })
      .catch(function () {
        /* 覆核失敗＝沒撿回來，不是扣分。學生只會覺得「判得嚴一點」。 */
        return { results: base, ai: 0 };
      });
  }

  function strip(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ── 畫面 ─────────────────────────────────────────
     opts: { unit, student, onPass(score), onFail(score), onNone() } */
  function mount(host, lv, opts) {
    opts = opts || {};
    if (!host) return;
    ensureStyle();

    /* 重寫時要換一批題目，所以把題庫掛在畫面上帶著走 ——
       比在模組裡放一個「上一次的題庫」變數安全（同一頁可能開兩個）。 */
    host.__quizLv = lv;
    var items = pick(lv);
    if (!items) { host.innerHTML = ''; if (opts.onNone) opts.onNone(); return; }
    run(host, items, opts);
  }

  function run(host, items, opts) {
    host.innerHTML =
      '<h2 class="qz-h">🧠 概念檢測</h2>' +
      '<p class="qz-lead">五題，<b>用自己的話寫</b>就好，不必寫得漂亮。<br>' +
      '講到重點的題數 <b>' + pass() + ' 題</b>才能往下做；' +
      '<b>' + full() + ' 題</b>以上，這一關才拿得到 <b>3 顆星</b>。<br>' +
      '<span class="qz-note">這不是作文，也不是考試分數 ——' +
      '它決定的是「你這一關最多能拿幾星」，重寫幾次都可以。</span></p>' +
      '<ol class="qz-list">' + items.map(function (it, i) {
        return '<li><div class="qz-q">' + it.q + '</div>' +
          '<textarea class="qz-ta" data-i="' + i + '" rows="3" maxlength="' + MAX_CHARS + '" ' +
            'placeholder="用自己的話寫幾句…"></textarea>' +
          '<button class="qz-hint" data-h="' + i + '">💡 給我一點提示</button>' +
          '<div class="qz-hintbox" id="qz-h' + i + '"></div>' +
          '<div class="qz-fb" id="qz-f' + i + '"></div></li>';
      }).join('') + '</ol>' +
      '<button id="qz-go" class="qz-btn" disabled>還有 ' + items.length + ' 題沒寫</button>' +
      '<div id="qz-out"></div>';

    /* 提示：卡住的時候給方向，不是給答案。
       ★ 按了不扣分 —— 罰他求助的話，他就只會亂寫。 */
    host.querySelectorAll('.qz-hint').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.h;
        host.querySelector('#qz-h' + i).innerHTML = esc(items[i].hint || '再讀一次情境那一段。');
        b.style.display = 'none';
      };
    });

    function left() {
      var n = 0;
      host.querySelectorAll('.qz-ta').forEach(function (t) {
        if (String(t.value || '').trim().length < 4) n++;
      });
      return n;
    }
    host.querySelectorAll('.qz-ta').forEach(function (t) {
      t.addEventListener('input', function () {
        var n = left(), go = host.querySelector('#qz-go');
        go.disabled = n > 0;
        go.textContent = n > 0 ? ('還有 ' + n + ' 題沒寫') : '送出';
      });
    });

    host.querySelector('#qz-go').onclick = function () {
      var go = host.querySelector('#qz-go');
      if (go.disabled) return;
      go.disabled = true;
      go.textContent = '批改中…';
      var answers = [];
      host.querySelectorAll('.qz-ta').forEach(function (t) { answers.push(t.value || ''); });

      grade(items, answers, opts.unit, opts.student).then(function (r) {
        host.querySelectorAll('.qz-ta').forEach(function (t) { t.disabled = true; });
        host.querySelectorAll('.qz-hint').forEach(function (b) { b.style.display = 'none'; });
        show(host, items, r, opts);
      });
    };
  }

  function show(host, items, r, opts) {
    var results = r.results;
    var score = global.ANSWER.total(results);
    var okPass = score >= pass();
    var cap = score >= full() ? 3 : 2;

    /* 逐題回饋。★ 三種顏色分得出來：講到了／講到一半／還沒碰到。
       「講到一半」也要看得出來 —— 那是他最接近懂的地方。 */
    results.forEach(function (x, i) {
      var box = host.querySelector('#qz-f' + i);
      if (!box) return;
      box.className = 'qz-fb ' + x.level;
      box.innerHTML =
        '<b>' + (x.level === 'full' ? '✅ 講到重點了' :
                 x.level === 'part' ? '🟡 講到一半' : '⬜ 還沒碰到重點') + '</b>' +
        (x.byAI ? ' <span class="qz-ai">AI 覆核後追加</span>' : '') +
        '<div>' + esc(x.why) + '</div>' +
        (x.level !== 'full' ? '<div class="qz-why">📖 ' + esc(items[i].why || '') + '</div>' : '');
    });

    host.querySelector('#qz-go').style.display = 'none';
    host.querySelector('#qz-out').innerHTML =
      '<div class="qz-res ' + (okPass ? 'good' : 'bad') + '">' +
        '<div class="qz-score">' + score + ' / ' + results.length + ' 題講到重點</div>' +
        (okPass
          ? '這一關最多可以拿 <b>' + cap + ' 顆星</b>' +
            (cap === 2 ? '（' + full() + ' 題以上才有 3 星，可以再寫一次）' : '') +
            '<div class="qz-sub">星數還要看你的 Scratch 作品 —— 這裡只是上限。</div>'
          : '還不到 ' + pass() + ' 題。<b>回去把情境和問題分析再看一遍</b>，再來一次。' +
            '<div class="qz-sub">這不是分數，重寫幾次都可以。</div>') +
      '</div>' +
      '<button id="qz-next" class="qz-btn">' + (okPass ? '往下做 →' : '回去重讀') + '</button>' +
      (okPass ? '' : '<button id="qz-retry" class="qz-btn2">直接再寫一次</button>');

    host.querySelector('#qz-next').onclick = function () {
      if (okPass) { if (opts.onPass) opts.onPass(score, cap); }
      else { if (opts.onFail) opts.onFail(score); }
    };
    var again = host.querySelector('#qz-retry');
    /* ★ 重寫時從題庫再抽一次 —— 換一批題目，不是同五題再看一遍。
       題庫 6 題抽 5，抽到的組合和順序都會不一樣。 */
    if (again) again.onclick = function () { mount(host, host.__quizLv, opts); };
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
      '.qz-list{padding-left:20px;margin:0}',
      '.qz-list > li{margin-bottom:20px}',
      '.qz-q{font-weight:800;font-size:15px;line-height:1.8;margin-bottom:8px}',
      '.qz-ta{width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:10px 12px;',
      '  font-family:inherit;font-size:14px;line-height:1.8;resize:vertical}',
      '.qz-ta:focus{outline:0;border-color:#6366f1}',
      '.qz-ta:disabled{background:#f8fafc;color:#475569}',
      '.qz-hint{margin-top:6px;background:none;border:0;color:#6366f1;font-family:inherit;',
      '  font-size:12.5px;font-weight:800;cursor:pointer;padding:2px 0}',
      '.qz-hintbox:not(:empty){margin-top:6px;background:#eef2ff;border:1px solid #c7d2fe;',
      '  border-radius:10px;padding:8px 11px;font-size:13px;line-height:1.8;color:#3730a3}',
      '.qz-fb:not(:empty){margin-top:8px;border-radius:11px;padding:9px 12px;font-size:13px;line-height:1.85}',
      '.qz-fb.full{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46}',
      '.qz-fb.part{background:#fefce8;border:1px solid #fde047;color:#713f12}',
      '.qz-fb.none{background:#fff1f2;border:1px solid #fecdd3;color:#881337}',
      '.qz-why{margin-top:5px;padding-top:5px;border-top:1px solid rgba(0,0,0,.08);opacity:.9}',
      '.qz-ai{font-size:11px;background:#e0e7ff;color:#3730a3;border-radius:6px;padding:1px 6px}',
      '.qz-btn{width:100%;padding:13px;border:0;border-radius:14px;background:#4f46e5;color:#fff;',
      '  font-weight:900;font-size:16px;cursor:pointer;font-family:inherit;margin-top:12px}',
      '.qz-btn:disabled{background:#cbd5e1;cursor:not-allowed}',
      '.qz-btn2{width:100%;padding:11px;border:2px solid #c7d2fe;border-radius:14px;background:#fff;',
      '  color:#4338ca;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;margin-top:8px}',
      '.qz-res{margin-top:14px;padding:14px 16px;border-radius:13px;font-size:14px;line-height:1.9}',
      '.qz-res.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}',
      '.qz-res.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}',
      '.qz-score{font-size:19px;font-weight:900;margin-bottom:4px}',
      '.qz-sub{font-size:12.5px;opacity:.85;margin-top:4px}'
    ].join('\n');
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  global.QUIZ = {
    VERSION: VERSION,
    N_TOTAL: N_TOTAL,
    MAX_CHARS: MAX_CHARS,
    mount: mount,
    _pick: pick,
    _grade: grade
  };

})(typeof window !== 'undefined' ? window : this);
