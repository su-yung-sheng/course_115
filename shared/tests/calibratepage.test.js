/* 教師端的「📐 跨模型校正」（11501/teacher.html）
   跑法：node shared/tests/calibratepage.test.js

   ⛔⛔ 這顆按鈕為什麼存在（2026-09-16 的實測資料）：
      1410212 同一份程式 flash 連三次都給 50，換 claude-haiku → 95；
      1410213 完全同一份程式：flash 85／flash 80／haiku 65。
      ⇒ 學生那天過不過 75 分，取決於 flash 有沒有塞車。
      這顆按鈕把那件事從「碰巧發現」變成「隨時量得到」。

   ★ 這份測試守的是幾件**錯了會給出讓人安心的錯誤結論**的事 ——
     那比當掉更危險，因為沒有人會去追。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, '11501', 'teacher.html'), 'utf8');
const fn = (html.match(/async function gdCalibrate\(\)[\s\S]*?\n    \}/) || [''])[0];

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('★ 這顆按鈕接得上');
{
  ok(fn.length > 0, '找得到 gdCalibrate');
  ok(/\/api\/teacher\/calibrate/.test(fn), '打的是校正端點');
  ok(/gdCalibrate\(\)/.test(html) && /跨模型校正/.test(html), '畫面上有按鈕');
  ok(/window\.gdCalibrate = gdCalibrate/.test(html),
     '★★ 有掛到 window —— onclick 找不到函式時是靜悄悄地沒反應');
  ok(/會真的呼叫每一個模型|付費/.test(html),
     '★★ 要講明這一按會花錢（按鈕旁邊或註解裡）');
}

section('★★★ 結論要在表格上面，而且不可以說錯');
{
  /* ★ 表格是證據，結論才是老師要的。老師沒空自己做減法。 */
  ok(fn.indexOf('verdict') < fn.indexOf('<table'),
     '★★ 結論排在表格**前面**');
  /* ⛔⛔ 這一條最重要：跨過 75 分代表「有學生會因為抽到哪個模型而過或不過」。
     那不是「差幾分」的程度問題，是公不公平的問題，要用最醒目的方式講。 */
  ok(/crosses_pass_line/.test(fn) && /及格線/.test(fn),
     '★★★ 跨過及格線要單獨講出來（不是只報差幾分）');
  /* ⛔⛔ 2026-09-16 實際發生：flash 回 503 → 只有一個模型答出來。
     這時候如果寫「差 0 分，標準夠明確」，老師就會放心地不再追這件事 ——
     那比畫面當掉危險得多。 */
  ok(/量不出差距/.test(fn) && /不是沒有差距/.test(fn),
     '★★★ 只有一個模型答出來時要說「量不出差距（不是沒有差距）」—— ' +
     '說成「沒有差距」等於發一張假的安全證明');
}

section('★★★ 失敗的那一格');
{
  /* ⚠️ 講症狀不講原因，正是我前兩天嫌棄 Classroom 錯誤訊息的那個毛病。 */
  ok(/這次沒問到/.test(fn) && /x\.error/.test(fn),
     '★★★ 要印出**原因**（例如 503 忙線），不是只說「失敗了」');
  ok(/再按一次/.test(fn),
     '★★ 而且要講下一步 —— 校正已經不重試了，就得告訴老師自己再按');
  ok(/x\.matched|bad/.test(fn),
     '★★★ 沒有真的由它自己回答的那一格要標成不算數');
  ok(/校正不該降級/.test(fn),
     '★★ 萬一真的出現降級（no_fallback 失效），要明講而不是默默顯示');
}

section('★★ 樣本庫（2026-09-17）');
{
  const lf = (html.match(/async function gdLoadSamples\(\)[\s\S]*?\n    \}/) || [''])[0];
  ok(lf.length > 0 && /calib-samples/.test(lf), '有「載入樣本庫」而且打對端點');
  ok(/window\.gdLoadSamples = gdLoadSamples/.test(html), '★★ 有掛到 window');
  /* ⚠️ 空的樣本庫很正常（要有人交出 50～89 分的作品才會累積）。
     顯示成錯誤的話，老師會以為功能壞了然後跑來問。 */
  ok(/樣本庫還是空的/.test(lf) && /才會開始累積/.test(lf),
     '★★★ 樣本庫是空的要說「還在累積」，不可以顯示成錯誤');
  /* ⛔⛔ 這一條最重要：用樣本時後端會以**樣本自己的關卡**為準。
     前端若還把畫面上的 unit／overrides 一起送，老師會以為他剛改的規則
     有生效 —— 而實際上完全沒有，且畫面上看不出任何差別。 */
  ok(/if \(_sample\) \{[\s\S]{0,120}fd\.append\('sample'/.test(fn),
     '★★★ 選了樣本就只送 sample');
  ok(/\} else \{[\s\S]{0,200}fd\.append\('overrides'/.test(fn),
     '★★★ unit 和 overrides 只有「用上傳的檔案」時才送 —— ' +
     '用樣本時送了，會讓人以為畫面上的規則有生效，其實沒有');
  ok(/j\.sample \?/.test(fn) && /來源：樣本庫/.test(fn),
     '★★ 結果要標明這次是用樣本庫的哪一份（不然分不出量的是什麼）');
}

section('★ 不要留著上一關的結果');
{
  /* ⚠️ 換了關卡，評分標準就換了，上一關的校正結果完全不適用。
     留在畫面上會被當成這一關的。 */
  ok(/gdCalibResult/.test(html) &&
     /_cb\.classList\.add\('hidden'\)|gdCalibResult'\)[\s\S]{0,80}hidden/.test(html),
     '★★ 換關卡時要把上一次的校正結果收起來');
}

section('★ 語法');
{
  let okSyntax = true, err = '';
  try { new Function('return ' + fn.replace(/^async function/, 'async function')); }
  catch (e) { okSyntax = false; err = String(e.message || e); }
  ok(okSyntax, '★★ gdCalibrate 語法正確' + (okSyntax ? '' : '　←　' + err));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
