// 업무OS v2 — AI 승인 (계산만 · 저장 없음 · 사용자 결정 2026-10-12)
//   "AI팀원이 실행한 것을 사람팀원에게 승인요청하고, 사람팀원은 상급자 사람에게 승인요청" → 길 = AI → 담당 → 리드 → 본부장 (상급자 users.bossId 를 따라 맨 위까지)
//   "3팀 리드는 김채원, 본부장은 허지은" (상급자 추천 · 관리자 › 사람 [추천대로 정하기] 한 번)
// 저장(core.jsx 가 씀):
//   pour-os/v2/aiasks/{id}  승인 한 건 (모양 = marketing-hub/crew.js askDoc · 허브 crew.html · team_link.py 가 만듦)
//     state wait(사람 차례 · to = 그 사람 · '' = 담당 미정 → 관리자 누구나) · back(AI 가 고치는 중) · ok(최종 승인) · no(안 함)
//     step 0 = 담당 · 1 = 상급자 · 2 = 그 위 … · path = 이번 판에 승인한 사람 · pick = 고른 번호(null = 번호 없음)
//     log[] (arrayUnion · 더하기만) · ret = 상급자가 담당에게 돌려보낸 말 · back = 담당이 AI 에게 돌려보낸 말
//   pour-os/v2/aimates/{AI id}  담당·규칙 덧칠 {owners:{_ 기본, 브랜드 id: 사람}, rules[], paused, hist[]}
//   users.bossId  상급자 (관리자 › 사람)
//   최종 승인 + 실행 한 줄(exec) → 담당에게 '실행' 업무(tasks · aiAsk = 승인 id) — 실제 반영은 늘 사람 (2026-10-11)
import { isMaster, nameOf, teamOf, isOffDay, ymd } from "./model.js";
import { mateOf, crewOf, brandL, asidePlan, loginSites } from "../../marketing-hub/crew.js";

export const ASK_STATE_L = { wait: "승인 대기", back: "AI가 고치는 중", ok: "최종 승인", no: "안 함" };
export const MAX_UP = 5;   // 길이 이보다 길게 이어지지 않게 (상급자 고리·잘못 넣은 값 막기)

const actU = (users, id) => (users || []).find((u) => u && u.id === id && u.active !== false) || null;
// 상급자: 사용 중인 사람만 · 나 자신이면 없음
export const bossOf = (uid, users) => { const u = actU(users, uid), b = u && u.bossId; return b && b !== uid && actU(users, b) ? b : ""; };
// 담당: aimates 덧칠의 브랜드별 → 기본 · 사용 중인 사람이 아니면 '' (관리자 누구나)
export const mateOwner = (doc, brand, users) => { const o = (doc && doc.owners) || {}, id = (brand && o[brand]) || o._ || ""; return actU(users, id) ? id : ""; };

// 누를 수 있나: 지금 차례인 사람 · 담당 미정이면 관리자 누구나 · 관리자는 대신(기록에 원래 차례인 사람이 proxy 로 남음)
export const canAct = (a, cu) => !!a && !!cu && a.state === "wait" && (a.to === cu.id || isMaster(cu));
export const canBack = (a, cu) => canAct(a, cu) && !(a.step > 0);          // AI 에게 다시 = 담당 단계에서만
export const canRet = (a, cu) => canAct(a, cu) && a.step > 0;              // 담당에게 돌려보내기 = 상급자 단계
export const isProxy = (a, cu) => !!a.to && a.to !== cu.id;
export const pickOk = (a, pick) => !(a.items || []).length || (Array.isArray(pick) && pick.length > 0);
const expectOf = (a) => ({ state: a.state, to: a.to || "", step: a.step || 0, ver: a.ver || 1 });

// 승인 → 위로 (상급자가 있으면) 또는 최종 승인
export function planPass(a, cu, users, pick, at) {
  const approver = a.to || cu.id;   // 담당 미정 → 누른 관리자가 담당 칸
  const path = [...(a.path || []), approver];
  let next = bossOf(approver, users); if (next && path.includes(next)) next = ""; if (path.length >= MAX_UP) next = "";
  const items = (a.items || []).length, pk = items ? (Array.isArray(pick) ? pick : []) : null;
  const owner = a.owner || (!(a.step > 0) ? approver : "") || approver;
  const entry = { at, by: cu.id, byName: cu.name, act: next ? "up" : "ok", step: a.step || 0, ...(next ? { to: next } : {}), ...(pk ? { pick: pk } : {}), ...(cu.id !== approver ? { proxy: approver } : {}) };
  const base = { path, pick: pk, ret: null, updatedAt: at, owner };
  const fields = next ? { ...base, to: next, step: (a.step || 0) + 1 } : { ...base, state: "ok", to: "", okAt: at, okBy: cu.id, okByName: cu.name };
  return { next, final: !next, fields, entry, expect: expectOf(a) };
}
// AI 에게 다시 (담당 단계) — AI 가 다음 실행 전에 읽고 고쳐 다시 올림(team_link.py feedback · crew.html)
//   more = 더 만들기 n개 (2026-10-15 사장님 "횟수 조절을 사람팀원이하면 더 추가해서 생성가능하게") — 지금 것 그대로 + n개 · 같은 건의 다음 판으로
export const MORE_MAX = 50;
export const moreText = (n, note) => `지금 것은 그대로 두고 ${n}개 더 만들어 주세요${note ? " · " + note : ""}`;
export function planBack(a, cu, text, at, more) {
  const n = Math.max(0, Math.min(MORE_MAX, Math.round(Number(more) || 0)));
  const back = { text, by: cu.id, byName: cu.name, at, ...(n ? { more: n } : {}) };
  return { fields: { state: "back", to: "", back, pick: null, path: [], ret: null, updatedAt: at, owner: a.owner || cu.id }, entry: { at, by: cu.id, byName: cu.name, act: "back", step: 0, text, ...(n ? { more: n } : {}) }, expect: expectOf(a) };
}
// 담당에게 돌려보내기 (상급자 단계) — 담당이 번호를 다시 고르거나 AI 에게 다시
export function planRet(a, cu, text, at) {
  const owner = a.owner || (a.path || [])[0] || "";
  return { fields: { to: owner, step: 0, path: [], ret: { text, by: cu.id, byName: cu.name, at }, updatedAt: at }, entry: { at, by: cu.id, byName: cu.name, act: "ret", step: a.step || 0, to: owner, text }, expect: expectOf(a) };
}
// 안 함 (어느 단계든)
export function planDrop(a, cu, reason, at) {
  return { fields: { state: "no", to: "", noAt: at, noBy: cu.id, noByName: cu.name, noReason: reason || "", updatedAt: at }, entry: { at, by: cu.id, byName: cu.name, act: "no", step: a.step || 0, text: reason || "" }, expect: expectOf(a) };
}

// 번호 한 줄 요약 (열 앞쪽 값 3개)
export const itemLine = (it, cols) => { const c = (it && it.c) || {}, ks = (cols && cols.length ? cols : Object.keys(c)).filter((k) => c[k] != null && c[k] !== "");
  return ks.slice(0, 3).map((k) => String(c[k])).join(" · ").slice(0, 90); };
// 최종 승인 뒤 '실행' 업무 (담당에게 · 사람이 반영) — 실행 한 줄이 없으면(보고만) 없음
export function planExec(a, pick, cu, users, at, due) {
  if (!a || !a.exec) return null;
  const owner = actU(users, a.owner) ? a.owner : cu.id, items = a.items || [], pk = Array.isArray(pick) ? pick : null;
  const chosen = pk ? items.filter((it) => pk.includes(it.n)) : [];
  const id = `aix_${a.id}${(a.ver || 1) > 1 ? "_" + a.ver : ""}`;
  const head = `${a.mateName || "AI"}${a.act ? " " + a.act : ""}`;
  const title = `실행 · ${head} · ${String(a.title || "").replace(/^.*?·\s*/, "").slice(0, 50)}${chosen.length ? ` (${chosen.map((x) => x.n).join("·")})` : ""}`;
  const memo = [a.exec, chosen.length ? `승인 번호 ${chosen.length}개` : "", ...chosen.map((x) => `- ${x.n} · ${itemLine(x, a.cols)}`), "", `AI 결과 · ${a.mateName || ""} · ${a.title}`].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n");
  return { id, title, isFixed: false, type: "general", status: "todo", assigneeId: owner, assigneeIds: [owner], projectId: "", parentId: null, dueDate: due || "", workDate: "", memo, attachments: [], weekDay: null, weekSlot: null, priority: "mid",
    ...(a.brand && brandL(a.brand) ? { brand: a.brand } : {}), noReview: true, ...(owner === cu.id ? { ackAt: at } : {}), v2At: at,
    requestedBy: cu.id, requestedAt: at, createdAt: at, createdBy: cu.id, statusLog: [{ by: cu.id, byName: cu.name, at, status: "todo" }], madeIn: "v2", aiAsk: a.id, aiMate: a.mate || "" };
}

// 승인 길 (보기용): 이번 판에 승인한 사람(✓) → 지금 차례(●) → 그 위 상급자들(앞으로) · 끊기면 거기서 끝
export function chainOf(a, users) {
  const out = [], seen = new Set(), push = (uid, st) => { if (uid && seen.has(uid)) return; if (uid) seen.add(uid); out.push({ uid, st, name: uid ? nameOf(users, uid) || "(없는 사람)" : "관리자 누구나" }); };
  (a.path || []).forEach((u) => push(u, "done"));
  let from = "";
  if (a.state === "wait") { push(a.to || "", "now"); from = a.to; }
  else if (a.state === "back") { from = a.owner || ""; if (from) push(from, "wait"); }
  else return out;
  for (let k = 0, cur = from; k < MAX_UP && cur; k++) { const b = bossOf(cur, users); if (!b || seen.has(b)) break; push(b, "next"); cur = b; }
  return out;
}

// '확인할 것' 줄 (todayView 가 D.aiInbox 로 부름) — 지금 내 차례인 것 · 담당 미정은 관리자 누구나 · 같은 AI 3건 넘으면 한 줄로
//   최종 승인·안 함은 담당에게 한 번(읽음 = 사라짐 · 7일)
export const AI_GROUP_MIN = 4;
export function askInbox(asks, users, uid, seen = {}, now = new Date()) {
  const me = actU(users, uid); if (!me) return [];
  const master = isMaster(me), since = new Date(now - 7 * 864e5).toISOString(), mine = [], rows = [];
  (asks || []).forEach((a) => {
    if (!a || !a.id) return;
    const ai = `${a.mateName || "AI"} (AI)`;
    if (a.state === "wait" && (a.to === uid || (!a.to && master))) {
      const n = (a.items || []).length, pk = Array.isArray(a.pick) ? a.pick.length : 0, prev = a.step > 0 ? nameOf(users, (a.path || [])[(a.path || []).length - 1]) : "";
      const tag = a.ret ? "수정 요청" : a.step > 0 ? "확인 요청" : "AI 승인 요청";
      const text = a.ret ? `${a.ret.byName}: ${a.ret.text}`
        : a.step > 0 ? ["승인하고 넘김", n ? `${pk}개 고름` : "", `${ai} 결과`].filter(Boolean).join(" · ")
        : [brandL(a.brand), n ? `제안 ${n}개 · 번호 골라 승인` : "확인하고 승인", (a.ver || 1) > 1 ? `${a.ver}번째로 다시 올림` : "", !a.to ? "담당 미정 · 관리자 누구나" : ""].filter(Boolean).join(" · ");
      mine.push({ kind: "ai", tag, red: !!a.ret, id: `ai:${a.id}:${a.ver || 1}:${a.step || 0}:${a.to || "-"}`, aiId: a.id, mate: a.mate, title: a.title, whoName: a.step > 0 && prev ? prev : ai, at: a.updatedAt || a.createdAt, text, keep: true, _ret: !!a.ret });
    }
    if (a.owner === uid && a.state === "ok" && a.okBy !== uid && (a.okAt || "") >= since && !seen["ao:" + a.id + a.okAt])
      rows.push({ kind: "aiDone", tag: "최종 승인", id: "ao:" + a.id + a.okAt, aiId: a.id, title: a.title, whoName: a.okByName, at: a.okAt, text: a.exec ? "실행 업무가 생겼어요 · 사람이 반영해 주세요" : "끝난 일로 확인됐어요" });
    if (a.owner === uid && a.state === "no" && a.noBy !== uid && (a.noAt || "") >= since && !seen["an:" + a.id + a.noAt])
      rows.push({ kind: "aiDone", tag: "안 함", id: "an:" + a.id + a.noAt, aiId: a.id, title: a.title, whoName: a.noByName, at: a.noAt, text: a.noReason || "안 하기로 했어요" });
  });
  // 같은 AI 의 승인 대기(돌려받은 것 빼고)가 많으면 한 줄 → 그 AI 한 장
  const by = {}; mine.forEach((x) => { if (!x._ret) (by[x.mate] = by[x.mate] || []).push(x); });
  const grouped = new Set();
  Object.entries(by).forEach(([mate, g]) => { if (g.length < AI_GROUP_MIN) return; g.forEach((x) => grouped.add(x.id)); const m = mateOf(mate) || { name: mate };
    rows.push({ kind: "aiGroup", tag: "AI 승인 요청", id: `ag:${mate}:${g.length}`, mate, title: `${m.name} 결과 ${g.length}건`, whoName: `${m.name} (AI)`, at: g.map((x) => x.at || "").sort().pop(), text: g.slice(0, 2).map((x) => x.title).join(" · ") + (g.length > 2 ? ` 외 ${g.length - 2}건` : ""), keep: true }); });
  return [...mine.filter((x) => !grouped.has(x.id)).map(({ _ret, ...x }) => x), ...rows];
}

// AI 한 명 성과 (최근 since 이후 · 고도화용): 승인 · AI 에게 다시 · 돌려받음 · 안 함 · 대기 · 고치는 중
export function mateStats(asks, mateId, since) {
  const a = (asks || []).filter((x) => x && x.mate === mateId), recent = a.filter((x) => (x.updatedAt || x.createdAt || "") >= since);
  const logs = recent.flatMap((x) => (x.log || []).filter((l) => (l.at || "") >= since));
  const ok = recent.filter((x) => x.state === "ok").length, no = recent.filter((x) => x.state === "no").length;
  return { wait: a.filter((x) => x.state === "wait").length, back: a.filter((x) => x.state === "back").length, ok, no,
    redo: logs.filter((l) => l.act === "back").length, ret: logs.filter((l) => l.act === "ret").length,
    more: logs.filter((l) => l.act === "back" && l.more > 0).length,   // 더 만들기 (2026-10-15) — 자주 나오면 '횟수'를 늘리라고 알림
    rate: ok + no ? Math.round((ok / (ok + no)) * 100) : null,
    // 최근 '고칠 점'(AI 에게 다시 · 돌려받은 말 · 안 한 이유) — 같은 말이 또 나오면 [규칙으로] · 더 만들기는 고칠 점이 아니라 빼고 (횟수로)
    notes: logs.filter((l) => (l.act === "back" || l.act === "ret" || l.act === "no") && l.text && !(l.more > 0)).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 8) };
}
// 같은 지적이 두 번 넘게 나왔나 (규칙 권유) — 띄어쓰기·문장부호 빼고 앞 12글자 같음
export const repeatNotes = (notes) => { const k = (s) => String(s || "").replace(/[\s.,!?·~]/g, "").slice(0, 12), c = {}; (notes || []).forEach((n) => { const x = k(n.text); if (x) c[x] = (c[x] || 0) + 1; });
  return (notes || []).filter((n, i, arr) => c[k(n.text)] >= 2 && arr.findIndex((m) => k(m.text) === k(n.text)) === i); };

// ── 상급자 추천 (사용자 2026-10-12 "3팀 리드는 김채원, 본부장은 허지은") ──
//   팀원 → 그 팀 리드 · 리드·공용 → 본부장 · 본부장 = 맨 위 — 1팀·2팀 리드는 관리자·리드 기본값에서 짐작(김소연·김송희 · 고칠 수 있음)
export const HQ_HEAD = "허지은";
export const TEAM_LEADS = { "1팀": "김소연", "2팀": "김송희", "3팀": "김채원" };
const clean = (s) => String(s || "").replace(/\s/g, "");
export function bossRec(users) {
  const act = (users || []).filter((u) => u && u.active !== false), byName = (n) => act.find((u) => clean(u.name) === clean(n)) || null;
  const head = byName(HQ_HEAD), leads = new Set(Object.values(TEAM_LEADS).map((n) => (byName(n) || {}).id).filter(Boolean)), out = {};
  act.forEach((u) => { if (head && u.id === head.id) { out[u.id] = ""; return; }
    if (leads.has(u.id)) { out[u.id] = head ? head.id : ""; return; }
    const t = teamOf(u), lead = TEAM_LEADS[t] ? byName(TEAM_LEADS[t]) : null;
    out[u.id] = lead && lead.id !== u.id ? lead.id : head ? head.id : ""; });
  return out;
}
// 상급자 고리 찾기 (A→B→A) — 정하기 전에 막음
export function bossLoop(users, uid, bossId) { if (!bossId) return false; if (bossId === uid) return true;
  const m = new Map((users || []).map((u) => [u.id, u.bossId || ""])); m.set(uid, bossId); let cur = bossId;
  for (let k = 0; k < 20 && cur; k++) { if (cur === uid) return true; cur = m.get(cur) || ""; } return false; }

// ── Aside 담당 PC (2026-10-15 사장님 "사람 담당자들 모두 어사이드 돌릴 수 있어. 각각 돌려서 빨리" · "각 담당자들에게 세팅방안 업무 os로 알려줘") ──
//   계획 = crew.asidePlan(보드 → 담당) — 허브 crew.html 세팅 카드와 같은 계산(담당이 다르면 동시에 09:00 · 같은 PC 여럿이면 한 시간씩 · 담당 미정 = 관리자 PC 한 곳)
//   '확인할 것'(keep = 처리되면 사라짐): 담당 = '내 PC Aside 세팅'(내 보드가 한 번도 안 올라옴) · 'Aside 안 돎'(평일 · 예약 + 90분 · 예전엔 올렸는데 오늘 안 올라옴)
//   관리자 = 'AI 크루 담당 미정 n명' · 보드 값 D.ai.boards = aiboards {보드 id: {at …}} (허브 crew.html 이 올릴 때 씀)
export const asidePlanOf = (D) => asidePlan((b) => mateOwner(((D.ai && D.ai.mates) || {})[b.mate], b.brand, D.users));
export const MISS_AFTER = 90;
const addMin = (t, n) => { const x = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + n; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
const hmOf = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const ranOn = (v, key) => !!(v && v.at) && ymd(new Date(v.at)) === key;   // 그날 올렸나 (기기 시각 = 한국)
// 오늘 안 돎: 평일 · 예전엔 올렸는데(처음 세팅 전은 아님) 오늘은 아직 · 예약 시각 + 90분 지남 ('확인할 것' · 세팅 시트가 같이 씀)
export const missedOn = (v, t, now = new Date()) => { const key = ymd(now); return !isOffDay(key) && !!(v && v.at) && !ranOn(v, key) && hmOf(now) >= addMin(t, MISS_AFTER); };
export function asideInbox(D, uid, now = new Date()) {
  const me = actU(D.users, uid); if (!me || !D.ai || !D.ai.ready) return [];
  const plan = asidePlanOf(D), bv = D.ai.boards || {}, key = ymd(now), out = [];
  const nm = (b) => (mateOf(b.mate) || {}).name || b.mate;
  const g = plan.find((x) => x.owner === uid);
  if (g) {
    const fresh = g.runs.filter((r) => !(bv[r.board.id] || {}).at);
    if (fresh.length) out.push({ kind: "aiSetup", tag: "AI 크루 세팅", id: `as:${uid}:${fresh.map((r) => r.board.id).join(",")}`, whoName: "AI 크루", at: key + "T00:00:00", keep: true,
      title: `내 PC Aside 세팅 · ${g.runs.map((r) => `${nm(r.board)} ${r.t}`).join(" · ")}`,
      text: `처음 한 번 · 예약 ${g.runs.length}개 · 로그인 ${loginSites(g.runs.map((r) => r.board)).length + 1}곳 · 세팅하면 평일마다 내 PC 에서 돌아요` });
    g.runs.forEach((r) => { if (!missedOn(bv[r.board.id], r.t, now)) return;
      out.push({ kind: "aiMiss", tag: "Aside 안 돎", red: true, id: `am:${r.board.id}:${key}`, board: r.board.id, whoName: `${nm(r.board)} (AI)`, at: `${key}T${r.t}:00`, keep: true,
        title: `오늘 ${nm(r.board)}(AI)가 아직 안 올렸어요`, text: `${r.t} 예약 · PC·Aside 가 켜져 있는지 확인 · [지금 돌리기]로 바로` }); });
  }
  if (isMaster(me)) { const un = plan.find((x) => !x.owner);
    if (un) out.push({ kind: "aiOwnerless", tag: "AI 크루 담당", id: `ao:${un.runs.map((r) => r.board.id).join(",")}`, whoName: "AI 크루", at: key + "T00:00:00", keep: true,
      title: `AI 크루 담당 미정 ${un.runs.length}명`, text: `${un.runs.map((r) => nm(r.board)).join(" · ")} · 담당을 정하면 그 사람 PC 에서 돌고 세팅 안내가 가요` }); }
  return out;
}

// AI 팀원 한 명이 지금 어디서 일하나 (화면 머리)
export const mateWhere = (mateId) => { const c = crewOf(mateId); return c ? c.name : "기본 AI 팀원 (원형)"; };
