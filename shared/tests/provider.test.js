/* 兩家供應商並存的測試
   跑法：node shared/tests/provider.test.js

   ★ 這一份盯的是「切換」本身。
     兩家並存最容易出的錯不是某一家壞掉，而是
     **你以為切過去了，其實沒有** —— 然後測了半天，測的是另一家。
     所以這裡測的是：分岔點夠不夠淺、預設會不會偷偷花到錢、
     以及付費那條路有沒有自己的煞車。 */
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'aiguide.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'ai-lab.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('切換本身');
ok(/function provider_\(\)/.test(src), '有一個地方決定用哪一家');
ok(/PROVIDER: 'gemini'/.test(src),
   '★ 預設是免費的 —— 「預設不會花到錢」比「預設比較好用」重要');
ok(/function askAI_/.test(src), '有共用的入口 askAI_');
ok(!/askGemini_\(buildPrompt_/.test(src),
   '★ 呼叫點不可以直接叫 askGemini_ —— 那樣切換就漏了一條路');
ok((src.match(/askAI_\(buildPrompt_/g) || []).length >= 3,
   '   正式問答、burstTest、selfTest 三條路都走共用入口');

section('分岔點要夠淺（兩邊行為才不會走鐘）');
/* 提示詞、回覆檢查、配額、冷卻都必須共用；
   只有「怎麼送出去、怎麼拿回來」不一樣。 */
ok(/askClaude_\(prompt, modelOverride\)/.test(src), 'Claude 那支收的是「已經組好的提示詞」');
const claude = src.slice(src.indexOf('function askClaude_'), src.indexOf('function tokensToday_'));
ok(!/buildPrompt_|checkReply_|hitKeys_/.test(claude),
   '★ Claude 那支不可以自己組提示詞或自己檢查回覆 —— 那些要共用');
ok(/messages: \[\{ role: 'user', content: prompt \}\]/.test(claude),
   '   整段提示詞照原樣送（拆成 system 會變成兩份提示詞，要重測）');

section('Claude 的必要細節');
ok(/'anthropic-version': '2023-06-01'/.test(claude),
   "★ anthropic-version 是必填標頭 —— 少了會回 400，而訊息不會說是這個原因");
ok(/'x-api-key': key/.test(claude), '金鑰放標頭');
ok(/CLAUDE_KEY/.test(src) && !/CLAUDE_KEY/.test(html),
   '★ 金鑰只在 GAS 的指令碼屬性，不可以進前端（那個 repo 是公開的）');
ok(/input_tokens/.test(claude) && /output_tokens/.test(claude), '把用量記下來');

section('付費要有自己的煞車');
ok(/DAILY_TOKEN_CAP/.test(src), '有每日 token 上限');
const capPos = claude.indexOf('DAILY_TOKEN_CAP');
const fetchPos = claude.indexOf('UrlFetchApp.fetch');
ok(capPos > 0 && capPos < fetchPos,
   '★ 上限要在送出「之前」檢查 —— 送出去才發現超過，錢已經花了');
ok(/一個月的預算燒在一個晚上/.test(src),
   '   註解要講明它防的是什麼（不是公平，是程式寫錯時的損害控制）');
ok(/function costReport/.test(src), '有地方看今天花了多少');
ok(/PRICE_IN_PER_M/.test(src) && /填 0 就只記 token/.test(src),
   '★ 價目由老師自己填 —— 我寫死的數字會過期，而過期的價目看起來像答案');
ok(/function listClaudeModels/.test(src),
   '★ 模型名稱用問的不用寫死（2026-08-07 才被「列得出來卻叫不動」咬過）');

section('錯誤要和 Gemini 那邊講一樣的話');
ok(/e1\.busy = true/.test(claude) && /e1\.retryAfter/.test(claude),
   '429／529 要回 busy＋retryAfter，前端才不必分兩套');
ok(/401 \|\| code === 403/.test(claude), '金鑰問題要單獨講（那是要去修，不是等一下）');

section('測試台要看得出現在是哪一家');
ok(/j\.provider/.test(html), '★ ping 回報供應商，畫面直接顯示');
ok(/Claude（付費）/.test(html) && /Gemini（免費層）/.test(html), '兩家的名字都寫出來');
ok(/j\.tokenCap/.test(html), '付費時看得到 token 用量（帳單月底才來，這是唯一的即時回饋）');
ok(/provider: provider_\(\)/.test(src), 'GAS 那邊有回報');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
