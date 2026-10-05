// 업무OS v2 — 신제품 대시보드 → 업무OS 자동 반영 (계산만, 저장은 core.syncLaunchBoard)
// 칸마다 '마지막으로 신제품 대시보드에서 본 값'(lbSeen)을 기억해서 비교 (3-way):
//   신제품 대시보드 값 = 기억한 값 → 바뀐 것 없음
//   신제품 대시보드만 바뀜 → 업무OS 에 넣음
//   둘 다 바뀜 → 나중에 바뀐 쪽 (신제품 단계 updatedAt vs 업무OS v2At)
//   처음(기억 없음): 업무OS 에서 고친 적 없는 업무(v2At 없음)만 신제품 값으로, 고친 업무는 그대로 두고 기억만
// 신제품 대시보드의 빈 값(담당 없음 · 마감 없음)은 처음엔 업무OS 값을 지우지 않음 (자동 기한·기본 담당 유지)
import { LAUNCH_ITEMS, itemState, ownerIdsOf, launchDue, relaunch } from "./launch.js";
import { ownersOf, dueOf } from "./model.js";

// 신제품 대시보드 상태 → 업무OS (skip = 해당 없음 → 업무는 지우지 않고 'dropped'로 접음)
export const LB2V = { todo: "todo", doing: "inprogress", done: "done", hold: "hold" };
export const V2B = { todo: "todo", inprogress: "doing", review: "doing", done: "done", hold: "hold" };   // 업무OS → 신제품 말 (3단계에서도 씀) · 확인 대기는 아직 진행 중 → 신제품에서 컨펌하면 승인
const normB = (s) => (s === "skip" ? "skip" : LB2V[s] ? s : "todo");   // req·reviewed 같은 옛 상태는 할 일
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 한 업무의 신제품 대시보드 값 (상태 · 담당 번호들 · 직접 정한 마감 · 진행사항)
export function boardVals(p, it, users) {
  const s = itemState(p, it), live = (id) => (users || []).some((u) => u.id === id && u.active !== false);
  const ids = (s.ownerIds && s.ownerIds.length ? s.ownerIds.filter(live) : ownerIdsOf(s.owner, users));
  return { status: normB(s.status), owners: ids, due: s.due || "", note: s.note || "", at: s.updatedAt || "", doneAt: s.doneAt || "", doneBy: s.doneBy || "" };
}

// p: 신제품 대시보드 제품 · proj: 업무OS 프로젝트(lb_<id>) · tasks: 그 프로젝트 업무 전부 · now: ISO
// → { tasks:[{t, fields, label}], project: fields|null, n }
export function planLaunchSync(p, proj, tasks, users, today, now, structure) {
  const out = [], byItem = new Map((tasks || []).filter((t) => t.launchItem && !t.isFixed).map((t) => [t.launchItem, t]));
  const skipAdd = [], skipDel = [];
  LAUNCH_ITEMS.forEach((it) => {
    const t = byItem.get(it.id); if (!t) return;   // 업무가 없는 항목(처음부터 해당 없음 등)은 3단계·4단계에서
    const b = boardVals(p, it, users), base = t.lbSeen || null, first = !base;
    const vB = t.status === "dropped" && t.lbSkip ? "skip" : V2B[t.status] || "todo";
    const v = { owners: ownersOf(t), due: t.dueAuto ? "" : dueOf(t), note: t.memo || "" };
    const boardNewer = !t.v2At || (b.at && b.at > t.v2At);
    const f = {}, said = [];
    const take = (k, bv, vv, empty) => {   // 이 칸을 신제품 값으로 바꿀지
      if (first) return !t.v2At && !empty && !same(bv, vv);
      if (same(bv, base[k])) return false;            // 신제품에선 안 바뀜
      if (same(bv, vv)) return false;                 // 이미 같음 (기억만 새로)
      return same(vv, base[k]) || boardNewer;         // 업무OS 는 그대로였거나, 신제품이 나중에 바뀜
    };
    // 상태 (같은 말로 맞춰 비교: 업무OS 확인 대기 = 신제품 '진행 중'(컨펌 누르면 승인) · 진행 중 = doing · 해당 없음으로 접은 것 = skip)
    //   프로젝트째 보류·중단으로 접힌 업무는 상태를 건드리지 않음 (프로젝트 다시 시작 때 이전 상태로)
    const folded = t.holdBy === "proj" || (t.status === "dropped" && !t.lbSkip);
    if (!folded && take("status", b.status, vB, false)) {
      if (b.status === "skip") { Object.assign(f, { status: "dropped", lbSkip: true, dropPrev: t.status || "todo", droppedAt: now }); skipAdd.push(it.id); said.push("해당 없음"); }
      else {
        const to = LB2V[b.status];
        Object.assign(f, { status: to, ...(t.lbSkip ? { lbSkip: false } : {}) }); if (t.lbSkip) skipDel.push(it.id);
        if (to === "done") Object.assign(f, { doneAt: b.doneAt || now, finishedAt: t.finishedAt || b.doneAt || now, doneByName: b.doneBy || "", reviewAt: null, feedback: null });
        else if (t.status === "done" || t.status === "review") Object.assign(f, { doneAt: null, finishedAt: null, reviewAt: null });
        if (to === "hold" && t.status !== "hold") Object.assign(f, { holdPrev: t.status || "todo", holdReason: "신제품 대시보드에서 보류" });
        said.push(to === "done" ? "컨펌 완료" : to === "inprogress" ? "진행 중" : to === "hold" ? "보류" : "할 일");
      }
    }
    // 담당 (신제품에서 담당을 비우면 업무OS 담당은 그대로 둠)
    if (b.owners.length && take("owners", b.owners, v.owners, false)) { Object.assign(f, { assigneeIds: b.owners, assigneeId: b.owners[0], ownerAuto: false, ownerFrom: "board" }); said.push("담당"); }
    // 마감: 신제품에서 정한 날 → 그 날 · 정했던 마감을 지우면 → 출시일 기준 자동 기한으로
    if (take("due", b.due, v.due, !b.due)) {
      if (b.due) Object.assign(f, { dueDate: b.due, dueAuto: false });
      else { const ad = launchDue(p.launchDate, it.off, today); Object.assign(f, { dueDate: ad, dueAuto: true }); }
      said.push("마감");
    }
    // 진행사항 → 메모
    if (take("note", b.note, v.note, !b.note)) { Object.assign(f, { memo: b.note, memoAt: now, memoBy: "", memoByName: "신제품 대시보드" }); said.push("진행사항"); }
    const seen = { status: b.status, owners: b.owners, due: b.due, note: b.note };
    if (Object.keys(f).length || !same(seen, base)) out.push({ t, fields: { ...f, lbSeen: seen }, label: said.join("·") });
  });
  // 프로젝트: 출시일 · 이름 · 해당 없음 목록
  let project = null; const pb = proj.lbSeen || null;
  const pf = {}, pSaid = [];
  const pTake = (k, bv, vv) => (!pb ? !proj.v2At && bv && !same(bv, vv) : !same(bv, pb[k]) && !same(bv, vv) && (same(vv, pb[k]) || !proj.v2At || (p.updatedAt || "") > proj.v2At));
  if (pTake("launchDate", p.launchDate || "", proj.launchDate || "")) {
    Object.assign(pf, { launchDate: p.launchDate || "", dueDate: p.launchDate || "" }); pSaid.push("출시일");
    // 자동 기한 업무는 새 출시일 기준으로 옮김 (사람이 정한 기한은 그대로)
    if (p.launchDate) relaunch(tasks, p.launchDate, today).forEach((x) => { const o = out.find((y) => y.t.id === x.task.id);
      if (o) { if (!("dueDate" in o.fields)) o.fields.dueDate = x.due; } else out.push({ t: x.task, fields: { dueDate: x.due }, label: "출시일 따라 기한" }); });
  }
  if (pTake("name", p.name || "", proj.title || "")) { pf.title = p.name; pSaid.push("이름"); }
  // 해외 하위 프로젝트: 신제품 대시보드에서만 정함 → 그대로 따라감(이름은 구조 문서에서)
  if ((p.project || "") !== (proj.lbProject || "") || (p.project && structure && lbProjName(structure, p.brand, p.project) !== (proj.lbProjectName || ""))) {
    Object.assign(pf, { lbProject: p.project || "", lbProjectName: lbProjName(structure, p.brand, p.project) }); if ((p.project || "") !== (proj.lbProject || "")) pSaid.push(p.project ? "하위 프로젝트 " + lbProjName(structure, p.brand, p.project) : "하위 프로젝트 없음"); }
  if (skipAdd.length || skipDel.length) pf.skipItems = [...new Set([...(proj.skipItems || []).filter((x) => !skipDel.includes(x)), ...skipAdd])];
  const pSeen = { launchDate: p.launchDate || "", name: p.name || "" };
  if (Object.keys(pf).length || !same(pSeen, pb)) project = { fields: { ...pf, lbSeen: pSeen }, label: pSaid.join("·") };
  return { tasks: out, project, n: out.filter((x) => x.label).length + (pSaid.length ? 1 : 0) };
}

// ── 4단계: 휴지통 · 해외 하위 프로젝트 ──
// 하위 프로젝트(아마존 JP·US·큐텐…) 이름: 신제품 대시보드 구조 문서(board-structure.projects[브랜드])에서
export const lbProjName = (structure, brand, pj) => { if (!pj) return ""; const l = ((structure && structure.projects) || {})[brand] || []; const x = l.find((y) => y && y.id === pj); return x ? x.name : pj; };
// 휴지통: 신제품 대시보드에서 지우면(deletedAt) → 업무OS 프로젝트 '중단'(지우지 않음 · 열린 업무는 접음 dropPrev + trashBy) · 되살리면 → 다시 열기(접은 업무만 이전 상태로)
//   업무OS에서 이미 끝내거나 중단한 프로젝트는 상태를 안 바꾸고 표시만(lbTrash 'kept') → 되살려도 그대로
// → { project: fields|null, tasks: [{t, fields}], label } | null
export function planLaunchTrash(p, proj, tasks, now) {
  const trashed = !!p.deletedAt;
  if (trashed && !proj.lbTrash) {
    const open = proj.status !== "completed" && proj.status !== "done" && proj.status !== "dropped" && !proj.archived;
    if (!open) return { project: { lbTrash: "kept" }, tasks: [], label: "" };
    const ts = (tasks || []).filter((t) => !t.isFixed && !t.deleted && t.status !== "done" && t.status !== "dropped");
    return { project: { status: "dropped", endPrev: proj.status || "active", dropReason: "신제품 대시보드 휴지통", droppedAt: now, droppedBy: "board", lbTrash: p.deletedAt },
      tasks: ts.map((t) => ({ t, fields: { status: "dropped", dropPrev: t.status || "todo", droppedAt: now, trashBy: "board" } })), label: "휴지통으로 · 중단" };
  }
  if (!trashed && proj.lbTrash) {
    if (proj.lbTrash === "kept") return { project: { lbTrash: null }, tasks: [], label: "" };
    const ok = proj.endPrev && !["hold", "paused", "dropped", "completed", "done"].includes(proj.endPrev) ? proj.endPrev : "active";
    const ts = (tasks || []).filter((t) => t.status === "dropped" && t.trashBy === "board");
    return { project: { status: ok, lbTrash: null, dropReason: "", resumedAt: now },
      tasks: ts.map((t) => { const s0 = t.dropPrev || "todo"; return { t, fields: { status: s0 === "dropped" ? "todo" : s0, dropPrev: null, trashBy: null } }; }), label: "휴지통에서 되살림 · 다시 열기" };
  }
  return null;
}
