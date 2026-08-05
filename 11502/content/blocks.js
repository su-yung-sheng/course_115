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

   ⚠️ 目前只有 1～3 關。4～10 關要等課程的參考程式定案，
      而且 6～9 關（排序、搜尋）還需要引擎支援「回報值積木」
      （橢圓形、可以塞進別的積木裡的那種），現在做不出像樣的結構。
   ===================================================================== */
window.BLOCK_LEVELS = {

  /* ── 第 1 關：平行排列的正方形 ──────────────────────
     教學重點：**定義一次、呼叫多次**。
     刻意讓三個正方形靠「重複 3 次」產生，而不是複製三段一樣的積木 ——
     學生會親身感覺到「如果要改邊長，只要改一個地方」。 */
  '2-1-1': {
    task: '用自訂積木畫出三個並排的正方形。',
    tips: [
      '先「定義 畫正方形」，裡面用重複 4 次畫出四個邊。',
      '主程式用重複 3 次：落筆 → 畫正方形 → 提筆 → 往右移動。',
      '畫完一個正方形，小貓會回到原點、方向不變，所以可以直接往右走。'
    ],
    // 多給「左轉」當干擾 —— 左轉／右轉是最常見的搞混，
    // 調色盤剛好只有答案需要的積木，等於用湊的也能過。
    palette: [
      'events.whenflag',
      'motion.move', 'motion.turnright', 'motion.turnleft',
      'control.repeat',
      'my.define', 'my.call',
      'pen.clear', 'pen.down', 'pen.up'
    ],
    goal: [
      { id: 'my.define', args: ['畫正方形'], children: [
        { id: 'control.repeat', args: [4], children: [
          { id: 'motion.move',      args: [60] },
          { id: 'motion.turnright', args: [90] }
        ]}
      ]},
      { id: 'events.whenflag' },
      { id: 'pen.clear' },
      { id: 'control.repeat', args: [3], children: [
        { id: 'pen.down' },
        { id: 'my.call', args: ['畫正方形'] },
        { id: 'pen.up' },
        { id: 'motion.move', args: [90] }
      ]}
    ]
  },

  /* ── 第 2 關：逐漸擴大的正方形 ──────────────────────
     教學重點：**函式的參數**。
     和第 1 關只差一件事 —— 同一個自訂積木，每次帶不同的邊長進去。
     這個對照是刻意的：學生會看出「參數讓同一段程式做出不同結果」。 */
  '2-1-2': {
    task: '用「有參數的自訂積木」畫出三個愈來愈大的正方形（邊長 40、70、100）。',
    tips: [
      '這次定義的是「畫正方形（邊長）」，裡面用「移動（邊長）點」。',
      '呼叫時填不同的數字，就會畫出不同大小。',
      '和上一關比一比：同一段程式，為什麼這次可以畫出三種大小？'
    ],
    palette: [
      'events.whenflag',
      'motion.turnright',
      'control.repeat',
      'my.definep', 'my.callp', 'my.movearg',
      'pen.clear', 'pen.down', 'pen.up'
    ],
    goal: [
      { id: 'my.definep', args: ['畫正方形'], children: [
        { id: 'control.repeat', args: [4], children: [
          { id: 'my.movearg' },
          { id: 'motion.turnright', args: [90] }
        ]}
      ]},
      { id: 'events.whenflag' },
      { id: 'pen.clear' },
      { id: 'pen.down' },
      { id: 'my.callp', args: ['畫正方形', 40] },
      { id: 'my.callp', args: ['畫正方形', 70] },
      { id: 'my.callp', args: ['畫正方形', 100] }
    ]
  },

  /* ── 第 3 關：正多邊形變化 ──────────────────────────
     教學重點：綜合應用，並帶出「外角總和 360 度」。
     正三角形轉 120 度、正方形 90 度、正六邊形 60 度 ——
     學生在填數字的過程中會自己發現 360 ÷ 邊數。
     這一關不再給「定位」類積木，逼他們用畫筆的提筆／落筆分隔圖形。 */
  '2-1-3': {
    task: '畫出正三角形、正方形、正六邊形各一個，而且三個不重疊。',
    tips: [
      '正 N 邊形＝重複 N 次（移動、右轉 360÷N 度）。',
      '三角形轉 120 度、正方形轉 90 度、六邊形轉 60 度 —— 看出規律了嗎？',
      '每畫完一個就提筆、往右移動一段、再落筆，圖形才不會黏在一起。'
    ],
    palette: [
      'events.whenflag',
      'motion.move', 'motion.turnright',
      'control.repeat',
      'pen.clear', 'pen.down', 'pen.up', 'pen.color'
    ],
    goal: [
      { id: 'events.whenflag' },
      { id: 'pen.clear' },

      { id: 'pen.down' },
      { id: 'control.repeat', args: [3], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [120] }
      ]},
      { id: 'pen.up' },
      { id: 'motion.move', args: [90] },

      { id: 'pen.down' },
      { id: 'control.repeat', args: [4], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [90] }
      ]},
      { id: 'pen.up' },
      { id: 'motion.move', args: [90] },

      { id: 'pen.down' },
      { id: 'control.repeat', args: [6], children: [
        { id: 'motion.move',      args: [60] },
        { id: 'motion.turnright', args: [60] }
      ]}
    ]
  }

  /* 4～10 關：待課程參考程式定案後補上。
     4  小島吃蟲      需要偵測與事件積木，結構因設計而異
     5  排隊比高矮    交換與找最小，引擎已有 list.swap
     6  選擇排序法  ┐
     7  插入排序法  │ 需要「回報值積木」才做得出真實結構
     8  循序搜尋法  │ （清單的第 (i) 項 要能塞進判斷裡）
     9  二元搜尋法  ┘
     10 搜尋大比拼    需要比較次數的計數顯示 */
};
