import { useState, useEffect, useRef } from "react";
import { STATE_DOC, onSnapshot, setDoc, uploadTaskPhoto, deleteTaskPhoto } from "./firebase.js";

// Firestore 단일 문서에 저장할 공유 데이터 키 (currentUser는 기기별 로컬이라 제외)
const SHARED_KEYS = ["users","goals","mainKPIs","subKPIs","projects","tasks","personalGoals","retros","aiReviews","events"];
const LOCAL_USER_KEY = "pour-os-current-user";
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
};
const pct=(c,t)=>t===0||t==null?0:Math.min(100,Math.round((c/t)*100));
// 주차 헬퍼 (월요일 시작)
const weekKey=(d=new Date())=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const weekLabel=(key)=>{const m=new Date(key);const su=new Date(m);su.setDate(su.getDate()+6);const f=z=>`${z.getMonth()+1}/${z.getDate()}`;return `${f(m)}~${f(su)}`;};
// 메인KPI2(B2B): 서브KPI 현재값 = 자식 프로젝트 매출 성과(resultValue) 합계 / 메인KPI1·3: 수동값
const skCur=(sk,projects)=>(sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride)?(projects||[]).filter(p=>p.subKPIId===sk.id).reduce((a,p)=>a+(p.resultValue||0),0):(sk.currentValue||0);
const mkCur=(mk,subKPIs,projects)=>mk.unit==="원"?subKPIs.filter(s=>s.mainKPIId===mk.id).reduce((a,s)=>a+skCur(s,projects),0):(mk.currentValue||0);
const fmt=(n,u)=>{
  if(!n||isNaN(n)) return "0"+(u||"");
  if(u==="원"&&n>=100000000) return (n/100000000).toFixed(1)+"억";
  if(u==="원"&&n>=10000) return Math.round(n/10000).toLocaleString()+"만";
  return n.toLocaleString()+(u||"");
};
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
const EditTaskSheet=({open,onClose,task,onSave,D})=>{
  const [form,setForm]=useState({title:"",status:"todo",dueDate:"",memo:"",projectId:"",attachments:[]});
  const [prevId,setPrevId]=useState(null);
  const [uploading,setUploading]=useState(false);
  if(task&&task.id!==prevId){setPrevId(task.id);setForm({title:task.title||"",status:task.status||"todo",dueDate:task.dueDate||"",memo:task.memo||"",projectId:task.projectId||"",attachments:Array.isArray(task.attachments)?task.attachments:[]});}
  if(!task&&prevId!==null){setPrevId(null);setForm({title:"",status:"todo",dueDate:"",memo:"",projectId:"",attachments:[]});}
  const onPick=async(files)=>{
    const list=Array.from(files||[]).filter(f=>f.type.startsWith("image/"));
    if(!list.length||!task)return;
    setUploading(true);
    try{ const added=[]; for(const f of list){ if(f.size>5*1024*1024){alert(`${f.name}: 5MB 초과`);continue;} added.push(await uploadTaskPhoto(task.id,f)); }
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
          <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,fontWeight:700,color:"#374151",marginBottom:7}}><span>📎 사진 첨부 ({(form.attachments||[]).length})</span>{uploading&&<span style={{fontSize:11,color:"#F97316",fontWeight:700}}>업로드 중…</span>}</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(form.attachments||[]).map((att,i)=>(
              <div key={att.url||i} style={{position:"relative",width:72,height:72,borderRadius:10,overflow:"hidden",border:"1px solid #E5E8EB"}}>
                <a href={att.url} target="_blank" rel="noopener noreferrer"><img src={att.url} alt={att.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></a>
                <button onClick={()=>rmPhoto(att)} style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:12,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
              </div>
            ))}
            <label style={{width:72,height:72,borderRadius:10,border:"1.5px dashed #D1D5DB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:task?"pointer":"not-allowed",color:"#9CA3AF",opacity:task?1:0.5}}>
              <span style={{fontSize:22}}>＋</span><span style={{fontSize:9,fontWeight:700}}>사진</span>
              <input type="file" accept="image/*" multiple disabled={!task||uploading} onChange={e=>onPick(e.target.files)} style={{display:"none"}}/>
            </label>
          </div>
          <p style={{margin:"6px 2px 0",fontSize:10,color:"#9CA3AF"}}>이미지 · 각 5MB 이내 · 저장하면 task에 기록됩니다</p>
        </div>
        <button onClick={()=>{if(form.title.trim()){onSave(form);onClose();}}} disabled={!form.title.trim()||uploading} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:form.title.trim()&&!uploading?"#F97316":"#E5E8EB",color:form.title.trim()&&!uploading?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:form.title.trim()&&!uploading?"pointer":"not-allowed",fontFamily:"inherit"}}>저장하기</button>
      </div>
    </Sheet>
  );
};
const TABS=[{id:"today",icon:"🏠",label:"오늘"},{id:"kpi",icon:"◎",label:"KPI"},{id:"projects",icon:"▦",label:"프로젝트"},{id:"calendar",icon:"▤",label:"캘린더"},{id:"more",icon:"⋯",label:"더보기"}];
const MORE=[{id:"mindmap",icon:"◈",label:"업무 보드"},{id:"fixed",icon:"📌",label:"고정업무"},{id:"retro",icon:"◷",label:"목표·회고"},{id:"ai",icon:"✦",label:"AI 코치"}];
export default function App(){
  const [D,setD]=useState(INIT);
  const [page,setPage]=useState("today");
  const [more,setMore]=useState(false);
  const [uSheet,setUSheet]=useState(false);
  // 화면 모드 (PC / 모바일) — 기본은 화면폭 자동, 토글로 전환, localStorage 기억
  const [viewMode,setViewMode]=useState(()=>localStorage.getItem("pour-os-view")||((typeof window!=="undefined"&&window.innerWidth>=1024)?"pc":"mobile"));
  useEffect(()=>{ localStorage.setItem("pour-os-view",viewMode); },[viewMode]);
  // ── Firestore 단일 문서 영속화 (4명 실시간 공유) ──
  const [loaded,setLoaded]=useState(false);
  const lastSyncedRef=useRef(null);   // 마지막으로 동기화된 공유데이터 JSON (에코 쓰기 방지)
  const loadedRef=useRef(false);
  // 구독: 원격 변경 수신 + 최초 시드
  useEffect(()=>{
    const savedUser=localStorage.getItem(LOCAL_USER_KEY);
    if(savedUser) setD(p=>({...p,currentUser:savedUser}));
    const unsub=onSnapshot(STATE_DOC,(snap)=>{
      if(snap.metadata.hasPendingWrites) return;          // 내 쓰기 에코는 무시
      if(!snap.exists()){                                  // 최초 실행 → INIT으로 시드
        const shared=JSON.parse(JSON.stringify(pickShared(INIT)));
        lastSyncedRef.current=JSON.stringify(shared);
        setDoc(STATE_DOC,{...shared,_updatedAt:Date.now()}).catch(e=>console.error("[pour-os] 시드 저장 실패:",e));
        console.log("[pour-os] 신규 상태 문서 생성(시드)");
        loadedRef.current=true; setLoaded(true); return;
      }
      const shared=pickShared(snap.data());
      lastSyncedRef.current=JSON.stringify(shared);
      setD(p=>({...p,...shared}));                          // currentUser·UI 상태는 보존
      console.log(`[pour-os] 원격 동기화: projects ${shared.projects?.length||0} / tasks ${shared.tasks?.length||0}`);
      loadedRef.current=true; setLoaded(true);
    },(err)=>{ console.error("[pour-os] 구독 실패:",err); setLoaded(true); });
    return ()=>unsub();
  },[]);
  // currentUser는 기기별 로컬에만 저장
  useEffect(()=>{ if(D.currentUser) localStorage.setItem(LOCAL_USER_KEY,D.currentUser); },[D.currentUser]);
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
  // 변경 시 디바운스 저장 (공유데이터가 마지막 동기화본과 다를 때만)
  useEffect(()=>{
    if(!loaded) return;
    const json=JSON.stringify(pickShared(D));
    if(json===lastSyncedRef.current) return;               // 변화 없음(=원격 수신 직후) → 저장 스킵
    const t=setTimeout(()=>{
      lastSyncedRef.current=json;
      setDoc(STATE_DOC,{...JSON.parse(json),_updatedAt:Date.now()}).catch(e=>console.error("[pour-os] 저장 실패:",e));
    },700);
    return ()=>clearTimeout(t);
  },[D,loaded]);
  const cu=D.users.find(u=>u.id===D.currentUser);
  const lead=cu?.role==="lead";
  const set=(k,v)=>setD(p=>({...p,[k]:v}));
  const add=(k,item)=>setD(p=>({...p,[k]:[...p[k],item]}));
  const up=(k,id,c)=>setD(p=>({...p,[k]:p[k].map(i=>i.id===id?{...i,...c}:i)}));
  const rm=(k,id)=>setD(p=>({...p,[k]:p[k].filter(i=>i.id!==id)}));
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
    {page==="kpi"&&<KPIPage D={D} lead={lead} up={up} cu={cu}/>}
    {page==="projects"&&<ProjectsPage D={D} cu={cu} up={up} add={add} rm={rm}/>}
    {page==="calendar"&&<CalendarPage D={D} cu={cu} add={add}/>}
    {page==="mindmap"&&<MindMapPage D={D} cu={cu}/>}
    {page==="fixed"&&<FixedPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="retro"&&<RetroPage D={D} cu={cu} add={add} up={up} rm={rm}/>}
    {page==="ai"&&<AIPage D={D} cu={cu} add={add}/>}
  </>);
  const sheets=(<>
    <Sheet open={more} onClose={()=>setMore(false)} title="더보기">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
        {MORE.map(m=>(
          <button key={m.id} onClick={()=>nav(m.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"20px 12px",borderRadius:14,backgroundColor:"#F9FAFB",border:"1px solid #E5E8EB",cursor:"pointer"}}>
            <span style={{fontSize:28}}>{m.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:"#1F2937"}}>{m.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
    <Sheet open={uSheet} onClose={()=>setUSheet(false)} title="담당자 전환">
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
        {D.users.map(u=>(
          <button key={u.id} onClick={()=>{set("currentUser",u.id);setUSheet(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,backgroundColor:D.currentUser===u.id?"#FFEDD5":"#F9FAFB",border:`1.5px solid ${D.currentUser===u.id?"#F97316":"#E5E8EB"}`,cursor:"pointer",textAlign:"left"}}>
            <Ava name={u.name} color={u.color} size={40}/>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:800,color:"#111827"}}>{u.name}</p>
              <p style={{margin:0,fontSize:12,color:"#9CA3AF"}}>{u.dept}{u.role==="lead"?" · 리드":""}</p>
            </div>
            {D.currentUser===u.id&&<span style={{marginLeft:"auto",fontSize:18,color:"#F97316"}}>✓</span>}
          </button>
        ))}
      </div>
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
    <div style={{display:"flex",height:"100vh",backgroundColor:"#F9FAFB",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",overflow:"hidden",maxWidth:1320,margin:"0 auto"}}>
      <aside style={{width:216,backgroundColor:"#FFFFFF",borderRight:"1px solid #F2F4F6",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 16px 13px",display:"flex",alignItems:"center",gap:9,borderBottom:"1px solid #F4F4F5"}}>
          <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:900}}>P</div>
          <div><p style={{margin:0,fontSize:14.5,fontWeight:900,color:"#0F1F5C",lineHeight:1.1}}>POUR OS</p><p style={{margin:0,fontSize:9.5,color:"#F97316",fontWeight:800}}>업무관리</p></div>
        </div>
        <nav style={{flex:1,overflowY:"auto",padding:8}}>
          {navAll.map(it=>{const act=page===it.id;return(
            <button key={it.id} onClick={()=>nav(it.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:act?"#FFF1E7":"transparent",color:act?"#EA580C":"#4B5563",fontWeight:act?800:600,fontSize:13,marginBottom:2,textAlign:"left",fontFamily:"inherit"}}>
              <span style={{fontSize:16,width:20,textAlign:"center"}}>{it.icon}</span>{it.label}
            </button>
          );})}
        </nav>
        <div style={{padding:"10px 12px",borderTop:"1px solid #F4F4F5",display:"flex",flexDirection:"column",gap:9}}>
          <button onClick={()=>setUSheet(true)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",cursor:"pointer",fontFamily:"inherit"}}>
            <Ava name={cu?.name} color={cu?.color} size={28}/>
            <div style={{textAlign:"left",overflow:"hidden"}}><p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#111827",whiteSpace:"nowrap"}}>{cu?.name}</p><p style={{margin:0,fontSize:10,color:"#9CA3AF",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cu?.dept}</p></div>
          </button>
          {viewToggle}
        </div>
      </aside>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <div style={{backgroundColor:"#FFFFFF",borderBottom:"1px solid #F2F4F6",padding:"13px 24px",flexShrink:0}}>
          <h1 style={{margin:0,fontSize:17,fontWeight:900,color:"#0F1F5C",lineHeight:1.1}}>{pi?.icon} {pi?.label}</h1>
          <p style={{margin:"3px 0 0",fontSize:11,color:"#9CA3AF"}}>{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} · {cu?.name} ({cu?.dept})</p>
        </div>
        <div style={{flex:1,overflowY:"auto"}}><div style={{maxWidth:900,margin:"0 auto"}}>{pageContent}</div></div>
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
        <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF",paddingLeft:36}}>{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} · {cu?.name} ({cu?.dept})</p>
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
  const toggle=t=>up("tasks",t.id,{status:t.status==="done"?"todo":"done"});
  const doQuick=()=>{
    if(!quick.trim()) return;
    add("tasks",{id:"t"+Date.now(),title:quick.trim(),projectId:quickProj,assigneeId:cu.id,type:"general",status:"todo",weekDay:today,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[]});
    setQuick("");setQuickProj("");
  };
  const doneToday=todayT.filter(t=>t.status==="done").length;
  const doneFixed=fixed.filter(t=>t.status==="done").length;
  return(
    <div style={{padding:"14px 16px 20px"}}>
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
                    <button onClick={()=>setEditTask(t)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#9CA3AF",padding:2}}>✎</button>
                    <button onClick={()=>setConfirmTaskId(t.id)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#D1D5DB",padding:2}}>✕</button>
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
              return(
                <div key={t.id} onClick={()=>toggle(t)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:12,backgroundColor:t.status==="done"?"rgba(232,250,241,0.34)":"#F9FAFB",border:`1px solid ${t.status==="done"?"rgba(0,192,115,0.2)":"#E5E8EB"}`,cursor:"pointer"}}>
                  <button onClick={e=>{e.stopPropagation();toggle(t);}} style={{width:22,height:22,borderRadius:6,border:`2px solid ${t.status==="done"?"#00C073":"#D1D5DB"}`,backgroundColor:t.status==="done"?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                    {t.status==="done"&&<span style={{color:"#FFFFFF",fontSize:12,fontWeight:900}}>✓</span>}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#111827",textDecoration:t.status==="done"?"line-through":"none"}}>{t.title}</p>
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
function KPIPage({D,lead,up,cu}){
  const [kpiView,setKpiView]=useState("dashboard");
  const [openMK,setOpenMK]=useState("mk1");
  const [openSK,setOpenSK]=useState(null);
  const [openProj,setOpenProj]=useState(null);
  const [salesOpen,setSalesOpen]=useState(false);
  const [histItem,setHistItem]=useState(null);   // 수치 이력 보기 대상 (subKPI/mainKPI)
  const [valSheet,setValSheet]=useState(null);   // 수치 입력 시트 {coll,item}
  const [valMode,setValMode]=useState("delta");  // delta(이번주 추가) | total(누계 직접)
  const [valAmt,setValAmt]=useState("");
  const [valWeek,setValWeek]=useState(weekKey());
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  // 수치 입력 시트 열기 — 매주 실적(추가값/총값) 기록
  const openVal=(coll,item)=>{ setValMode("delta"); setValAmt(""); setValWeek(weekKey()); setValSheet({coll,item}); };
  const shiftWeek=(d)=>{ const m=new Date(valWeek); m.setDate(m.getDate()+d*7); setValWeek(m.toISOString().slice(0,10)); };
  const applyVal=()=>{
    if(!valSheet) return;
    const {coll,item}=valSheet;
    const prev=Number(item.currentValue||0);
    const amt=Number(valAmt)||0;
    const value=valMode==="delta"?prev+amt:amt;
    const at=new Date().toISOString();
    const entry={week:valWeek,mode:valMode,amount:amt,value,prev,by:cu?.id||null,byName:cu?.name||"",at};
    up(coll,item.id,{currentValue:value,manualOverride:true,valueBy:cu?.id||null,valueByName:cu?.name||"",valueAt:at,valueHistory:[...(item.valueHistory||[]),entry]});
    setValSheet(null);
  };
  const resetAuto=(sk)=>up("subKPIs",sk.id,{manualOverride:false});
  const getContrib=(sk)=>{
    const projs=D.projects.filter(p=>p.subKPIId===sk.id);
    return projs.map(proj=>{
      const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
      const doneTasks=tasks.filter(t=>t.status==="done");
      const assignee=D.users.find(u=>u.id===proj.assigneeId);
      return{proj,tasks,effort:tasks.length,indirect:doneTasks.length,direct:proj.resultValue||0,assignee};
    });
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
          {D.goals.map(g=>{
            const cur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
            const p=pct(cur,g.targetValue);
            return(
              <div key={g.id} style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:18,padding:"18px",marginBottom:14,color:"#FFFFFF"}}>
                <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,opacity:0.6,letterSpacing:2}}>최종 목표</p>
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
                      <span style={{fontSize:16,fontWeight:900,color:col}}>{p}%</span>
                      <span style={{fontSize:12,color:"#9CA3AF"}}>{open?"▲":"▼"}</span>
                    </div>
                  </div>
                  <PBar value={p} color={col} h={6}/>
                  <p style={{margin:"5px 0 0",fontSize:11,color:"#9CA3AF"}}>{fmt(mkCur(mk,D.subKPIs,D.projects),mk.unit)} / {fmt(mk.targetValue,mk.unit)}</p>
                </div>
                {open&&(
                  <div style={{borderTop:"1px solid #F2F4F6",padding:"12px 16px 14px"}}>
                    {mk.unit==="원"&&mk.id!=="mk2"&&(<div style={{marginBottom:12,padding:"9px 12px",backgroundColor:"#EBF3FF",borderRadius:10}}><p style={{margin:0,fontSize:11.5,color:"#3182F6",fontWeight:600}}>📊 채널별 매출 합계로 자동 집계 — 아래 채널 현재값 입력</p></div>)}{mk.id==="mk2"&&(<div style={{marginBottom:12,padding:"11px 13px",backgroundColor:"#FFF7ED",borderRadius:10,border:"1px solid #FED7AA"}}><p style={{margin:"0 0 4px",fontSize:12,color:"#EA580C",fontWeight:800}}>💡 매출 입력은 여기서!</p><p style={{margin:0,fontSize:11.5,color:"#9A3412",fontWeight:600,lineHeight:1.55}}>아래 <b>거래처유형별 매출</b>의 <b>✏️ 입력</b> 버튼 → 한 화면에서 거래처유형별로 바로 입력 → 단가·메인KPI에 자동 반영</p></div>)}{lead&&mk.unit!=="원"&&(<div style={{marginBottom:12}}><button onClick={()=>openVal("mainKPIs",mk)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #F97316",background:"#FFF7ED",color:"#EA580C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📊 이번 주 실적 입력 · 현재 {fmt(mk.currentValue,mk.unit)}</button>{(mk.valueByName||(mk.valueHistory&&mk.valueHistory.length))&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,gap:8}}>{mk.valueByName&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>👤 {mk.valueByName} · {(mk.valueAt||"").slice(5,10)}</span>}{mk.valueHistory&&mk.valueHistory.length>0&&<button onClick={()=>setHistItem(mk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 이력 {mk.valueHistory.length}</button>}</div>}</div>)}
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
                                <span style={{fontSize:13,fontWeight:900,color:sp>=50?"#00C073":"#FF9500"}}>{sp}%</span>
                                <span style={{fontSize:11,color:"#9CA3AF"}}>{skOpen?"▲":"▼"}</span>
                              </div>
                            </div>
                            <PBar value={sp} color={sp>=50?"#00C073":"#FF9500"} h={5}/>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                              <span style={{fontSize:11,color:"#9CA3AF"}}>{fmt(skCur(sk,D.projects),sk.unit)} / {fmt(sk.targetValue,sk.unit)}</span>
                              <span style={{fontSize:11,color:"#9CA3AF"}}>프로젝트 {projs.length}개</span>
                            </div>
                            {lead&&<button onClick={e=>{e.stopPropagation();openVal("subKPIs",sk);}} style={{width:"100%",marginTop:8,padding:"8px 10px",borderRadius:8,border:"1.5px solid #F97316",background:"#FFF7ED",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📊 이번 주 실적 입력</button>}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:6,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                {sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride&&<span style={{fontSize:10,fontWeight:800,color:"#3182F6",backgroundColor:"#EBF3FF",padding:"2px 7px",borderRadius:6}}>📊 자동 집계</span>}
                                {sk.manualOverride&&<span style={{fontSize:10,fontWeight:800,color:"#EA580C",backgroundColor:"#FFF1E7",padding:"2px 7px",borderRadius:6}}>✏️ 수동 수정됨</span>}
                                {sk.valueByName&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>👤 {sk.valueByName} · {(sk.valueAt||"").slice(5,10)}</span>}
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                {sk.valueHistory&&sk.valueHistory.length>0&&<button onClick={()=>setHistItem(sk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 이력 {sk.valueHistory.length}</button>}
                                {sk.mainKPIId==="mk2"&&sk.unit==="원"&&sk.manualOverride&&<button onClick={()=>resetAuto(sk)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid #FED7AA",background:"#FFF7ED",fontSize:10.5,fontWeight:700,color:"#EA580C",cursor:"pointer",fontFamily:"inherit"}}>↺ 자동으로</button>}
                              </div>
                            </div>
                          </div>
                          {skOpen&&(
                            <div style={{borderTop:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",padding:"12px 14px"}}>
                              {contribs.length>0&&(
                                <div style={{marginBottom:14}}>
                                  <p style={{margin:"0 0 8px",fontSize:12,fontWeight:900,color:"#0F1F5C"}}>📊 기여 분석</p>
                                  <div style={{backgroundColor:"#EBF3FF",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                                    <p style={{margin:"0 0 2px",fontSize:11,fontWeight:800,color:"#3182F6"}}>⚡ 행동 기여 — 업무 수</p>
                                    {[...contribs].sort((a,b)=>b.effort-a.effort).map(c=>{
                                      const max=Math.max(...contribs.map(x=>x.effort),1);
                                      return(
                                        <div key={c.proj.id} style={{marginBottom:6}}>
                                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                                            <div style={{display:"flex",alignItems:"center",gap:5,flex:1,minWidth:0}}>
                                              <Ava name={c.assignee?.name} color={c.assignee?.color} size={18}/>
                                              <span style={{fontSize:11.5,fontWeight:700,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.proj.title}</span>
                                            </div>
                                            <span style={{fontSize:12,fontWeight:900,color:"#3182F6",flexShrink:0,marginLeft:6}}>{c.effort}건</span>
                                          </div>
                                          <div style={{height:5,borderRadius:5,backgroundColor:"#E5E8EB",overflow:"hidden"}}>
                                            <div style={{width:`${Math.round(c.effort/max*100)}%`,height:"100%",backgroundColor:"#3182F6",borderRadius:5}}/>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div style={{backgroundColor:"#E8FAF1",borderRadius:10,padding:"10px 12px"}}>
                                    <p style={{margin:"0 0 2px",fontSize:11,fontWeight:800,color:"#00C073"}}>✅ 간접 결과 — 완료 수</p>
                                    {[...contribs].sort((a,b)=>b.indirect-a.indirect).map(c=>{
                                      const max=Math.max(...contribs.map(x=>x.indirect),1);
                                      return(
                                        <div key={c.proj.id} style={{marginBottom:6}}>
                                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                                            <div style={{display:"flex",alignItems:"center",gap:5,flex:1,minWidth:0}}>
                                              <Ava name={c.assignee?.name} color={c.assignee?.color} size={18}/>
                                              <span style={{fontSize:11.5,fontWeight:700,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.proj.title}</span>
                                            </div>
                                            <span style={{fontSize:12,fontWeight:900,color:"#00C073",flexShrink:0,marginLeft:6}}>{c.indirect}건</span>
                                          </div>
                                          <div style={{height:5,borderRadius:5,backgroundColor:"#E5E8EB",overflow:"hidden"}}>
                                            <div style={{width:`${Math.round(c.indirect/max*100)}%`,height:"100%",backgroundColor:"#00C073",borderRadius:5}}/>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
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
                  </div>
                )}
              </div>
            );
          })}
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
          {D.subKPIs.filter(s=>s.mainKPIId==="mk2").map(sk=>{const ps=D.projects.filter(p=>p.subKPIId===sk.id);if(!ps.length)return null;const sub=ps.reduce((a,p)=>a+(p.resultValue||0),0);return(<div key={sk.id} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}><span style={{fontSize:12.5,fontWeight:900,color:"#8B5CF6"}}>{sk.channelCode} · {sk.title}</span><span style={{fontSize:11.5,fontWeight:800,color:"#374151"}}>{fmt(sub,"원")} / {fmt(sk.targetValue,"원")}</span></div>{ps.map(p=>{const dt=DT[p.dealerType];return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #F2F4F6"}}>{dt&&<span style={{fontSize:9.5,fontWeight:800,color:dt.color,backgroundColor:dt.color+"18",borderRadius:6,padding:"2px 6px",flexShrink:0,fontFamily:"'IBM Plex Mono',monospace"}}>{p.dealerType}</span>}<span style={{fontSize:12.5,fontWeight:600,color:"#1F2937",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span><input type="number" defaultValue={p.resultValue||""} placeholder="0" onBlur={e=>{const v=e.target.value;up("projects",p.id,{resultValue:v===""?0:(Number(v)||0)});}} style={{width:104,padding:"8px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:13,fontWeight:700,textAlign:"right",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/><span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>원</span></div>);})}</div>);})}
          <button onClick={()=>setSalesOpen(false)} style={{width:"100%",marginTop:10,padding:"14px 0",borderRadius:14,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>완료</button>
        </div>
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
            <input type="number" value={valAmt} onChange={e=>setValAmt(e.target.value)} placeholder="0" autoFocus style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:16,fontWeight:800,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <div style={{margin:"12px 0 16px",padding:"11px 14px",borderRadius:12,background:"#F9FAFB",border:"1px solid #F2F4F6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:700}}>저장 후 누계</span>
              <span style={{fontSize:14,fontWeight:900,color:"#0F1F5C"}}>{fmt(prev,it.unit)} → <span style={{color:"#F97316"}}>{fmt(preview,it.unit)}</span> ({pct(preview,it.targetValue)}%)</span>
            </div>
            <Btn full variant="orange" onClick={applyVal} disabled={valAmt===""}>저장</Btn>
          </div>);})()}
      </Sheet>
    </div>
  );
}
function ProjectsPage({D,cu,up,add,rm}){
  const [filter,setFilter]=useState("mine");
  const [groupFilter,setGroupFilter]=useState("all");
  const [projDetail,setProjDetail]=useState(null);
  const [taskForm,setTaskForm]=useState({title:"",status:"todo",dueDate:"",memo:""});
  const [addTaskSheet,setAddTaskSheet]=useState(false);
  const [confirmTaskId,setConfirmTaskId]=useState(null);
  const [editTask,setEditTask]=useState(null);
  const [addProjSheet,setAddProjSheet]=useState(false);
  const [search,setSearch]=useState("");
  const [asgFilter,setAsgFilter]=useState("all");
  const [actForm,setActForm]=useState({name:"",unit:"건",target:""});
  const [actHist,setActHist]=useState(null);   // 활동지표 이력 {proj,ak}
  const actAddIndicator=(proj)=>{ if(!actForm.name.trim())return; const list=[...(proj.activityKPIs||[]),{id:"ak"+Date.now(),name:actForm.name.trim(),unit:actForm.unit||"건",target:Number(actForm.target)||0,current:0,history:[]}]; up("projects",proj.id,{activityKPIs:list}); setActForm({name:"",unit:"건",target:""}); };
  const actRecord=(proj,ak,raw)=>{ const v=Number(raw); if(isNaN(v))return; const at=new Date().toISOString(); const week=weekKey(); const list=(proj.activityKPIs||[]).map(x=>x.id===ak.id?{...x,current:v,week,by:cu?.id||null,byName:cu?.name||"",history:[...(x.history||[]),{week,value:v,by:cu?.id||null,byName:cu?.name||"",at}]}:x); up("projects",proj.id,{activityKPIs:list}); };
  const actRemove=(proj,ak)=>up("projects",proj.id,{activityKPIs:(proj.activityKPIs||[]).filter(x=>x.id!==ak.id)});
  const [projForm,setProjForm]=useState({title:"",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high"});
  const doAddProj=()=>{
    if(!projForm.title.trim()) return;
    add("projects",{id:"p"+Date.now(),...projForm,status:"active",progress:0,resultValue:0});
    setProjForm({title:"",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high"});
    setAddProjSheet(false);
  };
  const availSKs=D.subKPIs.filter(sk=>sk.mainKPIId===projForm.mainKPIId);
  const toggleColab=(uid)=>{const list=projForm.collaboratorIds;setProjForm({...projForm,collaboratorIds:list.includes(uid)?list.filter(x=>x!==uid):[...list,uid]});};
  const projs=filter==="all"?D.projects:D.projects.filter(p=>p.assigneeId===cu.id);
  const groups=[...new Set(projs.map(p=>p.group))];
  const filtered=projs.filter(p=>(groupFilter==="all"||p.group===groupFilter)&&(asgFilter==="all"||p.assigneeId===asgFilter)&&(!search.trim()||(p.title||"").toLowerCase().includes(search.trim().toLowerCase())));
  const exportCSV=()=>{
    const rows=[["제목","그룹","담당자","메인KPI","서브KPI","우선순위","상태","진척도%","매출(원)"]];
    filtered.forEach(p=>{const a=D.users.find(u=>u.id===p.assigneeId);const mk=D.mainKPIs.find(m=>m.id===p.mainKPIId);const sk=D.subKPIs.find(s=>s.id===p.subKPIId);rows.push([p.title,p.group||"",a?.name||"",mk?.title||"",sk?.title||"",p.priority||"",p.status||"",p.progress||0,p.resultValue||0]);});
    const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    const a=document.createElement("a");a.href=url;a.download=`프로젝트_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };
  const projTasks=projDetail?D.tasks.filter(t=>t.projectId===projDetail.id&&!t.isFixed):[];
  const statusGroups={inprogress:projTasks.filter(t=>t.status==="inprogress"),todo:projTasks.filter(t=>t.status==="todo"),hold:projTasks.filter(t=>t.status==="hold"),done:projTasks.filter(t=>t.status==="done")};
  const doAddTask=()=>{
    if(!taskForm.title.trim()) return;
    add("tasks",{id:"t"+Date.now(),...taskForm,projectId:projDetail.id,assigneeId:cu.id,isFixed:false,weekDay:null,weekSlot:null,attachments:[]});
    setTaskForm({title:"",status:"todo",dueDate:"",memo:""});setAddTaskSheet(false);
  };
  const ST=STATUS_MAP;
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        {[{k:"mine",l:"내 프로젝트"},{k:"all",l:"전체 ("+D.projects.length+")"}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"8px 16px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:filter===f.k?"#0F1F5C":"#F2F4F6",color:filter===f.k?"#FFFFFF":"#374151",fontWeight:700,fontSize:12.5,fontFamily:"inherit"}}>{f.l}</button>
        ))}
        <button onClick={()=>setAddProjSheet(true)} style={{marginLeft:"auto",flexShrink:0,padding:"8px 14px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:"#F97316",color:"#FFFFFF",fontWeight:700,fontSize:12.5,fontFamily:"inherit"}}>+ 프로젝트</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 프로젝트 검색" style={{flex:1,minWidth:0,padding:"8px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,outline:"none",fontFamily:"inherit",backgroundColor:"#F9FAFB",boxSizing:"border-box"}}/>
        <select value={asgFilter} onChange={e=>setAsgFilter(e.target.value)} style={{flexShrink:0,padding:"8px 10px",borderRadius:9,border:`1.5px solid ${asgFilter!=="all"?"#F97316":"#E5E8EB"}`,fontSize:12,fontFamily:"inherit",backgroundColor:asgFilter!=="all"?"#FFEDD5":"#F9FAFB",color:asgFilter!=="all"?"#0F1F5C":"#6B7280",WebkitAppearance:"none",outline:"none"}}><option value="all">👤 전체</option>{D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button onClick={exportCSV} title="CSV 내보내기" style={{flexShrink:0,padding:"8px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:"#4B5563",fontFamily:"inherit"}}>⬇ CSV</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setGroupFilter("all")} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:groupFilter==="all"?"#F97316":"#F2F4F6",color:groupFilter==="all"?"#FFFFFF":"#374151",fontWeight:600,fontSize:11,fontFamily:"inherit"}}>전체</button>
        {groups.map(g=><button key={g} onClick={()=>{setGroupFilter(g);setProjDetail(null);}} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",backgroundColor:groupFilter===g?"#F97316":"#F2F4F6",color:groupFilter===g?"#FFFFFF":"#374151",fontWeight:600,fontSize:11,fontFamily:"inherit"}}>{g}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {filtered.map(proj=>{
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
            <div key={proj.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6",overflow:"hidden"}}>
              <div onClick={()=>setProjDetail(projDetail?.id===proj.id?null:proj)} style={{padding:"15px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                      {sk&&<Badge color={col} bg={col+"18"}>{mk?.krKey} · {sk.channelCode}</Badge>}
                      {!sk&&mk&&<Badge color="#3182F6" bg="#EBF3FF">{mk.krKey}</Badge>}
                      {proj.dealerType&&DT[proj.dealerType]&&<Badge color={DT[proj.dealerType].color} bg={DT[proj.dealerType].color+"18"}>🏷 {proj.dealerType}</Badge>}
                      <Badge color={pColor} bg={pColor+"18"}>{proj.priority==="high"?"🔴 높음":proj.priority==="mid"?"🟡 중간":"🟢 낮음"}</Badge>
                    </div>
                    <h4 style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:"#0F1F5C"}}>{proj.title}</h4>
                    {sk&&<p style={{margin:"0 0 2px",fontSize:11,color:"#6B7280"}}>{mk?.title} › {sk.title}</p>}
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
                  <div style={{padding:"12px 16px 0",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#4B5563",flexShrink:0}}>🏷 거래처유형</span>
                    <select value={proj.dealerType||""} onChange={e=>up("projects",proj.id,{dealerType:e.target.value})} style={{flex:1,padding:"7px 10px",borderRadius:8,fontSize:12,fontWeight:700,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",color:proj.dealerType?(DT[proj.dealerType]?.color||"#111827"):"#9CA3AF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label} ({d.price})</option>)}</select>
                  </div>
                  <div style={{padding:"12px 16px 0"}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#4B5563"}}>📈 주간 활동지표 (선행지표)</span>
                    {(proj.activityKPIs||[]).map(ak=>{const p2=pct(ak.current||0,ak.target||0);return(
                      <div key={ak.id} style={{backgroundColor:"#FFFFFF",borderRadius:10,padding:"9px 11px",marginTop:7,border:"1px solid #E5E8EB"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,gap:8}}>
                          <span style={{fontSize:12,fontWeight:700,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ak.name}</span>
                          <span style={{fontSize:11,fontWeight:800,color:"#8B5CF6",flexShrink:0}}>{fmt(ak.current||0,ak.unit)} / {fmt(ak.target||0,ak.unit)} <span style={{color:"#9CA3AF",fontWeight:600}}>/주</span></span>
                        </div>
                        <PBar value={p2} color="#8B5CF6" h={5}/>
                        <div style={{display:"flex",gap:6,marginTop:7,alignItems:"center"}}>
                          <input type="number" placeholder={`이번주(${weekLabel(weekKey())}) 값`} onKeyDown={e=>{if(e.key==="Enter"&&e.target.value!==""){actRecord(proj,ak,e.target.value);e.target.value="";}}} onBlur={e=>{if(e.target.value!==""){actRecord(proj,ak,e.target.value);e.target.value="";}}} style={{flex:1,minWidth:0,padding:"6px 9px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                          {ak.history&&ak.history.length>0&&<button onClick={()=>setActHist({proj,ak})} style={{flexShrink:0,padding:"5px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>📜 {ak.history.length}</button>}
                          <button onClick={()=>actRemove(proj,ak)} style={{flexShrink:0,background:"none",border:"none",fontSize:13,color:"#D1D5DB",cursor:"pointer",padding:2}}>🗑</button>
                        </div>
                        {ak.byName&&<p style={{margin:"5px 0 0",fontSize:10,color:"#9CA3AF"}}>👤 {ak.byName} · {weekLabel(ak.week||weekKey())} 입력</p>}
                      </div>
                    );})}
                    <div style={{display:"flex",gap:5,marginTop:8}}>
                      <input value={actForm.name} onChange={e=>setActForm({...actForm,name:e.target.value})} placeholder="지표명 (예: 주간 견적 발송)" style={{flex:1,minWidth:0,padding:"7px 9px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                      <input value={actForm.unit} onChange={e=>setActForm({...actForm,unit:e.target.value})} placeholder="단위" style={{width:48,padding:"7px 6px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
                      <input type="number" value={actForm.target} onChange={e=>setActForm({...actForm,target:e.target.value})} placeholder="주목표" style={{width:60,padding:"7px 6px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center"}}/>
                      <button onClick={()=>actAddIndicator(proj)} disabled={!actForm.name.trim()} style={{flexShrink:0,width:34,borderRadius:8,border:"none",backgroundColor:actForm.name.trim()?"#8B5CF6":"#E5E8EB",color:"#fff",fontSize:17,fontWeight:900,cursor:actForm.name.trim()?"pointer":"not-allowed"}}>+</button>
                    </div>
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
                  <div style={{padding:"10px 16px 14px",borderTop:"1px solid #E5E8EB",display:"flex",alignItems:"center",gap:8}}><div style={{display:"flex",alignItems:"center",gap:6,marginRight:"auto"}}><span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>진척</span><button onClick={()=>up("projects",proj.id,{progress:Math.max(0,(proj.progress||0)-10)})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>−</button><span style={{fontSize:13,fontWeight:800,color:"#3182F6",minWidth:40,textAlign:"center"}}>{proj.progress}%</span><button onClick={()=>up("projects",proj.id,{progress:Math.min(100,(proj.progress||0)+10)})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>＋</button></div>
                    <button onClick={()=>up("projects",proj.id,{status:"completed",progress:100})} style={{padding:"6px 14px",borderRadius:10,border:"1px solid #00C073",backgroundColor:"#E8FAF1",color:"#00C073",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ 완료</button>
                    <button onClick={()=>up("projects",proj.id,{status:"paused"})} style={{padding:"6px 14px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:"#F2F4F6",color:"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏸ 보류</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0&&<div style={{padding:"40px 20px",textAlign:"center",backgroundColor:"#FFFFFF",borderRadius:16,border:"1px solid #F2F4F6"}}><p style={{fontSize:38,margin:"0 0 10px"}}>🗂️</p><p style={{fontSize:14,color:"#9CA3AF"}}>프로젝트가 없어요</p></div>}
      </div>
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
      <Sheet open={addProjSheet} onClose={()=>setAddProjSheet(false)} title="프로젝트 추가" h="92vh">
        <div style={{marginTop:10}}>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>프로젝트명 *</label><input value={projForm.title} onChange={e=>setProjForm({...projForm,title:e.target.value})} placeholder="프로젝트 이름" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메인 KPI</label><select value={projForm.mainKPIId} onChange={e=>setProjForm({...projForm,mainKPIId:e.target.value,subKPIId:""})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">없음 (운영 인프라)</option>{D.mainKPIs.map(mk=><option key={mk.id} value={mk.id}>{mk.krKey} · {mk.title}</option>)}</select></div>
          {projForm.mainKPIId&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>서브 KPI</label><select value={projForm.subKPIId} onChange={e=>setProjForm({...projForm,subKPIId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">선택 안함</option>{availSKs.map(sk=><option key={sk.id} value={sk.id}>{sk.channelCode} · {sk.title}</option>)}</select></div>}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>거래처유형 <span style={{color:"#9CA3AF",fontWeight:600}}>(누가 사는가)</span></label><select value={projForm.dealerType} onChange={e=>setProjForm({...projForm,dealerType:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정 (내부·인프라)</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label} ({d.price})</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label><select value={projForm.assigneeId} onChange={e=>setProjForm({...projForm,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{D.users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>공동 기여자</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{D.users.filter(u=>u.id!==projForm.assigneeId).map(u=>{const sel=projForm.collaboratorIds.includes(u.id);return(<button key={u.id} onClick={()=>toggleColab(u.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,backgroundColor:sel?u.color+"18":"#FFFFFF",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={20}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span>{sel&&<span style={{fontSize:12,color:u.color}}>✓</span>}</button>);})}</div></div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>그룹</label>
            <input value={projForm.group} onChange={e=>setProjForm({...projForm,group:e.target.value})} placeholder="예: 자사몰 구축·운영" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{[...new Set(D.projects.map(p=>p.group).filter(Boolean))].map(g=><button key={g} onClick={()=>setProjForm({...projForm,group:g})} style={{padding:"4px 10px",borderRadius:16,border:"1px solid #E5E8EB",backgroundColor:projForm.group===g?"#0F1F5C":"#F9FAFB",color:projForm.group===g?"#FFFFFF":"#4B5563",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{g}</button>)}</div>
          </div>
          <div style={{marginBottom:20}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>우선순위</label><div style={{display:"flex",gap:8}}>{[{k:"high",l:"🔴 높음"},{k:"mid",l:"🟡 중간"},{k:"low",l:"🟢 낮음"}].map(p=><button key={p.k} onClick={()=>setProjForm({...projForm,priority:p.k})} style={{flex:1,padding:"9px 0",borderRadius:12,border:`1.5px solid ${projForm.priority===p.k?"#0F1F5C":"#E5E8EB"}`,backgroundColor:projForm.priority===p.k?"#0F1F5C":"#FFFFFF",color:projForm.priority===p.k?"#FFFFFF":"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>)}</div></div>
          <button onClick={doAddProj} disabled={!projForm.title.trim()} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:projForm.title.trim()?"#F97316":"#E5E8EB",color:projForm.title.trim()?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:projForm.title.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>프로젝트 추가하기</button>
        </div>
      </Sheet>
      <EditTaskSheet open={!!editTask} onClose={()=>setEditTask(null)} task={editTask} D={D} onSave={f=>up("tasks",editTask.id,{title:f.title,status:f.status,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,attachments:f.attachments})}/>
      <Confirm open={!!confirmTaskId} title="업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmTaskId)?.title}" 업무를 삭제할까요?`} onOk={()=>{rm("tasks",confirmTaskId);setConfirmTaskId(null);}} onCancel={()=>setConfirmTaskId(null)}/>
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
    </div>
  );
}
function CalendarPage({D,cu,add}){
  const [cm,setCm]=useState(new Date(2026,5,1));
  const [detail,setDetail]=useState(null);
  const [actionForm,setActionForm]=useState({type:"task",title:"",projectId:"",status:"todo"});
  const [actionDone,setActionDone]=useState([]);
  const y=cm.getFullYear(),m=cm.getMonth();
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
        <Badge color="#F97316" bg="#FFEDD5">{mEvts.length}건</Badge>
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
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:"50%",fontSize:11.5,fontWeight:isT?900:400,backgroundColor:isT?"#3182F6":"transparent",color:isT?"#FFFFFF":"#374151"}}>{day}</span>
                {evts.map(ev=>{const et=ET[ev.type]||ET.internal;return <div key={ev.id} onClick={()=>{setDetail(ev);setActionForm({type:"task",title:"",projectId:"",status:"todo"});setActionDone([]);}} style={{marginTop:1,padding:"1px 4px",borderRadius:4,fontSize:9,fontWeight:700,backgroundColor:et.bg,color:et.color,cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.title}</div>;})}
              </div>
            );
          })}
        </div>
      </div>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>이번 달 일정</h3>
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
              <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{detail.date}</p>
              {detail.description&&<p style={{margin:"6px 0 0",fontSize:13.5,color:"#374151",lineHeight:1.6}}>{detail.description}</p>}
              {detail.projectId&&D.projects.find(p=>p.id===detail.projectId)&&<div style={{marginTop:10,padding:"8px 10px",backgroundColor:"#EBF3FF",borderRadius:10}}><p style={{margin:0,fontSize:11.5,color:"#3182F6",fontWeight:700}}>📁 {D.projects.find(p=>p.id===detail.projectId).title}</p></div>}
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
        {D.users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}
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
                  <button onClick={()=>setEditTarget(t)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:16,padding:4,flexShrink:0}}>✎</button>
                  <button onClick={()=>setConfirmId(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#D1D5DB",fontSize:20,padding:4,flexShrink:0}}>🗑</button>
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
          {lead&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label><select value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="all">⭐ 전체 (전원에게 생성)</option>{D.users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}</select>{form.assigneeId==="all"&&<p style={{margin:"6px 2px 0",fontSize:11,color:"#EA580C",fontWeight:700}}>전 담당자 {D.users.length}명에게 각각 생성됩니다</p>}</div>}
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
                    <button onClick={()=>rm("personalGoals",g.id)} style={{background:"none",border:"none",fontSize:15,cursor:"pointer",color:"#D1D5DB",padding:2}}>✕</button>
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
function AIPage({D,cu,add}){
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
  const run=async()=>{
    setLoading(true);setResult(null);setSaved(false);
    const c=ctx();
    const prompt=type==="kpi"?`${c}\n\nPOUR스토어 KPI 현황 분석:\n1. 달성률 낮은 채널과 원인\n2. 즉시 개선 액션 3가지\n3. 이번 주 집중해야 할 것\n한국어로 간결하게.`:type==="ab"?`${c}\n\nAB테스트 관점:\n1. 직판 vs B2B 실행력 비교\n2. 채널별 효율 분석\n3. 리소스 재배분 제안\n한국어로.`:`${c}\n\n질문: ${q}\n한국어로 답변.`;
    try{
      const res=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const d=await res.json();
      setResult(d.content?.[0]?.text||"결과를 가져오지 못했습니다.");
    }catch(e){setResult("오류가 발생했습니다.");}
    setLoading(false);
  };
  const saveResult=()=>{
    if(!result||saved) return;
    add("aiReviews",{id:"ai"+Date.now(),userId:cu.id,type,question:type==="custom"?q:"",result,model:"claude-sonnet-4-20250514",savedAt:new Date().toISOString(),label:type==="kpi"?"KPI 분석":type==="ab"?"메인KPI 비교":"질문: "+q.slice(0,30)});
    setSaved(true);
  };
  const TYPE_LABELS={kpi:"📊 KPI 분석",ab:"🧪 메인KPI 비교",custom:"💬 질문"};
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"16px",marginBottom:14,border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#3182F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>✦</div>
          <div style={{flex:1}}><h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>AI 코치</h3><p style={{margin:0,fontSize:11.5,color:"#9CA3AF"}}>POUR 실제 데이터 기반 분석</p></div>
          <button onClick={()=>setShowHistory(!showHistory)} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #E5E8EB",backgroundColor:showHistory?"#0F1F5C":"#FFFFFF",color:showHistory?"#FFFFFF":"#4B5563",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>📋 {myReviews.length}건</button>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:14,backgroundColor:"#F9FAFB",borderRadius:12,padding:4}}>
          {[{k:"kpi",l:"📊 KPI"},{k:"ab",l:"🧪 KR비교"},{k:"custom",l:"💬 질문"}].map(t=><button key={t.k} onClick={()=>setType(t.k)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:type===t.k?"#FFFFFF":"transparent",color:type===t.k?"#0F1F5C":"#6B7280",fontWeight:type===t.k?800:500,fontSize:12,fontFamily:"inherit",boxShadow:type===t.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>)}
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
