# -*- coding: utf-8 -*-
"""批改模型從哪裡來（model_source）—— 取代原本「是不是預設值」的誤報

跑法：python3 shared/tests/model_source.test.py

⛔ 老師 2026-09-28：「『⚠️ 模型退回預設值了』什麼時候有這個訊息？」
   原本的判斷是「目前的模型 == 寫死的預設值 gemini-2.5-flash」。
   9 月起老師刻意用 flash 當主力 ⇒ 一切正常時也每次都亮黃燈。
★ 這一份真的把 load_config 執行起來（用假的 Firestore），看四種情況各回報什麼。
"""
import io
import json
import os
import sys
import types as _pytypes

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, "shared", "backend.ipynb")
_pass, _fail = [0], [0]


def ok(c, label):
    (_pass if c else _fail)[0] += 1
    print(("  ✅ " if c else "  ❌ ") + label)


genai = _pytypes.ModuleType("google.genai")
genai.Client = type("Client", (), {"__init__": lambda self, *a, **k: None})
t = _pytypes.ModuleType("google.genai.types")
for name in ("Content", "Part", "GenerateContentConfig", "Schema"):
    setattr(t, name, type(name, (), {"__init__": lambda self, *a, **k: None,
                                     "from_text": staticmethod(lambda *a, **k: {})}))
t.Type = type("Type", (), {k: k for k in ("OBJECT", "STRING", "INTEGER", "NUMBER", "ARRAY", "BOOLEAN")})
genai.types = t
g = _pytypes.ModuleType("google")
g.genai = genai
sys.modules.update({"google": g, "google.genai": genai, "google.genai.types": t})

src = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"])
core = _pytypes.ModuleType("core_under_test")
exec(compile("\n".join(src.split("\n")[1:]), "<cell6>", "exec"), core.__dict__)
core.FIREBASE["enabled"] = True
NOFILE = os.path.join(ROOT, "__不存在的設定檔__.json")


def load_with(fake):
    core._fs_load_config = fake
    cfg = core.load_config(NOFILE)
    return cfg, core.model_source()

print("\n── 四種情況 ──")
cfg, ms = load_with(lambda term=None: {"theme": "x", "model_name": "gemini-2.5-flash"})
ok(ms["source"] == "teacher" and cfg["model_name"] == "gemini-2.5-flash",
   "★★★ 老師在教師端**刻意**選了預設的 flash ⇒ 是 teacher，不可以被當成「退回預設值」")

cfg, ms = load_with(lambda term=None: {"theme": "x", "model_name": "gemma-4-31b-it"})
ok(ms["source"] == "teacher" and cfg["model_name"] == "gemma-4-31b-it", "★★ 老師選別的模型 ⇒ teacher，而且真的用它")

cfg, ms = load_with(lambda term=None: {"theme": "x"})
ok(ms["source"] == "default" and cfg["model_name"] == core.DEFAULT_CONFIG["model_name"],
   "★★ Firestore 讀到了、但老師沒另外指定 ⇒ default（只是說明，不是警示）")


def boom(term=None):
    raise RuntimeError("403 Missing or insufficient permissions")
cfg, ms = load_with(boom)
ok(ms["source"] == "unread", "★★★ 讀不到 Firestore ⇒ unread：老師存的設定這次沒生效，這才要亮黃燈")

cfg, ms = load_with(lambda term=None: {"model_name": "gemma-4-31b-it"})
ok(ms["source"] == "teacher", "★★ 讀失敗之後下一次讀成功，要恢復成 teacher（不可以卡在 unread）")

core.FIREBASE["enabled"] = False
cfg, ms = load_with(lambda term=None: {"model_name": "x"})
ok(ms["source"] == "local", "★ Firebase 關閉 ⇒ local")
core.FIREBASE["enabled"] = True

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
