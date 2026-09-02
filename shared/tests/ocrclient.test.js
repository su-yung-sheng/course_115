/* 截圖上傳的號碼牌前端（shared/ocrclient.js）
   跑法：node shared/tests/ocrclient.test.js

   ⚠️⚠️ 2026-09-02 實測：一張要 24 秒，而原本的上傳逾時是 180 秒 ——
      只夠撐到第 7～8 位。第 9 位以後，後端跑完也判過了，
      前端卻已經放棄連線，那張圖白跑。
   ★ 這一份盯的是三件事，每一件漏掉都會讓事情比改之前更糟：
     ① 舊後端沒有 /analyze-async 時**一定要退回同步流程**
        （老師還沒重新執行 notebook 的那段時間，前端不可以壞）
     ② 輪詢中單次查詢失敗**不算失敗**（網路抖一下就判死，
        等於把要修的問題換個地方重演）
     ③ 一定要有總上限（後端卡住時不能讓學生無限等） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(root, 'shared', 'ocrclient.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* ── 假的瀏覽器環境 ────────────────────────────────── */
function makeEnv(handler) {
  const store = {};
  const calls = [];
  const win = {};
  const ctx = {
    window: win,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 1)),  // 時間壓縮
    clearTimeout,
    Date,
    Math,
    Number,
    JSON,
    Error,
    Promise,
    encodeURIComponent,
    console,
    fetch: async (url, opt) => {
      calls.push({ url, opt });
      return handler(url, opt, calls.length);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { win, calls, store, ctx };
}

const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

section('① 舊後端沒有 /analyze-async 時要退回同步流程');
{
  const env = makeEnv((url) => {
    if (url.indexOf('/analyze-async') >= 0) return reply({}, 404);
    if (url.indexOf('/analyze') >= 0) return reply({ status: 'success', pass: true });
    throw new Error('不該打到 ' + url);
  });
  return_test(env);
  async function return_test(env) {
    const r = await env.win.submitScreenshot({
      base: 'http://x', formData: {}, storageKey: 'k', challengeId: 'c1'
    });
    ok(r.status === 'sync', '★★ 404 → 退回 /analyze（老師還沒重跑 notebook 時不能壞）');
    ok(r.data && r.data.pass === true, '   同步流程的結果照樣拿得到');
    ok(env.calls.some(c => c.url.endsWith('/analyze')),
      '★ 真的打了舊端點　←　' + env.calls.map(c => c.url).join(' → '));

    section('② 號碼牌：拿到 ticket → 輪詢 → 拿結果');
    const env2 = makeEnv((url, opt, n) => {
      if (url.indexOf('/analyze-async') >= 0) {
        return reply({ status: 'queued', ticket: 'abc123', ahead: 4, avg_seconds: 24 });
      }
      if (url.indexOf('/result/') >= 0) {
        if (n <= 3) return reply({ status: 'working', ahead: 2, avg_seconds: 24 });
        return reply({ status: 'success', pass: true, bytes: 900 });
      }
      throw new Error('不該打到 ' + url);
    });
    const seen = [];
    const r2 = await env2.win.submitScreenshot({
      base: 'http://x', formData: {}, storageKey: 'k', challengeId: 'c1',
      onQueue: (ahead, avg) => seen.push([ahead, avg]),
    });
    ok(r2.status === 'done' && r2.data.pass === true, '★★ 輪詢到結果');
    ok(seen.length >= 2 && seen[0][1] === 24,
      '★ 過程中有回報「前面幾位、每張多久」　←　' + JSON.stringify(seen));
    ok(!('k' in env2.store), '★★ 拿到結果後要清掉號碼牌（不然下次會拿舊的去問）');
    ok(env2.calls.filter(c => c.url.indexOf('/analyze-async') >= 0).length === 1,
      '★ 只上傳一次（輪詢不可以重傳圖片）');

    section('③ 單次查詢失敗不可以判死');
    let hit = 0;
    const env3 = makeEnv((url, opt, n) => {
      if (url.indexOf('/analyze-async') >= 0) return reply({ ticket: 't1' });
      hit++;
      if (hit <= 2) throw new TypeError('Failed to fetch');   // 網路抖兩下
      return reply({ status: 'success', pass: true });
    });
    const r3 = await env3.win.submitScreenshot({
      base: 'http://x', formData: {}, storageKey: 'k'
    });
    ok(r3.status === 'done' && r3.data.pass === true,
      '★★ 查詢中途斷線兩次仍然拿得到結果（號碼牌還在，繼續問就好）');

    section('④ 後端重啟／號碼牌過期');
    const env4 = makeEnv((url) => {
      if (url.indexOf('/analyze-async') >= 0) return reply({ ticket: 't2' });
      return reply({ status: 'gone', message: '找不到這張號碼牌 —— 請重新上傳一次截圖。' }, 404);
    });
    const r4 = await env4.win.submitScreenshot({
      base: 'http://x', formData: {}, storageKey: 'k'
    });
    ok(r4.status === 'gone' && /重新上傳/.test(r4.data.message),
      '★★ 要明講「請重新上傳」，不可以無聲無息');
    ok(!('k' in env4.store), '★ 失效的號碼牌要清掉');

    section('⑤ 後端當場拒絕（429：同一人已有一張在跑）');
    const env5 = makeEnv(() => reply({
      status: 'error', message: '你已經有一張截圖正在辨識中了'
    }, 429));
    const r5 = await env5.win.submitScreenshot({
      base: 'http://x', formData: {}, storageKey: 'k'
    });
    ok(r5.status === 'rejected' && r5.httpStatus === 429,
      '★★ 429 要照原樣交給呼叫端，不可以退回同步流程再傳一次');
    ok(/已經有一張/.test(r5.data.message), '   後端的說明要留著');

    section('⑥ 關掉頁面再回來');
    const env6 = makeEnv((url) => {
      if (url.indexOf('/analyze-async') >= 0) return reply({ ticket: 'keep-me' });
      return reply({ status: 'working', ahead: 1 });
    });
    env6.win.submitScreenshot({ base: 'http://x', formData: {}, storageKey: 'k', challengeId: 'c1' });
    await new Promise(r => setTimeout(r, 30));
    ok('k' in env6.store, '★★ 還在跑的時候，號碼牌要留在 localStorage');
    const back = env6.win.resumeScreenshot({ base: 'http://x', storageKey: 'k', challengeId: 'c1' });
    ok(back !== null, '★★ 重開頁面接得回同一張號碼牌');
    // 別關的號碼牌不可以拿來用
    const other = env6.win.resumeScreenshot({ base: 'http://x', storageKey: 'k', challengeId: 'c9' });
    ok(other === null, '★★ 換了關卡就不可以沿用舊號碼牌（會拿到別關的結果）');
    ok(env6.win.resumeScreenshot({ base: 'http://x', storageKey: 'nope' }) === null,
      '★ 沒有暫存時要回 null（呼叫端當成「沒事發生」，不是錯誤）');

    section('⑦ 一定要有總上限');
    ok(/GIVE_UP_MS/.test(SRC), '★★ 有總上限常數');
    const g = /GIVE_UP_MS\s*=\s*([\d\s*]+);/.exec(SRC);
    ok(!!g, '★ 找得到那個值');
    ok(/等超過 20 分鐘/.test(SRC), '★★ 放棄時要講人話，並說明「不是你的截圖有問題」');
    ok(/localStorage/.test(SRC) && (SRC.match(/try\s*\{/g) || []).length >= 4,
      '★ localStorage 的讀寫都包 try（無痕模式會直接拋，不能因此讓上傳失敗）');

    console.log('\n通過 ' + pass + '／失敗 ' + fail);
    process.exit(fail ? 1 : 0);
  }
}
