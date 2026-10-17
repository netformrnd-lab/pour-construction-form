// 날짜·채널·상품별 판매 (③ 결과 숫자 채우기 · 2026-10-17 · 계산만 · 시험 salesdays.test.mjs)
//   볼트 점검 P0-4 "허브 mkt-sales 0 · 판매 데이터가 없으면 '발주 필요 0'" → Aside 업로드 없이도 이미 있는 판매 원본으로 채움
//   pour-os/v2/salesdays/{grohome | crm-pourstore} = { id, brand, src, from, to(판매가 있는 마지막 날), days: {날짜: [{c 채널, p 상품, q 수량, r 판매금액}]}, n, at, by }
//   그로홈 = 업무OS 관리자 기기가 3시간마다 읽는 그로홈 대시보드 salesRecords(ghsales.js) · POUR스토어 = CRM 다리(pour-crm src/utils/salesDays.js · 같은 모양 · 둘 다 고칠 것)
//   원가·공급가·주문자·연락처 없음 · 최근 DAY_SPAN 일 · 하루 DAY_MAX 줄(판매금액 큰 순) → 허브·'05 오늘 숫자'가 읽음 (marketing-hub/core.js autoSalesRows)
export const DAY_SPAN = 35, DAY_MAX = 300, MAX_BYTES = 600000;   // 문서 한 장 1MB 한도 → 넘치면 오래된 날부터 뺌
const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const spanFrom = (today, span = DAY_SPAN) => { const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() - (span - 1)); return ymdOf(d); };
const clean = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

// rows = [{date, c, p, q, r}] → { from, to, days, n } — 같은 날·채널·상품은 한 줄로 더함
export function rollDays(rows, today, span = DAY_SPAN) {
  const from = spanFrom(today, span), m = new Map();
  (rows || []).forEach((x) => {
    const d = String((x && x.date) || "").slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(d) || d < from || d > today) return;
    const c = clean(x.c, 30) || "기타", p = clean(x.p, 80) || "(이름 없음)", k = `${d}\u0001${c}\u0001${p}`, o = m.get(k) || { d, c, p, q: 0, r: 0 };
    o.q += Number(x.q) || 0; o.r += Number(x.r) || 0; m.set(k, o);
  });
  const by = {}; let to = "", n = 0;
  m.forEach((o) => { (by[o.d] = by[o.d] || []).push({ c: o.c, p: o.p, q: Math.round(o.q * 100) / 100, r: Math.round(o.r) }); if (o.d > to) to = o.d; });
  const days = {};
  Object.keys(by).sort().forEach((d) => { days[d] = by[d].sort((a, b) => b.r - a.r || b.q - a.q || a.c.localeCompare(b.c) || a.p.localeCompare(b.p)).slice(0, DAY_MAX); n += days[d].length; });
  let first = from, size = JSON.stringify(days).length * 2;   // 한글 = 2~3바이트 → 넉넉히
  for (const d of Object.keys(days)) { if (size <= MAX_BYTES) break; size -= JSON.stringify(days[d]).length * 2; n -= days[d].length; delete days[d]; first = d; }
  if (first !== from) first = Object.keys(days)[0] || first;
  return { from: first, to, days, n };
}
// 바뀌었나 보기용 짧은 지문 (같은 내용 → 같은 값) — 큰 문서를 다시 읽지 않고 kpisales 의 daysHash 와 비교
export function hashOf(v) { const s = JSON.stringify(v); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ":" + s.length; }
