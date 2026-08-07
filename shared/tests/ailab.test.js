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

/* ── 這一頁不碰 Gemini 金鑰 ─────────────────────────
   ★ 「直接打 Gemini」那條路拿掉了。
     它要把金鑰貼進瀏覽器，而且測到的不是學生會遇到的東西 ——
     中間少了 GAS 的攔截。它唯一的價值是「看得到原始回覆」，
     那件事改由 DEBUG_KEY 做，而且走的是真正的管線。 */
ok(!/AIzaSy/.test(html), '★ 檔案裡沒有任何金鑰');
ok(!/generativelanguage\.googleapis\.com/.test(html),
   '★ 這一頁不再直接呼叫 Gemini —— 金鑰只留在 GAS 的指令碼屬性裡');
ok(!/sessionStorage/.test(html), '   所以也不需要 sessionStorage 存金鑰了');
ok(/localStorage\.setItem\(k/.test(html), '通行碼與偵錯碼記在這台瀏覽器（不必一直輸入）');

/* ── 偵錯碼：兩把碼不能混用 ─────────────────────────
   QUERY_KEY 會出現在學生的頁面上；DEBUG_KEY 只有老師知道。
   用同一把的話，學生也看得到被擋下的原始回覆，擋下就沒意義了。 */
ok(/id="dbgKey"/.test(html), '有偵錯碼欄位');
ok(/DEBUG_KEY/.test(html) && /不要把它寫進 config\.js/.test(html),
   '★ 畫面上要講明偵錯碼不可以寫進 config.js');
ok(/res\.raw/.test(html), '帶了偵錯碼時要顯示模型原始的回覆');
ok(/被擋原因/.test(html), '   以及被擋的原因');
ok(/checkReply\(res\.raw \|\| res\.text/.test(html),
   '★ 檢查的對象要是原始回覆 —— 檢查安全提示沒有意義，它一定是乾淨的');
ok(/p\.dbg = dbg; if \(mdl\) p\.model = mdl/.test(html),
   '★ 沒有偵錯碼就不送 model —— 不然學生可以指定一個沒有限制的模型');
ok(/byKeys/.test(html), '關鍵概念全中（沒問 AI）的情況要標出來');

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
ok(!/name="via"/.test(html), '★ 不再有「兩條路」的選擇 —— 全部走 GAS');
ok(/action: 'ask', unit: x\.id, qi: x\.qi/.test(html),
   '★ 走 GAS 時只送「哪一關、第幾問、寫了什麼」，不送題目也不送 forbid');
ok(/\$\('forbid'\)\.disabled/.test(html) || /disabled/.test(html),
   '   forbid 欄位改不了（伺服器自己抓）');
ok(/res\.blocked/.test(html), '★ 被 GAS 擋下的回覆要標出來（那本身就是測試結果）');

/* ── 錯誤訊息要能診斷 ─────────────────────────────── */
ok(/誰可以存取.*任何人/.test(html), 'GAS 要求登入時，訊息要指出是部署設定的問題');

/* ── 提示詞：兩邊各有一份，要提醒可能不一致 ─────────
   前端 ai-guide.js 一份（測試台用）、GAS aiguide.gs 一份（真正在跑的）。
   這是刻意的重複 —— 但重複就會走鐘，所以畫面上要講。 */
ok(/aiguide\.gs/.test(html), '★ 有提醒「提示詞真正的來源是 GAS 那一份」');
ok(/__lastPrompt/.test(html), '   帶了偵錯碼時，直接顯示 GAS 實際送出的提示詞');

/* ── 版本比對 ───────────────────────────────────────
   ★ 為什麼這一條重要
     GAS 編輯器裡的程式碼和「部署的那個版本」是兩回事。
     貼了新程式卻忘了重新部署，selfTest 測起來一切正常，
     /exec 卻還是舊行為 —— 而且完全看不出來。
     2026-08-07 就是卡在這裡：模型 0.8 秒回得又快又好，
     前端卻一直 Failed to fetch。 */
const gs = fs.readFileSync(path.join(ROOT, 'shared', 'aiguide.gs'), 'utf8');
const vLab = (html.match(/EXPECT_VERSION = '([^']+)'/) || [])[1];
const vGas = (gs.match(/var VERSION = '([^']+)'/) || [])[1];
ok(!!vGas, 'aiguide.gs 有版本字串');
ok(!!vLab, '測試台知道自己預期哪一版');
ok(vLab === vGas, '★ 兩邊的版本字串要一致（' + vLab + ' / ' + vGas + '）');
ok(/version: VERSION/.test(gs), 'ping 會把版本回報出來');
ok(/部署的是舊版/.test(html), '★ 版本不符時要明講「部署的是舊版」，並給重新部署的步驟');
ok(/新增部署作業.*另一個網址|另一個網址/.test(html),
   '   並且提醒不要按「新增部署作業」（會換網址）');

/* 冷卻原因：403 和 429 意思完全不同 */
ok(/why: \(c && c !== '1'\) \? c : ''/.test(gs), 'GAS 會記下冷卻的原因');
ok(/403/.test(html) && /429/.test(html), '★ 測試台要分得出 403（要去修）和 429（等一下就好）');

/* ── 用 POST，不用 GET ───────────────────────────────
   ★ 2026-08-07 實測：同一個 /exec，
       ?action=ping&key=…                    → 正常回 JSON
       ?action=ask&key=…&unit=…&answer=中文 → Google 雲端硬碟的錯誤頁，
                                               「執行項目」裡完全沒有紀錄
     編輯器裡跑同一段程式 1.2 秒回 906 字元，完全正常 ——
     所以問題在「把這些參數放進網址」這件事，不在程式。 */
ok(/r = await fetch\(url, \{ redirect/.test(html), '★ 先用 GET（已知 ping 通的那一條）');
ok(/method: 'POST'/.test(html), '   GET 失敗才換 POST 再試一次');
ok(/　GET：/.test(html) && /　POST：/.test(html),
   '★ 兩種送法的錯誤都要印出來 —— 只印一種等於下次還要再猜一輪');
ok(/x-www-form-urlencoded/.test(html),
   '★ 用 form 編碼 —— application/json 會觸發 CORS 預檢，而 GAS 不處理 OPTIONS');
ok(!/'Content-Type': 'application\/json'/.test(html), '   確認沒有用 json 的 Content-Type');
ok(/URLSearchParams/.test(html), '參數用 URLSearchParams 組');

const gs2 = fs.readFileSync(path.join(ROOT, 'shared', 'aiguide.gs'), 'utf8');
ok(/function doPost\(e\)\s*\{\s*return handle_\(e\);/.test(gs2),
   '★ GAS 那邊不必改 —— doPost 收到的 e.parameter 和 doGet 一樣');

/* ── sid 是 Google 的保留參數 ────────────────────────
   ★ 2026-08-07 花了一個下午才找到。
     網址帶著 sid= 時，請求在到達 Apps Script **之前** 就被
     Google 的路由層處理掉：
       · 瀏覽器看到雲端硬碟的「很抱歉，目前無法開啟這個檔案」
       · Apps Script 的「執行項目」裡完全沒有紀錄
       · 指令碼裡的 try/catch 一點忙都幫不上
     同一個網址把 &sid=lab 拿掉就正常。

   ⚠️ 這種「請求根本沒進到程式」的錯誤，從程式裡看不見任何東西 ——
      所以要靠測試把它釘住，不要有人日後又順手改回 sid。 */
ok(!/[?&]sid=/.test(html), '★ 前端的網址不可以有 sid=');
ok(!/sid: '/.test(html), '★ 送出去的參數也不可以叫 sid');
ok(/student/.test(html), '學號改用 student');
ok(/保留參數/.test(html), '畫面或註解要寫下原因，不然日後有人會改回去');

const gs3 = fs.readFileSync(path.join(ROOT, 'shared', 'aiguide.gs'), 'utf8');
ok(/p\.student \|\| p\.sid/.test(gs3),
   'GAS 兩個都收 —— 舊網址不要默默壞掉（但新的一律用 student）');
ok(/保留參數/.test(gs3), 'GAS 裡也寫下原因');


/* 2026-08-07：十則測試全部顯示「沒抓到問題」，卻看不出
   一次都沒走到「關鍵概念全中」那條路。畫面要說出來。 */
ok(/res\.hasKeys/.test(html), '★ 卡片要顯示「講到了什麼、還缺什麼」');
ok(/還缺/.test(html), '   缺的那幾項要寫出來 —— 那就是 AI 該問的方向');
ok(/keys: x\.keys/.test(html), '   題目清單要把 keys 一起帶著');
ok(/p\.fromKeys/.test(html), '★ 「全部講到」那一則要依現在選的那一問自動組');
ok(/EXPECT_VERSION = '2026-08-07-refuse'/.test(html), '版本字串跟著 GAS 一起改');
ok(/2026-08-07-refuse/.test(gs3), '   GAS 那邊也是');
ok(/角色名稱/.test(gs3), '★ GAS 的提示詞也要有「不可以自己編角色名稱」（兩份都要改）');

ok(/REFUSE_HEAD/.test(gs3), '★ GAS 也要有「拒絕的固定開頭」');
ok(/t\.indexOf\(REFUSE_HEAD\) === 0/.test(gs3), '   而且 GAS 的字數檢查也要扣掉它（真正擋人的是這一份）');
ok(/2026-08-07-refuse/.test(gs3) && /2026-08-07-refuse/.test(html), '版本兩邊一起改');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
