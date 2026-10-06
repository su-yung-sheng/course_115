/* 程式批改等待中的輪詢：畫面每秒走、後端每 10 秒才問一次
   跑法：node shared/tests/gradepoll.test.js

   ★ 老師 2026-10-06：免費 ngrok 每月 2 萬次請求，10 月 6 天就用掉 1.29 萬。
     等批改時原本每 4 秒問一次後端（一份作品 4～22 次）。
     老師問「改成 10 秒體感會差多少」⇒ 決定：畫面每秒用瀏覽器自己的時鐘更新，
     後端每 10 秒才問一次。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const G = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const s = G.indexOf('  let qN = 1, qMiss = false');
const e = G.indexOf('  }, 1000);\n', s);
const SNIP = G.slice(s, e + '  }, 1000);\n'.length);
ok(s > 0 && e > s, '找得到等待輪詢那一段');
ok(!/\}, 4000\);/.test(G.slice(G.indexOf('const t0 = Date.now();'), G.indexOf("const fd=new FormData()"))),
   '★★ 不再每 4 秒問一次');

function run(fetchImpl, seconds) {
  const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'shared', 'waittime.js'), 'utf8'))(w);
  let now = 0, cb = null;
  const calls = [], status = [];
  const ctx = {
    WaitTime: w.WaitTime, fmtElapsed: w.WaitTime.fmtElapsed, fmtWait: w.WaitTime.fmtWait,
    avgSec: 60, avgIsGuess: false, t0: 0, H: {}, base: () => 'https://api',
    readQ: q => { if (Number(q.avg_seconds) > 0) ctx.avgSec = Number(q.avg_seconds); },
    setStatus: (m) => status.push(m),
    setInterval: (f, ms) => { cb = f; ctx.__ms = ms; return 1; },
    fetch: (u) => { calls.push(u); return fetchImpl(); },
    Date: { now: () => now }, Math, Number, Promise
  };
  vm.createContext(ctx);
  vm.runInContext('var avgSec = 60; ' + SNIP.replace(/^  let /m, '  var ').replace('const Q_EVERY', 'var Q_EVERY').replace('const qTimer', 'var qTimer'), ctx);
  return (async () => {
    for (let i = 0; i < seconds; i++) { now += 1000; cb(); await new Promise(r => setImmediate(r)); }
    return { calls, status, ms: ctx.__ms };
  })();
}

(async () => {
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve({ pending: 3, avg_seconds: 45 }) });
  const r = await run(okFetch, 30);
  ok(r.ms === 1000, '★★★ 畫面每 1 秒更新一次（秒數不會一次跳 10 秒）');
  ok(r.calls.length === 3 && r.calls.every(u => /\/api\/student\/queue$/.test(u)),
     '★★★ 30 秒只問後端 3 次（每 10 秒一次；原本是 7～8 次）　←　' + r.calls.length);
  ok(/已經 29 秒/.test(r.status[r.status.length - 2]) && /已經 30 秒/.test(r.status[r.status.length - 1]),
     '★★ 「已經 n 秒」每秒在走（最後兩次：29、30 秒）');
  ok(/目前同時有 3 位/.test(r.status[r.status.length - 1]) && /預計/.test(r.status[r.status.length - 1]),
     '★ 問到後端之後顯示同時幾位、預計多久');
  ok(r.status.length === 27, '★ 前 3 秒留著「已送出！…預計多久」那一句，第 4 秒起每秒更新　←　' + r.status.length);

  const late = await run(okFetch, 70);
  ok(/比平常久一點（沒有當掉/.test(late.status[late.status.length - 1]),
     '★★ 超過預計 1.3 倍 ⇒ 改說「比平常久一點，沒有當掉」');

  const slow = () => new Promise(() => {});                 // 後端一直不回
  const r2 = await run(slow, 30);
  ok(r2.calls.length === 1, '★★ 上一次還沒回來就不再疊新的請求（不會越塞越多）　←　' + r2.calls.length);
  ok(/已經 30 秒/.test(r2.status[r2.status.length - 1]), '　後端不回，畫面秒數照樣在走');

  const bad = () => Promise.reject(new Error('net'));
  const r3 = await run(bad, 12);
  ok(/暫時問不到進度/.test(r3.status[r3.status.length - 1]), '★★ 問不到後端 ⇒ 畫面照樣動，寫「暫時問不到進度」');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
