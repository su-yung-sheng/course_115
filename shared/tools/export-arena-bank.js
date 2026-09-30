/* 把章節測驗的題庫匯出成「闖關排行賽」後端用的 JSON（兩學期）
   跑法：node shared/tools/export-arena-bank.js            （檢查是否同步，不改檔）
         node shared/tools/export-arena-bank.js --write    （寫出兩份）
           11501：content/ethics.js → content/ethics.arena.json（資訊倫理）
           11502：content/social.js → content/social.arena.json（媒體與社會議題，2026-09-30 加）

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
const TERMS = {
  '11501': { src: '11501/content/ethics.js', out: '11501/content/ethics.arena.json' },
  '11502': { src: '11502/content/social.js', out: '11502/content/social.arena.json' }
};
const OUT = path.join(ROOT, TERMS['11501'].out);     // 舊的呼叫方式（只看 11501）

function build(term) {
  term = term || '11501';
  const SRC = path.join(ROOT, TERMS[term].src);
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
  /* ★ 參賽資格（老師 2026-09-30）：資訊倫理「已通關 10 / 10 個章節」才能挑戰。
     這 10 個就是章節選單上「已通關 n / 全部」的那個「全部」——
     和 quiz-engine.js 的 ORDER 同一個算法：每一章的小節，接著那一章的整章挑戰。
     後端拿這份清單去對學生進度裡的 modules.ethics.units。 */
  const units = [];
  (C.chapters || []).forEach(ch => {
    (ch.sections || []).forEach(s => units.push(s.id));
    if (ch.challenge) units.push(ch.challenge.id);
  });
  return JSON.stringify({ module: C.moduleId || 'ethics', term, count: items.length, units, items }, null, 1) + '\n';
}

if (require.main === module) {
  let bad = 0;
  Object.keys(TERMS).forEach(term => {
    const p = path.join(ROOT, TERMS[term].out);
    const out = build(term);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (process.argv.indexOf('--write') >= 0) {
      fs.writeFileSync(p, out, 'utf8');
      console.log('已寫出 ' + TERMS[term].out + '（' + JSON.parse(out).count + ' 題）');
    } else {
      if (cur !== out) bad++;
      console.log(TERMS[term].out + '：' + (cur === out ? '✅ 已同步' : '⚠️ 沒同步'));
    }
  });
  if (bad) { console.log('請跑 node shared/tools/export-arena-bank.js --write'); process.exit(1); }
}
module.exports = { build, OUT, TERMS };
