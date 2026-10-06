// 업무OS v2 — 월말 보고서 계산 (③ 사용자 확정 2026-10-06 · 시안 mockups/step9 · step10) · 계산만, 저장은 reportui.jsx
//  · 브랜드 보고서 = 그 달 매출(POUR스토어 CRM · 그로홈 대시보드) · 결과 KPI · 끝낸 프로젝트 · 반복 일 달성 · 지난 일·막힘 · 다음 달에 할 것
//  · 프로젝트 보고서 = 기간 · 진척 · 그 달 끝낸 일 흐름 · 남은 일 · 담당별
//  · 기밀 업무·프로젝트는 보고서에 아예 안 넣음(보는 사람과 상관없이 · 공유 링크로 나가므로)
//  · 저장: pour-os/v2/reports/{브랜드|프로젝트}-{YYYY-MM} = {kind, key, ym, title, status draft|final, data(확정본·공유본), share{on,token}, summary, hideMoney}
//          관리자 메모 = pour-os/v2/reportnotes/{id} (공유 페이지는 절대 안 읽음)
import { ymd, md, isDone, dueOf, ownersOf, nameOf, projOpen, projPct } from "./model.js";
import { secretOn } from "./secret.js";
import { projBrand, goalBrand, akBrandOf, rollBrand } from "../../pour-os/src/brand.js";
import { akWeeksIn, akVal, akOrder, akQidOfMonth } from "../../pour-os/src/actionKpi.js";
import { lagAt, lagGoal, lagPct, lagBrand } from "./kpi2.js";

export const pad = (n) => String(n).padStart(2, "0");
export const ymAdd = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const mLabel = (ym) => `${+String(ym).slice(5, 7)}월`;
export const ymLabel = (ym) => `${String(ym).slice(0, 4)}년 ${mLabel(ym)}`;
export const lastDayOf = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
export const monthRange = (ym) => ({ from: `${ym}-01`, to: `${ym}-${pad(lastDayOf(ym))}` });
// 끝낸 날 (이 기기 날짜 — doneAt 은 UTC ISO)
export const dayOfIso = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? String(iso).slice(0, 10) : ymd(d); };
export const doneDay = (t) => (t && isDone(t) ? dayOfIso(t.doneAt || t.finishedAt) || String(t.doneDate || "").slice(0, 10) : "");
export const projDoneDay = (p) => { if (!p || !(p.status === "completed" || p.status === "done")) return "";
  const e = [...(p.endLog || [])].reverse().find((x) => x && x.kind === "completed"); return dayOfIso(p.completedAt || (e && e.at)) || ""; };
const inM = (day, r) => !!day && day >= r.from && day <= r.to;

// 보고서 문서 id · 공유 링크
export const reportId = (key, ym) => `${String(key).replace(/[/\s~#]/g, "_")}-${ym}`;
export const newToken = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const shareHash = (id, token) => `#${encodeURIComponent(id)}~${token}`;
export const parseShare = (h) => { const m = /^#?(.+)~([a-z0-9]+)$/i.exec(String(h || "")); if (!m) return null; try { return { id: decodeURIComponent(m[1]), token: m[2] }; } catch (e) { return null; } };
export const shareUrl = (href, id, token) => String(href || "").split("#")[0].split("?")[0].replace(/[^/]*$/, "os2-report.html") + shareHash(id, token);

// 기밀 빼기 — 업무가 기밀이거나, 그 프로젝트·상위 업무가 기밀이면 뺌
export function hiddenSet(projects, tasks) {
  const sp = new Set((projects || []).filter(secretOn).map((p) => p.id)), byId = new Map((tasks || []).map((t) => [t.id, t]));
  const hid = (t, d = 0) => !t || secretOn(t) || (t.projectId && sp.has(t.projectId)) || (d < 20 && t.parentId && byId.has(t.parentId) && hid(byId.get(t.parentId), d + 1));
  return { proj: (p) => !p || secretOn(p), task: (t) => hid(t) };
}
// 프로젝트 브랜드 = 브랜드 칸 → 메인KPI 브랜드(버전1 규칙) · 둘 다 없으면 이름에 브랜드 이름이 있을 때 그 브랜드(예: '그로홈 기부')
export function projBrandR(p, BD) {
  if (p && !String(p.brand || "").trim() && !((BD.mainKPIs || []).some((m) => m.id === p.mainKPIId))) {
    const t = String(p.title || ""), hit = (BD.brands || []).filter((b) => b && b.name && t.includes(b.name));
    if (hit.length === 1) return hit[0].id;
  }
  return projBrand(p, BD);
}
const live = (t) => t && !t.deleted && !t.isFixed && t.status !== "dropped";
const whoN = (users, t) => ownersOf(t).map((u) => nameOf(users, u)).filter(Boolean).join("·");

// 그 달 매출 — POUR스토어 = CRM 월·채널 합계(kpisales/crm-pourstore) · 그로홈 = 그로홈 대시보드(kpisales/grohome rows) · 그 밖 = 없음
export function salesMonth(sales, brand, ym, brands) {
  const S = sales || {}, y = ym.slice(0, 4);
  let ch = {}, ytd = 0, src = "", at = "";
  if (brand === "pourstore" && S["crm-pourstore"] && S["crm-pourstore"].months) {
    const M = S["crm-pourstore"].months; src = "CRM"; at = S["crm-pourstore"].at || "";
    ch = { ...((M[ym] || {}).ch || {}) }; if (!Object.keys(ch).length && (M[ym] || {}).total) ch = { 합계: M[ym].total };
    Object.entries(M).forEach(([k, v]) => { if (k.startsWith(y) && k <= ym) ytd += +(v && v.total) || Object.values((v && v.ch) || {}).reduce((a, b) => a + (+b || 0), 0); });
  } else {
    const G = Object.values(S).find((x) => x && Array.isArray(x.rows) && x.rows.some((r) => rollBrand(r.b, brands) === brand));
    if (!G) return null; src = brand === "grohome" ? "그로홈 대시보드" : "매출 합계"; at = G.checkedAt || G.at || "";
    G.rows.forEach((r) => { if (rollBrand(r.b, brands) !== brand) return; const ch0 = String(r.ch || "기타").trim() || "기타";
      if (r.ym === ym) ch[ch0] = (ch[ch0] || 0) + (+r.amt || 0); if (String(r.ym || "").startsWith(y) && r.ym <= ym) ytd += +r.amt || 0; });
  }
  const list = Object.entries(ch).map(([k, v]) => ({ ch: k, amt: Math.round(+v || 0) })).filter((x) => x.amt).sort((a, b) => b.amt - a.amt);
  return { total: list.reduce((a, b) => a + b.amt, 0), ch: list, ytd: Math.round(ytd), src, at };
}
// 그 해 매출 목표(브랜드 최종 목표 · 원) → 월 목표 = 연 목표 ÷ 12
export function salesGoal(K, brand, ym, brands) {
  const y = +ym.slice(0, 4);
  const g = ((K && K.goals) || []).filter((x) => !x._hidden && goalBrand(x, brands) === brand && (x.unit || "원") === "원" && +x.targetValue > 0 && (!x.year || +x.year === y))[0];
  if (!g) return null; const t = +g.targetValue, m = +ym.slice(5, 7);
  return { year: t, month: Math.round(t / 12), ytd: Math.round((t * m) / 12), title: g.title };
}
// 그 달 반복 일(횟수 목표) — 주간 = 그 달 주 수 × 목표 · 월간 = 목표 · 분기 = 목표 ÷ 3 · %·실패 기준 항목은 뺌
export function akMonth(items, docs, ym, brand, brands) {
  const weeks = akWeeksIn(+ym.slice(0, 4), +ym.slice(5, 7) - 1);
  if (docs && !docs[akQidOfMonth(+ym.slice(0, 4), +ym.slice(5, 7) - 1)]) return { pct: null, n: 0, g: 0, items: [], none: true };   // 그 분기 기록을 못 읽음 → 0% 대신 '—
  const rows = (items || []).filter((it) => it && it.active !== false && !it.deleted && !it.paused && !it._hidden && it.unit !== "%" && !it.perFail && akBrandOf(it, brands) === brand).sort(akOrder)
    .map((it) => { const n = weeks.reduce((a, w) => a + akVal(docs || {}, it, w.key), 0), goal = +it.goal || 1;
      const g = it.cyc === "W" ? goal * weeks.length : it.cyc === "Q" ? Math.ceil(goal / 3) : goal;
      return { id: it.id, name: String(it.name || "").replace(/^\([^)]*\)\s*/, ""), n, g }; });
  const G = rows.reduce((a, r) => a + r.g, 0), N = rows.reduce((a, r) => a + Math.min(r.n, r.g), 0);
  return { pct: G ? Math.round((N / G) * 100) : null, n: N, g: G, items: [...rows].sort((a, b) => b.g - a.g || b.n - a.n) };
}

// 보고서에 보이는 프로젝트 한 줄
const projLine = (p, X, r) => {
  const ts = (X.tasks || []).filter((t) => t.projectId === p.id && live(t));
  return { id: p.id, title: p.title || "(이름 없음)", start: String(p.startDate || dayOfIso(p.createdAt) || "").slice(0, 10), end: projDoneDay(p) || String(p.launchDate || p.dueDate || "").slice(0, 10),
    pct: projPct(p), done: ts.filter((t) => inM(doneDay(t), r)).length, total: ts.length, lead: nameOf(X.users, p.assigneeId), launch: !!p.launchDate };
};

// ── 브랜드 보고서 ──
// X = {users, brands, projects, tasks(불러온 것 + 그 달 끝낸 것), K(KPI 정의 · 숨긴 것 뺀 것), sales(D.kpi.sales), lagDefs, lagV2, ak:{items, docs}, key(오늘)}
export function reportBrand(X, brand, ym) {
  const r = monthRange(ym), key = X.key || ymd(new Date()), cut = key < r.to ? key : r.to, brands = X.brands || [];
  const H = hiddenSet(X.projects, X.tasks), BD = { goals: (X.K && X.K.goals) || [], mainKPIs: (X.K && X.K.mainKPIs) || [], brands };
  const P = (X.projects || []).filter((p) => p && !p.deleted && !H.proj(p) && projBrandR(p, BD) === brand);
  const pid = new Set(P.map((p) => p.id));
  const T = (X.tasks || []).filter((t) => live(t) && pid.has(t.projectId) && !H.task(t));
  const doneP = P.filter((p) => inM(projDoneDay(p), r)).map((p) => projLine(p, X, r)).sort((a, b) => a.end.localeCompare(b.end));
  const openP = P.filter((p) => projOpen(p) && p.status !== "hold" && p.status !== "paused" && !(projDoneDay(p) && projDoneDay(p) <= r.to)).map((p) => projLine(p, X, r))
    .filter((x) => x.done > 0 || x.pct > 0 || (x.end && x.end >= r.from)).sort((a, b) => b.done - a.done || b.pct - a.pct).slice(0, 12);
  const nr = monthRange(ymAdd(ym, 1));
  const nextP = P.filter((p) => projOpen(p) && inM(String(p.launchDate || p.dueDate || "").slice(0, 10), nr)).map((p) => projLine(p, X, r)).sort((a, b) => a.end.localeCompare(b.end)).slice(0, 8);
  const doneT = T.filter((t) => inM(doneDay(t), r));
  const late = T.filter((t) => { const d = dueOf(t); return d && d >= r.from && d <= cut && d < key && (!isDone(t) || doneDay(t) > d); });
  const blocked = T.filter((t) => !isDone(t) && t.blocked && t.status !== "hold");
  const sm = salesMonth(X.sales, brand, ym, brands), sg = salesGoal(X.K, brand, ym, brands);
  const sales = sm && { ...sm, goal: sg ? sg.month : null, pct: sg && sg.month ? Math.round((sm.total / sg.month) * 100) : null, ytdGoal: sg ? sg.ytd : null, ytdPct: sg && sg.ytd ? Math.round((sm.ytd / sg.ytd) * 100) : null };
  const lags = ((X.lagDefs) || []).filter((it) => lagBrand(it, brands) === brand).sort((a, b) => (+a.order || 0) - (+b.order || 0)).map((it) => {
    const a = lagAt(it, X.lagV2, ym), p = lagAt(it, X.lagV2, ymAdd(ym, -1)), v = a ? a.v : null;
    return { id: it.id, name: it.name, unit: it.unit || "", v, goal: lagGoal(it), pct: lagPct(it, v), prev: p ? p.v : null }; });
  const ak = akMonth(X.ak && X.ak.items, X.ak && X.ak.docs, ym, brand, brands);
  const bn = (brands.find((b) => b.id === brand) || { name: brand }).name;
  const head = sales && sales.pct != null ? `매출 목표 ${sales.pct}% 달성` : doneP.length ? `끝낸 프로젝트 ${doneP.length}개` : `끝낸 업무 ${doneT.length}건`;
  return { v: 1, kind: "brand", key: brand, ym, title: `${bn} ${mLabel(ym)} 보고서`, name: bn, head, asOf: cut, at: new Date().toISOString(),
    sales, lags, ak: { pct: ak.pct, n: ak.n, g: ak.g, items: ak.items.slice(0, 6) },
    done: doneP, open: openP, next: nextP, tasksDone: doneT.length, late: late.length, blocked: blocked.length,
    lateList: late.filter((t) => !isDone(t)).sort((a, b) => dueOf(a).localeCompare(dueOf(b))).slice(0, 6).map((t) => ({ id: t.id, title: t.title, due: dueOf(t), who: whoN(X.users, t), pid: t.projectId })) };
}

// ── 프로젝트 보고서 ── tasks = 그 프로젝트 업무 전부(서버에서 읽은 것)
export function reportProject(X, p, tasks, ym) {
  if (!p || p.deleted || secretOn(p)) return null;
  const r = monthRange(ym), key = X.key || ymd(new Date());
  const H = hiddenSet([p], tasks);
  const T = (tasks || []).filter((t) => t.projectId === p.id && live(t) && !H.task(t));
  const done = T.filter(isDone), open = T.filter((t) => !isDone(t));
  const flowT = T.filter((t) => inM(doneDay(t), r)).sort((a, b) => doneDay(a).localeCompare(doneDay(b)) || String(a.doneAt || "").localeCompare(String(b.doneAt || "")));
  const lateBy = (t) => { const d = dueOf(t), x = doneDay(t); return d && x && x > d ? Math.round((new Date(x + "T00:00:00") - new Date(d + "T00:00:00")) / 864e5) : 0; };
  const lateOpen = open.filter((t) => { const d = dueOf(t); return d && d < key && t.status !== "hold"; });
  const by = {}; flowT.forEach((t) => ownersOf(t).forEach((u) => { const n = nameOf(X.users, u); if (n) (by[n] = by[n] || { name: n, done: 0, left: 0 }).done++; }));
  open.forEach((t) => ownersOf(t).forEach((u) => { const n = nameOf(X.users, u); if (n) (by[n] = by[n] || { name: n, done: 0, left: 0 }).left++; }));
  const pct = T.length ? Math.round((done.length / T.length) * 100) : projPct(p);
  const start = String(p.startDate || dayOfIso(p.createdAt) || "").slice(0, 10) || T.map((t) => dayOfIso(t.createdAt)).filter(Boolean).sort()[0] || "";
  const end = projDoneDay(p) || String(p.launchDate || p.dueDate || "").slice(0, 10);
  return { v: 1, kind: "project", key: p.id, ym, title: `${p.title} · ${mLabel(ym)}`, name: p.title, head: p.title, asOf: key < r.to ? key : r.to, at: new Date().toISOString(),
    lead: nameOf(X.users, p.assigneeId), start, end, launch: !!p.launchDate, status: p.status || "active", pct, total: T.length, doneN: done.length, doneM: flowT.length,
    lateN: lateOpen.length + flowT.filter((t) => lateBy(t) > 0).length,
    flow: flowT.slice(0, 150).map((t) => ({ id: t.id, title: t.title, day: doneDay(t), who: whoN(X.users, t), late: lateBy(t), files: (t.attachments || []).length })),
    left: open.sort((a, b) => (dueOf(a) || "9").localeCompare(dueOf(b) || "9")).slice(0, 12).map((t) => ({ id: t.id, title: t.title, due: dueOf(t), who: whoN(X.users, t), late: !!(dueOf(t) && dueOf(t) < key && t.status !== "hold"), hold: t.status === "hold" })),
    leftN: open.length, byOwner: Object.values(by).sort((a, b) => b.done - a.done || b.left - a.left).slice(0, 12) };
}

// 프로젝트 고르기 목록 — 그 달에 열려 있었거나 끝낸 것 (기밀 뺌)
export function reportProjects(projects, ym) {
  const r = monthRange(ym);
  return (projects || []).filter((p) => p && !p.deleted && !secretOn(p) && (projOpen(p) ? !(String(p.createdAt || "").slice(0, 10) > r.to) : inM(projDoneDay(p), r)))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ko"));
}

// ── 저장 칸 (txDoc) — 지우지 않음 · 확정본은 다시 확정하면 이전 것을 reporthist 에 남김 ──
const who = (cu, at) => ({ at, by: cu.id, byName: cu.name });
const baseOf = (data) => ({ kind: data.kind, key: data.key, ym: data.ym, title: data.title });
const logAdd = (cur, e) => [...((cur && cur.log) || []), e].slice(-60);
// 확정: data 를 얼림 · status final
export function confirmWrite(cur, data, cu, at) {
  return { ...(cur ? {} : { ...baseOf(data), share: { on: false }, hideMoney: false }), title: data.title, status: "final", data: { ...data, summary: (cur && cur.summary) || "" },
    dataAt: at, final: who(cu, at), log: logAdd(cur, { ...who(cu, at), act: cur && cur.status === "final" ? "다시 확정" : "확정" }) };
}
// 공유 켜기(새 링크 · 이전 링크는 안 열림) · 초안이면 지금 값을 공유본으로
export function shareOnWrite(cur, data, cu, at, token) {
  const draft = !cur || cur.status !== "final";
  return { ...(cur ? {} : { ...baseOf(data), status: "draft", hideMoney: false }), share: { on: true, token, ...who(cu, at) }, ...(draft ? { data, dataAt: at } : {}),
    log: logAdd(cur, { ...who(cu, at), act: "공유 링크 만듦" }) };
}
export const shareOffWrite = (cur, cu, at) => (!cur || !cur.share || !cur.share.on ? null : { share: { ...cur.share, on: false, offAt: at, offBy: cu.id }, log: logAdd(cur, { ...who(cu, at), act: "공유 끔" }) });
export const refreshWrite = (cur, data, cu, at) => (!cur || cur.status === "final" ? null : { data, dataAt: at, log: logAdd(cur, { ...who(cu, at), act: "공유 내용 지금 값으로" }) });
export const moneyWrite = (cur, data, hide, cu, at) => ({ ...(cur ? {} : { ...baseOf(data), status: "draft", share: { on: false } }), hideMoney: !!hide, log: logAdd(cur, { ...who(cu, at), act: hide ? "공유에서 금액 숨김" : "공유에서 금액 보임" }) });
export function summaryWrite(cur, data, text, cu, at) {
  const t = String(text || "").trim(); if (t === String((cur && cur.summary) || "")) return null;
  return { ...(cur ? {} : { ...baseOf(data), status: "draft", share: { on: false }, hideMoney: false }), summary: t, summaryAt: at, summaryBy: cu.id, summaryByName: cu.name,
    summaryHist: [...((cur && cur.summaryHist) || []), { prev: (cur && cur.summary) || "", ...who(cu, at) }].slice(-30) };
}
// 공유 페이지에 보일 것 (확정본 = 얼린 data · 초안 = 공유 때 찍은 data + 지금 한 줄 정리)
export function sharedView(doc, token) {
  if (!doc) return { err: "없는 보고서예요" };
  if (!doc.share || !doc.share.on || doc.share.token !== token) return { err: "공유가 꺼졌거나 바뀐 링크예요" };
  if (!doc.data) return { err: "아직 공유할 내용이 없어요" };
  return { data: { ...doc.data, summary: doc.status === "final" ? doc.data.summary || "" : doc.summary || "" }, final: doc.status === "final", finalAt: doc.final && doc.final.at, money: !doc.hideMoney, dataAt: doc.dataAt };
}
// 관리자 메모 (댓글 · 회의록 · 대표님 피드백) — pour-os/v2/reportnotes/{id} · 더하기만
export const NOTE_KINDS = [["comment", "댓글"], ["minutes", "회의록"], ["ceo", "대표님 피드백"]];
export const noteDoc = (reportId, kind, text, title, cu, at) => ({ reportId, kind, title: String(title || "").trim(), text: String(text || "").trim(), by: cu.id, byName: cu.name, at });
