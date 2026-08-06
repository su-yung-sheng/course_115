/* =====================================================================
   shared/classroom.js 的測試（純資料處理與錯誤訊息）
   ---------------------------------------------------------------------
       node shared/tests/classroom.test.js

   實際去讀 Classroom 的是 shared/classroom.gs（Apps Script），
   這裡測不到網路那一段，但**錯誤訊息**測得到 —— 而那是最常出問題、
   也最容易寫爛的地方：老師看到的如果只是「fetch 失敗」，
   他不會知道是網址貼錯、通行碼不對、還是部署權限沒設好。
   ===================================================================== */
'use strict';
const path = require('path');
global.window = {};
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
require(path.resolve(__dirname, '..', 'classroom.js'));
const C = window.CLASSROOM;

let pass = 0, fail = 0;
const is = (g, w, l) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `\n       期望 ${JSON.stringify(w)}\n       實得 ${JSON.stringify(g)}`));
};
const section = t => console.log('\n── ' + t + ' ──');

section('通行碼記在瀏覽器，不進版控');
is(C.savedKey(), '', '一開始沒有');
C.saveKey('abc123');
is(C.savedKey(), 'abc123', '存得起來');
C.forgetKey();
is(C.savedKey(), '', '清得掉（「中斷並清除通行碼」用）');

section('沒設定時要講清楚缺什麼');
C.init('', '');
return_(C.courses(), /Apps Script 的網址/, '沒有網址 → 說去部署並填 GAS_URL');
C.init('https://script.google.com/macros/s/AAA/exec', '');
return_(C.courses(), /通行碼/, '有網址沒通行碼 → 說要輸入 QUERY_KEY');

section('回應不是 JSON —— 幾乎都是部署設定不對');
const nj = (t, status) => C._explainNonJson(t, { status: status || 200 });
is(/誰可以存取.*任何人/.test(nj('<html>Sign in to continue</html>')), true,
   '被導去登入頁 → 說「誰可以存取」要選「任何人」');
is(/doGet/.test(nj('Script function not found: doGet')), true,
   '找不到 doGet → 說整份沒貼完或沒重新部署');
is(/\/exec/.test(nj('<html>whatever</html>', 404)), true,
   '★ 回的是網頁 → 提醒網址要用結尾 /exec 的部署網址，不是編輯器網址');

section('.gs 回報的錯誤要補上「去哪裡改」');
is(/服務.*Classroom/.test(C._explainError('Classroom is not defined')), true,
   '沒加 Classroom 服務 → 指到編輯器左側「服務」');
is(/selfTest/.test(C._explainError('PERMISSION_DENIED')), true,
   '權限問題 → 叫他先在編輯器跑 selfTest 完成授權');
is(C._explainError('通行碼不正確。'), '通行碼不正確。', '.gs 已經寫清楚的就原樣顯示，不要再包一層');

section('交了沒');
const row = { state: 'TURNED_IN', attachments: [{ kind: 'drive', title: 'a.png', link: 'x' }] };
is(C.handedIn(row), true, '已繳交＋有附件 → 算交了');
is(C.handedIn({ state: 'TURNED_IN', attachments: [] }), false, '按了繳交但沒附件 → 不算');
is(C.handedIn({ state: 'CREATED', attachments: [{}] }), false, '放了附件沒按繳交 → 不算');
is(C.handedIn(null), false, '沒有這個人的紀錄也不會爆掉');

section('圖片／影片只是「看起來」，最後仍要老師確認');
is(C.guessKind({ title: '流程圖.png' }), 'image', 'png → 圖片');
is(C.guessKind({ title: '錄影 2026.MP4' }), 'video', '大寫副檔名也認得');
is(C.guessKind({ kind: 'youtube', title: 'x' }), 'video', 'YouTube → 影片');
is(C.guessKind({ title: '我的作業' }), 'unknown', '★ 看不出來就說看不出來，不亂猜');

section('從作業名稱找出「這一關」的那一份');
const W = [
  { id: 'a', title: '2026/08/06 任務一：2-1-1A 班級置物櫃' },
  { id: 'b', title: '2026/08/13 任務二：2-1-1B 集合點名' },
  { id: 'c', title: '2026/08/20 任務三：2-1-2 演奏小星星' }
];
is(C.findWork(W, ['2-1-1A']).work.id, 'a', '2-1-1A → 找到第一份');
is(C.findWork(W, ['2-1-1B']).work.id, 'b', '2-1-1B → 找到第二份');
is(C.findWork(W, ['2-1-2']).work.id, 'c', '2-1-2 → 找到第三份');
is(C.findWork(W, ['2-1-1']).work, null,
   '★ 「2-1-1」不會誤中 2-1-1A／2-1-1B —— 前綴相同時安靜認錯，會讓整班分數登記到別關');
is(C.findWork(W, ['2-9-9']).work, null, '沒有對應作業 → 回 null（交給老師自己指定）');
is(C.findWork([], ['2-1-1A']).work, null, '作業清單是空的也不會爆');
is(C.findWork(W, ['2-1-2', '2-1-1A']).work.id, 'a', '多個候選代號時長的先比');
const dup = C.findWork([{ id: 'x', title: 'A：2-1-2 甲' }, { id: 'y', title: 'B：2-1-2 乙' }], ['2-1-2']);
is(dup.work, null, '同一個代號對到兩份 → 不猜');
is(dup.many.length, 2, '　並回報是哪兩份，讓老師選');

section('依班級自動挑課程');
const CS = [
  { id: 'c1', name: '資訊科技 801' },
  { id: 'c2', name: '資訊科技 802' },
  { id: 'c3', name: '八年級資訊科技812' }
];
is(C.findCourse(CS, '801').course.id, 'c1', '801 → 對到那一門');
is(C.findCourse(CS, '812').course.id, 'c3', '沒空格也對得到');
is(C.findCourse(CS, '809').course, null, '沒有那一班的課 → 不猜');
is(C.findCourse(CS, '').course, null, '還沒選班級 → 不動');
const dupC = C.findCourse([{ id: 'x', name: '資訊科技 801 上' },
                           { id: 'y', name: '資訊科技 801 下' }], '801');
is(dupC.course, null, '★ 同一班有兩門課 → 不猜（猜錯會讀到另一門的繳交）');
is(dupC.many.length, 2, '　並回報是哪兩門');

section('從課名抓班級');
is(C.classFromCourseName('資訊科技 801'), '801', '「資訊科技 801」→ 801');
is(C.classFromCourseName('八年級資訊科技812'), '812', '沒空格也抓得到');
is(C.classFromCourseName('資訊科技'), '', '★ 課名沒寫班級就不要猜 —— 猜錯會篩掉整班');
is(C.classFromCourseName(null), '', 'null 不會爆掉');

function return_(promise, re, label) {
  promise.then(
    () => { fail++; console.log('  ❌ ' + label + '　（應該要失敗卻成功了）'); },
    e => { const ok = re.test(e.message); ok ? pass++ : fail++;
           console.log((ok ? '  ✅ ' : '  ❌ ') + label + (ok ? '' : '　實得：' + e.message)); }
  );
}

setTimeout(() => {
  console.log(`\n通過 ${pass}／失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
}, 50);
