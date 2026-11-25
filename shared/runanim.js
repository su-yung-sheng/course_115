/* =====================================================================
   5016B「▶ 執行結果」動畫（老師 2026-11-25）
   ---------------------------------------------------------------------
   ★ 老師：「能夠幫程式設計一個執行結果動畫? 以程式當中使用到的元件就好」
     ＋選了「第 1～4 節都做」「邊跑邊亮那一行」。
     ⇒ 程式碼上方一塊動畫：左邊只畫**程式裡用到的元件**，右邊是同一段程式，
        正在執行的那一行會亮起來；變數的值即時顯示。
   ★ 和「硬體行為模擬」不一樣：模擬器是學生自己拉；這裡是**照程式一行一行跑**，
     輸入（人走近走遠、旋鈕轉動）是自動播放的劇本。
   ⚠️ 程式的每一行都要和 5016b.html 的「邏輯解析」一字不差（runanim.test.js 會比對）——
     改了程式碼就要一起改這裡。
   ⚠️ 換算：
     · 第二節「對應」用 Arduino map()（整數、小數捨去），和第二節模擬器同一條。
     · 「類比對應」(A7, 下限, 上限) 用四捨五入，和第四節模擬器同一條（實機取法未驗證）。
     · 第四節模式二照程式的 sin 公式算紅綠藍（Scratch 的 sin 是**角度**）。
   ===================================================================== */
(function (global) {
  'use strict';

  var STEP = { slow: 650, normal: 400, fast: 160 };   // 每一行亮多久（毫秒）；「等待 X 秒」一律照真的秒數

  function amap(x, a, b, c, d) { return Math.trunc((x - a) * (d - c) / (b - a)) + c; }       // Arduino map()
  function amapA7(v, lo, hi) { return Math.round(lo + (v / 1023) * (hi - lo)); }              // 類比對應
  function sinDeg(d) { return Math.sin(d * Math.PI / 180); }
  function rgbOf(hue) {
    return [Math.floor(sinDeg(hue) * 127 + 128), Math.floor(sinDeg(hue + 120) * 127 + 128), Math.floor(sinDeg(hue + 240) * 127 + 128)];
  }
  /* 畫面上的負號用全形「−」（和頁面上的程式碼、glossary.test 一致） */
  function num(n) { return typeof n === 'number' && n < 0 ? '−' + (-n) : String(n); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** 劇本：[[秒, 值], …] 線性內插，循環播放 */
  function track(points) {
    var total = points[points.length - 1][0];
    return function (t) {
      t = ((t % total) + total) % total;
      for (var i = 1; i < points.length; i++) {
        if (t <= points[i][0]) {
          var a = points[i - 1], b = points[i], f = (t - a[0]) / ((b[0] - a[0]) || 1);
          return a[1] + (b[1] - a[1]) * f;
        }
      }
      return points[points.length - 1][1];
    };
  }
  function blank() { var a = []; for (var i = 0; i < 8; i++) a.push([0, 0, 0]); return a; }

  /* ── 各節：程式（每一行的縮排＋文字）、怎麼跑、畫哪些元件 ───────────
     progs[i](io) 是 generator：先做完這一行的事，再 yield { l: 第幾行, note: 條件成立沒 }；
     「等待」那一行 yield { l, wait: 秒 }。 */
  var LESSONS = {
    u1: {
      title: '感應大門',
      comps: ['sonar', 'motor', 'door'],
      input: { kind: 'dist', max: 60, track: track([[0, 50], [3, 6], [11, 6], [12.5, 20], [18, 20], [20, 50], [27, 50]]) },
      modes: [{
        key: 'main', label: '',
        blocks: [{ title: 'auto_door', lines: [
          [0, '變數 門的狀態 設為 「關」'],
          [0, '無限重複執行'],
          [1, '變數 距離 設為 讀取超音波距離感測器 (公分)'],
          [1, '如果 距離 < 10 而且 門的狀態 = 「關」 則'],
          [2, '設定 馬達 250'],
          [2, '等待 2 秒'],
          [2, '設定 馬達 0'],
          [2, '門的狀態 設為 「開」'],
          [1, '如果 距離 > 30 而且 門的狀態 = 「開」 則'],
          [2, '設定 馬達 −250'],
          [2, '等待 2 秒'],
          [2, '設定 馬達 0'],
          [2, '門的狀態 設為 「關」']
        ] }],
        progs: [function* (io) {
          io.v['門的狀態'] = '關'; yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['距離'] = Math.round(io.read()); yield { l: 2 };
            var c1 = io.v['距離'] < 10 && io.v['門的狀態'] === '關';
            yield { l: 3, note: c1 };
            if (c1) {
              io.out.motor = 250; yield { l: 4 };
              yield { l: 5, wait: 2 };
              io.out.motor = 0; yield { l: 6 };
              io.v['門的狀態'] = '開'; yield { l: 7 };
            }
            var c2 = io.v['距離'] > 30 && io.v['門的狀態'] === '開';
            yield { l: 8, note: c2 };
            if (c2) {
              io.out.motor = -250; yield { l: 9 };
              yield { l: 10, wait: 2 };
              io.out.motor = 0; yield { l: 11 };
              io.v['門的狀態'] = '關'; yield { l: 12 };
            }
          }
        }]
      }]
    },
    u2: {
      title: '迎賓走廊',
      comps: ['sonar', 'strip'],
      input: { kind: 'dist', max: 55, track: track([[0, 55], [10, 2], [12, 2], [22, 55], [24, 55]]) },
      modes: [{
        key: '1', label: '按 1：亮度模式',
        blocks: [{ title: '模式一：亮度（按 1）', lines: [
          [0, '當按下按鍵 1'],
          [0, '無限重複執行'],
          [1, '變數 距離 設為 讀取超音波 (Trig A2, Echo A3)'],
          [1, '變數 亮度 設為 對應 (距離, 55 → 1, 1 → 200)'],
          [1, '設定燈條 全部 顏色 = (亮度, 亮度, 亮度)'],
          [1, '等待 0.4 秒']
        ] }],
        progs: [function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['距離'] = Math.round(io.read()); yield { l: 2 };
            io.v['亮度'] = amap(io.v['距離'], 55, 1, 1, 200); yield { l: 3 };
            var b = io.v['亮度'];
            for (var i = 0; i < 8; i++) io.out.leds[i] = [b, b, b];
            yield { l: 4 };
            yield { l: 5, wait: 0.4 };
          }
        }]
      }, {
        key: '2', label: '按 2：位置模式',
        blocks: [{ title: '模式二：位置（按 2）', lines: [
          [0, '當按下按鍵 2'],
          [0, '無限重複執行'],
          [1, '變數 距離 設為 讀取超音波 (Trig A2, Echo A3)'],
          [1, '變數 燈號 設為 對應 (距離, 55 → 1, 1 → 8)'],
          [1, '設定燈條 第 燈號 顆 顏色 = (50, 50, 50)'],
          [1, '等待 0.4 秒'],
          [1, '設定燈條 第 燈號 顆 顏色 = (0, 0, 0)']
        ] }],
        progs: [function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['距離'] = Math.round(io.read()); yield { l: 2 };
            io.v['燈號'] = amap(io.v['距離'], 55, 1, 1, 8); yield { l: 3 };
            var n = io.v['燈號'];
            if (n >= 1 && n <= 8) io.out.leds[n - 1] = [50, 50, 50];
            yield { l: 4 };
            yield { l: 5, wait: 0.4 };
            if (n >= 1 && n <= 8) io.out.leds[n - 1] = [0, 0, 0];
            yield { l: 6 };
          }
        }]
      }]
    },
    u3: {
      title: '無段風扇',
      comps: ['knob', 'motor', 'stage'],
      input: { kind: 'knob', track: track([[0, 0], [9, 1023], [11, 1023], [15, 512], [19, 512], [28, 0], [30, 0]]) },
      modes: [{
        key: 'main', label: '',
        blocks: [{ title: '角色一：指針', lines: [
          [0, '當綠旗被點擊'],
          [0, '無限重複執行'],
          [1, '變數 角度 設為 類比對應 (A7, 0, 180)'],
          [1, '面向 角度 度']
        ] }, { title: '角色二：風扇', lines: [
          [0, '當綠旗被點擊'],
          [0, '無限重複執行'],
          [1, '變數 轉速 設為 類比對應 (A7, −250, 250)'],
          [1, '設定馬達 (腳位2、3) = 轉速'],
          [1, '右轉 (轉速 ÷ 5) 度']
        ] }],
        /* ★ 兩個角色各自有「當綠旗被點擊」⇒ 兩段程式**同時**在跑，兩邊各亮一行 */
        progs: [function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['角度'] = amapA7(io.read(), 0, 180); yield { l: 2 };
            io.out.pointer = io.v['角度']; yield { l: 3 };
          }
        }, function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['轉速'] = amapA7(io.read(), -250, 250); yield { l: 2 };
            io.out.motor = io.v['轉速']; yield { l: 3 };
            io.out.fanSprite = (io.out.fanSprite || 0) + io.v['轉速'] / 5; yield { l: 4 };
          }
        }]
      }]
    },
    u4: {
      title: '情境照明',
      comps: ['knob', 'strip'],
      input: { kind: 'knob', track: track([[0, 0], [18, 1023], [20, 1023], [38, 0], [40, 0]]) },
      modes: [{
        key: '1', label: '按 1：燈號移動',
        blocks: [{ title: '模式一：燈號移動（按 1）', lines: [
          [0, '當按下按鍵 1'],
          [0, '無限重複執行'],
          [1, '變數 燈號 設為 類比對應 (A7, 1, 8)'],
          [1, '設定燈條 第 燈號 顆 = (50,50,50)'],
          [1, '等待 0.4 秒'],
          [1, '設定燈條 全部 = (0,0,0)']
        ] }],
        progs: [function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['燈號'] = amapA7(io.read(), 1, 8); yield { l: 2 };
            io.out.leds[io.v['燈號'] - 1] = [50, 50, 50]; yield { l: 3 };
            yield { l: 4, wait: 0.4 };
            for (var i = 0; i < 8; i++) io.out.leds[i] = [0, 0, 0];
            yield { l: 5 };
          }
        }]
      }, {
        key: '2', label: '按 2：混色',
        blocks: [{ title: '模式二：混色（按 2）', lines: [
          [0, '當按下按鍵 2'],
          [0, '無限重複執行'],
          [1, '變數 顏色 設為 類比對應 (A7, 0, 359)'],
          [1, '變數 紅 設為 無條件捨去( sin(顏色) × 127 + 128 )'],
          [1, '變數 綠 設為 無條件捨去( sin(顏色+120) × 127 + 128 )'],
          [1, '變數 藍 設為 無條件捨去( sin(顏色+240) × 127 + 128 )'],
          [1, '設定燈條 全部 = (紅, 綠, 藍)']
        ] }],
        progs: [function* (io) {
          yield { l: 0 };
          for (;;) {
            yield { l: 1 };
            io.v['顏色'] = amapA7(io.read(), 0, 359); yield { l: 2 };
            var c = rgbOf(io.v['顏色']);
            io.v['紅'] = c[0]; yield { l: 3 };
            io.v['綠'] = c[1]; yield { l: 4 };
            io.v['藍'] = c[2]; yield { l: 5 };
            for (var i = 0; i < 8; i++) io.out.leds[i] = c.slice();
            yield { l: 6 };
          }
        }]
      }]
    }
  };

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.ra{border:2px solid #c7d2fe;border-radius:18px;background:#fff;padding:14px;margin-bottom:18px}' +
  '.ra-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;margin-bottom:10px}' +
  '.ra-title{font-weight:900;color:#1e293b;font-size:17px}' +
  '.ra-btns{display:flex;flex-wrap:wrap;gap:6px}' +
  '.ra-btn{font-weight:800;font-size:13px;border:2px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:5px 10px;cursor:pointer}' +
  '.ra-btn.on{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
  '.ra-grid{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}' +
  '@media(min-width:900px){.ra-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}' +
  '.ra-stage{background:#0f172a;border-radius:14px;padding:14px;color:#e2e8f0;display:flex;flex-direction:column;justify-content:center;gap:16px;min-height:220px}' +
  '.ra-cap{font-size:12px;color:#94a3b8;font-weight:800;text-align:center;margin-top:5px}' +
  '.ra-row{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;align-items:center}' +
  '.ra-code{background:#1e1e1e;border-radius:14px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#cbd5e1;overflow-x:auto}' +
  '.ra-blk+.ra-blk{margin-top:10px;border-top:1px dashed #475569;padding-top:8px}' +
  '.ra-bt{font-size:11px;color:#94a3b8;margin-bottom:4px}' +
  '.ra-ln{padding:3px 8px;border-radius:6px;white-space:pre;transition:background .12s}' +
  '.ra-ln.now{background:#fde047;color:#1e1e1e;font-weight:800}' +
  '.ra-note{font-size:11px;font-weight:900;margin-left:8px;padding:1px 6px;border-radius:6px}' +
  '.ra-note.y{background:#16a34a;color:#fff}.ra-note.n{background:#64748b;color:#fff}.ra-note.w{background:#4f46e5;color:#fff}' +
  '.ra-vars{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;min-height:26px}' +
  '.ra-var{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:3px 8px;font-size:13px;font-weight:800;color:#3730a3}' +
  '.ra-var b{color:#0f172a}' +
  '.ra-tip{font-size:12px;color:#64748b;margin-top:8px;line-height:1.6}';

  function ensureCss(doc) {
    if (doc.getElementById('ra-css')) return;
    var s = doc.createElement('style');
    s.id = 'ra-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* 元件的樣子（只畫程式裡用到的）。每個回傳 { html, draw(st, R) } */
  var COMP = {
    sonar: function (L) {
      return {
        html: '<div style="width:100%"><div style="position:relative;height:64px;border-bottom:2px dashed #334155">' +
              '<div style="position:absolute;left:0;top:10px;width:46px;height:40px;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px">' +
                '<span style="width:15px;height:15px;border-radius:50%;background:#cbd5e1;border:3px solid #94a3b8"></span>' +
                '<span style="width:15px;height:15px;border-radius:50%;background:#cbd5e1;border:3px solid #94a3b8"></span></div>' +
              '<div data-r="wave" style="position:absolute;left:50px;top:28px;height:4px;background:repeating-linear-gradient(90deg,#38bdf8 0 6px,transparent 6px 12px)"></div>' +
              '<div data-r="person" style="position:absolute;top:4px;font-size:40px;line-height:1;transform:scaleX(-1)">🚶</div></div>' +
              '<div class="ra-cap">超音波距離感測器（Trig A2、Echo A3）　人在 <b data-r="dist" style="color:#38bdf8;font-size:15px">0</b> 公分</div></div>',
        draw: function (st, R) {
          var d = Math.max(0, Math.min(L.input.max, st.input));
          var pct = 12 + (d / L.input.max) * 78;
          R.person.style.left = 'calc(' + pct + '% - 8px)';
          R.wave.style.width = 'calc(' + (pct - 12) + '% - 4px)';
          R.dist.textContent = Math.round(st.input);
        }
      };
    },
    motor: function () {
      return {
        html: '<div style="text-align:center"><div style="width:84px;height:84px;border-radius:50%;background:#fff;border:4px solid #64748b;position:relative;margin:auto;display:flex;align-items:center;justify-content:center">' +
              '<div data-r="blade" style="position:absolute;width:10px;height:70px;background:#f59e0b;border-radius:6px"></div>' +
              '<div data-r="blade2" style="position:absolute;width:70px;height:10px;background:#f59e0b;border-radius:6px"></div>' +
              '<div style="width:16px;height:16px;border-radius:50%;background:#94a3b8;position:relative"></div></div>' +
              '<div class="ra-cap">直流馬達（腳位 2、3）<br>轉速 <b data-r="mv" style="color:#fbbf24;font-size:14px">0</b>　<span data-r="mdir">■ 停</span></div></div>',
        draw: function (st, R) {
          var m = st.out.motor || 0;
          R.blade.style.transform = R.blade2.style.transform = 'rotate(' + st.motorAngle + 'deg)';
          R.mv.textContent = num(Math.round(m));
          R.mdir.textContent = m > 0 ? '正轉 ▶' : (m < 0 ? '◀ 反轉' : '■ 停');
        }
      };
    },
    door: function () {
      return {
        html: '<div style="text-align:center"><div style="width:120px;height:90px;border:4px solid #94a3b8;border-bottom:none;position:relative;overflow:hidden;margin:auto;background:#1e293b">' +
              '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b">門口</div>' +
              '<div data-r="panel" style="position:absolute;top:0;bottom:0;left:0;width:100%;background:linear-gradient(90deg,#78716c,#a8a29e);border-right:3px solid #57534e"></div></div>' +
              '<div class="ra-cap">門（馬達帶動）　開了 <b data-r="dpct" style="color:#a7f3d0;font-size:14px">0</b>%</div></div>',
        draw: function (st, R) {
          R.panel.style.transform = 'translateX(' + (-st.door * 96) + '%)';
          R.dpct.textContent = Math.round(st.door * 100);
        }
      };
    },
    strip: function () {
      var dots = '';
      for (var i = 0; i < 8; i++) dots += '<div style="text-align:center"><div data-r="led' + i + '" style="width:26px;height:26px;border-radius:50%;border:2px solid #334155;background:#000"></div><div style="font-size:10px;color:#64748b">' + (i + 1) + '</div></div>';
      return {
        html: '<div style="text-align:center"><div style="display:flex;gap:6px;justify-content:center">' + dots + '</div>' +
              '<div class="ra-cap">RGB 燈條（WS2812B，8 顆）</div></div>',
        draw: function (st, R) {
          for (var i = 0; i < 8; i++) {
            var c = st.out.leds[i] || [0, 0, 0], r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b);
            /* 白光（三個數字一樣）：亮度 1～200、(50,50,50) 在螢幕上太暗 ⇒ 顯示時拉亮一點，0 一樣是黑的。
               混色照實際的紅綠藍。 */
            if (mx > 0 && r === g && g === b) { var k = Math.round(70 + mx / 200 * 185); r = g = b = Math.min(255, k); }
            R['led' + i].style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
            R['led' + i].style.boxShadow = mx > 0 ? '0 0 ' + Math.round(6 + mx / 20) + 'px rgba(' + r + ',' + g + ',' + b + ',.8)' : 'none';
          }
        }
      };
    },
    knob: function () {
      return {
        html: '<div style="text-align:center"><div style="width:70px;height:70px;border-radius:50%;background:#e2e8f0;border:4px solid #64748b;position:relative;margin:auto">' +
              '<div data-r="kn" style="position:absolute;left:29px;top:3px;width:4px;height:28px;background:#f59e0b;border-radius:3px;transform-origin:2px 28px"></div></div>' +
              '<div class="ra-cap">可變電阻（A7）　讀到 <b data-r="kv" style="color:#fbbf24;font-size:14px">0</b> ／ 1023</div></div>',
        draw: function (st, R) {
          R.kn.style.transform = 'rotate(' + (-135 + st.input / 1023 * 270) + 'deg)';
          R.kv.textContent = Math.round(st.input);
        }
      };
    },
    stage: function () {
      return {
        html: '<div style="text-align:center"><div style="display:flex;gap:18px;justify-content:center;background:#f8fafc;border-radius:10px;padding:10px 14px">' +
              '<div style="width:70px;height:70px;position:relative"><div data-r="ptr" style="position:absolute;left:35px;top:33px;width:32px;height:4px;background:#e11d48;transform-origin:0 2px;border-radius:2px"></div>' +
                '<div style="position:absolute;left:29px;top:29px;width:12px;height:12px;border-radius:50%;background:#1e293b"></div></div>' +
              '<div style="width:70px;height:70px;display:flex;align-items:center;justify-content:center"><div data-r="fs" style="font-size:46px;line-height:1;color:#0ea5e9">✤</div></div></div>' +
              '<div class="ra-cap">電腦舞台上的角色：指針（面向 <b data-r="pv" style="color:#fda4af">90</b> 度）、風扇圖</div></div>',
        draw: function (st, R) {
          /* Scratch 的方向：0＝朝上、90＝朝右 ⇒ CSS 角度＝方向 − 90 */
          R.ptr.style.transform = 'rotate(' + ((st.out.pointer || 0) - 90) + 'deg)';
          R.pv.textContent = Math.round(st.out.pointer || 0);
          R.fs.style.transform = 'rotate(' + (st.out.fanSprite || 0) + 'deg)';
        }
      };
    }
  };

  var live = [];      // 掛著的動畫（換單元時一起停）

  /** 掛上動畫。opts: { autoplay } */
  function mount(el, unit, opts) {
    var L = LESSONS[unit];
    if (!el || !L) return null;
    opts = opts || {};
    var doc = el.ownerDocument, win = doc.defaultView || {};
    ensureCss(doc);
    var raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var caf = win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : clearTimeout;

    var me = { playing: false, speed: 'normal', mode: L.modes[0].key, frame: 0, stopped: false };
    var st, runners, R = {}, comps = L.comps.map(function (k) { return COMP[k](L); });

    function modeObj() { return L.modes.filter(function (m) { return m.key === me.mode; })[0] || L.modes[0]; }
    function reset() {
      st = { unit: unit, mode: me.mode, t: 0, input: L.input.track(0),
             out: { motor: 0, leds: blank(), pointer: 90, fanSprite: 0 }, v: {}, door: 0, motorAngle: 0 };
      var io = { v: st.v, out: st.out, read: function () { return st.input; } };
      runners = modeObj().progs.map(function (p) { return { gen: p(io), cur: null, left: 0 }; });
      runners.forEach(advance);
    }
    function advance(r) {
      var n = r.gen.next();
      r.cur = n.value || null;
      r.left = r.cur ? (r.cur.wait ? r.cur.wait * 1000 : STEP[me.speed]) : Infinity;
    }

    function build() {
      var m = modeObj();
      var modeBtns = L.modes.length > 1 ? L.modes.map(function (x) {
        return '<button class="ra-btn' + (x.key === me.mode ? ' on' : '') + '" data-mode="' + x.key + '">' + esc(x.label) + '</button>';
      }).join('') : '';
      var code = m.blocks.map(function (b, bi) {
        return '<div class="ra-blk"><div class="ra-bt">' + esc(b.title) + '</div>' +
          b.lines.map(function (ln, li) {
            return '<div class="ra-ln" data-b="' + bi + '" data-l="' + li + '">' + new Array(ln[0] + 1).join('    ') + esc(ln[1]) +
                   '<span class="ra-note" hidden></span></div>';
          }).join('') + '</div>';
      }).join('');
      el.innerHTML =
        '<div class="ra">' +
          '<div class="ra-head"><div class="ra-title">▶ 執行結果：' + esc(L.title) + '</div>' +
            '<div class="ra-btns">' + modeBtns +
              '<button class="ra-btn" data-act="play">▶ 播放</button>' +
              '<button class="ra-btn" data-act="reset">↺ 從頭</button>' +
              '<button class="ra-btn" data-act="speed">速度：' + { slow: '慢', normal: '普通', fast: '快' }[me.speed] + '</button></div></div>' +
          '<div class="ra-grid"><div class="ra-stage">' +
            comps.map(function (c) { return '<div class="ra-row">' + c.html + '</div>'; }).join('') +
          '</div><div><div class="ra-code">' + code + '</div><div class="ra-vars" data-r="vars"></div>' +
            '<div class="ra-tip">黃色那一行＝程式<b>正在執行</b>的地方；「如果」會標出<b>成立／不成立</b>，「等待」會真的停那麼久。' +
            (L.input.kind === 'dist' ? '人走近、走遠是自動播放的。' : '旋鈕是自動轉的。') +
            (m.blocks.length > 1 ? '<br>⚠️ 兩段程式都是「當綠旗被點擊」⇒ <b>同時</b>在跑，所以會亮兩行。' : '') + '</div></div></div>' +
        '</div>';
      R = {};
      el.querySelectorAll('[data-r]').forEach(function (n) { R[n.getAttribute('data-r')] = n; });
      R.lines = el.querySelectorAll('.ra-ln');
      el.querySelectorAll('[data-mode]').forEach(function (b) {
        b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
      });
      el.querySelector('[data-act="play"]').addEventListener('click', function () { setPlay(!me.playing); });
      el.querySelector('[data-act="reset"]').addEventListener('click', function () { reset(); draw(); });
      el.querySelector('[data-act="speed"]').addEventListener('click', function (e) {
        me.speed = me.speed === 'normal' ? 'slow' : (me.speed === 'slow' ? 'fast' : 'normal');
        e.target.textContent = '速度：' + { slow: '慢', normal: '普通', fast: '快' }[me.speed];
      });
      setPlay(me.playing);
    }
    function setMode(k) { me.mode = k; reset(); build(); draw(); }
    function setPlay(on) {
      me.playing = !!on;
      var b = el.querySelector('[data-act="play"]');
      if (b) { b.textContent = me.playing ? '⏸ 暫停' : '▶ 播放'; b.classList.toggle('on', me.playing); }
    }

    function draw() {
      comps.forEach(function (c) { c.draw(st, R); });
      for (var i = 0; i < R.lines.length; i++) {
        var n = R.lines[i], b = +n.getAttribute('data-b'), l = +n.getAttribute('data-l');
        var cur = runners[b] && runners[b].cur, on = !!(cur && cur.l === l);
        n.classList.toggle('now', on);
        var note = n.lastChild;
        if (on && (cur.note === true || cur.note === false)) {
          note.hidden = false; note.className = 'ra-note ' + (cur.note ? 'y' : 'n'); note.textContent = cur.note ? '✔ 成立' : '✘ 不成立';
        } else if (on && cur.wait) {
          note.hidden = false; note.className = 'ra-note w'; note.textContent = '⏳ ' + Math.max(0, runners[b].left / 1000).toFixed(1) + ' 秒';
        } else note.hidden = true;
      }
      var keys = Object.keys(st.v);
      R.vars.innerHTML = keys.map(function (k) { return '<span class="ra-var">' + esc(k) + ' = <b>' + esc(num(st.v[k])) + '</b></span>'; }).join('');
    }

    function step(dt) {
      st.t += dt / 1000;
      st.input = L.input.track(st.t);
      runners.forEach(function (r) {
        var left = dt, guard = 0;
        while (left > 0 && guard++ < 50) {
          if (r.left > left) { r.left -= left; left = 0; }
          else { left -= r.left; advance(r); }
        }
      });
      /* 實體效果：馬達 250 轉 2 秒＝門開到底；葉片跟著轉速轉 */
      var m = st.out.motor || 0;
      st.door = Math.max(0, Math.min(1, st.door + (m / 250) * dt / 2000));
      st.motorAngle = (st.motorAngle + m * dt / 40) % 360;
    }

    var last = 0;
    function loop(ts) {
      if (me.stopped) return;
      if (!el.isConnected) { stop(); return; }
      var dt = last ? Math.min(100, ts - last) : 0;
      last = ts;
      if (me.playing && dt > 0) { step(dt); draw(); }
      me.frame = raf(loop);
    }
    function stop() { me.stopped = true; caf(me.frame); live = live.filter(function (x) { return x !== handle; }); }

    reset();
    build();
    draw();
    if (opts.autoplay) setPlay(true);
    me.frame = raf(loop);
    var handle = { stop: stop, step: function (ms) { step(ms); draw(); }, state: function () { return st; },
                   setMode: setMode, play: setPlay, current: function () { return runners.map(function (r) { return r.cur; }); } };
    live.push(handle);
    return handle;
  }
  function stopAll() { live.slice().forEach(function (a) { a.stop(); }); }

  var api = { LESSONS: LESSONS, STEP: STEP, amap: amap, amapA7: amapA7, rgbOf: rgbOf, mount: mount, stopAll: stopAll };
  try { Object.freeze(api); } catch (e) {}
  global.RUNANIM = api;
})(typeof window !== 'undefined' ? window : globalThis);
