/* 模擬器通關送後端（下學期，老師 2026-11-18：拼對＝通關 2⭐，由後端確認後寫入）
   跑法：node shared/tests/simsubmit.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

(async () => {
  const w = { CONFIG: { SERVER_URL: 'https://srv.example/' } };
  new Function('window', 'globalThis', read('shared/simsubmit.js'))(w, w);
  const S = w.SIMSUBMIT;

  section('① 送出與結果');
  let last = null;
  global.fetch = async (url, o) => { last = { url, o: o, body: JSON.parse(o.body) }; return { json: async () => ({ ok: true, code: 'ok', star: 2 }) }; };
  let r = await S.send({ sid: '1420101', unit: '4-2-1', programs: [[{ id: 'a', args: [] }]], log: { tries: 2 }, getToken: async () => 'TOKEN' });
  ok(r.ok && r.star === 2, '★ 後端說通過 ⇒ 照實回傳');
  ok(last.url === 'https://srv.example/api/sim/verify' && last.o.method === 'POST', '送到批改伺服器的 /api/sim/verify（網址結尾的 / 不會變成 //）');
  ok(last.body.idToken === 'TOKEN' && last.body.sid === '1420101' && last.body.unit === '4-2-1' && last.body.log.tries === 2,
     '★★ 帶著 Google 登入憑證、學號、關卡、程式、過程紀錄');
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  r = await S.send({ sid: '1420101', unit: '4-2-1', programs: [[]], getToken: async () => 'T' });
  ok(r.code === 'offline' && S.shouldQueue(r), '★★ 連不上（Colab 沒開）⇒ offline，要先記著');
  global.fetch = async () => ({ json: async () => { throw new SyntaxError('HTML'); } });
  r = await S.send({ sid: '1', unit: 'u', programs: [[]] });
  ok(r.code === 'offline', '★ ngrok 離線回一頁 HTML ⇒ 也當成沒開（不是當成「沒拼對」）');
  ok(!S.shouldQueue({ ok: false, code: 'wrong' }) && !S.shouldQueue({ ok: false, code: 'auth' }) && !S.shouldQueue({ ok: true }),
     '★ 沒拼對、不是本人 ⇒ 不記（記了也不會過）');
  ok(S.shouldQueue({ ok: false, code: 'db_error' }) && S.shouldQueue({ ok: false, code: 'no_judge' }), '資料庫忙、題目暫時讀不到 ⇒ 先記著');

  section('② 先記著、之後補送');
  const rec = S.pendingRecord([[{ id: 'x', args: ['1'] }], []], { runs: 3 });
  ok(typeof rec.p === 'string' && JSON.parse(rec.p)[0][0].id === 'x' && rec.log.runs === 3, '★★ 程式轉成字串存（Firestore 不能存「陣列裡的陣列」）');
  const doc = { modules: { scratch: { simPending: { '4-2-1': rec, '4-2-2': rec, '4-2-3': { p: 'oops' } } } },
                scratchVerified: { sim: { '4-2-2': { at: 1 } } } };
  const pend = S.pendingOf(doc);
  ok(pend.length === 1 && pend[0].unit === '4-2-1' && Array.isArray(pend[0].programs), '★ 只補送還沒確認的（後端確認過的、壞掉的那筆都跳過）');
  let n = 0;
  global.fetch = async () => { n++; throw new Error('down'); };
  const doc2 = { modules: { scratch: { simPending: { 'a': rec, 'b': rec, 'c': rec } } } };
  await S.retryPending(doc2, { sid: '1420101' });
  ok(n === 1, '★ 伺服器沒開就停，不一筆一筆試（省得每次打開頁面卡很久）');

  section('③ 模擬器交出過程紀錄');
  const b = read('shared/blocks.js');
  ok(/function run\(\) \{\s*if \(running\) return;\s*stats\.runs\+\+;/.test(b) && /function check\(\) \{\s*stats\.tries\+\+;/.test(b), '★ 記下按了幾次「執行」、幾次「檢查答案」');
  ok(/\{ tries: stats\.tries, runs: stats\.runs, secs: Math\.round\(\(Date\.now\(\) - stats\.t0\) \/ 1000\) \}/.test(b), '★ onPass 第三個參數是過程紀錄');

  section('④ 關卡頁、闖關地圖接上');
  const lv = read('11502/level.html'), sc = read('11502/scratch.html');
  ok(/<script src="\.\.\/shared\/simsubmit\.js"><\/script>/.test(lv) && /<script src="\.\.\/shared\/simsubmit\.js"><\/script>/.test(sc), '兩頁都載入 simsubmit.js');
  ok(/onPass: \(all, programs, log\) => \{ markPre\(\); simSubmit\(unit\.id, programs, log\); advance\(\); \}/.test(lv), '★★★ 拼對 ⇒ 送後端確認（不是學生頁面自己寫星星）');
  ok(/SIMSUBMIT\.shouldQueue\(r\) && sid/.test(lv) && /simPending: \{ \[unitId\]: SIMSUBMIT\.pendingRecord\(programs, log\) \}/.test(lv), '★★ 後端沒開 ⇒ 先記在 simPending');
  ok(/auth\.currentUser \? auth\.currentUser\.getIdToken\(\)/.test(lv) && /auth\.currentUser \? auth\.currentUser\.getIdToken\(\)/.test(sc), '★★ 送出時拿 Google 登入憑證');
  ok(/SIMSUBMIT\.retryPending\(snap\.data\(\)/.test(lv) && /SIMSUBMIT\.retryPending\(snap\.data\(\)/.test(sc), '★★ 打開關卡頁、闖關地圖時補送');
  ok(!/unitStars:\s*\{\s*\[unitId\]/.test(lv), '★★★ 關卡頁不會自己寫作品星（那幾格只有後端寫得進去）');
  ok(/上一步程式拼圖拼對，這一關就已經通關了（2⭐）/.test(lv) && /75 分以上 \+1⭐、90 分以上 \+2⭐/.test(lv), '★ 上傳那一步改成「加分挑戰」的說明');

  section('⑤ 教師端可疑紀錄');
  const A = require(path.join(ROOT, 'shared', 'audit.js'));
  const prog = { '1420101': { scratchVerified: { sim: {
    '4-2-1': { at: 1, tries: 3, runs: 5, secs: 300 },
    '4-2-2': { at: 2, tries: 1, runs: 0, secs: 200 },
    '4-2-3': { at: 3, tries: 1, runs: 2, secs: 8 } } } } };
  const odd = A.simOdd(prog);
  ok(odd.length === 2 && odd.some(x => x.unit === '4-2-2' && /沒按「執行」/.test(x.why)) && odd.some(x => x.unit === '4-2-3' && /8 秒/.test(x.why)),
     '★★ 列出「沒按過執行就拼對」「幾秒就拼對」；正常拼的不列');
  ok(A.simOdd({ x: { modules: {} } }).length === 0, '沒有模擬器紀錄（上學期）⇒ 沒東西');
  const au = read('shared/audit.html');
  ok(/function simBox\(\)/.test(au) && /\$\{simBox\(\)\}/.test(au) && /if \(!state\.hasSim\) return '';/.test(au), '★ 可疑紀錄頁多了 ⑥（上學期沒有模擬器紀錄就不顯示）');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
