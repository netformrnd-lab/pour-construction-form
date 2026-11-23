// 규칙 전후 대조: 옛 규칙(main) ↔ 새 규칙 · 사용: firebase emulators:exec --only firestore --project demo-old "node rules_diff.test.js old.rules ../../pourstore.rules" — 기존 자리는 결과가 전부 같아야 하고, 새 자리(cost-*)만 기대대로
const fs = require("fs");
const { initializeTestEnvironment, assertSucceeds } = require("@firebase/rules-unit-testing");
const OLD = fs.readFileSync(process.argv[2], "utf8"), NEW = fs.readFileSync(process.argv[3], "utf8");
const U = {
  owner: { email: "owner@test.kr", v: true }, master2: { email: "master2@test.kr", v: true },
  sub: { email: "sub@test.kr", v: true }, subU: { email: "subu@test.kr", v: false }, allow: { email: "allow@test.kr", v: true },
  team: { email: "team@test.kr", v: true }, mgmt: { email: "mgmt@test.kr", v: true }, mgmtU: { email: "mgmtu@test.kr", v: false },
  mgmtAllow: { email: "mgmtallow@test.kr", v: true }, other: { email: "other@test.kr", v: true }, anon: null,
};
const ACCESS = { masterEmail: U.owner.email, masterEmails: [U.master2.email], subMasterEmails: [U.sub.email, U.subU.email],
  allowedEmails: [U.sub.email, U.subU.email, U.allow.email, U.mgmtAllow.email], teamEmails: [U.team.email],
  perms: { [U.team.email]: { cost: true, barcode: true, newProd: true } }, mgmtEmails: [U.mgmt.email, U.mgmtU.email, U.mgmtAllow.email] };
const DOCS = {
  "config/access": ACCESS, "config/calc": { a: 1 }, "config/secure": { blob: "x" }, "config/seckey": { pw: "x" }, "config/other": { a: 1 },
  "channels/c1": { a: 1 }, "products/p1": { cost: 1 }, "product-meta/prod-cost": { map: {} }, "product-meta/pricing-draft": { meta: { status: "작성중" } },
  "product-meta/prod-barcode": { map: {} }, "product-meta/promo-types": { a: 1 }, "team-catalog/current": { a: 1 }, "products-added/a1": { cost: 1 },
  "cost-private/x1": { kind: "own", by: U.team.email, viewers: [U.team.email], status: "ok", rev: 1 }, "cost-log/l1": { a: 1 }, "dashboard-activity/d1": { by: U.team.email },
  "mkt-links/m1": { clicks: 1 }, "mkt-perf/m1": { a: 1 }, "promotions/p1": { a: 1 }, "sales-orders/s1": { a: 1 }, "random/doc": { a: 1 },
  "cost-cards/c1": { item: "가짜" }, "cost-names/c1": { mfg: "가짜제조" }, "cost-names/_ref": { map: {} }, "cost-ref/products": { list: [] }, "cost-ref/cards": { map: {} }, "cost-ref/settings": { fees: {} },
};
const NEWPATH = (p) => /^cost-(cards|names|ref)(\/|$)/.test(p);
async function env(projectId, rules) {
  const e = await initializeTestEnvironment({ projectId, firestore: { rules, host: "127.0.0.1", port: 8085 } });
  await e.clearFirestore();
  await e.withSecurityRulesDisabled(async (c) => { const db = c.firestore(); for (const [p, d] of Object.entries(DOCS)) await db.doc(p).set(d); });
  return e;
}
const ctxOf = (e, u) => (u ? e.authenticatedContext(u.email.replace(/[@.]/g, "_"), { email: u.email, email_verified: u.v }) : e.unauthenticatedContext());
async function can(fn) { try { await fn(); return true; } catch (err) { if (/PERMISSION_DENIED|permission-denied|false for/i.test(String(err && (err.code || err.message)))) return false; throw err; } }
async function matrix(e) {
  const out = {};
  for (const [un, u] of Object.entries(U)) {
    const db = ctxOf(e, u).firestore();
    for (const p of Object.keys(DOCS)) {
      const col = p.split("/")[0];
      out[`${un} get ${p}`] = await can(() => db.doc(p).get());
      out[`${un} list ${col}`] = await can(() => db.collection(col).get());
      out[`${un} create ${col}/new`] = await can(() => db.doc(`${col}/zz-new-${un}`).set({ by: u ? u.email : "", a: 2 }));
      out[`${un} update ${p}`] = await can(() => db.doc(p).set({ t: 1 }, { merge: true }));
    }
    // 삭제는 마지막에 한 번씩(다른 칸에 영향 없게 별도 문서)
    for (const p of Object.keys(DOCS)) { const col = p.split("/")[0]; out[`${un} delete ${col}/del`] = await can(() => db.doc(`${col}/zz-del`).delete()); }
  }
  return out;
}
(async () => {
  const eo = await env("demo-old", OLD), mo = await matrix(eo); await eo.cleanup();
  const en = await env("demo-new", NEW), mn = await matrix(en); await en.cleanup();
  let same = 0, changed = [], bad = [];
  Object.keys(mo).forEach((k) => { const p = k.split(" ").slice(2).join(" "); if (NEWPATH(p)) return; if (mo[k] === mn[k]) same++; else bad.push(`${k}: 옛 ${mo[k]} → 새 ${mn[k]}`); });
  // 새 자리 기대값
  const view = ["owner", "master2", "sub", "mgmt", "mgmtAllow"], names = ["owner", "master2", "mgmt", "mgmtAllow"], masters = ["owner", "master2"];
  const exp = (k) => {
    const [un, op, ...r] = k.split(" "); const p = r.join(" "), col = p.split("/")[0], doc = p.split("/")[1];
    const readers = col === "cost-names" ? names : view;
    if (op === "get" || op === "list") return readers.includes(un);
    if (col === "cost-ref" && un === "sub") return op !== "delete" && doc === "products";   // 부마스터: products 만 저장
    return masters.includes(un);
  };
  Object.keys(mn).forEach((k) => { const p = k.split(" ").slice(2).join(" "); if (!NEWPATH(p)) return; const e = exp(k); if (mn[k] !== e) bad.push(`새 자리 ${k}: 기대 ${e} · 실제 ${mn[k]}`); else changed.push(k); });
  console.log(`기존 자리 ${same}칸: 옛 규칙과 결과 같음`);
  console.log(`새 자리 ${changed.length}칸: 기대대로 (마스터·추가 마스터 = 읽기·쓰기 · 부마스터 = 읽기(이름 칸 빼고)·products 저장 · 경영 열람 = 읽기만(이름 포함) · 인증 안 한 경영/부마스터·열람·팀원·로그인 안 함 = 막힘)`);
  const show = (un) => ["get cost-cards/c1", "update cost-cards/c1", "get cost-names/c1", "get cost-ref/products", "update cost-ref/products", "update cost-ref/cards", "get products/p1", "update product-meta/pricing-draft"].map((o) => `${o.split(" ")[0]} ${o.split(" ")[1]}:${mn[`${un} ${o}`] ? "○" : "✕"}`).join("  ");
  Object.keys(U).forEach((un) => console.log(`  ${un.padEnd(9)} ${show(un)}`));
  if (bad.length) { console.log("✗ 문제:\n" + bad.join("\n")); process.exit(1); }
  console.log("✓ 규칙 전후 대조 통과");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
