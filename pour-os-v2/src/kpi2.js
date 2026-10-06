// 업무OS v2 — KPI 화면 계산 (② 사용자 결정 2026-10-05 · 계산만, 저장 안 함)
// 정의(최종목표 · 메인KPI · 서브KPI · 결과 KPI · 행동지표) = 버전1 문서를 읽기만 (pour-os/state-goals · mainKPIs · subKPIs · lagKPIs · actionKPIs)
//   · CRM 이 버전1 서브KPI(채널 코드 OWN·MK…)에 POUR스토어 매출 누계를 넣고 있어서, 버전1 문서가 지금 값 (crmSynced)
//   · 그로홈 서브KPI(ghs1~6) = 그로홈 대시보드 매출(채널 합계) — pour-os/v2/kpisales/grohome {rows:[{b,ym,ch,amt}], at}
//   · 합계 규칙은 버전1 kpi.js(skCur · mkCur) · brand.js(withAutoSales) 그대로 (매출 집계 규칙 바꾸지 않음)
// 결과 KPI 월 값 = 버전1 monthly + v2 pour-os/v2/lagvals/{결과KPI id}.monthly (v2 값이 있으면 v2) — 월말 입력은 이제 v2 에서
import { numF, skCur, mkCur } from "../../pour-os/src/kpi.js";
import { withAutoSales, salesChOf, goalBrand, mkBrand, akBrandOf, ghSalesRows } from "../../pour-os/src/brand.js";
import { akLink, akWho, akOrder, akTotal, akGoalText, akRetroDay, akAddDays, akYm, can } from "../../pour-os/src/actionKpi.js";
import { periodWeeks } from "./routine.js";

export { ghSalesRows };
const DONE_P = ["completed", "dropped", "archived"];
const items = (d) => (d && Array.isArray(d.items) ? d.items : []).filter((x) => x && x.id && !x.deleted && !x.deletedAt);
// ── KPI 고치기(사용자 결정 2026-10-05 'KPI 변경 가능하게') — 버전1 문서는 읽기만, 고친 것은 v2 덧칠 ──
//  pour-os/v2/kpidefs/{id} = {id, coll, fields:{바꾼 칸}, hidden, created, hist:[{at,by,byName,ch:{칸:[이전,이후]}}]}
//  · 버전1 항목 → fields 를 위에 덮어 보임 · created = v2 에서 새로 만든 항목(fields 가 통째) · hidden = 숨김(지우지 않음 · 다시 보이기)
export const KCOLL = ["goals", "mainKPIs", "subKPIs", "lagKPIs"];
export const KCOLL_L = { goals: "최종 목표", mainKPIs: "메인KPI", subKPIs: "서브KPI", lagKPIs: "결과 KPI" };
export function applyKpiOv(K, ov) {
  const by = {}; (ov || []).forEach((o) => { if (o && o.id && KCOLL.includes(o.coll)) by[o.id] = o; });
  const out = {};
  Object.keys(K).forEach((c) => {
    const seen = new Set();
    const arr = (K[c] || []).map((it) => { seen.add(it.id); const o = by[it.id]; if (!o || o.coll !== c) return it;
      return { ...it, ...(o.fields || {}), ...(o.hidden ? { _hidden: true } : {}), _ov: true }; });
    Object.values(by).forEach((o) => { if (o.coll === c && o.created && !seen.has(o.id)) arr.push({ ...(o.fields || {}), id: o.id, _new: true, ...(o.hidden ? { _hidden: true } : {}) }); });
    out[c] = arr;
  });
  return out;
}
// 숨긴 것 빼기 (메인KPI 를 숨기면 그 서브KPI도 · 목표를 숨기면 그 메인KPI도)
export function visibleDefs(K) {
  if (!K) return K;
  const goals = K.goals.filter((x) => !x._hidden), gid = new Set(goals.map((g) => g.id));
  const mainKPIs = K.mainKPIs.filter((x) => !x._hidden && (!x.goalId || gid.has(x.goalId) || !K.goals.some((g) => g.id === x.goalId))), mid = new Set(mainKPIs.map((m) => m.id));
  return { ...K, goals, mainKPIs, subKPIs: K.subKPIs.filter((x) => !x._hidden && (mid.has(x.mainKPIId) || !K.mainKPIs.some((m) => m.id === x.mainKPIId))), lagKPIs: (K.lagKPIs || []).filter((x) => !x._hidden) };
}
// 서브KPI '지금 값'을 사람이 넣을 수 있나 (자동으로 들어오는 칸은 안 됨)
// % 서브KPI 는 직접 넣지 않았으면 연결된 프로젝트 진척 평균 (버전1 kpi.skCur 와 같은 규칙)
export const pctAuto = (sk, projects) => !!sk && sk.unit === "%" && !sk.manualOverride && (projects || []).some((p) => p && !p.deleted && p.subKPIId === sk.id);
export const skManual = (sk, projects) => !!sk && !pctAuto(sk, projects) && !sk.crmSynced && !sk._auto && !(sk.mainKPIId === "mk2" && sk.unit === "원" && !sk.manualOverride) && !sk.launchCount && !(sk.unit === "원" && sk.salesAuto !== false && salesChOf(sk).length && sk.mainKPIId !== "mk2");
// 저장 칸 (txDoc) — next: 바꿀 칸 {칸: 값} · hide: true/false/undefined · base: 버전1 원래 항목(없으면 새로 만듦)
export function kpiEditWrite(cur, coll, id, next, hide, cu, at, base) {
  const prev = { ...(base || {}), ...((cur && cur.fields) || {}) }, ch = {};
  Object.entries(next || {}).forEach(([k, v]) => { if (!fb_same(prev[k], v)) ch[k] = [prev[k] ?? null, v]; });
  if (hide !== undefined && !!(cur && cur.hidden) !== !!hide) ch._hidden = [!!(cur && cur.hidden), !!hide];
  if (!Object.keys(ch).length) return null;
  const fields = { ...((cur && cur.fields) || {}) }; Object.keys(ch).forEach((k) => { if (k !== "_hidden") fields[k] = next[k]; });
  const h = { at, by: cu.id, byName: cu.name, ch };
  const w = { coll, fields, hidden: hide !== undefined ? !!hide : !!(cur && cur.hidden), hist: [...((cur && cur.hist) || []), h].slice(-100), at, by: cu.id, byName: cu.name };
  if (!cur) w.created = !base;
  return w;
}
const fb_same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const newKpiId = (coll) => `v2k_${coll.slice(0, 3)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// 버전1 문서 4개 → 정의 (undefined = 아직 못 읽음) · ov 가 있으면 v2 덧칠 (숨긴 것도 _hidden 으로 남김 — 화면 계산은 visibleDefs)
export function kpiDefs(docs, ov) {
  const k = ["goals", "mainKPIs", "subKPIs", "lagKPIs"];
  if (k.some((x) => docs[x] === undefined)) return null;
  const o = {}; k.forEach((x) => { o[x] = items(docs[x]); }); return ov ? applyKpiOv(o, ov) : o;
}
const ord = (a, b) => numF(a.order) - numF(b.order);
export const lagBrand = (it, brands) => akBrandOf(it, brands);
// 결과 KPI 한 달 값 (v2 먼저 · 없으면 버전1) — {v, by, byName, at, src} | null
export function lagAt(it, v2, ym) {
  const a = (((v2 || {})[it.id] || {}).monthly || {})[ym];
  if (a && a.v != null && a.v !== "") return { ...a, v: +a.v, src: "v2" };
  const b = (it.monthly || {})[ym];
  if (b && b.v != null && b.v !== "") return { ...b, v: +b.v, src: "v1" };
  return null;
}
// 가장 최근 달 값(기준 달까지) · 없으면 엑셀 기준값
export function lagLatest(it, v2, upto) {
  const ks = new Set([...Object.keys(it.monthly || {}), ...Object.keys((((v2 || {})[it.id]) || {}).monthly || {})]);
  const ms = [...ks].filter((k) => /^\d{4}-\d\d$/.test(k) && (!upto || k <= upto) && lagAt(it, v2, k)).sort();
  if (ms.length) { const ym = ms[ms.length - 1]; return { ...lagAt(it, v2, ym), ym }; }
  return { v: it.base == null || it.base === "" ? null : +it.base, ym: null, base: true };
}
export const lagGoal = (it) => (it.goal == null || it.goal === "" ? null : +it.goal);
export const lagPct = (it, v) => { const g = lagGoal(it); return g && v != null ? Math.round((v / g) * 100) : null; };

// 서브KPI 숫자가 어디서 오는지
function skSrc(sk, mk, hasGh, projects) {
  if (sk.crmSynced) return { auto: true, t: "CRM 자동" };
  if (pctAuto(sk, projects)) return { auto: true, t: "프로젝트 진척 평균" };
  if (sk._auto) return { auto: true, t: "그로홈 대시보드 자동" };
  if (sk.mainKPIId === "mk2" && sk.unit === "원" && !sk.manualOverride) return { auto: true, t: "프로젝트 매출 합계" };
  if (sk.unit === "원" && sk.salesAuto !== false && salesChOf(sk).length && sk.mainKPIId !== "mk2") return { auto: false, t: hasGh ? "직접 입력" : "매출 불러오는 중" };
  return { auto: false, t: "직접 입력" };
}
// 이번 기간 행동지표 n/목표 (주간 = 이번 주 · 월간 = 이번 달 · 분기)
export function akNow(it, docs, key) {
  const weeks = periodWeeks(it, key), tot = akTotal(docs, it, weeks);
  return { it, n: tot.n, g: tot.g, done: tot.done, pct: tot.g ? Math.min(100, Math.round((tot.n / tot.g) * 100)) : null, per: it.cyc === "W" ? "이번 주" : it.cyc === "M" ? "이번 달" : "이번 분기", goal: akGoalText(it) };
}
const projOpen = (p) => p && !p.deleted && !DONE_P.includes(p.status || "active");

// KPI 판 — brand: 브랜드 키 · K: kpiDefs · ctx: {brands, projects(v2), ak:{items, docs}, gh(kpisales/grohome), lagV2, users, key(오늘 YYYY-MM-DD)}
export function kpiBoard(K0, ctx, brand) {
  if (!K0) return null; const K = visibleDefs(K0);
  const brands = ctx.brands || [], projects = (ctx.projects || []).filter((p) => !p.deleted);
  const gh = ctx.gh && Array.isArray(ctx.gh.rows) ? ctx.gh : null;
  const D0 = withAutoSales({ goals: K.goals, mainKPIs: K.mainKPIs, subKPIs: K.subKPIs, brands }, gh ? { rows: gh.rows, at: gh.at || "", by: gh.by || "" } : null);
  const goals = K.goals.filter((g) => goalBrand(g, brands) === brand).sort(ord);
  const akItems = ((ctx.ak && ctx.ak.items) || []).filter((it) => it && it.active !== false && !it.deleted && akBrandOf(it, brands) === brand).sort(akOrder);
  const akDocs = (ctx.ak && ctx.ak.docs) || {};
  const subs = D0.subKPIs;
  const moversOf = (mk, sk) => {
    const aks = akItems.filter((it) => { const l = akLink(it); return sk ? l.sk === sk.id : l.mk === mk.id && !l.sk; }).map((it) => ({ ...akNow(it, akDocs, ctx.key), who: akWho(ctx.users, it) }));
    const ps = projects.filter((p) => projOpen(p) && (sk ? p.subKPIId === sk.id : p.mainKPIId === mk.id && !p.subKPIId)).map((p) => ({ p, pct: Math.max(0, Math.min(100, Math.round(numF(p.progress)))) }));
    return { aks, ps };
  };
  const out = goals.map((g) => {
    const mks = D0.mainKPIs.filter((m) => m.goalId === g.id).sort(ord).map((mk) => {
      const ss = subs.filter((s) => s.mainKPIId === mk.id).sort(ord).map((sk) => { const cur = skCur(sk, projects), t = numF(sk.targetValue);
        return { sk, cur, target: t, pct: t > 0 ? Math.round((cur / t) * 100) : null, src: skSrc(sk, mk, !!gh, projects), mv: moversOf(mk, sk) }; });
      const cur = mkCur(mk, subs, projects), t = numF(mk.targetValue);
      return { mk, cur, target: t, pct: t > 0 ? Math.round((cur / t) * 100) : null, subs: ss, mv: moversOf(mk, null),
        auto: ss.length > 0 && mk.unit === "원" && ss.every((s) => s.src.auto) };
    });
    const money = mks.filter((m) => m.mk.unit === "원"), cur = money.reduce((a, m) => a + m.cur, 0), t = numF(g.targetValue);
    return { g, cur, target: t, pct: t > 0 ? Math.round((cur / t) * 100) : null, mks };
  });
  const lags = K.lagKPIs.filter((it) => lagBrand(it, brands) === brand).sort(ord);
  return { brand, goals: out, lags, aks: akItems, gh };
}

// 이 사람 'KPI' — 내가 맡은 행동지표가 움직이는 서브KPI·메인KPI + 내 프로젝트가 걸린 KPI (브랜드마다)
export function myKpi(board, uid, D) {
  if (!board) return [];
  const mineP = (p) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid);
  const rows = [];
  board.goals.forEach((g) => g.mks.forEach((m) => {
    const take = (x, kind) => { const aks = x.mv.aks.filter((a) => a.who.includes(uid)), ps = x.mv.ps.filter((q) => mineP(q.p));
      if (aks.length || ps.length) rows.push({ kind, g: g.g, mk: m.mk, x, aks, ps }); };
    m.subs.forEach((s) => take(s, "sub")); take(m, "main");
  }));
  return rows;
}

// 월말 입력 — 그 달에 아직 값이 없는 결과 KPI
export const lagMissing = (lags, v2, ym) => (lags || []).filter((it) => !lagAt(it, v2, ym));
// 알림 달: 마지막 평일 3일 전부터 그 달 · 새 달 10일까지는 지난달 (값이 다 들어가면 없음) — 버전1 월말 회고와 같은 날짜 규칙
// 월말 입력 알림은 v2 결과 KPI 를 연 달(2026-10)부터 — 그 전 달은 알리지 않음(정밀 검토 2026-10-06 · 9월 15개 '늦음'이 첫날부터 뜨지 않게)
export const LAG_START = "2026-10";
export function lagDue(key, lags, v2) {
  const [y, m] = key.split("-").map(Number), m0 = m - 1;
  const pd = new Date(y, m0 - 1, 1), pym = akYm(pd.getFullYear(), pd.getMonth());
  if (+key.slice(8, 10) <= 10 && pym >= LAG_START) { const miss = lagMissing(lags, v2, pym); if (miss.length) return { ym: pym, late: true, miss, day: akRetroDay(pd.getFullYear(), pd.getMonth()) }; }
  const day = akRetroDay(y, m0), ym = akYm(y, m0);
  if (key >= akAddDays(day, -3) && ym >= LAG_START) { const miss = lagMissing(lags, v2, ym); if (miss.length) return { ym, late: key > day, miss, day }; }
  return null;
}
export const canLag = (u) => can(u, "kpiLag");
// '확인할 것' 한 줄 (마스터 · 결과 KPI 권한) — 다 넣으면 사라짐
export function lagInbox(lags, v2, users, uid, key, brands) {
  const me = (users || []).find((u) => u.id === uid); if (!me || !canLag(me) || !(lags || []).length) return [];
  const d = lagDue(key, lags, v2); if (!d) return [];
  const by = {}; d.miss.forEach((it) => { const b = lagBrand(it, brands); by[b] = (by[b] || 0) + 1; });
  const bn = (k) => ((brands || []).find((b) => b.id === k) || { name: k }).name;
  return [{ kind: "lagDue", id: "lag:" + d.ym, ym: d.ym, tag: "결과 KPI", red: d.late, keep: true, title: `${+d.ym.slice(5)}월 결과 KPI 넣기`,
    text: [`${d.miss.length}개 남음`, Object.entries(by).map(([k, n]) => `${bn(k)} ${n}`).join(" · "), d.late ? "늦음" : `${+d.day.slice(5, 7)}/${+d.day.slice(8)}까지`].filter(Boolean).join(" · "), at: "" }];
}
// 저장할 칸 (txDoc) — 지우지 않음: 빈 값으로 고치면 v:null + 이력에 이전 값
export function lagWrite(cur, it, ym, v, cu, at) {
  const prev = (((cur || {}).monthly || {})[ym] || {}).v;
  const val = v === "" || v == null ? null : +v;
  if (val != null && !isFinite(val)) return null;
  if ((prev ?? null) === val) return null;
  const cell = { v: val, by: cu.id, byName: cu.name, at }, h = { ym, v: val, prev: prev ?? null, by: cu.id, byName: cu.name, at };
  if (!cur) return { lagId: it.id, monthly: { [ym]: cell }, hist: [h] };
  return { ["monthly." + ym]: cell, hist: [...(cur.hist || []), h].slice(-200) };
}

// 금액 줄이기 — 1억 9,200만 · 4,100만 · 3,200
export function won(n) {
  const v = Math.round(numF(n)), a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e8) { const e = Math.floor(a / 1e8), m = Math.round((a % 1e8) / 1e4); return `${s}${e}억${m ? " " + m.toLocaleString("ko-KR") + "만" : ""}`; }
  if (a >= 1e4) return `${s}${Math.round(a / 1e4).toLocaleString("ko-KR")}만`;
  return s + a.toLocaleString("ko-KR");
}
export function fmtV(v, unit) {
  if (v == null || v === "") return "—";
  if (unit === "원") return won(v);
  const n = +v; return `${Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${unit && unit !== "원" ? unit : ""}`;
}
export { mkBrand };
export const goalBrandOf = goalBrand;
