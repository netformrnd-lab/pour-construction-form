# AI 팀원 결과 → 업무OS '확인할 것' + 마케팅 허브 'AI 팀' 검토 대기 (Claude 루틴용)
# 사용:
#   python3 team_link.py open <팀원 id|이름> "<한 일>" "<볼트 노트 경로>" [YYYY-MM-DD]
#       예) python3 team_link.py open 포리 "블로그 원고 3" "03 작업/2026-10-12 블로그 원고 3.md"
#   python3 team_link.py list          — 열린(검토 전) 줄 보기
# 쓰는 곳: pour-app-new pour-os/v2/links/{id} (CRM 다리와 같은 모양 · 공개 규칙 pour-os/{doc=**} · 규칙 변경 없음)
#   내용(원고)·원가·개인정보는 안 보냄 — 팀원 · 한 일 · 노트 경로(링크)만. 검토 끝 = 마케팅 허브 'AI 팀' [검토 끝]
import sys, os, json, re, urllib.request, urllib.parse, datetime, hashlib
KEY = 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU'
EMU = os.environ.get('FIRESTORE_EMULATOR_HOST')  # 시험(에뮬레이터)에서만 — 실제 DB 안 씀
BASE = (f'http://{EMU}' if EMU else 'https://firestore.googleapis.com') + '/v1/projects/pour-app-new/databases/(default)/documents/pour-os/v2/links'
TEAM = {'haru': '하루', 'pori': '포리', 'luna': '루나', 'teo': '테오', 'noa': '노아', 'tobi': '토비', 'moka': '모카', 'leo': '레오', 'kei': '케이',
        'daon': '다온', 'sora': '소라', 'roy': '로이', 'ria': '리아', 'jay': '제이', 'eco': '에코', 'nari': '나리', 'onyu': '온유'}  # core.js TEAM 과 같게

def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    return {'stringValue': str(v)}

def member(x):
    for k, n in TEAM.items():
        if x in (k, n): return k, n
    sys.exit(f'모르는 팀원: {x}')

def kst_today():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')

def open_link(who, what, note, date=None):
    mid, name = member(who)
    date = date or kst_today()
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date): sys.exit('날짜는 YYYY-MM-DD')
    h = hashlib.sha1((what + '|' + note).encode()).hexdigest()[:8]
    lid = f'mkt-ai-{mid}-{date}-{h}'
    doc = {'src': 'mkt', 'kind': 'aiReview', 'member': mid, 'title': f'검토: {name} {what}'[:60], 'sub': note[:120], 'note': note,
           'date': date, 'time': '', 'owner': '', 'ownerOsId': '',
           'url': 'https://pour-construction-form.pages.dev/marketing-hub/#team', 'open': True,  # 업무OS → 마케팅 허브 AI 팀(노트 열기·검토 끝)
           'at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')}
    r = urllib.request.Request(f'{BASE}/{lid}?key={KEY}', method='PATCH', data=json.dumps({'fields': {k: enc(v) for k, v in doc.items()}}).encode(),
                               headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(r).read()
    print('열림:', lid, '·', doc['title'])

def list_open():
    q = {'structuredQuery': {'from': [{'collectionId': 'links'}], 'where': {'compositeFilter': {'op': 'AND', 'filters': [
        {'fieldFilter': {'field': {'fieldPath': 'src'}, 'op': 'EQUAL', 'value': enc('mkt')}},
        {'fieldFilter': {'field': {'fieldPath': 'open'}, 'op': 'EQUAL', 'value': enc(True)}}]}}}}
    url = BASE.rsplit('/links', 1)[0] + ':runQuery?key=' + KEY
    r = urllib.request.Request(url, method='POST', data=json.dumps(q).encode(), headers={'Content-Type': 'application/json'})
    rows = [x['document'] for x in json.loads(urllib.request.urlopen(r).read()) if 'document' in x]
    print(f'열린 줄 {len(rows)}건')
    for d in rows:
        f = {k: list(v.values())[0] for k, v in d['fields'].items()}
        print('-', f.get('date', ''), f.get('kind', ''), f.get('title', ''), '·', f.get('sub', ''))

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'open' and len(a) >= 4: open_link(a[1], a[2], a[3], a[4] if len(a) > 4 else None)
    elif a and a[0] == 'list': list_open()
    else: print(__doc__ or open(__file__, encoding='utf-8').read().split('import')[0])
