/* 集合權限總表 ↔ 安全規則 ↔ 程式碼 三方對帳
   跑法：node shared/tests/collections.test.js

   ⛔ 為什麼有這一份（2026-09-28）：一次清出三個「沒人在用、規則卻還開著」的洞
      （11502 任務確認表、資訊倫理舊答題紀錄、運算思維舊集合），而且教師端的
      「重算全班星星」還在拿已淘汰的舊集合算星星 —— 會把新的星星蓋回舊的。
      共同病根：淘汰功能時只改了頁面，規則和讀取端留著，而那是**看不到**的。
   ★ 總表在 shared/docs/05_安全性.md 第 10 節（兩個 collections-table 標記之間）。
     這支把它當成正本，和 firestore.rules、全站程式碼逐項對。 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ── 規則：每個 match 的集合（正規化成總表的寫法）與它的 allow ── */
const norm = p => {
  p = p.replace(/^\//, '').split('/');
  if (p[0] === 'artifacts') return 'artifacts/…/' + p[4];
  return p[0].replace(/^1150[12]-/, '{學期}-');
};
const RULES = strip(read('shared/firestore.rules'));
const ruleOf = {};                         // 集合 → [allow 敘述…]
{
  /* 每一段 = 這個 match 開頭到下一個 match 開頭（規則檔裡 match 不巢狀，除了最外層那個） */
  const heads = [...RULES.matchAll(/match (\/\S+) \{/g)];
  heads.forEach((h, i) => {
    const p = h[1];
    if (p.startsWith('/databases/') || p.startsWith('/{document')) return;
    const seg = RULES.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : RULES.length);
    const k = norm(p);
    const allows = (seg.match(/allow [\s\S]*?;/g) || []).map(a => a.replace(/\s+/g, ' '));
    (ruleOf[k] = ruleOf[k] || []).push(...allows);
  });
}

/* ── 總表 ── */
const DOC = read('shared/docs/05_安全性.md');
const tbl = (DOC.match(/<!-- collections-table:start -->([\s\S]*?)<!-- collections-table:end -->/) || [, ''])[1];
const table = {};                          // 集合 → 狀態
tbl.split('\n').filter(l => /^\| `/.test(l)).forEach(l => {
  const cells = l.split('|').map(c => c.trim());
  const status = cells[2];
  let prefix = '';
  (cells[1].match(/`([^`]+)`/g) || []).map(s => s.slice(1, -1)).forEach((name, i) => {
    if (i === 0) {
      prefix = name.startsWith('{學期}-') ? '{學期}' : (name.startsWith('artifacts/…/') ? 'artifacts/…/' : '');
      table[name] = status; return;
    }
    if (name.startsWith('-') && prefix === '{學期}') name = '{學期}' + name;
    else if (prefix === 'artifacts/…/' && !name.startsWith('artifacts/')) name = 'artifacts/…/' + name;
    table[name] = status;
  });
});
const STATUSES = ['使用中', '後端專用', '舊資料唯讀', '已停用'];

/* ── 程式碼：git 追蹤的頁面／腳本／後端（不含測試與封存） ── */
const files = cp.execSync('git --no-optional-locks ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(f => /\.(html|js|ipynb|gs|py)$/.test(f) && !/^shared\/tests\/|^_archive\//.test(f));
const CODE = {};
files.forEach(f => { try { CODE[f] = f.endsWith('.ipynb')
  ? JSON.parse(read(f)).cells.map(c => [].concat(c.source).join('')).join('\n') : read(f); } catch (e) {} });
/** 這個集合在程式碼裡長什麼樣子 */
const tokenOf = k => {
  if (k === 'roster') return /['"]roster['"]/;
  if (k === 'config') return /['"]config['"]/;
  if (k.startsWith('{學期}-')) return new RegExp('-' + k.slice(5).replace(/-/g, '\\-') + '(?![\\w-])');
  const leaf = k.split('/').pop();
  return new RegExp("['\"/]" + leaf + "['\"]");
};
const usedIn = k => Object.keys(CODE).filter(f => tokenOf(k).test(strip(CODE[f]).replace(/^#.*$/gm, '')));

section('① 總表本身');
ok(Object.keys(table).length >= 10, '讀得到總表（' + Object.keys(table).length + ' 個集合）');
ok(Object.values(table).every(s => STATUSES.includes(s)),
   '★ 狀態只有四種：' + STATUSES.join('、'));

section('② 規則裡的每一個集合，總表都要有（新增規則就要記一筆）');
for (const k of Object.keys(ruleOf)) {
  ok(k in table, `★★ ${k} 在總表裡`);
  ok(table[k] !== '已停用', `★★★ ${k}：總表寫「已停用」，規則卻還在`);
}
for (const [k, s] of Object.entries(table)) {
  if (s === '已停用') ok(!(k in ruleOf), `★★★ ${k}：已停用 ⇒ 規則要刪掉（落到「其他一律拒絕」）`);
}

section('③ 「使用中」「後端專用」要真的有程式在用（抓「沒人用、規則卻開著」）');
for (const [k, s] of Object.entries(table)) {
  if (s !== '使用中' && s !== '後端專用') continue;
  const u = usedIn(k);
  ok(u.length > 0, `★★★ ${k}（${s}）有程式在用：${u.slice(0, 3).join('、') || '沒有！'}`);
  if (s === '後端專用') ok(u.includes('shared/backend.ipynb'), `★★ ${k}：後端專用 ⇒ 要在 backend.ipynb 裡`);
}

section('④ 寫入權限不可以只看「有沒有登入」');
/* 學生全都是 signed in。寫入條件只有 isSignedIn() ＝ 任何人改任何人的。 */
for (const [k, allows] of Object.entries(ruleOf)) {
  const bad = allows.filter(a => /allow [^:]*\b(create|update|delete|write)\b[^:]*:/.test(a)
    && (/: if (isSignedIn\(\)|true)\s*;/.test(a) || /\|\|\s*isSignedIn\(\)/.test(a)));
  ok(bad.length === 0, `★★★ ${k}：沒有「登入就能寫」的條件${bad.length ? '（' + bad.join(' ／ ') + '）' : ''}`);
}

section('⑤ 「舊資料唯讀」：沒人寫、也沒人拿來算星星');
for (const [k, s] of Object.entries(table)) {
  if (s !== '舊資料唯讀') continue;
  const writes = (ruleOf[k] || []).filter(a => /\b(create|update|write)\b[^:]*:/.test(a));
  ok(writes.every(a => /: if isTeacher\(\)\s*;/.test(a)),
     `★★★ ${k}：規則上學生不能新增或修改`);
  const tok = tokenOf(k), hits = [];
  for (const [f, src] of Object.entries(CODE)) {
    const s2 = strip(src);
    let m; const re = new RegExp(tok.source, 'g');
    while ((m = re.exec(s2))) {
      const after = s2.slice(m.index, m.index + 260);
      if (/\.(add|set|update)\(|\b(setDoc|addDoc|updateDoc)\(/.test(after.split(';')[0])) hits.push(f);
    }
  }
  ok(hits.length === 0, `★★ ${k}：沒有頁面再寫它${hits.length ? '（' + [...new Set(hits)].join('、') + '）' : ''}`);
}
for (const f of ['11501/teacher.html', '11502/teacher.html']) {
  const s2 = strip(read(f));
  const i = s2.indexOf('async function recomputeAllStars()');
  const body = s2.slice(i, s2.indexOf('window.recomputeAllStars', i));
  const stale = Object.entries(table).filter(([k, s]) => s === '舊資料唯讀' && k.startsWith('artifacts/'))
    .map(([k]) => k).filter(k => tokenOf(k).test(body));
  ok(i > 0 && stale.length === 0,
     `★★★ ${f} 的「重算全班星星」不讀舊資料（會把新星星蓋回舊的）${stale.length ? '：' + stale.join('、') : ''}`);
  ok(!/modules\.ethics\s*=/.test(body), `★★ ${f}：重算不碰資訊倫理（倫理星星由章節測驗頁維護）`);
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
