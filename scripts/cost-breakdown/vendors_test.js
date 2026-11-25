// 분해원가 '업체 여러 곳 · 통화 · 생산 방식 기본 줄' 계산 시험 (가짜 숫자) — 2026-11-25
// 사용: node vendors_test.js [pourstore-cost.html]
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const file = process.argv[2] || path.join(__dirname, "..", "..", "pourstore-cost.html");
const src = fs.readFileSync(file, "utf8").match(/<script id="pcc-core">([\s\S]*?)<\/script>/)[1];
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.PCC, near = (a, b) => Math.abs(a - b) < 1e-6;
let n = 0; const ok = (name, f) => { f(); n++; console.log("  ✓", name); };
const V = (vid, price, o = {}) => ({ vid, alias: "", price, vat: "V-", cur: "", moq: "", lead: "", qd: "견적", vu: "", memo: "", ...o });
const card = { qty: 1000, fx: { USD: 1400 }, rows: [
  C.syncRow({ id: "a", kind: "용기", name: "용기", inMfg: "별도", per: "개당", usage: 1, st: "", sel: "B", vendors: [V("A", 330, { vat: "V+", moq: 3000 }), V("B", 280, { moq: 5000 }), V("C", "")] }),
  C.syncRow({ id: "b", kind: "OEM 단가", name: "해외 단가", inMfg: "별도", per: "개당", usage: 1, st: "", sel: "A", vendors: [V("A", 1.2, { cur: "USD" }), V("B", 1500)] }),
  C.syncRow({ id: "c", kind: "관세", name: "관세", inMfg: "별도", per: "1회", usage: 1, st: "", sel: "A", vendors: [V("A", 200000)] }) ] };
console.log("■ 업체 여러 곳");
ok("적용 업체 값이 줄에 그대로 (B 280 · V-)", () => { const r = card.rows[0]; assert.equal(r.price, 280); assert.equal(r.vat, "V-"); assert.equal(r.moq, 5000); });
ok("완제품 원가 = 적용 업체로 (280 + 1.2×1400 + 200000÷1000 = 2,160)", () => assert.ok(near(C.cardCalc(card).unit, 2160)));
ok("외화 환율 없으면 그 줄 '확인 필요' · 원화 0", () => { const x = C.cardCalc({ ...card, fx: {} }); assert.equal(x.rows[1].st, "확인 필요"); assert.equal(x.rows[1].per, 0); });
ok("업체 비교: 용기 최저 = 지금 적용 B(같으면 적용 업체) · A 로 바꾸면 +20", () => { const c = C.vendorCompare(card)[0]; assert.equal(c.best.v.vid, "B"); assert.ok(near(c.list[0].dPer, 20)); assert.equal(c.list[2].priced, false); });
ok("업체 비교: 해외 단가 B(1,500원)가 A(1.2 USD = 1,680원)보다 −180", () => { const c = C.vendorCompare(card)[1]; assert.equal(c.best.v.vid, "B"); assert.ok(near(c.list[1].dPer, -180)); });
ok("모두 최저가로 고르면 1,980 · 원래 카드는 그대로", () => { assert.ok(near(C.cardCalc(C.cheapestCard(card)).unit, 1980)); assert.equal(card.rows[1].sel, "A"); });
ok("MOQ 차이 → 첫 생산 원가 차이 (A: 300 + (3000−1000)×300÷1000 = 900 / B: 280 + (5000−1000)×280÷1000 = 1,400 → −500)", () => { const c = C.vendorCompare(card)[0]; assert.ok(near(c.list[0].dFirst, -500)); });
ok("이력: 적용 업체만 바꾸면 '적용 업체 B→A' 한 줄", () => { const b = { ...card, rows: [C.syncRow({ ...card.rows[0], sel: "A" }), card.rows[1], card.rows[2]] }; assert.deepEqual([...C.diffCard(card, b)], ["용기 적용 업체 B→A"]); });
ok("예전 카드(업체 칸 없음) = A 업체 하나로 읽음 · 계산 같음", () => { const old = { qty: 100, rows: [{ id: "x", kind: "용기", name: "용기", inMfg: "별도", price: 110, vat: "V+", per: "개당", usage: 2, moq: "", src: "견적", st: "" }] };
  assert.equal(C.vendorsOf(old.rows[0])[0].vid, "A"); assert.ok(near(C.cardCalc(old).unit, 200)); assert.ok(near(C.cardCalc({ ...old, rows: [C.syncRow(old.rows[0])] }).unit, 200)); });
ok("노션 '탈락' 견적은 비교엔 보이되 최저가 후보에서 빠짐", () => { const t = { ...card, rows: [card.rows[0], C.syncRow({ ...card.rows[1], vendors: [...card.rows[1].vendors.slice(0, 1), { ...card.rows[1].vendors[1], nst: "탈락" }] }), card.rows[2]] };
  const c = C.vendorCompare(t)[1]; assert.equal(c.best.v.vid, "A"); assert.equal(c.list[1].priced, true); assert.ok(near(C.cardCalc(C.cheapestCard(t)).unit, C.cardCalc({ ...t, rows: [C.syncRow({ ...t.rows[0], sel: "B" }), t.rows[1], t.rows[2]] }).unit)); });
console.log("■ 카드 상태·요약·기본 줄");
ok("근거 없는 줄 있으면 '임시', 모두 확정이면 '확정'", () => { assert.equal(C.cardStatus(card), "확정"); const t = { ...card, rows: [...card.rows, C.syncRow({ id: "d", kind: "간접비", name: "공장 간접비", per: "개당", usage: 1, sel: "A", vendors: [V("A", "", { qd: "" })] })] }; assert.equal(C.cardStatus(t), "임시"); });
ok("견적 유효기간 = 카드·적용 업체 중 가장 빠른 날", () => assert.equal(C.validFirst({ validUntil: "2026-12-31", rows: [{ name: "x", sel: "B", vendors: [V("A", 1, { vu: "2026-11-01" }), V("B", 1, { vu: "2026-12-15" })] }] }), "2026-12-15"));
ok("요약에 생산 방식·국내/수입·확정·반영값", () => { const s = C.summaryOf({ ...card, method: "imp", origin: "수입", applied: { v: 2160 } }); assert.equal(s.m, "imp"); assert.equal(s.o, "수입"); assert.equal(s.st, "확정"); assert.equal(s.ap, 2160); });
ok("기본 줄: 자체생산 7줄(공장 간접비 포함) · 해외 OEM·수입 5줄(첫 줄 USD · 운임·관세 = 1회)", () => {
  assert.equal(C.templateRows("self").length, 7); const imp = C.templateRows("imp"); assert.equal(imp.length, 5); assert.equal(imp[0].cur, "USD"); assert.equal(imp[1].per, "1회"); assert.equal(imp[2].name, "관세"); });
console.log(`✓ ${n}가지 모두 통과`);
