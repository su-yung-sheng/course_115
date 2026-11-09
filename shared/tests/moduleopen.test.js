/* 模組開放日（老師 2026-09-15）
   跑法：node shared/tests/moduleopen.test.js

   ⛔ 起因：「智慧家居機電專題」11 月底才上，但那張卡從開學就掛在
      闖關基地上，學生點進去看到的是還沒教的東西。
   ⇒ 未到開放日就畫成灰色、點不進去，並寫明預計哪一天開放。

   ★ 這一支守的是三件「錯了不會報錯」的事：
     ① 讀不到設定時要**放行**（不可以把整班擋在外面）
     ② 未開放時要真的畫成 <div>，不是只加灰色
     ③ 教師端打開課表時要把已存的日期**填回輸入框**
        （不填的話，老師只是想改課表、按了儲存，開放日會被空字串洗掉） */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const w = { window: null };
w.window = w;
new Function('window', read('shared/schedule.js'))(w);
const S = w.SCHEDULE;

section('★★ 規則本身');
{
  const sched = { open_json: JSON.stringify({ arduino: '2026-11-30' }) };
  ok(S.openDateOf(sched, 'arduino') === '2026-11-30', '讀得到設定的日期');
  ok(S.openLabel(sched, 'arduino') === '預計於 2026/11/30 開放',
     '★★ 給學生看的那一句（斜線，不是減號）　←　' + S.openLabel(sched, 'arduino'));
  ok(S.moduleOpen(sched, 'arduino', new Date('2026-11-29T23:00:00')) === false,
     '★★ 前一天還沒開放');
  ok(S.moduleOpen(sched, 'arduino', new Date('2026-11-30T00:30:00')) === true,
     '★★★ **當天就算開放** —— 寫 11/30 的人是指那天要上課，不是隔天');
  ok(S.moduleOpen(sched, 'arduino', new Date('2026-12-05T10:00:00')) === true,
     '之後當然開放');
  ok(S.moduleOpen(sched, 'ethics', new Date('2026-09-15T10:00:00')) === true,
     '★★ 沒設定的模組不受影響');
}

section('★★★ 壞掉的時候要放行，不是把人擋在外面');
{
  /* ⚠️ 設定讀失敗就把教材鎖住，是拿學生的課去賭一個設定檔。
     寧可讓人看到還沒完成的頁面，也不要整班進不去。 */
  ok(S.moduleOpen({}, 'arduino') === true, '★★★ 讀不到課表 → 放行');
  ok(S.moduleOpen({ open_json: '這不是 JSON' }, 'arduino') === true,
     '★★★ JSON 壞掉 → 放行');
  ok(S.moduleOpen({ open_json: JSON.stringify({ arduino: '11/30' }) }, 'arduino') === true,
     '★★★ 日期格式不對 → 放行（不是當成「永遠不開放」）');
  ok(S.moduleOpen(null, 'arduino') === true, '★★ 連 sched 都是 null → 放行');
  ok(S.openLabel({}, 'arduino') === '', '沒設定就沒有那一句');
}

section('★★ 學生端：未開放要真的點不進去');
{
  const hub = read('11501/hub.html');
  ok(/SCHEDULE\.moduleOpen/.test(hub), '★★ hub 有問這件事');
  ok(/open_json/.test(hub), '★★ loadSchedule 要把 open_json 帶進來（漏了就永遠是開放）');
  /* ⚠️ 只切「未開放」那一段。多切一點就會吃到下面正常那張卡的
     <a href=...>，於是這一條永遠是紅的 —— 而程式其實是對的。
     （這個專案的測試已經因為「切太多／切太少」踩過好幾次。） */
  const _i = hub.indexOf('if (!openOK)');
  const seg = hub.slice(_i, hub.indexOf('\n        return `', _i));
  ok(seg.length > 100 && !/<a\s+href/.test(seg),
     '★★★ 未開放時**不可以**是 <a> —— 只加灰色的話，鍵盤 Tab 走得進去、'
     + '右鍵「開新分頁」也照樣打得開');
  ok(/尚未開放/.test(seg), '★★ 畫面上要講明白');
  ok(/openMsg/.test(seg), '★★★ 要顯示「預計於 ○○ 開放」，不是只說被鎖住 ——'
     + '學生看到「鎖住」只會來問老師');
}

section('★★ 專題卡還沒開放時，位置先借給排行賽（老師 2026-09-30；11502 同一個做法）');
for (const TERM of ['11501', '11502']) {
  console.log('  （' + TERM + '）');
  const hub = read(TERM + '/hub.html');
  const code = hub.replace(/\/\*[\s\S]*?\*\//g, '');
  const def = (code.match(/const STAND_IN = \{[\s\S]*?\n    \};/) || [''])[0];
  ok(/arduino:\s*\{[^}]*href:'arena\.html'/.test(def), '★★ 借位置的是 arduino（5016B 專題卡），連到 arena.html');
  const iStand = code.indexOf('if (!openOK && STAND_IN[m.id])');
  const iLock = code.indexOf('if (!openOK) {');
  ok(iStand > 0 && iStand < iLock, '★★★ 先判斷「有沒有借位置的卡」，才輪到灰色上鎖卡');
  const seg = code.slice(iStand, iLock);
  ok(/<a href="\$\{s\.href\}"/.test(seg), '★★ 借位置的卡是點得進去的連結');
  ok(/\$\{openMsg \|\| '之後開放'\}/.test(seg) && /換回專題/.test(seg),
     '★★ 卡片上寫明「專題預計哪天開放、開放後會換回來」');
  ok(/openOK = [\s\S]{0,120}SCHEDULE\.moduleOpen\(state\.sched, m\.id\)/.test(code),
     '★★★ 換回來的時間點就是原本的開放日（同一個 moduleOpen 判斷）—— 到期自動換回，不必再改');
  /* ★ 參賽資格（老師 2026-09-30）：資訊倫理 10 / 10 章節通關才點得進去 */
  const fnSrc = (code.match(/function standInPassed\(s, mods\)\{[\s\S]*?\n    \}/) || [''])[0];
  const standInPassed = fnSrc ? new Function(fnSrc + '; return standInPassed;')() : null;
  const S = { needModule: 'ethics', needUnits: ['a', 'b', 'c'] };
  ok(standInPassed && standInPassed(S, { ethics: { units: { a: { star: 2 }, b: { star: 0 }, x: { star: 3 } } } }) === 1,
     '★★ 算通關章節：0 星不算、清單外的不算');
  ok(standInPassed && standInPassed(S, {}) === 0, '沒有進度 ⇒ 0');
  const lockAt = seg.indexOf('if (passed < need)'), linkAt = seg.indexOf('<a href="${s.href}"');
  ok(lockAt > 0 && lockAt < linkAt, '★★★ 先判斷資格：還沒 10 / 10 就不畫連結');
  const locked = seg.slice(lockAt, linkAt);
  ok(!/<a\s/.test(locked) && /aria-disabled="true"/.test(locked) && /目前 \$\{passed\} \/ \$\{need\}/.test(locked),
     '★★★ 沒資格時是點不進去的區塊，寫明「目前 n / 10」');
  ok(/open_json:\s*d\.open_json/.test(code), '★★ loadSchedule 要把 open_json 帶進來（漏了就永遠是開放、永遠不借位置）');
  const lockSeg = code.slice(iLock, code.indexOf('\n        return `', iLock));
  ok(lockSeg.length > 100 && !/<a\s+href/.test(lockSeg) && /openMsg/.test(lockSeg),
     '★★ 其他還沒開放的模組：灰色、點不進去、寫明開放日');
  ok(fs.existsSync(path.join(root, TERM, 'arena.html')), 'arena.html 存在');
  const w2 = { window: null }; w2.window = w2;
  new Function('window', read('shared/schedule.js'))(w2);
  /* 老師 2026-09-30：5016B 開放日是 11/25（設在教師端課表的「模組開放日」） */
  const sch = { open_json: JSON.stringify({ arduino: '2026-11-25' }) };
  ok(!w2.SCHEDULE.moduleOpen(sch, 'arduino', new Date('2026-11-24T15:00:00'))
     && w2.SCHEDULE.moduleOpen(sch, 'arduino', new Date('2026-11-25T08:00:00')),
     '★ 開放日 11/25 ⇒ 11/24 還是排行賽、11/25 當天換回專題');
}

section('★★★ 「👉 建議下一關」不可以指到還沒開放的模組（老師 2026-11-09，兩學期）');
{
  for (const t of ['11501', '11502']) {
    const src = read(t + '/hub.html');
    const line = (src.match(/const nextModule = MODULES\.find\([^\n]*\);/) || [''])[0];
    ok(/isOpenNow\(m\)/.test(line) && /SCHEDULE\.moduleOpen\(state\.sched, m\.id\)/.test(src.slice(src.indexOf('const isOpenNow'), src.indexOf('const isOpenNow') + 200)),
       '★★★ ' + t + '：下一關要跳過未到開放日的模組（橫幅和「👉 下一關」標籤都靠它）');
    /* 實際跑一次：前三張都通關、專題卡未開放 ⇒ 沒有下一關（顯示「都通關了」），不是指到 5016b.html */
    const decl = src.slice(src.indexOf('const isOpenNow'), src.indexOf('const allDone'));
    const run = (M, cd, mo, st, win) => new Function('MODULES', 'cardData', 'mods', 'state', 'window', 'SCHEDULE', decl + '; return nextModule;')(M, cd, mo, st, win, win.SCHEDULE);
    const MODS = [{ id: 'ethics' }, { id: 'thinking' }, { id: 'scratch' }, { id: 'arduino', href: '5016b.html' }];
    const sched = { open_json: JSON.stringify({ arduino: '2999-12-31' }) };
    const passAll = m => ({ status: m.id === 'arduino' ? 'todo' : 'pass' });
    ok(run(MODS, passAll, {}, { sched }, { SCHEDULE: S }) === undefined, '★★★ ' + t + '：專題未開放 ⇒ 不會建議 5016b.html');
    ok(run(MODS, passAll, {}, { sched: { open_json: '' } }, { SCHEDULE: S }).id === 'arduino', '　' + t + '：開放了（或沒設日期）⇒ 照常建議專題');
    ok(run(MODS, () => ({ status: 'todo' }), {}, { sched }, { SCHEDULE: S }).id === 'ethics', '　' + t + '：還有沒通關的 ⇒ 建議第一個沒通關的');
  }
}

section('★★★ 5016b.html 本身也要擋（老師 2026-11-09：網址直接打也要擋）');
{
  const src = read('11501/5016b.html');
  const at = k => src.indexOf(k);
  ok(at('../shared/schedule.js') > 0 && at('../shared/schedule.js') < at('<script type="module">'), '★★ 載入 shared/schedule.js（和闖關基地同一套判斷）');
  const gate = src.slice(at('window.LABGATE'), at('const localKey'));
  ok(/SCHEDULE\.moduleOpen\(sched, 'arduino'\)/.test(gate) && /CFG\.COLLECTIONS\.CONFIG/.test(gate) && /'schedule'/.test(gate),
     '★★★ 讀 {學期}-config/schedule 的 open_json，用 moduleOpen 判斷 arduino');
  ok(/if \(!db \|\| !window\.SCHEDULE\) return true;/.test(gate) && /catch \(e\)[\s\S]*?return true;/.test(gate),
     '★★★ 讀不到（沒登入、規則擋、網路斷）⇒ 放行，不把學生擋在外面');
  ok(/finally \{\s*gateDone\(\);/.test(gate) && /setTimeout\(function \(\) \{ document\.documentElement\.classList\.remove\('gate-wait'\); \}, 4000\)/.test(src),
     '★★ 判斷前先藏頁面，判斷完（或最多 4 秒）一定會顯示回來');
  /* 實際畫一次「尚未開放」 */
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) {}
  if (JSDOM) {
    const fn = src.slice(at('function showClosed'), at('window.LABGATE'));
    const dom = new JSDOM('<!DOCTYPE html><body><main id="m">專題內容</main></body>');
    new dom.window.Function('document', fn + '; showClosed("預計於 2026/11/25 開放");')(dom.window.document);
    const d = dom.window.document;
    ok(!!d.getElementById('open-gate') && /尚未開放/.test(d.body.textContent) && /2026\/11\/25/.test(d.getElementById('open-gate').textContent),
       '★★ 未開放 ⇒ 顯示「尚未開放」和預計開放日');
    ok(d.getElementById('m').style.display === 'none' && !!d.querySelector('#open-gate a[href="hub.html"]'), '★★ 原本的內容藏起來，只留「回闖關基地」');
  }
}

section('★★ 教師端：不可以把設定洗掉（兩學期）');
for (const TERM of ['11501', '11502']) {
  console.log('  （' + TERM + '）');
  const t = read(TERM + '/teacher.html');
  ok(/scOpen-arduino/.test(t), '★ 有輸入框');
  const open = t.slice(t.indexOf('async function openSchedModal'),
                       t.indexOf('async function openSchedModal') + 1200);
  ok(/scOpen-arduino/.test(open) && /\.value\s*=\s*_op\.arduino/.test(open),
     '★★★ 打開課表時要把已存的日期**填回輸入框** —— 不填的話，老師只是想'
     + '改課表、按了儲存，開放日就被空字串洗掉，而且完全沒有徵兆');
  const save = t.slice(t.indexOf('async function saveSchedule'),
                       t.indexOf('async function saveSchedule') + 1400);
  ok(/open_json/.test(save) && /merge:\s*true/.test(save),
     '★★ 儲存要寫 open_json，而且要 merge（同一份文件還有課表）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
