/* 等待時間的說法：不可以低估，也不可以出現「約 2.5 分鐘」這種寫法
   跑法：node shared/tests/waitwording.test.js

   ★ 為什麼有這一份（老師 2026-09-08）
     老師貼回的批改紀錄：一份 91.6 秒。而那時候：
       · 後端 AVG_GRADE_SECONDS = 25
       · grader.html let avgSec = 30
     每天第一批學生會被告知「約 25 秒」然後等一分半 ——
     那正是他們以為當掉、跑去重按的時機（重按被學號守門擋成 429，
     畫面上只剩一句錯誤，看起來更像壞掉）。

   ⚠️ 這一份**真的把 fmtWait／fmtElapsed／fmtQueue 執行起來**，不是 grep。
      這種東西 grep 只看得到函式存在，看不到 91.6 會被講成什麼。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* 說法只有一份，在 shared/waittime.js。⚠️ 這裡要真的載入它執行，
   不要複製一份邏輯進來測 —— 那樣測的是測試自己。 */
global.window = global.window || {};
require(path.join(ROOT, 'shared', 'waittime.js'));
const { fmtWait, fmtElapsed, fmtQueue } = global.window.WaitTime;

const GRADER = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const NB = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'));
const CELL8 = NB.cells[8].source.join('');

section('起始值要和實測同一個量級（不是 25／30）');
{
  const m = GRADER.match(/let avgSec = (\d+);/);
  ok(!!m && Number(m[1]) >= 60,
    '★★★ grader.html 的 avgSec 起始值要 ≥ 60　←　現在是 ' + (m ? m[1] : '找不到'));

  // ⚠️ 後端和前端是**兩個各自寫死的數字**，2026-09-04 就因為這個踩過一次。
  const b = CELL8.match(/AVG_GRADE_SECONDS = (\d+)/);
  ok(!!b && Number(b[1]) >= 60,
    '★★★ 後端 AVG_GRADE_SECONDS 要 ≥ 60　←　現在是 ' + (b ? b[1] : '找不到'));
  ok(!!m && !!b && Number(m[1]) === Number(b[1]),
    '★★★ 前後端的起始值要一模一樣（同一個數字寫死兩次的老坑）　←　前端 '
    + (m ? m[1] : '?') + '／後端 ' + (b ? b[1] : '?'));
  ok(/"samples": samples/.test(CELL8),
    '★★ /api/student/queue 要回報 samples，前端才分得出「這是估的」還是「量到的」');
  ok(/"avg_seconds": round\(_ocr_avg_seconds\(\), 1\)/.test(CELL8)
    && /"eta_seconds"/.test(CELL8),
    '★★ /api/queue-list 也要回報 avg_seconds —— 截圖那邊只給張數，'
    + '學生分不出那是兩分鐘還是二十分鐘');
}

section('91.6 秒要講成人話');
{
  /* ⚠️ 91.6 → 「約 2 分鐘」而不是「約 1 分半」，這是**刻意**的：
     1 分半 = 90 秒 < 91.6，講出去就是低估，而低估正是學生重按的原因。
     ⇒ 半分鐘一格、一律往上。寧可 1 分 32 秒跑完讓學生覺得快，
       也不要說 1 分半然後每個人都超時。 */
  ok(fmtWait(91.6) === '約 2 分鐘',
    '★★★ 91.6 秒（2026-09-08 實測）→ 「約 2 分鐘」　←　得到「' + fmtWait(91.6) + '」');
  ok(fmtWait(89) === '約 1 分半', '★★ 89 秒才是「約 1 分半」　←　「' + fmtWait(89) + '」');
  ok(fmtWait(45) === '約 50 秒', '★★ 45 秒 → 往上取到「約 50 秒」（估多不估少）　←　「' + fmtWait(45) + '」');
  ok(fmtWait(60) === '約 1 分鐘', '★★ 60 秒 → 「約 1 分鐘」　←　「' + fmtWait(60) + '」');
  ok(fmtWait(140) === '約 2 分半', '★★★ 不可以出現小數點的分鐘　←　140 秒得到「' + fmtWait(140) + '」');
  ok(fmtWait(180) === '約 3 分鐘', '★ 180 秒 → 「約 3 分鐘」　←　「' + fmtWait(180) + '」');
  ok(fmtWait(0) === '一下子' && fmtWait(-5) === '一下子',
    '★★ 後端回 0 或負數時不可以印出「約 0 秒」（看起來像壞掉）');

  // ⚠️ 估多不估少：每一個刻度都不可以低於實際秒數。
  let under = [];
  for (let v = 1; v <= 300; v++) {
    const t = fmtWait(v);
    const mm = t.match(/約 (\d+) 分半/) ? Number(t.match(/約 (\d+) 分半/)[1]) * 60 + 30
      : t.match(/約 (\d+) 分鐘/) ? Number(t.match(/約 (\d+) 分鐘/)[1]) * 60
        : Number(t.match(/約 (\d+) 秒/)[1]);
    if (mm < v) under.push(v + '→' + t);
  }
  ok(under.length === 0,
    '★★★ 1~300 秒每一個值報出來的時間都不可以短於實際　←　低估的有 ' + under.slice(0, 5).join('、'));
}

section('截圖辨識是「一次一張」，時間要乘上張數');
{
  /* ⚠️⚠️ 這和程式批改**完全相反**：
       · 程式批改：同時 8 份在跑 ⇒ 時間不乘人數
       · 截圖辨識：一次一張   ⇒ 時間要乘上前面的張數
     2026-09-04 就是把這兩件事講成同一句，害學生嚴重高估等待時間。 */
  ok(fmtQueue(5, 24) === '約 2 分鐘', '★★★ 前面 5 張 × 24 秒 → 「約 2 分鐘」　←　「' + fmtQueue(5, 24) + '」');
  ok(fmtQueue(27, 23.5) === '約 11 分鐘', '★★ 27 張 → 「約 11 分鐘」　←　「' + fmtQueue(27, 23.5) + '」');
  /* ⚠️ 0 張要回一個接得進句子的詞。回「現在傳最快」的話，呼叫端寫
     「大約還要 ___」就變成「大約還要現在傳最快」——
     語法檢查抓不到，只有真的唸一遍才會發現。 */
  ok(fmtQueue(0, 24) === '馬上', '★★★ 0 張要回「馬上」（要接得進「大約還要 ___」）　←　「' + fmtQueue(0, 24) + '」');
}

section('等待中要看得到「已經過了多久」');
{
  ok(fmtElapsed(59) === '59 秒', '★ 未滿一分鐘用秒　←　「' + fmtElapsed(59) + '」');
  ok(fmtElapsed(92) === '1 分 32 秒', '★★ 超過一分鐘要分秒　←　「' + fmtElapsed(92) + '」');
  ok(fmtElapsed(60) === '1 分 00 秒', '★ 秒數補零，畫面不會跳寬度　←　「' + fmtElapsed(60) + '」');

  ok(/已經 \$\{fmtElapsed\(el\)\}/.test(GRADER),
    '★★★ 輪詢時要把已經過的時間印出來 —— 畫面一句話都不動，學生就會重按');
  ok(/const late = el > avgSec \* 1\.3/.test(GRADER),
    '★★★ 超過預估太久要換句話說，不可以一直報「約 2 分鐘」卻已經等了 5 分鐘');
  ok(/沒有當掉/.test(GRADER), '★★ 超時的說法要明講「沒有當掉」，那是學生當下唯一想知道的事');
  ok(/暫時問不到進度/.test(GRADER),
    '★★ 連 queue 都問不到時畫面仍要繼續動，否則看起來就是當掉');
}

section('★ 說法只留一份');
{
  ok(!/\$\{Math\.round\(avgSec\)\} 秒/.test(GRADER),
    '★★★ 不可以再直接報秒數（「約 92 秒」看起來像倒數計時，其實只是平均值）');
  ok(/avgIsGuess/.test(GRADER),
    '★★ 今天第一批（samples 是 0）要講明那個時間是估的');
  ok(/waittime\.js/.test(GRADER) && /WaitTime\.fmtWait/.test(GRADER),
    '★★★ grader.html 要用共用的那一份，不可以自己再寫一次');
  for (const term of ['11501', '11502']) {
    const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
    ok(/waittime\.js/.test(SRC) && /WaitTime\.fmt/.test(SRC),
      '★★★ ' + term + ' 的 thinking.html 也要用同一份');
  }
}

section('★★ thinking.html 的 JSX 要真的解析得過');
{
  /* ⚠️⚠️ 這兩份是 Babel 在瀏覽器裡即時編譯的 —— 寫壞了**不會有建置錯誤**，
     只會在學生打開頁面時整頁空白。所以一定要在這裡先編一次。
     ⚠️ @babel/standalone 不在 repo 裡（node_modules 不進版控），
        沒裝就跳過，不要讓測試在別人的機器上假紅。 */
  let babel = null;
  try { babel = require('@babel/standalone'); } catch (e) { babel = null; }
  if (!babel) {
    console.log('  ⏭️  跳過：沒有 @babel/standalone（npm i --no-save @babel/standalone 就能測）');
  } else {
    for (const term of ['11501', '11502']) {
      const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
      const m = SRC.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
      let err = null;
      try { babel.transform(m[1], { presets: ['react'] }); } catch (e) { err = e.message; }
      ok(!err, '★★★ ' + term + ' 的 JSX 編譯得過　←　' + (err ? err.split('\n')[0] : 'OK'));
    }
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
