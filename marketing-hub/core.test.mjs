// node marketing-hub/core.test.mjs — 계산 로직 시험 (Firebase 안 씀)
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('./core.js');
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('✗', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('✓', name); };

// 네이버 키워드 보고서 모양: 위에 제목 줄, 따옴표 안 쉼표, 합계 줄
const naver = '﻿"키워드 보고서(2026.10.07.~2026.10.07.)"\n캠페인,광고그룹,키워드,노출수,클릭수,"평균클릭비용(VAT포함,원)","총비용(VAT포함,원)",전환매출액(원)\n'
  + '방수,옥상,옥상방수,"1,200",30,500,"15,000","60,000"\n방수,옥상,우레탄방수,800,12,700,"8,400",0\n방수,옥상,옥상방수,100,2,500,"1,000",0\n합계,,,2100,44,,"24,400","60,000"\n';
const r = C.analyze(naver, 'naver_ads');
eq('네이버: 성공', r.ok, true);
eq('네이버: 열 연결', r.recognized.map((x) => x.key + '=' + x.column), ['campaign=캠페인', 'keyword=키워드', 'impressions=노출수', 'clicks=클릭수', 'cost=총비용(VAT포함,원)', 'revenue=전환매출액(원)']);
eq('네이버: 합계 줄 빼고 3줄', r.rows.length, 3);
const docs = C.buildDocs(r, 'naver_ads', '2026-10-07');
eq('네이버: 같은 키워드 합침 → 2문서', docs.size, 2);
const ok1 = [...docs.values()].find((d) => d.keyword === '옥상방수');
eq('네이버: 합친 값·ROAS', [ok1.clicks, ok1.cost, ok1.revenue, ok1.roas], [32, 16000, 60000, 375]);
eq('네이버: 다시 올려도 같은 ID', [...C.buildDocs(C.analyze(naver, 'naver_ads'), 'naver_ads', '2026-10-07').keys()], [...docs.keys()]);

// 쿠팡: 탭으로 붙여넣은 표
const coupang = '캠페인명\t광고그룹\t키워드\t노출수\t클릭수\t광고비\t총 전환매출액(1일)\t총 전환매출액(14일)\n자동\t기본\t실리콘\t500\t20\t4,000\t10,000\t24,000\n';
const rc = C.analyze(coupang, 'coupang_ads');
eq('쿠팡: 14일 전환매출 사용', [rc.ok, rc.rows[0].revenue, rc.rows[0].cost], [true, 24000, 4000]);

// 필수 열 없음 → 명확한 문구
const miss = C.analyze('키워드,노출수\n방수,10', 'naver_ads');
eq('필수 열 없음 문구', miss.errors, ["'비용' 열이 없습니다.", "'전환매출' 열이 없습니다."]);
eq('숫자 아님 문구', C.analyze('키워드,비용,매출액\n방수,abc,1', 'naver_ads').errors, ["2번째 줄 '비용' 값이 숫자가 아닙니다: abc"]);
eq('채널 없음', C.analyze('a', 'x').errors, ['채널을 고르세요.']);

// 카페24 판매: 옵션별 여러 줄 → 상품코드로 합침
const cafe = '상품코드,상품명,옵션,판매수량,판매합계\nP001,곰팡이젤,단품,3,"47,700"\nP001,곰팡이젤,2개세트,1,"25,800"\nP002,방수테이프,,2,"20,000"\n';
const rs = C.analyze(cafe, 'cafe24');
const sd = C.buildDocs(rs, 'cafe24', '2026-10-07');
eq('카페24: 2상품', [...sd.keys()], ['2026-10-07_cafe24_P001', '2026-10-07_cafe24_P002']);
eq('카페24: 합친 수량·매출', [sd.get('2026-10-07_cafe24_P001').qty, sd.get('2026-10-07_cafe24_P001').revenue], [4, 73500]);
eq('상품 열 없음', C.analyze('판매수량\n3', 'cafe24').errors, ["'상품코드' 또는 '상품명' 열이 없습니다."]);

// 재고 계획 (레오): 14일 동안 하루 2개 → 일평균 2
const sales = []; for (let i = 0; i < 14; i++) sales.push({ reportDate: C.addDays('2026-10-07', -i), productCode: 'P001', qty: 2 });
sales.push({ reportDate: '2026-09-01', productCode: 'P001', qty: 999 }); // 기간 밖
const plan = C.stockPlan({ reportDate: '2026-10-07', productCode: 'P001', available: 20 }, sales, { defaultLeadTimeDays: 7, safetyDays: 7 });
eq('재고: 일평균·남은일수·발주', plan, { avgDailySales: 2, daysLeft: 10, leadTimeDays: 7, reorderNeeded: true, reorderQty: 54 });
eq('재고: 판매 없으면 판단 안 함', C.stockPlan({ reportDate: '2026-10-07', productCode: 'Z', available: 5 }, sales), { avgDailySales: 0, daysLeft: null, leadTimeDays: 7, reorderNeeded: false, reorderQty: 0 });

// 키워드 판단 (케이)
const adv = C.keywordAdvice([
  { channel: 'naver_ads', keyword: 'a', cost: 20000, revenue: 0, clicks: 30 },
  { channel: 'naver_ads', keyword: 'b', cost: 20000, revenue: 20000, clicks: 30 },
  { channel: 'naver_ads', keyword: 'c', cost: 10000, revenue: 60000, clicks: 30 },
  { channel: 'naver_ads', keyword: 'd', cost: 500, revenue: 0, clicks: 1 },
]);
eq('키워드: 끄기·줄이기·올리기·유지', [adv.off.map((d) => d.keyword), adv.down.map((d) => d.keyword), adv.up.map((d) => d.keyword), adv.keep.map((d) => d.keyword)], [['a'], ['b'], ['c'], ['d']]);

eq('어제(KST): 10/8 00:30 KST', C.yesterdayKST(new Date('2026-10-07T15:30:00Z')), '2026-10-07');
eq('큰 파일 줄이기', C.reducedCsv(rs).split('\n')[0], '상품코드,상품명,판매수량,판매합계');

// 옵시디언 노트·링크
const note = C.obsidianNote({ date: '2026-10-08', sales7: 120000, salesPrev7: 100000, adsDays: 7,
  stock: [{ productCode: 'P001', productName: '곰팡|이젤', available: 20, avgDailySales: 1.86, daysLeft: 10.8, reorderNeeded: true, reorderQty: 49 }],
  advice: adv, sales: [{ code: 'P001', name: '곰팡이젤', q7: 16, r7: 274200, qp: 10 }] });
eq('옵시디언: 속성', note.split('\n').slice(0, 9), ['---', '유형: 숫자', '기준일: 2026-10-08', '매출7일: 120000', '발주필요: 1', '올릴키워드: 1', '줄일키워드: 1', '끌키워드: 1', '---']);
eq('옵시디언: 표 칸의 | 는 / 로', note.includes('| P001 | 곰팡/이젤 | 20 | 1.86 | 10.8일 | 49 |'), true);
eq('옵시디언: 전주 대비', note.includes('(전주 대비 ▲20%)'), true);
const uri = C.obsidianUri('POUR 마케팅 허브', C.OBSIDIAN_NOTE, '가 & b', 'overwrite');
eq('옵시디언: 링크', uri, 'obsidian://new?vault=POUR%20%EB%A7%88%EC%BC%80%ED%8C%85%20%ED%97%88%EB%B8%8C&file=05%20%EC%98%A4%EB%8A%98%20%EC%88%AB%EC%9E%90&content=%EA%B0%80%20%26%20b&overwrite=true');
eq('옵시디언: 허브 붙이기 = append', C.obsidianUri('', C.OBSIDIAN_HUB, 'x', 'append'), 'obsidian://new?file=00%20%ED%97%88%EB%B8%8C&content=x&append=true');

// AI 팀 리듬
eq('팀: 17명 · 번호 겹침 없음', [C.TEAM.length, new Set(C.TEAM.map((m) => m.no)).size], [17, 17]);
eq('팀: 월요일 아침 순서 (2026-10-14 하루·포리·에코 일 = 여름)', C.teamDay('2026-10-12').slice(0, 6).map((x) => x.t + ' ' + x.name), ['06:50 여름', '08:00 루나', '08:30 레오', '08:30 다온', '09:00 케이', '09:00 리아']);
eq('팀: 보이는 팀원 = 여름 + 쉬지 않는 14명', [C.teamShown().length, C.teamShown()[0].name, C.teamShown().some((m) => ['하루', '포리', '에코'].includes(m.name))], [15, '여름', false]);
eq('팀: 토요일은 쉼', C.teamDay('2026-10-10'), []);
eq('팀: 말일 계산(10/30 금은 말일 아님 · 10/31 토 · 12월 분기) · 하루가 쉬어서 목록엔 없음', [C.teamDay('2026-10-31'), C.nextRun(C.teamMember('haru'), { date: '2026-10-30', time: '17:10' }), C.nextRun(C.teamMember('haru'), { date: '2026-12-31', time: '17:10' })],
  [[], { date: '2026-10-31', t: '17:00', what: '월간 리포트' }, { date: '2026-12-31', t: '17:30', what: '다음 분기 시즌 캘린더' }]);
eq('팀: 2주마다 (10/12 → 10/26)', ['2026-10-12', '2026-10-19', '2026-10-26'].map((d) => C.teamDay(d).some((x) => x.what.startsWith('리뷰 이벤트'))), [true, false, true]);
eq('팀: 다음 차례 — 오늘 지난 시각은 다음 날로', [C.nextRun(C.teamMember('포리'), { date: '2026-10-12', time: '06:40' }), C.nextRun(C.teamMember('포리'), { date: '2026-10-12', time: '06:50' })],
  [{ date: '2026-10-12', t: '06:50', what: '공식 블로그 원고 3 · 사진 지정 · 제목 A/B' }, { date: '2026-10-13', t: '06:50', what: '공식 블로그 원고 3 · 사진 지정 · 제목 A/B' }]);
eq('팀: 여름 다음 차례 = 평일 06:50 아침 루틴', C.nextRun(C.teamMember('여름'), { date: '2026-10-16', time: '07:00' }), { date: '2026-10-19', t: '06:50', what: '블로그 주제 3 → 공식 블로그 원고 3 → 티스토리·카페 재배포' });
eq('팀: 정해진 일 없으면 null', C.nextRun(C.teamMember('테오'), { date: '2026-10-12', time: '07:00' }), null);
eq('팀: 주기 말', C.teamMember('haru').runs.map(C.RUN_WORD), ['평일 06:50', '월 09:30', '금 17:00', '매월 말일 17:00', '3·6·9·12월 말일 17:30']);
eq('팀: 가동 = 여름 아침 루틴만 (하루·포리·에코 쉼)', [C.TEAM.filter((m) => m.live).map((m) => m.name), C.TEAM.filter((m) => m.gone).map((m) => m.name + '→' + m.gone), C.teamDay('2026-10-12').filter((x) => x.live).map((x) => x.name + ' ' + x.t)],
  [[], ['하루→yeoreum', '포리→yeoreum', '에코→yeoreum'], ['여름 06:50']]);
// 자동 작업 (트리거) 목록 — 2026-10-12
const AU = C.automations(), AS = C.autoSummary(AU), au0 = (id) => AU.find((a) => a.id === id) || {};
eq('자동 작업: 걸어 둔 것 = 동작 중 4 · 준비 중 14(크루 Aside 10 포함 · 2026-10-17 B2B 크루 닫음) · 나머지는 팀원 계획', [AS.on, AS.wait, AS.plan === AU.length - 18], [4, 14, true]);
eq('자동 작업: 크루 Aside 10 = 담당 PC · 평일 09:00 동시에 · 다음 실행 · 이름 (2026-10-15 · 2026-10-17 B2B 5개 닫고 10개)', [AU.filter((a) => /^aside-crew-/.test(a.id)).length, C.autoNext(au0('aside-crew-gh-traffic'), { date: '2026-10-16', time: '08:30' }), C.autoNext(au0('aside-crew-gh-aov'), { date: '2026-10-16', time: '09:30' }), au0('aside-crew-gh-conv').name, au0('aside-crew-gh-conv').who, C.AUTO_WHERE[au0('aside-crew-gh-rep').where]],
  [10, { date: '2026-10-16', t: '09:00' }, { date: '2026-10-19', t: '09:00' }, 'AI 크루 · 겨울 (전환 보드)', '겨울', 'Aside (담당 PC)']);
eq('자동 작업: 주 1~2회 크루 = 그 요일 (달 월 · 별 금) · 닫힌 B2B 크루(단단 등)는 목록에 없음', [C.autoNext(au0('aside-crew-hq-plan'), { date: '2026-10-16', time: '08:30' }), C.autoNext(au0('aside-crew-ops-report'), { date: '2026-10-16', time: '08:30' }), AU.some((a) => /^aside-crew-b2b-/.test(a.id)), C.CREW_ASIDE.filter((c) => c.closed).map((c) => c.board)],
  [{ date: '2026-10-19', t: '09:00' }, { date: '2026-10-16', t: '09:00' }, false, ['b2b-inq', 'b2b-exp', 'b2b-deal', 'b2b-aov', 'b2b-re']]);
eq('자동 작업: 아침 루틴 = 여름 · 쉬는 하루·포리·에코 일은 목록에 없음', [au0('ai-morning').name, au0('ai-morning').members, AU.filter((a) => (a.members || []).some((id) => ['haru', 'pori', 'eco'].includes(id))).length], ['AI 콘텐츠 아침 (여름 · B2C 크루)', ['yeoreum'], 0]);
eq('자동 작업: 카테고리 7개 · 모두 분류됨', [AS.cats.length, AS.cats.reduce((x, c) => x + c.n, 0) === AU.length], [7, true]);
const now = { date: '2026-10-12', time: '20:30' }, au = (id) => AU.find((a) => a.id === id);
eq('자동 작업: 다음 실행 · 말', [C.autoNext(au('ai-morning'), now), C.autoNext(au('usage'), now), C.autoNext(au('holidays'), now), C.autoNext(au('aside-upload'), now), C.autoWord(au('usage')), C.autoWord(au('aside-drafts'))],
  [{ date: '2026-10-13', t: '06:50' }, { date: '2026-10-12', t: '21:17' }, { date: '2026-11-01', t: '09:17' }, null, '3시간마다', '맡긴 글이 있을 때']);
eq('한국 시간', C.nowKST(new Date('2026-10-11T22:30:00Z')), { date: '2026-10-12', time: '07:30' });

// 고객의 소리
eq('가림: 전화·이메일·주민번호·동호수 · 가격·날짜는 그대로',
  C.maskPII('010-1234-5678 / 02 123 4567 / a.b@c.co.kr / 900101-1234567 / 101동 1203호 / 35,000원 / 2026-10-10 / 3통'),
  { text: '(번호) / (번호) / (이메일) / (주민번호) / (동호수) / 35,000원 / 2026-10-10 / 3통', n: 5 });
const vd = C.vocDoc({ product: ' 곰팡이젤 ', type: '불만', source: '전화', text: '  뚜껑이  새요 01012345678 ' });
eq('VOC: 문서', vd, { ok: true, errors: [], masked: 1, doc: { product: '곰팡이젤', type: '불만', source: '전화', text: '뚜껑이 새요 (번호)', masked: 1, urgent: false } });
eq('VOC: 빈 칸 문구', C.vocDoc({ type: 'x', source: '전화', text: 'a' }).errors, ['제품을 고르거나 적으세요.', '종류를 고르세요.', '내용을 한 줄 적으세요.']);
eq('VOC: 하자·안전 = 급함', C.vocDoc({ product: 'A', type: '하자·안전', source: '전화', text: '손에 화상' }).doc.urgent, true);
const vl = [
  { id: '1', date: '2026-10-10', product: '곰팡이젤', type: '불만', source: '전화', text: '냄새', resolved: false },
  { id: '2', date: '2026-10-09', product: '곰팡이젤', type: '불만', source: '전화', text: '냄새 2', resolved: true },
  { id: '3', date: '2026-10-05', product: '곰팡이젤', type: '불만', source: '전화', text: '냄새 3', resolved: false },
  { id: '4', date: '2026-10-03', product: '곰팡이젤', type: '불만', source: '전화', text: '7일 밖', resolved: false },
  { id: '5', date: '2026-10-08', product: '실리콘', type: '하자·안전', source: '현장·방문', text: '갈라짐', resolved: false },
  { id: '6', date: '2026-10-08', product: '실리콘', type: '칭찬', source: '전화', text: '좋아요', resolved: false },
];
const vs = C.vocSummary(vl, '2026-10-10');
eq('VOC 요약: 7일 · 안 끝난 것 · 종류', [vs.from, vs.total, vs.open, vs.byType['불만']], ['2026-10-04', 5, 4, 3]);
eq('VOC 요약: 같은 이야기 3건 → 급함 · 하자·안전', [vs.repeated.map((x) => x.key), vs.urgentItems.map((x) => x.id)], [['곰팡이젤|불만'], ['5']]);
const vlk = C.vocLinks(vl, '2026-10-10');
eq('VOC → 업무OS: 내용 안 보냄', vlk.map((l) => [l.id.replace(/-[0-9a-z]+$/, ''), l.src, l.kind, l.title, l.sub, l.open]),
  [['mkt-voc', 'mkt', 'voc', '실리콘 하자·안전', '고객의 소리 · 바로 확인', true], ['mkt-vocg', 'mkt', 'voc', '곰팡이젤 불만 3건', '고객의 소리 · 최근 7일 같은 이야기', true]]);
const vn = C.obsidianNote({ date: '2026-10-10', sales7: 0, salesPrev7: 0, adsDays: 7, stock: [], advice: { up: [], down: [], off: [], keep: [] }, sales: [], voc: vs, vocList: vl });
eq('옵시디언: 고객의 소리 칸', [vn.includes('## 🗣 고객의 소리 — [[온유]] (최근 7일 5건 · 안 끝난 것 4)'), vn.includes('- **곰팡이젤** 불만 3건'), vn.includes('| 2026-10-09 | 곰팡이젤 | 불만 | 전화 | 냄새 2 | ✅ |')], [true, true, true]);
eq('옵시디언: 노트 열기 링크', C.obsidianOpenUri('', '03 작업/2026-10-12 블로그.md'), 'obsidian://open?file=03%20%EC%9E%91%EC%97%85%2F2026-10-12%20%EB%B8%94%EB%A1%9C%EA%B7%B8.md');
eq('직원 = 고객의 소리만', [C.isStaffEmail('s@x.com', { staffs: ['s@x.com'] }), C.isUploaderEmail('s@x.com', { staffs: ['s@x.com'] })], [true, false]);

// 노트 보기 (마크다운 → 안전한 HTML)
const mh = C.mdLite('---\n유형: 작업\n상태: 검토대기\n---\n# 원고\n> 인용 **굵게**\n\n| 제품 | 정가 |\n|---|--:|\n| [[PS-S011 크랙 방수 세트|크랙 세트]] | 226,000 |\n\n- [ ] 확인\n1. 하나\n\n본문 <img src=x onerror=alert(1)> [사진: 유형 03 시공중 — 장면] https://www.pourstore.net');
eq('보기: 머리말 숨김', mh.includes('검토대기'), false);
eq('보기: 제목·인용·굵게', [mh.includes('<h2>원고</h2>'), mh.includes('<blockquote>인용 <b>굵게</b></blockquote>')], [true, true]);
eq('보기: 표 + 별칭 링크', mh.includes('<td data-l="제품"><span class="wl">크랙 세트</span></td><td data-l="정가">226,000</td>'), true);
eq('보기: 체크박스·번호 목록', [mh.includes('<li class="ck">☐ 확인</li>'), mh.includes('<ol><li>하나</li></ol>')], [true, true]);
eq('보기: 태그는 글자로 (스크립트 안 돎)', [mh.includes('<img'), mh.includes('&lt;img src=x onerror=alert(1)&gt;')], [false, true]);
eq('보기: 사진 자리·링크', [mh.includes('<span class="ph">📷 사진: 유형 03 시공중 — 장면</span>'), mh.includes('<a href="https://www.pourstore.net" target="_blank" rel="noopener">')], [true, true]);

// 노트 → 게시물 미리보기
const noteSrc = '---\n담당: "[[포리]]"\n상태: 검토대기\n---\n# 2026-10-12 포리 블로그 원고 3\n> 안내 한 줄\n\n## 요청 내용\n- 주제 3\n\n## 입력 자료\n- 카드\n\n## 결과물\n\n## 1. 균열 보수 — POUR스토어 · [[PS-S011 크랙 방수 세트]]\n\n**제목 A안**: 옥상 균열 보수 이유\n**제목 B안**: 균열 보수 순서\n\n[사진: 유형 02 시공전 — 금]\n\n### 작은 금\n본문 **굵게** [[PS-S011 크랙 방수 세트|크랙 세트]]\n\n**해시태그**: #옥상 #균열\n\n**썸네일 문구 3안**\n1. 겨울 전 필수\n2. "금 하나가 누수로"\n\n### 카페 — 원고 1 다시 · [[PS-S011 크랙 방수 세트]]\n> **카페 규정 확인 후 게시**\n**제목**: [정보] 균열 체크\n본문2\n> ⚠️ 검토 메모: 광고 표기 필요\n\n## 체크\n- [ ] 확인\n';
const np = C.noteParts(noteSrc);
eq('노트 나누기: 제목·안내·근거 접기', [np.title, np.lead, np.props['상태'], np.meta.includes('## 요청 내용') && np.meta.includes('## 체크'), np.main.includes('결과물')], ['2026-10-12 포리 블로그 원고 3', ['안내 한 줄'], '검토대기', true, false]);
const pp = C.parsePosts(np.main, 'pori');
eq('게시물 2개: 블로그 + 카페(안쪽 ### 도 따로)', pp.posts.map((x) => [x.n, x.channel, x.title, x.titleB]), [[1, 'naver_blog', '옥상 균열 보수 이유', '균열 보수 순서'], [2, 'cafe', '[정보] 균열 체크', '']]);
eq('게시물: 태그·썸네일·제품', [pp.posts[0].tags, pp.posts[0].thumbs, pp.posts[0].products], [['#옥상', '#균열'], ['겨울 전 필수', '금 하나가 누수로'], ['PS-S011 크랙 방수 세트']]);
eq('카페: 안내·내부 메모는 본문에서 뺌', [pp.posts[1].notice, pp.posts[1].memo, pp.posts[1].body], ['카페 규정 확인 후 게시', '⚠️ 검토 메모: 광고 표기 필요', '본문2']);
eq('블로그 본문엔 제목·태그·썸네일 줄 없음', [pp.posts[0].body.includes('제목 A안'), pp.posts[0].body.includes('#옥상'), pp.posts[0].body.includes('겨울 전 필수'), pp.posts[0].body.includes('### 작은 금')], [false, false, false, true]);
eq('편집기에 붙일 글', C.postPlain(pp.posts[0].body), '[사진: 유형 02 시공전 — 금]\n\n작은 금\n본문 굵게 크랙 세트');
eq('사진 자리만 있는 줄 = 큰 칸', C.mdLite('[사진: 유형 01 제품컷 — 패키지]'), '<div class="phb"><span class="phi">📷</span><span>유형 01 제품컷 — 패키지</span></div>');
// 게시 글 칸 (2026-10-11 블로그 레이아웃 고도화 · 볼트 00 블로그 글 표준)
const blog = `[썸네일: 메인 「균열 보수, 빠데만 바르면 될까요?」 / 서브 「반복되는 크랙 보수 방법」 / 구도: 전후 비교]
> "빠데로 메웠는데, 또 갈라졌어요."
> “빠데만 바르면 되나요?”

혹시 지금 이런 고민으로
찾고 계신가요?
[사진: 유형 02 시공전 — 외벽에 길게 난 균열 · 정면에서 넓게]
> 그 틈, 그냥 두면 **위험해요**
(사진 - 코트재·하이퍼티 용기 나란히 · 앞에 시트 롤)
[링크: 크랙 방수 세트 구매하기 → https://www.pourstore.net]
${'원인 설명 줄\n'.repeat(30)}### 시공 순서
**STEP 1. 바탕면 정리**
(사진)
**STEP 2. 코트재 도포**
[사진: 고정 리얼 후기]
${'마무리 줄\n'.repeat(10)}[링크: 크랙 방수 세트 → https://www.pourstore.net]
[링크: 1:1 맞춤 시공 상담 → 주소 확인 필요]
[링크: 카카오톡 상담 → https://pf.kakao.com/x]`;
const bb = C.postBlocks(blog);
eq('게시 글 칸 종류', bb.map((b) => b.t).slice(0, 9), ['thumb', 'bubble', 'bubble', 'md', 'photo', 'quote', 'photo', 'link', 'md']);
eq('썸네일 메인·서브', [bb[0].main, bb[0].sub], ['균열 보수, 빠데만 바르면 될까요?', '반복되는 크랙 보수 방법']);
eq('사진 번호·유형·고정', bb.filter((b) => b.t === 'photo').map((b) => [b.n, b.kind]), [[1, '02 시공전'], [2, ''], [3, ''], [4, '고정']]);
eq('링크 주소 없음 = 확인 필요', bb.filter((b) => b.t === 'link').map((b) => b.url ? 'url' : b.note), ['url', 'url', '주소 확인 필요', 'url']);
const bh = C.postHtml(blog + '\n<img src=x onerror=alert(1)>');
eq('미리보기: 말풍선·사진·링크 카드', [bh.includes('<div class="pv-bub">&quot;빠데로'), bh.includes('📷 사진 4</span><span class="pv-ph-k">고정 이미지'), bh.includes('<a class="pv-link" href="https://pf.kakao.com/x"')], [true, true, true]);
eq('미리보기: 태그는 글자로', bh.includes('<img'), false);
eq('붙여넣기: 사진 자리 글자 · 링크 라벨+주소', [C.pasteHtml(blog).includes('<p>[사진 1: 유형 02 시공전 — 외벽에'), C.pasteHtml(blog).includes('<p><b>카카오톡 상담</b><br><a href="https://pf.kakao.com/x">')], [true, true]);
eq('편집기 글: 링크 = 라벨 줄 + 주소 줄', C.postPlain('[링크: 구매하기 → https://a.com/x]'), '구매하기\nhttps://a.com/x');
const ck = C.blogCheck({ channel: 'naver_blog', body: blog, tags: Array.from({ length: 16 }, (_, i) => '#t' + i), title: '무조건 끝나는 균열 보수 10배' });   // 완벽·최고 등은 사용금지어 칸(banned.js)으로 옮김 (2026-10-19)
eq('구조 검사: 항목별', Object.fromEntries(ck.items.map((x) => [x.k, x.level])), { greet: 'ok', thumb: 'ok', quotes: 'ok', early: 'ok', cta: 'ok', photos: 'warn', steps: 'ok', tags: 'ok', url: 'warn', home: 'warn', risky: 'warn', nums: 'warn' });   // home = 구매 링크가 자사몰 첫 화면 (2026-10-18 2-4A · 견본 글이 아직 첫 화면 주소)
{ // 2026-10-18 2-4A — 구매 링크가 상품 페이지면 경고 없음 · 첫 화면(쿼리·# 포함)만 경고 · 상담 링크는 안 봄
  const ck2 = (u) => (C.blogCheck({ channel: 'naver_blog', heading: '1. 균열', tags: [], body: `[링크: 제품 구매하기 → ${u}]\n[링크: 카카오톡 상담 → https://pf.kakao.com/_x/chat]` }).items.find((x) => x.k === 'home') || {}).level || '';
  eq('첫 화면 구매 링크만 경고', ['https://www.pourstore.net', 'https://grohome.co.kr/', 'https://www.pourstore.net/?utm_source=a', 'https://www.pourstore.net/product/detail.html?product_no=64', 'https://smartstore.naver.com/pourstore/products/1'].map(ck2), ['warn', 'warn', 'warn', '', '']);
}
const ck2 = C.blogCheck({ channel: 'naver_blog', body: '안녕하세요 포어입니다\n' + '설명\n'.repeat(40) + '[링크: 구매 → https://a.com]', tags: ['#a'] });
eq('구조 검사: 인사말·인용 없음·늦은 링크·태그 부족', ['greet', 'quotes', 'early', 'tags', 'photos'].map((k) => ck2.items.find((x) => x.k === k).level), ['bad', 'bad', 'bad', 'bad', 'bad']);
eq('구조 검사: 블로그만', C.blogCheck({ channel: 'tistory', body: blog }), null);
const ghBody = '설명\n'.repeat(20) + '[링크: 구매 → https://grohome.co.kr]';
eq('구조 검사: 그로홈은 마지막 구매 링크 하나면 됨', ['GH 1. 녹 칠하기 — 그로홈 · [[GH-P011]]', '1. 옥상 — POUR스토어'].map((h) => C.blogCheck({ channel: 'naver_blog', heading: h, body: ghBody, tags: [] }).items.find((x) => x.k === 'cta').level), ['ok', 'warn']);
const emptyN = C.numbersNote({ sales: [], ads: [], stock: [], voc: [], settings: {}, today: '2026-10-12' });
eq('오늘 숫자: 리포트 없으면 0원이 아니라 없음', [emptyN.includes('판매 리포트 없음'), emptyN.includes('**0원**'), emptyN.includes('광고 리포트 없음'), /매출7일: \n/.test(emptyN)], [true, false, true, true]);
// ③ 결과 숫자 (2026-10-17): 자동 판매(CRM · 그로홈 대시보드) · 없음 n일째 · 재고 = 재고 리포트(Aside · 비즈로지컴·쿠팡 로켓그로스)만 — POUR스토어 CRM 재고 위험은 안 씀 (2026-10-17 사장님 '스토어 재고는 용인공장')
const AUTO = { 'crm-pourstore': { id: 'crm-pourstore', to: '2026-10-16', at: '2026-10-17T00:00:00Z', days: { '2026-10-16': [{ c: '자사몰', p: '만능 방수 페인트 4kg', q: 3, r: 117000 }, { c: '전화', p: '옥상 방수 세트', q: 1, r: 250000 }], '2026-10-08': [{ c: '쿠팡', p: '만능 방수 페인트 4kg', q: 1, r: 39000 }] } },
  grohome: { id: 'grohome', to: '2026-10-12', days: { '2026-10-12': [{ c: '쿠팡', p: '유리블러 페인트', q: 2, r: 72000 }] } } };
const ar = C.autoSalesRows(AUTO);
eq('자동 판매 → 판매 줄 (브랜드 · 채널 · 원가 없음)', [ar.length, ar[0].brand, ar[0].channel, ar[0].chLabel, ar[0].productKey, ar.find((x) => x.brand === 'grohome').revenue, Object.keys(ar[0]).some((k) => /cost|원가|supply/i.test(k))], [4, 'pourstore', 'pourstore:자사몰', '자사몰', 'name:만능방수페인트4kg', 72000, false]);
const up = [{ reportDate: '2026-10-16', channel: 'cafe24', productName: '만능 방수 페인트 4kg', qty: 9, revenue: 999 }, { reportDate: '2026-10-15', channel: 'cafe24', productName: '만능 방수 페인트 4kg', qty: 1, revenue: 39000 }];
const mg = C.mergeSales(up, ar);
eq('합치기: CRM 숫자가 있는 날(10/16)의 카페24 리포트는 뺌 · 없는 날(10/15)은 씀 · 카페24 = POUR스토어', [mg.length, mg.filter((x) => x.channel === 'cafe24').map((x) => x.reportDate), mg.find((x) => x.channel === 'cafe24').brand, mg.find((x) => x.channel === 'cafe24').chLabel], [5, ['2026-10-15'], 'pourstore', '카페24 판매']);
const bs = C.brandSales(mg, AUTO, '2026-10-17');
eq('브랜드별 7일 · 전주 · 마지막 날', bs.map((b) => [b.label, b.r7, b.rp7, b.to]), [['POUR스토어', 406000, 39000, '2026-10-16'], ['그로홈', 72000, 0, '2026-10-12']]);
eq('브랜드: 자동 없으면 to 빈칸', C.brandSales([], {}, '2026-10-17').map((b) => b.to), ['', '']);
const LK = [{ kind: 'lowStock', open: true, title: '롤러 미니 재고 위험', sub: '남음 3개 · 위험 기준 10' }];   // 예전 CRM 재고 위험 줄 — 넘겨도 안 씀
eq('CRM 재고 위험 함수 없음 (2026-10-17)', typeof C.crmRiskRows, 'undefined');
eq('며칠 지남', [C.daysSince('2026-10-07', '2026-10-17'), C.daysSince('', '2026-10-17'), C.daysSince('2026-10-17T09:00:00Z', '2026-10-17')], [10, null, 0]);
const an = C.numbersNote({ sales: [], ads: [], stock: [{ reportDate: '2026-10-07', productName: '롤러 미니', available: 3 }], voc: [], settings: {}, today: '2026-10-17', auto: AUTO, links: LK });
eq('오늘 숫자(자동): 브랜드별 매출 · 그로홈 5일째 · 카페24 없음 · 재고 = 비즈로지컴·쿠팡 로켓그로스 리포트 10일째 · CRM 재고 위험 없음 · 매출7일 합 · 발주필요 = 재고 리포트 계산',
  [an.includes('- 최근 7일 매출 · POUR스토어 (CRM · 전 채널): **367,000원** (전주 대비 ▲841%) · 10/16까지'), an.includes('그로홈 (그로홈 대시보드 · 전 채널): **72,000원** (전주 대비 -) · 10/12까지 · ⚠️ 5일째 새 판매 없음'),
    an.includes('- 카페24 리포트(Aside): 없음'), an.includes('- 재고: 비즈로지컴(이지어드민)·쿠팡 로켓그로스만 · 재고 리포트(Aside) 10/7 · ⚠️ 10일째 새 리포트 없음 · POUR스토어 재고는 용인공장'), /CRM 재고|재고 위험 —/.test(an),
    /매출7일: 439000\n/.test(an), /발주필요: \d+\n/.test(an), an.includes('| POUR스토어 | 옥상 방수 세트 | 1 | 250,000 | 0 | 전화 |'), an.includes('**0원**')],
  [true, true, true, true, false, true, true, true, false]);
const an0 = C.numbersNote({ sales: [], ads: [], stock: [], voc: [], settings: {}, today: '2026-10-17', auto: {} });
eq('오늘 숫자(자동 · 아무것도 없음): 판매 숫자 없음 · 0원 아님 · 매출7일 빈칸 · 발주 필요도 0 아님(계산 못 함)', [an0.includes('POUR스토어 (CRM · 전 채널): **판매 숫자 없음**'), an0.includes('**0원**'), /매출7일: \n/.test(an0), /발주필요: \n/.test(an0), an0.includes('발주 필요: **판매 숫자 없음** — 0개가 아니라 계산 못 함 (재고 리포트도 없음)'), an0.includes('판매 숫자가 없어 계산하지 않음')], [true, false, true, true, true, true]);
// 재고 리포트는 새것인데 판매 숫자가 없음 → '발주 필요 0' 이 아니라 '판매 숫자 없음' (예전 CRM 재고 위험 줄을 넘겨도 안 씀 · 2026-10-17)
const stk1 = [{ reportDate: '2026-10-16', productCode: 'P1', productName: '롤러', available: 3, leadTimeDays: 7 }];
const an1 = C.numbersNote({ sales: [], ads: [], stock: stk1, voc: [], settings: {}, today: '2026-10-17', auto: {}, links: [{ kind: 'lowStock', open: true, title: '롤러 재고 위험', sub: '남은 3 · 기준 10' }] });
eq('재고 리포트 새것 + 판매 없음: 판매 숫자 없음 · 발주필요 빈칸 · CRM 재고 위험 안 씀 · 재고 리포트 10/16 (n일째 경고 없음)', [an1.includes('발주 필요: **판매 숫자 없음**'), /발주필요: \n/.test(an1), /CRM 재고/.test(an1), an1.includes('- 재고: 비즈로지컴(이지어드민)·쿠팡 로켓그로스만 · 재고 리포트(Aside) 10/16 · POUR스토어 재고는 용인공장')], [true, true, false, true]);
// 전화 카드 (1:1 맞춤 시공 상담 = 전화 1800-8203 · 2026-10-12)
const telB = C.postBlocks('[링크: 1:1 맞춤 시공 상담 → 1800-8203]\n[링크: 카카오톡 상담 → https://pf.kakao.com/_YAbxexj/chat]');
eq('전화 카드: 번호 · 주소 확인 필요 아님', [telB[0].tel, telB[0].note, telB[1].url], ['1800-8203', undefined, 'https://pf.kakao.com/_YAbxexj/chat']);
eq('전화 카드: 미리보기 tel · 붙여넣기 · 글자', [C.postHtml('[링크: 상담 → 1800-8203]').includes('href="tel:18008203"'), C.pasteHtml('[링크: 상담 → 1800-8203]'), C.postPlain('[링크: 상담 → 1800-8203]')], [true, '<p><b>상담</b><br>📞 1800-8203</p>', '상담\n📞 1800-8203']);
eq('전화 카드: 구조 검사에서 주소 확인 필요로 안 셈', (C.blogCheck({ channel: 'naver_blog', body: '[링크: 상담 → 1800-8203]', tags: [] }).items.find((x) => x.k === 'url') || null), null);
eq('표 칸 머리 이름(폰 카드용)', C.mdLite('| 제품 | 정가 |\n|---|---|\n| A | 1 |').includes('<td data-l="정가">1</td>'), true);
eq('게시물 id', C.postId('mkt-ai-pori-2026-10-12-ab', 2), 'mkt-ai-pori-2026-10-12-ab~2');
eq('임시저장 맡길 수 있는 채널 (지식인·인스타는 사람이 직접)', ['naver_blog','tistory','cafe','kin','insta','other'].map(C.canDraft), [true,true,true,false,false,false]);

console.log(`\n${n - bad}/${n} 통과`);
process.exit(bad ? 1 : 0);
