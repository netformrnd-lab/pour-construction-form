// node marketing-hub/adops.test.mjs — 광고 일일 보고서(adreports) · 매뉴얼 화면 계산 시험 (Firebase 안 씀)
import * as A from './adops.js';
import * as K from './crew.js';
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('✗', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('✓', name); };

// JSON 글 칸
eq('칸 없음 · 빈 배열 · 못 읽음', [A.jsonField(undefined), A.jsonField('[]'), A.jsonField('{x')], [{ has: false, val: null }, { has: true, val: [] }, { has: true, bad: true, val: null }]);
// 첫 보고서 모양 그대로 (2026-10-15 · offs '[]' · longtail 없음)
const r15 = { date: '2026-10-15', title: '[광고 일일] 2026-10-15', md: '# x', summary: '쿠팡 7일 ROAS 221.8% · OFF 0건', offs: '[]', by: 'aside', at: '2026-10-15T08:12:24.139Z' };
eq('첫 보고서: 끈 것 0 · 롱테일 칸 없음 → 숨김', [A.offsOf(r15), A.longtailCount(r15), A.topCards([r15], '2026-10-15')],
  [{ has: true, bad: false, rows: [] }, null, { last: r15, summary: '쿠팡 7일 ROAS 221.8% · OFF 0건', offsWeek: 0, longtail: null }]);
eq('offs 칸 자체가 없으면 이번 주 카드 숨김', A.topCards([{ date: '2026-10-15' }], '2026-10-15').offsWeek, null);
// 끈 것 줄 — 열쇠 이름이 영어·한글 어느 쪽이어도
const r16 = { date: '2026-10-16', offs: JSON.stringify([
  { media: 'coupang', campaign: 'B 올인원 균열보수', keyword: '방수 페인트', reason: '30일 17,639원 · 주문 0', action: 'OFF' },
  { 매체: '메타', 캠페인: '③ 소재 테스트', 대상: 'T2 시트지 대체', 근거: '7일 ROAS 120% · 구매 10건', 조치: '광고 OFF' },
  '초강력 바닥 방수제']), longtail: JSON.stringify({ new: ['목재용 브러쉬 페인트', '도배 마스킹테이프'], confirmed: [1, 2, 3] }) };
eq('끈 것 줄 읽기', A.offsOf(r16).rows, [
  { date: '2026-10-16', media: '쿠팡', campaign: 'B 올인원 균열보수', target: '방수 페인트', reason: '30일 17,639원 · 주문 0', action: 'OFF' },
  { date: '2026-10-16', media: '메타', campaign: '③ 소재 테스트', target: 'T2 시트지 대체', reason: '7일 ROAS 120% · 구매 10건', action: '광고 OFF' },
  { date: '2026-10-16', media: '', campaign: '', target: '초강력 바닥 방수제', reason: '', action: 'OFF' }]);
eq('{items:[…]} 모양도', A.offsOf({ date: '2026-10-17', offs: '{"items":[{"target":"x"}]}' }).rows.map((r) => r.target), ['x']);
eq('새 롱테일 = new 수 · 배열 = 길이 · 숫자', [A.longtailCount(r16), A.longtailCount({ longtail: '[1,2,3]' }), A.longtailCount({ longtail: '{"신규":4}' }), A.longtailCount({ longtail: '{"x":1}' })], [2, 3, 4, null]);
// 날짜 · 주간 · 월간
eq('주 시작 = 월요일', [A.weekStart('2026-10-15'), A.weekStart('2026-10-12'), A.weekStart('2026-10-18'), A.weekStart('2026-10-19')], ['2026-10-12', '2026-10-12', '2026-10-12', '2026-10-19']);
const r20 = { date: '2026-10-20', offs: '[{"media":"naver","target":"바르는방수액"}]' }, r930 = { date: '2026-09-30', offs: '[{"target":"a"},{"target":"b"}]' };
const L = A.offLog([r15, r930, r20, r16], '2026-10-21');
eq('끈 것 기록: 최신순 · 이번 주 · 이번 달 · 주별 · 월별', [L.rows.map((r) => r.date + ' ' + r.target), L.thisWeek, L.thisMonth, L.weeks, L.months],
  [['2026-10-20 바르는방수액', '2026-10-16 방수 페인트', '2026-10-16 T2 시트지 대체', '2026-10-16 초강력 바닥 방수제', '2026-09-30 a', '2026-09-30 b'], 1, 4,
    [{ w: '2026-10-19', n: 1 }, { w: '2026-10-12', n: 3 }, { w: '2026-09-28', n: 2 }], [{ m: '2026-10', n: 4 }, { m: '2026-09', n: 2 }]]);
eq('보고서 최신순 · 날짜 없는 건 뺌', A.sortReports([r15, { title: 'x' }, r20, r16]).map((r) => r.date), ['2026-10-20', '2026-10-16', '2026-10-15']);
eq('위 카드 = 최신 보고서', A.topCards([r15, r16], '2026-10-16'), { last: r16, summary: '', offsWeek: 3, longtail: 2 });
eq('주 이름', A.weekL('2026-10-12'), '10/12 주');
// 광고 AI팀 = 가을 한 명 (2026-10-17 사장님 AARRR 정리 "광고는 가을로 모으기" — 예전 여름 메타 소재 · 겨울 메타 판정 · 우주 리타겟팅 · 하늘 오퍼 · 봄 오늘의집 = 모두 가을)
eq('광고 몫 = 가을 하나 · 다른 크루원은 광고 몫 없음', K.CREWS.find((c) => c.id === 'b2c').members.map((m) => [m.name, (A.AD_ROLES[m.id] || {}).ad || null]),
  [['여름', null], ['가을', '광고 전부 (메타·쿠팡·네이버·구글 디맨드젠·오늘의집)'], ['겨울', null], ['우주', null], ['하늘', null], ['봄', null], ['바람', null], ['이음', null], ['별', null], ['달', null]]);
eq('가을 광고 몫 = 메타 판정·소재·리타겟팅 · 쿠팡 롱테일 · 바꿀 안 글자가 가을 보드에 있음', [/금요일 외주 판정/.test(A.AD_ROLES.gaeul.does), /소재/.test(A.AD_ROLES.gaeul.does), /리타겟팅/.test(A.AD_ROLES.gaeul.does), /롱테일/.test(A.AD_ROLES.gaeul.does), ['D', 'E', 'G', 'H', 'I'].every((c) => A.AD_ROLES.gaeul.when.includes(`${c} `) && K.actOf('gh-traffic', c))], [true, true, true, true, true]);
// 가을 보드의 광고 할 일 F = 08:30 광고 루틴 (보고서 화면 링크) · 겨울 F 는 가을 F 에 합침 (2026-10-17)
eq('보드 F = 광고 일일 보고서 하나 (매일 · 금 주간)', [['gh-traffic', 'gh-conv'].map((id) => { const a = K.actOf(id, 'F'); return a ? [a.when, a.report] : null; })], [[['매일 08:30 · 금 16:00', 'ads'], null]]);

// 제안서 검증 — 실제 문서 모양 (2026-10-15 · json 글 하나)
const pdoc = { title: '데일리그로스 메타 운영 제안서(2026.10.15) 검증', at: '2026-10-15T09:20:05.263Z', by: 'aside', json: JSON.stringify({ baseline: { meta_roas_jan_sep: 205, meta_roas_sep: 286, meta_roas_target_dec: 350, mall_mer_jan_sep: 310, mall_mer_sep: 415 },
  structure: { campaigns: '① 신규 60', judge: '금요일', live: '2026-11-02' }, hypotheses: [{ id: 'H1', area: '구조', what: 'x', where: 'y', pass: 'z', fail: 'w', page: 23, status: '미시작' }, { id: 'H2', status: '진행 중' }, { id: 'H3', status: '통과' }],
  gaps_20261015: ['메타 캠페인 3단 구조 아님', '구매자 제외 타겟 없음'], source_rule: '[제안서 pXX] / [김송희 관리방안] / [Aside 추가]' }) };
const P = A.parseProposal(pdoc);
eq('제안서: 기준선 · 가설 · 차이 · 차이 날짜', [P.baseline.meta_roas_sep, P.hypotheses.map((h) => h.id), P.gaps, P.gapsAt, P.structure.live], [286, ['H1', 'H2', 'H3'], ['메타 캠페인 3단 구조 아님', '구매자 제외 타겟 없음'], '20261015', '2026-11-02']);
eq('규칙 기본값: 김송희 관리방안 먼저 · 사장님 결정 · 제안서는 참고', [P.roles.length, P.rules.map((r) => r.src), P.rules.filter((r) => r.ref).map((r) => r.k)], [4, ['김송희 관리방안', '김송희 관리방안', '김송희 관리방안', '김송희 관리방안', '김송희 관리방안', '사장님 결정', '제안서', '제안서'], ['structure', 'judge']]);
// 외주 기간 운영 기준 = 김송희 관리방안 (2026-10-15 사장님 "광고는 외주기간에는 김송희의 방안으로 진행해줘")
eq('외주 기간 기준', [A.AD_MODE.basis, A.AD_MODE.note.includes('김송희 관리방안')], ['김송희 관리방안', true]);
eq('테스트 캠페인 알아보기', [A.isTestCamp({ campaign: '테스트_A1 소용량' }), A.isTestCamp({ campaign: '메인_상품별', target: 'T03 공감형' }), A.isTestCamp({ campaign: '메인_상품별', target: '목재페인트' })], [true, true, false]);
eq('김송희 기준: 테스트 300% · 고정 400% · 그 밖은 점검', [A.expectKsh({ campaign: '테스트_A1', roas14: 320 }), A.expectKsh({ campaign: '테스트_A2', roas: 250 }), A.expectKsh({ campaign: '메인', roas14: 450 }).v, A.expectKsh({ campaign: '메인', roas14: 330 }), A.expectKsh({ campaign: '메인' }).why],
  [{ v: '유지', why: '테스트 300%+ · 고정 캠페인으로 옮길 후보' }, { v: '종료', why: '테스트 300% 미만 · 다음 소재로' }, '유지', { v: '', why: '고정 400% 미만 · 소재·타겟 점검 (관리방안 400~500%)' }, 'ROAS 없음']);
{ const J = A.judgeLog([{ date: '2026-10-16', judges: JSON.stringify([{ campaign: '테스트_A1', roas14: 250, purchases: 12, verdict: '유지' }, { campaign: '메인_목재', roas14: 420, purchases: 30, verdict: '증액' }]) }]);
  eq('판정 로그: 김송희 기준 비교(외주 기간) + 제안서 기준(참고)', J.rows.map((x) => [x.campaign, x.verdict, x.ksh, x.kshMatch, x.expect, x.match]).concat([[J.kshDiff, J.diff]]), [['테스트_A1', '유지', '종료', '다름', '유지', '일치'], ['메인_목재', '증액', '유지', '다름', '증액', '일치'], [2, 0]]); }
eq('제안서: 칸이 문서 바로 아래 + 쪽수', A.parseProposal({ baseline: '{"meta_roas_sep":290}', pages: { judge: 14 }, hypotheses: [] }).rules.find((r) => r.k === 'judge').page + '|' + A.parseProposal({ baseline: '{"meta_roas_sep":290}' }).baseline.meta_roas_sep, '14|290');
eq('가설 상태 · 개수', [A.hypStatus('진행 중'), A.hypStatus(''), A.hypCount(P.hypotheses)], ['진행', '미시작', { 미시작: 1, 진행: 1, 통과: 1, 미달: 0, 보류: 0 }]);
eq('출처 배지', [A.srcTags('a [제안서 p23] b [김송희 관리방안] [Aside 추가] [링크]'), A.srcText('제안서', 23), A.srcText('제안서', null), A.countSrcTags('[제안서 p3][제안서][Aside 추가]')],
  ['a <span class="src s-p">제안서 p23</span> b <span class="src s-k">김송희 관리방안</span> <span class="src s-a">Aside 추가</span> [링크]', '제안서 p23', '제안서', { p: 2, k: 0, a: 1 }]);
// 실제 값 — 보고서 글에서 (첫 보고서 요약·본문)
const rep15 = { date: '2026-10-15', summary: '쿠팡 7일 ROAS 221.8% · 메타 342% · OFF 0건', md: '쿠팡 ... ROAS 221.8%. 메타는 10/13 재개 후 10/14까지 ROAS 342%.\n- 자사몰 MER = 카페24 순매출 ÷ 메타 광고비' };
eq('실제 값: 글에서 메타 ROAS · MER 없음', A.actualOf(rep15, P), { meta_roas: 342, mall_mer: null, total_mer: null, date: '2026-10-15', how: { meta_roas: '보고서 글에서 읽음' } });
eq('실제 값: 보고서 숫자가 먼저', A.actualOf({ ...rep15, metrics: '{"meta_roas":301.5,"mall_mer":"402","total_mer":288}' }, P).how, { meta_roas: '보고서 숫자', mall_mer: '보고서 숫자', total_mer: '보고서 숫자' });
eq('실제 값: 합산 MER 글', A.actualOf({ date: 'd', md: '합산 MER 1,210% · 자사몰 MER: 415%' }).mall_mer + '|' + A.actualOf({ date: 'd', md: '합산 MER 1,210%' }).total_mer, '415|1210');
// 메타 판정 로그
eq('판정 말 · 기준', [A.verdictOf('예산 +20% 증액'), A.verdictOf('OFF'), A.verdictOf('보류(구매 6)'), A.verdictOf('유지 · 소재 교체'),
  A.expectVerdict({ purchases: 6, roas14: 500 }).v, A.expectVerdict({ purchases: 20, roas14: 360 }).v, A.expectVerdict({ purchases: 20, roas: 360 }).why, A.expectVerdict({ purchases: 20, roas14: 170 }).v, A.expectVerdict({ purchases: 20, roas14: 250 }).v, A.expectVerdict({ purchases: 20, roas14: 190 }).why],
  ['증액', '종료', '보류', '유지', '보류', '증액', '350%+ (2주 확인 필요)', '종료', '유지', '180~200% · 제안서 기준 없음']);
const jr = [{ date: '2026-10-16', judges: JSON.stringify([{ campaign: '① 신규', target: '위닝 6', roas14: 362, purchases: 31, verdict: '증액', reason: '2주 350%+' }, { campaign: '③ 테스트', target: 'T2', roas14: 150, purchases: 12, verdict: '유지', reason: '소재 교체' }]) },
  { date: '2026-10-23', md: '## 금요일 판정\n| 캠페인·세트 | ROAS 14일 | 구매 | 판정 | 근거 |\n|---|---|---|---|---|\n| T3 A1 | 410% | 8 | 보류 | 구매 10건 전 |\n\n| 매체 | ROAS |\n|---|---|\n| 쿠팡 | 200% |' }];
const JL = A.judgeLog(jr);
eq('판정 로그: 숫자 칸 + 본문 표 · 최신순 · 일치/다름', JL.rows.map((x) => [x.date, x.target, x.roas14, x.purchases, x.verdict, x.expect, x.match]),
  [['2026-10-23', 'T3 A1', 410, 8, '보류', '보류', '일치'], ['2026-10-16', '위닝 6', 362, 31, '증액', '증액', '일치'], ['2026-10-16', 'T2', 150, 12, '유지', '종료', '다름']]);
eq('판정 로그: 개수 · 다름', [JL.count, JL.diff], [{ 증액: 1, 유지: 1, 종료: 0, 보류: 1 }, 1]);
eq('판정 로그: 첫 보고서 = 없음', A.judgeLog([{ date: '2026-10-15', md: '| 매체 | 계정 |\n|---|---|\n| 쿠팡 | x |' }]).rows, []);

// 외주 운영 기간 (2026-10-15 사장님 "약 2개월간 다른 외주업체 이용 … 세팅등록한것을 분석만해서 데이터 쌓고 보고해. 매일, 매주 금요일마다 보고해")
// 외주 + 내부 관리 (2026-10-16 사장님 "광고 외주이용 종료 시 세팅한거 지금당장해도돼 … 민지님이 분석관리해서 나에게 보고하고 외주가 관리할때도 돌릴예정")
eq('외주 + 내부 관리 · 출처 배지 사장님 결정', [A.AD_MODE.mode, A.agencyOn(), A.AD_MODE.media, A.AD_MODE.manager, A.AD_MODE.reportTo, A.srcKind('사장님 결정'), A.srcTags('[사장님 결정]')], ['parallel', true, ['메타', '네이버', '쿠팡'], '김민지', '사장님', 'd', '<span class="src s-d">사장님 결정</span>']);
eq('광고 몫: 가을 = 끄거나 바꾸지 않음(Aside) · 실행 = 외주 + 김민지', ['gaeul'].map((k) => [/끄거나 바꾸지 않음/.test(A.AD_ROLES[k].does), /자동 OFF/.test(A.AD_ROLES[k].does), /외주업체/.test(A.AD_ROLES[k].exec), /김민지 관리/.test(A.AD_ROLES[k].exec)]), [[true, false, true, true]]);
eq('공통 규칙 = 외주 + 내부 관리 한 줄 (사장님 결정)', [A.RULES_DEFAULT.find((r) => r.k === 'outsourced').t.startsWith('외주 + 내부 관리'), A.RULES_DEFAULT.find((r) => r.k === 'outsourced').src], [true, '사장님 결정']);
const wk = [{ id: '2026-10-16', date: '2026-10-16' }, { id: '2026-10-16-weekly', date: '2026-10-16', kind: 'weekly' }, { id: '2026-10-17', date: '2026-10-17' }, { id: 'x주간', date: '2026-10-09' }];
eq('주간 보고서: 같은 날이면 주간 먼저 · id 에 주간도', [A.sortReports(wk).map((r) => r.id), A.isWeekly(wk[3])], [['2026-10-17', '2026-10-16-weekly', '2026-10-16', 'x주간'], true]);
const ch = [{ id: '2026-10-16', date: '2026-10-16', changes: JSON.stringify([{ media: 'meta', campaign: '① 신규', target: '세트A', what: '예산', before: '일 10만', after: '일 12만', note: '학습 끝' }, '쿠팡 B 캠페인 키워드 30개 추가']) },
  { id: '2026-10-16-weekly', date: '2026-10-16', kind: 'weekly', changes: '[{"what":"겹침"}]' }, { id: '2026-10-15', date: '2026-10-15', offs: '[{"media":"coupang","target":"방수 페인트","reason":"주문 0"}]' }];
const CL = A.changeLog(ch, '2026-10-16');
eq('변경 기록: 외주 변경 + 예전 Aside 끈 것 · 주간 보고서는 뺌', CL.rows.map((r) => [r.date, r.who, r.media, r.target, r.what]),
  [['2026-10-16', '외주', '메타', '세트A', '예산 · 일 10만 → 일 12만'], ['2026-10-16', '외주', '', '', '쿠팡 B 캠페인 키워드 30개 추가'], ['2026-10-15', 'Aside', '쿠팡', '방수 페인트', 'OFF']]);
eq('변경 기록: 이번 주 · 칸 있음', [CL.thisWeek, CL.has, A.changeLog([{ date: '2026-10-15', offs: '[]' }], '2026-10-15').has], [3, true, false]);
{ const t = A.asideAdsText();
  eq('Aside 지시문: 운영 기준 = 김송희 관리방안 · 규칙 줄 · 판 10-16', [t.includes('운영 기준: 김송희 관리방안'), t.includes('- [김송희 관리방안] 메타: 테스트 캠페인 ROAS 300%'), t.includes('3 김송희 관리방안과 다른 점'), t.includes('외주 판정 vs 김송희 관리방안'), A.ASIDE_ADS_VER], [true, true, true, true, '2026-10-16']);
  eq('Aside 지시문(외주 + 내부 관리): 바꿀 안 칸 · 김민지가 정해 직접/외주에 · 전할 말도 김민지 · 주간 = 배운 것·다음 주 바꿀 안 · 그래도 안 바꿈', [t.startsWith('[광고 외주 + 내부 관리 · 분석·바꿀 안]'), t.includes('4 바꿀 안(번호 · 무엇을 · 근거 숫자 · 직접 또는 외주에 — 김민지가 정함) / 5 외주에 전할 말'), t.includes('바꿀 것은 김민지가 정해 직접 바꾸거나 외주에 전한다 (예산은 본부장 승인)'), t.includes('"외주에 전할 말"에 적고 김민지가 보낸다'), t.includes('이번 주 배운 것 · 다음 주 바꿀 안 (김민지가 금 16:30 사장님께 보고할 때 씀)'), t.includes('광고를 끄거나 켜지 않는다')], [true, true, true, true, true, true]);
  const M0 = { mode: A.AD_MODE.mode, label: A.AD_MODE.label }; Object.assign(A.AD_MODE, { mode: 'outsourced', label: '외주 운영 기간 · 분석·보고만' });
  try { const t0 = A.asideAdsText(); eq('(되돌리면) 외주 운영 기간 지시문 = 분석·보고만 · 바꿀 안 없음 · 담당이 보냄', [t0.startsWith('[광고 외주 운영 기간 · 분석·보고만]'), t0.includes('바꿀 안'), t0.includes('"외주에 전할 말"에 적고 담당이 보낸다'), A.agencyOn()], [true, false, true, true]); }
  finally { Object.assign(A.AD_MODE, M0); }
  const L = A.asideAdsLaunch();
  eq('예약 글(짧게 · 한 번만): ads.html#aside 화면 지시문을 그대로 · 안 바꿈', [L.length < 600, L.includes(`${A.HUB_ADS}#aside`), L.includes('그대로 따른다'), L.includes('광고를 끄거나 바꾸지 않는다'), L.split('\n')[0]], [true, true, true, true, '[광고 보고서 · Aside] 평일 08:30 일일 · 금 16:00 주간 (금요일 16:00 예약은 주간)']);
  eq('Aside 지시문: 끄지 않음 · 일일·주간 · 칸 이름 · 제안서 문서 갱신', [t.includes('광고를 끄거나 켜지 않는다'), t.includes('pour-os/v2/adreports/{YYYY-MM-DD}'), t.includes('-weekly · kind: "weekly"'), ['metrics(JSON 글)', 'changes(JSON 글)', 'judges(JSON 글)', 'offs: "[]"'].every((k) => t.includes(k)), t.includes('pour-os/v2/proposal/dailygrowth-202610')], [true, true, true, true, true]); }

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
