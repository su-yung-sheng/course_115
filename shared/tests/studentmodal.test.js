/* 教師端「點學生名字」的那個視窗：三個分頁
   跑法：node shared/tests/studentmodal.test.js   （純字串處理）

   ★ 2026-08-19 老師問「進度圖表目前的功能是什麼？跟上課日設定、每週評分
     有關連嗎？」，盤點之後發現下學期少了一整個分頁，順手補齊。

   三個分頁各自吃什麼（這一支就是在盯這件事）：

     📋 任務評分   modules.{科目}.stars ＋ 加分（唯讀顯示）
     📈 進度圖表   history（每天新增星數累加）—— **不看課表、不看出席**
     🗓️ 出席紀錄   課表 ＋ attendance ＋ wky_start（週次起算點）

   ⚠️ 圖表和每週評分連在 history.stars 這個欄位上：
      同一筆資料，圖表按日累加、每週評分按週加總。
      所以那個欄位的語意錯了，兩邊會一起錯（見 weekly.test.js）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
/* 剝註解。⚠️ `/*` 不可以無條件當開頭（accept="image/*" 會吃掉整段程式）。 */
const code = f => read(f)
  .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const FILES = ['11501/teacher.html', '11502/teacher.html'];

section('★ 兩學期都要有三個分頁');
FILES.forEach(f => {
  const c = code(f);
  ok(/id="tab-tasks"/.test(c) && /id="tab-chart"/.test(c) && /id="tab-attend"/.test(c),
     f + ' 有 任務評分／進度圖表／出席紀錄 三個分頁');
  ok(/id="modal-attend-container"/.test(c), '   出席紀錄有自己的容器');
  ok(/function renderStudentAttendance/.test(c), '   而且真的畫得出來');

  /* ⚠️ 分頁切換要用「表格」寫，不要 if(tasks){…}else{…}。
     那個 else 會把「不是 tasks」全部當成圖表 ——
     下學期本來就是這樣寫的，加第三個分頁時剛好會踩到。 */
  ok(/const panes = \{ tasks:'modal-tasks-container', chart:'modal-chart-container', attend:'modal-attend-container' \}/.test(c),
     '★ ' + f + ' 的分頁切換是表格驅動（不是 if/else 兩分頁）');
  ok(/if \(tabName === 'attend'\) renderStudentAttendance\(\);/.test(c),
     '   切到出席分頁時才去算（不必每次開視窗都連線）');

  /* 換學生的時候三個分頁都要跟著換 */
  ok(/containerAttend && !containerAttend\.classList\.contains\('hidden'\)\) renderStudentAttendance\(\)/.test(c),
     '★★ ' + f + ' 按「下一位」時，開著的出席分頁要重畫 —— ' +
     '不然名字換了、底下還是前一位的表');
});

section('資料來源：出席紀錄要有 attendance');
FILES.forEach(f => {
  const c = code(f);
  ok(/attMap\[d\.id\] = pd\.attendance \|\| \{\}/.test(c),
     f + ' 載入名冊時把 attendance 一起帶出來');
  ok(/student\.attendance = attMap\[student\.id\] \|\| \{\}/.test(c),
     '   掛到學生身上（沒帶的話那一頁永遠是「全部未登入」）');
  ok(/classDatesOfWeek\(cls, ws\)/.test(c), '   應到日期由課表算（shared/schedule.js）');
});

section('★★ 學期開始日不可以寫死');
{
  /* ⚠️ 2026-08-19 抓到：11502 的每週評分預設值寫死 '2026-08-31'，
     那是**上學期**的第 1 週，而下學期的 TERM_START 是 2027-02-08。
     差五個多月 → 下學期的紀錄全落在第 23 週之後，
     而週數上限預設 10 → 整張表算出來是全 0 星，看起來像「沒有資料」。
     ⚠️ 而且出席分頁讀同一個 wky_start，會一起錯。 */
  FILES.forEach(f => {
    const c = code(f);
    ok(!/wkyStart'\)\.value = '20\d\d-\d\d-\d\d'/.test(c),
       f + ' 的預設起始日不是寫死的日期');
    ok(/document\.getElementById\('wkyStart'\)\.value = window\.CONFIG\.TERM_START/.test(c),
       '★ 用 config.js 的 TERM_START');
    ok(!/<input id="wkyStart" type="date" value="20/.test(c),
       '   input 的 value 也不可以寫死（JS 填不進去就會沿用它）');
  });
  /* 兩學期的 TERM_START 本來就該不一樣 —— 一樣的話就是複製忘了改 */
  const t1 = read('11501/config.js').match(/TERM_START: '([\d-]+)'/)[1];
  const t2 = read('11502/config.js').match(/TERM_START: '([\d-]+)'/)[1];
  ok(t1 !== t2, '兩學期的 TERM_START 不同（' + t1 + ' / ' + t2 + '）');
}

section('進度圖表：只吃 history');
FILES.forEach(f => {
  const c = code(f);
  const fn = c.slice(c.indexOf('function renderStudentChart'),
                     c.indexOf('function renderStudentChart') + 1800);
  ok(fn.length > 200, f + ' 找得到 renderStudentChart');
  ok(/byDay\[key\] = \(byDay\[key\] \|\| 0\) \+ \(Number\(h\.stars\) \|\| 0\)/.test(fn),
     '★ 用 history 的 stars 按日加總 —— 它是「當天新增幾顆」（見 weekly.test.js）');
  ok(!/attendance|classDatesOfWeek|wky_start/.test(fn),
     '★ 圖表**不看**課表與出席 —— 橫軸是「有活動的日期」，不是週次');
  ok(/suggestedMax: sumSubjMax\(subjects\)/.test(fn),
     '   縱軸用真正的分母（本來寫 科目數×3，和實際上限差十倍）');
});

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
