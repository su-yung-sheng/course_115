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
     而畫面上它看起來只是「少一塊」。 */
  const noStep = JSON.parse(JSON.stringify(got));
  noStep[2].children = noStep[2].children.filter(n => n.id !== 'list.changeidx');
  ok(!B._same(noStep, lv.goal, lv.loose || []),
     '★ 漏掉「位置改變 1」→ 判錯（那是無窮迴圈）');

  /* 位置加 1 放到迴圈外面 —— 同樣是停在第 1 項 */
  const outside = JSON.parse(JSON.stringify(got));
  const moved = outside[2].children.pop();
  outside.push(moved);
  ok(!B._same(outside, lv.goal, lv.loose || []),
     '★ 把「位置改變 1」搬到迴圈外面 → 判錯');

  /* 起點不是 1 */
  const from0 = JSON.parse(JSON.stringify(got));
  from0[1].args[1] = 0;
  ok(!B._same(from0, lv.goal, lv.loose || []), '   起點不是第 1 項 → 判錯');

  /* 誘餌要在調色盤上，而且不可以混進答案 */
  const used = new Set();
  (function w(l) { (l || []).forEach(n => { used.add(n.id);
    (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
    w(n.children); w(n.children2); }); })(lv.goal);
  ['control.repeat', 'control.repeatlen', 'control.ifless'].forEach(id => {
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
     而畫面上它看起來只是「少一小塊」。 */
  const noElse = JSON.parse(JSON.stringify(got));
  noElse[3].children[1].children2 = [];
  ok(!B._same(noElse, lv.goal, lv.loose || []),
     '★★ 「否則」那格空著 → 判錯（另外那一半永遠砍不掉，範圍不動＝無窮迴圈）');

  /* 兩邊放反：該右移的時候左移 —— 目標被砍掉，永遠找不到 */
  const swap = JSON.parse(JSON.stringify(got));
  const ie = swap[3].children[1];
  const t = ie.children; ie.children = ie.children2; ie.children2 = t;
  ok(!B._same(swap, lv.goal, lv.loose || []),
     '★ 開始位置與結束位置的調整放反 → 判錯（等於每次都砍掉有目標的那一半）');

  /* 算二分位置放到迴圈外面：範圍變了中間點卻不重算 */
  const outside = JSON.parse(JSON.stringify(got));
  const mid = outside[3].children.shift();
  outside.splice(3, 0, mid);
  ok(!B._same(outside, lv.goal, lv.loose || []),
     '★ 「算二分位置」搬到迴圈外面 → 判錯（範圍變了卻不重算，永遠指同一格）');

  /* 結束位置寫死成 13 —— 換一組資料就不能用 */
  const hard = JSON.parse(JSON.stringify(got));
  hard[2] = { uid: 'x', id: 'list.setidx', args: ['結束位置', 13], children: null, children2: null };
  ok(!B._same(hard, lv.goal, lv.loose || []),
     '   結束位置打死 13（不用清單長度）→ 判錯');

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

  /* 兩關的用詞要一致 —— 學生是連著上的。 */
  ok(/開始位置/.test(JSON.stringify(lv)) && /結束位置/.test(JSON.stringify(lv)) &&
     /二分位置/.test(JSON.stringify(lv)),
     '★ 用詞照課本（開始位置／結束位置／二分位置）—— 學生回課本 p.208 要對得起來');
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
  const sim = S.mount(host, { mode: 'compare', onPass: () => { done++; } });
  const size = n => host.querySelector('[data-size="' + n + '"]').onclick();
  const cutBtn = () => host.querySelector('[data-cut]');

  ok(!!size, '四個資料量的按鈕都畫出來了');
  is(S.SIZES, [13, 50, 100, 1024], '★ 資料量含課本習題問過的 50 與 1024');

  S.SIZES.forEach(n => {
    size(n);
    let guard = 0;
    while (cutBtn() && guard++ < 60) cutBtn().onclick();
    is(sim._state().table[n], S._worstBinary(n),
       n + ' 筆：學生按了 ' + sim._state().table[n] + ' 下，和算出來的一樣');
    if (n !== 1024) is(done, 0, '   還沒跑完全部 → 不放行');
  });
  is(done, 1, '★ 四種都跑完 → 放行');
  is(host.querySelectorAll('.qs-tbl tr').length - 1, 4, '對照表累積了四列');
  ok(/1024/.test(host.querySelector('.qs-tbl').textContent) &&
     /11/.test(host.querySelector('.qs-tbl').textContent),
     '★ 表格上看得到 1024 對 11 —— 那個對比不必解釋');
  host.remove();
}
{
  /* ⚠️ 只跑最小的那一個不可以就放行。
     13 筆是 13 對 4 —— 差距不夠大，學生會覺得「好像也沒差多少」，
     而那正好是這一關要打掉的錯覺。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  let done = 0;
  S.mount(host, { mode: 'compare', onPass: () => { done++; } });
  host.querySelector('[data-size="13"]').onclick();
  let guard = 0;
  while (host.querySelector('[data-cut]') && guard++ < 60) host.querySelector('[data-cut]').onclick();
  is(done, 0, '★ 只跑 13 筆 → 不放行（差距不夠大，看不出重點）');
  ok(/還有/.test(host.querySelector('.qs-msg').innerHTML), '   而且要講還差哪幾個');
  host.remove();
}

section('★ 第 10 關（6-3-3）的關卡資料');
{
  const lv = L['6-3-3'];
  ok(!!lv, '關卡存在');
  is(lv.lab, { kind: 'search', mode: 'compare' }, '★ 宣告了 compare 的 lab');
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

  /* ★★ 這一關拼圖唯一的新東西：迴圈的停止條件有兩個。
     換成第 8 關那個只有一個條件的版本 → 找不到時無窮迴圈。 */
  const oneCond = JSON.parse(JSON.stringify(got));
  oneCond[4].id = 'control.until';
  ok(!B._same(oneCond, lv.goal, lv.loose || []),
     '★★ 換成第 8 關那個只有一個條件的「重複直到找到目標」→ 判錯' +
     '（找不到時位置會一直加下去，讀到不存在的項目）');

  /* 「否則」空著 → 位置永遠停在第 1 項 */
  const noElse = JSON.parse(JSON.stringify(got));
  noElse[4].children[0].children2 = [];
  ok(!B._same(noElse, lv.goal, lv.loose || []),
     '★ 「否則」那格空著 → 判錯（位置永遠停在第 1 項）');

  /* 沒把答案存起來 → 下一次詢問就蓋掉了 */
  const noSave = got.filter(n => n.id !== 'list.settarget');
  ok(!B._same(noSave, lv.goal, lv.loose || []), '   少了「目標資料 設為 詢問的答案」→ 判錯');

  ['control.until', 'control.if', 'list.setmid', 'list.tolo'].forEach(id => {
    ok(lv.palette.indexOf(id) >= 0, '★ 調色盤上有誘餌 ' + id);
  });
  const used = new Set();
  (function w(l) { (l || []).forEach(n => { used.add(n.id);
    (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
    w(n.children); w(n.children2); }); })(lv.goal);
  ok(!used.has('control.until'),
     '★ 只有一個條件的那一塊沒有混進答案 —— 它是這一關最關鍵的誘餌');
  ok(!used.has('list.setmid') && !used.has('list.tolo'),
     '   第 9 關的二元搜尋積木沒有混進來（這裡的資料沒排序）');
  ok(lv.palette.filter(id => !B.DEFS[id]).length === 0, '調色盤沒有不存在的積木');
  ok([...used].filter(id => lv.palette.indexOf(id) < 0).length === 0, '答案要的積木都給了');
}

section('★ 第 8 關留的洞，第 10 關要補起來');
{
  /* ⚠️ 第 8 關的 tips 最後一條白紙黑字寫著「回到真的 Scratch 時，
     『重複直到』要再加一個條件」。那句話如果沒有下文，
     就是一個開了不收的口 —— 學生讀到會以為自己漏學了什麼。 */
  const l8 = JSON.stringify(L['6-3-1'].tips);
  const l10 = JSON.stringify(L['6-3-3']);
  ok(/再加一個條件|超過清單長度/.test(l8), '第 8 關有留下那句伏筆');
  ok(/兩個/.test(l10) && /超過/.test(l10),
     '★ 第 10 關真的把它補起來了（講到「兩個條件」與「超過長度」）');
  ok(/流程圖/.test(l10), '   而且指回課本的流程圖，讓學生對得起來');
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

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
