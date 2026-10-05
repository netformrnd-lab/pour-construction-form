// 기밀 (secret.js) 계산 시험
import assert from "node:assert/strict";
import * as S from "./secret.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const U = { boss: { id: "boss", name: "대표", master: true }, lead: { id: "lead", name: "책임", master: false }, a: { id: "a", name: "담당", master: false }, b: { id: "b", name: "팀원", master: false }, c: { id: "c", name: "허용", master: false } };
const P = (f) => ({ id: "p1", title: "새 브랜드 인수", assigneeId: "lead", ...(f || {}) });
const T = (f) => ({ id: "t1", projectId: "p1", title: "인수 가격 협상", memo: "가격 3억", assigneeIds: ["a"], assigneeId: "a", dueDate: "2026-10-20", status: "todo", attachments: [{ name: "계약서.pdf" }], ...(f || {}) });
const D = (projects, tasks, extra) => ({ ready: true, users: Object.values(U), projects, tasks, notes: [{ id: "n1", itemId: "task:t1", text: "비밀 댓글" }, { id: "n2", itemId: "proj:p1", text: "프로젝트 한마디" }, { id: "n3", itemId: "task:t9", text: "다른 업무" }],
  log: [{ id: "l1", targetId: "t1", projectId: "p1", label: "인수 가격 협상 · 끝냄" }, { id: "l2", targetId: "t9", projectId: "p9", label: "다른" }], ...(extra || {}) });
const sec = (allow) => ({ secret: { on: true, allow: allow || [], by: "lead" } });

ok("기밀 아니면 그대로", () => { const v = S.redact(D([P()], [T()]), U.b); assert.equal(v.tasks[0].title, "인수 가격 협상"); assert.equal(v.lockedT.size, 0); });
ok("업무 기밀: 담당·프로젝트 책임자·허용·관리자는 봄 · 다른 팀원은 '기밀 업무'(담당·기한·상태는 그대로)", () => {
  const d = D([P()], [T(sec(["c"]))]);
  for (const u of [U.a, U.lead, U.c, U.boss]) assert.equal(S.redact(d, u).tasks[0].title, "인수 가격 협상", u.id);
  const v = S.redact(d, U.b), t = v.tasks[0];
  assert.equal(t.title, S.LOCK_T); assert.equal(t.memo, ""); assert.deepEqual(t.attachments, []); assert.equal(t.locked, true);
  assert.deepEqual(t.assigneeIds, ["a"]); assert.equal(t.dueDate, "2026-10-20"); assert.equal(t.status, "todo");
  assert.ok(!v.notes.some((x) => x.itemId === "task:t1")); assert.ok(v.notes.some((x) => x.itemId === "task:t9"));
  assert.ok(!v.log.some((l) => l.id === "l1")); assert.ok(v.log.some((l) => l.id === "l2"));
});
ok("프로젝트 기밀: 그 안 업무도 숨김 · 업무 담당은 프로젝트째 봄 · 프로젝트 한마디도 숨김", () => {
  const d = D([P(sec())], [T(), T({ id: "t2", assigneeIds: ["lead"], assigneeId: "lead", title: "실사" })]);
  const v = S.redact(d, U.b);
  assert.equal(v.projects[0].title, S.LOCK_P); assert.ok(v.tasks.every((t) => t.title === S.LOCK_T));
  assert.ok(!v.notes.some((x) => x.itemId === "proj:p1"));
  const va = S.redact(d, U.a); assert.equal(va.projects[0].title, "새 브랜드 인수"); assert.equal(va.tasks.find((t) => t.id === "t2").title, "실사");
});
ok("서버에서 따로 읽은 업무·기록도 숨김 (viewTasks · viewLogs)", () => {
  const d = S.redact(D([P(sec())], [T()]), U.b);
  assert.equal(S.viewTasks([T({ id: "old", status: "done" })], d)[0].title, S.LOCK_T);
  assert.equal(S.viewLogs([{ id: "x", projectId: "p1", targetId: "old" }], d).length, 0);
});
ok("반복(고정) 업무는 기밀 대상 아님 · 로그인 전·관리자는 원래 데이터", () => {
  const d = D([P()], [T({ isFixed: true, ...sec() })]);
  assert.equal(S.redact(d, U.b).tasks[0].title, "인수 가격 협상");
  assert.equal(S.redact(D([P(sec())], [T()]), null).projects[0].title, "새 브랜드 인수");
});
console.log(`${n}개 모두 통과`);
