// pour-os 다중 사용자 시나리오 테스트 (송희·민지·란·채림 각각)
// App.jsx의 TodayPage/EditTaskSheet/rm/restore/slotEvents 로직을 그대로 복제해
// "각 사용자가 쓸 때 문제 없는지"를 100+ 시나리오로 검증한다.
const WEEK_DAYS=["월","화","수","목","금"];
const USERS=[
  {id:"songhee",name:"김송희"},{id:"minji",name:"김민지"},
  {id:"ran",name:"이란"},{id:"chaerim",name:"양채림"},
];
const STATUSES=["todo","inprogress","done","hold"];

// ── App.jsx 로직 복제 ──
const myTasks=(tasks,uid)=>tasks.filter(t=>t.assigneeId===uid);
const todayT=(myT,today)=>myT.filter(t=>!t.isFixed&&t.weekDay===today&&t.status!=="hold");
const heldList=(myT)=>myT.filter(t=>!t.isFixed&&t.status==="hold");
const carryList=(myT,today)=>{
  const todayIdx=WEEK_DAYS.indexOf(today);
  return myT.filter(t=>!t.isFixed&&t.status!=="done"&&t.status!=="hold"&&t.weekDay&&t.weekDay!==today&&(()=>{const i=WEEK_DAYS.indexOf(t.weekDay);return i>=0&&(todayIdx<0||i<todayIdx);})());
};
const urgentList=(myT,now)=>myT.filter(t=>t.status!=="done"&&t.status!=="hold"&&t.dueDate&&(()=>{const dd=Math.ceil((new Date(t.dueDate)-now)/86400000);return dd>=0&&dd<=3;})());
const statusFilter=(myT,s)=>myT.filter(t=>!t.isFixed&&t.status===s);
const myProjects=(projects,uid)=>projects.filter(p=>p.assigneeId===uid||(p.collaboratorIds||[]).includes(uid));
const recalcProg=(proj,tasks)=>{
  if(proj.progressManual) return proj.progress||0;
  const parentIds=new Set(tasks.filter(t=>t.parentId).map(t=>t.parentId));
  const real=tasks.filter(t=>t.projectId===proj.id&&!t.isFixed&&!parentIds.has(t.id)&&t.status!=="hold");
  if(real.length===0) return proj.progress||0;
  return Math.round(real.filter(t=>t.status==="done").length/real.length*100);
};
const slotEvents=(events,tasks,uid,todayKey)=>(events||[]).filter(ev=>(ev.attendeeIds||[]).includes(uid)&&!(tasks||[]).some(t=>t.eventId===ev.id)&&(!ev.date||ev.date>=todayKey));
// 소프트 삭제/복구
let _tn=0; const newTid=()=>"trash"+(_tn++);
const rm=(state,k,id,cu)=>{
  if(k==="trash") return state;
  const item=(state[k]||[]).find(i=>i.id===id); if(!item) return state;
  const entry={...item,_col:k,_tid:newTid(),_deletedBy:cu};
  return {...state,[k]:(state[k]||[]).filter(i=>i.id!==id),trash:[...(state.trash||[]),entry]};
};
const restore=(state,tid)=>{
  const entry=(state.trash||[]).find(t=>t._tid===tid); if(!entry) return state;
  const left=(state.trash||[]).filter(t=>t._tid!==tid);
  if(entry._col==="_nested"){
    const {_col,_typeLabel,_parentCol,_parentId,_field,_tid,_deletedBy,...item}=entry;
    const parent=(state[_parentCol]||[]).find(x=>x.id===_parentId); if(!parent) return state;
    const arr=parent[_field]||[]; const exists=arr.some(x=>(item.id&&x.id===item.id)||(item.url&&x.url===item.url));
    const np={...parent,[_field]:exists?arr:[...arr,item]};
    return {...state,[_parentCol]:(state[_parentCol]||[]).map(x=>x.id===_parentId?np:x),trash:left};
  }
  const {_col,_tid,_deletedBy,...orig}=entry;
  const exists=(state[_col]||[]).some(i=>i.id===orig.id);
  return {...state,[_col]:exists?(state[_col]||[]):[...(state[_col]||[]),orig],trash:left};
};
const rmNested=(state,pc,pid,field,itemId,label,cu)=>{
  const parent=(state[pc]||[]).find(x=>x.id===pid); if(!parent) return state;
  const item=(parent[field]||[]).find(x=>x.id===itemId); if(!item) return state;
  const entry={...item,_col:"_nested",_typeLabel:label,_parentCol:pc,_parentId:pid,_field:field,_tid:newTid(),_deletedBy:cu};
  const np={...parent,[field]:(parent[field]||[]).filter(x=>x.id!==itemId)};
  return {...state,[pc]:(state[pc]||[]).map(x=>x.id===pid?np:x),trash:[...(state.trash||[]),entry]};
};
// 편집 시트 저장 (weekDay/weekSlot 포함)
const editSave=(tasks,id,patch)=>tasks.map(t=>t.id===id?{...t,...patch,weekDay:patch.weekDay||null,weekSlot:patch.weekSlot??null}:t);

// ── 러너 ──
let total=0, fail=0; const fails=[];
const check=(name,cond,ctx)=>{ total++; if(!cond){ fail++; if(fails.length<50) fails.push(`[${name}] ${JSON.stringify(ctx)}`); } };
const noNaN=(arr)=>arr.every(n=>typeof n==="number"&&!Number.isNaN(n));

// ── 공용 픽스처: 4명에게 다양한 업무 분배 ──
function buildFixture(){
  const tasks=[]; let tc=0;
  // 각 사용자 × 각 상태 × 각 배치(미배치/월/화/수/목/금) × (일반/고정)
  for(const u of USERS){
    for(const st of STATUSES){
      for(const wd of [null,"월","화","수","목","금"]){
        for(const fx of [false,true]){
          tasks.push({id:`t_${u.id}_${st}_${wd||"none"}_${fx?"fx":"g"}_${tc++}`,
            assigneeId:u.id,status:st,weekDay:wd,weekSlot:wd?1:null,isFixed:fx,
            projectId:"p_"+u.id,title:`${u.name} ${st} ${wd||"미배치"}`,dueDate:""});
        }
      }
    }
    // 마감 임박 업무 1개(오늘+2일)
    const due=new Date(); due.setDate(due.getDate()+2);
    tasks.push({id:`t_${u.id}_urgent`,assigneeId:u.id,status:"todo",weekDay:null,isFixed:false,
      projectId:"p_"+u.id,title:`${u.name} 임박`,dueDate:due.toISOString().slice(0,10)});
    // 이벤트 연결 업무(이미 배치됨)
    tasks.push({id:`t_${u.id}_ev`,assigneeId:u.id,status:"todo",weekDay:"월",isFixed:false,
      eventId:`ev_placed_${u.id}`,projectId:"p_"+u.id,title:`${u.name} 미팅업무`,dueDate:""});
  }
  const projects=USERS.map((u,i)=>({id:"p_"+u.id,assigneeId:u.id,
    collaboratorIds:[USERS[(i+1)%4].id],progress:0,
    activityKPIs:[{id:"ak_"+u.id,name:"등록",current:5,history:[1,2]}]}));
  const events=[];
  for(const u of USERS){
    events.push({id:`ev_open_${u.id}`,title:`${u.name} 외근`,date:"2099-01-01",type:"external",attendeeIds:[u.id]});
    events.push({id:`ev_placed_${u.id}`,title:`${u.name} 배치된미팅`,date:"2099-01-01",type:"internal",attendeeIds:[u.id]});
  }
  return {tasks,projects,events,trash:[]};
}

// ════════ 시나리오 1: 사용자별 일일 뷰 정합성 (4명 × 6일) ════════
for(const u of USERS){
  for(const today of [...WEEK_DAYS,"토"]){
    const fx=buildFixture();
    const myT=myTasks(fx.tasks,u.id);
    const tdy=todayT(myT,today);
    const held=heldList(myT);
    const carry=carryList(myT,today);
    const now=new Date();
    const urg=urgentList(myT,now);
    const ctx={u:u.id,today};
    // 격리: 내 뷰엔 내 업무만
    check("isolation-todayT", tdy.every(t=>t.assigneeId===u.id), ctx);
    check("isolation-carry", carry.every(t=>t.assigneeId===u.id), ctx);
    check("isolation-held", held.every(t=>t.assigneeId===u.id), ctx);
    // todayT 규칙
    check("todayT-day", tdy.every(t=>t.weekDay===today), ctx);
    check("todayT-noHold", tdy.every(t=>t.status!=="hold"), ctx);
    check("todayT-noFixed", tdy.every(t=>!t.isFixed), ctx);
    // carry 규칙
    check("carry-notToday", carry.every(t=>t.weekDay!==today), ctx);
    check("carry-noDone", carry.every(t=>t.status!=="done"), ctx);
    check("carry-noHold", carry.every(t=>t.status!=="hold"), ctx);
    check("carry-noFixed", carry.every(t=>!t.isFixed), ctx);
    check("carry-pastOnly", carry.every(t=>{const i=WEEK_DAYS.indexOf(t.weekDay);const ti=WEEK_DAYS.indexOf(today);return i>=0&&(ti<0||i<ti);}), ctx);
    // held 규칙
    check("held-allHold", held.every(t=>t.status==="hold"&&!t.isFixed), ctx);
    // 교집합 없음
    const idset=a=>new Set(a.map(t=>t.id));
    const tSet=idset(tdy), hSet=idset(held), cSet=idset(carry);
    check("disjoint-today-held", [...tSet].every(id=>!hSet.has(id)), ctx);
    check("disjoint-carry-held", [...cSet].every(id=>!hSet.has(id)), ctx);
    check("disjoint-today-carry", [...tSet].every(id=>!cSet.has(id)), ctx);
    // urgent: 보류·완료 제외
    check("urgent-noHoldDone", urg.every(t=>t.status!=="hold"&&t.status!=="done"), ctx);
    // 월요일엔 밀린 업무 없음(주 시작)
    if(today==="월") check("carry-empty-monday", carry.length===0, ctx);
    // 주말엔 todayT 없음(월~금만 배치)
    if(today==="토") check("todayT-empty-weekend", tdy.length===0, ctx);
  }
}

// ════════ 시나리오 2: 상태 필터 완전분할 (4명) ════════
for(const u of USERS){
  const fx=buildFixture();
  const mine=myTasks(fx.tasks,u.id).filter(t=>!t.isFixed);
  const counts=STATUSES.map(s=>statusFilter(myTasks(fx.tasks,u.id),s).length);
  check("filter-noNaN", noNaN(counts), {u:u.id});
  check("filter-sum", counts.reduce((a,b)=>a+b,0)===mine.length, {u:u.id,counts,mine:mine.length});
  // 각 업무가 정확히 한 필터에만
  for(const t of mine){
    const hits=STATUSES.filter(s=>statusFilter([t],s).length===1).length;
    check("filter-exactly-one", hits===1, {u:u.id,t:t.id,st:t.status});
  }
}

// ════════ 시나리오 3: 상태 전이 (보류↔오늘, 완료 토글) (4명 × 상태) ════════
for(const u of USERS){
  for(const today of WEEK_DAYS){
    let fx=buildFixture();
    // 보류 업무 하나를 오늘로 재개(bringToday)
    const myT0=myTasks(fx.tasks,u.id);
    const aHold=myT0.find(t=>t.status==="hold"&&!t.isFixed);
    if(aHold){
      fx={...fx,tasks:editSave(fx.tasks,aHold.id,{weekDay:today,weekSlot:null,status:"todo"})};
      const myT1=myTasks(fx.tasks,u.id);
      check("resume-inToday", todayT(myT1,today).some(t=>t.id===aHold.id), {u:u.id,today});
      check("resume-notHeld", !heldList(myT1).some(t=>t.id===aHold.id), {u:u.id});
    }
    // 오늘 업무 하나를 보류(holdTask)
    const myT2=myTasks(fx.tasks,u.id);
    const aToday=todayT(myT2,today)[0];
    if(aToday){
      const fx2={...fx,tasks:fx.tasks.map(t=>t.id===aToday.id?{...t,status:"hold"}:t)};
      const myT3=myTasks(fx2.tasks,u.id);
      check("hold-leavesToday", !todayT(myT3,today).some(t=>t.id===aToday.id), {u:u.id});
      check("hold-entersHeld", heldList(myT3).some(t=>t.id===aToday.id), {u:u.id});
    }
  }
}

// ════════ 시나리오 4: 편집 시트 — 상태+오늘 동시 변경 (4명) ════════
for(const u of USERS){
  const today=WEEK_DAYS[2]; // 수
  const fx=buildFixture();
  const myT=myTasks(fx.tasks,u.id);
  const target=myT.find(t=>!t.isFixed&&t.weekDay==="금"&&t.status==="todo");
  if(target){
    // 진행중 + 오늘 배치
    const tasks2=editSave(fx.tasks,target.id,{status:"inprogress",weekDay:today,weekSlot:null});
    const t2=tasks2.find(t=>t.id===target.id);
    check("edit-status", t2.status==="inprogress", {u:u.id});
    check("edit-today", t2.weekDay===today&&t2.weekSlot===null, {u:u.id});
    check("edit-inProgressFilter", statusFilter(myTasks(tasks2,u.id),"inprogress").some(t=>t.id===target.id), {u:u.id});
    // 미배치로 변경 → weekDay null
    const tasks3=editSave(fx.tasks,target.id,{status:"todo",weekDay:"",weekSlot:null});
    check("edit-unplace-null", tasks3.find(t=>t.id===target.id).weekDay===null, {u:u.id});
  }
}

// ════════ 시나리오 5: 진척률 — 보류 제외 (4명) ════════
for(const u of USERS){
  const fx=buildFixture();
  const proj=fx.projects.find(p=>p.id==="p_"+u.id);
  const ptasks=fx.tasks.filter(t=>t.projectId===proj.id);
  const prog=recalcProg(proj,ptasks);
  check("prog-range", prog>=0&&prog<=100&&!Number.isNaN(prog), {u:u.id,prog});
  // 보류를 done 제외·denominator 제외했는지: 직접 계산
  const parentIds=new Set(ptasks.filter(t=>t.parentId).map(t=>t.parentId));
  const real=ptasks.filter(t=>!t.isFixed&&!parentIds.has(t.id)&&t.status!=="hold");
  const expect=real.length?Math.round(real.filter(t=>t.status==="done").length/real.length*100):(proj.progress||0);
  check("prog-holdExcluded", prog===expect, {u:u.id,prog,expect});
}

// ════════ 시나리오 6: 캘린더 일정 배치 — 참석자 기반 (4명) ════════
for(const u of USERS){
  const fx=buildFixture();
  const todayKey=new Date().toISOString().slice(0,10);
  const evs=slotEvents(fx.events,fx.tasks,u.id,todayKey);
  // 내가 참석자인 미배치 일정만(ev_open), 이미 배치된 ev_placed 제외
  check("evt-onlyMine", evs.every(e=>(e.attendeeIds||[]).includes(u.id)), {u:u.id});
  check("evt-openOnly", evs.some(e=>e.id===`ev_open_${u.id}`), {u:u.id});
  check("evt-excludePlaced", !evs.some(e=>e.id===`ev_placed_${u.id}`), {u:u.id});
  check("evt-notOthers", !evs.some(e=>USERS.filter(x=>x.id!==u.id).some(x=>e.id===`ev_open_${x.id}`)), {u:u.id});
  // 배치하면 일정 연결 업무 생성 → 목록에서 사라짐
  const placedTasks=[...fx.tasks,{id:"newt",assigneeId:u.id,eventId:`ev_open_${u.id}`,weekDay:"월",status:"todo"}];
  const evs2=slotEvents(fx.events,placedTasks,u.id,todayKey);
  check("evt-disappearAfterPlace", !evs2.some(e=>e.id===`ev_open_${u.id}`), {u:u.id});
}

// ════════ 시나리오 7: 소프트 삭제 + 복구 (4명 × 컬렉션) ════════
for(const u of USERS){
  let fx=buildFixture();
  const myT=myTasks(fx.tasks,u.id).filter(t=>!t.isFixed);
  const victim=myT[0];
  // 삭제 → 휴지통
  fx=rm(fx,"tasks",victim.id,u.id);
  check("del-removed", !fx.tasks.some(t=>t.id===victim.id), {u:u.id});
  check("del-inTrash", fx.trash.some(t=>t.id===victim.id&&t._col==="tasks"&&t._deletedBy===u.id), {u:u.id});
  const tid=fx.trash.find(t=>t.id===victim.id)._tid;
  // 복구
  fx=restore(fx,tid);
  check("del-restored", fx.tasks.some(t=>t.id===victim.id), {u:u.id});
  check("del-trashEmptyAfter", !fx.trash.some(t=>t._tid===tid), {u:u.id});
  check("del-noMeta", !("_col" in (fx.tasks.find(t=>t.id===victim.id)||{})), {u:u.id});
  // 중첩(활동지표) 삭제+복구
  let fx2=buildFixture();
  fx2=rmNested(fx2,"projects","p_"+u.id,"activityKPIs","ak_"+u.id,"활동지표",u.id);
  const proj=fx2.projects.find(p=>p.id==="p_"+u.id);
  check("nested-removed", !(proj.activityKPIs||[]).some(a=>a.id==="ak_"+u.id), {u:u.id});
  check("nested-inTrash", fx2.trash.some(t=>t._col==="_nested"&&t.id==="ak_"+u.id), {u:u.id});
  const ntid=fx2.trash.find(t=>t.id==="ak_"+u.id)._tid;
  fx2=restore(fx2,ntid);
  const proj2=fx2.projects.find(p=>p.id==="p_"+u.id);
  check("nested-restored", (proj2.activityKPIs||[]).some(a=>a.id==="ak_"+u.id&&a.current===5), {u:u.id});
}

// ════════ 시나리오 8: 동시 사용 — 한 사람 변경이 남에게 영향 없음 (교차 4×4) ════════
for(const actor of USERS){
  let fx=buildFixture();
  // actor가 자기 업무 전부 완료 처리
  fx={...fx,tasks:fx.tasks.map(t=>t.assigneeId===actor.id&&!t.isFixed?{...t,status:"done"}:t)};
  for(const other of USERS){
    if(other.id===actor.id) continue;
    const myT=myTasks(fx.tasks,other.id);
    // 타인 업무는 그대로(완료 안 됨)
    const stillHasOpen=myT.some(t=>t.status==="todo"||t.status==="inprogress"||t.status==="hold");
    check("concurrent-isolation", stillHasOpen, {actor:actor.id,other:other.id});
    // 타인 진척도 변동 없음(자기 프로젝트 기준)
    const proj=fx.projects.find(p=>p.id==="p_"+other.id);
    const prog=recalcProg(proj,fx.tasks.filter(t=>t.projectId===proj.id));
    check("concurrent-prog-noNaN", !Number.isNaN(prog), {actor:actor.id,other:other.id});
  }
  // actor 본인 프로젝트는 100%(보류 제외 후 전부 done)
  const ap=fx.projects.find(p=>p.id==="p_"+actor.id);
  const aprog=recalcProg(ap,fx.tasks.filter(t=>t.projectId===ap.id));
  check("concurrent-actor-100", aprog===100, {actor:actor.id,aprog});
}

// ════════ 시나리오 9: 빠른 추가 → 오늘 배치 → 완료 흐름 (4명) ════════
for(const u of USERS){
  const today=WEEK_DAYS[1]; // 화
  let tasks=[];
  // 빠른추가(quick add): weekDay=today
  tasks.push({id:"q1",assigneeId:u.id,title:"빠른업무",status:"todo",weekDay:today,weekSlot:null,isFixed:false,projectId:""});
  check("quick-inToday", todayT(myTasks(tasks,u.id),today).length===1, {u:u.id});
  // 완료 토글
  tasks=tasks.map(t=>t.id==="q1"?{...t,status:"done"}:t);
  const tdy=todayT(myTasks(tasks,u.id),today);
  check("quick-doneStays", tdy.length===1&&tdy[0].status==="done", {u:u.id}); // 완료해도 오늘 목록엔 보임(취소선)
  check("quick-doneCount", tdy.filter(t=>t.status==="done").length===1, {u:u.id});
}

// ════════ 결과 ════════
console.log(`\n사용자별 시나리오 테스트: 총 ${total}건 · 실패 ${fail}건`);
if(fail){ console.log("실패 상세:"); fails.forEach(f=>console.log("  ✗ "+f)); process.exit(1); }
else console.log("✅ 송희·민지·란·채림 4인 모두 정상 — 격리·필터·전이·삭제복구·동시사용 불변식 통과");
