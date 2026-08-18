/* 哪些欄位可以放 HTML、哪些不行
   跑法：node shared/tests/textfield.test.js

   ★ 為什麼有這一份（老師 2026-08-17）
     「第十關概念檢測的提示會出現 <b>ssssss</b> 這種標籤，
       其他關卡也會有這種排版問題嗎？」
     查下來：系統裡有**兩種**輸出方式，而課程資料要配合哪一種，
     從欄位名字上完全看不出來 ——
       · 跳脫輸出（esc()）：寫 <b> 會讓學生看到「<b>」三個字
       · 直接 innerHTML：寫 <b> 才會變粗體
     同一天還踩過另一種：**粗體** 到處都不會轉（系統沒有 markdown），
     所以那個寫法在**兩種**輸出下都是壞的。

   ⚠️ 這種錯不會有任何錯誤訊息，測試也不會紅 ——
      它只是安安靜靜地讓學生看到一串標籤。
      ⇒ 把「哪一欄走哪一種」寫成明文，並且逐關掃。

   ★ 這份測試怎麼判
     ESCAPED：跳脫輸出的欄位 → 不可以有標籤（也不可以有 **）
     RAW    ：直接 innerHTML 的欄位 → 標籤可以，但不可以有 **
   ⚠️ 名單要跟著程式走：改了輸出方式（加／拿掉 esc）就要回來改這裡，
      不然這份測試會保護一個已經不存在的規則。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TAG = /<[a-z/][^>]*>/i;      // 看起來像 HTML 標籤
const MD = /\*\*/;                 // markdown 粗體（系統沒有轉換器）

global.window = {};
(0, eval)(read('11502/content/blocks.js'));
const L = global.window.BLOCK_LEVELS;
const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
               '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];

/* ── 跳脫輸出的欄位（寫標籤會被學生看到）─────────────── */
section('★★ 跳脫輸出的欄位不可以有 HTML 標籤');
{
  /* shared/quiz.js：
       esc(items[i].hint …)　→ 概念檢測的提示　← 老師看到的就是這裡
       esc(items[i].why …)　 →「📖 課本怎麼說」 */
  const bad = [];
  ORDER.forEach(id => {
    (L[id].quiz || []).forEach((q, i) => {
      ['hint', 'why'].forEach(k => {
        if (q[k] && TAG.test(q[k])) bad.push(id + ' Q' + (i + 1) + '.' + k);
      });
    });
  });
  ok(bad.length === 0,
     '★★ quiz 的 hint／why 沒有標籤（那兩欄是 esc 出去的）' +
     (bad.length ? '　⚠️ ' + bad.join('、') : ''));

  /* 真的跑一次 esc，確認它會把標籤變成字 —— 不是我以為而已 */
  const src = read('shared/quiz.js');
  ok(/esc\(items\[i\]\.hint/.test(src), '   quiz.js 的提示確實走 esc()');
  ok(/esc\(items\[i\]\.why/.test(src), '   「課本怎麼說」也是');
}

section('★ 直接 innerHTML 的欄位：標籤是對的，不要誤殺');
{
  /* ⚠️ 這一段刻意**反過來**驗：那幾欄本來就該能用 <b>。
     哪天有人「順手統一」把它們也 esc 掉，畫面上會冒出一堆標籤。 */
  const src = read('shared/derive.js');
  ok(/'<p class="dv-q">[\s\S]{0,80}\+ st\.q/.test(src) || /\+ st\.q/.test(src),
     '★ 推導的題目是直接接進 innerHTML（所以 <b> 是對的）');
  const q = read('shared/quiz.js');
  ok(/qz-q">' \+ it\.q/.test(q),
     '★ 概念檢測的「題目」也是直接接（和它的 hint 不一樣）');
  /* 至少要有幾關真的用了標籤 —— 不然這一條等於沒驗 */
  const used = ORDER.filter(id => TAG.test(JSON.stringify(L[id].analysis || {}) +
                                          JSON.stringify(L[id].derive || {})));
  ok(used.length >= 2, '★ 問題分析／推導確實在用標籤（' + used.length + ' 關）');
}

section('★★ 沒有人會轉 **粗體** —— 兩種輸出都不行');
{
  /* ⚠️ 系統沒有 markdown 轉換器：
       innerHTML → 星號原樣顯示　esc → 星號原樣顯示
     所以這個寫法在哪裡都是壞的。 */
  const bad = [];
  ORDER.forEach(id => {
    const v = L[id];
    [['task', v.task], ['scene.why', (v.scene || {}).why],
     ['scene.pre', (v.scene || {}).pre]].forEach(([k, t]) => {
      if (t && MD.test(t)) bad.push(id + '.' + k);
    });
    (v.build || []).forEach((t, i) => { if (MD.test(t)) bad.push(id + '.build[' + i + ']'); });
    (v.scene && v.scene.shots || []).forEach((t, i) => {
      if (MD.test(t)) bad.push(id + '.shots[' + i + ']');
    });
    (v.quiz || []).forEach((q, i) => ['q', 'hint', 'why'].forEach(k => {
      if (q[k] && MD.test(q[k])) bad.push(id + ' Q' + (i + 1) + '.' + k);
    }));
  });
  ok(bad.length === 0,
     '★★ 學生看得到的欄位沒有 **粗體**' + (bad.length ? '　⚠️ ' + bad.join('、') : ''));

  /* ⚠️ tips 例外：它只在 shared/blocks-demo.html（開發用試玩頁）顯示，
     學生看不到。要改也可以，但不該用「學生會看到」當理由。 */
  const tipsMd = ORDER.filter(id => (L[id].tips || []).some(t => MD.test(t)));
  ok(true, '（tips 有 ' + tipsMd.length + ' 關用了 **，但那一欄只有開發用的試玩頁在讀）');
}

section('★★ 互動模組裡的字串也一樣');
{
  /* ★ 模組自己寫的訊息也是講給學生看的 —— 同一條規則。
     ⚠️ 這裡只能掃原始碼，所以判得寬一點：
        找「單引號字串裡有 **」，避免把註解裡的說明算進去。 */
  const MODS = ['searchlab', 'sortlab', 'logiclab', 'minlab', 'bigfind', 'bigcost',
                'derive', 'quiz', 'blocks', 'combo'];
  const bad = [];
  MODS.forEach(m => {
    const f = 'shared/' + m + '.js';
    if (!fs.existsSync(path.join(ROOT, f))) return;
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
    (src.match(/'[^'\n]*'/g) || []).forEach(str => {
      if (MD.test(str)) bad.push(m + '：' + str.slice(0, 40));
    });
  });
  ok(bad.length === 0,
     '★★ 模組的訊息沒有 **粗體**' +
     (bad.length ? '\n       ' + bad.slice(0, 4).join('\n       ') : ''));

  /* answer.js／warmup.js 的訊息是**跳脫**出去的 → 連 <b> 都不行 */
  [['shared/answer.js', 'quiz.js 的 esc(x.why)'],
   ['shared/warmup.js', 'warmup.html 的 esc(r.why)']].forEach(([f, who]) => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const hits = (src.match(/why:\s*'[^']*<[a-z/][^']*'/gi) || []);
    ok(hits.length === 0,
       '★★ ' + f + ' 的訊息沒有標籤（它走 ' + who + '）' +
       (hits.length ? '　⚠️ ' + hits[0].slice(0, 50) : ''));
  });
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
