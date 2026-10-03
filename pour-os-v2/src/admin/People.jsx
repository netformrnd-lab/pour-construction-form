// 관리자 · 사람 — 누가 넘치나, 누가 오래 밀렸나, 누가 너무 많이 벌였나
// 사람 × [지남 | 이번 주 | 다음 주 | 2주 뒤 | 3주 뒤] (오늘부터 7일씩) (375 에서 328px 안, 가로 스크롤 없음) · [14일] 은 사람 × 날 (칸 안에서만 가로 스크롤)
import { useEffect, useMemo, useState } from "react";
import * as fb from "../fb.js";
import { akQidOfWeek, akBy, akWho, akStart } from "../../../pour-os/src/actionKpi.js";
import { ymd, addDays, md, isMine, isDone, dueOf, holidayName, isOffDay, weekStart, fxPeople, fxDueOn } from "../model.js";
import { teamWeeks, groupItems } from "../views.js";
import { PickList } from "../pick.jsx";
import { C, Chip, Seg, TBtn, Head, Card, Row, Empty, Sheet, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";
import { Lv, SelBar, openOneOff, wdOf } from "./common.jsx";

const ORD = { 위험: 0, 주의: 1, 순조: 2 };
const sortRows = (rows) => rows.slice().sort((a, b) => ORD[a.level] - ORD[b.level] || b.weeks[0].n - a.weeks[0].n || String(a.u.name).localeCompare(String(b.u.name), "ko"));
const wl = (n) => (n <= 0 ? "" : n <= 5 ? " w1" : n <= 14 ? " w2" : " w3");     // 주 칸 농도 (네이비 3단계)
const dl = (n) => (n <= 0 ? "" : n <= 2 ? " w1" : n <= 5 ? " w2" : " w3");      // 하루 칸 농도 (개인 기준)
const wkL = (k) => (k === 0 ? "이번 주" : k === 1 ? "다음 주" : k === -1 ? "지난 주" : k > 0 ? `${k}주 뒤` : `${-k}주 전`);   // k = 이번 주(월~일)부터 몇 주   // 오늘부터 7일 · 8~14일 · 15~21일 · 22~28일 (칸 아래 시작 날짜)

export function PeopleTab({ D, cu, A, idx, open, setToast }) {
  const [view, setView] = useLocal(LS("apview2-" + cu.id), "w4"), [noTemp, setNoTemp] = useState(false), [off, setOff] = useState(0), [kind, setKind] = useLocal(LS("apkind-" + cu.id), "all");
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 180px", maxWidth: 260 }}><Seg items={[["w4", "4주"], ["d14", "14일"]]} value={view} onChange={setView} /></div>
      <Chip on={noTemp} onClick={() => setNoTemp(!noTemp)}>임시 빼기</Chip>
    </div>
    <><p className="a-hint" style={{ marginTop: 10 }}>{view === "w4" ? "주 = 월~일 · 큰 숫자 = 아직 안 한 것 · 초록 = 한 것 · 지난 주 빨강 = 못 한 것 · 이름 아래 = 이번 주 할 양(업무 · 고정업무 · 행동지표) · 칸 아래 막대 = 그 주 섞임 · 칸을 누르면 그 주 업무 목록" : "숫자 = 그날 마감인 열린 일 · 빨간 숫자 = 하루 8건 넘음 · 칸을 누르면 그날 일을 골라요"}</p>
    {view === "w4" && <div className="a-wknav">
      <TBtn disabled={off <= -4} onClick={() => setOff(off - 1)}>‹ 지난 주</TBtn>
      <b>{off === 0 ? "이번 주부터 4주" : `${wkL(off)}부터 4주`}</b>
      <TBtn disabled={off >= 4} onClick={() => setOff(off + 1)}>다음 주 ›</TBtn>
      {off !== 0 && <TBtn onClick={() => setOff(0)}>이번 주로</TBtn>}
    </div>}
    {view === "w4" && <div className="v2-chips a-kinds" role="group" aria-label="무엇을 셀까">{KINDS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k !== "all" && <i className={"a-kdot " + (k === "one" ? "k1" : k === "fx" ? "k2" : "k3")} />}{l}</Chip>)}</div>}
    {view === "w4" && <p className="a-hint" style={{ marginTop: 0 }}>고정업무 = 그 주 해야 할 횟수(매일은 평일만) − v2 체크 · 행동지표 = 주 목표(월간 ÷4, 분기 ÷13) − 버전1 실적 · 빨간 숫자 = [업무]에서 주 한도 넘음</p>}
    {view === "w4" ? <WeekTable D={D} idx={idx} open={open} noTemp={noTemp} off={off} kind={kind} /> : <DayTable D={D} idx={idx} open={open} noTemp={noTemp} />}</>
    <p className="a-hint">위험 = 지난 일 3개 이상이거나 기한 지킴 60% 미만 · 주의 = 지난 일·시작 전 일이 있거나 한 주 15건 이상 · 주 한도는 이름 › 사람 보기에서 고쳐요</p>
  </>;
}

const finAt = (t) => String(t.finishedAt || t.doneAt || "");
const doneN = (D, uid, since) => (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, uid) && finAt(t) >= since).length;

// 끝낸 일 목록 (보기만)
export function DoneSheet({ D, open, onBack, onClose, s }) {
  const u = (D.users || []).find((x) => x.id === s.uid);
  const list = (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, s.uid) && finAt(t) >= s.since && (!s.until || finAt(t) < s.until)).sort((a, b) => finAt(b).localeCompare(finAt(a)));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "";
  return <Sheet title={`${u ? u.name : "사람"} · 완료 ${list.length}건 · ${s.label}`} onBack={onBack} onClose={onClose}>
    <Card style={{ marginTop: 12 }}>{list.length === 0 ? <Empty>끝낸 일이 없어요</Empty> : list.map((t, i) => <Row key={t.id} title={t.title} tag={`✓ ${md(finAt(t).slice(0, 10))}`} sub={pn(t) || "프로젝트 없음"} onClick={() => open({ type: "task", id: t.id })} last={i === list.length - 1} />)}</Card>
  </Sheet>;
}

// 사람 × 4주 표 (한눈에 1280 에서도 같이 씀)
// 버전1 문서 여러 개 읽기 (행동지표 정의·분기 실적) — 읽기만
function useV1Docs(ids) {
  const k = [...new Set(ids)].sort().join(","); const [st, setSt] = useState({});
  useEffect(() => { if (!k) return undefined; const un = k.split(",").map((id) => fb.listenV1Doc(id, (d) => setSt((o) => ({ ...o, [id]: d })), () => setSt((o) => ({ ...o, [id]: null }))));
    return () => un.forEach((u) => { try { u && u(); } catch (_) {} }); }, [k]);
  return st;
}
// 고정업무 체크 기록 (v2 checks · 보이는 기간만 한 번 읽기)
function useChecks(from) {
  const [a, setA] = useState([]);
  useEffect(() => { let live = true; fb.fetchWhere("checks", ["date", ">=", from]).then((x) => { if (live) setA(x); }).catch((e) => { console.error("[v2 checks] 읽기 실패:", e); if (live) setA([]); }); return () => { live = false; }; }, [from]);
  return a;
}
const KINDS = [["all", "모두"], ["one", "업무"], ["fx", "고정업무"], ["ak", "행동지표"]];
const KL = { one: "업무", fx: "고정", ak: "지표" };

// 사람 × 4주 표 (한눈에 1280 에서도 같이 씀) — 주 = 월~일
//  칸 큰 숫자 = 그 주 아직 안 한 것 (업무: 마감인 열린 일 · 고정업무: 해야 할 횟수 − 체크 · 행동지표: 주 목표 − 실적), 초록 '완료' = 그 주에 한 것
//  [모두] 는 세 가지 합 + 칸 아래 막대(업무·고정·지표 비율) · 이름 아래 = 이번 주 할 양 섞임
export function WeekTable({ D, idx, open, noTemp, off = 0, kind = "one" }) {
  const now = new Date(), key = ymd(now), mon = weekStart(key);
  const iso = (d) => new Date(d + "T00:00:00").toISOString();   // 그 날 0시(이 기기 시각) → 끝낸 시각과 비교
  const from0 = addDays(mon, Math.min(0, off) * 7);
  const checks = useChecks(from0);
  const wkKeys = [0, 1, 2, 3].map((i) => addDays(mon, (off + i) * 7));
  const v1 = useV1Docs(["state-actionKPIs", ...wkKeys.map((w) => "kpi-act-" + akQidOfWeek(w))]);
  const akItems = ((v1["state-actionKPIs"] || {}).items || []).filter((it) => it && it.active !== false && !it.perFail && it.unit !== "%");
  const akDocs = Object.fromEntries(Object.entries(v1).filter(([k]) => k.startsWith("kpi-act-")).map(([k, d]) => [k.slice(8), d || {}]));
  const fxAll = (D.tasks || []).filter((t) => t.isFixed && !t.paused && !t.deleted);
  const rows = useMemo(() => { const d7 = new Date(now - 7 * 864e5).toISOString();
    return sortRows(teamWeeks(D, idx, now, noTemp, off, mon)).map((r) => {
      const uid = r.u.id, myFx = fxAll.filter((t) => fxPeople(D.users, t).includes(uid)), myAk = akItems.filter((it) => akWho(D.users, it).includes(uid) && akStart(it) <= addDays(wkKeys[3], 6));
      const myChecks = checks.filter((c) => c.on && c.uid === uid);
      const weeks = r.weeks.map((w) => {
        const one = { left: w.n, done: w.from > key ? 0 : (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, uid) && finAt(t) >= iso(w.from) && finAt(t) < iso(addDays(w.to, 1))).length };
        let due = 0; const days = [...Array(7)].map((_, k) => addDays(w.from, k));
        myFx.forEach((t) => days.forEach((d) => { if (fxDueOn(t, d) && ((t.recurType || "daily") !== "daily" || !isOffDay(d))) due++; }));
        const fdone = new Set(myChecks.filter((c) => c.date >= w.from && c.date <= w.to && myFx.some((t) => t.id === c.taskId)).map((c) => c.taskId + "~" + c.date)).size;
        const fx = { left: Math.max(0, due - fdone), done: Math.min(fdone, due), due };
        let goal = 0, adone = 0;
        myAk.forEach((it) => { if (akStart(it) > w.to) return; const g = +it.goal || 1; goal += it.cyc === "W" ? g : it.cyc === "Q" ? Math.ceil(g / 13) : Math.ceil(g / 4);
          adone += +((akBy(akDocs, it, w.from) || {})[uid] || 0); });
        const ak = { left: Math.max(0, goal - adone), done: adone, due: goal };
        return { ...w, one, fx, ak };
      });
      const w0 = weeks.find((w) => w.from <= key && key <= w.to) || null;
      const mix = w0 ? { one: w0.one.left + w0.one.done, fx: w0.fx.due, ak: w0.ak.due } : null;
      return { ...r, done7: doneN(D, uid, d7), weeks, mix };
    }); }, [D, idx, noTemp, off, checks, v1]);
  const pick = (w) => kind === "all" ? { left: w.one.left + w.fx.left + w.ak.left, done: w.one.done + w.fx.done + w.ak.done } : w[kind];
  return <div className="a-wk" role="table" aria-label="사람별 4주">
    <div className="a-wkr hd" role="row">
      <span role="columnheader">이름</span><span role="columnheader">지남</span>
      {[0, 1, 2, 3].map((i) => <span key={i} role="columnheader">{wkL(off + i)}<small>{md(wkKeys[i])}~</small></span>)}
    </div>
    {rows.map((r) => <div key={r.u.id} className="a-wkr" role="row">
      <button type="button" className="a-wkn" onClick={() => open({ type: "person", id: r.u.id })} aria-label={`${r.u.name} 사람 보기 · ${r.level}`}>
        <span className="l1"><b>{r.u.name}</b></span>
        <span className="l2"><Lv v={r.level} small /><span style={r.doing >= 6 ? { color: C.ink, fontWeight: 800 } : null}>진행 {r.doing}</span></span>
        {r.mix && <span className="l2 a-mix" title="이번 주 할 양: 업무 · 고정업무 · 행동지표"><i className="k1" />{r.mix.one}<i className="k2" />{r.mix.fx}<i className="k3" />{r.mix.ak}</span>}
        <span className="l2"><span className="a-dn">완료 {r.done7}</span></span>
        {r.noDue > 0 && <span className="l2">기한 없음 {r.noDue}</span>}
      </button>
      <button type="button" className="a-wc late" disabled={!r.late} onClick={() => open({ type: "apick", uid: r.u.id, late: true, noTemp })} aria-label={`${r.u.name} 지난 일 ${r.late}건`}>
        <b style={{ color: r.late ? C.red : C.mute }}>{r.late || "-"}</b></button>
      {r.weeks.map((w, i) => { const v = pick(w), overCap = kind === "one" && w.one.left > r.cap, past = w.to < key;
        const tot = w.one.left + w.one.done + w.fx.due + w.ak.due;
        const go = () => open({ type: "apick", uid: r.u.id, from: w.from, to: w.to, noTemp, ...(w.one.left ? {} : { show: "done" }) });
        return <button key={i} type="button" className={"a-wc" + (past ? " past" : kind === "all" ? (v.left <= 0 ? "" : v.left <= 15 ? " w1" : v.left <= 40 ? " w2" : " w3") : wl(v.left))} onClick={go}
          aria-label={`${r.u.name} ${wkL(off + i)} · 업무 남음 ${w.one.left} 완료 ${w.one.done} · 고정업무 남음 ${w.fx.left} 체크 ${w.fx.done} · 행동지표 남음 ${w.ak.left} 실적 ${w.ak.done}${overCap ? ` · 주 한도 ${r.cap} 넘음` : ""}`}>
          <b className={overCap ? "over" : ""} style={past && v.left ? { color: C.red } : null}>{v.left || "-"}</b>
          {v.done > 0 && <small className="dn">완료 {v.done}</small>}
          {kind === "all" && tot > 0 && <span className="a-mixbar" aria-hidden="true"><i className="k1" style={{ flexGrow: w.one.left + w.one.done }} /><i className="k2" style={{ flexGrow: w.fx.due }} /><i className="k3" style={{ flexGrow: w.ak.due }} /></span>}
          {kind === "one" && !noTemp && w.temp > 0 && <small>임시 {w.temp}</small>}</button>; })}
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
  const [only, setOnly] = useState(s.show === "done" ? "done" : s.noTemp ? "real" : "all"), [sel, setSel] = useState(() => new Set());
  const u = (D.users || []).find((x) => x.id === s.uid);
  const base = (D.tasks || []).filter((t) => openOneOff(t) && isMine(t, s.uid) && (s.late ? dueOf(t) && dueOf(t) < key : dueOf(t) >= s.from && dueOf(t) <= s.to));
  const tempN = base.filter((t) => idx.temp.has(t.id)).length;
  // 그 기간에 끝낸 일 (보기만 · 지난 일 묶음에는 없음)
  const iso = (d) => new Date(d + "T00:00:00").toISOString();
  const doneL = s.late ? [] : (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, s.uid) && finAt(t) >= iso(s.from) && finAt(t) < iso(addDays(s.to, 1))).sort((a, b) => finAt(b).localeCompare(finAt(a)));
  const pn = (t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "";
  const items = only === "done" ? [] : only === "temp" ? base.filter((t) => idx.temp.has(t.id)) : only === "real" ? base.filter((t) => !idx.temp.has(t.id)) : base;
  const groups = groupItems(items, "project", D);
  const range = s.late ? "지난 일" : s.from === s.to ? `${md(s.from)} (${wdOf(s.from)})` : `${md(s.from)}~${md(s.to)}`;
  // 칩을 바꾸면 고른 것도 풀기 · 막대에는 지금 보이는 줄에서 고른 것만 (안 보이는 일이 같이 바뀌지 않게)
  const only1 = (k) => { setOnly(k); setSel(new Set()); };
  const ids = new Set(items.map((t) => t.id)), selV = new Set([...sel].filter((id) => ids.has(id)));
  const all = items.length > 0 && items.every((t) => sel.has(t.id));
  const openL = s.late ? "지난 일" : s.to < key ? "못 끝낸 일" : "할 일";
  return <Sheet title={`${u ? u.name : "사람"} · ${range} · ${base.length}건`} onBack={onBack} onClose={onClose}>
    <div className="v2-chips" style={{ marginTop: 12 }}>
      <Chip on={only === "all"} onClick={() => only1("all")}>{openL} {base.length}</Chip>
      {!s.late && <Chip on={only === "done"} onClick={() => only1("done")}>완료 {doneL.length}</Chip>}
      {tempN > 0 && <Chip on={only === "temp"} onClick={() => only1("temp")}>임시만 {tempN}</Chip>}
      {tempN > 0 && <Chip on={only === "real"} onClick={() => only1("real")}>진짜 일만 {base.length - tempN}</Chip>}
      <span style={{ flex: 1 }} />
      {only !== "done" && items.length > 0 && <TBtn onClick={() => setSel(all ? new Set() : new Set(items.map((t) => t.id)))}>{all ? "모두 풀기" : `모두 고르기 ${items.length}`}</TBtn>}
    </div>
    {only === "done" ? <Card style={{ marginTop: 12 }}>{doneL.length === 0 ? <Empty>이 기간에 끝낸 일이 없어요</Empty> : doneL.map((t, i) => <Row key={t.id} title={t.title} tag={`✓ ${md(finAt(t).slice(0, 10))}`} sub={pn(t) || "프로젝트 없음"} onClick={() => open({ type: "task", id: t.id })} last={i === doneL.length - 1} />)}</Card>
      : items.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>고른 조건에 맞는 일이 없어요</Empty></Card>
      : <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} />}
    <p className="a-hint">{only === "done" ? "끝낸 일은 보기만 해요 · 누르면 그 업무" : "담당을 바꿔도 맡긴 사람은 그대로예요. 받는 사람 화면에는 '항목 n개 맡김' 한 줄로 떠요."}</p>
    <SelBar D={D} cu={cu} A={A} sel={selV} setSel={setSel} setToast={setToast} />
  </Sheet>;
}
