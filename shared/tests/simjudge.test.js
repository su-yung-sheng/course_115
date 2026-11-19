/* 模擬器判定：網頁版（shared/blocks.js 的 BLOCKS.judge）和後端 Python 版（11502/backend.ipynb 的 sim_judge）要一模一樣
   跑法：node shared/tests/simjudge.test.js
   ★ 2026-11-18 老師：下學期模擬器拼對＝通關，「不接受 F12 假造」⇒ 由後端重新判定後寫入。
     兩邊只要有一筆判得不一樣，就會出現「網頁說對了、後端說不對」（學生拼對卻拿不到星）
     或反過來（假造的程式被後端放行）。⇒ 同一批程式兩邊各判一次，逐筆對照。 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const w = {};
new Function('window', read('shared/blocks.js'))(w);
const B = w.BLOCKS;
const J = JSON.parse(read('11502/content/blocks.judge.json'));
const DEFS = J.defs, LEVELS = J.levels;

section('① 判定資料和題目同步');
const { build } = require(path.join(ROOT, 'shared', 'tools', 'export-sim-judge.js'));
ok(read('11502/content/blocks.judge.json') === build(), '★★ blocks.judge.json 和題目一致（改了題目要跑 node shared/tools/export-sim-judge.js --write）');
ok(Object.keys(LEVELS).length === 8, '8 關有拼圖（第 5、10 關只做體驗）');

// ── 產生測資：參考解答、其他解法、改名（一致／不一致）、改數字、刪積木、對調、空的、隨機變形 ──
let seed = 20261118;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const clone = o => JSON.parse(JSON.stringify(o));
function walkNodes(list, f, parent) { (list || []).forEach((n, i) => { f(n, list, i); ['children', 'children2'].forEach(k => walkNodes(n[k], f)); (n.args || []).forEach(a => { if (a && typeof a === 'object') walkNodes([a], f); }); }); }
function nameArgs(n) { const d = DEFS[n.id] || {}; return (d.idArgs || []).filter(i => n.args && typeof n.args[i] === 'string'); }
function renameAll(list) { const m = {}; walkNodes(list, n => nameArgs(n).forEach(i => { const v = n.args[i]; if (!m[v]) m[v] = 'X' + Object.keys(m).length + '名'; n.args[i] = m[v]; })); return list; }
function renameFirst(list) { let done = false; walkNodes(list, n => { if (done) return; const ia = nameArgs(n); if (ia.length) { n.args[ia[0]] += '改'; done = true; } }); return done ? list : null; }
function bumpNumber(list) { let done = false; walkNodes(list, n => { if (done) return; const ia = nameArgs(n); (n.args || []).forEach((a, i) => { if (!done && typeof a === 'string' && ia.indexOf(i) < 0 && /^-?\d+(\.\d+)?$/.test(a.trim())) { n.args[i] = String(Number(a) + 1); done = true; } }); }); return done ? list : null; }
function mutateRandom(list) {
  const all = []; walkNodes(list, (n, arr, i) => all.push([n, arr, i]));
  if (!all.length) return list;
  const [n, arr, i] = all[Math.floor(rnd() * all.length)], op = Math.floor(rnd() * 6);
  if (op === 0 && arr) arr.splice(i, 1);
  else if (op === 1 && arr) arr.splice(i, 0, clone(n));
  else if (op === 2 && arr && arr.length > 1) { const j = (i + 1) % arr.length; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  else if (op === 3 && n.args && n.args.length) { const k = Math.floor(rnd() * n.args.length); if (typeof n.args[k] !== 'object') n.args[k] = ['0', '1', '90', ' 90 ', '', 'x', n.args[k] + ' '][Math.floor(rnd() * 7)]; }
  else if (op === 4) n.args = (n.args || []).concat(['1']);
  else if (op === 5) n.id = Object.keys(DEFS)[Math.floor(rnd() * Object.keys(DEFS).length)];
  return list;
}
const cases = [];
const add = (u, programs, label) => cases.push({ u, programs, label });
Object.keys(LEVELS).forEach(u => {
  const lv = LEVELS[u], S = lv.sprites;
  const base = S.map(s => s.goal);
  add(u, clone(base), '參考解答');
  S.forEach((s, k) => s.alts.forEach((a, ai) => { const p = clone(base); p[k] = clone(a.goal); add(u, p, '其他解法 ' + (ai + 1)); }));
  S.forEach((s, k) => {
    let p = clone(base); p[k] = renameAll(clone(s.goal)); add(u, p, '角色' + k + ' 名字全部換掉（一致）');
    const rf = renameFirst(clone(s.goal)); if (rf) { p = clone(base); p[k] = rf; add(u, p, '角色' + k + ' 只改第一個名字（不一致）'); }
    const bn = bumpNumber(clone(s.goal)); if (bn) { p = clone(base); p[k] = bn; add(u, p, '角色' + k + ' 改一個數字'); }
    if (s.goal.length) { p = clone(base); p[k] = clone(s.goal).slice(0, -1); add(u, p, '角色' + k + ' 少最後一塊'); }
    if (s.goal.length > 1) { p = clone(base); const g = clone(s.goal); [g[0], g[1]] = [g[1], g[0]]; p[k] = g; add(u, p, '角色' + k + ' 前兩塊對調'); }
    p = clone(base); p[k] = clone(s.goal).map(n => Object.assign(n, { args: (n.args || []).map(a => typeof a === 'string' ? ' ' + a + ' ' : a) })); add(u, p, '角色' + k + ' 參數前後多空白');
  });
  add(u, S.map(() => []), '全部空的');
  if (S.length > 1) add(u, [clone(S[1].goal), clone(S[0].goal)], '兩個角色放反');
  add(u, clone(base).slice(0, Math.max(0, S.length - 1)), '角色數量不對');
  for (let r = 0; r < 60; r++) { const p = clone(base); const k = Math.floor(rnd() * S.length); p[k] = mutateRandom(p[k]); add(u, p, '隨機變形 #' + r); }
});
const jsVerdict = cases.map(c => { try { return B.judge(LEVELS[c.u], c.programs) ? 1 : 0; } catch (e) { return 'ERR'; } });

section('② 網頁版自己先對（確定測資有意義）');
const byLabel = l => cases.map((c, i) => [c, jsVerdict[i]]).filter(([c]) => c.label === l);
ok(byLabel('參考解答').every(([, v]) => v === 1), '★★ 每一關的參考解答都判對（' + byLabel('參考解答').length + ' 關）');
ok(cases.every((c, i) => !/^其他解法/.test(c.label) || jsVerdict[i] === 1), '★ 其他解法都判對');
ok(cases.every((c, i) => !/名字全部換掉/.test(c.label) || jsVerdict[i] === 1), '★★ 名字一致地換掉 ⇒ 還是對（只看對應關係）');
ok(byLabel('全部空的').every(([, v]) => v === 0), '★ 全部空的 ⇒ 不對');
ok(jsVerdict.filter(v => v === 0).length > 50 && jsVerdict.filter(v => v === 1).length > 20, '測資有對有錯（對 ' + jsVerdict.filter(v => v === 1).length + '、錯 ' + jsVerdict.filter(v => v === 0).length + '）');

section('③ 後端 Python 版逐筆對照');
const nb = JSON.parse(read('11502/backend.ipynb'));
const coreCell = nb.cells.find(c => c.cell_type === 'code' && c.source.join('').startsWith('%%writefile core11502.py'));
ok(!!coreCell, '找得到 11502/backend.ipynb 的核心模組（core11502.py）');
const coreSrc = coreCell.source.join('').split('\n').slice(1).join('\n');
ok(/def sim_judge\(level, programs, defs\)/.test(coreSrc), '核心模組有 sim_judge');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simjudge-'));
fs.writeFileSync(path.join(tmp, 'core11502.py'), coreSrc);
fs.writeFileSync(path.join(tmp, 'cases.json'), JSON.stringify({ defs: DEFS, levels: LEVELS, cases }));
fs.writeFileSync(path.join(tmp, 'run.py'),
  // 核心模組開頭是上學期搬來的批改引擎（from google import genai）—— 本機沒有，塞一個假的
  'import json, sys, types\nsys.path.insert(0, sys.argv[1])\n' +
  'g = types.ModuleType("google"); g.genai = types.ModuleType("google.genai"); g.genai.types = types.ModuleType("google.genai.types")\n' +
  'sys.modules.setdefault("google", g); sys.modules.setdefault("google.genai", g.genai); sys.modules.setdefault("google.genai.types", g.genai.types)\n' +
  'import core11502 as c\n' +
  'd = json.load(open(sys.argv[2], encoding="utf-8"))\nout = []\n' +
  'for k in d["cases"]:\n    try:\n        out.append(1 if c.sim_judge(d["levels"][k["u"]], k["programs"], d["defs"]) else 0)\n' +
  '    except Exception as e:\n        out.append("ERR " + repr(e))\nprint(json.dumps(out))\n');
let py = null, out = null;
for (const cmd of ['python3', 'python', 'py']) {
  const r = cp.spawnSync(cmd, [path.join(tmp, 'run.py'), tmp, path.join(tmp, 'cases.json')], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout) { py = cmd; out = JSON.parse(r.stdout.trim().split('\n').pop()); break; }
  if (r.status !== null && r.stderr && /Error/.test(r.stderr) && !/not found|not recognized|No such file/.test(r.stderr)) { console.log(r.stderr.slice(0, 600)); }
}
if (!py) { ok(false, '★ 找不到 Python（python3／python／py），沒辦法對照'); }
else {
  const diff = cases.map((c, i) => [c, jsVerdict[i], out[i]]).filter(([, a, b]) => a !== b);
  ok(out.length === cases.length, '後端判完全部 ' + cases.length + ' 筆（用 ' + py + '）');
  ok(!out.some(v => typeof v === 'string'), '★ 後端判定沒有丟例外');
  ok(diff.length === 0, '★★★ 網頁版和後端版逐筆一致（' + cases.length + ' 筆）' +
     (diff.length ? '　←　不一致：' + diff.slice(0, 3).map(([c, a, b]) => c.u + ' ' + c.label + ' 網頁=' + a + ' 後端=' + b).join('；') : ''));
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}

section('④ 前端把「每個角色一份程式」交出來');
const bsrc = read('shared/blocks.js');
ok(/opts\.onPass\(plain\(whole\(\)\), SP\.map\(function \(sp\) \{ return plain\(wholeOf\(sp\)\); \}\),/.test(bsrc), '★ onPass 第二個參數是每個角色的程式（後端要逐角色判定）');
ok(/judge: judge/.test(bsrc), 'BLOCKS.judge 有匯出');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
