/* =====================================================================
   shared/classroom.js 的測試（純資料處理的部分）
   ---------------------------------------------------------------------
       node shared/tests/classroom.test.js

   OAuth 那段沒辦法在這裡測（要真的跳 Google 同意畫面），
   但**錯誤訊息**測得到 —— 而那是最常出問題也最容易寫爛的地方：
   老師看到的如果只是一串 error code，他不會知道要去哪裡改設定。
   ===================================================================== */
'use strict';
const path = require('path');
global.window={}; global.document={createElement:()=>({}),head:{appendChild(){}}};
require(path.resolve(__dirname, '..', 'classroom.js'));
const C=window.CLASSROOM;
let p=0,f=0;const is=(g,w,l)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?p++:f++;
 console.log((ok?'  ✅ ':'  ❌ ')+l+(ok?'':'\n       期望 '+JSON.stringify(w)+'\n       實得 '+JSON.stringify(g)))};

console.log('── 只要唯讀權限，而且不碰 Drive ──');
is(/drive/.test(C.SCOPES),false,'★ 沒有要 Drive 權限（附件用 Classroom 給的連結開）');
is(C.SCOPES.split(' ').every(s=>/readonly$|profile\.emails$/.test(s)),true,'每一項都是唯讀');
is(C.SCOPES.split(' ').length,4,'只要四項');

console.log('\n── 一筆繳交整理成審核頁要的樣子 ──');
const rost={ u1:{email:'QFM1410500@mail.qfm.kh.edu.tw',name:'王小明'} };
const row=C.normalize({id:'s1',userId:'u1',state:'TURNED_IN',late:true,updateTime:'2026-09-01T01:00:00Z',
 assignmentSubmission:{attachments:[
   {driveFile:{title:'流程圖.png',alternateLink:'https://drive.google.com/file/d/AAA/view'}},
   {youTubeVideo:{title:'我的執行過程',alternateLink:'https://youtu.be/BBB'}},
   {link:{url:'https://example.com',title:'參考'}},
   {}
 ]}},rost);
is(row.email,'qfm1410500@mail.qfm.kh.edu.tw','email 轉小寫（等一下要對回學號）');
is(row.name,'王小明','名字取得到');
is(row.late,true,'遲交要看得出來');
is(row.attachments.map(a=>a.kind),['drive','youtube','link','other'],'四種附件都認得');
is(row.attachments[0].link,'https://drive.google.com/file/d/AAA/view','Drive 附件帶著可以直接點開的連結');
is(row.attachments[3].title,'（無法辨識的附件）','認不出來的也要顯示，不能默默消失');

console.log('\n── 交了沒 ──');
is(C.handedIn(row),true,'已繳交＋有附件 → 算交了');
is(C.handedIn({state:'TURNED_IN',attachments:[]}),false,'按了繳交但沒附件 → 不算');
is(C.handedIn({state:'CREATED',attachments:[{}]}),false,'附件放上去但沒按繳交 → 不算');

console.log('\n── 圖片／影片只是「看起來」，最後仍要老師確認 ──');
is(C.guessKind({title:'流程圖.png'}),'image','png → 圖片');
is(C.guessKind({title:'錄影 2026.MP4'}),'video','大寫副檔名也認得');
is(C.guessKind({kind:'youtube',title:'x'}),'video','YouTube → 影片');
is(C.guessKind({title:'我的作業'}),'unknown','★ 看不出來就說看不出來，不亂猜');

console.log('\n── 授權失敗要講得出下一步 ──');
const say=t=>C._explainAuthError({type:t});
is(/彈出視窗/.test(say('popup_closed')),true,'視窗被擋 → 叫他允許彈出視窗');
is(/管理員|允許清單/.test(say('admin_policy_enforced')),true,'學校擋掉 → 說要找管理員，並提到還有手動模式');
is(/JavaScript 來源/.test(say('invalid_client')),true,'用戶端設定錯 → 指出要檢查哪一個欄位');
is(/手動/.test(say('weird_error')),true,'不認得的錯誤 → 至少告訴他還能手動審核');

console.log('\n── 兩個最容易卡死的設定錯誤，訊息要能直接照做 ──');
C.init('85509938573-abc123.apps.googleusercontent.com');
is(C.projectNumber(),'85509938573','從用戶端 ID 取得專案編號');
is(C.enableApiUrl(),
   'https://console.cloud.google.com/apis/library/classroom.googleapis.com?project=85509938573',
   '★ 啟用 API 的連結直接指到正確的專案（老師常有好幾個專案，說錯會繼續卡住）');
const a=say('access_not_configured');
is(/沒有啟用 Classroom API/.test(a),true,'400 access_not_configured → 說是「API 沒啟用」');
is(a.includes('project=85509938573'),true,'　並附上可以直接點的連結');

const b=say('admin_policy_enforced');
is(/管理第三方應用程式存取權/.test(b),true,'學校擋掉 → 給出管理控制台的完整路徑');
is(b.includes('85509938573-abc123.apps.googleusercontent.com'),true,'　並附上要加進允許清單的用戶端 ID');
is(/唯讀/.test(b)&&/不含 Drive/.test(b),true,'　說明要哪些權限（管理員一定會問）');
is(/仍然可以正常使用/.test(b),true,'★ 並告訴老師「在核准之前照樣能上課」—— 不然會以為整個功能廢了');

console.log('\n通過 '+p+'／失敗 '+f); process.exit(f?1:0);
