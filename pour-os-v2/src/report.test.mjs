// node src/report.test.mjs — 월말 보고서 · 그로스보드 계산 (report.js · growth.js)
import assert from "node:assert/strict";
import { reportBrand, reportProject, reportProjects, salesMonth, salesGoal, akMonth, reportId, shareUrl, parseShare, shareHash, sharedView, confirmWrite, shareOnWrite, shareOffWrite, refreshWrite, moneyWrite, summaryWrite, noteDoc, projBrandR, monthRange, doneDay, projDoneDay } from "./report.js";
import { growthTree, periodOf, peopleOf } from "./growth.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const brands = [{ id: "pourstore", name: "POUR스토어", order: 1 }, { id: "grohome", name: "그로홈", order: 2 }, { id: "bmupq52c0", name: "바라스데이", order: 3 }];
const users = [{ id: "songhee", name: "김송희", team: "2팀" }, { id: "ran", name: "이란", team: "2팀" }, { id: "minji", name: "김민지", team: "1팀", master: false }];
const K = { goals: [{ id: "g1", title: "스토어 10억", targetValue: 1200000000, unit: "원", year: 2026 }, { id: "g_gh", title: "그로홈 10억", targetValue: 1000000000, unit: "원", brand: "grohome", year: 2026 }],
  mainKPIs: [{ id: "mk1", goalId: "g1", title: "POUR 직판", targetValue: 500000000, unit: "원", order: 1 }, { id: "ghk1", goalId: "g_gh", title: "그로홈 온라인", targetValue: 786000000, unit: "원", order: 1 }],
  subKPIs: [{ id: "sk1", mainKPIId: "mk1", title: "자사몰 (OWN)", targetValue: 300000000, currentValue: 71000000, unit: "원", crmSynced: true, manualOverride: true, order: 1 }],
  lagKPIs: [{ id: "lg1", name: "재구매율", goal: 40, unit: "%", order: 1, monthly: { "2026-09": { v: 30 } } }, { id: "lg2", name: "리뷰 작성률", goal: 20, unit: "%", brand: "grohome", order: 2, monthly: {} }] };
const sales = { "crm-pourstore": { at: "2026-10-05T00:00:00Z", months: { "2026-08": { total: 11000000, ch: { 자사몰: 4000000, 쿠팡: 7000000 } }, "2026-09": { total: 30000000, ch: { 자사몰: 20000000, 쿠팡: 10000000 } } } },
  grohome: { at: "2026-10-05T00:00:00Z", rows: [{ b: "grohome", ym: "2026-09", ch: "자사몰 ", amt: 24000000 }, { b: "grohome", ym: "2026-09", ch: "쿠팡", amt: 23000000 }, { b: "grohome", ym: "2026-08", ch: "쿠팡", amt: 1000000 }] } };
const projects = [
  { id: "p1", title: "자사몰 상세 개편", brand: "pourstore", status: "completed", completedAt: "2026-09-18T05:00:00Z", assigneeId: "songhee", collaboratorIds: [], subKPIId: "sk1", progress: 100, startDate: "2026-08-22" },
  { id: "p2", title: "추석 프로모션", brand: "pourstore", status: "active", assigneeId: "ran", collaboratorIds: [], mainKPIId: "mk1", progress: 40, dueDate: "2026-10-20" },
  { id: "p3", title: "비밀 개편", brand: "pourstore", status: "active", assigneeId: "songhee", collaboratorIds: [], progress: 10, secret: { on: true, allow: [] } },
  { id: "p4", title: "그로홈 기부", status: "active", assigneeId: "minji", collaboratorIds: [], progress: 75, dueDate: "2026-10-30" },
];
const tasks = [
  { id: "t1", projectId: "p1", title: "기획안 컨펌", status: "done", doneAt: "2026-09-02T03:00:00Z", dueDate: "2026-09-05", assigneeId: "songhee" },
  { id: "t2", projectId: "p1", title: "섬네일 촬영", status: "done", doneAt: "2026-09-17T03:00:00Z", dueDate: "2026-09-14", assigneeId: "ran", attachments: [{}, {}] },
  { id: "t3", projectId: "p2", title: "쿠폰 세팅", status: "todo", dueDate: "2026-09-25", assigneeId: "ran", blocked: { reason: "x" } },
  { id: "t4", projectId: "p3", title: "비밀 업무", status: "done", doneAt: "2026-09-10T03:00:00Z", assigneeId: "songhee" },
  { id: "t5", projectId: "p2", title: "배너", status: "done", doneAt: "2026-10-02T03:00:00Z", assigneeId: "songhee" },
  { id: "t6", projectId: "p2", title: "고정", status: "todo", isFixed: true, assigneeId: "songhee" },
  { id: "t7", projectId: "", title: "혼자 한 일", status: "done", doneAt: "2026-10-03T03:00:00Z", assigneeId: "songhee" },
];
const ak = { items: [{ id: "a1", name: "(마케팅) 컨텐츠 발행", cyc: "W", goal: 4, unit: "건", who: ["songhee"], mk: "mk1", sk: "sk1" }, { id: "a2", name: "고객 타겟 광고", cyc: "M", goal: 8, unit: "회", who: ["ran"] }],
  docs: { "2026-Q3": { w: { "2026-09-07": { a1: { n: 4 } }, "2026-09-14": { a1: { n: 3 }, a2: { n: 6 } } } }, "2026-Q4": { w: {} } } };
const X = { users, brands, projects, tasks, K, sales, lagDefs: K.lagKPIs, lagV2: { lg1: { monthly: { "2026-09": { v: 36 } } } }, ak, key: "2026-10-06" };

ok("달 범위 · 끝낸 날 · 프로젝트 끝낸 날", () => {
  assert.deepEqual(monthRange("2026-09"), { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(doneDay(tasks[0]), "2026-09-02"); assert.equal(doneDay(tasks[2]), "");
  assert.equal(projDoneDay(projects[0]), "2026-09-18"); assert.equal(projDoneDay(projects[1]), "");
  assert.equal(projDoneDay({ status: "completed", endLog: [{ kind: "completed", at: "2026-09-03T01:00:00Z" }] }), "2026-09-03");
});
ok("매출: POUR스토어 = CRM 월·채널 · 그로홈 = 대시보드 rows(채널 공백 정리) · 그 밖 없음", () => {
  const s = salesMonth(sales, "pourstore", "2026-09", brands); assert.equal(s.total, 30000000); assert.equal(s.src, "CRM"); assert.equal(s.ch[0].ch, "자사몰"); assert.equal(s.ytd, 41000000);
  const g = salesMonth(sales, "grohome", "2026-09", brands); assert.equal(g.total, 47000000); assert.equal(g.ch[0].ch, "자사몰"); assert.equal(g.src, "그로홈 대시보드"); assert.equal(g.ytd, 48000000);
  assert.equal(salesMonth(sales, "bmupq52c0", "2026-09", brands), null);
  assert.deepEqual(salesGoal(K, "pourstore", "2026-09", brands), { year: 1200000000, month: 100000000, ytd: 900000000, title: "스토어 10억" });
});
ok("반복 일: 주간 = 주 수 × 목표 · 월간 = 목표 · 그 분기 기록이 없으면 —", () => {
  const a = akMonth(ak.items, ak.docs, "2026-09", "pourstore", brands);
  const a1 = a.items.find((x) => x.id === "a1"), a2 = a.items.find((x) => x.id === "a2");
  assert.equal(a1.n, 7); assert.equal(a1.g, 16); assert.equal(a2.n, 6); assert.equal(a2.g, 8); assert.equal(a.pct, Math.round((13 / 24) * 100));
  assert.equal(akMonth(ak.items, { "2026-Q4": {} }, "2026-09", "pourstore", brands).pct, null);
});
ok("브랜드 보고서: 매출·결과 KPI(v2 먼저)·끝낸 프로젝트·지난 일·막힘 · 기밀 빠짐", () => {
  const r = reportBrand(X, "pourstore", "2026-09");
  assert.equal(r.kind, "brand"); assert.equal(r.title, "POUR스토어 9월 보고서"); assert.equal(r.head, "매출 목표 30% 달성");
  assert.equal(r.sales.pct, 30); assert.equal(r.sales.goal, 100000000);
  assert.deepEqual(r.done.map((p) => p.id), ["p1"]); assert.equal(r.done[0].total, 2); assert.equal(r.done[0].end, "2026-09-18");
  assert.ok(!JSON.stringify(r).includes("비밀"));
  assert.equal(r.tasksDone, 2); assert.equal(r.late, 2);   // t2 늦게 끝냄 + t3 안 끝냄
  assert.equal(r.blocked, 1); assert.deepEqual(r.lateList.map((x) => x.id), ["t3"]);
  assert.equal(r.lags.find((l) => l.id === "lg1").v, 36); assert.ok(!r.lags.some((l) => l.id === "lg2"));
  assert.deepEqual(r.next.map((p) => p.id), ["p2"]);   // 10월 마감
  assert.equal(r.asOf, "2026-09-30");
});
ok("브랜드 칸 없는 프로젝트: 이름에 브랜드 이름이 있으면 그 브랜드 (그로홈 기부)", () => {
  const BD = { goals: K.goals, mainKPIs: K.mainKPIs, brands };
  assert.equal(projBrandR(projects[3], BD), "grohome"); assert.equal(projBrandR(projects[1], BD), "pourstore");
  assert.ok(reportBrand(X, "grohome", "2026-09").next.some((p) => p.id === "p4"));
  assert.ok(!reportBrand(X, "pourstore", "2026-09").next.some((p) => p.id === "p4"));
});
ok("프로젝트 보고서: 흐름(끝낸 순) · 늦음 · 담당별 · 기밀이면 없음", () => {
  const r = reportProject(X, projects[0], tasks, "2026-09");
  assert.deepEqual(r.flow.map((f) => f.title), ["기획안 컨펌", "섬네일 촬영"]); assert.equal(r.flow[1].late, 3); assert.equal(r.flow[1].files, 2);
  assert.equal(r.pct, 100); assert.equal(r.lateN, 1); assert.equal(r.start, "2026-08-22"); assert.equal(r.end, "2026-09-18");
  assert.deepEqual(r.byOwner.map((o) => o.name), ["김송희", "이란"]);
  assert.equal(reportProject(X, projects[2], tasks, "2026-09"), null);
  const r2 = reportProject(X, projects[1], tasks, "2026-10"); assert.equal(r2.leftN, 1); assert.ok(r2.left[0].late); assert.equal(r2.doneM, 1);
});
ok("프로젝트 고르기: 그 달 열렸거나 끝낸 것 · 기밀 뺌", () => {
  assert.deepEqual(reportProjects(projects, "2026-09").map((p) => p.id).sort(), ["p1", "p2", "p4"]);
  assert.deepEqual(reportProjects(projects, "2026-10").map((p) => p.id).sort(), ["p2", "p4"]);
});
ok("공유 링크: id~열쇠 · 다른 앱 주소에서도 os2-report.html", () => {
  assert.equal(reportId("pourstore", "2026-10"), "pourstore-2026-10");
  assert.equal(shareUrl("https://x.dev/pourstore-renewal/os2-admin.html#t-1", "pourstore-2026-10", "abc123"), "https://x.dev/pourstore-renewal/os2-report.html#pourstore-2026-10~abc123");
  assert.equal(shareUrl("https://x.dev/pourstore-renewal/os2.html", "lb_x-2026-10", "k1"), "https://x.dev/pourstore-renewal/os2-report.html#lb_x-2026-10~k1");
  assert.deepEqual(parseShare(shareHash("lb_x-2026-10", "abc123")), { id: "lb_x-2026-10", token: "abc123" }); assert.equal(parseShare("#nope"), null);
});
ok("저장 칸: 한 줄 정리 → 공유(초안 공유본) → 확정(얼림) → 공유 끄기 · 메모는 따로", () => {
  const cu = { id: "songhee", name: "김송희" }, d = reportBrand(X, "pourstore", "2026-09");
  let doc = null; const ap = (w) => { doc = { ...(doc || {}), ...w }; };
  ap(summaryWrite(doc, d, " 9월 정리 ", cu, "A")); assert.equal(doc.summary, "9월 정리"); assert.equal(doc.status, "draft"); assert.equal(summaryWrite(doc, d, "9월 정리", cu, "B"), null);
  ap(shareOnWrite(doc, d, cu, "B", "tok1")); assert.ok(doc.share.on); assert.equal(doc.share.token, "tok1"); assert.equal(doc.data.kind, "brand");
  let v = sharedView(doc, "tok1"); assert.equal(v.data.summary, "9월 정리"); assert.equal(v.final, false); assert.equal(v.money, true);
  assert.ok(sharedView(doc, "bad").err); ap(moneyWrite(doc, d, true, cu, "C")); assert.equal(sharedView(doc, "tok1").money, false);
  ap(refreshWrite(doc, { ...d, head: "새로" }, cu, "D")); assert.equal(doc.data.head, "새로");
  ap(confirmWrite(doc, d, cu, "E")); assert.equal(doc.status, "final"); assert.equal(doc.data.summary, "9월 정리"); assert.equal(doc.final.by, "songhee");
  assert.equal(refreshWrite(doc, d, cu, "F"), null);   // 확정본은 '지금 값으로' 안 바뀜
  ap(summaryWrite(doc, d, "고침", cu, "G")); assert.equal(sharedView(doc, "tok1").data.summary, "9월 정리");   // 확정본 공유는 얼린 정리
  ap(shareOffWrite(doc, cu, "H")); assert.ok(sharedView(doc, "tok1").err); assert.equal(shareOffWrite(doc, cu, "I"), null);
  assert.ok(doc.log.some((e) => e.act === "확정") && doc.log.some((e) => e.act === "공유 끔"));
  assert.ok(!JSON.stringify(doc).includes("reportnotes"));
  const nd = noteDoc("pourstore-2026-09", "ceo", " 단가 다시 ", "", cu, "J"); assert.deepEqual(nd, { reportId: "pourstore-2026-09", kind: "ceo", title: "", text: "단가 다시", by: "songhee", byName: "김송희", at: "J" });
});
ok("그로스보드 기간 · 사람", () => {
  assert.deepEqual(periodOf("half", "2026-10-06"), { kind: "half", from: "2026-07-01", to: "2026-12-31", label: "2026 하반기" });
  assert.equal(periodOf("prev", "2026-10-06").label, "9월"); assert.equal(periodOf("month", "2026-03-02").from, "2026-03-01");
  assert.deepEqual(peopleOf(users, "songhee", "me"), ["songhee"]); assert.deepEqual(peopleOf(users, "songhee", "team"), ["songhee", "ran"]); assert.equal(peopleOf(users, "minji", "all").length, 3);
});
ok("그로스보드 나무: KPI → 프로젝트·반복 → 끝낸 일 · 기밀 빠짐 · 끝낸 일 많은 KPI 먼저", () => {
  const T = growthTree(X, { uids: ["songhee", "ran"], period: periodOf("prev", "2026-10-06"), rootName: "2팀" });
  assert.equal(T.title, "9월"); assert.ok(/^2팀 · KPI \d/.test(T.sub));
  assert.ok(!JSON.stringify(T).includes("비밀"));
  const k = T.kids[0]; assert.equal(k.title, "자사몰 (OWN)");
  const p1 = k.kids.find((x) => x.pid === "p1"); assert.deepEqual(p1.kids.map((x) => x.tid), ["t1", "t2"]); assert.equal(p1.st, "done");
  assert.ok(k.kids.some((x) => x.kind === "ak" && x.akId === "a1"));
  const mk = T.kids.find((x) => x.title === "POUR 직판"); assert.ok(mk.kids.some((x) => x.pid === "p2"));
  assert.equal(T.count.done, 2);
  const M = growthTree(X, { uids: ["songhee"], period: periodOf("month", "2026-10-06"), rootName: "김송희" });
  assert.ok(M.kids.some((x) => x.title === "프로젝트 없는 일" && x.kids[0].tid === "t7"));
  assert.equal(M.count.done, 2);
});
console.log(`\n${n}개 통과`);
