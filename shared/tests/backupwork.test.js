/* 程式作品備份（Apps Script）：失敗要講得出原因
   跑法：node shared/tests/backupwork.test.js

   ★ 老師 2026-10-07：「今天的評分過程中有出現程式未備份成功的訊息」。
     原本四種失敗（檔案太大、名冊查不到、Apps Script 回報錯誤、網路斷）畫面上一模一樣，
     原因只在學生電腦的主控台。⇒ 回傳原因、畫面講出來；暫時性的自動再試一次。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const G = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const s = G.indexOf('async function backupWork(');
const e = G.indexOf('\n}\n', s) + 3;
const FN = G.slice(s, e);
const MAXMB = Number((G.match(/const MAX_UPLOAD_MB = (\d+);/) || [])[1]);
const GAS = fs.readFileSync(path.join(ROOT, 'shared', 'filebackup.gs'), 'utf8');
const GASMB = Number((GAS.match(/var MAX_MB = (\d+);/) || [])[1]);

function run(fetchSeq, opts) {
  opts = opts || {};
  const calls = [], links = [];
  const ctx = {
    GAS_UPLOAD_URL: 'https://gas', TERM: '11501', MAX_UPLOAD_MB: MAXMB,
    UNITS: [['2-1-1A', 'a'], ['2-1-1B', 'b']],
    window: { CONFIG: { GAS_UPLOAD_KEY: 'k' },
              lookupStudent: async () => opts.noRoster ? null : { cls: '801', no: '5', name: '甲' },
              saveWorkLink: async (sid, unit, url) => { links.push(url); } },
    fileToBase64: async () => 'QUJD',
    fetch: async (u, o) => { calls.push(JSON.parse(o.body)); const f = fetchSeq[Math.min(calls.length - 1, fetchSeq.length - 1)]; return f(); },
    setTimeout: (f) => f(), console: { warn() {}, error() {} }, JSON, String, Promise, Number
  };
  vm.createContext(ctx);
  vm.runInContext(FN + '; this.backupWork = backupWork;', ctx);
  const file = { size: (opts.mb || 1) * 1024 * 1024 };
  return ctx.backupWork(file, '1410105', '2-1-1B', 95).then(r => ({ r, calls, links }));
}
const resp = (j, status) => () => Promise.resolve({ status: status || 200, json: () => j === 'bad' ? Promise.reject(new Error('x')) : Promise.resolve(j) });
const net = () => Promise.reject(new TypeError('Failed to fetch'));

(async () => {
  ok(MAXMB === 14 && GASMB >= MAXMB, '★★ 前端上限 14 MB，不超過 Apps Script 的上限（' + GASMB + ' MB）—— 原本 8 MB 把 8～14 MB 的作品全擋掉');
  let x = await run([resp({ success: true, url: 'https://drive/1' })]);
  ok(x.r.url === 'https://drive/1' && x.links[0] === 'https://drive/1' && x.calls[0].unitNo === '2' && x.calls[0].seatNo === '5',
     '★ 成功：回 url、記下連結、帶關卡編號與座號');
  x = await run([resp({ success: true, url: 'u' })], { mb: 15 });
  ok(/15\.0 MB，超過 14 MB/.test(x.r.err) && x.calls.length === 0, '★★ 檔案太大：講出幾 MB、上限多少，而且不送');
  x = await run([resp({ success: true, url: 'u' })], { noRoster: true });
  ok(/名冊查不到/.test(x.r.err) && x.calls.length === 0, '★★ 名冊查不到班級座號：講出來');
  x = await run([net, resp({ success: true, url: 'https://drive/2' })]);
  ok(x.r.url === 'https://drive/2' && x.calls.length === 2, '★★★ 網路斷一次 ⇒ 自動再試一次就成功');
  x = await run([net, net]);
  ok(/連不上 Google 雲端/.test(x.r.err) && x.calls.length === 2, '★★ 兩次都連不上 ⇒ 講「連不上 Google 雲端」（最多試兩次）');
  x = await run([resp({ success: false, message: 'Error: 通行碼不正確。請確認…' })]);
  ok(/Google 雲端回報：.*通行碼不正確/.test(x.r.err) && x.calls.length === 1, '★★ 通行碼錯：照實轉述，而且不重試（再試也沒用）');
  x = await run([resp({ success: false, message: 'Exception: Service error: Drive' }), resp({ success: true, url: 'u3' })]);
  ok(x.r.url === 'u3', '★ Apps Script 一時出錯 ⇒ 再試一次');
  x = await run([resp('bad', 500), resp('bad', 500)]);
  ok(/HTTP 500/.test(x.r.err), '★ Apps Script 回的不是 JSON ⇒ 講出 HTTP 狀態碼');
  ok(/作品備份失敗：' \+ bk\.err \+ '（成績已記錄，請截圖告訴老師）/.test(G), '★★★ 畫面把原因講出來（學生截圖給老師就知道是哪一種）');
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
