/* 後端星星（scratchVerified）與前端星等規則一致、grader.html 不寫死學期
   跑法：node shared/tests/scratchverified.test.js

   ★ 星等門檻只有一份在 shared/grading.js（scratchStar）。後端是 Python、
     讀不到那支 JS，只好在 backend.ipynb 抄一份 SCRATCH_STAR_RULE。
     抄兩份遲早走鐘，而走鐘的那一份不會有人發現 ——
     ⇒ 這裡把 0～100 每一分都拿兩邊比一次。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = {};
require(path.join(ROOT, 'shared', 'grading.js'));
const GRADING = global.window.GRADING || global.GRADING;
const NB = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'));
const CORE = NB.cells[6].source.join('');

section('① 後端的星等門檻和 shared/grading.js 一致');
const m = CORE.match(/SCRATCH_STAR_RULE\s*=\s*\(\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*\)/);
ok(!!m, '找得到 SCRATCH_STAR_RULE = ((分, 星), (分, 星))');
const rule = m ? [[+m[1], +m[2]], [+m[3], +m[4]]] : [];
const py = s => { for (const [lo, st] of rule) if (s >= lo) return st; return 0; };
let bad = [];
for (let s = 0; s <= 100; s += 0.5) if (py(s) !== GRADING.scratchStar(s)) bad.push(s);
ok(bad.length === 0, '★★★ 0～100 每半分都一樣（走鐘的分數：' + bad.slice(0, 5).join(',') + '）');

section('② grader.html：集合名從 config.js 來，不寫死學期');
const G = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const code = G.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
ok(!/['"]11501-progress['"]/.test(code) && !/['"]11502-progress['"]/.test(code),
   '★★★ 不可以寫死 11501-progress —— 11502 的 level.html 也嵌這一支，下學期會一顆星都記不進去');
ok((code.match(/window\.CONFIG\.COLLECTIONS\.PROGRESS/g) || []).length >= 2,
   '★★ 寫星星、寫作品連結兩處都要用 CONFIG.COLLECTIONS.PROGRESS');

section('③ 第 ①步：前端完全不變（兩邊並行）');
ok(/window\.reportScratch = async function/.test(G) && /unitStars\[unit\] = Math\.max\(prev, star\)/.test(G),
   '★★ 前端照舊寫 modules.scratch —— 第 ①步不可以動到正在運作的那一條路');
ok(/rep\.star >= 2 && rep\.scoreImproved/.test(G), '★★ 作品備份的條件照舊');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
