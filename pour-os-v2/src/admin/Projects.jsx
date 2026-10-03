// 관리자 · 프로젝트 — 출시가 겹치나, 어느 프로젝트가 위험한가, 출시일을 옮기면 무엇이 바뀌나
// 출시 줄(앞으로 8주 출시일 묶음 · 제품마다 7단계 칸) → 위험순 전체 목록(일반·신제품 한 목록) → 제품을 누르면 프로젝트 시트 + 관리자 덧붙임(LaunchTools)
import { useMemo, useState } from "react";
import { ymd, addDays, ddays, ddayLabel, md, ago, nameOf, ownersOf, dueOf, isDone, projOpen, projHealth, weekStart } from "../model.js";
import { lineup, previewLaunchMove, groupItems } from "../views.js";
import { LAUNCH_PHASES, launchPct, rebalanceLaunch } from "../launch.js";
import { nowNext } from "../turn.js";
import { PickList } from "../pick.jsx";
import { C, Act, Seg, TBtn, Head, Card, Empty, More } from "../ui.jsx";
import { Lv, SelBar, isLaunchP, openOneOff, wdOf, deltaLine } from "./common.jsx";

const PH_S = { plan: "기획", sample: "샘플", pack: "패킹", content: "콘텐", channel: "채널", stock: "입고", promo: "홍보" };
const ORD = { 위험: 0, 주의: 1, 순조: 2 };
const NAVY_BTN = { background: C.navy, color: "#fff", borderColor: C.navy };

export function ProjectsTab({ D, cu, A, idx, open }) {
  const [axis, setAxis] = useState("phase"), [n, setN] = useState(20);
  const now = new Date(), key = ymd(now);
  const L = useMemo(() => lineup(D, idx, key, 8).map((g) => {
    // 같은 날 넘김: 이 출시 묶음 안에서 앞 일과 뒤 일 기한이 같은 날인 쌍 (순서 꼬임에는 넣지 않고 여기서만 셈)
    const pids = new Set(g.items.map((x) => x.p.id)); let same = 0;
    (D.tasks || []).forEach((t) => { if (!pids.has(t.projectId) || !openOneOff(t) || !dueOf(t)) return; (idx.preds.get(t.id) || []).forEach((p) => { if (!isDone(p) && p.status !== "review" && dueOf(p) === dueOf(t)) same++; }); });
    return { ...g, same }; }), [D, idx]);
  const rows = useMemo(() => D.projects.filter(projOpen).map((p) => { const lp = isLaunchP(p);
    return { p, lp, h: projHealth(p, D, key, lp ? (x) => launchPct(x, D) : null), nn: nowNext(p, D, idx, key) }; })
    .sort((a, b) => ORD[a.h.level] - ORD[b.h.level] || String(a.p.dueDate || "9").localeCompare(String(b.p.dueDate || "9")) || String(a.p.title).localeCompare(String(b.p.title), "ko")), [D, idx]);
  const cnt = (v) => rows.filter((x) => x.h.level === v).length;
  const weeks = [...Array(8)].map((_, i) => addDays(weekStart(key), i * 7));
  return <>
    <Head right={<div style={{ width: 150 }}><Seg items={[["phase", "7단계"], ["week", "8주 축"]]} value={axis} onChange={setAxis} /></div>}>출시 줄 · 앞으로 8주</Head>
    {L.length === 0 ? <Card><Empty>앞으로 8주 안에 출시 예정인 신제품이 없어요</Empty></Card>
      : axis === "phase" ? L.map((g) => <div key={g.date} style={{ marginBottom: 12 }}>
        <div className="a-lnh" style={g.items.length >= 3 ? { fontWeight: 800, color: C.ink } : null}>
          {md(g.date)} ({wdOf(g.date)}) 출시 {g.items.length} · 남은 항목 {g.left}{g.late ? <> · <b style={{ color: C.red }}>지난 {g.late}</b></> : " · 지난 0"} · 같은 날 넘김 {g.same}</div>
        <Card>
          <div className="a-ln hd" aria-hidden="true"><span className="nm" />{LAUNCH_PHASES.map((ph) => <span key={ph.k} className="ph">{PH_S[ph.k]}</span>)}<span className="end" /></div>
          {g.items.map((x, i) => <button key={x.p.id} type="button" className="a-ln" style={{ borderBottom: i < g.items.length - 1 ? `1px solid ${C.line}` : "none" }} onClick={() => open({ type: "project", id: x.p.id })}
            aria-label={`${x.p.title} · ${x.pct}% · 남은 ${x.left}${x.late ? ` · 지남 ${x.late}` : ""}`}>
            <span className="nm">{x.p.title}</span>
            {x.phases.map((ph) => <span key={ph.k} className={"ph " + ph.state} title={`${ph.name} · 남은 ${ph.left}/${ph.total}`}>{ph.state === "cur" || ph.state === "late" ? ph.left : ""}</span>)}
            <span className="end">{x.late ? <b style={{ color: C.red }}>지남 {x.late}</b> : `${x.pct}%`}</span>
          </button>)}
        </Card></div>)
      : <div className="v2-hscroll"><div className="a-ax" role="table" aria-label="8주 축">
        <div className="a-axr hd" role="row"><span>제품</span>{weeks.map((w) => <span key={w}>{md(w)}~</span>)}</div>
        {L.flatMap((g) => g.items).map((x) => { const ts = (D.tasks || []).filter((t) => t.projectId === x.p.id && openOneOff(t));
          return <button key={x.p.id} type="button" className="a-axr" role="row" onClick={() => open({ type: "project", id: x.p.id })}>
            <span className="nm">{x.p.title}</span>
            {weeks.map((w) => { const e = addDays(w, 6), k = ts.filter((t) => dueOf(t) >= w && dueOf(t) <= e).length, ln = x.p.launchDate >= w && x.p.launchDate <= e;
              return <span key={w} className={"c" + (k > 25 ? " w3" : k > 10 ? " w2" : k > 0 ? " w1" : "") + (ln ? " ln" : "")}>{k || ""}{ln ? <i>▴출시</i> : null}</span>; })}
          </button>; })}
      </div></div>}
    <p className="a-hint">칸 = 기획 · 샘플 · 패킹 · 콘텐츠 · 채널 등록 · 창고 입고 · 출시 홍보. 채움 = 끝남 · 테두리 = 지금 단계(숫자 = 남은 항목) · 빨간 테두리 = 지난 항목 있음 · <TBtn onClick={() => open({ type: "launchOrder" })} style={{ padding: "0 2px", fontSize: 12 }}>신제품 순서표 보기 ›</TBtn></p>

    <Head>전체 프로젝트 {rows.length} · 위험 {cnt("위험")} · 주의 {cnt("주의")} · 순조 {cnt("순조")}</Head>
    <Card>{rows.slice(0, n).map((x, i) => { const p = x.p, lead = nameOf(D.users, p.assigneeId), stale = p.now && p.now.at ? ddays(ymd(new Date(p.now.at)), key) : null;
      return <div key={p.id} role="button" tabIndex={0} className="a-prow" onClick={() => open({ type: "project", id: p.id })} onKeyDown={(e) => { if (e.key === "Enter") open({ type: "project", id: p.id }); }} style={{ borderBottom: i < Math.min(n, rows.length) - 1 ? `1px solid ${C.line}` : "none" }}>
        <div className="t1"><Lv v={x.h.level} /><b>{p.title}</b></div>
        <div className="t2">{[lead ? `책임 ${lead}` : "책임 없음", p.dueDate ? `${x.lp ? "출시" : "마감"} ${md(p.dueDate)} ${ddayLabel(x.h.n)}` : x.lp ? "출시일 미정" : "마감 없음", `${x.h.pct}%`, `남은 ${x.h.open}`].join(" · ")}</div>
        {x.h.why.length > 0 && <div className="t3" style={{ color: x.h.late || (x.h.n != null && x.h.n < 0) ? C.red : C.ink }}>{x.h.why.join(" · ")}</div>}
        {x.nn.now && <div className="t3">지금 {x.nn.now.title} ({nameOf(D.users, ownersOf(x.nn.now)[0]) || "담당 없음"}){x.nn.others ? ` 외 ${x.nn.others}명` : ""}{x.nn.next ? ` → 다음 ${x.nn.next.title} (${nameOf(D.users, ownersOf(x.nn.next)[0]) || "담당 없음"})` : ""}</div>}
        {stale != null && stale < -7 && <div className="t3" style={{ color: C.ink, fontWeight: 800 }}>소식 {-stale}일 없음</div>}
      </div>; })}
      {rows.length > n && <More onClick={() => setN(n + 30)}>{rows.length - n}개 더 보기 ▾</More>}
      {rows.length === 0 && <Empty>진행 중인 프로젝트가 없어요</Empty>}</Card>
  </>;
}

// 프로젝트 시트 머리 아래 관리자 덧붙임: ① 출시일 옮기기 미리 보기 ② 기한 고르게 다시 나누기 ③ 항목 골라서 한꺼번에 바꾸기
// ①② 는 '이대로 바꾸기'를 누르기 전에는 아무것도 저장하지 않는다
export function LaunchTools({ p, D, cu, A, idx, setToast, open }) {
  const [nd, setNd] = useState(""), [busy, setBusy] = useState(""), [pick, setPick] = useState(false), [sel, setSel] = useState(() => new Set());
  const key = ymd(new Date()), lp = isLaunchP(p);
  const its = useMemo(() => (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), [D, p.id]);
  const move = useMemo(() => (lp && nd && nd !== p.launchDate ? previewLaunchMove(p, D, nd, key) : null), [D, p, nd]);
  const left = p.launchDate ? ddays(p.launchDate, key) : null;
  const rb = useMemo(() => (lp && p.launchDate && left != null && left > 0 && left < 56 ? rebalanceLaunch(its.filter((t) => t.launchItem), p.launchDate, key) : []), [D, p.launchDate]);
  const rbDays = rb.length ? [...new Set(rb.map((x) => x.due))].sort() : [];
  const doMove = async () => { setBusy("move"); await A.setLaunchDate(p, nd); setBusy(""); setNd(""); };
  const doRb = async () => { setBusy("rb"); await A.applyDues(rb, `${p.title} 기한 고르게 다시 나누기`); setBusy(""); };
  const openIts = its.filter((t) => !isDone(t));
  const groups = lp ? LAUNCH_PHASES.map((ph) => ({ key: ph.k, label: ph.name, items: openIts.filter((t) => t.phase === ph.k) })).filter((g) => g.items.length)
    : groupItems(openIts, "person", D);
  return <div className="a-xtra">
    {lp && <div className="a-box">
      <div className="a-boxh">{p.launchDate ? "출시일 옮기기" : "출시일 정하기"} <span>미리 보고 바꿔요</span></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, color: C.sub }}>지금 {p.launchDate ? `${md(p.launchDate)} (${wdOf(p.launchDate)})` : "미정"} →</span>
        <input type="date" aria-label="새 출시일" className="v2-sel" value={nd} onChange={(e) => setNd(e.target.value)} />
        {nd && <TBtn tone="mute" onClick={() => setNd("")}>✕ 그만</TBtn>}
      </div>
      {move && <div className="a-prev" role="status">
        <div><b>자동 기한 {move.changes.length}개가 옮겨져요</b></div>
        {deltaLine(D, move.changes, key).map((s) => <div key={s}>· {s}</div>)}
        <div>· 사람이 정한 기한 {move.keep}개는 그대로</div>
        {p.launchDate && <div>· {md(p.launchDate)} 출시 묶음 {move.sameBefore} → {move.sameBefore - 1} · {md(nd)} 출시 {move.sameAfter}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Act onClick={doMove} style={NAVY_BTN}>{busy === "move" ? "바꾸는 중" : "이대로 바꾸기"}</Act></div>
      </div>}
    </div>}
    {lp && rb.length > 0 && <div className="a-box">
      <div className="a-boxh">기한 고르게 다시 나누기 <span>출시까지 {left}일 · 8주보다 짧아 기한이 몰렸어요</span></div>
      <div className="a-prev">
        <div><b>자동 기한 항목 {rb.length}개</b>를 출시 전 평일에 순서표 차례대로 다시 나눠요 (주말·공휴일 건너뜀){rbDays.length ? ` · 새 기한 ${md(rbDays[0])}${rbDays.length > 1 ? `~${md(rbDays[rbDays.length - 1])}` : ""}` : ""}</div>
        {deltaLine(D, rb, key).map((s) => <div key={s}>· {s}</div>)}
        <div>· 사람이 정한 기한은 그대로예요</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Act onClick={doRb} style={NAVY_BTN}>{busy === "rb" ? "나누는 중" : "고르게 나누기"}</Act></div>
      </div>
    </div>}
    <div className="a-box">
      <button type="button" className="a-boxt" aria-expanded={pick} onClick={() => setPick(!pick)}>{lp ? "항목" : "업무"} 골라서 한꺼번에 바꾸기 {openIts.length} {pick ? "▴" : "▾"}</button>
      {pick && (groups.length ? <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} /> : <Card style={{ marginTop: 8 }}><Empty>열린 {lp ? "항목" : "업무"}이 없어요</Empty></Card>)}
      <SelBar D={D} cu={cu} A={A} sel={sel} setSel={setSel} setToast={setToast} />
    </div>
  </div>;
}
