// 출시 인스턴스 생성 + 자동화 실행 엔진 (App.jsx에서 추출 — 동작 동일 + 테스트 가능 표면)
// ───────────── 자동화 실행 엔진 (기존 동작에 "얹기"만 — auto 설정이 없으면 완전 무동작) ─────────────
// 트리거: 업무 status==="done" 전이. 그 업무의 auto.onDone 액션 실행 + autoComplete 후속 단계 연쇄 완료.
// 순수 함수(state→state). visited 가드로 무한루프 차단. 자동 변경은 byName:"자동화"로 이력에 남김.
// 액션 종류(kind):
//   · createTask  → 후속 업무 자동 생성(담당자 지정)
//   · advance     → 다음 단계(이 업무를 deps로 가진 후속)를 즉시 ready로 — autoComplete면 자동 완료까지 연쇄
//   · notify      → 알림 업무(담당자 todo) 생성 + notify 플래그(추후 SMS/푸시 연동 지점)
export const AUTO_ACTOR={id:null,name:"자동화"};
export const applyAutomation=(state,doneId,actor)=>{
  if(!Array.isArray(state.tasks)) return state;
  let tasks=state.tasks.slice();
  const created=[];
  const visited=new Set();
  const genId=()=>"t"+Date.now()+Math.random().toString(36).slice(2,6);
  const cascade=(tid)=>{
    if(visited.has(tid)) return;   // 같은 업무 두 번 처리 금지(루프 가드)
    visited.add(tid);
    const t=tasks.find(x=>x.id===tid);
    if(!t) return;
    // ① 완료 시 액션(onDone) 실행 — createTask / notify(=알림 업무) / advance(후속 깨우기)
    const acts=(t.auto&&Array.isArray(t.auto.onDone))?t.auto.onDone:[];
    acts.forEach(a=>{
      if(!a||!a.kind) return;
      if((a.kind==="createTask"||a.kind==="notify")&&(a.title||"").trim()){
        const at=new Date().toISOString();
        const isNotify=a.kind==="notify";
        created.push({id:genId(),title:(isNotify?"🔔 ":"")+a.title.trim(),projectId:t.projectId||"",assigneeId:a.assigneeId||t.assigneeId||"",
          type:isNotify?"notify":"general",status:"todo",isFixed:false,weekDay:null,weekSlot:null,dueDate:"",
          memo:`⚡ 자동 생성 · '${t.title}' 완료 시`+(isNotify?" (알림)":""),attachments:[],auto:null,autoFrom:tid,notify:isNotify||undefined,
          statusLog:[{status:"todo",at,by:actor?.id||null,byName:AUTO_ACTOR.name}]});
      }
      // advance: 이 업무를 선행(deps)으로 가진 후속을 즉시 깨움(아래 ②의 autoComplete 연쇄로 처리). 별도 데이터 변경 없음.
    });
    // ② autoComplete 후속 단계: 선행(deps)이 모두 done이면 자동 완료 → 연쇄. advance 액션이 있으면 autoComplete 아니어도 1회 깨움.
    const hasAdvance=acts.some(a=>a&&a.kind==="advance");
    tasks.filter(x=>Array.isArray(x.deps)&&x.deps.includes(tid)).forEach(dep=>{
      if(dep.status==="done"||!(dep.autoComplete||hasAdvance)) return;
      const allDone=dep.deps.every(d=>{const dt=tasks.find(z=>z.id===d);return dt?dt.status==="done":true;});
      if(!allDone) return;
      const at=new Date().toISOString();
      tasks=tasks.map(x=>x.id===dep.id?{...x,status:"done",doneAt:at,doneBy:actor?.id||null,doneByName:AUTO_ACTOR.name,
        statusLog:[...(Array.isArray(x.statusLog)?x.statusLog:[]),{status:"done",at,by:actor?.id||null,byName:AUTO_ACTOR.name}]}:x);
      cascade(dep.id);   // 완료된 후속이 또 다른 후속을 깨움
    });
  };
  cascade(doneId);
  return created.length?{...state,tasks:[...tasks,...created]}:{...state,tasks};
};

// 템플릿 1개 → 신규 SKU 프로젝트 + 단계별 업무(선행연결·담당자배정) 자동 생성
export const instantiateLaunch=({tpl,productName,mainKPIId,subKPIId,dealerType,add})=>{
  const ts=Date.now();
  const projId="p"+ts;
  const taskIdByNode={};
  tpl.nodes.forEach((n,i)=>{taskIdByNode[n.id]="t"+ts+"_"+i;});
  const predsOf=(nodeId)=>tpl.edges.filter(e=>e.to===nodeId).map(e=>e.from);
  const assignees=[...new Set(tpl.nodes.map(n=>n.assigneeId).filter(Boolean))];
  const owner=tpl.nodes[0]?.assigneeId||assignees[0]||null;
  add("projects",{id:projId,mainKPIId:mainKPIId||null,subKPIId:subKPIId||null,title:`${productName} 출시`,productName,templateId:tpl.id,assigneeId:owner,collaboratorIds:assignees.filter(a=>a!==owner),group:"신상 출시",priority:"high",status:"active",progress:0,resultValue:0,dealerType:dealerType||""});
  tpl.nodes.forEach((n,i)=>{
    const deps=predsOf(n.id).map(pid=>taskIdByNode[pid]).filter(Boolean);
    add("tasks",{id:taskIdByNode[n.id],title:n.roleLabel?`[${n.roleLabel}] ${n.title}`:n.title,projectId:projId,assigneeId:n.assigneeId||owner,type:"general",status:"todo",weekDay:null,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[],auto:n.auto||null,autoComplete:!!n.autoComplete,launchNode:n.id,step:i,deps});
  });
};
