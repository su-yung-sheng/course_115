/* 程式設計那一頁的「切換」與「出口」（11501/flowchart.html ＋ shared/grader.html）
   跑法：node shared/tests/flownav.test.js

   ⛔⛔ 老師 2026-09-17 回報三件事：
      ① 「按鈕切換功能頁面不是很流暢」
      ② 「通關流程圖回上一頁面…沒有回主頁」
      ③ 「程式設計評分完成沒有回主頁」

   ★ 這一頁是單頁式的：所有畫面都靠 state.status ＋ innerHTML 重畫。
     這種寫法有三個**不會報錯、只會讓人覺得「怪怪的」**的坑，
     這份測試就是在守那三個坑。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
const GR = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');

/* ⚠️⚠️ 「這段程式**不可以**出現 X」這種檢查，一定要先把註解拿掉再比對。
   這個 repo 已經栽在同一件事上三次了 ——
   註解裡為了解釋「為什麼不可以有 to-grade」而寫下 to-grade 本身，
   於是檢查在程式明明正確的時候變紅（2026-09-17 就是這樣，一次兩條）。
   ★ 假警報比沒有警報更糟：它會教人放寬檢查，而下次真的壞掉時，
     同一個動作就會把真警報一起消音。 */
const noComments = t => String(t)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');
const FC_CODE = noComments(FC);

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('★★ ① 換畫面要捲回頂端（「不流暢」的真正原因）');
{
  /* ⚠️ innerHTML 換掉整個畫面，捲軸卻留在原處：
     學生捲到選單底部點第 8 關，看到的是新畫面的中段 —— 像壞掉一樣。 */
  ok(/function render\(\)\s*\{[\s\S]{0,400}paintView\(\)/.test(FC),
     '★★ render() 拆成「畫」＋「畫完之後」兩件事');
  ok(/_lastStatus/.test(FC) && /state\.status !== _lastStatus/.test(FC),
     '★★★ 只有**換狀態**時才捲回頂端');
  /* ⚠️ 同一個畫面內的重繪（答一題、開合教材面板）不可以捲 ——
     學生每答一題就被拉回最上面，那比不捲更煩。 */
  const blk = (FC.match(/function render\(\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok(/scrollTo/.test(blk) && /_lastStatus = state\.status/.test(blk),
     '★★ 捲動和「記住上一個狀態」寫在一起（不然會每次都捲）');
}

section('★★★ ② 認不得的畫面狀態不可以讓整頁凍結');
{
  /* ⛔⛔ 原本 render() 只有 if(status==='x') 一串，沒有 else。
     狀態一旦變成沒有畫面的值，render() 直接結束、畫面停在上一個狀態，
     **而且之後每一次 render() 都一樣什麼都不做** ——
     學生按任何按鈕都沒反應，只能重新整理，畫面上還沒有錯誤訊息。
     ⚠️ 這不是假設：#to-grade 的處理程式（status='grade'）在獨立評分
        步驟被移除之後還留著，只是剛好沒有元素帶那個 id。 */
  ok(/認不得的畫面狀態/.test(FC) && /state\.status = 'menu'/.test(FC),
     '★★★ 認不得的狀態要退回關卡列表，不可以靜靜地卡住');
  ok(/console\.warn\('\[flowchart\]/.test(FC),
     '★★ 而且要在主控台留一行 —— 不然這種事永遠查不出來');
  ok(!/status\s*=\s*'grade'/.test(FC_CODE) && !/to-grade/.test(FC_CODE),
     '★★★ 那個會把 status 設成沒有畫面的值的死碼要刪掉');
  /* ⚠️ 防遞迴：已經是 menu 還走到這裡就不能再重畫。 */
  ok(/if\(state\.status !== 'menu'\)\{[\s\S]{0,200}paintView\(\)/.test(FC),
     '★★ 退回 menu 這一步要防遞迴（已經是 menu 就停手）');
}

section('★★ ③ 每一個「做完了」的畫面都要有回主頁的出口');
{
  /* ⚠️ 左上角雖然一直有「← 返回基地」，但慶祝畫面的視線在正中央，
     而學生這時候的下一個動作往往就是「回去看我的星星」。 */
  const clear = (FC.match(/status==='clear'[\s\S]*?\n      \}/) || [''])[0];
  ok(/hub\.html/.test(clear) && /回闖關基地/.test(clear),
     '★★★ 流程圖通關畫面要有「回闖關基地」');
  const mmd = (FC.match(/status==='mermaid'[\s\S]*?\n      \}/) || [''])[0];
  ok(/hub\.html/.test(mmd),
     '★★ 已通關的流程圖頁也要有（那一頁原本只有「回關卡列表」）');
  ok(/id="back-to-hub"|href="hub\.html" title="返回闖關基地"/.test(FC),
     '★ 固定在左上角那一顆也還在（兩者不衝突）');
}

section('★★★ ④ 評分完成：外層要知道、要捲得到、要有出口');
{
  /* ⛔ 評分站在 iframe 裡呼叫 scrollIntoView 沒有用：那個 iframe 是
     scrolling="no"，而且高度要靠 postMessage 才長出來，它自己捲不動。
     症狀就是老師說的「評分完成沒有回主頁」——
     評完了，畫面完全沒有動，學生不知道好了沒、也不知道下一步去哪。 */
  ok(/graderDone/.test(GR) && /window\.parent !== window/.test(GR),
     '★★★ 評分站評完要通知外層（而且只在被嵌入時送）');
  ok(!/comments|creative_highlights/.test(
       (GR.match(/postMessage\(\{ type: 'graderDone'[\s\S]{0,200}/) || [''])[0]),
     '★★ 只送「評完了」和分數，不要把講評整包廣播出去');
  ok(/d\.type === 'graderDone'/.test(FC),
     '★★★ 外層要收這個訊息');
  ok(/e\.source !== cur\.contentWindow/.test(FC),
     '★★★ 一定要驗 e.source —— 任何網頁都可以 postMessage 過來');
  ok(/id="grade-done"[\s\S]{0,900}hub\.html/.test(FC),
     '★★★ 評分完成的出口要包含「回闖關基地」');
  /* ⛔⛔ 這一條是整份測試最容易被改壞的一條：
     那一條出口必須**預先畫好、先藏起來**。等評分完成再 render() 的話，
     整頁重繪會把 iframe 一起換掉，學生剛拿到的評分結果就消失了。 */
  ok(/id="grade-done" class="hidden/.test(FC),
     '★★★ 出口要**預先畫好、先藏起來**（等評完再 render 會把結果洗掉）');
  const done = (FC_CODE.match(/d\.type === 'graderDone'\)\s*\{[\s\S]*?\n        \}/) || [''])[0];
  ok(done.length > 0 && !/\brender\(\)/.test(done),
     '★★★ 收到 graderDone **不可以**呼叫 render() —— 會把 iframe 連同結果換掉');
  ok(/loadProgress\(state\.studentId\)/.test(done),
     '★★ 但要悄悄把進度重讀一次，星數才是新的');
  ok(/scrollIntoView/.test(done),
     '★★ 由外層負責捲到評分結果（iframe 自己捲不動）');
}

section('★ ⑤ 訊息監聽不可以愈疊愈多');
{
  /* ⚠️ wireGraderHeight() 原本在 program 畫面**每次重繪都呼叫一次**，
     而它每次都掛一個新的 window listener —— 學生答十題就疊十個。 */
  ok(/_graderWired/.test(FC) && /if\(_graderWired\) return;/.test(FC),
     '★★ 整頁只註冊一次，呼叫幾次都沒關係');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
