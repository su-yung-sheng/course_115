/* AI 引導測試台（shared/ai-lab.html）
   跑法：node shared/tests/ailab.test.js

   ★ 這一頁會碰到金鑰，所以「東西存在哪裡」要有測試盯著。
     金鑰外流的後果是別人拿去跑自己的東西、帳單算你的。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'shared', 'ai-lab.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };

/* ── 金鑰與通行碼分開放 ─────────────────────────────
   兩者風險不同：
     · Gemini 金鑰 → sessionStorage，關掉分頁就沒（外流＝別人燒你的額度）
     · GAS 通行碼 → localStorage，記著就好（它本來就會出現在學生頁面上） */
ok(/sessionStorage\.setItem\('ailab\.key'/.test(html), '★ Gemini 金鑰存 sessionStorage（關掉分頁就沒）');
ok(/localStorage\.setItem\('ailab\.gaskey'/.test(html), 'GAS 通行碼存 localStorage（不必一直輸入）');
ok(!/localStorage[^\n]*ailab\.key'/.test(html), '★ 金鑰絕對不可以進 localStorage');
ok(!/AIzaSy/.test(html), '★ 檔案裡沒有任何金鑰');

/* ── 網址讀 config，不必手動輸入 ─────────────────── */
ok(/CONFIG \|\| \{\}\)\.AIGUIDE/.test(html), 'GAS 網址讀自 config.js');
ok(/src="\.\.\/11502\/config\.js"/.test(html), '   而且真的有載入 config.js');

const cfg = {};
new Function('window', fs.readFileSync(path.join(ROOT, '11502', 'config.js'), 'utf8'))(cfg);
const A = (cfg.CONFIG || {}).AIGUIDE || {};
ok(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(A.GAS_URL || ''),
   'config.js 的 AIGUIDE.GAS_URL 是 /exec 結尾的部署網址');
ok(typeof A.KEY === 'string', 'AIGUIDE.KEY 這一欄存在（留空＝功能關閉）');

/* ── 兩條路 ───────────────────────────────────────── */
ok(/name="via" value="gas" checked/.test(html), '★ 預設走 GAS —— 那才是學生實際會遇到的路');
ok(/askViaGas/.test(html), '有走 GAS 的實作');
ok(/action: 'ask', unit: x\.id, qi: x\.qi/.test(html),
   '★ 走 GAS 時只送「哪一關、第幾問、寫了什麼」，不送題目也不送 forbid');
ok(/\$\('forbid'\)\.disabled = g/.test(html),
   '   所以 GAS 模式下 forbid 欄位要鎖起來，免得以為改了有用');
ok(/res\.blocked/.test(html), '★ 被 GAS 擋下的回覆要標出來（那本身就是測試結果）');
ok(/SHEET_ID/.test(html), '   並且說明原始回覆要去哪裡看');

/* ── 錯誤訊息要能診斷 ─────────────────────────────── */
ok(/誰可以存取.*任何人/.test(html), 'GAS 要求登入時，訊息要指出是部署設定的問題');

/* ── 提示詞：兩邊各有一份，要提醒可能不一致 ─────────
   前端 ai-guide.js 一份（測試台用）、GAS aiguide.gs 一份（真正在跑的）。
   這是刻意的重複 —— 但重複就會走鐘，所以畫面上要講。 */
ok(/伺服器組的|aiguide\.gs/.test(html), '★ 有提醒「提示詞真正的來源是 GAS 那一份」');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
