// 업무OS v2 — 업무 보기 · 고정업무 보기 · 대화 · 파일
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

export const openTask = (open, t) => open({ type: t.isFixed ? "fixed" : "task", id: t.id });
export function useTask(D, id) {
  const live = D.tasks.find((t) => t.id === id);
  const [extra, setExtra] = useState(null);
  useEffect(() => { if (!live && !extra) fb.fetchWhere("tasks", ["id", "==", id]).then((a) => setExtra(a[0] || false)).catch((e) => { console.error("[v2] 업무 불러오기 실패:", e); setExtra(false); }); }, [id, !!live]);
  return live || extra;
}
export function useItemNotes(D, itemId) {
  const [old, setOld] = useState([]);
  useEffect(() => { fb.fetchWhere("notes", ["itemId", "==", itemId]).then(setOld).catch((e) => console.error("[v2] 댓글 불러오기 실패:", e)); }, [itemId]);
  return useMemo(() => { const m = new Map(); old.forEach((n) => m.set(n.id, n)); D.notes.forEach((n) => { if (n.itemId === itemId) m.set(n.id, n); }); return [...m.values()]; }, [old, D.notes, itemId]);
}
// 업무 보기 — 맨 위에 '지금 해야 할 일'(받았어요·확인·기한 조정·막힘)을 띄우고, 그 아래 메모 → 하위 업무 → 대화 → 파일 → 기록
export function TaskSheet({ D, cu, A, open, onBack, onClose, id }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const [mode, setMode] = useState(""), [memo, setMemo] = useState(""), [showLog, setShowLog] = useState(false), [logs, setLogs] = useState(null), [sub, setSub] = useState("");
  const [txt, setTxt] = useState(""), [reqDate, setReqDate] = useState("");
  const fileRef = useRef(null);
  if (t === undefined || t === null) return <Sheet title="업무" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (t === false) return <Sheet title="업무" onBack={onBack} onClose={onClose}><Empty>이 업무를 찾지 못했어요 (휴지통이나 보관함으로 갔을 수 있어요)</Empty></Sheet>;
  const key = ymd(new Date()), mine = isMine(t, cu.id), done = isDone(t), n = ddays(dueOf(t), key), master = isMaster(cu);
  const p = D.projects.find((x) => x.id === t.projectId), owners = ownersOf(t).map((u) => nameOf(D.users, u) || "(없는 사람)");
  const kids = D.tasks.filter((x) => x.parentId === t.id), parent = t.parentId ? D.tasks.find((x) => x.id === t.parentId) : null;
  const req = reqOf(t), reqName = nameOf(D.users, req), approver = dueApprover(t, D), canDue = canSetDue(t, cu.id, D, master);
  const review = t.status === "review", amReviewer = review && ((t.reviewTo || req) === cu.id || master);
  const risk = riskOf(t, key);
  const files = [...(t.attachments || []).map((f) => ({ ...f, where: "업무" })), ...notes.flatMap((nn) => (nn.files || []).map((f) => ({ ...f, by: nn.by, byName: nn.byName, uploadedAt: f.uploadedAt || nn.at, where: "댓글" })))];
  const loadLogs = () => { setShowLog(!showLog); if (logs == null) fb.fetchWhere("log", ["targetId", "==", t.id]).then(setLogs).catch((e) => { console.error(e); setLogs([]); }); };
  const hist = [...(t.statusLog || []).map((s, i) => ({ id: "s" + i, at: s.at, who: s.byName || nameOf(D.users, s.by), text: s.reopen ? "다시 엶" : STATUS_L[s.status] || (s.status === "review" ? "확인 요청" : s.status) })),
    ...(logs || []).map((l) => ({ id: l.id, at: l.at, who: l.byName, text: (LOG_L[l.action] || l.action) + (l.label && l.label !== t.title ? " · " + l.label.replace(t.title + " · ", "") : "") }))].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const users = activeUsers(D.users);
  const dateChips = [["오늘", key], ["내일", addDays(key, 1)], ["모레", addDays(key, 2)], ["다음 주", addDays(key, 7)]];
  // 아래 큰 버튼 하나
  const foot = done ? <Big tone="white" onClick={() => A.reopen(t)}>다시 열기</Big>
    : review ? (amReviewer ? <Big onClick={() => A.approve(t)}>확인 완료</Big> : <Big disabled>{reqName || "맡긴 사람"}님 확인 기다리는 중</Big>)
    : mine ? <Big onClick={() => A.finish(t)}>{needsReview(t) ? `끝냈어요 · ${reqName}님께 확인 요청` : "끝냈어요"}</Big>
    : <Big onClick={() => A.assign(t, cu.id, true)}>내가 이어서 하기</Big>;
  const Banner = ({ tone, children }) => <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: tone === "red" ? "#F8E9EA" : C.soft, border: `1px solid ${tone === "red" ? "#EBC9CC" : "#D7DDEE"}`, fontSize: 14, color: C.text, lineHeight: 1.6 }}>{children}</div>;
  return <Sheet title="업무" onBack={onBack} onClose={onClose} foot={foot}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 6px", lineHeight: 1.35, wordBreak: "keep-all" }}>{risk && <span style={{ display: "inline-block", verticalAlign: 3, marginRight: 6, fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 6, color: risk.red ? C.red : C.navy, background: risk.red ? "#F8E9EA" : C.soft }}>{risk.label}</span>}{t.title}</h2>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <span>담당 {owners.join(", ") || "없음"}{t.ownerAuto ? " (기본 담당)" : ""}</span> · <span style={{ color: n != null && n < 0 && !done ? C.red : C.sub, fontWeight: n != null && n < 0 && !done ? 800 : 400 }}>{dueOf(t) ? `기한 ${md(dueOf(t))}${done ? "" : " · " + ddayLabel(n)}` : "기한 미정"}</span> · <b style={{ color: C.ink }}>{review ? "확인 대기" : STATUS_L[t.status] || t.status}</b>
      {req && <div>{reqName}님이 맡김{t.requestedAt ? ` · ${md(ymd(new Date(t.requestedAt)))}` : ""}{t.ackAt ? " · 받음" : " · 아직 안 받음"}</div>}
      {p && <div><TBtn onClick={() => open({ type: "project", id: p.id })} style={{ padding: "2px 0" }}>{p.category === "launch" ? "신제품" : "프로젝트"} · {p.title} ›</TBtn></div>}
      {parent && <div><TBtn onClick={() => open({ type: "task", id: parent.id })} style={{ padding: "2px 0" }}>상위 업무 · {parent.title} ›</TBtn></div>}
    </div>
    {t.firstStep && !done && <Banner><b>첫 걸음</b> · {t.firstStep}</Banner>}

    {/* 지금 해야 할 일 */}
    {mine && !done && req && !t.ackAt && t.status === "todo" && <Banner><b>{reqName}님이 맡긴 일이에요.</b> 기한을 확인하고 눌러 주세요.
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><Act onClick={() => A.ack(t)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>받았어요</Act><Act onClick={() => setMode("req")}>기한 조정 요청</Act></div></Banner>}
    {t.feedback && !done && !review && <Banner tone="red"><b>수정 요청</b> · {t.feedback.byName} · {ago(t.feedback.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={t.feedback.text} /></div></Banner>}
    {review && amReviewer && <Banner><b>{owners[0]}님이 끝냈어요.</b> 확인하고 '확인 완료'를 눌러 주세요. 고칠 게 있으면 수정 요청을 보내요.
      {mode !== "back" ? <div style={{ marginTop: 8 }}><Act onClick={() => { setTxt(""); setMode("back"); }}>수정 요청</Act></div>
        : <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}><textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} placeholder="무엇을 고치면 될까요?" aria-label="수정 요청 내용" style={inp} /><div style={{ display: "flex", gap: 8 }}><Act onClick={() => setMode("")}>취소</Act><Act onClick={() => { if (txt.trim()) { A.sendBack(t, txt.trim()); setMode(""); } }} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>수정 요청 보내기</Act></div></div>}</Banner>}
    {t.dueReq && <Banner>{approver === cu.id || master ? <><b>{t.dueReq.byName}님이 기한 조정을 요청했어요.</b><div>{md(dueOf(t)) || "미정"} → <b>{md(t.dueReq.date)}</b>{t.dueReq.reason ? ` · ${t.dueReq.reason}` : ""}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}><Act onClick={() => A.answerDue(t, true)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>수락</Act><Act onClick={() => A.answerDue(t, false, "기한은 그대로 지켜 주세요")}>그대로 두기</Act></div></>
      : <>기한 조정 요청 중 · {md(dueOf(t)) || "미정"} → <b>{md(t.dueReq.date)}</b> ({nameOf(D.users, approver) || "책임자"}님 답 기다리는 중)</>}</Banner>}
    {t.blocked && !done && <Banner tone="red"><b>막힘</b> · {t.blocked.byName} · {ago(t.blocked.at)}<div>{t.blocked.reason}</div>{(mine || approver === cu.id || master) && <div style={{ marginTop: 8 }}><Act onClick={() => A.unblock(t)}>막힘 풀기</Act></div>}</Banner>}

    {!done && !review && <div style={{ display: "flex", flexWrap: "wrap", gap: 2, margin: "8px -4px 0" }}>
      {mine && t.status !== "inprogress" && <TBtn onClick={() => A.setStatus(t, "inprogress")}>시작했어요</TBtn>}
      {mine && !t.blocked && <TBtn onClick={() => { setTxt(""); setMode(mode === "block" ? "" : "block"); }}>막혔어요</TBtn>}
      {t.status !== "hold" ? <TBtn onClick={() => A.setStatus(t, "hold")}>보류</TBtn> : <TBtn onClick={() => A.setStatus(t, "todo")}>보류 풀기</TBtn>}
      <TBtn onClick={() => setMode(mode === "who" ? "" : "who")}>담당 바꾸기</TBtn>
      {canDue ? <TBtn onClick={() => setMode(mode === "due" ? "" : "due")}>기한 바꾸기</TBtn> : !t.dueReq && <TBtn onClick={() => setMode(mode === "req" ? "" : "req")}>기한 조정 요청</TBtn>}
    </div>}
    {mode === "block" && <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="무엇 때문에 막혔나요? (예: 시안 자료가 없어요)" aria-label="막힌 이유" style={inp} />
      <div style={{ fontSize: 12.5, color: C.sub }}>{nameOf(D.users, approver || req) || "책임자"}님의 '확인할 것'에 떠요.</div><Act onClick={() => { if (txt.trim()) { A.block(t, txt.trim()); setMode(""); } }} style={{ alignSelf: "flex-start", background: C.navy, color: "#fff", borderColor: C.navy }}>알리기</Act></div>}
    {mode === "who" && <div className="v2-chips" style={{ padding: "8px 0" }}>{users.map((u) => <Chip key={u.id} on={t.assigneeId === u.id} onClick={() => { A.assign(t, u.id, u.id === cu.id); setMode(""); }}>{u.id === cu.id ? "나" : u.name}</Chip>)}</div>}
    {mode === "due" && <div className="v2-chips" style={{ padding: "8px 0" }}>{dateChips.map(([l, d]) => <Chip key={l} onClick={() => { A.setDue(t, d); setMode(""); }}>{l}</Chip>)}<Chip onClick={() => { A.setDue(t, ""); setMode(""); }}>미정</Chip><input type="date" aria-label="날짜 고르기" defaultValue={dueOf(t)} onChange={(e) => { if (e.target.value) { A.setDue(t, e.target.value); setMode(""); } }} className="v2-sel" /></div>}
    {mode === "req" && <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
      <div className="v2-chips">{dateChips.slice(1).map(([l, d]) => <Chip key={l} on={reqDate === d} onClick={() => setReqDate(d)}>{l}</Chip>)}<input type="date" aria-label="원하는 기한" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="v2-sel" /></div>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="이유 (예: 촬영 일정이 밀렸어요)" aria-label="기한 조정 이유" style={inp} />
      <div style={{ fontSize: 12.5, color: C.sub }}>{nameOf(D.users, approver) || "책임자"}님이 수락하면 기한이 바뀌어요. 그 전까지는 지금 기한({md(dueOf(t)) || "미정"})이에요.</div>
      <Act onClick={() => { if (reqDate) { A.requestDue(t, reqDate, txt.trim()); setMode(""); setTxt(""); } }} style={{ alignSelf: "flex-start", background: C.navy, color: "#fff", borderColor: C.navy, opacity: reqDate ? 1 : 0.45 }}>요청 보내기</Act></div>}

    <Head right={mode !== "memo" && <TBtn onClick={() => { setMemo(t.memo || ""); setMode("memo"); }}>{t.memo ? "메모 고치기" : "메모 쓰기"}</TBtn>}>메모 · 하는 법</Head>
    {mode === "memo" ? <div><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} aria-label="메모" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setMode("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={() => { A.setMemo(t, memo); setMode(""); }} style={{ flex: 1, height: 44 }}>메모 저장</Big></div></div>
      : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65, wordBreak: "break-word" }}>{t.memo ? <Linked text={t.memo} /> : "메모가 없어요. 하는 법이나 진행 상황을 적어 두면 다른 사람이 바로 이어받을 수 있어요."}</div>{t.memoAt && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>마지막 수정 {t.memoByName || nameOf(D.users, t.memoBy)} · {ago(t.memoAt)}</div>}</Card>}

    {(kids.length > 0 || !done) && <>
      <Head>하위 업무 {kids.filter(isDone).length}/{kids.length}</Head>
      <Card>
        {kids.map((k) => <Row key={k.id} dim={isDone(k)} title={k.title} sub={nameOf(D.users, k.assigneeId)} onClick={() => open({ type: "task", id: k.id })} right={<Act on={isDone(k)} onClick={() => (isDone(k) ? A.reopen(k) : A.finish(k))}>{isDone(k) ? "✓" : "완료"}</Act>} last={false} />)}
        <div style={{ display: "flex", gap: 8, padding: 10 }}><input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate, noReview: true }); setSub(""); } }} placeholder="+ 하위 업무 (작게 쪼개면 시작이 쉬워요)" aria-label="하위 업무 추가" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} />
          <Act onClick={() => { if (sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate, noReview: true }); setSub(""); } }}>추가</Act></div>
      </Card></>}

    <Head>대화 {notes.filter((x) => !x.deleted).length}</Head>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id, projectId: t.projectId }} />

    <Head right={<><TBtn onClick={() => fileRef.current && fileRef.current.click()}>+ 파일 올리기</TBtn><input ref={fileRef} type="file" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) A.addFiles(t, f); }} /></>}>파일 {files.length}</Head>
    <Card>{files.length === 0 ? <Empty>올린 파일이 없어요</Empty> : files.map((f, i) => <FileRow key={i} f={f} D={D} last={i === files.length - 1} />)}</Card>

    <Head right={<TBtn onClick={loadLogs}>{showLog ? "접기 ▴" : "펼치기 ▾"}</TBtn>}>기록</Head>
    {showLog && <Card>{logs == null ? <Empty>불러오는 중…</Empty> : hist.length === 0 ? <Empty>기록이 없어요</Empty> : hist.map((h, i) => <div key={h.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < hist.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 13.5 }}><span style={{ color: C.mute, flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }}>{h.at ? `${md(ymd(new Date(h.at)))} ${hm(h.at)}` : "-"}</span><span style={{ color: C.text, minWidth: 0, wordBreak: "break-word" }}>{h.who ? h.who + " · " : ""}{h.text}</span></div>)}</Card>}
  </Sheet>;
}
export function FileRow({ f, last }) {
  const img = /^image\//.test(f.type || "");
  return <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: last ? "none" : `1px solid ${C.line}`, textDecoration: "none", color: C.text }}>
    {img ? <img src={f.url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: C.soft, color: C.navy, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{String(f.name || "").split(".").pop().slice(0, 4).toUpperCase() || "파일"}</span>}
    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><span style={{ fontSize: 12, color: C.mute }}>{[f.byName, f.where, f.uploadedAt ? md(ymd(new Date(f.uploadedAt))) : ""].filter(Boolean).join(" · ")}</span></span>
    <span style={{ color: C.navy, fontSize: 13, fontWeight: 800 }}>열기 ›</span>
  </a>;
}

// 대화 (댓글 + 대댓글 + 파일)
export function Thread({ D, cu, A, notes, itemId, ctx }) {
  const th = threads(notes, itemId);
  const [text, setText] = useState(""), [reply, setReply] = useState(null), [files, setFiles] = useState([]), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const send = async () => { if ((!text.trim() && !files.length) || busy) return; setBusy(true);
    const ok = await A.addNote(itemId, text || "(파일)", reply, files, ctx); setBusy(false); if (ok) { setText(""); setFiles([]); setReply(null); } };
  const Note = ({ n, child }) => <div style={{ padding: child ? "8px 0 0 14px" : "12px 14px", borderLeft: child ? `2px solid ${C.line}` : "none", marginTop: child ? 6 : 0 }}>
    <div style={{ fontSize: 12.5, color: C.mute }}><b style={{ color: C.ink }}>{n.byName || nameOf(D.users, n.by)}</b> · {ago(n.at)}</div>
    <div style={{ fontSize: 14.5, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2, wordBreak: "break-word" }}><Linked text={n.text} /></div>
    {(n.files || []).map((f, i) => <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4, marginRight: 8, fontSize: 13, color: C.navy, fontWeight: 700 }}>{f.name} ›</a>)}
  </div>;
  return <Card>
    {th.length === 0 && <Empty>아직 대화가 없어요. 진행 상황이나 궁금한 점을 남겨 주세요.</Empty>}
    {th.map((n) => <div key={n.id} style={{ borderBottom: `1px solid ${C.line}` }}><Note n={n} />
      <div style={{ padding: "0 14px 10px" }}>{n.replies.map((r) => <Note key={r.id} n={r} child />)}<TBtn onClick={() => setReply(reply === n.id ? null : n.id)} style={{ padding: "6px 0", fontSize: 12.5 }}>{reply === n.id ? "답글 취소" : "답글"}</TBtn></div></div>)}
    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {reply && <div style={{ fontSize: 12.5, color: C.sub }}>{(th.find((x) => x.id === reply) || {}).byName}님 글에 답글</div>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={reply ? "답글 쓰기" : "댓글 쓰기 · 진행 상황, 피드백, 링크"} aria-label="댓글" style={{ ...inp, resize: "vertical", fontSize: 14.5 }} />
      {files.length > 0 && <div style={{ fontSize: 13, color: C.sub }}>{files.map((f) => f.name).join(", ")} <TBtn tone="mute" onClick={() => setFiles([])}>✕</TBtn></div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TBtn onClick={() => fileRef.current && fileRef.current.click()}>+ 파일</TBtn><input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles([...e.target.files].slice(0, 10)); e.target.value = ""; }} />
        <span style={{ flex: 1 }} /><Act onClick={send} style={{ background: C.navy, color: "#fff", borderColor: C.navy, opacity: (text.trim() || files.length) && !busy ? 1 : 0.45 }}>{busy ? "올리는 중" : "남기기"}</Act>
      </div>
    </div>
  </Card>;
}

// ───────────────── 고정업무 보기 ─────────────────
export function FixedSheet({ D, cu, A, onBack, onClose, id }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const [checks, setChecks] = useState(null);
  useEffect(() => { fb.fetchWhere("checks", ["taskId", "==", id]).then(setChecks).catch((e) => { console.error(e); setChecks([]); }); }, [id, t && JSON.stringify(t.doneAtBy || {})]);
  if (!t) return <Sheet title="고정업무" onBack={onBack} onClose={onClose}><Empty>{t === false ? "이 고정업무를 찾지 못했어요" : "불러오는 중…"}</Empty></Sheet>;
  const key = ymd(new Date()), mine = fxIsMine(t, cu.id), me = fxMeDone(t, cu.id, key), subs = fxSubs(t, cu.id), people = fxPeople(D.users, t);
  const days = [...Array(7)].map((_, i) => addDays(key, -i));
  const byDay = {}; (checks || []).filter((c) => c.on).forEach((c) => { (byDay[c.date] = byDay[c.date] || []).push(c); });
  return <Sheet title="고정업무" onBack={onBack} onClose={onClose} foot={mine ? <Big tone={me ? "white" : "navy"} onClick={() => A.fxToggle(t)}>{me ? "✓ 체크 취소" : fxDoneWord(t)}</Big> : null}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 4px" }}>{fxLabel(t, cu.id)}</h2>
    <div style={{ fontSize: 13.5, color: C.sub }}>{fxRecurL(t)} · {fxTime(t, cu.id) || "시간 상관없음"} · 담당 {people.length}명{t.paused ? " · 멈춤" : ""}</div>
    {mine && subs.length > 0 && <><Head>체크리스트</Head><div className="v2-chips">{subs.map((x) => { const ok = fxHit(t, ((t.subDone || {})[cu.id] || {})[x.id], key); return <Chip key={x.id} on={ok} onClick={() => A.fxSub(t, x.id)}>{ok ? "✓ " : ""}{x.title}</Chip>; })}</div></>}
    <Head>누가 했나</Head>
    <Card>{people.length === 0 ? <Empty>담당이 없어요</Empty> : people.map((uid, i) => { const ok = fxMeDone(t, uid, key), at = t.doneAtBy && t.doneAtBy[uid];
      return <div key={uid} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: i < people.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 14 }}><b style={{ flex: 1, color: C.text }}>{nameOf(D.users, uid) || uid}</b><span style={{ color: ok ? C.green : C.mute, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{ok ? `✓ ${hm(at)}` : `아직${fxTime(t, uid) ? ` (예정 ${fxTime(t, uid)})` : ""}`}</span></div>; })}</Card>
    <Head>최근 7일</Head>
    <Card>{checks == null ? <Empty>불러오는 중…</Empty> : days.map((d, i) => <div key={d} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < 6 ? `1px solid ${C.line}` : "none", fontSize: 13.5 }}><span style={{ width: 52, color: C.mute, fontVariantNumeric: "tabular-nums" }}>{md(d)}</span><span style={{ flex: 1, color: C.text }}>{fxDueOn(t, d) ? ((byDay[d] || []).map((c) => `${c.name} ${hm(c.at)}`).join(" · ") || "-") : <span style={{ color: C.mute }}>쉬는 날</span>}</span></div>)}
      <div style={{ padding: "8px 14px", fontSize: 12, color: C.mute, borderTop: `1px solid ${C.line}` }}>v2에서 체크한 것부터 쌓여요</div></Card>
    <Head>하는 법 · 메모</Head>
    <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{t.memo ? <Linked text={t.memo} /> : "적어 둔 하는 법이 없어요"}</div></Card>
    <Head>대화</Head>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id }} />
  </Sheet>;
}

// ───────────────── 프로젝트 ─────────────────
