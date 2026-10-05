// node src/kpi2.test.mjs — KPI 화면 계산 (kpi2.js)
import assert from "node:assert/strict";
import { kpiDefs, kpiBoard, myKpi, lagAt, lagLatest, lagDue, lagInbox, lagWrite, won, fmtV, ghSalesRows, applyKpiOv, visibleDefs, kpiEditWrite, skManual } from "./kpi2.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const brands = [{ id: "pourstore", name: "POUR스토어" }, { id: "grohome", name: "그로홈" }, { id: "bmupq52c0", name: "바라스데이" }];
const users = [{ id: "songhee", name: "김송희" }, { id: "ran", name: "이란" }, { id: "minji", name: "김민지", master: false }];
const docs = {
  goals: { items: [{ id: "g1", title: "스토어 매출 10억", targetValue: "1000000000", unit: "원", year: "2026" }, { id: "g_gh", title: "그로홈 매출 10억", targetValue: "1000000000", unit: "원", brand: "grohome", year: "2026" }] },
  mainKPIs: { items: [{ id: "mk1", goalId: "g1", title: "POUR 직판", targetValue: "500000000", unit: "원", order: "1" }, { id: "mk3", goalId: "g1", title: "운영 시스템", targetValue: "4", unit: "모듈", order: "3" },
    { id: "ghk1", goalId: "g_gh", title: "그로홈 온라인", targetValue: "786000000", unit: "원", order: "11" }] },
  subKPIs: { items: [
    { id: "sk1", mainKPIId: "mk1", title: "자사몰 (OWN)", targetValue: "300000000", currentValue: "71090204", unit: "원", channelCode: "OWN", crmSynced: true, manualOverride: true, order: "1" },
    { id: "sk2", mainKPIId: "mk1", title: "마켓 (MK)", targetValue: "150000000", currentValue: "33867260", unit: "원", channelCode: "MK", crmSynced: true, manualOverride: true, order: "2" },
    { id: "sk9", mainKPIId: "mk3", title: "CRM 구축", targetValue: "100", currentValue: "78", unit: "%", order: "1" },
    { id: "ghs1", mainKPIId: "ghk1", title: "자사몰", targetValue: "280000000", currentValue: "0", unit: "원", order: "1" },
    { id: "ghs2", mainKPIId: "ghk1", title: "쿠팡·오늘의집", targetValue: "340000000", currentValue: "0", unit: "원", order: "2" }] },
  lagKPIs: { items: [
    { id: "lg_inflow", fun: "A 유입", name: "자사몰 월 평균 유입", goal: "4000", base: "2728", unit: "명", order: "1", monthly: { "2026-08": { v: 3000, by: "songhee" } } },
    { id: "lg_repurchase", fun: "R 재구매", name: "재구매율", goal: "40", base: 22.2, unit: "%", order: "4", monthly: {} },
    { id: "lg_gh_review", fun: "R 추천", name: "리뷰작업 달성율", goal: "20", base: "35", unit: "%", brand: "grohome", order: "108", monthly: {} }] },
};
const gh = { rows: ghSalesRows([{ date: "2026-09-03", platform: "자사몰", totalPrice: 1200000 }, { date: "2026-10-01", platform: "자사몰", totalPrice: 300000 }, { date: "2026-10-02", platform: "오늘의 집", totalPrice: 50000 }, { date: "2025-12-31", platform: "자사몰", totalPrice: 999 }]), at: "2026-10-05T01:00:00Z" };
const akItems = [{ id: "ak_c_b2c", name: "(B2C) 컨텐츠 발행", cyc: "W", goal: 4, unit: "건", who: ["songhee"], active: true, brand: "POUR스토어", startDate: "2026-09-28" },
  { id: "ak_ad", name: "고객 타겟 광고", cyc: "W", goal: 2, unit: "회", who: ["songhee"], active: true, brand: "POUR스토어", startDate: "2026-09-28" }];
const akDocs = { "2026-Q4": { w: { "2026-10-05": { ak_c_b2c: { n: 3, by: { songhee: 3 } } } } } };
const projects = [{ id: "p1", title: "자사몰 상세 개편", status: "active", progress: 60, subKPIId: "sk1", assigneeId: "minji" }, { id: "p2", title: "끝난 것", status: "completed", subKPIId: "sk1" }];
const K = kpiDefs(docs), ctx = { brands, projects, ak: { items: akItems, docs: akDocs }, gh, lagV2: {}, users, key: "2026-10-07" };

ok("정의: 하나라도 아직 못 읽으면 null", () => { assert.equal(kpiDefs({ ...docs, lagKPIs: undefined }), null); assert.ok(K && K.subKPIs.length === 5); });
ok("POUR스토어: CRM 자동 값 그대로 · 메인 = 서브 합 · 목표 = 메인(원) 합", () => {
  const b = kpiBoard(K, ctx, "pourstore"); const g = b.goals[0], mk1 = g.mks[0];
  assert.equal(b.goals.length, 1); assert.equal(mk1.subs[0].cur, 71090204); assert.equal(mk1.subs[0].src.t, "CRM 자동");
  assert.equal(mk1.cur, 71090204 + 33867260); assert.equal(g.cur, mk1.cur); assert.ok(mk1.auto);
  assert.equal(g.mks[1].subs[0].src.t, "직접 입력");
});
ok("그로홈: 대시보드 매출 올해 채널 합 (작년 빼고 · '오늘의 집' → 오늘의집)", () => {
  const b = kpiBoard(K, ctx, "grohome"); const mk = b.goals[0].mks[0];
  assert.equal(mk.subs[0].cur, 1500000); assert.equal(mk.subs[0].src.t, "그로홈 대시보드 자동"); assert.equal(mk.subs[1].cur, 50000); assert.equal(mk.cur, 1550000);
  const b0 = kpiBoard(K, { ...ctx, gh: null }, "grohome"); assert.equal(b0.goals[0].mks[0].subs[0].src.t, "매출 불러오는 중");
});
ok("브랜드 따로: 목표 없는 브랜드는 빈 판 · 결과 KPI도 브랜드별", () => {
  const b = kpiBoard(K, ctx, "bmupq52c0"); assert.equal(b.goals.length, 0); assert.equal(b.lags.length, 0);
  assert.deepEqual(kpiBoard(K, ctx, "grohome").lags.map((x) => x.id), ["lg_gh_review"]); assert.equal(kpiBoard(K, ctx, "pourstore").lags.length, 2);
});
ok("움직이는 것: 서브KPI에 연결된 행동지표(이번 주 n/목표) · 열린 프로젝트만", () => {
  const sk1 = kpiBoard(K, ctx, "pourstore").goals[0].mks[0].subs[0];
  assert.deepEqual(sk1.mv.aks.map((a) => [a.it.id, a.n, a.g]), [["ak_c_b2c", 3, 4], ["ak_ad", 0, 2]]);
  assert.deepEqual(sk1.mv.ps.map((x) => x.p.id), ["p1"]);
});
ok("내 KPI: 내 행동지표·내 프로젝트가 걸린 KPI만", () => {
  const b = kpiBoard(K, ctx, "pourstore");
  assert.deepEqual(myKpi(b, "songhee").map((r) => [r.x.sk ? r.x.sk.id : r.mk.id, r.aks.length, r.ps.length]), [["sk1", 2, 0]]);
  assert.deepEqual(myKpi(b, "minji").map((r) => [r.x.sk.id, r.aks.length, r.ps.length]), [["sk1", 0, 1]]);
  assert.equal(myKpi(b, "ran").length, 0);
});
ok("결과 KPI 값: v2 가 있으면 v2 · 없으면 버전1 · 최근 값 · 기준값", () => {
  const it = K.lagKPIs[0], v2 = { lg_inflow: { monthly: { "2026-09": { v: 3500 } } } };
  assert.equal(lagAt(it, v2, "2026-09").v, 3500); assert.equal(lagAt(it, v2, "2026-08").src, "v1"); assert.equal(lagAt(it, v2, "2026-10"), null);
  assert.equal(lagLatest(it, v2, "2026-10").ym, "2026-09"); assert.equal(lagLatest(it, v2, "2026-08").v, 3000);
  assert.equal(lagLatest(K.lagKPIs[1], {}, "2026-10").v, 22.2); assert.ok(lagLatest(K.lagKPIs[1], {}, "2026-10").base);
});
ok("월말 알림 날짜: 마지막 평일 3일 전부터 · 새 달 10일까지 지난달 · 다 넣으면 없음", () => {
  const L = K.lagKPIs;
  assert.equal(lagDue("2026-10-20", L, {}), null);
  assert.equal(lagDue("2026-10-27", L, {}).ym, "2026-10");          // 10/30(금) 3일 전
  assert.equal(lagDue("2026-11-03", L, {}).ym, "2026-10"); assert.ok(lagDue("2026-11-03", L, {}).late);
  assert.equal(lagDue("2026-11-12", L, {}), null);
  const full = Object.fromEntries(L.map((it) => [it.id, { monthly: { "2026-10": { v: 1 } } }]));
  assert.equal(lagDue("2026-11-03", L, full), null);
});
ok("'확인할 것' 한 줄은 마스터(결과 KPI 권한)에게만 · 브랜드별 남은 수", () => {
  const x = lagInbox(K.lagKPIs, {}, users, "songhee", "2026-10-28", brands)[0];
  assert.ok(x && x.kind === "lagDue" && x.ym === "2026-10" && /3개 남음/.test(x.text) && /POUR스토어 2 · 그로홈 1/.test(x.text) && x.keep);
  assert.equal(lagInbox(K.lagKPIs, {}, users, "minji", "2026-10-28", brands).length, 0);
  assert.equal(lagInbox(K.lagKPIs, {}, [...users, { id: "x", name: "권한자", perms: { kpiLag: true } }], "x", "2026-10-28", brands).length, 1);
});
ok("저장 칸: 새 문서 = 통째 · 있으면 그 달 칸만 · 같은 값이면 안 씀 · 비우면 null + 이력", () => {
  const cu = { id: "songhee", name: "김송희" }, it = K.lagKPIs[0], at = "2026-10-30T09:00:00Z";
  const a = lagWrite(null, it, "2026-10", "3800", cu, at); assert.equal(a.monthly["2026-10"].v, 3800); assert.equal(a.hist[0].prev, null);
  const cur = { monthly: { "2026-10": { v: 3800 } }, hist: a.hist };
  assert.equal(lagWrite(cur, it, "2026-10", "3800", cu, at), null);
  const b = lagWrite(cur, it, "2026-10", "", cu, at); assert.equal(b["monthly.2026-10"].v, null); assert.equal(b.hist[1].prev, 3800);
  assert.equal(lagWrite(cur, it, "2026-10", "abc", cu, at), null);
});
ok("금액·단위 줄이기", () => { assert.equal(won(192000000), "1억 9,200만"); assert.equal(won(41000000), "4,100만"); assert.equal(won(3200), "3,200"); assert.equal(fmtV(1.14, "%"), "1.14%"); assert.equal(fmtV(null, "명"), "—"); });
ok("KPI 고치기 덧칠: 버전1 위에 칸만 · 새로 만든 것 추가 · 숨김은 남기되 화면에선 빠짐(아래 것도)", () => {
  const ov = [{ id: "sk2", coll: "subKPIs", fields: { title: "마켓 매출", targetValue: 200000000 } }, { id: "v2k_sub_1", coll: "subKPIs", created: true, fields: { title: "새 채널", mainKPIId: "mk1", targetValue: 1000, currentValue: 300, unit: "원", salesAuto: false, manualOverride: true } },
    { id: "mk3", coll: "mainKPIs", hidden: true, fields: {} }, { id: "lg_repurchase", coll: "lagKPIs", fields: { goal: 50 } }];
  const K2 = kpiDefs(docs, ov), V = visibleDefs(K2);
  assert.equal(K2.subKPIs.find((x) => x.id === "sk2").title, "마켓 매출"); assert.equal(K2.subKPIs.find((x) => x.id === "sk2").currentValue, "33867260");
  assert.ok(K2.mainKPIs.find((x) => x.id === "mk3")._hidden); assert.ok(!V.mainKPIs.some((x) => x.id === "mk3")); assert.ok(!V.subKPIs.some((x) => x.id === "sk9"));
  const b = kpiBoard(K2, ctx, "pourstore"), mk1 = b.goals[0].mks[0];
  assert.equal(b.goals[0].mks.length, 1); assert.equal(mk1.subs.length, 3); assert.equal(mk1.cur, 71090204 + 33867260 + 300); assert.equal(mk1.subs.find((x) => x.sk.id === "sk2").target, 200000000);
  assert.equal(b.lags.find((x) => x.id === "lg_repurchase").goal, 50);
});
ok("KPI 고치기 저장 칸: 바뀐 칸만 기록 · 같으면 안 씀 · 숨김/다시 보임 · 새로 만들면 created", () => {
  const cu = { id: "songhee", name: "김송희" }, at = "2026-10-05T09:00:00Z", base = K.subKPIs[1];
  const w = kpiEditWrite(null, "subKPIs", "sk2", { title: "마켓 매출", unit: "원" }, undefined, cu, at, base);
  assert.deepEqual(Object.keys(w.hist[0].ch), ["title"]); assert.equal(w.created, false); assert.equal(w.fields.title, "마켓 매출");
  assert.equal(kpiEditWrite({ fields: w.fields, hist: w.hist }, "subKPIs", "sk2", { title: "마켓 매출" }, undefined, cu, at, base), null);
  const h = kpiEditWrite({ fields: w.fields, hist: w.hist }, "subKPIs", "sk2", {}, true, cu, at, base); assert.equal(h.hidden, true); assert.deepEqual(h.hist[1].ch._hidden, [false, true]);
  assert.equal(kpiEditWrite(null, "goals", "v2k_x", { title: "새 목표" }, undefined, cu, at, null).created, true);
  assert.ok(!skManual(K.subKPIs[0])); assert.ok(skManual(K.subKPIs[2])); assert.ok(!skManual(K.subKPIs[3]));
});
console.log(`${n}개 모두 통과`);
