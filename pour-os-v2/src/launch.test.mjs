// node src/launch.test.mjs — 신제품 기한 자동 계산 점검
import assert from "node:assert/strict";
import * as L from "./launch.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
ok("주말 기한은 앞 금요일로", () => { assert.equal(L.workday("2026-10-03"), "2026-10-02"); assert.equal(L.workday("2026-10-04"), "2026-10-02"); assert.equal(L.workday("2026-10-05"), "2026-10-05"); });
ok("기간이 넉넉하면 규칙대로 (출시 12/18 → 상세페이지 디자인 17일 전)", () => {
  assert.equal(L.launchDue("2026-12-18", -17, "2026-10-02"), "2026-12-01"); assert.equal(L.launchDue("2026-12-18", 7, "2026-10-02"), "2026-12-25");
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
  assert.equal(L.launchDue("2026-10-30", -56, today), "2026-10-05");   // 다음 평일(월)
});
console.log(`\n${n}개 모두 통과`);
