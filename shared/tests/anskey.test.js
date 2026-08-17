/* 選擇題的答案不可以是明碼
   跑法：node shared/tests/anskey.test.js

   ★ 為什麼有這一份（老師 2026-08-17）
     資訊倫理與媒體議題那兩個模組是選擇題，而這個 repo 是**公開**的。
     題庫原本寫成 { "q": …, "options": […], "correct": 2 }——
     學生按 F12 → Sources，或在 Console 打一行 QUIZ_CONTENT，
     791 題連答案一次印出來。討論「要不要擋複製」之前，
     這才是最短的那一條路。

   ⚠️ 這一層擋的是「隨手看」，不是「破解」。
      雜湊函式和 SALT 都在前端，對四個選項各算一次雜湊就能反推 ——
      教師端的統計頁用的正是這個方法（qstat.js 的 bank()）。
      ★ 所以這份測試釘的是「答案不可以被直接讀出來」，
        不是「答案安全」。要擋死得送後端驗證，那是另一件工程。

   這份測試釘四件事
     ① 內容檔裡不可以再出現明碼答案（correct）
     ② 每一題都要能用 a 反查回唯一一個選項
     ③ 判分引擎真的走雜湊那條路
     ④ 教師端還看得到正確答案（不然老師沒辦法備課） */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ANSKEY = require(path.join(ROOT, 'shared', 'anskey.js'));

const FILES = [
  ['11501/content/ethics.js', '資訊倫理（上學期）'],
  ['11502/content/social.js', '媒體與社會議題（下學期）']
];

/** 載入內容資料檔（它是 `window.QUIZ_CONTENT = {…}`） */
function load(rel) {
  const w = {};
  new Function('window', read(rel))(w);
  return w.QUIZ_CONTENT;
}
function allQuestions(C) {
  const out = [];
  ((C || {}).chapters || []).forEach(ch => {
    (ch.sections || []).forEach(s => (s.questions || []).forEach(q => out.push([q, s.id || s.title])));
    if (ch.challenge) (ch.challenge.questions || []).forEach(q => out.push([q, ch.id + ' 整章挑戰']));
  });
  return out;
}

section('★★ 內容檔裡不可以有明碼答案');
FILES.forEach(([rel, name]) => {
  const src = read(rel);
  /* ⚠️ 直接掃原始碼，不是掃載入後的物件 ——
     學生看到的就是這份原始碼，這裡才是真正的洩漏點。 */
  const plain = (src.match(/"correct":\s*\d+/g) || []).length;
  ok(plain === 0, name + '：沒有 "correct": n' + (plain ? '　⚠️ 還有 ' + plain + ' 處' : ''));
  const hashed = (src.match(/"a":\s*"[a-z0-9]+"/g) || []).length;
  ok(hashed > 100, '　　　答案換成雜湊了（' + hashed + ' 題）');
});

section('★★ 每一題都要能用 a 反查回**唯一**一個選項');
FILES.forEach(([rel, name]) => {
  const qs = allQuestions(load(rel));
  let miss = [], dup = [];
  qs.forEach(([q, where]) => {
    let hit = 0;
    (q.options || []).forEach(o => { if (ANSKEY.check(q.q, o, q.a)) hit++; });
    if (hit === 0) miss.push(where + '｜' + String(q.q).slice(0, 18));
    /* ⚠️ 兩個選項算出同一個雜湊 = 這一題有兩個「正確答案」。
       選項文字重複也會這樣（那本來就是出題的錯，要抓出來）。 */
    if (hit > 1) dup.push(where + '｜' + String(q.q).slice(0, 18));
  });
  ok(qs.length > 100, name + '：' + qs.length + ' 題');
  ok(miss.length === 0, '　　　每一題都對得回一個選項' +
     (miss.length ? '　⚠️ ' + miss.length + ' 題找不到：' + miss.slice(0, 2).join('；') : ''));
  ok(dup.length === 0, '★★ 　沒有一題對到兩個選項' +
     (dup.length ? '　⚠️ ' + dup.length + ' 題：' + dup.slice(0, 2).join('；') : ''));
});

section('★ 雜湊本身');
{
  ok(ANSKEY.of('題目', '選項') === ANSKEY.of('題目', '選項'), '同樣的輸入算出同樣的值');
  ok(ANSKEY.of('題目', '選項A') !== ANSKEY.of('題目', '選項B'), '不同選項算出不同的值');
  ok(ANSKEY.of('題目一', '選項') !== ANSKEY.of('題目二', '選項'), '★ 題目不同也要不同 —— 不然換一題就能沿用答案');
  /* 排版改動不該讓答案對不上（去標籤、去空白與標點） */
  ok(ANSKEY.of('題目', '選 項') === ANSKEY.of('題目', '選項'), '多一個空白仍然對得上');
  ok(ANSKEY.of('題目', '<b>選項</b>') === ANSKEY.of('題目', '選項'), '包了標籤仍然對得上');
  /* ★ 和 qstat 的題目 id 一定要算出不一樣的值 —— 兩把鑰匙不可以是同一把 */
  const w = {};
  new Function('window', read('shared/qstat.js'))(w);
  const qid = w.QSTAT.id('資訊倫理主要目的為何？');
  ok(qid !== ANSKEY.of('資訊倫理主要目的為何？', '維持資訊社會的秩序與和諧'),
     '★★ 答案雜湊和 qstat 的題目 id 不一樣（統計 id 是公開的，不可以拿來當答案）');
}

section('★★ 判分引擎真的走雜湊');
{
  const src = read('shared/quiz-engine.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
  /* ⚠️ 一定要連左括號一起比：寫成 /ANSKEY\.check/ 的話，
     把它改成 ANSKEY.checkX（一個不存在的函式）測試照樣綠 ——
     突變測試就是這樣抓到的。 */
  ok(/ANSKEY\.check\(/.test(src), '★★ checkAnswer 走 ANSKEY.check()');
  ok(/function isRight/.test(src), '   判分抽成一支 isRight（兩種題庫都吃）');
  /* 網頁要真的載得到 anskey.js，而且要排在引擎前面 */
  [['11501/cyberethics.html', '資訊倫理'], ['11502/social.html', '媒體與社會議題']].forEach(([f, name]) => {
    const h = read(f);
    const iA = h.indexOf('anskey.js'), iE = h.indexOf('quiz-engine.js');
    ok(iA >= 0, name + ' 有載 anskey.js');
    ok(iA >= 0 && iA < iE, '　　而且排在 quiz-engine 前面（不然判分時它還沒到）');
  });
}

section('★★ 複製的每一條出口都要擋到');
{
  /* ★ 老師 2026-08-17 問「Ctrl+C 可偵測，那滑鼠右鍵？」
     右鍵選單的「複製」一樣會觸發 copy 事件 —— 所以攔 copy 就夠了，
     那是**出口**，不管從哪條路過來都會經過。
     ⚠️ 但拖曳不是：選取文字之後直接拖進別的視窗走的是 dragstart，
        copy 完全不會被觸發。那一條是問到右鍵時才想到的。 */
  const src = read('shared/quiz-engine.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
  [['copy', 'Ctrl+C 與右鍵選單的「複製」'],
   ['cut', '剪下'],
   ['dragstart', '★★ 選取後直接拖到別的視窗（不會觸發 copy）']
  ].forEach(([ev, why]) => {
    ok(new RegExp("addEventListener\\('" + ev + "'").test(src), '攔得到 ' + ev + '：' + why);
  });
  ok(/preventDefault/.test(src), '   而且真的擋下來（不是只記次數）');

  /* ⚠️ 刻意**不**攔右鍵與選取 —— 那會把朗讀器、翻譯、長按選字一起關掉，
     而這一章正好在教「資訊近用權」。有人哪天順手加上去要能被擋下來。 */
  ok(!/addEventListener\('contextmenu'/.test(src),
     '★★ 沒有攔 contextmenu（右鍵選單裡有朗讀與翻譯，而複製那條路已經擋了）');
  /* ⚠️ 要去掉註解再看 —— 註解裡正好寫著「刻意不用 user-select:none」，
     連著註解一起掃的話這一條永遠紅（第一版就是這樣）。
     ★ 這是「不可以出現 X」型的檢查最常見的自傷方式：講到它的那句話本身。 */
  ok(!/user-select\s*:\s*none/.test(src),
     '★★ 沒有用 user-select:none（那會讓螢幕朗讀器一起失效）');
}

section('★★ 題庫不可以整批留在 window 上');
{
  /* ★ 老師 2026-08-17：「還有什麼可能的漏洞？」
     擋複製擋的是一題一題，但題庫本來整份掛在 window ——
     Console 打一行 QUIZ_CONTENT（或 QUIZ.content）就是 370 題一次帶走。
     ⚠️ 這一條擋的是「考試當下順手一行」，
        **不是**「拿不到題庫」——content/*.js 是公開檔案，
        view-source 或直接開 GitHub 都讀得到（repo 是公開的）。 */
  const src = read('shared/quiz-engine.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/delete window\.QUIZ_CONTENT/.test(src),
     '★★ 引擎讀完就把 window.QUIZ_CONTENT 刪掉');
  ok(!/content:\s*C\b/.test(src),
     '★★ window.QUIZ 沒有再把整份題庫端出去（content: C）');
  ok(!/nodes:\s*NODES/.test(src),
     '★★ 也沒有端出 nodes（那是同一份題目換個名字）');

  /* 真的跑一次：把引擎載進一個假的 window，看題庫還在不在。
     ⚠️ 引擎會去動 DOM，所以只驗到「刪掉那一步」就好 —— 用最小的替身。 */
  const w = {
    QUIZ_CONTENT: { moduleId: 'x', chapters: [] },
    CONFIG: {}, document: null
  };
  try {
    new Function('window', read('shared/quiz-engine.js'))(w);
  } catch (e) { /* 後面一定會因為沒有 DOM 而中斷，那不影響這一條 */ }
  ok(w.QUIZ_CONTENT === undefined,
     '★★ 載入之後 window.QUIZ_CONTENT 真的不見了（實得 ' +
     (w.QUIZ_CONTENT === undefined ? 'undefined' : '還在') + '）');
}

section('★★ 老師還看得到答案');
{
  /* ⚠️ 把答案藏起來之後，教師端的題目統計頁也會看不到正確選項 ——
     那就從「防作弊」變成「老師不能備課」了。 */
  const q = read('shared/qstat.js');
  ok(/ANSKEY\.find/.test(q), '★★ qstat 用 ANSKEY.find 反查正確選項');
  ok(/it\.correct != null/.test(q), '   舊題庫還有 correct 的話照舊用它');
  const h = read('shared/qstat.html');
  ok(/anskey\.js/.test(h), '★★ 統計頁有載 anskey.js（不然 find 是 undefined）');

  /* 真的跑一次：拿第一題進去，反查得到的索引要指到正確選項 */
  const w = {};
  new Function('window', read('shared/anskey.js'))(w);
  new Function('window', read('shared/qstat.js'))(w);
  const C = load('11502/content/social.js');
  const bank = w.QSTAT._bank ? w.QSTAT._bank(C) : null;
  if (bank) {
    const one = Object.values(bank)[0];
    ok(one && one.correct >= 0, '★ 統計用的題庫算得出正確選項（第一題：第 ' +
       ((one || {}).correct + 1) + ' 個）');
  } else {
    /* _bank 沒有匯出就退一步，直接驗 ANSKEY.find */
    const [q0] = allQuestions(C)[0];
    ok(ANSKEY.find(q0.q, q0.options, q0.a) >= 0, '★ ANSKEY.find 找得到正確選項');
  }
}

section('★ 轉換工具還在，而且會自己檢查');
{
  const t = read('shared/tools/hash-answers.js');
  ok(/--write/.test(t), '★ 預設是檢查模式，要加 --write 才改檔');
  ok(/反查得回答案/.test(t), '★★ 寫回之後會重新載入驗一次（不是寫完就算了）');
  ok(/new Function\('window'/.test(t), '   用 new Function 載入，不用間接 eval');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
