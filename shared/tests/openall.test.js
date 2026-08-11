/* 備課模式（11502/config.js 的 OPEN_ALL_UNITS）
   跑法：node shared/tests/openall.test.js

   ★ 這個開關把「依序開放」整個關掉，十關全部打開。
     開著是為了改內容 —— 要調第 7 關卻得先把前六關通關一次，
     那不是謹慎，是讓人乾脆不改。

   ⚠️ 它最危險的地方不是「開著」，是「開著而沒有人知道」。
     所以這一份守的是**可見性**，不是開關本身：

       ① 開著的時候，兩個頁面都要掛出橘色橫幅
       ② 正在上課的那個學期（11501）不可以有這個開關
       ③ 上線檢查表要列著它

     真正決定何時關掉的是人。測試能做的，是讓「忘了關」
     不可能安靜發生。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

function cfg(term) {
  const w = {};
  new Function('window', read(term + '/config.js'))(w);
  return w.CONFIG || {};
}

const G = {};
new Function('window', read('shared/grading.js'))(G);
const GRADING = G.GRADING;

const TERMS = [['11501', cfg('11501')], ['11502', cfg('11502')]];

section('現在的狀態');
TERMS.forEach(([t, c]) => {
  const on = c.OPEN_ALL_UNITS === true;
  console.log('     ' + t + '：OPEN_ALL_UNITS = ' + JSON.stringify(c.OPEN_ALL_UNITS) +
              (on ? '　到期日 ' + (c.OPEN_ALL_UNTIL || '（沒設）') +
                    '　現在' + (GRADING.openAll(c) ? '開著' : '已過期，鎖回來了')
                  : '　→ 依序開放正常運作'));
});

/* ★ 這一份原本有一條「11501 不可以打開」。
   2026-08-11 拿掉了 —— 老師要再確認一次上學期十關的內容，
   而那同樣得先把每一關都排對流程圖、上傳作品拿到 2⭐。
   ⇒ 與其禁止，不如讓它**自己會關**。
     「記得開學前關掉」不是一個機制，是一個願望；
     願望在忙起來的第一週就會失效，而那正是最不能失效的一週。 */
section('★ 打開就一定要有到期日');
TERMS.forEach(([t, c]) => {
  if (c.OPEN_ALL_UNITS !== true) { ok(true, t + ' 沒有打開，不必檢查到期日'); return; }
  ok(/^\d{4}-\d{2}-\d{2}$/.test(String(c.OPEN_ALL_UNTIL || '')),
     '★ ' + t + ' 有寫到期日（' + c.OPEN_ALL_UNTIL + '）—— ' +
     '沒有到期日的話，忘了關就是整學期沒有鎖');
  /* 過期之後這一條會變紅：那就是「該把設定清掉了」的提醒。
     ⚠️ 學生端不會因此壞掉 —— GRADING.openAll() 早就自己回 false 了。
        紅的是測試，不是課程。 */
  ok(GRADING.openAll(c),
     '★ ' + t + ' 還沒過期' +
     (GRADING.openAll(c) ? '' : '　←　' + c.OPEN_ALL_UNTIL +
      ' 已經過了，鎖已經自己回來了。請把 config.js 的 OPEN_ALL_UNITS 改成 false 並刪掉這兩行設定'));
});

section('★ 到期就自己失效（不靠人記得）');
{
  const c = { OPEN_ALL_UNITS: true, OPEN_ALL_UNTIL: '2026-08-29' };
  ok(GRADING.openAll(c, '2026-08-11') === true, '到期日之前：開著');
  ok(GRADING.openAll(c, '2026-08-29') === true, '★ 到期日當天還算開著（不要提早半天關掉）');
  ok(GRADING.openAll(c, '2026-08-30') === false, '★ 過了一天：自己關掉，依序開放回來');
  ok(GRADING.openAll({ OPEN_ALL_UNITS: false, OPEN_ALL_UNTIL: '2099-01-01' }) === false,
     '沒打開就是沒打開，到期日再遠也一樣');
  /* 日期寫壞不要反而把人鎖住 —— 這是備課工具，不是安全機制。 */
  ok(GRADING.openAll({ OPEN_ALL_UNITS: true, OPEN_ALL_UNTIL: '亂寫' }) === true,
     '   到期日寫壞了 → 當作沒設（不要因為打錯字就把備課模式關掉）');
  ok(GRADING.openAll({}) === false, '什麼都沒設 → 關著');
}

/* 受影響的頁面：兩學期各自的闖關入口。
   只有一邊讀開關的話，地圖上鎖著、網址打進去卻進得去（或反過來），那更難查。 */
const PAGES = [
  ['11502/level.html', '11502 關卡頁'],
  ['11502/scratch.html', '11502 闖關地圖'],
  ['11501/flowchart.html', '11501 流程圖／程式設計']
];

section('★ 開著就一定要看得見');
PAGES.forEach(([f, name]) => {
  const s = read(f);
  /* ⚠️ 一定要走 GRADING.openAll()，不可以自己判 `=== true` ——
     自己判的話，「到期自動失效」那一層就被繞過去了。 */
  ok(/GRADING\.openAll\(/.test(s),
     '★ ' + name + ' 用 GRADING.openAll()（自己判 === true 會繞過到期日）');
  /* 橫幅是這整套設計的重點，不是裝飾。 */
  ok(/備課模式/.test(s), '★ ' + name + ' 有備課模式的橫幅');
  ok(/OPEN_ALL_UNITS/.test(s) && /false/.test(s), '   橫幅寫明要把它改回 false');
  ok(/OPEN_ALL_UNTIL/.test(s), '   橫幅也寫出到期日（不然「自己會關」等於沒說）');
  /* 橫幅要顯眼。用預設的灰字小提示等於沒有。 */
  ok(/#fdba74|#fff7ed/.test(s), '   橫幅是橘色的（它的工作就是被看到）');
});

section('★ 關掉之後鎖要回來');
PAGES.forEach(([f, name]) => {
  /* 開關只是短路，不是把 GATE 拿掉 —— 拿掉的話就回不去了。 */
  const s = read(f);
  ok(/GATE\.isOpen/.test(s), name + ' 還留著真正的依序開放判斷');
  ok(/OPEN_ALL \? true : GATE\.isOpen/.test(s) || /if \(OPEN_ALL\) return true;/.test(s),
     '★ ' + name + ' 的開關是「短路」，不是把判斷刪掉');
});

section('上線檢查表要列著');
{
  const doc = read('shared/docs/06_上線檢查表.md');
  ok(/OPEN_ALL_UNITS/.test(doc), '★ 06_上線檢查表.md 有列這一項');
  /* 打開著的學期，檢查表上就要有一條還沒打勾的待辦。
     ⚠️ 比對的是**學期資料夾名稱**，不是 OPEN_ALL_UNITS 這個字 ——
        待辦寫的是「11501/config.js 改回 false」，同一行不會再出現變數名。 */
  TERMS.forEach(([t, c]) => {
    if (c.OPEN_ALL_UNITS !== true) return;
    ok(new RegExp('\\[ \\][^\\n]*' + t).test(doc),
       '   ' + t + ' 開著 → 檢查表有一條還沒打勾的待辦');
  });
  ok(/自動失效|自己關/.test(doc), '   檢查表有寫「它會自己關」（不然人會以為只能靠記得）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
