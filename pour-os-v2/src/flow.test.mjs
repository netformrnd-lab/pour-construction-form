// node src/flow.test.mjs — 흐름으로 만들기: 단계 기한 · 앞 단계 사슬 · 맡김 한 줄 · 흐름 목록
import assert from "node:assert/strict";
import { flowDues, planFlow, flowList, flowOwners, FLOW_DEFAULTS } from "./flow.js";
import { turnIndex, turnOf, turnsOf } from "./turn.js";
import { todayView, isOffDay } from "./model.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "a", name: "가가" }, { id: "b", name: "나나" }, { id: "c", name: "다다", active: false }];
const me = { id: "a", name: "가가" };
ok("단계 기한: 주말·공휴일 빼고 고르게, 마지막 = 마감", () => {
  const d = flowDues(8, "2026-10-16", "2026-10-03");
  assert.equal(d.length, 8); assert.equal(d[7], "2026-10-16");
  assert.ok(!d.includes("2026-10-05") && !d.includes("2026-10-09"));   // 대체공휴일 · 한글날
  assert.deepEqual([...d].sort(), d);                                   // 순서대로
  assert.deepEqual(flowDues(3, "2026-10-06", "2026-10-03"), ["2026-10-06", "2026-10-06", "2026-10-06"]);   // 평일이 모자라면 같은 날
  assert.deepEqual(flowDues(2, "2026-10-01", "2026-10-03"), ["2026-10-03", "2026-10-03"]);                 // 지난 마감 → 오늘
  // 마감을 쉬는 날로 골라도 앞 단계는 평일에만 (마지막 단계만 고른 날)
  const sat = flowDues(8, "2026-10-10", "2026-10-03"); assert.equal(sat[7], "2026-10-10"); assert.ok(sat.slice(0, 7).every((d) => !isOffDay(d)), sat.join(","));
  const hg = flowDues(8, "2026-10-09", "2026-10-03"); assert.equal(hg[7], "2026-10-09"); assert.ok(hg.slice(0, 7).every((d) => !isOffDay(d) && d < "2026-10-09"), hg.join(","));
  assert.deepEqual([...sat].sort(), sat); assert.deepEqual([...hg].sort(), hg);
  assert.deepEqual(flowDues(1, "2026-10-10", "2026-10-03"), ["2026-10-10"]);
  assert.deepEqual(flowDues(4, "2026-10-30", "2026-10-03"), ["2026-10-13", "2026-10-19", "2026-10-26", "2026-10-30"]);   // 마감이 평일이면 예전과 같음
});
ok("흐름 만들기: 앞 단계 deps 사슬 · 바로 끝(noReview) · 남의 단계는 묶음 맡김", () => {
  const wf = FLOW_DEFAULTS[0];
  const pl = planFlow({ wf, title: " 추석 ", brand: "grohome", leadId: "a", due: "2026-10-16", owners: ["a", "b", "b", "a", "a", "a", "b", "a"] }, { users }, me, "2026-10-03", "2026-10-03T01:00:00.000Z");
  assert.equal(pl.project.title, "추석"); assert.equal(pl.project.wfId, "wf_promo"); assert.deepEqual(pl.project.collaboratorIds, ["b"]);
  assert.deepEqual(pl.tasks[0].deps, []); pl.tasks.slice(1).forEach((t, i) => assert.deepEqual(t.deps, [pl.tasks[i].id]));
  assert.ok(pl.tasks.every((t) => t.noReview && t.wfId === "wf_promo" && t.projectId === pl.project.id));
  assert.ok(pl.tasks[0].ackAt && !pl.tasks[0].bulkId); assert.ok(pl.tasks[1].bulkId && !pl.tasks[1].ackAt && pl.tasks[1].assignedBy === "a");
  assert.equal(pl.byWho.b.length, 3);
  // 나나 '확인할 것': 단계 3개가 한 줄
  const D = { users, projects: [pl.project], tasks: pl.tasks, notes: [] };
  const idx = turnIndex(D), T = turnsOf(D, idx, "b", new Date("2026-10-03T10:00:00"), {}, "2026-10-03T00:00:00.000Z");
  const tv = todayView(D, "b", new Date("2026-10-03T10:00:00"), {}, T);
  assert.equal(tv.inbox.filter((x) => x.kind === "bulk").length, 1); assert.equal(tv.inbox.filter((x) => x.kind === "assigned").length, 0);
  // 가가가 1단계를 끝내면 나나 2단계 차례
  assert.equal(turnOf(pl.tasks[1], idx, "2026-10-03").state, "wait");
  const D2 = { ...D, tasks: pl.tasks.map((t, i) => (i === 0 ? { ...t, status: "done", finishedAt: "2026-10-03T09:00:00.000Z" } : t)) };
  const T2 = turnsOf(D2, turnIndex(D2), "b", new Date("2026-10-03T10:00:00"), {}, "2026-10-03T00:00:00.000Z");
  assert.ok(T2.fresh.has(pl.tasks[1].id));
});
ok("흐름 목록: 문서 단계 쓰고 이름은 표에서, 신제품·빈 흐름 빼기, 없으면 기본표", () => {
  const D = { workflows: [{ id: "wf_launch", stages: [] }, { id: "wf_cpc", stages: [{ id: "x", name: "소재", ownerId: "b" }] }, { id: "wf_promo", stages: [{ id: "p", name: "기획" }] }] };
  const L = flowList(D);
  assert.deepEqual(L.map((w) => w.id), ["wf_promo", "wf_cpc"]); assert.equal(L[1].name, "CPC 광고"); assert.equal(L[1].stages[0].name, "소재");
  assert.equal(flowList({ workflows: [] }).length, FLOW_DEFAULTS.length);
  assert.deepEqual(flowOwners(L[1], me, users), ["b"]);
  assert.deepEqual(flowOwners({ stages: [{ ownerId: "c" }, {}] }, me, users), ["a", "a"]);   // 미사용 사람은 기본값으로 안 씀
});
console.log(`\n${n}개 모두 통과`);
