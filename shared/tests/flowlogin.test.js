/* flowchart.html 不可以再出現那個沒有功能的登入頁
   跑法：node shared/tests/flowlogin.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const SRC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
/* ⚠️ 要剝註解：這一版的說明文字裡就寫著「status='login'」「驗證碼」，
   不剝的話全部斷言都會被自己的註解咬到（這個 repo 的老坑）。 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

console.log('── 程式設計頁的舊登入殘留 ──');

section('★★ 那個登入頁沒有功能，不可以再出現');
/* ⚠️⚠️ 2026-08-26 老師回報：「進入程式設計時會短暫出現舊的輸入學號頁面，
      然後跳走」。查下來那個頁面**完全沒有功能**：
        ‧ 它要比對名冊的 code 欄位，但驗證碼在 2026-08-04 已整套移除
          → 永遠停在「此學號尚未設定驗證碼」，叫學生去做不存在的事
        ‧ guard.js 早就擋掉沒登入的人，根本走不到「真的需要登入」
      它會閃現是因為 autoLogin() 要跑兩次 Firestore 讀取，
      超過 2.5 秒就被逾時搶先換成登入頁。 */
ok(!/handleLogin/.test(CODE), '沒有 handleLogin（驗證碼比對）');
ok(!/tempCode|tempId/.test(CODE), '沒有學號／驗證碼的暫存欄位');
ok(!/status\s*===?\s*'login'/.test(CODE), "沒有 login 這個畫面狀態");
ok(!/驗證碼/.test(CODE), '學生看不到「驗證碼」字樣（那套已經移除）');

section('★ 連線慢的時候只補提示，不換畫面');
ok(/slowNote/.test(CODE), '有「連線比較慢」的提示欄位');
const t25 = CODE.match(/setTimeout\([^]{0,200}?2500\)/);
ok(!!t25 && /slowNote/.test(t25[0]) && !/location\.replace/.test(t25[0]),
   '★★ 2.5 秒的逾時只改提示文字，不跳轉也不換畫面');

section('★ 但也不能讓學生卡在永遠不動的畫面');
const t10 = CODE.match(/setTimeout\([^]{0,400}?10000\)/);
ok(!!t10 && /location\.replace/.test(t10[0]),
   '10 秒還沒進來就導回闖關基地重新登入');

section('★ 登出要回闖關基地');
const lo = CODE.match(/function logout\(\)[^]{0,400}?\n    \}/);
ok(!!lo && /location\.replace/.test(lo[0]) && !/status\s*=\s*'login'/.test(lo[0]),
   '★ logout 導回 hub，不是切回本頁的登入畫面');

section('★ hub 自己的登入頁要留著（那才是真的登入的地方）');
const HUB = fs.readFileSync(path.join(ROOT, '11501', 'hub.html'), 'utf8');
ok(/status\s*===?\s*'login'/.test(HUB), 'hub.html 仍然有 login 狀態');
ok(!/type="password"[^>]*maxlength="6"/.test(HUB),
   '★ hub 的登入頁不是驗證碼輸入（已改成學校 Google 帳號）');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
