/* 資訊倫理「段落閱讀模式」：先讀課本段落、再考這一段；答錯公布正解和理由
   跑法：node shared/tests/readmode.test.js   （需要 jsdom）

   ★ 老師 2026-11-06：「資訊倫理的題目能調整為先閱讀課本段落，再出題？答錯後說明為什麼以加強理解」
     決定：一段課文 → 這一段連續答對幾題 → 下一段；答錯 ⇒ 公布正解＋理由 ⇒ 換同一段另一題；
     同日：「原來是連續答對 10 題，有沒有類似的難度設計？」⇒ 每節一樣連對 10 題，平均分到各段
       （5 段：2/2/2/2/2、4 段：3/3/2/2、3 段：4/3/3）；答錯只有這一段的連對歸零。
     作答時可以「📖 回頭看課文」；11/25 以前不上線（config.js 的 READ_MODE_FROM），?preview=read 可預覽。
   ★ 同日：「原來的作答時失焦原則與其他防弊規則要保留，只有調整作答形式」
   ⚠️ 這份測試守：
     ① 上線日期的開關（日期前、日期後、預覽網址）——日期前學生看到的必須和以前一模一樣
     ② 段落流程：讀 → 答 → 下一段 → 全部讀完才通關、回報 mode:'read'
     ③ 答錯：正解標出來、理由解得開、按「換一題」換同一段的另一題
     ④ 防弊照舊：離開時題目和課文一起拿掉、回來換同一段另一題、錯 20 題進警示單 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 不需要 jsdom 的部分 ── */
section('設定與載入順序');
{
  [['11501', 'cyberethics.html', 'ethics.read.js'], ['11502', 'social.html', 'social.read.js']].forEach(([term, page, bank]) => {
    const cfg = read(term + '/config.js');
    ok(/READ_MODE_FROM:\s*'2026-11-25'/.test(cfg), '★★★ ' + term + ' 上線日是 2026-11-25（老師：11/25 之後才全面更動）');
    const html = read(term + '/' + page);
    const at = s => html.indexOf(s);
    ok(at(bank) > 0 && at(bank) < at('quiz-engine.js'), '★★ ' + term + ' 在引擎之前載入 ' + bank);
    const src = read(term + '/content/' + bank);
    ok(!/"correct"\s*:/.test(src) && !/"ex"\s*:/.test(src) && !/"o"\s*:/.test(src),
       '★★★ ' + term + ' 段落題庫裡沒有明碼答案、沒有明碼說明（repo 是公開的）');
  });
  ok(/READ_MODE_FROM:\s*'2026-11-25'/.test(read('11502/config.js')), '★★ 11502 上線日也是 2026-11-25');
}

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.log('\n（流程測試需要 jsdom：先執行  npm install jsdom）'); console.log('\n通過 ' + pass + '／失敗 ' + fail); process.exit(fail ? 1 : 0); }

/* opts.from：把 READ_MODE_FROM 換成這個日期（CONFIG 會被凍住，只能在載入前換）
   opts.preview：網址加 ?preview=read */
function boot(opts) {
  opts = opts || {};
  const term = opts.term || '11501';
  const B = term === '11502' ? 'social' : 'ethics';
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(String(e && e.message || e)));
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/' + term + '/' + (term === '11502' ? 'social' : 'cyberethics') + '.html' + (opts.preview ? '?preview=read' : ''), virtualConsole: vc });
  const w = dom.window;
  global.window = w; global.document = w.document; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.localStorage = w.localStorage;
  ['grading.js', 'qstat.js', 'anskey.js'].forEach(f => new Function('window', read('shared/' + f))(w));
  new Function('window', read(term + '/content/' + B + '.js'))(w);
  new Function('window', read(term + '/content/' + B + '.read.js'))(w);
  let cfg = read(term + '/config.js');
  if (opts.from != null) cfg = cfg.replace(/READ_MODE_FROM:\s*'[^']*'/, "READ_MODE_FROM: '" + opts.from + "'");
  new Function('window', cfg)(w);
  if (opts.maxWrong) w.QUIZ_CONTENT.maxWrong = opts.maxWrong;
  const READ = JSON.parse(JSON.stringify(w.QUIZ_READ));
  const units = [];
  w.SSO = { me: () => ({ cls: '801', no: '01', name: '測試學生' }) };
  w.REPORT = {
    qstat: () => Promise.resolve(),
    unit: (m, id, o) => { units.push({ id, o }); return Promise.resolve(); },
    get: () => Promise.resolve({ units: {}, qstat: {}, stars: 0 }),
    history: () => Promise.resolve([])
  };
  w.eval(read('shared/quiz-engine.js'));
  const byQ = {};
  Object.keys(READ.sections).forEach(id => READ.sections[id].paras.forEach((p, pi) => p.qs.forEach(q => { byQ[q.q] = { q, pi, id }; })));
  return { w, errs, READ, byQ, units, $: id => w.document.getElementById(id) };
}
const click = (w, el) => el && el.dispatchEvent(new w.Event('click', { bubbles: true }));
const qText = r => { const h = r.$('question-container').querySelector('h3'); return h ? h.textContent : ''; };
/** 目前這一題，正確（right=true）或錯誤選項的位置 */
const optIdx = (r, right) => [...r.w.document.querySelectorAll('.qz-opt')]
  .findIndex(o => r.w.ANSKEY.check(qText(r), o.textContent, r.byQ[qText(r)].q.a) === right);
const send = r => click(r.w, r.$('next-btn'));
const answer = (r, right) => { click(r.w, r.w.document.querySelectorAll('.qz-opt')[optIdx(r, right)]); send(r); };
async function open(r, id) {
  await sleep(300);
  click(r.w, r.w.document.querySelector('.qz-open[data-ch="' + id + '"]')); await sleep(10);
}

(async () => {
  section('① 上線日期的開關');
  {
    const r = boot({ from: '2999-12-31' });
    await open(r, '1-1');
    ok(r.$('start-quiz-btn').textContent === '開始測驗挑戰', '★★★ 上線日以前：教材頁和以前一樣（「開始測驗挑戰」）');
    ok(!/第 1 段/.test(r.$('study-title').textContent), '★★ 上線日以前：不顯示段落');
    click(r.w, r.$('start-quiz-btn'));
    ok(/連對/.test(r.$('score-counter').textContent), '★★★ 上線日以前：照舊連對 10 題');
    ok(!r.byQ[qText(r)], '★★ 上線日以前：出的是舊題庫');
    ok(!r.w.document.querySelector('.qz-peek'), '上線日以前：沒有「回頭看課文」');
    ok(r.w.QUIZ_READ === undefined, '★ 段落題庫載入後就從 window 拿掉（和 QUIZ_CONTENT 一樣）');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
  }
  {
    const r = boot({ from: '2999-12-31', preview: true });
    await open(r, '1-1');
    ok(/第 1 段/.test(r.$('study-title').textContent), '★★★ 網址加 ?preview=read：上線日以前也能預覽');
  }
  {
    const r = boot({ from: '' });
    await open(r, '1-1');
    ok(r.$('start-quiz-btn').textContent === '開始測驗挑戰', '★ READ_MODE_FROM 留空 ＝ 關掉');
  }
  {
    const r = boot({ from: '2000-01-01' });
    await open(r, '1-1');
    ok(/第 1 段／共 4 段/.test(r.$('study-title').textContent), '★★★ 上線日以後：1-1 先讀第 1 段（共 4 段）');
    ok(r.$('study-content').textContent.includes(r.READ.sections['1-1'].paras[0].text[0].replace(/<[^>]+>/g, '').slice(0, 10)),
       '★★ 教材頁顯示第 1 段的課本原文');
    ok(/課本/.test(r.$('study-content').textContent), '標出課本出處');
    ok(/這段要連續答對 3 題/.test(r.$('start-quiz-btn').textContent), '按鈕講清楚：1-1 有 4 段，第 1 段要連續答對 3 題');
    /* 整章挑戰（ch1-all）沒有段落題庫 ⇒ 照舊連對 10 題（老師還沒決定整章挑戰的新形式） */
    const other = r.w.document.querySelector('.qz-open[data-ch="ch1-all"]');
    ok(!!other && !r.READ.sections['ch1-all'], '找得到整章挑戰的入口，而且它沒有段落題庫');
    if (other) {
      click(r.w, r.$('back-chapters-btn')); await sleep(10);
      click(r.w, other); await sleep(10);
      ok(r.$('start-quiz-btn').textContent === '開始測驗挑戰', '★★ 沒有段落題庫的整章挑戰照舊（「開始測驗挑戰」）');
    }
  }

  /** 每一段要連對幾題（和引擎同一套：10 題平均分到各段，餘數給前面的段落） */
  const needOf = (N, p) => Math.max(1, Math.floor(10 / N) + (p < 10 % N ? 1 : 0));
  section('分配規則：每節一樣連對 10 題');
  ok([3, 4, 5].every(N => [...Array(N).keys()].reduce((t, p) => t + needOf(N, p), 0) === 10), '★★★ 3、4、5 段的節，各段加起來都是 10 題');
  ok(needOf(3, 0) === 4 && needOf(3, 2) === 3 && needOf(4, 0) === 3 && needOf(4, 3) === 2 && needOf(5, 4) === 2,
     '3 段 4/3/3、4 段 3/3/2/2、5 段每段 2');
  ok(/function readNeed\(p\)[\s\S]{0,200}Math\.floor\(T \/ N\) \+ \(p < T % N \? 1 : 0\)/.test(read('shared/quiz-engine.js')) &&
     /Math\.floor\(TARGET \/ N\) \+ \(pi < TARGET % N \? 1 : 0\)/.test(read('shared/tools/build-read.js')),
     '★ 引擎和產生工具用同一套分配算法（題庫檢查「每段題目夠不夠換題」才對得上）');

  section('② 段落流程：讀 → 連對 → 下一段 → 通關');
  {
    const r = boot({ from: '2000-01-01' });
    await open(r, '1-1');
    click(r.w, r.$('start-quiz-btn'));
    ok(r.$('quiz-screen').className.indexOf('hidden') < 0, '按「讀完了」進入作答');
    ok(r.byQ[qText(r)] && r.byQ[qText(r)].pi === 0, '★★★ 出的是第 1 段的題目');
    ok(/連對: 0 \/ 10（第 1 \/ 4 段）/.test(r.$('score-counter').textContent), '計數：連對: 0 / 10（第 1 / 4 段）');
    ok(/目標連對: 10/.test(r.$('target-counter').textContent), '目標連對 10（和舊模式一樣）');
    const peek = r.w.document.querySelector('.qz-peek');
    ok(!!peek && r.$('question-container').contains(peek), '★★★ 有「📖 回頭看課文」，而且在題目區裡（離開時會一起拿掉）');
    ok(peek && peek.tagName === 'DETAILS' && !peek.open, '★ 課文預設收起來（要看再點開）');
    answer(r, true);
    ok(/連對: 1 \/ 10/.test(r.$('score-counter').textContent) && r.byQ[qText(r)].pi === 0, '答對 1 題 → 同一段下一題');
    answer(r, true);
    ok(r.$('quiz-screen').className.indexOf('hidden') < 0 && r.byQ[qText(r)].pi === 0, '★★ 第 1 段要 3 題：答對 2 題還留在第 1 段');
    answer(r, true);
    ok(r.$('study-screen').className.indexOf('hidden') < 0 && /第 2 段／共 4 段/.test(r.$('study-title').textContent),
       '★★★ 第 1 段連對 3 題 → 回到教材頁讀第 2 段');
    for (let p = 1; p < 4; p++) {
      ok(new RegExp('第 ' + (p + 1) + ' 段').test(r.$('study-title').textContent), '讀第 ' + (p + 1) + ' 段（要連對 ' + needOf(4, p) + ' 題）');
      click(r.w, r.$('start-quiz-btn'));
      if (p === 1) ok(r.byQ[qText(r)].pi === 1 && /連對: 3 \/ 10（第 2 \/ 4 段）/.test(r.$('score-counter').textContent), '★★ 第 2 段出第 2 段的題目，連對從 3 接著算');
      for (let k = 0; k < needOf(4, p); k++) answer(r, true);
    }
    await sleep(10);
    ok(r.$('result-screen').className.indexOf('hidden') < 0, '★★★ 4 段都答完 → 通關畫面');
    ok(/4 段/.test(r.$('pass-msg').textContent), '通關訊息講段落');
    const u = r.units[0];
    ok(u && u.id === '1-1', '★★ 回報 1-1 的成績');
    ok(u && u.o.extra && u.o.extra.mode === 'read' && u.o.extra.paras === 4, '★★ 紀錄標 mode:read、paras:4（老師分得出新舊）');
    ok(u && u.o.extra.correct === 10 && u.o.extra.total === 10 && u.o.extra.swap === 0, '★★ 答對 10／共 10（和舊模式一樣 10 題）、swap 0（不是 undefined）');
    ok(u && u.o.score === 100, '零失誤 100 分');
    ok(r.errs.length === 0, '★ 整個流程沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
  }

  section('②c 答錯：只有這一段的連對歸零');
  {
    const r = boot({ from: '2000-01-01' });
    await open(r, '1-1');
    click(r.w, r.$('start-quiz-btn'));
    for (let k = 0; k < 3; k++) answer(r, true);            // 第 1 段過關（3 題）
    click(r.w, r.$('start-quiz-btn'));                       // 第 2 段
    answer(r, true); answer(r, true);
    ok(/連對: 5 \/ 10（第 2 \/ 4 段）/.test(r.$('score-counter').textContent), '第 2 段已連對 2 題（共 5）');
    answer(r, false);
    ok(/連對: 3 \/ 10（第 2 \/ 4 段）/.test(r.$('score-counter').textContent), '★★★ 答錯 → 第 2 段歸零、第 1 段的 3 題保留（5 → 3）');
    send(r);
    ok(r.byQ[qText(r)] && r.byQ[qText(r)].pi === 1, '★★ 換題後還是第 2 段，不必回去重讀第 1 段');
    /* 第 2 段 5 題已用掉 3 題，剩 2 題不夠連對 3 題 ⇒ 答完剩下的就會回去重讀第 2 段（連對留著），再接著答 */
    let rereads = 0;
    for (let k = 0; k < 6; k++) {
      if (r.$('study-screen').className.indexOf('hidden') < 0) {
        if (/第 3 段/.test(r.$('study-title').textContent)) break;
        rereads++; click(r.w, r.$('start-quiz-btn'));
      }
      answer(r, true);
    }
    ok(rereads === 1, '★ 剩下的題目不夠連對 ⇒ 回去重讀第 2 段一次');
    ok(r.$('study-screen').className.indexOf('hidden') < 0 && /第 3 段/.test(r.$('study-title').textContent), '第 2 段重新連對 3 題 → 第 3 段');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
  }

  section('②b 每一節都走得完（各段連對 → 通關，共 10 題）');
  {
    for (const term of ['11501', '11502']) {
    const ids = Object.keys(boot({ from: '2000-01-01', term }).READ.sections);
    for (const id of ids) {
      const r = boot({ from: '2000-01-01', term });
      const N = r.READ.sections[id].paras.length;
      await open(r, id);
      let okFlow = new RegExp('第 1 段／共 ' + N + ' 段').test(r.$('study-title').textContent);
      for (let p = 0; p < N && okFlow; p++) {
        click(r.w, r.$('start-quiz-btn'));
        for (let k = 0; k < needOf(N, p); k++) {
          const it = r.byQ[qText(r)];
          if (!it || it.id !== id || it.pi !== p || optIdx(r, true) < 0) { okFlow = false; break; }
          answer(r, true);
        }
      }
      await sleep(5);
      const u = r.units[0];
      ok(okFlow && u && u.id === id && u.o.extra.paras === N && u.o.extra.correct === 10 && r.errs.length === 0,
         term + ' ' + id + '：' + N + ' 段走完、共連對 10 題、出的都是該段的題、每題都找得到正解' + (r.errs.length ? '　←　' + r.errs[0] : ''));
    }
    }
  }

  section('③ 答錯：公布正解＋理由 → 換同一段另一題');
  {
    const r = boot({ from: '2000-01-01' });
    await open(r, '1-1');
    click(r.w, r.$('start-quiz-btn'));
    const q1 = qText(r);
    const good = r.w.document.querySelectorAll('.qz-opt')[optIdx(r, true)].textContent;
    answer(r, false);
    const ex = r.$('qz-explain');
    ok(!!ex, '★★★ 答錯 → 解釋畫面');
    ok(ex && ex.textContent.includes(q1), '解釋畫面重述題目');
    const shown = ex ? [...ex.querySelectorAll('.border-emerald-500')].map(e => e.textContent) : [];
    ok(shown.length === 1 && shown[0].includes(good), '★★★ 公布正確答案（綠色那一個就是正解）');
    const why = (r.$('qz-ex-hint') || {}).textContent || '';
    ok(why.length > 8 && !/讀不到/.test(why), '★★★ 理由解得開（「' + why.slice(0, 20) + '…」）');
    ok(!ex.querySelector('.qz-opt'), '解釋畫面的選項不能再點');
    ok(/換一題/.test(r.$('next-btn').textContent), '按鈕是「換一題」');
    ok(/連對: 0 \/ 10/.test(r.$('score-counter').textContent) && /容錯: 19/.test(r.$('wrong-counter').textContent), '答錯：連對 0、容錯 -1');
    send(r);
    ok(!r.$('qz-explain') && qText(r) !== q1 && r.byQ[qText(r)].pi === 0, '★★★ 按「換一題」→ 同一段的另一題');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));

    /* 這一段的題目都出完了還沒過 → 回去重讀這一段（剩下的題目：先錯幾題，最後一題答對） */
    const per = r.READ.sections['1-1'].paras[0].qs.length;
    for (let i = 0; i < per; i++) {
      if (r.$('study-screen').className.indexOf('hidden') < 0) break;
      if (i === per - 2) { answer(r, true); continue; }   // 最後一題答對：讀課文不算中斷，連對要留著
      answer(r, false); send(r);
    }
    ok(r.$('study-screen').className.indexOf('hidden') < 0 && /第 1 段/.test(r.$('study-title').textContent),
       '★★ 這段的題目都考過了 → 回到這一段課文重讀');
    ok(/再讀一次/.test(r.$('study-content').textContent), '重讀時講清楚為什麼');
    click(r.w, r.$('start-quiz-btn'));
    ok(/連對: 1 \/ 10/.test(r.$('score-counter').textContent), '★ 重讀課文不算中斷：剛才連對的 1 題留著');
  }
  {
    /* 有 readhold 時，答錯說明一樣要讀 10 秒、2 秒後才能換題 */
    const r = boot({ from: '2000-01-01' });
    const started = [];
    await open(r, '1-1');
    r.w.READHOLD = undefined;              // 引擎讀的是 window.READHOLD（每次答錯才看）
    let h;
    r.w.READHOLD = { start(o) { h = { o, left: o.sec }; started.push(h); o.onTick({ left: o.sec, state: 'run' });
      return { stop() {}, away() { return false; }, left() { return h.left; } }; } };
    click(r.w, r.$('start-quiz-btn'));
    const q1 = qText(r);
    answer(r, false);
    ok(started.length === 1 && h.o.sec === 10, '★★ 答錯說明照舊讀 10 秒（readhold）');
    send(r);
    ok(!!r.$('qz-explain'), '★★ 讀不到 2 秒按「換一題」不理');
    h.left = 7; h.o.onTick({ left: 7, state: 'run' });
    send(r);
    ok(!r.$('qz-explain') && qText(r) !== q1, '讀滿 2 秒就能換題');
  }

  section('④ 防弊照舊');
  {
    const r = boot({ from: '2000-01-01' });
    await open(r, '1-1');
    click(r.w, r.$('start-quiz-btn'));
    const q1 = qText(r);
    const paraLine = r.READ.sections['1-1'].paras[0].text[0].replace(/<[^>]+>/g, '').slice(0, 12);
    r.w.dispatchEvent(new r.w.Event('blur'));
    ok(!r.w.document.body.textContent.includes(q1), '★★★ 離開時題目文字從網頁拿掉');
    ok(!r.$('question-container').textContent.includes(paraLine), '★★ 「回頭看課文」也一起拿掉');
    ok(!!r.$('qz-veil') && r.$('qz-veil').className.indexOf('hidden') < 0, '★★ 遮罩照常出現');
    r.w.dispatchEvent(new r.w.Event('focus'));
    ok(qText(r) !== q1 && r.byQ[qText(r)] && r.byQ[qText(r)].pi === 0, '★★★ 回來換同一段的另一題（11501 沒開換題，段落模式一律換）');
    ok(/連對: 0 \/ 10/.test(r.$('score-counter').textContent), '離開不扣分');
    const ev = new r.w.Event('copy', { bubbles: true, cancelable: true });
    ev.clipboardData = { setData() {} };
    r.$('question-container').dispatchEvent(ev);
    ok(ev.defaultPrevented, '★★ 複製照樣被攔下');
    ok(r.errs.length === 0, '沒有例外' + (r.errs.length ? '　←　' + r.errs[0] : ''));
  }
  {
    const r = boot({ from: '2000-01-01', maxWrong: 3 });
    await open(r, '1-1');
    click(r.w, r.$('start-quiz-btn'));
    answer(r, true);
    for (let i = 0; i < 3; i++) { answer(r, false); if (r.$('qz-explain')) send(r); }
    ok(r.$('warning-screen').className.indexOf('hidden') < 0, '★★★ 答錯到容錯上限 → 學習警示單（和以前同一條規則）');
    ok(r.units.length === 0, '★★ 警示單不記成績');
    click(r.w, r.$('warn-back-btn'));
    ok(r.$('study-screen').className.indexOf('hidden') < 0 && /第 1 段／共 4 段/.test(r.$('study-title').textContent),
       '★★ 警示單按返回 → 從第 1 段重讀');
    click(r.w, r.$('start-quiz-btn'));
    ok(/連對: 0 \/ 10/.test(r.$('score-counter').textContent) && /容錯: 3/.test(r.$('wrong-counter').textContent), '重新開始：連對、容錯都歸零');
  }

  section('⑤ 記憶補給站：上線後出段落題庫、答錯附理由');
  {
    const src = read('shared/quiz-engine.js');
    ok(/if \(readOn\(id\)\) out = out\.concat\(readQuestions\(id\)\)/.test(src), '★ 補給站：上線的小節改出段落題庫');
    ok(/current\.x && ans >= 0[\s\S]{0,80}ANSKEY\.open/.test(src), '★ 補給站答錯：段落題用加密的理由');
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
