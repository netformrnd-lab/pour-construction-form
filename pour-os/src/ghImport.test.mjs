// 그로홈 대시보드 업무 옮기기 계산 테스트 — node src/ghImport.test.mjs
import { planGhImport, parseGhCol, ghUserId } from "./ghImport.js";
import { brandView } from "./brand.js";
let pass=0, fail=0; const eq=(n,a,b)=>{ const ok=JSON.stringify(a)===JSON.stringify(b); console.log(`${ok?"✅":"❌"} ${n}${ok?"":` → ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`); ok?pass++:fail++; };
const src={ employees:[{_id:"e1",name:"남윤정"},{_id:"e2",name:"김보성"}],
  fixedTasks:[{_id:"f1",employeeId:"e1",content:"재고관리",times:[{time:"상시"}]},{_id:"f2",employeeId:"e2",content:"CS",times:[{time:"9:00"}]}],
  etcTasks:[{_id:"a1",employeeId:"e1",content:"배너",completed:true,createdAt:"2026-05-01"},{_id:"a2",employeeId:"3",content:"옛 담당",completed:false}],
  leadingTasks:[{_id:"l1",employeeId:"e1",content:"리뷰 목표",completed:"False"}], monthlyTasks:[{_id:"m1",employeeId:"e1",content:"정산",dueDate:"2026-10-30",completed:false}],
  gbTasks:[{_id:"g1",id:"x1",kpiId:"brand",title:"오감리뷰",assignee:"남윤정",status:"진행중",quarter:"2분기",why:"노출",parentId:"None"},{_id:"g2",kpiId:"brand",title:"하위",assignee:"이채은",status:"완료",parentId:"x1"}] };
const D={ users:[{id:"un",name:"남윤정"},{id:"songhee",name:"김송희"}], projects:[], tasks:[] };
const pl=planGhImport(src,D,{brandId:"grohome"});
eq("없는 사람(김보성·이채은)은 미사용 담당자로 추가", pl.adds.users.map(u=>[u.name,u.active,u.id===ghUserId(u.name)]), [["김보성",false,true],["이채은",false,true]]);
const T=(id)=>pl.adds.tasks.find(t=>t.id===id);
eq("고정업무: 시간 맞추기·'상시'는 메모", [T("gh_fx_f1").fixedTime,T("gh_fx_f1").memo,T("gh_fx_f2").fixedTime,T("gh_fx_f2").isFixed,T("gh_fx_f2").assigneeId], [null,"그로홈 대시보드 고정업무 · 주기: 상시","09:00",true,ghUserId("김보성")]);
eq("기타·선행·월간: 완료·마감·출처", [T("gh_etc_a1").status,T("gh_etc_a1").doneAt,T("gh_lead_l1").status,T("gh_mon_m1").dueDate,T("gh_etc_a2").assigneeId], ["done","2026-05-01","todo","2026-10-30",""]);
eq("KPI 업무: 분야별 프로젝트 · 하위 연결 · 상태 · 메모", [pl.adds.projects.map(p=>p.title), T("gh_gb_g1").projectId, T("gh_gb_g2").parentId, T("gh_gb_g1").status, T("gh_gb_g2").status, T("gh_gb_g1").memo], [["그로홈 KPI 업무 · 브랜드"],"gh_kpi_brand","gh_gb_g1","inprogress","done","분기: 2분기\n이유: 노출"]);
eq("프로젝트 책임자는 업무OS에서 쓰는 사람 중 가장 많이 맡은 사람", pl.adds.projects[0].assigneeId, "un");
const D2={...D,users:[...D.users,...pl.adds.users],projects:pl.adds.projects,tasks:pl.adds.tasks};
eq("그로홈 보기에 다 보이고 POUR스토어엔 안 섞임", [brandView(D2,"grohome").tasks.length, brandView(D2,"pourstore").tasks.length], [8,0]);
eq("두 번째는 0건", planGhImport(src,D2,{brandId:"grohome"}).nothing, true);
eq("REST 문서 → 행(_id 포함)", parseGhCol({documents:[{name:"a/b/fixedTasks/f9",fields:{content:{stringValue:"x"}}}]}), [{content:"x",_id:"f9"}]);
console.log(`\n${fail?"❌":"✅"} ${pass} 통과 · ${fail} 실패`); if(fail) process.exit(1);
