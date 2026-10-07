/* 11501 流程圖與程式設計：程式設計頁「自我檢核測驗」的離開就換題
   跑法：node shared/tests/progquiz.test.js

   ★ 老師 2026-10-07：「流程圖與程式設計的解開程式圖片問答中也是有失焦的可能」。
     做法和章節測驗（QUIZ_SWAP_ON_LEAVE）、記憶補給站一樣：
     離開 ⇒ 題目文字拿掉；回來 ⇒ 換一題這一輪沒有的。不扣分。
   ⚠️ 這一頁特有的兩個坑，這份測試專門守：
     ① 頁面上有影片和評分站兩個 iframe —— 點進去不是離開。
     ② 收題／換題只能重畫測驗那一塊，不可以 render()（會把評分站 iframe 換掉）。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
const noComments = t => String(t)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');
const CODE = noComments(FC);

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

function grab(name) {
  const m = FC.match(new RegExp('    function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n    \\}'));
  return m ? m[0] : '';
}
const NAMES = ['quizLive', 'swapPick', 'paintQuizBox', 'pullQuiz', 'backQuiz', 'quizAreaHTML'];
const SRC = NAMES.map(grab);

section('找得到要測的函式');
NAMES.forEach((n, i) => ok(SRC[i].length > 0, n));

/* ── 沙箱 ── */
function makeBox(opts) {
  const bank = [0, 1, 2, 3, 4].map(k => ({ q: '題目' + k, o: ['甲', '乙', '丙', '丁'], a: k % 4 }));
  const box = { innerHTML: '' };
  const ctx = {
    Math,
    state: Object.assign({ status: 'program', unit: { id: 'U' }, quizSet: [bank[0], bank[1], bank[2]],
                           qIdx: 0, qPicked: null, qScore: 0, qPulled: false }, opts || {}),
    PROG: { U: { quiz: bank } },
    renders: 0,
    document: { getElementById: id => (id === 'quiz-box' ? box : null) },
  };
  ctx.render = () => { ctx.renders++; };
  vm.createContext(ctx);
  vm.runInContext(SRC.join('\n'), ctx);
  return { ctx, box, bank };
}

section('★★★ 題目顯示中離開 ⇒ 題目文字從網頁裡拿掉');
{
  const { ctx, box } = makeBox();
  ctx.paintQuizBox();
  ok(/題目0/.test(box.innerHTML), '一開始看得到題目');
  ctx.pullQuiz();
  ok(ctx.state.qPulled === true, '狀態記成「收起來了」');
  ok(!/題目0/.test(box.innerHTML) && !/甲/.test(box.innerHTML),
     '★★★ 題目和選項的文字都不在網頁裡（AI 讀網頁也讀不到）');
  ok(/quiz-pulled/.test(box.innerHTML) && /換一題/.test(box.innerHTML), '改成「收起來了，回來換一題」');
  ok(ctx.renders === 0, '★★★ 沒有呼叫 render()（評分站 iframe 不會被換掉）');
}

section('★★★ 回來 ⇒ 換成這一輪沒有的題目');
{
  for (let t = 0; t < 30; t++) {
    const { ctx, box, bank } = makeBox();
    ctx.pullQuiz(); ctx.backQuiz();
    const now = ctx.state.quizSet[0];
    if (!(now === bank[3] || now === bank[4])) { ok(false, '換到的題目要是題庫裡這一輪沒有的（第 ' + t + ' 次是 ' + now.q + '）'); break; }
    if (t === 29) ok(true, '★★★ 30 次都換成這一輪沒有的（3、4 號）');
    if (t === 0) {
      ok(ctx.state.qPulled === false, '收起狀態解除');
      ok(new RegExp(now.q).test(box.innerHTML), '畫面是新題目');
      ok(ctx.state.quizSet.length === 3 && ctx.state.qScore === 0, '一輪還是 3 題、不扣分不加分');
      ok(ctx.renders === 0, '★★ 回來也不 render()');
    }
  }
}

section('★★ 題庫用完了也不能換回同一題');
{
  const { ctx } = makeBox();
  const bank = ctx.PROG.U.quiz;
  ok(ctx.swapPick(bank, [bank[0], bank[1], bank[2], bank[3], bank[4]], bank[2]) !== bank[2],
     '這一輪沒有的都用完了 ⇒ 挑「不是這一題」的');
  ok(ctx.swapPick([bank[0]], [bank[0]], bank[0]) === bank[0], '題庫只有一題 ⇒ 只能留著（不會壞掉）');
  ok(ctx.swapPick([], [], undefined) === undefined, '空題庫不會丟錯');
}

section('★★ 不該收的時候不收');
{
  let b = makeBox({ qPicked: 2 });
  b.ctx.pullQuiz();
  ok(b.ctx.state.qPulled === false, '已經作答、公布對錯的那一題不收');
  b = makeBox({ qIdx: 3 });
  b.ctx.pullQuiz();
  ok(b.ctx.state.qPulled === false, '結果畫面不收');
  b = makeBox({ status: 'read' });
  b.ctx.pullQuiz();
  ok(b.ctx.state.qPulled === false, '不在程式設計頁不收');
  b = makeBox();
  b.ctx.backQuiz();
  ok(b.ctx.state.quizSet[0] === b.bank[0], '沒有離開過，回來不換題（focus 常常會自己來）');
  b.ctx.pullQuiz(); b.ctx.pullQuiz();
  b.ctx.backQuiz(); const once = b.ctx.state.quizSet[0];
  b.ctx.backQuiz();
  ok(b.ctx.state.quizSet[0] === once, 'visibilitychange 和 focus 都來 ⇒ 只換一次');
}

section('★★★ 事件接線');
{
  ok(/addEventListener\('visibilitychange',\s*\(\)=>\{\s*if\(document\.hidden\) pullQuiz\(\); else backQuiz\(\);/.test(CODE),
     '切分頁 ⇒ 收；切回來 ⇒ 換');
  /* ⚠️ 點進教學影片或評分站的 iframe，視窗也會 blur —— 那不是離開。 */
  const blur = (CODE.match(/addEventListener\('blur',[\s\S]*?\}, 0\);/) || [''])[0];
  ok(/setTimeout/.test(blur) && /document\.activeElement/.test(blur)
     && /tagName === 'IFRAME'\) return;/.test(blur) && /pullQuiz\(\)/.test(blur),
     '★★★ blur 之後等一拍看焦點：跑進自己頁面的 iframe（影片、評分站）就不收');
  ok(!/hasFocus/.test(blur), '★★ 不靠 hasFocus()（有些環境永遠回 false）');
  ok(/addEventListener\('focus', backQuiz\)/.test(CODE), '視窗拿回焦點 ⇒ 換');
  ok(/closest\('#quiz-pulled'\)\)\{ backQuiz\(\); return; \}/.test(CODE),
     '點「收起來了」那一塊也能回來（有時 focus 事件不會來）');
  ok(!/render\(\)/.test(grab('pullQuiz') + grab('backQuiz') + grab('paintQuizBox')),
     '★★★ 收題／換題的函式裡沒有 render()');
  ok(/<div id="quiz-box">\$\{quizArea\}<\/div>/.test(FC) && /const quizArea = quizAreaHTML\(\);/.test(FC),
     '★★ 整頁畫面和局部重畫用同一支 quizAreaHTML（不會兩份各改各的）');
}

section('★★ 重新開始時要清掉「收起來了」');
{
  const sp = grab('startProgram'), rq = grab('retryQuiz');
  ok(/state\.qPulled=false/.test(sp), '進程式設計頁時清掉');
  ok(/state\.qPulled=false/.test(rq), '換 3 題再挑戰時清掉');
  ok(/qPulled:false/.test(FC), 'state 初始值有 qPulled');
  ok(/作答中切到別的視窗，題目會先收起來，回來換一題（不扣分）/.test(FC),
     '★ 畫面上先講清楚規則（學生不會覺得是壞掉）');
}

section('★★★ 作答不整頁重繪（影片、評分站 iframe 不被換掉）');
{
  /* ⛔ 2026-10-07 之前每答一題就 render()：影片從頭開始、評分站重新載入，
     一邊等評分一邊答題的學生，評分結果會消失。 */
  const more = ['progImgsHTML', 'quizRedraw', 'pickAns', 'nextQ', 'retryQuiz', 'newQuizSet', 'shuffle'];
  more.forEach(n => ok(grab(n).length > 0, '找得到 ' + n));
  const bank = [0, 1, 2, 3, 4].map(k => ({ q: '題目' + k, o: ['甲', '乙', '丙', '丁'], a: 1 }));
  const box = { innerHTML: '' }, imgs = { innerHTML: '' };
  const ctx = {
    Math, QUIZ_PICK: 3,
    state: { status: 'program', unit: { id: 'U' }, quizSet: bank.slice(0, 3), qIdx: 0, qPicked: null,
             qScore: 0, qPulled: false, quizPassed: false },
    PROG: { U: { quiz: bank, imgs: ['a.png', 'b.png'] } },
    renders: 0,
    document: { getElementById: id => (id === 'quiz-box' ? box : id === 'prog-imgs' ? imgs : null) },
  };
  ctx.render = () => { ctx.renders++; };
  vm.createContext(ctx);
  vm.runInContext(SRC.concat(more.map(grab)).join('\n'), ctx);
  ctx.pickAns(1);
  ok(/bg-emerald-50/.test(box.innerHTML), '答完一題：測驗那一塊有公布對錯');
  ctx.nextQ(); ctx.pickAns(1); ctx.nextQ();
  ok(!/a\.png/.test(imgs.innerHTML), '還沒全對：截圖不出現');
  ctx.pickAns(1); ctx.nextQ();
  ok(ctx.state.quizPassed === true && /全對/.test(box.innerHTML), '三題全對：測驗那一塊顯示通過');
  ok(/a\.png/.test(imgs.innerHTML) && /b\.png/.test(imgs.innerHTML) && /已解鎖/.test(imgs.innerHTML),
     '★★★ 全對時截圖區跟著解鎖（不用整頁重畫）');
  ctx.retryQuiz();
  ok(/第 1 \/ 3 題/.test(box.innerHTML), '換 3 題再挑戰：回到第 1 題');
  ok(ctx.renders === 0, '★★★ 整個過程 render() 一次都沒有呼叫');
  /* 找不到測驗那一塊才退回整頁重繪 —— 不可以靜靜地什麼都不做。 */
  ctx.document.getElementById = () => null;
  ctx.pickAns(0); ctx.state.qPicked = null; ctx.pickAns(0);
  ok(ctx.renders > 0, '★★ 找不到 #quiz-box 時退回 render()');
  ok(/<div id="prog-imgs">\$\{progImgsHTML\(p\)\}<\/div>/.test(FC), '★★ 整頁畫面和局部重畫用同一支 progImgsHTML');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
