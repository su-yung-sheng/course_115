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
if '_JOB_TTL' not in src:
    print('❌ backend.ipynb 裡找不到號碼牌那一段（_JOB_TTL）—— 是不是被移走了？')
    sys.exit(1)
seg = src[src.index('_JOB_TTL = 1800'):src.index('# ── ngrok 遠端清除')]

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
          _ocr_avg_seconds=lambda: 24.0)
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

print('\n通過 %d／失敗 %d' % (P, F))
sys.exit(1 if F else 0)
