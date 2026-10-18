# AI 팀원 결과 → 업무OS 'AI 승인' (AI → 담당 → 리드 → 본부장) + 마케팅 허브 노트 보기 (Claude 루틴용)
# 사용:
#   python3 team_link.py open <팀원 id|이름> "<한 일>" "<볼트 노트 경로>" [YYYY-MM-DD] [--brand pourstore|grohome]
#       예) python3 team_link.py open 여름 "블로그 원고 3" "03 작업/2026-10-15 여름 블로그 원고 3.md"   (팀원 = 기본 AI 팀원 또는 크루 · 하루·포리·에코는 2026-10-14부터 쉼 → 여름)
#       → ① 볼트에 그 노트가 있으면 본문을 마케팅 허브에 올림(대시보드 [📄 보기] · 채널 미리보기)
#         ② 업무OS 'AI 승인' 한 건(pour-os/v2/aiasks) → 담당 '확인할 것' → 리드 → 본부장 (2026-10-12 사장님)
#            같은 노트를 'AI에게 다시'로 돌려받았으면 → 새 건이 아니라 같은 건의 다음 판(2번째…)으로 고침
#   python3 team_link.py feedback [일수=14] [팀원…] — 고칠 것 (팀원이 다음 작업 전에 반드시 읽음 · 팀원을 적으면 그 팀원 것만)
#       · 업무OS 'AI에게 다시'(돌려받은 말) · 상급자가 돌려보낸 말 · 안 하기로 한 이유 · 확정 규칙(담당이 정함)
#       · 사장님이 대시보드 [보기]에서 남긴 메모 (예전 방식 그대로)
#       · 참고 레퍼런스 (2026-10-17 · 업무OS 레퍼런스에 사람이 그 AI 핏을 남긴 것만 · 그 부분만 참고)
#   python3 team_link.py backs [팀원]     — 고쳐서 다시 올릴 것(AI에게 다시·더 만들기) 수만 짧게 (2026-10-15 평일 한 시간마다 '고칠 것 확인' · 0건이면 그대로 끝)
#   python3 team_link.py rules [팀원]     — 확정 규칙만 (업무OS AI 팀원 화면에서 담당이 더함)
#   python3 team_link.py asks [팀원]      — 업무OS 승인 진행 (누구 차례 · AI가 고치는 중)
#   python3 team_link.py list             — 예전 검토 줄(links aiReview · 업무OS 승인 전 방식)
#   python3 team_link.py numbers          — 오늘 숫자(판매·광고·재고·고객의 소리 · 원가 없음)를 받아 볼트 '05 오늘 숫자.md' 로 저장 (2026-10-12)
#       ← 매일 06:10 pour-construction-form GitHub Actions mkt-numbers.yml 이 대시보드와 같은 계산으로 만들어 둔 것 (옵시디언·버튼 없이 GitHub 에 쌓임)
#   python3 team_link.py archive          — 자료 쌓기 (2026-10-17): 업무OS·허브의 A·B 판정 · 최종 승인 AI 결과 · AI 크루 주간 보고(본부장에게 보낸 칸) · 월말 보고서(확정본)
#       · 광고 일일·주간 보고 · NPS(설문 + 유선 조사 흔적) · 고객의 소리 → 볼트 '04 자료/' 월별 노트 + '04 자료/00 최신 요약.md' (읽기만)
#       · 쓰는 것은 하나뿐 (2026-10-18 사장님 3A): '00 최신 요약' 같은 글 → 허브 mkt-notes/vault-latest → Aside 크루 지시문 '■ 볼트 최신 요약' (허브 [📄 보기] 목록엔 안 보임)
# 쓰는 곳 (pour-app-new · 공개 규칙 pour-os/{doc=**} · 규칙 변경 없음):
#   pour-os/v2/aiasks/{id}                     — AI 승인 한 건 (모양 = pour-construction-form marketing-hub/crew.js askDoc 과 같게)
#   pour-os/marketing-hub/mkt-notes/{노트 id}  — 노트 본문(마크다운) + 사장님 메모 memo/memoAt/memoBy
#   pour-os/marketing-hub/mkt-notes/vault-latest — 볼트 '04 자료/00 최신 요약' 한 장 {title, body, date, at, kind 'vault', from} (archive · crew.js VAULT_NOTE)
#     본문 = 게시할 원고(제품 판매가만 · 원가·제조사·개인정보는 볼트 규칙상 처음부터 없음). 보안 규칙 게시 뒤에도 이 공개 자리에 둠(루틴은 로그인이 없음)
#   실제 게시·발행·전송은 늘 사람 (최종 승인 → 담당이 허브 [임시저장 맡기기] → Aside 임시저장 → 사람이 발행)
# 볼트 위치: 환경변수 MKT_VAULT → 이 파일이 볼트 tools/ 안이면 그 볼트 → /home/user/pour-marketing-vault
# ⚠️ 같은 파일 두 곳(2026-10-11 · 저장소 비공개 전환으로 루틴이 이 저장소를 못 받음): pour-construction-form/marketing-hub/tools/team_link.py · pour-marketing-vault/tools/team_link.py — 고치면 둘 다
import sys, os, json, re, time, urllib.request, urllib.parse, urllib.error, datetime, hashlib
KEY = 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU'
EMU = os.environ.get('FIRESTORE_EMULATOR_HOST')  # 시험(에뮬레이터)에서만 — 실제 DB 안 씀
DOCS = (f'http://{EMU}' if EMU else 'https://firestore.googleapis.com') + '/v1/projects/pour-app-new/databases/(default)/documents'
BASE = DOCS + '/pour-os/v2/links'
ASKS = DOCS + '/pour-os/v2/aiasks'
NOTES = DOCS + '/pour-os/marketing-hub/mkt-notes'
HUB = 'https://pour-construction-form.pages.dev/marketing-hub/'
_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 볼트 안 tools/ 에서 돌면 그 볼트
VAULT = os.environ.get('MKT_VAULT') or (_HERE if os.path.isdir(os.path.join(_HERE, '02 팀원')) else '/home/user/pour-marketing-vault')
MAX_BODY = 800000  # Firestore 문서 1MB 한도 안
TEAM = {'haru': '하루', 'pori': '포리', 'luna': '루나', 'teo': '테오', 'noa': '노아', 'tobi': '토비', 'moka': '모카', 'leo': '레오', 'kei': '케이',
        'daon': '다온', 'sora': '소라', 'roy': '로이', 'ria': '리아', 'jay': '제이', 'eco': '에코', 'nari': '나리', 'onyu': '온유'}  # core.js TEAM · crew.js BASE_TEAM 과 같게
ADMIN_ONLY = {'noa'}  # 원가·제조사 일 → 업무OS 승인에 안 올림 (관리자 마진 대시보드)
# 크루 = crew.js CREWS 팀원 (id: (이름, 크루 id) · crew.test.mjs 가 같은지 봄) — 루틴이 노트로 올리는 크루 일은 이 도구로 (보드 결과 지표·할 일 A~E 는 허브 crew.html)
CREW = {'yeoreum': ('여름', 'b2c'), 'gaeul': ('가을', 'b2c'), 'gyeoul': ('겨울', 'b2c'), 'uju': ('우주', 'b2c'), 'haneul': ('하늘', 'b2c'), 'bom': ('봄', 'b2c'), 'baram': ('바람', 'b2c'),   # 2026-10-17 AARRR 순서 · 봄(MD) = 매출 볼륨(하늘 다음 · 사장님 정의) · 바람 = 지인추천
        'ieum': ('이음', 'b2c'), 'byeol': ('별', 'b2c'), 'dal': ('달', 'b2c'),   # 2026-10-17 새 크루원 (운영·전략 · Aside 보드)
        'dandan': ('단단', 'b2b'), 'cheokcheok': ('척척', 'b2b'), 'kkomkkom': ('꼼꼼', 'b2b'), 'deundeun': ('든든', 'b2b'), 'teunteun': ('튼튼', 'b2b'),
        'saessak': ('새싹', 'bd'), 'malgeum': ('맑음', 'bd'), 'santteut': ('산뜻', 'bd'), 'bosong': ('보송', 'bd'), 'pogeun': ('포근', 'bd'), 'hyanggeut': ('향긋', 'bd')}
# 쉬는 기본 AI 팀원 → 이어받은 크루 (2026-10-14 사장님 "포리, 하루, 에코는 없어야지" · 아침 루틴 = B2C 크루 여름) — 새로 올리기 막음 · 옛 결과·기록은 그대로 · 돌려받은 옛 건은 이어받은 팀원이 고쳐 다음 판
GONE = {'haru': 'yeoreum', 'pori': 'yeoreum', 'eco': 'yeoreum'}
NAMES = {**TEAM, **{k: v[0] for k, v in CREW.items()}}
# 아침 루틴 횟수 (2026-10-15 사장님 "횟수 조절을 사람팀원이하면 더 추가해서 생성가능하게") — 기본 = crew.js member.routineQty (crew.test.mjs 가 같은지 봄)
#   담당이 업무OS AI 팀원 한 장에서 바꾸면 aimates/{AI}.qty.<열쇠>.n → feedback '■ 횟수' 로 알려 줌(루틴은 그 수만큼)
ROUTINE_QTY = {'yeoreum': [('blog', '블로그 원고', 3, '편'), ('tistory', '티스토리 글', 1, '편'), ('cafe', '카페 글', 2, '편')]}
TOOL = set(TEAM) | set(GONE.values())  # 노트로 올리는 팀원(기본 AI 팀원 + 아침 루틴을 이어받은 여름) — feedback 에 팀원을 안 적으면 이 팀원들 규칙만 (크루 보드 규칙은 crew.html)
def crew_of(mid): return CREW[mid][1] if mid in CREW else 'base'
BRANDS = {'grohome': '그로홈', 'pourstore': 'POUR스토어', 'bmupq52c0': '바라스데이'}
EXEC_POST = '최종 승인되면 담당이 마케팅 허브 [📄 보기]에서 [임시저장 맡기기] → 앱에서 사진 넣고 발행한다 (발행은 사람)'
STATE_L = {'wait': '승인 대기', 'back': 'AI가 고치는 중', 'ok': '최종 승인', 'no': '안 함'}

def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    if v is None: return {'nullValue': None}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    if isinstance(v, (list, tuple)): return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
    return {'stringValue': str(v)}

def dec(v):
    k, x = next(iter(v.items()))
    if k == 'nullValue': return None
    if k == 'integerValue': return int(x)
    if k == 'arrayValue': return [dec(y) for y in x.get('values', [])]
    if k == 'mapValue': return {a: dec(b) for a, b in x.get('fields', {}).items()}
    return x

def member(x):
    for k, n in NAMES.items():
        if x in (k, n): return k, n
    sys.exit(f'모르는 팀원: {x}')

def kst_today():
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

RETRY = (429, 500, 502, 503, 504)  # 요청 과다(2026-10-12 아침 루틴에서 429)·일시 오류 → 2·4·8·16초 뒤 다시 (거절된 요청이라 다시 보내도 안전)
def req(url, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    for i in range(5):
        r = urllib.request.Request(url, method=method, data=data, headers={'Content-Type': 'application/json'})
        try: return json.loads(urllib.request.urlopen(r, timeout=60).read() or b'{}')
        except urllib.error.HTTPError as e:
            if e.code in RETRY and i < 4:
                sys.stderr.write(f'Firestore {e.code} — {2 ** (i + 1)}초 뒤 다시 ({i + 1}/4)\n'); time.sleep(2 ** (i + 1)); continue
            if e.code != 404: sys.stderr.write(f'Firestore {e.code}: {e.read().decode("utf-8", "ignore")[:400]}\n')
            raise
        except urllib.error.URLError as e:
            if i < 4: sys.stderr.write(f'연결 오류 — {2 ** (i + 1)}초 뒤 다시 ({i + 1}/4): {e}\n'); time.sleep(2 ** (i + 1)); continue
            raise

def patch(url, fields, mask=None, pre=None):
    q = '?key=' + KEY + (''.join('&updateMask.fieldPaths=' + urllib.parse.quote(m) for m in mask) if mask else '') + (('&' + pre) if pre else '')
    return req(url + q, 'PATCH', {'fields': {k: enc(v) for k, v in fields.items()}})

def get(url):
    try: d = req(url + '?key=' + KEY)
    except urllib.error.HTTPError as e:
        if e.code == 404: return None, None
        raise
    return {k: dec(v) for k, v in d.get('fields', {}).items()}, d.get('updateTime')

def run_query(collection_parent, cid, filters):
    q = {'structuredQuery': {'from': [{'collectionId': cid}], **({'where': filters} if filters else {})}}
    return [x['document'] for x in req(collection_parent + ':runQuery?key=' + KEY, 'POST', q) if 'document' in x]

def fdocs(rows): return [{**{k: dec(v) for k, v in d.get('fields', {}).items()}, '_id': d['name'].split('/')[-1]} for d in rows]
def eqf(field, value): return {'fieldFilter': {'field': {'fieldPath': field}, 'op': 'EQUAL', 'value': enc(value)}}

def owner_of(mid, brand=''):
    # 업무OS AI 팀원 담당 (aimates/{id}.owners[브랜드] → 기본) · 사용 중인 사람만 · 없으면 '' = 관리자 누구나
    d, _ = get(f'{DOCS}/pour-os/v2/aimates/{mid}')
    o = (d or {}).get('owners') or {}
    uid = (brand and o.get(brand)) or o.get('_') or ''
    if not uid: return '', ''
    u, _ = get(f'{DOCS}/pour-os/v2/users/{uid}')
    if not u or u.get('active') is False: return '', ''
    return uid, u.get('name', '')

def can_redo(cur): return bool(cur) and (cur.get('state') == 'back' or (cur.get('state') == 'wait' and not (cur.get('step') or 0) > 0))

def commit(url, fields, pre, mask=True):
    # 조건부 쓰기 한 번(:commit) — pre = {'updateTime': 읽은 때} (그사이 안 바뀐 때만) · {'exists': False} (없을 때만)
    name = url[url.index('projects/'):]
    w = {'update': {'name': name, 'fields': {k: enc(v) for k, v in fields.items()}}, 'currentDocument': pre}
    if mask: w['updateMask'] = {'fieldPaths': list(fields)}
    try: return req(DOCS + ':commit?key=' + KEY, 'POST', {'writes': [w]})
    except urllib.error.HTTPError as e:
        if e.code in (400, 409): return None  # FAILED_PRECONDITION · ALREADY_EXISTS
        raise

def open_link(who, what, note, date=None, brand=''):
    mid, name = member(who)
    if mid in ADMIN_ONLY: sys.exit(f'{name}(관리자 전용 · 원가·제조사)는 업무OS 승인에 올리지 않아요 — 관리자 마진 대시보드에서')
    if mid in GONE: sys.exit(f'{name}: 2026-10-14부터 쉬어요 — 이 일은 B2C 크루 {NAMES[GONE[mid]]} 몫이에요: open {NAMES[GONE[mid]]} …')
    date = date or kst_today()
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date): sys.exit('날짜는 YYYY-MM-DD')
    if brand and brand not in BRANDS: sys.exit('브랜드는 ' + ' · '.join(BRANDS))
    h = hashlib.sha1((what + '|' + note).encode()).hexdigest()[:8]
    lid = f'mkt-ai-{mid}-{date}-{h}'
    title = f'{name} · {what}'[:120]
    p = os.path.join(VAULT, note); body = ''
    if os.path.isfile(p):
        body = open(p, encoding='utf-8').read()
        if len(body.encode('utf-8')) > MAX_BODY: body = body.encode('utf-8')[:MAX_BODY].decode('utf-8', 'ignore') + '\n\n…(너무 길어 잘림 — 옵시디언에서 전체 보기)'
    # ① 어느 승인 건인지 먼저 정함 (본문을 쓰기 전에 — 위로 올라간 건의 본문을 바꾸지 않게)
    #    같은 노트를 돌려받은 건(AI에게 다시 · 아직 담당 차례)이 있으면 그 건의 다음 판 · 아니면 새 건
    at = now_iso(); owner, owner_name = owner_of(mid, brand)
    olds = [x for x in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', eqf('note', note))) if x.get('mate') == mid or GONE.get(x.get('mate')) == mid]   # 쉬는 팀원의 돌려받은 옛 건도 이어받아 다음 판
    redo = next((x for x in sorted(olds, key=lambda x: x.get('createdAt', ''), reverse=True) if can_redo(x)), None)
    if redo:
        aid = redo['_id']; cur, ut = get(f'{ASKS}/{aid}')
        if not can_redo(cur): sys.exit(f'그사이 승인이 진행됐어요 ({STATE_L.get((cur or {}).get("state"), "없음")}) — 새 날짜로 다시 올려 주세요')
        lid = cur.get('noteId') or lid
    else:
        aid = f'ai_{mid}_{date.replace("-", "")}_{h}'
        cur, _ = get(f'{ASKS}/{aid}')
        if cur: sys.exit(f'같은 결과가 이미 올라가 있어요 ({STATE_L.get(cur.get("state"), cur.get("state"))}) — 고친 거면 노트 이름을 바꾸거나 날짜를 바꿔 주세요: {aid}')
    # ② 노트 본문 → 마케팅 허브 [📄 보기] (사장님 메모 memo·memoAt·memoBy 는 안 건드림)
    f = {'member': mid, 'title': f'검토: {name} {what}'[:60], 'note': note, 'date': date, 'at': at, **({'body': body} if body else {})}
    patch(f'{NOTES}/{lid}', f, mask=list(f))
    print(('본문 올림: ' + f'{len(body)}자 → 대시보드 [보기]') if body else ('노트 파일 없음 → 본문 없이: ' + p))
    url = HUB + '#note-' + urllib.parse.quote(lid)
    # ③ 업무OS AI 승인 (pour-os/v2/aiasks) — 조건부: 다시 = 읽은 때 그대로일 때만 · 새로 = 없을 때만
    if redo:
        nf = {'title': title, 'mate': mid, 'mateName': name, 'crew': crew_of(mid), 'sum': '', 'note': note, 'noteId': lid, 'url': url, 'owner': owner or cur.get('owner') or '', 'to': owner or cur.get('owner') or '', 'step': 0, 'state': 'wait',
              'path': [], 'pick': None, 'ver': int(cur.get('ver') or 1) + 1, 'back': None, 'ret': None, 'hqUp': None, 'leadUp': None, 'updatedAt': at,
              'log': (cur.get('log') or []) + [{'at': at, 'by': 'ai:' + mid, 'byName': f'{name} (AI)', 'act': 'redo'}]}
        if commit(f'{ASKS}/{aid}', nf, {'updateTime': ut}) is None: sys.exit('그사이 업무OS에서 이 건이 바뀌었어요 — 한 번 더 실행해 주세요')
        print(f'업무OS 승인 고쳐서 다시: {aid} · {nf["ver"]}번째 판 · 차례 {owner_name or "관리자 누구나"}')
        return
    doc = {'id': aid, 'crew': crew_of(mid), 'mate': mid, 'mateName': name, 'brand': brand, 'board': '', 'act': '', 'run': date, 'title': title, 'sum': '', 'body': '', 'cols': [], 'items': [],
           'exec': EXEC_POST, 'url': url, 'note': note, 'noteId': lid, 'metrics': [], 'owner': owner, 'to': owner, 'step': 0, 'state': 'wait', 'path': [], 'pick': None, 'ver': 1,
           'back': None, 'ret': None, 'log': [{'at': at, 'by': 'ai:' + mid, 'byName': f'{name} (AI)', 'act': 'ask'}], 'createdAt': at, 'updatedAt': at,
           'by': 'ai:' + mid, 'byName': f'{name} (AI)', 'src': 'tool'}
    if commit(f'{ASKS}/{aid}', doc, {'exists': False}, mask=False) is None: sys.exit(f'같은 결과가 방금 올라갔어요: {aid}')
    print(f'업무OS 승인 올림: {aid} · {title} · 차례 {owner_name or "관리자 누구나 (담당 미정)"}')

def list_open():
    rows = run_query(DOCS + '/pour-os/v2', 'links', {'compositeFilter': {'op': 'AND', 'filters': [eqf('src', 'mkt'), eqf('open', True)]}})
    print(f'예전 검토 줄 {len(rows)}건 (업무OS 승인 전 방식 · 허브 [검토 끝]으로 닫음)')
    for d in rows:
        f = {k: dec(v) for k, v in d['fields'].items()}
        print('-', f.get('date', ''), f.get('kind', ''), f.get('title', ''), '·', f.get('sub', ''))

def mates_docs():
    return {(d.get('id') or d['_id']): d for d in fdocs(run_query(DOCS + '/pour-os/v2', 'aimates', None))}

# 참고 레퍼런스 (2026-10-17 사장님 4A "크루가 찾아오면 사람이 핏을 해당레퍼런스에 ~~부분만 사용 이런식으로 표식남기면 이용 하게끔")
#   업무OS 레퍼런스(pour-os/v2/refs)에 사람이 이 AI 핏(어느 부분만 쓸지 한 줄)을 남긴 것만 · crew.js refRows 와 같은 규칙(숨긴 것 · 원가·마진·제조사·공급가 있는 것 뺌 · 전화·메일 가림 · 최근 8개)
REF_SECRET_RE = re.compile(r'마진|원가|공급\s*단가|공급가|매입|제조사')   # crew.js SECRET_RE 와 같게 (참고 레퍼런스용 · 아래 자료 쌓기 SECRET_RE 는 '이익'까지 따로)
REF_AI_MAX = 8   # crew.js REF_AI_MAX 와 같게
def ref_pii(s): return re.sub(r'[\w.+-]+@[\w-]+\.[\w.-]+', '(메일 가림)', re.sub(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}', '010-****-****', str(s or '')))   # crew.js maskPII 와 같게
def one_line(s, n): return ref_pii(' '.join(str(s or '').split()))[:n]
def kst_day(iso):
    try: return (datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00')) + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
    except Exception: return ''
def ref_rows(mid):
    f = {'fieldFilter': {'field': {'fieldPath': 'fitMates'}, 'op': 'ARRAY_CONTAINS', 'value': enc(mid)}}
    out = []
    for r in fdocs(run_query(DOCS + '/pour-os/v2', 'refs', f)):
        if (r.get('removed') or {}).get('at'): continue
        ft = (r.get('fits') or {}).get(mid) or {}
        fit, what = one_line(ft.get('text'), 300), one_line(r.get('text'), 160)
        if not fit or REF_SECRET_RE.search(fit) or REF_SECRET_RE.search(what): continue
        url = str(r.get('url') or '').strip()
        out.append({'id': r.get('id') or r.get('_id'), 'kind': r.get('kind') or '기타', 'brand': {'grohome': '그로홈', 'pourstore': 'POUR스토어', 'bmupq52c0': '바라스데이', 'bmuqo9k5u': '모여라딜'}.get(r.get('brand') or '', ''),
                    'what': what, 'fit': fit, 'by': one_line(ft.get('byName'), 20), 'at': kst_day(ft.get('at')), 'url': url[:300] if re.match(r'^https?://', url, re.I) else '',
                    'files': [(one_line(x.get('name') or '사진', 60), x.get('url')) for x in (r.get('files') or []) if isinstance(x, dict) and re.match(r'^https?://', str(x.get('url') or ''), re.I)][:4]})
    out.sort(key=lambda x: (x['at'], str(x['id'])), reverse=True)
    return out[:REF_AI_MAX]

def mates_rules(only=None, docs=None):
    out = {}
    for mid, d in (docs if docs is not None else mates_docs()).items():
        if only and mid != only: continue
        r = [x for x in (d.get('rules') or []) if not x.get('off')]
        if r: out[mid] = r
    return out

def qty_lines(mid, doc):
    # 아침 루틴 횟수: 담당이 정한 수(qty.<열쇠>.n) → 없으면 기본
    out = []
    for k, l, n, u in ROUTINE_QTY.get(mid, []):
        x = ((doc or {}).get('qty') or {}).get(k) or {}
        try: v = int(x.get('n') or 0)
        except (TypeError, ValueError): v = 0
        out.append(f"{l} {v}{u} (담당 {x.get('byName', '')} · {str(x.get('at', ''))[5:10].replace('-', '/')} · 기본 {n}{u})" if v > 0 and v != n else f'{l} {n}{u} (기본)')
    return out

def rules(who=None):
    mid = member(who)[0] if who else None
    rs = mates_rules(mid)
    print(f'확정 규칙 (업무OS AI 팀원 화면 · 담당이 더함){" · " + NAMES.get(mid, mid) if mid else ""}')
    if not rs: print('없음'); return
    for m, r in rs.items():
        print(f'\n## {NAMES.get(m, m)}')
        for x in r: print(f'- {x.get("text", "")} ({x.get("byName", "")} · {str(x.get("at", ""))[:10]})')

def asks(who=None):
    mid = member(who)[0] if who else None
    rows = fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', {'fieldFilter': {'field': {'fieldPath': 'state'}, 'op': 'IN', 'value': enc(['wait', 'back'])}}))
    rows = [x for x in rows if (not mid or x.get('mate') == mid)]
    rows.sort(key=lambda x: (x.get('state', ''), x.get('run', '')))
    print(f'업무OS AI 승인 진행 {len(rows)}건')
    for x in rows: print('-', x.get('run', ''), STATE_L.get(x.get('state'), x.get('state')), f"{x.get('step', 0) + 1}단계" if x.get('state') == 'wait' else '', x.get('title', ''), '·', x['_id'])

# 고쳐서 다시 올릴 것만 짧게 (2026-10-15 사장님 "수정요청하면 바로 ai크루가 반영하게해" → 평일 한 시간마다 '고칠 것 확인' 세션이 먼저 부름 · 있을 때만 feedback 으로 자세히)
def backs(who=None):
    if who: who = list(dict.fromkeys(who + [g for g, to in GONE.items() if to in who]))
    rows = [a for a in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', eqf('state', 'back'))) if not a.get('board') and (not who or a.get('mate') in who)]
    print(f'고쳐서 다시 {len(rows)}건' + (' — 자세히: feedback 14 <팀원>' if rows else ' — 할 일 없음'))
    for a in sorted(rows, key=lambda x: x.get('run', '')):
        more = (a.get('back') or {}).get('more') or 0
        print('-', a.get('run', ''), a.get('title', ''), f'· 더 만들기 {more}개' if more else '', '·', a.get('note', ''))

def feedback(days=14, who=None):
    since = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9) - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
    if who: who = list(dict.fromkeys(who + [g for g, to in GONE.items() if to in who]))   # 이어받은 팀원 = 쉬는 팀원의 옛 건도 (돌려받은 것 · 돌려보낸 말 · 규칙 · 메모)
    mine = lambda a: not a.get('board') and (not who or a.get('mate') in who)  # 노트로 올린 건(이 도구 · 기본 AI 팀원·크루) · 크루 보드(Aside) 건은 crew.html 에서 다시
    if who: print('팀원: ' + ' · '.join(NAMES.get(m, m) for m in who))
    # 업무OS: AI 에게 다시(지금 고칠 것) · 돌려보낸 말 · 안 함 이유 (최근 일수)
    back = [a for a in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', eqf('state', 'back'))) if mine(a)]
    print(f'■ 고쳐서 다시 올릴 것 {len(back)}건 (업무OS AI에게 다시·더 만들기 · 같은 노트 경로로 고쳐 저장 → open 다시 = 다음 판)')
    for a in sorted(back, key=lambda x: x.get('run', '')):
        b = a.get('back') or {}
        more = b.get('more') or 0
        print(f"\n### {a.get('run', '')} {a.get('mateName', NAMES.get(a.get('mate'), ''))} · {a.get('title', '')}\n노트: {a.get('note', '')}\n({b.get('byName', '')} · {str(b.get('at', ''))[:16]})\n{b.get('text', '')}")
        if more: print(f"→ 더 만들기 {more}개: 지금 노트의 글은 그대로 두고 같은 노트에 이어서 {more}개 더 쓴다 (블로그 원고면 다음 번호 ## 칸으로) → open 다시 = 같은 건의 다음 판")
    recent = [x for x in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', {'fieldFilter': {'field': {'fieldPath': 'updatedAt'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': enc(since)}})) if mine(x)]
    notes = []
    for a in recent:
        for l in a.get('log') or []:
            if l.get('act') in ('ret', 'no') and l.get('text') and str(l.get('at', '')) >= since: notes.append((str(l.get('at', '')), a, l))
    notes.sort(key=lambda x: x[0])
    print(f'\n■ 상급자가 돌려보낸 말 · 안 하기로 한 이유 {len(notes)}건 (최근 {days}일 · 같은 실수 반복 금지)')
    for at, a, l in notes:
        print(f"- {at[:10]} {a.get('mateName', '')} · {a.get('title', '')} — {'돌려보냄' if l.get('act') == 'ret' else '안 함'}: {l.get('text', '')} ({l.get('byName', '')})")
    docs = mates_docs()
    qs = [(m, x) for m in sorted(who or TOOL) if m in ROUTINE_QTY for x in qty_lines(m, docs.get(m))]
    if qs:
        print(f'\n■ 횟수 (담당이 업무OS AI 팀원 한 장에서 정함 · 오늘 이 수만큼 · 꼭 지킴)')
        for m, x in qs: print(f'- {NAMES.get(m, m)}: {x}')
    rs = {m: r for m, r in mates_rules(docs=docs).items() if m in (who or TOOL)}
    print(f'\n■ 확정 규칙 {sum(len(v) for v in rs.values())}개 (업무OS AI 팀원 화면 · 꼭 지킴)')
    for m, r in rs.items():
        for x in r: print(f'- {NAMES.get(m, m)}: {x.get("text", "")}')
    refs = [(m, r) for m in sorted(who or TOOL) if m in CREW for r in ref_rows(m)]
    print(f'\n■ 참고 레퍼런스 {len(refs)}개 (업무OS 레퍼런스에 사람이 남긴 핏 · \'쓸 부분\'만 참고 · 그대로 베끼지 않음 · 쓴 노트 근거에 [참고: 종류 날짜])')
    for m, r in refs:
        print(f"- {NAMES.get(m, m)}: {r['kind']}{' · ' + r['brand'] if r['brand'] else ''} · {r['at'][5:].replace('-', '/')} 핏{'(' + r['by'] + ')' if r['by'] else ''} — 쓸 부분: {r['fit']}")
        print(f"    무엇: {r['what'] or '(사진만)'}")
        if r['url']: print(f"    링크: {r['url']}")
        for nm, u in r['files']: print(f"    사진: {nm} {u}")
    # 사장님 대시보드 메모 (예전 방식 그대로)
    rows = run_query(DOCS + '/pour-os/marketing-hub', 'mkt-notes', {'fieldFilter': {'field': {'fieldPath': 'date'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': enc(since)}})
    rows = [{k: dec(v) for k, v in d['fields'].items()} for d in rows]
    rows = [r for r in rows if (r.get('memo') or '').strip() and (not who or r.get('member') in who)]
    rows.sort(key=lambda r: (r.get('date', ''), str(r.get('memoAt', ''))))
    print(f'\n■ 사장님 메모 {len(rows)}건 (최근 {days}일 · 대시보드 [보기]에서 남김)')
    for r in rows:
        print(f"\n### {r.get('date', '')} {NAMES.get(r.get('member', ''), r.get('member', ''))} · {r.get('note', '')}")
        print(f"({r.get('memoBy', '')} · {r.get('memoAt', '')})")
        print(r.get('memo', '').strip())

def numbers():
    url = NOTES + '/today-numbers?key=' + KEY
    try:
        d = req(url)
    except urllib.error.HTTPError as e:
        if e.code == 404: sys.exit('오늘 숫자 없음 — 매일 06:10 작업(mkt-numbers)이 아직 한 번도 안 돎')
        raise
    f = d.get('fields', {})
    body, date = dec(f.get('body', {'stringValue': ''})) or '', dec(f.get('date', {'stringValue': ''})) or ''
    if not body.strip(): sys.exit('오늘 숫자 본문이 비어 있음 — 저장하지 않음')
    path = os.path.join(VAULT, '05 오늘 숫자.md')
    with open(path, 'w', encoding='utf-8') as fp: fp.write(body if body.endswith('\n') else body + '\n')
    age = (datetime.date.fromisoformat(kst_today()) - datetime.date.fromisoformat(date)).days if re.match(r'^\d{4}-\d{2}-\d{2}$', date) else None
    print(f'05 오늘 숫자.md 저장 · 기준일 {date}' + (f' · ⚠️ {age}일 전 숫자 (매일 작업이 멈췄는지 확인)' if age and age > 1 else ''))

# ── 자료 쌓기 (2026-10-17 사장님 "모든 리포트, nps조사결과 등등 볼트에 축척하여 최신자료물을 기반으로 볼트를 통해 더 나은 방안으로 ai크루와 사람팀원들이 전략기획이 되도록해") ──
#   archive = 업무OS·허브에서 읽기만 해서 볼트 '04 자료/' 에 노트로 쌓음 (DB 에 쓰지 않음)
#   · 노트마다 '건수:' — 원본에서 지워져 건수가 줄면 그 노트는 안 덮음(볼트엔 남김 = 지우지 않음) · 같으면 그대로(커밋 안 생김)
#   · 원가·마진·공급가·매입·제조사·이익 말이 든 줄은 빼고(crew.js SECRET_RE + 이익) · 전화·메일·동호수는 가림(허브 maskPII 와 같게)
ARCH = '04 자료'
SECRET_RE = re.compile(r'마진|원가|공급\s*단가|공급가|매입|제조사|이익')
LEDGER_ACTS = {('yeoreum', 'J'), ('gaeul', 'J'), ('gyeoul', 'H')}   # A/B 판정 (crew.js LEDGER_ACTS)
NPS_ACTS = {('baram', 'C'), ('uju', 'F'), ('teunteun', 'A')}        # NPS 유선 조사 (우주 F = 바람 C 로 옮기기 전 옛 자리)
CREW_L = {'b2c': 'B2C 크루', 'b2b': 'B2B 크루', 'bd': '바라스데이 크루'}
VAULT_NOTE = 'vault-latest'   # crew.js VAULT_NOTE 와 같게 (crew.test.mjs 가 봄) · 허브 [📄 보기]는 노트를 id 로만 열어 목록에 안 보임

def vault_doc(text, today):
    return {'title': '볼트 최신 요약', 'body': text, 'date': today, 'at': now_iso(), 'kind': 'vault', 'from': 'team_link archive'}

def put_vault(text, today):
    # '00 최신 요약' 같은 글 → 허브 한 장 (2026-10-18 사장님 3A) → crew.html 이 Aside 크루 지시문 '■ 볼트 최신 요약'에 넣음
    #   볼트 노트는 이미 썼으니 못 올려도 멈추지 않음 — 알리고 넘어감 (Aside 지시문엔 지난번 요약이 그대로 · 14일 넘으면 crew.js 가 안 넣음)
    f = vault_doc(text, today)
    try: patch(f'{NOTES}/{VAULT_NOTE}', f, mask=list(f))
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        sys.stderr.write(f'허브 볼트 최신 요약 못 올림 — Aside 지시문엔 지난번 요약이 남음: {e}\n'); return False
    return True

def mask_pii(s):
    s = re.sub(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}', '010-****-****', str(s if s is not None else ''))
    s = re.sub(r'[\w.+-]+@[\w-]+\.[\w.-]+', '(메일 가림)', s)
    s = re.sub(r'\+?\d[\d\-.\s]{7,}\d', lambda m: '(번호)' if len(re.sub(r'\D', '', m.group())) >= 9 else m.group(), s)
    return re.sub(r'\d+\s*동\s*\d+\s*호', '(동호수)', s)

def cl(s, n=0):  # 한 줄 칸 — 표·목록용
    t = ' '.join(mask_pii(s).split()).replace('|', '/')
    if SECRET_RE.search(t): return '(원가·마진 말이 있어 뺌)'
    return (t[:n] + '…') if n and len(t) > n else t

def cl_md(md):  # 여러 줄 글 — 그 말이 든 줄만 뺌
    return '\n'.join('(원가·마진 줄 뺌)' if SECRET_RE.search(x) else mask_pii(x) for x in str(md or '').splitlines())

def quote(md):  # 옵시디언 접는 칸 안에 넣을 글
    return '\n'.join('> ' + x if x.strip() else '>' for x in str(md or '').splitlines())

def kday(iso):
    try: return (datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00')) + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
    except Exception: return str(iso or '')[:10]

def list_all(parent, cid):
    out, tok = [], ''
    while True:
        u = f'{parent}/{cid}?key={KEY}&pageSize=300' + (f'&pageToken={urllib.parse.quote(tok)}' if tok else '')
        try: d = req(u)
        except urllib.error.HTTPError as e:
            if e.code in (403, 404): sys.stderr.write(f'{cid}: 못 읽음({e.code}) — 건너뜀\n'); return out
            raise
        out += [{**{k: dec(v) for k, v in x.get('fields', {}).items()}, '_id': x['name'].split('/')[-1]} for x in d.get('documents', [])]
        tok = d.get('nextPageToken')
        if not tok: return out

def put_note(rel, title, kind, rows, body):
    # rows = 건수 · 이미 있는 노트의 건수보다 적으면 안 덮음 · 내용이 같으면 그대로
    p = os.path.join(VAULT, ARCH, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    text = f'---\n유형: 자료\n자료: {kind}\n건수: {rows}\n---\n# {title}\n\n> 업무OS·허브 기록을 `team_link.py archive` 가 옮긴 것 — 손으로 고치지 말고, 생각·결정은 [[00 최신 요약]]이나 03 작업 노트에\n\n{body.rstrip()}\n'
    if os.path.isfile(p):
        old = open(p, encoding='utf-8').read()
        m = re.search(r'^건수: (\d+)$', old, re.M)
        if m and int(m.group(1)) > rows: return 'keep'
        if old == text: return 'same'
    with open(p, 'w', encoding='utf-8') as f: f.write(text)
    return 'write'

def mate_name(mid): return NAMES.get(mid, mid or '')
def picked(a):
    its, pk = a.get('items') or [], a.get('pick')
    return [it for it in its if str(it.get('n')) in {str(x) for x in pk}] if isinstance(pk, list) and pk else its
def note_link(a):
    n = a.get('note') or ''
    return f'[[{n[:-3] if n.endswith(".md") else n}]]' if n else (f'[허브]({a["url"]})' if a.get('url') else '')

def fmt_v(u, v):
    if v is None or v == '': return '—'
    try: x = float(v)
    except (TypeError, ValueError): return cl(v)
    if u == '만': return f'{x / 10000:,.1f}만'
    if u == '원': return f'{x:,.0f}원'
    return (f'{x:,.0f}' if x == int(x) else f'{x:,.2f}') + (u or '')

def metric_l(x):
    u, cur, prev, tg = x.get('u', ''), x.get('cur') or {}, x.get('prev') or {}, x.get('target')
    s = f'{cl(x.get("l"))}: {fmt_v(u, cur.get("v")) if cur else "—"}'
    if prev: s += f' ← {fmt_v(u, prev.get("v"))}'
    if tg is not None: s += f' · 목표 {fmt_v(u, tg)}'
    return s + (' ✓' if x.get('ok') else '')

def arch_ab(asks):
    rows = [a for a in asks if a.get('state') == 'ok' and (a.get('mate'), a.get('act')) in LEDGER_ACTS]
    by = {}
    for a in rows: by.setdefault(kday(a.get('okAt'))[:7], []).append(a)
    res = {}
    for ym, al in sorted(by.items()):
        out, n = [], 0
        for a in sorted(al, key=lambda x: x.get('okAt', ''), reverse=True):
            cols = [c for c in (a.get('cols') or []) if c] or sorted({k for it in a.get('items') or [] for k in (it.get('c') or {})})
            pk = {str(it.get('n')) for it in picked(a)}
            out.append(f'### {kday(a.get("okAt"))} {mate_name(a.get("mate"))} {a.get("act")} · {cl(a.get("title"), 80)}')
            out.append(' · '.join(x for x in [f'승인 {a.get("okByName") or ""}', BRANDS.get(a.get('brand'), a.get('brand') or ''), note_link(a), f'업무OS `{a["_id"]}`'] if x) + '\n')
            out.append('| 번호 | 고름 | ' + ' | '.join(cl(c) for c in cols) + ' |')
            out.append('|---|---|' + '---|' * len(cols))
            for it in a.get('items') or []:
                c = it.get('c') or {}; n += 1
                out.append(f'| {it.get("n")} | {"✓" if str(it.get("n")) in pk else ""} | ' + ' | '.join(cl(c.get(k), 160) for k in cols) + ' |')
            out.append('')
        res[ym] = put_note(f'A·B 장부/{ym}.md', f'A·B 장부 {ym}', 'A·B 판정', n,
            '사람이 최종 승인한 A/B 판정 전부(이긴 것·진 것·더 봄) — 여름 J 콘텐츠·바이럴 · 가을 J 키워드·광고 소재 · 겨울 H 구매 버튼. 이긴 것은 다음 콘텐츠·상세·메시지가 가져다 써요 ([[00 AARRR 단계 미션]])\n\n' + '\n'.join(out))
    return res

def arch_results(asks):
    by = {}
    for a in asks:
        if a.get('state') == 'ok': by.setdefault(kday(a.get('okAt'))[:7], []).append(a)
    res = {}
    for ym, al in sorted(by.items()):
        out = ['| 승인일 | AI · 할 일 | 결과 | 고른 것 | 했어요 · 안 함 | 승인 | 노트 |', '|---|---|---|---|---|---|---|']
        for a in sorted(al, key=lambda x: x.get('okAt', ''), reverse=True):
            tr = a.get('trace') or {}
            d = sum(1 for r in tr.values() if isinstance(r, dict) and r.get('done')); s = sum(1 for r in tr.values() if isinstance(r, dict) and r.get('skip'))
            its = a.get('items') or []
            out.append(f'| {kday(a.get("okAt"))} | {mate_name(a.get("mate"))} {a.get("act") or "아침 루틴"} | {cl(a.get("title"), 70)} | {len(picked(a))}/{len(its)} | {d} · {s} | {a.get("okByName") or ""} | {note_link(a)} |')
        res[ym] = put_note(f'AI 결과/{ym}.md', f'최종 승인된 AI 결과 {ym}', 'AI 결과', len(al),
            '사람이 최종 승인한 AI 크루 결과 목록 — 무엇을 했는지(실행 흔적)와 이어서 볼 노트\n\n' + '\n'.join(out))
    return res

def arch_weekly():
    res = {}
    for r in list_all(DOCS + '/pour-os/v2', 'aireports'):
        secs = {k: v for k, v in (r.get('secs') or {}).items() if isinstance(v, dict) and v.get('sent') and v.get('snap')}
        if not secs: continue
        out = [f'기간 {r.get("start")} ~ {r.get("end")} · 마감 {r.get("due") or ""} · 주기 {r.get("cycle") or ""}']
        for lid, ld in (r.get('leads') or {}).items():
            if isinstance(ld, dict) and ld.get('note'): out.append(f'- 리드 한마디 ({ld.get("byName", "")} · {kday(ld.get("at"))}): {cl(ld.get("note"))}')
        rd = r.get('read') or {}
        if isinstance(rd, dict) and rd.get('at'): out.append(f'- 본부장 읽음 ({rd.get("byName", "")} · {kday(rd.get("at"))})' + (f': {cl(rd.get("note"))}' if rd.get('note') else ''))
        for mid, s in secs.items():
            d, sent = s['snap'], s['sent'] if isinstance(s['sent'], dict) else {}
            out.append(f'\n## {cl(d.get("name") or mate_name(mid))} · {cl(d.get("role") or d.get("slot") or "")}')
            out.append(f'보낸 사람 {sent.get("byName", "")} · {kday(sent.get("at"))}' + (f' · 담당 확인 {d.get("doneBy")}' if d.get('doneBy') else ''))
            st = d.get('stage') or {}
            if st.get('vals'): out.append(f'- **단계 숫자** {cl(st.get("l"))}: ' + ' · '.join(metric_l(x) for x in st['vals']))
            tr, ak = d.get('trace') or {}, d.get('asks') or {}
            out.append(f'- **실행** 끝낸 일 {d.get("doneN", 0)} · 남은 일 {d.get("openN", 0)} · 흔적 했어요 {tr.get("done", 0)} · 안 함 {tr.get("skip", 0)} · 승인 올라옴 {ak.get("made", 0)} · 최종 {ak.get("ok", 0)} · 안 함 {ak.get("no", 0)} · 열린 것 {ak.get("open", 0)}')
            for t in (d.get('done') or [])[:20]: out.append(f'  - {t.get("day", "")} {cl(t.get("title"), 90)}')
            for x in (tr.get('links') or [])[:12]: out.append(f'  - 흔적 {x.get("n")}: {cl(x.get("link"), 160)} ({cl(x.get("title"), 50)})')
            ms = d.get('metrics') or []
            if ms: out.append('- **결과(보드 지표)**\n' + '\n'.join(f'  - {metric_l(x)}' for x in ms))
            kp = [x for x in (d.get('ak') or []) if isinstance(x, dict)]
            if kp: out.append('- **반복 실행(짝)** ' + ' · '.join(f'{cl(x.get("name"), 40)} +{x.get("n", 0)}' for x in kp))
            ib = d.get('inbox') or []
            if ib: out.append('- **넘겨받은 것** ' + ' · '.join(f'{cl(x.get("name"))} {x.get("act", "")} {cl(x.get("title"), 40)}' for x in ib))
            if d.get('note'): out.append(f'- **담당 한 줄** {cl(d.get("note"))}')
            if d.get('plan'): out.append(f'- **다음(사람)** {cl(d.get("plan"))}')
            if d.get('aiNext'): out.append(f'- **다음(AI · {d.get("aiNextRun", "")})**\n' + quote(cl_md(d.get('aiNext'))))
            fs = d.get('files') or []
            if fs: out.append('- **붙인 파일** ' + ' · '.join(cl((f or {}).get('name') or (f or {}).get('url') or '', 60) for f in fs if isinstance(f, dict)))
        cname = CREW_L.get(r.get('crew'), r.get('crew') or '')
        res[r['_id']] = put_note(f'주간 보고/{r.get("start")} {cname} 보고.md', f'{cname} 보고 {r.get("start")} ~ {r.get("end")}', 'AI 크루 보고', len(secs), '\n'.join(out))
    return res

def flat(x, depth=0, key=''):  # 월말 보고서 data — 모양이 여러 가지라 줄로 펼침 (공유 열쇠·원가 말은 뺌)
    if re.search(r'token|share|secret|cost|margin', key, re.I): return []
    pad = '  ' * depth
    if isinstance(x, dict):
        out = []
        for k, v in x.items():
            if isinstance(v, (dict, list)) and depth < 3: out += [f'{pad}- {cl(k)}'] + flat(v, depth + 1, k)
            elif not isinstance(v, (dict, list)): out.append(f'{pad}- {cl(k)}: {cl(v, 200)}')
        return out
    if isinstance(x, list):
        out = []
        for i, v in enumerate(x[:40]): out += (flat(v, depth, key) if isinstance(v, dict) and depth < 3 else [f'{pad}- {cl(v, 200)}'])
        return out + ([f'{pad}- …({len(x) - 40}개 더)'] if len(x) > 40 else [])
    return [f'{pad}- {cl(x, 200)}']

def arch_monthly():
    res = {}
    for r in list_all(DOCS + '/pour-os/v2', 'reports'):
        if r.get('status') != 'final' or not r.get('data'): continue
        data = r['data']
        if r.get('hideMoney'): data = {k: v for k, v in data.items() if not re.search(r'sales|money|amount|won|매출', k, re.I)} if isinstance(data, dict) else data
        body = (f'**요약** {cl(r.get("summary"))}\n\n' if r.get('summary') else '') + '\n'.join(flat(data))
        res[r['_id']] = put_note(f'월말 보고/{r.get("ym", "")} {cl(r.get("title") or r["_id"], 60)}.md', f'월말 보고서 · {cl(r.get("title") or r["_id"])}', '월말 보고서', 1, body)
    return res

def arch_ads():
    res, by = {}, {}
    for r in list_all(DOCS + '/pour-os/v2', 'adreports'):
        dt = r.get('date') or r['_id'][:10]
        if r.get('kind') == 'weekly' or r['_id'].endswith('-weekly'):
            res[r['_id']] = put_note(f'광고 보고/{dt} 주간.md', f'광고 주간 보고 {dt}', '광고 주간 보고', 1,
                (f'**요약** {cl(r.get("summary"))}\n\n' if r.get('summary') else '') + cl_md(r.get('md') or ''))
        else: by.setdefault(dt[:7], []).append(r)
    for ym, rl in sorted(by.items()):
        out = []
        for r in sorted(rl, key=lambda x: x.get('date') or x['_id'], reverse=True):
            out.append(f'## {r.get("date") or r["_id"]} {cl(r.get("title"), 80)}\n{cl(r.get("summary")) or "(요약 없음)"}\n')
            if r.get('md'): out.append('> [!note]- 보고서 전체\n' + quote(cl_md(r['md'])) + '\n')
        res[ym] = put_note(f'광고 보고/{ym} 일일.md', f'광고 일일 보고 {ym}', '광고 일일 보고', len(rl), '\n'.join(out))
    return res

def arch_nps(asks):
    by = {}
    for s in list_all(DOCS, 'nps-surveys'): by.setdefault(kday(s.get('createdAt'))[:7], {'s': [], 't': []})['s'].append(s)
    for a in asks:
        if (a.get('mate'), a.get('act')) not in NPS_ACTS: continue
        for n, r in (a.get('trace') or {}).items():
            if isinstance(r, dict) and (r.get('done') or r.get('skip')):
                by.setdefault((r.get('date') or kday(a.get('okAt')))[:7], {'s': [], 't': []})['t'].append((r, n, a))
    res = {}
    for ym, g in sorted(by.items()):
        out = []
        if g['t']:
            out.append('## 업무OS 유선 조사 흔적 (바람 C · 튼튼 A · [했어요]에 남긴 점수·메모)')
            for r, n, a in sorted(g['t'], key=lambda x: x[0].get('date') or ''):
                out.append(f'- {r.get("date", "")} {mate_name(a.get("mate"))} {a.get("act")} {n}번 · {"했어요" if r.get("done") else "안 함"}' + (f' · {cl(r.get("note"), 300)}' if r.get('note') else '') + (f' · {cl(r.get("link"), 120)}' if r.get('link') else ''))
            out.append('')
        camps = {}
        for s in g['s']: camps.setdefault(s.get('campaign') or s.get('surveyType') or '기타', []).append(s)
        for cp, ss in sorted(camps.items()):
            sc = [s.get('score') for s in ss if isinstance(s.get('score'), (int, float))]
            pro, det = sum(1 for x in sc if x >= 9), sum(1 for x in sc if x <= 6)
            out.append(f'## 설문 {cl(cp)} · {len(ss)}명')
            if sc: out.append(f'- NPS {round((pro - det) * 100 / len(sc))} (추천 {pro} · 중립 {len(sc) - pro - det} · 비추천 {det}) · 평균 {sum(sc) / len(sc):.1f}점')
            for lab, key in (('좋았던 점', 'goodFactors'), ('아쉬운 점', 'badFactors')):
                cnt = {}
                for s in ss:
                    for f in s.get(key) or []: cnt[f] = cnt.get(f, 0) + 1
                if cnt: out.append(f'- {lab}: ' + ' · '.join(f'{cl(k, 40)} {v}' for k, v in sorted(cnt.items(), key=lambda x: -x[1])[:10]))
            fb = [s for s in sorted(ss, key=lambda x: x.get('createdAt', '')) if str(s.get('feedback') or '').strip()]
            if fb: out.append('- 한마디 (이름·회사·전화는 안 옮김)\n' + '\n'.join(f'  - {kday(s.get("createdAt"))} {s.get("score", "")}점: {cl(s.get("feedback"), 300)}' for s in fb))
            out.append('')
        res[ym] = put_note(f'NPS/{ym}.md', f'NPS 조사 결과 {ym}', 'NPS', len(g['s']) + len(g['t']), '\n'.join(out))
    return res

def arch_voc():
    by = {}
    for v in list_all(DOCS + '/pour-os/marketing-hub', 'mkt-voc'): by.setdefault(str(v.get('date') or kday(v.get('at') or v.get('createdAt')))[:7], []).append(v)
    res = {}
    for ym, vl in sorted(by.items()):
        ty, pr = {}, {}
        for v in vl: ty[v.get('type') or '?'] = ty.get(v.get('type') or '?', 0) + 1; pr[v.get('product') or '?'] = pr.get(v.get('product') or '?', 0) + 1
        out = ['- 종류: ' + ' · '.join(f'{cl(k)} {n}' for k, n in sorted(ty.items(), key=lambda x: -x[1])),
               '- 제품: ' + ' · '.join(f'{cl(k, 40)} {n}' for k, n in sorted(pr.items(), key=lambda x: -x[1])[:10]), '',
               '| 날짜 | 제품 | 종류 | 어디서 | 내용 | 끝남 |', '|---|---|---|---|---|---|']
        for v in sorted(vl, key=lambda x: str(x.get('date') or ''), reverse=True):
            out.append(f'| {v.get("date", "")} | {cl(v.get("product"), 40)} | {cl(v.get("type"))} | {cl(v.get("source"))} | {cl(v.get("text"), 300)} | {"✓" if v.get("resolved") else ""} |')
        res[ym] = put_note(f'고객의 소리/{ym}.md', f'고객의 소리 {ym}', '고객의 소리', len(vl), '\n'.join(out))
    return res

def latest(sub, pat=r'.*'):
    d = os.path.join(VAULT, ARCH, sub)
    fs = sorted(f for f in os.listdir(d) if f.endswith('.md') and re.match(pat, f)) if os.path.isdir(d) else []
    return fs[-1][:-3] if fs else ''

def summary_note(asks, counts):
    today = kst_today(); since = (datetime.date.fromisoformat(today) - datetime.timedelta(days=28)).isoformat()
    lk = lambda sub, f: f'[[{ARCH}/{sub}/{f}|{f}]]' if f else '아직 없음'
    out = ['---', '유형: 자료', '자료: 최신 요약', f'기준일: {today}', '---', '# 00 최신 요약 — 전략 기획 전에 먼저 읽기', '',
           f'> 평일 아침 루틴이 `team_link.py archive` 로 다시 만듦 ({today}) · 숫자는 업무OS·허브 기록 그대로(지어내지 않음) · 원가·마진은 없음',
           '> AI 크루와 사람 팀원 모두: 이 요약 → [[00 AARRR 단계 미션]] → 아래 최신 자료 → 계획(03 작업 노트 · 업무OS)', '',
           '## 최신 자료', f'- A·B 장부: {lk("A·B 장부", latest("A·B 장부"))}', f'- AI 크루 주간 보고: {lk("주간 보고", latest("주간 보고"))}',
           f'- 월말 보고서: {lk("월말 보고", latest("월말 보고"))}', f'- 광고 주간 보고: {lk("광고 보고", latest("광고 보고", r".*주간"))} · 일일: {lk("광고 보고", latest("광고 보고", r".*일일"))}',
           f'- NPS: {lk("NPS", latest("NPS"))}', f'- 고객의 소리: {lk("고객의 소리", latest("고객의 소리"))}', f'- 최종 승인된 AI 결과: {lk("AI 결과", latest("AI 결과"))}',
           '- 오늘 숫자: [[05 오늘 숫자]]', '']
    wins = []
    for a in asks:
        if a.get('state') != 'ok' or (a.get('mate'), a.get('act')) not in LEDGER_ACTS or kday(a.get('okAt')) < since: continue
        for it in picked(a):
            c = it.get('c') or {}; w = c.get('이긴 것') or c.get('롱테일·이긴 것') or ''; ju = str(c.get('판정') or '')
            if w or '이김' in ju: wins.append(f'- {kday(a.get("okAt"))} {mate_name(a.get("mate"))} {a.get("act")} · {cl(c.get("실험") or c.get("단계") or c.get("바꾼 것"), 60)} → 이긴 것: {cl(w or ju, 120)}')
    out += ['## 최근 4주 이긴 소재 (A/B)', *(wins[:15] or ['- 아직 없음 — 첫 판정이 최종 승인되면 쌓여요']), '']
    wk = latest('주간 보고')
    if wk:
        txt = open(os.path.join(VAULT, ARCH, '주간 보고', wk + '.md'), encoding='utf-8').read()
        st = [x.strip() for x in txt.splitlines() if x.startswith('- **단계 숫자**')]
        out += [f'## 최근 주간 보고 단계 숫자 ({wk[:10]})', *(st or ['- 단계 숫자 칸이 아직 비어 있음']), '']
    out += ['## 쌓인 자료 수', '| 자료 | 노트 수 |', '|---|---|'] + [f'| {k} | {v} |' for k, v in counts.items()] + ['',
            '## 이 자료로 하는 일', '- 아침 루틴(여름): 주제·제목을 고르기 전에 이 요약과 A·B 장부를 읽고, 이긴 소재를 잇고 진 것은 피함',
            '- 매월 첫 평일: 지난달 자료로 `03 작업/<날짜> 월간 전략 정리.md` (AARRR 단계마다 잘 된 것 · 안 된 것 · 다음 달 할 것) → 업무OS 승인',
            '- 사람 팀원: 옵시디언에서 이 노트부터 · 결정·생각은 03 작업 노트에 남김 (자료 노트는 다음 날 다시 만들어짐)']
    p = os.path.join(VAULT, ARCH, '00 최신 요약.md'); os.makedirs(os.path.dirname(p), exist_ok=True)
    text = '\n'.join(out) + '\n'
    with open(p, 'w', encoding='utf-8') as f: f.write(text)
    return text

def archive():
    asks = list_all(DOCS + '/pour-os/v2', 'aiasks')
    parts = {'A·B 장부': arch_ab(asks), 'AI 결과': arch_results(asks), '주간 보고': arch_weekly(), '월말 보고': arch_monthly(),
             '광고 보고': arch_ads(), 'NPS': arch_nps(asks), '고객의 소리': arch_voc()}
    counts = {}
    for k, r in parts.items():
        d = os.path.join(VAULT, ARCH, k); counts[k] = len([f for f in os.listdir(d) if f.endswith('.md')]) if os.path.isdir(d) else 0
        w = sum(1 for v in r.values() if v == 'write'); kp = sum(1 for v in r.values() if v == 'keep')
        print(f'{k}: 노트 {counts[k]}' + (f' · 새로/바뀜 {w}' if w else '') + (f' · 원본이 줄어 그대로 둠 {kp}' if kp else ''))
    text = summary_note(asks, counts)
    print(f'{ARCH}/00 최신 요약.md 다시 만듦')
    if put_vault(text, kst_today()): print(f'허브에도 올림: mkt-notes/{VAULT_NOTE} → Aside 크루 지시문 \'■ 볼트 최신 요약\'')

if __name__ == '__main__':
    a = sys.argv[1:]
    br = ''
    if '--brand' in a: i = a.index('--brand'); br = a[i + 1] if i + 1 < len(a) else ''; a = a[:i] + a[i + 2:]
    if a and a[0] == 'open' and len(a) >= 4: open_link(a[1], a[2], a[3], a[4] if len(a) > 4 else None, br)
    elif a and a[0] == 'list': list_open()
    elif a and a[0] == 'feedback':
        n = next((int(x) for x in a[1:] if x.isdigit()), 14)
        feedback(n, [member(x)[0] for x in a[1:] if not x.isdigit()] or None)
    elif a and a[0] == 'backs': backs([member(x)[0] for x in a[1:]] or None)
    elif a and a[0] == 'rules': rules(a[1] if len(a) > 1 else None)
    elif a and a[0] == 'asks': asks(a[1] if len(a) > 1 else None)
    elif a and a[0] == 'numbers': numbers()
    elif a and a[0] == 'archive': archive()
    else: print(open(__file__, encoding='utf-8').read().split('import')[0])
