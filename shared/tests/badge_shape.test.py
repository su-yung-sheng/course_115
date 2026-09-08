# -*- coding: utf-8 -*-
"""「挑戰成功」徽章的形狀檢查：擋自己打字，但不可以擋到真的通關

跑法：python3 shared/tests/badge_shape.test.py

⛔⛔ 2026-09-08 老師在未通關的截圖裡發現有人自己打「挑戰成功」。
   那一張被擋下來，但擋下來的原因是**字沒落進中央方框**，不是因為
   系統看出它是假的 —— 位置對了就會過。

★ 老師 2026-09-08 提供**十關完整的通關截圖**，全部量過：
     長寬比 3.95（十關完全一致）／填滿率 .617~.622／白字 .122~.133
     框 170x43／只有兩種配色：綠 (0,128,0)、棕 (102,80,54)
  ⇒ **顏色會變，形狀一個像素都沒變**。所以只驗比例，不驗顏色。

⛔ 第一版是「取 ROI 裡最大的純色塊」—— 十關只過 6 關：拔蘿蔔取到淺綠
   遊戲區、遊覽車共乘取到天空、跳格子取到棕色棋盤。徽章明明就在圖上。
   ⇒ 改成對前幾個常見深色各做一次**連通元件**，找形狀對的那一塊。

⚠️⚠️ 這一份用合成圖**真的把 _badge_shape 跑起來**。門檻這種東西
   grep 看不出來 —— 只有實際餵圖進去才知道它擋掉什麼、放過什麼。
"""
import io
import json
import os
import sys
import types as _pytypes
try:
    import cv2
except ImportError:
    print("  ⏭️  跳過：這台沒有 cv2")
    raise SystemExit(0)

try:
    import numpy as np
except ImportError:                              # pragma: no cover
    print("  ⏭️  跳過：這台沒有 numpy")
    sys.exit(0)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, "shared", "backend.ipynb")
_pass, _fail = [0], [0]


def ok(c, l):
    if c:
        _pass[0] += 1
        print("  ✅ " + l)
    else:
        _fail[0] += 1
        print("  ❌ " + l)


def section(t):
    print("\n── %s ──" % t)


# ⚠️ cell 8 整格 exec 不起來（要 flask/ngrok），而且它一跑就會起伺服器。
#    ⇒ 只把 _badge_shape 這一段純函式挖出來執行。它沒有依賴任何全域，
#      所以挖出來跑和在後端裡跑是同一回事。
_src = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][8]["source"])
_i = _src.index("_BADGE_ASPECT = (")
_j = _src.index("_BADGE_GATE = {")
mod = _pytypes.ModuleType("badge")
exec(compile(_src[_i:_j], "<badge>", "exec"), mod.__dict__)
badge_shape = mod._badge_shape

BG = (244, 234, 234)


def canvas(w=420, h=220):
    a = np.zeros((h, w, 3), dtype=np.uint8)
    a[:, :] = BG
    return a


def fake_badge(color=(0, 128, 0), scale=1.0, w=420, h=220):
    """照十關實測的比例合成一個徽章：長寬比 3.95、fill≈.62、white≈.13。

    ⚠️ 不能直接畫實心矩形 —— 那樣 fill 會是 1.0，和真的（.62）差很多。
       真徽章的 .62 是「圓角 ＋ 白字 ＋ 反鋸齒過渡色」一起吃掉的。
       ⇒ 白字挖掉約 13%，再把邊緣糊一圈當反鋸齒。
    """
    bw, bh = int(170 * scale), int(43 * scale)
    a = canvas(int(w * scale), int(h * scale))
    x0, y0 = (a.shape[1] - bw) // 2, (a.shape[0] - bh) // 2
    a[y0:y0 + bh, x0:x0 + bw] = color
    # 白字：四個字，約占框 13%
    cw, ch = int(13 * scale), int(19 * scale)
    for i in range(4):
        x = x0 + int((22 + i * 32) * scale)
        a[y0 + int(12 * scale):y0 + int(12 * scale) + ch, x:x + cw] = (255, 255, 255)
    # 反鋸齒：把整塊糊一下，邊緣就會產生既不是底色也不是白色的過渡色，
    # fill 才會從 1.0 掉到 .6 附近（和真的一樣）。
    a = cv2.GaussianBlur(a, (0, 0), 1.2 * scale)
    return a


section("① 十關的真實比例要驗得過（兩種配色、各種縮放）")
for name, col in [("綠 (0,128,0)", (0, 128, 0)), ("棕 (102,80,54)", (102, 80, 54))]:
    for sc in (1.0, 1.25, 1.5, 2.0):
        r = badge_shape(fake_badge(col, sc))
        ok(r.get("ok") is True,
           "★★★ %s 放大 %.2f 倍要通過（長寬比與比例都不受縮放影響）　←　%s"
           % (name, sc, r))

section("② 自己打字的樣子要擋掉")
a = canvas()
for i in range(4):                               # 只有深色文字、沒有色塊
    a[90:120, 90 + i * 40:90 + i * 40 + 26] = (40, 40, 40)
ok(badge_shape(a).get("ok") is False,
   "★★★ 只打字、沒有色塊 → 擋掉　←　%s" % badge_shape(a))

a = canvas(); a[50:140, 120:260] = (0, 128, 0); a[80:110, 140:240] = (255, 255, 255)
r = badge_shape(a)
ok(r.get("ok") is False, "★★★ 框的長寬比不對（%s）→ 擋掉" % r.get("aspect"))

a = canvas(); a[60:103, 100:270] = (0, 128, 0)
r = badge_shape(a)
ok(r.get("ok") is False, "★★★ 比例對但沒有白字（%s）→ 擋掉" % r.get("white"))

a = canvas(); a[60:103, 100:270] = (0, 128, 0); a[70:95, 115:255] = (255, 255, 255)
r = badge_shape(a)
ok(r.get("ok") is False,
   "★★★ 框裡塞一個大白方塊（白字 %s）→ 擋掉 —— 白字要有**上限**，"
   "沒有上限的話隨手畫一個框加白塊就過了" % r.get("white"))

section("③ 失敗時要回報「最接近的那一塊」")
a = canvas(); a[50:140, 120:260] = (0, 128, 0)
r = badge_shape(a)
ok("aspect" in r and r.get("ok") is False,
   "★★ 判不過時也要給數字，只回一句「找不到」對複查完全沒有幫助　←　%s" % r)

section("④ 壞掉的輸入不可以丟例外（那會害整個判定失敗）")
for bad, label in [(np.zeros((5, 5), dtype=np.uint8), "只有兩維"),
                   (canvas(3, 3), "太小"),
                   (np.zeros((10, 10, 3), dtype=np.uint8) + 250, "整片都是背景色")]:
    r = badge_shape(bad)
    ok(isinstance(r, dict) and r.get("ok") is False,
       "★★★ %s 要安靜回 ok:False，不可以丟例外　←　%s" % (label, r))

section("⑤ 門檻與開關要留在程式裡")
ok("_BADGE_ASPECT = (3.5, 4.6)" in _src,
   "★★ 長寬比門檻要涵蓋實測（十關都是 3.95，縮放後最多 4.16）")
ok("_BADGE_WHITE = (0.03, 0.30)" in _src,
   "★★★ 白字要有上下限 —— 只有下限的話「框裡塞白方塊」會過")
ok("connectedComponentsWithStats" in _src,
   "★★★ 要用連通元件找形狀，不可以「取最大色塊」—— "
   "那個版本十關只過 6 關（會取到遊戲區、天空、棋盤）")
ok("_BADGE_GATE" in _src and '"/api/teacher/badge-check"' in _src,
   "★★★ 一定要有「不必重跑 Colab 就能關掉」的開關")
ok('"badge_check": bool(_BADGE_GATE["on"])' in _src,
   "★★ /api/health 要報出它是開是關，否則「上課關掉後忘了」看不出來")
ok('elif _BADGE_GATE["on"] and not _badge.get("ok")' in _src,
   "★★★ 只在**已經讀到「挑戰成功」**之後才擋 —— "
   "沒讀到字時本來就不過，這時再說徽章不對只會讓學生更困惑")
ok("請告訴老師，他可以幫你補記" in _src,
   "★★★ 誤擋時要給學生一條出路，不可以只說「驗證失敗」")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
