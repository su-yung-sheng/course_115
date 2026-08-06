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
const s = fs.readFileSync(path.resolve(__dirname, '..', '..', '11501', 'flowchart.html'), 'utf8');
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

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail?1:0);
