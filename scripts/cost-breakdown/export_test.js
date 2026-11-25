// 분해원가 수출 품목 계산 시험 (가짜 숫자) — 2026-11-25 송희님 "해외 수출 품목도 관리"
// 나라 = 공통 + 그 나라 차이(추가·바꾸기·빼기) · 1팀 일정(3팀 항목은 계산 밖) · 수출 마진(국내와 같은 틀 · 부가세 0 기본)
// 사용: node export_test.js [pourstore-cost.html]
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const file = process.argv[2] || path.join(__dirname, "..", "..", "pourstore-cost.html");
const src = fs.readFileSync(file, "utf8").match(/<script id="pcc-core">([\s\S]*?)<\/script>/)[1];
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.PCC, near = (a, b) => Math.abs(a - b) < 1e-6;
let n = 0; const ok = (name, f) => { f(); n++; console.log("  ✓", name); };
const V = (vid, price, o = {}) => ({ vid, alias: "", price, vat: "V-", cur: "", moq: "", lead: "", qd: "견적", vu: "", memo: "", ...o });
const R = (id, kind, name, vendors, sel = "A", o = {}) => C.syncRow({ id, kind, name, inMfg: "별도", per: "개당", usage: 1, st: "", sel, vendors, ...o });
const card = { qty: 5000, fx: {}, rows: [
  R("c", "내용물", "프라이머", [V("A", 2000, { lead: 10 })]), R("b", "용기", "1kg 용기", [V("A", 300, { lead: 10 }), V("B", 350, { lead: 30 })]),
  R("l", "라벨", "국문 라벨", [V("A", 40)]), R("x", "단상자", "단상자", [V("A", 180)]) ],
  exports: [
    { cc: "JP", qty: 2000, rows: [{ ...R("j1", "라벨", "일문 스티커", [V("A", 45, { lead: 5 })]), mode: "add" }, { ...R("j2", "기타", "보완포장 (수축)", [V("A", 30)]), mode: "add" }], sched: null },
    { cc: "US", qty: "", rows: [{ ...R("b~US", "용기", "1kg 용기", [V("A", 300, { lead: 10 }), V("B", 350, { lead: 30 })], "B"), mode: "swap", of: "b" }, { id: "om-x", mode: "omit", of: "x" }], sched: null } ] };
console.log("■ 나라 = 공통 + 그 나라 차이");
const dom = C.cardCalc(card).unit;
ok("국내 원가 = 공통 줄만 (2,520) · 수출 줄은 국내 계산에 안 들어감", () => assert.ok(near(dom, 2520)));
ok("일본 = 공통 + 일문 스티커 45 + 수축포장 30 = 2,595 · 생산 수량 2,000(일본 것)", () => { const j = C.exportCard(card, "JP"); assert.ok(near(C.cardCalc(j).unit, 2595)); assert.equal(j.qty, 2000); assert.equal(j.rows.filter((r) => r._x === "add").length, 2); });
ok("미국 = 용기 B(350)로 바꾸고 단상자 빼기 = 2,520 + 50 − 180 = 2,390 · 수량 비면 국내 수량", () => { const u = C.exportCard(card, "US"); assert.ok(near(C.cardCalc(u).unit, 2390)); assert.equal(u.qty, 5000); assert.ok(!u.rows.some((r) => r.id === "x")); assert.equal(u.rows.find((r) => r.id === "b~US")._x, "swap"); });
ok("업체 비교도 나라 카드로 (미국 용기: 지금 B · A 로 바꾸면 −50)", () => { const c = C.vendorCompare(C.exportCard(card, "US")).find((x) => x && x.r.id === "b~US"); assert.ok(near(c.list.find((l) => l.v.vid === "A").dPer, -50)); });
ok("없는 나라 = null", () => assert.equal(C.exportCard(card, "CN"), null));
console.log("■ 일정 = 1팀 몫만");
ok("나라 일정 기본 단계 = 골든 샘플 확정 → 수출 사양 확정 (인증·라벨 인쇄 단계 없음)", () => { const st = C.schedSteps(C.exportCard(card, "US"), null); assert.deepEqual([...st.map((s) => s.id)], ["gs", "xspec"]); });
ok("미국 병목 = 용기 B 입고(30영업일) · 라벨은 인쇄 단계가 아닌 원자재로", () => { const s = C.schedule(C.exportCard(card, "US"), null, "2026-11-25"); assert.equal(s.bottleneck.t, "mat"); assert.equal(s.bottleneck.id, "b~US"); assert.ok(s.mats.some((m) => m.id === "l" && !m.via)); });
ok("국내 일정은 그대로 (라벨 인쇄 단계 있음)", () => assert.ok(C.schedSteps(card, null).some((s) => s.id === "label")));
console.log("■ 수출 판매가·마진 (국내와 같은 틀)");
ok("부가세 10%를 넣으면 국내 marginCalc 와 같은 값", () => { const a = C.exportMargin({ price: 12900, fx: 1, cost: 3000, ship: 500, local: 0, fee: 0.108, disc: 0.05, vat: 0.1 }), b = C.marginCalc({ price: 12900, cost: 3000, logi: 500, fee: 0.108, disc: 0.05 }); assert.ok(near(a.rate, b.rate)); assert.ok(near(a.amt, b.amt)); });
ok("20 USD × 1,400 · 수수료 20% · 부가세 0 · 원가 2,390 → 마진 = 28,000 − 5,600 − 2,390 = 20,010원 · 현지 통화로도", () => { const m = C.exportMargin({ price: 20, fx: 1400, cost: 2390, fee: 0.2, disc: 0, vat: 0 }); assert.ok(near(m.amt, 20010)); assert.ok(near(m.amtLocal, 20010 / 1400)); assert.equal(m.noShip, true); });
ok("물류비·현지 비용(3팀 입력)을 넣으면 마진에서 빠짐 · 판매가·환율 없으면 계산 안 함", () => { const m = C.exportMargin({ price: 20, fx: 1400, cost: 2390, fee: 0.2, ship: 350, local: 100 }); assert.ok(near(m.amt, 19560)); assert.equal(m.noShip, false); assert.equal(C.exportMargin({ price: 20, fx: "", cost: 1 }), null); });
console.log(`✓ ${n}가지 모두 통과`);
