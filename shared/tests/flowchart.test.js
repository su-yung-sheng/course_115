/* =====================================================================
   11501 流程圖關卡的測試（11501/flowchart.html）
   ---------------------------------------------------------------------
   怎麼跑（不需要 jsdom，純字串處理）：
       node shared/tests/flowchart.test.js

   驗兩件事：
     ① 每個步驟都有一句說明，而且說明不能洩漏順序
        —— 洩漏了就變成看說明抄答案，這一關就沒有意義了
     ② 排完之後產生的 Mermaid 程式碼是合法的、形狀對、迴圈與分支接得對
        —— 學生會把它貼到 mermaid.ai，產不出圖就白做

   ★ 十關全部都驗，不是挑一關看看：流程圖有迴圈、有分支、有事件，
     三種結構的接線規則不一樣，只驗一關等於沒驗。
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.resolve(__dirname, '..', '..', '11501', 'flowchart.html'), 'utf8')
  // 單元資料 2026-08-06 起搬到 content/flowchart.js（審核頁也要用同一份），兩邊接起來一起測
  + '\n' + fs.readFileSync(path.resolve(__dirname, '..', '..', '11501', 'content', 'flowchart.js'), 'utf8');
let pass=0,fail=0;
const is=(g,w,l)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
 console.log((ok?'  ✅ ':'  ❌ ')+l+(ok?'':`\n       期望 ${JSON.stringify(w)}\n       實得 ${JSON.stringify(g)}`))};
/* 從 HTML 裡把要測的幾個函式原封不動取出來執行。
   ★ 為什麼用 new Function 而不是 eval：
     這支測試是嚴格模式，eval 裡的函式宣告進不到外層，
     取出來也用不到（而且不會報錯，只會在用的時候說「未定義」）。 */
const grab = re => s.match(re)[0];
const API = new Function(
  grab(/const STEP_NOTES = \{[\s\S]*?\n    \};/) + '\n' +
  grab(/function esc\(t\)[\s\S]*?\n/) + '\n' +
  grab(/function stepNote\(s\)[\s\S]*?\n/) + '\n' +
  grab(/function mermaidShape[\s\S]*?\n    \}/) + '\n' +
  grab(/function toMermaid[\s\S]*?\n    \}/) + '\n' +
  'return { STEP_NOTES, esc, stepNote, mermaidShape, toMermaid };'
)();
const { STEP_NOTES, esc, stepNote, mermaidShape, toMermaid } = API;

const units=[...s.matchAll(/title:'(.*?)'[\s\S]*?desc:'(.*?)'[\s\S]*?steps:\[(.*?)\]/g)]
  .map(([_,t,desc,raw])=>({t,desc,steps:raw.split("','").map(x=>x.replace(/^'|'$/g,''))}));

console.log('── 每個步驟都有說明，而且不洩漏順序 ──');
const allSteps=[...new Set(units.flatMap(u=>u.steps))];
is(allSteps.filter(x=>!stepNote(x)),[],'56 個步驟全部都有說明');
is(allSteps.filter(x=>/第\s*\d+\s*步|排在|放在.*後面|順序是/.test(stepNote(x))),[],
   '說明裡沒有洩漏位置的字眼（第幾步／排在…後面）');
is(allSteps.every(x=>stepNote(x).length<=30),true,'每句都在 30 字以內（卡片放得下）');

console.log('\n── Mermaid：形狀要照課本那一套 ──');
is(mermaidShape('開始'),['([','])'],'開始 → 圓角');
is(mermaidShape('結束'),['([','])'],'結束 → 圓角');
is(mermaidShape('判斷：平均 ≥ 60？'),['{','}'],'判斷 → 菱形');
is(mermaidShape('輸入要查詢的姓名'),['[/','/]'],'輸入 → 平行四邊形');
is(mermaidShape('是→說出「不在名單內」'),['[/','/]'],'說出 → 平行四邊形');
is(mermaidShape('把音階匯入清單'),['[',']'],'一般處理 → 矩形');

console.log('\n── 十關全部產得出合法的 Mermaid ──');
units.forEach((u,i)=>{
  const m=toMermaid(u.steps), L=m.split('\n');
  const nodes=new Set(), edges=[];
  L.slice(1).forEach(l=>{
    const t=l.trim();
    const e=t.match(/^(S\d+) -->(?:\|.+?\|)? (S\d+)$/);
    if(e) edges.push([e[1],e[2]]); else { const n=t.match(/^(S\d+)/); if(n) nodes.add(n[1]); }
  });
  const ok = L[0]==='flowchart TD'
    && nodes.size===u.steps.length
    && edges.every(([a,b])=>nodes.has(a)&&nodes.has(b))
    && edges.length>=u.steps.length-1;
  is(ok,true,`第 ${i+1} 關 ${u.t}：${nodes.size} 個節點、${edges.length} 條連線，節點與連線都對得上`);
});

console.log('\n── 幾個結構要正確 ──');
const m2=toMermaid(units[1].steps);
is(/S3 -->\|是\| S4/.test(m2)&&/S3 -->\|否\| S5/.test(m2),true,'第 2 關：菱形分出「是」「否」兩條標了字的線');
is(/S4 --> S6/.test(m2)&&/S5 --> S6/.test(m2),true,'第 2 關：兩條路最後都匯到「結束」');
const m3=toMermaid(units[2].steps);
is(/S5 --> S3/.test(m3),true,'第 3 關：迴圈最後一步繞回「重複」節點');
is(/S3 --> S6/.test(m3),true,'第 3 關：迴圈結束後才往「結束」走');
const m10=toMermaid(units[9].steps);
is((m10.match(/-->\|是\|/g)||[]).length,2,'第 10 關：兩個判斷各分出一條「是」');

console.log('\n── HTML 逸出 ──');
is(esc('S0 --> S1'),'S0 --&gt; S1','箭頭的 > 有逸出，不會被當成標籤');

console.log('\n── 排序畫面要看得到「這個程式要做什麼」──');
const play = s.slice(s.indexOf("if(state.status==='play')"), s.indexOf("if(state.status==='clear')"));
is(/\$\{u\.desc\}/.test(play), true, '排序畫面有帶出這一關的目標（u.desc）');
is(/這個程式要做什麼/.test(play), true, '而且標題講白話，不是只丟一段文字');
is(/u\.details/.test(play), true, '可以展開「再看一次這一關的重點」');
is(/\$\{nudge\}/.test(play), true, '有一句隨進度變化的提示');
is(units.every(u => u.desc && u.desc.length > 10), true, '十關都寫了目標說明');

console.log('\n── 那一句提示：第一步要講得出從哪開始 ──');
const nudgeSrc = play.slice(play.indexOf('const nudge'), play.indexOf('const placedHtml'));
is(/placed\.length === 0/.test(nudgeSrc), true, '一張都還沒排時走另一條分支');
is(/先找「開始」/.test(nudgeSrc), true, '★ 明說先找「開始」—— 那是流程圖的規則，不是這一題的答案');
is(/結束/.test(nudgeSrc), true, '順便講明以「結束」收尾');
is(/\$\{last\}/.test(nudgeSrc), true, '排了之後改成提醒「你已經排到哪一步」');
is(/第\s*\$\{|正確答案|下一步是/.test(nudgeSrc), false, '沒有直接說出下一步是什麼');

/* ── 閱讀停留 ───────────────────────────────────────
   規則本身在 shared/readhold.js（readhold.test.js 顧），
   這裡只釘 11501 自己的兩件事：接上去了、以及「已通關免等」還在。 */
/* ── ★ 計時器變數不可以有「用了卻不存在」的 ──────────
   ⚠️ 2026-08-11 實際發生：
     把 readTimer 改成 readHold（改用 READHOLD）之後，
     beginSelect() 裡漏了一個 `if(readTimer){clearInterval(readTimer);…}`。
     那是函式的**第一行**，所以按下「我讀完了，開始闖關 →」
     會直接丟 ReferenceError，後面的 render() 根本跑不到。

     畫面上的症狀是「按了完全沒反應」——
     沒有錯誤訊息、沒有動靜，只有 F12 主控台裡一行紅字。
     而這一頁的邏輯全在 <script type="module"> 裡（有 firebase import），
     沒辦法用 jsdom 直接跑起來點一遍，所以這種錯完全沒有東西擋。

   ⇒ 這一條專門盯「名字裡有 Timer／Hold 的變數」：
     用到了就一定要有 let／const／var 宣告它。
     ★ 它抓不到所有的打錯字，但抓得到**改名漏改**——
       而這一頁的計時器已經改過兩次名了。 */
{
  const m = s.match(/<script type="module">([\s\S]*?)<\/script>/);
  const js = (m ? m[1] : '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
  const used = new Set();
  let x;
  const re = /(^|[^.\w$])([A-Za-z_$][\w$]*(?:Timer|Hold))\b/g;
  while ((x = re.exec(js))) used.add(x[2]);
  const miss = [...used].filter(n =>
    !new RegExp('(?:let|const|var)[^;\\n]*\\b' + n + '\\b').test(js));
  is(miss.length, 0,
     '★ 用到的計時器變數都有宣告' +
     (miss.length ? `　←　${miss.join('、')} 用了但沒有宣告（改名漏改？）` : ''));
  is([...used].length > 0, true, '   （確認真的有掃到東西：' + [...used].join('、') + '）');

  /* 停計時器一律走 clearTimers()，不要在各處自己動內部變數 ——
     漏改的那一處不會有任何徵兆。 */
  const outside = js.replace(/function clearTimers\(\)[\s\S]*?\n    \}/, ' ');
  is(/clearInterval\(\s*read/.test(outside), false,
     '★ clearTimers() 以外的地方不直接停閱讀計時器（漏改就是這樣來的）');
}

console.log('\n── 閱讀停留：接的是共用規則，而且已通關的關卡免等 ──');
/* ⚠️ 「不可以再出現」這一類的檢查一定要**先去掉註解**。
   註解裡正好會引用舊寫法來說明為什麼不要它 ——
   直接比對原始碼的話，那段說明自己會把測試打成紅字。
   （反過來也發生過：levelpage.test.js 有一條命中的是註解，
     程式裡根本沒那段判斷，紅不起來也綠得沒有意義。） */
const sCode = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
is(/readhold\.js/.test(s), true, '有載入 shared/readhold.js');
is(/READHOLD\.start\(/.test(sCode), true, '★ 用共用規則，不是自己再寫一個計時器');
is(/isWatching|document\.hasFocus|visibilityState/.test(sCode), false,
   '★ 不留舊的 isWatching() —— 它判對了焦點卻沒有保險絲，' +
   '報不出焦點的環境會讓學生永遠卡在這一頁');
is(/!window\.READHOLD/.test(sCode), true, '沒載到就放行，不是把學生鎖死');
{
  /* ⚠️ 這一條是 11501 想到而 11502 原本漏掉的：
     強制停留是為了「第一次別亂點」，不是懲罰。
     已經排對過的人回來查資料、或想再練習一次，
     每次都被鎖 30 秒只會讓他覺得系統在找麻煩。 */
  const fn = s.slice(s.indexOf('function readSecondsFor'), s.indexOf('const HINT_SECONDS'));
  is(/state\.done\[u\.id\]/.test(fn) && /\? 0 :/.test(fn), true,
     '★ 已經排對過的關卡回傳 0 秒 —— 回來查資料不該再被鎖一次');
  is(/sec:\s*readSecondsFor\(state\.unit\)/.test(s), true,
     '   而且真的把它傳給倒數（不是算完就丟掉）');
}

/* ── 每一關顯示的星數，要和闖關基地那張卡對得起來 ────────────
   ★ 2026-08-19 老師問：「程式設計的星星數不同，內頁關卡上的星數比較多，
     是因為加分的因素嗎？」

   ⚠️ 不是加分 —— 是這一頁把流程圖那一軌**寫死成三顆**：
        done ? (三顆實心) : (三顆空心)
      可是排對只給 FLOWCHART_PER_UNIT（2）顆，第三顆是交圖加分，
      要老師審核過才有。於是逐關數起來每關多 1 顆、十關多 10 顆。
      ★ 方向剛好相反：加分是闖關基地**多**算的那一份
        （hub 走 GRADING.starsWithBonus），這一頁本來根本沒讀 imgUnits。

   ⚠️⚠️ 註解掩護：下面幾條有「不可以出現寫死的三顆星」這種檢查，
      而這段註解本身就在講那個符號 —— 直接對整份原始碼比對會被自己蓋掉
      （這個專案已經中過四次）。所以一律先把註解剝掉再測。 */
{
  console.log('\n── 星數顯示（老師 2026-08-19）──');
  /* 剝掉 /* *\/ 與 // 註解。夠用就好：這份檔案裡沒有含 // 的字串常值。 */
  const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const STAR3 = '★★★';

  is(code.includes(STAR3), false,
     '★ 程式碼裡不可以再有寫死的三顆實心星 —— 星數一律由實際數字產生');
  is(/const bar = \(n, cap\)/.test(code), true,
     '   改用 bar(實得, 上限) 產生星條');
  is(/const flowSt = done \? STARS_PER_UNIT \+ \(imgOn\?B_IMG:0\) : 0;/.test(code), true,
     '★ 流程圖那一軌 = 排對的 2 顆 ＋ 交圖加分（有審核過才加）');
  is(/const progSt = st>0 \? st \+ \(vidOn\?B_VID:0\) : 0;/.test(code), true,
     '★ 程式那一軌 = AI 批改的星 ＋ 錄影加分');
  is(/bar\(flowSt, STARS_PER_UNIT \+ B_IMG\)/.test(code), true,
     '   上限也要跟著規則走（2+1），不要寫死 3');

  /* 加分值只能有一個來源。兩邊各訂一個數字的話，
     「同一份成績兩個數字」會再發生一次，而且更難查。 */
  is(/B_IMG = \(\(window\.GRADING \|\| \{\}\)\.BONUS \|\| \{\}\)\.img/.test(code), true,
     '★ 加分值取自 GRADING.BONUS，不在這一頁另外訂');
  is(/B_VID = \(\(window\.GRADING \|\| \{\}\)\.BONUS \|\| \{\}\)\.vid/.test(code), true,
     '   錄影加分同上');

  /* 讀得到加分，畫面才可能對得起來 */
  is(/state\.imgUnits = \(mods\.flowchart && mods\.flowchart\.imgUnits\) \|\| \{\}/.test(code), true,
     '★ 真的從進度文件把 imgUnits 讀進來（本來完全沒讀）');
  is(/state\.vidUnits = \(mods\.scratch && mods\.scratch\.vidUnits\) \|\| \{\}/.test(code), true,
     '   vidUnits 同上');
  is(/state\.imgUnits=\{\}; state\.vidUnits=\{\}/.test(code), true,
     '★ 登出要一起清掉 —— 電腦教室是共用的，殘留會讓下一位看到別人的加分');

  /* 表頭要把「合計」講出來，那就是闖關基地那張卡的數字。 */
  is(/const grand = doneCount\*STARS_PER_UNIT \+ progStarTotal \+ bonusAll;/.test(code), true,
     '★ 合計 = 流程圖 ＋ 程式 ＋ 加分（和 hub 的 cardData 同一個算法）');
  is(/bonusStars\(state\.imgUnits,'img'\)/.test(code)
     && /bonusStars\(state\.vidUnits,'vid'\)/.test(code), true,
     '   加分總數走 GRADING.bonusStars（hub、教師端、這裡同一支）');
}

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail?1:0);
