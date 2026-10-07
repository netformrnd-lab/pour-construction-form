// 업무OS v2 — 없애기 · 휴지통 (사용자 확정 2026-10-07 "등록한거 삭제 방안은?" → 목록에서 빼기 + 휴지통)
//   반복 실행 · 고정업무 시트 [더 하기 ▾] [없애기] → RemoveAsk(무엇이 빠지고 무엇이 남는지 한 번 보여 주고 확인) → 5초 되돌리기
//   휴지통 줄 TrashList: 관리자 반복 실행 아래 '없앤 것 n ▾' · 더보기 › 내 고정업무 아래 '없앤 고정업무 n ▾' (접혀 있음) · [되살리기]
//   지우는 길은 없음 — 지난 체크·건수·메모·파일·대화는 그대로
import { useState } from "react";
import { C, TBtn, Card } from "./ui.jsx";
import { ago } from "./model.js";

// 없애기 확인 (시트 안 카드) — what: '이 반복 실행을' · where: 되살리는 곳 안내
export function RemoveAsk({ what, where, busy, onYes, onNo }) {
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{what} 목록에서 뺄까요?</div>
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
      <li>오늘 화면 · 반복 실행 · 관리자 목록 · 달성률에서 빠져요</li>
      <li>지난 체크 · 건수 · 메모 · 파일 · 대화는 그대로 남아요</li>
      <li>{where}에서 되살릴 수 있어요</li>
    </ul>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onNo}>그만</TBtn><TBtn tone="red" disabled={busy} onClick={onYes}>없애기</TBtn></div>
  </Card>;
}
// 없앤 것을 링크·휴지통에서 열었을 때 시트 맨 위 한 줄 — what: '없앤 고정업무예요'
export function RemovedNote({ what, rm, can, busy, onRestore }) {
  return <div role="status" className="v2-removed" style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#F8E9EA", border: "1px solid #EBC9CC", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <div style={{ flex: "1 1 200px", minWidth: 0, fontSize: 13.5, color: C.text, lineHeight: 1.5 }}><b style={{ color: C.red }}>{what}</b> · {rm.byName || "누군가"} · {ago(rm.at)}<br /><span style={{ color: C.sub, fontSize: 12.5 }}>목록에서 빠져 있어요 · 지난 기록은 그대로예요</span></div>
    {can && <TBtn v="solid" disabled={busy} onClick={onRestore}>되살리기</TBtn>}
  </div>;
}
// 휴지통 줄 — rows = model.trashRows · 처음엔 접힘
export function TrashList({ rows, A, open, label, note, canRestore }) {
  const [on, setOn] = useState(false), [busy, setBusy] = useState("");
  if (!rows || !rows.length) return null;
  const back = async (r) => { if (busy) return; setBusy(r.id); try { await (r.kind === "ak" ? A.akRestore(r.x) : A.fxRestore(r.x)); } finally { setBusy(""); } };
  return <div className="v2-trash" style={{ marginTop: 16 }}>
    <button type="button" aria-expanded={on} onClick={() => setOn(!on)} style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: "#fff", color: C.navy, fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
      {label} {rows.length} {on ? "▴" : "▾"}</button>
    {on && <Card style={{ marginTop: 6 }}>
      {rows.map((r, i) => <div key={r.kind + r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none" }}>
        <button type="button" onClick={() => open && open({ type: r.kind === "ak" ? "routine" : "fixed", id: r.id })} style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", padding: 0, fontFamily: "inherit", cursor: open ? "pointer" : "default" }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub} · {r.byName || "누군가"} 없앰 · {ago(r.at)}</span></button>
        {(!canRestore || canRestore(r)) && <TBtn disabled={!!busy} onClick={() => back(r)}>{busy === r.id ? "되살리는 중" : "되살리기"}</TBtn>}
      </div>)}
      {note && <div style={{ padding: "8px 14px 12px", fontSize: 12, color: C.mute, borderTop: `1px solid ${C.line}` }}>{note}</div>}
    </Card>}
  </div>;
}
