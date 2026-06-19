import { useState, useEffect, useRef } from "react";
import { STATE_DOC, colDoc, META_DOC, extDoc, extCol, getDoc, getDocs, onSnapshot, setDoc, uploadTaskPhoto, deleteTaskPhoto } from "./firebase.js";
import { idbSaveMirror, idbLoadMirror, idbPushSnapshot, idbListSnapshots, idbGetSnapshot } from "./durable.js";
import { numF, skCur, mkCur, calcSegDone } from "./kpi.js";
import { applyAutomation, instantiateLaunch } from "./launch.js";

// Firestore 단일 문서에 저장할 공유 데이터 키 (currentUser는 기기별 로컬이라 제외)
const SHARED_KEYS = ["users","goals","mainKPIs","subKPIs","projects","tasks","personalGoals","retros","aiReviews","events","weekGoals","launchTemplates","manuals","trash"];
const COL_LABEL = {users:"담당자",goals:"최종목표",mainKPIs:"메인KPI",subKPIs:"서브KPI",projects:"프로젝트",tasks:"업무",personalGoals:"개인목표",retros:"회고",aiReviews:"AI점검",events:"일정",weekGoals:"주간목표",launchTemplates:"프로세스템플릿",manuals:"로드맵 템플릿",trash:"휴지통"};
const LOCAL_USER_KEY = "pour-os-current-user";
const MIRROR_KEY = "pour-os-mirror";        // 2차 안전: 마지막 상태를 이 기기에 거울 저장
const MIRROR_AT_KEY = "pour-os-mirror-at";  // 거울 저장 시각(ISO)
const EXT_BACKUP_AT_KEY = "pour-os-ext-backup-at";  // 마지막 외부(GitHub) 백업 시각(ISO)
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
const GOAL_TYPE={revenue:{l:"💰 매출",c:"#EA580C",bg:"#FFEDD5"},metric:{l:"🎯 목표",c:"#7C3AED",bg:"#F3EFFE"},journey:{l:"🔁 구축",c:"#0891B2",bg:"#E0F2FE"}};
const STATUS_MAP={
  todo:{label:"할일",color:"#6B7280",bg:"#F2F4F6"},
  inprogress:{label:"진행중",color:"#3182F6",bg:"#EBF3FF"},
  done:{label:"완료",color:"#00C073",bg:"#E8FAF1"},
  hold:{label:"보류",color:"#FF9500",bg:"#FFF3E0"},
};
// 캘린더 일정 유형 (CalendarPage의 ET와 동일 · 오늘 슬롯 배치에서도 사용)
const EVENT_TYPES={internal:{label:"내부미팅",color:"#3182F6",bg:"#EBF3FF"},external:{label:"외부미팅",color:"#8B5CF6",bg:"#F3EFFE"},promotion:{label:"프로모션",color:"#FF9500",bg:"#FFF3E0"},seminar:{label:"세미나",color:"#00C073",bg:"#E8FAF1"},fair:{label:"박람회",color:"#F04452",bg:"#FFF0F1"}};
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
    {id:"sk12",mainKPIId:"mk3",title:"로드맵 33건",targetValue:33,currentValue:8,unit:"건",order:4,channelCode:"MAN"},
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
  // 로드맵 템플릿 — 잘 된 로드맵(로드단계+프로세스)을 굳혀 재사용하는 표준. 새 프로젝트를 여기서 시작.
  manuals:[],
  trash:[],   // 소프트 삭제 보관소 — 삭제된 모든 데이터는 여기 남고 복구 가능(데이터 자산화)
  // 출시 프로세스 템플릿(마인드맵) — 신상 SKU를 찍어내는 표준 흐름. 동일 프로세스 1개 기본 제공.
  launchTemplates:[
    {id:"tpl_launch", name:"신상 출시 표준 프로세스", version:2, createdAt:"2026-06-12T00:00:00.000Z",
      // 로드단계(7) + 단계별 액션(완료 시 자동 생성 업무) + 담당자(부서 매핑). 인스턴스 생성 시 각 노드→업무, 출시 완료는 sk_launch(신규 SKU 출시 수)로 자동 집계.
      nodes:[
        {id:"n1", title:"소싱·원가·납기 확정",   roleLabel:"MD",    assigneeId:"songhee", x:24,  y:24,
          auto:{onDone:[{id:"n1a1",kind:"createTask",title:"원가·마진표 검수",assigneeId:"songhee"}]}, autoComplete:false},
        {id:"n2", title:"제품 교육·지식 전파",    roleLabel:"MD",    assigneeId:"songhee", x:178, y:120,
          auto:{onDone:[{id:"n2a1",kind:"createTask",title:"판매 포인트·셀링 카피 정리",assigneeId:"minji"}]}, autoComplete:false},
        {id:"n3", title:"썸네일·상세 디자인",     roleLabel:"디자인", assigneeId:"minji",   x:30,  y:216,
          auto:{onDone:[{id:"n3a1",kind:"createTask",title:"상세 카피·표시사항 검수",assigneeId:"songhee"}]}, autoComplete:false},
        {id:"n4", title:"상품 등록·자사몰 노출",  roleLabel:"등록",   assigneeId:"minji",   x:184, y:312,
          auto:{onDone:[{id:"n4a1",kind:"createTask",title:"자사몰 노출·가격 확인",assigneeId:"minji"}]}, autoComplete:false},
        {id:"n5", title:"마켓 동시 등록",         roleLabel:"등록",   assigneeId:"minji",   x:36,  y:408,
          auto:{onDone:[{id:"n5a1",kind:"createTask",title:"마켓 노출·옵션·가격 검수",assigneeId:"minji"}]}, autoComplete:false},
        {id:"n6", title:"출시 배너·주문 세팅",    roleLabel:"운영",   assigneeId:"chaerim", x:190, y:504,
          auto:{onDone:[{id:"n6a1",kind:"createTask",title:"주문·결제·배송 테스트",assigneeId:"chaerim"}]}, autoComplete:false},
        {id:"n7", title:"B2B 안내·실사용 콘텐츠", roleLabel:"영업",   assigneeId:"ran",     x:42,  y:600,
          auto:{onDone:[{id:"n7a1",kind:"createTask",title:"B2B 안내 발송·반응 체크",assigneeId:"ran"}]}, autoComplete:false},
      ],
      edges:[
        {id:"e1", from:"n1", to:"n2"},
        {id:"e2", from:"n2", to:"n3"},
        {id:"e3", from:"n3", to:"n4"},
        {id:"e4", from:"n4", to:"n5"},
        {id:"e5", from:"n5", to:"n6"},
        {id:"e6", from:"n6", to:"n7"},
      ],
    },
  ],
};
const pct=(c,t)=>t===0||t==null?0:Math.max(0,Math.min(100,Math.round((c/t)*100)));
// 주차 헬퍼 (월요일 시작)
const weekKey=(d=new Date())=>{const x=new Date(d);const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x.toISOString().slice(0,10);};
const weekLabel=(key)=>{const m=new Date(key);const su=new Date(m);su.setDate(su.getDate()+6);const f=z=>`${z.getMonth()+1}/${z.getDate()}`;return `${f(m)}~${f(su)}`;};
// 메인KPI2(B2B): 서브KPI 현재값 = 자식 프로젝트 매출 성과(resultValue) 합계 / 메인KPI1·3: 수동값
// KPI 집계 헬퍼는 ./kpi.js로 추출(동작 동일 + 테스트 가능). numF·skCur·mkCur·calcSegDone import.
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
const ymdLocal=(dt)=>`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;   // 로컬 기준 YYYY-MM-DD (workDate 저장·비교 통일)
// 공휴일(편집 가능) — 주 마지막 근무일 계산용. 필요 시 날짜 추가/삭제.
const KR_HOLIDAYS=new Set(["2026-01-01","2026-02-16","2026-02-17","2026-02-18","2026-03-01","2026-03-02","2026-05-05","2026-05-24","2026-05-25","2026-06-06","2026-08-15","2026-08-17","2026-09-24","2026-09-25","2026-09-26","2026-10-03","2026-10-05","2026-10-09","2026-12-25"]);
const dkeyLocal=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
// 이번 주 마지막 근무일(월~금 중 휴일 제외 최종일)이 오늘인가
const isLastWorkingDayOfWeek=()=>{
  const now=new Date(); const off=(now.getDay()+6)%7; // 월=0
  const mon=new Date(now); mon.setDate(now.getDate()-off);
  let last=null;
  for(let i=0;i<5;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);if(!KR_HOLIDAYS.has(dkeyLocal(d)))last=d;}
  return !!last && dkeyLocal(last)===dkeyLocal(now);
};
const nowMonth=()=>new Date().toISOString().slice(0,7);
const PBar=({value,color="#3182F6",h=5})=>(
  <div style={{width:"100%",height:h,borderRadius:h,backgroundColor:"#F2F4F6",overflow:"hidden"}}>
    <div style={{width:`${value}%`,height:"100%",borderRadius:h,backgroundColor:color,transition:"width 0.4s"}}/>
  </div>
);
const Badge=({color,bg,children})=>(
  <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,color,backgroundColor:bg}}>{children}</span>
);
// 아바타 표시용 이름 — 성(첫 글자) 제외한 이름. 김송희→송희, 이란→란 (1글자면 그대로)
const gname=(n)=>{const s=(n||"").trim();return s.length>=2?s.slice(1):(s||"?");};
// ISO → HH:MM (시:분)
const hhmm=(iso)=>{if(!iso)return"";try{const d=new Date(iso);if(isNaN(d))return"";return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}catch(_){return"";}};
// 기간 범위 [start,end] — 올해/상반기/하반기/이번달/이번주
const periodRange=(key,base=new Date())=>{
  const y=base.getFullYear(),m=base.getMonth();
  const mk=(yy,mm,dd,end)=>{const x=new Date(yy,mm,dd);x.setHours(end?23:0,end?59:0,end?59:0,end?999:0);return x;};
  if(key==="year")  return [mk(y,0,1),mk(y,11,31,true)];
  if(key==="h1")    return [mk(y,0,1),mk(y,5,30,true)];
  if(key==="h2")    return [mk(y,6,1),mk(y,11,31,true)];
  if(key==="month") return [mk(y,m,1),mk(y,m+1,0,true)];
  const wd=(base.getDay()+6)%7;const mon=new Date(base);mon.setDate(base.getDate()-wd);mon.setHours(0,0,0,0);const sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);return [mon,sun];
};
const PERIODS=[["year","올해"],["h1","상반기"],["h2","하반기"],["month","이번 달"],["week","이번 주"]];
const PERIOD_LABEL=Object.fromEntries(PERIODS);
// 직전 동기간 범위 (증감 비교용) — 주=지난주 / 달=지난달 / 상반기=작년 하반기 / 하반기=올해 상반기 / 올해=작년
const prevPeriodRange=(key,base=new Date())=>{
  const b=new Date(base);
  if(key==="week"){ b.setDate(b.getDate()-7); return periodRange("week",b); }
  if(key==="month"){ b.setMonth(b.getMonth()-1,1); return periodRange("month",b); }
  if(key==="year"){ return periodRange("year",new Date(b.getFullYear()-1,0,1)); }
  if(key==="h1"){ return periodRange("h2",new Date(b.getFullYear()-1,8,1)); }
  if(key==="h2"){ return periodRange("h1",b); }
  return periodRange(key,b);
};
const PREV_LABEL={week:"지난주",month:"지난달",year:"작년",h1:"작년 하반기",h2:"올해 상반기"};
const Ava=({name,color,size=32})=>{
  const cols=["#3182F6","#8B5CF6","#00C073","#FF9500","#F04452"];
  const c=color||cols[(name?.charCodeAt(0)||0)%cols.length];
  const g=gname(name);
  const fs=g.length>=2?size*0.33:size*0.42;
  return <div style={{width:size,height:size,borderRadius:"50%",backgroundColor:c+"22",color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:fs,fontWeight:800,flexShrink:0,letterSpacing:g.length>=2?-0.5:0,lineHeight:1,overflow:"hidden"}}>{g}</div>;
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
// 업무 계층(parentId) — 상위 경로 + 하위(자손) 트리. 모든 화면에서 '관련된 하위task 쭉' 노출용.
const taskKidsOf=(D,id)=>(D.tasks||[]).filter(t=>t.parentId===id&&!t.isFixed).sort((a,b)=>(a.seq||0)-(b.seq||0));
const taskParentChain=(D,t)=>{const out=[];let p=t&&t.parentId?(D.tasks||[]).find(x=>x.id===t.parentId):null;let g=0;while(p&&g++<30){out.unshift(p);p=p.parentId?(D.tasks||[]).find(x=>x.id===p.parentId):null;}return out;};
const taskDescCount=(D,id)=>{let n=0;taskKidsOf(D,id).forEach(c=>{n+=1+taskDescCount(D,c.id);});return n;};
const taskDescFlat=(D,id,depth=1,out=[])=>{taskKidsOf(D,id).forEach(c=>{out.push({t:c,depth});taskDescFlat(D,c.id,depth+1,out);});return out;};
const taskRollup=(D,id)=>{const f=taskDescFlat(D,id).filter(x=>taskKidsOf(D,x.t.id).length===0);return {total:f.length,done:f.filter(x=>x.t.status==="done").length};};   // 하위 '말단' 완료 롤업(진척과 동일 기준)
// 상태 변경 패치 — status + doneAt/doneBy(완료 시) + statusLog(이력) 일괄. 모든 토글/저장이 이걸 거쳐 데이터 누락 방지.
const _curUser=(D)=>(D.users||[]).find(x=>x.id===D.currentUser)||null;
const statusPatch=(D,task,newStatus)=>{const u=_curUser(D);const at=new Date().toISOString();const p={status:newStatus,statusLog:[...(Array.isArray(task.statusLog)?task.statusLog:[]),{status:newStatus,at,by:u?.id||null,byName:u?.name||""}]};if(newStatus==="done"){p.doneAt=at;p.doneBy=u?.id||null;p.doneByName=u?.name||"";}return p;};
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
// 고정업무 다중 담당자 — forAll(전체) | assigneeIds[](다중) | 레거시 assigneeId(단일). 완료는 담당자별 doneDates 맵(없으면 레거시 doneDate)
const fixedAssigneeIds=(t)=> Array.isArray(t.assigneeIds)&&t.assigneeIds.length ? t.assigneeIds : (t.assigneeId?[t.assigneeId]:[]);
const fixedIsMine=(t,uid)=> t.forAll ? true : fixedAssigneeIds(t).includes(uid);
const fixedDoneOn=(t,uid)=> (t.doneDates&&Object.prototype.hasOwnProperty.call(t.doneDates,uid)) ? t.doneDates[uid] : (t.assigneeId===uid?t.doneDate:null);
const EditTaskSheet=({open,onClose,task,onSave,D,add,up})=>{
  const [form,setForm]=useState({title:"",status:"todo",dueDate:"",memo:"",projectId:"",assigneeId:"",assigneeIds:[],forAll:false,parentId:"",attachments:[],weekDay:"",weekSlot:null,workDate:"",fixedTime:""});
  const [prevId,setPrevId]=useState(null);
  const [uploading,setUploading]=useState(false);
  const [dropOver,setDropOver]=useState(false);
  if(task&&task.id!==prevId){setPrevId(task.id);setForm({title:task.title||"",status:task.status||"todo",dueDate:task.dueDate||"",memo:task.memo||"",projectId:task.projectId||"",assigneeId:task.assigneeId||"",assigneeIds:Array.isArray(task.assigneeIds)&&task.assigneeIds.length?task.assigneeIds:(task.assigneeId?[task.assigneeId]:[]),forAll:!!task.forAll,parentId:task.parentId||"",attachments:Array.isArray(task.attachments)?task.attachments:[],weekDay:task.weekDay||"",weekSlot:task.weekSlot??null,workDate:task.workDate||"",fixedTime:task.fixedTime||""});}
  if(!task&&prevId!==null){setPrevId(null);setForm({title:"",status:"todo",dueDate:"",memo:"",projectId:"",assigneeId:"",assigneeIds:[],forAll:false,attachments:[],weekDay:"",weekSlot:null,workDate:"",fixedTime:""});}
  // 날짜 선택 → 요일·슬롯 자동 배정(담당자의 그 요일 빈 슬롯 중 가장 앞, 없으면 슬롯 없이 그날에)
  const placeOn=(f,ds)=>{
    if(!ds) return {...f,workDate:"",weekDay:"",weekSlot:null};
    const d=new Date(ds+"T00:00:00"); const wd=ALL_DAYS[d.getDay()];
    let slot=null;
    if(WEEK_DAYS.includes(wd)){ const used=new Set((D.tasks||[]).filter(t=>!t.isFixed&&t.assigneeId===(f.assigneeId||"")&&t.weekDay===wd&&t.id!==(task&&task.id)&&t.weekSlot).map(t=>t.weekSlot)); slot=[1,2,3,4,5].find(s=>!used.has(s))||null; }
    return {...f,workDate:ds,weekDay:wd,weekSlot:slot};
  };
  const onPick=async(files)=>{
    const list=Array.from(files||[]);
    if(!list.length||!task)return;
    setUploading(true);
    try{ const added=[]; for(const f of list){ if(f.size>20*1024*1024){alert(`${f.name}: 20MB 초과`);continue;} added.push(await uploadTaskPhoto(task.id,f)); }
      setForm(p=>({...p,attachments:[...(p.attachments||[]),...added]})); }
    catch(e){ alert("업로드 실패: "+e.message); }
    setUploading(false);
  };
  // 첨부 제거 = 폼에서 분리만(스토리지 파일은 보존 — 데이터 영구 보존). 실제 삭제 반영·휴지통 기록은 저장 시점에.
  const rmPhoto=(att)=>setForm(p=>({...p,attachments:(p.attachments||[]).filter(a=>a.url!==att.url)}));
  // 붙여넣기(Ctrl/⌘+V)로 클립보드 이미지·파일 바로 첨부 — 시트 열려있고 기존 task일 때만
  useEffect(()=>{
    if(!open||!task) return;
    const onPaste=(e)=>{ const items=e.clipboardData&&e.clipboardData.items; if(!items) return;
      const files=[]; for(const it of items){ if(it.kind==="file"){ const f=it.getAsFile(); if(f) files.push(f); } }
      if(files.length){ e.preventDefault(); onPick(files); } };
    document.addEventListener("paste",onPaste);
    return ()=>document.removeEventListener("paste",onPaste);
  },[open,task]);
  const doSave=()=>{
    if(!form.title.trim())return;
    if(task&&task.id&&add){   // 저장 시 제거된 첨부를 휴지통에 보관(파일은 그대로 — 복구 가능)
      const keep=new Set((form.attachments||[]).map(a=>a.url));
      const removed=(task.attachments||[]).filter(a=>a.url&&!keep.has(a.url));
      if(removed.length){ const u=D.users.find(x=>x.id===D.currentUser);
        removed.forEach((att,i)=>add("trash",{...att,_col:"_nested",_typeLabel:"사진",_label:att.name||"사진 첨부",_parentCol:"tasks",_parentId:task.id,_field:"attachments",
          _tid:"trash"+Date.now()+"_"+i+"_"+Math.random().toString(36).slice(2,5),_deletedAt:new Date().toISOString(),_deletedBy:u?.id||null,_deletedByName:u?.name||""})); }
    }
    // 상태가 바뀌었으면 doneAt·이력(statusLog)을 함께 넘겨 데이터 누락 방지
    let out=form;
    if(task&&form.status!==task.status){ const sp=statusPatch(D,task,form.status); out={...form,statusLog:sp.statusLog,doneAt:("doneAt" in sp)?sp.doneAt:(task.doneAt||null),doneBy:sp.doneBy,doneByName:sp.doneByName}; }
    onSave(out); onClose();
  };
  return(
    <Sheet open={open} onClose={onClose} title="업무 수정" h="78vh">
      <div style={{marginTop:12}}>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>업무명 *</label>
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        {task&&!task.isFixed&&(()=>{
          const proj=task.projectId?(D.projects||[]).find(p=>p.id===task.projectId):null;
          const chain=taskParentChain(D,task);
          const desc=taskDescFlat(D,task.id);
          const addChild=()=>{ if(!add)return; add("tasks",{id:"t"+Date.now()+Math.random().toString(36).slice(2,5),projectId:task.projectId||"",parentId:task.id,seq:taskKidsOf(D,task.id).length,title:"새 하위 업무",status:"todo",isFixed:false,assigneeId:task.assigneeId||"",memo:"",dueDate:"",attachments:[]}); };
          return(
            <div style={{marginBottom:14,padding:"11px 12px",background:"#F9FAFB",borderRadius:12,border:"1px solid #F2F4F6"}}>
              <p style={{margin:"0 0 7px",fontSize:11.5,fontWeight:800,color:"#374151"}}>🧩 프로세스 위치 <span style={{fontWeight:600,color:"#9CA3AF"}}>(상위 경로 · 하위 업무 {desc.length})</span></p>
              {(proj||chain.length>0)&&<p style={{margin:"0 0 8px",fontSize:11,color:"#6B7280",lineHeight:1.55}}>{[proj&&("📁 "+proj.title),...chain.map(c=>c.title)].filter(Boolean).join("  ▸  ")}{"  ▸  "}<b style={{color:"#0F1F5C"}}>{form.title||task.title}</b></p>}
              {(()=>{ const exclude=new Set([task.id,...taskDescFlat(D,task.id).map(x=>x.t.id)]); const cands=(D.tasks||[]).filter(x=>!x.isFixed&&x.projectId===form.projectId&&!exclude.has(x.id)); return(
                <div style={{marginBottom:8}}>
                  <span style={{fontSize:10.5,fontWeight:700,color:"#6B7280"}}>상위 업무(부모) — 어느 단계의 하위로?</span>
                  <select value={form.parentId||""} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} style={{width:"100%",marginTop:4,padding:"9px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,fontWeight:600,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff",WebkitAppearance:"none"}}>
                    <option value="">— 최상위(로드단계)로 —</option>
                    {cands.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              );})()}
              {desc.length>0?(
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {desc.map(({t,depth})=>{const st=STATUS_MAP[t.status]||STATUS_MAP.todo;const kc=taskKidsOf(D,t.id).length;return(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:7,marginLeft:(depth-1)*14}}>
                      {depth>1&&<span style={{color:"#D1D5DB",fontSize:11,flexShrink:0}}>↳</span>}
                      <button onClick={()=>up&&up("tasks",t.id,statusPatch(D,t,t.status==="done"?"todo":"done"))} title={st.label} style={{width:16,height:16,borderRadius:5,border:`2px solid ${st.color}`,background:t.status==="done"?st.color:"#fff",color:"#fff",fontSize:9,fontWeight:900,cursor:"pointer",flexShrink:0,lineHeight:1,padding:0}}>{t.status==="done"?"✓":""}</button>
                      <span style={{flex:1,minWidth:0,fontSize:12,color:t.status==="done"?"#9CA3AF":"#1F2937",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                      {kc>0&&<span style={{flexShrink:0,fontSize:9,fontWeight:800,color:"#9CA3AF"}}>하위 {kc}</span>}
                      <span style={{flexShrink:0,fontSize:9.5,fontWeight:800,color:st.color}}>{st.label}</span>
                    </div>
                  );})}
                </div>
              ):<p style={{margin:0,fontSize:11,color:"#9CA3AF"}}>하위 업무가 아직 없어요</p>}
              <button onClick={addChild} style={{width:"100%",marginTop:8,padding:"8px 0",borderRadius:9,border:"1.5px dashed #FDBA74",background:"#FFF7ED",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 하위 업무 추가</button>
            </div>
          );
        })()}
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>상태</label>
          <div style={{display:"flex",gap:6}}>
            {Object.entries(STATUS_MAP).map(([k,v])=>{const on=form.status===k;return(
              <button key={k} type="button" onClick={()=>setForm({...form,status:k})} style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1.5px solid ${on?v.color:"#E5E8EB"}`,background:on?v.color+"16":"#fff",color:on?v.color:"#9CA3AF",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{v.label}</button>
            );})}
          </div>
          {form.status!==(task&&task.status)&&<p style={{margin:"6px 2px 0",fontSize:10.5,color:"#EA580C",fontWeight:700}}>저장하면 이 상태 변경이 진행 이력에 날짜와 함께 기록돼요</p>}
        </div>
        {task&&((task.statusLog&&task.statusLog.length)||task.doneAt)&&(
          <div style={{marginBottom:14,padding:"10px 12px",background:"#F9FAFB",borderRadius:12,border:"1px solid #F2F4F6"}}>
            <p style={{margin:"0 0 8px",fontSize:11.5,fontWeight:800,color:"#374151"}}>🧭 진행 이력 <span style={{fontWeight:600,color:"#9CA3AF"}}>(상태가 바뀔 때마다 자동 기록)</span></p>
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {(task.statusLog&&task.statusLog.length?task.statusLog:(task.doneAt?[{status:"done",at:task.doneAt,byName:task.doneByName}]:[])).map((e,i,arr)=>{const st=STATUS_MAP[e.status]||{};const isLast=i===arr.length-1;return(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:9}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                    <span style={{width:9,height:9,borderRadius:"50%",background:st.color||"#9CA3AF",marginTop:4}}/>
                    {!isLast&&<span style={{width:2,flex:1,minHeight:14,background:"#E5E8EB"}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0,paddingBottom:isLast?0:8}}>
                    <span style={{fontSize:11,fontWeight:800,color:st.color||"#6B7280"}}>{st.label||e.status}</span>
                    <span style={{marginLeft:7,fontSize:10.5,color:"#9CA3AF"}}>{(e.at||"").slice(0,16).replace("T"," ")}{e.byName?` · ${e.byName}`:""}</span>
                  </div>
                </div>
              );})}
            </div>
            {task.doneAt&&<p style={{margin:"6px 0 0",fontSize:10.5,fontWeight:800,color:"#00A862"}}>✅ 완료일: {task.doneAt.slice(0,16).replace("T"," ")}</p>}
          </div>
        )}
        {task&&task.isFixed?(
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>🕐 시간 <span style={{color:"#9CA3AF",fontWeight:600}}>(반복 시각 — 선택)</span></label>
          <input type="time" value={form.fixedTime||""} onChange={e=>setForm({...form,fixedTime:e.target.value})} style={{width:"100%",padding:"11px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
        ):(
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>📅 진행 날짜 <span style={{color:"#9CA3AF",fontWeight:600}}>(언제 할지 — 주간 배치에 자동 노출)</span></label>
          <div style={{display:"flex",gap:6,marginBottom:7,flexWrap:"wrap"}}>
            {[["오늘",0],["내일",1]].map(([lbl,off])=>{const dt=new Date();dt.setDate(dt.getDate()+off);const ds=ymdLocal(dt);const on=form.workDate===ds;return(
              <button key={lbl} type="button" onClick={()=>setForm(f=>placeOn(f,ds))} style={{padding:"8px 13px",borderRadius:10,border:`1.5px solid ${on?"#F97316":"#FDBA74"}`,background:on?"#F97316":"#FFF7ED",color:on?"#fff":"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
            );})}
            <input type="date" value={form.workDate||""} onChange={e=>setForm(f=>placeOn(f,e.target.value))} style={{flex:1,minWidth:130,padding:"8px 11px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            <button type="button" onClick={()=>setForm(f=>({...f,workDate:"",weekDay:"",weekSlot:null}))} style={{padding:"8px 11px",borderRadius:10,border:`1.5px solid ${!form.weekDay?"#9CA3AF":"#E5E8EB"}`,background:!form.weekDay?"#F2F4F6":"#fff",color:!form.weekDay?"#4B5563":"#9CA3AF",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>미배치</button>
          </div>
          {form.weekDay&&WEEK_DAYS.includes(form.weekDay)
            ? <p style={{margin:0,fontSize:11,color:"#3182F6",fontWeight:700}}>→ {form.weekDay}요일 {form.weekSlot?form.weekSlot+"순위":"(순위는 그리드에서 자동)"}에 배치 · 드래그로 조정 가능</p>
            : form.workDate?<p style={{margin:0,fontSize:11,color:"#9CA3AF",fontWeight:600}}>주말이라 주간 그리드(월~금)엔 안 보여요 · 날짜는 기록됩니다</p>:null}
        </div>
        )}
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자 <span style={{color:"#9CA3AF",fontWeight:600}}>{task&&task.isFixed?"(여러 명 선택 · 전체 가능)":"(선택 · 기본 미배정)"}</span></label>
          {task&&task.isFixed?(
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>setForm({...form,forAll:false,assigneeIds:[]})} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${!form.forAll&&form.assigneeIds.length===0?"#F97316":"#E5E8EB"}`,background:!form.forAll&&form.assigneeIds.length===0?"#FFEDD5":"#fff",fontSize:12,fontWeight:700,color:!form.forAll&&form.assigneeIds.length===0?"#EA580C":"#9CA3AF",cursor:"pointer",fontFamily:"inherit"}}>미배정</button>
            <button onClick={()=>setForm({...form,forAll:!form.forAll,assigneeIds:[]})} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${form.forAll?"#0F1F5C":"#E5E8EB"}`,background:form.forAll?"#0F1F5C":"#fff",fontSize:12,fontWeight:800,color:form.forAll?"#fff":"#4B5563",cursor:"pointer",fontFamily:"inherit"}}>⭐ 전체</button>
            {D&&D.users.map(u=>{const sel=form.forAll||form.assigneeIds.includes(u.id);return(
              <button key={u.id} onClick={()=>setForm(f=>{const has=f.assigneeIds.includes(u.id);return{...f,forAll:false,assigneeIds:f.forAll?[u.id]:(has?f.assigneeIds.filter(x=>x!==u.id):[...f.assigneeIds,u.id])};})} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,background:sel?u.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={18}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span>{sel&&!form.forAll&&<span style={{fontSize:11,fontWeight:900,color:u.color}}>✓</span>}</button>
            );})}
          </div>
          ):(
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>setForm({...form,assigneeId:"",assigneeIds:[],forAll:false})} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${!form.assigneeId?"#F97316":"#E5E8EB"}`,background:!form.assigneeId?"#FFEDD5":"#fff",fontSize:12,fontWeight:700,color:!form.assigneeId?"#EA580C":"#9CA3AF",cursor:"pointer",fontFamily:"inherit"}}>미배정</button>
            {D&&D.users.map(u=>{const sel=form.assigneeId===u.id;return(
              <button key={u.id} onClick={()=>setForm({...form,assigneeId:u.id,assigneeIds:[u.id],forAll:false})} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,background:sel?u.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={18}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span></button>
            );})}
          </div>
          )}
          {task&&task.isFixed&&<p style={{margin:"7px 2px 0",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>선택한 담당자(또는 전체) 각자 자기 오늘 화면에 표시되고 따로 체크합니다.</p>}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>프로젝트 연결</label>
          <div style={{position:"relative"}}>
            <select value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value,parentId:""})} style={{width:"100%",padding:"12px 36px 12px 12px",borderRadius:12,fontSize:13,border:form.projectId?"1.5px solid #F97316":"1.5px solid #E5E8EB",outline:"none",backgroundColor:form.projectId?"#FFEDD5":"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none",color:form.projectId?"#0F1F5C":"#9CA3AF"}}>
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
          <div
            onDragOver={task&&!uploading?(e)=>{e.preventDefault();if(!dropOver)setDropOver(true);}:undefined}
            onDragLeave={(e)=>{if(dropOver)setDropOver(false);}}
            onDrop={task&&!uploading?(e)=>{e.preventDefault();setDropOver(false);const fs=e.dataTransfer&&e.dataTransfer.files;if(fs&&fs.length)onPick(fs);}:undefined}
            style={{display:"flex",flexWrap:"wrap",gap:8,padding:dropOver?9:0,borderRadius:12,border:`2px dashed ${dropOver?"#F97316":"transparent"}`,background:dropOver?"#FFF7ED":"transparent",transition:"padding .1s, background .1s"}}>
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
          <p style={{margin:"6px 2px 0",fontSize:10,color:"#9CA3AF"}}>{task?"끌어다 놓기(드래그&드롭) · 사진은 붙여넣기(⌘/Ctrl+V)로 바로 첨부 · 클릭 선택도 가능":"먼저 저장하면 첨부할 수 있어요"} · 사진·PDF·문서(워드/엑셀/한글) 각 20MB 이내</p>
        </div>
        <button onClick={doSave} disabled={!form.title.trim()||uploading} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:form.title.trim()&&!uploading?"#F97316":"#E5E8EB",color:form.title.trim()&&!uploading?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:form.title.trim()&&!uploading?"pointer":"not-allowed",fontFamily:"inherit"}}>저장하기</button>
      </div>
    </Sheet>
  );
};
const TABS=[{id:"today",icon:"🏠",label:"오늘"},{id:"kpi",icon:"◎",label:"KPI"},{id:"projects",icon:"▦",label:"프로젝트"},{id:"calendar",icon:"▤",label:"캘린더"},{id:"more",icon:"⋯",label:"더보기"}];
const MORE=[{id:"game",icon:"🎯",label:"내 주간"},{id:"mindmap",icon:"◈",label:"업무 보드"},{id:"fixed",icon:"📌",label:"고정업무"},{id:"team",icon:"👤",label:"담당자"},{id:"retro",icon:"◷",label:"목표·회고"},{id:"ai",icon:"✦",label:"AI 코치"},{id:"guide",icon:"📖",label:"가이드"}];
// 메뉴 그룹: 개인(나만 보는 내 것) vs 팀(모두 같이 보는 공유) — 출시·프로세스는 프로젝트 하위
const NAV_GROUPS=[
  {label:"개인 · 나만", ids:["today","game","fixed","retro"]},
  {label:"팀 · 공유",  ids:["kpi","projects","mindmap","calendar","ai"]},
  {label:"도움말",     ids:["guide"]},
];
let _projInitView=null;   // 오늘 인계카드 → 프로젝트 '프로세스' 탭으로 진입 (마운트 시 1회 소비)
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
  const [undo,setUndo]=useState(null);               // 삭제 직후 되돌리기 토스트
  const [saveErr,setSaveErr]=useState(null);        // {level:'warn'|'error', msg, bytes} | null — 저장 상태 가시화
  const lastColJsonRef=useRef({});    // {컬렉션:JSON} 마지막 동기화본 (에코·변경 판별)
  const loadedRef=useRef(false);
  const syncTimerRef=useRef(null);
  const pendingSharedRef=useRef(null);// 디바운스 대기 중인 최신 shared 객체 (탭 종료 flush용)
  const lastSnapRef=useRef(0);        // 마지막 IndexedDB 스냅샷 시각(throttle)
  const idbInitRef=useRef(false);     // 로드 직후 1회 거울·스냅샷
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
        if(!snap.exists()){ markFirst(k); return; }       // 원격 문서 없음(최초 실행/오프라인) → 로컬 시드 유지, 빈 값으로 덮어쓰지 않음(백지 크래시 방지)
        const items=Array.isArray(snap.data().items)?snap.data().items:[];
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
  // 로드 직후 1회: 막 불러온 정상 상태를 IndexedDB 거울+스냅샷으로 즉시 보관(대용량 영구 보관 시작점)
  useEffect(()=>{ if(!loaded||idbInitRef.current) return; idbInitRef.current=true; const sh=pickShared(D); idbSaveMirror(sh).catch(()=>{}); idbPushSnapshot(sh).then(()=>{lastSnapRef.current=Date.now();}).catch(()=>{}); },[loaded,D]);
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
      // ①-b 3차 안전: IndexedDB 대용량 영구 거울(+ 15분마다 시점 스냅샷). localStorage 한도(~5MB)를 넘어도 보관.
      idbSaveMirror(shared).catch(()=>{});
      if(Date.now()-lastSnapRef.current>15*60*1000){ lastSnapRef.current=Date.now(); idbPushSnapshot(shared).catch(()=>{}); }
      // ② 변경된 컬렉션만 추출
      const changed=[];
      for(const k of SHARED_KEYS){ const js=JSON.stringify(shared[k]||[]); if(js!==lastColJsonRef.current[k]) changed.push([k,shared[k]||[],js]); }
      if(!changed.length) return;
      // ③ 컬렉션별 1MiB 한도 가드 — 초과한 컬렉션만 건너뛰고 나머지는 정상 저장(전체 차단 금지: 한 컬렉션 때문에 다른 데이터가 안 막히도록)
      const over=changed.filter(([,,js])=>new Blob([js]).size>DOC_LIMIT);
      const savable=changed.filter(([,,js])=>new Blob([js]).size<=DOC_LIMIT);
      if(over.length){ const [k,,js]=over[0]; const b=new Blob([js]).size; setSaveErr({level:"error",msg:`'${COL_LABEL[k]||k}' 데이터(${(b/1024).toFixed(0)}KB)가 한도(1024KB)를 넘어 이 항목만 저장이 막혔습니다(나머지는 정상 저장됨). 백업 후 정리 필요 — 이 기기엔 전부 보관됨.`,bytes:b}); }
      if(!savable.length) return;
      // ④ 한도 내 컬렉션만 동시 저장 — 성공해야 동기화본 갱신(실패 시 다음 변경 때 자동 재시도)
      try{
        await Promise.all(savable.map(([k,arr])=>setDoc(colDoc(k),{items:arr,_updatedAt:Date.now()})));
        for(const [k,,js] of savable) lastColJsonRef.current[k]=js;
        if(!over.length) pendingSharedRef.current=null;   // 초과분이 남아있으면 종료 flush가 재시도하도록 pending 유지
        let maxB=0; for(const k of SHARED_KEYS){ const b=new Blob([JSON.stringify(shared[k]||[])]).size; if(b>maxB)maxB=b; }
        if(!over.length) setSaveErr(maxB>DOC_LIMIT*0.85?{level:"warn",msg:`일부 데이터가 한도의 ${Math.round(maxB/DOC_LIMIT*100)}%입니다 — 백업·정리 권장.`,bytes:maxB}:null);   // 초과 에러는 덮어쓰지 않음
      }catch(e){ console.error("[pour-os] 저장 실패:",e);
        setSaveErr({level:"error",msg:`저장 실패(${e.code||e.message}). 변경분은 이 기기에 임시 보관됨 — 새로고침 전에 '전체 백업(JSON)'으로 내려받으세요.`}); }
    },700);
    return ()=>clearTimeout(t);
  },[D,loaded]);
  // 탭 종료/숨김 시: 대기 중이던 변경을 즉시 거울 저장 + 베스트에포트 원격 저장(바뀐 컬렉션만)
  useEffect(()=>{
    const flush=()=>{ const shared=pendingSharedRef.current; if(!shared) return;
      try{ localStorage.setItem(MIRROR_KEY,JSON.stringify(shared)); localStorage.setItem(MIRROR_AT_KEY,new Date().toISOString()); }catch(_){}
      idbSaveMirror(shared).catch(()=>{});
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
    const parentIds=new Set(tasks.filter(t=>t.parentId).map(t=>t.parentId));   // 하위를 가진 업무(상위)는 진행률 집계 제외
    const doneIds=new Set(tasks.filter(t=>t.status==="done").map(t=>t.id));     // 완료 업무 id(구간 완료 판정용)
    let changed=false;
    const projects=(state.projects||[]).map(pr=>{
      let np=pr;
      // ① 진척 자동 산출(기존 동작 동일 — 수동지정/업무없음/동일값이면 유지)
      if(!pr.progressManual){
        const real=tasks.filter(t=>t.projectId===pr.id&&!t.isFixed&&!parentIds.has(t.id)&&t.status!=="hold");   // 보류 업무는 진척 계산에서 제외
        if(real.length>0){
          const auto=Math.round(real.filter(t=>t.status==="done").length/real.length*100);
          if(auto!==(pr.progress||0)){ np={...np,progress:auto}; changed=true; }
        }
      }
      // ② 구간(세그먼트) 완료 집계(추가) — segments 없으면 calcSegDone가 null → 무동작(기존과 동일)
      const seg=calcSegDone(np,doneIds);
      if(seg!==null){ np={...np,segDoneByKpi:seg}; changed=true; }
      return np;
    });
    return changed?{...state,projects}:state;
  };
  const add=(k,item)=>setD(p=>{
    let it=item;   // 업무는 생성 시점을 진행 이력의 첫 항목으로 기록(여정 시작점)
    if(k==="tasks"&&!Array.isArray(item.statusLog)) it={...item,statusLog:[{status:item.status||"todo",at:new Date().toISOString(),by:cu?.id||null,byName:cu?.name||""}]};
    const n={...p,[k]:[...p[k],it]};return k==="tasks"?recalcProg(n):n;});
  const up=(k,id,c)=>setD(p=>{
    // 업무 상태 전이 시 진행 이력(statusLog) 누적 — 할일→진행중→보류→진행중→완료 여정 전체 보존. 완료 전환 시 완료시각·완료자도 기록.
    const list=p[k].map(i=>{ if(i.id!==id) return i; let patch=c;
      if(k==="tasks"&&c.status&&c.status!==i.status){ const at=new Date().toISOString();
        patch={...c,statusLog:[...(Array.isArray(i.statusLog)?i.statusLog:[]),{status:c.status,at,by:cu?.id||null,byName:cu?.name||""}]};
        if(c.status==="done") patch={...patch,doneAt:at,doneBy:cu?.id||null,doneByName:cu?.name||""};
      }
      return {...i,...patch}; });
    const n={...p,[k]:list};
    // 자동화: 업무가 완료로 전이되면 후속 액션 평가(설정 없으면 무동작). recalcProg는 마지막에 한 번.
    const n2=(k==="tasks"&&c.status==="done")?applyAutomation(n,id,cu):n;
    return k==="tasks"?recalcProg(n2):n2;
  });
  const newTid=()=>"trash"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  const delMeta=()=>({_deletedAt:new Date().toISOString(),_deletedBy:cu?.id||null,_deletedByName:cu?.name||""});
  // 삭제 = 영구 제거가 아니라 휴지통 이동. 어떤 데이터도 사라지지 않는다(데이터 자산화 · 복구 가능). silent=대량삭제 시 토스트 생략.
  const rm=(k,id,silent)=>{
    if(k==="trash") return;   // 휴지통 자체는 rm으로 못 지움(복구로만 비워짐)
    const item=(D[k]||[]).find(i=>i.id===id); if(!item) return;
    const _tid=newTid();
    const entry={...item,_col:k,_tid,...delMeta()};
    setD(p=>{const n={...p,[k]:(p[k]||[]).filter(i=>i.id!==id),trash:[...(p.trash||[]),entry]};return k==="tasks"?recalcProg(n):n;});
    if(!silent) setUndo({tid:_tid,label:`${COL_LABEL[k]||"항목"} 삭제됨`});
  };
  // 레코드 *안의* 항목 삭제(예: 프로젝트의 활동지표)도 휴지통 이동. 부모 맥락을 함께 보관해 제자리로 복구.
  const rmNested=(parentCol,parentId,field,itemId,typeLabel)=>{
    const parent=(D[parentCol]||[]).find(x=>x.id===parentId); if(!parent) return;
    const item=(parent[field]||[]).find(x=>x.id===itemId); if(!item) return;
    const _tid=newTid();
    const entry={...item,_col:"_nested",_typeLabel:typeLabel||field,_parentCol:parentCol,_parentId:parentId,_field:field,_tid,...delMeta()};
    setD(p=>{const par=(p[parentCol]||[]).find(x=>x.id===parentId); if(!par) return p;
      const newParent={...par,[field]:(par[field]||[]).filter(x=>x.id!==itemId)};
      return {...p,[parentCol]:(p[parentCol]||[]).map(x=>x.id===parentId?newParent:x),trash:[...(p.trash||[]),entry]};});
    setUndo({tid:_tid,label:`${typeLabel||"항목"} 삭제됨`});
  };
  // 휴지통 → 원래 자리로 복구(원본 id·내용 그대로, 이미 존재하면 중복 생성 안 함)
  const restore=(tid)=>setD(p=>{
    const entry=(p.trash||[]).find(t=>t._tid===tid); if(!entry) return p;
    const trashLeft=(p.trash||[]).filter(t=>t._tid!==tid);
    if(entry._col==="_nested"){   // 중첩 항목 복구: 부모[field] 배열로 되돌림(부모가 없으면 휴지통에 그대로 둠 → 부모 먼저 복구)
      const {_col,_typeLabel,_parentCol,_parentId,_field,_tid:_a,_deletedAt:_b,_deletedBy:_c,_deletedByName:_d,...item}=entry;
      const parent=(p[_parentCol]||[]).find(x=>x.id===_parentId); if(!parent) return p;
      const arr=parent[_field]||[]; const exists=arr.some(x=>(item.id&&x.id===item.id)||(item.url&&x.url===item.url));
      const newParent={...parent,[_field]:exists?arr:[...arr,item]};
      return {...p,[_parentCol]:(p[_parentCol]||[]).map(x=>x.id===_parentId?newParent:x),trash:trashLeft};
    }
    const {_col,_tid,_deletedAt,_deletedBy,_deletedByName,...orig}=entry;
    const exists=(p[_col]||[]).some(i=>i.id===orig.id);
    const n={...p,[_col]:exists?(p[_col]||[]):[...(p[_col]||[]),orig],trash:trashLeft};
    return _col==="tasks"?recalcProg(n):n;
  });
  // 로컬 보관(IndexedDB 미러/스냅샷·localStorage)에서 전체 상태 복구 — 명시적 사용자 동작에서만(확인 후). 컬렉션만 교체, currentUser·UI 보존.
  const restoreLocal=(shared)=>{ if(!shared||typeof shared!=="object") return 0; let n=0; setD(p=>{ const out={...p}; for(const k of SHARED_KEYS){ if(Array.isArray(shared[k])){ out[k]=shared[k]; n+=shared[k].length; } } return recalcProg(out); }); return n; };
  // 외부(GitHub) 백업 — 전체 상태 JSON을 Cloudflare Function(/api/backup)으로 보내 커밋. 토큰은 서버에만.
  const pushExternalBackup=async(reason)=>{
    try{
      const shared=pickShared(D);
      const content=JSON.stringify({_app:"pour-os",_backupAt:new Date().toISOString(),_reason:reason||"manual",...shared},null,2);
      const res=await fetch("/api/backup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,reason:reason||"manual"})});
      const j=await res.json().catch(()=>({ok:false,error:"응답 파싱 실패"}));
      if(j.ok){ try{ localStorage.setItem(EXT_BACKUP_AT_KEY,new Date().toISOString()); }catch(_){} }
      return j;
    }catch(e){ return {ok:false,error:e&&e.message||String(e)}; }
  };
  // 한도 80% 임박 시 자동으로 외부 백업(12시간에 1회). 분당 1회만 용량 점검(thrash 방지).
  const extCheckRef=useRef(0);
  useEffect(()=>{
    if(!loaded) return;
    if(Date.now()-extCheckRef.current<60000) return;
    extCheckRef.current=Date.now();
    let maxB=0; try{ for(const k of SHARED_KEYS){ const b=new Blob([JSON.stringify(D[k]||[])]).size; if(b>maxB)maxB=b; } }catch(_){ return; }
    if(maxB<DOC_LIMIT*0.8) return;
    let last=0; try{ last=Date.parse(localStorage.getItem(EXT_BACKUP_AT_KEY)||"")||0; }catch(_){}
    if(Date.now()-last<12*3600*1000) return;
    try{ localStorage.setItem(EXT_BACKUP_AT_KEY,new Date().toISOString()); }catch(_){}   // 선점(중복 방지) — 실패 시 다음 점검에서 재시도
    pushExternalBackup("auto-threshold").then(j=>{ if(!j||!j.ok){ try{ localStorage.removeItem(EXT_BACKUP_AT_KEY); }catch(_){} } }).catch(()=>{});
  },[D,loaded]);
  useEffect(()=>{ if(!undo) return; const t=setTimeout(()=>setUndo(null),5500); return ()=>clearTimeout(t); },[undo]);   // 되돌리기 토스트 5.5초 후 자동 소멸
  const nav=(id)=>{setPage(id);setMore(false);};
  const allPages=[...TABS.filter(t=>t.id!=="more"),...MORE];
  const pi=allPages.find(p=>p.id===page);
  if(!loaded) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:14,fontFamily:"'Pretendard',sans-serif",color:"#9CA3AF"}}>
      <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:900}}>P</div>
      <p style={{margin:0,fontSize:13,fontWeight:700}}>데이터 불러오는 중…</p>
    </div>
  );
  if(!cu) return(   // 데이터가 비어 사용자 정보를 못 읽음(로드 실패 등) → 백지 크래시 대신 안전 안내
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:14,padding:"0 32px",textAlign:"center",fontFamily:"'Pretendard',sans-serif"}}>
      <div style={{width:42,height:42,borderRadius:12,background:"#FFF3E0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚠️</div>
      <p style={{margin:0,fontSize:15,fontWeight:800,color:"#111827"}}>데이터를 불러오지 못했어요</p>
      <p style={{margin:0,fontSize:12.5,fontWeight:600,color:"#9CA3AF",lineHeight:1.6}}>네트워크 연결을 확인한 뒤 새로고침해 주세요.<br/>입력하신 데이터는 안전하게 보관돼 있어요.</p>
      <button onClick={()=>location.reload()} style={{marginTop:4,padding:"11px 22px",borderRadius:11,border:"none",background:"#F97316",color:"#fff",fontSize:13.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>새로고침</button>
    </div>
  );
  const navAll=[...TABS.filter(t=>t.id!=="more"),...MORE];
  const pageContent=(<>
    {page==="today"&&<TodayPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="kpi"&&<KPIPage D={D} lead={lead} up={up} cu={cu} add={add} rm={rm} restore={restore} restoreLocal={restoreLocal} pushExternalBackup={pushExternalBackup} pc={viewMode==="pc"}/>}
    {page==="projects"&&<ProjectsPage D={D} cu={cu} up={up} add={add} rm={rm} rmNested={rmNested} pc={viewMode==="pc"} lead={lead} nav={nav}/>}
    {page==="calendar"&&<CalendarPage D={D} cu={cu} add={add} up={up} rm={rm}/>}
    {page==="game"&&<GamePage D={D} cu={cu} up={up} add={add} rm={rm} nav={nav}/>}
    {page==="launch"&&<LaunchPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="mindmap"&&<MindMapPage D={D} cu={cu} nav={nav}/>}
    {page==="guide"&&<GuidePage D={D}/>}
    {page==="fixed"&&<FixedPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
    {page==="team"&&<TeamPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm}/>}
    {page==="retro"&&<RetroPage D={D} cu={cu} add={add} up={up} rm={rm}/>}
    {page==="ai"&&<AIPage D={D} cu={cu} add={add} rm={rm}/>}
  </>);
  const sheets=(<>
    {syncToast&&<div style={{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",zIndex:5000,background:"#0F1F5C",color:"#fff",padding:"8px 16px",borderRadius:999,fontSize:12,fontWeight:700,boxShadow:"0 6px 20px rgba(0,0,0,0.25)",whiteSpace:"nowrap",pointerEvents:"none"}}>🔄 다른 기기에서 업데이트됨</div>}
    {undo&&<div style={{position:"fixed",bottom:"calc(env(safe-area-inset-bottom,0px) + 80px)",left:"50%",transform:"translateX(-50%)",zIndex:5200,background:"#0F1F5C",color:"#fff",padding:"10px 12px 10px 16px",borderRadius:12,fontSize:12.5,fontWeight:700,boxShadow:"0 8px 26px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",gap:14,whiteSpace:"nowrap",maxWidth:"calc(100% - 32px)"}}><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>🗑 {undo.label}</span><button onClick={()=>{restore(undo.tid);setUndo(null);}} style={{flexShrink:0,background:"#F97316",color:"#fff",border:"none",borderRadius:8,padding:"6px 13px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>되돌리기</button></div>}
    {saveErr&&<div style={{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 8px)",left:8,right:8,zIndex:5001,background:saveErr.level==="error"?"#FEF2F2":"#FFFBEB",border:`1.5px solid ${saveErr.level==="error"?"#FCA5A5":"#FCD34D"}`,color:saveErr.level==="error"?"#991B1B":"#92400E",padding:"10px 12px",borderRadius:12,fontSize:11.5,fontWeight:700,lineHeight:1.45,boxShadow:"0 6px 20px rgba(0,0,0,0.15)",display:"flex",alignItems:"flex-start",gap:8}}>
      <span style={{flexShrink:0,fontSize:14}}>{saveErr.level==="error"?"⚠️":"📊"}</span>
      <span style={{flex:1}}>{saveErr.msg}</span>
      <button onClick={()=>downloadStateBackup(D)} style={{flexShrink:0,padding:"5px 8px",borderRadius:8,border:"none",background:saveErr.level==="error"?"#DC2626":"#D97706",color:"#fff",fontSize:10.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>백업</button>
      {saveErr.level!=="error"&&<button onClick={()=>setSaveErr(null)} style={{flexShrink:0,padding:"5px 7px",borderRadius:8,border:"none",background:"transparent",color:"inherit",fontSize:13,fontWeight:800,cursor:"pointer"}}>×</button>}
    </div>}
    <Sheet open={more} onClose={()=>setMore(false)} title="더보기">
      {[{label:"개인 · 나만",ids:["game","fixed","retro"]},{label:"팀 · 공유",ids:["mindmap","team","ai"]},{label:"도움말",ids:["guide"]}].map(grp=>(
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
          <div style={{maxWidth:1280,margin:"0 auto",width:"100%"}}>
            <h1 style={{margin:0,fontSize:17,fontWeight:900,color:"#0F1F5C",lineHeight:1.1}}>{pi?.icon} {pi?.label}</h1>
            <p style={{margin:"3px 0 0",fontSize:11,color:"#9CA3AF"}}>{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} · {cu?.name}</p>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}><div style={{width:"100%",maxWidth:1280,margin:"0 auto"}}>{pageContent}</div></div>
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
  const TABS_W=[["sales","💰 매출",salesProjs.length+salesChannels.length],["kpi","📊 운영지표",kpiItems.length],["act","🎯 활동지표",actProjs.reduce((a,p)=>a+(p.activityKPIs||[]).length,0)]];
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
        {tab==="act"&&(actProjs.length===0?<Empty t="등록된 활동지표가 없어요 · 프로젝트에서 추가하세요"/>:actProjs.map(p=>(
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
  const todayStr=ymdLocal(new Date());
  const [weekOffset,setWeekOffset]=useState(0);   // 주간배치 주 이동(0=이번주, -1=저번주, +1=다음주)
  const weekMon=(()=>{const x=new Date();const off=(x.getDay()+6)%7;x.setDate(x.getDate()-off);x.setHours(0,0,0,0);return x;})();   // 이번 주 월요일
  const selMon=(()=>{const m=new Date(weekMon);m.setDate(m.getDate()+weekOffset*7);return m;})();   // 선택된 주의 월요일
  const dateOfDay=(d)=>{const i=WEEK_DAYS.indexOf(d);if(i<0)return"";const dt=new Date(selMon);dt.setDate(dt.getDate()+i);return ymdLocal(dt);};   // 선택 주의 그 요일 실제 날짜
  const wdDate=(d)=>{const ds=dateOfDay(d);return ds?ds.slice(5).replace("-","/"):"";};   // MM/DD
  const isThisWeek=weekOffset===0;
  const myT=D.tasks.filter(t=>t.assigneeId===cu.id);
  const fixedDueToday=(t)=>{const rt=t.recurType||"daily";if(rt==="weekly")return t.weekDay===today;if(rt==="monthly")return Number(t.monthDay||1)===todayDate;return true;};
  const fixed=D.tasks.filter(t=>t.isFixed&&fixedIsMine(t,cu.id)&&fixedDueToday(t));
  // 오늘 업무 = 진행날짜가 오늘 / 또는 날짜 없이 오늘 요일에 배치된 것(주 구분 위해 날짜 우선) · 보류 제외
  const todayT=myT.filter(t=>!t.isFixed&&t.status!=="hold"&&(t.workDate===todayStr||(!t.workDate&&t.weekDay===today)));
  const urgent=myT.filter(t=>t.status!=="done"&&t.status!=="hold"&&t.dueDate&&(()=>{const dd=Math.ceil((new Date(t.dueDate)-new Date())/86400000);return dd>=0&&dd<=3;})());
  // 밀린 업무(이월): 진행날짜가 오늘 이전인데 아직 미완료·미보류 (미래 주 배치는 제외)
  const todayIdx=WEEK_DAYS.indexOf(today);
  const carry=myT.filter(t=>!t.isFixed&&t.status!=="done"&&t.status!=="hold"&&(
      (t.workDate&&t.workDate<todayStr) ||
      (!t.workDate&&t.weekDay&&t.weekDay!==today&&(()=>{const i=WEEK_DAYS.indexOf(t.weekDay);return i>=0&&(todayIdx<0||i<todayIdx);})())
    ))
    .sort((a,b)=>String(a.workDate||"9999").localeCompare(String(b.workDate||"9999"))||(WEEK_DAYS.indexOf(a.weekDay)-WEEK_DAYS.indexOf(b.weekDay)));
  const held=myT.filter(t=>!t.isFixed&&t.status==="hold");
  const bringToday=t=>up("tasks",t.id,{weekDay:today,workDate:todayStr,weekSlot:null,status:"todo"});   // 오늘로 가져오기(보류 해제 포함)
  const holdTask=t=>up("tasks",t.id,statusPatch(D,t,"hold"));
  // 캘린더 일정(미팅·외근)을 주간 슬롯에 배치 — 일정 연결 업무 생성(eventId로 추적, 캘린더 원본은 그대로)
  const placeEvent=(ev,day,slot)=>{
    const prev=slotMap[day]?.[slot]; if(prev)up("tasks",prev.id,{weekDay:null,weekSlot:null});
    const et=EVENT_TYPES[ev.type]||{};
    add("tasks",{id:"t"+Date.now(),title:ev.title,projectId:ev.projectId||"",assigneeId:cu.id,type:"event",eventId:ev.id,
      status:"todo",isFixed:false,weekDay:day,workDate:dateOfDay(day),weekSlot:slot,dueDate:ev.date||"",memo:`📅 ${et.label||"일정"}${ev.place?" · "+ev.place:""}`,attachments:[]});
  };
  const slotMap={};
  WEEK_DAYS.forEach(d=>{slotMap[d]={};[1,2,3,4,5].forEach(s=>{slotMap[d][s]=myT.find(t=>!t.isFixed&&t.weekDay===d&&t.weekSlot===s)||null;});});
  const [slotSheet,setSlotSheet]=useState(null);
  const dragRef=useRef(null);   // 주간 그리드 드래그 중인 업무
  const [dragOver,setDragOver]=useState(null);   // "day_slot" 하이라이트
  const dropDayCol=(d)=>{   // 다른 요일/주 칸으로 드롭 — 그 날짜(선택 주)로 진행날짜 앵커 + 끝 순서
    const dr=dragRef.current; dragRef.current=null; setDragOver(null);
    if(!dr) return; const ds=dateOfDay(d);
    if(dr.weekDay===d&&dr.workDate===ds) return;
    up("tasks",dr.id,{weekDay:d,workDate:ds,weekSlot:nextSlot(d)});
  };
  // 요일별 정렬 목록 — 선택 주의 그 날짜(workDate) 업무 + (이번 주에 한해) 날짜 없이 요일만 배치된 것도 노출
  const dayOrdered=(d)=>{const ds=dateOfDay(d);return myT.filter(t=>!t.isFixed&&(t.workDate===ds||(isThisWeek&&!t.workDate&&t.weekDay===d)))
    .sort((a,b)=>{const sa=a.weekSlot??9999,sb=b.weekSlot??9999;return sa!==sb?sa-sb:String(a.id).localeCompare(String(b.id));});};
  const nextSlot=(d)=>Math.max(0,...dayOrdered(d).map(t=>t.weekSlot||0))+1;
  // 같은 요일 안에서 순서만 변경 — 통째로 1..N 재번호(순위 명확화)
  const reorderDay=(d,from,to)=>{
    const arr=dayOrdered(d); if(to<0||to>=arr.length||from===to) return;
    const [m]=arr.splice(from,1); arr.splice(to,0,m);
    arr.forEach((t,i)=>{ if((t.weekSlot||0)!==i+1) up("tasks",t.id,{weekSlot:i+1}); });
  };
  const [quick,setQuick]=useState("");
  const [quickProj,setQuickProj]=useState("");
  const [confirmTaskId,setConfirmTaskId]=useState(null);
  const [editTask,setEditTask]=useState(null);
  const [expandedCards,setExpandedCards]=useState({});   // 카드에서 '하위 X/Y' 탭 → 그 자리 인라인 펼침
  const CardSubtree=({tid})=>{const desc=taskDescFlat(D,tid);return(
    <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #E5E8EB",display:"flex",flexDirection:"column",gap:4}}>
      {desc.length===0?<p style={{margin:0,fontSize:11,color:"#9CA3AF"}}>하위 업무가 없어요</p>:desc.map(({t:c,depth})=>{const cs=STATUS_MAP[c.status]||STATUS_MAP.todo;return(
        <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,marginLeft:(depth-1)*14}}>
          {depth>1&&<span style={{color:"#D1D5DB",fontSize:11,flexShrink:0}}>↳</span>}
          <button onClick={()=>up("tasks",c.id,statusPatch(D,c,c.status==="done"?"todo":"done"))} title={cs.label} style={{width:16,height:16,borderRadius:5,border:`2px solid ${cs.color}`,background:c.status==="done"?cs.color:"#fff",color:"#fff",fontSize:9,fontWeight:900,cursor:"pointer",flexShrink:0,lineHeight:1,padding:0}}>{c.status==="done"?"✓":""}</button>
          <span style={{flex:1,minWidth:0,fontSize:12,color:c.status==="done"?"#9CA3AF":"#1F2937",textDecoration:c.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
          {(()=>{const k=taskKidsOf(D,c.id).length;return k?<span style={{fontSize:9,fontWeight:800,color:"#9CA3AF",flexShrink:0}}>하위 {k}</span>:null;})()}
          <button onClick={()=>setEditTask(c)} style={{background:"none",border:"none",fontSize:11,cursor:"pointer",color:"#C4C9D0",padding:4,flexShrink:0}}>✎</button>
        </div>
      );})}
    </div>
  );};
  const [projModal,setProjModal]=useState(null);     // 오늘에서 프로젝트 상세·수정 모달
  const [processProj,setProcessProj]=useState(null); // 모달에서 프로세스 편집 진입
  const [feedOpen,setFeedOpen]=useState(false);
  const [expandedMember,setExpandedMember]=useState(null);   // 팀 활동 — 팀원별 상세 펼침
  const [weeklyOpen,setWeeklyOpen]=useState(false);
  const [showHeld,setShowHeld]=useState(false);
  const [isNarrow,setIsNarrow]=useState(typeof window!=="undefined"?window.innerWidth<640:true);   // 모바일=하루씩, 넓은 화면=요일 5열
  useEffect(()=>{const h=()=>setIsNarrow(window.innerWidth<640);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  const [viewDay,setViewDay]=useState(WEEK_DAYS.includes(today)?today:"월");   // 모바일 단일요일 보기(오늘 기준 시작)
  const [taskFilter,setTaskFilter]=useState("todo");   // 내 업무 상태 필터: todo|inprogress|done|hold
  const [qa,setQa]=useState({title:"",status:"todo",workDate:"",weekDay:"",weekSlot:null,projectId:""});   // 내 업무 빠른 등록
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
  const toggle=t=>up("tasks",t.id,statusPatch(D,t,t.status==="done"?"todo":"done"));
  // 고정(반복)업무는 날짜별 완료 — 오늘 체크는 오늘만 유지(매일 리셋)
  const fixedDone=t=>fixedDoneOn(t,cu.id)===todayKey;
  const toggleFixed=t=>up("tasks",t.id,{doneDates:{...(t.doneDates||{}),[cu.id]:fixedDone(t)?null:todayKey},doneAt:new Date().toISOString(),doneByName:cu?.name||""});
  const doQuick=()=>{
    if(!quick.trim()) return;
    add("tasks",{id:"t"+Date.now(),title:quick.trim(),projectId:quickProj,assigneeId:cu.id,type:"general",status:"todo",weekDay:today,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[]});
    setQuick("");setQuickProj("");
  };
  // 내 업무 빠른 등록 — 진행날짜→요일·순위 자동 배치
  const qaPlace=(ds)=>{ if(!ds) return {workDate:"",weekDay:"",weekSlot:null}; const d=new Date(ds+"T00:00:00"); const wd=ALL_DAYS[d.getDay()]; return {workDate:ds,weekDay:wd,weekSlot:WEEK_DAYS.includes(wd)?nextSlot(wd):null}; };
  const doRegister=()=>{
    if(!qa.title.trim()) return;
    add("tasks",{id:"t"+Date.now(),title:qa.title.trim(),projectId:qa.projectId,assigneeId:cu.id,type:"general",status:qa.status,weekDay:qa.weekDay||null,weekSlot:qa.weekSlot??null,workDate:qa.workDate||"",isFixed:false,dueDate:"",memo:"",attachments:[]});
    setTaskFilter(qa.status);
    setQa({title:"",status:"todo",workDate:"",weekDay:"",weekSlot:null,projectId:""});
  };
  const doneToday=todayT.filter(t=>t.status==="done").length;
  const doneFixed=fixed.filter(fixedDone).length;
  const myProjs=D.projects.filter(p=>p.assigneeId===cu.id||(p.collaboratorIds||[]).includes(cu.id));
  const myGoals=myWeekGoals(D,cu.id);
  // 출시 인계 — 앞 단계가 끝나 내 차례가 된 출시 단계
  const myReadyLaunch=(()=>{ const arr=[]; D.projects.filter(p=>p.templateId).forEach(p=>{ const ts=launchProjTasks(D,p); ts.forEach(t=>{ if(t.assigneeId===cu.id&&launchStageStatus(t,ts)==="ready") arr.push({proj:p,task:t}); }); }); return [...arr,...myReadyProcess(D,cu.id)]; })();
  // 주간 배치 — 요일 칸 1개 렌더(모바일=전체폭 크게, 데스크탑=5열 중 하나). 진행날짜/요일 있는 업무 자동 노출 + 순서만 조정
  const renderDayCol=(d,mobile)=>{
    const list=dayOrdered(d); const isT=d===today&&isThisWeek; const dk="col_"+d;
    return(
      <div key={d} onDragOver={mobile?undefined:e=>{e.preventDefault();if(dragOver!==dk)setDragOver(dk);}} onDragLeave={mobile?undefined:()=>{if(dragOver===dk)setDragOver(null);}} onDrop={mobile?undefined:e=>{e.preventDefault();dropDayCol(d);}}
        style={{flex:mobile?"none":1,minWidth:0,backgroundColor:dragOver===dk?"#FFF7ED":(isT?"rgba(255,237,213,0.5)":"#F9FAFB"),border:`1.5px solid ${dragOver===dk?"#F97316":(isT?"#FBBF77":"#E5E8EB")}`,borderRadius:12,padding:mobile?"6px 8px 8px":"10px 8px"}}>
        {!mobile&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:11,fontWeight:900,color:isT?"#EA580C":"#4B5563"}}>{d}요일 <span style={{fontWeight:700,color:isT?"#F59E5B":"#B0B8C1"}}>{wdDate(d)}</span></span>
            {isT&&<span style={{fontSize:9,fontWeight:900,color:"#FFFFFF",background:"#F97316",padding:"1px 5px",borderRadius:10}}>오늘</span>}
          </div>
        )}
        {list.length===0&&<p style={{margin:"6px 2px",fontSize:mobile?12:9.5,color:"#C4C9D0",textAlign:"center",fontStyle:"italic"}}>{mobile?"이 요일 업무가 없어요 · 아래 ＋배치":"+배치"}</p>}
        {list.map((t,i)=>{
          const st=STATUS_MAP[t.status]||{}; const done=t.status==="done";
          return(
            <div key={t.id} draggable={!mobile} onDragStart={mobile?undefined:e=>{dragRef.current=t;try{e.dataTransfer.effectAllowed="move";}catch(_){}}} onDragEnd={mobile?undefined:()=>{dragRef.current=null;setDragOver(null);}}
              onClick={()=>setEditTask(t)}
              style={{display:"flex",alignItems:"center",gap:mobile?8:4,padding:mobile?"9px 10px":"5px 7px",marginBottom:mobile?6:4,borderRadius:mobile?10:8,border:`1px solid ${done?"rgba(0,192,115,0.25)":"#E5E8EB"}`,background:done?"#E8FAF1":"#FFFFFF",cursor:mobile?"pointer":"grab",minHeight:mobile?40:28}}>
              <span style={{flexShrink:0,fontSize:mobile?11:9,fontWeight:900,color:isT?"#EA580C":"#9CA3AF",minWidth:mobile?16:10,textAlign:"center"}}>{i+1}</span>
              <span style={{flex:1,minWidth:0,fontSize:mobile?13:10,fontWeight:700,color:done?"#9CA3AF":"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:done?"line-through":"none"}}>{t.eventId?"📅":""}{t.title}</span>
              {mobile&&st.label&&<span style={{flexShrink:0,fontSize:10,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"2px 7px",borderRadius:6}}>{st.label}</span>}
              <span onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",flexShrink:0,gap:1}}>
                <button onClick={()=>reorderDay(d,i,i-1)} disabled={i===0} title="위로" style={{width:mobile?22:15,height:mobile?15:11,border:"none",background:"none",cursor:i===0?"default":"pointer",color:i===0?"#E5E8EB":"#9CA3AF",fontSize:mobile?11:8,lineHeight:1,padding:0}}>▲</button>
                <button onClick={()=>reorderDay(d,i,i+1)} disabled={i===list.length-1} title="아래로" style={{width:mobile?22:15,height:mobile?15:11,border:"none",background:"none",cursor:i===list.length-1?"default":"pointer",color:i===list.length-1?"#E5E8EB":"#9CA3AF",fontSize:mobile?11:8,lineHeight:1,padding:0}}>▼</button>
              </span>
            </div>
          );
        })}
        <button onClick={()=>setSlotSheet({day:d,slot:nextSlot(d),current:null})} style={{width:"100%",marginTop:2,padding:mobile?"9px 0":"5px 0",borderRadius:8,border:"1px dashed #E5E8EB",background:"#fff",color:"#9CA3AF",fontSize:mobile?12:9.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>＋ 배치</button>
      </div>
    );
  };
  const vdIdx=WEEK_DAYS.indexOf(viewDay);
  // 상단 분할: 이번 주 명심(좌) + 마감 임박(우) — PC는 나란히, 모바일은 세로
  const memoBanner=(
    <div onClick={()=>nav("game")} style={{display:"flex",alignItems:"center",gap:14,background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:16,padding:"16px 18px",cursor:"pointer",color:"#fff",flex:1,minWidth:0,boxSizing:"border-box"}}>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:19,fontWeight:900,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{myGoals.length===0?"이번 주 메모를 남겨보세요 ✍️":myGoals.map(g=>g.title).join("   ·   ")}</p>
      </div>
      <div style={{flexShrink:0,textAlign:"right",opacity:0.72}}>
        <p style={{margin:0,fontSize:9.5,fontWeight:700,whiteSpace:"nowrap"}}>📝 이번 주 명심할 것</p>
        <span style={{display:"inline-block",marginTop:4,fontSize:10,fontWeight:800,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"3px 9px",borderRadius:10,whiteSpace:"nowrap"}}>내 주간 ›</span>
      </div>
    </div>
  );
  const urgentCard=urgent.length>0?(
    <div style={{backgroundColor:"#FFF0F1",border:"1px solid #FFD5D8",borderRadius:14,padding:"13px 14px",flex:1,minWidth:0,boxSizing:"border-box"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
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
  ):null;
  return(
    <div style={{padding:"14px 16px 20px"}}>
      {(!isNarrow&&urgentCard)?(
        <div style={{display:"flex",gap:12,marginBottom:12,alignItems:"stretch"}}>{memoBanner}{urgentCard}</div>
      ):(<>
        <div style={{marginBottom:urgentCard?12:14}}>{memoBanner}</div>
        {urgentCard&&<div style={{marginBottom:14}}>{urgentCard}</div>}
      </>)}
      <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[{label:"오늘 업무",val:`${doneToday}/${todayT.length}`,color:"#3182F6"},{label:"고정업무",val:`${doneFixed}/${fixed.length}`,color:"#F97316"},{label:"내 프로젝트",val:D.projects.filter(p=>p.assigneeId===cu.id).length+"건",color:"#8B5CF6"}].map((s,i)=>(
          <div key={i} style={{flexShrink:0,backgroundColor:"#FFFFFF",borderRadius:12,padding:"10px 14px",border:"1px solid #F2F4F6"}}>
            <p style={{margin:0,fontSize:10,color:"#9CA3AF",fontWeight:600}}>{s.label}</p>
            <p style={{margin:"2px 0 0",fontSize:18,fontWeight:900,color:s.color}}>{s.val}</p>
          </div>
        ))}
      </div>
      {isLastWorkingDayOfWeek()&&<button onClick={()=>setWeeklyOpen(true)} style={{width:"100%",marginBottom:14,padding:"13px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"#fff",fontSize:14.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🗓️ 이번 주 마감 입력 — 매출·KPI·활동지표 한 번에</button>}
      <WeeklyInputSheet open={weeklyOpen} onClose={()=>setWeeklyOpen(false)} D={D} cu={cu} up={up}/>
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,marginBottom:14,border:"1px solid #F2F4F6",overflow:"hidden"}}>
        <div onClick={()=>setFeedOpen(o=>!o)} style={{padding:"13px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📋 이번 주 팀 활동</h3>
            <span style={{fontSize:11,fontWeight:800,color:"#fff",background:actFeed.length>0?"#00C073":"#D1D5DB",padding:"2px 8px",borderRadius:10}}>{actFeed.length}건</span>
          </div>
          <span style={{fontSize:12,color:"#9CA3AF"}}>{weekLabel(wkNow)} {feedOpen?"▲":"▼"}</span>
        </div>
        {feedOpen&&(
          <div style={{borderTop:"1px solid #F2F4F6",padding:"4px 12px 10px"}}>
            {actFeed.length===0?<p style={{padding:"16px 0",textAlign:"center",fontSize:12.5,color:"#9CA3AF"}}>이번 주 기록된 활동이 없어요 · 기록되지 않은 업무는 자산이 되지 않아요</p>:(()=>{
              const groups={}; actFeed.forEach(e=>{const k=e.who||"기타";(groups[k]=groups[k]||[]).push(e);});
              const names=Object.keys(groups).sort((a,b)=>{const da=groups[a].filter(x=>x.icon==="✅").length,db=groups[b].filter(x=>x.icon==="✅").length;return db-da||groups[b].length-groups[a].length;});
              return names.map(name=>{
                const items=groups[name];
                const done=items.filter(x=>x.icon==="✅").length;
                const sales=items.filter(x=>x.icon==="💰").length;
                const kpi=items.filter(x=>x.icon==="🎯"||x.icon==="📊").length;
                const u=D.users.find(x=>x.name===name); const col=u?.color||"#9CA3AF"; const open=expandedMember===name;
                return(
                  <div key={name} style={{borderBottom:"1px solid #F4F5F7"}}>
                    <button onClick={()=>setExpandedMember(open?null:name)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 2px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                      <Ava name={name} color={col} size={28}/>
                      <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:800,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                      <span style={{flexShrink:0,fontSize:11.5,fontWeight:800,color:"#00A862",background:"#E8FAF1",borderRadius:8,padding:"3px 9px"}}>✅ {done} 완료</span>
                      {sales>0&&<span style={{flexShrink:0,fontSize:11,fontWeight:800,color:"#EA580C",background:"#FFF1E7",borderRadius:8,padding:"3px 8px"}}>💰 {sales}</span>}
                      {kpi>0&&<span style={{flexShrink:0,fontSize:11,fontWeight:800,color:"#7C3AED",background:"#F3EFFE",borderRadius:8,padding:"3px 8px"}}>🎯 {kpi}</span>}
                      <span style={{flexShrink:0,fontSize:11,color:"#C4C9D0"}}>{open?"▲":"▼"}</span>
                    </button>
                    {open&&(
                      <div style={{padding:"0 0 10px 38px"}}>
                        {items.map((e,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0"}}>
                            <span style={{fontSize:13,flexShrink:0}}>{e.icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:12,fontWeight:600,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.text}</p>
                              <p style={{margin:"1px 0 0",fontSize:10,color:"#9CA3AF"}}>{(e.at||"").slice(5,16).replace("T"," ")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
      {(carry.length>0||held.length>0)&&(
        <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:14,border:"1px solid "+(carry.length>0?"#FED7AA":"#F2F4F6")}}>
          {carry.length>0&&(<>
            <div style={{marginBottom:10}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#EA580C"}}>⏰ 밀린 업무 ({carry.length})</h3>
              <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>지난 요일에 못 끝낸 내 업무 · 오늘로 가져오거나 보류하세요</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {carry.map(t=>{const proj=D.projects.find(p=>p.id===t.projectId);return(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,backgroundColor:"#FFF7ED",border:"1px solid #FED7AA"}}>
                  <span style={{flexShrink:0,fontSize:9.5,fontWeight:900,color:"#EA580C",background:"#FFE4C7",borderRadius:6,padding:"2px 6px"}}>{t.weekDay}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
                    {proj&&<p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {proj.title}</p>}
                  </div>
                  <button onClick={()=>bringToday(t)} style={{flexShrink:0,padding:"6px 9px",borderRadius:8,border:"none",background:"#F97316",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📍 오늘로</button>
                  <button onClick={()=>holdTask(t)} style={{flexShrink:0,padding:"6px 9px",borderRadius:8,border:"1px solid #FFD9A6",background:"#fff",color:"#EA580C",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>⏸ 보류</button>
                </div>);})}
            </div>
          </>)}
          {held.length>0&&(
            <div style={{marginTop:carry.length>0?12:0,paddingTop:carry.length>0?12:0,borderTop:carry.length>0?"1px dashed #F2E6D5":"none"}}>
              <button onClick={()=>setShowHeld(s=>!s)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
                <span style={{fontSize:12.5,fontWeight:800,color:"#FF9500"}}>⏸ 보류 중 ({held.length})</span>
                <span style={{fontSize:11,color:"#9CA3AF"}}>{showHeld?"접기 ▲":"펼치기 ▼"}</span>
              </button>
              {showHeld&&(
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:9}}>
                  {held.map(t=>{const proj=D.projects.find(p=>p.id===t.projectId);return(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:10,backgroundColor:"#FFF3E0",border:"1px solid #FFE0B2"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12.5,fontWeight:700,color:"#7C4A03",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
                        {proj&&<p style={{margin:"2px 0 0",fontSize:10,color:"#B98A3E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📁 {proj.title}{t.weekDay?` · ${t.weekDay}`:""}</p>}
                      </div>
                      <button onClick={()=>bringToday(t)} style={{flexShrink:0,padding:"6px 10px",borderRadius:8,border:"none",background:"#F97316",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📍 오늘로 재개</button>
                    </div>);})}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:14,border:"1px solid #F2F4F6"}}>
        <div style={{marginBottom:2}}>
          <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📅 주간 업무 배치</h3>
          <p style={{margin:0,fontSize:10.5,color:"#9CA3AF"}}>{isNarrow?"하루씩 ◀▶ · ‹ › 로 주 이동 · ▲▼ 순서":"‹ › 로 주 이동(저번/다음 주) · 드래그로 날짜 이동 · ▲▼ 순서"}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,margin:"9px 0 2px"}}>
          <button onClick={()=>setWeekOffset(o=>o-1)} style={{padding:"6px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>‹ 저번주</button>
          <div style={{textAlign:"center",minWidth:0,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
            <span style={{fontSize:12.5,fontWeight:900,color:isThisWeek?"#EA580C":"#0F1F5C"}}>{isThisWeek?"이번 주":weekOffset===-1?"저번 주":weekOffset===1?"다음 주":(weekOffset>0?`${weekOffset}주 후`:`${-weekOffset}주 전`)}</span>
            <span style={{fontSize:11,fontWeight:700,color:"#9CA3AF"}}>{wdDate("월")}~{wdDate("금")}</span>
            {!isThisWeek&&<button onClick={()=>setWeekOffset(0)} style={{padding:"2px 8px",borderRadius:7,fontSize:10,fontWeight:800,color:"#3182F6",background:"#EFF6FF",border:"none",cursor:"pointer",fontFamily:"inherit"}}>이번 주로</button>}
          </div>
          <button onClick={()=>setWeekOffset(o=>o+1)} style={{padding:"6px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>다음주 ›</button>
        </div>
        {(isNarrow?(
          <div style={{marginTop:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <button onClick={()=>{if(vdIdx>0)setViewDay(WEEK_DAYS[vdIdx-1]);else{setWeekOffset(o=>o-1);setViewDay(WEEK_DAYS[WEEK_DAYS.length-1]);}}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:15,fontWeight:900,cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}>◀</button>
              <div style={{flex:1,textAlign:"center"}}>
                <span style={{fontSize:15,fontWeight:900,color:(viewDay===today&&isThisWeek)?"#EA580C":"#0F1F5C"}}>{viewDay}요일</span>
                <span style={{marginLeft:5,fontSize:12,fontWeight:800,color:"#9CA3AF"}}>{wdDate(viewDay)}</span>
                {viewDay===today&&isThisWeek&&<span style={{marginLeft:6,fontSize:9.5,fontWeight:900,color:"#fff",background:"#F97316",padding:"2px 6px",borderRadius:10}}>오늘</span>}
                <span style={{marginLeft:6,fontSize:11.5,fontWeight:700,color:"#9CA3AF"}}>{dayOrdered(viewDay).length}건</span>
              </div>
              <button onClick={()=>{if(vdIdx<WEEK_DAYS.length-1)setViewDay(WEEK_DAYS[vdIdx+1]);else{setWeekOffset(o=>o+1);setViewDay(WEEK_DAYS[0]);}}} style={{width:38,height:38,borderRadius:10,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:15,fontWeight:900,cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}>▶</button>
            </div>
            {renderDayCol(viewDay,true)}
            <div style={{display:"flex",gap:5,marginTop:9}}>
              {WEEK_DAYS.map(d=>{const n=dayOrdered(d).length;const on=d===viewDay;const isT=d===today&&isThisWeek;return(
                <button key={d} onClick={()=>setViewDay(d)} style={{flex:1,padding:"6px 0",borderRadius:9,border:`1.5px solid ${on?"#0F1F5C":(isT?"#FBBF77":"#E5E8EB")}`,background:on?"#0F1F5C":(isT?"#FFF7ED":"#fff"),color:on?"#fff":(isT?"#EA580C":"#9CA3AF"),fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{d}{n>0&&<span style={{display:"block",fontSize:9,fontWeight:900,opacity:on?0.9:0.7}}>{n}</span>}</button>
              );})}
            </div>
          </div>
        ):(
          <div style={{paddingBottom:4,marginTop:10}}>
            <div style={{display:"flex",gap:10}}>{WEEK_DAYS.map(d=>renderDayCol(d,false))}</div>
          </div>
        ))}
      {/* 주간 업무 배치: 항상 펼친 상태 고정 */}
      </div>
      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 380px",minWidth:0,backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #F2F4F6",boxSizing:"border-box"}}>
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
                <div key={t.id} style={{borderRadius:12,backgroundColor:t.status==="done"?"rgba(232,250,241,0.34)":"#F9FAFB",border:`1px solid ${t.status==="done"?"rgba(0,192,115,0.2)":"#E5E8EB"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px"}}>
                  <button onClick={()=>toggle(t)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${t.status==="done"?"#00C073":"#D1D5DB"}`,backgroundColor:t.status==="done"?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                    {t.status==="done"&&<span style={{color:"#FFFFFF",fontSize:12,fontWeight:900}}>✓</span>}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#111827",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.eventId?"📅 ":""}{t.title}</p>
                    {(()=>{const chain=taskParentChain(D,t);const ru=taskRollup(D,t.id);const pathTxt=[proj&&`📁 ${proj.title}`,...chain.map(c=>c.title)].filter(Boolean).join(" ▸ ");return (proj||chain.length>0||ru.total>0||(t.status==="done"&&t.doneAt))?(<p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.status==="done"&&t.doneAt?<span style={{color:"#00A862",fontWeight:700}}>✓ {hhmm(t.doneAt)} 완료{(pathTxt||ru.total)?" · ":""}</span>:null}{pathTxt}{ru.total>0?<button onClick={()=>setExpandedCards(e=>({...e,[t.id]:!e[t.id]}))} style={{marginLeft:pathTxt?6:0,fontWeight:800,color:ru.done>=ru.total?"#00A862":"#7C3AED",border:"none",background:"none",padding:0,cursor:"pointer",fontFamily:"inherit",fontSize:10.5}}>{pathTxt?"· ":""}하위 {ru.done}/{ru.total} {expandedCards[t.id]?"▾":"▸"}</button>:null}</p>):null;})()}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {t.weekSlot&&<span style={{fontSize:10,fontWeight:800,color:"#9CA3AF"}}>{t.weekSlot}순위</span>}
                    <span style={{fontSize:11,fontWeight:700,color:st.color,backgroundColor:st.bg,padding:"2px 8px",borderRadius:6}}>{st.label}</span>
                    {t.status!=="done"&&<button onClick={()=>holdTask(t)} title="보류" style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#FF9500",padding:8}}>⏸</button>}
                    <button onClick={()=>setEditTask(t)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#9CA3AF",padding:8}}>✎</button>
                    <button onClick={()=>setConfirmTaskId(t.id)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#D1D5DB",padding:8}}>✕</button>
                  </div>
                  </div>
                  {expandedCards[t.id]&&<div style={{padding:"0 12px 11px"}}><CardSubtree tid={t.id}/></div>}
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
      <div style={{flex:"1 1 300px",minWidth:0,backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #F2F4F6",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📌 고정업무 <span style={{fontWeight:600,color:"#9CA3AF",fontSize:11}}>(내 담당)</span></h3>
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
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:dn?"#9CA3AF":"#111827",textDecoration:dn?"line-through":"none"}}>{t.fixedTime?<span style={{color:dn?"#9CA3AF":"#EA580C",fontWeight:800,marginRight:5}}>🕐{t.fixedTime}</span>:null}{t.title}</p>
                    <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{dn&&t.doneAt?<span style={{color:"#00A862",fontWeight:700}}>✓ {hhmm(t.doneAt)} 완료 · </span>:null}{proj?`📁 ${proj.title}`:"반복 업무"}</p>
                  </div>
                  <span style={{fontSize:10,color:"#F97316",fontWeight:800,flexShrink:0}}>🔄</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      {myReadyLaunch.length>0&&(
        <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #FED7AA",marginBottom:14}}>
          <div onClick={()=>{_projInitView="launch";nav("projects");}} style={{marginBottom:12,cursor:"pointer"}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#EA580C"}}>🔔 인계 — 내 차례 ({myReadyLaunch.length})</h3>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>앞 단계가 끝나 내게 넘어온 단계예요 · 완료하면 다음 담당자에게 인계됩니다</p>
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
      {(()=>{
        const FILTERS=[["todo","미완료","#EA580C"],["inprogress","진행중","#3182F6"],["done","완료","#00C073"],["hold","보류","#FF9500"]];
        const mine=myT.filter(t=>!t.isFixed);
        const cnt=(s)=>mine.filter(t=>t.status===s).length;
        const list=mine.filter(t=>t.status===taskFilter).sort((a,b)=>(a.weekDay?1:0)-(b.weekDay?1:0));   // 미배치(요일없음) 먼저
        const cur=FILTERS.find(f=>f[0]===taskFilter);
        return(
          <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #F2F4F6",marginBottom:14}}>
            <div style={{marginBottom:10}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📋 내 업무</h3>
              <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>상태별로 모아 보기 · 미배치는 오늘로 배치할 수 있어요</p>
            </div>
            <div style={{marginBottom:12,padding:"11px 12px",borderRadius:12,background:"#FFF7ED",border:"1.5px solid #FED7AA"}}>
              <div style={{display:"flex",gap:8}}>
                <input value={qa.title} onChange={e=>setQa({...qa,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&doRegister()} placeholder="새 업무 입력... (Enter로 등록)" style={{flex:1,minWidth:0,padding:"10px 12px",borderRadius:10,border:"1.5px solid #FDBA74",fontSize:13,outline:"none",fontFamily:"inherit",backgroundColor:"#fff"}}/>
                <button onClick={doRegister} disabled={!qa.title.trim()} style={{width:42,height:40,borderRadius:10,border:"none",background:qa.title.trim()?"#F97316":"#E5E8EB",color:"#fff",fontSize:20,fontWeight:900,cursor:qa.title.trim()?"pointer":"not-allowed",flexShrink:0}}>+</button>
              </div>
              <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:800,color:"#9A3412",marginRight:1}}>📅</span>
                {[["미정",""],["오늘",0],["내일",1]].map(([lbl,off])=>{const ds=off===""?"":(()=>{const d=new Date();d.setDate(d.getDate()+off);return ymdLocal(d);})();const on=off===""?!qa.workDate:qa.workDate===ds;return(
                  <button key={lbl} onClick={()=>setQa({...qa,...qaPlace(ds)})} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${on?"#F97316":"#E5E8EB"}`,background:on?"#F97316":"#fff",color:on?"#fff":"#9CA3AF",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                );})}
                <input type="date" value={qa.workDate||""} onChange={e=>setQa({...qa,...qaPlace(e.target.value)})} style={{padding:"4px 7px",borderRadius:8,border:"1.5px solid #E5E8EB",fontSize:11,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:800,color:"#9A3412",marginRight:1}}>🚦</span>
                {Object.entries(STATUS_MAP).map(([k,v])=>{const on=qa.status===k;return(
                  <button key={k} onClick={()=>setQa({...qa,status:k})} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${on?v.color:"#E5E8EB"}`,background:on?v.color+"18":"#fff",color:on?v.color:"#9CA3AF",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{v.label}</button>
                );})}
              </div>
              <div style={{position:"relative",marginTop:6}}>
                <select value={qa.projectId} onChange={e=>setQa({...qa,projectId:e.target.value})} style={{width:"100%",padding:"7px 28px 7px 10px",borderRadius:8,border:`1.5px solid ${qa.projectId?"#F97316":"#E5E8EB"}`,fontSize:11.5,fontWeight:700,color:qa.projectId?"#0F1F5C":"#9CA3AF",backgroundColor:qa.projectId?"#FFEDD5":"#fff",fontFamily:"inherit",outline:"none",WebkitAppearance:"none",appearance:"none"}}>
                  <option value="">📁 프로젝트 선택 (선택)</option>
                  {D.projects.map(p=><option key={p.id} value={p.id}>{p.group?`[${p.group}] `:""}{p.title}</option>)}
                </select>
                <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:10,color:qa.projectId?"#F97316":"#9CA3AF"}}>▼</span>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {FILTERS.map(([k,l,c])=>{const on=taskFilter===k;const n=cnt(k);return(
                <button key={k} onClick={()=>setTaskFilter(k)} style={{flex:1,padding:"7px 4px",borderRadius:9,border:`1.5px solid ${on?c:"#E5E8EB"}`,background:on?c+"14":"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  <span style={{fontSize:11.5,fontWeight:800,color:on?c:"#9CA3AF"}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:900,color:on?c:"#C4C9D0"}}>{n}</span>
                </button>);})}
            </div>
            {list.length===0?(
              <p style={{margin:0,padding:"16px 0",textAlign:"center",fontSize:12.5,color:"#B0B8C1"}}>{cur[1]} 업무가 없어요</p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {list.map(t=>{const proj=D.projects.find(p=>p.id===t.projectId);const placed=!!t.weekDay;const st=STATUS_MAP[t.status];return(
                  <div key={t.id} style={{padding:"11px 12px",borderRadius:12,backgroundColor:placed?"#F9FAFB":"#FFF7ED",border:`1px solid ${placed?"#EEF1F4":"#FED7AA"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:13.5,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#111827",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.eventId?"📅 ":""}{t.title}</p>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:9.5,fontWeight:800,color:st.color,background:st.bg,borderRadius:5,padding:"1px 6px"}}>{st.label}</span>
                          <span style={{fontSize:10.5,color:placed?"#6B7280":"#EA580C",fontWeight:placed?600:700}}>{placed?`${t.weekDay}요일${t.weekSlot?` ${t.weekSlot}순위`:""}`:"미배치"}</span>
                          {proj?<span style={{fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· 📁 {proj.title}</span>:<span style={{fontSize:10.5,color:"#F04452",fontWeight:600}}>· ⚠️ 미연결</span>}
                          {(()=>{const ru=taskRollup(D,t.id);return ru.total>0?<button onClick={()=>setExpandedCards(e=>({...e,[t.id]:!e[t.id]}))} style={{border:"none",background:"none",padding:0,cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:800,color:ru.done>=ru.total?"#00A862":"#7C3AED",flexShrink:0}}>· 하위 {ru.done}/{ru.total} {expandedCards[t.id]?"▾":"▸"}</button>:null;})()}
                        </div>
                      </div>
                      <button onClick={()=>setEditTask(t)} style={{padding:"6px 9px",borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",fontSize:12,fontWeight:700,color:"#4B5563",cursor:"pointer",flexShrink:0}}>✎</button>
                      <button onClick={()=>setConfirmTaskId(t.id)} style={{padding:"6px 9px",borderRadius:8,border:"1px solid #FFE2E5",backgroundColor:"#FFF0F1",fontSize:12,fontWeight:700,color:"#F04452",cursor:"pointer",flexShrink:0}}>🗑</button>
                    </div>
                    {expandedCards[t.id]&&<CardSubtree tid={t.id}/>}
                    {(taskFilter==="hold")?(
                      <button onClick={()=>bringToday(t)} style={{width:"100%",marginTop:8,padding:"8px 0",borderRadius:9,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📍 오늘로 재개</button>
                    ):(!placed&&t.status!=="done")&&(
                      <button onClick={()=>up("tasks",t.id,{weekDay:today})} style={{width:"100%",marginTop:8,padding:"8px 0",borderRadius:9,border:"none",backgroundColor:"#F97316",color:"#FFFFFF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📍 오늘({today}) 배치</button>
                    )}
                  </div>);})}
              </div>
            )}
          </div>
        );
      })()}
      {myProjs.length>0&&(()=>{
        const readyProjIds=new Set(myReadyLaunch.map(r=>r.proj.id));
        const CC=[["todo","미완료","#EA580C"],["inprogress","진행중","#3182F6"],["done","완료","#00A862"],["hold","보류","#FF9500"]];
        const hasT=(pr)=>D.tasks.some(t=>t.projectId===pr.id&&!t.isFixed);
        const projRank=(pr)=>{const ts=D.tasks.filter(t=>t.projectId===pr.id&&!t.isFixed);if(readyProjIds.has(pr.id))return 0;if(ts.some(t=>t.assigneeId===cu.id&&t.status==="inprogress"))return 1;if(ts.some(t=>t.assigneeId===cu.id&&t.status==="todo"))return 2;if(ts.length>0&&ts.every(t=>t.status==="done"))return 4;return 3;};
        const withTasks=myProjs.filter(hasT);
        const emptyCount=myProjs.length-withTasks.length;   // 업무 없는(미시작) 프로젝트 — 목록선 숨기고 건수만
        const sortedProjs=[...withTasks].sort((a,b)=>projRank(a)-projRank(b)||(b.progress||0)-(a.progress||0));
        return(
          <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",border:"1px solid #F2F4F6",marginBottom:14}}>
            <div style={{marginBottom:10}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📁 내 프로젝트 현황 ({sortedProjs.length})</h3>
              <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>대기/내 차례 · 상태별 업무 현황 (탭하면 프로젝트로 이동)</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortedProjs.map(pr=>{
                const ts=D.tasks.filter(t=>t.projectId===pr.id&&!t.isFixed);
                const c={todo:0,inprogress:0,done:0,hold:0}; ts.forEach(t=>{if(c[t.status]!=null)c[t.status]++;});
                const mineTurn=readyProjIds.has(pr.id);
                const allDone=ts.length>0&&ts.every(t=>t.status==="done");
                const myInprog=ts.some(t=>t.assigneeId===cu.id&&t.status==="inprogress");
                const myTodo=ts.some(t=>t.assigneeId===cu.id&&t.status==="todo");
                const bd=mineTurn?{l:"내 차례",c:"#EA580C",bg:"#FFF7ED"}:allDone?{l:"완료",c:"#00A862",bg:"#E8FAF1"}:myInprog?{l:"진행 중",c:"#3182F6",bg:"#EBF3FF"}:myTodo?{l:"할 일",c:"#6B7280",bg:"#F2F4F6"}:{l:"대기",c:"#9CA3AF",bg:"#F2F4F6"};
                return(
                  <div key={pr.id} onClick={()=>setProjModal(pr)} style={{padding:"11px 12px",borderRadius:12,border:`1px solid ${mineTurn?"#FED7AA":"#EEF1F4"}`,backgroundColor:mineTurn?"#FFFBF5":"#F9FAFB",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pr.title}</span>
                      <span style={{flexShrink:0,fontSize:10,fontWeight:800,color:bd.c,background:bd.bg,borderRadius:6,padding:"2px 8px"}}>{bd.l}</span>
                      <span style={{flexShrink:0,fontSize:12,fontWeight:900,color:(pr.progress||0)>=70?"#00C073":"#3182F6"}}>{pr.progress||0}%</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,flexWrap:"wrap"}}>
                      {CC.map(([k,l,col])=>(<span key={k} style={{fontSize:10.5,fontWeight:700,color:c[k]>0?col:"#C4C9D0"}}>{l} {c[k]}</span>))}
                    </div>
                    <PBar value={pr.progress||0} color={(pr.progress||0)>=70?"#00C073":"#3182F6"} h={5}/>
                  </div>
                );
              })}
            </div>
            {emptyCount>0&&<p style={{margin:"9px 2px 0",fontSize:10.5,color:"#9CA3AF"}}>+ {emptyCount}개 미시작 (업무 없음 — 프로세스로 단계를 만들어 시작하세요)</p>}
            {sortedProjs.length===0&&<p style={{margin:0,padding:"8px 0 2px",fontSize:11.5,color:"#B0B8C1",textAlign:"center"}}>진행 중인 프로젝트가 없어요</p>}
          </div>
        );
      })()}
      {slotSheet&&(
        <Sheet open={true} onClose={()=>setSlotSheet(null)} title={`${slotSheet.day}요일에 업무 배치`} h="70vh">
          <div style={{marginTop:12}}>
            {slotSheet.current&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",backgroundColor:"#F9FAFB",borderRadius:12,marginBottom:14}}>
                <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>현재: {slotSheet.current.title}</span>
                <button onClick={()=>{up("tasks",slotSheet.current.id,{weekDay:null,weekSlot:null});setSlotSheet(null);}} style={{padding:"5px 12px",borderRadius:8,border:"none",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:12,fontWeight:700,cursor:"pointer"}}>비우기</button>
              </div>
            )}
            <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:"#6B7280"}}>배치할 업무 선택</p>
            {myT.filter(t=>!t.isFixed&&!(t.weekDay===slotSheet.day&&t.weekSlot===slotSheet.slot)&&t.status!=="done").map(t=>(
              <button key={t.id} onClick={()=>{up("tasks",t.id,{weekDay:slotSheet.day,workDate:dateOfDay(slotSheet.day),weekSlot:slotSheet.slot});setSlotSheet(null);}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:7,borderRadius:12,border:"1px solid #E5E8EB",backgroundColor:"#FFFFFF",textAlign:"left",cursor:"pointer",width:"100%"}}>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#111827"}}>{t.title}</p>
                  {D.projects.find(p=>p.id===t.projectId)&&<p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>📁 {D.projects.find(p=>p.id===t.projectId).title}</p>}
                </div>
                <span style={{color:"#F97316",fontSize:16,flexShrink:0}}>→</span>
              </button>
            ))}
            {(()=>{
              const evs=(D.events||[]).filter(ev=>(ev.attendeeIds||[]).includes(cu.id)&&!(D.tasks||[]).some(t=>t.eventId===ev.id)&&(!ev.date||ev.date>=todayKey)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
              if(!evs.length) return null;
              return(<>
                <p style={{margin:"16px 0 8px",fontSize:12,fontWeight:700,color:"#6B7280"}}>📅 캘린더 일정 (내 미팅·외근)</p>
                {evs.map(ev=>{const et=EVENT_TYPES[ev.type]||EVENT_TYPES.internal;return(
                  <button key={ev.id} onClick={()=>{placeEvent(ev,slotSheet.day,slotSheet.slot);setSlotSheet(null);}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:7,borderRadius:12,border:"1px solid "+et.bg,backgroundColor:"#FFFFFF",textAlign:"left",cursor:"pointer",width:"100%"}}>
                    <span style={{flexShrink:0,fontSize:10,fontWeight:800,color:et.color,background:et.bg,borderRadius:6,padding:"3px 7px"}}>{et.label}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</p>
                      <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{ev.date}{ev.place?` · ${ev.place}`:""}</p>
                    </div>
                    <span style={{color:"#F97316",fontSize:16,flexShrink:0}}>→</span>
                  </button>
                );})}
              </>);
            })()}
          </div>
        </Sheet>
      )}
      <EditTaskSheet open={!!editTask} onClose={()=>setEditTask(null)} task={editTask} D={D} add={add} up={up} onSave={f=>up("tasks",editTask.id,{title:f.title,status:f.status,parentId:f.parentId||null,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,assigneeId:(f.forAll?"":((f.assigneeIds||[])[0]||"")),assigneeIds:f.assigneeIds||[],forAll:!!f.forAll,attachments:f.attachments,weekDay:f.weekDay||null,weekSlot:f.weekSlot??null,workDate:f.workDate||null,fixedTime:f.fixedTime||null,...(f.statusLog?{statusLog:f.statusLog,doneAt:f.doneAt,doneBy:f.doneBy,doneByName:f.doneByName}:{})})}/>
      <Confirm open={!!confirmTaskId} title="업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmTaskId)?.title}" 업무를 삭제할까요?\n휴지통으로 이동하며 언제든 복구할 수 있어요.`} onOk={()=>{rm("tasks",confirmTaskId);setConfirmTaskId(null);}} onCancel={()=>setConfirmTaskId(null)}/>
      {projModal&&(()=>{
        const pm=D.projects.find(p=>p.id===projModal.id)||projModal;
        const pts=D.tasks.filter(t=>t.projectId===pm.id&&!t.isFixed);
        const cc={todo:0,inprogress:0,done:0,hold:0}; pts.forEach(t=>{if(cc[t.status]!=null)cc[t.status]++;});
        const mk=D.mainKPIs.find(m=>m.id===pm.mainKPIId); const sk=D.subKPIs.find(s=>s.id===pm.subKPIId);
        const asg=D.users.find(u=>u.id===pm.assigneeId);
        const pColor=pm.priority==="high"?"#F04452":pm.priority==="mid"?"#FF9500":"#9CA3AF";
        const STC=[["todo","미완료","#EA580C"],["inprogress","진행중","#3182F6"],["done","완료","#00A862"],["hold","보류","#FF9500"]];
        const prog=pm.progress||0;
        return(
        <Sheet open={true} onClose={()=>setProjModal(null)} title="프로젝트 상세 · 수정" h="92vh">
          <div style={{marginTop:6}}>
            <input key={pm.id+"t"} defaultValue={pm.title} onBlur={e=>e.target.value.trim()&&up("projects",pm.id,{title:e.target.value.trim()})} style={{width:"100%",padding:"11px 13px",borderRadius:11,fontSize:15,fontWeight:800,color:"#0F1F5C",border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:10}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {sk&&<Badge color="#8B5CF6" bg="#F3EFFE">{mk?.krKey?mk.krKey+" · ":""}{sk.channelCode}</Badge>}
              {pm.goalType&&GOAL_TYPE[pm.goalType]&&<Badge color={GOAL_TYPE[pm.goalType].c} bg={GOAL_TYPE[pm.goalType].bg}>{GOAL_TYPE[pm.goalType].l}</Badge>}
              {pm.dealerType&&DT[pm.dealerType]&&<Badge color={DT[pm.dealerType].color} bg={DT[pm.dealerType].color+"18"}>🏷 {pm.dealerType}</Badge>}
              {pm.group&&<span style={{fontSize:11,color:"#9CA3AF"}}>· {pm.group}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563"}}>담당</span>
              <Ava name={asg?.name} color={asg?.color} size={24}/><span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{asg?.name||"미배정"}</span>
              {(pm.collaboratorIds||[]).map(cid=>{const u=D.users.find(x=>x.id===cid);return u?<Ava key={cid} name={u.name} color={u.color} size={20}/>:null;})}
            </div>
            {/* 진행률 */}
            <div style={{padding:"11px 13px",borderRadius:12,background:"#F9FAFB",border:"1px solid #F2F4F6",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <span style={{fontSize:12,fontWeight:800,color:"#4B5563"}}>선행지표</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {pm.progressManual?(<>
                    <button onClick={()=>up("projects",pm.id,{progress:Math.max(0,prog-10),progressManual:true})} style={{width:26,height:26,borderRadius:8,border:"1px solid #E5E8EB",background:"#fff",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>−</button>
                    <span style={{fontSize:14,fontWeight:900,color:"#3182F6",minWidth:42,textAlign:"center"}}>{prog}%</span>
                    <button onClick={()=>up("projects",pm.id,{progress:Math.min(100,prog+10),progressManual:true})} style={{width:26,height:26,borderRadius:8,border:"1px solid #E5E8EB",background:"#fff",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>＋</button>
                    <button onClick={()=>{const auto=pts.length?Math.round(pts.filter(t=>t.status==="done").length/pts.length*100):prog;up("projects",pm.id,{progressManual:false,progress:auto});}} style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#8B5CF6",cursor:"pointer",fontFamily:"inherit"}}>🔄 자동</button>
                  </>):(<>
                    <span style={{fontSize:14,fontWeight:900,color:prog>=70?"#00C073":"#3182F6"}}>{prog}%</span>
                    <span style={{fontSize:10,fontWeight:700,color:"#00C073",background:"#E8FAF1",padding:"3px 7px",borderRadius:7}}>자동 {pts.filter(t=>t.status==="done").length}/{pts.length}</span>
                    <button onClick={()=>up("projects",pm.id,{progressManual:true})} style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>✎ 수동</button>
                  </>)}
                </div>
              </div>
              <PBar value={prog} color={prog>=70?"#00C073":"#3182F6"} h={6}/>
              <div style={{display:"flex",gap:9,marginTop:9,flexWrap:"wrap"}}>{STC.map(([k,l,col])=><span key={k} style={{fontSize:10.5,fontWeight:700,color:cc[k]>0?col:"#C4C9D0"}}>{l} {cc[k]}</span>)}</div>
            </div>
            {/* 우선순위 */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
              <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563",flexShrink:0}}>우선순위</span>
              {[["high","🔴 높음","#F04452"],["mid","🟡 중간","#FF9500"],["low","🟢 낮음","#9CA3AF"]].map(([k,l,c])=>{const on=(pm.priority||"mid")===k;return(<button key={k} onClick={()=>up("projects",pm.id,{priority:k})} style={{padding:"6px 10px",borderRadius:9,border:`1.5px solid ${on?c:"#E5E8EB"}`,background:on?c+"18":"#fff",color:on?c:"#9CA3AF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
            </div>
            {/* 거래처유형 */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563",flexShrink:0}}>🏷 거래처유형</span>
              <select value={pm.dealerType||""} onChange={e=>up("projects",pm.id,{dealerType:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:9,fontSize:12,fontWeight:700,border:"1.5px solid #E5E8EB",outline:"none",background:"#fff",color:pm.dealerType?(DT[pm.dealerType]?.color||"#111827"):"#9CA3AF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label}</option>)}</select>
            </div>
            {/* 업무 목록 */}
            <p style={{margin:"0 0 7px",fontSize:12,fontWeight:800,color:"#6B7280"}}>업무 {pts.length} <span style={{fontWeight:600,color:"#9CA3AF"}}>(탭하면 수정)</span></p>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {pts.length===0?<p style={{margin:0,padding:"10px 0",textAlign:"center",fontSize:11.5,color:"#B0B8C1"}}>업무가 없어요 · 아래 프로세스로 만들 수 있어요</p>:pts.map(t=>{const st=STATUS_MAP[t.status];const tu=D.users.find(u=>u.id===t.assigneeId);return(
                <div key={t.id} onClick={()=>{setProjModal(null);setEditTask(t);}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:10,background:"#F9FAFB",border:"1px solid #EEF1F4",cursor:"pointer"}}>
                  <span style={{flexShrink:0,fontSize:9.5,fontWeight:800,color:st.color,background:st.bg,borderRadius:5,padding:"2px 6px"}}>{st.label}</span>
                  <span style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:700,color:t.status==="done"?"#9CA3AF":"#1F2937",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                  {tu&&<Ava name={tu.name} color={tu.color} size={18}/>}
                </div>);})}
            </div>
            <button onClick={()=>{setProcessProj(pm);setProjModal(null);}} style={{width:"100%",padding:"11px 0",borderRadius:11,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>🧩 프로세스 편집 (단계·담당자·인계)</button>
            <button onClick={()=>{setProjModal(null);nav("projects");}} style={{width:"100%",padding:"10px 0",borderRadius:11,border:"1px solid #E5E8EB",background:"#fff",color:"#6B7280",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📋 프로젝트 탭에서 전체 관리</button>
          </div>
        </Sheet>
        );
      })()}
      {processProj&&<ProjectProcessEditor D={D} proj={processProj} cu={cu} add={add} up={up} rm={rm} onClose={()=>setProcessProj(null)}/>}
    </div>
  );
}
function KPIPage({D,lead,up,cu,add,rm,restore,restoreLocal,pushExternalBackup}){
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
    const parentIds=new Set((D.tasks||[]).filter(t=>t.parentId).map(t=>t.parentId));   // 상위(단계)는 그릇이라 제외
    const m={}; D.users.forEach(u=>m[u.id]={uid:u.id,user:u,effort:0,indirect:0});
    (D.tasks||[]).forEach(t=>{ if(t.isFixed||!projIds.has(t.projectId)||parentIds.has(t.id))return;   // 말단 업무만
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
                  <h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>🎯 활동지표 (전사 합산)</h3>
                  <span style={{fontSize:10.5,color:"#9CA3AF"}}>{rows.length}개 지표 · {rows.reduce((s,r)=>s+r.cnt,0)}개 프로젝트</span>
                </div>
                <p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>프로젝트별 활동지표를 이름으로 합산 — 운영·활동 성과(매출 아님)</p>
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
                    {(()=>{
                      const mkProjs=D.projects.filter(p=>p.mainKPIId===mk.id);
                      if(!mkProjs.length) return null;
                      const mkProjIds=new Set(mkProjs.map(p=>p.id));
                      const parentIds=new Set((D.tasks||[]).filter(t=>t.parentId).map(t=>t.parentId));   // 상위(단계) 그릇 제외 — 말단 업무만
                      const agg={}; D.users.forEach(u=>{agg[u.id]={u,effort:0,done:0};});
                      (D.tasks||[]).forEach(t=>{ if(t.isFixed||!mkProjIds.has(t.projectId)||parentIds.has(t.id))return; if(agg[t.assigneeId])agg[t.assigneeId].effort++; if(t.status==="done"){const d=matchUid(D,t.doneBy,t.doneByName)||t.assigneeId; if(agg[d])agg[d].done++;} });
                      const rows=Object.values(agg).filter(x=>x.effort>0||x.done>0);
                      const totE=rows.reduce((a,x)=>a+x.effort,0), totD=rows.reduce((a,x)=>a+x.done,0);
                      const totalRev=mkProjs.reduce((s,p)=>s+numF(p.resultValue),0);
                      const Mini=({title,color,bg,fld,tot})=>(
                        <div style={{flex:1,minWidth:0,background:bg,borderRadius:10,padding:"9px 11px"}}>
                          <p style={{margin:"0 0 7px",fontSize:11,fontWeight:800,color}}>{title}</p>
                          {rows.length===0?<p style={{margin:0,fontSize:11,color:"#C4C9D0"}}>기록 없음</p>:[...rows].sort((a,b)=>b[fld]-a[fld]).map(x=>{const v=x[fld];const pp=tot>0?Math.round(v/tot*100):0;return(
                            <div key={x.u.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                              <Ava name={x.u.name} color={x.u.color} size={18}/>
                              <span style={{fontSize:11,fontWeight:700,color:"#374151",width:34,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.u.name}</span>
                              <div style={{flex:1,height:6,borderRadius:6,background:"#fff",overflow:"hidden"}}><div style={{width:pp+"%",height:"100%",background:color,borderRadius:6}}/></div>
                              <span style={{fontSize:11,fontWeight:800,color,width:28,textAlign:"right",flexShrink:0}}>{v}</span>
                            </div>
                          );})}
                        </div>
                      );
                      return(
                        <div style={{marginBottom:12,padding:"12px 13px",borderRadius:12,border:`1.5px solid ${col}33`,background:col+"0D"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:8,flexWrap:"wrap"}}>
                            <span style={{fontSize:12.5,fontWeight:900,color:"#0F1F5C"}}>📊 {mk.krKey} 합산 — 담당자 행동·완료</span>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                              <span style={{fontSize:10.5,fontWeight:800,color:"#2563EB",background:"#EBF3FF",borderRadius:7,padding:"2px 8px"}}>선행지표 {mkProjs.length}개</span>
                              <span style={{fontSize:10.5,fontWeight:800,color:"#3182F6",background:"#EBF3FF",borderRadius:7,padding:"2px 8px"}}>행동 {totE}</span>
                              <span style={{fontSize:10.5,fontWeight:800,color:"#00A862",background:"#E8FAF1",borderRadius:7,padding:"2px 8px"}}>완료 {totD}</span>
                              {mk.unit==="원"&&totalRev>0&&<span style={{fontSize:10.5,fontWeight:800,color:"#EA580C",background:"#FFF1E7",borderRadius:7,padding:"2px 8px"}}>💰{fmt(totalRev,"원")}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <Mini title="⚡ 행동 — 업무 수" color="#3182F6" bg="#EBF3FF" fld="effort" tot={totE}/>
                            <Mini title="✅ 완료 — 완료 수" color="#00C073" bg="#E8FAF1" fld="done" tot={totD}/>
                          </div>
                          <p style={{margin:"8px 2px 0",fontSize:10,color:"#9CA3AF",lineHeight:1.5}}>이 매출 KPI에 연결된 모든 프로젝트(선행지표)의 말단 업무 기준 · 행동=맡은 업무 수, 완료=실제 완료 수</p>
                        </div>
                      );
                    })()}
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
                            {!((sk.mainKPIId==="mk2"&&sk.unit==="원")||(sk.unit==="%"&&projs.length>0)||sk.launchCount)&&<button onClick={e=>{e.stopPropagation();openVal("subKPIs",sk);}} style={{width:"100%",marginTop:8,padding:"8px 10px",borderRadius:8,border:"1.5px solid #F97316",background:"#FFF7ED",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📊 이번 주 실적 입력</button>}
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
          <ExportPanel D={D} up={up} restore={restore} restoreLocal={restoreLocal} pushExternalBackup={pushExternalBackup}/>
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
// 프로젝트 프로세스 편집기 — 업무를 계층 트리로 편집(Enter/Space/◂▸), 저장 시 실제 task에 반영(parentId·seq)
function ProjectProcessEditor({D,proj,cu,add,up,rm,onClose}){
  const team=isTeamProj(D,proj);
  const MEM=[{id:"",name:"미배정",color:"#9CA3AF"},...(D.users||[])];
  const Mof=id=>MEM.find(m=>m.id===id)||MEM[0];
  const load=()=>{
    const ts=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
    const byP={}; ts.forEach(t=>{const k=t.parentId||"__root";(byP[k]=byP[k]||[]).push(t);});
    Object.values(byP).forEach(a=>a.sort((x,y)=>(x.seq||0)-(y.seq||0)));
    const out=[]; const walk=(pid,depth)=>{(byP[pid]||[]).forEach(t=>{out.push({id:t.id,tid:t.id,text:t.title,depth,who:t.assigneeId||"",done:t.status==="done"});walk(t.id,depth+1);});};
    walk("__root",0);
    if(out.length===0) out.push({id:"new0",text:"",depth:0,who:proj.assigneeId||"",done:false});
    return out;
  };
  const [items,setItems]=useState(load);
  const [selId,setSelId]=useState(null);
  const [view,setView]=useState("tree");   // tree(편집) | map(마인드맵 보기, 선택사항)
  const focusRef=useRef(null),uidRef=useRef(0),outRef=useRef(null);
  useEffect(()=>{ if(!focusRef.current)return; const {id,caret}=focusRef.current; focusRef.current=null; const inp=document.querySelector(`input[data-id="${id}"]`); if(inp){inp.focus();const c=caret==null?inp.value.length:caret;try{inp.setSelectionRange(c,c);}catch(_){}}});   // 트리·마인드맵 양쪽 입력 포커스
  const newId=()=>"new"+(++uidRef.current);
  const patch=(id,p)=>setItems(it=>it.map(x=>x.id===id?{...x,...p}:x));
  const toggleDone=id=>setItems(it=>it.map(x=>x.id===id?{...x,done:!x.done}:x));
  const indent=(i,dir)=>setItems(a0=>{const a=[...a0];const it=a[i];if(dir<0){if(it.depth>0)a[i]={...it,depth:it.depth-1};}else{const prev=a[i-1];if(prev&&it.depth<=prev.depth)a[i]={...it,depth:it.depth+1};}return a;});
  // 형제 간 위/아래 이동(하위 트리 통째로). 같은 부모·같은 단계 형제와 자리 바꿈.
  const subEnd=(a,i)=>{let k=i+1;while(k<a.length&&a[k].depth>a[i].depth)k++;return k;};
  const moveItem=(i,dir)=>setItems(a0=>{
    const a=[...a0]; const d=a[i].depth; const end=subEnd(a,i); const block=a.slice(i,end);
    if(dir<0){ let j=i-1; while(j>=0&&a[j].depth>d) j--; if(j<0||a[j].depth<d) return a0; a.splice(i,block.length); a.splice(j,0,...block); }
    else{ if(end>=a.length||a[end].depth<d) return a0; const nEnd=subEnd(a,end); const nLen=nEnd-end; a.splice(i,block.length); a.splice(i+nLen,0,...block); }
    return a;
  });
  const hasSib=(i,dir)=>{const d=items[i].depth; if(dir<0){let j=i-1;while(j>=0&&items[j].depth>d)j--;return j>=0&&items[j].depth===d;} const end=subEnd(items,i);return end<items.length&&items[end].depth===d;};
  // 마인드맵/트리에서 탭으로 추가 — 하위(child)·다음(sibling)·첫 단계(root)
  const addChild=(i)=>{const nid=newId();setItems(a=>{const arr=[...a];const d=(arr[i]?.depth??0)+1;arr.splice(i+1,0,{id:nid,text:"",depth:d,who:arr[i]?.who||"",done:false});return arr;});setSelId(nid);focusRef.current={id:nid};};
  const addSibling=(i)=>{const nid=newId();setItems(a=>{const arr=[...a];const d=arr[i]?.depth??0;arr.splice(i+1,0,{id:nid,text:"",depth:d,who:arr[i]?.who||"",done:false});return arr;});setSelId(nid);focusRef.current={id:nid};};
  const addRoot=()=>{const nid=newId();setItems(a=>[...a,{id:nid,text:"",depth:0,who:proj.assigneeId||"",done:false}]);setSelId(nid);focusRef.current={id:nid};};
  const onKey=(e,i)=>{const it=items[i];
    if(e.key==="Enter"){e.preventDefault();const nid=newId();setItems(a=>{const arr=[...a];arr.splice(i+1,0,{id:nid,text:"",depth:it.depth,who:it.who,done:false});return arr;});setSelId(nid);focusRef.current={id:nid};}
    else if(e.key==="Tab"){e.preventDefault();indent(i,e.shiftKey?-1:1);focusRef.current={id:it.id,caret:e.target.selectionStart};}
    else if(e.key===" "&&e.target.value===""){e.preventDefault();indent(i,1);focusRef.current={id:it.id};}
    else if(e.key==="Backspace"&&e.target.value===""&&items.length>1){e.preventDefault();const p=items[i-1]||items[0];setItems(a=>a.filter((_,k)=>k!==i));setSelId(p.id);focusRef.current={id:p.id};}
  };
  const isP=(arr,i)=>i+1<arr.length&&arr[i+1].depth>arr[i].depth;   // 하위가 있으면 상위(단계)
  const computeDD=(arr)=>{const dd=new Array(arr.length);const lastIdx=(i)=>{let k=i+1;while(k<arr.length&&arr[k].depth>arr[i].depth)k++;return k-1;};const kidsOf=(i)=>{const o=[];const e=lastIdx(i);for(let k=i+1;k<=e;k++)if(arr[k].depth===arr[i].depth+1)o.push(k);return o;};for(let i=arr.length-1;i>=0;i--){if(isP(arr,i)){const ks=kidsOf(i);dd[i]=ks.length>0&&ks.every(k=>dd[k]);}else dd[i]=!!arr[i].done;}return {dd,kidsOf};};
  const {dd,kidsOf}=computeDD(items);   // 상위는 하위 전부 완료 시 자동 완료(롤업)
  const leafIdx=items.map((_,i)=>i).filter(i=>!isP(items,i)&&items[i].text.trim());   // 말단 업무만
  const doneN=leafIdx.filter(i=>items[i].done).length, totN=leafIdx.length, prog=totN?Math.round(doneN/totN*100):0;
  const save=()=>{
    const existing=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
    const {dd:dd2}=computeDD(items);
    const present=new Set(), idMap={};
    items.forEach((it,i)=>{ if(!it.text.trim()&&!it.tid) return;
      let parentId=null; for(let k=i-1;k>=0;k--){ if(items[k].depth===it.depth-1){parentId=idMap[k]||null;break;} if(items[k].depth<it.depth-1)break; }
      const dn=isP(items,i)?dd2[i]:it.done;   // 상위는 하위 롤업으로 완료 판정
      if(it.tid){ const t=existing.find(x=>x.id===it.tid); idMap[i]=it.tid; present.add(it.tid);
        const p={title:it.text.trim(),assigneeId:it.who,parentId,seq:i};
        if(dn&&t&&t.status!=="done")Object.assign(p,statusPatch(D,t,"done")); else if(!dn&&t&&t.status==="done")Object.assign(p,statusPatch(D,t,"todo"));   // 완료 전이 시 doneAt·이력 함께 기록(데이터 누락 방지)
        up("tasks",it.tid,p);
      } else { const nid="t"+Date.now()+"_"+i; idMap[i]=nid; present.add(nid); const _u=_curUser(D);
        add("tasks",{id:nid,title:it.text.trim(),projectId:proj.id,parentId,assigneeId:it.who,type:"general",status:dn?"done":"todo",weekDay:null,weekSlot:null,isFixed:false,dueDate:"",memo:"",attachments:[],seq:i,...(dn?{doneAt:new Date().toISOString(),doneBy:_u?.id||null,doneByName:_u?.name||""}:{})});
      }
    });
    existing.forEach(t=>{ if(!present.has(t.id)) rm("tasks",t.id); });
    onClose();
  };
  const sel=items.find(x=>x.id===selId);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1500,background:"#F9FAFB",display:"flex",flexDirection:"column"}}>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",color:"#fff",padding:"13px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:14,fontWeight:900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧩 {proj.title}</p>
          <p style={{margin:"2px 0 0",fontSize:10,opacity:0.82}}>{team?"팀 협업 (담당자 지정)":"개인 체크리스트"} · Enter 같은단계 · Space/▸ 하위</p>
        </div>
        <button onClick={save} style={{background:"#F97316",border:"none",color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>저장</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px 30px",maxWidth:720,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563"}}>진행률</span>
          <div style={{flex:1,height:8,borderRadius:8,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:prog+"%",height:"100%",background:prog>=100?"#00C073":"#F97316",borderRadius:8}}/></div>
          <span style={{fontSize:13,fontWeight:900,color:prog>=100?"#00C073":"#F97316"}}>{doneN}/{totN} · {prog}%</span>
        </div>
        <div style={{display:"inline-flex",borderRadius:9,overflow:"hidden",border:"1px solid #E5E8EB",marginBottom:12}}>
          {[["tree","☰ 트리(편집)"],["map","🗺 마인드맵"]].map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)} style={{padding:"7px 13px",fontSize:11.5,fontWeight:800,border:"none",cursor:"pointer",background:view===k?"#0F1F5C":"#fff",color:view===k?"#fff":"#6B7280",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        {view==="map"?(()=>{
          const COLW=148,ROWH=46,NW=126,NH=36,PADX=12,PADY=12;
          const rows=items.map((it,i)=>({it,i})).filter(r=>r.it.text.trim()||r.it.tid||r.it.id===selId);
          const yOf={}; rows.forEach((r,ri)=>{yOf[r.i]=PADY+ri*ROWH;});
          const parentIdx=(i)=>{for(let k=i-1;k>=0;k--){if(items[k].depth===items[i].depth-1)return k;if(items[k].depth<items[i].depth-1)return -1;}return -1;};
          // 인계 상태: 형제(같은 부모·레벨) 순서로 앞이 다 끝나면 ready, 아니면 wait, 끝났으면 done
          const doneOf=(j)=>isP(items,j)?dd[j]:items[j].done;
          const flowOf=(i)=>{ if(doneOf(i)) return "done"; const par=parentIdx(i); for(let j=0;j<i;j++){ if(!(items[j].text.trim()||items[j].tid)) continue; if(items[j].depth===items[i].depth&&parentIdx(j)===par&&!doneOf(j)) return "wait"; } return "ready"; };
          const maxDepth=rows.reduce((m,r)=>Math.max(m,r.it.depth),0);
          const svgW=PADX*2+maxDepth*COLW+NW, svgH=PADY*2+Math.max(1,rows.length)*ROWH;
          return(<>
            <div style={{display:"flex",gap:12,marginBottom:8,fontSize:10,fontWeight:700,flexWrap:"wrap"}}>
              <span style={{color:"#00A862"}}>● 완료</span><span style={{color:"#EA580C"}}>▶ 진행 가능(지금)</span><span style={{color:"#9CA3AF"}}>○ 대기(앞 단계 진행 중)</span>
            </div>
            <div style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:8,overflowX:"auto"}}>
              {rows.length===0?<div style={{margin:"24px 0",textAlign:"center"}}><p style={{margin:"0 0 10px",fontSize:12,color:"#9CA3AF"}}>아직 단계가 없어요</p><button onClick={addRoot} style={{padding:"9px 16px",borderRadius:10,border:"1.5px dashed #FDBA74",background:"#FFF7ED",color:"#EA580C",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ 첫 단계 추가</button></div>:(
              <div style={{position:"relative",width:svgW,height:svgH}}>
                <svg width={svgW} height={svgH} style={{position:"absolute",top:0,left:0,pointerEvents:"none"}}>
                  {rows.map(({it,i})=>{const p=parentIdx(i);if(p<0||yOf[p]==null)return null;const px=PADX+items[p].depth*COLW+NW,py=yOf[p]+NH/2,cx=PADX+it.depth*COLW,cy=yOf[i]+NH/2;return(<path key={"e"+i} d={`M ${px} ${py} C ${px+26} ${py}, ${cx-26} ${cy}, ${cx} ${cy}`} stroke="#D7C4A8" strokeWidth={2} fill="none"/>);})}
                </svg>
                {rows.map(({it,i})=>{const m=Mof(it.who);const parent=isP(items,i);const rdone=parent?dd[i]:it.done;const x=PADX+it.depth*COLW,y=yOf[i];const onSel=it.id===selId;const fs=flowOf(i);return(
                  onSel?(
                  <div key={it.id} style={{position:"absolute",left:x,top:y,width:NW,height:NH,display:"flex",alignItems:"center",gap:5,padding:"0 7px",borderRadius:9,border:"1.5px solid #0F1F5C",background:"#fff",boxSizing:"border-box"}}>
                    {team&&<span style={{width:13,height:13,borderRadius:"50%",flexShrink:0,backgroundColor:m.color,color:"#fff",fontSize:7.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(m.name)}</span>}
                    <input data-id={it.id} value={it.text} placeholder={parent?"단계명…":"업무…"} onChange={e=>patch(it.id,{text:e.target.value})} onKeyDown={e=>onKey(e,i)} style={{flex:1,minWidth:0,border:"none",background:"none",fontSize:11,fontWeight:parent?800:600,color:"#1F2937",outline:"none",fontFamily:"inherit",padding:0}}/>
                  </div>
                  ):(
                  <button key={it.id} onClick={()=>setSelId(it.id)} style={{position:"absolute",left:x,top:y,width:NW,height:NH,display:"flex",alignItems:"center",gap:5,padding:"0 8px",borderRadius:9,border:`1.5px solid ${fs==="done"?"#BFE9CF":fs==="ready"?"#F59E42":"#E8DCC8"}`,background:fs==="done"?"#F0FBF4":fs==="ready"?"#FFF7ED":(parent?"#FFFBF5":"#fff"),opacity:fs==="wait"?0.6:1,cursor:"pointer",fontFamily:"inherit",boxSizing:"border-box",textAlign:"left"}}>
                    <span style={{width:13,height:13,borderRadius:parent?4:"50%",flexShrink:0,background:fs==="done"?"#00C073":fs==="ready"?"#F97316":"#EEF1F3",color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{fs==="done"?"✓":fs==="ready"?"▶":""}</span>
                    {team&&<span style={{width:13,height:13,borderRadius:"50%",flexShrink:0,backgroundColor:m.color,color:"#fff",fontSize:7.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(m.name)}</span>}
                    <span style={{flex:1,minWidth:0,fontSize:11,fontWeight:parent?800:600,color:rdone?"#9CA3AF":"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.text||"(빈 항목)"}</span>
                  </button>)
                );})}
              </div>)}
            </div>
            {sel&&(()=>{const si=items.findIndex(x=>x.id===selId);if(si<0)return null;return(
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",background:"#fff",borderRadius:12,border:"1px solid #F2F4F6",padding:"10px 12px"}}>
                <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563",flex:1,minWidth:50,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>선택: 「{sel.text||"새 항목"}」</span>
                <button onClick={()=>moveItem(si,-1)} disabled={!hasSib(si,-1)} title="위로" style={{padding:"7px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:hasSib(si,-1)?"#4B5563":"#D1D5DB",fontSize:12,fontWeight:800,cursor:hasSib(si,-1)?"pointer":"default",fontFamily:"inherit"}}>▲</button>
                <button onClick={()=>moveItem(si,1)} disabled={!hasSib(si,1)} title="아래로" style={{padding:"7px 10px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:hasSib(si,1)?"#4B5563":"#D1D5DB",fontSize:12,fontWeight:800,cursor:hasSib(si,1)?"pointer":"default",fontFamily:"inherit"}}>▼</button>
                <button onClick={()=>addChild(si)} style={{padding:"7px 12px",borderRadius:9,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 하위</button>
                <button onClick={()=>addSibling(si)} style={{padding:"7px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 다음</button>
                {items.length>1&&<button onClick={()=>{const pv=items[si-1]||items[0];setItems(a=>a.filter((_,k)=>k!==si));setSelId(pv&&pv.id!==selId?pv.id:null);}} title="삭제" style={{padding:"7px 10px",borderRadius:9,border:"1px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>⌫</button>}
              </div>
            );})()}
          </>);
        })():(
        <div style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"12px 10px"}} ref={outRef}>
          {items.map((it,i)=>{const m=Mof(it.who);const parent=isP(items,i);const rdone=parent?dd[i]:it.done;return(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:6,marginLeft:it.depth*20,padding:"3px 6px",borderRadius:9,backgroundColor:it.id===selId?"#FFF7ED":"transparent"}}>
              <span style={{display:"flex",flexDirection:"column",flexShrink:0}}>
                <button onClick={()=>moveItem(i,-1)} disabled={!hasSib(i,-1)} title="위로" style={{border:"none",background:"none",color:hasSib(i,-1)?"#9CA3AF":"#E5E8EB",fontSize:9,cursor:hasSib(i,-1)?"pointer":"default",padding:0,lineHeight:1,height:11}}>▲</button>
                <button onClick={()=>moveItem(i,1)} disabled={!hasSib(i,1)} title="아래로" style={{border:"none",background:"none",color:hasSib(i,1)?"#9CA3AF":"#E5E8EB",fontSize:9,cursor:hasSib(i,1)?"pointer":"default",padding:0,lineHeight:1,height:11}}>▼</button>
              </span>
              <button onClick={()=>indent(i,-1)} title="내어쓰기" style={{border:"none",background:"none",color:"#C4C9D0",fontSize:13,cursor:"pointer",padding:"2px 2px"}}>◂</button>
              <button onClick={()=>indent(i,1)} title="들여쓰기" style={{border:"none",background:"none",color:"#C4C9D0",fontSize:13,cursor:"pointer",padding:"2px 2px"}}>▸</button>
              {parent
                ? (()=>{const ks=kidsOf(i);const cdn=ks.filter(k=>dd[k]).length;return(<span title="하위 진행(자동 완료)" style={{minWidth:19,height:19,borderRadius:6,background:rdone?"#00C073":"#EEF1F3",color:rdone?"#fff":"#6B7280",fontSize:9.5,fontWeight:800,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",boxSizing:"border-box"}}>{rdone?"✓":cdn+"/"+ks.length}</span>);})()
                : <button onClick={()=>toggleDone(it.id)} style={{width:19,height:19,borderRadius:6,border:`2px solid ${it.done?"#00C073":"#D1D5DB"}`,background:it.done?"#00C073":"#fff",color:"#fff",fontSize:11,fontWeight:900,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{it.done?"✓":""}</button>}
              {team&&<button onClick={()=>setSelId(it.id)} title={m.name} style={{width:18,height:18,borderRadius:"50%",backgroundColor:m.color,color:"#fff",fontSize:9,fontWeight:800,border:"none",cursor:"pointer",flexShrink:0}}>{gname(m.name)}</button>}
              <input data-id={it.id} value={it.text} placeholder={parent?"단계명...":"업무 입력..."} onChange={e=>patch(it.id,{text:e.target.value})} onFocus={()=>setSelId(it.id)} onKeyDown={e=>onKey(e,i)} style={{flex:1,minWidth:0,border:"none",background:"none",fontSize:13.5,fontWeight:parent?800:600,color:rdone?"#9CA3AF":"#1F2937",textDecoration:rdone?"line-through":"none",outline:"none",fontFamily:"inherit",padding:"5px 2px"}}/>
            </div>
          );})}
        </div>
        )}
        {team&&sel&&(
          <div style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"12px 14px",marginTop:12}}>
            <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#4B5563"}}>「{sel.text||"업무"}」 담당자</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {MEM.map(m=>{const on=sel.who===m.id;return(<button key={m.id||"none"} onClick={()=>patch(sel.id,{who:m.id})} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:20,border:`1.5px solid ${on?m.color:"#E5E8EB"}`,background:on?m.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><span style={{width:16,height:16,borderRadius:"50%",backgroundColor:m.color,color:"#fff",fontSize:8.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(m.name)}</span><span style={{fontSize:12,fontWeight:700,color:on?m.color:"#4B5563"}}>{m.name}</span></button>);})}
            </div>
          </div>
        )}
        <p style={{margin:"12px 4px 0",fontSize:10.5,color:"#9CA3AF",lineHeight:1.6}}>※ 여기 항목이 곧 프로젝트의 실제 업무입니다. 체크=완료(진행률 자동). <b>저장</b>하면 업무목록·오늘에 반영됩니다.</p>
      </div>
    </div>
  );
}
// 프로젝트 로드맵 — 최상위 로드단계 + 로드단계별 담당/논의 + 프로세스 연결
// 프로젝트의 여정(로드단계+프로세스 트리)을 재사용용 로드맵 템플릿 트리로 추출
function buildManualTree(D,projId){
  const ts=D.tasks.filter(t=>t.projectId===projId&&!t.isFixed);
  const byParent={};
  ts.forEach(t=>{const k=t.parentId||"_root";(byParent[k]=byParent[k]||[]).push(t);});
  const walk=(key)=>(byParent[key]||[]).slice().sort((a,b)=>(a.seq||0)-(b.seq||0)).map(t=>({
    title:t.title||"",assigneeId:t.assigneeId||"",discuss:t.discuss||"",custJourney:t.custJourney||"",handoffNote:t.handoffNote||"",
    processId:t.processId||null,processName:t.processName||null,processVersion:t.processVersion||null,kids:walk(t.id)
  }));
  return walk("_root");
}
// 로드맵 템플릿 트리 → 새 프로젝트의 업무로 복제(계층·순서·예상기간·논의 보존, 상태는 todo로 초기화)
function cloneManualToProject(manual,projId,projType,add){
  let i=0;
  const walk=(nodes,parentId)=>(nodes||[]).forEach((n,idx)=>{
    const id="t"+Date.now()+"_"+(i++);
    add("tasks",{id,projectId:projId,parentId:parentId||null,seq:idx,
      title:n.title||"",status:"todo",isFixed:false,weekDay:null,weekSlot:null,
      assigneeId:projType==="team"?(n.assigneeId||""):"",
      discuss:parentId?"":(n.discuss||""),custJourney:parentId?"":(n.custJourney||""),handoffNote:parentId?"":(n.handoffNote||""),
      processId:parentId?null:(n.processId||null),processName:parentId?null:(n.processName||null),processVersion:parentId?null:(n.processVersion||null),
      memo:"",dueDate:"",attachments:[]});
    walk(n.kids,id);
  });
  walk(manual.stages,null);
}
// 로드맵 템플릿 카드 — 버전(v) 표시·이력 되돌리기 + 완료집계 지표 선택(연결 프로젝트에 소급 적용)
function ManualCard({m,D,up,rm,startFromManual}){
  const [showV,setShowV]=useState(false);
  const sc=(m.stages||[]).length;
  const cnt=(()=>{let n=0;const w=a=>(a||[]).forEach(x=>{n++;w(x.kids);});w(m.stages);return n;})();
  const mk3SKs=D.subKPIs.filter(s=>s.mainKPIId==="mk3"&&s.unit!=="원"&&s.unit!=="%"&&!s.launchCount);
  const cdone=m.countKPIId?(D.projects||[]).filter(p=>p.countKPIId===m.countKPIId&&(p.progress||0)>=100).length:0;
  const vers=m.versions||[]; const ver=m.version||1;
  const setCount=(val)=>{ up("manuals",m.id,{countKPIId:val}); (D.projects||[]).filter(p=>p.sourceManualId===m.id).forEach(p=>up("projects",p.id,{countKPIId:val})); };
  const restore=(v)=>{ if(!window.confirm(`v${v.v}로 되돌릴까요? 현재본(v${ver})은 이력으로 보관돼요.`))return; up("manuals",m.id,{stages:v.stages||[],version:ver+1,versions:[...vers,{v:ver,stages:m.stages||[],savedAt:m.updatedAt||m.createdAt||"",savedBy:m.updatedBy||m.createdBy||"",note:`v${v.v}로 되돌림`}]}); setShowV(false); };
  return(
    <div style={{background:"#fff",borderRadius:10,border:"1px solid #F2E6D5",padding:"9px 11px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name} <span style={{fontSize:9.5,fontWeight:800,color:"#A16207",background:"#FEF3C7",borderRadius:5,padding:"1px 5px"}}>v{ver}</span></p>
          <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}>{m.projType==="team"?"팀":"개인"} · 로드단계 {sc} · 업무 {cnt}{vers.length?` · 이력 ${vers.length}`:""}</p>
        </div>
        <button onClick={()=>startFromManual(m)} style={{flexShrink:0,padding:"6px 10px",borderRadius:9,border:"none",background:"#F97316",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ 새 프로젝트</button>
        <button onClick={()=>{if(window.confirm(`'${m.name}' 로드맵 템플릿을 삭제할까요? (이미 만든 프로젝트는 영향 없음)\n휴지통에서 복구할 수 있어요.`))rm("manuals",m.id);}} style={{flexShrink:0,padding:"6px 8px",borderRadius:9,border:"1px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
      </div>
      {(mk3SKs.length>0||vers.length>0)&&(
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,paddingTop:8,borderTop:"1px dashed #F2E6D5"}}>
          {mk3SKs.length>0&&(<>
            <span style={{fontSize:10.5,fontWeight:800,color:"#6B7280",flexShrink:0}}>📊 완료 시 집계</span>
            <select value={m.countKPIId||""} onChange={e=>setCount(e.target.value)} style={{flex:1,minWidth:0,padding:"6px 8px",borderRadius:8,border:"1px solid #E5E8EB",fontSize:11,fontWeight:700,color:"#374151",background:"#fff",fontFamily:"inherit",WebkitAppearance:"none"}}>
              <option value="">집계 안 함</option>
              {mk3SKs.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            {m.countKPIId&&<span style={{fontSize:10,fontWeight:800,color:"#00A862",flexShrink:0}}>완료 {cdone}</span>}
          </>)}
          {vers.length>0&&<button onClick={()=>setShowV(s=>!s)} style={{flexShrink:0,padding:"5px 8px",borderRadius:8,border:"1px solid #E5E8EB",background:showV?"#EEF2FF":"#fff",color:"#4B5563",fontSize:10.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📜 이력</button>}
        </div>
      )}
      {showV&&vers.length>0&&(
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
          {vers.slice().reverse().map(v=>(
            <div key={v.v} style={{display:"flex",alignItems:"center",gap:8,background:"#F9FAFB",borderRadius:8,padding:"6px 9px"}}>
              <span style={{fontSize:10.5,fontWeight:800,color:"#6B7280",flexShrink:0}}>v{v.v}</span>
              <span style={{flex:1,minWidth:0,fontSize:10,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.note?`✏️ ${v.note}`:`로드단계 ${(v.stages||[]).length} · ${(v.savedAt||"").slice(0,10)||"날짜없음"}`}</span>
              <button onClick={()=>restore(v)} style={{flexShrink:0,padding:"4px 8px",borderRadius:7,border:"1px solid #DBE3FF",background:"#fff",color:"#3182F6",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>되돌리기</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ProjectRoadmap({D,proj,up,add,rm,onClose,onOpenProcess}){
  const team=isTeamProj(D,proj);
  const srcMan=proj.sourceManualId&&(D.manuals||[]).find(m=>m.id===proj.sourceManualId);   // 역링크: 살아있는 로드맵 템플릿(있으면 갱신 가능)
  const srcGone=!srcMan&&proj.sourceManualName;   // 로드맵 템플릿이 삭제됐어도 박제된 이름으로 기록 유지
  const MEM=[{id:"",name:"미배정",color:"#9CA3AF"},...(D.users||[])];
  const Mof=id=>MEM.find(m=>m.id===id)||MEM[0];
  const stages=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed&&!t.parentId).sort((a,b)=>(a.seq||0)-(b.seq||0));
  const [selId,setSelId]=useState(stages[0]?.id||null);
  const [canvasOpen,setCanvasOpen]=useState(true);   // 통합 캔버스(로드단계+프로세스 가지치기) 펼침
  const [canvasEdit,setCanvasEdit]=useState(null);   // 캔버스에서 ✎ 누른 노드 편집
  const [expanded,setExpanded]=useState({});   // 캔버스 펼침: {taskId:true} (로드단계 탭하면 하위 task 트리 펼침)
  const [dateOpen,setDateOpen]=useState(null);   // 인라인 날짜 편집 중인 업무 id
  const [moreOpen,setMoreOpen]=useState(null);   // 행 컨트롤(⋯) 펼친 업무 id
  const todayISO=new Date().toISOString().slice(0,10);
  const fmtD=(d)=>d?d.slice(5).replace("-","/"):"";                 // "2026-06-18" → "06/18"
  const overdue=(t)=>!!(t.dueDate&&t.dueDate<todayISO&&t.status!=="done");   // 마감 지난 미완 = 지연
  const sel=stages.find(s=>s.id===selId);
  const cpct=sid=>{const ks=D.tasks.filter(t=>t.parentId===sid&&!t.isFixed);if(ks.length)return Math.round(ks.filter(t=>t.status==="done").length/ks.length*100);return (stages.find(s=>s.id===sid)?.status==="done")?100:0;};
  const kidsOf=(pid)=>D.tasks.filter(t=>t.parentId===pid&&!t.isFixed).sort((a,b)=>(a.seq||0)-(b.seq||0));
  const addStage=()=>{add("tasks",{id:"t"+Date.now(),projectId:proj.id,parentId:null,seq:stages.length,title:"새 로드단계",status:"todo",isFixed:false,assigneeId:"",discuss:"",custJourney:"",painPoint:"",satisfaction:null,handoffNote:"",memo:"",startDate:"",dueDate:"",attachments:[]});};
  // 로드단계에 프로세스 모듈 장착 — 모듈 단계를 그 로드단계의 업무로 인스턴스화(인계 순서) + 로드단계에 모듈·버전 기록
  const tpls=D.launchTemplates||[];
  const attachProcessToStage=(stageId,tpl)=>{
    if(!tpl) return;
    const nodes=tpl.nodes||[], edges=tpl.edges||[];
    const indeg={};nodes.forEach(n=>indeg[n.id]=0);edges.forEach(e=>{if(indeg[e.to]!=null)indeg[e.to]++;});
    const adj={};edges.forEach(e=>{(adj[e.from]=adj[e.from]||[]).push(e.to);});
    const q=nodes.filter(n=>indeg[n.id]===0).map(n=>n.id),seen=new Set(),order=[];
    while(q.length){const id=q.shift();if(seen.has(id))continue;seen.add(id);order.push(id);(adj[id]||[]).forEach(to=>{indeg[to]--;if(indeg[to]<=0)q.push(to);});}
    nodes.forEach(n=>{if(!seen.has(n.id))order.push(n.id);});   // 순환·고립 노드는 뒤에
    const base=kidsOf(stageId).length, ts=Date.now();
    order.forEach((nid2,i)=>{const n=nodes.find(x=>x.id===nid2);if(!n)return;add("tasks",{id:"t"+ts+"_"+i,projectId:proj.id,parentId:stageId,seq:base+i,title:n.roleLabel?`[${n.roleLabel}] ${n.title}`:n.title,status:"todo",isFixed:false,assigneeId:team?(n.assigneeId||""):"",memo:"",dueDate:"",attachments:[]});});
    up("tasks",stageId,{processId:tpl.id,processName:tpl.name,processVersion:tpl.version||1});
  };
  // 계층형 안에서 바로 수정 — 업무 추가·상태·담당·정렬·삭제
  const nid=()=>"t"+Date.now()+Math.random().toString(36).slice(2,5);
  const addKid=(parentId)=>add("tasks",{id:nid(),projectId:proj.id,parentId,seq:kidsOf(parentId).length,title:"새 업무",status:"todo",isFixed:false,assigneeId:"",memo:"",startDate:"",dueDate:"",attachments:[]});
  const STATUS_ORDER=["todo","inprogress","done"];
  const cycleStatus=(t)=>{const nx=STATUS_ORDER[(STATUS_ORDER.indexOf(t.status)+1)%STATUS_ORDER.length];up("tasks",t.id,statusPatch(D,t,nx));};
  const cycleAssignee=(t)=>{const ids=MEM.map(m=>m.id);up("tasks",t.id,{assigneeId:ids[(ids.indexOf(t.assigneeId||"")+1)%ids.length]});};
  const moveSib=(t,dir)=>{const sibs=t.parentId?kidsOf(t.parentId):stages;const i=sibs.findIndex(x=>x.id===t.id);const j=i+dir;if(j<0||j>=sibs.length)return;const arr=sibs.slice();[arr[i],arr[j]]=[arr[j],arr[i]];arr.forEach((x,k)=>up("tasks",x.id,{seq:k}));};
  const delTask=(t)=>{const has=kidsOf(t.id).length;if(!window.confirm(`'${t.title||"업무"}'${has?` 및 하위 ${has}개`:""}를 삭제할까요?`))return;const ids=[];const g=(id)=>{ids.push(id);kidsOf(id).forEach(c=>g(c.id));};g(t.id);ids.forEach(id=>rm&&rm("tasks",id,true));};
  const arrowBtn={background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#9CA3AF",padding:"0 2px",lineHeight:1,flexShrink:0,fontFamily:"inherit"};
  const renderTask=(t,depth)=>{
    const ks=kidsOf(t.id);const st=STATUS_MAP[t.status]||STATUS_MAP.todo;const a=Mof(t.assigneeId);
    const sibs=kidsOf(t.parentId);const i=sibs.findIndex(x=>x.id===t.id);
    const hasDate=t.startDate||t.dueDate;const dOpen=dateOpen===t.id;const od=overdue(t);const mOpen=moreOpen===t.id;
    return(
      <div key={t.id} style={{marginLeft:depth*11}}>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0"}}>
          <button onClick={()=>cycleStatus(t)} title={st.label} style={{width:18,height:18,borderRadius:5,border:`2px solid ${st.color}`,background:t.status==="done"?st.color:"#fff",color:"#fff",fontSize:10,fontWeight:900,cursor:"pointer",flexShrink:0,padding:0,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{t.status==="done"?"✓":t.status==="inprogress"?"·":""}</button>
          <input key={t.id+"ti"} defaultValue={t.title||""} onBlur={e=>up("tasks",t.id,{title:e.target.value})} placeholder="업무명" style={{flex:1,minWidth:0,border:"none",fontSize:12,fontWeight:600,color:t.status==="done"?"#9CA3AF":"#1F2937",textDecoration:t.status==="done"?"line-through":"none",outline:"none",fontFamily:"inherit",background:"transparent",padding:"4px 0"}}/>
          {hasDate&&<span style={{flexShrink:0,fontSize:8.5,fontWeight:800,color:od?"#F04452":"#0891B2"}}>📅{fmtD(t.startDate)||"?"}~{fmtD(t.dueDate)||"?"}</span>}
          {team&&<button onClick={()=>cycleAssignee(t)} title="담당자 변경" style={{flexShrink:0,width:18,height:18,borderRadius:"50%",background:t.assigneeId?a.color:"#E5E8EB",color:"#fff",fontSize:8,fontWeight:800,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{t.assigneeId?gname(a.name):"+"}</button>}
          <button onClick={()=>setMoreOpen(mOpen?null:t.id)} title="편집" style={{...arrowBtn,fontSize:14,color:mOpen?"#0F1F5C":"#C4C9D0",width:24,height:24}}>⋯</button>
        </div>
        {mOpen&&(
          <div style={{display:"flex",alignItems:"center",gap:2,padding:"1px 0 3px 22px"}}>
            <button onClick={()=>setDateOpen(dOpen?null:t.id)} title="예정일·마감일" style={{...arrowBtn,color:hasDate?(od?"#F04452":"#0891B2"):"#9CA3AF",fontSize:13,width:26,height:26}}>📅</button>
            <button onClick={()=>moveSib(t,-1)} disabled={i<=0} style={{...arrowBtn,opacity:i<=0?0.25:1,fontSize:13,width:26,height:26}}>▲</button>
            <button onClick={()=>moveSib(t,1)} disabled={i>=sibs.length-1} style={{...arrowBtn,opacity:i>=sibs.length-1?0.25:1,fontSize:13,width:26,height:26}}>▼</button>
            <button onClick={()=>addKid(t.id)} title="하위 추가" style={{...arrowBtn,fontSize:13,width:26,height:26}}>＋</button>
            <button onClick={()=>delTask(t)} title="삭제" style={{...arrowBtn,color:"#F04452",fontSize:13,width:26,height:26}}>🗑</button>
          </div>
        )}
        {dOpen&&(
          <div style={{display:"flex",gap:6,alignItems:"center",margin:"2px 0 4px 20px",flexWrap:"wrap"}}>
            <span style={{fontSize:9.5,fontWeight:800,color:"#0891B2"}}>예정</span>
            <input type="date" value={t.startDate||""} onChange={e=>up("tasks",t.id,{startDate:e.target.value})} style={{padding:"4px 6px",borderRadius:7,border:"1.5px solid #E5E8EB",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
            <span style={{fontSize:9.5,fontWeight:800,color:"#EA580C"}}>마감</span>
            <input type="date" value={t.dueDate||""} onChange={e=>up("tasks",t.id,{dueDate:e.target.value})} style={{padding:"4px 6px",borderRadius:7,border:`1.5px solid ${od?"#F0445288":"#E5E8EB"}`,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
            {hasDate&&<button onClick={()=>up("tasks",t.id,{startDate:"",dueDate:""})} style={{...arrowBtn,fontSize:10,color:"#9CA3AF"}}>지움</button>}
          </div>
        )}
        {ks.map(k=>renderTask(k,depth+1))}
      </div>
    );
  };
  const saveManual=()=>{
    const tree=buildManualTree(D,proj.id);
    if(!tree.length){window.alert("저장할 로드단계가 없어요 · 먼저 프로세스에서 로드단계를 만들어 주세요");return;}
    const now=new Date().toISOString(), by=proj.assigneeId||"";
    const src=proj.sourceManualId&&(D.manuals||[]).find(m=>m.id===proj.sourceManualId);
    if(src){
      const ok=window.confirm(`이 프로젝트는 '${src.name}' 로드맵 템플릿 기반이에요.\n\n[확인] 기존 템플릿 갱신 (이전판은 이력 보관)\n[취소] 새 템플릿으로 저장`);
      if(ok){
        const curV=src.version||1;
        const note=(window.prompt(`v${curV}→v${curV+1} 변경 메모 (선택 · 무엇이 바뀌었나요?)`,"")||"").trim();
        up("manuals",src.id,{stages:tree,version:curV+1,
          versions:[...(src.versions||[]),{v:curV,stages:src.stages||[],savedAt:src.updatedAt||src.createdAt||"",savedBy:src.updatedBy||src.createdBy||"",note}],
          updatedAt:now,updatedBy:by});
        window.alert(`📋 '${src.name}' 로드맵 템플릿을 v${curV+1}로 갱신했어요 (이전 v${curV}는 이력 보관)`);
        return;
      }
    }
    const name=window.prompt("📋 로드맵 템플릿 이름 (이 로드맵을 표준으로 저장)",proj.title||"");
    if(name===null) return;
    const id="man"+Date.now(), mname=(name.trim()||proj.title||"로드맵");
    add("manuals",{id,name:mname,projType:team?"team":"solo",
      stages:tree,version:1,versions:[],createdAt:now,createdBy:by});
    up("projects",proj.id,{sourceManualId:id,sourceManualName:mname,sourceManualVersion:1});   // 로드맵 템플릿 연결 + 이름 박제(이후 '갱신' 가능, 삭제돼도 기록 유지)
    window.alert("📋 로드맵 템플릿으로 저장됐어요\n이 프로젝트는 템플릿에 연결돼, 다음에 고치면 '갱신'할 수 있어요");
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:1500,background:"#F9FAFB",display:"flex",flexDirection:"column"}}>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",color:"#fff",padding:"13px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:14,fontWeight:900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🗺 {proj.title} · 로드맵</p>
          <p style={{margin:"2px 0 0",fontSize:10,opacity:0.82}}>{team?"팀 (담당자 인계)":"개인 (혼자)"} · 로드단계 {stages.length}</p>
        </div>
        {!team&&<button onClick={()=>{if(window.confirm("팀 프로젝트로 전환할까요?\n로드단계마다 담당자를 지정하면 인계가 활성화돼요. (커진 개인 프로젝트를 팀으로)"))up("projects",proj.id,{projType:"team"});}} style={{flexShrink:0,padding:"6px 11px",borderRadius:9,border:"1px solid rgba(255,255,255,0.4)",background:"rgba(255,255,255,0.12)",color:"#fff",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>👥 팀으로 전환</button>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px 30px",maxWidth:760,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10,flexWrap:"wrap"}}>
          <p style={{margin:0,fontSize:11,color:"#9CA3AF",flex:1,minWidth:140,lineHeight:1.5}}>로드단계를 계층형으로 · 각 로드단계에 🧑 고객여정 ‖ 🛠 업무여정 + 만족도·불편점</p>
          <Btn size="sm" variant="orange" onClick={addStage}>+ 로드단계</Btn>
        </div>
        {(()=>{
          const ts=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
          if(!ts.length) return null;
          const childrenOf=(pid)=>ts.filter(t=>(t.parentId||null)===(pid||null)).sort((a,b)=>(a.seq||0)-(b.seq||0));
          const roots=childrenOf(null);
          // 펼친 노드의 자식만 노출 — 로드단계 탭 → 하위 task 트리가 아래로 펼쳐짐
          const visible=[];
          const walk=(t)=>{ visible.push(t); if(expanded[t.id]) childrenOf(t.id).forEach(walk); };
          roots.forEach(walk);
          const vset=new Set(visible.map(t=>t.id));
          const edges0=visible.filter(t=>t.parentId&&vset.has(t.parentId)).map(t=>({id:"e_"+t.id,from:t.parentId,to:t.id}));
          // 아래로 펼치는 트리 배치(부모 위·자식 아래, 부모는 자식 가운데 정렬)
          const CW=NODE_W+22, RH=96; let cur=0; const pos={};
          const place=(t,depth)=>{ const ch=expanded[t.id]?childrenOf(t.id):[]; if(!ch.length){ pos[t.id]={x:24+cur*CW,y:14+depth*RH}; cur++; } else { ch.forEach(c=>place(c,depth+1)); const xs=ch.map(c=>pos[c.id].x); pos[t.id]={x:(Math.min(...xs)+Math.max(...xs))/2,y:14+depth*RH}; } };
          roots.forEach(r=>place(r,0));
          const stOf=(t)=>{ const ch=childrenOf(t.id); if(ch.length){ return ch.every(c=>c.status==="done")?"done":undefined; } return t.status==="done"?"done":(t.status==="inprogress"?"ready":"wait"); };
          const nodes=visible.map(t=>{const m=Mof(t.assigneeId);const kc=childrenOf(t.id).length;return {id:t.id,x:pos[t.id].x,y:pos[t.id].y,title:t.title,sub:(t.parentId?"":"로드단계 · ")+m.name,color:m.color,status:stOf(t),chev:kc?(expanded[t.id]?"▾":"▸"):null,kidCount:kc,chevOpen:!!expanded[t.id]};});
          const maxY=nodes.reduce((mx,n)=>Math.max(mx,n.y),0);
          const toggle=(id)=>setExpanded(e=>({...e,[id]:!e[id]}));
          return(
            <div style={{marginBottom:14}}>
              <button onClick={()=>setCanvasOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 13px",borderRadius:12,border:"1px solid #E5E8EB",background:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:canvasOpen?8:0}}>
                <span style={{fontSize:13,fontWeight:900,color:"#0F1F5C"}}>🧩 통합 캔버스</span>
                <span style={{flex:1,minWidth:0,textAlign:"left",fontSize:10.5,fontWeight:600,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>로드단계 탭 = 하위 프로세스 펼치기 · ✎ = 편집 · 빈곳 드래그·＋/－ 줌</span>
                <span style={{fontSize:12,color:"#9CA3AF"}}>{canvasOpen?"▲":"▼"}</span>
              </button>
              {canvasOpen&&<FlowView mode="progress" height={Math.max(300,Math.min(700,maxY+NODE_H+120))} nodes={nodes} edges={edges0}
                selectedId={canvasEdit?canvasEdit.id:null}
                onNodeTap={node=>{ const kc=childrenOf(node.id).length; if(kc) toggle(node.id); else setCanvasEdit(ts.find(x=>x.id===node.id)||null); }}
                onNodeEdit={node=>setCanvasEdit(ts.find(x=>x.id===node.id)||null)}/>}
            </div>
          );
        })()}
        {(srcMan||srcGone)&&(
          <div style={{display:"flex",alignItems:"center",gap:8,background:srcGone?"#F8F9FA":"#FFFBF5",border:"1px solid "+(srcGone?"#EAEDF0":"#F2E6D5"),borderRadius:11,padding:"9px 12px",marginBottom:9}}>
            <span style={{fontSize:11.5,fontWeight:800,color:srcGone?"#9CA3AF":"#A16207",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📋 ‘{srcMan?srcMan.name:proj.sourceManualName}’ 로드맵 템플릿 v{srcMan?(srcMan.version||1):(proj.sourceManualVersion||1)} 기반</span>
            <span style={{fontSize:10,fontWeight:700,color:srcGone?"#B0B8C1":"#B98A3E",flexShrink:0}}>{srcGone?"로드맵 템플릿 삭제됨 · 기록 유지":"저장 시 갱신/이력"}</span>
          </div>
        )}
        <button onClick={saveManual} style={{width:"100%",padding:"11px 0",borderRadius:11,border:"1.5px solid #FBD9B5",background:"#FFF7ED",fontSize:12.5,fontWeight:800,color:"#EA580C",cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>{srcMan?"📋 템플릿 갱신 / 새 템플릿으로 저장":"📋 로드맵 템플릿으로 저장 (다음에 재사용)"}</button>
        {stages.length===0?<Empty t="로드단계가 없어요 · [+ 로드단계]로 만들거나 🧩프로세스 편집에서 최상위 단계를 만들면 로드단계가 됩니다"/>:(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {stages.map((s,idx)=>{
              const m=Mof(s.assigneeId);const col=team?m.color:"#0891B2";const pct=cpct(s.id);
              const open=s.id===selId;const kids=kidsOf(s.id);const sat=s.satisfaction||0;
              return(
                <div key={s.id} style={{background:"#fff",borderRadius:14,border:`1px solid ${open?col+"66":"#EEF1F4"}`,overflow:"hidden"}}>
                  {/* 로드단계 헤더 */}
                  <div onClick={()=>setSelId(open?null:s.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"12px 13px",cursor:"pointer",borderLeft:`4px solid ${col}`}}>
                    <span style={{flexShrink:0,width:22,height:22,borderRadius:7,background:col,color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{idx+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:13.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title||"로드단계"}</p>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                        {team&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:700,color:m.color}}><span style={{width:13,height:13,borderRadius:"50%",background:m.color,color:"#fff",fontSize:7.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(m.name)}</span>{m.name}</span>}
                        {(s.startDate||s.dueDate)&&<span style={{fontSize:10,color:overdue(s)?"#F04452":"#6B7280",fontWeight:700}}>📅 {fmtD(s.startDate)||"?"}~{fmtD(s.dueDate)||"?"}</span>}
                        {overdue(s)&&<span style={{fontSize:9,fontWeight:800,color:"#fff",background:"#F04452",borderRadius:5,padding:"1px 5px"}}>⏰ 지연</span>}
                        <span style={{fontSize:10,color:"#9CA3AF",fontWeight:700}}>🛠 {kids.filter(k=>k.status==="done").length}/{kids.length}</span>
                        {sat>0&&<span style={{fontSize:10,fontWeight:800,color:"#D97706"}}>{"★".repeat(sat)}<span style={{color:"#E5E8EB"}}>{"★".repeat(5-sat)}</span></span>}
                        {s.painPoint&&<span style={{fontSize:9.5,fontWeight:800,color:"#B42318",background:"#FEE4E2",borderRadius:5,padding:"1px 5px"}}>⚠️ 불편점</span>}
                      </div>
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      <span style={{fontSize:13,fontWeight:900,color:pct>=70?"#00C073":col}}>{pct}%</span>
                      <p style={{margin:"1px 0 0",fontSize:14,color:"#C4C9D0"}}>{open?"▴":"▾"}</p>
                    </div>
                  </div>
                  {/* 인계 받는 쪽 — 이전 로드단계의 인계메모 / 곧 내 차례 예고 */}
                  {team&&(()=>{const prev=stages[idx-1];if(!prev||(prev.assigneeId||"")===(s.assigneeId||""))return null;const pn=Mof(prev.assigneeId).name;
                    if(prev.handoffNote&&prev.status!=="todo") return <div style={{display:"flex",gap:6,alignItems:"flex-start",padding:"7px 12px",background:"#FFF7ED",borderTop:"1px solid #FBE3C7"}}><span style={{fontSize:10.5,fontWeight:800,color:"#EA580C",flexShrink:0}}>📩 {pn} 인계</span><span style={{fontSize:11,color:"#9A3412",lineHeight:1.45}}>{prev.handoffNote}</span></div>;
                    if(prev.status!=="done"&&prev.dueDate) return <div style={{padding:"6px 12px",background:"#F5F8FF",borderTop:"1px solid #E0E7FF"}}><span style={{fontSize:10.5,fontWeight:800,color:"#3730A3"}}>⏭ 곧 내 차례 · {pn} {fmtD(prev.dueDate)} 마감 예정 뒤</span></div>;
                    return null;})()}
                  {/* 두 트랙 요약 (접힘 상태) */}
                  {!open&&(
                    <div style={{display:"flex",borderTop:"1px solid #F4F4F5"}}>
                      <div style={{flex:1,padding:"8px 12px",borderRight:"1px solid #F4F4F5",minWidth:0}}><p style={{margin:0,fontSize:9.5,fontWeight:800,color:"#0891B2"}}>🧑 고객여정</p><p style={{margin:"2px 0 0",fontSize:11,color:s.custJourney?"#374151":"#C4C9D0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.custJourney||"미입력"}</p></div>
                      <div style={{flex:1,padding:"8px 12px",minWidth:0}}><p style={{margin:0,fontSize:9.5,fontWeight:800,color:"#7C3AED"}}>🛠 업무여정</p><p style={{margin:"2px 0 0",fontSize:11,color:kids.length?"#374151":"#C4C9D0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kids.length?kids.map(k=>k.title).join(" → "):"실행 업무 없음"}</p></div>
                    </div>
                  )}
                  {/* 펼침: 편집 + 업무여정 트리 */}
                  {open&&(
                    <div style={{padding:"4px 13px 14px",borderTop:"1px solid #F4F4F5"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginTop:8}}>
                        <button onClick={()=>moveSib(s,-1)} disabled={idx<=0} style={{...arrowBtn,opacity:idx<=0?0.25:1,fontSize:12}}>▲ 위</button>
                        <button onClick={()=>moveSib(s,1)} disabled={idx>=stages.length-1} style={{...arrowBtn,opacity:idx>=stages.length-1?0.25:1,fontSize:12}}>▼ 아래</button>
                        <button onClick={()=>{delTask(s);setSelId(null);}} style={{...arrowBtn,fontSize:11,color:"#F04452",fontWeight:700}}>🗑 로드단계 삭제</button>
                      </div>
                      <div style={{display:"flex",gap:8,margin:"6px 0 10px",alignItems:"flex-end",flexWrap:"wrap"}}>
                        <div style={{flex:"1 1 150px",minWidth:120}}><label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#4B5563",marginBottom:4}}>로드단계명</label>
                          <input key={s.id+"t"} defaultValue={s.title||""} onBlur={e=>up("tasks",s.id,{title:e.target.value})} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:13,fontWeight:700,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
                        <div style={{flex:"1 1 120px"}}><label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#0891B2",marginBottom:4}}>📅 예정 시작</label>
                          <input type="date" value={s.startDate||""} onChange={e=>up("tasks",s.id,{startDate:e.target.value})} style={{width:"100%",padding:"8px 9px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,fontWeight:700,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
                        <div style={{flex:"1 1 120px"}}><label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#EA580C",marginBottom:4}}>🏁 마감</label>
                          <input type="date" value={s.dueDate||""} onChange={e=>up("tasks",s.id,{dueDate:e.target.value})} style={{width:"100%",padding:"8px 9px",borderRadius:9,border:`1.5px solid ${overdue(s)?"#F0445288":"#E5E8EB"}`,fontSize:12.5,fontWeight:700,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
                      </div>
                      {team&&(<>
                        <label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#4B5563",marginBottom:5}}>담당자 (인계)</label>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                          {MEM.map(mm=>{const on=s.assigneeId===mm.id;return(<button key={mm.id||"n"} onClick={()=>up("tasks",s.id,{assigneeId:mm.id})} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 9px",borderRadius:20,border:`1.5px solid ${on?mm.color:"#E5E8EB"}`,background:on?mm.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><span style={{width:15,height:15,borderRadius:"50%",backgroundColor:mm.color,color:"#fff",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(mm.name)}</span><span style={{fontSize:11,fontWeight:700,color:on?mm.color:"#4B5563"}}>{mm.name}</span></button>);})}
                        </div>
                      </>)}
                      {/* 트랙1 — 고객여정 */}
                      <label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#0891B2",marginBottom:4}}>🧑 고객여정 <span style={{fontWeight:600,color:"#9CA3AF"}}>(고객이 겪는 것)</span></label>
                      <textarea key={s.id+"cj"} defaultValue={s.custJourney||""} onBlur={e=>up("tasks",s.id,{custJourney:e.target.value})} placeholder="예: 상세페이지에서 사이즈 정보를 못 찾아 이탈" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #CDEAF2",background:"#F7FCFE",fontSize:12.5,resize:"vertical",minHeight:48,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
                      {/* 트랙2 — 업무여정 (계층형 인라인 편집) */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,gap:6,flexWrap:"wrap"}}>
                        <label style={{fontSize:10.5,fontWeight:800,color:"#7C3AED"}}>🛠 업무여정 <span style={{fontWeight:600,color:"#9CA3AF"}}>(실행 — 계층형 편집)</span></label>
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          {tpls.length>0&&<select value="" onChange={e=>{const tpl=tpls.find(t=>t.id===e.target.value);if(!tpl)return;if(kids.length&&!window.confirm(`'${tpl.name}' 프로세스(${(tpl.nodes||[]).length}단계)를 이 로드단계 업무로 추가할까요?`))return;attachProcessToStage(s.id,tpl);}} style={{padding:"4px 8px",borderRadius:8,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">🧩 프로세스 장착…</option>{tpls.map(t=><option key={t.id} value={t.id}>{t.name} v{t.version||1}</option>)}</select>}
                          <button onClick={()=>addKid(s.id)} style={{flexShrink:0,padding:"4px 10px",borderRadius:8,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 업무</button>
                        </div>
                      </div>
                      {s.processId&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"5px 9px",borderRadius:8,background:"#F3EFFE",border:"1px solid #E7E1FB"}}><span style={{fontSize:10,fontWeight:800,color:"#7C3AED"}}>🧩 {s.processName||"프로세스"} <span style={{color:"#A78BFA"}}>v{s.processVersion||1}</span> 기반</span><span style={{flex:1,fontSize:9.5,color:"#9CA3AF"}}>개선은 🚀프로세스 탭에서 버전업</span><button onClick={()=>up("tasks",s.id,{processId:null,processName:null,processVersion:null})} style={{background:"none",border:"none",color:"#C4C9D0",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>해제</button></div>}
                      <div style={{padding:"7px 9px",borderRadius:9,border:"1.5px solid #E7E1FB",background:"#FBFAFF",minHeight:48,boxSizing:"border-box",marginBottom:12}}>
                        {kids.length===0?<p style={{margin:"6px 2px",fontSize:11,color:"#C4C9D0"}}>실행 업무 없음 · [＋ 업무]로 추가하세요</p>:kids.map(k=>renderTask(k,0))}
                      </div>
                      {/* 만족도 · 불편점 (개선 루프) */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:10.5,fontWeight:800,color:"#4B5563"}}>만족도</span>
                        {[1,2,3,4,5].map(n=><button key={n} onClick={()=>up("tasks",s.id,{satisfaction:sat===n?null:n})} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,padding:0,lineHeight:1,color:n<=sat?"#F59E0B":"#E5E8EB"}}>★</button>)}
                        {sat>0&&<span style={{fontSize:10,color:"#9CA3AF"}}>{sat}/5</span>}
                      </div>
                      <label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#B42318",marginBottom:4}}>⚠️ 불편점 <span style={{fontWeight:600,color:"#9CA3AF"}}>(개선 대상 — 버전업의 근거)</span></label>
                      <textarea key={s.id+"pp"} defaultValue={s.painPoint||""} onBlur={e=>up("tasks",s.id,{painPoint:e.target.value})} placeholder="예: 사이즈 정보 위치 모호 → 상단 고정 / 반복 세팅 → 자동화" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #FBD5D2",background:"#FFFBFA",fontSize:12.5,resize:"vertical",minHeight:48,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
                      <label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#4B5563",marginBottom:4}}>💬 업무 개선 메모</label>
                      <textarea key={s.id+"d"} defaultValue={s.discuss||""} onBlur={e=>up("tasks",s.id,{discuss:e.target.value})} placeholder="예: 전환율 낮음 → 카피 방식 변경 / 외주·자동화 검토" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",fontSize:12.5,resize:"vertical",minHeight:44,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
                      {team&&(<><label style={{display:"block",fontSize:10.5,fontWeight:800,color:"#EA580C",marginBottom:4}}>📩 인계 메모 <span style={{fontWeight:600,color:"#9CA3AF"}}>(다음 담당자에게 — 완료 시 다음 로드단계에 표시)</span></label>
                      <textarea key={s.id+"h"} defaultValue={s.handoffNote||""} onBlur={e=>up("tasks",s.id,{handoffNote:e.target.value})} placeholder="예: 시안 2안으로 확정·원본은 드라이브 / 주의: 사이즈표 누락 확인" style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #FBD9B5",background:"#FFFBF5",fontSize:12.5,resize:"vertical",minHeight:40,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/></>)}
                      <button onClick={()=>onOpenProcess(proj)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1.5px solid #DDD6FE",background:"#FAF9FF",fontSize:12.5,fontWeight:800,color:"#7C3AED",cursor:"pointer",fontFamily:"inherit"}}>🧩 프로세스 편집 (실행 업무 추가·인계)</button>
                    </div>
                  )}
                </div>
              );
            })}
            <p style={{margin:"2px 2px 0",fontSize:10.5,color:"#9CA3AF",lineHeight:1.6}}>※ 로드단계=프로세스 최상위 단계 · 🧩%=하위 업무 실제 진행 · 고객여정·불편점은 개선(버전업)의 근거로 누적됩니다</p>
          </div>
        )}
      </div>
      <Sheet open={!!canvasEdit} onClose={()=>setCanvasEdit(null)} title="🧩 단계·업무 편집">
        {canvasEdit&&(()=>{ const t=D.tasks.find(x=>x.id===canvasEdit.id); if(!t) return null; const inp={width:"100%",padding:"11px 13px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:14,fontWeight:600,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}; const lb={display:"block",fontSize:12,fontWeight:700,color:"#374151",margin:"12px 0 5px"}; return(
          <div style={{marginTop:8}}>
            <label style={lb}>이름</label>
            <input key={t.id} defaultValue={t.title||""} onBlur={e=>up("tasks",t.id,{title:e.target.value})} style={inp}/>
            {team&&(<><label style={lb}>담당자 <span style={{fontWeight:600,color:"#9CA3AF"}}>(이 단계를 누가)</span></label>
              <select value={t.assigneeId||""} onChange={e=>up("tasks",t.id,{assigneeId:e.target.value})} style={{...inp,background:"#fff",WebkitAppearance:"none"}}>{MEM.map(m=><option key={m.id||"none"} value={m.id}>{m.name}</option>)}</select></>)}
            <label style={lb}>상태</label>
            <div style={{display:"flex",gap:7}}>
              {[["todo","할일"],["inprogress","진행중"],["done","완료"]].map(([s,l])=>{const on=t.status===s;const c=STATUS_MAP[s].color;return(<button key={s} onClick={()=>up("tasks",t.id,s==="done"?{status:s,doneAt:new Date().toISOString(),doneByName:(D.users.find(u=>u.id===t.assigneeId)||{}).name||""}:{status:s})} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1.5px solid ${on?c:"#E5E8EB"}`,background:on?c+"18":"#fff",color:on?c:"#6B7280",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
            </div>
            <button onClick={()=>{addKid(t.id);setExpanded(e=>({...e,[t.id]:true}));}} style={{width:"100%",marginTop:14,padding:"11px 0",borderRadius:11,border:"1.5px solid #FDBA74",background:"#FFF7ED",color:"#EA580C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 하위 업무(프로세스) 추가</button>
            <p style={{margin:"8px 2px 0",fontSize:10.5,color:"#9CA3AF",lineHeight:1.5}}>※ 캔버스에서 노드 아래 ●을 다른 노드로 끌면 그 노드의 하위(프로세스)로 이어집니다.</p>
            <button onClick={()=>{delTask(t);setCanvasEdit(null);}} style={{width:"100%",marginTop:10,padding:"11px 0",borderRadius:11,border:"1.5px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 삭제</button>
          </div>
        );})()}
      </Sheet>
    </div>
  );
}
function ProjectsPage({D,cu,up,add,rm,rmNested,pc,lead,nav}){
  const [roadmapProj,setRoadmapProj]=useState(null);
  const [processProj,setProcessProj]=useState(null);
  const [filter,setFilter]=useState("mine");
  const [groupFilter,setGroupFilter]=useState("all");
  const _iv=_projInitView;_projInitView=null;   // 오늘 인계카드 진입값 1회 소비
  const [pview,setPview]=useState((_iv==="launch"||_iv==="process")?"canvas":(_iv||"list"));   // list | canvas
  const [canvasSub,setCanvasSub]=useState(_iv==="launch"?"template":"roadmap");   // 캔버스 내부: roadmap(로드맵·프로세스) | template(프로세스 템플릿)
  const [projDetail,setProjDetail]=useState(null);
  const tpls=D.launchTemplates||[];
  const [taskForm,setTaskForm]=useState({title:"",status:"todo",dueDate:"",memo:"",assigneeId:""});
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
  const actRemove=(proj,ak)=>rmNested("projects",proj.id,"activityKPIs",ak.id,"활동지표");   // 삭제해도 휴지통에 보관·복구 가능
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
  const [projForm,setProjForm]=useState({title:"",goalType:"journey",projType:"team",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high",manualId:""});
  const [metric,setMetric]=useState({name:"",target:"",unit:"개"});
  const resetProjForm=()=>{setProjForm({title:"",goalType:"journey",projType:"team",mainKPIId:"",subKPIId:"",dealerType:"",assigneeId:cu.id,collaboratorIds:[],group:"",priority:"high",manualId:""});setMetric({name:"",target:"",unit:"개"});};
  const openEditProj=(p)=>{ setProjForm({title:p.title||"",goalType:p.goalType||(p.mainKPIId==="mk2"||p.resultValue?"revenue":"journey"),projType:p.projType||((p.collaboratorIds||[]).length>0?"team":"solo"),mainKPIId:p.mainKPIId||"",subKPIId:p.subKPIId||"",dealerType:p.dealerType||"",assigneeId:p.assigneeId||cu.id,collaboratorIds:p.collaboratorIds||[],group:p.group||"",priority:p.priority||"mid",manualId:""}); setMetric({name:"",target:"",unit:"개"}); setEditProjId(p.id); setShowAdv(true); setAddProjSheet(true); };
  // 로드맵 템플릿에서 새 프로젝트 시작 — 추가 시트를 템플릿 정보로 프리필
  const startFromManual=(m)=>{ resetProjForm(); setEditProjId(null); setShowAdv(true); setProjForm(f=>({...f,title:m.name||"",projType:m.projType||"team",goalType:"journey",assigneeId:cu.id,manualId:m.id})); setAddProjSheet(true); };
  const doAddProj=()=>{
    if(!projForm.title.trim()) return;
    if(editProjId){ const {manualId,...rest}=projForm; up("projects",editProjId,{...rest}); }
    else {
      const {manualId,...rest}=projForm;
      const projId="p"+Date.now();
      const man=manualId&&(D.manuals||[]).find(m=>m.id===manualId);
      const proj={id:projId,...rest,status:"active",progress:0,resultValue:0};
      if(man){ proj.sourceManualId=man.id; proj.sourceManualName=man.name||""; proj.sourceManualVersion=man.version||1; if(man.countKPIId) proj.countKPIId=man.countKPIId; }   // 로드맵 템플릿 역링크 + 이름 박제(삭제돼도 기록 유지) + 완료집계 상속
      if(projForm.goalType==="metric"&&metric.name.trim()) proj.activityKPIs=[{id:"ak"+Date.now(),name:metric.name.trim(),unit:metric.unit||"개",target:numF(metric.target),current:0,history:[]}];
      add("projects",proj);
      if(man) cloneManualToProject(man,projId,projForm.projType,add);
    }
    resetProjForm(); setEditProjId(null); setShowAdv(false); setAddProjSheet(false);
  };
  const availSKs=D.subKPIs.filter(sk=>sk.mainKPIId===projForm.mainKPIId);
  const toggleColab=(uid)=>{const list=projForm.collaboratorIds;setProjForm({...projForm,collaboratorIds:list.includes(uid)?list.filter(x=>x!==uid):[...list,uid]});};
  // 예시(데모) 프로젝트 — 초기 시드는 id가 p+짧은숫자(p001 등), 직접 만든 건 p+타임스탬프(13자리)라 구분 가능
  const demoProjs=D.projects.filter(p=>/^p\d{1,4}$/.test(p.id));
  const cleanupDemo=()=>{
    if(!demoProjs.length) return;
    if(!window.confirm(`예시(데모) 프로젝트 ${demoProjs.length}개와 그 업무를 삭제할까요?\n내가 직접 만든 프로젝트는 그대로 남습니다.\n(삭제해도 휴지통에 보관 — KPI ▸ 데이터에서 언제든 복구 가능)`)) return;
    const ids=new Set(demoProjs.map(p=>p.id));
    D.tasks.filter(t=>ids.has(t.projectId)).forEach(t=>rm("tasks",t.id,true));
    demoProjs.forEach(p=>rm("projects",p.id,true));
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
    const goalTypeL={revenue:"매출",metric:"활동지표",journey:"구축"};
    const rows=[["제목","그룹","담당자","목표유형","거래처유형","메인KPI","서브KPI","우선순위","상태","진척도%","진척방식","업무(완료/전체)","매출(원)","매출입력자","매출최종일","매출입력횟수","활동지표"]];
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
    add("tasks",{id:"t"+Date.now(),...taskForm,projectId:projDetail.id,isFixed:false,weekDay:null,weekSlot:null,attachments:[]});
    setTaskForm({title:"",status:"todo",dueDate:"",memo:"",assigneeId:""});setAddTaskSheet(false);
  };
  const ST=STATUS_MAP;
  const pTabs=(
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["list","▦ 프로젝트"],["canvas","🧩 로드맵·프로세스"]].map(([k,l])=>(
        <button key={k} onClick={()=>setPview(k)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",backgroundColor:pview===k?"#0F1F5C":"#F2F4F6",color:pview===k?"#fff":"#374151",fontWeight:800,fontSize:12.5,fontFamily:"inherit"}}>{l}</button>
      ))}
    </div>
  );
  if(pview==="canvas") return(
    <div style={{padding:"14px 16px 24px"}}>
      {pTabs}
      <div style={{display:"flex",background:"#F2F4F6",borderRadius:12,padding:3,marginBottom:14}}>
        {[["roadmap","🗺 프로젝트 로드맵"],["template","🚀 프로세스 템플릿"]].map(([k,l])=>(
          <button key={k} onClick={()=>setCanvasSub(k)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",background:canvasSub===k?"#fff":"transparent",color:canvasSub===k?"#0F1F5C":"#6B7280",fontWeight:canvasSub===k?800:600,fontSize:12.5,fontFamily:"inherit",boxShadow:canvasSub===k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{l}</button>
        ))}
      </div>
      {canvasSub==="template"&&<LaunchPage D={D} cu={cu} lead={lead} add={add} up={up} rm={rm} nav={nav}/>}
      {canvasSub==="roadmap"&&(<>
      <p style={{margin:"0 2px 12px",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>프로젝트별 로드맵·프로세스를 한 캔버스에서 · 카드를 열면 완전 편집형 캔버스</p>
      {((D.manuals||[]).length>0||(D.launchTemplates||[]).length>0)&&(
        <div style={{marginBottom:16,background:"#FFFBF5",border:"1px solid #FBE5C8",borderRadius:14,padding:"12px 13px"}}>
          <p style={{margin:"0 0 9px",fontSize:12,fontWeight:900,color:"#EA580C"}}>🗺 로드맵 템플릿 <span style={{fontWeight:700,color:"#C08A4A"}}>· 저장된 표준 (새 프로젝트로 재사용)</span></p>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {(D.manuals||[]).map(m=><ManualCard key={m.id} m={m} D={D} up={up} rm={rm} startFromManual={startFromManual}/>)}
            {(D.launchTemplates||[]).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:10,border:"1px solid #F2E6D5",padding:"9px 11px"}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}><span style={{color:"#7C3AED",fontWeight:800}}>프로세스</span> · 마인드맵 · 단계 {(t.nodes||[]).length}</p>
                </div>
                <button onClick={()=>setCanvasSub("template")} style={{flexShrink:0,padding:"6px 10px",borderRadius:9,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🚀 템플릿 보기</button>
              </div>
            ))}
          </div>
          <p style={{margin:"8px 2px 0",fontSize:10,color:"#C08A4A",lineHeight:1.5}}>출시 프로세스는 SKU를 찍어내고 운영지표에 자동 집계돼 <b>🚀 프로세스</b> 탭에서 다룹니다.</p>
        </div>
      )}
      {(()=>{
        const list=D.projects.filter(p=>D.tasks.some(t=>t.projectId===p.id&&!t.isFixed));
        if(!list.length) return <Empty t="아직 로드맵이 없어요 · 프로젝트에서 🧩프로세스로 로드단계를 만들어보세요"/>;
        const pIds=new Set(D.tasks.filter(t=>t.parentId).map(t=>t.parentId));
        return(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {list.map(p=>{
              const ts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);
              const stages=ts.filter(t=>!t.parentId);
              const leaves=ts.filter(t=>!pIds.has(t.id));
              const done=leaves.filter(t=>t.status==="done").length;
              const prog=leaves.length?Math.round(done/leaves.length*100):0;
              const team=isTeamProj(D,p);
              const who=D.users.find(u=>u.id===p.assigneeId);
              return(
                <button key={p.id} onClick={()=>setRoadmapProj(p)} style={{textAlign:"left",backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"13px 14px",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:14}}>🗺</span>
                    <span style={{flex:1,minWidth:0,fontSize:13.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                    <span style={{fontSize:9.5,fontWeight:800,color:team?"#EA580C":"#3182F6",background:team?"#FFEDD5":"#EBF3FF",borderRadius:6,padding:"2px 7px",flexShrink:0}}>{team?"팀":"개인"}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{flex:1,height:6,borderRadius:6,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:prog+"%",height:"100%",background:prog>=100?"#00C073":"#F97316",borderRadius:6}}/></div>
                    <span style={{fontSize:12,fontWeight:900,color:prog>=100?"#00C073":"#F97316",flexShrink:0}}>{prog}%</span>
                  </div>
                  <p style={{margin:0,fontSize:10.5,color:"#9CA3AF"}}>로드단계 {stages.length}개 · 업무 {done}/{leaves.length}{who?` · ${who.name}`:""}</p>
                </button>
              );
            })}
          </div>
        );
      })()}
      {roadmapProj&&<ProjectRoadmap D={D} proj={roadmapProj} up={up} add={add} rm={rm} onClose={()=>setRoadmapProj(null)} onOpenProcess={(p)=>{setRoadmapProj(null);setProcessProj(p);}}/>}
      {processProj&&<ProjectProcessEditor D={D} proj={processProj} cu={cu} add={add} up={up} rm={rm} onClose={()=>setProcessProj(null)}/>}
      </>)}
    </div>
  );
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
                <div style={{marginTop:10,display:"flex",gap:7}}>
                  <button onClick={e=>{e.stopPropagation();setRoadmapProj(proj);}} style={{padding:"7px 13px",borderRadius:9,border:"1.5px solid #C7D2FE",background:"#EEF2FF",color:"#3730A3",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🗺 {tasks.length?"로드맵 보기·편집":"로드맵 만들기"}</button>
                  <button onClick={e=>{e.stopPropagation();setProcessProj(proj);}} title="마인드맵으로 업무 트리 자유 편집" style={{padding:"7px 11px",borderRadius:9,border:"1.5px solid #DDD6FE",background:"#FAF9FF",color:"#7C3AED",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🧩 프로세스</button>
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
                  <ProjStageFlow D={D} proj={proj} cu={cu} up={up}/>
                  <SegmentEditor D={D} proj={proj} up={up}/>
                  <div style={{padding:"12px 16px 0",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#4B5563",flexShrink:0}}>🏷 거래처유형</span>
                    <select value={proj.dealerType||""} onChange={e=>up("projects",proj.id,{dealerType:e.target.value})} style={{flex:1,padding:"7px 10px",borderRadius:8,fontSize:12,fontWeight:700,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",color:proj.dealerType?(DT[proj.dealerType]?.color||"#111827"):"#9CA3AF",fontFamily:"inherit",WebkitAppearance:"none"}}><option value="">미지정</option>{DEALER_TYPES.map(d=><option key={d.code} value={d.code}>{d.code} · {d.label} ({d.price})</option>)}</select>
                  </div>
                  <div style={{padding:"12px 16px 0"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span style={{fontSize:12,fontWeight:800,color:"#4B5563"}}>🎯 활동지표 <span style={{fontWeight:600,color:"#9CA3AF"}}>(매출 빼고)</span></span>
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
                              <button onClick={e=>{e.stopPropagation();up("tasks",task.id,statusPatch(D,task,task.status==="done"?"todo":"done"));}} style={{width:20,height:20,borderRadius:5,border:`2px solid ${task.status==="done"?"#00C073":"#D1D5DB"}`,backgroundColor:task.status==="done"?"#00C073":"#FFFFFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
                                {task.status==="done"&&<span style={{color:"#FFFFFF",fontSize:11,fontWeight:900}}>✓</span>}
                              </button>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{margin:0,fontSize:13,fontWeight:700,color:task.status==="done"?"#9CA3AF":"#111827",textDecoration:task.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</p>
                                <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                                  {task.dueDate&&<span style={{fontSize:10.5,color:"#9CA3AF"}}>📅 {task.dueDate}</span>}
                                  {task.memo&&<span style={{fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:100}}>💬 {task.memo}</span>}
                                </div>
                              </div>
                              {taskUser?<span title={taskUser.name} style={{flexShrink:0,display:"flex"}}><Ava name={taskUser.name} color={taskUser.color} size={20}/></span>:<button onClick={e=>{e.stopPropagation();setEditTask(task);}} style={{flexShrink:0,fontSize:10,fontWeight:700,color:"#9CA3AF",background:"#F2F4F6",border:"none",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontFamily:"inherit"}}>미배정</button>}
                              <select value={task.status} onChange={e=>up("tasks",task.id,statusPatch(D,task,e.target.value))} style={{border:"1px solid #E5E8EB",borderRadius:8,fontSize:11,color:st.color,backgroundColor:st.bg,cursor:"pointer",fontFamily:"inherit",fontWeight:700,padding:"3px 6px",outline:"none",WebkitAppearance:"none"}}>
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
                  <div style={{padding:"10px 16px 14px",borderTop:"1px solid #E5E8EB",display:"flex",alignItems:"center",gap:8}}><div style={{display:"flex",alignItems:"center",gap:6,marginRight:"auto",flexWrap:"wrap"}}><span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>선행지표</span>{proj.progressManual?(<><button onClick={()=>up("projects",proj.id,{progress:Math.max(0,(proj.progress||0)-10),progressManual:true})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>−</button><span style={{fontSize:13,fontWeight:800,color:"#3182F6",minWidth:40,textAlign:"center"}}>{proj.progress}%</span><button onClick={()=>up("projects",proj.id,{progress:Math.min(100,(proj.progress||0)+10),progressManual:true})} style={{width:28,height:28,borderRadius:8,border:"1px solid #E5E8EB",backgroundColor:"#F9FAFB",fontSize:15,fontWeight:900,color:"#4B5563",cursor:"pointer",padding:0}}>＋</button><button onClick={()=>{const auto=tasks.length?Math.round(done.length/tasks.length*100):(proj.progress||0);up("projects",proj.id,{progressManual:false,progress:auto});}} title="업무 완료율로 자동 산출" style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#8B5CF6",cursor:"pointer",fontFamily:"inherit"}}>🔄 자동전환</button></>):(<><span style={{fontSize:13,fontWeight:800,color:"#3182F6",minWidth:40,textAlign:"center"}}>{proj.progress}%</span><span style={{fontSize:10,fontWeight:700,color:"#00C073",background:"#E8FAF1",padding:"3px 7px",borderRadius:7}}>🔄 자동 · 업무 {done.length}/{tasks.length}</span><button onClick={()=>up("projects",proj.id,{progressManual:true})} title="진척을 직접 조정" style={{padding:"4px 8px",borderRadius:7,border:"1px solid #E5E8EB",background:"#fff",fontSize:10.5,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>✎ 수동</button></>)}</div>
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
      {processProj&&<ProjectProcessEditor D={D} proj={processProj} cu={cu} add={add} up={up} rm={rm} onClose={()=>setProcessProj(null)}/>}
      <Sheet open={addTaskSheet} onClose={()=>setAddTaskSheet(false)} title="업무 추가" h="75vh">
        <div style={{marginTop:10}}>
          {projDetail&&<div style={{backgroundColor:"#EBF3FF",borderRadius:10,padding:"8px 12px",marginBottom:14}}><p style={{margin:0,fontSize:12,fontWeight:700,color:"#3182F6"}}>📁 {projDetail.title}</p></div>}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>업무명 *</label><input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&doAddTask()} placeholder="업무 내용을 입력하세요" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>초기 상태</label><select value={taskForm.status} onChange={e=>setTaskForm({...taskForm,status:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자 <span style={{color:"#9CA3AF",fontWeight:600}}>(선택 · 기본 미배정)</span></label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setTaskForm({...taskForm,assigneeId:""})} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${!taskForm.assigneeId?"#F97316":"#E5E8EB"}`,background:!taskForm.assigneeId?"#FFEDD5":"#fff",fontSize:12,fontWeight:700,color:!taskForm.assigneeId?"#EA580C":"#9CA3AF",cursor:"pointer",fontFamily:"inherit"}}>미배정</button>
              {D.users.map(u=>{const sel=taskForm.assigneeId===u.id;return(<button key={u.id} onClick={()=>setTaskForm({...taskForm,assigneeId:u.id})} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,background:sel?u.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={18}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span></button>);})}
            </div>
          </div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>마감일 (선택)</label><input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:18}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>메모 (선택)</label><textarea value={taskForm.memo} onChange={e=>setTaskForm({...taskForm,memo:e.target.value})} placeholder="메모..." style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",resize:"vertical",minHeight:72,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/></div>
          <button onClick={doAddTask} disabled={!taskForm.title.trim()} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:taskForm.title.trim()?"#F97316":"#E5E8EB",color:taskForm.title.trim()?"#FFFFFF":"#9CA3AF",fontSize:15,fontWeight:700,cursor:taskForm.title.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>추가하기</button>
        </div>
      </Sheet>
      <Sheet open={addProjSheet} onClose={()=>{setAddProjSheet(false);setEditProjId(null);setShowAdv(false);resetProjForm();}} title={editProjId?"프로젝트 수정":"프로젝트 추가"} h="92vh">
        <div style={{marginTop:10}}>
          {!editProjId&&projForm.manualId&&(()=>{const m=(D.manuals||[]).find(x=>x.id===projForm.manualId);if(!m)return null;return(
            <div style={{display:"flex",alignItems:"center",gap:8,background:"#FFF7ED",border:"1.5px solid #FBD9B5",borderRadius:11,padding:"10px 12px",marginBottom:14}}>
              <span style={{fontSize:15}}>📋</span>
              <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontSize:12.5,fontWeight:800,color:"#EA580C"}}>'{m.name}' 로드맵 템플릿에서 생성</p><p style={{margin:"2px 0 0",fontSize:10.5,color:"#C08A4A"}}>로드단계 {(m.stages||[]).length}개와 프로세스가 함께 만들어져요</p></div>
              <button onClick={()=>setProjForm(f=>({...f,manualId:""}))} style={{flexShrink:0,padding:"5px 9px",borderRadius:8,border:"1px solid #FBD9B5",background:"#fff",color:"#EA580C",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>해제</button>
            </div>
          );})()}
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>프로젝트명 *</label><input value={projForm.title} onChange={e=>setProjForm({...projForm,title:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"&&projForm.title.trim())doAddProj();}} placeholder="프로젝트 이름 (Enter로 빠른 추가)" style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>담당자</label><select value={projForm.assigneeId} onChange={e=>setProjForm({...projForm,assigneeId:e.target.value})} style={{width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{D.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>프로젝트 유형</label>
            <div style={{display:"flex",gap:6}}>
              {[["team","👥 팀 협업","담당자 인계·마인드맵"],["solo","🙋 개인","계층형 체크리스트"]].map(([k,l,d])=>(
                <button key={k} onClick={()=>setProjForm({...projForm,projType:k})} style={{flex:1,padding:"10px 4px",borderRadius:11,border:`1.5px solid ${projForm.projType===k?"#F97316":"#E5E8EB"}`,background:projForm.projType===k?"#FFEDD5":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <p style={{margin:0,fontSize:12.5,fontWeight:800,color:projForm.projType===k?"#EA580C":"#374151"}}>{l}</p>
                  <p style={{margin:"2px 0 0",fontSize:9,color:"#9CA3AF"}}>{d}</p>
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>이 프로젝트의 성과는? <span style={{color:"#9CA3AF",fontWeight:600}}>(측정 방식)</span></label>
            <div style={{display:"flex",gap:6}}>
              {[["revenue","💰 매출","돈을 번다"],["metric","🎯 활동지표","상품등록 100개"],["journey","🔁 구축·운영","CRM·어드민 등 구축"]].map(([k,l,d])=>(
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
      <EditTaskSheet open={!!editTask} onClose={()=>setEditTask(null)} task={editTask} D={D} add={add} up={up} onSave={f=>up("tasks",editTask.id,{title:f.title,status:f.status,parentId:f.parentId||null,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,assigneeId:(f.forAll?"":((f.assigneeIds||[])[0]||"")),assigneeIds:f.assigneeIds||[],forAll:!!f.forAll,attachments:f.attachments,weekDay:f.weekDay||null,weekSlot:f.weekSlot??null,workDate:f.workDate||null,fixedTime:f.fixedTime||null,...(f.statusLog?{statusLog:f.statusLog,doneAt:f.doneAt,doneBy:f.doneBy,doneByName:f.doneByName}:{})})}/>
      <Confirm open={!!confirmTaskId} title="업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmTaskId)?.title}" 업무를 삭제할까요?\n휴지통으로 이동하며 언제든 복구할 수 있어요.`} onOk={()=>{rm("tasks",confirmTaskId);setConfirmTaskId(null);}} onCancel={()=>setConfirmTaskId(null)}/>
      <Confirm open={!!projDel} title="프로젝트 삭제" desc={`"${D.projects.find(p=>p.id===projDel)?.title}" 프로젝트를 삭제할까요? 연결된 업무는 남습니다.\n휴지통에서 복구할 수 있어요.`} onOk={()=>{rm("projects",projDel);setProjDel(null);setProjDetail(null);}} onCancel={()=>setProjDel(null)}/>
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
      <Sheet open={!!actEdit} onClose={()=>setActEdit(null)} title="🎯 활동지표 수정">
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
    if(actionForm.type==="task"){add("tasks",{id:nid,title:actionForm.title,projectId:actionForm.projectId,assigneeId:cu.id,status:actionForm.status,type:"general",isFixed:false,weekDay:null,weekSlot:null,dueDate:detail?.date||"",memo:`📅 미팅: ${detail?.title}`,attachments:[],...(actionForm.status==="done"?{doneAt:new Date().toISOString(),doneBy:cu?.id||null,doneByName:cu?.name||""}:{})});}
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
              <button onClick={()=>{(D.tasks||[]).filter(x=>x.eventId===detail.id).forEach(x=>rm("tasks",x.id,true));rm("events",detail.id);setDetail(null);}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"1px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 일정 삭제</button>
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
// 팀/개인 자동 판정 — 프로젝트에 실제로 관여한 사람(담당자+협업자+로드단계/업무 담당자) 수로 결정. projType 있으면 수동 우선.
function projPeople(D,proj){const s=new Set();if(proj.assigneeId)s.add(proj.assigneeId);(proj.collaboratorIds||[]).forEach(i=>i&&s.add(i));(D.tasks||[]).forEach(t=>{if(t.projectId===proj.id&&!t.isFixed&&t.assigneeId)s.add(t.assigneeId);});return s;}
function isTeamProj(D,proj){if(proj&&proj.projType)return proj.projType==="team";return projPeople(D,proj).size>=2;}
const launchStageStatus=(task,allTasks)=>{
  if(!task) return "wait";
  if(task.status==="done") return "done";
  const deps=task.deps||[];
  const ready=deps.every(id=>{const d=allTasks.find(t=>t.id===id);return d?d.status==="done":true;});
  return ready?"ready":"wait";
};
const launchProjTasks=(D,proj)=>D.tasks.filter(t=>t.projectId===proj.id&&t.launchNode).sort((a,b)=>(a.step||0)-(b.step||0));
// 자유 프로세스 트리(parentId) — 형제 위→아래 인계: 앞 형제 완료 + 직전 형제가 남이면 "내 차례"
const myReadyProcess=(D,uid)=>{
  const out=[];
  (D.projects||[]).forEach(p=>{
    if(p.templateId) return;   // 템플릿(출시)은 별도 처리
    const ts=(D.tasks||[]).filter(t=>t.projectId===p.id&&!t.isFixed);
    if(!ts.length) return;
    const kidsOf=(pid)=>ts.filter(t=>(t.parentId||null)===(pid||null)).sort((a,b)=>(a.seq||0)-(b.seq||0));
    const dd=(t)=>{const ks=ts.filter(x=>x.parentId===t.id);return ks.length?ks.every(dd):t.status==="done";};
    ts.forEach(t=>{
      if(t.assigneeId!==uid||dd(t)) return;
      const sibs=kidsOf(t.parentId||null);
      const idx=sibs.findIndex(x=>x.id===t.id);
      if(idx>0&&sibs.slice(0,idx).every(dd)&&sibs[idx-1].assigneeId!==uid) out.push({proj:p,task:t});
    });
  });
  return out;
};
const ST_COLOR={done:"#00C073",ready:"#F97316",wait:"#9CA3AF"};
// 자동화 실행 엔진 + 출시 인스턴스 생성은 ./launch.js로 추출(동작 동일 + 테스트 가능). applyAutomation·instantiateLaunch·AUTO_ACTOR import.
// 프로젝트 상세 — "구간(세그먼트) KPI": 로드단계(업무) 여러 개를 묶어 카운트형 KPI에 연결. 묶음 단계가 모두 done이면 그 KPI에 +1(집계는 recalcProg→skCur).
function SegmentEditor({D,proj,up}){
  const segs=Array.isArray(proj.segments)?proj.segments:[];
  const tasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed);
  const countKPIs=D.subKPIs.filter(s=>s.unit!=="원"&&s.unit!=="%"&&!s.launchCount);   // 카운트형 KPI(원/%·출시집계 제외)
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [picked,setPicked]=useState([]);
  const [kpiId,setKpiId]=useState(countKPIs[0]?.id||"");
  if(countKPIs.length===0||tasks.length===0) return null;   // 연결할 KPI나 단계가 없으면 숨김
  const doneIds=new Set(tasks.filter(t=>t.status==="done").map(t=>t.id));
  const kpiName=(id)=>D.subKPIs.find(s=>s.id===id)?.title||"미연결";
  const toggle=(id)=>setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const addSeg=()=>{ if(!name.trim()||!picked.length||!kpiId)return; up("projects",proj.id,{segments:[...segs,{id:"seg"+Date.now(),name:name.trim(),stageIds:picked,kpiId}]}); setName(""); setPicked([]); setOpen(false); };
  const rmSeg=(id)=>up("projects",proj.id,{segments:segs.filter(s=>s.id!==id)});
  const cln=(t)=>t.replace(/^\[[^\]]+\]\s*/,"");
  const inp={width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",fontSize:13};
  return(
    <div style={{padding:"14px 16px 0"}}>
      <p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:"#4B5563"}}>📊 구간 KPI <span style={{fontWeight:600,color:"#9CA3AF"}}>· 로드단계를 묶어 KPI 카운트</span></p>
      {segs.map(s=>{ const comp=Array.isArray(s.stageIds)&&s.stageIds.length>0&&s.stageIds.every(id=>doneIds.has(id)); const dn=(s.stageIds||[]).filter(id=>doneIds.has(id)).length; return(
        <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:10,border:`1px solid ${comp?"#BBF7D0":"#EEF0F2"}`,background:comp?"#F0FDF4":"#fff",marginBottom:6}}>
          <span style={{flexShrink:0,fontSize:10,fontWeight:800,color:comp?"#16A34A":"#9CA3AF",background:comp?"#DCFCE7":"#F3F4F6",padding:"2px 7px",borderRadius:6}}>{comp?"✓ 완료":`${dn}/${(s.stageIds||[]).length}`}</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div><div style={{fontSize:10.5,color:"#9CA3AF"}}>단계 {(s.stageIds||[]).length} → {kpiName(s.kpiId)}</div></div>
          <button onClick={()=>rmSeg(s.id)} style={{flexShrink:0,width:28,height:28,borderRadius:8,border:"1.5px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:14,fontWeight:700,cursor:"pointer"}}>×</button>
        </div>);})}
      {open?(
        <div style={{padding:12,borderRadius:12,border:"1.5px solid #FED7AA",background:"#FFFBF5",marginTop:2}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="구간명 예: 소싱·등록 완료" style={{...inp,marginBottom:9}}/>
          <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:"#6B7280"}}>묶을 단계 선택 ({picked.length})</p>
          <div style={{maxHeight:150,overflowY:"auto",marginBottom:9}}>
            {tasks.map(t=>{const on=picked.includes(t.id);return(
              <label key={t.id} onClick={()=>toggle(t.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:8,border:`1.5px solid ${on?"#FDBA74":"#EEF0F2"}`,background:on?"#FFF7ED":"#fff",cursor:"pointer",marginBottom:4}}>
                <span style={{flexShrink:0,width:16,height:16,borderRadius:5,border:`2px solid ${on?"#F97316":"#CBD3DD"}`,background:on?"#F97316":"#fff",color:"#fff",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{on?"✓":""}</span>
                <span style={{fontSize:12.5,fontWeight:600,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cln(t.title)}</span>
              </label>);})}
          </div>
          <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:"#6B7280"}}>연결할 KPI</p>
          <select value={kpiId} onChange={e=>setKpiId(e.target.value)} style={{...inp,backgroundColor:"#fff",WebkitAppearance:"none",marginBottom:10}}>{countKPIs.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <div style={{display:"flex",gap:7}}>
            <button onClick={()=>{setOpen(false);setName("");setPicked([]);}} style={{flex:"0 0 auto",padding:"9px 14px",borderRadius:10,border:"1.5px solid #E5E8EB",background:"#fff",color:"#6B7280",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
            <button onClick={addSeg} disabled={!name.trim()||!picked.length} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",background:(name.trim()&&picked.length)?"#F97316":"#E5E8EB",color:(name.trim()&&picked.length)?"#fff":"#9CA3AF",fontSize:13,fontWeight:800,cursor:(name.trim()&&picked.length)?"pointer":"not-allowed",fontFamily:"inherit"}}>구간 추가</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"9px 0",borderRadius:10,border:"1.5px dashed #FDBA74",background:"#FFF7ED",color:"#EA580C",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 구간 추가</button>
      )}
    </div>
  );
}
// 프로젝트 상세 안의 "단계 흐름(협업 인계)" 섹션 — 출시 SKU(launchNode) 인계 파이프라인. 일반 프로젝트는 로드맵에서 관리(중복 제거).
function ProjStageFlow({D,proj,cu,up}){
  const stageTasks=D.tasks.filter(t=>t.projectId===proj.id&&t.launchNode).sort((a,b)=>(a.step||0)-(b.step||0));
  const uName=(id)=>D.users.find(u=>u.id===id)?.name||"미배정";
  const uColor=(id)=>D.users.find(u=>u.id===id)?.color||"#9CA3AF";
  if(stageTasks.length===0) return null;   // 정리: 단계 흐름 적용 진입점 제거 — 일반 프로젝트는 🗺 로드맵의 로드단계·프로세스로 관리(중복 제거). 출시 SKU(launchNode)만 아래 파이프라인 표시
  const toggleStage=(t,st)=>{ if(st==="wait")return; up("tasks",t.id,statusPatch(D,t,t.status==="done"?"todo":"done")); };
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
const FLOW_ARROW="flowArrowHead";
const flowPath=(a,b,w,h)=>{const x1=a.x+w/2,y1=a.y+h,x2=b.x+w/2,y2=b.y;return `M ${x1} ${y1} C ${x1} ${y1+44}, ${x2} ${y2-44}, ${x2} ${y2}`;};
// n8n식 노드 캔버스 — 팬(빈공간 드래그)·줌(버튼/Ctrl휠)·노드 드래그·핸들 드래그로 연결·화살표. 편집/진행 공용.
// nodes:[{id,x,y,title,sub,color,status?,auto?,stepLabel?}] · edges:[{id,from,to}] · mode:"edit"|"progress"
function FlowView({nodes,edges,mode="progress",height=520,nodeW=NODE_W,nodeH=NODE_H,selectedId,onNodeTap,onNodeDragEnd,onConnect,onDeleteEdge,onNodeEdit}){
  const editable=mode==="edit";
  const wrapRef=useRef(null);
  const [view,setView]=useState({x:24,y:20,z:1});
  const panRef=useRef(null), dragRef=useRef(null), connRef=useRef(null);
  const [drag,setDrag]=useState(null);   // {id,x,y} 노드 이동 중
  const [conn,setConn]=useState(null);   // {from,cx,cy} 연결 드래그 중
  const [panning,setPanning]=useState(false);
  const byId=(id)=>nodes.find(n=>n.id===id);
  const liveNode=(n)=>(drag&&drag.id===n.id)?{...n,x:drag.x,y:drag.y}:n;
  const toWorld=(cx,cy)=>{const r=wrapRef.current.getBoundingClientRect();return {x:(cx-r.left-view.x)/view.z,y:(cy-r.top-view.y)/view.z};};
  const cap=(e)=>{try{wrapRef.current.setPointerCapture(e.pointerId);}catch(_){}};
  const onBgDown=(e)=>{ panRef.current={sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y}; setPanning(true); cap(e); };
  const onMove=(e)=>{
    if(connRef.current){ const w=toWorld(e.clientX,e.clientY); setConn(c=>c&&{...c,cx:w.x,cy:w.y}); return; }
    if(dragRef.current){ const w=toWorld(e.clientX,e.clientY); const d=dragRef.current; d.moved=true; setDrag({id:d.id,x:Math.max(0,Math.round(w.x-d.offX)),y:Math.max(0,Math.round(w.y-d.offY))}); return; }
    const p=panRef.current; if(!p)return; setView(v=>({...v,x:p.vx+(e.clientX-p.sx),y:p.vy+(e.clientY-p.sy)}));
  };
  const onUp=(e)=>{
    if(connRef.current){ const w=toWorld(e.clientX,e.clientY); const from=connRef.current.from; const t=nodes.find(n=>n.id!==from&&w.x>=n.x&&w.x<=n.x+nodeW&&w.y>=n.y&&w.y<=n.y+nodeH); connRef.current=null; setConn(null); if(t&&onConnect)onConnect(from,t.id); return; }
    if(dragRef.current){ const d=dragRef.current, dd=drag; dragRef.current=null; setDrag(null); if(d.moved&&onNodeDragEnd&&dd)onNodeDragEnd(d.id,dd.x,dd.y); else if(!d.moved){const n=byId(d.id); if(n&&onNodeTap)onNodeTap(n);} return; }
    panRef.current=null; setPanning(false);
  };
  const onNodeDown=(e,n)=>{
    if(!editable){ e.stopPropagation(); if(onNodeTap)onNodeTap(n); return; }   // 진행 모드: 탭 = 토글(팬 시작 안 함)
    e.stopPropagation(); const w=toWorld(e.clientX,e.clientY); dragRef.current={id:n.id,offX:w.x-n.x,offY:w.y-n.y,moved:false}; setDrag({id:n.id,x:n.x,y:n.y}); cap(e);
  };
  const onHandleDown=(e,n)=>{ if(!editable||!onConnect)return; e.stopPropagation(); const w=toWorld(e.clientX,e.clientY); connRef.current={from:n.id}; setConn({from:n.id,cx:w.x,cy:w.y}); cap(e); };
  const zoomBy=(f)=>{ const r=wrapRef.current.getBoundingClientRect(); const cx=r.width/2,cy=r.height/2; setView(v=>{const z=Math.min(1.6,Math.max(0.4,+(v.z*f).toFixed(2))); const k=z/v.z; return {z,x:cx-(cx-v.x)*k,y:cy-(cy-v.y)*k};}); };
  const ctrlBtn={width:30,height:30,borderRadius:9,border:"1px solid #E5E8EB",background:"#fff",color:"#374151",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",justifyContent:"center"};
  return(
    <div ref={wrapRef} onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp}
      style={{position:"relative",width:"100%",height,overflow:"hidden",borderRadius:16,border:"1px solid #EDF0F3",background:"#FAFBFC",backgroundImage:"radial-gradient(#E2E6EB 1px,transparent 1px)",backgroundSize:`${18*view.z}px ${18*view.z}px`,backgroundPosition:`${view.x}px ${view.y}px`,touchAction:"none",cursor:panning?"grabbing":"grab",userSelect:"none"}}>
      {nodes.length===0&&<p style={{position:"absolute",top:"45%",left:0,right:0,textAlign:"center",color:"#C4C9D0",fontSize:13,margin:0}}>표시할 단계가 없어요</p>}
      <div style={{position:"absolute",left:0,top:0,transformOrigin:"0 0",transform:`translate(${view.x}px,${view.y}px) scale(${view.z})`}}>
        <svg width={6000} height={6000} style={{position:"absolute",left:0,top:0,overflow:"visible",pointerEvents:"none"}}>
          <defs><marker id={FLOW_ARROW} markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#F97316"/></marker></defs>
          {edges.map(e=>{const a=byId(e.from),b=byId(e.to);if(!a||!b)return null;const A=liveNode(a),B=liveNode(b);const col=editable?"#F97316":(B.status?ST_COLOR[B.status]:"#94A3B8");return <path key={e.id} d={flowPath(A,B,nodeW,nodeH)} stroke={col} strokeWidth={2.5} fill="none" opacity={0.62} markerEnd={`url(#${FLOW_ARROW})`}/>;})}
          {conn&&(()=>{const a=byId(conn.from);if(!a)return null;const A=liveNode(a);return <path d={`M ${A.x+nodeW/2} ${A.y+nodeH} C ${A.x+nodeW/2} ${A.y+nodeH+44}, ${conn.cx} ${conn.cy-44}, ${conn.cx} ${conn.cy}`} stroke="#F97316" strokeWidth={2.5} strokeDasharray="5 4" fill="none" opacity={0.8}/>;})()}
        </svg>
        {editable&&onDeleteEdge&&edges.map(e=>{const a=byId(e.from),b=byId(e.to);if(!a||!b)return null;const A=liveNode(a),B=liveNode(b);const mx=(A.x+B.x)/2+nodeW/2-9,my=(A.y+nodeH+B.y)/2-9;return <button key={e.id} onPointerDown={ev=>{ev.stopPropagation();onDeleteEdge(e.id);}} title="연결 삭제" style={{position:"absolute",left:mx,top:my,width:18,height:18,borderRadius:"50%",border:"none",background:"#fff",boxShadow:"0 1px 5px rgba(0,0,0,0.22)",color:"#F04452",fontSize:12,fontWeight:900,cursor:"pointer",lineHeight:1,zIndex:7}}>×</button>;})}
        {nodes.map(n=>{const P=liveNode(n);const stc=n.status?ST_COLOR[n.status]:null;const seld=selectedId===n.id||(conn&&conn.from===n.id);const bd=seld?"#F97316":(stc||(n.color||"#94A3B8")+"66");return(
          <div key={n.id} onPointerDown={e=>onNodeDown(e,P)} style={{position:"absolute",left:P.x,top:P.y,width:nodeW,minHeight:nodeH,boxSizing:"border-box",padding:"8px 10px",borderRadius:12,background:n.status==="done"?"#F0FBF5":"#fff",border:`2px solid ${bd}`,boxShadow:seld?"0 0 0 3px #F9731633":"0 2px 8px rgba(0,0,0,0.08)",cursor:editable?"grab":"pointer",zIndex:seld?5:2}}>
            <span style={{position:"absolute",top:-6,left:nodeW/2-5,width:10,height:10,borderRadius:"50%",background:"#fff",border:`2px solid ${stc||"#CBD5E1"}`}}/>
            {onNodeEdit&&<button onPointerDown={e=>{e.stopPropagation();onNodeEdit(n);}} title="편집" style={{position:"absolute",top:-9,right:-9,width:20,height:20,borderRadius:"50%",border:"1px solid #E5E8EB",background:"#fff",color:"#6B7280",fontSize:10,cursor:"pointer",lineHeight:1,boxShadow:"0 1px 4px rgba(0,0,0,0.12)",zIndex:8}}>✎</button>}
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
              <span style={{flexShrink:0,width:18,height:18,borderRadius:"50%",background:stc||n.color||"#94A3B8",color:"#fff",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{n.status==="done"?"✓":(n.stepLabel||"")}</span>
              <span style={{flex:1,minWidth:0,fontSize:10,fontWeight:800,color:stc||n.color||"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.sub}</span>
              {n.auto&&<span title="자동화" style={{flexShrink:0,fontSize:10,fontWeight:900,color:"#EA580C"}}>⚡</span>}
              {n.chev&&<span style={{flexShrink:0,fontSize:11,fontWeight:900,color:"#6B7280"}}>{n.chev}</span>}
            </div>
            <p style={{margin:0,fontSize:11.5,fontWeight:700,color:n.status==="wait"?"#9CA3AF":"#1F2937",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{n.title}</p>
            {n.kidCount>0&&!n.chevOpen&&<span style={{position:"absolute",bottom:-8,right:8,fontSize:8.5,fontWeight:800,color:"#fff",background:n.color||"#94A3B8",borderRadius:8,padding:"0 6px",lineHeight:"16px"}}>하위 {n.kidCount}</span>}
            {editable&&onConnect
              ? <span onPointerDown={e=>onHandleDown(e,P)} title="드래그해서 다음 단계로 연결" style={{position:"absolute",bottom:-7,left:nodeW/2-7,width:14,height:14,borderRadius:"50%",background:"#fff",border:"2px solid #F97316",cursor:"crosshair",zIndex:6}}/>
              : <span style={{position:"absolute",bottom:-6,left:nodeW/2-5,width:10,height:10,borderRadius:"50%",background:"#fff",border:`2px solid ${stc||"#CBD5E1"}`}}/>}
          </div>
        );})}
      </div>
      <div style={{position:"absolute",right:10,bottom:10,display:"flex",flexDirection:"column",gap:6,zIndex:10}}>
        <button onPointerDown={e=>e.stopPropagation()} onClick={()=>zoomBy(1.2)} style={ctrlBtn}>＋</button>
        <button onPointerDown={e=>e.stopPropagation()} onClick={()=>zoomBy(1/1.2)} style={ctrlBtn}>－</button>
        <button onPointerDown={e=>e.stopPropagation()} onClick={()=>setView({x:24,y:20,z:1})} title="원위치" style={{...ctrlBtn,fontSize:13}}>⤢</button>
      </div>
      <span style={{position:"absolute",left:10,bottom:10,fontSize:10,fontWeight:700,color:"#AEB6BE",zIndex:10}}>{Math.round(view.z*100)}%{editable?" · 빈곳 드래그=이동 · 노드 ●드래그=연결":" · 빈곳 드래그=이동"}</span>
    </div>
  );
}
// ── 통합 캔버스: 엣지 기반 가로 레이어 자동배치 (depth=열, row=같은 열 순번) ──
const COL_STEP=212, ROW_STEP=238, PAD_X=26, PAD_Y=30;
function flowLayout(nodes,edges){
  const ids=(nodes||[]).map(n=>n.id), has=new Set(ids);
  const adj={}, indeg={}; ids.forEach(id=>{adj[id]=[];indeg[id]=0;});
  (edges||[]).forEach(e=>{ if(has.has(e.from)&&has.has(e.to)){ adj[e.from].push(e.to); indeg[e.to]++; }});
  const depth={}, indeg2={...indeg}; const queue=ids.filter(id=>!indeg[id]); queue.forEach(id=>depth[id]=0);
  for(let h=0;h<queue.length;h++){ const id=queue[h]; adj[id].forEach(t=>{ depth[t]=Math.max(depth[t]||0,(depth[id]||0)+1); if(--indeg2[t]===0)queue.push(t); }); }
  ids.forEach(id=>{ if(depth[id]==null)depth[id]=0; });
  const cols={}; ids.forEach(id=>{ (cols[depth[id]]=cols[depth[id]]||[]).push(id); });
  const pos={}; Object.keys(cols).forEach(d=>cols[d].forEach((id,r)=>{ pos[id]={col:+d,row:r,x:PAD_X+(+d)*COL_STEP,y:PAD_Y+r*ROW_STEP}; }));
  const maxCol=ids.length?Math.max(...ids.map(id=>depth[id])):0;
  const maxRow=Math.max(0,...Object.values(cols).map(a=>a.length-1));
  return {pos,maxCol,maxRow};
}
function LaunchPage({D,cu,lead,add,up,rm,nav}){
  const [tab,setTab]=useState("template");
  const [libDetail,setLibDetail]=useState(false);   // 라이브러리: false=카드목록, true=선택 프로세스 편집
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
  // 새 프로세스(종류 무관) — 빈 캔버스에 시작 단계 1개
  const addTemplate=()=>{ const nid="tpl"+Date.now(); const n0={id:"n"+(Date.now()+1),title:"1단계",roleLabel:"",assigneeId:cu.id,x:24,y:24}; add("launchTemplates",{id:nid,name:"새 프로세스",nodes:[n0],edges:[],version:1,createdAt:new Date().toISOString()}); setTplId(nid); setLibDetail(true); };
  const doRename=()=>{ if(renameVal.trim()) up("launchTemplates",tpl.id,{name:renameVal.trim()}); setRenameOpen(false); };
  // ── 프로세스 템플릿 버전관리 (로드맵 템플릿 v 패턴과 동일) ──
  const [showVer,setShowVer]=useState(false);
  const saveVersion=()=>{ if(!tpl)return; const curV=tpl.version||1; const note=(window.prompt(`v${curV}→v${curV+1} 변경 메모 (무엇이 개선됐나요?)`,"")||"").trim(); up("launchTemplates",tpl.id,{version:curV+1,versions:[...(tpl.versions||[]),{v:curV,nodes:(tpl.nodes||[]).map(n=>({...n})),edges:(tpl.edges||[]).map(e=>({...e})),savedAt:tpl.updatedAt||tpl.createdAt||"",note}],updatedAt:new Date().toISOString()}); window.alert(`📌 v${curV+1}로 저장했어요 (이전 v${curV}는 이력 보관)`); };
  const restoreVersion=(v)=>{ if(!tpl||!window.confirm(`v${v.v}로 되돌릴까요? 현재본(v${tpl.version||1})은 이력으로 보관돼요.`))return; const curV=tpl.version||1; up("launchTemplates",tpl.id,{nodes:(v.nodes||[]).map(n=>({...n})),edges:(v.edges||[]).map(e=>({...e})),version:curV+1,versions:[...(tpl.versions||[]),{v:curV,nodes:(tpl.nodes||[]).map(n=>({...n})),edges:(tpl.edges||[]).map(e=>({...e})),savedAt:tpl.updatedAt||tpl.createdAt||"",note:`v${v.v}로 되돌림`}],updatedAt:new Date().toISOString()}); setShowVer(false); };
  const delTpl=()=>{ if(tpls.length<=1){ window.alert("템플릿이 하나뿐이라 삭제할 수 없어요."); return; } if(window.confirm(`'${tpl.name}' 템플릿을 삭제할까요? (이미 만든 출시 건은 영향 없음)`)){ const next=tpls.find(t=>t.id!==tpl.id); rm("launchTemplates",tpl.id); setTplId(next?next.id:""); } };
  // ── 내 차례(ready) 집계 ──
  const myReady=[];
  launchProjs.forEach(p=>{ const ts=launchProjTasks(D,p); ts.forEach(t=>{ if(t.assigneeId===cu.id&&launchStageStatus(t,ts)==="ready") myReady.push({proj:p,task:t}); }); });
  const toggleStage=(t,st)=>{ if(st==="wait")return; up("tasks",t.id,statusPatch(D,t,t.status==="done"?"todo":"done")); };
  // ── 템플릿 캔버스 편집 ──
  const canvasRef=useRef(null);
  const draggingRef=useRef(null);
  const [draftNodes,setDraftNodes]=useState(tpl?tpl.nodes:[]);
  const [connectMode,setConnectMode]=useState(false);
  const [connectFrom,setConnectFrom]=useState(null);
  const [editNode,setEditNode]=useState(null);
  const [delEdge,setDelEdge]=useState(null);
  const [segSel,setSegSel]=useState(null);   // 선택된 구간(세그먼트) id
  // 노드 편집은 PC 전용(요청). 모바일/태블릿에선 보기만 — 드래그·탭편집·선연결·단계추가 비활성.
  const [isPC,setIsPC]=useState(typeof window!=="undefined"?window.innerWidth>=1024:true);
  useEffect(()=>{const h=()=>setIsPC(window.innerWidth>=1024);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  useEffect(()=>{ if(!draggingRef.current&&tpl) setDraftNodes(tpl.nodes); },[tpl]);
  const maxY=draftNodes.reduce((m,n)=>Math.max(m,n.y),0);
  // ── 통합 캔버스 자동배치(가로 흐름) + 매달린 액션/트리거 카드 계산 ──
  const LAY=flowLayout(draftNodes,tpl?tpl.edges:[]);
  const XY=(id)=>LAY.pos[id]||{x:PAD_X,y:PAD_Y};
  const canvasW=Math.max(560,PAD_X*2+(LAY.maxCol+1)*COL_STEP);
  const CW=152,CH=46,CGAP=11,CARD_TOP=30;
  const hangCards=[];
  draftNodes.forEach(n=>{ const acts=(n.auto&&Array.isArray(n.auto.onDone))?n.auto.onDone:[]; if(!acts.length)return;
    const b=XY(n.id); let cy=b.y+NODE_H+CARD_TOP;
    hangCards.push({id:n.id+"_t",nodeId:n.id,x:b.x,y:cy,kind:"trigger"}); cy+=CH+CGAP;
    acts.forEach((a,k)=>{ hangCards.push({id:n.id+"_a"+k,nodeId:n.id,x:b.x,y:cy,kind:"action",a}); cy+=CH+CGAP; }); });
  const maxHangY=hangCards.reduce((m,h)=>Math.max(m,h.y+CH),0);
  const editY=editNode?XY(editNode.id).y:0;
  const canvasH=Math.max(360,PAD_Y*2+(LAY.maxRow+1)*ROW_STEP,maxHangY+34,editNode?editY+460:0);   // 가로 레이어 + 매달린 카드 + 편집 공간
  const nodeById=(id)=>draftNodes.find(n=>n.id===id);
  const onNodeDown=(e,n)=>{
    if(!isPC) return;   // 모바일: 노드 편집 불가(보기 전용) — 드래그·탭편집 차단
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
  const addNode=()=>{ const id="n"+Date.now(); const nn={id,title:"새 단계",roleLabel:"",assigneeId:cu.id,x:24,y:maxY+NODE_H+24}; up("launchTemplates",tpl.id,{nodes:[...tpl.nodes,nn]}); setEditNode(nn); };
  // EdrawMind식: 선택 노드에서 하위 단계 추가 → 부모 편집 내용 저장 + 선행연결 + 새 노드 즉시 편집(한 번의 up으로 처리해 덮어쓰기 방지)
  const addChildWithPatch=(parent,patch)=>{ const id="n"+Date.now(); const child={id,title:"새 단계",roleLabel:"",assigneeId:parent.assigneeId||cu.id,x:parent.x,y:parent.y+NODE_H+44}; const nodes=tpl.nodes.map(x=>x.id===parent.id?{...x,...(patch||{})}:x).concat(child); up("launchTemplates",tpl.id,{nodes,edges:[...tpl.edges,{id:"e"+Date.now(),from:parent.id,to:id}]}); setEditNode(child); };
  const saveNode=(patch)=>{ up("launchTemplates",tpl.id,{nodes:tpl.nodes.map(n=>n.id===editNode.id?{...n,...patch}:n)}); setEditNode(null); };
  const deleteNode=()=>{ up("launchTemplates",tpl.id,{nodes:tpl.nodes.filter(n=>n.id!==editNode.id),edges:tpl.edges.filter(e=>e.from!==editNode.id&&e.to!==editNode.id)}); setEditNode(null); };
  const removeEdge=(eid)=>{ up("launchTemplates",tpl.id,{edges:tpl.edges.filter(e=>e.id!==eid)}); setDelEdge(null); };
  // ── 구간(세그먼트): 로드단계(노드) 묶음 → 카운트 KPI 연결. 템플릿에 저장 → 인스턴스 생성 시 task로 매핑되어 집계 ──
  const segments=Array.isArray(tpl&&tpl.segments)?tpl.segments:[];
  const countKPIs=D.subKPIs.filter(s=>s.launchCount||(s.unit!=="원"&&s.unit!=="%"));   // 카운트형(출시집계 포함, 원/% 제외)
  const segKpiName=(id)=>D.subKPIs.find(k=>k.id===id)?.title||"미연결";
  const circled=(n)=>(n>=1&&n<=20)?String.fromCharCode(0x2460+n-1):`(${n})`;
  const segAdd=()=>{ if(!tpl)return; const id="sg"+Date.now(); up("launchTemplates",tpl.id,{segments:[...segments,{id,name:"새 구간",nodeIds:[],kpiId:countKPIs[0]?.id||"",mode:"count",extractAt:"all"}]}); setSegSel(id); };
  const segPatch=(id,patch)=>up("launchTemplates",tpl.id,{segments:segments.map(s=>s.id===id?{...s,...patch}:s)});
  const segRm=(id)=>{ up("launchTemplates",tpl.id,{segments:segments.filter(s=>s.id!==id)}); setSegSel(null); };
  const segToggleNode=(id,nid)=>{ const s=segments.find(x=>x.id===id); if(!s)return; const has=(s.nodeIds||[]).includes(nid); segPatch(id,{nodeIds:has?(s.nodeIds||[]).filter(x=>x!==nid):[...(s.nodeIds||[]),nid]}); };
  const [flowMode,setFlowMode]=useState("flow");   // 진행 탭 인스턴스 보기: flow(노드 캔버스) | list(목록)
  const [newKpi,setNewKpi]=useState(null);   // 구간 패널에서 신규 하위KPI(카운트형) 인라인 생성: {seg,mainKPIId,title,target}
  const createKpiAndLink=(seg)=>{ if(!newKpi||!newKpi.title.trim()||!newKpi.mainKPIId)return; const id="sk_c"+Date.now(); const order=(D.subKPIs.filter(k=>k.mainKPIId===newKpi.mainKPIId).reduce((m,k)=>Math.max(m,k.order||0),0))+1; add("subKPIs",{id,mainKPIId:newKpi.mainKPIId,title:newKpi.title.trim(),targetValue:numF(newKpi.target)||0,currentValue:0,unit:"건",order,channelCode:""}); segPatch(seg.id,{kpiId:id}); setNewKpi(null); };
  // 출시 인스턴스 → FlowView 노드/엣지. 템플릿 노드 좌표가 있으면 그 배치, 없으면 step 순 세로 자동배치.
  const instFlow=(p)=>{
    const ts=launchProjTasks(D,p);
    const itpl=(D.launchTemplates||[]).find(t=>t.id===p.templateId);
    const taskByNode={}; ts.forEach(t=>{if(t.launchNode)taskByNode[t.launchNode]=t;});
    if(itpl&&(itpl.nodes||[]).some(n=>taskByNode[n.id])){
      const nodes=(itpl.nodes||[]).filter(n=>taskByNode[n.id]).map((n,i)=>{const t=taskByNode[n.id];return {id:t.id,x:n.x,y:n.y,title:t.title,sub:uName(t.assigneeId),color:uColor(t.assigneeId),status:launchStageStatus(t,ts),stepLabel:(t.step!=null?t.step+1:i+1),auto:t.autoComplete||((t.auto&&t.auto.onDone)||[]).length>0};});
      const edges=(itpl.edges||[]).map(e=>({id:e.id,from:taskByNode[e.from]?.id,to:taskByNode[e.to]?.id})).filter(e=>e.from&&e.to);
      return {nodes,edges};
    }
    const nodes=ts.map((t,i)=>({id:t.id,x:24,y:20+i*(NODE_H+40),title:t.title,sub:uName(t.assigneeId),color:uColor(t.assigneeId),status:launchStageStatus(t,ts),stepLabel:i+1,auto:t.autoComplete||((t.auto&&t.auto.onDone)||[]).length>0}));
    const idset=new Set(ts.map(t=>t.id));
    const edges=ts.flatMap(t=>(t.deps||[]).filter(d=>idset.has(d)).map(d=>({id:t.id+"_"+d,from:d,to:t.id})));
    return {nodes,edges};
  };
  return(
    <div style={{padding:"14px 16px 24px"}}>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"template",l:`🧩 프로세스 ${tpls.length}`},{k:"status",l:`🚀 진행 ${launchProjs.length}`}].map(v=>(
          <button key={v.k} onClick={()=>setTab(v.k)} style={{flex:1,padding:"9px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:tab===v.k?"#FFFFFF":"transparent",color:tab===v.k?"#0F1F5C":"#6B7280",fontWeight:tab===v.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:tab===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
        ))}
      </div>

      {tab==="status"&&(<>
        <Btn full variant="orange" onClick={openSku} style={{marginBottom:14}}>🚀 신규 SKU 출시</Btn>
        {launchProjs.length>0&&(
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <div style={{display:"inline-flex",background:"#F2F4F6",borderRadius:10,padding:3}}>
              {[{k:"flow",l:"🔀 흐름"},{k:"list",l:"📋 목록"}].map(v=>(
                <button key={v.k} onClick={()=>setFlowMode(v.k)} style={{padding:"6px 13px",borderRadius:8,border:"none",cursor:"pointer",background:flowMode===v.k?"#fff":"transparent",color:flowMode===v.k?"#0F1F5C":"#6B7280",fontWeight:flowMode===v.k?800:600,fontSize:12,fontFamily:"inherit",boxShadow:flowMode===v.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
              ))}
            </div>
          </div>
        )}
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
        {launchProjs.length===0?<Empty t="진행 중인 SKU가 없어요 · 신규 SKU 출시를 눌러 시작하세요"/>:launchProjs.map(p=>{
          const ts=launchProjTasks(D,p);
          const doneN=ts.filter(t=>t.status==="done").length;
          return(
            <div key={p.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",marginBottom:12,border:"1px solid #F2F4F6"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{minWidth:0}}>
                  <p style={{margin:0,fontSize:14.5,fontWeight:900,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📦 {p.productName||p.title}</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"#9CA3AF"}}>{doneN}/{ts.length} 단계 완료</p>
                </div>
                <span style={{fontSize:15,fontWeight:900,color:p.progress>=100?"#00C073":"#F97316",flexShrink:0}}><span style={{fontSize:9.5,fontWeight:800,color:"#9CA3AF",marginRight:4}}>선행지표</span>{p.progress||0}%</span>
              </div>
              <div style={{marginBottom:12}}><PBar value={p.progress||0} color={p.progress>=100?"#00C073":"#F97316"} h={5}/></div>
              {flowMode==="flow"?(()=>{const fg=instFlow(p);return(<FlowView mode="progress" height={Math.max(280,Math.min(560,(fg.nodes.reduce((m,n)=>Math.max(m,n.y),0))+NODE_H+80))} nodes={fg.nodes} edges={fg.edges} onNodeTap={node=>{const t=ts.find(x=>x.id===node.id);if(t)toggleStage(t,launchStageStatus(t,ts));}}/>);})():(
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
              </div>)}
              <button onClick={()=>{ if(window.confirm(`'${p.productName||p.title}' 출시 건을 삭제할까요? (단계 업무 포함)\n휴지통에서 복구할 수 있어요.`)){ launchProjTasks(D,p).forEach(t=>rm("tasks",t.id,true)); rm("projects",p.id,true); } }} style={{marginTop:10,fontSize:11,fontWeight:700,color:"#C4C9D0",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
            </div>
          );
        })}
      </>)}

      {tab==="template"&&!libDetail&&(<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}>
          <div>
            <h3 style={{margin:0,fontSize:15,fontWeight:900,color:"#0F1F5C"}}>🧩 프로세스 라이브러리</h3>
            <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>출시·영업·디자인·주문발주·소싱·반품… 표준 업무 흐름을 만들어 두고 재사용</p>
          </div>
          <button onClick={addTemplate} style={{flexShrink:0,padding:"9px 13px",borderRadius:10,border:"none",background:"#F97316",color:"#fff",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 새 프로세스</button>
        </div>
        <p style={{margin:"0 0 12px",fontSize:10.5,color:"#9CA3AF",lineHeight:1.5,background:"#F9FAFB",borderRadius:10,padding:"9px 12px"}}>만든 프로세스는 <b>로드맵 › 로드단계</b>에서 <b>🧩 프로세스 장착</b>으로 그 프로젝트의 실제 업무로 펼쳐집니다. (출시 프로세스는 <b>🚀 진행</b> 탭에서 SKU 단위로 실행)</p>
        {tpls.length===0?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <p style={{fontSize:36,margin:0}}>🧩</p>
            <p style={{margin:"10px 0 16px",fontSize:13,color:"#6B7280",lineHeight:1.6}}>아직 프로세스가 없어요.<br/>표준 단계 흐름을 만들어 팀이 재사용하세요.</p>
            <Btn variant="orange" onClick={addTemplate}>＋ 첫 프로세스 만들기</Btn>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {tpls.map(t=>{
              const stageUse=D.tasks.filter(x=>x.processId===t.id).length;
              const instUse=D.projects.filter(p=>p.templateId===t.id).length;
              const owners=[...new Set((t.nodes||[]).map(n=>n.roleLabel||uName(n.assigneeId)).filter(Boolean))].slice(0,3);
              return(
                <button key={t.id} onClick={()=>{setTplId(t.id);setLibDetail(true);}} style={{display:"block",width:"100%",textAlign:"left",background:"#fff",border:"1px solid #EAECEF",borderRadius:14,padding:"13px 14px",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:15}}>🧩</span>
                    <span style={{flex:1,minWidth:0,fontSize:14,fontWeight:900,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                    <span style={{flexShrink:0,fontSize:10,fontWeight:900,color:"#3730A3",background:"#E0E7FF",borderRadius:6,padding:"2px 7px"}}>v{t.version||1}</span>
                    <span style={{flexShrink:0,fontSize:14,color:"#C4C9D0"}}>›</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>단계 {(t.nodes||[]).length}</span>
                    {stageUse>0&&<span style={{fontSize:10.5,fontWeight:800,color:"#7C3AED",background:"#F3EFFE",borderRadius:6,padding:"2px 7px"}}>로드단계 장착 {stageUse}</span>}
                    {instUse>0&&<span style={{fontSize:10.5,fontWeight:800,color:"#EA580C",background:"#FFF1E7",borderRadius:6,padding:"2px 7px"}}>실행 {instUse}</span>}
                    {owners.length>0&&<span style={{fontSize:10.5,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {owners.join(" → ")}{(t.nodes||[]).length>owners.length?" …":""}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>)}

      {tab==="template"&&libDetail&&tpl&&(<>
          <button onClick={()=>setLibDetail(false)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 2px",marginBottom:8,background:"none",border:"none",color:"#6B7280",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>‹ 프로세스 목록</button>
          <h3 style={{margin:"0 0 10px",fontSize:15,fontWeight:900,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🧩 {tpl.name}</h3>
          <div style={{display:"flex",gap:7,marginBottom:12}}>
            <button onClick={dupTpl} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>⧉ 복제</button>
            <button onClick={()=>{setRenameVal(tpl.name);setRenameOpen(true);}} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>✎ 이름</button>
            <button onClick={delTpl} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #FFE2E5",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#F04452",cursor:"pointer",fontFamily:"inherit"}}>🗑 삭제</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,padding:"8px 11px",borderRadius:11,background:"#F5F8FF",border:"1px solid #DBE3FF"}}>
            <span style={{fontSize:11,fontWeight:900,color:"#3730A3",background:"#E0E7FF",borderRadius:6,padding:"2px 7px",flexShrink:0}}>v{tpl.version||1}</span>
            <span style={{flex:1,minWidth:0,fontSize:10.5,color:"#6B7280",fontWeight:600}}>단계 {(tpl.nodes||[]).length}{(tpl.versions||[]).length?` · 이력 ${(tpl.versions||[]).length}`:""}</span>
            <button onClick={saveVersion} style={{flexShrink:0,padding:"6px 10px",borderRadius:9,border:"none",background:"#3182F6",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📌 버전 저장</button>
            {(tpl.versions||[]).length>0&&<button onClick={()=>setShowVer(s=>!s)} style={{flexShrink:0,padding:"6px 9px",borderRadius:9,border:"1px solid #DBE3FF",background:showVer?"#E0E7FF":"#fff",color:"#4B5563",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📜 이력</button>}
          </div>
          {showVer&&(tpl.versions||[]).length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
              {(tpl.versions||[]).slice().reverse().map(v=>(
                <div key={v.v} style={{display:"flex",alignItems:"center",gap:8,background:"#F9FAFB",borderRadius:9,padding:"7px 10px"}}>
                  <span style={{fontSize:10.5,fontWeight:800,color:"#6B7280",flexShrink:0}}>v{v.v}</span>
                  <span style={{flex:1,minWidth:0,fontSize:10,color:"#9CA3AF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.note?`✏️ ${v.note}`:`단계 ${(v.nodes||[]).length} · ${(v.savedAt||"").slice(0,10)||"날짜없음"}`}</span>
                  <button onClick={()=>restoreVersion(v)} style={{flexShrink:0,padding:"4px 8px",borderRadius:7,border:"1px solid #DBE3FF",background:"#fff",color:"#3182F6",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>되돌리기</button>
                </div>
              ))}
            </div>
          )}
          <div style={{backgroundColor:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 13px",marginBottom:12}}>
            <p style={{margin:0,fontSize:11,color:"#B45309",lineHeight:1.5}}><b>노드를 탭</b>하면 그 자리에서 단계명·담당자·<b>⚡액션</b>을 바로 수정해요. 편집 카드의 <b>＋ 하위 단계</b>로 다음 단계를 잇고, 케이스가 다르면 <b>복제</b>해서 바꿔 쓰세요.</p>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button onClick={addNode} style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",backgroundColor:"#fff",fontSize:12.5,fontWeight:800,color:"#374151",cursor:"pointer",fontFamily:"inherit"}}>＋ 단계 추가</button>
          </div>
          <div style={{display:"flex",flexDirection:isPC?"row":"column",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,width:"100%"}}>
          <FlowView mode="edit"
            height={Math.max(440,Math.min(680,(draftNodes.reduce((m,n)=>Math.max(m,n.y),0))+NODE_H+110))}
            nodes={(tpl.nodes||[]).map((n,i)=>({id:n.id,x:n.x,y:n.y,title:n.title,sub:n.roleLabel||uName(n.assigneeId),color:uColor(n.assigneeId),auto:n.autoComplete||((n.auto&&n.auto.onDone)||[]).length>0,stepLabel:i+1}))}
            edges={tpl.edges||[]}
            selectedId={editNode?editNode.id:null}
            onNodeTap={node=>setEditNode((tpl.nodes||[]).find(z=>z.id===node.id))}
            onNodeDragEnd={(id,x,y)=>up("launchTemplates",tpl.id,{nodes:tpl.nodes.map(z=>z.id===id?{...z,x,y}:z)})}
            onConnect={(from,to)=>{const exists=(tpl.edges||[]).some(e=>(e.from===from&&e.to===to)||(e.from===to&&e.to===from));if(!exists)up("launchTemplates",tpl.id,{edges:[...(tpl.edges||[]),{id:"e"+Date.now(),from,to}]});}}
            onDeleteEdge={removeEdge}/>
          <p style={{margin:"10px 2px 0",fontSize:11,color:"#9CA3AF",lineHeight:1.6}}>● <b>노드 아래 점(●)을 드래그</b>해서 다음 단계로 연결&nbsp;·&nbsp;<b>노드 탭</b>하면 단계·담당자·<b style={{color:"#EA580C"}}>⚡자동화</b> 편집&nbsp;·&nbsp;<b>빈 곳 드래그</b>로 이동, <b>＋/－</b>로 확대.</p>
          </div>

          {/* ── 구간 KPI 설정 패널 (시안 v0.8 우측 카드) — 로드단계 묶음 → 카운트 KPI 연결 ── */}
          <div style={{width:isPC?348:"100%",flexShrink:0,boxSizing:"border-box",borderRadius:16,border:"1px solid #EEF0F2",background:"#fff",padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
              <span style={{fontSize:13.5,fontWeight:900,color:"#EA580C"}}>📊 구간 KPI</span>
              <span style={{fontSize:11,fontWeight:600,color:"#9CA3AF"}}>로드단계를 묶어 카운트 KPI에 연결</span>
            </div>
            {countKPIs.length===0
              ? <p style={{margin:"6px 0 0",fontSize:11.5,color:"#9CA3AF"}}>연결할 카운트형 KPI가 없어요. (출시 수·건수형 지표 필요)</p>
              : (<>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"8px 0 4px"}}>
                  {segments.map(s=>{ const on=segSel===s.id; return(
                    <button key={s.id} onClick={()=>setSegSel(on?null:s.id)} style={{padding:"6px 11px",borderRadius:9,border:`1.5px solid ${on?"#F97316":"#E5E8EB"}`,background:on?"#FFF7ED":"#fff",color:on?"#EA580C":"#4B5563",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{s.name} · {(s.nodeIds||[]).length}단계</button>
                  );})}
                  <button onClick={segAdd} style={{padding:"6px 11px",borderRadius:9,border:"1.5px dashed #FDBA74",background:"#FFFBF5",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>＋ 구간 추가</button>
                </div>
                {(()=>{ const s=segments.find(x=>x.id===segSel); if(!s) return <p style={{margin:"8px 2px 0",fontSize:11.5,color:"#9CA3AF"}}>구간을 선택하거나 <b>＋ 구간 추가</b>로 로드단계를 묶어보세요.</p>;
                  const fld={width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit",fontSize:13};
                  const lb={display:"block",fontSize:11,fontWeight:800,color:"#6B7280",margin:"12px 0 5px"};
                  return(
                  <div style={{marginTop:10,padding:12,borderRadius:14,border:"1.5px solid #FED7AA",background:"#FFFBF5"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span style={{fontSize:12.5,fontWeight:900,color:"#9A3412"}}>선택 구간 설정</span>
                      <button onClick={()=>segRm(s.id)} style={{padding:"4px 9px",borderRadius:8,border:"1.5px solid #FFE2E5",background:"#FFF0F1",color:"#F04452",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
                    </div>
                    <label style={{...lb,marginTop:8}}>구간 이름</label>
                    <input value={s.name} onChange={e=>segPatch(s.id,{name:e.target.value})} placeholder="예: 출시 준비 구간" style={fld}/>
                    <label style={lb}>포함 단계 <span style={{color:"#9CA3AF",fontWeight:600}}>· 탭해서 묶기 ({(s.nodeIds||[]).length})</span></label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {draftNodes.map((n,i)=>{ const on=(s.nodeIds||[]).includes(n.id); return(
                        <button key={n.id} onClick={()=>segToggleNode(s.id,n.id)} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${on?"#F97316":"#E5E8EB"}`,background:on?"#FFEDD5":"#fff",color:on?"#EA580C":"#6B7280",fontSize:11.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{circled(i+1)} {n.title}</button>
                      );})}
                    </div>
                    <label style={lb}>연결 KPI</label>
                    <div style={{display:"flex",gap:6,alignItems:"stretch"}}>
                      <select value={s.kpiId||""} onChange={e=>segPatch(s.id,{kpiId:e.target.value})} style={{...fld,flex:1,minWidth:0,background:"#fff",WebkitAppearance:"none"}}>
                        <option value="">선택</option>
                        {countKPIs.map(k=>{const mk=D.mainKPIs.find(m=>m.id===k.mainKPIId);return <option key={k.id} value={k.id}>{k.title}{mk?` (${mk.krKey})`:""}</option>;})}
                      </select>
                      <button onClick={()=>setNewKpi(newKpi&&newKpi.seg===s.id?null:{seg:s.id,mainKPIId:(D.mainKPIs.find(m=>m.unit!=="원")||D.mainKPIs[0]||{}).id||"",title:"",target:""})} style={{flexShrink:0,padding:"0 12px",borderRadius:10,border:"1.5px dashed #FDBA74",background:"#FFFBF5",color:"#EA580C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>＋ 새 KPI</button>
                    </div>
                    {newKpi&&newKpi.seg===s.id&&(
                      <div style={{marginTop:8,padding:11,borderRadius:12,border:"1.5px solid #BFDBFE",background:"#F5F9FF"}}>
                        <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#2563EB"}}>＋ 새 하위 KPI <span style={{fontWeight:600,color:"#9CA3AF"}}>· 카운트(건수)형 — 이 구간 100% 완료 시 +1</span></p>
                        <label style={lb}>상위 메인 KPI</label>
                        <select value={newKpi.mainKPIId} onChange={e=>setNewKpi({...newKpi,mainKPIId:e.target.value})} style={{...fld,background:"#fff",WebkitAppearance:"none"}}>{D.mainKPIs.filter(mk=>mk.unit!=="원").map(mk=><option key={mk.id} value={mk.id}>{mk.krKey} · {mk.title}</option>)}</select>
                        <p style={{margin:"5px 2px 0",fontSize:10,color:"#9CA3AF",lineHeight:1.4}}>※ 카운트형 KPI는 매출(원) 메인엔 연결할 수 없어요(매출 집계 오염 방지). 운영·건수형 메인에 연결됩니다.</p>
                        <label style={lb}>지표 이름</label>
                        <input value={newKpi.title} onChange={e=>setNewKpi({...newKpi,title:e.target.value})} placeholder="예: 신규 입점처 수" style={fld}/>
                        <label style={lb}>목표 (건)</label>
                        <input value={newKpi.target} onChange={e=>setNewKpi({...newKpi,target:e.target.value.replace(/[^0-9]/g,"")})} inputMode="numeric" placeholder="예: 30" style={fld}/>
                        <div style={{display:"flex",gap:7,marginTop:10}}>
                          <button onClick={()=>setNewKpi(null)} style={{flex:"0 0 auto",padding:"9px 14px",borderRadius:10,border:"1.5px solid #E5E8EB",background:"#fff",color:"#6B7280",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                          <button onClick={()=>createKpiAndLink(s)} disabled={!newKpi.title.trim()||!newKpi.mainKPIId} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",background:(newKpi.title.trim()&&newKpi.mainKPIId)?"#2563EB":"#E5E8EB",color:(newKpi.title.trim()&&newKpi.mainKPIId)?"#fff":"#9CA3AF",fontSize:13,fontWeight:800,cursor:(newKpi.title.trim()&&newKpi.mainKPIId)?"pointer":"not-allowed",fontFamily:"inherit"}}>만들고 연결</button>
                        </div>
                      </div>
                    )}
                    <label style={lb}>집계 방식</label>
                    <div style={{display:"flex",gap:7}}>
                      <button onClick={()=>segPatch(s.id,{mode:"count"})} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",background:(s.mode||"count")==="count"?"#0F1F5C":"#EEF0F2",color:(s.mode||"count")==="count"?"#fff":"#9CA3AF",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>완료 시 +1</button>
                      <button disabled title="다음 단계에서 지원" style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #E5E8EB",background:"#fff",color:"#CBD3DD",fontSize:12.5,fontWeight:800,cursor:"not-allowed",fontFamily:"inherit"}}>진척률 <span style={{fontSize:9}}>(준비중)</span></button>
                    </div>
                    <label style={lb}>언제 추출</label>
                    <div style={{...fld,background:"#fff",color:"#374151",fontWeight:700}}>구간 100% — 묶은 단계가 모두 완료되면</div>
                    <div style={{marginTop:11,display:"flex",alignItems:"center",gap:7,padding:"9px 11px",borderRadius:10,background:"#EAFBF1",border:"1px solid #BBF7D0"}}>
                      <span style={{fontSize:13}}>📊</span>
                      <span style={{fontSize:11.5,fontWeight:800,color:"#15803D"}}>구간 100% → {segKpiName(s.kpiId)} +1</span>
                    </div>
                    <div style={{marginTop:8,padding:"9px 11px",borderRadius:10,background:"#F0FDF4",border:"1px solid #DCFCE7"}}>
                      <p style={{margin:0,fontSize:11,color:"#16653A",lineHeight:1.55}}>♡ <b>기존 KPI 안전</b> — 구간 KPI는 같은 파생 카운트로만 <b>+</b>됩니다. 매출 등 기존 집계는 한 줄도 안 건드려요(구간 없으면 결과 동일).</p>
                    </div>
                  </div>
                  );})()}
              </>)}
          </div>
          </div>
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

      {/* 단계(노드) 편집 시트 — n8n식 캔버스에서 노드 탭 시 열림 */}
      <Sheet open={!!editNode} onClose={()=>setEditNode(null)} title="🧩 단계 편집" h="92vh">
        {editNode&&<NodeEditForm node={editNode} users={D.users} onSave={saveNode} onDelete={deleteNode} onAddChild={(patch)=>addChildWithPatch(editNode,patch)}/>}
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
function NodeEditForm({node,users,onSave,onDelete,onAddChild}){
  const [f,setF]=useState({title:node.title||"",roleLabel:node.roleLabel||"",assigneeId:node.assigneeId||users[0]?.id,
    autoComplete:!!node.autoComplete,
    onDone:Array.isArray(node.auto&&node.auto.onDone)?node.auto.onDone.map(a=>({...a})):[]});
  const addAction=()=>setF({...f,onDone:[...f.onDone,{id:"a"+Date.now(),kind:"createTask",title:"",assigneeId:""}]});
  const upAction=(i,p)=>setF({...f,onDone:f.onDone.map((a,k)=>k===i?{...a,...p}:a)});
  const rmAction=(i)=>setF({...f,onDone:f.onDone.filter((_,k)=>k!==i)});
  const curPatch=()=>({title:f.title.trim()||node.title||"새 단계",roleLabel:f.roleLabel.trim(),assigneeId:f.assigneeId,autoComplete:f.autoComplete,auto:{onDone:f.onDone.filter(a=>a.kind==="advance"||(a.title||"").trim()).map(a=>({id:a.id,kind:a.kind||"createTask",title:(a.title||"").trim(),assigneeId:a.assigneeId||""}))}});
  const lbl={display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5};
  const inp={width:"100%",padding:"12px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  return(
    <div style={{marginTop:8}}>
      <label style={lbl}>단계명 *</label>
      <input value={f.title} onChange={e=>setF({...f,title:e.target.value})} style={{...inp,marginBottom:14}}/>
      <label style={lbl}>역할 라벨 <span style={{color:"#9CA3AF",fontWeight:600}}>(예: MD·본부장 · 비우면 담당자명 표시)</span></label>
      <input value={f.roleLabel} onChange={e=>setF({...f,roleLabel:e.target.value})} placeholder="" style={{...inp,marginBottom:14}}/>
      <label style={lbl}>담당자</label>
      <select value={f.assigneeId} onChange={e=>setF({...f,assigneeId:e.target.value})} style={{...inp,backgroundColor:"#fff",WebkitAppearance:"none",marginBottom:18}}>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>

      {/* ⚡ 자동화 — 설정 없으면 동작 안 함(기존과 동일). 있으면 완료 전이 시 엔진이 실행. 라벨로 트리거→액션 구조를 명시(동작 동일). */}
      <div style={{borderTop:"1px dashed #E5E8EB",paddingTop:14,marginBottom:6}}>
        <p style={{margin:"0 0 10px",fontSize:12.5,fontWeight:900,color:"#EA580C"}}>⚡ 자동화 <span style={{fontWeight:600,color:"#9CA3AF"}}>(선택 · 안 켜면 수동 그대로)</span></p>
        {/* 트리거(언제) — 현재는 완료 트리거. 시간 트리거는 고정업무로 안내 */}
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
          <span style={{flexShrink:0,fontSize:10,fontWeight:900,color:"#9CA3AF",letterSpacing:0.3}}>언제(트리거)</span>
          <span style={{padding:"6px 11px",borderRadius:9,backgroundColor:"#FFF7ED",border:"1.5px solid #FED7AA",color:"#EA580C",fontSize:12,fontWeight:800}}>⏱ 이 단계가 완료되면</span>
        </div>
        <label onClick={()=>setF({...f,autoComplete:!f.autoComplete})} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:11,border:`1.5px solid ${f.autoComplete?"#FED7AA":"#E5E8EB"}`,backgroundColor:f.autoComplete?"#FFF7ED":"#fff",cursor:"pointer",marginBottom:12}}>
          <span style={{flexShrink:0,width:18,height:18,borderRadius:6,border:`2px solid ${f.autoComplete?"#F97316":"#CBD3DD"}`,backgroundColor:f.autoComplete?"#F97316":"#fff",color:"#fff",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{f.autoComplete?"✓":""}</span>
          <span style={{fontSize:12.5,fontWeight:700,color:"#374151",lineHeight:1.4}}>🤖 자동 단계 <span style={{color:"#9CA3AF",fontWeight:600}}>— 앞 단계가 모두 끝나면 사람 없이 자동 완료</span></span>
        </label>
        <label style={lbl}>무엇을(액션) <span style={{color:"#9CA3AF",fontWeight:600}}>· 완료되면 자동 생성할 업무</span></label>
        {f.onDone.map((a,i)=>(
          <div key={a.id||i} style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
            <select value={a.kind||"createTask"} onChange={e=>upAction(i,{kind:e.target.value})} style={{...inp,width:"auto",flexShrink:0,padding:"10px 8px",fontSize:12,fontWeight:700,backgroundColor:"#fff",WebkitAppearance:"none"}}>
              <option value="createTask">업무 생성</option>
              <option value="notify">🔔 알림</option>
              <option value="advance">⏭ 다음 단계로</option>
            </select>
            {a.kind==="advance"
              ? <span style={{flex:1,fontSize:11.5,color:"#9CA3AF",fontWeight:600,paddingLeft:2}}>앞 단계 끝나면 다음 단계 자동 진행</span>
              : <>
                  <input value={a.title} onChange={e=>upAction(i,{title:e.target.value})} placeholder={a.kind==="notify"?"예: 승인 요청 알림":"예: 민지 검수"} style={{...inp,flex:1,minWidth:0,padding:"10px 12px",fontSize:13}}/>
                  <select value={a.assigneeId||""} onChange={e=>upAction(i,{assigneeId:e.target.value})} style={{...inp,width:"auto",flexShrink:0,padding:"10px 10px",fontSize:13,backgroundColor:"#fff",WebkitAppearance:"none"}}><option value="">담당자</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
                </>}
            <button onClick={()=>rmAction(i)} style={{flexShrink:0,width:34,height:38,borderRadius:10,border:"1.5px solid #FFE2E5",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:15,fontWeight:700,cursor:"pointer"}}>×</button>
          </div>
        ))}
        <button onClick={addAction} style={{width:"100%",padding:"10px 0",borderRadius:11,border:"1.5px dashed #BFDBFE",backgroundColor:"#EFF6FF",color:"#2563EB",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>＋ 액션 추가</button>
        <p style={{margin:"0 0 8px",fontSize:10.5,color:"#9CA3AF",lineHeight:1.5}}>💡 매주·매월 같은 <b>시간 트리거</b>는 [📌 고정업무]에서 설정해요.</p>
      </div>

      {onAddChild&&<button onClick={()=>onAddChild(curPatch())} style={{width:"100%",padding:"11px 0",borderRadius:11,border:"1.5px solid #FDBA74",background:"#FFF7ED",color:"#EA580C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>＋ 하위 단계 잇기</button>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onDelete} style={{flex:"0 0 auto",padding:"13px 16px",borderRadius:12,border:"1.5px solid #FFE2E5",backgroundColor:"#FFF0F1",color:"#F04452",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>
        <Btn full variant="orange" onClick={()=>f.title.trim()&&onSave(curPatch())} disabled={!f.title.trim()} style={{flex:1}}>저장</Btn>
      </div>
    </div>
  );
}
// ───────────── 프로세스 에디터 (미리보기) — 키보드 아웃라이너 + 실시간 마인드맵 + 세부업무 ─────────────
function ProcessEditorPage({D}){
  const MEM=[{id:"",name:"미배정",color:"#9CA3AF"},...(D.users||[])];
  const Mof=(id)=>MEM.find(m=>m.id===id)||MEM[0];
  const u=(n)=>D.users[n]?.id||"";
  const [mode,setMode]=useState("team");   // team(협업) | solo(개인)
  const [items,setItems]=useState([
    {id:"s1",text:"소싱·원가·납기 확정",depth:0,who:u(0),done:true,memo:""},
    {id:"s2",text:"제품 교육·지식 전파",depth:0,who:u(0),done:false,memo:""},
    {id:"s3",text:"소스 확보 → 상품 등록",depth:0,who:u(1),done:false,memo:""},
    {id:"s4",text:"썸네일·상세 디자인",depth:1,who:u(1),done:true,memo:""},
    {id:"s5",text:"마켓 동시 등록",depth:1,who:u(1),done:false,memo:""},
    {id:"s6",text:"출시 배너·주문 세팅",depth:0,who:u(3),done:false,memo:""},
    {id:"s7",text:"B2B 안내·실사용 콘텐츠",depth:0,who:u(2),done:false,memo:""},
  ]);
  const [selId,setSelId]=useState("s3");
  const focusRef=useRef(null), uidRef=useRef(0), outRef=useRef(null);
  useEffect(()=>{ if(!focusRef.current)return; const {id,caret}=focusRef.current; focusRef.current=null; const inp=outRef.current&&outRef.current.querySelector(`input[data-id="${id}"]`); if(inp){inp.focus(); const c=caret==null?inp.value.length:caret; try{inp.setSelectionRange(c,c);}catch(_){}} });
  const sel=items.find(x=>x.id===selId);
  const newId=()=>"n"+Date.now()+(++uidRef.current);
  const patch=(id,p)=>setItems(it=>it.map(x=>x.id===id?{...x,...p}:x));
  const toggleDone=(id)=>setItems(it=>it.map(x=>x.id===id?{...x,done:!x.done}:x));
  const hasKid=(i)=>i+1<items.length&&items[i+1].depth>items[i].depth;
  const parentIdx=(i)=>{for(let k=i-1;k>=0;k--){if(items[k].depth===items[i].depth-1)return k;if(items[k].depth<items[i].depth-1)return -1;}return -1;};
  const indent=(i,dir)=>{const arr=[...items];const it=arr[i];if(dir<0){if(it.depth>0)arr[i]={...it,depth:it.depth-1};}else{const prev=arr[i-1];if(prev&&it.depth<=prev.depth)arr[i]={...it,depth:it.depth+1};}setItems(arr);};
  const onKey=(e,i)=>{const it=items[i];
    if(e.key==="Enter"){e.preventDefault();const nid=newId();const arr=[...items];arr.splice(i+1,0,{id:nid,text:"",depth:it.depth,who:it.who,done:false,memo:""});setItems(arr);setSelId(nid);focusRef.current={id:nid};}
    else if(e.key==="Tab"){e.preventDefault();indent(i,e.shiftKey?-1:1);focusRef.current={id:it.id,caret:e.target.selectionStart};}
    else if(e.key===" "&&e.target.value===""){e.preventDefault();indent(i,1);focusRef.current={id:it.id};}
    else if(e.key==="Backspace"&&e.target.value===""&&items.length>1){e.preventDefault();const p=items[i-1]||items[0];setItems(items.filter((_,k)=>k!==i));setSelId(p.id);focusRef.current={id:p.id};}
  };
  const team=mode==="team";
  const doneN=items.filter(x=>x.done).length, prog=items.length?Math.round(doneN/items.length*100):0;
  // 마인드맵 자동 배치
  const pos={}; {let yc=0;const colW=168,rowH=44,padX=14,padY=12;
    const place=(i)=>{const kids=[];for(let k=i+1;k<items.length;k++){if(items[k].depth<=items[i].depth)break;if(items[k].depth===items[i].depth+1)kids.push(k);}if(!kids.length){pos[i]={x:padX+items[i].depth*colW,y:padY+yc*rowH};yc++;}else{const ys=[];kids.forEach(k=>{place(k);ys.push(pos[k].y);});pos[i]={x:padX+items[i].depth*colW,y:(Math.min(...ys)+Math.max(...ys))/2};}};
    items.forEach((it,i)=>{if(it.depth===0)place(i);});}
  let mx=0,my=0;Object.values(pos).forEach(p=>{mx=Math.max(mx,p.x);my=Math.max(my,p.y);});
  return(
    <div style={{padding:"14px 16px 24px"}}>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",color:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
        <p style={{margin:0,fontSize:15,fontWeight:900}}>📋 프로세스 만들기 <span style={{fontSize:10,fontWeight:800,background:"rgba(255,255,255,0.2)",padding:"2px 8px",borderRadius:8}}>미리보기</span></p>
        <div style={{display:"flex",gap:6,marginTop:10}}>
          {[["team","👥 팀 협업"],["solo","🙋 개인"]].map(([k,l])=>(
            <button key={k} onClick={()=>setMode(k)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",background:mode===k?"#fff":"rgba(255,255,255,0.14)",color:mode===k?"#0F1F5C":"#fff",fontWeight:800,fontSize:12.5,fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <p style={{margin:"9px 0 0",fontSize:10.5,opacity:0.85,lineHeight:1.6}}>{team?"단계마다 담당자 지정 → 인계(앞 단계 끝나면 다음 차례). 체크=진행률, 기여도는 단계 단위.":"혼자 하는 계층형 체크리스트. 담당자·인계 없이 체크만."}<br/><b>Enter</b> 같은 단계 · <b>Space</b>(빈칸) 하위 · 행 <b>◂▸</b> 상위·하위 · <b>Backspace</b>(빈칸) 삭제</p>
      </div>

      {/* 진행률 */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <span style={{fontSize:11.5,fontWeight:800,color:"#4B5563",flexShrink:0}}>진행률</span>
        <div style={{flex:1,height:8,borderRadius:8,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:prog+"%",height:"100%",background:prog>=100?"#00C073":"#F97316",borderRadius:8}}/></div>
        <span style={{fontSize:13,fontWeight:900,color:prog>=100?"#00C073":"#F97316",flexShrink:0}}>{doneN}/{items.length} · {prog}%</span>
      </div>

      {/* 아웃라이너 (= 업무 트리, 체크 가능) */}
      <div style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"12px 10px",marginBottom:14}} ref={outRef}>
        {items.map((it,i)=>{const m=Mof(it.who);const isSel=it.id===selId;return(
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:6,marginLeft:it.depth*20,padding:"3px 6px",borderRadius:9,backgroundColor:isSel?"#FFF7ED":"transparent"}}>
            <button onClick={()=>indent(i,-1)} style={{border:"none",background:"none",color:"#C4C9D0",fontSize:13,cursor:"pointer",padding:"2px 2px"}}>◂</button>
            <button onClick={()=>indent(i,1)} style={{border:"none",background:"none",color:"#C4C9D0",fontSize:13,cursor:"pointer",padding:"2px 2px"}}>▸</button>
            <button onClick={()=>toggleDone(it.id)} style={{width:19,height:19,borderRadius:6,border:`2px solid ${it.done?"#00C073":"#D1D5DB"}`,background:it.done?"#00C073":"#fff",color:"#fff",fontSize:11,fontWeight:900,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{it.done?"✓":""}</button>
            {team&&<span style={{width:18,height:18,borderRadius:"50%",backgroundColor:m.color,color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{gname(m.name)}</span>}
            <input data-id={it.id} value={it.text} placeholder={hasKid(i)?"단계명...":"업무 입력..."} onChange={e=>patch(it.id,{text:e.target.value})} onFocus={()=>setSelId(it.id)} onKeyDown={e=>onKey(e,i)} style={{flex:1,minWidth:0,border:"none",background:"none",fontSize:13.5,fontWeight:hasKid(i)?800:600,color:it.done?"#9CA3AF":"#1F2937",textDecoration:it.done?"line-through":"none",outline:"none",fontFamily:"inherit",padding:"5px 2px"}}/>
          </div>
        );})}
      </div>

      {/* 마인드맵 */}
      <p style={{margin:"0 2px 6px",fontSize:12,fontWeight:900,color:"#0F1F5C"}}>🧠 {team?"협업 흐름 지도":"내 작업 지도"} <span style={{fontWeight:600,color:"#9CA3AF",fontSize:10.5}}>(자동 · 노드 탭하면 아래 편집)</span></p>
      <div style={{overflowX:"auto",backgroundColor:"#FAFBFC",backgroundImage:"radial-gradient(#E5E8EB 1px,transparent 1px)",backgroundSize:"18px 18px",border:"1px solid #EDF0F3",borderRadius:14,marginBottom:14}}>
        <div style={{position:"relative",width:mx+200,height:my+70}}>
          <svg width={mx+200} height={my+70} style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"visible"}}>
            {items.map((it,i)=>{const pi=parentIdx(i);if(pi<0||!pos[pi]||!pos[i])return null;const x1=pos[pi].x+140,y1=pos[pi].y+15,x2=pos[i].x,y2=pos[i].y+15;return <path key={it.id} d={`M ${x1} ${y1} C ${x1+34} ${y1}, ${x2-34} ${y2}, ${x2} ${y2}`} stroke="#F9731688" strokeWidth={2} fill="none"/>;})}
          </svg>
          {items.map((it,i)=>{const m=Mof(it.who);const isSel=it.id===selId;return(
            <div key={it.id} onClick={()=>setSelId(it.id)} style={{position:"absolute",left:pos[i].x,top:pos[i].y,display:"flex",alignItems:"center",gap:6,maxWidth:150,backgroundColor:it.done?"#E8FAF1":"#fff",border:`2px solid ${isSel?"#F97316":it.done?"#00C073":"#E5E8EB"}`,borderRadius:11,padding:"6px 10px",boxShadow:isSel?"0 0 0 3px rgba(249,115,22,0.2)":"0 2px 8px rgba(0,0,0,0.07)",cursor:"pointer",fontSize:12,fontWeight:700,zIndex:isSel?3:2}}>
              {it.done?<span style={{color:"#00C073",fontWeight:900,flexShrink:0}}>✓</span>:team&&<span style={{width:16,height:16,borderRadius:"50%",backgroundColor:m.color,color:"#fff",fontSize:8.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{gname(m.name)}</span>}
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:it.done?"#059669":"#1F2937"}}>{it.text||"단계"}</span>
            </div>
          );})}
        </div>
      </div>

      {/* 세부 편집 */}
      {sel&&(
        <div style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"14px 16px"}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:900,color:"#0F1F5C"}}>✏️ {hasKid(items.indexOf(sel))?"단계":"업무"} 세부</p>
          <input value={sel.text} onChange={e=>patch(sel.id,{text:e.target.value})} style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:14,fontWeight:700,outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:12}}/>
          {team&&(<>
            <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"#4B5563"}}>담당자 <span style={{fontWeight:600,color:"#9CA3AF"}}>(인계 대상)</span></p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {MEM.map(m=>{const on=sel.who===m.id;return(<button key={m.id||"none"} onClick={()=>patch(sel.id,{who:m.id})} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:20,border:`1.5px solid ${on?m.color:"#E5E8EB"}`,background:on?m.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><span style={{width:16,height:16,borderRadius:"50%",backgroundColor:m.color,color:"#fff",fontSize:8.5,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{gname(m.name)}</span><span style={{fontSize:12,fontWeight:700,color:on?m.color:"#4B5563"}}>{m.name}</span></button>);})}
            </div>
          </>)}
          <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"#4B5563"}}>메모</p>
          <textarea value={sel.memo} onChange={e=>patch(sel.id,{memo:e.target.value})} placeholder="주의사항·참고..." style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid #E5E8EB",fontSize:13,resize:"vertical",minHeight:46,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          <p style={{margin:"10px 2px 0",fontSize:10.5,color:"#9CA3AF",lineHeight:1.6}}>※ 하위로 만든 항목이 이 단계의 <b>세부 업무(체크리스트)</b>입니다. 별도 데이터 아님 — <b>체크=진행률</b>{team?", 기여도는 단계 단위로 집계":""}.</p>
        </div>
      )}
    </div>
  );
}
// 업무 보드 — 팀 전체 현황 뷰 (담당자별 진행률·업무 상태·내 차례)
function TeamBoard({D,cu,nav}){
  const sig=diagSignals(D);
  const today=todayDay(); const todayIdx=WEEK_DAYS.indexOf(today);
  const mem=D.users.map(u=>{
    const projs=D.projects.filter(p=>p.assigneeId===u.id);
    const tasks=D.tasks.filter(t=>!t.isFixed&&t.assigneeId===u.id);
    const done=tasks.filter(t=>t.status==="done").length;
    const inprog=tasks.filter(t=>t.status==="inprogress").length;
    const rev=projs.reduce((a,p)=>a+numF(p.resultValue),0);
    let ready=0; D.projects.filter(p=>p.templateId).forEach(p=>{const ts=launchProjTasks(D,p);ts.forEach(t=>{if(t.assigneeId===u.id&&launchStageStatus(t,ts)==="ready")ready++;});});
    ready+=myReadyProcess(D,u.id).length;   // 출시 인계 + 프로세스 인계 모두
    const carry=D.tasks.filter(t=>t.assigneeId===u.id&&!t.isFixed&&t.status!=="done"&&t.status!=="hold"&&t.weekDay&&t.weekDay!==today&&(()=>{const i=WEEK_DAYS.indexOf(t.weekDay);return i>=0&&(todayIdx<0||i<todayIdx);})()).length;   // 밀림: 이번 주 앞 요일 배치인데 미완
    return {u,projN:projs.length,done,total:tasks.length,inprog,ready,carry,rev,stuck:sig.stuckMembers.has(u.id),prog:tasks.length?Math.round(done/tasks.length*100):0};
  });
  const allT=D.tasks.filter(t=>!t.isFixed), allDone=allT.filter(t=>t.status==="done").length;
  const teamProg=allT.length?Math.round(allDone/allT.length*100):0;
  // 최종목표(매출 10억) 대비 — 미팅 오프닝 앵커
  const goal=D.goals&&D.goals[0];
  const goalCur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
  const goalPct=pct(goalCur,goal?.targetValue||1);
  // 팀 프로젝트 횡단 현황 (적체순) — 팀 현황 메뉴에서 흡수
  const CC=[["todo","미완료","#EA580C"],["inprogress","진행중","#3182F6"],["done","완료","#00A862"],["hold","보류","#FF9500"]];
  const projsList=D.projects.filter(p=>D.tasks.some(t=>t.projectId===p.id&&!t.isFixed))
    .map(p=>{const ts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);const c={todo:0,inprogress:0,done:0,hold:0};ts.forEach(t=>{if(c[t.status]!=null)c[t.status]++;});const allDoneP=ts.length>0&&ts.every(t=>t.status==="done");return{p,c,allDone:allDoneP,open:c.todo+c.inprogress};})
    .sort((a,b)=>(a.allDone?1:0)-(b.allDone?1:0)||b.open-a.open||(b.p.progress||0)-(a.p.progress||0));
  const [tbView,setTbView]=useState("members");   // 팀보드 보기: members(팀원별) | kpi(KPI별 — 누가 무엇을 겹쳐서)
  const uName=(id)=>D.users.find(u=>u.id===id)?.name||"미배정";
  const uColor=(id)=>D.users.find(u=>u.id===id)?.color||"#9CA3AF";
  const kpiPivot=D.mainKPIs.map(mk=>{ const projs=D.projects.filter(p=>p.mainKPIId===mk.id); const byU={}; projs.forEach(p=>{const ids=[...new Set([p.assigneeId||"",...(p.collaboratorIds||[])])]; ids.forEach(u=>{(byU[u]=byU[u]||[]).push({p,role:u===(p.assigneeId||"")?"담당":"협업"});});}); return {mk,projs,byU,kp:pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue),col:({mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"}[mk.id]||"#3182F6")}; }).filter(x=>x.projs.length);
  return(
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:16,padding:"16px",marginBottom:14,color:"#fff"}}>
        <p style={{margin:0,fontSize:12,fontWeight:800,opacity:0.8}}>🎯 최종목표 · {goal?.title||"매출 10억"}</p>
        <p style={{margin:"4px 0 10px",fontSize:24,fontWeight:900}}>{goalPct}% <span style={{fontSize:13,fontWeight:700,opacity:0.85}}>목표 달성률</span></p>
        <div style={{height:9,borderRadius:8,background:"rgba(255,255,255,0.2)",overflow:"hidden"}}><div style={{width:goalPct+"%",height:"100%",background:"#F97316",borderRadius:8}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"9px 0 0",flexWrap:"wrap",gap:6}}>
          <p style={{margin:0,fontSize:11.5,fontWeight:700,opacity:0.92}}>매출 {fmt(goalCur,"원")} / {fmt(goal?.targetValue||0,"원")}</p>
          <p style={{margin:0,fontSize:11,opacity:0.78}}>업무 {allDone}/{allT.length} 완료 · 프로젝트 {D.projects.length} · 팀원 {D.users.length}</p>
        </div>
      </div>
      <div style={{display:"flex",background:"#F2F4F6",borderRadius:12,padding:3,marginBottom:14}}>
        {[["members","👥 팀원별"],["kpi","🎯 KPI별 (누가 무엇을)"]].map(([k,l])=>(<button key={k} onClick={()=>setTbView(k)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",background:tbView===k?"#fff":"transparent",color:tbView===k?"#0F1F5C":"#6B7280",fontWeight:tbView===k?800:600,fontSize:12.5,fontFamily:"inherit",boxShadow:tbView===k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{l}</button>))}
      </div>
      {tbView==="kpi"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:4}}>
          {kpiPivot.length===0?<p style={{textAlign:"center",color:"#B0B8C1",fontSize:12,padding:"16px 0"}}>연결된 KPI가 없어요</p>:kpiPivot.map(({mk,byU,col,kp})=>(
            <div key={mk.id} style={{backgroundColor:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"13px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:10,fontWeight:900,color:"#fff",background:col,padding:"2px 8px",borderRadius:20}}>{mk.krKey}</span>
                <span style={{flex:1,minWidth:0,fontSize:13.5,fontWeight:900,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mk.title}</span>
                <span style={{fontSize:10.5,fontWeight:800,color:"#6B7280"}}>팀원 {Object.keys(byU).length}</span>
                <span style={{fontSize:13,fontWeight:900,color:col}}>{kp}%</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {Object.keys(byU).map(uid=>{const ps=byU[uid];const c=uColor(uid);return(
                  <div key={uid||"none"} style={{display:"flex",gap:9,padding:"8px 10px",borderRadius:10,background:"#F9FAFB",border:"1px solid #EEF1F4"}}>
                    <Ava name={uName(uid)} color={c} size={26}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:"0 0 5px",fontSize:12,fontWeight:800,color:"#111827"}}>{uName(uid)} <span style={{fontWeight:600,color:"#9CA3AF"}}>· {ps.length}건</span></p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {ps.map(({p,role})=>{const ts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);const dn=ts.filter(t=>t.status==="done").length;return(
                          <span key={p.id} style={{fontSize:10.5,fontWeight:700,color:"#374151",background:"#fff",border:`1px solid ${c}33`,borderRadius:7,padding:"3px 8px",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{role==="협업"?<span style={{color:"#9CA3AF",fontWeight:800}}>협업·</span>:null}{p.title}{ts.length?` · ${dn}/${ts.length}`:""}{numF(p.resultValue)>0?` · 💰${fmt(p.resultValue,"원")}`:""}</span>
                        );})}
                      </div>
                    </div>
                  </div>
                );})}
              </div>
            </div>
          ))}
        </div>
      )}
      {tbView==="members"&&(<>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {mem.map(m=>(
          <div key={m.u.id} style={{backgroundColor:"#fff",borderRadius:14,border:`1px solid ${m.stuck?"#FFD7DC":m.u.id===cu.id?"#FED7AA":"#F2F4F6"}`,padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
              <Ava name={m.u.name} color={m.u.color} size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:14,fontWeight:900,color:"#111827"}}>{m.u.name}{m.u.id===cu.id&&<span style={{fontSize:10,color:"#EA580C",fontWeight:700}}> (나)</span>}{m.stuck&&<span title={SIGNAL_LABEL.stuck} style={{marginLeft:5,fontSize:11}}>🔴</span>}</p>
                <p style={{margin:"1px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{m.u.dept} · 프로젝트 {m.projN}개</p>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
                {m.rev>0&&<span style={{fontSize:10.5,fontWeight:800,color:"#7A3E00",background:"#FFE6C7",borderRadius:8,padding:"3px 8px"}}>💰{fmt(m.rev,"원")}</span>}
                {m.carry>0&&<span title="밀림(앞 요일 배치 미완)" style={{fontSize:10.5,fontWeight:800,color:"#F04452",background:"#FFF0F1",borderRadius:8,padding:"3px 8px"}}>⏰ 밀림 {m.carry}</span>}
                {m.ready>0&&<span style={{fontSize:10.5,fontWeight:800,color:"#fff",background:"#F97316",borderRadius:8,padding:"3px 8px"}}>🔔 내 차례 {m.ready}</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
              <div style={{flex:1,height:6,borderRadius:6,background:"#F2F4F6",overflow:"hidden"}}><div style={{width:m.prog+"%",height:"100%",background:m.prog>=70?"#00C073":m.u.color,borderRadius:6}}/></div>
              <span style={{fontSize:12,fontWeight:900,color:m.u.color,flexShrink:0}}>{m.prog}%</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <span style={{fontSize:10.5,fontWeight:700,color:"#3182F6",background:"#EBF3FF",borderRadius:6,padding:"2px 8px"}}>진행중 {m.inprog}</span>
              <span style={{fontSize:10.5,fontWeight:700,color:"#00C073",background:"#E8FAF1",borderRadius:6,padding:"2px 8px"}}>완료 {m.done}</span>
              <span style={{fontSize:10.5,fontWeight:700,color:"#6B7280",background:"#F2F4F6",borderRadius:6,padding:"2px 8px"}}>전체 {m.total}</span>
            </div>
          </div>
        ))}
      </div>
      </>)}
      <div style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px",margin:"14px 0 0",border:"1px solid #F2F4F6"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:900,color:"#0F1F5C"}}>📁 팀 프로젝트 현황 ({projsList.length})</h3>
          {nav&&<button onClick={()=>nav("projects")} style={{padding:"5px 10px",borderRadius:8,border:"1px solid #E5E8EB",background:"#fff",fontSize:11,fontWeight:700,color:"#6B7280",cursor:"pointer",fontFamily:"inherit"}}>전체 →</button>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {projsList.length===0?<p style={{margin:0,padding:"10px 0",textAlign:"center",fontSize:12,color:"#B0B8C1"}}>진행 중인 프로젝트가 없어요</p>:projsList.map(({p,c,allDone:ad})=>{const asg=D.users.find(u=>u.id===p.assigneeId);const prog=p.progress||0;return(
            <div key={p.id} style={{padding:"11px 12px",borderRadius:12,border:"1px solid #EEF1F4",background:"#F9FAFB"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <Ava name={asg?.name} color={asg?.color} size={22}/>
                <span style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:800,color:"#0F1F5C",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                <span style={{flexShrink:0,fontSize:10,fontWeight:800,color:ad?"#00A862":"#3182F6",background:ad?"#E8FAF1":"#EBF3FF",borderRadius:6,padding:"2px 7px"}}>{ad?"완료":"진행"}</span>
                <span style={{flexShrink:0,fontSize:12,fontWeight:900,color:prog>=70?"#00C073":"#3182F6"}}>{prog}%</span>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:7,flexWrap:"wrap"}}>{CC.map(([k,l,col])=><span key={k} style={{fontSize:10.5,fontWeight:700,color:c[k]>0?col:"#C4C9D0"}}>{l} {c[k]}</span>)}</div>
              <PBar value={prog} color={prog>=70?"#00C073":"#3182F6"} h={5}/>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
// 업무 보드 — 팀 그로스보드 (기간 필터 · 멤버별 활동색 + 성과). 개인 그로스보드과 동일한 색·배지 언어.
function TeamWeeklyMap({D,cu}){
  const [period,setPeriod]=useState("week");
  const [mapStyle,setMapStyle]=useState("tree");   // tree(계층형) | mind(마인드맵)
  const [krF,setKrF]=useState("all");
  const [activeOnly,setActiveOnly]=useState(false);
  const [memSel,setMemSel]=useState(null);   // null=전체 / Set=선택 멤버
  const [showFilters,setShowFilters]=useState(false);  // 범례·KR·멤버 필터 접기(기본 접힘)
  const [picked,setPicked]=useState(null);
  const [diagOpen,setDiagOpen]=useState(false);
  const prange=periodRange(period);
  const pprev=prevPeriodRange(period);
  const inP=(ds)=>{if(!ds)return false;const d=new Date(ds);return !isNaN(d)&&d>=prange[0]&&d<=prange[1];};
  const inPrev=(ds)=>{if(!ds)return false;const d=new Date(ds);return !isNaN(d)&&d>=pprev[0]&&d<=pprev[1];};
  const activeInP=(t)=>inP(t.workDate)||inP(t.doneAt)||(period==="week"&&!!(t.weekDay&&WEEK_DAYS.includes(t.weekDay)));
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  const doneInP=(ts)=>ts.filter(t=>t.status==="done"&&inP(t.doneAt)).length;
  const signals=diagSignals(D);
  const PLABEL=PERIOD_LABEL;
  const toggleMem=(id)=>setMemSel(prev=>{const base=prev?new Set(prev):new Set(D.users.map(u=>u.id));if(base.has(id))base.delete(id);else base.add(id);if(base.size>=D.users.length||base.size===0)return null;return base;});
  const krOk=(p)=>krF==="all"||(p&&p.mainKPIId===krF);
  const allMem=D.users.filter(u=>!memSel||memSel.has(u.id)).map(u=>{
    const projs=D.projects.filter(p=>p.assigneeId===u.id&&krOk(p));
    const projIds=new Set(projs.map(p=>p.id));
    const tasks=D.tasks.filter(t=>!t.isFixed&&t.assigneeId===u.id&&(krF==="all"||projIds.has(t.projectId)));
    const rev=projs.reduce((a,p)=>a+numF(p.resultValue),0);
    const active=tasks.some(activeInP);
    const doneP=doneInP(tasks);
    const donePrev=tasks.filter(t=>t.status==="done"&&inPrev(t.doneAt)).length;
    const inprog=tasks.filter(t=>t.status==="inprogress").length;
    return {u,tasks,projN:projs.length,rev,active,doneP,donePrev,inprog,stuck:signals.stuckMembers.has(u.id)};
  });
  const mem=allMem.filter(m=>!activeOnly||m.active);
  // 요약 KPI는 필터(KR·멤버)는 반영하되 '활동만 보기'(표시 declutter)에는 영향받지 않도록 allMem 기준
  const activeMembers=allMem.filter(m=>m.active).length;
  const teamDone=allMem.reduce((a,m)=>a+m.doneP,0);
  const teamDonePrev=allMem.reduce((a,m)=>a+m.donePrev,0);
  const teamDelta=teamDone-teamDonePrev;
  const teamRev=allMem.reduce((a,m)=>a+m.rev,0);
  // 최종목표(매출 10억) 대비 — 미팅 앵커 (필터 무관 절대값)
  const goal=D.goals&&D.goals[0];
  const goalCur=D.mainKPIs.filter(mk=>mk.unit==="원").reduce((s,mk)=>s+mkCur(mk,D.subKPIs,D.projects),0);
  const goalPct=pct(goalCur,goal?.targetValue||1);
  // 팀 진단 요약 (이번 달 기준) — 막힘·적체·헛심
  const diag=diagData(D,nowMonth());
  const stuckMem=diag.mem.filter(m=>m.stuck);
  const jamN=diag.jamN, heotN=diag.heotN;   // 전체 카운트(상위6 슬라이스 아님)
  const diagTotal=stuckMem.length+jamN+heotN;
  return(
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        {PERIODS.map(([k,l])=>{const on=period===k;return(<button key={k} onClick={()=>setPeriod(k)} style={{flex:"1 0 auto",padding:"7px 10px",borderRadius:9,border:`1.5px solid ${on?"#0F1F5C":"#E5E8EB"}`,background:on?"#0F1F5C":"#fff",color:on?"#fff":"#6B7280",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
        <button onClick={()=>setShowFilters(s=>!s)} style={{flexShrink:0,padding:"7px 10px",borderRadius:9,border:`1.5px solid ${showFilters||krF!=="all"||activeOnly||memSel?"#F97316":"#E5E8EB"}`,background:showFilters?"#FFF4EC":"#fff",color:showFilters||krF!=="all"||activeOnly||memSel?"#EA580C":"#9CA3AF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🔧 필터{showFilters?" ▴":" ▾"}</button>
      </div>
      {showFilters&&<div style={{display:"flex",gap:12,marginBottom:10,padding:"8px 14px",backgroundColor:"#FFFFFF",borderRadius:10,border:"1px solid #F2F4F6",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#F97316"}}/><span style={{fontSize:11,color:"#4B5563",fontWeight:600}}>활동</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#D1D5DB"}}/><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>비활동</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:10.5,fontWeight:800,color:"#00A862",background:"#E8FAF1",borderRadius:5,padding:"1px 6px"}}>✅성과</span><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>완료·매출</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11}}>🔴🧱💸</span><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>막힘·적체·헛심</span></div>
      </div>}
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:16,padding:"15px 16px",marginBottom:12,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <span style={{fontSize:12,fontWeight:800,opacity:0.82}}>🎯 최종목표 · {goal?.title||"매출 10억"}</span>
          <span style={{fontSize:18,fontWeight:900}}>{goalPct}%</span>
        </div>
        <div style={{height:8,borderRadius:8,background:"rgba(255,255,255,0.2)",overflow:"hidden",marginBottom:4}}><div style={{width:goalPct+"%",height:"100%",background:"#F97316",borderRadius:8}}/></div>
        <p style={{margin:"0 0 11px",fontSize:11,fontWeight:700,opacity:0.85}}>매출 {fmt(goalCur,"원")} / {fmt(goal?.targetValue||0,"원")}</p>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.16)",paddingTop:10}}>
          <p style={{margin:"0 0 5px",fontSize:11,fontWeight:800,opacity:0.7}}>이 기간({PLABEL[period]})</p>
          <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap"}}>
            <span style={{fontSize:16,fontWeight:900}}>활동 멤버 {activeMembers}/{allMem.length}</span>
            <span style={{fontSize:11,fontWeight:800,color:"#D1F5E0",background:"rgba(0,200,115,0.22)",borderRadius:8,padding:"2px 8px"}}>✅완료 {teamDone}</span>
            <span style={{fontSize:11,fontWeight:800,color:teamDelta>0?"#D1F5E0":teamDelta<0?"#FFD7DC":"rgba(255,255,255,0.7)",background:"rgba(255,255,255,0.14)",borderRadius:8,padding:"2px 8px"}}>{teamDelta>0?`▲${teamDelta}`:teamDelta<0?`▼${-teamDelta}`:"–"} vs {PREV_LABEL[period]}</span>
            <span style={{fontSize:11,fontWeight:800,color:"#FFE6C7",background:"rgba(249,115,22,0.25)",borderRadius:8,padding:"2px 8px"}}>💰{fmt(teamRev,"원")}</span>
          </div>
        </div>
      </div>
      <div onClick={()=>setDiagOpen(true)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"11px 14px",borderRadius:12,cursor:"pointer",background:diagTotal>0?"#FFF7F7":"#F6FBF8",border:`1px solid ${diagTotal>0?"#FFD7DC":"#CFEFDD"}`}}>
        <span style={{fontSize:16,flexShrink:0}}>🩺</span>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:12.5,fontWeight:900,color:"#0F1F5C"}}>팀 진단 {diagTotal>0?<span style={{color:"#F04452"}}>· 점검 {diagTotal}</span>:<span style={{color:"#00A862"}}>· 특이신호 없음</span>}</p>
          <p style={{margin:"2px 0 0",fontSize:10.5,color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            🔴 막힘 {stuckMem.length}{stuckMem.length?`(${stuckMem.map(m=>m.u.name).join("·")})`:""} · 🧱 적체 {jamN} · 💸 헛심 {heotN}
          </p>
        </div>
        <span style={{fontSize:11,fontWeight:800,color:"#9CA3AF",flexShrink:0}}>자세히 ›</span>
      </div>
      {showFilters&&(<>
      <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
        {[["all","전체"],...D.mainKPIs.map(m=>[m.id,m.krKey])].map(([k,l])=>{const on=krF===k;return(<button key={k} onClick={()=>setKrF(k)} style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${on?"#0F1F5C":"#E5E8EB"}`,background:on?"#0F1F5C":"#fff",color:on?"#fff":"#6B7280",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
        <button onClick={()=>setActiveOnly(!activeOnly)} style={{marginLeft:"auto",padding:"5px 11px",borderRadius:20,border:`1.5px solid ${activeOnly?"#F97316":"#E5E8EB"}`,background:activeOnly?"#FFF4EC":"#fff",color:activeOnly?"#EA580C":"#9CA3AF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{activeOnly?"✓ 활동만":"활동만"}</button>
      </div>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,fontWeight:700,color:"#9CA3AF"}}>멤버</span>
        {D.users.map(u=>{const on=!memSel||memSel.has(u.id);return(<button key={u.id} onClick={()=>toggleMem(u.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px 3px 4px",borderRadius:20,border:`1.5px solid ${on?u.color:"#E5E8EB"}`,background:on?u.color+"14":"#fff",color:on?u.color:"#C4C9D0",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:on?1:0.6}}><Ava name={u.name} color={u.color} size={16}/>{gname(u.name)}</button>);})}
        {memSel&&<button onClick={()=>setMemSel(null)} style={{padding:"3px 9px",borderRadius:20,border:"1.5px solid #E5E8EB",background:"#fff",color:"#6B7280",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>전체</button>}
      </div>
      </>)}
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:11,padding:3,marginBottom:12}}>
        {[{k:"tree",l:"≡ 계층형"},{k:"mind",l:"🧠 마인드맵"}].map(v=>(
          <button key={v.k} onClick={()=>setMapStyle(v.k)} style={{flex:1,padding:"7px 0",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:mapStyle===v.k?"#FFFFFF":"transparent",color:mapStyle===v.k?"#0F1F5C":"#6B7280",fontWeight:mapStyle===v.k?800:500,fontSize:12.5,fontFamily:"inherit",boxShadow:mapStyle===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
        ))}
      </div>
      {mapStyle==="mind"&&(<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>exportMapPNG(buildTeamMapItems(D,activeInP,doneInP,{krF,activeOnly,members:memSel,signals}),`팀_그로스보드_${PLABEL[period]}`)} style={{padding:"6px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🖼 이미지 저장</button>
        </div>
        <MapCanvas items={buildTeamMapItems(D,activeInP,doneInP,{krF,activeOnly,members:memSel,signals})} onPick={setPicked}/>
      </>)}
      {mapStyle==="tree"&&(
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {mem.map(m=>{
          const col=m.u.color||"#3182F6";
          const hasContent=D.projects.some(p=>p.assigneeId===m.u.id&&(krF==="all"||p.mainKPIId===krF));
          return(
            <div key={m.u.id} style={{backgroundColor:"#fff",borderRadius:14,border:`1px solid ${m.active?col+"55":"#F2F4F6"}`,padding:"12px 13px"}}>
              <div onClick={()=>setPicked({ref:{kind:"member",id:m.u.id}})} style={{display:"flex",alignItems:"center",gap:10,marginBottom:hasContent?12:4,cursor:"pointer"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <Ava name={m.u.name} color={m.u.color} size={36}/>
                  <div style={{position:"absolute",right:-1,bottom:-1,width:11,height:11,borderRadius:"50%",border:"2px solid #fff",backgroundColor:m.active?col:"#D1D5DB"}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:13.5,fontWeight:900,color:"#111827"}}>{m.u.name}{m.u.id===cu.id&&<span style={{fontSize:10,color:"#EA580C",fontWeight:700}}> (나)</span>}{m.stuck&&<span title={SIGNAL_LABEL.stuck} style={{marginLeft:5,fontSize:10}}>🔴</span>}</p>
                  <p style={{margin:"1px 0 0",fontSize:10.5,color:"#9CA3AF"}}>{m.u.dept} · 프로젝트 {m.projN}개</p>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {m.inprog>0&&<span style={{fontSize:10,fontWeight:800,color:"#3182F6",background:"#EBF3FF",borderRadius:8,padding:"2px 7px"}}>진행 {m.inprog}</span>}
                  {m.doneP>0&&<span style={{fontSize:10,fontWeight:800,color:"#0F5132",background:"#D1F5E0",borderRadius:8,padding:"2px 7px"}}>✅{m.doneP}</span>}
                  {m.rev>0&&<span style={{fontSize:10,fontWeight:800,color:"#7A3E00",background:"#FFE6C7",borderRadius:8,padding:"2px 7px"}}>💰{fmt(m.rev,"원")}</span>}
                </div>
              </div>
              {hasContent?(
                <div style={{borderTop:"1px solid #F2F4F6",paddingTop:12}}>
                  <WeeklyTree D={D} sel={m.u.id} isThisWeek={activeInP} doneInP={doneInP} krColors={krColors} krF={krF} activeOnly={activeOnly} signals={signals} onPick={setPicked}/>
                </div>
              ):(
                <p style={{margin:"2px 2px 0",fontSize:11.5,color:"#C4C9D0",fontWeight:600}}>담당 KR 프로젝트가 없어요</p>
              )}
            </div>
          );
        })}
      </div>
      )}
      {mem.length===0&&<p style={{textAlign:"center",color:"#D1D5DB",fontSize:13,padding:"24px 0"}}>표시할 멤버가 없어요 (필터 조정)</p>}
      <NodeDetail D={D} node={picked} period={period} onClose={()=>setPicked(null)}/>
      <Sheet open={diagOpen} onClose={()=>setDiagOpen(false)} title="🩺 팀 진단" h="88vh"><div style={{marginTop:4}}><TeamDiagnose D={D} cu={cu}/></div></Sheet>
    </div>
  );
}
// 진단 데이터(이번 달 기준) — 완료는 이번 달, 미완은 현재
const diagData=(D,month)=>{
  const parentIds=new Set((D.tasks||[]).filter(t=>t.parentId).map(t=>t.parentId));
  const leaf=t=>!t.isFixed&&!parentIds.has(t.id);
  const inMonth=t=>(t.doneAt||"").slice(0,7)===month;
  const mem=(D.users||[]).map(u=>{const ts=(D.tasks||[]).filter(t=>leaf(t)&&t.assigneeId===u.id);const open=ts.filter(t=>t.status!=="done").length;const doneM=ts.filter(t=>t.status==="done"&&inMonth(t)).length;const rate=(doneM+open)?Math.round(doneM/(doneM+open)*100):0;return {u,open,doneM,rate,stuck:open>=3&&rate<50};}).sort((a,b)=>b.open-a.open);
  const projStuckAll=(D.projects||[]).map(p=>{const ts=(D.tasks||[]).filter(t=>leaf(t)&&t.projectId===p.id);const open=ts.filter(t=>t.status!=="done").length;return {p,total:ts.length,open};}).filter(x=>x.open>0).sort((a,b)=>b.open-a.open);
  const heotsimAll=(D.projects||[]).filter(p=>p.mainKPIId==="mk1"||p.mainKPIId==="mk2").map(p=>{const ts=(D.tasks||[]).filter(t=>leaf(t)&&t.projectId===p.id);return {p,doneM:ts.filter(t=>t.status==="done"&&inMonth(t)).length,rev:numF(p.resultValue)};}).filter(x=>x.doneM>=3&&x.rev===0).sort((a,b)=>b.doneM-a.doneM);
  // 리스트는 상위 6개만 표시, 카운트(jamN/heotN)는 전체 — 요약 배지 언더카운트 방지
  return {mem,projStuck:projStuckAll.slice(0,6),heotsim:heotsimAll.slice(0,6),jamN:projStuckAll.length,heotN:heotsimAll.length};
};
// 진단 신호를 맵 노드에 얹기 위한 빠른 룩업(이번 달 기준) — 막힘(멤버)·적체/헛심(프로젝트)
const diagSignals=(D)=>{
  const {mem,projStuck,heotsim}=diagData(D,nowMonth());
  return {
    stuckMembers:new Set(mem.filter(m=>m.stuck).map(m=>m.u.id)),
    jamProjects:new Set(projStuck.map(x=>x.p.id)),
    heotsimProjects:new Set(heotsim.map(x=>x.p.id)),
  };
};
const SIGNAL_ICON={stuck:"🔴",jam:"🧱",heotsim:"💸"};
const SIGNAL_LABEL={stuck:"막힘·과부하",jam:"적체",heotsim:"헛심(완료>매출0)"};
// 회고용 진단 자동요약 텍스트
const diagSummary=(D,month)=>{
  const {mem,projStuck,heotsim}=diagData(D,month);
  const lines=[]; const stuck=mem.filter(m=>m.stuck);
  if(stuck.length) lines.push("· 막힘: "+stuck.map(m=>`${m.u.name}(미완 ${m.open}·완료율 ${m.rate}%)`).join(", "));
  if(projStuck.length) lines.push("· 적체: "+projStuck.slice(0,3).map(x=>`${x.p.title}(미완 ${x.open}/${x.total})`).join(", "));
  if(heotsim.length) lines.push("· 헛심(완료>매출0): "+heotsim.slice(0,3).map(x=>`${x.p.title}(완료 ${x.doneM})`).join(", "));
  return lines.length?`[${month} 진단 자동요약]\n${lines.join("\n")}\n`:`[${month} 진단] 특이 신호 없음 (또는 데이터 부족)\n`;
};
// 팀 진단 — 업무 데이터로 막힘·적체·헛심을 읽고 프로세스 개선(평가 아님·진단용)
function TeamDiagnose({D,cu}){
  const month=nowMonth();
  const {mem,projStuck,heotsim}=diagData(D,month);
  const Card=({icon,title,desc,action,children})=>(
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #F2F4F6",padding:"14px 15px",marginBottom:12}}>
      <p style={{margin:0,fontSize:13.5,fontWeight:900,color:"#0F1F5C"}}>{icon} {title}</p>
      <p style={{margin:"3px 0 10px",fontSize:10.5,color:"#9CA3AF",lineHeight:1.5}}>{desc}</p>
      {children}
      <p style={{margin:"10px 0 0",fontSize:10.5,fontWeight:800,color:"#EA580C"}}>→ {action}</p>
    </div>
  );
  return(
    <div>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",borderRadius:14,padding:"13px 15px",marginBottom:14,color:"#fff"}}>
        <p style={{margin:0,fontSize:14,fontWeight:900}}>🩺 팀 진단</p>
        <p style={{margin:"3px 0 0",fontSize:10.5,opacity:0.82}}>{month} 기준 · 막힘·적체·헛심을 읽고 개선 (완료=이번 달 / 미완=현재 · 평가 아님)</p>
      </div>
      <Card icon="⚠️" title="막힘·과부하 (담당자)" desc="안고 있는 미완이 많고 완료율이 낮으면 막힘/과부하 신호" action="막힌 담당자 일 재분배·프로세스 재설계">
        {mem.map(m=>(
          <div key={m.u.id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:"1px solid #F6F7F9"}}>
            <Ava name={m.u.name} color={m.u.color} size={26}/>
            <span style={{flex:1,fontSize:12.5,fontWeight:700,color:"#1F2937"}}>{m.u.name}{m.stuck&&<span style={{marginLeft:6,fontSize:9.5,fontWeight:800,color:"#fff",background:"#F04452",borderRadius:6,padding:"1px 6px"}}>🔴 막힘</span>}</span>
            <span style={{fontSize:11,color:"#6B7280",flexShrink:0}}>미완 {m.open} · 완료율 {m.rate}%</span>
          </div>
        ))}
      </Card>
      <Card icon="🧱" title="적체 프로젝트" desc="미완 말단 업무가 많이 쌓인 프로젝트" action="가장 막힌 프로젝트부터 단계 점검·정리">
        {projStuck.length===0?<p style={{margin:0,fontSize:12,color:"#C4C9D0"}}>적체 없음</p>:projStuck.map(x=>(
          <div key={x.p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #F6F7F9"}}>
            <span style={{flex:1,fontSize:12.5,fontWeight:600,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.p.title}</span>
            <span style={{fontSize:11,fontWeight:800,color:"#EA580C",flexShrink:0}}>미완 {x.open}/{x.total}</span>
          </div>
        ))}
      </Card>
      <Card icon="💸" title="행동 대비 결과 낮음" desc="완료 업무는 쌓였는데 매출 0인 매출 프로젝트 = 헛심 후보" action="전략 재배치·불필요 행동 컷 검토">
        {heotsim.length===0?<p style={{margin:0,fontSize:12,color:"#C4C9D0"}}>해당 없음</p>:heotsim.map(x=>(
          <div key={x.p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #F6F7F9"}}>
            <span style={{flex:1,fontSize:12.5,fontWeight:600,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.p.title}</span>
            <span style={{fontSize:11,fontWeight:700,color:"#9CA3AF",flexShrink:0}}>완료 {x.doneM} · 매출 0</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
// 가이드 — KPI 구조·데이터 흐름·사용법 설명
function GuidePage({D}){
  const Sec=({n,title,children})=>(
    <div style={{backgroundColor:"#fff",borderRadius:16,border:"1px solid #F2F4F6",padding:"16px 16px 14px",marginBottom:12}}>
      <p style={{margin:"0 0 10px",fontSize:14,fontWeight:900,color:"#0F1F5C"}}><span style={{color:"#F97316"}}>{n}</span> {title}</p>
      {children}
    </div>
  );
  const Row=({l,d,c})=>(
    <div style={{display:"flex",gap:9,padding:"7px 0",borderBottom:"1px solid #F6F7F9"}}>
      <span style={{flexShrink:0,fontSize:12.5,fontWeight:800,color:c||"#1F2937",minWidth:78}}>{l}</span>
      <span style={{flex:1,fontSize:12,color:"#4B5563",lineHeight:1.55}}>{d}</span>
    </div>
  );
  return(
    <div style={{padding:"14px 16px 30px",maxWidth:720,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(135deg,#0F1F5C,#1a3a7a)",color:"#fff",borderRadius:16,padding:"18px",marginBottom:14}}>
        <p style={{margin:0,fontSize:17,fontWeight:900}}>📖 이 앱 사용법</p>
        <p style={{margin:"6px 0 0",fontSize:12,opacity:0.85,lineHeight:1.6}}>팀 최종목표(2026 매출 10억)를 <b>매일의 업무 실행</b>과 연결하고, 누가 무슨 활동으로 얼마를 벌었는지까지 자동 집계·기록합니다.<br/><b>"기록되지 않은 업무 = 하지 않은 것."</b></p>
      </div>

      <Sec n="1." title="목표 구조 — 무엇으로 관리하나 (3+1)">
        <Row l="💰 매출" c="#EA580C" d="직판 5억 + B2B 5억 = 돈. 프로젝트 매출을 입력하면 채널·메인KPI·최종목표로 자동 집계."/>
        <Row l="📊 운영" c="#3182F6" d="CRM·어드민 등 전략 모듈의 구축 완성도(%). 직판·B2B와 나란한 3대 전략 축 (잔손 아님)."/>
        <Row l="🎯 활동지표" c="#8B5CF6" d="상품등록 100개·견적 50건 같은 반복 수량. 프로젝트 안에서 입력 → 전사 합산."/>
        <Row l="📅 월간 개인목표" c="#00C073" d="개인이 한 달 단위로 정하는 목표. (목표·회고 메뉴)"/>
        <div style={{marginTop:10,padding:"9px 11px",background:"#FFF7ED",borderRadius:10,border:"1px solid #FED7AA"}}>
          <p style={{margin:0,fontSize:11,fontWeight:700,color:"#9A3412",lineHeight:1.6}}>⚖️ 운영 vs 활동지표 경계 — <b>큰 구축물(완성도 %) = 운영</b> / <b>반복 수량(개·건) = 활동지표</b></p>
        </div>
      </Sec>

      <Sec n="2." title="데이터 흐름 — 한 방향으로 흐른다">
        <div style={{background:"#FAFBFC",border:"1px solid #EDF0F3",borderRadius:10,padding:"11px 13px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#374151",lineHeight:1.9}}>
          업무 체크 → <b>진척률</b> 자동<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ <b>기여</b>(누가 했나) → <b>진단</b>(막힘·헛심) → <b>회고</b><br/>
          매출 입력(프로젝트) → 채널·단가 → 메인KPI → <b>최종목표</b>
        </div>
        <p style={{margin:"9px 2px 0",fontSize:11,color:"#9CA3AF",lineHeight:1.6}}>· 매출은 <b>메인KPI2 프로젝트 한 곳</b>에서만 입력 → 나머지는 전부 파생(단일 소스).<br/>· 업무를 체크하면 진척·기여·진단·회고가 자동으로 채워집니다.</p>
      </Sec>

      <Sec n="3." title="어디서 뭘 하나 — 메뉴 가이드">
        <p style={{margin:"0 0 5px",fontSize:11,fontWeight:800,color:"#9CA3AF"}}>개인 · 나만</p>
        <Row l="🏠 오늘" d="내 업무 체크 · 인계받은 '내 차례' · 이번 주 메모"/>
        <Row l="🎯 내 주간" d="이번 주 명심할 메모 + 내가 한 일 집계"/>
        <Row l="📌 고정업무" d="매일·매주 반복 업무(반복 등록)"/>
        <Row l="◷ 목표·회고" d="월간 개인목표 · 월말 회고 · 🩺 진단(막힘·적체·헛심)"/>
        <p style={{margin:"10px 0 5px",fontSize:11,fontWeight:800,color:"#9CA3AF"}}>팀 · 공유</p>
        <Row l="◎ KPI" d="목표 트리(매출·운영·활동지표) · 매출 입력"/>
        <Row l="▦ 프로젝트" d="프로젝트별 🧩프로세스(업무 트리)·업무·활동지표 / 🚀프로세스 탭"/>
        <Row l="◈ 업무 보드" d="개인 상세(담당자 트리·그로스보드) / 팀 전체 현황"/>
        <Row l="▤ 캘린더" d="일정·미팅"/>
      </Sec>

      <Sec n="4." title="언제 뭘 하나 — 루틴">
        <Row l="매일" c="#3182F6" d="오늘 화면에서 내 업무·인계 체크 (팀 프로젝트는 🧩프로세스로 진행)"/>
        <Row l="주 마지막날" c="#EA580C" d="오늘 화면 '이번 주 마감 입력' → 매출·KPI·활동지표 한 번에"/>
        <Row l="월말" c="#8B5CF6" d="목표·회고 → 진단 자동요약 보고 회고 작성 → 다음 달 개선"/>
      </Sec>

      <p style={{margin:"4px 2px 0",fontSize:10.5,color:"#C4C9D0",textAlign:"center"}}>POUR OS · 브랜드커머스팀 업무관리</p>
    </div>
  );
}
// 담당자 관리 — 앱 전체 담당자의 단일 마스터(추가/수정/색상/삭제). 모든 담당자 선택지가 D.users를 참조하므로 여기 변경이 전체 반영.
const USER_PALETTE=["#3182F6","#8B5CF6","#00C073","#F97316","#EA580C","#0891B2","#D946EF","#65A30D","#DC2626","#0D9488","#DB2777","#4F46E5"];
function TeamPage({D,cu,lead,add,up,rm}){
  const [name,setName]=useState("");
  const [editId,setEditId]=useState(null);
  const [editName,setEditName]=useState("");
  const users=D.users||[];
  const nextColor=()=>{const used=new Set(users.map(u=>u.color));return USER_PALETTE.find(c=>!used.has(c))||USER_PALETTE[users.length%USER_PALETTE.length];};
  const addUser=()=>{
    const nm=name.trim(); if(!nm) return;
    if(users.some(u=>u.name===nm)&&!window.confirm(`'${nm}' 이름이 이미 있어요. 그래도 추가할까요?`)) return;
    add("users",{id:"u"+Date.now(),name:nm,color:nextColor(),role:"member"});
    setName("");
  };
  const [syncing,setSyncing]=useState(false);
  // 외부 마스터(어드민센터 담당자 관리 = staff 컬렉션)에서 이름 매칭 후 미등록자만 가져옴(읽기전용 — 기존 배정 안전)
  const norm=(s)=>(s||"").replace(/\s/g,"");
  const syncStaff=async()=>{
    setSyncing(true);
    try{
      // 어드민센터 담당자 마스터 = 'staff' 컬렉션(각 담당자 1문서). pour-os 멤버는 kpiMemberId(또는 이름)로 매칭.
      const snap=await getDocs(extCol("staff"));
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      console.log(`[staff] ${list.length}명 로드`);
      if(!list.length){ window.alert("어드민센터 담당자 관리(staff)에 데이터가 없어요."); setSyncing(false); return; }
      const active=list.filter(s=>s.active!==false&&(s.name||"").trim());
      const matched=(s)=>{const sid=(s.kpiMemberId||s.id||"").trim();const nm=norm(s.name);return users.some(u=>(sid&&u.id===sid)||(nm&&(()=>{const un=norm(u.name);return un===nm||un.includes(nm)||nm.includes(un);})()));};
      const toAdd=active.filter(s=>!matched(s));
      if(!toAdd.length){ window.alert(`어드민 담당자 ${active.length}명 모두 이미 등록돼 있어요.`); setSyncing(false); return; }
      if(window.confirm(`어드민센터 담당자 관리(staff)에서 ${toAdd.length}명을 가져올까요?\n\n${toAdd.map(s=>"· "+s.name).join("\n")}`)){
        const used=new Set(users.map(u=>u.color));
        toAdd.forEach((s,i)=>{ const col=s.kpiColor||USER_PALETTE.find(c=>!used.has(c))||USER_PALETTE[(users.length+i)%USER_PALETTE.length]; used.add(col);
          const uid=(s.kpiMemberId||s.id||("u"+Date.now()+"_"+i)).trim();   // kpiMemberId = pour-os 멤버 id (어드민과 자동 연결)
          add("users",{id:uid,name:s.name.trim(),color:col,role:"member",staffId:s.id,email:s.email||"",phone:s.phone||""}); });
        window.alert(`${toAdd.length}명을 가져왔어요. 이제 모든 담당자 선택지에 노출됩니다.`);
      }
    }catch(e){ console.error("[staff sync] 실패:",e); window.alert("가져오기 실패 — 어드민센터 담당자(staff)에 접근할 수 없어요.\n("+(e.code||e.message||e)+")"); }
    setSyncing(false);
  };
  const startEdit=(u)=>{setEditId(u.id);setEditName(u.name);};
  const saveEdit=()=>{if(editName.trim())up("users",editId,{name:editName.trim()});setEditId(null);};
  const removeUser=(u)=>{
    const cnt=(D.tasks||[]).filter(t=>t.assigneeId===u.id||(t.parentId&&false)).length+(D.projects||[]).filter(p=>p.assigneeId===u.id||(p.collaboratorIds||[]).includes(u.id)).length;
    if(u.id===D.currentUser){window.alert("현재 로그인 중인 담당자는 삭제할 수 없어요. 다른 담당자로 전환 후 삭제하세요.");return;}
    if(window.confirm(`'${u.name}' 담당자를 삭제할까요?${cnt?`\n연결된 업무·프로젝트 ${cnt}건의 담당자가 빈칸이 됩니다.`:""}\n휴지통으로 이동하며 복구할 수 있어요.`)) rm("users",u.id);
  };
  return(
    <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
      <div style={{marginBottom:14}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:900,color:"#0F1F5C"}}>👥 담당자 관리</h2>
        <p style={{margin:"4px 0 0",fontSize:11.5,color:"#9CA3AF",lineHeight:1.6}}>여기 담당자가 앱 전체(업무·프로젝트·일정·프로세스)의 <b>담당자 선택지</b>로 노출돼요. 추가하면 모든 곳에 바로 반영됩니다.</p>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addUser()} placeholder="새 담당자 이름 (예: 김하늘)" style={{flex:1,padding:"11px 13px",borderRadius:11,border:"1.5px solid #E5E8EB",fontSize:13.5,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        <button onClick={addUser} disabled={!name.trim()} style={{flexShrink:0,padding:"0 16px",borderRadius:11,border:"none",background:name.trim()?"#F97316":"#E5E8EB",color:name.trim()?"#fff":"#9CA3AF",fontSize:13.5,fontWeight:800,cursor:name.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>+ 추가</button>
      </div>
      <button onClick={syncStaff} disabled={syncing} style={{width:"100%",marginBottom:14,padding:"10px 0",borderRadius:11,border:"1.5px solid #DBE3FF",background:"#F5F8FF",color:"#3182F6",fontSize:12.5,fontWeight:800,cursor:syncing?"default":"pointer",fontFamily:"inherit"}}>{syncing?"가져오는 중…":"🔄 어드민센터 담당자 관리에서 가져오기 (staff)"}</button>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#6B7280"}}>전체 {users.length}명</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {users.map(u=>{
          const tcnt=(D.tasks||[]).filter(t=>t.assigneeId===u.id&&!t.isFixed).length;
          const pcnt=(D.projects||[]).filter(p=>p.assigneeId===u.id||(p.collaboratorIds||[]).includes(u.id)).length;
          const me=u.id===D.currentUser;
          return(
            <div key={u.id} style={{background:"#fff",borderRadius:13,border:`1px solid ${me?"#DBE3FF":"#F2F4F6"}`,padding:"11px 13px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Ava name={u.name} color={u.color} size={34}/>
                <div style={{flex:1,minWidth:0}}>
                  {editId===u.id?(
                    <div style={{display:"flex",gap:6}}>
                      <input value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} autoFocus style={{flex:1,minWidth:0,padding:"6px 9px",borderRadius:8,border:"1.5px solid #F97316",fontSize:13,fontWeight:700,outline:"none",fontFamily:"inherit"}}/>
                      <button onClick={saveEdit} style={{padding:"6px 11px",borderRadius:8,border:"none",background:"#F97316",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>저장</button>
                    </div>
                  ):(
                    <>
                      <p style={{margin:0,fontSize:14,fontWeight:800,color:"#0F1F5C"}}>{u.name}{u.role==="lead"?" · 리드":""}{me?" (나)":""}</p>
                      <p style={{margin:"2px 0 0",fontSize:10.5,color:"#9CA3AF"}}>업무 {tcnt} · 프로젝트 {pcnt}</p>
                    </>
                  )}
                </div>
                {editId!==u.id&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>startEdit(u)} style={{padding:"6px 9px",borderRadius:8,border:"1px solid #E5E8EB",background:"#fff",fontSize:12,fontWeight:700,color:"#4B5563",cursor:"pointer",fontFamily:"inherit"}}>✎</button>
                  <button onClick={()=>removeUser(u)} style={{padding:"6px 9px",borderRadius:8,border:"1px solid #FFE2E5",background:"#FFF0F1",fontSize:12,fontWeight:700,color:"#F04452",cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                </div>}
              </div>
              <div style={{display:"flex",gap:5,marginTop:9,flexWrap:"wrap"}}>
                {USER_PALETTE.map(c=>(<button key={c} onClick={()=>up("users",u.id,{color:c})} style={{width:20,height:20,borderRadius:"50%",background:c,border:u.color===c?"2.5px solid #0F1F5C":"2px solid #fff",boxShadow:"0 0 0 1px #E5E8EB",cursor:"pointer",padding:0}}/>))}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{margin:"14px 2px 0",fontSize:10.5,color:"#9CA3AF",lineHeight:1.6}}>※ 삭제해도 휴지통(KPI▸데이터)에서 복구할 수 있어요. 이름이 중복되면 정리하세요.</p>
    </div>
  );
}
// 그로스보드 — 마인드맵(노드·연결선) 렌더러. items: [{id,depth,label,color,active,leftTag,chips:[{t,c,bg}]}] (depth0=루트)
// 맵 레이아웃 계산 (마인드맵 좌표) — 화면·PNG 공용
const MAP_GEO={rowH:46,padX:12,padY:14,nodeH:30,colGap:24};
// 노드 폭 자동 산정 — 라벨/태그/칩이 옆으로 잘리지 않도록 글자 폭을 대략 계산(한글·이모지=전각, 그 외=반각)
const _glyphW=(ch,f)=>(ch.charCodeAt(0)>0x2000?f:f*0.56);
function measureW(s,f){let w=0;for(const ch of String(s||"")){w+=_glyphW(ch,f);}return w;}
function nodeWidth(it){
  const parts=[];
  if(it.signal)parts.push(13);
  if(it.depth!==0&&!it.signal)parts.push(8);
  if(it.leftTag)parts.push(measureW(it.leftTag,8.5)+10);
  parts.push(measureW(it.label,11)+(it.depth===0?2:1));
  (it.chips||[]).forEach(c=>parts.push(measureW(c.t,8.5)+10));
  const gaps=Math.max(0,parts.length-1)*5;
  return Math.ceil(18+gaps+parts.reduce((a,b)=>a+b,0))+6;   // 좌우 패딩 18 + 여유 6
}
function mapLayout(items){
  const {rowH,padX,padY,colGap}=MAP_GEO;const pos={};let yc=0;
  const wd=items.map(nodeWidth);
  const maxDepth=items.reduce((m,it)=>Math.max(m,it.depth),0);
  const colW=[];for(let d=0;d<=maxDepth;d++){let m=0;items.forEach((it,i)=>{if(it.depth===d&&wd[i]>m)m=wd[i];});colW[d]=m;}
  const colX=[];let acc=padX;for(let d=0;d<=maxDepth;d++){colX[d]=acc;acc+=colW[d]+colGap;}   // 깊이별 컬럼 시작 x(가변 폭 누적)
  const kidsOf=(i)=>{const r=[];for(let k=i+1;k<items.length;k++){if(items[k].depth<=items[i].depth)break;if(items[k].depth===items[i].depth+1)r.push(k);}return r;};
  const place=(i)=>{const kids=kidsOf(i);if(!kids.length){pos[i]={x:colX[items[i].depth],y:padY+yc*rowH};yc++;}else{const ys=[];kids.forEach(k=>{place(k);ys.push(pos[k].y);});pos[i]={x:colX[items[i].depth],y:(Math.min(...ys)+Math.max(...ys))/2};}};
  items.forEach((it,i)=>{if(it.depth===0)place(i);});
  let mx=0,my=0;items.forEach((it,i)=>{if(pos[i]){if(pos[i].x+wd[i]>mx)mx=pos[i].x+wd[i];if(pos[i].y>my)my=pos[i].y;}});
  const parentIdx=(i)=>{for(let k=i-1;k>=0;k--){if(items[k].depth<items[i].depth)return k;}return -1;};
  return {pos,wd,mx,my,parentIdx};
}
function MapCanvas({items,onPick}){
  if(!items||!items.length) return <p style={{textAlign:"center",color:"#D1D5DB",fontSize:13,padding:"24px 0"}}>표시할 항목이 없어요</p>;
  const {pos,wd,mx,my,parentIdx}=mapLayout(items);
  return(
    <div style={{overflowX:"auto",backgroundColor:"#FAFBFC",backgroundImage:"radial-gradient(#E5E8EB 1px,transparent 1px)",backgroundSize:"18px 18px",border:"1px solid #EDF0F3",borderRadius:14}}>
      <div style={{position:"relative",width:mx+24,height:my+58}}>
        <svg width={mx+24} height={my+58} style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"visible"}}>
          {items.map((it,i)=>{const pi=parentIdx(i);if(pi<0||!pos[pi]||!pos[i])return null;const x1=pos[pi].x+wd[pi],y1=pos[pi].y+16,x2=pos[i].x,y2=pos[i].y+16;const c=it.active?(it.color+"99"):"#D9DEE3";return <path key={it.id} d={`M ${x1} ${y1} C ${x1+30} ${y1}, ${x2-30} ${y2}, ${x2} ${y2}`} stroke={c} strokeWidth={2} fill="none"/>;})}
        </svg>
        {items.map((it,i)=>{if(!pos[i])return null;const root=it.depth===0;const clickable=!!(it.ref&&onPick);return(
          <div key={it.id} onClick={clickable?()=>onPick(it):undefined} style={{position:"absolute",left:pos[i].x,top:pos[i].y,width:wd[i],boxSizing:"border-box",display:"flex",alignItems:"center",gap:5,background:root?(it.active?it.color:"#9CA3AF"):"#fff",border:`2px solid ${it.signal?"#F0445299":(it.active?it.color:"#E5E8EB")}`,borderRadius:11,padding:"6px 9px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",zIndex:2,cursor:clickable?"pointer":"default"}}>
            {it.signal&&<span title={SIGNAL_LABEL[it.signal]} style={{fontSize:10,flexShrink:0}}>{SIGNAL_ICON[it.signal]}</span>}
            {!root&&!it.signal&&<div style={{width:8,height:8,borderRadius:"50%",background:it.active?it.color:"#D1D5DB",flexShrink:0}}/>}
            {it.leftTag&&<span style={{fontSize:8.5,fontWeight:900,color:it.active?it.color:"#9CA3AF",background:it.active?it.color+"1A":"#F2F4F6",padding:"1px 5px",borderRadius:6,flexShrink:0}}>{it.leftTag}</span>}
            <span style={{flex:1,fontSize:11,fontWeight:root?900:700,color:root?"#fff":(it.active?"#1F2937":"#9CA3AF"),whiteSpace:"nowrap"}}>{it.label}</span>
            {(it.chips||[]).map((c,ci)=>(<span key={ci} style={{fontSize:8.5,fontWeight:800,color:c.c,background:c.bg,padding:"1px 5px",borderRadius:6,flexShrink:0}}>{c.t}</span>))}
          </div>
        );})}
      </div>
    </div>
  );
}
// 마인드맵 → PNG 저장 (외부 라이브러리 없이 Canvas로 직접 그림)
function exportMapPNG(items,title){
  if(!items||!items.length) return;
  const {nodeH}=MAP_GEO;const {pos,wd,mx,my,parentIdx}=mapLayout(items);
  const W=mx+24,H=my+58,S=2;
  const cv=document.createElement("canvas");cv.width=W*S;cv.height=H*S;const g=cv.getContext("2d");g.scale(S,S);
  g.fillStyle="#FFFFFF";g.fillRect(0,0,W,H);
  items.forEach((it,i)=>{const pi=parentIdx(i);if(pi<0||!pos[pi]||!pos[i])return;const x1=pos[pi].x+wd[pi],y1=pos[pi].y+16,x2=pos[i].x,y2=pos[i].y+16;g.strokeStyle=it.active?it.color:"#D9DEE3";g.lineWidth=2;g.beginPath();g.moveTo(x1,y1);g.bezierCurveTo(x1+30,y1,x2-30,y2,x2,y2);g.stroke();});
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  items.forEach((it,i)=>{const p=pos[i];if(!p)return;const root=it.depth===0;rr(p.x,p.y,wd[i],nodeH,10);g.fillStyle=root?(it.active?it.color:"#9CA3AF"):"#fff";g.fill();g.lineWidth=2;g.strokeStyle=it.signal?"#F04452":(it.active?it.color:"#E5E8EB");g.stroke();
    g.save();rr(p.x,p.y,wd[i],nodeH,10);g.clip();let tx=p.x+9;
    if(!root){g.fillStyle=it.active?it.color:"#D1D5DB";g.beginPath();g.arc(tx+3,p.y+nodeH/2,3.5,0,Math.PI*2);g.fill();tx+=11;}
    g.font="700 11px Pretendard, sans-serif";g.fillStyle=root?"#fff":(it.active?"#1F2937":"#9CA3AF");g.textBaseline="middle";
    const chipsT=(it.chips||[]).map(c=>c.t).join(" ");
    const txt=(it.signal?SIGNAL_ICON[it.signal]+" ":"")+(it.leftTag?"["+it.leftTag+"] ":"")+it.label+(chipsT?"  "+chipsT:"");
    g.fillText(txt,tx,p.y+nodeH/2+0.5);g.restore();
  });
  try{const a=document.createElement("a");a.href=cv.toDataURL("image/png");a.download=(title||"그로스보드")+".png";a.click();}
  catch(e){console.error("[map export] 실패:",e);window.alert("이미지 저장 실패: "+(e.message||e));}
}
// 개인 그로스보드 → 마인드맵 items 평탄화 (KR→서브KR→프로젝트→업무). opts:{krF,activeOnly,signals}
// 한 담당자의 KR→서브KR→프로젝트→업무 서브트리를 items에 push (개인·팀 마인드맵 공용). baseDepth=KR이 놓일 깊이, pfx=id 충돌 방지 접두사
function pushKRSubtree(items,D,uid,isThisWeek,doneInP,krColors,baseDepth,opts={}){
  const {krF="all",activeOnly=false,signals=null,pfx=""}=opts;
  // 담당(소유) 프로젝트 + 내가 업무를 맡은 프로젝트(타인 소유 포함) — 실제 한 일이 그로스보드에 반영되도록
  const myTaskPids=new Set(D.tasks.filter(t=>!t.isFixed&&t.assigneeId===uid).map(t=>t.projectId));
  const myP=D.projects.filter(p=>p.assigneeId===uid||myTaskPids.has(p.id));
  const pushProj=(proj,depth,col)=>{
    const projTasks=D.tasks.filter(t=>t.projectId===proj.id&&!t.isFixed&&t.assigneeId===uid);
    const actT=projTasks.filter(isThisWeek);if(activeOnly&&!actT.length)return;
    const dP=doneInP(projTasks);
    const chips=[{t:(proj.progress||0)+"%",c:actT.length?col:"#9CA3AF",bg:actT.length?col+"1A":"#F2F4F6"}];
    if(dP>0)chips.push({t:"✅"+dP,c:"#0F5132",bg:"#D1F5E0"});
    const sig=signals?(signals.heotsimProjects.has(proj.id)?"heotsim":(signals.jamProjects.has(proj.id)?"jam":null)):null;
    items.push({id:pfx+proj.id,depth,label:proj.title,color:col,active:actT.length>0,chips,signal:sig,ref:{kind:"proj",id:proj.id}});
    // 완료·진행중·보류는 개별 노드로 모두 노출, 순수 '할일(todo)'만 'N건'으로 묶음
    const shownT=actT.filter(t=>t.status!=="todo");
    const todoT=actT.filter(t=>t.status==="todo");
    shownT.forEach(t=>{const st=STATUS_MAP[t.status]||STATUS_MAP.todo;items.push({id:pfx+t.id,depth:depth+1,label:t.title,color:st.color,active:true,leftTag:t.weekDay||null,chips:[{t:st.label,c:st.color,bg:st.bg}],ref:{kind:"task",id:t.id}});});
    if(todoT.length){const st=STATUS_MAP.todo;items.push({id:pfx+proj.id+"__todo",depth:depth+1,label:`할일 ${todoT.length}건`,color:st.color,active:true});}
  };
  D.mainKPIs.filter(mk=>krF==="all"||mk.id===krF).forEach(mk=>{
    const mkProjs=myP.filter(p=>p.mainKPIId===mk.id);if(!mkProjs.length)return;
    const col=krColors[mk.id]||"#3182F6";
    const allT=mkProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===uid));
    const mkAct=allT.some(isThisWeek);if(activeOnly&&!mkAct)return;
    const mkDone=doneInP(allT);const rev=mkProjs.reduce((a,p)=>a+(p.assigneeId===uid?numF(p.resultValue):0),0);   // 매출은 소유 프로젝트만 집계(타인 매출 오귀속 방지)
    const tgt=pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue);
    const chips=[{t:"🎯"+tgt+"%",c:col,bg:col+"1A"}];if(mkDone>0)chips.push({t:"✅"+mkDone,c:"#0F5132",bg:"#D1F5E0"});if(rev>0)chips.push({t:"💰"+fmt(rev,"원"),c:"#7A3E00",bg:"#FFE6C7"});
    items.push({id:pfx+mk.id,depth:baseDepth,label:mk.title,leftTag:mk.krKey,color:col,active:mkAct,chips,ref:{kind:"mk",id:mk.id}});
    const skIds=[...new Set(mkProjs.map(p=>p.subKPIId).filter(Boolean))];
    skIds.forEach(skid=>{const sk=D.subKPIs.find(s=>s.id===skid);if(!sk)return;const skProjs=mkProjs.filter(p=>p.subKPIId===skid);const skT=skProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===uid));const skAct=skT.some(isThisWeek);if(activeOnly&&!skAct)return;items.push({id:pfx+mk.id+"/"+skid,depth:baseDepth+1,label:sk.title,leftTag:sk.channelCode,color:col,active:skAct,ref:{kind:"sk",id:sk.id}});skProjs.forEach(p=>pushProj(p,baseDepth+2,col));});
    mkProjs.filter(p=>!p.subKPIId).forEach(p=>pushProj(p,baseDepth+1,col));
  });
  if(krF==="all"){
    const infra=myP.filter(p=>!p.mainKPIId);
    if(infra.length){const iAct=infra.some(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===uid).some(isThisWeek));if(!(activeOnly&&!iAct)){items.push({id:pfx+"infra",depth:baseDepth,label:"⚙️ 운영 인프라",color:"#6B7280",active:iAct});infra.forEach(p=>pushProj(p,baseDepth+1,"#6B7280"));}}
  }
}
function buildPersonMapItems(D,sel,isThisWeek,doneInP,krColors,opts={}){
  const items=[];const user=D.users.find(u=>u.id===sel);
  items.push({id:"root",depth:0,label:user?.name||"나",color:"#0F1F5C",active:true,ref:{kind:"member",id:sel}});
  pushKRSubtree(items,D,sel,isThisWeek,doneInP,krColors,1,{...opts,pfx:""});
  return items;
}
// 팀 그로스보드 → 마인드맵 items 평탄화 (팀→멤버→KR→서브KR→프로젝트→업무 끝까지). opts:{krF,activeOnly,members,signals}
function buildTeamMapItems(D,activeInP,doneInP,opts={}){
  const {krF="all",activeOnly=false,members=null,signals=null}=opts;
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  const items=[{id:"team",depth:0,label:"팀 전체",color:"#0F1F5C",active:true}];
  D.users.filter(u=>!members||members.has(u.id)).forEach(u=>{
    const projs=D.projects.filter(p=>p.assigneeId===u.id&&(krF==="all"||p.mainKPIId===krF));
    const projIds=new Set(projs.map(p=>p.id));
    const tasks=D.tasks.filter(t=>!t.isFixed&&t.assigneeId===u.id&&(krF==="all"||projIds.has(t.projectId)));   // KR 필터를 active/완료 집계에도 일관 적용
    const col=u.color||"#3182F6";const active=tasks.some(activeInP);
    if(activeOnly&&!active)return;
    const dP=doneInP(tasks);const rev=projs.reduce((a,p)=>a+numF(p.resultValue),0);
    const chips=[];if(dP>0)chips.push({t:"✅"+dP,c:"#0F5132",bg:"#D1F5E0"});if(rev>0)chips.push({t:"💰"+fmt(rev,"원"),c:"#7A3E00",bg:"#FFE6C7"});
    const sig=signals&&signals.stuckMembers.has(u.id)?"stuck":null;
    items.push({id:"m_"+u.id,depth:1,label:u.name,color:col,active,chips,signal:sig,ref:{kind:"member",id:u.id}});
    pushKRSubtree(items,D,u.id,activeInP,doneInP,krColors,2,{krF,activeOnly,signals,pfx:u.id+"_"});   // 멤버 아래 KR→…→업무 끝까지
  });
  return items;
}
// 그로스보드 노드 상세 (읽기 전용 — 편집 불가). ref:{kind:mk|sk|proj|task|member, id}
function NodeDetail({D,node,period,onClose}){
  if(!node||!node.ref) return null;
  const {kind,id}=node.ref;
  const [s,e]=periodRange(period||"week");
  const inP=(ds)=>{if(!ds)return false;const d=new Date(ds);return !isNaN(d)&&d>=s&&d<=e;};
  const sig=diagSignals(D);
  const Field=({l,v,c})=>(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F6F7F9"}}><span style={{fontSize:12,color:"#9CA3AF",fontWeight:600}}>{l}</span><span style={{fontSize:13,fontWeight:800,color:c||"#1F2937",textAlign:"right",maxWidth:"62%"}}>{v}</span></div>);
  const Tag=({t,c,bg})=><span style={{fontSize:10.5,fontWeight:800,color:c,background:bg,padding:"2px 8px",borderRadius:8}}>{t}</span>;
  let title="상세",body=null;
  if(kind==="mk"){const mk=D.mainKPIs.find(m=>m.id===id);if(mk){const mkProjs=D.projects.filter(p=>p.mainKPIId===mk.id);const allT=D.tasks.filter(t=>!t.isFixed&&mkProjs.some(p=>p.id===t.projectId));const doneP=allT.filter(t=>t.status==="done"&&inP(t.doneAt)).length;const rev=mkProjs.reduce((a,p)=>a+numF(p.resultValue),0);title=`${mk.krKey} · ${mk.title}`;body=(<>
    <Field l="유형" v="메인KPI (목표)"/>
    <Field l="목표 대비" v={`${pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue)}%`} c="#3182F6"/>
    <Field l="매출 (누계)" v={fmtKorWon(rev)} c="#EA580C"/>
    <Field l={`완료 (${PERIOD_LABEL[period]||"기간"})`} v={`${doneP}건`} c="#00A862"/>
    <Field l="하위 프로젝트" v={`${mkProjs.length}개`}/>
  </>);}}
  else if(kind==="sk"){const sk=D.subKPIs.find(x=>x.id===id);if(sk){const skProjs=D.projects.filter(p=>p.subKPIId===sk.id);title=`${sk.channelCode||""} · ${sk.title}`;body=(<>
    <Field l="유형" v="서브KPI (단가·채널)"/>
    <Field l="현재 / 목표" v={`${fmt(skCur(sk,D.projects),sk.unit)} / ${fmt(numF(sk.targetValue),sk.unit)}`}/>
    <Field l="달성률" v={`${pct(skCur(sk,D.projects),sk.targetValue)}%`} c="#3182F6"/>
    <Field l="연결 프로젝트" v={`${skProjs.length}개`}/>
  </>);}}
  else if(kind==="proj"){const p=D.projects.find(x=>x.id===id);if(p){const pts=D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed);const doneP=pts.filter(t=>t.status==="done"&&inP(t.doneAt)).length;const asg=D.users.find(u=>u.id===p.assigneeId);const dt=DT[p.dealerType];const signals=[];if(sig.heotsimProjects.has(p.id))signals.push("heotsim");if(sig.jamProjects.has(p.id))signals.push("jam");title=p.title;body=(<>
    <Field l="유형" v="프로젝트 (활동)"/>
    <Field l="담당자" v={asg?asg.name:"미지정"} c={asg?.color}/>
    {dt&&<Field l="거래처유형" v={`${dt.code} · ${dt.label}`} c={dt.color}/>}
    <Field l="진척(선행지표)" v={`${p.progress||0}%`} c={p.progress>=70?"#00C073":"#3182F6"}/>
    <Field l="매출(결과)" v={fmtKorWon(numF(p.resultValue))} c="#EA580C"/>
    <Field l={`완료 (${PERIOD_LABEL[period]||"기간"})`} v={`${doneP} / ${pts.length}건`} c="#00A862"/>
    {signals.length>0&&<div style={{display:"flex",gap:6,marginTop:10}}>{signals.map(x=><Tag key={x} t={`${SIGNAL_ICON[x]} ${SIGNAL_LABEL[x]}`} c="#B42318" bg="#FEE4E2"/>)}</div>}
    {pts.length>0&&<div style={{marginTop:12}}><p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"#6B7280"}}>업무 {pts.length}건</p>{pts.slice(0,12).map(t=>{const st=STATUS_MAP[t.status]||STATUS_MAP.todo;return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0"}}><span style={{width:6,height:6,borderRadius:"50%",background:st.color,flexShrink:0}}/><span style={{flex:1,fontSize:12,color:t.status==="done"?"#9CA3AF":"#1F2937",textDecoration:t.status==="done"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span><span style={{fontSize:9.5,fontWeight:800,color:st.color,background:st.bg,padding:"1px 6px",borderRadius:5,flexShrink:0}}>{st.label}</span></div>);})}{pts.length>12&&<p style={{margin:"4px 0 0",fontSize:11,color:"#C4C9D0"}}>+{pts.length-12}건 더</p>}</div>}
  </>);}}
  else if(kind==="task"){const t=D.tasks.find(x=>x.id===id);if(t){const st=STATUS_MAP[t.status]||STATUS_MAP.todo;const asg=D.users.find(u=>u.id===t.assigneeId);const pr=D.projects.find(p=>p.id===t.projectId);title=t.title;body=(<>
    <Field l="유형" v="업무"/>
    <Field l="상태" v={st.label} c={st.color}/>
    <Field l="담당자" v={asg?asg.name:"미지정"} c={asg?.color}/>
    {pr&&<Field l="프로젝트" v={pr.title}/>}
    {t.weekDay&&<Field l="요일 배치" v={t.weekDay}/>}
    {t.workDate&&<Field l="진행 날짜" v={t.workDate}/>}
    {t.doneAt&&<Field l="완료 시각" v={`${(t.doneAt||"").slice(0,10)} ${hhmm(t.doneAt)}`} c="#00A862"/>}
    {t.memo&&<div style={{marginTop:10,padding:"9px 11px",background:"#FAFBFC",borderRadius:9,fontSize:12.5,color:"#4B5563",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{t.memo}</div>}
  </>);}}
  else if(kind==="member"){const u=D.users.find(x=>x.id===id);if(u){const tasks=D.tasks.filter(t=>!t.isFixed&&t.assigneeId===u.id);const projs=D.projects.filter(p=>p.assigneeId===u.id);const doneP=tasks.filter(t=>t.status==="done"&&inP(t.doneAt)).length;const inprog=tasks.filter(t=>t.status==="inprogress").length;const rev=projs.reduce((a,p)=>a+numF(p.resultValue),0);title=u.name;body=(<>
    <Field l="유형" v="담당자"/>
    {u.dept&&<Field l="소속" v={u.dept}/>}
    <Field l="담당 프로젝트" v={`${projs.length}개`}/>
    <Field l="진행중 업무" v={`${inprog}건`} c="#3182F6"/>
    <Field l={`완료 (${PERIOD_LABEL[period]||"기간"})`} v={`${doneP}건`} c="#00A862"/>
    <Field l="담당 매출(누계)" v={fmtKorWon(rev)} c="#EA580C"/>
    {sig.stuckMembers.has(u.id)&&<div style={{marginTop:10}}><Tag t={`${SIGNAL_ICON.stuck} ${SIGNAL_LABEL.stuck}`} c="#B42318" bg="#FEE4E2"/></div>}
  </>);}}
  return(
    <Sheet open={!!node} onClose={onClose} title={title} h="80vh">
      <div style={{marginTop:6}}>
        {body||<p style={{color:"#9CA3AF",fontSize:13,padding:"20px 0",textAlign:"center"}}>항목을 찾을 수 없어요</p>}
        <p style={{margin:"14px 2px 0",fontSize:10.5,color:"#C4C9D0",lineHeight:1.6}}>👁 읽기 전용 보기입니다. 수정은 프로젝트·업무 화면에서 하세요.</p>
        <button onClick={onClose} style={{width:"100%",marginTop:12,padding:"12px 0",borderRadius:12,border:"none",background:"#F2F4F6",color:"#4B5563",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>닫기</button>
      </div>
    </Sheet>
  );
}
// 그로스보드 — 계층형 트리(한 담당자 KR→서브KR→프로젝트→업무). 개인·팀(멤버별) 공용.
function WeeklyTree({D,sel,isThisWeek,doneInP,krColors,krF,activeOnly,signals,onPick}){
  // 담당(소유) 프로젝트 + 내가 업무를 맡은 프로젝트(타인 소유 포함)
  const myTaskPids=new Set(D.tasks.filter(t=>!t.isFixed&&t.assigneeId===sel).map(t=>t.projectId));
  return(<>
    {D.mainKPIs.filter(mk=>krF==="all"||mk.id===krF).map(mk=>{
      const mkProjs=D.projects.filter(p=>p.mainKPIId===mk.id&&(p.assigneeId===sel||myTaskPids.has(p.id)));
      if(mkProjs.length===0) return null;
      const allMkTasks=mkProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===sel));
      const thisWeekCount=allMkTasks.filter(t=>isThisWeek(t)).length;
      const mkDone=doneInP(allMkTasks); const mkRev=mkProjs.reduce((a,p)=>a+(p.assigneeId===sel?numF(p.resultValue):0),0);   // 매출은 소유 프로젝트만
      const col=krColors[mk.id]||"#3182F6";
      const mkActive=thisWeekCount>0;
      const mkTgt=pct(mkCur(mk,D.subKPIs,D.projects),mk.targetValue);
      if(activeOnly&&!mkActive) return null;
      const skIds=[...new Set(mkProjs.map(p=>p.subKPIId).filter(Boolean))];
      const sks=skIds.map(id=>D.subKPIs.find(s=>s.id===id)).filter(Boolean);
      const noSkProjs=mkProjs.filter(p=>!p.subKPIId);
      return(
        <div key={mk.id} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:6}}>
            <div style={{width:14,height:14,borderRadius:"50%",backgroundColor:mkActive?col:"#D1D5DB",flexShrink:0}}/>
            <div style={{height:2,width:10,backgroundColor:mkActive?col+"88":"#E5E8EB"}}/>
            <div onClick={()=>onPick({ref:{kind:"mk",id:mk.id}})} style={{backgroundColor:mkActive?col:"#E5E8EB",borderRadius:10,padding:"6px 12px",flex:1,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,fontWeight:900,color:mkActive?col:"#9CA3AF",backgroundColor:mkActive?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.7)",padding:"1px 6px",borderRadius:10}}>{mk.krKey}</span>
                  <span style={{fontSize:13,fontWeight:900,color:mkActive?"#FFFFFF":"#6B7280"}}>{mk.title}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                  <span style={{fontSize:10,fontWeight:800,color:mkActive?"#FFFFFF":"#9CA3AF",backgroundColor:mkActive?"rgba(255,255,255,0.22)":"#F2F4F6",padding:"2px 7px",borderRadius:10}}>🎯{mkTgt}%</span>
                  {mkActive&&<span style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.95)",backgroundColor:"rgba(255,255,255,0.2)",padding:"2px 7px",borderRadius:10}}>활동 {thisWeekCount}</span>}
                  {mkDone>0&&<span style={{fontSize:10,fontWeight:800,color:"#0F5132",background:"#D1F5E0",padding:"2px 7px",borderRadius:10}}>✅{mkDone}</span>}
                  {mkRev>0&&<span style={{fontSize:10,fontWeight:800,color:"#7A3E00",background:"#FFE6C7",padding:"2px 7px",borderRadius:10}}>💰{fmt(mkRev,"원")}</span>}
                </div>
              </div>
            </div>
          </div>
          <div style={{marginLeft:6,borderLeft:`2px solid ${mkActive?col+"55":"#E5E8EB"}`}}>
            {sks.map((sk,skIdx)=>{
              const skProjs=mkProjs.filter(p=>p.subKPIId===sk.id);
              const skTasks=skProjs.flatMap(p=>D.tasks.filter(t=>t.projectId===p.id&&!t.isFixed&&t.assigneeId===sel));
              const skActive=skTasks.some(t=>isThisWeek(t));
              const isLastSk=skIdx===sks.length-1&&noSkProjs.length===0;
              if(activeOnly&&!skActive) return null;
              return(
                <div key={sk.id} style={{position:"relative",paddingLeft:20,marginBottom:10}}>
                  <div style={{position:"absolute",left:0,top:10,width:16,height:2,backgroundColor:skActive?col+"77":"#D1D5DB"}}/>
                  <div style={{position:"absolute",left:0,top:0,width:2,height:isLastSk?"12px":"100%",backgroundColor:mkActive?col+"44":"#E5E8EB"}}/>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,backgroundColor:skActive?col:"#9CA3AF",border:`2px solid ${skActive?col:"#9CA3AF"}`}}/>
                    <div onClick={()=>onPick({ref:{kind:"sk",id:sk.id}})} style={{backgroundColor:skActive?col+"18":"#F2F4F6",borderRadius:8,padding:"4px 10px",border:`1px solid ${skActive?col+"55":"#E5E8EB"}`,cursor:"pointer"}}>
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
                      if(activeOnly&&!projActive) return null;
                      const psig=signals.heotsimProjects.has(proj.id)?"heotsim":(signals.jamProjects.has(proj.id)?"jam":null);
                      return(
                        <div key={proj.id} style={{position:"relative",paddingLeft:18,marginBottom:8}}>
                          <div style={{position:"absolute",left:0,top:9,width:14,height:1.5,backgroundColor:projActive?col+"44":"#E5E8EB"}}/>
                          <div style={{position:"absolute",left:0,top:0,width:1.5,height:isLastP?"11px":"100%",backgroundColor:skActive?col+"33":"#F2F4F6"}}/>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:projTasks.length>0?5:0}}>
                            <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:projActive?col+"22":"#F2F4F6",border:`2px solid ${projActive?col:"#D1D5DB"}`,flexShrink:0}}/>
                            <div onClick={()=>onPick({ref:{kind:"proj",id:proj.id}})} style={{backgroundColor:"#FFFFFF",borderRadius:8,padding:"5px 10px",border:`1px solid ${psig?"#F0445255":(projActive?col+"44":"#E5E8EB")}`,flex:1,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                              {psig&&<span title={SIGNAL_LABEL[psig]} style={{fontSize:11,flexShrink:0}}>{SIGNAL_ICON[psig]}</span>}
                              <Ava name={assignee?.name} color={assignee?.color} size={18}/>
                              <span style={{fontSize:11.5,fontWeight:700,color:projActive?"#0F1F5C":"#9CA3AF",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                              {doneInP(projTasks)>0&&<span style={{fontSize:9,fontWeight:800,color:"#0F5132",background:"#D1F5E0",borderRadius:5,padding:"1px 5px",flexShrink:0}}>✅{doneInP(projTasks)}</span>}
                              <span style={{fontSize:10,fontWeight:700,color:projActive?col:"#9CA3AF",flexShrink:0}}>{proj.progress}%</span>
                            </div>
                          </div>
                          {projTasks.length>0&&(
                            <div style={{marginLeft:23,borderLeft:"1.5px dashed #E5E8EB"}}>
                              {thisWeekPT.map((task,tIdx)=>{const st=STATUS_MAP[task.status]||STATUS_MAP.todo;return(
                                <div key={task.id} onClick={()=>onPick({ref:{kind:"task",id:task.id}})} style={{position:"relative",paddingLeft:14,marginBottom:3,cursor:"pointer"}}>
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
                                <div key={task.id} onClick={()=>onPick({ref:{kind:"task",id:task.id}})} style={{position:"relative",paddingLeft:14,marginBottom:3,cursor:"pointer"}}>
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
              if(activeOnly&&!projActive) return null;
              const psig=signals.heotsimProjects.has(proj.id)?"heotsim":(signals.jamProjects.has(proj.id)?"jam":null);
              return(
                <div key={proj.id} style={{position:"relative",paddingLeft:20,marginBottom:8}}>
                  <div style={{position:"absolute",left:0,top:9,width:16,height:1.5,backgroundColor:projActive?col+"55":"#E5E8EB"}}/>
                  <div style={{position:"absolute",left:0,top:0,width:2,height:isLastP?"11px":"100%",backgroundColor:mkActive?col+"44":"#E5E8EB"}}/>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:projTasks.length>0?5:0}}>
                    <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#FFFFFF",border:`2px solid ${projActive?col:"#D1D5DB"}`,flexShrink:0}}/>
                    <div onClick={()=>onPick({ref:{kind:"proj",id:proj.id}})} style={{backgroundColor:"#FFFFFF",borderRadius:8,padding:"5px 10px",border:`1px solid ${psig?"#F0445255":(projActive?col+"44":"#E5E8EB")}`,flex:1,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                      {psig&&<span title={SIGNAL_LABEL[psig]} style={{fontSize:11,flexShrink:0}}>{SIGNAL_ICON[psig]}</span>}
                      <Ava name={assignee?.name} color={assignee?.color} size={18}/>
                      <span style={{fontSize:11.5,fontWeight:700,color:projActive?"#0F1F5C":"#9CA3AF",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.title}</span>
                      {doneInP(projTasks)>0&&<span style={{fontSize:9,fontWeight:800,color:"#0F5132",background:"#D1F5E0",borderRadius:5,padding:"1px 5px",flexShrink:0}}>✅{doneInP(projTasks)}</span>}
                      <span style={{fontSize:10,fontWeight:700,color:projActive?col:"#9CA3AF",flexShrink:0}}>{proj.progress}%</span>
                    </div>
                  </div>
                  {projTasks.length>0&&(
                    <div style={{marginLeft:23,borderLeft:"1.5px dashed #E5E8EB"}}>
                      {thisWeekPT.map((task,tIdx)=>{const st=STATUS_MAP[task.status]||STATUS_MAP.todo;return(
                        <div key={task.id} onClick={()=>onPick({ref:{kind:"task",id:task.id}})} style={{position:"relative",paddingLeft:14,marginBottom:3,cursor:"pointer"}}>
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
                        <div key={task.id} onClick={()=>onPick({ref:{kind:"task",id:task.id}})} style={{position:"relative",paddingLeft:14,marginBottom:3,cursor:"pointer"}}>
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
  </>);
}
function MindMapPage({D,cu,nav}){
  const [scope,setScope]=useState("person");   // person | team
  const [boardView,setBoardView]=useState("tree");
  const [teamView,setTeamView]=useState("members");   // members(멤버 현황) | weekly(그로스보드)
  const [mapStyle,setMapStyle]=useState("tree");   // tree(계층형) | mind(마인드맵)
  const [period,setPeriod]=useState("week");
  const prange=periodRange(period);
  const inP=(ds)=>{if(!ds)return false;const d=new Date(ds);return !isNaN(d)&&d>=prange[0]&&d<=prange[1];};
  // 활동: 선택 기간에 진행예정(workDate)·완료(doneAt)가 있으면. (주간은 요일배치도 폴백)
  const activeInP=(t)=>inP(t.workDate)||inP(t.doneAt)||(period==="week"&&!!(t.weekDay&&WEEK_DAYS.includes(t.weekDay)));
  // 성과: 기간 내 완료 업무 수
  const doneInP=(ts)=>ts.filter(t=>t.status==="done"&&inP(t.doneAt)).length;
  const [sel,setSel]=useState(cu.id);
  const user=D.users.find(u=>u.id===sel);
  const myP=D.projects.filter(p=>p.assigneeId===sel);
  const myMK=[...new Set(myP.filter(p=>p.mainKPIId).map(p=>p.mainKPIId))].map(id=>D.mainKPIs.find(m=>m.id===id)).filter(Boolean);
  const krColors={mk1:"#3182F6",mk2:"#8B5CF6",mk3:"#00C073"};
  const isThisWeek=activeInP;   // 활동 판정을 선택 기간 기준으로
  const [krF,setKrF]=useState("all");        // KR 필터 (all|mk.id)
  const [activeOnly,setActiveOnly]=useState(false);  // 활동만 보기
  const [showFilters,setShowFilters]=useState(false);  // 범례·KR필터 접기(기본 접힘)
  const [picked,setPicked]=useState(null);   // 마인드맵 노드 상세(읽기전용)
  const signals=diagSignals(D);
  const pprev=prevPeriodRange(period);
  const doneInPrev=(ts)=>ts.filter(t=>{if(t.status!=="done"||!t.doneAt)return false;const d=new Date(t.doneAt);return !isNaN(d)&&d>=pprev[0]&&d<=pprev[1];}).length;
  const krProjIds=new Set(D.projects.filter(p=>p.assigneeId===sel&&(krF==="all"||p.mainKPIId===krF)).map(p=>p.id));
  const myTasks=D.tasks.filter(t=>!t.isFixed&&t.assigneeId===sel&&(krF==="all"||krProjIds.has(t.projectId)));
  const doneNow=doneInP(myTasks),donePrev=doneInPrev(myTasks),delta=doneNow-donePrev;
  return(
    <div style={{padding:"14px 16px 20px"}}>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["person","🙋 개인"],["team","👥 팀"]].map(([k,l])=>(
          <button key={k} onClick={()=>setScope(k)} style={{flex:1,padding:"10px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:scope===k?"#0F1F5C":"#F2F4F6",color:scope===k?"#fff":"#374151",fontWeight:800,fontSize:13.5,fontFamily:"inherit"}}>{l}</button>
        ))}
      </div>
      {scope==="team"&&(<>
        <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
          {[{k:"members",l:"👥 팀 현황"},{k:"weekly",l:"📈 그로스보드"}].map(v=>(
            <button key={v.k} onClick={()=>setTeamView(v.k)} style={{flex:1,padding:"9px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:teamView===v.k?"#FFFFFF":"transparent",color:teamView===v.k?"#0F1F5C":"#6B7280",fontWeight:teamView===v.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:teamView===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
          ))}
        </div>
        {teamView==="members"&&<TeamBoard D={D} cu={cu} nav={nav}/>}
        {teamView==="weekly"&&<TeamWeeklyMap D={D} cu={cu}/>}
      </>)}
      {scope==="person"&&(<>
      <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:14,padding:4,marginBottom:14}}>
        {[{k:"tree",l:"◈ 담당자 트리"},{k:"weekly",l:"📈 그로스보드"}].map(v=>(
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
          <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            {PERIODS.map(([k,l])=>{const on=period===k;return(<button key={k} onClick={()=>setPeriod(k)} style={{flex:"1 0 auto",padding:"7px 10px",borderRadius:9,border:`1.5px solid ${on?"#0F1F5C":"#E5E8EB"}`,background:on?"#0F1F5C":"#fff",color:on?"#fff":"#6B7280",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
            <button onClick={()=>setShowFilters(s=>!s)} style={{flexShrink:0,padding:"7px 10px",borderRadius:9,border:`1.5px solid ${showFilters||krF!=="all"||activeOnly?"#F97316":"#E5E8EB"}`,background:showFilters?"#FFF4EC":"#fff",color:showFilters||krF!=="all"||activeOnly?"#EA580C":"#9CA3AF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🔧 필터{showFilters?" ▴":" ▾"}</button>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10,padding:"8px 13px",backgroundColor:delta!==0?(delta>0?"#E8FAF1":"#FFF0F1"):"#F9FAFB",borderRadius:10,border:`1px solid ${delta>0?"#BBF0D3":delta<0?"#FFD7DC":"#F2F4F6"}`}}>
            <span style={{fontSize:11.5,fontWeight:700,color:"#4B5563"}}>✅ {PERIOD_LABEL[period]} 완료 <b style={{color:"#0F1F5C"}}>{doneNow}건</b></span>
            <span style={{fontSize:11,fontWeight:800,color:delta>0?"#00A862":delta<0?"#F04452":"#9CA3AF"}}>{delta>0?`▲ ${delta}`:delta<0?`▼ ${-delta}`:"– 0"} <span style={{fontWeight:600,color:"#9CA3AF"}}>vs {PREV_LABEL[period]}({donePrev})</span></span>
          </div>
          {showFilters&&(<>
          <div style={{display:"flex",gap:12,marginBottom:10,padding:"8px 14px",backgroundColor:"#FFFFFF",borderRadius:10,border:"1px solid #F2F4F6",flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#F97316"}}/><span style={{fontSize:11,color:"#4B5563",fontWeight:600}}>활동</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#D1D5DB"}}/><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>비활동</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:10.5,fontWeight:800,color:"#00A862",background:"#E8FAF1",borderRadius:5,padding:"1px 6px"}}>✅성과</span><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>완료·매출</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11}}>🎯</span><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>목표 대비</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11}}>🔴🧱💸</span><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>막힘·적체·헛심</span></div>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
            {[["all","전체"],...D.mainKPIs.map(m=>[m.id,m.krKey])].map(([k,l])=>{const on=krF===k;return(<button key={k} onClick={()=>setKrF(k)} style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${on?"#0F1F5C":"#E5E8EB"}`,background:on?"#0F1F5C":"#fff",color:on?"#fff":"#6B7280",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);})}
            <button onClick={()=>setActiveOnly(!activeOnly)} style={{marginLeft:"auto",padding:"5px 11px",borderRadius:20,border:`1.5px solid ${activeOnly?"#F97316":"#E5E8EB"}`,background:activeOnly?"#FFF4EC":"#fff",color:activeOnly?"#EA580C":"#9CA3AF",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{activeOnly?"✓ 활동만":"활동만"}</button>
          </div>
          </>)}
          <div style={{display:"flex",backgroundColor:"#F2F4F6",borderRadius:11,padding:3,marginBottom:12}}>
            {[{k:"tree",l:"≡ 계층형"},{k:"mind",l:"🧠 마인드맵"}].map(v=>(
              <button key={v.k} onClick={()=>setMapStyle(v.k)} style={{flex:1,padding:"7px 0",borderRadius:9,border:"none",cursor:"pointer",backgroundColor:mapStyle===v.k?"#FFFFFF":"transparent",color:mapStyle===v.k?"#0F1F5C":"#6B7280",fontWeight:mapStyle===v.k?800:500,fontSize:12.5,fontFamily:"inherit",boxShadow:mapStyle===v.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{v.l}</button>
            ))}
          </div>
          {mapStyle==="mind"&&(<>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
              <button onClick={()=>exportMapPNG(buildPersonMapItems(D,sel,isThisWeek,doneInP,krColors,{krF,activeOnly,signals}),`${user?.name||"개인"}_그로스보드_${PERIOD_LABEL[period]}`)} style={{padding:"6px 12px",borderRadius:9,border:"1.5px solid #E5E8EB",background:"#fff",color:"#4B5563",fontSize:11.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>🖼 이미지 저장</button>
            </div>
            <MapCanvas items={buildPersonMapItems(D,sel,isThisWeek,doneInP,krColors,{krF,activeOnly,signals})} onPick={setPicked}/>
          </>)}
          {mapStyle==="tree"&&<WeeklyTree D={D} sel={sel} isThisWeek={isThisWeek} doneInP={doneInP} krColors={krColors} krF={krF} activeOnly={activeOnly} signals={signals} onPick={setPicked}/>}
        </div>
      )}
      </>)}
      <NodeDetail D={D} node={picked} period={period} onClose={()=>setPicked(null)}/>
    </div>
  );
}
function FixedPage({D,cu,lead,add,up,rm,nav}){
  const todayKey=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({title:"",projectId:"",assigneeIds:[cu.id],forAll:false,recurType:"daily",weekDay:"월",monthDay:1,fixedTime:""});
  const [modal,setModal]=useState(false);
  const [viewAll,setViewAll]=useState(false);
  const [confirmId,setConfirmId]=useState(null);
  const [editTarget,setEditTarget]=useState(null);
  const fixed=D.tasks.filter(t=>t.isFixed&&(viewAll&&lead?true:fixedIsMine(t,cu.id)));
  const doAdd=()=>{
    if(!form.title.trim()) return;
    add("tasks",{id:"t"+Date.now(),title:form.title.trim(),projectId:form.projectId,type:"fixed",status:"todo",weekSlot:null,isFixed:true,dueDate:"",memo:"",attachments:[],recurType:form.recurType,weekDay:form.recurType==="weekly"?form.weekDay:null,monthDay:form.recurType==="monthly"?Number(form.monthDay):null,fixedTime:form.fixedTime||"",
      forAll:!!form.forAll,assigneeIds:form.forAll?[]:form.assigneeIds,assigneeId:form.forAll?"":(form.assigneeIds[0]||"")});
    setForm({title:"",projectId:"",assigneeIds:[cu.id],forAll:false,recurType:form.recurType,weekDay:form.weekDay,monthDay:form.monthDay,fixedTime:form.fixedTime});setModal(false);
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
            const assignees=t.forAll?D.users:fixedAssigneeIds(t).map(id=>D.users.find(u=>u.id===id)).filter(Boolean);
            return(
              <div key={t.id} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:"14px 16px",border:"1px solid #F2F4F6"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>📌</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:14,fontWeight:800,color:"#111827"}}>{t.title}</p>
                    <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                      {proj&&<Badge color="#8B5CF6" bg="#F3EFFE">📁 {proj.title}</Badge>}
                      <Badge color="#F97316" bg="#FFEDD5">🔄 {t.recurType==="weekly"?(t.weekDay||"월")+"요일":t.recurType==="monthly"?"매월 "+(t.monthDay||1)+"일":"매일"}</Badge>
                      {t.fixedTime&&<Badge color="#0891B2" bg="#E0F2FE">🕐 {t.fixedTime}</Badge>}
                      {fixedDoneOn(t,cu.id)===todayKey&&<Badge color="#00A862" bg="#E8FAF1">✓ 오늘 체크</Badge>}
                      {t.forAll?<Badge color="#0F1F5C" bg="#E5E9F5">👥 전체</Badge>:assignees.map(u=><Badge key={u.id} color={u.color} bg={u.color+"22"}>👤 {u.name}</Badge>)}
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
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>🕐 시간 <span style={{color:"#9CA3AF",fontWeight:600}}>(선택 · 예: 09:00)</span></label><input type="time" value={form.fixedTime||""} onChange={e=>setForm({...form,fixedTime:e.target.value})} style={{width:"100%",padding:"11px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>반복 주기</label><div style={{display:"flex",gap:6}}>{[["daily","매일"],["weekly","매주"],["monthly","매월"]].map(([k,l])=>(<button key={k} onClick={()=>setForm({...form,recurType:k})} style={{flex:1,padding:"10px 0",borderRadius:10,border:`1.5px solid ${form.recurType===k?"#F97316":"#E5E8EB"}`,backgroundColor:form.recurType===k?"#FFEDD5":"#FFFFFF",color:form.recurType===k?"#EA580C":"#6B7280",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}</div>{form.recurType==="weekly"&&<select value={form.weekDay} onChange={e=>setForm({...form,weekDay:e.target.value})} style={{width:"100%",marginTop:8,padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{ALL_DAYS.map(d=><option key={d} value={d}>{d}요일</option>)}</select>}{form.recurType==="monthly"&&<select value={form.monthDay} onChange={e=>setForm({...form,monthDay:Number(e.target.value)})} style={{width:"100%",marginTop:8,padding:"10px 14px",borderRadius:12,fontSize:14,border:"1.5px solid #E5E8EB",outline:"none",backgroundColor:"#FFFFFF",fontFamily:"inherit",WebkitAppearance:"none"}}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>매월 {d}일</option>)}</select>}</div>
          {lead&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>담당자 <span style={{color:"#9CA3AF",fontWeight:600}}>(여러 명 선택 · 전체 가능)</span></label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button type="button" onClick={()=>setForm({...form,forAll:!form.forAll,assigneeIds:[]})} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${form.forAll?"#0F1F5C":"#E5E8EB"}`,background:form.forAll?"#0F1F5C":"#fff",fontSize:12,fontWeight:800,color:form.forAll?"#fff":"#4B5563",cursor:"pointer",fontFamily:"inherit"}}>⭐ 전체</button>
              {D.users.map(u=>{const sel=form.forAll||form.assigneeIds.includes(u.id);return(
                <button key={u.id} type="button" onClick={()=>setForm(f=>{const has=f.assigneeIds.includes(u.id);return{...f,forAll:false,assigneeIds:f.forAll?[u.id]:(has?f.assigneeIds.filter(x=>x!==u.id):[...f.assigneeIds,u.id])};})} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`1.5px solid ${sel?u.color:"#E5E8EB"}`,background:sel?u.color+"18":"#fff",cursor:"pointer",fontFamily:"inherit"}}><Ava name={u.name} color={u.color} size={18}/><span style={{fontSize:12,fontWeight:700,color:sel?u.color:"#4B5563"}}>{u.name}</span>{sel&&!form.forAll&&<span style={{fontSize:11,fontWeight:900,color:u.color}}>✓</span>}</button>
              );})}
            </div>
            <p style={{margin:"6px 2px 0",fontSize:11,color:"#9CA3AF"}}>{form.forAll?`전 담당자 ${D.users.length}명에게 표시됩니다`:form.assigneeIds.length>1?`${form.assigneeIds.length}명에게 표시 · 각자 따로 체크`:"담당자 각자 오늘 화면에 표시"}</p></div>}
          <Btn full variant="orange" onClick={doAdd} disabled={!form.title.trim()}>추가하기</Btn>
        </div>
      </Sheet>
      <EditTaskSheet open={!!editTarget} onClose={()=>setEditTarget(null)} task={editTarget} D={D} add={add} up={up} onSave={f=>up("tasks",editTarget.id,{title:f.title,status:f.status,parentId:f.parentId||null,dueDate:f.dueDate,memo:f.memo,projectId:f.projectId,assigneeId:(f.forAll?"":((f.assigneeIds||[])[0]||"")),assigneeIds:f.assigneeIds||[],forAll:!!f.forAll,attachments:f.attachments,weekDay:f.weekDay||null,weekSlot:f.weekSlot??null,workDate:f.workDate||null,fixedTime:f.fixedTime||null,...(f.statusLog?{statusLog:f.statusLog,doneAt:f.doneAt,doneBy:f.doneBy,doneByName:f.doneByName}:{})})}/>
      <Confirm open={!!confirmId} title="고정업무 삭제" desc={`"${D.tasks.find(t=>t.id===confirmId)?.title}" 업무를 삭제할까요?\n휴지통으로 이동하며 언제든 복구할 수 있어요.`} onOk={()=>{rm("tasks",confirmId);setConfirmId(null);}} onCancel={()=>setConfirmId(null)}/>
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
    setRForm(thisMonth?{...thisMonth}:{pain:diagSummary(D,month),effort:gs,learned:"",next:""});setRetroModal(true);
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
        {[{k:"goal",l:"📊 월간 목표"},{k:"retro",l:"📔 월말 회고"},{k:"diag",l:"🩺 진단"}].map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"10px 0",borderRadius:11,border:"none",cursor:"pointer",backgroundColor:tab===t.k?"#FFFFFF":"transparent",color:tab===t.k?"#0F1F5C":"#6B7280",fontWeight:tab===t.k?800:500,fontSize:13,fontFamily:"inherit",boxShadow:tab===t.k?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>)}
      </div>
      {tab==="diag"&&<TeamDiagnose D={D} cu={cu}/>}
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
          {[["완료 업무",wTask,"✅"],["매출 입력",wSales,"💰"],["활동지표",wAct,"🎯"]].map(([l,v,ic])=>(
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
      <p style={{margin:"0 2px 10px",fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>내가 맡은 프로젝트에 <b>누가 얼마나</b> 기여했는지(완료 업무·매출·활동지표 기록 기준)예요.</p>
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
function ExportPanel({D,up,restore,restoreLocal,pushExternalBackup}){
  const uname=(id)=>D.users.find(u=>u.id===id)?.name||"";
  // 외부(GitHub) 자동 백업 상태 + 즉시 백업
  const [ext,setExt]=useState({configured:null,repo:null,busy:false,msg:""});
  const extAt=(()=>{try{return localStorage.getItem(EXT_BACKUP_AT_KEY);}catch(_){return null;}})();
  useEffect(()=>{ let on=true; fetch("/api/backup").then(r=>r.json()).then(j=>{ if(on)setExt(e=>({...e,configured:!!j.configured,repo:j.repo||null})); }).catch(()=>{ if(on)setExt(e=>({...e,configured:false})); }); return ()=>{on=false;}; },[]);
  const doExtBackup=async()=>{
    if(!pushExternalBackup) return;
    setExt(e=>({...e,busy:true,msg:""}));
    const j=await pushExternalBackup("manual");
    if(j&&j.ok){ setExt(e=>({...e,busy:false,configured:true,msg:`✅ GitHub 백업 완료 (${(j.path||"").split("/").pop()})`})); }
    else if(j&&j.configured===false){ setExt(e=>({...e,busy:false,configured:false,msg:"⚙️ 외부 백업 미설정 — 아래 안내대로 환경변수를 추가하세요."})); }
    else{ setExt(e=>({...e,busy:false,msg:"❌ "+((j&&j.error)||"실패")})); }
  };
  // 이 기기 영구 보관(IndexedDB) 상태 + 로컬 복구
  const [idbStat,setIdbStat]=useState({mirrorAt:null,snaps:[]});
  const refreshIdb=()=>{ (async()=>{ try{ const m=await idbLoadMirror(); const s=await idbListSnapshots(); setIdbStat({mirrorAt:m&&m.at||null,snaps:s||[]}); }catch(_){} })(); };
  useEffect(()=>{ refreshIdb(); },[]);
  const doRestoreMirror=async()=>{
    if(!restoreLocal) return;
    try{ const m=await idbLoadMirror();
      if(!m||!m.data){ window.alert("이 기기에 저장된 로컬 미러가 아직 없어요. (자동 보관은 데이터 변경 시 시작됩니다)"); return; }
      if(!window.confirm(`이 기기 로컬 미러(${(m.at||"").slice(0,16).replace("T"," ")})로 현재 데이터를 덮어쓸까요?\n현재 화면의 모든 항목이 이 백업 시점으로 되돌아갑니다.\n(덮어쓰기 전 '전체 백업(JSON)'을 먼저 받아두는 걸 권장)`)) return;
      const n=restoreLocal(m.data); window.alert(`✅ 로컬 미러에서 복구했어요 (총 ${n}건). 잠시 후 클라우드에도 자동 반영됩니다.`);
    }catch(e){ window.alert("복구 실패: "+(e&&e.message||e)); }
  };
  const doRestoreSnap=async(key,at)=>{
    if(!restoreLocal) return;
    try{ const s=await idbGetSnapshot(key);
      if(!s||!s.data){ window.alert("스냅샷을 읽지 못했어요."); return; }
      if(!window.confirm(`${(at||"").slice(0,16).replace("T"," ")} 시점 스냅샷으로 되돌릴까요?\n현재 데이터를 이 시점으로 덮어씁니다.`)) return;
      const n=restoreLocal(s.data); window.alert(`✅ ${(at||"").slice(5,16).replace("T"," ")} 스냅샷으로 복구 (총 ${n}건).`);
    }catch(e){ window.alert("복구 실패: "+(e&&e.message||e)); }
  };
  // 예시(데모) KPI·채널 수치 0으로 초기화 — 목표·구조는 유지, 현재 숫자만 비움
  const resetNums=()=>{
    if(!up) return;
    if(!window.confirm("KPI·채널의 현재 수치를 모두 0으로 초기화할까요?\n목표·구조(직판/B2B/운영·채널)는 그대로 두고 현재 숫자만 0으로 만듭니다.\n입력 이력(📜)은 자산으로 보존됩니다. (전체 백업(JSON) 권장)")) return;
    (D.subKPIs||[]).forEach(s=>up("subKPIs",s.id,{currentValue:0}));    // 이력(valueHistory)은 지우지 않음 — 데이터 자산화
    (D.mainKPIs||[]).forEach(m=>up("mainKPIs",m.id,{currentValue:0}));
    (D.goals||[]).forEach(g=>up("goals",g.id,{currentValue:0}));
  };
  const goalTypeL={revenue:"매출",metric:"활동지표",journey:"구축"};
  const expProjects=()=>{
    const rows=[["제목","그룹","담당자","목표유형","거래처유형","메인KPI","서브KPI","우선순위","상태","진척도%","진척방식","업무(완료/전체)","매출(원)","매출입력자","매출최종일","활동지표"]];
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
    const rows=[["프로젝트","담당자","완료업무","매출입력","활동지표","합계","이번주"]];
    (D.projects||[]).forEach(p=>projContrib(D,p).forEach(r=>rows.push([p.title,uname(r.uid),r.task,r.sales,r.act,r.total,r.wk])));
    if(rows.length===1)return alert("기여 기록이 없어요");
    downloadCSV(rows,"기여도");
  };
  const expIndicators=()=>{
    const rows=[["프로젝트","지표명","단위","현재","목표","달성%","최종입력자"]];
    (D.projects||[]).forEach(p=>(p.activityKPIs||[]).forEach(ak=>rows.push([p.title,ak.name,ak.unit||"",numF(ak.current),numF(ak.target),pct(numF(ak.current),numF(ak.target)),ak.byName||""])));
    if(rows.length===1)return alert("활동지표가 없어요");
    downloadCSV(rows,"활동지표");
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
  const items=[["✅ 업무 전체",expTasks],["📁 프로젝트 전체",expProjects],["💰 매출 이력",expSales],["📊 KPI 주차 실적",expKpi],["👥 기여도",expContrib],["🎯 활동지표",expIndicators],["📝 주간 메모",expWeekGoals]];
  // 분할 저장 → 한도는 컬렉션별로 적용. 가장 큰 컬렉션이 실질 제약.
  const colSizes=SHARED_KEYS.map(k=>[k,new Blob([JSON.stringify(pickShared(D)[k]||[])]).size]).sort((a,b)=>b[1]-a[1]);
  const [maxKey,maxBytes]=colSizes[0]||["",0];
  const totalBytes=colSizes.reduce((s,[,b])=>s+b,0);
  const pctUsed=Math.min(100,Math.round(maxBytes/DOC_LIMIT*100));
  const barColor=pctUsed>=85?"#DC2626":pctUsed>=60?"#D97706":"#059669";
  const mirrorAt=(()=>{try{return localStorage.getItem(MIRROR_AT_KEY);}catch(_){return null;}})();
  const trash=D.trash||[];
  return(
    <>
    {/* 휴지통 — 삭제된 모든 데이터는 사라지지 않고 보관됨(복구 가능). 데이터 자산화 원칙. */}
    <div style={{background:"#FFFFFF",borderRadius:16,padding:"14px 16px",marginTop:14,border:"1px solid #F2F4F6"}}>
      <h3 style={{margin:"0 0 3px",fontSize:15,fontWeight:900,color:"#0F1F5C"}}>🗑 휴지통 {trash.length>0&&<span style={{fontSize:12,fontWeight:800,color:"#EA580C"}}>({trash.length})</span>}</h3>
      <p style={{margin:"0 0 10px",fontSize:10.5,color:"#9CA3AF"}}>삭제한 업무·KPI·프로젝트는 <b>사라지지 않고 여기 보관</b>돼요 — 언제든 복구할 수 있어요</p>
      {trash.length===0?(
        <p style={{margin:0,fontSize:11.5,color:"#B0B8C1",textAlign:"center",padding:"14px 0"}}>삭제된 데이터가 없어요</p>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[...trash].reverse().slice(0,60).map(t=>(
            <div key={t._tid} style={{display:"flex",alignItems:"center",gap:8,background:"#F9FAFB",borderRadius:10,padding:"8px 10px"}}>
              <span style={{flexShrink:0,fontSize:9.5,fontWeight:800,color:"#6B7280",background:"#EEF1F4",borderRadius:5,padding:"2px 6px"}}>{COL_LABEL[t._col]||t._typeLabel||t._col}</span>
              <span style={{flex:1,minWidth:0,fontSize:12,fontWeight:700,color:"#1F2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title||t.name||t.companyName||t.targetName||t.week||t._label||t.id||"(제목 없음)"}</span>
              <span style={{flexShrink:0,fontSize:9.5,color:"#9CA3AF"}}>{(t._deletedAt||"").slice(5,10)}{t._deletedByName?" · "+t._deletedByName:""}</span>
              <button onClick={()=>{ if(t._col==="_nested"&&!(D[t._parentCol]||[]).some(x=>x.id===t._parentId)){ window.alert(`먼저 상위 '${COL_LABEL[t._parentCol]||t._parentCol}'을(를) 복구한 뒤에 이 항목을 복구할 수 있어요.`); return; } restore(t._tid); }} style={{flexShrink:0,padding:"5px 10px",borderRadius:8,border:"1px solid #DBE3FF",background:"#fff",color:"#3182F6",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>복구</button>
            </div>
          ))}
          {trash.length>60&&<p style={{margin:"4px 0 0",fontSize:10,color:"#9CA3AF",textAlign:"center"}}>최근 60건 표시 · 전체 {trash.length}건은 백업(JSON)에 모두 보존됩니다</p>}
        </div>
      )}
    </div>
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
      {/* 이 기기 영구 보관(IndexedDB) — 클라우드와 별개 3차 안전망 + 시점 복구 */}
      <div style={{marginBottom:4,padding:"11px 12px",background:"#F0F7FF",border:"1px solid #D5E6FB",borderRadius:11}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:3}}>
          <p style={{margin:0,fontSize:12.5,fontWeight:900,color:"#0F1F5C"}}>🛟 이 기기 영구 보관</p>
          <button onClick={refreshIdb} style={{padding:"3px 8px",borderRadius:7,border:"1px solid #DBE3FF",background:"#fff",color:"#3182F6",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>새로고침</button>
        </div>
        <p style={{margin:"0 0 8px",fontSize:10,color:"#6B7280",lineHeight:1.5}}>클라우드와 <b>별개로</b> 이 기기에 대용량 자동 보관(IndexedDB) + 15분마다 시점 스냅샷. 클라우드에 문제가 생겨도 여기서 되돌릴 수 있어요.</p>
        <p style={{margin:"0 0 8px",fontSize:9.5,color:"#9CA3AF"}}>최근 자동 보관: <b style={{color:"#374151"}}>{idbStat.mirrorAt?idbStat.mirrorAt.slice(0,16).replace("T"," "):"아직 없음"}</b> · 스냅샷 {idbStat.snaps.length}개</p>
        <button onClick={doRestoreMirror} style={{width:"100%",padding:"9px 0",borderRadius:9,border:"1.5px solid #BFDBFE",background:"#fff",color:"#1D4ED8",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:idbStat.snaps.length?8:0}}>↩ 이 기기 최신 백업에서 복구</button>
        {idbStat.snaps.length>0&&(<>
          <p style={{margin:"2px 0 5px",fontSize:10,fontWeight:800,color:"#6B7280"}}>시점 스냅샷에서 복구</p>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:150,overflowY:"auto"}}>
            {idbStat.snaps.slice(0,12).map(s=>(
              <button key={s.key} onClick={()=>doRestoreSnap(s.key,s.at)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 10px",borderRadius:8,border:"1px solid #E5E8EB",background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{fontSize:11,fontWeight:700,color:"#374151"}}>{(s.at||"").slice(0,16).replace("T"," ")}</span>
                <span style={{fontSize:10,fontWeight:800,color:"#3182F6"}}>되돌리기</span>
              </button>
            ))}
          </div>
        </>)}
      </div>
      {/* 외부(GitHub) 자동 백업 — 한도 80% 임박 시 자동 + 즉시 백업 */}
      <div style={{marginTop:10,padding:"11px 12px",background:"#F6F8FA",border:"1px solid #E1E4E8",borderRadius:11}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
          <p style={{margin:0,fontSize:12.5,fontWeight:900,color:"#0F1F5C"}}>🐙 외부 자동 백업 (GitHub)</p>
          {ext.configured===true&&<span style={{fontSize:9.5,fontWeight:800,color:"#fff",background:"#00A862",borderRadius:6,padding:"2px 6px"}}>설정됨</span>}
          {ext.configured===false&&<span style={{fontSize:9.5,fontWeight:800,color:"#fff",background:"#9CA3AF",borderRadius:6,padding:"2px 6px"}}>미설정</span>}
        </div>
        <p style={{margin:"0 0 8px",fontSize:10,color:"#6B7280",lineHeight:1.5}}>저장 용량이 <b>한도의 80%</b>를 넘으면 전체 데이터를 <b>자동</b>으로 GitHub에 커밋해 둡니다(12시간 1회). 매일 정기 백업(Actions)과 별개로 즉시 보관.</p>
        <p style={{margin:"0 0 8px",fontSize:9.5,color:"#9CA3AF"}}>마지막 외부 백업: <b style={{color:"#374151"}}>{extAt?extAt.slice(0,16).replace("T"," "):"아직 없음"}</b>{ext.repo?` · ${ext.repo}`:""}</p>
        <button onClick={doExtBackup} disabled={ext.busy} style={{width:"100%",padding:"10px 0",borderRadius:9,border:"none",background:ext.busy?"#9CA3AF":"#24292F",color:"#fff",fontSize:12.5,fontWeight:800,cursor:ext.busy?"default":"pointer",fontFamily:"inherit"}}>{ext.busy?"백업 중…":"🐙 지금 GitHub에 백업"}</button>
        {ext.msg&&<p style={{margin:"7px 0 0",fontSize:11,fontWeight:700,color:ext.msg.startsWith("✅")?"#00A862":ext.msg.startsWith("⚙️")?"#D97706":"#F04452"}}>{ext.msg}</p>}
        {ext.configured===false&&<div style={{marginTop:8,padding:"9px 10px",background:"#fff",border:"1px dashed #D1D5DB",borderRadius:8}}>
          <p style={{margin:"0 0 4px",fontSize:10,fontWeight:800,color:"#374151"}}>설정 방법 (Cloudflare Pages ▸ Settings ▸ Environment variables)</p>
          <p style={{margin:0,fontSize:9.5,color:"#6B7280",lineHeight:1.6,fontFamily:"'IBM Plex Mono',monospace"}}>GITHUB_TOKEN = (contents 쓰기 권한 PAT)<br/>GITHUB_BACKUP_REPO = netformrnd-lab/pour-construction-form</p>
        </div>}
      </div>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#6B7280"}}>항목별 추출 (엑셀/CSV)</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {items.map(([l,fn])=>(<button key={l} onClick={fn} style={{padding:"11px 8px",borderRadius:11,border:"1.5px solid #E5E8EB",background:"#F9FAFB",fontSize:12,fontWeight:700,color:"#374151",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>⬇ {l}</button>))}
      </div>
    </div>
    </>
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
