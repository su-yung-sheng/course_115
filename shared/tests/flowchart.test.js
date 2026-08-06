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
// 抽出要測的函式（整份是 module，不能直接跑）
const grab=re=>s.match(re)[0];
eval(grab(/const STEP_NOTES = \{[\s\S]*?\n    \};/).replace('const','var'));
eval(grab(/function esc\(t\)[\s\S]*?\n/));
eval(grab(/function stepNote\(s\)[\s\S]*?\n/));
eval(grab(/function mermaidShape[\s\S]*?\n    \}/));
eval(grab(/function toMermaid[\s\S]*?\n    \}/));
const units=[...s.matchAll(/title:'(.*?)'[\s\S]*?steps:\[(.*?)\]/g)]
  .map(([_,t,raw])=>({t,steps:raw.split("','").map(x=>x.replace(/^'|'$/g,''))}));

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

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail?1:0);
