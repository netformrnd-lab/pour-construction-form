// 워크플로우 = 카테고리별 '순서 체크리스트(로드맵)'.  건(case) = 그 체크리스트를 한 번 도는 대상(고객 1명 · 회차 1개 · 대리점 1곳).
// · 건은 업무(tasks) 1개로 저장 → 오늘·달력에도 그대로 이어짐.  wfId(워크플로우) · wfChecks{단계id:{at,by,byName}} · wfData{채널·광고비 등}
// · 신제품은 런칭보드 문서(pour-os/launch-board/products)가 원본 — 기존 단계는 stages.<id>, 업무OS 추가 칸은 osExtra.<id> 에 저장(기존 값 보존)
// · 기본 정의는 코드에, 사람이 바꾼 설정(단계 이름·담당·관리 담당·연결 프로젝트)만 D.workflows 에 저장(덮어쓰기 병합)

export const WF_CATS=[
  {k:"launch",   icon:"",name:"신제품 출시"},
  {k:"marketing",icon:"",name:"프로모션·마케팅"},
  {k:"notice",   icon:"",name:"공지사항"},
  {k:"system",   icon:"",name:"시스템 구축"},
  {k:"sales",    icon:"",name:"영업·B2B"},
  {k:"ops",      icon:"",name:"상시 운영"},
];
export const catOf=(k)=>WF_CATS.find(c=>c.k===k)||null;

// 실행 방식 — 실행 담당이 '직접' 하는지, 타 부서와 '협업'하는지, '외주'에 맡기는지
export const EXEC_TYPES=[
  {k:"self",    icon:"",label:"직접",    color:"#1E2F5C",bg:"#EEF0F5"},
  {k:"collab",  icon:"",label:"협업",    color:"#5E5A8C",bg:"#F0EFF5"},
  {k:"outsource",icon:"",label:"외주",   color:"#7A4A12",bg:"#F8F1E6"},
];
export const execOf=(k)=>EXEC_TYPES.find(e=>e.k===k)||EXEC_TYPES[0];

const S=(id,name,desc)=>({id,name,...(desc?{desc}:{})});
export const CPC_CHANNELS=["메타","디맨드젠","네이버쇼핑","애드부스트","쿠팡","구글","기타"];
export const NOTICE_KINDS=["휴무","품절","배송지연","가격변경","이벤트","기타"];

export const DEFAULT_WORKFLOWS=[
  // 📣 프로모션·마케팅
  {id:"wf_promo", cat:"marketing",icon:"",name:"자사몰 프로모션",unit:"회차",hint:"예: 10월 추석 프로모션",stages:[
    S("plan","기획","전년 매출·레퍼런스"),S("confirm","기획안 컨펌"),S("img","이미지 제작","배너·팝업·메타·썸네일"),S("setup","쿠폰·랜딩·진열"),
    S("test","할인 테스트"),S("open","오픈"),S("sms","단체문자"),S("result","결과 정리")]},
  {id:"wf_cpc",   cat:"marketing",icon:"",name:"CPC 광고",unit:"캠페인",hint:"예: 메타 · 씰맥스프로 전환",kind:"cpc",roasMin:300,stages:[
    S("creative","소재 제작"),S("launch","캠페인 등록"),S("review","검수 통과"),S("budget","예산·입찰"),S("roas","주간 ROAS 체크"),S("decide","증액·중단 결정")]},
  {id:"wf_blog",  cat:"marketing",icon:"",name:"블로그 포스팅",unit:"포스팅",hint:"예: MMA 바닥 셀프시공 후기",stages:[
    S("draft","초안"),S("confirm","컨펌"),S("upload","업로드"),S("dash","대시보드 등록")]},
  {id:"wf_review",cat:"marketing",icon:"",name:"체험단 캠페인",unit:"캠페인",hint:"예: 티블 13회차 · 드라이비트",stages:[
    S("form","양식 작성"),S("post","캠페인 게시"),S("pick","리뷰어 발표"),S("ship","발주·송장"),S("content","콘텐츠 정리"),S("pay","대금 품의")]},
  {id:"wf_shorts",cat:"marketing",icon:"",name:"숏폼·촬영",unit:"영상",hint:"예: 헤라퍼티 숏폼",stages:[
    S("plan","기획"),S("place","장소 섭외·품의"),S("shoot","촬영"),S("sort","영상 정리"),S("edit","외주·편집"),S("upload","업로드")]},
  {id:"wf_seller",cat:"marketing",icon:"",name:"셀러·인플루언서 제안",unit:"대상",hint:"예: 인포크 셀러 · ○○님",stages:[
    S("search","서치"),S("deck","제안서"),S("dm","DM·메일"),S("deal","계약·진행")]},
  {id:"wf_event", cat:"marketing",icon:"",name:"행사·박람회",unit:"행사",hint:"예: 2026 공유숙박 엑스포",stages:[
    S("apply","참가 신청"),S("print","현수막·인쇄물"),S("prep","샘플·물품 준비"),S("run","현장 운영"),S("follow","리드 정리·후속 연락")]},
  // 📢 공지사항 — 휴무·품절 등 배너로 안내하고, 내리는 날까지 챙김
  {id:"wf_notice",cat:"notice",icon:"",name:"공지사항 관리",unit:"공지",hint:"예: 추석 휴무 안내",kind:"notice",stages:[
    S("reason","사유 확인"),S("copy","문구 작성"),S("banner","배너 제작"),S("post","채널 게시","자사몰 팝업·스마트스토어·오늘의집·쿠팡"),S("down","내리기")]},
  // 🛠 시스템 구축 — 기능 요청 1건 = 1줄
  {id:"wf_sys",   cat:"system",icon:"",name:"개발·개선 요청",unit:"요청",hint:"예: CRM 입금내역 반영",stages:[
    S("req","요청 정리"),S("dev","개발"),S("test","테스트"),S("share","공유·인수인계")]},
  // 🤝 영업·B2B
  {id:"wf_dealer",cat:"sales",icon:"",name:"대리점 개설",unit:"대리점",hint:"예: 가나랜드 · 경남지사",stages:[
    S("meet","방문 미팅"),S("contract","계약서"),S("sign","간판·시트지 시안"),S("kit","초도물품"),S("open","오픈 지원"),S("dash","대시보드 제공")]},
  // 🔁 상시 운영 — 고객 1명·주문 1건 = 1줄
  {id:"wf_order", cat:"ops",icon:"",name:"주문·발주",unit:"주문",hint:"예: 제천롯데캐슬 트랩",stages:[
    S("check","주문·입금 확인"),S("po","발주(창고 선택)"),S("ship","출고(택배·퀵)"),S("notify","송장·차량번호 안내"),S("bill","계산서·정산")]},
  {id:"wf_return",cat:"ops",icon:"",name:"반품·교환",unit:"고객",hint:"예: 김희수 반품",stages:[
    S("recv","접수(사유)"),S("pickup","회수 확인"),S("inspect","검수"),S("refund","환불·교환","마이너스 계산서"),S("notify","안내 문자")]},
  {id:"wf_stock", cat:"ops",icon:"",name:"재고 입고",unit:"품목",hint:"예: 안전용품 조끼",stages:[
    S("check","재고 확인·실사"),S("order","발주·입고 요청"),S("recv","입고 확인")]},
];

// ── 신제품 출시: 런칭보드 단계(lb:true) + 업무OS 추가 칸. 큰 단계 7칸, 칸을 누르면 세부 체크 ──
const L=(id,name)=>({id,name,lb:true});
const X=(id,name,extra)=>({id,name,...(extra||{})});
export const LAUNCH_PHASES=[
  {k:"plan",   no:1,short:"기획",name:"기획",     items:[L("p01","시장조사"),L("p02","제품 선정"),L("p03","제품가 설정(판매가)"),L("p04","제조사 컨택(MOQ·납기)")]},
  {k:"sample", no:2,short:"샘플",name:"샘플",     items:[L("s01","샘플 수령"),X("x_test","품질·시공 테스트"),L("s02","판매전략 기획")]},
  {k:"pack",   no:3,short:"패킹",name:"패킹",     items:[L("d01","스티커 라벨 기획·카피"),L("s03","스티커 라벨 디자인"),L("d02","단상자 기획·카피"),L("s04","단상자 디자인"),
    L("d03","설명서 기획·카피"),L("s05","설명서 디자인"),X("x_color","컬러스티커"),X("x_expiry","유통기한 표시 확인"),X("x_print","인쇄 발주"),X("x_parts","구성품 기획·세팅",{desc:"구성품 있을 때만"})]},
  {k:"content",no:4,short:"콘텐츠",name:"콘텐츠",   items:[L("s06","상세페이지 기획"),L("s07","제품 촬영"),L("s08","상세페이지 디자인"),L("s09","섬네일 촬영"),L("s10","섬네일 디자인"),L("s11","최종 검수")]},
  {k:"channel",no:5,short:"채널",name:"채널 등록",items:[X("x_mall","자사몰 등록(옵션·가격)"),L("s12","판매채널 상품등록"),X("x_sabang","사방넷 송신"),X("x_domae","도매꾹·나비엠알오"),X("x_kw","네이버 키워드 상품명")]},
  {k:"stock",  no:6,short:"입고",name:"창고 입고",items:[X("x_msds","입고 서류 세팅 확인(MSDS 등)"),X("x_3pl","3PL 입고"),X("x_cgrowth","쿠팡 그로스 입고")]},
  {k:"promo",  no:7,short:"홍보",name:"출시 홍보",items:[X("x_b2b","B2B 고객 출시 안내"),
    X("x_rv_mall","리뷰작업 · 자사몰"),X("x_rv_ss","리뷰작업 · 스마트스토어"),X("x_rv_cp","리뷰작업 · 쿠팡"),
    X("x_ex_insta","체험단 · 인스타"),X("x_ex_blog","체험단 · 네이버블로그"),X("x_ex_yt","체험단 · 유튜브"),X("x_ex_ohou","체험단 · 오늘의집"),
    X("x_infl","인플루언서 협업"),X("x_ad_nshop","네이버쇼핑광고"),X("x_ad_boost","네이버 애드부스트"),X("x_ad_cp","쿠팡광고"),
    X("x_meta","메타 광고 올리기",{target:5,max:10}),X("x_dg","디맨드젠 광고",{target:5,max:10}),X("x_blog","블로그 포스팅",{target:3}),X("x_short","숏폼 생성",{target:3})]},
];
export const LAUNCH_ITEMS=LAUNCH_PHASES.flatMap(ph=>ph.items.map(it=>({...it,phase:ph.k})));
export const LAUNCH_COL="pour-os/launch-board/products";
// 런칭보드 브랜드 BM(= 관리 담당 기본값). 런칭보드 BRANDS 와 같은 값.
export const LAUNCH_BRANDS={grohome:{name:"그로홈",icon:"",bm:"김송희"},pourstore:{name:"POUR스토어",icon:"",bm:"이란"},barasday:{name:"바라스데이",icon:"",bm:"김소연"}};

// 기본 정의 + 사람이 저장한 설정(D.workflows) 병합.  cat 이 없는 사용자 워크플로우도 허용.
export function mergeWorkflows(saved){
  const ov=Array.isArray(saved)?saved:[];
  const byId=Object.fromEntries(ov.map(w=>[w.id,w]));
  const base=DEFAULT_WORKFLOWS.map(w=>{ const o=byId[w.id]; if(!o) return w; const m={...w,...o}; if(!Array.isArray(o.stages)||!o.stages.length) m.stages=w.stages; return m; });
  const custom=ov.filter(w=>!DEFAULT_WORKFLOWS.some(d=>d.id===w.id)&&w.id!=="wf_launch"&&Array.isArray(w.stages));
  return [...base,...custom].filter(w=>!w.hidden);
}
export const launchSettings=(saved)=>(Array.isArray(saved)?saved:[]).find(w=>w.id==="wf_launch")||{id:"wf_launch",defaults:{}};

// ── 건(case) 계산 ──
export const caseChecks=(t)=>(t&&t.wfChecks&&typeof t.wfChecks==="object")?t.wfChecks:{};
export const isChecked=(t,sid)=>!!caseChecks(t)[sid];
export function caseProgress(wf,t){ const st=(wf&&wf.stages)||[]; const ch=caseChecks(t); const done=st.filter(s=>ch[s.id]).length; return {done,total:st.length,pct:st.length?Math.round(done/st.length*100):0}; }
export function caseNext(wf,t){ const ch=caseChecks(t); return ((wf&&wf.stages)||[]).find(s=>!ch[s.id])||null; }
// 체크 상태 → 업무 상태: 전부 체크=완료 · 하나라도=진행중 · 없음=할일 (보류는 사람이 고른 것 유지)
export function caseStatusFor(wf,checks,prev){ const st=(wf&&wf.stages)||[]; const n=st.filter(s=>checks[s.id]).length;
  if(st.length&&n===st.length) return "done"; if(prev==="hold"&&n>0) return "hold"; return n>0?"inprogress":(prev==="hold"?"hold":"todo"); }
export function toggleCheck(wf,t,sid,actor){ const ch={...caseChecks(t)}; if(ch[sid]) delete ch[sid]; else ch[sid]={at:new Date().toISOString(),by:actor?.id||null,byName:actor?.name||""};
  return {wfChecks:ch,status:caseStatusFor(wf,ch,t.status)}; }
// 다음 차례 담당: 다음 단계 담당(워크플로우 설정) → 없으면 건 담당
export function caseTurnOwner(wf,t){ const nx=caseNext(wf,t); if(!nx) return null; return nx.ownerId||t.assigneeId||null; }
export const numOr0=(v)=>{ const n=Number(String(v??"").replace(/[^0-9.\-]/g,"")); return isFinite(n)?n:0; };
export function roasOf(t){ const d=(t&&t.wfData)||{}; const sp=numOr0(d.spend), rv=numOr0(d.revenue); if(!sp) return null; return Math.round(rv/sp*100); }

// ── 신제품(런칭보드 문서) 계산 ──
export function lbState(p,it){ const ex=((p&&p.osExtra)||{})[it.id]||{};
  if(it.lb){ const s=((p&&p.stages)||{})[it.id]||{}; return {status:s.status||"todo",owner:s.owner||"",due:s.due||"",note:s.note||"",exec:ex.exec||"",execNote:ex.execNote||"",count:0}; }
  const count=Number(ex.count||0);
  let status=ex.status||"todo"; if(it.target&&status!=="skip") status=count>=it.target?"done":count>0?"doing":(status==="done"?"done":status);
  return {status,owner:ex.owner||"",due:ex.due||"",note:ex.note||"",exec:ex.exec||"",execNote:ex.execNote||"",count}; }
export function phaseProgress(p,ph,today){ const st=ph.items.map(it=>({it,s:lbState(p,it)})).filter(x=>x.s.status!=="skip");
  const done=st.filter(x=>x.s.status==="done").length; const doing=st.some(x=>x.s.status==="doing");
  const late=st.some(x=>x.s.status!=="done"&&x.s.due&&today&&x.s.due<today);
  return {done,total:st.length,doing,late,pct:st.length?Math.round(done/st.length*100):0}; }
export function launchProgress(p){ const all=LAUNCH_ITEMS.map(it=>lbState(p,it)).filter(s=>s.status!=="skip"); const done=all.filter(s=>s.status==="done").length; return {done,total:all.length,pct:all.length?Math.round(done/all.length*100):0}; }
export function launchCurrentPhase(p){ return LAUNCH_PHASES.find(ph=>{ const pp=phaseProgress(p,ph); return pp.done<pp.total; })||null; }
export const launchLead=(p)=>(p&&p.lead)||((LAUNCH_BRANDS[p&&p.brand]||{}).bm)||"";
// 이름 맞추기: 런칭보드는 '민지'처럼 짧은 이름, 업무OS는 '김민지' → 끝이 같으면 같은 사람
export function nameMatch(owner,name){ const a=String(owner||"").trim(), b=String(name||"").trim(); if(!a||!b) return false; if(a===b) return true; return a.length>=2&&b.length>=2&&(b.endsWith(a)||a.endsWith(b)); }

// ── 정리 도우미: 프로젝트 이름으로 카테고리 추정 ──
const CAT_RULES=[
  ["launch",/출시|신제품|SKU/i],
  ["sales",/대리점|B2B|파트너|판매가|영업|관리주체/i],
  ["ops",/주문|발주|재고|반품|\bCS\b|배송/i],
  ["marketing",/광고|프로모션|마케팅|콘텐츠|후기|NPS|박람회|기부|체험단|블로그/i],
  ["system",/리뉴얼|구축|개발|시스템|CRM|어드민|프로세스|자동화|매거진/i],
];
export function guessCat(title){ const t=String(title||""); for(const [k,re] of CAT_RULES) if(re.test(t)) return k; return ""; }
// 워크플로우 ↔ 기존 프로젝트 연결 추정(이름) — 건을 추가하면 이 프로젝트 소속으로 저장
const WF_PROJ_RULES={wf_promo:/프로모션/,wf_cpc:/광고/,wf_blog:/광고/,wf_review:/광고/,wf_shorts:/광고/,wf_seller:/광고/,wf_event:/박람회|행사/,wf_dealer:/대리점/,wf_order:/주문|발주/,wf_return:/반품/,wf_stock:/재고/,wf_sys:/어드민/};
export function guessWfProject(wfId,projects){ const re=WF_PROJ_RULES[wfId]; if(!re) return ""; const p=(projects||[]).find(x=>re.test(String(x.title||""))); return p?p.id:""; }
