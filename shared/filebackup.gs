/**
 * 115 學年度 課程檔案備份 Web App（上下學期共用一支）
 * ==========================================================
 * 同時服務兩種上傳：
 *   ① 運算思維通關截圖（.png）
 *   ② 程式設計作品（.sb3）  ← AI 批改 2⭐ 以上才會上傳
 *
 * 資料夾規則（單一根資料夾，兩學期、兩種檔案全部走同一套）
 *
 *     <根> / 學期 / 單元 / 班級 / 座號 / 檔名
 *
 *   截圖： <根>/11501/thinking/801/05/03.png
 *   作品： <根>/11501/scratch/801/05/03.sb3
 *
 *   ※ 舊版是「截圖一個根、作品一個根」，各自少一層「單元」，
 *     所以必須各開一支 Apps Script 專案、TERM 還得寫死。
 *     多包一層單元之後，一支部署就能服務兩學期兩種檔案。
 *   ※ 每人每關只保留一份；前端只有在「分數比上次高」時才重傳覆蓋。
 *
 * 學期怎麼決定
 *   由前端請求帶 term（對應 window.CONFIG.TERM），但**只接受白名單內的值**。
 *   前端漏傳或亂傳都會被擋下來並回報錯誤，不會靜悄悄寫進別的學期。
 *
 * 部署方式（改完一定要重新部署，網址才會生效）
 *   部署 → 管理部署作業 → 編輯(鉛筆) → 版本選「新版本」 → 部署
 *   （用「編輯現有部署」網址才不會變，前端就不用改）
 *   執行身分：我自己　／　誰可以存取：任何人
 *
 *   ★ 兩學期共用同一個部署網址：course_11501 與 course_11502 的
 *     config.js 裡 GAS_UPLOAD_URL 填同一個值。
 *
 * ★ 這裡就是正本，改這裡就好（2026-07 併成單一 repo 之後同步機制已移除）。
 */

// ── 設定區 ───────────────────────────────────────────────
// 單一根資料夾（Drive 資料夾 ID，取自資料夾網址最後那一段）
var ROOT_ID = "18q52AVJp3qWGOrqmWp0EKlmIT9mVzv3u";

// 允許寫入的學期：不在名單內一律拒絕
var ALLOWED_TERMS = ["11501", "11502"];

// 上傳通行碼：前端每次請求要帶 key，對不上就拒絕。
//   設定位置：Apps Script 編輯器 → 專案設定 → 指令碼屬性 → 新增 UPLOAD_KEY
//   前端對應：config.js 的 GAS_UPLOAD_KEY
//
//   ⚠️ 這不是「加密」。前端的 key 學生按 F12 就看得到，
//      它擋的是「不知道網址與 key 的外人隨機掃描」，不是擋你的學生。
//      沒設定指令碼屬性時視同不檢查（方便你先部署再補設定）。
var UPLOAD_KEY = PropertiesService.getScriptProperties().getProperty("UPLOAD_KEY");

// 單檔大小上限（MB）：擋掉誤傳大檔或惡意灌爆雲端硬碟
var MAX_MB = 15;

// 單元代號 → 資料夾名稱（前端傳 kind，這裡決定落在哪一層）
var UNIT_FOLDER = {
  screenshot: "thinking",   // 運算思維通關截圖
  sb3:        "scratch"     // 程式設計作品
};

var SEAT_DIGITS = 2;        // 座號補零位數：5 → "05"
var MAX_SEAT    = 35;       // 預建座號資料夾時的最大座號
var CLASSES     = ["801","802","803","804","805","806","807","808","809","810","811","812"];
// ────────────────────────────────────────────────────────


/** 取得子資料夾；沒有就建立 */
function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** 座號 / 關卡編號補零：5 → "05" */
function pad2(v) {
  var s = String(v).replace(/[^0-9]/g, "");
  while (s.length < SEAT_DIGITS) s = "0" + s;
  return s;
}

/** 通行碼檢查：沒設定指令碼屬性就跳過（部署初期方便），設了就一定要對 */
function checkKey(key) {
  if (!UPLOAD_KEY) return;                 // 尚未設定 → 不檢查
  if (String(key || "") !== UPLOAD_KEY) {
    throw new Error("通行碼不正確。請確認 config.js 的 GAS_UPLOAD_KEY " +
                    "與 Apps Script 指令碼屬性的 UPLOAD_KEY 一致。");
  }
}

/** 檔案大小檢查：base64 長度約為原始位元組的 4/3 */
function checkSize(base64) {
  var bytes = String(base64 || "").length * 3 / 4;
  var mb = bytes / 1024 / 1024;
  if (mb > MAX_MB) {
    throw new Error("檔案太大（約 " + mb.toFixed(1) + " MB），上限 " + MAX_MB + " MB。");
  }
}

/** 學期白名單檢查：不合法就丟例外，由 doPost 統一回報 */
function checkTerm(term) {
  var t = String(term || "");
  if (ALLOWED_TERMS.indexOf(t) === -1) {
    throw new Error("學期參數不合法：「" + t + "」。" +
                    "前端請帶 window.CONFIG.TERM，目前允許 " + ALLOWED_TERMS.join(" / "));
  }
  return t;
}

/** 依規則走到 <根>/學期/單元/班級/座號，沿路沒有就建立 */
function seatFolder(term, unit, classRoom, seatNo) {
  var f = DriveApp.getFolderById(ROOT_ID);
  f = getOrCreateFolder(f, term);        // 學期 → 11501
  f = getOrCreateFolder(f, unit);        // 單元 → thinking / scratch
  f = getOrCreateFolder(f, classRoom);   // 班級 → 801
  f = getOrCreateFolder(f, seatNo);      // 座號 → 05
  return f;
}

/** 同名舊檔先丟垃圾桶，確保每人每關只留一份 */
function replaceFile(folder, fileName, base64, mimeType) {
  var olds = folder.getFilesByName(fileName);
  while (olds.hasNext()) olds.next().setTrashed(true);
  var blob = Utilities.newBlob(Utilities.base64Decode(base64),
                               mimeType || "application/octet-stream", fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}


/* ══════════════════════════════════════════════════════════════
   暫存區：<根>/11501/20260903/1410700-滑梯公園 - Google Chrome ….png
   ══════════════════════════════════════════════════════════════
   ⚠️⚠️ 2026-09-03 老師提的架構：截圖先進雲端暫存區，後端再慢慢取來辨識。
   ★ 這樣工作就**脫離 Colab 的生命週期** —— 目前圖片放在 Colab 記憶體，
     一重啟或被回收，排隊中的全丟。放雲端之後，下課了也跑得完。
   ★ 而且它同時解決了稽核：每一張都在，不只通過的那些。
   ⚠️ 檔名直接用學生上傳的原檔名（前面加學號），因為關卡資訊就在裡面 ——
      2026-09-03 起判定就是靠它。
   ⚠️ 路徑用日期分層，一天一個資料夾，好清也好找。 */
function tempFolder(term, day) {
  var root = DriveApp.getFolderById(ROOT_ID);
  return getOrCreateFolder(getOrCreateFolder(root, term), day);
}

/* ⚠️ 檔名要擋掉路徑穿越：Drive 不會真的建子目錄，但 "../" 這種東西
   出現在檔名裡只會讓之後很難找。順便擋掉控制字元。 */
function safeName(name) {
  var n = String(name || "").replace(/[\/\\]/g, "_").replace(/[\x00-\x1f]/g, "");
  n = n.replace(/\.\./g, "_");
  return n.slice(0, 180) || "unnamed.png";
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    /* ── 暫存區：存一張待處理的截圖 ────────────────── */
    if (data.kind === "temp") {
      checkKey(data.key);
      checkSize(data.base64);
      var t2  = checkTerm(data.term);
      var day = String(data.day || "").replace(/\D/g, "");
      if (day.length !== 8) {
        day = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
      }
      var fn = safeName(data.fileName);
      var f2 = replaceFile(tempFolder(t2, day), fn,
                           data.base64, data.mimeType || "image/png");
      return json({ success: true, term: t2, day: day,
                    fileId: f2.getId(), fileName: fn,
                    path: [t2, day, fn].join("/") });
    }

    /* ── 暫存區：列出待處理的（後端輪詢用）──────────
       ⚠️⚠️ **這一支不可以給前端輪詢**。Apps Script 每天只有約 90 分鐘
          執行時間，30 人每 5 秒問一次會在一分鐘內燒光額度。
          ⇒ 只有後端呼叫（幾秒一次），前端要看排隊清單是問後端的記憶體快取。
       ★ 回傳的順序＝建立時間，所以「先傳的先處理」天然成立。 */
    if (data.kind === "temp_list") {
      checkKey(data.key);
      var t3  = checkTerm(data.term);
      var d3  = String(data.day || "").replace(/\D/g, "");
      if (d3.length !== 8) {
        d3 = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
      }
      var it = tempFolder(t3, d3).getFiles();
      var list = [];
      while (it.hasNext() && list.length < 200) {
        var f3 = it.next();
        list.push({
          id: f3.getId(),
          name: f3.getName(),
          size: f3.getSize(),
          at: f3.getDateCreated().getTime()
        });
      }
      list.sort(function (a, b) { return a.at - b.at; });   // 先傳的先處理
      return json({ success: true, term: t3, day: d3, files: list });
    }

    /* ── 暫存區：處理完就刪掉 ──────────────────────
       ⚠️ 用 setTrashed 而不是永久刪除：萬一刪錯，垃圾桶還撈得回來。 */
    if (data.kind === "temp_delete") {
      checkKey(data.key);
      DriveApp.getFileById(String(data.fileId)).setTrashed(true);
      return json({ success: true, deleted: String(data.fileId) });
    }

    var kind = data.kind || "screenshot";          // "screenshot"（預設）或 "sb3"
    var unit = UNIT_FOLDER[kind];
    if (!unit) throw new Error("不認得的上傳種類：" + kind);

    checkKey(data.key);                            // ★ 通行碼
    checkSize(data.base64);                        // ★ 檔案大小
    var term      = checkTerm(data.term);          // ★ 學期由請求帶，但要過白名單
    var classRoom = String(data.classRoom || "未分班");
    var seatNo    = pad2(data.seatNo);
    var folder    = seatFolder(term, unit, classRoom, seatNo);

    // 檔名：作品用關卡編號、截圖用關卡代號
    var fileName, mime, url;
    if (kind === "sb3") {
      fileName = (data.unitNo ? pad2(data.unitNo) : String(data.unit || "00")) + ".sb3";
      mime     = "application/octet-stream";
    } else {
      fileName = String(data.challengeId) + ".png";
      mime     = data.mimeType || "image/png";
    }

    var file = replaceFile(folder, fileName, data.base64, mime);
    url = (kind === "sb3")
        ? "https://drive.google.com/file/d/" + file.getId() + "/view"
        : "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";

    return json({
      success: true,
      term: term,
      unit: unit,
      url: url,
      path: [term, unit, classRoom, seatNo, fileName].join("/"),
      score: (data.score === undefined ? null : data.score)
    });

  } catch (error) {
    return json({ success: false, message: error.toString() });
  }
}


function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2))
                       .setMimeType(ContentService.MimeType.JSON);
}

/** 處理 CORS 預檢請求 */
function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}


/**
 * 【診斷用】用瀏覽器直接打開部署網址，就會看到這支腳本「實際會寫到哪裡」。
 *   ‧ 打不開或看到別的東西 → 部署的不是這一份，或沒有選「新版本」重新部署
 *   ‧ 打得開但資料夾名稱不對 → 上面設定區的 ROOT_ID 要換
 */
function doGet(e) {
  /* ⚠️⚠️ 2026-09-03 加 features：**用來分辨「這個部署是新的還是舊的」**。
     Apps Script 服務的是「已部署的版本」，不是你存檔的程式碼 ——
     改完沒有重新部署（版本選「新版本」），網址服務的還是舊的。
     ★ 那天的症狀：學生上傳成功，後端卻一直
       `[GAS] temp_list 回報失敗：不認得的上傳種類：temp_list`。
       那句是最後那個泛用處理器丟的，等於在說「我沒有 temp_list 這個分支」。
     ⚠️ 以前要靠這種間接推理才知道部署是舊的。現在用瀏覽器打開網址，
       看 features 有沒有 temp 那三個就好 —— 兩邊網址各貼一次，
       一眼就知道是不是同一份。 */
  var out = { script: "filebackup（兩學期共用）", allowedTerms: ALLOWED_TERMS, keyRequired: !!UPLOAD_KEY, maxMB: MAX_MB, ok: true,
              features: ["screenshot", "sb3", "temp", "temp_list", "temp_delete"] };
  try {
    var root = DriveApp.getFolderById(ROOT_ID);
    out.rootId   = ROOT_ID;
    out.rootName = root.getName();
    out.rootUrl  = root.getUrl();
    out.writesTo = root.getName() + "/{學期}/{單元}/{班級}/{座號}/{檔名}";
    out.terms = {};
    ALLOWED_TERMS.forEach(function (t) {
      var tf = getOrCreateFolder(root, t);
      out.terms[t] = {
        thinking: getOrCreateFolder(tf, "thinking").getUrl(),
        scratch:  getOrCreateFolder(tf, "scratch").getUrl()
      };
    });
  } catch (err) {
    out.ok = false;
    out.error = String(err);
    out.hint = "ROOT_ID 可能不正確，或這個帳號沒有權限存取該資料夾。";
  }
  return json(out);
}


/**
 * 【手動執行 · 選用】把指定學期所有班級的座號資料夾先建好（01 ~ MAX_SEAT）。
 * 不執行也沒關係，學生第一次上傳時會自動建立自己的座號資料夾。
 *
 *   createAllSeatFolders("11501")
 */
function createAllSeatFolders(term) {
  term = checkTerm(term);
  var made = 0;
  var root = DriveApp.getFolderById(ROOT_ID);
  var tf   = getOrCreateFolder(root, term);

  ["thinking", "scratch"].forEach(function (unit) {
    var uf = getOrCreateFolder(tf, unit);
    CLASSES.forEach(function (c) {
      var cls = getOrCreateFolder(uf, c);
      for (var i = 1; i <= MAX_SEAT; i++) {
        var seat = pad2(i);
        if (!cls.getFoldersByName(seat).hasNext()) { cls.createFolder(seat); made++; }
      }
    });
  });
  Logger.log("完成：在 " + term + " 底下新建 " + made + " 個座號資料夾");
}


/**
 * 【手動執行 · 自我檢查】確認根資料夾看得到、兩學期資料夾都建得起來。
 * 上課前跑一次，比等學生上傳失敗才發現好。
 */
function checkFolders() {
  var root = DriveApp.getFolderById(ROOT_ID);
  Logger.log("✅ 根資料夾：" + root.getName() + "　" + root.getUrl());
  ALLOWED_TERMS.forEach(function (t) {
    var tf = getOrCreateFolder(root, t);
    Logger.log("  " + t + "/thinking → " + getOrCreateFolder(tf, "thinking").getUrl());
    Logger.log("  " + t + "/scratch  → " + getOrCreateFolder(tf, "scratch").getUrl());
  });
}
