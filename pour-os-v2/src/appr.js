// 업무OS v2 — 구매 품의 요청 (사용자 결정 2026-10-16 · 계산만 · 화면 apprui.jsx · 시험 appr.test.mjs)
//   하이웍스를 못 쓰는 사람(윤미니)이 품의 요청을 남기면 → 담당(기본 김송희)이 내용을 보고 하이웍스에 대신 올린 뒤 [품의 완료]로 닫음
//   저장: pour-os/approval-requests/items/{id} — 독립 화면 ../approval-requests.html 과 같은 문서 (규칙 변경 없음 · pour-os/{doc=**} 안)
//   { requester(이름), requesterId?(업무OS 사람 번호), assignee?(이름 · 없으면 김송희), assigneeId?, topic, docType, title, body,
//     status: "품의전"|"품의완료", doneBy, doneById?, doneAt, doneMemo, createdAt, updatedAt, deleted, deletedAt, source?("os2") }
//   '확인할 것': 담당 = '품의 요청 n건'(처리할 때까지 남음) + 새 요청 한 건씩(읽으면 사라짐 · 7일) / 요청자 = '품의 완료'(읽으면 사라짐 · 7일)

export const APPR_TOPICS = ["CS", "주문/발주", "재고관리", "기타"];
export const APPR_DOC_TYPES = [
  { v: "지출결의서", pay: "현금영수증 되는 결제" },
  { v: "구매요청서", pay: "카드 사용" },
  { v: "품의서", pay: "둘 다 아닐 때" },
];
export const APPR_BODY_TEMPLATE = "- 품목:\n- 수량:\n- 금액(예상):\n- 구매처/링크:\n- 결제 방법:\n- 필요한 이유:\n- 필요한 날짜:";
export const APPR_DEFAULT_ASSIGNEE = "김송희";   // 요청자가 누구든 기본 담당 (화면에서 바꿀 수 있음)
export const APPR_URL = "../approval-requests.html";   // 독립 화면 (os2.html 이 pourstore-renewal/ 안이라 한 칸 위)
const DAY = 864e5;

const clean = (s) => String(s || "").replace(/\s/g, "");
export const apprDone = (r) => !!r && r.status === "품의완료";
export const apprLive = (r) => !!r && !r.deleted;
export const apprAssignee = (r) => (r && String(r.assignee || "").trim()) || APPR_DEFAULT_ASSIGNEE;

// 이름 → 업무OS 사람 번호 (쓰는 사람 중 이름이 똑같은 1명)
export function userIdByName(users, name) {
  const n = clean(name); if (!n) return "";
  const hit = (users || []).filter((u) => u && u.active !== false && clean(u.name) === n);
  return hit.length === 1 ? hit[0].id : "";
}
// 담당이 이 사람인가 — 번호가 있으면 번호로, 없으면(독립 화면에서 쓴 것) 이름으로
export const apprAssigneeId = (r, users) => (r && r.assigneeId && (users || []).some((u) => u && u.id === r.assigneeId) ? r.assigneeId : userIdByName(users, apprAssignee(r)));
export const isApprAssignee = (r, users, uid) => !!uid && apprAssigneeId(r, users) === uid;
export const isApprMine = (r, users, uid) => { if (!r || !uid) return false; if (r.requesterId) return r.requesterId === uid; const u = (users || []).find((x) => x && x.id === uid); return !!u && clean(u.name) === clean(r.requester); };

// 구독 두 갈래(품의 전 전부 + 최근 30일 바뀐 것)를 합쳐 지운 것 빼고 최근 것 먼저
export function apprMerge(...lists) {
  const m = new Map(); lists.forEach((l) => (l || []).forEach((x) => { if (x && x.id) m.set(x.id, x); }));
  return [...m.values()].filter(apprLive).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

// 새 요청 문서 (업무OS 에서 · 요청자 = 로그인한 사람 · 담당 기본 김송희)
export function apprNewDoc(f, cu, users, now = new Date().toISOString()) {
  const assignee = String(f.assignee || "").trim() || APPR_DEFAULT_ASSIGNEE;
  return { requester: cu.name, requesterId: cu.id, assignee, assigneeId: f.assigneeId || userIdByName(users, assignee), topic: f.topic, docType: f.docType, title: String(f.title || "").trim(), body: String(f.body || "").replace(/\s+$/, ""),
    status: "품의전", doneBy: "", doneById: "", doneAt: null, doneMemo: "", createdAt: now, updatedAt: now, deleted: false, deletedAt: null, source: "os2" };
}
export function apprMissing(f) {
  const miss = [];
  if (!f.topic) miss.push("주제"); if (!f.docType) miss.push("문서 종류"); if (!String(f.title || "").trim()) miss.push("제목"); if (!String(f.body || "").trim()) miss.push("본문");
  return miss;
}
export const apprDonePatch = (cu, memo, now = new Date().toISOString()) => ({ status: "품의완료", doneBy: cu.name, doneById: cu.id, doneAt: now, doneMemo: String(memo || "").trim().slice(0, 100), updatedAt: now });
export const apprUndonePatch = (now = new Date().toISOString()) => ({ status: "품의전", doneBy: "", doneById: "", doneAt: null, doneMemo: "", updatedAt: now });
export const apprAssignPatch = (u, now = new Date().toISOString()) => ({ assignee: u.name, assigneeId: u.id, updatedAt: now });

// 누가 무엇을 할 수 있나 — [품의 완료]·되돌리기 = 담당·관리자 · 고치기·지우기 = 요청자(품의 전일 때)·관리자 · 담당 바꾸기 = 요청자·담당·관리자
export const canApprDone = (r, users, cu, master) => !!cu && (master || isApprAssignee(r, users, cu.id));
export const canApprEdit = (r, users, cu, master) => !!cu && (master || (isApprMine(r, users, cu.id) && !apprDone(r)));
export const canApprAssign = (r, users, cu, master) => !!cu && !apprDone(r) && (master || isApprMine(r, users, cu.id) || isApprAssignee(r, users, cu.id));

// 화면 목록: 내 요청 · 내가 맡은 것(품의 전 = 오래된 것 먼저 · 끝낸 것은 아래) · 담당으로 거르기
export function apprLists(list, users, uid) {
  const mine = (list || []).filter((r) => isApprMine(r, users, uid));
  const asg = (list || []).filter((r) => isApprAssignee(r, users, uid));
  const wait = asg.filter((r) => !apprDone(r)).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return { mine, mineWait: mine.filter((r) => !apprDone(r)).length, wait, doneByMe: asg.filter(apprDone) };
}
export const apprAssigneeNames = (list) => [...new Set([APPR_DEFAULT_ASSIGNEE, ...(list || []).map(apprAssignee)])];
export const apprByAssignee = (list, name) => (!name ? list || [] : (list || []).filter((r) => apprAssignee(r) === name));

// '확인할 것' 줄 (model.todayView 가 D.apprInbox 로 부름 · 순환 import 피하려고)
//   담당: 품의 전이 있으면 '품의 요청 n건'(keep · 처리하면 사라짐) + 7일 안 새 요청 한 건씩(읽음 체계 · 읽으면 '읽은 알림'으로)
//   요청자: 7일 안에 품의 완료된 내 요청 한 건씩(읽음 체계)
export function apprInbox(list, users, uid, seen = {}, now = new Date()) {
  const out = [], since = new Date(now.getTime() - 7 * DAY).toISOString(), rows = (list || []).filter(apprLive);
  const wait = rows.filter((r) => !apprDone(r) && isApprAssignee(r, users, uid)).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  if (wait.length) { const last = wait[wait.length - 1];
    out.push({ kind: "appr", tag: "품의 요청", id: "aq:wait", apprList: true, title: `품의 요청 ${wait.length}건`, whoName: last.requester || "", at: last.createdAt || "",
      text: wait.length === 1 ? `${wait[0].docType || ""} · ${wait[0].title || ""}` : `${wait.slice(0, 2).map((r) => r.title).join(" · ")}${wait.length > 2 ? ` 외 ${wait.length - 2}건` : ""}`, keep: true }); }
  wait.filter((r) => String(r.createdAt || "") >= since && !isApprMine(r, users, uid)).forEach((r) => {
    const id = "aqn:" + r.id; if (seen[id]) return;
    out.push({ kind: "apprNew", tag: "새 품의 요청", id, apprId: r.id, title: r.title || "품의 요청", whoName: r.requester || "", at: r.createdAt || "", text: [r.docType, r.topic].filter(Boolean).join(" · ") }); });
  rows.filter((r) => apprDone(r) && isApprMine(r, users, uid) && String(r.doneAt || "") >= since && r.doneById !== uid).forEach((r) => {
    const id = "aqd:" + r.id + ":" + r.doneAt; if (seen[id]) return;
    out.push({ kind: "apprDone", tag: "품의 완료", id, apprId: r.id, title: r.title || "품의 요청", whoName: r.doneBy || "", at: r.doneAt || "", text: r.doneMemo ? `메모 ${r.doneMemo}` : "하이웍스에 품의를 올렸어요" }); });
  return out;
}
