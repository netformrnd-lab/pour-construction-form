// 워크플로우 로직 테스트 — node src/workflow.test.mjs
import { mergeWorkflows, DEFAULT_WORKFLOWS, caseProgress, caseNext, caseStatusFor, toggleCheck, caseTurnOwner, roasOf,
  lbState, phaseProgress, launchProgress, LAUNCH_PHASES, LAUNCH_ITEMS, nameMatch, guessCat, guessWfProject, launchLead, caseToggleCalc, caseConfirmStage, stepsToStages, stagesToSteps, flowOfAk, lbChecks } from "./workflow.js";

let pass=0, fail=0;
const eq=(name,got,exp)=>{ const ok=JSON.stringify(got)===JSON.stringify(exp);
  console.log(`${ok?"✅":"❌"} ${name} → ${JSON.stringify(got)}${ok?"":" (기대: "+JSON.stringify(exp)+")"}`); ok?pass++:fail++; };

// ① 병합: 저장된 설정이 없으면 기본 그대로, 있으면 덮어쓰기(단계 비어 있으면 기본 단계 유지)
eq("기본 정의 그대로", mergeWorkflows([]).length, DEFAULT_WORKFLOWS.length);
const ret=DEFAULT_WORKFLOWS.find(w=>w.id==="wf_return");
const saved=[{id:"wf_return",leadId:"chaerim",stages:ret.stages.map(s=>s.id==="pickup"?{...s,ownerId:"chaerim"}:s)},{id:"wf_blog",leadId:"ran",stages:[]},{id:"wf_launch",defaults:{x_msds:"채림"}}];
const W=mergeWorkflows(saved);
eq("관리 담당 덮어쓰기", W.find(w=>w.id==="wf_return").leadId, "chaerim");
eq("단계 담당 덮어쓰기", W.find(w=>w.id==="wf_return").stages.find(s=>s.id==="pickup").ownerId, "chaerim");
eq("빈 단계 저장 → 기본 단계 유지", W.find(w=>w.id==="wf_blog").stages.length, 4);
eq("신제품 설정은 목록에 안 섞임", W.some(w=>w.id==="wf_launch"), false);

// ② 건 체크 → 상태
const wf=W.find(w=>w.id==="wf_return");
let t={id:"t1",title:"김희수 반품",assigneeId:"ran",status:"todo"};
eq("처음 진행률", caseProgress(wf,t), {done:0,total:5,pct:0});
eq("다음 단계", caseNext(wf,t).id, "recv");
let p1=toggleCheck(wf,t,"recv",{id:"ran",name:"이란"}); t={...t,...p1};
eq("하나 체크 → 진행중", t.status, "inprogress");
eq("다음 차례 담당 = 회수 확인 담당(채림)", caseTurnOwner(wf,t), "chaerim");
["pickup","inspect","refund","notify"].forEach(s=>{ t={...t,...toggleCheck(wf,t,s,{id:"ran",name:"이란"})}; });
eq("전부 체크 → 완료", t.status, "done");
eq("완료면 다음 차례 없음", caseTurnOwner(wf,t), null);
t={...t,...toggleCheck(wf,t,"notify",{id:"ran"})};
eq("하나 해제 → 다시 진행중", t.status, "inprogress");
eq("보류는 유지", caseStatusFor(wf,{recv:{}},"hold"), "hold");

// ③ ROAS
eq("ROAS 계산", roasOf({wfData:{spend:"100,000",revenue:"350000"}}), 350);
eq("광고비 없으면 null", roasOf({wfData:{revenue:1000}}), null);

// ④ 신제품: 런칭보드 단계 + 추가 칸
const prod={id:"a",brand:"grohome",name:"2in1 목재용",stages:{p01:{status:"done",owner:"정하"},p02:{status:"doing",owner:"정하",due:"2026-01-01"}},osExtra:{x_meta:{count:6},x_blog:{count:1},x_parts:{status:"skip"}}};
eq("런칭보드 단계 읽기", lbState(prod,{id:"p01",lb:true}).status, "done");
eq("카운터 목표 달성 → 완료", lbState(prod,LAUNCH_ITEMS.find(i=>i.id==="x_meta")).status, "done");
eq("카운터 일부 → 진행", lbState(prod,LAUNCH_ITEMS.find(i=>i.id==="x_blog")).status, "doing");
const plan=phaseProgress(prod,LAUNCH_PHASES[0],"2026-09-29");
eq("기획 단계 진행", [plan.done,plan.total,plan.late], [1,4,true]);
const pack=phaseProgress(prod,LAUNCH_PHASES.find(p=>p.k==="pack"),"2026-09-29");
eq("해당 없음(skip)은 분모 제외", pack.total, 9);
eq("전체 항목 수", launchProgress({}).total, LAUNCH_ITEMS.length);
eq("관리 담당 = 브랜드 BM", launchLead(prod), "김송희");
eq("패킹 이름", LAUNCH_PHASES[2].name, "패킹");
eq("출시홍보 첫 항목 = B2B 안내", LAUNCH_PHASES[6].items[0].name, "B2B 고객 출시 안내");

// ⑤ 이름 맞추기 · 분류 추정
eq("민지 = 김민지", nameMatch("민지","김민지"), true);
eq("이란 = 이란", nameMatch("이란","이란"), true);
eq("채림 ≠ 김민지", nameMatch("채림","김민지"), false);
eq("탑코트재 출시 → 신제품", guessCat("탑코트재 SKU 9종 출시"), "launch");
eq("B2B 생태계 → 영업", guessCat("B2B 파트너 생태계 구축 프로젝트"), "sales");
eq("반품 CS → 상시 운영", guessCat("반품 CS"), "ops");
eq("CRM센터 → 시스템", guessCat("CRM센터 개발관리"), "system");
eq("광고관리 → 마케팅", guessCat("광고관리"), "marketing");
eq("반품 워크플로우 ↔ 반품 CS 프로젝트", guessWfProject("wf_return",[{id:"a",title:"주문·발주"},{id:"b",title:"반품 CS"}]), "b");

// ── 반복 흐름: 다 체크하면 행동지표 +1 ──
{ const wf={id:"wf_blog",akId:"ak_c_b2c",stages:[{id:"a",name:"글"},{id:"b",name:"컨펌",confirm:true},{id:"c",name:"업로드"}]};
  const me={id:"chaerim",name:"양채림"}, wk=()=>"2026-09-28";
  let t={id:"t1",wfId:"wf_blog",assigneeId:"chaerim",wfChecks:{},status:"todo"};
  for(const sid of ["a"]){ t={...t,...caseToggleCalc(wf,t,sid,me,wk).patch}; }
  eq("컨펌 단계 찾기", caseConfirmStage(wf,t), "b");
  t={...t,...caseToggleCalc(wf,t,"b",{id:"songhee"},wk).patch};
  let r=caseToggleCalc(wf,t,"c",me,wk); eq("마지막 체크 → +1 · 완료", [r.count,r.wk,r.patch.status,r.patch.akCounted.akId], [1,"2026-09-28","done","ak_c_b2c"]);
  t={...t,...r.patch};
  r=caseToggleCalc(wf,t,"c",me,()=>"2026-10-05"); eq("풀면 −1 · 처음 센 주", [r.count,r.wk,r.patch.status,r.patch.akCounted], [-1,"2026-09-28","inprogress",null]);
  eq("행동지표 연결 없는 흐름은 안 셈", caseToggleCalc({...wf,akId:""},{...t,wfChecks:{a:1,b:1}},"c",me,wk).count, 0);
  eq("단계 ↔ 체크리스트 변환", stagesToSteps(stepsToStages([{id:"x",title:" 글 생성 ",owner:"ran",confirm:true},{title:" "}])), [{id:"x",title:"글 생성",owner:"ran",confirm:true}]);
  eq("행동지표에 연결된 흐름", flowOfAk([{id:"w1"},{id:"w2",akId:"ak1"}],"ak1").id, "w2"); }


// 신제품 항목 체크리스트 — 기본 틀 / 제품별
{ const it={id:"x_ad"}; const tpl={x_ad:[{id:"c1",name:"소재 제작"},{id:"c2",name:"문구"},{id:"c3",name:"업로드"}]};
  const a=lbChecks({osExtra:{x_ad:{checks:{done:{c1:true}}}}},it,tpl);
  eq("제품 목록 없으면 기본 틀 · 1/3", [a.own,a.n,a.total,a.all], [false,1,3,false]);
  const b=lbChecks({osExtra:{x_ad:{checks:{list:[{id:"c1",name:"소재 제작"},{id:"c9",name:"예산"}],done:{c1:true,c9:true,c3:true}}}}},it,tpl);
  eq("제품 자기 목록이 있으면 그걸 씀 · 다른 목록 체크는 안 셈", [b.own,b.n,b.total,b.all], [true,2,2,true]);
  eq("틀도 목록도 없으면 0", lbChecks({},it,{}).total, 0);
  eq("빈 이름은 뺌", lbChecks({},it,{x_ad:[{id:"c1",name:" "},{id:"c2",name:"a"}]}).total, 1); }

console.log(`\n${fail?"❌":"✅"} ${pass} 통과 · ${fail} 실패`); if(fail) process.exit(1);
