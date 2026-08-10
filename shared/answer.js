/* =====================================================================
   判「學生寫的一段話，有沒有講到這幾個概念」
   ---------------------------------------------------------------------
   開放式作答的判定引擎。**不呼叫任何網路**，可以單獨測。

   ★ 第一原則：寧可放過，不可錯殺
     這一頁的每一次誤判，學生感受到的是「我明明懂，它說我不懂」。
     發生兩次，他就會開始猜系統想看什麼字、為了過關而堆關鍵字 ——
     那和我們要測的東西正好相反。
     所以：
       · 講到一個概念就有分（部分給分），不是全對才算
       · 錯誤觀念（avoid）只降級、不歸零
       · 分數加總用四捨五入，2.5 進位成 3 —— 邊界一律往學生那邊倒

   ★ 為什麼關鍵字比對要用 AIGUIDE.hitKeys，不自己再寫一份
     這套規則在這個 repo 裡已經有兩份（shared/ai-guide.js 和
     aiguide.gs 的 hitKeys_，前端後端各一份，註解裡寫明要一起改）。
     再寫第三份的話，「學生寫『一直重複』算不算命中」這件事
     就會有三個答案，而且不會有人發現它們什麼時候開始不一樣。

   ⚠️ 這裡判的是「有沒有講到」，不是「講得對不對」。
      關鍵字比對做不到後者 —— 那是 AI 覆核那一段的事，
      而覆核**只能加分**（見 shared/quiz.js）。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-10-answer';

  /* 空話。學生寫「我覺得就是這樣啊」時，拿掉這些字就什麼都不剩了。
     ⚠️ 這份清單只用來算「有沒有內容」，不用來扣分。 */
  var FILLER = /[的了嗎吧啊呀喔耶欸就是我覺得應該可能大概反正然後而且所以因為這個那個東西什麼怎麼很真的好像不知道不會]/g;

  /** 去掉標點與空白之後有幾個字 */
  function len(t) {
    return String(t == null ? '' : t).replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—]/g, '').length;
  }
  /** 拿掉空話之後還剩幾個字 —— 這才是「有沒有講東西」 */
  function meat(t) {
    return String(t == null ? '' : t)
      .replace(/[\s，。、？！?!.,;:「」『』（）()~～\-—]/g, '')
      .replace(FILLER, '').length;
  }

  /** 關鍵概念比對。★ 一律走 AIGUIDE.hitKeys，不在這裡另寫一套。 */
  function hit(text, groups) {
    if (global.AIGUIDE && global.AIGUIDE.hitKeys) {
      return global.AIGUIDE.hitKeys(text, groups);
    }
    /* ai-guide.js 沒載到的退路。
       ⚠️ 這條路只是「不要整頁壞掉」，不是第二套規則 ——
          所以做得和 hitKeys 一模一樣，而且測試會盯著它。 */
    var t = String(text == null ? '' : text), got = [], miss = [];
    (groups || []).forEach(function (g) {
      var words = [].concat(g.any || g);
      var ok = words.some(function (w) { return w && t.indexOf(w) >= 0; });
      (ok ? got : miss).push(g.name || words[0]);
    });
    return { hit: got, miss: miss, done: (groups || []).length > 0 && miss.length === 0 };
  }

  /* ── 判一題 ───────────────────────────────────────
     spec: {
       need:  [{ name:'會重複做', any:['重複','一直','很多次'] }, …]  要講到的概念
       avoid: [{ name:'以為是因為程式太長', any:['太長','很長'], why:'…' }]  常見誤解
       min:   8      至少要寫幾個字（去掉標點）
       full:  2      講到幾個概念算「完全懂」（預設＝need 的數量）
     }
     回傳 { level:'full'|'part'|'none', got:[], miss:[], warn:[], score, why } */
  function judge(text, spec) {
    spec = spec || {};
    var t = String(text == null ? '' : text).trim();
    var need = spec.need || [];
    var full = spec.full || need.length || 1;
    var min = spec.min || 8;

    if (!t) {
      return out('none', [], need.map(nameOf), [], '還沒寫。用自己的話寫幾句，寫不完整也沒關係。');
    }

    /* ★ 先比對概念，再看長度 —— 順序不可以反過來。
       「要拼很多次好累喔」只有 8 個字，但他確實講到了重點。
       先擋長度的話，這種答案會被判成零分 ——
       而那正是最會讓學生失去信任的一種誤判：**他答對了，系統說他沒答。**
       ⇒ 規則：只要講到任何一個概念，就不再管字數。 */
    var k = hit(t, need);

    if (!k.hit.length) {
      /* 太短不是答錯，是還沒開始答 —— 要說清楚為什麼。 */
      if (len(t) < min) {
        return out('none', [], need.map(nameOf), [],
                   '再多寫一點（至少 ' + min + ' 個字）。想到什麼寫什麼，不必寫得漂亮。');
      }
      if (meat(t) < 4) {
        return out('none', [], need.map(nameOf), [],
                   '這幾句話裡看不出你的想法。試著講「為什麼」或「會怎麼樣」。');
      }
    }
    var warn = [];
    (spec.avoid || []).forEach(function (g) {
      var words = [].concat(g.any || g);
      if (words.some(function (w) { return w && t.indexOf(w) >= 0; })) {
        warn.push({ name: g.name || words[0], why: g.why || '' });
      }
    });

    var level = k.hit.length >= full ? 'full' : k.hit.length >= 1 ? 'part' : 'none';
    /* ★ 錯誤觀念只降一級，不歸零。
       他可能兩件事都寫了（一個對、一個是誤解）——
       把他打成零分，等於告訴他「寫多了會被扣分」，
       那會讓所有人只敢寫一句話。 */
    if (warn.length && level === 'full') level = 'part';

    return out(level, k.hit, k.miss, warn, whyOf(level, k, warn));
  }

  function nameOf(g) { return g.name || [].concat(g.any || g)[0]; }

  function whyOf(level, k, warn) {
    if (level === 'full') {
      return warn.length
        ? '重點都講到了。不過「' + warn[0].name + '」那個想法要再想一下 ——' +
          (warn[0].why || '它不是關鍵。')
        : '你講到了：' + k.hit.join('、') + '。這一題想通了。';
    }
    if (level === 'part') {
      return '你講到了：' + k.hit.join('、') + '。還差：' + k.miss.join('、') + '。' +
             (warn.length && warn[0].why ? '（另外，' + warn[0].why + '）' : '');
    }
    /* ★ 完全沒講到、但踩到了常見誤解 —— 這是最該把話講明白的時候。
       只說「沒碰到重點」的話，他重寫一次還是會寫一樣的東西。 */
    if (warn.length) {
      return '你的想法是「' + warn[0].name + '」。' + (warn[0].why || '') +
             '再想想「' + (k.miss[0] || '') + '」這個方向。';
    }
    return '這幾句還沒碰到重點。回去看情境那一段，想想「' + (k.miss[0] || '') + '」。';
  }

  function out(level, got, miss, warn, why) {
    return { level: level, got: got, miss: miss, warn: warn, why: why, score: SCORE[level] };
  }

  /* 每一題的分數。
     ★ 為什麼有「半分」
       開放式作答很少是全對或全錯。只給 0/1 的話，
       講到一半的人和什麼都沒寫的人同一個下場 —— 那不公平，
       而且他會覺得「認真寫沒有比較好」。 */
  var SCORE = { full: 1, part: 0.5, none: 0 };

  /** 一整份的總分。★ 四捨五入 —— 邊界往學生那邊倒（2.5 → 3）。 */
  function total(results) {
    var s = (results || []).reduce(function (a, r) { return a + (r && r.score || 0); }, 0);
    return Math.round(s);
  }

  global.ANSWER = {
    VERSION: VERSION,
    judge: judge,
    total: total,
    SCORE: SCORE,
    _len: len,
    _meat: meat,
    _hit: hit
  };

})(typeof window !== 'undefined' ? window : this);
