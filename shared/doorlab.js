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

  /* ── A 的走法 ────────────────────────────────────────
     ★ 老師 2026-08-24：「最後的動手檢核都是固定題目、固定答案，
       這樣沒有考驗到吧」—— 對。原本序列寫死、門檻預設 10／20，
       正解永遠是「2 次」：學生連那排數字都不用看，填 2 就過。

     ⇒ 換掉的不只是數字，是**走法**。三種走法的正解不一樣：
         走近停一下再走遠  → 開 1 關 1 ＝ 2 次
         走進去又折返一次  → 開 2 關 2 ＝ 4 次
         從門口路過沒靠近  → 0 次（門根本不該開）
       ★ 這才擋得住傳答案 —— 「填 2」在三分之二的情況下是錯的。

     ⚠️ 每一種走法都要保留「在門檻附近晃」那一段（PASS 是在它自己的
        距離帶上晃）—— 那是「兩個門檻要拉開」唯一被教到的地方。
        沒有它，把門檻設成 10／10 也不會出事，整個 A 就白做了。 */
  var IDEAL_NEAR = 10, IDEAL_FAR = 20;   // 判「門的行為對不對」用的參考門檻
  /* PASS 那一種走法晃在 22～34。⚠️ 它教的不是「門檻靠太近」，
     而是**「門檻設太寬」** —— 把「小於 30 就開門」設下去，
     一個只是路過的人也會讓門一直開開關關。 */
  var LOOSE_NEAR = 30;
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  /** 由遠走到近（或反過來），中間帶一點雜訊 */
  function ramp(rng, from, to) {
    var out = [], n = ri(rng, 3, 4), i;
    for (i = 1; i <= n; i++) {
      var v = Math.round(from + (to - from) * i / (n + 1));
      out.push(Math.max(5, v + ri(rng, -2, 2)));
    }
    return out;
  }
  /* 在某條線附近晃。
     ★ 一個嚴格小於那條線、一個嚴格大於，**輪流** ——
       這樣長出來的序列一定跨得過門檻，窄門檻才會抖起來。

     ⚠️ 但真正的保證**不在這裡**，在 caseA 的自我驗證：
        這一支只是讓「一次就抽中」，抽不中的照樣會被 caseA 退回重抽。
        （實測過：把交替拿掉改成純隨機，900 次抽樣仍然 0 次退到寫死序列 ——
        所以這一段是效率，不是正確性。⚠️ 不要把它寫成「這裡保證了什麼」，
        那會讓人以為驗證可以省掉，而驗證才是那條命脈。） */
  function jitter(rng, lo, hi, line) {
    var out = [], n = ri(rng, 6, 8), i;
    for (i = 0; i < n; i++) {
      out.push(i % 2 === 0 ? ri(rng, lo, line - 1) : ri(rng, line + 1, hi));
    }
    return out;
  }
  var WALKS = [
    { key: 'inout', name: '有人走過來，在門口停了一下，然後走遠',
      goal: { opens: 1, closes: 1 },
      build: function (rng) {
        var s = ri(rng, 55, 65);
        return [s].concat(ramp(rng, s, 14), jitter(rng, 6, 15, IDEAL_NEAR),
                          ramp(rng, 14, s), [s]);
      } },
    { key: 'return', name: '有人走進來，退出去，又走進來，最後才離開',
      goal: { opens: 2, closes: 2 },
      build: function (rng) {
        var s = ri(rng, 55, 65), mid = ri(rng, 42, 52);
        /* ⚠️ 中間一定要**真的走遠**（> IDEAL_FAR 很多），
           不然那兩次開門會被當成「門在抖」—— 而它其實是對的。 */
        return [s].concat(ramp(rng, s, 14), jitter(rng, 6, 15, IDEAL_NEAR),
                          ramp(rng, 14, mid), [mid],
                          ramp(rng, mid, 14), jitter(rng, 6, 15, IDEAL_NEAR),
                          ramp(rng, 14, s), [s]);
      } },
    { key: 'pass', name: '有人從門口前面走過去，沒有要進來',
      goal: { opens: 0, closes: 0 },
      build: function (rng) {
        /* 全程都在 22～34 —— 用合理門檻（小於 10 才開）門不該開。
           ⚠️ 但門檻設成「小於 30 就開」的人，會在這裡看到門一直抖。 */
        var s = ri(rng, 55, 65);
        return [s].concat(ramp(rng, s, 26), jitter(rng, 22, 34, LOOSE_NEAR),
                          ramp(rng, 26, s), [s]);
      } }
  ];
  /** 抽一種走法。★ 和上一次不一樣 —— 重試同一種只證明他記得剛才的答案。 */
  function caseA(rng, prev) {
    for (var g = 0; g < 30; g++) {
      var w = WALKS[Math.floor(rng() * WALKS.length) % WALKS.length];
      if (!prev || w.key !== prev.key) {
        var seq = w.build(rng), res = runDoor(seq, IDEAL_NEAR, IDEAL_FAR);
        /* ⚠️ 產生器出錯就重抽，不要出一題「怎麼設都過不了」的題目。
           走法是隨機長出來的，這一關**必須**自己驗過再交出去。 */
        /* ★★ 還要再驗一次「設錯門檻真的會出事」——
           這一關的重點就在這裡，長不出這個性質的題目一律重抽。 */
        var line = w.key === 'pass' ? LOOSE_NEAR : IDEAL_NEAR;
        var tight = runDoor(seq, line, line + 1);
        if (res.opens === w.goal.opens && res.closes === w.goal.closes
            && tight.opens > w.goal.opens) {
          return { key: w.key, name: w.name, seq: seq,
                   goal: w.goal, answer: w.goal.opens + w.goal.closes };
        }
      }
    }
    return { key: 'inout', name: WALKS[0].name, seq: SEQ,
             goal: { opens: 1, closes: 1 }, answer: 2 };
  }

  /** A 過關：預測對，而且門的行為真的對（不多不少）。 */
  function judgeA(pred, res, c) {
    var goal = (c && c.goal) || { opens: 1, closes: 1 };
    var n = Number(String(pred).trim());
    var total = res.opens + res.closes;
    return { predOk: isFinite(n) && n === total,
             cleanOk: res.opens === goal.opens && res.closes === goal.closes,
             total: total, goal: goal };
  }

  /* ── B：修法三選一（三組情境，依 seed 抽一組）───────────
     ★ 老師 2026-08-24：「固定題目、固定答案，這樣沒有考驗到吧」
       ⇒ 三組**不同的東西**壞掉，但壞的是**同一個原因**：少了狀態。
       ★ 換情境比換數字有用得多 —— 學生得自己認出「這又是那件事」，
         而那正是「懂了」和「記住答案」的差別。
     ⚠️ 三組的正解一律是「加一個變數記住狀態」——
        這件事沒辦法換，因為它就是這一節的概念。
        擋傳答案的是後面那段「用自己的話說」，不是這裡。

     ⚠️ 兩個錯的選項都要**能執行**、而且執行後看得出錯在哪 ——
        猜錯的代價是眼見為憑，不是一句「答錯」。 */
  var CASES_B = [
    { key: 'door', thing: '門開了沒',
      code: '重複無限次｜距離 &lt; 10 → 馬達 250、等 1.3 秒、馬達 0',
      symptom: '人站在門口不動，馬達就一直轉。',
      fixes: [
        { key: 'state', good: true,
          text: '加一個變數，記住門現在是開的還是關的',
          after: '人站著不動時，門只開一次就停 —— 這才是我們要的。' },
        { key: 'tight', good: false,
          text: '把門檻改嚴一點（距離小於 5 才開門）',
          after: '門檻改嚴只是把「開門的那條線」往前移。人再走近一點，門又轉了一次。' },
        { key: 'wait', good: false,
          text: '開門之後加「等待 3 秒」',
          after: '等 3 秒只是拖慢速度。人一直站著，門就每 3 秒轉一次。' }
      ] },
    { key: 'light', thing: '燈亮了沒',
      code: '重複無限次｜距離 &lt; 80 → 燈亮、等 5 秒、燈暗',
      symptom: '人坐在位子上沒動，燈就一直閃。',
      fixes: [
        { key: 'state', good: true,
          text: '加一個變數，記住燈現在是亮的還是暗的',
          after: '人坐著不動時，燈亮著就一直亮 —— 這才是我們要的。' },
        { key: 'bright', good: false,
          text: '把燈調亮一點，讓人看得更清楚',
          after: '燈更亮了，但還是一直閃 —— 亮度和「閃不閃」根本是兩件事。' },
        { key: 'longer', good: false,
          text: '把「等 5 秒」改成「等 30 秒」',
          after: '變成每 30 秒閃一次。閃得比較慢，但人還坐在那裡，它還是會閃。' }
      ] },
    { key: 'bin', thing: '蓋子開了沒',
      code: '重複無限次｜距離 &lt; 15 → 開蓋、等 3 秒、關蓋',
      symptom: '手一直伸在感測器前面，蓋子就一直開開關關。',
      fixes: [
        { key: 'state', good: true,
          text: '加一個變數，記住蓋子現在是開的還是關的',
          after: '手伸著不動時，蓋子開著就停住 —— 這才是我們要的。' },
        { key: 'slow', good: false,
          text: '把馬達轉慢一點，讓蓋子開得溫柔一些',
          after: '蓋子開得優雅多了，但手還伸在那裡，它照樣一直開一直關。' },
        { key: 'closer', good: false,
          text: '把門檻改成「距離小於 5」，手要更靠近才開',
          after: '手再靠近一點，蓋子又開了一次 —— 只是把那條線往前挪而已。' }
      ] }
  ];
  /** 抽一組。★ 和上一次不一樣（重試同一組只證明他記得剛才選哪個）。 */
  function caseB(rng, prev) {
    for (var g = 0; g < 30; g++) {
      var c = CASES_B[Math.floor(rng() * CASES_B.length) % CASES_B.length];
      if (!prev || c.key !== prev.key) return c;
    }
    return CASES_B[0];
  }
  /* 舊名字留著：外面（測試、頁面）本來就在用 FIXES。 */
  var FIXES = CASES_B[0].fixes;

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
  function judgeSay(text, c) {
    var t = String(text == null ? '' : text).trim();
    c = c || CASES_B[0];
    var good = c.fixes.filter(function (f) { return f.good; })[0] || {};
    if (global.ANSWER && global.ANSWER.judge) {
      return global.ANSWER.judge(t, {
        need: SAY.need, full: SAY.full, min: SAY.min,
        /* 題目與**這一組**的正確選項都算抄襲來源 ——
           ⚠️ 抽到哪一組就比哪一組：寫死第一組的話，
              抽到感應燈的人把「記住燈是亮的還是暗的」貼上去就過了。 */
        src: ['為什麼要記住' + c.thing, good.text || '', good.after || '', c.symptom]
      });
    }
    /* 退路：只看有沒有寫東西。
       ⚠️ 這條路是「不要整頁壞掉」，不是第二套規則 —— 所以刻意寬鬆。 */
    return t.length >= SAY.min
      ? { level: 'full', got: [], miss: [], why: '你寫的：' + t }
      : { level: 'none', got: [], miss: [], why: '再多寫一點 —— 至少 ' + SAY.min + ' 個字。' };
  }
  /** AI 覆核。★ 只會把「沒講到」翻成「講到了」，不會反過來。 */
  function reviewSay(text, res, opts, c) {
    var noAI = Promise.resolve(res);
    if (res.level !== 'none') return noAI;                 // 已經過了，加不上去
    if (!(global.ASKAI && global.ASKAI.enabled && global.ASKAI.enabled() && global.ASKAI.judge))
      return noAI;
    /* ★ 太短又一個概念都沒沾到的不送 —— 沒有東西可以撿，
       只是白花額度（額度全班共用），還會排在真正需要的人前面。 */
    if (String(text).trim().length < SAY.min && !(res.got || []).length) return noAI;
    return global.ASKAI.judge('5016b-u1-B', [{
      i: 0, q: '為什麼程式要記住「' + ((c || CASES_B[0]).thing) + '」？',
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
    /* ★ A 的走法與 B 的情境都是抽的（老師 2026-08-24：「固定題目、
       固定答案，這樣沒有考驗到吧」）。答錯換一組，重試同一組
       只證明他記得剛才的答案。 */
    var aCase = caseA(rng, null), bCase = caseB(rng, null);
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
        '<div class="dl-ask">' + esc(aCase.name) + '。<br>' +
        /* ⚠️ 不可以寫死「開一次關一次」—— 抽到「路過」那一種時，
           正確答案是門**完全不開**，寫死的話等於直接告訴他答案是錯的。 */
        '你要設定兩個門檻，讓門<b>只在該開的時候開</b>。</div>' +
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
      var res = runDoor(aCase.seq, near, far);
      var j = judgeA(pred, res, aCase);
      if (j.predOk && j.cleanOk) {
        done.A = true; step = 'B';
        viewB('✅ A 完成：你不但設對了，也**說得出**會發生什麼。', 'good');
        return;
      }
      var msg = '實際上開了 ' + res.opens + ' 次、關了 ' + res.closes + ' 次（共 ' + j.total + ' 次）。';
      if (!j.predOk) msg += '　你猜的是 ' + esc(pred) + ' 次 —— **先想清楚再按**，這一關要的是「你知道會發生什麼」。';
      if (!j.cleanOk) {
        msg += res.opens > j.goal.opens
          /* 開太多次 —— 兩種原因，講錯了學生會往錯的方向調。 */
          ? (aCase.key === 'pass'
              ? '　⚠️ 這個人只是**路過**，門卻開了：開門的門檻設得太寬了。'
              : '　⚠️ 門在原地抖了好幾次：兩個門檻靠太近的話，人只要小小晃動就會一直觸發。')
          : '　⚠️ 門開的次數不夠 —— 再看一次那排數字，這個人到底靠近了幾次？';
      }
      /* ★ 答錯就換一種走法 —— 同一題再猜一次，猜對只證明他記得剛才的數字。
         ⚠️ 但要等他看完這一次的結果，所以下一次 viewA 才換。 */
      aCase = caseA(rng, aCase);
      viewA(msg, 'bad', res);
    }

    /* ── B ──────────────────────────────────────────────
       兩個階段：① 三選一修好它　② 用自己的話說為什麼。
       ⚠️ 選對**不等於**完成 —— B 測的是「能解釋」，
          而三選一測得出他選得對，測不出他知不知道為什麼。 */
    function bq() { return '用你自己的話說：為什麼程式要記住「' + bCase.thing + '」？'; }
    function goodFix() {
      return bCase.fixes.filter(function (f) { return f.good; })[0];
    }
    function viewB(msg, cls, after) {
      var list = bCase.fixes.slice().sort(function () { return rng() - 0.5; });
      view(
        '<div class="dl-ask">下面這段程式<b>少了「' + esc(bCase.thing) + '」這個資訊</b>：<br>' +
        '<span style="font-family:monospace;font-size:14px">' + bCase.code + '</span><br>' +
        esc(bCase.symptom) + '你會怎麼修？</div>' +
        (bPicked
          /* 選對之後就不再讓他改選 —— 這時候的任務已經換成「說出來」了。 */
          ? '<div class="dl-note">✅ 你選的是：<b>' + esc(goodFix().text) + '</b></div>'
          : list.map(function (f) {
              return '<button class="dl-opt" data-fix="' + f.key + '">' + esc(f.text) + '</button>';
            }).join('')) +
        (after ? '<div class="dl-note">執行結果：' + esc(after) + '</div>' : '') +
        (bPicked ? sayHtml() : ''),
        msg, cls);
    }
    /* ★ 這一段以前是死的（沒有人讀 #dl-say）。現在真的判、真的存。 */
    function sayHtml() {
      return '<div class="dl-ask" style="margin-top:16px">✍️ ' + esc(bq()) + '</div>' +
        '<textarea id="dl-say" rows="2" style="width:100%;border:2px solid #cbd5e1;' +
        'border-radius:12px;padding:10px;font-size:15px" ' +
        'placeholder="寫幾句就好，講得沒那麼漂亮沒關係">' + esc(sayText) + '</textarea>' +
        '<div class="dl-row"><button class="dl-go" id="dl-runB"' +
        (sayBusy ? ' disabled' : '') + '>' + (sayBusy ? '看看你寫的…' : '送出') + '</button>' +
        '<span class="dl-note">⚠️ 寫錯不會扣分，可以一直改。</span></div>';
    }
    function doB(key) {
      tries.B++;
      var f = bCase.fixes.filter(function (x) { return x.key === key; })[0];
      if (f && f.good) {
        bPicked = true;
        viewB('✅ 選對了：' + f.after + '　**最後一步**：說說看為什麼。', 'good');
        return;
      }
      var was = f && f.after;
      /* ★ 選錯就換一個東西壞掉 —— 同一組再猜一次，三選一猜對的機率是二分之一。
         ⚠️ 換情境**不會**換掉正解（永遠是「加一個變數記住狀態」）——
            那件事就是這一節的概念，沒得換。擋猜的是「換一個題目重新認一次」。 */
      bCase = caseB(rng, bCase);
      viewB('⛔ 執行看看 —— ' + (was || '') + '　再想一次：問題是「程式不知道自己上一次做了什麼」。' +
            '　**換一個東西**試試看。', 'bad');
    }
    /** 送出那一段話。★ 本機先判，規則說「沒講到」才送 AI 覆核（只加分）。 */
    function doSay() {
      var box = el.querySelector('#dl-say');
      sayText = box ? box.value : '';
      var res = judgeSay(sayText, bCase);
      if (res.level !== 'none') return passB(res);
      /* 還沒過 —— 先把畫面切成「看看你寫的…」，再等覆核。
         ⚠️ 不可以讓他這時候重複按送出：額度是全班共用的。 */
      sayBusy = true;
      viewB('', 'bad');
      reviewSay(sayText, res, opts, bCase).then(function (r2) {
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
             say: function () { return sayText; },
             /* 給測試看的：這一次抽到哪一種走法／哪一個情境。 */
             aCase: function () { return aCase; },
             bCase: function () { return bCase; } };
  }

  global.DOORLAB = {
    SEQ: SEQ, TOL: TOL, FIXES: FIXES, SAY: SAY, WALKS: WALKS,
    CASES_B: CASES_B, caseB: caseB,
    IDEAL_NEAR: IDEAL_NEAR, IDEAL_FAR: IDEAL_FAR,
    runDoor: runDoor, judgeA: judgeA, caseA: caseA,
    caseC: caseC, judgeC: judgeC, sayC: sayC,
    judgeSay: judgeSay, reviewSay: reviewSay,
    mount: mount
  };

})(window);
