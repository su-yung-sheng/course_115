# course_115 · 115 學年度資訊科技課程系統

八年級資訊科技闖關學習網站。**一個 repo、一套程式碼，服務上下兩個學期。**

- 上學期 https://su-yung-sheng.github.io/course_115/11501/hub.html
- 下學期 https://su-yung-sheng.github.io/course_115/11502/hub.html
- 總入口 https://su-yung-sheng.github.io/course_115/ （依日期倒數 3 秒後導向，可取消）

---

## 🔑 身分：全面綁定學校 Google 帳號

**2026-08-04 起，全站只有一種登入方式。** 沒有驗證碼、沒有匿名、沒有密碼。

| 誰 | 帳號 |
|---|---|
| 學生 | `qfm` ＋ 7 位學號 ＋ `@mail.qfm.kh.edu.tw` |
| 老師 | `suyungsheng@mail.qfm.kh.edu.tw`（白名單，固定） |

### 為什麼非這樣不可

舊版是「匿名登入 ＋ 學生自訂 6 位數驗證碼」。它有一個**前端怎麼寫都補不起來的洞**：

> 匿名登入下，安全規則**認不出誰是誰**。
> 學生按 F12 就能寫任何人的進度文件 —— 規則只能限制「星星不能變少、一次不能加太多」，
> 那是近似條件，不是身分驗證。

改用學校帳號之後，email 由學號直接組出來，規則就寫得出「只有本人」：

```js
function isOwner(sid) {
  return googleVerified()
      && request.auth.token.email == 'qfm' + sid + '@mail.qfm.kh.edu.tw';
}
```

**不需要任何對照表**，這是這套帳號格式最大的好處。

### 綁定之後連帶解決的

| 舊問題 | 為什麼現在沒了 |
|---|---|
| 驗證碼被旁邊同學看到 | 沒有驗證碼了 |
| 學生互相竄改進度 | `isOwner(sid)` 在**規則層**擋掉 |
| 同一台電腦兩個分頁登入兩個帳號 | Firebase 的登入狀態跨分頁共用，分頁一律跟著它走 |
| 忘記驗證碼要找老師重設 | 沒有這回事了 |
| 後端假裝成匿名學生寫資料庫 | Colab 改用**服務帳戶**，有自己的身分 |

---

## 綁定的四個層面

身分不是只有「登入畫面」一處，四層都要對上，少一層就會出現
「畫面進得去但資料存不了」或「看起來鎖住其實沒鎖」。

### ① Firebase Console

**Authentication → 登入方式：只啟用 Google。**
「匿名」與「電子郵件/密碼」都要**停用** —— 留著就是留一條認不出本人的路。

Google 那一項要填「專案的公開名稱」與「支援電子郵件地址」。
**Authentication → Settings → 授權網域**要有 `su-yung-sheng.github.io` 和 `localhost`。

> ⚠️ 停用之後**沒有任何備援登入方式**。學校 Google 一掛，師生都進不去。
> 這是明確選擇的取捨（學校帳號掛掉時很多事本來也做不了），不是疏漏。

### ② 前端：`shared/auth.js` 是唯一來源

email 怎麼換算成學號、誰是老師，全部只寫在這一支：

```js
AUTH.sidFromEmail('qfm1410500@mail.qfm.kh.edu.tw')  // → '1410500'
AUTH.emailFromSid('1410500')                        // → 'qfm1410500@…'
AUTH.isTeacherEmail(email)                          // → 是不是老師
AUTH.attachSession(auth, signInAnonymously, onAuthStateChanged)
```

`attachSession()` 每一頁進站都要呼叫，它做兩件事：

- **不要蓋掉既有身分** —— Firebase 的登入狀態是整個網域共用的。
  已經用 Google 登入後再跑一次 `signInAnonymously`，會把身分換成匿名的，
  `isOwner()` 立刻失效而且畫面上看不出來。
  也不能只判斷 `auth.currentUser`：頁面剛載入時 Firebase 還在非同步還原，
  它可能暫時是 `null`。要等第一次 `onAuthStateChanged` 回報。
- **身分以 Firebase 為準** —— 別的分頁換人登入時，這個分頁跟著換並重新整理。
  新分頁則直接沿用現有登入，不必再登一次。

> 電腦教室有還原卡，關機即重置，所以「沿用」不會把帳號留給下一位同學。
> 若日後要支援沒有還原機制的共用機器，要加回「這台電腦目前是 XXX，是你嗎？」的確認。

### ③ 安全規則：`shared/firestore.rules`

**規則才是真正的防線**，前端只是提早給提示。進度寫入只剩兩條路：

```
allow create: if isTeacher()
              || (isOwner(sid) && (學期鎖 || isTestAccount(sid)));
```

沒有第三條。`legacyAllowed`、`secret`、`session`、`hasCode`、
以及匿名時代的「動作幅度」防呆（`starsNotReduced` 等）都已刪除 ——
留著只會讓人誤以為還有第二道防線。

### ④ 後端：服務帳戶，不是匿名學生

Colab 用 **服務帳戶**存取 Firestore（金鑰放 Colab Secrets 的 `FIREBASE_SA`）。
服務帳戶不受安全規則限制，所以規則可以為學生收到最緊，
`{學期}-grader` 與 `{學期}-scratch-submissions` 都只有老師。

> 🔐 那把金鑰等於資料庫的完整權限。**不要**放進 repo 資料夾、不要進 git。
> `check.py` 會擋下疑似金鑰的檔案（這件事真的發生過一次）。

---

## 上線／換機器時的檢查順序

順序錯了會出事，尤其是第 2 步在第 3 步之前。

1. **Firebase Console** → Authentication 只啟用 Google；授權網域含 GitHub Pages 網域
2. **Colab** → Secrets 設好 `FIREBASE_SA` → 執行階段**重新啟動** → 從步驟 1 跑到 4
   → `/api/health` 的 `fs_auth_mode` 要是 **`service_account`**
3. **發布 `shared/firestore.rules`**（在第 2 步確認之後才做）
4. **推送前端**
5. 教師端 → 🩺 **狀態檢查** → 五項全綠
6. 用學生帳號實際登入 → 闖一關 → 確認星數有寫進去

**每次上課前**跑 notebook 的步驟 5（OCR）與步驟 6（資料庫存取）——
步驟 6 會一次印出「用哪個帳號、批改標準讀不讀得到、哪幾關已經設定好」。

> ⚠️ `%%writefile` 只是把檔案寫到磁碟，**不會重載已經 import 的模組**。
> 改了 notebook 一定要「重新啟動工作階段」，否則 `/api/health` 的 `version` 不會變。
> 後端出狀況時跑 notebook 的**步驟 6：資料庫存取自我測試**，它會直接印出
> 用哪個帳號、兩學期讀不讀得到、Google 的錯誤原文。

---

## 測試不同學期

| 網址 | 行為 |
|---|---|
| `/course_115/11501/hub.html` | 直接進上學期 |
| `/course_115/11502/hub.html` | 直接進下學期 |
| `/course_115/?term=11501` | 總入口直接導向上學期（可做書籤） |
| `/course_115/?stay` | 停在總入口不自動導向 |
| `/course_115/shared/status.html?term=11502` | 下學期的系統狀態檢查 |

**本機測試**請雙擊 `本機預覽.bat`，它會起 localhost 並列出常用網址。
不要直接雙擊 HTML：`file://` 會讓 Google 登入直接失敗
（`auth/operation-not-supported-in-this-environment`）。

> 進度分學期（`{學期}-progress`），切換測試不會互相污染；
> 名冊 `roster` 是共用的（同一批八年級學生，只需要一份）。

### 學期鎖（已啟用）

| 層 | 檔案 | 擋什麼 |
|---|---|---|
| 前端 | `shared/semester.js`（`LOCK = true`） | 走錯、舊書籤、手動改網址 → 擋畫面並導向當學期 |
| 規則 | `shared/firestore.rules` | 用 `request.time`（伺服器時間）限制寫入期間，**改前端繞不過** |

```js
{ term: '11501', name: '上學期', start: '2026-08-01', end: '2027-01-31' },
{ term: '11502', name: '下學期', start: '2027-02-01', end: '2027-07-31' }
```

- **學年開始前**算上學期（準備期），**學年結束後**算下學期
- **老師不受限** —— `teacher.html` 不載入 `semester.js`，規則也放行 `isTeacher()`
- **測試帳號不受限** —— `TEST_IDS`，開學前就能驗下學期

> ⚠️ `TEST_IDS` 在 `semester.js` 與 `firestore.rules` **各有一份**（規則沒辦法載入 JS）。
> 只改一邊會出現「畫面進得去但進度存不了」，所以 `check.py` 會比對兩邊，不一致就擋下提交。
> **記得把 `1400000` 換成你自己的測試學號。**

---

## 資料夾結構

```
course_115/
├── index.html            總入口，依日期導向該學期
├── shared/            ★  共用檔，全站只有這一份
│   ├── auth.js              ★ 身分：email ↔ 學號、分頁 session
│   ├── guard.js sso.js      未登入導回 hub、各頁沿用身分
│   ├── grading.js           計分與「依序開放」規則
│   ├── quiz-engine.js quiz-firebase.js       章節測驗引擎
│   ├── grader.html          Scratch 自評站（?term= 決定學期）
│   ├── status.html          系統狀態檢查
│   ├── backend.ipynb filebackup.gs firestore.rules
│   ├── check.py  hooks/pre-commit
│   └── docs/          ★  全部文件在這裡
├── 11501/                上學期
│   ├── config.js            這學期的設定（唯一該學期專屬的程式檔）
│   ├── content/             這學期教什麼（章節、題庫）
│   └── hub.html teacher.html ...
├── 11502/                下學期，結構完全對稱
└── _archive/             已停止維護的舊文件
```

**兩個學期資料夾的結構是一樣的**，差別只在 `config.js` 與 `content/`。

---

## 為什麼是一個 repo

上下學期的程式碼曾經是兩份 fork，結果就是持續漂移 ——
`guard.js` 兩邊一字不差、`firestore.rules` 完全相同，卻要改兩次、漏一次就對不起來。

現在 `shared/` 只有一份，兩個學期用 `../shared/xxx.js` 直接引用。
**沒有副本，就不會有「忘記同步」這回事。**

---

## 文件

全部在 [`shared/docs/`](shared/docs/)：

| 主題 | 檔案 |
|---|---|
| 總覽 · 從哪裡看起 | [README](shared/docs/README.md) |
| 系統架構 | [01](shared/docs/01_系統架構.md) |
| 設計規範（新增頁面照這份做） | [02](shared/docs/02_設計規範.md) |
| 資料格式規格（Firestore 合約） | [03](shared/docs/03_資料格式規格.md) |
| 後端與資料庫（Firestore／GAS／Colab） | [04](shared/docs/04_後端與資料庫.md) |
| 安全性（擋得住什麼、擋不住什麼） | [05](shared/docs/05_安全性.md) |
| 上線檢查表 | [06](shared/docs/06_上線檢查表.md) |
| **手動設定清單**（程式幫不了的那些步驟） | [07](shared/docs/07_手動設定清單.md) |

---

## 換電腦或重新 clone 之後

```
雙擊 安裝檢查掛鉤.bat
```

git hook 住在 `.git/hooks/`，不會被版控。裝好之後用 GitHub Desktop 按 Commit
就會自動跑 `shared/check.py`，沒過不讓提交。它擋的包括：

空檔、HTML 結構壞掉、JS 語法錯誤、死連結（含大小寫不符）、
**疑似私密金鑰**、舊檔名前綴殘留、`HUB_PAGE` 沒設定、
兩學期 `TERM_START` 相同、`TEST_IDS` 兩邊不一致。

> ⚠️ 這個 repo **不要用 `git add -A`**。曾經因此把一把服務帳戶私鑰
> 提交並推上公開 repo（已作廢重發）。請明確列出要提交的檔案。
