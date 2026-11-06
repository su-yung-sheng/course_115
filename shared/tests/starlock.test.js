/* 三星鎖定：拿到 3★ 的章節不再開放挑戰，只能到記憶補給站練習
   跑法：node shared/tests/starlock.test.js   （需要 jsdom）

   ★ 老師 2026-11-06：「答題三星之後不再開放，只能到練習區練習」（選「現在就生效」）
     補給站範圍維持「已通關（≥1★）的章節」。
   ⚠️ 補給站入口仍然只有一個（章節選單最下面，老師 10-05 定案）——
      滿星時紀錄視窗只把「返回目錄」改成「返回目錄，前往補給站」，捲到那張卡。 */
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

/* units：{ 章節id: 星數 }；opts.noGet：REPORT 沒有 get（讀不到進度） */
function boot(term, units, opts) {
  opts = opts || {};
  const B = term === '11502' ? 'social' : 'ethics';
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
  new Function('window', read(term + '/config.js'))(w);
  const U = {}; Object.keys(units).forEach(id => { U[id] = { star: units[id], score: 90 }; });
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const calls = { unit: [] };
  w.REPORT = {
    qstat: () => Promise.resolve(),
    unit: (m, id, o) => { calls.unit.push(id); return Promise.resolve(); },
    history: (m, id) => Promise.resolve(U[id] ? [{ unit: id, at: Date.now(), score: 90, duration: '01:00', correct: 10, total: 11 }] : [])
  };
  if (!opts.noGet) w.REPORT.get = () => Promise.resolve({ units: U, qstat: {}, stars: 3 });
  w.eval(read('shared/quiz-engine.js'));
  return { w, errs, calls, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const shown = el => el && !el.classList.contains('hidden');
async function open(r, id) { click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + id + '"]')); await sleep(15); }

(async () => {
  for (const term of ['11501', '11502']) {
    const id = term === '11501' ? '1-1' : '5-1';
    const ch = term === '11501' ? 'ch1-all' : '5-all';
    section(term + ' 已滿星（3★）');
    {
      const r = boot(term, { [id]: 3, [ch]: 3 }); await sleep(300);
      await open(r, id);
      ok(shown(r.$('action-modal')) && r.$('action-modal').classList.contains('flex'), '點滿星章節 → 跳出紀錄視窗');
      ok(/已經滿星/.test(r.$('hist-title').textContent), '★★ 標題寫明已經滿星');
      ok(/不再開放挑戰/.test(r.$('hist-desc').textContent) && /記憶補給站/.test(r.$('hist-desc').textContent), '★★ 說明：不再開放、到記憶補給站練習');
      ok(!shown(r.$('hist-again')), '★★★ 「再次闖關」藏起來');
      click(r.w, r.$('hist-again'));
      ok(!shown(r.$('study-screen')) && !shown(r.$('quiz-screen')), '★★★ 就算硬按「再次闖關」也進不去');
      ok(!r.$('hist-practice'), '★ 補給站入口仍然只有一個（視窗裡不另開按鈕）');
      ok(/前往補給站/.test(r.$('hist-close').textContent), '「返回目錄」改成「返回目錄，前往補給站」');
      click(r.w, r.$('hist-close'));
      ok(!shown(r.$('action-modal')) && r.$('qz-practice').classList.contains('ring-4'), '★ 返回目錄後，補給站那張卡亮起來提示');
      ok(!r.$('qz-practice-go').disabled, '★★ 補給站可以進（已通關章節）');
      await open(r, ch);
      ok(!shown(r.$('hist-again')), '★★ 整章挑戰滿星也鎖住');
      ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
    }
    section(term + ' 還沒滿星（2★）照舊可以重考');
    {
      const r = boot(term, { [id]: 2 }); await sleep(300);
      await open(r, id);
      ok(shown(r.$('hist-again')) && /過關紀錄查詢/.test(r.$('hist-title').textContent), '★★★ 2★：紀錄視窗照舊、有「再次闖關」');
      ok(r.$('hist-close').textContent === '返回目錄', '「返回目錄」照舊');
      click(r.w, r.$('hist-again'));
      ok(shown(r.$('study-screen')), '★★ 按「再次闖關」進得去');
    }
    section(term + ' 先開滿星、再開 2★：視窗要換回一般模式');
    {
      const r = boot(term, { [id]: 3, [ch]: 2 }); await sleep(300);
      await open(r, id); click(r.w, r.$('hist-close'));
      await open(r, ch);
      ok(shown(r.$('hist-again')) && /過關紀錄查詢/.test(r.$('hist-title').textContent), '★★ 不會殘留上一個章節的鎖定');
    }
  }
  section('進度還沒畫完就點章節：靠 REPORT.get 判斷');
  {
    const r = boot('11501', { '1-1': 3 });           // 不等 paintBadges
    await sleep(0);
    r.w.QUIZ && r.w.QUIZ.setUser && r.w.QUIZ.setUser({ cls: '801', no: '01', name: '測試學生' });
    await sleep(5);
    const b = r.w.document.querySelector('.qz-open[data-ch="1-1"]');
    if (b) { click(r.w, b); await sleep(15); ok(!shown(r.$('hist-again')), '★★ 一開頁就點，照樣鎖住'); }
    else ok(true, '（章節按鈕還沒畫出來，略過）');
  }
  section('讀不到進度（沒有 REPORT.get、也還沒畫徽章）：不鎖');
  {
    const r = boot('11501', { '1-1': 3 }, { noGet: true });
    await sleep(0);
    const b = r.w.document.querySelector('.qz-open[data-ch="1-1"]');
    if (b) { click(r.w, b); await sleep(15); ok(shown(r.$('hist-again')) || shown(r.$('study-screen')), '★ 寧可多給一次，也不擋人'); }
    else ok(true, '（章節按鈕還沒畫出來，略過）');
  }
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
