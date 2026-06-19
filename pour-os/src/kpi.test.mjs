// KPI 안전망 테스트 — node src/kpi.test.mjs
// 목적: ① 구간(세그먼트)이 없으면 기존 KPI 집계와 100% 동일(안전 불변식) ② 구간 카운트가 의도대로 동작
import { numF, skCur, mkCur, calcSegDone } from "./kpi.js";

let pass=0, fail=0;
const eq=(name,got,exp)=>{ const ok=JSON.stringify(got)===JSON.stringify(exp);
  console.log(`${ok?"✅":"❌"} ${name} → ${JSON.stringify(got)}${ok?"":" (기대: "+JSON.stringify(exp)+")"}`);
  ok?pass++:fail++; };

// ── 대표 데이터: skCur 모든 가지 커버 ──
const projects=[
  // mk2 매출(원) 자동
  {id:"p1",subKPIId:"sk_sales",resultValue:3000000,progress:50},
  {id:"p2",subKPIId:"sk_sales",resultValue:2000000,progress:100},
  // 운영(%) 평균
  {id:"p3",subKPIId:"sk_ops",progress:40},
  {id:"p4",subKPIId:"sk_ops",progress:80},
  // 카운트형 countKPIId(완료=progress100)
  {id:"p5",countKPIId:"sk_cnt",progress:100},
  {id:"p6",countKPIId:"sk_cnt",progress:30},
  // 출시집계
  {id:"p7",templateId:"t1",progress:100},
  {id:"p8",templateId:"t1",progress:60},
];
const skSales={id:"sk_sales",mainKPIId:"mk2",unit:"원"};
const skOps  ={id:"sk_ops",  mainKPIId:"mk3",unit:"%"};
const skCnt  ={id:"sk_cnt",  mainKPIId:"mk3",unit:"건",currentValue:5};
const skLaunch={id:"sk_l",   mainKPIId:"mk3",unit:"개",launchCount:true};
const skManual={id:"sk_m",   mainKPIId:"mk1",unit:"원",manualOverride:true,currentValue:777};

console.log("── ① 베이스라인(구간 없음) — 기존 동작 그대로여야 함 ──");
eq("skCur 매출(원) 합계",      skCur(skSales,projects), 5000000);
eq("skCur 운영(%) 평균",       skCur(skOps,projects),   60);          // (40+80)/2
eq("skCur 카운트(누적5+완료1)", skCur(skCnt,projects),   6);
eq("skCur 출시집계(완료1)",     skCur(skLaunch,projects),1);
eq("skCur 출시집계+구간(완료1+구간2)", skCur(skLaunch,[...projects,{id:"pz",segDoneByKpi:{sk_l:2}}]),3);   // 구간 연결 시 가산, 무연결이면 위 케이스대로 불변
eq("skCur 수동지정",           skCur(skManual,projects),777);
eq("numF 방탄",                [numF("abc"),numF(Infinity),numF("12")], [0,0,12]);

const subKPIs=[skSales,skOps,skCnt,skLaunch];
eq("mkCur mk2(원)=자식합",     mkCur({id:"mk2",unit:"원"},[skSales],projects), 5000000);
eq("mkCur mk3(환산달성)",      mkCur({id:"mk3",unit:"모듈"},[{...skOps,targetValue:100},{...skCnt,targetValue:12}],projects),
   Math.round((Math.min(1,60/100)+Math.min(1,6/12))*10)/10);  // 0.6+0.5=1.1

console.log("── ② calcSegDone — 구간 완료 집계 ──");
const tasksDone=new Set(["a1","a2","b1"]);               // a1,a2,b1 완료 / b2 미완
const projWithSeg={id:"pp",segments:[
  {id:"g1",name:"소싱구간",stageIds:["a1","a2"],kpiId:"sk_cnt"},   // 둘 다 done → 완료
  {id:"g2",name:"등록구간",stageIds:["b1","b2"],kpiId:"sk_cnt"},   // b2 미완 → 미완료
]};
eq("calcSegDone 완료1건",      calcSegDone(projWithSeg,tasksDone), {sk_cnt:1});
eq("calcSegDone 변경없음=null", calcSegDone({...projWithSeg,segDoneByKpi:{sk_cnt:1}},tasksDone), null);
eq("calcSegDone segments없음=null", calcSegDone({id:"x"},tasksDone), null);

console.log("── ③ 구간 스탬프가 skCur 카운트에 반영 ──");
const projSeg=[
  {id:"q5",countKPIId:"sk_cnt",progress:100},            // 프로젝트 완료 +1
  {id:"q9",segDoneByKpi:{sk_cnt:2}},                     // 구간 완료 +2
];
eq("skCur 누적5+프로젝트1+구간2", skCur(skCnt,projSeg), 8);

console.log("── ④ 구간 정의→단계 완료→집계→KPI 통합 경로 ──");
// 프로젝트에 구간 2개 정의(편집 UI가 저장하는 모양). 단계 완료 상태에 따라 calcSegDone→스탬프→skCur 반영
const skCnt2={id:"sk12",unit:"건",currentValue:8};   // 로드맵 33건류 카운트 KPI
let projA={id:"pa",segments:[
  {id:"seg1",name:"소싱·등록 완료",stageIds:["t1","t2"],kpiId:"sk12"},
  {id:"seg2",name:"출시 완료",stageIds:["t3","t4"],kpiId:"sk12"},
]};
const stamp=(proj,doneArr)=>{ const m=calcSegDone(proj,new Set(doneArr)); return m===null?proj:{...proj,segDoneByKpi:m}; };
let pA=stamp(projA,["t1","t2"]);                 // seg1만 완료
eq("구간1만 완료 → 스탬프 {sk12:1}", pA.segDoneByKpi, {sk12:1});
eq("skCur 누적8+구간1 = 9", skCur(skCnt2,[pA]), 9);
pA=stamp(projA,["t1","t2","t3","t4"]);           // 둘 다 완료
eq("두 구간 완료 → 스탬프 {sk12:2}", pA.segDoneByKpi, {sk12:2});
eq("skCur 누적8+구간2 = 10", skCur(skCnt2,[pA]), 10);

console.log(`\n${fail===0?"🟢 전체 통과":"🔴 실패 있음"} — pass ${pass} / fail ${fail}`);
process.exit(fail===0?0:1);
