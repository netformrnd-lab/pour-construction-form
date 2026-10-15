// 업무OS v2 — 팀원 화면 보기 (보기 모드 · 계산만 · 사용자 결정 2026-10-15)
//   사장님 "리드부터는 관리자모드가 아닌 일반 보기모드를 이름 선택해서 화면 볼 수 있게해"
//   → 리드·본부장·관리자가 이름을 골라 그 사람의 일반 화면(오늘·달력·프로젝트·더보기)을 그대로 봄 — 읽기만
//   누구를: 관리자·본부장 = 사용 중인 모든 사람 · 리드 = 내 아래 사람(상급자 users.bossId 줄을 따라 여러 단계) + 내 팀(팀 리드 이름)
//   기밀: 그 사람이 볼 수 있고 나도 볼 수 있는 것만 (secret.redactAs)
//   저장: 보기 모드 동안 저장 장치 쓰기가 모두 막힘 (viewonly.js) · 바꾸는 버튼은 '보기 모드라 바꾸지 않았어요' (viewActs)
//   링크: …os2.html#v-사람ID (관리자 화면 › 사람 · 문자 등) → 로그인한 사람이 볼 수 있는 사람일 때만
import { isMaster, activeUsers, teamOf, TEAMS, isMine, isDone, dueOf } from "./model.js";
import { isHQ, isLeadU, TEAM_LEADS } from "./aiask.js";

const clean = (s) => String(s || "").replace(/\s/g, "");
// 내 아래 사람인가 — 상급자 줄을 따라 올라가다 내가 나오면 (고리·잘못 넣은 값은 20단계에서 멈춤)
export function isUnder(users, uid, bossId) {
  const m = new Map((users || []).map((u) => [u.id, (u && u.bossId) || ""])); let cur = m.get(uid) || "";
  for (let k = 0, seen = new Set(); cur && k < 20 && !seen.has(cur); k++) { if (cur === bossId) return true; seen.add(cur); cur = m.get(cur) || ""; }
  return false;
}
export const roleTag = (users, u) => (!u ? "" : isHQ(users, u.id) ? "본부장" : isLeadU(users, u.id) ? "리드" : isMaster(u) ? "관리자" : "");
// 이 사람이 보기 모드를 쓸 수 있나 (리드·본부장·관리자)
export const canView = (users, cu) => !!cu && (isMaster(cu) || isHQ(users, cu.id) || isLeadU(users, cu.id));
// 볼 수 있는 사람 [{u, team, tag, under}] — 내 아래 사람 먼저 · 팀 순서(1팀·2팀·3팀·공용) · 리드 먼저 · 이름
export function viewables(users, cu) {
  if (!canView(users, cu)) return [];
  const act = activeUsers(users), all = isMaster(cu) || isHQ(users, cu.id);
  const myTeam = (Object.entries(TEAM_LEADS).find(([, n]) => clean(n) === clean(cu.name)) || [])[0] || "";
  const rows = act.filter((u) => u.id !== cu.id).map((u) => ({ u, team: teamOf(u), tag: roleTag(users, u), under: isUnder(users, u.id, cu.id) }))
    .filter((r) => all || r.under || (myTeam && r.team === myTeam));
  const ti = (t) => { const i = TEAMS.indexOf(t); return i < 0 ? 99 : i; }, ri = (r) => (r.tag === "본부장" ? 0 : r.tag === "리드" ? 1 : 2);
  return rows.sort((a, b) => (b.under - a.under) || (ti(a.team) - ti(b.team)) || (ri(a) - ri(b)) || String(a.u.name).localeCompare(String(b.u.name), "ko"));
}
// #v-사람ID 링크 · 고른 이름 → 볼 수 있는 사람일 때만 그 사람 (아니면 null)
export const viewTarget = (users, cu, id) => (!id ? null : (viewables(users, cu).find((r) => r.u.id === id) || {}).u || null);
export const viewHash = (h) => { const m = /^#v-(.+)$/.exec(String(h || "")); if (!m) return ""; try { return decodeURIComponent(m[1]); } catch (e) { return ""; } };
export const viewLink = (id, base = "./os2.html") => `${base}#v-${encodeURIComponent(id)}`;
// 이름 옆 한 줄: 열린 일 · 기한 지남 · 오늘 마감 · 확인 대기 (한 번짜리 업무 · 보류는 지남에서 뺌)
export function peekOf(D, uid, key) {
  const o = { open: 0, late: 0, today: 0, review: 0 };
  for (const t of (D && D.tasks) || []) {
    if (!t || t.isFixed || !isMine(t, uid) || isDone(t) || t.status === "dropped") continue;
    o.open++; const d = dueOf(t);
    if (t.status === "review") o.review++; else if (d && d < key && t.status !== "hold") o.late++; else if (d === key) o.today++;
  }
  return o;
}
export const peekText = (p) => [`열린 일 ${p.open}`, p.late ? `기한 지남 ${p.late}` : "", p.today ? `오늘 마감 ${p.today}` : "", p.review ? `확인 대기 ${p.review}` : ""].filter(Boolean).join(" · ");

// 보기 모드의 저장 동작 — 부르면 저장하지 않고 알림 한 번(화면이 열릴 때 저절로 부르는 진척 계산·기록은 조용히)
//   돌려주는 값: async 동작은 Promise(false) · 그 밖은 false (부른 쪽이 '실패'로 알아서 화면을 그대로 둠)
export const VIEW_QUIET = new Set(["recalc", "log"]);
const isAsync = (f) => !!f && !!f.constructor && f.constructor.name === "AsyncFunction";
export function viewActs(A, onBlock) {
  return new Proxy(A, { get(o, k) {
    const f = o[k]; if (typeof f !== "function" || k === "toast") return f;
    return () => { if (!VIEW_QUIET.has(k) && onBlock) onBlock(String(k)); return isAsync(f) ? Promise.resolve(false) : false; };
  } });
}
export const viewBlockText = (name) => `보기 모드 · ${name || "그 사람"}님 화면이라 바꾸지 않았어요`;
