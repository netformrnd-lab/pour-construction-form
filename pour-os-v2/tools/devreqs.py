#!/usr/bin/env python3
# 업무OS 개발 수정 요청 포스트잇 — 개발(Claude)이 읽고 반영 표시 (2026-10-16 사장님 "업무os 개발 수정 요청하는곳 만들어줘")
#   + 월 1회 자동 개발 (2026-10-17 사장님 확정 5A~9A "1개월에 한번씩 포스팃 확인해서 자동으로 주말에 알아서 개발 · 단, 김송희에게 리스트업 알려줘서 확인받고")
#   저장 = pour-app-new · pour-os/v2/devreqs/{id} {id, text, files[{name,url,…}], by, byName, at, app 'team'|'admin', state 'open'|'done'|'no', doneAt, doneBy, doneByName, reply,
#          noReason·noAt·noBy·noByName, planYm·planPick, removed?}
#          pour-os/v2/devplans/{YYYY-MM} {ym, monday, due, devDays, items[{id, text, byName, pick 'now'|'later'|'no', note}], state 'ok', confirmedBy·ByName·At, devStartedAt, devLater{id: 까닭}, devDone{at, summary, done[], later[]}}
#   화면 = 팀 앱 더보기 › 개발 수정 요청 · 관리자 머리 [수정 요청] · 설정 첫 줄 (src/devreq.jsx · 이달 개발 목록 = DevPlanSheet · 계산 src/devplan.js)
#   python3 pour-os-v2/tools/devreqs.py list          열린 요청 (최근 순 · 사진 주소 같이)
#   python3 pour-os-v2/tools/devreqs.py list all      모두 (뗀 것 빼고)
#   python3 pour-os-v2/tools/devreqs.py done <id> "<답 한 줄>"   반영함 + 답 (업무OS 를 고쳐 머지한 뒤 · 화면에 '반영함 ✓ · 답 …' · 쓴 사람 '확인할 것')
#   ── 월 1회 자동 개발 (주말 예약 작업 세션이 씀) ──
#   python3 pour-os-v2/tools/devreqs.py today         오늘(한국)이 개발 날인가 → 끝 줄 'DEV_DAY yes|no' (yes = 확인한 계획 · 토·일 · 아직 안 끝남)
#   python3 pour-os-v2/tools/devreqs.py plan [YYYY-MM]   이달 계획 (확인한 사람 · 이번에/다음 달/안 함 · 한 줄 · 포스트잇 글·사진 주소)
#   python3 pour-os-v2/tools/devreqs.py start <YYYY-MM>  개발 시작 표시 (화면 '개발 중' · 그 뒤로는 다시 확인 못 함)
#   python3 pour-os-v2/tools/devreqs.py later <id> "<까닭>"   이번 주말엔 안 함 (흐름을 바꾸는 큰 것 → 정리표로 사장님께) · 포스트잇은 열린 채 다음 달 목록에
#   python3 pour-os-v2/tools/devreqs.py plan-done <YYYY-MM> "<요약>"   끝 표시 (반영함 = 그 계획 '이번에' 중 done 인 것 · 다음 달 = later) → 확인한 사람·관리자 '확인할 것'
#   읽기·쓰기는 웹 공개 키 REST (marketing-hub/tools/team_link.py 와 같은 길 · 비밀 없음) · 지우지 않음
import sys, os, datetime
sys.dont_write_bytecode = True   # team_link 을 불러도 __pycache__ 를 안 건드림
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'marketing-hub', 'tools'))
import team_link as T

V2 = T.DOCS + '/pour-os/v2'
PICK_L = {'now': '이번에', 'later': '다음 달', 'no': '안 함'}

def rows(all_=False):
    xs = [x for x in T.fdocs(T.run_query(V2, 'devreqs', None)) if not x.get('removed')]
    if not all_: xs = [x for x in xs if (x.get('state') or 'open') == 'open']
    return sorted(xs, key=lambda x: x.get('at') or '', reverse=True)

def show(all_=False):
    xs = rows(all_)
    print(f'개발 수정 요청 {"모두" if all_ else "열린 것"} {len(xs)}건')
    for x in xs:
        st = {'done': '반영함', 'no': '안 함'}.get(x.get('state'), '열림')
        tag = f" · {x.get('planYm')} {PICK_L.get(x.get('planPick'), '')}" if x.get('planYm') else ''
        print(f"\n■ {x.get('_id')} · {st}{tag} · {x.get('byName', '')} · {(x.get('at') or '')[:16].replace('T', ' ')} · {'관리자 화면' if x.get('app') == 'admin' else '팀 앱'}")
        print('  ' + str(x.get('text') or '').replace('\n', '\n  '))
        for f in x.get('files') or []: print(f"  사진 · {f.get('name', '')} · {f.get('url', '')}")
        if x.get('reply'): print(f"  답 · {x['reply']}")
        if x.get('noReason'): print(f"  안 함 까닭 · {x['noReason']}")

def done(rid, reply):
    url = f'{V2}/devreqs/{rid}'
    cur, _ = T.get(url)
    if not cur: sys.exit(f'없는 요청이에요: {rid}')
    at = T.now_iso()
    T.patch(url, {'state': 'done', 'doneAt': at, 'doneBy': 'claude', 'doneByName': 'Claude(개발)', 'reply': str(reply or '').strip()[:500], 'updatedAt': at},
            mask=['state', 'doneAt', 'doneBy', 'doneByName', 'reply', 'updatedAt'])
    print(f'반영함으로 바꿨어요 · {rid}')

# ── 월 1회 자동 개발 · 날짜 = 한국 (src/devplan.js 와 같은 계산) ──
def kst_now(): return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)
def last_monday(ym):
    y, m = map(int, ym.split('-'))
    d = (datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1))
    while d.weekday() != 0: d -= datetime.timedelta(days=1)
    return d
def window(ym):
    mo = last_monday(ym)
    return {'ym': ym, 'monday': mo, 'due': mo + datetime.timedelta(days=4), 'dev': [mo + datetime.timedelta(days=5), mo + datetime.timedelta(days=6)]}
def prev_ym(ym): y, m = map(int, ym.split('-')); return f'{y - 1}-12' if m == 1 else f'{y}-{m - 1:02d}'
def plan_now(now=None):
    # 이번 달·지난달 중 '목록(월 09:00) ~ 개발 마지막 날(일)' 안 → 그 달 · 아니면 이번 달 (devplan.planNow)
    now = now or kst_now(); key, hm, ym = now.date(), now.strftime('%H:%M'), now.strftime('%Y-%m')
    for y in (ym, prev_ym(ym)):
        w = window(y)
        if (key > w['monday'] or (key == w['monday'] and hm >= '09:00')) and key <= w['dev'][1]: return w, True
    return window(ym), False
def plan_doc(ym):
    d, ut = T.get(f'{V2}/devplans/{ym}')
    return d, ut

def today():
    now = kst_now(); w, open_ = plan_now(now); d, _ = plan_doc(w['ym']); key = now.date()
    dd = lambda x: f'{x.month}/{x.day}'
    print(f"오늘(한국) {key} {now.strftime('%H:%M')} · {w['ym']} 계획 · 목록 {dd(w['monday'])}(월) · 확인 마감 {dd(w['due'])}(금) · 개발 {dd(w['dev'][0])}~{dd(w['dev'][1])}")
    is_dev = key in w['dev']
    if not is_dev: print('개발 날(그 주 토·일)이 아니에요 — 아무것도 하지 않아요'); print('DEV_DAY no'); return 3
    if not d or d.get('state') != 'ok': print('금요일까지 확인이 없었어요 — 이번 달 개발은 쉬어요 (포스트잇은 다음 달 목록에 그대로)'); print('DEV_DAY no'); return 3
    if (d.get('devDone') or {}).get('at'): print(f"이미 끝났어요 · {d['devDone']['at'][:16]} · {d['devDone'].get('summary', '')}"); print('DEV_DAY no'); return 3
    now_n = sum(1 for x in d.get('items') or [] if x.get('pick') == 'now')
    print(f"확인함 · {d.get('confirmedByName', '')} {str(d.get('confirmedAt', ''))[:10]} · 이번에 {now_n}개{' · 개발 시작함 ' + str(d.get('devStartedAt'))[:16] if d.get('devStartedAt') else ''}")
    print('DEV_DAY yes'); return 0

def plan(ym=None):
    if not ym: ym = plan_now()[0]['ym']
    w = window(ym); d, _ = plan_doc(ym)
    reqs = {x.get('id') or x.get('_id'): x for x in T.fdocs(T.run_query(V2, 'devreqs', None))}
    print(f"{ym} 개발 목록 · 목록 {w['monday']} · 확인 마감 {w['due']} · 개발 {w['dev'][0]}~{w['dev'][1]}")
    if not d:
        op = [x for x in reqs.values() if not x.get('removed') and (x.get('state') or 'open') == 'open']
        print(f'아직 확인 전 — 개발하지 않아요 · 열린 포스트잇 {len(op)}개'); return
    print(f"확인함 · {d.get('confirmedByName', '')} · {str(d.get('confirmedAt', ''))[:16]}" + (f" · 개발 시작 {str(d['devStartedAt'])[:16]}" if d.get('devStartedAt') else '') + (f" · 끝 {str(d['devDone'].get('at'))[:16]}" if (d.get('devDone') or {}).get('at') else ''))
    later = d.get('devLater') or {}
    for k in ('now', 'later', 'no'):
        xs = [x for x in d.get('items') or [] if x.get('pick') == k]
        print(f"\n■ {PICK_L[k]} {len(xs)}개" + (" — 이번 주말에 할 것 (화면·버튼·문구·버그만 · 흐름을 바꾸는 큰 것은 later + 정리표로 사장님께 · 로그인·보안 규칙·실데이터 일괄 변경은 하지 않음)" if k == 'now' else ''))
        for x in xs:
            r = reqs.get(x.get('id')) or {}
            st = {'done': '반영함 ✓', 'no': '안 함'}.get(r.get('state'), '열림')
            print(f"- {x.get('id')} · {st}{' · 이번엔 못 함: ' + later[x['id']] if x.get('id') in later else ''} · {x.get('byName', '')}{' · 한 줄: ' + x['note'] if x.get('note') else ''}")
            print('    ' + str(r.get('text') or x.get('text') or '').replace('\n', '\n    '))
            for f in r.get('files') or []: print(f"    사진 · {f.get('name', '')} · {f.get('url', '')}")

def start(ym):
    url = f'{V2}/devplans/{ym}'; d, ut = T.get(url)
    if not d or d.get('state') != 'ok': sys.exit(f'{ym} 확인한 계획이 없어요 — 개발하지 않아요')
    if d.get('devStartedAt'): print(f"이미 시작했어요 · {d['devStartedAt']}"); return
    at = T.now_iso()
    if T.commit(url, {'devStartedAt': at, 'updatedAt': at}, {'updateTime': ut}) is None: sys.exit('그사이 계획이 바뀌었어요 · plan 으로 다시 보고 start')
    print(f'{ym} 개발 시작 · 화면에 \'개발 중\' (이제 다시 확인은 못 해요)')

def later(rid, why):
    w, _ = plan_now(); ym = w['ym']; url = f'{V2}/devplans/{ym}'; d, ut = T.get(url)
    if not d or d.get('state') != 'ok': sys.exit(f'{ym} 확인한 계획이 없어요')
    if rid not in [x.get('id') for x in d.get('items') or []]: sys.exit(f'{ym} 계획에 없는 포스트잇이에요: {rid}')
    why = str(why or '').strip()[:200] or '이번 주말엔 못 함'
    T.patch(url, {'devLater': {rid: why}, 'updatedAt': T.now_iso()}, mask=[f'devLater.{rid}', 'updatedAt'])
    print(f'다음 달로 · {rid} · {why} (포스트잇은 열린 채 다음 달 목록에)')

def plan_done(ym, summary):
    url = f'{V2}/devplans/{ym}'; d, ut = T.get(url)
    if not d or d.get('state') != 'ok': sys.exit(f'{ym} 확인한 계획이 없어요')
    reqs = {x.get('id') or x.get('_id'): x for x in T.fdocs(T.run_query(V2, 'devreqs', None))}
    now_ids = [x.get('id') for x in d.get('items') or [] if x.get('pick') == 'now']
    done_ids = [i for i in now_ids if (reqs.get(i) or {}).get('state') == 'done']
    lat = d.get('devLater') or {}
    left = [i for i in now_ids if i not in done_ids and i not in lat]
    if left: print(f'⚠️ 반영함도 later 도 아닌 것 {len(left)}개: {" ".join(left)} — done 이나 later 로 먼저 정리해 주세요'); sys.exit(2)
    at = T.now_iso()
    dd = {'at': at, 'summary': str(summary or '').strip()[:1500], 'done': done_ids, 'later': [{'id': k, 'why': v} for k, v in lat.items()]}
    if T.commit(url, {'devDone': dd, 'updatedAt': at}, {'updateTime': ut}) is None: sys.exit('그사이 계획이 바뀌었어요 · plan 으로 다시 보고 plan-done')
    print(f'{ym} 개발 끝 표시 · 반영 {len(done_ids)}개 · 다음 달 {len(lat)}개 → 확인한 사람·관리자 \'확인할 것\'')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'list': show(len(a) > 1 and a[1] == 'all')
    elif a[0] == 'done' and len(a) >= 3: done(a[1], ' '.join(a[2:]))
    elif a[0] == 'today': sys.exit(today())
    elif a[0] == 'plan': plan(a[1] if len(a) > 1 else None)
    elif a[0] == 'start' and len(a) >= 2: start(a[1])
    elif a[0] == 'later' and len(a) >= 3: later(a[1], ' '.join(a[2:]))
    elif a[0] == 'plan-done' and len(a) >= 3: plan_done(a[1], ' '.join(a[2:]))
    else: print('list [all] | done <id> "<답>" | today | plan [YYYY-MM] | start <YYYY-MM> | later <id> "<까닭>" | plan-done <YYYY-MM> "<요약>"')
