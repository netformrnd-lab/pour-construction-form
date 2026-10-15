// 광고 운영 · AI 팀 매뉴얼 (허브 ads.html · ai-manual.html · 업무OS 링크 같이 씀 · 계산만 · 저장·Firebase 없음 · ES 모듈)
//   시험 node marketing-hub/adops.test.mjs
// 사용자 결정 2026-10-15 "광고 운영 내재화 + AI팀 매뉴얼 화면 (Aside 연동)":
//   · Aside 가 매일 08:30 메타·쿠팡·네이버 광고 일일 보고서 → pour-os/v2/adreports/{YYYY-MM-DD} {date, title, md, summary, offs(JSON 글), longtail(JSON 글 · 없을 수 있음), by:'aside', at}
//   · 매뉴얼 → pour-os/v2/aimanuals/{id} {id, title, md, src, at} (ad-ops-team · ad-ops-playbook)
//   · 두 경로는 Aside 전용 쓰기 — 화면은 읽기만 (pour-os-v2/CLAUDE.md)
//   · 운영 기준 = 데일리그로스 메타 운영 제안(2026.10.15): 메타 캠페인 3개 고정(신규 60 · 리타겟 10 · 테스트 30) · 금요일 판정(증액 350%+ 2주 +20% · 유지 200~350% · 종료 180% 미만 2주 · 구매 10건 전 보류)
//     쿠팡 롱테일 400~500% · 수익률 300% · 입찰 100원부터

export const HUB_ADS = 'https://pour-construction-form.pages.dev/marketing-hub/ads.html';
export const HUB_MANUAL = 'https://pour-construction-form.pages.dev/marketing-hub/ai-manual.html';

// 광고 AI팀 = B2C 크루 6명의 광고 몫 (매뉴얼 ad-ops-team 표와 같게 · 고치면 둘 다)
export const AD_ROLES = {
  gaeul: { ad: '쿠팡·네이버 검색광고', when: '매일 08:30 보고서 · 월 1회 구조 재편안', does: '키워드 보고서 분석 · 롱테일 확정/후보 · 효율 없는 키워드 자동 OFF · 수동 캠페인 이동 제안 · 입찰 100원 원칙', exec: '쿠팡 구조 변경 = 본부장님 · 네이버 = 링크프라이스' },
  gyeoul: { ad: '메타 판정', when: '매일 08:30 · 금 16:00 판정', does: '7일·14일 ROAS · 구매 수 · 학습 상태 · 자사몰 MER · 효율 없는 메타 광고 자동 OFF · 금요일 증액/유지/종료 판정표', exec: '예산 변경 = 담당' },
  yeoreum: { ad: '메타 소재', when: '월 브리프 · 매일 슬롯 상태', does: '소재 테스트 슬롯 관리 · 새 앵글 2~3안 브리프 · 9:16·1:1 규격 · 지면(스토리·AN) 점검', exec: '디자인 마케터·담당' },
  haneul: { ad: '오퍼', when: '주 1회', does: '리타겟팅 오퍼(1+1·세트·가격 박스) 설계 · 객단가 추적', exec: '담당 (마진 확인 = 관리자)' },
  uju: { ad: '리타겟팅', when: '주 1회', does: '리타겟팅 세트 성과(장바구니·상세 30일 · 구매자 제외) 점검 · 구매자 제외 타겟 최신화', exec: '담당' },
  bom: { ad: '오늘의집 광고', when: '매일 10:00 (크루 보드)', does: '오늘의집 광고(오하우스애즈) ROAS 300% 기준 운영안', exec: '담당' },
};
// 운영 기준 한 줄씩 (화면 위 '기준' 칸)
export const AD_RULES = [
  { m: '메타', t: '캠페인 3개 고정 — 신규 60 · 리타겟 10 · 테스트 30' },
  { m: '메타', t: '금요일 판정 — 증액 350%+ 2주 → +20% · 유지 200~350% · 종료 180% 미만 2주 · 구매 10건 전 보류' },
  { m: '쿠팡', t: '수익률 300% · 롱테일 400~500% · 입찰 100원부터' },
];

// JSON 글 칸 읽기 (offs · longtail) — 없으면 {has:false} · 못 읽으면 {has:true, bad:true}
export function jsonField(v) {
  if (v == null || v === '') return { has: false, val: null };
  if (typeof v !== 'string') return { has: true, val: v };
  try { return { has: true, val: JSON.parse(v) }; } catch (e) { return { has: true, bad: true, val: null }; }
}
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim(); return ''; };
const MEDIA = [[/메타|meta|facebook|페이스북|인스타/i, '메타'], [/쿠팡|coupang/i, '쿠팡'], [/네이버|naver/i, '네이버'], [/오늘의집|ohou/i, '오늘의집']];
export const mediaL = (s) => { const x = String(s || ''); for (const [re, l] of MEDIA) if (re.test(x)) return l; return x; };
// 끈 것 한 줄 → {date, media, campaign, target, reason, action} (Aside 가 쓰는 열쇠 이름이 바뀌어도 읽게 · 글 한 줄이면 대상)
export function offRow(o, date) {
  if (o == null) return null;
  if (typeof o !== 'object') return { date, media: '', campaign: '', target: String(o), reason: '', action: 'OFF' };
  const d = pick(o, ['date', '날짜', 'day']);
  return { date: /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : date,
    media: mediaL(pick(o, ['media', 'channel', 'platform', '매체', '채널'])),
    campaign: pick(o, ['campaign', '캠페인', 'campaignName']),
    target: pick(o, ['target', '대상', 'keyword', '키워드', 'ad', '광고', 'adset', '광고세트', 'name', 'item']),
    reason: pick(o, ['reason', '근거', 'why', 'basis', 'rule', '규칙', 'metric']),
    action: pick(o, ['action', '조치', 'act', 'result', '결과']) || 'OFF' };
}
// 보고서 하나의 끈 것 (offs 가 배열 · {items|offs|list: 배열} 모두)
export function offsOf(rep) {
  const f = jsonField(rep && rep.offs); if (!f.has || f.bad) return { has: f.has, bad: !!f.bad, rows: [] };
  const v = f.val, arr = Array.isArray(v) ? v : v && typeof v === 'object' ? (v.items || v.offs || v.list || v.rows || []) : [];
  return { has: true, bad: false, rows: (Array.isArray(arr) ? arr : []).map((o) => offRow(o, rep.date || '')).filter(Boolean) };
}
// 새 롱테일 수 — 배열 = 길이 · {new|added|신규 …} = 그 수 · 없으면 null(카드 숨김)
export function longtailCount(rep) {
  const f = jsonField(rep && rep.longtail); if (!f.has || f.bad) return null;
  const v = f.val, n = (x) => (Array.isArray(x) ? x.length : typeof x === 'number' ? x : null);
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') for (const k of ['new', 'added', 'newCount', '신규', '새', '새 롱테일', 'confirmed', '확정']) { const x = n(v[k]); if (x != null) return x; }
  return null;
}
// 날짜 (YYYY-MM-DD · 한국 날짜 글) — 이번 주 = 월요일 시작
const dt = (s) => new Date(s + 'T00:00:00Z');
export const weekStart = (s) => { const d = dt(s), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };
export const monthOf = (s) => String(s || '').slice(0, 7);
// 보고서 최신순 (날짜 글 비교 · Firestore orderBy 안 씀)
export const sortReports = (reps) => [...(reps || [])].filter((r) => r && r.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
// 모든 보고서의 끈 것 → 최신순 줄 + 주간·월간 개수
export function offLog(reps, today) {
  const rows = []; let has = false;
  sortReports(reps).forEach((r) => { const x = offsOf(r); if (x.has && !x.bad) has = true; rows.push(...x.rows); });
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const wk = new Map(), mo = new Map();
  rows.forEach((r) => { if (!r.date) return; const w = weekStart(r.date), m = monthOf(r.date); wk.set(w, (wk.get(w) || 0) + 1); mo.set(m, (mo.get(m) || 0) + 1); });
  const tw = today ? weekStart(today) : '', tm = today ? monthOf(today) : '';
  return { has, rows, thisWeek: wk.get(tw) || 0, thisMonth: mo.get(tm) || 0,
    weeks: [...wk.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([w, n]) => ({ w, n })),
    months: [...mo.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([m, n]) => ({ m, n })) };
}
// 위 카드 (최신 보고서 요약 · 이번 주 끈 것 · 새 롱테일) — 칸이 없으면 null = 숨김
export function topCards(reps, today) {
  const s = sortReports(reps), last = s[0] || null, log = offLog(s, today);
  return { last, summary: last ? String(last.summary || '') : '', offsWeek: log.has ? log.thisWeek : null, longtail: last ? longtailCount(last) : null };
}
// 주 이름 '10/12 주'
export const weekL = (w) => `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))} 주`;
