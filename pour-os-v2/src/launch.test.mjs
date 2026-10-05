// node src/launch.test.mjs — 신제품 기한 자동 계산 점검
import assert from "node:assert/strict";
import * as L from "./launch.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
ok("주말·공휴일 기한은 앞 평일로 (10/5 개천절 대체공휴일 · 10/9 한글날)", () => { assert.equal(L.workday("2026-10-03"), "2026-10-02"); assert.equal(L.workday("2026-10-05"), "2026-10-02"); assert.equal(L.workday("2026-10-09"), "2026-10-08"); assert.equal(L.workday("2026-10-06"), "2026-10-06"); });
ok("기간이 넉넉하면 규칙대로 (출시 12/18 → 상세페이지 디자인 17일 전)", () => {
  assert.equal(L.launchDue("2026-12-18", -17, "2026-10-02"), "2026-12-01"); assert.equal(L.launchDue("2026-12-18", 7, "2026-10-02"), "2026-12-24");   // 12/25 성탄절 → 앞 평일
});
ok("기간이 짧으면 남은 기간에 고르게 (지난 기한 없음)", () => {
  const today = "2026-10-05", launch = "2026-10-23";
  const dues = L.LAUNCH_ITEMS.filter((i) => i.off < 0).map((i) => L.launchDue(launch, i.off, today));
  assert.ok(dues.every((d) => d >= today && d <= launch), dues.join(","));
  assert.ok(L.launchDue(launch, -56, today) <= L.launchDue(launch, -7, today));   // 순서는 그대로
});
ok("출시일이 지났으면 남은 항목 기한 = 출시일", () => { assert.equal(L.launchDue("2026-09-30", -10, "2026-10-02"), "2026-09-30"); });
ok("이름 맞추기 (정하 → 용정하, '이우민, 외주' → 이우민)", () => {
  const users = [{ id: "u1", name: "용정하" }, { id: "u2", name: "이우민" }, { id: "u3", name: "김민지", active: false }, { id: "u4", name: "김민지2" }];
  assert.equal(L.userByName(users, "정하").id, "u1"); assert.equal(L.userByName(users, "이우민, 외주").id, "u2"); assert.equal(L.userByName(users, "없는사람"), null);
});
ok("v1 제품 → 프로젝트 1 + 항목 업무, 건너뜀(skip)·삭제 제품은 빼고, 사람이 정한 기한 유지", () => {
  const users = [{ id: "jh", name: "용정하" }, { id: "sh", name: "김송희" }];
  const prods = [{ id: "A", name: "루바월", brand: "grohome", launchDate: "2026-10-16", stages: { p01: { status: "done", owner: "정하" }, s01: { status: "skip" }, s06: { due: "2026-10-01", owner: "모르는사람" } } },
    { id: "B", name: "삭제", deletedAt: "x", stages: {} }, { id: "board-settings" }];
  const r = L.planLaunchImport(prods, { users }, "2026-10-02");
  assert.equal(r.projects.length, 1); assert.equal(r.projects[0].assigneeId, "sh");   // 그로홈 BM
  assert.deepEqual(r.projects[0].skipItems, ["s01"]); assert.deepEqual(r.skipped, ["lb_A:s01"]);   // 건너뛴 항목은 프로젝트에 기록(순서표 거슬러 올라감)
  assert.equal(r.tasks.length, L.LAUNCH_ITEMS.length - 1);
  const p01 = r.tasks.find((t) => t.launchItem === "p01"), s06 = r.tasks.find((t) => t.launchItem === "s06");
  assert.equal(p01.status, "done"); assert.equal(p01.assigneeId, "jh");
  assert.equal(s06.dueDate, "2026-10-01"); assert.equal(s06.dueAuto, false); assert.equal(s06.ownerText, "모르는사람");
  assert.ok(r.tasks.every((t) => t.noReview));
});
ok("새 신제품: 기본 담당은 예전에 가장 많이 맡은 사람, 출시일 바꾸면 자동 기한만 이동", () => {
  const D = { users: [{ id: "a", name: "가" }, { id: "b", name: "나" }], tasks: [{ launchItem: "s07", assigneeId: "b" }, { launchItem: "s07", assigneeId: "b" }, { launchItem: "s07", assigneeId: "a" }], workflows: [] };
  const r = L.planNewLaunch({ name: "새 제품", brand: "grohome", launchDate: "2026-12-18", leadId: "a" }, D, { id: "a" }, "2026-10-02");
  assert.equal(r.tasks.find((t) => t.launchItem === "s07").assigneeId, "b"); assert.equal(r.tasks.find((t) => t.launchItem === "s01").assigneeId, "a");
  assert.equal(r.late, 0); assert.equal(r.squeezed, false);
  const moved = { ...r.tasks.find((t) => t.launchItem === "s08"), dueAuto: false, dueDate: "2026-11-30" };
  const ts = r.tasks.map((t) => (t.launchItem === "s08" ? moved : t));
  const ch = L.relaunch(ts, "2026-12-25", "2026-10-02");
  assert.ok(ch.length > 30); assert.ok(!ch.some((x) => x.task.launchItem === "s08"));
});
ok("오늘이 토요일이어도 새 기한이 지난 날(금)이 되지 않음", () => {
  const today = "2026-10-03";   // 토
  const dues = L.LAUNCH_ITEMS.map((i) => L.launchDue("2026-10-30", i.off, today));
  assert.ok(dues.every((d) => d >= today), dues.filter((d) => d < today).join(","));
  assert.equal(L.launchDue("2026-10-30", -56, today), "2026-10-06");   // 다음 평일 (10/5 대체공휴일 건너뜀)
});
ok("순서표: 모든 화살표에서 앞 항목이 더 이른 규칙 기한 (같은 날 금지), 시작 항목은 시장조사뿐", () => {
  for (const [k, v] of Object.entries(L.LAUNCH_AFTER)) { const o = L.LAUNCH_ITEMS.find((i) => i.id === k); assert.ok(o, k);
    v.forEach((a) => { const q = L.LAUNCH_ITEMS.find((i) => i.id === a); assert.ok(q, a); assert.ok(q.off < o.off, `${a} → ${k}`); }); }
  assert.deepEqual(L.LAUNCH_ITEMS.filter((i) => !L.LAUNCH_AFTER[i.id]).map((i) => i.id), ["p01"]);
});
ok("앞 업무 찾기: 건너뛴 항목만 그 앞으로 거슬러 올라감, 그 밖에 없는 항목은 끝난 것으로(불러오지 않은 오래전 끝난 항목)", () => {
  const byId = new Map([["P__s06", { id: "P__s06" }], ["P__p04", { id: "P__p04" }]]);
  assert.deepEqual(L.launchPreds({ projectId: "P", launchItem: "s07" }, byId).map((x) => x.id), ["P__s06"]);                          // s01 없음 = 끝남
  assert.deepEqual(L.launchPreds({ projectId: "P", launchItem: "s07" }, byId, new Set(["s01"])).map((x) => x.id).sort(), ["P__p04", "P__s06"]);   // s01 건너뜀 → p04
  assert.deepEqual(L.launchPreds({ projectId: "P", launchItem: "s07" }, byId, ["s01"]).map((x) => x.id).sort(), ["P__p04", "P__s06"]);
  assert.deepEqual(L.launchPreds({ projectId: "P", launchItem: "s07" }, byId, () => true).map((x) => x.id).sort(), ["P__p04", "P__s06"]);
  // 선택 항목(구성품 x_parts)은 없으면 늘 거슬러 올라감 — 순서표 뒤 항목이 없어 표를 바꿔 보지는 않고 OPTIONAL 판정만 확인
  assert.ok(L.LAUNCH_ITEMS.find((i) => i.id === "x_parts").optional);
});
ok("가져오기: 항목별 끝낸 시각·끝낸 사람, 담당 출처(v1·기본·임시)", () => {
  const users = [{ id: "jh", name: "용정하" }, { id: "sh", name: "김송희" }, { id: "wm", name: "이우민" }];
  const prods = [{ id: "A", name: "A", brand: "grohome", launchDate: "2026-12-18", updatedAt: "2026-10-01T00:00:00Z", stages: { p01: { status: "done", owner: "정하", doneAt: "2026-09-20T03:00:00Z", doneBy: "허지은" }, s03: { owner: "이우민" } } },
    { id: "B", name: "B", brand: "grohome", launchDate: "2026-12-18", stages: { s03: { owner: "이우민" } } }];
  const r = L.planLaunchImport(prods, { users, workflows: [] }, "2026-10-02");
  const p01 = r.tasks.find((t) => t.id === "lb_A__p01"); assert.equal(p01.doneAt, "2026-09-20T03:00:00Z"); assert.equal(p01.finishedAt, "2026-09-20T03:00:00Z"); assert.equal(p01.ownerFrom, "v1");
  assert.equal(r.tasks.find((t) => t.id === "lb_B__s03").ownerFrom, "v1");
  const x = r.tasks.find((t) => t.id === "lb_B__x_rv_mall"); assert.equal(x.ownerFrom, "lead"); assert.equal(x.assigneeId, "sh");
  const D = { users, projects: r.projects, tasks: r.tasks };
  assert.equal(L.isTempOwner(x, D), true); assert.equal(L.isTempOwner(p01, D), false);
  assert.equal(L.ownerDefaults({ users, tasks: r.tasks }).x_rv_mall, undefined);   // 임시로 채운 담당은 기본값이 되지 않음
});
ok("신제품 % 는 항목으로 계산 · 기한 다시 나누기는 자동 기한만, 평일·공휴일 피해서, 순서 지킴", () => {
  const D = { users: [{ id: "a", name: "가" }], workflows: [], tasks: [] };
  const r = L.planNewLaunch({ name: "N", brand: "grohome", launchDate: "2026-10-23", leadId: "a" }, D, { id: "a" }, "2026-10-02");
  assert.equal(L.launchPct(r.project, { tasks: r.tasks }), 0);
  const ts = r.tasks.map((t, i) => (i < 5 ? { ...t, status: "done" } : t));
  assert.equal(L.launchPct(r.project, { tasks: ts }), Math.round((5 / r.tasks.length) * 100));
  const fixed = { ...ts[10], dueAuto: false, dueDate: "2026-10-20" }; const ts2 = ts.map((t, i) => (i === 10 ? fixed : t));
  const ch = L.rebalanceLaunch(ts2, "2026-10-23", "2026-10-02");
  assert.ok(!ch.some((x) => x.task.id === fixed.id)); assert.ok(!ch.some((x) => x.task.status === "done"));
  const due = Object.fromEntries(ts2.map((t) => [t.launchItem, (ch.find((x) => x.task.id === t.id) || {}).due || t.dueDate]));
  ch.forEach((x) => { const w = new Date(x.due + "T00:00:00").getDay(); assert.ok(w !== 0 && w !== 6 && x.due !== "2026-10-05" && x.due !== "2026-10-09", x.due); });
  for (const [k, v] of Object.entries(L.LAUNCH_AFTER)) v.forEach((a) => { if (a !== fixed.launchItem && k !== fixed.launchItem && due[a] && due[k] && L.LAUNCH_ITEMS.find((i) => i.id === k).off < 0) assert.ok(due[a] <= due[k], `${a} ${due[a]} → ${k} ${due[k]}`); });
  const per = {}; Object.values(due).forEach((d) => (per[d] = (per[d] || 0) + 1)); const before = {}; r.tasks.forEach((t) => (before[t.dueDate] = (before[t.dueDate] || 0) + 1));
  assert.ok(Math.max(...Object.values(per)) <= Math.max(...Object.values(before)));
});
ok("기한 다시 나누기: 사람이 정한 뒤 항목 기한을 넘지 않고, 사람이 정한 앞 항목 기한보다 앞서지 않음 (순서 꼬임 새로 안 만듦)", () => {
  const D = { users: [{ id: "a", name: "가" }], workflows: [], tasks: [] };
  const r = L.planNewLaunch({ name: "N", brand: "grohome", launchDate: "2026-10-23", leadId: "a" }, D, { id: "a" }, "2026-10-02");
  // s06(상세페이지 기획)을 사람이 10/08 로 → s02(판매전략)·그 앞 항목은 10/08 을 넘으면 안 됨
  const ts = r.tasks.map((t) => (t.launchItem === "s06" ? { ...t, dueAuto: false, dueDate: "2026-10-08" } : t));
  const ch = L.rebalanceLaunch(ts, "2026-10-23", "2026-10-06");
  const due = Object.fromEntries(ts.map((t) => [t.launchItem, (ch.find((x) => x.task.id === t.id) || {}).due || t.dueDate]));
  assert.ok(due.s02 <= "2026-10-08", due.s02); assert.ok(due.x_test <= due.s02 && due.p03 <= due.s02);
  assert.ok(due.s07 >= "2026-10-08" && due.s09 >= "2026-10-08");   // 뒤 항목은 사람이 정한 기한 뒤로
  for (const [k, v] of Object.entries(L.LAUNCH_AFTER)) v.forEach((a) => { if (due[a] && due[k] && L.LAUNCH_ITEMS.find((i) => i.id === k).off < 0) assert.ok(due[a] <= due[k], `${a} ${due[a]} → ${k} ${due[k]}`); });
  ch.forEach((x) => { const w = new Date(x.due + "T00:00:00").getDay(); assert.ok(w !== 0 && w !== 6 && x.due !== "2026-10-09" && x.due >= "2026-10-06", x.due); });   // 평일·오늘 이후
  // 사람이 정한 앞 항목(s02 10/20) → 자동 뒤 항목(s06·s07…)은 그보다 앞서지 않음
  const ts2 = r.tasks.map((t) => (t.launchItem === "s02" ? { ...t, dueAuto: false, dueDate: "2026-10-20" } : t));
  const ch2 = L.rebalanceLaunch(ts2, "2026-10-23", "2026-10-06");
  const due2 = Object.fromEntries(ts2.map((t) => [t.launchItem, (ch2.find((x) => x.task.id === t.id) || {}).due || t.dueDate]));
  assert.ok(due2.s06 >= "2026-10-20" && due2.s08 >= due2.s07 && due2.s11 >= due2.s10, JSON.stringify([due2.s06, due2.s07, due2.s08, due2.s11]));
});
ok("보류·확인 대기 항목은 출시일 옮기기·기한 다시 나누기에서 그대로", () => {
  const D = { users: [{ id: "a", name: "가" }], workflows: [], tasks: [] };
  const r = L.planNewLaunch({ name: "N", brand: "grohome", launchDate: "2026-10-23", leadId: "a" }, D, { id: "a" }, "2026-10-02");
  const ts = r.tasks.map((t) => (t.launchItem === "x_test" ? { ...t, status: "hold" } : t.launchItem === "s02" ? { ...t, status: "review" } : t));
  const ch = L.rebalanceLaunch(ts, "2026-10-23", "2026-10-06"), mv = L.relaunch(ts, "2026-11-06", "2026-10-06");
  assert.ok(ch.length > 0 && mv.length > 0);
  [ch, mv].forEach((a) => assert.ok(!a.some((x) => x.task.launchItem === "x_test" || x.task.launchItem === "s02")));
});
ok("연결 1단계: 담당 이름 → 업무OS 사람 번호 (짧은 이름 · 여러 명 · 외주 · 겹치는 이름은 안 맞춤)", () => {
  const users = [{ id: "minji", name: "김민지" }, { id: "jh", name: "용정하" }, { id: "wm", name: "이우민" }, { id: "x1", name: "김윤정" }, { id: "x2", name: "남윤정" }, { id: "old", name: "박정하", active: false }];
  assert.equal(L.osIdOf("민지", users), "minji"); assert.equal(L.osIdOf("정하", users), "jh");   // 미사용 박정하는 빼고 하나
  assert.equal(L.osIdOf("윤정", users), "");    // 김윤정·남윤정 둘 다 → 못 맞춤
  assert.equal(L.osIdOf("외주", users), ""); assert.equal(L.osIdOf("이우민", users), "wm");
  assert.deepEqual(L.ownerIdsOf("민지, 이우민, 외주", users), ["minji", "wm"]);
  const prods = [{ id: "a", name: "A", stages: { d01: { owner: "민지" }, s03: { owner: "이우민", ownerIds: ["wm"] }, p01: { owner: "윤정" }, s12: { owner: "" } } },
    { id: "board-structure", __structure: true }, { id: "z", deletedAt: "x", stages: { d01: { owner: "민지" } } }];
  const pl = L.planOwnerIds(prods, users);
  assert.deepEqual(pl.changes.map((c) => c.sid + ":" + c.ids.join("")), ["d01:minji"]);   // 이미 맞는 s03 · 휴지통 · 구조 문서는 뺌
  assert.deepEqual(pl.miss, [["윤정", 1]]); assert.equal(pl.products, 1);
});
ok("연결 1단계: 가져올 때 ownerIds 가 있으면 여러 명 그대로", () => {
  const users = [{ id: "minji", name: "김민지" }, { id: "wm", name: "이우민" }];
  const r = L.planLaunchImport([{ id: "P", name: "제품", brand: "grohome", launchDate: "2026-11-20", stages: { d01: { owner: "민지, 이우민", ownerIds: ["minji", "wm"] }, s03: { owner: "이우민" } } }], { users }, "2026-10-05");
  const t = (id) => r.tasks.find((x) => x.launchItem === id);
  assert.deepEqual(t("d01").assigneeIds, ["minji", "wm"]); assert.equal(t("d01").assigneeId, "minji");
  assert.deepEqual(t("s03").assigneeIds, ["wm"]);
});
console.log(`\n${n}개 모두 통과`);
