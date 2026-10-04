// 업무OS v2 — 요청 하나로: [확인 받기 · 도와주세요 · 기한 바꾸기] + 받을 사람 (기본 = 맡긴 사람 → 넘겨준 사람 → 프로젝트 책임자 → 마스터)
// 받는 사람 '확인할 것'에 뜨고(관리자도 '나에게 온 것'), 답은 업무 대화로 오가며 물은 사람에게도 알림
import { useState } from "react";
import { C, Big, Chip, inp } from "./ui.jsx";
import { ymd, md, addDays, nextWorkday, dueOf, nameOf, activeUsers, askTo } from "./model.js";

export function RequestAsk({ t, D, cu, A, mine, onNo }) {
  const key = ymd(new Date()), canConfirm = mine && t.status !== "review";
  const [kind, setKind] = useState(canConfirm ? "confirm" : "help"), [to, setTo] = useState(askTo(t, D, cu.id)), [text, setText] = useState(""), [date, setDate] = useState("");
  const K = [["confirm", "확인 받기", "끝냈어요 · 봐 주세요"], ["help", "도와주세요", "막히기 전에 같이"], ["due", "기한 바꾸기", "새 기한을 부탁"]].filter(([k]) => k !== "confirm" || canConfirm);
  const base = dueOf(t) && dueOf(t) > key ? dueOf(t) : key, dchips = [["+1일", nextWorkday(addDays(base, 1))], ["+3일", nextWorkday(addDays(base, 3))], ["+1주", nextWorkday(addDays(base, 7))]];
  const ok = !!to && (kind !== "help" || text.trim()) && (kind !== "due" || (date && date !== dueOf(t)));
  const users = activeUsers(D.users).filter((u) => u.id !== cu.id);
  return <div className="v2-sheet-wrap" style={{ alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={(e) => { e.stopPropagation(); onNo(); }}>
    <div role="dialog" aria-label="요청 보내기" onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, calc(100% - 24px))", maxHeight: "calc(100% - 32px)", overflowY: "auto", background: "#fff", borderRadius: 18, padding: 18 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.ink }}>요청 보내기</h3>
      <div style={{ fontSize: 13.5, color: C.sub }}>{t.title}</div>
      <div className="v2-endk" role="radiogroup" aria-label="요청 종류" style={{ gridTemplateColumns: `repeat(${K.length}, minmax(0, 1fr))` }}>{K.map(([k, l, d]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={"v2-endc" + (kind === k ? " on" : "")} onClick={() => setKind(k)}><b>{l}</b><small>{d}</small></button>)}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 0 6px" }}>받을 사람</div>
      <select aria-label="받을 사람" className="v2-sel" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%" }}><option value="">고르기 ▾</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === askTo(t, D, cu.id) ? " (기본)" : ""}</option>)}</select>
      {kind === "due" && <><div style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 0 6px" }}>새 기한 (지금 {md(dueOf(t)) || "미정"})</div>
        <div className="v2-chips">{dchips.map(([l, d]) => <Chip key={l} on={date === d} onClick={() => setDate(d)}>{l} {md(d)}</Chip>)}</div>
        <input type="date" aria-label="새 기한" className="v2-sel" value={date} min={key} onChange={(e) => setDate(e.target.value)} style={{ marginTop: 8 }} />
        {date && date === dueOf(t) && <div style={{ fontSize: 12.5, color: C.red, marginTop: 4 }}>지금 기한과 같은 날이에요</div>}</>}
      <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 0 6px" }}>한마디{kind === "help" ? " (꼭)" : " (선택)"}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="요청 내용" placeholder={kind === "help" ? "무엇을 도와주면 될까요? (예: 상세페이지 문구 같이 봐 주세요)" : kind === "confirm" ? "확인할 곳 (예: 시안 2안 중 골라 주세요)" : "왜 바꿔야 하나요?"} style={{ ...inp, resize: "vertical" }} />
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>{to ? `${nameOf(D.users, to)}님 '확인할 것'에 떠요` : "받을 사람을 골라 주세요"}{kind === "confirm" ? " · 확인되면 끝남, 고칠 게 있으면 수정 요청이 와요" : ""}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}><Big tone="white" onClick={onNo} style={{ flex: 1 }}>취소</Big>
        <Big disabled={!ok} onClick={() => { if (!ok) return; A.ask(t, kind, to, text, date); onNo(); }} style={{ flex: 2 }}>보내기</Big></div>
    </div></div>;
}
