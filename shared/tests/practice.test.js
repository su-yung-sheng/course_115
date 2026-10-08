/* 🧠 記憶補給站：通關後的重複練習（11501）
   跑法：node shared/tests/practice.test.js   （需要 jsdom）

   ★ 老師 2026-10-05：「通關後加入一個重複練習，每次十題，一樣採用失焦機制，幫助複習」
     名稱：🧠 記憶補給站；每題公布正解、不計分不記錄。
   ★ 同日第二版：「放在『資訊倫理與相關法律總整理』下方，明顯提示，
     會由通關的章節中挑選題目，答錯的五題，答對的任選，若無錯題則任選」 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

/* passed：哪些章節已通關；weak：(BANK) => 要標成「答錯過」的題目 */
function boot(term, bank, passed, weak) {
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
  new Function('window', read(term + '/config.js'))(w);
  const BANK = w.QUIZ_CONTENT;
  const ans = {}, byId = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ans[o.q] = o.a;
    if (o.id && Array.isArray(o.questions)) byId[o.id] = o.questions;
    Object.keys(o).forEach(k => walk(o[k]));
  })(BANK);
  const units = {}; (passed || []).forEach(id => { units[id] = { star: 3 }; });
  const qstat = {};
  (weak ? weak(byId) : []).forEach(q => { qstat[w.QSTAT.id(q.q)] = { n: 3, ok: 1 }; });
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const calls = { unit: [], qstat: [] };
  w.REPORT = {
    qstat: (m, x) => { calls.qstat.push(x); return Promise.resolve(); },
    unit: (m, id, o) => { calls.unit.push(id); return Promise.resolve(); },
    get: () => Promise.resolve({ units, qstat, stars: 3 }),
    history: (m, id) => Promise.resolve(units[id] ? [{ unit: id, at: Date.now(), score: 90, duration: '01:00', correct: 10, total: 11 }] : [])
  };
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, calls, ans, byId, BANK, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const qText = r => { const h = r.$('question-container').querySelector('h3'); return h ? h.textContent : ''; };
const optIdx = (r, right) => [...r.w.document.querySelectorAll('.qz-opt')]
  .findIndex(o => r.w.ANSKEY.check(qText(r), o.textContent, r.ans[qText(r)]) === right);
const send = r => click(r.w, r.$('next-btn'));
/** 跑完一輪：第一題答錯、其餘答對；回傳看到的題目 */
function playRound(r, firstWrong) {
  const seen = [];
  for (let i = 0; i < 15 && !r.$('quiz-screen').classList.contains('hidden'); i++) {
    seen.push(qText(r));
    click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, !(firstWrong && i === 0))]);
    send(r); send(r);
  }
  return seen;
}

(async () => {
  section('① 入口：章節選單最下面（總整理下方），只有 11501');
  {
    /* 老師 2026-10-08：11502 也開記憶補給站。 */
    const r = boot('11502', 'social.js', [], null); await sleep(400);
    const lastCh = [...r.w.document.querySelectorAll('.qz-open')].pop();
    ok(r.$('qz-practice') && lastCh && (lastCh.compareDocumentPosition(r.$('qz-practice')) & r.w.Node.DOCUMENT_POSITION_FOLLOWING),
       '★★ 11502 也有補給站，放在章節選單最下面');
    ok(r.$('qz-practice-go').disabled, '　一章都還沒通關 ⇒ 鎖住');
    const r2 = boot('11502', 'social.js', ['5-1'], null); await sleep(400);
    click(r2.w, r2.$('qz-practice-go')); await sleep(10);
    const seen = playRound(r2, false);
    const pass51 = new Set(r2.byId['5-1'].map(q => q.q));
    ok(seen.length === 10 && seen.every(q => pass51.has(q)), '★★ 11502 補給站：通關 5-1 ⇒ 10 題都出自 5-1');
  }
  {
    const r = boot('11501', 'ethics.js', [], null); await sleep(400);
    const card = r.$('qz-practice');
    const review = r.w.document.querySelector('.qz-open[data-ch="review-all"]');
    ok(card && review && (review.compareDocumentPosition(card) & r.w.Node.DOCUMENT_POSITION_FOLLOWING),
       '★★★ 補給站卡片在「資訊倫理與相關法律總整理」的下方');
    ok(card && /記憶補給站/.test(card.textContent) && /已通關的章節/.test(card.textContent)
       && /最多 5 題/.test(card.textContent) && /border-amber-300/.test(card.className),
       '★★ 明顯提示：黃色粗框卡片，寫明「從已通關的章節出題、答錯過的最多 5 題」');
    ok(r.$('qz-practice-go').disabled && /通關任一章節後開放/.test(r.$('qz-practice-go').textContent),
       '★★ 一章都還沒通關 ⇒ 鎖住，寫明「通關任一章節後開放」');
    click(r.w, r.$('qz-practice-go'));
    ok(r.$('quiz-screen').classList.contains('hidden'), '　鎖住時按了沒有反應');
  }

  section('② 從已通關的章節出 10 題：答錯過的 5 題＋其餘任選');
  const r = boot('11501', 'ethics.js', ['1-1', '1-2'], byId =>
    byId['1-1'].slice(0, 7).concat(byId['3-1'].slice(0, 3)));   // 3-1 沒通關，它的錯題不可以出
  await sleep(400);
  const passedQ = new Set(r.byId['1-1'].concat(r.byId['1-2']).map(q => q.q));
  const weak11 = new Set(r.byId['1-1'].slice(0, 7).map(q => q.q));
  const weak31 = new Set(r.byId['3-1'].slice(0, 3).map(q => q.q));
  ok(!r.$('qz-practice-go').disabled && /2 個章節/.test(r.$('qz-practice-go').textContent),
     '★ 有通關的章節 ⇒ 開放，寫明從幾個章節出題');
  click(r.w, r.$('qz-practice-go')); await sleep(10);
  ok(!r.$('quiz-screen').classList.contains('hidden') && /記憶補給站/.test(r.$('current-chapter-title').textContent),
     '按下去直接進題目');
  ok(/第 1 \/ 10 題/.test(r.$('score-counter').textContent), '★ 計數器是「第 1 / 10 題」');
  ok(r.$('timer').classList.contains('hidden'), '不計時');
  // 第一題答錯：公布正解
  click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, false)]);
  send(r);
  ok(r.$('prac-fb') && /正確答案是/.test(r.$('prac-fb').textContent), '★★★ 答錯 ⇒ 當場公布正確答案');
  const opts = [...r.w.document.querySelectorAll('.qz-opt')];
  const goodEl = opts[optIdx(r, true)];
  ok(goodEl.classList.contains('bg-emerald-100'), '　正確的選項標綠色');
  const other = opts.find(o => o !== goodEl && !o.classList.contains('bg-rose-100'));
  click(r.w, other);
  ok(!other.classList.contains('bg-blue-100') && /下一題/.test(r.$('next-btn').textContent), '　公布之後再點選項沒有作用');
  const first = qText(r);
  send(r);
  const seen = [first].concat(playRound(r, false));
  ok(seen.length === 10, '★★ 一輪剛好 10 題（實際 ' + seen.length + '）');
  ok(seen.every(q => passedQ.has(q)), '★★★ 全部出自已通關的章節（1-1、1-2）');
  ok(!seen.some(q => weak31.has(q)), '★★★ 沒通關章節（3-1）的錯題不會出');
  const nWeak = seen.filter(q => weak11.has(q)).length;
  ok(nWeak === 5, '★★★ 答錯過的有 7 題 ⇒ 這一輪剛好出 5 題（實際 ' + nWeak + '）');
  ok(new Set(seen).size === 10, '　同一輪題目不重複');

  section('③ 結果：列出答錯的題目；不計分、不記錄、不進題目統計');
  ok(!r.$('practice-screen').classList.contains('hidden') && r.$('prac-score').textContent === '9 / 10',
     '★ 結果畫面：答對 9 / 10（實得 ' + r.$('prac-score').textContent + '）');
  ok(r.$('prac-review').children.length === 1 && /正確答案/.test(r.$('prac-review').textContent), '★★ 列出答錯的題目和正確答案');
  ok(/其中 5 題是你之前答錯過的/.test(r.$('prac-chapter').textContent), '告訴他有幾題是之前答錯過的');
  await sleep(10);
  ok(r.calls.unit.length === 0 && r.calls.qstat.length === 0,
     '★★★ 不寫闖關紀錄、不進題目統計（教師端題目分析與每日難度分級不受影響）');

  section('④ 離開就換題（11501 正式挑戰沒開，補給站一律開）');
  click(r.w, r.$('prac-again')); await sleep(10);
  const before = qText(r);
  r.w.dispatchEvent(new r.w.Event('blur'));
  ok(!r.$('question-container').querySelector('h3'), '★★★ 失焦 ⇒ 題目文字從網頁裡拿掉');
  r.w.dispatchEvent(new r.w.Event('focus'));
  const after = qText(r);
  ok(after && after !== before && passedQ.has(after), '★★★ 回來 ⇒ 換一題（還是已通關章節的題目）');
  ok(/第 1 \/ 10 題/.test(r.$('score-counter').textContent), '★ 換題不算一題');
  const seen2 = playRound(r, false);
  ok(seen2.length === 10 && !seen2.includes(before), '★★ 換掉的那一題這一輪不會再出現；一輪仍是 10 題');
  ok(r.errs.length === 0, '過程沒有丟例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));

  section('⑤ 沒有錯題 ⇒ 全部任選');
  {
    const r2 = boot('11501', 'ethics.js', ['1-1', '1-2'], null); await sleep(400);
    click(r2.w, r2.$('qz-practice-go')); await sleep(10);
    const s = playRound(r2, false);
    ok(s.length === 10 && s.every(q => passedQ.has(q)), '★★ 沒有錯題也照樣出 10 題（都是已通關章節的）');
    ok(/全部隨機/.test(r2.$('prac-chapter').textContent), '　結果寫明「沒有答錯過的題目，全部隨機」');
  }

  section('⑥ 正式挑戰照舊；過關紀錄視窗不再放補給站');
  {
    const r3 = boot('11501', 'ethics.js', ['1-1'], null); await sleep(400);
    click(r3.w, r3.w.document.querySelector('.qz-open[data-ch="1-1"]')); await sleep(10);
    ok(!r3.$('hist-practice'), '★ 入口只有一個（章節選單最下面）');
    click(r3.w, r3.$('hist-again'));
    click(r3.w, r3.$('start-quiz-btn'));
    ok(/連對: 0 \/ 10/.test(r3.$('score-counter').textContent) && !r3.$('timer').classList.contains('hidden'),
       '★★ 正式挑戰的計數器、計時器照舊');
    const b = qText(r3);
    r3.w.dispatchEvent(new r3.w.Event('blur')); r3.w.dispatchEvent(new r3.w.Event('focus'));
    ok(qText(r3) === b, '★ 11501 正式挑戰仍然「不換題」（補給站的開關沒有漏過來）');
    for (let i = 0; i < 10; i++) {
      click(r3.w, r3.w.document.querySelectorAll('.qz-opt')[optIdx(r3, true)]);
      send(r3);
    }
    await sleep(10);
    ok(r3.calls.unit.length === 1, '★★ 正式挑戰答對十題照樣回報通關');
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
