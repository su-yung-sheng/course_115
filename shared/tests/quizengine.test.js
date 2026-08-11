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
  ['grading.js', 'qstat.js'].forEach(f =>
    new Function('window', read('shared/' + f))(w));
  new Function('window', read(term + '/content/' + bank))(w);
  new Function('window', read(term + '/config.js'))(w);
  /* 身分與進度回報都是別支的事，這裡用最小的替身。 */
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const saved = [];
  w.REPORT = {
    qstat: (mod, m) => { saved.push(m); return Promise.resolve(); },
    unit: () => Promise.resolve(),
    get: () => Promise.resolve(null),
    /* ⚠️ 替身要把引擎真的會呼叫的都補齊。少一支的症狀是
       「送出答案丟例外」—— 和真的壞掉長得一模一樣，會查錯方向。 */
    history: () => Promise.resolve([])
  };
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, saved, $: id => w.document.getElementById(id) };
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
