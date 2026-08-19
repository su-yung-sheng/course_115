/* 學期鎖：測試帳號要進得去，一般學生要被擋
   跑法：node shared/tests/semlock.test.js  （需要 jsdom）

   ★ 2026-08-10 實際踩到的：測試帳號被自己的學期鎖擋在門外。
     順序問題 —— semester.js 同步執行，auth.js 非同步登入，
     鎖跑的時候 sessionStorage 裡根本還沒有 sid。
     「測試帳號豁免」那個出口寫了，但打不開。 */
'use strict';
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

const src = fs.readFileSync(path.join(__dirname, '..', 'semester.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };

/** 開一個頁面，回傳「有沒有被擋」
    src2：要跑的原始碼（預設就是線上那一份）。
    傳別的進來是為了驗「機制還在，只是清單空的」—— 見最下面那一段。 */
function blocked(term, sid, src2) {
  const dom = new JSDOM('<body></body>',
    { url: 'https://x/course_115/' + term + '/hub.html' });
  const w = dom.window;
  w.CONFIG = { TERM: term };
  // jsdom 的頂層視窗本來就 self === top，不必（也不能）指派
  if (sid) w.sessionStorage.setItem('sid' + term, sid);
  /* ⚠️ semester.js 用的是裸的 document／sessionStorage
     （在瀏覽器裡就是 window.* ，但在這裡要自己接上）。
     少接一個的話，那一段會丟例外而不是擋人 ——
     而 sessionStorage 那一行外面包著 try，
     例外會被吞掉、sid 讀成 null，於是「沒擋到」看起來像通過。
     ⇒ 測試工具沒接好，會把真正的行為蓋掉。 */
  global.document = w.document;
  global.window = w;
  global.sessionStorage = w.sessionStorage;
  try {
    new Function('window', src2 || src)(w);
    /* DOMContentLoaded 的回呼裡也用到裸的 document，
       所以 global 要留到觸發完才拆。 */
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  } finally {
    delete global.document; delete global.window; delete global.sessionStorage;
  }
  return /先擋下來/.test(w.document.body.innerHTML);
}

console.log('\n── 現在是上學期（11501），開下學期的頁面 ──');
/* ★ 2026-08-19 老師回報：「不是有學期鎖？為什麼還能進到 hub.html？」
   舊版是「沒有 sid 就放行，等下一次載入」，而 hub.html 正是登入發生的
   那一頁 —— 它永遠等不到下一次。清單既然是空的，就沒有理由讓任何人
   先進到門內：進站就擋，連登入畫面都不該出現。 */
ok(blocked('11502', null),
   '★ 還沒登入也擋 —— 清單是空的，沒有測試帳號要放行就不必等身分（hub 的洞在這裡）');
ok(blocked('11502', '1410905'),
   '★ 1410905 也被擋 —— 2026-08-19 測試帳號已關閉，它現在就是一般學生');
ok(blocked('11502', '1410112'),
   '★ 一般學生擋下 —— 不然進度會記到錯的學期');

console.log('\n── 開當學期的頁面 ──');
ok(!blocked('11501', '1410112'), '一般學生放行');
ok(!blocked('11501', '1410905'), '1410905 開當學期的頁面照樣進得去（關的是跨學期特權，不是帳號）');

/* ── 機制還在，只是清單空的 ────────────────────────────
   ⚠️ 上面那三條只證明「現在沒有人繞得過鎖」。
      它們沒辦法分辨兩種情況：
        ① 清單是空的（現在這樣）
        ② 有人把整個豁免出口刪掉了
      兩種在測試上長得一模一樣，但 ② 會讓「下次要驗下學期」直接沒路走，
      而且要等到 2027 年 2 月前才會發現。
   ⇒ 把原始碼裡的 TEST_IDS 填回一個學號再跑一次：出口該打得開。 */
console.log('\n── 豁免出口本身還在嗎（把清單填回去試一次）──');
const reopened = src.replace(/var TEST_IDS = \[\];/, "var TEST_IDS = ['1410905'];");
ok(reopened !== src, '   改得動 —— TEST_IDS 的寫法還是 var TEST_IDS = [];');
ok(!blocked('11502', '1410905', reopened),
   '★ 填回學號就放行 —— 豁免機制沒被拆掉，只是現在沒人在清單裡');
ok(blocked('11502', '1410112', reopened),
   '   而且填回去之後，別的學號還是擋著（不是整條鎖失效）');
/* 寬限只在「有測試帳號要放行」的時候存在 —— 那是它唯一的理由。
   ⚠️ 2026-08-10 的坑：鎖跑在 auth.js 之前，那時 isTestAccount(null)
      永遠是 false，豁免出口打不開。所以清單有人的時候必須等 sid。 */
ok(!blocked('11502', null, reopened),
   '★ 清單有人的時候才「還沒登入先不擋」—— 不然測試帳號會被自己的鎖擋在門外');

/* ── 登入的當下要當場再問一次（hub.html 的洞）────────────
   ⚠️ 上面那條寬限一開，hub.html 就又有洞了：進站沒 sid（放行）、
      登入後 hub 自己接手畫面不重新整理 → 這一次載入的鎖早就跑完。
   ⇒ auth.js 寫進 sessionStorage 的當下要呼叫 SEMESTER.enforce()。 */
console.log('\n── 登入當下的補檢查 ──');
const authSrc = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
ok(/SEMESTER\.enforce\(sid, \{ redirect: true \}\)/.test(authSrc),
   '★ auth.js 寫入 sid 之後會呼叫 SEMESTER.enforce(sid, {redirect:true})');
ok(/setItem\('sid' \+ term, sid\);[\s\S]{0,900}?SEMESTER\.enforce/.test(authSrc),
   '   而且是**寫進 sessionStorage 之後**才問（順序反了就問到舊身分）');
ok(/global\.SEMESTER && global\.SEMESTER\.enforce/.test(authSrc),
   '★ 要先確認 SEMESTER 存在 —— teacher.html 刻意不載入 semester.js，少了這層會炸掉');
ok(/typeof SEMESTER[\s\S]{0,80}enforce|enforce: enforce|SEMESTER\.enforce = enforce/.test(src),
   '   semester.js 真的把 enforce 掛出去了（不然上面那行永遠是 undefined）');

console.log('\n── 原始碼 ──');
ok(/if \(!sid && TEST_IDS\.length\) return false;/.test(src),
   '★ 寬限綁在 TEST_IDS.length 上 —— 清單空的時候不寬限，這是補掉 hub 那個洞的關鍵');
ok(/auth\.js（非同步登入）|非同步|hub\.html 正好就是/.test(src),
   '   而且註解要講明為什麼（順序問題）');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
