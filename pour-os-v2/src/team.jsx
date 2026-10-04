// 업무OS v2 — 팀 · 사람 · 맡긴 일
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, WD, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, canSetDue, riskOf, assignedByMe, workloadOf, onTimeOf,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, phaseOf } from "./launch.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";
import { openTask } from "./task.jsx";

const LS = (k) => "pour-os2-" + k;
const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
const ASG = [["review", "확인해 주세요", true], ["dueReq", "기한 조정 요청", true], ["blocked", "막힘", true], ["late", "기한 지남", true], ["risk", "곧 마감인데 시작 전", true], ["notAck", "아직 안 받음", true], ["doing", "진행 중", true], ["waiting", "받고 대기 중", false], ["done", "최근 7일 끝남", false]];

export function TeamTab({ D, cu, A, open }) {
  const [seg, setSeg] = useLocal(LS("teamseg"), "people"), [chip, setChip] = useState("all"), [n, setN] = useState(20), [more, setMore] = useState({});
  const key = ymd(new Date()), now = new Date();
  const users = activeUsers(D.users).filter((u) => u.id !== cu.id).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const issues = isMaster(cu) ? ownerIssues(D) : [];
  const feed = feedOf(D, { sinceIso: new Date(now - 7 * 864e5).toISOString() }).filter((x) => chip === "all" || (chip === "talk" ? x.type === "note" : x.type === "log"));
  const tTitle = (id) => (D.tasks.find((t) => t.id === id) || D.projects.find((p) => p.id === id) || {}).title || "";
  const goFeed = (x) => { if (x.type === "note") { const [k, ...r] = String(x.itemId).split(":"); const ref = r.join(":"); if (k === "task") open({ type: "task", id: ref }); else if (k === "proj") open({ type: "project", id: ref, first: "news" }); }
    else if (x.col === "projects") open({ type: "project", id: x.targetId }); else if (x.targetId && x.col === "tasks") { const t = D.tasks.find((y) => y.id === x.targetId); t ? openTask(open, t) : open({ type: "task", id: x.targetId }); } };
  const me = personStat(D, cu.id, key), meOt = onTimeOf(D, cu.id, now);
  const G = assignedByMe(D, cu.id, now), gN = Object.values(G).reduce((a, b) => a + b.length, 0), urgent = G.review.length + G.dueReq.length + G.blocked.length + G.late.length;
  const teamRisk = D.tasks.filter((t) => { const r = !t.isFixed && riskOf(t, key); return r && (r.k === "late" || r.k === "blocked"); }).length;
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>팀</h1>
      <Seg items={[["people", "사람"], ["asg", `맡긴 일${urgent ? " " + urgent : ""}`], ["news", "소식"]]} value={seg} onChange={setSeg} /></header>
    {seg === "people" && <>
      <Card style={{ marginTop: 12 }}><Row title={`나 · ${cu.name}`} sub={`진행 ${me.inprog} · 열린 업무 ${me.open}${me.late ? ` · 밀림 ${me.late}` : ""} · 고정 ${me.fxDone}/${me.fxTotal}${meOt.pct != null ? ` · 기한 지킴 ${meOt.pct}%` : ""}`} onClick={() => open({ type: "mine" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={false} />
        <Row tag={teamRisk ? "위험" : null} tagTone="red" title={`팀 위험 업무 ${teamRisk}`} sub="기한이 지났거나 막힌 일 · 사람별로 모아 보기" onClick={() => open({ type: "risk" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={!issues.length} />
        {issues.length > 0 && <Row tag="마스터" title={`담당 정리 필요 ${issues.length}`} sub="담당이 없거나 미사용인 사람이 맡은 일" onClick={() => open({ type: "issues" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last />}</Card>
      <Head>팀원 {users.length}</Head>
      <Card>{users.map((u, i) => { const s = personStat(D, u.id, key), ot = onTimeOf(D, u.id, now);
        return <Row key={u.id} title={u.name} tag={s.late ? `밀림 ${s.late}` : null} tagTone="red" sub={`진행 ${s.inprog} · 열린 업무 ${s.open} · 고정 ${s.fxDone}/${s.fxTotal}${ot.pct != null ? ` · 기한 지킴 ${ot.pct}%` : ""}`} sub2={s.last ? "마지막 활동 " + ago(s.last, now) : null} onClick={() => open({ type: "person", id: u.id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={i === users.length - 1} />; })}</Card>
    </>}
    {seg === "asg" && <>
      <p style={{ fontSize: 13, color: C.sub, margin: "12px 2px 0", lineHeight: 1.6 }}>내가 맡긴 일 {gN}개 · 위에서부터 처리하면 돼요. 맡길 때는 아래 '+ 맡기기'.</p>
      {gN === 0 && <Card style={{ marginTop: 12 }}><Empty>아직 맡긴 일이 없어요</Empty></Card>}
      {ASG.map(([k, l, def]) => { const a = G[k]; if (!a.length) return null; const m = more[k], shown = def ? (m ? a : a.slice(0, 6)) : m ? a : [];
        return <div key={k}><Head red={k === "late" || k === "blocked"} right={(!def || a.length > 6) && <TBtn onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : def ? `${a.length - 6}개 더 ▾` : `${a.length} ▾`}</TBtn>}>{l} {a.length}</Head>
          {shown.length > 0 && <Card>{shown.map((t, i) => { const r = riskOf(t, key);
            const act = k === "review" ? <Act onClick={() => A.approve(t)} style={BTN_ON}>확인</Act> : k === "dueReq" ? <Act onClick={() => A.answerDue(t, true)} style={BTN_ON}>수락</Act> : null;
            return <Row key={t.id} tag={k === "dueReq" ? `→ ${md(t.dueReq.date)}` : r && k !== "review" ? r.label : null} tagTone={r && r.red ? "red" : null} title={t.title}
              sub={[nameOf(D.users, ownersOf(t)[0]) || "담당 없음", dueOf(t) ? `기한 ${md(dueOf(t))}` : "기한 미정", t.ackAt ? "받음" : "", k === "blocked" ? t.blocked.reason : k === "dueReq" ? t.dueReq.reason : ""].filter(Boolean).join(" · ")}
              onClick={() => open({ type: "task", id: t.id })} right={act} last={i === shown.length - 1} />; })}</Card>}</div>; })}
      <div className="v2-fab"><Big onClick={() => open({ type: "add" })}>+ 맡기기</Big></div>
    </>}
    {seg === "news" && <>
      <div className="v2-chips" style={{ marginTop: 12 }}>{[["all", "전체"], ["talk", "대화"], ["log", "변경·완료"]].map(([k, l]) => <Chip key={k} on={chip === k} onClick={() => setChip(k)}>{l}</Chip>)}</div>
      <Card style={{ marginTop: 10 }}>{feed.length === 0 ? <Empty>최근 7일 소식이 없어요</Empty> : feed.slice(0, n).map((x, i) => <Row key={x.id} title={x.type === "note" ? `${x.byName} · ${tTitle(String(x.itemId).split(":").slice(1).join(":")) || "대화"}` : `${x.byName} · ${LOG_L[x.action] || "기록"}`} sub={x.text} sub2={ago(x.at, now)} onClick={() => goFeed(x)} last={i === Math.min(n, feed.length) - 1 && feed.length <= n} />)}
        {feed.length > n && <More onClick={() => setN(n + 20)}>더 보기 ▾</More>}</Card>
    </>}
  </>;
}
// 팀 위험 업무 — 상급자가 한 화면에서 보고 바로 열기
export function RiskSheet({ D, cu, open, onBack, onClose }) {
  const key = ymd(new Date());
  const rows = D.tasks.filter((t) => !t.isFixed).map((t) => ({ t, r: riskOf(t, key) })).filter((x) => x.r && (x.r.k === "late" || x.r.k === "blocked" || x.r.k === "start"));
  const byU = {}; rows.forEach((x) => { const u = ownersOf(x.t)[0] || ""; (byU[u] = byU[u] || []).push(x); });
  const order = Object.entries(byU).sort((a, b) => b[1].filter((x) => x.r.red).length - a[1].filter((x) => x.r.red).length);
  return <Sheet title={`팀 위험 업무 ${rows.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px", lineHeight: 1.6 }}>지남 · 막힘 · 곧 마감인데 시작 전인 일이에요. 눌러서 담당자에게 댓글을 남기거나 기한을 정리해 주세요.</p>
    {order.map(([uid, a]) => <div key={uid}><Head>{nameOf(D.users, uid) || "담당 없음"} {a.length}</Head>
      <Card>{a.sort((x, y) => String(dueOf(x.t)).localeCompare(String(dueOf(y.t)))).slice(0, 30).map((x, i, arr) => <Row key={x.t.id} tag={x.r.label} tagTone={x.r.red ? "red" : null} title={x.t.title} sub={[((D.projects.find((p) => p.id === x.t.projectId) || {}).title) || "", reqOf(x.t) ? `${nameOf(D.users, reqOf(x.t))}님이 맡김` : ""].filter(Boolean).join(" · ") || null} onClick={() => open({ type: "task", id: x.t.id })} last={i === arr.length - 1} />)}</Card></div>)}
    {rows.length === 0 && <Card style={{ marginTop: 12 }}><Empty>위험한 업무가 없어요</Empty></Card>}
  </Sheet>;
}
export function PersonSheet({ D, cu, A, open, onBack, onClose, id, setToast }) {
  const u = D.users.find((x) => x.id === id); const [ask, setAsk] = useState(false), [all, setAll] = useState(false);
  if (!u) return <Sheet title="사람" onBack={onBack} onClose={onClose}><Empty>찾지 못했어요</Empty></Sheet>;
  const now = new Date(), key = ymd(now), s = personStat(D, u.id, key), ot = onTimeOf(D, u.id, now), wl = workloadOf(D, u.id, now);
  const open1 = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, u.id));
  const doing = open1.filter((t) => t.status === "inprogress"), todoAll = open1.filter((t) => t.status !== "inprogress").sort((a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"))), next = all ? todoAll : todoAll.slice(0, 5);
  const projs = D.projects.filter((p) => projOpen(p) && p.assigneeId === u.id);
  const fx = D.tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, u.id) && fxDueOn(t, key));
  const talk = D.notes.filter((n) => n.by === u.id && !n.deleted).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  const L = ({ a, empty, render }) => <Card>{a.length === 0 ? <Empty>{empty}</Empty> : a.map((x, i) => render(x, i === a.length - 1))}</Card>;
  return <Sheet title={u.name} onBack={onBack} onClose={onClose} foot={<Big onClick={() => open({ type: "add", preset: { assigneeId: u.id } })}>{u.name}님에게 업무 맡기기</Big>}>
    <div style={{ marginTop: 12, padding: "10px 12px", background: C.soft, borderRadius: 12, fontSize: 13, color: C.ink }}>보기만 하는 화면이에요. 댓글은 내 이름({cu.name})으로 남아요.</div>
    <div style={{ fontSize: 14, color: C.sub, margin: "12px 2px 0", lineHeight: 1.6 }}>진행 {s.inprog} · 열린 업무 {s.open}{s.late ? ` · 밀림 ${s.late}` : ""} · 오늘 고정 {s.fxDone}/{s.fxTotal}{ot.pct != null ? ` · 기한 지킴 ${ot.pct}% (최근 30일 ${ot.n}건)` : ""}{s.last ? ` · 마지막 활동 ${ago(s.last)}` : ""}</div>
    <Head>앞으로 2주 마감</Head>
    <div className="v2-strip" aria-label="2주 일정">{wl.week.map((d) => <div key={d.date} className={"v2-day" + (d.wd === "토" || d.wd === "일" ? " we" : "")} style={{ cursor: "default" }}><span>{d.date === key ? "오늘" : md(d.date)}</span><span>{d.wd}</span><b className={d.list.length >= 5 ? "hv" : ""}>{d.list.length ? d.list.length + "건" : "-"}</b></div>)}</div>
    <Head>지금 하는 일 {doing.length}</Head><L a={doing} empty="진행 중인 일이 없어요" render={(t, last) => <Row key={t.id} title={t.title} sub={dueOf(t) ? ddayLabel(ddays(dueOf(t), key)) : null} onClick={() => open({ type: "task", id: t.id })} last={last} />} />
    <Head right={todoAll.length > 5 && <TBtn onClick={() => setAll(!all)}>{all ? "접기 ▴" : `모두 ${todoAll.length} ▾`}</TBtn>}>다음 할 일 {todoAll.length}</Head><L a={next} empty="남은 할 일이 없어요" render={(t, last) => { const r = riskOf(t, key); return <Row key={t.id} tag={r ? r.label : null} tagTone={r && r.red ? "red" : null} title={t.title} sub={[dueOf(t) ? md(dueOf(t)) : "마감 미정", ((D.projects.find((p) => p.id === t.projectId) || {}).title) || ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: t.id })} last={last} />; }} />
    <Head>책임 프로젝트 {projs.length}</Head><L a={projs} empty="책임 프로젝트가 없어요" render={(p, last) => <Row key={p.id} title={p.title} sub={(p.now && p.now.text ? p.now.text.split("\n")[0] : "지금 상황 미작성")} onClick={() => open({ type: "project", id: p.id, first: "news" })} last={last} />} />
    <Head>오늘 고정업무 {fx.filter((t) => fxMeDone(t, u.id, key)).length}/{fx.length}</Head><L a={fx} empty="오늘 고정업무가 없어요" render={(t, last) => <Row key={t.id} title={fxLabel(t, u.id)} sub={fxMeDone(t, u.id, key) ? `✓ ${hm(t.doneAtBy && t.doneAtBy[u.id])}` : `아직${fxTime(t, u.id) ? ` · 예정 ${fxTime(t, u.id)}` : ""}`} onClick={() => open({ type: "fixed", id: t.id })} last={last} />} />
    <Head>최근 대화</Head><L a={talk} empty="최근 30일 대화가 없어요" render={(n, last) => <Row key={n.id} title={n.text} sub={ago(n.at)} onClick={() => { const [k, ...r] = String(n.itemId).split(":"); if (k === "task") open({ type: "task", id: r.join(":") }); else if (k === "proj") open({ type: "project", id: r.join(":"), first: "news" }); }} last={last} />} />
    {isMaster(cu) && u.id !== cu.id && u.pinHash && <div style={{ marginTop: 18 }}><TBtn tone="red" onClick={() => setAsk(true)}>{u.name}님 PIN 초기화</TBtn></div>}
    {ask && <Ask title="PIN 초기화" body={`${u.name}님의 v2 PIN을 지울까요?\n본인이 다음에 열 때 새로 정해요. (버전1 PIN은 그대로예요)`} yes="초기화" danger onNo={() => setAsk(false)} onYes={() => { fb.patch("users", u._doc || u.id, { pinHash: null, pinResetBy: cu.id, pinResetAt: new Date().toISOString() }).then(() => setToast({ text: "PIN을 초기화했어요" })).catch((e) => { console.error(e); setToast({ text: "초기화 실패" }); }); setAsk(false); }} />}
  </Sheet>;
}
export function IssuesSheet({ D, open, onBack, onClose }) {
  const a = ownerIssues(D);
  return <Sheet title={`담당 정리 필요 ${a.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px" }}>담당이 없거나 '미사용' 사람이 맡은 일이에요. 눌러서 '담당 바꾸기'로 정리해 주세요.</p>
    <Card>{a.map((x, i) => <Row key={x.t.id} tag={x.why} tagTone="red" title={x.t.title} sub={[x.t.isFixed ? "고정업무" : "업무", ownersOf(x.t).map((u) => nameOf(D.users, u) || "(없는 사람)").join(", ")].filter(Boolean).join(" · ")} onClick={() => openTask(open, x.t)} last={i === a.length - 1} />)}</Card>
  </Sheet>;
}

// ───────────────── 더보기 ─────────────────
