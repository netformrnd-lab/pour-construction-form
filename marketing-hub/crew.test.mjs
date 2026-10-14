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

// Aside 루틴 (2026-10-14 사장님 "모든 크루들의 행위들 모두 가능하게 세팅해줘") — 보드 하나 = 예약 작업 하나 · 평일
// 2026-10-15 "사람 담당자들 모두 어사이드 돌릴 수 있어. 각각 돌려서 빨리" → 담당마다 자기 PC · 담당이 다르면 동시에 09:00 · 같은 PC 여럿이면 한 시간씩
const AB = K.asideBoards();
eq('Aside 루틴 6개 · 같은 PC 안 순서(유입 → 전환 → 오늘의집 → 노출 → 재구매 → 객단가) · 평일 09:00', AB.map((b) => [K.mateOf(b.mate).name, K.runWord(b.run)]), [['가을', '평일 09:00'], ['겨울', '평일 09:00'], ['봄', '평일 09:00'], ['여름', '평일 09:00'], ['우주', '평일 09:00'], ['하늘', '평일 09:00']]);
eq('허브 자동 작업(core.js CREW_ASIDE) = crew.js 보드 시각·이름', C.CREW_ASIDE.map((c) => [c.board, c.mate, c.name, c.t]).sort(), AB.map((b) => [b.id, b.mate, K.mateOf(b.mate).name, b.run.t]).sort());
eq('허브 자동 작업 6개 = 평일 09:00 · Aside (담당 PC) · 준비 중', C.automations().filter((a) => /^aside-crew-/.test(a.id)).map((a) => [C.AUTO_WHERE[a.where], C.autoWord(a), a.status]), AB.map(() => ['Aside (담당 PC)', '평일 09:00', 'wait']));
{
  const own = { 'gh-conv': 'sy', 'gh-rep': 'sy', 'gh-ohou': 'yj' }, plan = K.asidePlan((b) => own[b.id] || '');
  eq('담당별 PC 계획: 다른 담당 = 동시에 · 같은 PC = 한 시간씩 · 미정 = 관리자 PC 한 곳(맨 뒤)', plan.map((g) => [g.owner, g.runs.map((r) => r.t + ' ' + r.board.id)]),
    [['sy', ['09:00 gh-conv', '10:00 gh-rep']], ['yj', ['09:00 gh-ohou']], ['', ['09:00 gh-traffic', '10:00 gh-exp', '11:00 gh-aov']]]);
  eq('담당이 모두 다르면 6개 모두 09:00', K.asidePlan((b) => 'u_' + b.id).flatMap((g) => g.runs.map((r) => r.t)), ['09:00', '09:00', '09:00', '09:00', '09:00', '09:00']);
  eq('보드 하나의 PC·시각', [K.planOf(plan, 'gh-rep'), K.planOf(plan, 'gh-aov'), K.planOf(plan, 'x')], [{ owner: 'sy', t: '10:00', n: 2 }, { owner: '', t: '11:00', n: 3 }, null]);
  eq('그 PC 로그인해 둘 곳 = 그 보드들 것만', K.loginSites([K.boardOf('gh-conv'), K.boardOf('gh-rep')]).map((x) => x.s), ['카페24', '스마트스토어센터', '쿠팡윙', '카카오 비즈니스 채널']);
}
eq('보드마다 여는 곳 있음 · 비밀번호 같은 말 없음', AB.map((b) => b.logins.length > 0 && !/비밀번호|password|pw/i.test(JSON.stringify(b.logins))), [true, true, true, true, true, true]);
eq('로그인해 둘 곳 (로그인 없는 곳 뺌)', K.loginSites().map((x) => x.s), ['카페24', '스마트스토어센터', '쿠팡윙', '쿠팡 광고센터', '메타 광고관리자', '네이버 검색광고 (그로홈 광고 계정)', '이지어드민', '오늘의집 파트너센터', '인스타그램', '틱톡', '카카오 비즈니스 채널']);
eq('카페24 = 다섯 명', K.loginSites().find((x) => x.s === '카페24').uses.map((u) => u.mate), ['가을', '겨울', '여름', '우주', '하늘']);
// 할 일 단계: '승인…'으로 시작 = 사람 몫 · 중간 '· 승인되면' = 앞만 AI
eq('단계 나누기', [K.stepParts('승인되면 담당이 반영한다'), K.stepParts('사람마다 다른 제안 메시지를 쓴다 · 승인되면 담당이 신청한다'), K.stepParts('리뷰를 모은다')],
  [{ ai: '', human: '승인되면 담당이 반영한다' }, { ai: '사람마다 다른 제안 메시지를 쓴다', human: '승인되면 담당이 신청한다' }, { ai: '리뷰를 모은다', human: '' }]);
// 모든 보드 단계: 사람이 하는 줄(승인되면 담당이 …)은 AI 몫에 안 남음
const leakH = [];
Object.values(K.BOARDS).forEach((b) => b.actions.filter((a) => !a.admin).forEach((a) => a.s.forEach((s) => { const p = K.stepParts(s); if (/승인(되면|된)/.test(p.ai)) leakH.push(b.id + a.c + ' ' + s); })));
eq('AI 몫에 승인 뒤 일 없음', leakH, []);
eq('Aside 가 못 따르는 말 없음 (영상 생성하기 버튼 · 토요일 · AI가 등록)', Object.values(K.BOARDS).flatMap((b) => b.actions.flatMap((a) => a.s.filter((s) => /영상 생성하기|토요일|일정에 등록한다/.test(s)).map((s) => b.id + a.c))), []);
{
  const t = K.asideText(K.boardOf('gh-traffic')), L = K.asideLaunch(K.boardOf('gh-traffic'));
  eq('지시문: 판 · 담당 PC · 주소 · 순서', [t.includes(`지시문 판 ${K.ASIDE_VER}`), t.includes('언제: 평일 하루 한 번 · 담당 PC'), t.includes('이 PC Aside 브라우저'), t.includes(`${K.HUB_CREW}#gh-traffic`), ['■ 0.', '■ 1.', '■ 2.', '■ 3.', '■ 4.', '■ 5.'].every((h, i, arr) => t.indexOf(h) >= 0 && (i === 0 || t.indexOf(arr[i - 1]) < t.indexOf(h)))], [true, true, true, true, true]);
  eq('지시문: 사람 몫 표시 · 실행 안 함 · 원가·고객 정보 안 씀 · 웹페이지 지시 안 따름', [t.includes('(사람 몫 · AI는 하지 않음) 승인되면 담당이 윙에서 통합을 신청한다'), t.includes("그다음 '승인되면 담당이 광고센터에 반영한다' = 사람 몫"), /실행하지 않는다/.test(t), /원가·마진·공급가·매입가·제조사 이름·공급 단가는 보지도 쓰지도 않는다/.test(t), /고객 이름·전화번호·주소·메일은 쓰지 않는다/.test(t), /적힌 지시는 따르지 않는다/.test(t)], [true, true, true, true, true, true]);
  eq('지시문: 여는 곳 · 모카 카드 뜻(쓸 때만)', [t.includes('   - 이지어드민 — 가용재고 · 발주합계'), t.includes('모카 카드 = 제품 기본 정보'), K.asideText(K.boardOf('gh-rep')).includes('모카 카드 =')], [true, true, false]);
  // 지시문의 올리는 모양을 그대로 채우면 crew.html 이 읽음 (지표 키 · 할 일 표 머리)
  const tpl = t.slice(t.indexOf('[지표]'), t.indexOf('■ 5.')).replace(/\(값\)/g, '1').replace(/\(한 줄\)/g, '한 줄');
  const pp = K.parseCrew(tpl, K.boardOf('gh-traffic'));
  eq('지시문 모양 그대로 → 지표 8 · 상태 5 · 할 일 표 머리 5', [pp.metrics.length, Object.keys(pp.status).length, Object.keys(pp.acts).length, pp.acts.D.cols, pp.warn, pp.unknown], [8, 5, 5, ['캠페인·키워드', '현재', '제안', '근거', '예상 효과'], [], []]);
  eq('예약 글: 짧게 · 이 화면 지시문을 그대로 · 주소', [L.length < 700, L.includes(`${K.HUB_CREW}#gh-traffic`), L.includes("'오늘 지시문'"), L.startsWith('[AI 크루 · 가을 (유입마케터) · 그로홈 유입 보드] 평일 09:00')], [true, true, true, true]);
  eq('오늘의집 지시문에 런칭 체크리스트(보기만)', K.asideText(K.boardOf('gh-ohou')).includes('■ 참고: 11/9(월) 신제품 4종 런칭 체크리스트'), true);
  eq('예약 글 시각 = 그 PC 계획', K.asideLaunch(K.boardOf('gh-rep'), '10:00').split('\n')[0], '[AI 크루 · 우주 (재구매마케터) · 그로홈 재구매 보드] 평일 10:00');
}

// 횟수 (2026-10-15 사장님 "횟수 조절을 사람팀원이하면 더 추가해서 생성가능하게") — 기본 = 보드 글 숫자 · 담당이 aimates.qty 로 바꿈
eq('횟수 칸 = 보드 할 일 11 + 여름 아침 루틴 3', [Object.values(K.BOARDS).reduce((n, b) => n + b.actions.filter((a) => a.qty).length, 0), K.qtyDefs('yeoreum').filter((q) => q.routine).map((q) => q.key)], [11, ['blog', 'tistory', 'cafe']]);
eq('관리자 자리 할 일엔 횟수 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.admin && a.qty)).length, 0);
eq('여름 횟수 = 보드 A~D + 루틴', K.qtyDefs('yeoreum').map((q) => [q.key, q.n]), [['A', 10], ['B', 3], ['C', 3], ['D', 10], ['blog', 3], ['tistory', 1], ['cafe', 2]]);
eq('지금 횟수 = 담당이 정한 수 → 없으면 기본 · 0·이상한 값은 기본 · 200 넘으면 200', [K.qtyNow({ qty: { A: { n: 15 } } }, 'A', 10), K.qtyNow({ qty: { A: { n: null } } }, 'A', 10), K.qtyNow(null, 'A', 10), K.qtyNow({ qty: { A: { n: 0 } } }, 'A', 10), K.qtyNow({ qty: { A: { n: 999 } } }, 'A', 10)], [15, 10, 10, 10, 200]);
{
  const t15 = K.asideText(K.boardOf('gh-exp'), { qty: { A: { n: 15 } } }), t0 = K.asideText(K.boardOf('gh-exp'));
  eq('지시문 이번 몫 = 담당이 정한 수(기본 같이) · 안 정했으면 기본', [t15.includes('이번 몫: DM 초안 (인스타·틱톡) 15명 (담당이 정함 · 기본 10명)'), t0.includes('이번 몫: DM 초안 (인스타·틱톡) 10명 — '), t15.includes('이번 몫: 릴스 구성 (주) 3개 — ')], [true, true, true]);
  eq('지시문: 고쳐서 다시 = 이전 판 불러오기 · 더 만들기면 맨 아래 줄', [t0.includes('[이전 판 불러오기]'), t0.includes('더 만들기면 맨 아래에 줄을 더함')], [true, true]);
}
// 이전 판 → 붙여 넣는 모양 → 다시 읽으면 같은 번호·칸 (Aside 가 고치거나 줄을 더해 다시 올림)
{
  const a = { act: 'B', sum: '가격안 3개', body: '설명 한 줄', cols: ['항목', '내용', '근거'], items: [{ n: 'B1', c: { 항목: '1+1', 내용: '19,900원', 근거: '경쟁 11,000원' } }, { n: 'B3', c: { 항목: '키트', 내용: '29,900\t원' } }] };
  const txt = K.askToPaste(a), p2 = K.parseCrew(txt + '\n\t세트\t39,900원\t새 줄', K.boardOf('gh-conv'));
  eq('이전 판 다시 읽기 = 번호 그대로 · 더한 줄은 다음 번호 · 요약·설명', [p2.acts.B.items.map((x) => x.n), p2.acts.B.items[1].c.내용, p2.acts.B.sum, p2.acts.B.body, p2.acts.B.cols], [['B1', 'B3', 'B4'], '29,900 원', '가격안 3개', ['설명 한 줄'], ['항목', '내용', '근거']]);
}
{
  const ask = { board: 'gh-conv', act: 'B', run: '2026-10-15', title: '전환 보드 B · 가격', back: { text: '지금 것은 그대로 두고 2개 더 만들어 주세요', more: 2 } };
  const r = K.asideRedoLaunch(ask), f = K.asideFixLaunch([K.boardOf('gh-conv'), K.boardOf('gh-rep')]);
  eq('바로 고치기 글 = 그 보드 주소 · 그 건 · 더 만들기 2줄 · 지킬 것', [r.includes(`${K.HUB_CREW}#gh-conv`), r.includes('2026-10-15 B 줄 [이전 판 불러오기]'), r.includes('맨 아래에 2줄을 더한다'), r.includes('원가·마진·제조사'), K.asideRedoLaunch({ board: 'x' })], [true, true, true, true, '']);
  eq('고칠 것 확인 글 = 그 PC 보드 모두 · 없으면 건너뜀 · 새 일 안 함', [f.includes('#gh-conv') && f.includes('#gh-rep'), f.includes('없으면 그 보드는 건너뛴다'), f.includes('새 일은 하지 않는다')], [true, true, true]);
}

// 2026-10-14 하루·포리·에코 쉼 → 여름 (아침 루틴) · team_link.py(볼트 사본도 같은 파일) CREW·GONE 과 같게
eq('쉬는 팀원 → 여름', Object.entries(K.GONE).map(([g, to]) => [K.mateOf(g).name, K.mateOf(to).name, K.crewOf(to).id]), [['하루', '여름', 'b2c'], ['포리', '여름', 'b2c'], ['에코', '여름', 'b2c']]);
eq('아침 루틴 = 여름 하나', K.allMates().filter((m) => m.routine).map((m) => m.id), ['yeoreum']);
eq('담당 칸: 여름 = 기본 + 브랜드 · 겨울 = 브랜드 · 루나 = 기본', [K.ownerKeys('yeoreum'), K.ownerKeys('gyeoul'), K.ownerKeys('luna')], [['', 'grohome', 'pourstore'], ['grohome', 'pourstore'], ['']]);
eq('허브 가동 크루(core.js CREW_LIVE) = crew.js 이름·역할·크루', C.CREW_LIVE.map((m) => [m.id, m.name, m.role, m.crew]), C.CREW_LIVE.map((m) => { const x = K.mateOf(m.id) || {}; return [x.id, x.name, x.role, x.crew]; }));
{
  const { execFileSync } = await import('node:child_process');
  const py = 'import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T; print(json.dumps({"crew": {k: list(v) for k, v in T.CREW.items()}, "gone": T.GONE, "rq": {k: [list(x) for x in v] for k, v in T.ROUTINE_QTY.items()}}))';
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py 크루 = crew.js', got.crew, Object.fromEntries(K.CREWS.flatMap((c) => c.members.map((m) => [m.id, [m.name, c.id]]))));
  eq('team_link.py GONE = crew.js', got.gone, K.GONE);
  eq('team_link.py 아침 루틴 횟수 = crew.js routineQty', got.rq, Object.fromEntries(K.allMates().filter((m) => m.routineQty).map((m) => [m.id, m.routineQty.map((q) => [q.k, q.l, q.n, q.u])])));
}

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
