# -*- coding: utf-8 -*-
"""下學期後端（11502/backend.ipynb）：確認本人、模擬器通關寫入、Scratch 加分批改、運算思維 OCR
跑法：python3 shared/tests/backend11502.test.py
★ 用假的資料庫、假的登入驗證、假的 AI，真的把 sim_record／批改流程跑起來（不連網路、不需要 google-auth／genai）。
"""
import io, json, os, sys, types, urllib.error

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = json.load(io.open(os.path.join(ROOT, '11502', 'backend.ipynb'), encoding='utf-8'))
_pass, _fail = [0], [0]
def ok(c, l):
    (_pass if c else _fail)[0] += 1
    print(('  ✅ ' if c else '  ❌ ') + l)
def section(t):
    print('\n── %s ──' % t)
def cell(prefix):
    for c in NB['cells']:
        s = ''.join(c['source'])
        if c['cell_type'] == 'code' and s.startswith(prefix):
            return s
    return ''

# 假的 google.genai：批改引擎第一行就 from google import genai（本機沒有，也不需要真的呼叫）
_g = types.ModuleType('google'); _ga = types.ModuleType('google.genai'); _gt = types.ModuleType('google.genai.types')
_ga.Client = type('Client', (), {'__init__': lambda self, *a, **k: None}); _ga.types = _gt; _g.genai = _ga
sys.modules.setdefault('google', _g); sys.modules.setdefault('google.genai', _ga); sys.modules.setdefault('google.genai.types', _gt)
core = types.ModuleType('core11502')
exec(compile('\n'.join(cell('%%writefile core11502.py').split('\n')[1:]), '<core11502>', 'exec'), core.__dict__)
SRV = cell('%%writefile server11502.py')
JUDGE = json.load(io.open(os.path.join(ROOT, '11502', 'content', 'blocks.judge.json'), encoding='utf-8'))


class FakeFS(object):
    def __init__(self):
        self.docs, self.calls, self.conflicts = {}, [], 0
    def http(self, method, url, body=None):
        path = __import__('urllib.parse').parse.unquote(url.split('/documents/')[1].split('?')[0])
        q = url.split('?', 1)[1] if '?' in url else ''
        self.calls.append((method, path, q, body))
        if method == 'GET':
            if path not in self.docs:
                raise urllib.error.HTTPError(url, 404, 'nf', None, None)
            return {'fields': self.docs[path], 'updateTime': 'T%d' % len(self.calls)}
        if method == 'PATCH':
            if self.conflicts:
                self.conflicts -= 1
                raise urllib.error.HTTPError(url, 409, 'conflict', None, None)
            import urllib.parse as up
            paths = [up.unquote(x.split('=', 1)[1]) for x in q.split('&') if x.startswith('updateMask.fieldPaths=')]
            if not paths:            # 沒有遮罩 ⇒ 整份文件換成送來的內容（真的 Firestore 就是這樣）
                self.docs[path] = dict(body['fields'])
                return {}
            cur = self.docs.setdefault(path, {})
            for p in paths:          # 只寫遮罩裡的欄位（巢狀路徑逐層寫）
                segs = [s.strip('`') for s in __import__('re').findall(r'`[^`]*`|[^.]+', p)]
                # 和真的 Firestore 一樣：遮罩裡有、內容裡沒有的欄位 ⇒ 刪掉
                src, dst = {'mapValue': {'fields': body['fields']}}, cur
                for i, s in enumerate(segs):
                    src = ((src or {}).get('mapValue') or {}).get('fields', {}).get(s)
                    if i == len(segs) - 1:
                        if src is None:
                            dst.pop(s, None)
                        else:
                            dst[s] = src
                    else:
                        dst = dst.setdefault(s, {'mapValue': {'fields': {}}})['mapValue']['fields']
            return {}
fs = FakeFS()
core.HTTP = fs.http
core.FETCH_JUDGE = lambda: JUDGE
TOKENS = {'good': {'email': 'qfm1420101@mail.qfm.kh.edu.tw', 'email_verified': True},
          'other': {'email': 'qfm1420199@mail.qfm.kh.edu.tw', 'email_verified': True},
          'unverified': {'email': 'qfm1420101@mail.qfm.kh.edu.tw', 'email_verified': False},
          'teacher': {'email': 'suyungsheng@mail.qfm.kh.edu.tw', 'email_verified': True}}
def _verify(t):
    if t not in TOKENS:
        raise ValueError('bad signature')
    return TOKENS[t]
core.VERIFY_TOKEN = _verify
def dec(path):
    return {k: core.fs_decode(v) for k, v in fs.docs.get(path, {}).items()}

section('① 確認是本人（Google 登入憑證）')
ok(core.check_identity('1420101', 'good')[0], '★★ 帳號＝qfm＋學號 ⇒ 通過')
ok(not core.check_identity('1420101', 'other')[0], '★★★ 別人的帳號送這個學號 ⇒ 擋（冒名）')
ok(not core.check_identity('1420101', 'unverified')[0], '★ email 沒驗證 ⇒ 擋')
ok(not core.check_identity('1420101', 'forged')[0] and '過期' in core.check_identity('1420101', 'forged')[1], '★★ 假的憑證（驗簽失敗）⇒ 擋，叫他重新整理')
ok(not core.check_identity('1420101', '')[0] and not core.check_identity('14201', 'good')[0], '沒有憑證、學號格式不對 ⇒ 擋')
ok(not core.check_identity('1420101', 'teacher')[0], '老師帳號不能替學生過關')

section('② 星數規則（純函式）')
v, g, al = core.merge_sim({}, '4-2-1', {'tries': 3, 'runs': 5, 'secs': 120}, 1000)
ok(v['unitStars']['4-2-1'] == 2 and g == 2 and not al, '★★★ 第一次拼對 ⇒ 2⭐、新增 2 顆')
ok(v['sim']['4-2-1'] == {'at': 1000, 'tries': 3, 'runs': 5, 'secs': 120}, '★ 過程紀錄（幾次、執行幾次、花多久）留下來給可疑紀錄頁')
ok(v['gains'][-1] == {'unit': '4-2-1', 'kind': 'sim', 'star': 2, 'stars': 2, 'at': 1000}, '★★ 得星紀錄（每週評分用）記「新增幾顆」')
v2, g2, al2 = core.merge_sim(v, '4-2-1', {'tries': 1}, 2000)
ok(g2 == 0 and al2 and v2['sim']['4-2-1']['at'] == 1000 and len(v2['gains']) == 1, '★★ 同一關再拼對一次 ⇒ 不再加星、不多記一筆，保留第一次的紀錄')
v3, g3, _ = core.merge_sim({'bonus': {'4-2-2': 2}}, '4-2-2', {}, 3000)
ok(v3['unitStars']['4-2-2'] == 4 and g3 == 4, '★★★ Scratch 加分先記著（2），模擬器拼對那一刻一起算 ⇒ 4⭐（老師：沒拼模擬器不算通關）')
ok(core.unit_star({'bonus': {'4-2-3': 2}}, '4-2-3') == 0, '★★ 只有 Scratch 加分、沒拼模擬器 ⇒ 0⭐（不算通關）')
ok(v3['done'] == 1 and v3['stars'] == 4, '總星數、通關關數')
big = {'gains': [{'unit': 'x', 'stars': 1}] * 250}
ok(len(core.merge_sim(big, '4-2-1', {}, 1)[0]['gains']) == core.GAINS_CAP, '得星紀錄有上限（文件大小）')

section('③ 寫進資料庫')
fs.docs['roster/1420101'] = core.fs_encode({'name': '測試', 'cls': '801'})['mapValue']['fields']
lv = JUDGE['levels']['4-2-1']
good_prog = [s['goal'] for s in lv['sprites']]
r = core.sim_record('1420101', '4-2-1', good_prog, {'tries': 2, 'runs': 4, 'secs': 90}, now_ms=5000)
ok(r['ok'] and r['star'] == 2 and r['total'] == 2 and r['done'] == 1, '★★★ 參考解答送來 ⇒ 後端判對、記 2⭐（' + r['msg'] + '）')
d = dec('11502-progress/1420101')
ok(d['scratchVerified']['unitStars'] == {'4-2-1': 2} and d['modules']['scratch']['unitStars'] == {'4-2-1': 2},
   '★★★ 寫進 scratchVerified，也鏡像到學生頁面讀的 modules.scratch.unitStars（這兩格學生寫不進去）')
patch = [c for c in fs.calls if c[0] == 'PATCH'][-1]
ok('updateMask.fieldPaths=modules.scratch.unitStars.%604-2-1%60' in patch[2] and 'currentDocument.exists=false' in patch[2],
   '★★ 只寫這一關那一格（updateMask，不洗掉別的欄位）；新文件用「必須不存在」當前提')
ok(d['modules']['scratch']['source'] == 'backend' and d['studentId'] == '1420101', '標明是後端寫的')
fs.docs['11502-progress/1420101']['modules']['mapValue']['fields']['scratch']['mapValue']['fields']['simPending'] = \
    core.fs_encode({'4-2-2': {'p': '[]', 'at': 1}, '4-2-3': {'p': '[]', 'at': 1}})

n0 = len([c for c in fs.calls if c[0] == 'PATCH'])
bad = json.loads(json.dumps(good_prog)); bad[0] = bad[0][:-1]
r = core.sim_record('1420101', '4-2-2', bad, {})
ok(not r['ok'] and r['code'] == 'wrong' and len([c for c in fs.calls if c[0] == 'PATCH']) == n0, '★★★ 沒拼對的程式 ⇒ 不寫入（F12 把自己標成通過也沒用，後端會重判）')
r = core.sim_record('1420101', '4-2-2', [s['goal'] for s in JUDGE['levels']['4-2-2']['sprites']], {}, now_ms=6000)
ok(r['ok'] and dec('11502-progress/1420101')['modules']['scratch']['unitStars'] == {'4-2-1': 2, '4-2-2': 2},
   '★★ 第二關寫入時，第一關那一格不受影響')
_pend = dec('11502-progress/1420101')['modules']['scratch'].get('simPending') or {}
ok(_pend.get('4-2-2') is None and _pend.get('4-2-3') is not None,
   '★★ 後端確認後，頁面先記下的那一筆（simPending）刪掉；別關的不動')
ok('updateMask.fieldPaths=modules.scratch.simPending.%604-2-2%60' in [c for c in fs.calls if c[0] == 'PATCH'][-1][2], '　刪除方式：遮罩裡有、內容裡沒有')
r = core.sim_record('1420101', '4-2-1', good_prog, {}, now_ms=7000)
ok(r['ok'] and r['already'] and r['gain'] == 0 and r['total'] == 4, '★ 已經通關的關卡再送 ⇒ 回「之前就通關了」，不加星')

section('④ 擋掉不該寫的');
r = core.sim_record('1420102', '4-2-1', good_prog, {})
ok(r['code'] == 'no_roster' and '11502-progress/1420102' not in fs.docs, '★★ 名冊裡沒有的學號 ⇒ 不建立進度（和安全規則 inRoster 一樣）')
ok(core.sim_record('1420101', '6-1-1', [[]], {})['code'] == 'bad_request', '★ 沒有拼圖的關（第 5 關）⇒ 不收')
deep = {'id': 'control.repeat', 'args': ['1'], 'children': []}
cur = deep
for _ in range(40):
    nxt = {'id': 'control.repeat', 'args': ['1'], 'children': []}; cur['children'].append(nxt); cur = nxt
ok(core.sim_record('1420101', '4-2-1', [[deep]], {})['code'] == 'bad_request', '★ 惡意的超深結構 ⇒ 不收（不讓它把判定拖垮）')
ok(core.sim_record('1420101', '4-2-1', [[{'id': 'x', 'args': ['a' * 70000]}]], {})['code'] == 'bad_request', '★ 超大的資料 ⇒ 不收')
ok(core.sim_record('1420101', '4-2-1', 'abc', {})['code'] == 'bad_request' and core.sim_record('1420101', '4-2-1', [['x']], {})['code'] == 'bad_request',
   '格式不對 ⇒ 不收（不會丟例外）')

section('⑤ 同時送出、資料庫出錯、題目抓不到')
fs.conflicts = 1
r = core.sim_record('1420101', '4-2-3', [s['goal'] for s in JUDGE['levels']['4-2-3']['sprites']], {}, now_ms=8000)
ok(r['ok'] and r['star'] == 2, '★★ 被另一個分頁搶先寫（409）⇒ 重讀重算，照樣寫成功')
old_http = core.HTTP
core.HTTP = lambda m, u, b=None: (_ for _ in ()).throw(RuntimeError('斷線'))
ok(core.sim_record('1420101', '4-3-1', [s['goal'] for s in JUDGE['levels']['4-3-1']['sprites']], {})['code'] == 'db_error', '★ 資料庫斷線 ⇒ 回 db_error（頁面會先記著、等一下再送）')
core.HTTP = old_http
core._JUDGE.update(data=None, at=0, error='')
core.FETCH_JUDGE = lambda: (_ for _ in ()).throw(OSError('GitHub 連不上'))
ok(core.sim_record('1420101', '4-2-1', good_prog, {})['code'] == 'no_judge', '★ 一份題目都沒抓到過 ⇒ 回 no_judge，不亂判')
core.FETCH_JUDGE = lambda: JUDGE
core.judge_data(force=True)
core.FETCH_JUDGE = lambda: (_ for _ in ()).throw(OSError('GitHub 連不上'))
ok(core.judge_data(force=True) is not None, '★ 抓過一次之後 GitHub 斷了 ⇒ 沿用上一份')

section('⑥ 伺服器')
ok('@app.route("/api/sim/verify", methods=["POST"])' in SRV, '有 /api/sim/verify')
blk = SRV[SRV.index('def sim_verify'):]
ok(blk.index('core.check_identity(') < blk.index('core.sim_record('), '★★★ 先確認是本人，才判定、寫入')
ok('}), 401' in blk, '★ 不是本人 ⇒ 401')
ok('ALLOWED_ORIGINS = ("https://su-yung-sheng.github.io",)' in SRV, '★ 只讓本站的網頁呼叫（CORS）')
ok('"fingerprint": FINGERPRINT' in SRV, '健康檢查回報指紋（確認 Colab 跑的是哪一版）')
src_all = json.dumps(NB, ensure_ascii=False)
import re as _re0
ok('BEGIN PRIVATE KEY' not in src_all and not _re0.search(r'AIza[0-9A-Za-z_\-]{35}', src_all)
   and not _re0.search(r'sk-ant-[A-Za-z0-9_\-]{20,}', src_all), '★★★ 筆記本裡沒有任何金鑰（全部放 Colab Secrets）')

# ══════════════════════════════════════════════════════════════
# 第 4 步：Scratch 加分批改
# ══════════════════════════════════════════════════════════════
import ast, re as _re, tempfile as _tf

OLD_NB = json.load(io.open(os.path.join(ROOT, 'shared', 'backend.ipynb'), encoding='utf-8'))
OLD = next(''.join(c['source']) for c in OLD_NB['cells']
           if c['cell_type'] == 'code' and ''.join(c['source']).startswith('%%writefile scratch_grader_core.py'))
OLD_L = OLD.split('\n')[1:]
NEW_SRC = '\n'.join(cell('%%writefile core11502.py').split('\n')[1:])

section('⑦ 批改引擎和上學期一模一樣（原封搬來，不重寫）')
a = OLD_L.index('import warnings')
b = next(i for i in range(a, len(OLD_L)) if OLD_L[i].startswith('# 9. 共用設定檔')) - 1
old_engine = '\n'.join(OLD_L[a:b]).rstrip()
ok(old_engine in NEW_SRC,
   '★★★ 批改引擎整段（虛擬碼、評分 prompt、扣分審查、模型梯子，%d 行）逐字相同 —— '
   '上學期改了引擎，這本要重跑 build（或兩本一起改）' % (b - a))
old_tree, new_tree = ast.parse('\n'.join(OLD_L)), ast.parse(NEW_SRC)
def fn_src(tree, lines, name):
    for n in tree.body:
        if isinstance(n, ast.FunctionDef) and n.name == name:
            return '\n'.join(lines[n.lineno - 1:n.end_lineno])
    return None
NEW_L = NEW_SRC.split('\n')
for name in ('single_agent_grading', 'generate_grading_prompt', 'clean_json_for_ai', 'apply_deductions',
             'extract_project_json', '_now_str', 'criteria_for_unit', 'suggest_theme_and_rules', 'list_available_models'):
    s_old, s_new = fn_src(old_tree, OLD_L, name), fn_src(new_tree, NEW_L, name)
    ok(s_old is not None and s_old == s_new, '%s 和上學期相同' % name)
dup = [n.name for n in new_tree.body if isinstance(n, ast.FunctionDef)]
ok(len(dup) == len(set(dup)), '★ 沒有同名函式被後面的蓋掉（%s）' % sorted({x for x in dup if dup.count(x) > 1}))
old_gk = {}
exec(compile(fn_src(old_tree, OLD_L, 'grade_cache_key'), '<old>', 'exec'), {'GRADE_WANT_ANALYSIS': False}, old_gk)
_cfgk = {'_student_id': '1420101', 'rules': 'R', 'theme': 'T', 'template_code': 'tp', 'example_code': 'ex',
         'extension_rules': '', 'use_custom_extension': False}
ok(old_gk['grade_cache_key'](_cfgk, 'CODE') == core.grade_cache_key(_cfgk, 'CODE'),
   '★ 批改快取的鑰匙和上學期同一個算法（學號在第一個，不跨學生共用）')

section('⑧ 加分規則（老師 2026-11-18）')
ok([core.scratch_bonus(x) for x in (None, 'x', 0, 74.9, 75, 89, 90, 100)] == [0, 0, 0, 0, 1, 1, 2, 2],
   '75 分以上 +1⭐、90 分以上 +2⭐')
v, rep = core.merge_bonus({}, '1-1', 92, 1000)
ok(v['bonus'] == {'1-1': 2} and v['unitStars']['1-1'] == 0 and not v['gains'],
   '★★★ 模擬器還沒拼對：加分先記著（bonus 2），星數 0、沒有得星紀錄 —— 不算通關')
ok(rep['simDone'] is False and rep['bonus'] == 2 and rep['star'] == 0 and rep['bonusMode'] is True, '回報講清楚「還沒拼對」')
v2, gain, _ = core.merge_sim(v, '1-1', {'tries': 2, 'runs': 3, 'secs': 60}, 2000)
ok(v2['unitStars']['1-1'] == 4 and gain == 4 and v2['gains'][-1]['stars'] == 4,
   '★ 之後拼對：2⭐＋先記著的 +2⭐ 一起算（4⭐，得星紀錄記 4 顆）')
w, _, _ = core.merge_sim({}, '2-1', {}, 1000)
w, r1 = core.merge_bonus(w, '2-1', 80, 2000)
ok(w['unitStars']['2-1'] == 3 and w['gains'][-1] == {'unit': '2-1', 'kind': 'scratch', 'score': 80, 'star': 3, 'stars': 1, 'at': 2000},
   '已經拼對、80 分 ⇒ 3⭐，得星紀錄 kind=scratch 記新增的 1 顆（每週評分照加）')
ok(r1['improved'] and r1['scoreImproved'] and r1['thisBonus'] == 1, '回報：進步了、分數比上次高（作品備份的條件）')
w, r2 = core.merge_bonus(w, '2-1', 60, 3000)
ok(w['bonus']['2-1'] == 1 and w['unitStars']['2-1'] == 3 and w['unitScores']['2-1'] == 80 and len(w['gains']) == 2,
   '★ 再交一次 60 分：加分、星數、最好成績都不會變差，也不會多記得星')
ok(not r2['improved'] and not r2['scoreImproved'] and r2['bestScore'] == 80, '回報：沒進步（不備份），最好成績 80')
w, r3 = core.merge_bonus(w, '2-1', 95, 4000)
ok(w['unitStars']['2-1'] == 4 and w['gains'][-1]['stars'] == 1 and w['stars'] == 4, '95 分 ⇒ 4⭐（多 1 顆）—— 一關最多 4⭐')
ok(core.unit_star({'sim': {'x': {}}, 'bonus': {'x': 9}}, 'x') == 4, '★ 加分最多 +2（資料被改大也一樣）')

section('⑨ 加分寫進資料庫')
fs.docs.clear(); fs.calls[:] = []
fs.docs['roster/1420101'] = {'name': {'stringValue': '測試'}}
core.judge_data(force=True)
u1 = sorted(JUDGE['levels'])[0]
r = core.bonus_record('1420101', u1, 85, 5000)
d = dec('11502-progress/1420101')
ok(r and r['bonus'] == 1 and r['simDone'] is False and d['scratchVerified']['bonus'] == {u1: 1},
   '還沒拼對也記下加分（scratchVerified.bonus）')
ok(d['modules']['scratch']['unitStars'][u1] == 0 and d['modules']['scratch']['unitScores'][u1] == 85,
   '頁面的作品星 0（沒通關）、最好成績 85')
q = fs.calls[-1][2]
ok('currentDocument.exists%3Dfalse' in q or 'currentDocument.exists=false' in q, '★ 有前提（兩個分頁同時交不會互相蓋掉）')
ok('simPending' not in q, '加分不碰模擬器的暫存')
n_before = len(fs.calls)
ok(core.bonus_record('1420101', '5-1', 99, 6000) is None and len([c for c in fs.calls[n_before:] if c[0] == 'PATCH']) == 0,
   '★ 不在 8 個拼圖關裡（例如實作體驗關）⇒ 不寫')
fs.conflicts = 1
r = core.bonus_record('1420101', u1, 91, 7000)
ok(r and r['bonus'] == 2 and dec('11502-progress/1420101')['scratchVerified']['bonus'][u1] == 2, '★ 被別的寫入搶先（409）⇒ 重讀重算再寫')
ok(core.bonus_record('14201', u1, 91) is None and core.bonus_record('1420101', u1, None) is None, '學號不對、沒有分數 ⇒ 不寫')

section('⑩ 批改標準、快取、交錯關卡')
fs.docs['11502-grader/criteria'] = {k: core.fs_encode(v) for k, v in {
    'theme': '全域', 'rules': 'G', 'units_json': json.dumps({u1: {'rules': 'U1規則', 'example_code': 'EX'}}),
    'is_standard_answer': False, 'api_key_1': 'AIzaFAKE', 'model_name': 'gemini-2.5-flash'}.items()}
gets = lambda: len([c for c in fs.calls if c[0] == 'GET' and c[1] == '11502-grader/criteria'])
g0 = gets()
cr = core.load_criteria(force=True)
ok(cr['rules'] == 'G' and cr['is_standard_answer'] is True and cr.get('api_key_1') is None,
   '★ 只拿老師編的那幾格（白名單和上學期相同）；資料庫裡多出來的欄位不採用')
core.load_criteria(); core.load_criteria()
ok(gets() - g0 == 1, '★ 批改標準暫存 60 秒：連續批改不會每次都讀資料庫（11-17 額度用完的教訓）')
os.environ['GEMINI_API_KEY_1'] = 'k1'; os.environ.pop('GEMINI_API_KEY_2', None); os.environ['ANTHROPIC_API_KEY'] = 'ak'
gc = core.grading_cfg(u1)
ok(gc['rules'] == 'U1規則' and gc['example_code'] == 'EX' and gc['api_key_1'] == 'k1' and gc['anthropic_key'] == 'ak',
   '這一關自己的規則＋金鑰（金鑰只從環境變數來）')
ok('自己的' in gc['rules_source'], '記下規則來源')

calls = []
def fake_grade(keys, rules, theme, code, **kw):
    calls.append((rules, code, kw.get('claude_key')))
    return {'score': 88, 'comments': '好', 'deducted_items': '', 'creative_highlights': '無', 'logic_analysis': '',
            '_stat': {'model': 'gemini-2.5-flash', 'ok': True}}
core.single_agent_grading = fake_grade
core.extract_project_json = lambda p, mb=10: {'targets': []} if 'bad' not in p else None
core.clean_json_for_ai = lambda raw: 'CLEAN'
c1 = dict(gc, _student_id='1420101')
r1 = core.grade_file('/tmp/a.sb3', c1)
r2 = core.grade_file('/tmp/a.sb3', c1)
ok(len(calls) == 1 and r1['score'] == 88 and r2['score'] == 88 and r2['_stat']['cached'] and '完全一樣' in r2['comments'],
   '★ 同一個學生送一模一樣的程式 ⇒ 回上次的結果、不再花 AI 額度，而且告訴他')
core.grade_file('/tmp/a.sb3', dict(gc, _student_id='1420199'))
ok(len(calls) == 2, '★ 別的學生送一樣的程式要重新評（快取不跨學生）')
core.grade_file('/tmp/a.sb3', dict(gc, no_cache=True, _student_id='1420101'))
ok(len(calls) == 3, '老師試評（no_cache）每次都真的評')
ok(calls[0][0] == 'U1規則' and calls[0][2] == 'ak', '批改用這一關的規則、帶付費備援金鑰')
rb = core.grade_file('/tmp/bad.sb3', c1)
ok(rb['ok'] is False and rb['score'] is None, '★ 讀不到檔案 ⇒ 不給 0 分（故障和交白卷要分得出來）')
ok(core.record_submission('1420101', u1, rb) is None, '★ 沒評成功的不寫進成績紀錄')
core.record_submission('1420101', u1, r1, '主題', 'gemini-2.5-flash')
subs = [c for c in fs.calls if c[0] == 'POST' and c[1] == '11502-scratch-submissions']
ok(subs and core.fs_decode(subs[-1][3]['fields']['score']) == 88, '成績紀錄寫進 11502-scratch-submissions')

RAW = b'PK-fake-sb3-bytes'
core.record_work_hash('1420101', u1, RAW, 80)
wq = [c for c in fs.calls if c[0] == 'PATCH' and c[1].startswith('11502-work-hashes/')][-1][2]
ok('owners_json' in wq and 'updated_at' in wq, '★ 作品雜湊只寫 owners_json（遮罩），不洗掉別的欄位')
u2 = sorted(JUDGE['levels'])[1]
h = core.work_home_unit('1420101', u2, RAW)
ok(h and h['cid'] == u1, '★ 同一個檔案已經在別關拿到 75 分 ⇒ 擋下（上學期 11-17 第二關交到第三關的教訓）')
ok(core.work_home_unit('1420101', u1, RAW) is None, '交在同一關 ⇒ 放行（改了再交）')
ok(core.work_home_unit('1420199', u2, RAW) is None, '別的學生的檔案不算（那是重複作品，另外查）')
core.record_work_hash('1420199', u1, b'other', 60)
ok(core.work_home_unit('1420199', u2, b'other') is None, '別關沒到 75 分 ⇒ 放行')

section('⑪ 伺服器（Flask 真的跑起來，假資料庫、假 AI）')
try:
    import flask  # noqa: F401
    HAVE_FLASK = True
except ImportError:
    HAVE_FLASK = False
    print('  （本機沒有 flask，略過這一段）')
if HAVE_FLASK:
    tmpd = _tf.mkdtemp()
    core.__file__ = os.path.join(tmpd, 'core11502.py'); io.open(core.__file__, 'w', encoding='utf-8').write(NEW_SRC)
    sys.modules['core11502'] = core
    srv_path = os.path.join(tmpd, 'server11502.py')
    SRV_SRC = '\n'.join(SRV.split('\n')[1:]); io.open(srv_path, 'w', encoding='utf-8').write(SRV_SRC)
    srv = types.ModuleType('server11502'); srv.__file__ = srv_path
    exec(compile(SRV_SRC, srv_path, 'exec'), srv.__dict__)
    cl = srv.app.test_client()
    def up(tok='good', unit=None, sid='1420101', data=b'sb3-A'):
        f = {'file': (io.BytesIO(data), 'w.sb3'), 'student_id': sid, 'unit': unit or u1}
        if tok:
            f['idToken'] = tok
        return cl.post('/api/student/grade', data=f, content_type='multipart/form-data')
    ok(up(None).status_code == 401 and up('other').status_code == 401, '★★★ 沒有登入憑證、或憑證是別人的 ⇒ 401（不能冒名批改）')
    ok(up(unit='5-1').status_code == 400, '不是拼圖關 ⇒ 400')
    k1 = os.environ.pop('GEMINI_API_KEY_1')
    ok(up().status_code == 503, '沒有金鑰 ⇒ 503（講清楚要設 Secrets）')
    os.environ['GEMINI_API_KEY_1'] = k1
    fs.docs.pop('11502-progress/1420101', None)
    calls[:] = []
    rr = up(data=b'sb3-fresh')
    j = rr.get_json()
    ok(rr.status_code == 200 and j['ok'] and j['result']['score'] == 88, '本人、拼圖關 ⇒ 批改成功')
    ok(j['result']['verified']['bonusMode'] and j['result']['verified']['bonus'] == 1, '★ 回報是加分制（bonusMode），+1⭐')
    ok('clean_code' not in j['result'] and '_stat' not in j['result'], '不把虛擬碼和內部統計送回學生頁面')
    ok(dec('11502-progress/1420101')['scratchVerified']['bonus'][u1] == 1, '加分寫進資料庫')
    stats = [c for c in fs.calls if c[0] == 'POST' and c[1] == '11502-grade-stats']
    ok(stats and core.fs_decode(stats[-1][3]['fields']['student_id']) == '1420101', '觀測紀錄有寫（批改觀測頁）')
    ok(up(unit=u2, data=b'sb3-fresh').status_code == 409, '★ 拿同一個檔案交到別關 ⇒ 409，不批改')
    srv._busy['1420101'] = __import__('time').time()
    ok(up(data=b'x2').status_code == 429, '★ 同一個學號同時只能一份在批改（重按不多花額度）')
    srv._busy.clear()
    core.single_agent_grading = lambda *a, **k: {'ok': False, 'score': None, 'comments': 'AI 掛了', '_stat': {'ok': False}}
    core.clean_json_for_ai = lambda raw: 'CLEAN-改過的程式'     # 程式改過 ⇒ 不會命中批改快取
    n_sub = len([c for c in fs.calls if c[1] == '11502-scratch-submissions'])
    rf = up(data=b'sb3-fail')
    ok(rf.status_code == 503 and 'AI 掛了' in rf.get_json()['error'], 'AI 失敗 ⇒ 503，講原因')
    ok(len([c for c in fs.calls if c[1] == '11502-scratch-submissions']) == n_sub, '★ 失敗的不寫成績、不記加分')
    core.single_agent_grading = fake_grade
    core.clean_json_for_ai = lambda raw: 'CLEAN'
    cj = cl.get('/api/student/config?unit=' + u1).get_json()
    ok(set(cj['config']) == {'theme', 'rules', 'student_show_score', 'has_api_key'},
       '★★ 學生拿到的設定只有四格（參考解答、空白範本不送到學生的瀏覽器）')
    qj = cl.get('/api/student/queue').get_json()
    ok(all(k in qj for k in ('pending', 'avg_seconds', 'samples', 'concurrency', 'eta')), '排隊資訊和上學期同一個格式（評分站照用）')
    for ep in ('/api/teacher/models', '/api/teacher/suggest_rules'):
        ok(cl.post(ep, json={}).status_code == 403 and cl.post(ep, json={'idToken': 'good'}).status_code == 403,
           '★ %s：沒有老師的憑證（學生的也不行）⇒ 403' % ep)
    tf = {'file': (io.BytesIO(b'z'), 't.sb3'), 'unit': u1, 'idToken': 'teacher',
          'overrides': json.dumps({'rules': '老師還沒存的', 'api_key_1': 'EVIL'})}
    calls[:] = []
    tr = cl.post('/api/teacher/test', data=tf, content_type='multipart/form-data')
    ok(tr.status_code == 200 and calls and calls[-1][0] == '老師還沒存的', '老師試評：用還沒存的規則（蓋過這一關的）')
    ok(cl.post('/api/teacher/test', data={'file': (io.BytesIO(b'z'), 't.sb3'), 'idToken': 'good'},
               content_type='multipart/form-data').status_code == 403, '★ 學生不能用試評（會花 AI 額度）')
    hj = cl.get('/api/health').get_json()
    ok(hj['has_api_key'] is True and 'criteria_error' in hj, '健康檢查回報有沒有金鑰（教師端的燈號用）')
    ok('Authorization' not in SRV_SRC.split('def _cors')[1].split('def _preflight')[0],
       'CORS 不需要開 Authorization 標頭（教師端用欄位送憑證）')

section('⑫ 前端：評分站、教師端')
GR = io.open(os.path.join(ROOT, 'shared', 'grader.html'), encoding='utf-8').read()
TE = io.open(os.path.join(ROOT, '11502', 'teacher.html'), encoding='utf-8').read()
ok("fd.append('idToken', tk)" in GR and 'window.gradeIdToken =' in GR, '評分站送 Google 登入憑證（表單欄位）')
ok(GR.index('if (_v && _v.bonusMode)') < GR.index('const _trust = !!(window.GRADING'),
   '★ 加分制的回報先處理；上學期的流程一行都沒動')
sb = GR[GR.index('async function showBonus'):GR.index('function fill(sec')]
ok('tb >= 1 && v.scoreImproved' in sb and 'reportScratch' not in sb, '加分制：有加分、分數進步才備份；學生頁面不自己寫星星')
ok('!v.simDone' in sb, '★ 拼圖還沒拼對要講清楚「加分先記著」')
ok(not _re.search(r"['\"]?Authorization['\"]?\s*:", TE.split('const GD_SERVER')[1].split('</script>')[0]),
   '★ 教師端不用 Authorization 標頭（上學期的後端 CORS 不收，一月以前會連不上）')

# ══════════════════════════════════════════════════════════════
# 第 5 步：運算思維 OCR
# ══════════════════════════════════════════════════════════════
import itertools as _it, random as _rnd

OLD_SRV = next(''.join(c['source']) for c in OLD_NB['cells']
               if c['cell_type'] == 'code' and ''.join(c['source']).startswith('%%writefile colab_server.py'))
OS_L = OLD_SRV.split('\n')[1:]
os_tree = ast.parse('\n'.join(OS_L))
def _node(tree, name):
    for n in tree.body:
        nm = getattr(n, 'name', None) or (getattr(n.targets[0], 'id', None) if isinstance(n, ast.Assign) else None)
        if nm == name:
            return n
def _seg(lines, tree, a, b=None):
    na, nb = _node(tree, a), _node(tree, b or a)
    return '\n'.join(lines[na.lineno - 1:nb.end_lineno])

TE2 = io.open(os.path.join(ROOT, '11502', 'teacher.html'), encoding='utf-8').read()
section('⑬ OCR 零件和上學期一模一樣')
ok(_seg(OS_L, os_tree, 'gas_temp_save', 'gas_upload_shot') in NEW_SRC, '★ GAS 暫存區那幾支（上傳、列出、刪除、rejected、抓檔、證書截圖）逐字相同')
ok(_seg(OS_L, os_tree, '_ocr_model', '_get_ocr') in NEW_SRC,
   '★★ 辨識引擎整段（PaddleOCR 執行緒、記憶體保護、關卡名比對、徽章形狀）逐字相同')
ok(_seg(OS_L, os_tree, '_temp_split_name') in NEW_SRC, '檔名切學號（_temp_split_name）相同')
ok(fn_src(old_tree, OLD_L, 'taipei_day') == fn_src(new_tree, NEW_L, 'taipei_day'), 'taipei_day 相同')
old_tbl = ast.literal_eval(_seg(OLD_L, old_tree, 'LEVEL_NAMES_BY_TERM').split('=', 1)[1].strip())
ok(core.LEVELS == old_tbl['11502'] and list(core.LEVELS) == list(old_tbl['11502']),
   '★ 下學期十關（名稱、英文、順序＝關卡代號）和上學期的對照表相同')
ok(not any(a != b and a in b for a in core.LEVELS for b in core.LEVELS), '十關名稱兩兩不互相包含（檔名用「包含」比對才不會誤判）')
old_lf = {}
exec(compile(fn_src(old_tree, OLD_L, 'level_from_filename'), '<old>', 'exec'),
     {'level_names': lambda term=None: old_tbl['11502']}, old_lf)
names = ['智慧選卡 - Google Chrome.png', '1420101-兌領福袋 - Chrome.png', '螢幕擷取畫面 2027-02-03.png', '',
         '夾娃娃機智慧選卡.png', 'x校慶點心', '合作學習 (1).jpg', None]
ok(all(old_lf['level_from_filename'](n, '11502') == core.level_from_filename(n) for n in names),
   '檔名 → 關卡：和上學期同一個規則（先比開頭、再比包含）')
ok(core.level_id('智慧選卡') == 1 and core.level_id('兌領福袋') == 10 and core.level_id('x') is None, '關卡代號＝表的順序 1～10')

section('⑭ 判定和上學期 /analyze 逐情境對照（假的辨識結果，兩邊各判一次）')
class FakeImg(object):
    def __init__(self, h, w):
        self.shape = (h, w, 3)
    def __getitem__(self, k):
        ys, xs = k
        return FakeImg(len(range(*ys.indices(self.shape[0]))), len(range(*xs.indices(self.shape[1]))))
fnp = types.ModuleType('numpy'); fnp.uint8 = 'u8'; fnp.frombuffer = lambda raw, dt: raw
fcv = types.ModuleType('cv2'); fcv.IMREAD_COLOR = 1; fcv.INTER_CUBIC = 2
fcv.imdecode = lambda buf, flag: None if buf == b'bad' else FakeImg(1000, 1000)
fcv.resize = lambda roi, size, fx=1, fy=1, interpolation=None: ('R', roi.shape[1], fx)
SC = {}
def f_texts(res):
    kind = 'lv' if res[1] == 550 else 'ok'
    t = SC.get((kind, res[2]), '')
    return t.split('|') if t else []
LOG = []
def f_claim(sid, cid, raw, *a):
    LOG.append(('claim', sid, cid)); return (SC['claim'], [{'sid': 'x'}] if not SC['claim'] else [])
def f_record(sid, cid, *a, **k):
    LOG.append(('record', sid, cid, k.get('drive_url'))); return [cid] if SC['record'] else None
def f_urls(sid, *a):
    LOG.append(('urls', sid)); return {'1': 'old-url', '3': 'old-url'} if SC['has_url'] else {}
def f_roster(sid):
    return ('801', '07')
def f_upload(raw, mime, term, room, seat, cid):
    LOG.append(('upload', mime, term, room, seat, cid)); return 'new-url' if SC['upload'] else None
REM = []
OLDCORE = types.SimpleNamespace(
    resolve_term=lambda t=None: '11502', level_from_filename=lambda n, t=None: core.level_from_filename(n),
    level_id=lambda n, t=None: core.level_id(n), level_names=lambda t=None: core.LEVELS, LEVEL_NAMES=core.LEVELS,
    claim_shot_hash=f_claim, record_ocr_pass=f_record, ocr_passed_urls=f_urls, roster_lookup=f_roster,
    record_ocr_stats=lambda *a, **k: None)
import mimetypes as _mt
class _FakeFile(object):          # 上學期的 /analyze 讀 request.files["file"]（不需要 flask 也跑得起來）
    def __init__(self, raw, name):
        self.raw, self.filename = raw, name
        self.mimetype = _mt.guess_type(name)[0] or 'application/octet-stream'
    def read(self):
        return self.raw
_rq = types.SimpleNamespace(form={}, files={})
ons = dict(core.__dict__)
ons.update(request=_rq, jsonify=lambda d: d, core=OLDCORE, CLASS_PASSCODES=[], CLASS_PASSCODE='', _busy_time=__import__('time'),
           _threading=__import__('threading'), traceback=__import__('traceback'), _ocr_qlock=__import__('threading').Lock(),
           _ocr_busy_sids={}, _OCR_BUSY_TTL=300, _ocr_qstate={'pending': 0, 'ticket': 0, 'served': 0},
           gas_temp_save=lambda *a: None, gas_upload_shot=f_upload, _ocr_texts=f_texts, ocr_run=lambda img, **k: img,
           _badge_shape=lambda roi: {'ok': SC['badge']}, _remember_verdict=lambda sid, p: REM.append(dict(p)))
exec(compile(_seg(OS_L, os_tree, 'ocr_analyze'), '<old ocr_analyze>', 'exec'), ons)
old_analyze = ons['ocr_analyze']
core._ocr_texts = f_texts; core.ocr_run = lambda img, **k: img; core._badge_shape = lambda roi: {'ok': SC['badge']}
core.claim_shot_hash = f_claim; core.record_ocr_pass = f_record; core.ocr_passed_urls = f_urls
core.roster_lookup = f_roster; core.gas_upload_shot = f_upload
_real_rem = core._remember_verdict
core._remember_verdict = lambda sid, p: REM.append(dict(p))
KEYS = ('status', 'pass', 'reasons', 'raw_text', 'level', 'level_source', 'level_verified', 'recorded',
        'challenge_id', 'drive_url', 'message')
def run_old(raw, fname, sid):
    # 和上學期暫存區工作者送進 /analyze 的欄位一模一樣（_temp_process_one）
    _rq.form = {'student_id': sid, 'term': '11502', 'from_temp': '1', 'password': '', 'keywords': '挑戰成功'}
    _rq.files = {'file': _FakeFile(raw, fname)}
    j = old_analyze()
    j = j[0] if isinstance(j, tuple) else j
    return {k: j.get(k) for k in KEYS}
def run_new(raw, fname, sid):
    j = core.ocr_judge(raw, fname, sid)
    return {k: j.get(k) for k in KEYS}
FN = ['智慧選卡 - Google Chrome 2027-02-03.png', '變數謎題 - Chrome.png', '螢幕擷取畫面 2027.png']
LV = ['智慧選卡|card search|adl.edu.tw', 'chrome|http', '', '必勝棋局 winnable chess|modules',
      '一段很長的字可是裡面沒有任何關卡名稱喔喔喔喔', 'variable puzzle 變數謎題']
LV2 = ['智慧選卡', '']
OKT = ['挑戰成功', '挑戰成', '']
combos = list(_it.product(FN, LV, LV2, OKT, OKT, (True, False), (True, False), (True, False), (True, False),
                          (True, False), (True, False)))
_rnd.Random(11502).shuffle(combos)
combos = combos[:2000]
saved_mods = {k: sys.modules.get(k) for k in ('numpy', 'cv2')}
sys.modules['numpy'], sys.modules['cv2'] = fnp, fcv
diffs, n_pass, n_wrong, n_borrow = [], 0, 0, 0
import contextlib as _cl
_quiet = _cl.redirect_stdout(io.StringIO())     # 兩邊每張都會印一行計時，幾千行不要洗版面
_quiet.__enter__()
try:
    for (fn, lv, lv2, s2, s3, badge, gate, claim, rec, has_url, upload) in combos:
        SC.clear(); SC.update({('lv', 1.5): lv, ('lv', 2.5): lv2, ('ok', 2.0): s2, ('ok', 3.0): s3, 'badge': badge,
                               'claim': claim, 'record': rec, 'has_url': has_url, 'upload': upload})
        core._BADGE_GATE['on'] = gate
        LOG[:] = []; REM[:] = []
        a = run_old(b'png-bytes', fn, '1420101'); la, ra = list(LOG), [dict(x) for x in REM]
        LOG[:] = []; REM[:] = []
        b = run_new(b'png-bytes', fn, '1420101'); lb, rb = list(LOG), [dict(x) for x in REM]
        if a != b or la != lb or ra != rb:
            diffs.append((fn, lv, lv2, s2, s3, badge, gate, claim, rec, has_url, upload, a, b, la, lb))
        n_pass += bool(a['pass']); n_wrong += a['reasons'] is not None and '關卡名稱不符合' in (a['reasons'] or [])
        n_borrow += any('登記過' in x for x in (a['reasons'] or []))
    SC.update({('lv', 1.5): '', ('lv', 2.5): ''})
    bad_same = run_old(b'bad', FN[0], '1420101')['message'] == run_new(b'bad', FN[0], '1420101')['message']
finally:
    _quiet.__exit__(None, None, None)
    for k, v in saved_mods.items():
        if v is None:
            sys.modules.pop(k, None)
        else:
            sys.modules[k] = v
    core._BADGE_GATE['on'] = True
ok(not diffs, '★★★ %d 個情境（通過 %d、關卡不符 %d、借圖 %d），判定結果、理由、記成績／存截圖的順序、留給學生端的判定全部相同%s'
   % (len(combos), n_pass, n_wrong, n_borrow, '' if not diffs else '　←　第一個不同：%r' % (diffs[0],)))
ok(n_pass > 20 and n_wrong > 20 and n_borrow > 5, '情境有涵蓋到通過、關卡不符、借圖')
ok(bad_same, '解不開的圖：同一句話')
core._remember_verdict = _real_rem

section('⑮ 通關紀錄、借圖、取消通關（假資料庫）')
for k in ('record_ocr_pass', 'ocr_passed_urls', 'claim_shot_hash', 'roster_lookup'):
    exec(compile(fn_src(new_tree, NEW_L, k), '<new>', 'exec'), core.__dict__)
fs.docs.clear(); fs.calls[:] = []
fs.docs['roster/1420101'] = {k: core.fs_encode(v) for k, v in {'cls': '801', 'no': '07', 'name': '王小明'}.items()}
fs.docs['11502-ocr-passed/1420101'] = {'other_field': core.fs_encode('留著')}
ok(core.record_ocr_pass('1420101', '3') == ['3'] and core.record_ocr_pass('1420101', '3') == ['3'], '記通關（同一關記兩次還是一筆）')
core.record_ocr_pass('1420101', '5', drive_url='https://drive/x')
d = core.ocr_passed_doc('1420101')
ok(d['passed'] == ['3', '5'] and d['urls'] == {'5': 'https://drive/x'} and set(d['dates']) == {'3', '5'}, '清單、證書截圖網址、通關日期')
ok(core.fs_decode(fs.docs['11502-ocr-passed/1420101']['other_field']) == '留著', '★ 用遮罩寫：同一份文件別的欄位不會被洗掉')
ok(core.record_ocr_pass('', '3') is None and core.record_ocr_pass('1420101', '') is None, '沒有學號／關卡 ⇒ 不寫')
RAW1 = b'shot-1'
ok(core.claim_shot_hash('1420101', '3', RAW1) == (True, []), '第一次用這張截圖 ⇒ 登記、算數')
ok(core.claim_shot_hash('1420101', '3', RAW1)[0] is True, '同一個學生自己重傳 ⇒ 還是算')
okc, others = core.claim_shot_hash('1420199', '3', RAW1)
ok(okc is False and others and others[0]['sid'] == '1420101', '★ 別的學號拿同一張 ⇒ 自動不計分（上學期 09-05 的規則）')
owners = json.loads(core.fs_decode(fs.docs['11502-shot-hashes/' + __import__('hashlib').sha256(RAW1).hexdigest()]['owners_json']))
ok([o['sid'] for o in owners if not o.get('rejected')] == ['1420101'] and any(o.get('rejected') for o in owners),
   '★ 被擋的人不登記成 owner（只留 rejected 紀錄給老師看）')
_h = core.HTTP
core.HTTP = lambda *a, **k: (_ for _ in ()).throw(RuntimeError('斷線'))
ok(core.claim_shot_hash('1420177', '3', b'zz') == (True, []), '★ 資料庫讀不到 ⇒ 一律放行（稽核不可以變成全班不算）')
ok(core.record_ocr_pass('1420101', '7') is None, '寫不進去 ⇒ 回 None（暫存區那張不會被刪）')
core.HTTP = _h
fs.docs['artifacts/comp-think-app/public/data/progress_sem2/801_07_王小明'] = {
    'completed': {'arrayValue': {'values': [{'integerValue': '3'}, {'integerValue': '5'}]}}}
r = core.revoke_ocr_pass('1420101', '3', reason='偽造截圖')
ok(r['ok'] and r['ocr_passed'] == '已移除' and r['ct_progress'].startswith('已移除') and r['audit'] == '已留紀錄',
   '★ 取消通關：通關清單、運算思維 app 的 completed 都刪，留稽核')
ok(core.ocr_passed_doc('1420101')['passed'] == ['5'], '通關清單剩第 5 關')
ok([core.fs_decode(v) for v in fs.docs['artifacts/comp-think-app/public/data/progress_sem2/801_07_王小明']['completed']['arrayValue']['values']] == [5],
   '★ 星星來源（progress_sem2，下學期的路徑）剩第 5 關')
ok(any(c[0] == 'POST' and c[1] == '11502-ocr-revoked' for c in fs.calls), '稽核寫進 11502-ocr-revoked')
fs.docs['11502-shot-hashes/aaa'] = {'owners_json': core.fs_encode(json.dumps([{'sid': '1420101'}, {'sid': '1420199', 'rejected': True}]))}
def _list(method, url, body=None):
    if method == 'GET' and url.split('/documents/')[1].startswith('11502-shot-hashes?'):
        return {'documents': [{'name': '.../11502-shot-hashes/' + k.split('/')[1], 'fields': v}
                              for k, v in fs.docs.items() if k.startswith('11502-shot-hashes/')]}
    return fs.http(method, url, body)
core.HTTP = _list
core._DUPE_CACHE['rep'] = None
n0 = len(fs.calls)
r1 = core.dupe_shot_report(); r2 = core.dupe_shot_report()
core.HTTP = _h
ok(r1['dupes'] and r1['dupes'][0]['held_by'] == ['1420101'] and r1['dupes'][0]['rejected'] == ['1420199'], '借圖清單：誰算數、誰被擋')
ok(r2 is r1, '★ 借圖清單暫存 5 分鐘（一次讀 300 份，狀態頁重新整理不重讀）')

section('⑯ 暫存區工作者')
SEQ = {}
core.gas_temp_fetch = lambda fid: None if fid == 'gone' else b'img-' + fid.encode()
def fake_judge(raw, fname, sid):
    return SEQ[raw]
core.ocr_judge = fake_judge
SEQ.update({b'img-a': {'status': 'success', 'pass': True, 'recorded': True},
            b'img-b': {'status': 'success', 'pass': False},
            b'img-c': {'status': 'success', 'pass': True, 'recorded': False},
            b'img-d': {'status': 'error', 'message': '引擎沒載入'}})
ok(core.temp_process_one({'id': 'a', 'name': '1420101-智慧選卡.png'}) == 'passed', '通過而且記好了 ⇒ 刪')
ok(core.temp_process_one({'id': 'b', 'name': '1420101-智慧選卡.png'}) == 'rejected', '★ 沒過 ⇒ 移到 rejected 留存（學生申訴有證據）')
ok(core.temp_process_one({'id': 'c', 'name': '1420101-智慧選卡.png'}) == '', '★★ 判定通過但成績沒寫進去 ⇒ 不刪（不然學生白做）')
ok(core.temp_process_one({'id': 'd', 'name': 'x'}) == '' and core.temp_process_one({'id': 'gone', 'name': 'x'}) == '',
   '辨識出錯、抓不到檔 ⇒ 留著下一輪再試')
MOVES = []
core.gas_temp_list = lambda term, day=None, legacy=False: ([] if (day or legacy) else
    [{'id': 'a', 'name': '1420101-智慧選卡.png', 'at': 't'}, {'id': 'b', 'name': '1420102-變數謎題.png', 'at': 't'},
     {'id': 'd', 'name': '1420103-遊園專車.png', 'at': 't'}])
core.gas_temp_delete = lambda fid: MOVES.append(('del', fid)) or True
core.gas_temp_reject = lambda fid, term: MOVES.append(('rej', fid, term)) or True
core._temp_seen.clear(); core._temp_fails.clear()
core.temp_scan_once(1)
ok(MOVES == [('del', 'a'), ('rej', 'b', '11502')], '掃一輪：通過的刪、沒過的移 rejected（學期 11502）')
ql = core.queue_list()
ok([x['student_id'] for x in ql['queue']] == ['1420103'] and ql['scan']['ok'] and 'worker' in ql and 'ocr_state' in ql,
   '★ 排隊清單只剩沒結論的那張；掃描狀態、工作者、引擎狀態都回報（學生端的提示靠這些）')
core.temp_scan_once(2)
ok(core._temp_fails.get('d', 0) == 1, '5 分鐘內不重抓同一張（不會一直重試同一張卡住別人）')
core.gas_temp_list = lambda *a, **k: (_ for _ in ()).throw(RuntimeError('GAS 掛了'))
core.temp_scan_once(3)
ql = core.queue_list()
ok(ql['scan']['ok'] is False and ql['scan']['fails'] == 1 and len(ql['queue']) == 1,
   '★ 掃描失敗：回報 ok=false、清單留著上一份（「掃到 0 張」和「掃不到」要分得出來）')
core.GAS_UPLOAD_URL = ''
ok(core.start_temp_worker() is False, '沒設 GAS 的 Secrets ⇒ 不啟動，而且印出原因')
gsrc = fn_src(new_tree, NEW_L, '_temp_worker_loop')
ok('_c11502_worker_gen' in gsrc and 'while getattr(sys' in gsrc, '★ 重跑步驟 4：舊的工作者看到代號換了會自己停（不會兩條一起掃）')

section('⑰ 伺服器：OCR 端點、教師端')
if HAVE_FLASK:
    exec(compile(SRV_SRC, srv_path, 'exec'), srv.__dict__)
    cl = srv.app.test_client()
    j = cl.get('/api/queue-list').get_json()
    ok(all(k in j for k in ('queue', 'scan', 'avg_seconds', 'ocr_state', 'worker')), '/api/queue-list 的欄位和上學期一樣（運算思維頁照用）')
    ok(cl.get('/api/my-passed?student_id=abc').status_code == 400, '學號不對 ⇒ 400')
    mp = cl.get('/api/my-passed?student_id=1420101').get_json()
    ok(mp['passed'] == ['5'] and 'urls' in mp and 'dates' in mp, '/api/my-passed：一次回清單、網址、日期（補記用）')
    core._remember_verdict('1420101', {'pass': False, 'reasons': ['關卡名稱不符合'], 'challenge_id': '3'})
    mv = cl.get('/api/my-verdict?student_id=1420101&challenge_id=3').get_json()
    ok(mv['found'] and mv['verdict']['reasons'] == ['關卡名稱不符合'] and 'age_seconds' in mv, '/api/my-verdict：後端真正的失敗理由')
    ok(cl.get('/api/my-verdict?student_id=1420101&challenge_id=4').get_json()['found'] is False, '別關的判定不會拿錯')
    hj = cl.get('/health').get_json()
    ok(hj['status'] == 'ok' and 'ocr_state' in hj and 'fingerprint' in hj, '/health 回報引擎狀態和指紋')
    ok(cl.post('/api/teacher/badge-check', json={'on': False}).status_code == 403
       and cl.post('/api/teacher/badge-check', json={'on': False, 'idToken': 'good'}).status_code == 403, '★ 徽章開關：只有老師')
    bj = cl.post('/api/teacher/badge-check', json={'on': False, 'idToken': 'teacher'}).get_json()
    ok(bj['on'] is False and core._BADGE_GATE['on'] is False, '老師可以立刻關掉徽章檢查（上課誤擋時）')
    core._BADGE_GATE['on'] = True
    ok(cl.post('/api/teacher/revoke-pass', json={'student_id': '1420101', 'challenge_id': '5', 'reason': '偽造'}).status_code == 403,
       '★ 取消通關：沒有老師的憑證 ⇒ 403')
    ok(cl.post('/api/teacher/revoke-pass', json={'student_id': '1420101', 'challenge_id': '5', 'idToken': 'teacher'}).status_code == 400,
       '★ 沒寫原因 ⇒ 400')
    rv = cl.post('/api/teacher/revoke-pass', json={'student_id': '1420101', 'challenge_id': '5', 'reason': '偽造', 'idToken': 'teacher'})
    ok(rv.status_code == 200 and rv.get_json()['ocr_passed'] == '已移除', '老師取消通關成功')
    ok(not _re.search(r'(?<!def )ocr_analyze|/analyze|CLASS_PASS', SRV_SRC), '簡化：沒有 /analyze、號碼牌、班級密碼（上傳不打 Colab）')
STC = cell('# 啟動伺服器')
ok('make_server' in STC and '_c11502_http.shutdown()' in STC, '★ 重跑步驟 4 會先關掉上一次的伺服器（新程式才會真的生效）')
ok('core11502.start_temp_worker()' in STC and 'if ROLE == "ocr"' in STC, '只有 OCR 那台啟動暫存區工作者')
ok('GAS_UPLOAD_URL' in STC and 'GAS_UPLOAD_KEY' in STC, '啟動時從 Secrets 讀 GAS 的網址和金鑰')
ok(cell('# 安裝②') == next(''.join(c['source']) for c in OLD_NB['cells']
                           if c['cell_type'] == 'code' and ''.join(c['source']).startswith('# 安裝②')), '步驟 1b（PaddleOCR 安裝）和上學期同一格')
ok(TE2.count('await gdTok()') == 6, '教師端六個功能（四個 AI、取消通關、徽章開關）都附老師的憑證')

ok("ocrBase + '/api/teacher/badge-check'" in TE2, '★ 徽章開關打到 OCR 那台（打到批改那台不會生效）')

print('\n通過 %d／失敗 %d' % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
