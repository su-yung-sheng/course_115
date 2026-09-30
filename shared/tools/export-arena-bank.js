/* 把資訊倫理題庫匯出成「闖關排行賽」後端用的 JSON
   跑法：node shared/tools/export-arena-bank.js            （檢查是否同步，不改檔）
         node shared/tools/export-arena-bank.js --write    （寫出 11501/content/ethics.arena.json）

   ★ 為什麼要另外一份 JSON（老師 2026-09-30：排行賽「後端算」）
     分數由後端判，後端就得自己有題庫 —— 不能讓學生的瀏覽器告訴它
     「這一題是什麼、答案雜湊是什麼」，那等於讓考生自己出題。
     而 ethics.js 是 JavaScript（鍵沒有引號、夾著大量 HTML 教材），
     Python 讀不了；這支把**只有題目的部分**抽出來存成純 JSON。
   ★ 內容和 ethics.js 完全一樣是公開的（題目、選項、答案雜湊 a），
     沒有多洩漏任何東西。後端從 GitHub Pages 抓這一份。
   ⚠️ 同一題會出現在小節與整章挑戰 —— 用 QSTAT.id 合併成一題（和教師端統計同一把鑰匙，
      難易度才對得上）。
   ⚠️ 改了 ethics.js 的題目就要重跑 --write；shared/tests/arena.test.js 會擋「沒同步」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, '11501', 'content', 'ethics.js');
const OUT = path.join(ROOT, '11501', 'content', 'ethics.arena.json');

function build() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'shared', 'qstat.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(SRC, 'utf8'))(w);
  const QSTAT = w.QSTAT, C = w.QUIZ_CONTENT;
  const byId = new Map();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.q === 'string' && Array.isArray(o.options)) {
      const id = QSTAT.id(o.q);
      if (id && !byId.has(id) && o.a) byId.set(id, { id, q: o.q, options: o.options.slice(), a: o.a });
      return;
    }
    Object.keys(o).forEach(k => walk(o[k]));
  })(C.chapters);
  const items = [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return JSON.stringify({ module: 'ethics', term: '11501', count: items.length, items }, null, 1) + '\n';
}

if (require.main === module) {
  const out = build();
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (process.argv.indexOf('--write') >= 0) {
    fs.writeFileSync(OUT, out, 'utf8');
    console.log('已寫出 ' + path.relative(ROOT, OUT) + '（' + JSON.parse(out).count + ' 題）');
  } else {
    console.log(cur === out ? '✅ 已同步' : '⚠️ 沒同步：請跑 node shared/tools/export-arena-bank.js --write');
    process.exit(cur === out ? 0 : 1);
  }
}
module.exports = { build, OUT };
