// 업무OS v2 — 오늘 · 할 일 추가 · 지난 일 정리 · 내 할 일 모두 · 이제 내 차례 · 내 정리
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, WD, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit, fxSubCount,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, canSetDue, riskOf, assignedByMe, workloadOf, onTimeOf, weekStart, nextWorkday, isOffDay, weekMine, brandLabel, brandKey, COMMON_BRAND,
  roadOf, roadStates, phaseOfTask, curStage, isLaunchProj, projLabel, projLabelOf, readInbox, unseePatch, phaseNowOf,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, phaseOf } from "./launch.js";
import { predLine, lastWord, predsOf, upcomingTurns, upLine, turnIndex, turnsOf } from "./turn.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";
import { HoldBtn } from "./hold.jsx";
import { openTask, moveDue } from "./task.jsx";
import { PickList, BulkBar, dueChips, ro } from "./pick.jsx";
import { previewLaunchMove } from "./views.js";
import { useAkActs, AkRow } from "./routineui.jsx";
import { myRoutine, brId, brandName } from "./routine.js";
import { QtyAsk, QtyDone } from "./recui.jsx";
import { LS as LSK } from "./core.jsx";
import { myNotesOf } from "./more.jsx";
import { qtyCfg, qtySum, qtyText } from "./rec.js";
import { LINK_APP } from "./links.js";

const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
// 빠른 기한 버튼은 모두 pick.jsx dueChips (쉬는 날 빼고 · 버튼에 날짜까지)
const markSeen = (setSeen, id) => setSeen((s) => ({ ...s, [id]: true, ...Object.fromEntries(String(id).split("|").map((k) => [k, true])) }));   // 묶은 줄(id1|id2)은 하나씩도 읽음
// [읽음 표시] 한꺼번에 — 알림 + 5초 되돌리기 · 읽은 줄은 더보기 › '읽은 알림'에서 다시 봄 (2026-10-13 사용자 "OS에서 읽음한거 다시보고싶어")
const markAllSeen = (setSeen, setToast, rows) => { const ids = rows.map((x) => x.id); if (!ids.length) return;
  setSeen((s) => ({ ...s, ...Object.fromEntries(ids.flatMap((id) => [id, ...String(id).split("|")]).map((k) => [k, true])) }));
  if (setToast) setToast({ text: `읽음 표시 ${ids.length}개 · 더보기 › 읽은 알림에서 다시 봐요`, undo: () => setSeen((s) => unseePatch(s, ids)) }); };
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
    if (x.kind === "link") { if (x.url) window.open(x.url, "_blank", "noopener"); return; }   // CRM·마진에서 온 줄 → 그 앱의 그 화면
    if (x.kind === "lagDue") return open({ type: "lagInput", ym: x.ym });   // 월말 결과 KPI 넣기 (kpiui.jsx)
    if (x.kind === "turnLate") return open({ type: "task", id: x.taskId, focus: "talk" });
    if (x.kind === "aiGroup") return open({ type: "aiMate", id: x.mate });   // AI 승인 (2026-10-12): 같은 AI 여러 건 → 그 AI 한 장
    if (x.kind === "aiSetup" || x.kind === "aiMiss") return open({ type: "aiSetup" });   // 내 PC Aside 세팅 · 오늘 안 돎 (2026-10-15)
    if (x.kind === "aiOwnerless") return open({ type: "aiTeam" });   // AI 크루 담당 미정 → AI 팀원(관리자 [담당 한꺼번에 정하기])
    if (x.kind === "aiRep") return open({ type: "aiReport", crew: x.crew, start: x.start, id: `${x.crew}-${x.start}` });   // AI 크루 보고 (2026-10-15): 칸 쓰기 · 보내기 · 읽기
    if (x.kind === "appr") return open({ type: "appr", tab: "asg" });   // 구매 품의 요청 (2026-10-16): 품의 요청 n건 → 내가 맡은 것
    if (x.apprId) return open({ type: "apprOne", id: x.apprId });   // 새 품의 요청 · 품의 완료 → 그 요청 한 건
    if (x.aiId) return open({ type: "aiask", id: x.aiId, ...(x.kind === "note" || x.kind === "mention" ? { focus: "talk" } : {}) });   // AI 승인 한 장 (확인할 것 · 최종 승인 · 대화)
    if (x.akId) return open({ type: "routine", id: x.akId, focus: "talk" });   // 반복 실행 대화 (@ 나를 부름 · 내가 말한 대화의 답)
    if (x.kind === "mention") return x.taskId ? open({ type: "task", id: x.taskId, focus: "talk" }) : open({ type: "project", id: x.projectId, first: "news" });   // @ 나를 부른 댓글 → 바로 대화 칸
    if (x.kind === "note" && x.taskId) { const t = tOf(x.taskId); return open({ type: t && t.isFixed ? "fixed" : "task", id: x.taskId, focus: "talk" }); }   // 새 댓글(묶은 줄 '새 댓글 n' 포함) → 대화 칸
    if (x.taskId) { const t = tOf(x.taskId); t ? openTask(open, t) : open({ type: "task", id: x.taskId }); } else if (x.mine) open({ type: "mine" }); else if (x.personId) open({ type: "person", id: x.personId }); else if (x.projectId) open({ type: "project", id: x.projectId, first: x.kind === "launchNew" || x.kind === "bulk" || x.kind === "projHoldDue" ? "work" : "news" }); };
  const inboxAct = (x) => { const t = x.taskId && tOf(x.taskId);
    if (x.kind === "assigned" && t) return <Act onClick={() => A.ack(t)} style={BTN_ON}>받았어요</Act>;
    if (x.kind === "bulk") return <Act onClick={() => A.ackMany(x.bulkIds.map(tOf).filter(Boolean))} style={BTN_ON}>받았어요</Act>;
    if (x.kind === "review" && t) return <Act onClick={() => A.approve(t)} style={BTN_ON}>확인</Act>;
    if (x.kind === "dueReq" && t) return <Act onClick={() => A.answerDue(t, true)} style={BTN_ON}>수락</Act>;
    if (x.kind === "holdDue" && t) return <Act onClick={() => A.unhold(t)} style={BTN_ON}>다시 시작</Act>;
    if (x.kind === "help" && t) return <Act onClick={() => open({ type: "task", id: t.id, focus: "talk" })} style={BTN_ON}>답하기</Act>;
    if (x.kind === "link") return <Act onClick={() => openInbox(x)}>{LINK_APP[x.src] || "열기"} ›</Act>;
    if (x.kind === "lagDue") return <Act onClick={() => openInbox(x)} style={BTN_ON}>넣기</Act>;
    if (x.kind === "turnLate") return <Act onClick={() => openInbox(x)}>묻기</Act>;
    if (x.kind === "mention") return <Act onClick={() => openInbox(x)} style={BTN_ON}>답하기</Act>;
    if (x.kind === "turnOrder") return <Act onClick={() => openInbox(x)}>조정 요청</Act>;
    if (x.kind === "nextNoOwner") return <Act onClick={() => openInbox(x)}>정하기</Act>;
    if (x.kind === "ai" || x.kind === "aiGroup") return <Act onClick={() => openInbox(x)} style={BTN_ON}>{x.tag === "수정 요청" ? "고치기" : "승인하기"}</Act>;
    if (x.kind === "appr") return <Act onClick={() => openInbox(x)} style={BTN_ON}>처리하기</Act>;
    if (x.kind === "aiSetup") return <Act onClick={() => openInbox(x)} style={BTN_ON}>세팅</Act>;
    if (x.kind === "aiMiss") return <Act onClick={() => openInbox(x)} style={BTN_ON}>지금 돌리기</Act>;
    if (x.kind === "aiOwnerless") return <Act onClick={() => openInbox(x)}>정하기</Act>;
    if (x.kind === "aiRep") return <Act onClick={() => openInbox(x)} style={BTN_ON}>{x.btn || "보기"}</Act>;
    return <Act onClick={() => openInbox(x)}>보기</Act>; };
  return { openInbox, inboxAct };
}
// 관리자 '나에게 온 것' — 팀원 '확인할 것'과 같은 계산 · 같은 줄 · 같은 버튼
export function InboxSheet({ D, A, open, TV, setSeen, setToast, onBack, onClose }) {
  const { openInbox, inboxAct } = inboxFns(D, A, open, setSeen), now = new Date(), readable = TV.inbox.filter((x) => !x.keep);
  return <Sheet title={`나에게 온 것 ${TV.inbox.length}`} onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, margin: "12px 2px 8px", lineHeight: 1.6 }}>확인 요청 · 도움 요청 · 기한 조정 · 막힘 · 맡김 · 담당 바뀜 · 내가 말한 대화의 답이 여기 모여요. 처리할 때까지 남는 것과 읽으면 사라지는 것이 있어요.</div>
    {TV.inbox.length === 0 ? <Card><Empty>새로 온 요청·알림이 없어요</Empty></Card>
      : <Card>{TV.inbox.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || TV.userName(x.who) || ""}${x.at ? (x.whoName || TV.userName(x.who) ? " · " : "") + ago(x.at, now) : ""}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={inboxAct(x)} last={i === TV.inbox.length - 1} />)}</Card>}
    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
      {readable.length > 0 && <TBtn tone="mute" onClick={() => markAllSeen(setSeen, setToast, readable)}>읽음 표시 {readable.length}</TBtn>}
      <TBtn tone="mute" onClick={() => open({ type: "readInbox" })}>읽은 알림 ›</TBtn></div>
  </Sheet>;
}
// 읽은 알림 (사용자 요청 2026-10-13 "OS에서 읽음한거 다시보고싶어") — '확인할 것'에서 읽음 표시한 줄 · 최근 7일 · 폰·PC 같이 (core.useSeen · 서버 seen/{나})
//   계산 = model.readInbox (읽음을 빼고 다시 센 todayView 줄 중 읽은 것 · 처리해야 사라지는 줄은 늘 '확인할 것'에 있어서 뺌) · 최근 것 먼저
//   줄 누르면 '확인할 것'과 같은 길(그 업무·대화·프로젝트…) · [안 읽음으로] = 읽음 표시만 빼서 다시 '확인할 것'에 (내 읽음 문서의 그 키만 지움 · 다른 기기에도 바로)
export function ReadInboxSheet({ D, A, cu, open, idx, meta, seen, setSeen, onBack, onClose }) {
  const now = new Date();
  const list = useMemo(() => { const T0 = turnsOf(D, idx || turnIndex(D), cu.id, now, {}, (meta || {}).seededAt || ""); return readInbox(D, cu.id, now, seen || {}, T0); }, [D, idx, cu.id, seen]);
  const { openInbox } = inboxFns(D, A, open, setSeen);
  return <Sheet title={`읽은 알림 ${list.length}`} onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, margin: "12px 2px 8px", lineHeight: 1.6 }}>'확인할 것'에서 눌러 보거나 [읽음 표시]한 것이에요 · 최근 7일 · 폰·PC 어디서 읽어도 같이 사라지고 여기에 모여요 · [안 읽음으로]를 누르면 다시 '확인할 것'에 떠요</div>
    {list.length === 0 ? <Card><Empty>최근 7일에 읽음 표시한 알림이 없어요</Empty></Card>
      : <Card>{list.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || nameOf(D.users, x.who) || ""}${x.at ? (x.whoName || nameOf(D.users, x.who) ? " · " : "") + ago(x.at, now) : ""}${x.text ? " · " + x.text : ""}`}
          onClick={() => openInbox(x)} right={<Act onClick={() => setSeen((s) => unseePatch(s, [x.id]))}>안 읽음으로</Act>} last={i === list.length - 1} />)}</Card>}
  </Sheet>;
}
// 고정업무 줄 (오늘 · 1단계 2026-10-06): 제목 옆 체크리스트 a/b · 2줄 = 시간 · (매주·매월) · n/m명 체크 · 아래 칩(누르면 그 항목만 체크)
const FxTitle = ({ t, uid, keyd }) => { const [a, b] = fxSubCount(t, uid, keyd);
  return <>{fxLabel(t, uid)}{b > 0 && <span className="v2-fxn"> {a}/{b}</span>}</>; };
//   rhythm = 반복 실행 카드(2026-10-16 횟수 목표와 한 목록): 얼마나 자주 먼저 '매일 10:00' · '매주 월 11:00' · '매월 15일' (횟수 줄 '이번 주 1 / 4건'과 같은 자리)
const fxWhen = (t, uid) => [fxRecurL(t), fxTime(t, uid)].filter(Boolean).join(" ");
const fxLine = (D, t, uid, key, rhythm) => { const [a, b] = fxCount(D.users, t, key), cfg = qtyCfg(t), all = cfg ? qtySum((D.recs || {}).today, t.id) : 0, me = cfg ? qtySum((D.recs || {}).today, t.id, uid) : 0;
  return [rhythm ? fxWhen(t, uid) : fxTime(t, uid) || "시간 상관없음", !rhythm && t.recurType && t.recurType !== "daily" ? fxRecurL(t) : "", b > 1 ? `${a}/${b}명 체크` : "", all > me ? `모두 ${qtyText(cfg, all)}` : ""].filter(Boolean).join(" · "); };
// 건수 칸(qty)을 켠 줄: [완료]·마지막 칩 뒤 '오늘 처리한 문의 몇 건이에요? [ ]건 [남기기] [건너뛰기]' → 남기면 '오늘 문의 23건 · 고치기'
//   ask = 지금 묻는 줄 (id · 'fix:'+id = 고치기 · 'saved:'+id = 방금 남김) — 묻는 동안·방금 남긴 줄은 끝낸 줄이어도 그 자리에 남김(todayRows)
function FxQty({ t, D, cu, A, ask, setAsk, keyd }) {
  const cfg = qtyCfg(t); if (!cfg) return null;
  const mine = qtySum((D.recs || {}).today, t.id, cu.id);
  if (ask === t.id) return <QtyAsk cfg={cfg} onSave={async (n) => { setAsk("saved:" + t.id); await A.fxQty(t, n, "add", keyd); }} onSkip={() => setAsk(null)} />;
  if (ask === "fix:" + t.id) return <QtyAsk cfg={cfg} mode="set" init={mine} onSave={async (n) => { setAsk("saved:" + t.id); await A.fxQty(t, n, "set", keyd); }} onSkip={() => setAsk(null)} skipL="그만" />;
  return mine > 0 ? <QtyDone cfg={cfg} n={mine} onFix={() => setAsk("fix:" + t.id)} /> : null;
}
const fxDone = (A, t, setAsk) => { const on = A.fxToggle(t); if (on && qtyCfg(t)) setAsk(t.id); };
// 묻는 중인 끝낸 줄은 남은 줄 목록 그 자리(시간 순)에 그대로
const todayRows = (G, ask) => { const id = String(ask || "").replace(/^(fix|saved):/, ""), hit = id && !G.left.some((x) => x.t.id === id) ? G.done.find((x) => x.t.id === id) : null;
  if (!hit) return G.left; const a = [...G.left]; const i = a.findIndex((x) => !x.miss && (x.min ?? 9999) > (hit.min ?? 9999)); a.splice(i < 0 ? a.length : i, 0, { ...hit, asking: true }); return a; };
const FX_OPEN_MAX = 8;   // 남은 고정업무·오늘 체크 줄 8개 넘으면 8 + 'n개 더 ▾' (묻는 줄은 그 뒤여도 보임)
const openShown = (rows, more) => (more ? rows : rows.slice(0, Math.max(FX_OPEN_MAX, rows.findIndex((x) => x.asking) + 1)));
const FX_CHIP_MAX = 7;   // 7개 이상이면 6개 + '외 n개'
export function FxChips({ t, uid, keyd, A, open, onDone }) {
  const subs = fxSubs(t, uid); if (!subs.length) return null;
  const m = ((t.subDone || {})[uid]) || {}, many = subs.length >= FX_CHIP_MAX, shown = many ? subs.slice(0, 6) : subs;
  const stop = (e) => e.stopPropagation(), stopKey = (e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); };   // 줄(Row)의 Enter·Space 열기로만 안 번지게 (Esc 등은 시트 닫기에 그대로)
  return <div className="v2-fxchips" role="group" aria-label={`${fxLabel(t, uid)} 체크리스트`} onClick={stop} onKeyDown={stopKey}>
    {shown.map((x) => { const ok = fxHit(t, m[x.id], keyd);
      return <button key={x.id} type="button" className={ok ? "on" : ""} aria-pressed={ok} aria-label={`${x.title} 체크`} onClick={(e) => { e.stopPropagation(); const f = A.fxSub(t, x.id); if (f === true && onDone) onDone(); }}>{ok ? "✓ " : ""}{x.title}</button>; })}
    {many && <button type="button" className="more" onClick={(e) => { e.stopPropagation(); open({ type: "fixed", id: t.id }); }}>외 {subs.length - 6}개 ›</button>}
  </div>;
}
// 반복 실행 카드 — 정한 날 체크(브랜드 정한 고정업무 · scope brand) + 횟수 목표(행동지표)를 한 목록으로 (2026-10-16 사장님 "반복실행에 오늘체크와 횟수 구분된게 혼란스럽고 어렵게 느껴져")
//   머리 '반복 실행 · n개 남음'(오늘 남은 체크 + 이번 기간 못 채운 횟수) · [접기 ▴] = 이 기기에 기억(pour-os2-rtfold · 접으면 '다음 · …' 한 줄)
//   줄 순서: 밀림 → 시간 순서(지난 것 '시간 지남' 빨강) → 시간 없는 체크 → 횟수(주 → 월 → 분기) · 8개 넘으면 'n개 더 ▾'
//   줄 모양 하나: 제목(체크리스트 a/b) · 2줄 = 얼마나 자주('매일 10:00' · '매주 월 11:00' · '이번 주 1 / 4건') · 오른쪽 버튼 자리 하나(그날 한 번 = [완료] · 여러 번 = [+1])
//   끝낸 것(오늘 끝낸 체크 + 이번 기간 다 채운 횟수) = '끝낸 것 n ▾'(접힘 · 거기서도 [✓ 취소] · [+1]) · 방금 누른 줄(건수 묻는 중 · '셌어요 · 취소')은 그 자리에 남음
//   꼬리표: 밀림·시간 지남(빨강) 먼저 → 브랜드가 여럿일 때만 브랜드 짧은 이름 (체크·횟수 같은 규칙)
const brShort = (b, brands) => (b === COMMON_BRAND.id ? COMMON_BRAND.short : brandName(b, brands).replace(/^POUR/, ""));
export function RoutineCard({ D, cu, A, open, R, keyd }) {
  const [more, setMore] = useState(false), [doneOn, setDoneOn] = useState(false), [ask, setAsk] = useState(null), [fold, setFold] = useLocal(LSK("rtfold"), false);
  const X = useAkActs({ D, cu, A, keyd });
  const ak = D.ak || {}, akAll = ak.ready && (ak.items || []).length ? myRoutine(ak.items, D.users, cu.id, ak.docs, keyd) : [];
  const G = R || { left: [], done: [], total: 0 };
  if (!G.total && !akAll.length) return null;
  const hold = (r) => !!X.line && X.line.id === r.it.id && !X.line.pre;   // 방금 센 줄은 다 채워도 그 자리에 ('셌어요 · 취소'·건수 칸이 안 사라지게 · 끝낸 것에서 누른 줄은 끝낸 것에 그대로)
  const akLeft = akAll.filter((r) => !r.tot.done || hold(r)), akDone = akAll.filter((r) => r.tot.done && !hold(r));
  const rows = [...todayRows(G, ask).map((x) => ({ k: "f" + x.t.id, x })), ...akLeft.map((r) => ({ k: "a" + r.it.id, r }))];
  const leftN = G.left.length + akAll.filter((r) => !r.tot.done && !r.tot.none).length, doneN = G.done.length + akDone.length;   // 실패 기준인데 실패가 없으면(none) 할 것 없음 → 남음에서 뺌
  const bk = (v) => { const k = brandKey(v, D.brands); return !k || k === COMMON_BRAND.id || (D.brands || []).some((b) => b && b.id === k) ? k : brId(k); };
  const multi = new Set([...G.left, ...G.done].map((x) => bk(x.t.brand)).concat(akAll.map((r) => bk(r.it.brand))).filter(Boolean)).size > 1;
  const brTag = (v) => (multi && bk(v) ? brShort(bk(v), D.brands) : null);
  const stuck = rows.findIndex((y) => (y.x && y.x.asking) || (y.r && hold(y.r)));
  const shown = fold ? [] : more ? rows : rows.slice(0, Math.max(FX_OPEN_MAX, stuck + 1));   // 묻는 줄은 8개 뒤여도 보임
  const fxRow = (x) => { const t = x.t, dn = !!x.asking;
    return <Row key={"f" + t.id} dim={dn} tag={dn ? null : x.miss ? `밀림 ${md(x.miss)}` : x.late ? "시간 지남" : brTag(t.brand)} tagTone={x.late ? "red" : null} title={<FxTitle t={t} uid={cu.id} keyd={keyd} />} sub={fxLine(D, t, cu.id, keyd, true)}
      below={<><FxChips t={t} uid={cu.id} keyd={keyd} A={A} open={open} onDone={() => qtyCfg(t) && setAsk(t.id)} /><FxQty t={t} D={D} cu={cu} A={A} ask={ask} setAsk={setAsk} keyd={keyd} /></>} onClick={() => open({ type: "fixed", id: t.id })}
      right={dn ? <Act on onClick={() => { setAsk(null); A.fxToggle(t); }}>✓ 취소</Act> : <Act onClick={() => fxDone(A, t, setAsk)}>완료</Act>} last={false} />; };
  const first = rows[0], nextL = !first ? "" : first.x ? [fxTime(first.x.t, cu.id), fxLabel(first.x.t, cu.id)].filter(Boolean).join(" ") : `${first.r.it.name} · ${first.r.per} ${first.r.tot.n}/${first.r.tot.g}`;
  return <>
    <Head right={rows.length > 0 && <TBtn tone="mute" aria-expanded={!fold} onClick={() => setFold(!fold)}>{fold ? "펼치기 ▾" : "접기 ▴"}</TBtn>}>반복 실행 · {leftN ? `${leftN}개 남음` : "다 했어요 ✓"}</Head>
    <Card>
      {fold && rows.length > 0 ? <More onClick={() => setFold(false)}>다음 · {nextL} ▾</More> : <>
        {shown.map((y) => (y.x ? fxRow(y.x) : <AkRow key={y.k} r={y.r} X={X} cu={cu} open={open} tag={brTag(y.r.it.brand)} last={false} />))}
        {rows.length > shown.length && <More onClick={() => setMore(true)}>{`${rows.length - shown.length}개 더 ▾`}</More>}
        {more && rows.length > FX_OPEN_MAX && <More onClick={() => setMore(false)}>{`${FX_OPEN_MAX}개만 보기 ▴`}</More>}
        {doneN > 0 && <More onClick={() => setDoneOn(!doneOn)}>{doneOn ? "끝낸 것 접기 ▴" : `끝낸 것 ${doneN} ▾`}</More>}
        {doneOn && G.done.filter((x) => !rows.some((y) => y.x && y.x.t.id === x.t.id)).map((x) => <Row key={"f" + x.t.id} dim title={<FxTitle t={x.t} uid={cu.id} keyd={keyd} />} sub={`${fxWhen(x.t, cu.id)} · ✓ ${hm(x.t.doneAtBy && x.t.doneAtBy[cu.id])}${fxCount(D.users, x.t, keyd)[1] > 1 ? ` · ${fxCount(D.users, x.t, keyd).join("/")}명 체크` : ""}`}
          below={<><FxChips t={x.t} uid={cu.id} keyd={keyd} A={A} open={open} />{ask !== x.t.id && <FxQty t={x.t} D={D} cu={cu} A={A} ask={ask} setAsk={setAsk} keyd={keyd} />}</>} onClick={() => open({ type: "fixed", id: x.t.id })} right={<Act on onClick={() => A.fxToggle(x.t)}>✓ 취소</Act>} />)}
        {doneOn && akDone.map((r) => <AkRow key={"a" + r.it.id} r={r} X={X} cu={cu} open={open} dim last={false} />)}
      </>}
    </Card>
  </>;
}
// 순서: 지난 일 한 줄 → 확인할 것 → 오늘(남은 고정업무 펼침 · 끝낸 것 접힘 · 일회성: 수정 요청·내 차례·지난 일·진행 중·오늘 마감 5줄+) → 곧 내 차례 → 정리 한 줄
export function TodayTab({ D, cu, A, open, TV, T, seen, setSeen, setToast }) {
  const now = new Date(), key = TV.key;
  const up7 = useMemo(() => upcomingTurns(D, T, key, cu.id).filter((u) => u.start && u.start <= addDays(key, 6)), [D, T, key]);   // 곧 내 차례 = 7일 안에 오는 내 차례 (달력과 같은 기준)
  const [fxAsk, setFxAsk] = useState(null);   // 건수 칸 묻는 고정업무 줄
  const myToday = useMemo(() => myNotesOf(D, cu.id, key, "today").length, [D.notes, cu.id, key]);   // '오늘 내가 쓴 댓글 n ›' (있을 때만)
  const [range, setRange] = useLocal(LSK("todo-range"), "today");   // '할 일' 카드 [오늘 | 내일 | 이번 주]
  const [fxFold, setFxFold] = useLocal(LSK("fxfold"), false), fxOpen = !fxFold, [fxMore, setFxMore] = useState(false);   // 남은 고정업무는 처음부터 펼침 · 접으면 이 기기에 기억
  const [showFxDone, setShowFxDone] = useState(false), [allInbox, setAllInbox] = useState(false), [soonOpen, setSoonOpen] = useState(false);
  const pName = (pid) => projLabelOf(D, pid);
  const [listAll, setListAll] = useState(false);
  const qa = useRef(null);   // 할 일 바로 추가 칸에 쓰던 것 → [+ 맡기기] 시트로 (2026-10-13)
  const inbox = allInbox ? TV.inbox : TV.inbox.slice(0, 3);
  const readable = TV.inbox.filter((x) => !x.keep);
  const tOf = (id) => D.tasks.find((y) => y.id === id);
  const { openInbox, inboxAct } = inboxFns(D, A, open, setSeen);
  // 오늘 챙길 일회성 (2026-10-06 위 '지금 할 일' 카드 없앰 → 카드가 보이던 일은 모두 이 목록에): 수정 요청 · 이제 내 차례 · 지난 일 · 진행 중 · 오늘·내일 마감
  //   순서 = TV.ranked(model.focusRank) 그대로 · 5줄 + 'n개 더 ▾'
  //   2026-10-07 카드 이름 '할 일' + [오늘 | 내일 | 이번 주](기기 기억 pour-os2-todo-range · 화면 거르기만)
  //   오늘 = 수정 요청 · 이제 내 차례 · 지난 일 · 진행 중 · 오늘 마감 / 내일 = 내일 마감 / 이번 주 = 이번 일요일까지 마감(오늘·지난 일 포함) · 고정업무는 '오늘'에만
  const sun = addDays(weekStart(key), 6);
  const RANGE_HIT = {
    today: (x) => x.t.feedback || x.fresh || (x.n != null && x.n <= 0) || x.t.status === "inprogress",
    tomorrow: (x) => x.n === 1,
    week: (x) => { const d = dueOf(x.t); return !!d && d <= sun; },
  };
  const rk = RANGE_HIT[range] ? range : "today";
  const rangeN = Object.fromEntries(Object.entries(RANGE_HIT).map(([k, f]) => [k, TV.ranked.filter(f).length]));
  const list = TV.ranked.filter(RANGE_HIT[rk]);
  const showFx = rk === "today";
  const LIST_MAX = 5, listShown = listAll ? list : list.slice(0, LIST_MAX);
  const fxLeft = TV.fixed.left, fxRows = todayRows(TV.fixed, fxAsk), nextFx = fxLeft.find((x) => !x.late && x.min < 9999) || fxLeft[0];
  const ym = key.slice(0, 7);
  const noDate = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, cu.id) && !dueOf(t) && t.status !== "hold" && t.status !== "review" && t.tidySkip !== ym && !T.temp.has(t.id)).length;
  const tempMine = D.tasks.filter((t) => T.temp.has(t.id) && isMine(t, cu.id)).length;
  const lateN = TV.late.length;   // '하나씩 정리하기'가 카드 일까지 모두 보여 주므로 같은 수
  const wk = useMemo(() => weekMine(D, cu.id, key), [D, cu.id, key]);   // 이번 주(월~일) 내 완료율 — 나만 봄
  // 칸 나눔(화면만): 반복 실행 카드가 보일지 = RoutineCard 와 같은 조건 · 빈 칸은 안 그림
  const hasRt = !!(TV.routine && TV.routine.total > 0) || !!(D.ak && D.ak.ready && (D.ak.items || []).length && myRoutine(D.ak.items, D.users, cu.id, D.ak.docs, key).length);
  const hasC1 = TV.inbox.length > 0 || up7.length > 0;
  return <>
    <header style={{ padding: "14px 2px 2px" }}>
      <div style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>{dayTitle(now)} · {cu.name}</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 800, color: C.ink }}>남은 일 {TV.left} · 끝낸 일 {TV.doneToday}</h1>
      {wk.total > 0 && <button type="button" className="v2-wkpct" onClick={() => open({ type: "mine" })} aria-label={`이번 주 완료율 ${wk.pct}% · 전체 ${wk.total} 완료 ${wk.done} 진행 ${wk.doing} 지남 ${wk.late} · 내 할 일 모두 보기`}>
        <div className="t">이번 주 완료율 <b>{wk.pct}%</b> · 전체 {wk.total} · 완료 {wk.done} · 진행 {wk.doing} · 지남 <b style={{ color: wk.late ? C.red : C.ink }}>{wk.late}</b></div>
        <div className="bar"><i style={{ width: wk.pct + "%" }} /></div></button>}
      <button type="button" className="v2-findbtn" onClick={() => open({ type: "search" })} aria-label="찾기 · 업무 · 프로젝트 · 댓글"><b>찾기</b><span>업무 · 프로젝트 · 댓글</span></button>
    </header>
    <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 6 }}>
      {lateN > 0 && <LineBtn onClick={() => open({ type: "triage" })}><span>지난 일 <b style={{ color: C.red }}>{lateN}개</b> · 하나씩 정리하기</span> ›</LineBtn>}
      {TV.doing >= 4 && <div style={{ fontSize: 12.5, color: C.sub, padding: "6px 4px" }}>진행 중 {TV.doing}개예요 · 하나씩 끝내면 더 빨라요</div>}
    </div>
    {/* PC 넓은 화면(2026-10-07): 칸 3개 [확인할 것·곧 내 차례 | 오늘·날짜 없는 일 | 반복 실행] · 900~1199 = 2칸 + 반복 실행 아래 · 900 아래 = 한 줄(예전 순서 그대로 · 칸 묶음은 display:contents) */}
    <div className={"v2-tgrid" + (hasC1 ? "" : " no1") + (hasRt ? "" : " no3")}>
      {hasC1 && <div className="v2-tcol c1">
        {TV.inbox.length > 0 && <div className="v2-ts in"><>
          <Head right={readable.length > 0 && <TBtn tone="mute" onClick={() => markAllSeen(setSeen, setToast, readable)}>읽음 표시</TBtn>}>확인할 것 {TV.inbox.length}</Head>
          <Card>
            {inbox.map((x, i) => <Row key={x.id} tag={x.tag} tagTone={x.red ? "red" : null} title={x.title} sub={`${x.whoName || TV.userName(x.who) || ""}${x.at ? (x.whoName || TV.userName(x.who) ? " · " : "") + ago(x.at, now) : ""}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={inboxAct(x)} last={i === inbox.length - 1 && TV.inbox.length <= 3} />)}
            {TV.inbox.length > 3 && <More onClick={() => setAllInbox(!allInbox)}>{allInbox ? "접기 ▴" : `${TV.inbox.length}개 모두 보기 ▾`}</More>}
          </Card></></div>}
        {up7.length > 0 && <div className="v2-ts soon">
          <Head right={<TBtn onClick={() => open({ type: "upturns" })}>모두 ›</TBtn>}>곧 내 차례 {up7.length}{up7.some((u) => u.level === "late" || u.level === "risk") ? <span style={{ color: C.red }}> · 늦을 수 있음 {up7.filter((u) => u.level === "late" || u.level === "risk").length}</span> : null}</Head>
          <Card>{up7.slice(0, soonOpen ? 8 : 3).map((u, i, arr) => <UpRow key={u.t.id} u={u} D={D} cu={cu} open={open} keyd={key} last={i === arr.length - 1 && up7.length <= (soonOpen ? 8 : 3)} />)}
            {up7.length > 3 && <More onClick={() => setSoonOpen(!soonOpen)}>{soonOpen ? "접기 ▴" : `${up7.length - 3}개 더 ▾`}</More>}</Card>
        </div>}
      </div>}
      <div className="v2-tcol c2">
        <div className="v2-ts tod">
        <div className="v2-todohead">
          <h3>할 일</h3>
          <TBtn className="add" onClick={() => { const q = qa.current || {}; open({ type: "add", preset: { ...(q.title ? { title: q.title } : {}), dueDate: q.due, ...(q.pid ? { projectId: q.pid } : {}), onSaved: () => q.clear && q.clear() } }); }} aria-label="할 일 맡기기 · 자세히 추가">+ 맡기기</TBtn>
          <div className="v2-trange" role="group" aria-label="할 일 날짜">{[["today", "오늘"], ["tomorrow", "내일"], ["week", "이번 주"]].map(([k, l]) => <Chip key={k} on={rk === k} onClick={() => { setRange(k); setListAll(false); }} style={{ padding: "6px 11px" }}>{l} {rangeN[k]}</Chip>)}</div>
          <TBtn className="all" onClick={() => open({ type: "mine" })}>내 할 일 모두 ›</TBtn>
        </div>
        <Card>
          <QuickAdd D={D} cu={cu} A={A} setToast={setToast} dflt={rk === "tomorrow" ? "tomorrow" : "today"} hold={qa} />
          {showFx && TV.fixed.total > 0 && (fxOpen
            ? <>{openShown(fxRows, fxMore).map((x) => { const t = x.t, dn = !!x.asking;
                return <Row key={t.id} dim={dn} tag={dn ? null : x.miss ? `밀림 ${md(x.miss)}` : x.late ? "시간 지남" : "고정"} tagTone={x.late ? "red" : null} title={<FxTitle t={t} uid={cu.id} keyd={key} />} sub={fxLine(D, t, cu.id, key)}
                  below={<><FxChips t={t} uid={cu.id} keyd={key} A={A} open={open} onDone={() => qtyCfg(t) && setFxAsk(t.id)} /><FxQty t={t} D={D} cu={cu} A={A} ask={fxAsk} setAsk={setFxAsk} keyd={key} /></>} onClick={() => open({ type: "fixed", id: t.id })}
                  right={dn ? <Act on onClick={() => { setFxAsk(null); A.fxToggle(t); }}>✓ 취소</Act> : <Act onClick={() => fxDone(A, t, setFxAsk)}>완료</Act>} last={false} />; })}
                {fxRows.length > openShown(fxRows, fxMore).length && <More onClick={() => setFxMore(true)}>{`고정업무 ${fxRows.length - openShown(fxRows, fxMore).length}개 더 ▾`}</More>}
                {fxMore && fxRows.length > FX_OPEN_MAX && <More onClick={() => setFxMore(false)}>{`${FX_OPEN_MAX}개만 보기 ▴`}</More>}
                {TV.fixed.done.length > 0 && <More onClick={() => setShowFxDone(!showFxDone)}>{showFxDone ? "끝낸 고정업무 접기 ▴" : `끝낸 고정업무 ${TV.fixed.done.length} ▾`}</More>}
                {showFxDone && TV.fixed.done.filter((x) => !fxRows.some((r) => r.t.id === x.t.id)).map((x) => <Row key={x.t.id} dim title={<FxTitle t={x.t} uid={cu.id} keyd={key} />} sub={`✓ ${hm(x.t.doneAtBy && x.t.doneAtBy[cu.id])}${fxCount(D.users, x.t, key)[1] > 1 ? ` · ${fxCount(D.users, x.t, key).join("/")}명 체크` : ""}`}
                  below={<><FxChips t={x.t} uid={cu.id} keyd={key} A={A} open={open} /><FxQty t={x.t} D={D} cu={cu} A={A} ask={fxAsk} setAsk={setFxAsk} keyd={key} /></>} onClick={() => open({ type: "fixed", id: x.t.id })} right={<Act on onClick={() => A.fxToggle(x.t)}>✓ 취소</Act>} />)}
                {fxRows.length > 0 && <More onClick={() => setFxFold(true)}>고정업무 접기 ▴</More>}</>
            : <More onClick={() => setFxFold(false)}>{fxLeft.length ? <>고정업무 <b>{fxLeft.length}개 남음</b>{nextFx ? ` · 다음 ${fxTime(nextFx.t, cu.id) || ""} ${fxLabel(nextFx.t, cu.id)}` : ""} ▾</> : <>고정업무 {TV.fixed.total}개 다 했어요 ✓ ▾</>}</More>)}
          {listShown.map((x, i) => <OneRow key={x.t.id} x={x} D={D} A={A} T={T} keyd={key} open={open} setSeen={setSeen} pName={pName} last={i === listShown.length - 1 && list.length <= LIST_MAX} />)}
          {list.length > LIST_MAX && <More onClick={() => setListAll(!listAll)}>{listAll ? "접기 ▴" : `${list.length - LIST_MAX}개 더 ▾`}</More>}
          {!list.length && !(showFx && TV.fixed.total) && <Empty>{rk === "tomorrow" ? "내일 마감인 일이 없어요" : rk === "week" ? "이번 주(일요일까지) 마감인 일이 없어요" : "오늘 마감이거나 하는 중인 일이 없어요"}</Empty>}
        </Card>
        {myToday > 0 && <div className="v2-mylink"><TBtn v="plain" onClick={() => open({ type: "myNotes" })} style={{ fontSize: 13 }}>오늘 내가 쓴 댓글 {myToday} ›</TBtn></div>}
        </div>
        {(noDate > 0 || tempMine > 0) && <div className="v2-ts nd"><Card style={{ marginTop: 14 }}><More onClick={() => open({ type: "myTidy", tab: noDate ? "nodate" : "temp" })}>
          {[noDate ? `날짜 없는 일 ${noDate}` : "", tempMine ? `담당 정할 항목 ${tempMine}` : ""].filter(Boolean).join(" · ")} ›</More></Card></div>}
      </div>
      {hasRt && <div className="v2-tcol c3"><div className="v2-ts rt">
        <RoutineCard D={D} cu={cu} A={A} open={open} R={TV.routine} keyd={key} />
      </div></div>}
    </div>
  </>;
}
function LineBtn({ children, onClick }) {
  return <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", padding: "9px 4px", border: "none", borderBottom: `1px solid ${C.line}`, background: "none", fontFamily: "inherit", fontSize: 13.5, color: C.text, cursor: "pointer", textAlign: "left" }}>{children}</button>;
}

// 오늘 목록 일회성 줄 (위 '지금 할 일' 카드 대신 · 2026-10-06 "상단 카드가 사용이 더 헷갈려" → 카드 없애고 목록에 표시)
//   이제 내 차례: 꼬리표 '내 차례' · '허지은님이 "최종 검수"를 끝냄 · 9시간 전' · 앞 일 마지막 말 1줄 · [시작](할 일) / [끝냄](진행 중) · 열거나 시작하면 차례 알림 읽음
//   나머지: 꼬리표 = 위험(지남·막힘·수정 요청·오늘 마감)·진행 중 · 수정 요청이면 그 말 1줄 · [끝냄]
const eulReul = (w) => { const c = String(w || "").slice(-1).charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? "을" : "를"; };
function OneRow({ x, D, A, T, keyd, open, setSeen, pName, last }) {
  const t = x.t, b = turnBits(t, T, D, keyd), info = x.fresh && T && T.byTask ? T.byTask.get(t.id) : null, pred = info && info.last, word = pred ? lastWord(pred, D.notes) : null;
  const seenTurn = () => { if (pred) markTurn(setSeen, t.id, info, D.notes); };
  const sub = pred ? `${nameOf(D.users, ownersOf(pred)[0]) || "앞사람"}님이 "${pred.title}"${eulReul(pred.title)} 끝냄${info.readyAt ? " · " + ago(info.readyAt) : ""}`
    : [pName(t.projectId), dueOf(t) ? ddayLabel(x.n) : "", startedL(t, keyd), b.sub].filter(Boolean).join(" · ") || null;
  const sub2 = word ? `${word.handoff ? `${word.byName || "앞사람"}님이 남긴 말` : "앞 일 마지막 말"} · ${word.text}` : t.feedback && t.feedback.text ? `수정 요청 · ${t.feedback.text}` : null;
  return <Row tag={x.fresh ? "내 차례" : b.tag} tagTone={x.fresh ? "turn" : b.tone} title={t.title} sub={sub} sub2={sub2} last={last}
    onClick={() => { seenTurn(); open({ type: "task", id: t.id }); }}
    right={<StartFinish t={t} A={A} onStart={seenTurn} />} />;
}
// 줄 오른쪽 [시작] [끝냄] (사용자 2026-10-13 "시작버튼은 os버전2는 없는거 맞아?" → 버전1 '▶ 진행 시작'처럼 할 일 줄마다)
//   할 일 = [시작](진행 중으로 · 시작한 때 기록) + [끝냄] · 진행 중·보류 = [끝냄] (진행 중이면 줄 아래에 '시작 14:05') · 확인 대기·끝남 = 없음
export function StartFinish({ t, A, onStart }) {
  if (isDone(t) || t.status === "review") return null;
  if ((t.status || "todo") !== "todo") return <Act onClick={() => A.finish(t)}>끝냄</Act>;
  return <span className="v2-sf" onClick={(e) => e.stopPropagation()}>
    <Act onClick={() => { if (onStart) onStart(); A.setStatus(t, "inprogress"); }} style={{ ...BTN_ON, minWidth: 48, padding: "0 10px" }}>시작</Act>
    <Act onClick={() => A.finish(t)} style={{ minWidth: 48, padding: "0 10px" }}>끝냄</Act></span>;
}
// 시작한 때 (버전1 '시작 hh:mm'처럼): 상태 기록의 마지막 '진행 중' → 오늘이면 시각 · 아니면 날짜
export const startedL = (t, key) => { if (!t || t.status !== "inprogress") return "";
  const l = (t.statusLog || []).filter((x) => x && x.status === "inprogress" && x.at).pop(), at = l ? l.at : "";
  if (!at) return t.startedAt ? `시작 ${md(t.startedAt)}` : "";
  const d = ymd(new Date(at)); return d === key ? `시작 ${hm(at)}` : `시작 ${md(d)}`; };

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
  const tempG = Object.values(temp.reduce((a, t) => { const p = D.projects.find((x) => x.id === t.projectId) || { id: "", title: "프로젝트 없음" }; (a[p.id] = a[p.id] || { key: p.id, label: p.id ? projLabel(p, D) : p.title, items: [] }).items.push(t); return a; }, {}));
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
          <div style={{ fontSize: 12, color: C.sub, margin: "2px 0 6px" }}>{projLabelOf(D, t.projectId)}{!can ? ` · 기한은 ${nameOf(D.users, dueApprover(t, D))}님께 요청` : ""}</div>
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

// ───────────────── 할 일 바로 추가 (사용자 요청 2026-10-13 "팀원들이 예전 업무os쓰는게 편한가봐 · 할일추가를 기존 os처럼 바로 쉽게") ─────────────────
// 버전1 '빠른 업무 추가'처럼 입력칸 하나 → Enter(또는 [추가]) = 바로 내 할 일 · 칸은 비우고 커서 그대로(연달아 넣기) · 5초 되돌리기(= 없애기 · 휴지통)
//   날짜 [오늘 · 내일(쉬는 날이면 다음 평일) · 미정 · 날짜] · 프로젝트(선택 · 고르면 그 프로젝트 지금 단계) — 고른 것은 다음 것에도 그대로
//   dflt = 처음 날짜(오늘 화면 [내일] 보기 → 내일 · 내 할 일 모두 [날짜 없음] → 미정) · hold = 머리 [+ 맡기기]가 쓰던 제목·날짜·프로젝트를 들고 가게
const dayL = (d, key) => (!d ? "날짜 미정" : d === key ? "오늘" : d === addDays(key, 1) ? "내일" : `${md(d)}(${WD[new Date(d + "T00:00:00").getDay()]})`);
export function QuickAdd({ D, cu, A, setToast, dflt = "today", hold }) {
  const key = ymd(new Date()), tmr = nextWorkday(addDays(key, 1));
  const [title, setTitle] = useState(""), [dk, setDk] = useState(dflt), [pick, setPick] = useState(""), [pid, setPid] = useState("");
  useEffect(() => { setDk(dflt); }, [dflt]);
  const ref = useRef(null);
  const due = dk === "today" ? key : dk === "tomorrow" ? tmr : dk === "pick" ? pick : "";
  if (hold) hold.current = { title: title.trim(), due, pid, clear: () => setTitle("") };
  const [mine, others] = useMemo(() => { const by = (a, b) => String(a.title).localeCompare(String(b.title), "ko"), op = D.projects.filter(projOpen);   // 글자 칠 때마다 다시 세지 않게
    const my = new Set([...op.filter((p) => p.assigneeId === cu.id || (p.collaboratorIds || []).includes(cu.id)).map((p) => p.id), ...D.tasks.filter((t) => t.projectId && !t.isFixed && isMine(t, cu.id)).map((t) => t.projectId)]);
    return [op.filter((p) => my.has(p.id)).sort(by), op.filter((p) => !my.has(p.id)).sort(by)]; }, [D.projects, D.tasks, cu.id]);
  const add = (e) => { if (e) e.preventDefault(); const s = title.trim(); if (ref.current) ref.current.focus(); if (!s) return;
    setTitle("");   // 바로 비움 → 다음 것을 이어서 씀 (저장 실패면 되돌려 놓음)
    const ph = pid ? phaseNowOf(D, D.projects.find((x) => x.id === pid), key) : "";
    A.addTask({ title: s, assigneeId: cu.id, dueDate: due, projectId: pid, noReview: true, ...(ph ? { phase: ph } : {}) }).then((t) => {
      if (!t) { setTitle((c) => c || s); return; }
      setToast({ text: `추가했어요 · ${dayL(due, key)}${due ? "" : " · 아래 '날짜 없는 일'"}${pid ? " · " + projLabelOf(D, pid) : ""}`, undo: () => A.taskRemove(t, "방금 추가한 것 되돌리기") }); }); };
  const tmrL = tmr === addDays(key, 1) ? "내일" : dayL(tmr, key);
  return <form className="v2-qadd" onSubmit={add}>
    <div className="in">
      <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="할 일 바로 추가 (Enter)" aria-label="할 일 바로 추가" enterKeyHint="enter" autoComplete="off" />
      <button type="submit" disabled={!title.trim()} onMouseDown={(e) => e.preventDefault()}>추가</button>
    </div>
    <div className="op" role="group" aria-label="추가할 날짜 · 프로젝트">
      {[["today", "오늘"], ["tomorrow", tmrL], ["none", "미정"]].map(([k, l]) => <button key={k} type="button" className={"c" + (dk === k ? " on" : "")} aria-pressed={dk === k} onMouseDown={(e) => e.preventDefault()} onClick={() => setDk(k)}>{l}</button>)}
      <label className={"c dt" + (dk === "pick" ? " on" : "")}>{dk === "pick" && pick ? dayL(pick, key) : "날짜"}
        <input type="date" aria-label="다른 날짜" value={pick} onChange={(e) => { setPick(e.target.value); setDk(e.target.value ? "pick" : "today"); }} onClick={(e) => { try { e.currentTarget.showPicker(); } catch (_) { /* 폰은 눌러서 바로 열림 */ } }} /></label>
      <label className={"c pj" + (pid ? " on" : "")}><span>{pid ? projLabelOf(D, pid) : "프로젝트 ▾"}</span>
        <select aria-label="프로젝트" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">프로젝트 없음</option>
          {mine.length > 0 && <optgroup label="내 프로젝트">{mine.map((p) => <option key={p.id} value={p.id}>{projLabel(p, D)}</option>)}</optgroup>}
          {others.length > 0 && <optgroup label="다른 프로젝트">{others.map((p) => <option key={p.id} value={p.id}>{projLabel(p, D)}</option>)}</optgroup>}
        </select></label>
    </div>
  </form>;
}

// 할 일 추가 · 맡기기 — 사람을 고르면 그 사람의 2주 일정을 보고 기한을 바로 고른다
export function AddSheet({ D, cu, A, onBack, onClose, preset, setToast }) {
  // 기본 기한: 오늘 (다른 사람에게 맡길 때 오늘이 쉬는 날이면 다음 평일)
  const t0 = ymd(new Date()), w0 = preset.assigneeId || cu.id;
  const [title, setTitle] = useState(preset.title || ""), [who, setWho] = useState(w0), [due, setDue] = useState(preset.dueDate != null ? preset.dueDate : (w0 !== cu.id && isOffDay(t0) ? nextWorkday(t0) : t0));   // title·dueDate "" = 할 일 바로 추가에서 쓰던 것 (2026-10-13)
  const [pid, setPid] = useState(preset.projectId || ""), [keep, setKeep] = useState(false), [busy, setBusy] = useState(false), [step, setStep] = useState(""), [review, setReview] = useState(true);
  const [phk, setPhk] = useState(preset.phase || null);   // 넣을 단계(로드 · 2026-10-07) — null = 그 프로젝트 지금 단계
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
  // 고른 프로젝트에 단계(로드)가 있으면(신제품 빼고) 단계 칩 · 기본 = 지금 단계(남은 업무가 있는 첫 단계)
  const pSel = pid ? D.projects.find((x) => x.id === pid) : null, pRoad = pSel && !isLaunchProj(pSel) ? roadOf(pSel, D) : null;
  const pStates = useMemo(() => { if (!pRoad) return []; const ts = D.tasks.filter((t) => t.projectId === pSel.id && !t.isFixed), by = new Map(ts.map((t) => [t.id, t])); return roadStates(pRoad, ts, (t) => phaseOfTask(t, pSel, D, by, pRoad), today); }, [pid, D]);
  const stK = pRoad ? (phk != null && (phk === "" || pRoad.some((x) => x.k === phk)) ? phk : curStage(pStates)) : "";
  const save = async () => { if (!ok) return; setBusy(true);
    const t = await A.addTask({ title, assigneeId: who, dueDate: due, projectId: pid, firstStep: step, noReview: other ? !review : true, ...(preset.deps ? { deps: preset.deps } : {}), ...(stK ? { phase: stK } : {}) });
    setBusy(false); if (!t) return;
    if (preset.onSaved) preset.onSaved(t);   // 할 일 바로 추가 칸 비우기
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
    <div className="v2-chips"><Chip on={!pid} onClick={() => { setPid(""); setPhk(null); }}>없음</Chip>{myProj.map((p) => <Chip key={p.id} on={pid === p.id} onClick={() => { setPid(p.id); setPhk(null); }} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{projLabel(p, D)}</Chip>)}
      <select aria-label="다른 프로젝트" value="" onChange={(e) => { if (e.target.value) { setPid(e.target.value); setPhk(null); } }} className="v2-sel"><option value="">다른 프로젝트 ▾</option>{D.projects.filter(projOpen).filter((p) => !myProj.some((m) => m.id === p.id)).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko")).map((p) => <option key={p.id} value={p.id}>{projLabel(p, D)}</option>)}</select></div>
    {pRoad && <><div className="v2-lab">단계 <span style={{ color: C.mute, fontWeight: 600 }}>(기본 = 지금 단계)</span></div>
      <div className="v2-chips" role="group" aria-label="넣을 단계">{pRoad.map((x) => <Chip key={x.k} on={stK === x.k} onClick={() => setPhk(x.k)}>{x.name}</Chip>)}<Chip on={stK === ""} onClick={() => setPhk("")}>단계 미정</Chip></div></>}
    {other && <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, color: C.text }}><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} style={{ width: 18, height: 18 }} />끝나면 내가 확인하기</label>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 14, color: C.sub }}><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ width: 18, height: 18 }} />계속 추가 (저장 뒤에도 이 창 유지)</label>
  </Sheet>;
}

// 날짜 칩 (내 할 일 모두 · 사용자 요청 2026-10-06): 기한 기준 · 상태 칩·찾기와 같이 · 마지막 고른 것 기기 저장(pour-os2-mine-date-<나>)
export const MINE_DATES = [["all", "전체"], ["past", "지난 일"], ["today", "오늘"], ["tomorrow", "내일"], ["week", "이번 주"], ["next", "다음 주"], ["none", "날짜 없음"], ["pick", "날짜 고르기"]];
export function mineDateHit(k, due, key, from, to) {
  const ws = weekStart(key);
  if (k === "all") return true; if (k === "none") return !due; if (!due) return false;
  if (k === "past") return due < key; if (k === "today") return due === key; if (k === "tomorrow") return due === addDays(key, 1);
  if (k === "week") return due >= ws && due <= addDays(ws, 6); if (k === "next") return due >= addDays(ws, 7) && due <= addDays(ws, 13);
  if (k === "pick") return !!from && due >= from && due <= (to && to >= from ? to : from);
  return true;
}
// '전체'일 때 날짜 머리: 지난 일 · 오늘 · 내일 · 10/9(금) … · 날짜 없음
export const mineDateHead = (due, key) => (!due ? "날짜 없음" : due < key ? "지난 일" : due === key ? "오늘" : due === addDays(key, 1) ? "내일" : `${md(due)}(${WD[new Date(due + "T00:00:00").getDay()]})`);
export function MineSheet({ D, cu, A, open, onBack, onClose, setToast }) {
  const [st, setSt] = useState("todo"), [q, setQ] = useState("");
  const [df, setDf] = useLocal(LSK("mine-date-" + cu.id), { k: "all", from: "", to: "" });
  const dk = (df && df.k) || "all", from = (df && df.from) || "", to = (df && df.to) || "";
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
  const base = qq ? mine.filter((t) => String(t.title).toLowerCase().includes(qq)) : by[st];
  const dN = Object.fromEntries(MINE_DATES.map(([k]) => [k, base.filter((t) => mineDateHit(k, dueOf(t), key, from, to)).length]));
  const list = base.filter((t) => mineDateHit(dk, dueOf(t), key, from, to)).slice().sort((a, b) => st === "done" && !qq ? String(b.doneAt || "").localeCompare(String(a.doneAt || "")) : String(dueOf(a) || "9999").localeCompare(String(dueOf(b) || "9999")));
  // 전체 = 날짜 머리로 묶음 (기한 순 · 날짜 없음 맨 아래)
  const shown = list.slice(0, 200), groups = [];
  if (dk === "all" && !(st === "done" && !qq)) shown.slice().sort((a, b) => String(dueOf(a) || "9999").localeCompare(String(dueOf(b) || "9999"))).forEach((t) => { const h = mineDateHead(dueOf(t), key); const g = groups[groups.length - 1]; if (g && g.h === h) g.a.push(t); else groups.push({ h, a: [t] }); });
  else groups.push({ h: "", a: shown });
  const pName = (pid) => projLabelOf(D, pid);
  const setK = (k) => setDf({ k, from: k === "pick" ? from || key : from, to });
  const row = (t, i, a) => { const r = riskOf(t, key);
    return <Row key={t.id} dim={isDone(t)} title={t.title} sub={[dueOf(t) ? (isDone(t) ? md(dueOf(t)) : ddayLabel(ddays(dueOf(t), key))) : "날짜 없음", pName(t.projectId), startedL(t, key)].filter(Boolean).join(" · ")} tag={r ? r.label : null} tagTone={r && r.red ? "red" : null} onClick={() => open({ type: "task", id: t.id })}
      right={isDone(t) || t.status === "review" ? null : !dueOf(t) ? (t.dueReq ? null : dayAct(t)) : <StartFinish t={t} A={A} />} last={i === a.length - 1} />; };
  return <Sheet title="내 할 일 모두" onBack={onBack} onClose={onClose}>
    <Card style={{ marginTop: 12 }}><QuickAdd D={D} cu={cu} A={A} setToast={setToast} dflt={dk === "tomorrow" ? "tomorrow" : dk === "none" ? "none" : "today"} /></Card>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="내 업무 찾기" aria-label="내 업무 찾기" style={inp} />
      {!qq && <div className="v2-filterrow" role="group" aria-label="상태"><div className="v2-chips">{[["todo", "할 일"], ["inprogress", "진행"], ["review", "확인 대기"], ["hold", "보류"], ["done", "끝남"]].map(([k, l]) => <Chip key={k} on={st === k} onClick={() => setSt(k)}>{l} {by[k].length}</Chip>)}</div></div>}
      <div className="v2-filterrow" role="group" aria-label="날짜"><div className="v2-chips">{MINE_DATES.map(([k, l]) => <Chip key={k} on={dk === k} onClick={() => setK(k)}>{k === "pick" ? `${l} ${dk === "pick" ? "▴" : "▾"}` : `${l} ${dN[k]}`}</Chip>)}</div></div>
      {dk === "pick" && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: C.sub }}>
        <input type="date" aria-label="시작 날짜" className="v2-sel" value={from} onChange={(e) => setDf({ k: "pick", from: e.target.value, to: to && to < e.target.value ? "" : to })} />
        <span>~</span><input type="date" aria-label="끝 날짜" className="v2-sel" value={to} min={from || undefined} onChange={(e) => setDf({ k: "pick", from, to: e.target.value })} />
        <span>{to && to > from ? "" : "하루만 · 끝 날짜를 고르면 기간"} · {dN.pick}개</span></div>}
    </div>
    {list.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>없어요</Empty></Card>
      : groups.map((g, gi) => <div key={g.h + gi}>{g.h && <Head red={g.h === "지난 일"}>{g.h} {g.a.length}</Head>}<Card style={{ marginTop: g.h ? 0 : 12 }}>{g.a.map(row)}</Card></div>)}
    {st === "done" && !qq && <p style={{ fontSize: 12.5, color: C.mute, margin: "10px 2px" }}>최근 30일에 끝낸 업무만 보여요</p>}
  </Sheet>;
}

// 다가오는 내 차례 한 줄: 태그 = 여유 n일 · 빠듯 · 늦을 수 있음 · 앞 일 늦음(빨강) / 제목 = 프로젝트 · 내 일 / 아래 = 앞사람 무엇·상태·끝 예정 · 내 기한 · 출시·마감
// 신제품 '출시보다 늦음'은 책임자·마스터에게 '고치기 ›' → 그 프로젝트(맨 위 출시일·기한 고치기 카드)
export function UpRow({ u, D, open, keyd, last, cu }) {
  const L = upLine(u, D.users, keyd), red = u.level === "late" || u.level === "risk";
  const pj = (D.projects || []).find((x) => x.id === u.t.projectId), fix = cu && pj && pj.launchDate && /^출시보다 늦음/.test(u.label || "") && (pj.assigneeId === cu.id || isMaster(cu));
  return <Row tag={u.label} tagTone={red ? "red" : u.level === "ok" ? "turn" : null} title={L.title} sub={L.proj} sub2={L.pred}
    onClick={() => open({ type: "task", id: u.t.id })}
    right={fix ? <Act onClick={() => open({ type: "project", id: pj.id, first: "work" })}>고치기 ›</Act> : red ? <Act onClick={() => open({ type: "task", id: u.p.id, focus: "talk" })}>묻기</Act> : null} last={last} />;
}
// 다가오는 내 차례 모두 (7일 '곧 내 차례'·오늘 화면에서) — 내 차례가 오는 날 순 · 위험한 것 먼저 · 프로젝트 이름까지
export function UpTurnsSheet({ D, cu, open, T, onBack, onClose }) {
  const key = ymd(new Date()), U = upcomingTurns(D, T, key, cu.id), we = addDays(key, 6);
  const soon = U.filter((u) => u.start && u.start <= we), later = U.filter((u) => u.start && u.start > we), nod = U.filter((u) => !u.start);
  const sec = (h, a) => a.length > 0 && <><Head>{h} {a.length}</Head><Card>{a.map((u, i) => <UpRow key={u.t.id} u={u} D={D} cu={cu} open={open} keyd={key} last={i === a.length - 1} />)}</Card></>;
  return <Sheet title={`다가오는 내 차례 ${U.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px", lineHeight: 1.6 }}>앞사람이 끝내면 이어서 할 내 일이에요. 여유 = 앞 일 끝 예정 다음 날부터 내 기한까지 평일 수 · 빨강은 늦을 수 있어요 → '묻기'로 앞사람에게 바로 물어보세요.</p>
    {sec("7일 안", soon)}{sec("그 뒤", later)}{sec("날짜를 몰라 잴 수 없음", nod)}
    {!U.length && <Card><Empty>앞사람을 기다리는 내 일이 없어요</Empty></Card>}
  </Sheet>;
}
