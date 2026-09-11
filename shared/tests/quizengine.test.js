/* 章節測驗引擎：真的按一次「送出答案」
   跑法：node shared/tests/quizengine.test.js   （需要 jsdom）

   ⚠️ 2026-08-11 實際發生：上線後學生按「送出答案」**完全沒有反應**。
     原因是我在 checkAnswer() 裡寫了 `global.QSTAT` ——
     而 quiz-engine.js 的外殼是 `(function () {…})()`，**沒有 global 參數**
     （combo.js／qstat.js 有，我照著它們的樣子寫）。
     於是每按一次就丟 ReferenceError: global is not defined，
     題目停在原地，畫面上沒有任何錯誤訊息。

   ★ 為什麼字串比對擋不住
     `global.QSTAT` 看起來和 combo.js 裡一模一樣的那一行沒有兩樣。
     要抓到它，只有真的把引擎跑起來、真的按一下。

   ★ 這一支剛好跑得起來（純 IIFE，沒有 ES module import），
     所以「兩學期的章節測驗會不會壞」這件事終於有東西在看了。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/** 開一次章節測驗頁（不含 firebase —— 那一段在 quiz-firebase.js） */
function boot(term, bank) {
  /* ★ 把頁面裡的例外抓起來。
     jsdom 預設會把事件處理器裡丟出的錯誤吞掉再印到 console ——
     那正是「按了沒反應」的形狀，所以一定要接住它來斷言。 */
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(String(e && e.message || e)));
  const dom = new JSDOM('<!DOCTYPE html><body></body>', {
    url: 'https://x/course_115/' + term + '/cyberethics.html', virtualConsole: vc
  });
  const w = dom.window;
  global.window = w; global.document = w.document; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.localStorage = w.localStorage;
  /* ⚠️ anskey.js 一定要載：2026-08-17 起題庫裡沒有明碼答案，
     判分走 ANSKEY.check()。沒載的話每一題都會判成答錯，
     「答對十題完成挑戰」這種測試就永遠跑不完。 */
  ['grading.js', 'qstat.js', 'anskey.js'].forEach(f =>
    new Function('window', read('shared/' + f))(w));
  new Function('window', read(term + '/content/' + bank))(w);
  new Function('window', read(term + '/config.js'))(w);
  /* ★ 引擎啟動時會把 window.QUIZ_CONTENT 刪掉（免得學生在 Console 直接讀題庫），
     所以要在 eval 之前先留一份給測試用。 */
  const BANK = w.QUIZ_CONTENT;
  /* 身分與進度回報都是別支的事，這裡用最小的替身。 */
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const saved = [], units = [];
  w.REPORT = {
    qstat: (mod, m) => { saved.push(m); return Promise.resolve(); },
    unit: (mod, unitId, opts) => { units.push({ mod, unitId, opts }); return Promise.resolve(); },
    get: () => Promise.resolve(null),
    /* ⚠️ 替身要把引擎真的會呼叫的都補齊。少一支的症狀是
       「送出答案丟例外」—— 和真的壞掉長得一模一樣，會查錯方向。 */
    history: () => Promise.resolve([])
  };
  w.eval(read('shared/quiz-engine.js'));
  /* 題目文字 -> 答案雜湊。測試要「答對」才走得到挑戰結束。 */
  const ansMap = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ansMap[o.q] = o.a;
    Object.keys(o).forEach(k => walk(o[k]));
  })(BANK);
  return {
    w, errs, saved, units, ansOf: q => ansMap[q],
    $: id => w.document.getElementById(id)
  };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));

[['11501', 'ethics.js', '資訊倫理'], ['11502', 'social.js', '媒體與社會議題']].forEach(([term, bank, name]) => {
  section(term + ' ' + name);
  const { w, errs, saved, $ } = boot(term, bank);

  ok(!!w.QUIZ, '引擎掛得起來（window.QUIZ）');
  const chapters = [...w.document.querySelectorAll('.qz-open')];
  ok(chapters.length >= 5, '章節選單畫得出來（' + chapters.length + ' 個）');

  /* 章節 → 教材頁 → 開始測驗挑戰 → 題目。中間那一步不能跳，
     那是「先讀教材再作答」的設計。 */
  /* ⚠️ 點章節之後會先跳一個「上次成績」的視窗（有紀錄才擋），
     沒有紀錄時直接進教材頁。這裡用替身讓 history 回空陣列，
     所以會直接進教材。 */
  click(w, chapters[0]);
  ok(!!$('start-quiz-btn'), '點章節先進教材頁，看得到「開始測驗挑戰」');
  click(w, $('start-quiz-btn'));
  ok(!!$('question-container') && $('question-container').innerHTML.length > 40,
     '按「開始測驗挑戰」之後題目畫得出來');
  const opts = [...w.document.querySelectorAll('.qz-opt')];
  ok(opts.length === 4, '一題四個選項（' + opts.length + '）');

  /* ── ★ 這一段就是「送出答案沒反應」那個 bug ────────── */
  click(w, opts[0]);
  const before = $('question-container').innerHTML;
  const submit = [...w.document.querySelectorAll('button')]
    .filter(b => /送出答案/.test(b.textContent))[0];
  ok(!!submit, '找得到「送出答案」按鈕');
  click(w, submit);

  ok(errs.length === 0,
     '★ 送出答案不可以丟例外' + (errs.length ? '　←　' + errs[0].split('\n')[0] : ''));
  ok($('question-container').innerHTML !== before,
     '★ 送出之後真的換下一題 —— 沒換就是「按了沒反應」');

  /* 逐題統計要在記憶體裡累加，不是每答一題就寫資料庫。 */
  ok(saved.length === 0,
     '★ 答一題還不會寫資料庫（一次挑戰可能作答幾十次，每次都寫會爆額度）');
});

/* ── ★★ 失焦遮罩與浮水印（老師 2026-08-17）──────────────
   ⚠️⚠️ 這兩樣**擋不住瞬間截圖**：
     · PrintScreen 由作業系統直接複製畫面，網頁收不到事件
     · Win+Shift+S 是先把畫面凍結成圖才顯示選取介面
   ★ 它們擋到的是「一邊開著題目、一邊在旁邊視窗跟 AI 打字」，
     以及讓截出來的圖帶著班級座號。
   ⇒ 這一段驗的是「該出現的時候出現、該收的時候收、不擋作答」。 */
section('★★ 失焦遮罩與浮水印');
{
  const { w, $ } = boot('11502', 'social.js');
  const chapters = [...w.document.querySelectorAll('.qz-open')];
  click(w, chapters[0]);
  click(w, $('start-quiz-btn'));

  /* 浮水印 */
  const mark = $('qz-mark');
  ok(!!mark, '浮水印畫得出來');
  ok(/801/.test(mark.textContent) && /01/.test(mark.textContent),
     '★ 浮水印帶著班級座號（實得「' + mark.textContent.trim() + '」）');
  const cssAll = [...w.document.querySelectorAll('style')].map(s => s.textContent).join('');
  ok(/\.qz-mark\{[^}]*pointer-events:\s*none/.test(cssAll),
     '★★ 浮水印不吃點擊（pointer-events:none）—— 不然選項會點不下去');

  /* 遮罩：切走 → 蓋住；回來 → 收起 */
  ok(!$('qz-veil'), '一開始沒有遮罩');
  w.dispatchEvent(new w.Event('blur'));
  ok(!!$('qz-veil'), '★★ 視窗失焦 → 題目被蓋住');
  ok(/蓋起來/.test($('qz-veil').textContent), '　　而且講清楚發生什麼事');
  ok(/答案和計時都留著/.test($('qz-veil').textContent),
     '★ 講明「答案和計時都留著」—— 不然學生會以為自己被判作弊');
  w.dispatchEvent(new w.Event('focus'));
  ok(!$('qz-veil'), '★★ 點回來 → 遮罩收起');

  /* ★ 遮罩不可以影響作答：蓋住再打開，題目與選的答案都還在 */
  const before = $('question-container').innerHTML;
  w.dispatchEvent(new w.Event('blur'));
  w.dispatchEvent(new w.Event('focus'));
  ok($('question-container').innerHTML === before,
     '★★ 遮罩收起之後題目沒有被重畫（答案不會被清掉）');

  /* 遮罩自己也可以點掉 —— 有些情況 focus 事件不會來 */
  w.dispatchEvent(new w.Event('blur'));
  const veil = $('qz-veil');
  ok(!!veil, '再遮一次');
  click(w, veil);
  ok(!$('qz-veil'), '★ 點遮罩本身也收得起來（focus 事件不一定會來）');

  /* ⚠️ 不在測驗畫面的時候不可以亂遮（例如還在教材頁） */
  const r = boot('11501', 'ethics.js');
  r.w.dispatchEvent(new r.w.Event('blur'));
  ok(!r.$('qz-veil'), '★★ 還沒開始測驗就失焦 → 不會蓋出一個莫名其妙的遮罩');
}

/* ── ★★ 作答節奏：要記得下「最慢的那一題」──────────────────
   ⛔⛔ 2026-09-11 實際發生：一位學生 24 次挑戰全部
      「中位 1 秒／最快 0 秒／正確率 100%」，查出是用瀏覽器外掛自動作答。
   ★ 當時 pace 只記 med 和 min，而**那兩個數字分不出人和腳本** ——
     真的很熟的學生也可能又快又準。
     分得出來的是**最慢那一題**：
       人　 一定有長尾（某題卡住、回頭重看）→ max 常常十幾二十秒
       腳本 每題都一樣快　　　　　　　　　 → max 和 min 幾乎相同
   ⇒ 這一段就是把「人」和「腳本」兩種作答節奏各跑一次，
     確認 max 真的分得開。拿掉 max 的話下面第二條會紅。
   ⚠️ 這是**記錄**，不是判定 —— 引擎不會因為節奏擋任何人。 */
section('★★ 作答節奏要記得下最慢的那一題');
{
  /** 用固定的時鐘跑完一次挑戰，回傳回報上去的 pace。
      @param secs 每一題要「想」幾秒（長度＝連對目標） */
  function runChallenge(secs) {
    const r = boot('11501', 'ethics.js');
    const w = r.w;
    /* ★ 假時鐘：引擎用 Date.now() 算每題花了幾秒，
       控制它才做得出「某題卡住 18 秒」這種情境。 */
    let clock = 1.7e12;
    const realNow = w.Date.now;
    w.Date.now = () => clock;

    click(w, [...w.document.querySelectorAll('.qz-open')][0]);
    click(w, r.$('start-quiz-btn'));

    for (let i = 0; i < secs.length; i++) {
      const box = r.$('question-container');
      if (!box || !box.querySelector('h3')) break;      // 挑戰已經結束
      const qText = box.querySelector('h3').textContent;
      const a = r.ansOf(qText);
      const opts = [...w.document.querySelectorAll('.qz-opt')];
      const idx = opts.findIndex(o => w.ANSKEY.check(qText, o.textContent, a));
      if (idx < 0) break;                                // 對不到答案就別硬跑
      click(w, opts[idx]);
      clock += secs[i] * 1000;                           // ★ 這一題想了幾秒
      const submit = [...w.document.querySelectorAll('button')]
        .filter(b => /送出答案/.test(b.textContent))[0];
      click(w, submit);
    }
    w.Date.now = realNow;
    const last = r.units[r.units.length - 1];
    return last && last.opts && last.opts.extra && last.opts.extra.pace;
  }

  /* ① 人：有長尾（第 5 題卡住 18 秒） */
  const human = runChallenge([3, 5, 2, 4, 18, 3, 6, 2, 4, 3]);
  ok(!!human, '答對十題之後有回報 pace　←　' + JSON.stringify(human));
  ok(human && human.max != null,
     '★★★ pace 要有 max —— 沒有它，教師端分不出「很熟的學生」和「腳本」');
  ok(human && human.max >= 18, '★★ 人的 max 抓得到那題卡住的 18 秒　←　' + (human && human.max));
  ok(human && human.n === 10, '★ n ＝ 實際作答題數（' + (human && human.n) + '）');
  ok(human && human.min <= human.med && human.med <= human.max,
     '★ min ≦ med ≦ max（排序沒寫反）');

  /* ② 腳本：每題都一樣快 */
  const bot = runChallenge([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  ok(bot && bot.max <= 1,
     '★★★ 腳本的 max 也在 1 秒內 —— 這才是教師端要標紅的條件　←　' + JSON.stringify(bot));
  ok(human && bot && human.max > bot.max * 5,
     '★★★ 兩種節奏的 max 差得開（人 ' + (human && human.max) +
     's vs 腳本 ' + (bot && bot.max) + 's）—— 差不開就標不出來');
}

/* ── ★★ 教師端要真的用 max 來標紅，而且舊資料不可以被冤枉 ────
   ⚠️ 上面驗的是「資料有記下來」，這一段驗的是「教師端有在看」。
      少了這一段，max 可以被記得好好的、卻沒有任何人看得到。 */
section('★★ 教師端的異常標記');
{
  ['11501', '11502'].forEach(term => {
    const h = read(term + '/teacher.html');
    ok(/p\.max\s*!=\s*null\s*&&\s*p\.max\s*<=\s*1/.test(h),
       term + ' ★★ 標紅條件看的是「最慢那一題也在 1 秒內」，不是平均很快');
    ok(/p\.max\s*!=\s*null/.test(h),
       term + ' ★★★ 舊紀錄沒有 max 時不可以標紅 —— 寧可漏掉，不可以冤枉人');
    ok(/\(p\.n\s*\|\|\s*0\)\s*>=\s*5/.test(h),
       term + ' ★ 題數太少不標（連對三題就結束的沒有統計意義）');
    ok(/最慢\s*\$\{p\.max\}s/.test(h),
       term + ' ★★ 畫面上要印出最慢秒數 —— 只標紅不給數字，老師無從判斷');
    /* ★ 資訊倫理寫的是 unit，不是 chapter（見 shared/report.js）。
       只認 chapter 的話每一筆都印「完成一項」，分不出重刷了哪幾章。 */
    ok(/h\.unit\s*\?/.test(h),
       term + ' ★★★ 逐筆明細要認得 h.unit —— 不然資訊倫理全部印成「完成一項」');
  });
}

/* ── ★ 這一條不可以拿掉（看起來和上面重複，其實不是）──────
   把 `global.QSTAT` 那個 bug 放回去實測：
     上面「送出答案不可以丟例外」→ **還是綠的**
     下面這一條                  → 紅

   為什麼？因為測試跑在 **Node** 裡，而 Node 有一個真的 `global` 物件。
   `global.QSTAT` 在這裡只是讀到 undefined，短路過去，什麼事也沒有。
   瀏覽器裡沒有 `global` 這個名字，一執行到就 ReferenceError。

   ⇒ 這正是「跑得起來的測試」也擋不住的那一類：
     測試環境比瀏覽器**寬容**，所以靜態檢查在這裡是唯一的守門員。
   ⚠️ 覺得它和上面重複而刪掉的話，同一個 bug 會原封不動地再上線一次。 */
section('★ global 這個名字只能在有宣告它的檔案裡用');
{
  const bad = [];
  fs.readdirSync(path.join(root, 'shared')).filter(f => /\.js$/.test(f)).forEach(f => {
    const src = read('shared/' + f)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
    if (!/\bglobal\s*\./.test(src)) return;
    if (/\(function\s*\(\s*global\s*[,)]/.test(src)) return;   // 有宣告，沒問題
    bad.push(f);
  });
  ok(bad.length === 0,
     '★ 沒有檔案在「外殼沒有 global 參數」的情況下用 global.' +
     (bad.length ? '　←　' + bad.join('、') : ''));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
