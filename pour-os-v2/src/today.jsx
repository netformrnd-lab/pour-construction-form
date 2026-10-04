// 업무OS v2 — 오늘 · 할 일 추가 · 지난 일 정리 · 내 할 일 모두 · 이제 내 차례 · 내 정리
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, WD, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, canSetDue, riskOf, assignedByMe, workloadOf, onTimeOf, weekStart, nextWorkday, isOffDay, weekMine,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, phaseOf } from "./launch.js";
import { predLine, lastWord, predsOf, upcomingTurns, upLine } from "./turn.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";
import { HoldBtn } from "./hold.jsx";
import { openTask, moveDue } from "./task.jsx";
import { PickList, BulkBar, dueChips, ro } from "./pick.jsx";
import { previewLaunchMove } from "./views.js";

const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
// 빠른 기한 버튼은 모두 pick.jsx dueChips (쉬는 날 빼고 · 버튼에 날짜까지)
const markSeen = (setSeen, id) => setSeen((s) => ({ ...s, [id]: true }));
// '이제 내 차례'를 본 것으로: 앞 일이 끝난 때까지 담은 키(info.seenKey · 없으면 예전 키) + (카드에서 시작·열면) 카드에 보인 '앞 일 마지막 말' 댓글
const markTurn = (setSeen, tid, info, notes) => { if (!info || !info.last) return; const w = notes ? lastWord(info.last, notes) : null;
  setSeen((s) => ({ ...s, [info.seenKey || `tn:${tid}:${info.last.id}`]: true, ...(w ? { ["nt:" + w.id]: true } : {}) })); };
// 줄 꼬리표·부제 (오늘·달력·프로젝트가 같이 씀): 위험 → 내 차례 → 기다림(부제)
export function turnBits(t, T, D, key) {
  const r = riskOf(t, key), info = T && T.byTask.get(t.id), sp = info && (info.show || info.open[0] || info.last);   // 보일 앞 일: 늦은 것 → 끝 예정이 가장 늦은 것
  if (r) return { tag: r.label, tone: r.red ? "red" : null, sub: info && info.state === "late" ? "앞 일: " + predLine(sp, D.users, key) : "" };
  if (info && info.state === "ready") return { tag: "내 차례", tone: "turn", sub: "" };
  if (info && (info.state === "wait" || info.state === "late")) return { tag: info.state === "late" ? "앞 일 늦음" : null, tone: info.state === "late" ? "red" : null, sub: "앞 일: " + predLine(sp, D.users, key) };
  return { tag: t.status === "inprogress" ? "진행 중" : null, tone: null, sub: "" };
}

// ───────────────── 오늘 ─────────────────
// 확인할 것 줄: 누르면 그 업무·프로젝트 · 오른쪽 버튼 한 번으로 처리 (팀원 오늘 · 관리자 '나에게 온 것'이 같이 씀)
export function inboxFns(D, A, open, setSeen) {
  const tOf = (id) => D.tasks.find((y) => y.id === id);
  const openInbox = (x) => { if (!x.keep) markSeen(setSeen, x.id);
    if (x.kind === "turnLate") return open({ type: "task", id: x.taskId, focus: "talk" });
    if (x.taskId) { const t = tOf(x.taskId); t ? openTask(open, t) : open({ type: "task", id: x.taskId }); } else if (x.projectId) open({ type: "project", id: x.projectId, first: x.kind === "launchNew" || x.kind === "bulk" || x.kind === "projHoldDue" ? "work" : "news" }); };
  const inboxAct = (x) => { const t = x.taskId && tOf(x.taskId);
    if (x.kind === "assigned" && t) return <Act onClick={() => A.ack(t)} style={BTN_ON}>받았어요</Act>;
    if (x.kind === "bulk") return <Act onClick={() => A.ackMany(x.bulkIds.map(tOf).filter(Boolean))} style={BTN_ON}>받았어요</Act>;
    if (x.kind === "review" && t) return <Act onClick={() => A.approve(t)} style={BTN_ON}>확인</Act>;
    if (x.kind === "dueReq" && t) return <Act onClick={() => A.answerDue(t, true)} style={BTN_ON}>수락</Act>;
    if (x.kind === "holdDue" && t) return <Act onClick={() => A.unhold(t)} style={BTN_ON}>다시 시작</Act>;
    if (x.kind === "help" && t) return <Act onClick={() => open({ type: "task", id: t.id, focus: "talk" })} style={BTN_ON}>답하기</Act>;
    if (x.kind === "turnLate") return <Act onClick={() => openInbox(x)}>묻기</Act>;
    if (x.kind === "turnOrder") return <Act onClick={() => openInbox(x)}>조정 요청</Act>;
    if (x.kind === "nextNoOwner") return <Act onClick={() => openInbox(x)}>정하기</Act>;
    return <Act onClick={() => openInbox(x)}>보기</Act>; };
  return { openInbox, inboxAct };
}
// 관리자 '나에게 온 것' — 팀원 '확인할 것'과 같은 계산 · 같은 줄 · 같은 버튼
export function InboxSheet({ D, A, open, TV, setSeen, onBack, onClose }) {
  const { openInbox, inboxAct } = inboxFns(D, A, open, setSeen), now = new Date(), readable = TV.inbox.filter((x) => !x.keep);
  return <Sheet title={`나에게 온 것 ${TV.inbox.length}`} onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, margin: "12px 2px 8px", lineHeight: 1.6 }}>확인 요청 · 도움 요청 · 기한 조정 · 막힘 · 맡김 · 담당 바뀜 · 내가 말한 대화의 답이 여기 모여요. 처리할 때까지 남는 것과 읽으면 사라지는 것이 있어요.</div>
    {TV.inbox.length === 0 ? <Card><Empty>새로 온 요청·알림이 없어요</Empty></Card>
      : <Card>{TV.inbox.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || TV.userName(x.who) || ""}${x.at ? (x.whoName || TV.userName(x.who) ? " · " : "") + ago(x.at, now) : ""}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={inboxAct(x)} last={i === TV.inbox.length - 1} />)}</Card>}
    {readable.length > 0 && <div style={{ marginTop: 10 }}><TBtn tone="mute" onClick={() => setSeen((s) => ({ ...s, ...Object.fromEntries(readable.map((x) => [x.id, true])) }))}>읽음 표시 {readable.length}</TBtn></div>}
  </Sheet>;
}
// 순서: 지금 할 일 1장 → 확인할 것 → 오늘(고정업무 접기 · 일회성 3줄) → 곧 내 차례 → 정리 한 줄
export function TodayTab({ D, cu, A, open, TV, T, seen, setSeen, setToast }) {
  const now = new Date(), key = TV.key;
  const up7 = useMemo(() => upcomingTurns(D, T, key, cu.id).filter((u) => u.start && u.start <= addDays(key, 6)), [D, T, key]);   // 곧 내 차례 = 7일 안에 오는 내 차례 (달력과 같은 기준)
  const [fxOpen, setFxOpen] = useState(TV.oneOffOpen === 0), [showFxDone, setShowFxDone] = useState(false), [allInbox, setAllInbox] = useState(false), [soonOpen, setSoonOpen] = useState(false);
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  const [cardId, setCardId] = useState(null);
  const inbox = allInbox ? TV.inbox : TV.inbox.slice(0, 3);
  const readable = TV.inbox.filter((x) => !x.keep);
  const tOf = (id) => D.tasks.find((y) => y.id === id);
  const { openInbox, inboxAct } = inboxFns(D, A, open, setSeen);
  const card = TV.ranked.find((x) => x.t.id === cardId) || TV.ranked[0];
  // 오늘 챙길 일회성: 오늘·내일 마감·진행 중 (카드·지난 일 빼고)
  const list = TV.ranked.filter((x) => x !== card && !(x.n != null && x.n < 0) && (x.t.status === "inprogress" || (x.n != null && x.n <= 1) || x.fresh));
  const fxLeft = TV.fixed.left, nextFx = fxLeft.find((x) => !x.late && x.min < 9999) || fxLeft[0];
  const ym = key.slice(0, 7);
  const noDate = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, cu.id) && !dueOf(t) && t.status !== "hold" && t.status !== "review" && t.tidySkip !== ym && !T.temp.has(t.id)).length;
  const tempMine = D.tasks.filter((t) => T.temp.has(t.id) && isMine(t, cu.id)).length;
  const lateN = TV.late.length;   // '하나씩 정리하기'가 카드 일까지 모두 보여 주므로 같은 수
  const wk = useMemo(() => weekMine(D, cu.id, key), [D, cu.id, key]);   // 이번 주(월~일) 내 완료율 — 나만 봄
  return <>
    <header style={{ padding: "14px 2px 2px" }}>
      <div style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>{dayTitle(now)} · {cu.name}</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 800, color: C.ink }}>남은 일 {TV.left} · 끝낸 일 {TV.doneToday}</h1>
      {wk.total > 0 && <button type="button" className="v2-wkpct" onClick={() => open({ type: "mine" })} aria-label={`이번 주 완료율 ${wk.pct}% · 전체 ${wk.total} 완료 ${wk.done} 진행 ${wk.doing} 지남 ${wk.late} · 내 할 일 모두 보기`}>
        <div className="t">이번 주 완료율 <b>{wk.pct}%</b> · 전체 {wk.total} · 완료 {wk.done} · 진행 {wk.doing} · 지남 <b style={{ color: wk.late ? C.red : C.ink }}>{wk.late}</b></div>
        <div className="bar"><i style={{ width: wk.pct + "%" }} /></div></button>}
    </header>
    <FocusCard key={card ? card.t.id : "none"} D={D} cu={cu} A={A} open={open} TV={TV} T={T} x={card} pName={pName} setSeen={setSeen} setToast={setToast} next={() => { const i = TV.ranked.indexOf(card); const nx = TV.ranked[(i + 1) % TV.ranked.length]; if (card && card.fresh && card.t) markTurn(setSeen, card.t.id, T.byTask.get(card.t.id)); setCardId(nx ? nx.t.id : null); }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 6 }}>
      {TV.freshN > (card && card.fresh ? 1 : 0) && <LineBtn onClick={() => open({ type: "turns" })}><b style={{ color: C.navy }}>이제 내 차례 {TV.freshN - (card && card.fresh ? 1 : 0)}개 더</b> ›</LineBtn>}
      {lateN > 0 && <LineBtn onClick={() => open({ type: "triage" })}><span>지난 일 <b style={{ color: C.red }}>{lateN}개</b> · 하나씩 정리하기</span> ›</LineBtn>}
      {TV.doing >= 4 && <div style={{ fontSize: 12.5, color: C.sub, padding: "6px 4px" }}>진행 중 {TV.doing}개예요 · 하나씩 끝내면 더 빨라요</div>}
    </div>
    <div className="v2-cols">
      <div>
        {TV.inbox.length > 0 && <>
          <Head right={readable.length > 0 && <TBtn tone="mute" onClick={() => setSeen((s) => ({ ...s, ...Object.fromEntries(readable.map((x) => [x.id, true])) }))}>읽음 표시</TBtn>}>확인할 것 {TV.inbox.length}</Head>
          <Card>
            {inbox.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || TV.userName(x.who) || ""}${x.at ? (x.whoName || TV.userName(x.who) ? " · " : "") + ago(x.at, now) : ""}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={inboxAct(x)} last={i === inbox.length - 1 && TV.inbox.length <= 3} />)}
            {TV.inbox.length > 3 && <More onClick={() => setAllInbox(!allInbox)}>{allInbox ? "접기 ▴" : `${TV.inbox.length}개 모두 보기 ▾`}</More>}
          </Card></>}
        <Head right={<TBtn onClick={() => open({ type: "mine" })}>내 할 일 모두 ›</TBtn>}>오늘</Head>
        <Card>
          {TV.fixed.total > 0 && (fxOpen
            ? <>{fxLeft.map((x, i) => { const t = x.t, [a, b] = fxCount(D.users, t, key), subs = fxSubs(t, cu.id);
                return <Row key={t.id} tag={x.miss ? `밀림 ${md(x.miss)}` : x.late ? "지남" : "고정"} tagTone={x.late ? "red" : null} title={fxLabel(t, cu.id)} sub={[fxTime(t, cu.id) || "시간 상관없음", t.recurType && t.recurType !== "daily" ? fxRecurL(t) : "", b > 1 ? `${a}/${b}명` : "", subs.length ? `체크리스트 ${subs.length}개` : ""].filter(Boolean).join(" · ")}
                  onClick={() => open({ type: "fixed", id: t.id })} right={<Act onClick={() => A.fxToggle(t)}>완료</Act>} last={false} />; })}
                {TV.fixed.done.length > 0 && <More onClick={() => setShowFxDone(!showFxDone)}>{showFxDone ? "끝낸 고정업무 접기 ▴" : `끝낸 고정업무 ${TV.fixed.done.length} ▾`}</More>}
                {showFxDone && TV.fixed.done.map((x) => <Row key={x.t.id} dim title={fxLabel(x.t, cu.id)} sub={`✓ ${hm(x.t.doneAtBy && x.t.doneAtBy[cu.id])}`} onClick={() => open({ type: "fixed", id: x.t.id })} right={<Act on onClick={() => A.fxToggle(x.t)}>✓ 취소</Act>} />)}
                {TV.oneOffOpen > 0 && <More onClick={() => setFxOpen(false)}>고정업무 접기 ▴</More>}</>
            : <More onClick={() => setFxOpen(true)}>{fxLeft.length ? <>고정업무 <b>{fxLeft.length}개 남음</b>{nextFx ? ` · 다음 ${fxTime(nextFx.t, cu.id) || ""} ${fxLabel(nextFx.t, cu.id)}` : ""} ▾</> : <>고정업무 {TV.fixed.total}개 다 했어요 ✓ ▾</>}</More>)}
          {list.slice(0, 3).map((x, i) => { const b = turnBits(x.t, T, D, key);
            return <Row key={x.t.id} tag={x.fresh ? "이제 내 차례" : b.tag} tagTone={x.fresh ? "turn" : b.tone} title={x.t.title} sub={[pName(x.t.projectId), dueOf(x.t) ? ddayLabel(x.n) : "", b.sub].filter(Boolean).join(" · ") || null}
              onClick={() => open({ type: "task", id: x.t.id })} right={<Act onClick={() => A.finish(x.t)}>끝냄</Act>} last={i === Math.min(3, list.length) - 1 && list.length <= 3} />; })}
          {list.length > 3 && <More onClick={() => open({ type: "mine" })}>{list.length - 3}개 더 · 내 할 일 모두 ›</More>}
          {!list.length && !TV.fixed.total && <Empty>오늘·내일 마감이거나 하는 중인 일이 없어요</Empty>}
        </Card>
      </div>
      <div>
        {up7.length > 0 && <>
          <Head right={<TBtn onClick={() => open({ type: "upturns" })}>모두 ›</TBtn>}>곧 내 차례 {up7.length}{up7.some((u) => u.level === "late" || u.level === "risk") ? <span style={{ color: C.red }}> · 늦을 수 있음 {up7.filter((u) => u.level === "late" || u.level === "risk").length}</span> : null}</Head>
          <Card>{up7.slice(0, soonOpen ? 8 : 3).map((u, i, arr) => <UpRow key={u.t.id} u={u} D={D} open={open} keyd={key} last={i === arr.length - 1 && up7.length <= (soonOpen ? 8 : 3)} />)}
            {up7.length > 3 && <More onClick={() => setSoonOpen(!soonOpen)}>{soonOpen ? "접기 ▴" : `${up7.length - 3}개 더 ▾`}</More>}</Card>
        </>}
        {(noDate > 0 || tempMine > 0) && <Card style={{ marginTop: 14 }}><More onClick={() => open({ type: "myTidy", tab: noDate ? "nodate" : "temp" })}>
          {[noDate ? `날짜 없는 일 ${noDate}` : "", tempMine ? `담당 정할 항목 ${tempMine}` : ""].filter(Boolean).join(" · ")} ›</More></Card>}
      </div>
    </div>
    <div className="v2-fab"><Big onClick={() => open({ type: "add" })}>+ 할 일 추가 · 맡기기</Big></div>
  </>;
}
function LineBtn({ children, onClick }) {
  return <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", padding: "9px 4px", border: "none", borderBottom: `1px solid ${C.line}`, background: "none", fontFamily: "inherit", fontSize: 13.5, color: C.text, cursor: "pointer", textAlign: "left" }}>{children}</button>;
}

// 지금 할 일 — 한 번에 하나만 크게. 큰 버튼은 늘 1개 (할 일이면 '시작하기', 하는 중이면 '끝냈어요')
// '이제 내 차례'면: 앞사람이 무엇을 끝냈는지 · 앞 일 마지막 말 · 앞 일 자료를 같이 보여 줌
function FocusCard({ D, cu, A, open, TV, T, x, pName, next, setSeen, setToast }) {
  const [mode, setMode] = useState(""), [txt, setTxt] = useState("");
  if (!x) return <Card style={{ marginTop: 12, padding: "16px 16px" }}><div style={{ fontSize: 12.5, fontWeight: 800, color: C.sub }}>지금 할 일</div><div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 4 }}>급한 일이 없어요</div><div style={{ fontSize: 13.5, color: C.sub, marginTop: 4 }}>고정업무를 하거나, 아래 '+ 할 일 추가'로 새 일을 적어 두세요.</div></Card>;
  const t = x.t, key = TV.key, late = x.n != null && x.n < 0, can = canSetDue(t, cu.id, D, isMaster(cu)), appr = nameOf(D.users, dueApprover(t, D));
  const info = T.byTask.get(t.id), pred = info && info.last, word = pred ? lastWord(pred, D.notes) : null;
  const pFiles = pred ? (pred.attachments || []).length + D.notes.filter((n) => n.itemId === taskNoteId(pred.id) && !n.deleted).reduce((a, n) => a + (n.files || []).length, 0) : 0;
  const seenTurn = () => { if (x.fresh && pred) markTurn(setSeen, t.id, info, D.notes); };
  const moveTo = (d) => moveDue(A, setToast, t, d, can, "지난 일 정리");
  const b = turnBits(t, T, D, key);
  return <div style={{ marginTop: 12, background: "#fff", border: `1.5px solid ${late || (x.risk && x.risk.red) ? "#E2B7BB" : x.fresh ? C.navy : "#C9D2EA"}`, borderRadius: 18, padding: "14px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: x.fresh ? C.navy : C.sub, flex: 1, minWidth: 0 }}>{x.fresh && pred ? `이제 내 차례 · ${nameOf(D.users, ownersOf(pred)[0])}님이 "${pred.title}"을 끝냈어요${info.readyAt ? " · " + ago(info.readyAt) : ""}` : "지금 할 일"}</span>
      {TV.ranked.length > 1 && <TBtn onClick={() => { setMode(""); next(); }} style={{ padding: "4px 2px", flex: "0 0 auto" }}>다른 일 ›</TBtn>}
    </div>
    <div role="button" tabIndex={0} onClick={() => { seenTurn(); open({ type: "task", id: t.id }); }} onKeyDown={(e) => { if (e.key === "Enter") { seenTurn(); open({ type: "task", id: t.id }); } }} style={{ cursor: "pointer", marginTop: 4 }}>
      {!x.fresh && (x.risk || b.tag) && <span className={"v2-tag" + ((x.risk && x.risk.red) || b.tone === "red" ? " red" : b.tone === "turn" ? " turn" : "")} style={{ marginBottom: 4 }}>{x.risk ? x.risk.label : b.tag}</span>}
      <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1.35, wordBreak: "keep-all" }}>{t.title}</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{[pName(t.projectId), dueOf(t) ? `기한 ${md(dueOf(t))}` : "기한 미정", reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : ""].filter(Boolean).join(" · ")}</div>
      {t.feedback && <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 700, marginTop: 6 }}>수정 요청: {t.feedback.text}</div>}
      {x.fresh && word && <div className="v2-clamp3" style={{ fontSize: 13.5, color: C.text, marginTop: 6, padding: "8px 10px", background: C.soft, borderRadius: 10, lineHeight: 1.5, wordBreak: "break-word" }}><b style={{ color: C.ink }}>{word.handoff ? `${word.byName || "앞사람"}님이 남긴 말` : "앞 일 마지막 말"}</b> · {word.text}</div>}
      {!x.fresh && b.sub && <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{b.sub}</div>}
      {t.firstStep && <div style={{ fontSize: 13.5, color: C.ink, marginTop: 6 }}>첫 걸음: {t.firstStep}</div>}
    </div>
    {x.fresh && pred && pFiles > 0 && <TBtn onClick={() => { seenTurn(); open({ type: "task", id: pred.id, focus: "files" }); }} style={{ padding: "6px 0" }}>앞 일 자료 {pFiles} ›</TBtn>}
    {late ? <>
      <div style={{ fontSize: 13, color: C.sub, margin: "10px 0 6px" }}>{can ? "끝냈으면 '끝냈어요', 아니면 새 기한을 골라요" : `새 기한은 ${appr || "책임자"}님께 요청으로 가요`}</div>
      <div className="v2-chips"><Act onClick={() => A.finish(t)} style={BTN_ON}>끝냈어요</Act>
        {dueChips(key).map(([l, d]) => <Act key={d} onClick={() => moveTo(d)}>{can ? l : l + " 요청"}</Act>)}
        <HoldBtn t={t} A={A}>보류</HoldBtn></div>
    </> : <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
      {t.status !== "inprogress" ? <Big onClick={() => { seenTurn(); A.setStatus(t, "inprogress"); }} style={{ height: 46, flex: 1 }}>시작하기</Big>
        : <Big onClick={() => A.finish(t)} style={{ height: 46, flex: 1 }}>끝냈어요</Big>}
      {t.status !== "inprogress" && <TBtn onClick={() => A.finish(t)}>바로 끝냄</TBtn>}
      {!t.blocked && <TBtn onClick={() => { setTxt(""); setMode(mode === "block" ? "" : "block"); }}>막혔어요</TBtn>}
    </div>}
    {mode === "block" && <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="무엇 때문에 막혔나요?" aria-label="막힌 이유" style={{ ...inp, padding: "9px 12px", fontSize: 14 }} /><Act onClick={() => { if (txt.trim()) { A.block(t, txt.trim()); setMode(""); } }}>알리기</Act></div>}
  </div>;
}

// 이제 내 차례 모두 (앞 일이 방금 끝난 내 일)
export function TurnSheet({ D, cu, A, open, TV, T, setSeen, onBack, onClose }) {
  const key = TV.key, list = TV.ranked.filter((x) => x.fresh);
  return <Sheet title={`이제 내 차례 ${list.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px", lineHeight: 1.6 }}>앞사람이 끝내서 이제 시작할 수 있는 일이에요. 시작하면 이 목록에서 빠져요.</p>
    <Card>{list.length === 0 ? <Empty>지금은 없어요</Empty> : list.map((x, i) => { const info = T.byTask.get(x.t.id), p = info && info.last;
      return <Row key={x.t.id} tag="이제 내 차례" tagTone="turn" title={x.t.title} sub={p ? `${nameOf(D.users, ownersOf(p)[0])}님이 "${p.title}" 끝냄${info.readyAt ? " · " + ago(info.readyAt) : ""}` : ""} sub2={dueOf(x.t) ? `기한 ${md(dueOf(x.t))} · ${ddayLabel(x.n)}` : null}
        onClick={() => { markTurn(setSeen, x.t.id, info); open({ type: "task", id: x.t.id }); }} right={<Act onClick={() => { markTurn(setSeen, x.t.id, info); A.setStatus(x.t, "inprogress"); }} style={BTN_ON}>시작</Act>} last={i === list.length - 1} />; })}</Card>
  </Sheet>;
}

// 내 정리: [날짜 없는 일 | 담당 정할 항목] — 지우지 않고 날짜·담당만 정함
// st/save: 시트 칸에 적어 둔 탭·고른 것·출시일 → 업무를 열었다가 '뒤로' 오면 그대로
export function MyTidySheet({ D, cu, A, open, T, onBack, onClose, tab0, st, save, setToast }) {
  const [tab, setTab] = useState((st && st.tab) || tab0 || "nodate"), [sel, setSel] = useState(() => new Set((st && st.sel) || [])), [ld, setLd] = useState((st && st.ld) || {}), [ask, setAsk] = useState(null);
  const key = ymd(new Date()), ym = key.slice(0, 7);
  const go = (s) => { if (save) save({ tab, sel: [...sel], ld }); open(s); };
  // 출시일 정하기: 자동 기한이 옮겨질 항목 수를 먼저 보여 주고, 30개 이상이면 한 번 더 묻기 (되돌리기는 A.setLaunchDate 알림)
  const moveN = (p) => (ld[p.id] && ld[p.id] >= key ? previewLaunchMove(p, D, ld[p.id], key).changes.length : 0);
  const setLaunch = (p) => { const n = moveN(p); if (n >= 30) setAsk({ p, d: ld[p.id], n }); else A.setLaunchDate(p, ld[p.id]); };
  const mine = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, cu.id) && t.status !== "review");
  const nodate = mine.filter((t) => !dueOf(t) && t.status !== "hold" && t.tidySkip !== ym && !T.temp.has(t.id));
  // 출시일이 없어 기한이 빈 신제품 항목은 제품별 한 줄로
  const byLaunch = {}; const plain = [];
  nodate.forEach((t) => { const p = t.launchItem && D.projects.find((x) => x.id === t.projectId); if (p && !p.launchDate) (byLaunch[p.id] = byLaunch[p.id] || { p, items: [] }).items.push(t); else plain.push(t); });
  const temp = D.tasks.filter((t) => T.temp.has(t.id) && isMine(t, cu.id)), tempIds = new Set(temp.map((t) => t.id));   // 돌아왔을 때 이미 넘긴 항목은 고른 것에서 빠짐
  const takeAll = (g) => A.bulk(g.items, () => ({ ownerAuto: false, ownerFrom: "set", ackAt: new Date().toISOString() }), `내가 할게요 · ${g.label}`);
  const tempG = Object.values(temp.reduce((a, t) => { const p = D.projects.find((x) => x.id === t.projectId) || { id: "", title: "프로젝트 없음" }; (a[p.id] = a[p.id] || { key: p.id, label: p.title, items: [] }).items.push(t); return a; }, {}));
  const chips = dueChips(key);
  return <Sheet title="내 정리" onBack={onBack} onClose={onClose}>
    <div style={{ margin: "12px 0" }}><Seg items={[["nodate", `날짜 없는 일 ${nodate.length}`], ["temp", `담당 정할 항목 ${temp.length}`]]} value={tab} onChange={(v) => { setTab(v); setSel(new Set()); }} /></div>
    {tab === "nodate" && <>
      {Object.values(byLaunch).map(({ p, items }) => { const lead = p.assigneeId === cu.id || isMaster(cu);
        return <Card key={p.id} style={{ padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>{p.title} · 출시일 미정 · 항목 {items.length}</div>
          {lead ? <div className="v2-chips" style={{ marginTop: 8 }}><input type="date" aria-label="출시일" min={key} value={ld[p.id] || ""} onChange={(e) => setLd({ ...ld, [p.id]: e.target.value })} className="v2-sel" />
            {ld[p.id] && (ld[p.id] < key ? <span style={{ fontSize: 12.5, color: C.sub }}>오늘 이후로 골라 주세요</span>
              : <Act onClick={() => setLaunch(p)} style={BTN_ON}>출시일 정하기 · 기한 {moveN(p)}개 자동</Act>)}</div>
            : <TBtn onClick={() => go({ type: "project", id: p.id, first: "news" })} style={{ padding: "6px 0" }}>책임 {nameOf(D.users, p.assigneeId) || "없음"}님께 묻기 ›</TBtn>}
        </Card>; })}
      <Card>{plain.length === 0 ? <Empty>날짜 없는 일이 없어요</Empty> : plain.map((t, i) => { const can = canSetDue(t, cu.id, D, isMaster(cu)), set = (d) => moveDue(A, setToast, t, d, can, "날짜 정하기");
        return <div key={t.id} style={{ padding: "11px 14px", borderBottom: i < plain.length - 1 ? `1px solid ${C.line}` : "none" }}>
          <div role="button" tabIndex={0} onClick={() => go({ type: "task", id: t.id })} onKeyDown={(e) => { if (e.key === "Enter") go({ type: "task", id: t.id }); }} style={{ fontSize: 14.5, fontWeight: 700, color: C.text, cursor: "pointer" }}>{t.title}</div>
          <div style={{ fontSize: 12, color: C.sub, margin: "2px 0 6px" }}>{(D.projects.find((p) => p.id === t.projectId) || {}).title || ""}{!can ? ` · 기한은 ${nameOf(D.users, dueApprover(t, D))}님께 요청` : ""}</div>
          <div className="v2-chips">{chips.map(([l, d]) => <Chip key={d} onClick={() => set(d)}>{can ? l : l + " 요청"}</Chip>)}
            <input type="date" aria-label="날짜" onChange={(e) => e.target.value && set(e.target.value)} className="v2-sel" />
            <TBtn tone="mute" onClick={() => A.tidySkip(t)}>날짜 없이 두기</TBtn><HoldBtn t={t} A={A} tone="mute">보류</HoldBtn></div>
        </div>; })}</Card>
    </>}
    {tab === "temp" && <>
      <p style={{ fontSize: 13.5, color: C.sub, margin: "0 2px 4px", lineHeight: 1.6 }}>담당이 비어 책임자인 나에게 임시로 들어온 항목이에요. 내가 할 것은 '내가 할게요', 나눌 것은 골라서 담당을 바꿔요.</p>
      {tempG.map((g) => <div key={g.key} style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><Act onClick={() => (g.items.length >= 30 ? setAsk({ mine: g }) : takeAll(g))}>{g.label} {g.items.length}개 내가 할게요</Act></div>)}
      <PickList D={D} groups={tempG} sel={sel} setSel={setSel} open={go} temp={T.temp} />
      {sel.size > 0 && <div style={{ height: 120 }} />}
      <BulkBar D={D} cu={cu} A={A} ids={new Set([...sel].filter((id) => tempIds.has(id)))} clear={() => setSel(new Set())} />
    </>}
    {ask && ask.mine && <Ask title={`${ask.mine.items.length}개를 내가 할까요?`} body={`${ask.mine.label} · 임시 담당 항목 ${ask.mine.items.length}개를 내 일로 정해요.\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.`} yes="내가 할게요" onNo={() => setAsk(null)} onYes={() => { const g = ask.mine; setAsk(null); takeAll(g); }} />}
    {ask && ask.p && <Ask title={`출시일을 ${md(ask.d)}${ro(md(ask.d))} 바꿀까요?`} body={`${ask.p.title} · 자동 기한 ${ask.n}개가 같이 옮겨져요 (다른 사람 항목 포함).\n5초 안에 되돌릴 수 있고, 옮기기 전 기한은 기록에 남아요.`} yes="바꾸기" onNo={() => setAsk(null)} onYes={() => { const a = ask; setAsk(null); A.setLaunchDate(a.p, a.d); }} />}
  </Sheet>;
}

// 지난 일 정리 — 한 화면에 하나씩: 끝냈어요 / 새 기한 / 보류 / 건너뛰기
// st/save: 정리할 목록·몇 번째인지를 시트 칸에 적어 둠 → '업무 열기'에서 돌아와도 이어서
export function FocusTriage({ D, cu, A, open, TV, onBack, onClose, st, save, setToast }) {
  const [q] = useState(() => (st && st.q) || TV.late.map((x) => x.t.id)), [i, setI] = useState((st && st.i) || 0), [date, setDate] = useState("");
  const key = ymd(new Date());
  useEffect(() => { if (save) save({ q, i }); }, [i]);
  const t = q[i] ? D.tasks.find((x) => x.id === q[i]) : null;
  const next = () => { setI(i + 1); setDate(""); };
  if (i >= q.length) return <Sheet title="지난 일 정리" onBack={onBack} onClose={onClose} foot={<Big onClick={onBack || onClose}>닫기</Big>}><div style={{ padding: "40px 4px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>다 정리했어요</div><div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{q.length}개를 정리했어요. 이제 기한이 모두 앞날이에요.</div></div></Sheet>;
  // 업무를 열어 끝냈거나·보류했거나·기한을 바꾸고 돌아오면 그 일은 건너뜀
  if (!t || isDone(t) || t.status === "review" || t.status === "hold" || !isMine(t, cu.id) || !dueOf(t) || dueOf(t) >= key) { setTimeout(next, 0); return null; }
  const can = canSetDue(t, cu.id, D, isMaster(cu)), appr = nameOf(D.users, dueApprover(t, D)), n = ddays(dueOf(t), key);
  const p = D.projects.find((x) => x.id === t.projectId);
  const move = (d) => { moveDue(A, setToast, t, d, can, "지난 일 정리"); next(); };
  return <Sheet title={`지난 일 정리 ${i + 1}/${q.length}`} onBack={onBack} onClose={onClose}>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, margin: "14px 0 18px", overflow: "hidden" }}><div style={{ width: Math.round((i / q.length) * 100) + "%", height: "100%", background: C.navy }} /></div>
    <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 6, color: C.red, background: "#F8E9EA" }}>{n != null && n < 0 ? `${-n}일 지남` : "기한 확인"}</span>
    <h2 style={{ fontSize: 21, fontWeight: 800, color: C.ink, margin: "8px 0 6px", lineHeight: 1.35, wordBreak: "keep-all" }}>{t.title}</h2>
    <div style={{ fontSize: 14, color: C.sub }}>{[p && p.title, `기한 ${md(dueOf(t))}`, reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : ""].filter(Boolean).join(" · ")}</div>
    {t.memo && <Card style={{ padding: "10px 14px", marginTop: 12 }}><div style={{ fontSize: 13.5, color: C.text, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{t.memo}</div></Card>}
    <Big onClick={() => { A.finish(t); next(); }} style={{ marginTop: 18 }}>끝냈어요</Big>
    <div className="v2-lab">{can ? "아직이면 새 기한" : `아직이면 새 기한 요청 (${appr || "책임자"}님이 수락하면 바뀌어요)`}</div>
    <div className="v2-chips">{dueChips(key).map(([l, d]) => <Chip key={d} onClick={() => move(d)}>{l}</Chip>)}
      <input type="date" aria-label="날짜 고르기" min={key} value={date} onChange={(e) => setDate(e.target.value)} className="v2-sel" />{date && <Act onClick={() => move(date)} style={BTN_ON}>{md(date)}{ro(md(date))}</Act>}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 18, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <HoldBtn t={t} A={A} after={next}>보류 (당분간 안 함)</HoldBtn>
      <TBtn onClick={() => open({ type: "task", id: t.id })}>업무 열기 · 넘기기</TBtn>
      <TBtn tone="mute" onClick={next}>건너뛰기</TBtn>
    </div>
  </Sheet>;
}

// 할 일 추가 · 맡기기 — 사람을 고르면 그 사람의 2주 일정을 보고 기한을 바로 고른다
export function AddSheet({ D, cu, A, onBack, onClose, preset, setToast }) {
  // 기본 기한: 오늘 (다른 사람에게 맡길 때 오늘이 쉬는 날이면 다음 평일)
  const t0 = ymd(new Date()), w0 = preset.assigneeId || cu.id;
  const [title, setTitle] = useState(""), [who, setWho] = useState(w0), [due, setDue] = useState(preset.dueDate || (w0 !== cu.id && isOffDay(t0) ? nextWorkday(t0) : t0));
  const [pid, setPid] = useState(preset.projectId || ""), [keep, setKeep] = useState(false), [busy, setBusy] = useState(false), [step, setStep] = useState(""), [review, setReview] = useState(true);
  const ref = useAutoFocus();
  const now = new Date(), today = ymd(now);
  const users = activeUsers(D.users);
  const recent = useMemo(() => { const c = {}; D.tasks.forEach((t) => { if (t.requestedBy === cu.id && t.assigneeId && t.assigneeId !== cu.id) c[t.assigneeId] = Math.max(c[t.assigneeId] || 0, Date.parse(t.requestedAt || 0) || 0); });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id]) => users.find((u) => u.id === id)).filter(Boolean).slice(0, 5); }, [D.tasks]);
  const quick = [cu, ...recent.filter((u) => u.id !== cu.id)];
  const pickWho = (id) => { setWho(id); if (id !== cu.id && (!due || (isOffDay(due) && due === today))) setDue(nextWorkday(today)); };   // 남에게 맡길 땐 기한 필수 · 쉬는 날 오늘이면 다음 평일
  if (who && !quick.some((u) => u.id === who)) { const u = users.find((x) => x.id === who); if (u) quick.push(u); }
  const myProj = D.projects.filter((p) => projOpen(p) && projMine(p, cu.id, D.tasks)).slice(0, 4);
  if (pid && !myProj.some((p) => p.id === pid)) { const p = D.projects.find((x) => x.id === pid); if (p) myProj.unshift(p); }
  const other = who !== cu.id, wl = useMemo(() => workloadOf(D, who, now), [D, who]), ot = useMemo(() => onTimeOf(D, who, now), [D, who]);
  const sameDay = due ? wl.dueOn(due) : [];
  const ok = title.trim() && !busy && (!other || due);
  const save = async () => { if (!ok) return; setBusy(true);
    const t = await A.addTask({ title, assigneeId: who, dueDate: due, projectId: pid, firstStep: step, noReview: other ? !review : true, ...(preset.deps ? { deps: preset.deps } : {}) });
    setBusy(false); if (!t) return;
    setToast({ text: other ? `${nameOf(D.users, who)}님에게 맡겼어요 · 받으면 '받음'으로 보여요` : "추가했어요" });
    if (keep) { setTitle(""); setStep(""); } else (onBack || onClose)(); };
  const heavy = (n) => n >= 5;
  const after = preset.deps && preset.deps.length ? D.tasks.find((t) => t.id === preset.deps[0]) : null;
  return <Sheet title={after ? "다음 일 맡기기" : "할 일 추가 · 맡기기"} onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!ok}>{other ? `${nameOf(D.users, who)}님에게 맡기기${due ? " · " + md(due) + "까지" : ""}` : "추가"}</Big>}>
    {after && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: C.soft, fontSize: 13.5, color: C.ink }}>'{after.title}'이 끝나면 이어서 할 일이에요. 앞 일이 끝나는 순간 담당에게 '이제 내 차례'가 떠요.</div>}
    <label className="v2-lab" htmlFor="v2-add-title">무엇을</label>
    <input id="v2-add-title" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) save(); }} placeholder="할 일 제목" style={inp} />
    <div className="v2-lab">누가</div>
    <div className="v2-chips">{quick.map((u) => <Chip key={u.id} on={who === u.id} onClick={() => pickWho(u.id)}>{u.id === cu.id ? "나" : u.name}</Chip>)}
      <select aria-label="다른 사람" value={quick.some((u) => u.id === who) ? "" : who} onChange={(e) => e.target.value && pickWho(e.target.value)} className="v2-sel"><option value="">다른 사람 ▾</option>{users.filter((u) => !quick.some((q) => q.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="v2-lab">언제까지 {other ? <span style={{ color: C.mute, fontWeight: 600 }}>· {nameOf(D.users, who)}님 2주 일정 (숫자 = 그날 마감 수)</span> : ""}</div>
    <div style={{ fontSize: 13, color: C.sub, margin: "-2px 2px 8px" }}>{other ? `${nameOf(D.users, who)} · ` : "나 · "}열린 일 {wl.open} · 진행 {wl.doing}{wl.late ? <b style={{ color: C.red }}> · 지난 일 {wl.late}</b> : ""}</div>
    <div className="v2-strip" role="listbox" aria-label="기한 고르기">
      {wl.week.map((d) => { const on = due === d.date, n = d.list.length, we = isOffDay(d.date);   // 주말·공휴일 회색 (달력과 같게)
        return <button key={d.date} type="button" role="option" aria-selected={on} onClick={() => setDue(d.date)} className={"v2-day" + (on ? " on" : "") + (we ? " we" : "")}>
          <span>{d.date === today ? "오늘" : md(d.date)}</span><span>{d.wd}</span><b className={heavy(n) ? "hv" : ""}>{n ? `${n}건` : "-"}</b></button>; })}
    </div>
    <div className="v2-chips" style={{ marginTop: 8 }}><input type="date" aria-label="다른 날짜" value={due} onChange={(e) => setDue(e.target.value)} className="v2-sel" />{!other && <Chip on={!due} onClick={() => setDue("")}>미정</Chip>}</div>
    {due && sameDay.length > 0 && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>{md(due)} 마감 {sameDay.length}건: {sameDay.slice(0, 3).map((t) => t.title).join(" · ")}{sameDay.length > 3 ? ` 외 ${sameDay.length - 3}` : ""}{heavy(sameDay.length) ? <b style={{ color: C.ink }}> — 많아요. 다른 날을 권해요</b> : ""}</div>}
    {other && !due && <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 700, marginTop: 8 }}>다른 사람에게 맡길 땐 기한을 꼭 정해 주세요</div>}
    <label className="v2-lab" htmlFor="v2-add-step">첫 걸음 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 5분 안에 시작할 수 있는 한 가지)</span></label>
    <input id="v2-add-step" value={step} onChange={(e) => setStep(e.target.value)} placeholder="예: 지난번 시안 파일 열어 보기" style={inp} />
    <div className="v2-lab">프로젝트 <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span></div>
    <div className="v2-chips"><Chip on={!pid} onClick={() => setPid("")}>없음</Chip>{myProj.map((p) => <Chip key={p.id} on={pid === p.id} onClick={() => setPid(p.id)} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</Chip>)}
      <select aria-label="다른 프로젝트" value="" onChange={(e) => e.target.value && setPid(e.target.value)} className="v2-sel"><option value="">다른 프로젝트 ▾</option>{D.projects.filter(projOpen).filter((p) => !myProj.some((m) => m.id === p.id)).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko")).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
    {other && <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, color: C.text }}><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} style={{ width: 18, height: 18 }} />끝나면 내가 확인하기</label>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 14, color: C.sub }}><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ width: 18, height: 18 }} />계속 추가 (저장 뒤에도 이 창 유지)</label>
  </Sheet>;
}

export function MineSheet({ D, cu, A, open, onBack, onClose, setToast }) {
  const [st, setSt] = useState("todo"), [q, setQ] = useState("");
  const key = ymd(new Date());
  // 날짜 없는 일 '오늘 하기': 오늘이 쉬는 날이면 다음 평일 · 기한 허락이 필요한 일은 요청 · 출시일 미정 신제품 항목은 내 정리(제품별 출시일 정하기)로
  const [, qd] = dueChips(key)[0] || ["", key], qWord = qd === key ? "오늘 하기" : `${md(qd)} 하기`;
  const dayAct = (t) => { const lp = t.launchItem && D.projects.find((p) => p.id === t.projectId);
    if (lp && !lp.launchDate) return <Act onClick={() => open({ type: "myTidy", tab: "nodate" })}>출시일 미정 ›</Act>;
    const can = canSetDue(t, cu.id, D, isMaster(cu));
    return <Act onClick={() => moveDue(A, setToast, t, qd, can, "날짜 정하기")}>{can ? qWord : qWord + " 요청"}</Act>; };
  const mine = D.tasks.filter((t) => isOneOff(t) && isMine(t, cu.id));
  const by = { todo: mine.filter((t) => t.status === "todo"), inprogress: mine.filter((t) => t.status === "inprogress"), review: mine.filter((t) => t.status === "review"), hold: mine.filter((t) => t.status === "hold"), done: mine.filter(isDone) };
  const qq = q.trim().toLowerCase();
  const list = (qq ? mine.filter((t) => String(t.title).toLowerCase().includes(qq)) : by[st]).slice().sort((a, b) => st === "done" ? String(b.doneAt || "").localeCompare(String(a.doneAt || "")) : String(dueOf(a) || "9999").localeCompare(String(dueOf(b) || "9999")));
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  return <Sheet title="내 할 일 모두" onBack={onBack} onClose={onClose}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="내 업무 찾기" aria-label="내 업무 찾기" style={inp} />
      {!qq && <div className="v2-chips">{[["todo", "할 일"], ["inprogress", "진행"], ["review", "확인 대기"], ["hold", "보류"], ["done", "끝남"]].map(([k, l]) => <Chip key={k} on={st === k} onClick={() => setSt(k)}>{l} {by[k].length}</Chip>)}</div>}
    </div>
    <Card style={{ marginTop: 12 }}>{list.length === 0 ? <Empty>없어요</Empty> : list.slice(0, 200).map((t, i) => { const r = riskOf(t, key);
      return <Row key={t.id} dim={isDone(t)} title={t.title} sub={[dueOf(t) ? (isDone(t) ? md(dueOf(t)) : ddayLabel(ddays(dueOf(t), key))) : "날짜 없음", pName(t.projectId)].filter(Boolean).join(" · ")} tag={r ? r.label : null} tagTone={r && r.red ? "red" : null} onClick={() => open({ type: "task", id: t.id })}
        right={isDone(t) || t.status === "review" ? null : !dueOf(t) ? (t.dueReq ? null : dayAct(t)) : <Act onClick={() => A.finish(t)}>끝냄</Act>} last={i === Math.min(200, list.length) - 1} />; })}</Card>
    {st === "done" && !qq && <p style={{ fontSize: 12.5, color: C.mute, margin: "10px 2px" }}>최근 30일에 끝낸 업무만 보여요</p>}
  </Sheet>;
}

// 다가오는 내 차례 한 줄: 태그 = 여유 n일 · 빠듯 · 늦을 수 있음 · 앞 일 늦음(빨강) / 제목 = 프로젝트 · 내 일 / 아래 = 앞사람 무엇·상태·끝 예정 · 내 기한 · 출시·마감
export function UpRow({ u, D, open, keyd, last }) {
  const L = upLine(u, D.users, keyd), red = u.level === "late" || u.level === "risk";
  return <Row tag={u.label} tagTone={red ? "red" : u.level === "ok" ? "turn" : null} title={L.title} sub={L.proj} sub2={L.pred}
    onClick={() => open({ type: "task", id: u.t.id })}
    right={red ? <Act onClick={() => open({ type: "task", id: u.p.id, focus: "talk" })}>묻기</Act> : null} last={last} />;
}
// 다가오는 내 차례 모두 (7일 '곧 내 차례'·오늘 화면에서) — 내 차례가 오는 날 순 · 위험한 것 먼저 · 프로젝트 이름까지
export function UpTurnsSheet({ D, cu, open, T, onBack, onClose }) {
  const key = ymd(new Date()), U = upcomingTurns(D, T, key, cu.id), we = addDays(key, 6);
  const soon = U.filter((u) => u.start && u.start <= we), later = U.filter((u) => u.start && u.start > we), nod = U.filter((u) => !u.start);
  const sec = (h, a) => a.length > 0 && <><Head>{h} {a.length}</Head><Card>{a.map((u, i) => <UpRow key={u.t.id} u={u} D={D} open={open} keyd={key} last={i === a.length - 1} />)}</Card></>;
  return <Sheet title={`다가오는 내 차례 ${U.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px", lineHeight: 1.6 }}>앞사람이 끝내면 이어서 할 내 일이에요. 여유 = 앞 일 끝 예정 다음 날부터 내 기한까지 평일 수 · 빨강은 늦을 수 있어요 → '묻기'로 앞사람에게 바로 물어보세요.</p>
    {sec("7일 안", soon)}{sec("그 뒤", later)}{sec("날짜를 몰라 잴 수 없음", nod)}
    {!U.length && <Card><Empty>앞사람을 기다리는 내 일이 없어요</Empty></Card>}
  </Sheet>;
}
