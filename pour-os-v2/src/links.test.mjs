// node src/links.test.mjs — CRM·마진에서 온 한 줄 (links.js)
import assert from "node:assert/strict";
import { linkInbox, linkOwnerId } from "./links.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "songhee", name: "김송희" }, { id: "ran", name: "이란" }, { id: "minji", name: "김민지" }];
const L = (o) => ({ id: "crm-recall-1", src: "crm", kind: "recall", title: "○○아파트 관리소장", sub: "견적의뢰 · 슬라브 방수", date: "2026-10-07", time: "14:00", owner: "이란", url: "https://pourstorecrm.web.app/consultations", open: true, at: "2026-10-05T01:00:00Z", ...o });
ok("담당 이름 → 업무OS 사람 (끝이 같은 1명)", () => { assert.equal(linkOwnerId(L({ owner: "이란" }), users), "ran"); assert.equal(linkOwnerId(L({ owner: "란" }), users), ""); assert.equal(linkOwnerId(L({ owner: "송희" }), users), "songhee"); assert.equal(linkOwnerId(L({ owner: "김" }), users), ""); });
ok("담당에게만 · 그날부터", () => {
  assert.equal(linkInbox([L()], users, "ran", "2026-10-07").length, 1);
  assert.equal(linkInbox([L()], users, "minji", "2026-10-07").length, 0);
  assert.equal(linkInbox([L()], users, "ran", "2026-10-06").length, 0);
});
ok("담당 없음 → 마스터만 · 지나면 빨강 n일 지남", () => {
  const x = linkInbox([L({ owner: "", date: "2026-10-05" })], users, "songhee", "2026-10-07")[0];
  assert.ok(x && x.red && /2일 지남/.test(x.text) && x.keep && x.kind === "link");
  assert.equal(linkInbox([L({ owner: "" })], users, "minji", "2026-10-07").length, 0);
});
ok("처리된 것(open:false)은 안 보임", () => assert.equal(linkInbox([L({ open: false })], users, "ran", "2026-10-07").length, 0));
ok("같은 종류 4줄 이상이면 한 줄로 묶음 (재고 위험 54건)", () => {
  const ls = Array.from({ length: 54 }, (_, i) => L({ id: "s" + i, kind: "lowStock", title: `제품${i} 재고 위험`, owner: "", date: "", url: "https://pourstorecrm.web.app/products/stock" }));
  const x = linkInbox([...ls, L()], users, "songhee", "2026-10-07");
  assert.equal(x.length, 1 + 0); const g = x.find((y) => y.group); assert.ok(g && g.title === "재고 위험 54건" && /제품0 · 제품1 외 52건/.test(g.text) && g.url);
  assert.equal(linkInbox([...ls.slice(0, 3)], users, "songhee", "2026-10-07").length, 3);
});
ok("CRM 큰 건(bigDeal) 태그 · 마진 낮음(marginLow) 빨강 · 마진 앱 이름", () => {
  const b = linkInbox([L({ id: "crm-big-1", kind: "bigDeal", title: "○○아파트 (큰 건)", sub: "견적 발송완료 · 384만원" })], users, "ran", "2026-10-07")[0];
  assert.ok(b && b.tag === "큰 건" && !b.red && b.whoName === "CRM");
  const m = linkInbox([L({ id: "margin-low-x", src: "margin", kind: "marginLow", title: "스티커 프라이머 · 쿠팡", sub: "마진 8% (기준 15%)", owner: "", date: "" })], users, "songhee", "2026-10-07")[0];
  assert.ok(m && m.tag === "마진 낮음" && m.red && m.whoName === "마진");
  const q = linkInbox([L({ id: "margin-req-x", src: "margin", kind: "priceReq", title: "타일카펫 자사몰가 변경", sub: "ran → 관리자 · 29,900 → 27,900", owner: "", date: "2026-10-07" })], users, "songhee", "2026-10-07")[0];
  assert.ok(q && q.tag === "가격 컨펌" && !q.red && q.whoName === "마진" && /29,900 → 27,900/.test(q.text));
});
console.log(`${n}개 모두 통과`);
