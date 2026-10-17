// 업무OS v2 — AI 실행 업무 흔적 (사용자 결정 2026-10-15 "마케터들은 업무 흔적 꼭 남기게 · 어떤 포스팅인지 어떤 인플루언서에게 댓글단건지 AI가 알아서 세팅 · 사람팀원이 직접 확인해서 KPI 추적")
//   실행 업무(aiAsk) 맨 위 상자: 승인한 번호마다 AI 가 채운 한 줄·링크 → [했어요](링크 고침 가능) · [안 함](이유) · 되돌리기
//   번호가 없는 실행 = '무엇을 했는지' 한 줄(링크) 하나 · 다 남겨야 [끝냈어요] (core.finish 가 막음)
//   [했어요] = tasks.aiTrace · aiasks.trace · 짝지은 반복 실행 +1(흔적 같이 · KPI) — 계산 aiask.js traceList·traceOf·traceLeft · 쓰기 core.jsx aiTrace
import { useState } from "react";
import { md } from "./model.js";
import { C, TBtn, Act, inp, Linked } from "./ui.jsx";
import { traceList, traceOf, traceLeft, traceDoneN } from "./aiask.js";

function TraceRow({ t, x, can, A, last }) {
  const r = traceOf(t, x.n), [link, setLink] = useState(x.link || ""), [note, setNote] = useState(""), [mode, setMode] = useState(""), [busy, setBusy] = useState(false);
  const go = async (f) => { if (busy) return; setBusy(true); try { const ok = await A.aiTrace(t, x.n, f); if (ok) setMode(""); } finally { setBusy(false); } };
  const one = x.n === "_";
  return <div style={{ padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, wordBreak: "break-word" }}>{!one && <b style={{ color: C.navy, marginRight: 6 }}>{x.n}</b>}{x.t}</div>
    {r ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6, fontSize: 12.5, color: C.sub }}>
        <b style={{ color: r.skip ? C.sub : C.green }}>{r.skip ? "안 함" : "했어요 ✓"}</b><span>{r.byName} {r.date ? md(r.date) : ""}</span>
        {r.link && <span style={{ minWidth: 0, wordBreak: "break-all" }}><Linked text={r.link} /></span>}{r.note && <span>· {r.note}</span>}
        {can && <TBtn disabled={busy} onClick={() => go(null)} aria-label={`${one ? "흔적" : x.n} 되돌리기`}>되돌리기</TBtn>}</div>
      : can && <div style={{ marginTop: 8 }}>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={one ? "링크 (게시물·댓글·DM 등)" : "링크 (AI가 채움 · 실제 주소로 고쳐도 돼요)"} aria-label={`${one ? "흔적" : x.n} 링크`} inputMode="url" style={{ ...inp, padding: "8px 10px", fontSize: 14 }} />
        {(one || mode === "skip") && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "skip" ? "안 한 이유 (예: 답장 없음 · 일정 밀림)" : "한 줄 (무엇을 했는지)"} aria-label={`${one ? "흔적" : x.n} ${mode === "skip" ? "안 한 이유" : "한 줄"}`} style={{ ...inp, padding: "8px 10px", fontSize: 14, marginTop: 6 }} />}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {mode === "skip" ? <><Act disabled={busy} onClick={() => go({ skip: true, note })} style={{ background: C.navy, color: "#fff", borderColor: C.navy }} aria-label={`${one ? "흔적" : x.n} 안 함 남기기`}>안 함 남기기</Act><Act onClick={() => setMode("")}>취소</Act></>
            : <><Act disabled={busy} onClick={() => go({ link, note })} style={{ background: C.navy, color: "#fff", borderColor: C.navy }} aria-label={`${one ? "흔적" : x.n} 했어요`}>했어요</Act>{!one && <Act onClick={() => setMode("skip")} aria-label={`${x.n} 안 함`}>안 함</Act>}</>}
        </div></div>}
  </div>;
}

export function AiTraceBox({ t, can, A, open, D }) {
  if (!t || !t.aiAsk) return null;
  const list = traceList(t), left = traceLeft(t), done = traceDoneN(t);
  return <div className="v2-trace" style={{ background: "#fff", border: `1.5px solid ${left ? "#C9D3EA" : "#BFE3CF"}`, borderRadius: 14, padding: "12px 14px", marginTop: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <b style={{ fontSize: 14.5, color: C.ink }}>흔적 남기기</b>
      <span style={{ fontSize: 12.5, color: left ? C.navy : C.green, fontWeight: 800 }}>{left ? `${list.length}개 중 ${list.length - left}개 남김` : `다 남김 · 했어요 ${done}개`}</span>
      <span style={{ flex: 1 }} />{open && <TBtn onClick={() => open({ type: "aiask", id: t.aiAsk })}>AI 승인 보기 ›</TBtn>}</div>
    <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, marginTop: 4 }}>AI가 준비한 일이에요 · 한 번 할 때마다 [했어요] (링크 남김){t.aiAk || (t.aiAks || []).length ? " · 짝지은 반복 실행(내 것)에도 +1" : ""}{t.aiLaunch ? ` · 신제품 '${t.aiProd || "?"}' 개수에도 +1` : ""} · 다 남겨야 '끝냈어요'</div>
    {t.aiLaunch && (() => { const lt = t.aiLaunchTask ? (D.tasks || []).find((x) => x.id === t.aiLaunchTask) : null;   // 디맨드젠 = 그 신제품 칸 (2026-10-15)
      return lt ? <div style={{ marginTop: 4 }}><TBtn onClick={() => open && open({ type: "task", id: lt.id })} style={{ padding: "2px 0" }}>신제품 · {t.aiProd} · {lt.title} ›</TBtn></div>
        : <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>신제품 '{t.aiProd || "?"}' 칸을 못 찾았어요 · [했어요]는 남지만 신제품 개수는 안 올라가요</div>; })()}
    <div style={{ marginTop: 4 }}>{list.map((x, i) => <TraceRow key={x.n} t={t} x={x} can={can} A={A} last={i === list.length - 1} />)}</div>
  </div>;
}
