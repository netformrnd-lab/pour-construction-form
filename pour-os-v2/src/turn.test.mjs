// node src/turn.test.mjs — 앞사람 → 내 차례 계산 점검
import assert from "node:assert/strict";
import * as R from "./turn.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const now = new Date("2026-10-06T10:00:00"), since = "2026-10-01T00:00:00Z";
const users = [{ id: "cr", name: "양채림" }, { id: "wm", name: "이우민" }, { id: "jh", name: "용정하" }, { id: "sh", name: "김송희" }, { id: "off", name: "퇴사", active: false }];
const P = { id: "lb_X", title: "목재 페인트", assigneeId: "sh" };
const T = (item, o) => ({ id: `lb_X__${item}`, title: item, projectId: "lb_X", launchItem: item, status: "todo", assigneeId: "wm", assigneeIds: ["wm"], ...o });
const run = (tasks, uid, seen = {}, s = since) => { const D = { users, projects: [P], tasks }; const idx = R.turnIndex(D); return { D, idx, r: R.turnsOf(D, idx, uid, now, seen, s) }; };

ok("① 앞 일이 확인 대기(review)여도 끝난 것으로 → 이제 내 차례", () => {
  const { r } = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], status: "review", finishedAt: "2026-10-06T08:00:00Z" }), T("s06", { status: "done", assigneeId: "jh", assigneeIds: ["jh"], finishedAt: "2026-10-02T00:00:00Z" }), T("s08", { dueDate: "2026-10-09" })], "wm");
  assert.equal(r.byTask.get("lb_X__s08").state, "ready"); assert.ok(r.fresh.has("lb_X__s08"));
});
ok("② 불러온 범위에 없는 앞 항목은 거슬러 올라감 (s08 ← s07 없음 → s06·s01)", () => {
  const { idx, D } = run([T("s06", { status: "inprogress", assigneeId: "jh", assigneeIds: ["jh"] }), T("s08")], "wm");
  assert.deepEqual(R.predsOf(D.tasks[1], idx).map((x) => x.id), ["lb_X__s06"]);
});
ok("③ deps: [] 는 순서표보다 먼저 ('앞 일 없음')", () => {
  const { r } = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"] }), T("s08", { deps: [] })], "wm");
  assert.equal(r.byTask.has("lb_X__s08"), false);
});
ok("④ 같은 사람이 이어서 하는 단계는 알림 없음", () => {
  const { r } = run([T("p01", { status: "done", assigneeId: "jh", assigneeIds: ["jh"], finishedAt: "2026-10-05T00:00:00Z" }), T("p02", { assigneeId: "jh", assigneeIds: ["jh"] })], "jh");
  assert.equal(r.byTask.get("lb_X__p02").state, "ready"); assert.equal(r.fresh.size, 0);
});
ok("⑤ 끝낸 시각을 모르면(가져온 항목 statusLog 없음) 알림 없이 '내 차례'만", () => {
  const { r } = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], status: "done" }), T("s08")], "wm");
  assert.equal(r.byTask.get("lb_X__s08").state, "ready"); assert.equal(r.fresh.size, 0);
});
ok("⑥ 기능을 처음 연 시각(since) 전에 끝난 앞 일은 알림 없음 · 본 것도 없음", () => {
  const tasks = [T("s07", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-09-30T00:00:00Z" }), T("s08")];
  assert.equal(run(tasks, "wm").r.fresh.size, 0);
  const t2 = [T("s07", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-10-05T00:00:00Z" }), T("s08")];
  assert.equal(run(t2, "wm", { "tn:lb_X__s08:lb_X__s07": true }).r.fresh.size, 0);
});
ok("⑦ 내 일이 이미 하는 중이면 기다림 표시 없음 (관리자 '순서 꼬임 라'로)", () => {
  const tasks = [T("s07", { assigneeId: "cr", assigneeIds: ["cr"] }), T("s08", { status: "inprogress" })];
  const { r, D, idx } = run(tasks, "wm");
  assert.notEqual(r.byTask.get("lb_X__s08").state, "wait");
  assert.equal(R.orderIssues(D, idx, "2026-10-06").d.length, 1);
});
ok("⑧ 순서 꼬임은 '앞 일 끝 예정 > 내 기한'만, 둘 다 자동 기한이면 뺌", () => {
  const a = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-10", dueAuto: true }), T("s08", { dueDate: "2026-10-09", dueAuto: true })], "wm");
  assert.equal(a.r.inbox.filter((x) => x.kind === "turnOrder").length, 0);
  const b = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-10", dueAuto: true }), T("s08", { dueDate: "2026-10-09", dueAuto: false })], "wm");
  assert.equal(b.r.inbox.filter((x) => x.kind === "turnOrder").length, 1);
  const c = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-09" }), T("s08", { dueDate: "2026-10-09" })], "wm");
  assert.equal(c.r.inbox.filter((x) => x.kind === "turnOrder").length, 0);   // 같은 날은 꼬임 아님
});
ok("⑨ 곧 내 차례 = 남은 앞 일 1개가 하는 중일 때 (묶어서)", () => {
  const { r } = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], status: "inprogress" }), T("s08", { dueDate: "2026-10-12" })], "wm");
  assert.equal(r.soon.length, 1); assert.equal(r.soon[0].who, "cr"); assert.equal(r.soon[0].first, "2026-10-12");
  const r2 = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"] }), T("s06", { assigneeId: "jh", assigneeIds: ["jh"], status: "inprogress" }), T("s08")], "wm").r;
  assert.equal(r2.soon.length, 0);   // s08 앞 = s07 (s07 은 아직 할 일)
});
ok("⑩ 임시 담당(책임자로 채운 항목)은 알림·차례 계산에서 빠짐", () => {
  const { r } = run([T("s11", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-10-05T00:00:00Z" }), T("x_mall", { assigneeId: "sh", assigneeIds: ["sh"], ownerFrom: "lead" })], "sh");
  assert.equal(r.byTask.size, 0); assert.ok(r.temp.has("lb_X__x_mall"));
});
ok("⑪ 앞 일 늦음 → '확인할 것'에 빨강 (내 기한 7일 안)", () => {
  const { r } = run([T("s07", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-02" }), T("s08", { dueDate: "2026-10-09" })], "wm");
  const x = r.inbox.find((i) => i.kind === "turnLate"); assert.ok(x); assert.ok(x.text.includes("4일 지남"));
});
ok("⑫ 끝낼 때 '다음은 ○○님 차례' · 다음 담당이 미사용이면 '담당 없음' + 책임자 알림", () => {
  const D = { users, projects: [P], tasks: [T("s11", { assigneeId: "cr", assigneeIds: ["cr"] }), T("s12", { assigneeId: "wm", assigneeIds: ["wm"] })] };
  assert.ok(R.nextTurnText(D.tasks[0], R.turnIndex(D), users).text.includes("이우민님"));
  const D2 = { users, projects: [P], tasks: [T("s11", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-10-05T00:00:00Z" }), T("s12", { assigneeId: "off", assigneeIds: ["off"] })] };
  assert.equal(R.nextTurnText({ ...D2.tasks[0], status: "todo" }, R.turnIndex(D2), users).noOwner, true);
  const r = R.turnsOf(D2, R.turnIndex(D2), "sh", now, {}, since);
  assert.equal(r.inbox.filter((x) => x.kind === "nextNoOwner").length, 1);
});
ok("⑬ 일반 업무: 하위 업무(담당 다름)가 상위 업무의 앞 일, deps 로 '다음 일 맡기기'", () => {
  const tasks = [{ id: "A", title: "카피", assigneeId: "cr", status: "done", finishedAt: "2026-10-05T00:00:00Z" }, { id: "B", title: "배너", assigneeId: "wm", status: "todo", deps: ["A"], dueDate: "2026-10-08" },
    { id: "P1", title: "상위", assigneeId: "sh", status: "todo" }, { id: "K1", title: "하위", parentId: "P1", assigneeId: "jh", status: "inprogress" }];
  const D = { users, projects: [], tasks }; const idx = R.turnIndex(D);
  assert.ok(R.turnsOf(D, idx, "wm", now, {}, since).fresh.has("B"));
  assert.equal(R.turnOf(tasks[2], idx, "2026-10-06").state, "wait");
});
ok("⑭ 프로젝트 지금 → 다음", () => {
  const tasks = [T("s06", { status: "done", assigneeId: "jh", assigneeIds: ["jh"] }), T("s07", { status: "inprogress", assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-09" }), T("s08", { dueDate: "2026-10-12" })];
  const D = { users, projects: [P], tasks }; const r = R.nowNext(P, D, R.turnIndex(D), "2026-10-06");
  assert.equal(r.now.id, "lb_X__s07"); assert.equal(r.next.id, "lb_X__s08");
});
ok("⑮ 내가 이어서 하는 단계는 '곧 내 차례'에 넣지 않음", () => {
  const { r } = run([T("p01", { assigneeId: "jh", assigneeIds: ["jh"], status: "inprogress" }), T("p02", { assigneeId: "jh", assigneeIds: ["jh"] })], "jh");
  assert.equal(r.soon.length, 0);
});
console.log(`\n${n}개 모두 통과`);
