// 업무OS v2 — 결과 숫자 시트 (③ 결과 숫자 채우기 · 2026-10-17 · 계산 feeds.js · 쓰기 없음)
//   '확인할 것' 결과 숫자 줄 · 관리자 한눈에 카드 → 숫자마다 마지막으로 들어온 날 · 비면 'n일째'(빨강) · 어디서 고치나 [열기 ›]
//   판매는 CRM·그로홈 대시보드에서 3시간마다 저절로 · 광고 보고서·허브 리포트·보드 지표는 Aside (사람이 세팅)
import { md } from "./model.js";
import { C, Card, Sheet, TBtn, Head } from "./ui.jsx";
import { feedRows, lagText } from "./feeds.js";

const go = (url) => { try { window.open(url, "_blank", "noopener"); } catch (e) { console.error("[결과 숫자] 열기 실패:", e); } };
export function FeedList({ D, rows, compact }) {
  const list = rows || feedRows(D);
  if (!list.length) return <div style={{ padding: 14, color: C.mute, fontSize: 13.5 }}>확인할 숫자가 없어요</div>;
  return <>{list.map((r, i) => <div key={r.key} className="v2-feedrow" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px", borderBottom: i === list.length - 1 ? "none" : `1px solid ${C.line}`, background: "#fff" }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, wordBreak: "keep-all" }}>{r.label}</div>
      {!compact && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{r.fix}{r.sale ? ` · 판매 ${md(r.sale)}까지` : ""}</div>}
    </div>
    <div className="v2-feedr">
      <div style={{ fontSize: 13, fontWeight: 800, color: r.bad ? C.red : r.err || r.wait ? C.mute : C.green, lineHeight: 1.4 }}>{r.bad ? "" : r.err || r.wait ? "" : "✓ "}{lagText(r)}</div>
      {r.url && <TBtn onClick={() => go(r.url)} style={{ minHeight: 30, padding: "2px 10px", fontSize: 12.5 }} aria-label={`${r.label} 열기`}>열기 ›</TBtn>}
    </div></div>)}</>;
}
export function FeedSheet({ D, onBack, onClose }) {
  const rows = feedRows(D), bad = rows.filter((r) => r.bad).length, partial = !D.feeds || D.feeds.ads === undefined;
  return <Sheet title="결과 숫자" kind="결과 숫자" head="결과 숫자 · 들어온 날" path={bad ? `${bad}곳 비어 있음 · 비면 n일째` : "모두 들어오는 중"} onBack={onBack} onClose={onClose}>
    <div style={{ margin: "12px 0 10px", padding: "11px 13px", borderRadius: 12, background: "#F7F8FB", border: `1px solid ${C.line}`, fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>
      판매 숫자는 <b>CRM·그로홈 대시보드</b>에서 3시간마다 저절로 들어와요 · 광고 보고서·허브 리포트·보드 지표는 <b>Aside</b>가 올려요 (세팅은 사람)
      {partial ? <div style={{ fontSize: 12.5, color: C.mute, marginTop: 4 }}>광고 보고서·허브 리포트는 관리자·'광고 확인' 담당 화면에서만 확인해요</div> : null}</div>
    <Card><FeedList D={D} rows={rows} /></Card>
  </Sheet>;
}

// 관리자 한눈에 카드 — 비어 있는 것 먼저 · 6줄까지 · [자세히 ›] = 결과 숫자 시트
export function FeedCard({ D, open }) {
  const rows = feedRows(D).sort((a, b) => (b.bad ? 1 : 0) - (a.bad ? 1 : 0)), bad = rows.filter((r) => r.bad).length;
  return <><Head right={<TBtn onClick={() => open({ type: "feeds" })}>자세히 ›</TBtn>}>결과 숫자 {bad ? <span style={{ color: C.red }}>· {bad}곳 비어 있음</span> : <span style={{ color: C.green }}>· 모두 들어오는 중</span>}</Head>
    <Card><FeedList D={D} rows={rows.slice(0, 6)} compact /></Card></>;
}
