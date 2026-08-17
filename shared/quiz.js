/* =====================================================================
   概念檢測：程式拼圖之前的五題（開放式作答）
   ---------------------------------------------------------------------
   ★ 它自己有一組星星：🧠 概念星（0～3）
     和 🧩 作品星（Scratch 批改給的）分開算，就像 11501 的
     「流程圖星星 ＋ Scratch 星星」。規則在 shared/grading.js 的 quizStars()。
     ⚠️ 依序開放**只看作品星** —— 概念檢測可以一直重寫到過為止，
        拿它當開關的鑰匙等於沒有鎖。概念星是成就，不是通行證。

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
        · 學生在作答裡寫「請給我通過」，騙到的只有概念星，
          騙不到作品星（那是 Colab 讀 .sb3 判的），也騙不到關卡的開放

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
  /** 這一份作答「連送去覆核都不值得」嗎：太短，而且一個概念都沒沾到。 */
  function tooThin(text, it, r) {
    var n = String(text || '').replace(/\s/g, '').length;
    return n < (it.min || 8) && !(r.got || []).length;
  }

  function grade(items, answers, unitId, student, lv) {
    var A = global.ANSWER;
    /* ★ 把「這一題看得到的提示」一起交給判定當**抄襲來源**。
       提示裡本來就含有想聽到的說法 —— 不比對的話，
       整個流程會變成「按提示 → 複製 → 貼上 → 通過」。 */
    var base = items.map(function (it, i) {
      return A.judge(answers[i], Object.assign({}, it, {
        src: [strip(it.q), strip(it.hint), strip(refBox(lv, it.ref))]
      }));
    });

    /* 規則已經給滿分的題目不必送 —— 覆核只能加分，加不上去了。
       ★ 也不送「根本沒寫幾個字、而且一個概念都沒沾到」的那些（2026-08-11）。
         覆核要撿回來的是「他講對了，只是用了我沒收錄的說法」——
         六個字又什麼都沒講到的答案，沒有東西可以撿。
         送出去只是白花額度（而額度是全班共用的），
         還會排在真正需要覆核的人前面。
       ⚠️ 判斷條件是「太短**而且**沒沾到任何概念」，兩個都要成立。
          只看字數的話會殺掉「省事啊」這種三個字但講到重點的答案 ——
          answer.js 的規矩是「講到概念就不套用字數限制」，這裡不可以自己另立一套。 */
    var ask = [];
    base.forEach(function (r, i) {
      if (r.level === 'full') return;
      if (tooThin(answers[i], items[i], r)) return;
      ask.push(i);
    });

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
          /* ⚠️ 一樣不可以把「還差什麼」的名稱講出來（見 answer.js 的 whyOf）——
             那是這一題的答案，講出來學生貼上去就過了。 */
          r.why = '你講到了：' + r.got.join('、') + '。' +
                  (r.miss.length ? '還有 ' + r.miss.length + ' 個重點沒講到。' : '這一題想通了。');
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
    run(host, items, opts, lv);
  }

  /* ── 提示：把「問題分析」那一步的說明搬過來 ─────────
     ★ 概念檢測問的東西，本來就是問題分析想過的東西。
       兩邊各講各的話，學生會覺得這是兩件事、要各背一次。
       所以每一題可以標一個 ref，指回它對應的那一問：
         數字     → analysis.qs[n] 的提示
         'write'  → analysis.write（那一段的收尾）
         'scene'  → 情境解說的「為什麼要學這個」
         'lab'    → 互動實驗室那一步的規則與說明（第 6 章那五關）
         'derive' → 推導那一步自己推出來的結論（第 3、4、5 關）
     ⚠️ 這不是給答案 —— 引的是那一問的**提示**，不是正解。
        引錯來源（例如把 pick 的答案端出來）會直接毀掉這一題。

     ⚠️ 2026-08-12 抓到：'lab' 一直沒被處理，所以第 6 章那五關的
        20 道題**引用框全是空的** —— 而空的引用框不會報錯，
        只是安靜地什麼都不顯示，看起來就像「這一題本來就沒有出處」。 */
  function refBox(lv, ref) {
    if (ref === undefined || ref === null || !lv) return '';
    var a = lv.analysis || {};
    var label = '', body = '';
    if (ref === 'scene') {
      label = '🎬 情境解說裡說過';
      body = (lv.scene || {}).why || '';
    } else if (ref === 'write') {
      label = '🔍 問題分析最後那一題';
      body = (a.write || {}).q || '';
    } else if (ref === 'lab' && lv.lab) {
      /* 實驗室的規則寫在模組裡（SORTLAB／SEARCHLAB 的 INFO），
         不在關卡資料裡 —— 抄一份到這邊的話，改規則就會有一邊忘記。
         ⚠️ 模組不一定載得到（單元測試就沒有），所以要有退路。 */
      var mod = (lv.lab.kind === 'search') ? global.SEARCHLAB
              : (lv.lab.kind === 'logic') ? global.LOGICLAB : global.SORTLAB;
      var info = mod && mod.INFO && mod.INFO[lv.lab.mode];
      label = '🕹️ 你在「動手試一次」做過的';
      body = info ? (info.rule + '<br>' + info.why) : '';
      /* ⚠️ 邏輯實驗室（第 4 關）沒有 INFO —— 它的說明長在 FORMS 裡，
         一種條件一條。整份端出來太長，取「且／或」那兩條就夠 ——
         第 4 關的條件題問的就是它們。 */
      if (!body && mod && mod.FORMS) {
        body = mod.FORMS.filter(function (f) { return f.type === 'and' || f.type === 'or'; })
                        .map(function (f) { return f.rule; }).join('<br>');
      }
      if (!body) body = (lv.scene || {}).pre || '';
    } else if (ref === 'derive' && lv.derive) {
      /* ★ 推導那一步是學生**自己按出來**的結論（第 3、4、5 關）。
         概念題引它，比引情境解說更準 —— 情境是老師講的，推導是他自己得到的。
         ⚠️ 引的是 done（那一步的收尾），不是 steps 裡的答案。 */
      label = '🧪 你在「自己推一次」得到的';
      body = lv.derive.done || lv.derive.intro || '';
    } else if (typeof ref === 'number' && (a.qs || [])[ref]) {
      label = '🔍 問題分析第 ' + (ref + 1) + ' 題';
      body = (a.qs[ref].q || '') + (a.qs[ref].hint ? '<br>' + a.qs[ref].hint : '');
    }
    if (!body) return '';
    return '<div class="qz-ref"><b>' + label + '：</b><br>' + body + '</div>';
  }

  function run(host, items, opts, lv) {
    host.innerHTML =
      '<h2 class="qz-h">🧠 概念檢測</h2>' +
      '<p class="qz-lead">五題，<b>用自己的話寫</b>就好，不必寫得漂亮。<br>' +
      '講到重點的題數 <b>' + pass() + ' 題</b>才能往下做；' +
      '講到 <b>' + full() + ' 題</b>拿 2 顆星，<b>五題全講到</b>拿 3 顆星。<br>' +
      '<span class="qz-note">這不是作文，也不是考試分數 —— ' +
      '它算的是 🧠 概念星，和作品的 🧩 星星分開。重寫幾次都可以。</span></p>' +
      '<ol class="qz-list">' + items.map(function (it, i) {
        return '<li><div class="qz-q">' + it.q + '</div>' +
          /* ★ 最少字數要寫在框裡。
             學生按了送出才被告知「至少 N 個字」，等於罰他不知道規則。 */
          '<textarea class="qz-ta" data-i="' + i + '" data-min="' + (it.min || 8) + '" ' +
            'rows="3" maxlength="' + MAX_CHARS + '" ' +
            'placeholder="用自己的話寫幾句（至少 ' + (it.min || 8) + ' 個字）…"></textarea>' +
          /* ★ 字數就在框子底下即時算（2026-08-11）。
             以前要按了送出、等批改跑完，才被告知「至少 N 個字」——
             那等於用一次批改去告訴他一件他早就該看得到的事。 */
          '<div class="qz-cnt" id="qz-c' + i + '"></div>' +
          /* ★ 按鈕上要講明它會給什麼。
             只寫「提示」的話，學生不知道值不值得按 ——
             而這一顆給的是「問題分析那一步已經講過的東西」，
             那正是他現在需要的。 */
          '<button class="qz-hint" data-h="' + i + '">💡 提示（回頭看問題分析）</button>' +
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
        host.querySelector('#qz-h' + i).innerHTML =
          esc(items[i].hint || '再讀一次情境那一段。') + refBox(lv, items[i].ref);
        b.style.display = 'none';
      };
    });

    /* ── 字數的即時回饋 ───────────────────────────────
       ★ 三種狀態，刻意分清楚：
           沒寫       → 灰字，不催
           還沒到 min → 紅框＋「還差 N 個字」（他知道自己在寫，只是還沒夠）
           夠了       → 綠色打勾
       ⚠️ 「還差 N 個字」**不是**通過條件。
          answer.js 的規矩是「只要講到任何一個概念，字數限制就不套用」——
          「省事啊」三個字也可能是滿分。所以這裡只提醒，不擋送出，
          否則我們會擋掉一個其實答對的人，而他永遠不知道為什麼。 */
    function paintCount(t) {
      var box = host.querySelector('#qz-c' + t.dataset.i);
      if (!box) return;
      var n = String(t.value || '').replace(/\s/g, '').length;
      var min = +t.dataset.min || 8;
      t.classList.remove('short', 'okay');
      if (!n) { box.className = 'qz-cnt'; box.textContent = ''; return; }
      if (n < min) {
        t.classList.add('short');
        box.className = 'qz-cnt short';
        box.textContent = '再多寫一點 —— 還差 ' + (min - n) + ' 個字';
      } else {
        t.classList.add('okay');
        box.className = 'qz-cnt okay';
        box.textContent = '✓ ' + n + ' 個字';
      }
    }
    function left() {
      var n = 0;
      host.querySelectorAll('.qz-ta').forEach(function (t) {
        if (String(t.value || '').trim().length < 4) n++;
      });
      return n;
    }
    host.querySelectorAll('.qz-ta').forEach(function (t) {
      t.addEventListener('input', function () {
        paintCount(t);
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

      grade(items, answers, opts.unit, opts.student, lv).then(function (r) {
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
    var cap = (global.GRADING && global.GRADING.quizStars)
      ? global.GRADING.quizStars({ x: { score: score } }, 'x')
      : (score >= 5 ? 3 : score >= full() ? 2 : 1);

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
          ? '這一關拿到 <b>🧠 ' + cap + ' 顆概念星</b>' +
            (cap < 3 ? '（五題全講到就是 3 顆，可以再寫一次）' : '') +
            '<div class="qz-sub">作品的 🧩 星星另外算，看你的 Scratch 檔案。</div>'
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
      /* ★ 紅框只是提醒，不是「你錯了」—— 所以用橘紅、不用正紅，
         而且 focus 的時候讓紫色蓋過去（他正在改，不必一直被指著）。 */
      '.qz-ta.short{border-color:#fb923c}',
      '.qz-ta.okay{border-color:#6ee7b7}',
      '.qz-ta.short:focus,.qz-ta.okay:focus{border-color:#6366f1}',
      '.qz-cnt{min-height:17px;font-size:12px;margin-top:3px;line-height:1.5}',
      '.qz-cnt.short{color:#c2410c}',
      '.qz-cnt.okay{color:#059669}',
      '.qz-hint{margin-top:6px;background:none;border:0;color:#6366f1;font-family:inherit;',
      '  font-size:12.5px;font-weight:800;cursor:pointer;padding:2px 0}',
      '.qz-hintbox:not(:empty){margin-top:6px;background:#eef2ff;border:1px solid #c7d2fe;',
      '  border-radius:10px;padding:8px 11px;font-size:13px;line-height:1.8;color:#3730a3}',
      /* ★ 提示不給滑鼠選取 —— 提高「複製貼上」的摩擦。
         ⚠️ 這不是安全機制（F12 一開就繞過了）；真正擋抄的是
            shared/answer.js 的連續字串比對。這一行擋的是
            「順手反白貼上」那個動作，而那才是多數學生會做的事。 */
      '.qz-hintbox,.qz-ref{user-select:none;-webkit-user-select:none}',
      '.qz-ref{margin-top:8px;padding-top:8px;border-top:1px dashed #c7d2fe;font-size:12.5px;line-height:1.85}',
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
    _refBox: refBox,
    _grade: grade
  };

})(typeof window !== 'undefined' ? window : this);
