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
// 공휴일 (기한 계산에서 건너뜀 · 달력 날짜 회색). 음력 공휴일은 해마다 직접 넣는다
export const KR_HOLIDAYS = {
  "2026-10-03": "개천절", "2026-10-05": "개천절 대체공휴일", "2026-10-09": "한글날", "2026-12-25": "성탄절",
  "2027-01-01": "신정", "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴", "2027-02-09": "설날 대체공휴일",
  "2027-03-01": "삼일절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날", "2027-06-06": "현충일", "2027-08-15": "광복절", "2027-08-16": "광복절 대체공휴일",
  "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴", "2027-10-03": "개천절", "2027-10-04": "개천절 대체공휴일",
  "2027-10-09": "한글날", "2027-10-11": "한글날 대체공휴일", "2027-12-25": "성탄절", "2027-12-27": "성탄절 대체공휴일",
};
export const holidayName = (key) => KR_HOLIDAYS[key] || "";
export const isOffDay = (key) => { const w = new Date(key + "T00:00:00").getDay(); return w === 0 || w === 6 || !!KR_HOLIDAYS[key]; };
export const prevWorkday = (key) => { let k = key; for (let i = 0; i < 14 && isOffDay(k); i++) k = addDays(k, -1); return k; };
export const nextWorkday = (key) => { let k = key; for (let i = 0; i < 14 && isOffDay(k); i++) k = addDays(k, 1); return k; };

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

// ── 업무 흐름 규칙 (맡김 → 받음 → 진행 → 끝냄 → 확인) ──
// 다른 사람이 맡긴 일이면 맡긴 사람 id
export const reqOf = (t) => (t && t.requestedBy && !ownersOf(t).includes(t.requestedBy) ? t.requestedBy : "");
// 끝내면 맡긴 사람이 확인하는 일인가 (신제품 항목처럼 noReview 면 바로 끝)
export const needsReview = (t) => !!reqOf(t) && !t.noReview;
// 기한을 바꿀 때 허락할 사람: 맡긴 사람 → (신제품 항목이면) 제품 책임자(담당이 아닐 때) → 없음
// (예전 업무처럼 맡긴 사람 기록이 없는 일은 담당이 바로 바꿈. 신제품 항목은 출시일에 걸리므로 책임자 허락)
export function dueApprover(t, D) {
  const r = reqOf(t); if (r) return r;
  if (!t.launchItem) return "";
  const p = (D.projects || []).find((x) => x.id === t.projectId);
  return p && p.assigneeId && !ownersOf(t).includes(p.assigneeId) ? p.assigneeId : "";
}
export const canSetDue = (t, uid, D, master) => !!master || !dueApprover(t, D) || dueApprover(t, D) === uid;
// 위험 신호 한 개 (가장 급한 것)
export function riskOf(t, key) {
  if (!t || isDone(t)) return null;
  const n = ddays(dueOf(t), key);
  if (t.blocked) return { k: "blocked", label: "막힘", red: true };
  if (n != null && n < 0 && t.status !== "review") return { k: "late", label: `${-n}일 지남`, red: true };
  if (t.status === "review") return { k: "review", label: "확인 대기" };
  if (t.feedback) return { k: "feedback", label: "수정 요청", red: true };
  if (n === 0) return { k: "today", label: "오늘 마감" };
  if (n != null && n <= 2 && t.status === "todo") return { k: "start", label: n === 1 ? "내일 마감 · 시작 전" : "D-2 · 시작 전" };
  if (n === 1) return { k: "soon", label: "내일 마감" };
  if (t.status === "hold") return { k: "hold", label: "보류" };
  return null;
}
// 지금 할 일 고르는 순서 (한 번에 하나): 수정 요청 → 지난 일 → 진행 중 → 오늘 마감 → 곧 마감(시작 전) → 마감 가까운 순 → 날짜 없음
// fresh = 방금 앞 일이 끝나 '이제 내 차례'가 된 일 (turn.js). 기한 7일 안이면 지난 일보다 먼저, 아니면 진행 중 다음
export function focusRank(t, key, fresh) {
  const n = ddays(dueOf(t), key);
  if (t.feedback) return 0; if (fresh && n != null && n <= 7) return 0.5; if (n != null && n < 0) return 1; if (t.status === "inprogress") return 2;
  if (fresh) return 2.5; if (n === 0) return 3; if (n != null && n <= 2) return 4; if (n != null) return 5; return 6;
}

// ── 오늘 화면 ──
// seen: {id:true} 이 기기에서 이미 본 것 (댓글·결과 알림만. 할 일이 남은 알림은 처리해야 사라짐)
// T (turn.js turnsOf 결과, 없어도 됨): {temp:Set 임시 담당, fresh:Set 이제 내 차례, inbox:[차례 알림]}
export function todayView(D, uid, now = new Date(), seen = {}, T = null) {
  const temp = (T && T.temp) || new Set(), fresh = (T && T.fresh) || new Set();
  const key = ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const tasks = D.tasks || [], users = D.users || [];
  // 오늘 고정업무 — 오늘 해당분만, 시간순
  const fx = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && fxDueOn(t, key))
    .map((t) => ({ t, min: fxMin(t, uid), me: fxMeDone(t, uid, key) }))
    .sort((a, b) => a.min - b.min || fxLabel(a.t, uid).localeCompare(fxLabel(b.t, uid)));
  const fixed = { left: fx.filter((x) => !x.me).map((x) => ({ ...x, late: x.min < 9999 && x.min < nowMin })), done: fx.filter((x) => x.me), total: fx.length };
  // 내 할 일 (확인 대기·보류 빼고) — 지금 할 일 순서대로
  const open = tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const active = open.filter((t) => t.status !== "review" && t.status !== "hold" && !temp.has(t.id));   // 임시 담당(책임자로 채운 신제품 항목)은 '정리'로만
  const ranked = active.map((t) => ({ t, r: focusRank(t, key, fresh.has(t.id)), n: ddays(dueOf(t), key), risk: riskOf(t, key), fresh: fresh.has(t.id) }))
    .sort((a, b) => a.r - b.r || (a.n ?? 999) - (b.n ?? 999) || String(a.t.title).localeCompare(String(b.t.title)));
  const focus = ranked.filter((x) => x.r <= 4);              // 오늘 화면에 보일 급한 일
  const late = ranked.filter((x) => x.n != null && x.n < 0);  // 지난 일 정리 대상
  const doing = open.filter((t) => t.status === "inprogress").length;
  // 확인할 것
  const myProj = new Set((D.projects || []).filter((p) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid)).map((p) => p.id));
  const since = new Date(now - 7 * 86400000).toISOString();
  const inbox = []; const launchNew = {}, bulkNew = {};
  tasks.forEach((t) => {
    if (isDone(t) || t.isFixed) return;
    const mine = isMine(t, uid);
    if (mine && t.feedback && t.status !== "review") inbox.push({ kind: "feedback", tag: "수정 요청", red: true, id: "fb:" + t.id, taskId: t.id, title: t.title, who: t.feedback.by, whoName: t.feedback.byName, at: t.feedback.at, text: t.feedback.text, keep: true });
    else if (mine && (reqOf(t) || (t.assignedBy && t.assignedBy !== uid)) && !t.ackAt && t.status === "todo" && !temp.has(t.id)) {
      if (t.bulkId) { const g = (bulkNew[t.bulkId] = bulkNew[t.bulkId] || { n: 0, who: t.assignedBy, at: t.assignedAt, pid: t.projectId, ids: [] }); g.n++; g.ids.push(t.id); }
      else if (t.launchItem) { const g = (launchNew[t.projectId] = launchNew[t.projectId] || { n: 0, who: t.assignedBy || t.requestedBy, at: t.assignedAt || t.requestedAt }); g.n++; }
      else inbox.push({ kind: "assigned", tag: "맡김", id: "as:" + t.id, taskId: t.id, title: t.title, who: t.requestedBy, at: t.requestedAt, text: dueOf(t) ? `기한 ${md(dueOf(t))}` : "", keep: true });
    }
    if (t.dueReq && dueApprover(t, D) === uid) inbox.push({ kind: "dueReq", tag: "기한 조정", id: "dq:" + t.id, taskId: t.id, title: t.title, who: t.dueReq.by, whoName: t.dueReq.byName, at: t.dueReq.at, text: `${md(dueOf(t)) || "미정"} → ${md(t.dueReq.date)}${t.dueReq.reason ? " · " + t.dueReq.reason : ""}`, keep: true });
    if (t.status === "review" && (t.reviewTo || reqOf(t)) === uid) inbox.push({ kind: "review", tag: "확인 요청", id: "rv:" + t.id, taskId: t.id, title: t.title, who: ownersOf(t)[0], at: t.reviewAt || t.updatedAt, text: "끝냈어요 · 확인해 주세요", keep: true });
    if (t.blocked && !mine && (reqOf(t) === uid || dueApprover(t, D) === uid || ((D.projects || []).find((p) => p.id === t.projectId) || {}).assigneeId === uid)) inbox.push({ kind: "blocked", tag: "막힘", red: true, id: "bk:" + t.id, taskId: t.id, title: t.title, who: t.blocked.by, whoName: t.blocked.byName, at: t.blocked.at, text: t.blocked.reason, keep: true });
    if (mine && t.dueReqResult && !seen["dr:" + t.id + t.dueReqResult.at]) inbox.push({ kind: "dueRes", tag: t.dueReqResult.ok ? "기한 바뀜" : "기한 유지", id: "dr:" + t.id + t.dueReqResult.at, taskId: t.id, title: t.title, who: t.dueReqResult.by, whoName: t.dueReqResult.byName, at: t.dueReqResult.at, text: t.dueReqResult.ok ? `새 기한 ${md(dueOf(t))}` : t.dueReqResult.reason || "기한은 그대로예요" });
  });
  Object.entries(launchNew).forEach(([pid, g]) => { const p = (D.projects || []).find((x) => x.id === pid);
    inbox.push({ kind: "launchNew", tag: "신제품", id: "ln:" + pid, projectId: pid, title: `${p ? p.title : "신제품"} · 항목 ${g.n}개 맡김`, who: g.who, at: g.at, text: "열어서 기한을 확인하고 '받았어요'를 눌러 주세요", keep: true }); });
  Object.entries(bulkNew).forEach(([bid, g]) => { const p = (D.projects || []).find((x) => x.id === g.pid);
    inbox.push({ kind: "bulk", tag: "맡김", id: "bl:" + bid, bulkIds: g.ids, projectId: g.pid, title: `${p ? p.title + " · " : ""}항목 ${g.n}개 맡김`, who: g.who, at: g.at, text: "기한을 확인하고 '받았어요'를 눌러 주세요", keep: true }); });
  if (T && Array.isArray(T.inbox)) T.inbox.forEach((x) => inbox.push(x));
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  (D.notes || []).forEach((n) => {
    if (!n || n.deleted || n.by === uid || (n.at || "") < since || seen["nt:" + n.id]) return;
    const [kind, ...rest] = String(n.itemId || "").split(":"); const ref = rest.join(":");
    let hit = null;
    if (kind === "task") { const t = taskById[ref]; if (t && (isMine(t, uid) || reqOf(t) === uid || myProj.has(t.projectId))) hit = { taskId: ref, title: t.title }; }
    else if (kind === "proj" && myProj.has(ref)) { const p = (D.projects || []).find((x) => x.id === ref); hit = { projectId: ref, title: p ? p.title : "프로젝트" }; }
    if (hit) inbox.push({ kind: "note", tag: "댓글", id: "nt:" + n.id, ...hit, who: n.by, whoName: n.byName, at: n.at, text: n.text });
  });
  const ORDER = { feedback: 0, review: 1, dueReq: 2, blocked: 3, turnLate: 4, turnOrder: 5, nextNoOwner: 6, assigned: 7, bulk: 7, launchNew: 8, dueRes: 9, note: 10 };
  inbox.sort((a, b) => (ORDER[a.kind] ?? 11) - (ORDER[b.kind] ?? 11) || String(b.at || "").localeCompare(String(a.at || "")));
  const userName = (id) => nameOf(users, id);
  const doneToday = fixed.done.length + tasks.filter((t) => isOneOff(t) && isMine(t, uid) && (isDone(t) || t.status === "review") && String(t.doneAt || t.reviewAt || "").slice(0, 10) === key).length;
  const oneOffOpen = open.length;   // 0이면 '고정업무만 하는 사람' — 오늘 고정업무를 처음부터 펼침
  return { key, fixed, ranked, todo: ranked, focus, late, doing, inbox, userName, left: fixed.left.length + focus.length, doneToday, oneOffOpen, freshN: ranked.filter((x) => x.fresh).length };
}

// ── 맡긴 일 (지시자) ──
export function assignedByMe(D, uid, now = new Date()) {
  const key = ymd(now), wk = new Date(now - 7 * 86400000).toISOString();
  const mine = (D.tasks || []).filter((t) => !t.isFixed && reqOf(t) === uid);
  const g = { review: [], dueReq: [], blocked: [], late: [], risk: [], notAck: [], doing: [], waiting: [], done: [] };
  mine.forEach((t) => {
    if (isDone(t)) { if (String(t.doneAt || "") >= wk && !t.launchItem) g.done.push(t); return; }
    const r = riskOf(t, key);
    if (t.status === "review") g.review.push(t); else if (t.dueReq) g.dueReq.push(t); else if (t.blocked) g.blocked.push(t);
    else if (r && r.k === "late") g.late.push(t); else if (r && (r.k === "start" || r.k === "today")) g.risk.push(t);
    else if (t.launchItem) return;   // 신제품 항목은 제품 화면에서 (여기엔 급한 것만)
    else if (!t.ackAt && t.status === "todo") g.notAck.push(t); else if (t.status === "inprogress") g.doing.push(t); else g.waiting.push(t);
  });
  const byDue = (a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"));
  Object.values(g).forEach((a) => a.sort(byDue));
  return g;
}

// ── 업무량 (맡기기 전에 보기) — 앞으로 14일 날짜별 마감 수 ──
// skip: 빼고 셀 업무 id Set (예: 임시 담당)
export function workloadOf(D, uid, now = new Date(), days = 14, skip = null) {
  const key = ymd(now);
  const open = (D.tasks || []).filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid) && t.status !== "review" && !(skip && skip.has(t.id)));
  const byDay = {}; open.forEach((t) => { const d = dueOf(t); if (d) (byDay[d] = byDay[d] || []).push(t); });
  const week = [...Array(days)].map((_, i) => { const d = addDays(key, i); return { date: d, list: byDay[d] || [], wd: WD[new Date(d + "T00:00:00").getDay()] }; });
  const late = open.filter((t) => { const n = ddays(dueOf(t), key); return n != null && n < 0 && t.status !== "hold"; });
  return { open: open.length, doing: open.filter((t) => t.status === "inprogress").length, late: late.length, week, dueOn: (d) => byDay[d] || [] };
}
// 기한 지킨 비율 (최근 30일 끝낸 일 중 기한이 있던 것)
export function onTimeOf(D, uid, now = new Date(), days = 30) {
  const since = new Date(now - days * 86400000).toISOString();
  const done = (D.tasks || []).filter((t) => isOneOff(t) && isDone(t) && isMine(t, uid) && dueOf(t) && String(t.doneAt || "") >= since);
  const ok = done.filter((t) => ymd(new Date(t.doneAt)) <= dueOf(t)).length;
  return { n: done.length, ok, pct: done.length ? Math.round((ok / done.length) * 100) : null };
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
  const ym = key.slice(0, 7), wkEnd = addDays(weekStart(key), 6), g = { late: [], week: [], month: [], later: [], none: [], hold: [] };
  list.forEach((p) => { if (p.status === "hold" || p.status === "paused") return g.hold.push(p);
    const d = String(p.dueDate || "").slice(0, 10); if (!d) return g.none.push(p);
    if (d < key) g.late.push(p); else if (d <= wkEnd) g.week.push(p); else if (d.slice(0, 7) === ym) g.month.push(p); else g.later.push(p); });
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
export const LOG_L = { add: "새로 만듦", edit: "고침", done: "끝냄", reopen: "다시 엶", assign: "담당 바꿈", take: "이어받음", comment: "댓글", delete: "휴지통으로",
  ack: "받음", dueReq: "기한 조정 요청", dueOk: "기한 조정 수락", dueNo: "기한 유지", review: "확인 요청", approve: "확인 완료", feedback: "수정 요청", block: "막힘", unblock: "막힘 풀림", launch: "신제품 만듦", bulk: "한꺼번에 바꿈", deps: "앞 일 바꿈" };
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
export const COUNT_L = { tasks: "업무", projects: "프로젝트", users: "사람", notes: "댓글", log: "기록", events: "일정", goals: "목표", mainKPIs: "메인 KPI", subKPIs: "서브 KPI", workflows: "흐름", trash: "휴지통", launch: "신제품" };

// ── 일정(달력) ──
// 달력 칸: 월요일 시작 6주 이내. 이번 달 밖 날짜는 out:true
export function monthGrid(ym) {
  const first = new Date(ym + "-01T00:00:00"), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const weeks = []; const d = new Date(start);
  for (let w = 0; w < 6; w++) { const row = []; for (let i = 0; i < 7; i++) { const k = ymd(d); row.push({ date: k, out: k.slice(0, 7) !== ym }); d.setDate(d.getDate() + 1); }
    if (w >= 4 && row.every((c) => c.out)) break; weeks.push(row); }
  return weeks;
}
export const shiftMonth = (ym, n) => { const d = new Date(ym + "-01T00:00:00"); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
// 달력에 올릴 업무 (거르기: 프로젝트·담당·끝난 것 · noTemp: 빼고 셀 임시 담당 Set)
export function calItems(D, f = {}, key) {
  return (D.tasks || []).filter((t) => isOneOff(t) && dueOf(t) && (f.showDone || !isDone(t))
    && (!f.projectId || t.projectId === f.projectId) && (!f.uid || isMine(t, f.uid)) && !(f.noTemp && f.noTemp.has(t.id)))
    .map((t) => ({ t, date: dueOf(t), risk: riskOf(t, key) }));
}
// 프로젝트가 잘 가고 있나: 위험(지난 항목·막힘 또는 마감 7일 안인데 60% 미만) · 주의(곧 마감인데 시작 전 · 담당 없음) · 순조
export function projHealth(p, D, key, pctOf = null) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), open = ts.filter((t) => !isDone(t));
  const late = open.filter((t) => { const r = riskOf(t, key); return r && (r.k === "late" || r.k === "blocked"); }).length;
  const start = open.filter((t) => { const r = riskOf(t, key); return r && (r.k === "start" || r.k === "today"); }).length;
  const noOwner = open.filter((t) => !ownersOf(t).length).length;
  const pct = pctOf ? pctOf(p) : Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0))), n = ddays(p.dueDate, key);
  const why = [];
  if (late) why.push(`지난 일 ${late}`); if (n != null && n < 0 && open.length) why.push(`마감 ${-n}일 지남`); else if (n != null && n <= 7 && pct < 60 && open.length) why.push(`마감 D-${n}인데 ${pct}%`);
  const level = why.length ? "위험" : start || noOwner ? "주의" : "순조";
  if (start) why.push(`시작 전 ${start}`); if (noOwner) why.push(`담당 없음 ${noOwner}`);
  const next = open.filter((t) => dueOf(t)).sort((a, b) => String(dueOf(a)).localeCompare(String(dueOf(b))))[0] || null;
  return { level, why, late, start, open: open.length, pct, n, next };
}
// 사람 일정이 잘 맞게 가나: 지남·시작 전·기한 지킴 % + 앞으로 4주 주별 마감 수
export function personHealth(D, uid, now = new Date()) {
  const key = ymd(now), w = workloadOf(D, uid, now, 28), ot = onTimeOf(D, uid, now);
  const open = (D.tasks || []).filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const start = open.filter((t) => { const r = riskOf(t, key); return r && r.k === "start"; }).length;
  const weeks = [0, 1, 2, 3].map((i) => w.week.slice(i * 7, i * 7 + 7).reduce((a, d) => a + d.list.length, 0));
  const noDue = open.filter((t) => !dueOf(t) && t.status !== "hold").length;
  const level = w.late >= 3 || (ot.pct != null && ot.pct < 60) ? "위험" : w.late || start || Math.max(...weeks) >= 15 ? "주의" : "순조";
  return { ...w, ot, start, weeks, noDue, level };
}
