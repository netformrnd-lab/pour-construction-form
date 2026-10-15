// 팀원 화면 보기 (viewas.js · viewonly.js) 계산 시험
import assert from "node:assert/strict";
import * as V from "./viewas.js";
import { setViewOnly, guardWrite, viewOnlyOn, isViewOnlyErr } from "./viewonly.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
// 지금 조직 모양(2026-10-15): 본부장 허지은(관리자) · 2팀 리드 김송희(관리자) 아래 양채림·김민지·이란(관리자) · 1팀 리드 김소연(관리자) 아래 남윤정 · 3팀 리드 김채원(관리자 아님) 아래 변유림 · 윤미니(본부장 아래) · 쉬는 사람 이채은
const U = [
  { id: "GM", name: "허지은" }, { id: "songhee", name: "김송희", role: "lead", bossId: "GM" }, { id: "chaerim", name: "양채림", bossId: "songhee" }, { id: "minji", name: "김민지", bossId: "songhee" },
  { id: "ran", name: "이란", bossId: "songhee" }, { id: "soyeon", name: "김소연", bossId: "GM" }, { id: "yj", name: "남윤정", bossId: "soyeon" }, { id: "cw", name: "김채원", bossId: "GM" },
  { id: "yr", name: "변유림", bossId: "cw" }, { id: "mini", name: "윤미니", bossId: "GM" }, { id: "off", name: "이채은", active: false, bossId: "cw" },
];
const by = (id) => U.find((u) => u.id === id), ids = (cu) => V.viewables(U, by(cu)).map((r) => r.u.id);

ok("누가 쓸 수 있나: 리드·본부장·관리자 · 팀원은 못 씀(목록 없음)", () => {
  for (const id of ["GM", "songhee", "soyeon", "cw", "ran"]) assert.ok(V.canView(U, by(id)), id);
  for (const id of ["chaerim", "minji", "yr", "mini"]) { assert.equal(V.canView(U, by(id)), false, id); assert.deepEqual(ids(id), [], id); }
});
ok("본부장·관리자 = 사용 중인 모든 사람(나·쉬는 사람 빼고) · 내 아래 사람 먼저", () => {
  const a = ids("GM"); assert.equal(a.length, 9); assert.ok(!a.includes("GM")); assert.ok(!a.includes("off"));
  const s = ids("songhee"); assert.deepEqual(s.slice(0, 3).sort(), ["chaerim", "minji", "ran"]); assert.equal(s.length, 9);
});
ok("리드(관리자 아님) = 내 아래 사람 + 내 팀 · 다른 팀은 안 보임", () => {
  assert.deepEqual(ids("cw"), ["yr"]);
  assert.equal(V.viewTarget(U, by("cw"), "yr").id, "yr"); assert.equal(V.viewTarget(U, by("cw"), "minji"), null); assert.equal(V.viewTarget(U, by("chaerim"), "minji"), null);
  // 여러 단계 아래도 (변유림 아래 새 사람)
  const U2 = [...U, { id: "new", name: "새 사람", bossId: "yr" }];
  assert.ok(V.viewables(U2, by("cw")).some((r) => r.u.id === "new"));
  assert.equal(V.isUnder(U2, "new", "cw"), true); assert.equal(V.isUnder(U2, "new", "songhee"), false);
  // 상급자 고리여도 멈춤
  assert.equal(V.isUnder([{ id: "a", bossId: "b" }, { id: "b", bossId: "a" }], "a", "z"), false);
});
ok("표시: 역할 · 팀 · 링크 #v-", () => {
  const r = V.viewables(U, by("GM")); assert.equal(r.find((x) => x.u.id === "songhee").tag, "리드"); assert.equal(r.find((x) => x.u.id === "cw").tag, "리드"); assert.equal(r.find((x) => x.u.id === "minji").tag, "");
  assert.equal(V.viewHash("#v-" + encodeURIComponent("u17 9")), "u17 9"); assert.equal(V.viewHash("#t-x"), ""); assert.equal(V.viewLink("minji"), "./os2.html#v-minji");
});
ok("이름 옆 한 줄: 열린 일 · 기한 지남(보류 빼고) · 오늘 마감 · 확인 대기 · 고정업무·끝남·중단 뺌", () => {
  const D = { tasks: [{ id: 1, assigneeIds: ["minji"], dueDate: "2026-10-14", status: "todo" }, { id: 2, assigneeIds: ["minji"], dueDate: "2026-10-14", status: "hold" }, { id: 3, assigneeIds: ["minji"], dueDate: "2026-10-15", status: "inprogress" },
    { id: 4, assigneeIds: ["minji"], dueDate: "2026-10-10", status: "review" }, { id: 5, assigneeIds: ["minji"], status: "done" }, { id: 6, assigneeIds: ["minji"], isFixed: true }, { id: 7, assigneeIds: ["chaerim"], dueDate: "2026-10-01" }, { id: 8, assigneeId: "minji", status: "dropped" }] };
  const p = V.peekOf(D, "minji", "2026-10-15"); assert.deepEqual(p, { open: 4, late: 1, today: 1, review: 1 });
  assert.equal(V.peekText(p), "열린 일 4 · 기한 지남 1 · 오늘 마감 1 · 확인 대기 1"); assert.equal(V.peekText({ open: 0, late: 0, today: 0, review: 0 }), "열린 일 0");
});
ok("저장 동작 막기: 부르면 저장 안 하고 알림(진척·기록은 조용히) · async 는 Promise(false) · 알림 함수는 그대로", () => {
  let called = 0; const seen = []; const A = { toast: (t) => seen.push("toast:" + t), finish: () => { called++; }, addTask: async () => { called++; return { id: "x" }; }, recalc: async () => { called++; } };
  const P = V.viewActs(A, (k) => seen.push(k));
  assert.equal(P.finish({}), false); assert.ok(P.addTask({}) instanceof Promise); P.recalc("p"); P.toast("안녕");
  assert.equal(called, 0); assert.deepEqual(seen, ["finish", "addTask", "toast:안녕"]);
  assert.equal(V.viewBlockText("김민지"), "보기 모드 · 김민지님 화면이라 바꾸지 않았어요");
});
ok("쓰기 잠금(viewonly): 켜면 guardWrite 가 던짐 · 끄면 그대로", () => {
  assert.equal(viewOnlyOn(), null); guardWrite();
  setViewOnly({ as: "minji", by: "GM" }); assert.deepEqual(viewOnlyOn(), { as: "minji", by: "GM" });
  assert.throws(() => guardWrite(), (e) => isViewOnlyErr(e));
  setViewOnly(null); guardWrite(); setViewOnly({}); assert.equal(viewOnlyOn(), null);
});
console.log(`${n}개 모두 통과`);
