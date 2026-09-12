/* 臨時工具頁：開放關卡（11501/unlock.html）
   跑法：node shared/tests/unlockpage.test.js

   ★★ 這一頁是**刻意**做成可以隨時刪掉的（老師 2026-09-12：
      「之後沒問題可以進行關閉，不影響系統」）。
      所以這份測試在檔案不存在時**直接通過**並印一行說明 ——
      不會因為老師刪了那一頁就冒出紅字，害人以為壞了什麼。
      ⇒ 刪頁的時候只要順手刪掉 reach.test.js 的 KNOWN 那一行就好，
        這一支不用動。

   ★ 那為什麼還要測？因為這一頁會**寫學生的名冊文件**。
     寫錯欄位、忘了 merge、或哪天有人「順手」改成寫進度集合，
     後果都不是報錯，而是安靜地弄壞資料或開一個後門。
     這幾條就是在守那幾件事。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const FILE = '11501/unlock.html';

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const abs = path.join(root, FILE);
if (!fs.existsSync(abs)) {
  console.log('\n（' + FILE + ' 不在了 —— 那一頁本來就是暫時的，略過這份測試。）');
  console.log('\n通過 0／失敗 0');
  process.exit(0);
}

const html = fs.readFileSync(abs, 'utf8');
/* 只看 <script> 裡面的程式，免得把畫面文案或註解當成程式在比對。 */
const js = (html.match(/<script>\n([\s\S]*?)<\/script>/) || [, ''])[1];

section('★★ 這一頁只能碰名冊，不可以碰成績');
{
  /* ⛔⛔ 這是整份測試最重要的一條。
     解鎖旗標**一定**要存在 roster/{學號}：
       roster 的安全規則是「只有老師能寫、學生只能單筆讀」⇒ 學生偽造不了。
     存進 {學期}-progress 的話學生自己就寫得動 ——
     那等於親手開一個「自己幫自己解鎖」的後門，而且不會有任何錯誤訊息。
     （shared/grading.js 的 GATE.cleared 註解裡寫的是同一件事。） */
  ok(/COLLECTIONS\s*&&\s*window\.CONFIG\.COLLECTIONS\.ROSTER|COLLECTIONS\.ROSTER/.test(js),
     '★★★ 集合走 CONFIG.COLLECTIONS.ROSTER（不寫死集合名）');
  ok(!/-progress|progress_sem2|comp-think-app/.test(js),
     '★★★ 程式裡完全沒有碰任何 progress 集合 —— 解鎖旗標只能放在學生寫不動的地方');
  ok(/unlocks_json/.test(js), '★★ 寫的是 unlocks_json 這個欄位（和教師端主控台同一個）');
}

section('★★ 寫名冊一定要 merge');
{
  /* ⛔ 名冊文件裡還有姓名、班級、座號…。
     少了 { merge: true }，set() 會**整份覆蓋** ——
     症狀是那位學生的名字從名冊上消失，而且沒有任何錯誤訊息。 */
  /* ⚠️ 抓到分號為止，不要抓到「第一個右括號」為止 ——
     JSON.stringify(cur) 裡面就有一個右括號，那樣會把 merge 切掉，
     於是這一條會在程式明明寫對的時候變紅（我第一版就是這樣）。 */
  const sets = js.match(/\.set\([^;]{0,300};/g) || [];
  ok(sets.length > 0, '有寫入動作');
  ok(sets.every(s => /merge:\s*true/.test(s)),
     '★★★ 每一個 set() 都帶 { merge: true } —— 漏掉會把學生的姓名班級整份洗掉');
}

section('★ 教師身分要擋在前面');
{
  ok(/AUTH\.isTeacherEmail/.test(js),
     '★★ 有檢查教師 email（和安全規則的 isTeacher() 同一份判斷）');
  ok(/signOut\(\)/.test(js),
     '★★ 非教師身分要登出 —— 不可以讓學生停在「看起來登入了」的畫面');
}

section('★ 關卡清單不可以手打');
{
  /* ⚠️ 手打的對照表遲早會和實際關卡對不上（這個 repo 已經踩過好幾次）。 */
  ok(/FLOW_UNITS/.test(js), '★★ 關卡下拉是從 FLOW_UNITS 生出來的');
  ok(!/['"]2-1-1A['"]/.test(js), '★★ 程式裡沒有手打的關卡代號');
  ok(/content\/flowchart\.js/.test(html), '★ 有載入關卡清單那支檔案');
}

section('★ 畫面上要講清楚後果');
{
  /* ★ 這三句在對話裡解釋過三次，代表它們不直覺 ——
     不直覺的事就該印在畫面上，不是留在文件裡。 */
  ok(/星星完全不動|星星沒有變/.test(html),
     '★★ 有講明「星星不動」—— 不然會被當成老師幫忙加分');
  ok(/重新整理/.test(html),
     '★★ 有講明學生要重新整理才生效（那一頁登入時才讀名冊）');
  ok(/收回不是關閉關卡|後面已經打開的關卡也會跟著關回去/.test(html),
     '★★ 有講明收回的副作用（後面的關卡會跟著關回去）');
}

section('★ 語法與可刪除性');
{
  let syntaxOk = true, err = '';
  try { new Function(js); } catch (e) { syntaxOk = false; err = String(e.message || e); }
  ok(syntaxOk, '★★ 內嵌的 JS 語法正確' + (syntaxOk ? '' : '　←　' + err));

  /* ★ 「可以隨時刪掉」不是口號，是可以驗的：
     沒有任何檔案提到它，刪檔就真的不會影響任何人。
     （reach.test.js 的 KNOWN 是唯一的例外，那一行本來就要跟著刪。） */
  const refs = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) {
      if (['node_modules', '.git', '_archive', 'tests'].includes(e.name)) return;
      walk(path.join(d, e.name));
    } else if (/\.(html|js|py|json)$/.test(e.name)) {
      if (fs.readFileSync(path.join(d, e.name), 'utf8').includes('unlock.html')) {
        refs.push(path.relative(root, path.join(d, e.name)).replace(/\\/g, '/'));
      }
    }
  });
  walk(root);
  const others = refs.filter(f => f !== FILE);
  ok(others.length === 0,
     '★★★ 沒有任何檔案連到這一頁 —— 這就是「不用時直接刪檔」的前提' +
     (others.length ? '　←　' + others.join('、') : ''));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
