/* 運算思維舊集合（artifacts/comp-think-app/public/data/progress、progress_sem2）收緊
   跑法：node shared/tests/ctprogress.test.js

   ★ 2026-09-28 老師選「原地收緊」：路徑、資料都不搬，規則改成
     只能寫名冊上自己的「班級_座號_姓名」那一份（firestore.rules 的 ctOwnDoc）。
   ⚠️⚠️ 這條規則靠學生頁面**每一次寫入都帶 sid**。漏一處，那一處發布後就
      permission-denied —— 而且只是主控台一行紅字（證書網址補不回去、
      通關紀錄沒寫進去），學生和老師都不會發現。⇒ 這裡逐處檢查。
   ⚠️ 這台環境拿不到 Firestore 模擬器（下載被擋），規則的**行為**沒有實跑；
      發布前請在 Console 的「規則測試區」照 README 那兩個情境各試一次。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

section('① 規則');
const R = strip(read('shared/firestore.rules'));
const fnKey = (R.match(/function ctKeyOf\(sid\) \{[\s\S]*?\n    \}/) || [''])[0];
ok(/get\(\/databases\/\$\(database\)\/documents\/roster\/\$\(sid\)\)\.data/.test(fnKey),
   '★★ 從跨學期共用的 /roster 讀本人的班級座號姓名');
ok(/string\(r\.cls\) \+ '_' \+ string\(r\.no\) \+ '_' \+ string\(r\.name\)/.test(fnKey),
   '★★★ 和 thinking.html 的 `${cls}_${no}_${name}` 同一個組法（數字的班級座號也要 string()）');
const fnOwn = (R.match(/function ctOwnDoc\(docId\) \{[\s\S]*?\n    \}/) || [''])[0];
ok(/request\.resource\.data\.get\('sid', ''\)/.test(fnOwn), '★★ sid 取自「寫入之後」的文件（合併過的）');
ok(/isOwner\(sid\)/.test(fnOwn) && /ctKeyOf\(sid\) == docId/.test(fnOwn),
   '★★★ 兩個都要：sid 是登入者本人，而且文件 id 就是他在名冊上的那一個');
for (const col of ['progress', 'progress_sem2']) {
  const blk = (R.match(new RegExp('match /artifacts/\\{appId\\}/public/data/' + col + '/\\{docId\\} \\{[\\s\\S]*?\\n    \\}')) || [''])[0];
  ok(!!blk, `找得到 ${col} 的規則`);
  ok(/allow create, update: if isTeacher\(\) \|\| ctOwnDoc\(docId\);/.test(blk),
     `★★★ ${col}：寫入只給老師或本人（原本是 isSignedIn()：任何人改任何人）`);
  ok(!/allow (create|update|write)[^;]*: if isSignedIn\(\);/.test(blk), `★★★ ${col}：不可以再有 isSignedIn() 就能寫的那一條`);
  ok(/allow read: if isSignedIn\(\);/.test(blk), `★★ ${col}：讀照舊（「班級過關紀錄查詢」要讀全班）`);
  ok(/allow delete: if isTeacher\(\);/.test(blk), `★ ${col}：刪除只給老師`);
}

ok(!/studentProgress_115_2/.test(R), '★★ 11502 任務確認表的規則已刪（沒人在用，卻開著任何人都能寫）');

section('② 學生頁面：每一處寫進舊集合的都帶 sid');
for (const [f, col] of [['11501/thinking.html', 'progress'], ['11502/thinking.html', 'progress_sem2']]) {
  const S = read(f);
  /* 找出每一個指向舊集合「單一文件」的 doc(...)，往後看到第一個 setDoc 或 getDoc */
  const re = /fbStore\.doc\(fbStore\.db,\s*'artifacts',\s*'comp-think-app',\s*'public',\s*'data',\s*'([a-z_0-9]+)'/g;
  let m, writes = 0, bad = [];
  while ((m = re.exec(S))) {
    ok(m[1] === col, `${f}：寫的是 ${col}（不是另一個學期的）`);
    const before = S.slice(Math.max(0, m.index - 250), m.index);
    const after = S.slice(m.index, m.index + 1400);
    /* 兩種寫法：const progressRef = doc(...) 之後 setDoc(progressRef, {...})；
                 或 setDoc(doc(...), {...}) 直接寫 */
    const inline = /setDoc\(\s*$/.test(before);
    const viaRef = /^fbStore\.doc[^\n]*\);\s*[\s\S]{0,40}?(\/\*[\s\S]*?\*\/\s*)?(const updateData = \{|await fbStore\.setDoc\(progressRef)/.test(after)
      || (/const progressRef = $/.test(before.trimEnd() + ' ') && /setDoc\(progressRef/.test(after.slice(0, 1200)) && !/getDoc\(progressRef/.test(after.slice(0, 400)));
    if (!inline && !viaRef) continue;                 // 讀取（getDoc）不用帶
    writes++;
    const obj = inline ? after.slice(0, 500) : after.slice(0, 1200);
    if (!/\bsid: user\.sid\b/.test(obj)) bad.push(S.slice(0, m.index).split('\n').length);
  }
  ok(writes === 3, `${f}：找到 3 處寫入（通關、補回網址、雲端硬碟找回）—— 實際 ${writes}`);
  ok(bad.length === 0, `★★★ ${f}：每一處都帶 sid: user.sid（沒帶的行號：${bad.join(',') || '無'}）`);
}

section('③ 11502：user 裡要有 sid（原本沒有）');
const S2 = read('11502/thinking.html');
ok(/name: cachedMe\.name, sid: cachedMe\.sid,/.test(S2), '★★★ 快速通道（有快取）的初始 user 帶 sid');
ok(/const doLogin = async \(classRoom, seatNo, name, sid\) =>/.test(S2) && /setUser\(\{ classRoom, seatNo, name, docId, sid \}\)/.test(S2),
   '★★★ doLogin 收 sid、放進 user');
ok(/doLogin\(cachedMe\.cls, cachedMe\.no, cachedMe\.name, cachedMe\.sid\)/.test(S2)
   && /doLogin\(me\.cls, me\.no, me\.name, me\.sid\)/.test(S2)
   && !/doLogin\([^)]*name\)/.test(strip(S2)),
   '★★ 兩個呼叫的地方都把 sid 傳進去');
ok((S2.match(/sid: user\.sid \|\| \(window\.SSO && SSO\.sid\(\)\) \|\| ''/g) || []).length === 3,
   '★ 萬一 user 裡還是沒有，退回 SSO.sid()');
const S1 = read('11501/thinking.html');
ok(/setUser\(\{ classRoom, seatNo, name, docId, sid \}\)/.test(S1), '★★ 11501 的 user 本來就有 sid');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
