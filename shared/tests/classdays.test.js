/* 班級上課日查詢（教師端「🗓️ 上課日設定」→「📋 班級上課日查詢」）
   跑法：node shared/tests/classdays.test.js

   ★ 老師 2026-10-21：「可以查詢某個班級到目前為止的上課日嗎？」
     規則放在 shared/schedule.js 的 classLessons，判斷每一格是誰的課一律走 cellInfo ——
     和出席紀錄、每週評分同一份，不然會出現「查詢說有上課、評分說停課」。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = {};
require(path.join(ROOT, 'shared', 'schedule.js'));
const S = global.window.SCHEDULE;

// 801：週三第 2 節、週五第 5 節；802：週一第 1 節
const sched = {
  base: { '3-2': '801', '5-5': '801', '1-1': '802' },
  off: { '2026-09-02': ['3-2'],                 // 第 1 週週三 801 停課
         '2026-09-14': ['1-1'] },               // 802 停課（不影響 801）
  move: { '2026-09-11': { '5-5': '4-3' } }      // 第 2 週把 801 週五第 5 節調到週四第 3 節
};
const from = new Date('2026-08-31T00:00:00'), to = new Date('2026-09-18T00:00:00');

section('① 停課、調課都照課表規則');
const r = S.classLessons(sched, '801', from, to);
const lines = r.map(x => x.date + ' ' + x.slot + (x.off ? ' 停' : '') + (x.movedIn ? ' 調' : ''));
ok(JSON.stringify(lines) === JSON.stringify([
  '2026-09-02 3-2 停', '2026-09-04 5-5',
  '2026-09-09 3-2', '2026-09-10 4-3 調',
  '2026-09-16 3-2', '2026-09-18 5-5']),
  '★★★ 三週 6 節：停課的照樣列出（標停）、調走的那格不重複列、調到的那格標「調」　←　' + lines.join('｜'));
ok(r.filter(x => !x.off).length === 5, '　實際上課 5 節');
ok(!r.some(x => x.slot === '1-1'), '★ 別班的課、別班的停課都不會混進來');

section('② 和每週評分、出席紀錄用的是同一份規則');
for (const day of ['2026-09-01', '2026-09-08', '2026-09-15']) {
  const want = S.classDatesOfWeek(sched, '801', new Date(day + 'T00:00:00'));
  const mon = S.mondayOf(new Date(day + 'T00:00:00')), sun = new Date(mon.getTime() + 6 * 86400000);
  const got = [...new Set(S.classLessons(sched, '801', mon, sun).filter(x => !x.off).map(x => x.date))];
  ok(JSON.stringify(got) === JSON.stringify(want),
     '★★ ' + day + ' 那週：查詢列的上課日 ＝ 每週評分算的上課日　←　' + got.join(',') + ' vs ' + want.join(','));
}

section('③ 邊界');
ok(S.classLessons(sched, '801', new Date('2026-09-03T00:00:00'), new Date('2026-09-04T00:00:00'))
    .map(x => x.date).join() === '2026-09-04', '★ 起訖日期有效（只算區間內，含兩端）');
ok(S.classLessons(sched, '', from, to).length === 0, '沒選班級 ⇒ 空');
ok(S.classLessons(sched, '801', to, from).length === 0, '起點在終點之後 ⇒ 空，不會無窮迴圈');
ok(S.classLessons({}, '801', from, to).length === 0, '還沒設課表 ⇒ 空');

section('④ 兩學期的教師端都有這個查詢');
for (const term of ['11501', '11502']) {
  const H = fs.readFileSync(path.join(ROOT, term, 'teacher.html'), 'utf8');
  ok(/id="scDaysCls"/.test(H) && /onclick="scListDays\(\)"/.test(H) && /window\.scListDays = scListDays/.test(H),
     '★★ ' + term + ' 上課日設定裡有「📋 班級上課日查詢」，按鈕叫得到函式');
  ok(/SCHEDULE\.classLessons\(_sched, cls/.test(H), '★★ ' + term + ' 呼叫 shared/schedule.js（不自己另寫一份規則）');
  ok(/scFillDaysCls\(\);\s*\n\s*await loadSchedule\(\);/.test(H), '★ ' + term + ' 打開設定時填好班級下拉');
  ok(/localStorage\.getItem\('wky_start'\)/.test(H.slice(H.indexOf('function scListDays'))),
     '★ ' + term + ' 起點和出席紀錄、每週評分一致（每週評分改過的學期開始日優先）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
