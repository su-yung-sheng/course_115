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
ok(/未排序/.test(S.INFO.selection.why) && /已排序/.test(S.INFO.selection.why),
   '說明文字也是兩個清單的講法');

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
    ok(lv.quiz.every(q => q.ref !== undefined), '每一題都指得回來源');
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
    ok(lv.quiz.every(q => q.ref !== undefined), '每一題都指得回來源');
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

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
