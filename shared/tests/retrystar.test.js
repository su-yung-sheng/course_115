/* 二星要看得到「還能挑戰三星」（shared/grading.js ＋ grader.html ＋ flowchart.html）
   跑法：node shared/tests/retrystar.test.js

   ⛔⛔ 老師 2026-09-17：「程式設計沒有重新評分的機會？二星應該要有機會挑戰三星」

   ★ 查下來：機會**一直都在** ——
       · 結果卡本來就有「🔄 修改後再測一次」
       · reportScratch 用 Math.max 取最佳，重測永遠不會把星數變低
     壞的是**畫面從來沒講過這件事**：
       · 拿到 2 星看到的是「⭐ 已記錄 2 星！」，讀起來就是「我好了」
       · 旁邊還寫著「就代表這一關完成了，不必再按任何按鈕」
       · 而我 2026-09-16 加的那條「✅ 評分完成」列，更是直接給他兩個離開的按鈕
     ⇒ 這一份測試守的是「話有沒有講對」，不是「功能在不在」。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const GR = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const FC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
global.window = {};
require(path.join(ROOT, 'shared', 'grading.js'));
const G = global.window.GRADING;

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const is = (g, w, l) => ok(JSON.stringify(g) === JSON.stringify(w),
  l + (JSON.stringify(g) === JSON.stringify(w) ? '' : `　期望 ${JSON.stringify(w)} 實得 ${JSON.stringify(g)}`));
const section = t => console.log('\n── ' + t + ' ──');

section('★★ 重測不可以讓星數變低（這是「敢再試一次」的前提）');
{
  /* ⛔ 如果重測會覆蓋成新分數，那「挑戰三星」就是在賭博 ——
     學生 82 分拿 2 星，再試一次考 70 分就掉到 0 星。
     那樣的話最理性的作法是**不要再試**，鼓勵他反而是害他。 */
  ok(/unitStars\[unit\] = Math\.max\(prev, star\)/.test(GR),
     '★★★ 星數取最佳（Math.max）—— 重測永遠不會變低');
  ok(/unitScores\[unit\] = Math\.max\(prevScore, nowScore\)/.test(GR),
     '★★ 分數也取最佳');
  ok(/stars: Math\.max\(0, star - prev\)/.test(GR),
     '★ 每週統計只記「這次新增的星」，重測沒進步就是 0（不會灌水）');
}

section('★★★ 還差幾分，要算得出來');
{
  is(G.scratchNextStar(82), { star: 2, next: 3, need: 8 }, '82 分 → 2 星，再 8 分有 3 星');
  is(G.scratchNextStar(89), { star: 2, next: 3, need: 1 }, '89 分 → 只差 1 分');
  is(G.scratchNextStar(60), { star: 0, next: 2, need: 15 }, '60 分 → 還沒通關，再 15 分有 2 星');
  is(G.scratchNextStar(90).next, null, '90 分 → 已經滿星，沒有下一顆');
  is(G.scratchNextStar(100).next, null, '100 分同理');
  /* ⚠️ 門檻只有 scratchStar 一份。抄第二份遲早會走鐘，
     而走鐘的那一份不會有人發現（這個 repo 已經吃過這個虧）。 */
  const fn = (fs.readFileSync(path.join(ROOT, 'shared', 'grading.js'), 'utf8')
    .match(/scratchNextStar: function[\s\S]*?\n  \},/) || [''])[0];
  ok(!/\b90\b/.test(fn) && !/\b75\b/.test(fn),
     '★★★ scratchNextStar **不可以**自己寫死 90／75 —— 要由 scratchStar 推出來');
}

section('★★★ 二星時畫面要主動說「還能挑戰三星」');
{
  ok(/id="nextStep"/.test(GR) && /function paintNextStep/.test(GR),
     '★★ 結果卡有「🎯 下一步」這一塊，而且評完會去填它');
  ok(/scratchNextStar/.test(GR),
     '★★★ 用的是共用的那支算法，不是在畫面裡另外算一次');
  const p = (GR.match(/function paintNextStep[\s\S]*?\n\}/) || [''])[0];
  ok(/Math\.max\(Number\(rep\.prevScore\)/.test(p),
     '★★★ 要用**目前最好的成績**算 —— 上次 88、這次 60 的話，'
     + '該說的是「再 2 分」，不是「再 30 分」');
  ok(/只會變好不會變差/.test(p),
     '★★★ 一定要講明「重測不會變低」—— 不講的話再試一次對學生就是賭博');
  ok(/showScore/.test(p),
     '★★ 老師把「顯示分數」關掉時就不要講分數（那是老師的設定，不可以繞過）');
  ok(/btn\.textContent *= *'🔄 改完再傳一次，挑戰 '/.test(p),
     '★★ 按鈕文字要講出「挑戰幾星」，不只是「再測一次」');
}

section('★★★ 那條「評分完成」列不可以把想再試的人推出去');
{
  /* ⛔⛔ 這一條列是 2026-09-16 我自己加的，原本一律寫「✅ 評分完成」
     ＋兩個離開的按鈕。對剛拿到 2 星、正想再試的學生來說，
     那等於在說「你好了，可以走了」。 */
  ok(/id="grade-done-msg"/.test(FC),
     '★★ 那一列的文字要可以換（不是寫死的）');
  const h = (FC.match(/d\.type === 'graderDone'\)[\s\S]*?\n        \}/) || [''])[0];
  ok(/d\.star/.test(h),
     '★★★ 要看**星數**決定講什麼，不是一律「評分完成」');
  ok(/還可以挑戰 3 星/.test(h),
     '★★★ 兩星要先講「還有 3 星可以拿」，不是先給離開的按鈕');
  ok(/還沒通關/.test(h),
     '★★ 0 星要講清楚還沒通關，不可以顯示成「完成」');
  ok(/star: \(sc === null \|\| !window\.GRADING\) \? null : window\.GRADING\.scratchStar\(sc\)/.test(GR),
     '★★ 評分站要把星數一起送出去（外層才判斷得了）');
}

section('★★ 靜態說明也不可以叫人停手');
{
  ok(!/就代表這一關完成了，不必再按任何按鈕/.test(FC),
     '★★★ 「這一關完成了，不必再按任何按鈕」要拿掉 —— '
     + '那句話對 2 星的學生就是叫他別再試了');
  ok(/可以一直重傳|還可以再改、再傳/.test(FC),
     '★★ 要改成講明可以重傳');
  ok(/星數.{0,8}最高|取最高|不會變低/.test(FC),
     '★★ 而且要講明星數取最高、不會變低');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
