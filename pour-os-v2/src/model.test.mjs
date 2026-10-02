// node src/model.test.mjs — v2 계산 로직 점검
import assert from "node:assert/strict";
import * as M from "./model.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };

ok("v1 → v2 복사: meta·savelock 은 빼고, 활동기록은 log 칸으로, 휴지통은 _tid 로", () => {
  const { ops, counts } = M.planSeed({ meta: [{ id: "x" }], savelock: [], tasks: [{ id: "t1" }, { id: "t1" }, { title: "id없음" }], activityLog: [{ id: "l1" }], trash: [{ id: "t1", _tid: "tr1" }] }, [{ id: "n1", itemId: "task:t1" }]);
  assert.deepEqual(ops.map((o) => o.key + "/" + o.id), ["tasks/t1", "tasks/t1_1", "tasks/_i2", "log/l1", "trash/tr1", "notes/n1"]);
  assert.equal(counts.tasks, 3); assert.equal(counts.log, 1); assert.equal(counts.meta, undefined);
});
ok("문서 id 에 / 가 있어도 안전하게", () => { assert.equal(M.docIdOf("x", { id: "a/b c" }, 0), "a_b_c"); });
ok("매월 31일 고정업무는 30일까지인 달엔 말일에", () => {
  const t = { isFixed: true, recurType: "monthly", monthDay: 31 };
  assert.equal(M.fxDueOn(t, "2026-09-30"), true); assert.equal(M.fxDueOn(t, "2026-10-30"), false); assert.equal(M.fxDueOn(t, "2026-10-31"), true);
});
ok("매주 월·수·금: 화요일엔 안 뜨고, 수요일 체크는 금요일 전까지만 유효", () => {
  const t = { isFixed: true, recurType: "weekly", weekDays: ["월", "수", "금"], doneDates: { a: "2026-09-30" } };
  assert.equal(M.fxDueOn(t, "2026-09-29"), false); assert.equal(M.fxDueOn(t, "2026-09-30"), true);
  assert.equal(M.fxMeDone(t, "a", "2026-10-01"), true); assert.equal(M.fxMeDone(t, "a", "2026-10-02"), false);
});
ok("체크 저장은 내 칸만 (점 경로) — 남의 체크를 덮지 않음", () => {
  const t = { subsBy: { a: [{ id: "s1", title: "x" }] } };
  const p = M.fxCheckPatch(t, "a", true, "2026-10-02", "2026-10-02T01:00:00Z", "가");
  assert.deepEqual(Object.keys(p).sort(), ["doneAt", "doneAtBy.a", "doneByName", "doneDates.a", "subDone.a.s1"]);
  const q = M.fxCheckPatch(t, "a", false, "2026-10-02", "x", "가"); assert.equal(q["doneDates.a"], null); assert.equal(q.doneAt, undefined);
});
ok("미사용 담당은 고정업무 완료 판정에서 빠짐", () => {
  const users = [{ id: "a" }, { id: "b", active: false }];
  const t = { isFixed: true, assigneeIds: ["a", "b"], doneDates: { a: "2026-10-02" } };
  assert.deepEqual(M.fxCount(users, t, "2026-10-02"), [1, 1]);
});
ok("오늘: 맡긴 일·내 일 댓글이 '확인할 것'에, 본 것은 빠짐", () => {
  const now = new Date("2026-10-02T10:00:00");
  const D = { users: [{ id: "a", name: "가" }, { id: "b", name: "나" }], projects: [{ id: "p", assigneeId: "a" }],
    tasks: [{ id: "t1", title: "맡긴 일", assigneeId: "a", status: "todo", requestedBy: "b", requestedAt: "2026-10-02T09:00:00Z" },
      { id: "t2", title: "남의 일", assigneeId: "b", status: "todo", projectId: "p" },
      { id: "t3", title: "지난 일", assigneeId: "a", status: "todo", dueDate: "2026-09-30" },
      { id: "t4", title: "먼 일", assigneeId: "a", status: "todo", dueDate: "2026-12-30" }],
    notes: [{ id: "n1", itemId: "task:t2", by: "b", at: "2026-10-02T09:30:00Z", text: "봐 주세요" }, { id: "n2", itemId: "task:t1", by: "a", at: "2026-10-02T09:31:00Z" }] };
  const v = M.todayView(D, "a", now, {});
  assert.deepEqual(v.inbox.map((x) => x.id).sort(), ["as:t1", "nt:n1"]);
  assert.equal(M.todayView(D, "a", now, { "as:t1": true }).inbox.length, 1);
  assert.deepEqual(v.focus.map((x) => x.t.id), ["t3"]);   // 먼 일·날짜 없는 일은 '모두 보기'에
  assert.equal(v.todo.length, 3);
});
ok("담당 정리 필요: 담당 없음 + 미사용 담당", () => {
  const D = { users: [{ id: "a" }, { id: "b", active: false }], tasks: [{ id: 1, status: "todo" }, { id: 2, status: "todo", assigneeId: "b" }, { id: 3, status: "done" }, { id: 4, status: "todo", assigneeId: "a" }] };
  assert.deepEqual(M.ownerIssues(D).map((x) => x.why), ["담당 없음", "미사용 담당"]);
});
ok("프로젝트 묶음: 지남·이번 달·그 뒤·없음·보류", () => {
  const g = M.projGroups([{ id: 1, dueDate: "2026-09-01" }, { id: 2, dueDate: "2026-10-20" }, { id: 3, dueDate: "2026-11-01" }, { id: 4 }, { id: 5, status: "hold" }], "2026-10-02");
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((p) => p.id)])), { late: [1], month: [2], later: [3], none: [4], hold: [5] });
});
ok("D-day 글자", () => { assert.equal(M.ddayLabel(M.ddays("2026-10-01", "2026-10-02")), "1일 지남"); assert.equal(M.ddayLabel(0), "오늘"); assert.equal(M.ddayLabel(3), "D-3"); });
console.log(`\n${n}개 모두 통과`);
