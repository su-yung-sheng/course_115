/**
 * Google Classroom 繳交查詢 Web App（教師端「繳交審核」用）
 * ==========================================================
 * 讓 shared/review.html 讀得到「這份作業誰交了、交了什麼」。
 *
 * ★ 為什麼改用 Apps Script，不用瀏覽器直接呼叫 Classroom API
 *   瀏覽器那條路要在 Google Cloud 建 OAuth 用戶端，對學校的 Workspace 來說
 *   那是一個「第三方應用程式」——2026-08-06 實測直接被擋：
 *     「貴機構的管理員必須先針對這個應用程式進行審查及設定存取權」
 *   只有網域管理員能開，程式端完全無解。
 *
 *   Apps Script 是**老師自己帳號裡的指令碼**，以老師的身分執行，
 *   讀得到的東西和老師自己打開 Classroom 完全一樣，不需要管理員核准。
 *   這個專案本來就有一支 GAS（filebackup.gs），部署方式一模一樣。
 *
 * ★ 回傳裡**沒有姓名、沒有 email**
 *   對應學生是在這支指令碼裡面做完的：email → 學號（qfm{學號}@…）。
 *   姓名前端本來就有（自己的名冊），不需要從 Classroom 再拿一次。
 *   這個 Web App 部署成「任何人都可以存取」，網址一旦外流，
 *   回傳內容就是外流的內容 —— 少回傳一樣東西，就少一樣會外洩的東西。
 *   全班的 email 名單是最不該從這裡出去的。
 *
 * ----------------------------------------------------------
 * 部署步驟（只做一次，約 5 分鐘）
 *
 *   1. script.google.com → 新增專案 → 把這一整份貼上
 *   2. 左側「服務」→ 新增服務 → **Google Classroom API** → 新增
 *   3. 專案設定 → 指令碼屬性 → 新增
 *        名稱：QUERY_KEY
 *        值　：自己想一組通行碼（不要用預設值，也不要放進 GitHub）
 *   4. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *        執行身分　：**我自己**
 *        誰可以存取：**任何人**
 *   5. 第一次部署會要求授權 → 選自己的學校帳號 → 允許
 *   6. 把部署網址填進 config.js 的 CLASSROOM.GAS_URL
 *      通行碼**不要**填進 config.js —— 在審核頁上輸入一次就好（存在瀏覽器裡）
 *
 *   改了程式要重新部署：部署 → 管理部署作業 → 編輯(鉛筆) →
 *   版本選「新版本」→ 部署。用「編輯現有部署」網址才不會變。
 *
 * ----------------------------------------------------------
 * 可以呼叫什麼
 *   ?action=ping                                    確認部署與通行碼
 *   ?action=courses                                 我教的課
 *   ?action=coursework&courseId=…                   這門課的作業
 *   ?action=submissions&courseId=…&courseWorkId=…   這份作業的繳交
 * 全部都要帶 &key=通行碼
 */

// ── 設定區 ───────────────────────────────────────────────

/**
 * 查詢通行碼。設在「專案設定 → 指令碼屬性 → QUERY_KEY」。
 *
 * ⚠️ 這不是加密，是「不知道網址和通行碼的人掃不到」。
 *    ★ 而且**不要**把它寫進 config.js —— 那個 repo 是公開的。
 *      filebackup.gs 的 UPLOAD_KEY 放在 config.js 是因為那支只能「寫入檔案」，
 *      外流的後果有限；這一支讀得到全班的繳交狀況，不一樣。
 *      沒設定時一律拒絕（不像 filebackup 那樣視同不檢查）——
 *      讀取類的端點，寧可一開始就打不通，也不要預設全開。
 */
function queryKey_() {
  return PropertiesService.getScriptProperties().getProperty('QUERY_KEY');
}

/** 學校信箱格式：qfm{7 位學號}@mail.qfm.kh.edu.tw
 *  ⚠️ 這條規則在 shared/auth.js 也有一份（那邊是給前端用的）。
 *     改學校網域時兩邊都要改。 */
var MAIL_PREFIX = 'qfm';
var MAIL_DOMAIN = '@mail.qfm.kh.edu.tw';

// ────────────────────────────────────────────────────────


function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    checkKey_(p.key);
    switch (String(p.action || '')) {
      case 'ping':        return json_({ ok: true, who: Session.getActiveUser().getEmail() });
      case 'courses':     return json_({ ok: true, courses: courses_() });
      case 'coursework':  return json_({ ok: true, courseWork: coursework_(need_(p.courseId, 'courseId')) });
      case 'submissions': return json_({ ok: true, submissions: submissions_(
                                   need_(p.courseId, 'courseId'),
                                   need_(p.courseWorkId, 'courseWorkId')) });
      default:
        throw new Error('不認得的 action：「' + (p.action || '(空的)') + '」。' +
                        '可用的有 ping／courses／coursework／submissions。');
    }
  } catch (err) {
    // 一律回 200＋ok:false：Apps Script 回非 200 時瀏覽器讀不到內容，
    // 前端只會拿到「fetch 失敗」，看不出真正的原因。
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function checkKey_(key) {
  var want = queryKey_();
  if (!want) {
    throw new Error('這支指令碼還沒設定通行碼。請到 Apps Script → 專案設定 → ' +
                    '指令碼屬性，新增 QUERY_KEY，再回審核頁輸入同一組。');
  }
  if (String(key || '') !== want) {
    throw new Error('通行碼不正確。審核頁上輸入的，要和 Apps Script 指令碼屬性的 QUERY_KEY 一致。');
  }
}

function need_(v, name) {
  if (!v) throw new Error('少了參數 ' + name);
  return String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** email → 學號；不是學生帳號就回空字串 */
function sidOf_(email) {
  email = String(email || '').toLowerCase().trim();
  if (email.indexOf(MAIL_PREFIX) !== 0) return '';
  if (email.indexOf(MAIL_DOMAIN) < 0) return '';
  var sid = email.slice(MAIL_PREFIX.length, email.indexOf('@'));
  return /^\d{7}$/.test(sid) ? sid : '';
}

/** 我教的課（只列進行中的） */
function courses_() {
  var out = [], token = null;
  do {
    var r = Classroom.Courses.list({ teacherId: 'me', courseStates: 'ACTIVE', pageSize: 100, pageToken: token });
    (r.courses || []).forEach(function (c) { out.push({ id: c.id, name: c.name }); });
    token = r.nextPageToken;
  } while (token);
  return out;
}

/** 這門課的作業 */
function coursework_(courseId) {
  var out = [], token = null;
  do {
    var r = Classroom.Courses.CourseWork.list(courseId, { pageSize: 100, pageToken: token });
    (r.courseWork || []).forEach(function (w) { out.push({ id: w.id, title: w.title }); });
    token = r.nextPageToken;
  } while (token);
  return out;
}

/** 這門課的學生：Classroom 的 userId → 學號（姓名與 email 不往外送） */
function sidByUser_(courseId) {
  var map = {}, token = null;
  do {
    var r = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: token });
    (r.students || []).forEach(function (s) {
      var sid = sidOf_(s.profile && s.profile.emailAddress);
      if (sid) map[s.userId] = sid;
    });
    token = r.nextPageToken;
  } while (token);
  return map;
}

/**
 * 這份作業的繳交。
 * 回傳只有：學號、狀態、是否遲交、更新時間、附件（標題與連結）。
 */
function submissions_(courseId, courseWorkId) {
  var who = sidByUser_(courseId);
  var out = [], token = null;
  do {
    var r = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseWorkId,
              { pageSize: 100, pageToken: token });
    (r.studentSubmissions || []).forEach(function (s) {
      var sid = who[s.userId];
      if (!sid) return;                       // 不是本校學生帳號（旁聽、老師測試…）就略過
      out.push({
        sid: sid,
        state: s.state || '',
        late: !!s.late,
        updateTime: s.updateTime || '',
        attachments: attachments_(s)
      });
    });
    token = r.nextPageToken;
  } while (token);
  return out;
}

/**
 * 把附件整理成 { kind, title, link }。
 * 四種都可能出現：手機錄影上傳多半是 driveFile，貼 YouTube 則是 youTubeVideo。
 * 認不出來的也要回傳一筆 —— 附件默默消失，老師會以為學生沒交。
 */
function attachments_(sub) {
  var list = (sub.assignmentSubmission && sub.assignmentSubmission.attachments) || [];
  return list.map(function (a) {
    if (a.driveFile)    return { kind: 'drive',   title: a.driveFile.title || '（未命名檔案）', link: a.driveFile.alternateLink || '' };
    if (a.youTubeVideo) return { kind: 'youtube', title: a.youTubeVideo.title || 'YouTube 影片', link: a.youTubeVideo.alternateLink || '' };
    if (a.link)         return { kind: 'link',    title: a.link.title || a.link.url || '連結',   link: a.link.url || '' };
    if (a.form)         return { kind: 'form',    title: a.form.title || '表單',                link: a.form.formUrl || '' };
    return { kind: 'other', title: '（無法辨識的附件）', link: '' };
  });
}


/* ══════════════════════════════════════════════════════════
   在編輯器裡直接執行這一支，可以確認服務與授權都設好了。
   （不必經過網頁，出問題時先跑這個，範圍比較好縮小）
   ══════════════════════════════════════════════════════════ */
function selfTest() {
  var lines = [];
  lines.push('執行身分：' + Session.getActiveUser().getEmail());
  lines.push('通行碼：' + (queryKey_() ? '已設定' : '❌ 還沒設定 QUERY_KEY'));
  try {
    var cs = courses_();
    lines.push('讀得到 ' + cs.length + ' 門課：' + cs.map(function (c) { return c.name; }).join('、'));
    if (cs.length) {
      var ws = coursework_(cs[0].id);
      lines.push('「' + cs[0].name + '」有 ' + ws.length + ' 份作業');
      if (ws.length) {
        var ss = submissions_(cs[0].id, ws[0].id);
        var handed = ss.filter(function (s) { return s.state === 'TURNED_IN'; }).length;
        lines.push('「' + ws[0].title + '」' + ss.length + ' 筆繳交紀錄，其中已繳交 ' + handed + ' 人');
        lines.push('（回傳內容只有學號，沒有姓名與 email）');
      }
    }
  } catch (e) {
    lines.push('❌ 讀取失敗：' + e.message);
    lines.push('　→ 左側「服務」有沒有加入 Google Classroom API？');
    lines.push('　→ 第一次執行有沒有完成授權？');
  }
  Logger.log(lines.join('\n'));
  return lines.join('\n');
}
