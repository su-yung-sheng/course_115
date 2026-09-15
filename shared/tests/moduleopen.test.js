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

section('★★ 教師端：不可以把設定洗掉');
{
  const t = read('11501/teacher.html');
  ok(/scOpen-arduino/.test(t), '★ 有輸入框');
  const open = t.slice(t.indexOf('async function openSchedModal'),
                       t.indexOf('async function openSchedModal') + 1200);
  ok(/scOpen-arduino/.test(open),
     '★★★ 打開課表時要把已存的日期**填回輸入框** —— 不填的話，老師只是想'
     + '改課表、按了儲存，開放日就被空字串洗掉，而且完全沒有徵兆');
  const save = t.slice(t.indexOf('async function saveSchedule'),
                       t.indexOf('async function saveSchedule') + 1400);
  ok(/open_json/.test(save) && /merge:\s*true/.test(save),
     '★★ 儲存要寫 open_json，而且要 merge（同一份文件還有課表）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
