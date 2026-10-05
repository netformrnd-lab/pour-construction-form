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
console.log(`${n}개 모두 통과`);
