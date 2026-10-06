// 업무OS v2 — 월말 보고서 한 장 그리기 (앱 안 미리 보기 · 공유 페이지 같이 씀 · 저장 없음)
//  data = report.js reportBrand / reportProject 결과(또는 확정본) · money = 금액 보이기 · onProject(id) = 프로젝트 줄 누르면(앱 안에서만) · onTask(id)
import { md } from "./model.js";
import { fmtV as fmtNum } from "./kpi2.js";
import { ymLabel, mLabel } from "./report.js";

const Bar = ({ pct, red }) => <div className="rp-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, background: red ? "#B4383F" : "#24386B" }} /></div>;
const Sec = ({ t, r, children }) => <section className="rp-sec"><div className="rp-sh"><h3>{t}</h3>{r ? <span>{r}</span> : null}</div><div className="rp-card">{children}</div></section>;
const range = (a, b) => (a || b ? `${a ? md(a) : "?"} → ${b ? md(b) : "?"}` : "");

export function ReportView({ data: d, money = true, onProject, onTask, final, finalAt }) {
  if (!d) return null;
  const W = (v) => (money ? fmtNum(v, "원") : "—");
  const stamp = final ? `확정${finalAt ? " " + md(String(finalAt).slice(0, 10)) : ""}` : "초안";
  if (d.kind === "project") return <div className="rp">
    <div className="rp-hero">
      <div className="k">프로젝트 보고서 · {ymLabel(d.ym)} · {stamp}</div>
      <div className="t">{d.name}</div>
      <div className="nums">
        <div><b>{d.pct}%</b><span>진척</span></div>
        <div><b>{d.doneM}</b><span>{mLabel(d.ym)} 끝낸 업무</span></div>
        <div><b>{d.lateN}</b><span>늦은 업무</span></div>
      </div>
    </div>
    <div className="rp-meta">{[d.lead ? "책임 " + d.lead : "", range(d.start, d.end) ? "기간 " + range(d.start, d.end) : "", `업무 ${d.doneN}/${d.total} 끝남`].filter(Boolean).join(" · ")}</div>
    {d.summary ? <div className="rp-sum">{d.summary}</div> : null}
    <Sec t={`${mLabel(d.ym)} 흐름`} r={d.flow.length ? range(d.flow[0].day, d.flow[d.flow.length - 1].day) : ""}>
      {d.flow.length ? d.flow.map((f) => <Line key={f.id} onClick={onTask && (() => onTask(f.id))} t={f.title} s={<>{md(f.day)}{f.who ? " · " + f.who : ""}{f.files ? ` · 자료 ${f.files}` : ""}{f.late ? <> · <em className="red">{f.late}일 늦음</em></> : null}</>} />)
        : <div className="rp-empty">이 달에 끝낸 업무가 없어요</div>}
    </Sec>
    {d.left.length > 0 && <Sec t={`남은 일 ${d.leftN}`}>{d.left.map((x) => <Line key={x.id} onClick={onTask && (() => onTask(x.id))} t={x.title} s={<>{x.who || "담당 없음"}{x.due ? " · " + md(x.due) : ""}{x.hold ? " · 보류" : ""}{x.late ? <> · <em className="red">지남</em></> : null}</>} />)}</Sec>}
    {d.byOwner.length > 0 && <Sec t="담당별">{d.byOwner.map((o) => <div key={o.name} className="rp-ln"><div className="r1"><b>{o.name}</b><span>끝냄 {o.done}{o.left ? ` · 남음 ${o.left}` : ""}</span></div></div>)}</Sec>}
    <p className="rp-foot">{md(d.asOf)} 기준 · 업무OS 기록으로 자동 · 기밀 업무는 빠져요</p>
  </div>;
  const s = d.sales;
  return <div className="rp">
    <div className="rp-hero">
      <div className="k">{d.name} · {ymLabel(d.ym)} 보고서 · {stamp}</div>
      <div className="t">{money || !s ? d.head : s.pct != null ? `매출 목표 ${s.pct}% 달성` : d.head}</div>
      <div className="nums">
        {s ? <div><b>{money ? W(s.total) : s.pct != null ? s.pct + "%" : "—"}</b><span>매출{s.goal ? ` (목표 ${money ? W(s.goal) : "대비"})` : ""}</span></div> : <div><b>{d.tasksDone}</b><span>끝낸 업무</span></div>}
        <div><b>{d.done.length}</b><span>끝낸 프로젝트</span></div>
        <div><b>{d.ak.pct != null ? d.ak.pct + "%" : "—"}</b><span>반복 일</span></div>
      </div>
    </div>
    {d.summary ? <div className="rp-sum">{d.summary}</div> : null}
    {s && <Sec t="채널별 매출" r={s.src}>
      {s.ch.length ? s.ch.slice(0, 10).map((c) => <div key={c.ch} className="rp-ln"><div className="r1"><b>{c.ch}</b><span>{money ? W(c.amt) + " · " : ""}{s.total ? Math.round((c.amt / s.total) * 100) : 0}%</span></div><Bar pct={s.ch[0].amt ? (c.amt / s.ch[0].amt) * 100 : 0} /></div>)
        : <div className="rp-empty">이 달 매출 기록이 아직 없어요</div>}
      {s.ytdGoal ? <div className="rp-ln"><div className="r1"><b>올해 누계</b><span>{money ? `${W(s.ytd)} / ${W(s.ytdGoal)} · ` : ""}{s.ytdPct}%</span></div><Bar pct={s.ytdPct} red={s.ytdPct < 100} /></div> : null}
    </Sec>}
    {d.lags.length > 0 && <Sec t={`결과 KPI · ${mLabel(d.ym)}`}>{d.lags.slice(0, 8).map((l) => <div key={l.id} className="rp-ln"><div className="r1"><b>{l.name}</b><span>{fmtNum(l.v, l.unit)}{l.goal != null ? ` / ${fmtNum(l.goal, l.unit)}` : ""}</span></div>
      {l.v != null && l.goal != null ? <Bar pct={l.pct} red={l.pct < 100} /> : <div className="s">{l.v == null ? "이 달 값 아직 없음" : ""}{l.prev != null ? ` · 지난달 ${fmtNum(l.prev, l.unit)}` : ""}</div>}</div>)}</Sec>}
    <Sec t="끝낸 프로젝트" r={String(d.done.length)}>
      {d.done.length ? d.done.map((p) => <Line key={p.id} onClick={onProject && (() => onProject(p.id))} t={p.title} r={range(p.start, p.end)} s={[`업무 ${p.total}`, p.lead].filter(Boolean).join(" · ")} />)
        : <div className="rp-empty">이 달에 끝낸 프로젝트가 없어요</div>}
    </Sec>
    {d.open.length > 0 && <Sec t="진행 중 프로젝트">{d.open.map((p) => <Line key={p.id} onClick={onProject && (() => onProject(p.id))} t={p.title} r={`${p.pct}%`} s={[p.done ? `이 달 끝낸 업무 ${p.done}` : "", p.lead, p.end ? (p.launch ? "출시 " : "마감 ") + md(p.end) : ""].filter(Boolean).join(" · ")} bar={p.pct} />)}</Sec>}
    {d.ak.items.length > 0 && <Sec t="반복 일 달성" r={d.ak.pct != null ? `${d.ak.pct}%` : ""}><div className="rp-ln"><div className="s" style={{ marginTop: 0 }}>{d.ak.items.map((a) => `${a.name} ${a.n}/${a.g}`).join(" · ")}</div></div></Sec>}
    <Sec t="지난 일 · 막힘" r={<>{d.late ? <em className="red">{d.late}</em> : 0} · {d.blocked ? <em className="red">{d.blocked}</em> : 0}</>}>
      {d.lateList.length ? d.lateList.map((x) => <Line key={x.id} onClick={onTask && (() => onTask(x.id))} t={x.title} s={<>{x.who || "담당 없음"} · <em className="red">기한 {md(x.due)}</em></>} />) : <div className="rp-empty">{d.late ? "이 달 기한을 넘겨 끝낸 일만 있어요" : "기한 지난 일이 없어요"}</div>}
    </Sec>
    <Sec t={`${mLabel(nextYm(d.ym))}에 할 것`}>{d.next.length ? d.next.map((p) => <Line key={p.id} onClick={onProject && (() => onProject(p.id))} t={p.title} s={[`진행 ${p.pct}%`, p.end ? (p.launch ? "출시 " : "마감 ") + md(p.end) : ""].filter(Boolean).join(" · ")} />) : <div className="rp-empty">다음 달 마감·출시 프로젝트가 없어요</div>}</Sec>
    <p className="rp-foot">{md(d.asOf)} 기준 · 업무OS 기록 · {s ? `매출 = ${s.src}` : "매출 원본 없음"} · 기밀 업무·프로젝트는 빠져요</p>
  </div>;
}
const nextYm = (ym) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
function Line({ t, s, r, onClick, bar }) {
  const inner = <><div className="r1"><b>{t}</b>{r ? <span>{r}</span> : null}</div>{s ? <div className="s">{s}</div> : null}{bar != null ? <Bar pct={bar} /> : null}</>;
  return onClick ? <button type="button" className="rp-ln go" onClick={onClick}>{inner}</button> : <div className="rp-ln">{inner}</div>;
}
