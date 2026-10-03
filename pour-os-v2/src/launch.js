// 업무OS v2 — 신제품 출시 = 프로젝트 1개 + 항목마다 업무 1건 (일반 업무와 같은 화면·같은 동작)
//
// · 출시일에서 거꾸로 계산해 항목마다 기한을 자동으로 넣는다 (주말이면 앞 금요일로)
// · 출시일까지 기간이 짧으면 남은 기간에 고르게 나눠 넣는다 (이미 지난 기한이 생기지 않게)
// · 출시일을 바꾸면 자동 기한(dueAuto)인 항목만 같이 움직인다. 사람이 바꾼 기한은 그대로
// · v1 런칭보드(pour-os/launch-board/products)는 읽기만 해서 v2 로 복사한다
import { addDays, ddays, ymd } from "./model.js";

const L = (id, name, off) => ({ id, name, off, lb: true });
const X = (id, name, off, extra) => ({ id, name, off, ...(extra || {}) });
// off = 출시일 기준 며칠 전(-)/후(+) 까지 끝낼지 (기본 기한 규칙 — 나중에 화면에서 고칠 수 있게 할 예정)
export const LAUNCH_PHASES = [
  { k: "plan", name: "기획", items: [L("p01", "시장조사", -56), L("p02", "제품 선정", -52), L("p03", "제품가 설정(판매가)", -49), L("p04", "제조사 컨택(MOQ·납기)", -49)] },
  { k: "sample", name: "샘플", items: [L("s01", "샘플 수령", -42), X("x_test", "품질·시공 테스트", -38), L("s02", "판매전략 기획", -35)] },
  { k: "pack", name: "패킹", items: [L("d01", "스티커 라벨 기획·카피", -35), L("s03", "스티커 라벨 디자인", -30), L("d02", "단상자 기획·카피", -35), L("s04", "단상자 디자인", -30),
    L("d03", "설명서 기획·카피", -35), L("s05", "설명서 디자인", -30), X("x_color", "컬러스티커", -28), X("x_expiry", "유통기한 표시 확인", -28), X("x_print", "인쇄 발주", -24), X("x_parts", "구성품 기획·세팅", -24, { optional: true })] },
  { k: "content", name: "콘텐츠", items: [L("s06", "상세페이지 기획", -28), L("s07", "제품 촬영", -24), L("s08", "상세페이지 디자인", -17), L("s09", "섬네일 촬영", -21), L("s10", "섬네일 디자인", -14), L("s11", "최종 검수", -10)] },
  { k: "channel", name: "채널 등록", items: [X("x_mall", "자사몰 등록(옵션·가격)", -7), L("s12", "판매채널 상품등록", -7), X("x_sabang", "사방넷 송신", -5), X("x_domae", "도매꾹·나비엠알오", -5), X("x_kw", "네이버 키워드 상품명", -7)] },
  { k: "stock", name: "창고 입고", items: [X("x_msds", "입고 서류 세팅 확인(MSDS 등)", -14), X("x_3pl", "3PL 입고", -5), X("x_cgrowth", "쿠팡 그로스 입고", -5)] },
  { k: "promo", name: "출시 홍보", items: [X("x_b2b", "B2B 고객 출시 안내", 0),
    X("x_rv_mall", "리뷰작업 · 자사몰", 7), X("x_rv_ss", "리뷰작업 · 스마트스토어", 7), X("x_rv_cp", "리뷰작업 · 쿠팡", 7),
    X("x_ex_insta", "체험단 · 인스타", 14), X("x_ex_blog", "체험단 · 네이버블로그", 14), X("x_ex_yt", "체험단 · 유튜브", 21), X("x_ex_ohou", "체험단 · 오늘의집", 14),
    X("x_infl", "인플루언서 협업", 21), X("x_ad_nshop", "네이버쇼핑광고", 0), X("x_ad_boost", "네이버 애드부스트", 3), X("x_ad_cp", "쿠팡광고", 0),
    X("x_meta", "메타 광고 올리기", 7, { target: 5 }), X("x_dg", "디맨드젠 광고", 7, { target: 5 }), X("x_blog", "블로그 포스팅", 14, { target: 3 }), X("x_short", "숏폼 생성", 14, { target: 3 })] },
];
export const LAUNCH_ITEMS = LAUNCH_PHASES.flatMap((ph) => ph.items.map((it) => ({ ...it, phase: ph.k, phaseName: ph.name })));
export const LAUNCH_BRANDS = { grohome: { name: "그로홈", bm: "김송희" }, pourstore: { name: "POUR스토어", bm: "이란" }, barasday: { name: "바라스데이", bm: "김소연" } };
const MIN_OFF = Math.min(...LAUNCH_ITEMS.map((i) => i.off));   // -56 (8주 전)

// 주말이면 앞 금요일로
export const workday = (key) => { const d = new Date(key + "T00:00:00"), w = d.getDay(); return w === 6 ? addDays(key, -1) : w === 0 ? addDays(key, -2) : key; };
// 출시일 → 항목 기한. 출시 전 항목은 오늘~출시일 사이에 맞춰 줄임(기간이 8주보다 짧을 때만)
const nextWorkday = (key) => { const w = new Date(key + "T00:00:00").getDay(); return w === 6 ? addDays(key, 2) : w === 0 ? addDays(key, 1) : key; };
// 오늘보다 앞이 되면(주말 → 금요일로 당기다 지난 날이 된 경우 등) 오늘 이후 첫 평일로. 출시일이 이미 지난 경우는 예외(출시일 그대로)
export function launchDue(launchDate, off, today) {
  const d = launchDueRaw(launchDate, off, today);
  if (d && today && d < today && launchDate >= today) return nextWorkday(today);
  return d;
}
function launchDueRaw(launchDate, off, today) {
  if (!launchDate) return "";
  if (off >= 0) return workday(addDays(launchDate, off));
  const span = ddays(launchDate, today);   // 오늘부터 출시일까지 남은 날
  if (today && span != null && span < -MIN_OFF) {
    if (span <= 0) return workday(today < launchDate ? today : launchDate);
    const k = Math.round(span * (off / MIN_OFF));   // off=-56 → span 전체, off=-7 → span×1/8
    const d = addDays(launchDate, -k); return workday(d < today ? today : d);
  }
  return workday(addDays(launchDate, off));
}
// 이름 맞추기: 런칭보드는 '민지'·'정하'처럼 짧은 이름 → 끝이 같으면 같은 사람. '이우민, 외주' → 앞 이름
export function nameMatch(owner, name) {
  const a = String(owner || "").split(/[,·/]/)[0].trim(), b = String(name || "").trim(); if (!a || !b) return false;
  if (a === b) return true; return a.length >= 2 && b.length >= 2 && (b.endsWith(a) || a.endsWith(b));
}
export const userByName = (users, owner) => (users || []).find((u) => u.active !== false && nameMatch(owner, u.name)) || (users || []).find((u) => nameMatch(owner, u.name)) || null;

// v1 항목 상태 읽기 (런칭보드 칸 lb:true 는 stages, 업무OS 추가 칸은 osExtra)
function itemState(p, it) {
  const ex = ((p && p.osExtra) || {})[it.id] || {};
  if (it.lb) { const s = ((p && p.stages) || {})[it.id] || {}; return { status: s.status || "todo", owner: s.owner || "", due: s.due || "", note: s.note || "" }; }
  const count = Number(ex.count || 0); let status = ex.status || "todo";
  if (it.target && status !== "skip") status = count >= it.target ? "done" : count > 0 ? "doing" : status;
  return { status, owner: ex.owner || "", due: ex.due || "", note: ex.note || "", count };
}
const ST = { done: "done", doing: "inprogress", todo: "todo", hold: "hold" };

// 기존 신제품들에서 항목별로 가장 많이 맡은 사람 (새 제품 기본 담당)
export function ownerDefaults(D) {
  const cnt = {};
  (D.tasks || []).forEach((t) => { if (!t.launchItem || !t.assigneeId) return; const u = (D.users || []).find((x) => x.id === t.assigneeId); if (!u || u.active === false) return;
    const c = (cnt[t.launchItem] = cnt[t.launchItem] || {}); c[t.assigneeId] = (c[t.assigneeId] || 0) + 1; });
  const out = {}; Object.entries(cnt).forEach(([k, c]) => { out[k] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; });
  const wf = (D.workflows || []).find((w) => w.id === "wf_launch"); const defs = (wf && wf.defaults) || {};
  Object.entries(defs).forEach(([k, nm]) => { if (!out[k]) { const u = userByName(D.users, nm); if (u) out[k] = u.id; } });
  return out;
}

// v1 런칭보드 문서들 → v2 프로젝트·업무 (읽기만 한 데이터로 계산)
export function planLaunchImport(products, D, today = ymd(new Date())) {
  const users = D.users || [], projects = [], tasks = [], skipped = [];
  (products || []).filter((p) => p && p.name && !p.deletedAt).forEach((p) => {
    const pid = "lb_" + p.id, leadName = p.lead || (LAUNCH_BRANDS[p.brand] || {}).bm || "", lead = userByName(users, leadName);
    projects.push({ id: pid, title: p.name, launchId: p.id, category: "launch", group: "신제품", brand: p.brand || "", batch: p.batch || "", dueDate: p.launchDate || "", launchDate: p.launchDate || "",
      assigneeId: lead ? lead.id : "", collaboratorIds: [], status: "active", priority: "mid", progress: 0, memo: p.memo || "", importedFrom: "launch-board", createdAt: p.createdAt || "" });
    LAUNCH_ITEMS.forEach((it) => {
      const s = itemState(p, it); if (s.status === "skip") { skipped.push(pid + ":" + it.id); return; }
      const u = s.owner ? userByName(users, s.owner) : null;
      const auto = !s.due; const due = s.due || launchDue(p.launchDate, it.off, today);
      tasks.push({ id: `${pid}__${it.id}`, title: it.name + (it.target ? ` (${s.count || 0}/${it.target})` : ""), projectId: pid, launchItem: it.id, phase: it.phase, isFixed: false, type: "general",
        status: ST[s.status] || "todo", assigneeId: u ? u.id : "", assigneeIds: u ? [u.id] : [], ownerText: s.owner && !u ? s.owner : "", dueDate: due, dueAuto: auto, noReview: true,
        memo: s.note || "", attachments: [], parentId: null, brand: p.brand || "", importedFrom: "launch-board", createdAt: p.createdAt || "",
        ...(s.status === "done" ? { doneAt: p.updatedAt || "" } : {}) });
    });
  });
  // 담당이 빈 항목: 다른 제품에서 그 항목을 가장 많이 맡은 사람 → 기본 담당 설정 → 제품 책임자 (ownerAuto 로 표시, 나중에 바꾸면 됨)
  const defs = ownerDefaults({ users, tasks, workflows: D.workflows });
  tasks.forEach((t) => { if (t.assigneeId || t.status === "done") return; const p = projects.find((x) => x.id === t.projectId);
    const who = defs[t.launchItem] || (p && p.assigneeId) || ""; if (who) { t.assigneeId = who; t.assigneeIds = [who]; t.ownerAuto = true; } });
  return { projects, tasks, skipped };
}

// 새 신제품 → 프로젝트 + 항목 업무 (기본 담당·자동 기한), 담당별 부담 요약
export function planNewLaunch({ name, brand, launchDate, batch, leadId }, D, me, today = ymd(new Date()), at = new Date().toISOString()) {
  const id = "lb_v2" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const defs = ownerDefaults(D);
  const project = { id, title: name.trim(), category: "launch", group: "신제품", brand, batch: batch || "", dueDate: launchDate, launchDate, assigneeId: leadId || me.id, collaboratorIds: [],
    status: "active", priority: "mid", progress: 0, createdAt: at, createdBy: me.id, madeIn: "v2" };
  const tasks = LAUNCH_ITEMS.filter((it) => !it.optional).map((it) => { const who = defs[it.id] || leadId || me.id;
    return { id: `${id}__${it.id}`, title: it.name + (it.target ? ` (0/${it.target})` : ""), projectId: id, launchItem: it.id, phase: it.phase, isFixed: false, type: "general", status: "todo",
      assigneeId: who, assigneeIds: [who], dueDate: launchDue(launchDate, it.off, today), dueAuto: true, noReview: true, memo: "", attachments: [], parentId: null, brand,
      requestedBy: me.id, requestedAt: at, createdAt: at, createdBy: me.id, madeIn: "v2" }; });
  const late = tasks.filter((t) => t.dueDate < today).length;
  const squeezed = ddays(launchDate, today) != null && ddays(launchDate, today) < -MIN_OFF;
  const byWho = {}; tasks.forEach((t) => { (byWho[t.assigneeId] = byWho[t.assigneeId] || []).push(t); });
  return { project, tasks, late, squeezed, byWho };
}

// 출시일 변경 → 자동 기한 항목만 다시 계산 [{task, due}]
export function relaunch(tasks, launchDate, today = ymd(new Date())) {
  const off = Object.fromEntries(LAUNCH_ITEMS.map((i) => [i.id, i.off]));
  return (tasks || []).filter((t) => t.launchItem && t.dueAuto && t.status !== "done" && off[t.launchItem] != null)
    .map((t) => ({ task: t, due: launchDue(launchDate, off[t.launchItem], today) })).filter((x) => x.due !== t0(x.task));
}
const t0 = (t) => String(t.dueDate || "");
export const phaseOf = (k) => LAUNCH_PHASES.find((p) => p.k === k);
