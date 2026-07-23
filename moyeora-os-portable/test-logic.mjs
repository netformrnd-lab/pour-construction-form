// pour-os 핵심 로직 1000+ 케이스 테스트 (실제 App.jsx 구현 복사)
// 목적: 경계값·랜덤 조합에서 NaN/크래시/이상값(불변식 위반) 탐지
const ALL_DAYS=["일","월","화","수","목","금","토"];

// ── 실제 App.jsx 구현 (복사) ──
const pct=(c,t)=>t===0||t==null?0:Math.max(0,Math.min(100,Math.round((c/t)*100)));
const weekKey=(d=new Date())=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const weekLabel=(key)=>{const m=new Date(key);const su=new Date(m);su.setDate(su.getDate()+6);const f=z=>`${z.getMonth()+1}/${z.getDate()}`;return `${f(m)}~${f(su)}`;};
const numF=(x)=>{const n=Number(x);return isFinite(n)?n:0;};
const skCur=(sk,projects)=>{
  if(sk.launchCount) return (projects||[]).filter(p=>p.templateId&&(p.progress||0)>=100).length;
  if(sk.unit!=="원"&&sk.unit!=="%"&&!sk.launchCount){ const cc=(projects||[]).filter(p=>p.countKPIId===sk.id); if(cc.length) return numF(sk.currentValue)+cc.filter(p=>(p.progress||0)>=100).length; }
  if(sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride) return (projects||[]).filter(p=>p.subKPIId===sk.id).reduce((a,p)=>a+numF(p.resultValue),0);
  if(sk.unit==="%"&&!sk.manualOverride){ const ch=(projects||[]).filter(p=>p.subKPIId===sk.id); if(ch.length) return Math.round(ch.reduce((a,p)=>a+numF(p.progress),0)/ch.length); }
  return numF(sk.currentValue);
};
const mkCur=(mk,subKPIs,projects)=>{
  if(mk.unit==="원") return subKPIs.filter(s=>s.mainKPIId===mk.id&&!s.launchCount).reduce((a,s)=>a+skCur(s,projects),0);
  if(!mk.manualOverride){ const subs=subKPIs.filter(s=>s.mainKPIId===mk.id&&!s.launchCount); if(subs.length){ const eq=subs.reduce((a,s)=>{const t=numF(s.targetValue); return a+(t>0?Math.min(1,skCur(s,projects)/t):0);},0); return Math.round(eq*10)/10; } }
  return numF(mk.currentValue);
};
// 진척 자동산출 (recalcProg)
const autoProg=(proj,tasks)=>{ if(proj.progressManual) return numF(proj.progress); const real=(tasks||[]).filter(t=>t.projectId===proj.id&&!t.isFixed); if(real.length===0) return numF(proj.progress); return Math.round(real.filter(t=>t.status==="done").length/real.length*100); };
// 매출 이력 엔트리 (setSale)
const saleEntry=(prev,raw)=>{const v=raw===""?0:(Number(raw)||0);if(!isFinite(v))return null;const p=numF(prev);if(v===p)return null;return{value:v,prev:p,delta:v-p};};
const fmt=(n,u)=>{
  if(!n||isNaN(n)) return "0"+(u||"");
  if(u==="원"&&n>=100000000) return (n/100000000).toFixed(1)+"억";
  if(u==="원"&&n>=10000) return Math.round(n/10000).toLocaleString()+"만";
  return n.toLocaleString()+(u||"");
};
// 반복주기 dueToday (TodayPage)
const fixedDueToday=(t,today,todayDate)=>{const rt=t.recurType||"daily";if(rt==="weekly")return t.weekDay===today;if(rt==="monthly")return Number(t.monthDay||1)===todayDate;return true;};
// applyVal 결과 (KPI 추가값/총값)
const applyValResult=(prev,mode,amount)=>{const v=mode==="delta"?(Number(prev)||0)+(Number(amount)||0):(Number(amount)||0);return isFinite(v)?v:0;};
// 마감 임박 (urgent) D-3
const isUrgent=(dueDate,now)=>{const dd=Math.ceil((new Date(dueDate)-now)/86400000);return dd>=0&&dd<=3;};
// CSV 셀 이스케이프 (exportCSV)
const csvCell=(c)=>`"${String(c).replace(/"/g,'""')}"`;

// ── 테스트 러너 ──
let total=0, fail=0; const fails=[];
function check(name, cond, ctx){ total++; if(!cond){ fail++; if(fails.length<40) fails.push(`[${name}] ${JSON.stringify(ctx)}`); } }
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=arr=>arr[rnd(0,arr.length-1)];
// 더러운 값 풀 (경계/이상값)
const dirty=[0,-1,-0.5,1,9999,10000,99999999,100000000,123456789,1e12,NaN,null,undefined,"","123","abc",Infinity,-Infinity,0.1,2.999];
const units=["원","%","건","모듈","개","h",undefined,""];

// 1) pct — 항상 -∞~100 사이 숫자, NaN 금지(단 입력 NaN 제외 검증)
for(let i=0;i<250;i++){
  const c=pick(dirty), t=pick(dirty);
  const r=pct(c,t);
  check("pct-number", typeof r==="number", {c,t,r});
  check("pct-max100", !(r>100), {c,t,r});
  // t가 정상수일 때 c도 정상수면 NaN 아니어야
  if(typeof c==="number"&&isFinite(c)&&typeof t==="number"&&isFinite(t)&&t!==0){
    check("pct-noNaN", !Number.isNaN(r), {c,t,r});
  }
}
// 2) fmt — 항상 문자열, "undefined"/"NaN" 안 섞임
for(let i=0;i<250;i++){
  const n=pick(dirty), u=pick(units);
  const s=fmt(n,u);
  check("fmt-string", typeof s==="string", {n,u,s});
  check("fmt-noNaNword", !s.includes("NaN"), {n,u,s});
  check("fmt-noUndef", !s.includes("undefined"), {n,u,s});
}
// 3) skCur / mkCur — 랜덤 KPI 트리, 숫자 결과, NaN 금지
for(let i=0;i<200;i++){
  const projects=Array.from({length:rnd(0,8)},(_,j)=>({id:"p"+j,subKPIId:pick(["sk1","sk2",undefined,"skX"]),resultValue:pick(dirty),progress:pick(dirty)}));
  const subKPIs=Array.from({length:rnd(0,6)},(_,j)=>({id:"sk"+j,mainKPIId:pick(["mk1","mk2","mk3"]),unit:pick(units),targetValue:pick(dirty),currentValue:pick(dirty),manualOverride:pick([true,false,undefined])}));
  for(const sk of subKPIs){ const v=skCur(sk,projects); check("skCur-num",typeof v==="number"&&!Number.isNaN(v),{sk,v}); }
  for(const mk of [{id:"mk1",unit:"원",currentValue:pick(dirty)},{id:"mk2",unit:"원"},{id:"mk3",unit:"모듈",currentValue:pick(dirty),manualOverride:pick([true,false,undefined])}]){
    const v=mkCur(mk,subKPIs,projects); check("mkCur-num",typeof v==="number"&&!Number.isNaN(v),{mk,v});
  }
}
// 3b) autoProg — 항상 0~100 정수, NaN 금지
for(let i=0;i<200;i++){
  const pid="p"+rnd(0,3);
  const tasks=Array.from({length:rnd(0,7)},(_,j)=>({id:"t"+j,projectId:pick([pid,"pX"]),isFixed:pick([true,false,undefined]),status:pick(["todo","inprogress","hold","done"])}));
  const proj={id:pid,progress:pick(dirty),progressManual:pick([true,false,undefined])};
  const r=autoProg(proj,tasks);
  check("autoProg-num", typeof r==="number"&&!Number.isNaN(r), {proj,r});
  if(!proj.progressManual){ const real=tasks.filter(t=>t.projectId===pid&&!t.isFixed); if(real.length) check("autoProg-range", r>=0&&r<=100, {real:real.length,r}); }
}
// 3c) saleEntry — 동일값/이상값은 null, 그 외 delta 정확
for(let i=0;i<150;i++){
  const prev=pick(dirty), raw=pick([...dirty,""]);
  const e=saleEntry(prev,raw);
  if(e){ check("saleEntry-num", isFinite(e.value)&&isFinite(e.delta), {prev,raw,e}); check("saleEntry-delta", e.delta===e.value-e.prev, {prev,raw,e}); }
}
// 4) weekKey/weekLabel — 유효 날짜, 월요일, 라벨 NaN 금지
for(let i=0;i<150;i++){
  const d=new Date(2026,rnd(0,11),rnd(1,28),rnd(0,23));
  const k=weekKey(d);
  check("weekKey-iso", /^\d{4}-\d{2}-\d{2}$/.test(k), {d:d.toISOString(),k});
  check("weekKey-mon", new Date(k).getDay()===1, {k,day:new Date(k).getDay()});
  const lbl=weekLabel(k);
  check("weekLabel-noNaN", !lbl.includes("NaN"), {k,lbl});
}
// 5) 반복주기 dueToday — 모든 요일/날짜 조합
for(let i=0;i<200;i++){
  const t={recurType:pick(["daily","weekly","monthly",undefined]),weekDay:pick(ALL_DAYS),monthDay:pick([1,15,28,29,30,31,undefined])};
  const today=pick(ALL_DAYS), todayDate=rnd(1,31);
  const r=fixedDueToday(t,today,todayDate);
  check("recur-bool", typeof r==="boolean", {t,today,todayDate,r});
  if((t.recurType||"daily")==="daily") check("recur-daily-always", r===true, {t});
}
// 6) applyVal 추가값/총값 — 숫자, delta는 누적
for(let i=0;i<150;i++){
  const prev=pick(dirty), amount=pick(dirty), mode=pick(["delta","total"]);
  const r=applyValResult(prev,mode,amount);
  check("applyVal-num", typeof r==="number"&&!Number.isNaN(r), {prev,mode,amount,r});
  if(mode==="delta"&&isFinite(Number(prev))&&isFinite(Number(amount))) check("applyVal-delta", r===(Number(prev)||0)+(Number(amount)||0), {prev,amount,r});
}
// 7) urgent D-3 — boolean, 미래 4일+ 제외, 과거 제외
const now=new Date(2026,5,10);
for(let i=0;i<120;i++){
  const off=rnd(-10,10);
  const due=new Date(now); due.setDate(due.getDate()+off);
  const r=isUrgent(due.toISOString().slice(0,10),now);
  check("urgent-bool", typeof r==="boolean", {off,r});
  if(off<0) check("urgent-past-excluded", r===false, {off,r});
  if(off>3) check("urgent-far-excluded", r===false, {off,r});
}
// 8) CSV 이스케이프 — 따옴표/콤마/줄바꿈/한글 안전
const csvDirty=['일반','콤마,있음','따옴표"있"음','줄\n바꿈','한글 김송희','',null,undefined,123,'="수식"'];
for(let i=0;i<100;i++){
  const c=pick(csvDirty);
  const cell=csvCell(c);
  check("csv-wrapped", cell.startsWith('"')&&cell.endsWith('"'), {c,cell});
  // 내부 따옴표는 "" 로 이스케이프 → 홀수 따옴표 없어야
  const inner=cell.slice(1,-1);
  check("csv-quote-escaped", (inner.match(/"/g)||[]).length%2===0, {c,cell});
}

// 9) 기여도 — projContrib 합계 불변식 / 주간목표 진행도
const inWeek=(at,wk)=>at&&weekKey(new Date(at))===wk;
const matchUid=(users,id,name)=>{ if(id&&users.find(u=>u.id===id))return id; if(name){const u=users.find(u=>u.name===name);if(u)return u.id;} return null; };
const projContrib=(users,tasks,proj)=>{
  const wk=weekKey(); const map={};
  const bump=(uid,k,at)=>{ if(!uid)return; const m=map[uid]||(map[uid]={task:0,sales:0,act:0,total:0,wk:0}); m[k]++; m.total++; if(inWeek(at,wk))m.wk++; };
  (tasks||[]).filter(t=>t.projectId===proj.id&&!t.isFixed&&t.status==="done").forEach(t=>bump(matchUid(users,t.doneBy,t.doneByName)||t.assigneeId,"task",t.doneAt));
  (proj.salesHistory||[]).forEach(h=>bump(matchUid(users,h.by,h.byName),"sales",h.at));
  (proj.activityKPIs||[]).forEach(ak=>(ak.history||[]).forEach(h=>bump(matchUid(users,h.by,h.byName),"act",h.at)));
  return Object.entries(map).map(([uid,m])=>({uid,...m})).sort((a,b)=>b.total-a.total);
};
const myWeekTarget=(proj,uid)=>{ const wk=weekKey(); const t=(proj.weekTargets||[]).find(x=>x.userId===uid&&x.week===wk); return t?Math.max(0,numF(t.target)):0; };
const users=[{id:"u1",name:"송희"},{id:"u2",name:"란"},{id:"u3",name:"민지"}];
for(let i=0;i<250;i++){
  const proj={id:"p1",salesHistory:Array.from({length:rnd(0,4)},()=>({by:pick(["u1","u2",null,"xx"]),byName:pick(["송희","란",null]),at:new Date(2026,5,rnd(1,28)).toISOString()})),activityKPIs:[{history:Array.from({length:rnd(0,3)},()=>({by:pick(["u1","u3",null]),at:new Date(2026,5,rnd(1,28)).toISOString()}))}],weekTargets:[{userId:"u1",week:weekKey(),target:pick(dirty)}]};
  const tasks=Array.from({length:rnd(0,6)},(_,j)=>({id:"t"+j,projectId:pick(["p1","pX"]),isFixed:pick([true,false]),status:pick(["todo","done"]),doneBy:pick(["u1","u2",null]),doneByName:pick(["송희",null]),doneAt:new Date(2026,5,rnd(1,28)).toISOString(),assigneeId:pick(["u1","u3"])}));
  const rows=projContrib(users,tasks,proj);
  rows.forEach(r=>{
    check("contrib-total", r.total===r.task+r.sales+r.act, {r});
    check("contrib-num", [r.task,r.sales,r.act,r.wk].every(x=>typeof x==="number"&&!Number.isNaN(x)&&x>=0), {r});
    check("contrib-wk-le-total", r.wk<=r.total, {r});
  });
  // 정렬 단조 감소
  for(let k=1;k<rows.length;k++) check("contrib-sorted", rows[k-1].total>=rows[k].total, {a:rows[k-1].total,b:rows[k].total});
  const tg=myWeekTarget(proj,"u1");
  check("weektarget-num", typeof tg==="number"&&!Number.isNaN(tg)&&tg>=0, {tg});
}

// ── KPI 집계 체인 정밀 검증 (skCur/mkCur — 매출·운영·출시·카운트 전 분기) ──
for(let i=0;i<400;i++){
  const projs=Array.from({length:rnd(0,5)},(_,j)=>({id:"p"+j,subKPIId:pick(["s_rev",null]),countKPIId:pick(["s_cnt",null]),templateId:pick(["tpl",null]),progress:pick([0,30,60,100,...dirty]),resultValue:pick([0,1000,5000000,...dirty])}));
  // mk2 원 자동집계 subKPI
  const sRev={id:"s_rev",mainKPIId:"mk2",unit:"원",targetValue:5000000};
  const expRev=projs.filter(p=>p.subKPIId==="s_rev").reduce((a,p)=>a+(isFinite(+p.resultValue)?+p.resultValue:0),0);
  check("skCur-mk2-rev=Σresult", skCur(sRev,projs)===expRev, {got:skCur(sRev,projs),expRev});
  // 출시 수(launchCount) = templateId && progress>=100 개수
  const sLaunch={id:"s_l",mainKPIId:"mk3",unit:"개",launchCount:true,currentValue:99};
  const expL=projs.filter(p=>p.templateId&&(p.progress||0)>=100).length;
  check("skCur-launchCount", skCur(sLaunch,projs)===expL, {got:skCur(sLaunch,projs),expL});
  // 카운트업(countKPIId) = seed + 완료(progress>=100) 개수
  const seed=rnd(0,10), sCnt={id:"s_cnt",mainKPIId:"mk3",unit:"건",currentValue:seed};
  const cc=projs.filter(p=>p.countKPIId==="s_cnt");
  const expC=cc.length?seed+cc.filter(p=>(p.progress||0)>=100).length:seed;
  check("skCur-countup", skCur(sCnt,projs)===expC, {got:skCur(sCnt,projs),expC,seed});
  // mkCur(원)=Σ subKPIs(launchCount 제외) · goal=Σ mainKPI(원) — 이중집계·NaN 없음
  const subs=[sRev,{id:"s_man",mainKPIId:"mk2",unit:"원",currentValue:2000000,manualOverride:true},sLaunch];
  const mk2={id:"mk2",unit:"원"};
  const expMk2=skCur(sRev,projs)+2000000;   // launchCount(sLaunch)는 제외돼야 함
  check("mkCur-원=Σsub(제외 launchCount)", mkCur(mk2,subs,projs)===expMk2, {got:mkCur(mk2,subs,projs),expMk2});
  check("mkCur-num", Number.isFinite(mkCur(mk2,subs,projs)), {});
  check("skCur-num-all", [skCur(sRev,projs),skCur(sLaunch,projs),skCur(sCnt,projs)].every(Number.isFinite), {});
  // 운영(%) 롤업 = 자식 progress 평균 (0~100, NaN 없음)
  const sPct={id:"s_pct",mainKPIId:"mk3",unit:"%",targetValue:100};
  const pc=skCur({...sPct,id:"s_rev"},projs); // %는 subKPIId 매칭 자식 평균
  check("skCur-%-num", Number.isFinite(skCur(sPct,projs)), {});
}

console.log(`\n총 ${total}건 테스트 · 실패 ${fail}건`);
if(fail){ console.log("─ 실패 샘플 ─"); fails.forEach(f=>console.log("  "+f)); process.exit(1); }
else console.log("✅ 모든 불변식 통과 (NaN/크래시/이상값 없음)");
