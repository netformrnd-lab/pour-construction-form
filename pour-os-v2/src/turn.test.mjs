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
ok("② 불러온 범위에 없는 앞 항목은 끝난 것으로, 건너뛴 항목(skipItems)·선택 항목만 거슬러 올라감", () => {
  const ts = [T("s06", { status: "inprogress", assigneeId: "jh", assigneeIds: ["jh"] }), T("s08")];
  const { idx, D } = run(ts, "wm");
  assert.deepEqual(R.predsOf(D.tasks[1], idx).map((x) => x.id), []);   // s07 없음 = 오래전에 끝남 → 더 앞(s06)으로 가지 않음
  const D2 = { users, projects: [{ ...P, skipItems: ["s07"] }], tasks: ts };
  assert.deepEqual(R.predsOf(ts[1], R.turnIndex(D2)).map((x) => x.id), ["lb_X__s06"]);   // s07 건너뜀 → s06 · (s01 없음 = 끝남)
  // 실제 사례: s02 는 8/20 에 끝나 불러오지 않음, x_test 는 v1 에서 체크 안 해 할 일 → s06 앞 일은 '없음(끝남)'이지 x_test 가 아님
  const ts3 = [T("x_test", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-08-10" }), T("p03", { status: "done", assigneeId: "jh", assigneeIds: ["jh"], finishedAt: "2026-09-20T00:00:00Z" }), T("s06", { dueDate: "2026-10-09" })];
  const r3 = run(ts3, "wm");
  assert.deepEqual(R.predsOf(ts3[2], r3.idx), []); assert.equal(r3.r.inbox.filter((x) => x.kind === "turnLate").length, 0);
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
ok("⑯ 화면에 보일 앞 일(show): 늦음 → 늦은 앞 일, 기다림 → 끝 예정이 가장 늦은 앞 일, 내 차례 → 마지막에 끝난 앞 일", () => {
  // s11 ← s08(cr, 10/20 하는 중) · s10(jh, 10/14)
  const ts = [T("s08", { assigneeId: "cr", assigneeIds: ["cr"], status: "inprogress", dueDate: "2026-10-20" }), T("s10", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-14" }), T("s11", { dueDate: "2026-10-23" })];
  const a = run(ts, "wm"); const w = a.r.byTask.get("lb_X__s11");
  assert.equal(w.state, "wait"); assert.equal(w.show.id, "lb_X__s08");
  const ts2 = ts.map((t) => (t.launchItem === "s10" ? { ...t, dueDate: "2026-10-01" } : t));   // s10 5일 지남, s08 은 제때
  const b = run(ts2, "wm"); const l = b.r.byTask.get("lb_X__s11");
  assert.equal(l.state, "late"); assert.equal(l.show.id, "lb_X__s10");
  assert.equal(R.turnOf(ts2[2], b.idx, "2026-10-06").show.id, "lb_X__s10");
  const ts3 = [T("s08", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-10-05T03:00:00Z" }), T("s10", { assigneeId: "jh", assigneeIds: ["jh"], status: "done", finishedAt: "2026-10-05T05:00:00Z" }), T("s11")];
  const c = run(ts3, "wm"); assert.equal(c.r.byTask.get("lb_X__s11").show.id, "lb_X__s10");
});
ok("⑰ 끝낼 때 '다음은 ○○님 차례'는 다른 앞 일이 다 끝난 다음 일만, 임시 담당은 '담당 없음'(책임자 안내)", () => {
  const ts = [{ id: "A", title: "카피", assigneeId: "cr", status: "todo" }, { id: "B", title: "사진", assigneeId: "jh", status: "todo" }, { id: "C", title: "배너", assigneeId: "wm", status: "todo", deps: ["A", "B"] }];
  const D = { users, projects: [], tasks: ts };
  assert.equal(R.nextTurnText(ts[0], R.turnIndex(D), users).text, "");   // 사진이 아직 → 배너는 아직 차례 아님
  const D2 = { users, projects: [], tasks: [ts[0], { ...ts[1], status: "done" }, ts[2]] };
  assert.ok(R.nextTurnText(ts[0], R.turnIndex(D2), users).text.includes("이우민님"));
  const t2 = [T("s11", { assigneeId: "cr", assigneeIds: ["cr"] }), T("x_mall", { assigneeId: "sh", assigneeIds: ["sh"], ownerFrom: "lead" })];
  const r = R.nextTurnText(t2[0], R.turnIndex({ users, projects: [P], tasks: t2 }), users);
  assert.equal(r.text, "다음 일 담당이 없어요"); assert.equal(r.noOwner, true);
  // 책임자(김송희) '확인할 것'에 '담당 없음' 한 줄 — 앞 일이 방금 끝났을 때만 (오래전 끝난 임시 항목으로 가득 차지 않게)
  const t3 = [{ ...t2[0], status: "done", finishedAt: "2026-10-05T00:00:00Z" }, t2[1]];
  assert.equal(run(t3, "sh").r.inbox.filter((x) => x.kind === "nextNoOwner").length, 1);
  assert.equal(run([{ ...t3[0], finishedAt: "2026-09-01T00:00:00Z" }, t2[1]], "sh", {}, "").r.inbox.filter((x) => x.kind === "nextNoOwner").length, 0);
});
ok("⑱ 앞 일이 수정 요청 뒤 다시 끝나면 다시 알림: 할 일이면 '이제 내 차례'(seenKey 에 끝난 시각), 하는 중이면 '앞 일 다시 끝남'", () => {
  const A0 = { id: "A", title: "카피", assigneeId: "cr", requestedBy: "sh", status: "review", finishedAt: "2026-10-06T01:00:00Z", statusLog: [{ status: "review", at: "2026-10-06T01:00:00Z" }] };
  const B0 = { id: "B", title: "배너", assigneeId: "wm", status: "todo", deps: ["A"] };
  const go = (A, B, seen) => { const D = { users, projects: [], tasks: [A, B] }; return R.turnsOf(D, R.turnIndex(D), "wm", new Date("2026-10-06T15:00:00"), seen, since); };
  const r1 = go(A0, B0, {}); assert.ok(r1.fresh.has("B")); const k1 = r1.byTask.get("B").seenKey;
  assert.equal(k1, "tn:B:A:2026-10-06T01:00:00Z");
  assert.equal(go(A0, B0, { [k1]: true }).fresh.size, 0); assert.equal(go(A0, B0, { "tn:B:A": true }).fresh.size, 0);   // 예전 키도 본 것으로
  // 이우민이 시작 → 김송희 수정 요청 → 양채림 다시 끝냄
  const B1 = { ...B0, status: "inprogress", statusLog: [{ status: "inprogress", at: "2026-10-06T02:00:00Z" }] };
  const A2 = { ...A0, finishedAt: "2026-10-06T05:00:00Z", statusLog: [...A0.statusLog, { status: "inprogress", feedback: true, at: "2026-10-06T03:00:00Z" }, { status: "review", at: "2026-10-06T05:00:00Z" }] };
  const r2 = go(A2, B1, { [k1]: true, "tn:B:A": true }); const x = r2.inbox.find((i) => i.kind === "turnAgain");
  assert.ok(x); assert.equal(x.taskId, "B"); assert.equal(x.tag, "앞 일 다시 끝남"); assert.equal(x.act, "open"); assert.equal(x.who, "cr");
  assert.equal(go(A2, B1, { [x.id]: true }).inbox.filter((i) => i.kind === "turnAgain").length, 0);   // 열어 보면 사라짐
  assert.equal(go(A0, B1, {}).inbox.filter((i) => i.kind === "turnAgain").length, 0);                 // 다시 열린 적 없으면 없음
  assert.ok(go(A2, B0, { [k1]: true, "tn:B:A": true }).fresh.has("B"));                               // 아직 할 일이면 다시 '이제 내 차례'
});
ok("⑳ 확인 요청 → 확인 완료(approved)는 '다시 열림'이 아님: 앞 일 다시 끝남 없음 · 예전 키도 그대로 본 것", () => {
  const A = { id: "A", title: "카피", assigneeId: "cr", requestedBy: "sh", status: "done", finishedAt: "2026-10-06T05:00:00Z",
    statusLog: [{ status: "review", at: "2026-10-06T05:00:00Z" }, { status: "done", approved: true, at: "2026-10-06T06:00:00Z" }] };
  const B = { id: "B", title: "배너", assigneeId: "wm", status: "inprogress", deps: ["A"], statusLog: [{ status: "inprogress", at: "2026-10-06T02:00:00Z" }] };
  const D = { users, projects: [], tasks: [A, B] };
  assert.equal(R.turnsOf(D, R.turnIndex(D), "wm", new Date("2026-10-06T15:00:00"), {}, since).inbox.filter((i) => i.kind === "turnAgain").length, 0);
  const D2 = { users, projects: [], tasks: [A, { ...B, status: "todo", statusLog: [] }] };
  assert.equal(R.turnsOf(D2, R.turnIndex(D2), "wm", new Date("2026-10-06T15:00:00"), { "tn:B:A": true }, since).fresh.size, 0);
});
ok("⑲ 카드에 보이는 앞 일 마지막 말(shownNotes) · 내 일의 앞 일(predIds)", () => {
  const ts = [T("s08", { assigneeId: "cr", assigneeIds: ["cr"], status: "done", finishedAt: "2026-10-06T03:00:00Z" }), T("s10", { assigneeId: "jh", assigneeIds: ["jh"], status: "done", finishedAt: "2026-10-06T04:00:00Z" }), T("s11")];
  const notes = [{ id: "n1", itemId: "task:lb_X__s08", by: "cr", text: "상세 v3", at: "2026-10-06T03:00:00Z", handoff: true }, { id: "n2", itemId: "task:lb_X__s10", by: "jh", text: "B안", at: "2026-10-06T04:00:00Z", handoff: true }];
  const D = { users, projects: [P], tasks: ts, notes }; const r = R.turnsOf(D, R.turnIndex(D), "wm", now, {}, since);
  assert.ok(r.fresh.has("lb_X__s11")); assert.deepEqual([...r.shownNotes], ["n2"]); assert.deepEqual([...r.predIds].sort(), ["lb_X__s08", "lb_X__s10"]);
});
ok("㉑ 다가오는 내 차례: 프로젝트 · 앞사람 · 끝 예정 · 내 기한 · 여유(평일) · 내 앞 일만 남으면 뺌 · 위험 단계", () => {
  const G = (id, o) => ({ id, title: id, projectId: "g1", status: "todo", assigneeId: "wm", assigneeIds: ["wm"], ...o });
  const tasks = [
    G("a", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-07" }), G("b", { deps: ["a"], dueDate: "2026-10-12" }),     // 여유: 10/8 목 · 10/12 월 = 2일 (10/9 한글날 · 주말 빼고)
    G("c", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-08" }), G("d", { deps: ["c"], dueDate: "2026-10-09" }),     // 여유 1일 → 빠듯
    G("e", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-10" }), G("f", { deps: ["e"], dueDate: "2026-10-09" }),     // 앞 일 예정이 내 기한보다 늦음
    G("g", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-02" }), G("h", { deps: ["g"], dueDate: "2026-10-20" }),     // 앞 일 지남 → late
    G("i", { dueDate: "2026-10-07" }), G("j", { deps: ["i"], dueDate: "2026-10-09" }),                                             // 앞 일도 내 일 → 뺌
    G("k", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-07" }), G("l", { deps: ["k"], dueDate: "2026-10-30" }),     // 프로젝트 마감(10/23)보다 내 기한이 늦음
  ];
  const D = { users, projects: [{ id: "g1", title: "추석 프로모션", dueDate: "2026-10-23" }], tasks }, idx = R.turnIndex(D), r = R.turnsOf(D, idx, "wm", now, {}, since);
  const U = R.upcomingTurns(D, r, "2026-10-06", "wm"), by = Object.fromEntries(U.map((u) => [u.t.id, u]));
  assert.equal(by.b.level, "ok"); assert.equal(by.b.slack, 2); assert.equal(by.b.label, "여유 2일"); assert.equal(by.b.start, "2026-10-07");
  assert.equal(by.d.level, "tight"); assert.equal(by.f.level, "risk"); assert.equal(by.h.level, "late"); assert.equal(by.h.start, "2026-10-06");   // 앞 일이 지났으면 오늘부터
  assert.equal(by.j, undefined); assert.equal(by.l.level, "risk"); assert.equal(by.l.label, "마감보다 늦음");
  const L = R.upLine(by.b, users, "2026-10-06");
  assert.equal(L.title, "b"); assert.equal(L.proj, "추석 프로모션 · 마감 10/23 (D-17)"); assert.equal(L.pred, '앞: 용정하 "a" 할 일 · 10/7 끝 예정 → 내 기한 10/12');
});
ok("흐름 로드(2026-10-07): 2단계에 업무가 둘이면 3단계 '곧 내 차례'는 둘 다 끝나야 · 하나 남으면 그 업무를 기다림", () => {
  const FP = { id: "pF", title: "추석 프로모션", wfId: "wf_promo", category: "marketing", assigneeId: "sh", dueDate: "2026-10-23", road: [{ k: "wf0", name: "기획" }, { k: "wf1", name: "기획안 컨펌" }, { k: "wf2", name: "이미지 제작" }] };
  const F = (id, ph, o) => ({ id, title: id, projectId: "pF", phase: ph, status: "todo", assigneeId: "wm", assigneeIds: ["wm"], ...o });
  const ts = [F("a", "wf0", { status: "done", finishedAt: "2026-10-05T01:00:00Z" }), F("b", "wf1", { assigneeId: "jh", assigneeIds: ["jh"], dueDate: "2026-10-07" }), F("x", "wf1", { assigneeId: "sh", assigneeIds: ["sh"], dueDate: "2026-10-08", status: "inprogress" }), F("c", "wf2", { assigneeId: "cr", assigneeIds: ["cr"], dueDate: "2026-10-12" })];
  const D = { users, projects: [FP], tasks: ts }, idx = R.turnIndex(D);
  assert.deepEqual(R.predsOf(ts[3], idx).map((x) => x.id).sort(), ["b", "x"]);
  const T = R.turnsOf(D, idx, "cr", now, {}, since), up = R.upcomingTurns(D, T, "2026-10-06", "cr");
  assert.equal(up.length, 1); assert.equal(up[0].start, "2026-10-08");   // 남은 앞 일 중 끝 예정이 가장 늦은 것(x 10/8)
  const D2 = { ...D, tasks: ts.map((t) => (t.id === "b" ? { ...t, status: "done", finishedAt: "2026-10-06T01:00:00Z" } : t)) }, i2 = R.turnIndex(D2);
  assert.equal(R.turnOf(D2.tasks[3], i2, "2026-10-06").state, "wait"); assert.deepEqual(R.turnOf(D2.tasks[3], i2, "2026-10-06").open.map((x) => x.id), ["x"]);
  const D3 = { ...D2, tasks: D2.tasks.map((t) => (t.id === "x" ? { ...t, status: "done", finishedAt: "2026-10-06T08:00:00Z" } : t)) }, i3 = R.turnIndex(D3);
  assert.equal(R.turnOf(D3.tasks[3], i3, "2026-10-06").state, "ready"); assert.ok(R.turnsOf(D3, i3, "cr", now, {}, since).fresh.has("c"));
});
console.log(`\n${n}개 모두 통과`);
