/* 老師手動開放關卡：只放行，不給星
   跑法：node shared/tests/unlock.test.js

   ★ 老師 2026-09-09：「程式設計評分要通關才能進入下關，如果卡住會造成
     學生困擾。」—— 一次批改約 91 秒又吃全班共用的 API 額度，
     卡在同一關試三四次，一節課就沒了。

   ★★ 這一份守的是**唯一不能妥協的那一條**：開放是「通行證」，不是「成就」。
      放行之後星星必須完全不變 —— 不然就變成老師幫他加分，
      而那會讓整套星星失去意義。
      （grading.js 自己的註解早就寫過同一個道理：
        「概念星是成就，不是通行證」，這裡是反過來用。） */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = global.window || {};
require(path.join(ROOT, 'shared', 'grading.js'));
const G = global.window.GRADING, GATE = G.GATE;
const U = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const FLOW = { a: true, b: true, c: true, d: true };   // 流程圖都排對了

section('① 開放之後下一關要打得開');
{
  const stars = { a: 2 };                    // 只有第一關拿到 2 星
  ok(GATE.openUpTo(U, true, FLOW, stars) === 2,
    '★ 沒開放時停在第 2 關　←　' + GATE.openUpTo(U, true, FLOW, stars));
  ok(GATE.openUpTo(U, true, FLOW, stars, null, { b: true }) === 3,
    '★★★ 開放第 2 關之後要能進第 3 關　←　'
    + GATE.openUpTo(U, true, FLOW, stars, null, { b: true }));
  ok(GATE.isOpen(3, U, true, FLOW, stars, null, { b: true }) === true,
    '★★ isOpen 也要吃到（三支都要傳，漏一支症狀是「卡片開著卻點不進去」）');
  ok(GATE.reason(3, U, true, FLOW, stars, null, { b: true }) === '',
    '★★ reason 要回空字串（不然畫面還是會說被鎖住）');
}

section('★★★ ② 星星絕對不可以因此變多');
{
  const stars = { a: 2 };
  const before = G.scratchTotal(stars);
  GATE.openUpTo(U, true, FLOW, stars, null, { b: true, c: true });
  const after = G.scratchTotal(stars);
  ok(before.stars === after.stars && before.done === after.done,
    '★★★ 開放前後總星數與通關數要一模一樣　←　'
    + JSON.stringify(before) + ' vs ' + JSON.stringify(after));
  ok(after.stars === 2 && after.done === 1,
    '★★★ 被開放的那兩關仍然是 0 星、不算通關　←　' + JSON.stringify(after));
  ok(GATE.cleared('b', FLOW, stars) === false,
    '★★★ 不帶 unlocked 參數時「b」仍然是沒過的 —— '
    + '成績相關的地方不可以看到開放紀錄');
}

section('③ 不要影響原本的規則');
{
  ok(GATE.openUpTo(U, false, FLOW, { a: 2 }, null, { b: true }) === 0,
    '★★★ 前導教材沒完成時，開放也不可以放行（那是另一道門）');
  ok(GATE.cleared('a', FLOW, { a: 2 }, null, {}) === true,
    '★ 空的開放清單不可以影響本來就過的關卡');
  ok(GATE.cleared('b', FLOW, { a: 2 }, null, undefined) === false,
    '★★ 沒傳 unlocked（舊呼叫端，例如 11502）要和以前一模一樣');
}

section('④ 兩端都要接上');
{
  const FC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
  const TE = fs.readFileSync(path.join(ROOT, '11501', 'teacher.html'), 'utf8');
  ok((FC.match(/state\.unlocked\)/g) || []).length >= 3,
    '★★★ openUpTo／isOpen／reason 三支都要把 state.unlocked 傳進去 —— '
    + '漏一支不會有錯誤訊息，只會行為不一致');
  ok(/unlocks_json/.test(FC) && /ROSTER/.test(FC),
    '★★ 闖關頁要從 roster 讀（那是老師才寫得動的地方）');
  ok(/老師開放你先往下做/.test(FC) && /星星隨時回來補/.test(FC),
    '★★★ 卡片要標出「這是老師開放的」，而且講明星星還沒拿到 —— '
    + '不標的話學生會以為已經有分數了');
  ok(/window\.unlockUnit/.test(TE) && /window\.lockUnit/.test(TE)
    && /window\.listUnlocks/.test(TE),
    '★★ 教師端要有開放、收回、查詢三支（只能開不能收會很難用）');
  ok(/重新整理闖關頁/.test(TE),
    '★★ 要提醒學生重新整理才生效 —— 那一頁只在登入時讀一次名冊');
  ok(!/unlocks_json/.test(fs.readFileSync(
      path.join(ROOT, 'shared', 'firestore.rules'), 'utf8')),
    '★ 不必改安全規則（roster 本來就是老師才寫得動、學生單筆讀得到）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
