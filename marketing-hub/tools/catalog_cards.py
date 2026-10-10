# 모카(제품마스터) — 마진 대시보드 [📋 제품 목록 복사 (원가 없음)] 붙여넣은 표 → 옵시디언 제품 카드 (Claude 작업용)
# 사용: python3 catalog_cards.py <붙여넣은.tsv> <볼트 폴더> [YYYY-MM-DD]
#   · 제품 1개 = 자체상품코드 앞부분(PS-001-01 → PS-001 · GH-P005-03244 → GH-P005)이 같은 줄 묶음 = 카드 1장
#   · 카드: 01 제품마스터/<POUR스토어|그로홈>/<묶음코드> <제품명>.md
#   · 다시 실행하면 속성(가격·옵션 등 자동 칸)과 '모카 자동' 칸만 바꾸고, 사람이 쓴 나머지(소개·특장점·키워드…)는 그대로
#   · 표에 없어진 카드는 지우지 않음(알림만)
# 원가·이익·마진·제조사(가칭 포함)는 원본 표에 없음 — 6가지 칸(분류·상품명·옵션·자체상품코드·브랜드·채널별 판매가)만 씀 (2026-10-09 사장님)
# '회사 자료' 칸은 pour-construction-form CLAUDE.md PART 2(공인시험·시방서)에 있는 것만 — 숫자 지어내지 않음
import sys, os, re, json, datetime

AUTO_KEYS = ['유형', '제품코드', '자체상품코드', '카테고리', '브랜드', '채널', '판매가', '정가범위', '옵션', '옵션수', '원본', '가격갱신일']
BEGIN, END = '<!-- 모카 자동: 시작 (다시 붙여넣으면 이 칸만 바뀜) -->', '<!-- 모카 자동: 끝 -->'
BRAND_DIR = {'POUR스토어': 'POUR스토어', 'GROHOME': '그로홈'}
TONE = {  # CLAUDE.md PART 1-A 브랜드별 피해야 할 문장
    'POUR스토어': '투자자 대상 기업 언어 · 과도한 기술 스펙 나열 · 근거 없는 보증 기간 · 견적 금액 단정',
    'GROHOME': '기술 권위 강조 · B2B 발주 언어 · 과도한 스펙 설명 · 효능 단정',
}
H = 'https://www.poursolution.net'
# 회사 자료(CLAUDE.md PART 2)로 확인된 내용 — 묶음코드 → (제목, [내용], 시방서·사례)
COAT = ('POUR코트재 — 공인시험(KTR/KCL) · 어느 규격으로 시험했는지 확인 필요',
        ['인장강도 5.8 N/mm² (KS 기준 대비 4배)', '중성화 깊이 0.3mm', '염화물 이온 침투 저항성 172 Coulombs', '일사반사율 91.8%', '부착강도 0.7 N/mm²',
         '기능: 철근 부식 방지 · 콘크리트 중성화 방지 · 방수 · 단열·차열 · 친환경 무취'], '')
HOOK = ('POUR HOOKER (특허 기술)', ['후레싱 탈락 방지 보강', '손상된 미장 마감면을 고려한 저비용 고효율 보강'], f'시방서 {H}/148')
BIND = ('균열보수·재도장 바인더+플러스(고급형) 공법 기준', ['신장률 519% (수성 1급 대비 5배)', '중성화 깊이 0.0 mm'], f'시방서 {H}/139 · 사례 {H}/98')
TRAP = ('옥상배관방수트랩', ['대상: 옥상 배관 주변 누수'], f'시방서 {H}/149')
CRACK = ('복합시트 균열보수', ['대상: 균열 보수'], f'시방서 {H}/145')
SHINGLE = ('아스팔트슁글 방수공법', ['대상: 슁글 지붕 누수 · 강풍 탈락 · 낙하 위험', '방수콘크리트 함침으로 슁글을 바탕면과 일체화 + POUR HOOKER 로 후레싱 고정'], f'시방서 {H}/128 · 사례 {H}/110')
SPEC = {
    'PS-001': COAT, 'PS-002': COAT,
    'PS-024': ('POUR슈퍼복합압축시트 (니들펀칭)', ['인장강도 11.4 N/mm² (타사 대비 10배)', '니들 펀칭으로 섬유 사이 공간 → 도막 방수재와 강하게 붙음', '찢김 저항 우수 · 재료분리 방지'], f'시방서 {H}/145'),
    'PS-010': ('POUR하이퍼티 — 공인시험(SGS)', ['신장률 608% (KS 기준 대비 2배)', '인장강도 1.53 MPa', '부착강도 1.5 MPa', '600%급 초고신율 고탄성 퍼티 — 미세 균열·구조 변형에 유연'], ''),
    'PS-034': ('POUR탄성강화파우더 — 공인시험(KTR)', ['부착강도 1.5 N/mm² (습윤 조건)', '인장강도 2.1 N/mm²', '내충격성 2.3m 낙하 이상 없음', '마이크로 스틸 보강재 혼입 → 철근 역할'], f'시방서 {H}/143 (바탕면) · {H}/144 (단면복구)'),
    'PS-044': ('POUR페이퍼팬벤트', ['콘크리트 속 습기를 전기 없이 밖으로 내보냄', '결로 방지 · 방수층 들뜸 방지'], f'시방서 {H}/146'),
    'PS-036': HOOK, 'PS-037': HOOK,
    'PS-012': ('에폭시 도장공법 기준 — 공인시험(KTR) · 공법 전체 값', ['압축강도 85.9 N/mm²', '부착강도 2.3 MPa', '내마모성 76 mg', '대상: 지하주차장 바닥 열화·박리, 소음, 마모'], f'시방서 {H}/125 · 사례 {H}/96'),
    'PS-013': ('우레탄방수공법 기준 — 공인시험(KTR)', ['하도 부착강도 1.4 N/mm² (KS 기준 2배)', '중도 신장률 1,103%', '인열강도 15.7 N/mm'], f'시방서 {H}/124'),
    'PS-016': ('엠보라이닝 도장공법', ['써밋비드 분산 엠보라이닝 → 스크래치·반복하중·회전구간에 강함'], f'시방서 {H}/195 · 사례 {H}/96'),
    'PS-023': ('MMA공법', ['고강도 바닥 마감 · 논슬립 — 미끄럼저항 83 BPN'], f'시방서 {H}/197'),
    'PS-005': ('아크릴배면차수공법', ['탄성·인장강도 높은 2액형 아크릴계 방수재를 초고압 주입 → 새 방수층', '대상: 지하·수조 배면 누수, 지하주차장 복합 누수'], f'시방서 {H}/137'),
    'PS-027': ('PVC방수공법', ['대상: 지하 누수, 옥상 슬라브 복합 누수'], f'시방서 {H}/136'),
    'PS-004': BIND, 'PS-011': BIND,
    'PS-040': TRAP, 'PS-S001': TRAP,
    'PS-S005': ('슬라브 듀얼강화방수공법', ['대상: 아파트 옥상 슬라브 누수, 콘크리트 중성화, 드레인 주변 누수'], f'시방서 {H}/132 · 사례 {H}/111'),
    'PS-S006': SHINGLE, 'PS-S007': SHINGLE,
    'PS-S008': ('금속기와 방수공법', ['대상: 금속기와 지붕 누수, 맞물림 풀림(기와 추락 위험), 강판 부식'], f'시방서 {H}/130 · 사례 {H}/127'),
    'PS-S009': ('금속기와·칼라강판 코팅공법 — 공인시험(KTR/KCL)', ['인장강도 5.8 N/mm² (KS 4배)', '일사반사율 91.8%'], f'시방서 {H}/138 · 사례 {H}/127'),
    'PS-S011': CRACK, 'PS-028': CRACK, 'PS-029': CRACK,
}


def won(v):
    return f'{v:,}' if isinstance(v, int) else ''


def num(s):
    s = (s or '').replace(',', '').strip()
    return int(s) if re.fullmatch(r'\d+', s) else None


def family(code, name):
    if code and code.count('-') >= 2: return code.rsplit('-', 1)[0]
    return code or '코드없음'


def base_name(names):
    ns = [re.sub(r'^\[[^\]]*\]\s*', '', n) for n in names]
    p = os.path.commonprefix(ns)
    if p.count('(') > p.count(')'): p = p[:p.rfind('(')]
    if p.count('[') > p.count(']'): p = p[:p.rfind('[')]
    p = p.rstrip(' ([_-·/')
    return p if len(p) >= 2 else ns[0]


def safe(s):
    return re.sub(r'[\\/:*?"<>|\[\]#^]', ' ', s).replace('  ', ' ').strip()


def ystr(v):
    return json.dumps(v, ensure_ascii=False)


def parse(tsv):
    lines = [l for l in tsv.replace('\r', '').split('\n') if l.strip()]
    head = lines[0].split('\t')
    fixed = ['분류', '상품명', '옵션', '자체상품코드', '브랜드']
    assert head[:5] == fixed, f'첫 줄이 다름: {head[:5]}'
    chans, seen = [], {}
    for h in head[5:]:
        seen[h] = seen.get(h, 0) + 1
        chans.append(h if seen[h] == 1 else f'{h}({seen[h]})')
    rows = []
    for l in lines[1:]:
        c = (l.split('\t') + [''] * len(head))[:len(head)]
        rows.append({'cat': c[0].strip(), 'name': c[1].strip(), 'opt': c[2].strip(), 'code': c[3].strip(), 'brand': c[4].strip(),
                     'prices': {ch: num(v) for ch, v in zip(chans, c[5:])}})
    return chans, rows


def build(chans, rows, today):
    fams = {}
    for r in rows:
        k = family(r['code'], r['name']) if r['code'] else '코드없음 ' + r['name']
        fams.setdefault((r['brand'], k), []).append(r)
    cards = []
    for (brand, k), rs in fams.items():
        name = base_name([r['name'] for r in rs])
        same = len({r['name'] for r in rs}) == 1
        used = [ch for ch in chans if any(r['prices'].get(ch) is not None for r in rs)]
        lists = [r['prices'].get('정가') for r in rs if r['prices'].get('정가') is not None]
        opts = [r['opt'] if same else f"{r['name']} · {r['opt']}" for r in rs]
        cats = list(dict.fromkeys(r['cat'] for r in rs))
        bdir = BRAND_DIR.get(brand, brand or '기타')
        props = {
            '유형': '제품', '제품코드': k if not k.startswith('코드없음') else '',
            '자체상품코드': ystr([r['code'] for r in rs if r['code']]), '카테고리': ' · '.join(cats), '브랜드': brand, '채널': bdir,
            '판매가': str(min(lists)) if lists else '', '정가범위': (f'{won(min(lists))}~{won(max(lists))}' if lists and min(lists) != max(lists) else won(lists[0]) if lists else ''),
            '옵션': ystr(opts), '옵션수': str(len(rs)), '원본': '마진 대시보드 제품 목록 복사 (원가 없음)', '가격갱신일': today,
        }
        B = [BEGIN, '## 옵션·채널별 판매가', f'> 원본: 마진 대시보드 [📋 제품 목록 복사 (원가 없음)] · {today}. 빈 칸 = 그 채널 가격 없음. 원가·마진은 이 볼트에 없음.', '']
        hd = ['자체상품코드'] + ([] if same else ['상품명']) + ['옵션'] + used
        B.append('| ' + ' | '.join(hd) + ' |')
        B.append('|' + '|'.join(['---'] * (len(hd) - len(used)) + ['--:'] * len(used)) + '|')
        for r in rs:
            cells = [r['code'] or '(코드 없음)'] + ([] if same else [r['name']]) + [r['opt']] + [won(r['prices'].get(ch)) for ch in used]
            B.append('| ' + ' | '.join(c.replace('|', '/') for c in cells) + ' |')
        if not used: B.append('\n- ⚠️ 채널 판매가가 아직 없음 (마진 대시보드에서 가격 입력 필요)')
        sp = SPEC.get(k)
        if sp:
            B += ['', '## 회사 자료로 확인된 내용', f'> 출처: 회사 기술 자료(CLAUDE.md PART 2 · 공인시험·시방서). 이 밖의 숫자는 쓰지 않음.', f'**{sp[0]}**']
            B += [f'- {x}' for x in sp[1]]
            if sp[2]: B.append(f'- {sp[2]}')
        B.append(END)
        cards.append({'dir': bdir, 'file': f"{safe(k) if not k.startswith('코드없음') else '코드없음'} {safe(name)}.md", 'name': name, 'props': props, 'block': '\n'.join(B), 'brand': brand})
    return cards


BODY = """
## 한 줄 소개
(채울 것 — 누가, 어떤 문제를, 어떻게 해결하는지 한 문장)

## 타깃 고객
-

## 고객이 겪는 문제
-

## 핵심 특장점 3가지
1.
2.
3.

## 사용법
1.

## 검색 키워드
- 메인:
- 롱테일:

## 쓰면 안 되는 표현
- 브랜드 말투상 피할 것: {tone}
- 효능 단정 · 근거 없는 수치 (위 '회사 자료' 칸에 없는 숫자는 쓰지 않음)

## 소스
- 상세페이지:
- 사진/영상 폴더: (NAS — `00 사진 정리 기준`)
- 리뷰 요약:
"""


def render_front(props, keep):
    out = ['---']
    for k in AUTO_KEYS: out.append(f'{k}: {props[k]}' if props[k] != '' else f'{k}:')
    for k, v in keep: out.append(f'{k}:{v}')
    out.append('---')
    return '\n'.join(out)


def write(cards, vault, today):
    root = os.path.join(vault, '01 제품마스터')
    made = upd = 0
    existing = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            if f.endswith('.md'): existing[os.path.join(d, f)] = False
    for c in cards:
        os.makedirs(os.path.join(root, c['dir']), exist_ok=True)
        p = os.path.join(root, c['dir'], c['file'])
        if os.path.exists(p):
            s = open(p, encoding='utf-8').read()
            m = re.match(r'^---\n(.*?)\n---\n', s, re.S)
            keep = []
            if m:
                for line in m.group(1).split('\n'):
                    k = line.split(':', 1)[0]
                    if k not in AUTO_KEYS and ':' in line: keep.append((k, line.split(':', 1)[1]))
                rest = s[m.end():]
            else:
                rest = s
            if BEGIN in rest and END in rest:
                rest = rest[:rest.index(BEGIN)] + c['block'] + rest[rest.index(END) + len(END):]
            else:
                rest = rest.rstrip('\n') + '\n\n' + c['block'] + '\n'
            keep = [(k, v) for k, v in keep if k != '수정일'] + [('수정일', ' ' + today)]
            open(p, 'w', encoding='utf-8').write(render_front(c['props'], keep) + '\n' + rest)
            upd += 1
        else:
            keep = [('상세페이지', ''), ('소스폴더', ''), ('프로모션가', ''), ('상세카드', ' 미완성'), ('수정일', ' ' + today)]
            body = f"# {c['name']}\n> 모카가 제품 목록으로 만든 카드. 가격 칸은 목록을 다시 붙여넣으면 바뀌고, 아래 '채울 것'은 사람이 쓰거나 상세페이지를 받아 Claude 가 채움.\n\n" + c['block'] + '\n' + BODY.format(tone=TONE.get(c['brand'], '-'))
            open(p, 'w', encoding='utf-8').write(render_front(c['props'], keep) + '\n' + body)
            made += 1
        existing[p] = True
    gone = [os.path.relpath(p, vault) for p, hit in existing.items() if not hit and ('/POUR스토어/' in p or '/그로홈/' in p)]
    return made, upd, gone


if __name__ == '__main__':
    if len(sys.argv) < 3: sys.exit(open(__file__, encoding='utf-8').read().split('import')[0])
    today = sys.argv[3] if len(sys.argv) > 3 else (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
    chans, rows = parse(open(sys.argv[1], encoding='utf-8').read())
    cards = build(chans, rows, today)
    made, upd, gone = write(cards, sys.argv[2], today)
    nocode = [r['name'] for r in rows if not r['code']]
    noprice = [c['name'] for c in cards if '채널 판매가가 아직 없음' in c['block']]
    print(f'줄 {len(rows)} → 카드 {len(cards)} (새로 {made} · 갱신 {upd}) · 브랜드별', {b: sum(1 for c in cards if c['dir'] == b) for b in set(c['dir'] for c in cards)})
    if nocode: print('코드 없는 줄:', nocode)
    if noprice: print('가격 없는 카드:', noprice)
    if gone: print('목록에 없는 카드(지우지 않음):', gone)
