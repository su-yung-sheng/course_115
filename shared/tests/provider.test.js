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

section('模型名稱：釘死 vs 別名');
/* ★ 這是一個刻意的取捨，不是懶得處理。
   別名（claude-haiku-4-5）會自動指向最新快照 —— 方便，但危險：
   我們對模型的要求是「守不守得住」，而那是對某一個特定版本測出來的。
   別名讓模型可以在學期中間被換掉，而且不會有人通知你。 */
ok(/CLAUDE_MODEL: 'claude-[a-z0-9-]*\d{8}'/.test(src),
   '★ 預設用帶日期的快照，不用會自動跳版的別名');
ok(/學期中間被換掉/.test(src), '   而且要寫清楚為什麼（不然下一個人會「順手」改成別名）');

section('釘死之後怎麼知道該升級了');
ok(/function modelListed_/.test(src), '有「設定的模型還在不在」的檢查');
ok(/function checkModel/.test(src), '編輯器可以手動查');
ok(/modelListed: modelListed_\(\)\.found/.test(src), 'ping 會回報');
ok(/j\.modelListed === false/.test(html), '★ 測試台要跳紅字 —— 在學生遇到之前');
/* ⚠️ 只能講「找不到」，不能宣稱「沒問題」——
   同一天學到的：三把金鑰列出來的清單一模一樣，其中一把呼叫就是 404。 */
ok(/不代表叫得動/.test(src.slice(src.indexOf('function modelListed_') - 1200, src.indexOf('function modelListed_'))),
   '★ 註解要講明「在清單裡」不等於「叫得動」');
ok(/found: null/.test(src), '查不到要和「不存在」分開 —— 連不出去不是模型的錯');
ok(/21600/.test(src.slice(src.indexOf('function modelListed_'), src.indexOf('function checkModel'))),
   '有快取（背景檢查不值得每次 ping 都問一次）');

section('冷卻不算「守不住」');
ok(/err\.busy = !!j\.busy \|\| !!j\.cooling/.test(html),
   '★ 測試台要把 cooling 當成 busy —— 兩者都是「等一下就好」，不是模型表現');
ok(/剛剛才問過.*冷卻擋的/.test(html.replace(/\s+/g, ' ')),
   '   而且要告訴老師「填偵錯碼就不會冷卻」');

section('「現在用的是哪一個」只能有一個來源');
/* ★ 2026-08-07：偵錯回傳的 model 一律讀 MODEL（Gemini 那一格），
   於是切到 Claude 之後每張卡片還是印 gemini-…
   ——「明明切過去了，畫面卻說沒有」。
   我看著自己印錯的字，斷定使用者的設定有問題。 */
const dbgOut = src.slice(src.indexOf('out.raw = reply'), src.indexOf('out.prompt ='));
ok(/provider_\(\) === 'claude'/.test(dbgOut),
   '★ 偵錯回傳的模型名稱要跟著 provider 走，不可以寫死讀 MODEL');
ok(/out\.provider = provider_\(\)/.test(src), '每一則回應也要標出是哪一家');
ok(/res\.provider/.test(html), '   卡片上看得到（不必回頭看 ping）');

section('看得出「這個值是誰設的」');
/* ★ DEFAULTS 只是「沒設定時的退路」，但它看起來和真正的設定一模一樣。
   而程式裡的預設值會過期（模型名稱是憑記憶填的）——
   分不出來的話，你會以為自己設好了，其實跑的是預設值。 */
ok(/modelFromProp/.test(src), 'ping 要講模型名稱是屬性來的還是程式預設');
ok(/j\.modelFromProp === false/.test(html), '★ 用預設值時測試台要提醒');
ok(/程式預設/.test(html), '   而且要講清楚該去哪裡設');
/* 所有可調的東西都要能用屬性覆蓋，不必改程式 */
['PROVIDER','CLAUDE_MODEL','GEMINI_MODEL','GEMINI_FALLBACK_MODEL','DAILY_TOKEN_CAP',
 'PER_SID_CAP','DAILY_CAP','COOLDOWN_SEC','GEMINI_RPM_PER_KEY'].forEach(k => {
  ok(new RegExp("(prop_|num_|prop2_|num2p_)\\('" + k + "'").test(src),
     '   ' + k + ' 可以用指令碼屬性覆蓋');
});

section('屬性改名：不可以靜靜地失效');
/* ★ 加入 Claude 之後 MODEL／FALLBACK_MODEL 有了歧義（誰的 MODEL？）。
   但直接改掉舊名字的話，現有設定會**沒有任何徵兆地**退回程式預設值 ——
   那正是今天已經吃過兩次的虧（部署版本、模型標籤）。 */
ok(/var RENAMED = \{/.test(src), '有新舊名稱的對照表');
ok(/GEMINI_MODEL:\s*'MODEL'/.test(src), '   MODEL → GEMINI_MODEL');
ok(/GEMINI_FALLBACK_MODEL:\s*'FALLBACK_MODEL'/.test(src), '   FALLBACK_MODEL → GEMINI_FALLBACK_MODEL');
ok(/function prop2_/.test(src), '★ 新名字優先、舊名字還收');
/* ★ 相容只做給「真的可能有人設過」的名字。
   COOL_SEC 從來沒出現在任何說明或文件裡 —— 為它做相容是多餘的，
   多一列就多一件「以後要記得清掉」的事。 */
ok(!/GEMINI_COOL_SEC:\s*'COOL_SEC'/.test(src),
   '★ COOL_SEC 不做相容（它沒被文件寫過，不可能有人設）');
ok(/function legacyProps_/.test(src), '★ 而且要說得出「你還在用舊名字」');
ok(/legacy: legacyProps_\(\)/.test(src), '   ping 回報');
ok(/j\.legacy/.test(html), '   測試台顯示');
ok(/靜靜地失效/.test(src), '   註解要講明為什麼不直接改掉舊名字');
/* Gemini 專用的設定要有 GEMINI_ 前綴，和 CLAUDE_ 對稱 */
['GEMINI_MODEL','GEMINI_FALLBACK_MODEL','GEMINI_RPM_PER_KEY','GEMINI_COOL_SEC']
  .forEach(k => ok(new RegExp(k).test(src), '   ' + k + ' 有前綴（和 CLAUDE_ 對稱）'));

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
