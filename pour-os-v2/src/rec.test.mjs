// node src/rec.test.mjs — 하루 기록 DB 계산 (rec.js · 반복 실행 3단계)
import assert from "node:assert/strict";
import { dayIdFx, dayIdAk, openIdAk, qtyCfg, qtyToGoal, qtyNum, qtyText, dayBase, dayAdd, dayFix, roundTap, roundOn, recRows, recTable, recCsv, qtySum } from "./rec.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const cu = { id: "mini", name: "윤미니" }, at = "2026-10-06T06:00:00.000Z";
ok("문서 id", () => { assert.equal(dayIdFx("t1", "mini", "2026-10-06"), "t1~mini~2026-10-06"); assert.equal(dayIdAk("ak_a", "mini", "2026-10-06"), "ak~ak_a~mini~2026-10-06"); assert.equal(openIdAk("ak_a", "mini"), "ak~ak_a~mini~open"); });
ok("건수 칸: 단위 없으면 꺼짐 · 이름 비면 '건수'", () => { assert.equal(qtyCfg({}), null); assert.equal(qtyCfg({ qty: { label: "", unit: "" } }), null); assert.deepEqual(qtyCfg({ qty: { label: "처리한 문의", unit: "건" } }), { label: "처리한 문의", unit: "건" }); assert.equal(qtyCfg({ qty: { unit: "명" } }).label, "건수"); assert.equal(qtyText({ label: "처리한 문의", unit: "건" }, 23), "문의 23건"); });
ok("단위 규칙(결정 3): 건·명·개 = 목표에도 더함 · 회 = 기록만 · %·실패 기준은 그대로", () => {
  assert.equal(qtyToGoal({ unit: "건" }), true); assert.equal(qtyToGoal({ unit: "명" }), true); assert.equal(qtyToGoal({ unit: "개" }), true);
  assert.equal(qtyToGoal({ unit: "회" }), false); assert.equal(qtyToGoal({ unit: "%" }), false); assert.equal(qtyToGoal({ unit: "건", perFail: 3 }), false); assert.equal(qtyToGoal({}), false); });
ok("숫자 칸: 쉼표 허용 · 음수·소수·빈칸 안 됨", () => { assert.equal(qtyNum("1,200"), 1200); assert.equal(qtyNum(" 37 "), 37); assert.equal(qtyNum("-1"), null); assert.equal(qtyNum("2.5"), null); assert.equal(qtyNum(""), null); assert.equal(qtyNum("0"), 0); });
ok("그날 문서: 처음엔 통째 · 그다음엔 runs·qty 더하기 · 기록 한 줄씩", () => {
  const base = dayBase("ak", { id: "ak_a", brand: "pourstore" }, cu, "2026-10-06");
  assert.deepEqual([base.kind, base.akId, base.itemId, base.ym, base.wk], ["ak", "ak_a", "ak_a", "2026-10", "2026-10-05"]);
  const w1 = dayAdd(null, base, { runs: 1, via: "btn" }, cu, at); assert.equal(w1.runs, 1); assert.equal(w1.qty, 0); assert.equal(w1.kind, "ak"); assert.equal(w1.recs.length, 1);
  const w2 = dayAdd(w1, base, { qty: 37 }, cu, at); assert.equal(w2.runs, 1); assert.equal(w2.qty, 37); assert.equal(w2.kind, undefined); assert.equal(w2.recs.length, 2);
  const w3 = dayAdd({ ...w1, ...w2 }, base, { runs: -1 }, cu, at); assert.equal(w3.runs, 0); assert.equal(w3.qty, 37);
  const fx = dayBase("fx", { id: "t1", brand: "common", scope: "brand" }, cu, "2026-10-06"); assert.deepEqual([fx.kind, fx.taskId, fx.scope], ["fx", "t1", "brand"]); });
ok("고치기: set + 이전 값 기록 · 차이", () => { const f = dayFix({ qty: 37, recs: [{ d: 37 }] }, {}, 40, cu, at); assert.equal(f.write.qty, 40); assert.equal(f.delta, 3); assert.equal(f.write.recs[1].prev, 37); assert.equal(f.write.recs[1].set, 40);
  const g = dayFix(null, { kind: "fx" }, 5, cu, at); assert.equal(g.write.kind, "fx"); assert.equal(g.delta, 5); });
ok("체크리스트 한 바퀴: 다 켜면 complete 한 번 · subs 비움 · 끄면 다시 꺼짐 · 다음 바퀴는 빈 칩", () => {
  const L = [{ id: "a", title: "명단" }, { id: "b", title: "전화" }, { id: "c", title: "결과" }];
  let r = roundTap(null, L, "a", at); assert.equal(r.complete, false); assert.equal(roundOn(r, L), 1);
  r = roundTap(r, L, "b", at); assert.equal(r.complete, false); r = roundTap(r, L, "b", at); assert.equal(roundOn(r, L), 1);
  r = roundTap(r, L, "b", at); r = roundTap(r, L, "c", at); assert.equal(r.complete, true); assert.deepEqual(r.subs, {}); assert.equal(roundOn(r, L), 0);
  assert.equal(roundTap(null, [], "x", at).complete, false); });
ok("날짜별 기록 줄 · 날짜×사람 표 · CSV · 오늘 합", () => {
  const docs = [{ id: "1", kind: "ak", itemId: "ak_a", uid: "mini", name: "윤미니", date: "2026-10-06", ym: "2026-10", runs: 1, qty: 37 }, { id: "2", kind: "ak", itemId: "ak_a", uid: "mini", name: "윤미니", date: "2026-10-02", ym: "2026-10", runs: 0, qty: 12 },
    { id: "3", kind: "akopen", uid: "mini", subs: { a: at } }, { id: "4", kind: "fx", itemId: "t1", uid: "songhee", name: "김송희", date: "2026-10-06", ym: "2026-10", on: true, qty: 23 }, { id: "5", kind: "ak", itemId: "ak_a", uid: "x", date: "2026-10-01", ym: "2026-10", runs: 0, qty: 0 }];
  const rows = recRows(docs.filter((d) => d.itemId === "ak_a")); assert.deepEqual(rows.map((r) => r.date), ["2026-10-06", "2026-10-02"]);
  const T = recTable(docs, "2026-10"); assert.deepEqual(T.days, ["2026-10-02", "2026-10-06"]); assert.equal(T.cell("2026-10-06", "mini").qty, 37); assert.equal(T.cell("2026-10-06", "songhee").on, 1); assert.equal(T.cell("2026-10-01", "x"), null);
  const csv = recCsv(docs, () => "항목"); assert.ok(csv.startsWith("﻿")); assert.equal(csv.split("\n").length, 4);
  assert.equal(qtySum(docs, "ak_a"), 49); assert.equal(qtySum(docs, "t1", "songhee"), 23); });
console.log(`${n}개 모두 통과`);
