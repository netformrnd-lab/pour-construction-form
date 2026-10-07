// node src/flow.test.mjs — 흐름으로 만들기: 단계 기한 · 앞 단계 사슬 · 맡김 한 줄 · 흐름 목록
import assert from "node:assert/strict";
import { flowDues, planFlow, flowList, flowOwners, FLOW_DEFAULTS } from "./flow.js";
import { turnIndex, turnOf, turnsOf, predsOf, nextTurnText } from "./turn.js";
import { todayView, isOffDay, roadOf, phaseOfTask } from "./model.js";
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
ok("로드(2026-10-07): 흐름 단계 = 프로젝트 road(wf0…) · 업무 phase", () => {
  const wf = FLOW_DEFAULTS[0];
  const pl = planFlow({ wf, title: "추석", brand: "", leadId: "a", due: "2026-10-16", owners: wf.stages.map(() => "a") }, { users }, me, "2026-10-03", "2026-10-03T01:00:00.000Z");
  assert.deepEqual(pl.project.road.map((s) => s.k), wf.stages.map((_, i) => "wf" + i)); assert.deepEqual(pl.project.road.map((s) => s.name), wf.stages.map((s) => s.name));
  assert.deepEqual(pl.tasks.map((t) => t.phase), wf.stages.map((_, i) => "wf" + i));
  const D = { users, projects: [pl.project], tasks: pl.tasks };
  assert.deepEqual(roadOf(pl.project, D), pl.project.road);
  assert.equal(phaseOfTask(pl.tasks[3], pl.project, D), "wf3");
});
// 흐름 규칙: 다음 단계 사람은 앞 단계 업무가 '모두' 끝나야 차례 (2단계에 업무를 하나 더 넣은 경우)
const flowCase = () => {
  const wf = FLOW_DEFAULTS[0];
  const pl = planFlow({ wf, title: "추석", brand: "", leadId: "a", due: "2026-10-16", owners: ["a", "b", "a", "a", "a", "a", "a", "a"] }, { users }, me, "2026-10-03", "2026-10-03T01:00:00.000Z");
  const X = { id: "tX", title: "배너 하나 더", projectId: pl.project.id, status: "todo", assigneeId: "c2", assigneeIds: ["c2"], phase: "wf1", isFixed: false, createdAt: "2026-10-03T02:00:00.000Z" };
  return { pl, X, users2: [...users, { id: "c2", name: "라라" }] };
};
ok("흐름: 2단계에 업무 추가 → 3단계는 2단계 업무 둘 다 끝나야 차례 (하나만 끝나면 기다림)", () => {
  const { pl, X, users2 } = flowCase(), t = pl.tasks, at = (s) => `2026-10-0${s}T09:00:00.000Z`;
  const D0 = { users: users2, projects: [pl.project], tasks: [...t, X] }, i0 = turnIndex(D0);
  assert.deepEqual(predsOf(t[2], i0).map((x) => x.id).sort(), [t[1].id, "tX"].sort());   // 3단계 앞 일 = 2단계 둘
  assert.deepEqual(predsOf(X, i0).map((x) => x.id), [t[0].id]);                            // 새 업무 앞 일 = 1단계
  assert.equal(turnOf(X, i0, "2026-10-03").state, "wait");
  // 1단계 끝 → 2단계 둘 다 차례
  const done = (ids) => ({ ...D0, tasks: D0.tasks.map((x) => (ids.includes(x.id) ? { ...x, status: "done", finishedAt: at(4) } : x)) });
  const D1 = done([t[0].id]), i1 = turnIndex(D1), g = (id, D, i) => turnOf(D.tasks.find((x) => x.id === id), i, "2026-10-04");
  assert.equal(g(t[1].id, D1, i1).state, "ready"); assert.equal(g("tX", D1, i1).state, "ready"); assert.equal(g(t[2].id, D1, i1).state, "wait");
  // 2단계 원래 업무만 끝 → 3단계는 아직 기다림 (새로 넣은 업무가 남음)
  const D2 = done([t[0].id, t[1].id]), i2 = turnIndex(D2);
  assert.equal(g(t[2].id, D2, i2).state, "wait"); assert.deepEqual(g(t[2].id, D2, i2).open.map((x) => x.id), ["tX"]);
  assert.equal(nextTurnText(D2.tasks.find((x) => x.id === t[1].id), i2, users2).text, "");   // 끝내도 다음 차례 아님
  // 남은 2단계 업무를 끝낼 때 '다음은 ○○님 차례' → 끝내면 3단계 차례 · 가가 '이제 내 차례'
  assert.equal(nextTurnText(D2.tasks.find((x) => x.id === "tX"), i2, users2).text, `다음은 가가님 "${t[2].title}" 차례예요`);
  const D3 = done([t[0].id, t[1].id, "tX"]), i3 = turnIndex(D3);
  assert.equal(g(t[2].id, D3, i3).state, "ready");
  const T3 = turnsOf(D3, i3, "a", new Date("2026-10-04T10:00:00"), {}, "2026-10-03T00:00:00.000Z"); assert.ok(T3.fresh.has(t[2].id));
});
ok("흐름: 중단한 업무·하위 업무는 단계 묶음에 안 셈 · 빈 단계는 건너뛰고 그 앞 단계를 기다림", () => {
  const { pl, X, users2 } = flowCase(), t = pl.tasks;
  const kid = { id: "tK", title: "하위", projectId: pl.project.id, parentId: t[1].id, status: "todo", assigneeId: "c2", assigneeIds: ["c2"], isFixed: false };
  const D = { users: users2, projects: [pl.project], tasks: [...t.map((x, i) => (i === 0 ? { ...x, status: "done" } : x)), { ...X, status: "dropped" }, kid] }, idx = turnIndex(D);
  assert.deepEqual(predsOf(t[2], idx).map((x) => x.id), [t[1].id]);                          // 중단·하위 업무 빼고
  // 2단계를 비우면(업무를 단계 미정으로) 3단계는 1단계를 기다림
  const D2 = { ...D, tasks: D.tasks.map((x) => (x.id === t[1].id ? { ...x, phase: "" } : x)) }, i2 = turnIndex(D2);
  assert.deepEqual(predsOf(t[2], i2).map((x) => x.id), [t[0].id]); assert.equal(turnOf(t[2], i2, "2026-10-04").state, "ready");
});
ok("흐름: 단계 순서를 바꿔도 고리가 안 생김 (뒤로 간 단계를 가리키는 예전 deps 는 뺌)", () => {
  const { pl } = flowCase(), t = pl.tasks, r = pl.project.road;
  const p2 = { ...pl.project, road: [r[0], r[2], r[1], ...r.slice(3)] };   // 2·3단계 바꿈
  const D = { users, projects: [p2], tasks: t }, idx = turnIndex(D);
  assert.deepEqual(predsOf(t[2], idx).map((x) => x.id), [t[0].id]);   // 예전 3단계(이제 2번째) → 1단계만
  assert.deepEqual(predsOf(t[1], idx).map((x) => x.id), [t[2].id]);   // 예전 2단계(이제 3번째) → 바뀐 앞 단계
});
ok("예전 흐름(road 칸 없음 · wfStage 만): 흐름 문서 이름으로 로드 · 새 업무(phase wf1)도 같은 규칙", () => {
  const { pl, X, users2 } = flowCase(), t = pl.tasks.map(({ phase, ...x }) => x), p0 = { ...pl.project }; delete p0.road;
  const D = { users: users2, projects: [p0], tasks: [...t, X], workflows: [{ id: "wf_promo", stages: FLOW_DEFAULTS[0].stages }] };
  const road = roadOf(p0, D); assert.deepEqual(road.map((s) => s.k).slice(0, 3), ["wf0", "wf1", "wf2"]); assert.equal(road[1].name, "기획안 컨펌");
  assert.equal(phaseOfTask(t[4], p0, D), "wf4");
  assert.deepEqual(predsOf(t[2], turnIndex(D)).map((x) => x.id).sort(), [t[1].id, "tX"].sort());
});
ok("일반 프로젝트 로드는 묶음만 — 단계로 차례를 막지 않음", () => {
  const p = { id: "pN", title: "일반", category: "ops", assigneeId: "a" };
  const ts = [{ id: "n1", projectId: "pN", phase: "plan", status: "todo", assigneeId: "a" }, { id: "n2", projectId: "pN", phase: "prep", status: "todo", assigneeId: "b" }];
  const idx = turnIndex({ users, projects: [p], tasks: ts }); assert.deepEqual(predsOf(ts[1], idx), []); assert.equal(turnOf(ts[1], idx, "2026-10-04").state, "none");
});
console.log(`\n${n}개 모두 통과`);
