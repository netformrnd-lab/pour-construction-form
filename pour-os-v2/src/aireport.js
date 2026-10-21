// 업무OS v2 — AI 크루 보고서 (계산만 · 저장 없음 · 쓰기 = core.jsx aiRep* · 화면 = aireport.jsx)
//   사용자 결정 2026-10-15 "본부장은 승인 없고 리드에게 매주 금요일마다 보고받는 형태 · 보고서를 각 영역으로 한 주 동안 무엇을 실행했고,
//     결과는 어떤지(유입, 전환) 다음주는 어떻게 할 예정인지(AI 팀원들의 피드백 + 사람팀원이 직접 넣으면 추가 반영)"
//     "보고서는 한동안 주간 · 점차 1개월로 늘릴 거야" · "보고서는 크루 칸별로" · "KPI 체크는 담당 사람이 직접"
//   기간 = settings/aicrew.reportCycle {cycle: week(기본) | 2week | month, from = 바꾼 주 월요일} · 마감 = 그 기간 마지막 금요일
//   칸 = 크루 팀원 중 보드가 있는 칸 (B2C 6칸 + 맨 위 공통 숫자(별) · B2B 크루·이음·달은 noReport · 바라스데이 크루는 보드가 없어 아직 없음)
//   한 칸 = ① 실행(실행 업무·흔적·승인) ② 결과(보드 지표: 이번 기간 마지막 값 ← 지난 기간 · 목표) ③ KPI(짝지은 반복 실행 +n)
//           ④ 다음(AI [다음주] = aiboards.nextHist + 사람이 더함) · 담당이 숫자 확인·한 줄 → [다 썼어요]
//   리드(그 칸 담당의 상급자 중 리드) 한마디 → [본부장에게 보내기] = 그때 숫자를 얼림(snap) · 본부장 [읽었어요]
//   저장: pour-os/v2/aireports/{크루}-{기간 시작} = {crew, cycle, start, end, due, secs:{AI id:{note, plan, done, sent, snap}}, leads:{리드 id:{note, at}}, read, log[]}
import { addDays, ymd, md, nameOf, isMaster, isDone, isRemoved, fxIds } from "./model.js";
import { PAUSE, CREWS, GONE, mateOf, boardOf, fmtMetric, metricOk, stageNum, handoffsIn, quietOf, quietLine, isNpsAct, npsOf, npsLine } from "../../marketing-hub/crew.js";
import { mateOwner, bossOf, isLeadU, isHQ, MAX_UP } from "./aiask.js";
import { doneDay, dayOfIso } from "./report.js";
import { isFxKey, fxIdOf, akKeys, taskAks, liveAk, liveActOwners } from "./airt.js";

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

// 크루 칸 (보드가 있는 팀원만 · noReport 크루·팀원 빼고 — B2B 크루 · 이음(날마다 운영) · 달(본부장 본인 일) · 2026-10-17)
//   common = 맨 위 '공통 숫자' 칸 (별 · 담당 윤미니 · 리포트 ③)
export const repSlots = (crewId) => { const c = CREWS.find((x) => x.id === crewId); if (!c || c.noReport) return [];
  const ms = c.members.filter((m) => m.board && boardOf(m.board) && !m.noReport); return [...ms.filter((m) => m.common), ...ms.filter((m) => !m.common)]; };
export const repCrews = () => CREWS.filter((c) => repSlots(c.id).length);
export const repId = (crewId, p) => `${crewId}-${p.start}`;

// 칸 사람: 담당(AI 담당) · 같이 쓰는 사람(할 일 담당) · 리드(담당의 상급자 중 리드 · 본인이 리드면 본인)
const actU = (users, id) => (users || []).find((u) => u && u.id === id && u.active !== false);
export function leadOf(users, uid) { for (let k = 0, cur = uid; k <= MAX_UP && cur; k++) { if (isLeadU(users, cur)) return cur; cur = bossOf(cur, users); } return ""; }
export const hqOfUsers = (users) => ((users || []).find((u) => u && u.active !== false && isHQ(users, u.id)) || {}).id || "";
export function secPeople(D, m) {
  const b = boardOf(m.board), doc = (D.ai && D.ai.mates && D.ai.mates[m.id]) || {}, owner = mateOwner(doc, b.brand, D.users);
  const acts = [...new Set(Object.values(liveActOwners(m.id, doc)).filter((x) => x && actU(D.users, x)))];   // 지금 있는 할 일 담당만 (옮긴 옛 글자 빼고 · 2026-10-17)
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
  // 변화 없음 (2026-10-17 사장님 2A) — 할 것이 없어 [상태] 한 줄만 남긴 날 · 할 일마다 셈 (crew.quietOf)
  const quiet = quietOf(bv, p.start, p.end, new Set(mine.filter((a) => a.board === b.id && a.act).map((a) => `${a.run}~${a.act}`)));
  const lastIn = (k, a, z) => { const h = hist[k] || {}, d = Object.keys(h).filter((x) => x >= a && x <= z).sort().pop(); return d ? { v: h[d], date: d } : null; };
  const metrics = b.metrics.map((x) => { const cur = lastIn(x.k, p.start, p.end), prev = pv ? lastIn(x.k, pv.start, pv.end) : null;
    return { k: x.k, l: x.l, u: x.u || "", dir: x.dir || "up", target: x.target, cur, prev, ok: !!cur && metricOk(x, cur.v) }; });
  // ③ KPI — 이 AI 할 일과 짝지은 반복 실행(aimates.actAk) · 이번 기간 흔적 [했어요] 수 (사람이 직접 누른 것)
  const mdoc = (D.ai && D.ai.mates && D.ai.mates[m.id]) || {}, items = (D.ak && D.ak.items) || [];
  //   짝 여러 개 (2026-10-17): 흔적이 센 열쇠(cnt)로 셈 · cnt 없는 예전 흔적은 그 실행 업무의 aiAk
  const ak = [...new Set(Object.values(liveAk(m.id, mdoc)).flat())].map((id) => { const it = items.find((x) => x.id === id);   // 지금 있는 할 일의 짝만 (옮긴 옛 글자 빼고 · 2026-10-17)
    const n = tasks.filter((t) => taskAks(t).includes(id)).reduce((s, t) => s + Object.values(t.aiTrace || {}).filter((r) => r && r.done && inP(r.date) && (Array.isArray(r.cnt) ? r.cnt.includes(id) : t.aiAk === id)).length, 0);
    const ft = !it && isFxKey(id) ? ((D.tasks || []).find((x) => x.id === fxIdOf(id)) || null) : null;   // 정한 날 체크 짝 (2026-10-16)
    return { id, name: it ? it.name : ft ? ft.title : id, n }; });
  // ⓪ 단계 숫자 (2026-10-17 사장님 1A '단계마다 하나') — 다른 보드 지표일 수 있음 (유입 = 가을 보드 방문 + 겨울 보드 문의)
  const sn = stageNum(m.id), histB = (bid) => (((D.ai && D.ai.boards && D.ai.boards[bid]) || {}).hist) || {};
  const lastB = (bid, k, a, z) => { const h = histB(bid)[k] || {}, d = Object.keys(h).filter((x) => x >= a && x <= z).sort().pop(); return d ? { v: h[d], date: d } : null; };
  const stage = sn ? { l: sn.l, slot: sn.slot, vals: sn.ms.map((x) => { const cur = lastB(x.board, x.k, p.start, p.end), prev = pv ? lastB(x.board, x.k, pv.start, pv.end) : null;
    return { k: x.k, l: x.l, u: x.u || "", dir: x.dir || "up", target: x.target, cur, prev, ok: !!cur && metricOk(x, cur.v) }; }) } : null;
  // 넘겨받은 것 (2026-10-17 사장님 넘기기 A) — 이번 기간에 최종 승인된 다른 AI 결과 중 이 AI 에게 온 것
  const inbox = handoffsIn(m.id, asks, p.start, p.end).slice(0, 10).map((x) => ({ id: x.id, name: x.name, act: x.act, at: x.at, title: x.title, n: x.n }));
  // NPS (2026-10-18 사장님 2-1A) — NPS 유선 조사 실행 업무 흔적 [했어요] 점수 · 기간 끝날까지 30일 (AI 한 장·지시문과 같은 창) · 지난 기간도 · 보드 지표 'nps' 줄 대신 보임
  const npsT = b.actions.some((a) => isNpsAct(m.id, a.c)) ? tasks.filter((t) => isNpsAct(t.aiMate, t.aiAct)) : null;
  const npsTo = (z) => npsOf(npsT.flatMap((t) => Object.values(t.aiTrace || {}).filter((r) => r && r.done && r.date && r.date >= addDays(z, -29) && r.date <= z).map((r) => r.score)));
  const nps = npsT ? { cur: npsTo(p.end), prev: pv ? npsTo(pv.end) : null, from: addDays(p.end, -29), to: p.end } : null;
  // ④ 다음 — AI [다음주] (aiboards.nextHist · 이번 기간 안에서 마지막)
  const nh = bv.nextHist || {}, nd = Object.keys(nh).filter(inP).sort().pop() || "";
  return { mate: m.id, name: m.name, slot: m.slot, role: m.role, board: b.id, title: b.title,
    done: doneT.slice(0, 20).map((t) => ({ id: t.id, title: t.title, day: doneDay(t) })), doneN: doneT.length, openN: openT.length,
    trace: tr, asks: st, quiet, metrics, ak, stage, inbox, nps, aiNext: nd ? String(nh[nd] || "").slice(0, 2000) : "", aiNextRun: nd };
}
// 숫자 한 줄 (지표) — '7.4% ← 6.1% · 목표 12% ✓'
export function metricLine(x) {
  const m = { u: x.u, dir: x.dir }, f = (v) => fmtMetric(m, v);
  return `${x.cur ? f(x.cur.v) : "—"}${x.prev ? ` ← ${f(x.prev.v)}` : ""}${x.target != null ? ` · 목표 ${f(x.target)}` : ""}${x.ok ? " ✓" : ""}`;
}
// 단계 숫자 한 줄 — '방문·문의 수: 12,340회 ← 11,020회 · 85건' (값 없으면 —)
export const stageLine = (st) => (!st ? "" : `${st.l}: ${st.vals.map((x) => (st.vals.length > 1 ? `${x.l.replace(/\s*\(.*$/, "")} ` : "") + metricLine(x)).join(" · ")}`);
export const trend = (x) => (!x.cur || !x.prev || x.cur.v === x.prev.v ? 0 : (x.cur.v > x.prev.v) === (x.dir !== "down") ? 1 : -1);   // 1 좋아짐 · −1 나빠짐

// 칸 상태
export const secState = (r, mateId) => { const s = ((r && r.secs) || {})[mateId] || {}; return s.sent ? "sent" : s.done ? "done" : s.note || s.plan || (s.files || []).length ? "draft" : "none"; };
export const SEC_L = { none: "작성 전", draft: "쓰는 중", done: "담당 확인", sent: "본부장에게 보냄" };

// 리포트 ①② (2026-10-17 볼트 "주간 리포트 = AI 크루 보고서 · [다 썼어요] = 그 사람의 금요일 '이번주 리포트 전달' 자동 체크 · 반복업무 메모(내용물·포인트)를 그 칸 위에")
//   사람마다 고정업무 '이번주 리포트 전달'(윤미니 · 김민지 · 양채림 · 매주 금 11:00 · 메모 = 쓸 것) — 그 사람이 담당(AI 담당)인 칸을 이번 기간에 다 쓰면 그 고정업무 오늘 체크
export const REP_FX_RE = /이번\s*주\s*리포트\s*전달/;
export const repFxOf = (D, uid) => (!uid ? null : (D.tasks || []).find((t) => t && t.isFixed && !isRemoved(t) && !t.paused && fxIds(t).includes(uid) && REP_FX_RE.test(String(t.title || ""))) || null);
// 내가 담당인 칸 중 아직 안 쓴 것 (just = 방금 [다 썼어요] 누른 칸 {crew, mate} → 쓴 것으로) · 같이 쓰는 칸(할 일 담당)은 셈에서 뺌 — 그 칸은 담당이 끝냄
export function myRepLeft(D, uid, p, just) {
  const docs = (D.ai && D.ai.reports) || {};
  return repCrews().flatMap((c) => { const r = docs[repId(c.id, p)] || {};
    return repSlots(c.id).filter((m) => !(just && just.crew === c.id && just.mate === m.id) && secPeople(D, m).owner === uid && !["done", "sent"].includes(secState(r, m.id))); });
}
// 칸 파일 (리포트 ④ · "팀원은 자기 칸에 직접 만든 보고서(HTML·파일)를 올리거나 · 본부장은 보낸 때의 파일을 그대로 봄") — 보낸 칸 = snap.files · 아직 = secs.<AI>.files
export const secFiles = (s, sent) => ((sent ? (s && s.snap && s.snap.files) || (s && s.files) : s && s.files) || []).filter((f) => f && f.url);

// '확인할 것' 줄 (마감 날부터 · 보낼 때까지 · 지난 기간도 안 보냈으면 빨강) — model.todayView 가 D.aiRepInbox 로 부름(순환 import 피하려고)
//   담당·같이 쓰는 사람: 그 칸 [다 썼어요] 전 · 리드: 내 칸 중 안 보낸 것 · 본부장: 보낸 칸이 있고 아직 안 읽음
export function repInbox(D, uid, now = new Date()) {
  if (PAUSE.on) return [];   // ⏸ 자동화 멈춤 (2026-10-21) — AI 크루 보고 칸 쓰기·보내기·도착 줄 안 띄움 (보고서 화면은 그대로)
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
export const snapOf = (data, s) => ({ ...data, note: (s && s.note) || "", plan: (s && s.plan) || "", doneBy: (s && s.done && s.done.byName) || "", files: secFiles(s, false) });
// 글로 복사 (잔디·카톡 공유용)
export function repText(crew, p, rows, r) {
  const L = [`[AI 크루 ${CYCLE_L[p.cycle]} 보고] ${crew.short || crew.name} · ${periodL(p)} · ${dueL(p)}`];
  rows.forEach(({ m, d, s }) => {
    L.push("", `■ ${m.slot} · ${m.name}(AI) ${m.role}${s.done ? ` · 담당 확인 ${s.done.byName || ""}` : " · 담당 확인 전"}`);
    L.push(`- 실행: 실행 업무 끝냄 ${d.doneN}건 · 흔적 ${d.trace.done}건${d.trace.skip ? ` (안 함 ${d.trace.skip})` : ""} · 승인 ${d.asks.ok}건 · 올라옴 ${d.asks.made}건${d.openN ? ` · 남은 실행 ${d.openN}건` : ""}${quietLine(d.quiet) ? ` · ${quietLine(d.quiet)}` : ""}`);
    if (d.stage) L.push(`- 단계 숫자 ${stageLine(d.stage)}`);
    if (d.nps) L.push(`- NPS (${md(d.nps.from)}~${md(d.nps.to)} · [했어요] 점수): ${d.nps.cur ? npsLine(d.nps.cur) : "남긴 점수 없음"}${d.nps.prev ? ` ← 지난 기간 ${d.nps.prev.nps}` : ""}`);
    d.metrics.filter((x) => (x.cur || x.prev) && !(d.nps && x.k === "nps")).forEach((x) => L.push(`- 결과 ${x.l}: ${metricLine(x)}`));
    if ((d.inbox || []).length) L.push(`- 넘겨받은 것: ${d.inbox.map((x) => `${x.name} ${x.act} ${md(x.at)} ${x.title}`).join(" · ")}`);
    d.ak.forEach((x) => L.push(`- KPI ${x.name}: +${x.n}`));
    if (s.note) L.push(`- 한 줄: ${s.note}`);
    const fs = secFiles(s, !!s.sent); if (fs.length) L.push(`- 파일 ${fs.length}개: ${fs.map((f) => f.name || "파일").join(" · ")} (업무OS 보고서에서 열기)`);
    const nx = [d.aiNext, s.plan].filter(Boolean).join("\n").split("\n").map((x) => x.trim()).filter(Boolean);
    if (nx.length) L.push(`- 다음: ${nx.map((x) => x.replace(/^[-·•]\s*/, "")).join(" / ")}`);
  });
  const ln = Object.values((r && r.leads) || {}).filter((x) => x && x.note);
  if (ln.length) L.push("", ...ln.map((x) => `리드 한마디 (${x.byName || ""}): ${x.note}`));
  return L.join("\n");
}
export const leadNote = (r, uid) => (((r && r.leads) || {})[uid] || {}).note || "";
export const userL = (users, id) => nameOf(users, id) || "관리자 누구나";
