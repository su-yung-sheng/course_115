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

    section('⑧ 雲端路徑：上傳打 GAS，不碰 Colab');
    /* ⚠️⚠️ 2026-09-03 老師：「圖片都上傳到雲端了，為什麼還會滿載
       讓使用者無法上傳？」—— 因為上傳原本還是打在 Colab 上。
       ★ 這條路把上傳打到 GAS：Colab 掛掉、滿載都不影響學生上傳。 */
    const envC = makeEnv((url, opt) => {
      if (url.indexOf('script.google') >= 0) {
        const body = JSON.parse(opt.body);
        return reply({ success: true, fileId: 'f1', fileName: body.fileName });
      }
      throw new Error('雲端上傳不可以打到 ' + url);
    });
    envC.ctx.FileReader = function () {
      this.readAsDataURL = function () { this.result = 'data:image/png;base64,QUJD'; this.onload(); };
    };
    const rc = await envC.win.submitViaCloud({
      gasUrl: 'https://script.google.com/x/exec', gasKey: 'k', term: '11501',
      sid: '1410700', file: { name: '滑梯公園 - Google Chrome.png', type: 'image/png' }
    });
    ok(rc.ok && rc.status === 'queued', '★★ 上傳成功回 queued');
    ok(rc.upName === '1410700-滑梯公園 - Google Chrome.png',
       '★★ 檔名要是「學號-原檔名」　←　' + rc.upName);
    ok(envC.calls.every(c => c.url.indexOf('script.google') >= 0),
       '★★ 整個上傳過程不可以打到 Colab');
    // ⚠️ 只加一個「-」：關卡名和時間戳裡也有「-」，切多了檔名會壞
    ok((rc.upName.match(/-/g) || []).length >= 1 &&
       rc.upName.split('-')[0] === '1410700',
       '★ 學號用第一個「-」隔開（後端用 partition 切第一個）');

    const envD = makeEnv(() => reply({ success: false, message: '額度爆了' }));
    envD.ctx.FileReader = envC.ctx.FileReader;
    const rd = await envD.win.submitViaCloud({
      gasUrl: 'https://script.google.com/x/exec', gasKey: 'k',
      sid: '1', file: { name: 'a.png' } });
    ok(!rd.ok && /沒有上傳成功/.test(rd.data.message),
       '★★ 上傳失敗要講清楚（這是唯一會讓學生白做的一步）');

    section('⑨ 雲端路徑：等結果靠「從清單消失」');
    /* ⚠️⚠️ 最容易錯的一條：後端每 8 秒才掃一次暫存區，
       剛上傳的那幾秒清單裡本來就沒有 ——
       沒有 seenInQueue 這個判斷，學生一送出就會被告知「沒過」。 */
    let phase = 0;
    const envE = makeEnv((url) => {
      if (url.indexOf('/api/queue-list') >= 0) {
        phase++;
        // 前兩輪：還沒被掃到（清單裡沒有我）
        if (phase <= 2) return reply({ queue: [] });
        // 中間兩輪：排隊中
        if (phase <= 4) return reply({ queue: [{ student_id: '1410700', name: 'x.png' }] });
        // 之後：消失了
        return reply({ queue: [] });
      }
      if (url.indexOf('/api/my-passed') >= 0) return reply({ passed: ['3'] });
      throw new Error('不該打到 ' + url);
    });
    const re = await envE.win.waitViaCloud(
      { base: 'http://c', sid: '1410700', term: '11501', challengeId: 3, level: '滑梯公園' },
      '1410700-x.png');
    ok(re.status === 'done' && re.data.pass === true,
       '★★ 從清單消失＋成績有記 → 判定通過');
    ok(phase > 4, '★★ 上傳後還沒被掃到時不可以就下結論　←　問了 ' + phase + ' 輪');

    section('⑩ Colab 掛掉時不可以判學生失敗');
    let n2 = 0;
    const envF = makeEnv((url) => {
      if (url.indexOf('/api/queue-list') >= 0) {
        n2++;
        if (n2 <= 3) throw new TypeError('Failed to fetch');   // Colab 掛了
        if (n2 <= 5) return reply({ queue: [{ student_id: '1', name: 'y.png' }] });
        return reply({ queue: [] });
      }
      return reply({ passed: ['7'] });
    });
    const rf = await envF.win.waitViaCloud(
      { base: 'http://c', sid: '1', term: '11501', challengeId: 7 }, '1-y.png');
    ok(rf.data.pass === true,
       '★★ 中途連不上 Colab 也要繼續等（圖在雲端，之後會處理）');

    section('⑪ 檔名認關卡：規則要和後端一模一樣');
    /* ⚠️⚠️ 2026-09-03「不用選關卡」之後，關卡完全由檔名決定。
       ★ 這一支和後端 scratch_grader_core.level_from_filename 是**同一套規則**
         的兩份實作（一份 JS 給學生端當場擋、一份 Python 給後端判定）。
         寫得不一樣的話會出現「學生端說可以、後端說不知道這是哪一關」——
         而那時圖已經傳出去了，學生要排完 20 分鐘才知道。
       ⚠️ 下面這幾個例子和 shared/tests/levelmap.test.py 是同一組 ——
          兩邊要一起改。 */
    const LV = [
      { id: 1, title: '跳格子' }, { id: 3, title: '滑梯公園' },
      { id: 4, title: '水餃工廠' }, { id: 10, title: '拔蘿蔔' },
    ];
    const envG = makeEnv(() => reply({}));
    const F = envG.win.levelFromFilename;
    ok(F('滑梯公園 - Google Chrome 2026_8_31 下午 03_47_38.png', LV) &&
       F('滑梯公園 - Google Chrome 2026_8_31 下午 03_47_38.png', LV).id === 3,
       '★★ 老師實際的檔名格式認得出（開頭是關卡名）');
    ok(F('1410700-滑梯公園 - Google Chrome.png', LV) &&
       F('1410700-滑梯公園 - Google Chrome.png', LV).id === 3,
       '★★ 關卡名不在開頭時也要認得出（學號前綴）');
    ok(F('螢幕擷取畫面 2026-09-03 103015.png', LV) === null,
       '★★ Win+Shift+S 那種檔名要回 null —— 呼叫端得靠它擋下來，'
       + '不可以硬猜一關（猜錯＝成績記到別人的關卡上）');
    ok(F('', LV) === null && F('滑梯公園.png', null) === null,
       '★ 空檔名、沒有關卡清單都要回 null（不可以爆掉）');

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
