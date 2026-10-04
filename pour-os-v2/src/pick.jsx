// 업무OS v2 — 여러 개 골라서 한꺼번에 (관리자 정리 · 사람 표 · 실사용 '담당 정할 항목')
// 안전장치: 한 번에 100건 · 누르기 전 문장 미리 보기 · 30건 이상이면 확인 창 · 5초 되돌리기 · 기록(이전 값) · 삭제 없음 · 맡긴 사람(requestedBy) 그대로
import { useState } from "react";
import { ymd, addDays, md, ddays, ddayLabel, dueOf, ownersOf, nameOf, activeUsers, weekStart, nextWorkday, prevWorkday, isOffDay, WD, isDone, taskNoteId } from "./model.js";
import { C, Act, Chip, TBtn, Ask, Card, Empty } from "./ui.jsx";

// 묶음 목록 + 고르기 칸 (줄을 누르면 업무 보기)
// right: (t) => 줄 오른쪽 작은 버튼 (예: 댓글) — 없으면 안 그림
export function PickList({ D, groups, sel, setSel, open, temp, max = 60, right }) {
  const [more, setMore] = useState({});
  const key = ymd(new Date());
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return <>{groups.map((g) => { const all = g.items.every((t) => sel.has(t.id)), shown = more[g.key] ? g.items : g.items.slice(0, max);
    return <div key={g.key} style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 6px" }}>
        <b style={{ flex: 1, fontSize: 14, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label} {g.items.length}</b>
        <TBtn onClick={() => setSel((s) => { const n = new Set(s); g.items.forEach((t) => (all ? n.delete(t.id) : n.add(t.id))); return n; })}>{all ? "모두 풀기" : "이 묶음 모두 고르기"}</TBtn>
      </div>
      <Card>{shown.map((t, i) => { const n = ddays(dueOf(t), key), on = sel.has(t.id), p = (D.projects || []).find((x) => x.id === t.projectId);
        return <div key={t.id} style={{ display: "flex", alignItems: "center", borderBottom: i < shown.length - 1 ? `1px solid ${C.line}` : "none", background: on ? "#F2F4FA" : "#fff" }}>
          <button type="button" role="checkbox" aria-checked={on} aria-label={`${t.title} 고르기`} onClick={() => toggle(t.id)} style={{ flex: "0 0 48px", height: 52, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? C.navy : "#B7BFD0"}`, background: on ? C.navy : "#fff", color: "#fff", fontSize: 13, lineHeight: "16px", textAlign: "center", fontWeight: 900 }}>{on ? "✓" : ""}</span></button>
          <div role="button" tabIndex={0} onClick={() => open({ type: t.isFixed ? "fixed" : "task", id: t.id })} onKeyDown={(e) => { if (e.key === "Enter") open({ type: t.isFixed ? "fixed" : "task", id: t.id }); }} style={{ flex: 1, minWidth: 0, padding: "9px 12px 9px 0", cursor: "pointer" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[(nameOf(D.users, ownersOf(t)[0]) || "담당 없음") + (temp && temp.has(t.id) ? "(임시)" : ""), p && p.title, dueOf(t) ? <span key="d" style={{ color: n < 0 ? C.red : C.sub }}>{md(dueOf(t))} {ddayLabel(n)}</span> : "기한 없음"].filter(Boolean).reduce((a, x, j) => (j ? [...a, " · ", x] : [x]), [])}</div>
          </div>{right && <div style={{ flex: "0 0 auto", paddingRight: 10 }}>{right(t)}</div>}</div>; })}
        {g.items.length > shown.length && <button type="button" onClick={() => setMore({ ...more, [g.key]: true })} style={{ width: "100%", padding: 12, border: "none", borderTop: `1px solid ${C.line}`, background: "#fff", color: C.navy, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>{g.items.length - shown.length}개 더 ▾</button>}
        {!g.items.length && <Empty>없어요</Empty>}</Card>
    </div>; })}</>;
}

// 조사 '으로/로' (받침 있으면 으로, ㄹ 받침·받침 없음은 로) — 숫자는 읽는 소리로
const DIG = { 0: 1, 3: 1, 6: 1 };
export const ro = (w) => { const s = String(w || ""), c = s.charCodeAt(s.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) { const j = (c - 0xac00) % 28; return j && j !== 8 ? "으로" : "로"; }
  if (/[0-9]$/.test(s)) return DIG[s.slice(-1)] ? "으로" : "로"; return "로"; };
// 기한 고르기 칩: 쉬는 날(주말·공휴일)은 빼고, 금요일이 공휴일이면 앞 평일
export function dueChips(key) {
  const fri = addDays(weekStart(key), 4), lab = (pre, d) => `${pre} ${WD[new Date(d + "T00:00:00").getDay()]} ${md(d)}`;
  const thisFri = prevWorkday(fri), nextFri = prevWorkday(addDays(fri, 7)), tmr = nextWorkday(addDays(key, 1));
  return [!isOffDay(key) && ["오늘", key], [tmr === addDays(key, 1) ? "내일" : `다음 평일 ${md(tmr)}`, tmr], thisFri > tmr && [lab("이번 주", thisFri), thisFri], [lab("다음 주", nextFri), nextFri]].filter(Boolean);
}

// 아래에 붙는 한꺼번에 바꾸기 막대
// 모든 쓰기(기한·담당·보류·날짜 없이 두기·담당에게 묻기)는 같은 문지기: 30건 이상이면 확인 창 → A.bulk(100건까지 · 5초 되돌리기 · 이전 값 기록)
// 결과 알림은 A.toast(core useActs) — 막대 props 는 그대로
const NOTE_MAX = 30;   // 담당에게 묻기: 댓글은 지울 수 없어서 한 번에 30건까지
export function BulkBar({ D, cu, A, ids, clear }) {
  const [mode, setMode] = useState(""), [val, setVal] = useState(null), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const ts = [...ids].map((id) => (D.tasks || []).find((t) => t.id === id)).filter((t) => t && !isDone(t));
  if (!ts.length) return null;
  const key = ymd(new Date());
  const auto = ts.filter((t) => t.dueAuto).length;
  // 담당 바꾸기: 이미 그 사람 혼자 맡은 일은 건드리지 않음 → 그 사람의 '받았어요'(ackAt)가 지워지지 않고, 새로 맡긴 것처럼 안 보임
  const who = mode === "who" && val ? nameOf(D.users, val) : "";
  const tw = who ? ts.filter((t) => { const o = ownersOf(t); return !(o.length === 1 && o[0] === val); }) : ts;
  const fromNames = [...new Set(tw.map((t) => nameOf(D.users, ownersOf(t)[0]) || "담당 없음"))].slice(0, 2).join("·");
  const plan = !val ? null
    : mode === "due" ? { label: `기한 ${md(val)}`, text: `${ts.length}건 기한을 ${md(val)}${ro(md(val))}${auto ? ` · 출시일 연동이 풀려요 ${auto}개` : ""}`, f: () => ({ dueDate: val, dueAuto: false, dueReq: null }) }
    : mode === "who" ? (!tw.length ? { none: true, text: `고른 ${ts.length}건 모두 이미 ${who}님 담당이에요` }
      : { label: `담당 → ${who}`, ts: tw, text: `${tw.length}건 담당을 ${fromNames} → ${who}${ro(who)} · 맡긴 사람은 그대로${ts.length > tw.length ? ` · 이미 ${who}님 담당인 ${ts.length - tw.length}건은 그대로` : ""}`, f: (t, bulkId) => ({ assigneeId: val, assigneeIds: [val], ownerAuto: false, ownerFrom: "set", assignedBy: cu.id, assignedAt: new Date().toISOString(), bulkId, ackAt: val === cu.id ? new Date().toISOString() : null }) })
    : null;
  const run = async (p) => { if (busy) return; setBusy(true); const done = await A.bulk(p.ts || ts, p.f, p.label); setBusy(false); setAsk(false); if (done) { setMode(""); setVal(null); clear(); } };
  const go = (p) => { const n = (p.ts || ts).length; return n >= 30 && n <= 100 ? setAsk(p) : run(p); };   // 100건 넘으면 묻지 않고 A.bulk 가 '100건까지' 알림
  const quick = (label, text, f) => go({ label, text: `${ts.length}건 ${text}`, f });
  const askAll = async () => { if (busy) return; setAsk(false); setBusy(true); let n = 0;
    for (const t of ts.slice(0, NOTE_MAX)) if (await A.addNote(taskNoteId(t.id), `아직 하나요? 끝났으면 '끝냈어요'를, 아니면 새 기한을 정해 주세요 · ${cu.name}`, null, [], { taskId: t.id, projectId: t.projectId })) n++;
    setBusy(false); clear(); if (n && A.toast) A.toast(`${n}건 담당에게 물었어요 · 답은 업무 댓글로 와요`); };
  const askGo = () => (ts.length >= 30 ? setAsk({ kind: "note" }) : askAll());
  const people = activeUsers(D.users);
  return <div className="v2-bulk" role="region" aria-label="한꺼번에 바꾸기">
    {mode === "due" && <div className="v2-chips" style={{ marginBottom: 8 }}>{dueChips(key).map(([l, d]) => <Chip key={l} on={val === d} onClick={() => setVal(d)}>{l}</Chip>)}
      <input type="date" aria-label="날짜" value={val || ""} onChange={(e) => setVal(e.target.value)} className="v2-sel" /></div>}
    {mode === "who" && <div className="v2-chips" style={{ marginBottom: 8, maxHeight: 120, overflowY: "auto" }}>{people.map((u) => <Chip key={u.id} on={val === u.id} onClick={() => setVal(u.id)}>{u.id === cu.id ? "나" : u.name}</Chip>)}</div>}
    {plan && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ flex: 1, fontSize: 13, color: "#DCE2F2" }}>{plan.text}</span>{!plan.none && <Act onClick={() => go(plan)} style={{ background: "#fff", color: C.ink, borderColor: "#fff" }}>{busy ? "저장 중" : "이대로 바꾸기"}</Act>}</div>}
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      <b style={{ fontSize: 14, marginRight: 4 }}>{ts.length}개 고름</b>
      <button type="button" className={"v2-bbtn" + (mode === "due" ? " on" : "")} onClick={() => { setMode(mode === "due" ? "" : "due"); setVal(null); }}>기한 ▾</button>
      <button type="button" className={"v2-bbtn" + (mode === "who" ? " on" : "")} onClick={() => { setMode(mode === "who" ? "" : "who"); setVal(null); }}>담당 ▾</button>
      <button type="button" className="v2-bbtn" disabled={busy} onClick={() => quick("보류", "보류로", () => ({ status: "hold" }))}>보류</button>
      <button type="button" className="v2-bbtn" disabled={busy} onClick={() => quick("날짜 없이 두기", "날짜 없이 두기 · 이번 달 정리에서 빠져요", () => ({ tidySkip: key.slice(0, 7) }))}>날짜 없이 두기</button>
      <button type="button" className="v2-bbtn" disabled={busy || ts.length > NOTE_MAX} onClick={askGo}>{ts.length > NOTE_MAX ? `묻기 ${NOTE_MAX}건까지` : "담당에게 묻기"}</button>
      <span style={{ flex: 1 }} /><button type="button" className="v2-bbtn" onClick={clear} aria-label="고르기 풀기">✕ 풀기</button>
    </div>
    {ask && (ask.kind === "note"
      ? <Ask title={`${ts.length}건 담당에게 물을까요?`} body={`고른 ${ts.length}건마다 담당에게 '아직 하나요?' 댓글을 남겨요.\n댓글은 지울 수 없어요.`} yes="묻기" onNo={() => setAsk(false)} onYes={askAll} />
      : <Ask title={`${(ask.ts || ts).length}건 한꺼번에 바꿀까요?`} body={`${ask.text}\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.`} yes="바꾸기" onNo={() => setAsk(false)} onYes={() => run(ask)} />)}
  </div>;
}
