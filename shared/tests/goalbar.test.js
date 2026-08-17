/* 每一步最前面的「目標＋過關標準」
   跑法：node shared/tests/goalbar.test.js

   ★ 為什麼有這一份
     2026-08-17 老師卡在第 9 關：自由玩走了三次還是不能往下一步，
     因為真正的門檻是「驗收挑戰三關全過」—— 而畫面上從來沒寫過。
     學生遇到這種事不會去猜規則，只會以為系統壞了。
     ⇒ 每一步都要在**最前面**寫兩件事：
          🎯 為什麼要做這一步（目標）
          ✅ 怎樣才算過（標準，要具體到幾題／幾次／哪兩種情況）

   ⚠️⚠️ 這一份最要緊的一條：實驗室的標準**必須由模組自己給**。
      通過條件本來就是模組決定的；關卡頁再抄一份的話，
      改了一邊另一邊不會跟 —— 而學生看到的是關卡頁那一份，
      也就是**錯的那一份**。比不寫更糟。

   ⚠️ 另外釘一個我自己剛踩到的坑：STEP_GOAL 的鍵打錯字
      （我把最後一步寫成 upload，實際是 test）——
      那一步的橫幅就會**靜靜地不出現**，不會有任何錯誤。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SRC = read('11502/level.html');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
['labtest', 'sortlab', 'searchlab', 'logiclab', 'minlab'].forEach(m =>
  W.eval(read('shared/' + m + '.js')));
W.eval(read('11502/content/blocks.js'));
const LV = W.BLOCK_LEVELS;

section('★★ 每一支實驗室都要自己宣告目標與過關標準');
{
  /* ⚠️ 少一支的話，那一關的橫幅會**靜靜地不出現** ——
     而那正是最需要它的幾關（實驗室是通過條件最複雜的一步）。 */
  const MODS = { SORTLAB: W.SORTLAB, SEARCHLAB: W.SEARCHLAB,
                 LOGICLAB: W.LOGICLAB, MINLAB: W.MINLAB };
  Object.keys(MODS).forEach(n => {
    ok(typeof MODS[n].goal === 'function', '★★ ' + n + ' 有 goal()');
  });

  /* 每一種模式都要給得出東西，而且要**具體** */
  const CASES = [
    /* ⚠️ whyRe 是比對「目標」那一欄，passRe 才是「標準」。
       第一版我把「找得到／找不到」寫進 whyRe —— 那是標準，不是目標，
       所以紅了。測試自己對錯欄位，比程式錯更難發現。 */
    ['SEARCHLAB', { kind: 'search', mode: 'sequential' }, /不能跳|結束/, /找得到[\s\S]*找不到/],
    ['SEARCHLAB', { kind: 'search', mode: 'binary' }, /不能跳|結束/, /找得到[\s\S]*找不到/],
    ['SEARCHLAB', { kind: 'search', mode: 'compare' }, /差多少|差距/, /全部|四種/],
    ['SORTLAB', { kind: 'sort', mode: 'selection' }, /排好|排一次/, /三關/],
    ['SORTLAB', { kind: 'sort', mode: 'insertion' }, /排好|排一次/, /三關/],
    ['LOGICLAB', { kind: 'logic', need: 5 }, /或|不成立/, /5 隻|三種/],
    ['MINLAB', { kind: 'min', n: 5 }, /變數|沒有眼睛/, /全部都比過|一關/]
  ];
  CASES.forEach(([n, lab, whyRe, passRe]) => {
    const g = MODS[n].goal(lab);
    const tag = n + '/' + (lab.mode || lab.kind);
    ok(!!g && !!g.why && !!g.pass, tag + ' 兩個欄位都有');
    ok(whyRe.test(g.why), '★ ' + tag + ' 的目標講到重點（不是空話）');
    ok(passRe.test(g.pass), '★★ ' + tag + ' 的標準夠具體');
    /* ★ 標準裡要有**數字**或明確的清單 —— 「做完就好」不算標準 */
    ok(/\d|三關|一關|全部|兩種|各走一次/.test(g.pass),
       '★★ ' + tag + ' 的標準含具體數量（不是「做完就好」）');
  });
}

section('★★ 第 9 關的標準要真的寫出「三關全過」');
{
  /* 這就是老師卡住的那一關 */
  const g = W.SEARCHLAB.goal({ kind: 'search', mode: 'binary' });
  ok(/三關全過/.test(g.pass), '★★ 明確寫「驗收挑戰三關全過」');
  ok(/預測次數/.test(g.pass) && /零失誤/.test(g.pass) && /最壞情況/.test(g.pass),
     '★★ 而且把三關各叫什麼列出來 —— 學生才知道自己在第幾關');
  ok(/找得到/.test(g.pass) && /找不到/.test(g.pass),
     '★ 自由玩那一段的條件也寫了（兩種情況各一次）');
}

section('★★ 關卡頁：每一個步驟都要有橫幅（鍵不可以打錯）');
{
  /* ⚠️ 我自己就把最後一步寫成 upload（實際是 test）——
     鍵打錯的話那一步的橫幅靜靜地不出現，不會報任何錯。 */
  /* ⚠️ 第一步是寫成陣列字面值（const out = [{ key:'scene' … }]），
     不是 out.push —— 只抓 push 的話 scene 會被當成「不存在的步驟」。 */
  const stepsFn = SRC.slice(SRC.indexOf('function steps()'), SRC.indexOf('function stepDone'));
  const keys = [...stepsFn.matchAll(/key:'([a-z]+)'/g)].map(m => m[1]);
  ok(keys.length >= 6, '抓得到步驟清單（' + keys.join('、') + '）');
  const goalSrc = SRC.slice(SRC.indexOf('const STEP_GOAL'), SRC.indexOf('function stepGoal'));
  keys.forEach(k => {
    /* ⚠️ lab 和 play 的標準都是**模組自己給**的，不在 STEP_GOAL 裡。
       通過條件本來就是模組決定的，關卡頁抄一份就會不同步。
         lab  → SORTLAB／SEARCHLAB／LOGICLAB／MINLAB 的 goal()
         play → BIGFIND.goal()（第 5 關的 100 人體驗） */
    if (k === 'lab' || k === 'play') {
      ok(!new RegExp('^\\s*' + k + ':', 'm').test(goalSrc),
         '★★ ' + k + ' **不在** STEP_GOAL 裡 —— 它的標準要問模組要，不可以抄一份');
      return;
    }
    ok(new RegExp('^\\s*' + k + ':', 'm').test(goalSrc),
       '★★ STEP_GOAL 有「' + k + '」這一步');
  });
  /* 反過來也要檢查：STEP_GOAL 裡不可以有不存在的步驟 */
  const declared = [...goalSrc.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map(m => m[1]);
  const ghost = declared.filter(k => keys.indexOf(k) < 0);
  ok(ghost.length === 0,
     '★★ STEP_GOAL 裡沒有不存在的步驟' +
     (ghost.length ? '（多了：' + ghost.join('、') + '）' : ''));
}

section('★ 橫幅要畫在最前面，而且畫得出來');
{
  ok(SRC.indexOf('id="goalbar"') < SRC.indexOf('id="body"'),
     '★★ 橫幅的容器排在內容**前面**（要「寫在最前面」才有用）');
  ok(/function drawGoal/.test(SRC), '有畫橫幅的函式');
  ok(/drawGoal\(s\)/.test(SRC), '★ 而且 draw() 每一步都會呼叫它');
  /* ⚠️ 一定要在 draw() 的**開頭**呼叫。
     放在某個分支裡的話，走到別的分支就不畫了。 */
  const d = SRC.slice(SRC.indexOf('function draw(s) {'));
  const head = d.slice(0, 260);
  ok(/drawGoal\(s\)/.test(head),
     '★★ 呼叫寫在 draw() 開頭（塞進某個分支的話，別的步驟就不會畫）');

  ok(/🎯/.test(SRC) && /✅/.test(SRC), '★ 兩個標籤各有圖示');
  ok(/這一步在做什麼/.test(SRC), '   一行是「這一步在做什麼」');
  ok(/怎樣才算過/.test(SRC), '★★ 一行是「怎樣才算過」');
  ok(/\.goalbar\{[^}]*border:2px/.test(SRC),
     '★ 樣式夠明顯（2px 框）—— 太素的話會被當成裝飾滑過去');
  ok(/\.gb-ok\{[^}]*#dcfce7/.test(SRC),
     '★ 通過條件那一行是綠色 —— 學生卡住時會直接找綠色那條');
  ok(/max-width:520px[\s\S]{0,220}\.gb-row\{flex-direction:column/.test(SRC),
     '★ 手機上標籤自己一行（並排的話文字只剩十幾個字寬）');
}

section('★★ 模組沒給 goal() 就不畫 —— 不可以自己編一份');
{
  const fn = SRC.slice(SRC.indexOf('function stepGoal'), SRC.indexOf('function drawGoal'));
  ok(/mod\.goal/.test(fn) && /typeof mod\.goal === 'function'/.test(fn),
     '★★ lab 那一步是問模組要的');
  ok(/: null/.test(fn),
     '★★ 問不到就回 null（不畫）—— 自己編一份和模組不一致的話，比不寫更糟');
  const dg = SRC.slice(SRC.indexOf('function drawGoal'), SRC.indexOf('function draw(s)'));
  ok(/if \(!g\)/.test(dg), '   拿到 null 就清空，不會留上一步的殘影');
}

section('★ 標準要和程式**真的**判定的一致');
{
  /* ⚠️ 橫幅寫「五題答對 3 題」但程式其實要 4 題的話，
     學生會照著寫的做然後被擋 —— 那比不寫更傷。
     這裡挑幾個對得起來的硬數字驗一次。 */
  W.eval(read('shared/grading.js'));
  const goalSrc = SRC.slice(SRC.indexOf('const STEP_GOAL'), SRC.indexOf('function stepGoal'));
  const quizTxt = goalSrc.slice(goalSrc.indexOf('  quiz:'), goalSrc.indexOf('  blocks:'));
  ok(new RegExp('<b>講到 ' + W.GRADING.QUIZ_PASS + ' 題</b>').test(quizTxt),
     '★★ 概念檢測寫的門檻（' + W.GRADING.QUIZ_PASS + ' 題）和 GRADING.QUIZ_PASS 一致');
  ok(new RegExp('講到 ' + W.GRADING.QUIZ_FULL + ' 題').test(quizTxt),
     '★ 第 2 顆概念星的門檻（' + W.GRADING.QUIZ_FULL + ' 題）也對得上');

  const sceneTxt = goalSrc.slice(goalSrc.indexOf('  scene:'), goalSrc.indexOf('  combo:'));
  const holdSec = (SRC.match(/const HOLD_SEC = (\d+)/) || [])[1];
  ok(new RegExp('<b>' + holdSec + ' 秒</b>').test(sceneTxt),
     '★★ 情境那一步寫的秒數（' + holdSec + '）和 HOLD_SEC 一致');
  ok(/已經通關過就不會等/.test(sceneTxt),
     '★ 而且講明「通關過就不用等」—— 不講的話重看的人會以為系統壞了');

  /* 實驗室：minlab 的挑戰只有一關，不可以寫成三關 */
  const gm = W.MINLAB.goal({ kind: 'min', n: 5 });
  ok(/一關/.test(gm.pass) && !/三關全過/.test(gm.pass),
     '★★ 第 5 關寫的是「挑戰一關」（它本來就只有一關，寫三關會讓人找不到）');
  ok(/不是三關/.test(gm.pass), '   而且主動說明「不是三關」');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
