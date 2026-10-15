// 업무OS v2 — AI 크루 보고서 화면 (계산 aireport.js · 쓰기 core.jsx aiRep* · 사용자 결정 2026-10-15)
//   "본부장은 리드에게 매주 금요일마다 보고받음 · 크루 칸별 · 한 주 동안 무엇을 실행했고, 결과는 어떤지(유입·전환), 다음 주는 어떻게(AI 피드백 + 사람이 더함)"
//   한 화면에서 끝: 기간 ‹ › · 다음 할 일 한 줄 · 칸 카드(① 실행 ② 결과 ③ KPI ④ 다음 · 담당 글) · 아래 큰 버튼 하나(리드 = 본부장에게 보내기 · 본부장 = 읽었어요)
//   담당(그 칸 AI 담당·할 일 담당) = 숫자 확인 · 한 줄 · 다음 계획 → [다 썼어요] · (관리자) 주기 주간 → 2주 → 월간
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { md, hm, ymd, addDays, isMaster, nameOf } from "./model.js";
import { C, Big, TBtn, Seg, Card, Sheet, inp, Linked } from "./ui.jsx";
import { CopyText } from "./aiui.jsx";
import { useDoneSince } from "./reportui.jsx";
import { isHQ } from "./aiask.js";
import { CYCLE_L, WORD, cycleOf, periodOf, prevPeriod, nextPeriod, periodOfDoc, periodL, dueL, repSlots, repCrews, repId, secPeople, canWriteSec, secData, secState, SEC_L, metricLine, trend, repText } from "./aireport.js";

const Pill = ({ children, color = C.navy, bg = C.soft }) => <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;
const ST_TONE = { none: [C.sub, "#F1F2F6"], draft: [C.navy, C.soft], done: [C.green, "#E7F4EC"], sent: ["#fff", C.green] };
const when = (iso) => (iso ? `${md(ymd(new Date(iso)))} ${hm(iso)}` : "");
const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

// 지난 기간 승인 건 (앱은 열린 것 + 최근 14일만 들고 있음) — 그 기간을 볼 때 한 번 읽음 (읽기만)
function useRepAsks(D, from) {
  const need = !!from && from < addDays(ymd(new Date()), -12);
  const [got, setGot] = useState({});
  useEffect(() => { if (!need || got[from]) return undefined; let on = true;
    fb.fetchWhere("aiasks", ["run", ">=", from]).then((x) => { if (on) setGot((g) => ({ ...g, [from]: x })); })
      .catch((e) => { console.error("[AI 크루 보고] 지난 승인 건 못 읽음:", e); if (on) setGot((g) => ({ ...g, [from]: [] })); });
    return () => { on = false; }; }, [need, from]);
  return useMemo(() => { const m = new Map(); (need ? got[from] || [] : []).forEach((a) => m.set(a.id, a)); ((D.ai && D.ai.asks) || []).forEach((a) => m.set(a.id, a)); return [...m.values()]; }, [D.ai, need, from, got[from]]);
}

export function AiReportSheet({ D, cu, A, open, onBack, onClose, crew, start }) {
  const crews = repCrews(), c = crews.find((x) => x.id === crew) || crews[0];
  const cfg = cycleOf(D), today = ymd(new Date()), docs = (D.ai && D.ai.reports) || {}, master = isMaster(cu), hq = isHQ(D.users, cu.id);
  const p0 = (start && c && periodOfDoc(docs[repId(c.id, { start })])) || periodOf(cfg, start || today);
  const [pk, setPk] = useState(p0.start);   // 지금 보는 기간 (시작일)
  const p = (c && periodOfDoc(docs[repId(c.id, { start: pk })])) || periodOf(cfg, pk), pc = { ...cfg, cycle: p.cycle }, pv = prevPeriod(pc, p), nx = nextPeriod(pc, p);   // 저장된 보고서는 그때 주기로 앞뒤
  const [allOpen, setAllOpen] = useState(false), [note, setNote] = useState(null), [rdNote, setRdNote] = useState(""), [busy, setBusy] = useState(false);
  const asks = useRepAsks(D, pv.start), dt = useDoneSince(D, p.start);
  if (!c) return <Sheet title="AI 크루 보고" onBack={onBack} onClose={onClose}><div style={{ padding: 16, color: C.sub }}>보드가 있는 크루가 없어요</div></Sheet>;
  const r = docs[repId(c.id, p)] || {}, W0 = WORD[p.cycle] || WORD.week;
  const D2 = { ...D, tasks: dt.tasks };
  const rows = repSlots(c.id).map((m) => { const s = (r.secs || {})[m.id] || {}, sent = !!s.sent, ppl = secPeople(D, m);
    return { m, s, sent, ppl, st: secState(r, m.id), d: sent && s.snap ? s.snap : secData(D2, m, p, pv, asks) }; });
  const noOwn = rows.filter((x) => !x.ppl.writers.length).length;
  const n = rows.length, doneN = rows.filter((x) => x.st === "done" || x.st === "sent").length, sentN = rows.filter((x) => x.sent).length;
  const myW = rows.filter((x) => !x.sent && x.ppl.writers.includes(cu.id) && x.st !== "done");
  const myL = rows.filter((x) => !x.sent && x.ppl.lead === cu.id);   // 내가 리드인 칸만 (담당 미정 칸은 보내지 않음 · '확인할 것' 줄과 같은 기준)
  const lastSent = rows.filter((x) => x.sent).map((x) => x.s.sent.at || "").sort().pop() || "", unread = hq && sentN > 0 && !(r.read && (r.read.at || "") >= lastSent);
  const isCur = today >= p.start && today <= p.end, late = !isCur && today > p.end, ready = myL.filter((x) => x.st === "done").length;
  const perL = isCur ? W0[0] : nx.start <= today && nx.end >= today ? W0[1] : "";   // 이번 주 · 지난주 (그 밖은 날짜만)
  const nextL = myW.length ? `내 칸 ${myW.map((x) => x.m.name).join("·")} — 숫자를 확인하고 한 줄 · 다음 계획을 쓴 뒤 [다 썼어요]`
    : myL.length ? `담당 확인 ${ready}/${myL.length}칸 · ${ready === myL.length ? "다 모였어요 — 한마디 쓰고 [본부장에게 보내기]" : `모이면 한마디 쓰고 [본부장에게 보내기] · ${dueL(p)}`}`
    : unread ? `보낸 칸 ${sentN}개 · 읽고 [읽었어요] (한마디는 선택)` : sentN === n ? "다 보냈어요" : `${dueL(p)} · 담당이 쓰고 리드가 보내요`;
  const ldNote = note !== null ? note : ((r.leads || {})[cu.id] || {}).note || "";
  const send = async () => { if (busy) return; setBusy(true); try { if (await A.aiRepSend(c.id, p, myL.map(({ m, d }) => ({ m, d })), ldNote)) setNote(null); } finally { setBusy(false); } };
  const read = async () => { if (busy) return; setBusy(true); try { if (await A.aiRepRead(c.id, p, rdNote)) setRdNote(""); } finally { setBusy(false); } };
  const foot = myL.length ? <><textarea value={ldNote} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="리드 한마디 (이번 기간 정리 · 본부장께 부탁할 것)" aria-label="리드 한마디" style={{ ...inp, padding: "10px 12px", fontSize: 14, marginBottom: 8 }} />
      <Big disabled={busy} onClick={send}>본부장에게 보내기 · {myL.length}칸{ready < myL.length ? ` (담당 확인 ${ready})` : ""}</Big></>
    : unread ? <><input value={rdNote} onChange={(e) => setRdNote(e.target.value)} placeholder="한마디 (선택 · 리드에게)" aria-label="본부장 한마디" style={{ ...inp, padding: "10px 12px", fontSize: 14, marginBottom: 8 }} />
      <Big disabled={busy} onClick={read}>읽었어요</Big></> : null;
  return <Sheet title="AI 크루 보고" kind="보고" head={`${c.short || c.name} · ${CYCLE_L[p.cycle]} 보고`} path={`${periodL(p)} · ${dueL(p)}`} onBack={onBack} onClose={onClose} foot={foot}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 0" }}>
      <TBtn onClick={() => setPk(pv.start)} aria-label="지난 기간">‹</TBtn>
      <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 14, fontWeight: 800, color: C.ink }}>{perL ? `${perL} ` : ""}<span style={{ fontWeight: perL ? 600 : 800, color: perL ? C.sub : C.ink, fontSize: perL ? 12.5 : 14 }}>{periodL(p)}</span></div>
      <TBtn onClick={() => setPk(nx.start)} disabled={nx.start > today} aria-label="다음 기간">›</TBtn>
    </div>
    <div className="v2-repnext" style={{ margin: "10px 0 0", padding: "11px 13px", borderRadius: 12, background: late && (myW.length || myL.length) ? "#F8E9EA" : "#F7F8FB", border: `1px solid ${late && (myW.length || myL.length) ? "#E9C4C7" : C.line}`, fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>
      <b>다음 할 일</b> · {nextL}
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>담당 확인 {doneN}/{n} · 보냄 {sentN}/{n}{noOwn ? ` · 담당 미정 ${noOwn}칸` : ""} · {r.read ? `본부장 읽음 ${when(r.read.at)}` : "본부장 아직 안 읽음"}</div></div>
    <div style={{ display: "flex", alignItems: "center", margin: "16px 2px 8px" }}><b style={{ flex: 1, fontSize: 14.5, color: C.ink }}>크루 칸 {n}</b>
      <TBtn onClick={() => setAllOpen(!allOpen)} aria-pressed={allOpen}>{allOpen ? "접기" : "모두 펼치기"}</TBtn></div>
    {rows.map((row) => <SecCard key={row.m.id} D={D} cu={cu} A={A} c={c} p={p} row={row} open={open} expand={allOpen || (!row.sent && row.ppl.writers.includes(cu.id)) || row.ppl.lead === cu.id || (unread && row.sent) || rows.length <= 1} />)}
    {Object.entries(r.leads || {}).filter(([, x]) => x && x.note).map(([id, x]) => <div key={id} style={{ margin: "10px 0 0", padding: "11px 13px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, fontSize: 13.5, lineHeight: 1.6 }}><b>리드 한마디</b> · {x.byName || nameOf(D.users, id)} {when(x.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={x.note} /></div></div>)}
    {r.read && r.read.note && <div style={{ margin: "10px 0 0", padding: "11px 13px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, fontSize: 13.5, lineHeight: 1.6 }}><b>본부장 한마디</b> · {r.read.byName} {when(r.read.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={r.read.note} /></div></div>}
    <div style={{ margin: "14px 0 4px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}><CopyText text={repText(c, p, rows, r)} label="보고 글로 복사" />
      <span style={{ fontSize: 12, color: C.mute, lineHeight: 1.5, flex: "1 1 180px" }}>잔디·카톡에 붙여 넣을 때 · 보낸 칸은 보낸 때 숫자 그대로</span></div>
    {master && <div style={{ margin: "16px 0 4px", paddingTop: 12, borderTop: `1px solid ${C.line}` }}><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 13, color: C.ink }}>보고 주기 (관리자)</b>
      <div style={{ flex: "1 1 220px", maxWidth: 320 }}><div role="group" aria-label="보고 주기"><Seg items={Object.entries(CYCLE_L)} value={cfg.cycle} onChange={(v) => A.aiRepCycle(v)} /></div></div></div>
      <div style={{ fontSize: 12, color: C.mute, marginTop: 4, lineHeight: 1.5 }}>관리자만 · 한동안 주간 → 점차 월간 · 마감은 그 기간 마지막 금요일{cfg.byName ? ` · ${cfg.byName} ${md(cfg.at ? ymd(new Date(cfg.at)) : cfg.from)} 바꿈` : ""}</div></div>}
  </Sheet>;
}

function SecCard({ D, cu, A, c, p, row, open, expand }) {
  const { m, s, d, sent, ppl, st } = row, [o, setO] = useState(null), on = o === null ? expand : o;
  const can = !sent && canWriteSec(D, cu, m, ppl), [tone, bg] = ST_TONE[st];
  const [nt, setNt] = useState(null), [pl, setPl] = useState(null), [busy, setBusy] = useState(false);
  const note = nt !== null ? nt : s.note || "", plan = pl !== null ? pl : s.plan || "", dirty = (nt !== null && nt !== (s.note || "")) || (pl !== null && pl !== (s.plan || ""));
  const go = async (f) => { if (busy) return; setBusy(true); try { if (await A.aiRepSec(c.id, p, m.id, f)) { setNt(null); setPl(null); } } finally { setBusy(false); } };
  const cur = d.metrics.filter((x) => x.cur || x.prev), sumL = [...cur.slice(0, 2).map((x) => `${x.l} ${metricLine(x)}`), `실행 ${d.doneN}`, `흔적 ${d.trace.done}`].join(" · ");
  const others = ppl.writers.filter((x) => x !== ppl.owner).map((x) => nameOf(D.users, x));
  const who = !ppl.writers.length ? "담당 미정 · 담당을 정하면 보고에 들어가요" : `담당 ${ppl.owner ? nameOf(D.users, ppl.owner) : "미정"}${others.length ? ` · 같이 ${others.join("·")}` : ""} · 리드 ${nameOf(D.users, ppl.lead) || "-"}${ppl.lead === ppl.owner ? "(본인)" : ""}`;
  return <Card style={{ marginTop: 10, borderLeft: `4px solid ${m.color || C.navy}` }}>
    <button type="button" onClick={() => setO(!on)} aria-expanded={on} aria-label={`${m.slot} ${m.name} 칸`} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 15, color: C.ink }}>{m.slot} · {m.name}(AI)</b><Pill color={tone} bg={bg}>{SEC_L[st]}</Pill><span style={{ flex: 1 }} /><span style={{ color: C.navy, fontWeight: 800 }}>{on ? "▴" : "▾"}</span></div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{who}</div>
      {!on && <div style={{ fontSize: 12.5, color: C.text, marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>{sumL}</div>}
    </button>
    {on && <div style={{ padding: "0 14px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>
      <Sec t="① 실행">
        <div>실행 업무 끝냄 <b>{d.doneN}</b>{d.openN ? ` · 남음 ${d.openN}` : ""} · 흔적 <b>{d.trace.done}</b>{d.trace.skip ? ` · 안 함 ${d.trace.skip}` : ""}</div>
        <div style={{ color: C.sub, fontSize: 12.5 }}>AI 결과 올라옴 {d.asks.made} · 승인 {d.asks.ok} · 안 함 {d.asks.no}{d.asks.req ? ` · 맡긴 일 ${d.asks.req}` : ""}{d.asks.open ? ` · 아직 열림 ${d.asks.open}` : ""}</div>
        {d.done.slice(0, 5).map((t) => <div key={t.id} style={{ fontSize: 13, marginTop: 2 }}><button type="button" className="v2-lblink" onClick={() => open({ type: "task", id: t.id })} style={{ background: "none", border: "none", padding: 0, color: C.navy, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13, textDecoration: "underline", wordBreak: "break-word" }}>{t.title}</button> <span style={{ color: C.mute }}>{md(t.day)}</span></div>)}
        {d.trace.links.slice(0, 5).map((x, i) => <div key={i} style={{ fontSize: 12.5, minWidth: 0, wordBreak: "break-all" }}>{x.n !== "_" ? `${x.n} · ` : ""}<Linked text={x.link} /></div>)}
      </Sec>
      <Sec t="② 결과">{cur.length ? cur.map((x) => { const tr = trend(x); return <div key={x.k} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 140px", minWidth: 0 }}>{x.l}</span><b style={{ color: x.ok ? C.green : tr < 0 ? C.red : C.ink, fontVariantNumeric: "tabular-nums" }}>{tr > 0 ? "▲ " : tr < 0 ? "▼ " : ""}{metricLine(x)}</b></div>; })
        : <div style={{ color: C.mute }}>이번 기간 지표 값이 아직 없어요 · AI 가 크루 결과 [지표]로 올려요</div>}</Sec>
      <Sec t="③ KPI (사람이 [했어요]로 센 것)">{d.ak.length ? d.ak.map((x) => <div key={x.id}>반복 '{x.name}' <b>+{x.n}</b></div>)
        : <div style={{ color: C.mute }}>짝지은 반복 실행이 없어요 · AI 팀원 한 장 › 할 일에서 정하면 흔적 [했어요]마다 +1</div>}</Sec>
      <Sec t={`④ 다음 (${(WORD[p.cycle] || WORD.week)[2]})`}>
        {d.aiNext ? <div><span style={{ fontSize: 12.5, color: C.sub, fontWeight: 800 }}>AI 피드백{d.aiNextRun ? ` · ${md(d.aiNextRun)}` : ""}</span>{lines(d.aiNext).map((x, i) => <div key={i}>{x}</div>)}</div>
          : <div style={{ color: C.mute }}>AI 피드백 아직 없음 · 금요일 크루 결과의 [다음주] 세 줄이 여기로 와요</div>}
        {sent && (d.plan || s.plan) ? <div style={{ marginTop: 4 }}><span style={{ fontSize: 12.5, color: C.sub, fontWeight: 800 }}>사람이 더함</span>{lines(d.plan || s.plan).map((x, i) => <div key={i}>{x}</div>)}</div> : null}
      </Sec>
      {sent ? <div style={{ marginTop: 10, fontSize: 13, color: C.green, fontWeight: 800 }}>본부장에게 보냄 ✓ <span style={{ color: C.sub, fontWeight: 600 }}>{s.sent.byName} {when(s.sent.at)}{d.note ? ` · 한 줄: ${d.note}` : ""}{d.doneBy ? ` · 담당 확인 ${d.doneBy}` : ""}</span></div>
        : <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#F6F7FA" }}>
          <b style={{ fontSize: 13, color: C.ink }}>담당 확인</b> <span style={{ fontSize: 12, color: C.mute }}>위 숫자를 원래 화면(카페24·쿠팡·오늘의집…)에서 직접 보고 확인</span>
          {can ? <>
            <textarea value={note} onChange={(e) => setNt(e.target.value)} rows={2} placeholder="한 줄 — 왜 올랐나·내렸나 (숫자가 틀리면 맞는 값도)" aria-label={`${m.name} 한 줄`} style={{ ...inp, padding: "9px 11px", fontSize: 14, marginTop: 6 }} />
            <textarea value={plan} onChange={(e) => setPl(e.target.value)} rows={2} placeholder="다음 기간에 사람이 더할 것 (줄마다 하나)" aria-label={`${m.name} 다음 계획`} style={{ ...inp, padding: "9px 11px", fontSize: 14, marginTop: 6 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {st === "done" ? <><span style={{ fontSize: 13, color: C.green, fontWeight: 800 }}>다 썼어요 ✓ <span style={{ color: C.sub, fontWeight: 600 }}>{s.done.byName} {when(s.done.at)}</span></span>
                  {dirty && <TBtn v="solid" disabled={busy} onClick={() => go({ note, plan })}>고친 것 저장</TBtn>}<TBtn disabled={busy} onClick={() => go({ done: false })}>다시 고치기</TBtn></>
                : <><TBtn v="solid" disabled={busy} onClick={() => go({ note, plan, done: true })} aria-label={`${m.name} 다 썼어요`}>숫자 확인하고 다 썼어요</TBtn>{dirty && <TBtn disabled={busy} onClick={() => go({ note, plan })}>저장만</TBtn>}</>}
            </div></>
            : <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{s.done ? `다 썼어요 ✓ ${s.done.byName} ${when(s.done.at)}` : "아직 안 씀"}{s.note ? ` · ${s.note}` : ""}{s.plan ? <div style={{ whiteSpace: "pre-wrap" }}>{s.plan}</div> : null}</div>}
        </div>}
    </div>}
  </Card>;
}
const Sec = ({ t, children }) => <div style={{ marginTop: 10 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: C.navy, marginBottom: 2 }}>{t}</div>{children}</div>;
