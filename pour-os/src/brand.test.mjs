// 브랜드·그로홈·매출 자동 연결·실행 현황 테스트 — node src/brand.test.mjs
import { fixGhSubs, fixBrandDup, brandKey, brandView, toggleBrand, brandSel, ghSalesRows, mergeRoll, ghChannel, projBrand, taskBrand, seedMissing, GH_GOAL, GH_MAIN, GH_SUB, GH_AK_SEED, GH_LAG_SEED, BRAND_SEED,
  salesSum, salesByCh, withAutoSales, rollupRows, akRateOf, projRateOf, execGroups, salesChOf } from "./brand.js";
import { AK_SEED, LAG_SEED, akLink } from "./actionKpi.js";
import { mkCur } from "./kpi.js";

let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };

// ① 이름표
eq("이름 → 키", ["POUR스토어", "pour 스토어", "그로홈", "GROHOME", "공통", "", null].map((v) => brandKey(v)), ["pourstore", "pourstore", "grohome", "grohome", "common", null, null]);
eq("새 브랜드는 목록 이름으로", brandKey("바라스데이", [{ id: "barasday", name: "바라스데이" }]), "barasday");

// ② 그로홈 기준 데이터 — 그로홈 대시보드 6채널 합 = 10억, 엑셀 그로홈 시트 행동 10개 · 결과 9개
eq("6채널 목표 합 = 10억", GH_SUB.reduce((a, s) => a + s.targetValue, 0), 1000000000);
eq("메인KPI 합 = 10억", GH_MAIN.reduce((a, s) => a + s.targetValue, 0), GH_GOAL.targetValue);
eq("메인KPI별 서브 합 일치", GH_MAIN.map((m) => GH_SUB.filter((s) => s.mainKPIId === m.id).reduce((a, s) => a + s.targetValue, 0) === m.targetValue), [true, true]);
eq("그로홈 행동지표 10개 (주3·월6·분기1)", [GH_AK_SEED.length, ...["W", "M", "Q"].map((c) => GH_AK_SEED.filter((x) => x.cyc === c).length)], [10, 3, 6, 1]);
eq("그로홈 결과 KPI 9개", GH_LAG_SEED.length, 9);
eq("id 가 POUR 와 안 겹침", [...AK_SEED, ...GH_AK_SEED].length === new Set([...AK_SEED, ...GH_AK_SEED].map((x) => x.id)).size, true);
eq("그로홈 연결: 공동구매 제안 → 그로홈2/공동구매", akLink(GH_AK_SEED.find((x) => x.id === "ak_gh_gb")), { mk: "ghk2", sk: "ghs6" });

// ③ 브랜드 나누기 — 예전 데이터는 POUR스토어, 고정업무는 공통
const D0 = {
  brands: BRAND_SEED,
  goals: [{ id: "g1", title: "10억", targetValue: 1e9, unit: "원", year: 2026 }, GH_GOAL],
  mainKPIs: [{ id: "mk1", goalId: "g1", unit: "원", targetValue: 5e8 }, { id: "mk2", goalId: "g1", unit: "원", targetValue: 5e8 }, ...GH_MAIN],
  subKPIs: [{ id: "sk1", mainKPIId: "mk1", unit: "원", currentValue: 52000000, manualOverride: true, targetValue: 3e8 }, { id: "sk4", mainKPIId: "mk2", unit: "원", currentValue: 1 }, ...GH_SUB],
  projects: [{ id: "p1", mainKPIId: "mk1" }, { id: "p2", mainKPIId: "ghk1" }, { id: "p3", brand: "grohome", category: "launch" }, { id: "p4" }, { id: "p5", brand: "barasday" }],
  tasks: [{ id: "t1", projectId: "p1" }, { id: "t2", projectId: "p2" }, { id: "t3", isFixed: true }, { id: "t4" }, { id: "t5", isFixed: true, brand: "grohome" }],
  actionKPIs: [...AK_SEED.slice(0, 2), ...GH_AK_SEED.slice(0, 2)], lagKPIs: [...LAG_SEED.slice(0, 1), ...GH_LAG_SEED.slice(0, 1)], trash: [],
};
eq("프로젝트 브랜드: 메인KPI 따라감 · 런칭 brand 그대로 · 없으면 POUR", D0.projects.map((p) => projBrand(p, D0)), ["pourstore", "grohome", "grohome", "pourstore", "barasday"]);
eq("업무 브랜드: 프로젝트 따라감 · 고정업무/없음 = 공통", D0.tasks.map((t) => taskBrand(t, D0)), ["pourstore", "grohome", "common", "common", "grohome"]);
const vg = brandView(D0, "grohome"), vp = brandView(D0, "pourstore"), va = brandView(D0, "all");
eq("그로홈 보기", [vg.goals.map((g) => g.id), vg.mainKPIs.map((m) => m.id), vg.projects.map((p) => p.id), vg.tasks.map((t) => t.id), vg.actionKPIs.length, vg.lagKPIs.length], [["g_gh"], ["ghk1", "ghk2"], ["p2", "p3"], ["t2", "t3", "t4", "t5"], 2, 1]);
eq("POUR 보기", [vp.goals.map((g) => g.id), vp.projects.map((p) => p.id), vp.tasks.map((t) => t.id)], [["g1"], ["p1", "p4"], ["t1", "t3", "t4"]]);
eq("전체 보기는 그대로(빠지는 것 없음)", [va.projects.length, va.tasks.length, va._brand], [5, 5, "all"]);

// ④ 처음 채워넣기 — 이미 있거나 휴지통에 있으면 다시 안 넣음
const s1 = seedMissing({ goals: [{ id: "g1" }], mainKPIs: [], subKPIs: [], actionKPIs: AK_SEED, lagKPIs: LAG_SEED, trash: [] });
eq("빠진 것만 채움", [s1.brands.length, s1.goals.length, s1.mainKPIs.length, s1.subKPIs.length, s1.actionKPIs.length, s1.lagKPIs.length], [2, 2, 2, 6, 29, 15]);
eq("두 번째는 할 일 없음", seedMissing({ ...s1, trash: [] }), null);
const s2 = seedMissing({ ...s1, goals: [{ id: "g1" }], trash: [{ id: "g_gh", _col: "goals" }] });
eq("휴지통에 있는 목표는 다시 안 넣음", s2, null);

// ⑤ 매출 자동 연결
const rows = rollupRows([
  { brand: "POUR스토어", date: "2026-09-03", ch: "자사몰", amt: 1000 }, { brand: "POUR스토어", date: "2026-09-20", ch: "자사몰", amt: 500 },
  { brand: "POUR스토어", date: "2025-12-30", ch: "자사몰", amt: 9999 }, { brand: "POUR스토어", date: "2026-10-01", ch: "파트너사", amt: 700 },
  { brand: "GROHOME", date: "2026-10-01", ch: "쿠팡", amt: 300 }, { brand: "GROHOME", date: "2026-10-02", ch: "오늘의집", amt: 200 }, { brand: "GROHOME", date: "bad", ch: "쿠팡", amt: 5 },
]);
eq("월·브랜드·채널로 묶음 (날짜 이상은 뺌)", rows, [{ b: "GROHOME", ym: "2026-10", ch: "오늘의집", amt: 200 }, { b: "GROHOME", ym: "2026-10", ch: "쿠팡", amt: 300 }, { b: "POUR스토어", ym: "2025-12", ch: "자사몰", amt: 9999 }, { b: "POUR스토어", ym: "2026-09", ch: "자사몰", amt: 1500 }, { b: "POUR스토어", ym: "2026-10", ch: "파트너사", amt: 700 }]);
const roll = { rows, at: "2026-10-01T10:00:00Z", by: "김송희" };
eq("POUR 자사몰 2026 = 1500 (2025 제외)", salesSum(roll, "pourstore", 2026, ["자사몰"]), 1500);
eq("그로홈 쿠팡·오늘의집 = 500", salesSum(roll, "grohome", 2026, salesChOf({ id: "ghs2" })), 500);
eq("채널별 합계(연결 안 된 채널 보기용)", salesByCh(roll, "pourstore", 2026), { "자사몰": 1500, "파트너사": 700 });
const DA = withAutoSales(D0, roll);
const sk = (id) => DA.subKPIs.find((s) => s.id === id);
eq("직판 자사몰: 수동 52,000,000 → 자동 1,500 (저장값은 _auto.stored)", [sk("sk1").currentValue, sk("sk1")._auto.stored], [1500, 52000000]);
eq("메인2 서브KPI는 그대로(프로젝트 합계 규칙)", sk("sk4"), D0.subKPIs[1]);
eq("그로홈 온라인 메인KPI = 서브 합", mkCur(DA.mainKPIs.find((m) => m.id === "ghk1"), DA.subKPIs, []), 500);
eq("수동으로 바꾼 서브KPI는 자동 안 함", withAutoSales({ ...D0, subKPIs: [{ ...D0.subKPIs[0], salesAuto: false }] }, roll).subKPIs[0].currentValue, 52000000);
eq("집계가 아직 없으면 원래 값", withAutoSales(D0, null), D0);

// ⑤-2 CRM 매출 동기화(channelCode)와 안 겹치게
eq("그로홈 서브KPI는 CRM 코드 안 씀", GH_SUB.every((s) => s.channelCode === "" && s.badge), true);
eq("CRM 동기화 칸은 마진대시보드 값으로 안 덮음", withAutoSales({ ...D0, subKPIs: [{ ...D0.subKPIs[0], crmSynced: true }] }, roll).subKPIs[0].currentValue, 52000000);
const bad = [{ id: "ghs1", channelCode: "OWN", currentValue: 99000000, crmSynced: true, manualOverride: true, valueHistory: [{ value: 99000000 }] }, { id: "ghs3", channelCode: "CPC", currentValue: 0 }, { id: "sk1", channelCode: "OWN", crmSynced: true, currentValue: 5 }];
const fx = fixGhSubs(bad, "2026-10-01T12:00:00Z");
eq("잘못 들어간 CRM 값 → 0, 이력 보관", [fx[0].channelCode, fx[0].badge, fx[0].currentValue, fx[0].crmSynced, fx[0].valueHistory.length, fx[0].valueHistory[1].prev], ["", "OWN", 0, false, 2, 99000000]);
eq("CRM 안 들어간 칸은 코드만 정리", [fx[1].channelCode, fx[1].badge, fx[1].currentValue], ["", "CPC", 0]);
eq("POUR 칸은 그대로", fx[2], bad[2]);
eq("고칠 게 없으면 null", fixGhSubs(fx), null);

// ⑥ 실행 현황 — 따로 계산
const it = (id) => [...AK_SEED, ...GH_AK_SEED].find((x) => x.id === id);
const docs = { "2026-Q4": { w: { "2026-10-05": { ak_c_b2c: { n: 4 }, ak_gh_ad: { n: 1 } }, "2026-10-12": { ak_c_b2c: { n: 2 } } } } };
const r1 = akRateOf(docs, [it("ak_c_b2c"), it("ak_gh_ad")], "2026-10-14");   // 10/5·10/12 두 주 지남 → c_b2c 6/8, gh_ad 1/4
eq("행동지표: 지금까지 해야 할 만큼 기준", [r1.pct, r1.n, r1.rows.map((x) => [x.n, x.g])], [50, 2, [[6, 8], [1, 4]]]);
eq("9월에 시작한 월간 항목은 9월 집계에서 뺌(참고용)", akRateOf({}, [it("ak_kwsel")], "2026-09-30").n, 0);
{ const dw = { "2026-Q3": { w: { "2026-09-28": { ak_c_b2c: { n: 4 } } } } };
  eq("달 경계: 10/1(목)은 9/28 주 → 9월로 셈(오늘 화면과 같은 기준)", akRateOf(dw, [it("ak_c_b2c")], "2026-10-01").rows.map((x) => [x.n, x.g]), [[4, 4]]); }   // 9/28 시작 항목이라 한 주만
eq("멈춘 항목은 뺌", akRateOf({}, [{ ...it("ak_c_b2c"), active: false }], "2026-10-14").n, 0);
eq("프로젝트: 보류 빼고 평균 진척", projRateOf([{ progress: 40 }, { progress: 100 }, { progress: 0, status: "paused" }]), { pct: 70, n: 2, done: 1 });
const g = execGroups({ ...D0, projects: [{ id: "p1", mainKPIId: "mk1", progress: 40 }], tasks: [{ id: "f1", isFixed: true, projectId: "p1" }, { id: "f2", isFixed: true }], actionKPIs: [it("ak_c_b2c"), it("ak_nps_b2b")] }, docs, "2026-10-14", (t) => t.id === "f1");
const gm = (id) => g.find((x) => (x.mk ? x.mk.id : "") === id);
eq("메인1: 행동지표 75% · 고정업무 100% · 프로젝트 40% (합치지 않음)", [gm("mk1").ak.pct, gm("mk1").fx.pct, gm("mk1").pj.pct], [75, 100, 40]);
eq("공통: NPS(B2B) 행동지표 · 프로젝트 없는 고정업무", [gm("").ak.n, gm("").fx.n, gm("").fx.pct], [1, 1, 0]);
eq("연결 없는 메인KPI는 '-'", [gm("ghk2").ak.pct, gm("ghk2").pj.pct, gm("ghk2").fx.pct], [null, null, null]);

// 기본값 바라스데이 정리
{ const D0={brands:[{id:"pourstore",name:"POUR스토어"},{id:"bmine",name:"바라스데이",createdBy:"songhee"},{id:"barasday",name:"바라스데이",status:"prep"}],projects:[{id:"p1",brand:"barasday"},{id:"p2",brand:"grohome"}]};
  const f=fixBrandDup(D0);
  eq("기본값 바라스데이 빼고 사람이 만든 것 남김 · 준비중 표시", [f.removed.id,f.brands.map(b=>b.id+(b.status?":"+b.status:""))], ["barasday",["pourstore","bmine:prep"]]);
  eq("그 브랜드로 된 기록은 사람 브랜드로", f.projects.map(p=>p.brand), ["bmine","grohome"]);
  eq("사람 브랜드 없으면 손대지 않음", fixBrandDup({brands:[{id:"barasday",name:"바라스데이"}]}), null);
  eq("정리 뒤 다시 돌리면 아무것도 안 함", fixBrandDup({...D0,brands:f.brands}), null); }


// 브랜드 여러 개 함께 보기
{ const D0={brands:[{id:"pourstore",name:"POUR스토어"},{id:"grohome",name:"그로홈"},{id:"bmine",name:"바라스데이"}],
    projects:[{id:"p1",brand:"pourstore"},{id:"p2",brand:"grohome"},{id:"p3",brand:"bmine"}],tasks:[{id:"t1",projectId:"p1"},{id:"t2"},{id:"t3",projectId:"p3"}],
    actionKPIs:[{id:"a1",brand:"pourstore"},{id:"a2",brand:"grohome"},{id:"a3",brand:"bmine"}],goals:[],mainKPIs:[],subKPIs:[],lagKPIs:[]};
  const v=brandView(D0,"pourstore,grohome");
  eq("두 브랜드 + 공통만", [v.projects.map(p=>p.id),v.tasks.map(t=>t.id),v.actionKPIs.map(a=>a.id)], [["p1","p2"],["t1","t2"],["a1","a2"]]);
  eq("새로 만들 브랜드: 고른 기본값 → 없으면 첫 번째", [brandView(D0,"pourstore,grohome","grohome")._brand, v._brand, brandView(D0,"pourstore,grohome","bmine")._brand], ["grohome","pourstore","pourstore"]);
  eq("한 개·전체는 예전과 같음", [brandView(D0,"grohome").projects.map(p=>p.id), brandView(D0,"all")._brand, brandView(D0,"all").projects.length], [["p2"],"all",3]);
  eq("켜고 끄기 · 다 끄면 전체", [toggleBrand("all","grohome"),toggleBrand("grohome","pourstore"),toggleBrand("grohome,pourstore","grohome"),toggleBrand("pourstore","pourstore"),toggleBrand("grohome","all")], ["grohome","grohome,pourstore","pourstore","all","all"]); }


// 그로홈 대시보드 매출 → 서브KPI 자동
{ const rec=[{date:"2026-07-13",platform:"쿠팡",totalPrice:"100"},{date:"2026-07-20",platform:"G마켓",totalPrice:"50"},{date:"2026-08-01",platform:"옥션",totalPrice:"5"},{date:"2026-08-02",platform:"도매매",totalPrice:"7"},{date:"2026-08-02",platform:"오늘의 집",totalPrice:"3"},{date:"2025-12-31",platform:"쿠팡",totalPrice:"999"}];
  const rows=ghSalesRows(rec);
  eq("채널 이름 맞추기", [ghChannel("G마켓"),ghChannel("도매꾹"),ghChannel("오늘의 집"),ghChannel("자사몰")], ["옥션·지마켓","도매꾹·도매매","오늘의집","자사몰"]);
  const roll=mergeRoll({at:"x",rows:[{b:"POUR스토어",ym:"2026-07",ch:"자사몰",amt:10},{b:"GROHOME",ym:"2026-07",ch:"쿠팡",amt:777}]},rows,[{id:"pourstore",name:"POUR스토어"},{id:"grohome",name:"그로홈"}]);
  eq("그로홈은 대시보드 원본만(예전 그로홈 줄은 뺌) · POUR 줄은 그대로", [roll.rows.filter(r=>r.b==="GROHOME").length, roll.rows.filter(r=>r.b==="POUR스토어").length], [0,1]);
  const D0={brands:[{id:"pourstore",name:"POUR스토어"},{id:"grohome",name:"그로홈"}],goals:[{id:"g_gh",brand:"grohome",year:2026}],mainKPIs:[{id:"ghk1",goalId:"g_gh"}],
    subKPIs:[{id:"ghs2",mainKPIId:"ghk1",unit:"원",currentValue:0},{id:"ghs3",mainKPIId:"ghk1",unit:"원",currentValue:0},{id:"ghs5",mainKPIId:"ghk1",unit:"원",currentValue:0}],projects:[]};
  const v=withAutoSales(D0,roll).subKPIs.map(s=>s.currentValue);
  eq("쿠팡·오늘의집 103 · CPC(옥션·지마켓) 55 · 위탁(도매꾹·도매매) 7 — 2025년은 안 셈", v, [103,55,7]);
  eq("대시보드 매출이 없으면 예전 그대로", mergeRoll(null,[],[]), null); }

console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
