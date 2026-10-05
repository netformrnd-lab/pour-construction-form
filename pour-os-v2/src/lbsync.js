// 업무OS v2 — 신제품 대시보드 → 업무OS 자동 반영 (계산만, 저장은 core.syncLaunchBoard)
// 칸마다 '마지막으로 신제품 대시보드에서 본 값'(lbSeen)을 기억해서 비교 (3-way):
//   신제품 대시보드 값 = 기억한 값 → 바뀐 것 없음
//   신제품 대시보드만 바뀜 → 업무OS 에 넣음
//   둘 다 바뀜 → 나중에 바뀐 쪽 (신제품 단계 updatedAt vs 업무OS v2At)
//   처음(기억 없음): 업무OS 에서 고친 적 없는 업무(v2At 없음)만 신제품 값으로, 고친 업무는 그대로 두고 기억만
// 신제품 대시보드의 빈 값(담당 없음 · 마감 없음)은 처음엔 업무OS 값을 지우지 않음 (자동 기한·기본 담당 유지)
import { LAUNCH_ITEMS, itemState, ownerIdsOf, launchDue, relaunch, launchItemsOf, customItems, countOf, baseTitle } from "./launch.js";
import { ownersOf, dueOf } from "./model.js";
import { countFields } from "./routine.js";

// 신제품 대시보드 상태 → 업무OS (skip = 해당 없음 → 업무는 지우지 않고 'dropped'로 접음)
export const LB2V = { todo: "todo", doing: "inprogress", done: "done", hold: "hold" };
export const V2B = { todo: "todo", inprogress: "doing", review: "doing", done: "done", hold: "hold" };   // 업무OS → 신제품 말 (3단계에서도 씀) · 확인 대기는 아직 진행 중 → 신제품에서 컨펌하면 승인
const normB = (s) => (s === "skip" ? "skip" : LB2V[s] ? s : "todo");   // req·reviewed 같은 옛 상태는 할 일
// 마감 미정: 신제품 dueTbd = 업무OS 기한 없음(자동 아님) — 둘 다 "tbd" 로 비교
export const TBD = "tbd";
export const v2Due = (t) => (t.dueAuto ? "" : dueOf(t) || TBD);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 한 업무의 신제품 대시보드 값 (상태 · 담당 번호들 · 직접 정한 마감 · 진행사항)
export function boardVals(p, it, users) {
  const s = itemState(p, it), live = (id) => (users || []).some((u) => u.id === id && u.active !== false);
  const ids = (s.ownerIds && s.ownerIds.length ? s.ownerIds.filter(live) : ownerIdsOf(s.owner, users));
  return { status: normB(s.status), owners: ids, due: s.dueTbd ? TBD : s.due || "", note: s.note || "", count: s.count || 0, at: s.updatedAt || "", doneAt: s.doneAt || "", doneBy: s.doneBy || "" };
}

// p: 신제품 대시보드 제품 · proj: 업무OS 프로젝트(lb_<id>) · tasks: 그 프로젝트 업무 전부 · now: ISO
// → { tasks:[{t, fields, label}], project: fields|null, n }
export function planLaunchSync(p, proj, tasks, users, today, now, structure) {
  const out = [], byItem = new Map((tasks || []).filter((t) => t.launchItem && !t.isFixed).map((t) => [t.launchItem, t]));
  const skipAdd = [], skipDel = [];
  launchItemsOf(structure).forEach((it) => {
    const t = byItem.get(it.id); if (!t) return;   // 업무가 없는 항목(처음부터 해당 없음 등)은 3단계·4단계에서
    const b = boardVals(p, it, users), base = t.lbSeen || null, first = !base;
    const vB = t.status === "dropped" && t.lbSkip ? "skip" : V2B[t.status] || "todo";
    const v = { owners: ownersOf(t), due: v2Due(t), note: t.memo || "" };
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
    if (!folded && (!it.target || b.status === "skip" || t.lbSkip) && take("status", b.status, vB, false)) {
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
      if (b.due === TBD) Object.assign(f, { dueDate: "", dueAuto: false });
      else if (b.due) Object.assign(f, { dueDate: b.due, dueAuto: false });
      else { const ad = launchDue(p.launchDate, it.off, today); Object.assign(f, { dueDate: ad, dueAuto: true }); }
      said.push("마감");
    }
    // 진행사항 → 메모
    if (take("note", b.note, v.note, !b.note)) { Object.assign(f, { memo: b.note, memoAt: now, memoBy: "", memoByName: "신제품 대시보드" }); said.push("진행사항"); }
    // 횟수 항목(블로그 포스팅 3회 …): 버전1 업무OS 칸(osExtra.count)에서 바뀐 횟수 → 업무 count + 제목 (n/목표) · 상태는 위 상태 칸이 같이 맞춤
    //   osExtra 는 버전1 몫이라 업무OS v2 는 읽기만(lbpush 는 안 씀) → v2 에서 센 횟수는 v2 에만 · 기억에 횟수가 없던 예전 업무는 v2 에서 고친 적 없을 때만
    //   기억이 있으면 버전1에서 바뀐 만큼(b − 기억)만 업무OS 횟수에 더함 (v2 에서 센 것은 그대로) · 상태도 합친 횟수로 (끝냄 ↔ 진행 중)
    if (it.target) { const vc = countOf(t), noBase = !base || base.count === undefined;
      const nn = noBase ? (b.count !== vc && !t.v2At ? b.count : vc) : Math.max(0, vc + (b.count - base.count));
      if (nn !== vc) { const c = countFields(t, 0, { id: "board", name: "신제품 대시보드" }, now, nn);
        ["status", "doneAt", "doneBy", "doneByName", "finishedAt"].forEach((k) => { if (k in c.fields && !(k in f)) f[k] = c.fields[k]; });
        Object.assign(f, { count: nn, title: c.fields.title }); said.push("횟수"); } }
    const seen = { status: b.status, owners: b.owners, due: b.due, note: b.note, ...(it.target ? { count: b.count } : {}) };
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
    Object.assign(pf, { lbProject: p.project || "", lbProjectName: lbProjName(structure, p.brand, p.project) }); if ((p.project || "") !== (proj.lbProject || "") && proj.lbProject !== undefined) pSaid.push(p.project ? "하위 프로젝트 " + lbProjName(structure, p.brand, p.project) : "하위 프로젝트 없음"); }
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

// ── 4단계 ③: 신제품 대시보드 '할 일 줄'(stages.<id>.tasks[]: id·note·owner·ownerIds·due·dueTbd) ↔ 업무OS 하위 업무(parentId = 그 항목 업무, lbRow = 줄 id)
// 줄에는 상태가 없음 → 하위 업무의 진행·끝냄은 업무OS 에만. 비교 칸은 내용(note)·담당(owners)·마감(due, 미정 = "tbd") — lbSeen 3-way(위와 같은 규칙)
// 신제품에서 줄을 지우면 → 하위 업무는 지우지 않고 '중단'(dropPrev · lbRowGone)
export const rowTitle = (note) => (String(note || "").split("\n").map((x) => x.trim()).find(Boolean) || "할 일").slice(0, 80);
export const rowVals = (r, users) => ({ note: String(r.note || ""), owners: Array.isArray(r.ownerIds) && r.ownerIds.length ? r.ownerIds.filter((id) => (users || []).some((u) => u.id === id)) : ownerIdsOf(r.owner, users), due: r.due || TBD });   // 할 일 줄은 자동 기한이 없어서 날짜 없음 = 미정
export const subVals = (t) => ({ note: String(t.memo || t.title || ""), owners: ownersOf(t), due: dueOf(t) || TBD });
// → { create: [doc], tasks: [{t, fields, label}] }
export function planRowSync(p, proj, tasks, users, now, structure) {
  const create = [], out = [];
  launchItemsOf(structure).forEach((it) => {
    const parent = (tasks || []).find((t) => t.launchItem === it.id && !t.isFixed); if (!parent) return;
    const rows = (((p.stages || {})[it.id] || {}).tasks || []).filter((r) => r && r.id);
    const subs = (tasks || []).filter((t) => t.parentId === parent.id && t.lbRow);
    rows.forEach((r) => {
      // 업무OS 에서 막 만든 하위 업무: 줄 번호 = 업무 번호인데 lbRow 가 아직 안 들어왔을 수 있음(다른 기기가 먼저 신호를 받음) → 새로 만들지 않고 그 업무로
      const b = rowVals(r, users), sub = subs.find((t) => t.lbRow === r.id) || (tasks || []).find((t) => t.parentId === parent.id && !t.lbRow && t.id === r.id);
      if (!sub) { const o = b.owners;
        create.push({ id: `${parent.id}__r_${r.id}`, title: rowTitle(b.note), memo: b.note, projectId: proj.id, parentId: parent.id, lbRow: r.id, isFixed: false, type: "general", status: "todo",
          assigneeId: o[0] || "", assigneeIds: o, dueDate: b.due === TBD ? "" : b.due, dueAuto: false, noReview: true, attachments: [], brand: proj.brand || "", phase: parent.phase || "",
          createdAt: now, createdBy: "board", madeIn: "launch-board", lbSeen: b }); return; }
      const base = sub.lbSeen || {}, v = subVals(sub), f = sub.lbRow ? {} : { lbRow: r.id }, said = [];
      const take = (k) => !same(b[k], base[k]) && !same(b[k], v[k]) && (same(v[k], base[k]) || !sub.v2At || (r.updatedAt || ((p.stages || {})[it.id] || {}).updatedAt || "") > sub.v2At);
      if (take("note")) { Object.assign(f, { title: rowTitle(b.note), memo: b.note }); said.push("할 일 줄 내용"); }
      if (b.owners.length && take("owners")) { Object.assign(f, { assigneeIds: b.owners, assigneeId: b.owners[0] }); said.push("할 일 줄 담당"); }
      if (take("due")) { Object.assign(f, { dueDate: b.due === TBD ? "" : b.due, dueAuto: false }); said.push("할 일 줄 마감"); }
      if (sub.status === "dropped" && sub.lbRowGone) { Object.assign(f, { status: sub.dropPrev || "todo", dropPrev: null, lbRowGone: null }); said.push("할 일 줄 되살림"); }
      if (said.length || !same(b, base)) out.push({ t: sub, fields: { ...f, lbSeen: b }, label: said.join("·") });   // 기억 = 지금 신제품 줄 값
    });
    subs.filter((t) => !rows.some((r) => r.id === t.lbRow) && t.status !== "dropped" && t.status !== "done")
      .forEach((t) => out.push({ t, fields: { status: "dropped", dropPrev: t.status || "todo", droppedAt: now, lbRowGone: true }, label: "할 일 줄 지움 · 중단" }));
  });
  return { create, tasks: out };
}

// ── 4단계 ④: 직접 추가한 단계 → 업무OS 항목 업무 (없을 때만 만들기 · 담당 = 신제품 칸 담당 → 제품 책임자 · 자동 기한) / 단계를 지우면 → 업무는 지우지 않고 중단(lbStepGone)
export function planCustomSteps(p, proj, tasks, users, structure, today, now) {
  const items = customItems(structure), have = new Set((tasks || []).filter((t) => t.launchItem).map((t) => t.launchItem)), create = [], drop = [];
  items.forEach((it) => {
    if (have.has(it.id)) return; const s = itemState(p, it); if (s.status === "skip") return;
    const ids = (s.ownerIds && s.ownerIds.length ? s.ownerIds : ownerIdsOf(s.owner, users)), owners = ids.length ? ids : proj.assigneeId ? [proj.assigneeId] : [];
    const auto = !s.due && !s.dueTbd, due = s.dueTbd ? "" : s.due || launchDue(p.launchDate, it.off, today);
    create.push({ id: `${proj.id}__${it.id}`, title: it.name, projectId: proj.id, launchItem: it.id, phase: it.phase, isFixed: false, type: "general", status: LB2V[s.status] || "todo",
      assigneeId: owners[0] || "", assigneeIds: owners, ownerAuto: !ids.length, ...(ids.length ? { ownerFrom: "board" } : { ownerFrom: "lead" }), dueDate: due, dueAuto: auto, noReview: true, memo: s.note || "",
      attachments: [], parentId: null, brand: p.brand || proj.brand || "", importedFrom: "launch-board", customStep: true, lbOff: it.off, createdAt: now, createdBy: "board",
      lbSeen: { status: normB(s.status), owners: ids, due: s.dueTbd ? TBD : s.due || "", note: s.note || "" } });
  });
  const ids = new Set(items.map((x) => x.id));
  (tasks || []).filter((t) => t.customStep && t.launchItem && !ids.has(t.launchItem) && t.status !== "dropped" && t.status !== "done")
    .forEach((t) => drop.push({ t, fields: { status: "dropped", dropPrev: t.status || "todo", droppedAt: now, lbStepGone: true } }));
  return { create, drop };
}
