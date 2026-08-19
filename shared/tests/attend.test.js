/* 出席與週分數：「這週有登入但沒拿星才給 60 分，缺席維持零分」
   跑法：node shared/tests/attend.test.js   （純算術＋字串）

   ★ 老師 2026-08-19：「是不是有記錄登入資料？如果有登入記錄就改為
     『這週有登入但沒拿星』才給 60 分，缺席維持零分。」

   有 —— 11501 的 hub 本來就在寫 attendance（每日首次登入），
   11502 沒有（這次補上）。判定用哪一個定義，老師選了**該班上課日**登入才算，
   比「那一週隨便哪天登入」嚴格。

   ⚠️⚠️ 這一條規則有四個地方要一致
        學生端 11501/hub、11502/hub（本週成績卡）
        教師端 11501/11502 的每週評分表**與匯出的 CSV**
     改動前它們就已經不一致了：教師端 0 星給 60 分、學生端 0 星給 0 分 ——
     同一個學生同一週，老師看到 60、學生看到 0。
     ⇒ 規則收進 shared/schedule.js 的 weekScore()，四個地方都呼叫它。

   ⚠️ CSV 那一份最容易漏：它才是真正抄進成績簿的數字。
      畫面改了、CSV 沒改的話，錯的那一份反而是會留下來的那一份。 */
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

const win = {};
new Function('window', read('shared/schedule.js'))(win);
const S = win.SCHEDULE;

section('週分數：三種情況');
{
  ok(S.weekScore(3, true, 60, 4) === 72, '有拿星：60 + 3×4 = 72');
  ok(S.weekScore(3, false, 60, 4) === 72,
     '   有拿星就不看出席（人在家做完也是他做的）');
  ok(S.weekScore(0, true, 60, 4) === 60,
     '★ 0 星但有出席 = 基本分 60（老師 2026-08-19 改的就是這一條）');
  ok(S.weekScore(0, false, 60, 4) === 0,
     '★ 0 星又缺席 = 0 分');
  ok(S.weekScore(20, true, 60, 4) === 100, '上限 100（60 + 20×4 = 140 → 100）');
}

section('課表：這一週這個班哪幾天上課');
{
  /* 週三第 2 節上 801、週五第 4 節上 802 */
  const sched = { base: { '3-2': '801', '5-4': '802' }, off: {}, move: {} };
  const anyDayThatWeek = new Date('2026-09-03T10:00:00');   // 那一週的星期四
  const d801 = S.classDatesOfWeek(sched, '801', anyDayThatWeek);
  ok(d801.length === 1 && d801[0] === '2026-09-02', '801 那一週上課日是週三 09-02（' + d801 + '）');
  ok(S.classDatesOfWeek(sched, '803', anyDayThatWeek).length === 0, '803 那一週沒課');

  /* 停課：那一天那一節被關掉 */
  const off = { base: sched.base, off: { '2026-09-02': ['3-2'] }, move: {} };
  ok(S.classDatesOfWeek(off, '801', anyDayThatWeek).length === 0,
     '★ 停課那一週就沒有上課日 —— 不然「沒上課」會被算成缺席 0 分');

  /* 調課：把週三第 2 節調到週五第 4 節 */
  const mv = { base: { '3-2': '801' }, off: {}, move: { '2026-09-02': { '3-2': '5-4' } } };
  const dm = S.classDatesOfWeek(mv, '801', anyDayThatWeek);
  ok(dm.length === 1 && dm[0] === '2026-09-04', '★ 調課跟著走：改成週五 09-04（' + dm + '）');

  /* ⚠️ 調課是「那一週的事」：上一週的調課不可以影響這一週 */
  const other = S.classDatesOfWeek(mv, '801', new Date('2026-09-10T10:00:00'));
  ok(other.length === 1 && other[0] === '2026-09-09',
     '★ 下一週不受上一週的調課影響（回到週三 09-09）');
}

section('出席：上課日有沒有登入');
{
  const sched = { base: { '3-2': '801' }, off: {}, move: {} };
  const week = new Date('2026-09-03T10:00:00');
  ok(S.attended(sched, '801', week, { '2026-09-02': 1 }) === true, '上課日有登入 → 出席');
  ok(S.attended(sched, '801', week, { '2026-09-01': 1 }) === false,
     '★ 在家登入（不是上課日）不算 —— 這是「出席」不是「有用過系統」');
  ok(S.attended(sched, '801', week, {}) === false, '沒有任何登入 → 缺席');
  ok(S.attended(null, '801', week, { '2026-09-02': 1 }) === false,
     '⚠️ 讀不到課表時一律判成沒出席（規則沒發布就是這個症狀）');
}

section('★ 四個地方要用同一支');
{
  ['11501/hub.html', '11502/hub.html', '11501/teacher.html', '11502/teacher.html']
    .forEach(f => {
      const c = code(f);
      ok(/SCHEDULE\.weekScore\(/.test(c), f + ' 呼叫 SCHEDULE.weekScore');
      ok(/<script src="..\/shared\/schedule.js"><\/script>/.test(code(f)), '   而且真的有載入 schedule.js（比對 script 標籤，不是檔名出現過就算）');
    });

  /* CSV 是真正抄進成績簿的那一份 */
  ['11501/teacher.html', '11502/teacher.html'].forEach(f => {
    const c = code(f);
    const csv = c.slice(c.indexOf('function exportWeeklyCsv'), c.indexOf('function exportWeeklyCsv') + 1200);
    ok(csv.length > 100, f + ' 找得到匯出 CSV 那一段');
    ok(/SCHEDULE\.weekScore\(st, att\[i\], base, per\)/.test(csv),
       '★★ ' + f + ' 的 CSV 也走同一支 —— 它才是登記用的數字');
  });
}

section('出席紀錄本身');
{
  ['11501/hub.html', '11502/hub.html'].forEach(f => {
    const c = code(f);
    ok(/attendance: \{ \[key\]: Date\.now\(\) \}/.test(c), f + ' 會寫出席紀錄');
    ok(/if\(att\[key\]\) return;/.test(c),
       '★ 一天只寫一次 —— 沒有這個守衛，30 人一堂課會多出幾百次寫入');
    ok(/recordAttendance\(t\)/.test(c), '   而且登入時真的有呼叫');
  });
}

section('順手抓到的：11502 hub 本來沒載入 grading.js');
{
  /* ⚠️ 第五次了：這一條第一版寫成 /shared\/grading\.js/.test(read(...))，
     而我在那一行上面加的 HTML 註解裡就寫著「本來沒有載入 grading.js」——
     於是把 <script> 拿掉之後測試照樣綠。
     ⇒ 剝掉註解、而且比對**真正的 script 標籤**，不是檔名出現過就算。 */
  const raw = code('11502/hub.html');
  ok(/<script src="\.\.\/shared\/grading\.js"><\/script>/.test(raw),
     '★★ 11502/hub.html 要載入 grading.js —— 它用了 window.GRADING 十處，' +
     '本來全部靜靜走 fallback（分母退回 36，正解是 32）');
  ok(!/function GRADING_ethicsStar/.test(code('11502/hub.html')),
     '★ 手抄的星等門檻要刪掉（那份和正本不一樣：它不管幾分都至少給 1 顆）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
