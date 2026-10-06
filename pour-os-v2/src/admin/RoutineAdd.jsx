// 관리자 · 반복 실행 [+ 반복 실행] · [기록 보기 ›] (3단계 · 사용자 확정 2026-10-06 · 시안 mockups/step13)
//   [+ 반복 실행]: [정한 날 체크 | 횟수 목표] → 이름 · 브랜드(꼭 · 공통 운영 포함) · 담당 · 반복 또는 목표(주/월/분기 + 숫자 + 회/건) · 체크리스트 · 건수 칸
//     정한 날 체크 = v2 고정업무 문서(scope 'brand') · 횟수 목표 = 덧칠 created(kpidefs · id v2k_act_… · 버전1 문서는 그대로)
//   [기록 보기 ›]: 이번 달 날짜 × 사람(회·건) 표 · ‹ › 달 넘기기 · CSV 내려받기는 [더 하기 ▾] 안
import { useEffect, useMemo, useState } from "react";
import * as fb from "../fb.js";
import { C, Big, TBtn, Chip, Seg, Card, Empty, Sheet, inp } from "../ui.jsx";
import { activeUsers, brandsWithCommon, FX_WD, md, WD } from "../model.js";
import { recTable, recCsv, QTY_UNITS } from "../rec.js";

const lab = { fontSize: 13, fontWeight: 800, color: C.ink, margin: "16px 0 6px" };
export function AddRoutineSheet({ D, A, onBack, onClose }) {
  const [f, setF] = useState({ kind: "check", name: "", brand: "", who: [], rt: "daily", wd: ["월"], mday: "1", time: "", cyc: "M", goal: "1", unit: "회", subs: [], qtyU: "", qtyL: "" });
  const [sub, setSub] = useState(""), [busy, setBusy] = useState(false);
  const set = (x) => setF({ ...f, ...x });
  const ok = f.name.trim() && f.brand && (f.kind === "count" ? +f.goal > 0 : f.rt !== "weekly" || f.wd.length > 0);
  const addSub = () => { const v = sub.trim(); if (!v) return; set({ subs: [...f.subs, v] }); setSub(""); };
  const save = async () => { if (!ok || busy) return; setBusy(true);
    const subs = [...f.subs, ...(sub.trim() ? [sub.trim()] : [])], qty = f.qtyU ? { label: f.qtyL.trim() || "건수", unit: f.qtyU } : null;
    const id = f.kind === "count" ? await A.akCreate({ name: f.name, brand: f.brand, who: f.who, cyc: f.cyc, goal: +f.goal, unit: f.unit, subs, qty })
      : await A.addRoutineFixed({ title: f.name, brand: f.brand, who: f.who, recurType: f.rt, weekDays: f.wd, monthDay: f.mday === "end" ? 31 : +f.mday, monthEnd: f.mday === "end", fixedTime: f.time, subs, qty });
    setBusy(false); if (id) onBack ? onBack() : onClose(); };
  const miss = !f.name.trim() ? "이름을 적어 주세요" : !f.brand ? "브랜드를 골라 주세요" : "";
  return <Sheet title="반복 실행 만들기" kind="반복 실행" head="반복 실행 만들기" path="반복 실행 = 브랜드가 문제없이 돌아가게 하는 일" onBack={onBack} onClose={onClose}
    foot={<><Big onClick={save} disabled={!ok || busy}>저장</Big><div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, textAlign: "center" }}>{miss || "저장하면 담당의 오늘 화면 '반복 실행'에 바로 떠요"}</div></>}>
    <div style={lab}>어떤 반복이에요</div>
    <Seg items={[["check", "정한 날 체크"], ["count", "횟수 목표"]]} value={f.kind} onChange={(kind) => set({ kind })} />
    <div style={{ fontSize: 12, color: C.mute, marginTop: 6 }}>{f.kind === "check" ? "CS 확인 · 발주 · 재고 · 정산처럼 정한 날에 체크해요" : "주 4건 · 월 1회처럼 기간 안에 횟수를 채워요"}</div>
    <div style={lab}>이름</div>
    <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={f.kind === "check" ? "예: 오전 CS 확인" : "예: 고객안내전화"} aria-label="반복 실행 이름" style={inp} />
    <div style={lab}>브랜드 <span style={{ color: C.mute, fontWeight: 700 }}>(꼭 골라요)</span></div>
    <div className="v2-chips" role="group" aria-label="브랜드">{brandsWithCommon(D.brands).map((b) => <Chip key={b.id} on={f.brand === b.id} onClick={() => set({ brand: b.id })}>{f.brand === b.id ? "✓ " : ""}{b.name}</Chip>)}</div>
    <div style={lab}>담당 <span style={{ color: C.mute, fontWeight: 700 }}>(여러 명 가능)</span></div>
    <div className="v2-chips" role="group" aria-label="담당">{activeUsers(D.users).map((u) => { const k = f.who.includes(u.id); return <Chip key={u.id} on={k} onClick={() => set({ who: k ? f.who.filter((x) => x !== u.id) : [...f.who, u.id] })}>{k ? "✓ " : ""}{u.name}</Chip>; })}</div>
    {f.kind === "check" ? <>
      <div style={lab}>반복</div>
      <Seg items={[["daily", "매일"], ["weekly", "매주"], ["monthly", "매월"]]} value={f.rt} onChange={(rt) => set({ rt })} />
      {f.rt === "weekly" && <div className="v2-chips" style={{ marginTop: 8 }} role="group" aria-label="요일">{FX_WD.map((d) => <Chip key={d} on={f.wd.includes(d)} onClick={() => set({ wd: f.wd.includes(d) ? f.wd.filter((x) => x !== d) : FX_WD.filter((x) => x === d || f.wd.includes(x)) })}>{d}</Chip>)}</div>}
      {f.rt === "monthly" && <select aria-label="매월 날짜" className="v2-sel" style={{ marginTop: 8 }} value={f.mday} onChange={(e) => set({ mday: e.target.value })}>
        {[...Array(31)].map((_, i) => <option key={i} value={String(i + 1)}>{i + 1}일</option>)}<option value="end">말일 (평일 기준)</option></select>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}><span style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>시간 (선택)</span><input type="time" aria-label="시간" className="v2-sel" value={f.time} onChange={(e) => set({ time: e.target.value })} />{f.time && <TBtn onClick={() => set({ time: "" })}>지우기</TBtn>}</div>
    </> : <>
      <div style={lab}>목표</div>
      <Seg items={[["W", "주"], ["M", "월"], ["Q", "분기"]]} value={f.cyc} onChange={(cyc) => set({ cyc })} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input inputMode="numeric" value={f.goal} onChange={(e) => set({ goal: e.target.value.replace(/\D/g, "") })} aria-label="목표 숫자" style={{ ...inp, width: 90, padding: "9px 12px" }} />
        {["회", "건"].map((u) => <Chip key={u} on={f.unit === u} onClick={() => set({ unit: u })}>{u}</Chip>)}
        <span style={{ fontSize: 12.5, color: C.sub }}>{f.cyc === "W" ? "주" : f.cyc === "M" ? "월" : "분기"} {+f.goal || 0}{f.unit}</span></div>
    </>}
    <div style={lab}>체크리스트 <span style={{ color: C.mute, fontWeight: 700 }}>(선택{f.kind === "count" ? " · 다 하면 1회" : ""})</span></div>
    {f.subs.length > 0 && <div className="v2-chips" style={{ marginBottom: 8 }}>{f.subs.map((x, i) => <Chip key={i} on onClick={() => set({ subs: f.subs.filter((_, j) => j !== i) })}>{x} ✕</Chip>)}</div>}
    <div style={{ display: "flex", gap: 8 }}><input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} placeholder="예: 명단 뽑기" aria-label="체크리스트 항목" style={{ ...inp, flex: 1, minWidth: 0 }} /><TBtn onClick={addSub} disabled={!sub.trim()}>추가</TBtn></div>
    <div style={lab}>건수 칸 <span style={{ color: C.mute, fontWeight: 700 }}>(선택 · 그날 몇 건 했는지)</span></div>
    <div className="v2-chips" role="group" aria-label="건수 칸 단위"><Chip on={!f.qtyU} onClick={() => set({ qtyU: "" })}>끔</Chip>{QTY_UNITS.map((u) => <Chip key={u} on={f.qtyU === u} onClick={() => set({ qtyU: u })}>{u}</Chip>)}</div>
    {f.qtyU && <input value={f.qtyL} onChange={(e) => set({ qtyL: e.target.value })} placeholder="무엇을 세나요 · 예: 처리한 문의 · 전화" aria-label="건수 칸 이름" style={{ ...inp, marginTop: 8 }} />}
    {f.qtyU && f.kind === "count" && <div style={{ fontSize: 12, color: C.mute, marginTop: 6 }}>{f.unit === "건" ? "목표가 '건'이라 넣은 숫자가 목표에도 더해져요" : "목표는 [+1]로 세고, 건수는 날짜별 기록으로 남아요"}</div>}
  </Sheet>;
}

// [기록 보기 ›] 날짜 × 사람 (회 = 체크 ✓ + 횟수 +1 · 건 = 그날 건수 합)
export function RecBookSheet({ D, onBack, onClose }) {
  const now = new Date(), [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`), [docs, setDocs] = useState(null), [more, setMore] = useState(false);
  useEffect(() => { let live = true; setDocs(null); fb.fetchWhere("checks", ["ym", "==", ym]).then((a) => { if (live) setDocs(a); }).catch((e) => { console.error("[v2 checks] 달 기록 읽기 실패:", e); if (live) setDocs([]); }); return () => { live = false; }; }, [ym]);
  const T = useMemo(() => recTable(docs || [], ym), [docs, ym]);
  const mv = (d) => { const [y, m] = ym.split("-").map(Number), x = new Date(y, m - 1 + d, 1); setYm(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); };
  const nameOf = (d) => { const it = ((D.ak && D.ak.items) || []).find((x) => x.id === d.itemId); if (it) return it.name; const t = (D.tasks || []).find((x) => x.id === d.itemId); return t ? t.title : d.itemId; };
  const csv = () => { const blob = new Blob([recCsv(docs || [], nameOf)], { type: "text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `routine-records-${ym}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const cellT = (c) => (!c ? "" : `${c.runs + c.on}회${c.qty ? ` · ${c.qty}건` : ""}`);
  const tot = (uid) => T.days.reduce((a, d) => { const c = T.cell(d, uid); return c ? { n: a.n + c.runs + c.on, q: a.q + c.qty } : a; }, { n: 0, q: 0 });
  return <Sheet title="반복 실행 기록" kind="반복 실행" head={`기록 · ${+ym.slice(5)}월`} path="날짜 × 사람 · 회 = 체크 + 횟수 · 건 = 그날 건수" onBack={onBack} onClose={onClose}>
    <div className="a-rtnav" style={{ marginTop: 12 }}><TBtn onClick={() => mv(-1)} aria-label="지난달">‹</TBtn><b>{ym.slice(0, 4)}년 {+ym.slice(5)}월</b><TBtn onClick={() => mv(1)} aria-label="다음 달">›</TBtn><span style={{ flex: 1 }} />
      <TBtn onClick={() => setMore(!more)} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn></div>
    {more && <div className="v2-more" role="group" aria-label="더 하기"><TBtn v="soft" disabled={!docs || !docs.length} onClick={csv}>CSV 내려받기</TBtn></div>}
    {docs == null ? <Card style={{ marginTop: 10 }}><Empty>불러오는 중…</Empty></Card> : !T.days.length ? <Card style={{ marginTop: 10 }}><Empty>이 달 기록이 없어요 · 기록은 3단계부터 쌓여요</Empty></Card>
    : <div className="a-recbook" role="region" aria-label="날짜 × 사람 기록" tabIndex={0}><table><thead><tr><th>날짜</th>{T.people.map((p) => <th key={p.uid}>{p.name}</th>)}</tr></thead>
      <tbody>{T.days.slice().reverse().map((d) => <tr key={d}><th>{md(d)}({WD[new Date(d + "T00:00:00").getDay()]})</th>{T.people.map((p) => <td key={p.uid}>{cellT(T.cell(d, p.uid))}</td>)}</tr>)}
        <tr className="sum"><th>합계</th>{T.people.map((p) => { const x = tot(p.uid); return <td key={p.uid}>{x.n}회{x.q ? ` · ${x.q}건` : ""}</td>; })}</tr></tbody></table></div>}
  </Sheet>;
}
