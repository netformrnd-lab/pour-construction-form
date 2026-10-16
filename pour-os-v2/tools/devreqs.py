#!/usr/bin/env python3
# 업무OS 개발 수정 요청 포스트잇 — 개발(Claude)이 읽고 반영 표시 (2026-10-16 사장님 "업무os 개발 수정 요청하는곳 만들어줘")
#   저장 = pour-app-new · pour-os/v2/devreqs/{id} {id, text, files[{name,url,…}], by, byName, at, app 'team'|'admin', state 'open'|'done', doneAt, doneBy, doneByName, reply, removed?}
#   화면 = 팀 앱 더보기 › 개발 수정 요청 · 관리자 머리 [수정 요청] · 설정 첫 줄 (src/devreq.jsx)
#   python3 pour-os-v2/tools/devreqs.py list          열린 요청 (최근 순 · 사진 주소 같이)
#   python3 pour-os-v2/tools/devreqs.py list all      모두 (뗀 것 빼고)
#   python3 pour-os-v2/tools/devreqs.py done <id> "<답 한 줄>"   반영함 + 답 (업무OS 를 고쳐 머지한 뒤 · 화면에 '반영함 ✓ · 답 …')
#   읽기·쓰기는 웹 공개 키 REST (marketing-hub/tools/team_link.py 와 같은 길 · 비밀 없음) · 지우지 않음
import sys, os
sys.dont_write_bytecode = True   # team_link 을 불러도 __pycache__ 를 안 건드림
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'marketing-hub', 'tools'))
import team_link as T

V2 = T.DOCS + '/pour-os/v2'

def rows(all_=False):
    xs = [x for x in T.fdocs(T.run_query(V2, 'devreqs', None)) if not x.get('removed')]
    if not all_: xs = [x for x in xs if x.get('state') != 'done']
    return sorted(xs, key=lambda x: x.get('at') or '', reverse=True)

def show(all_=False):
    xs = rows(all_)
    print(f'개발 수정 요청 {"모두" if all_ else "열린 것"} {len(xs)}건')
    for x in xs:
        st = '반영함' if x.get('state') == 'done' else '열림'
        print(f"\n■ {x.get('_id')} · {st} · {x.get('byName', '')} · {(x.get('at') or '')[:16].replace('T', ' ')} · {'관리자 화면' if x.get('app') == 'admin' else '팀 앱'}")
        print('  ' + str(x.get('text') or '').replace('\n', '\n  '))
        for f in x.get('files') or []: print(f"  사진 · {f.get('name', '')} · {f.get('url', '')}")
        if x.get('reply'): print(f"  답 · {x['reply']}")

def done(rid, reply):
    url = f'{V2}/devreqs/{rid}'
    cur, _ = T.get(url)
    if not cur: sys.exit(f'없는 요청이에요: {rid}')
    at = T.now_iso()
    T.patch(url, {'state': 'done', 'doneAt': at, 'doneBy': 'claude', 'doneByName': 'Claude(개발)', 'reply': str(reply or '').strip()[:500], 'updatedAt': at},
            mask=['state', 'doneAt', 'doneBy', 'doneByName', 'reply', 'updatedAt'])
    print(f'반영함으로 바꿨어요 · {rid}')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'list': show(len(a) > 1 and a[1] == 'all')
    elif a[0] == 'done' and len(a) >= 3: done(a[1], ' '.join(a[2:]))
    else: print(__doc__ or 'list | list all | done <id> "<답>"')
