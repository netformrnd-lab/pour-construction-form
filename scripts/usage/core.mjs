// Firebase(pour-app-new) 사용량 · 예상 요금 계산 — 저장·통신 없음 (시험: node scripts/usage/core.test.mjs)
// 사용자 결정 2026-10-11: "매일 한도 측정 보게 하고, 매주 한도 보고 · 한화 10만 원 넘으면 문자"
// 하루 = 태평양 시간 하루(무료 한도가 태평양 자정 = 한국 16시(여름)·17시(겨울)에 다시 채워짐 · 구글 청구 달도 태평양 시간)

export const FREE = { r: 50000, w: 20000, x: 20000 }; // 하루 무료 (Spark·Blaze 같음)
// 단가(USD) — Firestore 10만 건당은 다중 리전(nam5) 값 = 단일 리전의 2배라 넉넉하게 잡음 · Storage 는 무료분 빼지 않음(넉넉하게)
export const PRICE = { r: 0.06, w: 0.18, x: 0.02, gbMonth: 0.026, egressGb: 0.12 };
export const FX = 1400;          // 1달러 = 원
export const ALERT_KRW = 100000; // 이번 달 예상 요금이 이걸 넘으면 문자 (달마다 한 번)
// 측정 항목 → Cloud Monitoring 지표 (앞에 있는 것부터 · 안 되면 다음)
export const METRICS = {
  r: { names: ['firestore.googleapis.com/document/read_ops_count', 'firestore.googleapis.com/document/read_count'], gauge: false, need: true },
  w: { names: ['firestore.googleapis.com/document/write_ops_count', 'firestore.googleapis.com/document/write_count'], gauge: false, need: true },
  x: { names: ['firestore.googleapis.com/document/delete_ops_count', 'firestore.googleapis.com/document/delete_count'], gauge: false, need: true },
  sb: { names: ['storage.googleapis.com/storage/v2/total_bytes', 'storage.googleapis.com/storage/total_bytes'], gauge: true, need: false },
  eg: { names: ['storage.googleapis.com/network/sent_bytes_count'], gauge: false, need: false },
};
export const KEEP_DAYS = 35;

const fmtIn = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const PT = fmtIn('America/Los_Angeles'), KST = fmtIn('Asia/Seoul');
export const ptDay = (t) => PT.format(new Date(t));
const kstHourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' });
const kstWdFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' });
export const kstParts = (t) => ({ date: KST.format(new Date(t)), hour: Number(kstHourFmt.format(new Date(t))), wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(kstWdFmt.format(new Date(t))) });
const addDay = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// 시간별 점 [{s: 시작 ISO, v}] → { 'YYYY-MM-DD'(태평양): 합 | 최대(gauge) }
export function bucket(points, gauge) {
  const out = {};
  for (const p of points || []) {
    const d = ptDay(p.s), v = Number(p.v) || 0;
    out[d] = gauge ? Math.max(out[d] || 0, v) : (out[d] || 0) + v;
  }
  return out;
}

// 지표별 점 → 하루 줄 [{d, r, w, x, sb, eg, today}] (가장 이른 점의 날 ~ 오늘, 최근 KEEP_DAYS 만)
// 연산 지표는 점이 없으면 0(그 시간에 연산 없음) · 저장 용량(gauge)은 앞날 값을 이어 씀
export function buildDays(series, now) {
  const today = ptDay(now), b = {};
  let first = today;
  for (const [k, m] of Object.entries(METRICS)) {
    b[k] = bucket(series[k], m.gauge);
    for (const d of Object.keys(b[k])) if (d < first) first = d;
  }
  if (first < addDay(today, -(KEEP_DAYS - 1))) first = addDay(today, -(KEEP_DAYS - 1));
  const days = []; let lastSb = 0;
  for (let d = first; d <= today; d = addDay(d, 1)) {
    if (b.sb[d] != null) lastSb = b.sb[d];
    days.push({ d, r: b.r[d] || 0, w: b.w[d] || 0, x: b.x[d] || 0, sb: lastSb, eg: b.eg[d] || 0, today: d === today });
  }
  return days;
}

// 그날 예상 요금 (Blaze 기준 · 무료 한도 넘은 만큼만 + Storage)
export function dayCost(day, price = PRICE, fx = FX) {
  const over = { r: Math.max(0, day.r - FREE.r), w: Math.max(0, day.w - FREE.w), x: Math.max(0, day.x - FREE.x) };
  const usd = over.r / 1e5 * price.r + over.w / 1e5 * price.w + over.x / 1e5 * price.x
    + (day.sb || 0) / 1e9 * price.gbMonth / 30 + (day.eg || 0) / 1e9 * price.egressGb;
  return { over, usd, krw: Math.round(usd * fx) };
}
export const overQuota = (day) => day.r > FREE.r || day.w > FREE.w || day.x > FREE.x;

// 화면·문자에 쓰는 묶음
export function summarize(rawDays, now, opt = {}) {
  const price = opt.price || PRICE, fx = opt.fx || FX;
  const days = rawDays.map((d) => ({ ...d, krw: dayCost(d, price, fx).krw }));
  const tdy = ptDay(now), ym = tdy.slice(0, 7);
  const inMonth = days.filter((d) => d.d.startsWith(ym));
  const monthKrw = inMonth.reduce((a, d) => a + d.krw, 0);
  const done = days.filter((d) => !d.today);
  const last7 = done.slice(-7);
  const avgKrw = last7.length ? last7.reduce((a, d) => a + d.krw, 0) / last7.length : 0;
  const left = daysInMonth(ym) - Number(tdy.slice(8, 10)); // 오늘 뒤 남은 날
  const avg = (k) => (last7.length ? Math.round(last7.reduce((a, d) => a + d[k], 0) / last7.length) : 0);
  const week = last7.length ? {
    from: last7[0].d, to: last7[last7.length - 1].d, n: last7.length,
    avgR: avg('r'), maxR: Math.max(...last7.map((d) => d.r)), avgW: avg('w'), avgX: avg('x'),
    overDays: last7.filter(overQuota).length, krw: last7.reduce((a, d) => a + d.krw, 0),
  } : null;
  return {
    ym, monthFrom: inMonth.length ? inMonth[0].d : tdy, monthKrw, forecastKrw: Math.round(monthKrw + avgKrw * left),
    today: days.find((d) => d.today) || { d: tdy, r: 0, w: 0, x: 0, sb: 0, eg: 0, krw: 0, today: true },
    yesterday: done[done.length - 1] || null, week, days,
  };
}

// 문자 보낼 때인가 — 10만 원은 달마다 한 번 · 주간 보고는 한국 월요일 9시 뒤 한 번 (보낸 기록 = 저장 문서 alerts·weekly)
export function decide(s, state, now, opt = {}) {
  const alertKrw = opt.alertKrw || ALERT_KRW, k = kstParts(now);
  const a = (state.alerts || {})[s.ym], w = (state.weekly || {})[k.date];
  return {
    alert: s.monthKrw >= alertKrw && !(a && a.sent),
    weekly: k.wd === 1 && k.hour >= 9 && !!s.week && !(w && w.sent),
    weekKey: k.date,
  };
}

const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export function alertText(s, url, opt = {}) {
  const alertKrw = opt.alertKrw || ALERT_KRW;
  return `[POUR 비용 알림] Firebase 이번 달 예상 요금이 ${n0(alertKrw)}원을 넘었습니다: ${n0(s.monthKrw)}원 (${md(s.monthFrom)}~${md(s.today.d)})\n`
    + `이 속도면 월말 ${n0(s.forecastKrw)}원\n`
    + (s.yesterday ? `어제 읽기 ${n0(s.yesterday.r)}건 · 쓰기 ${n0(s.yesterday.w)}건\n` : '')
    + `자세히: ${url}\n(실제 청구는 Google Cloud 결제 화면)`;
}
export function weeklyText(s, url, opt = {}) {
  const alertKrw = opt.alertKrw || ALERT_KRW, w = s.week;
  return `[POUR Firebase 주간 사용량] ${md(w.from)}~${md(w.to)}\n`
    + `읽기 하루 평균 ${n0(w.avgR)}건 (최대 ${n0(w.maxR)}) / 무료 ${n0(FREE.r)}\n`
    + `쓰기 하루 평균 ${n0(w.avgW)}건 / 무료 ${n0(FREE.w)}\n`
    + `무료 한도 넘은 날 ${w.overDays}일\n`
    + `이번 달 예상 ${n0(s.monthKrw)}원 · 월말 ${n0(s.forecastKrw)}원 (알림 기준 ${n0(alertKrw)}원)\n`
    + url;
}

// 지난 기록은 최근 것만 (달 12 · 주 8)
export const trimKeys = (o, n) => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-n));

// Firestore REST 값 ↔ JS (저장 문서 읽고 쓰기 · 화면도 같은 모양을 읽음)
export function fsEnc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsEnc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, fsEnc(x)])) } };
}
export function fsDec(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsDec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fsDec(x)]));
  return null;
}
