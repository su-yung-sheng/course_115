/* =====================================================================
   感應大門：三個概念的檢核（11501 第一節課）
   ---------------------------------------------------------------------
   ★★ 三個檢核共用一個骨架（2026-08-24 定案）：
        **先講你認為會怎樣 → 再執行 → 說對了才算**
      ⚠️ 這是刻意的：純「做出來」擋不住試誤，純「答對」擋不住猜。
         先講再做，兩個漏洞互相補起來。

     A 感測 → 判斷（能預測）　自己設兩個門檻，先答「門會開關幾次」再播放
     B 狀態（能解釋）　　　　修好一段被拿掉「門的狀態」的程式，選錯直接跑給他看
     C 時間即動作（能調整）　兩輪：先自由試誤，再換一台馬達、先寫下秒數才執行

   ⚠️ 這一支**不計星、不寫雲端**（老師 2026-08-24：不用計算星，
      完成狀態之後才做）。現在只回報 onDone，讓頁面自己顯示完成。
   ===================================================================== */
(function (global) {
  'use strict';

  /* ── A：距離序列（走近 → 停在門口晃一下 → 走遠）──────────
     ⚠️ 中間那段 8～12 的晃動是**整個檢核的重點**：
        兩個門檻設一樣的人，就是在這裡看到門抖起來。 */
  var SEQ = [60, 50, 40, 30, 22, 18, 14, 11, 9, 8, 10, 14, 9, 11, 8, 10, 12,
             9, 11, 14, 18, 22, 30, 40, 50, 60];
  /* ⚠️ 中段那個 14 是**故意**的：沒有它，把門檻設成 12／13 這種窄帶
     也會剛好乾淨一開一關 —— 學生就學不到「兩個門檻要拉開」。
     有了它，窄帶會在 11 → 14 → 9 之間抖起來，而 10／20 完全不受影響。 */

  /** 跑一次序列，回傳開關次數與逐步事件。 */
  function runDoor(seq, near, far) {
    var open = false, opens = 0, closes = 0, events = [];
    (seq || SEQ).forEach(function (d, i) {
      var act = '';
      if (d < near && !open)      { open = true;  opens++;  act = 'open'; }
      else if (d > far && open)   { open = false; closes++; act = 'close'; }
      events.push({ i: i, d: d, act: act, open: open });
    });
    return { opens: opens, closes: closes, events: events, endOpen: open };
  }

  /** A 過關：預測對，而且真的是乾淨的一開一關。 */
  function judgeA(pred, res) {
    var n = Number(String(pred).trim());
    var total = res.opens + res.closes;
    return { predOk: isFinite(n) && n === total,
             cleanOk: res.opens === 1 && res.closes === 1,
             total: total };
  }

  /* ── B：修法三選一 ───────────────────────────────────
     ⚠️ 兩個錯的選項都要**能執行**、而且執行後看得出錯在哪 ——
        猜錯的代價是眼見為憑，不是一句「答錯」。 */
  var FIXES = [
    { key: 'state',  text: '加一個變數，記住門現在是開的還是關的',
      good: true,  after: '人站著不動時，門只開一次就停 —— 這才是我們要的。' },
    { key: 'tight',  text: '把門檻改嚴一點（距離小於 5 才開門）',
      good: false, after: '門檻改嚴只是把「開門的那條線」往前移。人再走近一點，門又轉了一次。' },
    { key: 'wait',   text: '開門之後加「等待 3 秒」',
      good: false, after: '等 3 秒只是拖慢速度。人一直站著，門就每 3 秒轉一次。' }
  ];

  /* ── B 的後半：用自己的話說 ───────────────────────────
     ★ 老師 2026-08-24：「這個填充沒有功能吧?」—— 對，之前那個 textarea
       從頭到尾沒有人讀它、沒有存檔，而且每次重畫就清空，
       placeholder 卻寫著「老師會看」。⇒ 現在真的判、真的存。

     ⚠️ 為什麼選擇題選對了還不夠：B 測的是「**能解釋**」。
        三選一測得出他選得對，測不出他知不知道為什麼 ——
        那正是這一段要補的洞。

     ★ 判定一律走 shared/answer.js（本機關鍵字、不連網、秒回、每次一致），
       規則說「沒講到」時才送 AI 覆核，而**覆核只能加分**。
       ⚠️ 這個方向是刻意的：AI 會失守、會過載、會額度用完，
          那時只是「沒撿回來」，不會突然變成扣分。（同 shared/quiz.js）

     ⚠️ full: 1 —— **講到任何一個就算過**。
        兩個都要的話，會出現「他明明講懂了，系統說他沒懂」——
        那是最傷的一種誤判，學生從此開始猜系統想看什麼字。 */
  var SAY = {
    need: [
      { name: '程式要記住上一次的狀態',
        any: ['記住', '記得', '記下', '狀態', '開過', '已經開', '變數', '記錄', '知道自己'] },
      { name: '不記住就會重複做同一件事',
        any: ['一直', '重複', '再開', '又開', '不停', '每次都', '一直轉', '轉個不停', '反覆'] }
    ],
    min: 8,
    full: 1
  };
  /** 判學生寫的那一段。⚠️ answer.js 沒載到時**放行**，不是擋住。 */
  function judgeSay(text) {
    var t = String(text == null ? '' : text).trim();
    if (global.ANSWER && global.ANSWER.judge) {
      return global.ANSWER.judge(t, {
        need: SAY.need, full: SAY.full, min: SAY.min,
        /* 題目本身也算抄襲來源 —— 把題目倒著抄一遍不是「自己的話」。 */
        src: ['為什麼要記住門開了沒', FIXES[0].text, FIXES[0].after]
      });
    }
    /* 退路：只看有沒有寫東西。
       ⚠️ 這條路是「不要整頁壞掉」，不是第二套規則 —— 所以刻意寬鬆。 */
    return t.length >= SAY.min
      ? { level: 'full', got: [], miss: [], why: '你寫的：' + t }
      : { level: 'none', got: [], miss: [], why: '再多寫一點 —— 至少 ' + SAY.min + ' 個字。' };
  }
  /** AI 覆核。★ 只會把「沒講到」翻成「講到了」，不會反過來。 */
  function reviewSay(text, res, opts) {
    var noAI = Promise.resolve(res);
    if (res.level !== 'none') return noAI;                 // 已經過了，加不上去
    if (!(global.ASKAI && global.ASKAI.enabled && global.ASKAI.enabled() && global.ASKAI.judge))
      return noAI;
    /* ★ 太短又一個概念都沒沾到的不送 —— 沒有東西可以撿，
       只是白花額度（額度全班共用），還會排在真正需要的人前面。 */
    if (String(text).trim().length < SAY.min && !(res.got || []).length) return noAI;
    return global.ASKAI.judge('5016b-u1-B', [{
      i: 0, q: '為什麼程式要記住「門開了沒」？',
      need: SAY.need.map(function (g) { return g.name; }),
      got: res.got || [], a: String(text).slice(0, 400)
    }], opts && opts.student).then(function (list) {
      var x = (list || [])[0];
      var add = ((x && x.got) || []).filter(function (n) {
        return SAY.need.some(function (g) { return g.name === n; });
      });
      if (!add.length) return res;
      return { level: 'full', got: add, miss: [], byAI: true,
               why: '你講到了：' + add.join('、') + '。' };
    }).catch(function () { return res; });   // 覆核失敗＝沒撿回來，不是扣分
  }

  /* ── C：秒數校準 ─────────────────────────────────────
     N＝這台馬達要轉幾秒門才全開（不告訴學生）。
     ⚠️ 兩輪的差別才是重點：第一輪自由試誤是**學怎麼估**，
        第二輪先寫下秒數再執行，測的才是那個能力。 */
  var TOL = 0.2;
  function caseC(rng, prev) {
    for (var g = 0; g < 50; g++) {
      var n = Math.round((0.8 + rng() * 1.6) * 10) / 10;    // 0.8～2.4 秒
      if (!prev || Math.abs(n - prev) > 0.3) return n;
    }
    return n;
  }
  function judgeC(set, n) {
    var v = Number(String(set).trim());
    if (!isFinite(v)) return { ok: false, how: 'bad' };
    var diff = v - n;
    if (Math.abs(diff) <= TOL) return { ok: true, how: 'fit' };
    return { ok: false, how: diff < 0 ? 'short' : 'long', diff: diff };
  }
  function sayC(r) {
    if (r.how === 'fit')   return '剛剛好，門完全打開就停住了。';
    if (r.how === 'short') return '⛔ 門只開了一半 —— 馬達還沒轉到底就被叫停了。';
    if (r.how === 'long')  return '⛔ 門已經到底了，馬達還在推 —— 聽到「嘎嘎」的聲音了嗎？';
    return '請填一個數字（例如 1.2）。';
  }

  /* ═══ 以下是畫面 ═══════════════════════════════════════ */
  var CSS = '' +
  '.dl-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.dl-tab{flex:1;min-width:150px;padding:9px 10px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font-weight:900;font-size:13px;color:#94a3b8}' +
  '.dl-tab.on{border-color:#7c3aed;color:#5b21b6;background:#f5f3ff}' +
  '.dl-tab.ok{border-color:#10b981;color:#047857;background:#ecfdf5}' +
  '.dl-ask{font-size:16px;font-weight:900;color:#0f172a;margin:12px 0 8px;line-height:1.8}' +
  '.dl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}' +
  '.dl-num{font-size:20px;font-weight:900;width:110px;padding:10px 12px;border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.dl-go{background:#7c3aed;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;border:none;border-radius:12px;cursor:pointer}' +
  '.dl-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;font-weight:700;cursor:pointer}' +
  '.dl-opt:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.dl-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.8}' +
  '.dl-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.dl-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.dl-tape{display:flex;gap:2px;margin:10px 0;flex-wrap:wrap}' +
  '.dl-cell{width:22px;height:34px;border-radius:5px;background:#e2e8f0;font-size:10px;text-align:center;line-height:34px;color:#64748b;font-weight:900}' +
  '.dl-cell.open{background:#34d399;color:#064e3b}' +
  '.dl-cell.close{background:#f87171;color:#7f1d1d}' +
  '.dl-note{font-size:13px;color:#64748b;line-height:1.8;margin-top:6px}';

  function ensureCss() {
    if (document.getElementById('doorlab-css')) return;
    var st = document.createElement('style');
    st.id = 'doorlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function md(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'); }

  function tapeHtml(res) {
    return '<div class="dl-tape">' + res.events.map(function (e) {
      var cls = e.act === 'open' ? 'open' : (e.act === 'close' ? 'close' : '');
      return '<div class="dl-cell ' + cls + '" title="' + e.d + ' 公分">' + e.d + '</div>';
    }).join('') + '</div>' +
    '<div class="dl-note">綠＝門開了一次　紅＝門關了一次　（一格是一次量距離）</div>';
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var rng = (global.ULTRALAB ? global.ULTRALAB.rngFrom(opts.seed) : Math.random);
    var step = 'A';
    var done = { A: false, B: false, C: false };
    var tries = { A: 0, B: 0, C: 0 };
    var cRound = 1, cN = caseC(rng, null), cGuess = '';
    /* B 的兩個階段：先選對（bPicked），再說得出來。
       ⚠️ sayText 一定要留在外面 —— 放在 DOM 裡的話，
          每次重畫（提示、覆核回來）學生打的字就沒了。 */
    var bPicked = false, sayText = '', sayBusy = false;

    function tabs() {
      var names = { A: 'A 感測→判斷', B: 'B 狀態', C: 'C 轉多久' };
      return '<div class="dl-tabs">' + ['A','B','C'].map(function (k) {
        var cls = done[k] ? 'ok' : (k === step ? 'on' : '');
        return '<div class="dl-tab ' + cls + '">' + (done[k] ? '✅ ' : '') + names[k] + '</div>';
      }).join('') + '</div>';
    }

    function view(inner, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + inner +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    /* ── A ── */
    function viewA(msg, cls, res) {
      view(
        '<div class="dl-ask">有人從遠處走過來，在門口停下來晃了一下，然後走遠。<br>' +
        '你要設定兩個門檻，讓門<b>乾淨地開一次、關一次</b>。</div>' +
        '<div class="dl-row">距離小於 <input class="dl-num" id="dl-near" value="10"> 公分就開門</div>' +
        '<div class="dl-row">距離大於 <input class="dl-num" id="dl-far" value="20"> 公分才關門</div>' +
        '<div class="dl-ask">⚠️ 先講：這樣設，門一共會<b>開關幾次</b>？（開一次算一次、關一次也算一次）</div>' +
        '<div class="dl-row"><input class="dl-num" id="dl-pred" placeholder="?"> 次 ' +
        '<button class="dl-go" id="dl-runA">送出並播放</button></div>' +
        (res ? tapeHtml(res) : ''), msg, cls);
    }
    function doA() {
      tries.A++;
      var near = Number(el.querySelector('#dl-near').value);
      var far  = Number(el.querySelector('#dl-far').value);
      var pred = el.querySelector('#dl-pred').value;
      var res = runDoor(SEQ, near, far);
      var j = judgeA(pred, res);
      if (j.predOk && j.cleanOk) {
        done.A = true; step = 'B';
        viewB('✅ A 完成：你不但設對了，也**說得出**會發生什麼。', 'good');
        return;
      }
      var msg = '實際上開了 ' + res.opens + ' 次、關了 ' + res.closes + ' 次（共 ' + j.total + ' 次）。';
      if (!j.predOk) msg += '　你猜的是 ' + esc(pred) + ' 次 —— **先想清楚再按**，這一關要的是「你知道會發生什麼」。';
      if (!j.cleanOk) msg += '　⚠️ 門在原地抖了好幾次：兩個門檻靠太近的話，人只要小小晃動就會一直觸發。';
      viewA(msg, 'bad', res);
    }

    /* ── B ──────────────────────────────────────────────
       兩個階段：① 三選一修好它　② 用自己的話說為什麼。
       ⚠️ 選對**不等於**完成 —— B 測的是「能解釋」，
          而三選一測得出他選得對，測不出他知不知道為什麼。 */
    var BQ = '用你自己的話說：為什麼程式要記住「門開了沒」？';
    function viewB(msg, cls, after) {
      var list = FIXES.slice().sort(function () { return rng() - 0.5; });
      view(
        '<div class="dl-ask">下面這段程式<b>少了「門的狀態」</b>：<br>' +
        '<span style="font-family:monospace;font-size:14px">重複無限次｜距離 &lt; 10 → 馬達 250、等 1.3 秒、馬達 0</span><br>' +
        '人站在門口不動，馬達就一直轉。你會怎麼修？</div>' +
        (bPicked
          /* 選對之後就不再讓他改選 —— 這時候的任務已經換成「說出來」了。 */
          ? '<div class="dl-note">✅ 你選的是：<b>' + esc(FIXES[0].text) + '</b></div>'
          : list.map(function (f) {
              return '<button class="dl-opt" data-fix="' + f.key + '">' + esc(f.text) + '</button>';
            }).join('')) +
        (after ? '<div class="dl-note">執行結果：' + esc(after) + '</div>' : '') +
        (bPicked ? sayHtml() : ''),
        msg, cls);
    }
    /* ★ 這一段以前是死的（沒有人讀 #dl-say）。現在真的判、真的存。 */
    function sayHtml() {
      return '<div class="dl-ask" style="margin-top:16px">✍️ ' + BQ + '</div>' +
        '<textarea id="dl-say" rows="2" style="width:100%;border:2px solid #cbd5e1;' +
        'border-radius:12px;padding:10px;font-size:15px" ' +
        'placeholder="寫幾句就好，講得沒那麼漂亮沒關係">' + esc(sayText) + '</textarea>' +
        '<div class="dl-row"><button class="dl-go" id="dl-runB"' +
        (sayBusy ? ' disabled' : '') + '>' + (sayBusy ? '看看你寫的…' : '送出') + '</button>' +
        '<span class="dl-note">⚠️ 寫錯不會扣分，可以一直改。</span></div>';
    }
    function doB(key) {
      tries.B++;
      var f = FIXES.filter(function (x) { return x.key === key; })[0];
      if (f && f.good) {
        bPicked = true;
        viewB('✅ 選對了：' + f.after + '　**最後一步**：說說看為什麼。', 'good');
        return;
      }
      viewB('⛔ 執行看看 —— ' + (f ? f.after : '') + '　再想一次：問題是「程式不知道自己已經開過門了」。',
            'bad', f && f.after);
    }
    /** 送出那一段話。★ 本機先判，規則說「沒講到」才送 AI 覆核（只加分）。 */
    function doSay() {
      var box = el.querySelector('#dl-say');
      sayText = box ? box.value : '';
      var res = judgeSay(sayText);
      if (res.level !== 'none') return passB(res);
      /* 還沒過 —— 先把畫面切成「看看你寫的…」，再等覆核。
         ⚠️ 不可以讓他這時候重複按送出：額度是全班共用的。 */
      sayBusy = true;
      viewB('', 'bad');
      reviewSay(sayText, res, opts).then(function (r2) {
        sayBusy = false;
        if (r2.level !== 'none') return passB(r2);
        /* ⚠️ 不可以把「還差什麼」的名稱講出來 —— 那就是答案，
           講了學生貼上去就過了（同 answer.js 的 whyOf）。 */
        viewB('⚠️ 再想一次：門一直轉，是因為程式**少了什麼資訊**？' +
              '　想想看，如果它知道「上一次已經開過了」，這次會怎麼做。', 'bad');
      });
    }
    function passB(res) {
      done.B = true; step = 'C';
      if (typeof opts.onSay === 'function') opts.onSay(sayText, res);
      viewC('✅ B 完成：' + (res.why || '你說得出為什麼要記住門的狀態。') +
            (res.byAI ? '' : ''), 'good');
    }

    /* ── C ── */
    function viewC(msg, cls) {
      var one = cRound === 1;
      view(
        '<div class="dl-ask">🔧 第 ' + cRound + ' 輪：這台馬達要轉<b>幾秒</b>，門才會剛好全開？<br>' +
        (one ? '<span class="dl-note">可以一直試，看門開太少還是推過頭。</span>'
             : '⚠️ <b>換了一台新的馬達</b>。這次<b>先寫下你的答案再執行</b>，只有一次機會。') +
        '</div>' +
        '<div class="dl-row">等待 <input class="dl-num" id="dl-sec" placeholder="1.0"> 秒 ' +
        '<button class="dl-go" id="dl-runC">' + (one ? '執行' : '寫下並執行') + '</button></div>',
        msg, cls);
    }
    function doC() {
      tries.C++;
      var v = el.querySelector('#dl-sec').value;
      var r = judgeC(v, cN);
      if (!r.ok) {
        if (cRound === 2) {           // 第二輪只有一次機會 → 換一台重來
          cN = caseC(rng, cN);
          viewC(sayC(r) + '　⚠️ 第二輪只有一次機會，**再換一台**從第一輪開始。', 'bad');
          cRound = 1;
          return;
        }
        viewC(sayC(r), 'bad');
        return;
      }
      if (cRound === 1) {
        cRound = 2; cN = caseC(rng, cN);
        viewC('✅ 第一輪過了。' + sayC(r) + '　現在換一台新馬達 —— **先寫下秒數再執行**。', 'good');
        return;
      }
      done.C = true;
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">🎉 三個檢核都完成了！<br>' +
        '你證明了三件事：**說得出**門什麼時候該開、**知道**為什麼要記住門的狀態、' +
        '**能自己調**出馬達要轉多久。</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries });
    }

    function bind() {
      var a = el.querySelector('#dl-runA'); if (a) a.addEventListener('click', doA);
      el.querySelectorAll('[data-fix]').forEach(function (b) {
        b.addEventListener('click', function () { doB(b.getAttribute('data-fix')); });
      });
      var c = el.querySelector('#dl-runC'); if (c) c.addEventListener('click', doC);
      var s = el.querySelector('#dl-runB'); if (s) s.addEventListener('click', doSay);
      /* 打字時就記起來 —— 不然按到別的按鈕重畫，字就沒了。 */
      var t = el.querySelector('#dl-say');
      if (t) t.addEventListener('input', function () { sayText = t.value; });
    }

    viewA('');
    return { step: function () { return step; }, tries: function () { return tries; },
             say: function () { return sayText; } };
  }

  global.DOORLAB = {
    SEQ: SEQ, TOL: TOL, FIXES: FIXES, SAY: SAY,
    runDoor: runDoor, judgeA: judgeA, caseC: caseC, judgeC: judgeC, sayC: sayC,
    judgeSay: judgeSay, reviewSay: reviewSay,
    mount: mount
  };

})(window);
