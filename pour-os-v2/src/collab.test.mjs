// 협업 맵 (collab.js) 계산 시험
import assert from "node:assert/strict";
import * as X from "./collab.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const NOW = new Date("2026-10-06T10:00:00Z"), d = (k) => new Date(NOW.getTime() - k * 864e5).toISOString();
const users = [
  { id: "a", name: "김송희", role: "lead" }, { id: "b", name: "김민지" }, { id: "c", name: "양채림" }, { id: "e", name: "이란" },
  { id: "z", name: "퇴사자", active: false }, { id: "m", name: "팀원", master: false },
];
const T = (id, f) => ({ id, title: "업무 " + id, projectId: "p1", status: "todo", assigneeIds: ["a"], assigneeId: "a", isFixed: false, ...f });
const base = (tasks, extra) => ({ users, projects: [{ id: "p1", title: "가을 행사", assigneeId: "a", collaboratorIds: ["b"], status: "active" }], tasks, notes: [], log: [], ...extra });
const by = (C, a, b) => (C.pairs.find((P) => P.key === X.pairKey(a, b)) || { by: {}, total: 0 });

ok("같이 맡음: 담당 여럿 → 짝마다 1 · 나와 나 · 사용 안 하는 사람 없음", () => {
  const C = X.collabOf(base([T("t1", { assigneeIds: ["a", "b", "z", "a"] })]), { now: NOW, kinds: ["co"] });
  assert.equal(C.pairs.length, 1); assert.equal(by(C, "a", "b").by.co, 1);
  assert.ok(!C.pairs.some((P) => P.a === P.b || P.a === "z" || P.b === "z"));
});
ok("같이 맡음: 고정업무 '전체'·멈춤은 안 셈 · 여러 명 고정업무는 셈", () => {
  const C = X.collabOf(base([T("f1", { isFixed: true, assigneeIds: ["a", "c"] }), T("f2", { isFixed: true, forAll: true, assigneeIds: ["a", "b"] }), T("f3", { isFixed: true, paused: true, assigneeIds: ["b", "c"] })]), { now: NOW, kinds: ["co"] });
  assert.equal(by(C, "a", "c").by.co, 1); assert.equal(by(C, "a", "b").total, 0); assert.equal(by(C, "b", "c").total, 0);
});
ok("기간: 오래전에 끝낸 업무 · 중단 · 지운 것은 안 셈, 기간 안에 끝낸 것은 셈", () => {
  const ts = [T("old", { status: "done", finishedAt: d(40), assigneeIds: ["a", "b"] }), T("new", { status: "done", finishedAt: d(3), assigneeIds: ["a", "c"] }),
    T("drop", { status: "dropped", assigneeIds: ["a", "e"] }), T("del", { deleted: true, assigneeIds: ["b", "c"] })];
  const C = X.collabOf(base(ts), { now: NOW, kinds: ["co"] });
  assert.equal(C.pairs.length, 1); assert.equal(by(C, "a", "c").by.co, 1);
  const C90 = X.collabOf(base(ts), { now: NOW, days: 90, kinds: ["co"] });
  assert.equal(by(C90, "a", "b").by.co, 1); assert.equal(C90.partial, true); assert.equal(C.partial, false);
  assert.equal(X.collabOf(base(ts), { now: NOW, days: 7, kinds: ["co"] }).pairs.length, 1);
});
ok("맡김: 맡긴 사람 → 담당 (자기에게 맡긴 건 안 셈 · 방향 기록)", () => {
  const C = X.collabOf(base([T("t1", { requestedBy: "a", requestedAt: d(2), assigneeIds: ["b"] }), T("t2", { requestedBy: "c", assigneeIds: ["c"] })]), { now: NOW, kinds: ["req"] });
  assert.equal(C.pairs.length, 1); const P = by(C, "a", "b"); assert.equal(P.by.req, 1); assert.equal(P.items[0].from, "a"); assert.equal(P.items[0].to, "b");
});
ok("이어받음: 앞 일(deps) 담당 → 다음 일 담당 · 같은 사람이면 안 셈 · 담당 넘기기(handoff)", () => {
  const ts = [T("s1", { assigneeIds: ["a"], status: "done", finishedAt: d(5) }), T("s2", { deps: ["s1"], assigneeIds: ["b"] }), T("s3", { deps: ["s2"], assigneeIds: ["b"] }),
    T("h1", { assigneeIds: ["e"], handoff: { from: "c", to: "e", at: d(1) } }), T("h2", { assigneeIds: ["e"], handoff: { from: "c", to: "e", at: d(60) } })];
  const C = X.collabOf(base(ts), { now: NOW, kinds: ["hand"] });
  assert.equal(by(C, "a", "b").by.hand, 1); assert.equal(by(C, "c", "e").by.hand, 1); assert.equal(C.pairs.length, 2);
  assert.equal(by(C, "a", "b").items[0].prevTitle, "업무 s1");
});
ok("확인·도움 요청: reviewTo · ask · dueReq · blocked 요청마다 1 (기간 밖 요청은 안 셈)", () => {
  const ts = [T("r1", { status: "review", reviewTo: "e", reviewAt: d(1), assigneeIds: ["b"] }),
    T("q1", { assigneeIds: ["b"], ask: { by: "b", to: "e", at: d(2) }, dueReq: { by: "b", to: "e", at: d(3) }, blocked: { by: "b", to: "a", at: d(50) } })];
  const C = X.collabOf(base(ts), { now: NOW, kinds: ["ask"] });
  assert.equal(by(C, "b", "e").by.ask, 3); assert.equal(by(C, "a", "b").total, 0);
  assert.deepEqual(by(C, "b", "e").items.map((x) => x.sub).sort(), ["기한 조정", "도와주세요", "확인 받기"]);
});
ok("같은 업무 대화: 업무마다 짝마다 1번 (댓글 여러 개여도) · @ 부른 사람 · 지운 댓글·기간 밖 빼고", () => {
  const notes = [{ id: "n1", itemId: "task:t1", by: "a", at: d(1) }, { id: "n2", itemId: "task:t1", by: "b", at: d(1) }, { id: "n3", itemId: "task:t1", by: "a", at: d(0.5) },
    { id: "n4", itemId: "task:t2", by: "c", at: d(2), mentions: ["e"] }, { id: "n5", itemId: "task:t3", by: "a", at: d(2), deleted: true }, { id: "n6", itemId: "task:t3", by: "c", at: d(2) },
    { id: "n7", itemId: "task:t1", by: "c", at: d(45) }, { id: "n8", itemId: "proj:p1", by: "e", at: d(1) }];
  const C = X.collabOf(base([T("t1"), T("t2"), T("t3")], { notes }), { now: NOW, kinds: ["talk"] });
  assert.equal(by(C, "a", "b").by.talk, 1); assert.equal(by(C, "c", "e").by.talk, 1); assert.equal(C.pairs.length, 2);
});
ok("같은 프로젝트: 열린 프로젝트마다 1번(책임자 · 함께 · 업무 담당) · 끝난 프로젝트·임시 담당 빼고", () => {
  const D = base([T("t1", { assigneeIds: ["c"] }), T("t2", { assigneeIds: ["c"] }), T("x1", { projectId: "p2", assigneeIds: ["e"] })]);
  D.projects.push({ id: "p2", title: "끝남", assigneeId: "a", status: "completed" });
  const C = X.collabOf(D, { now: NOW, kinds: ["proj"] });
  assert.equal(by(C, "a", "b").by.proj, 1); assert.equal(by(C, "a", "c").by.proj, 1); assert.equal(by(C, "b", "c").by.proj, 1); assert.equal(by(C, "a", "e").total, 0);
  // 임시 담당(책임자로 채운 신제품 항목)은 진짜 담당 아님
  const C2 = X.collabOf(D, { now: NOW, idx: { preds: new Map(), temp: new Set(["t1", "t2"]) }, kinds: ["proj"] });
  assert.equal(by(C2, "a", "c").total, 0);
});
ok("6가지 합 · 사람 합 · 많은 순 · partnersOf · kindsSorted", () => {
  const ts = [T("t1", { assigneeIds: ["a", "b"], requestedBy: "e" }), T("t2", { requestedBy: "a", assigneeIds: ["b"] })];
  const C = X.collabOf(base(ts), { now: NOW });
  const ab = by(C, "a", "b"); assert.equal(ab.by.co, 1); assert.equal(ab.by.req, 1); assert.equal(ab.by.proj, 1); assert.equal(ab.total, 3); assert.equal(ab.n, 2); assert.ok(Math.abs(ab.score - 7 / 3) < 1e-9);
  assert.equal(C.pairs[0].key, "a|b");
  // 같은 프로젝트만 3개인 짝 < 맡김 2개인 짝 (가볍게)
  const D2 = base([T("r1", { requestedBy: "c", assigneeIds: ["e"] }), T("r2", { requestedBy: "c", assigneeIds: ["e"] })]);
  D2.projects = ["q1", "q2", "q3"].map((id) => ({ id, title: id, assigneeId: "a", collaboratorIds: ["b"], status: "active" }));
  const C2 = X.collabOf(D2, { now: NOW }); assert.equal(C2.pairs[0].key, "c|e"); assert.equal(by(C2, "a", "b").n, 1); assert.equal(by(C2, "a", "b").total, 3);
  const pa = C.people.find((p) => p.id === "a"); assert.equal(pa.total, C.pairs.filter((P) => P.a === "a" || P.b === "a").reduce((s, P) => s + P.total, 0));
  const ps = X.partnersOf(C, "b"); assert.equal(ps[0].id, "a"); assert.equal(ps[0].name, "김송희");
  assert.deepEqual(X.kindsSorted({ co: 1, req: 4, talk: 0 }), [["req", 4], ["co", 1]]); assert.deepEqual(X.kindsSorted({ proj: 6, hand: 3 }).map((x) => x[0]), ["hand", "proj"]);
  assert.ok(!C.people.some((p) => p.id === "z"));
});
ok("종류 고르기: kinds 만 셈", () => {
  const C = X.collabOf(base([T("t1", { assigneeIds: ["a", "b"], requestedBy: "e" })]), { now: NOW, kinds: ["req"] });
  assert.ok(C.pairs.every((P) => Object.keys(P.by).join() === "req"));
});
ok("기밀: 관리자는 다 셈 · 팀원 기준이면 못 보는 업무·프로젝트는 빠짐 · 항목에 secret 표시", () => {
  const ts = [T("s1", { assigneeIds: ["a", "b"], secret: { on: true, allow: [], by: "a" } })];
  const all = X.collabOf(base(ts), { now: NOW, kinds: ["co"], viewer: users[0] });
  assert.equal(by(all, "a", "b").by.co, 1); assert.equal(by(all, "a", "b").items[0].secret, true);
  const mem = X.collabOf(base(ts), { now: NOW, kinds: ["co"], viewer: users[5] });
  assert.equal(mem.pairs.length, 0);
});
ok("혼자 일이 많은 사람: 열린 일 많고 협업 적은 사람", () => {
  const ts = [...Array.from({ length: 6 }, (_, i) => T("c" + i, { assigneeIds: ["c"], projectId: "" })), T("ab", { assigneeIds: ["a", "b"], projectId: "" }), T("ae", { assigneeIds: ["a", "e"], projectId: "" }), T("be", { assigneeIds: ["b", "e"], projectId: "" })];
  const D = base(ts); const C = X.collabOf(D, { now: NOW });
  const L = X.loners(C, D); assert.equal(L[0].id, "c"); assert.equal(L[0].open, 6);
});
ok("원 자리: 팀 순서 · 늘 같은 자리 · 짧은 이름 · 글자 폭", () => {
  const ppl = [{ id: "x", name: "김송희", team: "2팀" }, { id: "y", name: "김소연", team: "1팀" }, { id: "w", name: "이우민", team: "1팀" }, { id: "v", name: "김채원", team: "3팀" }];
  assert.deepEqual(X.teamOrder(ppl).map((p) => p.id), ["y", "w", "x", "v"]);
  const L1 = X.circleLayout(ppl, 100, 100, 50), L2 = X.circleLayout(ppl.slice().reverse(), 100, 100, 50);
  assert.deepEqual(L1, L2); assert.equal(L1[0].id, "y"); assert.ok(Math.abs(L1[0].y - 50) < 1e-9);
  assert.equal(X.shortName("김송희"), "송희"); assert.equal(X.shortName("Ann"), "Ann");
  assert.ok(X.textW("가나", 10) === 20); assert.ok(X.clip("아주 긴 업무 제목입니다 정말로", 12, 60).endsWith("…"));
});
console.log(`\n${n}개 통과`);
