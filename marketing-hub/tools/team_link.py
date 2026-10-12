# AI 팀원 결과 → 업무OS '확인할 것' + 마케팅 허브 'AI 팀' 검토 대기 (Claude 루틴용)
# 사용:
#   python3 team_link.py open <팀원 id|이름> "<한 일>" "<볼트 노트 경로>" [YYYY-MM-DD]
#       예) python3 team_link.py open 포리 "블로그 원고 3" "03 작업/2026-10-12 블로그 원고 3.md"
#       → 검토 줄을 열고, 볼트에 그 노트 파일이 있으면 본문도 올림(대시보드 [보기]로 바로 읽기 · 2026-10-11 사장님)
#   python3 team_link.py list               — 열린(검토 전) 줄 보기
#   python3 team_link.py feedback [일수=14] — 사장님이 대시보드 [보기]에서 남긴 메모 (팀원이 다음 작업 전에 읽음)
#   python3 team_link.py numbers            — 오늘 숫자(판매·광고·재고·고객의 소리 · 원가 없음)를 받아 볼트 '05 오늘 숫자.md' 로 저장 (2026-10-12)
#       ← 매일 06:10 pour-construction-form GitHub Actions mkt-numbers.yml 이 대시보드와 같은 계산으로 만들어 둔 것 (옵시디언·버튼 없이 GitHub 에 쌓임)
# 쓰는 곳 (pour-app-new · 공개 규칙 pour-os/{doc=**} · 규칙 변경 없음):
#   pour-os/v2/links/{id}                      — 검토 줄 (CRM 다리와 같은 모양 · 내용 없음 · 팀원 · 한 일 · 노트 경로)
#   pour-os/marketing-hub/mkt-notes/{같은 id}   — 노트 본문(마크다운) + 사장님 메모 memo/memoAt/memoBy
#     본문 = 게시할 원고(제품 판매가만 · 원가·제조사·개인정보는 볼트 규칙상 처음부터 없음). 보안 규칙 게시 뒤에도 이 공개 자리에 둠(루틴은 로그인이 없음)
# 볼트 위치: 환경변수 MKT_VAULT → 이 파일이 볼트 tools/ 안이면 그 볼트 → /home/user/pour-marketing-vault
# ⚠️ 같은 파일 두 곳(2026-10-11 · 저장소 비공개 전환으로 루틴이 이 저장소를 못 받음): pour-construction-form/marketing-hub/tools/team_link.py · pour-marketing-vault/tools/team_link.py — 고치면 둘 다
import sys, os, json, re, urllib.request, urllib.parse, urllib.error, datetime, hashlib
KEY = 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU'
EMU = os.environ.get('FIRESTORE_EMULATOR_HOST')  # 시험(에뮬레이터)에서만 — 실제 DB 안 씀
DOCS = (f'http://{EMU}' if EMU else 'https://firestore.googleapis.com') + '/v1/projects/pour-app-new/databases/(default)/documents'
BASE = DOCS + '/pour-os/v2/links'
NOTES = DOCS + '/pour-os/marketing-hub/mkt-notes'
_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 볼트 안 tools/ 에서 돌면 그 볼트
VAULT = os.environ.get('MKT_VAULT') or (_HERE if os.path.isdir(os.path.join(_HERE, '02 팀원')) else '/home/user/pour-marketing-vault')
MAX_BODY = 800000  # Firestore 문서 1MB 한도 안
TEAM = {'haru': '하루', 'pori': '포리', 'luna': '루나', 'teo': '테오', 'noa': '노아', 'tobi': '토비', 'moka': '모카', 'leo': '레오', 'kei': '케이',
        'daon': '다온', 'sora': '소라', 'roy': '로이', 'ria': '리아', 'jay': '제이', 'eco': '에코', 'nari': '나리', 'onyu': '온유'}  # core.js TEAM 과 같게

def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    return {'stringValue': str(v)}

def dec(v):
    k, x = next(iter(v.items()))
    return x if k != 'nullValue' else None

def member(x):
    for k, n in TEAM.items():
        if x in (k, n): return k, n
    sys.exit(f'모르는 팀원: {x}')

def kst_today():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')

def now_iso():
    return datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')

def patch(url, fields, mask=None):
    q = '?key=' + KEY + (''.join('&updateMask.fieldPaths=' + urllib.parse.quote(m) for m in mask) if mask else '')
    r = urllib.request.Request(url + q, method='PATCH', data=json.dumps({'fields': {k: enc(v) for k, v in fields.items()}}).encode(),
                               headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(r).read()

def run_query(collection_parent, cid, filters):
    q = {'structuredQuery': {'from': [{'collectionId': cid}], 'where': filters}}
    r = urllib.request.Request(collection_parent + ':runQuery?key=' + KEY, method='POST', data=json.dumps(q).encode(), headers={'Content-Type': 'application/json'})
    return [x['document'] for x in json.loads(urllib.request.urlopen(r).read()) if 'document' in x]

def open_link(who, what, note, date=None):
    mid, name = member(who)
    date = date or kst_today()
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date): sys.exit('날짜는 YYYY-MM-DD')
    h = hashlib.sha1((what + '|' + note).encode()).hexdigest()[:8]
    lid = f'mkt-ai-{mid}-{date}-{h}'
    title = f'검토: {name} {what}'[:60]
    doc = {'src': 'mkt', 'kind': 'aiReview', 'member': mid, 'title': title, 'sub': note[:120], 'note': note,
           'date': date, 'time': '', 'owner': '', 'ownerOsId': '',
           'url': 'https://pour-construction-form.pages.dev/marketing-hub/#team', 'open': True,  # 업무OS → 마케팅 허브 AI 팀([보기]·검토 끝)
           'at': now_iso()}
    patch(f'{BASE}/{lid}', doc)
    print('열림:', lid, '·', title)
    p = os.path.join(VAULT, note)
    if not os.path.isfile(p):
        print('노트 파일 없음 → 본문 없이 검토 줄만:', p); return
    body = open(p, encoding='utf-8').read()
    if len(body.encode('utf-8')) > MAX_BODY: body = body.encode('utf-8')[:MAX_BODY].decode('utf-8', 'ignore') + '\n\n…(너무 길어 잘림 — 옵시디언에서 전체 보기)'
    # 사장님 메모(memo·memoAt·memoBy)는 건드리지 않게 이 칸들만 씀
    f = {'member': mid, 'title': title, 'note': note, 'date': date, 'body': body, 'at': now_iso()}
    patch(f'{NOTES}/{lid}', f, mask=list(f))
    print('본문 올림:', f'{len(body)}자 → 대시보드 [보기]')

def list_open():
    rows = run_query(DOCS + '/pour-os/v2', 'links', {'compositeFilter': {'op': 'AND', 'filters': [
        {'fieldFilter': {'field': {'fieldPath': 'src'}, 'op': 'EQUAL', 'value': enc('mkt')}},
        {'fieldFilter': {'field': {'fieldPath': 'open'}, 'op': 'EQUAL', 'value': enc(True)}}]}})
    print(f'열린 줄 {len(rows)}건')
    for d in rows:
        f = {k: dec(v) for k, v in d['fields'].items()}
        print('-', f.get('date', ''), f.get('kind', ''), f.get('title', ''), '·', f.get('sub', ''))

def feedback(days=14):
    since = (datetime.datetime.utcnow() + datetime.timedelta(hours=9) - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
    rows = run_query(DOCS + '/pour-os/marketing-hub', 'mkt-notes', {'fieldFilter': {'field': {'fieldPath': 'date'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': enc(since)}})
    rows = [{k: dec(v) for k, v in d['fields'].items()} for d in rows]
    rows = [r for r in rows if (r.get('memo') or '').strip()]
    rows.sort(key=lambda r: (r.get('date', ''), r.get('memoAt', '')))
    print(f'사장님 메모 {len(rows)}건 (최근 {days}일 · 대시보드 [보기]에서 남김)')
    for r in rows:
        print(f"\n### {r.get('date', '')} {TEAM.get(r.get('member', ''), r.get('member', ''))} · {r.get('note', '')}")
        print(f"({r.get('memoBy', '')} · {r.get('memoAt', '')})")
        print(r.get('memo', '').strip())

def numbers():
    url = NOTES + '/today-numbers?key=' + KEY
    try:
        d = json.loads(urllib.request.urlopen(url).read())
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
    if a and a[0] == 'open' and len(a) >= 4: open_link(a[1], a[2], a[3], a[4] if len(a) > 4 else None)
    elif a and a[0] == 'list': list_open()
    elif a and a[0] == 'feedback': feedback(int(a[1]) if len(a) > 1 else 14)
    elif a and a[0] == 'numbers': numbers()
    else: print(open(__file__, encoding='utf-8').read().split('import')[0])
