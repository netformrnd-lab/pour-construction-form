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
  assert.equal(M.todayView(D, "a", now, { "as:t1": true, "nt:n1": true }).inbox.length, 1);   // 맡김은 '받았어요' 전까지 남음
  assert.deepEqual(v.focus.map((x) => x.t.id), ["t3"]);   // 먼 일·날짜 없는 일은 '모두 보기'에
  assert.equal(v.todo.length, 3);
});
ok("담당 정리 필요: 담당 없음 + 미사용 담당", () => {
  const D = { users: [{ id: "a" }, { id: "b", active: false }], tasks: [{ id: 1, status: "todo" }, { id: 2, status: "todo", assigneeId: "b" }, { id: 3, status: "done" }, { id: 4, status: "todo", assigneeId: "a" }] };
  assert.deepEqual(M.ownerIssues(D).map((x) => x.why), ["담당 없음", "미사용 담당"]);
});
ok("프로젝트 묶음: 지남·이번 주·이번 달·그 뒤·없음·보류", () => {
  const g = M.projGroups([{ id: 1, dueDate: "2026-09-01" }, { id: 2, dueDate: "2026-10-20" }, { id: 3, dueDate: "2026-11-01" }, { id: 4 }, { id: 5, status: "hold" }, { id: 6, dueDate: "2026-10-04" }], "2026-10-02");
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((p) => p.id)])), { late: [1], week: [6], month: [2], later: [3], none: [4], hold: [5] });
});
ok("D-day 글자", () => { assert.equal(M.ddayLabel(M.ddays("2026-10-01", "2026-10-02")), "1일 지남"); assert.equal(M.ddayLabel(0), "오늘"); assert.equal(M.ddayLabel(3), "D-3"); });
ok("흐름: 맡긴 사람·확인 필요·기한 허락", () => {
  const D = { projects: [{ id: "p", assigneeId: "lead" }] };
  const t = { id: "x", assigneeId: "a", requestedBy: "b", status: "todo" };
  assert.equal(M.reqOf(t), "b"); assert.equal(M.needsReview(t), true); assert.equal(M.needsReview({ ...t, noReview: true }), false);
  assert.equal(M.reqOf({ assigneeId: "a", requestedBy: "a" }), "");                       // 내가 나에게 = 맡김 아님
  assert.equal(M.canSetDue(t, "a", D, false), false); assert.equal(M.canSetDue(t, "b", D, false), true); assert.equal(M.canSetDue(t, "a", D, true), true);
  const u = { id: "y", assigneeId: "a", projectId: "p", launchItem: "s07" };                 // 신제품 항목은 제품 책임자가 허락
  assert.equal(M.dueApprover(u, D), "lead"); assert.equal(M.dueApprover({ id: "w", assigneeId: "a", projectId: "p" }, D), "");   // 예전 일은 담당이 바로 assert.equal(M.canSetDue({ id: "z", assigneeId: "a" }, "a", D, false), true);
});
ok("위험 신호: 막힘 > 지남 > 확인 대기 > 오늘 > 곧 마감인데 시작 전", () => {
  const k = "2026-10-02";
  assert.equal(M.riskOf({ dueDate: "2026-10-01", blocked: { reason: "x" } }, k).k, "blocked");
  assert.equal(M.riskOf({ dueDate: "2026-10-01", status: "todo" }, k).label, "1일 지남");
  assert.equal(M.riskOf({ dueDate: "2026-10-02", status: "inprogress" }, k).k, "today");
  assert.equal(M.riskOf({ dueDate: "2026-10-04", status: "todo" }, k).k, "start");
  assert.equal(M.riskOf({ dueDate: "2026-10-04", status: "inprogress" }, k), null);
  assert.equal(M.riskOf({ dueDate: "2026-10-01", status: "done" }, k), null);
});
ok("확인할 것: 확인 요청·기한 조정·막힘은 맡긴 사람에게, 수정 요청은 담당에게", () => {
  const now = new Date("2026-10-02T10:00:00");
  const D = { users: [], projects: [], notes: [], tasks: [
    { id: "r", title: "확인", assigneeId: "a", requestedBy: "b", status: "review", reviewAt: "2026-10-02T09:00:00Z", ackAt: "x" },
    { id: "q", title: "조정", assigneeId: "a", requestedBy: "b", status: "todo", ackAt: "x", dueDate: "2026-10-03", dueReq: { date: "2026-10-06", by: "a", at: "2026-10-02T08:00:00Z" } },
    { id: "k", title: "막힘", assigneeId: "a", requestedBy: "b", status: "inprogress", blocked: { reason: "자료 없음", by: "a", at: "2026-10-02T07:00:00Z" } },
    { id: "f", title: "수정", assigneeId: "a", requestedBy: "b", status: "inprogress", feedback: { text: "색 바꿔 주세요", by: "b", at: "2026-10-02T06:00:00Z" } }] };
  assert.deepEqual(M.todayView(D, "b", now).inbox.map((x) => x.kind), ["review", "dueReq", "blocked"]);
  assert.deepEqual(M.todayView(D, "a", now).inbox.map((x) => x.kind), ["feedback"]);
  assert.equal(M.todayView(D, "a", now).ranked[0].t.id, "f");   // 지금 할 일 1순위 = 수정 요청
  const g = M.assignedByMe(D, "b", now); assert.deepEqual([g.review.length, g.dueReq.length, g.blocked.length, g.doing.length], [1, 1, 1, 1]);
});
ok("업무량: 14일 날짜별 마감 + 지남", () => {
  const D = { tasks: [{ id: 1, assigneeId: "a", status: "todo", dueDate: "2026-10-02" }, { id: 2, assigneeId: "a", status: "todo", dueDate: "2026-10-05" }, { id: 3, assigneeId: "a", status: "todo", dueDate: "2026-09-01" }, { id: 4, assigneeId: "a", status: "done", dueDate: "2026-10-05" }] };
  const w = M.workloadOf(D, "a", new Date("2026-10-02T09:00:00"));
  assert.equal(w.open, 3); assert.equal(w.late, 1); assert.equal(w.week[0].list.length, 1); assert.equal(w.week[3].list.length, 1); assert.equal(w.week[3].wd, "월");
});
ok("기한 지킨 비율", () => {
  const D = { tasks: [{ assigneeId: "a", status: "done", dueDate: "2026-10-01", doneAt: "2026-09-30T05:00:00" }, { assigneeId: "a", status: "done", dueDate: "2026-10-01", doneAt: "2026-10-02T05:00:00" }] };
  assert.deepEqual(M.onTimeOf(D, "a", new Date("2026-10-02T10:00:00")), { n: 2, ok: 1, pct: 50 });
});
ok("달력 칸: 월요일 시작, 10월 2026 = 9/28부터 5주", () => {
  const g = M.monthGrid("2026-10"); assert.equal(g[0][0].date, "2026-09-28"); assert.equal(g[0][0].out, true); assert.equal(g.length, 5); assert.equal(g[4][6].date, "2026-11-01");
  assert.equal(M.shiftMonth("2026-12", 1), "2027-01"); assert.equal(M.shiftMonth("2026-01", -1), "2025-12");
});
ok("달력 업무 거르기 (프로젝트·담당·신제품만·끝난 것)", () => {
  const D = { tasks: [{ id: 1, assigneeId: "a", status: "todo", dueDate: "2026-10-05", projectId: "p" }, { id: 2, assigneeId: "b", status: "done", dueDate: "2026-10-05", projectId: "lb_x" }, { id: 3, assigneeId: "a", status: "todo", projectId: "p" }, { id: 4, isFixed: true, assigneeId: "a", dueDate: "2026-10-05" }] };
  assert.equal(M.calItems(D, {}, "2026-10-02").length, 1); assert.equal(M.calItems(D, { showDone: true }, "2026-10-02").length, 2);
  assert.equal(M.calItems(D, { showDone: true, noTemp: new Set([2]) }, "2026-10-02").length, 1); assert.equal(M.calItems(D, { uid: "b" }, "2026-10-02").length, 0);
});
ok("프로젝트 상태: 지난 일 있으면 위험, 시작 전 있으면 주의, 아니면 순조", () => {
  const k = "2026-10-02", P = { id: "p", progress: 50, dueDate: "2026-12-01" };
  assert.equal(M.projHealth(P, { tasks: [{ projectId: "p", assigneeId: "a", status: "todo", dueDate: "2026-09-30" }] }, k).level, "위험");
  assert.equal(M.projHealth(P, { tasks: [{ projectId: "p", assigneeId: "a", status: "todo", dueDate: "2026-10-04" }] }, k).level, "주의");
  assert.equal(M.projHealth(P, { tasks: [{ projectId: "p", assigneeId: "a", status: "inprogress", dueDate: "2026-10-20" }] }, k).level, "순조");
  assert.equal(M.projHealth({ ...P, dueDate: "2026-10-06", progress: 30 }, { tasks: [{ projectId: "p", assigneeId: "a", status: "inprogress", dueDate: "2026-10-20" }] }, k).level, "위험");
});
ok("사람 일정 상태: 지난 일 3개 이상이면 위험", () => {
  const now = new Date("2026-10-02T09:00:00");
  const late = [1, 2, 3].map((i) => ({ id: i, assigneeId: "a", status: "todo", dueDate: "2026-09-2" + i }));
  assert.equal(M.personHealth({ tasks: late }, "a", now).level, "위험");
  assert.equal(M.personHealth({ tasks: [{ id: 9, assigneeId: "a", status: "inprogress", dueDate: "2026-10-09" }] }, "a", now).level, "순조");
  assert.equal(M.personHealth({ tasks: [{ id: 9, assigneeId: "a", status: "inprogress", dueDate: "2026-10-09" }] }, "a", now).weeks[1], 1);
});
ok("공휴일·주말 건너뛰기", () => {
  assert.equal(M.isOffDay("2026-10-09"), true); assert.equal(M.holidayName("2026-10-05"), "개천절 대체공휴일");
  assert.equal(M.prevWorkday("2026-10-05"), "2026-10-02"); assert.equal(M.nextWorkday("2026-10-03"), "2026-10-06"); assert.equal(M.nextWorkday("2026-10-08"), "2026-10-08");
});
ok("지금 할 일: 방금 내 차례(fresh)는 기한 7일 안이면 지난 일보다 먼저, 임시 담당은 빠짐", () => {
  const now = new Date("2026-10-02T10:00:00");
  const D = { users: [], projects: [], notes: [], tasks: [{ id: "a", title: "지난", assigneeId: "u", status: "todo", dueDate: "2026-09-30" }, { id: "b", title: "차례", assigneeId: "u", status: "todo", dueDate: "2026-10-06" }, { id: "c", title: "임시", assigneeId: "u", status: "todo", dueDate: "2026-09-01" }] };
  const v = M.todayView(D, "u", now, {}, { temp: new Set(["c"]), fresh: new Set(["b"]), inbox: [] });
  assert.deepEqual(v.ranked.map((x) => x.t.id), ["b", "a"]); assert.equal(v.freshN, 1);
});
ok("한꺼번에 맡긴 일은 한 줄로 묶음", () => {
  const D = { users: [], projects: [{ id: "p", title: "타일카펫" }], notes: [], tasks: [1, 2, 3].map((i) => ({ id: "t" + i, title: "x", projectId: "p", assigneeId: "u", status: "todo", assignedBy: "m", assignedAt: "2026-10-02T01:00:00Z", bulkId: "B1" })) };
  const v = M.todayView(D, "u", new Date("2026-10-02T10:00:00"));
  assert.equal(v.inbox.length, 1); assert.equal(v.inbox[0].kind, "bulk"); assert.equal(v.inbox[0].bulkIds.length, 3);
});
console.log(`\n${n}개 모두 통과`);
