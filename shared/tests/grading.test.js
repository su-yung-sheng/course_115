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

section('★ 加分的合理性：先有原始分數，附件要晚於完成時間');
const T = 1700000000000;
const prog2 = {
  modules: { flowchart: { units: ['2-1-1A'] }, scratch: { unitStars: { '2-1-1A': 3 } } },
  history: [{ module: 'flowchart', unit: '2-1-1A', at: T },
            { module: 'scratch', unit: '2-1-1A', at: T + 1000 }]
};
is(G.baseFor(prog2, 'img', '2-1-1A').done, true, '流程圖排對了');
is(G.baseFor(prog2, 'img', '2-1-1A').at, T, '　拿得到完成時間（history 裡的 at）');
is(G.baseFor(prog2, 'img', '2-1-9').done, false, '沒排對的關卡 → false');
is(G.baseFor(prog2, 'vid', '2-1-1A').label, '程式 3⭐', '程式三星');
is(G.baseFor({ modules: { scratch: { unitStars: { u: 1 } } } }, 'vid', 'u').done, false,
   '只有 1⭐ 不算通過（門檻就是 GATE.PASS_STARS）');
is(G.baseFor({}, 'vid', 'u').label, '程式還沒通過', '完全沒資料也不會爆');

is(G.bonusWarning(G.baseFor(prog2, 'img', '2-1-1A'), T + 5000), '',
   '原始分數有、附件比較晚 → 沒問題');
is(/原始分數還沒拿到/.test(G.bonusWarning(G.baseFor(prog2, 'img', '2-1-9'), T)), true,
   '沒有原始分數 → 警告（圖片只有完成畫面生得出來）');
is(/時間比完成時間還早/.test(G.bonusWarning(G.baseFor(prog2, 'img', '2-1-1A'), T - 1)), true,
   '★ 附件比完成時間早 → 警告（交的可能是別關或舊檔）');
is(G.bonusWarning(G.baseFor(prog2, 'img', '2-1-1A'), 0), '',
   '沒有繳交時間就不做時間判斷 —— 不要無中生有一個警告');

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail ? 1 : 0);
