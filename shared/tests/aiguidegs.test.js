/* aiguide.gs 的金鑰分流：輪替、節流、冷卻
   跑法：node shared/tests/aiguidegs.test.js

   ★ 為什麼要能單獨測
     這段邏輯只有在「一班 30 人同時按」的時候才會現形，
     而那時候是上課中，出事就是全班卡在那裡。
     這裡用假的 UrlFetchApp 把 GAS 的環境兜出來，在本機就跑得完。

   ⚠️ 測的是分流邏輯，不是 Gemini。模型守不守得住要用
      shared/ai-lab.html 或 GAS 編輯器裡的 selfTest。 */
'use strict';
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const fs=require('fs');
const path=require('path');
/* ⚠️ 這裡原本寫死一條絕對路徑（開發時那台機器的），
   在別台電腦上執行會直接找不到檔案。一律用 __dirname 相對定位。 */
let src=fs.readFileSync(path.join(__dirname,'..','aiguide.gs'),'utf8');
// 假的 GAS 環境
const props={}, cache={};
const env={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v;},remove:k=>{delete cache[k];}})},
  Utilities:{formatDate:()=>'2026-08-07',sleep:()=>{}},
  Logger:{log:()=>{}},
  UrlFetchApp:null,
};
props['GEMINI_KEY']='k1'; props['GEMINI_KEY_2']='k2'; props['GEMINI_KEY_3']='k3';
props['RPM_PER_KEY']='2';
let calls=[];
env.UrlFetchApp={fetch:(url)=>{
  const k=decodeURIComponent(url.split('key=')[1]);
  calls.push(k);
  const code = env.__force429 && env.__force429[k] ? 429 : 200;
  return {getResponseCode:()=>code,
    getContentText:()=>code===200?JSON.stringify({candidates:[{content:{parts:[{text:'那是哪一件事呢？'}]}}]}):'quota'};
}};
const box={};
new Function('PropertiesService','CacheService','Utilities','Logger','UrlFetchApp','module',
  src+'\nmodule.askGemini_=askGemini_;module.keyReport_=keyReport_;module.pickKey_=pickKey_;')(
  env.PropertiesService,env.CacheService,env.Utilities,env.Logger,env.UrlFetchApp,box);

// ① 輪替：連問 3 次應該用到三把不同的
calls=[]; for(let i=0;i<3;i++) box.askGemini_('x');
ok(new Set(calls).size===3,'三把輪流用到：'+calls.join(' → '));
// ② 節流：每把上限 2，總共 6 次之後就該說忙
calls=[]; let busy=0;
for(let i=0;i<6;i++){ try{ box.askGemini_('x'); }catch(e){ if(e.busy) busy++; } }
ok(busy>0,'每分鐘額滿之後會請學生等（'+busy+' 次被擋）');
// ③ 冷卻：k1 固定回 429，之後不該再用到 k1
Object.keys(cache).forEach(k=>{ if(k.startsWith('rpm.')||k.startsWith('cool.')) delete cache[k]; });
env.__force429={k1:true};
calls=[]; try{ box.askGemini_('x'); }catch(e){}
ok(calls[0]==='k1'&&calls.length>1,'k1 吃到 429 會自動換下一把：'+calls.join(' → '));
calls=[]; try{ box.askGemini_('x'); }catch(e){}
ok(!calls.includes('k1'),'★ 之後 60 秒不再用 k1（冷卻）：'+calls.join(' → '));

/* 只有一把金鑰時也要正常 —— 大部分人一開始只有一把 */
Object.keys(props).forEach(k => { if (/GEMINI_KEY_/.test(k)) delete props[k]; });
Object.keys(cache).forEach(k => { if (/^rpm\.|^cool\./.test(k)) delete cache[k]; });
env.__force429 = null;
calls = [];
try { box.askGemini_('x'); ok(calls.join() === 'k1', '只有一把時照樣能用'); }
catch (e) { ok(false, '只有一把時不該壞掉：' + e.message); }

/* 一把都沒有 → 要講清楚，不是丟一個看不懂的錯 */
delete props['GEMINI_KEY'];
try { box.askGemini_('x'); ok(false, '沒有金鑰時應該報錯'); }
catch (e) { ok(/GEMINI_KEY/.test(e.message), '沒有金鑰時的訊息要指名 GEMINI_KEY'); }


/* ── ★★ 每一個被呼叫的 xxx_() 都要真的定義得出來 ────────────────
   ⚠️ 2026-08-24 抓到：judgePrompt_ 呼叫了 unitBrief_()，而那支
      **從來沒有定義過**。Apps Script 會丟 ReferenceError，
      但 action=judge 整段包在 try/catch 裡 →
      永遠回 { results: [], skipped: 'ai' }。
      ★ 那個症狀和「AI 認為他確實沒講到」一模一樣，
        所以 AI 覆核可能從上線第一天就沒有真的運作過，而沒有人會發現。

   ⇒ 這一條盯的不是那一支函式，是**整個類別的錯**：
     .gs 沒有模組系統、沒有編譯期檢查，打錯一個字或搬走一支函式，
     要等到那條路徑被走到、而且沒被 try/catch 吃掉，才看得見。 */
{
  /* ⚠️ **只**剝註解，不要剝字串。
     第一版連字串一起剝，結果引號在中文文案裡對不起來，
     一路吃掉六支真的有定義的函式 —— 測試當場報「缺 provider_」，
     而 provider_ 就定義在上面兩百行的地方。
     ★ 這正是 accept="image/*" 那次的同一種病：剝東西的規則自己出錯，
       症狀卻長得像「程式壞了」。 */
  const strip = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  const defined = new Set([...strip.matchAll(/function\s+([A-Za-z0-9_$]*_)\s*\(/g)].map(m => m[1]));
  /* ⚠️ 前面有點的是方法呼叫（obj.foo_()），不是這裡要管的。 */
  const called = new Set([...strip.matchAll(/(^|[^\w.$])([A-Za-z][A-Za-z0-9_$]*_)\s*\(/g)].map(m => m[2]));
  const missing = [...called].filter(n => !defined.has(n) && !/^(function|if|for|while|catch|switch|return|typeof|new)$/.test(n));
  ok(missing.length === 0,
     '★★ 沒有「呼叫了但沒定義」的函式' + (missing.length ? '（缺：' + missing.join('、') + '）' : ''));
  ok(defined.has('unitBrief_'), '   unitBrief_ 有定義（judgePrompt_ 會叫它）');
  /* ★ 而且它不可以往外丟例外 —— 丟了就等於安靜地把整個覆核關掉。 */
  const ub = strip.slice(strip.indexOf('function unitBrief_'));
  ok(/try \{[\s\S]*?catch \(e\) \{\s*return null;/.test(ub.slice(0, 400)),
     '★★ unitBrief_ 抓不到題目時回 null，不丟例外（丟了＝覆核整個關掉）');
}

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
