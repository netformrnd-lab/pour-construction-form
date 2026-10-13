// node marketing-hub/crew.test.mjs — AI 크루·보드 정의 · Aside 붙여 넣기 읽기 · 승인 요청 모양 시험 (Firebase 안 씀)
import { createRequire } from 'node:module';
import * as K from './crew.js';
const C = createRequire(import.meta.url)('./core.js');
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('✗', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('✓', name); };

// 원형 17명 = 마케팅 허브 TEAM 과 같음 (id · 이름 · 역할)
eq('원형 = 허브 TEAM', K.BASE_TEAM.map((m) => [m.id, m.name, m.role]), C.TEAM.map((m) => [m.id, m.name, m.role]));
const ids = K.allMates().map((m) => m.id);
eq('AI 팀원 id 겹침 없음', ids.length, new Set(ids).size);
eq('크루 3개 · 사람 수', K.CREWS.map((c) => [c.id, c.members.length]), [['b2c', 6], ['b2b', 5], ['bd', 6]]);
eq('B2C 크루 = 그로홈 + POUR스토어 B2C', K.servesL(K.crewOf('gyeoul')), '그로홈 B2C · POUR스토어 B2C');
eq('B2B 크루 = POUR스토어 B2B', K.servesL(K.crewOf('kkomkkom')), 'POUR스토어 B2B');
eq('바라스데이 크루', K.mateBrands('bosong'), ['bmupq52c0']);
eq('원형은 크루 없음', [K.crewOf('pori'), K.mateBrands('pori')], [null, []]);
eq('파생 원형은 있는 AI', K.CREWS.flatMap((c) => c.members.flatMap((m) => m.from || [])).every((f) => K.BASE_TEAM.some((b) => b.id === f)), true);

// 보드 6개 — 크루 사람과 짝 · 행동 A~E
eq('보드 6개 · 짝', Object.values(K.BOARDS).map((b) => [b.id, b.mate, K.mateOf(b.mate).name]), [['gh-ohou', 'bom', '봄'], ['gh-exp', 'yeoreum', '여름'], ['gh-traffic', 'gaeul', '가을'], ['gh-conv', 'gyeoul', '겨울'], ['gh-aov', 'haneul', '하늘'], ['gh-rep', 'uju', '우주']]);
eq('크루 사람 board = 보드 id', K.CREWS[0].members.map((m) => K.boardOf(m.board).mate === m.id), [true, true, true, true, true, true]);
eq('행동 A~E', Object.values(K.BOARDS).map((b) => b.actions.map((a) => a.c).join('')), ['ABCDE', 'ABCDE', 'ABCDE', 'ABCDE', 'ABCDE', 'ABCDE']);
// 원가·마진·제조사·공급 단가 칸 없음 (관리자 자리 행동의 하는 일 글은 그대로 · 화면엔 안 보임)
const leak = [];
Object.values(K.BOARDS).forEach((b) => b.actions.forEach((a) => { a.cols.forEach((c) => K.SECRET_RE.test(c) && leak.push(b.id + a.c + ' 칸 ' + c));
  if (a.card) JSON.stringify(a.card).match(K.SECRET_RE) && leak.push(b.id + a.c + ' 카드');
  if (!a.admin) a.s.forEach((s) => /원가|공급\s*단가|공급가|매입|제조사/.test(s) && leak.push(b.id + a.c + ' ' + s)); }));
eq('원가·제조사·공급 단가 없음', leak, []);
eq('관리자 자리 행동 = 노출 E 하나', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.admin).map((a) => b.id + a.c)), ['gh-expE']);
// 실행은 사람: '승인…' 단계는 담당·사람이 함 · 실행 한 줄도 담당
const auto = [];
Object.values(K.BOARDS).forEach((b) => b.actions.forEach((a) => { a.s.filter((s) => /^승인/.test(s)).forEach((s) => !/담당|사람/.test(s) && auto.push(b.id + a.c + ' ' + s));
  if (a.exec && !/담당/.test(a.exec)) auto.push(b.id + a.c + ' exec ' + a.exec);
  if (/직접\s*(반영|게시|발송|등록)/.test(a.s.join(' '))) auto.push(b.id + a.c + ' 직접'); }));
eq('승인 뒤 실행 = 담당(사람)', auto, []);
eq('실행 한 줄 있는 행동 수', Object.values(K.BOARDS).reduce((s, b) => s + b.actions.filter((a) => a.exec).length, 0), 27);   // 실행 없는 것 = 유입 A(감시·보고) · 재구매 A(측정) · 노출 E(관리자 자리)

// 숫자 보기
const m1 = K.boardOf('gh-exp').metrics[0];
eq('만 단위', K.fmtMetric(m1, 6185000), '618.5만');
eq('원 · %', [K.fmtMetric({ u: '원' }, 23209), K.fmtMetric({ u: '원' }, 262900), K.fmtMetric({ u: '원' }, 30000000), K.fmtMetric({ u: '%' }, 7.6)], ['23,209원', '262,900원', '3,000만 원', '7.6%']);
eq('목표까지 (오르는 지표)', K.metricPct({ base: 2.12, target: 3, dir: 'up' }, 2.56), 0.5);
eq('목표까지 (줄이는 지표)', K.metricPct({ base: 85, target: 75, dir: 'down' }, 80), 0.5);
eq('기준값 없으면 목표 대비', K.metricPct({ base: null, target: 60, dir: 'up' }, 30), 0.5);
eq('목표 넘음', [K.metricOk({ target: 0, dir: 'down' }, 0), K.metricOk({ target: 7, dir: 'up' }, 6.9)], [true, false]);
eq('숫자 읽기', [K.toNum('7.4%'), K.toNum('1,288만 원'), K.toNum('2억'), K.toNum('-')], [7.4, 12880000, 200000000, null]);

// Aside 붙여 넣기
const txt = ['[지표]', 'cv_mall\t7.4%', '쿠팡 구매전환율: 2.4', '없는지표 3', '품절 상품 수 1', '[상태]', 'A: 롤러 재입고 대기', 'B. 가격안 3개',
  '[A]', '요약: 품절 1개 · 발주 초안 1건', '상품\t채널\t가용재고\t7일 판매\t소진 예상일\t할 일\t마진\t피그마 파일 받기 (SVG)', '롤러일체형\t스마트스토어\t0\t52\t품절\t고객 010-1234-5678 연락\t30%\thttp://x',
  '롤러 미니\t쿠팡\t340\t70\t11/15\t발주 초안', '[E 알리바바 제조사]', '제조사\t단가', 'X\t1',
  '[B]', '| 번호 | 항목 | 내용 | 근거 |', '|---|---|---|---|', '| B3 | 1+1 | 19,900원 | 경쟁 11,000원 |', '설명 한 줄 a@b.com', '[완료]', 'A1'].join('\n');
const p = K.parseCrew(txt, K.boardOf('gh-conv'));
eq('지표 읽기', p.metrics.map((x) => [x.k, x.v]), [['cv_mall', 7.4], ['cv_cp', 2.4], ['soldout', 1]]);
eq('모르는 지표', p.unknown, ['없는지표']);
eq('상태', p.status, { A: '롤러 재입고 대기', B: '가격안 3개' });
eq('A 칸 = 마진·피그마 뺌', [p.acts.A.cols, p.acts.A.dropped], [['상품', '채널', '가용재고', '7일 판매', '소진 예상일', '할 일'], ['마진', '피그마 파일 받기 (SVG)']]);
eq('A 번호 · 연락처 가림', p.acts.A.items.map((x) => [x.n, x.c['할 일']]), [['A1', '고객 010-****-**** 연락'], ['A2', '발주 초안']]);
eq('A 요약', p.acts.A.sum, '품절 1개 · 발주 초안 1건');
eq('제조사 표 뺌 · 경고', [!!p.acts.E, p.warn.some((w) => /제조사/.test(w))], [false, true]);
eq('B 마크다운 표 · 번호 칸 · 설명 메일 가림', [p.acts.B.cols, p.acts.B.items, p.acts.B.body], [['항목', '내용', '근거'], [{ n: 'B3', c: { 항목: '1+1', 내용: '19,900원', 근거: '경쟁 11,000원' } }], ['설명 한 줄 (메일 가림)']]);
eq('완료는 읽기만', p.done, 'A1');
const pe = K.parseCrew('[E]\n후보\t공급 단가\nA\t1\n[A]\n크리에이터\tDM 초안\n김\t안녕하세요', K.boardOf('gh-exp'));
eq('노출 E(관리자 자리) 안 올림', [Object.keys(pe.acts), pe.warn.some((w) => /관리자 자리/.test(w))], [['A'], true]);

// 승인 요청 문서
const asks = K.asksFromParse(p, { board: 'gh-conv', mate: 'gyeoul', brand: 'grohome', run: '2026-10-12', at: '2026-10-12T00:00:00.000Z', owner: 'u1', src: 'crew' });
eq('행동마다 하나', asks.map((a) => a.id), ['ai_gyeoul_20261012_ghconvA', 'ai_gyeoul_20261012_ghconvB']);
const a0 = asks[0];
eq('처음 = 담당 차례', [a0.state, a0.to, a0.owner, a0.step, a0.ver, a0.pick, a0.path], ['wait', 'u1', 'u1', 0, 1, null, []]);
eq('누가 · 어디', [a0.crew, a0.mate, a0.mateName, a0.brand, a0.board, a0.act, a0.log[0].by, a0.log[0].byName], ['b2c', 'gyeoul', '겨울', 'grohome', 'gh-conv', 'A', 'ai:gyeoul', '겨울 (AI)']);
eq('제목 · 실행 한 줄', [a0.title, a0.exec], ['전환 보드 A · 품절 0 만들기 (롤러일체형 판매 재개)', '승인되면 담당이 상세페이지·재입고 알림에 반영한다']);
eq('담당 없으면 to 빈칸(관리자 누구나)', K.askDoc({ id: 'x', mate: 'pori', title: 't' }).to, '');
eq('개인정보 가림(요약·글)', K.askDoc({ id: 'x', mate: 'pori', title: 't', sum: '010 1234 5678', body: 'q@w.kr' }).sum + '|' + K.askDoc({ id: 'x', mate: 'pori', title: 't', body: 'q@w.kr' }).body, '010-****-****|(메일 가림)');
eq('다시 올리기 가능', [K.canRedo({ state: 'back' }), K.canRedo({ state: 'wait', step: 0 }), K.canRedo({ state: 'wait', step: 1 }), K.canRedo({ state: 'ok' }), K.canRedo(null)], [true, true, false, false, false]);
const rf = K.redoFields({ ...a0, state: 'back', back: { text: '근거 더' }, ver: 1 }, { title: '새 제목', items: [{ n: 'A1', c: {} }], at: 'T' }, 'u2');
eq('다시 올림 = 담당 차례 · 2번째', [rf.state, rf.to, rf.owner, rf.step, rf.ver, rf.back, rf.pick, rf.title, rf.updatedAt], ['wait', 'u2', 'u2', 0, 2, null, null, '새 제목', 'T']);
eq('담당 = 브랜드별 → 기본', [K.ownerFor({ owners: { grohome: 'a', _: 'b' } }, 'grohome'), K.ownerFor({ owners: { grohome: 'a', _: 'b' } }, 'pourstore'), K.ownerFor(null, 'x')], ['a', 'b', '']);
eq('Aside 지시문에 관리자 자리 행동 없음', /\[E\]/.test(K.asideText(K.boardOf('gh-exp'))), false);
eq('Aside 지시문에 지표 키', K.asideText(K.boardOf('gh-conv')).includes('cv_mall\t'), true);

// 2026-10-14 하루·포리·에코 쉼 → 여름 (아침 루틴) · team_link.py(볼트 사본도 같은 파일) CREW·GONE 과 같게
eq('쉬는 팀원 → 여름', Object.entries(K.GONE).map(([g, to]) => [K.mateOf(g).name, K.mateOf(to).name, K.crewOf(to).id]), [['하루', '여름', 'b2c'], ['포리', '여름', 'b2c'], ['에코', '여름', 'b2c']]);
eq('아침 루틴 = 여름 하나', K.allMates().filter((m) => m.routine).map((m) => m.id), ['yeoreum']);
eq('담당 칸: 여름 = 기본 + 브랜드 · 겨울 = 브랜드 · 루나 = 기본', [K.ownerKeys('yeoreum'), K.ownerKeys('gyeoul'), K.ownerKeys('luna')], [['', 'grohome', 'pourstore'], ['grohome', 'pourstore'], ['']]);
eq('허브 가동 크루(core.js CREW_LIVE) = crew.js 이름·역할·크루', C.CREW_LIVE.map((m) => [m.id, m.name, m.role, m.crew]), C.CREW_LIVE.map((m) => { const x = K.mateOf(m.id) || {}; return [x.id, x.name, x.role, x.crew]; }));
{
  const { execFileSync } = await import('node:child_process');
  const py = 'import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T; print(json.dumps({"crew": {k: list(v) for k, v in T.CREW.items()}, "gone": T.GONE}))';
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py 크루 = crew.js', got.crew, Object.fromEntries(K.CREWS.flatMap((c) => c.members.map((m) => [m.id, [m.name, c.id]]))));
  eq('team_link.py GONE = crew.js', got.gone, K.GONE);
}

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
