// 시장조사 ↔ 프로젝트 테스트 — node src/research.test.mjs
import { researchTodo, researchTask, researchKey, researchUrl } from "./research.js";
let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };
const rep = { id: "market-research-deco2", title: "데코라인 2차", url: "/Market-Research/", items: [{ no: 1, name: "대리석 시트지", cat: "대리석", ch: "오늘의집", sale: 13400, link: "https://x", buy: true, more: false }, { no: 2, name: "롤 벽지", buy: true, more: true }, { no: 3, name: "타일", buy: false, more: true }] };
eq("샘플 구매 할 것", researchTodo(rep, [], "buy").map((i) => i.no), [1, 2]);
eq("이미 만든 건 건너뜀", researchTodo(rep, [{ fromResearch: researchKey(rep.id, 1, "buy") }], "buy").map((i) => i.no), [2]);
eq("더 찾기", researchTodo(rep, [], "more").map((i) => i.no), [2, 3]);
const t = researchTask(rep, rep.items[0], "buy", { id: "p1", assigneeId: "minji" }, 4);
eq("업무 모양", [t.title, t.projectId, t.assigneeId, t.fromResearch, t.memo.split("\n")[1]], ["샘플 구매 · 대리석 시트지", "p1", "minji", "market-research-deco2:1:buy", "대리석 · 오늘의집 · 13,400원"]);
eq("주소", [researchUrl(rep), researchUrl({ url: "https://a.b/c" })], ["https://pour-construction-form.pages.dev/Market-Research/", "https://a.b/c"]);
eq("빈 보고서", researchTodo(null, [], "buy"), []);
console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
