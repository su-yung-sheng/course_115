# course_115 · 115 學年度資訊科技課程系統

八年級資訊科技闖關學習網站。**一個 repo、一套程式碼，服務上下兩個學期。**

- 上學期 https://su-yung-sheng.github.io/course_115/11501/hub.html
- 下學期 https://su-yung-sheng.github.io/course_115/11502/hub.html
- 總入口 https://su-yung-sheng.github.io/course_115/ （依日期倒數 3 秒後導向，可取消）

---

## 🤖 AI 助教：**本系統預設使用付費 API**

站上有兩處會用到 AI：

| 用途 | 在哪 | 現況 |
|---|---|---|
| **AI 引導**（問題拆解的「問問看」） | `shared/aiguide.gs` | 可切換：**Claude（付費）** 或 Gemini（免費層） |
| **Scratch 作品批改** | Colab 後端 | Gemini（不在這次的切換範圍內） |

### 為什麼預設是付費

免費層實測（2026-08-07）:

```
Quota exceeded ... limit: 20, model: gemini-2.5-flash
```

**一個模型、一個專案、一天 20 次。** 湊三個專案 × 兩個模型也才約 120 次 ——
而一天四節課 × 30 人 = 120 人,**平均每人只有一次**。

那個限制逼出來的設計(每人一天 3 次、三把金鑰輪替、每分鐘節流…)全部留著,
但**它們是為了省額度存在的,不是為了教學**。付費之後這些才回到合理的位置。

> 付費還有一個和額度無關的好處:Gemini 的條款裡,**免費層**的輸入輸出
> 「may be read, annotated and processed by human reviewers」;付費層不會。
> 學生打的字送出去之前,這一點值得知道。

### 設定(Apps Script 的「專案設定 → 指令碼屬性」)

> **所有設定都在指令碼屬性,程式碼裡的值只是「沒設定時的退路」。**
> 換模型、調上限、切供應商 —— 一律改屬性,**不必動程式、不必重新部署**。
>
> ⚠️ 但那個退路會過期(模型名稱是憑記憶填的,而模型會下架)。
> 所以測連線會告訴你「這個模型名稱是你設的,還是程式的預設」——
> 顯示<b>(程式預設,建議設進指令碼屬性)</b>就表示你其實沒設。

```
PROVIDER          claude
CLAUDE_KEY        你的 Anthropic API 金鑰
CLAUDE_MODEL      ⚠️ 不要照抄別人的 —— 在編輯器執行 listClaudeModels 看你這把能用什麼
DAILY_TOKEN_CAP   300000    ← 你的煞車（見下）
PRICE_IN_PER_M    （可省略）到 Anthropic 價目頁抄，填了 costReport 才會估價
PRICE_OUT_PER_M   （可省略）同上
```

⚠️ **金鑰不要進 `config.js`** —— 那個 repo 是公開的。金鑰只在指令碼屬性裡。

### 模型要選哪一個、以後怎麼升級

這個用途要的**不是聰明,是守規矩** —— 學生說「直接告訴我答案」時忍不忍得住。
回的只是一句 60 字的問句,所以**從最小最便宜的那一級開始**(Haiku 這一類),
測過守得住就不必往上加。

**模型名稱一律填「帶日期」的版本,不要用不帶日期的別名。**

| | 別名(`claude-haiku-4-5`) | 帶日期(`claude-haiku-4-5-20251001`) |
|---|---|---|
| 升級 | 自動 | 你自己改 |
| 風險 | **學期中間可能被換掉,而且沒有人會通知你** | 會過期 |

我們選後者。理由是「守得住」是對**某一個特定版本**測出來的 ——
別名讓那個結論隨時可能失效,而你發現的方式會是某天有學生說「AI 跟我講答案了」。

**那過期怎麼辦?** 有兩道:

- 測試台按「測連線」會比對「設定的模型還不在清單裡」,不在就跳紅字
- 編輯器可以執行 `checkModel` 手動查

> ⚠️ 這個檢查只講得出「**找不到**」,不能宣稱「沒問題」——
> 同一天學到的教訓:三把金鑰列出來的清單一模一樣,其中一把呼叫就是 404。
> **列得出來 ≠ 叫得動。**

**升級的流程(當成一件刻意要做的事):**

1. `listClaudeModels` 看有哪些新的
2. 改 `CLAUDE_MODEL`
3. **跑那 10 種刁難** —— 守得住才算數
4. 守不住就改回去(改屬性即可,不必重新部署)

### 「可自行控制額度」是怎麼做的

付費沒有硬上限,所以**上限得自己設**,而且它防的不是學生:

> `DAILY_TOKEN_CAP` 防的是「程式寫錯時,不會把一個月的預算燒在一個晚上」。

- 用 **token** 不用「次數」 —— 付費按 token 計價,用次數當上限遇到長對話就失準,
  而失準的方向是「以為還有很多,其實已經花超過」
- 檢查在**送出之前** —— 送出去才發現超過,錢已經花了
- 在編輯器執行 **`costReport`** 看今天用了多少 token、估計多少錢
- 測試台(`shared/ai-lab.html`)按「測連線」會直接顯示 `token 12345/300000`,
  超過八成變紅字 —— **帳單月底才來,這是唯一的即時回饋**

### 切回免費 Gemini 的操作流程

不想付錢、或付費金鑰出問題時,**改一個屬性就好,不必動程式、不必重新部署**:

```
PROVIDER          gemini
```

第一次用免費層的話,還要做這些(順序有意義):

1. **申請金鑰** —— Google AI Studio。最多三把,**必須是三個不同的 Google 專案**;
   同一個專案發三把等於沒分流(額度按專案算)
2. 指令碼屬性填 `GEMINI_KEY` / `GEMINI_KEY_2` / `GEMINI_KEY_3`
3. **編輯器執行 `testKeys`** —— 一把一把測。⚠️ 三把混在輪替裡,壞的那把會被好的掩蓋掉
   (實測過:有一把整天都是 403,完全沒發現)
4. **編輯器執行 `pickModel`** —— 找出「三把都叫得動」的模型,設進 `MODEL`
   ⚠️ **不要照抄模型名稱**:Google 已不讓新專案使用 `gemini-2.5-flash`,
   而 `listModels` **列得出來的不代表叫得動**
5. **執行 `pickFallback`** —— 再找一個**不同的**模型設進 `FALLBACK_MODEL`
   (額度按「專案 × 模型 × 天」算,備援模型有自己獨立的一份)
6. 把上限調回免費層的數字:`PER_SID_CAP=3`、`DAILY_CAP=130`、`RPM_PER_KEY=10`

> 免費版可用狀態的封存點:**`git tag free-tier-2026-08-07`**
> (`git checkout free-tier-2026-08-07` 就回得去)

### 不管用哪一家,換完都要重跑那 10 種刁難

開 `shared/ai-lab.html` 按「⚡ 一次跑完 10 種刁難」。

> **「叫得動」和「守得住」是兩件事。**
> 2026-08-07 換模型時已經吃過一次:某個模型的測試成績,不能算在另一個頭上。

細節與踩過的坑:`shared/docs/07_手動設定清單.md`。

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
