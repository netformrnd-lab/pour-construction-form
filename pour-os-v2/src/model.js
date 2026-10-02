// 업무OS v2 — 계산 로직만 (화면은 App.jsx, 저장은 fb.js)
//
// 저장 구조 (v1 과 완전히 분리 · 보안규칙 pour-os/{doc=**} 안이라 규칙 변경 없음)
//  · pour-os/v2                     복사 정보 {seededAt, seededBy, counts}
//  · pour-os/v2/<키>/{id}           1건 = 문서 1개 (업무·프로젝트·사람·댓글·기록 …)
//      → 서로 다른 업무를 동시에 고쳐도 덮어쓰지 않음. 같은 업무도 바뀐 칸만 저장(updateDoc)
//  · pour-os/v2/checks/{업무~사람~날짜}  고정업무 체크 기록 (누가 몇 시에 했나)
//  · v1 문서(pour-os/state-*, ak-notes)는 읽기만 한다. 절대 쓰지 않는다.

// ── 날짜 (기기 날짜 기준 — v1 의 '아침 9시 전 체크가 전날로' 문제 없음) ──
export const pad2 = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const addDays = (key, n) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const FX_WD = ["월", "화", "수", "목", "금", "토", "일"];
export const weekStart = (key) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const ddays = (due, today) => (due ? Math.round((new Date(String(due).slice(0, 10) + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null);
export const ddayLabel = (n) => (n == null ? "" : n < 0 ? `${-n}일 지남` : n === 0 ? "오늘" : `D-${n}`);
export const md = (key) => { if (!key) return ""; const s = String(key).slice(0, 10).split("-"); return s.length < 3 ? String(key) : `${+s[1]}/${+s[2]}`; };
export const hm = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export function ago(iso, now = new Date()) {
  if (!iso) return ""; const t = new Date(iso); if (isNaN(t)) return "";
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "방금"; if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}일 전`;
  return md(ymd(t));
}
export const dayTitle = (now) => `${now.getMonth() + 1}월 ${now.getDate()}일 (${WD[now.getDay()]})`;

// ── 사람 ──
export const DEFAULT_MASTER_NAMES = ["김송희", "이란", "김소연", "허지은"];
const norm = (s) => String(s || "").replace(/\s/g, "");
export const isMaster = (u) => !!u && (u.master === true || (u.master === undefined && (u.role === "lead" || DEFAULT_MASTER_NAMES.includes(norm(u.name)))));
export const activeUsers = (users) => (users || []).filter((u) => u && u.active !== false);
export const nameOf = (users, id) => ((users || []).find((u) => u.id === id) || {}).name || "";

// ── 업무 ──
export const STATUS_L = { todo: "할 일", inprogress: "진행 중", hold: "보류", done: "끝남" };
export const isDone = (t) => t && t.status === "done";
export const isOneOff = (t) => t && !t.isFixed;
export const ownersOf = (t) => (Array.isArray(t.assigneeIds) && t.assigneeIds.length ? t.assigneeIds : t.assigneeId ? [t.assigneeId] : []);
export const isMine = (t, uid) => !!t && (t.assigneeId === uid || ownersOf(t).includes(uid));
export const dueOf = (t) => String(t.dueDate || t.workDate || "").slice(0, 10);

// ── 고정업무 (v1 과 같은 칸을 그대로 읽고 씀: doneDates·doneAtBy·subDone 는 사람별 칸) ──
export const fxIds = (t) => ownersOf(t);
export const fxWeekDays = (t) => { const a = Array.isArray(t.weekDays) && t.weekDays.length ? t.weekDays : [t.weekDay || "월"]; return FX_WD.filter((d) => a.includes(d)); };
export const fxIsMine = (t, uid) => (t.forAll ? true : fxIds(t).includes(uid));
export const fxPeople = (users, t) => (t.forAll ? activeUsers(users).map((u) => u.id) : fxIds(t).filter((id) => { const u = (users || []).find((x) => x.id === id); return !u || u.active !== false; }));
const lastDay = (key) => { const d = new Date(key.slice(0, 7) + "-01T00:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.getDate(); };
export const fxDueOn = (t, key) => { const rt = t.recurType || "daily"; const d = new Date(key + "T00:00:00");
  if (rt === "weekly") return fxWeekDays(t).includes(WD[d.getDay()]);
  if (rt === "monthly") return Math.min(Number(t.monthDay || 1), lastDay(key)) === d.getDate();   // 31일 → 그 달 말일
  return true; };
export const fxDoneOn = (t, uid) => (t.doneDates && Object.prototype.hasOwnProperty.call(t.doneDates, uid) ? t.doneDates[uid] : t.assigneeId === uid ? t.doneDate : null);
export const fxHit = (t, d, key) => { if (!d) return false; const rt = t.recurType || "daily";
  if (rt === "weekly") { const days = fxWeekDays(t); if (days.length <= 1) return d >= weekStart(key) && d <= key;
    for (let i = 0; i < 7; i++) { const k = addDays(key, -i); if (days.includes(WD[new Date(k + "T00:00:00").getDay()])) return d >= k && d <= key; } return false; }
  if (rt === "monthly") return String(d).slice(0, 7) === key.slice(0, 7);
  return d === key; };
export const fxMeDone = (t, uid, key) => fxHit(t, fxDoneOn(t, uid), key);
export const fxCount = (users, t, key) => { const ids = fxPeople(users, t); return [ids.filter((id) => fxMeDone(t, id, key)).length, ids.length]; };
export const fxTime = (t, uid) => (uid && t.timeBy && t.timeBy[uid]) || t.fixedTime || "";
export const fxMin = (t, uid) => { const m = /^(\d{1,2}):(\d{2})/.exec(fxTime(t, uid)); return m ? +m[1] * 60 + +m[2] : 9999; };
export const fxLabel = (t, uid) => (uid && t.labelBy && t.labelBy[uid]) || t.title || "";
export const fxSubs = (t, uid) => ((t.subsBy && (t.subsBy[uid] && t.subsBy[uid].length ? t.subsBy[uid] : t.subsBy["*"])) || []).filter((x) => x && x.title);
export const fxRecurL = (t) => { const rt = t.recurType || "daily"; if (rt === "weekly") { const a = fxWeekDays(t); return "매주 " + (a.length === 5 && !a.includes("토") && !a.includes("일") ? "평일" : a.join("·")); } if (rt === "monthly") return `매월 ${t.monthDay || 1}일`; return "매일"; };
export const fxDoneWord = (t) => ({ weekly: "이번 주 완료", monthly: "이번 달 완료" }[t.recurType] || "오늘 완료");
// 체크/해제 → 바뀐 칸만 (점 경로) — 다른 사람 체크를 덮어쓰지 않음
export function fxCheckPatch(t, uid, on, key, at, name) {
  const p = { [`doneDates.${uid}`]: on ? key : null, [`doneAtBy.${uid}`]: on ? at : null };
  if (on) { p.doneAt = at; p.doneByName = name || ""; }
  fxSubs(t, uid).forEach((x) => { p[`subDone.${uid}.${x.id}`] = on ? key : null; });
  return p;
}

// ── 오늘 화면 ──
// seen: {id:true} 이 기기에서 이미 본 것
export function todayView(D, uid, now = new Date(), seen = {}) {
  const key = ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const tasks = D.tasks || [], users = D.users || [];
  // ② 오늘 고정업무 — 오늘 해당분만, 시간순
  const fx = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && fxDueOn(t, key))
    .map((t) => ({ t, min: fxMin(t, uid), me: fxMeDone(t, uid, key) }))
    .sort((a, b) => a.min - b.min || fxLabel(a.t, uid).localeCompare(fxLabel(b.t, uid)));
  const fixed = { left: fx.filter((x) => !x.me).map((x) => ({ ...x, late: x.min < 9999 && x.min < nowMin })), done: fx.filter((x) => x.me), total: fx.length };
  // ③ 할 일 — 지남 → 진행 중 → 오늘 → 3일 이내
  const open = tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const rank = (t) => { const n = ddays(dueOf(t), key); if (t.status === "hold") return 9;
    if (n != null && n < 0) return 0; if (t.status === "inprogress") return 1; if (n === 0) return 2; if (n != null && n <= 3) return 3; return n == null ? 8 : 4; };
  const todo = open.map((t) => ({ t, r: rank(t), n: ddays(dueOf(t), key) }))
    .sort((a, b) => a.r - b.r || (a.n ?? 999) - (b.n ?? 999) || String(a.t.title).localeCompare(String(b.t.title)));
  const focus = todo.filter((x) => x.r <= 3);
  // ① 확인할 것 — 나에게 맡겨진 새 일 + 내 일·내 프로젝트에 남이 쓴 새 댓글
  const myProj = new Set((D.projects || []).filter((p) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid)).map((p) => p.id));
  const since = new Date(now - 7 * 86400000).toISOString();
  const inbox = [];
  open.forEach((t) => { if (t.requestedBy && t.requestedBy !== uid && (t.requestedAt || "") >= since && !seen["as:" + t.id])
    inbox.push({ kind: "assigned", tag: "맡김", id: "as:" + t.id, taskId: t.id, title: t.title, who: t.requestedBy, at: t.requestedAt }); });
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  (D.notes || []).forEach((n) => {
    if (!n || n.deleted || n.by === uid || (n.at || "") < since || seen["nt:" + n.id]) return;
    const [kind, ...rest] = String(n.itemId || "").split(":"); const ref = rest.join(":");
    let hit = null;
    if (kind === "task") { const t = taskById[ref]; if (t && (isMine(t, uid) || t.requestedBy === uid || myProj.has(t.projectId))) hit = { taskId: ref, title: t.title }; }
    else if (kind === "proj" && myProj.has(ref)) { const p = (D.projects || []).find((x) => x.id === ref); hit = { projectId: ref, title: p ? p.title : "프로젝트" }; }
    if (hit) inbox.push({ kind: "note", tag: "댓글", id: "nt:" + n.id, ...hit, who: n.by, whoName: n.byName, at: n.at, text: n.text });
  });
  inbox.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const userName = (id) => nameOf(users, id);
  return { key, fixed, todo, focus, inbox, userName, left: fixed.left.length + focus.length, doneToday: fixed.done.length + tasks.filter((t) => isOneOff(t) && isDone(t) && isMine(t, uid) && String(t.doneAt || "").slice(0, 10) === key).length };
}

// ── 프로젝트 ──
export const projOpen = (p) => p && p.status !== "completed" && p.status !== "done" && !p.archived;
export const projMine = (p, uid, tasks) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid) || (tasks || []).some((t) => t.projectId === p.id && !t.isFixed && isMine(t, uid));
export function projStat(p, tasks, key) {
  const mine = (tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const open = mine.filter((t) => !isDone(t));
  const next = open.filter((t) => t.status !== "hold").sort((a, b) => (a.status === "inprogress" ? -1 : 0) - (b.status === "inprogress" ? -1 : 0) || String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9")))[0] || null;
  const n = ddays(p.dueDate, key);
  const pct = Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
  return { open: open.length, next, n, pct, late: n != null && n < 0 };
}
// 묶음: 마감 지남 · 이번 달 · 그 뒤 · 마감 없음 · 보류
export function projGroups(list, key) {
  const ym = key.slice(0, 7), g = { late: [], month: [], later: [], none: [], hold: [] };
  list.forEach((p) => { if (p.status === "hold" || p.status === "paused") return g.hold.push(p);
    const d = String(p.dueDate || "").slice(0, 10); if (!d) return g.none.push(p);
    if (d < key) g.late.push(p); else if (d.slice(0, 7) === ym) g.month.push(p); else g.later.push(p); });
  const byDue = (a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")) || String(a.title).localeCompare(String(b.title));
  Object.values(g).forEach((a) => a.sort(byDue));
  return g;
}

// ── 사람 한 줄 요약 (팀 탭) ──
export function personStat(D, uid, key) {
  const tasks = D.tasks || [];
  const open = tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const late = open.filter((t) => { const n = ddays(dueOf(t), key); return n != null && n < 0 && t.status !== "hold"; });
  const fx = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && fxDueOn(t, key));
  const fxDone = fx.filter((t) => fxMeDone(t, uid, key));
  let last = "";
  tasks.forEach((t) => { const a = (t.doneAtBy && t.doneAtBy[uid]) || (t.doneBy === uid ? t.doneAt : ""); if (a && a > last) last = a; });
  (D.notes || []).forEach((n) => { if (n.by === uid && (n.at || "") > last) last = n.at; });
  (D.log || []).forEach((l) => { if (l.by === uid && (l.at || "") > last) last = l.at; });
  return { inprog: open.filter((t) => t.status === "inprogress").length, open: open.length, late: late.length, fxDone: fxDone.length, fxTotal: fx.length, last };
}
// 담당 정리 필요: 담당 없음 · 미사용 담당
export function ownerIssues(D) {
  const users = D.users || [], off = new Set(users.filter((u) => u.active === false).map((u) => u.id)), ids = new Set(users.map((u) => u.id));
  const out = [];
  (D.tasks || []).forEach((t) => { if (isDone(t) || t.paused) return; const o = t.isFixed && t.forAll ? ["*"] : ownersOf(t);
    if (!o.length) out.push({ t, why: "담당 없음" }); else if (o.every((id) => id !== "*" && (off.has(id) || !ids.has(id)))) out.push({ t, why: "미사용 담당" }); });
  return out;
}

// ── 소식 (댓글 + 기록) ──
export const LOG_L = { add: "새로 만듦", edit: "고침", done: "끝냄", reopen: "다시 엶", assign: "담당 바꿈", take: "이어받음", comment: "댓글", delete: "휴지통으로" };
export function feedOf(D, { projectId, taskIds, sinceIso } = {}) {
  const tset = taskIds ? new Set(taskIds) : null;
  const notes = (D.notes || []).filter((n) => !n.deleted && (!sinceIso || (n.at || "") >= sinceIso)).filter((n) => {
    if (!projectId && !tset) return true; const [k, ...r] = String(n.itemId || "").split(":"); const ref = r.join(":");
    return (k === "proj" && ref === projectId) || (k === "task" && tset && tset.has(ref)); })
    .map((n) => ({ type: "note", id: "n" + n.id, at: n.at, by: n.by, byName: n.byName, text: n.text, itemId: n.itemId, files: n.files || [] }));
  const logs = (D.log || []).filter((l) => (!sinceIso || (l.at || "") >= sinceIso)).filter((l) => {
    if (!projectId && !tset) return true; return l.projectId === projectId || (tset && tset.has(l.targetId)); })
    .map((l) => ({ type: "log", id: "l" + l.id, at: l.at, by: l.by, byName: l.byName, text: l.label || "", action: l.action, targetId: l.targetId, col: l.col }));
  return [...notes, ...logs].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

// ── 댓글 묶기 (원댓글 + 대댓글) ──
export function threads(notes, itemId) {
  const mine = (notes || []).filter((n) => n && n.itemId === itemId && !n.deleted);
  const byAt = (a, b) => String(a.at || "").localeCompare(String(b.at || ""));
  const tops = mine.filter((n) => !n.parentId || !mine.some((m) => m.id === n.parentId)).sort(byAt);
  return tops.map((t) => ({ ...t, replies: mine.filter((r) => r.parentId === t.id).sort(byAt) }));
}
export const taskNoteId = (id) => "task:" + id;
export const projNoteId = (id) => "proj:" + id;

// ── 새 id ──
export const newId = (pre) => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── v1 → v2 복사 계획 (읽기만 한 v1 데이터 → v2 문서 목록) ──
// v1 키(pour-os/state-<키>) 를 v2 의 같은 이름 칸으로. meta·savelock 은 저장 장치라 옮기지 않음.
export const V1_SKIP = new Set(["meta", "savelock"]);
export const docIdOf = (key, it, i) => String((key === "trash" && it && it._tid) || (it && it.id) || `_i${i}`).replace(/[/\s]/g, "_").slice(0, 300) || `_i${i}`;
export function planSeed(v1, notes = []) {
  const ops = [], counts = {};
  Object.entries(v1 || {}).forEach(([key, items]) => {
    if (V1_SKIP.has(key) || !Array.isArray(items)) return;
    const seenIds = new Set();
    items.forEach((it, i) => { if (!it || typeof it !== "object") return; let id = docIdOf(key, it, i); if (seenIds.has(id)) id = id + "_" + i; seenIds.add(id);
      ops.push({ key: key === "activityLog" ? "log" : key, id, data: it }); });
    counts[key === "activityLog" ? "log" : key] = items.length;
  });
  (notes || []).forEach((n, i) => { if (n && typeof n === "object") ops.push({ key: "notes", id: docIdOf("notes", n, i), data: n }); });
  counts.notes = (notes || []).length;
  return { ops, counts };
}
export const COUNT_L = { tasks: "업무", projects: "프로젝트", users: "사람", notes: "댓글", log: "기록", events: "일정", goals: "목표", mainKPIs: "메인 KPI", subKPIs: "서브 KPI", workflows: "흐름", trash: "휴지통" };
