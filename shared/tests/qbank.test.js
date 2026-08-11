/* 章節測驗的題庫（11501 資訊倫理 / 11502 媒體與社會議題）
   跑法：node shared/tests/qbank.test.js

   ★ 為什麼有這一份 —— 2026-08-11 的教訓
     2026-08-09 花了一整輪把 300 題的選項長度改成「不會出賣答案」，
     改的是 content/ethics.js 和 content/social.js。
     兩天後才發現：**學生一題都沒看到。**

     hub 連到的 cyberethics.html / social.html 各自內嵌了一份 1200 行的
     題庫與流程；content/*.js 只有 cyberethics_new.html / social_new.html
     會讀，而沒有任何地方連到 _new。
     也就是說「改好的那一份」和「跑起來的那一份」是兩份不同的檔案，
     而且沒有任何東西在盯著它們一不一樣。

     實際的落差：
       cyberethics.html  141 題中 65 題正解明顯較長
       content/ethics.js 140 題中  0 題

   ⇒ 這一份守兩件事：
       ① 題庫本身的規矩（選項長度、選項數、答案索引、整章挑戰要對得上節）
       ② **沒有任何 HTML 自己內嵌題庫** —— 那正是上面那件事發生的方式 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

function load(rel) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(root, rel), 'utf8'))(w);
  return w.QUIZ_CONTENT;
}
/** 選項字數：和 levelpage.test.js 用同一套算法（去掉空白與標點） */
const len = t => String(t).replace(/[\s，。、？！（）()]/g, '').length;

const BANKS = [
  ['11501 資訊倫理', '11501/content/ethics.js'],
  ['11502 媒體與社會議題', '11502/content/social.js']
];

BANKS.forEach(([name, rel]) => {
  const C = load(rel);
  section(name);

  /* 把「節」和「整章挑戰」的題目都收進來一起檢查。
     ⚠️ 只檢查節的話會漏掉整章挑戰 —— 而學生拿星星靠的正是整章挑戰。 */
  const all = [];
  (C.chapters || []).forEach(ch => {
    (ch.sections || []).forEach(s =>
      (s.questions || []).forEach(q => all.push({ q, at: name + ' ' + (s.id || s.title) })));
    if (ch.challenge)
      (ch.challenge.questions || []).forEach(q =>
        all.push({ q, at: name + ' ' + (ch.title || ch.id) + '（整章挑戰）' }));
  });
  ok(all.length > 100, '題目載得進來（' + all.length + ' 筆，含整章挑戰）');

  ok(all.every(x => (x.q.options || []).length === 4), '每題都是四個選項');
  ok(all.every(x => x.q.correct >= 0 && x.q.correct < (x.q.options || []).length),
     '答案索引都在範圍內');
  ok(all.every(x => x.q.q && x.q.q.length > 4), '每題都有題目文字');

  /* ★ 選項長度不可以出賣答案。
     ⚠️ 這一條 2026-08-09 修好過一次，但修在沒人讀的檔案上 ——
        所以現在由測試盯著，而且盯的是**真的會被讀到的那一份**。 */
  {
    const bad = [];
    all.forEach(x => {
      const L = (x.q.options || []).map(len);
      if (L.length !== 4) return;
      const lead = L[x.q.correct] - Math.max(...L.filter((_, i) => i !== x.q.correct));
      if (lead >= 2) bad.push(x.at + '「' + x.q.q.slice(0, 16) + '」正解長 ' + lead + ' 字');
    });
    ok(bad.length === 0,
       '★ 正解不可以明顯比別的選項長（學生用「選最長的」就能過關）' +
       (bad.length ? '　←　' + bad.length + ' 題，例如 ' + bad[0] : ''));
  }

  /* 整章挑戰 = 各節的題目合起來。
     ⚠️ 這兩份如果各自維護，改了節卻忘了改挑戰，
        學生會在挑戰裡遇到「已經被我改掉的舊題目」。 */
  (C.chapters || []).forEach(ch => {
    if (!ch.challenge || !(ch.sections || []).length) return;
    const secQ = [];
    ch.sections.forEach(s => (s.questions || []).forEach(q => secQ.push(q.q)));
    const chQ = new Set((ch.challenge.questions || []).map(q => q.q));
    const miss = secQ.filter(q => !chQ.has(q));
    ok(miss.length === 0,
       '   ' + (ch.title || ch.id) + ' 的整章挑戰涵蓋所有小節題目' +
       (miss.length ? '　←　少了 ' + miss.length + ' 題' : ''));
  });
});

/* ── ★ 沒有頁面可以自己內嵌題庫 ───────────────────
   這一條就是上面那整件事的守門員。
   題庫只能有一份，而且只能在 content/*.js 裡。
   ⚠️ 用「題目物件長什麼樣」來找，不是用檔名 ——
      新開一支頁面照樣會被抓到。 */
section('★ 題庫只能有一份（沒有頁面自己內嵌）');
{
  const hit = [];
  const walk = dir => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', '_archive', 'course_11501', 'course_11502'].includes(e.name)) return;
        walk(p);
        return;
      }
      if (!/\.html$/.test(e.name)) return;
      const src = fs.readFileSync(p, 'utf8');
      /* 題庫的形狀：{ q: "…", options:[…] } 或 { question: "…", options:[…] }。
         ⚠️ 2026-08-11：原本只認 `q:`，於是漏掉 11502/flowchart.html ——
            那一頁用的是 `question:`，25 題就這樣躲過整個檢查。
            這條規則的重點是「題庫只能有一份」，不是「某個欄位名」——
            只認一種寫法的話，換個欄位名就繞過去了。 */
      const n = (src.match(/\{\s*(?:q|question):\s*["'][\s\S]{0,300}?options:\s*\[/g) || []).length;
      if (n >= 3) hit.push(path.relative(root, p).replace(/\\/g, '/') + '（' + n + ' 題）');
    });
  };
  walk(root);
  ok(hit.length === 0,
     '★ 沒有 HTML 自己內嵌題庫 —— 兩份題庫一定會走鐘，而且走鐘的那一份不會有人發現' +
     (hit.length ? '　←　' + hit.join('、') : ''));
}

/* ── 引擎版必須真的被連到 ───────────────────────
   ⚠️ shared/quiz-engine.js 曾經有整整一段時間是「架構文件寫著兩學期共用、
      實際上沒有任何學生在跑」的死程式。文件不會告訴你這件事，
      只有「誰連到誰」會。 */
section('★ hub 連到的就是用共用引擎的那一頁');
[['11501/hub.html', '11501'], ['11502/hub.html', '11502']].forEach(([hub, term]) => {
  const src = fs.readFileSync(path.join(root, hub), 'utf8');
  const m = src.match(/id:\s*'ethics'[\s\S]{0,300}?href:\s*'([^']+)'/);
  ok(!!m, hub + ' 找得到章節測驗的連結');
  if (!m) return;
  const target = path.join(root, term, m[1]);
  ok(fs.existsSync(target), '   連到的檔案存在（' + m[1] + '）');
  if (!fs.existsSync(target)) return;
  const page = fs.readFileSync(target, 'utf8');
  ok(/quiz-engine\.js/.test(page),
     '★ ' + m[1] + ' 用的是共用引擎 —— 不是自己一份 1200 行的複本');
  ok(/content\/(ethics|social)\.js/.test(page),
     '   而且題庫讀的是 content/*.js（那才是我們在改的那一份）');
});

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
