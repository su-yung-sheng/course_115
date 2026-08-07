/* 11502/scratch.html 的「思考關卡」流程
   跑法：node shared/tests/scratchpage.test.js

   這一頁擋在「上傳作品」前面，擋錯的代價是整班交不了作業 ——
   所以這裡測的重點是「什麼情況下不可以擋」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, '11502', 'scratch.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : (fail++, console.log('  ✗ ' + l)); };

/* ★ 最重要的一條：第 4～10 關還沒有積木題目。
   無條件擋的話那七關會永遠上傳不了 —— 開學就炸。 */
ok(/if \(!lv\) \{/.test(html), '★ 沒有積木題目的關卡要直接放行');
ok(/showGrader\(u\);\s*\n\s*return;/.test(html), '   而且是直接顯示上傳表單，不是留空白');

const W = { CONFIG: {}, BLOCK_LEVELS: {} };
new Function('window', fs.readFileSync(
  path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'))(W);
const ids = Object.keys(W.BLOCK_LEVELS);
const units = ['2-1-1','2-1-2','2-1-3','2-2-1','2-3-1','2-3-2','2-3-3','2-4-1','2-4-2','2-4-3'];
const missing = units.filter(u => ids.indexOf(u) < 0);
ok(missing.length === 7, '目前 ' + missing.length + ' 關沒有題目（' + missing.join('、') + '）—— 這幾關一定要放行');

/* 步驟數要跟著關卡有什麼而變，不能寫死三步 */
const steps = lv => {
  const out = [];
  if (lv.analysis) out.push('analysis');
  if (lv.derive) out.push('derive');
  out.push('blocks');
  return out;
};
const s1 = steps(W.BLOCK_LEVELS['2-1-1']);
const s3 = steps(W.BLOCK_LEVELS['2-1-3']);
ok(s1.join() === 'analysis,blocks', '第 1 關兩步：拆解 → 拼圖（沒有推導）');
ok(s3.join() === 'derive,blocks', '第 3 關兩步：推導 → 拼圖（沒有拆解）');
ok(!/out\.push\('analysis'\);\s*out\.push\('derive'\)/.test(html), '步驟不是寫死的');

/* 一次只出現一步 —— 攤開的話後面的題目會洩漏前面的答案 */
ok(/const kind = steps\[preStage\]/.test(html), '一次只畫目前這一步');
ok(/preUnit !== u\.id.*preStage = 0/s.test(html), '換關卡要從第一步重來');

/* 讀秒：拆解沒有「答對」，只能給時間。沒有讀秒等於一顆「下一步」按鈕 */
ok(/countdown\(foot, 20,/.test(html), '拆解那一步要讀秒（20 秒）');
ok(/countdown\(foot, 0,/.test(html), '推導做完之後不必再等');

/* 完成紀錄 */
ok(/modules: \{ scratch: \{ pre: \{ \[unitId\]: true \} \} \}/.test(html),
   '完成紀錄寫進 modules.scratch.pre');
ok(/\{ merge: true \}/.test(html), '用 merge 寫，不會蓋掉星數');
ok(/catch \(e\) \{[\s\S]{0,200}不影響上傳/.test(html),
   '★ 存檔失敗不能擋人 —— 那只是「省得下次重做」，不是成績');
ok(/pre-again/.test(html), '做完之後還能回去重看');

/* 這一頁載入了模擬器需要的東西 */
['../shared/blocks.js', '../shared/derive.js', 'content/blocks.js'].forEach(f => {
  ok(html.indexOf('src="' + f + '"') > -1, '有載入 ' + f);
});

/* 重複定義的函式（同一個 renderTotal 貼了兩次）要清掉 */
ok((html.match(/function renderTotal/g) || []).length === 1, 'renderTotal 只定義一次');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
