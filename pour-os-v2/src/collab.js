// 업무OS v2 — 협업 맵 계산 (관리자 '협업 맵' 탭 · 사용자 확정 2026-10-05~06 · 시안 mockups/step12-collab-map.png)
// 저장하지 않음 — 이미 불러온 D(업무·댓글·프로젝트·사람)만 읽어서 '두 사람이 같이 한 것'을 셈
// 6가지(한 짝 = 두 사람, 순서 없음 · 나와 나는 안 셈 · 사용 안 하는 사람 뺌):
//   co   같이 맡음      = 한 업무에 담당이 여럿 (업무마다 1번 · 고정업무는 '전체' 아닌 것만)
//   req  맡김          = 맡긴 사람(requestedBy · assignedBy) → 담당 (업무마다 1번)
//   hand 이어받음       = 앞 일 담당 → 다음 일 담당 (turn.js 앞 일: deps · 신제품 순서표 · 하위 업무) + 담당 넘기기 t.handoff
//   ask  확인·도움 요청 = 확인 받기(reviewTo) · 도와주세요(ask.to) · 기한 조정(dueReq.to) · 막힘(blocked.to) — 요청마다 1번
//   talk 같은 업무 대화 = 같은 업무에 둘 다 댓글(또는 @ 부름) — 업무마다 짝마다 1번
//   proj 같은 프로젝트  = 열린 프로젝트에 둘 다(책임자 · 함께 하는 사람 · 그 안 업무 담당) — 프로젝트마다 1번(가볍게)
// 기간: 최근 n일(기본 30). 업무는 '그 기간에 살아 있던 것'(열려 있거나 그 기간에 끝냄)만 · 요청·넘기기·댓글은 그 일이 일어난 때로
// 앱은 끝낸 업무·댓글을 최근 30일 것만 불러오므로 30일보다 길게 보면 그 앞은 빠짐(partial) — 화면에 안내
// 임시 담당(책임자로 채운 신제품 항목)은 진짜 담당이 아니라 뺌 · 기밀은 secret.js 기준(관리자는 다 봄)
import { ownersOf, isDone, projOpen, teamOf, TEAMS, activeUsers } from "./model.js";
import { turnIndex, finishedAt } from "./turn.js";
import { taskSeen, projSeen, seeAll, secretOn } from "./secret.js";

export const KINDS = [["co", "같이 맡음"], ["req", "맡김"], ["hand", "이어받음"], ["ask", "확인·도움 요청"], ["talk", "같은 업무 대화"], ["proj", "같은 프로젝트"]];
export const KIND_L = Object.fromEntries(KINDS);
export const LOADED_DAYS = 30;
// 무게: 같은 프로젝트는 가볍게(3개 = 1건) — 나머지는 1건 = 1. 화면 숫자 n = 무게 합(반올림) · 종류별 칸은 그대로 센 수
export const WEIGHT = { co: 1, req: 1, hand: 1, ask: 1, talk: 1, proj: 1 / 3 };   // core.useData: 끝낸 업무·댓글 30일
const OPEN = new Set(["todo", "inprogress", "hold", "review"]);
const ASK_L = { review: "확인 받기", ask: "도와주세요", dueReq: "기한 조정", blocked: "막힘" };

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const iso = (x) => String(x || "");

// 이 업무가 기간 안에 살아 있었나 (열림 · 그 기간에 끝냄)
function aliveIn(t, since) {
  if (!t || t.deleted || t.status === "dropped") return false;
  if (OPEN.has(t.status)) return true;
  if (isDone(t)) { const f = iso(finishedAt(t) || t.doneAt); return !!f && f >= since; }
  return false;
}
const lastAt = (t) => iso(finishedAt(t) || t.updatedAt || t.v2At || t.createdAt);

// D → { people, pairs, since, partial }
//  opt: days(7·30·90) · now · viewer(기밀 기준 · 없으면 모두) · idx(turnIndex · 없으면 만듦) · kinds(셀 종류 Set · 없으면 6가지 모두)
export function collabOf(D, opt = {}) {
  const days = opt.days || 30, now = opt.now || new Date();
  const since = new Date(now.getTime() - days * 864e5).toISOString();
  const kinds = opt.kinds ? new Set(opt.kinds) : null, want = (k) => !kinds || kinds.has(k);
  const users = activeUsers(D.users || []).filter((u) => u && u.id);
  const act = new Map(users.map((u) => [u.id, u]));
  const idx = opt.idx || turnIndex(D), temp = idx.temp || new Set();
  const viewer = opt.viewer || null, all = seeAll(viewer);
  const pm = new Map((D.projects || []).map((p) => [p.id, p]));
  const tasks = D.tasks || [];
  const seenT = (t) => all || taskSeen(t, pm.get(t.projectId) || null, viewer.id, tasks);
  const seenP = (p) => all || projSeen(p, viewer.id, tasks);
  const pairs = new Map(), once = new Set();
  // 한 건 더하기 (dedupe = 같은 일을 두 번 안 셈)
  const add = (a, b, kind, item, dedupe) => {
    if (!a || !b || a === b || !act.has(a) || !act.has(b) || !want(kind)) return;
    const k = pairKey(a, b), d = `${k}#${kind}#${dedupe}`;
    if (once.has(d)) return; once.add(d);
    let P = pairs.get(k);
    if (!P) { const [x, y] = k.split("|"); P = { key: k, a: x, b: y, total: 0, score: 0, by: {}, items: [] }; pairs.set(k, P); }
    P.total++; P.score += WEIGHT[kind]; P.by[kind] = (P.by[kind] || 0) + 1; P.items.push({ kind, ...item });
  };
  const tItem = (t, extra) => ({ taskId: t.id, projectId: t.projectId || "", title: t.title || "", secret: secretOn(t) || secretOn(pm.get(t.projectId)), ...extra });

  tasks.forEach((t) => {
    if (!t || t.deleted || !seenT(t)) return;
    const alive = aliveIn(t, since), own = ownersOf(t).filter((u) => act.has(u));
    // 같이 맡음
    if (alive && !temp.has(t.id) && !(t.isFixed && (t.forAll || t.paused)) && own.length > 1)
      own.forEach((a, i) => own.slice(i + 1).forEach((b) => add(a, b, "co", tItem(t, { at: lastAt(t), fixed: !!t.isFixed }), t.id)));
    if (t.isFixed) return;
    // 맡김
    if (alive && !temp.has(t.id)) [t.requestedBy, t.assignedBy].filter(Boolean).forEach((r) => own.forEach((o) => add(r, o, "req", tItem(t, { at: iso(t.requestedAt || t.assignedAt || t.createdAt), from: r, to: o }), t.id)));
    // 이어받음: 앞 일 담당 → 이 일 담당 — 앞 일이 기간 안에 끝나서 실제로 넘어온 것만 (아직 안 끝난 먼 단계는 안 셈)
    if (alive && !temp.has(t.id)) (idx.preds.get(t.id) || []).forEach((p) => {
      if (temp.has(p.id) || p.deleted || !seenT(p) || !(isDone(p) || p.status === "review")) return;
      const f = iso(finishedAt(p) || p.doneAt); if (!f || f < since) return;
      ownersOf(p).forEach((a) => own.forEach((b) => add(a, b, "hand", tItem(t, { at: f, from: a, to: b, prevTitle: p.title || "" }), p.id + ">" + t.id)));
    });
    // 담당 넘기기
    const h = t.handoff;
    if (h && h.from && h.to && iso(h.at) >= since) add(h.from, h.to, "hand", tItem(t, { at: iso(h.at), from: h.from, to: h.to, handoff: true }), "h:" + t.id + ":" + iso(h.at));
    // 확인·도움 요청
    const rAt = iso(t.reviewAt || (t.status === "review" ? finishedAt(t) || lastAt(t) : ""));
    if (t.reviewTo && rAt && rAt >= since) own.forEach((o) => add(o, t.reviewTo, "ask", tItem(t, { at: rAt, from: o, to: t.reviewTo, sub: ASK_L.review }), "review:" + t.id));
    ["ask", "dueReq", "blocked"].forEach((f) => {
      const x = t[f]; if (!x || !x.to || iso(x.at) < since) return;
      const by = x.by || own[0];
      add(by, x.to, "ask", tItem(t, { at: iso(x.at), from: by, to: x.to, sub: ASK_L[f] }), f + ":" + t.id + ":" + iso(x.at));
    });
  });

  // 같은 업무 대화: 업무마다 말한 사람(+ @ 부른 사람)
  if (want("talk")) {
    const tm = new Map(tasks.map((t) => [t.id, t])), by = new Map();
    (D.notes || []).forEach((n) => {
      if (!n || n.deleted || iso(n.at) < since) return;
      const s = String(n.itemId || ""); if (!s.startsWith("task:")) return;
      const tid = s.slice(5), t = tm.get(tid); if (t && !seenT(t)) return;
      const g = by.get(tid) || { ids: new Set(), at: "", title: (t && t.title) || n.itemName || "", t };
      if (n.by) g.ids.add(n.by); (n.mentions || []).forEach((m) => g.ids.add(m));
      if (iso(n.at) > g.at) g.at = iso(n.at);
      by.set(tid, g);
    });
    by.forEach((g, tid) => { const ids = [...g.ids].filter((u) => act.has(u));
      ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => add(a, b, "talk", g.t ? tItem(g.t, { at: g.at }) : { taskId: tid, projectId: "", title: g.title, at: g.at }, tid))); });
  }

  // 같은 프로젝트: 열린 프로젝트마다 1번
  if (want("proj")) (D.projects || []).forEach((p) => {
    if (!p || p.deleted || !projOpen(p) || !seenP(p)) return;
    const ids = new Set([p.assigneeId, ...(p.collaboratorIds || [])].filter(Boolean));
    tasks.forEach((t) => { if (t.projectId === p.id && !t.isFixed && !temp.has(t.id) && aliveIn(t, since)) ownersOf(t).forEach((u) => ids.add(u)); });
    const a = [...ids].filter((u) => act.has(u));
    a.forEach((x, i) => a.slice(i + 1).forEach((y) => add(x, y, "proj", { projectId: p.id, title: p.title || "", secret: secretOn(p), at: iso(p.updatedAt || p.v2At || p.createdAt) }, p.id)));
  });

  const list = [...pairs.values()].map((P) => ({ ...P, n: Math.round(P.score), items: P.items.sort((x, y) => iso(y.at).localeCompare(iso(x.at))) }))
    .sort((x, y) => y.score - x.score || y.total - x.total || x.key.localeCompare(y.key));
  const people = users.map((u) => {
    const mine = list.filter((P) => P.a === u.id || P.b === u.id), by = {};
    mine.forEach((P) => Object.entries(P.by).forEach(([k, n]) => { by[k] = (by[k] || 0) + n; }));
    const score = mine.reduce((s, P) => s + P.score, 0);
    return { id: u.id, name: u.name || "", team: teamOf(u) || "", total: mine.reduce((s, P) => s + P.total, 0), score, n: Math.round(score), partners: mine.length, by };
  });
  return { people, pairs: list, since, days, partial: days > LOADED_DAYS };
}

// 한 사람의 짝들 (많은 순) — 상대 id · 이름 · 합 · 종류별 · 최근 항목
export function partnersOf(C, uid) {
  const nm = new Map(C.people.map((p) => [p.id, p]));
  return C.pairs.filter((P) => P.a === uid || P.b === uid).map((P) => { const o = P.a === uid ? P.b : P.a; return { id: o, name: (nm.get(o) || {}).name || "", team: (nm.get(o) || {}).team || "", total: P.total, score: P.score, n: P.n, by: P.by, items: P.items }; });
}
// 종류별 숫자를 무게 많은 순으로 [[kind, n]]
export const kindsSorted = (by) => KINDS.map(([k]) => [k, (by || {})[k] || 0]).filter((x) => x[1] > 0).sort((a, b) => b[1] * WEIGHT[b[0]] - a[1] * WEIGHT[a[0]] || b[1] - a[1]);   // 무게 순 (같은 프로젝트는 가볍게)
// 혼자 일이 많은 사람: 열린 내 일(고정 빼고)이 minOpen 개 이상인데 협업이 가장 적은 사람 (적은 순 n명)
export function loners(C, D, n = 2, minOpen = 5) {
  const open = new Map(); (D.tasks || []).forEach((t) => { if (!t.isFixed && !t.deleted && OPEN.has(t.status)) ownersOf(t).forEach((u) => open.set(u, (open.get(u) || 0) + 1)); });
  const tot = C.people.map((p) => p.score).sort((a, b) => a - b), med = tot.length ? tot[Math.floor(tot.length / 2)] : 0;
  return C.people.filter((p) => (open.get(p.id) || 0) >= minOpen && p.score < med).sort((a, b) => a.score - b.score || (open.get(b.id) || 0) - (open.get(a.id) || 0)).slice(0, n).map((p) => ({ ...p, open: open.get(p.id) || 0 }));
}
// 팀 순서(1팀 · 2팀 · 3팀 · 공용 · 팀 없음) → 이름 — 원 둘레 자리(늘 같은 자리)
export function teamOrder(people) {
  const ti = (t) => { const i = TEAMS.indexOf(t); return i < 0 ? 99 : i; };
  return people.slice().sort((a, b) => ti(a.team) - ti(b.team) || String(a.name).localeCompare(String(b.name), "ko") || a.id.localeCompare(b.id));
}
// 원 둘레 자리: 팀 사이에 빈 칸 하나 (위 가운데부터 시계 방향) → [{id, x, y}]
export function circleLayout(people, cx, cy, r) {
  const ord = teamOrder(people); if (!ord.length) return [];
  const slots = []; ord.forEach((p, i) => { if (i && ord[i - 1].team !== p.team && ord.length > 3) slots.push(null); slots.push(p); });
  const n = slots.length;
  return slots.map((p, i) => (p ? { id: p.id, x: cx + r * Math.sin((2 * Math.PI * i) / n), y: cy - r * Math.cos((2 * Math.PI * i) / n) } : null)).filter(Boolean);
}
// 짧은 이름 (원 안 글자): 세 글자 한국 이름 → 뒤 두 글자
export const shortName = (s) => { const x = String(s || "").trim(); return /^[가-힣]{3}$/.test(x) ? x.slice(1) : x.slice(0, 4); };
// SVG 글자 폭 어림 · 자르기 = svgpng.js (협업 맵 · 마인드맵 공용)
export { textW, clip } from "./svgpng.js";
