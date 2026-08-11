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
  const seg = src.slice(i, i + 900);
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
