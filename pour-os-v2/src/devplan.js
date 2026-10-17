// 업무OS v2 — 월 1회 자동 개발 (사용자 확정 2026-10-17 · 계산만 · 화면 devreq.jsx DevPlanSheet · 저장 core.devPlanConfirm · 개발 쪽 tools/devreqs.py · 시험 devplan.test.mjs)
//   사장님 "업무 os 개발은 앞으로 1개월에 한번씩 포스팃 확인해서 자동으로 주말에 알아서 개발하길 바래. 단, 김송희에게 리스트업 알려줘서 확인받고 해야해" → 확정 5A 6A 7A 8A 9A
//   5A 그 달 마지막 월요일 09:00 = 열린 포스트잇이 목록이 됨 → 그 주 토·일 개발 (예약 작업 = 토·일 아침 새 세션 · tools/devreqs.py today 가 개발 날이 아니면 아무것도 안 함)
//   6A 확인하는 사람(기본 김송희 · 관리자 설정 settings/devplan.reviewerId) '확인할 것' '이달 개발 목록 n개' → 포스트잇마다 [이번에]·[다음 달]·[안 함] + 한 줄 → [확인]
//   7A 금요일까지 확인이 없으면 그 달 개발은 쉼 · 목요일부터 빨강(한 번 더 알림) · 포스트잇은 열린 채 다음 달 목록에 그대로
//   8A 주말 범위 = [이번에] 고른 것 중 화면·버튼·문구·버그 · 흐름을 바꾸는 큰 것은 정리표로 사장님께(devreqs.py later = 열린 채 다음 달 목록에) · 로그인·보안 규칙·실데이터 일괄 변경은 주말 자동으로 안 함
//   9A 끝나면 포스트잇 '반영함 ✓ · 답'(devreqs.py done) + 요청한 사람 '확인할 것' 한 줄 + 확인한 사람·관리자 '이달 개발 끝' 한 줄 + 사장님께 요약(예약 작업 알림)
//   저장 pour-os/v2/devplans/{YYYY-MM} {id, ym, monday, due, devDays[토, 일], items[{id, text, byName, at, files, pick 'now'|'later'|'no', note}], state 'ok', confirmedBy·ByName·At, updatedAt,
//     devStartedAt?, devLater? {포스트잇 id: 까닭}, devDone? {at, summary, done[], later[{id, why}]}} · '안 함' = 그 포스트잇 state 'no' + noReason·noAt·noBy (지우지 않음)
//   날짜는 기기 날짜(한국) — devreqs.py 는 한국 시각으로 같은 계산
import { ymd, addDays, md, isMaster } from "./model.js";

export const DEV_REVIEWER_DEFAULT = "김송희";
export const DEV_PICKS = [["now", "이번에"], ["later", "다음 달"], ["no", "안 함"]];
export const DEV_PICK_L = Object.fromEntries(DEV_PICKS);
export const DEV_OPEN_HM = "09:00", DEV_NOTE_MAX = 200;
const DAY = 864e5;
const p2 = (n) => String(n).padStart(2, "0");
const hmOf = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const ymOf = (key) => String(key || "").slice(0, 7);
export const prevYm = (ym) => { const [y, m] = String(ym).split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${p2(m - 1)}`; };
export const nextYm = (ym) => { const [y, m] = String(ym).split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${p2(m + 1)}`; };
export const ymLabel = (ym) => `${Number(String(ym).slice(5, 7))}월`;
// 그 달 마지막 월요일 · 목록 → 목요일(빨강) → 금요일(확인 마감) → 토·일(개발)
export function lastMonday(ym) { const [y, m] = String(ym).split("-").map(Number); const d = new Date(y, m, 0); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return ymd(d); }
export function planWindow(ym) { const monday = lastMonday(ym); return { ym, monday, thu: addDays(monday, 3), due: addDays(monday, 4), devDays: [addDays(monday, 5), addDays(monday, 6)] }; }
// 지금 어느 달 계획인가 — 이번 달·지난달 중 '목록(월 09:00) ~ 개발 마지막 날(일)' 안 → open · 아니면 다음 목록(이번 달 · 지났으면 다음 달)
export function planNow(now = new Date()) {
  const key = ymd(now), h = hmOf(now), ym = ymOf(key);
  for (const y of [ym, prevYm(ym)]) { const w = planWindow(y); if ((key > w.monday || (key === w.monday && h >= DEV_OPEN_HM)) && key <= w.devDays[1]) return { ...w, open: true }; }
  const w = planWindow(ym); return key <= w.monday ? { ...w, open: false } : { ...planWindow(nextYm(ym)), open: false };
}
// 단계 — wait 목록 전 · review 확인 기다림(월~수) · late 목·금(빨강) · ok 확인함(개발 전) · dev 토·일 · done 개발 끝 · missed 금요일까지 확인 없음(이번 달 쉼) · over 개발 날 지남(끝 표시 없음)
export function planStage(w, plan, now = new Date()) {
  if (plan && plan.devDone && plan.devDone.at) return "done";
  const key = ymd(now), h = hmOf(now), ok = !!plan && plan.state === "ok";
  if (key < w.monday || (key === w.monday && h < DEV_OPEN_HM)) return "wait";
  if (key <= w.due) return ok ? "ok" : key >= w.thu ? "late" : "review";
  if (!ok) return "missed";
  return key <= w.devDays[1] ? "dev" : "over";
}
export const STAGE_L = { wait: "목록 전", review: "확인 기다림", late: "확인 기다림 · 곧 마감", ok: "확인함 · 주말 개발", dev: "개발 중", done: "개발 끝", missed: "확인 없음 · 이번 달 쉼", over: "개발 날 지남" };
// 고를 수 있는 때 = 월요일 09:00 ~ 금요일 · 개발을 시작하기 전
export const canPick = (w, plan, now = new Date()) => { const st = planStage(w, plan, now); return (st === "review" || st === "late" || st === "ok") && !(plan && plan.devStartedAt); };

// 확인하는 사람 (settings/devplan.reviewerId · 사용 중인 사람) → 없으면 이름이 김송희인 사람 1명 → 둘 다 없으면 '' = 관리자 누구나
export const devPlanDoc = (D) => ((D && D.settings) || []).find((x) => x && (x.id || x._doc) === "devplan") || {};
export function devReviewer(D) {
  const us = ((D && D.users) || []).filter((u) => u && u.active !== false), id = devPlanDoc(D).reviewerId;
  if (id && us.some((u) => u.id === id)) return id;
  const d = us.filter((u) => String(u.name || "").trim() === DEV_REVIEWER_DEFAULT); return d.length === 1 ? d[0].id : "";
}
export const isDevReviewer = (D, cu) => { if (!cu) return false; const rv = devReviewer(D); return rv ? rv === cu.id : isMaster(cu); };
export const canConfirm = (D, cu) => !!cu && (isMaster(cu) || isDevReviewer(D, cu));

// 목록 = 열린 포스트잇(뗀 것 빼고) · 먼저 붙인 것 먼저
export const planItems = (reqs) => (reqs || []).filter((r) => r && r.id && !(r.removed && r.removed.at) && (r.state || "open") === "open").sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
// 구독 두 갈래(열린 것 + 최근 바뀐 것) 합치기
export function devMerge(...lists) { const m = new Map(); lists.forEach((l) => (l || []).forEach((x) => { if (x && x.id) m.set(x.id, x); })); return [...m.values()]; }
// 지난달 계획에서 [다음 달]로 미룬 것·주말에 '다음 달'로 남긴 것 → 이번 목록 꼬리표
export function carried(plans, ym) {
  const p = (plans || {})[prevYm(ym)], out = {}; if (!p) return out;
  (p.items || []).forEach((x) => { if (x && x.pick === "later") out[x.id] = x.note ? `지난달 '다음 달' · ${x.note}` : "지난달 '다음 달'"; });
  Object.entries(p.devLater || {}).forEach(([id, why]) => { out[id] = `지난달 주말에 못 함${why ? ` · ${why}` : ""}`; });
  return out;
}
// 고른 것이 다 있나 → 남은 수
export const pickLeft = (items, picks) => (items || []).filter((r) => !DEV_PICK_L[(picks || {})[r.id]]).length;
// 저장할 계획 문서 (확인) · picks {id: pick} · notes {id: 한 줄}
export function planDocOf(w, items, picks, notes, cu, now = new Date().toISOString()) {
  return { id: w.ym, ym: w.ym, monday: w.monday, due: w.due, devDays: w.devDays, state: "ok", confirmedBy: cu.id, confirmedByName: cu.name, confirmedAt: now, updatedAt: now,
    items: (items || []).map((r) => ({ id: r.id, text: String(r.text || "").slice(0, 300), byName: r.byName || "", at: r.at || "", files: (r.files || []).length, pick: picks[r.id], note: String((notes || {})[r.id] || "").replace(/\s+/g, " ").trim().slice(0, DEV_NOTE_MAX) })) };
}
export const planCount = (plan) => { const c = { now: 0, later: 0, no: 0 }; ((plan && plan.items) || []).forEach((x) => { if (c[x.pick] != null) c[x.pick]++; }); return c; };
// 한 줄 안내 (포스트잇 판 위 · 관리자 설정)
export function planLine(w, plan, st, reviewerName) {
  const rv = reviewerName || "관리자", c = planCount(plan), dd = `${md(w.devDays[0])}~${md(w.devDays[1])}`;
  if (st === "wait") return `다음 개발 목록 ${md(w.monday)}(월) 09:00 · ${md(w.due)}(금)까지 ${rv}님 확인 → ${dd} 주말 개발`;
  if (st === "review" || st === "late") return `${ymLabel(w.ym)} 개발 목록 확인 중 · ${md(w.due)}(금)까지 ${rv}님 확인 → ${dd} 주말 개발`;
  if (st === "ok") return `${ymLabel(w.ym)} 개발 확인함 · 이번에 ${c.now}개 · ${dd} 주말 개발`;
  if (st === "dev") return `${ymLabel(w.ym)} 주말 개발 중 · 이번에 ${c.now}개`;
  if (st === "done") return `${ymLabel(w.ym)} 개발 끝 · 반영 ${((plan.devDone || {}).done || []).length}개`;
  if (st === "missed") return `${ymLabel(w.ym)}은 확인이 없어 개발을 쉬어요 · 포스트잇은 다음 달 목록에 그대로`;
  return `${ymLabel(w.ym)} 개발 날이 지났어요`;
}

// '확인할 것' 줄 (model.todayView 가 D.devInbox 로 부름 · 순환 import 피하려고)
//   확인하는 사람: 목록이 서면 '이달 개발 목록 n개'(처리할 때까지 남음 · 목·금 빨강 위로) · 개발 끝(7일 · 읽으면 사라짐 · 관리자도)
//   요청한 사람: 내 포스트잇이 '반영함'·'안 함'이 되면 한 줄(7일 · 내가 바꾼 것 빼고 · 읽으면 사라짐)
export function devInbox(D, uid, now = new Date(), seen = {}) {
  const out = [], dv = D && D.dev; if (!dv) return out;
  const me = ((D && D.users) || []).find((u) => u && u.id === uid), rv = isDevReviewer(D, me), key = ymd(now), since = new Date(now.getTime() - 7 * DAY).toISOString();
  const w = planNow(now), plan = (dv.plans || {})[w.ym], st = planStage(w, plan, now), items = planItems(dv.reqs);
  if (rv && w.open && (st === "review" || st === "late") && items.length) {
    const late = st === "late";
    out.push({ kind: "devPlan", tag: "이달 개발", id: "dp:" + w.ym, ym: w.ym, title: `${ymLabel(w.ym)} 개발 목록 ${items.length}개`, at: new Date(w.monday + "T09:00:00").toISOString(),
      text: `${late ? (key === w.due ? "오늘" : "내일") : md(w.due) + "(금)"}까지 [이번에·다음 달·안 함] 골라 확인 · 없으면 이번 달 개발은 쉬어요`, keep: true, ...(late ? { red: true, ord: 1.95 } : {}) });
  }
  Object.values(dv.plans || {}).forEach((p) => { const dd = p && p.devDone; if (!dd || !dd.at || dd.at < since || !(rv || isMaster(me) || p.confirmedBy === uid)) return;
    const id = "dd:" + p.ym + ":" + dd.at; if (seen[id]) return;
    out.push({ kind: "devDone", tag: "개발 끝", id, ym: p.ym, title: `${ymLabel(p.ym)} 개발 끝 · 반영 ${(dd.done || []).length}개${(dd.later || []).length ? ` · 다음 달 ${(dd.later || []).length}개` : ""}`, whoName: "Claude(개발)", at: dd.at, text: String(dd.summary || "").slice(0, 200) }); });
  (dv.reqs || []).forEach((r) => { if (!r || !r.id || (r.removed && r.removed.at) || r.by !== uid) return;
    const t = String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 40) || "개발 수정 요청";
    if (r.state === "done" && r.doneAt && r.doneAt >= since && r.doneBy !== uid) { const id = "dq:" + r.id + ":" + r.doneAt; if (!seen[id]) out.push({ kind: "devReqRes", res: "done", tag: "반영함", id, title: t, whoName: r.doneByName || "", at: r.doneAt, text: r.reply ? `답 · ${r.reply}` : "반영했어요" }); }
    if (r.state === "no" && r.noAt && r.noAt >= since && r.noBy !== uid) { const id = "dn:" + r.id + ":" + r.noAt; if (!seen[id]) out.push({ kind: "devReqRes", res: "no", tag: "안 함", id, title: t, whoName: r.noByName || "", at: r.noAt, text: r.noReason ? `까닭 · ${r.noReason}` : "이번엔 안 하기로 했어요" }); }
  });
  return out;
}
