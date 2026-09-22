/* 運算思維：登入後自動補記（後端有通關紀錄、學生頁面卻少了幾關）
   跑法：node shared/tests/thinkingsync.test.js

   ⛔⛔ 2026-09-22 老師：「1410808 上週已經有證書，但是學生登入後重整一直沒有
      跑出來」。後端紀錄有 1,2,3,4,6,7,8,9,10 九關，學生頁面少了幾關。
   ★ 查到三個洞，這支測試各釘一個，而且都是**真的把程式跑起來**測：
     ① 只在登入時問一次。那天下午兩台後端都停著（批改那台 ngrok 流量用光、
        OCR 那台停了），補記安靜地跳過，重新整理幾次都一樣，畫面也沒說。
     ② 兩台共用同一個 8 秒倒數：第一台慢，第二台就根本沒被問到。
     ③ 連續補好幾關時，每一次都拿「同一份舊清單」去加 ⇒ 畫面只剩最後一關。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const tick = () => new Promise(r => setImmediate(r));
const settle = async (n = 40) => { for (let i = 0; i < n; i++) await tick(); };

function extract(SRC) {
  const i0 = SRC.indexOf('「關機也不白跑」的最後一哩');
  const u0 = SRC.indexOf('useEffect(() => {', i0);
  const endM = /\}, \[user && user\.(sid|docId)\]\);/.exec(SRC.slice(u0));
  const effect = endM ? SRC.slice(u0, u0 + endM.index + endM[0].length) : '';
  const hcc = (SRC.match(/const handleChallengeComplete = async \([^)]*\) => \{[\s\S]*?\n            \};/) || [''])[0];
  return { effect, hcc };
}

/* 假的計時器：記下來，由測試決定什麼時候觸發 */
function fakeTimers() {
  let id = 0; const list = [];
  return {
    list,
    setTimeout: (fn, ms) => { const t = { id: ++id, fn, ms, done: false }; list.push(t); return t.id; },
    clearTimeout: (x) => { const t = list.find(t => t.id === x); if (t) t.done = true; },
    fire: async (pred) => { const t = list.find(t => !t.done && pred(t)); if (!t) return false; t.done = true; await t.fn(); return true; },
  };
}

function makeCtx(TERM, opts) {
  const T = fakeTimers();
  const log = { notes: [], hcc: [], gas: 0, fetch: [] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Promise, Set, Object, Array, Number, String, Math, JSON, Date, isNaN,
    AbortController, encodeURIComponent,
    setTimeout: T.setTimeout, clearTimeout: T.clearTimeout,
    user: { sid: '1410808', docId: '801_8_測試', classRoom: '801', seatNo: '8', name: '測試' },
    sessionStorage: { getItem: () => '1410808' },
    window: { CONFIG: { TERM, SERVER_URL: 'https://A', OCR_SERVER_URL: 'https://B',
                        GAS_UPLOAD_URL: 'https://GAS', GAS_UPLOAD_KEY: 'k' } },
    fbStore: { db: {}, doc: () => ({}), setDoc: async () => {}, arrayUnion: x => x },
    completedChallenges: opts.completed, certificateUrls: {}, completedImages: {},
    formatDate: d => 'D',
    setSyncNote: v => log.notes.push(v),
    setCertificateUrls: () => {}, setCompletedImages: () => {}, setCompletedDates: () => {},
    handleChallengeComplete: async (id) => { log.hcc.push(Number(id)); },
    fetch: (url, init) => {
      log.fetch.push(url);
      if (url === 'https://GAS') { log.gas++; return Promise.resolve({ json: async () => ({ success: true, urls: {} }) }); }
      return opts.fetch(url, init, log);
    },
  };
  ctx.useEffect = (fn) => { ctx.__cleanup = fn(); };
  vm.createContext(ctx);
  return { ctx, T, log };
}

(async () => {
for (const TERM of ['11501', '11502']) {
  console.log('\n════════ ' + TERM + '/thinking.html ════════');
  const SRC = fs.readFileSync(path.join(ROOT, TERM, 'thinking.html'), 'utf8');
  const { effect, hcc } = extract(SRC);
  ok(effect.length > 0 && hcc.length > 0, '找得到補記的 useEffect 與 handleChallengeComplete');
  const PASSED = { passed: ['1', '2', '4', '7', '8'], urls: {}, dates: {} };
  const answer = { json: async () => PASSED };

  section('① 兩台都問不到 ⇒ 告訴學生，而且每分鐘再試');
  await (async () => {
    let up = false;
    const { ctx, T, log } = makeCtx(TERM, { completed: [1, 2],
      fetch: async () => { if (!up) throw new TypeError('ngrok offline'); return answer; } });
    vm.runInContext(effect, ctx); await settle();
    ok(log.notes.some(n => n && n.kind === 'down'),
       '★★★ 兩台都掛時要顯示「暫時無法同步」—— 原本完全沒講，學生重新整理幾次都以為紀錄不見了');
    ok(log.hcc.length === 0, '問不到就不補（沒有資料可補）');
    const retry = T.list.find(t => !t.done && t.ms === 60000);
    ok(!!retry, '★★★ 要排好一分鐘後再試 —— 原本只在登入時問一次，問不到就放棄');
    up = true;                                   // 後端回來了
    await T.fire(t => t.ms === 60000); await settle();
    ok(log.notes.includes(null), '★★ 後端回來之後要拿掉「無法同步」的提示');
    ok(JSON.stringify(log.hcc.sort((a, b) => a - b)) === '[4,7,8]',
       '★★★ 重試成功後補回 4、7、8 關　實際 ' + JSON.stringify(log.hcc));
    const fixed = log.notes.find(n => n && n.kind === 'fixed');
    ok(fixed && JSON.stringify(fixed.ids) === '[4,7,8]', '★★ 要告訴學生補回了哪幾關');
    ok(log.gas <= 1, '★★ 重試不可以再打 GAS（Apps Script 每天額度有限）　實際 ' + log.gas + ' 次');
    ok(!T.list.some(t => !t.done && t.ms === 60000), '成功之後不再排下一次');
  })();
  await (async () => {
    const { ctx, T } = makeCtx(TERM, { completed: [], fetch: async () => { throw new Error('down'); } });
    vm.runInContext(effect, ctx); await settle();
    let n = 0; while (await T.fire(t => t.ms === 60000)) { n++; await settle(); if (n > 50) break; }
    ok(n === 10, '★★ 一直問不到時最多再試 10 次就停（不可以無限打）　實際 ' + n + ' 次');
  })();
  await (async () => {
    const { ctx, T } = makeCtx(TERM, { completed: [], fetch: async () => { throw new Error('down'); } });
    vm.runInContext(effect, ctx); await settle();
    ctx.__cleanup();                             // 學生離開頁面
    const pending = T.list.filter(t => !t.done && t.ms === 60000).length;
    ok(pending === 0, '★★ 離開頁面時要取消排定的重試（不然關掉的頁面還在打後端）');
  })();

  section('② 每一台各自計時');
  await (async () => {
    const { ctx, T, log } = makeCtx(TERM, { completed: [1, 2],
      fetch: (url, init) => url.startsWith('https://A')
        ? new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('timeout'))))
        : (init.signal.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve(answer)) });
    vm.runInContext(effect, ctx); await settle();
    const t = T.list.find(t => !t.done && t.ms <= 8000);
    ok(!!t, '第一台有逾時計時器');
    await T.fire(x => x === t); await settle();
    ok(JSON.stringify(log.hcc.sort((a, b) => a - b)) === '[4,7,8]',
       '★★★ 第一台逾時之後，第二台要**重新計時**照樣問得到 —— 共用倒數時第二台拿到的是已經取消的訊號　實際 ' + JSON.stringify(log.hcc));
  })();

  section('③ 連續補好幾關，畫面要全部看得到');
  await (async () => {
    let last = null, starLevel = null;
    const ref = { current: ['1', '2'] };
    const ctx = {
      completedRef: ref, completedChallenges: ['1', '2'],
      setCompletedChallenges: v => { last = v; }, setCompletedDates: () => {}, setCertificateUrls: () => {},
      setCompletedImages: () => {},
      user: { sid: '1410808', docId: 'x', classRoom: '801', seatNo: '8', name: 'n' },
      fbStore: { db: {}, doc: () => ({}), arrayUnion: x => x,
                 setDoc: async (ref, data) => { if (data && data.modules) starLevel = data.modules.thinking.level; } },
      window: { CONFIG: { TERM }, GRADING: { thinkingStars: n => n * 2 } },
      GRADING: { thinkingStars: n => n * 2 }, REPORT: { unit: async () => {} },
      noteMyPass: () => {}, console: { log() {}, warn() {}, error() {} }, Set, Number, String, Date,
    };
    ctx.window.REPORT = ctx.REPORT; ctx.window.GRADING = ctx.GRADING;
    vm.createContext(ctx);
    vm.runInContext(hcc.replace('const handleChallengeComplete', 'var handleChallengeComplete'), ctx);
    for (const id of [4, 7, 8]) await ctx.handleChallengeComplete(id, 'D', null, '補記', null);
    const got = (last || []).map(Number).sort((a, b) => a - b);
    ok(JSON.stringify(got) === '[1,2,4,7,8]',
       '★★★ 補 4、7、8 三關後，畫面上的清單要五關都在 —— 原本只剩「1,2＋最後一關」　實際 ' + JSON.stringify(got));
    await ctx.handleChallengeComplete(4, 'D', null, '重複', null);
    ok((last || []).length === 5, '★★ 已經有的關卡再補一次不可以重複加');
    ctx.completedRef.current = ['1', '2', '4'];
    let before = last;
    await ctx.handleChallengeComplete(4, 'D', null, '字串', null);
    ok(last === before, '★★ 清單裡是字串 "4"、補的是數字 4 ⇒ 要認得是同一關');
    if (TERM === '11501')
      ok(starLevel === 5, '★★ 統一進度的關數要算到 5（原本拿舊清單只算到 3）　實際 ' + starLevel);
  })();

  section('畫面');
  {
    const C = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
    ok(/syncNote\.kind === 'down'/.test(C) && /不用重新上傳/.test(C), '★★ 有「暫時無法同步」的提示，而且叫學生不要重傳');
    ok(/syncNote\.kind === 'fixed'/.test(C), '★ 有「已經自動補上」的提示');
    ok(/進度: \{challenges\.filter\(c => isDone\(c\.id\)\)\.length\}/.test(C),
       '★ 進度數字和清單打勾用同一個判斷（isDone），重複的編號不會讓進度虛胖');
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
})();
