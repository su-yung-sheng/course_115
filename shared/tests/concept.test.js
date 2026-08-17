/* 概念檢測考的是**概念**，不是程式語法
   跑法：node shared/tests/concept.test.js

   ★ 為什麼有這一份
     2026-08-17 老師試第 4 關時退回來：
       「概念檢測的問題都是還沒寫的程式，這樣一樣無法判斷，
         重要的是概念，不是程式語法解說。」
     查下來六題全中：
       「如果把『且』換成『或』」「兩個造型放反會怎樣」
       「把『隱藏』搬到最前面會發生什麼事」「『當分身產生』這塊帽子積木…」
     ⚠️ 關鍵在**順序**：關卡的步驟是
          情境 → 推導／實驗室 → 概念檢測 → 程式拼圖 → 實作
        概念檢測排在**程式拼圖之前**。
        學生手上根本還沒有那支程式，卻被要求對它做假設性的修改 ——
        他要先在腦中把程式拼出來，才回答得了。
        答不出來不代表他不懂概念，只代表他還沒看過那些積木。

   ★ 這一份和 taught.test.js 的分工
     taught：這個**名詞**前面出現過沒有？（完全沒教過就考 → 硬傷）
     這一份：這個**問法**要不要先有程式才答得出來？（教過了，但問錯層次）
     兩者都只是地板 —— 題目好不好，還是要人看。

   ⚠️ 這一份只掃**題幹**（q）。
      hint／why 裡出現積木名字是刻意的：那是答完之後的解說，
      正是要把概念接回等一下要拼的程式。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'));
const L = global.window.BLOCK_LEVELS;
const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
               '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];

/** 題幹的純文字（去標籤） */
const stem = q => String(q.q || '').replace(/<[^>]+>/g, '');

/* ── ① 題幹不可以指著一支還沒出現的程式 ───────────────
   ⚠️ 每一條都要寫清楚**為什麼**它是程式語法而不是概念，
      不然下次有人加題目時只會覺得這份測試在找碴。 */
const BAN = [
  ['帽子積木', '積木的種類要到拼圖那一步才看得到'],
  ['那一塊', '「那一塊」指的是一塊學生還沒拿到的積木'],
  ['這塊', '同上'],
  ['放反', '要先看過兩格的排列，才知道什麼叫「放反」'],
  ['搬到', '對一支還沒拼過的程式做假設性的搬動'],
  ['迴圈', '「迴圈」是程式的說法 —— 實驗室是用手做的，沒有迴圈'],
  ['變數', '同上：學生看到的是「一個會變的紀錄」，不是變數'],
  ['程式碼', '概念檢測的時候還沒有任何程式碼']
];

section('★★ 題幹不可以指著一支還沒出現的程式');
ORDER.forEach((id, n) => {
  const qs = L[id].quiz || [];
  let bad = [];
  qs.forEach((q, i) => {
    /* 「積木1」是 Scratch 的**預設名字**，第 1 關拿它問命名 —— 那是概念題。
       先把它拿掉再檢查「積木」。 */
    const t = stem(q).replace(/積木\s*1/g, '');
    BAN.forEach(([w, why]) => {
      if (t.indexOf(w) >= 0) bad.push('Q' + (i + 1) + '「' + w + '」（' + why + '）');
    });
    if (/積木/.test(t)) bad.push('Q' + (i + 1) + '「積木」（拼圖那一步才看得到）');
  });
  ok(bad.length === 0,
     '第 ' + (n + 1) + ' 關 ' + id + '：' + qs.length + ' 題' +
     (bad.length ? '　⚠️ ' + bad.join('；') : ''));
});

section('★★ 第 4 關（老師退回重寫的那一關）');
{
  const qs = L['4-3-1'].quiz || [];
  const all = qs.map(stem).join(' ');
  /* ⚠️ 這幾句是原本的題幹，是這次要修掉的東西本身。
     它們再出現就是改回去了。 */
  [['把「且」換成「或」', '原本要學生對著程式想像修改'],
   ['放反', '造型兩格放反'],
   ['搬到最前面', '把「隱藏」搬到最前面'],
   ['這塊帽子積木', '「當分身產生」那一塊']
  ].forEach(([s, why]) => {
    ok(all.indexOf(s) < 0, '★★ 不再出現「' + s + '」—— ' + why);
  });

  /* ★ 改成什麼：條件題要能用生活情境回答 */
  ok(/遊樂設施|身高夠/.test(all),
     '★★ 「且／或」改成用生活規定問（遊樂設施：身高夠且有大人陪）');
  ok(/嘴巴/.test(all) && /整隻鳥/.test(all),
     '★ 「碰到顏色」那一題改成問兩種判斷範圍的差別');
  ok(/一定|保證/.test(all),
     '★ 「如果…否則」那一題改成問它保證了什麼（二選一，一定會做其中一件）');
  ok(/兩個時機/.test(all),
     '★ 副程式那一題改成問「同一件事有兩個時機」的代價');
  ok(/複製本尊當下/.test(all),
     '★★ 分身那一題先把規則講出來，再讓學生照著推 —— 而不是問他程式長怎樣');

  /* ★★ 學生自己做過的事，要真的被引用到 */
  const refs = qs.map(q => q.ref);
  ok(refs.indexOf('derive') >= 0,
     '★★ 有題目引用推導（那是他自己按出來的結論，比情境解說更有力）');
  ok(refs.indexOf('lab') >= 0, '★ 也有題目引用邏輯實驗室');
}

section('★★ 引用框不可以是空的（ref 寫錯不會報錯，只會安靜地不顯示）');
{
  /* ⚠️ 2026-08-17 我自己就寫錯過：第 10 關兩題寫了 ref:'play'，
     而 refBox 只認得 scene／write／lab／derive／數字 ——
     不認得的值不會報錯，那一題的引用框就這樣安靜地消失。 */
  const KNOWN = ['scene', 'write', 'lab', 'derive'];
  ORDER.forEach((id, n) => {
    const qs = L[id].quiz || [];
    const bad = [];
    qs.forEach((q, i) => {
      const r = q.ref;
      if (r === undefined || r === null) return;
      const tag = 'Q' + (i + 1);
      if (typeof r === 'number') {
        const a = (L[id].analysis || {}).qs || [];
        if (!a[r]) bad.push(tag + '→ 問題分析第 ' + (r + 1) + ' 題（不存在）');
        return;
      }
      if (KNOWN.indexOf(r) < 0) { bad.push(tag + "→ '" + r + "'（認不得）"); return; }
      /* 認得歸認得，來源也要真的有東西 */
      if (r === 'scene' && !(L[id].scene || {}).why) bad.push(tag + '→ 情境沒有 why');
      if (r === 'write' && !((L[id].analysis || {}).write || {}).q) bad.push(tag + '→ 沒有問題分析的收尾');
      if (r === 'lab' && !L[id].lab) bad.push(tag + '→ 這一關沒有實驗室');
      if (r === 'derive' && !L[id].derive) bad.push(tag + '→ 這一關沒有推導');
    });
    ok(bad.length === 0,
       '第 ' + (n + 1) + ' 關 ' + id + ' 的 ref 都指得到東西' +
       (bad.length ? '　⚠️ ' + bad.join('；') : ''));
  });
}

section('★ quiz.js 真的認得 derive');
{
  const src = fs.readFileSync(path.join(ROOT, 'shared', 'quiz.js'), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, ' ');   /* ⚠️ 先去註解，不然註解掩護 */
  ok(/ref === 'derive'/.test(src), "★★ refBox 有處理 ref === 'derive'");
  ok(/lv\.derive\.done/.test(src), '★ 引的是推導的收尾（done），不是步驟裡的答案');
  ok(/lab\.kind === 'logic'/.test(src),
     '★ 邏輯實驗室（第 4 關）也接上了 —— 之前它會掉進 SORTLAB 的分支拿到空的');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
