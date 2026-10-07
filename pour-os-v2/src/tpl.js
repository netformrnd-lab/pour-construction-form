// 업무OS v2 — 견본(템플릿) + 예상 소요 연결 (사용자 확정 2026-10-07 ② '복사해서 따로 · 모두 보기 · 만든 사람·관리자 고치기') — 계산만, 저장은 core.jsx
//
// 견본 = pour-os/v2/templates/{id} 문서 하나 (업무 목록을 안에 담음 → 업무·프로젝트 목록에 안 섞임 = 오늘·달력·KPI·한눈에·협업 맵·보고서·찾기 어디에도 안 나옴)
//  {title, brand, category, srcKind 'normal'|'launch'|'flow', srcProjectId, srcTitle, wfId(흐름), road[{k,name,ownerId?}], withOwners,
//   tasks:[{key, title, parentKey, afterKeys[], phase, estDays, assigneeId?, launchItem?, out?}], createdBy, createdByName, createdAt, v2At, updatedAt, updatedBy, removed?}
//  · 복사하는 것 = 이름 · 하위 업무 · 앞 일 순서(같은 프로젝트 안 deps) · 단계 · 예상 소요일 · (담당 — 고를 때만) · 신제품 항목 번호(launchItem → 순서표 그대로)
//  · 안 복사 = 날짜 · 상태 · 댓글 · 파일 · 기록 · 중단·해당 없음·없앤 업무 · 기밀 업무(제목이 모두에게 보이게 되므로)
//  · 견본 안 업무 '빼기' = out 표시(지우지 않음 · 되돌리기) · 견본 없애기 = removed(휴지통 · 되살리기)
// 새 프로젝트 = 견본 그대로 한 번에(core A.tplCreate · 한 transaction): 새 번호로 deps·하위 업무 다시 잇기 · 단계·예상 소요일 그대로 · 시작일부터 앞 일 순서대로 평일 기한
//  · 신제품 견본 → 업무OS 전용 신제품(lb_v2…) — 신제품 대시보드에 없는 제품이라 lbpush·lbsync 가 건너뜀(pushLaunchBoard·syncLaunchBoard 는 대시보드 제품 → 'lb_'+id 로만 찾음)
//  · 흐름 견본 → 같은 흐름(wfId · road wf0…) 프로젝트 → '앞 단계가 다 끝나야 다음 단계 차례'(turn.js) 그대로
import { estPlan, projEst, estOf, roadOf, phaseOfTask, cleanRoad, isLaunchProj, isFlowProj, isGhProj, projCat, isRemoved, ownersOf, projLeadOrMaster, isMaster, wdAt, nextWorkday, newId, LAUNCH_ROAD, ROAD_BASE, dueOf } from "./model.js";
import { LAUNCH_AFTER, LAUNCH_ITEMS, preLaunchItem, baseTitle, targetOf } from "./launch.js";

// 신제품 순서표·출시 전 단계 (model.estPlan 의 lx) · 출시 홍보(promo)만 출시 뒤
export const LX = { after: LAUNCH_AFTER, pre: preLaunchItem, preStages: new Set(LAUNCH_ROAD.filter((s) => s.k !== "promo").map((s) => s.k)) };
export const projEstimate = (p, D, key, tasks) => projEst(p, D, LX, key, tasks);

export const TPL_MAX = 300, TPL_NAME_MAX = 60;
const ITEM_IDS = new Set(LAUNCH_ITEMS.map((i) => i.id));
export const KIND_L = { launch: "신제품", flow: "흐름", normal: "" };
export const tplKind = (tpl) => (tpl && (tpl.srcKind === "launch" || tpl.srcKind === "flow") ? tpl.srcKind : "normal");
export const tplRoad = (tpl) => (tplKind(tpl) === "launch" ? LAUNCH_ROAD : cleanRoad(tpl && tpl.road).length ? cleanRoad(tpl.road) : ROAD_BASE);
// 견본 안 살아 있는 업무 (빼기 표시 out 빼고)
export const tplLive = (tpl) => ((tpl && tpl.tasks) || []).filter((x) => x && x.key && !x.out);
// 권한: 고치기·없애기 = 만든 사람·관리자 · 저장 = 그 프로젝트 책임자·관리자 (기밀·그로홈 KPI·없앤 프로젝트는 안 됨) · 새 프로젝트 = 누구나
export const canEditTpl = (tpl, cu) => !!tpl && !!cu && (tpl.createdBy === cu.id || isMaster(cu));
export const canSaveTpl = (p, cu) => !!p && !!cu && !p.locked && !isRemoved(p) && !(p.secret && p.secret.on) && !isGhProj(p.id) && projLeadOrMaster(p, cu);
// 계산 재료 (예상 소요 · 마인드맵)
export const tplItems = (tpl) => { const live = tplLive(tpl), ks = new Set(live.map((x) => x.key));
  return live.map((x) => ({ id: x.key, parentId: x.parentKey && ks.has(x.parentKey) ? x.parentKey : null, deps: (x.afterKeys || []).filter((k) => ks.has(k)), launchItem: x.launchItem || "", phase: x.phase || "", est: estOf(x), fin: false })); };
export const tplEst = (tpl) => estPlan(tplItems(tpl), tplRoad(tpl), tplKind(tpl), LX);

// 견본함 휴지통 줄 (없앤 견본) — uid 를 주면 내가 만들었거나 없앤 것만
export function tplTrashRows(removed, uid) {
  return (removed || []).filter((x) => x && isRemoved(x) && (!uid || x.createdBy === uid || x.removed.by === uid))
    .map((x) => ({ kind: "tpl", id: x.id, name: x.title || "", sub: `견본 · 업무 ${tplLive(x).length}개`, reason: x.removed.reason || "", by: x.removed.by, byName: x.removed.byName, at: x.removed.at, x }))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

// ── 프로젝트 → 견본 (저장 없음) ──
// tasks: 그 프로젝트 업무 전부(서버에서 읽은 것 · 못 읽으면 화면에 있는 것) · o = {title, withOwners, cu, at, users}
export function planTemplate(p, D, tasks, o) {
  const road = roadOf(p, D), kind = isLaunchProj(p) ? "launch" : isFlowProj(p) ? "flow" : "normal";
  const pool = (tasks || (D && D.tasks) || []).filter((t) => t && t.projectId === p.id && !t.isFixed && !t.deleted && !isRemoved(t));
  const poolIds = new Set(pool.map((t) => t.id)), drop = (t) => t.status === "dropped" || !!t.lbSkip, sec = (t) => !!(t.secret && t.secret.on);
  const skipped = pool.filter(drop).length, secret = pool.filter((t) => !drop(t) && sec(t)).length;
  let keep = pool.filter((t) => !drop(t) && !sec(t));
  for (let i = 0; i < 10; i++) { const ids = new Set(keep.map((t) => t.id)), nx = keep.filter((t) => !t.parentId || !poolIds.has(t.parentId) || ids.has(t.parentId)); if (nx.length === keep.length) break; keep = nx; }   // 위 업무가 빠지면 하위도
  const byId = new Map(keep.map((t) => [t.id, t])), ph = (t) => (road ? phaseOfTask(t, p, D, byId, road) : "");
  const E = estPlan(keep.map((t) => ({ id: t.id, parentId: t.parentId && byId.has(t.parentId) ? t.parentId : null, deps: t.deps, launchItem: t.launchItem || "", phase: ph(t), est: estOf(t), fin: false })), road, kind, LX);
  const sI = new Map((road || []).map((s, i) => [s.k, i])), stOf = (t) => (sI.has(ph(t)) ? sI.get(ph(t)) : 99);
  const cmp = (a, b) => stOf(a) - stOf(b) || ((E.node.get(a.id) || {}).es || 0) - ((E.node.get(b.id) || {}).es || 0) || String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id));
  const kidsOf = (id) => keep.filter((t) => t.parentId === id).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id)));
  const order = [], seen = new Set(), walk = (t) => { if (seen.has(t.id)) return; seen.add(t.id); order.push(t); kidsOf(t.id).forEach(walk); };
  keep.filter((t) => !t.parentId || !byId.has(t.parentId)).sort(cmp).forEach(walk); keep.forEach(walk);
  const key = new Map(order.map((t, i) => [t.id, "k" + (i + 1)])), live = (u) => !!u && ((o && o.users) || (D && D.users) || []).some((x) => x.id === u && x.active !== false);
  const items = order.slice(0, TPL_MAX).map((t) => { const top = !t.parentId || !byId.has(t.parentId), who = ownersOf(t)[0];
    const deps = (Array.isArray(t.deps) ? t.deps : []).filter((d) => key.has(d) && d !== t.id).map((d) => key.get(d));
    return { key: key.get(t.id), title: String((t.launchItem && targetOf(t) ? baseTitle(t) : t.title) || "").trim().slice(0, 200) || "(이름 없음)", parentKey: top ? null : key.get(t.parentId),
      afterKeys: [...new Set(deps)], phase: top ? ph(t) : "", estDays: estOf(t) || null, ...(o && o.withOwners && live(who) ? { assigneeId: who } : {}),
      ...(kind === "launch" && ITEM_IDS.has(t.launchItem) ? { launchItem: t.launchItem } : {}) }; });
  const rd = (road || []).map((s) => { const first = o && o.withOwners && kind === "flow" ? order.find((t) => (!t.parentId || !byId.has(t.parentId)) && ph(t) === s.k && live(ownersOf(t)[0])) : null;
    return { k: s.k, name: s.name, ...(first ? { ownerId: ownersOf(first)[0] } : {}) }; });
  const cu = (o && o.cu) || {}, at = (o && o.at) || new Date().toISOString();
  const doc = { title: String((o && o.title) || p.title || "").trim().slice(0, TPL_NAME_MAX), brand: p.brand || "", category: projCat(p) || "", srcKind: kind, srcProjectId: p.id, srcTitle: p.title || "",
    ...(kind === "flow" ? { wfId: p.wfId } : {}), road: rd, withOwners: !!(o && o.withOwners), tasks: items,
    createdBy: cu.id || "", createdByName: cu.name || "", createdAt: at, updatedAt: at, updatedBy: cu.id || "", v2At: at, removed: null };
  return { doc, n: items.length, cut: Math.max(0, order.length - TPL_MAX), skipped, secret, est: tplEst(doc) };
}

// ── 견본 → 새 프로젝트 (저장 없음) ──
// o = {title, leadId, start, brand, owners: {견본 업무 key: 사람 id}} · 담당 기본 = 고른 것 → 견본에 저장한 담당(사용 중인 사람) → 흐름 단계 담당 → 책임자
// 날짜: 시작일(쉬는 날이면 다음 평일 · 지난 날이면 오늘)부터 앞 일 순서대로 — 업무 = 그 업무가 시작할 수 있는 평일 ~ 소요일만큼 · 하위 업무는 위 업무 안에서 차례로
//  소요일 미정 업무는 기한 없이(맡길 때 '기한 미정') · 프로젝트 마감 = 가장 늦게 끝나는 날 · 신제품 출시일 = 출시 전 항목이 끝나는 날(없으면 마감)
export function tplOwnerOf(tpl, x, o, D, me) {
  const live = (u) => !!u && ((D && D.users) || []).some((y) => y.id === u && y.active !== false), pick = o && o.owners && o.owners[x.key];
  if (pick && live(pick)) return { id: pick, from: "pick" };
  if (tpl.withOwners && live(x.assigneeId)) return { id: x.assigneeId, from: "tpl" };
  const st = tpl.withOwners && x.phase ? (tpl.road || []).find((s) => s && s.k === x.phase) : null;
  if (st && live(st.ownerId)) return { id: st.ownerId, from: "tpl" };
  return { id: (o && o.leadId) || me.id, from: "lead" };
}
export function planFromTemplate(tpl, o, D, me, today, at = new Date().toISOString()) {
  const kind = tplKind(tpl), road = tplRoad(tpl), live = tplLive(tpl), E = tplEst(tpl), lead = o.leadId || me.id;
  const s0 = nextWorkday(!o.start || o.start < today ? today : o.start);
  const pid = kind === "launch" ? "lb_v2" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : newId("p"), base = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const bulk = newId("tb"), brand = o.brand != null ? o.brand : tpl.brand || "";
  const ks = new Set(live.map((x) => x.key));
  const idOf = new Map(live.map((x, i) => [x.key, kind === "launch" && x.launchItem && !x.parentKey ? `${pid}__${x.launchItem}` : `t${base}${i.toString(36)}`]));
  // 날짜 (평일 차례) — 위 업무 = 계산의 시작 차례 · 하위 업무 = 위 업무 시작부터 차례로
  const dates = new Map(), setD = (k, s, w) => { if (w > 0) dates.set(k, { start: wdAt(s0, s), due: wdAt(s0, s + w - 1) }); };
  const kidsDates = (k, s, pDue) => { let c = 0; E.kidsOf(k).forEach((kid) => { const w = E.eff(kid); if (w > 0) { setD(kid.id, s + c, w); kidsDates(kid.id, s + c, dates.get(kid.id).due); c += w; } else { if (pDue) dates.set(kid.id, { start: "", due: pDue }); kidsDates(kid.id, s + c, pDue); } }); };
  E.tops.forEach((x) => { const nd = E.node.get(x.id), w = E.eff(x); setD(x.id, nd.es, w); kidsDates(x.id, nd.es, w > 0 ? dates.get(x.id).due : ""); });
  const end = E.total ? wdAt(s0, E.total - 1) : "", launchDate = kind === "launch" ? (E.preTotal ? wdAt(s0, E.preTotal - 1) : end) : "";
  const owner = new Map(live.map((x) => [x.key, tplOwnerOf(tpl, x, o, D, me)]));
  const project = { id: pid, title: String(o.title || tpl.title || "").trim(), assigneeId: lead, collaboratorIds: [...new Set([...owner.values()].map((v) => v.id).filter((u) => u && u !== lead))],
    status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", startDate: s0, brand, fromTemplate: tpl.id, fromTemplateTitle: tpl.title || "",
    createdAt: at, createdBy: me.id, madeIn: "v2", v2At: at, updatedAt: at, updatedBy: me.id,
    ...(kind === "launch" ? { category: "launch", group: "신제품", batch: "", launchDate, dueDate: launchDate }
      : { dueDate: end, group: "기타", ...(tpl.category ? { category: tpl.category } : {}), road: cleanRoad(road), roadBy: me.id, roadAt: at, ...(kind === "flow" ? { wfId: tpl.wfId || "" } : {}) }) };
  const tasks = live.map((x) => { const ow = owner.get(x.key), who = ow.id, other = who !== me.id, d = dates.get(x.key) || {}, top = !x.parentKey || !ks.has(x.parentKey);
    const li = kind === "launch" && x.launchItem && top ? x.launchItem : "", tg = li ? targetOf({ launchItem: li }) : 0, deps = (x.afterKeys || []).filter((k) => ks.has(k) && k !== x.key).map((k) => idOf.get(k));
    return { id: idOf.get(x.key), title: tg ? `${x.title} (0/${tg})` : x.title, isFixed: false, type: "general", status: "todo", assigneeId: who, assigneeIds: [who], projectId: pid, parentId: top ? null : idOf.get(x.parentKey),
      dueDate: d.due || "", workDate: "", ...(d.start ? { startDate: d.start } : {}), memo: "", attachments: [], weekDay: null, weekSlot: null, priority: "mid", ...(brand ? { brand } : {}),
      ...(deps.length ? { deps } : {}), ...(top && x.phase && road.some((s) => s.k === x.phase) ? (li ? { phase: x.phase } : { phase: x.phase, phaseBy: me.id, phaseAt: at }) : {}),
      ...(li ? { launchItem: li, dueAuto: false } : {}), ...(estOf(x) ? { estDays: estOf(x) } : {}),
      noReview: true, ownerAuto: !!li && ow.from === "lead", ownerFrom: li && ow.from === "lead" ? "lead" : "set",
      ...(other ? { assignedBy: me.id, assignedAt: at, bulkId: bulk } : { ackAt: at }),
      requestedBy: me.id, requestedAt: at, createdAt: at, createdBy: me.id, statusLog: [{ by: me.id, byName: me.name, at, status: "todo" }], madeIn: "v2", v2At: at, updatedAt: at, updatedBy: me.id,
      fromTemplate: tpl.id, tplKey: x.key }; });
  const byWho = {}; tasks.forEach((t) => { (byWho[t.assigneeId] = byWho[t.assigneeId] || []).push(t); });
  return { project, tasks, kind, start: s0, end, launchDate, total: E.total, missing: E.missing, noDue: tasks.filter((t) => !t.dueDate).length, byWho, at };
}
