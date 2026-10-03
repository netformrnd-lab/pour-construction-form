// 업무OS v2 — 달력 탭 (실사용): 한 달을 한눈에. 칸 = 그날 내 마감 수(농도), 빨강 = 지난 날 안 끝난 일·막힘, ▴ 출시·마감, → 내 차례 시작
// [나 ▾]로 동료 달력(보기만)·프로젝트(그 프로젝트 모든 사람 항목)를 고른다. 사람 비교 숫자·등급은 관리자 화면에만
import { useEffect, useMemo, useRef, useState } from "react";
import { ymd, md, ddays, ddayLabel, isMaster, activeUsers, nameOf, isDone, isMine, ownersOf, dueOf, riskOf, projOpen, reqOf, canSetDue, dueApprover, fxDueOn, fxIsMine, fxMeDone, fxLabel, fxTime, holidayName } from "./model.js";
import { calCells, turnStartOf } from "./views.js";
import { personNow, predLine } from "./turn.js";
import { MonthCal, CalHead, dayHead } from "./cal.jsx";
import { turnBits } from "./today.jsx";
import { moveDue } from "./task.jsx";
import { C, Act, Chip, Head, Card, Row, Empty, More, TBtn, Sheet, useLocal } from "./ui.jsx";
import { LS } from "./core.jsx";

const isLaunchP = (p) => String((p && p.id) || "").startsWith("lb_");

export function CalendarTab({ D, cu, A, open, T, TV, setToast }) {
  const key = ymd(new Date());
  const [f, setF] = useLocal(LS("cal2-" + cu.id), { who: "", pid: "" });
  const [ym, setYm] = useState(key.slice(0, 7)), [sel, setSel] = useState(key), [pick, setPick] = useState(false);
  const [dp, setDp] = useState(null);   // 날짜 고르기 모드: {queue:[업무 id], i}
  const [fxOpen, setFxOpen] = useState(false), [doneOpen, setDoneOpen] = useState(false), [tempOpen, setTempOpen] = useState(false);
  const listRef = useRef(null);
  const who = f.who && D.users.some((u) => u.id === f.who) ? f.who : cu.id, mine = who === cu.id;
  const proj = f.pid ? D.projects.find((p) => p.id === f.pid) : null;
  const oneOffOpenN = D.tasks.filter((t) => !t.isFixed && !isDone(t) && isMine(t, who)).length;
  const cells = useMemo(() => calCells(D, { temp: T.temp }, { uid: proj ? "*" : who, pid: proj ? proj.id : "", noTemp: !proj, turns: mine && !proj ? T : null, fxIfEmpty: !proj && oneOffOpenN === 0 }, ym, key),
    [D, T, who, proj && proj.id, ym, key, oneOffOpenN]);
  const ymNow = key.slice(0, 7);
  const myOpen = D.tasks.filter((t) => !t.isFixed && !isDone(t) && isMine(t, cu.id) && t.status !== "review" && t.status !== "hold" && !T.temp.has(t.id));
  const lateN = myOpen.filter((t) => dueOf(t) && dueOf(t) < key).length;
  // 날짜 없는 일 (출시일이 없어 기한이 빈 신제품 항목은 빼서 '출시일 미정'으로 → 내 정리에서 제품별로 출시일을 정함)
  const noLaunch = (t) => t.launchItem && !((D.projects.find((p) => p.id === t.projectId) || {}).launchDate);
  const noDateAll = myOpen.filter((t) => !dueOf(t) && t.tidySkip !== ymNow);
  const noDate = noDateAll.filter((t) => !noLaunch(t)), noLaunchN = noDateAll.length - noDate.length;
  // 날짜 고르기: 칸 한 번 누르면 그 날로 저장(맡긴 사람이 있으면 요청) → 다음 날짜 없는 일로 이어짐
  const dpTask = dp ? D.tasks.find((t) => t.id === dp.queue[dp.i]) : null;
  // 지난 날은 고르지 않음 · 저장마다 '기한 10/6 · 되돌리기'(되돌리면 그 일로 돌아감) · 마지막이면 끝
  const pickDay = (d) => {
    if (dpTask) {
      if (d < key) { setToast({ text: "지난 날은 기한으로 못 골라요 · 오늘이나 앞날을 눌러 주세요" }); return; }
      const can = canSetDue(dpTask, cu.id, D, isMaster(cu)), q = dp.queue, at = dp.i, ni = at + 1;
      moveDue(A, setToast, dpTask, d, can, "날짜 정하기", () => setDp({ queue: q, i: at }));
      setDp(ni < q.length ? { ...dp, i: ni } : null);
      return;
    }
    setSel(d);
    if (window.innerWidth < 1280) setTimeout(() => listRef.current && listRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }), 40);
  };
  const who2 = nameOf(D.users, who);
  const label = proj ? proj.title : mine ? "나" : who2;   // 프로젝트를 고르면 그 프로젝트 모든 담당 항목
  return <>
    <header style={{ padding: "10px 0 0" }}>
      <CalHead ym={ym} setYm={setYm} keyd={key} sel={sel} setSel={setSel} right={<button type="button" className="v2-sel" onClick={() => setPick(true)} style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", height: 34 }}>{label} ▾</button>} />
    </header>
    {(!mine || proj) && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, background: C.soft, fontSize: 12.5, color: C.ink, marginBottom: 6 }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj ? `${proj.title} · 모든 담당 항목` : `${who2} 달력 · 보기만 해요`}</span>
      {!mine && !proj && <TBtn onClick={() => open({ type: "person", id: who })} style={{ padding: "2px 4px", fontSize: 12.5 }}>사람 보기 ›</TBtn>}
      {proj && <TBtn onClick={() => open({ type: "project", id: proj.id })} style={{ padding: "2px 4px", fontSize: 12.5 }}>열기 ›</TBtn>}
      <TBtn onClick={() => setF({ who: "", pid: "" })} aria-label="거르기 풀기" style={{ padding: "2px 6px", fontSize: 12.5 }}>✕ 풀기</TBtn></div>}
    {dpTask ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12, background: C.ink, color: "#fff", fontSize: 13, marginBottom: 6 }}>
      <span style={{ flex: 1, minWidth: 0 }}>'{dpTask.title}' 기한으로 할 날을 누르세요{dpTask.dueAuto ? " · 출시일 연동이 풀려요" : ""}{!canSetDue(dpTask, cu.id, D, isMaster(cu)) ? ` · ${nameOf(D.users, dueApprover(dpTask, D))}님께 요청` : ""} ({dp.i + 1}/{dp.queue.length})</span>
      <TBtn onClick={() => { if (dp.i + 1 < dp.queue.length) setDp({ ...dp, i: dp.i + 1 }); else { setDp(null); setToast({ text: "나머지는 날짜 없이 그대로 두었어요" }); } }} style={{ color: "#C9D3F2", padding: "2px 4px" }}>{dp.i + 1 < dp.queue.length ? "건너뛰기" : "건너뛰고 끝"}</TBtn>
      <TBtn onClick={() => setDp(null)} style={{ color: "#fff", padding: "2px 4px" }}>✕ 그만</TBtn></div>
      : mine && !proj && (lateN > 0 || noDate.length > 0 || noLaunchN > 0) && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, padding: "2px 2px 6px", flexWrap: "wrap" }}>
        {[lateN > 0 && <TBtn key="l" onClick={() => open({ type: "triage" })} style={{ padding: "4px 0" }}><span style={{ color: C.text }}>지난 일 </span><b style={{ color: C.red }}>{lateN}</b> ›</TBtn>,
          noDate.length > 0 && <TBtn key="n" onClick={() => setDp({ queue: noDate.map((t) => t.id), i: 0 })} style={{ padding: "4px 0" }}><span style={{ color: C.text }}>날짜 없는 일 {noDate.length} · 달력에서 정하기</span> ›</TBtn>,
          noLaunchN > 0 && <TBtn key="d" onClick={() => open({ type: "myTidy", tab: "nodate" })} style={{ padding: "4px 0" }}><span style={{ color: C.text }}>출시일 미정 {noLaunchN}</span> ›</TBtn>]
          .filter(Boolean).reduce((a, x, j) => (j ? [...a, <span key={"s" + j} style={{ color: C.mute }}>·</span>, x] : [x]), [])}
      </div>}
    <div className="v2-calwrap">
      <MonthCal mode={proj ? "team" : "me"} ym={ym} setYm={setYm} cells={cells} sel={sel} onPick={pickDay} keyd={key} users={D.users} />
      <div ref={listRef}><DayList D={D} cu={cu} A={A} open={open} T={T} date={sel} cell={cells[sel]} keyd={key} who={who} mine={mine && !proj} proj={proj} fxOpen={fxOpen} setFxOpen={setFxOpen} doneOpen={doneOpen} setDoneOpen={setDoneOpen} tempOpen={tempOpen} setTempOpen={setTempOpen} /></div>
    </div>
    {pick && <WhoSheet D={D} cu={cu} T={T} f={f} setF={(x) => { setF(x); setPick(false); }} onClose={() => setPick(false)} />}
  </>;
}

// 고른 날 목록: ▴ 출시·마감 → 일정 → 고정업무(접힘) → 이날 끝나면 내 차례 → 업무 → 임시 담당(접힘) → 끝낸 일(접힘)
function DayList({ D, cu, A, open, T, date, cell, keyd, who, mine, proj, fxOpen, setFxOpen, doneOpen, setDoneOpen, tempOpen, setTempOpen }) {
  const c = cell || { n: 0, proj: [], items: [], temp: 0, done: 0 };
  const items = (D.tasks || []).filter((t) => !t.isFixed && dueOf(t) === date && (proj ? t.projectId === proj.id : isMine(t, who)));
  const open1 = items.filter((t) => !isDone(t) && t.status !== "review" && t.status !== "hold" && (proj || !T.temp.has(t.id)));
  const temp = proj ? [] : items.filter((t) => !isDone(t) && T.temp.has(t.id));
  const doneL = items.filter((t) => isDone(t) || t.status === "review");
  const evs = (D.events || []).filter((e) => e.date === date && (!mine || (e.attendeeIds || []).includes(cu.id) || !(e.attendeeIds || []).length));
  const fx = mine ? (D.tasks || []).filter((t) => t.isFixed && !t.paused && fxIsMine(t, cu.id) && fxDueOn(t, date)) : [];
  const fxLeft = fx.filter((t) => !fxMeDone(t, cu.id, date));
  // 달력 → 표식과 같은 날(turnStartOf: 남은 앞 일 중 가장 늦은 기한, 지났으면 오늘) · 그날 끝 예정인 앞 일을 보여 줌 (없으면 늦은 앞 일)
  const turnLines = mine ? [...T.byTask.entries()].filter(([, I]) => turnStartOf(I, keyd) === date)
    .map(([id, I]) => ({ me: D.tasks.find((t) => t.id === id), p: I.open.find((p) => dueOf(p) === date) || I.show || I.open[I.open.length - 1] })).filter((x) => x.me && x.p) : [];
  const sorted = open1.slice().sort((a, b) => (riskOf(a, keyd) && riskOf(a, keyd).red ? 0 : 1) - (riskOf(b, keyd) && riskOf(b, keyd).red ? 0 : 1) || String(a.title).localeCompare(String(b.title)));
  const pName = (pid) => ((D.projects || []).find((p) => p.id === pid) || {}).title || "";
  const old = ddays(date, keyd) < -30;
  return <>
    <Head>{dayHead(date, keyd, open1.length, c.proj.length)}</Head>
    <Card>
      {c.proj.map((p) => <Row key={p.id} tag={isLaunchP(p) ? "출시" : "프로젝트 마감"} title={p.title} sub={`책임 ${nameOf(D.users, p.assigneeId) || "없음"}`} onClick={() => open({ type: "project", id: p.id })} last={false} />)}
      {evs.map((e) => <Row key={e.id} tag="일정" title={e.title} sub={[e.time, e.place].filter(Boolean).join(" · ") || null} last={false} />)}
      {fx.length > 0 && (fxOpen ? fx.map((t) => <Row key={t.id} tag="고정" title={fxLabel(t, cu.id)} sub={fxTime(t, cu.id) || "시간 상관없음"} dim={fxMeDone(t, cu.id, date)} onClick={() => open({ type: "fixed", id: t.id })} right={date === keyd ? <Act on={fxMeDone(t, cu.id, date)} onClick={() => A.fxToggle(t)}>{fxMeDone(t, cu.id, date) ? "✓" : "완료"}</Act> : null} last={false} />)
        : <More onClick={() => setFxOpen(true)}>고정업무 {fx.length}{date <= keyd ? ` · ${fxLeft.length} 남음` : ""} ▾</More>)}
      {turnLines.map(({ me, p }) => <Row key={me.id + p.id} tag="→" title={`${nameOf(D.users, ownersOf(p)[0]) || "담당 없음"} "${p.title}"이 끝나면 내 "${me.title}" 차례`} sub={predLine(p, D.users, keyd)} onClick={() => open({ type: "task", id: p.id })} last={false} />)}
      {sorted.map((t, i) => { const b = turnBits(t, T, D, keyd);
        return <Row key={t.id} tag={b.tag} tagTone={b.tone} title={t.title} sub={[proj || !mine ? nameOf(D.users, ownersOf(t)[0]) || "담당 없음" : "", pName(t.projectId), b.sub].filter(Boolean).join(" · ") || null}
          onClick={() => open({ type: "task", id: t.id })} right={mine && isMine(t, cu.id) ? <Act onClick={() => A.finish(t)}>끝냄</Act> : null} last={i === sorted.length - 1 && !temp.length && !doneL.length} />; })}
      {temp.length > 0 && (tempOpen ? temp.map((t) => <Row key={t.id} tag="임시" title={t.title} sub={pName(t.projectId) + " · 담당을 정해야 해요"} onClick={() => open({ type: "task", id: t.id })} last={false} />)
        : <More onClick={() => setTempOpen(true)}>담당 정할 항목 {temp.length} ▾</More>)}
      {doneL.length > 0 && (doneOpen ? doneL.map((t) => <Row key={t.id} dim title={t.title} sub={t.status === "review" ? "확인 대기" : "끝남"} onClick={() => open({ type: "task", id: t.id })} last={false} />)
        : <More onClick={() => setDoneOpen(true)}>끝낸 일 {doneL.length} ▾</More>)}
      {!c.proj.length && !evs.length && !fx.length && !turnLines.length && !sorted.length && !temp.length && !doneL.length && <Empty>{old ? "30일보다 앞은 끝낸 일이 안 보여요" : "이날 마감인 일이 없어요"}</Empty>}
    </Card>
  </>;
}

// [나 ▾] 누구 달력 · 어느 프로젝트 — 동료마다 '지금 하는 일' 한 줄 (비교 숫자 없이)
function WhoSheet({ D, cu, T, f, setF, onClose }) {
  const key = ymd(new Date());
  const users = activeUsers(D.users).filter((u) => u.id !== cu.id).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const mineP = D.projects.filter((p) => projOpen(p) && (p.assigneeId === cu.id || (p.collaboratorIds || []).includes(cu.id) || D.tasks.some((t) => t.projectId === p.id && !t.isFixed && isMine(t, cu.id))));
  const rest = D.projects.filter((p) => projOpen(p) && !mineP.includes(p));
  const sortP = (a, b) => String(a.dueDate || "9").localeCompare(String(b.dueDate || "9"));
  const pRow = (p, last) => <Row key={p.id} title={p.title} sub={[isLaunchP(p) ? `출시 ${p.launchDate ? md(p.launchDate) : "미정"}` : p.dueDate ? `마감 ${md(p.dueDate)}` : "날짜 없음", nameOf(D.users, p.assigneeId) ? `책임 ${nameOf(D.users, p.assigneeId)}` : ""].filter(Boolean).join(" · ")}
    onClick={() => setF({ who: "", pid: p.id })} right={f.pid === p.id ? <span style={{ color: C.navy, fontWeight: 900 }}>✓</span> : null} last={last} />;
  return <Sheet title="누구 달력 · 어느 프로젝트" onClose={onClose}>
    <Head>사람</Head>
    <Card>
      <Row title={`나 · ${cu.name}`} sub={personNow(D, cu.id, key)} onClick={() => setF({ who: "", pid: "" })} right={!f.who && !f.pid ? <span style={{ color: C.navy, fontWeight: 900 }}>✓</span> : null} last={false} />
      {users.map((u, i) => <Row key={u.id} title={u.name} sub={personNow(D, u.id, key)} onClick={() => setF({ who: u.id, pid: "" })} right={f.who === u.id ? <span style={{ color: C.navy, fontWeight: 900 }}>✓</span> : null} last={i === users.length - 1} />)}
    </Card>
    <Head>내 프로젝트 · 앞사람 날짜까지 한 달력에</Head>
    <Card>{mineP.length ? mineP.sort(sortP).map((p, i) => pRow(p, i === mineP.length - 1)) : <Empty>내가 맡은 프로젝트가 없어요</Empty>}</Card>
    <Head>다른 프로젝트</Head>
    <Card>{rest.sort(sortP).map((p, i) => pRow(p, i === rest.length - 1))}</Card>
  </Sheet>;
}
