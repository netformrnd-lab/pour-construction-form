// 모여라딜 OS 옮기기 계산 테스트 — node src/moyImport.test.mjs
import { planMoyImport, parseMoyDocs, fsVal } from "./moyImport.js";
import { brandView, projBrand, taskBrand } from "./brand.js";
let pass=0, fail=0; const eq=(n,a,b)=>{ const ok=JSON.stringify(a)===JSON.stringify(b); console.log(`${ok?"✅":"❌"} ${n}${ok?"":` → ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`); ok?pass++:fail++; };
const src={ users:[{id:"songhee",name:"김송희"},{id:"yongjeongha",name:"용정하"},{id:"bot1",name:"봇"}],
  goals:[{id:"g1",title:"하반기 1억"}], mainKPIs:[{id:"mk1",goalId:"g1",title:"성장"},{id:"mk2",goalId:"g1",title:"매출"}],
  subKPIs:[{id:"sk_deal",mainKPIId:"mk1"}],
  projects:[{id:"p1",title:"공구",mainKPIId:"mk1",subKPIId:"sk_deal",assigneeId:"yongjeongha",collaboratorIds:["songhee","bot1"]},{id:"p2",title:"바라스데이 ",mainKPIId:"mk1",assigneeId:"yongjeongha"},{id:"p3",title:"그로홈",mainKPIId:"mk2"}],
  tasks:[{id:"t1",projectId:"p1",assigneeId:"yongjeongha",parentId:null},{id:"t2",projectId:"p1",parentId:"t1",assigneeId:"bot1"},{id:"t3",projectId:"",isFixed:true,assigneeId:"yongjeongha"},{id:"t4",projectId:"gone",parentId:"gone2"}],
  activityLog:[{id:"l1",by:"yongjeongha",targetId:"t1",at:"2026-07-01"}] };
const D={ users:[{id:"songhee",name:"김송희"},{id:"u9",name:"용정하"}], brands:[{id:"pourstore",name:"POUR스토어"},{id:"grohome",name:"그로홈"},{id:"bB",name:"바라스데이"},{id:"bM",name:"모여라딜"}],
  goals:[{id:"g1",title:"POUR"}], mainKPIs:[{id:"mk1",goalId:"g1"}], subKPIs:[], projects:[], tasks:[{id:"x",assigneeId:"songhee"}], actionKPIs:[], lagKPIs:[] };
const pl=planMoyImport(src,D,{brandId:"bM"});
eq("id 앞에 md_ · 기존 mk1 은 그대로", [pl.adds.mainKPIs.map(m=>m.id), D.mainKPIs[0].id], [["md_mk1","md_mk2"],"mk1"]);
eq("연결 이어짐 (목표→KPI→서브→프로젝트)", [pl.adds.mainKPIs[0].goalId, pl.adds.subKPIs[0].mainKPIId, pl.adds.projects[0].mainKPIId, pl.adds.projects[0].subKPIId], ["md_g1","md_mk1","md_mk1","md_sk_deal"]);
eq("사람: 같은 이름으로 붙이고 봇은 비움", [pl.userMap, pl.unmatched, pl.adds.projects[0].assigneeId, pl.adds.projects[0].collaboratorIds, pl.adds.tasks[1].assigneeId], [{songhee:"songhee",yongjeongha:"u9",bot1:""},["봇"],"u9",["songhee"],""]);
eq("프로젝트 브랜드: 바라스데이·그로홈은 그 브랜드(모여라딜 KPI 연결 끊음)", pl.adds.projects.map(p=>[p.brand,p.mainKPIId]), [["bM","md_mk1"],["bB",""],["grohome",""]]);
eq("업무: 프로젝트·상위 업무 이음 · 프로젝트 없는 업무는 모여라딜 브랜드 · 없는 프로젝트는 비움", pl.adds.tasks.map(t=>[t.projectId,t.parentId,t.brand||""]), [["md_p1",null,""],["md_p1","md_t1",""],["",undefined,"bM"],["",null,"bM"]]);
eq("활동 기록도 md_ · 사람 바꿈", [pl.logs[0].id, pl.logs[0].by, pl.logs[0].targetId], ["md_l1","u9","md_t1"]);
// 합친 뒤 모여라딜 보기
const D2={...D,goals:[...D.goals,...pl.adds.goals],mainKPIs:[...D.mainKPIs,...pl.adds.mainKPIs],subKPIs:pl.adds.subKPIs,projects:pl.adds.projects,tasks:[...D.tasks,...pl.adds.tasks]};
const v=brandView(D2,"bM");
eq("모여라딜 브랜드로 보면 목표·KPI·프로젝트·업무가 보임", [v.goals.map(g=>g.id),v.mainKPIs.length,v.projects.map(p=>p.id),v.tasks.length], [["md_g1"],2,["md_p1"],5]);   // 모여라딜 업무 4 + 공통 업무 1
eq("POUR스토어 보기엔 모여라딜 것이 안 섞임", brandView(D2,"pourstore").projects.length, 0);
eq("두 번째는 0건 (중복 없음)", planMoyImport(src,D2,{brandId:"bM"}).nothing, true);
eq("Firestore REST 값 풀기", [fsVal({integerValue:"5"}),fsVal({mapValue:{fields:{a:{stringValue:"x"}}}}),fsVal({arrayValue:{values:[{booleanValue:true}]}})], [5,{a:"x"},[true]]);
eq("문서 목록 → 키별 items", Object.keys(parseMoyDocs({documents:[{name:"x/moyeoradeal-os/state-tasks",fields:{items:{arrayValue:{values:[]}}}},{name:"x/state-meta",fields:{v:{integerValue:"2"}}}]})), ["tasks"]);
console.log(`\n${fail?"❌":"✅"} ${pass} 통과 · ${fail} 실패`); if(fail) process.exit(1);
