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
// 업무를 볼 수 있나 (p: 그 업무의 프로젝트 · 없으면 null)
export function taskSeen(t, p, uid, tasks) {
  if (!t) return true;
  if (p && secretOn(p) && !projSeen(p, uid, tasks)) return false;
  if (t.isFixed || !secretOn(t)) return true;
  return ownersOf(t).includes(uid) || allowed(t, uid) || (t.ccIds || []).includes(uid) || t.requestedBy === uid || t.createdBy === uid || t.secret.by === uid || (!!p && p.assigneeId === uid);
}
// 이 사람에게 기밀이 걸린 것인지 (마스터는 늘 봄)
export const seeAll = (u) => !u || isMaster(u);

// 화면용 대체본: 담당·기한·상태·순서 칸은 그대로, 글·자료·사유는 비움
const blankReason = (o) => (o && typeof o === "object" ? { ...o, reason: "", note: "" } : o);
export const lockTask = (t) => ({ ...t, title: LOCK_T, memo: "", attachments: [], feedback: null, statusLog: [], holdReason: "", ownerText: "", wfData: null, wfChecks: null, lbSeen: null,
  blocked: blankReason(t.blocked), dueReq: blankReason(t.dueReq), handoff: blankReason(t.handoff), locked: true });
export const lockProj = (p) => ({ ...p, title: LOCK_P, memo: "", now: null, lbSeen: null, sourceManualName: "", resultValue: null, locked: true });

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
