// ✅ 브랜드별 업무관리 · 그로홈 목표/KPI/행동지표 · 매출 자동 연결 · 실행 현황 — 계산 로직만 (화면은 App.jsx)
//
// 브랜드
//  · 목록: 공유 컬렉션 brands  [{id,name,order,active}]  — 지금 POUR스토어·그로홈, 앞으로 더 추가
//  · 기록의 브랜드: 최종목표 brand → 메인KPI·서브KPI 는 목표를 따라감 → 프로젝트(brand 없으면 메인KPI 따라감) → 업무(프로젝트 따라감)
//    brand 가 없는 예전 데이터 = POUR스토어 · 고정업무(운영)·프로젝트 없는 업무 = 공통(모든 브랜드 화면에 보임)
//  · 브랜드 이름표(키): 런칭보드와 같은 값 pourstore · grohome
//
// 매출 자동 연결
//  · 마진대시보드 › 매출 화면이 브랜드·월·채널별 합계를 pour-os/sales-rollup 에 남긴다 (rows:[{b,ym,ch,amt}])
//  · 서브KPI 에 연결된 채널(salesCh, 없으면 기본 연결표)의 그 해 합계 = 현재값 (salesAuto:false 면 예전처럼 수동)

import { akWeeksIn, akQuarterWeeks, akTotal, akPartial, akLink, akYmd, akWeekKey, akMonthOfWeek } from "./actionKpi.js";

export const COMMON = "common";
export const BRAND_SEED = [
  { id: "pourstore", name: "POUR스토어", order: 1, active: true },
  { id: "grohome", name: "그로홈", order: 2, active: true },
];
const ALIAS = { "pour스토어": "pourstore", "pourstore": "pourstore", "pour": "pourstore", "포어스토어": "pourstore",
  "그로홈": "grohome", "grohome": "grohome", "공통": COMMON, "common": COMMON };
// 저장된 값(이름·키 아무거나) → 브랜드 키. 모르면 null
export function brandKey(v, brands) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/\s/g, "").toLowerCase();
  if (ALIAS[s]) return ALIAS[s];
  const hit = (brands || []).find((b) => b && (String(b.id).toLowerCase() === s || String(b.name || "").replace(/\s/g, "").toLowerCase() === s));
  return hit ? hit.id : String(v);
}
export const brandName = (k, brands) => k === COMMON ? "공통" : ((brands || []).find((b) => b.id === k) || BRAND_SEED.find((b) => b.id === k) || { name: k || "" }).name;

const DEF = "pourstore";
export const goalBrand = (g, brands) => brandKey(g && g.brand, brands) || DEF;
export function mkBrand(mk, D) { const g = (D.goals || []).find((x) => x.id === (mk && mk.goalId)); return g ? goalBrand(g, D.brands) : (brandKey(mk && mk.brand, D.brands) || DEF); }
export function skBrand(sk, D) { const mk = (D.mainKPIs || []).find((x) => x.id === (sk && sk.mainKPIId)); return mk ? mkBrand(mk, D) : DEF; }
export function projBrand(p, D) {
  const own = brandKey(p && p.brand, D.brands); if (own) return own;
  const mk = (D.mainKPIs || []).find((x) => x.id === (p && p.mainKPIId)); return mk ? mkBrand(mk, D) : DEF;
}
export function taskBrand(t, D) {
  if (t && t.projectId) { const p = (D.projects || []).find((x) => x.id === t.projectId); if (p) return projBrand(p, D); }
  return brandKey(t && t.brand, D.brands) || COMMON;   // 고정업무·프로젝트 없는 업무 = 공통
}
export const akBrandOf = (it, brands) => brandKey(it && it.brand, brands) || DEF;
const inB = (k, b) => k === b || k === COMMON;

// 화면용 보기 — 고른 브랜드 + 공통만. "all" 이면 그대로. (저장 데이터는 건드리지 않는다)
export function brandView(D, b) {
  if (!b || b === "all") return { ...D, _brand: "all" };
  const goals = (D.goals || []).filter((g) => goalBrand(g, D.brands) === b);
  const gIds = new Set(goals.map((g) => g.id));
  const mainKPIs = (D.mainKPIs || []).filter((m) => gIds.has(m.goalId) || (!m.goalId && b === DEF));
  const mkIds = new Set(mainKPIs.map((m) => m.id));
  const subKPIs = (D.subKPIs || []).filter((s) => mkIds.has(s.mainKPIId));
  const projects = (D.projects || []).filter((p) => inB(projBrand(p, D), b));
  const tasks = (D.tasks || []).filter((t) => inB(taskBrand(t, D), b));
  const actionKPIs = (D.actionKPIs || []).filter((x) => inB(akBrandOf(x, D.brands), b));
  const lagKPIs = (D.lagKPIs || []).filter((x) => inB(akBrandOf(x, D.brands), b));
  return { ...D, goals, mainKPIs, subKPIs, projects, tasks, actionKPIs, lagKPIs, _brand: b };
}
export const brandCounts = (D, b) => { const v = brandView(D, b); return { goals: v.goals.length, projects: v.projects.length, actionKPIs: v.actionKPIs.length }; };

// ── 그로홈 — 그로홈 대시보드 'KPI 목표 설정(2026)' 6채널(합계 10억) + KPI 체크리스트 엑셀 '그로홈' 시트 ──
export const GH_GOAL = { id: "g_gh", title: "그로홈 2026년 매출 10억 달성", targetValue: 1000000000, currentValue: 0, unit: "원", year: 2026, brand: "grohome" };
export const GH_MAIN = [
  { id: "ghk1", goalId: "g_gh", title: "그로홈 온라인 매출 7.86억", targetValue: 786000000, currentValue: 0, unit: "원", order: 11, krKey: "그로홈1" },
  { id: "ghk2", goalId: "g_gh", title: "그로홈 B2B·제휴 매출 2.14억", targetValue: 214000000, currentValue: 0, unit: "원", order: 12, krKey: "그로홈2" },
];
export const GH_SUB = [
  { id: "ghs1", mainKPIId: "ghk1", title: "자사몰 (메타광고)", targetValue: 280000000, currentValue: 0, unit: "원", order: 1, channelCode: "", badge: "OWN" },
  { id: "ghs2", mainKPIId: "ghk1", title: "쿠팡·오늘의집", targetValue: 340000000, currentValue: 0, unit: "원", order: 2, channelCode: "", badge: "MK" },
  { id: "ghs3", mainKPIId: "ghk1", title: "플랫폼 CPC (11번가·옥션·지마켓·스마트스토어)", targetValue: 166000000, currentValue: 0, unit: "원", order: 3, channelCode: "", badge: "CPC" },
  { id: "ghs4", mainKPIId: "ghk2", title: "철물점 온오프라인", targetValue: 85000000, currentValue: 0, unit: "원", order: 1, channelCode: "", badge: "HDW" },
  { id: "ghs5", mainKPIId: "ghk2", title: "위탁판매 (도매꾹·도매매)", targetValue: 57000000, currentValue: 0, unit: "원", order: 2, channelCode: "", badge: "CNS" },
  { id: "ghs6", mainKPIId: "ghk2", title: "콘텐츠&기획협찬 (공동구매)", targetValue: 72000000, currentValue: 0, unit: "원", order: 3, channelCode: "", badge: "GB" },
];
const MINI = "TC51U2cdFnn6Q5Y7A6o9";
const GH_RAW = [
  { id: "gh_kwtop", fun: "A 유입", cyc: "W", name: "검색키워드 상위노출", goal: 1, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "외주", desc: "ROAS 저조 키워드 재검토 / 스마트스토어·쿠팡은 링크프라이스 활용 — 스마트스토어·쿠팡 유입 기여", mk: "ghk1", sk: "ghs3" },
  { id: "gh_ad", fun: "A 유입", cyc: "W", name: "고객 타겟 광고", goal: 2, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "외주", desc: "메타·구글애즈 디멘드젠 — 자사몰 유입 기여", mk: "ghk1", sk: "ghs1" },
  { id: "gh_influrv", fun: "A 유입", cyc: "M", name: "인플루언서 리뷰 확보", goal: 20, unit: "건", who: ["chaerim"], whoNames: ["채림"], how: "직접", desc: "티블 등 — 3채널 공통 기여", mk: "ghk1", sk: "" },
  { id: "gh_influch", fun: "A 유입", cyc: "Q", name: "인플루언서 확보", goal: 1, unit: "건", who: ["chaerim"], whoNames: ["채림"], how: "직접", desc: "인포크링크 등 — 3채널 공통 기여", mk: "ghk1", sk: "" },
  { id: "gh_detail", fun: "A 활성화", cyc: "M", name: "상세페이지 고도화", goal: 2, unit: "회", who: ["minji"], whoNames: ["민지"], how: "직접", desc: "신제품 SKU 상세페이지 신규 제작 포함 / 신규 리뷰컨텐츠 삽입", mk: "ghk1", sk: "" },
  { id: "gh_promo", fun: "A 활성화", cyc: "M", name: "프로모션 진행", goal: 2, unit: "회", who: ["minji"], whoNames: ["민지"], how: "직접", desc: "악성재고 소진·판매촉진을 위해 기획하여 진행", mk: "ghk1", sk: "" },
  { id: "gh_gb", fun: "A 활성화", cyc: "W", name: "(B2B) 인플루언서 공동구매 제안", goal: 1, unit: "건", who: ["chaerim"], whoNames: ["채림"], how: "직접", desc: "콘텐츠&기획협찬 및 제안 — 인플루언서 공동구매 캠페인으로 매출 창출", mk: "ghk2", sk: "ghs6" },
  { id: "gh_resale", fun: "R 재구매", cyc: "M", name: "(B2B) 위탁판매·도매꾹·도매매 / 철물점", goal: 2, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "위탁판매·철물점 파트너 대상 반복 재주문 유도 / 신제품 우선안내·연관상품 추천", mk: "ghk2", sk: "" },
  { id: "gh_launch", fun: "R 수익", cyc: "M", name: "신제품 출시", goal: 6, unit: "건", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "출시완료: 헤라퍼티·타일필러 / 출시예정 — 리페어 2품목(스티커프라이머·2in1 페인트), 데코 15품목(1차 5: 붙이는 루바보드·조각벽지·카펫트·흡음재 30x30·60x60 / 2차: 대리석·타일시트·롤형 벽지·주방 방오시트·유아 스티커·데코타일/퍼즐매트·조립마루·논슬립 타일·전선몰딩·몰딩테이프)", mk: "ghk1", sk: "" },
  { id: "gh_rvpromo", fun: "R 추천", cyc: "M", name: "리뷰 프로모션 진행확인", goal: 1, unit: "회", who: [MINI], whoNames: ["미니"], how: "직접", desc: "포토리뷰 등 목표 달성률 기준", mk: "ghk1", sk: "" },
];
export const GH_AK_SEED = GH_RAW.map((x, i) => ({ ...x, id: "ak_" + x.id, core: true, active: true, brand: "grohome", order: 100 + i, startDate: "2026-09-28", createdAt: "2026-10-01T09:00:00.000Z", createdBy: "seed" }));
export const GH_LAG_SEED = [
  { id: "lg_gh_ss_in", fun: "A 유입", name: "스마트스토어 월 평균 유입", goal: 20000, unit: "명", base: 13140, mk: "ghk1", sk: "ghs3" },
  { id: "lg_gh_cp_in", fun: "A 유입", name: "쿠팡 월 평균 유입", goal: 300000, unit: "명", base: 249000, mk: "ghk1", sk: "ghs2" },
  { id: "lg_gh_own_in", fun: "A 유입", name: "자사몰 월 평균 유입", goal: 20000, unit: "명", base: 10820, mk: "ghk1", sk: "ghs1" },
  { id: "lg_gh_ss_cv", fun: "A 활성화", name: "스마트스토어 구매전환율", goal: 6, unit: "%", base: 2.1, mk: "ghk1", sk: "ghs3" },
  { id: "lg_gh_cp_cv", fun: "A 활성화", name: "쿠팡 구매전환율", goal: 6, unit: "%", base: 2.15, mk: "ghk1", sk: "ghs2" },
  { id: "lg_gh_own_cv", fun: "A 활성화", name: "자사몰 구매전환율", goal: 7, unit: "%", base: 3.16, mk: "ghk1", sk: "ghs1" },
  { id: "lg_gh_repurchase", fun: "R 재구매", name: "재구매율", goal: null, unit: "%", base: null, mk: "ghk2", sk: "" },
  { id: "lg_gh_launch", fun: "R 수익", name: "신제품 출시 (완료 품목)", goal: 19, unit: "건", base: 2, mk: "ghk1", sk: "" },
  { id: "lg_gh_review", fun: "R 추천", name: "리뷰작업 달성율", goal: 20, unit: "%", base: 35, mk: "ghk1", sk: "" },
].map((x, i) => ({ ...x, brand: "grohome", order: 100 + i, baseNote: "엑셀 기준값", monthly: {} }));

// 처음 한 번 채워넣기 — 같은 id 가 이미 있거나 휴지통에 있으면(누가 지운 것) 다시 넣지 않는다
export function seedMissing(D) {
  const trashIds = new Set((D.trash || []).map((t) => t && t.id));
  const fill = (k, seed) => { const have = new Set((D[k] || []).map((x) => x && x.id)); const add = seed.filter((x) => !have.has(x.id) && !trashIds.has(x.id)); return add.length ? [...(D[k] || []), ...add] : null; };
  const out = {}; let n = 0;
  [["brands", BRAND_SEED], ["goals", [GH_GOAL]], ["mainKPIs", GH_MAIN], ["subKPIs", GH_SUB], ["actionKPIs", GH_AK_SEED], ["lagKPIs", GH_LAG_SEED]].forEach(([k, s]) => { const v = fill(k, s); if (v) { out[k] = v; n += v.length - (D[k] || []).length; } });
  return n ? out : null;
}

// 그로홈 서브KPI 코드 고치기 — CRM 매출 동기화(pour-crm pourOsSync)는 channelCode(OWN·MK…)로 POUR 매출을 넣는다.
// 그로홈 칸이 같은 코드를 쓰면 POUR 매출이 그로홈에 들어가므로 channelCode 는 비우고 화면 표시는 badge 로.
// 이미 CRM 값이 들어간 칸은 0으로 되돌리고 이력에 남긴다(이전 값도 이력에 그대로). 바꿀 게 없으면 null.
export function fixGhSubs(subKPIs, now = new Date().toISOString()) {
  let n = 0;
  const out = (subKPIs || []).map((sk) => {
    if (!sk || !/^ghs\d$/.test(sk.id) || !sk.channelCode) return sk;
    n++;
    const o = { ...sk, channelCode: "", badge: sk.badge || sk.channelCode };
    if (sk.crmSynced) {
      Object.assign(o, { crmSynced: false, manualOverride: false, currentValue: 0, valueAt: now, valueByName: "자동 정정",
        valueHistory: [...(sk.valueHistory || []), { mode: "total", amount: 0, value: 0, prev: sk.currentValue || 0, by: "system", byName: "자동 정정", at: now, note: "CRM의 POUR스토어 매출이 그로홈 칸에 잘못 들어가 0으로 되돌림" }] });
    }
    return o;
  });
  return n ? out : null;
}

// ── 매출 자동 연결 ──
// 채널 이름은 마진대시보드 매출 화면과 같은 이름 (옥션·지마켓, 도매꾹·도매매 처럼 묶인 이름 그대로)
export const SALES_CH_DEFAULT = {
  sk1: ["자사몰"],
  sk2: ["스마트스토어", "쿠팡", "오늘의집", "11번가", "옥션·지마켓", "나비엠알오", "카카오쇼핑", "토스쇼핑"],
  sk3: ["전화 주문", "방문구매", "박람회", "오프라인"],
  ghs1: ["자사몰"], ghs2: ["쿠팡", "오늘의집"], ghs3: ["11번가", "옥션·지마켓", "스마트스토어"],
  ghs4: ["오프라인"], ghs5: ["위탁판매", "도매꾹·도매매"], ghs6: ["공동구매"],
};
export const salesChOf = (sk) => Array.isArray(sk && sk.salesCh) ? sk.salesCh : (SALES_CH_DEFAULT[sk && sk.id] || []);
// 매출 브랜드 이름(마진대시보드: 'POUR스토어' · 'GROHOME' · 제품 브랜드) → 브랜드 키
export const rollBrand = (b, brands) => brandKey(b, brands);
// 그 브랜드·그 해·그 채널들 합계
export function salesSum(roll, brand, year, chs, brands) {
  if (!roll || !Array.isArray(roll.rows) || !chs || !chs.length) return 0;
  const set = new Set(chs), y = String(year || "");
  return roll.rows.reduce((a, r) => a + (rollBrand(r.b, brands) === brand && String(r.ym || "").startsWith(y) && set.has(r.ch) ? (+r.amt || 0) : 0), 0);
}
// 그 브랜드·그 해의 채널별 합계 — 화면에서 '어느 서브KPI에도 안 들어간 채널' 보여줄 때
export function salesByCh(roll, brand, year, brands) {
  const out = {}; if (!roll || !Array.isArray(roll.rows)) return out; const y = String(year || "");
  roll.rows.forEach((r) => { if (rollBrand(r.b, brands) === brand && String(r.ym || "").startsWith(y)) out[r.ch] = (out[r.ch] || 0) + (+r.amt || 0); });
  return out;
}
// 서브KPI 화면값 — 자동 연결이면 currentValue 를 매출 합계로 바꿔서 보여준다 (저장값은 그대로)
//  · 메인KPI2(mk2) 는 프로젝트 매출 합계 규칙 그대로 (건드리지 않음)
export function withAutoSales(D, roll) {
  if (!roll || !Array.isArray(roll.rows)) return D;
  const subKPIs = (D.subKPIs || []).map((sk) => {
    if (sk.mainKPIId === "mk2" || sk.unit !== "원" || sk.salesAuto === false || sk.crmSynced) return sk;   // CRM 매출 동기화 칸은 CRM 값 그대로
    const chs = salesChOf(sk); if (!chs.length) return sk;
    const mk = (D.mainKPIs || []).find((m) => m.id === sk.mainKPIId);
    const g = mk && (D.goals || []).find((x) => x.id === mk.goalId);
    const v = salesSum(roll, skBrand(sk, D), (g && g.year) || 2026, chs, D.brands);
    return { ...sk, currentValue: v, manualOverride: true, _auto: { at: roll.at || "", by: roll.by || "", chs, stored: sk.currentValue } };
  });
  return { ...D, subKPIs };
}
// 마진대시보드에서 쓰는 집계 — 매출 줄들 → rows (테스트용으로 같은 함수를 둔다)
export function rollupRows(rows) {
  const m = {};
  (rows || []).forEach((r) => { const ym = String(r.date || "").slice(0, 7); if (!/^\d{4}-\d\d$/.test(ym)) return; const k = (r.brand || "") + "|" + ym + "|" + (r.ch || ""); m[k] = (m[k] || 0) + (Math.round(+r.amt) || 0); });
  return Object.keys(m).sort().map((k) => { const [b, ym, ch] = k.split("|"); return { b, ym, ch, amt: m[k] }; });
}

// ── 실행 현황 — 행동지표 · 고정업무 · 프로젝트를 섞지 않고 따로 계산 ──
// 행동지표 달성률(이번 달, 지금까지 해야 할 만큼 기준): 주간 = 지난 주+이번 주 / 월간 = 이번 달 / 분기 = 이번 분기
export function akRateOf(docs, items, today) {
  // 이번 주가 속한 달로 센다(주는 월요일의 달) — 오늘 화면 행동지표 카드와 같은 기준. 10/1(목)이면 9/28 주 → 9월
  const { y, m0 } = akMonthOfWeek(akWeekKey(new Date(today + "T00:00:00")));
  const mw = akWeeksIn(y, m0), qw = akQuarterWeeks(y, m0), past = mw.filter((w) => w.start <= today);
  const rows = [];
  (items || []).forEach((it) => {
    if (it.active === false) return;
    const weeks = it.cyc === "W" ? past : it.cyc === "Q" ? qw : mw;
    if (!weeks.length || akPartial(it, weeks)) return;
    const ws = weeks.filter((w) => w.end >= String(it.startDate || "2000-01-01").slice(0, 10));
    if (!ws.length) return;
    const t = akTotal(docs, it, ws); if (t.none || !t.g) return;
    rows.push({ it, n: t.n, g: t.g, r: Math.min(1, t.n / t.g), done: t.done });
  });
  const pct = rows.length ? Math.round((rows.reduce((a, x) => a + x.r, 0) / rows.length) * 100) : null;
  return { pct, n: rows.length, done: rows.filter((x) => x.done).length, rows };
}
export const projRateOf = (projects) => { const ps = (projects || []).filter((p) => (p.status || "active") !== "paused"); return { pct: ps.length ? Math.round(ps.reduce((a, p) => a + (+p.progress || 0), 0) / ps.length) : null, n: ps.length, done: ps.filter((p) => (+p.progress || 0) >= 100 || p.status === "completed").length }; };
// 메인KPI별로 묶기 — 행동지표는 akLink, 프로젝트는 mainKPIId, 고정업무는 연결 프로젝트의 메인KPI
export function execGroups(D, docs, today, fixedDone) {
  const mks = [...(D.mainKPIs || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const pmk = (pid) => ((D.projects || []).find((p) => p.id === pid) || {}).mainKPIId || "";
  const fixed = (D.tasks || []).filter((t) => t.isFixed && !t.paused);
  const grp = (mkId) => {
    const ak = (D.actionKPIs || []).filter((a) => akLink(a).mk === mkId || (!mkId && !mks.some((m) => m.id === akLink(a).mk)));
    const pj = (D.projects || []).filter((p) => (p.mainKPIId || "") === mkId || (!mkId && !mks.some((m) => m.id === p.mainKPIId)));
    const fx = fixed.filter((t) => pmk(t.projectId) === mkId || (!mkId && !mks.some((m) => m.id === pmk(t.projectId))));
    const fd = fx.filter((t) => fixedDone(t)).length;
    return { ak: akRateOf(docs, ak, today), pj: projRateOf(pj), fx: { pct: fx.length ? Math.round((fd / fx.length) * 100) : null, n: fx.length, done: fd } };
  };
  const out = mks.map((mk) => ({ mk, ...grp(mk.id) }));
  const common = grp("");
  if (common.ak.n || common.pj.n || common.fx.n) out.push({ mk: null, ...common });
  return out;
}
export const todayYmd = () => akYmd(new Date());
