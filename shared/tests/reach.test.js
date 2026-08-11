/* 連結圖：每一支檔案都有人連得到嗎？
   跑法：node shared/tests/reach.test.js

   ★ 為什麼需要這一份 —— 2026-08-11 的教訓
     `cyberethics_new.html` / `social_new.html` 是「已經寫好、也推上去、
     但沒有任何地方連得到」的頁面。同時 `cyberethics.html` 這支**有人連**
     的頁面自己內嵌了一份題庫。

     結果：花一整輪改好的 300 題選項，學生一題都沒看到。
     沒有任何錯誤訊息，因為兩支檔案都好好的 —— 壞掉的是「誰連到誰」。

   ★ 這一份做的事
     從真正的入口（index.html、各學期 hub.html、登入頁）出發，
     照 href／src 一路走下去，把走得到的檔案標記起來。
     走不到的就列出來 —— 那些是「改了也沒有人會看到」的檔案。

   ⚠️ 孤兒不一定是錯的。有些檔案是刻意留著的（教師端工具、
      給學生自己開的輔助頁）。所以清單裡有一份 KNOWN ——
      **要放進 KNOWN 就得寫一行理由**，不能只是加個檔名讓紅字消失。
      這一條規矩才是這份測試真正的價值：
      逼你每次都回答「這支檔案為什麼可以沒有人連」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const SKIP_DIR = ['node_modules', '.git', '_archive', 'course_11501', 'course_11502', 'docs', 'tests'];

/** 真正的入口：使用者打得到網址的地方 */
const ENTRY = [
  'index.html',
  '11501/hub.html',
  '11502/hub.html'
];

/**
 * 沒有人連、但**刻意**留著的檔案。
 * ⚠️ 每一筆都要寫理由。寫不出理由的，就是該刪或該接上去的。
 */
const KNOWN = {
  'stu_gmail_login_08.html': '課堂用的 Gmail 登入練習單，老師上課時直接給網址，不掛在系統裡',
  'stu_gmail_practise_08.html': '同上，Gmail 操作練習',
  '11501/scratch_ScratchGrader_teacher.html': '教師端的批改工具，從 teacher.html 開',
  /* ⚠️ 2026-08-11：這裡曾經有 11501/music.html，理由寫「沒人連」——
     那是錯的。它是第 3 關（演奏小星星）的參考教材，
     由 content/flowchart.js 的 ref.href 指過去、嵌成 iframe。
     當時的路徑解析寫錯（見 refs() 裡的 ⚠️），才把它算成孤兒。
     ★ 教訓：要往 KNOWN 加東西之前，先確認「真的沒有人連」，
       不要因為工具說沒有就相信 —— 工具也會錯。 */
  '11501/thinking.ipynb': 'Colab 筆記本，不是網頁',
  'shared/backend.ipynb': 'Colab AI 批改後端，不是網頁（兩學期共用一本）',
  'shared/template.html': '新增頁面用的空白範本，本來就不該被連到',
  'shared/blocks-demo.html': '積木模擬器的開發用試玩頁，只有改 blocks.js 時自己開',
  'shared/ai-lab.html': 'AI 引導的調校台，改提示詞時自己開；學生端不該連得到',
  '11502/content/flowchart.js': '刻意留的空檔：下學期沒有逐關流程圖，' +
    '留一支同名空檔並寫明原因，免得看起來像漏掉（見檔案開頭的說明）'
};

/* ── 走訪 ──────────────────────────────────────────── */
const seen = new Set();
const queue = [];

function norm(p) { return p.replace(/\\/g, '/').replace(/^\.\//, ''); }
function push(p) {
  p = norm(p);
  if (seen.has(p)) return;
  seen.add(p);
  queue.push(p);
}
ENTRY.forEach(push);

/** 從一支檔案裡找出它引用了哪些**本地**檔案 */
function refs(file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return [];
  if (!/\.(html|js)$/.test(file)) return [];
  /* ⚠️ 一定要先去掉註解。
     第一版沒去，於是 hub.html 裡的
       「教師專用入口（學生看不到）：成績登錄系統請直接開啟 teacher.html」
     這一句**註解**被算成一條連結，teacher.html 就被判定「有人連得到」——
     整張連結圖跟著失真。
     被註解提到不等於連得到，這件事這個 repo 這學期已經踩過三次了
     （levelpage 測到註解、flowchart 測到註解，加上這一次）。 */
  const src = fs.readFileSync(abs, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
  const out = [];
  const dir = norm(path.dirname(file));
  /* href="…" / src="…" / '…/xxx.html' 都算。
     ⚠️ 也要抓字串裡拼出來的路徑（teacher.html 的按鈕、hub 的資料表都是那樣寫的）。 */
  const re = /(?:href|src)\s*=\s*["']([^"'#?]+)|["']((?:\.{0,2}\/)?[\w./-]+\.(?:html|js))["']/g;
  let m;
  while ((m = re.exec(src))) {
    let p = m[1] || m[2];
    if (!p || /^(https?:|mailto:|data:|javascript:|\/\/)/.test(p)) continue;
    /* ⚠️ 相對路徑要相對「誰」，沒有單一答案。
       content/flowchart.js 裡寫 href:'music.html'，那是**資料**，
       真正拿去用的是上一層的 flowchart.html —— 所以它指的是
       11501/music.html，不是 11501/content/music.html。

       第一版只用「這個檔案自己的資料夾」去解，於是
       11501/music.html 被判定成沒有人連的孤兒，而我照著它刪掉了
       一個**第 3 關（演奏小星星）正在用的參考教材**。
       ⇒ 依序試「自己的資料夾 → 上一層 → repo 根」，取第一個真的存在的。
         寧可多算一個連得到，也不要誤刪。 */
    const bases = [dir === '.' ? '' : dir, path.posix.dirname(dir), ''];
    for (const b of bases) {
      const cand = norm(path.posix.join(b === '.' ? '' : b, p));
      if (fs.existsSync(path.join(root, cand))) { out.push(cand); break; }
    }
  }
  return out;
}

while (queue.length) {
  const f = queue.shift();
  refs(f).forEach(r => { if (fs.existsSync(path.join(root, r))) push(r); });
}

/* ── 盤點 ──────────────────────────────────────────── */
const all = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (SKIP_DIR.includes(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); return; }
    if (!/\.(html|js|ipynb)$/.test(e.name)) return;
    all.push(norm(path.relative(root, p)));
  });
})(root);

section('連結圖');
ok(seen.size > 10, '從入口走得到 ' + seen.size + ' 支檔案');
ENTRY.forEach(e => ok(fs.existsSync(path.join(root, e)), '入口存在：' + e));

section('★ 沒有人連得到的檔案');
{
  const orphan = all.filter(f => !seen.has(f) && !KNOWN[f]);
  ok(orphan.length === 0,
     '★ 沒有孤兒檔（改了也沒人看得到的檔案）' +
     (orphan.length ? '　←　' + orphan.join('、') : ''));
  if (orphan.length) {
    console.log('     這幾支要嘛接上去、要嘛刪掉、要嘛加進 KNOWN 並寫明理由。');
    console.log('     ⚠️ 加進 KNOWN 之前先問一次：它和某支「有人連」的檔案是不是重複的？');
    console.log('       2026-08-11 那次就是 —— cyberethics_new.html 沒人連，');
    console.log('       而有人連的 cyberethics.html 是它的舊複本。');
  }
}
{
  /* KNOWN 也會過期：檔案刪了、或後來被接上去了，就該從清單移走。
     ⚠️ 留著沒用的例外，下次真的出問題時你會以為「這支本來就在例外裡」。 */
  const gone = Object.keys(KNOWN).filter(f => !fs.existsSync(path.join(root, f)));
  ok(gone.length === 0, 'KNOWN 裡沒有已經不存在的檔案' + (gone.length ? '　←　' + gone.join('、') : ''));
  const linked = Object.keys(KNOWN).filter(f => seen.has(f));
  ok(linked.length === 0,
     'KNOWN 裡沒有其實已經被連到的檔案（那就不必當例外了）' +
     (linked.length ? '　←　' + linked.join('、') : ''));
}

section('★ 合併之後的殘留');
{
  /* 兩個舊 repo 併進來時留下的資料夾。.gitignore 擋著不進版控，
     但本機還在 —— 而「本機還在」正是誤開舊檔的來源。 */
  ['course_11501', 'course_11502'].forEach(d => {
    const there = fs.existsSync(path.join(root, d));
    if (there) console.log('     （本機還留著 ' + d + '/，未進版控；確認無誤後可整個刪掉）');
  });
  /* 有沒有人真的引用到那兩個舊資料夾 —— 那才是會出事的。 */
  const bad = [];
  all.forEach(f => {
    /* ⚠️ 一樣要去註解。註解裡寫「這裡以前是 course_11501/…，2026-08-11 改掉了」
       是**應該留下的說明**，不該讓它自己把測試打成紅字。
       （這一份第一版就犯過兩次同樣的錯：連結圖把註解算成連結、
         這一條把說明算成引用。） */
    const src = fs.readFileSync(path.join(root, f), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/[^\n]*/gm, ' ');
    if (/course_115\d\d\//.test(src)) bad.push(f);
  });
  ok(bad.length === 0,
     '★ 沒有任何檔案引用到 course_11501/ 或 course_11502/' +
     (bad.length ? '　←　' + bad.join('、') : ''));
}
{
  /* 帶學期前綴的舊檔名（11501_flowchart.html 這種）。
     check.py 也有一條在盯，這裡再從「連結」的角度看一次。 */
  const bad = all.filter(f => /\/115\d\d_[\w-]+\.html$/.test('/' + f));
  ok(bad.length === 0,
     '★ 沒有帶學期前綴的舊檔名（合併時已經去掉）' + (bad.length ? '　←　' + bad.join('、') : ''));
}

section('★ 共用的東西只有一份');
{
  /* 兩學期同名的頁面，如果內容幾乎一樣，就該搬進 shared/。
     ⚠️ 這一條不強制，只提醒 —— 有些同名頁本來就該各寫一份
        （hub.html 的科目清單、config.js）。
        但「幾乎一樣」的那幾支值得每次都被問一次。 */
  const a = new Set(all.filter(f => f.startsWith('11501/')).map(f => f.slice(6)));
  const b = new Set(all.filter(f => f.startsWith('11502/')).map(f => f.slice(6)));
  const both = [...a].filter(f => b.has(f));
  const near = [];
  both.forEach(f => {
    const s1 = fs.readFileSync(path.join(root, '11501', f), 'utf8');
    const s2 = fs.readFileSync(path.join(root, '11502', f), 'utf8');
    if (Math.abs(s1.length - s2.length) < Math.max(s1.length, s2.length) * 0.05 && s1.length > 4000) {
      near.push(f + '（' + s1.length + ' vs ' + s2.length + ' 字）');
    }
  });
  ok(true, '兩學期同名檔 ' + both.length + ' 支');
  if (near.length) {
    console.log('     ⚠️ 大小幾乎一樣的有：' + near.join('、'));
    console.log('       這幾支值得看一眼 —— 兩份幾乎相同的程式，改的時候一定會漏一邊。');
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
