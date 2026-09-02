# -*- coding: utf-8 -*-
"""號碼牌制（/analyze-async ＋ /result/<ticket>）的端到端測試
跑法：python shared/tests/ocrjobs.test.py
（check.py 會自動跑 shared/tests/*.test.py）

⚠️⚠️ 為什麼需要這一支：2026-09-02 實測，一張截圖要 24 秒
（2 個 CPU 名額並行時完成一張的間隔），而前端的上傳逾時是 180 秒 ——
**只夠撐到第 7～8 位**。第 9 位以後，後端其實跑完也判過了，
前端卻已經放棄連線：學生看到「連線錯誤」，那張圖白跑，
重傳還要重新排到最後。
★ 這不是「等太久」的體驗問題，是「後半班一定失敗」的可靠性問題。

★★ 這一份盯的重點是「**沒有第二份判定邏輯**」：
   背景執行緒用 app.test_request_context 重跑同一支 ocr_analyze()。
   如果哪天有人為了方便在背景那條路上另外寫一遍判定，
   兩邊的結果遲早會不一樣，而且沒有人會發現 ——
   這個 repo 已經在「十關對照表」上吃過一模一樣的虧。

⚠️ 這支測試不需要 PaddleOCR：ocr_analyze 用假的替身，
   驗的是「號碼牌怎麼流動」，不是辨識準不準。
"""
import io as _io
import json
import os
import sys
import threading
import time
import traceback

NB = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), 'shared', 'backend.ipynb')

try:
    from flask import Flask, request, jsonify
except ImportError:
    # ★ 和 check.py 的原則一致：缺套件不算失敗，但要講清楚「沒測到」。
    print('⚠️ 這台機器沒有 flask，號碼牌測試跳過 —— **沒測到，不是通過**。')
    print('   要跑的話：pip install flask')
    sys.exit(0)

src = ''.join(json.load(_io.open(NB, encoding='utf8'))['cells'][8]['source'])
for _need in ('_JOB_TTL', 'MAX_UPLOAD_MB'):
    if _need not in src:
        print('❌ backend.ipynb 裡找不到 %s —— 是不是被移走了？' % _need)
        sys.exit(1)
# ⚠️ 起點要從上傳上限那一段開始 —— 只從 _JOB_TTL 起算的話，
#    MAX_CONTENT_LENGTH 和 413 的 errorhandler 都不會被抽進來，
#    測試會說「沒有上限」，但實際上是有的（假紅）。
seg = src[src.index('MAX_UPLOAD_MB = 30'):src.index('# ── ngrok 遠端清除')]

app = Flask(__name__)
calls = {'n': 0}

def fake_analyze():
    calls['n'] += 1
    f = request.files.get('file'); raw = f.read() if f else b''
    if request.form.get('boom'):
        raise RuntimeError('模擬辨識爆炸')
    if request.form.get('bad'):
        return jsonify({'status': 'error', 'message': '無法解析圖片'}), 400
    time.sleep(0.25)
    return jsonify({'status': 'success', 'pass': True, 'bytes': len(raw),
                    'sid': request.form.get('student_id', '')})

ns = dict(io=_io, os=os, traceback=traceback, _threading=threading,
          _busy_time=time, app=app, request=request, jsonify=jsonify,
          ocr_analyze=fake_analyze, _ocr_qlock=threading.Lock(),
          _ocr_qstate={'pending': 0, 'served': 0, 'ticket': 0},
          _ocr_avg_seconds=lambda: 24.0, CLASS_PASSCODES=set())
exec(seg, ns)
c = app.test_client()

P, F = 0, 0
def ok(cond, label):
    global P, F
    if cond: P += 1; print('  ✅ ' + label)
    else:    F += 1; print('  ❌ ' + label)

def post(**form):
    data = dict(form); data['file'] = (_io.BytesIO(b'\x89PNG' + b'x' * 900), 'shot.png')
    return c.post('/analyze-async', data=data, content_type='multipart/form-data')

print('── 號碼牌制：端到端 ──')
r = post(student_id='1410905', keywords='挑戰成功,滑梯公園,slide park')
j = r.get_json()
ok(r.status_code == 200 and j.get('ticket'), '★★ 上傳後立刻拿到號碼牌（不必等辨識）')
ok(j.get('status') == 'queued', '   狀態是 queued')
ok('avg_seconds' in j and 'ahead' in j, '★ 一併回報「前面幾位、每張大概多久」')
tk = j['ticket']

s1 = c.get('/result/' + tk).get_json()
ok(s1.get('status') in ('queued', 'working'), '★ 還沒好時回 queued／working（不是 404）')

for _ in range(60):
    d = c.get('/result/' + tk).get_json()
    if d.get('status') not in ('queued', 'working'): break
    time.sleep(0.05)
ok(d.get('status') == 'success' and d.get('pass') is True,
   '★★ 跑完之後拿得到「和 /analyze 一模一樣」的結果')
ok(d.get('bytes') == 904 and d.get('sid') == '1410905',
   '★★ 檔案內容和 form 欄位都完整帶進背景執行緒　←　%s' % d.get('bytes'))
ok(calls['n'] == 1, '★★ 只呼叫了一次 ocr_analyze（沒有抄第二份判定邏輯）')

d2 = c.get('/result/' + tk).get_json()
ok(d2.get('pass') is True, '★ 重複來拿還是拿得到（關掉頁面再回來的情境）')

print('\n── 壞掉的路徑 ──')
g = c.get('/result/zzzzzzzzzzzz')
ok(g.status_code == 404 and '重新上傳' in (g.get_json() or {}).get('message', ''),
   '★★ 號碼牌過期／後端重啟 → 明講要重新上傳，不可以無聲無息')

r = post(student_id='X', boom='1')
tk2 = r.get_json()['ticket']
for _ in range(60):
    d = c.get('/result/' + tk2).get_json()
    if d.get('status') not in ('queued', 'working'): break
    time.sleep(0.05)
ok(d.get('status') == 'error' and '不是你的截圖有問題' in d.get('message', ''),
   '★★ 背景爆炸也要標成 done —— 漏掉的話學生永遠停在「辨識中」')

r = post(student_id='Y', bad='1')
tk3 = r.get_json()['ticket']
for _ in range(60):
    rr = c.get('/result/' + tk3)
    if rr.get_json().get('status') not in ('queued', 'working'): break
    time.sleep(0.05)
ok(rr.status_code == 400, '★ view 回 (body, 400) 時，狀態碼要原樣帶回來')

r = c.post('/analyze-async', data={'student_id': 'Z'},
           content_type='multipart/form-data')
ok(r.status_code == 400 and '未收到圖片' in r.get_json().get('message', ''),
   '★ 沒帶檔案時當場擋掉，不要開一張永遠不會好的號碼牌')

print('\n── 過期清理 ──')
ns['_JOB_TTL'] = 0
before = len(ns['_jobs'])
c.get('/result/whatever')
ok(len(ns['_jobs']) == 0 and before > 0,
   '★ TTL 到了要清掉（記憶體不能一直長）　←　清掉 %d 張' % before)

print('\n── 班級密碼：新入口也要守門 ──')
# ⚠️⚠️ /analyze 是同步的，密碼錯當場回絕、不進排隊。
#    改成號碼牌之後，如果只在背景的 ocr_analyze 裡驗，
#    密碼錯的人一樣拿得到號碼牌、一樣開一條執行緒、
#    一樣把整張圖留在記憶體 —— 「擋掉外部亂打 API」的效果就沒了。
# ★ 這是加號碼牌時差點留下的迴歸：**新的入口沒有沿用舊入口的守門**。
ns['CLASS_PASSCODES'] = {'right-pass'}
_r = c.post('/analyze-async',
            data={'password': 'wrong', 'file': (_io.BytesIO(b'x' * 100), 'a.png')},
            content_type='multipart/form-data')
ok(_r.status_code == 403, '★★ 密碼錯要當場回絕（不可以先發號碼牌）')
ok('ticket' not in (_r.get_json() or {}), '★★ 而且不可以給號碼牌')
_before = len(ns['_jobs'])
_r2 = c.post('/analyze-async',
             data={'password': 'right-pass', 'file': (_io.BytesIO(b'x' * 100), 'a.png')},
             content_type='multipart/form-data')
ok(_r2.status_code == 200 and _r2.get_json().get('ticket'), '★ 密碼對的照常拿到號碼牌')
ns['CLASS_PASSCODES'] = set()   # 還原：沒設密碼時不檢查
ok(c.post('/analyze-async', data={'file': (_io.BytesIO(b'x' * 100), 'a.png')},
          content_type='multipart/form-data').status_code == 200,
   '★ 沒設 CLASS_PASSCODE 時不檢查（老師沒設就是停用）')

print('\n── 上傳大小上限 ──')
# ⚠️⚠️ 號碼牌制之後，排隊中的圖片會全部留在記憶體（closure 抓著 _raw）。
#    30 人 × 2～3 MB ≈ 90 MB，Colab 有 12 GB，本身沒問題。
#    ★ 有問題的是「沒有上限」：原本同步處理當場就釋放，現在會累積，
#      一張異常大的圖就能把記憶體吃光，而那會讓**整個後端連同
#      還在排隊的人一起死**。
ok(app.config.get('MAX_CONTENT_LENGTH'), '★★ 要有上傳大小上限')
_mb = (app.config.get('MAX_CONTENT_LENGTH') or 0) / 1024 / 1024
ok(20 <= _mb <= 60,
   '★ 上限要照顧到 .sb3（Scratch 專案比截圖大得多）　←　目前 %.0f MB' % _mb)

_big = _io.BytesIO(b'x' * int(app.config['MAX_CONTENT_LENGTH'] + 1024))
_r = c.post('/analyze-async', data={'file': (_big, 'big.png')},
            content_type='multipart/form-data')
ok(_r.status_code == 413, '★ 超過就擋掉')
# ⚠️ Flask 預設的 413 是一頁 HTML —— 前端拿去 .json() 會炸，
#    然後顯示成「連線錯誤」，學生完全不知道是檔案太大。
_j = None
try:
    _j = _r.get_json()
except Exception:
    _j = None
ok(bool(_j), '★★ 413 一定要回 JSON（不然前端會顯示成「連線錯誤」）')
ok(bool(_j) and 'MB' in _j.get('message', ''),
   '★★ 訊息要說出上限，而且要講「該怎麼辦」')

_small = _io.BytesIO(b'\x89PNG' + b'x' * 900)
ok(c.post('/analyze-async', data={'file': (_small, 'ok.png')},
          content_type='multipart/form-data').status_code == 200,
   '★ 正常大小的截圖不受影響')


print('\n通過 %d／失敗 %d' % (P, F))
sys.exit(1 if F else 0)
