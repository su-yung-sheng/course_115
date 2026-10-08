/* 答錯時的「想一想」：解釋但不說答案、10 秒閱讀、不可失焦、5 秒後可略過
   跑法：node shared/tests/quizhints.test.js   （需要 jsdom）

   ★ 老師 2026-10-08：「資訊倫理學習系統（包含 11502），答錯時會顯示答案解釋，
     但不是直接說答案內容，給 10 秒閱讀，不可失焦，5 秒後可略過」
     決定：逐題寫一則提示（11501 的 141 題、11502 的 185 題）；離開就暫停、回來接著算
     （readhold.js，和流程圖閱讀倒數同一套）；記憶補給站也附提示、不限時。
   ⚠️ 這份測試守三件事：
     ① 內容：每一題都有提示、提示**不含正確選項的文字**（repo 是公開的）
     ② 流程：答錯 ⇒ 解釋畫面；讀滿 5 秒才能略過；離開時不換題、不跳掉解釋
     ③ 沒寫提示的題目，行為和以前一模一樣 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 題庫與提示（不需要 jsdom）── */
function loadInto(files) {
  const w = {};
  files.forEach(f => new Function('window', read(f))(w));
  return w;
}
const K = loadInto(['shared/anskey.js']).ANSKEY;
function bankOf(term, file) {
  const C = loadInto([term + '/content/' + file]).QUIZ_CONTENT;
  const qs = new Map();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && Array.isArray(o.options)) qs.set(o.q, o);
    Object.keys(o).forEach(k => walk(o[k]));
  })(C);
  return qs;
}
/** 最長的共同連續字串長度 */
function lcs(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    let k = 0;
    while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
    if (k > best) best = k;
  }
  return best;
}

[['11501', 'ethics', 141], ['11502', 'social', 185]].forEach(([term, name, total]) => {
section('① ' + term + ' 的提示：每一題都有、不含答案');
{
  const bank = bankOf(term, name + '.js');
  const H = loadInto([term + '/content/' + name + '.hints.js']).QUIZ_HINTS || {};
  const keys = Object.keys(H);
  ok(bank.size === total, '題庫 ' + total + ' 題（實際 ' + bank.size + '）');
  const missing = [...bank.keys()].filter(q => !(H[q] || '').trim());
  ok(missing.length === 0, '★★★ 每一題都有提示' + (missing.length ? '　←　缺：' + missing.slice(0, 3).join('／') : ''));
  const stale = keys.filter(q => !bank.has(q));
  ok(stale.length === 0, '★★ 沒有對不到題目的提示（改了題幹要跟著改 key）' + (stale.length ? '　←　' + stale.slice(0, 3).join('／') : ''));
  /* ⚠️⚠️ 洩題檢查：先用雜湊找出正確選項，再比對提示。
     連續 5 個字相同就算洩題（選項短於 5 個字時，整個選項出現就算 ——
     例如答案是「輸入」，提示裡就不可以出現「輸入」兩個字）。 */
  const leaks = [];
  keys.forEach(q => {
    const it = bank.get(q); if (!it) return;
    const good = it.options.filter(t => K.check(q, t, it.a));
    good.forEach(g => {
      const L = lcs(H[q], g);
      if (H[q].includes(g) || L >= Math.min(5, g.length)) leaks.push(q + ' ⇒ 「' + g + '」');
    });
    if (good.length !== 1) leaks.push(q + ' ⇒ 找不到唯一的正確選項');
  });
  ok(leaks.length === 0, '★★★ 提示不含正確選項的文字' + (leaks.length ? '　←　' + leaks.slice(0, 3).join('；') : ''));
  const long = keys.filter(q => H[q].length > 90);
  ok(long.length === 0, '★ 每則提示 90 字以內（10 秒讀得完）' + (long.length ? '　←　' + long[0] : ''));
}
});

section('② 頁面載入順序');
{
  const p1 = read('11501/cyberethics.html'), p2 = read('11502/social.html');
  const at = (s, x) => s.indexOf(x);
  ok(at(p1, 'content/ethics.hints.js') > 0 && at(p1, 'content/ethics.hints.js') < at(p1, 'quiz-engine.js'),
     '★★ 11501 載入提示檔，而且在引擎之前（引擎一開始就讀）');
  ok(at(p1, 'readhold.js') > 0 && at(p1, 'readhold.js') < at(p1, 'quiz-engine.js'),
     '★★ 11501 載入 readhold.js（10 秒倒數、離開就暫停）');
  ok(at(p2, 'content/social.hints.js') > 0 && at(p2, 'content/social.hints.js') < at(p2, 'quiz-engine.js'),
     '★★ 11502 載入提示檔，而且在引擎之前');
  ok(at(p2, 'readhold.js') > 0 && at(p2, 'readhold.js') < at(p2, 'quiz-engine.js'),
     '★★ 11502 載入 readhold.js');
}

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.log('\n（流程測試需要 jsdom：先執行  npm install jsdom）'); console.log('\n通過 ' + pass + '／失敗 ' + fail); process.exit(fail ? 1 : 0); }

/* 假的 READHOLD：由測試自己推進秒數（真的倒數由 readhold.test.js 驗證）。 */
function fakeHold(w) {
  const H = { started: [], stopped: 0 };
  w.READHOLD = {
    start(o) {
      const h = { o, left: o.sec, stopped: false };
      H.started.push(h); H.cur = h;
      if (o.onTick) o.onTick({ left: h.left, state: 'run' });
      return { stop() { h.stopped = true; H.stopped++; }, away() { return false; }, left() { return h.left; } };
    }
  };
  H.tick = (left, state) => { const h = H.cur; h.left = left; if (left <= 0) h.o.onDone(); else h.o.onTick({ left, state: state || 'run' }); };
  return H;
}

function boot(term, bank, opts) {
  opts = opts || {};
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(String(e && e.message || e)));
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/' + term + '/cyberethics.html', virtualConsole: vc });
  const w = dom.window;
  global.window = w; global.document = w.document; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.localStorage = w.localStorage;
  ['grading.js', 'qstat.js', 'anskey.js'].forEach(f => new Function('window', read('shared/' + f))(w));
  new Function('window', read(term + '/content/' + bank))(w);
  if (opts.hints !== false) {
    if (opts.hintsObj) w.QUIZ_HINTS = opts.hintsObj;
    else new Function('window', read(term + '/content/' + (term === '11501' ? 'ethics' : 'social') + '.hints.js'))(w);
  }
  /* ⚠️ CONFIG 被 __lockGlobal 凍住了，改不了 ⇒ 要「離開就換題」就借 11502 的 config（它有開）。 */
  new Function('window', read((opts.swap ? '11502' : term) + '/config.js'))(w);
  if (opts.maxWrong) w.QUIZ_CONTENT.maxWrong = opts.maxWrong;
  const HINTS = Object.assign({}, w.QUIZ_HINTS || {});
  const BANK = w.QUIZ_CONTENT;
  const ans = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ans[o.q] = o.a;
    Object.keys(o).forEach(k => walk(o[k]));
  })(BANK);
  const units = {}; (opts.passed || []).forEach(id => { units[id] = { star: 3 }; });
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  w.REPORT = {
    qstat: () => Promise.resolve(), unit: () => Promise.resolve(),
    get: () => Promise.resolve({ units, qstat: {}, stars: 3 }),
    history: (m, id) => Promise.resolve(units[id] ? [{ unit: id, at: Date.now(), score: 90, duration: '01:00', correct: 10, total: 11 }] : [])
  };
  const hold = opts.noHold ? null : fakeHold(w);
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, ans, HINTS, hold, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const qText = r => { const h = r.$('question-container').querySelector('h3'); return h ? h.textContent : ''; };
const optIdx = (r, right) => [...r.w.document.querySelectorAll('.qz-opt')]
  .findIndex(o => r.w.ANSKEY.check(qText(r), o.textContent, r.ans[qText(r)]) === right);
const send = r => click(r.w, r.$('next-btn'));
async function startChapter(r, id) {
  await sleep(400);
  click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + id + '"]')); await sleep(10);
  click(r.w, r.$('start-quiz-btn'));
}
const answer = (r, right) => { click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, right)]); send(r); };

(async () => {
  section('③ 答錯 ⇒ 解釋畫面（不說答案）');
  const r = boot('11501', 'ethics.js');
  await startChapter(r, '1-1');
  const q1 = qText(r);
  const goodText = [...r.w.document.querySelectorAll('.qz-opt')][optIdx(r, true)].textContent;
  const badText = [...r.w.document.querySelectorAll('.qz-opt')][optIdx(r, false)].textContent;
  answer(r, false);
  const box = r.$('question-container');
  ok(!!r.$('qz-explain'), '★★★ 答錯 ⇒ 出現解釋畫面，不是直接下一題');
  ok(r.$('qz-ex-hint') && r.$('qz-ex-hint').textContent === r.HINTS[q1], '★★ 顯示的是這一題的提示');
  ok(qText(r) === q1 && box.textContent.includes(badText), '　題目和「你選的」都看得到');
  ok(!box.textContent.includes(goodText), '★★★ 畫面上沒有正確選項的文字');
  ok(r.w.document.querySelectorAll('.qz-opt').length === 0, '★★ 選項不在畫面上（不能趁機改答）');
  ok(/連對: 0/.test(r.$('score-counter').textContent) && /容錯: 19/.test(r.$('wrong-counter').textContent),
     '計分照舊：連對歸零、容錯少一');

  section('④ 10 秒閱讀、5 秒後才能略過');
  const btn = r.$('next-btn');
  ok(r.hold.started.length === 1 && r.hold.cur.o.sec === 10, '★★ 倒數 10 秒（用 readhold）');
  ok(btn.disabled && /略過（5）/.test(btn.textContent), '★★★ 一開始不能略過，按鈕寫「略過（5）」');
  send(r);
  ok(!!r.$('qz-explain'), '★★★ 硬按也沒用，還停在解釋');
  r.hold.tick(7);
  ok(btn.disabled && /略過（2）/.test(btn.textContent) && /7 秒/.test(r.$('qz-ex-time').textContent),
     '讀了 3 秒：還不能略過（還要 2 秒）');
  r.hold.tick(6, 'pause');
  ok(/已暫停/.test(r.$('qz-ex-time').textContent) && btn.disabled, '★★ 離開畫面 ⇒ 顯示「已暫停」，不能略過');
  r.hold.tick(10, 'reset');
  ok(/從頭算/.test(r.$('qz-ex-time').textContent) && btn.disabled && /略過（5）/.test(btn.textContent),
     '★ 離開太久 ⇒ 從頭算，略過也要重新等');
  r.hold.tick(5);
  ok(!btn.disabled && /略過 →/.test(btn.textContent), '★★★ 讀滿 5 秒 ⇒ 可以略過');
  send(r);
  ok(!r.$('qz-explain') && r.w.document.querySelectorAll('.qz-opt').length === 4, '★★ 略過 ⇒ 下一題');
  ok(r.hold.cur.stopped, '★ 倒數計時器有收掉（不會在背景一直跑）');
  ok(!btn.disabled && btn.textContent === '送出答案', '　按鈕回到「送出答案」');

  answer(r, false);
  r.hold.tick(0);
  ok(!btn.disabled && /繼續作答/.test(btn.textContent) && /讀完了/.test(r.$('qz-ex-time').textContent),
     '★ 10 秒讀完 ⇒ 「繼續作答 →」');
  send(r);
  ok(!r.$('qz-explain'), '　繼續 ⇒ 下一題');

  section('⑤ 答對不出現；離開時不換題、不跳掉解釋');
  answer(r, true);
  ok(!r.$('qz-explain') && r.w.document.querySelectorAll('.qz-opt').length === 4, '★ 答對 ⇒ 直接下一題（和以前一樣）');
  {
    const r2 = boot('11501', 'ethics.js', { swap: true });
    await startChapter(r2, '1-1');
    answer(r2, false);
    r2.w.dispatchEvent(new r2.w.Event('blur'));
    ok(!!r2.$('qz-explain') && !/題目先收起來了/.test(r2.$('question-container').textContent),
       '★★★ 「離開就換題」開著時，解釋畫面也不會被收掉或換題');
    ok(!!r2.$('qz-veil'), '★★ 離開時遮罩蓋住畫面（不可失焦）');
    r2.w.dispatchEvent(new r2.w.Event('focus'));
    ok(!r2.$('qz-veil') && !!r2.$('qz-explain'), '　回來 ⇒ 遮罩收起，解釋還在');
    r2.hold.tick(5); send(r2);
    const q = qText(r2);
    r2.w.dispatchEvent(new r2.w.Event('blur')); r2.w.dispatchEvent(new r2.w.Event('focus'));
    ok(qText(r2) && qText(r2) !== q, '★★ 回到題目之後，「離開就換題」照常運作');
    ok(r2.errs.length === 0, '過程沒有丟例外' + (r2.errs.length ? '　←　' + r2.errs[0] : ''));
  }

  section('⑥ 沒寫提示／沒有 readhold／錯太多');
  {
    const r3 = boot('11502', 'social.js', { hintsObj: {} });
    await startChapter(r3, r3.w.document.querySelector('.qz-open').getAttribute('data-ch'));
    answer(r3, false);
    ok(!r3.$('qz-explain') && r3.w.document.querySelectorAll('.qz-opt').length === 4,
       '★★★ 沒有提示的題目答錯 ⇒ 照舊直接下一題');
    ok(r3.hold.started.length === 0, '　也不會啟動倒數');
  }
  {
    const r7 = boot('11502', 'social.js');
    await startChapter(r7, r7.w.document.querySelector('.qz-open').getAttribute('data-ch'));
    const q = qText(r7);
    answer(r7, false);
    ok(!!r7.$('qz-explain') && r7.$('qz-ex-hint').textContent === r7.HINTS[q] && r7.hold.started.length === 1,
       '★★★ 11502 答錯 ⇒ 一樣出現解釋畫面和 10 秒倒數');
  }
  {
    const r4 = boot('11501', 'ethics.js', { noHold: true });
    await startChapter(r4, '1-1');
    answer(r4, false);
    ok(!!r4.$('qz-explain') && !r4.$('next-btn').disabled,
       '★★ 沒載到 readhold.js ⇒ 一樣顯示提示，但不卡住（按鈕直接能按）');
    send(r4);
    ok(!r4.$('qz-explain'), '　按了就下一題');
  }
  {
    const r5 = boot('11501', 'ethics.js', { maxWrong: 1 });
    await startChapter(r5, '1-1');
    answer(r5, false);
    ok(!r5.$('warning-screen').classList.contains('hidden') && r5.hold.started.length === 0,
       '★ 容錯用完 ⇒ 直接到學習警示（不先卡 10 秒）');
  }

  section('⑦ 記憶補給站：答錯時附提示，一樣 10 秒、5 秒後才能按下一題');
  /* ⛔ 老師 2026-10-08 第二次：「練習測驗時應該也要有相同提示」（第一版補給站是不限時）。 */
  for (const [term, bank, ch] of [['11501', 'ethics.js', '1-1'], ['11502', 'social.js', '5-1']]) {
    const r6 = boot(term, bank, { passed: [ch] });
    await sleep(400);
    click(r6.w, r6.$('qz-practice-go')); await sleep(10);
    const q = qText(r6);
    answer(r6, false);
    ok(r6.$('prac-fb') && /正確答案是/.test(r6.$('prac-fb').textContent), term + '　正解照舊公布');
    ok(r6.$('prac-hint') && r6.$('prac-hint').textContent.includes(r6.HINTS[q]), '★★ ' + term + ' 下面附上「想一想」');
    const b = r6.$('next-btn');
    ok(r6.hold.started.length === 1 && b.disabled && /下一題（5）/.test(b.textContent),
       '★★★ ' + term + ' 補給站也要讀 5 秒才能按下一題（按鈕寫「下一題（5）」）');
    send(r6);
    ok(qText(r6) === q && !!r6.$('prac-hint'), '　還沒滿 5 秒硬按 ⇒ 還停在這一題');
    r6.hold.tick(6, 'pause');
    ok(/已暫停/.test(r6.$('qz-ex-time').textContent) && b.disabled, '★ 離開畫面 ⇒ 暫停');
    r6.w.dispatchEvent(new r6.w.Event('blur')); r6.w.dispatchEvent(new r6.w.Event('focus'));
    ok(qText(r6) === q && !!r6.$('prac-hint'), '★★ 讀提示時離開再回來，不會被換題');
    r6.hold.tick(5);
    ok(!b.disabled && /下一題 →/.test(b.textContent), '★★ 讀滿 5 秒 ⇒ 「下一題 →」');
    send(r6);
    ok(!r6.$('prac-hint') && qText(r6) && qText(r6) !== q && r6.hold.cur.stopped, '　下一題 ⇒ 提示收掉、倒數停掉');
    ok(/第 2 \/ 10 題/.test(r6.$('score-counter').textContent), '　計數器前進到第 2 題');
    answer(r6, true);
    ok(!r6.$('prac-hint') && !b.disabled && r6.hold.started.length === 1, '　答對不附提示、不倒數');
    ok(r6.errs.length === 0, '過程沒有丟例外' + (r6.errs.length ? '　←　' + r6.errs[0] : ''));
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
