/* 搜尋實驗室的測試（shared/searchlab.js ＋ 第 8 關的關卡資料）
   跑法：node shared/tests/searchlab.test.js

   ★ 這一關的判定不是「拼對積木」，是「有沒有照演算法走」。
     所以要驗的是規則本身：跳著點會不會被擋、找到會不會停、
     找不到會不會走完 —— 這三件事任何一件破了，
     學生照樣「通關」，而他學到的是錯的東西，畫面上看不出來。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const is = (got, want, l) => ok(JSON.stringify(got) === JSON.stringify(want),
  l + (JSON.stringify(got) === JSON.stringify(want) ? ''
       : `　←　期望 ${JSON.stringify(want)}，實得 ${JSON.stringify(got)}`));
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body><div id="h"></div></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* ⚠️ 挑戰與證書在 shared/labtest.js。沒載的話 LABTEST 是 undefined，
   searchlab 會判定「沒有挑戰資料」直接放行 —— 整段挑戰測不到。 */
W.eval(read('shared/labtest.js'));
W.eval(read('shared/searchlab.js'));
W.eval(read('shared/blocks.js'));
W.eval(read('11502/content/blocks.js'));
const S = W.SEARCHLAB, L = W.BLOCK_LEVELS;

/* ── 規則 ──────────────────────────────────────────── */
section('★ 不准跳 —— 這是「循序」兩個字的全部意思');
const list = [8, 5, 10, 1, 7];
ok(S._checkSequential(list, 0, 0).ok, '第一步點第 1 項 → 可以');
ok(!S._checkSequential(list, 0, 2).ok, '★ 第一步就想點第 3 項（目標所在）→ 擋下來');
ok(/不可以跳|一個接一個/.test(S._checkSequential(list, 0, 2).msg),
   '   訊息要講「不能跳」，不是只說錯了');
ok(!/第\s*1\s*項|第一項/.test(S._checkSequential(list, 0, 4).msg),
   '★ 訊息不告訴他該點哪一格 —— 講了就變成照指示按，' +
   '而「下一個是誰」正是要他自己記住的事');
ok(!S._checkSequential(list, 2, 1).ok, '回頭點已經比過的 → 擋下來');
ok(/已經比過|不會回頭/.test(S._checkSequential(list, 2, 1).msg),
   '   回頭和亂跳要給不一樣的訊息（他犯的錯不同）');
ok(!S._checkSequential([], 0, 0).ok, '空清單不會爆');

section('★ 找到就停、找完就結束');
is(S._stepResult(list, 10, 0), { found: false, done: false, at: 0 }, '第 1 項 8 → 不是，繼續');
is(S._stepResult(list, 10, 1), { found: false, done: false, at: 1 }, '第 2 項 5 → 不是，繼續');
is(S._stepResult(list, 10, 2), { found: true,  done: true,  at: 2 }, '★ 第 3 項 10 → 找到，結束（課本 p.204）');
is(S._stepResult(list,  9, 4), { found: false, done: true,  at: 4 },
   '★ 找 9 比到最後一項 → 沒找到，但也結束了（課本 p.205 那一條）');
ok(S._stepResult(list, 9, 4).done && !S._stepResult(list, 9, 4).found,
   '★ done 和 found 是兩件事 —— 「找完了沒找到」也是一種結束');

section('比較次數');
is(S._countSequential(list, 8), 1, '目標在第 1 項 → 比 1 次（最好的情況）');
is(S._countSequential(list, 10), 3, '課本的例子：找 10 → 比 3 次');
is(S._countSequential(list, 7), 5, '目標在最後一項 → 比滿 5 次');
is(S._countSequential(list, 9), 5, '★ 找不到 → 也要比滿 5 次（要說「沒有」就得每格都看過）');

section('★ 出題');
is(S._makeCase({ course: 'hit' }), { items: [8, 5, 10, 1, 7], target: 10 },
   '★ course:hit 就是課本 p.204 那一題（學生看的和課本要同一組數字）');
is(S._makeCase({ course: 'miss' }), { items: [8, 5, 10, 1, 7], target: 9 },
   '★ course:miss 是課本 p.205 那一題 —— 同一列資料，只換目標');
{
  /* ⚠️ 隨機題不可以是排好的。
     循序搜尋的長處就是「不必先排序」，給他一列排好的資料，
     他會以為兩件事有關係 —— 而下一關（二元搜尋）才是真的要排序。 */
  let sortedHits = 0, missHits = 0, badTarget = 0;
  for (let k = 0; k < 200; k++) {
    const c = S._makeCase({ size: 8 });
    if (S._isSorted(c.items)) sortedHits++;
    if (c.items.indexOf(c.target) < 0) missHits++;
    if (c.items.length !== 8) badTarget++;
  }
  ok(sortedHits === 0, '★ 隨機題不會是排好的（200 題裡 ' + sortedHits + ' 題）');
  ok(missHits > 20 && missHits < 130,
     '★ 有一部分題目是找不到的（200 題裡 ' + missHits + ' 題）—— ' +
     '只玩找得到的，學生不會知道迴圈為什麼需要結束條件');
  ok(badTarget === 0, '   題目長度都對');
  const c1 = S._makeCase({ size: 6, miss: false });
  ok(c1.items.indexOf(c1.target) >= 0, 'miss:false → 目標一定在裡面');
  const c2 = S._makeCase({ size: 6, miss: true });
  ok(c2.items.indexOf(c2.target) < 0, 'miss:true → 目標一定不在裡面');
}

/* ── 畫面與流程 ────────────────────────────────────── */
section('★ 真的掛起來走一遍');
{
  const host = document.getElementById('h');
  let passed = 0;
  const sim = S.mount(host, { mode: 'sequential', course: 'hit',
                              onPass: () => { passed++; } });
  const cells = () => [...host.querySelectorAll('[data-i]')];
  is(cells().length, 5, '五格資料都畫出來了');
  ok(/10/.test(host.querySelector('.qs-target').textContent), '目標資料顯示出來了');

  /* 想抄捷徑：直接點第 3 格（答案就在那裡） */
  cells()[2].onclick();
  is(sim._state().tried, 0, '★ 跳著點：比較次數沒有增加（那一步根本沒算數）');
  ok(/不可以跳/.test(host.querySelector('.qs-msg').innerHTML), '   而且有講原因');

  cells()[0].onclick();
  is(sim._state().tried, 1, '點第 1 項 → 比較次數 1');
  cells()[1].onclick();
  cells()[2].onclick();
  is(sim._state().tried, 3, '★ 照順序走到第 3 項 → 比了 3 次（和課本一樣）');
  ok(sim._state().ended, '   找到了，這一輪結束');
  ok(sim._state().sawHit, '   記下「找得到」走過了');
  is(passed, 0, '★ 只走過找得到的還不算通過 —— 還差找不到那一條');
  ok(/還差一種情況/.test(host.querySelector('.qs-msg').innerHTML),
     '   而且要明講還差什麼，不是靜靜地不放行');

  /* 再走一次找不到的 */
  const host2 = document.createElement('div');
  document.body.appendChild(host2);
  let passed2 = 0;
  const sim2 = S.mount(host2, { mode: 'sequential', course: 'miss',
                                onPass: () => { passed2++; } });
  const c2 = () => [...host2.querySelectorAll('[data-i]')];
  for (let i = 0; i < 5; i++) c2()[i].onclick();
  is(sim2._state().tried, 5, '★ 找不到：五格全部比過');
  ok(sim2._state().ended && !sim2._state().sawHit, '   結束了，而且沒找到');
  ok(/查無此資料/.test(host2.querySelector('.qs-msg').innerHTML),
     '★ 要講出「查無此資料」—— 那是課本的用詞，也是迴圈結束條件的由來');
  is(passed2, 0, '   這一台只走過找不到，同樣不放行');
  host2.remove();
}

/* ═══ 二元搜尋（第 9 關）═══════════════════════════════
   ⚠️ 這一段全部照課本 6-3-2 的那一列數字驗
     （12、13、27、34、39、42、58、60、67、71、88、92、95）。
     課本每一回合都寫出開始位置／結束位置／二分位置，
     所以每一步都對得起來 —— 對不起來就是我們算錯，不是課本錯。 */
const BIG = [12, 13, 27, 34, 39, 42, 58, 60, 67, 71, 88, 92, 95];

section('★ 二分位置：（開始＋結束）÷2，取整數部分');
is(S._midOf(1, 13), 7, '（1＋13）÷2 ＝ 7');
is(S._midOf(8, 13), 10, '★（8＋13）÷2 ＝ 10.5 → 取 10（課本 p.208：取整數部分）');
is(S._midOf(8, 9), 8, '★（8＋9）÷2 ＝ 8.5 → 取 8，不是四捨五入的 9');
is(S._midOf(9, 9), 9, '範圍只剩一格 → 就是那一格');
is(S._midOf(6, 6), 6, '（6＋6）÷2 ＝ 6');

section('★ 只能點二分位置 —— 算不出來就過不去');
ok(S._checkMid(1, 13, 7).ok, '第 1 回合點第 7 項 → 可以');
ok(!S._checkMid(1, 13, 9).ok, '★ 直接點第 9 項（67 就在那裡）→ 擋下來');
ok(/正中間|÷ 2/.test(S._checkMid(1, 13, 9).msg), '   訊息要講規則（開始＋結束）÷2');
ok(!/第\s*7\s*項/.test(S._checkMid(1, 13, 9).msg),
   '★ 不告訴他答案是第幾項 —— 算中間位置正是這一關要他會的事');
ok(!S._checkMid(8, 13, 3).ok, '點到已經砍掉的那一半 → 擋下來');
ok(/已經被排除/.test(S._checkMid(8, 13, 3).msg), '   而且要講「那半邊被排除了」，不是只說錯');

section('★ 砍哪一半');
is(S._sideOf(58, 67), 'right', '中間值 58 < 目標 67 → 取後（右）半部');
is(S._sideOf(71, 67), 'left', '中間值 71 > 目標 67 → 取前（左）半部');
is(S._sideOf(67, 67), 'hit', '相等 → 找到了');
is(S._narrow(1, 13, 7, 'right'), { lo: 8, hi: 13 }, '★ 新範圍不含第 7 項（課本 p.207）');
is(S._narrow(8, 13, 10, 'left'), { lo: 8, hi: 9 }, '★ 新範圍不含第 10 項');
ok(!S._empty(9, 9), '範圍剩一格 → 還沒空');
ok(S._empty(6, 5), '★ 開始位置大於結束位置 → 範圍空了（查無此資料）');

section('★ 比較次數：課本說幾次就是幾次');
is(S._countBinary(BIG, 67), 4, '★ 找 67 → 4 回合（課本 p.208～209）');
is(S._countBinary(BIG, 40), 4, '★ 找 40 → 4 回合後範圍空掉，查無此數字（課本 p.210～211）');
is(S._countBinary(BIG, 58), 1, '目標剛好在正中間 → 1 次');
is(S._countSequential(BIG, 67), 9,
   '★ 同一列資料，循序搜尋找 67 要 9 次 —— 4 對 9，這個差距就是第 9 關的全部重點');

section('★ 二元搜尋的資料一定要排序');
is(S._makeCase({ mode: 'binary', course: 'hit' }), { items: BIG, target: 67 },
   '★ course:hit 就是課本那一列，找 67');
is(S._makeCase({ mode: 'binary', course: 'miss' }), { items: BIG, target: 40 },
   '★ course:miss 是同一列找 40');
{
  let bad = 0;
  for (let k = 0; k < 120; k++) {
    if (!S._isSorted(S._makeCase({ mode: 'binary', size: 11 }).items)) bad++;
  }
  ok(bad === 0,
     '★ 隨機出的二元搜尋題一定是排好的（120 題裡 ' + bad + ' 題沒排）—— ' +
     '那是它的前提，不是巧合');
}

section('★ 照課本走一遍 67（4 回合）');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  let done = 0;
  const sim = S.mount(host, { mode: 'binary', course: 'hit', onPass: () => { done++; } });
  const cell = n => host.querySelectorAll('[data-i]')[n - 1];   // n 用課本的 1 起算
  const side = s => host.querySelector('[data-side="' + s + '"]').onclick();

  /* 想抄捷徑：67 就在第 9 項，直接點 */
  cell(9).onclick();
  is(sim._state().tried, 0, '★ 直接點目標那一格：比較次數沒有增加');

  cell(7).onclick();
  is(sim._state().phase, 'side', '點對二分位置 → 換學生決定砍哪一半');
  side('left');
  is(sim._state().lo + '~' + sim._state().hi, '1~13',
     '★ 砍錯邊 → 範圍不動（58 < 67，目標在右邊）');
  ok(/砍錯邊|被你丟掉/.test(host.querySelector('.qs-msg').innerHTML),
     '   而且要講後果：砍錯就把目標丟掉了');
  side('right');
  is(sim._state().lo + '~' + sim._state().hi, '8~13', '第 1 回合後 → 8～13（課本一樣）');

  cell(10).onclick(); side('left');
  is(sim._state().lo + '~' + sim._state().hi, '8~9', '第 2 回合後 → 8～9');
  cell(8).onclick(); side('right');
  is(sim._state().lo + '~' + sim._state().hi, '9~9', '第 3 回合後 → 9～9');
  cell(9).onclick();
  ok(sim._state().ended && sim._state().sawHit, '第 4 回合找到了');
  is(sim._state().tried, 4, '★ 總共比 4 次 —— 和課本一模一樣');
  ok(/循序搜尋要比 9 次/.test(host.querySelector('.qs-msg').innerHTML),
     '★ 找到時要把「循序要幾次」一起講出來 —— 那個對照是這一關的重點');
  is(done, 0, '只走過找得到的，還不放行');
  host.remove();
}

section('★ 走一遍找不到的 40（範圍縮到空）');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: 'binary', course: 'miss' });
  const cell = n => host.querySelectorAll('[data-i]')[n - 1];
  const side = s => host.querySelector('[data-side="' + s + '"]').onclick();

  cell(7).onclick(); side('left');    // 58 > 40 → 左
  is(sim._state().lo + '~' + sim._state().hi, '1~6', '第 1 回合後 → 1～6');
  cell(3).onclick(); side('right');   // 27 < 40 → 右
  is(sim._state().lo + '~' + sim._state().hi, '4~6', '第 2 回合後 → 4～6');
  cell(5).onclick(); side('right');   // 39 < 40 → 右
  is(sim._state().lo + '~' + sim._state().hi, '6~6', '第 3 回合後 → 6～6');
  cell(6).onclick(); side('left');    // 42 > 40 → 左 → 空
  ok(sim._state().ended && sim._state().sawMiss, '第 4 回合之後範圍空了，結束');
  is(sim._state().tried, 4, '★ 比了 4 次（課本 p.211）');
  const t = host.querySelector('.qs-msg').innerHTML;
  ok(/查無此資料/.test(t), '★ 要講「查無此資料」—— 課本的用詞');
  ok(/大於/.test(t), '★ 也要講清楚是「開始位置大於結束位置」—— 那就是迴圈的結束條件');
  host.remove();
}

/* ═══ ★ 驗收挑戰：三關三顆星 ═══════════════════════════
   ★ 自由玩的通過條件是「照規則走完」—— 那證明他**會操作**。
     真正的證據是：動手之前先說得出「這一題要比幾次」。
   ⚠️⚠️ 這三顆星**不是**系統的星數（那只有作品星與概念星兩組，
        各有唯一的寫入者）。它是挑戰徽章，畫在證書上，
        另外記在 modules.scratch.lab 給老師看。 */
section('★ 三關的題目');
{
  is(S.TESTS.sequential.worstAns(12), 12,
     '★ 循序 12 筆最壞比 12 次（目標在最後或根本沒有）');
  is(S.TESTS.binary.worstAns(15), 4,
     '★ 二元 15 筆最壞比 4 次（15→7→3→1→空）');
  ok(!S.TESTS.compare, '★ 大比拼沒有挑戰 —— 它本來就是一步一步按著數的');
  is(S._realCount('sequential', [8, 5, 10, 1, 7], 10), 3, '這一題實際比 3 次（課本）');
  is(S._realCount('binary', BIG, 67), 4, '這一題實際比 4 次（課本）');
  ok(S.TESTS.sequential.worstAsk.indexOf('最壞') >= 0, '第 3 關問的是「最壞」，不是「這一題」');
  ok(/砍一半|砍四次/.test(S.TESTS.binary.worstWhy),
     '   二元的解釋講「一直砍一半」（那才是最壞次數的由來）');
  ok(/searchlab/.test('searchlab') && /不必真的走/.test(read('shared/searchlab.js')),
     '★ 畫面上會講「這一關不必真的走」—— 不然學生會以為要走一遍');
}

section('★★ 一個學生從自由玩一路挑戰到金牌');
['sequential', 'binary'].forEach(mode => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let badge = null;
  const sim = S.mount(host, { mode: mode, course: 'hit', onPass: b => { badge = b; } });
  const walk = () => {
    for (let k = 0; k < 60; k++) {
      const st = sim._state();
      if (st.ended) return;
      if (mode === 'binary') {
        if (st.phase === 'side') {
          const w = Number(st.items[st.mid - 1]) < Number(st.target) ? 'right' : 'left';
          host.querySelector('[data-side="' + w + '"]').onclick();
          continue;
        }
        const m = Math.floor((st.lo + st.hi) / 2);
        host.querySelectorAll('[data-i]')[m - 1].onclick();
      } else {
        host.querySelectorAll('[data-i]')[st.next].onclick();
      }
    }
  };
  const nextQ = () => host.querySelector('#qs-new').onclick();

  walk(); nextQ(); walk();
  ok(!!host.querySelector('.lt-box'), '★ ' + mode + '：自由玩過了 → 挑戰出現');
  ok(/驗收挑戰 1／3/.test(host.textContent), '   從第 1 關開始');
  ok(badge === null, '★ ' + mode + '：挑戰還沒過 → 還不放行');

  nextQ();
  const st1 = sim._state();
  const real = S._realCount(mode, st1.items, st1.target);
  host.querySelector('#qs-g').value = real;
  host.querySelector('[data-g="1"]').onclick();
  walk();
  ok(/猜中了/.test(host.querySelector('#qs-tsay').textContent),
     '★ ' + mode + '：猜中實際次數 → 過第 1 關');
  ok(/驗收挑戰 2／3/.test(host.textContent), '   進到第 2 關');
  ok(/目前 1 ★/.test(host.textContent), '   拿到 1 顆星');

  nextQ(); walk();
  ok(/零失誤/.test(host.querySelector('#qs-tsay').textContent),
     '★ ' + mode + '：整題沒點錯 → 過第 2 關');
  ok(/驗收挑戰 3／3/.test(host.textContent), '   進到第 3 關');

  host.querySelector('#qs-g').value = 99;
  host.querySelector('[data-g="3"]').onclick();
  ok(/不是 99/.test(host.querySelector('#qs-tsay').textContent), '   答錯會說不是');
  ok(badge === null, '★ ' + mode + '：第 3 關沒過 → 還是不放行');
  const want = S.TESTS[mode].worstAns(S.TESTS[mode].worstSize);
  host.querySelector('#qs-g').value = want;
  host.querySelector('[data-g="3"]').onclick();
  is(badge, 3, '★★ ' + mode + '：三關全過 → 拿到 3 顆星才放行');
  ok(/★★★/.test(host.textContent), '   證書上是三顆實心星');
  ok(/金牌/.test(host.textContent), '   金牌');
  host.remove();
});

section('★ 猜錯不會擋死，可以一直重來');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  let badge = null;
  const sim = S.mount(host, { mode: 'sequential', course: 'hit', onPass: b => { badge = b; } });
  const walk = () => { for (let k = 0; k < 60; k++) {
    const st = sim._state(); if (st.ended) return;
    host.querySelectorAll('[data-i]')[st.next].onclick(); } };
  const nextQ = () => host.querySelector('#qs-new').onclick();
  walk(); nextQ(); walk();
  for (let t = 0; t < 3; t++) {
    nextQ();
    host.querySelector('#qs-g').value = 999;
    host.querySelector('[data-g="1"]').onclick();
    walk();
  }
  ok(/實際是/.test(host.querySelector('#qs-tsay').textContent), '★ 猜錯會告訴他實際幾次');
  ok(/驗收挑戰 1／3/.test(host.textContent), '★ 還停在第 1 關，可以再試（不會鎖死）');
  ok(badge === null, '   而且沒有偷偷放行');
  host.remove();
}

section('★ 大比拼沒有挑戰，跑完就放行');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  let badge = 'x';
  /* ⚠️ stepMs:0 是測試用的：賽跑同步跑完，不開六秒鐘的計時器。 */
  S.mount(host, { mode: 'compare', stepMs: 0, onPass: b => { badge = b; } });
  const runSize = n => {
    host.querySelector('[data-size="' + n + '"]').onclick();
    let g = 0;
    while (host.querySelector('[data-cut]') && g++ < 60) host.querySelector('[data-cut]').onclick();
    /* ★ 2026-08-17 起還要看兩種搜尋比一場 ——
       砍一半只要按 11 下，那是**快的那一邊**；
       循序那 1024 次不看著它跑完，差距就只是表格上的一個數字。 */
    const r = host.querySelector('[data-race]');
    if (r) r.onclick();
  };
  /* 先砍完但不比賽跑 → 還不可以放行 */
  host.querySelector('[data-size="13"]').onclick();
  let g0 = 0;
  while (host.querySelector('[data-cut]') && g0++ < 60) host.querySelector('[data-cut]').onclick();
  ok(!!host.querySelector('[data-race]'), '★★ 砍完之後出現「讓兩種搜尋比一場」');
  S.SIZES.forEach(runSize);
  /* ★ 2026-08-17 又多一關：最後「資料大爆炸」要先猜一個數字。
     ⚠️ 猜**錯**照樣過 —— 要的是他先給一個數字，
        才會對「2300 萬人只要 25 次」這個答案有反應。 */
  is(badge, 'x', '★★ 四種都跑完但還沒猜 → 還不放行');
  const guess = v => {
    const box = host.querySelector('#qs-boom-in');
    if (box) { box.value = String(v); host.querySelector('[data-boom]').onclick(); }
  };
  guess(25);
  is(badge, 0, '★ 四種都跑完＋猜過一次才放行（徽章 0 —— 它沒有挑戰）');
  /* ⚠️ 2026-08-17 資料量加大之後，賽跑有兩種模式：
       小資料量逐次畫 → 講「放慢成 N 毫秒」
       大資料量快轉   → 講「照時間比例快轉」
     所以這裡不可以只找「放慢」那一個詞（第一版就是這樣紅的）。 */
  ok(/放慢|快轉/.test(host.textContent),
     '★★ 畫面上講明動畫動過手腳（不然學生會以為電腦搜尋要跑好幾秒）');
  ok(/比例是真的|都是真的/.test(host.textContent), '　　但強調比例是真的');
  ok(!host.querySelector('.lt-box'), '   畫面上也沒有挑戰區');
  host.remove();
}

section('★★ 徽章不是系統的星數');
{
  /* ⚠️ 系統只有兩組星，各有唯一的寫入者：
       🧩 作品星 unitStars（Colab 批改）、🧠 概念星（quiz 現算）。
     再開第三組會讓 hub 的分母錯掉，也會讓「這顆星是誰給的」說不清楚。 */
  const lvHtml = read('11502/level.html');
  ok(/saveLab/.test(lvHtml), '關卡頁把徽章存起來');
  ok(/modules: \{ scratch: \{ lab:/.test(lvHtml), '★ 存在 modules.scratch.lab —— 自己一個欄位');
  /* ⚠️ 要找的是**定義**那一處，不是 onPass 裡的呼叫 ——
     indexOf 抓到的是先出現的那個呼叫，取樣就整段偏掉。 */
  const i = lvHtml.indexOf('window.saveLab = async');
  ok(i > 0, '找得到 saveLab 的定義');
  const seg = lvHtml.slice(Math.max(0, i - 500), i + 900);
  ok(/不是星數/.test(seg), '★★ 而且註解寫明它不是星數');
  /* 去掉註解再比對 —— 註解裡正好會解釋「為什麼不碰 unitStars」。
     ⚠️ 這是今天第九次同一種錯：「不可以出現」的檢查一律先去註解。 */
  const code = seg.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/unitStars/.test(code), '   程式碼本身完全沒有碰 unitStars');
  ok(/只往上不往下/.test(seg), '   重做拿比較少不會把紀錄蓋掉');
}

/* ── 關卡資料 ──────────────────────────────────────── */
section('★ 第 8 關（6-3-1）的關卡資料');
{
  const lv = L['6-3-1'];
  ok(!!lv, '關卡存在');
  is(lv.lab, { kind: 'search', mode: 'sequential', course: 'hit' },
     '★ 宣告了 lab —— level.html 靠它決定要不要有「動手試一次」那一步');
  ok(!!S.INFO[lv.lab.mode], '   lab.mode 在 SEARCHLAB.INFO 裡查得到');
  ok((lv.quiz || []).length >= 6, '概念檢測 ' + lv.quiz.length + ' 題（抽 5，要 6 題以上）');
  ok(lv.quiz.every(q => q.ref !== undefined), '每一題都指得回來源（ref）');
  ok(lv.quiz.every(q => (q.need || []).every(n => (n.any || []).length >= 3)),
     '★ 每個概念群至少 3 種同義說法 —— 寧可放過，不可錯殺');
  ok(lv.quiz.every(q => q.min && q.hint && q.why), '每一題都有 min／hint／why');

  /* 拼圖是縮小版，但仍然要判得對、改壞要判得錯。 */
  const B = W.BLOCKS;
  const build = l => (l || []).map(x => {
    const d = B.DEFS[x.id];
    return { uid: 'u' + Math.random(), id: x.id,
             args: (x.args != null ? x.args : (d.args || [])).map(
               v => (v && typeof v === 'object') ? build([v])[0] : v),
             children: x.children ? build(x.children)
                                  : ((d.shape === 'c' || d.shape === 'c2') ? [] : null),
             children2: x.children2 ? build(x.children2) : (d.shape === 'c2' ? [] : null) };
  });
  const got = build(lv.goal);
  ok(B._same(got, lv.goal, lv.loose || []), '★ 照答案拼 → 判對');

  /* ★ 這一條是這一關拼圖唯一真正的考點。
     少了「位置改變 1」，程式永遠停在第 1 項 —— 那就是無窮迴圈，
     而畫面上它看起來只是「少一塊」。
     ⚠️ 2026-08-17：原本用寫死的索引（goal[2]）抓那個迴圈。
        那天依老師的範例檔改寫這一關（報告結果搬到迴圈外面），
        塊數和順序都變了 —— 於是這裡直接爆掉。
        ★ 改成**用 id 找**：關卡資料的順序本來就會變，
          測試不該把它當成契約。 */
  const idxOf = (l, id) => l.findIndex(n => n.id === id);
  const iLoop = idxOf(got, 'control.untilfound');
  ok(iLoop >= 0, '★ 找得到那個「重複直到」（兩個停止條件的那一塊）');

  const noStep = JSON.parse(JSON.stringify(got));
  noStep[iLoop].children = noStep[iLoop].children.filter(n => n.id !== 'list.changeidx');
  ok(!B._same(noStep, lv.goal, lv.loose || []),
     '★ 漏掉「位置改變 1」→ 判錯（那是無窮迴圈）');

  /* 位置加 1 放到迴圈外面 —— 同樣是停在第 1 項 */
  const outside = JSON.parse(JSON.stringify(got));
  const moved = outside[iLoop].children.pop();
  outside.push(moved);
  ok(!B._same(outside, lv.goal, lv.loose || []),
     '★ 把「位置改變 1」搬到迴圈外面 → 判錯');

  /* 起點不是 1 */
  const from0 = JSON.parse(JSON.stringify(got));
  from0[idxOf(got, 'list.setidx')].args[1] = 0;
  ok(!B._same(from0, lv.goal, lv.loose || []), '   起點不是第 1 項 → 判錯');

  /* ★★ 2026-08-17 依老師的範例檔（單元八）改的那件事：
     報告結果要在迴圈**外面**。寫在裡面的話，找不到時程式什麼都不會說。 */
  ok(idxOf(got, 'control.ifover') > iLoop,
     '★★ 「如果 位置 > 長度」在迴圈**外面** —— 找不到也要說話');
  const noNone = got.filter(n => n.id !== 'control.ifover');
  ok(!B._same(noNone, lv.goal, lv.loose || []),
     '★★ 少了迴圈外那段報告 → 判錯（找不到的時候一片安靜）');
  const inside = JSON.parse(JSON.stringify(got));
  inside[iLoop].children.push({ id: 'looks.sayfound', args: [], children: null, children2: null });
  ok(!B._same(inside, lv.goal, lv.loose || []),
     '★ 把「說出找到了」塞回迴圈裡 → 判錯（那是舊版的寫法）');

  /* 誘餌要在調色盤上，而且不可以混進答案 */
  const used = new Set();
  (function w(l) { (l || []).forEach(n => { used.add(n.id);
    (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
    w(n.children); w(n.children2); }); })(lv.goal);
  /* ⚠️ 誘餌名單跟著改版換過：
       control.until    只有一個停止條件（找不到時停不下來）
       control.iffound  把「找到了」寫在迴圈裡 —— 那正是這次修掉的舊寫法
       list.settarget   範例檔沒有這一塊（它直接用「詢問的答案」比） */
  ['control.until', 'control.iffound', 'list.settarget', 'control.repeatlen'].forEach(id => {
    ok(lv.palette.indexOf(id) >= 0, '★ 調色盤上有誘餌 ' + id);
    ok(!used.has(id), '   誘餌 ' + id + ' 沒有混進答案');
  });
  ok(lv.palette.filter(id => !B.DEFS[id]).length === 0, '調色盤沒有不存在的積木');
  ok([...used].filter(id => lv.palette.indexOf(id) < 0).length === 0,
     '答案要的積木調色盤都給了');
}

section('★ 第 9 關（6-3-2）的關卡資料');
{
  const lv = L['6-3-2'];
  ok(!!lv, '關卡存在');
  is(lv.lab, { kind: 'search', mode: 'binary', course: 'hit' }, '★ 宣告了 binary 的 lab');
  ok(!!S.INFO[lv.lab.mode], '   lab.mode 在 SEARCHLAB.INFO 裡查得到');
  ok((lv.quiz || []).length >= 6, '概念檢測 ' + lv.quiz.length + ' 題');
  ok(lv.quiz.every(q => q.ref !== undefined), '每一題都指得回來源');
  ok(lv.quiz.every(q => (q.need || []).every(n => (n.any || []).length >= 3)),
     '★ 每個概念群至少 3 種同義說法');

  const B = W.BLOCKS;
  const build = l => (l || []).map(x => {
    const d = B.DEFS[x.id];
    return { uid: 'u' + Math.random(), id: x.id,
             args: (x.args != null ? x.args : (d.args || [])).map(
               v => (v && typeof v === 'object') ? build([v])[0] : v),
             children: x.children ? build(x.children)
                                  : ((d.shape === 'c' || d.shape === 'c2') ? [] : null),
             children2: x.children2 ? build(x.children2) : (d.shape === 'c2' ? [] : null) };
  });
  const got = build(lv.goal);
  ok(B._same(got, lv.goal, lv.loose || []), '★ 照答案拼 → 判對');

  /* ★★ 這一關拼圖唯一真正的考點：那個「否則」。
     只寫「那麼」的話，中間值比目標大時範圍完全不動 → 無窮迴圈。
     而畫面上它看起來只是「少一小塊」。
     ⚠️ 2026-08-17：原本用寫死的索引 goal[3] 抓那個迴圈 ——
        那天依老師的範例檔改寫這一關（多了詢問、報告搬到迴圈外），
        索引整個位移，測試直接爆掉。★ 改成用 id 找。 */
  const idxOf = (l, id) => l.findIndex(n => n.id === id);
  const iLoop = idxOf(got, 'control.untilhalf');
  ok(iLoop >= 0, '★ 找得到那個「重複直到」（兩個停止條件的那一塊）');
  const iIf = got[iLoop].children.findIndex(n => n.id === 'control.ifmid');

  const noElse = JSON.parse(JSON.stringify(got));
  noElse[iLoop].children[iIf].children2 = [];
  ok(!B._same(noElse, lv.goal, lv.loose || []),
     '★★ 「否則」那格空著 → 判錯（另外那一半永遠砍不掉，範圍不動＝無窮迴圈）');

  /* 兩邊放反：該右移的時候左移 —— 目標被砍掉，永遠找不到 */
  const swap = JSON.parse(JSON.stringify(got));
  const ie = swap[iLoop].children[iIf];
  const t = ie.children; ie.children = ie.children2; ie.children2 = t;
  ok(!B._same(swap, lv.goal, lv.loose || []),
     '★ 開始位置與結束位置的調整放反 → 判錯（等於每次都砍掉有目標的那一半）');

  /* 算二分位置放到迴圈外面：範圍變了中間點卻不重算 */
  const outside = JSON.parse(JSON.stringify(got));
  const mid = outside[iLoop].children.shift();
  outside.splice(iLoop, 0, mid);
  ok(!B._same(outside, lv.goal, lv.loose || []),
     '★ 「算二分位置」搬到迴圈外面 → 判錯（範圍變了卻不重算，永遠指同一格）');

  /* 結束位置寫死成 13 —— 換一組資料就不能用 */
  const hard = JSON.parse(JSON.stringify(got));
  hard[idxOf(got, 'list.setlen')] =
    { uid: 'x', id: 'list.setidx', args: ['結束位置', 13], children: null, children2: null };
  ok(!B._same(hard, lv.goal, lv.loose || []),
     '   結束位置打死 13（不用清單長度）→ 判錯');

  /* ★★ 2026-08-17 依老師的範例檔（單元九）改的那件事：迴圈外要報告結果。
     ⚠️ 但收斂**刻意不照範例**：範例用「開始位置 ← 二分位置」（不加減 1），
        接上它自己那 50 筆資料跑，第 25 項的 50 和第 50 項的 100 都找不到。 */
  ok(idxOf(got, 'control.iffoundmid') > iLoop,
     '★★ 找到／沒有在迴圈**外面**報告 —— 找不到也要說話');
  const noReport = got.filter(n => n.id !== 'control.iffoundmid');
  ok(!B._same(noReport, lv.goal, lv.loose || []),
     '★★ 少了迴圈外那段報告 → 判錯');
  const noPM1 = JSON.parse(JSON.stringify(got));
  noPM1[iLoop].children[iIf].children  = [{ uid: 'a', id: 'list.setidx', args: ['開始位置', 1], children: null, children2: null }];
  noPM1[iLoop].children[iIf].children2 = [{ uid: 'b', id: 'list.setidx', args: ['結束位置', 1], children: null, children2: null }];
  ok(!B._same(noPM1, lv.goal, lv.loose || []),
     '★★ 收斂不用 ±1 → 判錯（範例檔就是這樣漏掉最後一項的）');

  ['list.changeidx', 'control.if', 'control.repeat', 'control.repeatlen'].forEach(id => {
    ok(lv.palette.indexOf(id) >= 0, '★ 調色盤上有誘餌 ' + id);
  });
  const used = new Set();
  (function w(l) { (l || []).forEach(n => { used.add(n.id);
    (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
    w(n.children); w(n.children2); }); })(lv.goal);
  ok(!used.has('list.changeidx'),
     '★ 「位置改變 1」沒有混進答案 —— 那是上一關循序搜尋的做法，最容易拿錯');
  ok(!used.has('control.if'), '   單向的「如果…那麼」沒有混進答案（這一關要雙向）');
  ok(lv.palette.filter(id => !B.DEFS[id]).length === 0, '調色盤沒有不存在的積木');
  ok([...used].filter(id => lv.palette.indexOf(id) < 0).length === 0, '答案要的積木都給了');

  /* 兩關的用詞要一致 —— 學生是連著上的。
     ⚠️⚠️ 2026-08-17 老師：「全部使用上傳程式中的變數名稱。」
        範例檔（11502_單元九）的變數是 **位置／開始位置／結束位置**，
        課本 p.208 把中間那一格叫「二分位置」。
        ⇒ 系統一律跟範例檔走 —— 學生在拼圖上看到的字，
          回 Scratch 要找得到同一個變數。
        ★ 課本的講法沒有消失：實驗室的規則裡留了一句
          「（課本上把這個位置叫「二分位置」）」，翻課本才不會斷掉。 */
  const j9 = JSON.stringify(lv);
  ok(/開始位置/.test(j9) && /結束位置/.test(j9) && /位置/.test(j9),
     '★ 用詞跟範例檔（開始位置／結束位置／位置）');
  ok(!/二分位置/.test(j9),
     '★★ 關卡資料裡不再出現「二分位置」—— 那是課本的講法，範例檔叫「位置」');
  ok(/二分位置/.test(fs.readFileSync(path.join(__dirname, '..', 'searchlab.js'), 'utf8')),
     '★ 但實驗室仍留著一句對照，學生翻課本 p.208 才接得上');
}

/* ═══ 大比拼（第 10 關）═══════════════════════════════ */
section('★ 最壞情況要比幾次 —— 對得上課本的習題');
is(S._afterCut(13), 6, '13 筆比完中間那筆 → 剩 6 筆（新範圍不含它）');
is(S._afterCut(1), 0, '剩 1 筆比完 → 範圍空了');
is(S._worstSequential(50), 50, '循序最壞 = 全部比一遍');
is(S._worstBinary(50), 6, '★ 50 筆 → 6 次（課本 p.220 習題的答案）');
is(S._worstBinary(1024), 11, '★ 1024 筆 → 11 次（課本 p.220 習題的答案）');
is(S._worstBinary(13), 4, '13 筆 → 4 次（和課本找 67 的回合數一樣）');
is(S._worstBinary(1), 1, '只有 1 筆 → 1 次');
{
  /* 資料翻倍，二元搜尋只多比一次 —— 這一關要學生看見的就是這件事。 */
  const bad = [8, 16, 32, 64, 128, 256, 512].filter(
    n => S._worstBinary(n * 2) !== S._worstBinary(n) + 1);
  ok(bad.length === 0, '★ 資料翻一倍，二元搜尋只多比一次（' + bad.join('、') + '）');
}

section('★ 大比拼：四種資料量都要跑過');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  let done = 0;
  const sim = S.mount(host, { mode: 'compare', stepMs: 0, onPass: () => { done++; } });
  const size = n => host.querySelector('[data-size="' + n + '"]').onclick();
  const cutBtn = () => host.querySelector('[data-cut]');
  const raceBtn = () => host.querySelector('[data-race]');

  ok(!!size, '四個資料量的按鈕都畫出來了');
  /* ⚠️⚠️ 2026-08-17 老師：「數字太小不符合關卡名稱『資料大爆炸』」。
     從 [13,50,100,1024] 換成 [13,1024,100萬,1億]——
     最大那一檔要按 27 下才砍得完，而「按 20 下砍完一百萬筆」
     是學生自己按出來的，比看動畫強得多。
     ★ 13 留著：那是課本 p.204 的例子，概念檢測也在問它。 */
  is(S.SIZES, [13, 1024, 1000000, 100000000],
     '★★ 資料量夠大了（13 是課本的例子，後面三檔跳大）');
  ok(S._worstBinary(1000000) === 20, '　　一百萬筆按 20 下就砍完');
  ok(S._worstBinary(100000000) === 27, '　　一億筆也才 27 下');

  S.SIZES.forEach(n => {
    size(n);
    let guard = 0;
    while (cutBtn() && guard++ < 60) cutBtn().onclick();
    is(sim._state().table[n], S._worstBinary(n),
       n + ' 筆：學生按了 ' + sim._state().table[n] + ' 下，和算出來的一樣');
    /* ★ 砍完還不算走過這一種資料量 —— 要看兩種搜尋比一場。
       ⚠️ 那 11 下是「快的那一邊」；循序的 1024 次不看它跑完，
          差距就只是表格上的一個數字（老師 2026-08-17 試跑時的原話：
          「一直按下一步就過了，沒有體驗到數字的差距與時間成本」）。 */
    is(done, 0, '   ' + n + ' 筆砍完了，但還沒比賽跑 → 不放行');
    raceBtn().onclick();
    if (n !== 1024) is(done, 0, '   還沒跑完全部 → 不放行');
  });
  is(done, 0, '★★ 四種都跑完但還沒猜「資料大爆炸」→ 還不放行');
  const box = host.querySelector('#qs-boom-in');
  box.value = '25';
  host.querySelector('[data-boom]').onclick();
  is(done, 1, '★ 四種都砍完＋都比過一場＋猜過 → 放行');
  is(host.querySelectorAll('.qs-tbl tr').length - 1, 4, '對照表累積了四列');
  const tbl = host.querySelector('.qs-tbl').textContent;
  ok(/100,000,000/.test(tbl) && /27/.test(tbl),
     '★★ 表格上看得到 1 億對 27 —— 那個對比不必解釋');
  ok(/1,000,000/.test(tbl), '★ 大數字有千分位（不然是一串看不懂的 0）');
  host.remove();
}
{
  /* ⚠️ 只跑最小的那一個不可以就放行。
     13 筆是 13 對 4 —— 差距不夠大，學生會覺得「好像也沒差多少」，
     而那正好是這一關要打掉的錯覺。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  let done = 0;
  S.mount(host, { mode: 'compare', stepMs: 0, onPass: () => { done++; } });
  host.querySelector('[data-size="13"]').onclick();
  let guard = 0;
  while (host.querySelector('[data-cut]') && guard++ < 60) host.querySelector('[data-cut]').onclick();
  host.querySelector('[data-race]').onclick();
  is(done, 0, '★ 只跑 13 筆 → 不放行（差距不夠大，看不出重點）');
  ok(/還有/.test(host.querySelector('.qs-msg').innerHTML), '   而且要講還差哪幾個');
  /* ★ 砍完卻沒比賽跑的時候，訊息要指名是哪一種資料量在等 */
  const h2 = document.createElement('div');
  document.body.appendChild(h2);
  S.mount(h2, { mode: 'compare', stepMs: 0, onPass: () => {} });
  /* ⚠️ 不要寫死資料量 —— 2026-08-17 把 100 換成一百萬之後，
     這一行直接抓不到按鈕（是 crash 不是紅字）。★ 用 SIZES 拿。 */
  h2.querySelector('[data-size="' + S.SIZES[1] + '"]').onclick();
  let g2 = 0;
  while (h2.querySelector('[data-cut]') && g2++ < 60) h2.querySelector('[data-cut]').onclick();
  ok(/比一場/.test(h2.textContent),
     '★★ 砍完之後畫面上請他「讓兩種搜尋比一場」');
  h2.remove();
  host.remove();
}

section('★★ 賽跑：時間感是這一步唯一要給的東西');
{
  /* ★ 老師 2026-08-17 試跑的原話：
       「目前只要一直按下一步就過了，沒有體驗到數字的差距與時間成本」
     診斷：1024 筆按 11 下就結束 —— 學生體驗到的只有**快的那一邊**。
     ⇒ 讓循序搜尋當場跑給他看，他要等。那個等待就是教學內容。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: 'compare', stepMs: 0, onPass: () => {} });
  host.querySelector('[data-size="1024"]').onclick();
  let g = 0;
  while (host.querySelector('[data-cut]') && g++ < 60) host.querySelector('[data-cut]').onclick();
  host.querySelector('[data-race]').onclick();

  const t = host.textContent;
  ok(/1024 \/ 1024 次/.test(t.replace(/\s+/g, ' ')) || /1024/.test(t),
     '★ 循序那一條真的跑到 1024');
  ok(/11 \/ 11 次/.test(t.replace(/\s+/g, ' ')) || /11/.test(t), '   二元那一條跑到 11');
  ok(/差 <b>93<\/b> 倍|93/.test(host.innerHTML), '★★ 講出差幾倍（1024 對 11 是 93 倍）');
  ok(/你等了多久/.test(t), '★★ 而且問他「你等了多久」—— 那才是這一步要留下的印象');
  is(host.querySelectorAll('.qs-lane').length, 2, '兩條跑道都畫出來了');
  is(host.querySelectorAll('.qs-lane .fill').length, 2, '   各有一條進度條');

  /* ⚠️ 每一次比較放慢成 6ms：1024 次要等 6 秒。
     那個數字是刻意的 —— 調快就沒有等待，也就沒有這一步。 */
  const src = read('shared/searchlab.js');
  const m = src.match(/var STEP_MS = \(opts\.stepMs != null\) \? Number\(opts\.stepMs\) : (\d+)/);
  ok(!!m, '找得到每一步的毫秒數');
  const ms = m ? Number(m[1]) : 0;
  ok(ms >= 4, '★★ 放慢到 ' + ms + 'ms／次 —— 1024 筆要等 ' +
     (1024 * ms / 1000).toFixed(1) + ' 秒（調太快就沒有「等待」這件事了）');
  ok(1024 * ms / 1000 >= 3, '   最大那一次至少要等三秒以上');

  /* ⚠️ 離開這一步要把計時器停掉，不然它會繼續跑並且畫到已經清空的畫面上 */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const iD = code.indexOf('destroy: function');
  ok(iD > 0 && /clearInterval/.test(code.slice(iD, iD + 220)),
     '★★ destroy 會停掉賽跑的計時器');
  /* 換資料量也要收乾淨 */
  const iS = code.indexOf('function startSize');
  ok(iS > 0 && /clearInterval/.test(code.slice(iS, iS + 260)),
     '★ 換資料量也會把上一輪的賽跑停掉');
  host.remove();
}

section('★★ 資料大爆炸：數字要真的爆起來');
{
  /* ★ 老師 2026-08-17：「數字太小不符合關卡名稱『資料大爆炸』」。
     1024 對 11 稱不上爆炸 —— 學生只會覺得「喔，比較少」。
     真正的震撼：全台灣 2300 萬人，二元搜尋只要 25 次；
     全世界 80 億人也才 33 次 —— 資料量 348 倍，次數只多 8 次。 */
  ok(S._worstBinary(23000000) === 25, '★★ 2300 萬筆 → 二元搜尋 25 次');
  ok(S._worstBinary(8000000000) === 33, '★★ 80 億筆 → 33 次');
  ok(S._worstBinary(8000000000) - S._worstBinary(23000000) === 8,
     '★★ 資料量變成 348 倍，次數只多 8 次 —— 這一關要的就是這個對比');

  const host = document.createElement('div');
  document.body.appendChild(host);
  S.mount(host, { mode: 'compare', stepMs: 0, onPass: () => {} });
  const run = n => {
    host.querySelector('[data-size="' + n + '"]').onclick();
    let g = 0;
    while (host.querySelector('[data-cut]') && g++ < 60) host.querySelector('[data-cut]').onclick();
    host.querySelector('[data-race]').onclick();
  };
  ok(!/資料大爆炸/.test(host.textContent),
     '★ 還沒跑完四種資料量之前不出現 —— 先有小數字的直覺，大數字才震撼');
  S.SIZES.forEach(run);
  ok(/資料大爆炸/.test(host.textContent), '★★ 四種都跑完之後才出現');
  ok(/2300 萬/.test(host.textContent), '　　問的是全台灣 2300 萬人');
  ok(!/25/.test(host.querySelector('.qs-boom').textContent),
     '★★ 還沒猜之前不可以先把答案 25 印在畫面上');

  /* 空白不可以按過去 */
  host.querySelector('[data-boom]').onclick();
  ok(!/答案是/.test(host.textContent), '★ 沒填數字就送出 → 擋下來');

  /* 猜得離譜 → 給一次修正機會，不是直接揭曉 */
  const guess = v => {
    host.querySelector('#qs-boom-in').value = String(v);
    host.querySelector('[data-boom]').onclick();
  };
  guess(50000);
  ok(/再猜一次/.test(host.textContent),
     '★★ 猜得離譜（5 萬 vs 25）→ 請他再猜一次，不是直接公布');
  guess(30);
  const t = host.querySelector('.qs-boom').textContent;
  ok(/答案是/.test(t) && /25/.test(t), '★★ 第二次就揭曉 —— 猜錯也過，重點是猜過');

  /* 自己填任意數字 */
  ok(/全世界/.test(t), '★ 有快捷鈕可以跳到全世界 80 億');
  host.querySelector('[data-boomn="8000000000"]').onclick();
  const t2 = host.querySelector('.qs-boom').textContent;
  ok(/8,000,000,000/.test(t2), '★★ 80 億印出來有千分位（不然是一串看不懂的 0）');
  ok(/33 次/.test(t2), '★★ 而且算得出 33 次');
  ok(/小時|分鐘/.test(t2),
     '★ 換算成時間 —— 80 億筆循序搜尋要跑好幾小時，那才是「爆炸」的實感');
  ok(/每秒比一百萬次/.test(t2),
     '★★ 而且寫明時間是怎麼換算的（不寫的話那個秒數是憑空冒出來的）');
  ok(/比例是真的/.test(t2), '　　但強調比例是真的');

  /* 自己填一個數字 */
  host.querySelector('#qs-boom-n').value = '1000000';
  host.querySelector('[data-boomn="0"]').onclick();
  ok(/1,000,000/.test(host.querySelector('.qs-boom').textContent),
     '★ 自己填 100 萬也算得出來');
  host.remove();
}

section('★ 第 10 關（6-3-3）的關卡資料');
{
  /* ⚠️⚠️ 2026-08-17 整段重寫。
     這一段原本在測第 10 關的**程式拼圖**（停止條件、否則、存答案…），
     但那天老師說：「第十關應該不需要程式，因為比較的是大量程式的效能」——
     拼圖拿掉了，那支「兩個停止條件」的循序搜尋**搬回第 8 關**。
     ⇒ 舊斷言全部指向已經不存在的 goal[4]，測試直接爆掉（不是紅字，是 crash）。
     ★ 教訓：這一支跑很久（jsdom＋大量案例），那天我沒跑到它就說「相關測試全綠」。
       改關卡結構的時候，**跑得慢的測試才是最容易被漏掉的那一個**。 */
  const lv = L['6-3-3'];
  ok(!!lv, '關卡存在');
  is(lv.lab, { kind: 'search', mode: 'compare' }, '★ 宣告了 compare 的 lab');
  ok(!!S.INFO[lv.lab.mode], '   lab.mode 在 SEARCHLAB.INFO 裡查得到');
  ok((lv.quiz || []).length >= 6, '概念檢測 ' + lv.quiz.length + ' 題');
  ok(lv.quiz.every(q => q.ref !== undefined), '每一題都指得回來源');
  ok(lv.quiz.every(q => (q.need || []).every(n => (n.any || []).length >= 3)),
     '★ 每個概念群至少 3 種同義說法');

  ok(!lv.goal, '★★ 這一關**沒有程式拼圖** —— 它比的是第 8、9 關寫過的那兩支');
  ok(!lv.palette, '   調色盤也拿掉了');
  ok(lv.finish && lv.finish.kind === 'bigcost',
     '★ 最後一步是實作體驗「資料大爆炸」（不是上傳作品）');
}

section('★ 第 8 關留的洞，第 8 關自己補起來了');
{
  /* ⚠️ 第 8 關的 tips 一度寫著「回到真的 Scratch 時，『重複直到』要再加一個條件」，
     把完整版留給第 10 關。2026-08-17 那支程式搬回第 8 關之後，
     這一關本來就該把兩個停止條件講完 —— 不可以再留伏筆。 */
  const l8 = JSON.stringify(L['6-3-1']);
  ok(/兩個/.test(l8) && /超過/.test(l8),
     '★★ 第 8 關自己就講完「兩個停止條件」與「位置超過長度」');
  ok(/流程圖/.test(l8), '   而且指回課本 p.215 的流程圖');
  ok(!/第 10 關|下一關再/.test(JSON.stringify(L['6-3-1'].tips)),
     '★ 不再把完整版推給第 10 關（那支程式已經搬回來了）');
}

/* ═══ ★★ 一個學生從頭走到底，一定要過得了關 ═══════════════
   ⚠️ 2026-08-12 抓到的當機級錯誤，而且是這一份測試自己漏掉的：
      「換一題」原本寫成 reset(makeCase(opts)) —— opts 裡還帶著 course:'hit'，
      所以每次都回課本那一題。按幾次都一樣，
      而通過條件要「找得到＋找不到各一次」⇒ **這一關永遠過不了**。

   ★ 為什麼前面那些測試沒抓到
     它們是 mount 兩台，一台 course:'hit'、一台 course:'miss'，
     各自驗各自的 —— 那條路學生根本走不到。
     學生只有一台，而且只會按「換一題」。
   ⇒ 這一段一律**只用 UI**、**只用一個實例**，模擬真的學生。 */
section('★★ 只按畫面上的按鈕，從頭走到底');
['sequential', 'binary'].forEach(mode => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let passed = 0;
  const sim = S.mount(host, { mode: mode, course: 'hit', onPass: () => { passed++; } });
  const targets = [];
  for (let step = 0; step < 200 && !host.querySelector('.lt-box'); step++) {
    const st = sim._state();
    if (st.ended) {                       // 走完一題 → 按「換一題」
      targets.push(st.target);
      host.querySelector('#qs-new').onclick();
      continue;
    }
    if (mode === 'binary') {
      if (st.phase === 'side') {          // 決定砍哪一半
        const want = Number(st.items[st.mid - 1]) < Number(st.target) ? 'right' : 'left';
        host.querySelector('[data-side="' + want + '"]').onclick();
        continue;
      }
      const m = Math.floor((st.lo + st.hi) / 2);
      host.querySelectorAll('[data-i]')[m - 1].onclick();
    } else {
      host.querySelectorAll('[data-i]')[st.next].onclick();
    }
  }
  /* ⚠️ 2026-08-12 之後「自由玩走完」不再直接 onPass —— 它會開啟驗收挑戰。
     這一段原本要釘的是「學生走得完，不會卡死」，那個意圖沒有變，
     只是終點從 onPass 換成「挑戰出現」。 */
  ok(sim._state().sawHit && sim._state().sawMiss,
     '★★ ' + mode + '：老老實實走 → 找得到與找不到都遇得到（不會卡死）');
  ok(!!host.querySelector('.lt-box'),
     '★ ' + mode + '：自由玩走完 → 驗收挑戰出現');
  ok(targets.length >= 1 && targets.length <= 6,
     '   ' + mode + '：走了 ' + (targets.length + 1) + ' 題就走完自由玩（不必一直換）');
  host.remove();
});

section('★ 換一題要真的換');
['sequential', 'binary'].forEach(mode => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: mode, course: 'hit' });
  const seen = new Set([sim._state().target]);
  for (let i = 0; i < 10; i++) {
    host.querySelector('#qs-new').onclick();
    seen.add(sim._state().target);
  }
  ok(seen.size >= 3, '★ ' + mode + '：按十次換一題，出了 ' + seen.size + ' 種不同的目標');
  host.remove();
});

section('★ 第二題就是課本的另一半');
{
  /* 課本用同一列資料示範兩次（找得到／找不到）——
     學生按第一次「換一題」時，就該看到書上的第二個例子。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: 'sequential', course: 'hit' });
  is(sim._state().target, 10, '第 1 題是課本 p.204 的找 10');
  host.querySelector('#qs-new').onclick();
  is(sim._state().target, 9, '★ 第 2 題是課本 p.205 的找 9（同一列資料）');
  is(sim._state().items, [8, 5, 10, 1, 7], '   資料列沒變，只換目標');
  host.remove();

  const h2 = document.createElement('div');
  document.body.appendChild(h2);
  const s2 = S.mount(h2, { mode: 'binary', course: 'hit' });
  is(s2._state().target, 67, '二元第 1 題是找 67');
  h2.querySelector('#qs-new').onclick();
  is(s2._state().target, 40, '★ 二元第 2 題是找 40（課本 p.210）');
  h2.remove();
}

/* ═══ ★ 逐步示範（按下一步慢慢看）═══════════════════════
   ⚠️ 示範是**求助**，不是開場。
      一開場就放示範的話，學生會照著示範按 —— 那就沒有在想了。
      ⇒ 收在一顆按鈕後面，卡住才看。（和第 4 關的「慢動作重看」同一個設計。） */
section('★ 循序搜尋的示範');
{
  const st = S._demoSteps('sequential', [8, 5, 10, 1, 7], 10);
  is(st.length, 4, '★ 課本 p.204 的例子走 4 步（開場 ＋ 三個回合）');
  ok(st.every(x => x.note && x.note.length > 8), '每一步都有一句解說');
  ok(/第 1 項/.test(st[0].note), '開場先講「從第 1 項開始」');
  ok(/8/.test(st[1].note) && /不是它/.test(st[1].note), '第 1 步：8 不是目標');
  ok(st[3].found && /找到了/.test(st[3].note), '★ 第 3 步找到 10');
  ok(/後面那幾項不必再比/.test(st[3].note),
     '★ 找到就停 —— 這句話要講出來（那是迴圈跳出的由來）');
  is(st[3].n, 3, '   比較次數 3，和 _countSequential 一致');

  const miss = S._demoSteps('sequential', [8, 5, 10, 1, 7], 9);
  is(miss.length, 6, '找 9 要走完五項');
  ok(/查無此資料/.test(miss[5].note), '★ 找不到那一條要講「查無此資料」');
}

section('★ 二元搜尋的示範 —— 每一步都對得回課本');
{
  const st = S._demoSteps('binary', BIG, 67);
  ok(/已經由小到大排好/.test(st[0].note), '★ 開場先講前提：資料要先排序');
  /* 課本 p.208～209 的四個回合，數字一個都不能錯 */
  ok(/（1＋13）÷ 2 = 7/.test(st[1].note), '★ 第 1 回合：(1+13)÷2 = 7');
  ok(/58/.test(st[1].note), '   第 7 項是 58');
  ok(/（8＋13）÷ 2 = 10.5 → 取整數部分 <b>10<\/b>/.test(st[3].note),
     '★★ 第 2 回合：10.5 要寫出來，再講取整數部分 10（課本就是這樣算的）');
  ok(/（8＋9）÷ 2 = 8.5 → 取整數部分 <b>8<\/b>/.test(st[5].note),
     '★★ 第 3 回合：8.5 → 8（不是四捨五入的 9）');
  ok(/（9＋9）÷ 2 = 9/.test(st[7].note), '   第 4 回合：9');
  ok(st[8].found && /找到了/.test(st[8].note), '★ 第 4 回合找到 67');
  is(st[8].n, 4, '   比了 4 次，和 _countBinary 一致');
  ok(/循序搜尋要比 9 次/.test(st[8].note),
     '★ 找到時要把「循序要幾次」一起講 —— 4 對 9 才是這一關的重點');
  /* 砍掉哪一半、為什麼砍，每一步都要說 */
  ok(/小.*右邊|右邊.*小/.test(st[2].note), '★ 講清楚「比目標小 → 目標在右邊」');
  ok(/大.*左邊|左邊.*大/.test(st[4].note), '★ 也講清楚「比目標大 → 在左邊」');
  ok(/砍掉/.test(st[2].note) && /第 7 項/.test(st[2].note),
     '★ 要講「連同二分位置整個砍掉」—— 新範圍不含它');

  const miss = S._demoSteps('binary', BIG, 40);
  ok(miss[miss.length - 1].done && !miss[miss.length - 1].found, '找 40 → 沒找到');
  ok(/大於/.test(miss[miss.length - 1].note) && /查無此資料/.test(miss[miss.length - 1].note),
     '★ 結尾要講「開始位置大於結束位置 → 查無此資料」');
}

section('★ 示範掛得起來，而且是「卡住才看」');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: 'binary', course: 'hit' });
  ok(!!host.querySelector('#qs-dgo'), '★ 一開始只有一顆按鈕 —— 示範不會自己跳出來');
  ok(!host.querySelector('.qs-demo .say'), '   還沒按就沒有解說（不會先洩題）');

  host.querySelector('#qs-dgo').onclick();
  ok(!!host.querySelector('.qs-demo .say'), '按下去才出現');
  ok(/第 0 步/.test(host.querySelector('.qs-demo .h').textContent), '從第 0 步開始');

  host.querySelector('[data-d="1"]').onclick();
  ok(/第 1 步/.test(host.querySelector('.qs-demo .h').textContent), '★ 按「下一步」走一步');
  /* ★ 格子要跟著示範走 —— 不然畫面在講第 3 步，格子卻停在別的地方。 */
  host.querySelector('[data-d="1"]').onclick();
  host.querySelector('[data-d="1"]').onclick();
  ok(host.querySelectorAll('.qs-cell.cut').length > 0,
     '★ 砍掉的那一半在畫面上劃掉了（' + host.querySelectorAll('.qs-cell.cut').length + ' 格）');

  host.querySelector('[data-d="9"]').onclick();
  ok(/找到了/.test(host.querySelector('.qs-demo .say').textContent), '「一路看完」直接到最後');
  ok(!!host.querySelector('[data-d="0"]'), '   跑完了給「再看一次」');

  host.querySelector('[data-d="-1"]').onclick();
  ok(!!host.querySelector('#qs-dgo'), '★ 關得掉 —— 關掉之後回到「自己試」');
  ok(!host.querySelector('.qs-demo .say'), '   關掉就不佔版面');
  host.remove();
}

section('★ 大比拼那一關不需要示範');
{
  /* 它本來就是一步一步按的 —— 再加一個示範等於同一件事做兩次。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  S.mount(host, { mode: 'compare' });
  ok(!host.querySelector('#qs-dgo'), '★ 大比拼沒有示範按鈕');
  host.remove();
}

/* ── 關卡頁真的接得上 ──────────────────────────────── */
section('★ level.html 接得上');
{
  const src = read('11502/level.html');
  ok(/searchlab\.js/.test(src) && /sortlab\.js/.test(src), '兩支實驗室都載進來了');
  ok(/key:'lab'/.test(src), '步驟列裡有 lab 這一步');
  ok(/lv\.lab && labMod\(lv\.lab\)/.test(src),
     '★ 沒宣告 lab 或模組沒載到就不出現這一步 —— 不留點不動的空步驟');
  const i = src.indexOf("s.key === 'lab'");
  ok(i > 0, '找得到 lab 那一段的畫面');
  /* ⚠️ 取樣範圍要夠寬。原本取 900 字，2026-08-12 在那一段補了
     big:true 的說明之後，onPass 就被推到 900 字之外 ——
     測試變紅，但**程式其實沒壞**。
     ★ 這種「加註解害測試變紅」的假警報最傷：
       下一個人會直接把檢查刪掉，而不是把範圍調寬。 */
  const seg = src.slice(i, i + 2200);
  ok(/onPass/.test(seg), '★ 通過條件交給模組決定（不然模組和關卡頁會各有一套規則）');
  ok(/advance\(\)/.test(seg), '通過之後會往下一步走');

  /* ★ 操作要排在概念檢測前面 —— 題目問的就是他在實驗室看到的事。
     順序反了，他只能猜系統想看什麼字。 */
  const fn = src.slice(src.indexOf('function steps()'), src.indexOf('function stepDone'));
  ok(fn.indexOf("key:'lab'") < fn.indexOf("key:'quiz'"),
     '★ 動手試一次排在概念檢測**前面**');
  ok(fn.indexOf("key:'lab'") < fn.indexOf("key:'blocks'"),
     '   也排在程式拼圖前面');
}

/* ═══════════════════════════════════════════════════════
   2026-08-17 老師試跑第 9 關時回報的兩件事
   ═══════════════════════════════════════════════════════ */

section('★★ 換一題要真的換到不同的資料量');
{
  /* ⚠️ 原本寫死 binary→13、sequential→8。
     所以「換一題」拿到的永遠是 13 項 ——
       · 第一次的中間項**永遠是第 7 項**，學生背位置就好
       · 13 是奇數，(1+13)÷2 = 7 剛好整除
         ⇒ 學生**永遠碰不到**「除不盡取整數部分」，
           而那正是這個公式最容易錯的地方。 */
  const sizes = {};
  for (let k = 0; k < 300; k++) sizes[S._makeCase({ mode: 'binary' }).items.length] = 1;
  const got = Object.keys(sizes).map(Number).sort((a, b) => a - b);
  ok(got.length >= 4, '★★ 二元搜尋的隨機題有多種資料量（' + got.join('、') + '）');
  ok(got.some(n => n % 2 === 0),
     '★★ 而且**有偶數** —— 不然永遠碰不到「除不盡要取整數部分」');
  ok(got.some(n => n % 2 === 1), '   也有奇數');

  /* 第一次的中間項要真的會變 */
  const mids = {};
  for (let k = 0; k < 300; k++) {
    const c = S._makeCase({ mode: 'binary' });
    mids[S._midOf(1, c.items.length)] = 1;
  }
  ok(Object.keys(mids).length >= 3,
     '★★ 第一次的中間項會變（第 ' + Object.keys(mids).sort().join('、') + ' 項）—— ' +
     '固定的話學生背位置就好，不必真的算');

  /* 偶數筆的時候，中間項要是「無條件捨去」那一個 */
  ok(S._midOf(1, 14) === 7, '★★ 14 項 → (1+14)÷2 = 7.5 → 取 7（無條件捨去）');
  ok(S._midOf(1, 12) === 6, '   12 項 → 6.5 → 取 6');
  ok(S._midOf(8, 13) === 10, '   後半段 8～13 → 10.5 → 取 10');

  /* ⚠️ 但課本那一題不可以跟著變 —— 學生要對得回課本 p.208 */
  for (let k = 0; k < 20; k++) {
    const c = S._makeCase({ mode: 'binary', course: 'hit' });
    if (c.items.length !== 13) { ok(false, '★★ 課本題被改成 ' + c.items.length + ' 筆了'); break; }
    if (k === 19) ok(true, '★★ 課本那一題**維持 13 筆**（學生要對得回課本）');
  }
}

section('★★ 三關全過才放行 —— 這件事畫面上要講');
{
  /* ⚠️ 老師實際卡住的地方：自由玩走了三次還是不能往下一步，
     因為放行的開關（onPass）只在挑戰第 3 關答對時才會被扳動 ——
     而畫面上從來沒說過「三關全過才放行」。
     學生只會以為系統壞了，然後一直重玩自由玩那一段。 */
  const src = read('shared/searchlab.js');
  ok(/三關全過.{0,12}下一步/.test(src),
     '★★ 原始碼裡有講明「三關全過才能往下一步」');

  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = S.mount(host, { mode: 'binary', course: 'hit' });
  const walk = () => {
    for (let k = 0; k < 60; k++) {
      const st = sim._state();
      if (st.ended) return;
      if (st.phase === 'side') {
        const w = Number(st.items[st.mid - 1]) < Number(st.target) ? 'right' : 'left';
        host.querySelector('[data-side="' + w + '"]').onclick();
        continue;
      }
      host.querySelectorAll('[data-i]')[Math.floor((st.lo + st.hi) / 2) - 1].onclick();
    }
  };
  walk(); host.querySelector('#qs-new').onclick(); walk();
  ok(/三關全過/.test(host.textContent),
     '★★ 挑戰一打開，畫面上就講明這是通關條件');
  ok(/驗收挑戰 1／3/.test(host.textContent) && /往下一步/.test(host.textContent),
     '★ 標題列也一直帶著這句 —— 中途才進來的人也看得到');
  host.remove();
}

section('★★ 第 3 關要有東西可以推（不是想不出來就卡死）');
{
  ['binary', 'sequential'].forEach(mode => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let badge = null;
    const sim = S.mount(host, { mode: mode, course: 'hit', onPass: b => { badge = b; } });
    const walk = () => {
      for (let k = 0; k < 60; k++) {
        const st = sim._state();
        if (st.ended) return;
        if (mode === 'binary') {
          if (st.phase === 'side') {
            const w = Number(st.items[st.mid - 1]) < Number(st.target) ? 'right' : 'left';
            host.querySelector('[data-side="' + w + '"]').onclick();
            continue;
          }
          host.querySelectorAll('[data-i]')[Math.floor((st.lo + st.hi) / 2) - 1].onclick();
        } else {
          host.querySelectorAll('[data-i]')[st.next].onclick();
        }
      }
    };
    const nextQ = () => host.querySelector('#qs-new').onclick();
    /* 走到第 3 關 */
    walk(); nextQ(); walk(); nextQ();
    const st1 = sim._state();
    host.querySelector('#qs-g').value = S._realCount(mode, st1.items, st1.target);
    host.querySelector('[data-g="1"]').onclick();
    walk();
    nextQ(); walk();
    ok(/驗收挑戰 3／3/.test(host.textContent), mode + '：走到第 3 關');

    ok(!host.querySelector('.qs-aid'),
       '★★ ' + mode + '：一開始**沒有**計數器 —— 先給的話這一題就白出了');

    host.querySelector('#qs-g').value = 99;
    host.querySelector('[data-g="3"]').onclick();
    ok(!!host.querySelector('.qs-aid'),
       '★★ ' + mode + '：答錯一次之後，計數器才長出來');
    ok(/自己按按看|自己數/.test(host.textContent),
       '★ ' + mode + '：而且叫他自己按 —— 不是把答案印給他看');

    /* ★★ 工具數出來的，一定要和標準答案一樣。
       對不起來的話比沒有工具更糟：他照著數還是被判錯。 */
    const want = S.TESTS[mode].worstAns(S.TESTS[mode].worstSize);
    let taps = 0;
    for (let k = 0; k < 40; k++) {
      const b = host.querySelector('[data-aid="go"]');
      if (!b || b.disabled) break;
      b.onclick(); taps++;
    }
    ok(taps === want,
       '★★ ' + mode + '：一直按到範圍空掉 = ' + taps + ' 次，' +
       '和標準答案 ' + want + ' **一模一樣**');
    ok(/你按了/.test(host.textContent), '   而且直接報出按了幾次');

    host.querySelector('[data-aid="rst"]').onclick();
    ok(/還剩 /.test(host.textContent), '★ 「重來」把計數器歸零，可以再數一次');

    ok(badge === null, '   數完還是要自己填答案（不會自動過關）');
    host.querySelector('#qs-g').value = want;
    host.querySelector('[data-g="3"]').onclick();
    is(badge, 3, '★★ ' + mode + '：填對 → 三關全過，放行');
    host.remove();
  });
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
