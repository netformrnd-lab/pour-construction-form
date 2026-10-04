// 업무OS v2 — 화면용 계산 (달력 칸 · 사람×주 표 · 출시 줄 · 정리 묶음 · 출시일 옮기기 미리 보기). 저장은 하지 않음
import { ymd, addDays, ddays, dueOf, isDone, isMine, ownersOf, activeUsers, nameOf, monthGrid, holidayName, isOffDay, ownerIssues, fxDueOn, personHealth, riskOf, md, reqOf, dueApprover, weekStart } from "./model.js";
import { LAUNCH_PHASES, launchPct, relaunch } from "./launch.js";
import { turnOf, orderIssues, predsOf } from "./turn.js";

const isLaunchP = (p) => String((p && p.id) || "").startsWith("lb_");
const openOneOff = (t) => !t.isFixed && !isDone(t) && t.status !== "review" && t.status !== "hold";

// 달력 칸 계산
// o: { uid: 사람 id 또는 "*"(팀 전체), pid: 프로젝트 거르기, noTemp: 임시 담당 빼기, turns: turnsOf 결과(내 달력 → 표식), fxIfEmpty: 일회성 일이 없으면 고정업무 수 }
// → { [날짜]: { n, temp, lateN, red, done, fx, proj:[p], turnStart, hol, people:{uid:n}, items:[t] } }
export function calCells(D, idx, o, ym, key) {
  const grid = monthGrid(ym).flat(), from = grid[0].date, to = grid[grid.length - 1].date, d14 = addDays(key, -14);
  const cells = Object.fromEntries(grid.map((c) => [c.date, { n: 0, temp: 0, lateN: 0, red: false, done: 0, fx: 0, proj: [], turnStart: 0, hol: holidayName(c.date), people: {}, items: [] }]));
  const who = o.uid || "*", temp = (idx && idx.temp) || new Set();
  (D.tasks || []).forEach((t) => {
    if (t.isFixed) return; const d = dueOf(t); if (!d || d < from || d > to) return;
    if (who !== "*" && !isMine(t, who)) return; if (o.pid && t.projectId !== o.pid) return;
    const c = cells[d]; const isT = temp.has(t.id);
    if (isDone(t) || t.status === "review") { c.done++; return; }
    if (t.status === "hold") return;
    if (isT) { c.temp++; if (o.noTemp) return; }
    c.n++; c.items.push(t);
    const u = ownersOf(t)[0] || ""; c.people[u] = (c.people[u] || 0) + 1;
    if (d < key) { c.lateN++; if (d >= d14) c.red = true; }
    if (t.blocked) c.red = true;
  });
  // 팀 달력: 그날 한 사람 마감 8건 넘으면 빨강
  if (who === "*") Object.values(cells).forEach((c) => { if (Object.entries(c.people).some(([u, n]) => u && n > 8)) c.red = true; });
  // 프로젝트 마감·출시 ▴
  (D.projects || []).forEach((p) => {
    const d = String(p.dueDate || p.launchDate || "").slice(0, 10); if (!cells[d] || p.status === "completed" || p.status === "done") return;
    if (o.pid && p.id !== o.pid) return;
    if (who !== "*" && !o.pid && !(p.assigneeId === who || (p.collaboratorIds || []).includes(who) || (D.tasks || []).some((t) => t.projectId === p.id && !t.isFixed && isMine(t, who)))) return;
    cells[d].proj.push(p);
  });
  // → 내 차례가 시작될 날: 기다리는 내 일의 남은 앞 일 기한 중 가장 늦은 날 (이미 지난 날이면 오늘)
  // o.turns = upcomingTurns(...) 줄들 → 그날 칸에 내 일 제목·위험(늦음·늦을 수 있음)까지
  if (Array.isArray(o.turns)) o.turns.forEach((u) => { const c = u.start && cells[u.start]; if (!c) return; c.turnStart++; (c.turns = c.turns || []).push(u); if (u.level === "late" || u.level === "risk") c.turnRisk = true; });
  else if (o.turns) o.turns.byTask.forEach((T) => { const d = turnStartOf(T, key); if (d && cells[d]) cells[d].turnStart++; });
  // 고정업무만 하는 사람: 그날 고정업무 수(회색)
  if (o.fxIfEmpty && who !== "*") (D.tasks || []).forEach((t) => { if (!t.isFixed || t.paused) return; const mine = t.forAll || ownersOf(t).includes(who); if (!mine) return;
    grid.forEach((g) => { if (fxDueOn(t, g.date)) cells[g.date].fx++; }); });
  return cells;
}

// '→ 내 차례 시작' 날 (달력 표식·그날 목록이 같이 씀): 기다림·늦음일 때 남은 앞 일 기한 중 가장 늦은 날, 지난 날이면 오늘. 아니면 ""
export function turnStartOf(T, key) {
  if (!T || (T.state !== "wait" && T.state !== "late")) return "";
  const last = (T.open || []).map((p) => dueOf(p)).filter(Boolean).sort().pop() || "";
  return last && key && last < key ? key : last;
}

// 사람 × 앞으로 4주 (관리자): 그 주 일회성 열린 마감 수 + 그중 임시 담당 수
export function teamWeeks(D, idx, now, noTemp = false, off = 0, base = "") {   // off = 몇 주 앞(−)·뒤(+)부터 4칸 · base = 첫 칸 시작(없으면 오늘 · 관리자 사람 표는 이번 주 월요일)
  const key = ymd(now), temp = (idx && idx.temp) || new Set();
  return activeUsers(D.users).map((u) => {
    const open = (D.tasks || []).filter((t) => openOneOff(t) && isMine(t, u.id));
    const k0 = base || key; const weeks = [0, 1, 2, 3].map((i) => { const a = addDays(k0, (off + i) * 7), b = addDays(k0, (off + i) * 7 + 6);
      const ts = open.filter((t) => { const d = dueOf(t); return d && d >= a && d <= b; });
      const tp = ts.filter((t) => temp.has(t.id)).length; return { n: noTemp ? ts.length - tp : ts.length, temp: tp, from: a, to: b, tasks: noTemp ? ts.filter((t) => !temp.has(t.id)) : ts }; });
    const late = open.filter((t) => { const d = dueOf(t); return d && d < key && !(noTemp && temp.has(t.id)); });
    const h = personHealth(D, u.id, now);
    return { u, weeks, late: late.length, lateTasks: late, noDue: open.filter((t) => !dueOf(t)).length, doing: open.filter((t) => t.status === "inprogress").length, level: h.level, ot: h.ot, cap: Number(u.weekCap) || 15 };
  });
}

// 출시 줄 (관리자): 앞으로 n주 안 출시 신제품을 출시일로 묶고, 제품마다 7단계 상태
export function lineup(D, idx, key, weeks = 8) {
  const end = addDays(key, weeks * 7), groups = new Map();
  (D.projects || []).filter((p) => isLaunchP(p) && p.status !== "completed" && p.launchDate && p.launchDate >= addDays(key, -7) && p.launchDate <= end).forEach((p) => {
    const ts = (D.tasks || []).filter((t) => t.projectId === p.id && t.launchItem);
    const phases = phaseStates(ts, key);
    const left = ts.filter((t) => !isDone(t) && t.status !== "review");
    const lateN = left.filter((t) => { const d = dueOf(t); return d && d < key; }).length;
    const g = groups.get(p.launchDate) || { date: p.launchDate, items: [], left: 0, late: 0 };
    g.items.push({ p, phases, left: left.length, late: lateN, pct: launchPct(p, D) }); g.left += left.length; g.late += lateN; groups.set(p.launchDate, g);
  });
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// 신제품 7단계 상태: done(남은 항목 없음) · late(지난·막힌 항목) · cur(처음 남은 단계) · todo
export function phaseStates(ts, key) {
  let cur = false;
  return LAUNCH_PHASES.map((ph) => { const a = ts.filter((t) => t.phase === ph.k), left = a.filter((t) => !isDone(t) && t.status !== "review");
    const late = left.some((t) => { const r = riskOf(t, key); return r && (r.k === "late" || r.k === "blocked"); });
    const state = !a.length || !left.length ? "done" : late ? "late" : !cur ? "cur" : "todo"; if (state === "cur" || state === "late") cur = true;
    return { k: ph.k, name: ph.name, left: left.length, total: a.length, state }; });
}

// 정리 묶음 (관리자 정리 탭) — 지우지 않고 한 번에 치우기
export function tidyQueues(D, idx, now) {
  const key = ymd(now), ym = key.slice(0, 7), temp = (idx && idx.temp) || new Set();
  const open = (D.tasks || []).filter((t) => !t.isFixed && !isDone(t));
  const oi = idx ? orderIssues(D, idx, key) : { a: [], b: [], c: [], d: [] };
  const q = [
    { k: "temp", label: "임시 담당 (책임자로 채운 신제품 항목)", by: "project", items: open.filter((t) => temp.has(t.id)) },
    { k: "noDue", label: "기한 없음", by: "project", items: open.filter((t) => !dueOf(t) && t.status !== "hold" && t.tidySkip !== ym) },
    { k: "old", label: "30일 넘게 지난 일", by: "person", items: open.filter((t) => { const n = ddays(dueOf(t), key); return n != null && n < -30 && t.status !== "hold"; }) },
    { k: "owner", label: "담당 없음 · 미사용 담당", by: "project", items: ownerIssues(D).map((x) => x.t).filter((t) => !t.isFixed) },
    { k: "dueReq", label: "기한 조정 요청", by: "person", items: open.filter((t) => t.dueReq) },
    { k: "blocked", label: "막힘", by: "person", items: open.filter((t) => t.blocked) },
    { k: "order", label: "순서 꼬임 (앞 일이 뒤 일보다 늦게 끝날 예정 · 뒤 일은 하는 중인데 앞 일은 할 일)", by: "project", items: [...oi.a, ...oi.d].map((x) => x.t) },
    { k: "nextNo", label: "다음 차례 담당 없음", by: "project", items: oi.c.map((x) => x.t).filter((t) => !temp.has(t.id)) },
    { k: "review", label: "확인 대기 3일 넘음", by: "person", items: open.filter((t) => t.status === "review" && t.reviewAt && ddays(String(t.reviewAt).slice(0, 10), key) < -3) },
    // 보류한 업무 (프로젝트째 보류한 것은 그 프로젝트에서) · 다시 볼 날이 지난 것 → 날짜 없는 것 → 다시 볼 날 순
    { k: "hold", label: "보류 (다시 볼 날 지난 것 먼저)", by: "person", items: open.filter((t) => t.status === "hold" && !t.holdBy).sort((a, b) => String(a.holdUntil || "9").localeCompare(String(b.holdUntil || "9"))) },
  ];
  q.forEach((x) => { const s = new Set(); x.items = x.items.filter((t) => !s.has(t.id) && s.add(t.id)); });
  return q.filter((x) => x.items.length).sort((a, b) => b.items.length - a.items.length);
}
// 묶음으로 나누기 (사람별 · 제품별)
export function groupItems(items, by, D) {
  const m = new Map();
  items.forEach((t) => { const k = by === "person" ? ownersOf(t)[0] || "" : t.projectId || "";
    const label = by === "person" ? nameOf(D.users, k) || "담당 없음" : ((D.projects || []).find((p) => p.id === k) || {}).title || "프로젝트 없음";
    const g = m.get(k) || { key: k, label, items: [] }; g.items.push(t); m.set(k, g); });
  return [...m.values()].sort((a, b) => b.items.length - a.items.length);
}

// 출시일 옮기기 미리 보기 (쓰지 않음): 옮겨질 자동 기한 수 · 사람이 정한 기한 수 · 그날 마감 변화
export function previewLaunchMove(p, D, newDate, key) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && t.launchItem);
  const changes = relaunch(ts, newDate, key);
  const keep = ts.filter((t) => !isDone(t) && t.launchItem && !t.dueAuto).length;
  const sameBefore = (D.projects || []).filter((x) => isLaunchP(x) && x.launchDate === p.launchDate && x.status !== "completed").length;
  const sameAfter = (D.projects || []).filter((x) => isLaunchP(x) && x.id !== p.id && x.launchDate === newDate && x.status !== "completed").length + 1;
  return { changes, keep, sameBefore, sameAfter };
}
// 하루 마감 수 변화 (미리 보기용): changes 적용 전후로 날짜별 마감 수
export function dayLoadDelta(D, changes) {
  const before = {}, after = {};
  (D.tasks || []).filter(openOneOff).forEach((t) => { const d = dueOf(t); if (d) before[d] = (before[d] || 0) + 1; });
  Object.assign(after, before);
  changes.forEach((x) => { if (!openOneOff(x.task)) return;   // 보류·확인 대기·끝난 항목은 표에 안 세므로 미리 보기에서도 뺌
    const a = dueOf(x.task); if (a) after[a] = (after[a] || 1) - 1; after[x.due] = (after[x.due] || 0) + 1; });
  const peak = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0] || ["", 0];
  return { before, after, peakBefore: peak(before), peakAfter: peak(after) };
}
