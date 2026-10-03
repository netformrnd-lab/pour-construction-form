// 업무OS v2 — 화면 공용 조각 (기업용 간결: 네이비·무채색, 이모지·아이콘 버튼·그라디언트 없음, 기호는 ✓ ✕ ▾ ▴ → ‹ › 만)
import { useEffect, useRef, useState } from "react";

export const C = { navy: "#24386B", ink: "#0F1F5C", text: "#1B2333", sub: "#5B6475", mute: "#8A92A3", line: "#E3E7F0", bg: "#F4F5F8", card: "#FFFFFF", red: "#B4383F", green: "#2F7D57", soft: "#EEF1F8" };
const F = "inherit";

// 큰 버튼 (화면마다 1개)
export function Big({ children, onClick, disabled, tone = "navy", style }) {
  const bg = tone === "navy" ? C.navy : tone === "white" ? "#fff" : C.green;
  return <button type="button" onClick={onClick} disabled={disabled} style={{ width: "100%", height: 52, borderRadius: 14, border: tone === "white" ? `1.5px solid ${C.line}` : "none", background: bg, color: tone === "white" ? C.ink : "#fff", fontSize: 16, fontWeight: 800, fontFamily: F, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, ...style }}>{children}</button>;
}
// 글자 버튼
export function TBtn({ children, onClick, tone, disabled, style, ...rest }) {
  return <button type="button" onClick={onClick} disabled={disabled} {...rest} style={{ border: "none", background: "none", padding: "8px 4px", fontSize: 13.5, fontWeight: 700, fontFamily: F, color: tone === "red" ? C.red : tone === "mute" ? C.mute : C.navy, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap", ...style }}>{children}</button>;
}
// 줄 오른쪽 작은 실행 버튼 ('완료' 등)
export function Act({ children, onClick, on, style }) {
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }} style={{ flex: "0 0 auto", minWidth: 56, height: 34, padding: "0 12px", borderRadius: 10, border: `1.5px solid ${on ? C.green : C.line}`, background: on ? "#EAF4EE" : "#fff", color: on ? C.green : C.ink, fontSize: 13, fontWeight: 800, fontFamily: F, cursor: "pointer", ...style }}>{children}</button>;
}
export function Chip({ children, on, onClick, style }) {
  return <button type="button" onClick={onClick} aria-pressed={!!on} style={{ padding: "8px 12px", borderRadius: 999, border: `1.5px solid ${on ? C.navy : C.line}`, background: on ? C.navy : "#fff", color: on ? "#fff" : C.sub, fontSize: 13, fontWeight: 700, fontFamily: F, cursor: "pointer", whiteSpace: "nowrap", ...style }}>{children}</button>;
}
// 두세 칸 전환
export function Seg({ items, value, onChange }) {
  return <div role="tablist" style={{ display: "flex", background: "#E8EBF2", borderRadius: 12, padding: 3, gap: 3 }}>
    {items.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: value === k ? "#fff" : "transparent", color: value === k ? C.ink : C.sub, fontSize: 13.5, fontWeight: 800, fontFamily: F, cursor: "pointer", boxShadow: value === k ? "0 1px 3px rgba(15,31,92,.12)" : "none" }}>{l}</button>)}
  </div>;
}
// 묶음 제목
export function Head({ children, right, red }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 2px 8px" }}>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: red ? C.red : C.ink, flex: 1, minWidth: 0 }}>{children}</h3>{right}
  </div>;
}
export function Card({ children, style }) { return <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.line}`, overflow: "hidden", ...style }}>{children}</div>; }
// 한 줄 (누르면 보기) — 오른쪽에 실행 버튼 1개
export function Row({ title, sub, sub2, right, onClick, dim, tag, tagTone, last }) {
  return <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", minHeight: 56, borderBottom: last ? "none" : `1px solid ${C.line}`, cursor: onClick ? "pointer" : "default", background: "#fff" }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {tag && <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 6, color: tagTone === "red" ? C.red : tagTone === "turn" ? "#fff" : C.navy, background: tagTone === "red" ? "#F8E9EA" : tagTone === "turn" ? C.navy : C.soft }}>{tag}</span>}
        <span style={{ fontSize: 15, fontWeight: 700, color: dim ? C.mute : C.text, textDecoration: dim ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      </div>
      {sub && <div style={{ marginTop: 3, fontSize: 12.5, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      {sub2 && <div style={{ marginTop: 2, fontSize: 12, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub2}</div>}
    </div>
    {right}
  </div>;
}
export function Empty({ children }) { return <div style={{ padding: "16px 14px", fontSize: 13.5, color: C.mute, background: "#fff" }}>{children}</div>; }
export function More({ children, onClick }) { return <button type="button" onClick={onClick} style={{ width: "100%", padding: "12px 14px", border: "none", borderTop: `1px solid ${C.line}`, background: "#fff", color: C.navy, fontSize: 13.5, fontWeight: 800, fontFamily: F, cursor: "pointer", textAlign: "left" }}>{children}</button>; }

// 시트: 폰은 전체 화면, PC(1024+)는 오른쪽 620px 패널
export function Sheet({ title, onBack, onClose, children, foot }) {
  useEffect(() => { const k = (e) => { if (e.key === "Escape") (onBack || onClose)(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onBack, onClose]);
  return <div className="v2-sheet-wrap" onClick={onClose}>
    <div className="v2-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, height: 54, padding: "0 8px", borderBottom: `1px solid ${C.line}`, flex: "0 0 auto", paddingTop: "env(safe-area-inset-top,0px)" }}>
        <TBtn onClick={onBack || onClose} style={{ fontSize: 15, padding: "8px 10px" }}>‹ {onBack ? "뒤로" : "닫기"}</TBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 15, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {onBack ? <TBtn onClick={onClose} style={{ padding: "8px 10px" }}>닫기</TBtn> : <span style={{ width: 64 }} />}
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 16px 24px" }}>{children}</div>
      {foot && <div style={{ flex: "0 0 auto", padding: "10px 16px calc(10px + env(safe-area-inset-bottom,0px))", borderTop: `1px solid ${C.line}`, background: "#fff" }}>{foot}</div>}
    </div>
  </div>;
}
// 페이지 안 확인 창 (confirm() 대신)
export function Ask({ title, body, yes, no = "취소", onYes, onNo, danger }) {
  return <div className="v2-sheet-wrap" style={{ alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={onNo}>
    <div role="alertdialog" onClick={(e) => e.stopPropagation()} style={{ width: "min(420px, calc(100% - 32px))", background: "#fff", borderRadius: 18, padding: 20 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: C.ink }}>{title}</h3>
      <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <Big tone="white" onClick={onNo} style={{ flex: 1 }}>{no}</Big>
        <Big onClick={onYes} style={{ flex: 1, background: danger ? C.red : C.navy }}>{yes}</Big>
      </div>
    </div>
  </div>;
}
// 아래 알림 (+ 5초 되돌리기)
export function Toast({ toast, onDone }) {
  useEffect(() => { if (!toast) return; const t = setTimeout(onDone, toast.undo ? 5000 : 2600); return () => clearTimeout(t); }, [toast]);
  if (!toast) return null;
  return <div className="v2-toast" role="status">
    <span style={{ flex: 1 }}>{toast.text}</span>
    {toast.undo && <button type="button" onClick={() => { toast.undo(); onDone(); }} style={{ border: "none", background: "none", color: "#C9D3F2", fontSize: 14, fontWeight: 800, fontFamily: F, cursor: "pointer", padding: "4px 2px" }}>되돌리기</button>}
  </div>;
}
export const inp = { width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.text, boxSizing: "border-box" };
export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s == null ? init : JSON.parse(s); } catch (_) { return init; } });
  const set = (x) => setV((old) => { const nx = typeof x === "function" ? x(old) : x; try { localStorage.setItem(key, JSON.stringify(nx)); } catch (_) {} return nx; });
  return [v, set];
}
export function useAutoFocus() { const r = useRef(null); useEffect(() => { const t = setTimeout(() => r.current && r.current.focus(), 60); return () => clearTimeout(t); }, []); return r; }
export function Linked({ text }) {
  const s = String(text || ""); const parts = s.split(/(https?:\/\/[^\s<>"']+)/g);
  return <>{parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: C.navy, wordBreak: "break-all" }}>{p}</a> : <span key={i}>{p}</span>)}</>;
}
