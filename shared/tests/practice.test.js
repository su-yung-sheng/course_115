/* 🧠 記憶補給站：章節通關後的重複練習（11501）
   跑法：node shared/tests/practice.test.js   （需要 jsdom）

   ★ 老師 2026-10-05：「在 11501 的章節測驗中，通關後，加入一個重複練習，
     每次十題，一樣採用失焦機制，幫助複習」
     名稱：🧠 記憶補給站；出題：錯題優先；回饋：每題公布正解、不計分不記錄。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tick = () => new Promise(r => setTimeout(r, 0));

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

function boot(term, bank, weakOf) {
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
  const ans = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ans[o.q] = o.a;
    Object.keys(o).forEach(k => walk(o[k]));
  })(BANK);
  const firstId = BANK.chapters[0].challenge.id;
  const chQs = BANK.chapters[0].challenge.questions
    || BANK.chapters[0].sections.reduce((a, s) => a.concat(s.questions), []);
  const qstat = {};
  (weakOf ? weakOf(chQs) : []).forEach(q => { qstat[w.QSTAT.id(q.q)] = { n: 3, ok: 0 }; });
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const calls = { unit: [], qstat: [] };
  w.REPORT = {
    qstat: (m, x) => { calls.qstat.push(x); return Promise.resolve(); },
    unit: (m, id, o) => { calls.unit.push(id); return Promise.resolve(); },
    get: () => Promise.resolve({ qstat }),
    history: (m, id) => Promise.resolve([{ unit: id, at: Date.now(), score: 90, duration: '01:00', correct: 10, total: 11 }])
  };
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, calls, ans, chQs, firstId, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const qText = r => { const h = r.$('question-container').querySelector('h3'); return h ? h.textContent : ''; };
const optIdx = (r, right) => [...r.w.document.querySelectorAll('.qz-opt')]
  .findIndex(o => r.w.ANSKEY.check(qText(r), o.textContent, r.ans[qText(r)]) === right);
const send = r => click(r.w, r.$('next-btn'));

(async () => {
  section('① 入口：過關紀錄視窗（只有 11501）');
  {
    const r = boot('11502', 'social.js');
    click(r.w, r.w.document.querySelector('.qz-open')); await tick();
    ok(!r.$('hist-practice'), '11502 沒有設定 ⇒ 沒有這顆按鈕（和以前一樣）');
  }
  const r = boot('11501', 'ethics.js', qs => qs.slice(0, 3));
  const weakSet = new Set(r.chQs.slice(0, 3).map(q => q.q));
  click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + r.firstId + '"]')); await tick();
  const btn = r.$('hist-practice');
  ok(btn && /🧠 記憶補給站/.test(btn.textContent) && /每次 10 題/.test(btn.textContent),
     '★★ 通關過的章節：過關紀錄視窗有「🧠 記憶補給站」，寫明每次 10 題');

  section('② 一輪 10 題、錯題優先、每題公布正解');
  click(r.w, btn); await tick();
  ok(!r.$('quiz-screen').classList.contains('hidden') && /記憶補給站/.test(r.$('current-chapter-title').textContent),
     '按下去直接進題目（標題寫著記憶補給站）');
  ok(/第 1 \/ 10 題/.test(r.$('score-counter').textContent), '★ 計數器是「第 1 / 10 題」，不是連對');
  ok(r.$('timer').classList.contains('hidden') && r.$('target-counter').classList.contains('hidden'),
     '不計時、沒有「目標連對」');

  const seen = [];
  // 第 1 題：故意答錯，看公布正解
  seen.push(qText(r));
  click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, false)]);
  send(r);
  const fb = r.$('prac-fb');
  ok(fb && /正確答案是/.test(fb.textContent), '★★★ 答錯 ⇒ 當場公布正確答案');
  const opts = [...r.w.document.querySelectorAll('.qz-opt')];
  const goodEl = opts[optIdx(r, true)];
  ok(goodEl && goodEl.classList.contains('bg-emerald-100'), '★ 正確的選項標綠色');
  ok(/下一題/.test(r.$('next-btn').textContent), '按鈕變成「下一題」');
  const marked = opts.filter(o => o.classList.contains('bg-emerald-100')).length;
  const other = opts.find(o => o !== goodEl && !o.classList.contains('bg-rose-100'));
  click(r.w, other);
  ok(opts.filter(o => o.classList.contains('bg-emerald-100')).length === marked && /下一題/.test(r.$('next-btn').textContent)
     && !other.classList.contains('bg-blue-100'),
     '公布之後再點選項沒有作用');
  send(r);
  ok(/第 2 \/ 10 題/.test(r.$('score-counter').textContent), '換到第 2 題');

  section('③ 離開就換題（11501 正式挑戰沒開，補給站一律開）');
  const before = qText(r);
  r.w.dispatchEvent(new r.w.Event('blur'));
  ok(!r.$('question-container').querySelector('h3'), '★★★ 失焦 ⇒ 題目文字從網頁裡拿掉');
  r.w.dispatchEvent(new r.w.Event('focus'));
  const after = qText(r);
  ok(after && after !== before, '★★★ 回來 ⇒ 換一題（' + before.slice(0, 12) + '… → ' + after.slice(0, 12) + '…）');
  ok(/第 2 \/ 10 題/.test(r.$('score-counter').textContent), '★ 換題不算一題，還是第 2 題');

  // 剩下的都答對
  for (let i = 0; i < 12 && !r.$('quiz-screen').classList.contains('hidden'); i++) {
    seen.push(qText(r));
    click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, true)]);
    send(r); send(r);
  }
  ok(!seen.includes(before), '★★ 換掉的那一題這一輪不會再出現（查到答案也用不到）');
  ok(seen.length === 10, '★★ 一輪剛好 10 題（實際 ' + seen.length + '）');
  ok([...weakSet].every(q => seen.includes(q) || q === before),
     '★★★ 錯題優先：他答錯過的 3 題都在這一輪裡');

  section('④ 結果：列出答錯的題目；不計分、不記錄、不進題目統計');
  ok(!r.$('practice-screen').classList.contains('hidden'), '十題答完 ⇒ 補給站結果畫面');
  ok(r.$('prac-score').textContent === '9 / 10', '★ 顯示答對 9 / 10（實得 ' + r.$('prac-score').textContent + '）');
  ok(r.$('prac-review').children.length === 1 && /正確答案/.test(r.$('prac-review').textContent),
     '★★ 列出答錯的那一題和正確答案');
  ok(/之前答錯過/.test(r.$('prac-chapter').textContent), '告訴他這一輪有幾題是之前答錯過的');
  await tick();
  ok(r.calls.unit.length === 0 && r.calls.qstat.length === 0,
     '★★★ 不寫闖關紀錄、不進題目統計（教師端題目分析與排行賽分級不受影響）');
  ok(r.errs.length === 0, '過程沒有丟例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));

  section('⑤ 回到正式挑戰：一切照舊');
  click(r.w, r.$('prac-back'));
  click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + r.firstId + '"]')); await tick();
  click(r.w, r.$('hist-again'));
  click(r.w, r.$('start-quiz-btn'));
  ok(/連對: 0 \/ 10/.test(r.$('score-counter').textContent) && !r.$('timer').classList.contains('hidden'),
     '★★ 正式挑戰的計數器、計時器恢復');
  const b2 = qText(r);
  r.w.dispatchEvent(new r.w.Event('blur')); r.w.dispatchEvent(new r.w.Event('focus'));
  ok(qText(r) === b2, '★ 11501 正式挑戰仍然「不換題」（CONFIG 沒開，補給站的開關沒有漏過來）');
  for (let i = 0; i < 10; i++) {
    click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, true)]);
    send(r);
  }
  await tick();
  ok(r.calls.unit.length === 1, '★★ 正式挑戰答對十題照樣回報通關');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
