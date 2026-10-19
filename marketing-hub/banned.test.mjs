// node marketing-hub/banned.test.mjs — 사용금지어 찾기 시험 (사장님 2026-10-19 PDF · Firebase 안 씀)
//   잡아야 하는 말 · 잡으면 안 되는 말(근거가 같은 문장에 있음 · 바꿔 쓰기 문구 · 시공 안내 · 자재 이름) · 사본(team_link.py · functions · CRM)이 원본과 같은지
import * as B from './banned.js';
import { readFileSync, existsSync } from 'node:fs';
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('✗', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('✓', name); };
const words = (t) => B.bannedHits(t).map((h) => h.w);
const hits = (t) => B.bannedHits(t).map((h) => h.hit);

// PDF 다섯 묶음 · 표 줄마다 하나 이상 (빠진 말 없음)
eq('묶음 5개 = PDF 순서', [...new Set(B.BANNED.map((b) => b.g))], ['단정·최상급', '성분·성능', '항균·곰팡이', '환경·인체 안전', '인증·성능']);
eq('모든 줄: 바꿔 쓰기 있음 · 찾는 말 JS 로 됨', B.BANNED.filter((b) => !b.alt || !b.w || (() => { try { new RegExp(b.re); if (b.ctx) new RegExp(b.ctx); if (b.show) new RegExp(b.show); return false; } catch { return true; } })()).map((b) => b.w), []);
eq('뒤 보기(lookbehind) 안 씀 — 옛 아이폰 Safari', B.BANNED.filter((b) => /\(\?<[=!]/.test(b.re + (b.ctx || '') + (b.show || ''))).map((b) => b.w).concat(B.BANNED_SKIP.filter((p) => /\(\?<[=!]/.test(p))), []);

// 1. 단정·최상급
eq('100% · 독보적 · 무결점 · 압도적', words('누수 100% 해결! 독보적인 기술, 무결점 마감, 압도적 성능'), ['100%', '독보적', '무결점', '압도적']);
eq('100% 보이는 글자 = 100% 만 (앞 글자 안 붙음 · 앞 글자는 다른 말 몫)', hits('방수100% 보장 · 완벽100%'), ['100%', '완벽']);
eq('반영구 · 영구적 · 완벽 · 평생', words('반영구적으로 유지되는 완벽 방수 · 평생 걱정 없음'), ['영구·반영구', '완벽', '평생']);
eq('완전 차단·완전방수·완전히 막아', hits('빗물을 완전 차단 · 완전방수 · 완전히 막아 줍니다'), ['완전 차단 · 완전방수 · 완전히 막아']);
eq('유일 · 최고 · 최고급 · 최초', words('국내 유일 · 최고의 품질 · 최고급 원료 · 국내 최초 개발'), ['유일', '최고', '최초']);
eq('절대 ~않는 · 절대로 안 새요', words('절대 깨지지 않는 코팅 · 절대로 안 새요'), ['절대(~하지 않는)']);
// 2·3
eq('무수축 · 무알칼리 · 무용제', words('무수축 몰탈 · 무알칼리 · 무용제 타입'), ['무수축', '무알칼리', '무용제']);
eq('항균 · 살균 · 99.9% · 소독 · 탈취', words('항균 99.9% · 살균 효과 · 세균 번식 걱정 끝 · 소독 · 탈취'), ['항균·살균·세균·바이러스·99.9%', '소독', '탈취']);
eq('곰팡이 방지·억제·제거 · 방곰팡이 · 곰팡이 안 생겨요', hits('곰팡이 방지 · 곰팡이 억제 · 방곰팡이 · 곰팡이 안 생겨요 · 곰팡이를 막아'), ['곰팡이 방지 · 곰팡이 억제 · 방곰팡이 · 곰팡이 안 생겨요 · 곰팡이를 막아']);
// 4
eq('친환경 · 에코 프렌들리 · eco · 지구를 생각한', words('친환경 페인트'), ['친환경·에코']);
eq('친환경 보이는 글자', hits('친환경 · 에코 프렌들리 · eco-friendly · 100% eco · 지구를 생각한 선택'), ['100%', '친환경 · 에코 프렌들리 · eco-friendly · eco · 지구를 생각한']);
eq('무독성 · 무해 · 인체에 안전 · 안전성', words('무독성 · 인체에 무해한 · 안전성 검증'), ['무독성·무해·인체에 안전']);
eq('안전한 · 안전합니다', words('아이 있는 집도 안전한 제품이에요. 정말 안전합니다'), ['안전한']);
eq('무공해 · 수질 오염 없는 · 무취 · 냄새 없는 · 냄새 안 나는', words('무공해 · 수질 오염 없는 · 무취 · 냄새 없는 · 냄새가 안 나요'), ['무공해·저공해·오염 없는', '무취·냄새 없는']);
eq('천연 (함량 없음)', words('천연 원료'), ['천연']);
eq('VOC: 저VOC · VOC-free · ZERO VOC · VOC 걱정 없는 · 휘발성유기화합물 없음', words('저VOC 페인트 · VOC-free · ZERO VOC · VOC 걱정 없는 · 휘발성유기화합물 없음'), ['저 VOC', 'ZERO·제로·○○-free', 'VOC']);
eq('VOC 보이는 글자 (좁은 말 먼저 · 같은 곳 두 번 안 셈)', hits('저VOC 페인트 · VOC-free · ZERO VOC'), ['저VOC', 'VOC-free · ZERO VOC']);
eq('유해물질 제로 · 중금속 · 포름알데히드 · 불검출 · 납 무함유 · 무첨가', words('유해물질 제로 · 중금속 걱정 없는 · 포름알데히드 불검출 · 납 무함유 · 방부제 무첨가'), ['○○ 무함유·없음·미사용', '유해물질 없음·중금속·포름알데히드', '불검출', '무첨가']);
eq('VOCs 30% 저감 (성적서 없음)', words('VOCs 30% 저감'), ['유해물질·VOCs ○% 저감']);
eq('저탄소 · 탄소중립 · 넷제로 · 생분해 · 오존', words('저탄소 · 탄소중립 · 넷제로 · 생분해 · 오존층 보호'), ['저탄소·탄소중립·넷제로', '생분해·자연분해', '오존 친화·오존층']);
// 5
eq('인증 (번호 없음)', words('공인 인증 받은 제품 · 품질인증 · KC 인증 · ISO 9001 인증'), ['공인(시험)기관 인증', '환경표지·품질인증·KC·ISO 등']);
eq('KC · ISO 보이는 글자 (인증을 따로 또 세지 않음)', hits('KC 인증 · ISO 9001 인증 · 환경표지 인증 제품'), ['KC 인증 · ISO 9001 인증 · 환경표지 인증']);
eq('신기술 (번호 없음) · 실용신안 · 출원 · 수상 · 선정', words('신기술 적용 · 실용신안 등록 · 특허 출원 기술 · 디자인 대상 수상 · 올해의 브랜드 선정'), ['신기술', '실용신안·디자인등록·상표등록', '출원', '수상', '선정']);
eq('불연 · 준불연 · 내화 · 에너지 절감 · 냉난방비 절약', words('준불연 · 내화 성능 · 에너지 절감 · 냉난방비 절약'), ['불연·준불연', '내화', '에너지 절감·냉난방비 절약']);
eq('인증 받은 · 인증 제품', words('정부 인증 제품'), ['인증']);

// 잡으면 안 되는 말
const none = (name, t) => eq('안 잡음: ' + name, hits(t), []);
none('안전하게 시공 · 안전한 곳에 보관 · 안전한 작업', '안전하게 시공하세요. 어린이 손이 닿지 않는 안전한 곳에 보관하세요. 안전한 작업을 위해 장갑을 끼세요.');
none('구조 안전성', '건물 구조 안전성 점검');
none('미세균열 · 권하는 말 (~하는 게 안전해요)', '외벽 미세균열 보수 · 높으면 업체 상담부터 받는 게 안전해요. 현장 상태를 보고 공법을 정하는 것이 안전합니다.');
none('최고 사용 온도 · 최고 80℃', '최고 사용 온도 80℃ · 최고 80도');
none('건설신기술 제1026호 · 국내 최초 박공지붕 건설신기술 제1026호', '국토교통부 지정 건설신기술 제1026호. 국내 최초 박공지붕 건설신기술 제1026호');
none('건설신기술 1026호 · 신기술(제1026호)', '건설신기술 1026호 · 신기술(제1026호)');
none('내화벽돌 · 내화학성 · 실내화', '내화벽돌 줄눈 · 내화학성 우수 · 실내화 정리함');
none('완전히 건조 · 완전히 제거한 뒤 · 완전히 막힌 배수구', '바탕면을 완전히 건조한 뒤 · 들뜬 도막을 완전히 제거한 뒤 바르세요 · 배수구가 완전히 막힌 경우');
none('절대 섞지 마세요 · 절대 안 됩니다', '물과 절대 섞지 마세요. 비 오는 날 시공은 절대 안 됩니다.');
none('바꿔 쓰기 문구 (가이드 그대로)', 'VOCs 저감을 고려해 설계된 페인트. 휘발성유기화합물(VOCs) 기준 적합(시험성적서 제2026-001호). VOCs 함량 30 g/L (기준 200 g/L 이하). 곰팡이가 생기기 쉬운 환경을 줄여 주는 코팅. 냄새가 적은 수성. 사용 환경을 고려한 설계. 에너지 효율을 고려한 차열. 위생적인 관리에 유리한.');
none('자사 대비 VOCs 20% 저감(성적서)', '자사 기존 제품 대비 VOCs 20% 저감(성적서 제123호)');
none('고형분 100%(MSDS) · 일사반사율 91.8%(KTR 공인시험)', '고형분 100% (MSDS 기준). KTR 공인시험 결과 일사반사율 91.8%로 높은 수준.');
none('구매 인증 · 인증샷 · 본인 인증 · 인증번호 입력', '구매 인증 이벤트 · 인증샷 남기면 쿠폰 · 본인 인증 · 인증번호를 입력하세요');
none('인증 번호와 함께', '환경표지 인증 제품(인증번호 제12345호, 유효기간 2027-12-31)');
none('특허 출원 중(출원번호)', '특허 출원 중(출원번호 10-2026-0012345)');
none('선정·수상 (기관·연도)', '조달청 우수제품 선정(조달청, 2026). 디자인상 수상(주최 한국디자인진흥원, 2026)');
none('체험단 선정 · 당첨자 선정', '체험단 10명 선정 · 당첨자 선정 발표');
none('리뷰 이벤트·대리점 포상 선정 (제품 자랑 아님)', '매월 베스트 리뷰를 선정하여 추가 적립금을 드립니다. 우수 리뷰어로 선정되면 쿠폰! 연간 우수 대리점 선정 시 포상');
none('최초 1회 · 최초 구매 (첫 번째라는 뜻)', '파트너사 체결 시 최초 1회 교육 · 최초 구매 시 쿠폰 · 최초 가입 혜택');
none('수상한 · 수상스키', '수상한 냄새가 나요 · 수상스키');
none('주소 안 글자', 'https://www.pourstore.net/product/eco-100/123 · pour1.net · www.grohome.co.kr/eco');
none('나라·기관 이름의 KC · KCL', 'KTR/KCL 공인시험 결과');
none('곰팡이 저항성 성적서', '곰팡이 저항성 시험성적서(KCL) 결과 곰팡이 억제 0등급');
none('천연 함량', '천연 원료 30% 사용 (원료 배합 기준)');
none('절대 마세요 앞 10자', '건조 전에는 절대로 물이 닿게 하지 마세요');

// 한 줄 · 줄마다 · 횟수
const hs = B.bannedHits('친환경 친환경 · 100% 방수 · 완벽');
eq('같은 말 한 줄 · 횟수', hs.map((h) => [h.w, h.hit, h.n]), [['100%', '100%', 1], ['완벽', '완벽', 1], ['친환경·에코', '친환경', 2]]);
eq('한 줄 글', B.bannedLine(hs), '사용금지어 4 · 100% · 완벽 · 친환경');
eq('줄마다 글', B.bannedRow(hs[2]), '친환경 → "VOCs 저감을 고려해 설계된" (근거가 있으면: 환경표지 인증: "환경표지 인증 제품(인증번호 ○○, 유효기간 ○○)")');
eq('빈 글 · null', [B.bannedHits(''), B.bannedHits(null), B.bannedLine([])], [[], [], '']);
eq('여러 줄 · 문장마다 근거 따로 (앞 문장 번호가 뒤 문장을 안 살림)', words('건설신기술 제1026호 보유.\n신기술 적용 제품'), ['신기술']);

// AI 지시문 글
const R = B.bannedRule();
eq('AI 규칙 글: 머리 · 묶음 5줄 · 모든 말', [R.split('\n')[0].startsWith('■ 사용금지어 — POUR스토어·그로홈'), R.split('\n').length, B.BANNED.every((b) => R.includes(b.w + ' → '))], [true, 8, true]);
eq('AI 규칙 글 길이 (지시문에 붙여도 짧게)', R.length < 2600, true);

// 사본 = 원본 (banned-sync.mjs 로 다시 씀)
const SYNC = { ver: B.BANNED_VER, src: B.BANNED_SRC, banned: B.BANNED, skip: B.BANNED_SKIP, rule: R };
const T = readFileSync(new URL('./tools/team_link.py', import.meta.url), 'utf8');
const pyData = /# BANNED_START\nBANNED_DATA = json\.loads\(r'''([\s\S]*?)'''\)\n# BANNED_END/.exec(T);
eq('team_link.py 목록 = banned.js (node marketing-hub/tools/banned-sync.mjs)', pyData ? JSON.parse(pyData[1]) : null, JSON.parse(JSON.stringify(SYNC)));
for (const [f, uses] of [['../functions/api/team-ai.js', 1], ['../functions/api/dashboard-ai.js', 1], ['../pourstore-renewal/assets/builder.js', 4], ['../pourstore-renewal/chatbot.html', 1]]) {   // 대시보드 AI · 자사몰 리뉴얼 상세 AI(사실 추출 · 슬롯 카피 · 자식 상품 · 자동 채우기)
  const s = readFileSync(new URL(f, import.meta.url), 'utf8');
  const m = /\/\* BANNED_RULE_START[^*]*\*\/\n[ \t]*const BANNED_RULE = (".*");\n[ \t]*\/\* BANNED_RULE_END \*\//.exec(s);
  eq(`${f.split('/').pop()} AI 규칙 글 = bannedRule()`, m ? JSON.parse(m[1]) : null, R);
  eq(`${f.split('/').pop()} 지시문 ${uses}곳에 규칙 글 붙임`, (s.replace(/\/\* BANNED_RULE_START[\s\S]*?BANNED_RULE_END \*\//, '').match(/\bBANNED_RULE\b/g) || []).length, uses);
}
const CRM = new URL('../../pour-crm/src/pages/chatbot/banned.js', import.meta.url);
if (existsSync(CRM)) eq('pour-crm 챗봇 사본 = banned.js (머리 줄 빼고)', readFileSync(CRM, 'utf8').split('\n').slice(2).join('\n'), readFileSync(new URL('./banned.js', import.meta.url), 'utf8'));
else console.log('· pour-crm 저장소가 옆에 없음 — 챗봇 사본 비교 건너뜀');

// Python(team_link.py) 찾기 = JS 찾기 (같은 글 · 같은 결과)
{
  const { execFileSync } = await import('node:child_process');
  const SAMPLES = ['누수 100% 해결! 독보적인 기술', '방수100% 보장', '친환경 · 에코 프렌들리 · eco-friendly · 100% eco · 지구를 생각한 선택', '저VOC 페인트 · VOC-free · ZERO VOC · VOC 걱정 없는 · 휘발성유기화합물 없음',
    'KC 인증 · ISO 9001 인증 · 환경표지 인증 제품', '국토교통부 지정 건설신기술 제1026호. 국내 최초 박공지붕 건설신기술 제1026호', '건설신기술 제1026호 보유.\n신기술 적용 제품',
    '안전하게 시공하세요. 안전한 곳에 보관. 정말 안전합니다', '고형분 100% (MSDS 기준). KTR 공인시험 결과 일사반사율 91.8%로 최고 수준.', '물과 절대 섞지 마세요. 절대 깨지지 않는 코팅',
    '곰팡이 방지 · 곰팡이 억제 · 방곰팡이 · 곰팡이 안 생겨요', 'https://www.pourstore.net/product/eco-100/123 · 내화벽돌 · 내화학성 · 실내화', '구매 인증 이벤트 · 정부 인증 제품 · 특허 출원 중(출원번호 10-2026-0012345)',
    '유해물질 제로 · 중금속 걱정 없는 · 포름알데히드 불검출 · 납 무함유 · 방부제 무첨가', '조달청 우수제품 선정(조달청, 2026). 디자인 대상 수상'];
  const py = `import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T
print(json.dumps([T.banned_hits(s) for s in json.loads(sys.argv[2])], ensure_ascii=False))`;
  const got = JSON.parse(execFileSync('python3', ['-c', py, new URL('./tools', import.meta.url).pathname, JSON.stringify(SAMPLES)], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py banned_hits = banned.js bannedHits (같은 글 15개)', got, SAMPLES.map((s) => B.bannedHits(s)));
  const py2 = `import json,sys; sys.path.insert(0, sys.argv[1]); import team_link as T
print(json.dumps([T.BANNED_RULE, T.publish_part(sys.argv[2])], ensure_ascii=False))`;
  const NOTE = '# 제목\n## 요청 내용\n- 친환경 페인트 글\n## 결과물\n## 1. 슁글 — POUR스토어\n**제목 A안**: 완벽 방수\n> ⚠️ 검토 메모: 무독성 확인 필요\n본문 100% 방수\n## 체크\n- [ ] 최고';
  const g2 = JSON.parse(execFileSync('python3', ['-c', py2, new URL('./tools', import.meta.url).pathname, NOTE], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
  eq('team_link.py 규칙 글 = bannedRule()', g2[0], R);
  eq('team_link.py 게시 글만 봄 (결과물 ~ 체크 · 검토 메모 줄 빼고)', B.bannedHits(g2[1]).map((h) => h.hit), ['100%', '완벽']);
}

console.log(`\n${n - bad}/${n} 통과`);
if (bad) process.exit(1);
