// 관리자 · 프로젝트 — 출시가 겹치나, 어느 프로젝트가 위험한가, 출시일을 옮기면 무엇이 바뀌나
// 출시 줄(앞으로 8주 출시일 묶음 · 제품마다 7단계 칸) → 위험순 전체 목록(일반·신제품 한 목록) → 제품을 누르면 프로젝트 시트 + 관리자 덧붙임(LaunchTools)
import { useMemo, useState } from "react";
import { ymd, addDays, ddays, ddayLabel, md, ago, nameOf, ownersOf, dueOf, isDone, projOpen, projHealth, projWhen, weekStart, PROJ_CATS, catName, projCat, guessCat, isHoldP, impOf, IMP_RANK, projPct, roadOf, roadStates, phaseOfTask } from "../model.js";
import { phaseStates, previewLaunchMove, groupItems } from "../views.js";
import { nodeState, orderTasks } from "../mindmap.jsx";
import { LAUNCH_PHASES, launchPct, rebalanceLaunch } from "../launch.js";
import { nowNext } from "../turn.js";
import { PickList, ro } from "../pick.jsx";
import { C, Act, Seg, TBtn, Chip, Head, Card, Empty, More, Ask, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";
import { Gantt } from "../gantt.jsx";
import { Lv, SelBar, isLaunchP, openOneOff, wdOf, deltaLine } from "./common.jsx";

const PH_S = { plan: "기획", sample: "샘플", pack: "패킹", content: "콘텐", channel: "채널", stock: "입고", promo: "홍보" };
const ORD = { 위험: 0, 주의: 1, 순조: 2 };
const NAVY_BTN = { background: C.navy, color: "#fff", borderColor: C.navy };

// 모든 프로젝트를 같은 모양으로: 날짜(출시일·마감)별 묶음 → 줄마다 단계 띠 + % + '지금: 업무(담당)'
//  띠 칸: 신제품 = 7단계(위 머리에 단계 이름) · 그 밖 = 업무 하나가 한 칸(앞 일 순서대로). 채움 = 끝남 · 테두리 = 지금 · 빨간 테두리 = 지남 · 연한 칸 = 아직
//  업무가 8개 넘으면 앞쪽 끝난 것을 '✓n' 한 칸으로 묶고 열린 것 7칸까지
const MAXC = 8;
const topTasks = (p, D, idx) => { const ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), ids = new Set(ts.map((t) => t.id));
  return orderTasks(ts.filter((t) => !t.parentId || !ids.has(t.parentId)), idx); };
function taskStrip(p, D, idx, key) {
  const top = topTasks(p, D, idx);
  const cell = (t) => { const st = nodeState(t, idx, key); return { k: t.id, name: t.title, state: st === "done" ? "done" : st === "late" ? "late" : st === "doing" ? "cur" : st === "hold" ? "hold" : "todo" }; };
  let cells = top.map(cell);
  if (cells.length > MAXC) { const done = cells.filter((c) => c.state === "done"), rest = cells.filter((c) => c.state !== "done");
    cells = [...(done.length ? [{ k: "done", name: `끝난 업무 ${done.length}개`, state: "done", txt: `✓${done.length}` }] : []), ...rest.slice(0, MAXC - (done.length ? 1 : 0))];
    const more = rest.length - (MAXC - (done.length ? 1 : 0)); if (more > 0) cells.push({ k: "more", name: `열린 업무 ${more}개 더`, state: "more", txt: `+${more}` }); }
  return cells;
}

// 로드(2026-10-07): 일반·흐름 프로젝트 = 단계 하나가 한 칸(이름은 칸 설명 · 숫자 = 지금 단계·늦은 단계의 남은 업무) · 단계가 8개 넘으면 8칸까지
function roadStrip(p, D, key, road) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), by = new Map(ts.map((t) => [t.id, t]));
  const st = roadStates(road, ts, (t) => phaseOfTask(t, p, D, by, road), key);
  const cells = st.slice(0, MAXC).map((ph) => ({ k: ph.k, name: `${ph.name} · ${ph.state === "none" ? "업무 없음" : `남은 ${ph.left}/${ph.total}`}`, state: ph.state === "none" ? "empty" : ph.state, txt: ph.state === "cur" || ph.state === "late" ? ph.left : "" }));
  return { cells, cur: st.find((x) => x.state === "cur" || x.state === "late") || null };
}

// [주별 표] 카테고리 × 주(월~일) — 사람 표와 같은 모양. 카테고리를 누르면 그 안 프로젝트가 펼쳐짐
//  칸 큰 숫자 = 그 주 마감인데 아직 안 끝난 업무(지난 주 빨강 = 못 끝냄) · 초록 = 그 주에 끝낸 업무 · 칸 → 그 업무 목록(고르기·담당 바꾸기)
const wkLab = (k) => (k === 0 ? "이번 주" : k === 1 ? "다음 주" : k === -1 ? "지난 주" : k > 0 ? `${k}주 뒤` : `${-k}주 전`);
const finAt = (t) => String(t.finishedAt || t.doneAt || "");
function CatWeek({ D, open, rows }) {
  const [off, setOff] = useState(-1), [exp, setExp] = useState({}), [more, setMore] = useState({});
  const key = ymd(new Date()), mon = weekStart(key), iso = (d) => new Date(d + "T00:00:00").toISOString();
  const weeks = [0, 1, 2, 3].map((i) => { const from = addDays(mon, (off + i) * 7); return { k: off + i, from, to: addDays(from, 6) }; });
  const stat = useMemo(() => { const byP = new Map();
    rows.forEach((x) => byP.set(x.p.id, { late: 0, w: weeks.map(() => ({ left: 0, done: 0 })) }));
    (D.tasks || []).forEach((t) => { const st = byP.get(t.projectId); if (!st || t.isFixed) return;
      if (openOneOff(t)) { const d = dueOf(t); if (!d) return; if (d < key) st.late++; weeks.forEach((w, i) => { if (d >= w.from && d <= w.to) st.w[i].left++; }); }
      else if (isDone(t)) { const f = finAt(t); weeks.forEach((w, i) => { if (f >= iso(w.from) && f < iso(addDays(w.to, 1))) st.w[i].done++; }); } });
    return byP; }, [D, rows, off]);
  const cats = [...PROJ_CATS, ["none", "미분류"]].map(([k, l]) => { const ps = rows.filter((x) => (k === "none" ? !projCat(x.p) : projCat(x.p) === k));
    const agg = { late: 0, w: weeks.map(() => ({ left: 0, done: 0 })) };
    ps.forEach((x) => { const st = stat.get(x.p.id); agg.late += st.late; st.w.forEach((c, i) => { agg.w[i].left += c.left; agg.w[i].done += c.done; }); });
    return { k, l, ps: ps.slice().sort((a, b) => stat.get(b.p.id).late - stat.get(a.p.id).late || String(a.date || "9").localeCompare(String(b.date || "9"))), agg, risk: ps.filter((x) => x.h.level === "위험").length }; }).filter((c) => c.ps.length);
  const worst = cats.filter((c) => c.agg.late).sort((a, b) => b.agg.late - a.agg.late).slice(0, 2);
  const cls = (n, past) => (past ? " past" : n <= 0 ? "" : n <= 5 ? " w1" : n <= 20 ? " w2" : " w3");
  const cells = (st, pids, label) => <>
    <button type="button" className="a-wc late" disabled={!st.late} onClick={() => open({ type: "apick", pids, label, late: true })} aria-label={`${label} 지난 업무 ${st.late}`}><b style={{ color: st.late ? C.red : C.mute }}>{st.late || "-"}</b></button>
    {st.w.map((c, i) => { const w = weeks[i], past = w.to < key;
      return <button key={i} type="button" className={"a-wc" + cls(c.left, past)} disabled={!c.left && !c.done} onClick={() => open({ type: "apick", pids, label, from: w.from, to: w.to, ...(c.left ? {} : { show: "done" }) })}
        aria-label={`${label} ${wkLab(w.k)} 남은 ${c.left} 완료 ${c.done}`}><b style={past && c.left ? { color: C.red } : null}>{c.left || "-"}</b>{c.done > 0 && <small className="dn">완료 {c.done}</small>}</button>; })}</>;
  return <>
    <div className="a-wknav" style={{ marginTop: 10 }}>
      <TBtn disabled={off <= -4} onClick={() => setOff(off - 1)}>‹ 지난 주</TBtn><b>{wkLab(off)}부터 4주</b><TBtn disabled={off >= 4} onClick={() => setOff(off + 1)}>다음 주 ›</TBtn>
      {off !== -1 && <TBtn onClick={() => setOff(-1)}>처음으로</TBtn>}</div>
    <div className="a-sumtop">{worst.length ? <>밀리는 카테고리: <b>{worst.map((c) => `${c.l} 지남 ${c.agg.late}`).join(" · ")}</b></> : "기한 지난 프로젝트 업무가 없어요"}</div>
    <div className="a-wk a-cw" role="table" aria-label="카테고리별 4주">
      <div className="a-wkr hd" role="row"><span role="columnheader">카테고리</span><span role="columnheader">지남</span>{weeks.map((w) => <span key={w.from} role="columnheader">{wkLab(w.k)}<small>{md(w.from)}~</small></span>)}</div>
      {cats.map((c) => { const on = !!exp[c.k], pids = c.ps.map((x) => x.p.id), m = more[c.k], shown = m ? c.ps : c.ps.slice(0, 8);
        return <div key={c.k} className="a-cwg">
          <div className="a-wkr" role="row">
            <button type="button" className="a-wkn" aria-expanded={on} onClick={() => setExp({ ...exp, [c.k]: !on })}><span className="l1"><b>{c.l} {on ? "▴" : "▾"}</b></span>
              <span className="l2">{c.ps.length}개{c.risk ? <> · <span style={{ color: C.red, fontWeight: 800 }}>위험 {c.risk}</span></> : ""}{c.k === "none" ? " · 정리 필요" : ""}</span></button>
            {cells(c.agg, pids, c.l)}
          </div>
          {on && shown.map((x) => { const st = stat.get(x.p.id);
            return <div key={x.p.id} className="a-wkr sub" role="row">
              <button type="button" className="a-wkn" onClick={() => open({ type: "project", id: x.p.id })}><span className="l1"><b>{x.p.title}</b></span>
                <span className="l2">{x.date ? `${x.lp ? "출시" : "마감"} ${md(x.date)} · ` : ""}{x.h.pct}%</span></button>
              {cells(st, [x.p.id], x.p.title)}
            </div>; })}
          {on && c.ps.length > 8 && <button type="button" className="a-cwmore" onClick={() => setMore({ ...more, [c.k]: !m })}>{m ? "접기 ▴" : `${c.ps.length - 8}개 더 보기 ▾`}</button>}
        </div>; })}
    </div>
    <p className="a-hint">주 = 월~일 · 큰 숫자 = 그 주 마감인데 아직 안 끝난 업무(지난 주 빨강 = 못 끝냄) · 초록 = 그 주에 끝낸 업무 · 카테고리를 누르면 프로젝트가 펼쳐져요 · 칸을 누르면 그 업무 목록(골라서 담당·기한 바꾸기)</p>
  </>;
}

export function ProjectsTab({ D, cu, A, idx, open }) {
  const [axis0, setAxis] = useLocal(LS("apaxis"), "wk"), [cat, setCat] = useLocal(LS("apcat"), "all"), [more, setMore] = useState({});
  const axis = ["wk", "phase", "week", "gantt"].includes(axis0) ? axis0 : "wk";
  const [gm, setGm] = useLocal(LS("agmode"), "w8");
  const now = new Date(), key = ymd(now);
  const rows = useMemo(() => D.projects.filter(projOpen).map((p) => { const lp = isLaunchP(p);
    const ts = (D.tasks || []).filter((t) => t.projectId === p.id && t.launchItem);
    const h = projHealth(p, D, key, lp ? (x) => launchPct(x, D) : null), w = projWhen(p, D.tasks, key);   // % = 프로젝트 화면과 같은 값
    const road = lp ? null : roadOf(p, D), rsx = road ? roadStrip(p, D, key, road) : null;
    return { p, lp, h, nn: nowNext(p, D, idx, key), date: w.date, stage: rsx && rsx.cur ? rsx.cur.name : "", cells: lp ? phaseStates(ts, key).map((ph) => ({ k: ph.k, name: `${ph.name} · 남은 ${ph.left}/${ph.total}`, state: ph.state, txt: ph.state === "cur" || ph.state === "late" ? ph.left : "" })) : rsx ? rsx.cells : taskStrip(p, D, idx, key) }; }), [D, idx]);
  const inCat = (p, k) => (k === "all" ? true : k === "none" ? !projCat(p) : projCat(p) === k);
  const cats = [["all", "전체"], ...PROJ_CATS, ["none", "미분류"]].filter(([k]) => k === "all" || rows.some((x) => inCat(x.p, k)));
  const cat1 = cats.some(([k]) => k === cat) ? cat : "all";
  const list = rows.filter((x) => inCat(x.p, cat1));
  const cnt = (v) => list.filter((x) => x.h.level === v).length;
  const setPC = (p, v) => A.setCategory(p, v, "auto");   // 로드(2026-10-07): 단계가 정해진 업무가 있으면 지금 단계 그대로 · 없으면 새 카테고리 단계
  // 날짜별 묶음: 지난 날짜 → 앞으로 → 날짜 없음 → 보류
  const groups = useMemo(() => { const g = new Map();
    list.forEach((x) => { const k = x.p.status === "hold" || x.p.status === "paused" ? "~hold" : x.date || "~none"; (g.get(k) || g.set(k, []).get(k)).push(x); });
    return [...g.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, items]) => ({ k, items: items.sort((a, b) => (b.lp ? 1 : 0) - (a.lp ? 1 : 0) || ORD[a.h.level] - ORD[b.h.level] || IMP_RANK[impOf(a.p)] - IMP_RANK[impOf(b.p)] || String(a.p.title).localeCompare(String(b.p.title), "ko")) })); }, [list]);
  const weeks = [...Array(8)].map((_, i) => addDays(weekStart(key), i * 7));
  const gHead = (g) => { const lpN = g.items.filter((x) => x.lp).length, left = g.items.reduce((a, x) => a + x.h.open, 0), late = g.items.reduce((a, x) => a + x.h.late, 0);
    const what = g.k === "~hold" ? "보류" : g.k === "~none" ? "날짜 없음" : `${md(g.k)} (${wdOf(g.k)}) ${lpN === g.items.length ? "출시" : lpN ? "출시·마감" : "마감"}`;
    return <div className="a-lnh" style={late ? { color: C.ink, fontWeight: 800 } : g.items.length >= 3 ? { fontWeight: 800, color: C.ink } : null}>{what} {g.items.length} · 남은 업무 {left}{late ? <> · <b style={{ color: C.red }}>지난 {late}</b></> : ""}</div>; };
  const row = (x, last) => { const p = x.p;
    return <div key={p.id} className="a-lrow" style={{ borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <button type="button" className="a-ln" onClick={() => open({ type: "project", id: p.id })} aria-label={`${p.title} · ${x.h.pct}% · 남은 ${x.h.open}${x.h.late ? ` · 지남 ${x.h.late}` : ""}`}>
        <span className="nm"><Lv v={x.h.level} small /> {p.title}{impOf(p) === "high" ? " · 중요" : ""}</span>
        {x.cells.map((c) => <span key={c.k} className={"ph " + c.state} title={c.name}>{c.txt ?? ""}</span>)}
        {!x.lp && x.cells.length < 7 && [...Array(7 - x.cells.length)].map((_, i) => <span key={"e" + i} className="ph none" aria-hidden="true" />)}
        <span className="end">{x.h.late ? <b style={{ color: C.red }}>지남 {x.h.late}</b> : `${x.h.pct}%`}</span>
      </button>
      <div className="a-lsub">{x.stage ? `${x.stage} 단계 · ` : ""}{isHoldP(p) ? `보류 · ${p.holdReason || "이유 없음"} · ${p.holdUntil ? `다시 할 날 ${md(p.holdUntil)}` : "다시 할 날 미정"}` : x.nn.now ? `지금 ${x.nn.now.title} (${nameOf(D.users, ownersOf(x.nn.now)[0]) || "담당 없음"})${x.nn.next ? ` → 다음 ${x.nn.next.title} (${nameOf(D.users, ownersOf(x.nn.next)[0]) || "담당 없음"})` : ""}` : x.h.open ? `열린 업무 ${x.h.open} · 지금 하는 일 없음` : x.h.allDone ? <>업무 다 끝남 · <TBtn onClick={() => open({ type: "project", id: p.id })} style={{ padding: "0 2px", fontSize: 12.5 }}>완료하기 ›</TBtn></> : "업무가 아직 없어요"}{!x.lp && cat1 === "all" && projCat(p) ? ` · ${catName(projCat(p))}` : ""}</div>
      {cat1 === "none" && <div className="a-lsub a-pcatset">
        <select aria-label={`${p.title} 카테고리`} className="v2-sel" value="" onChange={(e) => e.target.value && setPC(p, e.target.value)}><option value="">카테고리 고르기 ▾</option>{PROJ_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {guessCat(p.title) && <TBtn onClick={() => setPC(p, guessCat(p.title))}>추천 '{catName(guessCat(p.title))}'로</TBtn>}</div>}
    </div>; };
  return <>
    <Seg items={[["wk", "주별 표"], ["phase", "단계"], ["week", "8주 축"], ["gantt", "간트"]]} value={axis} onChange={setAxis} />
    {axis === "wk" ? <CatWeek D={D} open={open} rows={rows} /> : <>
    <Head>{cat1 === "all" ? "전체 프로젝트" : catName(cat1) || "미분류"} {list.length} · 위험 {cnt("위험")} · 주의 {cnt("주의")} · 순조 {cnt("순조")}</Head>
    <div className="v2-chips" role="group" aria-label="카테고리" style={{ marginBottom: 8 }}>{cats.map(([k, l]) => <Chip key={k} on={cat1 === k} onClick={() => setCat(k)}>{l} {rows.filter((x) => inCat(x.p, k)).length}</Chip>)}</div>
    {cat1 === "none" && <p className="a-hint" style={{ marginTop: 0 }}>줄마다 카테고리를 고르면 바로 그 묶음으로 옮겨져요 · '추천'은 이름으로 짐작한 것</p>}
    {list.length === 0 ? <Card><Empty>진행 중인 프로젝트가 없어요</Empty></Card>
    : axis === "gantt" ? <Gantt mode={gm} setMode={setGm} keyd={key} rows={list.map((x) => { const p = x.p, ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), d10 = (v) => String(v || "").slice(0, 10), ds = ts.map((t) => dueOf(t)).filter(Boolean).sort();
        const end = x.date || ds[ds.length - 1] || "", st = p.startDate || ts.map((t) => t.startDate || d10(t.startedAt) || dueOf(t)).filter(Boolean).sort()[0] || end;
        return { id: p.id, title: p.title, sub: `${nameOf(D.users, p.assigneeId) || "책임 없음"}${x.h.late ? ` · 지남 ${x.h.late}` : ""}`, start: st, end, pct: x.h.pct, tone: isHoldP(p) ? "hold" : (end && end < key && x.h.open > 0) || x.h.late ? "late" : "", onClick: () => open({ type: "project", id: p.id }) }; }).sort((a, b) => String(a.end || "9").localeCompare(String(b.end || "9")))} />
    : axis === "phase" ? groups.map((g) => { const m = more[g.k], shown = m ? g.items : g.items.slice(0, 12), lps = shown.some((x) => x.lp);
      return <div key={g.k} style={{ marginBottom: 12 }}>{gHead(g)}
        <Card>
          {lps && <div className="a-ln hd" aria-hidden="true"><span className="nm" />{LAUNCH_PHASES.map((ph) => <span key={ph.k} className="ph">{PH_S[ph.k]}</span>)}<span className="end" /></div>}
          {shown.map((x, i) => row(x, i === shown.length - 1 && g.items.length <= 12))}
          {g.items.length > 12 && <More onClick={() => setMore({ ...more, [g.k]: !m })}>{m ? "접기 ▴" : `${g.items.length - 12}개 더 보기 ▾`}</More>}
        </Card></div>; })
    : <div className="v2-hscroll"><div className="a-ax" role="table" aria-label="8주 축">
        <div className="a-axr hd" role="row"><span>프로젝트</span>{weeks.map((w) => <span key={w}>{md(w)}~</span>)}</div>
        {groups.flatMap((g) => g.items).map((x) => { const ts = (D.tasks || []).filter((t) => t.projectId === x.p.id && openOneOff(t));
          return <button key={x.p.id} type="button" className="a-axr" role="row" onClick={() => open({ type: "project", id: x.p.id })}>
            <span className="nm">{x.p.title}</span>
            {weeks.map((w) => { const e = addDays(w, 6), k = ts.filter((t) => dueOf(t) >= w && dueOf(t) <= e).length, ln = x.date >= w && x.date <= e;
              return <span key={w} className={"c" + (k > 25 ? " w3" : k > 10 ? " w2" : k > 0 ? " w1" : "") + (ln ? " ln" : "")}>{k || ""}{ln ? <i>▴{x.lp ? "출시" : "마감"}</i> : null}</span>; })}
          </button>; })}
      </div></div>}
    <p className="a-hint">칸: 신제품 = 기획 · 샘플 · 패킹 · 콘텐츠 · 채널 등록 · 창고 입고 · 출시 홍보 (숫자 = 그 단계 남은 항목) · 일반·흐름 = 그 프로젝트 단계 하나가 한 칸(숫자 = 지금 단계 남은 업무 · 줄 아래에 지금 단계 이름 · 점선 = 업무 없는 단계) · 그로홈 KPI = 업무 하나가 한 칸(✓n = 끝난 업무 묶음). 채움 = 끝남 · 테두리 = 하는 중 · 빨간 테두리 = 지남 · 연한 칸 = 아직 · <TBtn onClick={() => open({ type: "launchOrder" })} style={{ padding: "0 2px", fontSize: 12 }}>신제품 순서표 보기 ›</TBtn></p></>}
  </>;
}

// 프로젝트 시트 머리 아래 관리자 덧붙임: ① 출시일 옮기기 미리 보기 ② 기한 고르게 다시 나누기 ③ 항목 골라서 한꺼번에 바꾸기
// ①② 는 '이대로 바꾸기'를 누르기 전에는 아무것도 저장하지 않는다 · 30건 이상이면 확인 창 한 번 더 · 지난 날은 못 고름 (5초 되돌리기·이전 값 기록은 core)
export function LaunchTools({ p, D, cu, A, idx, setToast, open }) {
  const [nd, setNd] = useState(""), [busy, setBusy] = useState(""), [pick, setPick] = useState(false), [sel, setSel] = useState(() => new Set()), [ask, setAsk] = useState("");
  const key = ymd(new Date()), lp = isLaunchP(p), past = !!nd && nd < key;
  const its = useMemo(() => (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), [D, p.id]);
  const move = useMemo(() => (lp && nd && !past && nd !== p.launchDate ? previewLaunchMove(p, D, nd, key) : null), [D, p, nd, past]);
  const left = p.launchDate ? ddays(p.launchDate, key) : null;
  const rb = useMemo(() => (lp && p.launchDate && left != null && left > 0 && left < 56 ? rebalanceLaunch(its.filter((t) => t.launchItem), p.launchDate, key) : []), [D, p.launchDate]);
  const rbDays = rb.length ? [...new Set(rb.map((x) => x.due))].sort() : [];
  const big = (n) => n >= 30 && n <= 100;   // 100건 넘으면 묻지 않고 core 가 '100건까지' 알림
  const doMove = async () => { if (busy || !move) return; setAsk(""); setBusy("move"); const ok = await A.setLaunchDate(p, nd); setBusy(""); if (ok !== false) setNd(""); };
  const doRb = async () => { if (busy) return; setAsk(""); setBusy("rb"); await A.applyDues(rb, `${p.title} 기한 고르게 다시 나누기`); setBusy(""); };
  const goMove = () => (move && big(move.changes.length) ? setAsk("move") : doMove());
  const goRb = () => (big(rb.length) ? setAsk("rb") : doRb());
  const openIts = its.filter((t) => !isDone(t));
  const groups = lp ? LAUNCH_PHASES.map((ph) => ({ key: ph.k, label: ph.name, items: openIts.filter((t) => t.phase === ph.k) })).filter((g) => g.items.length)
    : groupItems(openIts, "person", D);
  return <div className="a-xtra">
    {lp && <div className="a-box">
      <div className="a-boxh">{p.launchDate ? "출시일 옮기기" : "출시일 정하기"} <span>미리 보고 바꿔요</span></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, color: C.sub }}>지금 {p.launchDate ? `${md(p.launchDate)} (${wdOf(p.launchDate)})` : "미정"} →</span>
        <input type="date" aria-label="새 출시일" className="v2-sel" min={key} value={nd} onChange={(e) => setNd(e.target.value)} />
        {nd && <TBtn tone="mute" onClick={() => setNd("")}>✕ 그만</TBtn>}
      </div>
      {past && <div className="a-prev" role="status">지난 날({md(nd)})은 출시일로 정할 수 없어요 · 오늘 이후로 골라 주세요</div>}
      {move && <div className="a-prev" role="status">
        <div><b>자동 기한 {move.changes.length}개가 옮겨져요</b></div>
        {deltaLine(D, move.changes, key).map((s) => <div key={s}>· {s}</div>)}
        <div>· 사람이 정한 기한 {move.keep}개는 그대로</div>
        {p.launchDate && <div>· {md(p.launchDate)} 출시 묶음 {move.sameBefore} → {move.sameBefore - 1} · {md(nd)} 출시 {move.sameAfter}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Act onClick={goMove} style={NAVY_BTN}>{busy === "move" ? "바꾸는 중" : "이대로 바꾸기"}</Act></div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요{big(move.changes.length) ? " · 30건 이상이라 한 번 더 물어요" : ""}</div>
      </div>}
    </div>}
    {lp && rb.length > 0 && <div className="a-box">
      <div className="a-boxh">기한 고르게 다시 나누기 <span>출시까지 {left}일 · 8주보다 짧아 기한이 몰렸어요</span></div>
      <div className="a-prev">
        <div><b>자동 기한 항목 {rb.length}개</b>를 출시 전 평일에 순서표 차례대로 다시 나눠요 (주말·공휴일 건너뜀){rbDays.length ? ` · 새 기한 ${md(rbDays[0])}${rbDays.length > 1 ? `~${md(rbDays[rbDays.length - 1])}` : ""}` : ""}</div>
        {deltaLine(D, rb, key).map((s) => <div key={s}>· {s}</div>)}
        <div>· 사람이 정한 기한은 그대로예요</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Act onClick={goRb} style={NAVY_BTN}>{busy === "rb" ? "나누는 중" : "고르게 나누기"}</Act></div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요{big(rb.length) ? " · 30건 이상이라 한 번 더 물어요" : ""}</div>
      </div>
    </div>}
    <div className="a-box">
      <button type="button" className="a-boxt" aria-expanded={pick} onClick={() => { setPick(!pick); if (pick) setSel(new Set()); }}>{lp ? "항목" : "업무"} 골라서 한꺼번에 바꾸기 {openIts.length} {pick ? "▴" : "▾"}</button>
      {pick && (groups.length ? <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} /> : <Card style={{ marginTop: 8 }}><Empty>열린 {lp ? "항목" : "업무"}이 없어요</Empty></Card>)}
      <SelBar D={D} cu={cu} A={A} sel={sel} setSel={setSel} setToast={setToast} />
    </div>
    {ask === "move" && move && <Ask title={`항목 ${move.changes.length}개 기한을 옮길까요?`} body={`${p.title} 출시일 ${p.launchDate ? md(p.launchDate) : "미정"} → ${md(nd)}${ro(md(nd))} 바꾸면 자동 기한 항목 ${move.changes.length}개가 같이 옮겨져요.\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.`} yes="이대로 바꾸기" onNo={() => setAsk("")} onYes={doMove} />}
    {ask === "rb" && <Ask title={`항목 ${rb.length}개 기한을 다시 나눌까요?`} body={`${p.title} 자동 기한 항목 ${rb.length}개를 출시 전 평일에 고르게 다시 나눠요.\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.`} yes="고르게 나누기" onNo={() => setAsk("")} onYes={doRb} />}
  </div>;
}
