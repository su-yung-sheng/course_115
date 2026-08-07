/* aiguide.gs：模型過載（5xx）的處理
   跑法：node shared/tests/aiguide503.test.js

   ★ 為什麼這一份存在
     2026-08-07，Gemini 回了
       503 "This model is currently experiencing high demand"
     而當時的程式只認得 429 和 403，503 直接掉進 throw 死掉。
     症狀是「有時候好、有時候壞」—— 而每一次壞掉，
     都讓人跑去翻設定、翻部署、翻參數、翻編碼，花了一整個下午。

     **暫時性的錯誤一定要和「設定錯了」分開處理。**
     分不開的話，使用者會把時間花在檢查沒有壞掉的東西上。 */
'use strict';
const fs=require('fs');
const path=require('path');
/* ⚠️ 這裡原本寫死一條絕對路徑（開發時那台機器的），
   在別台電腦上執行會直接找不到檔案。一律用 __dirname 相對定位。 */
const src=fs.readFileSync(path.join(__dirname,'..','aiguide.gs'),'utf8');
const props={}, cache={};
let codes=[], calls=[];
const env={
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v;},remove:k=>{delete cache[k];}})},
 Utilities:{formatDate:()=>'2026-08-07',sleep:()=>{}}, Logger:{log:()=>{}},
 UrlFetchApp:{fetch:(url)=>{
   const m=decodeURIComponent(url.split('/models/')[1].split(':')[0]);
   const k=decodeURIComponent(url.split('key=')[1]);
   calls.push(m+'/'+k);
   const code=codes.shift()??200;
   return {getResponseCode:()=>code,
     getContentText:()=>code===200?JSON.stringify({candidates:[{content:{parts:[{text:'那是哪一件事呢？'}]}}]})
       :JSON.stringify({error:{code,message:'high demand'}})};
 }},
 ContentService:{createTextOutput:t=>({setMimeType:()=>({}),getContent:()=>t}),MimeType:{JSON:'json'}},
};
const box={};
new Function('PropertiesService','CacheService','Utilities','Logger','UrlFetchApp','ContentService','module',
 src+'\nmodule.askGemini_=askGemini_;module.keyReport_=keyReport_;')(
 env.PropertiesService,env.CacheService,env.Utilities,env.Logger,env.UrlFetchApp,env.ContentService,box);
props['GEMINI_KEY']='k1'; props['GEMINI_KEY_2']='k2'; props['GEMINI_KEY_3']='k3';
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+l);};

// ① 第一把 503 → 換下一把
codes=[503,200]; calls=[];
try{ box.askGemini_('x'); ok(calls.length===2,'★ 503 會換下一把（'+calls.join(' → ')+'）'); }
catch(e){ ok(false,'不該失敗：'+e.message); }

// ② 三把都 503 → 退到備援模型
Object.keys(cache).forEach(k=>delete cache[k]);
codes=[503,200]; calls=[];
try{ box.askGemini_('x');
  ok(calls.length===2 && /flash-lite/.test(calls[1]),
     '★ 過載時換的是「模型」不是金鑰（'+calls.join(' → ')+'）');
  ok(!box.keyReport_().some(k=>k.cooling),'★ 而且不冤枉金鑰 —— 沒有任何一把被冷卻');
}catch(e){ ok(false,'應該要退到備援：'+e.message); }

// ③ 全部都 503（含備援）→ 回 busy，不是死掉
Object.keys(cache).forEach(k=>delete cache[k]);
codes=Array(20).fill(503); calls=[];
try{ box.askGemini_('x'); ok(false,'應該要丟 busy'); }
catch(e){
  ok(e.busy===true,'★ 全部過載 → busy（前端會請學生等一下），不是丟一個看不懂的錯');
  ok(/人太多|過載/.test(e.message),'   訊息要講「人太多」，不是「設定錯了」');
  ok(e.retryAfter>0,'   有帶 retryAfter');
}
// ④ 429 才冷卻金鑰，而且記得住原因（過載不冷卻，見上面）
Object.keys(cache).forEach(k=>delete cache[k]);
codes=[429,200]; calls=[];
try{ box.askGemini_('x'); }catch(e){}
ok(box.keyReport_().some(k=>/429/.test(k.why||'')),
   '★ 429 才冷卻金鑰，而且記得住原因 —— 和「模型過載」分得開');
// ⑤ 400 不換金鑰（換了也一樣錯）
Object.keys(cache).forEach(k=>delete cache[k]);
codes=[400]; calls=[];
try{ box.askGemini_('x'); ok(false,'400 應該直接報錯'); }
catch(e){ ok(calls.length===1 && /400/.test(e.message),'400 不浪費其他金鑰，直接講清楚'); }

/* ── 429 有兩種，Google 自己就講了是哪一種 ──────────
   2026-08-07：三把不同專案的金鑰，跑十題就全部進冷卻。
   原因是三把在同一天被輪流用完（PerDay），
   但程式把 Google 的回應內容整個丟掉，只留一句「額度或每分鐘上限」——
   看起來像「一直很忙」，而真正該做的是「今天別再測了」。 */
ok(/PerDay\|per day/.test(src), '★ 要分得出「每天」和「每分鐘」');
ok(/quotaId/.test(src), '   把 Google 給的 quotaId 帶出來 —— 那是唯一說得準的證據');
ok(/perDay \? 1800 : 0/.test(src), '★ 每天用完就冷卻久一點 —— 等 60 秒再撞只是浪費剩下的請求');
ok(/function coolDown_\(k, why, secs\)/.test(src), '   冷卻秒數要能分開設');
ok(/等一分鐘沒用/.test(src), '訊息要說得出「等沒有用」，不然老師會一直重試');

/* ★ 2026-08-07 實測拿到的配額代號：
   GenerateRequestsPerDayPerProjectPerModel-FreeTier
   它自己就寫明了是「每專案、每模型、每天」——
   所以 flash 今天用完，不代表今天不能用，只代表 flash 不能用。 */
ok(/dayCapped/.test(src), '每日額度用完要記下來');
ok(/\(overloaded \|\| dayCapped\)/.test(src), '★ 每日用完也要退到備援模型（換模型＝另一份額度）');
ok(/每專案、每模型、每天/.test(src), '   而且要寫清楚為什麼換模型有用');
/* 訊息不可以在最需要判斷的時候騙人 */
ok(!/429 只是塞車/.test(src), '★ 不可以寫死「429 只是塞車」—— 每日用完時那句是錯的');
ok(/403＝那把根本不能用/.test(src), '403 要講「等再久也沒用」');

/* ★ 冷卻多久，Google 自己講了 —— 不要用猜的。
   2026-08-07 實測：訊息裡寫「Please retry in 47.861074189s」，
   但 quotaId 寫著 PerDay，於是我照代號冰了 30 分鐘 ——
   那把金鑰 48 秒後就能用了，被多冰了 29 分鐘。
   代號只是標籤，retryDelay 是可以驗證的事實。 */
ok(/retry in \(\[0-9\.\]\+\)s/.test(src), '★ 要解析 Google 給的等待秒數');
ok(/retryDelay/.test(src), '   結構化的 retryDelay 也收');
ok(/retryS > 0 \? Math\.ceil\(retryS\) \+ 3/.test(src), '★ 有講就照講的冰，不要照代號猜');
ok(/limit:\\s\*\(\\d\+\)/.test(src), '把實際上限抓出來 —— 那決定一堂課撐不撐得住');

/* 新專案不能用舊模型，那是 404 不是金鑰壞掉 */
ok(/function listModels/.test(src), '有「這把金鑰能用哪些模型」的工具');
ok(/no longer available to new users|不能用我們指定的模型/.test(src), '   而且寫下為什麼需要它');
ok(/x-goog-api-key/.test(src.slice(src.indexOf('function listModels'))), '列模型用標頭送金鑰');

console.log('通過 '+pass+'／失敗 '+fail); process.exit(fail?1:0);
