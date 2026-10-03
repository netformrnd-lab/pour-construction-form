// 업무OS v2 — 흐름으로 만들기 (프로모션 8단계 등): 단계마다 업무 1건 + 바로 앞 단계를 앞 일(deps)로 걸어 '앞사람 끝나면 내 차례'가 저절로 됨
// 단계 이름은 버전1 workflows 문서(stages)를 쓰고, 흐름 이름만 여기 표에서 찾는다(버전1 문서에는 이름 칸이 없음)
import { ymd, addDays, isOffDay, newId } from "./model.js";

const S = (id, name, desc) => ({ id, name, ...(desc ? { desc } : {}) });
// 버전1 workflow.js DEFAULT_WORKFLOWS 와 같은 내용 (D.workflows 가 비었을 때만 씀)
export const FLOW_DEFAULTS = [
  { id: "wf_promo", name: "자사몰 프로모션", hint: "예: 10월 추석 프로모션", stages: [S("plan", "기획", "전년 매출·레퍼런스"), S("confirm", "기획안 컨펌"), S("img", "이미지 제작", "배너·팝업·메타·썸네일"), S("setup", "쿠폰·랜딩·진열"), S("test", "할인 테스트"), S("open", "오픈"), S("sms", "단체문자"), S("result", "결과 정리")] },
  { id: "wf_cpc", name: "CPC 광고", hint: "예: 메타 · 씰맥스프로 전환", stages: [S("creative", "소재 제작"), S("launch", "캠페인 등록"), S("review", "검수 통과"), S("budget", "예산·입찰"), S("roas", "주간 ROAS 체크"), S("decide", "증액·중단 결정")] },
  { id: "wf_blog", name: "블로그 포스팅", hint: "예: MMA 바닥 셀프시공 후기", stages: [S("draft", "초안"), S("confirm", "컨펌"), S("upload", "업로드"), S("dash", "대시보드 등록")] },
  { id: "wf_review", name: "체험단 캠페인", hint: "예: 티블 13회차 · 드라이비트", stages: [S("form", "양식 작성"), S("post", "캠페인 게시"), S("pick", "리뷰어 발표"), S("ship", "발주·송장"), S("content", "콘텐츠 정리"), S("pay", "대금 품의")] },
  { id: "wf_shorts", name: "숏폼·촬영", hint: "예: 헤라퍼티 숏폼", stages: [S("plan", "기획"), S("place", "장소 섭외·품의"), S("shoot", "촬영"), S("sort", "영상 정리"), S("edit", "외주·편집"), S("upload", "업로드")] },
  { id: "wf_seller", name: "셀러·인플루언서 제안", hint: "예: 인포크 셀러 · ○○님", stages: [S("search", "서치"), S("deck", "제안서"), S("dm", "DM·메일"), S("deal", "계약·진행")] },
  { id: "wf_event", name: "행사·박람회", hint: "예: 2026 공유숙박 엑스포", stages: [S("apply", "참가 신청"), S("print", "현수막·인쇄물"), S("prep", "샘플·물품 준비"), S("run", "현장 운영"), S("follow", "리드 정리·후속 연락")] },
  { id: "wf_notice", name: "공지사항 관리", hint: "예: 추석 휴무 안내", stages: [S("reason", "사유 확인"), S("copy", "문구 작성"), S("banner", "배너 제작"), S("post", "채널 게시"), S("down", "내리기")] },
  { id: "wf_sys", name: "개발·개선 요청", hint: "예: CRM 입금내역 반영", stages: [S("req", "요청 정리"), S("dev", "개발"), S("test", "테스트"), S("share", "공유·인수인계")] },
  { id: "wf_dealer", name: "대리점 개설", hint: "예: 가나랜드 · 경남지사", stages: [S("meet", "방문 미팅"), S("contract", "계약서"), S("sign", "간판·시트지 시안"), S("kit", "초도물품"), S("open", "오픈 지원"), S("dash", "대시보드 제공")] },
  { id: "wf_order", name: "주문·발주", hint: "예: 제천롯데캐슬 트랩", stages: [S("check", "주문·입금 확인"), S("po", "발주(창고 선택)"), S("ship", "출고(택배·퀵)"), S("notify", "송장·차량번호 안내"), S("bill", "계산서·정산")] },
  { id: "wf_return", name: "반품·교환", hint: "예: 김희수 반품", stages: [S("recv", "접수(사유)"), S("pickup", "회수 확인"), S("inspect", "검수"), S("refund", "환불·교환", "마이너스 계산서"), S("notify", "안내 문자")] },
  { id: "wf_stock", name: "재고 입고", hint: "예: 안전용품 조끼", stages: [S("check", "재고 확인·실사"), S("order", "발주·입고 요청"), S("recv", "입고 확인")] },
];
const DEF = Object.fromEntries(FLOW_DEFAULTS.map((w) => [w.id, w]));

// 고를 수 있는 흐름: v2 workflows 문서(단계 있는 것, 신제품 제외) → 이름·예시는 기본표에서. 문서가 하나도 없으면 기본표
export function flowList(D) {
  const docs = (D.workflows || []).filter((w) => w && w.id !== "wf_launch" && Array.isArray(w.stages) && w.stages.length && !w.deleted);
  if (!docs.length) return FLOW_DEFAULTS.map((w) => ({ ...w, doc: null }));
  const order = FLOW_DEFAULTS.map((w) => w.id);
  return docs.map((w) => ({ id: w.id, name: w.name || (DEF[w.id] || {}).name || w.id, hint: (DEF[w.id] || {}).hint || "", stages: w.stages.filter((s) => s && s.name), doc: w }))
    .sort((a, b) => ((order.indexOf(a.id) + 1) || 99) - ((order.indexOf(b.id) + 1) || 99));
}

// 단계 기한: 내일(쉬는 날이면 다음 평일)부터 마지막 마감까지의 평일을 단계 수로 고르게 나눔. 마지막 단계 = 마지막 마감(고른 날 그대로)
// 마지막 단계 앞 단계들은 마감 전 평일에만 (마감이 주말·공휴일이어도 앞 단계는 쉬는 날에 안 놓임)
// 평일이 단계보다 적으면 여러 단계가 같은 날. 마감 전 평일이 하나도 없으면 모두 마감 날. 지난 날은 안 씀
export function flowDues(n, final, today) {
  if (!n || !final) return [];
  const last = final < today ? today : final, days = [];
  for (let k = addDays(today, 1), i = 0; i < 400 && k < last; i++, k = addDays(k, 1)) if (!isOffDay(k)) days.push(k);
  const m = days.length;
  return Array.from({ length: n }, (_, i) => (i === n - 1 || !m ? last : days[Math.min(m - 1, Math.max(0, Math.round(((i + 1) * (m + 1)) / n) - 1))]));
}

// 만들 내용 계산 (저장하지 않음). owners[i] = 단계 i 담당 id
export function planFlow({ wf, title, brand, leadId, due, owners }, D, me, today = ymd(new Date()), at = new Date().toISOString()) {
  const pid = newId("p"), bulk = newId("fl"), dues = flowDues(wf.stages.length, due, today);
  const project = { id: pid, title: title.trim(), assigneeId: leadId || me.id, collaboratorIds: [...new Set(owners.filter((u) => u && u !== (leadId || me.id)))], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "",
    dueDate: due, brand: brand || "", group: "기타", wfId: wf.id, createdAt: at, createdBy: me.id, madeIn: "v2", v2At: at };
  const ids = wf.stages.map(() => newId("t"));
  const tasks = wf.stages.map((s, i) => { const who = owners[i] || me.id, other = who !== me.id;
    return { id: ids[i], title: s.name, isFixed: false, type: "general", status: "todo", assigneeId: who, assigneeIds: [who], projectId: pid, parentId: null,
      dueDate: dues[i] || "", workDate: "", memo: s.desc || "", attachments: [], weekDay: null, weekSlot: null, priority: "mid", ...(brand ? { brand } : {}),
      deps: i ? [ids[i - 1]] : [], wfId: wf.id, wfStage: i, noReview: true, ownerAuto: false, ownerFrom: "set",
      ...(other ? { assignedBy: me.id, assignedAt: at, bulkId: bulk } : { ackAt: at }),
      requestedBy: me.id, requestedAt: at, createdAt: at, createdBy: me.id, statusLog: [{ by: me.id, byName: me.name, at, status: "todo" }], madeIn: "v2", v2At: at }; });
  const byWho = {}; tasks.forEach((t) => { (byWho[t.assigneeId] = byWho[t.assigneeId] || []).push(t); });
  return { project, tasks, byWho, dues, squeezed: dues.some((d, i) => i && d === dues[i - 1]) };
}
// 단계 담당 기본값: 지난번에 고른 담당(stages[i].ownerId) → 나
export const flowOwners = (wf, me, users) => wf.stages.map((s) => (s.ownerId && (users || []).some((u) => u.id === s.ownerId && u.active !== false) ? s.ownerId : me.id));
