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

  /* ── A：走近 → 在門口晃一下 → 走遠 ───────────────────
     ★ 老師 2026-08-24：「有人走過來，在門口停了一下，然後走遠。
       這個第一關的檢核有點怪，還是回到原來的問法就好」

     ⚠️ 中間那一版加了三種走法（折返、路過），問法也跟著改成
        「讓門只在該開的時候開」。兩個毛病：
          ① 「路過」那一組**不管怎麼設門檻都不該開** —— 設門檻這個任務就沒意義了
          ② 問法變含糊，學生不知道「該開」的標準是什麼
        ⇒ 回到原來的：**走近→停→走遠，讓門乾淨地開一次、關一次**。

     ★★ 但不可以退回「固定題目固定答案」（老師 2026-08-24 也指出過那個問題）。
        ⇒ 改成隨機**晃動的區間**：有時候人停在 6～15 公分，有時候停在 18～30。
           門檻要設多少，得**讀那排數字**才知道 —— 10／20 不再是萬用解。
        ★ 這才是 A 真正要練的東西：兩個門檻要拉開，而且要拉在對的地方。
        ⚠️ 所以門檻欄位**不預填**。預填等於送分：學生連數字都不必看。 */
  /* 抽不到題目時的退路（實測 1200 次沒用到，但不留退路會是 null）。 */
  var SEQ = [60, 50, 40, 30, 22, 18, 14, 11, 9, 8, 10, 14, 9, 11, 8, 10, 12,
             9, 11, 14, 18, 22, 30, 40, 50, 60];

  /* 人可能停在哪一段。★ 四段刻意錯開，門檻沒得抄。 */
  var ZONES = [[6, 15], [10, 22], [16, 28], [22, 34]];

  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  /** 由遠走到近（或反過來），中間帶一點雜訊 */
  function ramp(rng, from, to) {
    var out = [], n = ri(rng, 3, 4), i;
    for (i = 1; i <= n; i++) {
      var v = Math.round(from + (to - from) * i / (n + 1));
      out.push(Math.max(3, v + ri(rng, -2, 2)));
    }
    return out;
  }
  /* 在門口晃。★ 強制跨過區間的中線 —— 門檻設在中線附近就會抖起來，
     而「兩個門檻要拉開」正是靠這一段才教得到。
     ⚠️ 真正的保證在 caseA 的自我驗證，這裡只是讓它一次就抽中。 */
  function jitter(rng, lo, hi) {
    var mid = Math.round((lo + hi) / 2), out = [], n = ri(rng, 6, 8), i;
    for (i = 0; i < n; i++) {
      out.push(i % 2 === 0 ? ri(rng, lo, mid - 1) : ri(rng, mid + 1, hi));
    }
    return out;
  }

  /** 抽一題。★ 換的是「人停在哪一段」，不是換走法。 */
  function caseA(rng, prev) {
    var c = null;
    for (var g = 0; g < 40; g++) {
      var z = ZONES[Math.floor(rng() * ZONES.length) % ZONES.length];
      var lo = z[0], hi = z[1];
      var s = ri(rng, 55, 68);
      if (s <= hi + 12) continue;                       // 起點要夠遠，才走得出來
      var seq = [s].concat(ramp(rng, s, hi + 1), jitter(rng, lo, hi),
                           ramp(rng, hi + 1, s), [s]);
      /* ★★ 出題必須自己驗過（第一節一路的作法）：
         ① 存在一組合理門檻，做得出乾淨的一開一關
         ② 門檻設在晃動區的中線附近，一定會抖
         長不出這兩個性質的題目一律重抽 —— ② 是 A 唯一教到「門檻要拉開」的地方。 */
      var good = runDoor(seq, hi + 1, hi + 6);
      var mid  = Math.round((lo + hi) / 2);
      var tight = runDoor(seq, mid, mid + 1);
      if (good.opens === 1 && good.closes === 1 && tight.opens > 1) {
        c = { zone: [lo, hi], seq: seq, goal: { opens: 1, closes: 1 }, answer: 2,
              /* 給回饋用的參考值，不顯示給學生 */
              hintNear: hi + 1, hintFar: hi + 6 };
        if (!prev || lo !== prev.zone[0] || hi !== prev.zone[1]) return c;
      }
    }
    return c || { zone: [6, 15], seq: SEQ, goal: { opens: 1, closes: 1 }, answer: 2,
                  hintNear: 10, hintFar: 20 };
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
  /** 抽一組。★ 和上一次不一樣（重試同一組只證明他記得剛才選哪個）。
      ⚠️ 「換一題」的規矩統一在 labkit —— 它處理了「亂數一直吐同一個值」
         那個坑（見 labkit.js 的註解）。各單元不要自己再寫一份迴圈。 */
  function caseB(rng, prev) {
    return LK().pick(rng, CASES_B, prev);
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
  /** 這一組的作答規格（題目、抄襲來源都跟著抽到的情境走）。 */
  function saySpec(c) {
    c = c || CASES_B[0];
    var good = c.fixes.filter(function (f) { return f.good; })[0] || {};
    return { need: SAY.need, full: SAY.full, min: SAY.min,
             q: '為什麼程式要記住「' + c.thing + '」？',
             /* ⚠️ 抄到哪一組就比哪一組 —— 寫死第一組的話，
                抽到感應燈的人把「記住燈是亮的還是暗的」貼上去就過了。 */
             src: ['為什麼要記住' + c.thing, good.text || '', good.after || '', c.symptom] };
  }
  /** 判學生寫的那一段。★ 引擎在 shared/labkit.js，這裡只給題目。 */
  function judgeSay(text, c) {
    return LK().judgeSay(text, saySpec(c));
  }
  /** AI 覆核。★ 只會把「沒講到」翻成「講到了」，不會反過來。 */
  function reviewSay(text, res, opts, c) {
    var spec = saySpec(c);
    return LK().reviewSay(text, res, {
      student: opts && opts.student, unit: '5016b-u1-B', q: spec.q, spec: spec
    });
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

  /* ═══ 以下是畫面 ═══════════════════════════════════════
     ★ 版面、換一題、作答框、AI 覆核都在 shared/labkit.js ——
       這一支只留**第一節自己的東西**（門的走法、三組壞程式、距離帶）。 */
  function LK() {
    /* ⚠️ labkit 沒載到就整個停下來說清楚，不要靜默半殘 ——
       半殘的症狀是「按了沒反應」，那比錯誤訊息難查十倍。 */
    if (!global.LABKIT) throw new Error('doorlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }
  function ensureCss() { LK().ensureCss(); }
  function esc(s) { return LK().esc(s); }
  function md(s) { return LK().md(s); }

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
    var bPicked = false, sayText = '', sayBusy = false, bFix = null;

    function tabs() {
      return LK().tabsHtml(['A', 'B', 'C'],
        { A: 'A 感測→判斷', B: 'B 狀態', C: 'C 轉多久' }, step, done);
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
        /* ⚠️ 門檻**不預填**（老師 2026-08-24 之後的補強）——
           預填等於送分：學生連那排數字都不必看。
           人這次停在哪一段是隨機的，10／20 不再是萬用解。 */
        '<div class="dl-row">距離小於 <input class="dl-num" id="dl-near" placeholder="?"> 公分就開門</div>' +
        '<div class="dl-row">距離大於 <input class="dl-num" id="dl-far" placeholder="?"> 公分才關門</div>' +
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
        /* 三種錯要分開講 —— 講錯了學生會往錯的方向調。 */
        msg += res.opens > 1
          ? '　⚠️ 門在原地**抖了好幾次**：兩個門檻靠太近，人只要小小晃動就一直觸發。' +
            '再看一次那排數字，人停在哪一段？兩個門檻都要拉到那一段**外面**。'
          : (res.opens === 0
              ? '　⚠️ 門**從頭到尾沒開**：開門的門檻設得太小了，人根本沒走到那麼近。'
              : '　⚠️ 門開了卻沒關起來：關門的門檻設得太大，人走遠了也還沒超過。');
      }
      /* ★ 答錯就換一種走法 —— 同一題再猜一次，猜對只證明他記得剛才的數字。
         ⚠️ 但要等他看完這一次的結果，所以下一次 viewA 才換。 */
      aCase = caseA(rng, aCase);
      viewA(msg, 'bad', res);
    }

    /* ── B ──────────────────────────────────────────────
       三個階段：① 三選一修好它　② **先講**執行之後會看到什麼　③ 用自己的話說為什麼。

       ★★ 老師 2026-08-24：「B 狀態的『說得出會發生什麼』的部份還是要」——
         對照三個檢核，只有 B 缺這一步：A 先猜開關幾次、C 第二輪先寫下秒數，
         而 B 是「選了就直接跑」。
       ⚠️ 少了它，三選一**兩次內必中**：選一個 → 看結果 → 錯了再選下一個。
          那正是「先講你認為會怎樣」這個骨架要堵的洞
          （純做出來擋不住試誤，純答對擋不住猜）。

       ★ 預測的選項就是三個 after —— 也就是「三種修法各自會發生什麼」。
         ⚠️ 所以選錯修法的人也要預測：那才是最有價值的一次
            「你認為改門檻會怎樣？」→ 猜 → 執行 → 親眼看到自己想錯了。 */
    function bq() { return '用你自己的話說：為什麼程式要記住「' + bCase.thing + '」？'; }
    function goodFix() {
      return bCase.fixes.filter(function (f) { return f.good; })[0];
    }
    function viewB(msg, cls, after) {
      var list = bCase.fixes.slice().sort(function () { return rng() - 0.5; });
      var head =
        '<div class="dl-ask">下面這段程式<b>少了「' + esc(bCase.thing) + '」這個資訊</b>：<br>' +
        '<span style="font-family:monospace;font-size:14px">' + bCase.code + '</span><br>' +
        esc(bCase.symptom) + '你會怎麼修？</div>';

      /* ② 預測階段：修法已經選了，先講會發生什麼 */
      if (bFix) {
        var opts = bCase.fixes.slice().sort(function () { return rng() - 0.5; });
        return view(head +
          '<div class="dl-note">你選的是：<b>' + esc(bFix.text) + '</b></div>' +
          '<div class="dl-ask" style="margin-top:14px">⚠️ 先講：<b>執行之後會看到什麼？</b></div>' +
          opts.map(function (f) {
            return '<button class="dl-opt" data-pred="' + f.key + '">' + esc(f.after) + '</button>';
          }).join(''), msg, cls);
      }

      view(head +
        (bPicked
          /* 過了這一關就不再讓他改選 —— 這時候的任務已經換成「說出來」了。 */
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
      return LK().sayHtml({ q: bq(), text: sayText, busy: sayBusy });
    }
    /** ② 送出預測 → 真的跑一次 → 比對。★ 修法對**而且**預測對才算過。 */
    function doPred(key) {
      var f = bFix, predOk = (key === f.key);
      bFix = null;
      if (f.good && predOk) {
        bPicked = true;
        viewB('✅ 你不但修對了，也**說得出**會發生什麼：' + f.after +
              '　**最後一步**：說說看為什麼。', 'good');
        return;
      }
      /* 先把真正發生的事講出來 —— 猜錯的代價是眼見為憑，不是一句答錯。 */
      var msg = '執行結果：' + f.after;
      if (!predOk) msg += '　⚠️ 你猜的不是這個 —— **先想清楚再按**，這一關要的是「你知道會發生什麼」。';
      if (!f.good) msg += '　問題是「程式不知道自己上一次做了什麼」。';
      /* ★ 換一個東西壞掉 —— 同一組再來一次，三選一猜對的機率是二分之一。
         ⚠️ 換情境**不會**換掉正解（永遠是「加一個變數記住狀態」）——
            那件事就是這一節的概念，沒得換。擋猜的是「換一個題目重新認一次」。 */
      bCase = caseB(rng, bCase);
      viewB(msg + '　**換一個東西**試試看。', 'bad');
    }
    function doB(key) {
      tries.B++;
      bFix = bCase.fixes.filter(function (x) { return x.key === key; })[0] || null;
      /* ⚠️ 這裡**還不執行**。先問「你認為會發生什麼」——
         直接跑的話，選錯的人只是被告知答案，沒有被要求想過。 */
      viewB('', '');
    }
    /** ③ 送出那一段話。★ 本機先判，規則說「沒講到」才送 AI 覆核（只加分）。 */
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
        viewB('⚠️ 再想一次：它一直重複做同一件事，是因為程式**少了什麼資訊**？' +
              '　想想看，如果它知道「上一次已經做過了」，這次會怎麼做。', 'bad');
      });
    }
    function passB(res) {
      done.B = true; step = 'C';
      if (typeof opts.onSay === 'function') opts.onSay(sayText, res);
      viewC('✅ B 完成：' + (res.why || '你說得出為什麼要記住那個狀態。'), 'good');
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
      el.querySelectorAll('[data-pred]').forEach(function (b) {
        b.addEventListener('click', function () { doPred(b.getAttribute('data-pred')); });
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
             bCase: function () { return bCase; },
             bFix: function () { return bFix; } };
  }

  global.DOORLAB = {
    SEQ: SEQ, TOL: TOL, FIXES: FIXES, SAY: SAY, ZONES: ZONES,
    CASES_B: CASES_B, caseB: caseB,
    runDoor: runDoor, judgeA: judgeA, caseA: caseA,
    caseC: caseC, judgeC: judgeC, sayC: sayC,
    judgeSay: judgeSay, reviewSay: reviewSay,
    mount: mount
  };

})(window);
