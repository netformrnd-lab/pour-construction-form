# AI 팀원 결과 → 업무OS 'AI 승인' (AI → 담당 → 리드 → 본부장) + 마케팅 허브 노트 보기 (Claude 루틴용)
# 사용:
#   python3 team_link.py open <팀원 id|이름> "<한 일>" "<볼트 노트 경로>" [YYYY-MM-DD] [--brand pourstore|grohome]
#       예) python3 team_link.py open 포리 "블로그 원고 3" "03 작업/2026-10-12 블로그 원고 3.md"
#       → ① 볼트에 그 노트가 있으면 본문을 마케팅 허브에 올림(대시보드 [📄 보기] · 채널 미리보기)
#         ② 업무OS 'AI 승인' 한 건(pour-os/v2/aiasks) → 담당 '확인할 것' → 리드 → 본부장 (2026-10-12 사장님)
#            같은 노트를 'AI에게 다시'로 돌려받았으면 → 새 건이 아니라 같은 건의 다음 판(2번째…)으로 고침
#   python3 team_link.py feedback [일수=14] [팀원…] — 고칠 것 (팀원이 다음 작업 전에 반드시 읽음 · 팀원을 적으면 그 팀원 것만)
#       · 업무OS 'AI에게 다시'(돌려받은 말) · 상급자가 돌려보낸 말 · 안 하기로 한 이유 · 확정 규칙(담당이 정함)
#       · 사장님이 대시보드 [보기]에서 남긴 메모 (예전 방식 그대로)
#   python3 team_link.py rules [팀원]     — 확정 규칙만 (업무OS AI 팀원 화면에서 담당이 더함)
#   python3 team_link.py asks [팀원]      — 업무OS 승인 진행 (누구 차례 · AI가 고치는 중)
#   python3 team_link.py list             — 예전 검토 줄(links aiReview · 업무OS 승인 전 방식)
#   python3 team_link.py numbers          — 오늘 숫자(판매·광고·재고·고객의 소리 · 원가 없음)를 받아 볼트 '05 오늘 숫자.md' 로 저장 (2026-10-12)
#       ← 매일 06:10 pour-construction-form GitHub Actions mkt-numbers.yml 이 대시보드와 같은 계산으로 만들어 둔 것 (옵시디언·버튼 없이 GitHub 에 쌓임)
# 쓰는 곳 (pour-app-new · 공개 규칙 pour-os/{doc=**} · 규칙 변경 없음):
#   pour-os/v2/aiasks/{id}                     — AI 승인 한 건 (모양 = pour-construction-form marketing-hub/crew.js askDoc 과 같게)
#   pour-os/marketing-hub/mkt-notes/{노트 id}  — 노트 본문(마크다운) + 사장님 메모 memo/memoAt/memoBy
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
    for k, n in TEAM.items():
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
    olds = [x for x in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', eqf('note', note))) if x.get('mate') == mid]
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
        nf = {'title': title, 'sum': '', 'note': note, 'noteId': lid, 'url': url, 'owner': owner or cur.get('owner') or '', 'to': owner or cur.get('owner') or '', 'step': 0, 'state': 'wait',
              'path': [], 'pick': None, 'ver': int(cur.get('ver') or 1) + 1, 'back': None, 'ret': None, 'updatedAt': at,
              'log': (cur.get('log') or []) + [{'at': at, 'by': 'ai:' + mid, 'byName': f'{name} (AI)', 'act': 'redo'}]}
        if commit(f'{ASKS}/{aid}', nf, {'updateTime': ut}) is None: sys.exit('그사이 업무OS에서 이 건이 바뀌었어요 — 한 번 더 실행해 주세요')
        print(f'업무OS 승인 고쳐서 다시: {aid} · {nf["ver"]}번째 판 · 차례 {owner_name or "관리자 누구나"}')
        return
    doc = {'id': aid, 'crew': 'base', 'mate': mid, 'mateName': name, 'brand': brand, 'board': '', 'act': '', 'run': date, 'title': title, 'sum': '', 'body': '', 'cols': [], 'items': [],
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

def mates_rules(only=None):
    out = {}
    for d in fdocs(run_query(DOCS + '/pour-os/v2', 'aimates', None)):
        mid = d.get('id') or d['_id']
        if only and mid != only: continue
        r = [x for x in (d.get('rules') or []) if not x.get('off')]
        if r: out[mid] = r
    return out

def rules(who=None):
    mid = member(who)[0] if who else None
    rs = mates_rules(mid)
    print(f'확정 규칙 (업무OS AI 팀원 화면 · 담당이 더함){" · " + TEAM.get(mid, mid) if mid else ""}')
    if not rs: print('없음'); return
    for m, r in rs.items():
        print(f'\n## {TEAM.get(m, m)}')
        for x in r: print(f'- {x.get("text", "")} ({x.get("byName", "")} · {str(x.get("at", ""))[:10]})')

def asks(who=None):
    mid = member(who)[0] if who else None
    rows = fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', {'fieldFilter': {'field': {'fieldPath': 'state'}, 'op': 'IN', 'value': enc(['wait', 'back'])}}))
    rows = [x for x in rows if (not mid or x.get('mate') == mid)]
    rows.sort(key=lambda x: (x.get('state', ''), x.get('run', '')))
    print(f'업무OS AI 승인 진행 {len(rows)}건')
    for x in rows: print('-', x.get('run', ''), STATE_L.get(x.get('state'), x.get('state')), f"{x.get('step', 0) + 1}단계" if x.get('state') == 'wait' else '', x.get('title', ''), '·', x['_id'])

def feedback(days=14, who=None):
    since = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9) - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
    mine = lambda a: (a.get('crew') or 'base') == 'base' and (not who or a.get('mate') in who)  # 크루(Aside 보드) 건은 crew.html 에서 다시
    if who: print('팀원: ' + ' · '.join(TEAM[m] for m in who))
    # 업무OS: AI 에게 다시(지금 고칠 것) · 돌려보낸 말 · 안 함 이유 (최근 일수)
    back = [a for a in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', eqf('state', 'back'))) if mine(a)]
    print(f'■ 고쳐서 다시 올릴 것 {len(back)}건 (업무OS AI에게 다시 · 같은 노트 경로로 고쳐 저장 → open 다시 = 다음 판)')
    for a in sorted(back, key=lambda x: x.get('run', '')):
        b = a.get('back') or {}
        print(f"\n### {a.get('run', '')} {a.get('mateName', TEAM.get(a.get('mate'), ''))} · {a.get('title', '')}\n노트: {a.get('note', '')}\n({b.get('byName', '')} · {str(b.get('at', ''))[:16]})\n{b.get('text', '')}")
    recent = [x for x in fdocs(run_query(DOCS + '/pour-os/v2', 'aiasks', {'fieldFilter': {'field': {'fieldPath': 'updatedAt'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': enc(since)}})) if mine(x)]
    notes = []
    for a in recent:
        for l in a.get('log') or []:
            if l.get('act') in ('ret', 'no') and l.get('text') and str(l.get('at', '')) >= since: notes.append((str(l.get('at', '')), a, l))
    notes.sort(key=lambda x: x[0])
    print(f'\n■ 상급자가 돌려보낸 말 · 안 하기로 한 이유 {len(notes)}건 (최근 {days}일 · 같은 실수 반복 금지)')
    for at, a, l in notes:
        print(f"- {at[:10]} {a.get('mateName', '')} · {a.get('title', '')} — {'돌려보냄' if l.get('act') == 'ret' else '안 함'}: {l.get('text', '')} ({l.get('byName', '')})")
    rs = {m: r for m, r in mates_rules().items() if m in TEAM and (not who or m in who)}
    print(f'\n■ 확정 규칙 {sum(len(v) for v in rs.values())}개 (업무OS AI 팀원 화면 · 꼭 지킴)')
    for m, r in rs.items():
        for x in r: print(f'- {TEAM.get(m, m)}: {x.get("text", "")}')
    # 사장님 대시보드 메모 (예전 방식 그대로)
    rows = run_query(DOCS + '/pour-os/marketing-hub', 'mkt-notes', {'fieldFilter': {'field': {'fieldPath': 'date'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': enc(since)}})
    rows = [{k: dec(v) for k, v in d['fields'].items()} for d in rows]
    rows = [r for r in rows if (r.get('memo') or '').strip() and (not who or r.get('member') in who)]
    rows.sort(key=lambda r: (r.get('date', ''), str(r.get('memoAt', ''))))
    print(f'\n■ 사장님 메모 {len(rows)}건 (최근 {days}일 · 대시보드 [보기]에서 남김)')
    for r in rows:
        print(f"\n### {r.get('date', '')} {TEAM.get(r.get('member', ''), r.get('member', ''))} · {r.get('note', '')}")
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

if __name__ == '__main__':
    a = sys.argv[1:]
    br = ''
    if '--brand' in a: i = a.index('--brand'); br = a[i + 1] if i + 1 < len(a) else ''; a = a[:i] + a[i + 2:]
    if a and a[0] == 'open' and len(a) >= 4: open_link(a[1], a[2], a[3], a[4] if len(a) > 4 else None, br)
    elif a and a[0] == 'list': list_open()
    elif a and a[0] == 'feedback':
        n = next((int(x) for x in a[1:] if x.isdigit()), 14)
        feedback(n, [member(x)[0] for x in a[1:] if not x.isdigit()] or None)
    elif a and a[0] == 'rules': rules(a[1] if len(a) > 1 else None)
    elif a and a[0] == 'asks': asks(a[1] if len(a) > 1 else None)
    elif a and a[0] == 'numbers': numbers()
    else: print(open(__file__, encoding='utf-8').read().split('import')[0])
