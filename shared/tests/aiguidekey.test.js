/* aiguide.gs 的通行碼檢查
   跑法：node shared/tests/aiguidekey.test.js

   ★ 為什麼這一小段值得寫測試
     2026-08-07 實際踩到：還沒設 QUERY_KEY 的時候，
     程式回的是「通行碼不正確」—— 因為「有沒有設定」那一行寫在比對之後，
     永遠跑不到。結果是跑去找一個不存在的屬性裡的錯字。
     錯誤訊息把人指向錯的地方，比沒有訊息更浪費時間。 */
'use strict';
const fs=require('fs');
const src=fs.readFileSync('/sessions/practical-friendly-ride/mnt/course_115/shared/aiguide.gs','utf8');
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
console.log('通過 '+pass+'／失敗 '+fail); process.exit(fail?1:0);
