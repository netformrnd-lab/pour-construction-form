// 업무OS v2 — 하루 기록 화면 조각 (반복 실행 · 고정업무 3단계 · 규칙 rec.js)
//   QtyAsk: '오늘 처리한 문의 몇 건이에요? [ ]건 [남기기] [건너뛰기]' (숫자 키패드 · 1000 이상이면 '맞아요?' 한 번)
//   QtyDone: '오늘 문의 23건 · 고치기' · DayQty: 시트 ③ '오늘 전화 37건 [+ 더하기] [고치기]' · RecList: 시트 ④ 날짜별 기록(최근 14일 · 누르면 그 기록에 메모)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { C, TBtn, Card, Empty, More, Head } from "./ui.jsx";
import { ymd, addDays, md, hm, WD } from "./model.js";
import { qtyNum, qtyText, qtyShort, qtyToGoal, QTY_BIG, recRows } from "./rec.js";

const stop = (e) => e.stopPropagation();
const stopKey = (e) => { if (e.key !== "Escape") e.stopPropagation(); };   // 줄(Row)의 Enter·Space 열기로 안 번지게 (Esc 는 시트 닫기 그대로)
// 묻는 말: '오늘 처리한 문의 몇 건이에요?' · 고치기면 '오늘 문의 몇 건으로 고칠까요?'
const jong = (w) => { const c = String(w || "").slice(-1).charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };   // 받침 있음
export const qtyQ = (cfg, mode) => (mode === "set" ? `오늘 ${qtyShort(cfg)} 몇 ${cfg.unit}${jong(cfg.unit) ? "으로" : "로"} 고칠까요?` : `오늘 ${cfg.label} 몇 ${cfg.unit}${jong(cfg.unit) ? "이에요" : "예요"}?`);
export function QtyAsk({ cfg, mode = "add", init, lead, q, onSave, onSkip, skipL = "건너뛰기", busy }) {
  const [v, setV] = useState(init != null ? String(init) : ""), [sure, setSure] = useState(false), ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => { if (ref.current) { ref.current.focus(); try { ref.current.select(); } catch (_) { /* 무시 */ } } }, 60); return () => clearTimeout(t); }, []);
  const n = qtyNum(v), ask = q || qtyQ(cfg, mode);
  const save = () => { if (n == null || busy) return; if (n >= QTY_BIG && !sure) { setSure(true); return; } onSave(n); };
  return <div className="v2-qty" role="group" aria-label={ask} onClick={stop} onKeyDown={stopKey}>
    {lead && <div className="lead">{lead}</div>}
    <div className="q">{ask}</div>
    <div className="r">
      <label className="in"><input ref={ref} inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={v} aria-label={ask}
        onChange={(e) => { setV(e.target.value); setSure(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} /><span>{cfg.unit}</span></label>
      <button type="button" className="sv" disabled={n == null || busy} onClick={save}>{sure ? "네, 남기기" : "남기기"}</button>
      {onSkip && <button type="button" className="sk" onClick={onSkip}>{skipL}</button>}
    </div>
    {sure && <div className="sure" role="alert">{n.toLocaleString()}{cfg.unit} 맞아요? 한 번 더 누르면 남겨요</div>}
  </div>;
}
export function QtyDone({ cfg, n, onFix, lead }) {
  return <div className="v2-rtline" role="status" onClick={stop} onKeyDown={stopKey}><div>{lead ? `${lead} · ` : ""}오늘 {qtyText(cfg, n)}</div>{onFix && <button type="button" onClick={onFix}>고치기</button>}</div>;
}
// 시트 ③ 오늘 건수 — 내 것 (더하기 = 지금 값에 더함 · 고치기 = 이 값으로)
export function DayQty({ cfg, mine, onAdd, onSet, can, extra }) {
  const [mode, setMode] = useState(""), [busy, setBusy] = useState(false);
  const run = async (fn, n) => { setBusy(true); try { await fn(n); setMode(""); } finally { setBusy(false); } };
  return <><Head>오늘 건수</Head>
    <Card style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ flex: 1, minWidth: 120, fontSize: 15, color: C.ink }}>오늘 {qtyText(cfg, mine)}</b>
        {can && <><TBtn v="soft" onClick={() => setMode(mode === "add" ? "" : "add")}>+ 더하기</TBtn><TBtn onClick={() => setMode(mode === "set" ? "" : "set")}>고치기</TBtn></>}
      </div>
      {extra && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{extra}</div>}
      {mode && <QtyAsk key={mode} cfg={cfg} mode={mode} init={mode === "set" ? mine : undefined} q={mode === "add" ? `지금 ${qtyText(cfg, mine)}에 몇 ${cfg.unit} 더할까요?` : undefined} busy={busy}
        onSave={(n) => run(mode === "add" ? onAdd : onSet, n)} onSkip={() => setMode("")} skipL="그만" />}
    </Card></>;
}
// 하루 기록 읽기 (시트 · 같은 항목 이번 달 + 14일 전 달 · itemId+ym 같음 조건) + 오늘 문서는 실시간(D.recs.today)
export function useRecs(D, itemId, tick) {
  const key = (D.recs && D.recs.key) || ymd(new Date()), yms = [...new Set([key.slice(0, 7), addDays(key, -13).slice(0, 7)])];
  const [old, setOld] = useState(null);
  useEffect(() => { let live = true; Promise.all(yms.map((ym) => fb.fetchWhere("checks", [["itemId", "==", itemId], ["ym", "==", ym]])))
    .then((a) => { if (live) setOld(a.flat()); }).catch((e) => { console.error("[v2 checks] 기록 읽기 실패:", e); if (live) setOld([]); }); return () => { live = false; }; }, [itemId, key, tick]);
  return useMemo(() => { const m = new Map(); (old || []).forEach((d) => m.set(d.id || d._doc, d)); ((D.recs && D.recs.today) || []).filter((d) => d.itemId === itemId).forEach((d) => m.set(d.id || d._doc, d));
    return { docs: [...m.values()], ready: old != null }; }, [old, D.recs, itemId]);
}
const dayL = (d) => `${md(d)}(${WD[new Date(d + "T00:00:00").getDay()]})`;
// 시트 ④ 날짜별 기록 (최근 14일) — 줄 = 그날 · 사람 · 회/✓ · 건수 · 메모 n · 누르면 그 기록에 메모·사진(대화에 '10/6 기록 · 37건' 꼬리표)
export function RecList({ D, docs, ready, cfg, kind, notes, onPick, keyd }) {
  const [all, setAll] = useState(false);
  const days = [...Array(14)].map((_, i) => addDays(keyd, -i)), rows = recRows(docs, days);
  const memoN = (r) => (notes || []).filter((n) => n && !n.deleted && n.rec && n.rec.date === r.date && n.rec.uid === r.uid).length;
  const shown = all ? rows : rows.slice(0, 4);
  return <><Head right={<span style={{ fontSize: 12, color: C.mute, fontWeight: 700 }}>줄을 누르면 메모·사진</span>}>날짜별 기록</Head>
    <Card>{!ready ? <Empty>불러오는 중…</Empty> : rows.length === 0 ? <Empty>최근 14일 기록이 없어요 · 오늘부터 쌓여요</Empty>
      : shown.map((r, i) => { const m = memoN(r);
        return <button key={r.id || r.date + r.uid} type="button" className="v2-recrow" style={{ borderBottom: i === shown.length - 1 && rows.length <= 4 ? "none" : undefined }} onClick={() => onPick(r)}>
          <span className="t">{dayL(r.date)} · {r.name || "?"}{kind === "ak" ? ` · ${r.runs}회` : r.on ? ` · ✓ ${hm(r.at)}` : ""}{cfg && r.qty ? ` · ${qtyText(cfg, r.qty)}` : ""}{m ? ` · 메모 ${m}` : ""}</span><span className="go">›</span></button>; })}
      {rows.length > 4 && <More onClick={() => setAll(!all)}>{all ? "접기 ▴" : `최근 14일 · ${rows.length - 4}개 더 ▾`}</More>}</Card></>;
}
// 대화 줄 꼬리표: '10/6 기록 · 37건'
export const recTag = (rec, cfg) => (rec ? `${md(rec.date)} 기록${rec.qty ? ` · ${rec.qty}${(cfg && cfg.unit) || "건"}` : rec.runs ? ` · ${rec.runs}회` : ""}` : "");
// [+1] 뒤 묻는 말 — 목표 단위가 건·명·개면 방금 센 1이 이 숫자에 들어 있음(결정 3 · 목표에도 그만큼 더해짐)
export const qtyAfterQ = (it, cfg) => `오늘 ${qtyShort(cfg)} 몇 ${cfg.unit}?${qtyToGoal(it) ? ` (방금 1${it.unit} 포함)` : ""}`;
