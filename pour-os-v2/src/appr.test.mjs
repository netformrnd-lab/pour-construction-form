// node src/appr.test.mjs — 구매 품의 요청 (appr.js · 2026-10-16)
import assert from "node:assert/strict";
import { apprInbox, apprAssignee, apprAssigneeId, isApprMine, apprMerge, apprNewDoc, apprMissing, apprDonePatch, apprUndonePatch, apprLists, apprByAssignee, apprAssigneeNames, canApprDone, canApprEdit, canApprAssign, userIdByName } from "./appr.js";
import { todayView, readInbox } from "./model.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "sh", name: "김송희" }, { id: "mini", name: "윤미니" }, { id: "ran", name: "이란" }, { id: "off", name: "쉬는사람", active: false }];
const now = new Date("2026-10-16T05:00:00.000Z");
const R = (o) => ({ id: "r1", requester: "윤미니", topic: "주문/발주", docType: "구매요청서", title: "포장 테이프 10박스", body: "- 품목: 테이프", status: "품의전", doneBy: "", doneAt: null, doneMemo: "", createdAt: "2026-10-16T01:00:00.000Z", updatedAt: "2026-10-16T01:00:00.000Z", deleted: false, ...o });

ok("담당 없으면(독립 화면 예전 문서) 김송희 · 이름·번호로 찾기", () => {
  assert.equal(apprAssignee(R()), "김송희"); assert.equal(apprAssignee(R({ assignee: "  " })), "김송희"); assert.equal(apprAssignee(R({ assignee: "이란" })), "이란");
  assert.equal(apprAssigneeId(R(), users), "sh"); assert.equal(apprAssigneeId(R({ assignee: "이란" }), users), "ran");
  assert.equal(apprAssigneeId(R({ assignee: "김송희", assigneeId: "ran" }), users), "ran");   // 번호가 있으면 번호
  assert.equal(apprAssigneeId(R({ assignee: "이란", assigneeId: "없는사람" }), users), "ran");   // 없는 번호면 이름
  assert.equal(userIdByName(users, "쉬는사람"), "");
});
ok("요청자: 번호가 있으면 번호 · 없으면 이름", () => {
  assert.ok(isApprMine(R(), users, "mini")); assert.ok(!isApprMine(R(), users, "sh"));
  assert.ok(isApprMine(R({ requesterId: "mini", requester: "다른 이름" }), users, "mini")); assert.ok(!isApprMine(R({ requesterId: "ran" }), users, "mini"));
});
ok("업무OS 새 요청 = 요청자 나 · 담당 기본 김송희 · 독립 화면과 같은 칸", () => {
  const d = apprNewDoc({ topic: "CS", docType: "품의서", title: " 제목 ", body: "본문\n\n" }, { id: "mini", name: "윤미니" }, users, "2026-10-16T02:00:00.000Z");
  assert.equal(d.requester, "윤미니"); assert.equal(d.requesterId, "mini"); assert.equal(d.assignee, "김송희"); assert.equal(d.assigneeId, "sh");
  assert.equal(d.status, "품의전"); assert.equal(d.title, "제목"); assert.equal(d.body, "본문"); assert.equal(d.deleted, false); assert.equal(d.doneAt, null); assert.equal(d.source, "os2");
  assert.equal(apprNewDoc({ topic: "CS", docType: "품의서", title: "a", body: "b", assignee: "이란" }, { id: "mini", name: "윤미니" }, users).assigneeId, "ran");
  assert.deepEqual(apprMissing({ topic: "", docType: "품의서", title: " ", body: "x" }), ["주제", "제목"]);
});
ok("품의 완료 · 되돌리기 칸", () => {
  const p = apprDonePatch({ id: "sh", name: "김송희" }, "  문서 123 ", "2026-10-16T03:00:00.000Z");
  assert.deepEqual(p, { status: "품의완료", doneBy: "김송희", doneById: "sh", doneAt: "2026-10-16T03:00:00.000Z", doneMemo: "문서 123", updatedAt: "2026-10-16T03:00:00.000Z" });
  assert.equal(apprUndonePatch("x").status, "품의전"); assert.equal(apprUndonePatch("x").doneAt, null);
});
ok("합치기: 지운 것 빼고 · 같은 번호 하나 · 최근 것 먼저", () => {
  const a = apprMerge([R({ id: "a", createdAt: "2026-10-01" }), R({ id: "b", deleted: true })], [R({ id: "a", createdAt: "2026-10-01", title: "새 값" }), R({ id: "c", createdAt: "2026-10-10" })]);
  assert.deepEqual(a.map((x) => x.id), ["c", "a"]); assert.equal(a[1].title, "새 값");
});
ok("확인할 것 — 담당: 품의 요청 n건(남음) + 새 요청 한 건씩(읽으면 사라짐)", () => {
  const list = [R({ id: "a", createdAt: "2026-10-15T01:00:00.000Z", title: "가" }), R({ id: "b", title: "나" }), R({ id: "c", assignee: "이란", title: "다" }), R({ id: "d", status: "품의완료", doneAt: "2026-10-16T02:00:00.000Z", doneBy: "김송희", doneById: "sh" })];
  const x = apprInbox(list, users, "sh", {}, now);
  const sum = x.find((y) => y.kind === "appr");
  assert.equal(sum.title, "품의 요청 2건"); assert.ok(sum.keep); assert.match(sum.text, /가 · 나/);
  assert.deepEqual(x.filter((y) => y.kind === "apprNew").map((y) => y.apprId).sort(), ["a", "b"]);
  assert.ok(x.filter((y) => y.kind === "apprNew").every((y) => !y.keep));
  const seen = apprInbox(list, users, "sh", { "aqn:a": true }, now);
  assert.deepEqual(seen.filter((y) => y.kind === "apprNew").map((y) => y.apprId), ["b"]);
  assert.equal(apprInbox(list, users, "ran", {}, now).find((y) => y.kind === "appr").title, "품의 요청 1건");
  assert.equal(apprInbox(list, users, "mini", {}, now).filter((y) => y.kind === "appr" || y.kind === "apprNew").length, 0);   // 요청자에겐 없음
  // 7일 지난 새 요청은 알림 줄 없음(요약 줄에만)
  const old = apprInbox([R({ id: "o", createdAt: "2026-10-01T00:00:00.000Z" })], users, "sh", {}, now);
  assert.deepEqual(old.map((y) => y.kind), ["appr"]);
  // 지운 것 · 끝낸 것만 있으면 아무것도 없음
  assert.equal(apprInbox([R({ deleted: true }), R({ id: "z", status: "품의완료", doneAt: "2026-10-01" })], users, "sh", {}, now).length, 0);
});
ok("확인할 것 — 요청자: 품의 완료 알림 (7일 · 읽으면 사라짐 · 내가 끝낸 건 없음)", () => {
  const d = R({ status: "품의완료", doneBy: "김송희", doneById: "sh", doneAt: "2026-10-16T03:00:00.000Z", doneMemo: "문서 77" });
  const x = apprInbox([d], users, "mini", {}, now);
  assert.equal(x.length, 1); assert.equal(x[0].kind, "apprDone"); assert.equal(x[0].whoName, "김송희"); assert.match(x[0].text, /문서 77/); assert.ok(!x[0].keep);
  assert.equal(apprInbox([d], users, "mini", { [x[0].id]: true }, now).length, 0);
  assert.equal(apprInbox([{ ...d, doneAt: "2026-10-01T00:00:00.000Z" }], users, "mini", {}, now).length, 0);
  assert.equal(apprInbox([{ ...d, doneById: "mini" }], users, "mini", {}, now).length, 0);
});
ok("todayView 에 붙음 · 읽은 알림에 새 요청이 남음", () => {
  const D = { users, tasks: [], projects: [], notes: [], log: [], appr: { list: [R()], ready: true }, apprInbox };
  const tv = todayView(D, "sh", now, {});
  assert.deepEqual(tv.inbox.map((y) => y.kind), ["appr", "apprNew"]);
  const seen = { "aqn:r1": true };
  assert.deepEqual(todayView(D, "sh", now, seen).inbox.map((y) => y.kind), ["appr"]);
  assert.deepEqual(readInbox(D, "sh", now, seen).map((y) => y.id), ["aqn:r1"]);
  assert.equal(todayView({ ...D, appr: undefined }, "sh", now, {}).inbox.length, 0);   // 못 읽어도 그대로
});
ok("화면 목록 · 담당 거르기 · 권한", () => {
  const list = [R({ id: "a", createdAt: "2026-10-15" }), R({ id: "b", createdAt: "2026-10-14" }), R({ id: "c", assignee: "이란" }), R({ id: "d", status: "품의완료", doneAt: "x" })];
  const L = apprLists(list, users, "sh");
  assert.deepEqual(L.wait.map((x) => x.id), ["b", "a"]);   // 오래된 것부터
  assert.deepEqual(L.doneByMe.map((x) => x.id), ["d"]);
  assert.equal(apprLists(list, users, "mini").mine.length, 4); assert.equal(apprLists(list, users, "mini").mineWait, 3);
  assert.deepEqual(apprByAssignee(list, "이란").map((x) => x.id), ["c"]); assert.equal(apprByAssignee(list, "").length, 4);
  assert.deepEqual(apprAssigneeNames(list), ["김송희", "이란"]);
  const sh = { id: "sh", name: "김송희" }, mini = { id: "mini", name: "윤미니" }, ran = { id: "ran", name: "이란" };
  assert.ok(canApprDone(R(), users, sh, false)); assert.ok(!canApprDone(R(), users, mini, false)); assert.ok(canApprDone(R(), users, ran, true));
  assert.ok(canApprEdit(R(), users, mini, false)); assert.ok(!canApprEdit(R({ status: "품의완료" }), users, mini, false)); assert.ok(!canApprEdit(R(), users, sh, false));
  assert.ok(canApprAssign(R(), users, mini, false)); assert.ok(canApprAssign(R(), users, sh, false)); assert.ok(!canApprAssign(R(), users, ran, false)); assert.ok(!canApprAssign(R({ status: "품의완료" }), users, sh, true));
});
console.log(`\n${n}개 통과`);
