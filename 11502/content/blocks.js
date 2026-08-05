/* =====================================================================
   下學期 程式設計關卡：積木模擬器的題目
   ---------------------------------------------------------------------
   每一關：這一關給哪些積木（palette）、正確答案長什麼樣（goal）、
   任務說明（task）、以及給學生的提示（tips）。

   ★ 單元代號要與 config.js 的 CONFIG.UNITS 一致 ——
     那是 AI 批改星數的 key，也是作品備份的檔名編號，對不上就記錯關卡。
     check.py 會比對，不一致會被擋下來。

   ★ goal 的寫法
     { id:'積木代號', args:[參數…], children:[…] }
     args 省略就用積木的預設值；C 型積木才有 children。
     判定要求「積木種類、順序、參數、巢狀」全部一致 ——
     所以出題時參數要給得明確，不要留模稜兩可的空間。

   ★ 第 1、2 關的答案是從老師的 Scratch 原始檔轉過來的
     （11502_單元一.sb3、11502_單元二.sb3），數字一個都沒有改。
     學生在這裡組出來的東西，跟課堂上示範的會是同一支程式 ——
     如果模擬器的答案和投影片上的不一樣，學生只會更混亂。

   ⚠️ 目前只有 1～3 關。4～10 關要等課程的參考程式定案，
      而且 6～9 關（排序、搜尋）還需要引擎支援「回報值積木」
      （橢圓形、可以塞進別的積木裡的那種），現在做不出像樣的結構。
   ===================================================================== */
window.BLOCK_LEVELS = {

  /* ── 第 1 關：平行排列的正方形 ──────────────────────
     來源：11502_單元一.sb3
     教學重點：**定義一次、呼叫多次**。
     六個正方形靠「重複 6 次」產生，而不是複製六段一樣的積木 ——
     學生會親身感覺到「如果要改邊長，只要改一個地方」。

     注意落筆／提筆是包在「定義」裡面的：畫正方形這件事本身就該
     自己負責把筆放下、畫完收起來，主程式不必知道它有沒有用到筆。 */
  '2-1-1': {
    task: '用自訂積木畫出六個並排的正方形（邊長 30）。',
    tips: [
      '先「定義 畫正方形」：落筆 → 重複 4 次（移動 30、右轉 90）→ 提筆。',
      '落筆和提筆放在定義裡面，主程式就不用管筆。',
      '主程式先定位到 x:-140 y:-20（從左邊開始畫，六個才排得下）。',
      '再用重複 6 次：畫正方形 → 移動 60 點。移動 60、邊長 30，所以中間會留一格空白。'
    ],
    // 多給「左轉」當干擾 —— 左轉／右轉是最常見的搞混，
    // 調色盤剛好只有答案需要的積木，等於用湊的也能過。
    palette: [
      'events.whenflag',
      'motion.move', 'motion.turnright', 'motion.turnleft', 'motion.goto',
      'control.repeat',
      'my.define', 'my.call',
      'pen.clear', 'pen.down', 'pen.up'
    ],
    goal: [
      { id: 'my.define', args: ['畫正方形'], children: [
        { id: 'pen.down' },
        { id: 'control.repeat', args: [4], children: [
          { id: 'motion.move',      args: [30] },
          { id: 'motion.turnright', args: [90] }
        ]},
        { id: 'pen.up' }
      ]},
      { id: 'events.whenflag' },
      { id: 'pen.clear' },
      { id: 'motion.goto', args: [-140, -20] },
      { id: 'control.repeat', args: [6], children: [
        { id: 'my.call',     args: ['畫正方形'] },
        { id: 'motion.move', args: [60] }
      ]}
    ]
  },

  /* ── 第 2 關：愈畫愈大的正方形 ──────────────────────
     來源：11502_單元二.sb3
     教學重點：**函式的參數**。
     和第 1 關只差一件事 —— 同一個自訂積木，每次帶不同的邊長進去。
     這個對照是刻意的：學生會看出「參數讓同一段程式做出不同結果」。

     四個正方形從同一個角落畫起（中間沒有移動），所以會一個包一個。
     定義裡的「等待 0.2 秒」不是可有可無的裝飾 ——
     沒有它，四個正方形瞬間就畫完，學生看不到「一邊一邊畫」的過程。 */
  '2-1-2': {
    task: '用「有參數的自訂積木」畫出四個愈來愈大的正方形（邊長 50、100、150、200）。',
    tips: [
      '這次定義的是「畫正方形（邊長）」，裡面用「移動（邊長）點」。',
      '定義裡：落筆 → 重複 4 次（移動（邊長）、右轉 90、等待 0.2 秒）→ 提筆。',
      '等待 0.2 秒是為了看得到它一邊一邊畫，拿掉就一閃而過了。',
      '呼叫四次、填 50 / 100 / 150 / 200，中間不要移動，正方形才會從同一個角落長大。',
      '和上一關比一比：同一段程式，為什麼這次可以畫出四種大小？'
    ],
    // 干擾積木選得有意思：「移動 %n 點」和「移動（邊長）點」長得很像，
    // 但填死數字的那個會四個邊一樣長 —— 這正是本關要學生分辨的事。
    // 沒有參數的「畫正方形」也放進來，跟有參數的擺在一起比較。
    palette: [
      'events.whenflag',
      'motion.move', 'motion.turnright', 'motion.goto',
      'control.repeat', 'control.wait',
      'my.definep', 'my.callp', 'my.movearg', 'my.call',
      'pen.clear', 'pen.down', 'pen.up'
    ],
    goal: [
      { id: 'my.definep', args: ['畫正方形'], children: [
        { id: 'pen.down' },
        { id: 'control.repeat', args: [4], children: [
          { id: 'my.movearg' },
          { id: 'motion.turnright', args: [90] },
          { id: 'control.wait',     args: [0.2] }
        ]},
        { id: 'pen.up' }
      ]},
      { id: 'events.whenflag' },
      { id: 'pen.clear' },
      { id: 'motion.goto', args: [-120, 80] },
      { id: 'my.callp', args: ['畫正方形', 50] },
      { id: 'my.callp', args: ['畫正方形', 100] },
      { id: 'my.callp', args: ['畫正方形', 150] },
      { id: 'my.callp', args: ['畫正方形', 200] }
    ]
  },

  /* ── 第 3 關：正多邊形變化 ──────────────────────────
     ⚠️ 這一關**還沒有參考程式**，是照前兩關的風格擬的，老師可以改。
     教學重點：綜合應用，並帶出「外角總和 360 度」。
     正三角形轉 120 度、正方形 90 度、正六邊形 60 度 ——
     學生在填數字的過程中會自己發現 360 ÷ 邊數。

     這一關刻意不給自訂積木：邊數會變，而模擬器的自訂積木只吃一個參數，
     真要做成「畫正多邊形（邊數）」得同時把重複次數和轉的角度都算出來，
     那是下一步的事。先讓他們把三個圖形排好，看出 360÷N 的規律。 */
  '2-1-3': {
    task: '畫出正三角形、正方形、正六邊形各一個，而且三個不重疊。',
    tips: [
      '正 N 邊形＝重複 N 次（移動、右轉 360÷N 度）。',
      '三角形轉 120 度、正方形轉 90 度、六邊形轉 60 度 —— 看出規律了嗎？',
      '每個圖形都用「定位 → 落筆 → 重複 → 提筆」，換位置就不會黏在一起。',
      '三個圖形分別定位在 x:-160、-40、80，y 都是 -40。'
    ],
    palette: [
      'events.whenflag',
      'motion.move', 'motion.turnright', 'motion.goto',
      'control.repeat',
      'pen.clear', 'pen.down', 'pen.up', 'pen.color'
    ],
    goal: [
      { id: 'events.whenflag' },
      { id: 'pen.clear' },

      { id: 'motion.goto', args: [-160, -40] },
      { id: 'pen.down' },
      { id: 'control.repeat', args: [3], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [120] }
      ]},
      { id: 'pen.up' },

      { id: 'motion.goto', args: [-40, -40] },
      { id: 'pen.down' },
      { id: 'control.repeat', args: [4], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [90] }
      ]},
      { id: 'pen.up' },

      { id: 'motion.goto', args: [80, -40] },
      { id: 'pen.down' },
      { id: 'control.repeat', args: [6], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [60] }
      ]},
      { id: 'pen.up' }
    ]
  }

  /* 4～10 關：待課程參考程式定案後補上（老師會給 .sb3）。
     4  小島吃蟲      需要偵測與事件積木，結構因設計而異
     5  排隊比高矮    交換與找最小，引擎已有 list.swap
     6  選擇排序法  ┐
     7  插入排序法  │ 需要「回報值積木」才做得出真實結構
     8  循序搜尋法  │ （清單的第 (i) 項 要能塞進判斷裡）
     9  二元搜尋法  ┘
     10 搜尋大比拼    需要比較次數的計數顯示 */
};
