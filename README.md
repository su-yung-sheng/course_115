# course_115 · 115 學年度資訊科技課程系統

八年級資訊科技闖關學習網站。**一個 repo、一套程式碼，服務上下兩個學期。**

- 上學期 https://su-yung-sheng.github.io/course_115/11501/hub.html
- 下學期 https://su-yung-sheng.github.io/course_115/11502/hub.html
- 總入口 https://su-yung-sheng.github.io/course_115/ （依日期倒數 3 秒後導向，可取消）

### 測試不同學期

學期資料夾的網址是固定的，直接開就好；總入口另外支援兩個參數：

| 網址 | 行為 |
|---|---|
| `/course_115/11501/hub.html` | 直接進上學期 |
| `/course_115/11502/hub.html` | 直接進下學期 |
| `/course_115/?term=11501` | 總入口直接導向上學期（可做書籤） |
| `/course_115/?stay` | 停在總入口不自動導向，自己選 |
| `/course_115/shared/status.html?term=11502` | 下學期的系統狀態檢查 |

> 學生的進度是分學期的（`{學期}-progress`），所以在兩個學期之間切換測試不會互相污染；
> 名冊與驗證碼則是共用的（`roster` / `secret`），同一組帳號兩邊都能登入。

### 開學後鎖住學期

`shared/semester.js` 開頭有一個開關：

```js
var LOCK = false;        // ← 開學前改成 true 就會生效
```

改成 `true` 之後，學生開到非當學期的頁面會被擋下並導向當學期，
**不可能在下學期去累積上學期的星星**。學期界線也定義在同一支裡：

```js
{ term: '11501', name: '上學期', start: '2026-08-01', end: '2027-01-31' },
{ term: '11502', name: '下學期', start: '2027-02-01', end: '2027-07-31' }
```

不受鎖影響：**教師端**（`teacher.html` 刻意不載入 `semester.js`，老師要能隨時查另一學期）、
狀態檢查、轉換工具。

> ⚠️ 這是前端的鎖，擋的是「學生不小心走錯」。
> 懂得改網址或用開發者工具的人繞得過去 —— 要真正擋住得在 Firestore 規則加日期條件，
> 見 [`shared/docs/05_安全性.md`](shared/docs/05_安全性.md)。

---

## 資料夾結構

```
course_115/
├── index.html            總入口，依月份導向該學期
├── shared/            ★  共用檔，全站只有這一份
│   ├── guard.js sso.js grading.js report.js theme.css
│   ├── quiz-engine.js quiz-firebase.js       章節測驗引擎
│   ├── status.html template.html migrate.html
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

---

## 換電腦或重新 clone 之後

```
雙擊 安裝檢查掛鉤.bat
```

git hook 住在 `.git/hooks/`，不會被版控。裝好之後用 GitHub Desktop 按 Commit
就會自動跑 `shared/check.py`，沒過不讓提交。
