/* 資訊倫理 闖關排行賽（學生頁 11501/arena.html）—— 真的按一場
   跑法：node shared/tests/arena.test.js   （需要 jsdom）

   ★ 後端的計分在 shared/tests/arena.test.py；這一支驗的是頁面：
     · 頁面裡沒有答案、只送「選了第幾個」
     · 離開畫面 ⇒ 題目文字拿掉；回來 ⇒ 叫後端換題
     · 排行：前 30 名，30 名外把自己放在第 31 列、顯示真正的名次
     · 題庫 JSON 和 ethics.js 同步；入口只有 11501 資訊倫理有 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HTML = read('11501/arena.html');
const INLINE = (HTML.match(/<script>\s*\(function \(\) \{[\s\S]*?<\/script>/) || [''])[0]
  .replace(/^<script>/, '').replace(/<\/script>$/, '');

function Q(i, tier, text) {
  return { index: i, total: 20, tier, points: { 1: 15, 2: 25, 3: 35, 4: 45, 5: 55 }[tier], score: 0,
           q: text, options: ['甲', '乙', '丙', '丁'] };
}

async function boot(opts) {
  const body = HTML.replace(/<script[\s\S]*?<\/script>/g, '').match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  const dom = new JSDOM('<!DOCTYPE html><body>' + body + '</body>',
    { url: 'https://x/course_115/11501/arena.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.CONFIG = { TERM: '11501', SERVER_URL: 'https://api.example' };
  w.SSO = { sid: () => '1410101' };
  w.confirm = () => true;
  const calls = [];
  w.fetch = (url, o) => {
    const p = url.replace('https://api.example', '');
    const b = o && o.body ? JSON.parse(o.body) : null;
    calls.push({ p, b });
    const j = opts.route(p, b, calls);
    return Promise.resolve({ json: () => Promise.resolve(j) });
  };
  w.eval(INLINE);
  await sleep(20);
  return { w, calls, $: id => w.document.getElementById(id) };
}

(async function main() {
  section('① 頁面裡沒有答案');
  const code = INLINE.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/ANSKEY|anskey|QSTAT/.test(HTML) && !/\.a\s*[=!]==?|\['a'\]|\.right\b(?!\s*\?)/.test(code.replace(/j\.right/g, '')),
     '★★★ 頁面不載 anskey、不碰答案雜湊 —— 對錯只看後端回的 j.right');
  ok(/choice: state\.picked/.test(code), '★★ 送出的只有「選了第幾個」');
  ok(!/quiz-engine|content\/ethics/.test(HTML), '★★ 不載題庫（題目一題一題由後端給）');

  section('② 開始 → 作答 → 回饋 → 下一題');
  let n = 0;
  const t = await boot({ route: (p, b) => {
    if (p.startsWith('/api/arena/today')) return { ok: true, left: 2, best: null };
    if (p === '/api/arena/start') return { ok: true, run_id: 'R1', question: Q(1, 1, '第一題？'), left: 1 };
    if (p === '/api/arena/answer') { n++; return { ok: true, right: true, points: 15, tier_from: 1, tier_to: 2, score: 15, done: false, next: Q(2, 2, '第二題？') }; }
    if (p === '/api/arena/swap') return { ok: true, question: Q(2, 2, '換過的題目？') };
    return { ok: false };
  } });
  ok(t.$('left').textContent === '2' && !t.$('btn-start').disabled, '開始畫面：今天還有 2 次，可以按開始');
  t.$('btn-start').click();
  await sleep(20);
  ok(!t.$('s-quiz').classList.contains('hidden') && /第一題/.test(t.$('q-box').textContent), '出第一題');
  ok(/★ 暖身級・答對 \+15 分/.test(t.$('q-worth').textContent), '★ 顯示這一題值幾分');
  ok(t.w.document.querySelector('#ladder .rung.on').textContent.includes('15'), '難度階梯亮在 ★1');
  t.w.document.querySelectorAll('.opt')[2].click();
  t.$('btn-send').click();
  await sleep(20);
  const ans = t.calls.find(c => c.p === '/api/arena/answer');
  ok(ans && ans.b.choice === 2 && ans.b.run_id === 'R1' && ans.b.student_id === '1410101', '★★ 送出 {run_id, student_id, choice: 2}');
  ok(/答對！\+15 分/.test(t.$('fb').textContent) && /升到 ★★/.test(t.$('fb').textContent), '★ 回饋：答對、升到 ★2');
  await sleep(1200);
  ok(/第二題/.test(t.$('q-box').textContent) && t.$('q-no').textContent === '2', '自動進下一題');

  section('③ 離開畫面：題目拿掉，回來換題');
  t.w.dispatchEvent(new t.w.Event('blur'));
  ok(!t.w.document.body.textContent.includes('第二題'), '★★★ 離開時題目文字從整個網頁拿掉（Gemini 讀網頁也讀不到）');
  ok(!!t.$('veil'), '蓋上遮罩');
  t.w.dispatchEvent(new t.w.Event('focus'));
  await sleep(20);
  ok(t.calls.some(c => c.p === '/api/arena/swap' && c.b.run_id === 'R1'), '★★★ 回來叫後端換題');
  ok(/換過的題目/.test(t.$('q-box').textContent) && !t.$('veil'), '換成新題目、遮罩收起');
  t.w.dispatchEvent(new t.w.Event('blur'));
  t.w.dispatchEvent(new t.w.Event('blur'));
  t.w.dispatchEvent(new t.w.Event('focus'));
  t.w.dispatchEvent(new t.w.Event('focus'));
  await sleep(20);
  ok(t.calls.filter(c => c.p === '/api/arena/swap').length === 2, '★ 一次離開只換一題（blur／focus 重複觸發不會多換）');

  section('④ 結果與排行：前 30 名＋自己在第 31 列');
  const top = Array.from({ length: 30 }, (_, i) => ({ sid: '14000' + String(i).padStart(2, '0'), score: 1000 - i * 10, seconds: 100, rank: i + 1 }));
  const t2 = await boot({ route: (p) => {
    if (p.startsWith('/api/arena/today')) return { ok: true, left: 1, best: { score: 500, seconds: 120 } };
    if (p === '/api/arena/start') return { ok: true, run_id: 'R2', question: Q(20, 5, '最後一題？'), left: 0 };
    if (p === '/api/arena/answer') return { ok: true, right: false, points: 0, tier_from: 5, tier_to: 4, score: 600, done: true,
      result: { score: 600, correct: 15, total: 20, max_tier: 5, seconds: 180, swaps: 1, robot: false }, best_updated: true, best: { score: 600, seconds: 180 } };
    if (p.startsWith('/api/arena/board')) return { ok: true, top, me: { sid: '1410101', score: 600, seconds: 180, rank: 41 }, players: 41 };
    return { ok: false };
  } });
  ok(/500 分/.test(t2.$('best').textContent), '開始畫面顯示最佳成績');
  t2.$('btn-start').click(); await sleep(20);
  t2.w.document.querySelectorAll('.opt')[0].click(); t2.$('btn-send').click();
  await sleep(1300);
  ok(!t2.$('s-result').classList.contains('hidden') && /600/.test(t2.$('res-card').textContent), '結果畫面：600 分');
  ok(/刷新你的最佳成績/.test(t2.$('res-card').textContent), '★ 刷新最佳成績有講');
  const rows = [...t2.$('board').querySelectorAll('tr')].filter(r => r.children.length === 4);
  ok(rows.length === 31, '★★★ 前 30 名＋自己 ＝ 31 列（實得 ' + rows.length + '）');
  ok(/1410101/.test(rows[30].textContent) && /41/.test(rows[30].children[0].textContent) && rows[30].className.includes('bg-amber'),
     '★★★ 第 31 列是自己、顯示真正的名次（第 41 名）、亮起來');
  ok(rows[0].textContent.includes('🥇'), '前三名有獎牌');

  section('⑤ 用完兩次就不能按開始');
  const t3 = await boot({ route: (p) => p.startsWith('/api/arena/today') ? { ok: true, left: 0, best: null } : { ok: false } });
  ok(t3.$('btn-start').disabled && /用完/.test(t3.$('start-msg').textContent), '★★ 今天用完 ⇒ 按鈕反灰、講清楚');

  section('⑥ 題庫同步與入口');
  const exp = require(path.join(ROOT, 'shared', 'tools', 'export-arena-bank.js'));
  ok(read('11501/content/ethics.arena.json') === exp.build(),
     '★★★ ethics.arena.json 和 ethics.js 同步（改了題目要跑 node shared/tools/export-arena-bank.js --write）');
  ok(/arenaPage: "arena\.html"/.test(read('11501/content/ethics.js')), '★★ 11501 資訊倫理有入口');
  ok(!/arenaPage/.test(read('11502/content/social.js')), '11502 沒有（老師只要資訊倫理）');
  ok(/C\.arenaPage\s*\?/.test(read('shared/quiz-engine.js')), '引擎只在有設 arenaPage 時畫入口');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
