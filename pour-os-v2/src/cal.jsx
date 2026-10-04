// 업무OS v2 — 월 달력 (실사용 '내 달력' · 관리자 '팀 달력'이 같이 씀)
// 칸: 날짜(토·일·공휴일 회색) · 건수(양은 칸 바탕 농도) · 표식(▴ 출시·마감, → 내 차례 시작, ✓ 다 끝냄)
// 내 달력은 폰에서도 제목 칩 2개 + '+n'(한눈에 무엇이 있는지), 팀 달력은 폰은 숫자·표식만 · 768px 이상은 제목(팀은 사람별 건수)까지 + '→ 내 차례 시작' · '✓ 다 끝냄' 줄. 빨강은 '지난 날에 안 끝난 일·막힘'(팀은 '한 사람 하루 8건 넘음' 포함)에만
import { useRef } from "react";
import { addDays, ddays, md, holidayName, isOffDay, nameOf, shiftMonth, monthGrid } from "./model.js";

const lv = (n, team) => (n <= 0 ? "" : team ? (n <= 10 ? "l1" : n <= 25 ? "l2" : "l3") : n <= 2 ? "l1" : n <= 5 ? "l2" : "l3");
const short = (users, id, all) => { const nm = nameOf(users, id); if (!nm) return "?"; const s = nm.length >= 3 ? nm.slice(1) : nm; return all.filter((u) => u.name !== nm && u.name.slice(1) === s).length ? nm : s; };

export function MonthCal({ mode = "me", ym, setYm, cells, sel, onPick, keyd, users = [] }) {
  const grid = monthGrid(ym), team = mode === "team", tch = useRef(null), d14 = addDays(keyd, -14);
  const onTS = (e) => { const t = e.touches[0]; tch.current = { x: t.clientX, y: t.clientY }; };
  const onTE = (e) => { const s = tch.current; if (!s) return; const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y; tch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setYm(shiftMonth(ym, dx < 0 ? 1 : -1)); };
  return <div className={"v2-cal" + (team ? "" : " me")} role="grid" aria-label={`${ym.slice(0, 4)}년 ${+ym.slice(5)}월 달력`} onTouchStart={onTS} onTouchEnd={onTE}>
    {["일", "월", "화", "수", "목", "금", "토"].map((w) => <div key={w} className={"v2-calh" + (w === "일" ? " sun" : w === "토" ? " sat" : "")}>{w}</div>)}
    {grid.flat().map((c) => {
      const x = cells[c.date] || { n: 0, proj: [], items: [], people: {} }, past = c.date < keyd, old = c.date < d14;
      const showN = x.n > 0 ? x.n : x.fx > 0 ? x.fx : 0;
      const dow = new Date(c.date + "T00:00:00").getDay(), red = dow === 0 || !!holidayName(c.date);   // 빨간 날(일요일·공휴일) 빨강 · 토요일 파랑
      const cls = ["v2-calc", c.out ? "out" : "", isOffDay(c.date) ? "off" : "", red ? "hol" : dow === 6 ? "sat" : "", c.date === keyd ? "today" : "", c.date === sel ? "on" : "",
        !past && x.n > 0 ? lv(x.n, team) : "", past && x.n > 0 && x.red ? "red" : "", team && !past && x.red ? "over" : "", past && x.n > 0 && old ? "old" : "", !x.n && x.fx ? "fx" : ""].filter(Boolean).join(" ");
      const marks = [x.proj.length ? (team && x.proj.length > 1 ? "▴" + x.proj.length : "▴") : "", x.turnStart ? "→" : "", past && !x.n && x.done ? "✓" : ""].filter(Boolean).slice(0, 2).join(" ");
      const hol = holidayName(c.date);
      const label = `${+c.date.slice(5, 7)}월 ${+c.date.slice(8)}일${hol ? " " + hol : ""}, 마감 ${x.n}건${x.red ? (team && !past ? ", 8건 넘는 사람·막힘 있음" : ", 지난 일·막힘 있음") : ""}${x.proj.length ? `, 출시·마감 ${x.proj.length}` : ""}${x.turnStart ? `, 내 차례 시작${x.turns && x.turns.length ? " " + x.turns.map((u) => u.t.title).join(", ") : ""}${x.turnRisk ? " (늦을 수 있음)" : ""}` : ""}`;
      const top = team ? Object.entries(x.people || {}).filter(([u]) => u).sort((a, b) => b[1] - a[1]) : [];
      return <button key={c.date} type="button" className={cls} aria-label={label} aria-pressed={c.date === sel} onClick={() => { onPick(c.date); if (c.out) setYm(c.date.slice(0, 7)); }}>
        <span className="d">{+c.date.slice(8)}</span>
        <span className="n">{showN || ""}</span>
        <span className="m">{marks}</span>
        <span className="t">{team
          ? <>{top.slice(0, 2).map(([u, k]) => <i key={u} className={k > 8 ? "red" : ""}>{short(users, u, users)} {k}</i>)}{top.length > 2 && <i className="more">+{top.length - 2}명</i>}{x.proj.length > 0 && <i className="p">▴ {x.proj.length} 출시·마감</i>}</>
          : <>{x.turnStart > 0 && (x.turns && x.turns.length ? <i className={"ts" + (x.turnRisk ? " red" : "")}>→ {x.turns[0].t.title}{x.turns.length > 1 ? ` +${x.turns.length - 1}` : ""}</i> : <i className="ts">→ 내 차례</i>)}{x.items.slice(0, 2).map((t) => <i key={t.id} className={past || t.blocked ? "red" : ""}>{t.title}</i>)}{x.items.length > 2 && <i className="more">+{x.items.length - 2}</i>}{x.proj.slice(0, 1).map((p) => <i key={p.id} className="p">▴ {p.title}</i>)}{past && !x.n && x.done > 0 && <i className="more">✓ 다 끝냄</i>}</>}</span>
      </button>; })}
  </div>;
}

// 달력 머리 한 줄: ‹ 2026년 10월 › [오늘]  + 오른쪽 자리
export function CalHead({ ym, setYm, keyd, sel, setSel, right }) {
  return <div className="v2-calhead">
    <button type="button" className="v2-calnav" aria-label="이전 달" onClick={() => setYm(shiftMonth(ym, -1))}>‹ {+shiftMonth(ym, -1).slice(5)}월</button>
    <b>{ym.slice(0, 4)}년 {+ym.slice(5)}월</b>
    <button type="button" className="v2-calnav" aria-label="다음 달" onClick={() => setYm(shiftMonth(ym, 1))}>{+shiftMonth(ym, 1).slice(5)}월 ›</button>
    {(ym !== keyd.slice(0, 7) || sel !== keyd) && <button type="button" className="v2-caltoday" onClick={() => { setYm(keyd.slice(0, 7)); setSel(keyd); }}>오늘</button>}
    <span style={{ flex: 1 }} />{right && <span className="v2-calright">{right}</span>}
  </div>;
}
// 고른 날 머리 글: "10/16 (금) · 3일 뒤 · 마감 5 · 출시 1 · 한글날"
export function dayHead(date, keyd, n, proj) {
  const WDK = ["일", "월", "화", "수", "목", "금", "토"], d = new Date(date + "T00:00:00"), k = ddays(date, keyd), hol = holidayName(date);
  return `${md(date)} (${WDK[d.getDay()]}) · ${k === 0 ? "오늘" : k < 0 ? `${-k}일 전` : `${k}일 뒤`} · 마감 ${n}${proj ? ` · 출시·마감 ${proj}` : ""}${hol ? " · " + hol : ""}`;
}
