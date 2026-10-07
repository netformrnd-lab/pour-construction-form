#!/usr/bin/env python3
"""그로홈 대시보드 데이터 이사: grohome-dashboard → pour-app-new (pour-os/grohome/<컬렉션>/<문서>)

왜: grohome-dashboard 프로젝트(무료 요금제)가 하루 읽기 한도(5만 건)를 넘어 429 Quota exceeded 로 막혔다(2026-10-07).
    pour-app-new 로 데이터를 옮기고 그로홈 대시보드·가격대시보드·업무OS가 거기를 읽고 쓰게 한다.
어디로: pour-app-new 의 pour-os/{doc=**} 규칙(이미 배포됨) 아래 pour-os/grohome/<원래 컬렉션 이름>/<같은 문서 ID>.
        (pour-app-new 규칙 자동 배포가 시크릿 미등록으로 실패 중이라 새 규칙 없이 이미 열린 범위를 쓴다)
어떻게: Firestore REST(공개 웹 키 · 두 프로젝트 모두 보안 규칙상 공개 읽기/쓰기)로 문서를 그대로 옮긴다.
        필드 값은 타입 그대로(정수·시간·지도·배열·null) 전달하고, 같은 ID 에 통째로 덮어쓰므로 여러 번 돌려도 안전하다.
        원본(grohome-dashboard)은 읽기만 하고 지우지 않는다 — 언제든 되돌릴 수 있다.

사용법 (python3 -I backup/grohome-to-pour-app-new.py ...):
  copy                     전체 복사 (30개 컬렉션) 후 건수 비교
  copy --since 2026-10-07T07:00:00Z   이 시각 이후 바뀐 문서만 다시 복사 (이사 뒤 옛 화면에서 들어온 기록 줍기)
  verify                   원본·대상 건수만 비교
  옵션: --only a,b  --dry  --page 300  --batch 400
        --src-project/--src-key/--src-root  --dst-project/--dst-key/--dst-root  (시험용: 다른 원본·대상 경로)
        --limit N (컬렉션당 최대 N건 · 시험용)  --delete-dst (대상 경로의 문서를 지움 · 시험 정리용)
"""
import argparse, json, os, ssl, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

COLLECTIONS = [  # 그로홈 대시보드 src + 전체 git 기록 + ManualOrder.html + 가격대시보드에서 쓰는 이름 전부
    'consignmentPartners', 'coupangList', 'employees', 'etcTasks', 'fixedTasks', 'gbCategories', 'gbClassifications',
    'gbConfig', 'gbTasks', 'groupBuyList', 'hardwarePartners', 'influencerSchedule', 'leadingTasks', 'marketingPlatforms',
    'marketingRecords', 'monthlyTasks', 'ohouseList', 'partnerProducts', 'platformPrices', 'platforms', 'productDashboard',
    'products', 'salesDays', 'salesRecords', 'scheduleEvents', 'settings', 'trash', 'manualOrders', 'orderProducts', 'orderTypes',
]
SRC = dict(project='grohome-dashboard', key='AIzaSyBp6S2Fln8cCXBHKpREfguRfLkL2oEYZ3k', root='')
DST = dict(project='pour-app-new', key='AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU', root='pour-os/grohome')

_ctx = None
def ctx():
    global _ctx
    if _ctx is None:
        ca = '/root/.ccr/ca-bundle.crt'
        _ctx = ssl.create_default_context(cafile=ca) if os.path.exists(ca) else ssl.create_default_context()
    return _ctx

def http(method, url, body=None, tries=6):
    data = json.dumps(body).encode() if body is not None else None
    for i in range(tries):
        req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, context=ctx(), timeout=120) as r:
                return json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code == 429 and 'Quota exceeded' in msg:
                raise SystemExit(f'⛔ 하루 사용량 한도 초과(429): {url.split("?")[0]} — 한도가 풀린 뒤 다시 실행하세요')
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(2 ** i); continue
            raise SystemExit(f'⛔ HTTP {e.code} {method} {url.split("?")[0]}: {msg}')
        except urllib.error.URLError as e:
            if i < tries - 1: time.sleep(2 ** i); continue
            raise

def base(p): return f"https://firestore.googleapis.com/v1/projects/{p['project']}/databases/(default)/documents"
def colpath(p, col): return (p['root'] + '/' if p['root'] else '') + col
def q(s): return urllib.parse.quote(s, safe='/')

def list_docs(p, col, page=300, limit=None):
    tok, n = None, 0
    while True:
        u = f"{base(p)}/{q(colpath(p, col))}?pageSize={page}&key={p['key']}" + (f"&pageToken={urllib.parse.quote(tok)}" if tok else '')
        r = http('GET', u)
        for d in r.get('documents', []):
            yield d; n += 1
            if limit and n >= limit: return
        tok = r.get('nextPageToken')
        if not tok: return

def count(p, col):
    parent = f"{base(p)}/{q(p['root'])}" if p['root'] else base(p)
    body = {'structuredAggregationQuery': {'structuredQuery': {'from': [{'collectionId': col}]}, 'aggregations': [{'alias': 'n', 'count': {}}]}}
    r = http('POST', f"{parent}:runAggregationQuery?key={p['key']}", body)
    return int(r[0]['result']['aggregateFields']['n'].get('integerValue', 0))

def dst_name(d, col):
    doc_id = d['name'].rsplit('/', 1)[1]
    return f"projects/{DST['project']}/databases/(default)/documents/{colpath(DST, col)}/{doc_id}"

def commit(writes, dry):
    if dry or not writes: return
    http('POST', f"{base(DST)}:commit?key={DST['key']}", {'writes': writes})

def flush_size(w): return len(json.dumps(w, ensure_ascii=False).encode())

def ts(v):   # '2026-10-07T07:00:00.123456Z' · '2026-10-07T16:00:00+09:00' → UTC datetime (문자열 비교는 소수점 자리 때문에 틀릴 수 있다)
    v = str(v or '').strip().replace('Z', '+00:00')
    if not v: return datetime.min.replace(tzinfo=timezone.utc)
    if '.' in v:   # 마이크로초 6자리까지만
        head, rest = v.split('.', 1); frac = ''.join(ch for ch in rest if ch.isdigit()); tz = rest[len(frac):]
        v = f"{head}.{frac[:6].ljust(6, '0')}{tz}"
    d = datetime.fromisoformat(v)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)

def copy(cols, since, dry, page, batch, limit):
    total, report = 0, {}
    for col in cols:
        writes, size, n, seen = [], 0, 0, 0
        for d in list_docs(SRC, col, page, limit):
            seen += 1
            if since and ts(d.get('updateTime', '')) <= since: continue
            w = {'update': {'name': dst_name(d, col), 'fields': d.get('fields', {})}}
            ws = flush_size(w)
            if writes and (len(writes) >= batch or size + ws > 8_000_000):   # 한 번에 최대 500건 · 10MB 제한보다 작게
                commit(writes, dry); writes, size = [], 0
            writes.append(w); size += ws; n += 1
        commit(writes, dry)
        report[col] = (seen, n); total += n
        print(f"  {col:20s} 원본 {seen:6d}건 → {'(시험) ' if dry else ''}복사 {n:6d}건", flush=True)
    return total, report

def verify(cols):
    bad = 0
    for col in cols:
        s, t = count(SRC, col), count(DST, col)
        mark = '✅' if s == t else '❌'
        if s != t: bad += 1
        print(f"  {mark} {col:20s} 원본 {s:6d} · 대상 {t:6d}", flush=True)
    return bad

def delete_dst(cols, page, batch):
    for col in cols:
        names = [d['name'] for d in list_docs(DST, col, page)]
        for i in range(0, len(names), batch):
            http('POST', f"{base(DST)}:commit?key={DST['key']}", {'writes': [{'delete': x} for x in names[i:i + batch]]})
        print(f"  {col}: 대상 {len(names)}건 지움", flush=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['copy', 'verify', 'delete-dst'])
    ap.add_argument('--only'); ap.add_argument('--since'); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--page', type=int, default=300); ap.add_argument('--batch', type=int, default=400); ap.add_argument('--limit', type=int)
    for side in ('src', 'dst'):
        for k in ('project', 'key', 'root'): ap.add_argument(f'--{side}-{k}')
    a = ap.parse_args()
    for side, P in (('src', SRC), ('dst', DST)):
        for k in ('project', 'key', 'root'):
            v = getattr(a, f'{side}_{k}')
            if v is not None: P[k] = v
    if a.dst_root is None and DST['project'] == 'pour-app-new' and not DST['root'].startswith('pour-os/'):
        raise SystemExit('대상은 pour-os/ 아래여야 합니다(배포된 규칙 범위)')
    cols = a.only.split(',') if a.only else COLLECTIONS
    print(f"원본 {SRC['project']}/{SRC['root'] or '(최상위)'} → 대상 {DST['project']}/{DST['root']} · {len(cols)}개 컬렉션 · {datetime.now(timezone.utc).isoformat(timespec='seconds')}")
    if a.cmd == 'delete-dst':
        delete_dst(cols, a.page, a.batch); return
    if a.cmd == 'copy':
        t0 = time.time(); total, report = copy(cols, ts(a.since) if a.since else None, a.dry, a.page, a.batch, a.limit)
        print(f"복사 {total}건 · {time.time() - t0:.0f}초")
        if not a.dry and not a.since and not a.limit and DST['root'] == 'pour-os/grohome':   # 정식 전체 복사 기록(대상 루트 문서)
            http('PATCH', f"{base(DST)}/{q(DST['root'])}?key={DST['key']}", {'fields': {
                'migratedFrom': {'stringValue': 'grohome-dashboard'}, 'migratedAt': {'timestampValue': datetime.now(timezone.utc).isoformat()},
                'counts': {'mapValue': {'fields': {c: {'integerValue': str(v[1])} for c, v in report.items()}}},
                'note': {'stringValue': '그로홈 대시보드 데이터 이사본 — 원본 grohome-dashboard 는 지우지 않음'}}})
        if a.limit or a.since or a.dry: return
    bad = verify(cols)
    print('건수 모두 일치 ✅' if not bad else f'❌ 건수가 다른 컬렉션 {bad}개')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
