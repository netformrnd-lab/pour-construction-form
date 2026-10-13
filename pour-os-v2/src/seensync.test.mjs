// node src/seensync.test.mjs — 읽음 표시 폰·PC 같이 (2026-10-13) 계산 점검
import assert from "node:assert/strict";
import * as S from "./seensync.js";
import * as M from "./model.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const DEL = { __del: true }, isDel = (v) => v === DEL;
const AT = "2026-10-13T09:00:00.000Z";

ok("바뀐 키만: 더한 키 = 읽은 때 · 뺀 키 = 지움 · 이미 읽은 키를 또 읽어도 안 씀", () => {
  const cur = { "nt:a": "2026-10-12T01:00:00.000Z", "ap:t1x": true };
  assert.deepEqual(S.seenDiff(cur, { ...cur, "nt:b": true }), { add: ["nt:b"], del: [] });
  assert.deepEqual(S.seenPatch(cur, { ...cur, "nt:b": true }, AT, DEL), { "nt:b": AT });
  assert.equal(S.seenPatch(cur, { ...cur, "nt:a": true }, AT, DEL), null);            // 다시 읽음 → 쓰기 없음 (읽은 때 그대로)
  assert.deepEqual(S.seenPatch(cur, M.unseePatch(cur, ["nt:a"]), AT, DEL), { "nt:a": DEL });   // [안 읽음으로]
});
ok("묶은 줄(a|b): 줄 id 와 낱개 모두 읽음 · [안 읽음으로]는 모두 지움", () => {
  const next = { "pn:u1x|pn:u2y": true, "pn:u1x": true, "pn:u2y": true };
  const ids = S.seenPatch({}, next, AT, DEL);
  assert.deepEqual(Object.keys(ids).sort(), ["pn:u1x", "pn:u1x|pn:u2y", "pn:u2y"]);
  const v = S.applySeen({}, ids, isDel);
  assert.equal(M.seenAll(v, "pn:u1x|pn:u2y"), true);
  const back = S.seenPatch(v, M.unseePatch(v, ["pn:u1x|pn:u2y"]), AT, DEL);
  assert.deepEqual(Object.values(back).every(isDel), true); assert.equal(Object.keys(back).length, 3);
});
ok("두 기기가 따로 써도 서로 안 지움 (합치기 = 바뀐 키만)", () => {
  // 서버 = {a} · 폰이 b 읽음 · PC 가 c 읽음 (둘 다 서버 {a} 를 본 상태)
  const server0 = { "nt:a": AT };
  const phone = S.seenPatch(server0, { ...server0, "nt:b": true }, AT, DEL), pc = S.seenPatch(server0, { ...server0, "nt:c": true }, AT, DEL);
  const server = S.applySeen(S.applySeen(server0, phone, isDel), pc, isDel);
  assert.deepEqual(Object.keys(server).sort(), ["nt:a", "nt:b", "nt:c"]);
  // PC 가 a 를 [안 읽음으로] · 폰은 그사이 d 읽음 → a 만 빠지고 d 는 남음
  const pc2 = S.seenPatch(server, M.unseePatch(server, ["nt:a"]), AT, DEL), phone2 = S.seenPatch(server, { ...server, "nt:d": true }, AT, DEL);
  const server2 = S.applySeen(S.applySeen(server, pc2, isDel), phone2, isDel);
  assert.deepEqual(Object.keys(server2).sort(), ["nt:b", "nt:c", "nt:d"]);
});
ok("오래된 키 정리: 400개 넘을 때만 · 60일 넘은 것 · 한 번에 300개까지 · 방금 바꾼 키는 건드리지 않음", () => {
  const old = "2026-07-01T00:00:00.000Z", fresh = "2026-10-01T00:00:00.000Z";
  const few = Object.fromEntries(Array.from({ length: 50 }, (_, i) => ["nt:o" + i, old]));
  assert.deepEqual(S.seenPatch(few, { ...few, "nt:new": true }, AT, DEL), { "nt:new": AT });   // 400개 이하 → 정리 안 함
  const many = { ...Object.fromEntries(Array.from({ length: 350 }, (_, i) => ["nt:o" + i, old])), ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => ["nt:f" + i, fresh])), "nt:legacy": true };
  const ids = S.seenPatch(many, { ...many, "nt:new": true }, AT, DEL);
  const dels = Object.keys(ids).filter((k) => isDel(ids[k]));
  assert.equal(ids["nt:new"], AT); assert.equal(dels.length, S.SEEN_PRUNE_MAX);
  assert.ok(dels.every((k) => k.startsWith("nt:o")));               // 60일 넘은 것만 (최근 것·예전 true 값은 그대로)
  const after = S.applySeen(many, ids, isDel); assert.equal(Object.keys(after).length, 452 - S.SEEN_PRUNE_MAX);
});
ok("이 기기 처음 한 번: 이 기기에만 있던 읽음 중 서버에 없는 것만 올림 · 400개씩 나눔", () => {
  const local = { "nt:a": true, "nt:b": true, "nt:c": false }, remote = { "nt:a": "2026-10-10T00:00:00.000Z" };
  assert.deepEqual(S.seenUpload(local, remote, AT), [{ "nt:b": AT }]);
  assert.deepEqual(S.seenUpload({}, remote, AT), []);
  assert.deepEqual(S.seenUpload(local, null, AT), [{ "nt:a": AT, "nt:b": AT }]);
  const big = Object.fromEntries(Array.from({ length: 900 }, (_, i) => ["k" + i, true]));
  const ch = S.seenUpload(big, {}, AT); assert.deepEqual(ch.map((c) => Object.keys(c).length), [400, 400, 100]);
});
ok("기한 조정 결과 알림도 최근 7일만 (정리한 읽음 키가 다시 뜨지 않게)", () => {
  const now = new Date("2026-10-13T09:00:00+09:00");
  const users = [{ id: "a", name: "가", active: true }, { id: "b", name: "나", active: true }];
  const mk = (at) => ({ users, projects: [], notes: [], tasks: [{ id: "t1", title: "업무", status: "todo", assigneeId: "a", ackAt: at, dueReqResult: { ok: true, date: "2026-10-20", by: "b", byName: "나", at } }] });
  const has = (D) => M.todayView(D, "a", now, {}).inbox.some((x) => x.kind === "dueRes");
  assert.equal(has(mk("2026-10-12T01:00:00.000Z")), true);
  assert.equal(has(mk("2026-09-01T01:00:00.000Z")), false);
});
console.log(`\n${n}개 통과`);
