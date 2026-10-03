// 관리자 · 사람 — 누가 넘치나, 누가 오래 밀렸나, 누가 너무 많이 벌였나
// 사람 × [지남 | 이번 주 | 다음 주 | 2주 뒤 | 3주 뒤] (오늘부터 7일씩) (375 에서 328px 안, 가로 스크롤 없음) · [14일] 은 사람 × 날 (칸 안에서만 가로 스크롤)
import { useMemo, useState } from "react";
import { ymd, addDays, md, isMine, isDone, dueOf, holidayName, isOffDay, ddays, activeUsers, projOpen, projCat, PROJ_CATS } from "../model.js";
import { teamWeeks, groupItems } from "../views.js";
import { PickList } from "../pick.jsx";
import { C, Chip, Seg, TBtn, Head, Card, Row, Empty, Sheet, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";
import { Lv, SelBar, openOneOff, wdOf } from "./common.jsx";

const ORD = { 위험: 0, 주의: 1, 순조: 2 };
const sortRows = (rows) => rows.slice().sort((a, b) => ORD[a.level] - ORD[b.level] || b.weeks[0].n - a.weeks[0].n || String(a.u.name).localeCompare(String(b.u.name), "ko"));
const wl = (n) => (n <= 0 ? "" : n <= 5 ? " w1" : n <= 14 ? " w2" : " w3");     // 주 칸 농도 (네이비 3단계)
const dl = (n) => (n <= 0 ? "" : n <= 2 ? " w1" : n <= 5 ? " w2" : " w3");      // 하루 칸 농도 (개인 기준)
const WEEK_L = ["이번 주", "다음 주", "2주 뒤", "3주 뒤"];   // 오늘부터 7일 · 8~14일 · 15~21일 · 22~28일 (칸 아래 시작 날짜)

export function PeopleTab({ D, cu, A, idx, open, setToast }) {
  const [view, setView] = useLocal(LS("apview-" + cu.id), "sum"), [noTemp, setNoTemp] = useState(false);
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 180px", maxWidth: 260 }}><Seg items={[["sum", "한눈에"], ["w4", "4주"], ["d14", "14일"]]} value={view} onChange={setView} /></div>
      <Chip on={noTemp} onClick={() => setNoTemp(!noTemp)}>임시 빼기</Chip>
    </div>
    {view === "sum" ? <SumTable D={D} idx={idx} open={open} noTemp={noTemp} /> : <><p className="a-hint" style={{ marginTop: 10 }}>{view === "w4" ? "숫자 = 그 주 마감인 열린 일(고정업무·확인 대기 제외) · 빨간 숫자 = 주 한도 넘음 · 칸을 누르면 그 주 일을 골라 나눠요 · 이름을 누르면 사람 보기" : "숫자 = 그날 마감인 열린 일 · 빨간 숫자 = 하루 8건 넘음 · 칸을 누르면 그날 일을 골라요"}</p>
    {view === "w4" ? <WeekTable D={D} idx={idx} open={open} noTemp={noTemp} /> : <DayTable D={D} idx={idx} open={open} noTemp={noTemp} />}</>}
    <p className="a-hint">위험 = 지난 일 3개 이상이거나 기한 지킴 60% 미만 · 주의 = 지난 일·시작 전 일이 있거나 한 주 15건 이상 · 주 한도는 이름 › 사람 보기에서 고쳐요</p>
  </>;
}

// 사람 × [완료 | 지남 | 할 일] 한 표 — 기간(1주·2주·4주·이번 달) · 프로젝트/카테고리 거르기
//  완료 = 기간 안에 끝낸 일(지난 n일) · 지남 = 지금 기한 지난 열린 일 · 할 일 = 오늘부터 기간 안 마감인 열린 일 (고정업무·보류·확인 대기 제외)
//  과중 = 할 일이 주 한도 × 기간 주 수를 넘음 (빨강)
const finAt = (t) => String(t.finishedAt || t.doneAt || "");
const PERIODS = [["w1", "1주", 7], ["w2", "2주", 14], ["w4", "4주", 28], ["m", "이번 달", 0]];
export const pfMatch = (D, pf) => { if (!pf) return () => true;
  if (pf.startsWith("cat:")) { const k = pf.slice(4), ids = new Set((D.projects || []).filter((p) => projCat(p) === k).map((p) => p.id)); return (t) => ids.has(t.projectId); }
  return (t) => t.projectId === pf; };
function SumTable({ D, idx, open, noTemp }) {
  const [per, setPer] = useLocal(LS("apper"), "w1"), [pf, setPf] = useLocal(LS("appf"), "");
  const now = new Date(), key = ymd(now);
  const P = PERIODS.find((x) => x[0] === per) || PERIODS[0];
  const end = P[2] ? addDays(key, P[2] - 1) : (() => { const d = new Date(now.getFullYear(), now.getMonth() + 1, 0); return ymd(d); })();
  const since = P[2] ? new Date(now - P[2] * 864e5).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weeksN = Math.max(1, Math.round(((P[2] || ddays(end, key) + 1)) / 7 * 10) / 10);
  const projs = (D.projects || []).filter(projOpen).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko"));
  const pf1 = !pf || pf.startsWith("cat:") || projs.some((p) => p.id === pf) ? pf : "";
  const inP = pfMatch(D, pf1);
  const rows = useMemo(() => activeUsers(D.users).map((u) => {
    const mine = (D.tasks || []).filter((t) => !t.isFixed && isMine(t, u.id) && inP(t) && !(noTemp && idx.temp.has(t.id)));
    const done = mine.filter((t) => isDone(t) && finAt(t) >= since).length;
    const open = mine.filter((t) => openOneOff(t));
    const late = open.filter((t) => dueOf(t) && dueOf(t) < key).length;
    const todo = open.filter((t) => dueOf(t) >= key && dueOf(t) <= end).length;
    const noDue = open.filter((t) => !dueOf(t)).length;
    const cap = Math.round((Number(u.weekCap) || 15) * weeksN);
    return { u, done, late, todo, noDue, cap, over: todo > cap };
  }).filter((r) => !pf1 || r.done || r.late || r.todo || r.noDue)
    .sort((a, b) => (b.over ? 1 : 0) - (a.over ? 1 : 0) || b.late - a.late || b.todo - a.todo || String(a.u.name).localeCompare(String(b.u.name), "ko")), [D, idx, noTemp, per, pf1]);
  const sum = rows.reduce((a, r) => ({ done: a.done + r.done, late: a.late + r.late, todo: a.todo + r.todo }), { done: 0, late: 0, todo: 0 });
  const over = rows.filter((r) => r.over);
  return <>
    <div className="a-sumbar">
      <div className="v2-chips" role="group" aria-label="기간">{PERIODS.map(([k, l]) => <Chip key={k} on={per === k} onClick={() => setPer(k)}>{l}</Chip>)}</div>
      <select aria-label="프로젝트 거르기" className="v2-sel a-pfsel" value={pf1} onChange={(e) => setPf(e.target.value)}>
        <option value="">모든 프로젝트</option>
        <optgroup label="카테고리">{PROJ_CATS.map(([k, l]) => <option key={k} value={"cat:" + k}>{l}</option>)}</optgroup>
        <optgroup label="프로젝트">{projs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>
      </select>
    </div>
    <div className={"a-sumtop" + (over.length ? " over" : "")}>{over.length ? `과중 ${over.length}명 · ${over.map((r) => `${r.u.name} ${r.todo}/${r.cap}`).join(" · ")}` : "주 한도를 넘는 사람이 없어요"}</div>
    <div className="a-st" role="table" aria-label="사람별 완료·지남·할 일">
      <div className="a-str hd" role="row"><span role="columnheader">이름</span><span role="columnheader">완료<small>지난 {P[2] ? P[1] : "이번 달"}</small></span><span role="columnheader">지남<small>지금</small></span><span role="columnheader">할 일<small>~{md(end)}</small></span></div>
      <div className="a-str tot" role="row"><span>팀 합계</span><span><b>{sum.done}</b></span><span><b style={{ color: sum.late ? C.red : C.mute }}>{sum.late}</b></span><span><b>{sum.todo}</b></span></div>
      {rows.map((r) => <div key={r.u.id} className="a-str" role="row">
        <button type="button" className="a-stn" onClick={() => open({ type: "person", id: r.u.id })}><b>{r.u.name}</b>{r.over && <span className="a-overtag">과중</span>}{r.noDue > 0 && <small>기한 없음 {r.noDue}</small>}</button>
        <button type="button" className="a-stc done" disabled={!r.done} onClick={() => open({ type: "adone", uid: r.u.id, since, pf: pf1, label: P[2] ? `지난 ${P[1]}` : "이번 달" })} aria-label={`${r.u.name} 완료 ${r.done}건`}><b>{r.done || "-"}</b></button>
        <button type="button" className="a-stc" disabled={!r.late} onClick={() => open({ type: "apick", uid: r.u.id, late: true, noTemp, pf: pf1 })} aria-label={`${r.u.name} 지난 일 ${r.late}건`}><b style={{ color: r.late ? C.red : C.mute }}>{r.late || "-"}</b></button>
        <button type="button" className={"a-stc" + (r.over ? " over" : "")} disabled={!r.todo} onClick={() => open({ type: "apick", uid: r.u.id, from: key, to: end, noTemp, pf: pf1 })} aria-label={`${r.u.name} 할 일 ${r.todo}건 · 한도 ${r.cap}`}><b>{r.todo || "-"}</b>{r.todo > 0 && <small>/{r.cap}</small>}</button>
      </div>)}
      {rows.length === 0 && <div className="a-str"><span style={{ gridColumn: "1 / -1", color: C.mute, fontSize: 13.5 }}>고른 프로젝트에 맡은 사람이 없어요</span></div>}
    </div>
    <p className="a-hint">완료 = 기간 안에 끝낸 일 · 지남 = 기한 지난 열린 일 · 할 일 = 오늘부터 {md(end)}까지 마감인 열린 일 / 한도(주 한도 × {weeksN}주) · 고정업무·보류·확인 대기 제외 · 숫자를 누르면 그 일 목록, 이름을 누르면 사람 보기</p>
  </>;
}

// 끝낸 일 목록 (보기만)
export function DoneSheet({ D, open, onBack, onClose, s }) {
  const u = (D.users || []).find((x) => x.id === s.uid), inP = pfMatch(D, s.pf);
  const list = (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, s.uid) && inP(t) && finAt(t) >= s.since).sort((a, b) => finAt(b).localeCompare(finAt(a)));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "";
  return <Sheet title={`${u ? u.name : "사람"} · 완료 ${list.length}건 · ${s.label}`} onBack={onBack} onClose={onClose}>
    <Card style={{ marginTop: 12 }}>{list.length === 0 ? <Empty>끝낸 일이 없어요</Empty> : list.map((t, i) => <Row key={t.id} title={t.title} tag={`✓ ${md(finAt(t).slice(0, 10))}`} sub={pn(t) || "프로젝트 없음"} onClick={() => open({ type: "task", id: t.id })} last={i === list.length - 1} />)}</Card>
  </Sheet>;
}

// 사람 × 4주 표 (한눈에 1280 에서도 같이 씀)
export function WeekTable({ D, idx, open, noTemp }) {
  const now = new Date(), key = ymd(now);
  const rows = useMemo(() => sortRows(teamWeeks(D, idx, now, noTemp)), [D, idx, noTemp]);
  return <div className="a-wk" role="table" aria-label="사람별 4주 마감">
    <div className="a-wkr hd" role="row">
      <span role="columnheader">이름</span><span role="columnheader">지남</span>
      {WEEK_L.map((l, i) => <span key={l} role="columnheader">{l}<small>{md(addDays(key, i * 7))}~</small></span>)}
    </div>
    {rows.map((r) => <div key={r.u.id} className="a-wkr" role="row">
      <button type="button" className="a-wkn" onClick={() => open({ type: "person", id: r.u.id })} aria-label={`${r.u.name} 사람 보기 · ${r.level}`}>
        <span className="l1"><b>{r.u.name}</b></span>
        <span className="l2"><Lv v={r.level} small /><span style={r.doing >= 6 ? { color: C.ink, fontWeight: 800 } : null}>진행 {r.doing}</span></span>
        {r.noDue > 0 && <span className="l2">기한 없음 {r.noDue}</span>}
      </button>
      <button type="button" className="a-wc late" disabled={!r.late} onClick={() => open({ type: "apick", uid: r.u.id, late: true, noTemp })} aria-label={`${r.u.name} 지난 일 ${r.late}건`}>
        <b style={{ color: r.late ? C.red : C.mute }}>{r.late || "-"}</b></button>
      {r.weeks.map((w, i) => { const overCap = w.n > r.cap;
        return <button key={i} type="button" className={"a-wc" + wl(w.n)} disabled={!w.n} onClick={() => open({ type: "apick", uid: r.u.id, from: w.from, to: w.to, noTemp })}
          aria-label={`${r.u.name} ${WEEK_L[i]} ${w.n}건${!noTemp && w.temp ? `, 임시 ${w.temp}` : ""}${overCap ? `, 주 한도 ${r.cap} 넘음` : ""}`}>
          <b className={overCap ? "over" : ""}>{w.n || "-"}</b>{!noTemp && w.temp > 0 && <small>임시 {w.temp}</small>}</button>; })}
    </div>)}
  </div>;
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
  const [only, setOnly] = useState(s.noTemp ? "real" : "all"), [sel, setSel] = useState(() => new Set());
  const u = (D.users || []).find((x) => x.id === s.uid);
  const inP = pfMatch(D, s.pf), base = (D.tasks || []).filter((t) => openOneOff(t) && isMine(t, s.uid) && inP(t) && (s.late ? dueOf(t) && dueOf(t) < key : dueOf(t) >= s.from && dueOf(t) <= s.to));
  const tempN = base.filter((t) => idx.temp.has(t.id)).length;
  const items = only === "temp" ? base.filter((t) => idx.temp.has(t.id)) : only === "real" ? base.filter((t) => !idx.temp.has(t.id)) : base;
  const groups = groupItems(items, "project", D);
  const range = s.late ? "지난 일" : s.from === s.to ? `${md(s.from)} (${wdOf(s.from)})` : `${md(s.from)}~${md(s.to)}`;
  // 칩을 바꾸면 고른 것도 풀기 · 막대에는 지금 보이는 줄에서 고른 것만 (안 보이는 일이 같이 바뀌지 않게)
  const only1 = (k) => { setOnly(k); setSel(new Set()); };
  const ids = new Set(items.map((t) => t.id)), selV = new Set([...sel].filter((id) => ids.has(id)));
  const all = items.length > 0 && items.every((t) => sel.has(t.id));
  return <Sheet title={`${u ? u.name : "사람"} · ${range} · ${base.length}건${tempN ? `(임시 ${tempN})` : ""}`} onBack={onBack} onClose={onClose}>
    <div className="v2-chips" style={{ marginTop: 12 }}>
      <Chip on={only === "all"} onClick={() => only1("all")}>전체 {base.length}</Chip>
      {tempN > 0 && <Chip on={only === "temp"} onClick={() => only1("temp")}>임시만 {tempN}</Chip>}
      {tempN > 0 && <Chip on={only === "real"} onClick={() => only1("real")}>진짜 일만 {base.length - tempN}</Chip>}
      <span style={{ flex: 1 }} />
      {items.length > 0 && <TBtn onClick={() => setSel(all ? new Set() : new Set(items.map((t) => t.id)))}>{all ? "모두 풀기" : `모두 고르기 ${items.length}`}</TBtn>}
    </div>
    {items.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>고른 조건에 맞는 일이 없어요</Empty></Card>
      : <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} />}
    <p className="a-hint">담당을 바꿔도 맡긴 사람은 그대로예요. 받는 사람 화면에는 '항목 n개 맡김' 한 줄로 떠요.</p>
    <SelBar D={D} cu={cu} A={A} sel={selV} setSel={setSel} setToast={setToast} />
  </Sheet>;
}
