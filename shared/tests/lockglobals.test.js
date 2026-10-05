/* 前端強化：判分、計星、設定載入後鎖住
   跑法：node shared/tests/lockglobals.test.js   （第 ② 段需要 jsdom）

   ★ 老師 2026-10-05：收到一段學生用的攔截程式（改伺服器回傳的對錯），問「先強化前端」。
     那段程式攔錯了地方（排行賽是後端判分），但**同一種手法**用在章節測驗上是有效的：
     引擎判對錯時才去讀 window.ANSKEY.check，Console 打一行把它換成「永遠答對」，
     之後每一題都算對 —— 作答時間是真的，可疑紀錄頁看不出來。
   ★ 這一支驗：① 每一個物件改不動、換不掉；② 真的把章節測驗跑起來，
     換掉判分函式之後故意全選錯，**不可以**通關。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* 學生在 Console 打的是非嚴格模式：改不動時**不會報錯**，只是沒效 */
const tamper = fn => { try { fn(); } catch (e) { /* 嚴格模式會丟錯，一樣是沒改到 */ } };

section('① 載入之後改不動、換不掉');
{
  const FILES = [['shared/anskey.js', 'ANSKEY'], ['shared/grading.js', 'GRADING'],
                 ['shared/qstat.js', 'QSTAT'], ['shared/report.js', 'REPORT'],
                 ['11501/config.js', 'CONFIG'], ['11502/config.js', 'CONFIG']];
  for (const [f, name] of FILES) {
    const w = {};
    new Function('window', read(f))(w);
    const obj = w[name];
    ok(obj && typeof obj === 'object', f + '：載得起來（window.' + name + '）');
    const before = JSON.stringify(Object.keys(obj));
    tamper(() => { w[name] = { hacked: true }; });
    tamper(() => { delete w[name]; });
    ok(w[name] === obj, '★★★ ' + f + '：window.' + name + ' 換不掉、刪不掉');
    const fnKey = Object.keys(obj).find(k => typeof obj[k] === 'function');
    if (fnKey) {
      const orig = obj[fnKey];
      tamper(() => { obj[fnKey] = () => true; });
      ok(obj[fnKey] === orig, '★★★ ' + f + '：裡面的函式（' + fnKey + '）換不掉');
    }
    tamper(() => { obj.__added = 1; });
    ok(!('__added' in obj) && JSON.stringify(Object.keys(obj)) === before, f + '：不能加新東西');
  }
  // 巢狀的也要鎖（加分值、設定開關）
  const g = {}; new Function('window', read('shared/grading.js'))(g);
  const vid = g.GRADING.BONUS.vid;
  tamper(() => { g.GRADING.BONUS.vid = 99; });
  ok(g.GRADING.BONUS.vid === vid, '★★ 巢狀的也鎖：GRADING.BONUS.vid 改不動（錄影加分值）');
  const c = {}; new Function('window', read('11502/config.js'))(c);
  tamper(() => { c.CONFIG.QUIZ_SWAP_ON_LEAVE = false; });
  ok(c.CONFIG.QUIZ_SWAP_ON_LEAVE === true,
     '★★★ 11502「離開就換題」關不掉（CONFIG.QUIZ_SWAP_ON_LEAVE 改不動）');
  // 正常功能照舊
  const k = {}; new Function('window', read('shared/anskey.js'))(k);
  const a = k.ANSKEY.of('題目', '對的');
  ok(k.ANSKEY.check('題目', '對的', a) && !k.ANSKEY.check('題目', '錯的', a), '鎖住之後判分照常');
  ok(g.GRADING.scratchStar(95) === 3 && g.GRADING.scratchStar(80) === 2, '鎖住之後計星照常');
  // 同一頁載入兩次不報錯、保留第一份
  const twice = {};
  new Function('window', read('shared/anskey.js'))(twice);
  const first = twice.ANSKEY;
  let threw = null;
  try { new Function('window', read('shared/anskey.js'))(twice); } catch (e) { threw = e; }
  ok(twice.ANSKEY === first, '★ 同一頁載入兩次保留第一份' + (threw ? '（第二次丟錯：' + threw.message + '）' : ''));
}

section('② 真的跑章節測驗：換掉判分函式、全部選錯 ⇒ 不可以通關');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { JSDOM = null; }
if (!JSDOM) {
  console.log('  （沒有 jsdom，略過這一段 —— 缺套件，不是失敗）');
} else {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/11501/cyberethics.html', virtualConsole: vc });
  const w = dom.window;
  global.window = w; global.document = w.document; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.localStorage = w.localStorage;
  ['grading.js', 'qstat.js', 'anskey.js'].forEach(f => new Function('window', read('shared/' + f))(w));
  new Function('window', read('11501/content/ethics.js'))(w);
  new Function('window', read('11501/config.js'))(w);
  const ansMap = {};
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.q && o.a) ansMap[o.q] = o.a;
    Object.keys(o).forEach(kk => walk(o[kk]));
  })(w.QUIZ_CONTENT);
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  const units = [];
  w.REPORT = { qstat: () => Promise.resolve(), get: () => Promise.resolve(null),
               history: () => Promise.resolve([]),
               unit: (m, id, o) => { units.push(id); return Promise.resolve(); } };
  w.eval(read('shared/quiz-engine.js'));
  const click = el => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
  const $ = id => w.document.getElementById(id);
  click([...w.document.querySelectorAll('.qz-open')][0]);
  click($('start-quiz-btn'));

  // ⛔ 學生在 Console 會打的兩種
  const realCheck = w.ANSKEY.check;
  tamper(() => { w.ANSKEY.check = function () { return true; }; });
  tamper(() => { w.ANSKEY = { check: function () { return true; } }; });
  ok(w.ANSKEY.check === realCheck, '★★★ Console 換判分函式沒有效');

  let answered = 0;
  for (let i = 0; i < 12; i++) {
    const box = $('question-container');
    if (!box || !box.querySelector('h3')) break;
    const q = box.querySelector('h3').textContent;
    const opts = [...w.document.querySelectorAll('.qz-opt')];
    const wrongIdx = opts.findIndex(o => !realCheck(q, o.textContent, ansMap[q]));
    if (wrongIdx < 0) break;
    click(opts[wrongIdx]);
    click([...w.document.querySelectorAll('button')].filter(b => /送出答案/.test(b.textContent))[0]);
    answered++;
  }
  ok(answered >= 10, '真的答了 ' + answered + ' 題（全選錯的那一個）');
  ok(units.length === 0,
     '★★★ 換掉判分函式、十幾題全選錯 ⇒ 沒有通關（沒有回報成績）　←　' + JSON.stringify(units));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
