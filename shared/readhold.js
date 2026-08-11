/* =====================================================================
   閱讀停留：純閱讀的畫面要留住眼睛，不是留住分頁
   ---------------------------------------------------------------------
   ★ 為什麼要有
     沒有判定條件的步驟（情境解說、關卡說明），按一下就過去了。
     結果是：最需要讀的那幾個學生兩秒就滑到下一步，
     然後在那裡卡住，再回頭問「這題到底要幹嘛」。
     這幾十秒不是懲罰，是**把「讀完」變成一件真的發生過的事**。

   ★ 為什麼抽成一份
     兩學期各有一套閱讀倒數（11501 流程圖、11502 關卡頁），
     判斷條件本來就該一樣 —— 而它們已經走鐘過一次：

       2026-08-11 發現 11502 只判 visibilityState，
       用 Windows 鍵 ＋ ← / → 把兩個視窗並排就完全繞得過去。
       11501 那一版判了兩件事（沒這個洞），但**沒有保險絲**，
       環境一旦報不出焦點就永遠卡死。
       兩邊各自對一半、各自錯一半，而且沒有人會發現。

     ⇒ 規則放這裡（什麼叫「離開」、寬限幾秒、什麼時候重算、保險絲）。
       畫面文字留給各自的頁面 —— 11501 講得詳細、11502 只給數字，
       那是兩邊刻意的選擇，不是不一致。

   ★ 判「離開」要看兩件事
     ① document.visibilityState === 'hidden'   切分頁、最小化
     ② document.hasFocus() === false           視窗還看得見，焦點在別的視窗

     只看 ① 的話，並列視窗照樣倒數 —— 而且會把兩件事判反：
       切分頁去開 Scratch 看題目（我們要的）→ 暫停，被罰
       並列視窗在旁邊玩（我們不要的）      → 照常倒數

   ⚠️ 但 ② 不可以直接信（sawFocus）
     jsdom 的 document.hasFocus() 永遠回 false，
     內嵌瀏覽器、看板模式也可能一直回 false。
     直接信的話倒數會**永遠停在原地**，而畫面上只有一個不動的「暫停」，
     沒有任何錯誤訊息 —— 和 2026-08-10 那次 prerender 是同一種壞法。
     ⇒ 只有在「這個環境真的回報過一次有焦點」之後，失焦才算離開；
       沒回報過就當作一直有焦點。**寧可放過。**
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-11-readhold';

  var SEC = 30;          // 預設要停留幾秒
  var AWAY_RESET = 5;    // 離開超過幾秒才從頭算（之內只是暫停）
  var FUSE = 3;          // 保險絲：最久 SEC × FUSE 秒一定放行

  /* ── 「現在算不算不在讀」──────────────────────────
     sawFocus 的閂在這裡，一個計時器一份。 */
  function watcher(doc) {
    var sawFocus = false;
    return function () {
      /* 沒有 hasFocus 這個 API 的環境一律當作有焦點 */
      var focused = !doc.hasFocus || doc.hasFocus();
      if (focused) sawFocus = true;
      return doc.visibilityState === 'hidden' || (sawFocus && !focused);
    };
  }

  /**
   * 開始倒數。
   *
   * @param {object} o
   *   sec        這一次要停留幾秒（0 或負數 = 不用等，直接完成）
   *   left       從幾秒接著算（頁面重繪時傳目前秒數；預設 = sec）
   *   awayReset  離開幾秒才重算（預設 AWAY_RESET）
   *   doc        給測試換掉用（預設 document）
   *   onTick(v)  每秒一次。v = { left, state:'run'|'pause'|'reset' }
   *   onDone()   時間到
   * @return { stop(), away(), left() }
   *
   * ⚠️ 呼叫端一定要在重繪前 stop()。
   *    不停的話每重畫一次就多一個計時器在跑，倒數會愈跳愈快 ——
   *    而且畫面上完全看不出原因。
   */
  function start(o) {
    o = o || {};
    var doc = o.doc || global.document;
    var sec = o.sec == null ? SEC : o.sec;
    var left = o.left == null ? sec : o.left;
    var reset = o.awayReset == null ? AWAY_RESET : o.awayReset;
    var isAway = watcher(doc);
    var awayFor = 0;
    var timer = null;

    /* 保險絲：不管發生什麼事，最久 sec × FUSE 秒一定放行。
       ★ 為什麼需要
         倒數是靠 visibilityState 和 hasFocus 決定要不要扣秒的。
         只要有任何一個瀏覽器（或內嵌瀏覽器、或某個外掛）
         把狀態一直報成非 visible／永遠沒有焦點，學生就會**永遠卡住**，
         而畫面上只會看到一個不動的秒數，沒有任何錯誤訊息。
       ⇒ 擋錯人的代價遠大於少讀 30 秒，所以一定要有出口。
       ⇒ 這也是「離開座位」的出口：時間到了就算沒焦點也照樣倒數完。
         那是刻意留的 —— 一個被叫去辦公室的學生不該永遠回不來。 */
    var deadline = Date.now() + sec * FUSE * 1000;

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function tickOut(st) { if (o.onTick) o.onTick({ left: left, state: st || 'run' }); }
    function finish() { stop(); left = 0; if (o.onDone) o.onDone(); }

    /* 不用等的情況（例如已經通關的關卡回來查資料）直接結束，
       不要開一個一秒後才會發現「其實不用等」的計時器。 */
    if (!(sec > 0) || !(left > 0)) { finish(); return api(); }

    tickOut();
    timer = setInterval(function () {
      if (isAway() && Date.now() < deadline) {
        awayFor++;
        /* ★ 離開超過寬限期 → 從頭算。
           只暫停的話「並排掛著」是零成本：回來按一下就過關，
           眼睛從頭到尾沒看過這一頁。
           ⚠️ 但寬限期不可以拿掉。通知跳出來、按到工作列、
              輸入法搶焦點、被老師叫一句話回頭 —— 這些都在幾秒內結束，
              而且發生在**認真的學生**身上最多。
              沒有寬限期的「離開就重來」，罰到的會是最乖的那一個。 */
        if (awayFor >= reset) left = sec;
        tickOut(awayFor >= reset ? 'reset' : 'pause');
        return;
      }
      awayFor = 0;
      left--;
      if (left > 0) { tickOut(); return; }
      finish();
    }, 1000);

    function api() {
      return {
        stop: stop,
        /** 現在算不算離開（頁面想在 blur 當下就換文字時用） */
        away: function () { return isAway(); },
        left: function () { return left; }
      };
    }
    return api();
  }

  global.READHOLD = {
    VERSION: VERSION,
    SEC: SEC,
    AWAY_RESET: AWAY_RESET,
    FUSE: FUSE,
    start: start,
    _watcher: watcher
  };
})(typeof window !== 'undefined' ? window : this);
