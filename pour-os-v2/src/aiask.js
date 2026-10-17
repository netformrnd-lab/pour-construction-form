// 업무OS v2 — AI 승인 (계산만 · 저장 없음 · 사용자 결정 2026-10-12)
//   "AI팀원이 실행한 것을 사람팀원에게 승인요청하고, 사람팀원은 상급자 사람에게 승인요청" → 길 = AI → 담당 → 리드 → 본부장 (상급자 users.bossId 를 따라 맨 위까지)
//   "3팀 리드는 김채원, 본부장은 허지은" (상급자 추천 · 관리자 › 사람 [추천대로 정하기] 한 번)
//   2026-10-15 사장님 "최종승인은 리드 · 본부장은 승인 없이 리드에게 보고받음 · 광고비 예산 조정, 원가조정, 판매가조정만 본부장 승인"
//     → 리드 다음이 본부장이면 거기서 최종 (hqOf = 본부장 승인 필요 이유 · 승인자가 [본부장에게도 올리기] = hqUp) · 할 일별 담당 aimates.actOwners
// 저장(core.jsx 가 씀):
//   pour-os/v2/aiasks/{id}  승인 한 건 (모양 = marketing-hub/crew.js askDoc · 허브 crew.html · team_link.py 가 만듦)
//     state wait(사람 차례 · to = 그 사람 · '' = 담당 미정 → 관리자 누구나) · back(AI 가 고치는 중) · ok(최종 승인) · no(안 함)
//     step 0 = 담당 · 1 = 상급자 · 2 = 그 위 … · path = 이번 판에 승인한 사람 · pick = 고른 번호(null = 번호 없음)
//     log[] (arrayUnion · 더하기만) · ret = 상급자가 담당에게 돌려보낸 말 · back = 담당이 AI 에게 돌려보낸 말
//   pour-os/v2/aimates/{AI id}  담당·규칙 덧칠 {owners:{_ 기본, 브랜드 id: 사람}, actOwners:{할 일 글자: 사람}, actHq:{할 일 글자: true|false}, actAk:{할 일 글자: 반복 실행 id}, rules[], paused, hist[]}
//   users.bossId  상급자 (관리자 › 사람)
//   최종 승인 + 실행 한 줄(exec) → 담당에게 '실행' 업무(tasks · aiAsk = 승인 id) — 실제 반영은 늘 사람 (2026-10-11)
import { isMaster, nameOf, teamOf, isOffDay, ymd, addDays, nextWorkday, wdBetween } from "./model.js";
import { CREWS, mateOf, crewOf, brandL, asidePlan, loginSites, actOf, launchRows, launchRowOf, GONE, runWord } from "../../marketing-hub/crew.js";
import { ASIDE_ADS_LAUNCH_VER } from "../../marketing-hub/adops.js";   // 광고 Aside 예약 글 판 (2026-10-17)

export const ASK_STATE_L = { wait: "승인 대기", back: "AI가 고치는 중", ok: "최종 승인", no: "안 함" };
export const MAX_UP = 5;   // 길이 이보다 길게 이어지지 않게 (상급자 고리·잘못 넣은 값 막기)

const actU = (users, id) => (users || []).find((u) => u && u.id === id && u.active !== false) || null;
// 상급자: 사용 중인 사람만 · 나 자신이면 없음
export const bossOf = (uid, users) => { const u = actU(users, uid), b = u && u.bossId; return b && b !== uid && actU(users, b) ? b : ""; };
// 담당: aimates 덧칠의 브랜드별 → 기본 · 사용 중인 사람이 아니면 '' (관리자 누구나)
export const mateOwner = (doc, brand, users) => { const o = (doc && doc.owners) || {}, id = (brand && o[brand]) || o._ || ""; return actU(users, id) ? id : ""; };
// 할 일 담당 (2026-10-15) — 할 일마다 정한 사람(사용 중) → 없으면 AI 담당
export const actOwner = (doc, brand, act, users) => { const x = doc && doc.actOwners && act ? doc.actOwners[act] : ""; return x && actU(users, x) ? x : mateOwner(doc, brand, users); };
// 리드 · 본부장 (상급자 추천과 같은 기준: 역할 lead 또는 팀 리드 이름 · 본부장 이름)
export const isHQ = (users, uid) => { const u = actU(users, uid); return !!u && clean(u.name) === clean(HQ_HEAD); };
export const isLeadU = (users, uid) => { const u = actU(users, uid); return !!u && (u.role === "lead" || Object.values(TEAM_LEADS).some((n) => clean(n) === clean(u.name))); };
// 본부장 승인이 필요한 이유 ('' = 리드에서 끝) — 승인자가 [본부장에게도 올리기](hqUp) → 실행 없는 보고는 늘 '' → 관리자가 할 일마다 정함(actHq) → 보드 할 일 hq
export function hqOf(a, mateDoc) {
  if (!a) return "";
  if (a.hqUp) return "본부장 확인 요청";
  if (!a.exec) return "";
  const ov = mateDoc && mateDoc.actHq && a.act ? mateDoc.actHq[a.act] : undefined;
  const def = a.hq != null ? a.hq : ((a.board && actOf(a.board, a.act)) || {}).hq || "";
  if (ov === false) return "";
  if (ov === true) return def || "관리자 지정";
  return def || "";
}

// 누를 수 있나: 지금 차례인 사람 · 담당 미정이면 관리자 누구나 · 관리자는 대신(기록에 원래 차례인 사람이 proxy 로 남음)
export const canAct = (a, cu) => !!a && !!cu && a.state === "wait" && (a.to === cu.id || isMaster(cu));
export const canBack = (a, cu) => canAct(a, cu) && !(a.step > 0);          // AI 에게 다시 = 담당 단계에서만
export const canRet = (a, cu) => canAct(a, cu) && a.step > 0;              // 담당에게 돌려보내기 = 상급자 단계
export const isProxy = (a, cu) => !!a.to && a.to !== cu.id;
export const pickOk = (a, pick) => !(a.items || []).length || (Array.isArray(pick) && pick.length > 0);
const expectOf = (a) => ({ state: a.state, to: a.to || "", step: a.step || 0, ver: a.ver || 1 });

// 승인 → 위로 (상급자가 있으면) 또는 최종 승인
//   opt.hq = hqOf(본부장 승인 필요 이유) · opt.up = 승인자가 [본부장에게도 올리기] (2026-10-15 최종 승인 = 리드)
export function planPass(a, cu, users, pick, at, opt = {}) {
  const approver = a.to || cu.id;   // 담당 미정 → 누른 관리자가 담당 칸
  const path = [...(a.path || []), approver];
  let next = bossOf(approver, users); if (next && path.includes(next)) next = ""; if (path.length >= MAX_UP) next = "";
  const up = !!opt.up, hq = opt.hq !== undefined ? opt.hq || (a.hqUp ? "본부장 확인 요청" : "") : hqOf(a, null);   // 덧칠(actHq)은 부르는 쪽이 넘김
  if (next && !hq && !up && isLeadU(users, approver) && isHQ(users, next)) next = "";   // 리드 → 본부장 은 본부장 승인 일만
  const items = (a.items || []).length, pk = items ? (Array.isArray(pick) ? pick : []) : null;
  const owner = a.owner || (!(a.step > 0) ? approver : "") || approver;
  const entry = { at, by: cu.id, byName: cu.name, act: next ? "up" : "ok", step: a.step || 0, ...(next ? { to: next } : {}), ...(pk ? { pick: pk } : {}), ...(cu.id !== approver ? { proxy: approver } : {}), ...(up && next ? { hqUp: true } : {}) };
  const base = { path, pick: pk, ret: null, updatedAt: at, owner, ...(up && next ? { hqUp: { by: cu.id, byName: cu.name, at } } : {}) };
  const fields = next ? { ...base, to: next, step: (a.step || 0) + 1 } : { ...base, state: "ok", to: "", okAt: at, okBy: cu.id, okByName: cu.name };
  return { next, final: !next, fields, entry, expect: expectOf(a) };
}
// [본부장에게도 올리기] 를 보여 줄까: 지금 누르면 리드에서 끝나는데(규칙 때문) 바로 위가 본부장
export const canUpHQ = (a, cu, users, hq) => { if (!canAct(a, cu) || hq) return false; const ap = a.to || cu.id, b = bossOf(ap, users); return !!b && isLeadU(users, ap) && isHQ(users, b) && !(a.path || []).includes(b); };
// AI 에게 다시 (담당 단계) — AI 가 다음 실행 전에 읽고 고쳐 다시 올림(team_link.py feedback · crew.html)
//   more = 더 만들기 n개 (2026-10-15 사장님 "횟수 조절을 사람팀원이하면 더 추가해서 생성가능하게") — 지금 것 그대로 + n개 · 같은 건의 다음 판으로
export const MORE_MAX = 50;
export const moreText = (n, note) => `지금 것은 그대로 두고 ${n}개 더 만들어 주세요${note ? " · " + note : ""}`;
export function planBack(a, cu, text, at, more) {
  const n = Math.max(0, Math.min(MORE_MAX, Math.round(Number(more) || 0)));
  const back = { text, by: cu.id, byName: cu.name, at, ...(n ? { more: n } : {}) };
  return { fields: { state: "back", to: "", back, pick: null, path: [], ret: null, hqUp: null, updatedAt: at, owner: a.owner || cu.id }, entry: { at, by: cu.id, byName: cu.name, act: "back", step: 0, text, ...(n ? { more: n } : {}) }, expect: expectOf(a) };
}
// 담당에게 돌려보내기 (상급자 단계) — 담당이 번호를 다시 고르거나 AI 에게 다시
export function planRet(a, cu, text, at) {
  const owner = a.owner || (a.path || [])[0] || "";
  return { fields: { to: owner, step: 0, path: [], ret: { text, by: cu.id, byName: cu.name, at }, hqUp: null, updatedAt: at }, entry: { at, by: cu.id, byName: cu.name, act: "ret", step: a.step || 0, to: owner, text }, expect: expectOf(a) };   // hqUp(본부장에게도 올리기)은 판마다 다시 정함
}
// 안 함 (어느 단계든)
export function planDrop(a, cu, reason, at) {
  return { fields: { state: "no", to: "", noAt: at, noBy: cu.id, noByName: cu.name, noReason: reason || "", updatedAt: at }, entry: { at, by: cu.id, byName: cu.name, act: "no", step: a.step || 0, text: reason || "" }, expect: expectOf(a) };
}

// 번호 한 줄 요약 (열 앞쪽 값 3개)
export const itemLine = (it, cols) => { const c = (it && it.c) || {}, ks = (cols && cols.length ? cols : Object.keys(c)).filter((k) => c[k] != null && c[k] !== "");
  return ks.slice(0, 3).map((k) => String(c[k])).join(" · ").slice(0, 90); };
// 최종 승인 뒤 '실행' 업무 (담당에게 · 사람이 반영) — 실행 한 줄이 없으면(보고만) 없음
//   흔적(2026-10-15 사장님 "마케터들은 업무 흔적 꼭 · 어떤 포스팅·어떤 인플루언서인지 AI가 알아서 세팅 · 사람이 확인 · KPI 추적"):
//   aiItems = 승인한 번호마다 {n, t(한 줄), link(표의 링크)} — AI 가 미리 채움 → 사람이 번호마다 [했어요](링크 고침 가능)·[안 함] → aiTrace.<번호>
//   aiAk = 그 할 일과 짝지은 반복 실행(aimates.actAk) → [했어요] 마다 반복 실행 +1 (흔적이 같이 남음) = KPI 추적 · aiAks = 열쇠 여러 개(2026-10-17 · 누른 사람 것만 셈)
const URL_RE = /https?:\/\/[^\s<>"')]+/;
//   칸 순서: 초안·게시물·링크(사람이 확인할 그것) → URL·주소·프로필·계정(최종 URL 같은 도착 주소) → 아무 칸의 주소 (디맨드젠 '초안 링크' > '최종 URL' · 2026-10-15)
const URL_KEYS = [/초안|게시|링크|link/i, /URL|주소|프로필|계정/i];
export const firstUrl = (c) => { const v = c || {}, ks = Object.keys(v), has = (x) => URL_RE.test(String(v[x]));
  const k = URL_KEYS.map((re) => ks.find((x) => re.test(x) && has(x))).find(Boolean) || ks.find(has); return k ? (String(v[k]).match(URL_RE) || [""])[0] : ""; };
// 번호 한 줄 + 링크 (한 줄에서는 링크 칸을 빼서 두 번 안 보이게)
//   b = 그 줄 브랜드 ('브랜드' 칸 · 그로홈·POUR스토어 → grohome·pourstore · 2026-10-17) — [했어요] 때 그 브랜드 반복 실행만 셈 (airt.countKeys)
export const itemBrandOf = (v) => { const s = String(v || "").replace(/\s+/g, ""); return /그로홈|grohome/i.test(s) ? "grohome" : /pour|포어/i.test(s) ? "pourstore" : ""; };
//   p = 그 줄 신제품·상품 이름 (보드 할 일 keyBy 면 [했어요] 가 그 이름이 들어간 정한 날 체크만 셈 · 2026-10-17)
export const itemProdOf = (c) => String(((c || {})["신제품"] || (c || {})["상품"] || "")).trim().slice(0, 40);
const traceItem = (x) => { const link = firstUrl(x.c), c = link ? Object.fromEntries(Object.entries(x.c || {}).filter(([, v]) => !String(v).includes(link))) : x.c || {}, b = itemBrandOf((x.c || {})["브랜드"]), p = itemProdOf(x.c);
  return { n: x.n, t: itemLine({ c }, Object.keys(c)) || itemLine(x), link, ...(b ? { b } : {}), ...(p ? { p } : {}) }; };
// 승인 건의 신제품 칸 (디맨드젠 x_dg · 2026-10-15) — 상품 이름 → 끝나지 않은 그 신제품 업무 id ('' = 못 찾음)
export const launchTaskOf = (D, a) => { if (!a || !a.launch || !a.prod) return ""; const r = launchRowOf(launchRows((D && D.tasks) || [], (D && D.projects) || [], { item: a.launch }), a.prod); return r ? r.id : ""; };
export function planExec(a, pick, cu, users, at, due, opt = {}) {
  if (!a || !a.exec) return null;
  const owner = actU(users, a.owner) ? a.owner : cu.id, items = a.items || [], pk = Array.isArray(pick) ? pick : null;
  const chosen = pk ? items.filter((it) => pk.includes(it.n)) : [];
  const id = `aix_${a.id}${(a.ver || 1) > 1 ? "_" + a.ver : ""}`;
  const head = `${a.mateName || "AI"}${a.act ? " " + a.act : ""}`;
  const title = `실행 · ${head} · ${String(a.title || "").replace(/^.*?·\s*/, "").slice(0, 50)}${chosen.length ? ` (${chosen.map((x) => x.n).join("·")})` : ""}`;
  const memo = [a.exec, chosen.length ? `승인 번호 ${chosen.length}개` : "", ...chosen.map((x) => `- ${x.n} · ${itemLine(x, a.cols)}`), "", `AI 결과 · ${a.mateName || ""} · ${a.title}`].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n");
  return { id, title, isFixed: false, type: "general", status: "todo", assigneeId: owner, assigneeIds: [owner], projectId: "", parentId: null, dueDate: due || "", workDate: "", memo, attachments: [], weekDay: null, weekSlot: null, priority: "mid",
    ...(a.brand && brandL(a.brand) ? { brand: a.brand } : {}), noReview: true, ...(owner === cu.id ? { ackAt: at } : {}), v2At: at,
    requestedBy: cu.id, requestedAt: at, createdAt: at, createdBy: cu.id, statusLog: [{ by: cu.id, byName: cu.name, at, status: "todo" }], madeIn: "v2", aiAsk: a.id, aiMate: a.mate || "",
    aiAct: a.act || "", aiBoard: a.board || "", aiAk: (opt.aks || [])[0] || opt.ak || "", ...((opt.aks || []).length ? { aiAks: opt.aks } : {}), aiItems: chosen.map(traceItem),   // 짝 열쇠 여러 개 (2026-10-17 · airt.akKeys)
    ...(a.launch ? { aiLaunch: a.launch, aiProd: a.prod || "", aiLaunchTask: opt.launchTask || "" } : {}) };   // 디맨드젠: [했어요] = 그 신제품 칸 +1
}

// 흔적 (실행 업무) — 번호마다 했어요/안 함이 다 남았나 · 번호가 없으면 한 줄 흔적(_) 하나
export const traceList = (t) => { const it = (t && t.aiItems) || []; return it.length ? it : [{ n: "_", t: "무엇을 했는지 (링크·한 줄)", link: "" }]; };
export const traceOf = (t, n) => ((t && t.aiTrace) || {})[n] || null;
export const traceLeft = (t) => (!t || !t.aiAsk ? 0 : traceList(t).filter((x) => { const r = traceOf(t, x.n); return !(r && (r.done || r.skip)); }).length);
export const traceDoneN = (t) => traceList(t).filter((x) => (traceOf(t, x.n) || {}).done).length;
// 승인 길 (보기용): 이번 판에 승인한 사람(✓) → 지금 차례(●) → 그 위 상급자들(앞으로) · 끊기면 거기서 끝
export function chainOf(a, users, hq) {
  const out = [], seen = new Set(), push = (uid, st) => { if (uid && seen.has(uid)) return; if (uid) seen.add(uid); out.push({ uid, st, name: uid ? nameOf(users, uid) || "(없는 사람)" : "관리자 누구나" }); };
  (a.path || []).forEach((u) => push(u, "done"));
  let from = "";
  if (a.state === "wait") { push(a.to || "", "now"); from = a.to; }
  else if (a.state === "back") { from = a.owner || ""; if (from) push(from, "wait"); }
  else return out;
  const toHQ = !!(hq !== undefined ? hq || a.hqUp : hqOf(a, null));   // 리드 → 본부장 은 본부장 승인 일만 (2026-10-15)
  for (let k = 0, cur = from; k < MAX_UP && cur; k++) { const b = bossOf(cur, users); if (!b || seen.has(b)) break; if (!toHQ && isLeadU(users, cur) && isHQ(users, b)) break; push(b, "next"); cur = b; }
  return out;
}

// '확인할 것' 줄 (todayView 가 D.aiInbox 로 부름) — 지금 내 차례인 것 · 담당 미정은 관리자 누구나 · 같은 AI 3건 넘으면 한 줄로
//   최종 승인·안 함은 담당에게 한 번(읽음 = 사라짐 · 7일)
//   멈춤 감시(2026-10-17 · 아래 '멈춤 감시'): 평일 1일 넘게 기다린 줄 = 빨강 '평일 n일째' + 위로 · 같은 할 일의 지난 결과는 최신 줄 하나('이전 결과 n건')
//     · 평일 2일 넘게 한 사람에게 멈춘 승인 = 그 사람 상급자(사람마다)·관리자(한 줄로)에게 '승인 밀림' · AI 가 반나절 넘게 못 고친 것 = 담당에게 'AI 고치는 중'
export const AI_GROUP_MIN = 4;
export function askInbox(asks, users, uid, seen = {}, now = new Date()) {
  const me = actU(users, uid); if (!me) return [];
  const master = isMaster(me), since = new Date(now - 7 * 864e5).toISOString(), key = ymd(now), mine = [], rows = [];
  const myTurn = (a) => a.state === "wait" && !(!a.to && GONE[a.mate]) && (a.to === uid || (!a.to && master));
  const { heads, older } = waitHeads((asks || []).filter((a) => a && a.id && myTurn(a)));   // 같은 할 일의 지난 결과 → 최신 줄 하나
  (asks || []).forEach((a) => {
    if (!a || !a.id) return;
    const ai = `${a.mateName || "AI"} (AI)`;
    // 쉬는 AI(하루·포리·에코 · crew.GONE · 2026-10-14)가 올린 담당 미정 승인은 '확인할 것'에 안 띄움 — 관리자 모두에게 같은 줄이 쌓여 할 일이 묻힘(2026-10-15 페르소나 시험)
    //   → AI 팀원 화면 '쉬는 AI 승인 대기'에서 열어 보거나 [모두 안 함]으로 정리 · 링크(#a-)로는 그대로 열림
    if (a.state === "wait" && !a.to && GONE[a.mate]) return;
    if (myTurn(a) && heads.has(a.id)) {
      const n = (a.items || []).length, pk = Array.isArray(a.pick) ? a.pick.length : 0, prev = a.step > 0 ? nameOf(users, (a.path || [])[(a.path || []).length - 1]) : "";
      const wd = waitWd(a, now), late = wd >= LATE_WD, prevN = (older.get(a.id) || []).length, newer = prevKey(a) ? newerOf(asks, a) : null;   // 더 새 결과가 위로 올라갔거나 끝났으면 이것은 지난 결과
      const tag = a.ret ? "수정 요청" : a.step > 0 ? "확인 요청" : "AI 승인 요청";
      const text = a.ret ? `${a.ret.byName}: ${a.ret.text}`
        : a.step > 0 ? ["승인하고 넘김", n ? `${pk}개 고름` : "", `${ai} 결과`].filter(Boolean).join(" · ")
        : [brandL(a.brand), n ? `제안 ${n}개 · 번호 골라 승인` : "확인하고 승인", (a.ver || 1) > 1 ? `${a.ver}번째로 다시 올림` : "", !a.to ? "담당 미정 · 관리자 누구나" : ""].filter(Boolean).join(" · ");
      mine.push({ kind: "ai", tag, red: !!a.ret || late, ...(late ? { ord: ORD_LATE } : {}), id: `ai:${a.id}:${a.ver || 1}:${a.step || 0}:${a.to || "-"}`, aiId: a.id, mate: a.mate, title: a.title, whoName: a.step > 0 && prev ? prev : ai, at: a.updatedAt || a.createdAt,
        text: [late ? `평일 ${wd}일째` : "", text, prevN ? `이전 결과 ${prevN}건` : "", newer ? "더 새 결과 있음 · 정리해 주세요" : ""].filter(Boolean).join(" · "), keep: true, _ret: !!a.ret, _late: late });
    }
    // AI 가 고치는 중인데 일하는 시간 반나절(BACK_MIN) 넘음 → 담당(없으면 관리자) · 읽음 = 오늘 하루 (멈춤 감시 ②)
    if (a.state === "back" && (a.owner === uid || (!a.owner && master))) {
      const from = (a.back && a.back.at) || a.updatedAt, mins = workMin(from, now), id = `ab:${a.id}:${a.ver || 1}:${key}`;
      if (mins >= BACK_MIN && !seen[id]) rows.push({ kind: "aiStuck", tag: "AI 고치는 중", red: true, id, aiId: a.id, mate: a.mate, title: a.title, whoName: ai, at: from,
        text: `보낸 뒤 일하는 시간 ${Math.floor(mins / 60)}시간째 그대로 · ${a.board ? "누르면 [바로 고치기] 글" : "누르면 사장님께 보낼 글"}` });
    }
    // 맡긴 일 결과 (2026-10-15 · crew.askFromReq) — 맡긴 사람이 담당이 아니면 판마다 한 번 (7일 · 읽음 = 사라짐) · 담당이면 위 승인 줄로 충분
    if (a.req && a.reqBy === uid && a.owner !== uid && (a.updatedAt || a.createdAt || "") >= since && !seen["ar:" + a.id + ":" + (a.ver || 1)])
      rows.push({ kind: "aiDone", tag: "맡긴 일 결과", id: "ar:" + a.id + ":" + (a.ver || 1), aiId: a.id, title: a.title, whoName: ai, at: a.updatedAt || a.createdAt,
        text: a.state === "wait" ? `${a.to ? nameOf(users, a.to) + "님" : "관리자"} 승인 대기 · 결과 먼저 보기` : a.state === "ok" ? "최종 승인됐어요" : a.state === "no" ? `안 하기로 했어요${a.noReason ? " · " + a.noReason : ""}` : "AI가 고치는 중" });
    if (a.owner === uid && a.state === "ok" && a.okBy !== uid && (a.okAt || "") >= since && !seen["ao:" + a.id + a.okAt])
      rows.push({ kind: "aiDone", tag: "최종 승인", id: "ao:" + a.id + a.okAt, aiId: a.id, title: a.title, whoName: a.okByName, at: a.okAt, text: a.exec ? "실행 업무가 생겼어요 · 사람이 반영해 주세요" : "끝난 일로 확인됐어요" });
    if (a.owner === uid && a.state === "no" && a.noBy !== uid && (a.noAt || "") >= since && !seen["an:" + a.id + a.noAt])
      rows.push({ kind: "aiDone", tag: "안 함", id: "an:" + a.id + a.noAt, aiId: a.id, title: a.title, whoName: a.noByName, at: a.noAt, text: a.noReason || "안 하기로 했어요" });
  });
  // 같은 AI 의 승인 대기(돌려받은 것 빼고)가 많으면 한 줄 → 그 AI 한 장 · 늦은 것이 있으면 빨강·위로
  const by = {}; mine.forEach((x) => { if (!x._ret) (by[x.mate] = by[x.mate] || []).push(x); });
  const grouped = new Set();
  Object.entries(by).forEach(([mate, g]) => { if (g.length < AI_GROUP_MIN) return; g.forEach((x) => grouped.add(x.id)); const m = mateOf(mate) || { name: mate }, lateN = g.filter((x) => x._late).length;
    rows.push({ kind: "aiGroup", tag: "AI 승인 요청", red: lateN > 0, ...(lateN ? { ord: ORD_LATE } : {}), id: `ag:${mate}:${g.length}`, mate, title: `${m.name} 결과 ${g.length}건`, whoName: `${m.name} (AI)`, at: g.map((x) => x.at || "").sort().pop(),
      text: (lateN ? `늦은 것 ${lateN}건 · ` : "") + g.slice(0, 2).map((x) => x.title).join(" · ") + (g.length > 2 ? ` 외 ${g.length - 2}건` : ""), keep: true }); });
  // 승인 밀림 (멈춤 감시 ① · "2평일 상급자·관리자") — 한 사람 차례에서 평일 ESC_WD(2)일 넘게 멈춘 승인
  //   → 그 사람 상급자 = 사람마다 한 줄 · 관리자 = 한 줄로 모아(내가 상급자인 사람·나 빼고 · 상급자가 없거나 쉬어도 여기) · 지난 결과는 빼고 셈 · 누르면 가장 오래 기다린 승인 · 읽음 = 오늘 하루
  const byTo = new Map(), stalls = [];
  (asks || []).forEach((a) => { if (a && a.id && a.state === "wait" && a.to && a.to !== uid) { if (!byTo.has(a.to)) byTo.set(a.to, []); byTo.get(a.to).push(a); } });
  byTo.forEach((list, to) => { const hs = waitHeads(list).heads, late = list.filter((a) => hs.has(a.id)).map((a) => ({ a, wd: waitWd(a, now) })).filter((x) => x.wd >= ESC_WD)
      .sort((p, q) => q.wd - p.wd || String(waitFrom(p.a)).localeCompare(String(waitFrom(q.a))));
    if (late.length) stalls.push({ to, boss: bossOf(to, users), late }); });
  stalls.sort((p, q) => q.late[0].wd - p.late[0].wd || String(waitFrom(p.late[0].a)).localeCompare(String(waitFrom(q.late[0].a))));   // 오래 멈춘 사람 먼저
  const lateRow = (st, id) => { const nm = nameOf(users, st.to) || "담당", top = st.late[0];
    return { kind: "aiLate", tag: "승인 밀림", red: true, id, aiId: top.a.id, who: st.to, whoName: `${nm}님 차례`, at: waitFrom(top.a), title: `${nm}님 AI 승인 ${st.late.length}건 · 평일 ${top.wd}일째`,
      text: st.late.slice(0, 2).map((x) => x.a.title).join(" · ") + (st.late.length > 2 ? ` 외 ${st.late.length - 2}건` : "") + (st.boss ? "" : " · 상급자 없음") }; };
  stalls.forEach((st) => { const id = `al:${st.to}:${key}`; if (st.boss === uid && !seen[id]) rows.push(lateRow(st, id)); });
  const ms = master ? stalls.filter((st) => st.boss !== uid) : [], mid = `alm:${ms.map((st) => st.to).sort().join(",")}:${key}`;
  if (ms.length && !seen[mid]) { if (ms.length === 1) rows.push(lateRow(ms[0], mid));
    else { const top = ms.flatMap((st) => st.late).sort((p, q) => q.wd - p.wd || String(waitFrom(p.a)).localeCompare(String(waitFrom(q.a))))[0];
      rows.push({ kind: "aiLate", tag: "승인 밀림", red: true, id: mid, aiId: top.a.id, whoName: "AI 승인", at: waitFrom(top.a), title: `AI 승인 밀림 ${ms.length}명 · 길게는 평일 ${top.wd}일째`,
        text: ms.map((st) => `${nameOf(users, st.to) || "담당"} ${st.late.length}건`).join(" · ") }); } }
  return [...mine.filter((x) => !grouped.has(x.id)).map(({ _ret, _late, ...x }) => x), ...rows];
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
//   dow = 그 보드가 도는 요일(run.dow · 주 1~2회 보드 · 2026-10-17) — 그 요일이 아니면 안 돎 아님
const runsOn = (key, dow) => !isOffDay(key) && (!Array.isArray(dow) || !dow.length || dow.includes(new Date(key + "T00:00:00").getDay()));
export const missedOn = (v, t, now = new Date(), dow) => { const key = ymd(now); return runsOn(key, dow) && !!(v && v.at) && !ranOn(v, key) && hmOf(now) >= addMin(t, MISS_AFTER); };
export const adsAsideVer = (D) => (((D && D.settings) || []).find((x) => x && (x.id || x._doc) === "adsAside") || {}).ver || "";   // 광고 Aside 예약 글 넣은 판 (settings/adsAside)

// ── 멈춤 감시 (2026-10-17 사장님 고름 · 볼트 세션 점검: AI 승인 '확인할 것'에 나이 조건이 없음 · 쉬는 AI 4건 72~96시간째 · 여름 2건 최종까지 42시간
//    · 담당 미정 보드는 안 돌아도 아무에게도 안 감 · 아침 루틴은 감지 없음(10/16 GitHub 막힘 → 다음 날 00:09 에야 올라감)) ──
//   ① 승인 대기: 그 사람 차례가 된 날(쉬는 날·18시 뒤에 들어온 건 다음 평일) 다음 날부터 평일 LATE_WD(1)일 = 그 줄 빨강 '평일 n일째' + 위로(ord)
//      · ESC_WD(2)일 = 그 사람 상급자에게 '승인 밀림'(사람마다) + 관리자에게 한 줄로 모아 (askInbox)
//   ② AI 가 고치는 중(back): 보낸 뒤 일하는 시간(평일 09~18시) BACK_MIN(4시간 = 반나절) = 담당에게 'AI 고치는 중' (askInbox)
//   ③ 같은 AI·보드·할 일(·상품·브랜드)의 담당 단계 대기 = 가장 새 결과 줄 하나 + '이전 결과 n건' → 승인 한 장 [이전 결과 정리](안 함 · PREV_DROP · 사람이 누름)
//      · 맡긴 일(R)·아침 루틴 노트(보드 없음)는 날마다 다른 글이라 안 묶음
//   ④ AI 안 돎 (asideInbox): 담당 미정 크루가 안 올려도 관리자에게 · 평일 MISS_ESC(2)일 넘게 안 올린 보드는 관리자에게 · 아침 루틴이 09:30 까지 안 올라오면 여름 담당·관리자에게
export const LATE_WD = 1, ESC_WD = 2, BACK_MIN = 240, MISS_ESC = 2, WORK_FROM = "09:00", WORK_TO = "18:00", ROUTINE_AT = "06:50", ROUTINE_CHECK = "09:30";
export const ORD_LATE = 1.15;   // 늦은 AI 승인 줄 = 보통 AI 승인(1.2) 위 (model.todayView 정렬 · ord)
export const PREV_DROP = "새 결과가 와서 지난 결과로 정리";
// 그 사람 차례가 된 때 — 승인·돌려보냄·다시 올림·담당 바뀜이 모두 updatedAt 을 새로 씀 (흔적·댓글은 안 씀)
export const waitFrom = (a) => (a && (a.updatedAt || a.createdAt)) || "";
// 차례가 시작된 날: 쉬는 날·퇴근(18시) 뒤에 들어온 건 다음 평일부터
const dayFrom = (iso) => { const d = new Date(iso); if (!iso || isNaN(d)) return ""; const k = ymd(d); return isOffDay(k) || hmOf(d) >= WORK_TO ? nextWorkday(addDays(k, 1)) : k; };
// 기다린 평일 수 (차례가 시작된 날 다음 날부터 오늘까지 · 쉬는 날 빼고) — 0 = 오늘 들어옴
export const waitWd = (a, now = new Date()) => { const k = dayFrom(waitFrom(a)); return k ? wdBetween(k, ymd(now)) : 0; };
// 일하는 시간(평일 09~18시)으로 몇 분 지났나 — 밤·주말·공휴일은 안 셈
export function workMin(fromIso, now = new Date()) {
  const f = new Date(fromIso); if (!fromIso || isNaN(f) || now <= f) return 0;
  let n = 0;
  for (let k = ymd(f), i = 0; k <= ymd(now) && i < 62; k = addDays(k, 1), i++) { if (isOffDay(k)) continue;
    const s = Math.max(+new Date(`${k}T${WORK_FROM}:00`), +f), e = Math.min(+new Date(`${k}T${WORK_TO}:00`), +now); if (e > s) n += (e - s) / 6e4; }
  return Math.round(n);
}
// 결과가 올라온 때 (처음 올림 · AI 가 고쳐 다시 올림 — 돌려보냄·담당 바뀜은 아님)
export const resultAt = (a) => { const ls = ((a && a.log) || []).filter((l) => l && (l.act === "ask" || l.act === "redo")).map((l) => String(l.at || "")).sort(); return ls.pop() || String((a && a.createdAt) || ""); };
// 같은 할 일 열쇠 (보드 할 일 · 맡긴 일(R)·아침 루틴 노트는 날마다 다른 글이라 없음) · prevKey = 그중 담당 단계 대기만 (묶음·정리 대상)
const actKey = (a) => (a && a.board && a.act && a.act !== "R" ? [a.mate, a.board, a.act, a.prod || "", a.brand || ""].join("|") : "");
const prevKey = (a) => (a && a.state === "wait" && !(a.step > 0) && !a.ret ? actKey(a) : "");   // 상급자가 돌려보낸 것(수정 요청)은 안 묶음 · 따로 보임
// 대기 목록 → heads(줄로 보일 것 = 할 일마다 가장 새 결과 · 안 묶는 것은 모두) · older(가장 새 것 id → 지난 결과들 · 최근 것 먼저)
export function waitHeads(list) {
  const g = new Map(), heads = new Set(), older = new Map();
  (list || []).forEach((a) => { const k = prevKey(a); if (!k) { heads.add(a.id); return; } if (!g.has(k)) g.set(k, []); g.get(k).push(a); });
  g.forEach((xs) => { const s = xs.slice().sort((p, q) => resultAt(q).localeCompare(resultAt(p)) || String(q.id).localeCompare(String(p.id))); heads.add(s[0].id); if (s.length > 1) older.set(s[0].id, s.slice(1)); });
  return { heads, older };
}
// 승인 한 장: 같은 할 일의 지난 결과(이것보다 먼저 올라와 아직 담당 단계 대기 · 최근 것 먼저) / 더 새 결과(상태 상관없이 가장 새것 — 위로 올라갔거나 끝난 것도)
export const prevWaits = (asks, a) => { const k = actKey(a), t = resultAt(a); return k ? (asks || []).filter((x) => x && x.id !== a.id && prevKey(x) === k && resultAt(x) < t).sort((p, q) => resultAt(q).localeCompare(resultAt(p))) : []; };
export const newerOf = (asks, a) => { const k = actKey(a), t = resultAt(a); return k ? (asks || []).filter((x) => x && x.id !== a.id && actKey(x) === k && resultAt(x) > t).sort((p, q) => resultAt(q).localeCompare(resultAt(p)))[0] || null : null; };
// Aside 안 올린 평일 수 — 마지막으로 올린 날 다음 날~어제(평일) + 오늘(예약 + 90분 지났는데 아직이면) · 한 번도 안 올렸으면 0(세팅 안내 몫) · 쉬는 날엔 0(안 알림)
//   dow = 도는 요일만 셈 (주 1~2회 보드 · 2026-10-17)
export const missDays = (v, t, now = new Date(), dow) => { const key = ymd(now); if (!v || !v.at || isOffDay(key)) return 0; const last = ymd(new Date(v.at)), y = addDays(key, -1);
  let n = 0; if (y > last) { if (!Array.isArray(dow) || !dow.length) n = wdBetween(last, y); else for (let k = addDays(last, 1), i = 0; k <= y && i < 92; k = addDays(k, 1), i++) if (runsOn(k, dow)) n++; }
  return n + (missedOn(v, t, now, dow) ? 1 : 0); };
// 오늘 전 마지막 평일 (안 돎 제목 '지난 평일(10/16)')
const prevWd = (key) => { let k = addDays(key, -1); for (let i = 0; i < 14 && isOffDay(k); i++) k = addDays(k, -1); return k; };
const mdK = (k) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;
// 줄 시각: 오늘 못 올린 것 = 오늘 예약 시각 · 지난 평일부터 = 마지막으로 올린 때 ('3일 전')
const missAt = (v, t, n, now, dow) => (n === 1 && missedOn(v, t, now, dow) ? `${ymd(now)}T${t}:00` : (v && v.at) || `${ymd(now)}T${t}:00`);
const missTitle = (name, n, today, key, weekly) => (n === 1 ? (today ? `오늘 ${name}(AI)가 아직 안 올렸어요` : weekly ? `${name}(AI)가 지난번 돌 날에 안 올렸어요` : `${name}(AI)가 지난 평일(${mdK(prevWd(key))})에 안 올렸어요`) : weekly ? `${name}(AI)가 ${n}번째 안 올렸어요` : `${name}(AI)가 평일 ${n}일째 안 올렸어요`);
const dowOf = (r) => (r && r.board && r.board.run && r.board.run.dow) || null, weeklyOf = (r) => { const d = dowOf(r); return !!d && d.length < 5; };
// 아침 루틴(Claude 예약 작업 · crew 크루 팀원 routine = 여름 · 평일 06:50) — 그날 올라온 노트 승인 (05시 뒤에 만든 것 · 자정 넘어 늦게 올라온 전날 몫은 빼고)
export const routineRanOn = (a, mid, key) => !!a && (a.mate === mid || GONE[a.mate] === mid) && a.src === "tool" && !a.board && !!a.createdAt && ymd(new Date(a.createdAt)) === key && hmOf(new Date(a.createdAt)) >= "05:00";
// 오늘 아침 루틴이 안 올라온 AI (평일 · 09:30 지남) → [{mate, name, owner}] · aimates.{AI}.routineOff = true 면 안 봄(사장님이 루틴을 멈췄을 때)
export function routineMisses(D, now = new Date()) {
  const key = ymd(now); if (isOffDay(key) || hmOf(now) < ROUTINE_CHECK || !D || !D.ai || !D.ai.ready) return [];
  const asks = D.ai.asks || [], mates = D.ai.mates || {};
  return CREWS.flatMap((c) => c.members).filter((m) => m.routine && !(mates[m.id] || {}).routineOff && !asks.some((a) => routineRanOn(a, m.id, key)))
    .map((m) => ({ mate: m.id, name: m.name, owner: mateOwner(mates[m.id], "", D.users) }));
}
// 사장님께 보낼 글 — 아침 루틴·'고칠 것 확인'은 사장님 Claude 예약 작업이라 팀원은 알리기만
const DOW_L = ["일", "월", "화", "수", "목", "금", "토"], mdw = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DOW_L[d.getDay()]})`;
export const routineAlert = (name, now = new Date()) => `[업무OS] ${name}(AI) 아침 루틴이 오늘 ${mdw(now)} ${ROUTINE_CHECK}까지 안 올라왔어요 · Claude 예약 작업 'AI 콘텐츠 아침 (${name} · B2C 크루)' 확인 부탁드려요`;
export const stuckAlert = (a, now = new Date()) => `[업무OS] ${a.mateName || "AI"}(AI)에게 다시 보낸 '${a.title}' — 일하는 시간 ${Math.floor(workMin((a.back && a.back.at) || a.updatedAt, now) / 60)}시간째 그대로예요 · Claude 예약 작업 'AI 크루 고칠 것 확인' 확인 부탁드려요`;

// seen = 읽음 (오늘 하루만 띄우는 줄: 관리자 '평일 2일 넘게 안 돎' · '아침 루틴 안 올라옴')
export function asideInbox(D, uid, now = new Date(), seen = {}) {
  const me = actU(D.users, uid); if (!me || !D.ai || !D.ai.ready) return [];
  const plan = asidePlanOf(D), bv = D.ai.boards || {}, key = ymd(now), out = [], master = isMaster(me);
  const nm = (b) => (mateOf(b.mate) || {}).name || b.mate;
  const g = plan.find((x) => x.owner === uid);
  if (g) {
    const fresh = g.runs.filter((r) => !(bv[r.board.id] || {}).at);
    if (fresh.length) out.push({ kind: "aiSetup", tag: "AI 크루 세팅", id: `as:${uid}:${fresh.map((r) => r.board.id).join(",")}`, whoName: "AI 크루", at: key + "T00:00:00", keep: true,
      title: `내 PC Aside 세팅 · ${g.runs.map((r) => `${nm(r.board)} ${r.t}`).join(" · ")}`,
      text: `처음 한 번 · 예약 ${g.runs.length}개 · 로그인 ${loginSites(g.runs.map((r) => r.board)).length + 1}곳 · 세팅하면 평일마다 내 PC 에서 돌아요` });
    // 안 돎: 오늘(예약 + 90분) 또는 지난 평일에 못 올림 (2026-10-17 · 예전엔 그날만 → 다음 날 아침엔 안 보였음)
    g.runs.forEach((r) => { const dw = dowOf(r), n = missDays(bv[r.board.id], r.t, now, dw); if (!n) return;
      out.push({ kind: "aiMiss", tag: "Aside 안 돎", red: true, id: `am:${r.board.id}:${key}`, board: r.board.id, owner: uid, whoName: `${nm(r.board)} (AI)`, at: missAt(bv[r.board.id], r.t, n, now, dw), keep: true,
        title: missTitle(nm(r.board), n, missedOn(bv[r.board.id], r.t, now, dw), key, weeklyOf(r)), text: `${runWord({ ...r.board.run, t: r.t })} 예약 · PC·Aside 가 켜져 있는지 확인 · [지금 돌리기]로 바로` }); });
  }
  if (master) { const un = plan.find((x) => !x.owner);
    if (un) out.push({ kind: "aiOwnerless", tag: "AI 크루 담당", id: `ao:${un.runs.map((r) => r.board.id).join(",")}`, whoName: "AI 크루", at: key + "T00:00:00", keep: true,
      title: `AI 크루 담당 미정 ${un.runs.length}명`, text: `${un.runs.map((r) => nm(r.board)).join(" · ")} · 담당을 정하면 그 사람 PC 에서 돌고 세팅 안내가 가요` });
    // 담당 미정 크루(관리자 PC 에서 돌던 것)도 안 돎 → 관리자 누구나 한 줄 (멈춤 감시 ④ · 예전엔 아무에게도 안 감)
    const um = un ? un.runs.map((r) => ({ r, n: missDays(bv[r.board.id], r.t, now, dowOf(r)) })).filter((x) => x.n > 0) : [];
    if (um.length) out.push({ kind: "aiMiss", tag: "Aside 안 돎", red: true, id: `amu:${um.map((x) => x.r.board.id).join(",")}:${key}`, board: um[0].r.board.id, owner: "", whoName: "AI 크루 (담당 미정)", at: missAt(bv[um[0].r.board.id], um[0].r.t, um[0].n, now, dowOf(um[0].r)), keep: true,
      title: um.length > 1 ? `담당 미정 크루 ${um.length}명이 안 올렸어요` : missTitle(nm(um[0].r.board), um[0].n, missedOn(bv[um[0].r.board.id], um[0].r.t, now, dowOf(um[0].r)), key, weeklyOf(um[0].r)),
      text: `${um.map((x) => `${nm(x.r.board)}${x.n > 1 ? ` ${x.n}일째` : ""}`).join(" · ")} · 관리자 PC Aside 확인 · 담당을 정하면 그 사람에게 알려요` });
    // 평일 MISS_ESC(2)일 넘게 안 올린 보드(담당 있음 · 내 것 빼고) → 관리자 누구나 한 줄 · 읽음 = 오늘 하루
    const lg = plan.filter((x) => x.owner && x.owner !== uid).flatMap((x) => x.runs.map((r) => ({ owner: x.owner, r, n: missDays(bv[r.board.id], r.t, now, dowOf(r)) }))).filter((x) => x.n >= MISS_ESC);
    const lid = `aml:${lg.map((x) => x.r.board.id).join(",")}:${key}`;
    if (lg.length && !seen[lid]) out.push({ kind: "aiMissLong", tag: "Aside 안 돎", red: true, id: lid, board: lg[0].r.board.id, owner: lg[0].owner, whoName: "AI 크루", at: (bv[lg[0].r.board.id] || {}).at,
      title: `Aside 평일 ${MISS_ESC}일 넘게 안 돎 · ${lg.length}명`, text: `${lg.map((x) => `${nm(x.r.board)}(${nameOf(D.users, x.owner) || "?"} PC) ${x.n}일째`).join(" · ")} · 그 PC·Aside 를 확인해 주세요` }); }
  // 아침 루틴(Claude 예약 작업)이 09:30 까지 안 올라옴 → 그 AI 담당·관리자 · 읽음 = 오늘 하루 (멈춤 감시 ④)
  routineMisses(D, now).forEach((x) => { if (x.owner !== uid && !master) return; const id = `amr:${x.mate}:${key}`; if (seen[id]) return;
    out.push({ kind: "aiRoutine", tag: "AI 안 돎", red: true, id, mate: x.mate, whoName: `${x.name} (AI)`, at: `${key}T${ROUTINE_AT}:00`,
      title: `오늘 ${x.name}(AI) 아침 루틴이 아직 안 올라왔어요`, text: `평일 ${ROUTINE_AT} 블로그 원고·재배포 · Claude 예약 작업이 막혔을 수 있어요 · 누르면 사장님께 보낼 글` }); });
  // 광고 Aside 예약 글 (2026-10-17 사장님 "어사이드에게 예약글 넣어서 진행하는거 까먹을것같은데 os 확인할것에 나오게해줘")
  //   settings/adsAside.ver 가 지금 예약 글 판(adops.ASIDE_ADS_LAUNCH_VER)보다 옛것이면 관리자 누구나 한 줄(keep) · 누르면 광고 운영 화면 · [넣었어요] = core.adsAsideDone
  if (isMaster(me) && String(adsAsideVer(D)) < ASIDE_ADS_LAUNCH_VER)
    out.push({ kind: "adsAside", tag: "Aside 광고", id: `aa:${ASIDE_ADS_LAUNCH_VER}`, whoName: "광고 운영", at: ASIDE_ADS_LAUNCH_VER + "T00:00:00", keep: true,
      title: "새 예약 글 넣기 · 예약 2개", text: "누르면 광고 운영 → 맨 위 [예약 글 복사] → Aside '매일 08:30' · '금 16:00' 예약 글을 통째로 바꾸고 [넣었어요] · 한 번만 하면 지시문이 바뀌어도 그대로" });
  return out;
}

// 쉬는 AI(crew.GONE)가 올린 담당 미정 승인 대기 — AI 팀원 화면에서 관리자가 정리 ('확인할 것'엔 안 뜸 · askInbox)
export const goneWaits = (asks) => (asks || []).filter((a) => a && a.state === "wait" && !a.to && GONE[a.mate]).sort((p, q) => String(q.createdAt || "").localeCompare(String(p.createdAt || "")));
export const GONE_DROP = "쉬는 AI · 같은 일은 B2C 크루 여름이 매일 새로 올려요";
// 지금 내 차례 승인 수 (더보기 'AI 팀원' 꼬리표 · AI 팀원 화면) — 쉬는 AI 담당 미정은 뺌 (askInbox 와 같게)
//   같은 할 일의 지난 결과는 가장 새 결과 하나로 셈 ('확인할 것'과 같게 · 2026-10-17 멈춤 감시)
export const myTurnN = (asks, cu) => waitHeads((asks || []).filter((x) => x && x.id && x.state === "wait" && !(!x.to && GONE[x.mate]) && (x.to === cu.id || (!x.to && isMaster(cu))))).heads.size;
// AI 팀원 한 명이 지금 어디서 일하나 (화면 머리)
export const mateWhere = (mateId) => { const c = crewOf(mateId); return c ? c.name : "기본 AI 팀원 (원형)"; };
