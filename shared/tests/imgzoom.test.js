/* 程式截圖的「點一下放大」：真的用 jsdom 點下去看有沒有打開
   跑法：node shared/tests/imgzoom.test.js

   ★ 老師 2026-09-09：「程式設計回答問題後會顯示程式解答圖片，
     能夠加入點選放大功能嗎？」—— Scratch 積木上的字縮在卡片裡很小，
     投影出去更看不清楚，學生要對著積木一格一格照抄。

   ⚠️⚠️ 這一份**真的把那段程式跑起來並模擬點擊**。
      這種功能最典型的壞法是「事件沒綁到」——
      那些 img 是 render() 用 innerHTML 重畫出來的，
      綁在元素上的事件每次重畫就沒了，而畫面看起來完全正常。
      grep 只看得到程式碼在，看不出點下去有沒有反應。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }

section('① 縮圖要標記得出來（不然委派抓不到）');
ok(/data-zoomgroup/.test(SRC), '★★★ 同一關的圖要包在 data-zoomgroup 裡，才能左右切換');
ok(/data-zoom\b/.test(SRC) && /zoomable/.test(SRC), '★★ 每張縮圖要有 data-zoom 和可點的游標');
ok(/點圖可放大/.test(SRC), '★★ 要有一行提示 —— 學生不會去猜圖能點');

section('② 事件一定要用委派');
ok(/document\.addEventListener\('click'/.test(SRC),
  '★★★ 綁在 document 上，不是綁在 img 上 —— '
  + '那些 img 是 render() 用 innerHTML 重畫的，綁在元素上每次重畫就沒了');

section('③ 真的點下去（jsdom）');
if (!JSDOM) {
  console.log('  ⏭️  跳過：這台沒有 jsdom');
} else {
  // 從頁面裡挖出真正的遮罩 HTML 和那段程式，不要在測試裡另抄一份
  const boxHtml = SRC.slice(SRC.indexOf('<div id="imgBox"'),
                           SRC.indexOf('</div>', SRC.indexOf('<div id="zHint"')) + 6);
  const si = SRC.indexOf('/* 程式截圖的放大檢視。');
  const code = SRC.slice(si, SRC.indexOf('</script>', si));
  ok(boxHtml.indexOf('id="zImg"') > 0 && code.length > 500,
    '★ 有挖到遮罩與程式（挖不到的話下面幾條等於沒測）');

  const dom = new JSDOM(
    '<body><div class="grid" data-zoomgroup>'
    + '<img data-zoom class="zoomable" src="a.png">'
    + '<img data-zoom class="zoomable" src="b.png">'
    + '</div>' + boxHtml + '</body>',
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  w.eval(code);

  const box = d.getElementById('imgBox');
  const zimg = d.getElementById('zImg');
  ok(!box.classList.contains('on'), '★ 一開始是關的');

  d.querySelectorAll('img[data-zoom]')[1].dispatchEvent(
    new w.MouseEvent('click', { bubbles: true }));
  ok(box.classList.contains('on'), '★★★ 點第二張縮圖要打開遮罩');
  ok(zimg.getAttribute('src') === 'b.png',
    '★★★ 要顯示**被點的那一張**，不是第一張　←　' + zimg.getAttribute('src'));
  ok(d.body.style.overflow === 'hidden',
    '★★ 打開時要鎖住背景捲動 —— 手機上不鎖的話手指一滑是整頁在動');

  d.getElementById('zNext').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(zimg.getAttribute('src') === 'a.png',
    '★★★ 最後一張按「下一張」要繞回第一張，不可以卡住（學生會以為壞了）　←　'
    + zimg.getAttribute('src'));

  zimg.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(/scale\(2\)/.test(zimg.style.transform),
    '★★★ 點圖片本身要再放大一倍（積木上的字才看得清楚）　←　' + zimg.style.transform);

  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  ok(!box.classList.contains('on'), '★★★ 按 Esc 要關掉');
  ok(d.body.style.overflow === '',
    '★★★ 關掉一定要還原背景捲動 —— 忘了還原的話整頁就再也捲不動了');
  ok(!zimg.getAttribute('src'),
    '★★ 關掉要放掉大圖（手機記憶體吃緊）');

  // 重畫之後還要能用 —— 這就是委派的重點
  d.querySelector('[data-zoomgroup]').innerHTML =
    '<img data-zoom class="zoomable" src="c.png">';
  d.querySelector('img[data-zoom]').dispatchEvent(
    new w.MouseEvent('click', { bubbles: true }));
  ok(box.classList.contains('on') && zimg.getAttribute('src') === 'c.png',
    '★★★ innerHTML 重畫之後還要能點得開 —— 這是用委派的唯一理由');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
