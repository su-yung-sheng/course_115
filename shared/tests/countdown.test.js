/* 每題倒數：60 秒內要作答，超過算答錯；連續兩題時間到 ⇒ 這次挑戰作廢、從頭開始
   跑法：node shared/tests/countdown.test.js   （需要 jsdom）

   ★ 老師 2026-11-06：「避免發呆，每題設定倒數 60 秒，原有計時保留，超過算答錯，連續兩次退回章節起點」
     決定：現在就生效（舊的連對模式、段落閱讀模式都套用）；只用在正式挑戰（補給站不限時）；
           退回起點＝這次挑戰作廢（連對、容錯、計時歸零，不記成績）。
   ⚠️ 測試把秒數調成 1 秒（內容檔的 questionSeconds），流程和 60 秒一樣。 */
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

/* ⚠️ 每一段測完要 killTimers()：引擎用全域 document 與 Node 的 setInterval，
      上一段的倒數計時器還在跑的話，會去動下一段的畫面（測試才有的干擾，真正的頁面一次只有一個）。 */
const _ids = [], _si = global.setInterval;
global.setInterval = function (f, t) { const id = _si(f, t); _ids.push(id); return id; };
function killTimers() { _ids.splice(0).forEach(id => clearInterval(id)); }
function boot(opts) {
  opts = opts || {};
  const term = opts.term || '11501', B = term === '11502' ? 'social' : 'ethics';
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(String(e && e.message || e)));
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/' + term + '/' + (term === '11502' ? 'social' : 'cyberethics') + '.html', virtualConsole: vc });
  const w = dom.window;
  global.window = w; global.document = w.document; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.localStorage = w.localStorage;
  ['grading.js', 'qstat.js', 'anskey.js'].forEach(f => new Function('window', read('shared/' + f))(w));
  new Function('window', read(term + '/content/' + B + '.js'))(w);
  new Function('window', read(term + '/content/' + B + '.hints.js'))(w);
  new Function('window', read(term + '/content/' + B + '.read.js'))(w);
  let cfg = read(term + '/config.js');
  cfg = cfg.replace(/READ_MODE_FROM:\s*'[^']*'/, "READ_MODE_FROM: '" + (opts.read ? '2000-01-01' : '2999-12-31') + "'");
  new Function('window', cfg)(w);
  w.QUIZ_CONTENT.questionSeconds = 1;
  const ans = {};
  (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ans[o.q] = o.a; Object.keys(o).forEach(k => walk(o[k])); })([w.QUIZ_CONTENT, w.QUIZ_READ]);
  const units = [], U = {}; (opts.passed || []).forEach(id => { U[id] = { star: 1 }; });
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  w.REPORT = { qstat: () => Promise.resolve(), unit: (m, id, o) => { units.push({ id, o }); return Promise.resolve(); },
    get: () => Promise.resolve({ units: U, qstat: {}, stars: 0 }), history: () => Promise.resolve([]) };
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, units, ans, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const shown = el => el && !el.classList.contains('hidden');
const qText = r => { const h = r.$('question-container').querySelector('h3'); return h ? h.textContent : ''; };
const optIdx = (r, right) => [...r.w.document.querySelectorAll('.qz-opt')]
  .findIndex(o => r.w.ANSKEY.check(qText(r), o.textContent, r.ans[qText(r)]) === right);
const send = r => click(r.w, r.$('next-btn'));
const answer = (r, right) => { click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, right)]); send(r); };
async function start(r, id) {
  await sleep(300);
  click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + id + '"]')); await sleep(10);
  click(r.w, r.$('start-quiz-btn')); await sleep(5);
}

(async () => {
  section('連對模式（目前線上）');
  {
    const r = boot();
    await start(r, '1-1');
    ok(shown(r.$('q-countdown')) && /剩 1 秒/.test(r.$('q-countdown').textContent), '★★ 出題就開始倒數（測試用 1 秒）');
    ok(shown(r.$('timer')), '★ 原本的總計時還在');
    answer(r, true); answer(r, true);
    ok(/連對: 2/.test(r.$('score-counter').textContent), '先連對 2 題');
    await sleep(1300);
    ok(!!r.$('qz-explain') && /時間到/.test(r.$('qz-explain').textContent), '★★★ 時間到 ⇒ 算答錯，顯示答錯說明（標明時間到）');
    ok(!/你選的是/.test(r.$('qz-explain').textContent), '沒作答，不顯示「你選的是」');
    ok(/連對: 0/.test(r.$('score-counter').textContent) && /容錯: 19/.test(r.$('wrong-counter').textContent), '★★★ 連對歸零、容錯 -1');
    ok(!shown(r.$('q-countdown')), '解釋畫面不倒數');
    await sleep(1200);
    ok(!!r.$('qz-explain'), '★ 停在解釋畫面不會再被算時間到');
    send(r);
    ok(!r.$('qz-explain') && shown(r.$('q-countdown')), '下一題重新倒數');
    answer(r, true);                                  // 中間有送出答案 ⇒ 連續次數歸零
    await sleep(1300);
    ok(!!r.$('qz-explain') && shown(r.$('quiz-screen')), '★★ 中間答過一題，再時間到只算第 1 次（不作廢）');
    send(r);
    await sleep(1300);
    ok(!shown(r.$('quiz-screen')) && shown(r.$('study-screen')), '★★★ 連續兩題時間到 ⇒ 回到教材頁');
    ok(shown(r.$('modal')) && /連續兩題/.test(r.$('modal-msg').textContent + r.$('modal-title').textContent), '★★ 跳出說明：這次挑戰作廢');
    ok(r.units.length === 0, '★★ 不記成績');
    click(r.w, r.$('modal-ok'));
    click(r.w, r.$('start-quiz-btn'));
    ok(/連對: 0/.test(r.$('score-counter').textContent) && /容錯: 20/.test(r.$('wrong-counter').textContent) && r.$('timer').textContent === '00:00',
       '★★★ 重新開始：連對、容錯、總計時都歸零');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
    killTimers();
  }
  section('通關回報時間到的題數');
  {
    const r = boot();
    await start(r, '1-1');
    await sleep(1300); send(r);
    for (let i = 0; i < 10; i++) answer(r, true);
    await sleep(10);
    const u = r.units[0];
    ok(u && u.o.extra.timeout === 1 && u.o.extra.total === 11, '★★ extra.timeout ＝ 1（時間到算進答錯：共 11 題）');
    killTimers();
  }
  section('段落閱讀模式');
  {
    const r = boot({ read: true });
    await start(r, '1-1');
    ok(shown(r.$('q-countdown')), '★ 段落模式也倒數');
    answer(r, true);
    await sleep(1300);
    ok(!!r.$('qz-explain') && /時間到/.test(r.$('qz-explain').textContent) && r.$('qz-explain').querySelectorAll('.border-emerald-500').length === 1,
       '★★★ 時間到 ⇒ 公布正解＋理由');
    ok(/連對: 0 \/ 10/.test(r.$('score-counter').textContent), '★★ 這一段的連對歸零');
    send(r);
    await sleep(1300);
    ok(shown(r.$('study-screen')) && /第 1 段／共 4 段/.test(r.$('study-title').textContent), '★★★ 連續兩題時間到 ⇒ 回到第 1 段');
    click(r.w, r.$('modal-ok'));
    ok(!shown(r.$('q-countdown')), '讀課文時不倒數');
    await sleep(1200);
    ok(shown(r.$('study-screen')), '★ 停在課文頁不會被算時間到');
    click(r.w, r.$('start-quiz-btn'));
    ok(/容錯: 20/.test(r.$('wrong-counter').textContent), '重新開始：容錯歸零');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
    killTimers();
  }
  section('11502 離開就換題：題目被收走時不倒數');
  {
    const r = boot({ term: '11502' });
    await start(r, '5-1');
    r.w.dispatchEvent(new r.w.Event('blur'));
    await sleep(1400);
    ok(!r.$('qz-explain') && /容錯: 20/.test(r.$('wrong-counter').textContent), '★★ 離開期間不算時間到');
    r.w.dispatchEvent(new r.w.Event('focus'));
    ok(qText(r).length > 3 && /剩 1 秒/.test(r.$('q-countdown').textContent), '回來換新題，重新倒數');
    killTimers();
  }
  section('記憶補給站不限時');
  {
    const r = boot({ passed: ['1-1'] });
    await sleep(400);
    click(r.w, r.$('qz-practice-go')); await sleep(10);
    ok(!shown(r.$('q-countdown')), '★★ 補給站沒有倒數');
    const q = qText(r);
    await sleep(1300);
    ok(qText(r) === q && !r.$('qz-explain'), '★★ 放著不動也不會被算答錯');
  }
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
