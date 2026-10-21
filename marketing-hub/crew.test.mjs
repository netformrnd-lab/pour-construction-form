// node marketing-hub/crew.test.mjs — AI 크루·보드 정의 · Aside 붙여 넣기 읽기 · 승인 요청 모양 시험 (Firebase 안 씀)
import { createRequire } from 'node:module';
import * as K from './crew.js';
import { AD_MODE, AUTO_OFF } from './adops.js';   // 외주 + 내부 관리 ↔ 예전 외주 기간 되돌려 보기 (2026-10-16) · 규칙 안 끄기 (2026-10-19)
const C = createRequire(import.meta.url)('./core.js');
// ⏸ 자동화 멈춤 (2026-10-21) — 멈춘 동안의 지시문 = 멈춤 한 장 · 아래 시험은 예전(켜진) 동작을 봄
{ const b0 = K.BOARDS['gh-conv'], t0 = K.asideText(b0);
  if (!(K.PAUSE.on && /\[멈춤\]/.test(t0) && /아무것도 만들거나 올리지 말고/.test(t0) && !/지시문 판/.test(t0))) { console.error('✗ 멈춤 지시문', t0.slice(0, 120)); process.exitCode = 1; } else console.log('✓ 멈춤: 지시문 = 멈춤 한 장 (아무것도 안 함)');
  K.PAUSE.on = ''; }
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('✗', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('✓', name); };

// 원형 17명 = 마케팅 허브 TEAM 과 같음 (id · 이름 · 역할)
eq('원형 = 허브 TEAM', K.BASE_TEAM.map((m) => [m.id, m.name, m.role]), C.TEAM.map((m) => [m.id, m.name, m.role]));
const ids = K.allMates().map((m) => m.id);
eq('AI 팀원 id 겹침 없음', ids.length, new Set(ids).size);
eq('크루 3개 · 사람 수 (B2C 6 + 2026-10-17 이음·별·달 + 바람)', K.CREWS.map((c) => [c.id, c.members.length]), [['b2c', 10], ['b2b', 5], ['bd', 6]]);
// 2026-10-17 사장님 "유입, 전환, 재구매, 매출, 지인추천 aarrr형태로 가는게 맞는거같은데 유입을 위해 노출하는거고" — B2C 크루만 (B2B·바라스데이는 그대로)
eq('B2C 공식 = AARRR 흐름 · 순서대로 한 칸씩 · 유입 = 여름(바이럴·콘텐츠) + 가을(퍼포먼스) · 매출 = 하늘 + 봄(MD 볼륨 · 2026-10-17 사장님 정의)', [K.CREWS[0].formula, K.CREWS[0].flow, K.CREWS[0].members.map((m) => m.name + ':' + m.slot), K.CREWS[1].formula, K.CREWS[1].flow, K.CREWS[2].formula],
  [['유입', '전환', '재구매', '매출', '지인추천'], 'AARRR', ['여름:유입', '가을:유입', '겨울:전환', '우주:재구매', '하늘:매출', '봄:매출', '바람:지인추천', '이음:운영', '별:공통 숫자', '달:전략'], ['노출', '문의', '계약', '건당 금액', '재주문'], undefined, ['노출', '유입', '전환', '객단가', '재구매']]);
eq('공식 칸마다 맡은 사람 있음', K.CREWS[0].formula.map((f) => K.CREWS[0].members.filter((m) => m.slot === f).map((m) => m.name).join('·')), ['여름·가을', '겨울', '우주', '하늘·봄', '바람']);
// 단계 미션 (2026-10-17 사장님 AARRR 정의) — 공식 칸마다 미션 하나 · 크루원은 자기 칸 미션 · 단계 밖(운영·전략·B2B)은 없음 · Aside 지시문 맨 앞쪽에
eq('단계 미션 = 공식 칸마다 · 사장님 말', [Object.keys(K.CREWS[0].stages), ['yeoreum', 'gyeoul', 'uju', 'haneul', 'bom', 'baram'].map((id) => K.stageOf(id).goal), ['ieum', 'dal', 'kkomkkom', 'bosong'].map((id) => K.stageOf(id)),
  /A\/B 테스트/.test(K.stageOf('gaeul').mission) && /롱테일/.test(K.stageOf('gaeul').mission), /오프라인/.test(K.stageOf('gyeoul').mission) && /응대 스토리/.test(K.stageOf('gyeoul').mission), /원가는 AI·팀원이 보지 않음/.test(K.stageOf('haneul').mission)],
  [['유입', '전환', '재구매', '매출', '지인추천'], ['노출 → 들어오게', '첫 구매', '다시 · 오래', '볼륨 · 효율', '볼륨 · 효율', '팬 → 추천'], [null, null, null, null], true, true, true]);
eq('Aside 지시문 = 단계 미션 한 줄 (운영 보드엔 없음)', [K.asideText(K.boardOf('gh-exp')).includes('■ 단계 미션 — 유입 (사장님 정의): 바이럴·퍼포먼스·콘텐츠'), K.asideText(K.boardOf('gh-ohou')).includes('■ 단계 미션 — 매출'), K.asideText(K.boardOf('ops-order')).includes('■ 단계 미션')], [true, true, false]);
// 옮긴 할 일 (MOVED) — 옛 글자는 그 보드에서 비고(다시 안 씀) · 새 자리에 있음 · 제목 그대로(가을 F 는 겨울 F 를 합침)
{
  const bad = Object.entries(K.MOVED).filter(([k, v]) => { const [fm, fc] = k.split('.'), [tm, tc] = v.split('.'); return K.actOf(K.mateOf(fm).board, fc) || !K.actOf(K.mateOf(tm).board, tc); });
  eq('옮긴 할 일: 옛 글자 비움 · 새 자리 있음', bad, []);
  const B = (await import('node:fs')).readFileSync(new URL('./crew.js', import.meta.url), 'utf8');
  eq('옮긴 할 일 13개 · 나간 것/들어온 것', [Object.keys(K.MOVED).length, K.movedOut('uju').map((x) => `${x.c}→${x.name} ${x.to.c}`), K.movedIn('bom').map((x) => `${x.c}←${x.name} ${x.from.c}`), K.movedTo('yeoreum', 'C'), K.movedTo('yeoreum', 'A')],
    [13, ['D→바람 B', 'E→봄 H', 'F→바람 C'], ['F←가을 C', 'G←겨울 D', 'H←우주 E'], { mate: 'gaeul', c: 'G' }, null]);
  eq('2026-10-17 사장님 정의: 재고 = 이음 F (겨울 A · 별 B 합침) · 리뷰 = 바람 D (겨울 E)', [K.movedOut('gyeoul').map((x) => `${x.c}→${x.name} ${x.to.c}`), K.movedIn('ieum').map((x) => `${x.c}←${x.name} ${x.from.c}`), K.actOf('gh-ref', 'D').t, K.actOf('gh-conv', 'E'), K.actOf('ops-report', 'B')],
    [['A→이음 F', 'D→봄 G', 'E→바람 D', 'F→가을 F'], ['F←겨울 A', 'F←별 B'], '리뷰 정리 + 진짜 포토리뷰 확보', null, null]);
  eq('옮긴 할 일 제목 그대로 (메타 · 디맨드젠 · 오늘의집 광고 · 쿠팡 리스팅 · 리셀러 · 시즌 캠페인 · 사진 후기 · NPS · 신제품 후보)', ['gaeul.G', 'gaeul.H', 'gaeul.I', 'bom.F', 'bom.G', 'bom.H', 'baram.B', 'baram.C', 'dal.G'].map((x) => { const [m, c] = x.split('.'); return K.actOf(K.mateOf(m).board, c).t.slice(0, 8); }),
    ['메타 광고 재가', '구글 디맨드젠 ', '오늘의집 광고(', '쿠팡 중복 리스', '리셀러·아이템위', '시즌 캠페인 캘', '사진 후기 → ', 'NPS 유선 만', '신제품 후보 상']);
  eq('광고 = 가을 한 명 (매체가 있는 할 일 · 광고 보고)', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.adMedia || a.report === 'ads' || /광고\(오하우스애즈\)/.test(a.t)).map((a) => b.mate + a.c)), ['gaeulD', 'gaeulE', 'gaeulF', 'gaeulG', 'gaeulH', 'gaeulI']);
  eq('옛 글자로 붙여 넣으면 = 안 올리고 어디로 갔는지', [K.parseCrew('[C]\n요약: 메타\n캠페인\t지출\n가\t1', K.boardOf('gh-exp')).warn, Object.keys(K.parseCrew('[C]\n요약: x\n가\t나\n1\t2', K.boardOf('gh-exp')).acts), K.parseCrew('[Z]', K.boardOf('gh-exp')).warn, K.parseCrew('[X]\n요약: 없는 글자\n가\t나\n1\t2', K.boardOf('gh-rep')).warn],
    [['C 는 가을 G 로 옮긴 할 일이라 여기서 올리지 않아요 — 화면 지시문을 새로 받아 주세요'], [], [], []]);
}
eq('B2C 크루 = 그로홈 + POUR스토어 B2C', K.servesL(K.crewOf('gyeoul')), '그로홈 B2C · POUR스토어 B2C');
eq('B2B 크루 = POUR스토어 B2B', K.servesL(K.crewOf('kkomkkom')), 'POUR스토어 B2B');
eq('바라스데이 크루', K.mateBrands('bosong'), ['bmupq52c0']);
eq('원형은 크루 없음', [K.crewOf('pori'), K.mateBrands('pori')], [null, []]);
eq('파생 원형은 있는 AI', K.CREWS.flatMap((c) => c.members.flatMap((m) => m.from || [])).every((f) => K.BASE_TEAM.some((b) => b.id === f)), true);

// 보드 — 크루 사람과 짝 · 행동 A~ (2026-10-15 F = 광고 일일 보고서 · 2026-10-17 AARRR 정리로 가을 F 하나)
eq('보드 15개 · 짝 (그로홈 6 + 2026-10-17 바람 · 이음·별·달 + B2B 5)', Object.values(K.BOARDS).map((b) => [b.id, b.mate, K.mateOf(b.mate).name]), [['gh-ohou', 'bom', '봄'], ['gh-exp', 'yeoreum', '여름'], ['gh-traffic', 'gaeul', '가을'], ['gh-conv', 'gyeoul', '겨울'], ['gh-aov', 'haneul', '하늘'], ['gh-rep', 'uju', '우주'], ['gh-ref', 'baram', '바람'],
  ['ops-order', 'ieum', '이음'], ['ops-report', 'byeol', '별'], ['hq-plan', 'dal', '달'], ['b2b-exp', 'dandan', '단단'], ['b2b-inq', 'cheokcheok', '척척'], ['b2b-deal', 'kkomkkom', '꼼꼼'], ['b2b-aov', 'deundeun', '든든'], ['b2b-re', 'teunteun', '튼튼']]);
eq('크루 사람 board = 보드 id (B2C 10 · B2B 5 · 바라스데이 아직 없음)', K.CREWS.map((c) => c.members.map((m) => (m.board ? K.boardOf(m.board).mate === m.id : '-')).join('')), ['true'.repeat(10), 'truetruetruetruetrue', '------']);
eq('할 일 글자 (2026-10-17 AARRR 정리 · 옮긴 옛 글자는 비움: 봄 A · 여름 C·E·F · 가을 C · 겨울 A·D·E·F · 우주 D·E·F · 별 B · 새 J·H·I·G·F·E)', Object.values(K.BOARDS).map((b) => b.actions.map((a) => a.c).join('')), ['BCDEFGHI', 'ABDGHIJ', 'ABDEFGHIJ', 'BCGHI', 'ABCDEF', 'ABCGH', 'ABCDE', 'ABCDEF', 'ACD', 'ABCDEFG', 'ABC', 'ABC', 'A', 'A', 'AB']);
eq('새 할 일 10개 (2026-10-17 사장님 AARRR 정의 · A/B 실험 · 구매 길 · 응대 스토리 · 구매 후 케어 · 메시지 장부 · 품질·서비스 · 팬 후기 · 재고 한 곳) = 실행 한 줄 있음', ['gh-exp J', 'gh-traffic J', 'gh-conv H', 'gh-conv I', 'gh-rep G', 'gh-rep H', 'gh-aov F', 'gh-ref E', 'ops-order F'].map((x) => { const [b, c] = x.split(' '); return !!K.execOf(K.actOf(b, c)); }), [true, true, true, true, true, true, true, true, true]);
eq('재고 = 이음 한 곳 (비즈로지컴·쿠팡 로켓그로스) · POUR스토어 CRM 재고는 안 봄', [Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => !a.admin && a.s.some((s) => /가용재고|판매가능/.test(s))).map((a) => b.id + a.c)), Object.values(K.BOARDS).filter((b) => JSON.stringify(b).match(/CRM 재고|재고 발주 계산기/)).map((b) => b.id), Object.values(K.BOARDS).filter((b) => (b.logins || []).some((l) => /로켓그로스 재고/.test(l.w))).map((b) => b.id), K.actOf('gh-traffic', 'B').t],
  [['ops-orderF', 'ops-reportA'], [], ['ops-order', 'ops-report'], '롤러일체형 재노출 + 네이버 검색 유입 복구']);
eq('숫자 주인 하나 (사진 후기 = 바람 · 재구매 매출 비중 = 우주 · 품절 = 이음)', [Object.values(K.BOARDS).flatMap((b) => b.metrics.filter((m) => /포토리뷰|사진 후기/.test(m.l)).map((m) => b.id + ' ' + m.k)), Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => /재구매 매출 비중/.test(a.k || '')).map((a) => b.id + a.c)), Object.values(K.BOARDS).flatMap((b) => b.metrics.filter((m) => /품절/.test(m.l)).map((m) => b.id + ' ' + m.k))],
  [['gh-ref photo2'], [], ['ops-order soldout', 'ops-report risk_stock']]);   // 별 risk_stock = 금요일 공통 숫자 칸 (이음 F 결과에서 셈)
eq('기존 고객 메시지는 우주 H 장부 먼저 (우주 C·G · 봄 H)', [/H 장부/.test(K.actOf('gh-rep', 'C').s.join(' ')), /H 장부/.test(K.actOf('gh-rep', 'G').s.join(' ')), /우주 H 장부/.test(K.actOf('gh-ohou', 'H').s.join(' '))], [true, true, true]);
eq('새 할 일 6개 (2026-10-17 볼트 짝 설계표 B + 바람 A 추천 쿠폰) = 실행 한 줄 있음', ['gh-exp G', 'gh-exp H', 'gh-exp I', 'gh-conv G', 'gh-ref C', 'gh-ref A'].map((x) => { const [b, c] = x.split(' '); return !!K.execOf(K.actOf(b, c)); }), [true, true, true, true, true, true]);
eq("두 브랜드 할 일 = '브랜드' 칸 (반복 실행 KPI 가 그 줄 브랜드로 셈)", Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.cols.includes('브랜드')).map((a) => b.id + a.c)), ['gh-ohouI', 'gh-expA', 'gh-expG', 'gh-expJ', 'gh-trafficB', 'gh-trafficE', 'gh-trafficG', 'gh-trafficJ', 'gh-convC', 'gh-convH', 'gh-aovF', 'gh-refA', 'gh-refE']);
eq('보고서: B2B 크루 · 이음 · 달 빼고 · 별 = 맨 위 공통 숫자', [K.CREWS.find((c) => c.id === 'b2b').noReport, ['ieum', 'byeol', 'dal'].map((id) => [!!K.mateOf(id).noReport, !!K.mateOf(id).common])], [true, [[true, false], [false, true], [true, false]]]);
// 개인정보 칸 없음 · 새 보드는 주문번호·CRM 상담 링크만 (2026-10-17)
eq('표 칸에 이름·전화·연락처 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.flatMap((a) => a.cols.filter((c) => /연락처|전화번호|휴대폰|성함|고객명|이메일/.test(c)).map((c) => b.id + a.c + ' ' + c))), []);
eq('새 보드 지시 = 이름·전화번호를 표에 안 씀 (주문번호·CRM 상담 링크만)', ['ops-order', 'b2b-inq', 'b2b-re', 'gh-ref'].map((id) => /표에 쓰지 않|표엔 주문번호만|CRM 상담 링크만/.test(K.asideText(K.boardOf(id)))), [true, true, true, true]);
eq('달 = 원가·공급가·제조사 이름·단가 안 봄 (보드 글) · AI 할 일 단계엔 그 말 자체가 없음 · 관리자 자리 G(신제품 후보 · 2026-10-17 여름 E 에서 옮김)는 Aside 지시문에 안 들어감', [K.boardOf('hq-plan').desc.includes('원가·공급가·제조사 이름·단가는 AI 가 보지 않는다'), K.boardOf('hq-plan').actions.filter((a) => !a.admin).every((a) => a.s.every((x) => !/원가|공급\s*단가|공급가|매입|제조사/.test(x))), /알리바바|신제품 후보 상시/.test(K.asideText(K.boardOf('hq-plan')))], [true, true, false]);
eq('F = 광고 일일 보고서(report ads) 하나 = 가을 F (겨울 F 를 합침 · 2026-10-17)', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.report === 'ads').map((a) => b.id + a.c)), ['gh-trafficF']);
// 원가·마진·제조사·공급 단가 칸 없음 (관리자 자리 행동의 하는 일 글은 그대로 · 화면엔 안 보임)
const leak = [];
Object.values(K.BOARDS).forEach((b) => b.actions.forEach((a) => { a.cols.forEach((c) => K.SECRET_RE.test(c) && leak.push(b.id + a.c + ' 칸 ' + c));
  if (a.card) JSON.stringify(a.card).match(K.SECRET_RE) && leak.push(b.id + a.c + ' 카드');
  if (!a.admin) a.s.forEach((s) => /원가|공급\s*단가|공급가|매입|제조사/.test(s) && leak.push(b.id + a.c + ' ' + s)); }));
eq('원가·제조사·공급 단가 없음', leak, []);
eq('관리자 자리 행동 = 달 G(신제품 후보 · 여름 E 에서 옮김) 하나', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.admin).map((a) => b.id + a.c)), ['hq-planG']);
// 실행은 사람: '승인…' 단계는 담당·사람이 함 · 실행 한 줄도 담당 (광고 F = 외주 운영 기간 · 실행은 외주업체 · 외주에 전할 말은 담당 — 2026-10-15 사장님)
const auto = [];
Object.values(K.BOARDS).forEach((b) => b.actions.forEach((a) => { a.s.filter((s) => /^승인/.test(s)).forEach((s) => !/담당|사람/.test(s) && auto.push(b.id + a.c + ' ' + s));
  if (a.exec && !(a.report === 'ads' ? /담당|본부장/ : /담당/).test(a.exec)) auto.push(b.id + a.c + ' exec ' + a.exec);
  if (/직접\s*(반영|게시|발송|등록)/.test(a.s.join(' '))) auto.push(b.id + a.c + ' 직접'); }));
eq('승인 뒤 실행 = 담당(사람)', auto, []);
eq('실행 한 줄 있는 행동 수', Object.values(K.BOARDS).reduce((s, b) => s + b.actions.filter((a) => a.exec).length, 0), 66);   // 30 + 새 할 일 5 + 새 보드 24 (2026-10-17) · AARRR 정리 = 겨울 F 합침 −1 · 바람 A +1 · 사장님 정의 = 새 9 · 겨울 A·별 B → 이음 F 하나 −1 · 겨울 E → 바람 D 0   // 실행 없는 것 = 유입 A(감시·보고) · 재구매 A(측정) · 달 G(관리자 자리)

// 2026-10-17 · 주 1~2회 보드 지시문 · 할 일 G~I 읽기 · 하루에 한 번 더(이음 A)
{
  const td = K.asideText(K.boardOf('hq-plan'));
  eq('주 1회 보드 지시문 = 그 요일 · 이음 머리 = 브랜드 없음', [td.includes('언제: 매주 월 하루 한 번'), td.includes('이 루틴은 매주 월 하루 한 번 돈다'), K.asideText(K.boardOf('ops-order')).split('\n')[0], K.asideLaunch(K.boardOf('b2b-exp'), '10:00').split('\n')[0]],
    [true, true, '[AI 크루 · 이음 (주문·배송·재고 매니저) · 주문·배송·재고 보드] 지시문 판 ' + K.ASIDE_VER, '[AI 크루 · 단단 (B2B 노출마케터) · POUR스토어 B2B 노출 보드] 매주 월·목 10:00']);
  const te = K.asideText(K.boardOf('gh-exp'));
  eq("'브랜드' 칸 할 일엔 칸 뜻 한 줄 · 없는 할 일엔 없음", [(te.match(/'브랜드' 칸 = 그로홈 · POUR스토어 중 하나/g) || []).length, K.asideText(K.boardOf('gh-rep')).includes("'브랜드' 칸 =")], [3, false]);
  const pg = K.parseCrew(['[상태]', 'G: 회수 3명', 'I: 월요일 글 3개', '[G]', '요약: 리뷰 회수 2', '인플루언서\t브랜드\t채널\t게시물·리뷰 링크', '살림하는A\t그로홈\t인스타\thttps://x/1', '집수리B\tPOUR스토어\t블로그\thttps://x/2', '[H]', '글 제목\t채널\t글 주소', '옥상 방수 셀프\t블로그\thttps://blog/1'].join('\n'), K.boardOf('gh-exp'));
  eq('할 일 G~I 읽기 · 번호 G1·G2 · 상태 G·I', [pg.status, Object.keys(pg.acts), pg.acts.G.items.map((x) => x.n + ':' + x.c['브랜드']), pg.acts.H.items[0].n], [{ G: '회수 3명', I: '월요일 글 3개' }, ['G', 'H'], ['G1:그로홈', 'G2:POUR스토어'], 'H1']);
  eq('하루에 한 번 더 = 이음 A (now)', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.now).map((a) => b.id + a.c)), ['ops-orderA']);
}

// 숫자 보기
const m1 = K.boardOf('gh-traffic').metrics[0];   // 4채널 노출 (2026-10-17 여름 → 가을)
eq('만 단위', K.fmtMetric(m1, 6185000), '618.5만');
eq('원 · %', [K.fmtMetric({ u: '원' }, 23209), K.fmtMetric({ u: '원' }, 262900), K.fmtMetric({ u: '원' }, 30000000), K.fmtMetric({ u: '%' }, 7.6)], ['23,209원', '262,900원', '3,000만 원', '7.6%']);
eq('목표까지 (오르는 지표)', K.metricPct({ base: 2.12, target: 3, dir: 'up' }, 2.56), 0.5);
eq('목표까지 (줄이는 지표)', K.metricPct({ base: 85, target: 75, dir: 'down' }, 80), 0.5);
eq('기준값 없으면 목표 대비', K.metricPct({ base: null, target: 60, dir: 'up' }, 30), 0.5);
eq('목표 넘음', [K.metricOk({ target: 0, dir: 'down' }, 0), K.metricOk({ target: 7, dir: 'up' }, 6.9)], [true, false]);
eq('숫자 읽기', [K.toNum('7.4%'), K.toNum('1,288만 원'), K.toNum('2억'), K.toNum('-')], [7.4, 12880000, 200000000, null]);

// Aside 붙여 넣기
const txt = ['[지표]', 'ord_miss\t0', '오늘 CS 건수: 4', '없는지표 3', '품절 상품 수 1', '[상태]', 'F: 롤러 재입고 대기', 'B. 안내 누락 3건',
  '[F]', '요약: 품절 1개 · 발주 초안 1건', '상품\t채널\t가용재고\t7일 판매\t소진 예상일\t할 일\t마진\t피그마 파일 받기 (SVG)', '롤러일체형\t스마트스토어\t0\t52\t품절\t고객 010-1234-5678 연락\t30%\thttp://x',
  '롤러 미니\t쿠팡\t340\t70\t11/15\t발주 초안', '[E 알리바바 제조사]', '제조사\t단가', 'X\t1',
  '[B]', '| 번호 | 항목 | 내용 | 근거 |', '|---|---|---|---|', '| B3 | 1+1 | 19,900원 | 경쟁 11,000원 |', '설명 한 줄 a@b.com', '[완료]', 'F1'].join('\n');
const p = K.parseCrew(txt, K.boardOf('ops-order'));   // 2026-10-17 품절 표 = 이음 F (겨울 A 에서 옮김)
eq('지표 읽기', p.metrics.map((x) => [x.k, x.v]), [['ord_miss', 0], ['cs_today', 4], ['soldout', 1]]);
eq('모르는 지표', p.unknown, ['없는지표']);
eq('상태', p.status, { F: '롤러 재입고 대기', B: '안내 누락 3건' });
eq('F 칸 = 마진·피그마 뺌', [p.acts.F.cols, p.acts.F.dropped], [['상품', '채널', '가용재고', '7일 판매', '소진 예상일', '할 일'], ['마진', '피그마 파일 받기 (SVG)']]);
eq('F 번호 · 연락처 가림', p.acts.F.items.map((x) => [x.n, x.c['할 일']]), [['F1', '고객 010-****-**** 연락'], ['F2', '발주 초안']]);
eq('F 요약', p.acts.F.sum, '품절 1개 · 발주 초안 1건');
eq('제조사 표 뺌 · 경고', [!!p.acts.E, p.warn.some((w) => /제조사/.test(w))], [false, true]);
eq('B 마크다운 표 · 번호 칸 · 설명 메일 가림', [p.acts.B.cols, p.acts.B.items, p.acts.B.body], [['항목', '내용', '근거'], [{ n: 'B3', c: { 항목: '1+1', 내용: '19,900원', 근거: '경쟁 11,000원' } }], ['설명 한 줄 (메일 가림)']]);
eq('완료는 읽기만', p.done, 'F1');
eq('옛 글자(겨울 A 품절)로 붙여 넣으면 = 안 올리고 이음 F 로 갔다고', [K.parseCrew('[A]\n요약: 품절\n상품\t채널\n롤러\t쿠팡', K.boardOf('gh-conv')).warn, Object.keys(K.parseCrew('[A]\n요약: 품절\n상품\t채널\n롤러\t쿠팡', K.boardOf('gh-conv')).acts)], [['A 는 이음 F 로 옮긴 할 일이라 여기서 올리지 않아요 — 화면 지시문을 새로 받아 주세요'], []]);
const pe = K.parseCrew('[G]\n후보\t공급 단가\nA\t1\n[A]\n신제품\t고객 문제\n김\t안녕하세요', K.boardOf('hq-plan'));
eq('달 G(관리자 자리) 안 올림', [Object.keys(pe.acts), pe.warn.some((w) => /관리자 자리/.test(w))], [['A'], true]);

// 승인 요청 문서
const asks = K.asksFromParse(p, { board: 'ops-order', mate: 'ieum', brand: '', run: '2026-10-12', at: '2026-10-12T00:00:00.000Z', owner: 'u1', src: 'crew' });
eq('행동마다 하나', asks.map((a) => a.id).sort(), ['ai_ieum_20261012_opsorderB', 'ai_ieum_20261012_opsorderF']);
const a0 = asks.find((a) => a.act === 'F');
eq('처음 = 담당 차례', [a0.state, a0.to, a0.owner, a0.step, a0.ver, a0.pick, a0.path], ['wait', 'u1', 'u1', 0, 1, null, []]);
eq('누가 · 어디', [a0.crew, a0.mate, a0.mateName, a0.brand, a0.board, a0.act, a0.log[0].by, a0.log[0].byName], ['b2c', 'ieum', '이음', '', 'ops-order', 'F', 'ai:ieum', '이음 (AI)']);
eq('제목 · 실행 한 줄', [a0.title, a0.exec], ['주문·배송·재고 보드 F · 재고·품절 확인 (비즈로지컴·쿠팡 로켓그로스) + 발주·입고 제안', '승인되면 담당이 비즈로지컴 입고·쿠팡 로켓그로스 입고 요청을 진행하고, 품절 상품 상세에 재입고 알림을 넣은 뒤 [했어요]에 남긴다 — 승인된 품절·위험 줄은 가을(광고)·겨울(상세)·봄(프로모션) AI 지시문 \'넘겨받은 것\'에 자동으로 들어간다']);
eq('담당 없으면 to 빈칸(관리자 누구나)', K.askDoc({ id: 'x', mate: 'pori', title: 't' }).to, '');
eq('개인정보 가림(요약·글)', K.askDoc({ id: 'x', mate: 'pori', title: 't', sum: '010 1234 5678', body: 'q@w.kr' }).sum + '|' + K.askDoc({ id: 'x', mate: 'pori', title: 't', body: 'q@w.kr' }).body, '010-****-****|(메일 가림)');
eq('다시 올리기 가능', [K.canRedo({ state: 'back' }), K.canRedo({ state: 'wait', step: 0 }), K.canRedo({ state: 'wait', step: 1 }), K.canRedo({ state: 'ok' }), K.canRedo(null)], [true, true, false, false, false]);
const rf = K.redoFields({ ...a0, state: 'back', back: { text: '근거 더' }, ver: 1 }, { title: '새 제목', items: [{ n: 'F1', c: {} }], at: 'T' }, 'u2');
eq('다시 올림 = 담당 차례 · 2번째', [rf.state, rf.to, rf.owner, rf.step, rf.ver, rf.back, rf.pick, rf.title, rf.updatedAt], ['wait', 'u2', 'u2', 0, 2, null, null, '새 제목', 'T']);
eq('담당 = 브랜드별 → 기본', [K.ownerFor({ owners: { grohome: 'a', _: 'b' } }, 'grohome'), K.ownerFor({ owners: { grohome: 'a', _: 'b' } }, 'pourstore'), K.ownerFor(null, 'x')], ['a', 'b', '']);
eq('Aside 지시문에 관리자 자리 행동 없음', /\[G\]/.test(K.asideText(K.boardOf('hq-plan'))), false);
eq('Aside 지시문에 지표 키', K.asideText(K.boardOf('gh-conv')).includes('cv_mall\t'), true);

// Aside 루틴 (2026-10-14 사장님 "모든 크루들의 행위들 모두 가능하게 세팅해줘") — 보드 하나 = 예약 작업 하나 · 평일
// 2026-10-15 "사람 담당자들 모두 어사이드 돌릴 수 있어. 각각 돌려서 빨리" → 담당마다 자기 PC · 담당이 다르면 동시에 09:00 · 같은 PC 여럿이면 한 시간씩
const AB = K.asideBoards();
eq('Aside 루틴 10개 · 같은 PC 안 순서(가을 → 겨울 → 봄 → 여름 → 우주 → 바람 → 하늘 → 운영·전략) · 바라는 시각·요일 · B2B 는 닫음(2026-10-17)', AB.map((b) => [K.mateOf(b.mate).name, K.runWord(b.run)]), [['가을', '평일 09:00'], ['겨울', '평일 09:00'], ['봄', '평일 09:00'], ['여름', '평일 09:00'], ['우주', '평일 09:00'], ['바람', '평일 09:00'], ['하늘', '평일 09:00'],
  ['이음', '평일 15:00'], ['별', '매주 금 09:00'], ['달', '매주 월 09:00']]);
eq('허브 자동 작업(core.js CREW_ASIDE · 닫힌 크루 빼고) = crew.js 보드 시각·요일·이름', C.CREW_ASIDE.filter((c) => !c.closed).map((c) => [c.board, c.mate, c.name, c.t, (c.dow || [1, 2, 3, 4, 5]).join()]).sort(), AB.map((b) => [b.id, b.mate, K.mateOf(b.mate).name, b.run.t, b.run.dow.join()]).sort());
eq('허브 자동 작업 10개 = Aside (담당 PC) · 멈춤(2026-10-21 · 예전 준비 중) · 보드 요일·시각', C.automations().filter((a) => /^aside-crew-/.test(a.id)).map((a) => [C.AUTO_WHERE[a.where], C.autoWord(a), a.status]), AB.map((b) => ['Aside (담당 PC)', C.autoWord({ run: b.run }), C.AUTO_PAUSED ? 'stop' : 'wait']));
{
  const own = { 'gh-conv': 'sy', 'gh-rep': 'sy', 'gh-ohou': 'yj' }, plan = K.asidePlan((b) => own[b.id] || '');
  const gh = (g) => g.runs.filter((r) => /^gh-/.test(r.board.id)).map((r) => r.t + ' ' + r.board.id);
  eq('담당별 PC 계획: 다른 담당 = 동시에 · 같은 PC = 한 시간씩 · 미정 = 관리자 PC 한 곳(맨 뒤) — 그로홈 6개 + 바람', plan.map((g) => [g.owner, gh(g)]),
    [['sy', ['09:00 gh-conv', '10:00 gh-rep']], ['yj', ['09:00 gh-ohou']], ['', ['09:00 gh-traffic', '10:00 gh-exp', '11:00 gh-ref', '12:00 gh-aov']]]);
  eq('담당 미정 PC 한 곳 = 같은 요일에 겹칠 때만 뒤로 (주 1회 보드는 비는 시각에 · 주문·배송은 15:00 그대로)', plan[2].runs.map((r) => r.t + ' ' + r.board.id),
    ['09:00 gh-traffic', '10:00 gh-exp', '11:00 gh-ref', '12:00 gh-aov', '13:00 ops-report', '13:00 hq-plan', '15:00 ops-order']);
  eq('담당이 모두 다르면 = 보드마다 바라는 시각 (그로홈 7개 09:00)', K.asidePlan((b) => 'u_' + b.id).flatMap((g) => g.runs.map((r) => r.t)), ['09:00', '09:00', '09:00', '09:00', '09:00', '09:00', '09:00', '15:00', '09:00', '09:00']);
  eq('보드 하나의 PC·시각', [K.planOf(plan, 'gh-rep'), K.planOf(plan, 'gh-aov'), K.planOf(plan, 'x')], [{ owner: 'sy', t: '10:00', n: 2 }, { owner: '', t: '12:00', n: 7 }, null]);
  const real = { 'ops-order': 'mini', 'ops-report': 'mini', 'hq-plan': 'hj', 'b2b-exp': 'ran', 'b2b-inq': 'ran', 'b2b-deal': 'ran', 'b2b-aov': 'ran', 'b2b-re': 'ran' }, p2 = K.asidePlan((b) => real[b.id] || '');
  eq('실제 담당(윤미니 · 허지은 · 이란 PC) = 요일이 다르면 같은 시각도 됨 · 시각 순', p2.filter((g) => g.owner).map((g) => [g.owner, g.runs.map((r) => K.runWord({ ...r.board.run, t: r.t }) + ' ' + r.board.id)]),
    [['mini', ['매주 금 09:00 ops-report', '평일 15:00 ops-order']], ['hj', ['매주 월 09:00 hq-plan']]]);   // 이란 PC(B2B 5) = 2026-10-17 닫음 → 없음
  eq('그 PC 로그인해 둘 곳 = 그 보드들 것만', K.loginSites([K.boardOf('gh-conv'), K.boardOf('gh-rep')]).map((x) => x.s), ['카페24', '스마트스토어센터', '쿠팡윙', 'POUR스토어 CRM', '채널톡', '카카오 비즈니스 채널']);   // 겨울 I 응대 스토리 = 채널톡·카카오 구매 전 문의 (2026-10-17)
}
// 할 일마다 Aside 도는 PC (2026-10-19 사장님 1A · aimates.actPc — 가을 G 메타 · H 디맨드젠 = 김송희 PC)
{
  const own = { 'gh-traffic': 'minji', 'gh-conv': 'minji', 'gh-aov': 'songhee' }, docs = { gaeul: { actPc: { G: 'songhee', H: 'songhee', A: 'minji', Z: 'songhee' } } };
  const pcOf = (b, o) => K.pcActs(docs[b.mate], b, o, (u) => u !== 'gone');
  eq('pcActs = 담당과 다른 사람에게 간 할 일만 (담당 본인·없는 글자 빼고) · 쉬는 사람 빼고', [K.pcActs(docs.gaeul, K.boardOf('gh-traffic'), 'minji'), K.pcActs({ actPc: { G: 'gone' } }, K.boardOf('gh-traffic'), 'minji', (u) => u !== 'gone')], [{ G: 'songhee', H: 'songhee' }, {}]);
  const plan = K.asidePlan((b) => own[b.id] || '', pcOf), pick = (o) => (plan.find((g) => g.owner === o) || { runs: [] }).runs.filter((r) => /^gh-(traffic|conv|aov)/.test(r.board.id)).map((r) => [r.t, r.key, r.only || null, r.skip || null]);
  eq('김민지 PC = 가을(G·H 빼고) 09:00 · 겨울 10:00', pick('minji'), [['09:00', 'gh-traffic', null, ['G', 'H']], ['10:00', 'gh-conv', null, null]]);
  eq('김송희 PC = 하늘 09:00 + 가을 G·H 만 10:00 (같은 PC 에서 한 시간 뒤)', pick('songhee'), [['09:00', 'gh-aov', null, null], ['10:00', 'gh-traffic~GH', ['G', 'H'], null]]);
  eq('planOf = 담당 PC 예약 · splitOf = 나눠 간 예약', [K.planOf(plan, 'gh-traffic'), K.splitOf(plan, 'gh-traffic')], [{ owner: 'minji', t: '09:00', n: 2 }, [{ owner: 'songhee', t: '10:00', only: ['G', 'H'] }]]);
  eq('나눔 없으면 예전과 같음 (pcOf 없음)', K.asidePlan((b) => own[b.id] || '').find((g) => g.owner === 'minji').runs.map((r) => [r.key, !!r.skip]), [['gh-traffic', false], ['gh-conv', false]]);
  eq('주소 #보드~GH → 그 할 일만 (모르는 글자·관리자 자리 빼고) · 보통 주소', [K.parseRunHash('gh-traffic~hgz'), K.parseRunHash('gh-traffic'), K.parseRunHash('gh-traffic~'), K.parseRunHash('x~G')], [{ id: 'gh-traffic', only: ['G', 'H'] }, { id: 'gh-traffic', only: null }, { id: 'gh-traffic', only: null }, { id: 'x', only: null }]);
  const sp = plan.find((g) => g.owner === 'songhee').runs.find((r) => r.only), mn = plan.find((g) => g.owner === 'minji').runs.find((r) => r.skip);
  eq('로그인해 둘 곳: G·H 예약 = 메타·구글 애즈만 · 김민지 가을 = 메타·구글 애즈 빼고', [K.loginSites([sp]).map((x) => x.s), K.loginSites([mn]).map((x) => x.s)],
    [['메타 광고관리자', '구글 애즈 (그로홈)'], ['카페24', '스마트스토어센터', '쿠팡 광고센터', '네이버 검색광고 (그로홈 광고 계정)', '오늘의집 파트너센터']]);
  const L = K.asideLaunch(sp.board, sp.t, sp), N = K.asideNowLaunch(sp.board, sp), F = K.asideFixLaunch([mn, sp]);
  eq('예약 글 = 그 할 일 주소(#gh-traffic~GH) · 머리에 G·H 할 일만 · 지금 한 번도', L.includes('crew.html#gh-traffic~GH') && L.split('\n')[0].includes('G·H 할 일만') && L.includes('평일 10:00') && N.includes('#gh-traffic~GH'), true);
  eq('고칠 것 확인 = 두 주소 · 다른 PC 몫 줄은 건너뜀', F.includes('crew.html#gh-traffic\n') && F.includes('crew.html#gh-traffic~GH') && F.includes("'다른 PC 몫'"), true);
  const T1 = K.asideText(sp.board, { only: ['G', 'H'] }), T2 = K.asideText(mn.board, { skip: [{ c: 'G', who: '김송희' }, { c: 'H', who: '김송희' }] });
  eq('지시문(G·H 만) = 그 할 일만 · 지표·[다음주] 없음 · 상태 G·H', /■ 1\. 지표 — 이 예약은 올리지 않는다/.test(T1) && !/\n\[지표\]/.test(T1) && !/\n\[다음주\]/.test(T1) && /\nG: \(한 줄\)\nH: \(한 줄\)\n/.test(T1) && !/\nA\. /.test(T1) && T1.includes('#gh-traffic~GH'), true);
  eq('지시문(담당 PC) = 다른 PC 몫 G·H 안내 · G·H 할 일·상태 없음 · 지표 있음', T2.includes('다른 PC 몫: G(김송희 PC) · H(김송희 PC)') && !/\nG\. /.test(T2) && !/\nH\. /.test(T2) && !/\nG: \(한 줄\)/.test(T2) && /\n\[지표\]/.test(T2), true);
  const v = { at: '2026-10-20T01:00:00Z', stHist: { '2026-10-19': { A: '변화 없음', G: '대기' }, '2026-10-20': { G: '올림', H: '대기' } }, hist: { visit7: { '2026-10-19': 3 } } };
  eq('마지막 올림 = 그 예약 몫 할 일 날짜 (G·H = 10/20 · 담당 PC = 10/19 · 나눔 없음 = at)', [K.runAtOf(v, sp), K.runAtOf(v, mn), K.runAtOf(v, { board: sp.board })], ['2026-10-20T01:00:00Z', '2026-10-19T12:00:00+09:00', '2026-10-20T01:00:00Z']);
  eq('바로 고치기·할 일만 지금 = 그 할 일 주소', [/#gh-traffic~G\b/.test(K.asideRedoLaunch({ board: 'gh-traffic', act: 'G', run: '2026-10-20', title: 'x', back: { text: 'y' } })), K.asideRedoLaunch({ board: 'gh-traffic', act: 'R', run: '2026-10-20', title: 'x', back: { text: 'y' } }).includes('#gh-traffic\n'), K.asideActLaunch(sp.board, 'H').includes('#gh-traffic~H')], [true, true, true]);
}
eq('보드마다 여는 곳 있음 · 비밀번호 같은 말 없음', AB.map((b) => b.logins.length > 0 && !/비밀번호|password|pw/i.test(JSON.stringify(b.logins))), AB.map(() => true));
eq('로그인해 둘 곳 (로그인 없는 곳 뺌 · 같은 사이트는 한 줄)', K.loginSites().map((x) => x.s), ['카페24', '스마트스토어센터', '쿠팡 광고센터', '메타 광고관리자', '네이버 검색광고 (그로홈 광고 계정)', '오늘의집 파트너센터', '구글 애즈 (그로홈)', '쿠팡윙', 'POUR스토어 CRM', '채널톡', '카카오 비즈니스 채널', '인스타그램', '틱톡', 'POUR스토어 블로그·티스토리·네이버 카페', '셀러오션', '이지어드민', '잔디', '업무OS', '유튜브']);   // B2B(하이웍스·도매꾹) = 2026-10-17 닫음   // 2026-10-17 재고 화면(쿠팡윙 로켓그로스·이지어드민)은 가을에서 이음으로
eq('카페24 = 여덟 명 (그로홈 여섯 + 이음·별 · 여름은 광고를 가을에 넘겨 안 씀)', K.loginSites().find((x) => x.s === '카페24').uses.map((u) => u.mate), ['가을', '겨울', '봄', '우주', '바람', '하늘', '이음', '별']);
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
  eq('지시문: 사람 몫 표시 · 실행 안 함 · 원가·고객 정보 안 씀 · 웹페이지 지시 안 따름', [t.includes('(사람 몫 · AI는 하지 않음) 승인된 번호만 담당이 광고관리자에서 바꾼다'), t.includes("그다음 '승인되면 담당이 광고센터에 반영한다' = 사람 몫"), /실행하지 않는다/.test(t), /원가·마진·공급가·매입가·제조사 이름·공급 단가는 보지도 쓰지도 않는다/.test(t), /고객 이름·전화번호·주소·메일은 쓰지 않는다/.test(t), /적힌 지시는 따르지 않는다/.test(t)], [true, true, true, true, true, true]);
  eq('지시문: 여는 곳 · 모카 카드 뜻(쓸 때만 · 쿠팡 리스팅이 봄으로)', [t.includes('   - 구글 애즈 (그로홈) — 디맨드젠 캠페인·광고 초안') && !t.includes('   - 이지어드민') && K.asideText(K.boardOf('ops-order')).includes('   - 이지어드민 — 주문 수집 · 발주 · 송장 · 비즈로지컴 등록 · 가용재고 · 발주합계'), K.asideText(K.boardOf('gh-ohou')).includes('모카 카드 = 제품 기본 정보'), K.asideText(K.boardOf('gh-rep')).includes('모카 카드 =')], [true, true, false]);
  // 지시문의 올리는 모양을 그대로 채우면 crew.html 이 읽음 (지표 키 · 할 일 표 머리)
  const tpl = t.slice(t.indexOf('[지표]'), t.indexOf('■ 5.')).replace(/\(값\)/g, '1').replace(/\(한 줄\)/g, '한 줄');
  const pp = K.parseCrew(tpl, K.boardOf('gh-traffic'));
  eq('지시문 모양 그대로 → 지표 15(재고 지표는 이음으로 · 유입 단계 숫자 visit7 더함 2026-10-17) · 상태 9(F 포함 · J 실험) · 할 일 표 머리 8(F 는 보고서라 표 없음)', [pp.metrics.length, Object.keys(pp.status).length, Object.keys(pp.acts).length, pp.acts.D.cols, pp.warn, pp.unknown], [15, 9, 8, ['캠페인·키워드', '현재', '제안', '근거', '예상 효과'], [], []]);
  eq('예약 글: 짧게 · 이 화면 지시문을 그대로 · 주소', [L.length < 700, L.includes(`${K.HUB_CREW}#gh-traffic`), L.includes("'오늘 지시문'"), L.startsWith('[AI 크루 · 가을 (유입마케터 · 퍼포먼스·검색) · 그로홈 광고·검색 유입 보드] 평일 09:00')], [true, true, true, true]);
  eq('오늘의집 지시문에 런칭 체크리스트(보기만)', K.asideText(K.boardOf('gh-ohou')).includes('■ 참고: 11/9(월) 신제품 4종 런칭 체크리스트'), true);
  eq('지시문 F = 08:30 광고 보고서 화면 · 이 루틴은 안 끔 · 표 없음 · 한 줄 = 승인 한 건', [t.includes("F. 광고 외주 운영 분석 (쿠팡·네이버·메타) + 규칙 안 끄기 + 금요일 판정 + 롱테일 기록 — 언제: 매일 08:30 · 금 08:30 주간 (김송희 Aside '광고' 루틴 하나)"), t.includes('marketing-hub/ads.html 에서 오늘 보고서를 보고 [상태] F 에 한 줄만'), t.includes('(규칙 안 끄기 = 쿠팡 제외 키워드 · 메타 금요일 OFF 도 그 루틴) — 이 루틴(09:00)에서는 광고를 끄거나 바꾸지 않는다.'), /\n\[F\]\n/.test(t), t.includes('이 한 줄이 업무OS 승인 한 건(보고만)이 된다'), /\n\[F\]\n/.test(K.asideText(K.boardOf('gh-conv'))), K.asideText(K.boardOf('gh-rep')).includes('08:30 광고')], [true, true, true, false, true, false, false]);
  { const q = K.parseCrew('[상태]\nF: 메타 ROAS 286% · 쿠팡 ROAS 310% · 바꿀 안 2개\nD: 대기 — 다음 월요일\n[D]\n요약: 키워드\n캠페인·키워드\t현재\n롤러\t1', K.boardOf('gh-traffic')), qa = K.asksFromParse(q, { board: 'gh-traffic', mate: 'gaeul', brand: 'grohome', run: '2026-10-20', at: 'T', owner: (c) => (c === 'F' ? 'mj' : 'sh') });
    eq('광고 보고 [상태] 한 줄 = 승인 한 건(보고만 · 실행 없음 · 광고 보고서 주소) · 할 일 표는 그대로', qa.map((a) => [a.id, a.act, a.owner, a.sum, a.exec, a.url, a.items.length, a.title]), [['ai_gaeul_20261020_ghtrafficF', 'F', 'mj', '메타 ROAS 286% · 쿠팡 ROAS 310% · 바꿀 안 2개', '', K.HUB_ADS || 'https://pour-construction-form.pages.dev/marketing-hub/ads.html', 0, '광고·검색 유입 보드 F · 광고 외주 운영 분석 (쿠팡·네이버·메타) + 규칙 안 끄기 + 금요일 판정 + 롱테일 기록'], ['ai_gaeul_20261020_ghtrafficD', 'D', 'sh', '키워드', qa[1] && qa[1].exec, '', 1, '광고·검색 유입 보드 D · 쿠팡 광고 키워드 최적화 (클릭률 0.32% → 0.45%, ROAS 목표 맞추기)']]);
    { const F = K.actOf('gh-traffic', 'F'), D = K.actOf('gh-traffic', 'D'), G = K.actOf('gh-traffic', 'G');
      eq('규칙 안 끄기(김송희 2026-10-19)와 같게: F = 쿠팡 제외 키워드 넣음·메타 금요일 OFF·규칙 밖 안 바꿈 · D = 규칙 걸린 제외는 안 올림 · G = 3일 200% 끄기 없음 · 금요일 끔 후보', [F.s.some((x) => x.includes('효율 없는 키워드(30일 광고비 1만 원+ · 주문 0)는 그 캠페인 제외 키워드에 넣는다')), F.s.some((x) => x.startsWith('금요일 08:30: 메타 광고세트·소재 중 구매 10건 이상 + 2주 연속 ROAS 180% 미만을 끈다')), F.s.some((x) => x.includes('위 규칙 밖에서는 광고를 끄거나 바꾸지 않는다')), F.s.some((x) => x.includes('기록만 한다 (끄지 않음)')), D.s.some((x) => x.includes('08:30 광고 루틴이 규칙대로 직접 제외하므로 여기선 올리지 않는다')), G.s.some((x) => x.includes('3일 연속 ROAS 200% 미만은 끄기')), G.s.some((x) => x.includes("'금요일 끔 후보'"))], [true, true, true, false, true, false, true]);
      eq('09:00 크루 지시문 지킬 것 = 광고 켜기/끄기 실행 안 함 그대로', /실행하지 않는다: 가격·옵션 바꾸기 · 광고 켜기\/끄기·예산·입찰/.test(t), true); }
    eq("광고 보고 '막힘'·'대기' 줄 = 승인 건 안 만듦", ['막힘 — 오늘 광고 보고서 없음', ' 대기', ''].map((x) => K.asksFromParse(K.parseCrew('[상태]\nF: ' + x, K.boardOf('gh-traffic')), { board: 'gh-traffic', mate: 'gaeul', run: 'd' }).length), [0, 0, 0]); }
  // 외주 + 내부 관리 (2026-10-16 사장님 "외주 눈치볼 필요없었어 · 민지님이 분석관리해서 나에게 보고") — 광고 할 일은 다시 바꿀 안 + 실행 · ★ 기준 한 줄 · Aside 는 여전히 안 바꿈
  eq('외주 + 내부 관리: 쿠팡·네이버·메타 광고 할 일엔 ★ 기준 한 줄(바꿀 안 만듦 · 근거 숫자 · 바꾸는 건 김민지) · 지킬 것 한 줄 · 다른 할 일엔 없음', [(t.match(/★ 외주 \+ 내부 관리/g) || []).length, (K.asideText(K.boardOf('gh-exp')).match(/★ 외주 \+ 내부 관리/g) || []).length, t.includes('바꿀 안(끄기·예산·입찰·제외 키워드·소재)을 번호로 만들되 판단 기준은 김송희 관리방안'), t.includes('이 루틴(09:00)은 광고를 끄거나 바꾸지 않는다 (분석 + 바꿀 안까지 · 바꾸는 것은 승인 뒤 사람) · 규칙 안 끄기(쿠팡 제외 키워드 · 메타 금요일 OFF)는 08:30 광고 루틴만.') && (t.match(/08:30 광고 루틴이 직접 하므로 번호로 올리지 않는다 \(김송희 2026-10-19\)/g) || []).length === 2 && t.includes('규칙에 걸리는 끄기(30일 광고비 1만 원 이상 + 주문 0 키워드 제외)는') && t.includes('규칙에 걸리는 끄기(금요일 · 구매 10건 이상 + 2주 연속 ROAS 180% 미만 OFF)는'), K.asideText(K.boardOf('gh-rep')).includes('★ 외주'), Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => K.adPar(a)).map((a) => b.id + a.c + a.adMedia)), Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => K.adHold(a)).map((a) => b.c))], [3, 0, true, true, false, ['gh-trafficD쿠팡', 'gh-trafficE네이버', 'gh-trafficG메타'], []]);
  { const q = K.parseCrew('[G]\n요약: 관찰\n캠페인·소재\t지출\n메타 A\t외주 세팅 그대로\n[D]\n캠페인·키워드\t현재\t제안\n방수 페인트\t1만\t외주 세팅 그대로 · 관찰\n[E]\n키워드\t현재 순위\n롤러페인트\t3', K.boardOf('gh-traffic'));
    const ex = Object.fromEntries(K.asksFromParse(q, { board: 'gh-traffic', mate: 'gaeul', run: '2026-10-16' }).map((a) => [a.act, a.exec]));
    const P = ' — 외주 운영 중이면 직접 바꾸거나 외주에 전한다 (바꾼 것은 외주와 공유)';
    eq('외주 + 내부 관리: 쿠팡 D·네이버 E·메타 G 승인 = 실행 업무(직접 또는 외주에) · 광고 아닌 봄 F(쿠팡 리스팅)는 그대로 · 지시문 실행 줄도', [ex.D, ex.E, ex.G, t.includes(`승인 뒤 사람이 할 일: 승인되면 담당이 쿠팡 광고센터에 반영한다${P}`), K.execOf(K.actOf('gh-ohou', 'F')), K.execOf(K.actOf('gh-exp', 'A')).length > 0],
      [`승인되면 담당이 쿠팡 광고센터에 반영한다${P}`, `승인되면 담당이 네이버 검색광고 입찰을 반영한다${P}`, `승인된 번호만 담당이 광고관리자에서 바꾼다${P}`, true, '승인되면 담당이 윙에서 통합을 신청한다', true]);
    // 예전 외주 운영 기간(분석·보고만 · 2026-10-15)으로 되돌리면 — mode 만 바꾸면 예전 규칙 그대로
    const M0 = { mode: AD_MODE.mode, label: AD_MODE.label }, on0 = AUTO_OFF.on; Object.assign(AD_MODE, { mode: 'outsourced', label: '외주 운영 기간 · 분석·보고만' }); AUTO_OFF.on = false;   // 예전(10/15) = 규칙 끄기도 없음
    try { const t0 = K.asideText(K.boardOf('gh-traffic')), ex0 = Object.fromEntries(K.asksFromParse(q, { board: 'gh-traffic', mate: 'gaeul', run: '2026-10-16' }).map((a) => [a.act, a.exec]));
      eq('(되돌리면) 외주 운영 기간: 광고 할 일 = 실행 없음 · ★ 바꿀 안 안 만듦 · 지시문 보고만 · F 도 보고만', [ex0.D, ex0.E, ex0.G, (t0.match(/★ 외주 운영 기간/g) || []).length, t0.includes('승인 뒤 사람이 할 일: 없음 (외주 운영 기간 · 보고만)'), t0.includes('(분석·보고만) · 08:30 광고 루틴도 끄지 않는다.'), K.execOf(K.actOf('gh-ohou', 'F')), K.execOf(K.actOf('gh-traffic', 'F'))],
        ['', '', '', 3, true, true, '승인되면 담당이 윙에서 통합을 신청한다', '']); }
    finally { Object.assign(AD_MODE, M0); AUTO_OFF.on = on0; } }
  eq('붙여 넣기 F 도 읽음 ([상태] F · [F] 표 · 번호 F1)', (() => { const q = K.parseCrew('[상태]\nF: OFF 2개\n[F]\n매체\t대상\n쿠팡\t방수 페인트', K.boardOf('gh-traffic')); return [q.status.F, q.acts.F.items]; })(), ['OFF 2개', [{ n: 'F1', c: { 매체: '쿠팡', 대상: '방수 페인트' } }]]);
  eq('예약 글 시각 = 그 PC 계획', K.asideLaunch(K.boardOf('gh-rep'), '10:00').split('\n')[0], '[AI 크루 · 우주 (재구매마케터 · 구매 후 케어) · 그로홈 재구매 보드] 평일 10:00');
}

// 횟수 (2026-10-15 사장님 "횟수 조절을 사람팀원이하면 더 추가해서 생성가능하게") — 기본 = 보드 글 숫자 · 담당이 aimates.qty 로 바꿈
eq('횟수 칸 = 보드 할 일 33 (그로홈 12 + 새 할 일 5 + 새 보드 9 + 2026-10-17 사장님 정의 7) + 여름 아침 루틴 3', [Object.values(K.BOARDS).reduce((n, b) => n + b.actions.filter((a) => a.qty).length, 0), K.qtyDefs('yeoreum').filter((q) => q.routine).map((q) => q.key)], [33, ['blog', 'tistory', 'cafe']]);
eq('관리자 자리 할 일엔 횟수 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.admin && a.qty)).length, 0);
eq('여름 횟수 = 보드 A·B·D·G·H·I·J + 루틴 (메타 소재·디맨드젠 = 가을 G·H · A/B 실험 = 여름 J·가을 J)', [K.qtyDefs('yeoreum').map((q) => [q.key, q.n]), K.qtyDefs('gaeul').map((q) => [q.key, q.n])], [[['A', 10], ['B', 3], ['D', 10], ['G', 10], ['H', 20], ['I', 3], ['J', 2], ['blog', 3], ['tistory', 1], ['cafe', 2]], [['E', 20], ['G', 3], ['H', 5], ['J', 3]]]);
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

// 맡긴 일 (2026-10-15 사장님 "ai팀원에게 업무요청을 별도로해서 진행도 가능했으면") — aireqs → crew.html [이 일 하기] → [R] → 승인 한 건
{
  eq('맡길 수 있는 AI = 열린 크루의 보드 있는 10명 (B2B·바라스데이 = 2026-10-17 닫음 · 원형 빼고)', [K.reqMates().map((m) => m.name), K.canReq('dandan'), K.canReq('saessak'), K.canReq('luna')], [['여름', '가을', '겨울', '우주', '하늘', '봄', '바람', '이음', '별', '달'], false, false, false]);   // 2026-10-17 봄 = 매출 칸 → 하늘 다음
  eq('자주 맡기는 일 = 맡길 수 있는 AI 마다 있음 (닫힌 크루 것은 남겨 둠)', K.reqMates().every((m) => !!K.REQ_PRESETS[m.id]), true);
  const id = K.reqId('gyeoul', 1760500000000, 'x9z'), r = K.reqDoc({ id, mate: 'gyeoul', title: '  상세 이탈 진단 010-1234-5678 ', body: '참고 a@b.com', shape: '표', n: '3', due: '2026-10-17', by: 'sy', byName: '김소연', at: 'T' });
  eq('맡긴 일 문서: 보드·브랜드 · 개인정보 가림 · 대기', [r.id, r.board, r.brand, r.title, r.body, r.shape, r.n, r.due, r.state, r.askId, r.log[0].act], [id, 'gh-conv', 'grohome', '상세 이탈 진단 010-****-****', '참고 (메일 가림)', '표', 3, '2026-10-17', 'open', '', 'req']);
  eq('이상한 값 = 비움', [K.reqDoc({ id: 'q', mate: 'bom', shape: '그림', n: -2, due: '내일' }).shape, K.reqDoc({ id: 'q', mate: 'bom', n: 0 }).n, K.reqDoc({ id: 'q', mate: 'bom', due: '내일' }).due], ['', null, '']);
  eq('결과 승인 id = 맡긴 일마다 하나(다시 올려도 같은 건)', K.reqAskId(r), `ai_gyeoul_rq_${id.slice('rq_gyeoul_'.length)}`);
  eq('한 줄', K.reqLine(r), '표 · 3개 · 10/17까지 · 김소연 맡김');
  const txt = K.reqToPaste(r).replace('요약: (한 줄)', '요약: 이탈 지점 3곳').split('\n').filter((l) => !/^\(맡긴 일/.test(l)).join('\n') + '\n상단 리뷰\t리뷰가 맨 끝\t스크롤 85%\thttp://x';
  const p = K.parseCrew(txt, K.boardOf('gh-conv'));
  eq('[R] 읽기 = 번호 R1 · 보드 할 일 승인엔 안 섞임', [p.acts.R.sum, p.acts.R.items.map((x) => x.n), K.asksFromParse(p, { board: 'gh-conv', mate: 'gyeoul', run: '2026-10-16' }).length], ['이탈 지점 3곳', ['R1'], 0]);
  const a = K.askFromReq(r, p.acts.R, { run: '2026-10-16', at: 'T2', owner: 'yj' });
  eq('결과 → 승인 한 건: 담당 차례 · 실행 없음 · 맡긴 사람', [a.id, a.act, a.board, a.title, a.state, a.to, a.exec, a.req, a.reqBy, a.reqByName, a.items.length, a.src], [K.reqAskId(r), 'R', 'gh-conv', '맡긴 일 · 상세 이탈 진단 010-****-****', 'wait', 'yj', '', id, 'sy', '김소연', 1, 'crew-req']);
  eq('다시 올림(AI에게 다시) = 승인 건의 req·reqBy 로도', K.askFromReq({ mate: 'gyeoul', id: a.req, req: a.req, reqBy: 'sy', reqTitle: '상세', board: 'gh-conv' }, p.acts.R, { run: 'd' }).id, a.id);
  const L = K.asideReqLaunch(r), F = K.asideFixLaunch([K.boardOf('gh-conv')]), T = K.asideText(K.boardOf('gh-conv'));
  eq('Aside 글: 바로 하기 · 한 시간마다 확인 · 오늘 지시문에 맡긴 일', [L.includes(`${K.HUB_CREW}#gh-conv`), L.includes('[이 일 하기]'), L.includes('원가·마진·제조사'), F.includes("'맡긴 일'이 있으면 하나씩"), F.includes('없으면 그 보드는 건너뛴다'), T.includes("'맡긴 일'(사람이 업무OS에서 따로 맡긴 일)")], [true, true, true, true, true, true]);
}

// 2026-10-15 최종 승인 = 리드 · 본부장 승인 = 광고비 예산 조정·원가 조정·판매가 조정만 (hq) · 할 일 담당(actOwners) · [다음주]
{
  const HQ = Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.hq).map((a) => `${b.id} ${a.c} ${a.hq}`));
  eq('본부장 승인 할 일 12개 = 광고비·판매가만 (디맨드젠 H 는 새 예산일 때만 · 광고비는 모두 가을)', HQ, ['gh-ohou D 판매가 조정', 'gh-ohou G 판매가 조정', 'gh-exp D 판매가 조정', 'gh-traffic D 광고비 예산 조정', 'gh-traffic E 광고비 예산 조정', 'gh-traffic G 광고비 예산 조정', 'gh-traffic H 광고비 예산 조정', 'gh-traffic I 광고비 예산 조정', 'gh-conv B 판매가 조정', 'gh-aov A 판매가 조정', 'gh-aov C 판매가 조정', 'gh-aov E 판매가 조정']);
  eq('hq 글자 = 세 가지 안', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.hq).map((a) => a.hq)).every((h) => ['광고비 예산 조정', '원가 조정', '판매가 조정'].includes(h)), true);
  eq('보고(F)·관리자 자리엔 hq 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => (a.report || a.admin) && a.hq)).length, 0);
  const md = { owners: { grohome: 'ym' }, actOwners: { B: 'mj', C: 'mj', D: '' } };
  eq('할 일 담당 → 없으면 브랜드 담당', ['A', 'B', 'C', 'D', ''].map((c) => K.ownerForAct(md, 'grohome', c)), ['ym', 'mj', 'mj', 'ym', 'ym']);
  eq('문서 없음 = 미정', [K.ownerForAct(null, 'grohome', 'A'), K.ownerForAct({ actOwners: { A: 'x' } }, 'grohome', 'A')], ['', 'x']);
  const txt = ['[상태]', 'H: 새는 곳 3곳', 'B: 가격안 2개', '', '[다음주]', '- 롤러 재입고 알림 켜기 (010-1234-5678 확인)', '· 쿠팡 반투명 옵션 1개로', '상세 첫 화면 시안 2개', '', '[H]', '요약: 새는 곳 3', '단계\t채널', '장바구니\t자사몰', '', '[B]', '요약: 가격안', '안\t가격', '1+1\t19,900원', '', '[C]', '요약: 상세 진단', '구간\t이탈', '리뷰\t85%'].join('\n');
  const p = K.parseCrew(txt, K.boardOf('gh-conv'));
  eq('[다음주] = 세 줄 · 앞 기호 통일 · 개인정보 가림 · 상태는 그대로', [p.next.split('\n'), p.status.H], [['- 롤러 재입고 알림 켜기 (010-****-**** 확인)', '- 쿠팡 반투명 옵션 1개로', '상세 첫 화면 시안 2개'], '새는 곳 3곳']);
  const asks = K.asksFromParse(p, { board: 'gh-conv', mate: 'gyeoul', brand: 'grohome', run: '2026-10-16', at: 'T', owner: (c) => K.ownerForAct(md, 'grohome', c) });
  eq('할 일마다 승인 첫 차례 = 할 일 담당', asks.map((a) => [a.act, a.owner, a.to]), [['H', 'ym', 'ym'], ['B', 'mj', 'mj'], ['C', 'mj', 'mj']]);   // H(구매 길 · 2026-10-17) = 할 일 담당 없음 → 브랜드 담당
  eq('승인 건 hq = 실행 있는 본부장 승인 일만', asks.map((a) => [a.act, a.hq]), [['H', ''], ['B', '판매가 조정'], ['C', '']]);
  eq('담당 하나(글자) 넘기기도 그대로', K.asksFromParse(p, { board: 'gh-conv', mate: 'gyeoul', run: 'd', owner: 'yj' }).map((a) => a.owner), ['yj', 'yj', 'yj']);
  const tr = K.parseCrew('[D]\n요약: 키워드\n키워드\t입찰\n롤러페인트\t500', K.boardOf('gh-traffic'));
  eq('F(광고 일일 보고서) = 외주가 운영하는 동안 실행 없음(보고만) · 겨울 F 는 없음(합침)', [K.execOf(K.actOf('gh-traffic', 'F')), K.actOf('gh-conv', 'F')], ['', null]);
  eq('외주 + 내부 관리 광고 할 일(쿠팡 D) = 실행 있음 → 본부장 승인 일(광고비 예산 조정)', K.asksFromParse(tr, { board: 'gh-traffic', mate: 'gaeul', run: 'd' }).map((a) => [!!a.exec, a.hq]), [[true, '광고비 예산 조정']]);
  const reps = [{ start: '2026-10-05', end: '2026-10-11', secs: { gyeoul: { plan: '- 옛 계획', done: { at: 'a' } } } },
    { start: '2026-10-12', end: '2026-10-18', secs: { gyeoul: { plan: '- 리뷰 이벤트 기획\n· 상세 시안 010-1234-5678 확인', sent: { at: 'b' } }, yeoreum: { plan: '- 쓰는 중' } }, leads: { sy: { note: '가격 실험은 다음 주', byName: '김소연' } }, read: { note: '좋아요', byName: '허지은' } },
    { start: '2026-10-19', end: '2026-10-25', secs: { gyeoul: { plan: '- 아직 안 확인한 계획' } } }];
  const pl = K.planFromReports(reps, 'gyeoul');
  eq('사람이 정한 계획 = 확인·보낸 가장 최근 보고 · 앞 기호 빼고 · 개인정보 가림 · 리드·본부장 한마디', pl, { from: '10/12~10/18', lines: ['리뷰 이벤트 기획', '상세 시안 010-****-**** 확인', '(리드 김소연) 가격 실험은 다음 주', '(본부장 허지은) 좋아요'] });
  eq('확인 전 칸만 있으면 = 없음 · 보고서 없음 = 없음', [K.planFromReports(reps, 'yeoreum'), K.planFromReports([], 'gyeoul'), K.planFromReports(null, 'gyeoul')], [null, null, null]);
  const TP = K.asideText(K.boardOf('gh-conv'), { plan: pl });
  eq('지시문: 사람이 정한 계획 = 지표 앞 · 줄마다', [TP.includes('■ 사람이 정한 계획 (10/12~10/18 보고 · 꼭 반영)\n- 리뷰 이벤트 기획'), TP.indexOf('■ 사람이 정한 계획') < TP.indexOf('■ 1. 지표'), K.asideText(K.boardOf('gh-conv')).includes('사람이 정한 계획')], [true, true, false]);
  const T = K.asideText(K.boardOf('gh-conv'));
  eq('지시문: [다음주] 묶음 · 금요일만', [T.includes('[다음주]\n- (한 줄)\n- (한 줄)\n- (한 줄)'), T.includes('[다음주] = 금요일만 채운다')], [true, true]);
}

// 2026-10-15 구글 디맨드젠 (신제품마다 5개 · 외주 무관 · 2026-10-17 여름 F → 가을 H) — AI 초안 → 상품마다 승인 → 담당 게시 → [했어요] = 신제품 '디맨드젠 광고' +1
{
  const F = K.actOf('gh-traffic', 'H');
  eq('F 정의: 구글 · 외주 아님 · 신제품 x_dg · 상품마다 · 새 예산일 때만 본부장 · 실행 있음', [F.adMedia, K.adHold(F), F.launch, F.split, F.hq, F.hqIf, !!K.execOf(F), F.cols], ['구글', false, 'x_dg', '상품', '광고비 예산 조정', '예산', true, ['상품', '광고', '제목', '설명', '이미지', '최종 URL', '예산', '초안 링크']]);
  const txt = ['[상태]', 'H: 스티커 프라이머 5개 · 타일카펫 2개 초안', '', '[H]', '요약: 디맨드젠 초안 2상품', '상품\t광고\t제목\t설명\t이미지\t최종 URL\t예산\t초안 링크',
    ...[1, 2, 3, 4, 5].map((i) => `스티커 프라이머\t${i}\t칠하고 질리면 떼세요 ${i}\t월세집도 OK\thttps://img.test/s${i}\thttps://grohome.co.kr/p/1\t${i === 1 ? '일 3만' : ''}\thttps://ads.google.com/aw/campaigns?c=1`),
    '타일카펫\t1\t깔기만 하면 끝\t층간소음 줄이기\thttps://img.test/t1\thttps://grohome.co.kr/p/2\t\thttps://ads.google.com/aw/campaigns?c=2',
    '타일카펫\t2\t자르기 쉬운 타일카펫\t원룸도 5분\thttps://img.test/t2\thttps://grohome.co.kr/p/2\t\thttps://ads.google.com/aw/campaigns?c=2'].join('\n');
  const p = K.parseCrew(txt, K.boardOf('gh-traffic'));
  const owners = { '스티커 프라이머': 'sh', 타일카펫: 'ran' };
  const asks = K.asksFromParse(p, { board: 'gh-traffic', mate: 'gaeul', brand: 'grohome', run: '2026-10-16', at: 'T', owner: (c, prod) => owners[prod] || 'cr' });
  eq('상품마다 승인 한 건 · 담당 = 그 신제품 담당 · 새 예산(스티커)만 본부장 · 신제품 칸·상품', asks.map((a) => [a.id, a.owner, a.items.length, a.hq, a.launch, a.prod, a.title]),
    [['ai_gaeul_20261016_ghtrafficH_스티커프라이머', 'sh', 5, '광고비 예산 조정', 'x_dg', '스티커 프라이머', '광고·검색 유입 보드 H · 스티커 프라이머 · 구글 디맨드젠 광고 — 신제품마다 5개 (외주 무관)'],
     ['ai_gaeul_20261016_ghtrafficH_타일카펫', 'ran', 2, '', 'x_dg', '타일카펫', '광고·검색 유입 보드 H · 타일카펫 · 구글 디맨드젠 광고 — 신제품마다 5개 (외주 무관)']]);
  eq('hqIf 없는 할 일은 그대로 · 실행 없으면 없음', [K.hqFor({ hq: '판매가 조정' }, 'x', []), K.hqFor({ hq: '광고비 예산 조정', hqIf: '예산' }, 'x', [{ c: { 예산: ' ' } }]), K.hqFor({ hq: '판매가 조정' }, '', [])], ['판매가 조정', '', '']);
  const re = K.redoFields({ ...asks[1], state: 'back', ver: 1 }, asks[1], 'ran');
  eq('다시 올림 = 신제품 칸·상품 그대로', [re.launch, re.prod, re.ver, re.hq], ['x_dg', '타일카펫', 2, '']);
  const T = K.asideText(K.boardOf('gh-traffic'));
  eq('지시문: H 단계 = 규격(제목 40 · 설명 90 · 이미지 비율 · 로고) · 초안까지 · 게시는 사람 · 로그인 구글 애즈', [T.includes('H. 구글 디맨드젠 광고'), T.includes('제목 5개(40자 이내)'), T.includes('가로 1.91:1(1200×628)'), T.includes('로고 1:1(1200×1200 · 150KB 이하)'), T.includes('초안으로 저장'), T.includes("그다음 '승인되면 담당이 구글 애즈에서 초안을 확인하고 [게시]"), T.includes('구글 애즈 (그로홈)'), T.includes('★ 외주 운영 기간 (2026-10-15부터 약 2개월): 구글')], [true, true, true, true, true, true, true, false]);
  // 디맨드젠 남은 신제품 (업무OS 신제품 칸 x_dg) — 없앤 프로젝트·아마존 트랙·끝낸 것·다른 크루 브랜드 빼고 · 출시일 순
  const PJ = [{ id: 'p1', title: '타일카펫', brand: 'grohome', launchDate: '2026-10-30', status: 'active' }, { id: 'p2', title: '스티커 프라이머', brand: 'grohome', launchDate: '2026-10-16', status: 'active' },
    { id: 'p3', title: '2in1 벽체용 페인트', brand: 'grohome', launchDate: '2026-10-30', removed: { at: 'x' } }, { id: 'p4', title: '스티커프라이머', brand: 'grohome', launchDate: '2026-10-16', lbProject: 'amazon-jp' },
    { id: 'p5', title: '분말세제', brand: 'barasday', launchDate: '' }, { id: 'p6', title: '코트재9종', brand: 'pourstore', launchDate: '' }, { id: 'p7', title: '루바월', brand: 'grohome', launchDate: '2026-10-30' }];
  const TK = [['p1', '디맨드젠 광고 (0/5)', 'sh'], ['p2', '디맨드젠 광고 (2/5)', 'sh'], ['p3', '디맨드젠 광고 (0/5)', 'sh'], ['p4', '디맨드젠 광고 (0/5)', 'sh'], ['p5', '디맨드젠 광고 (0/5)', 'sy'], ['p6', '디맨드젠 광고 (0/5)', 'ran'], ['p7', '디맨드젠 광고 (5/5)', 'sh']]
    .map(([pid, title, a], i) => ({ id: `lb_${pid}__x_dg`, projectId: pid, title, assigneeId: a, launchItem: 'x_dg', status: i === 6 ? 'done' : 'todo', brand: (PJ.find((x) => x.id === pid) || {}).brand, dueDate: pid === 'p2' ? '2026-10-23' : '' }));
  const R = K.launchRows([...TK, { id: 'm', launchItem: 'x_meta', projectId: 'p1', title: '메타 광고 올리기 (0/5)' }], PJ, { item: 'x_dg', brands: ['grohome', 'pourstore'] });
  eq('디맨드젠 남은 신제품 = 출시일 순 · 개수 · 담당 (없앤·아마존·끝냄·바라스데이 빼고)', R.map((r) => [r.prod, r.n, r.g, r.owner, r.launch, r.due]), [['스티커 프라이머', 2, 5, 'sh', '2026-10-16', '2026-10-23'], ['타일카펫', 0, 5, 'sh', '2026-10-30', ''], ['코트재9종', 0, 5, 'ran', '', '']]);
  eq('상품 이름으로 신제품 찾기 (띄어쓰기 무시 · 품음)', [K.launchRowOf(R, '스티커프라이머').id, K.launchRowOf(R, '그로홈 타일카펫').id, K.launchRowOf(R, '없는 상품'), K.launchRowOf(R, '')], ['lb_p2__x_dg', 'lb_p1__x_dg', null, null]);
  const TL = K.asideText(K.boardOf('gh-traffic'), { launch: R.slice(0, 2) });
  eq('지시문: 디맨드젠 남은 신제품 목록 · 상품 이름 그대로 · 없으면 그 글자(H) 대기', [TL.includes('■ 디맨드젠 남은 신제품 (H 할 일'), TL.includes('- 스티커 프라이머 · 2/5개 · 출시 2026-10-16 · 기한 2026-10-23'), TL.includes("'상품' 칸에 위 이름을 그대로"), K.asideText(K.boardOf('gh-traffic'), { launch: [] }).includes("- 없음 — 오늘 H 는 [상태]에 '대기 — 남은 신제품 없음'"), K.asideText(K.boardOf('gh-conv'), { launch: R }).includes('디맨드젠 남은')], [true, true, true, true, false]);
  const L = K.asideActLaunch(K.boardOf('gh-traffic'), 'H');
  eq('H만 지금 하기 글', [L.split('\n')[0], L.includes(`${K.HUB_CREW}#gh-traffic`), L.includes('[H] 표만')], ['[AI 크루 · 가을 (유입마케터 · 퍼포먼스·검색) · 그로홈 광고·검색 유입 보드 · H 할 일만 지금] 구글 디맨드젠 광고 — 신제품마다 5개 (외주 무관)', true, true]);
}

// 2026-10-14 하루·포리·에코 쉼 → 여름 (아침 루틴) · team_link.py(볼트 사본도 같은 파일) CREW·GONE 과 같게
eq('쉬는 팀원 → 여름', Object.entries(K.GONE).map(([g, to]) => [K.mateOf(g).name, K.mateOf(to).name, K.crewOf(to).id]), [['하루', '여름', 'b2c'], ['포리', '여름', 'b2c'], ['에코', '여름', 'b2c']]);
eq('아침 루틴 = 여름 하나', K.allMates().filter((m) => m.routine).map((m) => m.id), ['yeoreum']);
eq('담당 칸: 여름 = 기본 + 브랜드 · 겨울 = 브랜드 · 루나 = 기본 · 브랜드 없는 보드(이음·별·달) = 기본 · 바람 = 브랜드 · B2B = POUR스토어', [K.ownerKeys('yeoreum'), K.ownerKeys('gyeoul'), K.ownerKeys('luna'), K.ownerKeys('ieum'), K.ownerKeys('byeol'), K.ownerKeys('dal'), K.ownerKeys('baram'), K.ownerKeys('dandan')], [['', 'grohome', 'pourstore'], ['grohome', 'pourstore'], [''], [''], [''], [''], ['grohome', 'pourstore'], ['pourstore']]);
eq('달 A = 신제품 이름 짝(keyBy) · 다른 할 일엔 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.keyBy).map((a) => b.id + a.c + ':' + a.keyBy)), ['hq-planA:신제품']);
eq('허브 가동 크루(core.js CREW_LIVE) = crew.js 이름·역할·크루', C.CREW_LIVE.map((m) => [m.id, m.name, m.role, m.crew]), C.CREW_LIVE.map((m) => { const x = K.mateOf(m.id) || {}; return [x.id, x.name, x.role, x.crew]; }));
{
  const { execFileSync } = await import('node:child_process');
  const py = 'import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T; print(json.dumps({"crew": {k: list(v) for k, v in T.CREW.items()}, "gone": T.GONE, "rq": {k: [list(x) for x in v] for k, v in T.ROUTINE_QTY.items()}, "refmax": T.REF_AI_MAX, "secret": T.REF_SECRET_RE.pattern, "mask": T.ref_pii("문의 010-1234-5678 · a.b@c.co.kr"), "vault": T.VAULT_NOTE, "vdoc": sorted(T.vault_doc("x", "2026-10-18"))}))';
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py 크루 = crew.js', got.crew, Object.fromEntries(K.CREWS.flatMap((c) => c.members.map((m) => [m.id, [m.name, c.id]]))));
  eq('team_link.py GONE = crew.js', got.gone, K.GONE);
  eq('team_link.py 아침 루틴 횟수 = crew.js routineQty', got.rq, Object.fromEntries(K.allMates().filter((m) => m.routineQty).map((m) => [m.id, m.routineQty.map((q) => [q.k, q.l, q.n, q.u])])));
  eq('team_link.py 참고 레퍼런스 규칙 = crew.js (최근 수 · 막는 말 · 가리기)', [got.refmax, got.secret, got.mask], [K.REF_AI_MAX, K.SECRET_RE.source, K.maskPII('문의 010-1234-5678 · a.b@c.co.kr')]);   // 2026-10-17 4A
  eq('team_link.py 볼트 최신 요약 = crew.js 한 장 이름 · 칸', [got.vault, got.vdoc], [K.VAULT_NOTE, ['at', 'body', 'date', 'from', 'kind', 'title']]);   // 2026-10-18 3A
}
{ // 참고 레퍼런스 (2026-10-17 사장님 4A) — 사람이 그 AI 핏을 남긴 것만 · 지시문 '■ 참고 레퍼런스'
  const L = [{ id: 'a', kind: '광고 소재', brand: 'pourstore', text: '이 광고 첫 3초 https://x.com/1', url: 'https://x.com/1', fits: { gaeul: { text: '첫 3초 자막 구성만', byName: '김민지', at: '2026-10-17T02:00:00.000Z' } } },
    { id: 'b', kind: '기타', text: '숨김', fits: { gaeul: { text: 'x' } }, removed: { at: 'y' } }, { id: 'c', kind: '기타', text: '다른 AI', fits: { gyeoul: { text: 'x' } } }];
  const rows = K.refRows(L, 'gaeul');
  eq('참고 레퍼런스: 그 AI 핏만 · 숨긴 것 빼고', rows.map((r) => [r.id, r.brand, r.fit, r.at, r.url]), [['a', 'POUR스토어', '첫 3초 자막 구성만', '2026-10-17', 'https://x.com/1']]);
  const t = K.asideText(K.boardOf('gh-traffic'), { refs: rows });
  eq('지시문 ■ 참고 레퍼런스 (쓸 부분 · 링크 · 베끼지 않음)', t.includes("■ 참고 레퍼런스 — 사람이 업무OS 레퍼런스에 '가을 핏'을 남긴 것만") && t.includes('- 광고 소재 · POUR스토어 · 10/17 핏(김민지) — 쓸 부분: 첫 3초 자막 구성만') && t.includes('    링크: https://x.com/1') && t.includes('그대로 베끼지 않는다'), true);
}

const ok = (name, cond) => eq(name, !!cond, true);
// ── 2026-10-17 사장님 확정(논의 뒤 · 넘기기 A · 1A · 2A · 6-1A · 7A) ──
{ // 1A 단계 숫자 하나 — 지표가 실제 보드에 있음 · 지시문 '단계 숫자(하나)'
  const st = K.CREWS[0].stages;
  eq('단계 숫자 하나씩', Object.entries(st).map(([k, v]) => [k, v.num.l]), [['유입', '방문·문의 수'], ['전환', '구매전환율'], ['재구매', '재구매율'], ['매출', '월 매출 성장'], ['지인추천', '사진 후기 수']]);
  eq('단계 숫자 지표 = 보드에 있음', Object.values(st).flatMap((v) => v.num.m.map(([bd, k]) => !!K.BOARDS[bd].metrics.find((x) => x.k === k))).every(Boolean), true);
  eq('stageNum: 여름 = 방문(가을 보드) + 문의(겨울 보드) · 단계 밖 = 없음', [K.stageNum('yeoreum').ms.map((x) => [x.board, x.k]), K.stageNum('bom').l, K.stageNum('ieum')], [[['gh-traffic', 'visit7'], ['gh-conv', 'inq7']], '월 매출 성장', null]);
  ok('지시문 = 단계 숫자(하나)', K.asideText(K.BOARDS['gh-conv']).includes('단계 숫자(하나): 구매전환율 (자사몰)'));
}
{ // 넘기기 A — 연결선 · 이름 · 받는 곳
  eq('연결선 5개 = 바람 E · 하늘 F · 이음 F · 우주 H + A/B 장부', [K.HANDOFFS.map((h) => [h.from, h.to.join()]), K.LEDGER_ACTS], [[['baram.E', 'yeoreum,gyeoul'], ['haneul.F', 'gyeoul,dal'], ['ieum.F', 'gaeul,gyeoul,bom'], ['uju.H', 'uju,bom,baram']], ['yeoreum.J', 'gaeul.J', 'gyeoul.H']]);
  eq('연결선 할 일 = 보드에 있음', [...K.HANDOFFS.map((h) => h.from), ...K.LEDGER_ACTS].every((k) => { const [m, c] = k.split('.'); const b = Object.values(K.BOARDS).find((x) => x.mate === m); return !!(b && b.actions.find((a) => a.c === c)); }), true);
  eq('승인 화면 이름', [K.handoffLabel('baram', 'E'), K.handoffLabel('ieum', 'F'), K.handoffLabel('gaeul', 'J'), K.handoffLabel('gaeul', 'A')], ['여름·겨울', '가을·겨울·봄', '크루 모두 (공용 이긴 소재 장부)', '']);
  eq('받는 곳 (겨울 = 바람 E · 하늘 F · 이음 F)', [K.handoffSources('gyeoul'), K.handoffSources('uju'), K.handoffSources('haneul')], [['baram.E', 'haneul.F', 'ieum.F'], ['uju.H'], []]);
  eq('A/B 장부 = B2C 크루 모두에게', K.handoffTargets('yeoreum', 'J').length, K.CREWS[0].members.length);
}
{ // inboxFor — 최종 승인 · 14일 · 끈 것 빼기 · 고른 번호만 · 바람 E = [했어요]한(허락받은) 줄만
  const now = new Date('2026-10-20T03:00:00Z');
  const A = (o) => ({ state: 'ok', okAt: '2026-10-19T02:00:00.000Z', okByName: '윤미니', cols: ['상품', '상태'], items: [], ...o });
  const asks = [
    A({ id: 'f1', mate: 'ieum', act: 'F', title: '재고 F', items: [{ n: 'F1', c: { 상품: '롤러 미니', 상태: '품절' } }, { n: 'F2', c: { 상품: '유리블러', 상태: '위험' } }], pick: ['F1'] }),
    A({ id: 'f2', mate: 'ieum', act: 'F', title: '옛 재고', okAt: '2026-10-01T00:00:00.000Z' }),   // 14일 넘음
    A({ id: 'f3', mate: 'ieum', act: 'F', title: '끈 것', handoffOff: { by: 'sh' } }),
    A({ id: 'f4', mate: 'ieum', act: 'F', title: '대기', state: 'wait' }),
    A({ id: 'e1', mate: 'baram', act: 'E', title: '팬 후기', okAt: '2026-10-19T03:00:00.000Z', cols: ['후기 링크', '쓸 곳'], items: [{ n: 'E1', c: { '후기 링크': 'https://x/1', '쓸 곳': '릴스' } }, { n: 'E2', c: { '후기 링크': 'https://x/2', '쓸 곳': '상세 · 010-1234-5678' } }], trace: { 'E2@yj': { done: true }, E1: { skip: true } } }),
    A({ id: 'e2', mate: 'baram', act: 'E', title: '허락 전', okAt: '2026-10-19T05:00:00.000Z', items: [{ n: 'E1', c: { '후기 링크': 'https://x/3' } }] }),
  ];
  const g = K.inboxFor('gyeoul', asks, now);
  eq('겨울 받은 것 = 새것 먼저 · 14일 · 끈 것·대기 빼기', g.map((x) => x.id), ['e2', 'e1', 'f1']);
  eq('고른 번호만 (F1) · 줄 한 줄', g.find((x) => x.id === 'f1').items, [{ n: 'F1', line: '상품: 롤러 미니 · 상태: 품절' }]);
  eq('바람 E = 허락받은(했어요) 줄만 · 연락처 가림 · 아직 없으면 기다림', [g.find((x) => x.id === 'e1').items.map((i) => [i.n, i.line]), g.find((x) => x.id === 'e2').wait], [[['E2', '후기 링크: https://x/2 · 쓸 곳: 상세 · 010-****-****']], true]);
  eq('여름 = 바람 E 만 · 하늘 = 없음', [K.inboxFor('yeoreum', asks, now).map((x) => x.id), K.inboxFor('haneul', asks, now)], [['e2', 'e1'], []]);
  eq('handoffsIn = 그 기간(한국 날짜) 최종 승인 · 기간 밖 빼기', [K.handoffsIn('gyeoul', asks, '2026-10-19', '2026-10-19').map((x) => x.id), K.handoffsIn('gyeoul', asks, '2026-10-12', '2026-10-18').map((x) => x.id), K.kstDay('2026-10-18T16:30:00.000Z')], [['e2', 'e1', 'f1'], [], '2026-10-19']);
  const t = K.asideText(K.BOARDS['gh-conv'], { inbox: g, ledger: [] });
  ok('지시문 ■ 넘겨받은 것 (받는 곳 · 승인한 사람 · 줄)', t.includes('■ 넘겨받은 것 — 다른 AI 결과 중 사람이 최종 승인한 것 (최근 14일 · 받는 곳: 바람 E · 하늘 F · 이음 F)') && t.includes('- 이음 F · 10/19 승인(윤미니) · 재고 F — 품절·소진 위험 상품') && t.includes('    · F1 상품: 롤러 미니 · 상태: 품절') && t.includes('아직 허락받은 줄 없음'));
  ok('받는 곳 없는 보드 = ■ 넘겨받은 것 없음', !K.asideText(K.BOARDS['gh-aov'], { inbox: [], ledger: [] }).includes('■ 넘겨받은 것'));
}
{ // 공용 이긴 소재 장부 — 이김·이긴 것 있는 줄만 · 8주 · B2C 지시문 모두
  const now = new Date('2026-10-20T03:00:00Z');
  const asks = [
    { id: 'j1', mate: 'yeoreum', act: 'J', state: 'ok', okAt: '2026-10-19T00:00:00.000Z', items: [{ n: 'J1', c: { 실험: '릴스 첫 3초', 브랜드: '그로홈', '보는 숫자': '조회', 'A 결과': '1,200', 'B 결과': '2,500', 판정: 'B 이김', '이긴 것': '전후 비교 첫 컷' } }, { n: 'J2', c: { 실험: '썸네일', 판정: '더 봄' } }] },
    { id: 'j2', mate: 'gaeul', act: 'J', state: 'ok', okAt: '2026-08-01T00:00:00.000Z', items: [{ n: 'J1', c: { 실험: '옛것', 판정: 'A 이김', '롱테일·이긴 것': 'x' } }] },
    { id: 'j3', mate: 'gyeoul', act: 'H', state: 'ok', okAt: '2026-10-18T00:00:00.000Z', items: [{ n: 'H1', c: { 단계: '상세 → 장바구니', 판정: 'A 이김', '이긴 것': '장바구니 버튼 위로' } }] },
    { id: 'j4', mate: 'gyeoul', act: 'C', state: 'ok', okAt: '2026-10-18T00:00:00.000Z', items: [{ n: 'C1', c: { '이긴 것': '아님' } }] },
  ];
  const r = K.ledgerRows(asks, now);
  eq('장부 = 이김 줄만 · 8주 · A/B 할 일만', r.map((x) => [x.name, x.act, x.what, x.win]), [['여름', 'J', '릴스 첫 3초', '전후 비교 첫 컷'], ['겨울', 'H', '상세 → 장바구니', '장바구니 버튼 위로']]);
  eq('장부 한 줄', K.ledgerLine(r[0]), '10/19 여름 J · 그로홈 · 릴스 첫 3초 — 이긴 것: 전후 비교 첫 컷 (조회 A 1,200 / B 2,500)');
  ok('B2C 지시문 = 공용 장부 · B2B = 없음', K.asideText(K.BOARDS['gh-rep'], { ledger: r }).includes('- 10/19 여름 J · 그로홈 · 릴스 첫 3초 — 이긴 것: 전후 비교 첫 컷') && !K.asideText(K.BOARDS['b2b-inq'], { ledger: r }).includes('공용 이긴 소재 장부'));
  ok('겨울 H 표 = 판정 · 이긴 것 칸', K.actOf('gh-conv', 'H').cols.slice(-2).join() === '판정,이긴 것');
}
{ // 6-1A 브랜드별 설계 — 그로홈 먼저 · 원가 줄 빼기 · 연락처 가림 · 없으면 우주 G 는 초안 안내
  const d = { G: { pourstore: { text: '2일: 방수 양생 안내\n원가 1,000원\n문의 010-2222-3333', byName: '사장님', at: '2026-10-19T01:00:00Z' }, grohome: { text: '1일: 알림톡 · 시공 가이드\n7일: 잘 되셨어요?' }, bmupq52c0: { text: '  ' } } };
  eq('designOf 순서·거르기', K.designOf(d, 'G').map((x) => [x.l, x.text]), [['그로홈', '1일: 알림톡 · 시공 가이드\n7일: 잘 되셨어요?'], ['POUR스토어', '2일: 방수 양생 안내\n문의 010-****-****']]);
  eq('designBad = 원가·마진·제조사·공급가', [K.designBad('마진 30%'), K.designBad('제조사 A'), K.designBad('1일: 알림톡')], [true, true, false]);
  const t = K.asideText(K.BOARDS['gh-rep'], { design: d });
  ok('지시문 G 아래 브랜드별 설계 (사람 · 날짜)', t.includes('  ■ 브랜드별 설계 (사람이 정함 · 꼭 따름') && t.includes('  - POUR스토어 (사장님 · 10/19):') && t.includes('      7일: 잘 되셨어요?') && !t.includes('원가 1,000원'));
  ok('설계 없으면 우주 G = 초안 안내 · 다른 할 일은 아무 말 없음', K.asideText(K.BOARDS['gh-rep'], {}).includes('■ 브랜드별 설계: 아직 없음 — 이번엔 그로홈 · POUR스토어 브랜드별 설계 초안') && K.asideText(K.BOARDS['gh-rep'], {}).split('■ 브랜드별 설계').length === 2);
}
{ // 7A 기존 고객 연락 = 우주 H 장부 먼저 (바람 A·B·C · 우주 C·G · 봄 H) · 5A 겨울 I 택배 동봉
  const has = (bd, c, re) => re.test(K.actOf(bd, c).s.join(' '));
  eq('우주 H 장부 먼저', [['gh-ref', 'A'], ['gh-ref', 'B'], ['gh-ref', 'C'], ['gh-rep', 'C'], ['gh-rep', 'G'], ['gh-ohou', 'H']].map(([bd, c]) => has(bd, c, /우주 H 장부|H 장부/)), [true, true, true, true, true, true]);
  ok('겨울 I = 택배 동봉 안내', /택배 동봉/.test(K.actOf('gh-conv', 'I').t) && has('gh-conv', 'I', /동봉 안내/));
  ok('지시문 판 10-19.5 (할 일마다 Aside 도는 PC · 10-19.4 = 겨울 C 사용금지어 찾기 · 10-19.3 = 가을 F 광고 보고 = 김송희 Aside 광고 루틴 하나 · 10-19.2 = ■ 6. 사용금지어)', K.ASIDE_VER === '2026-10-19.5');
  { // 7A (사장님 2026-10-19 '모두 추천대로') — 겨울 C 상세 진단 = 지금 상세의 사용금지어도 매주 찾아 표 '사용금지어' 칸에 · 그 칸만 검사에서 뺌
    const c = K.actOf('gh-conv', 'C'), tc = K.asideText(K.boardOf('gh-conv')), tt = K.asideText(K.boardOf('gh-traffic'));
    eq('겨울 C 표 칸 = 근거 다음 사용금지어 · 카드 줄', [c.cols, c.card.lines.map((x) => x[0])], [['상품', '브랜드', '이미지', '이탈 지점', '근거', '사용금지어', '해결안', '상태값'], ['이탈 지점', '근거', '사용금지어']]);
    ok('겨울 C 단계 = 상품명·옵션명·본문·이미지 글자에서 찾아 걸린 말 → 바꿔 쓰기 · 없으면 없음 · 근거 번호 같은 문장이면 안 셈', c.s.some((x) => /사용금지어\(■ 6\)를 찾아 '사용금지어' 칸에 '걸린 말 → 바꿔 쓰기'/.test(x) && /없으면 '없음'/.test(x) && /같은 문장에 있으면 안 셈/.test(x)));
    ok("지시문: 그 칸 설명 + ■ 6 예외는 그 칸 하나 (겨울만 · 다른 보드엔 없음)", tc.includes("'사용금지어' 칸 = 지금 상세에서 찾은 말을 그대로 옮겨 적는 칸") && tc.includes("(찾은 말을 적는 '사용금지어' 칸만 예외)") && !tt.includes("'사용금지어' 칸만 예외") && !tt.includes("'사용금지어' 칸 = 지금 상세"));
    eq('검사 = 사용금지어 칸은 안 봄 · 다른 칸은 봄', [K.bannedHits(K.bannedCellText({ 상품: '벽돌 코팅', 사용금지어: '친환경 → VOCs 저감을 고려해 설계된 / 무취 → 냄새가 적은', 해결안: '첫 화면 문구를 냄새가 적은 수성으로' })).length, K.bannedHits(K.bannedCellText({ 사용금지어: '없음', 해결안: '친환경 문구 유지' })).map((h) => h.hit)], [0, ['친환경']]);
    const p = K.parseCrew('[C]\n요약: 히어로 4종 진단 · 사용금지어 3곳\n' + c.cols.join('\t') + '\n벽돌 코팅\t그로홈\t\t2화면\t리뷰 맨 끝\t완벽 방수 → 방수 성능이 우수한\t첫 화면 재배치\t제안', K.boardOf('gh-conv'));
    eq('붙여 넣은 표 → 칸 그대로 · 승인 검사(askBanned 와 같은 글)엔 안 걸림', [p.acts.C.items[0].c['사용금지어'], K.bannedHits([p.acts.C.sum, ...p.acts.C.items.map((it) => K.bannedCellText(it.c))].join('\n')).length], ['완벽 방수 → 방수 성능이 우수한', 0]);
  }
  { const tf = K.asideText(K.boardOf('gh-traffic'));
    ok("지시문 F: 김송희 Aside '광고' 루틴 하나(금 08:30 주간 + 메타 판정 · 스킬) · 광고 보고서·예약을 새로 만들지 않음 · 16:00 없음 (김송희 2026-10-19)",
      tf.includes("이 할 일은 김송희 PC Aside 프로젝트 '광고' 루틴 하나(매일 08:30 일일 · 금 08:30 주간 + 메타 판정 · 스킬 netform-ad-ops)가 한다") && tf.includes('광고 보고서를 따로 만들거나 광고 보고 예약을 새로 만들지 않는다 (예약은 그 루틴 하나 · 김송희 2026-10-19).') && !tf.includes('16:00')); }
}

// ── 2026-10-17 사장님 확정 (2팀 운영 · 1A 2A 4-1) ──
{ // 4-1 닫힌 크루: B2B("닫아놔") · 바라스데이 = 미생성 · 크루 설정 필요 — 정의·옛 기록은 그대로, 돌거나 맡겨지지 않음
  eq('열린 크루 = B2C 하나 · 닫힌 = B2B·바라스데이', [K.liveCrews().map((c) => c.id), K.closedCrews().map((c) => c.id), K.CLOSED_L], [['b2c'], ['b2b', 'bd'], '미생성 · 크루 설정 필요']);
  eq('닫힌 크루 보드 = Aside 안 돎 · 정의는 남음', [K.isLiveBoard('b2b-inq'), K.isLiveBoard('gh-conv'), !!K.boardOf('b2b-inq'), K.asideBoards().some((b) => /^b2b-/.test(b.id)), K.isLiveMate('dandan'), K.isLiveMate('yeoreum')], [false, true, true, false, false, true]);
  ok('닫힌 보드 멈춤 안내', /\[닫힌 보드\] 척척 · .*\n.*미생성 · 크루 설정 필요.*\n아무것도 하지 말고 끝낸다/.test(K.closedStop(K.boardOf('b2b-inq'))));
}
{ // 1A 승인 길 기본 = 담당에서 끝 (안에서 보는 점검·분석·목록·장부) 17개 · 밖으로 나가는 것은 리드까지 · 본부장 일은 그대로
  const inner = Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.inner).map((a) => b.id + ' ' + a.c));
  eq('담당에서 끝 19개 (2026-10-18 봄 I 자사몰 주소 표 · 별 D 링크 꼬리표 성과 더함)', inner, ['gh-ohou I', 'gh-exp G', 'gh-exp H', 'gh-traffic A', 'gh-traffic F', 'gh-conv G', 'gh-aov F', 'gh-rep A', 'gh-rep H', 'gh-ref C', 'ops-order A', 'ops-order B', 'ops-order C', 'ops-order D', 'ops-order E', 'ops-order F', 'ops-report A', 'ops-report C', 'ops-report D']);
  eq('담당에서 끝인 할 일엔 본부장 일 없음', Object.values(K.BOARDS).flatMap((b) => b.actions.filter((a) => a.inner && a.hq)).length, 0);
}
{ // 1A 승인 길 (2026-10-17) — 보드 할 일 inner = 담당에서 끝 · hq = 본부장까지 · 그 밖 리드까지 · 덧칠 actPath
  const g = K.pathGroups(K.BOARDS['ops-order'], null), c = K.pathGroups(K.BOARDS['gh-conv'], null), t = K.pathGroups(K.BOARDS['gh-traffic'], { actPath: { A: 'lead' } });
  eq('이음 = 모두 담당에서 끝 · 겨울 = 판매가(B) 본부장 · G 콜 목록 담당 · C·H·I 리드 · 가을 A 덧칠 = 리드', [g.owner.join(''), g.lead.length + g.hq.length, c.hq.join(''), c.owner.join(''), c.lead.join(''), t.owner.includes('A'), t.lead.includes('A')], ['ABCDEF', 0, 'B', 'G', 'CHI', false, true]);
  eq('묶음 글', K.pathGroupsL({ owner: ['A'], lead: ['B', 'C'], hq: [] }), '담당에서 끝 A · 리드까지 B·C');
}
{ // 2A 변화 없음 셈 (crew.html 이 stHist·actHist 를 씀 · 업무OS 금요일 보고가 셈)
  const bv = { stHist: { '2026-10-19': { A: '변화 없음', B: '대기: 자료 없음', C: '표 올림' }, '2026-10-20': { A: '누락 0', R: '맡긴 일' }, '2026-10-26': { A: '변화 없음' } }, actHist: { '2026-10-19': { C: true } } };
  eq('변화 없음 = [상태]만 남긴 할 일 (결과 올린 날 · 대기·막힘 · 맡긴 일 · 기간 밖 빼고)', K.quietOf(bv, '2026-10-19', '2026-10-25', new Set(['2026-10-20~A'])), { A: 1 });
  eq('불러온 승인 건이 없으면 그날도 셈 · 글', [K.quietOf(bv, '2026-10-19', '2026-10-25', null), K.quietLine({ A: 2, F: 1 }), K.quietLine({})], [{ A: 2 }, '변화 없음 3번 (A 2 · F 1)', '']);
  eq('그날 올린 할 일 = 승인 건 글자 (맡긴 일 R 빼고)', K.actDayOf([{ act: 'A' }, { act: 'C' }, { act: 'R' }, { act: '' }]), { A: true, C: true });
}
{ // 2A 할 게 있을 때만 — 지시문 '언제 하나요'
  ok("지시문 = 매일 할 일은 할 게 있을 때만 · 없으면 [상태] '변화 없음'", K.asideText(K.BOARDS['gh-traffic']).includes("- 매일 하는 할 일은 바꿀 것·할 것이 있을 때만 표를 올린다 (사장님 2026-10-17) — 없으면 그 [ ] 묶음을 통째로 지우고 [상태]에 '변화 없음'만 쓴다"));
}

// ── 2026-10-18 사장님 3A: 볼트 '00 최신 요약' → 허브 mkt-notes/vault-latest → 지시문 '■ 볼트 최신 요약' ──
{ // team_link.py 가 실제로 만든 요약 글을 crew.js 가 읽음 (두 쪽이 같은 모양인지)
  const { execFileSync } = await import('node:child_process'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-')), wk = path.join(tmp, '04 자료', '주간 보고');
  fs.mkdirSync(path.join(tmp, '02 팀원'), { recursive: true }); fs.mkdirSync(wk, { recursive: true });
  fs.writeFileSync(path.join(wk, '2026-10-12 B2C 크루.md'), '# 주간\n- **단계 숫자** 유입 · 가을: 방문 1,234 ← 1,000\n- **단계 숫자** 전환 · 겨울: 구매전환율 2.1% (문의 010-1234-5678)\n- 다른 줄\n');
  const py = `import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T
asks = [{'mate': 'yeoreum', 'act': 'J', 'state': 'ok', 'okAt': T.now_iso(), 'items': [{'n': 'J1', 'c': {'실험': '릴스 첫 3초', '판정': 'B 이김', '이긴 것': '전후 비교 첫 컷'}}]}]
t = T.summary_note(asks, {'A·B 장부': 1, '주간 보고': 1}); print(json.dumps({'t': t, 'd': T.kst_today(), 'f': open(T.os.path.join(T.VAULT, T.ARCH, '00 최신 요약.md'), encoding='utf-8').read() == t}))`;
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', MKT_VAULT: tmp } }));
  fs.rmSync(tmp, { recursive: true, force: true });
  ok('summary_note = 볼트에 쓴 글 그대로 돌려줌 (그 글을 허브에 올림)', got.f && /^---\n유형: 자료\n자료: 최신 요약\n기준일: /.test(got.t));
  const v = K.vaultRows({ body: got.t, date: got.d, kind: 'vault' }, new Date());
  eq('칸 = 이긴 소재 · 주간 단계 숫자 (최신 자료 링크 · 쌓인 수 · 볼트 일하는 법 · 인용 줄 뺌)', v.secs.map((x) => x.h), ['최근 4주 이긴 소재 (A/B)', '최근 주간 보고 단계 숫자 (2026-10-12)']);
  eq('줄 = 굵게·링크 풀고 · 전화 가림', v.secs[1].lines, ['- 단계 숫자 유입 · 가을: 방문 1,234 ← 1,000', '- 단계 숫자 전환 · 겨울: 구매전환율 2.1% (문의 010-****-****)']);
  ok('이긴 소재 줄', /^- \d{4}-\d{2}-\d{2} 여름 J · 릴스 첫 3초 → 이긴 것: 전후 비교 첫 컷$/.test(v.secs[0].lines[0]));
  const t = K.asideText(K.BOARDS['gh-traffic'], { vault: v, ledger: [] }), i = t.indexOf('■ 볼트 최신 요약');
  ok('지시문 자리 = 단계 미션 다음 · ■ 0 앞', i > t.indexOf('■ 단계 미션') && i < t.indexOf('■ 0. 먼저') && t.indexOf('■ 단계 미션') >= 0);
  ok('B2C(공용 장부 같이) = 이긴 소재 칸 빼고 장부 안내 · 단계 숫자 칸은 넣음', t.includes(`■ 볼트 최신 요약 (기준일 ${Number(got.d.slice(5, 7))}/${Number(got.d.slice(8, 10))} · 볼트 '04 자료/00 최신 요약'`) && t.includes('[최근 주간 보고 단계 숫자 (2026-10-12)]') && !t.includes('[최근 4주 이긴 소재 (A/B)]') && t.includes("(A/B 이긴 소재는 아래 '■ 공용 이긴 소재 장부')") && t.includes('이 숫자를 지표로 옮겨 적지 않는다'));
  ok('장부를 못 읽었으면(없음) 이긴 소재 칸도 넣음', K.asideText(K.BOARDS['gh-traffic'], { vault: v }).includes('[최근 4주 이긴 소재 (A/B)]'));
  ok('요약이 없으면 칸 없음', !K.asideText(K.BOARDS['gh-traffic'], {}).includes('■ 볼트 최신 요약') && !K.asideText(K.BOARDS['gh-traffic'], { vault: null, ledger: [] }).includes('볼트 최신 요약'));
}
{ // 거르기 · 오래된 요약 · 줄 수
  const now = new Date('2026-10-20T03:00:00Z');
  const body = ['---', '기준일: 2026-10-20', '---', '# 00 최신 요약', '> 인용', '## 최신 자료', '- [[04 자료/A·B 장부/2026-10|2026-10]]', '## 고객 소리', '- 원가 1,000원 줄', '- 많이 나온 말: 냄새 [[04 자료/고객의 소리/2026-10|10월]] · a.b@c.co.kr',
    '| 말 | 수 |', '|---|---|', '| 냄새 | 4 |', '## 쌓인 자료 수', '| NPS | 2 |', '## 비는 칸', '> 메모만'].join('\n');
  const v = K.vaultRows({ body, date: '2026-10-20' }, now);
  eq('원가 줄 뺌 · 링크 = 이름 · 메일 가림 · 표 = 한 줄 · 빈 칸 뺌', v.secs, [{ h: '고객 소리', lines: ['- 많이 나온 말: 냄새 10월 · (메일 가림)', '- 말 · 수', '- 냄새 · 4'] }]);
  eq('기준일 · 며칠 전', [v.date, v.age, K.vaultRows({ body, date: '2026-10-15' }, now).age], ['2026-10-20', 0, 5]);
  ok('3일 넘으면 멈췄을 수 있음 · 14일 넘으면 안 넣음 · 날짜·글 없으면 안 넣음', K.vaultText(K.vaultRows({ body, date: '2026-10-15' }, now))[0].includes('· 5일 전 — 자료 쌓기가 멈췄을 수 있음 · 참고만') && K.vaultRows({ body, date: '2026-10-05' }, now) === null && K.vaultRows({ body }, now) === null && K.vaultRows({ body: ' ', date: '2026-10-20' }, now) === null);
  const many = K.vaultRows({ body: ['## 긴 칸', ...Array.from({ length: 30 }, (_, i) => `- 줄 ${i + 1}`)].join('\n'), date: '2026-10-20' }, now), mt = K.vaultText(many);
  ok(`줄 ${K.VAULT_MAX_LINES}개까지 + 더 있음`, mt.includes(`- 줄 ${K.VAULT_MAX_LINES}`) && !mt.includes(`- 줄 ${K.VAULT_MAX_LINES + 1}`) && mt.some((x) => x.startsWith('… (더 있음')));
  eq('비어 있다는 안내 줄만 있는 칸 = 뺌 (NPS · 링크 성과 처음) · 다른 줄은 남김', K.vaultRows({ body: ['## 최근 30일 NPS (유선 조사)', '- 아직 남긴 점수 없음 — 바람 C …', '## 최근 4주 링크 성과', '- 아직 없음 — 별 D …', '- 1018-ab12-2 글 · 방문 3', '## 최근 주간 보고 단계 숫자', '- 단계 숫자 칸이 아직 비어 있음'].join('\n'), date: '2026-10-20' }, now).secs,
    [{ h: '최근 4주 링크 성과', lines: ['- 1018-ab12-2 글 · 방문 3'] }]);
  eq('남는 칸이 없으면(이긴 소재만 · 장부 같이) 지시문에 안 넣음', K.vaultText({ date: '2026-10-20', age: 0, secs: [{ h: '최근 4주 이긴 소재 (A/B)', lines: ['- x'] }] }, { ledger: true }), []);
}


// ── 2026-10-18 사장님 2-2A 링크 꼬리표 (utm.js · 자사몰 utm · 스마트스토어 nt) ──
{ const T = { source: 'naver_blog', medium: 'content', campaign: '2026-10_content', content: '1018-ab12-2' };
  const MALL = 'https://grohome.co.kr/product/detail.html?product_no=12', SS = 'https://smartstore.naver.com/grohome/products/1';
  const UT = 'utm_source=naver_blog&utm_medium=content&utm_campaign=2026-10_content&utm_content=1018-ab12-2', NT = 'nt_source=naver_blog&nt_medium=content&nt_detail=2026-10_content&nt_keyword=1018-ab12-2';
  eq('자사몰 = utm 4개 · 스마트스토어 = nt 4개 · 쿠팡·인스타·카카오는 그대로', [K.tagUrl(MALL, T), K.tagUrl(SS, T), ...['https://www.coupang.com/vp/products/1', 'https://www.instagram.com/p/x', 'https://pf.kakao.com/_x/chat'].map((u) => K.tagUrl(u, T) === u)],
    [`${MALL}&${UT}`, `${SS}?${NT}`, true, true, true]);
  eq('# 뒤 그대로 · 이미 꼬리표 = 그대로 · ? 로 끝나면 & 없이 · m.·www. 도', [K.tagUrl('https://www.pourstore.net/product/a.html#review', T), K.tagUrl('https://grohome.co.kr/p?utm_source=a', T), K.tagUrl('https://grohome.co.kr/p?', T), K.linkKind('https://m.grohome.co.kr/x'), K.linkKind('https://m.brand.naver.com/x'), K.linkKind('https://grohome.co.kr.evil.com/x')],
    [`https://www.pourstore.net/product/a.html?${UT}#review`, 'https://grohome.co.kr/p?utm_source=a', `https://grohome.co.kr/p?${UT}`, 'mall', 'naver', '']);
  eq('떼기 = 꼬리표만 · 다른 칸 남김 · 밖은 그대로', [K.untagUrl(`${MALL}&${UT}`), K.untagUrl(`${SS}?${NT}`), K.untagUrl('https://www.pourstore.net/product/d.html?product_no=7&utm_source=x&cate_no=3#a'), K.untagUrl('https://x.com/?utm_source=a')],
    [MALL, SS, 'https://www.pourstore.net/product/d.html?product_no=7&cate_no=3#a', 'https://x.com/?utm_source=a']);
  const md = `[링크: 롤러 구매하기 → ${MALL}]\n[글](https://www.pourstore.net/product/a.html). 끝 ${SS}, 그리고 https://pf.kakao.com/_x/chat`, tm = K.tagLinks(md, T);
  eq('글 안 주소: 링크 카드 · [글](주소) · 끝 문장부호 · 카카오 그대로 · 떼면 원래 글', [K.linkCount(md), tm.includes(`${MALL}&${UT}]`), tm.includes(`a.html?${UT}). 끝`), tm.includes(`${SS}?${NT}, 그리고`), tm.includes('https://pf.kakao.com/_x/chat'), K.untagLinks(tm) === md, K.tagLinks(tm, T) === tm],
    [3, true, true, true, true, true, true]);
  const pk = K.postKey('2026-10-18 여름 블로그 원고 3', 2, '2026-10-20');
  ok('글 키 = 발행 날짜 · 노트 지문 4자 · 번호 (POST_KEY_RE) · 날짜 없으면 노트 날짜', /^1020-[0-9a-z]{4}-2$/.test(pk) && K.POST_KEY_RE.test(pk) && K.postKey('2026-10-18 여름 블로그 원고 3', 2, '').startsWith('1018-') && K.POST_KEY_RE.test(K.postKey('x', 1)) && pk.slice(5, 9) === K.postKey('2026-10-18 여름 블로그 원고 3', 1, '2026-10-21').slice(5, 9));
  eq('글 꼬리표 = 채널 · content · 달_content · 글 키', [K.postTag({ channel: 'cafe', noteId: '2026-10-18 여름 재배포', n: 1, date: '2026-10-21' }), K.postTag({ channel: '???', noteId: 'n', n: 1, date: '2026-11-02' }).source],
    [{ source: 'naver_cafe', medium: 'content', campaign: '2026-10_content', content: K.postKey('2026-10-18 여름 재배포', 1, '2026-10-21') }, 'etc']);
  eq('메시지 꼬리표 = act.utm · 달_보드 · 올린 날-번호 (번호 없으면 할 일 글자)', [K.actTag({ s: 'influencer', m: 'influencer' }, { board: 'gh-exp', act: 'A', run: '2026-10-20', n: 'A3' }), K.actTag(null, { board: 'gh-ref', act: 'B', run: '2026-10-20' }).content, K.tagText({ source: 'crm', medium: 'message', campaign: '2026-10_gh-ref', content: '1020-B1' })],
    [{ source: 'influencer', medium: 'influencer', campaign: '2026-10_gh-exp', content: '1020-A3' }, '1020-B', 'crm · message · 2026-10_gh-ref · 1020-B1']);
  ok('메시지 키 ACT_KEY_RE ≠ 글 키', K.ACT_KEY_RE.test('1020-A3') && K.ACT_KEY_RE.test('1020-B') && !K.ACT_KEY_RE.test('1020-a3') && !K.POST_KEY_RE.test('1020-A3') && !K.ACT_KEY_RE.test('1018-ab12-2'));
  eq('보내는 할 일 = utm 있음 (인플루언서 · 공구 · 문자·알림톡) · 숫자 표(별 D) · 주소 표(봄 I)는 없음', ['gh-exp.A', 'gh-exp.D', 'gh-exp.G', 'gh-exp.I', 'gh-rep.C', 'gh-rep.G', 'gh-ref.A', 'gh-ref.B', 'gh-ohou.H', 'ops-report.D', 'gh-ohou.I', 'gh-ref.C'].map((k) => { const [b, c] = k.split('.'), a = K.actOf(b, c); return a ? (a.utm ? `${a.utm.s}/${a.utm.m}` : '-') : '없음'; }),
    ['influencer/influencer', 'groupbuy/influencer', 'influencer/influencer', 'community/community', 'crm/message', 'crm/message', 'crm/message', 'crm/message', 'crm/message', '-', '-', '-']);
  // AI 크루가 올린 표 → 승인 건: 보내는 할 일만 꼬리표 (세부 = 올린 날-번호) · 그 밖 할 일·인스타 주소는 그대로
  const head = K.actOf('gh-exp', 'A').cols.join('\t'), row = ['살림A', '그로홈', '인스타', '1.2만', '3만', '-', '롤러', 'https://www.instagram.com/p/1', `안녕하세요 롤러 보내 드릴게요 ${MALL}`, SS].join('\t');
  const pe = K.parseCrew(['[A]', `요약: 후보 1명 ${MALL}`, head, row, '[I]', '요약: 주소', K.actOf('gh-exp', 'I').cols.join('\t'), K.actOf('gh-exp', 'I').cols.map((c, i) => (i === 0 ? `https://www.pourstore.net/product/b.html` : 'x')).join('\t')].join('\n'), K.boardOf('gh-exp'));
  const ae = K.asksFromParse(pe, { board: 'gh-exp', mate: 'yeoreum', brand: 'grohome', run: '2026-10-20', at: '2026-10-20T00:00:00.000Z', owner: 'u1', src: 'crew' }), aA = ae.find((a) => a.act === 'A'), aI = ae.find((a) => a.act === 'I');
  const AT = 'utm_source=influencer&utm_medium=influencer&utm_campaign=2026-10_gh-exp&utm_content=1020-A1';
  eq('gh-exp A: DM 초안 자사몰 = utm(세부 1020-A1) · 링크 스마트스토어 = nt · 인스타 그대로 · 요약 = 1020-A', [aA.items[0].c['DM 초안'], aA.items[0].c['링크'], aA.items[0].c['DM 근거 게시물'], aA.sum],
    [`안녕하세요 롤러 보내 드릴게요 ${MALL}&${AT}`, `${SS}?nt_source=influencer&nt_medium=influencer&nt_detail=2026-10_gh-exp&nt_keyword=1020-A1`, 'https://www.instagram.com/p/1', `후보 1명 ${MALL}&utm_source=influencer&utm_medium=influencer&utm_campaign=2026-10_gh-exp&utm_content=1020-A`]);
  ok('gh-exp I(커뮤니티 · utm community) 도 꼬리표', !!aI && Object.values(aI.items[0].c).some((v) => String(v).includes('utm_source=community&utm_medium=community&utm_campaign=2026-10_gh-exp&utm_content=1020-I1')));
  const po = K.parseCrew(['[I]', '요약: 주소 표', K.actOf('gh-ohou', 'I').cols.join('\t'), ['GH-P001-03031', '롤러일체형 페인트', '그로홈', MALL].join('\t')].join('\n'), K.boardOf('gh-ohou'));
  eq('봄 I(자사몰 주소 표) = 꼬리표 안 붙음 · 담당에서 끝 · 실행 업무 없음', (([a]) => [a.items[0].c['자사몰 주소'], a.exec, a.hq])(K.asksFromParse(po, { board: 'gh-ohou', mate: 'bom', brand: 'grohome', run: '2026-10-20', at: '', owner: 'u1', src: 'crew' })), [MALL, '', '']);
  const ta = K.asideText(K.BOARDS['gh-exp']);
  ok('지시문: 보내는 할 일마다 링크 안내 · ■5 직접 붙이지 않음 · 판 10-18.2', ta.includes('  링크: 자사몰·스마트스토어 상품 주소는 꼬리표 없이 그대로 쓴다 — 올릴 때 이 화면이 이 할 일의 꼬리표(influencer · influencer ·') && ta.includes('- 링크에 utm·nt 꼬리표를 직접 붙이지도 지우지도 않는다') && ta.includes('판 ' + K.ASIDE_VER));
  eq('허브 core.js 글 채널 열쇠 = 꼬리표 채널 열쇠 (글 꼬리표 source)', Object.keys(K.POST_SOURCE), Object.keys(C.CHANNEL));
}
// ── 2026-10-18 사장님 2-1A NPS 점수 · 2-3A 링크 성과 ──
{ eq('NPS 할 일 = 바람 C (예전 우주 F · 튼튼 A)', [K.isNpsAct('baram', 'C'), K.isNpsAct('uju', 'F'), K.isNpsAct('teunteun', 'A'), K.isNpsAct('baram', 'A')], [true, true, true, false]);
  eq('점수 = 0~10 정수만', ['', null, true, '9', 10, 11, -1, 5.5, 'x', 0].map(K.npsScore), [null, null, null, 9, 10, null, null, null, null, 0]);
  eq('NPS = 9~10 비율 − 0~6 비율 · 중립 7~8', [K.npsOf([10, 9, 7, 3]), K.npsOf([]), K.npsLine(K.npsOf([10, 9, 7, 3])), K.npsLine(null)], [{ n: 4, pro: 2, mid: 1, det: 1, nps: 25 }, null, 'NPS 25 (4명 · 추천 2 · 중립 1 · 비추천 1)', '']);
  eq('흔적 점수 = 그 기간 · 했어요만 · NPS 할 일만', K.npsFromTraces([{ mate: 'baram', act: 'C', trace: { C1: { done: true, score: 10, date: '2026-10-15' }, C2: { skip: true, score: 0, date: '2026-10-15' }, C3: { done: true, score: 2, date: '2026-09-01' }, C4: { done: true, date: '2026-10-16' } } },
    { mate: 'baram', act: 'A', trace: { A1: { done: true, score: 0, date: '2026-10-15' } } }], '2026-10-01', '2026-10-18'), { n: 1, pro: 1, mid: 0, det: 0, nps: 100 });
  const tb = K.asideText(K.BOARDS['gh-ref'], { nps: { r: K.npsOf([10, 9, 6]), from: '2026-09-19', to: '2026-10-18' } }), tb0 = K.asideText(K.BOARDS['gh-ref'], { nps: { r: null, from: '2026-09-19', to: '2026-10-18' } });
  ok('바람 지시문: 업무OS 계산 NPS → [지표] nps 그대로 · 점수 없으면 nps 줄 지움 · 못 읽으면 줄 없음', tb.includes('  → 업무OS 계산 값 (사람이 [했어요]에 남긴 점수 · 9/19~10/18): NPS 33 (3명 · 추천 2 · 중립 0 · 비추천 1) — [지표] nps 에 33 그대로 쓴다')
    && tb0.includes('  → 업무OS 계산 값: 9/19~10/18 남긴 점수 없음 — [지표] nps 줄은 지운다') && !K.asideText(K.BOARDS['gh-ref']).includes('→ 업무OS 계산 값'));
  ok('바람 C = 추천 점수(0~10) 남김 · 지난 NPS 는 업무OS 계산 값', /\[했어요\]에 추천 점수\(0~10\)와 이유 한 줄/.test(K.execOf(K.actOf('gh-ref', 'C'))) && K.actOf('gh-ref', 'C').s.some((x) => x.includes('■ 1 의 업무OS 계산 값')));
  // 링크 성과: 잴 글 = 허브 '발행 완료' · 글 키 · 최근 8주 · 개인정보 가림
  const now = new Date('2026-10-23T03:00:00Z'), P1 = { status: 'published', tagKey: '1018-ab12-2', channel: 'naver_blog', brand: 'pourstore', publishedAt: '2026-10-20T01:00:00.000Z', url: 'https://blog.naver.com/x/1', title: '균열 보수 글 010-1234-5678' };
  const rows = K.postRows([P1, { ...P1, tagKey: '1018-ab12-3', status: 'draft' }, { ...P1, tagKey: '없음' }, { ...P1, tagKey: '0801-ab12-1', publishedAt: '2026-08-01T01:00:00.000Z' }, { ...P1, tagKey: '1019-cd34-1', url: 'javascript:x', publishedAt: '2026-10-21T01:00:00.000Z', channel: 'cafe', brand: '' }, { ...P1, tagKey: '1019-cd34-2', brand: '그로홈', publishedAt: '2026-10-21T00:00:00.000Z' }, { ...P1, tagKey: '1019-cd34-3', brand: '<b>x', publishedAt: '2026-10-21T00:00:00.000Z' }], now);
  eq('잴 글 = 발행 완료 · 글 키 모양 · 8주 안 · 새 것 먼저 · 주소는 http 만 · 전화 가림', rows.map((r) => [r.key, r.ch, r.brand, r.at, r.url, r.title]),
    [['1019-cd34-1', '네이버 카페', '', '2026-10-21', '', '균열 보수 글 010-****-****'], ['1019-cd34-2', '네이버 블로그', '그로홈', '2026-10-21', 'https://blog.naver.com/x/1', '균열 보수 글 010-****-****'], ['1019-cd34-3', '네이버 블로그', '', '2026-10-21', 'https://blog.naver.com/x/1', '균열 보수 글 010-****-****'], ['1018-ab12-2', '네이버 블로그', 'POUR스토어', '2026-10-20', 'https://blog.naver.com/x/1', '균열 보수 글 010-****-****']]);
  eq('잴 글 한 줄', K.postRowLine(rows[3]), '- 1018-ab12-2 · 네이버 블로그 · POUR스토어 · 10/20 발행 · https://blog.naver.com/x/1 · 균열 보수 글 010-****-****');
  const ts = K.asideText(K.BOARDS['ops-report'], { posts: rows }), ts0 = K.asideText(K.BOARDS['ops-report'], { posts: [] });
  ok('별 지시문: ■ 잴 글 목록 (■ 1 앞) · 없으면 안내 · 못 읽으면 칸 없음', ts.indexOf('■ 잴 글 목록') > 0 && ts.indexOf('■ 잴 글 목록') < ts.indexOf('■ 1. 지표') && ts.includes(K.postRowLine(rows[0])) && ts0.includes("- 아직 없음 — 허브에서 '발행 완료'로 표시된 글이 생기면 여기 보인다 (그때까지 D 는 메시지 키 줄만)") && !K.asideText(K.BOARDS['ops-report']).includes('■ 잴 글 목록 —') && !K.asideText(K.BOARDS['gh-exp'], { posts: rows }).includes('■ 잴 글 목록 —'));
  const it = (n, c) => ({ n, c });
  const st = K.linkStatRows([it('D1', { 세부: '1018-ab12-2', 어디서: '카페24 그로홈', 방문: '120', 구매: '3', 매출: '45,000원', 조회: '' }), it('D2', { 세부: '1018-ab12-2', 어디서: '스마트스토어 그로홈', 방문: '30', 구매: '1', 매출: '15000', 조회: '800' }),
    it('D3', { 세부: '1020-C1', 방문: '12' }), it('D4', { 세부: '1018-zz99-1' }), it('D5', { 세부: '1018-ab12-2', 조회: '700' })]);
  eq('별 D 줄 → 글 키마다: 방문·구매·매출 합 · 조회 큰 값 · 어디서 묶음 · 메시지 키·숫자 없는 줄 빼고', st, [{ key: '1018-ab12-2', where: '카페24 그로홈 + 스마트스토어 그로홈', visits: 150, buys: 4, sales: 60000, views: 800 }]);
  eq('숫자 한 줄', [K.linkStatLine(st[0]), K.linkStatLine({ visits: 0 }), K.linkStatLine(null)], ['방문 150 · 구매 4 · 매출 60,000원 · 조회 800', '방문 0', '']);
  // team_link.py (볼트 · 같은 계산) — NPS · 링크 합 · 자사몰 주소 · 키 모양
  const MALL = 'https://grohome.co.kr/product/detail.html?product_no=12', SS = 'https://smartstore.naver.com/grohome/products/1';
  const UT = 'utm_source=naver_blog&utm_medium=content&utm_campaign=2026-10_content&utm_content=1018-ab12-2', NT = 'nt_source=naver_blog&nt_medium=content&nt_detail=2026-10_content&nt_keyword=1018-ab12-2';
  const { execFileSync } = await import('node:child_process');
  const SC = [[10, 9, 7, 3], [10, 8, 8, 8, 8, 8, 8, 8], [1, 8, 8, 8, 8, 8, 8, 8], [], [0, 0, 10], ['9', 'x', null, true, 11, 5.5], [6, 6, 9]];
  const IT = [{ 세부: '1018-ab12-2', 어디서: '카페24 그로홈', 방문: '120', 구매: '3', 매출: '45,000원' }, { 세부: '1018-ab12-2', 어디서: '스마트스토어 그로홈', 방문: '30', 매출: '15000', 조회: '800' }, { 세부: '1018-ab12-2', 조회: '700' }, { 세부: '1020-C1', 방문: '12' }];
  const py = `import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T
a = json.loads(sys.argv[2]); asks = [{'mate': 'byeol', 'act': 'D', 'state': 'ok', 'run': '2026-10-23', 'items': [{'n': f'D{i+1}', 'c': c} for i, c in enumerate(a['it'])]}]
rows = sorted(T.link_sum(T.link_rows(asks)), key=lambda x: x['key'])
print(json.dumps({'nps': [T.nps_of(x) for x in a['sc']], 'line': T.nps_line(T.nps_of([10, 9, 7, 3])), 'acts': sorted(map(list, T.NPS_ACTS)), 'mall': T.MALL_HOSTS, 'pk': T.POST_KEY_RE.pattern, 'ak': T.ACT_KEY_RE.pattern,
  'links': [{k: r[k] for k in ('key', 'kind', 'where', 'visits', 'buys', 'sales', 'views')} for r in rows], 'la': sorted(map(list, T.LINK_ACTS)), 'ma': sorted(map(list, T.MALL_ACTS)),
  'url': [T.mall_url(u) for u in a['urls']], 'card': T.CARD_FIELD}, ensure_ascii=False))`;
  const URLS = [`${MALL}&${UT}`, 'https://grohome.co.kr/', `${SS}?${NT}`, 'https://www.pourstore.net/product/d.html?product_no=7&utm_source=x&cate_no=3#a'];
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname, JSON.stringify({ sc: SC, it: IT, urls: URLS })], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py NPS = crew.js npsOf (반올림 .5 올림 · 음수 · 이상한 값)', got.nps, SC.map((x) => K.npsOf(x)));
  eq('team_link.py NPS 한 줄 · NPS 할 일 = crew.js', [got.line, got.acts], [K.npsLine(K.npsOf([10, 9, 7, 3])), K.NPS_ACTS.map((x) => x.split('.')).sort()]);
  eq('team_link.py 자사몰 주소 목록 · 키 모양 = utm.js', [got.mall, got.pk, got.ak], [K.MALL_HOSTS, K.POST_KEY_RE.source, K.ACT_KEY_RE.source]);
  eq('team_link.py 링크 합 = crew.js linkStatRows (글 키 · 메시지 키는 볼트만)', got.links, [{ key: '1018-ab12-2', kind: '글', where: '카페24 그로홈 + 스마트스토어 그로홈', visits: 150, buys: 3, sales: 60000, views: 800 }, { key: '1020-C1', kind: '메시지', where: '', visits: 12, buys: null, sales: null, views: null }]);
  eq('JS 쪽 같은 줄 = 같은 글 키 숫자', K.linkStatRows(IT.map((c, i) => it(`D${i + 1}`, c))).map((x) => [x.key, x.where, x.visits, x.buys, x.sales, x.views]), [['1018-ab12-2', '카페24 그로홈 + 스마트스토어 그로홈', 150, 3, 60000, 800]]);
  eq('team_link.py 할 일 = 별 D(links) · 봄 I(자사몰 주소) · 카드 칸 자사몰주소', [got.la, got.ma, got.card, !!K.actOf('ops-report', 'D').links, K.actOf('gh-ohou', 'I').cols.includes('자사몰 주소')], [[['byeol', 'D']], [['bom', 'I']], '자사몰주소', true, true]);
  eq('team_link.py 자사몰 주소 = 꼬리표 떼고 상품 주소만 (utm.js untagUrl 과 같게 · 첫 화면·스마트스토어 = 빈칸)', got.url, [MALL, '', '', K.untagUrl(URLS[3])]);
}

// Aside 세팅 쉽게 (2026-10-19 사장님 1A~4A) — 사이트 [열기] 주소 · 시험 한 번 글(예약 아님) · 시험할 크루
{ const L = K.loginSites([K.boardOf('gh-traffic')]), u = Object.fromEntries(L.map((x) => [x.s, x.u]));
  eq('로그인해 둘 곳 [열기] = 확실한 주소만 · 모르는 곳은 빈칸', [u['카페24'], u['메타 광고관리자'], u['오늘의집 파트너센터'], L.every((x) => x.u === '' || /^https:\/\//.test(x.u))], ['https://eclogin.cafe24.com/Shop/', 'https://adsmanager.facebook.com/', '', true]);
  const T = K.asideNowLaunch(K.boardOf('gh-conv'));
  eq('시험 한 번 글 = 지금 한 번(예약 아님) · 화면 지시문 그대로 · 짧게', [T.split('\n')[0], T.includes('crew.html#gh-conv'), T.includes('예약 작업은 만들지 않는다'), T.length < 700], ['[AI 크루 · 겨울 (전환마케터 · UX/UI·응대) · 그로홈 전환 보드] 지금 한 번 (시험 · 예약 아님)', true, true, true]);
  const R = (id, t) => ({ board: K.boardOf(id), t });
  eq('시험할 크루 = 평일 크루 중 처음 · 주 1회만 있으면 그것', [K.testRunOf([R('hq-plan', '09:00'), R('gh-ref', '10:00')]).board.id, K.testRunOf([R('hq-plan', '09:00')]).board.id, K.testRunOf([])], ['gh-ref', 'hq-plan', null]);
}

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
