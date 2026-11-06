/* 段落閱讀模式的題庫：從「明碼原稿」產生網站用的資料檔（答案雜湊、說明加密）
   跑法：node shared/tools/build-read.js            （檢查，不改檔）
         node shared/tools/build-read.js --write    （寫出資料檔）

   ★ 老師 2026-11-06：資訊倫理改成「先閱讀課本段落，再出題；答錯說明為什麼」，11/25 之後上線。
   ★ 原稿放在 _textbook/read-src/（**不進 repo**，見 .git/info/exclude）：
       _textbook/read-src/ethics.json  → 11501/content/ethics.read.js
       _textbook/read-src/social.json  → 11502/content/social.read.js
     原稿格式（每一題的 o[0] 就是正解，好寫也好檢查）：
       { "1-1": { "src": "課本第一章 1-1（p.137～138）",
                  "paras": [ { "title": "倫理是什麼", "text": ["段落…", "段落…"],
                               "qs": [ { "q": "題目", "o": ["正解", "錯", "錯", "錯"], "ex": "說明" } ] } ] } }
   ★ 產生出來的資料檔裡：
       ‧ 選項順序**打亂**（不然 options[0] 永遠是正解，等於直接洩題）——用題目當種子，每次產生都一樣
       ‧ 正解 → a（ANSKEY.of 雜湊，和現有題庫同一把）
       ‧ 說明 → x（ANSKEY.seal：用正解當鑰匙加密，答錯時引擎才打開）
   ⚠️ 原稿裡有明碼答案，**絕對不可以**搬進 repo 裡任何地方。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ANSKEY = require(path.join(ROOT, 'shared', 'anskey.js'));

const JOBS = [
  { src: '_textbook/read-src/ethics.json', out: '11501/content/ethics.read.js', label: '11501 資訊倫理' },
  { src: '_textbook/read-src/social.json', out: '11502/content/social.read.js', label: '11502 媒體與社會議題' }
];
const TARGET = 10;        // 每一節要連對幾題，平均分到各段（老師 11-06：和原本「連續答對 10 題」同樣難度）
/** 第 pi 段要連續答對幾題（和 quiz-engine.js 的 readNeed 同一套算法） */
const needOf = (N, pi) => Math.max(1, Math.floor(TARGET / N) + (pi < TARGET % N ? 1 : 0));
const write = process.argv.indexOf('--write') >= 0;

/** 用題目當種子的洗牌：同一份原稿每次產生的順序都一樣（diff 才看得懂） */
function seededShuffle(arr, seed) {
  let h = parseInt(ANSKEY._fnv(seed + '::order'), 36) >>> 0 || 1;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let bad = 0, longest = 0;
/** 選項字數：和 qbank.test.js、levelpage.test.js 同一套（去掉空白與標點） */
/** 題幹、選項不可以出現的字眼（老師 11-06：題目不要有「課文說」之類的用語，或是「本章」這種寫法） */
const REF_WORDS = /課文|課本|本章|本節|書中|教材|依照|根據|文中|案例|新聞快報|漫畫|圖示|重點回顧|小知識/;
const optLen = t => String(t).replace(/[\s，。、？！（）()]/g, '').length;
JOBS.forEach(job => {
  const sp = path.join(ROOT, job.src);
  if (!fs.existsSync(sp)) { console.log('（還沒有原稿）' + job.src); return; }
  const SRC = JSON.parse(fs.readFileSync(sp, 'utf8'));
  const sections = {};
  let nq = 0;
  Object.keys(SRC).forEach(id => {
    const sec = SRC[id];
    const paras = (sec.paras || []).map((p, pi) => {
      if (!p.text || !p.text.length) { bad++; console.log('  ⚠️ ' + id + ' 第 ' + (pi + 1) + ' 段沒有課文'); }
      const need = needOf(sec.paras.length, pi);
      if (!p.qs || p.qs.length < need + 1) { bad++; console.log('  ⚠️ ' + id + ' 第 ' + (pi + 1) + ' 段要連對 ' + need + ' 題，題目至少要 ' + (need + 1) + ' 題（答錯要能換題）'); }
      const seen = {};
      const qs = (p.qs || []).map(q => {
        nq++;
        if (!q.q || !Array.isArray(q.o) || q.o.length !== 4 || !q.ex) {
          bad++; console.log('  ⚠️ 格式不對：' + JSON.stringify(q).slice(0, 60)); return null;
        }
        if (new Set(q.o.map(ANSKEY._norm)).size !== 4) { bad++; console.log('  ⚠️ 選項重複：' + q.q); }
        if (seen[q.q]) { bad++; console.log('  ⚠️ 同一段題目重複：' + q.q); }
        seen[q.q] = 1;
        /* ★ 選項長度不可以出賣答案（和 qbank.test.js 同一條規矩、同一套字數算法）：
             正解比最長的錯誤選項多 2 個字以上 ⇒ 擋下。學生用「選最長的」就能過關。 */
        const L = q.o.map(optLen), lead = L[0] - Math.max(L[1], L[2], L[3]);
        if (lead >= 2) { bad++; console.log('  ⚠️ 正解比別的選項長 ' + lead + ' 字：' + q.q); }
        if (lead > 0) longest++;
        /* ★ 題幹、選項不寫「課文說／依照課文／本章／課本…」（老師 11-06）：
             題目要自己站得住，不是叫學生回去對課本。答錯說明裡引用課文不受限。 */
        const ref = [q.q].concat(q.o).filter(t => REF_WORDS.test(t));
        if (ref.length) { bad++; console.log('  ⚠️ 題目或選項有「課文說」這類寫法：' + ref[0]); }
        const right = q.o[0];
        return { q: q.q, options: seededShuffle(q.o, q.q), a: ANSKEY.of(q.q, right), x: ANSKEY.seal(q.q, right, q.ex) };
      }).filter(Boolean);
      return { title: p.title || '', text: p.text || [], qs };
    });
    sections[id] = { src: sec.src || '', paras };
  });

  const body = '/* =====================================================================\n'
    + '   ' + job.label + ' · 段落閱讀模式的題庫（自動產生，請不要手改）\n'
    + '   ---------------------------------------------------------------------\n'
    + '   ★ 老師 2026-11-06：先閱讀課本段落、再出題；答錯公布正解和理由（11/25 起上線）。\n'
    + '   ★ 這一份是 shared/tools/build-read.js 從 _textbook/read-src/（不進 repo 的明碼原稿）產生的：\n'
    + '       a ＝ 正解的雜湊（同 shared/anskey.js）、x ＝ 用正解加密的答錯說明。\n'
    + '     要改題目 → 改原稿再跑 node shared/tools/build-read.js --write。\n'
    + '   ===================================================================== */\n'
    + 'window.QUIZ_READ = ' + JSON.stringify({ target: TARGET, sections }, null, 1) + ';\n';

  /* 產生完立刻驗：每一題都要能用 a 反查回正解、用正解打開說明 */
  const w = {};
  new Function('window', body)(w);
  let ok = 0, n = 0;
  Object.keys(w.QUIZ_READ.sections).forEach(id => w.QUIZ_READ.sections[id].paras.forEach(p => p.qs.forEach(q => {
    n++;
    const i = ANSKEY.find(q.q, q.options, q.a);
    if (i >= 0 && ANSKEY.open(q.q, q.options[i], q.x)) ok++;
  })));
  if (ok !== n) bad++;
  const first = Object.values(w.QUIZ_READ.sections).flatMap(s => s.paras.flatMap(p => p.qs));
  const leak = first.length && first.every(q => ANSKEY.check(q.q, q.options[0], q.a));
  if (leak) { bad++; console.log('  ⚠️ 每一題的第一個選項都是正解 —— 洗牌沒有作用'); }
  console.log(job.label + '：' + Object.keys(sections).length + ' 節、' + nq + ' 題；驗證 ' + ok + '／' + n
              + (ok === n ? ' ✅' : ' ❌') + '（正解是最長選項的 ' + longest + ' 題）');
  longest = 0;
  if (write) { fs.writeFileSync(path.join(ROOT, job.out), body, 'utf8'); console.log('  已寫出 ' + job.out); }
});
if (!write) console.log('（這是檢查模式，沒有改檔。要寫出資料檔請加 --write）');
if (bad) console.log("❌ 有 " + bad + " 個問題");
process.exit(bad ? 1 : 0);
