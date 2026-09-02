/* 評分站被嵌進 iframe 時的高度（shared/grader.html ＋ 兩支嵌它的頁面）
   跑法：node shared/tests/grader.test.js

   ⚠️ 2026-08-11 實際發生：
     11502/level.html 的「🚀 實作測試」把 iframe 寫死 height:560px，
     加上 scrolling="no" 與 overflow:hidden ——
     評分站一超過 560px 就被切掉，**而且捲不到**。
     學生看到「上傳你的作品」只露出一半，沒有捲軸、沒有提示，
     看起來就是頁面壞了。

     而 11501/flowchart.html 嵌的是**同一支評分站**，卻自己寫了一份
     autoSizeGraderFrame 去量高度 —— 所以上學期沒事、下學期壞掉。
     同一件事兩個地方各做一次，就會有一邊漏掉，
     而漏掉的那一邊不會有任何錯誤訊息。

   ⇒ 高度改由評分站自己回報（postMessage），嵌它的頁面只負責收。
     這一份盯的就是「兩邊都有收」和「收之前有驗來源」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
/** 去掉註解 —— 註解裡會引用舊寫法來說明為什麼不要它 */
const strip = s => s.replace(/<!--[\s\S]*?-->/g, ' ')
                    .replace(/\/\*[\s\S]*?\*\//g, ' ')
                    .replace(/^\s*\/\/[^\n]*/gm, ' ');

section('評分站自己回報高度');
{
  const g = strip(read('shared/grader.html'));
  ok(/postMessage\(\{\s*type:\s*'graderHeight'/.test(g),
     '★ shared/grader.html 會把自己的高度 postMessage 出去');
  ok(/window\.self === window\.top/.test(g),
     '   沒被嵌就不做（獨立開啟時不必浪費一個 ResizeObserver）');
  /* 高度會變：選了檔案、批改結果出來、錯誤訊息展開。
     只在載入時報一次的話，結果一長出來就又被切掉。 */
  ok(/ResizeObserver/.test(g), '★ 一直盯著高度變化，不是只報一次');
  ok(/setTimeout\(tell/.test(g),
     '   另外補幾次延遲回報（圖片／字型載完會再長一點）');
}

section('★ 兩支嵌它的頁面都要收');
[['11502/level.html', 'gf'], ['11501/flowchart.html', 'grader-frame']].forEach(([f, id]) => {
  const s = strip(read(f));
  ok(s.indexOf('grader.html') >= 0, f + ' 有嵌評分站');
  ok(/graderHeight/.test(s), '★ ' + f + ' 有收高度訊息');
  /* ⚠️ 一定要驗來源。任何一個網頁都可以 postMessage 過來，
     不驗的話別人送一個 h:1 就能把畫面弄壞。 */
  ok(/e\.source !== \w+\.contentWindow/.test(s),
     '★ ' + f + ' 有驗 e.source（不驗的話任何網頁都能改你的版面）');
  ok(/h > 200 && h < 4000/.test(s),
     '   高度有上下限（收到怪值不要照單全收）');
  ok(s.indexOf('id="' + id + '"') >= 0 || s.indexOf("id='" + id + "'") >= 0 ||
     s.indexOf('"' + id + '"') >= 0,
     '   對應的 iframe id 還在（' + id + '）');
});

section('★ 不可以再各寫一份量高度的程式');
{
  /* 從外面讀 iframe 的 contentDocument 去量 —— 那就是走鐘的來源。 */
  [['11502/level.html'], ['11501/flowchart.html']].forEach(([f]) => {
    const s = strip(read(f));
    ok(!/contentDocument[\s\S]{0,80}scrollHeight/.test(s),
       '★ ' + f + ' 沒有自己去量 iframe 的高度（高度只有評分站自己最清楚）');
  });
}

section('★★ 批改請求一定要有逾時（後端當掉時學生要回得到可重試的狀態）');
{
  const SRC = read('shared/grader.html');
  /* ⚠️⚠️ 2026-09-02 清點時發現：這一支對 /api/student/grade 的呼叫
     **完全沒有 AbortController**。後端當掉或被回收時 fetch 會一直掛著，
     學生看到永遠轉不完的圈圈，而且 gradeBtn 停在 disabled ——
     連重試都按不了。
     ★ 運算思維那邊 2026-08-26 就修過同一個坑（/analyze 的 180 秒），
       這一支漏掉了。⇒ 兩邊都要有。 */
  ok(/new AbortController\(\)/.test(SRC), '★★ 要有 AbortController');
  const m = /setTimeout\(\(\)\s*=>\s*\w+\.abort\(\),\s*(\d+)\)/.exec(SRC);
  ok(!!m, '★★ 要真的設逾時（不是只建了 controller）');
  // AI 批改要等 Gemini，比 OCR 久；但也不能久到學生放棄
  ok(!!m && Number(m[1]) >= 120000 && Number(m[1]) <= 600000,
     '★ 逾時要落在 2～10 分鐘　←　目前 ' + (m ? Number(m[1])/1000 + ' 秒' : '找不到'));
  ok(/signal\s*:\s*\w+\.signal/.test(SRC),
     '★★ signal 要真的傳進 fetch（漏掉的話 controller 形同虛設）');
  ok(/clearTimeout/.test(SRC), '★ 成功時要清掉 timer');

  /* ⚠️ 逾時訊息不可以是瀏覽器的原生說法 */
  ok(/AbortError/.test(SRC), '★ 要認得出 AbortError');
  ok(/這不是你的作品有問題/.test(SRC),
     '★★ 逾時要明講「不是你的作品有問題」—— 不然學生會去改沒壞的東西');
  ok(!/setStatus\('❌ '\+e\.message/.test(SRC),
     '★★ 不可以再把 e.message 直接丟給學生');

  /* 逾時之後一定要讓他能重按 */
  /* ⚠️ 不可以用 indexOf('}catch(e){') —— 這個檔案裡有好幾個 catch，
     抓到的是別人的區塊，於是「還原之後測試照樣紅」。
     ⇒ 從那句逾時訊息本身往後看，位置才唯一。 */
  const wi = SRC.indexOf("setStatus('❌ '+why,'err')");
  const cat = wi >= 0 ? SRC.slice(wi, wi + 300) : '';
  ok(/disabled\s*=\s*false/.test(cat),
     '★★ 失敗時要把按鈕解鎖（不然學生卡死，連重試都按不了）');
}


console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
