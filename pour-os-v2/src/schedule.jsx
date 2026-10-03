// 업무OS v2 — 일정: [달력 | 사람별 | 프로젝트별]  · 프로젝트·담당으로 걸러 보고, 사람·프로젝트가 일정대로 가는지 본다
import { useMemo, useState } from "react";
import {
  ymd, md, ddays, ddayLabel, WD, ago, isMaster, activeUsers, nameOf, isDone, isMine, ownersOf, dueOf, riskOf, projOpen, reqOf,
  monthGrid, shiftMonth, calItems, projHealth, personHealth,
} from "./model.js";
import { C, Act, Chip, Seg, Head, Card, Row, Empty, More, TBtn, useLocal } from "./ui.jsx";

const LS = (k) => "pour-os2-" + k;
const LV = { 위험: { c: C.red, bg: "#F8E9EA" }, 주의: { c: C.navy, bg: C.soft }, 순조: { c: C.green, bg: "#EAF4EE" } };
const Lv = ({ v }) => <span style={{ flex: "0 0 auto", fontSize: 11.5, fontWeight: 800, padding: "2px 7px", borderRadius: 6, color: LV[v].c, background: LV[v].bg }}>{v}</span>;
const isLaunchP = (p) => String((p && p.id) || "").startsWith("lb_");

export function ScheduleTab({ D, cu, A, open }) {
  const [f, setF] = useLocal(LS("cal-" + cu.id), { mode: "cal", pid: "", uid: "", launch: false, done: false });
  const set = (o) => setF((x) => ({ ...x, ...o }));
  const now = new Date(), key = ymd(now);
  const [ym, setYm] = useState(key.slice(0, 7)), [sel, setSel] = useState(key), [kind, setKind] = useState("all"), [allP, setAllP] = useState(false);
  const users = activeUsers(D.users).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const projects = D.projects.filter(projOpen).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko"));
  const items = useMemo(() => calItems(D, { projectId: f.pid, uid: f.uid, launchOnly: f.launch, showDone: f.done }, key), [D, f.pid, f.uid, f.launch, f.done]);
  const byDay = useMemo(() => { const m = {}; items.forEach((x) => { (m[x.date] = m[x.date] || []).push(x); }); return m; }, [items]);
  const projDue = useMemo(() => { const m = {}; projects.filter((p) => p.dueDate && (!f.pid || p.id === f.pid) && (!f.launch || isLaunchP(p))).forEach((p) => { (m[String(p.dueDate).slice(0, 10)] = m[String(p.dueDate).slice(0, 10)] || []).push(p); }); return m; }, [projects, f.pid, f.launch]);
  const evs = useMemo(() => { const m = {}; (D.events || []).filter((e) => e.date && (!f.uid || (e.attendeeIds || []).includes(f.uid))).forEach((e) => { (m[e.date] = m[e.date] || []).push(e); }); return m; }, [D.events, f.uid]);
  const grid = monthGrid(ym);
  const monthItems = items.filter((x) => x.date.slice(0, 7) === ym);
  const lateAll = items.filter((x) => x.risk && x.risk.k === "late").length;
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  const selP = f.pid && D.projects.find((p) => p.id === f.pid), selU = f.uid && D.users.find((u) => u.id === f.uid);
  const filters = <div className="v2-chips" style={{ marginTop: 10 }}>
    <select aria-label="프로젝트로 거르기" className="v2-sel" value={f.pid} onChange={(e) => set({ pid: e.target.value })} style={{ maxWidth: 200 }}><option value="">전체 프로젝트</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
    <select aria-label="담당으로 거르기" className="v2-sel" value={f.uid} onChange={(e) => set({ uid: e.target.value })}><option value="">전체 사람</option><option value={cu.id}>나 ({cu.name})</option>{users.filter((u) => u.id !== cu.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
    <Chip on={f.launch} onClick={() => set({ launch: !f.launch })}>신제품만</Chip>
    <Chip on={f.done} onClick={() => set({ done: !f.done })}>끝난 것도</Chip>
    {(f.pid || f.uid || f.launch) && <TBtn tone="mute" onClick={() => set({ pid: "", uid: "", launch: false })}>✕ 거르기 풀기</TBtn>}
  </div>;
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>일정</h1>
      <Seg items={[["cal", "달력"], ["people", "사람별"], ["projects", "프로젝트별"]]} value={f.mode} onChange={(m) => set({ mode: m })} />
    </header>

    {f.mode === "cal" && <>
      {filters}
      {selU && <PersonCard D={D} u={selU} now={now} onOpen={() => open({ type: "person", id: selU.id })} />}
      {selP && <ProjCardH D={D} p={selP} keyd={key} onOpen={() => open({ type: "project", id: selP.id })} />}
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "16px 2px 8px" }}>
        <TBtn onClick={() => setYm(shiftMonth(ym, -1))} aria-label="이전 달" style={{ fontSize: 18, padding: "4px 10px" }}>‹</TBtn>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.ink, minWidth: 104, textAlign: "center" }}>{ym.slice(0, 4)}년 {+ym.slice(5)}월</h3>
        <TBtn onClick={() => setYm(shiftMonth(ym, 1))} aria-label="다음 달" style={{ fontSize: 18, padding: "4px 10px" }}>›</TBtn>
        <span style={{ flex: 1 }} />
        {ym !== key.slice(0, 7) || sel !== key ? <TBtn onClick={() => { setYm(key.slice(0, 7)); setSel(key); }}>오늘</TBtn> : null}
      </div>
      <div style={{ fontSize: 12.5, color: C.sub, margin: "0 2px 8px" }}>이번 달 마감 {monthItems.length}{lateAll ? <b style={{ color: C.red }}> · 지난 일 {lateAll}</b> : ""} · 숫자 = 그날 마감 수, ▴ = 프로젝트 마감·출시</div>
      <div className="v2-cal" role="grid" aria-label="달력">
        {["월", "화", "수", "목", "금", "토", "일"].map((w) => <div key={w} className={"v2-calh" + (w === "토" || w === "일" ? " we" : "")}>{w}</div>)}
        {grid.flat().map((c) => { const a = byDay[c.date] || [], red = a.some((x) => x.risk && x.risk.red), pd = projDue[c.date] || [], ev = evs[c.date] || [];
          const cls = "v2-calc" + (c.out ? " out" : "") + (c.date === key ? " today" : "") + (c.date === sel ? " on" : "");
          return <button key={c.date} type="button" className={cls} onClick={() => { setSel(c.date); if (c.out) setYm(c.date.slice(0, 7)); }} aria-label={`${md(c.date)} 마감 ${a.length}건`}>
            <span className="d">{+c.date.slice(8)}</span>
            {a.length > 0 && <span className={"n" + (red ? " red" : "")}>{a.length}</span>}
            {(pd.length > 0 || ev.length > 0) && <span className="m">{pd.length ? "▴" : ""}{ev.length ? "·" : ""}</span>}
            <span className="t">{a.slice(0, 3).map((x) => <i key={x.t.id} className={x.risk && x.risk.red ? "red" : ""}>{x.t.title}</i>)}{pd.slice(0, 1).map((p) => <i key={p.id} className="p">▴ {p.title}</i>)}</span>
          </button>; })}
      </div>
      <DayList D={D} cu={cu} A={A} open={open} date={sel} list={byDay[sel] || []} projs={projDue[sel] || []} evs={evs[sel] || []} pName={pName} keyd={key} filtered={!!(f.pid || f.uid)} />
    </>}

    {f.mode === "people" && <>
      <p style={{ fontSize: 13, color: C.sub, margin: "12px 2px 0", lineHeight: 1.6 }}>담당자마다 일정이 맞게 가고 있는지 봐요. 막대 = 앞으로 4주 주별 마감 수. 누르면 그 사람 달력으로 가요.</p>
      <Card style={{ marginTop: 12 }}>{users.map((u, i) => { const h = personHealth(D, u.id, now), mx = Math.max(10, ...h.weeks);
        return <div key={u.id} role="button" tabIndex={0} onClick={() => set({ mode: "cal", uid: u.id, pid: "" })} onKeyDown={(e) => { if (e.key === "Enter") set({ mode: "cal", uid: u.id, pid: "" }); }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i < users.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer", background: "#fff" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Lv v={h.level} /><b style={{ fontSize: 15, color: C.text }}>{u.name}</b></div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{[`열린 ${h.open}`, h.late ? `지남 ${h.late}` : "", h.start ? `시작 전 ${h.start}` : "", h.ot.pct != null ? `기한 지킴 ${h.ot.pct}%` : "", h.noDue ? `기한 없음 ${h.noDue}` : ""].filter(Boolean).join(" · ")}</div>
          </div>
          <div aria-label={`4주 마감 ${h.weeks.join(", ")}`} style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34, flex: "0 0 auto" }}>
            {h.weeks.map((n, j) => <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><div style={{ width: 14, height: Math.max(2, Math.round((Math.min(n, mx) / mx) * 24)), background: n >= 15 ? C.ink : "#9AA7CC", borderRadius: 3 }} /><span style={{ fontSize: 9.5, color: C.mute, fontVariantNumeric: "tabular-nums" }}>{n}</span></div>)}
          </div>
          <Act onClick={() => open({ type: "person", id: u.id })}>보기</Act>
        </div>; })}</Card>
      <p style={{ fontSize: 12, color: C.mute, margin: "10px 2px" }}>위험 = 지난 일 3개 이상이거나 기한 지킴 60% 미만 · 주의 = 지난 일·시작 전 일이 있거나 한 주 마감 15건 이상</p>
    </>}

    {f.mode === "projects" && <>
      <div className="v2-chips" style={{ marginTop: 12 }}>{[["all", "전체"], ["launch", "신제품"], ["normal", "일반"]].map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}</div>
      {(() => { const L = projects.filter((p) => (kind === "launch" ? isLaunchP(p) : kind === "normal" ? !isLaunchP(p) : true)).map((p) => ({ p, h: projHealth(p, D, key) }));
        const ord = { 위험: 0, 주의: 1, 순조: 2 }; L.sort((a, b) => ord[a.h.level] - ord[b.h.level] || String(a.p.dueDate || "9").localeCompare(String(b.p.dueDate || "9")));
        const cnt = (v) => L.filter((x) => x.h.level === v).length; const shown = allP ? L : L.slice(0, 20);
        return <><div style={{ fontSize: 13, color: C.sub, margin: "10px 2px 0" }}>위험 {cnt("위험")} · 주의 {cnt("주의")} · 순조 {cnt("순조")} · 누르면 그 프로젝트 달력으로 가요</div>
          <Card style={{ marginTop: 10 }}>{shown.map((x, i) => <div key={x.p.id} role="button" tabIndex={0} onClick={() => set({ mode: "cal", pid: x.p.id, uid: "" })} onKeyDown={(e) => { if (e.key === "Enter") set({ mode: "cal", pid: x.p.id, uid: "" }); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i < shown.length - 1 || L.length > 20 ? `1px solid ${C.line}` : "none", cursor: "pointer", background: "#fff" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Lv v={x.h.level} /><b style={{ fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.p.title}</b></div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{[nameOf(D.users, x.p.assigneeId) || "책임 없음", x.p.dueDate ? `${isLaunchP(x.p) ? "출시" : "마감"} ${md(x.p.dueDate)} ${ddayLabel(x.h.n)}` : "마감 없음", `${x.h.pct}%`, `남은 ${x.h.open}`].join(" · ")}</div>
              <div style={{ height: 4, background: "#E8EBF2", borderRadius: 2, marginTop: 6, overflow: "hidden" }}><div style={{ width: x.h.pct + "%", height: "100%", background: x.h.level === "위험" ? C.red : C.navy }} /></div>
              {(x.h.why.length > 0 || x.h.next) && <div style={{ fontSize: 12, color: x.h.level === "위험" ? C.red : C.mute, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.h.why.join(" · ") || (x.h.next ? `다음 마감 ${md(dueOf(x.h.next))} ${x.h.next.title}` : "")}</div>}
            </div>
            <Act onClick={() => open({ type: "project", id: x.p.id })}>열기</Act>
          </div>)}
          {L.length > 20 && <More onClick={() => setAllP(!allP)}>{allP ? "접기 ▴" : `${L.length - 20}개 더 보기 ▾`}</More>}
          {L.length === 0 && <Empty>진행 중인 프로젝트가 없어요</Empty>}</Card></>; })()}
    </>}
  </>;
}

// 담당자를 고르면 달력 위에 그 사람 일정 요약
function PersonCard({ D, u, now, onOpen }) {
  const h = personHealth(D, u.id, now);
  return <Card style={{ marginTop: 12, padding: "12px 14px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Lv v={h.level} /><b style={{ fontSize: 15, color: C.ink, flex: 1 }}>{u.name} 일정</b><TBtn onClick={onOpen} style={{ padding: "2px 0" }}>사람 보기 ›</TBtn></div>
    <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>{[`열린 ${h.open}`, `진행 ${h.doing}`, h.late ? `지남 ${h.late}` : "지난 일 없음", h.start ? `곧 마감인데 시작 전 ${h.start}` : "", h.ot.pct != null ? `최근 30일 기한 지킴 ${h.ot.pct}% (${h.ot.ok}/${h.ot.n})` : "", h.noDue ? `기한 없음 ${h.noDue}` : ""].filter(Boolean).join(" · ")}</div>
    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{["이번 주", "다음 주", "3주 뒤", "4주 뒤"].map((l, i) => <span key={l} style={{ fontSize: 12.5, padding: "4px 9px", borderRadius: 8, background: h.weeks[i] >= 15 ? C.ink : C.soft, color: h.weeks[i] >= 15 ? "#fff" : C.ink, fontWeight: 700 }}>{l} {h.weeks[i]}건</span>)}</div>
  </Card>;
}
function ProjCardH({ D, p, keyd, onOpen }) {
  const h = projHealth(p, D, keyd);
  return <Card style={{ marginTop: 12, padding: "12px 14px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Lv v={h.level} /><b style={{ fontSize: 15, color: C.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</b><TBtn onClick={onOpen} style={{ padding: "2px 0" }}>열기 ›</TBtn></div>
    <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{[nameOf(D.users, p.assigneeId) ? `책임 ${nameOf(D.users, p.assigneeId)}` : "책임 없음", p.dueDate ? `${isLaunchP(p) ? "출시" : "마감"} ${md(p.dueDate)} ${ddayLabel(h.n)}` : "마감 없음", `${h.pct}%`, `남은 ${h.open}`].join(" · ")}</div>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, marginTop: 8, overflow: "hidden" }}><div style={{ width: h.pct + "%", height: "100%", background: h.level === "위험" ? C.red : C.navy }} /></div>
    {h.why.length > 0 && <div style={{ fontSize: 12.5, color: h.level === "위험" ? C.red : C.sub, marginTop: 6 }}>{h.why.join(" · ")}</div>}
  </Card>;
}
// 고른 날의 마감 목록
function DayList({ D, cu, A, open, date, list, projs, evs, pName, keyd, filtered }) {
  const d = new Date(date + "T00:00:00"), n = ddays(date, keyd);
  const sorted = list.slice().sort((a, b) => (a.risk && a.risk.red ? 0 : 1) - (b.risk && b.risk.red ? 0 : 1) || String(nameOf(D.users, ownersOf(a.t)[0])).localeCompare(String(nameOf(D.users, ownersOf(b.t)[0])), "ko"));
  return <>
    <Head>{md(date)} ({WD[d.getDay()]}){n === 0 ? " · 오늘" : n < 0 ? ` · ${-n}일 전` : ` · ${n}일 뒤`} 마감 {list.length}</Head>
    <Card>
      {projs.map((p) => <Row key={p.id} tag={String(p.id).startsWith("lb_") ? "출시" : "프로젝트 마감"} title={p.title} sub={`책임 ${nameOf(D.users, p.assigneeId) || "없음"} · ${Math.round(Number(p.progress) || 0)}%`} onClick={() => open({ type: "project", id: p.id })} last={false} />)}
      {evs.map((e) => <Row key={e.id} tag="일정" title={e.title} sub={[e.time, e.place].filter(Boolean).join(" · ") || null} last={false} />)}
      {sorted.length === 0 && !projs.length && !evs.length && <Empty>{filtered ? "고른 조건으로 이날 마감인 일이 없어요" : "이날 마감인 일이 없어요"}</Empty>}
      {sorted.map((x, i) => { const t = x.t;
        return <Row key={t.id} dim={isDone(t)} tag={x.risk ? x.risk.label : null} tagTone={x.risk && x.risk.red ? "red" : null} title={t.title}
          sub={[nameOf(D.users, ownersOf(t)[0]) || "담당 없음", pName(t.projectId), reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : ""].filter(Boolean).join(" · ")}
          onClick={() => open({ type: t.isFixed ? "fixed" : "task", id: t.id })} right={!isDone(t) && t.status !== "review" && isMine(t, cu.id) ? <Act onClick={() => A.finish(t)}>끝냄</Act> : null} last={i === sorted.length - 1} />; })}
    </Card>
  </>;
}
