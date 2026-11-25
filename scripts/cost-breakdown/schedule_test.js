// 분해원가 '일정' 계산 시험 (가짜 숫자) — 2026-11-25
// 영업일(주말·한국 공휴일 뺌) · 리드타임 글자 → 숫자 · 단계 · 병목 · 업체 바꾸면 상차 가능일
// 사용: node schedule_test.js [pourstore-cost.html]
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const file = process.argv[2] || path.join(__dirname, "..", "..", "pourstore-cost.html");
const src = fs.readFileSync(file, "utf8").match(/<script id="pcc-core">([\s\S]*?)<\/script>/)[1];
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.PCC;
let n = 0; const ok = (name, f) => { f(); n++; console.log("  ✓", name); };
const V = (vid, price, o = {}) => ({ vid, alias: "", price, vat: "V-", cur: "", moq: "", lead: "", qd: "견적", vu: "", memo: "", ...o });
const R = (id, kind, name, vendors, sel = "A") => C.syncRow({ id, kind, name, inMfg: "별도", per: kind === "1회 비용" ? "1회" : "개당", usage: 1, st: "", sel, vendors });
const TODAY = "2026-11-25";   // 수요일
const base = () => ({ qty: 1000, rows: [
  R("m1", "내용물", "원료", [V("A", 2000, { lead: "2주" }), V("B", 1900, { lead: 60 })]),
  R("m2", "용기", "용기", [V("A", 300, { lead: "10일" }), V("B", 280, { lead: 15, ship: 20 })]),
  R("p1", "라벨", "라벨", [V("A", 40, { lead: "" }), V("B", 38, { lead: 25 })]),
  R("x1", "1회 비용", "시험 성적서", [V("A", 300000, { lead: 99 })]),
  R("f1", "공임", "충진·포장 공임", [V("A", 200, { lead: 12 })]) ] });

console.log("■ 영업일 · 공휴일");
const cal = C.bdCal(C.HOLIDAYS_KR);
ok("주말·공휴일은 영업일 아님 (2026-12-25 성탄절 · 2027-02-09 설날 대체공휴일 · 2026-11-28 토)", () => { assert.equal(cal.isBD("2026-12-25"), false); assert.equal(cal.isBD("2027-02-09"), false); assert.equal(cal.isBD("2026-11-28"), false); assert.equal(cal.isBD("2026-11-27"), true); });
ok("금요일 다음 영업일 = 월요일 · 추석 연휴(2026-09-24~26) 건너뜀", () => { assert.equal(cal.next("2026-11-27"), "2026-11-30"); assert.equal(cal.next("2026-09-23"), "2026-09-28"); });
ok("12-24(목) + 1영업일 = 12-28(월) (성탄절·주말 뺌) · 그날 포함 5영업일 끝 = 11-25 → 12-01", () => { assert.equal(cal.add("2026-12-24", 1), "2026-12-28"); assert.equal(cal.end("2026-11-25", 5), "2026-12-01"); });
ok("영업일 차이: 11-25 → 12-02 = +5 · 거꾸로 −5", () => { assert.equal(cal.diff("2026-11-25", "2026-12-02"), 5); assert.equal(cal.diff("2026-12-02", "2026-11-25"), -5); });

console.log("■ 리드타임 글자 → 영업일 숫자");
ok("'15'·'15영업일'·15 = 15 · '2주' = 10 · '10일' = 10 · '1개월' = 21 · '10~15' = 15 · '협의' = 못 읽음(확인 필요)", () => {
  [["15", 15], ["15영업일", 15], [15, 15], ["2주", 10], ["10일", 10], ["1개월", 21], ["10~15", 15]].forEach(([a, b]) => assert.equal(C.leadDays(a), b, String(a)));
  assert.equal(C.leadDays("협의"), null); assert.equal(C.leadDays(""), null); });

console.log("■ 일정 계산");
const x = C.schedule(base(), null, TODAY);
ok("원자재 입고 = 오늘 + 적용 업체 리드타임 (원료 2주 → 12-09 · 용기 10일 → 12-09) · 1회 비용 줄은 뺌", () => {
  const m = Object.fromEntries(x.mats.map((a) => [a.id, a])); assert.equal(m.m1.arr, "2026-12-09"); assert.equal(m.m2.arr, "2026-12-09"); assert.equal(m.x1, undefined); });
ok("생산 기간 = 공임 줄 리드타임 12 (기본값 아님)", () => { assert.equal(x.mfg, 12); assert.equal(x.mfgDef, false); });
ok("단계 이어짐: 서류 11-26~12-02 → 인증 20영업일 12-03~12-31(성탄절 뺌) → 신고번호 2027-01-04", () => {
  const s = Object.fromEntries(x.steps.map((a) => [a.id, a])); assert.equal(s.docs.s, "2026-11-26"); assert.equal(s.docs.e, "2026-12-02"); assert.equal(s.cert.e, "2026-12-31"); assert.equal(s.no.e, "2027-01-04"); assert.equal(s.box.skip, true); });
ok("라벨 = 인쇄 단계로 (원자재 병목 후보 아님) · 리드타임 없으면 단계 기본 10영업일 · 병목 = 라벨 인쇄", () => {
  const l = x.mats.find((a) => a.id === "p1"); assert.equal(l.via, "라벨"); assert.equal(l.arr, undefined); assert.equal(x.unknown.length, 0);
  assert.equal(x.bottleneck.id, "label"); assert.equal(x.bottleneck.date, "2027-01-18"); });
ok("상차 가능일 = 생산 시작 + 생산 12 + 로스 10 + 입고 3 (영업일) = 2027-02-24 (설날 연휴 뺌)", () => { assert.equal(x.prodStart, "2027-01-18"); assert.equal(x.ready, "2027-02-24"); assert.equal(x.ready, cal.add("2027-01-18", 25)); });
ok("[시작함] 체크 + 시작일 → 그날부터 · 뒤 단계가 당겨짐", () => {
  const c = base(); c.sched = { po: "", steps: C.schedSteps(c, null).map((s) => (s.id === "gs" ? { ...s, started: true, start: "2026-11-20" } : s.id === "docs" ? { ...s, started: true, start: "2026-11-23" } : s)) };
  const y = C.schedule(c, null, TODAY), s = Object.fromEntries(y.steps.map((a) => [a.id, a]));
  assert.equal(s.docs.e, "2026-11-27"); assert.equal(s.docs.est, false); assert.equal(s.cert.s, "2026-11-30"); assert.ok(y.ready < x.ready); });
ok("인증 '변경신고·VOC' 15영업일로 고르면 5영업일 빨라짐", () => {
  const c = base(); c.sched = { po: "", steps: C.schedSteps(c, null).map((s) => (s.id === "cert" ? { ...s, opt: 1, days: 15 } : s)) };
  assert.equal(cal.diff(x.ready, C.schedule(c, null, TODAY).ready), -5); });

console.log("■ 업체를 바꾸면");
ok("원료 A(2주) → B(60영업일) = 원자재가 병목이 됨 · 상차 가능일 늦어짐", () => {
  const w = C.swapDays(base(), null, TODAY, "m1", "B"); assert.ok(w.days > 0);
  const c = base(); c.rows[0] = C.syncRow({ ...c.rows[0], sel: "B" }); const y = C.schedule(c, null, TODAY);
  assert.equal(y.bottleneck.t, "mat"); assert.equal(y.bottleneck.id, "m1"); assert.equal(y.ready, w.ready); });
ok("라벨 A(리드타임 없음 → 10) → B(25영업일) = 라벨 인쇄 단계가 25영업일 → +15영업일", () => {
  const w = C.swapDays(base(), null, TODAY, "p1", "B"); assert.equal(w.days, 15); });
ok("라벨 인쇄 기간을 단계에서 직접 고치면(byV false) 업체를 바꿔도 그 값", () => {
  const c = base(); c.sched = { po: "", steps: C.schedSteps(c, null).map((s) => (s.id === "label" ? { ...s, days: 12, byV: false } : s)) };
  assert.equal(C.swapDays(c, null, TODAY, "p1", "B").days, 0); });
ok("용기 B(15 + 해상·통관 20 = 35영업일)도 라벨 인쇄보다 빠르면 '같음'(0)", () => assert.equal(C.swapDays(base(), null, TODAY, "m2", "B").days, 0));

console.log("■ 설정");
ok("로스 8로 바꾸면 2영업일 빨라짐 · 공휴일 목록을 바꾸면 그 목록으로", () => {
  assert.equal(cal.diff(x.ready, C.schedule(base(), { loss: 8 }, TODAY).ready), -2);
  const y = C.schedule(base(), { holidays: { "2026-12-01": "시험" } }, TODAY); assert.equal(y.steps.find((s) => s.id === "docs").e, "2026-12-03"); });
ok("단계 기본 소요일 설정(stepDays) → 저장 안 한 카드에 바로", () => { const y = C.schedule(base(), { stepDays: { docs: 3 } }, TODAY); assert.equal(y.steps.find((s) => s.id === "docs").e, "2026-11-30"); });
console.log(`✓ ${n}가지 모두 통과`);
