// 업무OS → 신제품 대시보드 반영 (lbpush.planLaunchPush) 계산 시험
import assert from "node:assert/strict";
import * as L from "./lbpush.js";
import * as S from "./lbsync.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "minji", name: "김민지" }, { id: "wm", name: "이우민" }, { id: "jh", name: "용정하" }];
const today = "2026-10-05", now = "2026-10-05T03:00:00.000Z";
const P = (stages, extra) => ({ id: "P", name: "제품", launchDate: "2026-11-20", stages, ...(extra || {}) });
const T = (item, f) => ({ id: "lb_P__" + item, projectId: "lb_P", launchItem: item, status: "todo", assigneeId: "wm", assigneeIds: ["wm"], dueDate: "2026-10-20", dueAuto: true, memo: "", ...(f || {}) });
const proj = (f) => ({ id: "lb_P", title: "제품", launchDate: "2026-11-20", lbSeen: { launchDate: "2026-11-20", name: "제품" }, ...(f || {}) });
const base = { status: "todo", owners: ["wm"], due: "", note: "" };
const st = { status: "todo", owner: "이우민", ownerIds: ["wm"], due: "", note: "", updatedAt: "2026-10-01T00:00:00Z" };

ok("업무OS만 바뀜 → 신제품에 씀 (진행 중 · 담당 · 메모) + 기억 새로 · 고친 칸만", () => {
  const r = L.planLaunchPush(P({ d01: st }), proj(), [T("d01", { lbSeen: base, status: "inprogress", assigneeIds: ["minji", "jh"], assigneeId: "minji", memo: "샘플 왔음" })], users, now, "김민지");
  const f = r.board.fields;
  assert.equal(f["stages.d01.status"], "doing"); assert.equal(f["stages.d01.owner"], "김민지, 용정하"); assert.deepEqual(f["stages.d01.ownerIds"], ["minji", "jh"]);
  assert.equal(f["stages.d01.note"], "샘플 왔음"); assert.equal(f["stages.d01.updatedBy"], "김민지 (업무OS)");
  assert.equal(r.board.expect["stages.d01.updatedAt"], "2026-10-01T00:00:00Z");
  assert.deepEqual(r.tasks[0].lbSeen, { status: "doing", owners: ["minji", "jh"], due: "", note: "샘플 왔음" });
});
ok("신제품도 바뀌었으면 안 씀 (lbsync 몫) · 아무것도 안 바뀌면 쓸 것 없음", () => {
  const r = L.planLaunchPush(P({ d01: { ...st, status: "done", due: "2026-10-30" } }), proj(), [T("d01", { lbSeen: base, status: "inprogress", dueDate: "2026-10-30", dueAuto: false })], users, now, "x");
  assert.equal(r.board, null);
  const z = L.planLaunchPush(P({ d01: { ...st, due: "2026-10-20", dueAuto: "2026-10-20" } }), proj(), [T("d01", { lbSeen: base })], users, now, "x");
  assert.equal(z.board, null);
});
ok("기한: 자동이면 자동 날짜 + 자동 표시(기록·고친 시각 안 바뀜) · 사람이 정하면 그 날짜 · 신제품 '미정'이면 자동으로 안 덮음", () => {
  const a = L.planLaunchPush(P({ d01: st }), proj(), [T("d01", { lbSeen: base })], users, now, "x");
  assert.equal(a.board.fields["stages.d01.due"], "2026-10-20"); assert.equal(a.board.fields["stages.d01.dueAuto"], "2026-10-20");
  assert.ok(!("stages.d01.updatedAt" in a.board.fields)); assert.deepEqual(a.board.said, []);
  const m = L.planLaunchPush(P({ d01: { ...st, due: "2026-10-20", dueAuto: "2026-10-20" } }), proj(), [T("d01", { lbSeen: base, dueDate: "2026-10-25", dueAuto: false })], users, now, "x");
  assert.equal(m.board.fields["stages.d01.due"], "2026-10-25"); assert.equal(m.board.fields["stages.d01.dueAuto"], ""); assert.equal(m.tasks[0].lbSeen.due, "2026-10-25");
  const tbd = L.planLaunchPush(P({ d01: { ...st, dueTbd: true } }), proj(), [T("d01", { lbSeen: base })], users, now, "x");
  assert.equal(tbd.board, null);
});
ok("신제품에서 자동 날짜를 바꾸면 사람이 정한 마감으로 읽힘 (자동 표시 풀림)", () => {
  const b = S.boardVals(P({ d01: { ...st, due: "2026-10-22", dueAuto: "2026-10-20" } }), { id: "d01", lb: true }, users);
  assert.equal(b.due, "2026-10-22");
  const a = S.boardVals(P({ d01: { ...st, due: "2026-10-20", dueAuto: "2026-10-20" } }), { id: "d01", lb: true }, users);
  assert.equal(a.due, "");
});
ok("확인 대기 → 신제품 '진행 중' · 해당 없음 → skip · 프로젝트째 접힌 업무는 상태 안 씀 · 외주 이름은 남김", () => {
  const r = L.planLaunchPush(P({ d01: st, s03: { ...st, owner: "이우민, 외주 홍길동" }, d02: st }), proj(), [
    T("d01", { lbSeen: base, status: "review" }), T("s03", { lbSeen: base, assigneeIds: ["jh"] }), T("d02", { lbSeen: base, status: "hold", holdBy: "proj" })], users, now, "x");
  const f = r.board.fields;
  assert.equal(f["stages.d01.status"], "doing"); assert.equal(f["stages.s03.owner"], "용정하, 외주 홍길동"); assert.ok(!("stages.d02.status" in f));
  const au = L.planLaunchPush(P({ d01: { ...st, owner: "", ownerIds: [] } }), proj(), [T("d01", { lbSeen: { ...base, owners: [] }, ownerAuto: true, dueDate: "2026-10-20" })], users, now, "x");
  assert.ok(!au.board || !("stages.d01.owner" in au.board.fields));
  const k = L.planLaunchPush(P({ d01: st }), proj(), [T("d01", { lbSeen: base, status: "dropped", lbSkip: true })], users, now, "x");
  assert.equal(k.board.fields["stages.d01.status"], "skip");
});
ok("출시일·이름: 업무OS만 바뀌면 제품에 씀 (+ 기대값) · 신제품도 바뀌면 안 씀", () => {
  const r = L.planLaunchPush(P({}), proj({ launchDate: "2026-11-27", title: "새 이름" }), [], users, now, "x");
  assert.equal(r.board.fields.launchDate, "2026-11-27"); assert.equal(r.board.fields.name, "새 이름"); assert.equal(r.board.expect.launchDate, "2026-11-20");
  assert.deepEqual(r.project.lbSeen, { launchDate: "2026-11-27", name: "새 이름" });
  const z = L.planLaunchPush(P({}, { launchDate: "2026-12-01" }), proj({ launchDate: "2026-11-27" }), [], users, now, "x");
  assert.equal(z.board, null);
});
ok("되돌아옴(에코) 없음: 쓴 뒤 신제품 값으로 lbsync 를 돌리면 바뀔 것 없음", () => {
  const t = T("d01", { lbSeen: base, status: "inprogress", memo: "메모", dueDate: "2026-10-25", dueAuto: false, v2At: "2026-10-05T02:00:00Z" });
  const r = L.planLaunchPush(P({ d01: st }), proj(), [t], users, now, "x");
  const stages = { d01: { ...st } }; Object.entries(r.board.fields).forEach(([k, v]) => { const [, , f] = k.split("."); stages.d01[f] = v; });
  const back = S.planLaunchSync(P(stages), proj(), [{ ...t, lbSeen: r.tasks[0].lbSeen }], users, today, now);
  assert.equal(back.tasks.length, 0);
});
console.log(`${n}개 모두 통과`);
