/* 「問問看」前端的測試
   跑法：node shared/tests/askai.test.js   （需要 jsdom：npm install jsdom）

   ★ 這一份測的全是「AI 不聽話的時候會怎樣」。
     順利的那條路很好寫，但它不是風險所在 ——
     額度會用完、模型會過載、網路會斷、GAS 會被切斷回應。
     這幾件事每一件都會發生，而學生不該因為任何一件卡在關卡裡。 */
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function makeWin(reply, opt) {
  opt = opt || {};
  const dom = new JSDOM('<div id="h"></div>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.CONFIG = opt.noKey ? { AIGUIDE: { GAS_URL: 'https://x/exec', KEY: '' } }
                       : { AIGUIDE: { GAS_URL: 'https://x/exec', KEY: 'k' } };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'ai-guide.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'askai.js'), 'utf8'))(w);
  w.__urls = [];
  w.fetch = (url, o) => {
    w.__urls.push(url);
    if (typeof reply === 'function') return reply(url, o);
    return Promise.resolve({ text: () => Promise.resolve(JSON.stringify(reply)) });
  };
  return w;
}

const KEYS = [
  { name: '走一段再轉', any: ['轉', '轉彎'] },
  { name: '做四次', any: ['四', '4'] }
];

function mount(w, o) {
  const host = w.document.getElementById('h');
  w.ASKAI.mount(host, Object.assign({ unit: '4-2-1', qi: 0, keys: KEYS, hint: '課本說：走一條邊、轉一次角。' }, o || {}));
  return host;
}
const send = (host, text) => {
  host.querySelector('.ai-ta').value = text;
  host.querySelector('.ai-btn').dispatchEvent(new (host.ownerDocument.defaultView.Event)('click'));
};
const out = host => host.querySelector('.ai-out').textContent;

(async () => {

console.log('\n── 沒設定就整塊不出現 ────────────────────');
{
  const w = makeWin({ ok: true, reply: 'x' }, { noKey: true });
  const host = mount(w);
  ok(host.style.display === 'none', '★ config.js 的 KEY 留空 → 整塊隱藏');
  ok(!host.querySelector('.ai-btn'), '   不要留一個按了會壞的按鈕');
  ok(w.ASKAI.enabled() === false, '   enabled() 說得出來');
}

console.log('\n── 順利的那條路 ──────────────────────────');
{
  const w = makeWin({ ok: true, reply: '畫完一條邊之後要做什麼？' });
  const host = mount(w);
  send(host, '我覺得那一段一直重複');
  await wait(40);
  ok(/畫完一條邊/.test(out(host)), 'AI 的問句顯示出來');
  const url = w.__urls[0];
  ok(/action=ask/.test(url) && /unit=4-2-1/.test(url) && /qi=0/.test(url), '送出哪一關、第幾問');
  ok(!/[?&]sid=/.test(url), '★ 參數不可以叫 sid（Google 的保留字，請求會到不了指令碼）');
  ok(/student=/.test(url), '   學號用 student');
  ok(!/forbid=|hint=|prompt=/.test(url), '★ 不送題目也不送 forbid —— 那些由 GAS 自己抓，前端改不到');
}

console.log('\n── 全部講到就不問 AI ─────────────────────');
{
  const w = makeWin({ ok: true, reply: '不該用到' });
  const host = mount(w);
  send(host, '走一段就轉，做四次');
  await wait(40);
  ok(w.__urls.length === 0, '★ 關鍵概念全中 → 根本不連線（省額度、秒回）');
  ok(/想通了/.test(out(host)), '   給的是老師寫的回饋');
  ok(/沒有用到 AI/.test(host.querySelector('.ai-note').textContent), '   而且要講明這次沒用到額度');
}

console.log('\n── 太短不送出 ────────────────────────────');
{
  const w = makeWin({ ok: true, reply: 'x' });
  const host = mount(w);
  send(host, '蛤');
  await wait(40);
  ok(w.__urls.length === 0, '★ 兩個字就送出去，等於把額度丟掉');
  ok(/先寫幾個字/.test(out(host)), '   而且要說清楚為什麼');
}

console.log('\n── 失敗時退回課本的提示 ──────────────────');
{
  const w = makeWin({ ok: false, error: 'AI 現在很忙，等一下再問。' });
  const host = mount(w);
  send(host, '我完全沒有頭緒該怎麼開始');
  await wait(40);
  ok(/很忙/.test(out(host)), '把失敗原因講出來');
  ok(/課本/.test(out(host)) && /轉一次角/.test(out(host)),
     '★ 同時把課本的提示端出來 —— 學生不該因為 AI 不舒服就卡在那裡');
}
{
  // 回來的不是 JSON（GAS 被切斷時會回一整頁 HTML）
  const w = makeWin(() => Promise.resolve({ text: () => Promise.resolve('<html>登入</html>') }));
  const host = mount(w);
  send(host, '我完全沒有頭緒該怎麼開始');
  await wait(40);
  ok(/連不上/.test(out(host)), '★ 回來的是 HTML 就說「連不上」，不要把整頁原始碼倒給學生');
  ok(/課本/.test(out(host)), '   一樣要有備援提示');
}

console.log('\n── 逾時 ──────────────────────────────────');
{
  const w = makeWin(() => new Promise(() => {}));   // 永遠不回
  w.ASKAI._t = null;
  const host = mount(w);
  ok(w.ASKAI.TIMEOUT_MS >= 15000 && w.ASKAI.TIMEOUT_MS <= 30000,
     '★ 逾時設在 15～30 秒之間（實測最慢 9.4 秒，切太早會把會成功的判成失敗）');
  const src = fs.readFileSync(path.join(__dirname, '..', 'askai.js'), 'utf8');
  ok(/AbortController/.test(src),
     '★ 要真的中斷請求 —— 只是「不再理它」的話，額度照樣被算走');
  ok(/9\.4 秒|Failed to fetch/.test(src), '   把實測數字和症狀寫在程式裡');
}

console.log('\n── 等待狀態與重複按 ──────────────────────');
{
  let release;
  const w = makeWin(() => new Promise(r => { release = () => r({ text: () => Promise.resolve('{"ok":true,"reply":"好"}') }); }));
  const host = mount(w);
  send(host, '我完全沒有頭緒該怎麼開始');
  await wait(20);
  ok(host.querySelector('.ai-btn').disabled === true, '★ 按下去就鎖住 —— 每人一天只有 3 次，按第二下就少三分之一');
  ok(/正在想|等一下/.test(out(host)), '   而且要看得出「它在動」');
  send(host, '再按一次');
  await wait(20);
  ok(w.__urls.length === 1, '★ 鎖住的時候再按也不會多送一次');
  release(); await wait(40);
  ok(host.querySelector('.ai-btn').disabled === false, '回來之後解鎖');
}

console.log('\n── 冷卻要看得出剩幾秒 ────────────────────');
{
  const w = makeWin({ ok: false, cooling: true, retryAfter: 7, error: '剛剛才問過，等 7 秒再問。' });
  const host = mount(w);
  send(host, '我完全沒有頭緒該怎麼開始');
  await wait(40);
  ok(/等 7 秒/.test(out(host)), '講得出還要等幾秒');
  await wait(40);   // 讓收尾的 .then 也跑完 —— 它曾經把倒數的鎖蓋掉
  ok(host.querySelector('.ai-btn').disabled === true,
     '★ 冷卻中按鈕要一直鎖著（收尾不可以無條件解鎖）');
}

console.log('\n── 接進關卡頁的方式 ──────────────────────');
{
  /* ★ 2026-08-10：思考關卡搬到 level.html（一關一頁），所以這裡改讀那一份。 */
  const scr = fs.readFileSync(path.join(__dirname, '..', '..', '11502', 'level.html'), 'utf8');
  const drv = fs.readFileSync(path.join(__dirname, '..', 'derive.js'), 'utf8');
  ok(/askai\.js/.test(scr) && /ai-guide\.js/.test(scr), '關卡頁載入了這兩支');
  ok(/unit: unit\.id/.test(scr), 'unit 傳進去（GAS 靠它抓題目）');
  ok(/window\.saveAsk/.test(scr), '對話存得起來 —— 那是唯一一份「學生怎麼描述自己卡住」的紀錄');
  /* 釘「有做這個判斷」，不釘「判斷寫成什麼形狀」——
     寫成 if (!A || !A.enabled()) return 還是 if (A && A.enabled()) 都對。 */
  ok(/window\.ASKAI/.test(drv) && /ASKAI\.enabled\(\)/.test(drv),
     '★ derive.js 要判 ASKAI 在不在 —— 問題拆解不該依賴 AI 才能用');
  ok(/\(it\.keys \|\| \[\]\)\.length/.test(drv),
     '   只有「說得出希望學生講到什麼」的那幾問才掛 AI');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);

})();
