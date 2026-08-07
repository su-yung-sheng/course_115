/* 推導活動的判定邏輯測試
   跑法：node shared/tests/derive.test.js

   這裡測的都是「會不會誤判」——
   誤判的代價是學生填對了被說錯（會放棄）、或填錯了被說對（帶著誤解走）。 */
'use strict';
const fs = require('fs');
const path = require('path');

const g = { window: {} };
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'derive.js'), 'utf8'))(g.window);
const D = g.window.DERIVE;

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + label); }
}
function eq(a, b, label) { ok(a === b, label + '（得到 ' + a + '，應該是 ' + b + '）'); }

/* ── 閉合判定 ───────────────────────────────────── */
ok(D._closes(90, 4),   '正方形轉 90 度會閉合');
ok(D._closes(60, 6),   '正六邊形轉 60 度會閉合');
ok(D._closes(36, 10),  '正十邊形轉 36 度會閉合');
ok(!D._closes(90, 6),  '六條邊轉 90 度不閉合');
ok(!D._closes(60, 4),  '四條邊轉 60 度不閉合');
ok(!D._closes(0, 6),   '轉 0 度不算閉合（直線）');
ok(!D._closes(NaN, 6), '沒填數字不算閉合');

/* ★ 最重要的一條：轉兩圈也會回到起點，但那是錯的。
   六條邊轉 120 度＝把三角形描兩遍，圖形看起來是閉合的。
   只看「有沒有回到起點」會放它過關，學生就帶著「轉幾圈都可以」離開。 */
ok(!D._closes(120, 6), '★ 六條邊轉 120 度（三角形描兩遍）不能算過');
eq(D._laps(120, 6), 2, '   而且要講得出它轉了兩圈');
ok(/兩圈|2 圈/.test(D._checkAngle(120, 6).msg), '   訊息要點出「轉了兩圈」');

/* ── 回饋訊息講的是圖形，不是對錯 ─────────────────── */
const openMsg = D._checkAngle(50, 6).msg;
ok(/開口|沒有閉合/.test(openMsg), '沒閉合要說「留了開口」');
ok(/300/.test(openMsg), '   並且算給學生看總共轉了幾度');
ok(/不夠/.test(openMsg), '   6×50=300，要說「不夠一圈」');
ok(/超過/.test(D._checkAngle(80, 6).msg), '6×80=480，要說「超過一圈」');

/* ── 算式（一般化那一步）───────────────────────── */
eq(D._turnFor({ left: 360, right: 'N' }, 6), 60, '360 ÷ N 代入 6');
eq(D._turnFor({ left: 360, right: 'n' }, 4), 90, '小寫 n 也要認得');
eq(D._turnFor({ left: 360, right: 6 }, 10), 60, '右邊寫死 6：代入 10 邊還是算 360÷6＝60（所以畫不出十邊形）');
ok(isNaN(D._turnFor({ left: 360, right: 0 }, 6)), '除以 0 不能炸掉');

ok(D._verdict({ left: 360, right: 'N' }).ok, '360 ÷ N 三種邊數都閉合');
ok(!D._verdict({ left: 180, right: 'N' }).ok, '180 ÷ N 不對');
ok(!D._verdict({ left: 360, right: 'N' }, [5, 7]).ok === false, '換別的邊數來測也要過');

/* ★ 這一關要抓的誤解：右邊寫死一個數字。
   寫死 6 的話，正六邊形那一次會閉合 —— 只測一種邊數就會放它過。
   所以一定要代好幾個數字。 */
const fixed = D._verdict({ left: 360, right: 6 }, [4, 6, 10]);
ok(!fixed.ok, '★ 右邊寫死 6 不能算過（雖然六邊形那次會閉合）');
eq(fixed.bad, 4, '   要指出是代 4 邊形時垮掉');
ok(/寫死|跟著變/.test(fixed.msg), '   訊息要講「不能寫死，要放會跟著變的 N」');
ok(D._closes(D._turnFor({ left: 360, right: 6 }, 6), 6), '   （確認：只測六邊形的話它真的會過）');

ok(/左邊/.test(D._verdict({ left: '', right: 'N' }).msg), '左邊沒填要講左邊');
ok(/右邊/.test(D._verdict({ left: 360, right: '' }).msg), '右邊沒填要講右邊');

/* ── 畫出來的路徑 ───────────────────────────────── */
const sq = D._polyPath(4, 90, 60);
eq(sq.length, 5, '正方形有 4 條邊、5 個點（含起點）');
ok(Math.hypot(sq[4][0] - sq[0][0], sq[4][1] - sq[0][1]) < 0.001, '正方形最後回到起點');
const bad = D._polyPath(6, 90, 60);
ok(Math.hypot(bad[6][0] - bad[0][0], bad[6][1] - bad[0][1]) > 1, '六邊轉 90 度不會回到起點');

/* 右轉是順時針 —— 和 Scratch 一致。第一步朝右，右轉 90 度之後要往下。 */
const cw = D._polyPath(4, 90, 10);
ok(cw[1][0] > 0.001 && Math.abs(cw[1][1]) < 0.001, '第一條邊往右走');
ok(cw[2][1] < -0.001, '右轉 90 度之後往下走（順時針，和 Scratch 一樣）');

/* ── 題目資料本身 ───────────────────────────────── */
const w2 = {};
new Function('window', fs.readFileSync(
  path.join(__dirname, '..', '..', '11502', 'content', 'blocks.js'), 'utf8'))(w2);
const dv = w2.BLOCK_LEVELS['2-1-3'].derive;
ok(!!dv, '2-1-3 有推導活動');
eq(dv.steps.length, 4, '四個步驟');
eq(dv.steps[0].answer, 360, '第一步問的是 360 度');
ok(dv.steps.filter(s => s.kind === 'draw').length === 2, '有兩步是「填了真的畫」');
ok(dv.steps[3].kind === 'formula', '最後一步是寫出算式');
ok(dv.steps[3].tests.length >= 3, '算式要代入至少三種邊數才驗得出寫死的情況');

/* 題目裡不可以先把答案講出來 —— 第 2 步問「每次轉幾度」，
   題目文字若出現 60 就不用想了。 */
/* ⚠️ 不能直接搜「60」—— 題目裡的「360 度」也含有 60，會誤判。
   先把 360 拿掉再找。（我第一次就是這樣自己絆倒自己。） */
const noQ = t => String(t).replace(/360/g, '');
ok(!/60/.test(noQ(dv.steps[1].q)), '第 2 步的題目沒有洩漏答案 60');
ok(!/36(?!0)/.test(noQ(dv.steps[2].q)), '第 3 步的題目沒有洩漏答案 36');
ok(!/360\s*[÷\/]\s*N/.test(dv.steps[3].q), '第 4 步的題目沒有直接寫出 360 ÷ N');
ok(/360/.test(dv.done), '做完之後才把結論講明白');


/* ── 問題拆解（課本的「問題分析」）───────────────── */
const L = w2.BLOCK_LEVELS;
eq(L['2-1-1'].analysis.qs.length, 5, '第 1 關照課本拆成五問');
eq(L['2-1-2'].analysis.qs.length, 8, '第 2 關照課本拆成八問');
ok(L['2-1-1'].analysis.qs.every(x => x.q && x.hint), '每一問都有問句和提示');

/* ★ 第 2 關的重點全在第 6 問：先做出沒有參數的副程式，
   發現畫不出四種大小，才知道參數是來解決什麼的。
   少了這個轉折，學生只學會照抄「定義 畫正方形 (邊長)」。 */
const q6 = L['2-1-2'].analysis.qs[5];
ok(/卡住|畫得出/.test(q6.q), '★ 第 6 問是「沒有參數行不行」的轉折');
ok(/畫不出來/.test(q6.hint), '   提示直接說畫不出來，不繞過去');
ok(/參數/.test(q6.hint), '   並且點出參數是來解決這件事的');

/* 提示不能把整份答案抄出來 —— 那就變成照著拼，拆解就白做了 */
L['2-1-1'].analysis.qs.concat(L['2-1-2'].analysis.qs).forEach((x, i) => {
  ok(String(x.hint).length < 260, '第 ' + (i + 1) + ' 問的提示不要長到變成答案');
});

/* 用詞：說明裡只能出現課本的「副程式」和 Scratch 的「函式積木」 */
const allText = JSON.stringify([L['2-1-1'], L['2-1-2'], L['2-1-3']]);
ok(!/自訂積木/.test(allText), '沒有第三種講法「自訂積木」');
ok(/副程式/.test(JSON.stringify(L['2-1-1'].analysis)), '第 1 關的拆解用課本的「副程式」');

/* ── 追蹤每一輪（選擇排序）───────────────────────
   排序的難處不是步驟順序（課本寫得清清楚楚），
   是「跑完一輪之後資料變成什麼樣」。這一段就是為了那件事。 */
eq(JSON.stringify(D._minAt([5, 2, 8, 1, 9])), '[3]', '找得出最小值的位置');
eq(JSON.stringify(D._minAt([3, 1, 1, 4])), '[1,2]',
   '★ 並列最小值兩個都算對 —— 只認第一個的話，選另一個的學生會被說錯');
ok(D._pickMin([5, 2, 8], 1).ok, '點 2 → 對');
ok(!D._pickMin([5, 2, 8], 0).ok, '點 5 → 錯');
ok(/還有更小的/.test(D._pickMin([5, 2, 8], 0).msg), '★ 錯的時候說「還有更小的」');
ok(!/第 \d|位置|索引/.test(D._pickMin([5, 2, 8], 0).msg),
   '★ 但不洩漏正確位置 —— 直接給的話，學生下一輪照樣不會找');
ok(/152/.test(D._pickMin([{ v: 152, t: '152' }, { v: 141, t: '141' }], 0).msg),
   '身高那種帶標籤的資料，訊息要講得出他點的是哪一個');

/* 第 5 關：排序的觀念導入，沒有積木拼圖 */
const l5 = L['2-3-1'];
ok(!!l5, '第 5 關（排隊比高矮）有資料');
ok(!l5.goal, '★ 這一關沒有積木拼圖 —— 課本用的是圖解，不是程式');
ok(!l5.palette, '   也沒有調色盤');
eq(l5.derive.steps[0].kind, 'sort', '它的活動是「追蹤每一輪」');
eq(l5.derive.steps[0].items.length, 5, '五個人');
const hs = l5.derive.steps[0].items.map(x => x.v);
ok(new Set(hs).size === hs.length, '五個身高不重複（並列會讓「最矮的是誰」有兩個答案，導入不該一開始就碰）');
ok(hs.join() !== hs.slice().sort((a, b) => a - b).join(), '★ 一開始不能是排好的 —— 那就沒得排了');
ok(l5.analysis.qs.some(q => q.pick), '也有圈選題');
ok(!!l5.analysis.write, '也有先寫再對照');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
