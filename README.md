# course_115 · 115 學年度資訊科技課程系統（共用原始碼）

八年級資訊科技闖關學習網站。**一套程式碼服務上下兩個學期。**

這個 repo 管的是「共用原始碼」與工具；**實際部署的網站是另外兩個 repo**。

---

## 三個 repo 的關係

| repo | 內容 | 網站 |
|---|---|---|
| **course_115**（這裡） | `_shared/` 共用原始碼、同步與工具腳本、文件 | — |
| [course_11501](https://github.com/su-yung-sheng/course_11501) | 上學期網站 | https://su-yung-sheng.github.io/course_11501/ |
| [course_11502](https://github.com/su-yung-sheng/course_11502) | 下學期網站 | https://su-yung-sheng.github.io/course_11502/ |

本機的資料夾長這樣（三個 repo 是平行的，不是巢狀）：

```
course_115\                    ← 這個 repo
├── _shared\                   ★ 唯一可以編輯的共用原始碼
│   └── docs\                  ★ 全部文件在這裡
├── sync_shared.py                把 _shared/ 複製進兩個網站 repo
├── 安裝檢查掛鉤.bat               裝 git hook，提交前自動檢查
├── 開啟轉換工具.bat               一次性的名冊轉換工具
├── _archive\                     已停止維護的舊文件
├── course_11501\              ← 另一個 repo（本 repo 不追蹤）
└── course_11502\              ← 另一個 repo（本 repo 不追蹤）
```

---

## 最重要的一條規則

**改共用檔請改 `_shared/`，改完執行 `python sync_shared.py`。**

各網站 repo 裡的 `shared/` 都是同步產生的副本。直接改副本會在下次同步時被蓋掉，
而且提交時會被 git hook 擋下來。

---

## 文件

全部在 [`_shared/docs/`](_shared/docs/)：

| 主題 | 檔案 |
|---|---|
| 總覽 · 從哪裡看起 | [README](_shared/docs/README.md) |
| 系統架構 | [01](_shared/docs/01_系統架構.md) |
| 設計規範（新增頁面照這份做） | [02](_shared/docs/02_設計規範.md) |
| 資料格式規格（Firestore 合約） | [03](_shared/docs/03_資料格式規格.md) |
| 後端與資料庫（Firestore／GAS／Colab） | [04](_shared/docs/04_後端與資料庫.md) |
| 安全性（擋得住什麼、擋不住什麼） | [05](_shared/docs/05_安全性.md) |
| 上線檢查表 | [06](_shared/docs/06_上線檢查表.md) |

---

## 第一次在新電腦設定

```
1. clone 三個 repo，course_11501 與 course_11502 放進 course_115\ 底下
2. 雙擊 安裝檢查掛鉤.bat        （git hook 不會被版控，換機器要重裝）
3. python sync_shared.py       確認共用檔一致
```
