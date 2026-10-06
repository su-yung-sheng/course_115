/* 資訊倫理 闖關排行賽（學生頁 11501/arena.html）—— 真的按一場
   跑法：node shared/tests/arena.test.js   （需要 jsdom）

   ★ 後端的計分在 shared/tests/arena.test.py；這一支驗的是頁面：
     · 頁面裡沒有答案、只送「選了第幾個」
     · 每題限時 20 秒，倒數到 0 送「時間到」；離開畫面 ⇒ 題目文字拿掉、這一題算答錯（2026-10-06）
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

/* 2026-09-30 起畫面與流程在 shared/arena.js（兩學期共用），各學期的 arena.html 只放 ARENA_CONTENT */
const ENGINE = read('shared/arena.js');
const INLINE = ENGINE;
const HTML = read('11501/arena.html') + ENGINE;
const CONTENT = {
  '11501': { name: '資訊倫理', subtitle: '資訊倫理與相關法律', chapterPage: 'cyberethics.html' },
  '11502': { name: '媒體與社會議題', subtitle: '媒體與社會議題・基本演算法', chapterPage: 'social.html' }
};

function Q(i, tier, text, limit) {
  return { index: i, total: 20, tier, points: { 1: 15, 2: 25, 3: 35, 4: 45, 5: 55 }[tier], score: 0,
           q: text, options: ['甲', '乙', '丙', '丁'], limit: limit || 20 };
}

async function boot(opts) {
  const term = opts.term || '11501';
  const dom = new JSDOM('<!DOCTYPE html><head></head><body></body>',
    { url: 'https://x/course_115/' + term + '/arena.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.CONFIG = { TERM: term, SERVER_URL: 'https://api.example' };
  w.ARENA_CONTENT = CONTENT[term];
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
  ok(['11501', '11502'].every(tm => !/<script[^>]+src="[^"]*(quiz-engine|content\/)/.test(read(tm + '/arena.html')))
     && !/content\/|arena\.json/.test(ENGINE.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★★ 不載題庫（題目一題一題由後端給）');

  section('② 開始 → 作答 → 回饋 → 下一題');
  let n = 0;
  const t = await boot({ route: (p, b) => {
    if (p.startsWith('/api/arena/today')) return { ok: true, left: 2, best: null };
    if (p === '/api/arena/start') return { ok: true, run_id: 'R1', question: Q(1, 1, '第一題？'), left: 1 };
    if (p === '/api/arena/answer') { n++; return { ok: true, right: true, points: 15, tier_from: 1, tier_to: 2, score: 15, done: false, next: Q(2, 2, '第二題？') }; }
    if (p === '/api/arena/leave') return { ok: true, right: false, points: 0, tier_from: 2, tier_to: 1, score: 15,
                                           why: 'leave', done: false, next: Q(3, 1, '第三題？') };
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

  ok(/20 秒/.test(t.$('q-time').textContent) && t.$('q-timebar').style.width.startsWith('100'),
     '★★ 每題有 20 秒倒數（數字＋進度條）');
  ok(/每題限時 <b[^>]*>20 秒<\/b>，<b>時間到算答錯/.test(ENGINE) && /這一題算答錯、降一級/.test(ENGINE)
     && !/換一題<\/b>（不扣分）/.test(ENGINE),
     '★★ 規則寫明：限時 20 秒、離開畫面算答錯降一級（舊的「換一題不扣分」拿掉）');

  section('③ 離開畫面：題目拿掉、這一題算答錯（老師 2026-10-06）');
  t.w.dispatchEvent(new t.w.Event('blur'));
  ok(!t.w.document.body.textContent.includes('第二題'), '★★★ 離開時題目文字從整個網頁拿掉（Gemini 讀網頁也讀不到）');
  ok(!!t.$('veil') && /算答錯、降一級/.test(t.$('veil').textContent), '★★ 遮罩寫明「這一題算答錯、降一級」');
  await sleep(10);
  ok(t.calls.some(c => c.p === '/api/arena/leave' && c.b.run_id === 'R1'),
     '★★★ 一離開就告訴後端（不是等回來才說 —— 回來前不能先把答案送出去）');
  ok(!t.calls.some(c => c.p === '/api/arena/swap'), '★★ 不再叫「換題」');
  t.w.dispatchEvent(new t.w.Event('focus'));
  await sleep(20);
  ok(/離開畫面，這一題算答錯/.test(t.$('fb').textContent) && /降到 ★/.test(t.$('fb').textContent),
     '★★ 回來先看到「離開畫面，這一題算答錯」＋降級');
  await sleep(1200);
  ok(/第三題/.test(t.$('q-box').textContent) && t.$('q-no').textContent === '3' && !t.$('veil'),
     '★★★ 接著是下一題（第 3 題）—— 離開那一題算掉了，不是換題');
  t.w.dispatchEvent(new t.w.Event('blur'));
  t.w.dispatchEvent(new t.w.Event('blur'));
  await sleep(10);
  ok(t.calls.filter(c => c.p === '/api/arena/leave').length === 2, '★ 一次離開只算一題（blur／visibilitychange 重複觸發不會多扣）');
  t.w.dispatchEvent(new t.w.Event('focus'));
  await sleep(1300);

  section('③-2 倒數到 0 ⇒ 送「時間到」');
  {
    const tt = await boot({ route: (p) => {
      if (p.startsWith('/api/arena/today')) return { ok: true, left: 2, best: null };
      if (p === '/api/arena/start') return { ok: true, run_id: 'R9', question: Q(1, 1, '快一點？', 0.4), left: 1 };
      if (p === '/api/arena/answer') return { ok: true, right: false, points: 0, tier_from: 1, tier_to: 1, score: 0,
                                              why: 'timeout', done: false, next: Q(2, 1, '下一題？') };
      return { ok: false };
    } });
    tt.$('btn-start').click(); await sleep(20);
    tt.w.document.querySelectorAll('.opt')[1].click();              // 選了但沒送
    await sleep(800);
    const a = tt.calls.find(c => c.p === '/api/arena/answer');
    ok(a && a.b.timeout === true && a.b.choice === undefined,
       '★★★ 倒數到 0 自動送「時間到」—— 只送 timeout，不送選了的那個（選了沒送不算）');
    ok(/時間到！算答錯/.test(tt.$('fb').textContent), '★★ 畫面寫「時間到！算答錯」');
    ok(tt.calls.filter(c => c.p === '/api/arena/answer').length === 1, '★ 只送一次');
    await sleep(1200);
  }
  {
    const tt = await boot({ route: (p) => {
      if (p.startsWith('/api/arena/today')) return { ok: true, left: 2, best: null };
      if (p === '/api/arena/start') return { ok: true, run_id: 'R8', question: Q(1, 1, '題目？', 0.5), left: 1 };
      if (p === '/api/arena/answer') return { ok: true, right: true, points: 15, tier_from: 1, tier_to: 2, score: 15,
                                              done: false, next: Q(2, 2, '下一題？') };
      return { ok: false };
    } });
    tt.$('btn-start').click(); await sleep(20);
    tt.w.document.querySelectorAll('.opt')[0].click(); tt.$('btn-send').click();
    await sleep(700);
    ok(tt.calls.filter(c => c.p === '/api/arena/answer').length === 1 && !tt.calls.some(c => c.b && c.b.timeout),
       '★★ 時間內送出 ⇒ 倒數停掉，不會又多送一次「時間到」');
    await sleep(800);
  }

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

  section('⑤-2 參賽資格：沒有 10 / 10 不能按開始');
  const t4 = await boot({ route: (p) => p.startsWith('/api/arena/today')
    ? { ok: true, left: 2, best: null, eligible: false, passed: 7, need: 10 } : { ok: false } });
  ok(t4.$('btn-start').disabled, '★★★ 沒資格 ⇒ 開始按鈕反灰（今天明明還有 2 次）');
  ok(/10 個章節全部通關/.test(t4.$('start-msg').textContent) && /7 \/ 10/.test(t4.$('start-msg').textContent),
     '★★ 講清楚要什麼、目前幾 / 10');
  ok(!!t4.$('start-msg').querySelector('a[href="cyberethics.html"]'), '給一條去闖關的路');

  section('⑤-3 兩學期共用一份引擎（11502 媒體與社會議題）');
  for (const term of ['11501', '11502']) {
    const page = read(term + '/arena.html');
    ok(/<script src="\.\.\/shared\/arena\.js"><\/script>/.test(page) && /window\.ARENA_CONTENT = \{/.test(page)
       && !/api\/arena/.test(page), `★★ ${term}/arena.html 只放「這是哪個單元」，畫面與流程在 shared/arena.js`);
    ok(/config\.js/.test(page) && /guard\.js/.test(page) && /sso\.js/.test(page), `${term}：載 config／guard／sso（沒登入導回基地）`);
  }
  ok(!/資訊倫理|媒體與社會議題|cyberethics|social\.html/.test(ENGINE.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★★ 引擎裡沒有寫死任何一學期的單元名稱或章節頁');
  const t5 = await boot({ term: '11502', route: (p) => p.startsWith('/api/arena/today')
    ? { ok: true, left: 2, best: null, eligible: false, passed: 3, need: 10 } : { ok: false } });
  ok(/媒體與社會議題・基本演算法/.test(t5.w.document.body.textContent) && t5.w.document.title === '媒體與社會議題 闖關排行賽',
     '★★ 11502 顯示自己的單元名稱');
  ok(!!t5.$('start-msg').querySelector('a[href="social.html"]') && /媒體與社會議題/.test(t5.$('start-msg').textContent),
     '★ 11502 沒資格時「去闖關」連到 social.html');
  ok(t5.calls.some(c => /term=11502/.test(c.p)), '★★★ 11502 問的是 11502 的紀錄（排行、次數各學期分開）');

  section('⑥ 題庫同步與入口');
  const exp = require(path.join(ROOT, 'shared', 'tools', 'export-arena-bank.js'));
  for (const term of Object.keys(exp.TERMS)) {
    ok(read(exp.TERMS[term].out) === exp.build(term),
       `★★★ ${exp.TERMS[term].out} 和題庫同步（改了題目要跑 node shared/tools/export-arena-bank.js --write）`);
  }
  ok(!/arenaPage/.test(read('11501/content/ethics.js')) && !/排行賽/.test(read('shared/quiz-engine.js')),
     '★★ 章節選單不放入口（老師 2026-09-30：入口只在闖關基地）');
  ok(/href="hub\.html"[^>]*>|返回基地/.test(ENGINE) && !/href="cyberethics\.html" title=/.test(ENGINE),
     '★ 左上角是「返回基地」（從基地進來的）');
  {
    /* 章節清單要和章節選單的 ORDER 同一個算法 */
    const w = {}; new Function('window', read('11501/content/ethics.js'))(w);
    const order = [];
    w.QUIZ_CONTENT.chapters.forEach(ch => { (ch.sections || []).forEach(s => order.push(s.id)); if (ch.challenge) order.push(ch.challenge.id); });
    const J = JSON.parse(read('11501/content/ethics.arena.json'));
    ok(JSON.stringify(J.units) === JSON.stringify(order) && order.length === 10,
       '★★★ 題庫帶的章節清單＝章節選單的「全部」（' + order.length + ' 個）');
    for (const [term, bank, src] of [['11501', '11501/content/ethics.arena.json', '11501/content/ethics.js'],
                                     ['11502', '11502/content/social.arena.json', '11502/content/social.js']]) {
      const JJ = JSON.parse(read(bank));
      const ww = {}; new Function('window', read(src))(ww);
      const ord = [];
      ww.QUIZ_CONTENT.chapters.forEach(ch => { (ch.sections || []).forEach(s => ord.push(s.id)); if (ch.challenge) ord.push(ch.challenge.id); });
      ok(JSON.stringify(JJ.units) === JSON.stringify(ord) && ord.length === 10, `★★★ ${term} 題庫帶的章節清單＝章節選單的「全部」`);
      const m = read(term + '/hub.html').match(/needUnits:\[([^\]]*)\]/);
      const hubUnits = m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')) : [];
      ok(JSON.stringify(hubUnits) === JSON.stringify(JJ.units),
         `★★★ ${term} 闖關基地小卡判斷用的章節清單和後端那一份一樣（改章節要兩邊一起改）`);
    }
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
