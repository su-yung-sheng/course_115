/* 第四節課的三個檢核：RGB 混色
   跑法：node shared/tests/mixlab.test.js   （需要 jsdom）

   ★ 老師 2026-08-25：「都暖身結束了，第四課的：動手檢核：沒有開始」

   ⚠️ 這一支盯三件事：
      ① A 和暖身**方向相反**（暖身給顏色調數字，檢核給數字猜顏色）
      ② B 釘的是「上限寫成 255」—— 這門課有三個範圍容易混
         （1023 讀到的／255 亮度／359 色環一圈）
      ③ 三個檢核真的走得完，而且每一關都會換題 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body><div id="x"></div></body>',
  { url: 'https://x/course_115/11501/5016b.html' });
const W = dom.window;
global.document = W.document; global.window = W;
['shared/ultralab.js', 'shared/labkit.js', 'shared/mixlab.js']
  .forEach(f => new Function('window', read(f))(W));
const M = W.MIXLAB, U = W.ULTRALAB;

section('★★ 三個範圍不可以搞混');
{
  ok(M.ADC_MAX === 1023, '★ 1023 —— A7 讀到的原始值（第三節那把尺）');
  ok(M.LEVEL === 255, '★ 255 —— 每一盞燈的亮度');
  ok(M.HUE_MAX === 359, '★★ 359 —— 色環一圈');
  ok(M.PIN === 'A7', '   腳位 A7');
}

section('★★ A：給數字猜顏色（和暖身方向相反）');
{
  const by = k => M.A_CASES.filter(c => c.key === k)[0];
  ok(String(by('yellow').rgb) === '255,255,0' && by('yellow').name === '黃色',
     '★★ 紅255 綠255 藍0 → 黃色');
  ok(by('white').name === '白色' && String(by('white').rgb) === '255,255,255',
     '★★ 三盞全開 → 白色');
  ok(by('black').name === '不亮（黑）', '★ 三盞全關 → 不亮');
  /* ⚠️ 錯的選項要是學生**真的會選**的，不然形同送分。 */
  ok(by('yellow').wrong.indexOf('咖啡色') >= 0,
     '★★ 紅＋綠那一題要放「咖啡色」（美術課的顏料直覺）');
  ok(by('white').wrong.indexOf('黑色') >= 0,
     '★★ 三盞全開那一題要放「黑色」（以為會互相抵消）');
  ok(by('black').wrong.indexOf('白色') >= 0,
     '★ 三盞全關那一題要放「白色」（以為沒設定就是白）');
  ok(M.A_CASES.every(c => c.wrong.length === 3 && c.wrong.indexOf(c.name) < 0),
     '   每一題三個錯的選項，而且不會混進正解');
  ok(M.A_CASES.every(c => c.why && c.why.length > 10), '   每一題都有「為什麼」');

  ok(M.judgeA('黃色', by('yellow')), '答對');
  ok(!M.judgeA('咖啡色', by('yellow')), '答錯');
  /* ★★ 回饋要**點名**那一族的迷思，不是只說「錯了」。 */
  ok(/顏料/.test(M.sayA('咖啡色', by('yellow'))), '★★ 答咖啡色 → 點破那是顏料的規矩');
  ok(/抵消|都關掉/.test(M.sayA('黑色', by('white'))), '★★ 答黑色 → 點破光沒有負的');
  ok(/三盞都開/.test(M.sayA('白色', by('black'))), '★ 答白色 → 點破白光要三盞都開');

  /* 選項要洗牌 —— 正解不可以永遠在同一個位置。 */
  const spots = new Set();
  for (let i = 0; i < 60; i++) {
    const r = U.rngFrom('a' + i);
    spots.add(M.optsA(by('yellow'), r).findIndex(o => o.good));
  }
  ok(spots.size > 1, '★★ 正解的位置會換（' + spots.size + ' 種），不能背位置');
  /* 題目也要換。 */
  const keys = new Set();
  for (let i = 0; i < 60; i++) keys.add(M.caseA(U.rngFrom('k' + i), null).key);
  ok(keys.size >= 4, '★ 題目會換（' + keys.size + ' 種）');
}

section('★★ B：三組情境，壞的都是「上限寫成 255」');
{
  ok(M.CASES_B.length === 3, '三組情境');
  ok(M.CASES_B.every(c => c.fixes.filter(f => f.good).length === 1), '每一組只有一個修得對');
  ok(M.CASES_B.every(c => /255/.test(c.code)), '★★ 三組壞的都是同一個原因（上限 255）');
  ok(M.CASES_B.every(c => c.fixes.filter(f => f.good)[0].text.indexOf('359') >= 0),
     '★★ 正解都是改成 359');
  /* ⚠️ 症狀要是「能動，但少了一截」—— 不會壞、不會報錯。 */
  ok(M.CASES_B.every(c => /回不來|出不來|調不出/.test(c.symptom)),
     '★★ 症狀都是「少了一截」，不是「壞掉」（這種錯只能靠說得出原因）');
  ok(M.CASES_B.every(c => c.fixes.every(f => f.after && f.after.length > 12)),
     '   每一個選項都有「會發生什麼」');
  /* ★ 要有一個把 1023 拿來當色環上限的錯 —— 那正是三個範圍搞混。 */
  ok(M.CASES_B.some(c => c.fixes.some(f => !f.good && /1023/.test(f.text))),
     '★★ 有一個錯的選項是「上限改成 1023」（把讀到的範圍當成色環）');

  /* 用自己的話說 —— 兩個概念都要沾到才算。 */
  const spec = M.SAY;
  ok(spec.need.length === 2, '兩個概念');
  ok(spec.need[0].any.indexOf('359') >= 0 && spec.need[0].any.indexOf('一圈') >= 0,
     '★ 概念一：色環一圈是 0～359');
  ok(spec.need[1].any.indexOf('255') >= 0 && spec.need[1].any.indexOf('亮度') >= 0,
     '★ 概念二：255 是亮度，不是角度');
  ok(M.judgeSay('色環一圈是 359，255 是亮度的範圍，兩個不一樣', M.CASES_B[0]).level !== 'none',
     '★★ 講到兩個概念 → 過');
  ok(M.judgeSay('因為比較大', M.CASES_B[0]).level === 'none', '   隨便寫 → 不過');
  ok(M.judgeSay('', M.CASES_B[0]).level === 'none', '   空白 → 不過');
}

section('★★ C：自己填兩個數字');
{
  const g = k => M.GOALS.filter(x => x.key === k)[0];
  ok(String(g('full').want) === '0,359', '★ 轉一圈 → 0～359');
  ok(String(g('half').want) === '0,180', '★ 半圈 → 0～180');
  ok(String(g('warm').want) === '0,60', '★ 紅到黃 → 0～60');
  ok(M.judgeC(0, 359, g('full')).ok, '答對過關');
  ok(M.judgeC('0', '359', g('full')).ok, '★ 輸入框給的是字串，一樣要判得對');
  /* ⚠️ 四種錯的症狀完全不同，回饋不可以混在一起。 */
  ok(M.judgeC(359, 0, g('full')).how === 'swap', '★ 對調 → swap');
  ok(M.judgeC(0, 1023, g('full')).how === 'over', '★★ 寫 1023 → over（顏色會繞好幾圈）');
  ok(M.judgeC(0, 255, g('full')).how === 'level', '★★ 寫 255 → level（那是亮度，B 剛講過）');
  ok(M.judgeC(0, 90, g('full')).how === 'range', '   範圍不對 → range');
  ok(M.judgeC('', '', g('full')).how === 'bad', '   空白 → bad');
  const msgs = ['swap', 'over', 'level', 'range', 'bad']
    .map(h => M.sayC({ how: h }, g('full')));
  ok(new Set(msgs).size === 5, '★★ 五種回饋各不相同（不然學生分不出錯在哪）');
  ok(/繞好幾圈/.test(M.sayC({ how: 'over' }, g('full'))), '★ over 要講「會繞好幾圈」');
  ok(/亮度/.test(M.sayC({ how: 'level' }, g('full'))), '★ level 要點回「那是亮度」');
}

section('★★ 三個檢核真的走得完');
{
  const el = W.document.getElementById('x');
  let done = null, said = null;
  const api = M.mount(el, { seed: '1234', onDone: i => { done = i; },
                            onSay: (t, r) => { said = r; } });

  /* ── A ── */
  ok(api.step() === 'A' && el.querySelectorAll('[data-a]').length === 4,
     'A：四個顏色選項');
  ok(/按下去才知道/.test(el.textContent),
     '★★ 還沒按就不給看結果 —— 「先講你認為會怎樣」才是檢核');
  /* 先故意猜錯 */
  const badPick = [...el.querySelectorAll('[data-a]')]
    .filter(b => b.getAttribute('data-a') !== api.aCase().name)[0];
  const wasKey = api.aCase().key;
  badPick.dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'A', '   猜錯還留在 A');
  ok(api.aCase().key !== wasKey, '★★ 猜錯會**換一題**（不能一直猜同一題）');
  ok(/剛才那一題的答案是/.test(el.textContent),
     '★★ 而且把剛才那一題的答案講出來（只說「錯了」學不到東西）');
  /* 再答對 */
  el.querySelector('[data-a="' + api.aCase().name + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'B', '★ A 答對 → 進到 B');

  /* ── B：修 → 先講會怎樣 → 用自己的話說 ── */
  const good = api.bCase().fixes.filter(f => f.good)[0];
  el.querySelector('[data-fix="' + good.key + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!api.bFix() && el.querySelectorAll('[data-pred]').length === 3,
     '★★ 選了修法**還不執行** —— 先問「你認為會發生什麼」');
  ok(!el.querySelector('#dl-say'), '   這個時候還不該出現填空');
  el.querySelector('[data-pred="' + good.key + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!el.querySelector('#dl-say'),
     '★★ 修對＋說得出會怎樣 → 才進到「用自己的話說」（老師指定要保留）');
  ok(api.step() === 'B', '   還沒說之前不算過');

  const box = el.querySelector('#dl-say');
  box.value = '色環一圈是 359，255 是每一盞燈的亮度，兩個不一樣';
  box.dispatchEvent(new W.Event('input', { bubbles: true }));
  el.querySelector('#dl-runB').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'C', '★ 說得出來 → 進到 C');
  ok(!!said, '   而且回報 onSay');

  /* ── C ── */
  const inLo = () => el.querySelector('#mx-lo'), inHi = () => el.querySelector('#mx-hi');
  ok(!!inLo() && !!inHi(), 'C：兩格都要自己填');
  inLo().value = '0'; inHi().value = '255';
  el.querySelector('#mx-runC').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'C' && /亮度/.test(el.textContent),
     '★★ 填 255 → 點回「那是亮度」（把 B 學到的接起來）');
  inLo().value = String(api.cCase().want[0]);
  inHi().value = String(api.cCase().want[1]);
  el.querySelector('#mx-runC').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ 三關都過 → 回報 onDone');
  ok(!/\*\*/.test(el.textContent), '★ 結尾有過 md()');
}

section('★ 規矩');
{
  const src = read('shared/mixlab.js');
  ok(/LK\(\)\.pick\(/.test(src), '★ 換一題走 labkit 的 pick');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(src),
     '★★ labkit 沒載到要明講（靜默半殘的症狀是「按了沒反應」）');
  ok(!/POTLAB|RGBLAB|FANLAB/.test(src), '★★ 不去碰別的單元（相依只能單向）');
  ok(!/MIXLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道 mixlab 的存在');
  ok(!/stars/.test(src), '★★ 不碰 stars —— 5016B 不計星');
  ok(/LK\(\)\.reviewSay\(/.test(src), '★ AI 覆核走 labkit（不自己接 ASKAI）');
  ok(!/global\.ASKAI/.test(src), '★★ 自己不碰 ASKAI，一律經過 labkit');
  ok(/unit: '5016b-u4-B'/.test(src), '   AI 覆核標明是哪一節');
  /* ⚠️ 老師：「公式有點難，不解釋」—— 檢核也不可以偷渡那三行。 */
  ok(!/Math\.sin/.test(src), '★★ 檢核裡也沒有 sin（老師明講那個公式不解釋）');
}

section('★ 第四節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/mixlab\.js"><\/script>/.test(page), '頁面載入 mixlab');
  ok(new RegExp("lab: \\{ unit: 'u4', warm: 'RGBLAB', checks: 'MIXLAB'").test(page),
     '★★ 第四節的檢核接上了（原本是 null —— 老師 2026-08-25 回報「沒有開始」）');
  ok(!/checks: null/.test(page.slice(page.indexOf('title: "情境照明'),
                                     page.indexOf('title: "智慧中樞'))),
     '   第四節不再是 null');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
