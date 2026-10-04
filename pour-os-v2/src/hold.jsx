// 업무OS v2 — 보류 · 프로젝트 끝내기(완료 · 중단 · 보류) · 다시 시작 창 (실사용·관리자가 같이 씀)
// 보류·중단은 이유 한 줄이 꼭 있어야 함(칩 한 번) · 보류는 '다시 볼 날'(선택) → 그날 담당·책임자 '확인할 것'에 다시 뜸
import { useState } from "react";
import { C, Big, TBtn, Chip, inp } from "./ui.jsx";
import { ymd, addDays, md, ddays, nextWorkday, HOLD_WHY, DROP_WHY, isHoldP, projStLabel } from "./model.js";

const box = { width: "min(440px, calc(100% - 24px))", maxHeight: "calc(100% - 32px)", overflowY: "auto", background: "#fff", borderRadius: 18, padding: 18 };
const lab = { fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 0 6px" };
function Modal({ title, children, onNo }) {
  return <div className="v2-sheet-wrap" style={{ alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={(e) => { e.stopPropagation(); onNo(); }}>
    <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={box}>
      <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.ink }}>{title}</h3>{children}</div></div>;
}
// 이유 칩 + 직접 쓰기
function Why({ list, v, set }) {
  return <><div className="v2-chips">{list.map((w) => <Chip key={w} on={v === w} onClick={() => set(v === w ? "" : w)}>{w}</Chip>)}</div>
    <input value={list.includes(v) ? "" : v} onChange={(e) => set(e.target.value)} placeholder="직접 쓰기 (예: 제조사 MOQ 협의 중)" aria-label="이유" style={{ ...inp, marginTop: 8 }} /></>;
}
// 다시 볼 날: 1주 뒤 · 2주 뒤 · 다음 달 · 날짜 고르기 (평일로 맞춤) · 없음
function Until({ v, set, key0 }) {
  const nm = (() => { const d = new Date(key0 + "T00:00:00"); d.setMonth(d.getMonth() + 1, 1); return nextWorkday(ymd(d)); })();
  const opts = [["1주 뒤", nextWorkday(addDays(key0, 7))], ["2주 뒤", nextWorkday(addDays(key0, 14))], [`다음 달 ${md(nm)}`, nm]];
  return <><div className="v2-chips">{opts.map(([l, d]) => <Chip key={l} on={v === d} onClick={() => set(v === d ? "" : d)}>{l}</Chip>)}<Chip on={!v} onClick={() => set("")}>정하지 않음</Chip></div>
    <input type="date" value={v} min={addDays(key0, 1)} onChange={(e) => set(e.target.value)} aria-label="다시 볼 날" className="v2-sel" style={{ marginTop: 8 }} />
    {v && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{md(v)}에 '확인할 것'에 다시 떠요</div>}</>;
}

// 업무 보류 (한 건 · 여러 건 같이)
export function HoldAsk({ title, n = 1, onYes, onNo }) {
  const key0 = ymd(new Date()), [why, setWhy] = useState(""), [until, setUntil] = useState("");
  return <Modal title={title || "보류하기"} onNo={onNo}>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{n > 1 ? `${n}건을 ` : ""}나중에 다시 할 일로 둬요. 오늘 화면·지난 일 숫자에서는 빠지고, 정리의 '보류' 모음에서 늘 보여요.</div>
    <div style={lab}>이유 (꼭)</div><Why list={HOLD_WHY} v={why} set={setWhy} />
    <div style={lab}>다시 볼 날</div><Until v={until} set={setUntil} key0={key0} />
    <div style={{ display: "flex", gap: 8, marginTop: 18 }}><Big tone="white" onClick={onNo} style={{ flex: 1 }}>취소</Big>
      <Big onClick={() => why.trim() && onYes(why.trim(), until)} disabled={!why.trim()} style={{ flex: 1 }}>보류하기</Big></div>
  </Modal>;
}

// 보류 버튼 (누르면 이유·다시 볼 날 창) — 오늘 카드 · 내 정리 · 지난 일 정리에서 같이 씀
export function HoldBtn({ t, A, after, tone, style, children }) {
  const [on, setOn] = useState(false);
  return <><TBtn tone={tone} style={style} onClick={() => setOn(true)}>{children || "보류"}</TBtn>
    {on && <HoldAsk title={`보류 · ${t.title}`} onNo={() => setOn(false)} onYes={(why, until) => { A.hold(t, why, until); setOn(false); if (after) after(); }} />}</>;
}
// 프로젝트 끝내기 · 멈추기 (책임자·마스터)
export function ProjEndAsk({ p, openT = [], A, onNo }) {
  const openN = openT.length, holdN = openT.filter((t) => t.status !== "hold").length;   // 보류는 이미 보류한 업무를 빼고 접음 · 중단은 보류한 것까지 접음
  const key0 = ymd(new Date()), [kind, setKind] = useState(openN ? "hold" : "completed"), [why, setWhy] = useState(""), [until, setUntil] = useState(""), [busy, setBusy] = useState(false);
  const K = [["completed", "완료", "다 해서 끝냄", openN ? `남은 업무 ${openN}건 · 다 끝나야 해요` : "남은 업무 0건"], ["dropped", "중단", "안 하기로 함", "남은 업무는 '중단'으로 접어요 (지우지 않음)"], ["hold", "보류", "나중에 다시", "다시 할 날에 책임자에게 알려요"]];
  const need = kind !== "completed", ok = !busy && (kind === "completed" ? openN === 0 : !!why.trim());
  const go = async () => { if (!ok) return; setBusy(true); const r = await A.endProject(p, kind, why.trim(), kind === "hold" ? until : ""); setBusy(false); if (r) onNo(); };
  const btn = kind === "completed" ? "완료하기" : kind === "dropped" ? `중단하기${openN ? ` · 업무 ${openN}건 접기` : ""}` : `보류하기${holdN ? ` · 업무 ${holdN}건 접기` : ""}`;
  return <Modal title="프로젝트 끝내기 · 멈추기" onNo={onNo}>
    <div style={{ fontSize: 13.5, color: C.sub }}>{p.title}</div>
    <div className="v2-endk" role="radiogroup" aria-label="끝내기 종류">{K.map(([k, l, d, s]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={"v2-endc" + (kind === k ? " on" : "")} disabled={k === "completed" && openN > 0} onClick={() => setKind(k)}>
      <b>{l}</b><span>{d}</span><small>{s}</small></button>)}</div>
    {need && <><div style={lab}>이유 (꼭)</div><Why list={kind === "dropped" ? DROP_WHY : HOLD_WHY} v={why} set={setWhy} /></>}
    {kind === "hold" && <><div style={lab}>다시 할 날</div><Until v={until} set={setUntil} key0={key0} /></>}
    <div style={{ display: "flex", gap: 8, marginTop: 18 }}><Big tone="white" onClick={onNo} style={{ flex: 1 }}>취소</Big>
      <Big onClick={go} disabled={!ok} style={{ flex: 2 }}>{busy ? "저장 중…" : btn}</Big></div>
    {kind === "hold" && <div style={{ fontSize: 12.5, color: C.mute, marginTop: 10, lineHeight: 1.6 }}>보류 중에는 오늘 화면·지난 일·사람 표에서 빠져요. 프로젝트 목록 '보류' 묶음에서 늘 보이고, 다시 시작할 때 기한을 한꺼번에 미룰 수 있어요.</div>}
  </Modal>;
}

// 다시 시작(보류) · 다시 열기(중단·완료): 그동안 소식 수 + 기한 미루기 고르기
export function ResumeAsk({ p, D, A, onNo }) {
  const key0 = ymd(new Date()), held = isHoldP(p), since = String(p.heldAt || p.droppedAt || p.completedAt || "");
  const days = since ? -ddays(since.slice(0, 10), key0) : null;
  const news = since ? (D.log || []).filter((x) => x.projectId === p.id && String(x.at) > since).length + (D.notes || []).filter((n) => !n.deleted && String(n.at) > since && String(n.itemId) === "proj:" + p.id).length : 0;
  const lb = String(p.id || "").startsWith("lb_");
  const [shift, setShift] = useState(held && days ? Math.min(days, 28) : 0), [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); const r = await A.resumeProject(p, lb ? 0 : shift); setBusy(false); if (r) onNo(); };
  return <Modal title={held ? "다시 시작" : "다시 열기"} onNo={onNo}>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{p.title} · {projStLabel(p)}{days != null ? ` ${days}일째` : ""}{p.holdReason && held ? ` · ${p.holdReason}` : p.dropReason && p.status === "dropped" ? ` · ${p.dropReason}` : ""}</div>
    <div style={{ fontSize: 13.5, color: C.text, marginTop: 8 }}>그동안 소식 {news}건 · 접어 둔 업무를 이전 상태로 되돌려요</div>
    {!lb ? <><div style={lab}>업무 기한</div>
      <div className="v2-chips">{[[0, "그대로"], [7, "1주 미루기"], [14, "2주 미루기"], ...(days > 0 && ![7, 14].includes(Math.min(days, 28)) ? [[Math.min(days, 28), `멈춘 만큼 ${Math.min(days, 28)}일`]] : [])].map(([d, l]) => <Chip key={d} on={shift === d} onClick={() => setShift(d)}>{l}</Chip>)}</div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{shift ? `기한이 있는 업무와 마감을 ${shift}일 뒤로(주말·공휴일이면 다음 평일)` : "기한은 그대로 둬요 · 지난 기한은 '지난 일 정리'에서 새로 정해요"}</div></>
      : <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8 }}>신제품은 출시일을 '출시일 바꾸기'로 옮기면 항목 기한이 같이 움직여요</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 18 }}><Big tone="white" onClick={onNo} style={{ flex: 1 }}>취소</Big>
      <Big onClick={go} disabled={busy} style={{ flex: 2 }}>{busy ? "저장 중…" : held ? "다시 시작" : "다시 열기"}</Big></div>
  </Modal>;
}
