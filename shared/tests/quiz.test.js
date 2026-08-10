/* 概念檢測（程式拼圖之前那一關）
   跑法：node shared/tests/quiz.test.js

   ★ 這一份守的是三件事，每一件壞掉都不會有錯誤訊息：

     ① AI 出事時，學生照樣考得成
        額度會用完、模型會過載、回來的 JSON 會爛掉 —— 三種都遇過。
        任何一種都不該讓學生卡在「出題中…」。

     ② 星數只有一個寫入者
        概念檢測**封頂**，不發星。兩個地方都能改星數的話，
        之後沒有人說得出「這一顆星到底是誰給的」。

     ③ 不到門檻要真的帶他回去讀
        留在原地按重考的話，他只會亂猜到過為止 —— 那比不考還糟。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/** 準備一個假的 window，可以指定 ASKAI 要怎麼回 */
function win(askaiQuiz) {
  const w = {};
  ['grading.js', 'quiz.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(root, 'shared', f), 'utf8'))(w));
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(w);
  if (askaiQuiz) w.ASKAI = { enabled: () => true, quiz: askaiQuiz };
  return w;
}
const W = win();
const LV = id => W.BLOCK_LEVELS[id];
const aiItem = i => ({ q: 'AI 出的第 ' + i + ' 題？', options: ['甲', '乙', '丙', '丁'], answer: i % 4, why: 'x' });

(async () => {

section('題庫本身');
['2-1-1', '2-1-2', '2-1-3'].forEach(id => {
  const bank = LV(id).quiz || [];
  ok(bank.length >= W.QUIZ.N_TOTAL,
     id + ' 的題庫至少 ' + W.QUIZ.N_TOTAL + ' 題（' + bank.length + '）—— AI 失敗時要退得回來');
  ok(bank.every(W.QUIZ._valid), '   ' + id + ' 每一題都是四選一＋正解索引');
  ok(bank.every(q => q.why && q.why.length > 8),
     '   ★ ' + id + ' 每一題都說得出「答錯的人還沒懂什麼」—— 只說「錯了」等於沒教');
  ok(bank.every(q => new Set(q.options).size === 4), '   ' + id + ' 沒有重複的選項');
});
ok(!LV('2-3-1').quiz, '★ 沒寫題庫的關卡就是沒有（寧可不辦，也不要湊題目）');

section('選項要洗牌');
{
  const src = { q: '?', options: ['對', 'b', 'c', 'd'], answer: 0 };
  const pos = {};
  let kept = true;
  for (let i = 0; i < 200; i++) {
    const p = W.QUIZ._prep(src);
    pos[p.answer] = 1;
    if (p.options[p.answer] !== '對') kept = false;
    if (p.options.length !== 4 || new Set(p.options).size !== 4) kept = false;
  }
  ok(Object.keys(pos).length === 4, '★ 正解會出現在四個位置 —— 不然第二次考就變成「背 B」');
  ok(kept, '★ 洗完之後 answer 仍然指著同一個選項（洗牌最容易把正解洗丟）');
}

section('AI 回來的東西要驗形狀');
const V = W.QUIZ._valid;
ok(!V({ q: '短', options: ['a','b','c','d'], answer: 0 }), '題目太短 → 丟掉');
ok(!V({ q: '這是一個題目', options: ['a','b','c'], answer: 0 }), '★ 只有三個選項 → 丟掉');
ok(!V({ q: '這是一個題目', options: ['a','b','c','d'], answer: 4 }), '★ 正解索引越界 → 丟掉');
ok(!V({ q: '這是一個題目', options: ['a','b','c','d'], answer: '0' }), '★ 正解是字串 → 丟掉（不要幫它轉型）');
ok(!V({ q: '這是一個題目', options: ['a','','c','d'], answer: 0 }), '空選項 → 丟掉');
ok(!V(null) && !V(undefined) && !V('[]'), '不是物件 → 丟掉');
ok(V({ q: '這是一個題目', options: ['a','b','c','d'], answer: 3 }), '形狀對的就留下');

section('★ AI 出事時整份退回題庫');
{
  const w = win(() => Promise.reject(new Error('額度用完了')));
  const set = await w.QUIZ._build(w.BLOCK_LEVELS['2-1-1'], '2-1-1', '1410905');
  ok(set && set.items.length === w.QUIZ.N_TOTAL, 'AI 整個失敗 → 還是出得了五題');
  ok(set.ai === 0, '   而且標記為「這次沒有 AI 的題目」');
}
{
  const w = win(() => Promise.resolve([aiItem(1), { q: '壞掉的' }, aiItem(3)]));
  const set = await w.QUIZ._build(w.BLOCK_LEVELS['2-1-1'], '2-1-1', 'x');
  ok(set.items.length === 5 && set.ai === 0,
     '★ 三題裡有一題形狀不對 → 整份退回題庫（不要半套）');
}
{
  const w = win(() => new Promise(() => {}));      // 永遠不回
  let done = false;
  w.QUIZ._build(w.BLOCK_LEVELS['2-1-1'], '2-1-1', 'x').then(() => { done = true; });
  await new Promise(r => setTimeout(r, 30));
  ok(!done, '   AI 不回應時這裡不會自己解 —— 逾時由 askai.js 那一層負責（只有一份逾時邏輯）');
}
{
  const w = win(() => Promise.resolve([aiItem(1), aiItem(2), aiItem(3)]));
  const set = await w.QUIZ._build(w.BLOCK_LEVELS['2-1-1'], '2-1-1', 'x');
  ok(set.items.length === 5 && set.ai === 3, '順利時：題庫 2 題 ＋ AI 3 題');
  const fromAI = set.items.filter(x => /AI 出的/.test(x.q)).length;
  ok(fromAI === 3, '   混在一起，而且順序是洗過的');
}
{
  const w = win();
  const lv = { quiz: [{ q: '只有一題', options: ['a','b','c','d'], answer: 0 }] };
  const set = await w.QUIZ._build(lv, 'x', 'y');
  ok(set === null, '★ 題庫不到五題 → 這一關不辦概念檢測（湊題目會出現重複題）');
}
{
  const w = win();                                  // 沒有 ASKAI（config.js 的 KEY 留空）
  const set = await w.QUIZ._build(w.BLOCK_LEVELS['2-1-2'], '2-1-2', 'x');
  ok(set && set.items.length === 5, '★ 完全沒接 AI 也考得成 —— 這是預設狀態，不是壞掉');
}

section('門檻與封頂（shared/grading.js）');
const G = W.GRADING;
ok(G.QUIZ_PASS === 3 && G.QUIZ_FULL === 4, '五題：3 題過關、4 題才有 3 星');
ok(G.starCap({}, '2-1-1') === 3, '★ 還沒考 → 不封頂（不要因為還沒考就先罰他）');
ok(G.starCap({ '2-1-1': { score: 5 } }, '2-1-1') === 3, '五題全對 → 上限 3 星');
ok(G.starCap({ '2-1-1': { score: 4 } }, '2-1-1') === 3, '四題 → 上限 3 星');
ok(G.starCap({ '2-1-1': { score: 3 } }, '2-1-1') === 2, '★ 三題 → 上限 2 星（做出來了但概念沒懂）');
ok(G.effectiveStars({ '2-1-1': 3 }, { '2-1-1': { score: 3 } }, '2-1-1') === 2, '封頂把 3 星壓成 2');
ok(G.effectiveStars({ '2-1-1': 1 }, { '2-1-1': { score: 5 } }, '2-1-1') === 1,
   '★ 封頂只會往下，不會把星數變多 —— 考試考得好不能取代作品');
ok(G.effectiveStars({}, {}, '2-1-1') === 0, '什麼都沒有 → 0 星');
{
  const c = G.cappedStars({ '2-1-1': 3, '2-1-2': 3 }, { '2-1-1': { score: 3 } });
  ok(c['2-1-1'] === 2 && c['2-1-2'] === 3, '整批封頂只動考過的那幾關');
}
ok(/只有一個寫入者|唯一.*寫|不是第二個/.test(fs.readFileSync(path.join(root, 'shared', 'grading.js'), 'utf8')) ||
   /封頂/.test(fs.readFileSync(path.join(root, 'shared', 'grading.js'), 'utf8')),
   '★ 程式裡要寫明「為什麼用封頂，不是第二個寫星數的人」');

section('接進關卡頁');
const L = fs.readFileSync(path.join(root, '11502', 'level.html'), 'utf8');
ok(/quiz\.js/.test(L), 'level.html 載入 quiz.js');
{
  const iQuiz = L.indexOf("key:'quiz'"), iBlocks = L.indexOf("key:'blocks'");
  ok(iQuiz > 0 && iBlocks > 0 && iQuiz < iBlocks,
     '★ 概念檢測排在程式拼圖**之前** —— 反過來的話，拼對了就沒人會回頭讀');
}
ok(/QUIZ\.N_TOTAL/.test(L), '   題庫夠不夠的門檻用同一個常數，不要在頁面裡另寫 5');
ok(/onFail:[\s\S]{0,240}at = 0/.test(L),
   '★ 不到門檻 → 回到第 1 步（情境解說）。留在原地的話他只會亂猜到過為止');
ok(/window\.saveQuiz/.test(L) && /saveQuiz = async/.test(L),
   '★ saveQuiz 有呼叫也有定義（applyProgress 曾經只呼叫沒定義，整站靜靜壞掉）');
ok(/modules: \{ scratch: \{ quiz:/.test(L), '成績寫進 modules.scratch.quiz');
ok(/merge: true/.test(L), '   用 merge 寫 —— 不動 totalStars，安全規則自然過');
{
  const save = L.slice(L.indexOf('window.saveQuiz'), L.indexOf('window.saveNote'));
  ok(!/unitStars/.test(save), '★ 存成績時完全不碰 unitStars —— 星數只有批改那一個寫入者');
}
ok(/GRADING\.cappedStars/.test(L), 'applyProgress 進來就封頂');
ok(/applyProgress\(.*\n.*\n.*mods\.scratch && mods\.scratch\.quiz/.test(L) ||
   /mods\.scratch\.quiz/.test(L), '   讀進度時把 quiz 一起讀出來');
ok(/再考一次|重考/.test(L), '★ 拿 2 星上限的人要有機會回頭拿 3 星');

const S = fs.readFileSync(path.join(root, '11502', 'scratch.html'), 'utf8');
ok(/GRADING\.cappedStars/.test(S), '★ 闖關地圖用的是同一份封頂後的星數（不然兩頁會顯示不同星數）');
ok(/mods\.scratch\.quiz/.test(S), '   地圖也讀 quiz');

section('伺服器端出題（shared/aiguide.gs）');
const gs = fs.readFileSync(path.join(root, 'shared', 'aiguide.gs'), 'utf8');
ok(/p\.action === 'quiz'/.test(gs), '有 action=quiz');
ok(/function quizPool_/.test(gs) && /CacheService/.test(gs.slice(gs.indexOf('function quizPool_'))),
   '★ 出的是「一整個題池」而且會快取 —— 一人一次呼叫的話，一個班就能燒完一天的預算');
ok(/POOL_N/.test(gs) && /askAI_\(quizPrompt_/.test(gs),
   '   一次呼叫要回 POOL_N 題（不是問 N 次）');
ok(/usedToday_\(\) >= num_\('DAILY_CAP'/.test(gs.slice(gs.indexOf('function quizPool_'))),
   '★ 出題也吃 DAILY_CAP —— 它一樣在花錢');
ok(/catch \(e\) \{ return \[\]; \}/.test(gs.slice(gs.indexOf('function quizPool_'))),
   '★ AI 出事就回空的，讓前端退回題庫（不要把錯誤丟給學生）');
ok(/function parseQuiz_/.test(gs), '有 parseQuiz_');
ok(/```/.test(gs), '   會把模型硬加的 ``` 剝掉');
ok(/items\.length < 3/.test(gs), '★ 湊不出三題就整份不用 —— 不要半套');
ok(/qpool\./.test(gs.slice(gs.indexOf('function clearCache'), gs.indexOf('function clearCache') + 400)),
   '★ clearCache 要一起清題池 —— 改了教材還在出舊重點的題目，比沒出題更糟');
{
  const pr = gs.slice(gs.indexOf('function quizPrompt_'), gs.indexOf('function parseQuiz_'));
  ok(/四選一|選擇題/.test(pr), '提示詞要求選擇題（開放式問答＝AI 決定成績）');
  ok(/JSON/.test(pr), '   而且要求純 JSON');
  ok(/13～15|國中/.test(pr), '   講明是給國中生看的');
  ok(/不要.*重複/.test(pr), '   避開老師題庫已經有的題目');
}
ok(!/answer/.test(gs.slice(gs.indexOf('bank:'), gs.indexOf('bank:') + 200)),
   '★ 送給 AI 的題庫只有題目，沒有正解');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);

})();
