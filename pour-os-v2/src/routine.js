// 업무OS v2 — 반복(행동지표) +1 ↔ 신제품 항목 같이 세기 (사용자 결정 2026-10-05 · 계산만, 저장은 core)
// 설정 없음: 행동지표 이름 ↔ 신제품 '횟수 항목'(목표 n회가 있는 항목: 블로그 포스팅 3 · 숏폼 3 · 메타 광고 5 · 디맨드젠 5)을 낱말로 자동 짝
//   반복 [+1] → 내 열린 신제품 항목 중 짝이 1개면 같이 셈(한 줄 알림 · 취소) · 여러 개면 한 번 고르기 · 없으면 반복만
//   신제품 항목 [+1] → 내 행동지표 중 짝이 1개면 같이 셈 · 여러 개면 고르기 · 없으면 항목만
// 실적 저장: 버전1 pour-os/kpi-act-YYYY-Qn 은 읽기만 · v2 기록은 pour-os/v2/kpiact/{YYYY-Qn} (같은 모양 {w:{주:{항목:{n,fail,by}}}, log}) → 화면은 둘을 더해서
import { akWho, akWeekKey, akQidOfWeek, akWeeksIn, akQuarterWeeks, akMonthOfWeek, akTotal, akVal, akCountable, akOrder, akStep, akGoalText } from "../../pour-os/src/actionKpi.js";
import { targetOf, countOf, baseTitle, isTempOwner } from "./launch.js";
export { targetOf, countOf, baseTitle };
import { isMine, isDone, dueOf, ymd, addDays, COMMON_BRAND } from "./model.js";

// 낱말 묶음: 행동지표 이름(괄호 안 말은 뺌 · 체험단은 횟수 항목이 없어 뺌) → 신제품 횟수 항목
export const RT_GROUPS = [
  { k: "blog", re: /컨텐츠|콘텐츠|포스팅|블로그/, items: ["x_blog"] },
  { k: "short", re: /숏폼|릴스|숏츠|쇼츠/, items: ["x_short"] },
  { k: "ad", re: /광고/, items: ["x_meta", "x_dg"] },
];
const bare = (s) => String(s || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
export const akLaunchItems = (it) => { const n = bare(it && it.name); if (!n || /체험단/.test(n)) return [];
  return [...new Set(RT_GROUPS.filter((g) => g.re.test(n)).flatMap((g) => g.items))]; };

// 횟수 바꾸기 → 업무 칸 (제목 '(n/목표)' · 처음 세면 진행 중 · 목표 채우면 끝냄 · 목표 아래로 내려가면 다시 진행 중)
export function countFields(t, d, cu, at, abs) {
  const g = targetOf(t), n = Math.max(0, abs != null ? abs : countOf(t) + d), f = { count: n, title: `${baseTitle(t)} (${n}/${g})` }, day = ymd(new Date(at));   // 시작일 = 이 기기(한국) 날짜
  const unHold = t.status === "hold" ? { holdPrev: null, holdReason: "", holdUntil: null, holdBy: null } : {};
  if (g && n >= g && !isDone(t)) Object.assign(f, { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, finishedAt: at, feedback: null, blocked: null, ...unHold, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) });
  else if (g && n < g && isDone(t)) Object.assign(f, { status: n > 0 ? "inprogress" : "todo", doneAt: null, doneBy: null, doneByName: null, finishedAt: null });
  else if (n > 0 && ["todo", "hold"].includes(t.status || "todo")) Object.assign(f, { status: "inprogress", ...unHold, ...(t.startedAt ? {} : { startedAt: day }), ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) });
  return { n, g, fields: f };
}

// 버전1 실적 + v2 실적 더하기 (같은 모양) → actionKpi 계산을 그대로 씀
export function sumAk(...docs) {
  const out = { w: {} };
  docs.filter(Boolean).forEach((d) => Object.entries(d.w || {}).forEach(([wk, row]) => Object.entries(row || {}).forEach(([id, v]) => {
    const o = ((out.w[wk] = out.w[wk] || {})[id] = out.w[wk][id] || { n: 0, fail: 0, by: {} });
    o.n += Math.max(0, +(v && v.n) || 0); o.fail += Math.max(0, +(v && v.fail) || 0);
    Object.entries((v && v.by) || {}).forEach(([u, k]) => { o.by[u] = (o.by[u] || 0) + (+k || 0); });
  })));
  return out;
}
// 이번 기간 주 목록 (주간 = 이번 주 · 월간 = 이번 주가 속한 달 · 분기)
export function periodWeeks(it, key) {
  const wk = akWeekKey(new Date(key + "T00:00:00")), { y, m0 } = akMonthOfWeek(wk);
  if (it.cyc === "W") return akWeeksIn(y, m0).filter((w) => w.key === wk);
  return it.cyc === "Q" ? akQuarterWeeks(y, m0) : akWeeksIn(y, m0);
}
// 오늘 화면 '이번 주 할 횟수': 내 행동지표(사용 중) · 이번 기간 n/목표 · docs = {분기: 합친 문서}
export function myRoutine(items, users, uid, docs, key) {
  const wk = akWeekKey(new Date(key + "T00:00:00"));
  return (items || []).filter((it) => it && it.active !== false && !it.deleted && !it.paused && akWho(users, it).includes(uid) && akCountable(it, { end: addD(wk, 6) }))
    .sort((a, b) => (CYC_RANK[a.cyc] ?? 1) - (CYC_RANK[b.cyc] ?? 1) || akOrder(a, b)).map((it) => { const weeks = periodWeeks(it, key), tot = akTotal(docs, it, weeks), me = weeks.reduce((s, w) => s + akMine(docs, it, w.key, uid), 0);
      return { it, wk, qid: akQidOfWeek(wk), tot, me, owners: akWho(users, it).length, step: akStep(it), per: periodLabel(it, key), goal: akGoalText(it), links: akLaunchItems(it) }; });
}
const CYC_RANK = { W: 0, M: 1, Q: 2 };   // 주 → 월 → 분기
// 기간 이름 (숫자 앞에 붙임): 주간 = '이번 주' · 월간 = 실제 달('10월' · periodWeeks 가 고른 달 = 이번 주 월요일이 속한 달) · 분기 = '4분기'
export function periodLabel(it, key) {
  const { m0 } = akMonthOfWeek(akWeekKey(new Date(key + "T00:00:00")));
  return it.cyc === "W" ? "이번 주" : it.cyc === "Q" ? `${Math.floor(m0 / 3) + 1}분기` : `${m0 + 1}월`;
}
const addD = (ymd, n) => { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const akMine = (docs, it, wk, uid) => { const v = ((((docs || {})[akQidOfWeek(wk)] || {}).w || {})[wk] || {})[it.id]; return Math.max(0, +((v && v.by) || {})[uid] || 0); };
export { akVal };

// 브랜드(사용자 결정 2026-10-05 '브랜드가 다르면 별도로'): 둘 다 브랜드가 있으면 같은 브랜드끼리만 짝 · 한쪽이라도 브랜드가 없으면 짝 가능
const BR = { "POUR스토어": "pourstore", "포어스토어": "pourstore", "그로홈": "grohome", "GROHOME": "grohome", "바라스데이": "barasday" };
export const brId = (b) => { const s = String(b || "").trim(); return BR[s] || s.toLowerCase(); };
// 브랜드 이름: D.brands(id·이름) 먼저 → 아는 이름 → 그대로 (bmuqo9k5u 같은 id 가 날것으로 안 보이게)
export const brandName = (b, brands) => { const s = String(b || "").trim(); if (!s) return ""; if (s === COMMON_BRAND.id) return COMMON_BRAND.name;
  const hit = (brands || []).find((x) => x && (x.id === s || x.id === brId(s) || String(x.name || "").trim() === s));
  return (hit && hit.name) || ({ pourstore: "POUR스토어", grohome: "그로홈", barasday: "바라스데이" })[brId(s)] || s; };
export const sameBrand = (a, b) => !brId(a) || !brId(b) || brId(a) === brId(b);
// 반복 → 신제품 짝: 내가 담당인 열린 신제품 횟수 항목 (목표 아직 · 프로젝트 열림 · 기밀 대체본 아님)
//   진짜 담당(임시 = 책임자로 채운 것 말고)이 있으면 그것만 · 지금 즈음인 제품만(출시 45일 전 ~ 출시 21일 뒤 · 또는 기한이 2주 전 ~ 3주 뒤) · 많아도 5개
export function launchMatches(it, D, uid, key) {
  const want = akLaunchItems(it); if (!want.length) return [];
  const pOf = (pid) => (D.projects || []).find((x) => x.id === pid);
  const open = (p) => p && !p.deleted && !["completed", "done", "dropped", "hold", "paused"].includes(p.status) && !p.archived;
  const base0 = (D.tasks || []).filter((t) => t.launchItem && want.includes(t.launchItem) && !t.isFixed && !t.deleted && !t.parentId && !isDone(t) && t.status !== "dropped" && t.status !== "review"
    && isMine(t, uid) && open(pOf(t.projectId)) && countOf(t) < targetOf(t) && t.title !== "기밀 업무");
  const base = base0.filter((t) => sameBrand(it.brand, (pOf(t.projectId) || {}).brand || t.brand));
  const real = base.filter((t) => !isTempOwner(t, D)), pool = real.length ? real : base;
  const k = key || ymd(new Date()), near = (t) => { const L = (pOf(t.projectId) || {}).launchDate || "", d = dueOf(t) || "";
    return (L && L >= addDays(k, -21) && L <= addDays(k, 45)) || (d && d >= addDays(k, -14) && d <= addDays(k, 21)); };
  return pool.filter(near).sort((a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"))).slice(0, 5);
}
// 신제품 → 반복 짝: 내 행동지표(사용 중) 중 이 항목과 낱말이 맞는 것
export function akMatches(t, items, users, uid, brand) {
  const all = (items || []).filter((it) => it && it.active !== false && !it.deleted && !it.perFail && it.unit !== "%" && akWho(users, it).includes(uid) && akLaunchItems(it).includes(t.launchItem));
  return all.filter((it) => sameBrand(it.brand, brand || t.brand));
}

// v2 실적 문서에 +d (transaction 안에서 부름) → { write, ret }
export function akWrite(cur, it, wk, d, cu, at, extra) {
  const v = (((cur || {}).w || {})[wk] || {})[it.id] || {}, step = d * akStep(it), fail = !!(extra && extra.fail);
  const n = Math.max(0, (+v.n || 0) + (fail ? 0 : step)), fl = Math.max(0, (+v.fail || 0) + (fail ? d : 0)), mine = Math.max(0, (+((v.by || {})[cu.id]) || 0) + (fail ? 0 : step));
  const entry = { at, by: cu.id, byName: cu.name, it: it.id, wk, d: step, ...(fail ? { fail: true } : {}), ...(extra && extra.task ? { task: extra.task } : {}),
    ...(extra && extra.date ? { date: extra.date } : {}), ...(extra && extra.qty != null ? { qty: extra.qty } : {}), ...(extra && extra.via ? { via: extra.via } : {}) };   // 3단계: 그날 · 건수 · 어디서(btn 버튼 · list 체크리스트 한 바퀴 · qty 건수)
  if (!cur) return { write: { w: { [wk]: { [it.id]: { n, fail: fl, by: { [cu.id]: mine } } } }, log: [entry] }, ret: n };
  const p = `w.${wk}.${it.id}.`;
  return { write: { [p + "n"]: n, [p + "fail"]: fl, [p + "by." + cu.id]: mine, log: (extra && extra.union ? extra.union(entry) : [...(cur.log || []), entry]) }, ret: n };
}
