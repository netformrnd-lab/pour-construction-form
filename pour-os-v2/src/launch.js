// 업무OS v2 — 신제품 출시 = 프로젝트 1개 + 항목마다 업무 1건 (일반 업무와 같은 화면·같은 동작)
//
// · 출시일에서 거꾸로 계산해 항목마다 기한을 자동으로 넣는다 (주말이면 앞 금요일로)
// · 출시일까지 기간이 짧으면 남은 기간에 고르게 나눠 넣는다 (이미 지난 기한이 생기지 않게)
// · 출시일을 바꾸면 자동 기한(dueAuto)인 항목만 같이 움직인다. 사람이 바꾼 기한은 그대로
// · v1 런칭보드(pour-os/launch-board/products)는 읽기만 해서 v2 로 복사한다
import { addDays, ddays, ymd, isOffDay, prevWorkday, nextWorkday as nextWork, isDone } from "./model.js";

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
// 출시 전에 끝내야 하는 항목인지 (off < 0) — 출시일·출시 뒤 할 일(광고·리뷰·체험단 등 off ≥ 0)은 '출시보다 늦음'이 아님
const OFF_BY = Object.fromEntries(LAUNCH_ITEMS.map((i) => [i.id, i.off]));
export const preLaunchItem = (id) => OFF_BY[id] != null && OFF_BY[id] < 0;
export const LAUNCH_BRANDS = { grohome: { name: "그로홈", bm: "김송희" }, pourstore: { name: "POUR스토어", bm: "이란" }, barasday: { name: "바라스데이", bm: "김소연" } };
const MIN_OFF = Math.min(...LAUNCH_ITEMS.map((i) => i.off));   // -56 (8주 전)

// 주말·공휴일이면 앞 평일로
export const workday = (key) => prevWorkday(key);
const nextWorkday = (key) => nextWork(key);
// 출시일 → 항목 기한. 출시 전 항목은 오늘~출시일 사이에 맞춰 줄임(기간이 8주보다 짧을 때만)
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
// 담당 이름 → 업무OS 사람 번호들 (신제품 대시보드와 같은 규칙 · 같은 계산이 launch-board.html osIdOf 에도 있음)
//   이름이 똑같으면 그 사람 · 아니면 끝이 같은 사용 중인 사람이 딱 1명일 때만 (2명 이상이면 못 맞춤) · '외주…'·빈 칸은 번호 없음
export function osIdOf(name, users) {
  const n = String(name || "").trim(); if (!n || /^외주/.test(n)) return "";
  const act = (users || []).filter((u) => u && u.name && u.active !== false);
  const ex = act.find((u) => u.name === n); if (ex) return ex.id;
  const c = n.length >= 2 ? act.filter((u) => u.name.endsWith(n) || n.endsWith(u.name)) : [];
  return c.length === 1 ? c[0].id : "";
}
export const ownerIdsOf = (owner, users) => [...new Set(String(owner || "").split(/\s*[,·/]\s*/).map((x) => osIdOf(x, users)).filter(Boolean))];
// 기존 신제품 대시보드 담당 맞추기 미리 보기: 단계마다 담당 이름 → ownerIds (이미 같으면 뺌) · 못 맞춘 이름은 따로 (건수)
export function planOwnerIds(products, users) {
  const changes = [], miss = {};
  (products || []).forEach((p) => { if (!p || p.__structure || p.deletedAt || !p.stages) return;
    Object.entries(p.stages).forEach(([sid, s]) => { const owner = String((s && s.owner) || "").trim(); if (!owner) return;
      const names = owner.split(/\s*[,·/]\s*/).filter(Boolean), ids = ownerIdsOf(owner, users);
      names.forEach((nm) => { if (!/^외주/.test(nm) && !osIdOf(nm, users)) miss[nm] = (miss[nm] || 0) + 1; });
      const cur = Array.isArray(s.ownerIds) ? s.ownerIds : [];
      if (ids.length && (cur.length !== ids.length || cur.some((x, i) => x !== ids[i]))) changes.push({ pid: p.id, name: p.name, sid, owner, ids }); }); });
  const pairs = {}; changes.forEach((c) => c.owner.split(/\s*[,·/]\s*/).forEach((nm) => { const id = osIdOf(nm, users); if (id) { const k = nm + "→" + id; pairs[k] = (pairs[k] || 0) + 1; } }));
  return { changes, miss: Object.entries(miss).sort((a, b) => b[1] - a[1]), pairs: Object.entries(pairs).sort((a, b) => b[1] - a[1]), products: new Set(changes.map((c) => c.pid)).size };
}
export const userByName = (users, owner) => (users || []).find((u) => u.active !== false && nameMatch(owner, u.name)) || (users || []).find((u) => nameMatch(owner, u.name)) || null;

// v1 항목 상태 읽기 (런칭보드 칸 lb:true 는 stages, 업무OS 추가 칸은 osExtra)
export function itemState(p, it) {
  const ex = ((p && p.osExtra) || {})[it.id] || {};
  if (it.lb) { const s = ((p && p.stages) || {})[it.id] || {}; const auto = !!s.due && s.dueAuto === s.due;   // 업무OS가 채운 자동 기한(날짜를 바꾸면 자동 표시가 풀림) → 사람이 정한 마감 아님
    return { status: s.status || "todo", owner: s.owner || "", ownerIds: Array.isArray(s.ownerIds) ? s.ownerIds : null, due: auto ? "" : s.due || "", autoDue: auto ? s.due : "", dueTbd: !!s.dueTbd, note: s.note || "", doneAt: s.doneAt || "", doneBy: s.doneBy || "", updatedAt: s.updatedAt || "" }; }
  const count = Number(ex.count || 0); let status = ex.status || "todo";
  if (it.target && status !== "skip") status = count >= it.target ? "done" : count > 0 ? "doing" : status;
  return { status, owner: ex.owner || "", ownerIds: Array.isArray(ex.ownerIds) ? ex.ownerIds : null, due: ex.due || "", note: ex.note || "", count, doneAt: ex.doneAt || (status === "done" ? ex.updatedAt || "" : ""), doneBy: ex.doneBy || ex.updatedBy || "", updatedAt: ex.updatedAt || "" };
}
const ST = { done: "done", doing: "inprogress", todo: "todo", hold: "hold" };

// 기존 신제품들에서 항목별로 가장 많이 맡은 사람 (새 제품 기본 담당) — 자동으로 채운 담당(ownerAuto)은 세지 않음(책임자 몰림이 기본값이 되지 않게)
export function ownerDefaults(D) {
  const cnt = {};
  (D.tasks || []).forEach((t) => { if (!t.launchItem || !t.assigneeId || t.ownerAuto) return; const u = (D.users || []).find((x) => x.id === t.assigneeId); if (!u || u.active === false) return;
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
    // skipItems: v1 에서 건너뛴 항목 (업무를 만들지 않음 → 순서표에서 그 앞 항목으로 거슬러 올라감. 그 밖에 없는 항목은 오래전에 끝나 불러오지 않은 것)
    const proj = { id: pid, title: p.name, launchId: p.id, category: "launch", group: "신제품", brand: p.brand || "", batch: p.batch || "", dueDate: p.launchDate || "", launchDate: p.launchDate || "",
      assigneeId: lead ? lead.id : "", collaboratorIds: [], status: "active", priority: "mid", progress: 0, memo: p.memo || "", importedFrom: "launch-board", createdAt: p.createdAt || "", skipItems: [], lbProject: p.project || "", lbProjectName: p.project || "",
      lbSeen: { launchDate: p.launchDate || "", name: p.name || "" }, lbSyncedAt: p.updatedAt || p.createdAt || "x" };   // 신제품 대시보드 자동 반영(lbsync) 마지막으로 본 값
    projects.push(proj);
    LAUNCH_ITEMS.forEach((it) => {
      const s = itemState(p, it); if (s.status === "skip") { skipped.push(pid + ":" + it.id); proj.skipItems.push(it.id); return; }
      // 담당: 신제품 대시보드에 업무OS 사람 번호(ownerIds)가 있으면 그대로(여러 명) · 없으면 이름으로 맞춤
      const live = (id) => users.some((x) => x.id === id), ids = (s.ownerIds || []).filter(live), nameU = !ids.length && s.owner ? userByName(users, s.owner) : null;
      const owners = ids.length ? ids : nameU ? [nameU.id] : [], u = owners.length ? { id: owners[0] } : null;
      const auto = !s.due && !s.dueTbd; const due = s.dueTbd ? "" : s.due || launchDue(p.launchDate, it.off, today);   // 마감 미정이면 기한 없음
      tasks.push({ id: `${pid}__${it.id}`, title: it.name + (it.target ? ` (${s.count || 0}/${it.target})` : ""), projectId: pid, launchItem: it.id, phase: it.phase, isFixed: false, type: "general",
        status: ST[s.status] || "todo", assigneeId: u ? u.id : "", assigneeIds: owners, ownerText: s.owner && !u ? s.owner : "", dueDate: due, dueAuto: auto, noReview: true,
        ownerAuto: false, ...(u ? { ownerFrom: "v1" } : {}),
        memo: s.note || "", attachments: [], parentId: null, brand: p.brand || "", importedFrom: "launch-board", createdAt: p.createdAt || "",
        lbSeen: { status: ["todo", "doing", "done", "hold"].includes(s.status) ? s.status : "todo", owners: ids.length ? ids : ownerIdsOf(s.owner, users), due: s.dueTbd ? "tbd" : s.due || "", note: s.note || "" },
        ...(s.status === "done" ? { doneAt: s.doneAt || "", finishedAt: s.doneAt || "", doneByName: s.doneBy || "" } : {}) });
    });
  });
  // 담당이 빈 항목: 다른 제품에서 그 항목을 가장 많이 맡은 사람 → 기본 담당 설정 → 제품 책임자 (ownerAuto 로 표시, 나중에 바꾸면 됨)
  const defs = ownerDefaults({ users, tasks, workflows: D.workflows });
  tasks.forEach((t) => { if (t.assigneeId || t.status === "done") return; const p = projects.find((x) => x.id === t.projectId);
    const d = defs[t.launchItem], who = d || (p && p.assigneeId) || "";
    if (who) { t.assigneeId = who; t.assigneeIds = [who]; t.ownerAuto = true; t.ownerFrom = d ? "default" : "lead"; } });
  return { projects, tasks, skipped };
}

// 새 신제품 → 프로젝트 + 항목 업무 (기본 담당·자동 기한), 담당별 부담 요약
export function planNewLaunch({ name, brand, launchDate, batch, leadId }, D, me, today = ymd(new Date()), at = new Date().toISOString()) {
  const id = "lb_v2" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const defs = ownerDefaults(D);
  const project = { id, title: name.trim(), category: "launch", group: "신제품", brand, batch: batch || "", dueDate: launchDate, launchDate, assigneeId: leadId || me.id, collaboratorIds: [],
    status: "active", priority: "mid", progress: 0, createdAt: at, createdBy: me.id, madeIn: "v2" };
  const tasks = LAUNCH_ITEMS.filter((it) => !it.optional).map((it) => { const d = defs[it.id], who = d || leadId || me.id;
    return { id: `${id}__${it.id}`, title: it.name + (it.target ? ` (0/${it.target})` : ""), projectId: id, launchItem: it.id, phase: it.phase, isFixed: false, type: "general", status: "todo",
      assigneeId: who, assigneeIds: [who], ownerAuto: true, ownerFrom: d ? "default" : "lead",
      dueDate: launchDue(launchDate, it.off, today), dueAuto: true, noReview: true, memo: "", attachments: [], parentId: null, brand,
      requestedBy: me.id, requestedAt: at, createdAt: at, createdBy: me.id, madeIn: "v2" }; });
  const late = tasks.filter((t) => t.dueDate < today).length;
  const squeezed = ddays(launchDate, today) != null && ddays(launchDate, today) < -MIN_OFF;
  const byWho = {}; tasks.forEach((t) => { (byWho[t.assigneeId] = byWho[t.assigneeId] || []).push(t); });
  return { project, tasks, late, squeezed, byWho };
}

// 기한을 같이 옮길 항목: 자동 기한 · 아직 하는 일 (끝남·확인 대기·보류는 그대로)
const movable = (t) => !!t && !!t.launchItem && !!t.dueAuto && !isDone(t) && t.status !== "review" && t.status !== "hold";
// 출시일 변경 → 자동 기한 항목만 다시 계산 [{task, due}]
export function relaunch(tasks, launchDate, today = ymd(new Date())) {
  const off = Object.fromEntries(LAUNCH_ITEMS.map((i) => [i.id, i.off]));
  const o = (t) => (off[t.launchItem] != null ? off[t.launchItem] : t.lbOff);   // 직접 추가한 단계는 만들 때 적어 둔 lbOff
  return (tasks || []).filter((t) => movable(t) && o(t) != null)
    .map((t) => ({ task: t, due: launchDue(launchDate, o(t), today) })).filter((x) => x.due !== t0(x.task));
}
const t0 = (t) => String(t.dueDate || "");
export const phaseOf = (k) => LAUNCH_PHASES.find((p) => p.k === k);

// ── 신제품 항목 순서표 (뒤 ← 앞). 앞 항목이 모두 끝나야 '내 차례'. 저장하지 않고 계산만 (업무에 deps 가 있으면 그게 먼저)
export const LAUNCH_AFTER = {
  p02: ["p01"], p03: ["p02"], p04: ["p02"], s01: ["p04"], x_test: ["s01"], s02: ["x_test", "p03"], x_parts: ["s01"],
  d01: ["s01"], d02: ["s01"], d03: ["s01"], s03: ["d01"], s04: ["d02"], s05: ["d03"], x_color: ["s03"], x_expiry: ["s03"], x_print: ["s03", "s04", "s05", "x_expiry"],
  s06: ["s02"], s07: ["s06", "s01"], s09: ["s06", "s01"], s08: ["s07"], s10: ["s09"], s11: ["s08", "s10"],
  x_mall: ["s11"], s12: ["s11"], x_kw: ["s11"], x_sabang: ["s12"], x_domae: ["s12"],
  x_msds: ["p04"], x_3pl: ["x_msds", "x_print"], x_cgrowth: ["x_msds", "x_print"],
  x_b2b: ["x_mall", "s12"], x_rv_mall: ["x_mall"], x_rv_ss: ["s12"], x_rv_cp: ["s12"],
  x_ex_insta: ["s12"], x_ex_blog: ["s12"], x_ex_yt: ["s12"], x_ex_ohou: ["s12"], x_infl: ["s12"],
  x_ad_nshop: ["s12"], x_ad_cp: ["s12"], x_ad_boost: ["x_ad_nshop"], x_meta: ["x_mall"], x_dg: ["x_mall"], x_blog: ["s12"], x_short: ["s12"],
};
// 앞 업무 찾기: 그 제품의 앞 항목 업무.
// 업무가 없는 항목: 건너뛴 항목(프로젝트 skipItems)·선택 항목(구성품)만 그 앞 항목으로 거슬러 올라감.
// 그 밖에 없는 항목은 '오래전에 끝나 불러오지 않음'으로 보고 끝난 것으로 (더 앞의 열린 항목을 앞 일로 잡지 않음)
// skip: 건너뛴 항목 id 모음(Set·배열) 또는 (항목 id) => 거슬러 올라갈지 함수 (기한 순서 계산은 모두 거슬러 올라감)
const OPTIONAL = new Set(LAUNCH_ITEMS.filter((i) => i.optional).map((i) => i.id));
export function launchPreds(t, byId, skip) {
  const out = [], seen = new Set();
  const thru = typeof skip === "function" ? skip : (a) => OPTIONAL.has(a) || !!(skip && (skip instanceof Set ? skip.has(a) : Array.isArray(skip) && skip.includes(a)));
  const walk = (itemId) => { (LAUNCH_AFTER[itemId] || []).forEach((a) => { if (seen.has(a)) return; seen.add(a);
    const x = byId.get(`${t.projectId}__${a}`); if (x) out.push(x); else if (thru(a)) walk(a); }); };
  walk(t.launchItem);
  return out;
}
// 순서표 깊이(앞 항목이 몇 겹인지) — 기한 다시 나누기에 씀
export const launchDepth = (() => { const memo = {}; const f = (id) => (memo[id] != null ? memo[id] : (memo[id] = (LAUNCH_AFTER[id] || []).reduce((m, a) => Math.max(m, f(a) + 1), 0))); LAUNCH_ITEMS.forEach((i) => f(i.id)); return memo; })();
// 임시 담당 = 담당이 비어 책임자로 채운 신제품 항목 (실제로 누가 할지 정해야 함)
export function isTempOwner(t, D) {
  if (!t || !t.launchItem || isDone(t)) return false;
  if (t.ownerFrom) return t.ownerFrom === "lead";
  if (!t.ownerAuto) return false;
  const p = (D.projects || []).find((x) => x.id === t.projectId);
  return !!p && p.assigneeId === t.assigneeId;
}
// 신제품 진척 % = 끝난 항목 ÷ 전체 항목 (그때그때 계산 · 불러오지 않은 오래전 끝난 항목은 끝난 것으로)
export function launchPct(p, D) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && t.launchItem);
  const total = LAUNCH_ITEMS.filter((i) => !i.optional).length + ts.filter((t) => LAUNCH_ITEMS.find((i) => i.id === t.launchItem && i.optional)).length;
  const open = ts.filter((t) => !isDone(t)).length;
  return total ? Math.max(0, Math.min(100, Math.round(((total - open) / total) * 100))) : 0;
}
// 기한 고르게 다시 나누기 (압축된 출시): 자동 기한·아직 하는 항목만(끝남·확인 대기·보류 빼고), 오늘~출시일 사이 평일을 순서표 깊이대로 나눠 배정. 출시 뒤 항목은 규칙대로
// 사람이 정한 기한(dueAuto:false)은 그대로 두고 순서를 지킴: 자동 항목은 사람이 정한 앞 항목 기한보다 앞서지 않고, 사람이 정한 뒤 항목 기한을 넘지 않음
export function rebalanceLaunch(tasks, launchDate, today = ymd(new Date())) {
  if (!launchDate) return [];
  const days = []; for (let k = today; k < launchDate && days.length < 400; k = addDays(k, 1)) if (!isOffDay(k)) days.push(k);
  if (!days.length) return [];
  const preDepth = Math.max(...LAUNCH_ITEMS.filter((i) => i.off < 0).map((i) => launchDepth[i.id]));
  const off = Object.fromEntries(LAUNCH_ITEMS.map((i) => [i.id, i.off]));
  const all = (tasks || []).filter((t) => t && t.launchItem), cand = all.filter((t) => movable(t) && off[t.launchItem] != null);
  const due = new Map(cand.map((t) => { const o = off[t.launchItem];
    if (o >= 0) return [t.id, launchDue(launchDate, o, today)];
    return [t.id, days[Math.min(days.length - 1, Math.round((launchDepth[t.launchItem] / Math.max(1, preDepth)) * (days.length - 1)))]]; }));
  // 순서 지키기: 앞·뒤 항목 (없는 항목은 거슬러 올라감 — 기한 순서는 끝난 항목을 건너도 그대로)
  const byId = new Map(all.map((t) => [t.id, t])), preds = new Map(), succs = new Map();
  all.forEach((t) => { const ps = launchPreds(t, byId, () => true); preds.set(t.id, ps); ps.forEach((p) => { const a = succs.get(p.id) || []; a.push(t); succs.set(p.id, a); }); });
  const fixedDue = (t) => (!finishedLike(t) && t.status !== "hold" ? String(t.dueDate || "").slice(0, 10) : "");   // 사람이 정한(또는 옮기지 않는) 열린 항목의 기한
  const at = (t) => (due.has(t.id) ? due.get(t.id) : fixedDue(t));
  const pre = cand.filter((t) => off[t.launchItem] < 0).sort((a, b) => launchDepth[a.launchItem] - launchDepth[b.launchItem]);
  // 앞으로: 앞 항목 기한보다 이르면 그날 이후 첫 평일로
  pre.forEach((t) => { const lo = (preds.get(t.id) || []).map(at).filter(Boolean).sort().pop();
    if (lo && lo > due.get(t.id)) due.set(t.id, days.find((d) => d >= lo) || days[days.length - 1]); });
  // 뒤로: 뒤 항목 기한보다 늦으면 그날 이전 마지막 평일로 (오늘보다 앞은 안 됨)
  pre.slice().reverse().forEach((t) => { const hi = (succs.get(t.id) || []).map(at).filter(Boolean).sort()[0];
    if (hi && hi < due.get(t.id)) due.set(t.id, [...days].reverse().find((d) => d <= hi) || days[0]); });
  return cand.map((t) => ({ task: t, due: due.get(t.id) })).filter((x) => x.due && x.due !== String(x.task.dueDate || ""));
}
const finishedLike = (t) => isDone(t) || t.status === "review";

// ── 신제품 대시보드에서 직접 추가한 단계(board-structure.custom · 4단계 ④) ──
// 신제품 영역 P1~P5 → 업무OS 단계 · 자동 기한 = 그 영역에서 바로 앞 기본 단계의 기한(없으면 영역 첫 기본 단계)
export const BOARD_PHASE = { P1: "plan", P2: "pack", P3: "content", P4: "content", P5: "channel" };
const BOARD_BASE = { P1: ["p01", "p02", "p03", "p04", "s01", "s02"], P2: ["d01", "s03", "d02", "s04", "d03", "s05"], P3: ["s06"], P4: ["s07", "s08", "s09", "s10"], P5: ["s11", "s12"] };
export function customItems(structure) {
  const custom = (structure && structure.custom) || {}, order = (structure && structure.order) || {};
  return Object.keys(custom).map((id) => {
    const pk = Object.keys(BOARD_BASE).find((k) => (order[k] || []).includes(id)) || "P5", list = order[pk] || BOARD_BASE[pk];
    const before = list.slice(0, Math.max(0, list.indexOf(id))).reverse().find((x) => OFF_BY[x] != null) || BOARD_BASE[pk][0];
    const ph = BOARD_PHASE[pk], phase = LAUNCH_PHASES.find((x) => x.k === ph);
    return { id, name: (custom[id] && custom[id].name) || "새 단계", off: OFF_BY[before], lb: true, custom: true, phase: ph, phaseName: phase ? phase.name : "" };
  });
}
export const launchItemsOf = (structure) => [...LAUNCH_ITEMS, ...customItems(structure)];
