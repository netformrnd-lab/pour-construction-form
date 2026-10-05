// 업무OS v2 — 5단계: 카테고리 대시보드 (프로젝트 탭 [대시보드]) · 프로젝트 대시보드(상태별 칸)
// 신제품 출시 = 제품 × 7단계 표(칸 = 남은 항목 · 빨강 = 출시보다 늦음/지남 · 진한 칸 = 지금 하는 단계 · ✓ = 다 끝남) → 칸 누르면 그 프로젝트의 그 단계
// 그 밖 카테고리 = 프로젝트 × [지금 · 다음 · 진척 · 마감] 표 · 표는 가로로만 밀림(첫 열 고정)
import { useState } from "react";
import { md, ymd, ddays, ddayLabel, dueOf, isDone, nameOf, projPct, ownersOf } from "./model.js";
import { LAUNCH_PHASES, launchPct, preLaunchItem } from "./launch.js";
import { nowNext } from "./turn.js";
import { C, Chip, Empty, Card } from "./ui.jsx";

const isLaunchP = (p) => !!p && String(p.id || "").startsWith("lb_");
const live = (t) => !t.isFixed && !t.deleted && t.status !== "dropped";
const openT = (t) => live(t) && !isDone(t) && t.status !== "review";
const whoOf = (D, t) => ownersOf(t).map((id) => nameOf(D.users, id)).filter(Boolean).join("·") || "담당 없음";

// 신제품 한 줄: 단계마다 { n: 남은 수, all, late, now }
export function launchCells(p, D, key) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && live(t) && t.launchItem && !t.parentId);
  let nowSet = false;
  return LAUNCH_PHASES.map((ph) => {
    const a = ts.filter((t) => t.phase === ph.k), o = a.filter(openT);
    const late = o.some((t) => dueOf(t) && (dueOf(t) < key || (p.launchDate && preLaunchItem(t.launchItem) && dueOf(t) > p.launchDate)));
    const now = !nowSet && o.length > 0 && (nowSet = true);
    return { k: ph.k, name: ph.name, n: o.length, all: a.length, late, now };
  });
}

export function CatDash({ list, cat, D, idx, open }) {
  const key = ymd(new Date()), month = key.slice(0, 7);
  if (!list.length) return <Card style={{ marginTop: 6 }}><Empty>이 카테고리에 열린 프로젝트가 없어요</Empty></Card>;
  const launch = cat === "launch" || list.every(isLaunchP);
  if (launch) {
    const rows = list.filter(isLaunchP).sort((a, b) => String(a.launchDate || "9").localeCompare(String(b.launchDate || "9")));
    const lateN = rows.reduce((s, p) => s + (D.tasks || []).filter((t) => t.projectId === p.id && openT(t) && t.launchItem && p.launchDate && preLaunchItem(t.launchItem) && dueOf(t) > p.launchDate).length, 0);
    const reviewN = (D.tasks || []).filter((t) => rows.some((p) => p.id === t.projectId) && t.status === "review").length;
    return <>
      <div className="v2-dsum"><div><b>{rows.filter((p) => String(p.launchDate || "").startsWith(month)).length}</b><span>이번 달 출시</span></div>
        <div className={lateN ? "red" : ""}><b>{lateN}</b><span>출시보다 늦는 항목</span></div><div><b>{reviewN}</b><span>확인 대기</span></div></div>
      <div className="v2-dtbl" role="region" aria-label="신제품 단계 표" tabIndex={0}><table>
        <thead><tr><th>제품 (출시일)</th>{LAUNCH_PHASES.map((ph) => <th key={ph.k}>{ph.name}</th>)}<th>%</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id}>
          <td><button type="button" className="pn" onClick={() => open({ type: "project", id: p.id })}><b>{p.title}</b><span>{p.launchDate ? `${md(p.launchDate)} · ${ddayLabel(ddays(p.launchDate, key))}` : "출시일 미정"}{p.lbProjectName ? " · " + p.lbProjectName : ""}</span></button></td>
          {launchCells(p, D, key).map((c) => <td key={c.k}>{c.all === 0 ? <span className="dim">–</span> : c.n === 0 ? <span className="ok" aria-label={`${c.name} 다 끝남`}>✓</span>
            : <button type="button" className={"n" + (c.late ? " late" : c.now ? " now" : "")} aria-label={`${p.title} ${c.name} 남은 ${c.n}개${c.late ? " · 늦음" : ""}`} onClick={() => open({ type: "project", id: p.id, first: "work", openPh: { [c.k]: true } })}>{c.n}</button>}</td>)}
          <td className="pc">{launchPct(p, D)}%</td></tr>)}</tbody></table></div>
      <div className="v2-dnote">칸 숫자 = 남은 항목 · 빨강 = 출시보다 늦음·지남 · 진한 칸 = 지금 하는 단계 · ✓ = 다 끝남 · 칸을 누르면 그 단계</div>
    </>;
  }
  const rows = [...list].sort((a, b) => String(a.dueDate || "9").localeCompare(String(b.dueDate || "9")));
  const lateN = (D.tasks || []).filter((t) => rows.some((p) => p.id === t.projectId) && openT(t) && dueOf(t) && dueOf(t) < key).length;
  const avg = rows.length ? Math.round(rows.reduce((s, p) => s + projPct(p), 0) / rows.length) : 0;
  return <>
    <div className="v2-dsum"><div><b>{rows.length}</b><span>진행 중</span></div><div className={lateN ? "red" : ""}><b>{lateN}</b><span>지난 업무</span></div><div><b>{avg}%</b><span>평균 진척</span></div></div>
    <div className="v2-dtbl" role="region" aria-label="프로젝트 표" tabIndex={0}><table>
      <thead><tr><th>프로젝트</th><th>지금</th><th>다음</th><th>진척</th><th>마감</th></tr></thead>
      <tbody>{rows.map((p) => { const nn = nowNext(p, D, idx, key), late = p.dueDate && p.dueDate < key;
        return <tr key={p.id} onClick={() => open({ type: "project", id: p.id })} style={{ cursor: "pointer" }}>
          <td><button type="button" className="pn" onClick={(e) => { e.stopPropagation(); open({ type: "project", id: p.id }); }}><b>{p.title}</b><span>책임 {nameOf(D.users, p.assigneeId) || "없음"}</span></button></td>
          <td className="tx">{nn.now ? `${whoOf(D, nn.now)} · ${nn.now.title}` : "–"}</td><td className="tx">{nn.next ? `${whoOf(D, nn.next)} · ${nn.next.title}` : "–"}</td>
          <td className="pc">{projPct(p)}%</td><td>{p.dueDate ? (late ? <span className="n late">지남</span> : md(p.dueDate)) : "–"}</td></tr>; })}</tbody></table></div>
    <div className="v2-dnote">줄을 누르면 그 프로젝트</div>
  </>;
}

// 프로젝트 대시보드 (프로젝트 한 장 [대시보드] 탭): [상태별 | 담당별] 칸 · 카드 누르면 업무
const COLS = [["todo", "할 일", (t) => (t.status || "todo") === "todo" || t.status === "hold"], ["inprogress", "진행 중", (t) => t.status === "inprogress"], ["review", "확인 대기", (t) => t.status === "review"], ["done", "끝냄", isDone]];
export function ProjDash({ p, D, open }) {
  const [by, setBy] = useState("status");
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && live(t));
  const cols = by === "status" ? COLS.map(([k, l, f]) => [k, l, ts.filter(f)])
    : [...new Set(ts.filter((t) => !isDone(t)).flatMap((t) => (ownersOf(t).length ? ownersOf(t) : [""])))].map((uid) => [uid || "none", nameOf(D.users, uid) || "담당 없음", ts.filter((t) => !isDone(t) && (uid ? ownersOf(t).includes(uid) : !ownersOf(t).length))]).sort((a, b) => b[2].length - a[2].length);
  const key = ymd(new Date());
  return <>
    <div className="v2-chips" style={{ margin: "10px 0 8px" }}><Chip on={by === "status"} onClick={() => setBy("status")}>상태별</Chip><Chip on={by === "who"} onClick={() => setBy("who")}>담당별 (남은 일)</Chip></div>
    <div className="v2-kan">{cols.map(([k, l, a]) => <div key={k} className="col"><h4>{l} {a.length}</h4>
      {a.slice(0, 30).map((t) => <button type="button" key={t.id} className="it" onClick={() => open({ type: "task", id: t.id })}>{t.title}
        <span style={{ color: !isDone(t) && dueOf(t) && dueOf(t) < key ? C.red : undefined }}>{by === "status" ? whoOf(D, t) : t.status === "inprogress" ? "진행 중" : t.status === "review" ? "확인 대기" : "할 일"}{dueOf(t) ? " · " + md(dueOf(t)) : ""}</span></button>)}
      {a.length > 30 && <div className="more">외 {a.length - 30}개</div>}{!a.length && <div className="more">없음</div>}</div>)}</div>
  </>;
}
