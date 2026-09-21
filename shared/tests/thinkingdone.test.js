/* 運算思維：拿到證書之後的行為
   跑法：node shared/tests/thinkingdone.test.js

   ★ 老師 2026-09-21：「十張證書拿到，證書上傳按鍵反灰，不能再按；
     挑戰清單的連結也只顯示通關人數，不會再跳出遊戲畫面
     （這個在有證書後就可以關閉）」。
   ⇒ 兩條規則，範圍不一樣：
     · 每一關：拿到那一關的證書 ⇒ 點它只顯示本班通關人數，不開遊戲視窗
     · 全部十關：拿滿 ⇒ 「證書製作」反灰 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const SRC = fs.readFileSync(path.join(ROOT, '11501', 'thinking.html'), 'utf8');
/* ⚠️⚠️ 「程式裡不可以出現 X」的檢查一定要先拿掉註解。
   這個 repo 已經栽在同一件事上五次：註解為了解釋「原本哪裡錯」而引用了
   那段錯的寫法，檢查比對到註解，在程式正確時變紅。
   本檔的 isDone 註解就引用了「completedChallenges.includes() 會判不出來」。 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '');

section('★★★ 判斷邏輯（抽出來真的跑一次）');
const logic = (CODE.match(/const doneSet = [\s\S]*?const allDone = [^\n]*\n/) || [''])[0];
const opener = (CODE.match(/const handleOpenChallenge = \(challenge\) => \{[\s\S]*?\n            \};/) || [''])[0];
ok(logic.length > 0, '找得到 doneSet／isDone／allDone');
ok(opener.length > 0, '找得到 handleOpenChallenge');

const CH = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: 'T' + (i + 1), url: 'u' + (i + 1) }));
function run(completed) {
  const opened = [], selected = [];
  const ctx = {
    completedChallenges: completed, challenges: CH,
    setSelectedChallenge: c => selected.push(c.id),
    window: { open: (u) => opened.push(u), screen: { width: 1920, height: 1080 } },
  };
  vm.createContext(ctx);
  vm.runInContext(logic + opener + '\nthis.isDone = isDone; this.allDone = allDone; this.h = handleOpenChallenge;', ctx);
  return { ctx, opened, selected };
}

{
  const r = run([1, 2, 3]);
  r.ctx.h(CH[1]);                       // 第 2 關：已通關
  ok(r.opened.length === 0,
     '★★★ 已拿到證書的關卡，點了**不開**遊戲視窗');
  ok(r.selected[0] === 2,
     '★★★ 但仍然要選取它 —— 右邊才會顯示本班通關人數（那個數字靠 selectedChallenge 觸發）');
  r.ctx.h(CH[4]);                       // 第 5 關：還沒通關
  ok(r.opened.length === 1 && r.opened[0] === 'u5',
     '★★★ 還沒通關的關卡照常開遊戲視窗');
  ok(r.ctx.allDone === false, '三關而已 ⇒ 不可以鎖上傳');
}
{
  /* ⚠️ completed 存在 Firestore，歷史資料的編號可能是字串 */
  const r = run(['1', '2', 3]);
  ok(r.ctx.isDone(1) && r.ctx.isDone(2) && r.ctx.isDone('3'),
     '★★★ 編號是字串或數字都要認得 —— 型別對不上會變成「打勾了卻還跳遊戲」');
  r.ctx.h(CH[0]);
  ok(r.opened.length === 0, '★★ 存成字串 "1" 的第 1 關，點了也不開視窗');
}
{
  /* ⚠️ 十關全拿要用 every，不可以用 length >= 10 */
  const r = run([1, 2, 3, 4, 5, 6, 7, 8, 9, 9]);
  ok(r.ctx.allDone === false,
     '★★★ 九關＋一筆重複（長度剛好 10）⇒ **不可以**鎖上傳 —— '
     + '用 length >= 10 判斷的話，這個學生第 10 關就交不出來了');
}
{
  const r = run(['1', 2, 3, 4, 5, 6, 7, 8, 9, '10']);
  ok(r.ctx.allDone === true, '★★★ 十關都有（型別混著）⇒ 鎖上傳');
}
{
  const r = run([]);
  ok(r.ctx.allDone === false, '一關都沒有 ⇒ 不鎖');
  const r2 = run(undefined);
  ok(r2.ctx.allDone === false, '★ completedChallenges 還沒載入（undefined）也不可以爆');
}

section('★★ 畫面上四個地方用的是同一個判斷');
{
  /* ⚠️ 打勾、開不開視窗、右邊顯示什麼、上傳鈕灰不灰 —— 各寫各的話，
     只要有一處型別沒對齊，畫面就會自相矛盾。 */
  ok(!/completedChallenges\.includes\(challenge\.id\)/.test(CODE),
     '★★★ 清單的打勾不可以再用 completedChallenges.includes（型別不一致會和 isDone 判得不一樣）');
  ok(/isDone\(challenge\.id\) && \(\s*<i className=\{`fa-solid fa-circle-check/.test(CODE),
     '★★ 清單的打勾改用 isDone');
  ok(/isDone\(challenge\.id\)\s*\?\s*<i className=\{`fa-solid fa-users/.test(CODE),
     '★★ 已通關的關卡，右側圖示不再是「播放」 —— 畫著播放鍵卻不播，學生會以為壞掉一直按');
}

section('★★ 右邊面板：已通關只顯示人數');
{
  const i = CODE.indexOf('selectedChallenge && isDone(selectedChallenge.id) ?');
  ok(i > 0, '★★ 右邊有「已通關」專用的分支');
  const branch = i > 0 ? CODE.slice(i, CODE.indexOf(') : selectedChallenge ? (', i)) : '';
  ok(/本班已通關/.test(branch) && /classPassCount/.test(branch),
     '★★★ 已通關的分支要顯示本班通關人數（這是老師要的那個畫面）');
  ok(!/handleOpenChallenge/.test(branch) && !/重新開啟視窗/.test(branch),
     '★★★ 已通關的分支**不可以**有「點此重新開啟視窗」—— 不然從右邊還是開得出遊戲');
  ok(!/正在執行/.test(branch),
     '★ 已通關的分支不要寫「正在執行」—— 根本沒開');
}

section('★★ 十關全拿：證書製作反灰');
{
  const btn = (CODE.match(/<button\s+onClick=\{\(\) => \{ if \(!allDone\) setShowCertModal\(true\); \}\}[\s\S]*?<\/button>/) || [''])[0];
  ok(btn.length > 0, '找得到證書製作按鈕');
  ok(/disabled=\{allDone\}/.test(btn),
     '★★★ 要用 disabled —— 只改顏色的話還是按得下去');
  ok(/if \(!allDone\) setShowCertModal/.test(btn),
     '★★ onClick 裡也要擋一次（disabled 被瀏覽器外掛或開發者工具拿掉時的保險）');
  ok(/cursor-not-allowed/.test(btn) && /bg-slate-300/.test(btn), '★ 反灰的樣式');
  ok(/十關全部通關/.test(btn),
     '★★ 反灰時要換字 —— 只變灰不說為什麼，學生會以為壞掉了');
}

section('★ 語法（JSX 要編譯得過）');
{
  let babel = null;
  try { babel = require('@babel/standalone'); } catch (e) { babel = null; }
  if (!babel) {
    console.log('  ⏭️  跳過：沒有 @babel/standalone（npm i --no-save @babel/standalone 就能測）');
  } else {
    const m = SRC.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
    let err = '';
    try { babel.transform(m[1], { presets: ['react'] }); } catch (e) { err = e.message.split('\n')[0]; }
    ok(!err, '★★★ thinking.html 的 JSX 編譯得過' + (err ? '　←　' + err : ''));
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
