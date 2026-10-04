// 업무OS v2 — 간트 (팀원 프로젝트 탭 · 관리자 프로젝트 [간트]가 같이 씀)
// [8주 | 4개월] · 줄마다 시작 → 끝 막대 + 진척(진하게) · 오늘 세로줄 · 보류는 회색 · 지난 끝인데 안 끝남은 빨간 테두리 · 가로로만 밀림(화면은 안 밀림)
import { ymd, addDays, md, weekStart, ddays } from "./model.js";
import { useState } from "react";
import { Seg, More } from "./ui.jsx";

export function ganttRange(mode, key) {
  if (mode === "m4") { const d = new Date(key.slice(0, 7) + "-01T00:00:00"); d.setMonth(d.getMonth() - 1); const from = ymd(d); d.setMonth(d.getMonth() + 4); return { from, to: addDays(ymd(d), -1) }; }
  const from = addDays(weekStart(key), -7); return { from, to: addDays(from, 8 * 7 - 1) };
}
// rows: [{ id, title, sub, start, end, pct, tone: "hold" | "late" | "done" | "", onClick }]
export function Gantt({ rows, mode, setMode, keyd, right, empty }) {
  const { from, to } = ganttRange(mode, keyd), days = ddays(to, from) + 1;
  const pos = (d) => Math.max(0, Math.min(days, ddays(d, from))) / days * 100;
  const ticks = [];
  if (mode === "m4") { for (let d = new Date(from + "T00:00:00"); ymd(d) <= to; d.setMonth(d.getMonth() + 1)) ticks.push({ d: ymd(d), l: `${d.getMonth() + 1}월` }); }
  else for (let k = from; k <= to; k = addDays(k, 7)) ticks.push({ d: k, l: md(k) + "~" });
  const today = keyd >= from && keyd <= to ? pos(keyd) : null;
  const vis = rows.filter((r) => r.end && r.end >= from && (r.start || r.end) <= to), [n, setN] = useState(30);   // 많으면 30줄씩
  return <div className="v2-gtwrap">
    <div className="v2-gthd"><Seg items={[["w8", "8주"], ["m4", "4개월"]]} value={mode} onChange={setMode} />{right}</div>
    {vis.length === 0 ? <div className="v2-gtempty">{empty || "이 기간에 보일 막대가 없어요"}</div> : <div className="v2-hscroll"><div className="v2-gt" role="table" aria-label="간트">
      <div className="v2-gtr hd" role="row"><span className="nm">{mode === "m4" ? "4개월" : "8주"}</span><span className="tl">{ticks.map((x) => <i key={x.d} style={{ left: pos(x.d) + "%" }}>{x.l}</i>)}{today != null && <b className="now" style={{ left: today + "%" }} />}</span></div>
      {vis.slice(0, n).map((r) => { const s = r.start && r.start <= r.end ? r.start : r.end, l = pos(s < from ? from : s), w = Math.max(0.9, pos(r.end > to ? to : r.end) + 100 / days - l);
        return <button key={r.id} type="button" className="v2-gtr" role="row" onClick={r.onClick} aria-label={`${r.title} · ${md(s)}~${md(r.end)}${r.pct != null ? ` · ${r.pct}%` : ""}${r.tone === "hold" ? " · 보류" : r.tone === "late" ? " · 지남" : ""}`}>
          <span className="nm"><b>{r.title}</b>{r.sub && <small>{r.sub}</small>}</span>
          <span className="tl">{ticks.map((x) => <i key={x.d} className="g" style={{ left: pos(x.d) + "%" }} />)}{today != null && <b className="now" style={{ left: today + "%" }} />}
            <em className={"bar " + (r.tone || "")} style={{ left: l + "%", width: w + "%" }}>{r.pct != null && <s style={{ width: r.pct + "%" }} />}</em></span>
        </button>; })}
    </div></div>}
    {vis.length > n && <div style={{ background: "#fff", borderRadius: 12, marginTop: 6, overflow: "hidden" }}><More onClick={() => setN(n + 30)}>{vis.length - n}개 더 보기 ▾</More></div>}
  </div>;
}
