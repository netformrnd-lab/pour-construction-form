// 업무OS v2 — 앞사람 → 내 차례 (저장하지 않고 계산만)
//
// 앞 일 찾는 순서: ① 업무의 deps(v1 과 같은 칸 · [] 는 '앞 일 없음') ② 신제품 항목이면 순서표(launch.js LAUNCH_AFTER, 건너뛴 항목만 거슬러 올라감)
//                 ③ 하위 업무가 있는 상위 업무는 하위 업무(담당이 다를 때만) ④ 고정업무는 앞뒤 없음
// '끝난 앞 일' = 끝남(done) 또는 확인 대기(review: 담당은 끝냈고 맡긴 사람 확인만 남음) 또는 불러온 범위에 없음
// 기다림은 표시만 하고 막지 않는다(실제 일보다 상태가 늦게 바뀌는 경우가 많음). 내 일이 이미 진행 중이면 기다림 표시를 하지 않는다
import { ymd, ddays, dueOf, isDone, isMine, ownersOf, nameOf, md, activeUsers, addDays, isOffDay } from "./model.js";
import { launchPreds, isTempOwner, preLaunchItem } from "./launch.js";

export const finishedOf = (p) => !!p && (p.status === "done" || p.status === "review");
// 끝낸 시각: v2 에서 누른 시각(finishedAt) → 상태 기록의 마지막 끝냄 → 모름
export function finishedAt(p) {
  if (!p) return "";
  if (p.finishedAt) return p.finishedAt;
  const log = (p.statusLog || []).filter((s) => s && (s.status === "done" || s.status === "review")).map((s) => s.at || "").sort();
  return log.length ? log[log.length - 1] : "";
}

// 한 번만 만드는 색인: 업무 찾기 · 앞 일 · 다음 일 · 임시 담당
export function turnIndex(D) {
  const tasks = D.tasks || [], byId = new Map(tasks.map((t) => [t.id, t]));
  const kids = new Map(); tasks.forEach((t) => { if (t.parentId) { const a = kids.get(t.parentId) || []; a.push(t); kids.set(t.parentId, a); } });
  const preds = new Map(), nexts = new Map(), temp = new Set();
  const skipOf = new Map((D.projects || []).filter((p) => p && Array.isArray(p.skipItems)).map((p) => [p.id, new Set(p.skipItems)]));   // v1 에서 건너뛴 신제품 항목
  tasks.forEach((t) => {
    if (t.isFixed) return;
    if (isTempOwner(t, D)) temp.add(t.id);
    let ps = [];
    if (Array.isArray(t.deps)) ps = t.deps.map((id) => byId.get(id)).filter(Boolean);
    else if (t.launchItem) ps = launchPreds(t, byId, skipOf.get(t.projectId));
    else if (kids.has(t.id)) { const o = ownersOf(t); ps = kids.get(t.id).filter((k) => !ownersOf(k).some((u) => o.includes(u))); }
    if (ps.length) { preds.set(t.id, ps); ps.forEach((p) => { const a = nexts.get(p.id) || []; a.push(t); nexts.set(p.id, a); }); }
  });
  return { byId, preds, nexts, temp };
}
export const predsOf = (t, idx) => (t && idx.preds.get(t.id)) || [];
export const nextsOf = (t, idx) => (t && idx.nexts.get(t.id)) || [];
const latePred = (p, key) => !finishedOf(p) && (!!p.blocked || p.status === "hold" || (dueOf(p) && dueOf(p) < key));
// 남은 앞 일 중 끝 예정이 가장 늦은 것 (그게 끝나야 내 차례) · 기한이 다 없으면 첫 번째
const latestDue = (open) => open.reduce((b, p) => (dueOf(p) && (!dueOf(b) || dueOf(p) > dueOf(b)) ? p : b), open[0]);

// 업무 하나의 차례 상태: none(앞 일 없음·진행 중) · ready(앞 일 다 끝남) · wait(앞 일 하는 중) · late(앞 일 지남·막힘·보류)
// show = 화면에 보일 앞 일 하나: late → 늦은(지남·막힘·보류) 앞 일 · wait → 끝 예정이 가장 늦은 앞 일 · ready → 마지막에 끝난 앞 일
export function turnOf(t, idx, key) {
  const ps = predsOf(t, idx);
  if (!ps.length || isDone(t) || t.isFixed) return { state: "none", preds: ps, open: [] };
  const open = ps.filter((p) => !finishedOf(p));
  if (!open.length) {
    let last = null, at = "";
    ps.forEach((p) => { const f = finishedAt(p); if (f && f > at) { at = f; last = p; } });
    last = last || ps[ps.length - 1];
    return { state: t.status === "todo" ? "ready" : "none", preds: ps, open, readyAt: at, last, show: last };
  }
  if (t.status !== "todo") { const lag = open.find((p) => p.status === "todo"); return { state: "none", preds: ps, open, orderLag: !!lag, show: lag || open[0] }; }
  const lp = open.find((p) => latePred(p, key));
  return lp ? { state: "late", preds: ps, open, show: lp } : { state: "wait", preds: ps, open, show: latestDue(open) };
}
// 앞 일이 다시 열린 적이 있나: 수정 요청·다시 열기(before 전에) 또는 담당이 끝냄을 2번 이상 누름
// (확인 요청 → 확인 완료는 끝냄 1번: 확인 완료 기록(approved)은 세지 않음)
const reopened = (p, before) => (p.statusLog || []).some((s) => s && (s.feedback || s.reopen) && (!before || String(s.at || "") < before))
  || (p.statusLog || []).filter((s) => s && (s.status === "done" || s.status === "review") && !s.approved).length > 1;

// 앞 일 한 줄 설명: "김민지 · 설명서 기획·카피 (할 일)"
export function predLine(p, users, key) {
  if (!p) return "";
  const who = nameOf(users, ownersOf(p)[0]) || "담당 없음";
  const st = p.status === "review" ? "확인 중" : isDone(p) ? "끝남" : p.blocked ? "막힘" : p.status === "hold" ? "보류" : p.status === "inprogress" ? "하는 중" : "할 일";
  const n = ddays(dueOf(p), key);
  return `${who} · ${p.title} (${st}${!finishedOf(p) && n != null && n < 0 ? ` · ${-n}일 지남` : !finishedOf(p) && dueOf(p) ? ` · ${md(dueOf(p))} 예정` : ""})`;
}

// 한 사람 기준 차례 모음 — 오늘·달력·업무 보기에서 같이 씀
// since: 이 기능을 처음 연 시각(그 전에 끝난 앞 일로는 '이제 내 차례' 알림을 띄우지 않음 → 처음 켤 때·다시 가져온 뒤 알림 폭주 방지)
// seenKey = `tn:<내 일>:<마지막 앞 일>:<끝난 시각>` — 앞 일이 수정 뒤 다시 끝나면 새 키라 다시 알림
// (예전 키 `tn:<내 일>:<앞 일>` 은 앞 일이 다시 열린 적이 없을 때만 본 것으로 침)
// shownNotes = '이제 내 차례' 카드에 '앞 일 마지막 말'로 보이는 댓글 id (오늘 화면 댓글 줄에서 빼고, 카드에서 시작·열면 nt:<id> 를 본 것으로)
// predIds = 내 열린 일의 앞 일 id (그 앞 일에 남긴 '다음 사람에게 한마디'는 프로젝트 멤버가 아니어도 나에게)
// turnAgain = 이미 하는 중인 내 일의 앞 일이 수정 요청 뒤 다시 끝남 (업무 보기 띠의 약속)
export function turnsOf(D, idx, uid, now = new Date(), seen = {}, since = "") {
  const key = ymd(now), d14 = new Date(now - 14 * 864e5).toISOString();
  const users = D.users || [], projects = D.projects || [];
  const byTask = new Map(), fresh = new Set(), ready = [], soonRaw = [], inbox = [], shownNotes = new Set(), predIds = new Set();
  const recent = (at) => !!at && (!since || at >= since) && at >= d14;
  (D.tasks || []).forEach((t) => {
    if (t.isFixed || isDone(t) || !isMine(t, uid) || idx.temp.has(t.id)) return;
    predsOf(t, idx).forEach((p) => predIds.add(p.id));
    const T = turnOf(t, idx, key);
    if (T.state === "none" && t.status === "inprogress" && !T.open.length && T.last && recent(T.readyAt)) {
      const lo = ownersOf(T.last)[0], k = `tn:${t.id}:${T.last.id}:${T.readyAt}`;
      const started = (t.statusLog || []).filter((s) => s && s.status === "inprogress").map((s) => String(s.at || "")).sort().pop() || "";
      if (lo && lo !== uid && T.readyAt > started && reopened(T.last, T.readyAt) && !seen[k])
        inbox.push({ kind: "turnAgain", tag: "앞 일 다시 끝남", id: k, taskId: t.id, title: t.title, who: lo, at: T.readyAt, text: `"${T.last.title}" 수정이 끝났어요 · 이어서 하면 돼요`, act: "open" });
    }
    if (T.state === "none" && !T.orderLag) return;
    byTask.set(t.id, T);
    if (T.state === "ready") {
      ready.push(t);
      T.seenKey = `tn:${t.id}:${T.last.id}:${T.readyAt || ""}`;
      const lastOwner = ownersOf(T.last)[0] || "";
      const saw = seen[T.seenKey] || (seen[`tn:${t.id}:${T.last.id}`] && !reopened(T.last));
      if (recent(T.readyAt) && lastOwner && lastOwner !== uid && !saw) {
        fresh.add(t.id); const w = lastWord(T.last, D.notes); if (w) shownNotes.add(w.id);
      }
    }
    if (T.state === "wait" && T.open.length === 1 && ownersOf(T.open[0])[0] !== uid) {   // 내가 이어서 하는 단계는 '곧 내 차례' 아님
      const p = T.open[0], pt = turnOf(p, idx, key), pn = ddays(dueOf(p), key);
      if (p.status === "inprogress" || ((pt.state === "ready" || pt.state === "none") && pn != null && pn <= 3)) soonRaw.push({ t, p });
    }
    if (T.state === "late" && (ddays(dueOf(t), key) ?? 99) <= 7) {
      const p = T.show || T.open[0];
      inbox.push({ kind: "turnLate", tag: p.blocked ? "앞 일 막힘" : "앞 일 늦음", red: true, id: `tl:${t.id}:${p.id}`, taskId: p.id, title: t.title, who: ownersOf(p)[0], at: p.updatedAt || p.dueDate,
        text: `${predLine(p, users, key)} · 내 기한 ${md(dueOf(t)) || "미정"}`, keep: true, act: "ask" });
    }
    const dt = dueOf(t);
    const bad = dt && T.open.find((p) => dueOf(p) && dueOf(p) > dt && !(p.dueAuto && t.dueAuto));
    if (bad) inbox.push({ kind: "turnOrder", tag: "순서 확인", id: `to:${t.id}:${bad.id}`, taskId: t.id, title: t.title, who: ownersOf(bad)[0], at: bad.updatedAt || "",
      text: `앞 일 끝 예정 ${md(dueOf(bad))} · 내 기한 ${md(dt)}`, keep: true, act: "req" });
  });
  // 곧 내 차례: 앞사람·앞 항목·내 항목으로 묶음 ("양채림 · 제품 촬영 6건 하는 중 → 내 상세페이지 디자인 6건")
  const g = new Map();
  soonRaw.forEach(({ t, p }) => { const k = `${ownersOf(p)[0]}|${p.launchItem || p.id}|${t.launchItem || t.id}`;
    const x = g.get(k) || { who: ownersOf(p)[0], pTitle: p.title, mTitle: t.title, preds: [], mine: [], first: "" };
    x.preds.push(p); x.mine.push(t); const dt = dueOf(t); if (dt && (!x.first || dt < x.first)) x.first = dt; g.set(k, x); });
  const soon = [...g.values()].sort((a, b) => String(a.first || "9").localeCompare(String(b.first || "9")));
  // 다음 차례 담당 없음: 내가 책임인 프로젝트에서 앞 일이 다 끝났는데 담당이 없거나 미사용인 일
  // + 임시 담당(책임자로 채운 항목)은 앞 일이 방금(14일 안) 끝났을 때만 (끝낸 사람 화면의 '책임자님께 알렸어요'와 맞춤)
  const act = new Set(activeUsers(users).map((u) => u.id));
  projects.filter((p) => p.assigneeId === uid).forEach((p) => {
    (D.tasks || []).forEach((t) => { if (t.projectId !== p.id || t.isFixed || isDone(t)) return;
      const o = ownersOf(t), tmp = idx.temp.has(t.id); if (!tmp && o.length && o.some((u) => act.has(u))) return;
      const T = turnOf(t, idx, key); if (T.state !== "ready" || (tmp && !recent(T.readyAt))) return;
      inbox.push({ kind: "nextNoOwner", tag: "담당 없음", id: `nn:${t.id}`, taskId: t.id, title: t.title, at: T.readyAt || "", text: `앞 일 "${T.last ? T.last.title : ""}"이 끝났는데 다음 담당이 없어요`, keep: true, act: "set" }); });
  });
  return { byTask, fresh, ready, soon, inbox, temp: idx.temp, shownNotes, predIds };
}

// 다가오는 내 차례 — 앞 일을 기다리는 내 일마다 한 줄 (달력 → 표식 · 고른 날 목록 · 7일 '곧 내 차례' · 오늘 화면이 같이 씀)
//  start = 내 차례가 오는 날 = 남은 앞 일 중 끝 예정이 가장 늦은 날(이미 지났으면 오늘, 앞 일에 날짜가 없으면 "")
//  slack = start 다음 날부터 내 기한까지 평일 수 (앞사람이 예정대로 끝내면 내게 남는 날) · 내 기한이 start 보다 앞이면 음수
//  level: late(앞 일 지남·막힘·보류) · risk(앞 일 예정이 내 기한보다 늦음 · 내 기한이 프로젝트 마감보다 늦음) · tight(여유 1일 이하) · ok · nodate(날짜를 몰라 잴 수 없음)
const wdays = (a, b) => { let n = 0; for (let k = addDays(a, 1), i = 0; k <= b && i < 400; k = addDays(k, 1), i++) if (!isOffDay(k)) n++; return n; };   // (a, b] 평일 수
export function upcomingTurns(D, T, key, uid = "") {
  const byId = new Map((D.tasks || []).map((t) => [t.id, t])), pById = new Map((D.projects || []).map((p) => [p.id, p])), out = [];
  (T && T.byTask ? T.byTask : new Map()).forEach((I, id) => {
    if (I.state !== "wait" && I.state !== "late") return;
    const t = byId.get(id); if (!t) return;
    // 앞 일이 모두 내 일이면(내가 이어서 하는 단계) '다른 사람을 기다리는 내 차례'가 아님 → 뺌
    const others = uid ? I.open.filter((x) => !ownersOf(x).includes(uid)) : I.open; if (!others.length) return;
    const p = I.show && others.includes(I.show) ? I.show : others.reduce((b, x) => (dueOf(x) && (!dueOf(b) || dueOf(x) > dueOf(b)) ? x : b), others[0]);
    const last = I.open.map((x) => dueOf(x)).filter(Boolean).sort().pop() || "";
    const start = last ? (last < key ? key : last) : "", myDue = dueOf(t);
    const proj = pById.get(t.projectId) || null, launch = !!proj && String(proj.id).startsWith("lb_");
    const projDue = proj ? String((launch ? proj.launchDate : proj.dueDate || proj.launchDate) || "").slice(0, 10) : "";
    const slack = start && myDue ? (myDue >= start ? wdays(start, myDue) : -wdays(myDue, start)) : null;
    let level, label;
    if (I.state === "late") { const n = ddays(dueOf(p), key); level = "late"; label = p.blocked ? "앞 일 막힘" : p.status === "hold" ? "앞 일 보류" : n != null && n < 0 ? `앞 일 ${-n}일 지남` : "앞 일 늦음"; }
    else if (!start) { level = "nodate"; label = "앞 일 날짜 없음"; }
    else if (!myDue) { level = "nodate"; label = "내 기한 없음"; }
    else if (myDue < start) { level = "risk"; label = "늦을 수 있음"; }
    else if (projDue && myDue > projDue && (!launch || !t.launchItem || preLaunchItem(t.launchItem))) { level = "risk"; label = `${launch ? "출시" : "마감"}보다 늦음`; }   // 신제품은 출시 전에 끝낼 항목만
    else if (slack <= 1) { level = "tight"; label = slack <= 0 ? "당일 이어받기" : "여유 1일"; }
    else { level = "ok"; label = `여유 ${slack}일`; }
    out.push({ t, p, I, proj, launch, projDue, start, myDue, slack, level, label, who: ownersOf(p)[0] || "", pDue: dueOf(p) });
  });
  const ord = { late: 0, risk: 1, tight: 2, nodate: 3, ok: 4 };
  return out.sort((a, b) => String(a.start || "9").localeCompare(String(b.start || "9")) || ord[a.level] - ord[b.level] || String(a.myDue || "9").localeCompare(String(b.myDue || "9")));
}
// 다가오는 내 차례 한 줄 글 (같은 말을 달력·오늘·목록에서)
//  title = 내 일 · proj = 어느 프로젝트 · 출시/마감(D-n) · pred = 앞사람 무엇·상태·끝 예정 → 내 기한
export function upLine(u, users, key) {
  const who = nameOf(users, u.who) || "담당 없음";
  const st = u.p.blocked ? "막힘" : u.p.status === "hold" ? "보류" : u.p.status === "inprogress" ? "하는 중" : "할 일";
  const pd = u.projDue ? ddays(u.projDue, key) : null;
  return {
    title: u.t.title,
    proj: [u.proj ? u.proj.title : "프로젝트 없음", u.projDue ? `${u.launch ? "출시" : "마감"} ${md(u.projDue)} (${pd >= 0 ? "D-" + pd : -pd + "일 지남"})` : ""].filter(Boolean).join(" · "),
    pred: `앞: ${who} "${u.p.title}" ${st}${u.pDue ? ` · ${md(u.pDue)} 끝 예정` : " · 끝 예정일 없음"} → 내 기한 ${u.myDue ? md(u.myDue) : "없음"}`,
  };
}

// 업무를 끝낼 때 "다음은 ○○님 차례예요" 문구
// 이번에 끝내면 앞 일이 다 끝나는 다음 일만 (다른 앞 일이 남은 일은 아직 차례 아님). 임시 담당(책임자로 채운 항목)은 담당 없음으로
export function nextTurnText(t, idx, users) {
  const ns = nextsOf(t, idx).filter((n) => !isDone(n) && !n.isFixed && predsOf(n, idx).every((p) => p.id === t.id || finishedOf(p)));
  if (!ns.length) return { text: "", noOwner: false };
  const act = new Set(activeUsers(users).map((u) => u.id)), temp = idx.temp || new Set();
  const owned = ns.filter((n) => !temp.has(n.id) && ownersOf(n).some((u) => act.has(u)));
  const others = [...new Set(owned.map((n) => ownersOf(n)[0]).filter((u) => !ownersOf(t).includes(u)))];
  if (!owned.length) return { text: "다음 일 담당이 없어요", noOwner: true };
  if (!others.length) return { text: "", noOwner: ns.length > owned.length };
  const first = owned.find((n) => ownersOf(n)[0] === others[0]);
  return { text: others.length > 1 ? `다음은 ${nameOf(users, others[0])}님 외 ${others.length - 1}명 차례예요` : `다음은 ${nameOf(users, others[0])}님 "${first.title}" 차례예요`, noOwner: ns.length > owned.length, who: others };
}

// 앞 일 마지막 말: 다음 사람에게 남긴 한마디(handoff) → 없으면 마지막 댓글
export function lastWord(p, notes) {
  const ns = (notes || []).filter((n) => n && !n.deleted && n.itemId === "task:" + p.id).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return ns.find((n) => n.handoff) || ns[0] || null;
}

// 프로젝트 '지금 → 다음': 하는 중인 일(없으면 앞 일 없이 시작할 수 있는 가장 이른 일) → 그 일의 다음 일
export function nowNext(p, D, idx, key) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed && !isDone(t));
  const byDue = (a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"));
  let cur = ts.filter((t) => t.status === "inprogress").sort(byDue);
  if (!cur.length) cur = ts.filter((t) => t.status === "todo" && ["ready", "none"].includes(turnOf(t, idx, key).state) && !predsOf(t, idx).some((x) => !finishedOf(x))).sort(byDue);
  const now = cur[0] || null;
  const others = now ? new Set(cur.map((t) => ownersOf(t)[0]).filter((u) => u && u !== ownersOf(now)[0])).size : 0;
  const next = now ? nextsOf(now, idx).filter((n) => !isDone(n)).sort(byDue)[0] || null : null;
  return { now, others, next };
}

// 동료 '지금 하는 일' 한 줄 (달력 사람 고르기) — 비교 숫자 없이
export function personNow(D, uid, key) {
  const mine = (D.tasks || []).filter((t) => !t.isFixed && !isDone(t) && isMine(t, uid));
  const byDue = (a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title;
  const doing = mine.filter((t) => t.status === "inprogress").sort(byDue)[0];
  if (doing) return `지금: ${doing.title}${pn(doing) ? " · " + pn(doing) : ""}`;
  const next = mine.filter((t) => t.status === "todo").sort(byDue)[0];
  if (next) return `다음: ${next.title}${dueOf(next) ? " · " + md(dueOf(next)) : ""}`;
  return "열린 일 없음";
}

// 관리자 '순서 꼬임' 모음 (가) 앞 일 끝 예정이 뒤 일 기한보다 늦음 (나) 앞 일이 늦어 뒤 일 기한 3일 안 (다) 앞 일 다 끝났는데 다음 담당 없음·미사용·임시 (라) 뒤 일은 하는 중인데 앞 일은 할 일
export function orderIssues(D, idx, key) {
  const act = new Set(activeUsers(D.users).map((u) => u.id)), out = { a: [], b: [], c: [], d: [] };
  (D.tasks || []).forEach((t) => {
    if (t.isFixed || isDone(t)) return;
    const T = turnOf(t, idx, key); if (!T.preds.length) return;
    const dt = dueOf(t);
    T.open.forEach((p) => { if (dt && dueOf(p) && dueOf(p) > dt && !(p.dueAuto && t.dueAuto)) out.a.push({ t, p }); });
    if (T.state === "late" && dt && (ddays(dt, key) ?? 99) <= 3) out.b.push({ t, p: T.open.find((x) => latePred(x, key)) });
    if (T.state === "ready") { const o = ownersOf(t); if (!o.length || !o.some((u) => act.has(u)) || idx.temp.has(t.id)) out.c.push({ t, p: T.last }); }
    if (T.orderLag) out.d.push({ t, p: T.open.find((x) => x.status === "todo") });
  });
  return out;
}
