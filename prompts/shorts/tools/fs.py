# 숏폼 스튜디오 Firestore 도구 (Claude 작업용) — config/shortsStudio(목록) · config/shorts-<id>(프로젝트)
# 사용: python3 fs.py get <id> [out.json] | put <id> <in.json> | list
# 보안규칙상 config/* 는 공개 읽기·쓰기 (pour-app-new). 기존 규칙 변경 없음.
import sys, json, urllib.request, urllib.parse
KEY = 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU'
BASE = 'https://firestore.googleapis.com/v1/projects/pour-app-new/databases/(default)/documents/config/'

def enc(v):
    if v is None: return {'nullValue': None}
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, list): return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
    raise TypeError(type(v))

def dec(v):
    k, x = next(iter(v.items()))
    if k == 'nullValue': return None
    if k == 'integerValue': return int(x)
    if k in ('booleanValue', 'doubleValue', 'stringValue', 'timestampValue'): return x
    if k == 'arrayValue': return [dec(y) for y in x.get('values', [])]
    if k == 'mapValue': return {a: dec(b) for a, b in x.get('fields', {}).items()}
    return x

def req(method, doc, body=None, mask=None):
    url = BASE + doc + '?key=' + KEY
    if mask: url += ''.join('&updateMask.fieldPaths=' + urllib.parse.quote(m) for m in mask)
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r).read() or b'{}')

def get(doc):
    d = req('GET', doc); return {k: dec(v) for k, v in d.get('fields', {}).items()}

def put(pid, data):
    req('PATCH', 'shorts-' + pid, {'fields': {k: enc(v) for k, v in data.items()}})
    meta = {'name': data.get('product', {}).get('name') or data.get('name', ''), 'version': data.get('output', {}).get('version', ''),
            'archived': bool(data.get('archived')), 'updatedAt': data.get('updatedAt', '')}
    # 목록 문서는 해당 프로젝트 칸만 갱신 (다른 숏폼 유지)
    req('PATCH', 'shortsStudio', {'fields': {'projects': {'mapValue': {'fields': {pid: enc(meta)}}}}}, mask=[f'projects.`{pid}`'])

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'list': print(json.dumps(get('shortsStudio').get('projects', {}), ensure_ascii=False, indent=1))
    elif cmd == 'get':
        d = get('shorts-' + sys.argv[2])
        if len(sys.argv) > 3: json.dump(d, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
        else: print(json.dumps(d, ensure_ascii=False, indent=1))
    elif cmd == 'put': put(sys.argv[2], json.load(open(sys.argv[3], encoding='utf-8'))); print('saved', sys.argv[2])
