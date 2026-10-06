// node src/admin/workload.test.mjs — 관리자 일의 양(반복·프로젝트) 계산
import assert from "node:assert/strict";
import * as W from "./workload.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "a", name: "가" }, { id: "b", name: "나" }];
const fx = { id: "f1", title: "CS 확인", isFixed: true, recurType: "daily", assigneeIds: ["a"], assigneeId: "a" };
const wk = { id: "f2", title: "주간 정산", isFixed: true, recurType: "weekly", weekDays: ["금"], assigneeIds: ["a"], assigneeId: "a" };
const one = (id, due, st, extra) => ({ id, title: id, isFixed: false, status: st, assigneeId: "a", assigneeIds: ["a"], dueDate: due, ...(extra || {}) });
const D = { users, tasks: [fx, wk, one("t1", "2026-09-29", "todo"), one("t2", "2026-10-02", "todo"), one("t3", "2026-10-05", "todo"), one("t4", "2026-09-30", "done", { doneAt: "2026-09-30T03:00:00.000Z" })] };
ok("매일 고정업무: 평일만 · 지난 날 안 함 = 못 함, 오늘부터 = 남음, 체크한 날 = 함", () => {
  const days = W.fxWeek(fx, "a", "2026-09-28", "2026-10-01", [{ taskId: "f1", uid: "a", date: "2026-09-29", on: true }]);
  assert.deepEqual(days.map((d) => d.state), ["miss", "ok", "miss", "left", "left"]);
});
ok("매주(요일 하나) 고정업무: 그 주 아무 날 체크도 인정", () => {
  assert.deepEqual(W.fxWeek(wk, "a", "2026-09-28", "2026-10-05", [{ taskId: "f2", uid: "a", date: "2026-09-30", on: true }]).map((d) => d.state), ["ok"]);
});
ok("체크 기록이 없어도 버전1에서 온 마지막 체크 날(doneDates)은 인정", () => {
  assert.deepEqual(W.fxWeek({ ...fx, doneDates: { a: "2026-09-30" } }, "a", "2026-09-28", "2026-10-03", []).map((d) => d.state), ["miss", "miss", "ok", "miss", "miss"]);
});
ok("한 주: 프로젝트 = 마감 열린 일 + 끝낸 일, 지난 날 마감은 못 함 · 반복 = 고정 + 행동지표", () => {
  const ak = [{ id: "k1", name: "블로그", cyc: "W", goal: 3, who: ["a"], active: true, startDate: "2026-09-01" }, { id: "k2", name: "월간", cyc: "M", goal: 8, who: ["a"], active: true, startDate: "2026-09-01" }];
  const docs = { "2026-Q3": { w: { "2026-09-28": { k1: { n: 2, by: { a: 2 } } } } } };
  const L = W.weekLoad({ D, uid: "a", from: "2026-09-28", key: "2026-10-01", checks: [], akItems: ak, akDocs: docs });
  assert.equal(L.one.open, 2); assert.equal(L.one.late, 1); assert.equal(L.one.left, 1); assert.equal(L.one.done, 1);   // t1(9/29 지남)·t2(10/2 남음) 열림 · t4 끝냄 · t3 는 다음 주
  const k1 = L.rep.items.find((x) => x.id === "k1"), k2 = L.rep.items.find((x) => x.id === "k2");
  assert.equal(k1.due, 3); assert.equal(k1.done, 2); assert.equal(k1.left, 1);   // 이번 주라 '남음'
  assert.equal(k2.due, 2);   // 월간 8 ÷ 4
  assert.equal(L.rep.due, 5 + 1 + 3 + 2);
});
ok("지난 주 행동지표 부족분은 못 함", () => {
  const ak = [{ id: "k1", name: "블로그", cyc: "W", goal: 3, who: ["a"], active: true, startDate: "2026-09-01" }];
  const L = W.weekLoad({ D, uid: "a", from: "2026-09-21", key: "2026-10-01", checks: [], akItems: ak, akDocs: {} });
  assert.equal(L.rep.items.find((x) => x.id === "k1").miss, 3);
});
ok("2단계: 주기 확인 전(그로홈에서 온 반복 칸 빈 것)은 목록엔 있고 합계(달성률)에서만 빠짐", () => {
  const gh = { id: "g1", title: "재고관리", isFixed: true, assigneeIds: ["a"], assigneeId: "a", brand: "grohome" };
  const L = W.weekLoad({ D: { users, tasks: [fx, gh] }, uid: "a", from: "2026-09-28", key: "2026-10-01", checks: [], akItems: [], akDocs: {} });
  const g = L.rep.items.find((x) => x.id === "g1"); assert.ok(g && g.pending); assert.equal(L.rep.due, 5);
  assert.ok(!/재고관리/.test(W.topMiss(L.rep.items, 5)));
  const L2 = W.weekLoad({ D: { users, tasks: [fx, { ...gh, cycleOk: true, recurType: "daily" }] }, uid: "a", from: "2026-09-28", key: "2026-10-01", checks: [], akItems: [], akDocs: {} });
  assert.equal(L2.rep.due, 10);
});
console.log(`\n${n}개 모두 통과`);
