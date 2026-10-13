// 업무OS v2 — AI 팀원 · AI 승인 화면 (사용자 결정 2026-10-12)
//   "AI팀원이 실행한 것을 사람팀원에게 승인요청하고, 사람팀원은 상급자 사람에게 승인요청" · "AI 팀원을 각 사람 담당자가 관리하면서 고도화"
//   AiAskSheet = 승인 한 장(번호 고르기 · 위로 · AI 에게 다시 · 돌려보내기 · 안 함 · 대화 · 기록)
//   AiTeamBody = AI 팀원 목록(크루 = 브랜드+고객별 · 기본 AI 팀원 = 원형) — 팀 앱 더보기 › AI 팀원 · 관리자 탭 'AI 팀원'
//   AiMateSheet = AI 한 장(담당 · 승인 길 · 성과 · 고칠 점 → 확정 규칙 · 보드 = 지표·행동 A~E·최근 결과)
//   BossCard · BossPanel = 상급자(관리자 › 사람)
// 계산 aiask.js · 정의 marketing-hub/crew.js · 쓰기 core.jsx(useActs aiPass·aiBack·aiRet·aiDrop·mateOwnerSet·mateRule·setBoss·setBosses)
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { md, hm, ago, ymd, isMaster, nameOf, activeUsers } from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, inp, Linked, useLocal } from "./ui.jsx";
import { Thread, useItemNotes } from "./task.jsx";
import { LS } from "./core.jsx";
import { CREWS, GONE, crewOf, mateOf, boardOf, brandL, servesL, mateBrands, ownerKeys, fmtMetric, metricPct, metricOk } from "../../marketing-hub/crew.js";
import { ASK_STATE_L, canAct, canBack, canRet, isProxy, pickOk, planPass, chainOf, mateOwner, mateStats, repeatNotes, itemLine, bossOf, bossRec, bossLoop } from "./aiask.js";

export const HUB_CREW_URL = "../marketing-hub/crew.html";   // Aside 결과 올리기 (허브)
const aiNoteId = (id) => "ai:" + id;
const tone = { wait: C.navy, back: C.sub, ok: C.green, no: C.mute };
const Pill = ({ children, color = C.navy, bg = C.soft }) => <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;
// 긴 글 줄 (규칙·고칠 점 · 줄바꿈 · Row 는 한 줄로 자름)
const Line = ({ text, sub, right, tag, last }) => <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: last ? "none" : `1px solid ${C.line}`, background: "#fff" }}>
  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{tag && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 6, color: C.red, background: "#F8E9EA", marginRight: 6 }}>{tag}</span>}{text}</div>
    {sub && <div style={{ marginTop: 3, fontSize: 12.5, color: C.sub }}>{sub}</div>}</div>{right}</div>;
const Banner = ({ children, red }) => <div style={{ margin: "10px 0 0", padding: "11px 13px", borderRadius: 12, background: red ? "#F8E9EA" : "#F7F8FB", border: `1px solid ${red ? "#E9C4C7" : C.line}`, fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{children}</div>;

// 승인 한 건 찾기: 구독(열린 것 + 최근 7일)에 없으면(오래전에 끝난 것 · 링크) 한 번 읽음
export function useAsk(D, id) {
  const live = ((D.ai && D.ai.asks) || []).find((x) => x.id === id);
  const [extra, setExtra] = useState(null);
  useEffect(() => { if (live || extra) return; fb.getOne("aiasks", id).then((x) => setExtra(x || false)).catch((e) => { console.error("[v2] AI 승인 불러오기 실패:", e); setExtra(false); }); }, [id, !!live]);
  return live || extra;
}

// 승인 길 한 줄: 겨울(AI) → 남윤정 ✓ → 김소연 ● → 허지은
export function ChainLine({ a, users }) {
  const ch = chainOf(a, users), mk = { done: "✓", now: "●", next: "", wait: "" };
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

export function AiAskSheet({ D, cu, A, open, onBack, onClose, id, focus, note }) {
  const a = useAsk(D, id);
  const notes = useItemNotes(D, aiNoteId(id));
  const [pick0, setPick] = useState(null), [mode, setMode] = useState(""), [txt, setTxt] = useState(""), [busy, setBusy] = useState(false), [showLog, setShowLog] = useState(false);
  useEffect(() => { if (focus !== "talk") return; const h = setTimeout(() => { const el = document.getElementById("v2-ai-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150); return () => clearTimeout(h); }, [focus, !!a]);
  if (a === undefined || a === null) return <Sheet title="AI 승인" kind="AI 승인" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (a === false) return <Sheet title="AI 승인" kind="AI 승인" onBack={onBack} onClose={onClose}><Empty>이 승인 요청을 찾지 못했어요</Empty></Sheet>;
  const m = mateOf(a.mate) || { name: a.mateName || "AI", role: "" }, b = a.board ? boardOf(a.board) : null, actDef = b ? b.actions.find((x) => x.c === a.act) : null;
  const items = a.items || [], can = canAct(a, cu), proxy = can && isProxy(a, cu);
  const pick = pick0 || (Array.isArray(a.pick) ? a.pick : []), pset = new Set(pick);
  const toggle = (n) => setPick(pset.has(n) ? pick.filter((x) => x !== n) : [...pick, n]);
  const pv = can ? planPass(a, cu, D.users, items.length ? pick : null, "") : null, nextN = pv && pv.next ? nameOf(D.users, pv.next) : "";
  const go = async (fn) => { if (busy) return; setBusy(true); try { const ok = await fn(); if (ok) { setMode(""); setTxt(""); setPick(null); } } finally { setBusy(false); } };
  const passL = `${items.length ? `고른 ${pick.length}개 ` : ""}${pv && pv.next ? `승인 → ${nextN}님께` : "최종 승인"}`;
  const exT = a.execTask ? (D.tasks || []).find((t) => t.id === a.execTask) : null;
  const foot = can ? <><Big disabled={busy || !pickOk(a, pick)} onClick={() => go(() => A.aiPass(a, items.length ? pick : null))}>{passL}</Big>
      {proxy && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>관리자로 대신 눌러요 · 지금 차례는 {nameOf(D.users, a.to)}님 · 기록엔 내 이름이 남아요</div>}</>
    : a.state === "wait" ? <Big disabled>{a.to ? `${nameOf(D.users, a.to)}님 승인 기다리는 중` : "담당 미정 · 관리자가 승인해요"}</Big>
    : a.state === "back" ? <Big disabled>{m.name}(AI)가 고치는 중 · 다시 올리면 알려 드려요</Big>
    : a.state === "ok" ? (a.execTask ? <Big tone="white" onClick={() => open({ type: "task", id: a.execTask })}>실행 업무 보기{exT ? ` · ${exT.status === "done" ? "끝남" : nameOf(D.users, (exT.assigneeIds || [exT.assigneeId])[0]) + " 담당"}` : ""}</Big> : <Big disabled>최종 승인됨</Big>)
    : <Big disabled>안 하기로 함</Big>;
  return <Sheet title="AI 승인" kind="AI 승인" head={a.title} path={`AI 팀원 · ${m.name}${m.role ? " · " + m.role : ""}`} onPath={() => open({ type: "aiMate", id: a.mate })} onBack={onBack} onClose={onClose} foot={foot}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }}>
      <Pill color={tone[a.state] || C.navy}>{ASK_STATE_L[a.state] || a.state}{a.state === "wait" ? (a.step > 0 ? ` · ${a.step + 1}단계` : " · 담당 단계") : ""}</Pill>
      {a.brand && <Pill color={C.sub} bg="#F1F2F6">{brandL(a.brand)}</Pill>}
      {(a.ver || 1) > 1 && <Pill color={C.sub} bg="#F1F2F6">{a.ver}번째로 다시 올림</Pill>}
      <span style={{ fontSize: 12.5, color: C.mute }}>{a.run ? md(a.run) + " 실행" : ""}{a.createdAt ? ` · ${ago(a.createdAt)}` : ""}</span>
    </div>
    <div style={{ marginTop: 10 }}><ChainLine a={a} users={D.users} /></div>
    {a.ret && a.state === "wait" && <Banner red><b>수정 요청</b> · {a.ret.byName} · {ago(a.ret.at)}<div style={{ whiteSpace: "pre-wrap" }}><Linked text={a.ret.text} /></div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>번호를 다시 고르거나 AI에게 다시 보내 주세요</div></Banner>}
    {a.state === "back" && a.back && <Banner><b>{m.name}(AI)에게 다시 보냄</b> · {a.back.byName} · {ago(a.back.at)}<div style={{ whiteSpace: "pre-wrap" }}>{a.back.text}</div></Banner>}
    {a.state === "no" && <Banner><b>안 함</b> · {a.noByName} · {a.noAt ? ago(a.noAt) : ""}{a.noReason ? <div>{a.noReason}</div> : null}</Banner>}
    {a.state === "ok" && <Banner><b>최종 승인</b> · {a.okByName} · {a.okAt ? `${md(ymd(new Date(a.okAt)))} ${hm(a.okAt)}` : ""}{a.exec ? <div>실제 반영은 사람이 해요 · '실행' 업무에서 끝내 주세요</div> : null}</Banner>}

    {(a.sum || a.body) && <Card style={{ marginTop: 12, padding: "12px 14px" }}>
      {a.sum && <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, lineHeight: 1.6 }}>{a.sum}</div>}
      {a.body && <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: a.sum ? 6 : 0, maxHeight: 320, overflowY: "auto" }}><Linked text={a.body} /></div>}</Card>}
    {a.url && <div style={{ marginTop: 8 }}><a className="v2-lblink" href={a.url} target="_blank" rel="noopener">결과 전체 보기 ›</a></div>}

    {items.length > 0 && <><Head right={can && <span style={{ display: "inline-flex", gap: 6 }}><TBtn onClick={() => setPick(items.map((x) => x.n))}>모두 고르기</TBtn><TBtn onClick={() => setPick([])}>모두 풀기</TBtn></span>}>
      {can ? `승인할 번호 고르기 · ${pick.length}/${items.length}` : `제안 ${items.length}개${Array.isArray(a.pick) ? ` · 고른 것 ${a.pick.length}` : ""}`}</Head>
      <Card>{items.map((it, i) => <ItemCard key={it.n} it={it} cols={a.cols} card={actDef && actDef.card} on={pset.has(it.n)} can={can} onToggle={() => toggle(it.n)} last={i === items.length - 1} />)}</Card></>}
    {a.exec && <div style={{ fontSize: 13, color: C.sub, margin: "10px 2px 0", lineHeight: 1.6 }}><b style={{ color: C.ink }}>실행은 사람이</b> · {a.exec}</div>}

    {can && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0 0" }}>
      {canBack(a, cu) && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "back" ? "" : "back"); }}>{m.name}(AI)에게 다시</TBtn>}
      {canRet(a, cu) && <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "ret" ? "" : "ret"); }}>{nameOf(D.users, a.owner) || "담당"}님께 돌려보내기</TBtn>}
      <TBtn v="soft" onClick={() => { setTxt(""); setMode(mode === "no" ? "" : "no"); }}>안 함</TBtn>
    </div>}
    {can && mode && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {mode === "no" && <div className="v2-chips">{REASONS.map((r) => <Chip key={r} on={txt === r} onClick={() => setTxt(r)}>{r}</Chip>)}</div>}
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} aria-label={mode === "no" ? "안 하는 이유" : "고칠 점"} placeholder={mode === "back" ? `${m.name}에게: 무엇을 고치면 될까요? (AI가 다음 실행 때 읽어요)` : mode === "ret" ? "무엇을 다시 보면 될까요?" : "이유 (선택)"} style={inp} />
      <div style={{ display: "flex", gap: 8 }}><Act onClick={() => setMode("")}>그만</Act>
        <Act onClick={() => go(() => (mode === "back" ? A.aiBack(a, txt) : mode === "ret" ? A.aiRet(a, txt) : A.aiDrop(a, txt)))} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>{busy ? "보내는 중" : mode === "no" ? "안 하기로 하기" : "보내기"}</Act></div>
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
  const mineIds = CREWS.flatMap((c) => c.members).map((x) => x.id).filter(ownsAny);   // AI 팀원 = 크루 (2026-10-14 "포리, 하루, 에코는 없어야지" → 기본 AI 팀원(원형) 칸 없앰 · 아침 루틴 = 여름)
  const [scope0, setScope] = useLocal(LS("ai-scope-" + cu.id), "");
  const scope = scope0 || (mineIds.length && !master ? "mine" : "all");
  const [bulk, setBulk] = useState(false);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const myTurn = asks.filter((x) => x.state === "wait" && (x.to === cu.id || (!x.to && master))).length;
  const ownerL = (id, brand) => { const o = mateOwner(mates[id], brand, D.users); return o ? nameOf(D.users, o) : "담당 미정"; };
  const ownersL = (id) => { const ks = ownerKeys(id); if (ks.length < 2) return ownerL(id, ks[0] || ""); const names = [...new Set(ks.map((x) => ownerL(id, x)))]; return names.length === 1 ? names[0] : ks.map((x) => `${x ? brandL(x) : "기본"} ${ownerL(id, x)}`).join(" · "); };
  const show = (id) => scope === "all" || mineIds.includes(id);
  const stat = (id) => { const s = mateStats(asks, id, since); return [s.wait ? `대기 ${s.wait}` : "", s.back ? `고치는 중 ${s.back}` : "", s.ok ? `이번 주 승인 ${s.ok}` : "", s.redo ? `다시 ${s.redo}` : ""].filter(Boolean).join(" · "); };
  const setFocus = async (crewId, slot) => { try { await fb.merge("settings", "aicrew", { focus: { [crewId]: slot }, at: new Date().toISOString(), by: cu.id, byName: cu.name }); } catch (e) { console.error("[v2] 이번 주 집중 저장 실패:", e); A.toast("저장 실패 · 인터넷 연결을 확인해 주세요"); } };
  const users = activeUsers(D.users);
  const OwnerPick = ({ id, brand }) => { const cur = mateOwner(mates[id], brand, D.users);
    return <select value={cur} onClick={(e) => e.stopPropagation()} onChange={(e) => A.mateOwnerSet(id, brand || "_", e.target.value)} aria-label={`${(mateOf(id) || {}).name} 담당${brand ? " " + brandL(brand) : ""}`} style={{ ...inp, width: "auto", maxWidth: 150, padding: "6px 8px", fontSize: 13 }}>
      <option value="">담당 미정</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>; };
  const mateRow = (x, last, color) => { const ms = mates[x.id] || {}, rules = (ms.rules || []).filter((r) => !r.off).length;
    const picks = bulk && master && !x.admin ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>{ownerKeys(x.id).map((bb) =>
      <label key={bb || "_"} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, fontWeight: 700 }}>{bb ? brandL(bb) : mateBrands(x.id).length ? "기본" : "담당"}<OwnerPick id={x.id} brand={bb} /></label>)}</div> : null;
    return <div key={x.id} style={{ borderLeft: color ? `4px solid ${color}` : "none" }}><Row title={`${x.name} · ${x.role}`} tag={x.admin ? "관리자 자리" : x.routine ? "아침 루틴" : null} sub={[x.admin ? "원가·제조사 일이라 업무OS 승인에 안 올림" : ownersL(x.id), x.routine ? "평일 06:50 블로그·재배포" : "", rules ? `규칙 ${rules}` : ""].filter(Boolean).join(" · ")} sub2={stat(x.id) || null} onClick={() => open({ type: "aiMate", id: x.id })} right={picks ? null : <span style={{ color: C.navy, fontWeight: 800 }}>›</span>} below={picks} last={last} /></div>; };
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", maxWidth: 320 }}><Seg items={[["mine", `내가 맡은 AI ${mineIds.length}`], ["all", "모두"]]} value={scope} onChange={setScope} /></div>
      {master && <TBtn onClick={() => setBulk(!bulk)} aria-pressed={bulk}>{bulk ? "담당 정하기 끝" : "담당 한꺼번에 정하기"}</TBtn>}
    </div>
    <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "8px 2px 0" }}>AI가 결과를 올리면 담당 → 리드 → 본부장 순서로 승인해요 · 실제 반영은 늘 사람이 해요{myTurn ? ` · 지금 내 차례 ${myTurn}건` : ""}</p>
    {scope === "mine" && !mineIds.length && <Card style={{ marginTop: 10 }}><Empty>아직 맡은 AI 팀원이 없어요 · 관리자가 담당을 정하면 여기에 보여요</Empty></Card>}
    {CREWS.map((c) => { const list = c.members.filter((x) => show(x.id)); if (!list.length) return null; const f = crewFocus(D, c.id), canF = master || c.members.some((x) => ownsAny(x.id));
      return <section key={c.id}>
        <Head right={c.draft ? <Pill color={C.sub} bg="#F1F2F6">초안</Pill> : null}>{c.name}</Head>
        <div style={{ fontSize: 12.5, color: C.sub, margin: "-4px 2px 8px", lineHeight: 1.6 }}>{servesL(c)}{c.note ? ` · ${c.note}` : ""}</div>
        <div className="v2-filterrow" style={{ marginBottom: 8 }} aria-label="매출 공식 · 이번 주 집중"><span style={{ fontSize: 13, fontWeight: 800, color: C.ink, flex: "0 0 auto" }}>매출 =</span>
          {c.formula.map((k, i) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>{i > 0 && <span style={{ color: C.mute }}>×</span>}
            <Chip on={f === k} onClick={canF ? () => setFocus(c.id, f === k ? "" : k) : undefined} style={{ padding: "6px 11px", cursor: canF ? "pointer" : "default" }}>{k}</Chip></span>)}</div>
        {f && <div style={{ fontSize: 12.5, color: C.navy, fontWeight: 800, margin: "0 2px 8px" }}>이번 주 집중 · {f} — 가장 약한 칸 하나만 올려도 매출이 달라져요</div>}
        <Card>{list.map((x, i) => mateRow(x, i === list.length - 1, f && x.slot === f ? C.navy : x.color))}</Card>
      </section>; })}
    {/* 기본 AI 팀원(원형) 칸은 없앰 (2026-10-14 사장님 "포리, 하루, 에코는 없어야지") — 크루가 AI 팀원 · 블로그·재배포 아침 루틴 = 여름 · 옛 하루·포리·에코 결과는 '확인할 것'·승인 한 장에서 그대로 */}
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
function BoardView({ D, b, open, asks }) {
  const v = useBoardVals(b.id), vals = (v && v.metrics) || {};
  const [openA, setOpenA] = useState("");
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
    <Head>할 일 A~E</Head>
    <Card>{b.actions.map((a, i) => { const last = asks.filter((x) => x.board === b.id && x.act === a.c).sort((p, q) => String(q.createdAt || "").localeCompare(String(p.createdAt || "")))[0];
      return <div key={a.c} style={{ borderBottom: i === b.actions.length - 1 ? "none" : `1px solid ${C.line}` }}>
        <Row title={`${a.c} · ${a.t}`} tag={a.admin ? "관리자 자리" : last ? ASK_STATE_L[last.state] : null} sub={[a.when, a.k ? "지표 " + a.k : ""].filter(Boolean).join(" · ")} sub2={last ? `최근 ${last.run ? md(last.run) : ""} · ${last.title}` : null}
          onClick={() => setOpenA(openA === a.c ? "" : a.c)} right={<span style={{ color: C.navy, fontWeight: 800 }}>{openA === a.c ? "▴" : "▾"}</span>} last />
        {openA === a.c && <div style={{ padding: "0 14px 12px", fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
          {a.admin ? <div style={{ color: C.text }}>{a.admin}</div> : <>
            <div><b style={{ color: C.ink }}>상황</b> · {a.w}</div>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>{a.s.map((s, k) => <li key={k} style={{ marginTop: 2 }}>{s}</li>)}</ol>
            {a.cols.length > 0 && <div style={{ marginTop: 6 }}><b style={{ color: C.ink }}>올리는 표</b> · {a.cols.join(" · ")}</div>}
            {last && <div style={{ marginTop: 8 }}><TBtn onClick={() => open({ type: "aiask", id: last.id })}>최근 결과 보기 ›</TBtn></div>}</>}
        </div>}
      </div>; })}</Card>
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
  const since = new Date(Date.now() - 7 * 864e5).toISOString(), st = mateStats(asks, id, since), rep = new Set(repeatNotes(st.notes).map((x) => x.text));
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
      {m.routine && <div>{m.routine}</div>}
      {GONE[id] && <div style={{ color: C.text }}>2026-10-14부터 쉬어요 · 이 일은 B2C 크루 {(mateOf(GONE[id]) || {}).name} 몫이에요 · 이미 올라온 결과는 그대로 승인·안 함</div>}
      {c && <div>일하는 곳 · {servesL(c)}</div>}
      {m.from && m.from.length > 0 && <div>원형 · {m.from.map((f) => (mateOf(f) || {}).name || f).join(" · ")} <span style={{ color: C.mute }}>(파생 · 짐작)</span></div>}
      {m.admin && <div style={{ color: C.text }}>관리자 자리 일(원가·제조사)이라 업무OS 승인으로 올리지 않아요 · 마진 대시보드에서</div>}
    </div>
    <Head>담당 · 승인 길</Head>
    <Card>{owners.map((o, i) => <Row key={o.bb || "_"} title={`담당${o.bb ? ` (${brandL(o.bb)})` : brands.length ? " (기본)" : ""} · ${o.uid ? nameOf(D.users, o.uid) : "미정"}`}
      sub={[!o.bb && brands.length ? "아침 루틴 원고처럼 브랜드가 섞인 결과 · 브랜드 담당을 안 정한 브랜드" : "", o.uid ? [`${m.name}(AI) → ${nameOf(D.users, o.uid)}`, ...chainFrom(o.uid)].join(" → ") : "정할 때까지 관리자 누구나 승인해요"].filter(Boolean).join(" · ")}
      right={master && !m.admin ? <select value={o.uid} onChange={(e) => A.mateOwnerSet(id, o.bb || "_", e.target.value)} aria-label={`담당 바꾸기${o.bb ? " " + brandL(o.bb) : ""}`} style={{ ...inp, width: "auto", maxWidth: 140, padding: "6px 8px", fontSize: 13 }}>
        <option value="">미정</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : null} last={i === owners.length - 1} />)}</Card>

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

    {b ? <BoardView D={D} b={b} open={open} asks={asks} />
      : m.first ? <><Head>첫 할 일 (초안)</Head><Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{m.first}<div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>보드(지표·할 일 A~E)는 아직 없어요 · 같이 정하면 넣어요</div></Card></> : null}
    {b && <p style={{ fontSize: 12.5, color: C.sub, margin: "10px 2px 0", lineHeight: 1.6 }}>Aside 결과는 <a className="v2-lblink" href={`${HUB_CREW_URL}#${b.id}`} target="_blank" rel="noopener">마케팅 허브 › AI 크루 결과 올리기 ›</a>에 붙여 넣어요</p>}

    {done.length > 0 && <><Head>최근 끝난 것 (7일)</Head><Card>{done.slice(0, doneN).map((x, i, arr) => askRow(x, i === arr.length - 1 && done.length <= doneN))}{done.length > doneN && <More onClick={() => setDoneN(doneN + 10)}>{done.length - doneN}개 더 ▾</More>}</Card></>}
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
