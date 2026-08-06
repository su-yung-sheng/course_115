/* =====================================================================
   shared/grading.js 的測試（繳交加分那一段）
   ---------------------------------------------------------------------
       node shared/tests/grading.test.js

   ★ 這裡最要緊的一條是「學生自動寫入不會蓋掉老師給的加分」。
     那種錯不會報錯、不會有徵兆，只會在某一次學生通關之後
     悄悄少掉幾顆星 —— 除非有人去對帳，否則永遠不會被發現。
   ===================================================================== */
'use strict';
const path = require('path');
global.window = {};
require(path.resolve(__dirname, '..', 'grading.js'));
const G = window.GRADING;

let pass = 0, fail = 0;
const is = (g, w, l) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l +
    (ok ? '' : `\n       期望 ${JSON.stringify(w)}\n       實得 ${JSON.stringify(g)}`));
};
const section = t => console.log('\n── ' + t + ' ──');

section('加分權重集中在一個地方');
is(typeof G.BONUS.img, 'number', '圖片的加分是可調的數字');
is(typeof G.BONUS.vid, 'number', '影片的加分是可調的數字');
is(G.moduleMax(10), { flowchart: 10 * (G.FLOWCHART_PER_UNIT + G.BONUS.img), scratch: 10 * (3 + G.BONUS.vid) },
   '★ 星數上限是從權重算出來的，不是另外寫死一份');

section('目前的權重：圖片 +1、影片 +1');
is(G.BONUS.img, 1, '圖片 +1');
is(G.BONUS.vid, 1, '影片 +1');
is(G.moduleMax(10), { flowchart: 30, scratch: 40 }, '十關的上限：流程圖 30、程式 40');

section('★ 影片給 1 分才不會蓋過「把程式寫好」');
const withVid = G.scratchStar(75) + G.BONUS.vid;      // 剛好及格但有交影片
const noVid   = G.scratchStar(95);                    // 寫得很好但沒交影片
is(withVid <= noVid, true,
   `「75 分＋交影片」(${withVid}★) 不可以贏過「95 分沒交影片」(${noVid}★)　` +
   '—— 贏過的話等於教學生：與其改程式，不如去錄影片');

section('算星數');
is(G.bonusStars(null, 'vid'), 0, '沒交 → 0 星');
is(G.bonusStars({ a: { at: 1 }, b: { at: 2 } }, 'vid'), 2 * G.BONUS.vid, '交兩關');
is(G.bonusStars({ a: { at: 1 }, b: null }, 'img'), 1 * G.BONUS.img, '取消掉的那筆（null）不算');

section('★ 學生自動寫入不會蓋掉老師給的加分');
const prog = { modules: {
  flowchart: { stars: 6, imgUnits: { u1: { at: 1 }, u2: { at: 2 } } },
  scratch:   { stars: 9, vidUnits: { u1: { at: 1 } } }
}};
is(G.starsWithBonus(prog).flowchart, 6 + 2 * G.BONUS.img, '流程圖＝自動 6 ＋ 加分');
is(G.starsWithBonus(prog).scratch,   9 + 1 * G.BONUS.vid, '程式＝自動 9 ＋ 加分');
prog.modules.flowchart.stars = 8;                     // 學生又通了一關，自動星被自己覆寫
is(G.starsWithBonus(prog).flowchart, 8 + 2 * G.BONUS.img, '★ 學生再通一關後，老師給的加分還在');
is(G.hasBonus(prog.modules.scratch.vidUnits, 'u1'), true, '查得出某一關給過沒');
is(G.hasBonus(prog.modules.scratch.vidUnits, 'u9'), false, '沒給過的回 false');

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail ? 1 : 0);
