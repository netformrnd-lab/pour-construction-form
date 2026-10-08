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

console.log(`\n${n - bad}/${n} 통과`);
process.exit(bad ? 1 : 0);
