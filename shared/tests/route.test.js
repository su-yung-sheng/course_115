/* 下學期闖關路線：依進度解鎖（老師 2026-11-18 定案）
   跑法：node shared/tests/route.test.js
   ★ 這份測試就是老師核對過的那張「逐格開放狀態」表，一格一格釘住。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const w = {};
new Function('window', read('11502/config.js'))(w);
new Function('window', read('shared/grading.js'))(w);
new Function('window', read('shared/route.js'))(w);
const R = w.ROUTE, CFG = w.CONFIG, RT = CFG.ROUTE;
const ev = d => R.evaluate(RT, d, CFG.UNITS);
const U = ['4-2-1','4-2-2','4-2-3','4-3-1','6-1-1','6-2-1','6-2-2','6-3-1','6-3-2','6-3-3'];
const stars = (ids, n) => Object.fromEntries(ids.map(i => [i, n]));
const P = { s1: ['4-2-1','4-2-2','4-2-3','4-3-1'], s2: ['6-2-1','6-2-2'], s3: ['6-3-1','6-3-2'] };
const openU = r => U.filter(u => r.units[u]);
const has = (r, ...ids) => ids.every(x => r.sections[x]);
const none = (r, ...ids) => ids.every(x => !r.sections[x]);

section('① 設定本身');
ok(RT.stages.length === 3 && RT.stages.map(s => s.name).join() === '程式小畫家,排序大師,搜尋偵探', '三個 Stage 和名稱');
ok([].concat(...RT.stages.map(s => s.units)).join() === CFG.UNITS.map(u => u[0]).join(), '★★ 三個 Stage 的關卡剛好是 UNITS 的 10 關、順序一樣');
const social = read('11502/content/social.js');
const allSec = [].concat(...RT.stages.map(s => (s.sections || []).concat(s.extraSections || [])), RT.final.challenges);
ok(allSec.every(id => social.includes('id: "' + id + '"')), '★★ 閱讀小節／整章挑戰代號都在 content/social.js 裡');
ok(R.forDoc({}, null, { UNITS: [] }) === null && R.evaluate(null, {}) === null, '★ 沒有 ROUTE 的學期（11501）⇒ null，不套路線');

section('② Stage 1（開學）');
let r = ev({});
ok(r.stage === 1 && openU(r).join() === P.s1.join(), '★★★ 只開程式 1～4 關');
ok(r.thinkingMax === 0 && Object.keys(r.sections).length === 0, '★★ 運算思維、閱讀測驗都還沒開');
ok(r.next && /Stage 2/.test(r.next.title) && r.next.missing.length === 4 && /程式第 1 關 達到 2⭐/.test(r.next.missing[0]),
   '★★ 還差什麼：「程式第 1 關 達到 2⭐」…四關');
r = ev({ unitStars: stars(['4-2-1','4-2-2','4-2-3'], 3), play: {} });
ok(r.stage === 1 && r.next.missing.length === 1 && /程式第 4 關/.test(r.next.missing[0]), '　做了三關 ⇒ 只差第 4 關');
r = ev({ unitStars: Object.assign(stars(['4-2-1','4-2-2','4-2-3'], 3), { '4-3-1': 1 }) });
ok(r.stage === 1, '★ 1⭐（未滿 75 分）不算完成');

section('③ Stage 2：先做（運算思維＋6-2）');
const s1done = { unitStars: stars(P.s1, 2) };
r = ev(s1done);
ok(r.stage === 2 && r.done[1] === true, '★★★ 程式 1～4 都 ≥2⭐ ⇒ 進 Stage 2，Stage 1 徽章');
ok(r.thinkingMax === 5 && has(r, '6-2') && none(r, '6-1', '6-3', '5-1', '5-all', '6-all'), '★★★ 開運算思維（上限 5 題）＋閱讀 6-2，其他閱讀還沒開');
ok(openU(r).join() === P.s1.join(), '★★ 程式 5～7 還沒開');
ok(/Stage 2 的程式關卡/.test(r.next.title) && r.next.missing.some(m => /運算思維再完成 5 題/.test(m)) && r.next.missing.some(m => /6-2/.test(m)),
   '★★ 還差什麼：運算思維 5 題、6-2 至少 1⭐');
r = ev(Object.assign({ thinking: 5 }, s1done));
ok(openU(r).length === 4 && r.next.missing.length === 1 && /6-2/.test(r.next.missing[0]), '　運算思維 5 題但 6-2 還沒過 ⇒ 程式還不開');
r = ev(Object.assign({ secStars: { '6-2': 1 }, thinking: 4 }, s1done));
ok(openU(r).length === 4, '　6-2 過了但運算思維只有 4 題 ⇒ 程式還不開');

section('④ Stage 2：再做（程式 5～7）');
const s2pre = Object.assign({ thinking: 5, secStars: { '6-2': 1 } }, s1done);
r = ev(s2pre);
ok(openU(r).join() === P.s1.concat(['6-1-1','6-2-1','6-2-2']).join(), '★★★ 運算思維 5 張＋6-2 ≥1⭐ ⇒ 開程式 5～7 關');
ok(r.thinkingMax === 5, '★★★ 運算思維還是暫停在 5 題');
ok(/Stage 3/.test(r.next.title) && r.next.missing.some(m => /程式第 5 關 完成實作體驗/.test(m)), '★ 第 5 關不交作品：還差「完成實作體驗」');

section('⑤ Stage 3：先做（運算思維剩下 5 題＋6-1、6-3）');
const s2done = Object.assign({}, s2pre, { unitStars: Object.assign(stars(P.s1, 2), stars(P.s2, 3)), play: { '6-1-1': 1 } });
r = ev(s2done);
ok(r.stage === 3 && r.done[2] === true, '★★★ 程式 5～7 完成 ⇒ Stage 3，Stage 2 徽章');
ok(r.thinkingMax === 10 && has(r, '6-1', '6-2', '6-3') && none(r, '5-1', '5-all'), '★★★ 運算思維開到 10 題＋閱讀 6-1、6-3；第五章還沒開');
ok(!r.units['6-3-1'], '★★ 程式 8～10 還沒開');

section('⑥ Stage 3：再做（程式 8～10＋第五章）');
const s3pre = Object.assign({}, s2done, { thinking: 10, secStars: { '6-1': 1, '6-2': 3, '6-3': 2 } });
r = ev(s3pre);
ok(openU(r).length === 10 && has(r, '5-1', '5-2', '5-3', '5-4', '5-5') && none(r, '5-all', '6-all'),
   '★★★ 運算思維 10 張＋6-1、6-3 ≥1⭐ ⇒ 開程式 8～10 關＋第五章；整章挑戰還沒開');
ok(ev(Object.assign({}, s3pre, { thinking: 9 })).units['6-3-1'] !== true, '　運算思維 9 張 ⇒ 程式 8～10 不開');

section('⑦ Final（兩個整章挑戰）');
const s3done = Object.assign({}, s3pre, { unitStars: Object.assign({}, s3pre.unitStars, stars(P.s3, 2)), play: { '6-1-1': 1, '6-3-3': 1 } });
r = ev(s3done);
ok(r.done[3] === true && !r.final.open && /總複習/.test(r.next.title) && r.next.missing.length === 5,
   '★★ 程式 10 關完成但第五章還沒做 ⇒ 整章挑戰不開，還差 5-1～5-5');
r = ev(Object.assign({}, s3done, { secStars: Object.assign({}, s3done.secStars, stars(['5-1','5-2','5-3','5-4','5-5'], 1)) }));
ok(r.final.open && has(r, '5-all', '6-all') && r.stage === 4 && r.next === null, '★★★ 全部小節 ≥1⭐ ⇒ 兩個整章挑戰一起開，沒有下一道門');
ok(!r.final.done && ev(Object.assign({}, s3done, { secStars: Object.assign({}, s3done.secStars, stars(['5-1','5-2','5-3','5-4','5-5','5-all','6-all'], 1)) })).final.done,
   '★ 整章挑戰都 ≥1⭐ ⇒ 總複習徽章');

section('⑧ 已開放的不會關回去、前面的關卡可以回去重做');
r = ev(s3pre);
ok(P.s1.every(u => r.units[u]) && r.sections['6-2'], '★★ Stage 3 時 Stage 1 的關卡、6-2 都還開著（一二星可以重做）');

section('⑨ 老師放行（只開門、不給星星）');
r = ev({ stagePass: 2, unitStars: { '4-2-1': 3, '4-2-2': 3, '4-2-3': 3, '4-3-1': 1 } });
ok(r.stage === 2 && r.thinkingMax === 5 && has(r, '6-2'), '★★★ 放行到 Stage 2 ⇒ 第 4 關卡在 74 分也能開始做 Stage 2 的「先做」');
ok(!r.units['6-2-1'] && r.assumeCleared['4-3-1'], '★★ 但 Stage 2 的程式還是要先做完運算思維＋6-2（只開門）；Stage 1 的關卡當作已通過（給關卡順序鎖用）');
ok(r.unitStars === undefined, '　放行不改任何星數（evaluate 不寫資料）');
r = ev({ stagePass: 3 });
ok(r.stage === 3 && r.thinkingMax === 10 && has(r, '6-1', '6-3') && !r.units['6-3-1'], '★★ 放行到 Stage 3 ⇒ 開 Stage 3 的「先做」');

section('⑩ 備課模式');
r = ev({ openAll: true });
ok(openU(r).length === 10 && r.thinkingMax === Infinity && has(r, '5-1', '6-3', '5-all', '6-all') && r.next === null,
   '★★ 備課模式（OPEN_ALL_UNITS）⇒ 全部開放');

section('⑪ 從進度文件整理資料');
const doc = { modules: { scratch: { unitStars: { '4-2-1': 3 }, play: { '6-1-1': true } },
                         thinking: { units: { '1': { star: 2 }, '3': { star: 2 } } },
                         ethics: { units: { '6-2': { star: 2, score: 90 } } } },
              history: [{ module: 'thinking', unit: '3' }, { module: 'thinking', unit: '5' }] };
const d = R.fromProgress(doc, { stage_pass: 2 }, { OPEN_ALL_UNITS: false });
ok(d.thinking === 3 && d.secStars['6-2'] === 2 && d.unitStars['4-2-1'] === 3 && d.play['6-1-1'] && d.stagePass === 2 && d.openAll === false,
   '★★ 運算思維題數（units＋history 去重）、閱讀星數、程式星數、放行旗標都讀得到');
ok(R.fromProgress(null, null, {}).thinking === 0, '沒有資料 ⇒ 不丟例外');

section('⑫ 各頁都接上同一份判斷');
const pg = f => read(f);
['11502/hub.html','11502/scratch.html','11502/level.html','11502/social.html','11502/thinking.html','11502/teacher.html'].forEach(f =>
  ok(/<script src="\.\.\/shared\/route\.js"><\/script>/.test(pg(f)), '★ ' + f + ' 載入 shared/route.js'));
const hub = pg('11502/hub.html');
ok(/ROUTE\.forDoc\(data, isDemo \? null : state\.roster, window\.CONFIG\)/.test(hub) && /state\.roster = r;/.test(hub), '★★ 闖關基地：用進度＋名冊（放行旗標）算路線');
ok(/m\.id === 'ethics' && !Object\.keys\(RT\.sections\)\.length/.test(hub) && /m\.id === 'thinking' && !\(RT\.thinkingMax > 0\)/.test(hub),
   '★★ 闖關基地：閱讀測驗、運算思維在 Stage 2 之前是鎖住的灰卡');
ok(/function stageBoard\(rt\)/.test(hub) && /下一道門/.test(hub) && /🎖️/.test(hub), '★★ 闖關基地：Stage 看板（名稱、徽章、還差什麼）');
ok(/isOpenNow = m => \(.*\) && !routeLocked\(m\)/.test(hub), '★ 「建議下一關」不會指到被路線鎖住的模組');
for (const f of ['11502/scratch.html', '11502/level.html']) {
  const t = pg(f);
  ok(/RT && RT\.assumeCleared/.test(t) && /routeCap\(\)/.test(t) && /window\.applyRoute = function/.test(t),
     '★★★ ' + f + '：程式關卡兩道門（前一關＋路線），老師放行時前面的關卡當作已通過');
  ok(/COLLECTIONS\.ROSTER, sid/.test(t) && /window\.applyRoute\(snap\.exists\(\)/.test(t), '　' + f + '：讀名冊的放行旗標');
  ok(/if \(!RT\) return \(window\.CONFIG\.ROUTE && !OPEN_ALL\) \? window\.CONFIG\.ROUTE\.stages\[0\]\.units\.length : Infinity;/.test(t),
     '★ ' + f + '：路線還沒讀到之前只放行 Stage 1（不讓第 5 關閃一下開著）');
}
const qe = pg('shared/quiz-engine.js');
ok(/function routeOpen\(id\)/.test(qe) && /if \(!routeOpen\(id\)\)/.test(qe) && /loadRoute\(\)\.then\(function \(\) \{ paintRoute\(\);/.test(qe),
   '★★★ 閱讀測驗：還沒開放的小節／整章挑戰點不進去、按鈕上鎖、講清楚還差什麼');
ok(/doc: docAll/.test(pg('shared/report.js')) && /roster: roster/.test(pg('shared/report.js')), '　進度模組多了 doc()／roster()（給路線用）');
const th = pg('11502/thinking.html');
ok(/const capped = !allDone && doneCount >= routeMax;/.test(th) && /if \(capped\) return;/.test(th) && /disabled=\{allDone \|\| capped\}/.test(th),
   '★★★ 運算思維：到本階段上限就不開遊戲、證書製作反灰');
const te = pg('11502/teacher.html');
ok(/student\.__stagePass = Number\(r\.stage_pass\)/.test(te) && /window\.setStagePass = async function/.test(te) && /\{ merge: true \}/.test(te.slice(te.indexOf('window.setStagePass'))),
   '★★ 教師端：放行旗標存在名冊（merge，不洗掉別的欄位）');
ok(/routeDist\(filteredData\)/.test(te) && /routePanelHtml\(student\) \+ unitMatrixHtml\(student\)/.test(te), '★★ 教師端：全班 Stage 分布、學生明細有路線面板');
ok(!/ROUTE/.test(pg('11501/config.js')), '★ 11501 沒有 ROUTE（上學期不受影響）');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
