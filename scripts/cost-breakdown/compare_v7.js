// 엑셀(LibreOffice 가 v7 식으로 계산한 값) ↔ 원가 분해 화면 계산(PCC) 대조
// 사용: node compare_v7.js <LibreOffice 로 다시 계산한 xlsx> [pourstore-cost.html]   (npm i xlsx@0.18.5 먼저)
const fs = require("fs"), vm = require("vm"), path = require("path");
const XLSX = require("xlsx");
const xlsxPath = process.argv[2], corePath = process.argv[3] || path.join(__dirname, "..", "..", "pourstore-cost.html");
let src = fs.readFileSync(corePath, "utf8");
if (corePath.endsWith(".html")) { const m = src.match(/<script id="pcc-core">([\s\S]*?)<\/script>/); if (!m) throw new Error("pcc-core 블록 없음"); src = m[1]; }
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.PCC;
const wb = XLSX.readFile(xlsxPath, { cellDates: false });
let fail = 0, ok = 0;
const fmt = (v) => (v == null ? "—" : typeof v === "number" ? (Math.round(v * 100) / 100).toLocaleString("ko-KR") : String(v));
console.log("■ 품목 시트 (엑셀 값 ↔ 화면 계산)");
wb.SheetNames.forEach((name) => {
  if (C.sheetSkip(name)) { console.log(`  · ${name}: 건너뜀(요약·판매가·목록·양식)`); return; }
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
  const p = C.parseV7(name, aoa), cmp = C.compareXl(p), x = C.cardCalc(p.card);
  console.log(`  · ${name}: ${p.card.brand} / ${p.card.item} ${p.card.spec} · ${p.card.round} · 수량 ${fmt(p.card.qty)} · 줄 ${p.card.rows.length}개 · 경고 ${p.warn.join(", ") || "없음"}`);
  p.card.rows.forEach((r, i) => {
    const e = p.xl.rows[i], m = x.rows[i];
    const same = [["unitV", "unitV"], ["perAmt", "per"], ["left", "left"]].every(([a, b]) => e[a] == null || Math.abs(e[a] - m[b]) <= 0.01);
    console.log(`      ${String(i + 1).padStart(2)} ${(r.name || "").padEnd(16)} 엑셀 단가 ${fmt(e.unitV).padStart(9)} 개당 ${fmt(e.perAmt).padStart(8)} 남는 ${fmt(e.left).padStart(10)} | 화면 단가 ${fmt(m.unitV).padStart(9)} 개당 ${fmt(m.per).padStart(8)} 남는 ${fmt(m.left).padStart(10)} | 상태 ${m.st} ${same ? "✓" : "✗"}`);
  });
  console.log(`      합계  엑셀 완제품 ${fmt(p.xl.unit)} · 첫 생산 ${fmt(p.xl.first)} · 금액 ${fmt(p.xl.amt)} · 향료 ${fmt(p.xl.fragNeed)}`);
  console.log(`            화면 완제품 ${fmt(x.unit)} · 첫 생산 ${fmt(x.first)} · 금액 ${fmt(x.firstAmt)} · 향료 ${fmt(x.frag)} · 근거 확인 ${x.ok}/${x.n}`);
  if (cmp.diffs.length) { fail += cmp.diffs.length; console.log("      ✗ 다름:", JSON.stringify(cmp.diffs)); } else { ok++; console.log(`      ✓ ${cmp.checked}줄 + 합계 모두 같음`); }
});
// 판매가 시트
console.log("■ 판매가 (엑셀 ↔ 화면)");
const ps = XLSX.utils.sheet_to_json(wb.Sheets["판매가"], { header: 1, raw: true, defval: "" });
const g = (r, c) => ps[r - 1][c - 1];
const logi = C.logiCalc({ qty: g(2, 2), moveTotal: g(3, 2), moveOurs: g(4, 2) === "예", inLoad: g(5, 2), inCheck: g(6, 2), store: g(7, 2), out3pl: g(8, 2), pack: g(9, 2), ship: g(10, 2) });
const sameLogi = Math.abs(logi.total - g(12, 2)) < 0.01;
console.log(`  물류비(개당) 엑셀 ${fmt(g(12, 2))} · 화면 ${fmt(logi.total)} ${sameLogi ? "✓" : "✗"}`); if (!sameLogi) fail++;
[15, 16, 17].forEach((r) => {
  const cells = [4, 5, 6].map((c) => { const s = C.salePrice({ cost: g(1, 2), logi: logi.total, disc: g(11, 2), margin: g(14, c), fee: g(r, 2), pg: g(r, 3) }); const ex = g(r, c); const mine = s.over ? "마진 과다" : s.price; const same = String(ex) === String(mine); if (!same) fail++; return `${Math.round(g(14, c) * 100)}% 엑셀 ${fmt(ex)} / 화면 ${fmt(mine)} ${same ? "✓" : "✗"}`; });
  console.log(`  ${String(g(r, 1)).padEnd(7)} ${cells.join(" · ")}`);
});
const over = C.salePrice({ cost: g(1, 2), logi: logi.total, disc: g(11, 2), margin: 0.95, fee: g(15, 2), pg: g(15, 3) });
console.log(`  목표 마진 95%: 엑셀 ${g(19, 2)} / 화면 ${over.over ? "마진 과다" : over.price} ${g(19, 2) === "마진 과다" && over.over ? "✓" : "✗"}`);
// 원가 계산기 ② 판매가 → 마진율 (판매가 식을 거꾸로 푼 값): 백원 올리기 전 판매가를 넣으면 목표 마진이 그대로 나와야 함
console.log("■ 판매가 → 마진율 (계산기 ②가 판매가 식을 거꾸로 푼 값)");
[15, 16, 17].forEach((r) => {
  const cells = [4, 5, 6].map((c) => {
    const o = { cost: g(1, 2), logi: logi.total, disc: g(11, 2), fee: g(r, 2), pg: g(r, 3) }, tgt = g(14, c), sp = C.salePrice({ ...o, margin: tgt });
    if (sp.over) return `${Math.round(tgt * 100)}% 마진 과다`;
    const back = C.marginCalc({ cost: o.cost, logi: o.logi, disc: o.disc, fee: o.fee + o.pg, price: sp.raw }), atXl = C.marginCalc({ cost: o.cost, logi: o.logi, disc: o.disc, fee: o.fee + o.pg, price: g(r, c) });
    const same = Math.abs(back.rate - tgt) < 1e-9, ok = atXl.rate >= tgt - 1e-9; if (!same || !ok) fail++;
    return `목표 ${Math.round(tgt * 100)}% → 되돌림 ${(back.rate * 100).toFixed(4)}% ${same ? "✓" : "✗"} · 엑셀 판매가 ${fmt(g(r, c))}원이면 ${(atXl.rate * 100).toFixed(2)}% (마진액 ${fmt(atXl.amt)}원)`;
  });
  console.log(`  ${String(g(r, 1)).padEnd(7)} ${cells.join("\n          ")}`);
});
console.log(fail ? `\n✗ 다른 칸 ${fail}개` : "\n✓ 모두 같음");
process.exit(fail ? 1 : 0);
