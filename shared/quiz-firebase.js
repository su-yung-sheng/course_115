/* =====================================================================
   章節測驗引擎 · 資料庫接線
   ---------------------------------------------------------------------
   把 Firebase 的細節全部關在這一支，quiz-engine.js 完全不碰 Firestore。
   兩學期共用；集合名稱一律由 config.js 決定，這裡不寫死任何學期編號。

   載入順序（頁面外殼）：
     content/xxx.js  →  shared/quiz-engine.js  →  shared/quiz-firebase.js（本檔）

   ★ 2026-07-29：闖關紀錄不再另存 quiz_records 集合。
     學生的每次通關本來就會寫進 {學期}-progress 的 history，
     證書需要的耗時／答對題數改由 REPORT.unit 的 extra 一起寫進去。
     少一個集合、少一套安全規則、也不用再自動刪舊紀錄。

   ★ 這裡就是正本，改這裡就好（2026-07 併成單一 repo 之後同步機制已移除）。
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const C = window.QUIZ_CONTENT;
if (!C || !window.QUIZ) {
  console.error('[quiz-firebase] 引擎尚未就緒，請確認載入順序');
}

// Firebase 設定集中在 config.js（全站同一組 appId，各頁不再自行覆蓋）
const firebaseConfig = window.CONFIG.FIREBASE;

let db = null, auth = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);

  // 進度回報：把 Firestore 函式交給共用模組（hub 亮燈、history 都靠這個）
  if (window.REPORT) REPORT.configure({ db, doc, getDoc, setDoc, arrayUnion });

  signInAnonymously(auth).catch(e => console.error('Firebase Auth Error', e));

  onAuthStateChanged(auth, (u) => {
    if (!u) return;
    // 身分：優先用闖關基地的快取，沒有才回名冊補讀
    if (!QUIZ.isIdentified()) resolveIdentity();
    else QUIZ.refreshBadges();
  });
} catch (e) {
  console.error('Firebase Setup Error', e);
}

async function resolveIdentity() {
  if (!window.SSO) return;
  const who = await SSO.resolve(async (sid) => {
    const snap = await getDoc(doc(db, SSO.ROSTER, sid));
    return snap.exists() ? snap.data() : null;
  });
  if (!who) { QUIZ.failIdentity(); return; }
  QUIZ.setUser(who);
}
