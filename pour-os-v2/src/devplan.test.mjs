// node src/devplan.test.mjs — 월 1회 자동 개발 (devplan.js · 2026-10-17 사장님 확정 5A~9A) · 날짜는 기기 시각(그 자리 시간대) 그대로
import assert from "node:assert/strict";
import { lastMonday, planWindow, planNow, planStage, canPick, devReviewer, isDevReviewer, canConfirm, planItems, devMerge, carried, pickLeft, planDocOf, planCount, planLine, devInbox, prevYm, nextYm, ymLabel } from "./devplan.js";
import { todayView } from "./model.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const L = (s) => new Date(s);   // 'YYYY-MM-DDTHH:MM:SS' (시간대 없음 = 기기 시각)
const users = [{ id: "sh", name: "김송희" }, { id: "boss", name: "대표", master: true }, { id: "mj", name: "김민지" }, { id: "off", name: "쉬는", active: false }];
const Q = (o) => ({ id: "dr1", text: "반복 실행 줄이 너무 길어요", files: [], by: "mj", byName: "김민지", at: "2026-10-20T01:00:00.000Z", state: "open", updatedAt: "2026-10-20T01:00:00.000Z", ...o });

ok("달 계산 · 그 달 마지막 월요일", () => {
  assert.equal(prevYm("2026-01"), "2025-12"); assert.equal(nextYm("2026-12"), "2027-01"); assert.equal(ymLabel("2026-03"), "3월");
  assert.equal(lastMonday("2026-10"), "2026-10-26"); assert.equal(lastMonday("2026-11"), "2026-11-30"); assert.equal(lastMonday("2026-12"), "2026-12-28"); assert.equal(lastMonday("2027-02"), "2027-02-22");
  assert.deepEqual(planWindow("2026-11"), { ym: "2026-11", monday: "2026-11-30", thu: "2026-12-03", due: "2026-12-04", devDays: ["2026-12-05", "2026-12-06"] });
});
ok("지금 어느 달: 월요일 09:00부터 그 주 일요일까지 open · 다음 달로 넘어가도 지난달 개발 주는 지난달", () => {
  assert.deepEqual([planNow(L("2026-10-26T08:59:00")).open, planNow(L("2026-10-26T08:59:00")).ym], [false, "2026-10"]);
  assert.deepEqual([planNow(L("2026-10-26T09:00:00")).open, planNow(L("2026-10-26T09:00:00")).ym], [true, "2026-10"]);
  assert.deepEqual([planNow(L("2026-11-01T10:00:00")).open, planNow(L("2026-11-01T10:00:00")).ym], [true, "2026-10"]);   // 일요일 = 지난달 개발 날
  assert.deepEqual([planNow(L("2026-11-02T10:00:00")).open, planNow(L("2026-11-02T10:00:00")).ym], [false, "2026-11"]);
  assert.deepEqual([planNow(L("2026-12-01T10:00:00")).open, planNow(L("2026-12-01T10:00:00")).ym], [true, "2026-11"]);   // 11월 목록이 11/30 → 12/5~6 개발
  assert.deepEqual([planNow(L("2026-10-17T10:00:00")).open, planNow(L("2026-10-17T10:00:00")).ym], [false, "2026-10"]);
});
ok("단계: 목록 전 → 확인 기다림(월~수) → 목·금 빨강 → 확인 없으면 쉼 · 확인함 → 토·일 개발 → 끝", () => {
  const w = planWindow("2026-10"), okP = { state: "ok" };
  assert.equal(planStage(w, null, L("2026-10-26T08:00:00")), "wait"); assert.equal(planStage(w, null, L("2026-10-26T09:00:00")), "review"); assert.equal(planStage(w, null, L("2026-10-28T18:00:00")), "review");
  assert.equal(planStage(w, null, L("2026-10-29T09:00:00")), "late"); assert.equal(planStage(w, null, L("2026-10-30T23:59:00")), "late");
  assert.equal(planStage(w, null, L("2026-10-31T09:00:00")), "missed"); assert.equal(planStage(w, okP, L("2026-10-27T09:00:00")), "ok");
  assert.equal(planStage(w, okP, L("2026-10-31T09:00:00")), "dev"); assert.equal(planStage(w, okP, L("2026-11-01T20:00:00")), "dev"); assert.equal(planStage(w, okP, L("2026-11-02T09:00:00")), "over");
  assert.equal(planStage(w, { state: "ok", devDone: { at: "x" } }, L("2026-11-01T20:00:00")), "done");
});
ok("고를 수 있는 때 = 월 09:00 ~ 금 · 주말 개발 시작 전", () => {
  const w = planWindow("2026-10");
  assert.ok(canPick(w, null, L("2026-10-26T09:00:00")) && canPick(w, null, L("2026-10-30T20:00:00")) && canPick(w, { state: "ok" }, L("2026-10-30T20:00:00")));
  assert.ok(!canPick(w, null, L("2026-10-26T08:00:00")) && !canPick(w, { state: "ok" }, L("2026-10-31T09:00:00")) && !canPick(w, { state: "ok", devStartedAt: "x" }, L("2026-10-30T09:00:00")));
});
ok("확인하는 사람 = 설정 → 기본 김송희 → 없으면 관리자 누구나", () => {
  assert.equal(devReviewer({ users }), "sh"); assert.equal(devReviewer({ users, settings: [{ id: "devplan", reviewerId: "mj" }] }), "mj");
  assert.equal(devReviewer({ users, settings: [{ id: "devplan", reviewerId: "off" }] }), "sh");   // 쉬는 사람이면 기본
  const D0 = { users: users.filter((u) => u.id !== "sh") };
  assert.equal(devReviewer(D0), ""); assert.ok(isDevReviewer(D0, users[1]) && !isDevReviewer(D0, users[2]));
  assert.ok(canConfirm({ users }, users[0]) && canConfirm({ users }, users[1]) && !canConfirm({ users }, users[2]));
});
ok("목록 = 열린 포스트잇 · 뗀 것·반영함·안 함 빼고 · 먼저 붙인 것 먼저 · 지난달 다음 달 꼬리표", () => {
  const R = [Q({ id: "b", at: "2026-10-21T00:00:00Z" }), Q({ id: "a", at: "2026-10-01T00:00:00Z" }), Q({ id: "c", state: "done" }), Q({ id: "d", state: "no" }), Q({ id: "e", removed: { at: "x" } }), Q({ id: "f", state: undefined, at: "2026-10-22T00:00:00Z" })];
  assert.deepEqual(planItems(R).map((r) => r.id), ["a", "b", "f"]);
  assert.equal(devMerge([Q({ id: "a", text: "옛" })], [Q({ id: "a", text: "새" }), Q({ id: "z" })]).find((x) => x.id === "a").text, "새");
  const cr = carried({ "2026-09": { items: [{ id: "a", pick: "later", note: "디자인 먼저" }, { id: "b", pick: "now" }], devLater: { f: "흐름 바꿈 · 사장님 확인" } } }, "2026-10");
  assert.deepEqual(cr, { a: "지난달 '다음 달' · 디자인 먼저", f: "지난달 주말에 못 함 · 흐름 바꿈 · 사장님 확인" });
});
ok("확인 문서 · 남은 수 · 세기 · 한 줄 안내", () => {
  const w = planWindow("2026-10"), items = [Q({ id: "a" }), Q({ id: "b", files: [{ url: "u" }] })];
  assert.equal(pickLeft(items, { a: "now" }), 1); assert.equal(pickLeft(items, { a: "now", b: "x" }), 1); assert.equal(pickLeft(items, { a: "now", b: "no" }), 0);
  const d = planDocOf(w, items, { a: "now", b: "no" }, { b: "  다음 분기에  같이 " }, users[0], "2026-10-27T01:00:00.000Z");
  assert.equal(d.id, "2026-10"); assert.equal(d.state, "ok"); assert.equal(d.confirmedByName, "김송희"); assert.deepEqual(d.devDays, ["2026-10-31", "2026-11-01"]);
  assert.deepEqual(d.items.map((x) => [x.id, x.pick, x.note, x.files]), [["a", "now", "", 0], ["b", "no", "다음 분기에 같이", 1]]);
  assert.deepEqual(planCount(d), { now: 1, later: 0, no: 1 });
  assert.match(planLine(w, null, "wait", "김송희"), /10\/26\(월\) 09:00 · 10\/30\(금\)까지 김송희님 확인 → 10\/31~11\/1 주말 개발/);
  assert.match(planLine(w, d, "ok", "김송희"), /이번에 1개/); assert.match(planLine(w, null, "missed", "김송희"), /쉬어요/);
});
ok("'확인할 것': 확인하는 사람 = 목록 n개(처리할 때까지) · 목·금 빨강 위로 · 다른 사람·목록 없음·확인함이면 안 뜸", () => {
  const D = (o) => ({ users, dev: { reqs: [Q({ id: "a" }), Q({ id: "b" })], plans: {} }, ...o });
  const L1 = devInbox(D(), "sh", L("2026-10-27T10:00:00"), {});
  assert.equal(L1.length, 1); assert.equal(L1[0].kind, "devPlan"); assert.equal(L1[0].title, "10월 개발 목록 2개"); assert.ok(L1[0].keep && !L1[0].red); assert.match(L1[0].text, /10\/30\(금\)까지/);
  const L2 = devInbox(D(), "sh", L("2026-10-29T10:00:00"), {}); assert.ok(L2[0].red && L2[0].ord < 2 && /내일까지/.test(L2[0].text));
  assert.match(devInbox(D(), "sh", L("2026-10-30T10:00:00"), {})[0].text, /오늘까지/);
  assert.equal(devInbox(D(), "mj", L("2026-10-27T10:00:00"), {}).length, 0); assert.equal(devInbox(D(), "boss", L("2026-10-27T10:00:00"), {}).length, 0);   // 확인하는 사람이 있으면 관리자에겐 안 뜸
  assert.equal(devInbox(D(), "sh", L("2026-10-26T08:00:00"), {}).length, 0); assert.equal(devInbox(D(), "sh", L("2026-10-31T10:00:00"), {}).length, 0);   // 목록 전 · 금요일 지남
  assert.equal(devInbox(D({ dev: { reqs: [], plans: {} } }), "sh", L("2026-10-27T10:00:00"), {}).length, 0);
  assert.equal(devInbox(D({ dev: { reqs: [Q({ id: "a" })], plans: { "2026-10": { state: "ok" } } } }), "sh", L("2026-10-27T10:00:00"), {}).length, 0);
});
ok("'확인할 것': 개발 끝(확인하는 사람·관리자 · 7일 · 읽음) · 내 포스트잇 반영함·안 함(요청한 사람 · 내가 바꾼 것 빼고)", () => {
  const plans = { "2026-10": { ym: "2026-10", state: "ok", confirmedBy: "sh", devDone: { at: "2026-11-01T06:00:00.000Z", summary: "반복 실행 줄 짧게 · 버튼 문구", done: ["a"], later: [{ id: "b", why: "흐름" }] } } };
  const reqs = [Q({ id: "a", state: "done", doneAt: "2026-11-01T05:00:00.000Z", doneBy: "claude", doneByName: "Claude(개발)", reply: "줄을 두 줄로 줄였어요" }), Q({ id: "c", state: "no", noAt: "2026-10-27T01:00:00.000Z", noBy: "sh", noByName: "김송희", noReason: "이미 다른 화면에 있음" }), Q({ id: "d", state: "done", doneAt: "2026-11-01T05:00:00.000Z", doneBy: "mj" })];
  const now = L("2026-11-01T20:00:00"), D = { users, dev: { reqs, plans } };
  const sh = devInbox(D, "sh", now, {}); assert.equal(sh.length, 1); assert.equal(sh[0].kind, "devDone"); assert.equal(sh[0].title, "10월 개발 끝 · 반영 1개 · 다음 달 1개");
  assert.equal(devInbox(D, "boss", now, {}).filter((x) => x.kind === "devDone").length, 1);
  const mj = devInbox(D, "mj", now, {}); assert.deepEqual(mj.map((x) => [x.kind, x.tag, x.res]), [["devReqRes", "반영함", "done"], ["devReqRes", "안 함", "no"]]);
  assert.match(mj[0].text, /답 · 줄을 두 줄로/); assert.match(mj[1].text, /까닭 · 이미 다른 화면에 있음/);
  assert.equal(devInbox(D, "mj", now, Object.fromEntries(mj.map((x) => [x.id, true]))).length, 0);
  assert.equal(devInbox(D, "sh", L("2026-11-10T10:00:00"), {}).length, 0);   // 7일 지남
});
ok("todayView 에 줄이 섬 (D.devInbox)", () => {
  const D = { users, tasks: [], projects: [], notes: [], dev: { reqs: [Q({ id: "a" })], plans: {} }, devInbox };
  const v = todayView(D, "sh", L("2026-10-29T10:00:00"), {});
  const x = v.inbox.find((y) => y.kind === "devPlan"); assert.ok(x && x.red); assert.equal(v.inbox[0].kind, "devPlan");   // 빨강 = 맨 위쪽
});
console.log(`${n}개 통과`);
