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
// 광고 AI팀 = B2C 크루 6명 (가을 = 쿠팡·네이버 · 겨울 = 메타 판정 · 여름 = 메타 소재 · 하늘 = 오퍼 · 우주 = 리타겟팅 · 봄 = 오늘의집)
eq('광고 몫 = B2C 크루 6명 모두', K.CREWS.find((c) => c.id === 'b2c').members.map((m) => [m.name, (A.AD_ROLES[m.id] || {}).ad]),
  [['봄', '오늘의집 광고'], ['여름', '메타 소재'], ['가을', '쿠팡·네이버 검색광고'], ['겨울', '메타 판정'], ['하늘', '오퍼'], ['우주', '리타겟팅']]);
// 가을·겨울 보드의 광고 할 일 F = 08:30 광고 루틴 (보고서 화면 링크)
eq('보드 F = 광고 일일 보고서', ['gh-traffic', 'gh-conv'].map((id) => { const a = K.actOf(id, 'F'); return [a.when, a.report]; }), [['매일 08:30', 'ads'], ['매일 08:30 · 금 16:00', 'ads']]);

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
