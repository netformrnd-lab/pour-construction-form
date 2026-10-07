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
ok("매월 31일 고정업무는 30일까지인 달엔 말일에 · 쉬는 날이면 앞 평일 (5단계)", () => {
  const t = { isFixed: true, recurType: "monthly", monthDay: 31 };
  assert.equal(M.fxDueOn(t, "2026-09-30"), true); assert.equal(M.fxDueOn(t, "2026-10-30"), true); assert.equal(M.fxDueOn(t, "2026-10-31"), false);   // 10/31 토 → 10/30 금
});
ok("5단계: 쉬는 날 규칙 하나 — 매일은 평일만 · 매주 요일이 공휴일이면 앞 평일 · 매월 1일이 공휴일이면 그 달 안 뒤 평일 · 밀림", () => {
  assert.equal(M.fxDueOn({ recurType: "daily" }, "2026-10-03"), false); assert.equal(M.fxDueOn({ recurType: "daily" }, "2026-10-02"), true);
  const fri = { recurType: "weekly", weekDays: ["금"] };
  assert.equal(M.fxDueOn(fri, "2026-10-08"), true); assert.equal(M.fxDueOn(fri, "2026-10-09"), false);   // 10/9 한글날(금) → 10/8 목
  assert.equal(M.fxDueOn({ recurType: "weekly", weekDays: ["토"] }, "2026-10-02"), true);                // 토요일로 정한 일 → 금요일
  assert.equal(M.fxDueOn({ recurType: "monthly", monthDay: 1 }, "2027-01-04"), true);                     // 1/1 신정 → 12/31 은 다른 달이라 1/4(월)
  const mon = { recurType: "weekly", weekDays: ["월"], assigneeId: "a" };
  assert.equal(M.fxMissOf(mon, "a", "2026-10-14"), "2026-10-12");                                           // 이번 주 월요일을 못 함 → 밀림
  assert.equal(M.fxMissOf(mon, "a", "2026-10-07"), "2026-10-02");                                           // 10/5(월) 대체공휴일 → 10/2(금)로 당겨진 이번 주 몫을 못 했으면 이번 주에도 밀림
  assert.equal(M.fxMissOf({ ...mon, doneDates: { a: "2026-10-13" } }, "a", "2026-10-14"), "");             // 늦게라도 하면 풀림
  assert.equal(M.fxMissOf({ recurType: "daily", assigneeId: "a" }, "a", "2026-10-07"), "");                // 매일은 밀림 없음
  const D = { users: [{ id: "a", name: "가" }], projects: [], notes: [], tasks: [{ id: "f1", title: "주간 보고", isFixed: true, ...mon }] };
  const v = M.todayView(D, "a", new Date("2026-10-14T10:00:00"));
  assert.equal(v.fixed.left.length, 1); assert.equal(v.fixed.left[0].miss, "2026-10-12"); assert.equal(v.fixed.left[0].late, true);
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
ok("프로젝트 묶음: 지남·7일 안·이번 달·그 뒤·없음·보류 (토요일에도 다음 주 초가 7일 안)", () => {
  const g = M.projGroups([{ id: 1, dueDate: "2026-09-01" }, { id: 2, dueDate: "2026-10-20" }, { id: 3, dueDate: "2026-11-01" }, { id: 4 }, { id: 5, status: "hold" }, { id: 6, dueDate: "2026-10-04" }, { id: 7, dueDate: "2026-10-09" }], "2026-10-03");
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((p) => p.id)])), { late: [1], week: [6, 7], month: [2], later: [3], none: [4], hold: [5] });
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
  assert.deepEqual(M.onTimeOf(D, "a", new Date("2026-10-02T10:00:00")), { n: 2, ok: 1, miss: 0, pct: 50 });
});
ok("달력 칸: 월요일 시작, 10월 2026 = 9/28부터 5주", () => {
  const g = M.monthGrid("2026-10"); assert.equal(g[0][0].date, "2026-09-27"); assert.equal(g[0][0].out, true); assert.equal(g.length, 5); assert.equal(g[4][6].date, "2026-10-31"); assert.equal(new Date(g[0][0].date + "T00:00:00").getDay(), 0);
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
ok("사람 일정 상태: 진짜 내 일 지난 것 5개 이상이면 위험 · 3개는 주의 · 임시 담당 신제품 항목은 안 셈", () => {
  const now = new Date("2026-10-02T09:00:00");
  const late = [1, 2, 3, 4, 5].map((i) => ({ id: i, assigneeId: "a", status: "todo", dueDate: "2026-09-2" + i }));
  assert.equal(M.personHealth({ tasks: late }, "a", now).level, "위험");
  assert.equal(M.personHealth({ tasks: late.slice(0, 3) }, "a", now).level, "주의");
  assert.equal(M.personHealth({ tasks: late.map((t) => ({ ...t, launchItem: "x_blog", ownerAuto: true, ownerFrom: "lead" })) }, "a", now).realLate, 0);
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
ok("빨강은 지남·막힘에만: 수정 요청은 빨강 아님 (꼬리표·확인할 것 줄)", () => {
  assert.equal(M.riskOf({ dueDate: "2026-10-09", status: "inprogress", feedback: { text: "x" } }, "2026-10-02").red, undefined);
  const D = { users: [], projects: [], notes: [], tasks: [{ id: "f", title: "수정", assigneeId: "a", requestedBy: "b", status: "inprogress", feedback: { text: "색", by: "b", at: "2026-10-02T06:00:00Z" } }] };
  const x = M.todayView(D, "a", new Date("2026-10-02T10:00:00")).inbox.find((i) => i.kind === "feedback"); assert.ok(x); assert.ok(!x.red);
});
ok("끝낸 일 수: 아침 9시 전(UTC 로는 전날)에 끝낸 일도 오늘로", () => {
  const now = new Date(2026, 9, 6, 10, 0), at = new Date(2026, 9, 6, 0, 30).toISOString(), y = new Date(2026, 9, 5, 23, 30).toISOString();
  const D = { users: [], projects: [], notes: [], tasks: [{ id: "t", assigneeId: "a", status: "done", doneAt: at }, { id: "u", assigneeId: "a", status: "done", doneAt: y }, { id: "r", assigneeId: "a", status: "review", reviewAt: at }] };
  assert.equal(M.todayView(D, "a", now).doneToday, 2);
});
ok("출시한 신제품: 늦은 항목이 없으면 '마감 지남'·빨강 아님, 남은 항목 기한으로 묶음", () => {
  const key = "2026-10-06", P = { id: "lb_A", title: "A", launchDate: "2026-10-02", dueDate: "2026-10-02" };
  const ts = [{ id: 1, projectId: "lb_A", status: "done", dueDate: "2026-09-30" }, { id: 2, projectId: "lb_A", status: "todo", dueDate: "2026-10-09" }, { id: 3, projectId: "lb_A", status: "todo", dueDate: "2026-10-23" }];
  const w = M.projWhen(P, ts, key); assert.deepEqual([w.date, w.n, w.late, w.launched, w.after], ["2026-10-23", 17, false, true, 4]);
  const g = M.projGroups([P], key, ts); assert.equal(g.late.length, 0); assert.equal(g.month.length, 1);
  assert.equal(M.projGroups([P], key).late.length, 1);   // 2개만 주면 예전처럼(마감 = 출시일)
  const late = [...ts, { id: 4, projectId: "lb_A", status: "todo", dueDate: "2026-10-05" }];
  assert.equal(M.projWhen(P, late, key).late, true);
  const blocked = [...ts, { id: 5, projectId: "lb_A", status: "inprogress", dueDate: "2026-10-12", blocked: { reason: "x" } }];
  assert.equal(M.projWhen(P, blocked, key).late, true);
  const allDone = ts.map((t) => ({ ...t, status: "done" }));   // 남은 항목 없음 → 출시일+21, 그날도 지났으면 '7일 안'(빨강 아님)
  assert.equal(M.projWhen(P, allDone, key).date, "2026-10-23");
  const old = { ...P, launchDate: "2026-09-01", dueDate: "2026-09-01" }; const ow = M.projWhen(old, allDone.map((t) => ({ ...t, projectId: "lb_A" })), key);
  assert.equal(ow.late, false); assert.equal(M.projGroups([old], key, allDone).week.length, 1);
  const gen = { id: "p1", dueDate: "2026-10-01" }; assert.deepEqual(M.projWhen(gen, [], key), { date: "2026-10-01", n: -5, late: true, launched: false });
  assert.deepEqual(M.projWhen({ id: "lb_B", launchDate: "2026-10-20", dueDate: "2026-10-20" }, [], key).launched, false);   // 출시 전
});
ok("다음 사람에게 한마디: 카드에 보이는 말만 댓글 줄에서 빼고, 내 일의 앞 일에 남긴 말은 프로젝트 멤버가 아니어도 받음", () => {
  const now = new Date("2026-10-06T15:00:00");
  const tasks = [{ id: "A", title: "상세", projectId: "lb_X", assigneeId: "cr", status: "done" }, { id: "B", title: "섬네일", projectId: "lb_X", assigneeId: "jh", status: "done" }, { id: "C", title: "검수", projectId: "lb_X", assigneeId: "wm", status: "inprogress" }];
  const notes = [{ id: "n1", itemId: "task:A", by: "cr", text: "v3 폴더", at: "2026-10-06T03:00:00Z", handoff: true }, { id: "n2", itemId: "task:B", by: "jh", text: "B안", at: "2026-10-06T04:00:00Z", handoff: true }, { id: "n3", itemId: "task:A", by: "cr", text: "그냥 댓글", at: "2026-10-06T03:30:00Z" }];
  const D = { users: [], projects: [{ id: "lb_X", assigneeId: "sh", collaboratorIds: [] }], tasks, notes };
  const T = { temp: new Set(), fresh: new Set(), inbox: [], shownNotes: new Set(), predIds: new Set(["A", "B"]) };
  assert.deepEqual(M.todayView(D, "wm", now, {}, T).inbox.filter((x) => x.kind === "note").map((x) => x.id).sort(), ["nt:n1", "nt:n2"]);   // 일반 댓글은 그대로 안 옴
  const T2 = { ...T, fresh: new Set(["C"]), shownNotes: new Set(["n2"]) };
  assert.deepEqual(M.todayView(D, "wm", now, {}, T2).inbox.filter((x) => x.kind === "note").map((x) => x.id), ["nt:n1"]);   // 카드에 보이는 n2 만 뺌
  assert.deepEqual(M.todayView(D, "wm", now, { "nt:n2": true }, T).inbox.filter((x) => x.kind === "note").map((x) => x.id), ["nt:n1"]);   // 카드에서 읽은 말은 다시 안 뜸
  assert.equal(M.todayView(D, "wm", now, {}, { ...T, inbox: [{ kind: "turnAgain", id: "x", at: "2026-10-06T05:00:00Z" }, { kind: "turnLate", id: "y", at: "2026-10-06T06:00:00Z" }] }).inbox[0].kind, "turnAgain");
});
ok("고정업무 매월 말일(평일): 그 달 마지막 평일 · 주말·공휴일이면 앞 평일", () => {
  const t = { recurType: "monthly", monthEnd: true, monthDay: 31 };
  assert.equal(M.monthEndWorkday("2026-10-03"), "2026-10-30");   // 10/31 토 → 10/30 금
  assert.equal(M.fxDueOn(t, "2026-10-30"), true); assert.equal(M.fxDueOn(t, "2026-10-31"), false);
  assert.equal(M.monthEndWorkday("2026-02-10"), "2026-02-27");   // 2/28 토 → 2/27 금
  assert.equal(M.fxRecurL(t), "매월 말일(평일)");
  assert.equal(M.fxDueOn({ recurType: "monthly", monthDay: 31 }, "2026-10-30"), true);   // 5단계: 31일도 쉬는 날(10/31 토)이면 앞 평일
});
ok("공휴일 2026~2028: 노동절·제헌절·대체공휴일 · 일요일 시작 달력", () => {
  ["2026-05-01", "2026-07-17", "2026-06-03", "2026-09-25", "2026-08-17", "2027-07-19", "2027-10-11", "2028-01-26", "2028-10-05"].forEach((d) => assert.equal(M.isOffDay(d), true, d));
  assert.equal(M.isOffDay("2026-09-28"), false); assert.equal(M.holidayName("2026-05-01"), "노동절");
  assert.equal(M.monthEndWorkday("2027-07-10"), "2027-07-30");
  const g = M.monthGrid("2026-11"); assert.equal(g[0][0].date, "2026-11-01"); assert.equal(g[g.length - 1][6].date, "2026-12-05");   // 11/1 일요일 → 첫 칸
});
ok("프로젝트 %: 저장된 진척 하나 · 업무 다 끝남 신호", () => {
  assert.equal(M.projPct({ progress: 104 }), 100); assert.equal(M.projPct({}), 0);
  const D = { tasks: [{ id: "a", projectId: "p", status: "done" }], users: [] };
  assert.equal(M.projHealth({ id: "p", progress: 100 }, D, "2026-10-04").allDone, true);
  assert.equal(M.projHealth({ id: "q", progress: 100 }, D, "2026-10-04").allDone, true);   // 끝낸 업무를 안 불러왔어도 100% 면 다 끝남
  assert.equal(M.projHealth({ id: "r", progress: 0 }, D, "2026-10-04").allDone, false);    // 업무가 아직 없음
  assert.equal(M.projStat({ id: "p", progress: 37 }, D.tasks, "2026-10-04").pct, 37);
});
ok("2단계: 보류·중단 상태 · 중요도 · 예상 끝나는 날 · 판단 필요 · 다시 볼 날 알림", () => {
  assert.equal(M.projOpen({ status: "dropped" }), false); assert.equal(M.projOpen({ status: "hold" }), true);
  assert.equal(M.projStLabel({ status: "dropped" }), "중단"); assert.equal(M.impOf({ priority: "x" }), "mid"); assert.equal(M.impOf({ priority: "high" }), "high");
  assert.equal(M.riskOf({ status: "hold", dueDate: "2026-09-01", holdUntil: "2026-10-12" }, "2026-10-04").label, "보류 · 10/12 다시");   // 보류는 '지남' 빨강이 아님
  const key = "2026-10-05", iso = (d) => d + "T09:00:00.000Z";
  const tasks = [...Array(4)].map((_, i) => ({ id: "d" + i, projectId: "P", status: "done", doneAt: iso("2026-10-0" + (i + 1)) }))
    .concat([...Array(6)].map((_, i) => ({ id: "o" + i, projectId: "P", status: "todo", dueDate: "2026-10-20", assigneeId: "a" })));
  const f = M.projForecast({ id: "P", dueDate: "2026-10-16" }, tasks, key);   // 4건/10평일 = 0.4/일 → 6건 15평일 (10/9 한글날 건너뜀)
  assert.equal(f.left, 6); assert.equal(f.perWeek, 2); assert.equal(f.eta, "2026-10-27"); assert.ok(f.lateBy > 0);
  assert.equal(M.projForecast({ id: "Q" }, [{ id: "x", projectId: "Q", status: "todo" }], key).eta, "");   // 속도 없음
  const users = [{ id: "a", name: "가", weekCap: 3 }, { id: "b", name: "나" }];
  const D = { users, projects: [{ id: "P", title: "중요", priority: "high", dueDate: "2026-10-16", status: "active" }, { id: "L", title: "낮음", priority: "low", status: "active" }], tasks: tasks.concat([...Array(4)].map((_, i) => ({ id: "l" + i, projectId: "L", status: "todo", dueDate: "2026-10-07", assigneeId: "a" }))) };
  const J = M.judgeOf(D, key);
  assert.deepEqual(J.pull.map((x) => x.p.id), ["P"]); assert.deepEqual(J.push.map((x) => x.p.id), ["L"]); assert.equal(J.push[0].tasks.length, 4); assert.equal(J.push[0].ppl[0].n, 4);
  const D2 = { users, projects: [{ id: "H", title: "보류P", status: "hold", holdUntil: "2026-10-05", assigneeId: "a" }], tasks: [{ id: "h1", title: "보류일", status: "hold", holdUntil: "2026-10-04", assigneeId: "a" }, { id: "h2", title: "프로젝트째", status: "hold", holdBy: "proj", holdUntil: "2026-10-01", assigneeId: "a" }], notes: [] };
  const ib = M.todayView(D2, "a", new Date("2026-10-05T10:00:00")).inbox.map((x) => x.kind + ":" + (x.taskId || x.projectId));
  assert.deepEqual(ib.sort(), ["holdDue:h1", "projHoldDue:H"]);
});
ok("3단계: 받을 사람 기본값 · 도움 요청 · 담당 바뀜 · 참조·대화한 사람에게 답", () => {
  const users = [{ id: "a", name: "가" }, { id: "b", name: "나" }, { id: "m", name: "마", master: true }, { id: "x", name: "퇴사", active: false }];
  const D0 = { users, projects: [{ id: "P", assigneeId: "b" }], tasks: [], notes: [] };
  assert.equal(M.askTo({ requestedBy: "x", projectId: "P" }, D0, "a"), "b");   // 맡긴 사람이 미사용 → 프로젝트 책임자
  assert.equal(M.askTo({ projectId: "Q" }, D0, "a"), "m");                      // 아무도 없으면 마스터
  assert.equal(M.askTo({ projectId: "P" }, D0, "b"), "m");                      // 내가 책임자면 마스터
  const at = new Date(Date.now() - 3600e3).toISOString();
  const tasks = [{ id: "t1", title: "일", assigneeId: "a", status: "inprogress", ask: { kind: "help", to: "b", by: "a", byName: "가", at, text: "봐 주세요" }, ccIds: ["m"] },
    { id: "t2", title: "넘긴 일", assigneeId: "b", assignedBy: "a", status: "inprogress", ackAt: null, handoff: { from: ["a"], to: "b", by: "a", byName: "가", at } }];
  const D = { users, projects: [], tasks, notes: [{ id: "n1", itemId: "task:t1", by: "b", byName: "나", at, text: "답" }, { id: "n0", itemId: "task:t2", by: "m", byName: "마", at, text: "물어봄" }, { id: "n2", itemId: "task:t2", by: "a", byName: "가", at, text: "대답" }] };
  const ib = (u) => M.todayView(D, u, new Date()).inbox.map((x) => x.kind + ":" + x.taskId);
  assert.ok(ib("b").includes("help:t1")); assert.ok(ib("b").includes("assigned:t2"));   // 진행 중이어도 넘겨받으면 맡김
  assert.ok(!ib("a").includes("handed:t2"));   // 내가 넘긴 건 나에게 안 뜸
  assert.ok(ib("m").includes("note:t1"));      // 참조
  assert.ok(ib("m").includes("note:t2"));      // 그 대화에 말한 사람 → 답이 옴
  const D3 = { ...D, tasks: [{ ...tasks[1], handoff: { ...tasks[1].handoff, by: "m", byName: "마" } }] };
  assert.ok(M.todayView(D3, "a", new Date()).inbox.some((x) => x.kind === "handed"));   // 이전 담당에게 '담당 바뀜'
});
ok("4단계: 이번 주(월~일) 내 완료율", () => {
  const key = "2026-10-07", iso = (d) => d + "T03:00:00.000Z";
  const D = { tasks: [{ id: "a", assigneeId: "u", status: "done", doneAt: iso("2026-10-06"), dueDate: "2026-10-06" }, { id: "b", assigneeId: "u", status: "todo", dueDate: "2026-10-06" },
    { id: "c", assigneeId: "u", status: "inprogress", dueDate: "2026-10-09" }, { id: "d", assigneeId: "u", status: "hold", dueDate: "2026-10-08" }, { id: "e", assigneeId: "u", status: "done", doneAt: iso("2026-09-30"), dueDate: "2026-09-30" }, { id: "f", assigneeId: "v", status: "todo", dueDate: "2026-10-08" }] };
  const w = M.weekMine(D, "u", key);
  assert.equal(w.ws, "2026-10-05"); assert.equal(w.total, 3); assert.equal(w.done, 1); assert.equal(w.doing, 1); assert.equal(w.late, 1); assert.equal(w.pct, 33);
});
ok("7단계: 한 사람 일 한 번에 넘기기 — 묶음 · 담당 칸 · 넘겨받음 한 줄", () => {
  const users = [{ id: "a", name: "가" }, { id: "b", name: "나" }, { id: "m", name: "마", master: true }];
  const tasks = [{ id: "1", assigneeId: "a", status: "inprogress", dueDate: "2026-10-09" }, { id: "2", assigneeId: "a", status: "todo" }, { id: "3", assigneeId: "a", status: "hold" },
    { id: "4", assigneeId: "a", status: "review" }, { id: "5", assigneeId: "a", status: "done" }, { id: "6", assigneeId: "a", status: "dropped" },
    { id: "7", assigneeIds: ["c", "a"], assigneeId: "c", status: "todo" }, { id: "f1", isFixed: true, assigneeIds: ["a", "b"] }, { id: "f2", isFixed: true, forAll: true }, { id: "9", assigneeId: "b", status: "todo" }];
  const projects = [{ id: "P", assigneeId: "a", status: "active" }, { id: "Q", assigneeId: "a", status: "completed" }, { id: "R", assigneeId: "a", status: "hold" }];
  const g = M.handOverPlan({ users, tasks, projects }, "a");
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((x) => x.id)])), { doing: ["1"], todo: ["2", "7"], hold: ["3"], review: ["4"], fixed: ["f1"], proj: ["P", "R"] });
  assert.deepEqual(M.handOverOwners(tasks[6], "a", "b"), { assigneeIds: ["c", "b"], assigneeId: "c" });   // 여러 담당이면 내 자리만
  assert.deepEqual(M.handOverOwners(tasks[7], "a", "b"), { assigneeIds: ["b"], assigneeId: "b" });       // 이미 있으면 한 번만
  assert.deepEqual(M.handOverOwners({ assigneeId: "a" }, "a", "b"), { assigneeIds: ["b"], assigneeId: "b" });
  const at = new Date(Date.now() - 600e3).toISOString(), ho = { from: ["a"], to: "b", by: "m", byName: "마", at, all: true };
  const moved = [{ id: "x1", projectId: "P", assigneeId: "b", assigneeIds: ["b"], status: "inprogress", assignedBy: "m", assignedAt: at, bulkId: "ho1", handoff: ho, ackAt: null },
    { id: "x2", projectId: "R", assigneeId: "b", assigneeIds: ["b"], status: "todo", assignedBy: "m", assignedAt: at, bulkId: "ho1", handoff: ho, ackAt: null }];
  const ib = M.todayView({ users, projects, tasks: moved, notes: [] }, "b", new Date()).inbox;
  const line = ib.filter((x) => x.kind === "bulk");
  assert.equal(line.length, 1); assert.equal(line[0].title, "가님 업무 2개 넘겨받음"); assert.equal(line[0].mine, true); assert.equal(line[0].projectId, null);
  assert.ok(!ib.some((x) => x.kind === "assigned"));   // 한 건씩 따로 안 뜸
});
ok("8단계: 기한 지킴 % — 담당이 끝낸 시각 · 확인 대기 포함 · 안 끝낸 지난 일은 못 지킴", () => {
  const now = new Date("2026-10-10T10:00:00");
  const D = { tasks: [
    { assigneeId: "a", status: "done", dueDate: "2026-10-05", finishedAt: "2026-10-05T05:00:00", doneAt: "2026-10-08T05:00:00" },   // 확인이 늦어도 담당 기준 → 지킴
    { assigneeId: "a", status: "review", dueDate: "2026-10-06", finishedAt: "2026-10-06T05:00:00" },                                  // 확인 대기 → 끝낸 것
    { assigneeId: "a", status: "todo", dueDate: "2026-10-07" },                                                                       // 안 끝낸 지난 일 → 못 지킴
    { assigneeId: "a", status: "hold", dueDate: "2026-10-07" }, { assigneeId: "a", status: "todo", dueDate: "2026-08-01" },           // 보류 · 30일 전 기한 → 빼
    { assigneeId: "a", status: "todo", dueDate: "2026-10-12" }, { assigneeId: "a", status: "todo", dueDate: "2026-10-03", launchItem: true, ownerFrom: "lead" }] };
  assert.deepEqual(M.onTimeOf(D, "a", now), { n: 3, ok: 2, miss: 1, pct: 67 });
});
ok("8단계: 2주 넘게 지난 일은 '지금 할 일' 카드를 차지하지 않음", () => {
  const key = "2026-10-20";
  assert.equal(M.focusRank({ dueDate: "2026-10-15", status: "todo" }, key), 1);      // 5일 지남 → 그대로 먼저
  assert.equal(M.focusRank({ dueDate: "2026-09-01", status: "todo" }, key), 4.5);    // 49일 지남 → 오늘·곧 마감 다음
  const D = { users: [{ id: "a" }], projects: [], notes: [], tasks: [{ id: "old", title: "오래", assigneeId: "a", status: "todo", dueDate: "2026-09-01" }, { id: "tdy", title: "오늘", assigneeId: "a", status: "todo", dueDate: key }] };
  const v = M.todayView(D, "a", new Date(key + "T10:00:00"));
  assert.equal(v.ranked[0].t.id, "tdy"); assert.equal(v.late.length, 1); assert.ok(!v.focus.some((x) => x.t.id === "old"));
});
ok("9단계: 확인 완료 · 막힘 풀림 · PIN 처음 정함 알림 · 확인할 사람에게 묻기", () => {
  const users = [{ id: "a", name: "가" }, { id: "b", name: "나" }, { id: "m", name: "마", master: true }];
  const at = new Date(Date.now() - 3600e3).toISOString();
  const tasks = [{ id: "d1", title: "끝난 일", assigneeId: "a", status: "done", approvedBy: "b", approvedAt: at, doneAt: at },
    { id: "u1", title: "풀린 일", assigneeId: "a", status: "inprogress", unblocked: { by: "b", byName: "나", at, reason: "자료 옴", was: "a", to: "b" } },
    { id: "r1", title: "확인 대기", assigneeId: "a", status: "review", reviewTo: "m", requestedBy: "b" }];
  const notes = [{ id: "n1", itemId: "task:r1", by: "b", byName: "나", at, text: "확인 부탁", to: "m" }];
  const D = { users: users.map((u) => (u.id === "b" ? { ...u, pinSetAt: at } : u)), projects: [], tasks, notes };
  const ib = (u) => M.todayView(D, u, new Date()).inbox.map((x) => x.kind + ":" + (x.taskId || x.personId));
  assert.ok(ib("a").includes("approved:d1")); assert.ok(!ib("b").includes("approved:d1"));   // 확인한 사람에겐 안 뜸
  assert.ok(ib("a").includes("unblocked:u1")); assert.ok(!ib("b").includes("unblocked:u1"));
  assert.ok(ib("m").includes("pinNew:b")); assert.ok(!ib("a").includes("pinNew:b"));          // 마스터에게만
  assert.ok(ib("m").includes("note:r1"));                                                       // 댓글 to → 확인할 사람
  const D2 = { ...D, users: D.users.map((u) => (u.id === "b" ? { ...u, pinByCode: true } : u)) };
  assert.ok(!M.todayView(D2, "m", new Date()).inbox.some((x) => x.kind === "pinNew"));          // 시작 코드로 정했으면 알림 없음
});
ok("밀림: 이번 주 월요일이 쉬는 날이라 지난 금요일로 당겨진 할 날도 이번 주 몫", () => {
  const t = { recurType: "weekly", weekDays: ["월"], assigneeId: "a", doneDates: { a: "2026-09-21" } };
  assert.equal(M.fxMissOf(t, "a", "2026-10-05"), "2026-10-02");   // 10/5 월 대체공휴일 → 10/2 금 (지난주 날짜지만 이번 주 몫)
  assert.equal(M.fxMissOf(t, "a", "2026-10-07"), "2026-10-02");
  assert.equal(M.fxMissOf({ ...t, doneDates: { a: "2026-10-02" } }, "a", "2026-10-06"), "");
  assert.equal(M.fxMissOf(t, "a", "2026-09-30"), "2026-09-28");
});
ok("체크리스트 칩(fxSubPatch): 다 켜면 끝냄 · 하나 풀면 내 끝냄만 지움 · 다른 사람 칸 그대로", () => {
  const subs = [{ id: "s1", title: "하이웍스" }, { id: "s2", title: "네이버" }, { id: "s3", title: "카톡" }];
  const k = "2026-10-06", at = "2026-10-06T01:00:00Z";
  const t0 = { recurType: "daily", assigneeIds: ["a", "b"], subsBy: { "*": subs }, subDone: { a: { s1: k, s2: k }, b: { s1: k } }, doneDates: { b: "2026-10-05" } };
  const r = M.fxSubPatch(t0, "a", "s3", k, at, "가");
  assert.equal(r.flip, true); assert.equal(r.patch["subDone.a.s3"], k); assert.equal(r.patch["doneDates.a"], k); assert.equal(r.patch["doneAtBy.a"], at); assert.equal(r.patch.doneByName, "가");
  assert.ok(!Object.keys(r.patch).some((x) => /\.b(\.|$)/.test(x)));                            // 다른 사람 칸 안 건드림
  const t1 = { ...t0, subDone: { ...t0.subDone, a: { s1: k, s2: k, s3: k } }, doneDates: { ...t0.doneDates, a: k }, doneAtBy: { a: at } };
  const u = M.fxSubPatch(t1, "a", "s2", k, at, "가");
  assert.equal(u.flip, false); assert.equal(u.patch["subDone.a.s2"], null); assert.equal(u.patch["doneDates.a"], null); assert.equal(u.patch["doneAtBy.a"], null);
  assert.ok(!("subDone.a.s1" in u.patch) && !("subDone.a.s3" in u.patch));                     // 다른 칩은 그대로
  assert.ok(!Object.keys(u.patch).some((x) => /\.b(\.|$)/.test(x)));
  const m = M.fxSubPatch(t0, "a", "s1", k, at, "가");                                            // 아직 다 안 켬 → 끝냄 그대로
  assert.equal(m.flip, null); assert.deepEqual(Object.keys(m.patch), ["subDone.a.s1"]); assert.equal(m.patch["subDone.a.s1"], null);
  // 지난주 체크는 이번 주기에 안 셈 (매주)
  const w = { recurType: "weekly", weekDays: ["화"], assigneeIds: ["a"], subsBy: { "*": subs }, subDone: { a: { s1: "2026-10-02", s2: "2026-10-02", s3: "2026-10-02" } }, doneDates: { a: "2026-10-02" } };
  assert.deepEqual(M.fxSubCount(w, "a", k), [0, 3]);
  const w1 = M.fxSubPatch(w, "a", "s1", k, at, "가"); assert.equal(w1.flip, null); assert.equal(w1.patch["subDone.a.s1"], k);
  assert.deepEqual(M.fxSubCount(t0, "a", k), [2, 3]);
});
ok("2단계 scopeOf: brand만 → brand · 없음 → unset · scope 칸이 먼저", () => {
  assert.equal(M.scopeOf({ brand: "pourstore" }), "brand"); assert.equal(M.scopeOf({}), "unset"); assert.equal(M.scopeOf({ brand: "grohome", scope: "me" }), "me");
  assert.equal(M.scopeOf({ scope: "brand", brand: "common" }), "brand"); assert.equal(M.scopeOf({ scope: "x" }), "unset");
  assert.deepEqual(M.scopeFields("me"), { scope: "me", brand: null }); assert.deepEqual(M.scopeFields("common"), { scope: "brand", brand: "common" });
});
ok("2단계 공통 운영: 가상 브랜드 이름 · 칩 목록 맨 끝 · 추천표 28개", () => {
  const BR = [{ id: "grohome", name: "그로홈", order: 2 }, { id: "pourstore", name: "POUR스토어", order: 1 }, { id: "x", name: "안 씀", active: false }];
  assert.equal(M.brandLabel("common", BR), "공통 운영"); assert.equal(M.brandLabel("pourstore", BR), "POUR스토어");
  assert.deepEqual(M.brandsWithCommon(BR).map((b) => b.id), ["pourstore", "grohome", "common"]);
  const v = Object.values(M.SCOPE_REC); assert.equal(v.length, 28);
  assert.deepEqual([v.filter((x) => x === "common").length, v.filter((x) => x === "pourstore").length, v.filter((x) => x === "me").length, v.filter((x) => x === "grohome").length], [14, 8, 4, 2]);
  assert.equal(M.scopeRec({ id: "zz", title: "오후 주문 발주" }), "common"); assert.equal(M.scopeRec({ id: "zz", title: "사진 정리" }), "");
});
ok("2단계 그로홈 주기 제안: 상시→매일 · 주 2회→매주 · 월1회→매월 · 말 없으면 null · 횟수 후보", () => {
  const g = (memo, title = "x") => M.cycleGuess({ memo: `그로홈 대시보드 고정업무 · 주기: ${memo}`, title });
  assert.equal(g("상시").rt, "daily"); assert.equal(g("주 2회").rt, "weekly"); assert.equal(g("월1회").rt, "monthly"); assert.equal(g("월 4회 주1회").rt, "weekly");
  assert.equal(M.cycleGuess({ memo: "그로홈 대시보드 고정업무", title: "브랜드커머스" }), null);
  assert.equal(M.cycleGuess({ memo: "그로홈 대시보드 고정업무", title: "오전 수동발주" }).from, "이름");
  assert.ok(M.countHint({ memo: "주기: 주 2회", title: "공식 블로그 관리" })); assert.ok(M.countHint({ title: "오픈채팅방 홍보 글 배포" })); assert.ok(!M.countHint({ memo: "주기: 상시", title: "리뷰 관리" }));
  assert.ok(M.cyclePending({ isFixed: true })); assert.ok(!M.cyclePending({ isFixed: true, recurType: "daily" })); assert.ok(!M.cyclePending({ isFixed: true, cycleOk: true }));
  assert.deepEqual(M.cycleFields("weekly"), { recurType: "weekly", weekDays: ["월"], weekDay: "월", cycleOk: true });
});
ok("2단계 오늘: 브랜드 정한 고정업무는 routine(반복 실행 카드) · 개인·미정은 fixed · 남은 일 수는 둘 다", () => {
  const now = new Date("2026-10-06T07:00:00"), base = { isFixed: true, recurType: "daily", assigneeIds: ["a"] };
  const D = { tasks: [{ ...base, id: "f1", title: "CS", brand: "common", scope: "brand" }, { ...base, id: "f2", title: "메일", scope: "me" }, { ...base, id: "f3", title: "미정" }, { ...base, id: "f4", title: "그로홈", brand: "grohome" }], users: [{ id: "a", name: "가" }], projects: [], notes: [] };
  const v = M.todayView(D, "a", now);
  assert.deepEqual(v.fixed.left.map((x) => x.t.id).sort(), ["f2", "f3"]); assert.deepEqual(v.routine.left.map((x) => x.t.id).sort(), ["f1", "f4"]); assert.equal(v.left, 4);
});
ok("없애기·휴지통(2026-10-07): 권한 · 저장 칸 · 되살리기 = 이전 멈춤 그대로 · 휴지통 줄", () => {
  const boss = { id: "s", name: "김송희", role: "lead" }, me = { id: "a", name: "가" }, other = { id: "b", name: "나" };
  const mine = { id: "f1", title: "메일", isFixed: true, scope: "me", assigneeIds: ["a"] }, rt = { id: "f2", title: "CS", isFixed: true, scope: "brand", brand: "common", assigneeIds: ["a"] }, un = { id: "f3", title: "미정", isFixed: true, assigneeIds: ["a"] };
  assert.equal(M.canRemoveFx(mine, me), true); assert.equal(M.canRemoveFx(mine, other), false); assert.equal(M.canRemoveFx(mine, boss), true);
  assert.equal(M.canRemoveFx(rt, me), false); assert.equal(M.canRemoveFx(rt, boss), true); assert.equal(M.canRemoveFx(un, me), false); assert.equal(M.canRemoveFx(un, boss), true);
  assert.equal(M.canRemoveFx({ ...mine, assigneeIds: ["b"], createdBy: "a" }, me), true);   // 만든 사람
  assert.equal(M.canRemoveFx({ id: "x", title: "업무", scope: "me", assigneeIds: ["a"] }, me), false);   // 고정업무만
  assert.equal(M.canRemoveAk(me), false); assert.equal(M.canRemoveAk(boss), true);
  const f = M.fxRemoveFields({ ...rt, paused: false }, boss, "2026-10-07T01:00:00Z");
  assert.deepEqual(f, { removed: { at: "2026-10-07T01:00:00Z", by: "s", byName: "김송희", prevPaused: false, scope: "brand" }, paused: true });
  assert.equal(M.isRemoved({ ...rt, ...f }), true); assert.equal(M.isRemoved(rt), false); assert.equal(M.isRemoved({ removed: null }), false);
  assert.deepEqual(M.fxRestoreFields({ ...rt, ...f }), { removed: null, paused: false });
  assert.deepEqual(M.fxRestoreFields({ ...rt, ...M.fxRemoveFields({ ...rt, paused: true }, boss, "x") }), { removed: null, paused: true });   // 멈춰 있던 것은 멈춤으로
  const gone = [{ ...rt, ...f }, { ...mine, ...M.fxRemoveFields(mine, me, "2026-10-07T02:00:00Z") }, { ...un, removed: { at: "2026-10-06T00:00:00Z", by: "s", byName: "김송희" } }];
  const ak = [{ id: "k1", name: "블로그", brand: "pourstore", _hidden: true, _removed: { at: "2026-10-07T03:00:00Z", by: "s", byName: "김송희" } }];
  const all = M.trashRows(gone, ak, [{ id: "pourstore", name: "POUR스토어" }]);
  assert.deepEqual(all.map((r) => r.kind + ":" + r.id), ["ak:k1", "fx:f1", "fx:f2", "fx:f3"]);   // 최근 것 먼저
  assert.equal(all[0].sub, "횟수 목표 · POUR스토어"); assert.equal(all[2].sub, "반복 실행 · 공통 운영"); assert.equal(all[1].sub, "개인 고정업무"); assert.equal(all[3].sub, "고정업무 · 브랜드 미정");
  assert.deepEqual(M.trashRows(gone, ak, [], "a").map((r) => r.id), ["f1"]);   // 내 것 = 내 개인 고정업무만 (반복 실행·횟수 목표는 관리자 휴지통)
  assert.deepEqual(M.trashRows(gone, ak, [], "b"), []);
});
ok("이름 고치기 권한: 개인 = 본인·관리자 · 반복 실행 = 관리자", () => {
  const boss = { id: "s", name: "김송희", role: "lead" }, me = { id: "a", name: "가" };
  assert.equal(M.canRenameFx({ isFixed: true, scope: "me", assigneeIds: ["a"] }, me), true); assert.equal(M.canRenameFx({ isFixed: true, scope: "brand", brand: "x", assigneeIds: ["a"] }, me), false); assert.equal(M.canRenameFx({ isFixed: true, scope: "brand", brand: "x" }, boss), true);
});
ok("업무 없애기(누구나): 권한 · 하위 업무 · 저장 칸 · 휴지통 줄 · 지우지 않음", () => {
  const me = { id: "a", name: "가" }, other = { id: "b", name: "나" };
  const t = { id: "t1", title: "시안", status: "inprogress", assigneeIds: ["a"], assigneeId: "a", projectId: "p1", requestedBy: "c" };
  assert.equal(M.canRemoveTask(t, other), true);                                  // 볼 수 있으면 누구나
  assert.equal(M.canRemoveTask({ ...t, locked: true }, other), false);            // 기밀로 잠긴 사람은 못 봄 → 못 없앰
  assert.equal(M.canRemoveTask({ ...t, isFixed: true }, me), false);              // 고정업무는 따로(canRemoveFx)
  const tasks = [t, { id: "k1", title: "안 A", parentId: "t1", option: true }, { id: "k2", title: "안 B", parentId: "t1" }, { id: "k3", title: "손자", parentId: "k1" }, { id: "x", title: "남", parentId: "zz" }, { id: "k4", parentId: "t1", removed: { at: "x" } }, { id: "k5", parentId: "t1", isFixed: true }];
  assert.deepEqual(M.taskKids(t, tasks).map((x) => x.id), ["k1", "k2", "k3"]);   // 아래로 끝까지 · 이미 없앤 것·고정업무 빼고
  assert.deepEqual(M.taskKids({ id: "a1" }, [{ id: "a2", parentId: "a1" }, { id: "a1", parentId: "a2" }]).map((x) => x.id), ["a2"]);   // 고리 막음
  const f = M.taskRemoveFields(t, other, "2026-10-07T01:00:00Z", " 중복 ", "t1", ["k1"]);
  assert.deepEqual(f, { removed: { at: "2026-10-07T01:00:00Z", by: "b", byName: "나", reason: "중복", prevStatus: "inprogress", root: "t1", kids: ["k1"] } });
  assert.equal("status" in f, false);                                              // 상태는 그대로
  assert.equal(M.isRemoved({ ...t, ...f }), true); assert.equal(M.canRestoreTask({ ...t, ...f }, me), true); assert.equal(M.canRemoveTask({ ...t, ...f }, me), false);
  const kid = { ...tasks[1], ...M.taskRemoveFields(tasks[1], other, "2026-10-07T01:00:00Z", "", "t1") };
  const old = { id: "o1", title: "옛", projectId: "p2", assigneeIds: ["z"], removed: { at: "2026-10-06T00:00:00Z", by: "z", byName: "다", reason: "", root: "o1" } };
  const rows = M.taskTrashRows([{ ...t, ...f }, kid, old], [{ id: "p1", title: "봄 신제품" }]);
  assert.deepEqual(rows.map((r) => r.id), ["t1", "o1"]);                           // 처음 없앤 업무만(하위는 같이) · 최근 것 먼저
  assert.equal(rows[0].sub, "봄 신제품 · 하위 1개 같이"); assert.equal(rows[0].reason, "중복"); assert.equal(rows[1].sub, "프로젝트 없음"); assert.equal(rows[0].kind, "task");
  assert.deepEqual(M.taskTrashRows([{ ...t, ...f }, kid, old], [], "a").map((r) => r.id), ["t1"]);   // 내 것 = 내가 담당
  assert.deepEqual(M.taskTrashRows([{ ...t, ...f }, kid, old], [], "c").map((r) => r.id), ["t1"]);   // 맡긴 사람
  assert.deepEqual(M.taskTrashRows([{ ...t, ...f }, kid, old], [], "b").map((r) => r.id), ["t1"]);   // 없앤 사람
  assert.deepEqual(M.taskTrashRows([{ ...t, ...f }, kid, old], [], "q"), []);
  assert.deepEqual(M.taskTrashRows([{ ...t, ...f }, kid, old], [], null, "p2").map((r) => r.id), ["o1"]);   // 그 프로젝트만
});
ok("업무 없앰 알림: 담당·맡긴 사람에게 '업무 없앰' (없앤 사람 본인은 없음 · 읽음 = 사라짐 · 하위는 상위 줄로 한 번)", () => {
  const now = new Date("2026-10-07T10:00:00"), at = "2026-10-07T01:00:00Z";
  const root = { id: "t1", title: "시안", status: "todo", assigneeIds: ["a"], assigneeId: "a", requestedBy: "c", removed: { at, by: "b", byName: "나", reason: "중복", root: "t1", kids: ["k1", "k2"] } };
  const k1 = { id: "k1", title: "안 A", parentId: "t1", status: "todo", assigneeIds: ["a"], removed: { at, by: "b", byName: "나", reason: "중복", root: "t1" } };
  const k2 = { id: "k2", title: "안 B", parentId: "t1", status: "todo", assigneeIds: ["d"], removed: { at, by: "b", byName: "나", reason: "중복", root: "t1" } };
  const D = { tasks: [], removedTasks: [root, k1, k2], users: [{ id: "a", name: "가" }, { id: "b", name: "나" }, { id: "c", name: "다" }, { id: "d", name: "라" }], projects: [], notes: [] };
  const ia = M.todayView(D, "a", now, {}).inbox.filter((x) => x.kind === "removed");
  assert.equal(ia.length, 1); assert.equal(ia[0].tag, "업무 없앰"); assert.equal(ia[0].taskId, "t1"); assert.equal(ia[0].keep, undefined); assert.match(ia[0].text, /^없앴어요 · 중복 · 하위 2개 같이 · 휴지통에서/); assert.equal(ia[0].whoName, "나");
  assert.equal(M.todayView(D, "c", now, {}).inbox.filter((x) => x.kind === "removed").length, 1);   // 맡긴 사람
  assert.deepEqual(M.todayView(D, "d", now, {}).inbox.filter((x) => x.kind === "removed").map((x) => x.taskId), ["k2"]);   // 하위만 담당 → 하위 줄
  assert.equal(M.todayView(D, "b", now, {}).inbox.filter((x) => x.kind === "removed").length, 0);   // 없앤 사람 본인
  assert.equal(M.todayView(D, "a", now, { [ia[0].id]: true }).inbox.filter((x) => x.kind === "removed").length, 0);   // 읽음
});
ok("댓글 고치며 새로 부른 사람: 고친 때 기준 새 줄 (이미 읽은 댓글이어도)", () => {
  const now = new Date("2026-10-07T10:00:00");
  const n = { id: "n1", itemId: "proj:p1", by: "b", byName: "나", at: "2026-09-20T00:00:00Z", text: "@가 봐 주세요", mentions: ["a"], mentionedAt: { a: "2026-10-07T01:00:00Z" }, editedAt: "2026-10-07T01:00:00Z", editedBy: "b", editedByName: "나" };
  const D = { tasks: [], users: [{ id: "a", name: "가" }, { id: "b", name: "나" }], projects: [{ id: "p1", title: "P" }], notes: [n] };
  const v = M.todayView(D, "a", now, { "nt:n1": true }).inbox.filter((x) => x.kind === "mention");
  assert.equal(v.length, 1); assert.equal(v[0].id, "nt:n1:2026-10-07T01:00:00Z"); assert.equal(v[0].at, "2026-10-07T01:00:00Z");
  assert.equal(M.todayView({ ...D, notes: [{ ...n, mentionedAt: null }] }, "a", now, {}).inbox.filter((x) => x.kind === "mention").length, 0);   // 처음 쓴 지 7일 넘음 → 안 뜸
});
console.log(`\n${n}개 모두 통과`);
ok("프로젝트 없애기: 책임자·관리자만 · 저장 칸 · 같이 없앤 업무만 되살림 · 휴지통 줄", () => {
  const lead = { id: "a", name: "가" }, other = { id: "b", name: "나" }, admin = { id: "m", name: "관", master: true };
  const p = { id: "p1", title: "봄 신제품", status: "active", assigneeId: "a", collaboratorIds: ["c"] };
  assert.equal(M.canRemoveProj(p, lead), true); assert.equal(M.canRemoveProj(p, admin), true); assert.equal(M.canRemoveProj(p, other), false);
  assert.equal(M.canRemoveProj({ ...p, locked: true }, admin), false);
  const f = M.projRemoveFields(p, lead, "2026-10-07T01:00:00Z", " 중복 ", 3);
  assert.deepEqual(f, { removed: { at: "2026-10-07T01:00:00Z", by: "a", byName: "가", reason: "중복", prevStatus: "active", n: 3 } });
  const rp = { ...p, ...f };
  assert.equal(M.canRemoveProj(rp, lead), false); assert.equal(M.canRestoreProj(rp, lead), true); assert.equal(M.canRestoreProj(rp, other), false);
  const t = { id: "t1", status: "inprogress", projectId: "p1" }, tf = M.projTaskRemoveFields(t, lead, "2026-10-07T01:00:00Z", "", "p1");
  assert.equal(tf.removed.root, "p1"); assert.equal(tf.removed.proj, true); assert.equal(tf.removed.prevStatus, "inprogress");
  assert.equal(M.projTaskBack({ ...t, ...tf }, rp), true);
  assert.equal(M.projTaskBack({ ...t, removed: { at: "2026-10-01T00:00:00Z", root: "t1" } }, rp), false);   // 그 전에 따로 없앤 업무는 그대로
  assert.equal(M.canRestoreTask({ ...t, ...tf }, admin), false);                                            // 프로젝트째 없앤 업무는 업무만 못 되살림
  const rows = M.projTrashRows([rp]); assert.equal(rows.length, 1); assert.equal(rows[0].kind, "proj"); assert.equal(rows[0].sub, "프로젝트 · 업무 3개 같이"); assert.equal(rows[0].reason, "중복");
  assert.equal(M.projTrashRows([rp], "c").length, 1); assert.equal(M.projTrashRows([rp], "z").length, 0);
});
ok("끝냄: 담당 + 관리자(모든 업무) · 다른 팀원은 못 함", () => {
  const t = { id: "t1", status: "todo", assigneeId: "a", assigneeIds: ["a"] };
  assert.equal(M.canFinish(t, { id: "a" }), true); assert.equal(M.canFinish(t, { id: "b", name: "나" }), false); assert.equal(M.canFinish(t, { id: "m", master: true }), true);
  assert.equal(M.canFinish({ ...t, isFixed: true }, { id: "m", master: true }), false); assert.equal(M.canFinish({ ...t, locked: true }, { id: "m", master: true }), false);
});
