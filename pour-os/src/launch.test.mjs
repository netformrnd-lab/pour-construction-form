// 출시 인스턴스 전체 체인 시뮬레이션 — node src/launch.test.mjs
// 실제 코드(launch.js·kpi.js)로: 템플릿→인스턴스(프로젝트+7단계 업무) → 단계 완료 시 액션 자동생성 → 전부 완료 → 출시 KPI +1
import { applyAutomation, instantiateLaunch } from "./launch.js";
import { skCur } from "./kpi.js";

let pass=0,fail=0;
const ok=(name,cond,extra="")=>{ console.log(`${cond?"✅":"❌"} ${name}${extra?" · "+extra:""}`); cond?pass++:fail++; };
const actor={id:"songhee",name:"김송희"};

// INIT의 tpl_launch와 동일한 표준 프로세스(7단계 + 단계별 액션)
const tpl_launch={id:"tpl_launch",name:"신상 출시 표준 프로세스",
  nodes:[
    {id:"n1",title:"소싱·원가·납기 확정",roleLabel:"MD",assigneeId:"songhee",auto:{onDone:[{id:"n1a1",kind:"createTask",title:"원가·마진표 검수",assigneeId:"songhee"}]}},
    {id:"n2",title:"제품 교육·지식 전파",roleLabel:"MD",assigneeId:"songhee",auto:{onDone:[{id:"n2a1",kind:"createTask",title:"판매 포인트·셀링 카피 정리",assigneeId:"minji"}]}},
    {id:"n3",title:"썸네일·상세 디자인",roleLabel:"디자인",assigneeId:"minji",auto:{onDone:[{id:"n3a1",kind:"createTask",title:"상세 카피·표시사항 검수",assigneeId:"songhee"}]}},
    {id:"n4",title:"상품 등록·자사몰 노출",roleLabel:"등록",assigneeId:"minji",auto:{onDone:[{id:"n4a1",kind:"createTask",title:"자사몰 노출·가격 확인",assigneeId:"minji"}]}},
    {id:"n5",title:"마켓 동시 등록",roleLabel:"등록",assigneeId:"minji",auto:{onDone:[{id:"n5a1",kind:"createTask",title:"마켓 노출·옵션·가격 검수",assigneeId:"minji"}]}},
    {id:"n6",title:"출시 배너·주문 세팅",roleLabel:"운영",assigneeId:"chaerim",auto:{onDone:[{id:"n6a1",kind:"createTask",title:"주문·결제·배송 테스트",assigneeId:"chaerim"}]}},
    {id:"n7",title:"B2B 안내·실사용 콘텐츠",roleLabel:"영업",assigneeId:"ran",auto:{onDone:[{id:"n7a1",kind:"createTask",title:"B2B 안내 발송·반응 체크",assigneeId:"ran"}]}},
  ],
  edges:[{id:"e1",from:"n1",to:"n2"},{id:"e2",from:"n2",to:"n3"},{id:"e3",from:"n3",to:"n4"},{id:"e4",from:"n4",to:"n5"},{id:"e5",from:"n5",to:"n6"},{id:"e6",from:"n6",to:"n7"}],
};
const sk_launch={id:"sk_launch",mainKPIId:"mk3",unit:"개",currentValue:0,launchCount:true};

// ── 진척 산출(앱 recalcProg와 동일 공식): done/실제업무 ──
const progOf=(state,projId)=>{ const real=state.tasks.filter(t=>t.projectId===projId&&!t.isFixed); if(!real.length)return 0; return Math.round(real.filter(t=>t.status==="done").length/real.length*100); };
const syncProg=(state)=>({...state,projects:state.projects.map(p=>({...p,progress:progOf(state,p.id)}))});
// 업무 완료 = status done 후 자동화 엔진 실행(앱 reducer와 동일 순서)
const complete=(state,id)=>{ let s={...state,tasks:state.tasks.map(t=>t.id===id?{...t,status:"done"}:t)}; return syncProg(applyAutomation(s,id,actor)); };

console.log("── ① 인스턴스 생성(템플릿→프로젝트+7단계 업무) ──");
let state={projects:[],tasks:[]};
const add=(k,item)=>{ state[k]=[...(state[k]||[]),item]; };
instantiateLaunch({tpl:tpl_launch,productName:"방수 스프레이 시즌2",mainKPIId:"mk3",subKPIId:"sk_launch",add});
const proj=state.projects[0];
const stageTasks=state.tasks.filter(t=>t.launchNode).sort((a,b)=>a.step-b.step);
ok("프로젝트 1건 생성",state.projects.length===1,proj.title);
ok("7단계 업무 생성",stageTasks.length===7);
ok("담당자 배정(1·2 송희 / 3~5 민지 / 6 채림 / 7 란)",
   stageTasks.map(t=>t.assigneeId).join(",")==="songhee,songhee,minji,minji,minji,chaerim,ran");
ok("선행연결(2단계는 1단계 선행)",stageTasks[1].deps.includes(stageTasks[0].id));
state=syncProg(state);
ok("초기 출시 KPI=0",skCur(sk_launch,state.projects)===0,`progress ${state.projects[0].progress}%`);

console.log("── ② 7단계 순차 완료 → 각 단계 액션(후속 업무) 자동 생성 ──");
stageTasks.forEach(t=>{ state=complete(state,t.id); });
const autoTasks=state.tasks.filter(t=>t.autoFrom);
ok("액션 업무 7건 자동 생성",autoTasks.length===7,autoTasks.map(t=>t.title).join(" / "));
ok("자동 메모 표기",autoTasks.every(t=>/⚡ 자동 생성/.test(t.memo)));
ok("단계만 완료 시 KPI 아직 0(후속 업무 미완)",skCur(sk_launch,state.projects)===0,`progress ${state.projects[0].progress}%`);

console.log("── ③ 후속 액션 업무까지 전부 완료 → 출시 KPI +1 ──");
autoTasks.forEach(t=>{ state=complete(state,t.id); });
ok("프로젝트 진척 100%",state.projects[0].progress===100);
ok("🎯 출시 KPI 0→1 집계",skCur(sk_launch,state.projects)===1);

console.log("── ④ 액션 종류 확장(Task2): notify(알림) / advance(다음 단계) ──");
// notify: 알림 업무 자동 생성(🔔)
let s2={projects:[{id:"px",templateId:"t",progress:0}],tasks:[
  {id:"x1",projectId:"px",status:"todo",auto:{onDone:[{kind:"notify",title:"송희에게 승인 요청",assigneeId:"songhee"}]}},
]};
s2={...s2,tasks:s2.tasks.map(t=>t.id==="x1"?{...t,status:"done"}:t)};
s2=applyAutomation(s2,"x1",actor);
const noti=s2.tasks.find(t=>t.notify);
ok("notify 액션 → 🔔 알림 업무 생성",!!noti&&noti.type==="notify"&&/^🔔/.test(noti.title),noti&&noti.title);
// advance: autoComplete 아니어도 다음 단계 1회 깨워 완료
let s3={projects:[{id:"py"}],tasks:[
  {id:"y1",projectId:"py",status:"todo",deps:[],auto:{onDone:[{kind:"advance",title:""}]}},
  {id:"y2",projectId:"py",status:"todo",deps:["y1"],autoComplete:false},
]};
s3={...s3,tasks:s3.tasks.map(t=>t.id==="y1"?{...t,status:"done"}:t)};
s3=applyAutomation(s3,"y1",actor);
ok("advance 액션 → 다음 단계 자동 진행(완료)",s3.tasks.find(t=>t.id==="y2").status==="done");
// 회귀: advance/ notify 없는 일반 createTask·autoComplete는 기존대로
let s4={projects:[{id:"pz"}],tasks:[
  {id:"z1",projectId:"pz",status:"todo",deps:[],auto:{onDone:[{kind:"createTask",title:"검수",assigneeId:"minji"}]}},
  {id:"z2",projectId:"pz",status:"todo",deps:["z1"],autoComplete:false},
]};
s4={...s4,tasks:s4.tasks.map(t=>t.id==="z1"?{...t,status:"done"}:t)};
s4=applyAutomation(s4,"z1",actor);
ok("회귀: advance없는 autoComplete:false 후속은 그대로 todo",s4.tasks.find(t=>t.id==="z2").status==="todo");

console.log(`\n${fail===0?"🟢 전체 통과":"🔴 실패 있음"} — pass ${pass} / fail ${fail}`);
process.exit(fail===0?0:1);
