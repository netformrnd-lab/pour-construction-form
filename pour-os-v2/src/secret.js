// 업무OS v2 — 기밀 업무·프로젝트 (화면 숨김 · 사용자 결정 2026-10-05)
// 마스터(관리자)는 전부 봄 · 팀원은 허용된 사람만 · 허용 안 된 사람에겐 '기밀 업무'(자물쇠)로만 — 담당·기한·상태는 보여서 바쁜 건 보임, 제목·메모·댓글·자료·기록은 안 보임
// 칸: secret = { on: true, allow: [사람 id], by, byName, at } (업무·프로젝트 문서)
// 자동 허용: 프로젝트 = 책임자·함께하는 사람·만든 사람·정한 사람·그 안 업무 담당 · 업무 = 담당·참조·맡긴 사람·만든 사람·정한 사람·프로젝트 책임자
// 프로젝트가 기밀이면 그 안 업무도 프로젝트 기준으로 숨김 · 반복(고정) 업무는 기밀 대상 아님
// ※ 화면에서 숨기는 것 (진짜 잠금은 로그인 방식을 바꿀 때 보안규칙으로) · 숨긴 화면 데이터(가짜 제목)는 절대 저장에 쓰지 않음 — 신제품 대시보드 반영은 원래 데이터로
import { ownersOf, isMaster } from "./model.js";

export const LOCK_T = "기밀 업무", LOCK_P = "기밀 프로젝트";
export const secretOn = (x) => !!(x && x.secret && x.secret.on);
const allowed = (x, uid) => ((x && x.secret && x.secret.allow) || []).includes(uid);

// 프로젝트를 볼 수 있나 (tasks: 그 안 담당 확인용)
export function projSeen(p, uid, tasks) {
  if (!p || !secretOn(p)) return true;
  return p.assigneeId === uid || (p.collaboratorIds || []).includes(uid) || allowed(p, uid) || p.createdBy === uid || p.secret.by === uid
    || (tasks || []).some((t) => t.projectId === p.id && ownersOf(t).includes(uid));
}
// 업무를 볼 수 있나 (p: 그 업무의 프로젝트 · 없으면 null) — 상위 업무가 기밀이면 하위 업무(안·할 일 줄)도 그 기준
//   요청을 받은 사람(확인 받기 reviewTo · 도움 ask.to · 기한 조정 dueReq.to · 막힘 blocked.to · 풀림 unblocked.to)도 자동 허용 → 받은 요청을 열어 처리할 수 있게
export function taskSeen(t, p, uid, tasks, depth = 0) {
  if (!t) return true;
  if (p && secretOn(p) && !projSeen(p, uid, tasks)) return false;
  if (t.parentId && depth < 20) { const up = (tasks || []).find((x) => x.id === t.parentId); if (up && !taskSeen(up, p, uid, tasks, depth + 1)) return false; }
  if (t.isFixed || !secretOn(t)) return true;
  const to = (o) => !!(o && o.to === uid);
  return ownersOf(t).includes(uid) || allowed(t, uid) || (t.ccIds || []).includes(uid) || t.requestedBy === uid || t.createdBy === uid || t.secret.by === uid || (!!p && p.assigneeId === uid)
    || t.reviewTo === uid || to(t.ask) || to(t.dueReq) || to(t.blocked) || to(t.unblocked);
}
// 이 사람에게 기밀이 걸린 것인지 (마스터는 늘 봄)
export const seeAll = (u) => !u || isMaster(u);

// 화면용 대체본: 남길 칸만 골라 담음(허용 목록) — 담당·기한·상태·순서 칸은 그대로(바쁜 건 보임), 글·자료·사유·이유·안 정보는 모두 빠짐
const pick = (o, keys) => { const r = {}; keys.forEach((k) => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const sub = (o, keys) => (o && typeof o === "object" ? pick(o, keys) : o);
const WHO = ["by", "byName", "at", "to"];
const T_KEEP = ["id", "_doc", "status", "projectId", "parentId", "isFixed", "type", "launchItem", "phase", "assigneeId", "assigneeIds", "assignedBy", "assignedAt", "requestedBy", "requestedAt",
  "dueDate", "dueAuto", "startDate", "workDate", "weekDay", "weekSlot", "holdUntil", "holdBy", "heldAt", "heldBy", "reviewAt", "reviewTo", "doneAt", "doneBy", "doneByName", "doneDate", "finishedAt",
  "approvedAt", "approvedBy", "ackAt", "ackBy", "deps", "bulkId", "ownerFrom", "ownerAuto", "noReview", "ccIds", "tidySkip", "priority", "deleted", "secret", "option", "decision", "optDropped",
  "order", "count", "customStep", "lbRow", "lbOff", "dropPrev", "holdPrev", "madeIn", "createdAt", "createdBy", "updatedAt", "updatedBy", "v2At"];
export const lockTask = (t) => ({ ...pick(t, T_KEEP), title: LOCK_T, memo: "", attachments: [], statusLog: [], locked: true,
  ...(t.handoff ? { handoff: sub(t.handoff, [...WHO, "from", "all"]) } : {}), ...(t.blocked ? { blocked: sub(t.blocked, WHO) } : {}), ...(t.unblocked ? { unblocked: sub(t.unblocked, WHO) } : {}),
  ...(t.dueReq ? { dueReq: sub(t.dueReq, [...WHO, "date"]) } : {}), ...(t.dueReqResult ? { dueReqResult: sub(t.dueReqResult, [...WHO, "ok", "date"]) } : {}),
  ...(t.ask ? { ask: sub(t.ask, [...WHO, "kind"]) } : {}), ...(t.feedback ? { feedback: sub(t.feedback, WHO) } : {}), ...(t.decided ? { decided: sub(t.decided, WHO) } : {}) });
const P_KEEP = ["id", "_doc", "status", "assigneeId", "collaboratorIds", "dueDate", "dueAuto", "launchDate", "startDate", "priority", "progress", "progressManual", "category", "brand", "team",
  "createdAt", "createdBy", "updatedAt", "deleted", "archived", "secret", "lbProject", "skipItems", "dash", "holdUntil", "heldBy", "finishedAt", "doneAt", "wfId", "group", "lbTrash"];
export const lockProj = (p) => ({ ...pick(p, P_KEEP), title: LOCK_P, memo: "", now: null, statusLog: [], locked: true });

// 목록 하나(서버에서 따로 읽은 업무들)를 화면용으로
export function viewTasks(list, D, u = D.viewer) {
  if (seeAll(u)) return list;
  const pm = new Map((D.projects || []).map((p) => [p.id, p]));
  return (list || []).map((t) => (taskSeen(t, pm.get(t.projectId) || null, u.id, D.tasks) ? t : lockTask(t)));
}

// 데이터 전체 → 이 사람이 볼 화면 데이터 (+ lockedT · lockedP 번호 모음)
export function redact(D, u) {
  if (seeAll(u) || !D.ready) return { ...D, lockedT: new Set(), lockedP: new Set(), viewer: u || null };
  const lockedP = new Set((D.projects || []).filter((p) => !projSeen(p, u.id, D.tasks)).map((p) => p.id));
  const pm = new Map((D.projects || []).map((p) => [p.id, p]));
  const lockedT = new Set((D.tasks || []).filter((t) => !taskSeen(t, pm.get(t.projectId) || null, u.id, D.tasks)).map((t) => t.id));
  if (!lockedP.size && !lockedT.size) return { ...D, lockedT, lockedP, viewer: u };
  const hidden = (itemId) => { const s = String(itemId || ""); return (s.startsWith("task:") && lockedT.has(s.slice(5))) || (s.startsWith("proj:") && lockedP.has(s.slice(5))); };
  const logHidden = (l) => lockedT.has(l.targetId) || lockedP.has(l.targetId) || lockedP.has(l.projectId) || (Array.isArray(l.ids) && l.ids.some((id) => lockedT.has(id)));
  return { ...D, lockedT, lockedP, viewer: u,
    projects: D.projects.map((p) => (lockedP.has(p.id) ? lockProj(p) : p)),
    tasks: D.tasks.map((t) => (lockedT.has(t.id) ? lockTask(t) : t)),
    notes: (D.notes || []).filter((n) => !hidden(n.itemId)),
    log: (D.log || []).filter((l) => !logHidden(l)) };
}
// 기록·댓글 목록(서버에서 따로 읽은 것)에서 숨길 것 빼기
export function viewLogs(list, D) { const T = D.lockedT || new Set(), P = D.lockedP || new Set(); return (list || []).filter((l) => !(T.has(l.targetId) || P.has(l.targetId) || P.has(l.projectId) || (Array.isArray(l.ids) && l.ids.some((id) => T.has(id))))); }
