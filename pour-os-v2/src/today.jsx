// 업무OS v2 — 오늘 · 할 일 추가 · 지난 일 정리 · 내 할 일 모두
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

const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
const nextMon = (key) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return ymd(d); };

// ───────────────── 오늘 ─────────────────
// 순서: 지금 할 일 1장 → 지난 일 정리 → 확인할 것 → 오늘 고정업무 → 오늘 할 일
export function TodayTab({ D, cu, A, open, TV, seen, setSeen }) {
  const now = new Date();
  const [showFxDone, setShowFxDone] = useState(false), [allInbox, setAllInbox] = useState(false);
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  const nextFx = TV.fixed.left.find((x) => !x.late && x.min < 9999);
  const inbox = allInbox ? TV.inbox : TV.inbox.slice(0, 4);
  const readable = TV.inbox.filter((x) => !x.keep);
  const tOf = (id) => D.tasks.find((y) => y.id === id);
  const openInbox = (x) => { if (!x.keep) setSeen((s) => ({ ...s, [x.id]: true }));
    if (x.taskId) { const t = tOf(x.taskId); t ? openTask(open, t) : open({ type: "task", id: x.taskId }); } else if (x.projectId) open({ type: "project", id: x.projectId, first: x.kind === "launchNew" ? "work" : "news" }); };
  const inboxAct = (x) => { const t = x.taskId && tOf(x.taskId);
    if (x.kind === "assigned" && t) return <Act onClick={() => A.ack(t)} style={BTN_ON}>받았어요</Act>;
    if (x.kind === "review" && t) return <Act onClick={() => A.approve(t)} style={BTN_ON}>확인</Act>;
    if (x.kind === "dueReq" && t) return <Act onClick={() => A.answerDue(t, true)} style={BTN_ON}>수락</Act>;
    return <Act onClick={() => openInbox(x)}>보기</Act>; };
  const list = TV.focus.filter((x) => x.r !== 1);   // 지난 일은 '정리하기'에서
  return <>
    <header style={{ padding: "14px 2px 2px" }}>
      <div style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>{dayTitle(now)} · {cu.name}</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 800, color: C.ink }}>남은 일 {TV.left} · 끝낸 일 {TV.doneToday}</h1>
      {nextFx && <div style={{ fontSize: 13.5, color: C.sub }}>다음 고정업무: {fxTime(nextFx.t, cu.id)} {fxLabel(nextFx.t, cu.id)}</div>}
    </header>
    <FocusCard D={D} cu={cu} A={A} open={open} TV={TV} pName={pName} />
    <div className="v2-cols">
      <div>
        <Head right={readable.length > 0 && <TBtn tone="mute" onClick={() => setSeen((s) => ({ ...s, ...Object.fromEntries(readable.map((x) => [x.id, true])) }))}>읽음 표시</TBtn>}>확인할 것 {TV.inbox.length}</Head>
        <Card>
          {TV.inbox.length === 0 && <Empty>새로 온 일이나 댓글이 없어요</Empty>}
          {inbox.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || TV.userName(x.who) || "누군가"} · ${ago(x.at, now)}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={inboxAct(x)} last={i === inbox.length - 1 && TV.inbox.length <= 4} />)}
          {TV.inbox.length > 4 && <More onClick={() => setAllInbox(!allInbox)}>{allInbox ? "접기 ▴" : `${TV.inbox.length}개 모두 보기 ▾`}</More>}
        </Card>
        <Head>오늘 고정업무 {TV.fixed.done.length}/{TV.fixed.total}</Head>
        <Card>
          {TV.fixed.total === 0 && <Empty>오늘 할 고정업무가 없어요</Empty>}
          {TV.fixed.left.map((x, i) => { const t = x.t, [a, b] = fxCount(D.users, t, TV.key), subs = fxSubs(t, cu.id);
            return <Row key={t.id} tag={x.late ? "지남" : null} tagTone="red" title={fxLabel(t, cu.id)} sub={[fxTime(t, cu.id) || "시간 상관없음", t.recurType && t.recurType !== "daily" ? fxRecurL(t) : "", b > 1 ? `${a}/${b}명` : "", subs.length ? `체크리스트 ${subs.length}개` : ""].filter(Boolean).join(" · ")}
              onClick={() => open({ type: "fixed", id: t.id })} right={<Act onClick={() => A.fxToggle(t)}>완료</Act>} last={i === TV.fixed.left.length - 1 && !TV.fixed.done.length} />; })}
          {TV.fixed.done.length > 0 && <More onClick={() => setShowFxDone(!showFxDone)}>{showFxDone ? "끝낸 일 접기 ▴" : `끝낸 일 ${TV.fixed.done.length} ▾`}</More>}
          {showFxDone && TV.fixed.done.map((x) => <Row key={x.t.id} dim title={fxLabel(x.t, cu.id)} sub={`✓ ${hm(x.t.doneAtBy && x.t.doneAtBy[cu.id])}`} onClick={() => open({ type: "fixed", id: x.t.id })} right={<Act on onClick={() => A.fxToggle(x.t)}>✓ 취소</Act>} />)}
        </Card>
      </div>
      <div>
        <Head right={<TBtn onClick={() => open({ type: "mine" })}>내 할 일 모두 ›</TBtn>}>오늘 챙길 일 {list.length}</Head>
        <Card>
          {list.length === 0 && <Empty>오늘·내일 마감이거나 진행 중인 일이 없어요{TV.ranked.length ? ` · 나머지 ${TV.ranked.length}개는 '내 할 일 모두'에서` : ""}</Empty>}
          {list.slice(0, 8).map((x, i) => { const t = x.t;
            return <Row key={t.id} tag={x.risk ? x.risk.label : t.status === "inprogress" ? "진행 중" : null} tagTone={x.risk && x.risk.red ? "red" : null} title={t.title}
              sub={[pName(t.projectId), reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : "", t.firstStep ? "첫 걸음: " + t.firstStep : ""].filter(Boolean).join(" · ") || null} onClick={() => open({ type: "task", id: t.id })} right={<Act onClick={() => A.finish(t)}>끝냄</Act>} last={i === Math.min(8, list.length) - 1 && list.length <= 8} />; })}
          {list.length > 8 && <More onClick={() => open({ type: "mine" })}>{list.length - 8}개 더 · 내 할 일 모두 ›</More>}
        </Card>
      </div>
    </div>
    <div className="v2-fab"><Big onClick={() => open({ type: "add" })}>+ 할 일 추가 · 맡기기</Big></div>
  </>;
}

// 지금 할 일 — 한 번에 하나만 크게. 지난 일이면 그 자리에서 정리(끝냄·새 기한·보류)
function FocusCard({ D, cu, A, open, TV, pName }) {
  const [i, setI] = useState(0), [mode, setMode] = useState(""), [txt, setTxt] = useState("");
  const all = TV.ranked; if (!all.length) return <Card style={{ marginTop: 12, padding: "16px 16px" }}><div style={{ fontSize: 12.5, fontWeight: 800, color: C.sub }}>지금 할 일</div><div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 4 }}>급한 일이 없어요</div><div style={{ fontSize: 13.5, color: C.sub, marginTop: 4 }}>고정업무를 하거나, 아래 '+ 할 일 추가'로 새 일을 적어 두세요.</div></Card>;
  const k = Math.min(i, all.length - 1), x = all[k], t = x.t, key = TV.key, late = x.n != null && x.n < 0, can = canSetDue(t, cu.id, D, isMaster(cu));
  const appr = nameOf(D.users, dueApprover(t, D));
  const moveTo = (d) => (can ? A.setDue(t, d) : A.requestDue(t, d, "지난 일 정리"));
  return <div style={{ marginTop: 12, background: "#fff", border: `1.5px solid ${late || (x.risk && x.risk.red) ? "#E2B7BB" : "#C9D2EA"}`, borderRadius: 18, padding: "14px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: C.sub, flex: 1 }}>지금 할 일</span>
      {all.length > 1 && <TBtn onClick={() => { setI((k + 1) % all.length); setMode(""); }} style={{ padding: "4px 2px" }}>다른 일 ›</TBtn>}
    </div>
    <div role="button" tabIndex={0} onClick={() => open({ type: "task", id: t.id })} onKeyDown={(e) => { if (e.key === "Enter") open({ type: "task", id: t.id }); }} style={{ cursor: "pointer", marginTop: 4 }}>
      {x.risk && <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 6, marginBottom: 4, color: x.risk.red ? C.red : C.navy, background: x.risk.red ? "#F8E9EA" : C.soft }}>{x.risk.label}</span>}
      <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1.35, wordBreak: "keep-all" }}>{t.title}</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{[pName(t.projectId), dueOf(t) ? `기한 ${md(dueOf(t))}` : "기한 미정", reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : ""].filter(Boolean).join(" · ")}</div>
      {t.feedback && <div style={{ fontSize: 13.5, color: C.red, marginTop: 6 }}>수정 요청: {t.feedback.text}</div>}
      {t.firstStep && <div style={{ fontSize: 13.5, color: C.ink, marginTop: 6 }}>첫 걸음: {t.firstStep}</div>}
    </div>
    {late ? <>
      <div style={{ fontSize: 13, color: C.sub, margin: "10px 0 6px" }}>{can ? "끝냈으면 '끝냈어요', 아니면 새 기한을 골라요" : `새 기한은 ${appr || "책임자"}님께 요청으로 가요`}</div>
      <div className="v2-chips"><Act onClick={() => A.finish(t)} style={BTN_ON}>끝냈어요</Act>
        {[["오늘", key], ["내일", addDays(key, 1)], ["다음 주", nextMon(key)]].map(([l, d]) => <Act key={l} onClick={() => moveTo(d)}>{can ? l : l + " 요청"}</Act>)}
        <TBtn onClick={() => A.setStatus(t, "hold")}>보류</TBtn></div>
    </> : <div className="v2-chips" style={{ marginTop: 12 }}>
      {t.status !== "inprogress" && <Act onClick={() => A.setStatus(t, "inprogress")}>시작하기</Act>}
      <Act onClick={() => A.finish(t)} style={BTN_ON}>끝냈어요</Act>
      {!t.blocked && <TBtn onClick={() => { setTxt(""); setMode(mode === "block" ? "" : "block"); }}>막혔어요</TBtn>}
    </div>}
    {mode === "block" && <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="무엇 때문에 막혔나요?" aria-label="막힌 이유" style={{ ...inp, padding: "9px 12px", fontSize: 14 }} /><Act onClick={() => { if (txt.trim()) { A.block(t, txt.trim()); setMode(""); } }}>알리기</Act></div>}
    {TV.doing >= 4 && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>진행 중인 일이 {TV.doing}개예요. 새로 시작하기보다 하나씩 끝내면 더 빨라요.</div>}
    {TV.late.length > 1 && <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, fontSize: 13.5, color: C.red, fontWeight: 800 }}>지난 일 {TV.late.length}개</span><TBtn onClick={() => open({ type: "triage" })}>하나씩 정리하기 ›</TBtn></div>}
  </div>;
}

// 지난 일 정리 — 한 화면에 하나씩: 끝냈어요 / 새 기한 / 보류 / 건너뛰기
export function FocusTriage({ D, cu, A, open, TV, onBack, onClose }) {
  const [q] = useState(() => TV.late.map((x) => x.t.id)), [i, setI] = useState(0), [date, setDate] = useState("");
  const key = ymd(new Date());
  const t = q[i] ? D.tasks.find((x) => x.id === q[i]) : null;
  const next = () => { setI(i + 1); setDate(""); };
  if (i >= q.length) return <Sheet title="지난 일 정리" onBack={onBack} onClose={onClose} foot={<Big onClick={onBack || onClose}>닫기</Big>}><div style={{ padding: "40px 4px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>다 정리했어요</div><div style={{ fontSize: 14, color: C.sub, marginTop: 8 }}>{q.length}개를 정리했어요. 이제 기한이 모두 앞날이에요.</div></div></Sheet>;
  if (!t) { setTimeout(next, 0); return null; }
  const can = canSetDue(t, cu.id, D, isMaster(cu)), appr = nameOf(D.users, dueApprover(t, D)), n = ddays(dueOf(t), key);
  const p = D.projects.find((x) => x.id === t.projectId);
  const move = (d) => { can ? A.setDue(t, d) : A.requestDue(t, d, "지난 일 정리"); next(); };
  return <Sheet title={`지난 일 정리 ${i + 1}/${q.length}`} onBack={onBack} onClose={onClose}>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, margin: "14px 0 18px", overflow: "hidden" }}><div style={{ width: Math.round((i / q.length) * 100) + "%", height: "100%", background: C.navy }} /></div>
    <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 6, color: C.red, background: "#F8E9EA" }}>{n != null && n < 0 ? `${-n}일 지남` : "기한 확인"}</span>
    <h2 style={{ fontSize: 21, fontWeight: 800, color: C.ink, margin: "8px 0 6px", lineHeight: 1.35, wordBreak: "keep-all" }}>{t.title}</h2>
    <div style={{ fontSize: 14, color: C.sub }}>{[p && p.title, `기한 ${md(dueOf(t))}`, reqOf(t) ? `${nameOf(D.users, reqOf(t))}님이 맡김` : ""].filter(Boolean).join(" · ")}</div>
    {t.memo && <Card style={{ padding: "10px 14px", marginTop: 12 }}><div style={{ fontSize: 13.5, color: C.text, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{t.memo}</div></Card>}
    <Big onClick={() => { A.finish(t); next(); }} style={{ marginTop: 18 }}>끝냈어요</Big>
    <div className="v2-lab">{can ? "아직이면 새 기한" : `아직이면 새 기한 요청 (${appr || "책임자"}님이 수락하면 바뀌어요)`}</div>
    <div className="v2-chips">{[["오늘", key], ["내일", addDays(key, 1)], ["모레", addDays(key, 2)], ["다음 주 월", nextMon(key)]].map(([l, d]) => <Chip key={l} onClick={() => move(d)}>{l}</Chip>)}
      <input type="date" aria-label="날짜 고르기" value={date} onChange={(e) => setDate(e.target.value)} className="v2-sel" />{date && <Act onClick={() => move(date)} style={BTN_ON}>{md(date)}로</Act>}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 18, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <TBtn onClick={() => { A.setStatus(t, "hold"); next(); }}>보류 (당분간 안 함)</TBtn>
      <TBtn onClick={() => open({ type: "task", id: t.id })}>업무 열기 · 넘기기</TBtn>
      <TBtn tone="mute" onClick={next}>건너뛰기</TBtn>
    </div>
  </Sheet>;
}

// 할 일 추가 · 맡기기 — 사람을 고르면 그 사람의 2주 일정을 보고 기한을 바로 고른다
export function AddSheet({ D, cu, A, onBack, onClose, preset, setToast }) {
  const [title, setTitle] = useState(""), [who, setWho] = useState(preset.assigneeId || cu.id), [due, setDue] = useState(preset.dueDate || ymd(new Date()));
  const [pid, setPid] = useState(preset.projectId || ""), [keep, setKeep] = useState(false), [busy, setBusy] = useState(false), [step, setStep] = useState(""), [review, setReview] = useState(true);
  const ref = useAutoFocus();
  const now = new Date(), today = ymd(now);
  const users = activeUsers(D.users);
  const recent = useMemo(() => { const c = {}; D.tasks.forEach((t) => { if (t.requestedBy === cu.id && t.assigneeId && t.assigneeId !== cu.id) c[t.assigneeId] = Math.max(c[t.assigneeId] || 0, Date.parse(t.requestedAt || 0) || 0); });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id]) => users.find((u) => u.id === id)).filter(Boolean).slice(0, 5); }, [D.tasks]);
  const quick = [cu, ...recent.filter((u) => u.id !== cu.id)];
  if (who && !quick.some((u) => u.id === who)) { const u = users.find((x) => x.id === who); if (u) quick.push(u); }
  const myProj = D.projects.filter((p) => projOpen(p) && projMine(p, cu.id, D.tasks)).slice(0, 4);
  if (pid && !myProj.some((p) => p.id === pid)) { const p = D.projects.find((x) => x.id === pid); if (p) myProj.unshift(p); }
  const other = who !== cu.id, wl = useMemo(() => workloadOf(D, who, now), [D, who]), ot = useMemo(() => onTimeOf(D, who, now), [D, who]);
  const sameDay = due ? wl.dueOn(due) : [];
  const ok = title.trim() && !busy && (!other || due);
  const save = async () => { if (!ok) return; setBusy(true);
    const t = await A.addTask({ title, assigneeId: who, dueDate: due, projectId: pid, firstStep: step, noReview: other ? !review : true });
    setBusy(false); if (!t) return;
    setToast({ text: other ? `${nameOf(D.users, who)}님에게 맡겼어요 · 받으면 '받음'으로 보여요` : "추가했어요" });
    if (keep) { setTitle(""); setStep(""); } else (onBack || onClose)(); };
  const heavy = (n) => n >= 5;
  return <Sheet title="할 일 추가 · 맡기기" onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!ok}>{other ? `${nameOf(D.users, who)}님에게 맡기기${due ? " · " + md(due) + "까지" : ""}` : "추가"}</Big>}>
    <label className="v2-lab" htmlFor="v2-add-title">무엇을</label>
    <input id="v2-add-title" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) save(); }} placeholder="할 일 제목" style={inp} />
    <div className="v2-lab">누가</div>
    <div className="v2-chips">{quick.map((u) => <Chip key={u.id} on={who === u.id} onClick={() => setWho(u.id)}>{u.id === cu.id ? "나" : u.name}</Chip>)}
      <select aria-label="다른 사람" value={quick.some((u) => u.id === who) ? "" : who} onChange={(e) => e.target.value && setWho(e.target.value)} className="v2-sel"><option value="">다른 사람 ▾</option>{users.filter((u) => !quick.some((q) => q.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="v2-lab">언제까지 {other ? <span style={{ color: C.mute, fontWeight: 600 }}>· {nameOf(D.users, who)}님 2주 일정 (숫자 = 그날 마감 수)</span> : ""}</div>
    <div style={{ fontSize: 13, color: C.sub, margin: "-2px 2px 8px" }}>{other ? `${nameOf(D.users, who)} · ` : "나 · "}열린 일 {wl.open} · 진행 {wl.doing}{wl.late ? <b style={{ color: C.red }}> · 지난 일 {wl.late}</b> : ""}{ot.pct != null ? ` · 최근 기한 지킴 ${ot.pct}%` : ""}</div>
    <div className="v2-strip" role="listbox" aria-label="기한 고르기">
      {wl.week.map((d) => { const on = due === d.date, n = d.list.length, we = d.wd === "토" || d.wd === "일";
        return <button key={d.date} type="button" role="option" aria-selected={on} onClick={() => setDue(d.date)} className={"v2-day" + (on ? " on" : "") + (we ? " we" : "")}>
          <span>{d.date === today ? "오늘" : md(d.date)}</span><span>{d.wd}</span><b className={heavy(n) ? "hv" : ""}>{n ? `${n}건` : "-"}</b></button>; })}
    </div>
    <div className="v2-chips" style={{ marginTop: 8 }}><input type="date" aria-label="다른 날짜" value={due} onChange={(e) => setDue(e.target.value)} className="v2-sel" />{!other && <Chip on={!due} onClick={() => setDue("")}>미정</Chip>}</div>
    {due && sameDay.length > 0 && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>{md(due)} 마감 {sameDay.length}건: {sameDay.slice(0, 3).map((t) => t.title).join(" · ")}{sameDay.length > 3 ? ` 외 ${sameDay.length - 3}` : ""}{heavy(sameDay.length) ? <b style={{ color: C.ink }}> — 많아요. 다른 날을 권해요</b> : ""}</div>}
    {other && !due && <div style={{ fontSize: 12.5, color: C.red, marginTop: 8 }}>다른 사람에게 맡길 땐 기한을 꼭 정해 주세요</div>}
    <label className="v2-lab" htmlFor="v2-add-step">첫 걸음 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 5분 안에 시작할 수 있는 한 가지)</span></label>
    <input id="v2-add-step" value={step} onChange={(e) => setStep(e.target.value)} placeholder="예: 지난번 시안 파일 열어 보기" style={inp} />
    <div className="v2-lab">프로젝트 <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span></div>
    <div className="v2-chips"><Chip on={!pid} onClick={() => setPid("")}>없음</Chip>{myProj.map((p) => <Chip key={p.id} on={pid === p.id} onClick={() => setPid(p.id)} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</Chip>)}
      <select aria-label="다른 프로젝트" value="" onChange={(e) => e.target.value && setPid(e.target.value)} className="v2-sel"><option value="">다른 프로젝트 ▾</option>{D.projects.filter(projOpen).filter((p) => !myProj.some((m) => m.id === p.id)).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko")).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
    {other && <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, color: C.text }}><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} style={{ width: 18, height: 18 }} />끝나면 내가 확인하기</label>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 14, color: C.sub }}><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ width: 18, height: 18 }} />계속 추가 (저장 뒤에도 이 창 유지)</label>
  </Sheet>;
}

export function MineSheet({ D, cu, A, open, onBack, onClose }) {
  const [st, setSt] = useState("todo"), [q, setQ] = useState("");
  const key = ymd(new Date());
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
        right={isDone(t) || t.status === "review" ? null : !dueOf(t) ? <Act onClick={() => A.setDue(t, key)}>오늘 하기</Act> : <Act onClick={() => A.finish(t)}>끝냄</Act>} last={i === Math.min(200, list.length) - 1} />; })}</Card>
    {st === "done" && !qq && <p style={{ fontSize: 12.5, color: C.mute, margin: "10px 2px" }}>최근 30일에 끝낸 업무만 보여요</p>}
  </Sheet>;
}
