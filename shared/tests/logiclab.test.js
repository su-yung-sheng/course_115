/* 條件判斷實驗室（第 4 關）
   跑法：node shared/tests/logiclab.test.js

   ⚠️ 這一支是由 11502/logic.html 改寫而來（原檔已刪）。
      玩法留下（先預測動作、答錯扣體力、慢動作一步一步推），
      內容換成第 4 關自己的世界 —— 小鳥、蟲、滑鼠。

   ★ 這裡要釘的第一件事是**真值算得對**。
     條件判斷是這一關唯一的新東西；算錯的話，
     學生會照著一個錯的示範去理解「且」和「或」，
     而且他不會發現 —— 他只會覺得自己搞不懂。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const is = (g, w, l) => ok(JSON.stringify(g) === JSON.stringify(w),
  l + (JSON.stringify(g) === JSON.stringify(w) ? '' : `　←　期望 ${JSON.stringify(w)}，實得 ${JSON.stringify(g)}`));
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body><div id="h"></div></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
W.eval(fs.readFileSync(path.join(ROOT, 'shared', 'logiclab.js'), 'utf8'));
W.eval(fs.readFileSync(path.join(ROOT, 'shared', 'blocks.js'), 'utf8'));
W.eval(fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'));
const L = W.LOGICLAB, LV = W.BLOCK_LEVELS;

const F = t => L.FORMS.filter(f => f.type === t)[0];

/* ── 真值 ─────────────────────────────────────────── */
section('★ 且：兩邊都成立才算');
{
  const f = F('and');                       // 距離 < 3 且 按住 > 0
  is(L._evalCond(f, { dist: 1, hold: 5 }), true,  '距離 1、按住 5 → 成立');
  is(L._evalCond(f, { dist: 1, hold: 0 }), false, '★ 距離對了但沒按滑鼠 → 不成立');
  is(L._evalCond(f, { dist: 8, hold: 5 }), false, '★ 按了滑鼠但離太遠 → 不成立');
  is(L._evalCond(f, { dist: 8, hold: 0 }), false, '兩邊都不成立 → 不成立');
  is(L._evalCond(f, { dist: 3, hold: 5 }), false, '   邊界：距離剛好 3 不算（要 < 3）');
}

section('★ 或：只要一邊成立');
{
  const f = F('or');                        // 距離 < 3 或 按住 > 7
  is(L._evalCond(f, { dist: 1, hold: 0 }), true,  '★ 只有距離成立 → 也成立（這就是和「且」的差別）');
  is(L._evalCond(f, { dist: 8, hold: 9 }), true,  '★ 只有時間成立 → 也成立');
  is(L._evalCond(f, { dist: 1, hold: 9 }), true,  '兩邊都成立 → 成立');
  is(L._evalCond(f, { dist: 8, hold: 3 }), false, '兩邊都不成立 → 不成立');
  /* ★★ 同一組數字，「且」和「或」要給出不一樣的答案 ——
     一樣的話這兩個條件就沒有教學價值了。 */
  const v = { dist: 1, hold: 0 };
  ok(L._evalCond(F('and'), v) !== L._evalCond(F('or'), v),
     '★★ 同一組數字下，「且」不成立而「或」成立 —— 差別看得見');
}

section('★ 不成立：把結果反過來');
{
  const f = F('not');                       // 「距離 = n」不成立
  is(L._evalCond(f, { dist: 5 }, 5), false, '距離就是 5 →「距離 = 5」成立 → 反過來變不成立');
  is(L._evalCond(f, { dist: 2 }, 5), true,  '距離不是 5 → 反過來變成立');
}

/* ── 程式會做什麼 ─────────────────────────────────── */
section('★ 基礎版沒有「否則」—— 條件不成立時什麼都不做');
{
  const q = L._makeQuest({ type: 'and', arch: 'basic' }, () => 0.9);   // 距離 9、按住 9
  is(q.met, false, '這一題的條件不成立');
  ok(/什麼都不做/.test(L._actionOf(q)),
     '★ 基礎版 → 什麼都不做（這正是第 4 關「只寫那麼不寫否則」的後果）');
  const q2 = L._makeQuest({ type: 'and', arch: 'advanced' }, () => 0.9);
  ok(!/什麼都不做/.test(L._actionOf(q2)) || q2.act.no === '什麼都不做',
     '   進階版有否則 → 會做另一件事');
  const q3 = L._makeQuest({ type: 'and', arch: 'basic' }, () => 0.05); // 距離 0、按住 0…
  is(L._actionOf(q3), q3.met ? q3.act.yes : '（什麼都不做）', '條件成立時兩種版本一樣');
}

/* ── 慢動作 ───────────────────────────────────────── */
section('★ 慢動作：一步一步推');
{
  const q = L._makeQuest({ type: 'and', arch: 'advanced' }, () => 0.5); // 距離 5、按住 5
  const st = L._traceSteps(q);
  is(st.length, 3, '「且」拆成三步：左邊 → 右邊 → 合起來');
  is(st[0].ans, false, '   距離 5 → 「距離 < 3」不成立');
  is(st[1].ans, true,  '   按住 5 秒 → 「按住 > 0」成立');
  is(st[2].ans, q.met, '★ 最後一步的答案就是整個條件的答案');
  ok(/兩邊都成立/.test(st[2].why), '   合起來那一步要講規則（且＝兩邊都要）');

  const qn = L._makeQuest({ type: 'not', arch: 'advanced' }, () => 0.5);
  is(L._traceSteps(qn).length, 2, '「不成立」只有兩步（先算原本的，再反過來）');
  ok(/反過來/.test(L._traceSteps(qn)[1].q), '   第二步要講「反過來」');

  /* ⚠️ 每一步都要有答案可比 —— 少一個 ans 的話畫面上那一步按了沒反應。 */
  ['and', 'or', 'not'].forEach(t => {
    const qq = L._makeQuest({ type: t }, () => 0.3);
    ok(L._traceSteps(qq).every(s => typeof s.ans === 'boolean' && s.q && s.why),
       '   ' + t + ' 的每一步都有題目、答案和說明');
  });
}

/* ── 出題 ─────────────────────────────────────────── */
section('★ 出題');
{
  let types = {}, arches = {}, bad = 0;
  for (let i = 0; i < 300; i++) {
    const q = L._makeQuest();
    types[q.form.type] = 1; arches[q.arch] = 1;
    if (q.vars.dist < 0 || q.vars.dist > 10 || q.vars.hold < 0 || q.vars.hold > 10) bad++;
    if (q.met !== L._evalCond(q.form, q.vars, q.n)) bad++;
  }
  is(Object.keys(types).sort(), ['and', 'not', 'or'], '★ 三種條件都出得到');
  is(Object.keys(arches).sort(), ['advanced', 'basic'], '★ 基礎版與進階版都出得到');
  ok(bad === 0, '   偵測值都在範圍內，而且 met 和實際算的一致');

  /* ⚠️ 用數字不用真假：只有真假的話總共才四種組合，玩兩局就背起來了。 */
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const q = L._makeQuest({ type: 'and' });
    seen.add(q.vars.dist + ',' + q.vars.hold);
  }
  ok(seen.size > 40, '★ 同一種條件下的數字組合夠多（' + seen.size + ' 種）—— 背不起來');

  /* 條件的文字要跳脫過，不然「< 3　<b>」會被當成標籤。 */
  ok(L.FORMS.every(f => f.text.indexOf('<b>') >= 0 ? !/[^&]lt;|[^;]<[ 　]/.test(f.text) : true),
     '★ 條件的文字用 &lt; 不用裸的 <（不然瀏覽器會當成標籤開頭）');
}

/* ── 真的掛起來走一遍 ─────────────────────────────── */
section('★ 掛起來玩一局');
{
  const host = document.getElementById('h');
  let passed = 0;
  const sim = L.mount(host, { need: 3, onPass: () => { passed++; } });

  ok(/如果/.test(host.querySelector('.lg-code').textContent), '程式碼畫出來了');
  ok(host.querySelectorAll('[data-pick]').length === 2, '兩個動作可以選');
  ok(host.querySelectorAll('.lg-book div').length === 3, '邏輯寶典三格（且／或／不成立）');
  ok(host.querySelectorAll('.lg-book div.on').length === 1,
     '★ 目前這一題的那一格會亮起來');

  /* 猜錯 → 扣體力，而且要把正確答案講出來。 */
  const met0 = sim._state().met;
  host.querySelector('[data-pick="' + (met0 ? 'no' : 'yes') + '"]').onclick();
  is(sim._state().hp, 4, '★ 猜錯 → 體力 −1');
  is(sim._state().worms, 0, '   沒有吃到蟲');
  ok(/條件其實/.test(host.querySelector('.lg-msg').textContent), '   而且講出正確答案');

  /* 一路答對到過關 */
  let g = 0;
  while (g++ < 80 && !sim._state().passed) {
    const st = sim._state();
    if (st.answered) { host.querySelector('#lg-next').onclick(); continue; }
    host.querySelector('[data-pick="' + (st.met ? 'yes' : 'no') + '"]').onclick();
  }
  is(passed, 1, '★ 吃到 3 隻蟲 → 過關');
  is(sim._state().seen, { and: true, or: true, not: true },
     '★★ 三種條件都遇過才放行 —— 只練「且」的話，「或」和「不成立」等於沒教');
  sim.destroy();
}

section('★ 慢動作答錯不扣體力');
{
  /* ⚠️ 慢動作是在幫他想，不是考試。
     扣體力的話，學生就不敢按那顆按鈕 —— 而最需要它的正是不敢按的那個。 */
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = L.mount(host, { need: 3 });
  host.querySelector('#lg-slow').onclick();
  const st = L._traceSteps({ form: L.FORMS[0], vars: sim._state() && { dist: 0, hold: 0 }, n: 3, met: false });
  const before = sim._state().hp;
  /* 兩個答案都按一次，一定有一次是錯的 */
  host.querySelector('[data-yn="y"]').onclick();
  if (host.querySelector('[data-yn="n"]')) host.querySelector('[data-yn="n"]').onclick();
  is(sim._state().hp, before, '★ 慢動作裡答錯，體力沒有變');
  ok(st.length >= 2, '   （慢動作至少兩步）');
  sim.destroy(); host.remove();
}

/* ── 關卡資料 ─────────────────────────────────────── */
section('★ 第 4 關（4-3-1）接得上');
{
  const lv = LV['4-3-1'];
  is(lv.lab, { kind: 'logic', need: 5 }, '★ 第 4 關掛的是條件判斷實驗室');
  ok(!lv.material, '★ 不再掛 logic.html（原檔已刪，內容改寫進 logiclab.js）');
  ok(!fs.existsSync(path.join(ROOT, '11502', 'logic.html')), '★ 11502/logic.html 已刪');

  const lvHtml = fs.readFileSync(path.join(ROOT, '11502', 'level.html'), 'utf8');
  ok(/logiclab\.js/.test(lvHtml), '關卡頁載得到這一支');
  ok(/lab\.kind === 'logic'/.test(lvHtml), '   labMod 認得 logic');

  /* ★ 實驗室教的「或」，正是這一關拼圖裡最容易拿錯的那塊誘餌。
     兩邊要對得起來 —— 對不起來的話，實驗室就不是為這一關做的。 */
  ok(lv.palette.indexOf('op.or') >= 0,
     '★ 這一關的調色盤上有「或」當誘餌 —— 實驗室先教會他分辨');
  const j = JSON.stringify(lv);
  ok(/或/.test(j) && /且/.test(j), '   關卡資料裡兩個都講到了');
  ok(L.FORMS.some(f => /第 4 關/.test(f.real)),
     '★ 實驗室的說明有指回第 4 關（學生要知道這是為哪一關練的）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
