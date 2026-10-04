// 관리자 · 사람 — 업무는 2가지로만 본다: 반복 업무(고정업무 + 행동지표) · 프로젝트 업무
// [한 주] 사람 × [반복 | 프로젝트] — 한 것 / 해야 할 것 · 못 함(지난 날) · 남음 · 가장 많이 못 한 것 (기본 화면)
// [4주] 사람 × 4주(월~일) · [모두 | 프로젝트 | 반복] · [14일] 사람 × 날 (칸 안에서만 가로 스크롤)
import { useEffect, useMemo, useState } from "react";
import * as fb from "../fb.js";
import { akQidOfWeek } from "../../../pour-os/src/actionKpi.js";
import { ymd, addDays, md, isMine, isDone, dueOf, holidayName, isOffDay, weekStart, nameOf, ownersOf } from "../model.js";
import { teamWeeks, groupItems } from "../views.js";
import { PickList } from "../pick.jsx";
import { C, Chip, Seg, TBtn, Head, Card, Row, Empty, Sheet, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";
import { Lv, SelBar, openOneOff, wdOf } from "./common.jsx";
import { weekLoad, topMiss, finAt } from "./workload.js";

const ORD = { 위험: 0, 주의: 1, 순조: 2 };
const sortRows = (rows) => rows.slice().sort((a, b) => ORD[a.level] - ORD[b.level] || b.weeks[0].n - a.weeks[0].n || String(a.u.name).localeCompare(String(b.u.name), "ko"));
const wl = (n) => (n <= 0 ? "" : n <= 5 ? " w1" : n <= 14 ? " w2" : " w3");     // 주 칸 농도 (네이비 3단계)
const dl = (n) => (n <= 0 ? "" : n <= 2 ? " w1" : n <= 5 ? " w2" : " w3");      // 하루 칸 농도 (개인 기준)
const wkL = (k) => (k === 0 ? "이번 주" : k === 1 ? "다음 주" : k === -1 ? "지난 주" : k > 0 ? `${k}주 뒤` : `${-k}주 전`);   // k = 이번 주(월~일)부터 몇 주

export function PeopleTab({ D, cu, A, idx, open, setToast }) {
  const [view0, setView] = useLocal(LS("apview3-" + cu.id), "w1"), [noTemp, setNoTemp] = useState(false), [off, setOff] = useState(0), [kind0, setKind] = useLocal(LS("apkind2-" + cu.id), "all");
  const view = ["w1", "w4", "d14"].includes(view0) ? view0 : "w1", kind = ["all", "one", "rep"].includes(kind0) ? kind0 : "all";
  const mon = weekStart(ymd(new Date())), wFrom = addDays(mon, off * 7);
  const nav = (lab) => <div className="a-wknav">
    <TBtn disabled={off <= -4} onClick={() => setOff(off - 1)}>‹ 지난 주</TBtn>
    <b>{lab}</b>
    <TBtn disabled={off >= 4} onClick={() => setOff(off + 1)}>다음 주 ›</TBtn>
    {off !== 0 && <TBtn onClick={() => setOff(0)}>이번 주로</TBtn>}
  </div>;
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: 320 }}><Seg items={[["w1", "한 주"], ["w4", "4주"], ["d14", "14일"]]} value={view} onChange={setView} /></div>
      {view !== "w1" && <Chip on={noTemp} onClick={() => setNoTemp(!noTemp)}>임시 빼기</Chip>}
    </div>
    {view === "w1" && <>{nav(`${wkL(off)} ${md(wFrom)}~${md(addDays(wFrom, 6))}`)}<WeekOne D={D} idx={idx} open={open} from={wFrom} /></>}
    {view === "w4" && <>
      <p className="a-hint" style={{ marginTop: 10 }}>주 = 월~일 · 큰 숫자 = 아직 안 한 것 · 초록 = 한 것 · 지난 주 빨강 = 못 한 것 · 이름 아래 = 이번 주 할 양(프로젝트 · 반복) · 칸을 누르면 그 주 프로젝트 업무 목록</p>
      {nav(off === 0 ? "이번 주부터 4주" : `${wkL(off)}부터 4주`)}
      <div className="v2-chips a-kinds" role="group" aria-label="무엇을 셀까">{KINDS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k !== "all" && <i className={"a-kdot " + (k === "one" ? "k1" : "k2")} />}{l}</Chip>)}</div>
      <WeekTable D={D} idx={idx} open={open} noTemp={noTemp} off={off} kind={kind} /></>}
    {view === "d14" && <><p className="a-hint" style={{ marginTop: 10 }}>숫자 = 그날 마감인 열린 프로젝트 업무 · 빨간 숫자 = 하루 8건 넘음 · 칸을 누르면 그날 일을 골라요</p><DayTable D={D} idx={idx} open={open} noTemp={noTemp} /></>}
    <p className="a-hint">반복 업무 = 고정업무(그 주 해야 할 날, 매일은 평일만 − v2 체크) + 행동지표(주 목표 = 주간 그대로 · 월간 ÷4 · 분기 ÷13 − 버전1 실적) · 프로젝트 업무 = 기한 있는 한 번짜리 일 · 위험 = 지난 일 3개 이상이거나 기한 지킴 60% 미만 · 주 한도는 이름 › 사람 보기에서</p>
  </>;
}

const doneN = (D, uid, since) => (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, uid) && finAt(t) >= since).length;

// 버전1 문서 여러 개 읽기 (행동지표 정의·분기 실적) — 읽기만
function useV1Docs(ids) {
  const k = [...new Set(ids)].sort().join(","); const [st, setSt] = useState({});
  useEffect(() => { if (!k) return undefined; const un = k.split(",").map((id) => fb.listenV1Doc(id, (d) => setSt((o) => ({ ...o, [id]: d })), () => setSt((o) => ({ ...o, [id]: null }))));
    return () => un.forEach((u) => { try { u && u(); } catch (_) {} }); }, [k]);
  return st;
}
// 고정업무 체크 기록 (v2 checks · 보이는 기간(그 달 1일부터) 한 번 읽기)
function useChecks(from) {
  const [a, setA] = useState(null);
  useEffect(() => { let live = true; setA(null); fb.fetchWhere("checks", ["date", ">=", from]).then((x) => { if (live) setA(x); }).catch((e) => { console.error("[v2 checks] 읽기 실패:", e); if (live) setA([]); }); return () => { live = false; }; }, [from]);
  return a;
}
// 반복 업무 계산 재료 (그 주들의 체크 · 행동지표 정의와 실적)
function useRepInputs(froms) {
  const first = froms.slice().sort()[0];
  const checks = useChecks(first.slice(0, 8) + "01");
  const v1 = useV1Docs(["state-actionKPIs", ...froms.map((w) => "kpi-act-" + akQidOfWeek(w))]);
  const akItems = ((v1["state-actionKPIs"] || {}).items || []).filter(Boolean);
  const akDocs = Object.fromEntries(Object.entries(v1).filter(([k]) => k.startsWith("kpi-act-")).map(([k, d]) => [k.slice(8), d || {}]));
  return { checks: checks || [], akItems, akDocs, ready: checks != null && v1["state-actionKPIs"] !== undefined };
}

// [한 주] 사람 × [반복 업무 | 프로젝트 업무]
function WeekOne({ D, idx, open, from }) {
  const key = ymd(new Date()), to = addDays(from, 6), past = to < key;
  const inp = useRepInputs([from]);
  const rows = useMemo(() => teamWeeks(D, idx, new Date(), false).map((r) => ({ u: r.u, level: r.level, late: r.late, ...weekLoad({ D, uid: r.u.id, from, key, ...inp, temp: idx.temp }) }))
    .filter((r) => r.rep.due + r.one.total > 0 || r.late)
    .map((r) => ({ ...r, bad: r.rep.miss + r.one.late + (past ? r.one.open : 0) }))
    .sort((a, b) => b.bad - a.bad || (b.rep.left + b.one.left) - (a.rep.left + a.one.left) || String(a.u.name).localeCompare(String(b.u.name), "ko")), [D, idx, from, inp.checks, inp.akItems, inp.akDocs]);
  const worst = rows.flatMap((r) => [{ r, k: "반복", n: r.rep.miss }, { r, k: "프로젝트", n: r.one.late + (past ? r.one.left : 0) }]).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  const onlyRep = rows.filter((r) => r.rep.due > 0 && r.one.total === 0).map((r) => r.u.name), onlyOne = rows.filter((r) => r.one.total > 0 && r.rep.due === 0).map((r) => r.u.name);
  const cell = (r, t) => { const x = t === "rep" ? r.rep : r.one;
    const total = t === "rep" ? x.due : x.total, done = x.done, miss = t === "rep" ? x.miss : x.late + (past ? x.left : 0), left = t === "rep" ? x.left : (past ? 0 : x.left);
    const worstT = (t === "rep" ? r.rep.miss : r.one.late) > 0 && (t === "rep" ? r.rep.miss >= r.one.late : r.one.late > r.rep.miss);
    const sub = t === "rep" ? topMiss(r.rep.items) : r.one.late ? `기한 지남 ${r.one.late}` : "";
    const go = t === "rep" ? () => open({ type: "arep", uid: r.u.id, from }) : () => open({ type: "apick", uid: r.u.id, from, to, ...(x.open ? {} : { show: "done" }) });
    if (!total) return <div className="a-k none">{t === "rep" ? "반복 업무 없음" : "이번 주 맡은 일 없음"}</div>;
    return <button type="button" className={"a-k" + (worstT ? " bad" : "")} onClick={go} aria-label={`${r.u.name} ${t === "rep" ? "반복 업무" : "프로젝트 업무"} ${done}/${total}${miss ? `, 못 함 ${miss}` : ""}${left ? `, 남음 ${left}` : ""}`}>
      <span className="v"><b>{done}</b><small>/{total}</small></span>
      <span className="bar"><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></span>
      <span className="st">{miss ? <em className="m">못 함 {miss}</em> : null}{left ? <em className="l">{past ? "" : "남음 "}{left}</em> : null}{!miss && !left ? <em className="ok">다 함</em> : null}</span>
      {sub && <span className="d">{sub}</span>}
    </button>; };
  return <>
    <div className="a-sumtop">{!inp.ready ? "반복 업무 기록을 불러오는 중…" : worst.length ? <>못 한 게 많은 사람: <b>{worst.map((x) => `${x.r.u.name} ${x.k} ${x.n}`).join(" · ")}</b></> : past ? "이 주에 못 한 일이 없어요" : "지금까지 못 한 일이 없어요"}
      {(onlyRep.length > 0 || onlyOne.length > 0) && <div className="s">{[onlyRep.length ? `반복 업무만: ${onlyRep.join(", ")}` : "", onlyOne.length ? `프로젝트 업무만: ${onlyOne.join(", ")}` : ""].filter(Boolean).join(" · ")}</div>}</div>
    <div className="a-one" role="table" aria-label="사람별 한 주 반복·프로젝트 업무">
      <div className="a-oner hd" role="row"><span role="columnheader">이름</span><span role="columnheader"><i className="a-kdot k2" />반복 업무</span><span role="columnheader"><i className="a-kdot k1" />프로젝트 업무</span></div>
      {rows.map((r) => <div key={r.u.id} className="a-oner" role="row">
        <button type="button" className="a-onen" onClick={() => open({ type: "person", id: r.u.id })}><b>{r.u.name}</b><Lv v={r.level} small /></button>
        {cell(r, "rep")}{cell(r, "one")}
      </div>)}
      {rows.length === 0 && <Card><Empty>이 주에 할 일이 있는 사람이 없어요</Empty></Card>}
    </div>
    <p className="a-hint">칸 = 한 것 / 해야 할 것 · 초록 막대 = 해낸 비율 · 못 함 = 지난 날에 안 한 것 · 남음 = 오늘부터 남은 것 · 칸 아래 회색 = 가장 많이 못 한 것 · 반복 칸을 누르면 항목별로, 프로젝트 칸을 누르면 업무 목록(담당 바꾸기 가능)</p>
  </>;
}

// 반복 업무 한 사람 한 주: 고정업무는 요일 칸(✓ 함 · 빨강 못 함 · 흐림 남음), 행동지표는 목표 · 실적
export function RepSheet({ D, idx, open, onBack, onClose, s }) {
  const key = ymd(new Date()), u = (D.users || []).find((x) => x.id === s.uid);
  const inp = useRepInputs([s.from]);
  const L = useMemo(() => weekLoad({ D, uid: s.uid, from: s.from, key, ...inp, temp: idx && idx.temp }), [D, s.uid, s.from, inp.checks, inp.akItems, inp.akDocs]);
  const items = L.rep.items.slice().sort((a, b) => b.miss - a.miss || b.left - a.left || String(a.title).localeCompare(String(b.title), "ko"));
  const fx = items.filter((x) => x.kind === "fx"), ak = items.filter((x) => x.kind === "ak");
  const st = (x) => (x.miss ? <b className="m">못 함 {x.miss}</b> : x.left ? <b className="l">남음 {x.left}</b> : <b className="ok">다 함</b>);
  return <Sheet title={`${u ? u.name : "사람"} · 반복 업무 · ${md(s.from)}~${md(addDays(s.from, 6))}`} onBack={onBack} onClose={onClose}>
    <div className="a-repsum">한 것 <b>{L.rep.done}</b> / {L.rep.due}{L.rep.miss ? <> · <em className="m">못 함 {L.rep.miss}</em></> : null}{L.rep.left ? <> · 남음 {L.rep.left}</> : null}{!inp.ready ? " · 불러오는 중…" : ""}</div>
    <Head>고정업무 {fx.length}</Head>
    <Card>{fx.length === 0 ? <Empty>이 주에 할 고정업무가 없어요</Empty> : fx.map((x, i) => <button key={x.id} type="button" className="a-reprow" style={{ borderBottom: i < fx.length - 1 ? `1px solid ${C.line}` : "none" }} onClick={() => open({ type: "fixed", id: x.id })}>
      <span className="t">{x.title}</span>
      <span className="days">{x.days.map((d) => <i key={d.d} className={d.state} title={md(d.d)}>{d.state === "ok" ? "✓" : d.wd}</i>)}</span>{st(x)}</button>)}</Card>
    <Head>행동지표 {ak.length}</Head>
    <Card>{ak.length === 0 ? <Empty>맡은 행동지표가 없어요</Empty> : ak.map((x, i) => <div key={x.id} className="a-reprow" style={{ borderBottom: i < ak.length - 1 ? `1px solid ${C.line}` : "none" }}>
      <span className="t">{x.title}<small>{x.cyc === "W" ? "주간" : x.cyc === "Q" ? "분기 ÷13" : "월간 ÷4"} · 이 주 목표 {x.due}{x.unit} · 실적 {x.got}</small></span>{st(x)}</div>)}</Card>
    <p className="a-hint">고정업무 체크는 v2 에서 한 것만 · 행동지표 실적은 버전1 반복 실행 기록(읽기만) · 고정업무 줄을 누르면 그 업무</p>
  </Sheet>;
}

// 사람 × 4주 표 (한눈에 1280 에서도 같이 씀) — 주 = 월~일
//  칸 큰 숫자 = 그 주 아직 안 한 것 (프로젝트: 마감인 열린 일 · 반복: 해야 할 것 − 한 것), 초록 '완료' = 그 주에 한 것
const KINDS = [["all", "모두"], ["one", "프로젝트 업무"], ["rep", "반복 업무"]];
export function WeekTable({ D, idx, open, noTemp, off = 0, kind = "one" }) {
  const now = new Date(), key = ymd(now), mon = weekStart(key);
  const wkKeys = [0, 1, 2, 3].map((i) => addDays(mon, (off + i) * 7));
  const inp = useRepInputs(wkKeys);
  const rows = useMemo(() => { const d7 = new Date(now - 7 * 864e5).toISOString();
    return sortRows(teamWeeks(D, idx, now, noTemp, off, mon)).map((r) => {
      const weeks = r.weeks.map((w) => { const L = weekLoad({ D, uid: r.u.id, from: w.from, key, ...inp, temp: idx.temp, noTemp });
        return { ...w, one: { left: w.n, done: L.one.done }, rep: { left: L.rep.miss + L.rep.left, done: L.rep.done, due: L.rep.due } }; });
      const w0 = weeks.find((w) => w.from <= key && key <= w.to) || null;
      return { ...r, done7: doneN(D, r.u.id, d7), weeks, mix: w0 ? { one: w0.one.left + w0.one.done, rep: w0.rep.due } : null };
    }); }, [D, idx, noTemp, off, inp.checks, inp.akItems, inp.akDocs]);
  const pick = (w) => kind === "all" ? { left: w.one.left + w.rep.left, done: w.one.done + w.rep.done } : w[kind];
  return <div className="a-wk" role="table" aria-label="사람별 4주">
    <div className="a-wkr hd" role="row">
      <span role="columnheader">이름</span><span role="columnheader">지남</span>
      {[0, 1, 2, 3].map((i) => <span key={i} role="columnheader">{wkL(off + i)}<small>{md(wkKeys[i])}~</small></span>)}
    </div>
    {rows.map((r) => <div key={r.u.id} className="a-wkr" role="row">
      <button type="button" className="a-wkn" onClick={() => open({ type: "person", id: r.u.id })} aria-label={`${r.u.name} 사람 보기 · ${r.level}`}>
        <span className="l1"><b>{r.u.name}</b></span>
        <span className="l2"><Lv v={r.level} small /><span style={r.doing >= 6 ? { color: C.ink, fontWeight: 800 } : null}>진행 {r.doing}</span></span>
        {r.mix && <span className="l2 a-mix" title="이번 주 할 양: 프로젝트 업무 · 반복 업무"><i className="k1" />{r.mix.one}<i className="k2" />{r.mix.rep}</span>}
        <span className="l2"><span className="a-dn">완료 {r.done7}</span></span>
        {r.noDue > 0 && <span className="l2">기한 없음 {r.noDue}</span>}
      </button>
      <button type="button" className="a-wc late" disabled={!r.late} onClick={() => open({ type: "apick", uid: r.u.id, late: true, noTemp })} aria-label={`${r.u.name} 지난 일 ${r.late}건`}>
        <b style={{ color: r.late ? C.red : C.mute }}>{r.late || "-"}</b></button>
      {r.weeks.map((w, i) => { const v = pick(w), overCap = kind === "one" && w.one.left > r.cap, past = w.to < key;
        const tot = w.one.left + w.one.done + w.rep.due;
        const go = kind === "rep" ? () => open({ type: "arep", uid: r.u.id, from: w.from }) : () => open({ type: "apick", uid: r.u.id, from: w.from, to: w.to, noTemp, ...(w.one.left ? {} : { show: "done" }) });
        return <button key={i} type="button" className={"a-wc" + (past ? " past" : kind === "all" ? (v.left <= 0 ? "" : v.left <= 15 ? " w1" : v.left <= 40 ? " w2" : " w3") : wl(v.left))} onClick={go}
          aria-label={`${r.u.name} ${wkL(off + i)} · 프로젝트 남음 ${w.one.left} 완료 ${w.one.done} · 반복 남음 ${w.rep.left} 한 것 ${w.rep.done}${overCap ? ` · 주 한도 ${r.cap} 넘음` : ""}`}>
          <b className={overCap ? "over" : ""} style={past && v.left ? { color: C.red } : null}>{v.left || "-"}</b>
          {v.done > 0 && <small className="dn">완료 {v.done}</small>}
          {kind === "all" && tot > 0 && <span className="a-mixbar" aria-hidden="true"><i className="k1" style={{ flexGrow: w.one.left + w.one.done }} /><i className="k2" style={{ flexGrow: w.rep.due }} /></span>}
          {kind === "one" && !noTemp && w.temp > 0 && <small>임시 {w.temp}</small>}</button>; })}
    </div>)}
  </div>;
}

// 끝낸 일 목록 (보기만)
export function DoneSheet({ D, open, onBack, onClose, s }) {
  const u = (D.users || []).find((x) => x.id === s.uid);
  const list = (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, s.uid) && finAt(t) >= s.since && (!s.until || finAt(t) < s.until)).sort((a, b) => finAt(b).localeCompare(finAt(a)));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "";
  return <Sheet title={`${u ? u.name : "사람"} · 완료 ${list.length}건 · ${s.label}`} onBack={onBack} onClose={onClose}>
    <Card style={{ marginTop: 12 }}>{list.length === 0 ? <Empty>끝낸 일이 없어요</Empty> : list.map((t, i) => <Row key={t.id} title={t.title} tag={`✓ ${md(finAt(t).slice(0, 10))}`} sub={pn(t) || "프로젝트 없음"} onClick={() => open({ type: "task", id: t.id })} last={i === list.length - 1} />)}</Card>
  </Sheet>;
}

// 사람 × 14일 표 (칸 안에서만 가로 스크롤 · 768 이상은 펼침)
function DayTable({ D, idx, open, noTemp }) {
  const now = new Date(), key = ymd(now);
  const days = [...Array(14)].map((_, i) => addDays(key, i));
  const rows = useMemo(() => sortRows(teamWeeks(D, idx, now, noTemp)).map((r) => {
    const by = {}; (D.tasks || []).forEach((t) => { if (!openOneOff(t) || !isMine(t, r.u.id) || (noTemp && idx.temp.has(t.id))) return; const d = dueOf(t); if (d) by[d] = (by[d] || 0) + 1; });
    return { ...r, by }; }), [D, idx, noTemp]);
  return <div className="v2-hscroll a-d14wrap">
    <div className="a-d14" role="table" aria-label="사람별 14일 마감">
      <div className="a-d14r hd" role="row"><span role="columnheader">이름</span>{days.map((d) => <span key={d} role="columnheader" className={isOffDay(d) ? "off" : ""} title={holidayName(d) || undefined}>{d === key ? "오늘" : md(d)}<small>{wdOf(d)}</small></span>)}</div>
      {rows.map((r) => <div key={r.u.id} className="a-d14r" role="row">
        <button type="button" className="a-d14n" onClick={() => open({ type: "person", id: r.u.id })}><b>{r.u.name}</b></button>
        {days.map((d) => { const n = r.by[d] || 0;
          return <button key={d} type="button" className={"a-dc" + dl(n) + (isOffDay(d) ? " off" : "")} disabled={!n} onClick={() => open({ type: "apick", uid: r.u.id, from: d, to: d, noTemp })} aria-label={`${r.u.name} ${md(d)} ${n}건${n > 8 ? ", 하루 8건 넘음" : ""}`}>
            <b className={n > 8 ? "over" : ""}>{n || ""}</b></button>; })}
      </div>)}
    </div>
  </div>;
}

// 사람 한 명의 한 주(또는 하루 · 지난 일) 업무 고르기 → 한꺼번에 바꾸기
export function PickSheet({ D, cu, A, idx, open, onBack, onClose, setToast, s }) {
  const key = ymd(new Date());
  const [only, setOnly] = useState(s.show === "done" ? "done" : s.noTemp ? "real" : "all"), [sel, setSel] = useState(() => new Set());
  const u = (D.users || []).find((x) => x.id === s.uid);
  const pset = s.pids ? new Set(s.pids) : null;
  const who = (t) => (!s.uid || isMine(t, s.uid)) && (!pset || pset.has(t.projectId));   // 사람 하나 · 또는 프로젝트 묶음(카테고리 표)
  const base = (D.tasks || []).filter((t) => openOneOff(t) && who(t) && (s.late ? dueOf(t) && dueOf(t) < key : dueOf(t) >= s.from && dueOf(t) <= s.to));
  const tempN = base.filter((t) => idx.temp.has(t.id)).length;
  // 그 기간에 끝낸 일 (보기만 · 지난 일 묶음에는 없음)
  const iso = (d) => new Date(d + "T00:00:00").toISOString();
  const doneL = s.late ? [] : (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && who(t) && finAt(t) >= iso(s.from) && finAt(t) < iso(addDays(s.to, 1))).sort((a, b) => finAt(b).localeCompare(finAt(a)));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "";
  const items = only === "done" ? [] : only === "temp" ? base.filter((t) => idx.temp.has(t.id)) : only === "real" ? base.filter((t) => !idx.temp.has(t.id)) : base;
  const groups = groupItems(items, "project", D);
  const range = s.late ? "지난 일" : s.from === s.to ? `${md(s.from)} (${wdOf(s.from)})` : `${md(s.from)}~${md(s.to)}`;
  // 칩을 바꾸면 고른 것도 풀기 · 막대에는 지금 보이는 줄에서 고른 것만 (안 보이는 일이 같이 바뀌지 않게)
  const only1 = (k) => { setOnly(k); setSel(new Set()); };
  const ids = new Set(items.map((t) => t.id)), selV = new Set([...sel].filter((id) => ids.has(id)));
  const all = items.length > 0 && items.every((t) => sel.has(t.id));
  const openL = s.late ? "지난 일" : s.to < key ? "못 끝낸 일" : "할 일";
  return <Sheet title={`${s.label || (u ? u.name : "사람")} · ${range} · ${base.length}건`} onBack={onBack} onClose={onClose}>
    <div className="v2-chips" style={{ marginTop: 12 }}>
      <Chip on={only === "all"} onClick={() => only1("all")}>{openL} {base.length}</Chip>
      {!s.late && <Chip on={only === "done"} onClick={() => only1("done")}>완료 {doneL.length}</Chip>}
      {tempN > 0 && <Chip on={only === "temp"} onClick={() => only1("temp")}>임시만 {tempN}</Chip>}
      {tempN > 0 && <Chip on={only === "real"} onClick={() => only1("real")}>진짜 일만 {base.length - tempN}</Chip>}
      <span style={{ flex: 1 }} />
      {only !== "done" && items.length > 0 && <TBtn onClick={() => setSel(all ? new Set() : new Set(items.map((t) => t.id)))}>{all ? "모두 풀기" : `모두 고르기 ${items.length}`}</TBtn>}
    </div>
    {only === "done" ? <Card style={{ marginTop: 12 }}>{doneL.length === 0 ? <Empty>이 기간에 끝낸 일이 없어요</Empty> : doneL.map((t, i) => <Row key={t.id} title={t.title} tag={`✓ ${md(finAt(t).slice(0, 10))}`} sub={[pn(t) || "프로젝트 없음", s.uid ? "" : nameOf(D.users, ownersOf(t)[0])].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: t.id })} last={i === doneL.length - 1} />)}</Card>
      : items.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>고른 조건에 맞는 일이 없어요</Empty></Card>
      : <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} />}
    <p className="a-hint">{only === "done" ? "끝낸 일은 보기만 해요 · 누르면 그 업무" : "담당을 바꿔도 맡긴 사람은 그대로예요. 받는 사람 화면에는 '항목 n개 맡김' 한 줄로 떠요."}</p>
    <SelBar D={D} cu={cu} A={A} sel={selV} setSel={setSel} setToast={setToast} />
  </Sheet>;
}
