// 관리자 · 한눈에 — 어디가 막혔나, 어느 날이 몰렸나 (0탭)
// 위험 칸 4개 → 임시 담당 한 줄 → 넘치는 사람 한 줄 → 거르기 → 팀 월 달력 + 고른 날 사람별 묶음(고르기 → 한꺼번에) → 최근 7일 소식
import { useMemo, useState } from "react";
import { ymd, ddays, md, ago, nameOf, activeUsers, ownersOf, projOpen, personHealth, projHealth, feedOf, LOG_L, ddayLabel } from "../model.js";
import { calCells, teamWeeks } from "../views.js";
import { launchPct } from "../launch.js";
import { MonthCal, CalHead, dayHead } from "../cal.jsx";
import { PickList } from "../pick.jsx";
import { LS } from "../core.jsx";
import { C, Chip, TBtn, Head, Card, Row, Empty, More, useLocal } from "../ui.jsx";
import { adminQueues, SelBar, BulkPad, Lv, LineBtn, isLaunchP } from "./common.jsx";
import { WeekTable } from "./People.jsx";

const RISK = [["blocked", "막힘", true], ["late", "지남", true], ["order", "순서 꼬임", false], ["req", "요청", false]];

export function Glance(ctx) {
  const { D, cu, A, idx, open, go, setToast } = ctx;
  const now = new Date(), key = ymd(now);
  const [f, setF] = useLocal(LS("acal-" + cu.id), { uid: "", pid: "", noTemp: false });
  const set = (o) => setF((x) => ({ ...x, ...o }));
  const [ym, setYm] = useState(key.slice(0, 7)), [day, setDay] = useState(key);
  const [ex, setEx] = useState(() => new Set()), [sel, setSel] = useState(() => new Set());
  const Q = useMemo(() => adminQueues(D, idx, now), [D, idx]);
  const tw = useMemo(() => teamWeeks(D, idx, now, false), [D, idx]);
  const users = activeUsers(D.users).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const projects = D.projects.filter(projOpen).slice().sort((a, b) => String(a.title).localeCompare(String(b.title), "ko"));
  const selU = f.uid && D.users.find((u) => u.id === f.uid), selP = f.pid && D.projects.find((p) => p.id === f.pid);
  const team = !selU && !selP;
  const cells = useMemo(() => calCells(D, idx, { uid: f.uid || "*", pid: f.pid, noTemp: f.noTemp }, ym, key), [D, idx, f.uid, f.pid, f.noTemp, ym]);

  // 임시 담당 한 줄
  const tempT = D.tasks.filter((t) => idx.temp.has(t.id));
  const tempBy = Object.entries(tempT.reduce((m, t) => { const u = ownersOf(t)[0] || ""; m[u] = (m[u] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  // 넘치는 사람 한 줄: 주 한도 넘은 주(가장 많은 주) · 진행 많음(6개 이상, 없으면 가장 많은 1명)
  const over = tw.map((r) => { const w = r.weeks.filter((x) => x.n > r.cap).sort((a, b) => b.n - a.n)[0]; return w ? { r, w } : null; }).filter(Boolean).sort((a, b) => b.w.n - a.w.n);
  let many = tw.filter((r) => r.doing >= 6).sort((a, b) => b.doing - a.doing);
  if (!many.length) { const top = tw.slice().sort((a, b) => b.doing - a.doing)[0]; if (top && top.doing >= 3) many = [top]; }

  // 고른 날
  const c = cells[day] || { n: 0, temp: 0, items: [], proj: [], people: {} };
  const groups = Object.values(c.items.reduce((m, t) => { const u = ownersOf(t)[0] || ""; (m[u] = m[u] || { key: u, items: [] }).items.push(t); return m; }, {}))
    .map((g) => ({ ...g, label: nameOf(D.users, g.key) || "담당 없음", temp: g.items.filter((t) => idx.temp.has(t.id)).length })).sort((a, b) => b.items.length - a.items.length);
  const mx = Math.max(1, ...groups.map((g) => g.items.length));
  const toggle = (k) => setEx((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const pick = (d) => { setDay(d); setEx(new Set()); };

  return <div className="a-glance">
    <div className="a-risk" role="group" aria-label="위험 칸">
      {RISK.map(([k, l, red]) => { const n = Q.n(k);
        return <button key={k} type="button" className="a-rc" onClick={() => go("tidy", k)} aria-label={`${l} ${n}건 · 정리에서 보기`}>
          <b style={{ color: red && n ? C.red : C.ink }}>{n}</b><span>{l}</span></button>; })}
    </div>
    {tempT.length > 0 && <LineBtn onClick={() => go("tidy", "temp")} label="임시 담당 정리하기">
      담당 정할 신제품 항목 <b>{tempT.length}</b> ({tempBy.slice(0, 3).map(([u, n]) => `${nameOf(D.users, u) || "담당 없음"} ${n}`).join(" · ")})</LineBtn>}
    {(over.length > 0 || many.length > 0) && <LineBtn onClick={() => go("people")} label="사람 탭에서 보기">
      {over.length > 0 && <>주 한도 넘음: {over.slice(0, 3).map((x, i) => <span key={x.r.u.id}>{i ? " · " : ""}{x.r.u.name} <b style={{ color: C.red }}>{x.w.n}</b>{x.w.temp ? `(임시 ${x.w.temp})` : ""}</span>)}{over.length > 3 ? ` 외 ${over.length - 3}명` : ""}</>}
      {over.length > 0 && many.length > 0 && " · "}
      {many.length > 0 && <>진행 많음: {many.slice(0, 2).map((r, i) => <span key={r.u.id}>{i ? " · " : ""}{r.u.name} <b>{r.doing}</b></span>)}</>}
    </LineBtn>}

    <div className="v2-chips" style={{ marginTop: 14 }}>
      <select aria-label="사람으로 거르기" className="v2-sel" value={f.uid} onChange={(e) => set({ uid: e.target.value })} style={{ maxWidth: 130 }}><option value="">사람 ▾</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select aria-label="프로젝트로 거르기" className="v2-sel" value={f.pid} onChange={(e) => set({ pid: e.target.value })} style={{ maxWidth: 160 }}><option value="">프로젝트 ▾</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <Chip on={f.noTemp} onClick={() => set({ noTemp: !f.noTemp })}>임시 빼기</Chip>
      {(f.uid || f.pid || f.noTemp) && <TBtn tone="mute" onClick={() => set({ uid: "", pid: "", noTemp: false })}>✕ 풀기</TBtn>}
    </div>
    {selU && <FilterUser D={D} u={selU} now={now} open={open} />}
    {selP && <FilterProj D={D} p={selP} keyd={key} open={open} />}

    <div className="v2-calwrap">
      <div>
        <CalHead ym={ym} setYm={setYm} keyd={key} sel={day} setSel={pick} right={<span className="a-calnote">{team ? "팀 전체" : selU ? selU.name : "프로젝트"}{f.noTemp ? " · 임시 뺌" : ""}</span>} />
        <MonthCal mode={team ? "team" : "me"} ym={ym} setYm={setYm} cells={cells} sel={day} onPick={pick} keyd={key} users={D.users} />
        <p className="a-hint">숫자 = 그날 마감 수 · 진할수록 많음 · ▴ = 출시·프로젝트 마감 · 빨강 = 지난 날에 남은 일이나 한 사람 하루 8건 넘음</p>
      </div>
      <div className="a-daypanel">
        <Head>{dayHead(day, key, c.n, c.proj.length)}</Head>
        {ddays(day, key) < -30 && <p className="a-hint">30일보다 앞은 끝낸 일이 안 보여요</p>}
        {c.proj.length > 0 && <Card style={{ marginBottom: 10 }}>{c.proj.map((p, i) => <Row key={p.id} tag={isLaunchP(p) ? "출시" : "프로젝트 마감"} title={p.title} sub={`책임 ${nameOf(D.users, p.assigneeId) || "없음"}`} onClick={() => open({ type: "project", id: p.id })} last={i === c.proj.length - 1} />)}</Card>}
        {groups.length === 0 ? <Card><Empty>{team ? "이날 마감인 열린 일이 없어요" : "고른 조건으로 이날 마감인 일이 없어요"}</Empty></Card>
          : <Card>{groups.map((g, i) => { const on = ex.has(g.key);
            return <div key={g.key} style={{ borderBottom: i < groups.length - 1 ? `1px solid ${C.line}` : "none" }}>
              <button type="button" className="a-grp" aria-expanded={on} onClick={() => toggle(g.key)}>
                <b className="nm">{g.label}</b><span className="ct">{g.items.length}{g.temp ? <small> (임시 {g.temp})</small> : null}</span>
                <span className="bar" aria-hidden="true"><i style={{ width: Math.max(4, Math.round((g.items.length / mx) * 100)) + "%", background: g.items.length > 8 ? C.red : C.navy }} /></span>
                <span className="tg">{on ? "▴" : "▾"}</span></button>
              {on && <div style={{ padding: "0 10px 10px" }}><PickList D={D} groups={[{ key: g.key, label: `${g.label} · ${md(day)} 마감`, items: g.items }]} sel={sel} setSel={setSel} open={open} temp={idx.temp} max={10} right={(t) => <TBtn onClick={() => open({ type: "task", id: t.id, focus: "talk" })} style={{ fontSize: 12.5 }}>댓글</TBtn>} /></div>}
            </div>; })}</Card>}
        <p className="a-hint">이름을 누르면 펼쳐져요 · 골라서 담당·기한을 한꺼번에 바꿀 수 있어요</p>
      </div>
    </div>

    <div className="a-only1280">
      <Head right={<TBtn onClick={() => go("people")}>사람 탭 ›</TBtn>}>사람 × 4주</Head>
      <WeekTable D={D} idx={idx} open={open} noTemp={f.noTemp} />
    </div>

    <Feed D={D} open={open} now={now} />
    <BulkPad on={sel.size > 0} />
    <SelBar D={D} cu={cu} A={A} sel={sel} setSel={setSel} setToast={setToast} />
  </div>;
}

function FilterUser({ D, u, now, open }) {
  const h = personHealth(D, u.id, now);
  return <Card style={{ marginTop: 10, padding: "10px 12px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>
      <Lv v={h.level} /><b style={{ color: C.ink }}>{u.name}</b>
      <span style={{ color: C.sub }}>· 열린 {h.open} · 진행 {h.doing} · 지남 {h.late ? <b style={{ color: C.red }}>{h.late}</b> : 0}{h.ot.pct != null ? ` · 기한 지킴 ${h.ot.pct}%` : ""}</span>
      <TBtn onClick={() => open({ type: "person", id: u.id })} style={{ padding: "2px 0" }}>사람 보기 ›</TBtn>
    </div>
  </Card>;
}
function FilterProj({ D, p, keyd, open }) {
  const h = projHealth(p, D, keyd, isLaunchP(p) ? (x) => launchPct(x, D) : null);
  return <Card style={{ marginTop: 10, padding: "10px 12px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Lv v={h.level} /><b style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</b><TBtn onClick={() => open({ type: "project", id: p.id })} style={{ padding: "2px 0" }}>열기 ›</TBtn></div>
    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{[nameOf(D.users, p.assigneeId) ? `책임 ${nameOf(D.users, p.assigneeId)}` : "책임 없음", p.dueDate ? `${isLaunchP(p) ? "출시" : "마감"} ${md(p.dueDate)} ${ddayLabel(h.n)}` : isLaunchP(p) ? "출시일 미정" : "마감 없음", `${h.pct}%`, `남은 ${h.open}`, ...h.why].join(" · ")}</div>
  </Card>;
}

// 최근 7일 소식 (접힘) — 팀 소식(전체 · 대화 · 변경)을 그대로 옮김
function Feed({ D, open, now }) {
  const [on, setOn] = useState(false), [chip, setChip] = useState("all"), [n, setN] = useState(20);
  const feed = on ? feedOf(D, { sinceIso: new Date(now - 7 * 864e5).toISOString() }).filter((x) => chip === "all" || (chip === "talk" ? x.type === "note" : x.type === "log")) : [];
  const tTitle = (id) => (D.tasks.find((t) => t.id === id) || D.projects.find((p) => p.id === id) || {}).title || "";
  const goFeed = (x) => { if (x.type === "note") { const [k, ...r] = String(x.itemId).split(":"); const ref = r.join(":"); if (k === "task") open({ type: "task", id: ref }); else if (k === "proj") open({ type: "project", id: ref, first: "news" }); }
    else if (x.col === "projects") open({ type: "project", id: x.targetId }); else if (x.targetId && x.col === "tasks") open({ type: "task", id: x.targetId }); };
  return <>
    <Card style={{ marginTop: 18 }}><More onClick={() => setOn(!on)}>{on ? "최근 7일 소식 ▴" : "최근 7일 소식 ▾"}</More></Card>
    {on && <>
      <div className="v2-chips" style={{ marginTop: 10 }}>{[["all", "전체"], ["talk", "대화"], ["log", "변경"]].map(([k, l]) => <Chip key={k} on={chip === k} onClick={() => setChip(k)}>{l}</Chip>)}</div>
      <Card style={{ marginTop: 10 }}>{feed.length === 0 ? <Empty>최근 7일 소식이 없어요</Empty> : feed.slice(0, n).map((x, i) => <Row key={x.id} title={x.type === "note" ? `${x.byName || ""} · ${tTitle(String(x.itemId).split(":").slice(1).join(":")) || "대화"}` : `${x.byName || ""} · ${LOG_L[x.action] || "기록"}`} sub={x.text} sub2={ago(x.at, now)} onClick={() => goFeed(x)} last={i === Math.min(n, feed.length) - 1 && feed.length <= n} />)}
        {feed.length > n && <More onClick={() => setN(n + 20)}>더 보기 ▾</More>}</Card>
    </>}
  </>;
}
