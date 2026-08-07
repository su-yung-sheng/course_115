/* aiguide.gs 的通行碼檢查
   跑法：node shared/tests/aiguidekey.test.js

   ★ 為什麼這一小段值得寫測試
     2026-08-07 實際踩到：還沒設 QUERY_KEY 的時候，
     程式回的是「通行碼不正確」—— 因為「有沒有設定」那一行寫在比對之後，
     永遠跑不到。結果是跑去找一個不存在的屬性裡的錯字。
     錯誤訊息把人指向錯的地方，比沒有訊息更浪費時間。 */
'use strict';
const fs=require('fs');
const path=require('path');
/* ⚠️ 這裡原本寫死一條絕對路徑（我開發時那台機器的），
   在老師的電腦上執行會直接找不到檔案。一律用 __dirname 相對定位。 */
const src=fs.readFileSync(path.join(__dirname,'..','aiguide.gs'),'utf8');
const props={}, cache={};
const env={
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v;},remove:k=>{delete cache[k];}})},
 Utilities:{formatDate:()=>'2026-08-07',sleep:()=>{}},
 Logger:{log:()=>{}}, UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>'{}'})},
 ContentService:{createTextOutput:t=>({setMimeType:()=>({__:t}),__:t}),MimeType:{JSON:'json'}},
};
const box={};
new Function('PropertiesService','CacheService','Utilities','Logger','UrlFetchApp','ContentService','module',
 src+'\nmodule.handle_=handle_;')(env.PropertiesService,env.CacheService,env.Utilities,env.Logger,
 env.UrlFetchApp,env.ContentService,box);
const call=k=>JSON.parse(box.handle_({parameter:{action:'ping',key:k}}).__);
let pass=0,fail=0; const ok=(c,l)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+l);};
// ① 完全沒設 QUERY_KEY
ok(/還沒設定 QUERY_KEY/.test(call('abc').error),
   '★ 還沒設 QUERY_KEY 時要這樣講，不是「通行碼不正確」');
// ② 設了，尾端有空白（貼上時最常見）
props['QUERY_KEY']='c115-ai ';
ok(call('c115-ai').ok===undefined||call('c115-ai').error===undefined||call('c115-ai').ok,
   '★ 指令碼屬性尾端多空白也能過（兩邊都 trim）');
// ③ 長度不同
let e=call('c115').error;
ok(/長度不同/.test(e),'長度不同要點出「尾端空白或被網址截掉」');
ok(/7 個字[\s\S]*4 個字/.test(e),'   並且講出兩邊各幾個字：'+e.slice(5,30));
// ④ 長度一樣、內容不同
e=call('c115-AI').error;
ok(/大小寫/.test(e),'長度一樣時要提醒大小寫');
// ⑤ 完全沒帶 key
e=call('').error;
ok(/完全沒收到/.test(e),'沒帶 key 時要講「網址少了 key= 那一段」');
// ⑥ 不洩漏通行碼本身
ok(!/c115-ai/.test(JSON.stringify([call(''),call('x'),call('c115')])),
   '★ 錯誤訊息裡不可以出現通行碼本身');

/* ── 配額：老師的測試台不該被學生的上限鎖住 ─────────
   2026-08-07 實際發生：測試台跑了三輪那 10 題（30 次）就撞到 PER_SID_CAP，
   回「你今天問得夠多了」—— 測到一半被自己的規則鎖住，
   而且那句話是寫給學生看的，老師看了只會以為程式壞了。 */
const iDbg = src.indexOf('var debug = !!dk');
const iCap = src.indexOf("usedToday_() >= num_('DAILY_CAP'");
ok(iDbg > 0 && iCap > 0 && iDbg < iCap,
   '★ 偵錯判定要在配額檢查「之前」—— 順序錯了，放寬就永遠不會生效');
ok(/DEBUG_SID_CAP/.test(src), '偵錯模式有自己的每日上限');
ok(/debug \? num_\('DEBUG_SID_CAP'/.test(src), '   帶了偵錯碼才放寬');

/* ★ 放寬的只有「公平」那一條，不是「額度」那一條。
   DAILY_CAP 顧的是荷包，對誰都一樣 —— 偵錯碼萬一外流，這道還在。 */
const dailyLine = src.slice(iCap - 200, iCap + 200);
ok(!/debug \?/.test(dailyLine.slice(0, 220)) || !/DEBUG_DAILY/.test(src),
   '★ DAILY_CAP 不放寬 —— 那是額度上限，不是公平問題');
ok(/資訊|測試台|resetCaps|調高/.test(src.slice(iCap, iCap + 900)),
   '撞到上限時，老師看到的訊息要說得出「怎麼繼續」');
ok(/function resetCaps/.test(src), '有歸零的方法，不必等到明天');
ok(/usedLab/.test(src) && /labCap/.test(src), '★ ping 要回報測試台自己的用量 —— 撞到才知道有牆是最糟的介面');

/* ★ 不花額度的那一條路，不該被為了省錢而設的規則擋住。
   實測發現的：關鍵概念全中那一則根本不呼叫 Gemini，
   卻排在配額檢查後面 —— 學生全講對了，系統回他「你今天問得夠多了」。
   做對了事卻拿到懲罰，是最糟的一種擋。 */
const iDone = src.indexOf('if (k.done)');
const iCap2 = src.indexOf("usedToday_() >= num_('DAILY_CAP'");
ok(iDone > 0 && iDone < iCap2, '★ 「關鍵概念全中」要排在配額檢查之前');
const iSid2 = src.indexOf('var sid = String(p.student');
ok(iSid2 > 0 && iSid2 < iDone, '   而 sid 要更早 —— 不然那一則的紀錄會少掉學號');

/* ★ 三把金鑰混在輪替裡，壞的那把會被好的掩蓋掉。
   2026-08-07：GEMINI_KEY_2 從頭到尾是 403，整整一天沒發現。 */
ok(/function testKeys/.test(src), '有「一把一把測」的工具');
ok(/x-goog-api-key/.test(src), '★ 標頭那種送法也要試 —— 金鑰限制可能只擋網址參數那種');
ok(/key\.slice\(0, 4\)/.test(src), '只印開頭四碼和長度，不把金鑰寫進執行紀錄');
ok(/前後有空白/.test(src), '前後空白要當場點出來 —— 那用眼睛看不出來');
ok(/cache\.remove\('cool\.'/.test(src), '★ 測之前先清冷卻，不然剛換的金鑰會被上一次的 403 蓋住');
ok(/來源限制/.test(src), '403 要列出常見原因，不能只說「不能用」');

console.log('通過 '+pass+'／失敗 '+fail); process.exit(fail?1:0);
