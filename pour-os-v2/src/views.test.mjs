// node src/views.test.mjs — 달력 칸 · 사람×주 · 출시 줄 · 정리 묶음 · 출시일 옮기기 미리 보기
import assert from "node:assert/strict";
import * as V from "./views.js";
import { turnIndex, turnsOf } from "./turn.js";
import { planNewLaunch } from "./launch.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "a", name: "가가" }, { id: "b", name: "나나" }, { id: "sh", name: "김송희" }];
ok("달력 칸: 건수·임시 빼기·지난 날 빨강(14일 안)·프로젝트 ▴·공휴일", () => {
  const D = { users, projects: [{ id: "lb_P", title: "P", assigneeId: "sh", dueDate: "2026-10-16", launchDate: "2026-10-16" }], tasks: [
    { id: 1, assigneeId: "a", status: "todo", dueDate: "2026-10-08" }, { id: 2, assigneeId: "a", status: "todo", dueDate: "2026-10-08", projectId: "lb_P", launchItem: "x_mall", ownerFrom: "lead" },
    { id: 3, assigneeId: "a", status: "todo", dueDate: "2026-10-01" }, { id: 4, assigneeId: "a", status: "todo", dueDate: "2026-09-01" }, { id: 5, assigneeId: "b", status: "todo", dueDate: "2026-10-08" }] };
  const idx = turnIndex(D);
  const c = V.calCells(D, idx, { uid: "a", noTemp: true }, "2026-10", "2026-10-06");
  assert.equal(c["2026-10-08"].n, 1); assert.equal(c["2026-10-08"].temp, 1); assert.equal(c["2026-10-01"].red, true); assert.equal(c["2026-10-09"].hol, "한글날");
  const t = V.calCells(D, idx, { uid: "*" }, "2026-10", "2026-10-06"); assert.equal(t["2026-10-08"].n, 3); assert.equal(t["2026-10-16"].proj.length, 1);
  assert.equal(V.calCells(D, idx, { uid: "a" }, "2026-10", "2026-10-06")["2026-10-16"].proj.length, 1);   // 내 업무가 있는 프로젝트
});
ok("사람 × 4주: 주별 마감 수, 임시 담당 따로", () => {
  const D = { users, projects: [{ id: "lb_P", assigneeId: "sh" }], tasks: [{ id: 1, assigneeId: "sh", status: "todo", dueDate: "2026-10-07", projectId: "lb_P", launchItem: "x_mall", ownerFrom: "lead" }, { id: 2, assigneeId: "sh", status: "todo", dueDate: "2026-10-15" }] };
  const rows = V.teamWeeks(D, turnIndex(D), new Date("2026-10-06T09:00:00"));
  const sh = rows.find((r) => r.u.id === "sh"); assert.deepEqual(sh.weeks.map((w) => w.n), [1, 1, 0, 0]); assert.equal(sh.weeks[0].temp, 1);
  assert.deepEqual(V.teamWeeks(D, turnIndex(D), new Date("2026-10-06T09:00:00"), true).find((r) => r.u.id === "sh").weeks.map((w) => w.n), [0, 1, 0, 0]);
});
ok("출시 줄: 출시일로 묶음, 7단계 상태, 출시일 옮기기 미리 보기는 쓰지 않고 계산만", () => {
  const D0 = { users, workflows: [], tasks: [] };
  const a = planNewLaunch({ name: "A", brand: "grohome", launchDate: "2026-11-20", leadId: "sh" }, D0, { id: "sh" }, "2026-10-02");
  const b = planNewLaunch({ name: "B", brand: "grohome", launchDate: "2026-11-20", leadId: "sh" }, D0, { id: "sh" }, "2026-10-02");
  const D = { users, projects: [a.project, b.project], tasks: [...a.tasks, ...b.tasks] };
  const L = V.lineup(D, turnIndex(D), "2026-10-02");
  assert.equal(L.length, 1); assert.equal(L[0].items.length, 2); assert.equal(L[0].items[0].phases.length, 7); assert.equal(L[0].items[0].phases[0].state, "cur");
  const pv = V.previewLaunchMove(a.project, D, "2026-11-27", "2026-10-02");
  assert.ok(pv.changes.length > 30); assert.equal(pv.sameBefore, 2); assert.equal(pv.sameAfter, 1);
});
ok("정리 묶음: 임시 담당·기한 없음·오래 지난 일, 이번 달 '날짜 없이 두기'는 빠짐", () => {
  const D = { users, projects: [{ id: "lb_P", title: "P", assigneeId: "sh" }], tasks: [
    { id: 1, assigneeId: "sh", status: "todo", projectId: "lb_P", launchItem: "x_mall", ownerFrom: "lead", dueDate: "2026-10-10" },
    { id: 2, assigneeId: "a", status: "todo" }, { id: 3, assigneeId: "a", status: "todo", tidySkip: "2026-10" }, { id: 4, assigneeId: "b", status: "todo", dueDate: "2026-07-01" }] };
  const q = V.tidyQueues(D, turnIndex(D), new Date("2026-10-06T09:00:00"));
  const by = Object.fromEntries(q.map((x) => [x.k, x.items.map((t) => t.id)]));
  assert.deepEqual(by.temp, [1]); assert.deepEqual(by.noDue, [2]); assert.deepEqual(by.old, [4]);
  assert.equal(V.groupItems(q.find((x) => x.k === "old").items, "person", D)[0].label, "나나");
});
ok("→ 내 차례 시작: 앞 일이 이미 지났으면 지난 날이 아니라 오늘에", () => {
  const D = { users, projects: [], tasks: [{ id: "A", title: "카피", assigneeId: "b", status: "todo", dueDate: "2026-09-29" }, { id: "B", title: "배너", assigneeId: "a", status: "todo", deps: ["A"], dueDate: "2026-10-12" },
    { id: "C", title: "사진", assigneeId: "b", status: "inprogress", dueDate: "2026-10-14" }, { id: "E", title: "글", assigneeId: "a", status: "todo", deps: ["C"], dueDate: "2026-10-20" }] };
  const idx = turnIndex(D), T = turnsOf(D, idx, "a", new Date("2026-10-06T10:00:00"), {}, "");
  const c = V.calCells(D, idx, { uid: "a", noTemp: true, turns: T }, "2026-10", "2026-10-06");
  assert.deepEqual(Object.entries(c).filter(([, x]) => x.turnStart).map(([d]) => d), ["2026-10-06", "2026-10-14"]);
  assert.equal(V.turnStartOf(T.byTask.get("B"), "2026-10-06"), "2026-10-06"); assert.equal(V.turnStartOf(T.byTask.get("E"), "2026-10-06"), "2026-10-14");
  assert.equal(V.turnStartOf({ state: "ready", open: [] }, "2026-10-06"), "");
});
ok("출시일 옮기기 미리 보기·하루 마감 변화: 보류 항목은 옮기지 않고 세지도 않음", () => {
  const D0 = { users, workflows: [], tasks: [] };
  const a = planNewLaunch({ name: "A", brand: "grohome", launchDate: "2026-11-20", leadId: "sh" }, D0, { id: "sh" }, "2026-10-02");
  const tasks = a.tasks.map((t) => (t.launchItem === "s07" ? { ...t, status: "hold" } : t)), D = { users, projects: [a.project], tasks };
  const pv = V.previewLaunchMove(a.project, D, "2026-11-27", "2026-10-02");
  assert.ok(!pv.changes.some((x) => x.task.launchItem === "s07"));
  const held = tasks.find((t) => t.launchItem === "s07"), { before, after } = V.dayLoadDelta(D, [{ task: held, due: "2026-10-30" }]);
  assert.deepEqual(after, before);   // 보류 항목은 표에 안 세므로 미리 보기 숫자도 그대로
});
console.log(`\n${n}개 모두 통과`);
