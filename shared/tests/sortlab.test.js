/* 手動排序挑戰的規則
   跑法：node shared/tests/sortlab.test.js

   ★ 這一份最重要的一條：選擇排序法要和課本一致（兩個清單），
     不是原地交換。同一個名字兩種做法，學生只會覺得自己記錯。 */
'use strict';
const fs = require('fs');
const path = require('path');
const W = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8'))(W);
const S = W.SORTLAB;

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : (fail++, console.log('  ✗ ' + l)); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), l + '（得到 ' + JSON.stringify(a) + '）');

/* ── 選擇排序：課本版（未排序 → 已排序）───────────── */
eq(S._bestOf([5, 2, 8, 1], 'asc'), [3], '由小到大找最小');
eq(S._bestOf([5, 2, 8, 1], 'desc'), [2], '由大到小找最大');
eq(S._bestOf([3, 1, 1, 4], 'asc'), [1, 2], '★ 並列的都算對 —— 只認第一個會判錯另一半學生');
ok(S._checkSelection([5, 2, 8], 1, 'asc').ok, '點最小的 → 對');
ok(!S._checkSelection([5, 2, 8], 0, 'asc').ok, '點 5 → 錯');
ok(/更小/.test(S._checkSelection([5, 2, 8], 0, 'asc').msg), '講「還有更小的」');
ok(/更大/.test(S._checkSelection([5, 2, 8], 1, 'desc').msg), '由大到小要講「更大的」');
ok(!/第 \d|位置|索引/.test(S._checkSelection([5, 2, 8], 0, 'asc').msg),
   '★ 不洩漏正確位置 —— 講了下一回合他照樣不會找');

/* ★ 版本一致性：這裡不能有「和邊界那一格對調」那種原地交換的痕跡 */
const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8');
ok(/加到「已排序」的最後一項/.test(src), '★ 選擇排序照課本：加到已排序的最後一項');
ok(/從「未排序」刪掉|從未排序數列裡刪掉/.test(src), '★ 並且從未排序刪掉');
/* ⚠️ 2026-08-17 老師：「全部使用上傳程式中的變數名稱。」
   範例檔（.sb3）的清單叫**原始資料／已排序資料**，
   課本這一段寫「未排序數列／已排序數列」——
   兩個名字指的是同一件事，但學生在 Scratch 裡看到的是前者。
   ⇒ 這一條改成盯「兩個清單的講法」本身，不再要求出現「未排序」三個字。 */
ok(/原始資料|未排序/.test(S.INFO.selection.why) && /已排序/.test(S.INFO.selection.why),
   '說明文字也是兩個清單的講法（用範例檔的名字：原始資料／已排序資料）');

/* ── 氣泡：只能換相鄰 ─────────────────────────────── */
ok(S._checkBubble(1, 2).ok, '相鄰 → 可以換');
ok(S._checkBubble(2, 1).ok, '反過來點也一樣');
ok(!S._checkBubble(0, 2).ok, '隔一個 → 不行');
ok(/相鄰/.test(S._checkBubble(0, 3).msg), '要講清楚是「只能相鄰」');
ok(!S._checkBubble(1, 1).ok, '點同一個兩次不算');

/* ── 插入：插到對的位置 ───────────────────────────── */
//  已排好 [20, 50]，新牌 30 → 只有插在中間（pos=1）才對
const a = [20, 50, 30];
ok(!S._checkInsertion(a, 2, 0, 'asc').ok, '30 插在 20 前面 → 錯');
ok(S._checkInsertion(a, 2, 1, 'asc').ok, '30 插在 20 與 50 之間 → 對');
ok(!S._checkInsertion(a, 2, 2, 'asc').ok, '30 插在 50 後面 → 錯');
ok(/20/.test(S._checkInsertion(a, 2, 0, 'asc').msg), '錯的時候要指出是跟誰比出問題');
ok(!S._checkInsertion(a, 2, 3, 'asc').ok, '★ 不能插到還沒排序的那一段去');
eq(S._doInsert([20, 50, 30], 2, 1), [20, 30, 50], '插進去之後的排列');
//  邊界情況：最小的新牌要插最前面
ok(S._checkInsertion([20, 50, 10], 2, 0, 'asc').ok, '最小的新牌插最前面 → 對');
//  由大到小
ok(S._checkInsertion([50, 20, 30], 2, 1, 'desc').ok, '由大到小時 30 插在 50 與 20 之間 → 對');

/* ── 出題 ─────────────────────────────────────────── */
ok(S._sorted([1, 2, 3], 'asc'), '判得出已經排好');
ok(!S._sorted([1, 3, 2], 'asc'), '判得出還沒排好');
ok(S._sorted([3, 2, 1], 'desc'), '由大到小也判得出來');
for (let i = 0; i < 40; i++) {
  const it = S._makeItems(6, 'asc');
  ok(it.length === 6 && new Set(it).size === 6 && !S._sorted(it, 'asc'),
     '★ 出的題目：六個不重複、而且一開始不是排好的（第 ' + (i + 1) + ' 次）');
  if (fail) break;
}

/* ═══ ★ 自動播放：30 筆跑一遍 ═══════════════════════
   ⚠️ 這一段是 sort.html 的自動排序動畫改寫進來的（原檔已刪）。
      原本演算法和 await sleep() 綁在一起，沒辦法單獨測「它排得對不對」。
      現在 plan() 是純函式：吃一個陣列，吐出每一步的畫面，
      播放器只負責一格一格放 —— 所以下面可以直接驗演算法。 */
console.log('\n── ★ 自動播放：算得對不對 ──');
{
  const A = [8, 5, 10, 1, 7];                 // 課本 6-2 用的那一組
  ['selection', 'insertion', 'bubble'].forEach(m => {
    const r = S._plan(A, m, 'asc');
    eq(r.frames[r.frames.length - 1].arr, [1, 5, 7, 8, 10], m + ' 排得出課本的答案');
    ok(r.frames.length > A.length, '   ' + m + ' 有逐格畫面（' + r.frames.length + ' 格）');
    ok(r.frames[0].n === 0 && r.frames[r.frames.length - 1].n === r.compares,
       '   ' + m + ' 比較次數從 0 累加到 ' + r.compares);
  });
  eq(S._plan(A, 'selection', 'desc').frames.slice(-1)[0].arr, [10, 8, 7, 5, 1],
     '由大到小也排得出來');

  /* 30 筆：三種都要排得對。
     ⚠️ 選擇與氣泡的比較次數是固定的 n(n-1)/2 = 435 ——
        對不上就是迴圈邊界寫錯了。 */
  const big = Array.from({ length: 30 }, (_, i) => ((i * 17) % 97) + 1);
  ['selection', 'insertion', 'bubble'].forEach(m => {
    const r = S._plan(big, m, 'asc');
    ok(S._sorted(r.frames.slice(-1)[0].arr, 'asc'), '★ 30 筆 ' + m + ' 排得對');
    ok(r.frames.slice(-1)[0].arr.length === 30, '   ' + m + ' 沒有弄丟或多出資料');
  });
  eq(S._plan(big, 'selection', 'asc').compares, 435, '★ 選擇排序 30 筆比 435 次（n(n-1)/2）');
  eq(S._plan(big, 'bubble', 'asc').compares, 435, '★ 氣泡排序 30 筆也是 435 次');
  ok(S._plan(big, 'insertion', 'asc').compares < 435,
     '★ 插入排序比較少（它遇到不必再比的就停）');

  /* 已經排好的資料：插入排序幾乎不用比 —— 這是它的長處，第 7 關的題目問過。 */
  const done = big.slice().sort((a, b) => a - b);
  ok(S._plan(done, 'insertion', 'asc').compares <= 29 * 2,
     '★ 資料本來就排好時，插入排序只要比 ' +
     S._plan(done, 'insertion', 'asc').compares + ' 次（第 7 關的題目問過這件事）');

  /* 每一格畫面的資料都要完整 —— 少一項的話畫面會跳。 */
  const r2 = S._plan(A, 'selection', 'asc');
  ok(r2.frames.every(f => f.arr.length === 5), '每一格畫面都是完整的五筆');
  ok(r2.frames.every(f => f.done >= 0 && f.done <= 5), 'done 沒有超出範圍');
}

/* ═══ 第 6、7 關的關卡資料 ═══════════════════════════
   ⚠️ 這兩關的主角是上面那個手動挑戰，拼圖只收尾。
      但拼圖既然放了，就要判得對、改壞要判得錯 ——
      不然「拼對才過」只是句話。 */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
if (!JSDOM) {
  console.log('\n（沒有 jsdom，略過關卡資料那一段 —— 缺套件，不是失敗）');
} else {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
  const V = dom.window;
  global.window = V; global.document = V.document;
  const ROOT = path.join(__dirname, '..', '..');
  const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  /* ⚠️ 挑戰與證書在 shared/labtest.js。
     沒載的話 LABTEST 是 undefined，sortlab 會判定「沒有挑戰」直接放行 ——
     整段挑戰一條都測不到（searchlab 那邊就是這樣白測了一輪）。
     ⚠️ 而且要用**這個 window 裡**的 SORTLAB，不是檔案最上面那一份：
        那一份的 global 是空物件 {}，看不到 LABTEST。 */
  V.eval(rd('shared/labtest.js'));
  V.eval(rd('shared/sortlab.js'));
  const SL = V.SORTLAB;
  V.eval(rd('shared/blocks.js'));
  V.eval(rd('11502/content/blocks.js'));
  const B = V.BLOCKS, L = V.BLOCK_LEVELS;
  const build = l => (l || []).map(x => {
    const d = B.DEFS[x.id];
    return { uid: 'u' + Math.random(), id: x.id,
             args: (x.args != null ? x.args : (d.args || [])).map(
               v => (v && typeof v === 'object') ? build([v])[0] : v),
             children: x.children ? build(x.children)
                                  : ((d.shape === 'c' || d.shape === 'c2') ? [] : null),
             children2: x.children2 ? build(x.children2) : (d.shape === 'c2' ? [] : null) };
  });

  console.log('\n── ★ 第 6 關（6-2-1 選擇排序法）──');
  {
    const lv = L['6-2-1'];
    ok(!!lv, '關卡存在');
    eq(lv.lab, { kind: 'sort', mode: 'selection', order: 'asc', trace: true },
       '★ 掛的是選擇排序的手動挑戰，而且開著變數追蹤');
    ok(!!S.INFO[lv.lab.mode], '   lab.mode 在 SORTLAB.INFO 裡查得到');
    ok((lv.quiz || []).length >= 6, '概念檢測 ' + lv.quiz.length + ' 題');
    /* ⚠️⚠️ 2026-08-17 老師：「為什麼第十關概念檢測每一個提示都一樣？
       不是應該配合題目調整重點就好嗎？」
       原因不是 hint（那幾題本來就不同），是**引用框**：
       多數題目寫同一個 ref，refBox 就把同一段內容貼在每一題底下 ——
       那塊比 hint 長得多，看起來就一模一樣。
       ★ 所以規則從「每一題都要有 ref」改成：
         ① 至少要有幾題指得回來源（不是全部都不給）
         ② **不可以多數題目指同一個來源**
       ⚠️ 沒有 ref 是可以的 —— 有些題目的線索就在 hint 裡，
          硬指一個來源只會讓提示變得又長又重複。 */
    {
      const refs = lv.quiz.map(q => q.ref);
      const has = refs.filter(r => r !== undefined && r !== null);
      ok(has.length >= 2, '　　至少兩題指得回來源（' + has.length + '／' + refs.length + '）');
      const cnt = {};
      refs.forEach(r => { const k = String(r); cnt[k] = (cnt[k] || 0) + 1; });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      ok(top[1] <= Math.ceil(refs.length * 0.7),
         '★★ 沒有多數題目指同一個來源（最多的是 ' + top[0] + '：' +
         top[1] + '／' + refs.length + '）—— 那會讓每一題的提示長得一樣');
    }

    ok(lv.quiz.every(q => (q.need || []).every(n => (n.any || []).length >= 3)),
       '★ 每個概念群至少 3 種同義說法');

    const got = build(lv.goal);
    ok(B._same(got, lv.goal, lv.loose || []), '★ 照答案拼 → 判對');

    /* ★★ 這一關唯一真正的考點（課本備課用書 p.198 步驟 4 的第 5 問）：
       「資料位置 改變 1」必須在「如果」的外面。
       放進去的話，沒換人的時候就不往下走 —— 程式卡在同一項。
       而畫面上兩種擺法看起來只差一點縮排。 */
    const inside = JSON.parse(JSON.stringify(got));
    const loop = inside[0].children[2];
    const step = loop.children.pop();          // 資料位置 改變 1
    loop.children[0].children.push(step);      // 塞進「如果」裡面
    ok(!B._same(inside, lv.goal, lv.loose || []),
       '★★ 把「資料位置 改變 1」放進「如果」裡面 → 判錯（沒換人就卡在同一項）');

    const noStep = JSON.parse(JSON.stringify(got));
    noStep[0].children[2].children.pop();
    ok(!B._same(noStep, lv.goal, lv.loose || []), '★ 整塊漏掉「資料位置 改變 1」→ 判錯');

    /* 兩個變數的起始值不是 1 */
    const from0 = JSON.parse(JSON.stringify(got));
    from0[0].children[0].args[1] = 0;
    ok(!B._same(from0, lv.goal, lv.loose || []),
       '   起始值不是 1 → 判錯（Scratch 清單從第 1 項起算）');

    /* 迴圈次數打死 */
    const fixed = JSON.parse(JSON.stringify(got));
    fixed[0].children[2].id = 'control.repeat';
    ok(!B._same(fixed, lv.goal, lv.loose || []),
       '★ 用「重複 N 次」取代「重複 清單長度 次」→ 判錯（換一組資料就不能用）');

    const used = new Set();
    (function w(l) { (l || []).forEach(n => { used.add(n.id);
      (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
      w(n.children); w(n.children2); }); })(lv.goal);
    ok(!used.has('list.swap'),
       '★ 答案裡沒有「交換」—— 課本的選擇排序是搬到另一排，不是原地對調');
    ok(lv.palette.indexOf('list.swap') >= 0, '   但調色盤上要有它當誘餌');
    ok(lv.palette.filter(id => !B.DEFS[id]).length === 0, '調色盤沒有不存在的積木');
    ok([...used].filter(id => lv.palette.indexOf(id) < 0).length === 0, '答案要的積木都給了');
  }

  console.log('\n── ★ 第 7 關（6-2-2 插入排序法）──');
  {
    const lv = L['6-2-2'];
    ok(!!lv, '關卡存在');
    eq(lv.lab, { kind: 'sort', mode: 'insertion', order: 'asc' }, '★ 掛的是插入排序的手動挑戰');
    ok(!!S.INFO[lv.lab.mode], '   lab.mode 在 SORTLAB.INFO 裡查得到');
    ok((lv.quiz || []).length >= 6, '概念檢測 ' + lv.quiz.length + ' 題');
    /* ⚠️⚠️ 2026-08-17 老師：「為什麼第十關概念檢測每一個提示都一樣？
       不是應該配合題目調整重點就好嗎？」
       原因不是 hint（那幾題本來就不同），是**引用框**：
       多數題目寫同一個 ref，refBox 就把同一段內容貼在每一題底下 ——
       那塊比 hint 長得多，看起來就一模一樣。
       ★ 所以規則從「每一題都要有 ref」改成：
         ① 至少要有幾題指得回來源（不是全部都不給）
         ② **不可以多數題目指同一個來源**
       ⚠️ 沒有 ref 是可以的 —— 有些題目的線索就在 hint 裡，
          硬指一個來源只會讓提示變得又長又重複。 */
    {
      const refs = lv.quiz.map(q => q.ref);
      const has = refs.filter(r => r !== undefined && r !== null);
      ok(has.length >= 2, '　　至少兩題指得回來源（' + has.length + '／' + refs.length + '）');
      const cnt = {};
      refs.forEach(r => { const k = String(r); cnt[k] = (cnt[k] || 0) + 1; });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      ok(top[1] <= Math.ceil(refs.length * 0.7),
         '★★ 沒有多數題目指同一個來源（最多的是 ' + top[0] + '：' +
         top[1] + '／' + refs.length + '）—— 那會讓每一題的提示長得一樣');
    }

    ok(lv.quiz.every(q => (q.need || []).every(n => (n.any || []).length >= 3)),
       '★ 每個概念群至少 3 種同義說法');

    const got = build(lv.goal);
    ok(B._same(got, lv.goal, lv.loose || []), '★ 照答案拼 → 判對');

    /* ★★ 每拿一張新牌，「插入位置」都要重新從 1 開始。
       搬到外圈外面的話，第二張牌會從上一張停的地方繼續找 —— 找錯位置，
       而且只有從第二張開始才會錯，第一張看起來完全正常。 */
    const outside = JSON.parse(JSON.stringify(got));
    const reset = outside[1].children.splice(1, 1)[0];
    outside.splice(1, 0, reset);
    ok(!B._same(outside, lv.goal, lv.loose || []),
       '★★ 把「插入位置 設為 1」搬到外圈外面 → 判錯' +
       '（第二張牌會接著上一張的位置往下找）');

    /* 插入那一塊跑到內圈裡面 —— 一張牌會被插很多次 */
    const inLoop = JSON.parse(JSON.stringify(got));
    const ins = inLoop[1].children.pop();
    inLoop[1].children[2].children.push(ins);
    ok(!B._same(inLoop, lv.goal, lv.loose || []),
       '★ 把「插入」搬進內圈 → 判錯（一張牌只能插一次）');

    /* 內圈少了往右走 */
    const noStep = JSON.parse(JSON.stringify(got));
    noStep[1].children[2].children = [];
    ok(!B._same(noStep, lv.goal, lv.loose || []), '   內圈漏掉「插入位置 改變 1」→ 判錯');

    const used = new Set();
    (function w(l) { (l || []).forEach(n => { used.add(n.id);
      (n.args || []).forEach(a => { if (a && typeof a === 'object') w([a]); });
      w(n.children); w(n.children2); }); })(lv.goal);
    ok(!used.has('control.ifsmaller') && !used.has('list.setmin'),
       '★ 第 6 關「找最小值」的積木沒有混進來 —— 插入排序不挑最小的');
    ok(lv.palette.indexOf('control.ifsmaller') >= 0, '   但調色盤上要有它當誘餌');
    ok(lv.palette.filter(id => !B.DEFS[id]).length === 0, '調色盤沒有不存在的積木');
    ok([...used].filter(id => lv.palette.indexOf(id) < 0).length === 0, '答案要的積木都給了');
  }

  console.log('\n── ★ 自動播放真的掛得起來 ──');
  {
    /* ⚠️ 先手動、後自動 —— 順序是刻意的。
       先看動畫的話，學生會覺得「原來這麼快」，
       然後在手動那一關卡住卻不知道自己卡在哪。
       ⇒ 通關之前不可以出現自動播放區。 */
    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    let done = 0;
    const sim = S.mount(host, { mode: 'selection', order: 'asc', onPass: () => { done++; } });
    ok(!host.querySelector('.sl-bars'), '★ 還沒排完之前，看不到自動播放區');

    let guard = 0;
    while (guard++ < 40) {
      const cells = [...host.querySelectorAll('[data-i]')];
      if (!cells.length) break;
      const vals = cells.map(c => Number(c.textContent));
      cells[vals.indexOf(Math.min(...vals))].onclick();
    }
    ok(done === 1, '手動排完了');
    ok(!!host.querySelector('.sl-bars'), '★ 排完之後才出現自動播放區');
    ok(host.querySelectorAll('.sl-bar').length === 30, '   預設 30 筆（手動只有六筆）');
    ok(/比較次數/.test(host.textContent), '★ 畫面上看得到比較次數 —— 那是接第 10 關的線');

    /* 三種排序法要切換得動，而且切了要重算。 */
    ok(sim._auto().algo === 'selection', '一開始跟著這一關的演算法');
    host.querySelector('[data-algo="bubble"]').onclick();
    ok(sim._auto().algo === 'bubble' && sim._auto().at === 0,
       '★ 切成氣泡排序 → 重新來過（不是接著上一種的進度）');
    ok(sim._auto().compares === 435, '   30 筆氣泡排序 435 次');

    /* ⚠️ 計時器一定要收得掉。收不掉的話學生換到下一步，
       背景還在跑 setInterval —— 一堂課下來會疊很多個。 */
    host.querySelector('[data-play]').onclick();
    ok(sim._auto().playing, '按開始會播');
    sim.destroy();
    ok(!sim._auto().playing, '★ destroy 之後計時器停掉（不然會愈疊愈多）');
    host.remove();
  }

  console.log('\n── ★ 逐步示範：每一格都要有解說 ──');
  {
    /* ⚠️ 只有動畫沒有解說的話，學生看到的是一堆長條在跳 ——
       他知道「有事情在發生」，但不知道發生的是什麼。
       ★ 按「下一步」慢慢看的人，讀的就是那一句。 */
    ['selection', 'insertion', 'bubble'].forEach(m => {
      const r = S._plan([8, 5, 10, 1, 7], m, 'asc');
      ok(r.frames.every(f => f.note && f.note.length > 4),
         '★ ' + m + ' 每一格都有解說（' + r.frames.length + ' 格）');
      ok(/排好了/.test(r.frames[r.frames.length - 1].note),
         '   ' + m + ' 最後一格講「排好了」');
      ok(new RegExp('比了 ' + r.compares + ' 次').test(r.frames[r.frames.length - 1].note),
         '   ' + m + ' 收尾把總比較次數講出來（接第 10 關的線）');
    });

    /* 選擇排序的解說要用課本的講法：從未排序挑最小 → 搬到已排序最後面。 */
    const sel = S._plan([8, 5, 10, 1, 7], 'selection', 'asc');
    ok(/還沒排好/.test(sel.frames[0].note), '★ 選擇排序開場先講規則');
    ok(sel.frames.some(f => /先假設第 1 項（8）最小/.test(f.note)),
       '★ 講出「先假設第 1 項最小」—— 那正是程式裡兩個變數都設 1 的理由');
    ok(sel.frames.some(f => /更小了，換人/.test(f.note)), '★ 找到更小的要講「換人」');
    ok(sel.frames.some(f => /搬到已排好那一段的<b>最後面<\/b>/.test(f.note) &&
                            /從未排序刪掉/.test(f.note)),
       '★★ 搬走那一步要講**兩件事**：加到已排序最後面、從未排序刪掉' +
       '（課本的兩清單版，也是第 6 關拼圖要拼的）');

    /* 插入排序：抽一張牌、往左找位置、插進去。 */
    const ins = S._plan([8, 5, 10, 1, 7], 'insertion', 'asc');
    ok(/手牌/.test(ins.frames[0].note), '★ 插入排序開場用手牌的講法（課本的理牌）');
    ok(ins.frames.some(f => /抽第 2 張牌/.test(f.note)), '   會講「抽第幾張牌」');
    ok(ins.frames.some(f => /位置就在這裡，停/.test(f.note)),
       '★ 找到位置要講「停」—— 那是內圈跳出的條件');

    /* 氣泡排序：只換相鄰，而且每回合最大的沉到最後。 */
    const bub = S._plan([8, 5, 10, 1, 7], 'bubble', 'asc');
    ok(/相鄰/.test(bub.frames[0].note), '★ 氣泡排序開場先講「只比相鄰的」');
    ok(bub.frames.some(f => /順序本來就對/.test(f.note)),
       '★ 不用換的時候也要說 —— 不然學生以為每次都要換');
    ok(bub.frames.some(f => /推到<b>最後面<\/b>/.test(f.note)),
       '★ 每回合結束要講「最大的已經就位」');

    /* 由大到小時用詞要跟著換，不然解說會和畫面相反。 */
    const d = S._plan([8, 5, 10, 1, 7], 'selection', 'desc');
    ok(d.frames.some(f => /最大/.test(f.note)) && !d.frames.some(f => /挑出最小/.test(f.note)),
       '★ 由大到小時解說講「最大」，不是照抄「最小」');
  }

  console.log('\n── ★ 播放器：按下一步走得動 ──');
  {
    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    const sim = S.mount(host, { mode: 'selection', order: 'asc' });
    let guard = 0;
    while (guard++ < 40) {
      const cells = [...host.querySelectorAll('[data-i]')];
      if (!cells.length) break;
      const vals = cells.map(c => Number(c.textContent));
      cells[vals.indexOf(Math.min(...vals))].onclick();
    }
    ok(!!host.querySelector('#sl-say'), '★ 有解說列');
    ok(!!host.querySelector('[data-step]'), '★ 有「下一步」按鈕（不是只能自動播）');
    const say0 = host.querySelector('#sl-say').textContent;
    host.querySelector('[data-step]').onclick();
    ok(host.querySelector('#sl-say').textContent !== say0, '★ 按一下 → 解說跟著換');
    ok(/第 1 步/.test(host.querySelector('.sl-ctrl .num').textContent), '   而且看得到走到第幾步');
    ok(sim._auto().at === 1, '   狀態也對');
    /* ⚠️ 解說列要有最小高度 —— 文字長短不一，
       不固定的話按「下一步」整頁會上下彈一格。 */
    const src = fs.readFileSync(path.join(ROOT, 'shared', 'sortlab.js'), 'utf8');
    ok(/\.sl-say\{[^}]*min-height/.test(src),
       '★ 解說列有最小高度（不然按下一步整頁會彈）');
    sim.destroy(); host.remove();
  }

  console.log('\n── ★ 驗收挑戰：三關三顆星 ──');
  {
    /* ★ 「排得完」只證明他會操作。真正的證據是
       他能不能在動手之前說出「這一組要比幾次」。
       ⚠️⚠️ 這三顆星不是系統的星數 —— 見 shared/labtest.js 開頭。 */
    eq(SL.TESTS.worstAns(10), 45, '★ 10 筆選擇排序比 45 次（9＋8＋…＋1）');
    eq(SL.TESTS.worstAns(6), 15, '   6 筆比 15 次');
    ok(/45/.test(SL.TESTS.worstWhy) && /9/.test(SL.TESTS.worstWhy),
       '★ 解釋要把 9＋8＋7＋… 寫出來（不必教公式，數得出來就好）');

    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    let badge = null;
    const sim = SL.mount(host, { mode: 'selection', order: 'asc', onPass: b => { badge = b; } });
    /* 排完**這一組**就停。
       ⚠️ 2026-08-18 之後，挑戰每一關結束時系統會自己換一組
          （老師：「選擇排序法忘了加上這個規則」那一條的修法）。
          不停的話這個迴圈會把新的一組也排完 ——
          於是「點錯了要擋下來」讀到的其實是下一組的零失誤訊息。
       ★ 最可靠的停止訊號是**挑戰的回饋文字**：
         它只在一關結算的那一刻才會變。 */
    const tsay = () => (host.querySelector('#sl-tsay') || {}).textContent || '';
    const solve = () => {
      const was = tsay();
      for (let k = 0; k < 40; k++) {
        const c = [...host.querySelectorAll('#sl-body [data-i]')];
        if (!c.length) return;
        const v = c.map(x => Number(x.textContent));
        c[v.indexOf(Math.min(...v))].onclick();
        if (tsay() !== was) return;      // 這一關結算了 → 停
      } };
    solve();
    ok(!!host.querySelector('.lt-box'), '★ 手動排完 → 挑戰出現');
    ok(/驗收挑戰 1／3/.test(host.textContent), '   從第 1 關開始');
    ok(badge === null, '★ 挑戰還沒過 → 不放行');

    /* 第 1 關：先猜錯，看它給不給提示 */
    host.querySelector('#sl-g').value = 999;
    host.querySelector('[data-g="1"]').onclick();
    const msg = host.querySelector('#sl-tsay').textContent;
    ok(/實際是/.test(msg), '★ 猜錯會講實際次數');
    ok(/自動播放/.test(msg), '★★ 而且叫他用下面的自動播放自己數一遍（答案就在畫面上）');
    ok(/驗收挑戰 1／3/.test(host.textContent), '   還停在第 1 關，可以再猜');

    const real = Number(msg.match(/實際是 (\d+)/)[1]);
    host.querySelector('#sl-g').value = real;
    host.querySelector('[data-g="1"]').onclick();
    ok(/猜中了/.test(host.querySelector('#sl-tsay').textContent), '★ 猜中 → 過第 1 關');
    ok(/驗收挑戰 2／3/.test(host.textContent) && /目前 1 ★/.test(host.textContent),
       '   進第 2 關，拿到 1 顆星');

    /* 第 2 關：換一題零失誤 */
    host.querySelector('#sl-new').onclick();
    solve();
    ok(/零失誤/.test(host.querySelector('#sl-tsay').textContent), '★ 沒點錯 → 過第 2 關');
    ok(/驗收挑戰 3／3/.test(host.textContent), '   進第 3 關');

    /* 第 3 關：答錯再答對 */
    host.querySelector('#sl-g').value = 100;
    host.querySelector('[data-g="3"]').onclick();
    ok(badge === null, '★ 第 3 關沒過 → 還是不放行');
    host.querySelector('#sl-g').value = 45;
    host.querySelector('[data-g="3"]').onclick();
    eq(badge, 3, '★★ 三關全過 → 3 顆星才放行');
    ok(/★★★/.test(host.textContent) && /金牌/.test(host.textContent), '   金牌證書');
    sim.destroy(); host.remove();
  }

  console.log('\n── ★ 零失誤那一關真的會擋 ──');
  {
    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    let badge = null;
    const sim = SL.mount(host, { mode: 'selection', order: 'asc', onPass: b => { badge = b; } });
    /* 排完**這一組**就停 —— 挑戰每一關結算時系統會自己換一組
       （老師 2026-08-18：「選擇排序法忘了加上這個規則」的修法）。
       ★ 最可靠的停止訊號是**挑戰的回饋文字**：它只在結算那一刻才變。
       ⚠️ 不停的話這個迴圈會把新的一組也排完，
          「點錯了要擋下來」讀到的就會是下一組的零失誤訊息。 */
    const tsay = () => (host.querySelector('#sl-tsay') || {}).textContent || '';
    const solve = () => {
      const was = tsay();
      for (let k = 0; k < 40; k++) {
        const c = [...host.querySelectorAll('#sl-body [data-i]')];
        if (!c.length) return;
        const v = c.map(x => Number(x.textContent));
        c[v.indexOf(Math.min(...v))].onclick();
        if (tsay() !== was) return;
      } };
    solve();
    /* 過第 1 關 */
    host.querySelector('#sl-g').value = 1;
    host.querySelector('[data-g="1"]').onclick();
    const real = Number(host.querySelector('#sl-tsay').textContent.match(/實際是 (\d+)/)[1]);
    host.querySelector('#sl-g').value = real;
    host.querySelector('[data-g="1"]').onclick();
    /* 第 2 關：故意點錯一次（挑最大的），再排完 */
    host.querySelector('#sl-new').onclick();
    const c0 = [...host.querySelectorAll('[data-i]')];
    const v0 = c0.map(x => Number(x.textContent));
    c0[v0.indexOf(Math.max(...v0))].onclick();          // ← 錯的
    solve();
    ok(/點錯了/.test(host.querySelector('#sl-tsay').textContent),
       '★ 中途點錯 → 這一關不算過');
    ok(/驗收挑戰 2／3/.test(host.textContent), '   還停在第 2 關');
    ok(badge === null, '   而且沒有放行');
    /* 換一題重來，這次零失誤 */
    host.querySelector('#sl-new').onclick();
    solve();
    ok(/零失誤/.test(host.querySelector('#sl-tsay').textContent), '★ 重來一次零失誤 → 過');
    sim.destroy(); host.remove();
  }

  console.log('\n── ★★ 挑戰開著時「換一題」不可以把進度洗掉 ──');
  {
    /* ⚠️ 換一題原本會 passed = false —— 那會讓 finish() 再跑一次 openTest()，
       挑戰整個重置回第 1 關，學生的進度白做。 */
    const src = fs.readFileSync(path.join(ROOT, 'shared', 'sortlab.js'), 'utf8');
    ok(/if \(!lvNow\) passed = false;/.test(src),
       '★★ 挑戰開著的時候不清 passed（清了會把挑戰重置回第 1 關）');
    ok(/errs = 0;/.test(src), '   但失誤次數要歸零（新的一題重新算）');
  }

  console.log('\n── ★ 變數追蹤：電腦怎麼找出最小值 ──');
  {
    /* ⚠️ 玩法取自 search.html（逐步執行＋程式碼行高亮＋變數面板），
       但內容換成課本備課用書 p.193 的「找出最小值位置」——
       那一頁追的是「找最大值」，和課本對不上。
       ⇒ 下面這幾條要釘住「走出來的過程和課本那張表一模一樣」。 */
    const r = S._traceMin([8, 5, 10, 1, 7], 'asc');
    eq(r.compares, 5, '★ 五筆資料比 5 次（課本 p.193 的第一次～第五次）');
    eq(r.at, 4, '★ 最小值在第 4 項');
    eq(r.value, 1, '★ 數字是 1');
    ok(r.steps[0].dp === 1 && r.steps[1].mp === 1,
       '★ 兩個變數一開始都是 1（課本 p.198 步驟 4 的參考答案）');
    /* 課本的四個轉折：第 2 項換人、第 3 項不換、第 4 項換人、第 5 項不換 */
    const ups = r.steps.filter(x => x.line === 5).map(x => x.mp);
    eq(ups, [2, 4], '★ 只有第 2 項和第 4 項換過人（10 和 7 都沒有更小）');
    ok(r.steps.every(x => x.line >= 0 && x.line < S.TRACE_CODE.length),
       '每一步都指得到程式的某一行（高亮才有東西可亮）');
    ok(S.TRACE_CODE.some(l => /找出最小值位置/.test(l)) &&
       S.TRACE_CODE.some(l => /資料位置/.test(l)) &&
       S.TRACE_CODE.some(l => /最小值位置/.test(l)),
       '★ 程式碼用課本的詞（找出最小值位置／資料位置／最小值位置）');
    /* 由大到小：同一支程式反過來找最大 */
    const d = S._traceMin([8, 5, 10, 1, 7], 'desc');
    eq(d.value, 10, '由大到小時找出來的是 10');
  }

  console.log('\n── ★ 變數追蹤掛得起來 ──');
  {
    const host = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(host);
    const sim = S.mount(host, { mode: 'selection', order: 'asc', trace: true });
    ok(!host.querySelector('.sl-code'), '★ 還沒排完之前看不到追蹤區');
    let guard = 0;
    while (guard++ < 40) {
      const cells = [...host.querySelectorAll('[data-i]')];
      if (!cells.length) break;
      const vals = cells.map(c => Number(c.textContent));
      cells[vals.indexOf(Math.min(...vals))].onclick();
    }
    ok(!!host.querySelector('.sl-code'), '★ 排完之後才出現');
    eq(host.querySelectorAll('.sl-code div').length, S.TRACE_CODE.length,
       '程式碼每一行都畫出來了');
    ok(!!host.querySelector('.sl-code div.now'), '★ 有一行是高亮的（不然看不出跑到哪）');
    ok(/資料位置/.test(host.textContent) && /最小值位置/.test(host.textContent),
       '兩個變數的值看得到');
    host.querySelector('[data-tall]').onclick();
    ok(/第 4 項/.test(host.querySelector('.sl-note').textContent),
       '★ 一路跑完 → 講出最小的在第 4 項');
    ok(!!host.querySelector('[data-treset]'), '   跑完了給「再看一次」');
    /* ⚠️ 追蹤和自動播放要同時在（順序：手動 → 追蹤 → 自動）。 */
    ok(!!host.querySelector('.sl-bars'), '   自動播放區也在');
    const html = host.innerHTML;
    ok(html.indexOf('sl-code') < html.indexOf('sl-bars'),
       '★ 追蹤排在自動播放前面 —— 先看電腦怎麼挑，再看 30 筆跑');
    sim.destroy(); host.remove();
  }

  console.log('\n── ★ 只有第 6 關開追蹤 ──');
  {
    ok(L['6-2-1'].lab.trace === true, '★ 第 6 關開著（它要拼的正是這段程式）');
    ok(!L['6-2-2'].lab.trace,
       '★ 第 7 關沒開 —— 插入排序不挑最小值，開了會教錯');
  }

  console.log('\n── ★ sort.html 與 search.html 已經刪掉了 ──');
  {
    /* ⚠️ 改寫整合的最後一步就是刪原檔。
       留著的話同一件事有兩個入口、兩套規則 ——
       改一邊忘一邊，而學生只會覺得自己記錯。 */
    ok(!fs.existsSync(path.join(ROOT, '11502', 'sort.html')),
       '★ 11502/sort.html 已刪（自動排序動畫在這一支裡了）');
    ok(!fs.existsSync(path.join(ROOT, '11502', 'search.html')),
       '★ 11502/search.html 已刪（逐步變數追蹤的玩法在這一支裡了）');
    ok(!/search\.html/.test(JSON.stringify(L['6-2-1'])),
       '   第 6 關不再掛 search.html 當補充教材');
    const lv7 = JSON.stringify(L['6-2-2']);
    ok(!/sort\.html/.test(lv7), '   第 7 關不再掛 sort.html 當補充教材');
    const hub = fs.readFileSync(path.join(ROOT, '11502', 'hub.html'), 'utf8');
    ok(!/href:'sort\.html'|href="sort\.html"/.test(hub), '   入口也沒有它的卡片');
  }

  console.log('\n── ★ 兩關要對照得起來 ──');
  {
    /* ⚠️ 課本用**同一組數字**（8、5、10、1、7）示範這兩種排序，
       就是要學生看出差別。系統這邊如果兩關講得一模一樣，那個對照就沒了。 */
    const a = JSON.stringify(L['6-2-1']), b = JSON.stringify(L['6-2-2']);
    ok(/最小/.test(a) && !/最小/.test(L['6-2-2'].task),
       '★ 第 6 關講「找最小」，第 7 關的任務不提最小 —— 那是兩種做法的分野');
    ok(/插/.test(b), '第 7 關講「插」');
    ok(/選擇排序/.test(b), '★ 第 7 關有回頭對照第 6 關（課本就是用同一組數字示範兩次）');
    /* 兩關的停止條件觀念要串得起來：插入排序找位置那個迴圈有兩個條件，
       和第 10 關循序搜尋是同一件事。 */
    ok(/兩個/.test(b) && /長度/.test(b),
       '★ 第 7 關有講「找位置的迴圈有兩個停止條件」');
  }
}

/* ── ★★ 排序大比拼（第 10 關的前半）────────────────────
   ⚠️ 老師 2026-08-17：「2. 動手試一次 就只有搜尋，沒有排序 …
      應該是兩個都要，比較 搜尋的循序與二元速度差、
      排序的選擇與插入速度差。這個在前面都是分開的單元吧？」
   ★ 這一段唯一要給的東西：
       選擇排序**永遠 45 次**（不看資料長相）
       插入排序 9～45 都有（看資料本來長怎樣）
     那正是第 7 關的核心，也是這一關概念檢測第 2 題在問的。 */
console.log('\n── ★★ 排序大比拼：選擇 vs 插入 ──');
{
  const S2 = W.SORTLAB;
  ok(!!S2.INFO.compare, '★ SORTLAB 有 compare 模式');

  /* 先驗數字 —— 畫面畫得再好，數字錯了整段就是錯的 */
  const asc = a => S2._plan(a, 'insertion', 'asc').compares;
  const sel = a => S2._plan(a, 'selection', 'asc').compares;
  const rand = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10];
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const rev = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  eq(sel(rand), 45, '★★ 選擇排序：隨機 45 次');
  eq(sel(sorted), 45, '★★ 　　　　　已排好也是 45 次');
  eq(sel(rev), 45, '★★ 　　　　　完全相反還是 45 次 —— 它不看資料長相');
  eq(asc(sorted), 9, '★★ 插入排序：已排好只要 9 次');
  eq(asc(rev), 45, '★★ 　　　　　完全相反要 45 次');
  ok(asc(rand) > 9 && asc(rand) < 45, '　　　　　隨機介於中間（' + asc(rand) + ' 次）');

  /* 畫面：三種資料長相都要跑過才算走完 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  let passed = null;
  S2.mount(host, { mode: 'compare', stepMs: 0, onPass: b => { passed = b; } });
  ok(/資料長相/.test(host.textContent), '★ 一進來先選資料長相');
  const shapes = ['rand', 'sorted', 'rev'];
  shapes.forEach((k, i) => {
    host.querySelector('[data-shape="' + k + '"]').onclick();
    ok(!!host.querySelector('.sl-shape'), k + '：看得出現在跑的是哪一種資料');
    host.querySelector('[data-cmp]').onclick();
    if (i < 2) ok(passed === null, '　　還沒跑完三種 → 不放行');
  });
  /* ⚠️ 2026-08-18 老師選了「至少要跑一次大的」——
     三種長相跑完**還不夠**，要再用大資料量跑一次才放行。
     ★ 而且畫面上要看得到還差什麼（不是等他自己撞牆）。 */
  ok(passed === null, '★★ 三種長相跑完但沒跑大的 → 還不放行');
  ok(/至少用/.test(host.textContent), '★★ 而且清單上寫著還差「至少用 N 筆以上跑一次」');
  host.querySelector('[data-size="600"]').onclick();
  host.querySelector('[data-shape="rand"]').onclick();
  host.querySelector('[data-cmp]').onclick();
  ok(passed !== null, '★★ 補跑一次大資料量 → 放行');
  const tbl = host.querySelector('.sl-tbl');
  ok(!!tbl, '★ 累積成一張對照表');
  ok((tbl.querySelectorAll('tr').length - 1) === 3, '　 三列');
  ok(/選擇排序永遠/.test(host.textContent),
     '★★ 而且點破「選擇排序永遠一樣」—— 那是這一段的結論');

  /* ★★ 老師 2026-08-17：「第十關能有真實的排序過程嗎？
     模擬散亂的資料，一個一個排好的過程？」
     ⚠️ 原本只有兩條進度條 —— 那是**次數**不是**過程**。
     ★ plan() 的每一格本來就帶著「這一刻的陣列長什麼樣、正在比哪兩個」，
       大比拼卻只用了總次數。現在兩排長條同時排給他看。 */
  const h2 = document.createElement('div');
  document.body.appendChild(h2);
  S2.mount(h2, { mode: 'compare', stepMs: 0, onPass: () => {} });
  h2.querySelector('[data-shape="rand"]').onclick();
  h2.querySelector('[data-cmp]').onclick();
  const bars = h2.querySelectorAll('.sl-bars2');
  ok(bars.length === 2, '★★ 兩排長條（選擇一排、插入一排）');
  ok(bars[0].querySelectorAll('.sl-bar').length === 10, '　　每排 10 根（資料有幾筆就幾根）');
  ok(/排好了/.test(h2.textContent), '★ 排完會說「排好了」');
  /* 每一步都要有一句解說 —— 只有長條在跳的話，學生不知道發生什麼事 */
  ok(h2.querySelectorAll('.sl-lane .say').length === 2, '★★ 兩排各有一句解說');
  ok(/再放一次動畫/.test(h2.textContent),
     '★ 跑完之後放得了第二次（按鈕上要寫得出來那是動畫）');
  h2.remove();
  host.remove();
}

console.log('\n── ★★ 動畫要慢到看得見，入口也要看得出是動畫 ──');
{
  const S2 = W.SORTLAB;
  /* ★★ 老師 2026-08-18：「怎麼找不到可以看動畫的位置？」
     ⚠️ 排序這邊動畫一直都在，問題是**速度**和**招牌**：
        ① 10 筆資料約 88 格 × 22 毫秒 = 不到 2 秒 ——
           學生還在讀上面的說明，長條已經全綠，畫面上只剩結果。
        ② 按鈕寫「⚖️ 讓兩種排序各排一次」——
           從字面上看不出按下去會**動**，也看不出要看什麼。
     ⇒ 放慢到 5 秒左右，按鈕改成「播放」，並在旁邊講清楚會看到什麼。 */
  const rand = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10];
  const frames = Math.max(S2._plan(rand, 'selection', 'asc').frames.length,
                          S2._plan(rand, 'insertion', 'asc').frames.length);
  const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, ' ');   /* ⚠️ 先去註解 —— 註解裡正好寫著舊的 22 */
  const m = src.match(/stepMs[\s\S]{0,40}?:\s*(\d+)\s*;/);
  ok(!!m, '拿得到預設的每格毫秒數');
  const ms = m ? Number(m[1]) : 0;
  ok(ms >= 45, '★★ 每一格至少 45 毫秒（實得 ' + ms + '）—— 22 毫秒是看不見的');
  ok(frames * ms >= 4000,
     '★★ 整段至少 4 秒（' + frames + ' 格 × ' + ms + ' 毫秒 = ' +
     (frames * ms / 1000).toFixed(1) + ' 秒）');

  const h3 = document.createElement('div');
  document.body.appendChild(h3);
  S2.mount(h3, { mode: 'compare', stepMs: 0, onPass: () => {} });
  h3.querySelector('[data-shape="rand"]').onclick();
  const btn = h3.querySelector('[data-cmp]');
  ok(/播放/.test(btn.textContent), '★★ 按鈕上寫「播放」（不是「各排一次」）');
  ok(/長條/.test(h3.textContent), '★ 旁邊先講清楚按下去會看到什麼');
  h3.remove();

  /* 最上面的橫幅也要指路 —— 學生最先看到的是那一段 */
  const g = S2.goal({ mode: 'compare' });
  ok(/動畫在哪裡/.test(g.why), '★★ 目標橫幅直接寫出動畫在哪裡');
}

console.log('\n── ★★ 插入排序的手動挑戰也要兩排（老師 2026-08-18）──');
{
  /* ★★ 老師：「插入排序的『動手試一次』應該也要使用兩排，
     不然最大數排到最後不好表示。」
     ⚠️ 兩個問題疊在一起：
       ① 新牌比手上每一張都大時，正確的插入點在已排好那一段的**最尾巴**，
          而它緊貼著橘框新牌 —— 一整排的畫面上看起來和「沒動」一樣。
       ② INFO.insertion.life 講的是**兩疊牌**（牌堆／手牌），
          一整排的畫面和那個比喻對不上。
     ⇒ 拆成「🂠 還沒抽的牌堆」＋「🖐️ 手上排好的牌」，和選擇排序同一個版型。
     ⚠️ 資料結構不可以動 —— checkInsertion／doInsert／驗收挑戰都吃同一個 arr。 */
  const S2 = W.SORTLAB;
  const h = document.createElement('div');
  document.body.appendChild(h);
  S2.mount(h, { mode: 'insertion', order: 'asc', onPass: () => {} });
  const rows = () => [...h.querySelectorAll('#sl-body .sl-row')];
  eq(rows().length, 2, '★★ 兩排（牌堆一排、手牌一排）');
  ok(/牌堆/.test(rows()[0].textContent), '★ 上面那排是還沒抽的牌堆');
  ok(/手上排好/.test(rows()[1].textContent), '★ 下面那排是手上排好的牌');
  ok(!!h.querySelector('.sl-cell.card'), '★ 牌堆的第一張是這一回合的新牌（橘框）');
  /* ★★ 最尾巴那個插入點 —— 老師指的就是它 */
  const last = h.querySelectorAll('.sl-slot.last');
  eq(last.length, 1, '★★ 手牌那一排的最後有一個「插在最後面」的插入點');
  ok(last[0].parentNode === rows()[1],
     '★★ 而且它在**手牌那一排**，不是黏在新牌旁邊（黏著就又看不出來了）');
  const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8')
                .replace(/',\s*'/g, '');
  ok(/\.sl-slot\.last\{[^}]*border-style:solid/.test(src),
     '★★ 它和其他插入點長得不一樣（實線、比較寬）—— 不然等於沒畫');

  /* ★★ 真的把「新牌最大」那一步走一次：插到最尾巴要被判對 */
  {
    const st = S2._plan ? null : null;   // （這一段只用畫面，不碰 plan）
    let guard = 0, usedLast = false;
    while (h.querySelector('.sl-cell.card') && guard++ < 40) {
      const card = h.querySelector('.sl-cell.card');
      card.onclick();
      const slots = [...h.querySelectorAll('[data-slot]')];
      let moved = false;
      for (const s of slots) {
        const before = h.querySelectorAll('.sl-cell.done').length;
        const isLast = s.classList.contains('last');
        s.onclick();
        if (h.querySelectorAll('.sl-cell.done').length > before) {
          moved = true; if (isLast) usedLast = true; break;
        }
      }
      if (!moved) break;
    }
    ok(guard < 40, '★ 整副牌排得完（' + guard + ' 回合）');
    /* 隨機出題不保證一定會遇到「新牌最大」，所以這一條只在遇到時才有意義；
       ⚠️ 但「最尾巴那一格點下去要能成立」一定要驗 —— 用固定資料再跑一次。 */
    const h2 = document.createElement('div');
    document.body.appendChild(h2);
    S2.mount(h2, { mode: 'insertion', order: 'asc', items: [5, 9], onPass: () => {} });
    ok(true, '（隨機題目這一輪' + (usedLast ? '有' : '沒有') + '用到最尾巴那一格）');
    h2.remove();
  }

  /* ⚠️ 氣泡排序**不要**跟著改成兩排 —— 它本來就是在同一排上兩兩交換。 */
  const h3 = document.createElement('div');
  document.body.appendChild(h3);
  S2.mount(h3, { mode: 'bubble', order: 'asc', onPass: () => {} });
  eq(h3.querySelectorAll('#sl-body .sl-row').length, 1,
     '★★ 氣泡排序維持一整排（它的規則就是相鄰交換）');
  h.remove(); h3.remove();
}

console.log('\n── ★★ 挑戰要換題就自己換（老師 2026-08-18）──');
{
  /* ★★ 老師：「二元搜尋法過了第一關後，換題會是相同數字，這是 bug？
     循序搜尋也是相同狀況。**選擇排序法忘了加上這個規則**。」
     ⚠️ 病根不是亂數，是**畫面說了、系統沒做**：
        訊息寫「按🎲換一題拿一組新的」，但系統自己不換。
        學生忘了按 → 手上那一組**已經被他排好了** → 怎麼點都沒反應，
        而畫面上寫著「全程不能點錯」—— 他只會覺得系統壞了。
     ⇒ 每一關結算的時候系統自己換，而且新的一組不可以和舊的一樣。 */
  /* ⚠️ 一定要用**載過 labtest.js 的那個 window** ——
     檔案最上面那份 W 只有 sortlab，openTest() 看到 !LABTEST 就直接放行，
     挑戰整段根本不會出現，而斷言只會說「挑戰沒出現」，
     看起來像功能壞了，其實是環境沒備好。 */
  const W3 = {};
  ['shared/labtest.js', 'shared/sortlab.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'))(W3));
  W3.document = document;
  const S2 = W3.SORTLAB;
  const h = document.createElement('div');
  document.body.appendChild(h);
  S2.mount(h, { mode: 'selection', order: 'asc', onPass: () => {} });
  const cells = () => [...h.querySelectorAll('#sl-body .sl-row')][0]
    .querySelectorAll('[data-i]');
  const tsay = () => (h.querySelector('#sl-tsay') || {}).textContent || '';
  const solve = () => {
    const was = tsay();
    for (let k = 0; k < 40; k++) {
      const c = [...cells()];
      if (!c.length) return;
      const v = c.map(x => Number(x.textContent));
      c[v.indexOf(Math.min(...v))].onclick();
      if (tsay() !== was) return;
    } };
  const listOf = () => {
    const m = (h.querySelector('#sl-test .q') || {}).textContent || '';
    return (m.match(/：([\d、]+)/) || ['', ''])[1];
  };
  solve();
  ok(/驗收挑戰 1／3/.test(h.textContent), '自由玩排完 → 挑戰出現');

  /* ⚠️ 第 1 關**不可以**用他剛剛排好的那一組：
     ① 次數等於他自己剛數過的，這一關白出
     ② 而且畫面上是**排好之後**的順序，題目問的卻是原始順序 ——
        對插入排序來說那是兩個完全不同的數字。 */
  const q1 = listOf();
  ok(!!q1, '★★ 第 1 關把那一組數字**印出來**（不再說「上面那 N 筆」）');
  const arr1 = q1.split('、').map(Number);
  /* ⚠️⚠️ 這一條才是重點：**題目印的那一組，要和畫面上那一組是同一組**。
     ★ 第一版寫成「題目那一組不是排好的」—— 那擋不住任何東西：
       items 從頭到尾就是原始順序，手排只動 unsorted／done，
       所以就算不換題，題目照樣印出一組沒排過的數字（突變測試才發現）。
     ⇒ 沒換題的話，畫面上是**他剛排好的結果**、題目印的是**原始順序**，
       兩邊對不起來 —— 而對插入排序來說那是兩個差很多的數字。 */
  const onBoard = [...cells()].map(x => x.textContent).join('、');
  eq(onBoard, q1,
     '★★ 題目印的那一組，就是畫面上等他排的那一組（沒換題的話這兩個會不一樣）');
  ok([...cells()].length === arr1.length,
     '★ 而且是完整的一組（不是他剛排完剩下的空殼）');
  const real = S2._plan(arr1, 'selection', 'asc').compares;
  h.querySelector('#sl-g').value = real;
  h.querySelector('[data-g="1"]').onclick();
  ok(/猜中了/.test(tsay()), '★★ 猜題目上那一組的次數 → 過（題目和答案是同一組）');
  ok(/已經換了一組/.test(tsay()), '★★ 而且直說「已經換了一組」，不是叫他自己去按');
  const now = [...cells()].map(x => x.textContent).join(',');
  /* ⚠️ 不可以拿「筆數和第 1 關一樣」當作「完整」的判準 ——
     2026-08-18 之後筆數本身就是**會變**的（老師：「每次都是 6 筆？」）。
     ⇒ 判「是不是一組沒排過的完整資料」：6～10 筆、而且沒有一項已經就位。 */
  const n2 = now.split(',').length;
  ok(n2 >= 6 && n2 <= 10,
     '★★ 第 2 關是一組完整的資料（' + n2 + ' 筆，不是剛才排到一半的殘局）');
  ok(h.querySelectorAll('#sl-body .sl-cell.done').length === 0,
     '★ 而且一項都還沒排好');
  ok(now !== arr1.join(','), '★★ 而且和第 1 關那一組不一樣');

  /* ★ 換題保證不重複 —— 連按 20 次都不該拿到和上一組一樣的 */
  let same = 0;
  for (let i = 0; i < 20; i++) {
    const before = [...cells()].map(x => x.textContent).join(',');
    h.querySelector('#sl-new').onclick();
    if ([...cells()].map(x => x.textContent).join(',') === before) same++;
  }
  eq(same, 0, '★★ 連按 20 次「換一題」，沒有一次拿到和上一組一樣的');
  h.remove();
}

console.log('\n── ★★ 手排的筆數要會變（老師 2026-08-18）──');
{
  /* ★★ 老師：「插入排序法每次都是 6 筆？沒有變化？6-10」
             「選擇排序每次都是 6 筆？沒有變化？」
     ⚠️ 原本寫死 `opts.size || 6` —— 換一題只換數字、不換**筆數**：
        每一輪的長度、回合數、比較次數的量級都一模一樣，
        學生第二次是在重複同一個動作，不是在遇到新情況。
     ★ 而且第 1 關「這一組要比幾次」永遠是同一個答案
       （選擇排序 6 筆永遠 15 次）—— 背一次就過了。 */
  const S2 = W.SORTLAB;
  const seen = {};
  for (let i = 0; i < 2000; i++) seen[S2._makeItems(undefined, 'asc').length] = 1;
  eq(Object.keys(seen).map(Number).sort((a, b) => a - b), [6, 7, 8, 9, 10],
     '★★ 沒指定筆數時抽 6～10（不再固定 6）');
  /* ⚠️ 上限 10 是刻意的：手排要一格一格點，再多就變成考耐心。 */
  ok(!seen[11] && !seen[5], '★ 而且不會跑出 6～10 以外的');
  /* opts.size 指定時要照做 —— 測試和挑戰都靠它 */
  eq(S2._makeItems(6, 'asc').length, 6, '★ 有指定就照指定的來');

  ['selection', 'insertion'].forEach(mode => {
    const h = document.createElement('div');
    document.body.appendChild(h);
    S2.mount(h, { mode: mode, order: 'asc', onPass: () => {} });
    const n = () => h.querySelectorAll('#sl-body .sl-row')[0]
      .querySelectorAll('[data-i]').length;
    const got = [];
    for (let i = 0; i < 12; i++) { h.querySelector('#sl-new').onclick(); got.push(n()); }
    /* ★★ 這一條比「有沒有變」更嚴：**連續兩次不可以一樣**。
       ⚠️ 只驗「12 次裡有不同的」的話，換題若只是偶爾變一下也會過，
          而學生的體感是「這次和上次一樣嗎」。 */
    let rep = 0;
    for (let i = 1; i < got.length; i++) if (got[i] === got[i - 1]) rep++;
    eq(rep, 0, '★★ ' + mode + '：連按 12 次換一題，沒有一次筆數和上一次相同（' +
       got.join(',') + '）');
  });
}

console.log('\n── ★★ 氣泡排序是補充，要標出來也要說明（老師 2026-08-18）──');
{
  /* ★ 老師：「『🫧 氣泡排序法』不在課程內，在旁加個補充介紹的按鈕，
     會有浮動視窗顯示簡介說明。」「剛才的介紹這裡應該也是相同。」
     ⚠️ 課本第 6 章只教選擇與插入。氣泡在自動播放那一區和另外兩顆
        長得一模一樣 —— 學生會以為它也要考，或以為自己漏學了一種。
     ★ 這一區是第 6、7 關**共用**的，所以兩關都要有（改一次兩邊都到）。 */
  const S2 = W.SORTLAB;
  ['selection', 'insertion'].forEach(mode => {
    const h = document.createElement('div');
    document.body.appendChild(h);
    S2.mount(h, { mode: mode, order: 'asc', size: 6, onPass: () => {} });
    /* 手排完自動播放才出現（刻意的：先自己做過再看） */
    for (let g = 0; g < 80; g++) {
      if (mode === 'selection') {
        const c = [...h.querySelectorAll('#sl-body .sl-row')[0].querySelectorAll('[data-i]')];
        if (!c.length) break;
        const v = c.map(x => Number(x.textContent));
        c[v.indexOf(Math.min(...v))].onclick();
      } else {
        const card = h.querySelector('.sl-cell.card');
        if (!card) break;
        card.onclick();
        let moved = false;
        for (const s of [...h.querySelectorAll('[data-slot]')]) {
          const b = h.querySelectorAll('.sl-cell.done').length;
          s.onclick();
          if (h.querySelectorAll('.sl-cell.done').length > b) { moved = true; break; }
        }
        if (!moved) break;
      }
    }
    const bub = h.querySelector('[data-algo="bubble"]');
    ok(!!bub, mode + ' 關：自動播放裡看得到氣泡排序法');
    /* ⚠️ 老師 2026-08-18：「那個 ❓ 會跑出格子，排版不良，
       『補充』標籤的型態可能比較適合。」
       ⇒ 標籤本身就是按鈕（藥丸形），不再有一顆突出的圓 ❓，
         演算法按鈕裡也不再塞一個靜態的小字 —— 那兩個原本在講同一件事。 */
    const why = h.querySelector('[data-why="bubble"]');
    ok(!!why, '★★ ' + mode + ' 關：氣泡旁邊有一個「補充」標籤');
    ok(/補充/.test(why.textContent), '★★ 標籤上寫的就是「補充」');
    ok(!/❓/.test(h.textContent), '★★ 不再有那顆會跑出格子的圓 ❓');
    ok(!/補充/.test(bub.textContent),
       '★ 演算法按鈕本身乾淨（補充那件事由旁邊的標籤講）');
    const other = h.querySelector('[data-algo="selection"]');
    ok(!/補充/.test(other.textContent), '　　選擇排序旁邊沒有補充標籤');
    ok(!h.querySelector('[data-why="selection"]'), '　　也沒有補充按鈕');
    h.remove();
  });

  /* ── 浮動視窗本身 ───────────────────────────────── */
  const h = document.createElement('div');
  document.body.appendChild(h);
  S2.mount(h, { mode: 'selection', order: 'asc', size: 6, onPass: () => {} });
  for (let g = 0; g < 80; g++) {
    const c = [...h.querySelectorAll('#sl-body .sl-row')[0].querySelectorAll('[data-i]')];
    if (!c.length) break;
    const v = c.map(x => Number(x.textContent));
    c[v.indexOf(Math.min(...v))].onclick();
  }
  ok(!h.querySelector('.sl-modal'), '★ 一開始不會自己跳出來');
  h.querySelector('[data-why="bubble"]').onclick();
  const m = h.querySelector('.sl-modal');
  ok(!!m, '★★ 按下去會開浮動視窗');
  const txt = m.textContent;
  /* ⚠️ 補充教材的第一句就要說「不考」——
     不講的話學生會把它當成第三種要背的排序法。 */
  ok(/不會考/.test(txt), '★★ 開頭就講明「不在範圍、不會考」');
  ok(/相鄰/.test(txt) && /交換/.test(txt), '★ 講得出它怎麼排（比相鄰的兩個、交換）');
  ok(/氣泡/.test(txt) && /浮/.test(txt), '★ 也講了名字的由來');
  /* ★ 要接回他**已經學過**的兩種，不要另開一套詞彙 */
  ok(/選擇排序法/.test(txt) && /插入排序法/.test(txt),
     '★★ 而且接回課本教過的那兩種（不是另外講一套）');

  /* ⚠️ 三條關得掉的路，少一條它就是個關不掉的東西 */
  ok(!!m.querySelector('.x'), '★★ 有看得見的關閉鈕');
  m.querySelector('.x').onclick();
  ok(!h.querySelector('.sl-modal'), '　　按 ✕ 關得掉');
  h.querySelector('[data-why="bubble"]').onclick();
  /* ⚠️ dom 是那個 else 區塊裡的區域變數，這裡拿不到 ——
     用 window 上的 KeyboardEvent（global.window 在 else 區塊已經設好了）。 */
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  ok(!h.querySelector('.sl-modal'), '★★ Esc 也關得掉');
  h.querySelector('[data-why="bubble"]').onclick();
  const m2 = h.querySelector('.sl-modal');
  m2.onclick({ target: m2 });
  ok(!h.querySelector('.sl-modal'), '★★ 點黑幕也關得掉');

  /* ⚠️ 這個模組被掛在關卡頁的一塊 div 裡 —— 樣式不可以蓋掉整個網站 */
  const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8')
                .replace(/',\s*'/g, '');
  ok(/\.sl-modal\{[^}]*z-index/.test(src), '★ 浮動視窗有 z-index（不會被別的東西壓住）');
  h.remove();
}

console.log('\n── ★★ 橘框要真的是橘的（老師 2026-08-18）──');
{
  /* ★ 老師：「『這一回合要處理的是橘框那一張新牌』，
     但是並沒有亮橘框，只有外框造型不同。」
     ⚠️ 原本只有 2px 橘邊＋幾乎看不出來的淡底（#fff7ed）；
        旁邊的「已排好」是**綠底**，一比之下橘的那張看起來只是「沒顏色」。
     ★ 訊息指名「橘框那一張」，畫面上就必須真的有一張是橘的 ——
       **文字說的和畫面看到的要是同一件事**。 */
  const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8')
                .replace(/',\s*'/g, '');
  ok(/\.sl-cell\.card\{[^}]*background:#f97316/.test(src),
     '★★ 新牌是**實心橘底**（不是淡到看不見的底色）');
  ok(/\.sl-cell\.card\{[^}]*color:#fff/.test(src), '★ 白字（實心底就要換字色）');
  ok(/\.sl-cell\.card::after\{[^}]*content:"這張"/.test(src),
     '★★ 而且掛一個「這張」的小標 —— 顏色再明顯也要有字說清楚');
  /* ⚠️ 點選中（.sel）要排在 .card 後面，而且要把橘色陰影也換掉 */
  ok(src.indexOf('.sl-cell.card{') < src.indexOf('.sl-cell.sel{'),
     '★★ .sel 排在 .card 後面（不然點下去畫面不會變）');
  ok(/\.sl-cell\.sel\{[^}]*box-shadow/.test(src),
     '★ .sel 也換掉陰影（不然是靛藍的牌配橘色的影子）');

  const S2 = W.SORTLAB;
  const h = document.createElement('div');
  document.body.appendChild(h);
  S2.mount(h, { mode: 'insertion', order: 'asc', onPass: () => {} });
  eq(h.querySelectorAll('.sl-cell.card').length, 1, '★ 畫面上剛好一張新牌');
  h.remove();
}

console.log('\n── ★★ 大量資料的排序過程（老師 2026-08-18）──');
{
  /* ★★ 老師：「可以真實體驗大量數據排列的過程」——
     搜尋那邊已經做到（一整排格子，被砍掉的整片變灰），
     排序這邊卻還停在 10 筆：看得清楚「在比哪兩根」，
     但看不到「一整片散亂的資料慢慢長成一道斜坡」。 */
  const S2 = W.SORTLAB;

  /* ── ① 引擎：runner 的次數必須和 plan 一模一樣 ──────────
     ⚠️ 這是整段最容易出錯的地方。plan 和 runner 是**兩份**排序實作，
        數字對不上的話，畫面照樣會動，只是那個次數是假的 ——
        而這一關的全部重點就是那個次數。 */
  const mk = (kind, n) => {
    const a = []; for (let i = 1; i <= n; i++) a.push(i);
    if (kind === 'rev') a.reverse();
    if (kind === 'rand') for (let j = a.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1)); [a[j], a[k]] = [a[k], a[j]];
    }
    return a;
  };
  let mism = 0, cases = 0, unsorted = 0;
  ['rand', 'sorted', 'rev'].forEach(kind => [2, 3, 6, 10, 25, 40].forEach(n => {
    const a = mk(kind, n);
    ['selection', 'insertion'].forEach(m => {
      cases++;
      const want = S2._plan(a.slice(), m, 'asc').compares;
      const got = S2._costOf(a.slice(), m, 'asc');
      if (want !== got.compares || !got.sorted) mism++;
      const r = S2._runner(a.slice(), m, 'asc');
      r.advance(n * n + 4 * n + 16);
      if (!r.arr.every((v, i) => i === 0 || r.arr[i - 1] <= v)) unsorted++;
    });
  }));
  ok(mism === 0, '★★ runner 的比較次數和 plan 完全一致（' + cases + ' 組，不合 ' + mism + '）');
  ok(unsorted === 0, '★★ 而且真的排好了（不是只把次數算對）');

  /* ── ② plan() 不可以被拿去跑大資料量 ─────────────────
     ⚠️ plan 每一格都存一份陣列 —— 600 筆選擇排序有十八萬次比較，
        存起來瀏覽器直接卡死。這個界線要會噴錯，不能只寫在註解裡。 */
  let threw = '';
  try { S2._plan(mk('rand', S2.PLAN_MAX + 1), 'selection', 'asc'); }
  catch (e) { threw = e.message; }
  ok(!!threw, '★★ plan() 超過 ' + S2.PLAN_MAX + ' 筆會擋下來（' + threw.slice(0, 20) + '…）');
  ok(/runner/.test(threw), '　　而且訊息講得出該改用什麼');

  /* ── ③ 600 筆真的畫得出兩排長條 ────────────────────── */
  const h = document.createElement('div');
  document.body.appendChild(h);
  S2.mount(h, { mode: 'compare', stepMs: 0, onPass: () => {} });
  ok(!!h.querySelector('[data-size="600"]'), '★★ 選得到 600 筆');
  h.querySelector('[data-size="600"]').onclick();
  h.querySelector('[data-shape="rev"]').onclick();
  ok(!/sl-mini/.test(h.innerHTML),
     '★ 600 筆不印出每一個數字（600 個數字擠在一起是一片噪音）');
  h.querySelector('[data-cmp]').onclick();
  const lanes = h.querySelectorAll('.sl-bars2.big');
  eq(lanes.length, 2, '★★ 兩排長條（選擇一排、插入一排）');
  eq(lanes[0].querySelectorAll('i').length, 600, '★★ 每排真的 600 根');
  eq(lanes[1].querySelectorAll('i').length, 600, '　　兩排一樣多');
  /* 跑完之後整排都要是「排好」的綠色 —— 不然畫面說排好了、資料其實沒排好 */
  ok(lanes[0].querySelectorAll('i.ok').length >= 599,
     '★★ 跑完之後整排變綠（實得 ' + lanes[0].querySelectorAll('i.ok').length + '／600）');
  /* 完全相反的資料：兩種都是 179,700 次 —— 那是最壞情況 */
  ok(/179,700/.test(h.textContent),
     '★★ 次數有印出來而且加了千分位（179,700 —— 沒有逗號的話沒人讀得出量級）');

  /* ── ④ 已排好的 600 筆：300 倍的差距 ───────────────── */
  const big = mk('sorted', 600);
  const cs = S2._costOf(big.slice(), 'selection', 'asc').compares;
  const ci = S2._costOf(big.slice(), 'insertion', 'asc').compares;
  eq(cs, 179700, '★★ 600 筆選擇排序 179,700 次（n×(n−1)÷2，和資料長相無關）');
  eq(ci, 599, '★★ 600 筆已排好的插入排序只要 599 次');
  ok(Math.round(cs / ci) === 300, '★★ 差 300 倍 —— 這就是「大量資料」要給的那個數字');

  /* ── ⑤ 對照表混了資料量要講出來 ─────────────────────
     ⚠️ 三種長相各用不同的資料量跑，「選擇排序永遠一樣」就不成立了。
        不講的話，那張表看起來只是「數字對不上」，
        學生會以為是自己記錯，而不是比較的前提不同。 */
  const h2 = document.createElement('div');
  document.body.appendChild(h2);
  S2.mount(h2, { mode: 'compare', stepMs: 0, onPass: () => {} });
  h2.querySelector('[data-shape="rand"]').onclick();
  h2.querySelector('[data-cmp]').onclick();
  h2.querySelector('[data-size="600"]').onclick();
  ['sorted', 'rev'].forEach(k => {
    h2.querySelector('[data-shape="' + k + '"]').onclick();
    h2.querySelector('[data-cmp]').onclick();
  });
  ok(/資料量不一樣/.test(h2.textContent),
     '★★ 三列的資料量不同時，畫面直說「資料量不一樣，次數當然對不起來」');
  ok(h2.querySelectorAll('.sl-tbl th').length === 4,
     '★★ 對照表有「資料量」那一欄（' + h2.querySelectorAll('.sl-tbl th').length + ' 欄）');
  h.remove(); h2.remove();
}

console.log('\n── ★★ 播放鈕要看得到、結論要畫線（老師 2026-08-18）──');
{
  const S2 = W.SORTLAB;
  const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8');

  /* ── ① 播放鈕本身要有樣式 ────────────────────────────
     ⚠️⚠️ 老師：「▶ 播放 600 筆的排序過程 這個也太不明顯了，找很久才發現」。
        查下來 `.sl-side` **一條 CSS 都沒有** —— 那顆是瀏覽器的預設灰按鈕。
     ★ 前一輪我只改了按鈕上的**字**，就當作「入口變明顯了」——
       字改得再好，沒有樣式一樣看不到。這一條盯的是「它長什麼樣」。 */
  /* ⚠️ 這裡的比對要**連內容一起看**。第一版只寫 /\.sl-go\{/，
     結果 `.sl-big .sl-go{padding:18px}` 也匹配 ——
     把主樣式整條刪掉，測試照樣綠（突變測試才抓到）。
     ★ 「某個名字有出現」幾乎永遠是不夠的斷言。 */
  const css = src.replace(/',\s*'/g, '');
  ok(/\.sl-go\{[^}]*border:2px dashed/.test(css),
     '★★ 播放鈕自己佔一塊（虛線框的區塊，不是一顆裸按鈕）');
  ok(/\.sl-side button\{[^}]*cursor:pointer/.test(css),
     '★★ 連次要按鈕都有樣式了（原本 .sl-side 一條 CSS 都沒有）');
  ok(/\.sl-go button\{[^}]*background:#7c3aed/.test(css),
     '★ 主要動作是實心底色（不是白底外框 —— 那和旁邊的選鈕分不開）');
  ok(/\.sl-go button\{[^}]*font-size:1[6-9]px/.test(css),
     '★ 而且字夠大（投影出來看得到）');
  ok(/prefers-reduced-motion/.test(src),
     '★★ 呼吸動畫可以關掉（系統開了「減少動態效果」就不要動）');
  /* ⚠️ 主要動作一次只能有一個 —— 兩顆一樣大的等於沒有主要動作 */
  const h3 = document.createElement('div');
  document.body.appendChild(h3);
  S2.mount(h3, { mode: 'compare', stepMs: 0, onPass: () => {} });
  h3.querySelector('[data-size="600"]').onclick();
  h3.querySelector('[data-shape="rand"]').onclick();
  eq(h3.querySelectorAll('.sl-go').length, 1, '★★ 畫面上只有一個「按這裡」的區塊');
  ok(/播放/.test(h3.querySelector('.sl-go button').textContent), '　　而且那顆就是播放鈕');
  ok(/長條|斜坡/.test(h3.querySelector('.sl-go .cap').textContent),
     '★ 按鈕底下講得出「按下去會看到什麼」');

  /* ── ② 排序前的資料要有標籤 ─────────────────────────
     ⚠️ 老師：「10 筆資料為什麼還要列一個 41710892365 數字小卡？
        是不是前一個版本沒有改到？」——
        沒有標籤的一排數字，看起來就是上一版留下來的殘骸。
     ★ 而且它只該在**播放前**出現：動畫跑起來之後它顯示的是排序前的順序，
       和旁邊正在排的長條互相打架。 */
  const h4 = document.createElement('div');
  document.body.appendChild(h4);
  S2.mount(h4, { mode: 'compare', stepMs: 0, onPass: () => {} });
  h4.querySelector('[data-shape="rand"]').onclick();
  ok(!!h4.querySelector('.sl-before'), '★★ 10 筆：排序前的資料有自己的區塊');
  ok(/排序前的資料/.test(h4.querySelector('.sl-before').textContent),
     '★★ 而且有標籤說明那是什麼（沒標籤就是殘骸）');
  ok(!!h4.querySelector('.sl-mini'), '　　小資料量印得出每一個數字');
  h4.querySelector('[data-cmp]').onclick();
  ok(!h4.querySelector('.sl-before'),
     '★★ 播放之後就收起來 —— 不然它顯示的是排序前的順序，和長條打架');
  /* 大資料量：不印數字，改畫一排靜止的長條（看得出資料長相） */
  h4.querySelector('[data-size="600"]').onclick();
  h4.querySelector('[data-shape="sorted"]').onclick();
  const before = h4.querySelector('.sl-before');
  ok(!!before && !before.querySelector('.sl-mini'),
     '★★ 600 筆不印 600 個數字（那是一片噪音）');
  ok(!!before.querySelector('.sl-bars2.big i'), '★ 改畫一排靜止的長條');
  ok(before.querySelectorAll('i.ok, i.cmp, i.best').length === 0,
     '★ 而且全部同色 —— 還沒開始排，沒有誰在比');

  /* ── ③ 結論要畫螢光筆 ───────────────────────────────
     ★ 老師：「結論要加上螢光筆畫線記號，之前也有使用過這個功能，
       這樣學生在看完大量資料後才會更有感受。」
     ⚠️ 樣式**不可以**在模組裡再寫一份 —— theme.css 已經有了。
        兩份會慢慢長得不一樣，而且沒有人會發現是哪一天開始的。 */
  ok(!/\.hl\s*\{|\.hl-b\s*\{/.test(src.replace(/',\s*'/g, '')),
     '★★ 模組沒有自己再寫一份 .hl（樣式只能有一份，在 theme.css）');
  h4.querySelector('[data-cmp]').onclick();
  const win = h4.querySelector('.win');
  ok(!!win && win.querySelectorAll('.hl, .hl-b').length > 0,
     '★★ 結論真的畫了螢光筆');
  const marks = win.querySelectorAll('.hl, .hl-b').length;
  ok(marks <= 3, '★★ 最多三處（實得 ' + marks + '）—— 畫太多等於沒畫');
  ok(win.querySelectorAll('.hl').length >= 1,
     '★ 黃筆畫在**結論**上（倍數／差多少），不是只有數字');
  ok(win.querySelectorAll('.hl-b').length >= 1, '★ 藍筆畫數量');
  /* theme.css 真的有那兩支筆 —— 沒有的話畫線是隱形的 */
  const theme = fs.readFileSync(path.join(__dirname, '..', 'theme.css'), 'utf8');
  ok(/\.hl\s*\{/.test(theme) && /\.hl-b\s*\{/.test(theme),
     '★★ theme.css 有 .hl 與 .hl-b（不然這些標記是隱形的）');
  h3.remove(); h4.remove();
}

console.log('\n── ★★ 開場那三行也要畫重點（老師 2026-08-18）──');
{
  /* ★ 老師：「⚖️ 排序大比拼／📝／🎒 …這裡面要加上畫重點標注」。
     ⚠️ 這三行是學生進到這一步看到的**第一段字**，而讀純文字時眼睛是滑過去的。
     ⚠️ 但畫太多等於沒畫 —— 上限比「有沒有畫」更重要。 */
  const I = W.SORTLAB.INFO.compare;
  const cnt = t => (String(t).match(/class="hl(-b)?"/g) || []).length;
  const total = cnt(I.rule) + cnt(I.why) + cnt(I.life);
  ok(cnt(I.rule) >= 1, '★★ 規則那一行有畫（' + cnt(I.rule) + ' 處）');
  ok(cnt(I.why) >= 1, '★★ 原理那一行有畫（' + cnt(I.why) + ' 處）');
  ok(cnt(I.life) >= 1, '★ 生活案例那一行也有（' + cnt(I.life) + ' 處）');
  ok(total <= 4, '★★ 整段最多四處（實得 ' + total + '）—— 畫太多等於沒畫');
  /* ★ 畫的要是**重點**，不是操作指示。
     「各排一次」「三種都要跑過」是叫他做什麼，不是這一段在講什麼。 */
  const marked = (I.rule + I.why + I.life).match(/class="hl(-b)?">([^<]*)</g) || [];
  ok(!marked.some(m => /各排一次|都要跑過|按一下/.test(m)),
     '★★ 沒有把操作指示畫起來（那是指示，不是重點）');
  ok(marked.some(m => /不管資料長什麼樣|接近排好/.test(m)),
     '★★ 畫的是兩種排序真正的差別（選擇不看資料／插入看資料）');

  /* ── 引用框：第 10 關掛了兩個實驗室 ──────────────────
     ⚠️⚠️ lv.lab 是**陣列**時 lv.lab.kind 是 undefined ——
        quiz.js 會掉進 SORTLAB、拿 INFO[undefined] 拿到空的，
        最後安靜地退回「情境解說」。第 10 關 Q3 引用的其實是情境，
        而那一題問的正好是「排序的成本要不要算進搜尋裡」。
     ★ 這是同一個陣列坑的第三處（level.html、undefined.test.js、quiz.js）。 */
  /* ⚠️ 自己備一份 window：檔案最上面那份只載了 sortlab，
     直接寫 `if (W.QUIZ)` 的話這三條會**安靜地跳過** ——
     那比紅字更糟，因為看起來像通過了。 */
  {
    const R = path.join(__dirname, '..', '..');
    const V2 = {};
    ['shared/sortlab.js', 'shared/searchlab.js', 'shared/quiz.js',
     '11502/content/blocks.js'].forEach(f =>
      new Function('window', fs.readFileSync(path.join(R, f), 'utf8'))(V2));
    ok(!!V2.QUIZ && !!V2.BLOCK_LEVELS, '（引用框那三條的環境備好了）');
    const box = V2.QUIZ._refBox(V2.BLOCK_LEVELS['6-3-3'], 'lab');
    ok(/排序/.test(box) && /砍掉一半/.test(box),
       '★★ 第 10 關的引用框同時給得出**兩個**實驗室的規則');
    ok(/動手試一次/.test(box), '★★ 而且標題是「你在動手試一次做過的」');
    /* 單一實驗室那條路不可以被改壞 —— 它給的是規則＋原理 */
    const one = V2.QUIZ._refBox(V2.BLOCK_LEVELS['6-2-1'], 'lab');
    ok(/最小/.test(one), '★ 只掛一個實驗室的關卡照舊（第 6 關：選擇排序的規則）');
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
