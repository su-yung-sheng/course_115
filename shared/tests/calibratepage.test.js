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
// ⚠️ 不要把參數列表寫死成 ()：2026-09-19 加了 mode 參數，
//    這一行抓不到函式，下面所有斷言全部變紅 —— 而程式其實是好的。
const fn = (html.match(/async function gdCalibrate\([^)]*\)[\s\S]*?\n    \}/) || [''])[0];

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('★ 這顆按鈕接得上');
{
  ok(fn.length > 0, '找得到 gdCalibrate');
  ok(/\/api\/teacher\/calibrate/.test(fn), '打的是校正端點');
  ok(/gdCalibrate\(\)/.test(html) && /跨模型校正/.test(html), '畫面上有按鈕');
  /* ★ 2026-09-19：第三種來源 —— 這一關自己的參考解答。
     樣本庫是空的（只收 50～99 分，而有記關卡的作品幾乎都是 100），
     十關剛改完規則卻一份可測的程式都沒有。 */
  ok(/gdCalibrate\('example'\)/.test(html) && /用參考解答校正/.test(html),
     '★★ 畫面上要有「用參考解答校正」按鈕');
  ok(/_useExample[\s\S]{0,200}mode === 'example'/.test(fn),
     '★★ gdCalibrate 要收 mode 參數來分辨這一種來源');
  /* ⛔⛔ 用參考解答時要無視樣本下拉選單。留著的話，選單裡還停著
     上一次挑的樣本，就會安靜地量到別的東西，而畫面上看不出來。 */
  ok(/!_useExample && _sampleSel/.test(fn),
     '★★★ 用參考解答時要無視樣本選單 —— 不然會患默地量到別關的程式');
  ok(/fd\.append\('source', 'example'\)/.test(fn),
     '★★ 要送 source=example，後端靠它分辨');
  /* ★ 參考解答被扣分，是**規則**的問題，不是解答寫得不好。 */
  ok(/j\.source === 'example'/.test(fn),
     '★★ 參考解答被扣分時要特別講一句');
  /* ⛔⛔ 2026-09-19：這一句原本寫死「就是規則沒講清楚的地方」，
     第一天就講錯了：第 2 關兩個模型都 90、扣同一條、措辭也一樣，
     那是**參考解答自己**被舊版轉換器截斷了，改規則永遠治不好。 */
  ok(/各個模型扣的地方不一樣[\s\S]{0,120}規則/.test(fn),
     '★★★ 模型扣的地方**不一樣** → 要指向規則');
  ok(/扣同一條[\s\S]{0,160}參考解答本身/.test(fn),
     '★★★ 模型扣**同一條** → 要指向參考解答本身 —— '
     + '兩種情況的修法完全不同，寫死其中一種會把老師帶往錯的方向');
  ok(/重新轉換/.test(fn),
     '★★ 要講出下一步動作（把 .sb3 重新轉換一次），不是只說「有問題」');
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
  /* ⛔⛔ 2026-09-18：原本判的是「有沒有跨過 75」這條寫死的線。
     第一次真的跑出結果就打臉了：flash 95／haiku 85 顯示成
     「還沒跨過 75」，語氣像是「還好」—— 但 95 是三星、85 是兩星。
     ★ 會改變星數的門檻不只一條。要問的是「星數一不一樣」，
       不是「有沒有跨過某個數字」。 */
  ok(/GRADING\.scratchStar/.test(fn) && /_starDiff/.test(fn),
     '★★★ 用 GRADING.scratchStar 判「星數一不一樣」，不是比對寫死的門檻');
  ok(!/crosses_pass_line/.test(fn),
     '★★★ 不可以再用後端那個寫死 75 的判斷');
  /* ⚠️ 要釘的是「_starDiff 是怎麼算出來的」，不是「有沒有出現 scratchStar」——
     只檢查有沒有出現的話，把判斷換成寫死的 75、而 scratchStar 還留在旁邊
     算別的東西，測試照樣是綠的（我第一版就是這樣，變異驗證沒紅）。 */
  ok(/_starDiff = \([^;]*_sLo !== _sHi\)/.test(fn),
     '★★★ _starDiff 必須是「兩邊算出來的星數不一樣」，不是任何寫死的分數比較');
  ok(!/_lo < 75|_hi >= 75|< 75|>= 75/.test(fn),
     '★★ gdCalibrate 裡不可以出現寫死的 75／90');
  ok(/拿到不同的星數/.test(fn),
     '★★ 結論要講「星數不同」，那才是學生真正在意的後果');
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

section('★★★ 要看得到「差在哪一條規則」（2026-09-18）');
{
  /* ⛔⛔ 這一條是被**三次**卡關逼出來的。校正只報分數，於是每次看到
     差距都只能從算術反推：
       · haiku 85 → 從 100−15 猜「整條規則扣光」（後來證實是對的）
       · haiku 87 → 13 分扣在哪？**猜不出來**（3+10？還是別的？）
     ★ 「差在哪一條規則」正是拿去改規則的那個東西。
       沒有它，這個工具只能說「有問題」，不能說「改哪裡」。
     ⚠️ 而後端**本來就有回** deducted_items —— 資料在手上卻沒畫出來，
        比沒有資料更浪費。 */
  ok(/x\.deducted_items/.test(fn),
     '★★★ 每個模型的扣分明細要畫出來（後端本來就有回，不要浪費）');
  ok(/<details/.test(fn),
     '★★ 預設收起來 —— 多數時候只看分數，展開會很長');
  ok(/shortM\(x\.requested\)/.test(fn),
     '★★ 摘要要標明是哪個模型的扣分（兩三個並排時分不出來就沒用了）');
  ok(/whitespace-pre-wrap/.test(fn),
     '★ 扣分明細是多行文字，換行要留著');
  ok(/esc\(x\.deducted_items\)/.test(fn),
     '★★★ 那是模型產生的文字，塞進 HTML 之前一定要跳脫');
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

section('★★★ 分數是誰算的（2026-09-19）');
{
  /* ⛔⛔ 分數已經改成由後端把 deductions 加總算出來。
     但模型偶爾會把 deductions 回成不能用的形狀，這時後端會退回
     「用模型自己填的分數」。那一格看起來和別格一模一樣 ——
     老師會拿它去改規則，而規則改不掉它（壞的是加法，不是規則）。
     ⇒ 畫面一定要分得出來這一格的分數是誰算的。 */
  ok(/score_source/.test(fn),
     '★★★ 校正表格要看 score_source —— 否則「模型自己算的分數」'
     + '會被當成規則問題，白改一輪規則');
  ok(/score_source !== 'backend'[\s\S]{0,200}模型自己填的/.test(fn),
     '★★★ 不是後端算的那一格要**明講**，不可以只是換個顏色');
  ok(/score_model/.test(fn),
     '★★ 後端改掉分數時要順便顯示模型本來寫幾分 —— '
     + '這是判斷「模型會不會算數」唯一的線索');
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
