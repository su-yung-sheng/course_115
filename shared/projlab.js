/* =====================================================================
   第五節「自己的專案」— 兩種模式展示 ＋ 成果發表
   ---------------------------------------------------------------------
   ★ 老師 2026-08-25：
     「第五課不用『動手檢核』」
     「任務卡改成之前提到的互動介面，當成複習」
     「設計成系統的兩種模式展示，學生的作品可以有兩種選擇」
     「成果發表要變成一份文件以供截圖下載，還是能下載成 PDF 更方便」

   ⚠️⚠️ 所以這一支**不判定學生做出來了沒**（電腦看不到硬體），
      也不是關卡。它做兩件事：
        ① 兩種模式的互動展示 —— 把前四節的東西一次複習過
             自動：超音波接管（近了就亮、就轉）
             手動：旋鈕接管（自己調顏色、調轉速）
           ★ 學生的作品**挑一種做就好**，不必兩種都做，
             也不必做「切換」—— 教具上沒有按鈕。
        ② 成果發表：三句話 → 一張帶得走的成果卡

   ⚠️ 成果卡不用 jsPDF 那一類的函式庫 —— 它們預設不含中文字型，
      印出來會是一整排豆腐字。改用兩條零相依的路：
        ① 瀏覽器原生列印（另存 PDF）—— 中文一定正確
        ② canvas 自己畫成 PNG —— 版面我自己控，適合截圖／貼到作業

   ⚠️ 三張分層任務卡（基礎／挑戰／創意）**不在這裡** ——
      那是課堂進行的節奏，寫在教材區（頁面的 demoHTML）。
      硬做成關卡只會變成「填表格才准往下」，那不是專題課該有的樣子。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('projlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  var MIN = 4;                   // 每一格至少幾個字
  /* ⚠️⚠️ 但**輸出那四格例外**：拆成「燈條做什麼／馬達做什麼」之後，
     正確答案自然就很短 ——「熄掉」「停下來」「亮起來」都是完整的答案，
     卻會被 4 字門檻擋掉。
     ★ 這是拆格子**必然**帶來的後果：格子越細，每一格的字越少。
       門檻沒跟著調的話，學生會被逼著寫廢話（「燈條會熄掉不亮」）。 */
  var MIN_IO = 2;
  function minOf(k) {
    return (k === 'thenL' || k === 'thenM' || k === 'elsL' || k === 'elsM')
      ? MIN_IO : MIN;
  }

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  /* ── 兩種模式 ────────────────────────────────────────
     ⚠️⚠️ 老師 2026-08-25：「前面複習已經有配合了，那後面的兩種模式目的是?」
     ★ 問得對 —— 第一版這裡又放了一組滑桿讓學生拉，
       和上面的複習盤在做**同一件事**（輸入動一動、看輸出）。
       重複的互動不會多教到什麼，只會讓人以為自己走錯地方。
     ⇒ 改成一張**對照表**，而且給它一個複習盤沒有的目的：
       「**你的程式裡，條件判斷在哪裡？**」
         自動：如果…那麼…否則…　—— 判斷寫在中間，這是第一節那一課
         手動：直接換算，**沒有條件判斷** —— 所以要自己補一個
     ★ 這正好接上成果發表第二句要寫的東西。 */
  /* ⚠️⚠️ 老師 2026-08-25：「自動版本使用超音波，手動版版使用可變電阻，
     所以一個輸入＋兩個輸出完成這個專案」。
     ★ 所以**輸入從頭到尾只有一個**，挑戰關加的是第二個**輸出**。
       兩個輸入的版本已經拿掉 —— 那會讓學生同時應付兩種讀值，
       而這一節要練的是「同一個判斷，讓兩樣東西一起動」。 */
  var MODES = [
    { key: 'auto', t: '自動', by: '超音波距離感測器',
      d: '人一靠近就亮、就轉；走遠了自己停。',
      good: '★ 好處：不用動手。⚠️ 代價：想要它「現在別亮」也做不到。',
      cond: '**有**條件判斷',
      /* ⚠️⚠️ 老師 2026-08-25：「自動模式 & 手動模式 對於 成果卡無關連性?」
         ★ 問得對 —— 原本它只是印在卡上的一個標籤，不影響任何東西。
         ⇒ 現在它決定**成果發表第二句的範例**，而且會檢查你寫的條件
           和你選的模式對不對得起來（只提醒、不擋）。 */
      ph: ['例：距離小於 30 公分', '例：燈條亮起來、風扇開始轉', '例：兩個都關掉'],
      words: '距離|公分|靠近|接近|太近|太遠|走|人',
      code: '如果　距離 < 30　那麼\n　　燈條亮起來\n　　風扇開始轉\n否則\n　　兩個都關掉',
      note: '★ 那個 30 就是**你要自己決定的門檻**。' +
            '⚠️ 「否則」不能省 —— 少了它，燈亮起來就再也不會暗（第一節那一課）。' },
    { key: 'manual', t: '手動', by: '可變電阻（旋鈕）',
      d: '轉到哪就是哪 —— 顏色和轉速都自己說了算。',
      good: '★ 好處：完全可控。⚠️ 代價：得一直自己轉。',
      cond: '⚠️ **沒有**條件判斷',
      ph: ['例：旋鈕轉到 80% 以上', '例：風扇轉快、燈條變紅', '例：兩個都關掉'],
      words: '旋鈕|轉|%|百分|可變電阻',
      code: '轉速 ← 類比對應（A7，−250，250）\n設定馬達 = 轉速\n燈條顏色 ← 類比對應（A7，0，359）',
      note: '⚠️ 這樣寫從頭到尾**沒有一個「如果」** —— 它只是照著換算。' +
            '★ 所以做手動的組別要**自己補一個條件**，例如：' +
            '「如果 旋鈕 < 5%，那麼 兩個都關掉」。' }
  ];

  /* ⚠️ 原本這裡有 LEDS／NEAR／FULL／HUE_MAX／SPD 和 autoOf()／manualOf()
     —— 那是給第二組滑桿算畫面用的。滑桿收掉之後它們就沒人用了。
     ★ 留著死碼比刪掉更糟：下一個人會以為它被測過。
     （那些換算現在只在複習盤 shared/planlab.js 裡，一份就好。） */

  /* ── 成果發表的三句 ────────────────────────────────
     ★ 老師指定，一字不改。 */
  var SHOW_Q = [
    /* ★ 老師 2026-08-25：前面改成「研發人員」（單數），
       所以三句的主詞一律用「我」。 */
    { key: 's1', t: '我要解決的問題是：', slots: ['problem'],
      ph: ['例：晚上回家玄關太暗，開燈要摸半天'] },
    /* ★ 老師 2026-08-25：「加註 如果 那麼 或者 如果 那麼 否則
       一定要有條件判斷」。
       ⚠️ 這一句不是在描述「我們做了什麼」，它就是**程式裡那個判斷**。
          寫不出條件的組別，通常是程式裡也沒有 —— 那才是要抓的。 */
    /* ★★ 老師 2026-08-25（追加）：「要有兩種條件(如果 那麼 否則)」。
       ⚠️ 所以第二句多一格「否則」—— 而且那一格是**擋得住最多錯**的地方：
          第一節整節課在講的「門開了沒」，病根就是少了否則。
          少了它，燈亮起來就再也不會暗。 */
    /* ★★ 老師 2026-08-25（再追加）：「輸出元件 兩個都要，所以
       『當＿＿時，系統會＿＿；否則＿＿』的反應要分兩種，直接幫使用者註明
       (燈條)(馬達) 因為可能會替換成生活中的實際產品，例如電燈，電扇等」。
       ⚠️ 所以「系統會…」和「否則…」各拆成**兩格** —— 一格燈條、一格馬達。
       ★ 合在一格寫的話，學生只會寫其中一個（多半是燈），
         然後上機才發現馬達那一段根本沒想過。
       ★ 標註元件名還有第二個用處：他可以把它讀成自己作品裡的東西
         （「燈條」＝玄關燈、「馬達」＝電扇），發表時聽得懂。 */
    { key: 's2', t: '當＿＿＿＿時，（燈條）＿＿＿＿、（馬達）＿＿＿＿；' +
                    '否則（燈條）＿＿＿＿、（馬達）＿＿＿＿。',
      slots: ['when', 'thenL', 'thenM', 'elsL', 'elsM'],
      hint: '＝ <b>如果</b>（條件）<b>那麼</b>（兩個輸出各做什麼）' +
            '<b>否則</b>（兩個各恢復成什麼）<br>' +
            '⚠️ 「否則」那兩格不能空 —— 少了它，動作做了就<b>回不去</b>。<br>' +
            '★ （燈條）（馬達）可以讀成你作品裡的東西：玄關燈、電扇…',
      ph: ['例：距離小於 30 公分',
           '例：亮起暖黃色', '例：慢慢開始轉',
           '例：熄掉', '例：停下來'] },
    /* ★★ 老師 2026-08-25：「我遇到＿＿，最後用＿＿解決，我學到＿＿」。
       ⚠️ 多的那一格是**反思** —— 前兩格講的是「事情經過」，
          第三格才是「所以呢」。
       ★ 沒有它的話，發表就停在「我修好了」；有了它，
         學生得回頭想「這件事以後還能用在哪」。 */
    { key: 's3', t: '我遇到＿＿＿＿，最後用＿＿＿＿解決，我學到＿＿＿＿。',
      slots: ['trouble', 'fix', 'learn'],
      ph: ['例：距離一直跳來跳去，燈會閃',
           '例：把門檻改成兩個數字（進 15 出 25）',
           '例：感測器讀到的數字會抖，門檻不能只設一個'] }
  ];
  /* ⚠️ 第三句最常見的敷衍就是「沒有遇到問題」。
     ★ 那句話一寫出來，這一節最有價值的部分（怎麼卡住、怎麼解掉）就沒了。 */
  var NO_TROUBLE = /^(沒有|沒|無|都很順利|很順利|沒問題|沒遇到|一切順利|none|no)/;
  /* ★★ 老師 2026-08-25：「一定要有條件判斷」。
     ⚠️ 「當我們做好的時候」不是條件 —— 條件要**看得出是拿什麼在比**。
        ⇒ 要有數字，或一個比較／臨界的說法。
     ⚠️ 刻意放寬到「靠近／碰到／轉到底」這種生活講法 ——
        國中生講得出那個意思就算，不必寫成數學式。 */
  var COND = new RegExp('[0-9０-９]|小於|大於|超過|低於|高於|以內|以下|以上|不到|' +
                        '靠近|接近|太近|太遠|碰到|轉到|滿|到達|超出|距離|公分|%');
  /* ═══ 系統規格 ═══════════════════════════════════════
     ★ 老師 2026-08-25：「成果卡應該要有手動或自動系統選擇，
       超音波或可變電阻，配燈條與馬達，完整版本的格式」。
     ⚠️ 輸入**不讓學生選** —— 它由模式決定（自動＝超音波、手動＝旋鈕），
        兩邊各自只有一個。讓他選只會多一個對不起來的機會。
     ★ 輸出才要勾：基礎關一個、挑戰關兩個 —— 那正是這一節的進度。 */
  var OUTS = [
    { key: 'strip', t: 'RGB 全彩燈條', pin: '燈條腳位', from: '第二、四節' },
    { key: 'moto',  t: '直流馬達',     pin: '馬達 腳位 2、3', from: '第三節' }
  ];
  function inputOf(modeT) {
    var m = MODES.filter(function (x) { return x.t === modeT; })[0];
    return m ? m.by : '';
  }
  /* ⚠️ 老師 2026-08-25（再追加）：「輸出元件 **兩個都要**」。
     ★ 所以不再讓學生勾 —— 勾選那一段整個拿掉，
       連帶「基礎關／挑戰關」的分級也沒意義了（成果發表本來就是最後一步）。
     ⚠️ 留著一個永遠成立的勾選，就是補償一個不存在的情況。 */
  function specOf(v) {
    return {
      mode: v.mode || '',
      input: inputOf(v.mode),
      pin: v.mode === '自動' ? 'Trig = A2、Echo = A3' : 'A7',
      outs: OUTS.map(function (o) { return o.t; }),
      level: '一個輸入 ＋ 兩個輸出'
    };
  }
  function modeOf(t) {
    return MODES.filter(function (m) { return m.t === t; })[0] || null;
  }
  /* ★ 模式和第二句對不對得起來。⚠️ 只**提醒**不擋 ——
     學生可能有我沒想到的寫法（例如自動模式也講「太亮的時候」）。 */
  function mismatch(v) {
    var m = modeOf(v.mode);
    if (!m || !norm(v.when)) return '';
    if (new RegExp(m.words).test(String(v.when))) return '';
    var other = MODES.filter(function (x) { return x !== m; })[0];
    if (other && new RegExp(other.words).test(String(v.when)))
      return '⚠️ 你選的是**' + m.t + '模式**（靠' + m.by + '），' +
             '但第二句的條件講的是**' + other.t + '模式**那一邊的東西。' +
             '★ 兩個對不起來的話，聽的人會很困惑 —— 檢查一下是哪一個寫錯了。';
    return '';
  }
  function judgeShow(v) {
    /* ⚠️⚠️ 這一條要**排在長度檢查前面**。
       第一版先查長度 —— 但學生實際上打的就是「沒有」兩個字，
       兩個字不到門檻，於是他收到的是「太短，至少寫 4 個字」。
       ★ 那句話會把他推向**更糟的方向**：他只會補成「沒有遇到問題」，
         剛好長度過關，而這一格最值錢的東西還是沒寫。 */
    if (NO_TROUBLE.test(norm(v.trouble))) return { ok: false, how: 'notrouble' };
    var miss = [];
    ['problem', 'when', 'thenL', 'thenM', 'elsL', 'elsM',
     'trouble', 'fix', 'learn'].forEach(function (k) {
      if (norm(v[k]).length < minOf(k)) miss.push(k);
    });
    if (miss.length) return { ok: false, how: 'short', miss: miss };
    /* ⚠️ 規格不完整就出不了卡 —— 一張沒有規格的成果卡看不出他做了什麼。 */
    if (!v.mode) return { ok: false, how: 'nomode' };
    if (!COND.test(String(v.when || ''))) return { ok: false, how: 'nocond' };
    return { ok: true, how: 'fit', warn: mismatch(v) };
  }
  var LABEL = { problem: '要解決的問題', when: '當…時',
                thenL: '（燈條）會…', thenM: '（馬達）會…',
                elsL: '否則（燈條）…', elsM: '否則（馬達）…',
                trouble: '我遇到…', fix: '最後用…解決', learn: '我學到…' };
  function sayShow(r) {
    /* ⚠️ 正常走不到這裡（沒選模式就進不了成果發表）——
       留著是因為 judgeShow 也給外面用（例如老師的檢查工具）。 */
    if (r.how === 'nomode')
      return '⚠️ 先在上面那一頁**挑一種模式**（自動或手動）—— ' +
             '成果卡上要寫清楚你做的是哪一種。';
    if (r.how === 'nocond')
      return '⚠️ 第二句的「當＿＿時」要是一個**條件** —— ' +
             '也就是程式裡那個「**如果**」。\n' +
             '★ 條件要看得出**拿什麼在比**：' +
             '「距離小於 30 公分」「旋鈕轉到底」「太近的時候」都可以；\n' +
             '⚠️ 「當我們做好的時候」不算 —— 那不是程式判斷得出來的事。';
    if (r.how === 'notrouble')
      return '⛔ 「沒有遇到問題」不能算 —— 這一格是整段發表**最值錢**的地方。' +
             '★ 想想看：第一次燒錄成功了嗎？數字第一次就抓對了嗎？' +
             '線有沒有插錯過？那些都算。';
    if (r.how === 'short')
      return '⚠️ 還有沒填完的：**' +
             r.miss.map(function (k) { return LABEL[k]; }).join('、') + '**。';
    return '';
  }

  /* ═══ AI 助教看一遍 ════════════════════════════════
     ★ 老師 2026-08-25：「成果發表 欄位 引入 AI 檢測」，三個檢查點：
         ① 我要解決的問題 —— 應該是**實際存在的情況**
         ② 當…時／系統會…／否則… —— 要**和選的元件相關**（距離、轉動、亮燈）
         ③ 我遇到／最後用…解決／我學到 —— 三件事要**互相關聯**
     ⚠️ 這三點本機的關鍵字判不出來（尤其③的關聯性）—— 正是 AI 該做的事。

     ⚠️⚠️ 但這個專案的鐵律：**AI 不可以有否決權**。
        額度用完、GAS 掛掉、網路不通的時候，全班會卡在這裡交不出成果卡。
        ⇒ 所以做成「**看一遍、給建議**」：
            本機該擋的照擋（空白／太短／沒條件／沒有遇到問題）
            AI 只在出卡前插一手，講哪一點還可以更好
            學生看完**再按一次就出卡** —— 不管 AI 說了什麼
          AI 失敗／沒設定 → 直接出卡，學生不會知道有這一關。
     ★ 名稱要短、要好回；而且**只收這三個**，模型自己造的一律丟掉
       （沿用 labkit.reviewSay 的那道防護 —— 不然就不是覆核，是代判）。 */
  var AI_NEED = [
    { name: '問題是真的會遇到的',
      tip: '⚠️ 第一句：**「我要解決的問題」要是真的會發生的事**。\n' +
           '★ 想想看：那件事**什麼時候**發生？發生的時候**誰**覺得麻煩？\n' +
           '（「想做一個燈」不是問題；「晚上回家玄關太暗，開燈要摸半天」才是。）' },
    { name: '條件和動作用到你選的元件',
      tip: '⚠️ 第二句：**條件和動作要看得出用了哪個元件**。\n' +
           '★ 條件講「距離幾公分」或「旋鈕轉到幾 %」；\n' +
           '　動作講「燈條怎麼亮」「風扇怎麼轉」——\n' +
           '　不要只寫「系統會啟動」，那聽不出你做了什麼。' },
    { name: '遇到、解決、學到三件事對得起來',
      tip: '⚠️ 第三句：**那三格要是同一件事的三個階段**。\n' +
           '★ 遇到什麼 → 就用什麼解決 → 學到的就是從那件事來的。\n' +
           '（遇到「燈一直閃」、卻學到「顏色要調亮一點」—— 那是兩件事。）' }
  ];
  function aiText(v) {
    return '（1）我要解決的問題是：' + v.problem + '\n' +
           '（2）當 ' + v.when + ' 時，燈條 ' + v.thenL + '、馬達 ' + v.thenM +
             '；否則 燈條 ' + v.elsL + '、馬達 ' + v.elsM + '。\n' +
           '（3）我遇到 ' + v.trouble + '，最後用 ' + v.fix + ' 解決，我學到 ' + v.learn + '。';
  }
  /* 回 { skipped } 或 { missing: [tip...] }。⚠️ **永遠 resolve** ——
     呼叫端不必寫 catch，也就不會有人哪天忘了寫。 */
  /* AI 到底在不在。⚠️ 這一支要**同步**判得出來 ——
     不在的話連那條非同步的路都不要走：
     沒設定 AI 的環境下，「按了就出卡」不應該變成非同步，
     那顆按鈕的說明也不該寫「AI 會先看一遍」。 */
  function aiOn() {
    return !!(global.ASKAI && global.ASKAI.enabled && global.ASKAI.enabled() &&
              global.ASKAI.judge);
  }
  function aiReview(v, opts) {
    opts = opts || {};
    var names = AI_NEED.map(function (g) { return g.name; });
    if (!aiOn()) return Promise.resolve({ skipped: true });
    return global.ASKAI.judge('5016b-u5-show', [{
      i: 0,
      q: '這是一份國中生的專題成果發表。請判斷下面三點做到了哪幾點。',
      need: names,
      got: [],
      /* ⚠️ 截斷 —— 不截的話一篇長文就把額度燒掉了（額度全班共用）。 */
      a: aiText(v).slice(0, 400)
    }], opts.student).then(function (list) {
      var x = (list || [])[0];
      /* ★★ 只收原本列出的三個名稱，模型自己造的一律丟掉。 */
      var got = ((x && x.got) || []).filter(function (n) {
        return names.indexOf(n) >= 0;
      });
      var missing = AI_NEED.filter(function (g) { return got.indexOf(g.name) < 0; });
      return { skipped: false, got: got, missing: missing };
    }).catch(function () { return { skipped: true }; });
  }

  /* ═══ 成果卡：列印（另存 PDF）與下載 PNG ═══════════ */
  /* ⚠️⚠️ cardLines() 是**下載 PNG 那一版的唯一版面來源** ——
     網頁上的 cardHtml() 有自己的一份。
     ★ 兩份要一起改：突變測試把這裡的「我學到」刪掉，
       網頁版照樣正確、測試也照樣綠，**只有下載下來的圖少一句**。
       ⇒ 所以這支要匯出，讓測試直接盯它。 */
  function cardLines(v) {
    var sp = specOf(v);
    return [
      { s: '一、系統規格',
        k: '控制模式：' + (sp.mode ? sp.mode + '模式' : '—') +
           '　｜　輸入：' + (sp.input || '—') + '（' + sp.pin + '）',
        v: '輸出：' + (sp.outs.join('、') || '—') + '　｜　' + sp.level },
      { s: '二、動作說明',
        k: '1　我要解決的問題是', v: v.problem },
      { k: '2　當　' + v.when + '　時',
        v: '（燈條）' + v.thenL + '、（馬達）' + v.thenM },
      { k: '　　否則',
        v: '（燈條）' + v.elsL + '、（馬達）' + v.elsM },
      { s: '三、問題與解決',
        k: '3　我遇到　' + v.trouble, v: '最後用　' + v.fix + '　解決' },
      { k: '4　我學到', v: v.learn }
    ];
  }
  /* ★ 老師 2026-08-25：「設計一下卡片格式，正式文件風格」。
     ⇒ 版面照一份技術文件走：
         抬頭（單位／文件名／日期）
         基本資料（專題名稱、研發人員、完成階段）
         一、系統規格（模式／輸入／腳位／輸出）
         二、動作說明（如果…那麼…否則）
         三、問題與解決（遇到／解法／學到）
         簽名欄
     ⚠️ 正式**不等於**冷冰冰：欄位名稱仍用學生看得懂的話，
        不寫「需求規格書」那種他念不出來的詞。 */
  function cardHtml(v, meta) {
    var esc = LK().esc;
    var m = meta || {};
    var sp = specOf(v);
    function row(k, val) {
      return '<tr><th>' + esc(k) + '</th><td>' + esc(val || '—') + '</td></tr>';
    }
    return '<div class="pj-card" id="pj-card">' +
      '<div class="pj-doc-h">' +
        '<div class="pj-doc-org">' + esc(m.org || '智慧家居機電專題') + '</div>' +
        '<div class="pj-doc-t">專題成果報告</div>' +
        '<div class="pj-doc-m">' + esc(m.date || '') + '</div>' +
      '</div>' +
      '<table class="pj-tb pj-tb-head">' +
        row('專題名稱', m.scene) +
        row('研發人員', m.team) +
        row('完成階段', sp.level) +
      '</table>' +
      '<div class="pj-sec">一、系統規格</div>' +
      '<table class="pj-tb">' +
        row('控制模式', sp.mode ? sp.mode + '模式' : '') +
        row('輸入元件', sp.input) +
        row('接腳', sp.pin) +
        row('輸出元件', sp.outs.join('、')) +
      '</table>' +
      '<div class="pj-sec">二、動作說明</div>' +
      '<div class="pj-body">' +
        '<div class="pj-li"><span>1</span>我要解決的問題是：' + esc(v.problem) + '</div>' +
        '<div class="pj-li"><span>2</span>當 <b>' + esc(v.when) + '</b> 時：' +
          '<table class="pj-tb pj-tb-io"><tr><th>燈條</th><td>' + esc(v.thenL) + '</td>' +
          '<th>馬達</th><td>' + esc(v.thenM) + '</td></tr>' +
          '<tr><th>否則 燈條</th><td>' + esc(v.elsL) + '</td>' +
          '<th>否則 馬達</th><td>' + esc(v.elsM) + '</td></tr></table></div>' +
      '</div>' +
      '<div class="pj-sec">三、問題與解決</div>' +
      '<div class="pj-body">' +
        '<div class="pj-li"><span>3</span>我遇到 <b>' + esc(v.trouble) + '</b>，' +
          '最後用 <b>' + esc(v.fix) + '</b> 解決。</div>' +
        '<div class="pj-li"><span>4</span>我學到 <b>' + esc(v.learn) + '</b>。</div>' +
      '</div>' +
      (m.line ? '<div class="pj-doc-f">設計單：' + esc(m.line) + '</div>' : '') +
      '<div class="pj-sign"><span>研發人員簽名</span><span>教師確認</span></div>' +
    '</div>';
  }

  /* 列印：把成果卡搬到一個獨立容器，@media print 只留它。
     ⚠️ 不開新視窗 —— 會被擋，而且新視窗載不到這頁的樣式。 */
  function printCard(html) {
    var root = document.getElementById('pj-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pj-print-root';
      document.body.appendChild(root);
    }
    root.innerHTML = html;
    document.body.classList.add('pj-printing');
    var clean = function () {
      document.body.classList.remove('pj-printing');
      global.removeEventListener('afterprint', clean);
    };
    global.addEventListener('afterprint', clean);
    global.print();
    /* ⚠️ 有些瀏覽器不發 afterprint —— 留一個保險，
       不還原的話整頁會一直是空白的。 */
    global.setTimeout(clean, 1500);
  }

  /* 下載 PNG：canvas 自己畫。★ 用系統字型 fillText，中文不會有問題。 */
  function wrapText(ctx, text, max) {
    var out = [], line = '';
    String(text || '').split('').forEach(function (ch) {
      if (ch === '\n') { out.push(line); line = ''; return; }
      if (ctx.measureText(line + ch).width > max) { out.push(line); line = ch; }
      else line += ch;
    });
    if (line) out.push(line);
    return out;
  }
  function drawCard(v, meta) {
    var W = 1000, H = 1414, pad = 72;          // A4 直式的比例
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
    var m = meta || {}, sp = specOf(v);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);

    /* ── 抬頭 ── */
    var y = pad + 16;
    c.fillStyle = '#64748b'; c.font = '700 20px ' + FONT;
    c.fillText(String(m.org || '智慧家居機電專題'), pad, y);
    c.textAlign = 'right'; c.fillText(String(m.date || ''), W - pad, y);
    c.textAlign = 'left';
    y += 44;
    c.fillStyle = '#0f172a'; c.font = '900 40px ' + FONT;
    c.fillText('專題成果報告', pad, y);
    y += 18;
    c.fillStyle = '#7c3aed'; c.fillRect(pad, y, W - pad * 2, 4);
    y += 40;

    /* ── 基本資料 ── */
    function kv(k, val) {
      c.fillStyle = '#64748b'; c.font = '800 22px ' + FONT;
      c.fillText(k, pad, y);
      c.fillStyle = '#0f172a'; c.font = '800 24px ' + FONT;
      wrapText(c, String(val || '—'), W - pad * 2 - 150).forEach(function (l, i) {
        c.fillText(l, pad + 150, y + i * 34);
      });
      y += 34 * Math.max(1, wrapText(c, String(val || '—'), W - pad * 2 - 150).length) + 8;
    }
    kv('專題名稱', m.scene);
    kv('研發人員', m.team);
    kv('完成階段', sp.level);

    /* ── 各段 ── */
    y += 12;
    cardLines(v).forEach(function (row) {
      if (row.s) {
        y += 12;
        c.fillStyle = '#7c3aed'; c.font = '900 26px ' + FONT;
        c.fillText(row.s, pad, y);
        y += 10;
        c.fillStyle = '#ede9fe'; c.fillRect(pad, y, W - pad * 2, 3);
        y += 34;
      }
      c.fillStyle = '#0f172a'; c.font = '900 25px ' + FONT;
      wrapText(c, row.k, W - pad * 2).forEach(function (l) { c.fillText(l, pad, y); y += 34; });
      c.fillStyle = '#334155'; c.font = '700 24px ' + FONT;
      wrapText(c, row.v, W - pad * 2 - 24).forEach(function (l) {
        c.fillText(l, pad + 24, y); y += 33;
      });
      y += 14;
    });

    /* ── 簽名欄 ── */
    var sy = H - pad - 46;
    c.strokeStyle = '#cbd5e1'; c.lineWidth = 2;
    [0, 1].forEach(function (i) {
      var x = pad + i * ((W - pad * 2) / 2 + 10);
      var w = (W - pad * 2) / 2 - 10;
      c.beginPath(); c.moveTo(x, sy); c.lineTo(x + w, sy); c.stroke();
      c.fillStyle = '#94a3b8'; c.font = '700 19px ' + FONT;
      c.fillText(i === 0 ? '研發人員簽名' : '教師確認', x, sy + 26);
    });
    return cv;
  }

  function downloadPng(v, meta) {
    var cv = drawCard(v, meta);
    var a = document.createElement('a');
    a.download = '成果發表_' + ((meta && meta.scene) || '專題') + '.png';
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ═══ 樣式 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pj-lv{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.pj-tab{flex:1;min-width:130px;text-align:center;padding:10px 8px;border-radius:12px;' +
    'border:2px solid #e2e8f0;font-weight:900;font-size:14px;color:#64748b;background:#fff;' +
    'cursor:pointer}' +
  '.pj-tab.on{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6}' +
  '.pj-tab.off{opacity:.55;cursor:not-allowed}' +
  '.pj-tab span{display:block;font-size:11px;font-weight:800;opacity:.8}' +
  '.pj-goal{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin-bottom:12px}' +
  '.pj-goal em{color:#fbbf24;font-style:normal}' +
  '.pj-ask{font-size:15px;font-weight:900;color:#0f172a;line-height:1.9;margin:12px 0 8px}' +
  '.pj-stage{background:#0f172a;border-radius:14px;padding:16px;margin:10px 0}' +
  '.pj-strip{display:flex;gap:5px;justify-content:center;margin-bottom:12px}' +
  '.pj-led{width:28px;height:28px;border-radius:50%;border:2px solid #334155}' +
  '.pj-fan{display:flex;align-items:center;justify-content:center;gap:12px;' +
    'color:#e2e8f0;font-weight:900;font-size:15px}' +

  '.pj-read{text-align:center;color:#94a3b8;font-weight:900;font-size:14px;margin-top:10px;' +
    'font-variant-numeric:tabular-nums}' +
  '.pj-sl{display:flex;align-items:center;gap:10px;font-weight:900;font-size:15px;margin:10px 0}' +
  '.pj-sl input{flex:1;height:30px;cursor:pointer}' +
  '.pj-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:900;' +
    'font-size:15px;margin:8px 0}' +
  '.pj-t{flex:1;min-width:150px;font-size:15px;font-weight:800;padding:9px 12px;' +
    'border:2px solid #cbd5e1;border-radius:10px;box-sizing:border-box}' +
  '.pj-note{font-size:13px;color:#64748b;font-weight:700;line-height:1.8;margin-top:6px}' +
  '.pj-who{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#f8fafc;' +
    'border:2px solid #e2e8f0;border-radius:12px;padding:10px 13px;margin:8px 0;' +
    'font-size:15px;font-weight:900;color:#0f172a}' +
  '.pj-who-k{font-size:12px;font-weight:900;color:#7c3aed}' +
  '.pj-who-n{font-size:12px;font-weight:800;color:#94a3b8}' +
  '.pj-who-w{font-size:14px;font-weight:800;color:#64748b}' +
  '.pj-who-b{font-size:14px;font-weight:900;color:#b45309}' +
  '.pj-who-r{padding:5px 12px;font-size:12px}' +
  '.pj-spec{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;' +
    'padding:11px 13px;margin:10px 0}' +
  '.pj-spec-h{font-size:12px;font-weight:900;color:#7c3aed;margin-bottom:5px}' +
  '.pj-spec-r{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;' +
    'font-weight:800;color:#475569;margin:4px 0}' +
  '.pj-spec-r b{color:#0f172a}' +
  '.pj-spec-r span{font-size:12px;color:#94a3b8;font-family:monospace}' +
  '.pj-spec-n{font-size:12px;font-weight:800;color:#94a3b8;margin-top:5px}' +
  '.pj-io2{padding-left:14px}' +
  '.pj-io2 b{color:#7c3aed;min-width:62px}' +
  '.pj-tb-io{margin:6px 0 0}' +
  '.pj-tb-io th{width:78px;font-size:13px}' +
  '.pj-tb-io td{font-size:14px}' +
  '.pj-hint{font-size:13px;font-weight:800;color:#7c3aed;background:#f5f3ff;' +
    'border-radius:10px;padding:7px 10px;margin-top:5px;line-height:1.8}' +
  /* 兩種模式的對照表 */
  '.pj-cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}' +
  '.pj-col{border:2px solid #e2e8f0;border-radius:14px;padding:13px;background:#fff}' +
  '.pj-col.on{border-color:#7c3aed;background:#faf5ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pj-col-h{font-size:17px;font-weight:900;color:#0f172a;margin-bottom:6px}' +
  '.pj-col-b{font-size:14px;font-weight:800;color:#334155;line-height:1.8}' +
  '.pj-code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px 12px;' +
    'font-family:monospace;font-size:13px;line-height:1.9;margin:8px 0}' +
  '.pj-cond{font-size:14px;font-weight:900;color:#7c3aed;margin-bottom:4px}' +
  '.pj-col-n{font-size:13px;font-weight:700;color:#64748b;line-height:1.8;margin-bottom:6px}' +
  '.pj-pick{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:12px 14px;' +
    'margin:12px 0;font-weight:800;font-size:14px;color:#78350f;line-height:1.8}' +
  /* 成果卡 */
  '.pj-card{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:30px 32px;' +
    'margin:14px 0;line-height:1.9;color:#0f172a}' +
  '.pj-doc-h{display:flex;justify-content:space-between;align-items:baseline;' +
    'flex-wrap:wrap;gap:6px;border-bottom:3px solid #7c3aed;padding-bottom:10px}' +
  '.pj-doc-org{font-size:14px;font-weight:800;color:#64748b;letter-spacing:.08em}' +
  '.pj-doc-t{font-size:26px;font-weight:900;letter-spacing:.12em}' +
  '.pj-doc-m{font-size:13px;font-weight:800;color:#64748b}' +
  '.pj-tb{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px}' +
  '.pj-tb th{width:112px;text-align:left;font-weight:900;color:#64748b;' +
    'background:#f8fafc;border:1px solid #e2e8f0;padding:7px 11px;white-space:nowrap}' +
  '.pj-tb td{border:1px solid #e2e8f0;padding:7px 11px;font-weight:800}' +
  '.pj-tb-head th{color:#7c3aed}' +
  '.pj-sec{font-size:16px;font-weight:900;color:#7c3aed;margin:18px 0 6px;' +
    'border-bottom:2px solid #ede9fe;padding-bottom:4px}' +
  '.pj-body{font-size:15px;font-weight:800;color:#334155}' +
  '.pj-li{display:flex;gap:9px;align-items:flex-start;margin-bottom:8px;line-height:1.9}' +
  '.pj-li span{flex:none;width:22px;height:22px;border-radius:50%;background:#ede9fe;' +
    'color:#7c3aed;font-size:13px;font-weight:900;text-align:center;line-height:22px;' +
    'margin-top:4px}' +
  '.pj-li b{color:#0f172a}' +
  '.pj-doc-f{font-size:12px;font-weight:800;color:#94a3b8;background:#f8fafc;' +
    'border-radius:6px;padding:7px 10px;margin-top:14px}' +
  '.pj-sign{display:flex;gap:20px;margin-top:26px}' +
  '.pj-sign span{flex:1;border-top:1px solid #cbd5e1;padding-top:6px;font-size:12px;' +
    'font-weight:800;color:#94a3b8}' +
  '#pj-print-root{display:none}' +
  '@media print{body.pj-printing>*{display:none!important}' +
    'body.pj-printing #pj-print-root{display:block!important}' +
    'body.pj-printing .pj-card{border-width:2px;page-break-inside:avoid}}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('projlab-css')) return;
    var st = document.createElement('style');
    st.id = 'projlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var line = String(opts.line || '');
    var scene = (opts.plan && opts.plan.scene) || '我的專題';
    var tab = 'demo';                 // demo（兩種模式）／show（成果發表）
    /* ★ 自動帶入班級座號姓名（頁面從 SSO 拿）。
       ⚠️ 只在「學生還沒自己填過」的時候帶入 —— 不然他改了名字（加組員）
          會被下一次重新掛載蓋掉。 */
    var f = Object.assign({ mode: '', problem: '', when: '',
                            thenL: '', thenM: '', elsL: '', elsM: '',
                            trouble: '', fix: '', learn: '' }, opts.work || {});
    /* ⚠️⚠️ 老師 2026-08-25：「研發人員 是我上次輸入的人名? 不是目前帳號的實際資料」
       ★ 對 —— 病根在這裡：身分原本和學生的作答**混在同一包 f 裡**，
         而那一包會被存下來、下次再載回來。
         於是舊紀錄裡（唯讀之前）手打的名字，就一直跟著跑。
       ⚠️ 前一輪我還加了一條測試說「舊的會被系統值蓋掉」——
          但那測的是 setWho()，而快取有值的時候**根本不會呼叫 setWho()**。
          釘錯層：測了修補的動作，沒測真正的來源。
       ⇒ 身分**不放進 f**，獨立一個變數，而且**只有系統填得了**：
         唯一來源是 opts.who（或稍後 setWho 補進來的名冊值）。
         舊紀錄裡的 team 一律忽略。 */
    var who = String(opts.who || '');
    /* 三態：已帶入／還在問名冊／問不到。⚠️ 不可以靜默留白。 */
    var whoState = who ? 'got' : 'wait';
    function whoLine() {
      if (whoState === 'got')
        return '<span class="pj-who-k">研發人員</span>' +
               '<b>' + esc(who) + '</b>' +
               '<span class="pj-who-n">（系統自動填入，不可修改）</span>';
      if (whoState === 'wait')
        return '<span class="pj-who-k">研發人員</span>' +
               '<span class="pj-who-w">⏳ 正在讀你的班級座號姓名…</span>';
      return '<span class="pj-who-k">研發人員</span>' +
             '<span class="pj-who-b">⚠️ 這一頁沒問到你的班級座號姓名</span>' +
             '<button class="dl-go pj-who-r" id="pj-whoretry">重新讀取</button>';
    }
    /* ★ 頁面問到名冊之後補進來。⚠️ 唯讀 —— 沒有「會不會蓋掉學生打的」問題。 */
    function setWho(t) {
      whoState = t ? 'got' : 'miss';
      if (t) who = t;
      var n = el.querySelector('#pj-who');
      if (n) { n.innerHTML = whoLine(); bind(); }
    }

    function tabs() {
      var t = [['demo', '🎛️ 兩種模式', '玩玩看，複習前四節'],
               ['show', '🎤 成果發表', '三句話 ＋ 成果卡']];
      return '<div class="pj-lv">' + t.map(function (x) {
        var off = (x[0] === 'show' && !f.mode);
        return '<div class="pj-tab ' + (tab === x[0] ? 'on' : '') + (off ? ' off' : '') +
          '" data-tab="' + x[0] + '">' +
          x[1] + '<span>' + (off ? '先挑一種模式' : x[2]) + '</span></div>';
      }).join('') + '</div>';
    }
    function goal() {
      return '<div class="pj-goal">🎯 <em>' + esc(scene) + '</em>' +
        (line ? '<br>' + esc(line) : '') + '</div>';
    }
    function view(body, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + goal() + body +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }

    /* ── 兩種模式：對照表（不再放第二組滑桿）── */
    function viewDemo(msg, cls) {
      view(
        '<div class="pj-ask">🎛️ 同一組硬體，<b>兩種寫法</b>　—— ' +
        '⚠️ 你的作品<b>挑一種做就好</b>。<br>' +
        '★ 不管挑哪一種，都是 <b>一個輸入 ＋ 兩個輸出</b>：' +
        '輸入從頭到尾不換，挑戰關加的是<b>第二個輸出</b>。</div>' +
        '<div class="pj-cmp">' + MODES.map(function (m) {
          return '<div class="pj-col' + (f.mode === m.t ? ' on' : '') + '">' +
            '<div class="pj-col-h">' + esc(m.t) + '模式</div>' +
            '<div class="pj-col-b">靠 <b>' + esc(m.by) + '</b><br>' + esc(m.d) + '</div>' +
            '<div class="pj-code">' + esc(m.code).replace(/\n/g, '<br>') + '</div>' +
            '<div class="pj-cond">' + md(m.cond) + '</div>' +
            '<div class="pj-col-n">' + md(m.note) + '</div>' +
            '<div class="pj-col-n">' + md(m.good) + '</div>' +
            '<button class="dl-go" data-pick="' + esc(m.t) + '"' +
              (f.mode === m.t ? '' : ' style="background:#94a3b8"') + '>' +
              (f.mode === m.t ? '✅ 我做這一種' : '選這一種') + '</button>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="pj-pick">🧩 <b>不管做哪一種，程式裡一定要有一個「如果」。</b><br>' +
          '自動那一種本來就有；手動那一種要自己補 —— ' +
          '想想看：<b>什麼情況下它應該整個停下來？</b><br>' +
          '★ 這一句等一下就是成果發表的第二句。</div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-go-show"' +
          (f.mode ? '' : ' style="background:#94a3b8"') + '>' +
          (f.mode ? '去填成果發表 →' : '先挑一種模式') + '</button></div>',
        msg, cls);
    }

    /* ── 成果發表 ── */
    function viewShow(msg, cls) {
      view(
        '<div class="pj-ask">🎤 <b>成果發表</b>　—— 固定講這三句就好。</div>' +
        /* ★ 老師 2026-08-25：「組別／組員」改成「研發人員」，
           而且班級座號姓名要由系統自動填入。
           ⚠️⚠️ 老師追問：「不是要在名冊內才能登入?」—— 對。
              ★ 所以「讀不到」**不是**沒登入、也不是名冊沒建 ——
                那兩種情況根本進不到這一頁。
              ⇒ 真正會發生的只有「**還沒問到**」：SSO 讀的是快取，
                直接開網址或新分頁進來時快取是空的，要去問一次名冊。
              ⚠️ 第一版把原因寫成「可能是沒登入」—— 那是**猜的，而且猜錯**。
                 錯的原因比沒有原因更糟：學生會跑去重新登入，然後發現沒用。 */
        /* ⚠️⚠️ 老師 2026-08-25：「個人資料應該是唯讀，由系統填寫」。
           ★ 對 —— 這一格能打字就有人會打別人的名字，
             而這張卡是要交出去的。改成**唯讀顯示**。
           ⚠️ 所以「不覆蓋學生打的」那段邏輯也一起拿掉 ——
              打不了字就不會有那個情況，留著就是補償一個不存在的問題。 */
        '<div class="pj-who" id="pj-who">' + whoLine() + '</div>' +
        /* ★ 老師 2026-08-25：「成果卡應該要有手動或自動系統選擇，
           超音波或可變電阻，配燈條與馬達，完整版本的格式」。
           ⚠️ 輸入**不讓學生選** —— 它由模式決定，兩邊各自只有一個；
              讓他選只會多一個對不起來的機會。 */
        '<div class="pj-spec">' +
          '<div class="pj-spec-h">系統規格</div>' +
          '<div class="pj-spec-r">控制模式：<b>' +
            (f.mode ? esc(f.mode) + '模式' : '⚠️ 還沒挑（回上一頁選）') + '</b></div>' +
          '<div class="pj-spec-r">輸入元件：<b>' +
            (inputOf(f.mode) || '（挑了模式就會自動帶出來）') + '</b>' +
            '<span>' + (f.mode === '自動' ? 'Trig = A2、Echo = A3'
                                          : (f.mode ? 'A7' : '')) + '</span></div>' +
          '<div class="pj-spec-r">輸出元件：<b>' +
            OUTS.map(function (o) { return esc(o.t); }).join('、') + '</b></div>' +
          '<div class="pj-spec-n">★ 兩個輸出**都要用到** —— ' +
          '同一個判斷底下，燈條和馬達一起動。</div>' +
        '</div>' +
        '<div class="pj-ask" style="margin-top:10px">1. 我要解決的問題是：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-problem" value="' + esc(f.problem) +
          '" placeholder="' + esc(SHOW_Q[0].ph[0]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">2. 當＿＿時，兩個輸出各做什麼？' +
          '<div class="pj-hint">' + SHOW_Q[1].hint + '</div></div>' +
        '<div class="pj-fill">當　<input class="pj-t" id="pj-when" value="' + esc(f.when) +
          '" placeholder="' + esc(ph2(0)) + '">　時</div>' +
        '<div class="pj-fill pj-io2"><b>（燈條）</b>會　' +
          '<input class="pj-t" id="pj-thenL" value="' + esc(f.thenL) +
          '" placeholder="' + esc(ph2(1)) + '"></div>' +
        '<div class="pj-fill pj-io2"><b>（馬達）</b>會　' +
          '<input class="pj-t" id="pj-thenM" value="' + esc(f.thenM) +
          '" placeholder="' + esc(ph2(2)) + '"></div>' +
        '<div class="pj-fill" style="margin-top:8px">否則 ——</div>' +
        '<div class="pj-fill pj-io2"><b>（燈條）</b>　' +
          '<input class="pj-t" id="pj-elsL" value="' + esc(f.elsL) +
          '" placeholder="' + esc(ph2(3)) + '"></div>' +
        '<div class="pj-fill pj-io2"><b>（馬達）</b>　' +
          '<input class="pj-t" id="pj-elsM" value="' + esc(f.elsM) +
          '" placeholder="' + esc(ph2(4)) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">' +
          '3. 我遇到＿＿，最後用＿＿解決，我學到＿＿。</div>' +
        '<div class="pj-fill">我遇到　<input class="pj-t" id="pj-trouble" value="' +
          esc(f.trouble) + '" placeholder="' + esc(SHOW_Q[2].ph[0]) + '"></div>' +
        '<div class="pj-fill">最後用　<input class="pj-t" id="pj-fix" value="' + esc(f.fix) +
          '" placeholder="' + esc(SHOW_Q[2].ph[1]) + '">　解決</div>' +
        '<div class="pj-fill">我學到　<input class="pj-t" id="pj-learn" value="' + esc(f.learn) +
          '" placeholder="' + esc(SHOW_Q[2].ph[2]) + '"></div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-make"' +
          (aiBusy ? ' disabled' : '') + '>' +
          (aiBusy ? '🤖 AI 助教看一下…' : '產生成果卡') + '</button>' +
          (aiOn() && !aiDone ? '<span class="dl-note">送出前 AI 助教會先看一遍。</span>' : '') +
        '</div>',
        msg, cls);
    }
    /* ★ 第二句的範例跟著**你選的模式**走 —— 選了自動就給距離的例子，
       選了手動就給旋鈕的例子。⚠️ 這就是模式和成果卡的關連。 */
    function ph2(i) {
      var m = modeOf(f.mode);
      return (m && m.ph && m.ph[i]) || SHOW_Q[1].ph[i];
    }
    function meta() {
      return { scene: scene, team: who, mode: f.mode, line: line,
               date: new Date().toLocaleDateString('zh-TW') };
    }
    var aiBusy = false, aiDone = false;
    function doShow() {
      grab();
      var r = judgeShow(f);
      if (!r.ok) return viewShow(sayShow(r), 'bad');
      /* ⚠️ 對不起來只提醒，不擋 —— 但要**在出卡之前**講，不然沒人會回頭改。 */
      if (r.warn && !f.warned) { f.warned = true; return viewShow(r.warn, 'bad'); }
      /* ★ AI 助教看一遍（只看一次）。⚠️ 它**沒有否決權** ——
         看完之後再按一次就出卡，不管它說了什麼；
         失敗或沒設定就直接出卡，學生不會知道有這一關。 */
      if (aiOn() && !aiDone && !aiBusy) {
        aiBusy = true;
        viewShow('', '');
        aiReview(f, opts).then(function (a) {
          aiBusy = false; aiDone = true;
          if (a.skipped) return doShow();          // AI 不在 → 直接出卡
          if (!a.missing.length)
            return viewShow('✅ AI 助教看過了，三點都不錯 —— **再按一次**就出卡。', 'good');
          viewShow('🤖 AI 助教的建議（**看完再按一次就出卡**，不改也可以）：\n' +
                   a.missing.map(function (g) { return g.tip; }).join('\n'), 'bad');
        });
        return;
      }
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">🎉 成果卡好了 —— 下面兩個按鈕都可以帶走。</div>' +
        cardHtml(f, meta()) +
        '<div class="dl-row">' +
          '<button class="dl-go" id="pj-print">🖨️ 列印／存成 PDF</button> ' +
          '<button class="dl-go" id="pj-png" style="background:#0891b2">🖼️ 下載成圖片</button> ' +
          '<button class="dl-go" id="pj-back" style="background:#94a3b8">回去改</button>' +
        '</div>' +
        '<div class="pj-note">⚠️ 電腦教室<b>關機會還原</b> —— ' +
        '記得把檔案傳給自己，或直接交給老師。<br>' +
        '★ 列印的時候在「印表機」那一欄選<b>「另存為 PDF」</b>就會變成一份 PDF。</div>' +
        '</div>';
      bind();
      /* ⚠️ 存下來的是**作答**，不含身分 —— 身分每次都跟著帳號重新帶，
         不可以變成「上次那個人的名字」跟著紀錄跑。 */
      if (typeof opts.onDone === 'function') opts.onDone({ work: f });
    }

    function grab() {
      [['pj-problem', 'problem'], ['pj-when', 'when'],
       ['pj-thenL', 'thenL'], ['pj-thenM', 'thenM'],
       ['pj-elsL', 'elsL'], ['pj-elsM', 'elsM'],
       ['pj-trouble', 'trouble'], ['pj-fix', 'fix'],
       ['pj-learn', 'learn']].forEach(function (x) {
        var e = el.querySelector('#' + x[0]);
        if (e) f[x[1]] = e.value;
      });
    }
    /* ⚠️⚠️ 老師 2026-08-25：「模式 沒有決定應該不能進入 下一步吧?」
       ★ 對，而且不只是出卡的時候才擋 ——
         **沒選模式，第二句的範例根本給不出來**
         （自動給距離的例子、手動給旋鈕的例子，那是上一輪剛建立的關連）。
         讓他先進去看到一組通用範例，寫完才被退回來，比一開始就擋更糟。
       ⚠️ 這是這一節唯一一道門 —— 「第五課不用動手檢核」指的是
          不做關卡式的判定，不是連填表的順序都不管。 */
    function show(t) {
      if (t === 'show' && !f.mode)
        return viewDemo('⚠️ 先挑一種模式（**自動**或**手動**）再往下 —— ' +
                        '成果發表要寫的條件、範例、規格都跟著它走。', 'bad');
      tab = t;
      if (t === 'demo') viewDemo('', ''); else viewShow('', '');
    }

    function bind() {
      var on = function (id, fn) {
        var e = el.querySelector('#' + id); if (e) e.addEventListener('click', fn);
      };
      on('pj-make', doShow);
      /* ⚠️ 問不到的時候留一顆「重新讀取」—— 唯讀的欄位不能只留一句抱歉。 */
      on('pj-whoretry', function () {
        whoState = 'wait';
        var n = el.querySelector('#pj-who');
        if (n) { n.innerHTML = whoLine(); bind(); }
        if (typeof opts.onRetryWho === 'function') opts.onRetryWho();
      });
      on('pj-print', function () { printCard(cardHtml(f, meta())); });
      on('pj-png', function () { downloadPng(f, meta()); });
      on('pj-back', function () { show('show'); });
      on('pj-go-show', function () { show('show'); });
      /* ★ 兩塊都是開的，隨時可以來回 —— 這一節不是關卡（老師 2026-08-25）。 */
      el.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (tab === 'show') grab();
          show(b.getAttribute('data-tab'));
        });
      });
      el.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { f.mode = b.getAttribute('data-pick'); viewDemo('', ''); });
      });
    }

    show('demo');
    return { tab: function () { return tab; }, work: function () { return f; },
             setWho: setWho, whoState: function () { return whoState; },
             show: show, card: function () { return cardHtml(f, meta()); } };
  }

  global.PROJLAB = {
    MIN: MIN, MIN_IO: MIN_IO, MODES: MODES, SHOW_Q: SHOW_Q,
    judgeShow: judgeShow, sayShow: sayShow,
    OUTS: OUTS, specOf: specOf, inputOf: inputOf,
    AI_NEED: AI_NEED, aiText: aiText, aiReview: aiReview, aiOn: aiOn,
    cardHtml: cardHtml, cardLines: cardLines, drawCard: drawCard, printCard: printCard, downloadPng: downloadPng,
    mount: mount
  };

})(window);
