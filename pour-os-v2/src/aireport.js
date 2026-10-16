// 업무OS v2 — AI 크루 보고서 (계산만 · 저장 없음 · 쓰기 = core.jsx aiRep* · 화면 = aireport.jsx)
//   사용자 결정 2026-10-15 "본부장은 승인 없고 리드에게 매주 금요일마다 보고받는 형태 · 보고서를 각 영역으로 한 주 동안 무엇을 실행했고,
//     결과는 어떤지(유입, 전환) 다음주는 어떻게 할 예정인지(AI 팀원들의 피드백 + 사람팀원이 직접 넣으면 추가 반영)"
//     "보고서는 한동안 주간 · 점차 1개월로 늘릴 거야" · "보고서는 크루 칸별로" · "KPI 체크는 담당 사람이 직접"
//   기간 = settings/aicrew.reportCycle {cycle: week(기본) | 2week | month, from = 바꾼 주 월요일} · 마감 = 그 기간 마지막 금요일
//   칸 = 크루 팀원 중 보드가 있는 칸 (B2C 6칸 · B2B·바라스데이 크루는 보드가 없어 아직 없음)
//   한 칸 = ① 실행(실행 업무·흔적·승인) ② 결과(보드 지표: 이번 기간 마지막 값 ← 지난 기간 · 목표) ③ KPI(짝지은 반복 실행 +n)
//           ④ 다음(AI [다음주] = aiboards.nextHist + 사람이 더함) · 담당이 숫자 확인·한 줄 → [다 썼어요]
//   리드(그 칸 담당의 상급자 중 리드) 한마디 → [본부장에게 보내기] = 그때 숫자를 얼림(snap) · 본부장 [읽었어요]
//   저장: pour-os/v2/aireports/{크루}-{기간 시작} = {crew, cycle, start, end, due, secs:{AI id:{note, plan, done, sent, snap}}, leads:{리드 id:{note, at}}, read, log[]}
import { addDays, ymd, md, nameOf, isMaster, isDone, isRemoved } from "./model.js";
import { CREWS, GONE, mateOf, boardOf, fmtMetric, metricOk } from "../../marketing-hub/crew.js";
import { mateOwner, bossOf, isLeadU, isHQ, MAX_UP } from "./aiask.js";
import { doneDay, dayOfIso } from "./report.js";
import { isFxKey, fxIdOf } from "./airt.js";

export const CYCLE_L = { week: "주간", "2week": "2주", month: "월간" };
export const CYCLE_FROM = "2026-10-12";   // 첫 보고 기간 (월요일)
const dow = (d) => new Date(d + "T00:00:00").getDay();   // 0 일 … 5 금
export const monOf = (d) => addDays(d, -((dow(d) + 6) % 7));
const between = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
const isDay = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ""));

// 주기 설정 (관리자 · settings/aicrew.reportCycle)
export function cycleOf(D) {
  const s = ((D && D.settings) || []).find((x) => (x.id || x._doc) === "aicrew"), c = (s && s.reportCycle) || {};
  return { cycle: CYCLE_L[c.cycle] ? c.cycle : "week", from: isDay(c.from) ? monOf(c.from) : CYCLE_FROM, at: c.at || "", byName: c.byName || "" };
}
// day 가 든 기간 {cycle, start, end, due}
export function periodOf(cfg, day) {
  const c = (cfg && cfg.cycle) || "week";
  if (c === "month") {
    const ym = day.slice(0, 7), last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), end = `${ym}-${String(last).padStart(2, "0")}`;
    return { cycle: c, start: `${ym}-01`, end, due: addDays(end, -((dow(end) + 2) % 7)) };   // 그 달 마지막 금요일
  }
  const m = monOf(day);
  if (c === "2week") { const a = monOf((cfg && cfg.from) || CYCLE_FROM), start = addDays(a, Math.floor(between(a, m) / 14) * 14); return { cycle: c, start, end: addDays(start, 13), due: addDays(start, 11) }; }
  return { cycle: "week", start: m, end: addDays(m, 6), due: addDays(m, 4) };
}
export const prevPeriod = (cfg, p) => periodOf(cfg, addDays(p.start, -1));
export const nextPeriod = (cfg, p) => periodOf(cfg, addDays(p.end, 1));
// 저장된 보고서의 기간 (주기를 바꾼 뒤에도 그때 기간 그대로)
export const periodOfDoc = (r) => (r && isDay(r.start) && isDay(r.end) ? { cycle: r.cycle || "week", start: r.start, end: r.end, due: isDay(r.due) ? r.due : r.end } : null);
export const WORD = { week: ["이번 주", "지난주", "다음 주"], "2week": ["이번 2주", "지난 2주", "다음 2주"], month: ["이번 달", "지난달", "다음 달"] };
export const periodL = (p) => `${md(p.start)}~${md(p.end)}`;
export const dueL = (p) => `금 ${md(p.due)} 마감`;

// 크루 칸 (보드가 있는 팀원만)
export const repSlots = (crewId) => { const c = CREWS.find((x) => x.id === crewId); return c ? c.members.filter((m) => m.board && boardOf(m.board)) : []; };
export const repCrews = () => CREWS.filter((c) => repSlots(c.id).length);
export const repId = (crewId, p) => `${crewId}-${p.start}`;

// 칸 사람: 담당(AI 담당) · 같이 쓰는 사람(할 일 담당) · 리드(담당의 상급자 중 리드 · 본인이 리드면 본인)
const actU = (users, id) => (users || []).find((u) => u && u.id === id && u.active !== false);
export function leadOf(users, uid) { for (let k = 0, cur = uid; k <= MAX_UP && cur; k++) { if (isLeadU(users, cur)) return cur; cur = bossOf(cur, users); } return ""; }
export const hqOfUsers = (users) => ((users || []).find((u) => u && u.active !== false && isHQ(users, u.id)) || {}).id || "";
export function secPeople(D, m) {
  const b = boardOf(m.board), doc = (D.ai && D.ai.mates && D.ai.mates[m.id]) || {}, owner = mateOwner(doc, b.brand, D.users);
  const acts = [...new Set(Object.values(doc.actOwners || {}).filter((x) => x && actU(D.users, x)))];
  const writers = [...new Set([owner, ...acts].filter(Boolean))];
  const o = owner || writers[0] || "";
  return { owner, writers, lead: o ? leadOf(D.users, o) || o : "" };   // 위에 리드가 없으면 담당이 바로 본부장에게 · 담당 미정 칸 = 관리자 누구나(화면에서만)
}
export const canWriteSec = (D, cu, m, people) => !!cu && (isMaster(cu) || (people || secPeople(D, m)).writers.includes(cu.id) || (people || secPeople(D, m)).lead === cu.id);

// 한 칸의 이번 기간 숫자 (보낸 칸은 snap 을 씀) — asks = 이번·지난 기간 승인 건(D.ai.asks + 기간 읽기)
export function secData(D, m, p, pv, asks) {
  const b = boardOf(m.board), ids = new Set([m.id, ...Object.entries(GONE).filter(([, to]) => to === m.id).map(([g]) => g)]);
  const inP = (d) => !!d && d >= p.start && d <= p.end;
  // ① 실행 — 이 AI 의 실행 업무(tasks.aiMate) · 이번 기간에 끝낸 것 · 아직 열린 것 · 흔적은 그 날짜가 이번 기간인 것
  const tasks = (D.tasks || []).filter((t) => t && t.aiAsk && ids.has(t.aiMate) && !isRemoved(t) && t.status !== "dropped");
  const doneT = tasks.filter((t) => inP(doneDay(t))).sort((x, y) => doneDay(x).localeCompare(doneDay(y)));
  const openT = tasks.filter((t) => !isDone(t));
  const tr = { done: 0, skip: 0, links: [] };
  tasks.forEach((t) => Object.entries(t.aiTrace || {}).forEach(([n, r]) => { if (!r || !inP(r.date)) return;
    if (r.done) { tr.done++; if (r.link && tr.links.length < 12) tr.links.push({ n, link: r.link, task: t.id, title: t.title }); } else if (r.skip) tr.skip++; }));
  // 승인 — 이번 기간에 올라온 것(run) · 최종 승인·안 함(그날) · 아직 열린 것
  const mine = (asks || []).filter((a) => a && ids.has(a.mate));
  const st = { made: mine.filter((a) => inP(a.run)).length, ok: mine.filter((a) => a.state === "ok" && inP(dayOfIso(a.okAt))).length,
    no: mine.filter((a) => a.state === "no" && inP(dayOfIso(a.noAt))).length, open: mine.filter((a) => a.state === "wait" || a.state === "back").length,
    req: mine.filter((a) => a.act === "R" && inP(a.run)).length };
  // ② 결과 — 보드 지표 (aiboards.hist{지표:{날짜:값}}) 이번 기간 마지막 값 ← 지난 기간 마지막 값 · 목표
  const bv = (D.ai && D.ai.boards && D.ai.boards[b.id]) || {}, hist = bv.hist || {};
  const lastIn = (k, a, z) => { const h = hist[k] || {}, d = Object.keys(h).filter((x) => x >= a && x <= z).sort().pop(); return d ? { v: h[d], date: d } : null; };
  const metrics = b.metrics.map((x) => { const cur = lastIn(x.k, p.start, p.end), prev = pv ? lastIn(x.k, pv.start, pv.end) : null;
    return { k: x.k, l: x.l, u: x.u || "", dir: x.dir || "up", target: x.target, cur, prev, ok: !!cur && metricOk(x, cur.v) }; });
  // ③ KPI — 이 AI 할 일과 짝지은 반복 실행(aimates.actAk) · 이번 기간 흔적 [했어요] 수 (사람이 직접 누른 것)
  const mdoc = (D.ai && D.ai.mates && D.ai.mates[m.id]) || {}, items = (D.ak && D.ak.items) || [];
  const ak = [...new Set(Object.values(mdoc.actAk || {}).filter(Boolean))].map((id) => { const it = items.find((x) => x.id === id);
    const n = tasks.filter((t) => t.aiAk === id).reduce((s, t) => s + Object.values(t.aiTrace || {}).filter((r) => r && r.done && inP(r.date)).length, 0);
    const ft = !it && isFxKey(id) ? ((D.tasks || []).find((x) => x.id === fxIdOf(id)) || null) : null;   // 정한 날 체크 짝 (2026-10-16)
    return { id, name: it ? it.name : ft ? ft.title : id, n }; });
  // ④ 다음 — AI [다음주] (aiboards.nextHist · 이번 기간 안에서 마지막)
  const nh = bv.nextHist || {}, nd = Object.keys(nh).filter(inP).sort().pop() || "";
  return { mate: m.id, name: m.name, slot: m.slot, role: m.role, board: b.id, title: b.title,
    done: doneT.slice(0, 20).map((t) => ({ id: t.id, title: t.title, day: doneDay(t) })), doneN: doneT.length, openN: openT.length,
    trace: tr, asks: st, metrics, ak, aiNext: nd ? String(nh[nd] || "").slice(0, 2000) : "", aiNextRun: nd };
}
// 숫자 한 줄 (지표) — '7.4% ← 6.1% · 목표 12% ✓'
export function metricLine(x) {
  const m = { u: x.u, dir: x.dir }, f = (v) => fmtMetric(m, v);
  return `${x.cur ? f(x.cur.v) : "—"}${x.prev ? ` ← ${f(x.prev.v)}` : ""}${x.target != null ? ` · 목표 ${f(x.target)}` : ""}${x.ok ? " ✓" : ""}`;
}
export const trend = (x) => (!x.cur || !x.prev || x.cur.v === x.prev.v ? 0 : (x.cur.v > x.prev.v) === (x.dir !== "down") ? 1 : -1);   // 1 좋아짐 · −1 나빠짐

// 칸 상태
export const secState = (r, mateId) => { const s = ((r && r.secs) || {})[mateId] || {}; return s.sent ? "sent" : s.done ? "done" : s.note || s.plan ? "draft" : "none"; };
export const SEC_L = { none: "작성 전", draft: "쓰는 중", done: "담당 확인", sent: "본부장에게 보냄" };

// '확인할 것' 줄 (마감 날부터 · 보낼 때까지 · 지난 기간도 안 보냈으면 빨강) — model.todayView 가 D.aiRepInbox 로 부름(순환 import 피하려고)
//   담당·같이 쓰는 사람: 그 칸 [다 썼어요] 전 · 리드: 내 칸 중 안 보낸 것 · 본부장: 보낸 칸이 있고 아직 안 읽음
export function repInbox(D, uid, now = new Date()) {
  const users = D.users || [], me = actU(users, uid); if (!me || !D.ai) return [];
  const cfg = cycleOf(D), today = ymd(now), docs = D.ai.reports || {}, rows = [], hq = isHQ(users, uid);
  repCrews().forEach((c) => {
    const cur = periodOf(cfg, today), pv = prevPeriod(cfg, cur), slots = repSlots(c.id);
    [pv, cur].forEach((p) => {
      if (today < p.due || (p !== cur && p.start < cfg.from)) return;
      const id = repId(c.id, p), r = docs[id] || {}, late = today > p.end, w = WORD[p.cycle] || WORD.week, base = { kind: "aiRep", crew: c.id, start: p.start, keep: true, red: late, at: (r.updatedAt || p.due + "T00:00:00") };
      const ppl = slots.map((m) => ({ m, ...secPeople(D, m), st: secState(r, m.id) }));
      const myW = ppl.filter((x) => x.writers.includes(uid) && x.st !== "done" && x.st !== "sent");
      if (myW.length) rows.push({ ...base, id: `rep:w:${id}:${uid}`, tag: late ? "보고 지남" : `${CYCLE_L[p.cycle]} 보고`, btn: "쓰기", title: `${myW.map((x) => x.m.name).join("·")} 칸 쓰기 · ${c.short || c.name}`,
        whoName: "AI 크루 보고", text: `${late ? w[1] : w[0]} ${periodL(p)} · KPI 숫자 확인 · 한 줄 · 다음 계획 → [다 썼어요] · ${dueL(p)}` });
      const myL = ppl.filter((x) => x.lead === uid && x.st !== "sent");   // 담당 미정 칸은 줄 없음 (보고서에 '담당 미정'으로만)
      if (myL.length) { const ready = myL.filter((x) => x.st === "done").length;
        rows.push({ ...base, id: `rep:l:${id}:${uid}`, tag: late ? "보고 지남" : "본부장에게 보고", btn: "보내기", title: `${c.short || c.name} ${myL.length}칸 → 본부장에게 보내기`,
          whoName: "AI 크루 보고", text: `${periodL(p)} · 담당 확인 ${ready}/${myL.length}칸 · 한마디 쓰고 보내요 · ${dueL(p)}` }); }
      const sent = slots.filter((m) => secState(r, m.id) === "sent"), lastSent = sent.map((m) => r.secs[m.id].sent.at || "").sort().pop() || "";
      if (hq && sent.length && !(r.read && (r.read.at || "") >= lastSent)) rows.push({ ...base, red: false, id: `rep:h:${id}:${lastSent}`, tag: "보고 도착", btn: "읽기", at: lastSent,
        title: `${c.short || c.name} ${CYCLE_L[p.cycle]} 보고 · ${sent.length}/${slots.length}칸`, whoName: [...new Set(sent.map((m) => r.secs[m.id].sent.byName).filter(Boolean))].join("·") || "리드", text: `${periodL(p)} · 실행 · 결과 · 다음 계획` });
    });
  });
  return rows;
}

// 본부장에게 보낼 때 얼려 둘 칸 (지금 숫자 + 담당 글)
export const snapOf = (data, s) => ({ ...data, note: (s && s.note) || "", plan: (s && s.plan) || "", doneBy: (s && s.done && s.done.byName) || "" });
// 글로 복사 (잔디·카톡 공유용)
export function repText(crew, p, rows, r) {
  const L = [`[AI 크루 ${CYCLE_L[p.cycle]} 보고] ${crew.short || crew.name} · ${periodL(p)} · ${dueL(p)}`];
  rows.forEach(({ m, d, s }) => {
    L.push("", `■ ${m.slot} · ${m.name}(AI) ${m.role}${s.done ? ` · 담당 확인 ${s.done.byName || ""}` : " · 담당 확인 전"}`);
    L.push(`- 실행: 실행 업무 끝냄 ${d.doneN}건 · 흔적 ${d.trace.done}건${d.trace.skip ? ` (안 함 ${d.trace.skip})` : ""} · 승인 ${d.asks.ok}건 · 올라옴 ${d.asks.made}건${d.openN ? ` · 남은 실행 ${d.openN}건` : ""}`);
    d.metrics.filter((x) => x.cur || x.prev).forEach((x) => L.push(`- 결과 ${x.l}: ${metricLine(x)}`));
    d.ak.forEach((x) => L.push(`- KPI ${x.name}: +${x.n}`));
    if (s.note) L.push(`- 한 줄: ${s.note}`);
    const nx = [d.aiNext, s.plan].filter(Boolean).join("\n").split("\n").map((x) => x.trim()).filter(Boolean);
    if (nx.length) L.push(`- 다음: ${nx.map((x) => x.replace(/^[-·•]\s*/, "")).join(" / ")}`);
  });
  const ln = Object.values((r && r.leads) || {}).filter((x) => x && x.note);
  if (ln.length) L.push("", ...ln.map((x) => `리드 한마디 (${x.byName || ""}): ${x.note}`));
  return L.join("\n");
}
export const leadNote = (r, uid) => (((r && r.leads) || {})[uid] || {}).note || "";
export const userL = (users, id) => nameOf(users, id) || "관리자 누구나";
