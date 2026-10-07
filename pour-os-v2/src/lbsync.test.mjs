// 신제품 대시보드 → 업무OS 자동 반영 (lbsync.planLaunchSync) 계산 시험
import assert from "node:assert/strict";
import * as S from "./lbsync.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "minji", name: "김민지" }, { id: "wm", name: "이우민" }, { id: "jh", name: "용정하" }];
const today = "2026-10-05", now = "2026-10-05T03:00:00.000Z";
const P = (stages, extra) => ({ id: "P", name: "제품", launchDate: "2026-11-20", stages, ...(extra || {}) });
const T = (item, f) => ({ id: "lb_P__" + item, projectId: "lb_P", launchItem: item, status: "todo", assigneeId: "wm", assigneeIds: ["wm"], dueDate: "2026-10-20", dueAuto: true, memo: "", ...(f || {}) });
const proj = (f) => ({ id: "lb_P", title: "제품", launchDate: "2026-11-20", dueDate: "2026-11-20", skipItems: [], ...(f || {}) });
const one = (r, item) => r.tasks.find((x) => x.t.launchItem === item);

ok("처음: 업무OS 에서 안 고친 업무는 신제품 값으로 (완료·담당) · 빈 마감은 자동 기한 그대로", () => {
  const r = S.planLaunchSync(P({ d01: { status: "done", owner: "민지", ownerIds: ["minji"], doneAt: "2026-10-02T01:00:00Z", doneBy: "민지" } }), proj(), [T("d01")], users, today, now);
  const f = one(r, "d01").fields;
  assert.equal(f.status, "done"); assert.deepEqual(f.assigneeIds, ["minji"]); assert.equal(f.doneByName, "민지");
  assert.ok(!("dueDate" in f)); assert.deepEqual(f.lbSeen, { status: "done", owners: ["minji"], due: "", note: "" });
});
ok("처음: 업무OS 에서 고친 업무는 그대로 두고 기억만", () => {
  const r = S.planLaunchSync(P({ d01: { status: "done", owner: "민지" } }), proj(), [T("d01", { v2At: "2026-10-04T00:00:00Z", status: "inprogress" })], users, today, now);
  const f = one(r, "d01").fields; assert.deepEqual(Object.keys(f), ["lbSeen"]);
});
ok("기억 뒤: 신제품만 바뀌면 넣음 (할 일 → 진행 중 · 마감 직접 정함)", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "" };
  const r = S.planLaunchSync(P({ d01: { status: "doing", owner: "이우민", due: "2026-10-15" } }), proj(), [T("d01", { lbSeen: base, v2At: "2026-10-01T00:00:00Z" })], users, today, now);
  const f = one(r, "d01").fields; assert.equal(f.status, "inprogress"); assert.equal(f.dueDate, "2026-10-15"); assert.equal(f.dueAuto, false);
});
ok("둘 다 바뀜: 나중에 바뀐 쪽 (진행사항 ↔ 메모)", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "옛 메모" };
  const late = S.planLaunchSync(P({ d01: { status: "todo", owner: "이우민", note: "신제품에서 고침", updatedAt: "2026-10-05T02:00:00Z" } }), proj(), [T("d01", { lbSeen: base, memo: "업무OS에서 고침", v2At: "2026-10-05T01:00:00Z" })], users, today, now);
  assert.equal(one(late, "d01").fields.memo, "신제품에서 고침");
  const early = S.planLaunchSync(P({ d01: { status: "todo", owner: "이우민", note: "신제품에서 고침", updatedAt: "2026-10-05T00:00:00Z" } }), proj(), [T("d01", { lbSeen: base, memo: "업무OS에서 고침", v2At: "2026-10-05T01:00:00Z" })], users, today, now);
  assert.ok(!("memo" in one(early, "d01").fields)); assert.equal(one(early, "d01").fields.lbSeen.note, "신제품에서 고침");
});
ok("확인 대기 = 신제품 '진행 중' · 신제품에서 컨펌 누르면 승인(끝냄) · 신제품에서 담당 비우면 업무OS 담당 그대로", () => {
  const base = { status: "doing", owners: ["wm"], due: "", note: "" };
  const same = S.planLaunchSync(P({ d01: { status: "doing", owner: "" } }), proj(), [T("d01", { lbSeen: base, status: "review", v2At: "2026-10-05T01:00:00Z" })], users, today, now);
  assert.ok(!same.tasks.length || !("status" in one(same, "d01").fields));
  const r = S.planLaunchSync(P({ d01: { status: "done", owner: "" } }), proj(), [T("d01", { lbSeen: base, status: "review", v2At: "2026-10-05T01:00:00Z" })], users, today, now);
  const f = one(r, "d01").fields; assert.equal(f.status, "done"); assert.equal(f.reviewAt, null); assert.ok(!("assigneeIds" in f));
});
ok("해당 없음 → 업무 접기(지우지 않음) + skipItems · 되살리면 다시", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "" };
  const r = S.planLaunchSync(P({ d01: { status: "skip", owner: "이우민" } }), proj(), [T("d01", { lbSeen: base })], users, today, now);
  assert.equal(one(r, "d01").fields.status, "dropped"); assert.equal(one(r, "d01").fields.lbSkip, true); assert.deepEqual(r.project.fields.skipItems, ["d01"]);
  const r2 = S.planLaunchSync(P({ d01: { status: "todo", owner: "이우민" } }), proj({ skipItems: ["d01"] }), [T("d01", { status: "dropped", lbSkip: true, lbSeen: { ...base, status: "skip" } })], users, today, now);
  assert.equal(one(r2, "d01").fields.status, "todo"); assert.deepEqual(r2.project.fields.skipItems, []);
});
ok("출시일 바뀜 → 프로젝트 출시일 + 자동 기한 업무만 옮김", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "" };
  const r = S.planLaunchSync(P({ d01: { status: "todo", owner: "이우민" }, s03: { status: "todo", owner: "이우민", due: "2026-10-30" } }, { launchDate: "2026-12-04" }),
    proj({ lbSeen: { launchDate: "2026-11-20", name: "제품" } }), [T("d01", { lbSeen: base }), T("s03", { lbSeen: { ...base, due: "2026-10-30" }, dueDate: "2026-10-30", dueAuto: false })], users, today, now);
  assert.equal(r.project.fields.launchDate, "2026-12-04"); assert.ok(one(r, "d01").fields.dueDate > "2026-10-20"); assert.ok(!one(r, "s03") || !("dueDate" in one(r, "s03").fields));
});
ok("프로젝트째 보류로 접힌 업무는 상태를 안 건드림", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "" };
  const r = S.planLaunchSync(P({ d01: { status: "doing", owner: "이우민" } }), proj(), [T("d01", { lbSeen: base, status: "hold", holdBy: "proj" })], users, today, now);
  assert.ok(!("status" in one(r, "d01").fields)); assert.equal(one(r, "d01").fields.lbSeen.status, "doing");
});
ok("바뀐 것 없으면 쓸 것 없음", () => {
  const base = { status: "todo", owners: ["wm"], due: "", note: "" };
  const r = S.planLaunchSync(P({ d01: { status: "todo", owner: "이우민" } }), proj({ lbSeen: { launchDate: "2026-11-20", name: "제품" } }), [T("d01", { lbSeen: base })], users, today, now);
  assert.equal(r.tasks.length, 0); assert.equal(r.project, null);
});
ok("휴지통: 지우면 프로젝트 중단 + 열린 업무 접음(끝낸 일 그대로) · 되살리면 접은 것만 이전 상태로", () => {
  const ts = [T("d01", { status: "inprogress" }), T("d02", { status: "done" }), T("d03", { status: "dropped", dropPrev: "todo" })];
  const a = S.planLaunchTrash(P({}, { deletedAt: "2026-10-05T01:00:00Z" }), proj({ status: "active" }), ts, now);
  assert.equal(a.project.status, "dropped"); assert.equal(a.project.lbTrash, "2026-10-05T01:00:00Z"); assert.equal(a.tasks.length, 1);
  assert.deepEqual(a.tasks[0].fields, { status: "dropped", dropPrev: "inprogress", droppedAt: now, trashBy: "board" });
  const folded = [{ ...ts[0], ...a.tasks[0].fields }, ts[1], ts[2]];
  const b = S.planLaunchTrash(P({}), proj({ ...a.project }), folded, now);
  assert.equal(b.project.status, "active"); assert.equal(b.project.lbTrash, null); assert.equal(b.tasks.length, 1); assert.equal(b.tasks[0].fields.status, "inprogress");
  assert.equal(S.planLaunchTrash(P({}), proj({ status: "active" }), ts, now), null);
});
ok("휴지통: 업무OS에서 이미 끝낸 프로젝트는 상태 그대로(표시만) · 되살려도 그대로", () => {
  const a = S.planLaunchTrash(P({}, { deletedAt: "x" }), proj({ status: "completed" }), [], now);
  assert.deepEqual(a.project, { lbTrash: "kept" }); assert.equal(S.planLaunchTrash(P({}), proj({ status: "completed", lbTrash: "kept" }), [], now).project.lbTrash, null);
});
ok("해외 하위 프로젝트: 신제품 대시보드 값 + 구조 문서 이름을 따라감", () => {
  const st = { projects: { grohome: [{ id: "amazon-jp", name: "아마존 JP" }] } };
  const r = S.planLaunchSync(P({}, { brand: "grohome", project: "amazon-jp" }), proj({ lbSeen: { launchDate: "2026-11-20", name: "제품" } }), [], users, today, now, st);
  assert.equal(r.project.fields.lbProject, "amazon-jp"); assert.equal(r.project.fields.lbProjectName, "아마존 JP");
  const z = S.planLaunchSync(P({}, { brand: "grohome", project: "amazon-jp" }), proj({ lbSeen: { launchDate: "2026-11-20", name: "제품" }, lbProject: "amazon-jp", lbProjectName: "아마존 JP" }), [], users, today, now, st);
  assert.equal(z.project, null);
});
ok("할 일 줄 → 하위 업무: 새 줄은 만들기(제목 = 첫 줄) · 내용·담당·마감 바뀌면 따라감 · 줄을 지우면 중단(지우지 않음)", () => {
  const parent = T("s12", { lbSeen: { status: "todo", owners: ["wm"], due: "", note: "" } });
  const row = { id: "r1", note: "[3팀] 아마존 US 입고\n상표 대기", owner: "민지", ownerIds: ["minji"], due: "2026-10-30", dueTbd: false };
  const a = S.planRowSync(P({ s12: { tasks: [row] } }), proj(), [parent], users, now);
  assert.equal(a.create.length, 1); const d = a.create[0];
  assert.equal(d.title, "[3팀] 아마존 US 입고"); assert.equal(d.memo, row.note); assert.equal(d.parentId, parent.id); assert.deepEqual(d.assigneeIds, ["minji"]); assert.equal(d.dueDate, "2026-10-30"); assert.equal(d.lbRow, "r1");
  const b = S.planRowSync(P({ s12: { tasks: [{ ...row, note: "바뀐 내용", dueTbd: true, due: "" }] } }), proj(), [parent, d], users, now);
  assert.equal(b.tasks[0].fields.title, "바뀐 내용"); assert.equal(b.tasks[0].fields.dueDate, ""); assert.equal(b.tasks[0].fields.lbSeen.due, "tbd");
  const c = S.planRowSync(P({ s12: { tasks: [] } }), proj(), [parent, d], users, now);
  assert.equal(c.tasks[0].fields.status, "dropped"); assert.equal(c.tasks[0].fields.lbRowGone, true);
  assert.deepEqual(S.planRowSync(P({ s12: { tasks: [row] } }), proj(), [parent, d], users, now).tasks, []);
});
ok("직접 추가한 단계: 업무 없으면 만들기(영역 단계·앞 단계 기준 자동 기한·책임자 기본 담당) · 해당 없음이면 안 만듦 · 단계를 지우면 중단", () => {
  const st = { custom: { c1: { name: "수입 통관" } }, order: { P2: ["d01", "s03", "c1"] } };
  const a = S.planCustomSteps(P({}), proj({ assigneeId: "minji" }), [], users, st, today, now);
  assert.equal(a.create.length, 1); const d = a.create[0];
  assert.equal(d.id, "lb_P__c1"); assert.equal(d.title, "수입 통관"); assert.equal(d.phase, "pack"); assert.deepEqual(d.assigneeIds, ["minji"]); assert.equal(d.ownerAuto, true); assert.equal(d.dueAuto, true); assert.ok(d.dueDate); assert.equal(d.customStep, true);
  assert.equal(S.planCustomSteps(P({ c1: { status: "skip" } }), proj(), [], users, st, today, now).create.length, 0);
  assert.equal(S.planCustomSteps(P({}), proj(), [d], users, st, today, now).create.length, 0);
  const g = S.planCustomSteps(P({}), proj(), [d], users, { custom: {}, order: {} }, today, now);
  assert.equal(g.drop.length, 1); assert.equal(g.drop[0].fields.status, "dropped"); assert.equal(g.drop[0].fields.lbStepGone, true);
});
ok("직접 추가한 단계도 상태·담당 양쪽 반영 (구조 문서를 넘기면)", () => {
  const st = { custom: { c1: { name: "수입 통관" } }, order: { P2: ["c1"] } };
  const t = { id: "lb_P__c1", projectId: "lb_P", launchItem: "c1", status: "todo", assigneeIds: ["wm"], assigneeId: "wm", dueDate: "2026-10-20", dueAuto: true, memo: "", lbSeen: { status: "todo", owners: [], due: "", note: "" } };
  const r = S.planLaunchSync(P({ c1: { status: "done", owner: "민지", ownerIds: ["minji"] } }), proj(), [t], users, today, now, st);
  assert.equal(r.tasks[0].fields.status, "done");
});
ok("없앤 업무(누구나 없애기): 신제품 값으로 안 고침 · 다시 만들지 않음 · 줄 지워도 중단 안 씀 · 휴지통 접기에서도 빼기", () => {
  const rm = { at: "2026-10-07T00:00:00Z", by: "a", byName: "가", root: "x" };
  const r = S.planLaunchSync(P({ d01: { status: "done", owner: "민지", ownerIds: ["minji"] } }), proj(), [T("d01", { removed: rm })], users, today, now);
  assert.equal(r.tasks.length, 0);                                                   // 상태·담당 안 씀
  const parent = T("s12", { lbSeen: { status: "todo", owners: ["wm"], due: "", note: "" } }), row = { id: "r1", note: "할 일", owner: "민지", ownerIds: ["minji"], due: "2026-10-30" };
  const sub = { id: "lb_P__s12__r_r1", parentId: parent.id, lbRow: "r1", status: "todo", title: "옛", memo: "옛", removed: rm };
  const a = S.planRowSync(P({ s12: { tasks: [row] } }), proj(), [parent, sub], users, now);
  assert.equal(a.create.length, 0); assert.equal(a.tasks.length, 0);                // 없앤 하위 업무를 새로 만들지도 고치지도 않음
  assert.equal(S.planRowSync(P({ s12: { tasks: [] } }), proj(), [parent, sub], users, now).tasks.length, 0);   // 줄 지움 → 중단 안 씀
  const gp = S.planRowSync(P({ s12: { tasks: [row] } }), proj(), [{ ...parent, removed: rm }], users, now);
  assert.equal(gp.create.length, 0);                                                 // 없앤 항목 아래로 줄을 만들지 않음
  const st = { custom: { c1: { name: "수입 통관" } }, order: { P2: ["c1"] } }, c1 = { id: "lb_P__c1", launchItem: "c1", customStep: true, status: "todo", removed: rm };
  assert.equal(S.planCustomSteps(P({}), proj(), [c1], users, st, today, now).create.length, 0);   // 없앤 단계 업무 다시 안 만듦
  assert.equal(S.planCustomSteps(P({}), proj(), [c1], users, { custom: {}, order: {} }, today, now).drop.length, 0);
  const tr = S.planLaunchTrash(P({}, { deletedAt: "2026-10-07T00:00:00Z" }), proj({ status: "active" }), [T("d01", { removed: rm }), T("d02")], now);
  assert.deepEqual(tr.tasks.map((x) => x.t.launchItem), ["d02"]);
});
console.log(`\n${n}개 모두 통과`);
