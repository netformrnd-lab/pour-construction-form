// pour-os 핵심 로직 1000+ 케이스 테스트 (실제 App.jsx 구현 복사)
// 목적: 경계값·랜덤 조합에서 NaN/크래시/이상값(불변식 위반) 탐지
const ALL_DAYS=["일","월","화","수","목","금","토"];

// ── 실제 App.jsx 구현 (복사) ──
const pct=(c,t)=>t===0||t==null?0:Math.min(100,Math.round((c/t)*100));
const weekKey=(d=new Date())=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const weekLabel=(key)=>{const m=new Date(key);const su=new Date(m);su.setDate(su.getDate()+6);const f=z=>`${z.getMonth()+1}/${z.getDate()}`;return `${f(m)}~${f(su)}`;};
const skCur=(sk,projects)=>(sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride)?(projects||[]).filter(p=>p.subKPIId===sk.id).reduce((a,p)=>a+(Number(p.resultValue)||0),0):(Number(sk.currentValue)||0);
const mkCur=(mk,subKPIs,projects)=>mk.unit==="원"?subKPIs.filter(s=>s.mainKPIId===mk.id).reduce((a,s)=>a+skCur(s,projects),0):(Number(mk.currentValue)||0);
const fmt=(n,u)=>{
  if(!n||isNaN(n)) return "0"+(u||"");
  if(u==="원"&&n>=100000000) return (n/100000000).toFixed(1)+"억";
  if(u==="원"&&n>=10000) return Math.round(n/10000).toLocaleString()+"만";
  return n.toLocaleString()+(u||"");
};
// 반복주기 dueToday (TodayPage)
const fixedDueToday=(t,today,todayDate)=>{const rt=t.recurType||"daily";if(rt==="weekly")return t.weekDay===today;if(rt==="monthly")return Number(t.monthDay||1)===todayDate;return true;};
// applyVal 결과 (KPI 추가값/총값)
const applyValResult=(prev,mode,amount)=>mode==="delta"?(Number(prev)||0)+(Number(amount)||0):(Number(amount)||0);
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
  const projects=Array.from({length:rnd(0,8)},(_,j)=>({id:"p"+j,subKPIId:pick(["sk1","sk2",undefined,"skX"]),resultValue:pick(dirty)}));
  const subKPIs=Array.from({length:rnd(0,6)},(_,j)=>({id:"sk"+j,mainKPIId:pick(["mk1","mk2","mk3"]),unit:pick(units),currentValue:pick(dirty),manualOverride:pick([true,false,undefined])}));
  for(const sk of subKPIs){ const v=skCur(sk,projects); check("skCur-num",typeof v==="number"&&!Number.isNaN(v),{sk,v}); }
  for(const mk of [{id:"mk1",unit:"원",currentValue:pick(dirty)},{id:"mk2",unit:"원"},{id:"mk3",unit:"모듈",currentValue:pick(dirty)}]){
    const v=mkCur(mk,subKPIs,projects); check("mkCur-num",typeof v==="number"&&!Number.isNaN(v),{mk,v});
  }
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

console.log(`\n총 ${total}건 테스트 · 실패 ${fail}건`);
if(fail){ console.log("─ 실패 샘플 ─"); fails.forEach(f=>console.log("  "+f)); process.exit(1); }
else console.log("✅ 모든 불변식 통과 (NaN/크래시/이상값 없음)");
