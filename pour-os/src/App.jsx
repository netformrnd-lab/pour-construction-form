import { useState, useEffect, useRef } from "react";
import { STATE_DOC, colDoc, META_DOC, getDoc, onSnapshot, setDoc, uploadTaskPhoto, deleteTaskPhoto } from "./firebase.js";

// Firestore 단일 문서에 저장할 공유 데이터 키 (currentUser는 기기별 로컬이라 제외)
const SHARED_KEYS = ["users","goals","mainKPIs","subKPIs","projects","tasks","personalGoals","retros","aiReviews","events","weekGoals","launchTemplates"];
const COL_LABEL = {users:"담당자",goals:"최종목표",mainKPIs:"메인KPI",subKPIs:"서브KPI",projects:"프로젝트",tasks:"업무",personalGoals:"개인목표",retros:"회고",aiReviews:"AI점검",events:"일정",weekGoals:"주간목표",launchTemplates:"출시템플릿"};
const LOCAL_USER_KEY = "pour-os-current-user";
const MIRROR_KEY = "pour-os-mirror";        // 2차 안전: 마지막 상태를 이 기기에 거울 저장
const MIRROR_AT_KEY = "pour-os-mirror-at";  // 거울 저장 시각(ISO)
const DOC_LIMIT = 1048576;                  // Firestore 문서 1 MiB 한도
const pickShared = (d) => { const o = {}; for (const k of SHARED_KEYS) o[k] = d[k]; return o; };

const C = {
  primary:"#3182F6", primaryL:"#EBF3FF",
  success:"#00C073", successL:"#E8FAF1",
  warning:"#FF9500", warningL:"#FFF3E0",
  danger:"#F04452",  dangerL:"#FFF0F1",
  purple:"#8B5CF6",  purpleL:"#F3EFFE",
  navy:"#0F1F5C",
  orange:"#F97316",  orangeL:"#FFEDD5", orangeD:"#EA580C",
  g50:"#F9FAFB", g100:"#F2F4F6", g200:"#E5E8EB",
  g300:"#D1D5DB", g400:"#9CA3AF", g500:"#6B7280",
  g600:"#4B5563", g700:"#374151", g800:"#1F2937", g900:"#111827",
  white:"#FFFFFF",
};
const WEEK_DAYS=["월","화","수","목","금"];
const ALL_DAYS=["일","월","화","수","목","금","토"];
const GOAL_TYPE={revenue:{l:"💰 매출",c:"#EA580C",bg:"#FFEDD5"},metric:{l:"🎯 목표",c:"#7C3AED",bg:"#F3EFFE"},journey:{l:"🔁 여정",c:"#0891B2",bg:"#E0F2FE"}};
const STATUS_MAP={
  todo:{label:"할일",color:"#6B7280",bg:"#F2F4F6"},
  inprogress:{label:"진행중",color:"#3182F6",bg:"#EBF3FF"},
  done:{label:"완료",color:"#00C073",bg:"#E8FAF1"},
  hold:{label:"보류",color:"#FF9500",bg:"#FFF3E0"},
};
// ── 거래처유형 코드 체계 (SSOT) — 마스터프롬프트 v3.1 ──
// 색상군: 개인=회색 / P4파트너=파랑 / P3대리점=주황 / 유통·셀러=보라 / G채널=초록
const DEALER_TYPES=[
  {code:"C-IND",label:"개인 셀프시공",role:"셀프",price:"P8",color:"#6B7280"},
  {code:"P-CON",label:"시공사 파트너",role:"시공",price:"P4",color:"#3182F6"},
  {code:"P-MGT",label:"관리주체 파트너",role:"관리대행",price:"P4·H",color:"#3182F6"},
  {code:"P-BLD",label:"종합건설사",role:"시공",price:"P4·H",color:"#3182F6"},
  {code:"P-ONL",label:"온라인 유통 파트너",role:"유통",price:"P4",color:"#3182F6"},
  {code:"D-PNT",label:"페인트점 대리점",role:"판매+시공",price:"P3",color:"#F97316"},
  {code:"D-HDW",label:"철물점 대리점",role:"판매+시공",price:"P3",color:"#F97316"},
  {code:"S-INF",label:"위탁 셀러",role:"홍보·송객",price:"P5",color:"#8B5CF6"},
  {code:"W-ONL",label:"온라인 도매상",role:"유통",price:"P6",color:"#8B5CF6"},
  {code:"W-B2B",label:"B2B 전문 판매처",role:"유통(도매)",price:"MOQ",color:"#8B5CF6"},
  {code:"X-TOP",label:"총판·수출",role:"유통(총판)",price:"P2",color:"#8B5CF6"},
  {code:"G-ARC",label:"건축사·설계",role:"설계",price:"무료(스펙)",color:"#00C073"},
  {code:"G-OFF",label:"시공사 공무팀",role:"조달",price:"P4",color:"#00C073"},
  {code:"G-GOV",label:"관급 자재담당",role:"조달",price:"관급",color:"#00C073"},
];
const DT=Object.fromEntries(DEALER_TYPES.map(d=>[d.code,d]));
const INIT={
  currentUser:"songhee",
  users:[
    {id:"songhee",name:"김송희",role:"lead",dept:"전략·자사몰",color:"#3182F6"},
    {id:"minji",name:"김민지",role:"member",dept:"디자인·콘텐츠·CS",color:"#8B5CF6"},
    {id:"ran",name:"이란",role:"member",dept:"광고·B2B·영업",color:"#00C073"},
    {id:"chaerim",name:"양채림",role:"member",dept:"운영·CS·인프라",color:"#F97316"},
  ],
  goals:[
    {id:"g1",title:"2026년 매출 10억 달성",targetValue:1000000000,currentValue:161000000,unit:"원",year:2026},
  ],
  mainKPIs:[
    {id:"mk1",goalId:"g1",title:"POUR 직판 매출 5억",targetValue:500000000,currentValue:89000000,unit:"원",order:1,krKey:"메인1"},
    {id:"mk2",goalId:"g1",title:"B2B 종합 매출 5억",targetValue:500000000,currentValue:72000000,unit:"원",order:2,krKey:"메인2"},
    {id:"mk3",goalId:"g1",title:"운영 시스템 4모듈 구축",targetValue:4,currentValue:1,unit:"모듈",order:3,krKey:"메인3"},
  ],
  subKPIs:[
    {id:"sk1",mainKPIId:"mk1",title:"자사몰 매출 (OWN)",targetValue:300000000,currentValue:52000000,unit:"원",order:1,channelCode:"OWN"},
    {id:"sk2",mainKPIId:"mk1",title:"마켓플레이스 매출 (MK)",targetValue:150000000,currentValue:28000000,unit:"원",order:2,channelCode:"MK"},
    {id:"sk3",mainKPIId:"mk1",title:"쇼룸·전화·박람회 (SHOW)",targetValue:50000000,currentValue:9000000,unit:"원",order:3,channelCode:"SHOW"},
    {id:"sk4",mainKPIId:"mk2",title:"파트너사 매출 (P4)",targetValue:300000000,currentValue:41000000,unit:"원",order:1,channelCode:"P4"},
    {id:"sk5",mainKPIId:"mk2",title:"대리점·오프라인몰 (P3)",targetValue:80000000,currentValue:15000000,unit:"원",order:2,channelCode:"P3"},
    {id:"sk_h",mainKPIId:"mk2",title:"공법·솔루션 이관 매출 (H)",targetValue:50000000,currentValue:0,unit:"원",order:3,channelCode:"H"},
    {id:"sk7",mainKPIId:"mk2",title:"위탁·브로커 매출 (P5)",targetValue:40000000,currentValue:5000000,unit:"원",order:4,channelCode:"P5"},
    {id:"sk_p6",mainKPIId:"mk2",title:"온라인 도매 매출 (P6)",targetValue:30000000,currentValue:0,unit:"원",order:5,channelCode:"P6"},
    {id:"sk8",mainKPIId:"mk2",title:"시공매칭 매출 (M)",targetValue:30000000,currentValue:3000000,unit:"원",order:6,channelCode:"M"},
    {id:"sk6",mainKPIId:"mk2",title:"조달청·관급 매출 (G)",targetValue:50000000,currentValue:8000000,unit:"원",order:7,channelCode:"G"},
    {id:"sk9",mainKPIId:"mk3",title:"CRM 시스템 구축",targetValue:100,currentValue:35,unit:"%",order:1,channelCode:"CRM"},
    {id:"sk10",mainKPIId:"mk3",title:"매출관리 시스템 구축",targetValue:100,currentValue:60,unit:"%",order:2,channelCode:"REV"},
    {id:"sk11",mainKPIId:"mk3",title:"어드민센터 구축",targetValue:100,currentValue:72,unit:"%",order:3,channelCode:"ADM"},
    {id:"sk12",mainKPIId:"mk3",title:"매뉴얼 33건",targetValue:33,currentValue:8,unit:"건",order:4,channelCode:"MAN"},
    {id:"sk_launch",mainKPIId:"mk3",title:"신규 SKU 출시 수",targetValue:30,currentValue:0,unit:"개",order:5,channelCode:"SKU",launchCount:true},
  ],
  projects:[
    {id:"p001",mainKPIId:"mk1",subKPIId:"sk1",title:"자사몰 페이지 디자인 전면 재구축",assigneeId:"songhee",collaboratorIds:["minji"],group:"자사몰 구축·운영",priority:"high",status:"active",progress:40,resultValue:0,dealerType:"C-IND"},
    {id:"p004",mainKPIId:"mk1",subKPIId:"sk2",title:"신규 SKU 세팅 (썸네일·상세·통디자인)",assigneeId:"minji",collaboratorIds:[],group:"자사몰 구축·운영",priority:"high",status:"active",progress:55,resultValue:0,dealerType:"C-IND"},
    {id:"p007",mainKPIId:"mk1",subKPIId:"sk1",title:"매거진 포스팅 제작",assigneeId:"minji",collaboratorIds:[],group:"자사몰 구축·운영",priority:"mid",status:"active",progress:30,resultValue:0,dealerType:"C-IND"},
    {id:"p030",mainKPIId:"mk1",subKPIId:"sk2",title:"광고 운영 전체 (네이버·메타·CPC)",assigneeId:"ran",collaboratorIds:[],group:"광고·키워드",priority:"high",status:"active",progress:65,resultValue:28000000,dealerType:"C-IND"},
    {id:"p031",mainKPIId:"mk1",subKPIId:"sk1",title:"SEO·키워드 최적화",assigneeId:"ran",collaboratorIds:[],group:"광고·키워드",priority:"mid",status:"active",progress:45,resultValue:0,dealerType:"C-IND"},
    {id:"p100",mainKPIId:"mk2",subKPIId:"sk5",title:"페인트점 대리점 운영",assigneeId:"songhee",collaboratorIds:[],group:"B2B 종합",priority:"high",status:"active",progress:60,resultValue:15000000,dealerType:"D-PNT"},
    {id:"p101",mainKPIId:"mk2",subKPIId:"sk4",title:"시공사 파트너 확보·운영",assigneeId:"ran",collaboratorIds:[],group:"B2B 종합",priority:"high",status:"active",progress:35,resultValue:0,dealerType:"P-CON"},
    {id:"p102",mainKPIId:"mk2",subKPIId:"sk4",title:"관리주체 파트너 확보·운영",assigneeId:"songhee",collaboratorIds:[],group:"B2B 종합",priority:"high",status:"active",progress:0,resultValue:0,dealerType:"P-MGT"},
    {id:"p103",mainKPIId:"mk2",subKPIId:"sk5",title:"철물점 대리점 운영",assigneeId:"ran",collaboratorIds:[],group:"B2B 종합",priority:"mid",status:"active",progress:0,resultValue:0,dealerType:"D-HDW"},
    {id:"p104",mainKPIId:"mk2",subKPIId:"sk4",title:"자재상 파트너 확보·운영",assigneeId:"ran",collaboratorIds:[],group:"B2B 종합",priority:"mid",status:"active",progress:0,resultValue:0,dealerType:"P-ONL"},
    {id:"p106",mainKPIId:"mk2",subKPIId:"sk8",title:"시공매칭 실행",assigneeId:"ran",collaboratorIds:["songhee"],group:"B2B 종합",priority:"high",status:"active",progress:20,resultValue:3000000},
    {id:"p113",mainKPIId:"mk2",subKPIId:"sk7",title:"온라인 위탁 판매처 제안",assigneeId:"minji",collaboratorIds:["songhee"],group:"B2B 종합",priority:"high",status:"active",progress:50,resultValue:0,dealerType:"S-INF"},
    {id:"p400",mainKPIId:"mk2",subKPIId:"sk6",title:"벤처나라 등록 후속 운영",assigneeId:"minji",collaboratorIds:["songhee"],group:"조달청·관급 (G)",priority:"high",status:"active",progress:70,resultValue:8000000,dealerType:"G-GOV"},
    {id:"p402",mainKPIId:"mk2",subKPIId:"sk6",title:"시방서 스펙 영업",assigneeId:"songhee",collaboratorIds:[],group:"조달청·관급 (G)",priority:"high",status:"active",progress:25,resultValue:0,dealerType:"G-ARC"},
    {id:"p404",mainKPIId:"mk2",subKPIId:"sk6",title:"나라장터 견적서 발송",assigneeId:"songhee",collaboratorIds:[],group:"조달청·관급 (G)",priority:"high",status:"active",progress:55,resultValue:0,dealerType:"G-GOV"},
    {id:"p200",mainKPIId:"mk3",subKPIId:"sk9",title:"AI 챗봇 개발",assigneeId:"songhee",collaboratorIds:[],group:"운영 시스템",priority:"high",status:"active",progress:35,resultValue:0},
    {id:"p201",mainKPIId:"mk3",subKPIId:"sk11",title:"어드민센터 개발",assigneeId:"songhee",collaboratorIds:[],group:"운영 시스템",priority:"high",status:"active",progress:72,resultValue:0},
    {id:"p202",mainKPIId:"mk3",subKPIId:"sk9",title:"CRM 센터 개발",assigneeId:"ran",collaboratorIds:[],group:"운영 시스템",priority:"high",status:"active",progress:35,resultValue:0},
    {id:"p203",mainKPIId:"mk3",subKPIId:"sk10",title:"매출관리 센터 개발",assigneeId:"ran",collaboratorIds:[],group:"운영 시스템",priority:"high",status:"active",progress:60,resultValue:0},
    {id:"p300",mainKPIId:null,subKPIId:null,title:"주문·발주 (그로홈+POUR스토어)",assigneeId:"chaerim",collaboratorIds:[],group:"운영 인프라",priority:"high",status:"active",progress:80,resultValue:0},
    {id:"p301",mainKPIId:null,subKPIId:null,title:"재고관리",assigneeId:"chaerim",collaboratorIds:[],group:"운영 인프라",priority:"high",status:"active",progress:75,resultValue:0},
    {id:"p302",mainKPIId:null,subKPIId:null,title:"반품 CS",assigneeId:"chaerim",collaboratorIds:[],group:"운영 인프라",priority:"mid",status:"active",progress:60,resultValue:0},
    {id:"p008",mainKPIId:"mk1",subKPIId:"sk1",title:"AI 콘텐츠소스 제작 (힉스필드)",assigneeId:"chaerim",collaboratorIds:[],group:"자사몰 구축·운영",priority:"high",status:"active",progress:10,resultValue:0,dealerType:"C-IND"},
    {id:"p009",mainKPIId:"mk1",subKPIId:"sk1",title:"포토후기·NPS 운영",assigneeId:"chaerim",collaboratorIds:[],group:"자사몰 구축·운영",priority:"mid",status:"active",progress:0,resultValue:0,dealerType:"C-IND"},
    {id:"p040",mainKPIId:"mk1",subKPIId:"sk3",title:"박람회·쇼룸 현장 운영",assigneeId:"ran",collaboratorIds:["songhee"],group:"쇼룸·박람회",priority:"high",status:"active",progress:25,resultValue:0,dealerType:"C-IND"},
    {id:"p110",mainKPIId:"mk2",subKPIId:"sk_h",title:"관리주체 파트너 프로모션 (지인추천·추가가입)",assigneeId:"songhee",collaboratorIds:["ran"],group:"B2B 종합",priority:"high",status:"active",progress:0,resultValue:0,dealerType:"P-MGT"},
    {id:"p111",mainKPIId:"mk2",subKPIId:"sk_h",title:"솔루션 안내·이관",assigneeId:"songhee",collaboratorIds:["ran"],group:"B2B 종합",priority:"high",status:"active",progress:0,resultValue:0},
    {id:"p115",mainKPIId:"mk2",subKPIId:"sk_p6",title:"온라인 도매 입점·운영 (도매꾹·나비엠알오)",assigneeId:"ran",collaboratorIds:[],group:"B2B 종합",priority:"mid",status:"active",progress:0,resultValue:0,dealerType:"W-ONL"},
  ],
  tasks:[],
  personalGoals:[
    {id:"pg1",userId:"ran",month:"2026-06",title:"나라장터 견적 주 5건 발송",targetValue:20,currentValue:8,unit:"건"},
    {id:"pg2",userId:"minji",month:"2026-06",title:"SKU 주 3개 세팅",targetValue:12,currentValue:7,unit:"개"},
    {id:"pg3",userId:"chaerim",month:"2026-06",title:"반품 처리시간 2h 이내",targetValue:2,currentValue:2.8,unit:"h",inverse:true},
  ],
  retros:[],
  aiReviews:[],
  events:[
    {id:"e1",title:"주간 팀 미팅",date:"2026-06-09",type:"internal",projectId:null,description:"주간 현황 공유"},
    {id:"e2",title:"벤처나라 고객 미팅",date:"2026-06-12",type:"external",projectId:"p400",description:"조달청 납품 협의"},
    {id:"e3",title:"건축박람회 참가",date:"2026-06-18",type:"fair",projectId:null,description:"코엑스 B홀"},
    {id:"e4",title:"여름 프로모션 런칭",date:"2026-06-20",type:"promotion",projectId:null,description:"자사몰+마켓 동시"},
  ],
  weekGoals:[],
  // 출시 프로세스 템플릿(마인드맵) — 신상 SKU를 찍어내는 표준 흐름. 동일 프로세스 1개 기본 제공.
  launchTemplates:[
    {id:"tpl_launch", name:"신상 출시 표준 프로세스", createdAt:"2026-06-12T00:00:00.000Z",
      nodes:[
        {id:"n1", title:"소싱·원가·납기 확정", roleLabel:"MD",    assigneeId:"songhee", x:24,  y:24},
        {id:"n2", title:"제품 교육·지식 전파",  roleLabel:"본부장", assigneeId:"songhee", x:172, y:118},
        {id:"n3", title:"소스 확보 → 상품 등록", roleLabel:"",     assigneeId:"minji",   x:30,  y:214},
        {id:"n4", title:"출시 배너 → 주문 세팅", roleLabel:"",     assigneeId:"chaerim", x:178, y:310},
        {id:"n5", title:"B2B 안내·실사용 콘텐츠", roleLabel:"",     assigneeId:"ran",     x:36,  y:406},
      ],
      edges:[
        {id:"e1", from:"n1", to:"n2"},
        {id:"e2", from:"n2", to:"n3"},
        {id:"e3", from:"n3", to:"n4"},
        {id:"e4", from:"n4", to:"n5"},
      ],
    },
  ],
};
const pct=(c,t)=>t===0||t==null?0:Math.max(0,Math.min(100,Math.round((c/t)*100)));
// 주차 헬퍼 (월요일 시작)
const weekKey=(d=new Date())=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const weekLabel=(key)=>{const m=new Date(key);const su=new Date(m);su.setDate(su.getDate()+6);const f=z=>`${z.getMonth()+1}/${z.getDate()}`;return `${f(m)}~${f(su)}`;};
// 메인KPI2(B2B): 서브KPI 현재값 = 자식 프로젝트 매출 성과(resultValue) 합계 / 메인KPI1·3: 수동값
const numF=(x)=>{const n=Number(x);return isFinite(n)?n:0;};   // 문자열·NaN·Infinity → 0 (집계 방탄)
// 서브KPI 현재값:
//  · 메인2(원) 자동 → 자식 프로젝트 매출(resultValue) 합계
//  · 운영(%) 자동 → 자식 프로젝트 진척(progress) 평균  ← 업무→진척→운영KPI 롤업
//  · 그 외/수동지정 → currentValue
const skCur=(sk,projects)=>{
  if(sk.launchCount) return (projects||[]).filter(p=>p.templateId&&(p.progress||0)>=100).length;   // 출시 완료(progress 100%) SKU 자동 집계
  if(sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride) return (projects||[]).filter(p=>p.subKPIId===sk.id).reduce((a,p)=>a+numF(p.resultValue),0);
  if(sk.unit==="%"&&!sk.manualOverride){ const ch=(projects||[]).filter(p=>p.subKPIId===sk.id); if(ch.length) return Math.round(ch.reduce((a,p)=>a+numF(p.progress),0)/ch.length); }
  return numF(sk.currentValue);
};
// 메인KPI 현재값:
//  · 원 → 자식 서브KPI 합계
//  · 운영(원 아님) 자동 → 자식 서브KPI 완료비율 합(= 환산 달성 단위), 자식 없으면 currentValue
//  · 수동지정(manualOverride) → currentValue
const mkCur=(mk,subKPIs,projects)=>{
  if(mk.unit==="원") return subKPIs.filter(s=>s.mainKPIId===mk.id&&!s.launchCount).reduce((a,s)=>a+skCur(s,projects),0);
  if(!mk.manualOverride){ const subs=subKPIs.filter(s=>s.mainKPIId===mk.id&&!s.launchCount); if(subs.length){ const eq=subs.reduce((a,s)=>{const t=numF(s.targetValue); return a+(t>0?Math.min(1,skCur(s,projects)/t):0);},0); return Math.round(eq*10)/10; } }
  return numF(mk.currentValue);
};
const fmt=(n,u)=>{
  if(!n||isNaN(n)) return "0"+(u||"");
  if(u==="원"&&n>=100000000) return (n/100000000).toFixed(1)+"억";
  if(u==="원"&&n>=10000) return Math.round(n/10000).toLocaleString()+"만";
  return n.toLocaleString()+(u||"");
};
// 금액 → 한글 정확 읽기 ("1억 2,300만원") — 0 개수 실수 방지용
const fmtKorWon=(n)=>{ n=Math.round(numF(n)); if(n<=0) return "0원"; const eok=Math.floor(n/100000000); const man=Math.floor((n%100000000)/10000); const won=n%10000; let s=""; if(eok)s+=eok.toLocaleString()+"억 "; if(man)s+=man.toLocaleString()+"만 "; if(won)s+=won.toLocaleString(); return s.trim()+"원"; };
// 금액 입력기 — 숫자 + [원|만|억] 단위 토글 + 빠른칩 + 한글 실시간 표기 (초등학생도 정확 입력)
function MoneyInput({value,onCommit,compact,live}){
  const M={"원":1,"만":10000,"억":100000000};
  const [unit,setUnit]=useState("만");
  const [raw,setRaw]=useState("");
  useEffect(()=>{ const v=numF(value); if(v<=0){setRaw("");return;} let u="만"; if(v>=100000000)u="억"; else if(v<10000)u="원"; setUnit(u); const r=v/M[u]; setRaw(String(Math.round(r*100)/100)); /* eslint-disable-next-line */ },[]);
  const total=Math.round((Number(raw)||0)*M[unit]);
  const commit=(r,u)=>{ const n=Math.round((Number(r)||0)*M[u]); onCommit(n); };
  const chips=[["+1만",10000],["+10만",100000],["+100만",1000000],["+1천만",10000000],["+1억",100000000]];
  return(
    <div>
      <div style={{display:"flex",gap:6,alignItems:"stretch"}}>
        <input type="number" inputMode="decimal" value={raw} onChange={e=>{setRaw(e.target.value);if(live)commit(e.target.value,unit);}} onBlur={e=>commit(e.target.value,unit)} placeholder="0" style={{flex:1,minWidth:0,padding:compact?"8px 10px":"11px 12px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:compact?14:15,fontWeight:800,textAlign:"right",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        <div style={{display:"inline-flex",borderRadius:10,border:"1.5px solid #E5E8EB",overflow:"hidden",flexShrink:0}}>
          {["원","만","억"].map(u=>(<button key={u} onClick={()=>{setUnit(u);commit(raw,u);}} style={{padding:compact?"0 9px":"0 11px",fontSize:12.5,fontWeight:800,border:"none",cursor:"pointer",backgroundColor:unit===u?"#F97316":"#fff",color:unit===u?"#fff":"#9CA3AF",fontFamily:"inherit"}}>{u}</button>))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:5,flexWrap:"wrap"}}>
        <span style={{fontSize:11.5,fontWeight:800,color:total>0?"#EA580C":"#C4C9D0"}}>= {fmtKorWon(total)}</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {chips.map(([l,d])=>(<button key={l} onClick={()=>{const n=Math.max(0,total+d);setUnit("원");setRaw(String(n));onCommit(n);}} style={{padding:"3px 7px",borderRadius:7,border:"1px solid #E5E8EB",background:"#F9FAFB",fontSize:10.5,fontWeight:700,color:"#4B5563",cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}
          {total>0&&<button onClick={()=>{setRaw("");onCommit(0);}} style={{padding:"3px 7px",borderRadius:7,border:"1px solid #FFE2E5",background:"#FFF0F1",fontSize:10.5,fontWeight:700,color:"#F04452",cursor:"pointer",fontFamily:"inherit"}}>지움</button>}
        </div>
      </div>
    </div>
  );
}
const todayDay=()=>ALL_DAYS[new Date().getDay()];
const nowMonth=()=>new Date().toISOString().slice(0,7);
const PBar=({value,color="#3182F6",h=5})=>(
  <div style={{width:"100%",height:h,borderRadius:h,backgroundColor:"#F2F4F6",overflow:"hidden"}}>
    <div style={{width:`${value}%`,height:"100%",borderRadius:h,backgroundColor:color,transition:"width 0.4s"}}/>
  </div>
);
const Badge=({color,bg,children})=>(
  <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,color,backgroundColor:bg}}>{children}</span>
);
const Ava=({name,color,size=32})=>{
  const cols=["#3182F6","#8B5CF6","#00C073","#FF9500","#F04452"];
  const c=color||cols[(name?.charCodeAt(0)||0)%cols.length];
  return <div style={{width:size,height:size,borderRadius:"50%",backgroundColor:c+"22",color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:800,flexShrink:0}}>{name?.[0]||"?"}</div>;
};
const Sheet=({open,onClose,title,children,h="85vh"})=>{
  if(!open) return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{backgroundColor:"#FFFFFF",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:h,display:"flex",flexDirection:"column",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"12px 0 6px",display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
          <div style={{width:36,height:4,borderRadius:2,backgroundColor:"#E5E8EB"}}/>
          {title&&<h3 style={{margin:"10px 0 0",fontSize:16,fontWeight:800,color:"#0F1F5C"}}>{title}</h3>}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 18px 28px"}}>{children}</div>
      </div>
    </div>
  );
};
const Btn=({children,onClick,variant="primary",size="md",disabled,full,style:sx={}})=>{
  const vs={primary:{backgroundColor:"#3182F6",color:"#FFFFFF"},secondary:{backgroundColor:"#F2F4F6",color:"#374151"},orange:{backgroundColor:"#F97316",color:"#FFFFFF"},danger:{backgroundColor:"#FFF0F1",color:"#F04452"}};
  const ss={sm:{padding:"7px 14px",fontSize:12,borderRadius:9},md:{padding:"11px 18px",fontSize:14,borderRadius:12},lg:{padding:"14px 0",fontSize:15,borderRadius:14}};
  const v=vs[variant]||vs.primary,s=ss[size]||ss.md;
  return <button onClick={onClick} disabled={disabled} style={{...v,...s,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,border:"none",fontFamily:"inherit",width:full?"100%":undefined,...sx}}>{children}</button>;
};
const Confirm=({open,title,desc,onOk,onCancel})=>{
  if(!open) return null;
  return(
    <div onClick={onCancel} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
      <div onClick={e=>e.stopPropagation()} style={{backgroundColor:"#FFFFFF",borderRadius:20,padding:"24px 22px",width:"100%",maxWidth:340,boxShadow:"0 8px 40px rgba(0,0,0,0.2)"}}>
        <p style={{margin:"0 0 6px",fontSize:16,fontWeight:900,color:"#0F1F5C"}}>{title}</p>
        {desc&&<p style={{margin:"0 0 20px",fontSize:13.5,color:"#6B7280",lineHeight:1.6}}>{desc}</p>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,padding:"12px 0",borderRadius:12,border:"1.5px solid #E5E8EB",backgroundColor:"#FFFFFF",color:"#374151",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
          <button onClick={onOk} style={{flex:1,padding:"12px 0",borderRadius:12,border:"none",backgroundColor:"#F04452",color:"#FFFFFF",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
        </div>
      </div>
    </div>
  );
};
// ───────────────────────── 기여도 · 개인 주간목표 (실제 기록 집계 · 랭킹 아님) ─────────────────────────
const matchUid=(D,id,name)=>{ if(id&&(D.users||[]).find(u=>u.id===id))return id; if(name){const u=(D.users||[]).find(u=>u.name===name);if(u)return u.id;} return null; };
const inWeek=(at,wk)=>at&&weekKey(new Date(at))===wk;
// 프로젝트 기여도 — 담당자별 {task,sales,act,total, wk:이번주합} (협업 가시화)
const projContrib=(D,proj)=>{
  const wk=weekKey(); const map={};
  const bump=(uid,k,at)=>{ if(!uid)return; const m=map[uid]||(map[uid]={task:0,sales:0,act:0,total:0,wk:0}); m[k]++; m.total++; if(inWeek(at,wk))m.wk++; };
  (D.tasks||[]).filter(t=>t.projectId===proj.id&&!t.isFixed&&t.status==="done").forEach(t=>bump(matchUid(D,t.doneBy,t.doneByName)||t.assigneeId,"task",t.doneAt));
  (proj.salesHistory||[]).forEach(h=>bump(matchUid(D,h.by,h.byName),"sales",h.at));
  (proj.activityKPIs||[]).forEach(ak=>(ak.history||[]).forEach(h=>bump(matchUid(D,h.by,h.byName),"act",h.at)));
  return Object.entries(map).map(([uid,m])=>({uid,...m})).sort((a,b)=>b.total-a.total);
};
// 이번 주 내 주간목표 (weekGoals: [{id,userId,week,title,target,current,unit,projectId}])
const myWeekGoals=(D,uid)=>{ const wk=weekKey(); return (D.weekGoals||[]).filter(g=>g.userId===uid&&g.week===wk); };
const wgAchieved=(g)=> numF(g.target)>0 && numF(g.current)>=numF(g.target);
// 첨부 파일 표시 헬퍼
const extOf=(name="")=>{const m=String(name).match(/\.([a-z0-9]+)$/i);return m?m[1].toUpperCase():"파일";};
const isImgAtt=(att)=>((att?.type||"").startsWith("image/"))||/\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i.test(att?.name||att?.url||"");
const fileIcon=(name="")=>{const e=extOf(name).toLowerCase();if(["pdf"].includes(e))return"📕";if(["doc","docx","hwp","hwpx","txt"].includes(e))return"📝";if(["xls","xlsx","csv"].includes(e))return"📊";if(["ppt","pptx"].includes(e))return"📺";if(["zip","rar","7z"].includes(e))return"🗜️";return"📄";};
// 전체 상태 백업(JSON) 다운로드 — 오프디바이스 2차 보관용
const downloadStateBackup=(D)=>{
  const shared=pickShared(D);
  const blob=new Blob([JSON.stringify({_app:"pour-os",_backupAt:new Date().toISOString(),...shared},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`pour-os-backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;a.click();URL.revokeObjectURL(url);
};
// CSV 다운로드 공용 (BOM + 안전 이스케이프)
const downloadCSV=(rows,name)=>{
  const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download=`${name}_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
};
const EditTaskSheet=({open,onClose,task,onSave,D})=>{
  const [form,setForm]=useState({title:"",status:"todo",dueDate:"",memo:"",projectId:"",attachments:[]});
  const [prevId,setPrevId]=useState(null);
  const [uploading,setUploading]=useState(false);
  if(task&&task.id!==prevId){setPrevId(task.id);setForm({title:task.title||"",status:task.status||"todo",dueDate:task.dueDate||"",memo:task.memo||"",projectId:task.projectId||"",attachments:Array.isArray(task.attachments)?task.attachments:[]});}
  if(!task&&prevId!==null){setPrevId(null);setForm({title:"",status:"todo",dueDate:"",memo:"",projectId:"",attachments:[]});}
  const onPick=async(files)=>{
    const list=Array.from(files||[]);
    if(!list.length||!task)return;
    setUploading(true);
    try{ const added=[]; for(const f of list){ if(f.size>20*1024*1024){alert(`${f.name}: 20MB 초과`);continue;} added.push(await uploadTaskPhoto(task.id,f)); }
      setForm(p=>({...p,attachments:[...(p.attachments||[]),...added]})); }
    catch(e){ alert("업로드 실패: "+e.message); }
    setUploading(false);
  };
  const rmPhoto=async(att)=>{ if(att.path)await deleteTaskPhoto(att.path); setForm(p=>({...p,attachments:(p.attachments||[]).filter(a=>a.url!==att.url)})); };
  return(
    <Sheet open={open} onClose={onClose} title="업무 수정" h="78vh">
      <div style={{marginTop:12}}>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>업무명 *</label>
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>상태</label>
          <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>
            {Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>프로젝트 연결</label>
          <div style={{position:"relative"}}>
            <select value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} style={{width:"100%",padding:"12px 36px 12px 12px",borderRadius:12,fontSize:13,border:form.projectId?"1.5px solid #F97316":"1.5px solid #E5E8EB",outline:"none",backgroundColor:form.projectId?"#FFEDD5":"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none",color:form.projectId?"#0F1F5C":"#9CA3AF"}}>
              <option value="">프로젝트 없음</option>
              {D&&D.projects.map(p=><option key={p.id} value={p.id}>{p.group?`[${p.group}] `:""}{p.title}</option>)}
            </select>
            <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:11,color:form.projectId?"#F97316":"#9CA3AF"}}>▼</span>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>마감일</label>
          <input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메모</label>
          <textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="메모..." style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"vertical",minHeight:72,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,fontWeight:700,color:"#374151",marginBottom:7}}><span>📎 파일 첨부 ({(form.attachments||[]).length})</span>{uploading&&<span style={{fontSize:11,color:"#F97316",fontWeight:700}}>업로드 중…</span>}</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(form.attachments||[]).map((att,i)=>{const img=isImgAtt(att);return(
              <div key={att.url||i} style={{position:"relative",width:72,height:72,borderRadius:10,overflow:"hidden",border:"1px solid #E5E8EB",background:img?"#000":"#F9FAFB"}}>
                <a href={att.url} target="_blank" rel="noopener noreferrer" title={att.name} style={{display:"block",width:"100%",height:"100%",textDecoration:"none"}}>
                  {img?<img src={att.url} alt={att.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:
                    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:4,boxSizing:"border-box"}}>
                      <span style={{fontSize:22}}>{fileIcon(att.name)}</span>
                      <span style={{fontSize:8.5,fontWeight:800,color:"#6B7280",marginTop:2}}>{extOf(att.name)}</span>
                      <span style={{fontSize:7.5,color:"#9CA3AF",marginTop:1,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
                    </div>}
                </a>
                <button onClick={()=>rmPhoto(att)} style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:12,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
              </div>
            );})}
            <label style={{width:72,height:72,borderRadius:10,border:"1.5px dashed #D1D5DB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:task?"pointer":"not-allowed",color:"#9CA3AF",opacity:task?1:0.5}}>
              <span style={{fontSize:22}}>＋</span><span style={{fontSize:9,fontWeight:700}}>파일</span>
              <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.txt,.csv,.zip" multiple disabled={!task||uploading} onChange={e=>onPick(e.target.files)} style={{display:"none"}}/>
            </label>
          </div>
          <p style={{margin:"6px 2px 0",fontSize:10,color:"#9CA3AF"}}>사진·PDF·문서(워드/엑셀/한글 등) · 각 20MB 이내 · 저장하면 task에 기록됩니다</p>
        </div>
        <button onClick={()=>{if(form.title.trim()){onSave(form);onClose();}}} disabled={!form.title.trim()||uploading} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:form.title.trim()&&!uploading?"#F97316":"#E5E8EB",color:form.title.trim()&&!uploading?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:form.title.trim()&&!uploading?"pointer":"not-allowed",fontFamily:"inherit"}}>저장하기</button>
      </div>
    </Sheet>
  );
};
const TABS=[{id:"today",icon:"🏠",label:"오늘"},{id:"kpi",icon:"◎",label:"KPI"},{id:"projects",icon:"▦",label:"프로젝트"},{id:"calendar",icon:"▤",label:"캘린더"},{id:"more",icon:"⋯",label:"더보기"}];
const MORE=[{id:"game",icon:"🎯",label:"내 주간"},{id:"mindmap",icon:"◈",label:"업무 보드"},{id:"fixed",icon:"📌",label:"고정업무"},{id:"retro",icon:"◷",label:"목표·회고"},{id:"ai",icon:"✦",label:"AI 코치"}];
// 메뉴 그룹: 개인(나만 보는 내 것) vs 팀(모두 같이 보는 공유) — 출시는 프로젝트 하위 탭
const NAV_GROUPS=[
  {label:"개인 · 나만", ids:["today","game","fixed","retro"]},
  {label:"팀 · 공유",  ids:["kpi","projects","mindmap","calendar","ai"]},
];
export default function App(){
  const [D,setD]=useState(INIT);
  const [page,setPage]=useState("today");
  const [more,setMore]=useState(false);
  const [uSheet,setUSheet]=useState(false);
  const [editUser,setEditUser]=useState(null);   // 담당자 수정 {id,name,dept,color}
  // 화면 모드 (PC / 모바일) — 기본은 화면폭 자동, 토글로 전환, localStorage 기억
  const [viewMode,setViewMode]=useState(()=>localStorage.getItem("pour-os-view")||((typeof window!=="undefined"&&window.innerWidth>=1024)?"pc":"mobile"));
  useEffect(()=>{ localStorage.setItem("pour-os-view",viewMode); },[viewMode]);
  // ── Firestore 분할 문서 영속화 v2 (컬렉션별 pour-os/state-<key>, 4명 실시간 공유) ──
  const [loaded,setLoaded]=useState(false);
  const [syncToast,setSyncToast]=useState(false);   // 다른 기기 변경 안내
  const [saveErr,setSaveErr]=useState(null);        // {level:'warn'|'error', msg, bytes} | null — 저장 상태 가시화
  const lastColJsonRef=useRef({});    // {컬렉션:JSON} 마지막 동기화본 (에코·변경 판별)
  const loadedRef=useRef(false);
  const syncTimerRef=useRef(null);
  const pendingSharedRef=useRef(null);// 디바운스 대기 중인 최신 shared 객체 (탭 종료 flush용)
  // 마이그레이션(레거시 단일문서 → 분할) + 컬렉션별 구독
  useEffect(()=>{
    const savedUser=localStorage.getItem(LOCAL_USER_KEY);
    if(savedUser) setD(p=>({...p,currentUser:savedUser}));
    let cancelled=false; let unsubs=[];
    (async()=>{
      // 1) v2 분할 마이그레이션 (멱등 — 메타문서 v:2 로 1회만)
      try{
        const meta=await getDoc(META_DOC);
        if(!meta.exists()||meta.data().v!==2){
          const legacy=await getDoc(STATE_DOC);
          const src=legacy.exists()?pickShared(legacy.data()):pickShared(INIT);
          await Promise.all(SHARED_KEYS.map(k=>setDoc(colDoc(k),{items:Array.isArray(src[k])?src[k]:[],_updatedAt:Date.now()})));
          await setDoc(META_DOC,{v:2,migratedAt:Date.now()});
          console.log("[pour-os] v2 분할 마이그레이션 완료(레거시 보존)");
        }
      }catch(e){ console.error("[pour-os] 마이그레이션 실패(구독은 계속):",e); }
      if(cancelled) return;
      // 2) 컬렉션별 실시간 구독
      const firstPending=new Set(SHARED_KEYS);
      const markFirst=(k)=>{ if(firstPending.size){ firstPending.delete(k); if(firstPending.size===0){ loadedRef.current=true; setLoaded(true); console.log("[pour-os] v2 로드 완료"); } } };
      unsubs=SHARED_KEYS.map(k=>onSnapshot(colDoc(k),(snap)=>{
        if(snap.metadata.hasPendingWrites) return;        // 내 쓰기 에코 무시
        const items=snap.exists()&&Array.isArray(snap.data().items)?snap.data().items:[];
        const js=JSON.stringify(items);
        const remoteChange=loadedRef.current&&js!==lastColJsonRef.current[k];
        lastColJsonRef.current[k]=js;
        setD(p=>({...p,[k]:items}));                       // currentUser·UI 상태 보존
        if(remoteChange){ setSyncToast(true); clearTimeout(syncTimerRef.current); syncTimerRef.current=setTimeout(()=>setSyncToast(false),2600); }
        markFirst(k);
      },(err)=>{ console.error(`[pour-os] ${k} 구독 실패:`,err); markFirst(k); }));
    })();
    return ()=>{ cancelled=true; unsubs.forEach(u=>{try{u&&u();}catch(_){}}); };
  },[]);
  // currentUser는 기기별 로컬에만 저장
  useEffect(()=>{ if(D.currentUser) localStorage.setItem(LOCAL_USER_KEY,D.currentUser); },[D.currentUser]);
  // 최초 로드 후 1회: 업무 기준 자동 진척으로 정합화(수동지정 제외, 업무 없으면 유지)
  const progReconciledRef=useRef(false);
  useEffect(()=>{
    if(!loaded||progReconciledRef.current) return;
    progReconciledRef.current=true;
    setD(p=>recalcProg(p));
  },[loaded]);
  // 어드민(상위 프레임)에 임베드된 경우: 활동 담당자 수신 → currentUser 자동 선택
  useEffect(()=>{
    const onMsg=(e)=>{
      const m=e.data;
      if(!m||m.type!=="admin-staff-active") return;
      const as=m.payload&&m.payload.activeStaff;
      if(!as) return;
      setD(p=>{
        const match=p.users.find(u=>u.id===as.kpiMemberId)||p.users.find(u=>u.name===as.name);
        return (match&&match.id!==p.currentUser)?{...p,currentUser:match.id}:p;
      });
    };
    window.addEventListener("message",onMsg);
    // 부모(어드민)에 준비 완료 신호 → 어드민이 활동 담당자를 즉시 재전송
    try{ if(window.parent&&window.parent!==window) window.parent.postMessage({type:"pour-os-ready"},"*"); }catch(_){}
    return ()=>window.removeEventListener("message",onMsg);
  },[]);
  // 변경 시 디바운스 저장 — 바뀐 컬렉션 문서만 저장(diff). 다른 컬렉션 동시편집 충돌 제거.
  useEffect(()=>{
    if(!loaded) return;
    const shared=pickShared(D);
    pendingSharedRef.current=shared;                       // 탭 종료 flush 대비
    const t=setTimeout(async()=>{
      // ① 2차 안전: 전체 상태를 이 기기에 거울 저장 (원격 실패해도 데이터 생존)
      try{ localStorage.setItem(MIRROR_KEY,JSON.stringify(shared)); localStorage.setItem(MIRROR_AT_KEY,new Date().toISOString()); }catch(_){}
      // ② 변경된 컬렉션만 추출
      const changed=[];
      for(const k of SHARED_KEYS){ const js=JSON.stringify(shared[k]||[]); if(js!==lastColJsonRef.current[k]) changed.push([k,shared[k]||[],js]); }
      if(!changed.length) return;
      // ③ 컬렉션별 1MiB 한도 가드 (초과 컬렉션이 있으면 그 컬렉션만 차단·경고)
      for(const [k,,js] of changed){ const b=new Blob([js]).size; if(b>DOC_LIMIT){ setSaveErr({level:"error",msg:`'${COL_LABEL[k]||k}' 데이터(${(b/1024).toFixed(0)}KB)가 한도(1024KB)를 넘어 저장이 막혔습니다. 백업 후 정리 필요(이 기기엔 보관됨).`,bytes:b}); return; } }
      // ④ 변경 컬렉션 동시 저장 — 성공해야 동기화본 갱신(실패 시 다음 변경 때 자동 재시도)
      try{
        await Promise.all(changed.map(([k,arr])=>setDoc(colDoc(k),{items:arr,_updatedAt:Date.now()})));
        for(const [k,,js] of changed) lastColJsonRef.current[k]=js;
        pendingSharedRef.current=null;
        let maxB=0; for(const k of SHARED_KEYS){ const b=new Blob([JSON.stringify(shared[k]||[])]).size; if(b>maxB)maxB=b; }
        setSaveErr(maxB>DOC_LIMIT*0.85?{level:"warn",msg:`일부 데이터가 한도의 ${Math.round(maxB/DOC_LIMIT*100)}%입니다 — 백업·정리 권장.`,bytes:maxB}:null);
      }catch(e){ console.error("[pour-os] 저장 실패:",e);
        setSaveErr({level:"error",msg:`저장 실패(${e.code||e.message}). 변경분은 이 기기에 임시 보관됨 — 새로고침 전에 '전체 백업(JSON)'으로 내려받으세요.`}); }
    },700);
    return ()=>clearTimeout(t);
  },[D,loaded]);
  // 탭 종료/숨김 시: 대기 중이던 변경을 즉시 거울 저장 + 베스트에포트 원격 저장(바뀐 컬렉션만)
  useEffect(()=>{
    const flush=()=>{ const shared=pendingSharedRef.current; if(!shared) return;
      try{ localStorage.setItem(MIRROR_KEY,JSON.stringify(shared)); localStorage.setItem(MIRROR_AT_KEY,new Date().toISOString()); }catch(_){}
      for(const k of SHARED_KEYS){ const js=JSON.stringify(shared[k]||[]); if(js!==lastColJsonRef.current[k]&&new Blob([js]).size<=DOC_LIMIT){ try{ setDoc(colDoc(k),{items:shared[k]||[],_updatedAt:Date.now()}); }catch(_){} } } };
    window.addEventListener("beforeunload",flush);
    const onVis=()=>{ if(document.visibilityState==="hidden") flush(); };
    window.addEventListener("visibilitychange",onVis);
    return ()=>{ window.removeEventListener("beforeunload",flush); window.removeEventListener("visibilitychange",onVis); };
  },[]);
  const cu=D.users.find(u=>u.id===D.currentUser)||D.users[0];   // 잘못된 currentUser여도 크래시 방지
  const lead=cu?.role==="lead";
  const set=(k,v)=>setD(p=>({...p,[k]:v}));
  // 업무 변동 시 프로젝트 진척 자동 재산출(수동지정 progressManual 제외, 업무 없으면 기존값 유지)
  const recalcProg=(state)=>{
    const tasks=state.tasks||[];
    let changed=false;
    const projects=(state.projects||[]).map(pr=>{
      if(pr.progressManual) return pr;
      const real=tasks.filter(t=>t.projectId===pr.id&&!t.isFixed);
      if(real.length===0) return pr;
      const auto=Math.round(real.filter(t=>t.status==="done").length/real.length*100);
      if(auto===(pr.progress||0)) return pr;
      changed=true; return {...pr,progress:auto};
    });
    return changed?{...state,projects}:state;
  };
  const add=(k,item)=>setD(p=>{const n={...p,[k]:[...p[k],item]};return k==="tasks"?recalcProg(n):n;});
  const up=(k,id,c)=>setD(p=>{
    // 업무 완료 전환 시 완료시각·완료자 기록(주간 활동로그용)
    const list=p[k].map(i=>{ if(i.id!==id) return i; let patch=c; if(k==="tasks"&&c.status&&c.status!==i.status&&c.status==="done") patch={...c,doneAt:new Date().toISOString(),doneBy:cu?.id||null,doneByName:cu?.name||""}; return {...i,...patch}; });
    const n={...p,[k]:list};
    return k==="tasks"?recalcProg(n):n;
  });
  const rm=(k,id)=>setD(p=>{const n={...p,[k]:p[k].filter(i=>i.id!==id)};return k==="tasks"?recalcProg(n):n;});
  const nav=(id)=>{setPage(id);setMore(false);};
  const allPages=[...TABS.filter(t=>t.id!=="more"),...MORE];
  const pi=allPages.find(p=>p.id===page);
  if(!loaded) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:14,fontFamily:"'Pretendard',sans-serif",color:"#9CA3AF"}}>
      <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:900}}>P</div>
      <p style={{margin:0,fontSize:13,fontWeight:700}}>데이터 불러오는 중…</p>
    </div>
  );
  const navAll=[...TABS.filter(t=>t.id!=="more"),...MORE];
  const pageContent=(<>
    {page==="today"&&<TodayPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="kpi"&&<KPIPage D={D} lead={lead} up={up} cu={cu} add={add} rm={rm} pc={viewMode==="pc"}/>}
    {page==="projects"&&<ProjectsPage D={D} cu={cu} up={up} add={add} rm={rm} pc={viewMode==="pc"} lead={lead} nav={nav}/>}
    {page==="calendar"&&<CalendarPage D={D} cu={cu} add={add} up={up} rm={rm}/>}
    {page==="game"&&<GamePage D={D} cu={cu} up={up} add={add} rm={rm} nav={nav}/>}
    {page==="launch"&&<LaunchPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="mindmap"&&<MindMapPage D={D} cu={cu}/>}
    {page==="fixed"&&<FixedPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="retro"&&<RetroPage D={D} cu={cu} add={add} up={up} rm={rm}/>}
    {page==="ai"&&<AIPage D={D} cu={cu} add={add} rm={rm}/>}
  </>);
  const sheets=(<>
    {syncToast&&<div style={{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",zIndex:5000,background:"#0F1F5C",color:"#fff",padding:"8px 16px",borderRadius:999,fontSize:12,fontWeight:700,boxShadow:"0 6px 20px rgba(0,0,0,0.25)",whiteSpace:"nowrap",pointerEvents:"none"}}>🔄 다른 기기에서 업데이트됨</div>}
    {saveErr&&<div style={{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 8px)",left:8,right:8,zIndex:5001,background:saveErr.level==="error"?"#FEF2F2":"#FFFBEB",border:`1.5px solid ${saveErr.level==="error"?"#FCA5A5":"#FCD34D"}`,color:saveErr.level==="error"?"#991B1B":"#92400E",padding:"10px 12px",borderRadius:12,fontSize:11.5,fontWeight:700,lineHeight:1.45,boxShadow:"0 6px 20px rgba(0,0,0,0.15)",display:"flex",alignItems:"flex-start",gap:8}}>
      <span style={{flexShrink:0,fontSize:14}}>{saveErr.level==="error"?"⚠️":"📊"}</span>
      <span style={{flex:1}}>{saveErr.msg}</span>
      <button onClick={()=>downloadStateBackup(D)} style={{flexShrink:0,padding:"5px 8px",borderRadius:8,border:"none",background:saveErr.level==="error"?"#DC2626":"#D97706",color:"#fff",fontSize:10.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>백업</button>
      {saveErr.level!=="error"&&<button onClick={()=>setSaveErr(null)} style={{flexShrink:0,padding:"5px 7px",borderRadius:8,border:"none",background:"transparent",color:"inherit",fontSize:13,fontWeight:800,cursor:"pointer"}}>×</button>}
    </div>}
    <Sheet open={more} onClose={()=>setMore(false)} title="더보기">
      {[{label:"개인 · 나만",ids:["game","fixed","retro"]},{label:"팀 · 공유",ids:["mindmap","ai"]}].map(grp=>(
        <div key={grp.label} style={{marginTop:14}}>
          <p style={{margin:"0 2px 8px",fontSize:11,fontWeight:800,color:"#9CA3AF",letterSpacing:0.5}}>{grp.label}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {grp.ids.map(id=>{const m=MORE.find(x=>x.id===id);if(!m)return null;return(
              <button key={m.id} onClick={()=>nav(m.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"20px 12px",borderRadius:14,backgroundColor:"#F9FAFB",border:"1px solid #E5E8EB",cursor:"pointer"}}>
                <span style={{fontSize:28}}>{m.icon}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#1F2937"}}>{m.label}</span>
              </button>
            );})}
          </div>
        </div>
      ))}
    </Sheet>
    <Sheet open={uSheet} onClose={()=>setUSheet(false)} title="담당자 전환">
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
        {D.users.map(u=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:14,backgroundColor:D.currentUser===u.id?"#FFEDD5":"#F9FAFB",border:`1.5px solid ${D.currentUser===u.id?"#F97316":"#E5E8EB"}`}}>
            <button onClick={()=>{set("currentUser",u.id);setUSheet(false);}} style={{flex:1,display:"flex",alignItems:"center",gap:12,background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"6px 0",fontFamily:"inherit"}}>
              <Ava name={u.name} color={u.color} size={40}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:800,color:"#111827"}}>{u.name}</p>
                <p style={{margin:0,fontSize:12,color:"#9CA3AF"}}>{u.role==="lead"?"리드":"팀원"}</p>
              </div>
              {D.currentUser===u.id&&<span style={{marginLeft:8,fontSize:16,color:"#F97316"}}>✓</span>}
            </button>
            <button onClick={()=>setEditUser({id:u.id,name:u.name||"",color:u.color||"#3182F6"})} title="이름·색상 수정" style={{flexShrink:0,width:38,height:38,borderRadius:10,border:"1px solid #E5E8EB",background:"#fff",cursor:"pointer",fontSize:15,color:"#6B7280"}}>✎</button>
          </div>
        ))}
      </div>
    </Sheet>
    <Sheet open={!!editUser} onClose={()=>setEditUser(null)} title="✎ 담당자 수정">
      {editUser&&(<div style={{marginTop:8}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>이름</label>
        <input value={editUser.name} onChange={e=>setEditUser({...editUser,name:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"&&editUser.name.trim()){up("users",editUser.id,{name:editUser.name.trim(),color:editUser.color});setEditUser(null);}}} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>색상</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{["#3182F6","#8B5CF6","#00C073","#F97316","#F04452","#0891B2","#EAB308","#EC4899"].map(c=>(<button key={c} onClick={()=>setEditUser({...editUser,color:c})} style={{width:34,height:34,borderRadius:"50%",background:c,border:editUser.color===c?"3px solid #0F1F5C":"2px solid #fff",boxShadow:"0 0 0 1px #E5E8EB",cursor:"pointer"}}/>))}</div>
        <Btn full variant="orange" onClick={()=>{up("users",editUser.id,{name:editUser.name.trim()||"이름",color:editUser.color});setEditUser(null);}} disabled={!editUser.name.trim()}>저장</Btn>
      </div>)}
    </Sheet>
  </>);
  const viewToggle=(
    <div style={{display:"inline-flex",borderRadius:8,border:"1px solid #E5E8EB",overflow:"hidden",flexShrink:0}}>
      {[["mobile","📱"],["pc","🖥"]].map(([m,ic])=>(
        <button key={m} onClick={()=>setViewMode(m)} title={m==="pc"?"PC 화면":"모바일 화면"} style={{padding:"3px 9px",fontSize:13,lineHeight:1,border:"none",cursor:"pointer",backgroundColor:viewMode===m?"#F97316":"#fff",color:viewMode===m?"#fff":"#9CA3AF"}}>{ic}</button>
      ))}
    </div>
  );
  // ── PC 레이아웃 (좌측 사이드바 + 넓은 본문) ──
  if(viewMode==="pc") return(
    <div style={{display:"flex",height:"100vh",backgroundColor:"#F9FAFB",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",overflow:"hidden",width:"100%"}}>
      <aside style={{width:216,backgroundColor:"#FFFFFF",borderRight:"1px solid #F2F4F6",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 16px 13px",display:"flex",alignItems:"center",gap:9,borderBottom:"1px solid #F4F4F5"}}>
          <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:900}}>P</div>
          <div><p style={{margin:0,fontSize:14.5,fontWeight:900,color:"#0F1F5C",lineHeight:1.1}}>POUR OS</p><p style={{margin:0,fontSize:9.5,color:"#F97316",fontWeight:800}}>업무관리</p></div>
        </div>
        <nav style={{flex:1,overflowY:"auto",padding:8}}>
          {NAV_GROUPS.map(grp=>(
            <div key={grp.label} style={{marginBottom:8}}>
              <p style={{margin:"6px 12px 4px",fontSize:10,fontWeight:800,color:"#B0B8C1",letterSpacing:0.6}}>{grp.label}</p>
              {grp.ids.map(id=>{const it=navAll.find(x=>x.id===id);if(!it)return null;const act=page===id;return(
                <button key={id} onClick={()=>nav(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:act?"#FFF1E7":"transparent",color:act?"#EA580C":"#4B5563",fontWeight:act?800:600,fontSize:13,marginBottom:2,textAlign:"left",fontFamily:"inherit"}}>
                  <span style={{fontSize:16,width:20,textAlign:"center"}}>{it.icon}</span>{it.label}
                </button>
              );})}
            </div>
          ))}
        </nav>
        <div style={{padding:"10px 12px",borderTop:"1px solid #F4F4F5",display:"flex",flexDirection:"column",gap:9}}>
          <button onClick={()=>setUSheet(true)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",cursor:"pointer",fontFamily:"inherit"}}>
            <Ava name={cu?.name} color={cu?.color} size={28}/>
            <div style={{textAlign:"left",overflow:"hidden"}}><p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#111827",whiteSpace:"nowrap"}}>{cu?.name}</p><p style={{margin:0,fontSize:10,color:"#9CA3AF",whiteSpace:"nowrap"}}>{cu?.role==="lead"?"리드":"팀원"}</p></div>
          </button>
          {viewToggle}
        </div>
      </aside>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <div style={{backgroundColor:"#FFFFFF",borderBottom:"1px solid #F2F4F6",padding:"13px 24px",flexShrink:0}}>
          <h1 style={{margin:0,fontSize:17,fontWeight:900,color:"#0F1F5C",lineHeight:1.1}}>{pi?.icon} {pi?.label}</h1>
          <p style={{margin:"3px 0 0",fontSize:11,color:"#9CA3AF"}}>{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} · {cu?.name}</p>
        </div>
        <div style={{flex:1,overflowY:"auto"}}><div style={{width:"100%"}}>{pageContent}</div></div>
      </div>
      {sheets}
    </div>
  );
  // ── 모바일 레이아웃 (하단 탭) ──
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",backgroundColor:"#F9FAFB",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",overflow:"hidden",maxWidth:480,margin:"0 auto"}}>
      <div style={{backgroundColor:"#FFFFFF",borderBottom:"1px solid #F2F4F6",padding:"12px 18px 10px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"white",fontWeight:900,letterSpacing:-1}}>P</div>
            <div>
              <h1 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C",lineHeight:1}}>{pi?.icon} {pi?.label}</h1>
              <p style={{margin:0,fontSize:10,color:"#F97316",fontWeight:700}}>POUR스토어</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {viewToggle}
            <button onClick={()=>setUSheet(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Ava name={cu?.name} color={cu?.color} size={30}/></button>
          </div>
        </div>
        <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF",paddingLeft:36}}>{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} · {cu?.name}</p>
      </div>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>{pageContent}</div>
      <div style={{backgroundColor:"#FFFFFF",borderTop:"1px solid #F2F4F6",display:"flex",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {TABS.map(t=>{const act=t.id==="more"?more:page===t.id;return(
          <button key={t.id} onClick={()=>t.id==="more"?setMore(!more):nav(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"9px 4px 7px",background:"none",border:"none",cursor:"pointer",gap:2}}>
            <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:act?800:500,color:act?"#F97316":"#9CA3AF"}}>{t.label}</span>
            {act&&<div style={{width:16,height:2,borderRadius:1,backgroundColor:"#F97316",marginTop:1}}/>}
          </button>
        );})}
      </div>
      {sheets}
    </div>
  );
}
// 이번 주 마감 입력 — 매출·KPI 주차실적·목표지표를 한 화면에서 (입력 분산 해소)
function WeeklyInputSheet({open,onClose,D,cu,up}){
  const [tab,setTab]=useState("sales");
  if(!open) return null;
  const at=()=>new Date().toISOString();
  // 매출(메인2) — setSale과 동일 shape
  const wkSale=(p,raw)=>{const v=raw===""?0:(Number(raw)||0);if(!isFinite(v))return;const prev=numF(p.resultValue);if(v===prev)return;const t=at();const entry={week:weekKey(),value:v,prev,delta:v-prev,by:cu?.id||null,byName:cu?.name||"",at:t};up("projects",p.id,{resultValue:v,salesBy:cu?.id||null,salesByName:cu?.name||"",salesAt:t,salesHistory:[...(p.salesHistory||[]),entry]});};
  // KPI 주차실적(추가값) — applyVal과 동일 shape
  const wkVal=(coll,item,amt)=>{const a=Number(amt)||0;if(a===0)return;const prev=numF(item.currentValue);const value=prev+a;if(!isFinite(value))return;const t=at();const entry={week:weekKey(),mode:"delta",amount:a,value,prev,by:cu?.id||null,byName:cu?.name||"",at:t};up(coll,item.id,{currentValue:value,manualOverride:true,valueBy:cu?.id||null,valueByName:cu?.name||"",valueAt:t,valueHistory:[...(item.valueHistory||[]),entry]});};
  // 목표지표(추가값) — actRecord와 동일 shape
  const wkAct=(p,ak,amt)=>{const a=Number(amt);if(isNaN(a)||a===0)return;const prev=numF(ak.current);const v=prev+a;const t=at();const week=weekKey();const list=(p.activityKPIs||[]).map(x=>x.id===ak.id?{...x,current:v,week,by:cu?.id||null,byName:cu?.name||"",history:[...(x.history||[]),{week,value:v,amount:a,mode:"delta",by:cu?.id||null,byName:cu?.name||"",at:t}]}:x);up("projects",p.id,{activityKPIs:list});};
  const salesProjs=D.projects.filter(p=>p.mainKPIId==="mk2");
  const salesChannels=D.subKPIs.filter(s=>s.mainKPIId!=="mk2"&&s.unit==="원"); // 직판 채널 매출(메인1)
  const kpiItems=D.subKPIs.filter(s=>s.mainKPIId!=="mk2"&&s.unit!=="원");      // 운영지표(건·%·모듈)
  const actProjs=D.projects.filter(p=>(p.activityKPIs||[]).length>0);
  const NumAdd=({onAdd,ph})=>{const[v,setV]=useState("");return(<div style={{display:"flex",gap:6}}><input type="number" inputMode="numeric" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&v!==""){onAdd(v);setV("");}}} placeholder={ph||"이번 주 추가값"} style={{flex:1,minWidth:0,padding:"8px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:13,fontWeight:700,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/><button onClick={()=>{if(v!==""){onAdd(v);setV("");}}} disabled={v===""} style={{flexShrink:0,padding:"0 14px",borderRadius:9,border:"none",background:v===""?"#E5E8EB":"#8B5CF6",color:"#fff",fontSize:13,fontWeight:800,cursor:v===""?"default":"pointer",fontFamily:"inherit"}}>추가</button></div>);};
  const MoneyAdd=({onAdd})=>{const[v,setV]=useState("");const[u,setU]=useState("만");const M={"원":1,"만":10000,"억":100000000};const tot=Math.round((Number(v)||0)*M[u]);return(<div><div style={{display:"flex",gap:6}}><input type="number" inputMode="decimal" value={v} onChange={e=>setV(e.target.value)} placeholder="이번 주 매출 추가" style={{flex:1,minWidth:0,padding:"8px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:13,fontWeight:800,textAlign:"right",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/><div style={{display:"inline-flex",borderRadius:9,border:"1.5px solid #E5E8EB",overflow:"hidden",flexShrink:0}}>{["원","만","억"].map(x=>(<button key={x} onClick={()=>setU(x)} style={{padding:"0 9px",fontSize:12,fontWeight:800,border:"none",cursor:"pointer",background:u===x?"#F97316":"#fff",color:u===x?"#fff":"#9CA3AF",fontFamily:"inherit"}}>{x}</button>))}</div><button onClick={()=>{if(tot>0){onAdd(tot);setV("");}}} disabled={tot<=0} style={{flexShrink:0,padding:"0 12px",borderRadius:9,border:"none",background:tot<=0?"#E5E8EB":"#8B5CF6",color:"#fff",fontSize:13,fontWeight:800,cursor:tot<=0?"default":"pointer",fontFamily:"inherit"}}>추가</button></div>{tot>0&&<p style={{margin:"4px 0 0",fontSize:10.5,fontWeight:800,color:"#EA580C"}}>= {fmtKorWon(tot)}</p>}</div>);};
  const subHd={margin:"4px 2px 8px",fontSize:11,fontWeight:900,color:"#9CA3AF",letterSpacing:"-0.2px"};
  const TABS_W=[["sales","💰 매출",salesProjs.length+salesChannels.length],["kpi","📊 운영지표",kpiItems.length],["act","🎯 목표지표",actProjs.reduce((a,p)=>a+(p.activityKPIs||[]).length,0)]];
  return(
    <Sheet open={open} onClose={onClose} title="🗓️ 이번 주 마감 입력" h="90vh">
      <div style={{marginTop:4}}>
        <p style={{margin:"0 0 12px",fontSize:11.5,color:"#9CA3AF",lineHeight:1.5}}>{weekLabel(weekKey())} · 한 화면에서 이번 주 실적을 모두 넣어요. 입력하면 KPI·목표에 자동 반영됩니다.</p>
        <div style={{display:"flex",background:"#F2F4F6",borderRadius:12,padding:4,marginBottom:14}}>
          {TABS_W.map(([k,l,n])=>(<button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 2px",borderRadius:9,border:"none",cursor:"pointer",background:tab===k?"#fff":"transparent",color:tab===k?"#0F1F5C":"#9CA3AF",fontWeight:tab===k?800:600,fontSize:12,fontFamily:"inherit",boxShadow:tab===k?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{l}<span style={{fontSize:10,opacity:0.6,marginLeft:3}}>{n}</span></button>))}
        </div>
        {tab==="sales"&&((salesProjs.length+salesChannels.length)===0?<Empty t="매출 항목이 없어요"/>:<>
          {salesProjs.length>0&&<p style={subHd}>거래처유형별 (B2B)</p>}
          {salesProjs.map(p=>{const dt=DT[p.dealerType];return(
            <div key={p.id} style={{padding:"10px 0",borderBottom:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>{dt&&<span style={{fontSize:9.5,fontWeight:800,color:dt.color,backgroundColor:dt.color+"18",borderRadius:6,padding:"2px 6px",flexShrink:0,fontFamily:"'IBM Plex Mono',monospace"}}>{p.dealerType}</span>}<span style={{fontSize:12.5,fontWeight:700,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span><span style={{fontSize:11,fontWeight:800,color:"#EA580C",flexShrink:0}}>{fmt(numF(p.resultValue),"원")}</span></div>
              <MoneyInput value={p.resultValue} compact onCommit={n=>wkSale(p,n)}/>
            </div>
          );})}
          {salesChannels.length>0&&<p style={{...subHd,marginTop:14}}>직판 채널 (자사몰·마켓·쇼룸)</p>}
          {salesChannels.map(sk=>(
            <div key={sk.id} style={{padding:"10px 0",borderBottom:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:11,fontWeight:800,color:"#1F2937"}}>{sk.channelCode?sk.channelCode+" · ":""}{sk.title}</span><span style={{marginLeft:"auto",fontSize:11,fontWeight:800,color:"#EA580C"}}>{fmt(numF(sk.currentValue),"원")} / {fmt(numF(sk.targetValue),"원")}</span></div>
              <MoneyAdd onAdd={n=>wkVal("subKPIs",sk,n)}/>
            </div>
          ))}
        </>)}
        {tab==="kpi"&&(kpiItems.length===0?<Empty t="운영지표가 없어요"/>:kpiItems.map(sk=>{const mk=D.mainKPIs.find(m=>m.id===sk.mainKPIId);return(
          <div key={sk.id} style={{padding:"10px 0",borderBottom:"1px solid #F2F4F6"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:9.5,fontWeight:800,color:"#3182F6",background:"#EBF3FF",borderRadius:6,padding:"2px 6px",flexShrink:0}}>{mk?.krKey||""}</span><span style={{fontSize:12.5,fontWeight:700,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sk.channelCode?sk.channelCode+" · ":""}{sk.title}</span><span style={{fontSize:11,fontWeight:800,color:"#374151",flexShrink:0}}>{fmt(numF(sk.currentValue),sk.unit)} / {fmt(numF(sk.targetValue),sk.unit)}</span></div>
            <NumAdd ph={`이번 주 ${sk.unit||""} 추가`} onAdd={v=>wkVal("subKPIs",sk,v)}/>
          </div>
        );}))}
        {tab==="act"&&(actProjs.length===0?<Empty t="등록된 목표지표가 없어요 · 프로젝트에서 추가하세요"/>:actProjs.map(p=>(
          <div key={p.id} style={{marginBottom:12}}>
            <p style={{margin:"0 0 6px",fontSize:11.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {p.title}</p>
            {(p.activityKPIs||[]).map(ak=>(
              <div key={ak.id} style={{padding:"8px 0",borderBottom:"1px solid #F6F7F9"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><span style={{fontSize:12,fontWeight:700,color:"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ak.name}</span><span style={{fontSize:11,fontWeight:800,color:"#8B5CF6",flexShrink:0}}>{fmt(numF(ak.current),ak.unit)} / {fmt(numF(ak.target),ak.unit)}</span></div>
                <NumAdd ph={`이번 주 ${ak.unit||"개"} 추가`} onAdd={v=>wkAct(p,ak,v)}/>
              </div>
            ))}
          </div>
        )))}
        <button onClick={onClose} style={{width:"100%",marginTop:14,padding:"14px 0",borderRadius:14,border:"none",backgroundColor:"#0F1F5C",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>완료</button>
      </div>
    </Sheet>
  );
}
const Empty=({t})=><div style={{padding:"30px 10px",textAlign:"center",fontSize:13,color:"#C4C9D0"}}>{t}</div>;
function TodayPage({D,cu,lead,add,up,rm,nav}){
  const today=todayDay();
  const todayDate=new Date().getDate();
  const myT=D.tasks.filter(t=>t.assigneeId===cu.id);
  const fixedDueToday=(t)=>{const rt=t.recurType||"daily";if(rt==="weekly")return t.weekDay===today;if(rt==="monthly")return Number(t.monthDay||1)===todayDate;return true;};
  const fixed=myT.filter(t=>t.isFixed&&fixedDueToday(t));
  const todayT=myT.filter(t=>!t.isFixed&&t.weekDay===today);
  const urgent=myT.filter(t=>t.status!=="done"&&t.dueDate&&(()=>{const dd=Math.ceil((new Date(t.dueDate)-new Date())/86400000);return dd>=0&&dd<=3;})());
  const slotMap={};
  WEEK_DAYS.forEach(d=>{slotMap[d]={};[1,2,3,4,5].forEach(s=>{slotMap[d][s]=myT.find(t=>!t.isFixed&&t.weekDay===d&&t.weekSlot===s)||null;});});
  const [slotSheet,setSlotSheet]=useState(null);
  const [quick,setQuick]=useState("");
  const [quickProj,setQuickProj]=useState("");
  const [confirmTaskId,setConfirmTaskId]=useState(null);
  const [editTask,setEditTask]=useState(null);
  const [feedOpen,setFeedOpen]=useState(false);
  const [weeklyOpen,setWeeklyOpen]=useState(false);
  const todayKey=new Date().toISOString().slice(0,10);
  // 이번 주 팀 활동로그 — 완료업무·매출·KPI실적·목표지표를 한 흐름으로 집계
  const wkNow=weekKey();
  const actFeed=(()=>{
    const f=[];
    D.tasks.forEach(t=>{ if(!t.isFixed&&t.status==="done"&&t.doneAt&&weekKey(new Date(t.doneAt))===wkNow) f.push({at:t.doneAt,who:t.doneByName||"",icon:"✅",text:`업무 완료 · ${t.title}`}); });
    D.projects.forEach(p=>{
      (p.salesHistory||[]).forEach(h=>{ if(h.week===wkNow) f.push({at:h.at,who:h.byName||"",icon:"💰",text:`매출 ${fmt(numF(h.value),"원")} · ${p.title}`}); });
      (p.activityKPIs||[]).forEach(ak=>(ak.history||[]).forEach(h=>{ if(h.week===wkNow) f.push({at:h.at,who:h.byName||"",icon:"🎯",text:`${ak.name} ${fmt(numF(h.value),ak.unit)} · ${p.title}`}); }));
    });
    D.subKPIs.forEach(s=>(s.valueHistory||[]).forEach(h=>{ if(h.week===wkNow) f.push({at:h.at,who:h.byName||"",icon:"📊",text:`${s.title} ${fmt(numF(h.value),s.unit)}`}); }));
    D.mainKPIs.forEach(m=>(m.valueHistory||[]).forEach(h=>{ if(h.week===wkNow) f.push({at:h.at,who:h.byName||"",icon:"📊",text:`${m.title} ${fmt(numF(h.value),m.unit)}`}); }));
    f.sort((a,b)=>(b.at||"").localeCompare(a.at||""));
    return f;
  })();
  const toggle=t=>up("tasks",t.id,{status:t.status==="done"?"todo":"done"});
  // 고정(반복)업무는 날짜별 완료 — 오늘 체크는 오늘만 유지(매일 리셋)
  const fixedDone=t=>t.doneDate===todayKey;
  const toggleFixed=t=>up("tasks",t.id,{doneDate:fixedDone(t)?null:todayKey});
  const doQuick=()=>{
    if(!quick.trim()) return;
    add("tasks",{id:"t"+Date.now(),title:quick.trim(),projectId:quickProj,assigneeId:cu.id,type:"general",status:"todo",weekDay:today,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[]});
    setQuick("");setQuickProj("");
  };
  const doneToday=todayT.filter(t=>t.status==="done").length;
  const doneFixed=fixed.filter(fixedDone).length;
  const myProjs=D.projects.filter(p=>p.assigneeId===cu.id||(p.collaboratorIds||[]).includes(cu.id));
  const myGoals=myWeekGoals(D,cu.id);
  // 출시 인계 — 앞 단계가 끝나 내 차례가 된 출시 단계
  const myReadyLaunch=(()=>{ const arr=[]; D.projects.filter(p=>p.templateId).forEach(p=>{ const ts=launchProjTasks(D,p); ts.forEach(t=>{ if(t.assigneeId===cu.id&&launchStageStatus(t,ts)==="ready") arr.push({proj:p,task:t}); }); }); return arr; })();
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div onClick={()=>nav("game")} style={{display:"flex",alignItems:"center",gap:11,background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:16,padding:"12px 14px",marginBottom:12,cursor:"pointer",color:"#fff"}}>
        <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.13)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📝</div>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:13.5,fontWeight:900}}>이번 주 명심할 것</span>
          <p style={{margin:"2px 0 0",fontSize:11,opacity:0.85,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{myGoals.length===0?"아직 없어요 · 눌러서 메모를 남기세요":myGoals.map(g=>g.title).join("  ·  ")}</p>
        </div>
        <span style={{fontSize:11,fontWeight:800,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"4px 10px",borderRadius:10,flexShrink:0}}>내 주간 ›</span>
      </div>
      <button onClick={()=>setWeeklyOpen(true)} style={{width:"100%",marginBottom:14,padding:"13px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"#fff",fontSize:14.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🗓️ 이번 주 마감 입력 — 매출·KPI·목표지표 한 번에</button>
      <WeeklyInputSheet open={weeklyOpen} onClose={()=>setWeeklyOpen(false)} D={D} cu={cu} up={up}/>
      <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[{label:"오늘 업무",val:`${doneToday}/${todayT.length}`,color:"#3182F6"},{label:"고정업무",val:`${doneFixed}/${fixed.length}`,color:"#F97316"},{label:"내 프로젝트",val:D.projects.filter(p=>p.assigneeId===cu.id).length+"건",color:"#8B5CF6"}].map((s,i)=>(
          <div key={i} style={{flexShrink:0,backgroundColor:"#FFFFFF",borderRadius:12,padding:"10px 14px",border:"1px solid #F2F4F6"}}>
            <p style={{margin:0,fontSize:10,color:"#9CA3AF",fontWeight:600}}>{s.label}</p>
            <p style={{margin:"2px 0 0",fontSize:18,fontWeight:900,color:s.color}}>{s.val}</p>
          </div>
        ))}
      </div>
      {urgent.length>0&&(
        <div style={{backgroundColor:"#FFF0F1",border:"1px solid #FFD5D8",borderRadius:14,padding:"11px 14px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
            <span style={{fontSize:15}}>🚨</span>
            <span style={{fontSize:12.5,fontWeight:900,color:"#F04452"}}>마감 임박 · D-3 이내 {urgent.length}건</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {urgent.map(t=>{const dd=Math.ceil((new Date(t.dueDate)-new Date())/86400000);return(
              <button key={t.id} onClick={()=>setEditTask(t)} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:999,border:"1px solid #FFD5D8",backgroundColor:"#FFFFFF",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{fontSize:11.5,fontWeight:700,color:"#1F2937",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                <span style={{fontSize:10,fontWeight:900,color:"#F04452"}}>{dd===0?"D-day":"D-"+dd}</span>
              </button>
            );})}
          </div>
        </div>
      )}
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,marginBottom:14,border:"1px solid #F2F4F6",overflow:"hidden"}}>
        <div onClick={()=>setFeedOpen(o=>!o)} style={{padding:"13px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📋 이번 주 팀 활동</h3>
            <span style={{fontSize:11,fontWeight:800,color:"#fff",background:actFeed.length>0?"#00C073":"#D1D5DB",padding:"2px 8px",borderRadius:10}}>{actFeed.length}건</span>
          </div>
          <span style={{fontSize:12,color:"#9CA3AF"}}>{weekLabel(wkNow)} {feedOpen?"▲":"▼"}</span>
        </div>
        {feedOpen&&(
          <div style={{borderTop:"1px solid #F2F4F6",padding:"6px 14px 12px"}}>
            {actFeed.length===0&&<p style={{padding:"16px 0",textAlign:"center",fontSize:12.5,color:"#9CA3AF"}}>이번 주 기록된 활동이 없어요 · 기록되지 않은 업무는 자산이 되지 않아요</p>}
            {actFeed.slice(0,30).map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<Math.min(actFeed.length,30)-1?"1px solid #F6F7F9":"none"}}>
                <span style={{fontSize:14,flexShrink:0}}>{e.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:12.5,fontWeight:600,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.text}</p>
                  <p style={{margin:"1px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{e.who||"—"} · {(e.at||"").slice(5,16).replace("T"," ")}</p>
                </div>
              </div>
            ))}
            {actFeed.length>30&&<p style={{margin:"8px 0 0",textAlign:"center",fontSize:11,color:"#9CA3AF"}}>외 {actFeed.length-30}건 더…</p>}
          </div>
        )}
      </div>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:14,border:"1px solid #F2F4F6"}}>
        <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📅 주간 업무 배치</h3>
        <p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>월~금 · 1~5순위 슬롯 · 탭해서 배치</p>
        <div style={{overflowX:"auto",paddingBottom:4}}>
          <div style={{display:"flex",gap:8,minWidth:WEEK_DAYS.length*118}}>
            {WEEK_DAYS.map(d=>{
              const isT=d===today;
              return(
                <div key={d} style={{width:114,flexShrink:0,backgroundColor:isT?"rgba(255,237,213,0.53)":"#F9FAFB",border:`1.5px solid ${isT?"#F97316":"#E5E8EB"}`,borderRadius:12,padding:"10px 8px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
                    <span style={{fontSize:11,fontWeight:900,color:isT?"#EA580C":"#4B5563"}}>{d}요일</span>
                    {isT&&<span style={{fontSize:9,fontWeight:900,color:"#FFFFFF",background:"#F97316",padding:"1px 5px",borderRadius:10}}>오늘</span>}
                  </div>
                  {[1,2,3,4,5].map(slot=>{
                    const t=slotMap[d][slot];
                    return(
                      <div key={slot} onClick={()=>setSlotSheet({day:d,slot,current:t})} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 7px",marginBottom:4,borderRadius:8,border:t?"1px solid #E5E8EB":"1px dashed #E5E8EB",background:t?(t.status==="done"?"#E8FAF1":"#FFFFFF"):"transparent",cursor:"pointer",minHeight:28}}>
                        <span style={{fontSize:9,fontWeight:900,color:"#9CA3AF",minWidth:10}}>{slot}</span>
                        {t?<span style={{fontSize:10,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.status==="done"?"line-through":"none"}}>{t.title}</span>:<span style={{fontSize:9.5,color:"#D1D5DB",fontStyle:"italic"}}>+배치</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:12,border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>✅ 오늘 업무 ({today}요일)</h3>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{doneToday}/{todayT.length} 완료</p>
          </div>
        </div>
        {todayT.length===0?(
          <div style={{padding:"20px 0",textAlign:"center"}}>
            <p style={{margin:0,fontSize:13,color:"#9CA3AF"}}>오늘({today}요일) 배치된 업무가 없어요</p>
            <p style={{margin:"3px 0 0",fontSize:11.5,color:"#D1D5DB"}}>위 슬롯을 탭해서 배치하거나 아래에서 빠른 추가하세요</p>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {todayT.map(t=>{
              const proj=D.projects.find(p=>p.id===t.projectId);
              const st=STATUS_MAP[t.status];
              return(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:12,backgroundColor:t.status==="done"?"rgba(232,250,241,0.34)":"#F9FAFB",border:`1px solid ${t.status==="done"?"rgba(0,192,115,0.2)":"#E5E8EB"}`}}>
                  <button onClick={()=>toggle(t)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${t.status==="done"?"#00C073":"#D1D5DB"}`,backgroundColor:t.status==="done"?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                    {t.status==="done"&&<span style={{color:"#FFFFFF",fontSize:12,fontWeight:900}}>✓</span>}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#111827",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
                    {proj&&<p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>📁 {proj.title}</p>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {t.weekSlot&&<span style={{fontSize:10,fontWeight:800,color:"#9CA3AF"}}>{t.weekSlot}순위</span>}
                    <span style={{fontSize:11,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"2px 8px",borderRadius:6}}>{st.label}</span>
                    <button onClick={()=>setEditTask(t)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#9CA3AF",padding:8}}>✎</button>
                    <button onClick={()=>setConfirmTaskId(t.id)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#D1D5DB",padding:8}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{marginTop:10}}>
          <div style={{display:"flex",gap:8}}>
            <input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doQuick()} placeholder="빠른 업무 추가... (Enter)" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:13,outline:"none",fontFamily:"inherit",backgroundColor:"#F9FAFB"}}/>
            <button onClick={doQuick} disabled={!quick.trim()} style={{width:40,height:40,borderRadius:10,border:"none",backgroundColor:quick.trim()?"#F97316":"#E5E8EB",color:quick.trim()?"#FFFFFF":"#9CA3AF",fontSize:20,cursor:quick.trim()?"pointer":"not-allowed",flexShrink:0}}>+</button>
          </div>
          <div style={{position:"relative",marginTop:6}}>
            <select value={quickProj} onChange={e=>setQuickProj(e.target.value)} style={{width:"100%",padding:"7px 28px 7px 10px",borderRadius:9,border:`1.5px solid ${quickProj?"#F97316":"#E5E8EB"}`,fontSize:12,color:quickProj?"#0F1F5C":"#9CA3AF",backgroundColor:quickProj?"#FFEDD5":"#F9FAFB",fontFamily:"inherit",outline:"none",WebkitAppearance:"none",appearance:"none"}}>
              <option value="">📁 프로젝트 선택 (선택사항)</option>
              {D.projects.map(p=><option key={p.id} value={p.id}>{p.group?`[${p.group}] `:""}{p.title}</option>)}
            </select>
            <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:10,color:quickProj?"#F97316":"#9CA3AF"}}>▼</span>
          </div>
        </div>
      </div>
      {myReadyLaunch.length>0&&(
        <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #FED7AA",marginBottom:14}}>
          <div onClick={()=>nav("launch")} style={{marginBottom:12,cursor:"pointer"}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#EA580C"}}>🔔 출시 인계 — 내 차례 ({myReadyLaunch.length})</h3>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>앞 단계가 끝나 내게 넘어온 출시 단계예요 · 완료하면 다음 담당자에게 인계됩니다</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {myReadyLaunch.map(({proj,task})=>(
              <div key={task.id} style={{padding:"11px 12px",borderRadius:12,backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",display:"flex",alignItems:"center",gap:9}}>
                <button onClick={()=>toggle(task)} style={{flexShrink:0,width:24,height:24,borderRadius:"50%",border:"2px solid #F97316",backgroundColor:"#fff",color:"#F97316",fontSize:12,fontWeight:900,cursor:"pointer"}}>✓</button>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</p>
                  <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>📦 {proj.productName||proj.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(()=>{const orphans=myT.filter(t=>!t.isFixed&&!t.weekDay&&t.status!=="done");if(!orphans.length)return null;return(<div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #FED7AA",marginBottom:14}}><div style={{marginBottom:12}}><h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#EA580C"}}>📥 미배치 업무 ({orphans.length})</h3><p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>요일 미지정 — 배치하거나 프로젝트를 연결하세요</p></div><div style={{display:"flex",flexDirection:"column",gap:7}}>{orphans.map(t=>{const proj=D.projects.find(p=>p.id===t.projectId);return(<div key={t.id} style={{padding:"11px 12px",borderRadius:12,backgroundColor:"#FFF7ED",border:"1px solid #FED7AA"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>{proj?<p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>📁 {proj.title}</p>:<p style={{margin:"2px 0 0",fontSize:10.5,color:"#F04452",fontWeight:600}}>⚠️ 프로젝트 미연결</p>}</div><button onClick={()=>setEditTask(t)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",fontSize:12,fontWeight:700,color:"#4B5563",cursor:"pointer",flexShrink:0}}>✎</button><button onClick={()=>setConfirmTaskId(t.id)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #FFE2E5",backgroundColor:"#FFF0F1",fontSize:12,fontWeight:700,color:"#F04452",cursor:"pointer",flexShrink:0}}>🗑</button></div><button onClick={()=>up("tasks",t.id,{weekDay:today})} style={{width:"100%",marginTop:8,padding:"8px 0",borderRadius:9,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:12,fontWeight:700,cursor:"pointer"}}>📍 오늘({today}) 배치</button></div>);})}</div></div>);})()}
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📌 고정업무</h3>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{doneFixed}/{fixed.length} 완료</p>
          </div>
          <button onClick={()=>nav("fixed")} style={{fontSize:11,fontWeight:700,color:"#EA580C",backgroundColor:"#FFEDD5",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer"}}>관리 →</button>
        </div>
        {fixed.length===0?<p style={{margin:0,padding:"16px 0",textAlign:"center",fontSize:13,color:"#D1D5DB"}}>고정업무가 없어요</p>:(
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {fixed.map(t=>{
              const proj=D.projects.find(p=>p.id===t.projectId);
              const dn=fixedDone(t);
              return(
                <div key={t.id} onClick={()=>toggleFixed(t)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:12,backgroundColor:dn?"rgba(232,250,241,0.34)":"#F9FAFB",border:`1px solid ${dn?"rgba(0,192,115,0.2)":"#E5E8EB"}`,cursor:"pointer"}}>
                  <button onClick={e=>{e.stopPropagation();toggleFixed(t);}} style={{width:22,height:22,borderRadius:6,border:`2px solid ${dn?"#00C073":"#D1D5DB"}`,backgroundColor:dn?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                    {dn&&<span style={{color:"#FFFFFF",fontSize:12,fontWeight:900}}>✓</span>}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:dn?"#9CA3AF":"#111827",textDecoration:dn?"line-through":"none"}}>{t.title}</p>
                    {proj&&<p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>📁 {proj.title}</p>}
                  </div>
                  <span style={{fontSize:10,color:"#F97316",fontWeight:800,flexShrink:0}}>🔄</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {slotSheet&&(
        <Sheet open={true} onClose={()=>setSlotSheet(null)} title={`${slotSheet.day}요일 ${slotSheet.slot}순위 슬롯`} h="70vh">
          <div style={{marginTop:12}}>
            {slotSheet.current&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",backgroundColor:"#F9FAFB",borderRadius:12,marginBottom:14}}>
                <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>현재: {slotSheet.current.title}</span>
                <button onClick={()=>{up("tasks",slotSheet.current.id,{weekDay:null,weekSlot:null});setSlotSheet(null);}} style={{padding:"5px 12px",borderRadius:8,border:"none",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:12,fontWeight:700,cursor:"pointer"}}>비우기</button>
              </div>
            )}
            <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:"#6B7280"}}>배치할 업무 선택</p>
            {myT.filter(t=>!t.isFixed&&!(t.weekDay===slotSheet.day&&t.weekSlot===slotSheet.slot)&&t.status!=="done").map(t=>(
              <button key={t.id} onClick={()=>{const prev=slotMap[slotSheet.day][slotSheet.slot];if(prev)up("tasks",prev.id,{weekDay:null,weekSlot:null});up("tasks",t.id,{weekDay:slotSheet.day,weekSlot:slotSheet.slot});setSlotSheet(null);}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:7,borderRadius:12,border:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",textAlign:"left",cursor:"pointer",width:"100%"}}>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#111827"}}>{t.title}</p>
                  {D.projects.find(p=>p.id===t.projectId)&&<p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>📁 {D.projects.find(p=>p.id===t.projectId).title}</p>}
                </div>
                <span style={{color:"#F97316",fontSize:16,flexShrink:0}}>→</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      <EditTaskSheet open={!!editTask} onClose={()=>setEditTask(null)} task={editTask} D={D} onSave={f=>up("tasks",editTask.id,{title:f.title,status:f.status,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,attachments:f.attachments})}/>
      <Confirm open={!!confirmTaskId} title="업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmTaskId)?.title}" 업무를 삭제할까요?`} onOk={()=>{rm("tasks",confirmTaskId);setConfirmTaskId(null);}} onCancel={()=>setConfirmTaskId(null)}/>
    </div>
  );
}
function KPIPage({D,lead,up,cu,add,rm}){
  const [kpiView,setKpiView]=useState("dashboard");
  const [openMK,setOpenMK]=useState("mk1");
  const [openSK,setOpenSK]=useState(null);
  const [openContrib,setOpenContrib]=useState(null);   // 채널별 기여분석 펼침
  const [openProj,setOpenProj]=useState(null);
  const [salesOpen,setSalesOpen]=useState(false);
  const [salesHist,setSalesHist]=useState(null); // 매출 이력 보기 대상 (project)
  const [histItem,setHistItem]=useState(null);   // 수치 이력 보기 대상 (subKPI/mainKPI)
  const [valSheet,setValSheet]=useState(null);   // 수치 입력 시트 {coll,item}
  const [valMode,setValMode]=useState("delta");  // delta(이번주 추가) | total(누계 직접)
  const [valAmt,setValAmt]=useState("");
  const [valWeek,setValWeek]=useState(weekKey());
  const [cfg,setCfg]=useState(null);   // 이름·목표 설정 시트 {coll,item,kind,mainKPIId,goalId}
  const [cfgForm,setCfgForm]=useState({title:"",target:"",unit:"",current:""});
  const [kpiDel,setKpiDel]=useState(null);   // 삭제 확인 {coll,item,kind}
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  const openCfg=(coll,item,kind)=>{ setCfgForm({title:item.title||"",target:String(item.targetValue??""),unit:item.unit||"",current:String(item.currentValue??"")}); setCfg({coll,item,kind}); };
  const openNewSub=(mkId)=>{ setCfgForm({title:"",target:"",unit:"원",current:""}); setCfg({coll:"subKPIs",item:null,kind:"sub",mainKPIId:mkId}); };
  const openNewMain=()=>{ setCfgForm({title:"",target:"",unit:"원",current:""}); setCfg({coll:"mainKPIs",item:null,kind:"main",goalId:D.goals[0]?.id}); };
  const saveCfg=()=>{
    if(!cfg) return;
    const {coll,item,kind,mainKPIId,goalId}=cfg;
    if(!item){ // 신규 추가
      if(!cfgForm.title.trim()){ return; }
      if(kind==="sub") add("subKPIs",{id:"sk"+Date.now(),mainKPIId,title:cfgForm.title.trim(),targetValue:numF(cfgForm.target),currentValue:0,unit:cfgForm.unit||"원",order:99,channelCode:""});
      else if(kind==="main") add("mainKPIs",{id:"mk"+Date.now(),goalId:goalId||(D.goals[0]&&D.goals[0].id),title:cfgForm.title.trim(),targetValue:numF(cfgForm.target),currentValue:0,unit:cfgForm.unit||"원",order:99,krKey:cfgForm.title.trim().slice(0,6)});
      setCfg(null); return;
    }
    const patch={title:cfgForm.title.trim()||item.title,targetValue:numF(cfgForm.target)};
    if(kind!=="goal") patch.unit=cfgForm.unit||item.unit;
    if(kind!=="goal"&&cfgForm.current!==""&&isFinite(Number(cfgForm.current))){ patch.currentValue=Number(cfgForm.current); if(item.mainKPIId==="mk2"&&item.unit==="원") patch.manualOverride=true; }
    up(coll,item.id,patch);
    setCfg(null);
  };
  const doKpiDel=()=>{ if(!kpiDel)return; rm(kpiDel.coll,kpiDel.item.id); setKpiDel(null); setCfg(null); };
  // 수치 입력 시트 열기 — 매주 실적(추가값/총값) 기록
  const openVal=(coll,item)=>{ setValMode("delta"); setValAmt(""); setValWeek(weekKey()); setValSheet({coll,item}); };
  const shiftWeek=(d)=>{ const m=new Date(valWeek); m.setDate(m.getDate()+d*7); setValWeek(m.toISOString().slice(0,10)); };
  const applyVal=()=>{
    if(!valSheet) return;
    const {coll,item}=valSheet;
    const prev=Number(item.currentValue||0);
    const amt=Number(valAmt)||0;
    const value=valMode==="delta"?prev+amt:amt;
    if(!isFinite(value)){ setValSheet(null); return; }   // NaN/Infinity 방어 — 잘못된 값 저장 금지
    const at=new Date().toISOString();
    const entry={week:valWeek,mode:valMode,amount:amt,value,prev,by:cu?.id||null,byName:cu?.name||"",at};
    up(coll,item.id,{currentValue:value,manualOverride:true,valueBy:cu?.id||null,valueByName:cu?.name||"",valueAt:at,valueHistory:[...(item.valueHistory||[]),entry]});
    setValSheet(null);
  };
  const resetAuto=(sk)=>up("subKPIs",sk.id,{manualOverride:false});
  // 매출 입력 — resultValue 덮어쓰기 + 이력 기록(누가·언제·증감)
  const setSale=(p,raw)=>{
    const v=raw===""?0:(Number(raw)||0);
    if(!isFinite(v)) return;                       // NaN/Infinity 방어
    const prev=numF(p.resultValue);
    if(v===prev) return;                            // 변화 없으면 기록 안 함
    const at=new Date().toISOString();
    const entry={week:weekKey(),value:v,prev,delta:v-prev,by:cu?.id||null,byName:cu?.name||"",at};
    up("projects",p.id,{resultValue:v,salesBy:cu?.id||null,salesByName:cu?.name||"",salesAt:at,salesHistory:[...(p.salesHistory||[]),entry]});
  };
  const getContrib=(sk)=>{
    const projs=D.projects.filter(p=>p.subKPIId===sk.id);
    return projs.map(proj=>{
      const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
      const doneTasks=tasks.filter(t=>t.status==="done");
      const assignee=D.users.find(u=>u.id===proj.assigneeId);
      return{proj,tasks,effort:tasks.length,indirect:doneTasks.length,direct:proj.resultValue||0,assignee};
    });
  };
  // 멤버별 기여(이 채널 프로젝트의 업무 기준) — 100% 분할 백분율
  const memberContrib=(sk)=>{
    const projIds=new Set(D.projects.filter(p=>p.subKPIId===sk.id).map(p=>p.id));
    const m={}; D.users.forEach(u=>m[u.id]={uid:u.id,user:u,effort:0,indirect:0});
    (D.tasks||[]).forEach(t=>{ if(t.isFixed||!projIds.has(t.projectId))return;
      if(m[t.assigneeId]) m[t.assigneeId].effort++;
      if(t.status==="done"){ const d=matchUid(D,t.doneBy,t.doneByName)||t.assigneeId; if(m[d]) m[d].indirect++; }
    });
    return Object.values(m);
  };
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"dashboard",l:"◎ KPI 현황"},{k:"mindmap",l:"◈ 전체 맵"}].map(v=>(
          <button key={v.k} onClick={()=>setKpiView(v.k)} style={{flex:1,padding:"9px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:kpiView===v.k?"#FFFFFF":"transparent",color:kpiView===v.k?"#0F1F5C":"#6B7280",fontWeight:kpiView===v.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:kpiView===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
        ))}
      </div>
      {kpiView==="dashboard"&&(
        <div>
          <div style={{backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"11px 13px",marginBottom:12}}>
            <p style={{margin:"0 0 4px",fontSize:12,fontWeight:900,color:"#EA580C"}}>💡 매주 금요일, 내 KPI에 이번 주 실적을 넣으세요</p>
            <p style={{margin:0,fontSize:11,color:"#9A3412",fontWeight:600,lineHeight:1.55}}>· <b>직판·운영</b> KPI → 항목 펼쳐 <b>📊 이번 주 실적 입력</b><br/>· <b>B2B(메인2)</b> → 펼친 뒤 <b>거래처유형별 매출 ✏️입력</b>(프로젝트 매출) = 자동 집계<br/>· 추가값=이번 주만 / 총값=누계 덮어쓰기 · 누가 넣었는지·주차별 이력 자동 기록</p>
          </div>
          {D.goals.map(g=>{
            const cur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
            const p=pct(cur,g.targetValue);
            return(
              <div key={g.id} style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:18,padding:"18px",marginBottom:14,color:"#FFFFFF"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,opacity:0.6,letterSpacing:2}}>최종 목표</p><button onClick={()=>openCfg("goals",g,"goal")} title="이름·목표 수정" style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,color:"#fff",padding:"3px 8px",fontWeight:700}}>⚙ 수정</button></div>
                <p style={{margin:"0 0 12px",fontSize:16,fontWeight:900}}>{g.title}</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                  <span style={{fontSize:13,opacity:0.8}}>{fmt(cur,g.unit)} / {fmt(g.targetValue,g.unit)}</span>
                  <span style={{fontSize:30,fontWeight:900,color:"#F97316"}}>{p}%</span>
                </div>
                <PBar value={p} color="#F97316" h={7}/>
                <p style={{margin:"6px 0 0",fontSize:10.5,opacity:0.6}}>2026년 목표 · {p}% 달성</p>
              </div>
            );
          })}
          {(()=>{
            // 수치목표 롤업 — 전 프로젝트 목표지표(activityKPIs)를 지표명으로 합산(매출 아님)
            const agg={};
            D.projects.forEach(pr=>(pr.activityKPIs||[]).forEach(ak=>{const k=ak.name||"기타";if(!agg[k])agg[k]={name:k,unit:ak.unit||"",cur:0,tgt:0,cnt:0,projs:[]};agg[k].cur+=numF(ak.current);agg[k].tgt+=numF(ak.target);agg[k].cnt++;agg[k].projs.push(pr.title);}));
            const rows=Object.values(agg).sort((a,b)=>b.cur-a.cur);
            if(rows.length===0) return null;
            return(
              <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px 16px",marginBottom:14,border:"1px solid #F2F4F6"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>🎯 수치목표 롤업</h3>
                  <span style={{fontSize:10.5,color:"#9CA3AF"}}>{rows.length}개 지표 · {rows.reduce((s,r)=>s+r.cnt,0)}개 프로젝트</span>
                </div>
                <p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>프로젝트별 목표지표를 지표명으로 합산 — 운영·활동 성과(매출 아님)</p>
                {rows.map(r=>{const pr2=pct(r.cur,r.tgt);return(
                  <div key={r.name} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,gap:8}}>
                      <span style={{fontSize:12.5,fontWeight:700,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}<span style={{fontSize:10,color:"#9CA3AF",marginLeft:5}}>·{r.cnt}건</span></span>
                      <span style={{fontSize:12,fontWeight:800,color:pr2>=70?"#00C073":"#8B5CF6",flexShrink:0}}>{fmt(r.cur,r.unit)} / {fmt(r.tgt,r.unit)}{r.tgt>0?` · ${pr2}%`:""}</span>
                    </div>
                    <div style={{height:6,borderRadius:6,backgroundColor:"#F2F4F6",overflow:"hidden"}}><div style={{width:`${pr2}%`,height:"100%",backgroundColor:pr2>=70?"#00C073":"#8B5CF6",borderRadius:6}}/></div>
                  </div>
                );})}
              </div>
            );
          })()}
          <h3 style={{margin:"0 0 10px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>메인 KPI</h3>
          {D.mainKPIs.map(mk=>{
            const p=pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue);
            const subs=D.subKPIs.filter(sk=>sk.mainKPIId===mk.id);
            const open=openMK===mk.id;
            const col=krColors[mk.id]||"#3182F6";
            return(
              <div key={mk.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,marginBottom:10,border:"1px solid #F2F4F6",overflow:"hidden"}}>
                <div onClick={()=>setOpenMK(open?null:mk.id)} style={{padding:"14px 16px",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontWeight:900,color:"#FFFFFF",backgroundColor:col,padding:"2px 8px",borderRadius:20}}>{mk.krKey}</span>
                      <span style={{fontSize:14,fontWeight:800,color:"#0F1F5C"}}>{mk.title}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={e=>{e.stopPropagation();openCfg("mainKPIs",mk,"main");}} title="이름·목표 수정" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#9CA3AF",padding:8}}>⚙</button>
                      <span style={{fontSize:16,fontWeight:900,color:col}}>{p}%</span>
                      <span style={{fontSize:12,color:"#9CA3AF"}}>{open?"▲":"▼"}</span>
                    </div>
                  </div>
                  <PBar value={p} color={col} h={6}/>
                  <p style={{margin:"5px 0 0",fontSize:11,color:"#9CA3AF"}}>{fmt(mkCur(mk,D.subKPIs,D.projects),mk.unit)} / {fmt(mk.targetValue,mk.unit)}</p>
                </div>
                {open&&(
                  <div style={{borderTop:"1px solid #F2F4F6",padding:"12px 16px 14px"}}>
                    {mk.unit==="원"&&mk.id!=="mk2"&&(<div style={{marginBottom:12,padding:"9px 12px",backgroundColor:"#EBF3FF",borderRadius:10}}><p style={{margin:0,fontSize:11.5,color:"#3182F6",fontWeight:600}}>📊 채널별 매출 합계로 자동 집계 — 아래 채널 현재값 입력</p></div>)}{mk.id==="mk2"&&(<div style={{marginBottom:12,padding:"11px 13px",backgroundColor:"#FFF7ED",borderRadius:10,border:"1px solid #FED7AA"}}><p style={{margin:"0 0 4px",fontSize:12,color:"#EA580C",fontWeight:800}}>💡 매출 입력은 여기서!</p><p style={{margin:0,fontSize:11.5,color:"#9A3412",fontWeight:600,lineHeight:1.55}}>아래 <b>거래처유형별 매출</b>의 <b>✏️ 입력</b> 버튼 → 한 화면에서 거래처유형별로 바로 입력 → 단가·메인KPI에 자동 반영</p></div>)}{mk.unit!=="원"&&(()=>{const hasAutoSrc=subs.length>0;const isAuto=hasAutoSrc&&!mk.manualOverride;const eff=mkCur(mk,D.subKPIs,D.projects);return(<div style={{marginBottom:12}}>{isAuto&&<div style={{marginBottom:8,padding:"9px 12px",backgroundColor:"#E8FAF1",borderRadius:10}}><p style={{margin:0,fontSize:11.5,color:"#00A050",fontWeight:700,lineHeight:1.5}}>📊 하위 항목 달성도로 자동 롤업 · 환산 {fmt(eff,mk.unit)} / {fmt(mk.targetValue,mk.unit)}</p></div>}<button onClick={()=>openVal("mainKPIs",mk)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #F97316",background:"#FFF7ED",color:"#EA580C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{isAuto?"✏️ 직접 입력으로 전환":"📊 이번 주 실적 입력"} · 현재 {fmt(eff,mk.unit)}</button>{(mk.valueByName||(mk.valueHistory&&mk.valueHistory.length)||(mk.manualOverride&&hasAutoSrc))&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,gap:8}}>{mk.valueByName&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>👤 {mk.valueByName} · {(mk.valueAt||"").slice(5,10)}</span>}<div style={{display:"flex",gap:6,marginLeft:"auto"}}>{mk.valueHistory&&mk.valueHistory.length>0&&<button onClick={()=>setHistItem(mk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 이력 {mk.valueHistory.length}</button>}{mk.manualOverride&&hasAutoSrc&&<button onClick={()=>up("mainKPIs",mk.id,{manualOverride:false})} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #FED7AA",background:"#FFF7ED",fontSize:10.5,fontWeight:700,color:"#EA580C",cursor:"pointer",fontFamily:"inherit"}}>↺ 자동으로</button>}</div></div>}</div>);})()}
                    {mk.id==="mk2"&&(()=>{const b2b=D.projects.filter(p=>p.mainKPIId==="mk2"&&p.dealerType);if(!b2b.length)return null;const byType={};b2b.forEach(p=>{const k=p.dealerType;if(!byType[k])byType[k]={sum:0,cnt:0};byType[k].sum+=(p.resultValue||0);byType[k].cnt+=1;});const rows=Object.keys(byType).map(code=>({code,sum:byType[code].sum,cnt:byType[code].cnt,dt:DT[code]})).sort((a,b)=>b.sum-a.sum);const tot=rows.reduce((s,r)=>s+r.sum,0);const mx=Math.max(...rows.map(r=>r.sum),1);return(<div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px 16px",marginBottom:10,border:"1px solid #F2F4F6"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>💰 거래처유형별 매출 (B2B)</h3><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:800,color:"#F97316"}}>{fmt(tot,"원")}</span><button onClick={()=>setSalesOpen(true)} style={{padding:"6px 12px",borderRadius:9,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>✏️ 입력</button></div></div><p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>누가 샀나 · 거래처유형(13종) 자동 집계 — 입력은 ✏️ 버튼</p>{rows.map(r=>{const w=Math.round(r.sum/mx*100);const c=r.dt?.color||"#9CA3AF";return(<div key={r.code} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,gap:8}}><div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}><span style={{fontSize:10.5,fontWeight:800,color:c,backgroundColor:c+"18",borderRadius:6,padding:"2px 6px",flexShrink:0,fontFamily:"'IBM Plex Mono',monospace"}}>{r.code}</span><span style={{fontSize:12,fontWeight:700,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.dt?.label||r.code}</span><span style={{fontSize:10.5,color:"#9CA3AF",flexShrink:0}}>·{r.cnt}건</span></div><span style={{fontSize:12,fontWeight:800,color:"#374151",flexShrink:0}}>{fmt(r.sum,"원")}</span></div><div style={{height:6,borderRadius:6,backgroundColor:"#F2F4F6",overflow:"hidden"}}><div style={{width:`${w}%`,height:"100%",backgroundColor:c,borderRadius:6}}/></div></div>);})}</div>);})()}<p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:"#6B7280"}}>{mk.id==="mk2"?"얼마 단가에 — 단가별 매출 (자동 집계)":mk.id==="mk1"?"채널별 매출":"구축 항목"}</p>{(()=>{const orphan=D.projects.filter(pj=>pj.mainKPIId===mk.id&&!pj.subKPIId);if(!orphan.length)return null;return(<div style={{marginBottom:10,padding:"10px 12px",backgroundColor:"#FFF7ED",borderRadius:10,border:"1px solid #FED7AA"}}><p style={{margin:"0 0 6px",fontSize:11.5,fontWeight:800,color:"#EA580C"}}>⚠️ 채널 미지정 {orphan.length}건</p>{orphan.map(pj=>{const as=D.users.find(u=>u.id===pj.assigneeId);return(<div key={pj.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0"}}><Ava name={as?.name} color={as?.color} size={18}/><span style={{fontSize:12,fontWeight:600,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pj.title}</span><span style={{fontSize:11,fontWeight:700,color:"#EA580C"}}>{pj.progress}%</span></div>);})}</div>);})()}
                    {subs.map(sk=>{
                      const sp=pct(skCur(sk,D.projects),sk.targetValue);
                      const projs=D.projects.filter(p=>p.subKPIId===sk.id);
                      const skOpen=openSK===sk.id;
                      const contribs=getContrib(sk);
                      return(
                        <div key={sk.id} style={{backgroundColor:"#F9FAFB",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                          <div onClick={()=>setOpenSK(skOpen?null:sk.id)} style={{padding:"12px 14px",cursor:"pointer"}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{fontSize:10,fontWeight:900,color:col,backgroundColor:col+"22",padding:"1px 6px",borderRadius:8}}>{sk.channelCode}</span>
                                <span style={{fontSize:12.5,fontWeight:700,color:"#1F2937"}}>{sk.title}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <button onClick={e=>{e.stopPropagation();openCfg("subKPIs",sk,"sub");}} title="이름·목표 수정" style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#9CA3AF",padding:8}}>⚙</button>
                                <span style={{fontSize:13,fontWeight:900,color:sp>=50?"#00C073":"#FF9500"}}>{sp}%</span>
                                <span style={{fontSize:11,color:"#9CA3AF"}}>{skOpen?"▲":"▼"}</span>
                              </div>
                            </div>
                            <PBar value={sp} color={sp>=50?"#00C073":"#FF9500"} h={5}/>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                              <span style={{fontSize:11,color:"#9CA3AF"}}>{fmt(skCur(sk,D.projects),sk.unit)} / {fmt(sk.targetValue,sk.unit)}</span>
                              <span style={{fontSize:11,color:"#9CA3AF"}}>프로젝트 {projs.length}개</span>
                            </div>
                            <button onClick={e=>{e.stopPropagation();openVal("subKPIs",sk);}} style={{width:"100%",marginTop:8,padding:"8px 10px",borderRadius:8,border:"1.5px solid #F97316",background:"#FFF7ED",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📊 이번 주 실적 입력</button>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:6,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                {sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride&&<span style={{fontSize:10,fontWeight:800,color:"#3182F6",backgroundColor:"#EBF3FF",padding:"2px 7px",borderRadius:6}}>📊 자동 집계(매출)</span>}
                                {sk.unit==="%"&&!sk.manualOverride&&projs.length>0&&<span style={{fontSize:10,fontWeight:800,color:"#00C073",backgroundColor:"#E8FAF1",padding:"2px 7px",borderRadius:6}}>📊 자동(업무 진행률 평균)</span>}
                                {sk.manualOverride&&<span style={{fontSize:10,fontWeight:800,color:"#EA580C",backgroundColor:"#FFF1E7",padding:"2px 7px",borderRadius:6}}>✏️ 수동 수정됨</span>}
                                {sk.valueByName&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>👤 {sk.valueByName} · {(sk.valueAt||"").slice(5,10)}</span>}
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                {sk.valueHistory&&sk.valueHistory.length>0&&<button onClick={()=>setHistItem(sk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 이력 {sk.valueHistory.length}</button>}
                                {sk.manualOverride&&((sk.mainKPIId==="mk2"&&sk.unit==="원")||(sk.unit==="%"&&projs.length>0))&&<button onClick={()=>resetAuto(sk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #FED7AA",background:"#FFF7ED",fontSize:10.5,fontWeight:700,color:"#EA580C",cursor:"pointer",fontFamily:"inherit"}}>↺ 자동으로</button>}
                              </div>
                            </div>
                          </div>
                          {skOpen&&(
                            <div style={{borderTop:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",padding:"12px 14px"}}>
                              {contribs.length>0&&(()=>{
                                const mc=memberContrib(sk);
                                const totE=mc.reduce((a,x)=>a+x.effort,0);
                                const totI=mc.reduce((a,x)=>a+x.indirect,0);
                                const isOpen=openContrib===sk.id;
                                const Col=({title,color,bg,fld,tot})=>(
                                  <div style={{flex:1,minWidth:0,backgroundColor:bg,borderRadius:10,padding:"10px 12px"}}>
                                    <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color}}>{title}</p>
                                    {[...mc].sort((a,b)=>b[fld]-a[fld]).map(x=>{const v=x[fld];const p=tot>0?Math.round(v/tot*100):0;return(
                                      <div key={x.uid} style={{marginBottom:7}}>
                                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                                          <Ava name={x.user?.name} color={x.user?.color} size={16}/>
                                          <span style={{fontSize:11,fontWeight:700,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.user?.name||"?"}</span>
                                          <span style={{fontSize:11.5,fontWeight:900,color,flexShrink:0}}>{p}%</span>
                                        </div>
                                        <div style={{height:5,borderRadius:5,backgroundColor:"#fff",overflow:"hidden"}}>
                                          <div style={{width:`${p}%`,height:"100%",backgroundColor:x.user?.color||color,borderRadius:5}}/>
                                        </div>
                                      </div>
                                    );})}
                                  </div>
                                );
                                return(
                                  <div style={{marginBottom:14}}>
                                    <button onClick={()=>setOpenContrib(isOpen?null:sk.id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:9,border:"1px solid #E5E8EB",background:"#F9FAFB",cursor:"pointer",fontFamily:"inherit"}}>
                                      <span style={{fontSize:12,fontWeight:900,color:"#0F1F5C"}}>📊 기여 분석 <span style={{fontWeight:600,color:"#9CA3AF"}}>(멤버별 100% 분할)</span></span>
                                      <span style={{fontSize:11,color:"#9CA3AF"}}>{isOpen?"▲ 접기":"▼ 펼치기"}</span>
                                    </button>
                                    {isOpen&&(
                                      <div style={{display:"flex",gap:8,marginTop:8}}>
                                        <Col title="⚡ 행동 기여 — 업무 수" color="#3182F6" bg="#EBF3FF" fld="effort" tot={totE}/>
                                        <Col title="✅ 간접 결과 — 완료 수" color="#00C073" bg="#E8FAF1" fld="indirect" tot={totI}/>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              <p style={{margin:"0 0 8px",fontSize:12,fontWeight:900,color:"#0F1F5C"}}>📁 프로젝트</p>
                              {projs.length===0&&<p style={{fontSize:12,color:"#D1D5DB",padding:"8px 0"}}>연결된 프로젝트가 없어요</p>}
                              {projs.map(proj=>{
                                const assignee=D.users.find(u=>u.id===proj.assigneeId);
                                const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
                                const done=tasks.filter(t=>t.status==="done");
                                const pOpen=openProj===proj.id;
                                return(
                                  <div key={proj.id} style={{borderRadius:10,border:"1px solid #E5E8EB",marginBottom:8,overflow:"hidden"}}>
                                    <div onClick={()=>setOpenProj(pOpen?null:proj.id)} style={{padding:"10px 12px",cursor:"pointer",backgroundColor:"#F9FAFB"}}>
                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                                          <Ava name={assignee?.name} color={assignee?.color} size={22}/>
                                          <span style={{fontSize:12.5,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                                          <span style={{fontSize:12,fontWeight:800,color:proj.progress>=70?"#00C073":"#3182F6"}}>{proj.progress}%</span>
                                          <span style={{fontSize:10,color:"#9CA3AF"}}>{pOpen?"▲":"▼"}</span>
                                        </div>
                                      </div>
                                      <div style={{marginTop:6}}>
                                        <PBar value={proj.progress} color={proj.progress>=70?"#00C073":"#3182F6"} h={4}/>
                                        <span style={{fontSize:10.5,color:"#9CA3AF"}}>업무 {done.length}/{tasks.length}건 완료</span>
                                      </div>
                                    </div>
                                    {pOpen&&(
                                      <div style={{backgroundColor:"#FFFFFF",padding:"8px 12px"}}>
                                        {tasks.length===0&&<p style={{fontSize:12,color:"#D1D5DB",margin:0}}>등록된 업무가 없어요</p>}
                                        {tasks.map(task=>{const st=STATUS_MAP[task.status];return(
                                          <div key={task.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #F2F4F6"}}>
                                            <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:st.color,flexShrink:0}}/>
                                            <span style={{fontSize:12,color:task.status==="done"?"#9CA3AF":"#1F2937",flex:1,textDecoration:task.status==="done"?"line-through":"none"}}>{task.title}</span>
                                            <span style={{fontSize:10,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"1px 6px",borderRadius:6,flexShrink:0}}>{st.label}</span>
                                          </div>
                                        );})}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={()=>openNewSub(mk.id)} style={{width:"100%",marginTop:8,padding:"9px 0",borderRadius:9,border:"1.5px dashed #C4B5FD",background:"#F5F3FF",color:"#7C3AED",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ 지표·채널 추가</button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={openNewMain} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"1.5px dashed #93C5FD",background:"#EFF6FF",color:"#2563EB",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ 메인KPI 추가</button>
          <ExportPanel D={D} up={up}/>
        </div>
      )}
      {kpiView==="mindmap"&&(
        <div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14,padding:"10px 14px",backgroundColor:"#FFFFFF",borderRadius:12,border:"1px solid #F2F4F6"}}>
            {D.users.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:5}}><Ava name={u.name} color={u.color} size={16}/><span style={{fontSize:11,color:"#4B5563",fontWeight:600}}>{u.name}</span></div>)}
          </div>
          {D.mainKPIs.map(mk=>{
            const col=krColors[mk.id]||"#3182F6";
            const mkProjs=D.projects.filter(p=>p.mainKPIId===mk.id);
            const skIds=[...new Set(mkProjs.map(p=>p.subKPIId).filter(Boolean))];
            const sks=skIds.map(id=>D.subKPIs.find(s=>s.id===id)).filter(Boolean);
            const noSkProjs=mkProjs.filter(p=>!p.subKPIId);
            const p=pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue);
            return(
              <div key={mk.id} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:6}}>
                  <div style={{width:16,height:16,borderRadius:"50%",backgroundColor:col,flexShrink:0,boxShadow:`0 0 0 4px ${col}33`}}/>
                  <div style={{height:2,width:10,backgroundColor:col+"88"}}/>
                  <div style={{background:`linear-gradient(135deg,${col},${col}cc)`,borderRadius:10,padding:"8px 14px",flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:10,fontWeight:900,color:col,backgroundColor:"rgba(255,255,255,0.9)",padding:"1px 7px",borderRadius:10}}>{mk.krKey}</span>
                        <span style={{fontSize:13,fontWeight:900,color:"#FFFFFF"}}>{mk.title}</span>
                      </div>
                      <span style={{fontSize:14,fontWeight:900,color:"#FFFFFF"}}>{p}%</span>
                    </div>
                    <div style={{marginTop:6,height:4,borderRadius:4,backgroundColor:"rgba(255,255,255,0.3)",overflow:"hidden"}}>
                      <div style={{width:`${p}%`,height:"100%",backgroundColor:"#FFFFFF",borderRadius:4}}/>
                    </div>
                  </div>
                </div>
                <div style={{marginLeft:7,borderLeft:`2px solid ${col}55`}}>
                  {sks.map((sk,skIdx)=>{
                    const skProjs=mkProjs.filter(p=>p.subKPIId===sk.id);
                    const sp=pct(skCur(sk,D.projects),sk.targetValue);
                    const isLastSk=skIdx===sks.length-1&&noSkProjs.length===0;
                    return(
                      <div key={sk.id} style={{position:"relative",paddingLeft:20,marginBottom:10}}>
                        <div style={{position:"absolute",left:0,top:11,width:16,height:2,backgroundColor:col+"66"}}/>
                        <div style={{position:"absolute",left:0,top:0,width:2,height:isLastSk?"13px":"100%",backgroundColor:col+"44"}}/>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <div style={{width:11,height:11,borderRadius:"50%",backgroundColor:col+"99",flexShrink:0,border:`2px solid ${col}`}}/>
                          <div style={{backgroundColor:col+"18",borderRadius:8,padding:"5px 12px",border:`1px solid ${col}44`,flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <span style={{fontSize:11.5,fontWeight:800,color:col}}>{sk.channelCode} · {sk.title}</span>
                              <span style={{fontSize:11,fontWeight:900,color:sp>=50?"#00C073":"#FF9500"}}>{sp}%</span>
                            </div>
                            <div style={{height:3,borderRadius:3,backgroundColor:col+"22",overflow:"hidden"}}>
                              <div style={{width:`${sp}%`,height:"100%",backgroundColor:col,borderRadius:3}}/>
                            </div>
                          </div>
                        </div>
                        <div style={{marginLeft:6,borderLeft:`1.5px solid ${col}33`}}>
                          {skProjs.map((proj,pIdx)=>{
                            const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
                            const done=tasks.filter(t=>t.status==="done");
                            const assignee=D.users.find(u=>u.id===proj.assigneeId);
                            const colabs=(proj.collaboratorIds||[]).map(id=>D.users.find(u=>u.id===id)).filter(Boolean);
                            const isLastP=pIdx===skProjs.length-1;
                            return(
                              <div key={proj.id} style={{position:"relative",paddingLeft:18,marginBottom:6}}>
                                <div style={{position:"absolute",left:0,top:10,width:14,height:1.5,backgroundColor:col+"44"}}/>
                                <div style={{position:"absolute",left:0,top:0,width:1.5,height:isLastP?"12px":"100%",backgroundColor:col+"33"}}/>
                                <div style={{backgroundColor:"#FFFFFF",borderRadius:9,padding:"7px 12px",border:"1px solid #E5E8EB",marginBottom:4}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                                    <div style={{display:"flex",alignItems:"center",gap:3}}><Ava name={assignee?.name} color={assignee?.color} size={20}/>{colabs.map(u=><Ava key={u.id} name={u.name} color={u.color} size={16}/>)}</div>
                                    <span style={{fontSize:12,fontWeight:700,color:"#0F1F5C",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                                    <span style={{fontSize:11,fontWeight:900,color:proj.progress>=70?"#00C073":col,flexShrink:0}}>{proj.progress}%</span>
                                  </div>
                                  <div style={{height:3,borderRadius:3,backgroundColor:"#F2F4F6",overflow:"hidden"}}>
                                    <div style={{width:`${proj.progress}%`,height:"100%",backgroundColor:proj.progress>=70?"#00C073":col,borderRadius:3}}/>
                                  </div>
                                  {tasks.length>0&&(
                                    <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                                      {[{s:"inprogress",l:"진행중"},{s:"todo",l:"할일"},{s:"done",l:"완료"},{s:"hold",l:"보류"}].map(({s,l})=>{const cnt=tasks.filter(t=>t.status===s).length;if(cnt===0)return null;const st=STATUS_MAP[s];return <span key={s} style={{fontSize:9.5,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"1px 6px",borderRadius:6}}>{l} {cnt}</span>;})}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {noSkProjs.map((proj,pIdx)=>{
                    const assignee=D.users.find(u=>u.id===proj.assigneeId);
                    const isLastP=pIdx===noSkProjs.length-1;
                    return(
                      <div key={proj.id} style={{position:"relative",paddingLeft:20,marginBottom:6}}>
                        <div style={{position:"absolute",left:0,top:10,width:16,height:1.5,backgroundColor:col+"44"}}/>
                        <div style={{position:"absolute",left:0,top:0,width:2,height:isLastP?"12px":"100%",backgroundColor:col+"44"}}/>
                        <div style={{backgroundColor:"#FFFFFF",borderRadius:9,padding:"7px 12px",border:"1px solid #E5E8EB"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}><Ava name={assignee?.name} color={assignee?.color} size={20}/><span style={{fontSize:12,fontWeight:700,color:"#0F1F5C",flex:1}}>{proj.title}</span><span style={{fontSize:11,fontWeight:900,color:proj.progress>=70?"#00C073":col}}>{proj.progress}%</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {(()=>{
            const infraProjs=D.projects.filter(p=>!p.mainKPIId);
            if(infraProjs.length===0) return null;
            return(
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:6}}>
                  <div style={{width:16,height:16,borderRadius:"50%",backgroundColor:"#6B7280",flexShrink:0}}/>
                  <div style={{height:2,width:10,backgroundColor:"#9CA3AF"}}/>
                  <div style={{background:"linear-gradient(135deg,#4B5563,#374151)",borderRadius:10,padding:"8px 14px",flex:1}}>
                    <span style={{fontSize:13,fontWeight:900,color:"#FFFFFF"}}>⚙️ 운영 인프라</span>
                  </div>
                </div>
                <div style={{marginLeft:7,borderLeft:"2px solid #D1D5DB"}}>
                  {infraProjs.map((proj,pIdx)=>{
                    const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
                    const assignee=D.users.find(u=>u.id===proj.assigneeId);
                    const isLastP=pIdx===infraProjs.length-1;
                    return(
                      <div key={proj.id} style={{position:"relative",paddingLeft:20,marginBottom:6}}>
                        <div style={{position:"absolute",left:0,top:10,width:16,height:1.5,backgroundColor:"#D1D5DB"}}/>
                        <div style={{position:"absolute",left:0,top:0,width:2,height:isLastP?"12px":"100%",backgroundColor:"#D1D5DB"}}/>
                        <div style={{backgroundColor:"#FFFFFF",borderRadius:9,padding:"7px 12px",border:"1px solid #E5E8EB"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <Ava name={assignee?.name} color={assignee?.color} size={20}/>
                            <span style={{fontSize:12,fontWeight:700,color:"#0F1F5C",flex:1}}>{proj.title}</span>
                            <span style={{fontSize:11,fontWeight:900,color:proj.progress>=70?"#00C073":"#6B7280"}}>{proj.progress}%</span>
                          </div>
                          <div style={{height:3,borderRadius:3,backgroundColor:"#F2F4F6",overflow:"hidden"}}>
                            <div style={{width:`${proj.progress}%`,height:"100%",backgroundColor:proj.progress>=70?"#00C073":"#9CA3AF",borderRadius:3}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
      <Sheet open={salesOpen} onClose={()=>setSalesOpen(false)} title="💵 B2B 매출 입력" h="88vh">
        <div style={{marginTop:6}}>
          <p style={{margin:"0 0 12px",fontSize:12,color:"#6B7280",lineHeight:1.5}}>거래처유형별로 발생한 매출을 입력하세요. 입력하면 메인KPI·단가·거래처유형에 자동 반영돼요.</p>
          {D.subKPIs.filter(s=>s.mainKPIId==="mk2").map(sk=>{const ps=D.projects.filter(p=>p.subKPIId===sk.id);if(!ps.length)return null;const sub=ps.reduce((a,p)=>a+(p.resultValue||0),0);return(<div key={sk.id} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}><span style={{fontSize:12.5,fontWeight:900,color:"#8B5CF6"}}>{sk.channelCode} · {sk.title}</span><span style={{fontSize:11.5,fontWeight:800,color:"#374151"}}>{fmt(sub,"원")} / {fmt(sk.targetValue,"원")}</span></div>{ps.map(p=>{const dt=DT[p.dealerType];const sh=p.salesHistory||[];return(<div key={p.id} style={{padding:"9px 0",borderBottom:"1px solid #F2F4F6"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>{dt&&<span style={{fontSize:9.5,fontWeight:800,color:dt.color,backgroundColor:dt.color+"18",borderRadius:6,padding:"2px 6px",flexShrink:0,fontFamily:"'IBM Plex Mono',monospace"}}>{p.dealerType}</span>}<span style={{fontSize:12.5,fontWeight:700,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span></div><MoneyInput value={p.resultValue} compact onCommit={n=>setSale(p,n)}/>{(p.salesByName||sh.length>0)&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,paddingLeft:dt?44:0}}><span style={{fontSize:10,color:"#9CA3AF",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.salesByName?`${p.salesByName} · ${(p.salesAt||"").slice(0,10)}`:""}</span>{sh.length>0&&<button onClick={()=>setSalesHist(p)} style={{fontSize:10,fontWeight:800,color:"#8B5CF6",background:"#F3EFFE",border:"none",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>📜 이력 {sh.length}</button>}</div>}</div>);})}</div>);})}
          <button onClick={()=>setSalesOpen(false)} style={{width:"100%",marginTop:10,padding:"14px 0",borderRadius:14,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>완료</button>
        </div>
      </Sheet>
      <Sheet open={!!salesHist} onClose={()=>setSalesHist(null)} title="📜 매출 입력 이력">
        {salesHist&&(<div style={{marginTop:8}}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:900,color:"#0F1F5C"}}>{salesHist.title}</p>
          <p style={{margin:"0 0 12px",fontSize:11.5,color:"#9CA3AF"}}>현재 매출 {fmt(numF(salesHist.resultValue),"원")} · 총 {(salesHist.salesHistory||[]).length}회 기록</p>
          {[...(salesHist.salesHistory||[])].reverse().map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #F2F4F6"}}>
              <Ava name={h.byName} size={28}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {h.week&&<span style={{fontSize:10,fontWeight:800,color:"#3182F6",background:"#EBF3FF",padding:"1px 6px",borderRadius:6}}>{weekLabel(h.week)}</span>}
                  <span style={{fontSize:10,fontWeight:800,color:h.delta>=0?"#EA580C":"#DC2626",background:h.delta>=0?"#FFF1E7":"#FEECEC",padding:"1px 6px",borderRadius:6}}>{h.delta>=0?"▲":"▼"} {fmt(Math.abs(h.delta||0),"원")}</span>
                </div>
                <p style={{margin:"3px 0 0",fontSize:13,fontWeight:700,color:"#111827"}}>{fmt(h.prev||0,"원")} → <span style={{color:"#EA580C",fontWeight:900}}>{fmt(h.value||0,"원")}</span></p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{h.byName||"—"} · {(h.at||"").slice(0,16).replace("T"," ")}</p>
              </div>
            </div>
          ))}
          {(!salesHist.salesHistory||salesHist.salesHistory.length===0)&&<p style={{padding:"20px 0",textAlign:"center",fontSize:13,color:"#9CA3AF"}}>아직 매출 입력 이력이 없어요</p>}
        </div>)}
      </Sheet>
      <Sheet open={!!histItem} onClose={()=>setHistItem(null)} title="📜 주차별 실적 이력">
        {histItem&&(<div style={{marginTop:8}}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:900,color:"#0F1F5C"}}>{histItem.title}</p>
          <p style={{margin:"0 0 12px",fontSize:11.5,color:"#9CA3AF"}}>현재 {fmt(histItem.currentValue||0,histItem.unit)} · 총 {(histItem.valueHistory||[]).length}회 입력</p>
          {[...(histItem.valueHistory||[])].reverse().map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #F2F4F6"}}>
              <Ava name={h.byName} size={28}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {h.week&&<span style={{fontSize:10,fontWeight:800,color:"#3182F6",background:"#EBF3FF",padding:"1px 6px",borderRadius:6}}>{weekLabel(h.week)}</span>}
                  <span style={{fontSize:10,fontWeight:800,color:h.mode==="total"?"#8B5CF6":"#EA580C",background:h.mode==="total"?"#F3EFFE":"#FFF1E7",padding:"1px 6px",borderRadius:6}}>{h.mode==="total"?"총값":"추가"}{h.mode==="delta"&&h.amount!=null?` +${fmt(h.amount,histItem.unit)}`:""}</span>
                </div>
                <p style={{margin:"3px 0 0",fontSize:13,fontWeight:700,color:"#111827"}}>{fmt(h.prev||0,histItem.unit)} → <span style={{color:"#EA580C",fontWeight:900}}>{fmt(h.value||0,histItem.unit)}</span></p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{h.byName||"—"} · {(h.at||"").slice(0,16).replace("T"," ")}</p>
              </div>
            </div>
          ))}
          {(!histItem.valueHistory||histItem.valueHistory.length===0)&&<p style={{padding:"20px 0",textAlign:"center",fontSize:13,color:"#9CA3AF"}}>아직 입력 이력이 없어요</p>}
        </div>)}
      </Sheet>
      <Sheet open={!!valSheet} onClose={()=>setValSheet(null)} title="📊 이번 주 실적 입력">
        {valSheet&&(()=>{const it=valSheet.item;const prev=Number(it.currentValue||0);const amt=Number(valAmt)||0;const preview=valMode==="delta"?prev+amt:amt;return(
          <div style={{marginTop:8}}>
            <p style={{margin:"0 0 2px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>{it.title}</p>
            <p style={{margin:"0 0 14px",fontSize:11.5,color:"#9CA3AF"}}>현재 누계 {fmt(prev,it.unit)} / 목표 {fmt(it.targetValue,it.unit)}</p>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>주차</label>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <button onClick={()=>shiftWeek(-1)} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",cursor:"pointer",fontSize:15}}>◀</button>
              <div style={{flex:1,textAlign:"center",padding:"9px 0",borderRadius:10,background:"#F9FAFB",border:"1.5px solid #E5E8EB",fontSize:13.5,fontWeight:800,color:"#0F1F5C"}}>{weekLabel(valWeek)}{valWeek===weekKey()?" · 이번 주":""}</div>
              <button onClick={()=>shiftWeek(1)} disabled={valWeek>=weekKey()} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",cursor:valWeek>=weekKey()?"not-allowed":"pointer",opacity:valWeek>=weekKey()?0.4:1,fontSize:15}}>▶</button>
            </div>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>입력 방식</label>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[["delta","➕ 이번 주 추가값","이번 주 실적만 입력 → 누계에 더함"],["total","= 총값(누계)","현재 누계를 이 값으로 덮어씀"]].map(([k,l,d])=>(
                <button key={k} onClick={()=>setValMode(k)} style={{flex:1,padding:"11px 8px",borderRadius:11,border:`1.5px solid ${valMode===k?"#F97316":"#E5E8EB"}`,background:valMode===k?"#FFEDD5":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <p style={{margin:0,fontSize:12.5,fontWeight:800,color:valMode===k?"#EA580C":"#374151"}}>{l}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF",lineHeight:1.3}}>{d}</p>
                </button>
              ))}
            </div>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>{valMode==="delta"?"이번 주 실적":"누계 총값"} ({it.unit})</label>
            {it.unit==="원"?<MoneyInput value={valAmt===""?0:Number(valAmt)} live onCommit={n=>setValAmt(String(n))}/>:<input type="number" value={valAmt} onChange={e=>setValAmt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&valAmt!=="")applyVal();}} placeholder="0 (Enter로 저장)" autoFocus style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:16,fontWeight:800,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>}
            <div style={{margin:"12px 0 16px",padding:"11px 14px",borderRadius:12,background:"#F9FAFB",border:"1px solid #F2F4F6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:700}}>저장 후 누계</span>
              <span style={{fontSize:14,fontWeight:900,color:"#0F1F5C"}}>{fmt(prev,it.unit)} → <span style={{color:"#F97316"}}>{fmt(preview,it.unit)}</span> ({pct(preview,it.targetValue)}%)</span>
            </div>
            <Btn full variant="orange" onClick={applyVal} disabled={valAmt===""}>저장</Btn>
          </div>);})()}
      </Sheet>
      <Sheet open={!!cfg} onClose={()=>setCfg(null)} title={cfg&&!cfg.item?(cfg.kind==="main"?"+ 메인KPI 추가":"+ 지표·채널 추가"):"⚙ 이름·목표 수정"}>
        {cfg&&(()=>{const isNew=!cfg.item;const isB2Bsub=!isNew&&cfg.kind==="sub"&&cfg.item.mainKPIId==="mk2"&&cfg.item.unit==="원";return(
          <div style={{marginTop:8}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>이름</label>
            <input value={cfgForm.title} onChange={e=>setCfgForm({...cfgForm,title:e.target.value})} placeholder={cfg.kind==="sub"?"예: 신규채널 매출":"이름"} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>목표값 {cfg.kind!=="goal"&&`(${cfgForm.unit||(cfg.item&&cfg.item.unit)||""})`}</label>
            <input type="number" value={cfgForm.target} onChange={e=>setCfgForm({...cfgForm,target:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"&&cfgForm.title.trim())saveCfg();}} placeholder="예: 500000000" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:15,fontWeight:800,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:6}}/>
            <p style={{margin:"0 0 14px",fontSize:11,color:"#9CA3AF"}}>현재 입력: {fmt(numF(cfgForm.target),cfg.kind==="goal"?(cfg.item&&cfg.item.unit):cfgForm.unit)}</p>
            {cfg.kind!=="goal"&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>단위</label><input value={cfgForm.unit} onChange={e=>setCfgForm({...cfgForm,unit:e.target.value})} placeholder="원 / % / 건 / 모듈" style={{width:"100%",padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>}
            {!isNew&&cfg.kind!=="goal"&&!isB2Bsub&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>현재값 직접 수정 (선택)</label><input type="number" value={cfgForm.current} onChange={e=>setCfgForm({...cfgForm,current:e.target.value})} placeholder="비워두면 그대로" style={{width:"100%",padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/><p style={{margin:"5px 0 0",fontSize:10.5,color:"#9CA3AF"}}>임의로 들어간 현재값을 직접 고칠 때 사용 (이력엔 안 남음 — 주차별로 남기려면 📊 실적 입력)</p></div>}
            {isB2Bsub&&<p style={{margin:"0 0 14px",fontSize:11,color:"#9A3412",fontWeight:600,backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:"8px 10px"}}>※ 이 항목의 현재값은 <b>프로젝트 매출 합계로 자동</b>입니다. 값을 고치려면 거래처유형별 매출 ✏️입력에서 프로젝트 금액을 수정하세요.</p>}
            <Btn full variant="orange" onClick={saveCfg} disabled={!cfgForm.title.trim()}>{isNew?"추가":"저장"}</Btn>
            {!isNew&&cfg.kind!=="goal"&&<button onClick={()=>setKpiDel({coll:cfg.coll,item:cfg.item,kind:cfg.kind})} style={{width:"100%",marginTop:10,padding:"12px 0",borderRadius:12,border:"1px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 이 {cfg.kind==="main"?"메인KPI":"지표"} 삭제</button>}
          </div>);})()}
      </Sheet>
      <Confirm open={!!kpiDel} title={(kpiDel&&kpiDel.kind==="main")?"메인KPI 삭제":"지표 삭제"} desc={kpiDel?`"${kpiDel.item.title}" 삭제할까요?${kpiDel.kind==="main"?" 하위 지표·프로젝트의 연결이 끊어집니다.":" 연결된 프로젝트의 지표 연결이 끊어집니다."}`:""} onOk={doKpiDel} onCancel={()=>setKpiDel(null)}/>
    </div>
  );
}
function ProjectsPage({D,cu,up,add,rm,pc,lead,nav}){
  const [filter,setFilter]=useState("mine");
  const [groupFilter,setGroupFilter]=useState("all");
  const [pview,setPview]=useState("list");   // list | launch (출시는 프로젝트 하위)
  const [projDetail,setProjDetail]=useState(null);
  const [stagePick,setStagePick]=useState(null);   // 단계 흐름 적용 대상 프로젝트
  const tpls=D.launchTemplates||[];
  const [taskForm,setTaskForm]=useState({title:"",status:"todo",dueDate:"",memo:""});
  const [addTaskSheet,setAddTaskSheet]=useState(false);
  const [confirmTaskId,setConfirmTaskId]=useState(null);
  const [editTask,setEditTask]=useState(null);
  const [addProjSheet,setAddProjSheet]=useState(false);
  const [search,setSearch]=useState("");
  const [asgFilter,setAsgFilter]=useState("all");
  const [actForm,setActForm]=useState({name:"",unit:"건",target:""});
  const [actMode,setActMode]=useState("delta");   // delta(이번주 추가) | total(누계 직접)
  const [actHist,setActHist]=useState(null);   // 활동지표 이력 {proj,ak}
  const [actEdit,setActEdit]=useState(null);   // 목표지표 수정 {proj,ak}
  const [actAddOpen,setActAddOpen]=useState(null);   // 지표 추가폼 펼친 프로젝트
  const actAddIndicator=(proj)=>{ if(!actForm.name.trim())return; const list=[...(proj.activityKPIs||[]),{id:"ak"+Date.now(),name:actForm.name.trim(),unit:actForm.unit||"건",target:Number(actForm.target)||0,current:0,history:[]}]; up("projects",proj.id,{activityKPIs:list}); setActForm({name:"",unit:"건",target:""}); };
  const actRecord=(proj,ak,raw)=>{ const amt=Number(raw); if(isNaN(amt))return; const prev=Number(ak.current||0); const v=actMode==="delta"?prev+amt:amt; const at=new Date().toISOString(); const week=weekKey(); const list=(proj.activityKPIs||[]).map(x=>x.id===ak.id?{...x,current:v,week,by:cu?.id||null,byName:cu?.name||"",history:[...(x.history||[]),{week,value:v,amount:amt,mode:actMode,by:cu?.id||null,byName:cu?.name||"",at}]}:x); up("projects",proj.id,{activityKPIs:list}); };
  const actRemove=(proj,ak)=>up("projects",proj.id,{activityKPIs:(proj.activityKPIs||[]).filter(x=>x.id!==ak.id)});
  // 목표지표 수정(이름·단위·목표값) + 변경분 수정이력 기록
  const actSaveEdit=(proj,ak,f)=>{
    const name=(f.name||"").trim()||ak.name;
    const unit=(f.unit||"").trim()||ak.unit||"건";
    const tgt=f.target===""||isNaN(Number(f.target))?numF(ak.target):Number(f.target);
    const at=new Date().toISOString(); const by=cu?.id||null,byName=cu?.name||"";
    const edits=[...(ak.edits||[])];
    if(name!==ak.name) edits.push({at,by,byName,field:"이름",from:ak.name,to:name});
    if(unit!==(ak.unit||"건")) edits.push({at,by,byName,field:"단위",from:ak.unit||"건",to:unit});
    if(tgt!==numF(ak.target)) edits.push({at,by,byName,field:"목표",from:numF(ak.target),to:tgt});
    const list=(proj.activityKPIs||[]).map(x=>x.id===ak.id?{...x,name,unit,target:tgt,edits}:x);
    up("projects",proj.id,{activityKPIs:list}); setActEdit(null);
  };
  const [editProjId,setEditProjId]=useState(null);
  const [projDel,setProjDel]=useState(null);
  const [showAdv,setShowAdv]=useState(false);
  const [projForm,setProjForm]=useState({title:"",goalType:"journey",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high"});
  const [metric,setMetric]=useState({name:"",target:"",unit:"개"});
  const resetProjForm=()=>{setProjForm({title:"",goalType:"journey",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high"});setMetric({name:"",target:"",unit:"개"});};
  const openEditProj=(p)=>{ setProjForm({title:p.title||"",goalType:p.goalType||(p.mainKPIId==="mk2"||p.resultValue?"revenue":"journey"),mainKPIId:p.mainKPIId||"",subKPIId:p.subKPIId||"",dealerType:p.dealerType||"",assigneeId:p.assigneeId||cu.id,collaboratorIds:p.collaboratorIds||[],group:p.group||"",priority:p.priority||"mid"}); setMetric({name:"",target:"",unit:"개"}); setEditProjId(p.id); setShowAdv(true); setAddProjSheet(true); };
  const doAddProj=()=>{
    if(!projForm.title.trim()) return;
    if(editProjId){ up("projects",editProjId,{...projForm}); }
    else {
      const proj={id:"p"+Date.now(),...projForm,status:"active",progress:0,resultValue:0};
      if(projForm.goalType==="metric"&&metric.name.trim()) proj.activityKPIs=[{id:"ak"+Date.now(),name:metric.name.trim(),unit:metric.unit||"개",target:numF(metric.target),current:0,history:[]}];
      add("projects",proj);
    }
    resetProjForm(); setEditProjId(null); setShowAdv(false); setAddProjSheet(false);
  };
  const availSKs=D.subKPIs.filter(sk=>sk.mainKPIId===projForm.mainKPIId);
  const toggleColab=(uid)=>{const list=projForm.collaboratorIds;setProjForm({...projForm,collaboratorIds:list.includes(uid)?list.filter(x=>x!==uid):[...list,uid]});};
  // 예시(데모) 프로젝트 — 초기 시드는 id가 p+짧은숫자(p001 등), 직접 만든 건 p+타임스탬프(13자리)라 구분 가능
  const demoProjs=D.projects.filter(p=>/^p\d{1,4}$/.test(p.id));
  const cleanupDemo=()=>{
    if(!demoProjs.length) return;
    if(!window.confirm(`예시(데모) 프로젝트 ${demoProjs.length}개와 그 업무를 삭제할까요?\n내가 직접 만든 프로젝트는 그대로 남습니다.\n(되돌리려면 KPI ▸ 데이터 추출의 백업 사용)`)) return;
    const ids=new Set(demoProjs.map(p=>p.id));
    D.tasks.filter(t=>ids.has(t.projectId)).forEach(t=>rm("tasks",t.id));
    demoProjs.forEach(p=>rm("projects",p.id));
    setProjDetail(null);
  };
  const projs=filter==="all"?D.projects:D.projects.filter(p=>p.assigneeId===cu.id);
  const groups=[...new Set(projs.map(p=>p.group))];
  const filtered=projs.filter(p=>(groupFilter==="all"||p.group===groupFilter)&&(asgFilter==="all"||p.assigneeId===asgFilter)&&(!search.trim()||(p.title||"").toLowerCase().includes(search.trim().toLowerCase())));
  const dlCSV=(rows,name)=>{
    const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    const a=document.createElement("a");a.href=url;a.download=`${name}_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };
  const exportCSV=()=>{
    const goalTypeL={revenue:"매출",metric:"수치목표",journey:"여정"};
    const rows=[["제목","그룹","담당자","목표유형","거래처유형","메인KPI","서브KPI","우선순위","상태","진척도%","진척방식","업무(완료/전체)","매출(원)","매출입력자","매출최종일","매출입력횟수","목표지표"]];
    filtered.forEach(p=>{
      const a=D.users.find(u=>u.id===p.assigneeId);const mk=D.mainKPIs.find(m=>m.id===p.mainKPIId);const sk=D.subKPIs.find(s=>s.id===p.subKPIId);
      const ts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);const dn=ts.filter(t=>t.status==="done").length;
      const aks=(p.activityKPIs||[]).map(ak=>`${ak.name} ${numF(ak.current)}/${numF(ak.target)}${ak.unit||""}`).join(" · ");
      rows.push([p.title,p.group||"",a?.name||"",goalTypeL[p.goalType]||"",p.dealerType||"",mk?.title||"",sk?.title||"",p.priority||"",p.status||"",p.progress||0,p.progressManual?"수동":"자동",`${dn}/${ts.length}`,p.resultValue||0,p.salesByName||"",(p.salesAt||"").slice(0,10),(p.salesHistory||[]).length,aks]);
    });
    dlCSV(rows,"프로젝트");
  };
  const exportSalesCSV=()=>{
    const rows=[["일시","주차","프로젝트","거래처유형","메인KPI","서브KPI","이전매출","변동","매출(원)","입력자"]];
    filtered.forEach(p=>{const mk=D.mainKPIs.find(m=>m.id===p.mainKPIId);const sk=D.subKPIs.find(s=>s.id===p.subKPIId);(p.salesHistory||[]).forEach(h=>{rows.push([(h.at||"").slice(0,16).replace("T"," "),h.week||"",p.title,p.dealerType||"",mk?.title||"",sk?.title||"",numF(h.prev),numF(h.delta),numF(h.value),h.byName||""]);});});
    if(rows.length===1){ alert("매출 입력 이력이 없어요"); return; }
    dlCSV(rows,"매출이력");
  };
  const projTasks=projDetail?D.tasks.filter(t=>t.projectId===projDetail.id&&!t.isFixed):[];
  const statusGroups={inprogress:projTasks.filter(t=>t.status==="inprogress"),todo:projTasks.filter(t=>t.status==="todo"),hold:projTasks.filter(t=>t.status==="hold"),done:projTasks.filter(t=>t.status==="done")};
  const doAddTask=()=>{
    if(!taskForm.title.trim()) return;
    add("tasks",{id:"t"+Date.now(),...taskForm,projectId:projDetail.id,assigneeId:cu.id,isFixed:false,weekDay:null,weekSlot:null,attachments:[]});
    setTaskForm({title:"",status:"todo",dueDate:"",memo:""});setAddTaskSheet(false);
  };
  const ST=STATUS_MAP;
  const pTabs=(
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["list","▦ 프로젝트"],["launch","🚀 출시"]].map(([k,l])=>(
        <button key={k} onClick={()=>setPview(k)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",backgroundColor:pview===k?"#0F1F5C":"#F2F4F6",color:pview===k?"#fff":"#374151",fontWeight:800,fontSize:13,fontFamily:"inherit"}}>{l}</button>
      ))}
    </div>
  );
  if(pview==="launch") return(<div><div style={{padding:"14px 16px 0"}}>{pTabs}</div><LaunchPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/></div>);
  return(
    <div style={{padding:"14px 16px 20px"}}>
      {pTabs}
      {demoProjs.length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:10,backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"11px 13px",marginBottom:12}}>
          <span style={{fontSize:18}}>🧹</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#9A3412"}}>예시(데모) 프로젝트 {demoProjs.length}개가 섞여 있어요</p>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#B45309"}}>내가 직접 만든 프로젝트는 유지됩니다</p>
          </div>
          <button onClick={cleanupDemo} style={{flexShrink:0,padding:"8px 13px",borderRadius:9,border:"none",backgroundColor:"#EA580C",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>예시 전부 삭제</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        {[{k:"mine",l:"내 프로젝트"},{k:"all",l:"전체 ("+D.projects.length+")"}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"8px 16px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:filter===f.k?"#0F1F5C":"#F2F4F6",color:filter===f.k?"#FFFFFF":"#374151",fontWeight:700,fontSize:12.5,fontFamily:"inherit"}}>{f.l}</button>
        ))}
        <button onClick={()=>{setShowAdv(false);setAddProjSheet(true);}} style={{marginLeft:"auto",flexShrink:0,padding:"8px 14px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:"#F97316",color:"#FFFFFF",fontWeight:700,fontSize:12.5,fontFamily:"inherit"}}>+ 프로젝트</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 프로젝트 검색" style={{flex:1,minWidth:0,padding:"8px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,outline:"none",fontFamily:"inherit",backgroundColor:"#F9FAFB",boxSizing:"border-box"}}/>
        <select value={asgFilter} onChange={e=>setAsgFilter(e.target.value)} style={{flexShrink:0,padding:"8px 10px",borderRadius:9,border:`1.5px solid ${asgFilter!=="all"?"#F97316":"#E5E8EB"}`,fontSize:12,fontFamily:"inherit",backgroundColor:asgFilter!=="all"?"#FFEDD5":"#F9FAFB",color:asgFilter!=="all"?"#0F1F5C":"#6B7280",WebkitAppearance:"none",outline:"none"}}><option value="all">👤 전체</option>{D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button onClick={exportCSV} title="프로젝트 전체를 CSV로 내보내기" style={{flexShrink:0,padding:"8px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:"#4B5563",fontFamily:"inherit"}}>⬇ CSV</button>
        <button onClick={exportSalesCSV} title="매출 입력 이력을 CSV로 내보내기" style={{flexShrink:0,padding:"8px 12px",borderRadius:9,border:"1.5px solid #FED7AA",background:"#FFF7ED",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EA580C",fontFamily:"inherit"}}>⬇ 매출이력</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setGroupFilter("all")} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:groupFilter==="all"?"#F97316":"#F2F4F6",color:groupFilter==="all"?"#FFFFFF":"#374151",fontWeight:600,fontSize:11,fontFamily:"inherit"}}>전체</button>
        {groups.map(g=><button key={g} onClick={()=>{setGroupFilter(g);setProjDetail(null);}} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:groupFilter===g?"#F97316":"#F2F4F6",color:groupFilter===g?"#FFFFFF":"#374151",fontWeight:600,fontSize:11,fontFamily:"inherit"}}>{g}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:pc?"row":"column",flexWrap:pc?"wrap":"nowrap",gap:12,alignItems:"flex-start"}}>
        {filtered.map(proj=>{
          const expanded=projDetail?.id===proj.id;
          const assignee=D.users.find(u=>u.id===proj.assigneeId);
          const mk=D.mainKPIs.find(m=>m.id===proj.mainKPIId);
          const sk=D.subKPIs.find(s=>s.id===proj.subKPIId);
          const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
          const col=krColors[proj.mainKPIId]||"#3182F6";
          const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
          const done=tasks.filter(t=>t.status==="done");
          const inprog=tasks.filter(t=>t.status==="inprogress");
          const hold=tasks.filter(t=>t.status==="hold");
          const pColor=proj.priority==="high"?"#F04452":proj.priority==="mid"?"#FF9500":"#9CA3AF";
          return(
            <div key={proj.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6",overflow:"hidden",width:pc?(expanded?"100%":"calc(50% - 6px)"):"100%",boxSizing:"border-box"}}>
              <div onClick={()=>setProjDetail(projDetail?.id===proj.id?null:proj)} style={{padding:"15px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                      {sk&&<Badge color={col} bg={col+"18"}>{mk?.krKey?mk.krKey+" · ":""}{sk.channelCode}</Badge>}
                      {!sk&&mk&&<Badge color="#3182F6" bg="#EBF3FF">{mk.krKey}</Badge>}
                      {proj.goalType&&GOAL_TYPE[proj.goalType]&&<Badge color={GOAL_TYPE[proj.goalType].c} bg={GOAL_TYPE[proj.goalType].bg}>{GOAL_TYPE[proj.goalType].l}</Badge>}
                      {proj.dealerType&&DT[proj.dealerType]&&<Badge color={DT[proj.dealerType].color} bg={DT[proj.dealerType].color+"18"}>🏷 {proj.dealerType}</Badge>}
                      <Badge color={pColor} bg={pColor+"18"}>{proj.priority==="high"?"🔴 높음":proj.priority==="mid"?"🟡 중간":"🟢 낮음"}</Badge>
                    </div>
                    <h4 style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:"#0F1F5C"}}>{proj.title}</h4>
                    {sk&&<p style={{margin:"0 0 2px",fontSize:11,color:"#6B7280"}}>{mk?.title?mk.title+" › ":""}{sk.title}</p>}
                    <p style={{margin:0,fontSize:11,color:"#9CA3AF"}}>{proj.group}</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <Ava name={assignee?.name} color={assignee?.color} size={28}/>
                      {(proj.collaboratorIds||[]).map(cid=>{const cu2=D.users.find(u=>u.id===cid);return cu2?<Ava key={cid} name={cu2.name} color={cu2.color} size={22}/>:null;})}
                    </div>
                    <span style={{fontSize:12,color:"#9CA3AF"}}>{projDetail?.id===proj.id?"▲":"▼"}</span>
                  </div>
                </div>
                <div style={{marginTop:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11.5,color:"#9CA3AF"}}>완료 {done.length}/{tasks.length}건{inprog.length>0&&<span style={{color:"#3182F6",marginLeft:6}}>진행중 {inprog.length}</span>}{hold.length>0&&<span style={{color:"#FF9500",marginLeft:6}}>보류 {hold.length}</span>}</span>
                    <span style={{fontSize:13,fontWeight:900,color:proj.progress>=70?"#00C073":"#3182F6"}}>{proj.progress}%</span>
                  </div>
                  <PBar value={proj.progress} color={proj.progress>=70?"#00C073":"#3182F6"} h={7}/>{proj.mainKPIId==="mk2"&&<div style={{marginTop:7,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",backgroundColor:proj.resultValue>0?"#FFF7ED":"#F9FAFB",borderRadius:8}}><span style={{fontSize:10.5,fontWeight:700,color:"#9CA3AF"}}>💵 매출 성과 (결과)</span><span style={{fontSize:12.5,fontWeight:900,color:proj.resultValue>0?"#EA580C":"#D1D5DB"}}>{fmt(proj.resultValue||0,"원")}</span></div>}
                </div>
              </div>
              {projDetail?.id===proj.id&&(
                <div style={{borderTop:"1px solid #F2F4F6",backgroundColor:"#F9FAFB"}}>
                  {(()=>{const rows=projContrib(D,proj);const max=Math.max(...rows.map(r=>r.total),1);return(
                    <div style={{padding:"12px 16px 0"}}>
                      {rows.length>0&&<div style={{marginTop:8}}>
                        <p style={{margin:"0 0 6px",fontSize:11.5,fontWeight:800,color:"#4B5563"}}>👥 기여 현황 <span style={{fontWeight:600,color:"#9CA3AF"}}>(완료 업무·매출·지표 기록 기준)</span></p>
                        {rows.map(r=>{const u=D.users.find(x=>x.id===r.uid);const w=Math.round(r.total/max*100);const isMe=r.uid===cu.id;return(
                          <div key={r.uid} style={{marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><Ava name={u?.name} color={u?.color} size={18}/><span style={{fontSize:11,fontWeight:700,color:isMe?"#EA580C":"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u?.name||"?"}{isMe?" (나)":""}</span><span style={{fontSize:10,color:"#9CA3AF",flexShrink:0}}>업무{r.task}·매출{r.sales}·지표{r.act}</span></div>
                            <div style={{height:5,borderRadius:5,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:`${w}%`,height:"100%",background:isMe?"#F97316":"#9CA3AF",borderRadius:5}}/></div>
                          </div>
                        );})}
                      </div>}
                    </div>
                  );})()}
                  <ProjStageFlow D={D} proj={proj} cu={cu} up={up} onPick={(p)=>setStagePick(p)}/>
                  <div style={{padding:"12px 16px 0",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#4B5563",flexShrink:0}}>🏷 거래처유형</span>
                    <select value={proj.dealerType||""} onChange={e=>up("projects",proj.id,{dealerType:e.target.value})} style={{flex:1,padding:"7px 10px",borderRadius:8,fontSize:12,fontWeight:700,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",color:proj.dealerType?(DT[proj.dealerType]?.color||"#111827"):"#9CA3AF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label} ({d.price})</option>)}</select>
                  </div>
                  <div style={{padding:"12px 16px 0"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span style={{fontSize:12,fontWeight:800,color:"#4B5563"}}>🎯 숫자로 세는 목표 <span style={{fontWeight:600,color:"#9CA3AF"}}>(매출 빼고)</span></span>
                      <div style={{display:"inline-flex",borderRadius:7,border:"1px solid #E5E8EB",overflow:"hidden"}}>{[["delta","➕추가"],["total","=총값"]].map(([k,l])=>(<button key={k} onClick={()=>setActMode(k)} style={{padding:"3px 8px",fontSize:10.5,fontWeight:700,border:"none",cursor:"pointer",backgroundColor:actMode===k?"#8B5CF6":"#fff",color:actMode===k?"#fff":"#9CA3AF",fontFamily:"inherit"}}>{l}</button>))}</div>
                    </div>
                    {(proj.activityKPIs||[]).map(ak=>{const p2=pct(ak.current||0,ak.target||0);return(
                      <div key={ak.id} style={{backgroundColor:"#FFFFFF",borderRadius:10,padding:"9px 11px",marginTop:7,border:"1px solid #E5E8EB"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,gap:8}}>
                          <span style={{fontSize:12,fontWeight:700,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ak.name}</span>
                          <span style={{fontSize:11,fontWeight:800,color:"#8B5CF6",flexShrink:0}}>{fmt(ak.current||0,ak.unit)} / {fmt(ak.target||0,ak.unit)}</span>
                        </div>
                        <PBar value={p2} color="#8B5CF6" h={5}/>
                        <div style={{display:"flex",gap:6,marginTop:7,alignItems:"center"}}>
                          <input type="number" placeholder={actMode==="delta"?"한 값 입력 → 누적+":"누적 총값 입력"} onKeyDown={e=>{if(e.key==="Enter"&&e.target.value!==""){actRecord(proj,ak,e.target.value);e.target.value="";}}} onBlur={e=>{if(e.target.value!==""){actRecord(proj,ak,e.target.value);e.target.value="";}}} style={{flex:1,minWidth:0,padding:"6px 9px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                          {ak.history&&ak.history.length>0&&<button onClick={()=>setActHist({proj,ak})} style={{flexShrink:0,padding:"5px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 {ak.history.length}</button>}
                          <button onClick={()=>setActEdit({proj,ak})} title="목표 수정" style={{flexShrink:0,background:"none",border:"none",fontSize:13,color:"#8B5CF6",cursor:"pointer",padding:8}}>✎</button>
                          <button onClick={()=>actRemove(proj,ak)} style={{flexShrink:0,background:"none",border:"none",fontSize:13,color:"#D1D5DB",cursor:"pointer",padding:8}}>🗑</button>
                        </div>
                        {ak.byName&&<p style={{margin:"5px 0 0",fontSize:10,color:"#9CA3AF"}}>👤 {ak.byName} · {weekLabel(ak.week||weekKey())} 입력</p>}
                      </div>
                    );})}
                    {actAddOpen===proj.id?(<>
                      <div style={{display:"flex",gap:4,marginTop:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:10.5,color:"#9CA3AF",fontWeight:700,alignSelf:"center"}}>예시 ▸</span>
                        {[["상품등록","개",100],["견적발송","건",50],["콘텐츠","개",30],["전화상담","건",40],["입점제안","건",20]].map(([nm,un,tg])=>(
                          <button key={nm} onClick={()=>setActForm({name:nm,unit:un,target:String(tg)})} style={{padding:"4px 9px",borderRadius:14,border:"1px solid #EDE9FE",background:"#F5F3FF",fontSize:10.5,fontWeight:700,color:"#7C3AED",cursor:"pointer",fontFamily:"inherit"}}>{nm} {tg}{un}</button>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:5,marginTop:7}}>
                        <input value={actForm.name} onChange={e=>setActForm({...actForm,name:e.target.value})} placeholder="무엇을 셀까요? (예: 상품등록)" style={{flex:1,minWidth:0,padding:"7px 9px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                        <input value={actForm.unit} onChange={e=>setActForm({...actForm,unit:e.target.value})} placeholder="단위" style={{width:48,padding:"7px 6px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
                        <input type="number" value={actForm.target} onChange={e=>setActForm({...actForm,target:e.target.value})} placeholder="목표" style={{width:60,padding:"7px 6px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
                        <button onClick={()=>actAddIndicator(proj)} disabled={!actForm.name.trim()} style={{flexShrink:0,width:34,borderRadius:8,border:"none",backgroundColor:actForm.name.trim()?"#8B5CF6":"#E5E8EB",color:"#fff",fontSize:17,fontWeight:900,cursor:actForm.name.trim()?"pointer":"not-allowed"}}>+</button>
                      </div>
                      <button onClick={()=>setActAddOpen(null)} style={{marginTop:6,fontSize:11,fontWeight:700,color:"#9CA3AF",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>닫기</button>
                    </>):(
                      <button onClick={()=>setActAddOpen(proj.id)} style={{width:"100%",marginTop:10,padding:"8px 0",borderRadius:9,border:"1.5px dashed #DDD6FE",background:"#FAF9FF",fontSize:12,fontWeight:800,color:"#7C3AED",cursor:"pointer",fontFamily:"inherit"}}>＋ 지표 추가</button>
                    )}
                  </div>
                  <div style={{padding:"14px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#4B5563"}}>업무 목록 ({tasks.length}건)</span>
                    <button onClick={()=>setAddTaskSheet(true)} style={{padding:"6px 12px",borderRadius:10,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 업무 추가</button>
                  </div>
                  {tasks.length===0&&<div style={{padding:"20px",textAlign:"center"}}><p style={{margin:0,fontSize:13,color:"#D1D5DB"}}>등록된 업무가 없어요</p></div>}
                  {[{key:"inprogress",label:"진행중",list:statusGroups.inprogress,st:ST.inprogress},{key:"todo",label:"할일",list:statusGroups.todo,st:ST.todo},{key:"hold",label:"보류",list:statusGroups.hold,st:ST.hold},{key:"done",label:"완료",list:statusGroups.done,st:ST.done}].map(({key,label,list,st})=>list.length===0?null:(
                    <div key={key} style={{padding:"10px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:st.color,flexShrink:0}}/>
                        <span style={{fontSize:11.5,fontWeight:800,color:st.color}}>{label}</span>
                        <span style={{fontSize:11,color:"#9CA3AF",marginLeft:2}}>{list.length}건</span>
                      </div>
                      {list.map(task=>{
                        const taskUser=D.users.find(u=>u.id===task.assigneeId);
                        return(
                          <div key={task.id} style={{backgroundColor:"#FFFFFF",borderRadius:12,padding:"11px 12px",marginBottom:6,border:"1px solid #E5E8EB"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <button onClick={e=>{e.stopPropagation();up("tasks",task.id,{status:task.status==="done"?"todo":"done"});}} style={{width:20,height:20,borderRadius:5,border:`2px solid ${task.status==="done"?"#00C073":"#D1D5DB"}`,backgroundColor:task.status==="done"?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                                {task.status==="done"&&<span style={{color:"#FFFFFF",fontSize:11,fontWeight:900}}>✓</span>}
                              </button>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{margin:0,fontSize:13,fontWeight:700,color:task.status==="done"?"#9CA3AF":"#111827",textDecoration:task.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</p>
                                <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                                  {task.dueDate&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>📅 {task.dueDate}</span>}
                                  {task.memo&&<span style={{fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:100}}>💬 {task.memo}</span>}
                                </div>
                              </div>
                              <select value={task.status} onChange={e=>up("tasks",task.id,{status:e.target.value})} style={{border:"1px solid #E5E8EB",borderRadius:8,fontSize:11,color:st.color,backgroundColor:st.bg,cursor:"pointer",fontFamily:"inherit",fontWeight:700,padding:"3px 6px",outline:"none",WebkitAppearance:"none"}}>
                                {Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                              </select>
                              <button onClick={e=>{e.stopPropagation();setEditTask(task);}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#9CA3AF",padding:2,flexShrink:0}}>✎</button>
                              <button onClick={e=>{e.stopPropagation();setConfirmTaskId(task.id);}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#D1D5DB",padding:2,flexShrink:0}}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{padding:"10px 16px 14px",borderTop:"1px solid #E5E8EB",display:"flex",alignItems:"center",gap:8}}><div style={{display:"flex",alignItems:"center",gap:6,marginRight:"auto",flexWrap:"wrap"}}><span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>진척</span>{proj.progressManual?(<><button onClick={()=>up("projects",proj.id,{progress:Math.max(0,(proj.progress||0)-10),progressManual:true})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>−</button><span style={{fontSize:13,fontWeight:800,color:"#3182F6",minWidth:40,textAlign:"center"}}>{proj.progress}%</span><button onClick={()=>up("projects",proj.id,{progress:Math.min(100,(proj.progress||0)+10),progressManual:true})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>＋</button><button onClick={()=>{const auto=tasks.length?Math.round(done.length/tasks.length*100):(proj.progress||0);up("projects",proj.id,{progressManual:false,progress:auto});}} title="업무 완료율로 자동 산출" style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#8B5CF6",cursor:"pointer",fontFamily:"inherit"}}>🔄 자동전환</button></>):(<><span style={{fontSize:13,fontWeight:800,color:"#3182F6",minWidth:40,textAlign:"center"}}>{proj.progress}%</span><span style={{fontSize:10,fontWeight:700,color:"#00C073",background:"#E8FAF1",padding:"3px 7px",borderRadius:7}}>🔄 자동 · 업무 {done.length}/{tasks.length}</span><button onClick={()=>up("projects",proj.id,{progressManual:true})} title="진척을 직접 조정" style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>✎ 수동</button></>)}</div>
                    <button onClick={()=>openEditProj(proj)} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",color:"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✎ 편집</button>
                    {proj.status!=="active"&&<button onClick={()=>up("projects",proj.id,{status:"active"})} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #3182F6",backgroundColor:"#EBF3FF",color:"#3182F6",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>▶ 재개</button>}
                    {proj.status!=="completed"&&<button onClick={()=>up("projects",proj.id,{status:"completed",progress:100,progressManual:true})} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #00C073",backgroundColor:"#E8FAF1",color:"#00C073",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ 완료</button>}
                    {proj.status!=="paused"&&<button onClick={()=>up("projects",proj.id,{status:"paused"})} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:"#F2F4F6",color:"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏸ 보류</button>}
                    <button onClick={()=>setProjDel(proj.id)} title="프로젝트 삭제" style={{padding:"6px 10px",borderRadius:10,border:"1px solid #FFE2E5",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0&&<div style={{padding:"40px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}><p style={{fontSize:38,margin:"0 0 10px"}}>🗂️</p><p style={{fontSize:14,color:"#9CA3AF"}}>프로젝트가 없어요</p></div>}
      </div>
      <Sheet open={!!stagePick} onClose={()=>setStagePick(null)} title="🔗 단계 흐름 적용">
        {stagePick&&(<div style={{marginTop:8}}>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#6B7280",lineHeight:1.6,backgroundColor:"#F9FAFB",borderRadius:10,padding:"10px 12px"}}><b>{stagePick.title}</b>에 적용할 템플릿을 고르세요. 단계 업무가 담당자·인계 순서까지 자동 생성됩니다.</p>
          {tpls.length===0?(
            <Btn full variant="orange" onClick={()=>add("launchTemplates",{...INIT.launchTemplates[0],createdAt:new Date().toISOString()})}>기본 템플릿 먼저 만들기</Btn>
          ):tpls.map(t=>(
            <button key={t.id} onClick={()=>{applyTemplateToProject({tpl:t,proj:stagePick,add,up});setStagePick(null);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"13px 14px",borderRadius:12,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",marginBottom:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{fontSize:13.5,fontWeight:800,color:"#0F1F5C"}}>🧩 {t.name}</span>
              <span style={{fontSize:11.5,fontWeight:700,color:"#EA580C",flexShrink:0}}>{t.nodes.length}단계 →</span>
            </button>
          ))}
          <p style={{margin:"6px 2px 0",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>템플릿 편집·복제는 <b>🚀 출시 → 템플릿</b> 탭에서 합니다.</p>
        </div>)}
      </Sheet>
      <Sheet open={addTaskSheet} onClose={()=>setAddTaskSheet(false)} title="업무 추가" h="75vh">
        <div style={{marginTop:10}}>
          {projDetail&&<div style={{backgroundColor:"#EBF3FF",borderRadius:10,padding:"8px 12px",marginBottom:14}}><p style={{margin:0,fontSize:12,fontWeight:700,color:"#3182F6"}}>📁 {projDetail.title}</p></div>}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>업무명 *</label><input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&doAddTask()} placeholder="업무 내용을 입력하세요" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>초기 상태</label><select value={taskForm.status} onChange={e=>setTaskForm({...taskForm,status:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>마감일 (선택)</label><input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:18}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메모 (선택)</label><textarea value={taskForm.memo} onChange={e=>setTaskForm({...taskForm,memo:e.target.value})} placeholder="메모..." style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"vertical",minHeight:72,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/></div>
          <button onClick={doAddTask} disabled={!taskForm.title.trim()} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:taskForm.title.trim()?"#F97316":"#E5E8EB",color:taskForm.title.trim()?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:taskForm.title.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>추가하기</button>
        </div>
      </Sheet>
      <Sheet open={addProjSheet} onClose={()=>{setAddProjSheet(false);setEditProjId(null);setShowAdv(false);resetProjForm();}} title={editProjId?"프로젝트 수정":"프로젝트 추가"} h="92vh">
        <div style={{marginTop:10}}>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>프로젝트명 *</label><input value={projForm.title} onChange={e=>setProjForm({...projForm,title:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"&&projForm.title.trim())doAddProj();}} placeholder="프로젝트 이름 (Enter로 빠른 추가)" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label><select value={projForm.assigneeId} onChange={e=>setProjForm({...projForm,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>이 프로젝트의 성과는? <span style={{color:"#9CA3AF",fontWeight:600}}>(측정 방식)</span></label>
            <div style={{display:"flex",gap:6}}>
              {[["revenue","💰 매출","돈을 번다"],["metric","🎯 수치목표","상품등록 100개"],["journey","🔁 여정·구축","진행도로"]].map(([k,l,d])=>(
                <button key={k} onClick={()=>{setProjForm({...projForm,goalType:k});if(k==="revenue")setShowAdv(true);}} style={{flex:1,padding:"10px 4px",borderRadius:11,border:`1.5px solid ${projForm.goalType===k?"#F97316":"#E5E8EB"}`,background:projForm.goalType===k?"#FFEDD5":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <p style={{margin:0,fontSize:12,fontWeight:800,color:projForm.goalType===k?"#EA580C":"#374151"}}>{l}</p>
                  <p style={{margin:"2px 0 0",fontSize:9,color:"#9CA3AF",lineHeight:1.3}}>{d}</p>
                </button>
              ))}
            </div>
          </div>
          {projForm.goalType==="revenue"&&<p style={{margin:"-4px 2px 14px",fontSize:11,color:"#9A3412",fontWeight:600,background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:"8px 10px"}}>💰 아래 <b>상세 설정</b>에서 메인·서브 KPI를 연결하면, 이 프로젝트 매출이 KPI·최종목표에 자동 집계됩니다.</p>}
          {projForm.goalType==="journey"&&<p style={{margin:"-4px 2px 14px",fontSize:11,color:"#6B7280",fontWeight:600}}>🔁 등록 후 상세에서 <b>진척 −/＋</b>로 진행도를 관리하고, 실제 일은 <b>업무</b>로 남기세요.</p>}
          {projForm.goalType==="metric"&&!editProjId&&(
            <div style={{marginBottom:14,padding:"12px",background:"#F5F3FF",borderRadius:12,border:"1px solid #DDD6FE"}}>
              <p style={{margin:"0 0 8px",fontSize:11.5,fontWeight:800,color:"#7C3AED"}}>🎯 무엇을 몇 개 만들까요?</p>
              <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                {[["상품등록","개",100],["견적발송","건",50],["콘텐츠","개",30],["전화상담","건",40]].map(([nm,un,tg])=>(
                  <button key={nm} onClick={()=>setMetric({name:nm,unit:un,target:String(tg)})} style={{padding:"4px 9px",borderRadius:14,border:"1px solid #DDD6FE",background:"#fff",fontSize:10.5,fontWeight:700,color:"#7C3AED",cursor:"pointer",fontFamily:"inherit"}}>{nm} {tg}{un}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={metric.name} onChange={e=>setMetric({...metric,name:e.target.value})} placeholder="무엇을 셀까요?" style={{flex:1,minWidth:0,padding:"9px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                <input type="number" value={metric.target} onChange={e=>setMetric({...metric,target:e.target.value})} placeholder="목표" style={{width:62,padding:"9px 8px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
                <input value={metric.unit} onChange={e=>setMetric({...metric,unit:e.target.value})} placeholder="단위" style={{width:48,padding:"9px 6px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
              </div>
              <p style={{margin:"6px 0 0",fontSize:10,color:"#9CA3AF"}}>등록 후 상세에서 진행을 누적 입력 (지표는 나중에 추가·수정 가능)</p>
            </div>
          )}
          <button onClick={()=>setShowAdv(!showAdv)} style={{width:"100%",padding:"11px 0",borderRadius:12,border:"1.5px dashed #D1D5DB",background:"#F9FAFB",color:"#6B7280",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>{showAdv?"▲ 상세 설정 접기":"＋ 상세 설정 (KPI 연결·거래처유형·그룹·우선순위) — 선택"}</button>
          {showAdv&&(<>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메인 KPI <span style={{color:"#9CA3AF",fontWeight:600}}>(어느 목표에 기여)</span></label><select value={projForm.mainKPIId} onChange={e=>setProjForm({...projForm,mainKPIId:e.target.value,subKPIId:""})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">없음 (운영 인프라)</option>{D.mainKPIs.map(mk=><option key={mk.id} value={mk.id}>{mk.krKey} · {mk.title}</option>)}</select></div>
          {projForm.mainKPIId&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>서브 KPI</label><select value={projForm.subKPIId} onChange={e=>setProjForm({...projForm,subKPIId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">선택 안함</option>{availSKs.map(sk=><option key={sk.id} value={sk.id}>{sk.channelCode} · {sk.title}</option>)}</select></div>}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>거래처유형 <span style={{color:"#9CA3AF",fontWeight:600}}>(누가 사는가 · 모르면 비움)</span></label><select value={projForm.dealerType} onChange={e=>setProjForm({...projForm,dealerType:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정 (내부·인프라)</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label} ({d.price})</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>공동 기여자</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{D.users.filter(u=>u.id!==projForm.assigneeId).map(u=>{const sel=projForm.collaboratorIds.includes(u.id);return(<button key={u.id} onClick={()=>toggleColab(u.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,backgroundColor:sel?u.color+"18":"#FFFFFF",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={20}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span>{sel&&<span style={{fontSize:12,color:u.color}}>✓</span>}</button>);})}</div></div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>그룹</label>
            <input value={projForm.group} onChange={e=>setProjForm({...projForm,group:e.target.value})} placeholder="예: 자사몰 구축·운영" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{[...new Set(D.projects.map(p=>p.group).filter(Boolean))].map(g=><button key={g} onClick={()=>setProjForm({...projForm,group:g})} style={{padding:"4px 10px",borderRadius:16,border:"1px solid #E5E8EB",backgroundColor:projForm.group===g?"#0F1F5C":"#F9FAFB",color:projForm.group===g?"#FFFFFF":"#4B5563",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{g}</button>)}</div>
          </div>
          <div style={{marginBottom:20}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>우선순위</label><div style={{display:"flex",gap:8}}>{[{k:"high",l:"🔴 높음"},{k:"mid",l:"🟡 중간"},{k:"low",l:"🟢 낮음"}].map(p=><button key={p.k} onClick={()=>setProjForm({...projForm,priority:p.k})} style={{flex:1,padding:"9px 0",borderRadius:12,border:`1.5px solid ${projForm.priority===p.k?"#0F1F5C":"#E5E8EB"}`,backgroundColor:projForm.priority===p.k?"#0F1F5C":"#FFFFFF",color:projForm.priority===p.k?"#FFFFFF":"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>)}</div></div>
          </>)}
          <button onClick={doAddProj} disabled={!projForm.title.trim()} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:projForm.title.trim()?"#F97316":"#E5E8EB",color:projForm.title.trim()?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:projForm.title.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>{editProjId?"수정 저장":"프로젝트 추가하기"}</button>
        </div>
      </Sheet>
      <EditTaskSheet open={!!editTask} onClose={()=>setEditTask(null)} task={editTask} D={D} onSave={f=>up("tasks",editTask.id,{title:f.title,status:f.status,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,attachments:f.attachments})}/>
      <Confirm open={!!confirmTaskId} title="업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmTaskId)?.title}" 업무를 삭제할까요?`} onOk={()=>{rm("tasks",confirmTaskId);setConfirmTaskId(null);}} onCancel={()=>setConfirmTaskId(null)}/>
      <Confirm open={!!projDel} title="프로젝트 삭제" desc={`"${D.projects.find(p=>p.id===projDel)?.title}" 프로젝트를 삭제할까요? 연결된 업무는 남습니다.`} onOk={()=>{rm("projects",projDel);setProjDel(null);setProjDetail(null);}} onCancel={()=>setProjDel(null)}/>
      <Sheet open={!!actHist} onClose={()=>setActHist(null)} title="📜 활동지표 주차별 이력">
        {actHist&&(<div style={{marginTop:8}}>
          <p style={{margin:"0 0 12px",fontSize:13,fontWeight:900,color:"#0F1F5C"}}>{actHist.ak.name} <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>· 주목표 {fmt(actHist.ak.target||0,actHist.ak.unit)}</span></p>
          {[...((actHist.proj.activityKPIs||[]).find(x=>x.id===actHist.ak.id)?.history||[])].reverse().map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #F2F4F6"}}>
              <Ava name={h.byName} size={26}/>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:"#8B5CF6"}}>{weekLabel(h.week)} · {fmt(h.value||0,actHist.ak.unit)}</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{h.byName||"—"} · {(h.at||"").slice(0,16).replace("T"," ")}</p>
              </div>
            </div>
          ))}
        </div>)}
      </Sheet>
      <Sheet open={!!actEdit} onClose={()=>setActEdit(null)} title="🎯 목표지표 수정">
        {actEdit&&(()=>{const ak=(actEdit.proj.activityKPIs||[]).find(x=>x.id===actEdit.ak.id)||actEdit.ak;return(
          <ActIndicatorEditForm ak={ak} onSave={(f)=>actSaveEdit(actEdit.proj,ak,f)}/>
        );})()}
      </Sheet>
    </div>
  );
}
// 목표지표(activityKPI) 수정 폼 + 수정이력
function ActIndicatorEditForm({ak,onSave}){
  const [f,setF]=useState({name:ak.name||"",unit:ak.unit||"건",target:String(numF(ak.target))});
  const edits=[...(ak.edits||[])].reverse();
  return(
    <div style={{marginTop:8}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>지표 이름</label>
      <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        <div style={{flex:1}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>목표값</label>
          <input type="number" inputMode="numeric" value={f.target} onChange={e=>setF({...f,target:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,fontWeight:800,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        <div style={{width:90}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>단위</label>
          <input value={f.unit} onChange={e=>setF({...f,unit:e.target.value})} style={{width:"100%",padding:"12px 10px",borderRadius:12,fontSize:14,textAlign:"center",border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
      </div>
      <Btn full variant="orange" onClick={()=>f.name.trim()&&onSave(f)} disabled={!f.name.trim()} style={{marginBottom:16}}>저장</Btn>
      <p style={{margin:"0 2px 8px",fontSize:12,fontWeight:800,color:"#4B5563"}}>📜 수정 이력 {edits.length>0?`(${edits.length})`:""}</p>
      {edits.length===0?(
        <p style={{padding:"14px 0",textAlign:"center",fontSize:12,color:"#C4C9D0"}}>아직 수정 이력이 없어요</p>
      ):edits.map((e,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #F2F4F6"}}>
          <Ava name={e.byName} size={26}/>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:12.5,fontWeight:700,color:"#1F2937"}}>{e.field} <span style={{color:"#9CA3AF",fontWeight:600}}>{String(e.from)}</span> → <span style={{color:"#8B5CF6",fontWeight:800}}>{String(e.to)}</span></p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{e.byName||"—"} · {(e.at||"").slice(0,16).replace("T"," ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function CalendarPage({D,cu,add,up,rm}){
  const [cm,setCm]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [detail,setDetail]=useState(null);
  const [actionForm,setActionForm]=useState({type:"task",title:"",projectId:"",status:"todo"});
  const [actionDone,setActionDone]=useState([]);
  const [evSheet,setEvSheet]=useState(false);
  const [evForm,setEvForm]=useState({id:null,title:"",date:"",type:"internal",place:"",attendeeIds:[],externalAttendees:"",description:""});
  const y=cm.getFullYear(),m=cm.getMonth();
  const openNewEvent=(date)=>{ setEvForm({id:null,title:"",date:date||`${y}-${String(m+1).padStart(2,"0")}-01`,type:"internal",place:"",attendeeIds:[],externalAttendees:"",description:""}); setDetail(null); setEvSheet(true); };
  const openEditEvent=(ev)=>{ setEvForm({id:ev.id,title:ev.title||"",date:ev.date||"",type:ev.type||"internal",place:ev.place||"",attendeeIds:ev.attendeeIds||[],externalAttendees:ev.externalAttendees||"",description:ev.description||""}); setDetail(null); setEvSheet(true); };
  const evToggleAtt=(uid)=>setEvForm(f=>({...f,attendeeIds:f.attendeeIds.includes(uid)?f.attendeeIds.filter(x=>x!==uid):[...f.attendeeIds,uid]}));
  const saveEvent=()=>{ if(!evForm.title.trim()||!evForm.date) return; const data={title:evForm.title.trim(),date:evForm.date,type:evForm.type,place:evForm.place.trim(),attendeeIds:evForm.attendeeIds,externalAttendees:evForm.externalAttendees.trim(),description:evForm.description}; if(evForm.id){ up("events",evForm.id,data); } else { add("events",{id:"e"+Date.now(),...data,projectId:null}); } setEvSheet(false); };
  const fd=new Date(y,m,1).getDay();
  const dim=new Date(y,m+1,0).getDate();
  const ET={internal:{label:"내부미팅",color:"#3182F6",bg:"#EBF3FF"},external:{label:"외부미팅",color:"#8B5CF6",bg:"#F3EFFE"},promotion:{label:"프로모션",color:"#FF9500",bg:"#FFF3E0"},seminar:{label:"세미나",color:"#00C073",bg:"#E8FAF1"},fair:{label:"박람회",color:"#F04452",bg:"#FFF0F1"}};
  const getEvts=d=>{const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;return D.events.filter(e=>e.date===ds);};
  const mEvts=D.events.filter(e=>{const d=new Date(e.date);return d.getFullYear()===y&&d.getMonth()===m;});
  const doAction=()=>{
    if(!actionForm.title.trim()) return;
    const nid="t"+Date.now();
    if(actionForm.type==="task"){add("tasks",{id:nid,title:actionForm.title,projectId:actionForm.projectId,assigneeId:cu.id,status:actionForm.status,type:"general",isFixed:false,weekDay:null,weekSlot:null,dueDate:detail?.date||"",memo:`📅 미팅: ${detail?.title}`,attachments:[]});}
    else{add("projects",{id:"p"+Date.now(),title:actionForm.title,mainKPIId:null,subKPIId:"",assigneeId:cu.id,collaboratorIds:[],group:"기타",priority:"mid",status:"active",progress:0,resultValue:0});}
    setActionDone(prev=>[...prev,{id:nid,title:actionForm.title,type:actionForm.type}]);
    setActionForm({type:"task",title:"",projectId:"",status:"todo"});
  };
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setCm(new Date(y,m-1,1))} style={{width:34,height:34,borderRadius:10,backgroundColor:"#F2F4F6",border:"none",cursor:"pointer",fontSize:14}}>◀</button>
          <h2 style={{margin:0,fontSize:16,fontWeight:900,color:"#0F1F5C"}}>{y}년 {m+1}월</h2>
          <button onClick={()=>setCm(new Date(y,m+1,1))} style={{width:34,height:34,borderRadius:10,backgroundColor:"#F2F4F6",border:"none",cursor:"pointer",fontSize:14}}>▶</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Badge color="#F97316" bg="#FFEDD5">{mEvts.length}건</Badge>
          <button onClick={()=>openNewEvent()} style={{padding:"7px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:"#F97316",color:"#FFFFFF",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>+ 일정</button>
        </div>
      </div>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"12px",marginBottom:14,border:"1px solid #F2F4F6"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
          {["일","월","화","수","목","금","토"].map(d=><div key={d} style={{padding:"7px 0",textAlign:"center",fontSize:11,fontWeight:700,color:"#6B7280"}}>{d}</div>)}
          {Array.from({length:fd}).map((_,i)=><div key={"e"+i} style={{minHeight:44}}/>)}
          {Array.from({length:dim}).map((_,i)=>{
            const day=i+1;
            const evts=getEvts(day);
            const isT=new Date().getDate()===day&&new Date().getMonth()===m&&new Date().getFullYear()===y;
            return(
              <div key={day} style={{padding:"3px",minHeight:44}}>
                <span onClick={()=>openNewEvent(`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`)} title="이 날 일정 추가" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:"50%",fontSize:11.5,fontWeight:isT?900:400,backgroundColor:isT?"#3182F6":"transparent",color:isT?"#FFFFFF":"#374151",cursor:"pointer"}}>{day}</span>
                {evts.map(ev=>{const et=ET[ev.type]||ET.internal;return <div key={ev.id} onClick={()=>{setDetail(ev);setActionForm({type:"task",title:"",projectId:"",status:"todo"});setActionDone([]);}} style={{marginTop:1,padding:"1px 4px",borderRadius:4,fontSize:9,fontWeight:700,backgroundColor:et.bg,color:et.color,cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.title}</div>;})}
              </div>
            );
          })}
        </div>
      </div>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>이번 달 일정</h3>
      {mEvts.length===0&&<div style={{padding:"28px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}><p style={{margin:0,fontSize:13,color:"#9CA3AF"}}>이번 달 일정이 없어요</p><p style={{margin:"4px 0 0",fontSize:11.5,color:"#D1D5DB"}}>위 <b>+ 일정</b> 또는 날짜를 탭해 추가하세요</p></div>}
      {mEvts.sort((a,b)=>a.date.localeCompare(b.date)).map(ev=>{
        const et=ET[ev.type]||ET.internal;
        const proj=ev.projectId?D.projects.find(p=>p.id===ev.projectId):null;
        return(
          <button key={ev.id} onClick={()=>{setDetail(ev);setActionForm({type:"task",title:"",projectId:"",status:"todo"});setActionDone([]);}} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",marginBottom:8,borderRadius:14,backgroundColor:"#FFFFFF",border:"1px solid #F2F4F6",textAlign:"left",cursor:"pointer",width:"100%"}}>
            <div style={{width:36,textAlign:"center",flexShrink:0}}>
              <p style={{margin:0,fontSize:18,fontWeight:900,color:"#1F2937"}}>{new Date(ev.date).getDate()}</p>
              <p style={{margin:0,fontSize:9.5,color:"#9CA3AF"}}>{["일","월","화","수","목","금","토"][new Date(ev.date).getDay()]}</p>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <Badge color={et.color} bg={et.bg}>{et.label}</Badge>
                <span style={{fontSize:13.5,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</span>
              </div>
              {ev.description&&<p style={{margin:0,fontSize:11.5,color:"#9CA3AF"}}>{ev.description}</p>}
              {proj&&<p style={{margin:"2px 0 0",fontSize:11,color:"#3182F6"}}>📁 {proj.title}</p>}
            </div>
            <span style={{fontSize:12,color:"#9CA3AF",flexShrink:0}}>⚡→</span>
          </button>
        );
      })}
      <Sheet open={!!detail} onClose={()=>setDetail(null)} title="일정 상세" h="88vh">
        {detail&&(
          <div style={{marginTop:12}}>
            <div style={{backgroundColor:"#F9FAFB",borderRadius:14,padding:"14px",marginBottom:16}}>
              <Badge color={(ET[detail.type]||ET.internal).color} bg={(ET[detail.type]||ET.internal).bg}>{(ET[detail.type]||ET.internal).label}</Badge>
              <h3 style={{margin:"8px 0 4px",fontSize:17,fontWeight:900,color:"#0F1F5C"}}>{detail.title}</h3>
              <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{detail.date}{detail.place?` · 📍 ${detail.place}`:""}</p>
              {((detail.attendeeIds&&detail.attendeeIds.length)||detail.externalAttendees)&&<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:8}}>
                <span style={{fontSize:11,fontWeight:700,color:"#9CA3AF"}}>👥 참여</span>
                {(detail.attendeeIds||[]).map(id=>{const u=D.users.find(x=>x.id===id);return u?<span key={id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11.5,fontWeight:700,color:u.color,background:u.color+"18",padding:"2px 8px",borderRadius:999}}><Ava name={u.name} color={u.color} size={16}/>{u.name}</span>:null;})}
                {detail.externalAttendees&&detail.externalAttendees.split(",").map((nm,i)=>nm.trim()&&<span key={"x"+i} style={{fontSize:11.5,fontWeight:700,color:"#6B7280",background:"#F2F4F6",padding:"3px 9px",borderRadius:999}}>👤 {nm.trim()}</span>)}
              </div>}
              {detail.description&&<p style={{margin:"8px 0 0",fontSize:13.5,color:"#374151",lineHeight:1.6}}>{detail.description}</p>}
              {detail.projectId&&D.projects.find(p=>p.id===detail.projectId)&&<div style={{marginTop:10,padding:"8px 10px",backgroundColor:"#EBF3FF",borderRadius:10}}><p style={{margin:0,fontSize:11.5,color:"#3182F6",fontWeight:700}}>📁 {D.projects.find(p=>p.id===detail.projectId).title}</p></div>}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>openEditEvent(detail)} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✎ 일정 수정</button>
              <button onClick={()=>{rm("events",detail.id);setDetail(null);}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 일정 삭제</button>
            </div>
            <div style={{backgroundColor:"#FFFFFF",borderRadius:14,padding:"14px",border:"1px solid #F2F4F6",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:18}}>⚡</span><div><p style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>2차 액션 바로 추가</p><p style={{margin:0,fontSize:11,color:"#9CA3AF"}}>미팅 후속 업무·프로젝트 즉시 생성</p></div></div>
              <div style={{display:"flex",gap:6,marginBottom:12,backgroundColor:"#F9FAFB",borderRadius:10,padding:3}}>
                {[{k:"task",l:"📋 업무"},{k:"project",l:"📁 프로젝트"}].map(t=><button key={t.k} onClick={()=>setActionForm({...actionForm,type:t.k})} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",backgroundColor:actionForm.type===t.k?"#FFFFFF":"transparent",color:actionForm.type===t.k?"#0F1F5C":"#6B7280",fontWeight:actionForm.type===t.k?700:500,fontSize:12,fontFamily:"inherit",boxShadow:actionForm.type===t.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>)}
              </div>
              <input value={actionForm.title} onChange={e=>setActionForm({...actionForm,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&doAction()} placeholder={actionForm.type==="task"?"후속 업무명...":"새 프로젝트명..."} style={{width:"100%",padding:"11px 14px",borderRadius:10,fontSize:13.5,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:10}}/>
              {actionForm.type==="task"&&<div style={{display:"flex",gap:8,marginBottom:10}}><select value={actionForm.projectId} onChange={e=>setActionForm({...actionForm,projectId:e.target.value})} style={{flex:2,padding:"9px 12px",borderRadius:10,fontSize:12,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">프로젝트 없음</option>{D.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><select value={actionForm.status} onChange={e=>setActionForm({...actionForm,status:e.target.value})} style={{flex:1,padding:"9px 10px",borderRadius:10,fontSize:12,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>}
              <button onClick={doAction} disabled={!actionForm.title.trim()} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",backgroundColor:actionForm.title.trim()?"#F97316":"#E5E8EB",color:actionForm.title.trim()?"#FFFFFF":"#9CA3AF",fontSize:14,fontWeight:700,cursor:actionForm.title.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>{actionForm.type==="task"?"업무 생성":"프로젝트 생성"}</button>
            </div>
            {actionDone.length>0&&<div style={{backgroundColor:"#E8FAF1",borderRadius:12,padding:"10px 14px",border:"1px solid rgba(0,192,115,0.2)"}}><p style={{margin:"0 0 6px",fontSize:12,fontWeight:800,color:"#00C073"}}>✅ 생성된 액션 {actionDone.length}건</p>{actionDone.map((a,i)=><p key={i} style={{margin:"2px 0",fontSize:12.5,color:"#374151",fontWeight:600}}>· [{a.type==="task"?"업무":"프로젝트"}] {a.title}</p>)}</div>}
          </div>
        )}
      </Sheet>
      <Sheet open={evSheet} onClose={()=>setEvSheet(false)} title={evForm.id?"일정 수정":"일정 추가"}>
        <div style={{marginTop:10}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>일정명 *</label>
          <input value={evForm.title} onChange={e=>setEvForm({...evForm,title:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"&&evForm.title.trim()&&evForm.date)saveEvent();}} placeholder="예: 주간 팀 미팅" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>날짜 *</label>
          <input type="date" value={evForm.date} onChange={e=>setEvForm({...evForm,date:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>유형</label>
          <select value={evForm.type} onChange={e=>setEvForm({...evForm,type:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none",marginBottom:14}}>{Object.entries(ET).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>미팅 장소 <span style={{color:"#9CA3AF",fontWeight:600}}>(선택)</span></label>
          <input value={evForm.place} onChange={e=>setEvForm({...evForm,place:e.target.value})} placeholder="예: 본사 3층 회의실 / 줌 / 고객사" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>참여자 — 팀원</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{D.users.map(u=>{const sel=evForm.attendeeIds.includes(u.id);return(<button key={u.id} onClick={()=>evToggleAtt(u.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,backgroundColor:sel?u.color+"18":"#FFFFFF",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={20}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span>{sel&&<span style={{fontSize:12,color:u.color}}>✓</span>}</button>);})}</div>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>참여자 — 외부인 <span style={{color:"#9CA3AF",fontWeight:600}}>(쉼표로 구분, 수기)</span></label>
          <input value={evForm.externalAttendees} onChange={e=>setEvForm({...evForm,externalAttendees:e.target.value})} placeholder="예: 강남제비스코 박부장, 조달청 김주무관" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>안건·메모</label>
          <textarea value={evForm.description} onChange={e=>setEvForm({...evForm,description:e.target.value})} placeholder="논의할 안건·메모" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"vertical",minHeight:64,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:16}}/>
          <Btn full variant="orange" onClick={saveEvent} disabled={!evForm.title.trim()||!evForm.date}>{evForm.id?"수정 저장":"일정 추가"}</Btn>
        </div>
      </Sheet>
    </div>
  );
}
// ───────────────────────── 출시 파이프라인 (템플릿 → SKU 프로젝트 자동 생성 + 인계) ─────────────────────────
// 출시 단계 상태: done(완료) / ready(선행 끝나 내 차례) / wait(선행 대기)
const launchStageStatus=(task,allTasks)=>{
  if(!task) return "wait";
  if(task.status==="done") return "done";
  const deps=task.deps||[];
  const ready=deps.every(id=>{const d=allTasks.find(t=>t.id===id);return d?d.status==="done":true;});
  return ready?"ready":"wait";
};
const launchProjTasks=(D,proj)=>D.tasks.filter(t=>t.projectId===proj.id&&t.launchNode).sort((a,b)=>(a.step||0)-(b.step||0));
const ST_COLOR={done:"#00C073",ready:"#F97316",wait:"#9CA3AF"};
// 템플릿 1개 → 신규 SKU 프로젝트 + 단계별 업무(선행연결·담당자배정) 자동 생성
const instantiateLaunch=({tpl,productName,mainKPIId,subKPIId,dealerType,add})=>{
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
    add("tasks",{id:taskIdByNode[n.id],title:n.roleLabel?`[${n.roleLabel}] ${n.title}`:n.title,projectId:projId,assigneeId:n.assigneeId||owner,type:"general",status:"todo",weekDay:null,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[],launchNode:n.id,step:i,deps});
  });
};
// 템플릿을 "기존 프로젝트"에 적용 — 단계 업무(선행·담당자) 생성 + templateId 표시 (출시 외 일반 프로젝트도 단계 흐름 가능)
const applyTemplateToProject=({tpl,proj,add,up})=>{
  const ts=Date.now();
  const taskIdByNode={};
  tpl.nodes.forEach((n,i)=>{taskIdByNode[n.id]="t"+ts+"_"+i;});
  const predsOf=(nodeId)=>tpl.edges.filter(e=>e.to===nodeId).map(e=>e.from);
  tpl.nodes.forEach((n,i)=>{
    const deps=predsOf(n.id).map(pid=>taskIdByNode[pid]).filter(Boolean);
    add("tasks",{id:taskIdByNode[n.id],title:n.roleLabel?`[${n.roleLabel}] ${n.title}`:n.title,projectId:proj.id,assigneeId:n.assigneeId,type:"general",status:"todo",weekDay:null,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[],launchNode:n.id,step:i,deps});
  });
  const assignees=[...new Set(tpl.nodes.map(n=>n.assigneeId).filter(Boolean))];
  const colab=[...new Set([...(proj.collaboratorIds||[]),...assignees.filter(a=>a!==proj.assigneeId)])];
  up("projects",proj.id,{templateId:tpl.id,collaboratorIds:colab});
};
// 프로젝트 상세 안의 "단계 흐름(협업 인계)" 섹션 — 단계 없으면 적용 버튼, 있으면 인계 파이프라인
function ProjStageFlow({D,proj,cu,up,onPick}){
  const stageTasks=D.tasks.filter(t=>t.projectId===proj.id&&t.launchNode).sort((a,b)=>(a.step||0)-(b.step||0));
  const uName=(id)=>D.users.find(u=>u.id===id)?.name||"미배정";
  const uColor=(id)=>D.users.find(u=>u.id===id)?.color||"#9CA3AF";
  if(stageTasks.length===0) return(
    <div style={{padding:"12px 16px 0"}}>
      <button onClick={()=>onPick(proj)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 0",borderRadius:10,border:"1.5px dashed #FDBA74",backgroundColor:"#FFF7ED",fontSize:12.5,fontWeight:800,color:"#EA580C",cursor:"pointer",fontFamily:"inherit"}}>🔗 단계 흐름(협업 인계) 적용</button>
    </div>
  );
  const toggleStage=(t,st)=>{ if(st==="wait")return; up("tasks",t.id,{status:t.status==="done"?"todo":"done"}); };
  return(
    <div style={{padding:"12px 16px 0"}}>
      <p style={{margin:"0 0 7px",fontSize:11.5,fontWeight:800,color:"#4B5563"}}>🔗 단계 흐름 <span style={{fontWeight:600,color:"#9CA3AF"}}>(앞 단계 끝나면 다음 담당자 차례)</span></p>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {stageTasks.map((t,i)=>{const st=launchStageStatus(t,stageTasks);const mine=t.assigneeId===cu.id;return(
          <button key={t.id} onClick={()=>toggleStage(t,st)} disabled={st==="wait"} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:10,border:`1px solid ${st==="ready"&&mine?"#FED7AA":"#EAECEF"}`,backgroundColor:st==="ready"&&mine?"#FFF7ED":"#FFFFFF",cursor:st==="wait"?"default":"pointer",textAlign:"left",fontFamily:"inherit",opacity:st==="wait"?0.65:1}}>
            <span style={{flexShrink:0,width:22,height:22,borderRadius:"50%",backgroundColor:st==="done"?ST_COLOR.done:"transparent",border:st==="done"?"none":`2px solid ${ST_COLOR[st]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:st==="done"?"#fff":ST_COLOR[st]}}>{st==="done"?"✓":i+1}</span>
            <span style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:700,color:st==="wait"?"#9CA3AF":"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
            <span style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:700,color:uColor(t.assigneeId)}}><Ava name={uName(t.assigneeId)} color={uColor(t.assigneeId)} size={18}/>{st==="ready"&&mine?"내 차례":""}</span>
          </button>
        );})}
      </div>
    </div>
  );
}
const NODE_W=144, NODE_H=56;
function LaunchPage({D,cu,lead,add,up,rm,nav}){
  const [tab,setTab]=useState("status");
  const tpls=D.launchTemplates||[];
  const [tplId,setTplId]=useState("");
  const tpl=tpls.find(t=>t.id===tplId)||tpls[0];
  const launchProjs=D.projects.filter(p=>p.templateId);
  const uName=(id)=>D.users.find(u=>u.id===id)?.name||"미배정";
  const uColor=(id)=>D.users.find(u=>u.id===id)?.color||"#9CA3AF";
  // ── 출시 건수 KPI 집계 ──
  const countSK=D.subKPIs.find(s=>s.launchCount);
  const doneCount=launchProjs.filter(p=>(p.progress||0)>=100).length;
  const seedCountSK=()=>add("subKPIs",{id:"sk_launch",mainKPIId:"mk3",title:"신규 SKU 출시 수",targetValue:30,currentValue:0,unit:"개",order:5,channelCode:"SKU",launchCount:true});
  // ── 신규 SKU 출시 시트 ──
  const [skuOpen,setSkuOpen]=useState(false);
  const [sku,setSku]=useState({name:"",mainKPIId:"",subKPIId:"",dealerType:"",tplId:""});
  const skSKs=D.subKPIs.filter(s=>s.mainKPIId===sku.mainKPIId);
  const openSku=()=>{ setSku({name:"",mainKPIId:"",subKPIId:"",dealerType:"",tplId:tpl?tpl.id:""}); setSkuOpen(true); };
  const doLaunch=()=>{ const launchTpl=tpls.find(t=>t.id===sku.tplId)||tpl; if(!launchTpl||!sku.name.trim())return; instantiateLaunch({tpl:launchTpl,productName:sku.name.trim(),mainKPIId:sku.mainKPIId,subKPIId:sku.subKPIId,dealerType:sku.dealerType,add}); setSkuOpen(false); setTab("status"); };
  // ── 템플릿 복제·이름·삭제 ──
  const [renameOpen,setRenameOpen]=useState(false);
  const [renameVal,setRenameVal]=useState("");
  const dupTpl=()=>{ const nid="tpl"+Date.now(); add("launchTemplates",{...tpl,id:nid,name:tpl.name+" (복사)",createdAt:new Date().toISOString(),nodes:tpl.nodes.map(n=>({...n})),edges:tpl.edges.map(e=>({...e}))}); setTplId(nid); };
  const doRename=()=>{ if(renameVal.trim()) up("launchTemplates",tpl.id,{name:renameVal.trim()}); setRenameOpen(false); };
  const delTpl=()=>{ if(tpls.length<=1){ window.alert("템플릿이 하나뿐이라 삭제할 수 없어요."); return; } if(window.confirm(`'${tpl.name}' 템플릿을 삭제할까요? (이미 만든 출시 건은 영향 없음)`)){ const next=tpls.find(t=>t.id!==tpl.id); rm("launchTemplates",tpl.id); setTplId(next?next.id:""); } };
  // ── 내 차례(ready) 집계 ──
  const myReady=[];
  launchProjs.forEach(p=>{ const ts=launchProjTasks(D,p); ts.forEach(t=>{ if(t.assigneeId===cu.id&&launchStageStatus(t,ts)==="ready") myReady.push({proj:p,task:t}); }); });
  const toggleStage=(t,st)=>{ if(st==="wait")return; up("tasks",t.id,{status:t.status==="done"?"todo":"done"}); };
  // ── 템플릿 캔버스 편집 ──
  const canvasRef=useRef(null);
  const draggingRef=useRef(null);
  const [draftNodes,setDraftNodes]=useState(tpl?tpl.nodes:[]);
  const [connectMode,setConnectMode]=useState(false);
  const [connectFrom,setConnectFrom]=useState(null);
  const [editNode,setEditNode]=useState(null);
  const [delEdge,setDelEdge]=useState(null);
  useEffect(()=>{ if(!draggingRef.current&&tpl) setDraftNodes(tpl.nodes); },[tpl]);
  const maxY=draftNodes.reduce((m,n)=>Math.max(m,n.y),0);
  const canvasH=Math.max(520,maxY+NODE_H+120);
  const nodeById=(id)=>draftNodes.find(n=>n.id===id);
  const onNodeDown=(e,n)=>{
    if(connectMode){ e.stopPropagation(); handleConnect(n); return; }
    e.stopPropagation();
    const r=canvasRef.current.getBoundingClientRect();
    draggingRef.current={id:n.id,offX:e.clientX-r.left-n.x,offY:e.clientY-r.top-n.y,moved:false};
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
  };
  const onNodeMove=(e)=>{
    const d=draggingRef.current; if(!d)return;
    const r=canvasRef.current.getBoundingClientRect();
    const nx=Math.max(0,Math.min(r.width-NODE_W,Math.round(e.clientX-r.left-d.offX)));
    const ny=Math.max(0,Math.round(e.clientY-r.top-d.offY));
    d.moved=true;
    setDraftNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:nx,y:ny}:n));
  };
  const onNodeUp=(e,n)=>{
    const d=draggingRef.current; draggingRef.current=null;
    if(!d) return;
    if(d.moved){ up("launchTemplates",tpl.id,{nodes:draftNodes.map(x=>x.id===n.id?{...x}:x)}); }
    else { setEditNode(n); }
  };
  const handleConnect=(n)=>{
    if(!connectFrom){ setConnectFrom(n.id); return; }
    if(connectFrom===n.id){ setConnectFrom(null); return; }
    const exists=tpl.edges.some(e=>(e.from===connectFrom&&e.to===n.id)||(e.from===n.id&&e.to===connectFrom));
    if(!exists) up("launchTemplates",tpl.id,{edges:[...tpl.edges,{id:"e"+Date.now(),from:connectFrom,to:n.id}]});
    setConnectFrom(null);
  };
  const addNode=()=>{ const id="n"+Date.now(); up("launchTemplates",tpl.id,{nodes:[...tpl.nodes,{id,title:"새 단계",roleLabel:"",assigneeId:cu.id,x:24,y:maxY+NODE_H+24}]}); };
  const saveNode=(patch)=>{ up("launchTemplates",tpl.id,{nodes:tpl.nodes.map(n=>n.id===editNode.id?{...n,...patch}:n)}); setEditNode(null); };
  const deleteNode=()=>{ up("launchTemplates",tpl.id,{nodes:tpl.nodes.filter(n=>n.id!==editNode.id),edges:tpl.edges.filter(e=>e.from!==editNode.id&&e.to!==editNode.id)}); setEditNode(null); };
  const removeEdge=(eid)=>{ up("launchTemplates",tpl.id,{edges:tpl.edges.filter(e=>e.id!==eid)}); setDelEdge(null); };
  // 기존(마이그레이션 완료) 환경: 템플릿 컬렉션이 비어있으면 기본 프로세스 시드
  const seedTpl=()=>add("launchTemplates",{...INIT.launchTemplates[0],createdAt:new Date().toISOString()});
  if(!tpl) return(
    <div style={{padding:"48px 24px",textAlign:"center"}}>
      <p style={{fontSize:42,margin:0}}>🚀</p>
      <p style={{margin:"12px 0 4px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>출시 프로세스 준비</p>
      <p style={{margin:"0 0 20px",fontSize:12.5,color:"#6B7280",lineHeight:1.6}}>신상 SKU를 찍어낼 표준 5단계 흐름을 만들어 시작하세요.<br/>한 번 만들면 신상마다 그대로 자동 생성됩니다.</p>
      <Btn variant="orange" size="lg" onClick={seedTpl}>기본 출시 프로세스 만들기</Btn>
    </div>
  );
  return(
    <div style={{padding:"14px 16px 24px"}}>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"status",l:`🚀 출시현황 ${launchProjs.length}`},{k:"template",l:"🧩 템플릿"}].map(v=>(
          <button key={v.k} onClick={()=>setTab(v.k)} style={{flex:1,padding:"9px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:tab===v.k?"#FFFFFF":"transparent",color:tab===v.k?"#0F1F5C":"#6B7280",fontWeight:tab===v.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:tab===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
        ))}
      </div>

      {tab==="status"&&(<>
        <Btn full variant="orange" onClick={openSku} style={{marginBottom:14}}>🚀 신규 SKU 출시</Btn>
        {countSK?(
          <div style={{display:"flex",alignItems:"center",gap:10,backgroundColor:"#F0F7FF",border:"1px solid #D5E6FB",borderRadius:12,padding:"11px 13px",marginBottom:14}}>
            <span style={{fontSize:18}}>📊</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#0F1F5C"}}>{countSK.title}</p>
              <p style={{margin:"2px 0 0",fontSize:10.5,color:"#6B7280"}}>출시 완료 {doneCount}건이 KPI에 자동 집계 중 · 목표 {countSK.targetValue}{countSK.unit}</p>
            </div>
            <span style={{fontSize:15,fontWeight:900,color:"#3182F6",flexShrink:0}}>{doneCount}<span style={{fontSize:11,color:"#9CA3AF"}}>/{countSK.targetValue}</span></span>
          </div>
        ):(
          <button onClick={seedCountSK} style={{width:"100%",display:"flex",alignItems:"center",gap:8,backgroundColor:"#F9FAFB",border:"1px dashed #CBD5E1",borderRadius:12,padding:"11px 13px",marginBottom:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <span style={{fontSize:16}}>📊</span>
            <span style={{flex:1,fontSize:12,fontWeight:700,color:"#475569"}}>출시 완료 건수를 KPI(신규 SKU 출시 수)에 자동 집계 — 켜기</span>
            <span style={{fontSize:12,fontWeight:800,color:"#3182F6"}}>＋</span>
          </button>
        )}
        {myReady.length>0&&(
          <div style={{backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
            <p style={{margin:"0 0 8px",fontSize:13,fontWeight:900,color:"#EA580C"}}>🔔 내 차례 ({myReady.length})</p>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {myReady.map(({proj,task})=>(
                <button key={task.id} onClick={()=>toggleStage(task,"ready")} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:10,border:"1px solid #FED7AA",backgroundColor:"#FFFFFF",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                  <span style={{flexShrink:0,width:22,height:22,borderRadius:"50%",border:"2px solid #F97316",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#F97316"}}>✓</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</p>
                    <p style={{margin:"1px 0 0",fontSize:10.5,color:"#9CA3AF"}}>📦 {proj.productName} · 완료 표시하면 다음 담당자에게 인계</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {launchProjs.length===0?<Empty t="출시 중인 SKU가 없어요 · 신규 SKU 출시를 눌러 시작하세요"/>:launchProjs.map(p=>{
          const ts=launchProjTasks(D,p);
          const doneN=ts.filter(t=>t.status==="done").length;
          return(
            <div key={p.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:12,border:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{minWidth:0}}>
                  <p style={{margin:0,fontSize:14.5,fontWeight:900,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📦 {p.productName||p.title}</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{doneN}/{ts.length} 단계 완료</p>
                </div>
                <span style={{fontSize:15,fontWeight:900,color:p.progress>=100?"#00C073":"#F97316",flexShrink:0}}>{p.progress||0}%</span>
              </div>
              <div style={{marginBottom:12}}><PBar value={p.progress||0} color={p.progress>=100?"#00C073":"#F97316"} h={5}/></div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {ts.map((t,i)=>{
                  const st=launchStageStatus(t,ts);
                  const mine=t.assigneeId===cu.id;
                  return(
                    <button key={t.id} onClick={()=>toggleStage(t,st)} disabled={st==="wait"} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:10,border:`1px solid ${st==="ready"&&mine?"#FED7AA":"#F2F4F6"}`,backgroundColor:st==="ready"&&mine?"#FFF7ED":"#FAFBFC",cursor:st==="wait"?"default":"pointer",textAlign:"left",fontFamily:"inherit",opacity:st==="wait"?0.7:1}}>
                      <span style={{flexShrink:0,width:22,height:22,borderRadius:"50%",backgroundColor:st==="done"?ST_COLOR.done:"transparent",border:st==="done"?"none":`2px solid ${ST_COLOR[st]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:st==="done"?"#fff":ST_COLOR[st]}}>{st==="done"?"✓":i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12.5,fontWeight:700,color:st==="wait"?"#9CA3AF":"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
                      </div>
                      <span style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:700,color:uColor(t.assigneeId)}}><Ava name={uName(t.assigneeId)} color={uColor(t.assigneeId)} size={18}/>{st==="ready"&&mine?"내 차례":""}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={()=>{ if(window.confirm(`'${p.productName||p.title}' 출시 건을 삭제할까요? (단계 업무 포함)`)){ launchProjTasks(D,p).forEach(t=>rm("tasks",t.id)); rm("projects",p.id); } }} style={{marginTop:10,fontSize:11,fontWeight:700,color:"#C4C9D0",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
            </div>
          );
        })}
      </>)}

      {tab==="template"&&(<>
        {!tpl?<Empty t="템플릿이 없습니다"/>:(<>
          {tpls.length>1&&(
            <select value={tpl.id} onChange={e=>setTplId(e.target.value)} style={{width:"100%",padding:"11px 13px",borderRadius:11,border:"1.5px solid #E5E8EB",fontSize:13.5,fontWeight:800,fontFamily:"inherit",backgroundColor:"#fff",outline:"none",WebkitAppearance:"none",color:"#0F1F5C",marginBottom:10}}>
              {tpls.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div style={{display:"flex",gap:7,marginBottom:12}}>
            <button onClick={dupTpl} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>⧉ 복제</button>
            <button onClick={()=>{setRenameVal(tpl.name);setRenameOpen(true);}} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>✎ 이름</button>
            <button onClick={delTpl} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #FFE2E5",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#F04452",cursor:"pointer",fontFamily:"inherit"}}>🗑 삭제</button>
          </div>
          <div style={{backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 13px",marginBottom:12}}>
            <p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#9A3412"}}>🧩 {tpl.name}</p>
            <p style={{margin:"3px 0 0",fontSize:11,color:"#B45309",lineHeight:1.5}}>제품군마다 흐름이 다르면 <b>복제</b>해서 단계를 바꿔 쓰세요. 노드를 끌어 옮기고, 탭하면 수정돼요.</p>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button onClick={addNode} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>＋ 단계 추가</button>
            <button onClick={()=>{setConnectMode(!connectMode);setConnectFrom(null);}} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1.5px solid ${connectMode?"#F97316":"#E5E8EB"}`,backgroundColor:connectMode?"#FFEDD5":"#fff",fontSize:12.5,fontWeight:800,color:connectMode?"#EA580C":"#374151",cursor:"pointer",fontFamily:"inherit"}}>🔗 {connectMode?"연결 중…":"선 연결"}</button>
          </div>
          {connectMode&&<p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"#EA580C",textAlign:"center"}}>{connectFrom?"→ 도착 단계를 탭하세요 (다시 누르면 취소)":"시작 단계를 탭하세요"}</p>}
          <div ref={canvasRef} style={{position:"relative",width:"100%",height:canvasH,backgroundColor:"#FAFBFC",backgroundImage:"radial-gradient(#E5E8EB 1px,transparent 1px)",backgroundSize:"18px 18px",borderRadius:16,border:"1px solid #EDF0F3",overflow:"hidden",touchAction:"none"}}>
            <svg width="100%" height={canvasH} style={{position:"absolute",inset:0,pointerEvents:"none"}}>
              {tpl.edges.map(e=>{ const a=nodeById(e.from),b=nodeById(e.to); if(!a||!b)return null;
                const x1=a.x+NODE_W/2,y1=a.y+NODE_H,x2=b.x+NODE_W/2,y2=b.y;
                return <path key={e.id} d={`M ${x1} ${y1} C ${x1} ${y1+44}, ${x2} ${y2-44}, ${x2} ${y2}`} stroke="#F97316" strokeWidth={2.5} fill="none" opacity={0.55}/>;
              })}
            </svg>
            {connectMode&&tpl.edges.map(e=>{ const a=nodeById(e.from),b=nodeById(e.to); if(!a||!b)return null;
              const mx=(a.x+b.x)/2+NODE_W/2-10,my=(a.y+NODE_H+b.y)/2-10;
              return <button key={e.id} onClick={()=>removeEdge(e.id)} style={{position:"absolute",left:mx,top:my,width:20,height:20,borderRadius:"50%",border:"none",backgroundColor:"#F04452",color:"#fff",fontSize:12,fontWeight:900,cursor:"pointer",lineHeight:1,zIndex:5}}>×</button>;
            })}
            {draftNodes.map((n,i)=>{
              const sel=connectFrom===n.id;
              const col=uColor(n.assigneeId);
              return(
                <div key={n.id} onPointerDown={e=>onNodeDown(e,n)} onPointerMove={onNodeMove} onPointerUp={e=>onNodeUp(e,n)}
                  style={{position:"absolute",left:n.x,top:n.y,width:NODE_W,minHeight:NODE_H,boxSizing:"border-box",padding:"8px 10px",borderRadius:12,backgroundColor:"#FFFFFF",border:`2px solid ${sel?"#F97316":col+"55"}`,boxShadow:sel?"0 0 0 3px #F9731633":"0 2px 8px rgba(0,0,0,0.08)",cursor:connectMode?"pointer":"grab",touchAction:"none",userSelect:"none",zIndex:sel?4:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                    <span style={{flexShrink:0,width:18,height:18,borderRadius:"50%",backgroundColor:col,color:"#fff",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
                    <span style={{fontSize:10,fontWeight:800,color:col,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.roleLabel||uName(n.assigneeId)}</span>
                  </div>
                  <p style={{margin:0,fontSize:11.5,fontWeight:700,color:"#1F2937",lineHeight:1.3}}>{n.title}</p>
                </div>
              );
            })}
          </div>
          <p style={{margin:"10px 2px 0",fontSize:11,color:"#9CA3AF",lineHeight:1.6}}>●&nbsp;노드를 끌어 위치 정리&nbsp;·&nbsp;탭하면 단계명·담당자 수정&nbsp;·&nbsp;<b>선 연결</b>로 선행(인계) 순서를 잇습니다.</p>
        </>)}
      </>)}

      {/* 신규 SKU 출시 시트 */}
      <Sheet open={skuOpen} onClose={()=>setSkuOpen(false)} title="🚀 신규 SKU 출시" h="88vh">
        <div style={{marginTop:8}}>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#6B7280",lineHeight:1.6,backgroundColor:"#F9FAFB",borderRadius:10,padding:"10px 12px"}}>제품명만 입력하면 <b>{(tpls.find(t=>t.id===sku.tplId)||tpl)?.nodes.length||5}단계</b>가 담당자까지 자동 생성됩니다.</p>
          {tpls.length>1&&(
            <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>출시 프로세스 템플릿</label>
              <select value={sku.tplId} onChange={e=>setSku({...sku,tplId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#fff",fontFamily:"inherit",WebkitAppearance:"none"}}>{tpls.map(t=><option key={t.id} value={t.id}>{t.name} ({t.nodes.length}단계)</option>)}</select></div>
          )}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>제품명 *</label>
            <input value={sku.name} onChange={e=>setSku({...sku,name:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")doLaunch();}} placeholder="예: 써밋비드 엠보 신상" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메인 KPI <span style={{color:"#9CA3AF",fontWeight:600}}>(매출 집계 연결 · 선택)</span></label>
            <select value={sku.mainKPIId} onChange={e=>setSku({...sku,mainKPIId:e.target.value,subKPIId:""})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#fff",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">없음</option>{D.mainKPIs.map(mk=><option key={mk.id} value={mk.id}>{mk.krKey} · {mk.title}</option>)}</select></div>
          {sku.mainKPIId&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>서브 KPI</label>
            <select value={sku.subKPIId} onChange={e=>setSku({...sku,subKPIId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#fff",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">선택 안함</option>{skSKs.map(s=><option key={s.id} value={s.id}>{s.channelCode} · {s.title}</option>)}</select></div>}
          <Btn full variant="orange" size="lg" onClick={doLaunch} disabled={!sku.name.trim()}>출시 시작 — {tpl?tpl.nodes.length:5}단계 생성</Btn>
        </div>
      </Sheet>

      {/* 노드 수정 시트 */}
      <Sheet open={!!editNode} onClose={()=>setEditNode(null)} title="단계 수정">
        {editNode&&(<NodeEditForm node={editNode} users={D.users} onSave={saveNode} onDelete={deleteNode}/>)}
      </Sheet>

      {/* 템플릿 이름 변경 시트 */}
      <Sheet open={renameOpen} onClose={()=>setRenameOpen(false)} title="템플릿 이름">
        <div style={{marginTop:8}}>
          <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doRename();}} placeholder="예: 부자재 출시 프로세스" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:16}}/>
          <Btn full variant="orange" onClick={doRename} disabled={!renameVal.trim()}>저장</Btn>
        </div>
      </Sheet>
    </div>
  );
}
function NodeEditForm({node,users,onSave,onDelete}){
  const [f,setF]=useState({title:node.title||"",roleLabel:node.roleLabel||"",assigneeId:node.assigneeId||users[0]?.id});
  return(
    <div style={{marginTop:8}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>단계명 *</label>
      <input value={f.title} onChange={e=>setF({...f,title:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>역할 라벨 <span style={{color:"#9CA3AF",fontWeight:600}}>(예: MD·본부장 · 비우면 담당자명 표시)</span></label>
      <input value={f.roleLabel} onChange={e=>setF({...f,roleLabel:e.target.value})} placeholder="" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label>
      <select value={f.assigneeId} onChange={e=>setF({...f,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#fff",fontFamily:"inherit",WebkitAppearance:"none",marginBottom:18}}>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onDelete} style={{flex:"0 0 auto",padding:"13px 16px",borderRadius:12,border:"1.5px solid #FFE2E5",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
        <Btn full variant="orange" onClick={()=>f.title.trim()&&onSave({title:f.title.trim(),roleLabel:f.roleLabel.trim(),assigneeId:f.assigneeId})} disabled={!f.title.trim()} style={{flex:1}}>저장</Btn>
      </div>
    </div>
  );
}
function MindMapPage({D,cu}){
  const [boardView,setBoardView]=useState("tree");
  const [sel,setSel]=useState(cu.id);
  const user=D.users.find(u=>u.id===sel);
  const myP=D.projects.filter(p=>p.assigneeId===sel);
  const myMK=[...new Set(myP.filter(p=>p.mainKPIId).map(p=>p.mainKPIId))].map(id=>D.mainKPIs.find(m=>m.id===id)).filter(Boolean);
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  const isThisWeek=task=>!!(task.weekDay&&WEEK_DAYS.includes(task.weekDay));
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"tree",l:"◈ 담당자 트리"},{k:"weekly",l:"🗓 주간 맵"}].map(v=>(
          <button key={v.k} onClick={()=>setBoardView(v.k)} style={{flex:1,padding:"9px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:boardView===v.k?"#FFFFFF":"transparent",color:boardView===v.k?"#0F1F5C":"#6B7280",fontWeight:boardView===v.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:boardView===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
        ))}
      </div>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:12,border:"1.5px solid #E5E8EB",fontSize:14,fontFamily:"inherit",backgroundColor:"#FFFFFF",outline:"none",marginBottom:14,WebkitAppearance:"none"}}>
        {D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {boardView==="tree"&&(
        <div>
          <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"16px",marginBottom:14,border:"1px solid #F2F4F6",display:"flex",flexDirection:"column",alignItems:"center"}}>
            <Ava name={user?.name} color={user?.color} size={52}/>
            <p style={{margin:"8px 0 2px",fontSize:15,fontWeight:900,color:"#111827"}}>{user?.name}</p>
            <p style={{margin:"0 0 4px",fontSize:12,color:"#9CA3AF"}}>{user?.dept}</p>
            <p style={{margin:0,fontSize:12,fontWeight:700,color:"#F97316"}}>프로젝트 {myP.length}개 담당</p>
          </div>
          {myMK.length===0?<p style={{textAlign:"center",color:"#D1D5DB",fontSize:13,padding:"20px 0"}}>연결된 KR이 없습니다</p>:myMK.map(mk=>{
            const mkProjs=myP.filter(p=>p.mainKPIId===mk.id);
            const col=krColors[mk.id]||"#3182F6";
            return(
              <div key={mk.id} style={{marginBottom:10}}>
                <div style={{backgroundColor:col+"18",borderRadius:12,padding:"10px 14px",marginBottom:8,border:`1.5px solid ${col}33`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:900,color:"#FFFFFF",backgroundColor:col,padding:"2px 8px",borderRadius:20}}>{mk.krKey}</span>
                      <span style={{fontSize:13,fontWeight:900,color:col}}>{mk.title}</span>
                    </div>
                    <span style={{fontSize:12,fontWeight:800,color:col}}>{pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue)}%</span>
                  </div>
                </div>
                {mkProjs.map(proj=>{
                  const sk=D.subKPIs.find(s=>s.id===proj.subKPIId);
                  const tasks=D.tasks.filter(t=>t.projectId===proj.id);
                  const done=tasks.filter(t=>t.status==="done");
                  return(
                    <div key={proj.id} style={{marginLeft:16,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{width:2,height:28,backgroundColor:col+"44",borderRadius:1}}/>
                        <div style={{flex:1,backgroundColor:"#FFFFFF",borderRadius:10,padding:"8px 12px",border:"1px solid #E5E8EB"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                                {sk&&<span style={{fontSize:9,fontWeight:900,color:col,backgroundColor:col+"18",padding:"1px 5px",borderRadius:6}}>{sk.channelCode}</span>}
                                <span style={{fontSize:12.5,fontWeight:700,color:"#111827"}}>{proj.title}</span>
                              </div>
                              <span style={{fontSize:11,color:"#9CA3AF"}}>업무 {done.length}/{tasks.length}건</span>
                            </div>
                            <span style={{fontSize:13,fontWeight:900,color:proj.progress>=70?"#00C073":"#3182F6"}}>{proj.progress}%</span>
                          </div>
                          <div style={{marginTop:5}}><PBar value={proj.progress} color={proj.progress>=70?"#00C073":"#3182F6"} h={4}/></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {myP.filter(p=>!p.mainKPIId).length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{backgroundColor:"#F2F4F6",borderRadius:12,padding:"10px 14px",marginBottom:8}}><span style={{fontSize:13,fontWeight:900,color:"#4B5563"}}>⚙️ 운영 인프라</span></div>
              {myP.filter(p=>!p.mainKPIId).map(proj=>(
                <div key={proj.id} style={{marginLeft:16,marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:2,height:24,backgroundColor:"#D1D5DB",borderRadius:1}}/>
                    <div style={{flex:1,backgroundColor:"#FFFFFF",borderRadius:9,padding:"8px 12px",border:"1px solid #E5E8EB"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12.5,fontWeight:700,color:"#1F2937"}}>{proj.title}</span><span style={{fontSize:13,fontWeight:900,color:proj.progress>=70?"#00C073":"#3182F6"}}>{proj.progress}%</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {boardView==="weekly"&&(
        <div>
          <div style={{display:"flex",gap:14,marginBottom:14,padding:"8px 14px",backgroundColor:"#FFFFFF",borderRadius:10,border:"1px solid #F2F4F6"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#F97316"}}/><span style={{fontSize:11,color:"#4B5563",fontWeight:600}}>이번 주 업무</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#D1D5DB"}}/><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>이전 업무</span></div>
          </div>
          {D.mainKPIs.map(mk=>{
            const mkProjs=D.projects.filter(p=>p.mainKPIId===mk.id&&p.assigneeId===sel);
            if(mkProjs.length===0) return null;
            const allMkTasks=mkProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===sel));
            const thisWeekCount=allMkTasks.filter(t=>isThisWeek(t)).length;
            const col=krColors[mk.id]||"#3182F6";
            const mkActive=thisWeekCount>0;
            const skIds=[...new Set(mkProjs.map(p=>p.subKPIId).filter(Boolean))];
            const sks=skIds.map(id=>D.subKPIs.find(s=>s.id===id)).filter(Boolean);
            const noSkProjs=mkProjs.filter(p=>!p.subKPIId);
            return(
              <div key={mk.id} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:6}}>
                  <div style={{width:14,height:14,borderRadius:"50%",backgroundColor:mkActive?col:"#D1D5DB",flexShrink:0}}/>
                  <div style={{height:2,width:10,backgroundColor:mkActive?col+"88":"#E5E8EB"}}/>
                  <div style={{backgroundColor:mkActive?col:"#E5E8EB",borderRadius:10,padding:"6px 12px",flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,fontWeight:900,color:mkActive?col:"#9CA3AF",backgroundColor:mkActive?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.7)",padding:"1px 6px",borderRadius:10}}>{mk.krKey}</span>
                        <span style={{fontSize:13,fontWeight:900,color:mkActive?"#FFFFFF":"#6B7280"}}>{mk.title}</span>
                      </div>
                      {mkActive&&<span style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.95)",backgroundColor:"rgba(255,255,255,0.2)",padding:"2px 7px",borderRadius:10}}>이번주 {thisWeekCount}건</span>}
                    </div>
                  </div>
                </div>
                <div style={{marginLeft:6,borderLeft:`2px solid ${mkActive?col+"55":"#E5E8EB"}`}}>
                  {sks.map((sk,skIdx)=>{
                    const skProjs=mkProjs.filter(p=>p.subKPIId===sk.id);
                    const skTasks=skProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===sel));
                    const skActive=skTasks.some(t=>isThisWeek(t));
                    const isLastSk=skIdx===sks.length-1&&noSkProjs.length===0;
                    return(
                      <div key={sk.id} style={{position:"relative",paddingLeft:20,marginBottom:10}}>
                        <div style={{position:"absolute",left:0,top:10,width:16,height:2,backgroundColor:skActive?col+"77":"#D1D5DB"}}/>
                        <div style={{position:"absolute",left:0,top:0,width:2,height:isLastSk?"12px":"100%",backgroundColor:mkActive?col+"44":"#E5E8EB"}}/>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,backgroundColor:skActive?col:"#9CA3AF",border:`2px solid ${skActive?col:"#9CA3AF"}`}}/>
                          <div style={{backgroundColor:skActive?col+"18":"#F2F4F6",borderRadius:8,padding:"4px 10px",border:`1px solid ${skActive?col+"55":"#E5E8EB"}`}}>
                            <span style={{fontSize:11,fontWeight:800,color:skActive?col:"#6B7280"}}>{sk.channelCode} · {sk.title}</span>
                          </div>
                        </div>
                        <div style={{marginLeft:5,borderLeft:`1.5px solid ${skActive?col+"33":"#E5E8EB"}`}}>
                          {skProjs.map((proj,pIdx)=>{
                            const projTasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed&&t.assigneeId===sel);
                            const thisWeekPT=projTasks.filter(t=>isThisWeek(t));
                            const prevPT=projTasks.filter(t=>!isThisWeek(t));
                            const projActive=thisWeekPT.length>0;
                            const assignee=D.users.find(u=>u.id===proj.assigneeId);
                            const isLastP=pIdx===skProjs.length-1;
                            return(
                              <div key={proj.id} style={{position:"relative",paddingLeft:18,marginBottom:8}}>
                                <div style={{position:"absolute",left:0,top:9,width:14,height:1.5,backgroundColor:projActive?col+"44":"#E5E8EB"}}/>
                                <div style={{position:"absolute",left:0,top:0,width:1.5,height:isLastP?"11px":"100%",backgroundColor:skActive?col+"33":"#F2F4F6"}}/>
                                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:projTasks.length>0?5:0}}>
                                  <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:projActive?col+"22":"#F2F4F6",border:`2px solid ${projActive?col:"#D1D5DB"}`,flexShrink:0}}/>
                                  <div style={{backgroundColor:"#FFFFFF",borderRadius:8,padding:"5px 10px",border:`1px solid ${projActive?col+"44":"#E5E8EB"}`,flex:1,display:"flex",alignItems:"center",gap:6}}>
                                    <Ava name={assignee?.name} color={assignee?.color} size={18}/>
                                    <span style={{fontSize:11.5,fontWeight:700,color:projActive?"#0F1F5C":"#9CA3AF",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                                    <span style={{fontSize:10,fontWeight:700,color:projActive?col:"#9CA3AF",flexShrink:0}}>{proj.progress}%</span>
                                  </div>
                                </div>
                                {projTasks.length>0&&(
                                  <div style={{marginLeft:23,borderLeft:"1.5px dashed #E5E8EB"}}>
                                    {thisWeekPT.map((task,tIdx)=>{const st=STATUS_MAP[task.status];return(
                                      <div key={task.id} style={{position:"relative",paddingLeft:14,marginBottom:3}}>
                                        <div style={{position:"absolute",left:0,top:8,width:10,height:1.5,backgroundColor:col+"99"}}/>
                                        <div style={{position:"absolute",left:0,top:0,width:1.5,height:tIdx===thisWeekPT.length-1&&prevPT.length===0?"10px":"100%",backgroundColor:"#E5E8EB"}}/>
                                        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",borderRadius:8,backgroundColor:col+"10",border:`1.5px solid ${col}44`}}>
                                          <div style={{width:6,height:6,borderRadius:"50%",backgroundColor:col,flexShrink:0}}/>
                                          <span style={{fontSize:11.5,fontWeight:700,color:"#111827",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</span>
                                          <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                                            {task.weekDay&&<span style={{fontSize:9,color:col,fontWeight:900}}>{task.weekDay}</span>}
                                            <span style={{fontSize:9,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"1px 5px",borderRadius:4}}>{st.label}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );})}
                                    {prevPT.map((task,tIdx)=>(
                                      <div key={task.id} style={{position:"relative",paddingLeft:14,marginBottom:3}}>
                                        <div style={{position:"absolute",left:0,top:7,width:10,height:1,backgroundColor:"#E5E8EB"}}/>
                                        <div style={{position:"absolute",left:0,top:0,width:1.5,height:tIdx===prevPT.length-1?"9px":"100%",backgroundColor:"#F2F4F6"}}/>
                                        <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:7,opacity:0.45}}>
                                          <div style={{width:5,height:5,borderRadius:"50%",backgroundColor:"#D1D5DB",flexShrink:0}}/>
                                          <span style={{fontSize:10.5,color:"#9CA3AF",flex:1,textDecoration:task.status==="done"?"line-through":"none"}}>{task.title}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {noSkProjs.map((proj,pIdx)=>{
                    const projTasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed&&t.assigneeId===sel);
                    const thisWeekPT=projTasks.filter(t=>isThisWeek(t));
                    const prevPT=projTasks.filter(t=>!isThisWeek(t));
                    const projActive=thisWeekPT.length>0;
                    const assignee=D.users.find(u=>u.id===proj.assigneeId);
                    const isLastP=pIdx===noSkProjs.length-1;
                    return(
                      <div key={proj.id} style={{position:"relative",paddingLeft:20,marginBottom:8}}>
                        <div style={{position:"absolute",left:0,top:9,width:16,height:1.5,backgroundColor:projActive?col+"55":"#E5E8EB"}}/>
                        <div style={{position:"absolute",left:0,top:0,width:2,height:isLastP?"11px":"100%",backgroundColor:mkActive?col+"44":"#E5E8EB"}}/>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#FFFFFF",border:`2px solid ${projActive?col:"#D1D5DB"}`,flexShrink:0}}/>
                          <div style={{backgroundColor:"#FFFFFF",borderRadius:8,padding:"5px 10px",border:`1px solid ${projActive?col+"44":"#E5E8EB"}`,flex:1,display:"flex",alignItems:"center",gap:6}}>
                            <Ava name={assignee?.name} color={assignee?.color} size={18}/>
                            <span style={{fontSize:11.5,fontWeight:700,color:projActive?"#0F1F5C":"#9CA3AF",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                            <span style={{fontSize:10,fontWeight:700,color:projActive?col:"#9CA3AF",flexShrink:0}}>{proj.progress}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function FixedPage({D,cu,lead,add,up,rm,nav}){
  const [form,setForm]=useState({title:"",projectId:"",assigneeId:cu.id,recurType:"daily",weekDay:"월",monthDay:1});
  const [modal,setModal]=useState(false);
  const [viewAll,setViewAll]=useState(false);
  const [confirmId,setConfirmId]=useState(null);
  const [editTarget,setEditTarget]=useState(null);
  const fixed=D.tasks.filter(t=>t.isFixed&&(viewAll&&lead?true:t.assigneeId===cu.id));
  const doAdd=()=>{
    if(!form.title.trim()) return;
    const base={title:form.title.trim(),projectId:form.projectId,type:"fixed",status:"todo",weekSlot:null,isFixed:true,dueDate:"",memo:"",attachments:[],recurType:form.recurType,weekDay:form.recurType==="weekly"?form.weekDay:null,monthDay:form.recurType==="monthly"?Number(form.monthDay):null};
    if(form.assigneeId==="all"){           // 전체 선택 → 전원에게 각각 생성
      D.users.forEach((u,i)=>add("tasks",{id:"t"+Date.now()+"_"+i,...base,assigneeId:u.id}));
    }else{
      add("tasks",{id:"t"+Date.now(),...base,assigneeId:form.assigneeId});
    }
    setForm({title:"",projectId:"",assigneeId:cu.id,recurType:form.recurType,weekDay:form.weekDay,monthDay:form.monthDay});setModal(false);
  };
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{backgroundColor:"rgba(255,237,213,0.4)",borderRadius:14,padding:"12px 14px",marginBottom:14,border:"1px solid rgba(249,115,22,0.2)"}}><p style={{margin:0,fontSize:12.5,fontWeight:700,color:"#EA580C",lineHeight:1.6}}>📌 고정업무는 오늘 업무 페이지에 매일 자동 표시됩니다</p></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:"#4B5563"}}>{fixed.length}개 등록됨</p>
          {lead&&<button onClick={()=>setViewAll(!viewAll)} style={{padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:viewAll?"#0F1F5C":"#F2F4F6",color:viewAll?"#FFFFFF":"#374151",fontWeight:600,fontSize:11,fontFamily:"inherit"}}>{viewAll?"전체 보기":"내 것만"}</button>}
        </div>
        <Btn size="sm" variant="orange" onClick={()=>setModal(true)}>+ 추가</Btn>
      </div>
      {fixed.length===0?(
        <div style={{padding:"40px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}>
          <p style={{fontSize:38,margin:"0 0 12px"}}>📌</p>
          <p style={{fontSize:14,color:"#9CA3AF",margin:"0 0 16px"}}>등록된 고정업무가 없어요</p>
          <Btn variant="orange" onClick={()=>setModal(true)}>+ 첫 고정업무 등록</Btn>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fixed.map(t=>{
            const proj=D.projects.find(p=>p.id===t.projectId);
            const user=D.users.find(u=>u.id===t.assigneeId);
            return(
              <div key={t.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px 16px",border:"1px solid #F2F4F6"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>📌</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:14,fontWeight:800,color:"#111827"}}>{t.title}</p>
                    <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                      {proj&&<Badge color="#8B5CF6" bg="#F3EFFE">📁 {proj.title}</Badge>}
                      <Badge color="#F97316" bg="#FFEDD5">🔄 {t.recurType==="weekly"?(t.weekDay||"월")+"요일":t.recurType==="monthly"?"매월 "+(t.monthDay||1)+"일":"매일"}</Badge>
                      {viewAll&&user&&<Badge color={user.color} bg={user.color+"22"}>👤 {user.name}</Badge>}
                    </div>
                  </div>
                  <button onClick={()=>setEditTarget(t)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:16,padding:8,flexShrink:0}}>✎</button>
                  <button onClick={()=>setConfirmId(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#D1D5DB",fontSize:20,padding:8,flexShrink:0}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Sheet open={modal} onClose={()=>setModal(false)} title="고정업무 추가">
        <div style={{marginTop:12}}>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>업무명 *</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ex. 벤처나라 문의 확인" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>연결 프로젝트</label><select value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">없음</option>{D.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>반복 주기</label><div style={{display:"flex",gap:6}}>{[["daily","매일"],["weekly","매주"],["monthly","매월"]].map(([k,l])=>(<button key={k} onClick={()=>setForm({...form,recurType:k})} style={{flex:1,padding:"10px 0",borderRadius:10,border:`1.5px solid ${form.recurType===k?"#F97316":"#E5E8EB"}`,backgroundColor:form.recurType===k?"#FFEDD5":"#FFFFFF",color:form.recurType===k?"#EA580C":"#6B7280",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}</div>{form.recurType==="weekly"&&<select value={form.weekDay} onChange={e=>setForm({...form,weekDay:e.target.value})} style={{width:"100%",marginTop:8,padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{ALL_DAYS.map(d=><option key={d} value={d}>{d}요일</option>)}</select>}{form.recurType==="monthly"&&<select value={form.monthDay} onChange={e=>setForm({...form,monthDay:Number(e.target.value)})} style={{width:"100%",marginTop:8,padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>매월 {d}일</option>)}</select>}</div>
          {lead&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label><select value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="all">⭐ 전체 (전원에게 생성)</option>{D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>{form.assigneeId==="all"&&<p style={{margin:"6px 2px 0",fontSize:11,color:"#EA580C",fontWeight:700}}>전 담당자 {D.users.length}명에게 각각 생성됩니다</p>}</div>}
          <Btn full variant="orange" onClick={doAdd} disabled={!form.title.trim()}>추가하기</Btn>
        </div>
      </Sheet>
      <EditTaskSheet open={!!editTarget} onClose={()=>setEditTarget(null)} task={editTarget} D={D} onSave={f=>up("tasks",editTarget.id,{title:f.title,status:f.status,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,attachments:f.attachments})}/>
      <Confirm open={!!confirmId} title="고정업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmId)?.title}" 업무를 삭제할까요?`} onOk={()=>{rm("tasks",confirmId);setConfirmId(null);}} onCancel={()=>setConfirmId(null)}/>
    </div>
  );
}
function RetroPage({D,cu,add,up,rm}){
  const month=nowMonth();
  const gp=(g,cv)=>g.inverse?(g.targetValue<=0?0:Math.min(100,Math.round(g.targetValue/Math.max(Number(cv),0.0001)*100))):pct(Number(cv),g.targetValue);
  const [tab,setTab]=useState("goal");
  const myGoals=D.personalGoals.filter(g=>g.userId===cu.id&&g.month===month);
  const myRetros=D.retros.filter(r=>r.userId===cu.id).sort((a,b)=>b.month.localeCompare(a.month));
  const thisMonth=myRetros.find(r=>r.month===month);
  const [retroModal,setRetroModal]=useState(false);
  const [rForm,setRForm]=useState({pain:"",effort:"",learned:"",next:""});
  const [localVals,setLocalVals]=useState({});
  const [goalModal,setGoalModal]=useState(false);
  const [gForm,setGForm]=useState({title:"",targetValue:"",unit:"",inverse:false});
  const getVal=g=>localVals[g.id]!==undefined?localVals[g.id]:g.currentValue;
  const commitVal=g=>{const v=Number(localVals[g.id]??g.currentValue);if(!isNaN(v)&&v!==g.currentValue)up("personalGoals",g.id,{currentValue:v});};
  const overallPct=myGoals.length===0?0:Math.round(myGoals.reduce((s,g)=>s+gp(g,g.currentValue),0)/myGoals.length);
  const openRetro=()=>{
    const gs=myGoals.length>0?myGoals.map(g=>`· ${g.title}: ${g.currentValue}${g.unit}/${g.targetValue}${g.unit} (${gp(g,g.currentValue)}%)`).join("\n"):"";
    setRForm(thisMonth?{...thisMonth}:{pain:"",effort:gs,learned:"",next:""});setRetroModal(true);
  };
  const saveRetro=()=>{
    if(!rForm.pain&&!rForm.effort&&!rForm.learned&&!rForm.next) return;
    if(thisMonth) up("retros",thisMonth.id,{...rForm});
    else add("retros",{...rForm,id:"r"+Date.now(),userId:cu.id,month});
    setRetroModal(false);
  };
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"goal",l:"📊 월간 목표"},{k:"retro",l:"📔 월말 회고"}].map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"10px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:tab===t.k?"#FFFFFF":"transparent",color:tab===t.k?"#0F1F5C":"#6B7280",fontWeight:tab===t.k?800:500,fontSize:13.5,fontFamily:"inherit",boxShadow:tab===t.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>)}
      </div>
      {tab==="goal"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:16,padding:"16px 18px",marginBottom:14,color:"#FFFFFF"}}>
            <p style={{margin:"0 0 4px",fontSize:10.5,fontWeight:700,opacity:0.7}}>{month} 월간 목표</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
              <p style={{margin:0,fontSize:15,fontWeight:800}}>{myGoals.length}개 목표</p>
              <span style={{fontSize:28,fontWeight:900,color:overallPct>=80?"#00C073":"#F97316"}}>{overallPct}%</span>
            </div>
            <PBar value={overallPct} color={overallPct>=80?"#00C073":"#F97316"} h={7}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#4B5563"}}>이번 달 목표 {myGoals.length}개</p>
            <Btn size="sm" variant="orange" onClick={()=>setGoalModal(true)}>+ 목표 추가</Btn>
          </div>
          {myGoals.length===0?(
            <div style={{padding:"40px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}><p style={{fontSize:38,margin:"0 0 12px"}}>🎯</p><p style={{fontSize:14,color:"#9CA3AF"}}>이번 달 목표가 없어요</p></div>
          ):myGoals.map(g=>{
            const cv=getVal(g);
            const p=gp(g,cv);
            const color=p>=100?"#00C073":p>=60?"#3182F6":"#F97316";
            return(
              <div key={g.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"15px 16px",marginBottom:10,border:"1px solid #F2F4F6"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,marginRight:10}}>
                    <p style={{margin:0,fontSize:14,fontWeight:800,color:"#111827"}}>{g.title}</p>
                    <p style={{margin:"3px 0 0",fontSize:11.5,color:"#9CA3AF"}}>목표 {g.targetValue}{g.unit}{g.inverse?" 이내":""}</p>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <span style={{fontSize:20,fontWeight:900,color}}>{p}%</span>
                    {p>=100&&<span>🎉</span>}
                    <button onClick={()=>rm("personalGoals",g.id)} style={{background:"none",border:"none",fontSize:15,cursor:"pointer",color:"#D1D5DB",padding:8}}>✕</button>
                  </div>
                </div>
                <PBar value={p} color={color} h={8}/>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
                  <span style={{fontSize:12,color:"#6B7280",flexShrink:0}}>현재</span>
                  <input type="number" value={localVals[g.id]!==undefined?localVals[g.id]:g.currentValue} onChange={e=>setLocalVals(prev=>({...prev,[g.id]:e.target.value}))} onBlur={()=>commitVal(g)} onKeyDown={e=>e.key==="Enter"&&e.target.blur()} style={{width:80,padding:"6px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:14,fontWeight:800,color,textAlign:"center",fontFamily:"inherit",outline:"none"}}/>
                  <span style={{fontSize:12,color:"#6B7280"}}>{g.unit} / {g.targetValue}{g.unit}</span>
                </div>
              </div>
            );
          })}
          {myGoals.length>0&&(
            <div onClick={()=>setTab("retro")} style={{marginTop:14,padding:"14px 16px",backgroundColor:thisMonth?"#E8FAF1":"#FFEDD5",borderRadius:14,border:`1px solid ${thisMonth?"rgba(0,192,115,0.27)":"rgba(249,115,22,0.27)"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:thisMonth?"#00C073":"#EA580C"}}>{thisMonth?"✅ 이번 달 회고 완료":"📔 월말 회고 작성하기"}</p>
                <p style={{margin:"2px 0 0",fontSize:11.5,color:thisMonth?"#00C073":"#EA580C",opacity:0.8}}>{thisMonth?"탭해서 확인":"목표 달성 현황이 자동으로 채워져요"}</p>
              </div>
              <span style={{fontSize:18,color:thisMonth?"#00C073":"#EA580C"}}>→</span>
            </div>
          )}
        </div>
      )}
      {tab==="retro"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#4B5563"}}>그로스데이 활용 회고</p>
            <Btn size="sm" variant="orange" onClick={openRetro}>{thisMonth?"수정":"+작성"}</Btn>
          </div>
          {myGoals.length>0&&(
            <div style={{backgroundColor:"#FFFFFF",borderRadius:14,padding:"14px 16px",marginBottom:14,border:"1px solid #F2F4F6"}}>
              <p style={{margin:"0 0 10px",fontSize:12,fontWeight:800,color:"#6B7280"}}>📊 이번 달 목표 현황</p>
              {myGoals.map(g=>{const p=gp(g,g.currentValue);const color=p>=100?"#00C073":p>=60?"#3182F6":"#F97316";return(
                <div key={g.id} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12.5,fontWeight:700,color:"#1F2937"}}>{g.title}</span>
                    <span style={{fontSize:12.5,fontWeight:800,color}}>{g.currentValue}{g.unit}/{g.targetValue}{g.unit} · {p}%</span>
                  </div>
                  <PBar value={p} color={color} h={5}/>
                </div>
              );})}
            </div>
          )}
          {myRetros.length===0?(
            <div style={{padding:"40px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}>
              <p style={{fontSize:38,margin:"0 0 12px"}}>📔</p>
              <p style={{fontSize:15,fontWeight:800,color:"#374151",margin:"0 0 6px"}}>아직 회고가 없어요</p>
              <p style={{fontSize:13,color:"#9CA3AF",margin:"0 0 16px"}}>이번 달 성장 기록을 남겨보세요</p>
              <Btn variant="orange" onClick={openRetro}>+ 회고 작성하기</Btn>
            </div>
          ):myRetros.map(retro=>(
            <div key={retro.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"16px",marginBottom:12,border:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div><p style={{margin:0,fontSize:10,fontWeight:800,color:"#3182F6",letterSpacing:1}}>MONTHLY RETRO</p><h3 style={{margin:"3px 0 0",fontSize:16,fontWeight:900,color:"#0F1F5C"}}>{retro.month}</h3></div>
                {retro.month===month&&<button onClick={openRetro} style={{background:"none",border:"none",fontSize:15,cursor:"pointer",color:"#9CA3AF"}}>✎</button>}
                <button onClick={()=>rm("retros",retro.id)} title="삭제" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#D1D5DB",padding:8}}>🗑</button>
              </div>
              {[{key:"pain",icon:"😣",label:"어려움과 고통",color:"#F04452"},{key:"effort",icon:"💪",label:"노력한 실행",color:"#3182F6"},{key:"learned",icon:"📚",label:"배운 것",color:"#00C073"},{key:"next",icon:"🚀",label:"다음에 해볼 것",color:"#8B5CF6"}].map(item=>(
                <div key={item.key} style={{backgroundColor:"#F9FAFB",borderRadius:12,padding:"11px 14px",marginBottom:8}}>
                  <p style={{margin:"0 0 5px",fontSize:12,fontWeight:800,color:item.color}}>{item.icon} {item.label}</p>
                  <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{retro[item.key]||<span style={{color:"#D1D5DB"}}>미작성</span>}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Sheet open={retroModal} onClose={()=>setRetroModal(false)} title="월말 회고 작성">
        <div style={{marginTop:8}}>
          {myGoals.length>0&&<div style={{backgroundColor:"#EBF3FF",borderRadius:12,padding:"10px 13px",marginBottom:14}}><p style={{margin:"0 0 5px",fontSize:11.5,fontWeight:800,color:"#3182F6"}}>📊 이번 달 목표 (자동 반영)</p>{myGoals.map(g=><p key={g.id} style={{margin:"2px 0",fontSize:12,color:"#374151",fontWeight:600}}>· {g.title}: {g.currentValue}{g.unit}/{g.targetValue}{g.unit} ({gp(g,g.currentValue)}%)</p>)}</div>}
          {[{key:"pain",icon:"😣",label:"어려움과 고통",ph:"이번 달 힘들었던 점은?"},{key:"effort",icon:"💪",label:"노력한 실행",ph:"내가 실행한 것들은?"},{key:"learned",icon:"📚",label:"배운 것",ph:"인사이트는?"},{key:"next",icon:"🚀",label:"다음에 해볼 것",ph:"다음 달 시도할 것은?"}].map(item=>(
            <div key={item.key} style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:800,color:"#374151",marginBottom:5}}>{item.icon} {item.label}</label><textarea value={rForm[item.key]} onChange={e=>setRForm({...rForm,[item.key]:e.target.value})} placeholder={item.ph} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"vertical",minHeight:72,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/></div>
          ))}
          <Btn full variant="orange" onClick={saveRetro}>저장하기</Btn>
        </div>
      </Sheet>
      <Sheet open={goalModal} onClose={()=>setGoalModal(false)} title="월간 목표 추가" h="70vh">
        <div style={{marginTop:12}}>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>목표 이름 *</label><input value={gForm.title} onChange={e=>setGForm({...gForm,title:e.target.value})} placeholder="ex. 나라장터 견적 주 5건 발송" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <div style={{flex:2}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>목표값 *</label><input type="number" value={gForm.targetValue} onChange={e=>setGForm({...gForm,targetValue:e.target.value})} placeholder="5" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
            <div style={{flex:1}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>단위</label><input value={gForm.unit} onChange={e=>setGForm({...gForm,unit:e.target.value})} placeholder="건" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          </div>
          <div onClick={()=>setGForm({...gForm,inverse:!gForm.inverse})} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${gForm.inverse?"#F97316":"#E5E8EB"}`,backgroundColor:gForm.inverse?"#FFEDD5":"#F9FAFB",marginBottom:16,cursor:"pointer"}}><div><p style={{margin:0,fontSize:13,fontWeight:700,color:"#374151"}}>낮을수록 좋은 목표</p><p style={{margin:"3px 0 0",fontSize:11,color:"#9CA3AF"}}>처리시간 N일 이내 · 반품률 N% 이하 등</p></div><div style={{width:44,height:26,borderRadius:13,backgroundColor:gForm.inverse?"#F97316":"#D1D5DB",position:"relative",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",backgroundColor:"#FFFFFF",position:"absolute",top:3,left:gForm.inverse?21:3,transition:"left .15s"}}/></div></div><button onClick={()=>{if(!gForm.title.trim()||!gForm.targetValue) return;add("personalGoals",{id:"pg"+Date.now(),userId:cu.id,month,title:gForm.title.trim(),targetValue:Number(gForm.targetValue),currentValue:0,unit:gForm.unit,inverse:gForm.inverse});setGForm({title:"",targetValue:"",unit:"",inverse:false});setGoalModal(false);}} disabled={!gForm.title.trim()||!gForm.targetValue} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:(gForm.title.trim()&&gForm.targetValue)?"#F97316":"#E5E8EB",color:(gForm.title.trim()&&gForm.targetValue)?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:(gForm.title.trim()&&gForm.targetValue)?"pointer":"not-allowed",fontFamily:"inherit"}}>추가하기</button>
        </div>
      </Sheet>
    </div>
  );
}
// 프로젝트에 연결된 이번 주 내 목표 (자유입력 + 진행) — 프로젝트 상세에서 사용
function ProjWeekGoals({D,cu,proj,add,up,rm}){
  const wk=weekKey();
  const [t,setT]=useState(""); const [n,setN]=useState(""); const [u,setU]=useState("건");
  const goals=(D.weekGoals||[]).filter(g=>g.userId===cu.id&&g.week===wk&&g.projectId===proj.id);
  const addG=()=>{ const tt=t.trim(); const tg=Math.max(0,numF(n)); if(!tt||tg<=0)return;
    add("weekGoals",{id:"wg"+Date.now(),userId:cu.id,week:wk,title:tt,target:tg,current:0,unit:(u||"").trim()||"건",projectId:proj.id,createdAt:new Date().toISOString()});
    setT("");setN(""); };
  const bump=(g,d)=>up("weekGoals",g.id,{current:Math.max(0,numF(g.current)+d)});
  return(
    <div style={{background:"#fff",border:"1px solid #E5E8EB",borderRadius:12,padding:"10px 12px"}}>
      <div style={{fontSize:12,fontWeight:800,color:"#0F1F5C",marginBottom:8}}>🎯 이번 주 내 목표 <span style={{fontWeight:600,color:"#9CA3AF"}}>({cu.name})</span></div>
      {goals.map(g=>{const cur=numF(g.current),tg=numF(g.target),ok=wgAchieved(g),pc=tg>0?Math.min(100,Math.round(cur/tg*100)):0;return(
        <div key={g.id} style={{marginBottom:9,padding:"8px 10px",background:ok?"#E8FAF1":"#F9FAFB",borderRadius:10,border:`1px solid ${ok?"rgba(0,192,115,0.3)":"#F2F4F6"}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <span style={{fontSize:12,fontWeight:700,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.title}</span>
            {ok&&<span style={{fontSize:9.5,fontWeight:900,color:"#fff",background:"#00C073",padding:"2px 7px",borderRadius:9}}>✓</span>}
            <span style={{fontSize:10.5,fontWeight:900,color:ok?"#00C073":"#F97316"}}>{cur}/{tg}{g.unit||"건"}</span>
            <button onClick={()=>rm("weekGoals",g.id)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#D1D5DB",padding:3}}>✕</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>bump(g,-1)} style={{width:28,height:28,borderRadius:8,border:"1.5px solid #E5E8EB",background:"#fff",fontSize:15,fontWeight:800,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>−</button>
            <div style={{flex:1,height:6,borderRadius:6,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:`${pc}%`,height:"100%",background:ok?"#00C073":"#F97316",borderRadius:6}}/></div>
            <button onClick={()=>bump(g,1)} style={{width:28,height:28,borderRadius:8,border:"none",background:"#F97316",fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>＋</button>
          </div>
        </div>
      );})}
      <div style={{display:"flex",gap:5}}>
        <input value={t} onChange={e=>setT(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addG();}} placeholder="목표명" style={{flex:1,minWidth:0,padding:"8px 9px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:12,fontWeight:700,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <input type="number" inputMode="numeric" value={n} onChange={e=>setN(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addG();}} placeholder="수치" style={{width:54,flexShrink:0,padding:"8px 6px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:12,fontWeight:800,textAlign:"center",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <input value={u} onChange={e=>setU(e.target.value)} placeholder="단위" style={{width:42,flexShrink:0,padding:"8px 4px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11,fontWeight:700,textAlign:"center",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <button onClick={addG} disabled={!t.trim()||numF(n)<=0} style={{flexShrink:0,padding:"0 11px",borderRadius:8,border:"none",background:t.trim()&&numF(n)>0?"#F97316":"#E5E8EB",color:t.trim()&&numF(n)>0?"#fff":"#9CA3AF",fontSize:12,fontWeight:800,cursor:t.trim()&&numF(n)>0?"pointer":"not-allowed",fontFamily:"inherit"}}>추가</button>
      </div>
    </div>
  );
}
function GamePage({D,cu,up,add,rm,nav}){
  const [gTitle,setGTitle]=useState("");
  if(!cu) return <div style={{padding:"40px 16px",textAlign:"center",color:"#9CA3AF"}}>담당자를 먼저 선택하세요</div>;
  const wk=weekKey();
  const myProjs=D.projects.filter(p=>p.assigneeId===cu.id||(p.collaboratorIds||[]).includes(cu.id));
  const wgoals=myWeekGoals(D,cu.id);
  // 이번 주 내가 한 일 (개인 카운트 · 비교 없음)
  let wTask=0,wSales=0,wAct=0;
  (D.tasks||[]).forEach(t=>{ if(!t.isFixed&&t.status==="done"&&inWeek(t.doneAt,wk)&&(matchUid(D,t.doneBy,t.doneByName)||t.assigneeId)===cu.id) wTask++; });
  (D.projects||[]).forEach(p=>{ (p.salesHistory||[]).forEach(h=>{if(inWeek(h.at,wk)&&matchUid(D,h.by,h.byName)===cu.id)wSales++;}); (p.activityKPIs||[]).forEach(ak=>(ak.history||[]).forEach(h=>{if(inWeek(h.at,wk)&&matchUid(D,h.by,h.byName)===cu.id)wAct++;})); });
  const addGoal=()=>{ const tt=gTitle.trim(); if(!tt)return; add("weekGoals",{id:"wg"+Date.now(),userId:cu.id,week:wk,title:tt,createdAt:new Date().toISOString()}); setGTitle(""); };
  return(
    <div style={{padding:"14px 16px 20px"}}>
      {/* 이번 주 요약 헤더 */}
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:20,padding:"18px",marginBottom:14,color:"#fff"}}>
        <p style={{margin:0,fontSize:11,fontWeight:800,opacity:0.7,letterSpacing:2}}>{weekLabel(wk)} · 내 주간</p>
        <p style={{margin:"6px 0 0",fontSize:21,fontWeight:900}}>이번 주 나의 한 주</p>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          {[["완료 업무",wTask,"✅"],["매출 입력",wSales,"💰"],["목표지표",wAct,"🎯"]].map(([l,v,ic])=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,0.12)",borderRadius:12,padding:"9px 6px",textAlign:"center"}}>
              <p style={{margin:0,fontSize:17,fontWeight:900}}>{ic} {v}</p>
              <p style={{margin:"1px 0 0",fontSize:9.5,opacity:0.8}}>{l}</p>
            </div>
          ))}
        </div>
      </div>
      <h3 style={{margin:"0 2px 8px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>📝 이번 주 명심할 것</h3>
      <p style={{margin:"0 2px 10px",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>그냥 메모예요. 수치·달성 추적 없이, 이번 주 잊지 말 것만 적어두세요. (어디에도 집계 안 됨)</p>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"12px 14px",marginBottom:12,display:"flex",gap:7}}>
        <input value={gTitle} onChange={e=>setGTitle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addGoal();}} placeholder="예: 거래처 단가표 업데이트 잊지 말기" style={{flex:1,minWidth:0,padding:"11px 12px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:13.5,fontWeight:600,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <button onClick={addGoal} disabled={!gTitle.trim()} style={{flexShrink:0,padding:"0 16px",borderRadius:10,border:"none",background:gTitle.trim()?"#F97316":"#E5E8EB",color:gTitle.trim()?"#fff":"#9CA3AF",fontSize:14,fontWeight:800,cursor:gTitle.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>＋</button>
      </div>
      {wgoals.length===0&&<div style={{padding:"24px 20px",textAlign:"center",background:"#F9FAFB",borderRadius:14,border:"1px solid #F2F4F6",marginBottom:8}}><p style={{margin:0,fontSize:13,color:"#9CA3AF"}}>아직 메모가 없어요 · 위에 적어두세요</p></div>}
      {wgoals.map(g=>(
        <div key={g.id} style={{background:"#fff",borderRadius:12,border:"1px solid #F2F4F6",padding:"11px 13px",marginBottom:7,display:"flex",alignItems:"center",gap:9}}>
          <span style={{flexShrink:0,color:"#F97316",fontSize:14}}>📌</span>
          <span style={{flex:1,minWidth:0,fontSize:13.5,fontWeight:600,color:"#1F2937"}}>{g.title}</span>
          <button onClick={()=>rm("weekGoals",g.id)} style={{flexShrink:0,background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#D1D5DB",padding:4}}>✕</button>
        </div>
      ))}
      <h3 style={{margin:"18px 2px 8px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>👥 프로젝트 기여 현황</h3>
      <p style={{margin:"0 2px 10px",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>내가 맡은 프로젝트에 <b>누가 얼마나</b> 기여했는지(완료 업무·매출·목표지표 기록 기준)예요.</p>
      {myProjs.filter(p=>projContrib(D,p).length>0).map(p=>{const rows=projContrib(D,p);const max=Math.max(...rows.map(r=>r.total),1);return(
        <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"12px 14px",marginBottom:8}}>
          <p style={{margin:"0 0 8px",fontSize:12.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</p>
          {rows.map(r=>{const u=D.users.find(x=>x.id===r.uid);const w=Math.round(r.total/max*100);const isMe=r.uid===cu.id;return(
            <div key={r.uid} style={{marginBottom:7}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <Ava name={u?.name} color={u?.color} size={20}/>
                <span style={{fontSize:11.5,fontWeight:700,color:isMe?"#EA580C":"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u?.name||"?"}{isMe&&" (나)"}</span>
                <span style={{fontSize:10.5,color:"#9CA3AF",flexShrink:0}}>업무{r.task}·매출{r.sales}·지표{r.act}{r.wk>0?` · 이번주 ${r.wk}`:""}</span>
              </div>
              <div style={{height:6,borderRadius:6,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:`${w}%`,height:"100%",background:isMe?"#F97316":"#9CA3AF",borderRadius:6}}/></div>
            </div>
          );})}
        </div>
      );})}
    </div>
  );
}
// 모든 데이터 자산을 CSV로 추출 (추출 사각 제거)
function ExportPanel({D,up}){
  const uname=(id)=>D.users.find(u=>u.id===id)?.name||"";
  // 예시(데모) KPI·채널 수치 0으로 초기화 — 목표·구조는 유지, 현재 숫자만 비움
  const resetNums=()=>{
    if(!up) return;
    if(!window.confirm("KPI·채널의 현재 수치를 모두 0으로 초기화할까요?\n목표·구조(직판/B2B/운영·채널)는 그대로 두고 예시 숫자만 비웁니다.\n(되돌리려면 아래 '전체 백업(JSON)'을 먼저 받아두세요)")) return;
    (D.subKPIs||[]).forEach(s=>up("subKPIs",s.id,{currentValue:0,valueHistory:[]}));
    (D.mainKPIs||[]).forEach(m=>up("mainKPIs",m.id,{currentValue:0,valueHistory:[]}));
    (D.goals||[]).forEach(g=>up("goals",g.id,{currentValue:0}));
  };
  const goalTypeL={revenue:"매출",metric:"수치목표",journey:"여정"};
  const expProjects=()=>{
    const rows=[["제목","그룹","담당자","목표유형","거래처유형","메인KPI","서브KPI","우선순위","상태","진척도%","진척방식","업무(완료/전체)","매출(원)","매출입력자","매출최종일","목표지표"]];
    (D.projects||[]).forEach(p=>{const mk=D.mainKPIs.find(m=>m.id===p.mainKPIId);const sk=D.subKPIs.find(s=>s.id===p.subKPIId);const ts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);const dn=ts.filter(t=>t.status==="done").length;const aks=(p.activityKPIs||[]).map(ak=>`${ak.name} ${numF(ak.current)}/${numF(ak.target)}${ak.unit||""}`).join(" · ");rows.push([p.title,p.group||"",uname(p.assigneeId),goalTypeL[p.goalType]||"",p.dealerType||"",mk?.title||"",sk?.title||"",p.priority||"",p.status||"",p.progress||0,p.progressManual?"수동":"자동",`${dn}/${ts.length}`,numF(p.resultValue),p.salesByName||"",(p.salesAt||"").slice(0,10),aks]);});
    downloadCSV(rows,"프로젝트");
  };
  const expSales=()=>{
    const rows=[["일시","주차","프로젝트","거래처유형","서브KPI","이전매출","변동","매출(원)","입력자"]];
    (D.projects||[]).forEach(p=>{const sk=D.subKPIs.find(s=>s.id===p.subKPIId);(p.salesHistory||[]).forEach(h=>rows.push([(h.at||"").slice(0,16).replace("T"," "),h.week||"",p.title,p.dealerType||"",sk?.title||"",numF(h.prev),numF(h.delta),numF(h.value),h.byName||""]));});
    if(rows.length===1)return alert("매출 입력 이력이 없어요");
    downloadCSV(rows,"매출이력");
  };
  const expKpi=()=>{
    const rows=[["구분","KPI명","단위","주차","입력방식","이전","값","입력자","일시"]];
    const add=(kind,item)=>(item.valueHistory||[]).forEach(h=>rows.push([kind,item.title,item.unit||"",h.week||"",h.mode==="total"?"총값":"추가",numF(h.prev),numF(h.value),h.byName||"",(h.at||"").slice(0,16).replace("T"," ")]));
    (D.mainKPIs||[]).forEach(m=>add("메인KPI",m));(D.subKPIs||[]).forEach(s=>add("서브KPI",s));
    if(rows.length===1)return alert("KPI 주차 실적 이력이 없어요");
    downloadCSV(rows,"KPI주차실적");
  };
  const expContrib=()=>{
    const rows=[["프로젝트","담당자","완료업무","매출입력","목표지표","합계","이번주"]];
    (D.projects||[]).forEach(p=>projContrib(D,p).forEach(r=>rows.push([p.title,uname(r.uid),r.task,r.sales,r.act,r.total,r.wk])));
    if(rows.length===1)return alert("기여 기록이 없어요");
    downloadCSV(rows,"기여도");
  };
  const expIndicators=()=>{
    const rows=[["프로젝트","지표명","단위","현재","목표","달성%","최종입력자"]];
    (D.projects||[]).forEach(p=>(p.activityKPIs||[]).forEach(ak=>rows.push([p.title,ak.name,ak.unit||"",numF(ak.current),numF(ak.target),pct(numF(ak.current),numF(ak.target)),ak.byName||""])));
    if(rows.length===1)return alert("목표지표가 없어요");
    downloadCSV(rows,"목표지표");
  };
  const expWeekGoals=()=>{
    const rows=[["주차","담당자","메모"]];
    (D.weekGoals||[]).forEach(g=>rows.push([g.week,uname(g.userId),g.title]));
    if(rows.length===1)return alert("주간 메모가 없어요");
    downloadCSV(rows,"주간메모");
  };
  // 업무(task) 추출 — 일일 활동의 원본 자산 (데이터 자산화 핵심)
  const expTasks=()=>{
    const rows=[["업무","프로젝트","담당자","상태","완료일시","요일","고정","단계","마감","메모"]];
    (D.tasks||[]).forEach(t=>{const p=D.projects.find(x=>x.id===t.projectId);rows.push([t.title,p?.title||"",uname(t.assigneeId),t.status||"",(t.doneAt||"").slice(0,16).replace("T"," "),t.weekDay||"",t.isFixed?"고정":"",t.launchNode?numF(t.step)+1:"",t.dueDate||"",(t.memo||"").replace(/\n/g," ")]);});
    if(rows.length===1)return alert("업무 기록이 없어요");
    downloadCSV(rows,"업무");
  };
  const items=[["✅ 업무 전체",expTasks],["📁 프로젝트 전체",expProjects],["💰 매출 이력",expSales],["📊 KPI 주차 실적",expKpi],["👥 기여도",expContrib],["🎯 목표지표",expIndicators],["📝 주간 메모",expWeekGoals]];
  // 분할 저장 → 한도는 컬렉션별로 적용. 가장 큰 컬렉션이 실질 제약.
  const colSizes=SHARED_KEYS.map(k=>[k,new Blob([JSON.stringify(pickShared(D)[k]||[])]).size]).sort((a,b)=>b[1]-a[1]);
  const [maxKey,maxBytes]=colSizes[0]||["",0];
  const totalBytes=colSizes.reduce((s,[,b])=>s+b,0);
  const pctUsed=Math.min(100,Math.round(maxBytes/DOC_LIMIT*100));
  const barColor=pctUsed>=85?"#DC2626":pctUsed>=60?"#D97706":"#059669";
  const mirrorAt=(()=>{try{return localStorage.getItem(MIRROR_AT_KEY);}catch(_){return null;}})();
  return(
    <div style={{background:"#FFFFFF",borderRadius:16,padding:"14px 16px",marginTop:14,border:"1px solid #F2F4F6"}}>
      <h3 style={{margin:"0 0 3px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>💾 백업 · 데이터 추출</h3>
      <p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>정기적으로 <b>전체 백업(JSON)</b>을 내려받아 안전하게 보관하세요</p>
      <button onClick={resetNums} style={{width:"100%",display:"flex",alignItems:"center",gap:8,backgroundColor:"#FFF7ED",border:"1px dashed #FDBA74",borderRadius:11,padding:"10px 12px",marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        <span style={{fontSize:16}}>🧹</span>
        <span style={{flex:1,fontSize:12,fontWeight:700,color:"#9A3412"}}>예시 KPI·채널 수치 0으로 초기화 <span style={{fontWeight:600,color:"#B45309"}}>(목표·구조는 유지)</span></span>
        <span style={{fontSize:12,fontWeight:800,color:"#EA580C"}}>실행</span>
      </button>
      {/* 저장 용량 게이지 — 1MiB 한도 대비 */}
      <div style={{marginBottom:10,padding:"10px 12px",background:"#F9FAFB",borderRadius:11,border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:800,color:"#374151"}}>최대 컬렉션 「{COL_LABEL[maxKey]||maxKey}」 {(maxBytes/1024).toFixed(0)}KB / 1024KB</span>
          <span style={{fontSize:11,fontWeight:800,color:barColor}}>{pctUsed}%</span>
        </div>
        <div style={{height:7,borderRadius:4,background:"#E5E8EB",overflow:"hidden"}}><div style={{width:`${pctUsed}%`,height:"100%",background:barColor,transition:"width .3s"}}/></div>
        <p style={{margin:"6px 0 0",fontSize:9.5,color:"#9CA3AF"}}>전체 {(totalBytes/1024).toFixed(0)}KB · 컬렉션별로 1024KB 한도가 따로 적용돼요(분할 저장)</p>
        {pctUsed>=60&&<p style={{margin:"4px 0 0",fontSize:10,fontWeight:700,color:barColor}}>{pctUsed>=85?"⚠️ 한도 임박 — 백업 후 오래된 데이터 정리 필요":"용량이 늘고 있어요 — 정기 백업 권장"}</p>}
        {mirrorAt&&<p style={{margin:"4px 0 0",fontSize:9.5,color:"#9CA3AF"}}>🛟 이 기기 자동 거울저장: {mirrorAt.slice(0,16).replace("T"," ")}</p>}
      </div>
      <button onClick={()=>downloadStateBackup(D)} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",color:"#fff",fontSize:13.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>💾 전체 백업(JSON) 내려받기</button>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#6B7280"}}>항목별 추출 (엑셀/CSV)</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {items.map(([l,fn])=>(<button key={l} onClick={fn} style={{padding:"11px 8px",borderRadius:11,border:"1.5px solid #E5E8EB",background:"#F9FAFB",fontSize:12,fontWeight:700,color:"#374151",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>⬇ {l}</button>))}
      </div>
    </div>
  );
}
function AIPage({D,cu,add,rm}){
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [type,setType]=useState("kpi");
  const [q,setQ]=useState("");
  const [saved,setSaved]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const myReviews=D.aiReviews?.filter(r=>r.userId===cu.id)||[];
  const ctx=()=>{
    const goal=D.goals[0];
    const goalCur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
    const totalPct=pct(goalCur,goal?.targetValue||1);
    const krs=D.mainKPIs.map(mk=>{const mc=mkCur(mk,D.subKPIs,D.projects);return `${mk.krKey}(${mk.title}): ${fmt(mc,mk.unit)}/${fmt(mk.targetValue,mk.unit)} ${pct(mc,mk.targetValue)}%`;}).join("\n");
    const subs=D.subKPIs.map(sk=>`  채널 ${sk.channelCode}: ${fmt(skCur(sk,D.projects),sk.unit)}/${fmt(sk.targetValue,sk.unit)} ${pct(skCur(sk,D.projects),sk.targetValue)}%`).join("\n");
    const projs=D.projects.filter(p=>p.assigneeId===cu.id).map(p=>`  ${p.title}: ${p.progress}%`).join("\n");
    return `=== POUR스토어 KPI 현황 ===\n목표: ${goal?.title} (${totalPct}% 달성)\n\n[메인KPI]\n${krs}\n\n[채널별 KPI]\n${subs}\n\n[${cu.name} 담당 프로젝트]\n${projs}`;
  };
  const weeklyCtx=()=>{
    const wk=weekKey();
    const goal=D.goals[0];
    const goalCur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
    const krs=D.mainKPIs.map(mk=>{const mc=mkCur(mk,D.subKPIs,D.projects);return `${mk.krKey} ${mk.title}: ${fmt(mc,mk.unit)}/${fmt(mk.targetValue,mk.unit)} (${pct(mc,mk.targetValue)}%)`;}).join("\n");
    const wkEntries=[];
    [...D.subKPIs,...D.mainKPIs].forEach(it=>{(it.valueHistory||[]).filter(h=>h.week===wk).forEach(h=>wkEntries.push(`${it.title}: ${h.mode==="delta"?"+":""}${fmt(h.mode==="delta"?h.amount:h.value,it.unit)} (${h.byName||"-"})`));});
    const byUser=D.users.map(u=>{const t=D.tasks.filter(x=>x.assigneeId===u.id);const done=t.filter(x=>x.status==="done").length;const ap=D.projects.filter(p=>p.assigneeId===u.id);const avg=ap.length?Math.round(ap.reduce((s,p)=>s+(p.progress||0),0)/ap.length):0;return `${u.name}: 업무 ${done}/${t.length} 완료, 담당 프로젝트 ${ap.length}개 평균 ${avg}%`;}).join("\n");
    return `=== 주간 팀 점검 (${weekLabel(wk)}) ===\n최종목표: ${goal?.title} ${pct(goalCur,goal?.targetValue||1)}%\n\n[메인KPI]\n${krs}\n\n[이번 주 입력 실적]\n${wkEntries.length?wkEntries.join("\n"):"(이번 주 입력 없음)"}\n\n[팀원별 현황]\n${byUser}`;
  };
  const run=async()=>{
    setLoading(true);setResult(null);setSaved(false);
    const c=type==="weekly"?weeklyCtx():ctx();
    const prompt=type==="kpi"?`${c}\n\nPOUR스토어 KPI 현황 분석:\n1. 달성률 낮은 채널과 원인\n2. 즉시 개선 액션 3가지\n3. 이번 주 집중해야 할 것\n한국어로 간결하게.`:type==="ab"?`${c}\n\nAB테스트 관점:\n1. 직판 vs B2B 실행력 비교\n2. 채널별 효율 분석\n3. 리소스 재배분 제안\n한국어로.`:type==="weekly"?`${c}\n\n팀 리드 관점에서 이번 주 점검을 해줘:\n1. 이번 주 성과 (잘된 점)\n2. 우려·지연 (막힌 곳)\n3. 다음 주 팀이 집중할 액션 3가지\n한국어로 간결하게.`:`${c}\n\n질문: ${q}\n한국어로 답변.`;
    try{
      const res=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const d=await res.json();
      setResult(d.content?.[0]?.text||"결과를 가져오지 못했습니다.");
    }catch(e){setResult("오류가 발생했습니다.");}
    setLoading(false);
  };
  const saveResult=()=>{
    if(!result||saved) return;
    add("aiReviews",{id:"ai"+Date.now(),userId:cu.id,type,question:type==="custom"?q:"",result,model:"claude-sonnet-4-20250514",savedAt:new Date().toISOString(),label:type==="kpi"?"KPI 분석":type==="ab"?"메인KPI 비교":type==="weekly"?"주간점검 "+weekLabel(weekKey()):"질문: "+q.slice(0,30)});
    setSaved(true);
  };
  const TYPE_LABELS={kpi:"📊 KPI 분석",ab:"🧪 메인KPI 비교",weekly:"📅 주간점검",custom:"💬 질문"};
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"16px",marginBottom:14,border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#3182F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>✦</div>
          <div style={{flex:1}}><h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>AI 코치</h3><p style={{margin:0,fontSize:11.5,color:"#9CA3AF"}}>POUR 실제 데이터 기반 분석</p></div>
          <button onClick={()=>setShowHistory(!showHistory)} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:showHistory?"#0F1F5C":"#FFFFFF",color:showHistory?"#FFFFFF":"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>📋 {myReviews.length}건</button>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:14,backgroundColor:"#F9FAFB",borderRadius:12,padding:4}}>
          {[{k:"kpi",l:"📊 KPI"},{k:"weekly",l:"📅 주간점검"},{k:"ab",l:"🧪 KR비교"},{k:"custom",l:"💬 질문"}].map(t=><button key={t.k} onClick={()=>setType(t.k)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:type===t.k?"#FFFFFF":"transparent",color:type===t.k?"#0F1F5C":"#6B7280",fontWeight:type===t.k?800:500,fontSize:11,fontFamily:"inherit",boxShadow:type===t.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>)}
        </div>
        {type==="custom"&&<textarea value={q} onChange={e=>setQ(e.target.value)} placeholder="POUR 데이터 기반 질문을 입력하세요..." style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"none",height:90,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:12}}/>}
        <button onClick={run} disabled={loading||(type==="custom"&&!q.trim())} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:(loading||(type==="custom"&&!q.trim()))?"#E5E8EB":"#F97316",color:(loading||(type==="custom"&&!q.trim()))?"#9CA3AF":"#FFFFFF",fontSize:15,fontWeight:700,cursor:(loading||(type==="custom"&&!q.trim()))?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {loading?"⏳ 분석 중...":"AI 분석 시작하기"}
        </button>
      </div>
      {loading&&<div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"30px 20px",textAlign:"center",border:"1px solid #F2F4F6"}}><div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #EBF3FF",borderTopColor:"#3182F6",animation:"spin 0.8s linear infinite",margin:"0 auto 14px"}}/><p style={{margin:0,fontSize:14,color:"#6B7280"}}>POUR 데이터 분석 중...</p><style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style></div>}
      {result&&(
        <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"16px",border:"1px solid #F2F4F6",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>✦</span><h3 style={{margin:0,fontSize:14,fontWeight:800,color:"#0F1F5C"}}>분석 결과</h3><Badge color="#3182F6" bg="#EBF3FF">{TYPE_LABELS[type]}</Badge></div>
            <button onClick={saveResult} disabled={saved} style={{padding:"6px 14px",borderRadius:10,border:"none",backgroundColor:saved?"#E8FAF1":"#FFEDD5",color:saved?"#00C073":"#EA580C",fontSize:12,fontWeight:700,cursor:saved?"default":"pointer",fontFamily:"inherit",flexShrink:0}}>{saved?"✅ 저장됨":"💾 저장"}</button>
          </div>
          <p style={{margin:0,fontSize:14,color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</p>
        </div>
      )}
      {showHistory&&(
        <div>
          <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📋 저장된 분석 ({myReviews.length}건)</h3>
          {myReviews.length===0?(
            <div style={{padding:"30px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}><p style={{margin:0,fontSize:13,color:"#D1D5DB"}}>아직 저장된 분석이 없어요</p><p style={{margin:"4px 0 0",fontSize:12,color:"#D1D5DB"}}>결과 확인 후 💾 저장 버튼을 탭하세요</p></div>
          ):myReviews.slice().reverse().map((r,i)=>(
            <div key={r.id||i} style={{backgroundColor:"#FFFFFF",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><Badge color="#3182F6" bg="#EBF3FF">{TYPE_LABELS[r.type]||r.type}</Badge><span style={{fontSize:12,color:"#9CA3AF"}}>{r.savedAt?.slice(0,10)||""}</span></div>
                <button onClick={()=>rm("aiReviews",r.id)} title="삭제" style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#D1D5DB",padding:8}}>🗑</button>
              </div>
              {r.question&&<p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#4B5563"}}>Q: {r.question}</p>}
              <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:120,overflow:"hidden"}}>{r.result}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
