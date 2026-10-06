// 업무OS v2 — 업무 보기 · 고정업무 보기 · 대화 · 파일
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, WD, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit, fxWeekDays, fxIds, FX_WD, monthEndWorkday,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, canSetDue, riskOf, assignedByMe, workloadOf, onTimeOf,
  scopeOf, brandLabel, brandsWithCommon, brandKey, cyclePending, cycleGuess,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, phaseOf } from "./launch.js";
import { DecisionBlock } from "./mindmap.jsx";
import { turnIndex, turnOf, predsOf, nextsOf, finishedOf, finishedAt, lastWord } from "./turn.js";
import { nextWorkday, prevWorkday } from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked, CopyLink, Clash, appLink } from "./ui.jsx";
import { NoteFiles, FileList, useUploads, UpList, UpBtn } from "./files.jsx";
export { FileRow } from "./files.jsx";
import { HoldAsk } from "./hold.jsx";
import { RequestAsk } from "./asks.jsx";
import { askTo } from "./model.js";
import { viewTasks } from "./secret.js";
import { mentionPick, insertMention, parseMentions } from "./mention.js";
import { SecretBox } from "./secretui.jsx";
import { dueChips, ro } from "./pick.jsx";
import { CountBox } from "./routineui.jsx";
import { recTag, DayQty, RecList, useRecs } from "./recui.jsx";
import { qtyCfg, qtyText, QTY_UNITS } from "./rec.js";

const roP = (n) => { const c = String(n || "").slice(-1).charCodeAt(0) - 0xAC00; if (c < 0 || c > 11171) return "(으)로"; const j = c % 28; return j === 0 || j === 8 ? "로" : "으로"; };
export const openTask = (open, t) => open({ type: t.isFixed ? "fixed" : "task", id: t.id });
// 기한 바꾸기 + '기한을 10/6으로 바꿨어요 · 되돌리기' (오늘·지난 일 정리·달력·업무 보기가 같이 씀)
// can 이 아니면 기한 조정 요청(알림은 A.requestDue). onUndo: 되돌린 뒤 화면이 할 일 (예: 달력 날짜 고르기를 그 일로 되돌리기)
export function moveDue(A, setToast, t, d, can, why, onUndo) {
  if (!can) return A.requestDue(t, d, why);
  const prev = { dueDate: t.dueDate || "", dueAuto: !!t.dueAuto, dueReq: t.dueReq || null, ...(t.workDate ? { workDate: t.workDate } : {}) };
  const r = A.setDue(t, d);
  if (setToast) setToast({ text: d ? `기한을 ${md(d)}${ro(md(d))} 바꿨어요` : "기한을 미정으로 바꿨어요", undo: () => {
    if (A.undoTask) A.undoTask(t, { dueDate: d || "" }, prev, `${t.title} · 기한 ${md(dueOf(t)) || "미정"}`); else A.setDue(t, prev.dueDate);
    if (onUndo) onUndo(); } });
  return r;
}
// 업무 보기 안의 띠 (첫 걸음 · 맡김 · 수정 요청 · 막힘 …) — 밖에 두어야 안의 입력칸이 글자마다 다시 그려지지 않음
function Banner({ tone, children }) {
  return <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: tone === "red" ? "#F8E9EA" : C.soft, border: `1px solid ${tone === "red" ? "#EBC9CC" : "#D7DDEE"}`, fontSize: 14, color: C.text, lineHeight: 1.6 }}>{children}</div>;
}
export function useTask(D, id) {
  const live = D.tasks.find((t) => t.id === id);
  const [extra, setExtra] = useState(null);
  useEffect(() => { if (!live && !extra) fb.fetchWhere("tasks", ["id", "==", id]).then((a) => setExtra(a[0] ? viewTasks([a[0]], D)[0] : false)).catch((e) => { console.error("[v2] 업무 불러오기 실패:", e); setExtra(false); }); }, [id, !!live]);
  return live || extra;
}
export function useItemNotes(D, itemId) {
  const [old, setOld] = useState(null);   // null = 아직 읽는 중 (댓글 링크: 다 읽은 뒤에도 없으면 id 로 한 번 더)
  const locked = !!(D.lockedT && String(itemId).startsWith("task:") && D.lockedT.has(String(itemId).slice(5)));   // 기밀(허용 안 됨) 업무 댓글은 읽지 않음
  useEffect(() => { if (locked) return; fb.fetchWhere("notes", ["itemId", "==", itemId]).then(setOld).catch((e) => { console.error("[v2] 댓글 불러오기 실패:", e); setOld([]); }); }, [itemId, locked]);
  return useMemo(() => { if (locked) return Object.assign([], { ready: true }); const m = new Map(); (old || []).forEach((n) => m.set(n.id, n)); D.notes.forEach((n) => { if (n.itemId === itemId) m.set(n.id, n); }); return Object.assign([...m.values()], { ready: old != null }); }, [old, D.notes, itemId, locked]);
}
// 업무 보기 — 맨 위에 '지금 해야 할 일'(받았어요·확인·기한 조정·막힘)을 띄우고, 그 아래 대화(가장 자주 씀) → 순서(앞 일·다음 일) → 메모 → 하위 업무 → 파일
// focus: "talk" | "files" — 열자마자 그 칸으로 (앞 일 '자료 n ›', 앞사람에게 묻기)
export function TaskSheet({ D, cu, A, open, onBack, onClose, id, focus, note, idx: idx0, setToast }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const idx = useMemo(() => idx0 || turnIndex(D), [idx0, D]);
  const [more, setMore] = useState(false);   // 드문 동작 펼치기
  const [mode, setMode] = useState(""), [memo, setMemo] = useState(""), [memoBase, setMemoBase] = useState(null), [clash, setClash] = useState(null), [showLog, setShowLog] = useState(false), [tab2, setTab2] = useState("talk"), [logs, setLogs] = useState(null), [sub, setSub] = useState("");
  const [txt, setTxt] = useState(""), [handTo, setHandTo] = useState(""), [reqDate, setReqDate] = useState(""), [handoff, setHandoff] = useState(""), [depSel, setDepSel] = useState(null), [allOrder, setAllOrder] = useState(false);
  const U = useUploads(A, "task-" + id, (metas) => A.addFiles(t, metas));
  useEffect(() => { if (!focus || !t) return; const h = setTimeout(() => { const el = document.getElementById("v2-t-" + focus); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); return () => clearTimeout(h); }, [focus, !!t]);
  if (t === undefined || t === null) return <Sheet title="업무" kind="업무" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (t === false) return <Sheet title="업무" kind="업무" onBack={onBack} onClose={onClose}><Empty>이 업무를 찾지 못했어요 (휴지통이나 보관함으로 갔을 수 있어요)</Empty></Sheet>;
  if (t.isFixed) return <FixedSheet D={D} cu={cu} A={A} onBack={onBack} onClose={onClose} id={id} focus={focus} note={note} setToast={setToast} />;   // 고정업무는 어느 입구로 와도 고정업무 화면 (일반 화면의 담당 바꾸기·끝냄이 반복 업무를 덮어쓰지 않게)
  const key = ymd(new Date()), mine = isMine(t, cu.id), done = isDone(t), n = ddays(dueOf(t), key), master = isMaster(cu);
  const p = D.projects.find((x) => x.id === t.projectId), owners = ownersOf(t).map((u) => nameOf(D.users, u) || "(없는 사람)");
  const kids = D.tasks.filter((x) => x.parentId === t.id), parent = t.parentId ? D.tasks.find((x) => x.id === t.parentId) : null;
  const req = reqOf(t), reqName = nameOf(D.users, req), giver = req || (t.assignedBy && t.assignedBy !== cu.id ? t.assignedBy : ""), giverName = nameOf(D.users, giver), approver = dueApprover(t, D), canDue = canSetDue(t, cu.id, D, master);
  const review = t.status === "review", amReviewer = review && ((t.reviewTo || req) === cu.id || master);
  const risk = riskOf(t, key);
  // 메모 저장 — 고치는 사이 다른 사람이 먼저 저장했으면 겹친 글을 보여 주고 고르게 (내 글은 그대로 남음)
  const saveMemo = async (force) => { const r = await A.setMemo(t, memo, memoBase, force === true); if (r && r.conflict) setClash(r.cur); else if (r && r.ok) { setClash(null); setMode(""); } };
  const files = [...(t.attachments || []).map((f) => ({ ...f, where: "업무" })), ...notes.filter((nn) => !nn.deleted).flatMap((nn) => (nn.files || []).map((f) => ({ ...f, by: nn.by, byName: nn.byName, uploadedAt: f.uploadedAt || nn.at, where: "댓글" })))];
  const loadLogs = () => { if (logs == null) fb.fetchWhere("log", ["targetId", "==", t.id]).then(setLogs).catch((e) => { console.error(e); setLogs([]); }); };
  // 기록 한 줄의 '이전 → 이후' (담당 · 기한 · 시작 · 상태 · 참조 · 보류 다시 볼 날)
  const CH = { assigneeId: ["담당", (v) => nameOf(D.users, v) || "없음"], assigneeIds: null, dueDate: ["기한", (v) => md(v) || "미정"], startDate: ["시작", (v) => md(v) || "없음"], status: ["상태", (v) => STATUS_L[v] || (v === "review" ? "확인 대기" : v || "-")],
    ccIds: ["참조", (v) => (v || []).map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "없음"], holdUntil: ["다시 볼 날", (v) => md(v) || "미정"], priority: ["중요도", (v) => ({ high: "높음", mid: "보통", low: "낮음" })[v] || "보통"] };
  const chOf = (l) => (l.prev && l.next && typeof l.prev === "object" && !Array.isArray(l.prev) ? Object.keys(l.next).filter((k) => CH[k] && JSON.stringify(l.prev[k] ?? null) !== JSON.stringify(l.next[k] ?? null)).map((k) => ({ k, l: CH[k][0], a: CH[k][1](l.prev[k]), b: CH[k][1](l.next[k]) })) : []);
  const hist = [...(t.statusLog || []).map((s, i) => ({ id: "s" + i, at: s.at, who: s.byName || nameOf(D.users, s.by), text: s.reopen ? "다시 엶" : STATUS_L[s.status] || (s.status === "review" ? "확인 요청" : s.status) })),
    ...(logs || []).map((l) => ({ id: l.id, at: l.at, who: l.byName, ch: chOf(l), text: (LOG_L[l.action] || l.action) + (l.label && l.label !== t.title ? " · " + l.label.replace(t.title + " · ", "") : "") }))].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const users = activeUsers(D.users);
  // 신제품 항목은 '출시 전 평일'(출시일 앞 평일 · 주말·공휴일 건너뜀)도 바로 고를 수 있게
  const lpDate = t && t.launchItem ? ((D.projects || []).find((x) => x.id === t.projectId) || {}).launchDate || "" : "", preL = lpDate ? prevWorkday(addDays(lpDate, -1)) : "";
  const dateChips = [...dueChips(key), ...(preL && preL >= key && !dueChips(key).some(([, d]) => d === preL) ? [[`출시 전 평일 ${md(preL)}`, preL]] : [])];   // 쉬는 날 빼고 · 버튼에 날짜까지 (오늘·지난 일 정리와 같은 버튼)
  // 순서: 앞 일(끝나야 내 차례) · 다음 일(내가 끝내면 그 사람 차례)
  const tu = t.isFixed ? { state: "none", preds: [], open: [] } : turnOf(t, idx, key);
  const preds = t.isFixed ? [] : predsOf(t, idx), nexts = t.isFixed ? [] : nextsOf(t, idx).filter((x) => !x.isFixed);
  const nextOwners = [...new Set(nexts.filter((x) => !isDone(x)).map((x) => ownersOf(x)[0]).filter((u) => u && !ownersOf(t).includes(u)))];
  const reopened = mine && !done && t.status === "inprogress" ? tu.open.find((x) => x.feedback) : null;
  const filesOf = (x) => (x.attachments || []).length + D.notes.filter((nn) => nn.itemId === taskNoteId(x.id) && !nn.deleted).reduce((a, nn) => a + (nn.files || []).length, 0);
  const temp = idx.temp.has(t.id), canOrder = !done && (mine || req === cu.id || (p && p.assigneeId === cu.id) || master);
  // 앞 일 고르기 후보: 같은 프로젝트의 열린 업무(프로젝트가 없으면 내 일·내가 맡긴 일) — 나를 앞 일로 둔 뒤 일은 빼서 고리가 안 생기게
  // 상위 업무(위로 끝까지)도 뺌 — 하위 업무가 상위를 기다리면 담당이 바뀐 뒤 서로 기다리게 됨
  const after = new Set(); const walk = (x) => nextsOf(x, idx).forEach((n2) => { if (!after.has(n2.id)) { after.add(n2.id); walk(n2); } }); if (mode === "deps") { walk(t); for (let q = t.parentId, k = 0; q && k < 50; q = ((idx.byId.get(q) || D.tasks.find((y) => y.id === q)) || {}).parentId, k++) after.add(q); }
  const depPool = mode !== "deps" ? [] : D.tasks.filter((x) => x.id !== t.id && !x.isFixed && !isDone(x) && !after.has(x.id) && (t.projectId ? x.projectId === t.projectId : isMine(x, cu.id) || reqOf(x) === cu.id))
    .sort((a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"))).slice(0, 60);
  const sel = depSel || new Set(preds.map((x) => x.id));
  // 아래 큰 버튼 하나 (+ 다음 사람에게 한마디: 다음 일 담당이 나와 다를 때만)
  const foot = done ? <Big tone="white" onClick={() => A.reopen(t)}>다시 열기</Big>
    : review ? (amReviewer ? <Big onClick={() => A.approve(t)}>확인 완료</Big> : <Big disabled>{nameOf(D.users, t.reviewTo || req) || "맡긴 사람"}님 확인 기다리는 중</Big>)
    : mine ? <>{nextOwners.length > 0 && <input value={handoff} onChange={(e) => setHandoff(e.target.value)} placeholder={`다음 사람(${nameOf(D.users, nextOwners[0])}${nextOwners.length > 1 ? ` 외 ${nextOwners.length - 1}명` : ""})에게 한마디 (선택)`} aria-label="다음 사람에게 한마디" style={{ ...inp, padding: "10px 12px", fontSize: 14, marginBottom: 8 }} />}
      <Big onClick={() => { A.finish(t, handoff); setHandoff(""); }}>{needsReview(t) ? `끝냈어요 · ${reqName}님께 확인 요청` : "끝냈어요"}</Big></>
    : <Big onClick={() => A.assign(t, cu.id, true)}>내가 이어서 하기</Big>;
  const predSub = (x) => { const w = nameOf(D.users, ownersOf(x)[0]) || "담당 없음";
    if (finishedOf(x)) { const f = finishedAt(x); return `${w} · ${isDone(x) ? "끝냄" : "확인 중"}${f ? " " + md(ymd(new Date(f))) : ""}`; }
    const nn = ddays(dueOf(x), key); return `${w} · ${x.blocked ? "막힘" : x.status === "inprogress" ? "진행 중" : x.status === "hold" ? "보류" : "할 일"}${dueOf(x) ? nn < 0 ? ` · ${-nn}일 지남` : ` · ${md(dueOf(x))} 예정` : ""}`; };
  const ORD = 3;
  const projT = ((D.projects || []).find((x) => x.id === t.projectId) || {}).title;
  return <Sheet title="업무" kind="업무" head={t.title} path={projT ? `프로젝트 · ${projT}` : "프로젝트 없음"} onPath={projT ? () => open({ type: "project", id: t.projectId }) : null} onBack={onBack} onClose={onClose} foot={foot}>
    {risk && <div style={{ margin: "12px 0 0" }}><span style={{ display: "inline-block", fontSize: 12.5, fontWeight: 800, padding: "3px 9px", borderRadius: 6, color: risk.red ? C.red : C.navy, background: risk.red ? "#F8E9EA" : C.soft }}>{risk.label}</span></div>}
    <div style={{ height: risk ? 6 : 12 }} />
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <span>담당 {owners.join(", ") || "없음"}{temp ? " (임시 · 책임자로 채움)" : t.ownerFrom === "default" || (t.ownerAuto && !t.ownerFrom) ? " (기본 담당)" : ""}</span> · <span style={{ color: n != null && n < 0 && !done && t.status !== "hold" ? C.red : C.sub, fontWeight: n != null && n < 0 && !done && t.status !== "hold" ? 800 : 400 }}>{dueOf(t) ? `기한 ${md(dueOf(t))}${done ? "" : " · " + ddayLabel(n)}` : "기한 미정"}</span> · <b style={{ color: C.ink }}>{review ? "확인 대기" : STATUS_L[t.status] || t.status}</b>
      {t.startDate && <div>기간 {md(t.startDate)} ~ {dueOf(t) ? md(dueOf(t)) : "기한 미정"}</div>}
      {(t.ccIds || []).length > 0 && <div>참조 {(t.ccIds || []).map((x) => nameOf(D.users, x)).filter(Boolean).join(", ")}</div>}
      {t.handoff && t.handoff.by && <div>{t.handoff.byName}님이 {md(ymd(new Date(t.handoff.at)))}에 {(t.handoff.from || []).map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "담당 없음"} → {nameOf(D.users, t.handoff.to)}{t.handoff.note ? ` · ${t.handoff.note}` : ""}</div>}
      {giver && <div>{giverName}님이 맡김{(req ? t.requestedAt : t.assignedAt) ? ` · ${md(ymd(new Date(req ? t.requestedAt : t.assignedAt)))}` : ""}{t.ackAt ? " · 받음" : " · 아직 안 받음"}</div>}
      {parent && <div><TBtn onClick={() => open({ type: "task", id: parent.id })} style={{ padding: "2px 0" }}>상위 업무 · {parent.title} ›</TBtn></div>}
    </div>
    {t.firstStep && !done && <Banner><b>첫 걸음</b> · {t.firstStep}</Banner>}
    {/* 신제품 횟수 항목(블로그 포스팅 3회 …): 할 때마다 [+1] → 반복(행동지표) 짝이 있으면 같이 (routineui) */}
    <CountBox t={t} D={D} cu={cu} A={A} can={mine || master || !!(p && p.assigneeId === cu.id)} />

    {/* 지금 해야 할 일 */}
    {mine && !done && giver && !t.ackAt && t.status === "todo" && <Banner><b>{giverName}님이 맡긴 일이에요.</b> 기한을 확인하고 눌러 주세요.
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><Act onClick={() => A.ack(t)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>받았어요</Act><Act onClick={() => setMode("req")}>기한 조정 요청</Act></div></Banner>}
    {t.feedback && !done && !review && <Banner><b>수정 요청</b> · {t.feedback.byName} · {ago(t.feedback.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={t.feedback.text} /></div></Banner>}
    {review && amReviewer && <Banner><b>{owners[0]}님이 끝냈어요.</b> 확인하고 '확인 완료'를 눌러 주세요. 고칠 게 있으면 수정 요청을 보내요.
      {mode !== "back" ? <div style={{ marginTop: 8 }}><Act onClick={() => { setTxt(""); setMode("back"); }}>수정 요청</Act></div>
        : <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}><textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} placeholder="무엇을 고치면 될까요?" aria-label="수정 요청 내용" style={inp} /><div style={{ display: "flex", gap: 8 }}><Act onClick={() => setMode("")}>취소</Act><Act onClick={() => { if (txt.trim()) { A.sendBack(t, txt.trim()); setMode(""); } }} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>수정 요청 보내기</Act></div></div>}</Banner>}
    {t.dueReq && <Banner>{(t.dueReq.to || approver) === cu.id || master ? <><b>{t.dueReq.byName}님이 기한 조정을 요청했어요.</b><div>{md(dueOf(t)) || "미정"} → <b>{md(t.dueReq.date)}</b>{t.dueReq.reason ? ` · ${t.dueReq.reason}` : ""}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}><Act onClick={() => A.answerDue(t, true)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>수락</Act><Act onClick={() => A.answerDue(t, false, "기한은 그대로 지켜 주세요")}>그대로 두기</Act></div></>
      : <>기한 조정 요청 중 · {md(dueOf(t)) || "미정"} → <b>{md(t.dueReq.date)}</b> ({nameOf(D.users, t.dueReq.to || approver) || "책임자"}님 답 기다리는 중)</>}</Banner>}
    {t.ask && t.ask.kind === "help" && !done && <Banner><b>도움 요청</b> · {t.ask.byName} → {nameOf(D.users, t.ask.to) || "?"} · {ago(t.ask.at)}{t.ask.text && <div style={{ whiteSpace: "pre-wrap" }}><Linked text={t.ask.text} /></div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{(t.ask.to === cu.id || master) && <Act onClick={() => { const el = document.getElementById("v2-t-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}>대화로 답하기</Act>}
        {(t.ask.to === cu.id || master) && <Act onClick={() => A.closeAsk(t, true)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>해결됐어요</Act>}
        {t.ask.by === cu.id && t.ask.to !== cu.id && <Act onClick={() => A.closeAsk(t, false)}>요청 거두기</Act>}</div></Banner>}
    {t.blocked && !done && <Banner tone="red"><b>막힘</b> · {t.blocked.byName} · {ago(t.blocked.at)}<div>{t.blocked.reason}</div>{(mine || approver === cu.id || master) && <div style={{ marginTop: 8 }}><Act onClick={() => A.unblock(t)}>막힘 풀기</Act></div>}</Banner>}
    {tu.state === "late" && mine && !done && (() => { const x = (tu.show && !finishedOf(tu.show) ? tu.show : null) || tu.open.find((y) => y.blocked || y.status === "hold" || (dueOf(y) && dueOf(y) < key)) || tu.open[0];
      return <Banner tone="red"><b>앞 일이 늦어지고 있어요</b> · {x.title} ({predSub(x)}) · 내 기한 {md(dueOf(t)) || "미정"}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><Act onClick={() => open({ type: "task", id: x.id, focus: "talk" })}>앞사람에게 묻기</Act>{canDue ? <Act onClick={() => setMode("due")}>내 기한 바꾸기</Act> : !t.dueReq && <Act onClick={() => setMode("req")}>기한 조정 요청</Act>}</div></Banner>; })()}
    {t.status === "hold" && !done && <Banner><b>보류</b>{t.holdBy === "proj" ? " · 프로젝트째 보류" : ""}{t.holdReason ? ` · ${t.holdReason}` : " · 이유 없음"}{t.heldAt ? ` · ${-ddays(ymd(new Date(t.heldAt)), key)}일째` : ""}
      <div>{t.holdUntil ? `다시 볼 날 ${md(t.holdUntil)} (${ddayLabel(ddays(t.holdUntil, key))})` : "다시 볼 날 미정"}{t.holdBy === "proj" ? " · 프로젝트를 다시 시작하면 같이 풀려요" : ""}</div>
      {t.holdBy !== "proj" && <div style={{ marginTop: 8 }}><Act onClick={() => setMode("hold")}>이유 · 다시 볼 날 바꾸기</Act></div>}</Banner>}
    {mode === "hold" && <HoldAsk title={`보류 · ${t.title}`} onNo={() => setMode("")} onYes={(why, until) => { A.hold(t, why, until); setMode(""); }} />}
    {reopened && <Banner>앞 일 "{reopened.title}"이 수정 요청으로 다시 열렸어요 · {nameOf(D.users, ownersOf(reopened)[0]) || "앞사람"}님이 다시 끝내면 '이제 내 차례'로 알려 드려요</Banner>}

    {!done && !review && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 0" }}>
      {mine && t.status !== "inprogress" && <TBtn v="solid" onClick={() => A.setStatus(t, "inprogress")}>시작했어요</TBtn>}
      {mine && !t.blocked && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "block" ? "" : "block"); }}>막혔어요</TBtn>}
      {t.status === "hold" && <TBtn v="soft" onClick={() => A.unhold(t)}>보류 풀기</TBtn>}
      <TBtn v="soft" onClick={() => { setHandTo(""); setTxt(""); setMode(mode === "who" ? "" : "who"); }}>담당 바꾸기</TBtn>
      <TBtn v="soft" onClick={() => setMode("ask")}>요청</TBtn>
      {canDue ? <TBtn v="soft" onClick={() => setMode(mode === "due" ? "" : "due")}>기한 바꾸기</TBtn> : !t.dueReq && <TBtn v="soft" onClick={() => setMode(mode === "req" ? "" : "req")}>기한 조정 요청</TBtn>}
      <TBtn onClick={() => setMore(!more)} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn>
    </div>}
    {(done || review) && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 0" }}><TBtn onClick={() => setMore(!more)} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn></div>}
    {/* 사용 빈도별 노출: 자주 쓰는 동작만 늘 보이고, 드문 동작(보류 · 참조 · 결정 업무 · 기밀)은 '더 하기' 안에 · 켜져 있는 것(참조·기밀)은 상태 줄로 늘 보임 */}
    {more && <div className="v2-more" role="group" aria-label="더 하기">
      {!done && !review && t.status !== "hold" && <TBtn v="soft" onClick={() => { setMore(false); setMode("hold"); }}>보류</TBtn>}
      {!done && <TBtn v="soft" onClick={() => { setMore(false); setMode(mode === "cc" ? "" : "cc"); }}>참조{(t.ccIds || []).length ? ` ${(t.ccIds || []).length}` : ""}</TBtn>}
      {!done && !t.parentId && !t.decision && (mine || req === cu.id || master) && <TBtn v="soft" onClick={() => { setMore(false); A.setDecision(t, true); }}>결정 업무로 쓰기</TBtn>}
      {(mine || master) && !done && <label className="v2-more-date">시작일 <input type="date" aria-label="시작일" className="v2-sel" value={t.startDate || ""} max={dueOf(t) || undefined} onChange={(e) => A.patchTask(t, { startDate: e.target.value }, "edit", `${t.title} · 시작 ${md(e.target.value) || "없음"}`, { prev: { startDate: t.startDate || "" } })} style={{ height: 34, padding: "0 6px", fontSize: 13 }} /></label>}
      <SecretBox kind="task" x={t} D={D} cu={cu} A={A} only="button" />
      <CopyLink kind="t" id={t.id} label="업무 링크 복사" onDone={() => setToast && setToast({ text: "링크를 복사했어요 · 잔디·카톡에 붙여 넣으면 이 업무가 바로 열려요" })} />
    </div>}
    {(t.ccIds || []).length > 0 && mode !== "cc" && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8 }}>참조 {(t.ccIds || []).map((id) => nameOf(D.users, id)).filter(Boolean).join(", ")} <TBtn v="plain" onClick={() => setMode("cc")} style={{ fontSize: 12.5 }}>바꾸기 ›</TBtn></div>}
    {mode === "block" && <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="무엇 때문에 막혔나요? (예: 시안 자료가 없어요)" aria-label="막힌 이유" style={inp} />
      <div style={{ fontSize: 12.5, color: C.sub }}>{nameOf(D.users, askTo(t, D, cu.id)) || "관리자"}님의 '확인할 것'에 떠요.</div><Act onClick={() => { if (txt.trim()) { A.block(t, txt.trim(), askTo(t, D, cu.id)); setMode(""); } }} style={{ alignSelf: "flex-start", background: C.navy, color: "#fff", borderColor: C.navy }}>알리기</Act></div>}
    {mode === "who" && <div style={{ padding: "8px 0" }}><div className="v2-chips">{users.map((u) => <Chip key={u.id} on={handTo ? handTo === u.id : t.assigneeId === u.id} onClick={() => setHandTo(u.id)}>{u.id === cu.id ? "나" : u.name}</Chip>)}</div>
      {handTo && !(ownersOf(t).length === 1 && ownersOf(t)[0] === handTo) && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="넘기는 이유·이어서 할 것 (선택)" aria-label="넘기며 한마디" style={inp} />
        <div style={{ fontSize: 12.5, color: C.sub }}>{nameOf(D.users, handTo)}님 '확인할 것'에 맡김으로 · 지금 담당{reqOf(t) ? "·맡긴 사람" : ""}에게 '담당 바뀜'으로 알려요 · 5초 되돌리기</div>
        <Act onClick={() => { A.assign(t, handTo, handTo === cu.id, txt); setTxt(""); setHandTo(""); setMode(""); }} style={{ alignSelf: "flex-start", background: C.navy, color: "#fff", borderColor: C.navy }}>{handTo === cu.id ? "내가 이어서 하기" : `${nameOf(D.users, handTo)}님에게 넘기기`}</Act></div>}</div>}
    {mode === "cc" && <div style={{ padding: "8px 0" }}><div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>참조 = 담당이 아니어도 이 업무의 대화·소식을 받는 사람</div><div className="v2-chips">{users.filter((u) => !ownersOf(t).includes(u.id)).map((u) => { const on = (t.ccIds || []).includes(u.id);
      return <Chip key={u.id} on={on} onClick={() => A.toggleCc(t, u.id, !on)}>{on ? "✓ " : ""}{u.id === cu.id ? "나" : u.name}</Chip>; })}</div></div>}
    {mode === "ask" && <RequestAsk t={t} D={D} cu={cu} A={A} mine={mine} onNo={() => setMode("")} />}
    <SecretBox kind="task" x={t} D={D} cu={cu} A={A} only="status" />
    {mode === "due" && <div className="v2-chips" style={{ padding: "8px 0" }}>{dateChips.map(([l, d]) => <Chip key={d} onClick={() => { moveDue(A, setToast, t, d, true); setMode(""); }}>{l}</Chip>)}<Chip onClick={() => { moveDue(A, setToast, t, "", true); setMode(""); }}>미정</Chip><input type="date" aria-label="날짜 고르기" defaultValue={dueOf(t)} onChange={(e) => { if (e.target.value) { moveDue(A, setToast, t, e.target.value, true); setMode(""); } }} className="v2-sel" /></div>}
    {mode === "req" && <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
      <div className="v2-chips">{dateChips.filter(([, d]) => d !== key && d !== dueOf(t)).map(([l, d]) => <Chip key={d} on={reqDate === d} onClick={() => setReqDate(d)}>{l}</Chip>)}<input type="date" aria-label="원하는 기한" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="v2-sel" /></div>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="이유 (예: 촬영 일정이 밀렸어요)" aria-label="기한 조정 이유" style={inp} />
      <div style={{ fontSize: 12.5, color: C.sub }}>{nameOf(D.users, approver) || "책임자"}님이 수락하면 기한이 바뀌어요. 그 전까지는 지금 기한({md(dueOf(t)) || "미정"})이에요.</div>
      {reqDate && reqDate === dueOf(t) && <div style={{ fontSize: 12.5, color: C.red }}>지금 기한과 같은 날이에요 · 다른 날을 골라 주세요</div>}
      <Act onClick={() => { if (reqDate && reqDate !== dueOf(t)) { A.requestDue(t, reqDate, txt.trim()); setMode(""); setTxt(""); } }} style={{ alignSelf: "flex-start", background: C.navy, color: "#fff", borderColor: C.navy, opacity: reqDate && reqDate !== dueOf(t) ? 1 : 0.45 }}>요청 보내기</Act></div>}

    <div id="v2-t-talk" style={{ scrollMarginTop: 8, margin: "18px 0 8px" }}><Seg items={[["talk", `대화 ${notes.filter((x) => !x.deleted).length}`], ["log", "기록"]]} value={tab2} onChange={(v) => { setTab2(v); if (v === "log" && logs == null) loadLogs(); }} /></div>
    {tab2 === "talk" ? <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id, projectId: t.projectId }} link={{ kind: "t", id: t.id }} hl={note} />
      : <Card>{logs == null ? <Empty>불러오는 중…</Empty> : hist.length === 0 ? <Empty>기록이 없어요</Empty> : hist.map((h, i) => <div key={h.id} className="v2-hist" style={{ borderBottom: i < hist.length - 1 ? `1px solid ${C.line}` : "none" }}>
          <div className="hd"><b>{h.text}</b><span>{h.who || ""}{h.at ? ` · ${md(ymd(new Date(h.at)))} ${hm(h.at)}` : ""}</span></div>
          {h.ch && h.ch.length > 0 && <div className="ch">{h.ch.map((c) => <span key={c.k}><small>{c.l}</small> <i className="was">{c.a}</i> → <i className="now">{c.b}</i></span>)}</div>}</div>)}</Card>}


    {!t.isFixed && (preds.length > 0 || nexts.length > 0 || !done) && <>
      <Head right={mode !== "deps" && canOrder && <TBtn onClick={() => { setDepSel(null); setMode("deps"); }}>앞 일 바꾸기</TBtn>}>순서</Head>
      {mode === "deps" ? <Card>
        <div style={{ padding: "10px 14px", fontSize: 13, color: C.sub, borderBottom: `1px solid ${C.line}` }}>고른 일이 모두 끝나야 이 일 차례예요. {t.projectId ? "같은 프로젝트의 열린 업무" : "내 일 · 내가 맡긴 일"}에서 골라요.</div>
        {depPool.length === 0 && <Empty>고를 수 있는 열린 업무가 없어요</Empty>}
        {depPool.map((x) => { const on = sel.has(x.id); return <button key={x.id} type="button" role="checkbox" aria-checked={on} onClick={() => { const nx = new Set(sel); on ? nx.delete(x.id) : nx.add(x.id); setDepSel(nx); }}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", borderBottom: `1px solid ${C.line}`, background: on ? "#F2F4FA" : "#fff", font: "inherit", textAlign: "left", cursor: "pointer" }}>
          <span style={{ flex: "0 0 20px", height: 20, borderRadius: 5, border: `2px solid ${on ? C.navy : "#B7BFD0"}`, background: on ? C.navy : "#fff", color: "#fff", fontSize: 13, lineHeight: "16px", textAlign: "center", fontWeight: 900 }}>{on ? "✓" : ""}</span>
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title}</span><span style={{ fontSize: 12, color: C.sub }}>{predSub(x)}</span></span></button>; })}
        <div style={{ display: "flex", gap: 8, padding: 10, flexWrap: "wrap" }}><Act onClick={() => setMode("")}>취소</Act><Act onClick={() => { A.setDeps(t, []); setMode(""); }}>앞 일 없음</Act><span style={{ flex: 1 }} />
          <Act onClick={() => { A.setDeps(t, [...new Set([...(Array.isArray(t.deps) ? t.deps : []).filter((x) => !idx.byId.has(x)), ...sel])]); setMode(""); }} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>{sel.size ? `앞 일 ${sel.size}개로 정하기` : "저장"}</Act></div>
      </Card>
      : (preds.length > 0 || nexts.length > 0) ? <Card>
        {(allOrder ? preds : preds.slice(0, ORD)).map((x) => { const w = lastWord(x, D.notes), fn = filesOf(x);
          return <div key={x.id} style={{ borderBottom: `1px solid ${C.line}` }}><Row tag="앞 일" tagTone={!finishedOf(x) && tu.state === "late" ? "red" : null} title={x.title} sub={predSub(x)} onClick={() => open({ type: "task", id: x.id })} last />
            {(w || fn > 0) && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 10px", background: "#fff" }}>
              <span className="v2-clamp3" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.5, wordBreak: "break-word" }}>{w ? `${w.handoff ? "남긴 말" : "마지막 말"} · ${w.byName || ""}: ${w.text}` : ""}</span>
              {fn > 0 && <TBtn onClick={() => open({ type: "task", id: x.id, focus: "files" })} style={{ padding: "2px 0", fontSize: 12.5 }}>자료 {fn} ›</TBtn>}</div>}</div>; })}
        {(allOrder ? nexts : nexts.slice(0, ORD)).map((x) => <Row key={x.id} tag="다음 일" title={x.title} sub={predSub(x)} onClick={() => open({ type: "task", id: x.id })} last={false} />)}
        {!allOrder && (preds.length > ORD || nexts.length > ORD) && <More onClick={() => setAllOrder(true)}>앞 일 {preds.length} · 다음 일 {nexts.length} 모두 ▾</More>}
        {!done && <div style={{ padding: "4px 10px" }}><TBtn onClick={() => open({ type: "add", preset: { projectId: t.projectId || "", deps: [t.id], dueDate: nextWorkday(addDays(dueOf(t) && dueOf(t) > key ? dueOf(t) : key, 1)) } })}>+ 다음 일 맡기기</TBtn></div>}
      </Card>
      : <div style={{ fontSize: 13, color: C.sub, margin: "-2px 2px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>앞뒤로 이어진 일이 없어요<TBtn onClick={() => open({ type: "add", preset: { projectId: t.projectId || "", deps: [t.id], dueDate: nextWorkday(addDays(dueOf(t) && dueOf(t) > key ? dueOf(t) : key, 1)) } })}>+ 다음 일 맡기기</TBtn></div>}
    </>}

    <Head right={mode !== "memo" && <TBtn onClick={() => { setMemo(t.memo || ""); setMemoBase(t.memoAt || null); setClash(null); setMode("memo"); }}>{t.memo ? "메모 고치기" : "메모 쓰기"}</TBtn>}>메모 · 하는 법</Head>
    {mode === "memo" ? <div><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} aria-label="메모" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setMode("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={saveMemo} style={{ flex: 1, height: 44 }}>메모 저장</Big></div>
      {clash && <Clash who={clash.memoByName} at={clash.memoAt} text={clash.memo} onMerge={() => { setMemo(`${clash.memo || ""}\n\n${memo}`.trim()); setMemoBase(clash.memoAt || null); setClash(null); }} onMine={() => saveMemo(true)} />}</div>
      : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65, wordBreak: "break-word" }}>{t.memo ? <Linked text={t.memo} /> : "메모가 없어요. 하는 법이나 진행 상황을 적어 두면 다른 사람이 바로 이어받을 수 있어요."}</div>{t.memoAt && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>마지막 수정 {t.memoByName || nameOf(D.users, t.memoBy)} · {ago(t.memoAt)}</div>}</Card>}

    {t.decision ? <><Head>안 비교 · 결정 업무</Head><Card style={{ padding: "8px 14px 12px" }}><DecisionBlock D={D} cu={cu} A={A} t={t} open={open} /></Card></>
    : (kids.length > 0 || !done) && <>
      <Head>하위 업무 {kids.filter(isDone).length}/{kids.length}</Head>
      <Card>
        {kids.map((k) => <Row key={k.id} dim={isDone(k)} title={k.title} sub={nameOf(D.users, k.assigneeId)} onClick={() => open({ type: "task", id: k.id })} right={<Act on={isDone(k)} onClick={() => (isDone(k) ? A.reopen(k) : A.finish(k))}>{isDone(k) ? "✓" : "완료"}</Act>} last={false} />)}
        <div style={{ display: "flex", gap: 8, padding: 10 }}><input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate, noReview: true }); setSub(""); } }} placeholder="+ 하위 업무 (작게 쪼개면 시작이 쉬워요)" aria-label="하위 업무 추가" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} />
          <Act onClick={() => { if (sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate, noReview: true }); setSub(""); } }}>추가</Act></div>
      </Card></>}

    <div id="v2-t-files" style={{ scrollMarginTop: 8 }} /><Head right={<UpBtn U={U} />}>파일 {files.length}</Head>
    <UpList U={U} style={{ marginBottom: 8 }} />
    <FileList files={files} empty="올린 파일이 없어요" />

  </Sheet>;
}
// 대화 (댓글 + 대댓글 + 파일)
// rec: 하루 기록 한 건에 붙이는 글 {date, uid, qty, runs} (반복 실행 시트 날짜별 기록 줄을 누르면) → 댓글 extra rec · 목록엔 '10/6 기록 · 37건' 꼬리표
// link: 댓글 [링크 복사] 주소 {kind 't'|'p'|'r', id} → os2.html#t-ID~c-댓글ID · hl: 링크로 열었을 때 그 댓글 id (그 자리로 가서 2초 테두리 · 못 찾으면 id 로 한 번 읽기)
// 파일: 고른 파일은 [남기기] 때 파일마다 진행 막대로 올리고(실패한 파일만 [다시]) 다 올라가면 댓글 저장
export function Thread({ D, cu, A, notes, itemId, ctx, rec, onRec, cfg, link, hl }) {
  const [got, setGot] = useState(null), [miss, setMiss] = useState(false), [hlOn, setHlOn] = useState(""), hlDone = useRef(false);
  const all = got && !notes.some((n) => n.id === got.id) ? [...notes, got] : notes;
  const th = threads(all, itemId);
  const [text, setText] = useState(""), [reply, setReply] = useState(null), [busy, setBusy] = useState(false), [pend, setPend] = useState(false), [copied, setCopied] = useState(""), [showL, setShowL] = useState(null);
  const U = useUploads(A, "note-" + itemId);
  const fileRef = useRef(null), taRef = useRef(null);
  const pick = mentionPick(text, D.users, cu.id), tagged = parseMentions(text, D.users).filter((id) => id !== cu.id);   // '@' 를 치면 사람 고르기 · 부를 사람 미리 보기
  const post = async () => { const rows = U.cur(); if (rows.some((r) => r.st !== "ok")) { setPend(true); return false; }
    const ok = await A.addNote(itemId, text || "(파일)", reply, rows.map((r) => r.meta), ctx, rec ? { rec } : undefined);
    if (ok) { setText(""); U.clear(); setReply(null); setPend(false); if (onRec) onRec(null); } return ok; };
  const send = async () => { if ((!text.trim() && !U.rows.length) || busy || U.busy) return; setBusy(true);
    try { await U.flow(); await post(); } finally { setBusy(false); } };
  const retry = async (k) => { setBusy(true); try { await U.retry(k); if (pend && U.cur().every((r) => r.st === "ok")) await post(); } finally { setBusy(false); } };
  // 링크로 열기: 그 댓글로 스크롤 + 잠깐 테두리
  useEffect(() => { if (!hl || hlDone.current) return;
    const el = document.getElementById("v2-n-" + hl);
    if (el) { hlDone.current = true; const h = setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); setHlOn(hl); setTimeout(() => setHlOn(""), 2200); }, 350); return () => clearTimeout(h); }
    if (!notes.ready || got !== null) return;
    setGot(false); fb.fetchWhere("notes", ["id", "==", hl]).then((a) => { const n = a.find((x) => x.itemId === itemId && !x.deleted); if (n) setGot(n); else { hlDone.current = true; setMiss(true); } })
      .catch((e) => { console.error("[v2] 댓글 불러오기 실패:", e); hlDone.current = true; setMiss(true); }); }, [hl, th.length, notes.ready, got]);
  const copy = (nid) => { const u = appLink(link.kind, link.id, nid);
    const ok = () => { setShowL(null); setCopied(nid); setTimeout(() => setCopied((c) => (c === nid ? "" : c)), 2200); };
    try { navigator.clipboard.writeText(u).then(ok, () => setShowL({ id: nid, u })); } catch (e) { setShowL({ id: nid, u }); } };
  const LinkBtn = ({ n }) => link ? <TBtn v="plain" onClick={() => copy(n.id)} style={{ padding: "6px 0", fontSize: 12.5 }}>{copied === n.id ? "✓ 복사했어요" : "링크 복사"}</TBtn> : null;
  const LinkBox = ({ n }) => showL && showL.id === n.id ? <input readOnly value={showL.u} autoFocus onFocus={(e) => e.target.select()} aria-label="복사할 링크" style={{ ...inp, marginTop: 4, fontSize: 12.5, padding: "8px 10px" }} /> : null;
  const Note = ({ n, child }) => <div id={"v2-n-" + n.id} className={"v2-note" + (hlOn === n.id ? " hl" : "")} style={{ padding: child ? "8px 0 0 14px" : "12px 14px", borderLeft: child ? `2px solid ${C.line}` : "none", marginTop: child ? 6 : 0, scrollMarginTop: 60 }}>
    <div style={{ fontSize: 12.5, color: C.mute }}><b style={{ color: C.ink }}>{n.byName || nameOf(D.users, n.by)}</b> · {ago(n.at)}</div>
    <div style={{ fontSize: 14.5, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2, wordBreak: "break-word" }}><Linked text={n.text} /></div>
    <NoteFiles files={n.files} />
    {n.rec && <div><span className="v2-rttag">{recTag(n.rec, cfg)}</span></div>}
    {child && link && <><div className="v2-nact"><LinkBtn n={n} /></div><LinkBox n={n} /></>}
  </div>;
  const canSend = (text.trim() || U.rows.length) && !busy && !U.busy;
  return <Card>
    {miss && <div role="status" style={{ padding: "10px 14px", fontSize: 13, color: C.sub, background: C.soft, borderBottom: `1px solid ${C.line}` }}>이 댓글을 찾지 못했어요 · 지워졌거나 다른 곳의 댓글일 수 있어요</div>}
    {th.length === 0 && <Empty>아직 대화가 없어요. 진행 상황이나 궁금한 점을 남겨 주세요.</Empty>}
    {th.map((n) => <div key={n.id} style={{ borderBottom: `1px solid ${C.line}` }}><Note n={n} />
      <div style={{ padding: "0 14px 10px" }}>{n.replies.map((r) => <Note key={r.id} n={r} child />)}
        <div className="v2-nact"><TBtn v="plain" onClick={() => setReply(reply === n.id ? null : n.id)} style={{ padding: "6px 0", fontSize: 12.5 }}>{reply === n.id ? "답글 취소" : "답글"}</TBtn>{link && <span style={{ color: C.line }}>|</span>}<LinkBtn n={n} /></div>
        <LinkBox n={n} /></div></div>)}
    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {reply && <div style={{ fontSize: 12.5, color: C.sub }}>{(th.find((x) => x.id === reply) || {}).byName}님 글에 답글</div>}
      {rec && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.sub }}><span className="v2-rttag" style={{ marginTop: 0 }}>{recTag(rec, cfg)}</span>{rec.name ? `${rec.name}님 기록에 붙여요` : "이 기록에 붙여요"}<TBtn v="plain" tone="mute" onClick={() => onRec && onRec(null)}>✕ 빼기</TBtn></div>}
      <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={reply ? "답글 쓰기 · @이름으로 부르기" : "댓글 쓰기 · 진행 상황, 피드백, 링크 · @이름으로 부르기"} aria-label="댓글" style={{ ...inp, resize: "vertical", fontSize: 14.5 }} />
      {pick.length > 0 && <div className="v2-chips" role="listbox" aria-label="부를 사람">{pick.map((u) => <Chip key={u.id} onClick={() => { setText(insertMention(text, u.name)); setTimeout(() => taRef.current && taRef.current.focus(), 0); }}>@{u.name}</Chip>)}</div>}
      {tagged.length > 0 && <div style={{ fontSize: 12.5, color: C.sub }}>부를 사람 {tagged.map((id) => nameOf(D.users, id)).join(", ")} · '확인할 것'에 뜨고, 문자 알림을 켠 사람은 문자도 받아요</div>}
      <UpList U={U} onRetry={retry} onDrop={(k) => U.drop(k)} />
      {pend && !U.busy && U.rows.some((r) => r.st === "fail") && <div style={{ fontSize: 12.5, color: C.red }}>못 올린 파일이 있어서 아직 안 남겼어요 · [다시]를 누르거나 [빼기] 뒤 [남기기]</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TBtn disabled={busy || U.busy} onClick={() => fileRef.current && fileRef.current.click()}>+ 파일</TBtn><input ref={fileRef} type="file" multiple hidden aria-label="댓글에 붙일 파일" onChange={(e) => { const f = [...e.target.files].slice(0, Math.max(0, 10 - U.rows.length)); e.target.value = ""; if (f.length) { U.add(f); setPend(false); } }} />
        <span style={{ flex: 1 }} /><TBtn v="solid" disabled={!canSend} onClick={send} style={{ minWidth: 72, height: 36 }}>{busy || U.busy ? "올리는 중" : "남기기"}</TBtn>
      </div>
    </div>
  </Card>;
}

// ───────────────── 고정업무 보기 ─────────────────
export function FixedSheet({ D, cu, A, onBack, onClose, id, focus, note, setToast }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const oldMine = useItemNotes(D, `${id}~${cu.id}`);   // 버전1 고정업무 '내 메모'(사람별 · 읽기만)
  const [tick, setTick] = useState(0), [rec, setRec] = useState(null);
  const R = useRecs(D, id, `${tick}:${t && JSON.stringify(t.doneAtBy || {})}`, true);   // 하루 기록(이번 달 · itemId+ym) + 오늘 것은 실시간
  const [editMemo, setEditMemo] = useState(false), [memo, setMemo] = useState(""), [memoBase, setMemoBase] = useState(null), [clash, setClash] = useState(null), [oldOpen, setOldOpen] = useState(false);
  const U = useUploads(A, "task-" + id, (metas) => A.addFiles(t, metas));
  const toTalk = () => setTimeout(() => { const el = document.getElementById("v2-fx-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  useEffect(() => { if (focus !== "talk" || !t) return; const h = setTimeout(() => { const el = document.getElementById("v2-fx-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120); return () => clearTimeout(h); }, [focus, !!t]);
  if (!t) return <Sheet title="고정업무" kind="고정업무" onBack={onBack} onClose={onClose}><Empty>{t === false ? "이 고정업무를 찾지 못했어요" : "불러오는 중…"}</Empty></Sheet>;
  const key = ymd(new Date()), mine = fxIsMine(t, cu.id), me = fxMeDone(t, cu.id, key), subs = fxSubs(t, cu.id), people = fxPeople(D.users, t);
  const cfg = qtyCfg(t), myDay = (R.docs || []).find((d) => d.date === key && d.uid === cu.id), myQty = +(myDay && myDay.qty) || 0;
  const canEdit = mine || isMaster(cu);   // 메모·자료 = 담당 · 관리자
  // 2단계 권한: 개인(me) = 본인이 다 · 반복 실행(brand)의 공통 체크리스트·브랜드·담당·반복 = 관리자 · 담당은 내 체크리스트·보이는 이름·내 시간·메모·파일
  const master = isMaster(cu), sc = scopeOf(t), isRt = sc === "brand";
  const canRecur = master || (!isRt && mine), canCommon = master || (!isRt && mine), canScope = master || (sc === "me" && mine);
  const pathL = isRt ? `반복 실행 · ${brandLabel(t.brand, D.brands)} · ${fxRecurL(t)}${t.fixedTime ? " " + t.fixedTime : ""}` : `고정업무${sc === "unset" ? " · 브랜드 미정" : ""} · ${fxRecurL(t)}${t.fixedTime ? " " + t.fixedTime : ""}`;
  const cg = cyclePending(t) ? cycleGuess(t) : null;
  const saveMemo = async (force) => { const r = await A.setMemo(t, memo, memoBase, force === true); if (r && r.conflict) setClash(r.cur); else if (r && r.ok) { setClash(null); setEditMemo(false); } };
  const files = [...(t.attachments || []).map((f) => ({ ...f, where: "고정업무" })), ...notes.filter((nn) => !nn.deleted).flatMap((nn) => (nn.files || []).map((f) => ({ ...f, by: nn.by, byName: nn.byName, uploadedAt: f.uploadedAt || nn.at, where: "댓글" })))];
  const oldNotes = oldMine.filter((n) => !n.deleted).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return <Sheet title={isRt ? "반복 실행" : "고정업무"} kind={isRt ? "반복 실행" : "고정업무"} head={fxLabel(t, cu.id)} path={pathL} onBack={onBack} onClose={onClose} foot={mine ? <Big tone={me ? "white" : "navy"} onClick={() => A.fxToggle(t)}>{me ? "✓ 체크 취소" : fxDoneWord(t)}</Big> : null}>
    <div style={{ fontSize: 13.5, color: C.sub, marginTop: 12 }}>{fxRecurL(t)} · {fxTime(t, cu.id) || "시간 상관없음"} · 담당 {people.length}명{t.paused ? " · 멈춤" : ""}</div>
    {cyclePending(t) && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>주기 확인 필요{cg ? ` · 제안 ${({ daily: "매일", weekly: "매주", monthly: "매월" })[cg.rt]}(${cg.from} '${cg.word}')` : ""} · 관리자가 정해요</div>}
    {mine && subs.length > 0 && <><Head>체크리스트</Head><div className="v2-chips">{subs.map((x) => { const ok = fxHit(t, ((t.subDone || {})[cu.id] || {})[x.id], key); return <Chip key={x.id} on={ok} onClick={() => A.fxSub(t, x.id)}>{ok ? "✓ " : ""}{x.title}</Chip>; })}</div></>}
    <FxMore t={t} D={D} cu={cu} A={A} focus={focus} mine={mine} canRecur={canRecur} canCommon={canCommon} canScope={canScope} master={master} setToast={setToast} />
    <Head>누가 했나</Head>
    <Card>{people.length === 0 ? <Empty>담당이 없어요</Empty> : people.map((uid, i) => { const ok = fxMeDone(t, uid, key), at = t.doneAtBy && t.doneAtBy[uid];
      return <div key={uid} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: i < people.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 14 }}><b style={{ flex: 1, color: C.text }}>{nameOf(D.users, uid) || uid}</b><span style={{ color: ok ? C.green : C.mute, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{ok ? `✓ ${hm(at)}` : `아직${fxTime(t, uid) ? ` (예정 ${fxTime(t, uid)})` : ""}`}</span></div>; })}</Card>
    {cfg && mine && <DayQty cfg={cfg} mine={myQty} can extra={people.length > 1 ? `모두 ${qtyText(cfg, (R.docs || []).filter((d) => d.date === key).reduce((a, d) => a + (+d.qty || 0), 0))}` : ""}
      onAdd={async (n) => { await A.fxQty(t, n, "add"); setTick((x) => x + 1); }} onSet={async (n) => { await A.fxQty(t, n, "set"); setTick((x) => x + 1); }} />}
    <RecList D={D} docs={R.docs} ready={R.ready} cfg={cfg} kind="fx" notes={notes} keyd={key} onPick={(r) => { setRec({ date: r.date, uid: r.uid, qty: r.qty, runs: r.on ? 1 : 0, name: r.name }); toTalk(); }} />
    <Head right={canEdit && !editMemo && <TBtn onClick={() => { setMemo(t.memo || ""); setMemoBase(t.memoAt || null); setClash(null); setEditMemo(true); }}>{t.memo ? "메모 고치기" : "메모 쓰기"}</TBtn>}>하는 법 · 메모</Head>
    {editMemo ? <div><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} aria-label="하는 법 · 메모" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setEditMemo(false)} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={saveMemo} style={{ flex: 1, height: 44 }}>메모 저장</Big></div>
      {clash && <Clash who={clash.memoByName} at={clash.memoAt} text={clash.memo} onMerge={() => { setMemo(`${clash.memo || ""}\n\n${memo}`.trim()); setMemoBase(clash.memoAt || null); setClash(null); }} onMine={() => saveMemo(true)} />}</div>
    : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65, wordBreak: "break-word" }}>{t.memo ? <Linked text={t.memo} /> : "적어 둔 하는 법이 없어요"}</div>{t.memoAt && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>{t.memoByName || nameOf(D.users, t.memoBy)} · {ago(t.memoAt)} 고침</div>}</Card>}
    <Head right={canEdit && <UpBtn U={U} />}>자료 {files.length}</Head>
    <UpList U={U} style={{ marginBottom: 8 }} />
    <FileList files={files} />
    <div id="v2-fx-talk" style={{ scrollMarginTop: 8 }}><Head>대화</Head></div>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id }} link={{ kind: "t", id: t.id }} hl={note} rec={rec ? { date: rec.date, uid: rec.uid, qty: rec.qty, runs: rec.runs } : null} onRec={setRec} cfg={cfg} />
    {oldNotes.length > 0 && <Card style={{ marginTop: 10 }}>
      <More onClick={() => setOldOpen(!oldOpen)}>{oldOpen ? "예전 내 메모 접기 ▴" : `예전 내 메모 ${oldNotes.length} ▾`} <span style={{ color: C.mute, fontWeight: 700 }}>읽기만</span></More>
      {oldOpen && oldNotes.map((n, i) => <div key={n.id} style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 12, color: C.mute }}>{n.byName || nameOf(D.users, n.by)} · {n.at ? md(ymd(new Date(n.at))) : ""}</div>
        <div style={{ fontSize: 14, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2, wordBreak: "break-word" }}><Linked text={n.text} /></div>
        <NoteFiles files={n.files} /></div>)}
    </Card>}
  </Sheet>;
}

// 고정업무·반복 실행 설정 [더 하기 ▾] — 드문 동작: 체크리스트 고치기 · 보이는 이름·내 시간 · 브랜드·개인 바꾸기 · 반복·시간 · 담당(관리자)
function FxMore({ t, D, cu, A, focus, mine, canRecur, canCommon, canScope, master, setToast }) {
  const [more, setMore] = useState(false), [mode, setMode] = useState(focus === "owners" && master ? "owners" : "");   // 관리자 '담당 없는 고정업무'에서 열면 담당 고르기 바로
  const go = (m) => { setMore(false); setMode(m); }, done = () => setMode("");
  const any = mine || canCommon || canScope || canRecur || master;
  if (!any) return null;
  return <div style={{ marginTop: 10 }}>
    <TBtn onClick={() => { setMore(!more); setMode(""); }} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn>
    {more && <div className="v2-more" role="group" aria-label="더 하기">
      {(mine || canCommon) && <TBtn v="soft" onClick={() => go("subs")}>체크리스트 고치기</TBtn>}
      {mine && <TBtn v="soft" onClick={() => go("label")}>보이는 이름 · 내 시간</TBtn>}
      {canScope && <TBtn v="soft" onClick={() => go("scope")}>브랜드·개인 바꾸기</TBtn>}
      {canRecur && <TBtn v="soft" onClick={() => go("recur")}>반복 · 시간</TBtn>}
      {canCommon && <TBtn v="soft" onClick={() => go("qty")}>건수 칸</TBtn>}
      {master && <TBtn v="soft" onClick={() => go("owners")}>담당 바꾸기</TBtn>}
    </div>}
    {mode === "qty" && <QtyCfgEdit cfg={qtyCfg(t)} onSave={(q) => { A.setQtyCfg(t, q); done(); }} onDone={done} />}
    {mode === "subs" && <SubsEdit t={t} cu={cu} A={A} canMine={mine} canCommon={canCommon} onDone={done} />}
    {mode === "label" && <LabelEdit t={t} cu={cu} A={A} onDone={done} />}
    {mode === "scope" && <ScopeEdit t={t} D={D} A={A} onDone={done} />}
    {mode === "recur" && <RecurEdit t={t} A={A} onDone={done} />}
    {mode === "owners" && <FxOwners t={t} D={D} A={A} setToast={setToast} onDone={done} />}
  </div>;
}
// 체크리스트 고치기: [공통 | 내 것] · 칩 ✕ 로 빼기 · 입력 + [추가](Enter 도) · 저장(공통은 transaction 으로 통째 · 내 것은 내 칸만) · 같은 항목은 id 그대로(체크 기록 이어짐)
function SubsEdit({ t, cu, A, canMine, canCommon, onDone }) {
  const [who, setWho] = useState(canCommon ? "*" : cu.id);
  const init = (w) => (((t.subsBy || {})[w]) || []).filter((x) => x && x.title).map((x) => ({ id: x.id, title: x.title }));
  const [list, setList] = useState(() => init(canCommon ? "*" : cu.id)), [v, setV] = useState("");
  const pick = (w) => { setWho(w); setList(init(w)); setV(""); };
  const add = () => { const x = v.trim(); if (!x) return; setList([...list, { id: newId("s"), title: x }]); setV(""); };
  const save = async () => { const extra = v.trim() ? [{ id: newId("s"), title: v.trim() }] : []; const ok = await A.setSubs(t, who, [...list, ...extra]); if (ok) onDone(); };
  const common = init("*");
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    {canCommon && canMine && <Seg items={[["*", "공통"], [cu.id, "내 것"]]} value={who} onChange={pick} />}
    <div style={{ fontSize: 12.5, color: C.sub }}>{who === "*" ? "담당 모두에게 보이는 목록이에요" : `나만 보는 목록이에요 · 비우면 공통 목록${common.length ? `(${common.map((x) => x.title).join(" · ")})` : ""}을 써요`}</div>
    {list.length > 0 ? <div className="v2-chips">{list.map((x, i) => <Chip key={x.id || i} on onClick={() => setList(list.filter((_, j) => j !== i))}>{x.title} ✕</Chip>)}</div> : <div style={{ fontSize: 13, color: C.mute }}>항목이 없어요</div>}
    <div style={{ display: "flex", gap: 8 }}><input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="새 항목" aria-label="체크리스트 항목" style={{ ...inp, flex: 1, minWidth: 0, padding: "9px 12px" }} /><TBtn onClick={add} disabled={!v.trim()}>추가</TBtn></div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" onClick={save}>저장 · {list.length + (v.trim() ? 1 : 0)}개</TBtn></div>
  </Card>;
}
// 건수 칸 (그날 몇 건 했는지 남기는 칸) — 이름 · 단위 · 끄기 (고정업무 t.qty · 반복 실행 덧칠 qty 가 같이 씀)
export function QtyCfgEdit({ cfg, onSave, onDone, note }) {
  const [label, setLabel] = useState((cfg && cfg.label) || ""), [unit, setUnit] = useState((cfg && cfg.unit) || "건");
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 12.5, color: C.sub }}>{note || "켜면 체크한 뒤 '오늘 몇 건이에요?'를 한 줄로 물어요 · 날짜별로 쌓여요"}</div>
    <label style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>무엇을 세나요<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 처리한 문의 · 전화" aria-label="건수 칸 이름" style={{ ...inp, marginTop: 6, padding: "9px 12px" }} /></label>
    <div className="v2-chips" role="group" aria-label="단위">{QTY_UNITS.map((u) => <Chip key={u} on={unit === u} onClick={() => setUnit(u)}>{u}</Chip>)}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>{cfg && <TBtn tone="mute" onClick={() => onSave(null)}>건수 칸 끄기</TBtn>}<span style={{ flex: 1 }} /><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" onClick={() => onSave({ label: label.trim() || "건수", unit })}>{cfg ? "저장" : "켜기"}</TBtn></div>
  </Card>;
}
// 보이는 이름 · 내 시간 (나만 · labelBy.<나> · timeBy.<나>) — 비우면 공통 이름·시간
function LabelEdit({ t, cu, A, onDone }) {
  const [l, setL] = useState(((t.labelBy || {})[cu.id]) || ""), [tm, setTm] = useState(((t.timeBy || {})[cu.id]) || "");
  const save = () => { if (l.trim() !== (((t.labelBy || {})[cu.id]) || "")) A.setMine(t, "labelBy", l); if (tm !== (((t.timeBy || {})[cu.id]) || "")) A.setMine(t, "timeBy", tm); onDone(); };
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <label style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>보이는 이름 <span style={{ color: C.mute, fontWeight: 700 }}>(나만)</span><input value={l} onChange={(e) => setL(e.target.value)} placeholder={t.title} aria-label="보이는 이름" style={{ ...inp, marginTop: 6, padding: "9px 12px" }} /></label>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: C.ink, flexWrap: "wrap" }}>내 시간 <input type="time" aria-label="내 시간" className="v2-sel" value={tm} onChange={(e) => setTm(e.target.value)} />{tm && <TBtn onClick={() => setTm("")}>지우기</TBtn>}<span style={{ fontSize: 12, color: C.mute, fontWeight: 700 }}>비우면 {t.fixedTime || "시간 상관없음"}</span></label>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" onClick={save}>저장</TBtn></div>
  </Card>;
}
// 브랜드·개인 바꾸기 — 1탭 · 5초 되돌리기 (반복 실행 = 브랜드 · 공통 운영 / 고정업무 = 개인)
function ScopeEdit({ t, D, A, onDone }) {
  const sc = scopeOf(t), cur = sc === "me" ? "me" : sc === "brand" ? brandKey(t.brand, D.brands) : "";
  const pick = async (k) => { if (k === cur) return; const ok = await A.setScopes([{ t, pick: k }]); if (ok) onDone(); };
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 12.5, color: C.sub }}>반복 실행이면 브랜드를, 나만 챙기는 일이면 [개인]을 골라요</div>
    <div className="v2-chips" role="group" aria-label="브랜드·개인">{[...brandsWithCommon(D.brands).map((b) => [b.id, b.name]), ["me", "개인"]].map(([k, l]) => <Chip key={k} on={k === cur} onClick={() => pick(k)}>{k === cur ? "✓ " : ""}{l}</Chip>)}</div>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn></div>
  </Card>;
}
// 고정업무 담당 바꾸기 (마스터) — 여러 명 고르기 또는 '전체' · 사람마다 정한 시간·이름·체크 기록은 지우지 않음 · 5초 되돌리기
function FxOwners({ t, D, A, setToast, onDone }) {
  const users = activeUsers(D.users), [on, setOn0] = useState(false), [sel, setSel] = useState([]), [all, setAll] = useState(false);
  const setOn = (v) => { setOn0(v); if (!v && onDone) onDone(); };
  useEffect(() => { if (onDone) { setSel(fxIds(t).filter((id) => users.some((u) => u.id === id))); setAll(!!t.forAll); setOn0(true); } }, []);
  if (!on) return <div style={{ marginTop: 4 }}><TBtn onClick={() => { setSel(fxIds(t).filter((id) => users.some((u) => u.id === id))); setAll(!!t.forAll); setOn(true); }}>담당 바꾸기 ›</TBtn></div>;
  const names = all ? "전체" : sel.map((id) => nameOf(D.users, id)).filter(Boolean).join("·");
  const save = () => { const prev = { assigneeIds: t.assigneeIds || [], assigneeId: t.assigneeId || "", forAll: !!t.forAll };
    const f = all ? { forAll: true } : { assigneeIds: sel, assigneeId: sel[0] || "", forAll: false };
    A.patchTask(t, f, "assign", `${t.title} · 고정업무 담당 ${names || "없음"}`, { prev });
    if (setToast) setToast({ text: `담당을 ${names}${names.includes(",") || names.includes("·") ? "(으)로" : roP(names)} 바꿨어요`, undo: () => A.undoTask(t, f, prev, `${t.title} · 고정업무 담당`, "assign") }); setOn(false); };
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>담당 (여러 명 가능)</div>
    <div className="v2-chips"><Chip on={all} onClick={() => setAll(!all)}>{all ? "✓ " : ""}전체</Chip>{!all && users.map((u) => { const k = sel.includes(u.id); return <Chip key={u.id} on={k} onClick={() => setSel(k ? sel.filter((x) => x !== u.id) : [...sel, u.id])}>{k ? "✓ " : ""}{u.name}</Chip>; })}</div>
    <div style={{ fontSize: 12.5, color: C.sub }}>빠지는 사람의 시간·이름·체크 기록은 지우지 않아요</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={() => setOn(false)}>그만</TBtn><TBtn onClick={save} disabled={!all && !sel.length}>저장 · {all ? "전체" : `${sel.length}명`}</TBtn></div>
  </Card>;
}
// 고정업무 반복·시간 바꾸기 (담당·마스터) — 매일 / 매주(요일 여러 개) / 매월(1~31일 · 말일(평일)). 바뀐 칸만 저장 + 기록에 이전 값
function RecurEdit({ t, A, onDone }) {
  const [on, setOn0] = useState(!!onDone);
  const setOn = (v) => { setOn0(v); if (!v && onDone) onDone(); };
  const init = () => ({ rt: t.recurType || "daily", wd: fxWeekDays(t), mday: t.monthEnd ? "end" : String(t.monthDay || 1), time: t.fixedTime || "" });
  const [f, setF] = useState(init);
  const key = ymd(new Date());
  const fields = () => ({ recurType: f.rt, ...(f.rt === "weekly" ? { weekDays: f.wd, weekDay: f.wd[0] || "월" } : {}),
    ...(f.rt === "monthly" ? (f.mday === "end" ? { monthEnd: true, monthDay: 31 } : { monthEnd: false, monthDay: Number(f.mday) }) : {}), fixedTime: f.time });
  const lab = (x) => fxRecurL({ ...t, ...x });
  const ok = f.rt !== "weekly" || f.wd.length > 0;
  const save = () => { if (!ok) return; const x = fields(), prev = Object.fromEntries(Object.keys(x).map((k) => [k, t[k] === undefined ? null : t[k]]));
    A.patchTask(t, x, "edit", `${t.title} · 반복 ${lab(x)}${x.fixedTime ? " " + x.fixedTime : ""}`, { prev }); setOn(false); };
  const nextEnd = (() => { let k = key; for (let i = 0; i < 3; i++) { const e = monthEndWorkday(k); if (e >= key) return e; const d = new Date(k.slice(0, 7) + "-01T00:00:00"); d.setMonth(d.getMonth() + 1); k = ymd(d); } return ""; })();
  if (!on) return <div style={{ marginTop: 8 }}><TBtn onClick={() => { setF(init()); setOn(true); }}>반복 · 시간 바꾸기 ›</TBtn></div>;
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <Seg items={[["daily", "매일"], ["weekly", "매주"], ["monthly", "매월"]]} value={f.rt} onChange={(rt) => setF({ ...f, rt })} />
    {f.rt === "weekly" && <div className="v2-chips">{FX_WD.map((d) => <Chip key={d} on={f.wd.includes(d)} onClick={() => setF({ ...f, wd: f.wd.includes(d) ? f.wd.filter((x) => x !== d) : FX_WD.filter((x) => x === d || f.wd.includes(x)) })}>{d}</Chip>)}</div>}
    {f.rt === "monthly" && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select aria-label="매월 날짜" className="v2-sel" value={f.mday} onChange={(e) => setF({ ...f, mday: e.target.value })}>
        <option value="end">말일 (평일 기준)</option>{[...Array(31)].map((_, i) => <option key={i} value={String(i + 1)}>{i + 1}일</option>)}</select>
      {f.mday === "end" && <span style={{ fontSize: 12.5, color: C.sub }}>그 달 마지막 평일 · 주말·공휴일이면 앞 평일{nextEnd ? ` (다음 ${md(nextEnd)})` : ""}</span>}</div>}
    <div style={{ fontSize: 12.5, color: C.mute }}>정한 날이 주말·공휴일이면 앞 평일에 떠요 · 매일은 평일만 · 못 하고 지나가면 그 주(달) 안에서 '밀림'으로 계속 보여요</div>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.sub, flexWrap: "wrap" }}>기본 시간 <input type="time" aria-label="시간" className="v2-sel" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />{f.time && <TBtn onClick={() => setF({ ...f, time: "" })}>시간 지우기</TBtn>}</label>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={() => setOn(false)}>그만</TBtn><TBtn onClick={save} disabled={!ok}>저장 · {lab(fields())}</TBtn></div>
  </Card>;
}

// ───────────────── 프로젝트 ─────────────────
