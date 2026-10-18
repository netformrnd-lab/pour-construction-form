// 업무OS v2 — AI 팀원 · AI 승인 화면 (사용자 결정 2026-10-12)
//   "AI팀원이 실행한 것을 사람팀원에게 승인요청하고, 사람팀원은 상급자 사람에게 승인요청" · "AI 팀원을 각 사람 담당자가 관리하면서 고도화"
//   AiAskSheet = 승인 한 장(번호 고르기 · 위로 · AI 에게 다시 · 돌려보내기 · 안 함 · 대화 · 기록)
//   AiTeamBody = AI 팀원 목록(크루 = 브랜드+고객별 · 기본 AI 팀원 = 원형) — 팀 앱 더보기 › AI 팀원 · 관리자 탭 'AI 팀원'
//   AiMateSheet = AI 한 장(담당 · 승인 길 · 성과 · 고칠 점 → 확정 규칙 · 보드 = 지표·행동(가을 F = 광고 일일 보고서)·옮긴 할 일(2026-10-17 AARRR)·최근 결과)
//   BossCard · BossPanel = 상급자(관리자 › 사람)
//   AiSetupSheet = 내 PC Aside 세팅(2026-10-15 담당마다 자기 PC · 시각 · 로그인해 둘 곳 · [Aside 글 복사] · 고칠 것 확인) — '확인할 것' 세팅·안 돎 줄에서 열림
// 계산 aiask.js · 정의 marketing-hub/crew.js · 쓰기 core.jsx(useActs aiPass·aiBack·aiRet·aiDrop·mateOwnerSet·mateRule·setBoss·setBosses)
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { md, hm, ago, ymd, addDays, isMaster, nameOf, activeUsers, isOffDay } from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, inp, Linked, useLocal } from "./ui.jsx";
import { Thread, useItemNotes } from "./task.jsx";
import { refCount } from "./refui.jsx";   // AI 한 장 · 참고 레퍼런스 수 (2026-10-17)
import { LS } from "./core.jsx";
import { RtMulti } from "./airtui.jsx";   // AI 크루 ↔ 반복 실행 (2026-10-16) · 여러 개 (2026-10-17)
import { isFxKey, fxIdOf, NO_ACT, akKeys, pairable } from "./airt.js";
import { GONE, liveCrews, closedCrews, CLOSED_L, pathGroups, pathGroupsL, crewOf, mateOf, boardOf, brandL, servesL, mateBrands, ownerKeys, fmtMetric, metricPct, metricOk, runWord, asideLaunch, asideRedoLaunch, asideFixLaunch, loginSites, planOf, qtyDefs, qtyNow, canReq, reqMates, REQ_SHAPES, REQ_PRESETS, REQ_STATE_L, reqLine, asideReqLaunch, execOf, formulaHead, formulaSep, movedOut, movedIn, stageOf, designOf, designBad, DESIGN_MAX, BRAND_L, handoffTargets, handoffLabel, handoffNeedsDone, INBOX_DAYS, isNpsAct, npsFromTraces, npsLine } from "../../marketing-hub/crew.js";
import { cycleOf, periodOf, repCrews, repId, repSlots, secState, periodL, dueL, CYCLE_L } from "./aireport.js";   // AI 크루 보고 (2026-10-15)
import { ASK_STATE_L, canAct, canBack, canRet, isProxy, pickOk, planPass, chainOf, mateOwner, actOwner, hqOf, canUpHQ, pathOf, pathDef, upLeadTo, PATH_L, mateStats, repeatNotes, itemLine, bossOf, bossRec, bossLoop, asidePlanOf, ranOn, missedOn, goneWaits, GONE_DROP, myTurnN,
  waitWd, workMin, prevWaits, newerOf, routineRanOn, routineMisses, routineAlert, stuckAlert, LATE_WD, BACK_MIN, PREV_DROP, ROUTINE_AT, ROUTINE_CHECK } from "./aiask.js";   // 멈춤 감시 (2026-10-17)

export const HUB_CREW_URL = "../marketing-hub/crew.html";   // Aside 결과 올리기 (허브)
export const HUB_MANUAL_URL = "../marketing-hub/ai-manual.html", HUB_ADS_URL = "../marketing-hub/ads.html";   // AI 팀 매뉴얼 · 광고 운영 (2026-10-15 · 읽기 전용 · Aside 가 씀)
const aiNoteId = (id) => "ai:" + id;
const tone = { wait: C.navy, back: C.sub, ok: C.green, no: C.mute };
const Pill = ({ children, color = C.navy, bg = C.soft }) => <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;
// 긴 글 줄 (규칙·고칠 점 · 줄바꿈 · Row 는 한 줄로 자름)
const Line = ({ text, sub, right, tag, last }) => <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: last ? "none" : `1px solid ${C.line}`, background: "#fff" }}>
  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{tag && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 6, color: C.red, background: "#F8E9EA", marginRight: 6 }}>{tag}</span>}{text}</div>
    {sub && <div style={{ marginTop: 3, fontSize: 12.5, color: C.sub }}>{sub}</div>}</div>{right}</div>;
const Banner = ({ children, red }) => <div style={{ margin: "10px 0 0", padding: "11px 13px", borderRadius: 12, background: red ? "#F8E9EA" : "#F7F8FB", border: `1px solid ${red ? "#E9C4C7" : C.line}`, fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{children}</div>;

// 글 복사 버튼 (Aside 에 붙여 넣을 글) — 클립보드가 막히면 바로 아래 글 칸(골라 둠 · 길게 눌러 복사)
export function CopyText({ text, label, v = "line", solid }) {
  const [st, setSt] = useState("");
  const go = async () => { try { await navigator.clipboard.writeText(text); setSt("ok"); setTimeout(() => setSt(""), 1500); } catch (e) { console.warn("[v2] 복사 막힘:", e); setSt("box"); } };
  return <span style={{ display: "inline-flex", flexDirection: "column", gap: 6, maxWidth: "100%" }}>
    <TBtn v={solid ? "solid" : v} onClick={go} aria-label={label}>{st === "ok" ? "✓ 복사했어요" : label}</TBtn>
    {st === "box" && <textarea readOnly value={text} rows={5} aria-label={label + " 글"} onFocus={(e) => e.target.select()} autoFocus style={{ ...inp, fontSize: 12, width: "min(560px, 86vw)" }} />}
  </span>;
}
const PC_L = (D, owner, cu) => (!owner ? "담당 미정 · 관리자 PC" : owner === cu.id ? "내 PC" : `${nameOf(D.users, owner)} PC`);

// 승인 한 건 찾기: 구독(열린 것 + 최근 7일)에 없으면(오래전에 끝난 것 · 링크) 한 번 읽음
export function useAsk(D, id) {
  const live = ((D.ai && D.ai.asks) || []).find((x) => x.id === id);
  const [extra, setExtra] = useState(null);
  useEffect(() => { if (live || extra) return; fb.getOne("aiasks", id).then((x) => setExtra(x || false)).catch((e) => { console.error("[v2] AI 승인 불러오기 실패:", e); setExtra(false); }); }, [id, !!live]);
  return live || extra;
}

// 승인 길 한 줄: 겨울(AI) → 남윤정 ✓ → 김소연 ● → 허지은 · pth = 승인 길(담당에서 끝이면 담당에서 끊김 · 2026-10-17)
export function ChainLine({ a, users, hq, pth }) {
  const ch = chainOf(a, users, hq, pth), mk = { done: "✓", now: "●", next: "", wait: "" };
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
    <span style={{ fontWeight: 800, color: C.ink }}>{a.mateName || "AI"} (AI)</span>
    {ch.map((x, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: C.mute }}>→</span>
      <span style={{ fontWeight: x.st === "now" ? 900 : 700, color: x.st === "now" ? C.navy : x.st === "done" ? C.green : C.sub, padding: x.st === "now" ? "1px 7px" : 0, borderRadius: 6, background: x.st === "now" ? C.soft : "none" }}>{x.name}{mk[x.st] ? " " + mk[x.st] : ""}</span>
      {i === 0 && <span style={{ fontSize: 11.5, color: C.mute }}>담당</span>}</span>)}
    {!ch.length && a.state === "back" && <span>→ 담당 미정</span>}
  </div>;
}

// 번호 하나 (폰 카드): 번호 · 첫 칸 값 · 나머지 '열 값' 줄 · 고르기
function ItemCard({ it, cols, card, on, can, onToggle, last }) {
  const c = it.c || {}, ks = (cols && cols.length ? cols : Object.keys(c)).filter((k) => c[k] != null && c[k] !== "");
  const title = (card && card.title && c[card.title]) || (ks[0] ? c[ks[0]] : ""), rest = ks.filter((k) => c[k] !== title);
  const copyCol = card && card.copy && card.body ? card.body : null, [copied, setCopied] = useState(false);
  const copy = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(String(c[copyCol] || "")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); } catch (_) {} };
  return <div role={can ? "checkbox" : undefined} aria-checked={can ? !!on : undefined} tabIndex={can ? 0 : undefined} onClick={can ? onToggle : undefined} onKeyDown={(e) => { if (can && (e.key === " " || e.key === "Enter")) { e.preventDefault(); onToggle(); } }}
    style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: last ? "none" : `1px solid ${C.line}`, background: on ? "#F2F5FC" : "#fff", cursor: can ? "pointer" : "default" }}>
    <div aria-hidden style={{ flex: "0 0 auto", width: 22, height: 22, marginTop: 1, borderRadius: 6, border: `2px solid ${on ? C.navy : "#C4CBDB"}`, background: on ? C.navy : "#fff", color: "#fff", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: can || on ? 1 : 0.5 }}>{on ? "✓" : ""}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, wordBreak: "break-word" }}><span style={{ color: C.navy, marginRight: 6 }}>{it.n}</span>{title}</div>
      {rest.map((k) => <div key={k} style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><b style={{ color: C.mute, fontWeight: 700 }}>{k}</b> <Linked text={String(c[k])} /></div>)}
      {copyCol && c[copyCol] && <div style={{ marginTop: 6 }}><TBtn onClick={copy}>{copied ? "✓ 복사했어요" : `${copyCol} 복사`}</TBtn></div>}
    </div>
  </div>;
}

const LOG_W = { ask: "올림", redo: "고쳐서 다시 올림", up: "승인 →", ok: "최종 승인", back: "AI에게 다시", ret: "돌려보냄", no: "안 함", undo: "되돌림" };
const REASONS = ["이번엔 안 함", "중복", "근거 부족", "브랜드와 안 맞음", "시기 아님"];

// 오늘 아침 루틴 (2026-10-17 멈춤 감시) — 올라온 노트 승인 · 09:30 까지 안 올라오면 빨강 + 사장님께 보낼 글 (아침 루틴은 사장님 Claude 예약 작업 · 팀원은 알리기만)
function RoutineToday({ D, m }) {
  const now = new Date(), key = ymd(now), miss = routineMisses(D, now).some((x) => x.mate === m.id);
  const got = ((D.ai && D.ai.asks) || []).filter((a) => routineRanOn(a, m.id, key)).sort((p, q) => String(p.createdAt).localeCompare(String(q.createdAt)));
  return <Banner red={miss}><b>오늘 아침 루틴</b> · {isOffDay(key) ? "쉬는 날이라 안 돌아요" : got.length ? `${hm(got[0].createdAt)} 올라옴 · 승인 ${got.length}건` : miss ? <b style={{ color: C.red }}>{ROUTINE_CHECK}까지 안 올라왔어요</b> : `평일 ${ROUTINE_AT} 예약 · 아직 (${ROUTINE_CHECK}까지 기다려요)`}
    {miss && <><div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>아침 루틴은 사장님 Claude 예약 작업이에요 · 막혔을 수 있으니 이 글을 사장님께 보내 주세요</div>
      <div style={{ marginTop: 8 }}><CopyText text={routineAlert(m.name, now)} label="사장님께 보낼 글 복사" /></div></>}</Banner>;
}
export function AiAskSheet({ D, cu, A, open, onBack, onClose, id, focus, note }) {
  const a = useAsk(D, id);
  const notes = useItemNotes(D, aiNoteId(id));
  const [pick0, setPick] = useState(null), [mode, setMode] = useState(""), [txt, setTxt] = useState(""), [busy, setBusy] = useState(false), [showLog, setShowLog] = useState(false), [more, setMore] = useState(2), [prevAsk, setPrevAsk] = useState(false);
  useEffect(() => { if (focus !== "talk") return; const h = setTimeout(() => { const el = document.getElementById("v2-ai-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150); return () => clearTimeout(h); }, [focus, !!a]);
  if (a === undefined || a === null) return <Sheet title="AI 승인" kind="AI 승인" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (a === false) return <Sheet title="AI 승인" kind="AI 승인" onBack={onBack} onClose={onClose}><Empty>이 승인 요청을 찾지 못했어요</Empty></Sheet>;
  const m = mateOf(a.mate) || { name: a.mateName || "AI", role: "" }, b = a.board ? boardOf(a.board) : null, actDef = b ? b.actions.find((x) => x.c === a.act) : null;
  const items = a.items || [], can = canAct(a, cu), proxy = can && isProxy(a, cu), ho = handoffTargets(a.mate, a.act);   // 넘기기 (2026-10-17 사장님 넘기기 A)
  const pick = pick0 || (Array.isArray(a.pick) ? a.pick : []), pset = new Set(pick);
  const toggle = (n) => setPick(pset.has(n) ? pick.filter((x) => x !== n) : [...pick, n]);
  const md0 = ((D.ai && D.ai.mates) || {})[a.mate], hq = hqOf(a, md0), pth = pathOf(a, md0), upOk = canUpHQ(a, cu, D.users, hq);   // 본부장 승인 일 (2026-10-15 · 광고비 예산·원가·판매가 조정)
  const upL = upLeadTo(a, cu, D.users, pth);   // 담당에서 끝나는 일 → [리드에게도 올리기] (2026-10-17 승인 길)
  const pv = can ? planPass(a, cu, D.users, items.length ? pick : null, "", { hq, path: pth }) : null, nextN = pv && pv.next ? nameOf(D.users, pv.next) : "";
  const go = async (fn) => { if (busy) return; setBusy(true); try { const ok = await fn(); if (ok) { setMode(""); setTxt(""); setPick(null); } } finally { setBusy(false); } };
  const passL = `${items.length ? `고른 ${pick.length}개 ` : ""}${pv && pv.next ? `승인 → ${nextN}님께` : "최종 승인"}`;
  const exIds = (a.execTasks && a.execTasks.length ? a.execTasks : a.execTask ? [a.execTask] : []), exMine = exIds.find((x) => { const t = (D.tasks || []).find((y) => y.id === x); return t && (t.assigneeIds || [t.assigneeId]).includes(cu.id); });
  const exT = (exMine || a.execTask) ? (D.tasks || []).find((t) => t.id === (exMine || a.execTask)) : null;   // 열쇠 담당별 실행 업무 (2026-10-17) — 내 몫 먼저
  // 멈춤 감시 (2026-10-17): 평일 n일째 기다림 · 같은 할 일의 이전 결과 / 더 새 결과 · AI 가 반나절 넘게 못 고침
  const nowD = new Date(), allAsks = (D.ai && D.ai.asks) || [], lateWd = a.state === "wait" ? waitWd(a, nowD) : 0;
  const pw = a.state === "no" ? [] : prevWaits(allAsks, a), pwMine = pw.filter((x) => canAct(x, cu)), nw = a.state === "wait" && !(a.step > 0) ? newerOf(allAsks, a) : null;
  const stuckMin = a.state === "back" ? workMin((a.back && a.back.at) || a.updatedAt, nowD) : 0;
  const dropPrev = async () => { setPrevAsk(false); await go(() => A.aiDropMany(pwMine, PREV_DROP)); };
  const foot = can ? <><Big disabled={busy || !pickOk(a, pick)} onClick={() => go(() => A.aiPass(a, items.length ? pick : null))}>{passL}</Big>
      {upOk && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12.5, color: C.sub, flexWrap: "wrap" }}><span style={{ flex: "1 1 160px" }}>리드에서 끝나는 일이에요 · 본부장 확인이 필요하면</span><TBtn disabled={busy || !pickOk(a, pick)} onClick={() => go(() => A.aiPass(a, items.length ? pick : null, true))}>본부장에게도 올리기</TBtn></div>}
      {upL && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12.5, color: C.sub, flexWrap: "wrap" }}><span style={{ flex: "1 1 160px" }}>담당에서 끝나는 일이에요 · {nameOf(D.users, upL)}님 확인이 필요하면</span><TBtn disabled={busy || !pickOk(a, pick)} onClick={() => go(() => A.aiPass(a, items.length ? pick : null, "lead"))}>리드에게도 올리기</TBtn></div>}
      {proxy && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>관리자로 대신 눌러요 · 지금 차례는 {nameOf(D.users, a.to)}님 · 기록엔 내 이름이 남아요</div>}</>
    : a.state === "wait" ? <Big disabled>{a.to ? `${nameOf(D.users, a.to)}님 승인 기다리는 중` : "담당 미정 · 관리자가 승인해요"}</Big>
    : a.state === "back" ? <Big disabled>{m.name}(AI)가 고치는 중 · 다시 올리면 알려 드려요</Big>
    : a.state === "ok" ? (a.execTask ? <Big tone="white" onClick={() => open({ type: "task", id: exT ? exT.id : a.execTask })}>{exIds.length > 1 && exMine ? "내 실행 업무 보기" : "실행 업무 보기"}{exT ? ` · ${exT.status === "done" ? "끝남" : nameOf(D.users, (exT.assigneeIds || [exT.assigneeId])[0]) + " 담당"}` : ""}</Big> : <Big disabled>최종 승인됨</Big>)
    : <Big disabled>안 하기로 함</Big>;
  return <Sheet title="AI 승인" kind="AI 승인" head={a.title} path={`AI 팀원 · ${m.name}${m.role ? " · " + m.role : ""}`} onPath={() => open({ type: "aiMate", id: a.mate })} onBack={onBack} onClose={onClose} foot={foot}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }}>
      <Pill color={tone[a.state] || C.navy}>{ASK_STATE_L[a.state] || a.state}{a.state === "wait" ? (a.step > 0 ? ` · ${a.step + 1}단계` : " · 담당 단계") : ""}</Pill>
      {a.brand && <Pill color={C.sub} bg="#F1F2F6">{brandL(a.brand)}</Pill>}
      {(a.ver || 1) > 1 && <Pill color={C.sub} bg="#F1F2F6">{a.ver}번째로 다시 올림</Pill>}
      {hq && <Pill color="#9A3412" bg="#FFF1E6">본부장 승인 · {hq}</Pill>}
      {pth === "owner" && !(a.step > 0) && (a.state === "wait" || a.state === "back") && <Pill color={C.sub} bg="#F1F2F6">담당에서 끝</Pill>}
      <span style={{ fontSize: 12.5, color: C.mute }}>{a.run ? md(a.run) + " 실행" : ""}{a.createdAt ? ` · ${ago(a.createdAt)}` : ""}</span>
    </div>
    <div style={{ marginTop: 10 }}><ChainLine a={a} users={D.users} hq={hq} pth={pth} /></div>
    {lateWd >= LATE_WD && <Banner red><b>평일 {lateWd}일째 기다리는 중</b> · {a.to ? `${nameOf(D.users, a.to)}님 차례` : "담당 미정 · 관리자 누구나"}
      {a.to && a.to !== cu.id && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>물어보려면 아래 대화에 @{nameOf(D.users, a.to)}</div>}</Banner>}
    {nw && <Banner><b>더 새 결과가 있어요</b> · {nw.run ? md(nw.run) + " 실행 · " : ""}{ASK_STATE_L[nw.state] || nw.state}{nw.state === "wait" && nw.step > 0 ? ` · ${nw.step + 1}단계` : ""} · 같은 할 일이에요
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}><TBtn onClick={() => open({ type: "aiask", id: nw.id })}>새 결과 보기 ›</TBtn>
        {can && <TBtn disabled={busy} onClick={() => go(() => A.aiDrop(a, PREV_DROP))}>이것은 지난 결과로 정리</TBtn>}</div></Banner>}
    {!nw && pw.length > 0 && <Banner><b>같은 할 일의 이전 결과 {pw.length}건이 아직 대기 중</b> · 이 결과가 가장 새것이에요
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{pw.slice(0, 3).map((x) => (x.run ? md(x.run) : "") + (x.to && x.to !== a.to ? ` · ${nameOf(D.users, x.to)}님 차례` : "")).join(" · ")}{pw.length > 3 ? ` 외 ${pw.length - 3}건` : ""}</div>
      {pwMine.length > 0 && <div style={{ marginTop: 8 }}><TBtn disabled={busy} onClick={() => setPrevAsk(true)}>이전 결과 {pwMine.length}건 정리</TBtn></div>}</Banner>}
    {prevAsk && <Ask title="이전 결과 정리" body={`같은 할 일의 이전 결과 ${pwMine.length}건을 '안 함'으로 정리할까요?\n이유: ${PREV_DROP}\n기록이 남고, 한 건씩 열어 보면 무엇이었는지 그대로 있어요.`} yes="정리" onNo={() => setPrevAsk(false)} onYes={dropPrev} />}
    {a.ret && a.state === "wait" && <Banner red><b>수정 요청</b> · {a.ret.byName} · {ago(a.ret.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={a.ret.text} /></div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>번호를 다시 고르거나 AI에게 다시 보내 주세요</div></Banner>}
    {a.state === "back" && a.back && <Banner><b>{m.name}(AI)에게 {a.back.more ? `더 만들기 ${a.back.more}개` : "다시 보냄"}</b> · {a.back.byName} · {ago(a.back.at)}<div style={{ whiteSpace: "pre-wrap" }}>{a.back.text}</div>
      {stuckMin >= BACK_MIN && <div style={{ color: C.red, fontWeight: 700, marginTop: 6 }}>일하는 시간 {Math.floor(stuckMin / 60)}시간째 그대로예요 · {b ? "담당 PC·Aside 가 켜져 있는지 확인하고 아래 글을 붙여 넣어 주세요" : "확인 루틴(사장님 Claude 예약 작업)이 막혔을 수 있어요"}</div>}
      {b ? <div style={{ marginTop: 8 }}><div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>바로 고치게 하려면 담당 PC Aside 에 이 글을 붙여 넣어요 · 고칠 것 확인을 한 시간마다 걸어 뒀으면 그때 고쳐요</div><CopyText text={asideRedoLaunch(a)} label="바로 고치기 — Aside 글 복사" /></div>
        : <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>{m.name}(AI)가 평일 10~17시엔 한 시간 안에 고쳐 다시 올려요 · 그 밖엔 다음 날 아침 06:50</div>}
      {!b && stuckMin >= BACK_MIN && <div style={{ marginTop: 8 }}><CopyText text={stuckAlert(a, nowD)} label="사장님께 보낼 글 복사" /></div>}</Banner>}
    {a.state === "no" && <Banner><b>안 함</b> · {a.noByName} · {a.noAt ? ago(a.noAt) : ""}{a.noReason ? <div>{a.noReason}</div> : null}</Banner>}
    {a.state === "ok" && <Banner><b>최종 승인</b> · {a.okByName} · {a.okAt ? `${md(ymd(new Date(a.okAt)))} ${hm(a.okAt)}` : ""}{a.exec ? <div>실제 반영은 사람이 해요 · '실행' 업무에서 번호마다 흔적을 남기고 끝내 주세요</div> : null}
      {exIds.length > 1 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}><span style={{ fontSize: 12.5, color: C.sub }}>반복업무 담당마다 실행 업무 {exIds.length}개 ·</span>
        {exIds.map((x) => { const t = (D.tasks || []).find((y) => y.id === x); return t ? <TBtn key={x} onClick={() => open({ type: "task", id: x })}>{nameOf(D.users, (t.assigneeIds || [t.assigneeId])[0]) || "담당"}{t.status === "done" ? " ✓" : ""} ›</TBtn> : null; })}</div>}
      {a.trace && Object.keys(a.trace).length > 0 && <div style={{ marginTop: 6 }}>{Object.entries(a.trace).filter(([, v]) => v).sort(([x], [y]) => x.localeCompare(y)).map(([n, v]) => <div key={n} style={{ fontSize: 13, lineHeight: 1.6 }}>
        <b style={{ color: v.skip ? C.sub : C.green }}>{n.split("@")[0] === "_" ? "흔적" : n.split("@")[0]} {v.skip ? "안 함" : "했어요 ✓"}</b> · {v.byName} {v.date ? md(v.date) : ""}{v.link ? <> · <Linked text={v.link} /></> : null}{v.note ? ` · ${v.note}` : ""}</div>)}</div>}</Banner>}

    {(a.sum || a.body) && <Card style={{ marginTop: 12, padding: "12px 14px" }}>
      {a.sum && <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, lineHeight: 1.6 }}>{a.sum}</div>}
      {a.body && <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: a.sum ? 6 : 0, maxHeight: 320, overflowY: "auto" }}><Linked text={a.body} /></div>}</Card>}
    {a.url && <div style={{ marginTop: 8 }}><a className="v2-lblink" href={a.url} target="_blank" rel="noopener">결과 전체 보기 ›</a></div>}

    {items.length > 0 && <><Head right={can && <span style={{ display: "inline-flex", gap: 6 }}><TBtn onClick={() => setPick(items.map((x) => x.n))}>모두 고르기</TBtn><TBtn onClick={() => setPick([])}>모두 풀기</TBtn></span>}>
      {can ? `승인할 번호 고르기 · ${pick.length}/${items.length}` : `제안 ${items.length}개${Array.isArray(a.pick) ? ` · 고른 것 ${a.pick.length}` : ""}`}</Head>
      <Card>{items.map((it, i) => <ItemCard key={it.n} it={it} cols={a.cols} card={actDef && actDef.card} on={pset.has(it.n)} can={can} onToggle={() => toggle(it.n)} last={i === items.length - 1} />)}</Card></>}
    {a.exec && <div style={{ fontSize: 13, color: C.sub, margin: "10px 2px 0", lineHeight: 1.6 }}><b style={{ color: C.ink }}>실행은 사람이</b> · {a.exec}</div>}
    {ho.length > 0 && a.state !== "no" && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "10px 2px 0", fontSize: 13, lineHeight: 1.6, color: a.handoffOff ? C.mute : C.sub }}>
      <span style={{ flex: "1 1 200px", minWidth: 0 }}>{a.handoffOff ? <><b style={{ color: C.mute }}>넘기기 꺼짐</b> · {a.handoffOff.byName || ""} · {handoffLabel(a.mate, a.act)}에게 안 넘어가요</>
        : <><b style={{ color: C.ink }}>→ {handoffLabel(a.mate, a.act)}에게 넘어가요</b> · {a.state === "ok" ? `최종 승인됨 · ${INBOX_DAYS}일 동안 그 AI 지시문 '넘겨받은 것'에` : "최종 승인되면 그 AI 지시문 '넘겨받은 것'에"}{handoffNeedsDone(a.mate, a.act) ? " · 담당이 [했어요]한(허락받은) 줄만" : ""}</>}</span>
      {(can || a.owner === cu.id || isMaster(cu)) && <TBtn onClick={() => A.askHandoff(a, !a.handoffOff)}>{a.handoffOff ? "다시 켜기" : "넘기기 끄기"}</TBtn>}</div>}

    {can && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0 0" }}>
      {canBack(a, cu) && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "back" ? "" : "back"); }}>{m.name}(AI)에게 다시</TBtn>}
      {canBack(a, cu) && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "more" ? "" : "more"); }}>더 만들기</TBtn>}
      {canRet(a, cu) && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "ret" ? "" : "ret"); }}>{nameOf(D.users, a.owner) || "담당"}님께 돌려보내기</TBtn>}
      <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "no" ? "" : "no"); }}>안 함</TBtn>
    </div>}
    {can && mode && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {mode === "no" && <div className="v2-chips">{REASONS.map((r) => <Chip key={r} on={txt === r} onClick={() => setTxt(r)}>{r}</Chip>)}</div>}
      {mode === "more" && <><div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>지금 것은 그대로 두고 더 만들어 달라고 해요 · 같은 건의 다음 판으로 다시 와요 · 매번 더 필요하면 AI 팀원 한 장 '횟수'에서</div>
        <div className="v2-chips" role="group" aria-label="더 만들 개수">{[1, 2, 3, 5, 10].map((k) => <Chip key={k} on={more === k} onClick={() => setMore(k)}>+{k}개</Chip>)}</div></>}
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} aria-label={mode === "no" ? "안 하는 이유" : mode === "more" ? "더 만들 때 바라는 점" : "고칠 점"} placeholder={mode === "back" ? `${m.name}에게: 무엇을 고치면 될까요? (AI가 다시 만들 때 읽어요)` : mode === "more" ? "바라는 점 (선택 · 예: 리뷰 많은 제품 위주로)" : mode === "ret" ? "무엇을 다시 보면 될까요?" : "이유 (선택)"} style={inp} />
      <div style={{ display: "flex", gap: 8 }}><Act onClick={() => setMode("")}>그만</Act>
        <Act onClick={() => go(() => (mode === "back" ? A.aiBack(a, txt) : mode === "more" ? A.aiBack(a, txt, more) : mode === "ret" ? A.aiRet(a, txt) : A.aiDrop(a, txt)))} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>{busy ? "보내는 중" : mode === "no" ? "안 하기로 하기" : mode === "more" ? `${more}개 더 만들어 달라기` : "보내기"}</Act></div>
    </div>}

    <div id="v2-ai-talk"><Head>대화</Head>
      <Thread D={D} cu={cu} A={A} notes={notes} itemId={aiNoteId(a.id)} ctx={{}} link={{ kind: "a", id: a.id }} hl={note} /></div>
    <Head right={<TBtn onClick={() => setShowLog(!showLog)}>{showLog ? "접기 ▴" : `기록 ${(a.log || []).length} ▾`}</TBtn>}>기록</Head>
    {showLog && <Card>{[...(a.log || [])].sort((x, y) => String(y.at || "").localeCompare(String(x.at || ""))).map((l, i, arr) =>
      <Row key={i} title={`${l.byName || l.by || ""} · ${LOG_W[l.act] || l.act}${l.to ? " " + (nameOf(D.users, l.to) || "") : ""}${l.pick ? ` · ${l.pick.join("·") || "고른 것 없음"}` : ""}${l.proxy ? ` (대신 · ${nameOf(D.users, l.proxy)})` : ""}`}
        sub={[l.at ? `${md(ymd(new Date(l.at)))} ${hm(l.at)}` : "", l.text || ""].filter(Boolean).join(" · ")} last={i === arr.length - 1} />)}</Card>}
  </Sheet>;
}

// ── AI 팀원 목록 ──
// 크루 집중 칸(이번 주 집중 · 매출 공식 칩) = pour-os/v2/settings/aicrew {focus:{크루 id: 칸}} · 관리자·그 크루 담당이 바꿈
function crewFocus(D, crewId) { const s = (D.settings || []).find((x) => (x.id || x._doc) === "aicrew"); return ((s && s.focus) || {})[crewId] || ""; }
export function AiTeamBody({ D, cu, A, open, admin }) {
  const master = isMaster(cu), mates = (D.ai && D.ai.mates) || {}, asks = (D.ai && D.ai.asks) || [];
  const ownsAny = (id) => { const o = (mates[id] && mates[id].owners) || {}; return Object.values(o).includes(cu.id); };
  const mineIds = liveCrews().flatMap((c) => c.members).map((x) => x.id).filter(ownsAny);   // AI 팀원 = 크루 (2026-10-14 "포리, 하루, 에코는 없어야지" → 기본 AI 팀원(원형) 칸 없앰 · 아침 루틴 = 여름) · 닫힌 크루 빼고 (2026-10-17)
  const [scope0, setScope] = useLocal(LS("ai-scope-" + cu.id), "");
  const scope = scope0 || (mineIds.length && !master ? "mine" : "all");
  const [bulk, setBulk] = useState(false), [stOpen, setStOpen] = useState("");   // 단계 미션 펼친 크루 (2026-10-17 사장님 AARRR 정의 · 읽기만)
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const myTurn = myTurnN(asks, cu);
  const gw = master ? goneWaits(asks) : [], [goneAsk, setGoneAsk] = useState(false);   // 쉬는 AI 승인 대기 정리 (2026-10-15 페르소나 시험)
  const dropGone = async () => { setGoneAsk(false); let k = 0; for (const a of gw) { if (await A.aiDrop(a, GONE_DROP)) k++; } A.toast(`쉬는 AI 승인 ${k}건을 '안 함'으로 정리했어요`); };
  const ownerL = (id, brand) => { const o = mateOwner(mates[id], brand, D.users); return o ? nameOf(D.users, o) : "담당 미정"; };
  const ownersL = (id) => { const ks = ownerKeys(id); if (ks.length < 2) return ownerL(id, ks[0] || ""); const names = [...new Set(ks.map((x) => ownerL(id, x)))]; return names.length === 1 ? names[0] : ks.map((x) => `${x ? brandL(x) : "기본"} ${ownerL(id, x)}`).join(" · "); };
  const show = (id) => scope === "all" || mineIds.includes(id);
  const nowL = new Date(), lateOf = (id) => asks.filter((x) => x.mate === id && x.state === "wait" && waitWd(x, nowL) >= LATE_WD).length;   // 평일 1일 넘게 기다린 것 (멈춤 감시 2026-10-17)
  const stat = (id) => { const s = mateStats(asks, id, since), lt = lateOf(id); return [s.wait ? `대기 ${s.wait}${lt ? ` (늦음 ${lt})` : ""}` : "", s.back ? `고치는 중 ${s.back}` : "", s.ok ? `이번 주 승인 ${s.ok}` : "", s.redo ? `다시 ${s.redo}` : ""].filter(Boolean).join(" · "); };
  const setFocus = async (crewId, slot) => { try { await fb.merge("settings", "aicrew", { focus: { [crewId]: slot }, at: new Date().toISOString(), by: cu.id, byName: cu.name }); } catch (e) { console.error("[v2] 이번 주 집중 저장 실패:", e); A.toast("저장 실패 · 인터넷 연결을 확인해 주세요"); } };
  const users = activeUsers(D.users);
  const OwnerPick = ({ id, brand }) => { const cur = mateOwner(mates[id], brand, D.users);
    return <select value={cur} onClick={(e) => e.stopPropagation()} onChange={(e) => A.mateOwnerSet(id, brand || "_", e.target.value)} aria-label={`${(mateOf(id) || {}).name} 담당${brand ? " " + brandL(brand) : ""}`} style={{ ...inp, width: "auto", maxWidth: 150, padding: "6px 8px", fontSize: 13 }}>
      <option value="">담당 미정</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>; };
  const plan = useMemo(() => asidePlanOf(D), [D.ai, D.users]), myG = plan.find((g) => g.owner === cu.id), noneG = plan.find((g) => !g.owner);
  const asideL = (x) => { const p = x.board ? planOf(plan, x.board) : null, b = p && boardOf(x.board); return p ? `Aside ${runWord({ ...((b && b.run) || {}), dow: (b && b.run && b.run.dow) || [1, 2, 3, 4, 5], t: p.t })} · ${PC_L(D, p.owner, cu)}` : ""; };   // 크루 보드 Aside 루틴 (2026-10-14 · 2026-10-15 담당 PC)
  const mateRow = (x, last, color) => { const ms = mates[x.id] || {}, rules = (ms.rules || []).filter((r) => !r.off).length;
    const picks = bulk && master && !x.admin ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>{ownerKeys(x.id).map((bb) =>
      <label key={bb || "_"} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, fontWeight: 700 }}>{bb ? brandL(bb) : mateBrands(x.id).length ? "기본" : "담당"}<OwnerPick id={x.id} brand={bb} /></label>)}</div> : null;
    return <div key={x.id} style={{ borderLeft: color ? `4px solid ${color}` : "none" }}><Row title={`${x.name} · ${x.role}`} tag={x.admin ? "관리자 자리" : x.routine ? "아침 루틴" : null} sub={[x.admin ? "원가·제조사 일이라 업무OS 승인에 안 올림" : ownersL(x.id), x.routine ? "평일 06:50 블로그·재배포" : "", rules ? `규칙 ${rules}` : ""].filter(Boolean).join(" · ")} sub2={[asideL(x), stat(x.id)].filter(Boolean).join(" · ") || null} onClick={() => open({ type: "aiMate", id: x.id })} right={picks ? null : <span style={{ color: C.navy, fontWeight: 800 }}>›</span>} below={picks} last={last} /></div>; };
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: 320 }}><Seg items={[["mine", `내가 맡은 AI ${mineIds.length}`], ["all", "모두"]]} value={scope} onChange={setScope} /></div>
      {master && <TBtn onClick={() => setBulk(!bulk)} aria-pressed={bulk}>{bulk ? "담당 정하기 끝" : "담당 한꺼번에 정하기"}</TBtn>}
    </div>
    {/* 맡긴 일(2026-10-15 "ai팀원에게 업무요청을 별도로해서 진행도 가능") — 누구나 · 보드가 있는 크루 팀원에게 */}
    {(() => { const mine = ((D.ai && D.ai.reqs) || []).filter((r) => r.by === cu.id && (r.state === "open" || r.state === "doing")).length;
      // AI 크루 보고(2026-10-15 "리드에게 매주 금요일 보고 · 크루 칸별") — 이번 기간 · 담당 확인 · 보냄
      const cfg = cycleOf(D), p = periodOf(cfg, ymd(new Date())), rc = repCrews()[0], rp = rc ? ((D.ai && D.ai.reports) || {})[repId(rc.id, p)] : null, sl = rc ? repSlots(rc.id) : [];
      const dn = sl.filter((m) => ["done", "sent"].includes(secState(rp, m.id))).length, sn = sl.filter((m) => secState(rp, m.id) === "sent").length;
      return <Card style={{ marginTop: 10 }}><Row title="AI에게 업무 맡기기" tag={mine ? `진행 ${mine}` : null} sub="무엇을 · 몇 개 · 언제까지 → 담당 PC Aside 가 한 시간 안에 · 결과는 승인으로 와요" onClick={() => open({ type: "aiReq" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={!rc} />
        {rc && <Row title={`AI 크루 보고 · ${CYCLE_L[p.cycle]}`} tag={sn === sl.length ? "보냄" : null} sub={`${periodL(p)} · ${dueL(p)} · 담당 확인 ${dn}/${sl.length} · 보냄 ${sn}/${sl.length}`} onClick={() => open({ type: "aiReport", crew: rc.id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last />}</Card>; })()}
    <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "8px 2px 0" }}>AI가 결과를 올리면 할 일마다 정한 승인 길로 가요 — 점검·분석·장부는 담당에서 끝 · 밖으로 나가는 것은 리드까지 · 광고비·원가·판매가는 본부장까지 · 실제 반영은 늘 사람이 해요 · 실행 업무엔 번호마다 흔적{myTurn ? ` · 지금 내 차례 ${myTurn}건` : ""} · <a className="v2-lblink" href={HUB_MANUAL_URL} target="_blank" rel="noopener">매뉴얼 보기 ›</a> · <a className="v2-lblink" href={HUB_ADS_URL} target="_blank" rel="noopener">광고 운영 ›</a></p>
    {gw.length > 0 && <Card style={{ marginTop: 10 }}>
      <Row title={`쉬는 AI 승인 대기 ${gw.length}건`} tag="정리" sub={`${[...new Set(gw.map((a) => (mateOf(a.mate) || {}).name || a.mateName || a.mate))].join("·")} · 2026-10-14부터 쉬어요 · 같은 일은 B2C 크루 여름이 매일 새로 올려요 · '확인할 것'엔 안 떠요`} last={false} />
      {gw.slice(0, 6).map((a) => <Row key={a.id} title={a.title} sub={`${a.createdAt ? md(ymd(new Date(a.createdAt))) : ""} 올라옴 · 담당 미정 · 열어서 승인할 수도 있어요`} onClick={() => open({ type: "aiask", id: a.id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={false} />)}
      <div style={{ padding: "10px 14px", background: "#fff" }}><TBtn tone="red" onClick={() => setGoneAsk(true)}>모두 '안 함'으로 정리 ({gw.length}건)</TBtn></div>
    </Card>}
    {goneAsk && <Ask title="쉬는 AI 승인 정리" body={`${gw.length}건을 '안 함'으로 정리할까요?\n이유: ${GONE_DROP}\n기록이 남고, 한 건씩 열어 보면 무엇이었는지 그대로 있어요.`} yes="정리" onNo={() => setGoneAsk(false)} onYes={dropGone} />}
    {(myG || (master && noneG)) && <Card style={{ marginTop: 10 }}>
      {myG && <Row title={`내 PC Aside · ${myG.runs.map((r) => `${(mateOf(r.board.mate) || {}).name} ${r.t}`).join(" · ")}`} sub="세팅 · 지금 돌리기 · 고칠 것 확인 — 담당마다 자기 PC 에서 동시에 돌아요" onClick={() => open({ type: "aiSetup" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={!(master && noneG)} />}
      {master && noneG && <Row title={`담당 미정 크루 ${noneG.runs.length}명 · 관리자 PC 에서`} sub={`${noneG.runs.map((r) => (mateOf(r.board.mate) || {}).name).join(" · ")} · 담당을 정하면 그 사람 PC 로 옮겨가요`} onClick={() => open({ type: "aiSetup", owner: "" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last />}
    </Card>}
    {scope === "mine" && !mineIds.length && <Card style={{ marginTop: 10 }}><Empty>아직 맡은 AI 팀원이 없어요 · 관리자가 담당을 정하면 여기에 보여요</Empty></Card>}
    {liveCrews().map((c) => { const list = c.members.filter((x) => show(x.id)); if (!list.length) return null; const f = crewFocus(D, c.id), canF = master || c.members.some((x) => ownsAny(x.id));
      return <section key={c.id}>
        <Head right={c.draft ? <Pill color={C.sub} bg="#F1F2F6">초안</Pill> : null}>{c.name}</Head>
        <div style={{ fontSize: 12.5, color: C.sub, margin: "-4px 2px 8px", lineHeight: 1.6 }}>{servesL(c)}{c.note ? ` · ${c.note}` : ""}</div>
        <div className="v2-filterrow" style={{ marginBottom: 8 }} aria-label={`${formulaHead(c)} 공식 · 이번 주 집중`}><span style={{ fontSize: 13, fontWeight: 800, color: C.ink, flex: "0 0 auto" }}>{formulaHead(c)} =</span>
          {c.formula.map((k, i) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>{i > 0 && <span style={{ color: C.mute }}>{formulaSep(c)}</span>}
            <Chip on={f === k} onClick={canF ? () => setFocus(c.id, f === k ? "" : k) : undefined} style={{ padding: "6px 11px", cursor: canF ? "pointer" : "default" }}>{k}</Chip></span>)}</div>
        {f && <div style={{ fontSize: 12.5, color: C.navy, fontWeight: 800, margin: "0 2px 8px" }}>이번 주 집중 · {f}{c.stages && c.stages[f] ? ` (${c.stages[f].goal})` : ""} — 가장 약한 칸 하나만 올려도 매출이 달라져요</div>}
        {c.stages && <div style={{ margin: "0 2px 8px" }}>
          <TBtn v="plain" onClick={() => setStOpen(stOpen === c.id ? "" : c.id)} aria-expanded={stOpen === c.id} style={{ padding: 0, minHeight: 28, fontSize: 12.5 }}>{stOpen === c.id ? "단계 미션 접기 ▴" : "단계 미션 보기 ▾ · 사장님 정의"}</TBtn>
          {stOpen === c.id && <div style={{ display: "grid", gap: 6, marginTop: 4 }}>{c.formula.map((k) => { const sg = c.stages[k], who = c.members.filter((x) => x.slot === k).map((x) => x.name).join("·");
            return sg ? <div key={k} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, padding: "9px 11px", background: "#F7F8FB", border: `1px solid ${C.line}`, borderRadius: 10, wordBreak: "keep-all" }}>
              <b style={{ color: C.ink }}>{k}</b> · {sg.goal}{who ? <span style={{ color: C.sub }}> · {who}</span> : null}<div>{sg.mission}</div><div style={{ color: C.mute }}>넘겨줄 것 {sg.to} · 숫자 {sg.kpi}</div></div> : null; })}</div>}
        </div>}
        <Card>{list.map((x, i) => mateRow(x, i === list.length - 1, f && x.slot === f ? C.navy : x.color))}</Card>
      </section>; })}
    {/* 기본 AI 팀원(원형) 칸은 없앰 (2026-10-14 사장님 "포리, 하루, 에코는 없어야지") — 크루가 AI 팀원 · 블로그·재배포 아침 루틴 = 여름 · 옛 하루·포리·에코 결과는 '확인할 것'·승인 한 장에서 그대로 */}
    {/* 닫힌 크루 (2026-10-17 사장님 "스토어 b2c ai크루만 나타내 … 미생성으로 표시해서 별도로 크루 설정해서 업무 정리해야한다는것만") — 이름 한 줄씩 · 크루원·보드는 안 보임 · 정의·옛 기록은 그대로 */}
    {scope === "all" && closedCrews().length > 0 && <section>
      <Head>다른 채널 크루</Head>
      <Card>{closedCrews().map((c, i, arr) => <Row key={c.id} title={c.name} tag={CLOSED_L} sub={(c.closed && c.closed.why) || "그 채널에서 크루를 따로 설정해 업무 정리"} last={i === arr.length - 1} />)}</Card>
    </section>}
    {admin && <p className="a-hint">담당 = AI 결과를 먼저 보고 승인하는 사람 · 비어 있으면 관리자 누구나 · 상급자는 [사람] 탭에서 · Aside 결과 올리기 = <a href={HUB_CREW_URL} target="_blank" rel="noopener">마케팅 허브 › AI 크루 결과 올리기</a></p>}
  </>;
}
export function AiTeamSheet({ D, cu, A, open, onBack, onClose }) {
  return <Sheet title="AI 팀원" onBack={onBack} onClose={onClose}><AiTeamBody D={D} cu={cu} A={A} open={open} /></Sheet>;
}

// 보드 숫자 (pour-os/v2/aiboards/{보드 id} · 허브 crew.html 이 씀 · 읽기만)
function useBoardVals(boardId) {
  const [v, setV] = useState(null);
  useEffect(() => { if (!boardId) return undefined; return fb.listen("aiboards", ["board", "==", boardId], (x) => setV(x[0] || {}), (e) => { console.warn("[v2] 보드 숫자 못 읽음:", e); setV({}); }); }, [boardId]);
  return v;
}
// 브랜드별 설계 (2026-10-17 사장님 6-1A "브랜드 별 명확하게 설계 필요해 · 내가 정리해서 넣고 싶은데 자체 수정해서 설정") — 할 일 펼친 칸
//   쓰는 사람 = 관리자 · 그 AI 담당 · 그 할 일 담당 · 저장하면 crew.html 지시문 '■ 브랜드별 설계' → 다음 실행부터 AI 가 그대로 따름
//   설계가 필요한 할 일(a.design · 우주 G)은 늘 보이고, 다른 할 일은 글이 있거나 쓸 수 있는 사람에게만 [설계 쓰기]
function DesignBox({ D, cu, A, b, a, doc }) {
  const [ed, setEd] = useState(""), [txt, setTxt] = useState(""), [busy, setBusy] = useState(false);
  const brands = (() => { const c = crewOf(b.mate), bs = c ? [...new Set(c.serves.map((x) => x.brand))] : []; return bs.length ? bs : [b.brand || "grohome"]; })();
  const raw = ((doc && doc.design) || {})[a.c] || {}, shown = designOf(doc && doc.design, a.c), byB = Object.fromEntries(shown.map((x) => [x.brand, x]));
  const can = isMaster(cu) || Object.values((doc && doc.owners) || {}).includes(cu.id) || actOwner(doc, b.brand, a.c, D.users) === cu.id;
  if (!a.design && !shown.length && !can) return null;
  const bad = designBad(txt), save = async (bb) => { if (busy) return; setBusy(true); try { if (await A.mateDesign(b.mate, a.c, bb, txt, (raw[bb] && raw[bb].text) || "")) setEd(""); } finally { setBusy(false); } };
  return <div style={{ margin: "0 0 10px", padding: "10px 12px", background: a.design && !shown.length ? "#FFF8EC" : "#F6F7FA", borderRadius: 10 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}><b style={{ color: C.ink }}>브랜드별 설계</b><span style={{ fontSize: 12, color: C.mute }}>사람이 정함 · AI 가 다음 실행부터 그대로 따라요</span></div>
    {a.design && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>적을 것: {a.design.replace(/^[^—]*—\s*/, "")}{!shown.length ? " · 아직 없으면 AI가 브랜드별 초안을 올려요" : ""}</div>}
    {brands.map((bb) => { const x = byB[bb], on = ed === bb;
      return <div key={bb} style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 13, color: C.navy }}>{BRAND_L[bb] || bb}</b>
          <span style={{ fontSize: 12, color: C.mute, flex: 1, minWidth: 0 }}>{x ? `${x.byName || ""}${x.at ? ` · ${md(ymd(new Date(x.at)))}` : ""}` : "아직 없음"}</span>
          {can && !on && <TBtn onClick={() => { setTxt((raw[bb] && raw[bb].text) || ""); setEd(bb); }}>{x ? "고치기" : "설계 쓰기"}</TBtn>}</div>
        {!on && x && <div style={{ fontSize: 13, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }}>{x.text}</div>}
        {on && <div style={{ marginTop: 6 }}>
          <textarea value={txt} onChange={(e) => setTxt(e.target.value.slice(0, DESIGN_MAX))} rows={6} aria-label={`${a.c} ${BRAND_L[bb] || bb} 브랜드별 설계`}
            placeholder={"예)\n받은 다음 날 · 카카오 알림톡 · 시공 가이드 영상 링크 + 이것만 조심 3줄\n7일 · 알림톡 · 잘 되셨어요? + 사진 후기 혜택\n30일 · 친구톡 · 다음 작업 제안 하나"}
            style={{ ...inp, width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.55, resize: "vertical" }} />
          {bad && <div style={{ fontSize: 12.5, color: C.red, marginTop: 4 }}>원가·마진·제조사·공급가는 AI에게 보여 주지 않아요 · 그 줄을 빼 주세요</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}><TBtn v="solid" disabled={busy || bad} onClick={() => save(bb)}>{txt.trim() ? "저장" : "비우고 저장"}</TBtn><TBtn onClick={() => setEd("")}>취소</TBtn>
            <span style={{ fontSize: 12, color: C.mute }}>{txt.length}/{DESIGN_MAX}</span></div></div>}
      </div>; })}
  </div>;
}
function BoardView({ D, cu, A, b, open, asks, doc }) {
  const v = useBoardVals(b.id), vals = (v && v.metrics) || {};
  const [openA, setOpenA] = useState("");
  // 할 일 설정 (2026-10-15): 담당(관리자) · 본부장 승인(관리자) · 반복 실행 짝(관리자·AI 담당) — 짝이면 실행 업무 [했어요]마다 그 반복 +1 (KPI)
  const master = isMaster(cu), mine = Object.values((doc && doc.owners) || {}).includes(cu.id), users = activeUsers(D.users), akItems = ((D.ak && D.ak.items) || []);
  const ownL = (c) => { const x = actOwner(doc, b.brand, c, D.users); return x ? nameOf(D.users, x) : "담당 미정"; };
  const hqL = (a) => hqOf({ board: b.id, act: a.c, exec: execOf(a), hq: a.hq }, doc);   // 외주 기간 광고 할 일 = 실행 없음 → 표시 없음
  // 승인 길 (2026-10-17 사장님 1A) — 담당에서 끝 · 리드까지 · 본부장까지(이유) · 관리자가 할 일마다 바꿈(aimates.actPath)
  const pthOf = (a) => pathOf({ board: b.id, act: a.c, exec: execOf(a), hq: a.hq }, doc), pthDef = (a) => pathDef({ board: b.id, act: a.c, exec: execOf(a), hq: a.hq });
  const pthL = (a) => { const p = pthOf(a), why = p === "hq" ? hqL(a) : ""; return `${PATH_L[p]}${why ? `(${why}${a.hqIf ? ` · ${a.hqIf} 칸이 있을 때` : ""})` : ""}`; };
  const pthVal = (a) => { const ov = ((doc && doc.actPath) || {})[a.c], old = ((doc && doc.actHq) || {})[a.c]; return ov || (old === true ? "hq" : old === false ? "lead" : ""); };
  const akL1 = (id) => { if (isFxKey(id)) { const t = (D.tasks || []).find((x) => x.id === fxIdOf(id)); return t ? t.title : ""; } const it = akItems.find((x) => x.id === id); return it ? it.name : ""; };
  const akL = (c) => akKeys(((doc && doc.actAk) || {})[c]).map(akL1).filter(Boolean).join(" · ");   // 짝 여러 개 (2026-10-17)
  return <>
    <Head>{b.title}</Head>
    <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.65, margin: "-4px 2px 8px" }}>{b.desc}</div>
    <Card>{b.metrics.map((m, i) => { const x = vals[m.k] || null, val = x ? x.v : null, pct = val != null ? metricPct(m, val) : 0, ok = metricOk(m, val);
      return <div key={m.k} style={{ padding: "10px 14px", borderBottom: i === b.metrics.length - 1 ? "none" : `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: C.text }}>{m.l}</span>
          <b style={{ fontSize: 15, color: ok ? C.green : C.ink, fontVariantNumeric: "tabular-nums" }}>{val != null ? fmtMetric(m, val) : "—"}{ok ? " ✓" : ""}</b></div>
        <div style={{ height: 5, borderRadius: 3, background: "#E8EBF2", margin: "6px 0 4px", overflow: "hidden" }}><div style={{ width: `${Math.round((pct || 0) * 100)}%`, height: "100%", background: ok ? C.green : C.navy }} /></div>
        <div style={{ fontSize: 12, color: C.mute }}>기준 {fmtMetric(m, m.base)} → 목표 {fmtMetric(m, m.target)}{m.dir === "down" ? " (줄이기)" : ""} · {x && x.date ? `${md(x.date)} 값` : "아직 값 없음"} · {m.src}</div>
      </div>; })}</Card>
    <Head>할 일 {b.actions[0].c}~{b.actions[b.actions.length - 1].c}</Head>
    <Card>{b.actions.map((a, i) => { const last = asks.filter((x) => x.board === b.id && x.act === a.c).sort((p, q) => String(q.createdAt || "").localeCompare(String(p.createdAt || "")))[0];
      return <div key={a.c} style={{ borderBottom: i === b.actions.length - 1 ? "none" : `1px solid ${C.line}` }}>
        <Row title={`${a.c} · ${a.t}`} tag={a.admin ? "관리자 자리" : last ? ASK_STATE_L[last.state] : null} sub={[a.admin ? "" : `담당 ${ownL(a.c)}`, a.admin ? "" : `승인 ${pthL(a)}`, a.when, akL(a.c) ? `반복 '${akL(a.c)}'` : ""].filter(Boolean).join(" · ")} sub2={last ? `최근 ${last.run ? md(last.run) : ""} · ${last.title}` : null}
          onClick={() => setOpenA(openA === a.c ? "" : a.c)} right={<span style={{ color: C.navy, fontWeight: 800 }}>{openA === a.c ? "▴" : "▾"}</span>} last />
        {openA === a.c && <div style={{ padding: "0 14px 12px", fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
          {a.admin ? <div style={{ color: C.text }}>{a.admin}</div> : <>
            {(master || mine) && <div className="v2-actset" style={{ display: "grid", gap: 8, margin: "0 0 10px", padding: "10px 12px", background: "#F6F7FA", borderRadius: 10 }}>
              {master && <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ color: C.ink, minWidth: 74 }}>이 할 일 담당</b>
                <select value={((doc && doc.actOwners) || {})[a.c] || ""} onChange={(e) => A.mateActSet(b.mate, "actOwners", a.c, e.target.value)} aria-label={`${a.c} 할 일 담당`} style={{ ...inp, width: "auto", maxWidth: 180, padding: "6px 8px", fontSize: 13 }}>
                  <option value="">AI 담당 그대로 ({nameOf(D.users, mateOwner(doc, b.brand, D.users)) || "미정"})</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
              {master && <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ color: C.ink, minWidth: 74 }}>승인 길</b>
                <select value={pthVal(a)} onChange={(e) => A.mateActSet(b.mate, "actPath", a.c, e.target.value || null)} aria-label={`${a.c} 승인 길`} style={{ ...inp, width: "auto", maxWidth: 240, padding: "6px 8px", fontSize: 13 }}>
                  <option value="">기본 ({PATH_L[pthDef(a)]}{pthDef(a) === "hq" && a.hq ? ` · ${a.hq}` : ""})</option><option value="owner">담당에서 끝</option><option value="lead">리드까지</option>{execOf(a) && <option value="hq">본부장까지</option>}</select></label>}
              {pairable(a) && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ color: C.ink, minWidth: 74 }}>반복 실행 짝{a.report ? " (승인 = 그날 체크)" : ""}</b>
                <RtMulti D={D} value={((doc && doc.actAk) || {})[a.c]} onChange={(ks) => A.mateActSet(b.mate, "actAk", a.c, ks)} label={`${a.c} 반복 실행 짝`} /></div>}
              <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5 }}>담당 = 승인 첫 단계·실행 업무 받는 사람 · 승인 길 = 안에서 보는 점검·분석·목록·장부는 담당에서 끝 · 밖으로 나가는 것은 리드까지 · 광고비·원가·판매가는 본부장까지 · 반복 실행 짝 = 실행 업무 번호마다 [했어요]가 그 반복에 +1 (KPI)</div></div>}
            <DesignBox D={D} cu={cu} A={A} b={b} a={a} doc={doc} />
            <div><b style={{ color: C.ink }}>상황</b> · {a.w}</div>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>{a.s.map((s, k) => <li key={k} style={{ marginTop: 2 }}>{s}</li>)}</ol>
            {a.cols.length > 0 && <div style={{ marginTop: 6 }}><b style={{ color: C.ink }}>올리는 표</b> · {a.cols.join(" · ")}</div>}
            {a.report === "ads" && <div style={{ marginTop: 6 }}>매일 08:30 Aside 광고 일일 보고서 · <a className="v2-lblink" href={HUB_ADS_URL} target="_blank" rel="noopener">광고 운영 보고서 ›</a></div>}
            {last && <div style={{ marginTop: 8 }}><TBtn onClick={() => open({ type: "aiask", id: last.id })}>최근 결과 보기 ›</TBtn></div>}</>}
        </div>}
      </div>; })}</Card>
    {(() => { const mo = movedOut(b.mate), mi = movedIn(b.mate); if (!mo.length && !mi.length) return null;   // 2026-10-17 AARRR 정리로 옮긴 할 일 (옛 승인·짝 기록은 옛 자리 그대로)
      return <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "8px 2px 0" }}>옮긴 할 일 (2026-10-17 AARRR 정리){mo.length ? ` · 나감 ${mo.map((x) => `${x.c} → ${x.name} ${x.to.c}`).join(", ")}` : ""}{mi.length ? ` · 들어옴 ${mi.map((x) => `${x.c} ← ${x.name} ${x.from.c}`).join(", ")}` : ""} · 지난 승인·짝 기록은 옛 자리 그대로</div>; })()}
    {b.checklist && <><Head>{b.checklist.title}</Head><Card>{(b.checklist.items || []).map((x, i, arr) => <Row key={i} title={x.t} sub={x.d ? `${x.d} 마감` : null} last={i === arr.length - 1} />)}</Card>
      <p style={{ fontSize: 12, color: C.mute, margin: "6px 2px 0" }}>체크·담당은 업무OS 신제품 프로젝트에서 해요 (보기만)</p></>}
  </>;
}

export function AiMateSheet({ D, cu, A, open, onBack, onClose, id }) {
  const m = mateOf(id);
  const [rule, setRule] = useState(""), [offOpen, setOffOpen] = useState(false), [doneN, setDoneN] = useState(6);
  if (!m) return <Sheet title="AI 팀원" kind="AI 팀원" onBack={onBack} onClose={onClose}><Empty>이 AI 팀원을 찾지 못했어요</Empty></Sheet>;
  const c = crewOf(id), b = m.board ? boardOf(m.board) : null, doc = ((D.ai && D.ai.mates) || {})[id] || {}, asks = ((D.ai && D.ai.asks) || []).filter((x) => x.mate === id);
  const master = isMaster(cu), brands = mateBrands(id), owners = ownerKeys(id).map((bb) => ({ bb, uid: mateOwner(doc, bb, D.users) }));   // 아침 루틴 팀원 = 기본(브랜드 섞인 결과) + 브랜드별
  const canRule = master || owners.some((o) => o.uid === cu.id);
  const plan = asidePlanOf(D), pl = b ? planOf(plan, b.id) : null, qs = qtyDefs(id);   // Aside 담당 PC · 횟수 (2026-10-15)
  const since = new Date(Date.now() - 7 * 864e5).toISOString(), st = mateStats(asks, id, since), rep = new Set(repeatNotes(st.notes).map((x) => x.text));
  // NPS (2026-10-18 사장님 2-1A) — 이 AI 의 NPS 유선 조사 할 일(바람 C) 흔적 [했어요] 점수 · 최근 30일 (crew.html 지시문 · 볼트와 같은 계산)
  const npsOn = !!b && !(c && c.closed) && (b.actions || []).some((a) => isNpsAct(id, a.c)), npsR = npsOn ? npsFromTraces(asks, ymd(new Date(Date.now() - 29 * 864e5)), ymd(new Date())) : null;
  const open1 = asks.filter((x) => x.state === "wait" || x.state === "back").sort((p, q) => String(q.updatedAt || "").localeCompare(String(p.updatedAt || "")));
  const done = asks.filter((x) => x.state === "ok" || x.state === "no").sort((p, q) => String(q.updatedAt || "").localeCompare(String(p.updatedAt || "")));
  const rules = (doc.rules || []).filter((r) => !r.off), off = (doc.rules || []).filter((r) => r.off);
  const chainFrom = (uid) => { const out = []; let cur = uid; for (let k = 0; k < 5 && cur; k++) { const bb = bossOf(cur, D.users); if (!bb || out.includes(bb) || bb === uid) break; out.push(bb); cur = bb; } return out.map((x) => nameOf(D.users, x)); };
  const users = activeUsers(D.users);
  const askRow = (x, last) => <Row key={x.id} tag={x.state === "wait" ? (x.ret ? "수정 요청" : x.step > 0 ? `${x.step + 1}단계` : "담당 단계") : ASK_STATE_L[x.state]} tagTone={x.ret ? "red" : null} title={x.title}
    sub={[brandL(x.brand), x.run ? md(x.run) : "", x.state === "wait" ? (x.to ? `${nameOf(D.users, x.to)} 차례` : "관리자 누구나") : x.state === "ok" ? `최종 ${x.okByName || ""}` : x.state === "no" ? `안 함 · ${x.noReason || ""}` : "AI가 고치는 중"].filter(Boolean).join(" · ")}
    onClick={() => open({ type: "aiask", id: x.id })} last={last} />;
  return <Sheet title={m.name} kind="AI 팀원" head={`${m.name} · ${m.role}`} path={c ? c.name : "기본 AI 팀원 (원형)"} onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7, marginTop: 12 }}>
      {m.kpi && <div>KPI · <b style={{ color: C.ink }}>{m.kpi}</b></div>}
      {stageOf(id) && <div>단계 미션 · <b style={{ color: C.ink }}>{m.slot}</b> ({stageOf(id).goal}) — {stageOf(id).mission}</div>}
      {npsOn && <div>NPS (최근 30일 · [했어요]에 남긴 점수) · <b style={{ color: C.ink }}>{npsR ? npsLine(npsR) : "아직 남긴 점수 없음"}</b></div>}
      {m.routine && <div>{m.routine}</div>}
      {b && pl && <div>Aside 루틴 · {runWord({ ...b.run, t: pl.t })} · {PC_L(D, pl.owner, cu)} · 보드 지표·할 일 → 이 승인으로 · <a className="v2-lblink" href={`${HUB_CREW_URL}#${b.id}`} target="_blank" rel="noopener">허브 AI 크루 결과 올리기 ›</a></div>}
      {GONE[id] && <div style={{ color: C.text }}>2026-10-14부터 쉬어요 · 이 일은 B2C 크루 {(mateOf(GONE[id]) || {}).name} 몫이에요 · 이미 올라온 결과는 그대로 승인·안 함</div>}
      {c && c.closed && <div style={{ color: C.text }}><b>{CLOSED_L}</b> · {c.closed.why} · 지금은 Aside·보드가 안 돌아요 (정의·옛 기록은 그대로)</div>}
      {c && <div>일하는 곳 · {servesL(c)}</div>}
      {m.from && m.from.length > 0 && <div>원형 · {m.from.map((f) => (mateOf(f) || {}).name || f).join(" · ")} <span style={{ color: C.mute }}>(파생 · 짐작)</span></div>}
      {m.admin && <div style={{ color: C.text }}>관리자 자리 일(원가·제조사)이라 업무OS 승인으로 올리지 않아요 · 마진 대시보드에서</div>}
    </div>
    {m.routine && <RoutineToday D={D} m={m} />}
    {b && pl && canRule && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      <CopyText text={asideLaunch(b, pl.t)} label="지금 돌리기 — Aside 글 복사" solid />
      <TBtn onClick={() => open({ type: "aiSetup", owner: pl.owner })}>{pl.owner === cu.id ? "내 PC 세팅 ›" : "그 PC 세팅 ›"}</TBtn></div>}
    {canReq(id) && <><Head right={<TBtn v="solid" onClick={() => open({ type: "aiReq", mate: id })}>업무 맡기기</TBtn>}>맡긴 일</Head>
      <ReqRows D={D} cu={cu} A={A} open={open} rows={((D.ai && D.ai.reqs) || []).filter((r) => r.mate === id)} empty={`${m.name}(AI)에게 따로 맡긴 일이 없어요 · [업무 맡기기]로 보드 일과 별도로 맡겨요`} /></>}
    {/* 참고 레퍼런스 (2026-10-17 사장님 4A) — 사람이 이 AI 핏을 남긴 레퍼런스 = 다음 루틴 지시문 '■ 참고 레퍼런스' */}
    {canReq(id) && <Card style={{ marginTop: 10 }}><Row title={`참고 레퍼런스 ${refCount(D, { fit: id })}`} sub={`사람이 '${m.name} 핏'(어느 부분만 쓸지)을 남긴 것만 다음 루틴부터 그 부분만 참고해요 · 최근 8개`} onClick={() => open({ type: "refs", f: { fit: id } })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last /></Card>}
    <Head>담당 · 승인 길</Head>
    <Card>{owners.map((o, i) => <Row key={o.bb || "_"} title={`담당${o.bb ? ` (${brandL(o.bb)})` : brands.length ? " (기본)" : ""} · ${o.uid ? nameOf(D.users, o.uid) : "미정"}`}
      sub={[!o.bb && brands.length ? "아침 루틴 원고처럼 브랜드가 섞인 결과 · 브랜드 담당을 안 정한 브랜드" : "", o.uid ? [`${m.name}(AI) → ${nameOf(D.users, o.uid)}`, ...chainFrom(o.uid)].join(" → ") : "정할 때까지 관리자 누구나 승인해요"].filter(Boolean).join(" · ")}
      right={master && !m.admin ? <select value={o.uid} onChange={(e) => A.mateOwnerSet(id, o.bb || "_", e.target.value)} aria-label={`담당 바꾸기${o.bb ? " " + brandL(o.bb) : ""}`} style={{ ...inp, width: "auto", maxWidth: 140, padding: "6px 8px", fontSize: 13 }}>
        <option value="">미정</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : null} last={i === owners.length - 1} />)}</Card>
    {b && !(c && c.closed) && <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "6px 2px 0" }}>할 일마다 승인 길 · {pathGroupsL(pathGroups(b, doc))} — 아래 할 일을 펼치면 {master ? "바꿀 수 있어요" : "보여요"}</div>}
    {/* 아침 루틴 원고 → 반복 실행 짝 (2026-10-16) — 원고 승인 뒤 실행 업무 [했어요](발행 링크) = 그 반복 실행 +1 · 보드 할 일 짝은 아래 할 일마다 */}
    {m.routine && canRule && <><Head>아침 루틴 원고 → 반복 실행</Head>
      <Card style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ color: C.ink, minWidth: 74, fontSize: 13.5 }}>반복 실행 짝</b>
        <RtMulti D={D} value={(doc.actAk || {})[NO_ACT]} onChange={(ks) => A.mateActSet(id, "actAk", NO_ACT, ks)} label="아침 루틴 반복 실행 짝" /></div>
        <div style={{ fontSize: 12, color: C.mute, marginTop: 6, lineHeight: 1.5 }}>원고를 승인하고 실행 업무에서 [했어요](발행 링크) = 그 반복 실행 +1 · 보드 할 일은 아래 할 일마다 정해요</div></Card></>}

    <Head>이번 주 (7일)</Head>
    <div className="a-stat" role="list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 }}>
      {[["대기", st.wait], ["고치는 중", st.back], ["승인", st.ok], ["AI에게 다시", st.redo], ["돌려받음", st.ret], ["안 함", st.no], ["승인율", st.rate == null ? "-" : st.rate + "%"]].map(([l, v]) =>
        <div key={l} role="listitem" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 10px" }}><b style={{ display: "block", fontSize: 17, color: C.ink }}>{v}</b><span style={{ fontSize: 12, color: C.sub }}>{l}</span></div>)}
    </div>

    {open1.length > 0 && <><Head>승인 기다리는 것 {open1.length}</Head><Card>{open1.map((x, i) => askRow(x, i === open1.length - 1))}</Card></>}

    <Head>고칠 점 · 확정 규칙</Head>
    {st.notes.length > 0 && <Card>{st.notes.map((x, i) => <Line key={i} tag={rep.has(x.text) ? "또 나옴" : null} text={x.text} sub={`${x.byName || ""} · ${x.act === "back" ? "AI에게 다시" : x.act === "ret" ? "돌려보냄" : "안 함"} · ${ago(x.at)}`}
      right={canRule ? <Act onClick={() => A.mateRule(id, x.text)}>규칙으로</Act> : null} last={i === st.notes.length - 1} />)}</Card>}
    <div style={{ fontSize: 12.5, color: C.sub, margin: "8px 2px", lineHeight: 1.6 }}>같은 지적이 두 번 나오면 규칙으로 남겨 주세요 · AI가 실행 전마다 읽어요</div>
    <Card>{rules.length === 0 ? <Empty>아직 확정 규칙이 없어요</Empty> : rules.map((r, i) => <Line key={r.id} text={r.text} sub={`${r.byName || ""} · ${r.at ? md(ymd(new Date(r.at))) : ""}`} right={canRule ? <Act onClick={() => A.mateRuleOff(id, r.id, true)}>끄기</Act> : null} last={i === rules.length - 1} />)}</Card>
    {canRule && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><input value={rule} onChange={(e) => setRule(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && rule.trim()) { A.mateRule(id, rule); setRule(""); } }} placeholder="규칙 더하기 (예: 근거는 쿠팡 판매 데이터로)" aria-label="규칙 더하기" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} />
      <Act onClick={() => { if (rule.trim()) { A.mateRule(id, rule); setRule(""); } }} style={rule.trim() ? { background: C.navy, color: "#fff", borderColor: C.navy } : { opacity: 0.5 }}>더하기</Act></div>}
    {off.length > 0 && <div style={{ marginTop: 8 }}><TBtn onClick={() => setOffOpen(!offOpen)}>{offOpen ? "접기 ▴" : `끈 규칙 ${off.length} ▾`}</TBtn>
      {offOpen && <Card style={{ marginTop: 6 }}>{off.map((r, i) => <Row key={r.id} dim title={r.text} sub={`끔 · ${(r.off && r.off.byName) || ""}`} right={canRule ? <Act onClick={() => A.mateRuleOff(id, r.id, false)}>다시 켜기</Act> : null} last={i === off.length - 1} />)}</Card>}</div>}

    {qs.length > 0 && <><Head>횟수 (담당이 정함)</Head>
      <Card>{qs.map((q, i) => <QtyRow key={q.key} q={q} n={qtyNow(doc, q.key, q.n)} can={canRule} onSet={(v) => A.mateQty(id, q.key, v)} last={i === qs.length - 1} />)}</Card>
      <div style={{ fontSize: 12.5, color: st.more >= 2 ? C.navy : C.sub, fontWeight: st.more >= 2 ? 800 : 400, margin: "8px 2px 0", lineHeight: 1.6 }}>{st.more >= 2 ? `이번 주 [더 만들기] ${st.more}번 — 매번 모자라면 위 횟수를 늘려 주세요 · ` : ""}다음 실행부터 이 수만큼 만들어요 · 이번 결과에서 더 필요하면 승인 한 장에서 [더 만들기]</div></>}
    {b && !(c && c.closed) ? <BoardView D={D} cu={cu} A={A} b={b} open={open} asks={asks} doc={doc} />
      : m.first ? <><Head>첫 할 일 (초안)</Head><Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{m.first}<div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>보드(지표·할 일 A~E)는 아직 없어요 · 같이 정하면 넣어요</div></Card></> : null}
    {b && !(c && c.closed) && <p style={{ fontSize: 12.5, color: C.sub, margin: "10px 2px 0", lineHeight: 1.6 }}>Aside 결과는 <a className="v2-lblink" href={`${HUB_CREW_URL}#${b.id}`} target="_blank" rel="noopener">마케팅 허브 › AI 크루 결과 올리기 ›</a>에 붙여 넣어요</p>}

    {done.length > 0 && <><Head>최근 끝난 것 (7일)</Head><Card>{done.slice(0, doneN).map((x, i, arr) => askRow(x, i === arr.length - 1 && done.length <= doneN))}{done.length > doneN && <More onClick={() => setDoneN(doneN + 10)}>{done.length - doneN}개 더 ▾</More>}</Card></>}
  </Sheet>;
}

// 횟수 한 줄: 할 일 · 이번 몫 [−1] n [+1] (담당·관리자) · 기본과 다르면 '기본 n'
function QtyRow({ q, n, can, onSet, last }) {
  const [v, setV] = useState(String(n)); useEffect(() => setV(String(n)), [n]);
  const commit = () => { const x = Math.round(Number(v)); if (x >= 1 && x <= 200 && x !== n) onSet(x); else setV(String(n)); };
  // 폰에서 이름이 잘리지 않게 조절 칸은 이름 아래 줄 (2026-10-15 · 375 확인)
  return <Row title={`${q.act ? q.act + " · " : ""}${q.l} ${n}${q.u}`} sub={[q.routine ? "아침 루틴 · 평일 06:50" : q.t, n !== q.n ? `기본 ${q.n}${q.u}` : ""].filter(Boolean).join(" · ")}
    below={can ? <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      <Act onClick={() => n > 1 && onSet(n - 1)} aria-label={`${q.l} 줄이기`}>−1</Act>
      <input value={v} inputMode="numeric" onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} aria-label={`${q.l} 횟수`} style={{ ...inp, width: 64, padding: "6px 8px", fontSize: 16, textAlign: "center" }} />
      <span style={{ fontSize: 13, color: C.sub }}>{q.u}</span>
      <Act onClick={() => n < 200 && onSet(n + 1)} aria-label={`${q.l} 늘리기`}>+1</Act></div> : null} last={last} />;
}

// 맡긴 일 줄 (2026-10-15) — 제목 · 상태 · AI · 결과 모양·몇 개·언제까지 · 결과 올라가면 그 승인 한 장 · 대기·하는 중은 맡긴 사람·관리자가 [취소]
function ReqRows({ D, cu, A, open, rows, empty, showMate }) {
  const [n, setN] = useState(6);
  const list = (rows || []).filter((r) => r.state !== "cancel" || (r.updatedAt || "") >= new Date(Date.now() - 2 * 864e5).toISOString());
  if (!list.length) return <Card><Empty>{empty}</Empty></Card>;
  return <Card>{list.slice(0, n).map((r, i, arr) => <Row key={r.id} tag={REQ_STATE_L[r.state] || r.state} tagTone={r.state === "cancel" ? null : r.state === "done" ? "green" : null} dim={r.state === "cancel"}
    title={r.title} sub={[showMate ? `${r.mateName || ""}(AI)` : "", reqLine(r), r.createdAt ? ago(r.createdAt) : ""].filter(Boolean).join(" · ")}
    onClick={r.askId ? () => open({ type: "aiask", id: r.askId }) : undefined}
    right={r.askId ? <span style={{ color: C.navy, fontWeight: 800 }}>결과 ›</span> : (r.state === "open" || r.state === "doing") && (r.by === cu.id || isMaster(cu)) ? <Act onClick={(e) => { e.stopPropagation && e.stopPropagation(); A.aiReqCancel(r); }} aria-label={`맡긴 일 취소 ${r.title}`}>취소</Act> : null}
    last={i === arr.length - 1 && list.length <= n} />)}{list.length > n && <More onClick={() => setN(n + 10)}>{list.length - n}개 더 ▾</More>}</Card>;
}
// AI에게 업무 맡기기 (2026-10-15 사장님 "ai팀원에게 업무요청을 별도로해서 진행도 가능했으면 좋겠어") — 한 화면에서 끝: AI 고르기 → 자주 맡기는 일 → 무엇을 · 자세히 · 결과 모양 · 몇 개 · 언제까지 → [맡기기]
//   맡긴 뒤: [지금 바로 — Aside 글 복사](담당 PC Aside 에 붙여 넣으면 바로) · 아니면 한 시간 안에(고칠 것 확인) · 아래 '내가 맡긴 일'
export function AiReqSheet({ D, cu, A, open, onBack, onClose, mate, preset }) {
  const mates = reqMates(), [mid, setMid] = useState(mate && canReq(mate) ? mate : ""), m = mateOf(mid);
  const [title, setTitle] = useState((preset && preset.title) || ""), [body, setBody] = useState((preset && preset.body) || ""), [shape, setShape] = useState(""), [n, setN] = useState(""), [due, setDue] = useState(""), [brand, setBrand] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(null);
  const brands = mid ? mateBrands(mid) : [], today = ymd(new Date()), dow = new Date().getDay(), fri = addDays(today, (5 - dow + 7) % 7);
  const dues = [["", "기한 없음"], [today, "오늘"], [addDays(today, 1), "내일"], [fri, `금요일 ${md(fri)}`], [addDays(today, 7), "다음 주"]];
  const reset = () => { setTitle(""); setBody(""); setShape(""); setN(""); setDue(""); setSent(null); };
  const go = async () => { if (busy) return; setBusy(true); try { const r = await A.aiReq({ mate: mid, title, body, shape, n, due, brand: brand || brands[0] || "" }); if (r) setSent(r); } finally { setBusy(false); } };
  const mine = ((D.ai && D.ai.reqs) || []).filter((r) => r.by === cu.id);
  const lab = { fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 2px 6px" };
  const foot = sent ? null : <Big disabled={busy || !mid || !title.trim()} onClick={go}>{busy ? "맡기는 중…" : m ? `${m.name}(AI)에게 맡기기` : "AI 팀원을 골라 주세요"}</Big>;
  return <Sheet title="업무 맡기기" kind="AI 팀원" head="AI에게 업무 맡기기" onBack={onBack} onClose={onClose} foot={foot}>
    {sent ? <Card style={{ marginTop: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>{sent.mateName}(AI)에게 맡겼어요</div>
      <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7, marginTop: 6 }}>{sent.title}<br />담당 PC 의 Aside 가 한 시간 안에 시작해요 · 바로 하려면 아래 글을 담당 PC Aside 에 붙여 넣어요<br />결과는 승인 한 건으로 오고, 내 '확인할 것'에 '맡긴 일 결과'로 떠요</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}><CopyText text={asideReqLaunch(sent)} label="지금 바로 — Aside 글 복사" solid /><TBtn onClick={reset}>하나 더 맡기기</TBtn></div></Card>
    : <>
      <div style={lab}>누구에게</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{mates.map((x) => <Chip key={x.id} on={mid === x.id} onClick={() => { setMid(x.id); setBrand(""); }}>{x.name} · {x.role}</Chip>)}</div>
      {m && (REQ_PRESETS[mid] || []).length > 0 && <><div style={lab}>자주 맡기는 일 <span style={{ fontWeight: 400, color: C.sub }}>(누르면 채워져요 · 고쳐 써도 돼요)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{REQ_PRESETS[mid].map((t) => <Chip key={t} on={title === t} onClick={() => setTitle(t)}>{t}</Chip>)}</div></>}
      <div style={lab}>무엇을</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="예: 쿠팡 유리블러 경쟁 상품 10개 가격·리뷰 조사" aria-label="무엇을" style={inp} />
      <div style={lab}>자세히 · 참고 링크 <span style={{ fontWeight: 400, color: C.sub }}>(선택)</span></div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} placeholder="왜 필요한지 · 볼 곳 · 참고 링크 (고객 연락처·원가는 쓰지 않아요)" aria-label="자세히" style={{ ...inp, resize: "vertical" }} />
      <div style={lab}>결과 모양</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{REQ_SHAPES.map((x) => <Chip key={x} on={shape === x} onClick={() => setShape(shape === x ? "" : x)}>{x}</Chip>)}</div>
      <div style={lab}>몇 개 <span style={{ fontWeight: 400, color: C.sub }}>(선택)</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>{["1", "3", "5", "10", "20"].map((x) => <Chip key={x} on={n === x} onClick={() => setN(n === x ? "" : x)}>{x}개</Chip>)}
        <input value={["1", "3", "5", "10", "20"].includes(n) ? "" : n} onChange={(e) => setN(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" placeholder="직접" aria-label="몇 개 직접" style={{ ...inp, width: 80, padding: "8px 10px" }} /></div>
      <div style={lab}>언제까지</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{dues.map(([v, l]) => <Chip key={l} on={due === v} onClick={() => setDue(v)}>{l}</Chip>)}</div>
      {brands.length > 1 && <><div style={lab}>브랜드</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{brands.map((bb) => <Chip key={bb} on={(brand || brands[0]) === bb} onClick={() => setBrand(bb)}>{brandL(bb)}</Chip>)}</div></>}
      <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "12px 2px 0" }}>AI는 조사·표·초안까지 해요 · 가격·광고·발송·게시 같은 실행은 결과를 승인한 뒤 사람이 해요{m ? ` · 결과 승인 = ${m.name}(AI) 담당 → 리드 (광고비 예산·원가·판매가 조정만 본부장까지)` : ""}</p>
    </>}
    <Head>내가 맡긴 일</Head>
    <ReqRows D={D} cu={cu} A={A} open={open} rows={mine} showMate empty="아직 맡긴 일이 없어요" />
  </Sheet>;
}

// 내 PC Aside 세팅 (2026-10-15 사장님 "각 담당자들에게 세팅방안 업무 os로 알려줘") — '확인할 것' 세팅·안 돎 · AI 팀원 '내 PC' 카드에서 열림
//   계획 = aiask.asidePlanOf(허브 세팅 카드와 같음) · 관리자는 다른 PC 묶음도 고름 · 쓰기 없음(글 복사만)
export function AiSetupSheet({ D, cu, open, onBack, onClose, owner }) {
  const master = isMaster(cu), plan = useMemo(() => asidePlanOf(D), [D.ai, D.users]);
  const def = owner !== undefined ? owner : plan.some((g) => g.owner === cu.id) ? cu.id : master && plan.length ? plan[0].owner : cu.id;
  const [sel, setSel] = useState(def), g = plan.find((x) => x.owner === sel), bv = (D.ai && D.ai.boards) || {}, key = ymd(new Date());
  const groups = master ? plan : plan.filter((x) => x.owner === cu.id);
  const bs = g ? g.runs.map((r) => r.board) : [], L = loginSites(bs);
  const stOf = (b) => { const v = bv[b.id]; return !v || !v.at ? "아직 한 번도 안 올림" : ranOn(v, key) ? `오늘 ${hm(v.at)} 올림` : `마지막 ${md(ymd(new Date(v.at)))} ${hm(v.at)}`; };
  return <Sheet title="Aside 세팅" kind="AI 크루" head={g ? `${PC_L(D, g.owner, cu)} · AI 크루 ${g.runs.length}명` : "Aside 세팅"} onBack={onBack} onClose={onClose}>
    {groups.length > 1 && <div className="v2-filterrow" style={{ marginTop: 12 }} aria-label="PC 고르기">{groups.map((x) => <Chip key={x.owner || "-"} on={x.owner === sel} onClick={() => setSel(x.owner)}>{PC_L(D, x.owner, cu)} {x.runs.length}</Chip>)}</div>}
    {!g ? <Card style={{ marginTop: 12 }}><Empty>맡은 AI 크루가 없어요 · 관리자가 업무OS AI 팀원에서 담당을 정하면 여기에 보여요</Empty></Card> : <>
      <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7, marginTop: 12 }}>담당마다 자기 PC Aside 에서 자기 크루를 돌려요 · 담당이 다르면 모두 09:00 에 동시에 · 한 PC 에 여럿이면 한 시간씩{!g.owner ? " · 담당 미정 크루는 관리자 PC 한 곳에서 (담당을 정하면 그 사람 PC 로)" : ""}</div>
      <Head>이 PC 에서 돌릴 크루 {g.runs.length}명 · {g.runs[0].t}{g.runs.length > 1 ? `~${g.runs[g.runs.length - 1].t}` : ""}{g.runs.some((r) => r.board.run && r.board.run.dow && r.board.run.dow.length < 5) ? " · 요일은 크루마다" : ""}</Head>
      <Card>{g.runs.map((r, i) => { const m = mateOf(r.board.mate) || {};
        return <div key={r.board.id} style={{ padding: "11px 14px", borderBottom: i === g.runs.length - 1 ? "none" : `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><b style={{ color: C.navy, fontVariantNumeric: "tabular-nums" }}>{r.board.run && r.board.run.dow && r.board.run.dow.length < 5 ? runWord({ ...r.board.run, t: r.t }) : r.t}</b><b style={{ color: C.text }}>{m.name} · {m.role}</b><span style={{ fontSize: 12.5, color: C.sub }}>{r.board.title} · {stOf(r.board)}</span></div>
          {missedOn(bv[r.board.id], r.t, new Date(), r.board.run && r.board.run.dow) && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: C.red, lineHeight: 1.5 }}>오늘 아직 안 올림 — PC·Aside 가 켜져 있는지 확인 · [{m.name} Aside 글 복사] → Aside 에 붙여 넣으면 지금 돌아요</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}><CopyText text={asideLaunch(r.board, r.t)} label={`${m.name} Aside 글 복사`} /><TBtn onClick={() => open({ type: "aiMate", id: r.board.mate })}>{m.name} 한 장 ›</TBtn></div></div>; })}</Card>
      <Head>세팅 순서 (처음 한 번)</Head>
      <Card style={{ padding: "12px 14px" }}><ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.text, lineHeight: 1.75 }}>
        <li>이 PC Aside 브라우저에서 <a className="v2-lblink" href={HUB_CREW_URL} target="_blank" rel="noopener">마케팅 허브 › AI 크루 결과 올리기</a>를 열고 로그인 (업로더 계정 · 없으면 관리자에게)</li>
        <li>아래 '로그인해 둘 곳'에 한 번씩 로그인 (로그인 유지 · 비밀번호는 Aside 에게 알려 주지 않아요)</li>
        <li>크루마다 [Aside 글 복사] → Aside 새 예약 작업에 붙여 넣기 · 반복 평일(월~금) — 요일이 적힌 크루(매주 월 등)는 그 요일만 · 시각은 위에 적힌 대로 — 지금 바로 돌리려면 Aside 에 그냥 붙여 넣기</li>
        <li>(권장) [고칠 것 확인 글 복사] → Aside 예약 '평일 한 시간마다' — [AI에게 다시]·[더 만들기]가 한 시간 안에 반영돼요</li>
        <li>결과는 '확인할 것'으로 와요 → 번호 골라 승인 · [AI에게 다시] · [더 만들기] · 매번 수를 바꾸려면 AI 한 장 '횟수'</li></ol></Card>
      <Head>로그인해 둘 곳 {L.length + 1}곳</Head>
      <Card>{[{ s: "마케팅 허브 (이 PC)", uses: [{ mate: "모두", w: "업로더 계정 · 결과 올리기" }] }, ...L].map((x, i, arr) => <Row key={x.s} title={x.s} sub={[...new Set(x.uses.map((u) => `${u.mate} — ${u.w}`))].join(" · ")} last={i === arr.length - 1} />)}</Card>
      <Head>고칠 것 확인 (수정 요청 바로 반영)</Head>
      <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, margin: "-2px 2px 8px" }}>이 PC 크루의 '고쳐서 다시 올릴 것'(더 만들기 포함)만 처리하고, 없으면 바로 끝나요</div>
      <CopyText text={asideFixLaunch(bs)} label="고칠 것 확인 글 복사" /></>}
  </Sheet>;
}

// ── 상급자 (관리자 › 사람) ──
export function BossCard({ D, cu, A, u }) {
  const users = activeUsers(D.users).filter((x) => x.id !== u.id), cur = u.bossId || "", rec = bossRec(D.users)[u.id] || "";
  const up = []; for (let k = 0, x = u.id; k < 5; k++) { const bb = bossOf(x, D.users); if (!bb || up.includes(bb) || bb === u.id) break; up.push(bb); x = bb; }
  return <Card style={{ padding: "12px 14px" }}>
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>AI 결과를 이 사람이 승인하면 다음은 상급자에게 가요 · {up.length ? [u.name, ...up.map((x) => nameOf(D.users, x))].join(" → ") : "상급자 없음 = 이 사람 승인으로 끝"}</div>
    <div className="v2-chips" style={{ marginTop: 10 }}>
      <Chip on={!cur} onClick={() => cur && A.setBoss(u, "")}>없음 (맨 위)</Chip>
      {users.map((x) => <Chip key={x.id} on={cur === x.id} onClick={() => cur !== x.id && A.setBoss(u, x.id)} style={bossLoop(D.users, u.id, x.id) ? { opacity: 0.45 } : null}>{x.name}{rec === x.id && cur !== x.id ? " · 추천" : ""}</Chip>)}
    </div>
  </Card>;
}
export function BossPanel({ D, cu, A, open }) {
  const rec = useMemo(() => bossRec(D.users), [D.users]), act = activeUsers(D.users);
  const diff = act.filter((u) => (u.bossId || "") !== (rec[u.id] || "")), set = act.filter((u) => u.bossId).length;
  const [more, setMore] = useState(false);
  if (!isMaster(cu)) return null;
  return <Card style={{ marginTop: 10, padding: "12px 14px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", fontSize: 13.5, color: C.text, lineHeight: 1.6 }}><b>상급자 (AI 승인 길)</b> · 정한 사람 {set}/{act.length}{diff.length ? ` · 추천과 다른 사람 ${diff.length}` : " · 추천대로예요"}</div>
      {diff.length > 0 && <Act onClick={() => A.setBosses(rec)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>추천대로 정하기</Act>}
      <TBtn onClick={() => setMore(!more)}>{more ? "접기 ▴" : "보기 ▾"}</TBtn>
    </div>
    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>추천: 팀원 → 팀 리드(1팀 김소연 · 2팀 김송희 · 3팀 김채원) → 본부장 허지은 · 사람 이름을 누르면 하나씩 바꿔요</div>
    {more && <div style={{ marginTop: 8 }}>{act.map((u) => <div key={u.id} role="button" tabIndex={0} onClick={() => open({ type: "person", id: u.id })} onKeyDown={(e) => { if (e.key === "Enter") open({ type: "person", id: u.id }); }}
      style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.line}`, fontSize: 13.5, cursor: "pointer" }}>
      <span style={{ flex: "0 0 74px", fontWeight: 800, color: C.text }}>{u.name}</span><span style={{ flex: 1, color: C.sub }}>→ {nameOf(D.users, u.bossId) || "없음(맨 위)"}</span>
      {(u.bossId || "") !== (rec[u.id] || "") && <span style={{ color: C.navy, fontSize: 12.5 }}>추천 {nameOf(D.users, rec[u.id]) || "맨 위"}</span>}</div>)}</div>}
  </Card>;
}
