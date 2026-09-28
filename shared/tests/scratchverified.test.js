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

section('④ 規則：學生不可以改 scratchVerified（第 ④步）');
const R = fs.readFileSync(path.join(ROOT, 'shared', 'firestore.rules'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok(/function verifiedEmpty\(\)\s*\{\s*return !\('scratchVerified' in request\.resource\.data\);/.test(R),
   '★★★ 建立文件時不可以夾帶 scratchVerified');
ok(/function verifiedUnchanged\(\)[\s\S]{0,200}request\.resource\.data\.get\('scratchVerified', null\)\s*==\s*resource\.data\.get\('scratchVerified', null\)/.test(R),
   '★★★ 更新文件時 scratchVerified 前後必須一模一樣');
for (const term of ['11501', '11502']) {
  const blk = (R.match(new RegExp('match /' + term + '-progress/\\{sid\\} \\{[\\s\\S]*?\\n    \\}')) || [''])[0];
  ok(/allow create:[\s\S]*?isOwner\(sid\)[^;]*verifiedEmpty\(\)/.test(blk), `★★★ ${term} 學生建立進度時要檢查 verifiedEmpty`);
  ok(/allow update:[\s\S]*?isOwner\(sid\)[^;]*verifiedUnchanged\(\)/.test(blk), `★★★ ${term} 學生更新進度時要檢查 verifiedUnchanged`);
}

section('⑤ 可疑紀錄頁：重建按鈕先試算、頁面本身不寫 Firestore');
const A = fs.readFileSync(path.join(ROOT, 'shared', 'audit.html'), 'utf8');
const ac = A.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
ok(/\/api\/teacher\/rebuild-scratch-verified/.test(ac), '★★ 有重建按鈕，打後端的重建端點');
ok(/auditRebuild\(true\)/.test(ac) && /試算（不寫入）/.test(ac), '★★★ 第一顆按鈕是試算');
ok(/j\.dry_run \? writeButtons\(/.test(ac) && /function writeButtons\(cls\)[\s\S]{0,200}auditRebuild\(false, false\)[\s\S]{0,400}auditRebuild\(false, true\)/.test(ac),
   '★★★ 「寫入」兩顆按鈕只在試算之後才出現 —— 沒看過差異就不能寫');
ok(/confirm\(/.test(ac), '★★ 寫入前要再確認一次');
ok(!/\b(setDoc|updateDoc|deleteDoc|addDoc|writeBatch)\b/.test(ac), '★★★ 頁面本身還是不寫 Firestore（寫的是後端）');

section('⑥ 被限流時自己等、出錯時按鈕還在（2026-09-28 老師實際卡住的）');
ok(/r\.status !== 429/.test(ac) && /setTimeout\(ok, \(sec \+ 1\) \* 1000\)/.test(ac),
   '★★★ 429 要照後端說的秒數自己等再試 ——「試算→寫入」是正常流程，不可以丟給老師重按');
ok(/tries < 4/.test(ac), '★★ 自動重試要有上限');
const errBranch = (ac.match(/else if \(rb\.err\) body = [\s\S]*?<\/div>`;/) || [''])[0];
ok(/auditRebuild\(true\)/.test(errBranch) && /j && j\.dry_run \? writeButtons\(''\)/.test(errBranch),
   '★★★ 出錯之後畫面上還要有「重新試算」「再寫入一次」—— 第一版出錯後一顆按鈕都沒有，只能重新整理');
ok(/rb\.limited \? ''/.test(errBranch),
   '★★ 被限流時不要說「後端要開著、要新版」—— 那會讓人以為後端壞了');

section('⑦ 第 ③步：可疑紀錄頁「寫入並套用到學生頁面」');
ok(/mirror = !dry && !!mirror;/.test(ac),
   '★★★ 試算**一定不帶** mirror（試算不寫，帶了也沒意義；更不能讓一顆按鈕同時是試算又是套用）');
ok(/mirror: mirror \? 1 : 0/.test(ac), '★★ 送給後端的 mirror 只有 0／1');
ok(/confirm\(mirror \? mirrorWarn\(last\)/.test(ac), '★★★ 套用前的確認視窗要講清楚會補幾關、降幾關');
{
  const fn = (ac.match(/function mirrorWarn\(j\) \{[\s\S]*?\n\}/) || [''])[0];
  const mw = fn ? new Function(fn + '; return mirrorWarn;')() : null;
  const msg = mw ? mw({ diffs: [{ front: 0, back: 3 }, { front: 3, back: 0 }, { front: 2, back: 0 }] }) : '';
  ok(/補上 1 關/.test(msg) && /降下 2 關/.test(msg), '★★★ 關數算對：後端多＝補上、前端多＝降下');
  ok(/手動補給學生的星星/.test(msg), '★★ 有要降的關卡時，提醒「老師手動補的星星也會被降」');
  ok(mw && !/手動補給/.test(mw({ diffs: [{ front: 0, back: 3 }] })), '只有補、沒有降 ⇒ 不必嚇人');
}
ok(/學生頁面上的星星也一起套用了/.test(ac), '★ 寫完的訊息要分得出有沒有套用');

section('⑧ grading.js：開關與「算星數成長」的歷程');
window.CONFIG = {};
ok(GRADING.trustBackendScratch() === false, '★★★ 沒設開關 ⇒ 關（預設行為一點都不能變）');
window.CONFIG = { SCRATCH_TRUST_BACKEND: 'true' };
ok(GRADING.trustBackendScratch() === false, '★★ 只有布林 true 才算開（字串 "true" 不算）');
window.CONFIG = { SCRATCH_TRUST_BACKEND: true };
ok(GRADING.trustBackendScratch() === true, '開關打開');

const H = [{ module: 'ethics', unit: 'ch1', stars: 2, at: 10 },
           { module: 'scratch', unit: '2-1-1A', stars: 3, at: 20 },
           { module: 'scratch', unit: '2-1-9', stars: 3, at: 25 }];      // ← 主控台 arrayUnion 的那種
const SV = { gains: [{ unit: '2-1-1A', score: 95, star: 3, stars: 3, at: 20 },
                     { unit: '2-1-1B', score: 80, star: 2, stars: 2, at: 30 }] };
window.CONFIG = {};
ok(GRADING.statHistory({ history: H, scratchVerified: SV }) === H,
   '★★★ 開關沒開 ⇒ 原封不動回傳 history（同一個陣列）');
ok(Array.isArray(GRADING.statHistory({})) && GRADING.statHistory({}).length === 0 && GRADING.statHistory(null).length === 0,
   '沒有 history ⇒ 空陣列，不可以丟例外');
window.CONFIG = { SCRATCH_TRUST_BACKEND: true };
{
  const out = GRADING.statHistory({ history: H, scratchVerified: Object.assign({ rebuiltAt: 1 }, SV) });
  const sc = out.filter(h => h.module === 'scratch');
  ok(sc.length === 2 && sc.every(h => h.by === 'backend'),
     '★★★ 重建過 ⇒ Scratch 只算後端記的（學生頁面寫的那兩筆，包括偽造的 2-1-9，一筆都不算）');
  ok(out.filter(h => h.module === 'ethics').length === 1, '★★ 其他模組照舊用 history');
  ok(sc.reduce((a, h) => a + h.stars, 0) === 5 && sc[1].unit === '2-1-1B' && sc[1].at === 30 && sc[1].score === 80,
     '★★ 後端那幾筆換成 history 的形狀（stars＝新增顆數、at、unit、score）');
}
{
  const out = GRADING.statHistory({ history: H, scratchVerified: SV });
  const sc = out.filter(h => h.module === 'scratch');
  ok(sc.length === 3 && sc.filter(h => h.by === 'backend').length === 1 && sc.find(h => h.by === 'backend').at === 30,
     '★★★ **沒重建過** ⇒ 學生頁面寫的留著，後端只補比它更晚的（不然開學那幾週的每週分數會憑空變少）');
}
ok(GRADING.statHistory({ history: H }).filter(h => h.module === 'scratch').length === 2,
   '開關打開、後端還沒有任何紀錄 ⇒ 照舊用 history');
window.CONFIG = {};

section('⑨ grader.html：開關打開時用後端的回報，不再自己寫');
ok(/fd\.append\('trust', \(window\.GRADING && GRADING\.trustBackendScratch\(\)\) \? '1' : '0'\)/.test(code),
   '★★ 開關打開才送 trust=1');
ok(/GRADING\.trustBackendScratch\(\) && _v && _v\.mirrored\)\s*\?\s*_v\s*:\s*await window\.reportScratch\(/.test(code),
   '★★★ 後端**真的鏡像了**才用它的回報；否則照舊 reportScratch（後端沒寫成功時不可以一顆都沒記）');

section('⑩ report.js：只寫自己的模組');
{
  const store = { modules: { scratch: { stars: 6, unitStars: { '2-1-1A': 3 } }, ethics: { stars: 1 } }, history: [] };
  const w = { CONFIG: { TERM: '11501', COLLECTIONS: { PROGRESS: '11501-progress' } },
              SSO: { sid: () => '1410101', me: () => ({}), embedded: () => false } };
  global.SSO = w.SSO;
  new Function('window', fs.readFileSync(path.join(ROOT, 'shared', 'report.js'), 'utf8'))(w);
  const writes = [];
  w.REPORT.configure({ db: {}, doc: () => ({}),
    getDoc: () => Promise.resolve({ exists: () => true, data: () => JSON.parse(JSON.stringify(store)) }),
    setDoc: (r, p, o) => { writes.push([p, o]); return Promise.resolve(); },
    arrayUnion: x => ({ __union: x }) });
  (async () => {
    await w.REPORT.unit('ethics', 'ch2', { star: 3, score: 90 });
    const p = writes[0] && writes[0][0];
    ok(p && Object.keys(p.modules).join() === 'ethics',
       '★★★ 資訊倫理寫進度時**只帶 ethics** —— 帶整份 modules 會把後端剛寫的 Scratch 星星蓋回舊的');
    ok(writes[0] && writes[0][1] && writes[0][1].merge === true, '★★★ 一定是 merge');
    ok(p && p.totalStars >= 6, '★ totalStars 還是用整份算（含 Scratch 的 6 顆）');
    console.log('\n通過 ' + pass + '／失敗 ' + fail);
    process.exit(fail ? 1 : 0);
  })().catch(e => { console.log('  ❌ report.js 跑不起來：' + e); process.exit(1); });
}

section('⑪ 算星數成長的地方都經過 statHistory');
for (const f of ['11501/teacher.html', '11502/teacher.html', '11501/hub.html', '11502/hub.html']) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const need = f.includes('teacher') ? 3 : 1;
  ok((s.match(/GRADING\.statHistory\(/g) || []).length >= need, `★★ ${f}：${need} 處都用 statHistory`);
  ok(!/const hist\s*=\s*\(?\s*\w+\s*&&\s*\w+\.history\)?\s*\|\|\s*\[\]\s*;/.test(s) && !/histMap\[d\.id\] = pd\.history \|\| \[\];/.test(s)
     && !/const hist = data\.history \|\| \[\];/.test(s),
     `★★★ ${f}：沒有漏網、還直接讀 history 算星數的`);
  if (f.includes('teacher')) {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(/GRADING\.statHistory\(pd\) : \(pd\.history \|\| \[\]\); attMap\[d\.id\] = pd\.attendance/.test(raw),
       `★★★ ${f}：histMap 那一行是**一行寫完**的 forEach —— 在中間加 // 註解會把後面的 attMap 和 }); 一起吃掉`
       + '（2026-09-28 我自己踩到：整頁 JS 語法錯誤，check.py 才抓到）');
  }
}
