// 업무OS v2 — 그로스보드 v2 계산 (③ 사용자 확정 2026-10-06 · 시안 mockups/step8 ③ · step11 ③) · 저장 없음
//  나무: 뿌리(기간 · 누구) → KPI(서브KPI·메인KPI · %) → 프로젝트·반복 → 끝낸 일(그 기간)
//  보는 범위: 팀원 = 나 · 우리 팀 / 관리자 = 모두까지 · 기밀 업무·프로젝트는 뺌
//  2단계(그로홈 대시보드 쌍방향)에서 그로홈 그로스보드 할 일 = 업무OS 업무로 들어오면 같은 나무에 그대로 붙음 (프로젝트 업무)
import { ymd, md, isDone, ownersOf, nameOf, projOpen, projPct, dueOf, teamOf, activeUsers } from "./model.js";
import { kpiBoard } from "./kpi2.js";
import { akLink, akWho } from "../../pour-os/src/actionKpi.js";
import { hiddenSet, doneDay, projDoneDay, monthRange, ymAdd, mLabel } from "./report.js";

// 기간: month = 이번 달 · prev = 지난달 · half = 이번 반기(1~6월 / 7~12월)
export function periodOf(kind, key) {
  const ym = key.slice(0, 7), y = key.slice(0, 4), h2 = +key.slice(5, 7) > 6;
  if (kind === "prev") { const p = ymAdd(ym, -1); return { kind, ...monthRange(p), label: `${mLabel(p)}` }; }
  if (kind === "half") return { kind, from: `${y}-${h2 ? "07" : "01"}-01`, to: `${y}-${h2 ? "12-31" : "06-30"}`, label: `${y} ${h2 ? "하반기" : "상반기"}` };
  return { kind: "month", ...monthRange(ym), label: mLabel(ym) };
}
// 보는 사람들: me · team(내 팀 · 팀이 없으면 나) · all(관리자)
export function peopleOf(users, uid, scope) {
  const me = (users || []).find((u) => u.id === uid);
  if (scope === "all") return activeUsers(users).map((u) => u.id);
  if (scope === "team") { const tm = teamOf(me); return tm ? activeUsers(users).filter((u) => teamOf(u) === tm).map((u) => u.id) : [uid]; }
  return [uid];
}

// X = {users, brands, projects, tasks, K(kpiDefs), ak:{items,docs}, gh, lagV2, key}
export function growthTree(X, { uids, period, rootName }) {
  const P = new Set(uids || []), key = X.key || ymd(new Date()), { from, to } = period;
  const H = hiddenSet(X.projects, X.tasks), users = X.users || [];
  const inP = (ids) => (ids || []).some((u) => P.has(u));
  const tasks = (X.tasks || []).filter((t) => t && !t.deleted && !t.isFixed && t.status !== "dropped" && !H.task(t));
  const doneIn = tasks.filter((t) => { const d = doneDay(t); return d && d >= from && d <= to && inP(ownersOf(t)); });
  const byProj = new Map(); doneIn.forEach((t) => { const k = t.projectId || ""; if (!byProj.has(k)) byProj.set(k, []); byProj.get(k).push(t); });
  const openMine = new Set(tasks.filter((t) => !isDone(t) && t.projectId && inP(ownersOf(t))).map((t) => t.projectId));
  const pdone = (p) => { const d = projDoneDay(p); return d && d >= from && d <= to; };
  const projs = (X.projects || []).filter((p) => p && !p.deleted && !H.proj(p) && (projOpen(p) || pdone(p) || byProj.has(p.id))
    && (byProj.has(p.id) || ((inP([p.assigneeId, ...(p.collaboratorIds || [])]) || openMine.has(p.id)) && (projOpen(p) || pdone(p)))));
  // KPI 줄 (브랜드마다 kpiBoard · 숨긴 것 빠짐)
  const kpis = [];
  (X.brands || []).filter((b) => b && b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0)).forEach((b) => {
    const B = X.K ? kpiBoard(X.K, { brands: X.brands, projects: X.projects, ak: X.ak, gh: X.gh, lagV2: X.lagV2, users, key }, b.id) : null;
    (B ? B.goals : []).forEach((G) => G.mks.forEach((M) => {
      kpis.push({ id: M.mk.id, kind: "mk", title: M.mk.title, pct: M.pct, unit: M.mk.unit, brand: b.name });
      M.subs.forEach((S) => kpis.push({ id: S.sk.id, kind: "sk", mk: M.mk.id, title: S.sk.title, pct: S.pct, src: S.src && S.src.t, brand: b.name }));
    }));
  });
  const kById = new Map(kpis.map((k) => [k.id, k]));
  const kOfP = (p) => (p.subKPIId && kById.has(p.subKPIId) ? p.subKPIId : p.mainKPIId && kById.has(p.mainKPIId) ? p.mainKPIId : "");
  const kids = new Map(); const push = (k, n) => { if (!kids.has(k)) kids.set(k, []); kids.get(k).push(n); };
  const tNode = (t) => ({ id: "t:" + t.id, kind: "task", tid: t.id, title: t.title, sub: `✓ ${md(doneDay(t))} · ${ownersOf(t).map((u) => nameOf(users, u)).filter(Boolean).join("·")}`, st: "done", kids: [] });
  projs.forEach((p) => {
    const dn = (byProj.get(p.id) || []).sort((a, b) => doneDay(a).localeCompare(doneDay(b)));
    const late = tasks.some((t) => t.projectId === p.id && !isDone(t) && t.status !== "hold" && dueOf(t) && dueOf(t) < key && inP(ownersOf(t)));
    const st = pdone(p) || p.status === "completed" ? "done" : late ? "late" : p.status === "hold" || p.status === "paused" ? "hold" : "doing";
    push(kOfP(p) || "~none", { id: "p:" + p.id, kind: "proj", pid: p.id, title: p.title, sub: [pdone(p) ? "완료" : `진행 ${projPct(p)}%`, dn.length ? `끝낸 일 ${dn.length}` : "", late ? "지난 일 있음" : ""].filter(Boolean).join(" · "), st, n: dn.length, kids: dn.map(tNode) });
  });
  // 반복(행동지표) — 내(우리) 담당 · 연결된 KPI 아래
  ((X.ak && X.ak.items) || []).filter((it) => it && it.active !== false && !it.deleted && !it.paused && inP(akWho(users, it))).forEach((it) => {
    const l = akLink(it), k = l.sk && kById.has(l.sk) ? l.sk : l.mk && kById.has(l.mk) ? l.mk : ""; if (!k) return;
    push(k, { id: "a:" + it.id, kind: "ak", akId: it.id, title: "반복 · " + String(it.name || "").replace(/^\([^)]*\)\s*/, ""), sub: it.cyc === "W" ? "주간" : it.cyc === "M" ? "월간" : "분기", st: "", kids: [] });
  });
  const kN = (k) => (kids.get(k) || []).sort((a, b) => (a.kind === "ak") - (b.kind === "ak") || b.n - a.n);
  const top = kpis.filter((k) => kids.has(k.id)).map((k) => ({ id: "k:" + k.id, kind: "kpi", title: k.title, sub: [k.pct != null ? `${k.pct}%` : "", k.src || "", k.brand].filter(Boolean).join(" · "),
    st: k.pct != null && k.pct >= 100 ? "done" : "", pct: k.pct, kids: kN(k.id) }));
  if (kids.has("~none")) top.push({ id: "k:~none", kind: "kpi", title: "KPI 연결 없음", sub: "프로젝트에 KPI를 이으면 위로 올라가요", st: "wait", kids: kN("~none") });
  const loose = byProj.get("") || [];
  if (loose.length) top.push({ id: "k:~loose", kind: "kpi", title: "프로젝트 없는 일", sub: `끝낸 일 ${loose.length}`, st: "wait", kids: loose.sort((a, b) => doneDay(a).localeCompare(doneDay(b))).map(tNode) });
  const nK = top.filter((x) => !String(x.id).startsWith("k:~")).length;
  return { id: "root", kind: "root", title: period.label, sub: `${rootName} · KPI ${nK}`, kids: top,
    count: { kpi: nK, proj: projs.length, done: doneIn.length, ak: top.reduce((a, k) => a + k.kids.filter((x) => x.kind === "ak").length, 0) } };
}
