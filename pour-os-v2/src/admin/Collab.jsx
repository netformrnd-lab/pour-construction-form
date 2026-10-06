// 관리자 · 협업 맵 (사용자 확정 2026-10-05~06 · 시안 mockups/step12-collab-map.png)
// 누가 누구와 같이 일을 많이 하나 — 계산은 collab.js(저장 없음 · 이미 불러온 데이터만)
// [팀 전체] 사람 = 동그라미(크기 = 협업 수) · 선 굵기 = 둘이 같이 한 수 · 원 둘레 팀 순서(늘 같은 자리) — 폰은 그림 대신 '많이 협업하는 짝' 순위
// [한 사람] 그 사람 → 협업한 사람(많은 순) → 어떤 일로(종류별 수 + 최근 일) · 사람을 누르면 같이 한 일 목록(누르면 업무) · [그림으로 저장](PNG)
import { useMemo, useRef, useState } from "react";
import { md, ymd } from "../model.js";
import { collabOf, partnersOf, kindsSorted, loners, circleLayout, shortName, clip, textW, KINDS, KIND_L, LOADED_DAYS } from "../collab.js";
import { LOCK_T } from "../secret.js";
import { savePng, SVG_FONT as FONT, fileSafe } from "../svgpng.js";
import { C, Chip, TBtn, Card, Empty, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";

const TEAM_FILL = { "1팀": "#FFFFFF", "2팀": "#EEF1F8", "3팀": "#DCE3F3", "공용": "#F4F5F8" };
const teamFill = (t) => TEAM_FILL[t] || "#FFFFFF";
const kindLine = (by, max = 6) => kindsSorted(by).slice(0, max).map(([k, n]) => `${KIND_L[k]} ${n}`).join(" · ");

export function CollabTab({ D, cu, idx, open }) {
  const [days0, setDays] = useLocal(LS("acdays-" + cu.id), 30), days = [7, 30, 90].includes(days0) ? days0 : 30;
  const [kind, setKind] = useState("all"), [sel, setSel0] = useState(""), [partner, setPartner] = useState(""), [fit, setFit] = useState(false), [moreN, setMoreN] = useState(12);
  const setSel = (id, pid = "") => { setSel0(id); setPartner(pid); setMoreN(12); };
  const C2 = useMemo(() => collabOf(D, { days, idx, viewer: cu, kinds: kind === "all" ? null : [kind] }), [D, idx, cu, days, kind]);
  const nm = useMemo(() => Object.fromEntries((D.users || []).map((u) => [u.id, u.name])), [D.users]);
  const ppl = useMemo(() => C2.people.slice().sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), "ko")), [C2]);
  const me = sel ? C2.people.find((p) => p.id === sel) : null;
  const svgRef = useRef(null);
  const sum = C2.pairs.reduce((s, P) => s + P.n, 0);
  const sub = `최근 ${days}일 · ${kind === "all" ? KINDS.map((k) => k[1]).join(" · ") : KIND_L[kind] + "만"}`;
  // 파일 이름 한글: 협업맵_<이름|팀>_<n>일_<날짜>.png (Blob + a.download · 브라우저가 그대로 씀 · 파일 이름에 못 쓰는 글자만 뺌)
  const save = () => savePng(svgRef.current, `협업 맵 · ${me ? me.name : "팀 전체"} · 최근 ${days}일${kind === "all" ? "" : " · " + KIND_L[kind] + "만"} · ${ymd(new Date())} 기준`, `협업맵_${me ? fileSafe(me.name || me.id, "사람") : "팀"}_${days}일_${ymd(new Date())}.png`);
  return <div className="cm-wrap">
    <Card style={{ padding: "14px 14px 12px", marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.ink }}>협업 맵{me ? ` · ${me.name}` : ""}</h2>
        <span style={{ fontSize: 12.5, color: C.sub }}>{me ? `협업 ${me.n}` : `짝 ${C2.pairs.length} · 협업 ${sum}`}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>
      <div className="v2-filterrow" style={{ marginTop: 10 }}>
        <div className="v2-chips" role="group" aria-label="기간">{[7, 30, 90].map((d) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{d}일</Chip>)}</div>
        <span className="sep" />
        <div className="v2-chips" role="group" aria-label="무엇을 셀까"><Chip on={kind === "all"} onClick={() => setKind("all")}>모두</Chip>{KINDS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}</div>
      </div>
      <div className="v2-filterrow" style={{ marginTop: 8 }}>
        <div className="v2-chips" role="group" aria-label="누구">
          <Chip on={!sel} onClick={() => setSel("")}>팀 전체</Chip>
          {ppl.map((p) => <Chip key={p.id} on={sel === p.id} onClick={() => setSel(p.id)}>{p.name}{p.n ? ` ${p.n}` : ""}</Chip>)}
        </div>
      </div>
      {C2.partial && <div className="cm-note">앱은 끝낸 업무·대화를 최근 {LOADED_DAYS}일 것만 불러와요 · 최근 {LOADED_DAYS}일 끝낸 업무까지만 셈 (열린 업무·프로젝트는 모두 셈)</div>}
    </Card>

    {!me && <TeamView C2={C2} D={D} nm={nm} svgRef={svgRef} onPick={(a, b) => setSel(a, b || "")} save={save} />}
    {me && <PersonView C2={C2} me={me} nm={nm} svgRef={svgRef} partner={partner} setPartner={(id) => { setPartner(id); setMoreN(12); }} fit={fit} setFit={setFit} save={save}
      goPerson={(id) => setSel(id)} open={open} D={D} moreN={moreN} setMoreN={setMoreN} />}
    <p className="a-hint">숫자 = 같이 한 건수 · 같은 업무를 같이 맡음 · 맡김(맡긴 사람 → 담당) · 이어받음(앞 일이 끝나 다음 담당에게 · 담당 넘기기) · 확인·도움 요청(확인 받기 · 도와주세요 · 기한 조정 · 막힘) · 같은 업무 대화(업무마다 1번 · @ 부름 포함) · 같은 프로젝트(열린 프로젝트마다 1번 · 3개 = 1건으로 가볍게). 사용 안 하는 사람·임시 담당은 빼요. 새로 저장하는 것 없이 기록으로만 계산해요.</p>
  </div>;
}

// ── 팀 전체 ──
function TeamView({ C2, D, nm, svgRef, onPick, save }) {
  const top = C2.pairs.slice(0, 3), lone = useMemo(() => loners(C2, D), [C2, D]);
  const [all, setAll] = useState(false);
  const list = all ? C2.pairs : C2.pairs.slice(0, 10);
  if (!C2.pairs.length) return <Card style={{ marginTop: 10 }}><Empty>이 기간에 같이 한 일이 없어요 · 기간을 늘리거나 '모두'를 골라 보세요</Empty></Card>;
  return <>
    <div className="cm-team">
      <Card style={{ padding: 8 }}>
        <div className="cm-net"><NetSvg C2={C2} svgRef={svgRef} onPick={(id) => onPick(id)} /></div>
        <div className="cm-netm">팀 전체 그림은 넓은 화면에서 보여요 · 아래 순위에서 짝을 누르면 그 사람 맵으로 가요</div>
        <div className="cm-foot">
          <div className="cm-legend cm-dt">{["1팀", "2팀", "3팀", "공용"].filter((t) => C2.people.some((p) => p.team === t)).map((t) => <span key={t}><i style={{ background: teamFill(t) }} />{t}</span>)}<span>선 굵기 = 같이 한 수 · 동그라미 크기 = 협업 수 · 누르면 그 사람</span></div>
          <TBtn onClick={save}>그림으로 저장</TBtn>
        </div>
      </Card>
      <div className="cm-rank">
        <div className="cm-rh">많이 협업하는 짝</div>
        {list.map((P, i) => <button key={P.key} type="button" className="cm-pr" onClick={() => onPick(P.a, P.b)}>
          <span className="no">{i + 1}</span>
          <span className="tx"><b>{nm[P.a]} · {nm[P.b]}</b><small>{kindLine(P.by, 3)}</small></span>
          <span className="ct">{P.n}</span>
        </button>)}
        {C2.pairs.length > 10 && <button type="button" className="cm-more" onClick={() => setAll(!all)}>{all ? "접기 ▴" : `${C2.pairs.length - 10}짝 더 보기 ▾`}</button>}
      </div>
    </div>
    <div className="cm-sum">많이 협업하는 짝: {top.map((P) => `${nm[P.a]} · ${nm[P.b]} ${P.n}`).join(" · ")}{lone.length ? `  |  혼자 일이 많은 사람: ${lone.map((p) => `${p.name} (협업 ${p.n} · 열린 일 ${p.open})`).join(" · ")}` : ""}</div>
  </>;
}

function NetSvg({ C2, svgRef, onPick }) {
  const W = 720, H = 540, cx = W / 2, cy = H / 2 + 6, R = 205;
  const pos = new Map(circleLayout(C2.people, cx, cy, R).map((p) => [p.id, p]));
  const maxP = Math.max(1, ...C2.people.map((p) => p.score)), maxE = Math.max(1, ...C2.pairs.map((P) => P.score));
  const rad = (p) => (p.score > 0 ? 17 + 17 * Math.sqrt(p.score / maxP) : 14);
  const labeled = new Set(C2.pairs.slice(0, 10).map((P) => P.key));
  const edges = C2.pairs.slice().reverse();   // 굵은 선이 위로
  return <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="cm-svg" role="img" aria-label="팀 전체 협업 그림" xmlns="http://www.w3.org/2000/svg" fontFamily={FONT}>
    <rect x="0" y="0" width={W} height={H} fill="#FFFFFF" />
    {edges.map((P) => { const a = pos.get(P.a), b = pos.get(P.b); if (!a || !b) return null; const f = P.score / maxE;
      return <line key={P.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={f >= 0.5 ? "#24386B" : f >= 0.2 ? "#7F8DB0" : "#B8C1D6"} strokeWidth={1 + 9 * f} strokeLinecap="round" />; })}
    {edges.filter((P) => labeled.has(P.key)).map((P) => { const a = pos.get(P.a), b = pos.get(P.b); if (!a || !b) return null;
      return <text key={P.key} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#5B6475" stroke="#FFFFFF" strokeWidth="4" paintOrder="stroke">{P.n}</text>; })}
    {C2.people.map((p) => { const q = pos.get(p.id); if (!q) return null; const r = rad(p);
      return <g key={p.id} role="button" tabIndex={0} aria-label={`${p.name} 협업 ${p.n}`} className="cm-node" onClick={() => onPick(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }}>
        <circle cx={q.x} cy={q.y} r={r} fill={teamFill(p.team)} stroke={p.score > 0 ? "#24386B" : "#B8C1D6"} strokeWidth={p.score > 0 ? 2.2 : 1.5} />
        <text x={q.x} y={q.y + 4.5} textAnchor="middle" fontSize={r > 24 ? 14 : 12.5} fontWeight="800" fill={p.score > 0 ? "#0F1F5C" : "#8A92A3"}>{shortName(p.name)}</text>
        <text x={q.x} y={q.y + r + 14} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#5B6475" stroke="#FFFFFF" strokeWidth="4" paintOrder="stroke">{p.n ? p.n : ""}</text>
      </g>; })}
  </svg>;
}

// ── 한 사람 ──
function PersonView({ C2, me, nm, svgRef, partner, setPartner, fit, setFit, save, goPerson, open, D, moreN, setMoreN }) {
  const ps = useMemo(() => partnersOf(C2, me.id), [C2, me.id]);
  const cur = ps.find((p) => p.id === partner) || null;
  const pName = (pid) => ((D.projects || []).find((p) => p.id === pid) || {}).title || "";
  if (!ps.length) return <Card style={{ marginTop: 10 }}><Empty>{me.name}님은 이 기간에 다른 사람과 같이 한 일이 없어요</Empty></Card>;
  return <>
    <Card style={{ marginTop: 10, padding: 8 }}>
      <div className={"cm-scroll" + (fit ? " fit" : "")}><MapSvg me={me} ps={ps} svgRef={svgRef} sel={partner} onPick={setPartner} /></div>
      <div className="cm-foot">
        <span className="cm-legend"><span>사람을 누르면 같이 한 일</span></span>
        <TBtn onClick={() => setFit(!fit)}>{fit ? "원래 크기" : "화면에 맞추기"}</TBtn>
        <TBtn onClick={save}>그림으로 저장</TBtn>
      </div>
    </Card>
    {!cur && <div className="cm-sum">{me.name}님과 가장 많이 협업한 사람: {ps.slice(0, 3).map((p) => `${p.name} ${p.n}`).join(" · ")} · 사람을 누르면 같이 한 일이 보여요</div>}
    {cur && <Card style={{ marginTop: 10 }}>
      <div className="cm-ph">
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{me.name} · {cur.name} <span className="ct">{cur.n}</span></b>
          <div className="cm-kinds">{kindsSorted(cur.by).map(([k, n]) => <span key={k}>{KIND_L[k]} {n}</span>)}</div>
        </div>
        <TBtn onClick={() => goPerson(cur.id)}>{cur.name} 맵 ›</TBtn>
      </div>
      {cur.items.slice(0, moreN).map((x, i) => { const who = x.from && x.to ? `${nm[x.from] || ""} → ${nm[x.to] || ""}` : "";
        const sub = [x.sub || "", x.taskId && x.projectId ? pName(x.projectId) : "", x.prevTitle ? `앞 일 '${x.prevTitle}'` : "", who, x.at ? md(String(x.at).slice(0, 10)) : ""].filter(Boolean).join(" · ");
        return <button key={x.kind + (x.taskId || x.projectId) + i} type="button" className="cm-it" onClick={() => (x.taskId ? open({ type: "task", id: x.taskId, ...(x.kind === "talk" ? { focus: "talk" } : {}) }) : open({ type: "project", id: x.projectId }))}>
          <span className="tg">{KIND_L[x.kind]}</span>
          <span className="tx"><b>{x.secret && <i className="lk">기밀</i>}{x.title || (x.taskId ? "업무" : "프로젝트")}</b><small>{sub}</small></span>
          <span className="go">›</span>
        </button>; })}
      {cur.items.length > moreN && <button type="button" className="cm-more" onClick={() => setMoreN(moreN + 20)}>{cur.items.length - moreN}건 더 보기 ▾</button>}
    </Card>}
  </>;
}

// 오른쪽으로 뻗는 마인드맵: 그 사람 → 사람(많은 순, 8명까지) → 종류(많은 순 3개 · 최근 일 제목)
function MapSvg({ me, ps, svgRef, sel, onPick }) {
  const show = ps.slice(0, 8), rest = ps.length - show.length;
  const RW = 112, RH = 58, PX = 176, PW = 150, PH = 40, LX = 372, LW = 218, LH = 44, GAP = 10, ROWH = LH + 8;
  const blocks = []; let y = 14;
  show.forEach((p) => { const ks = kindsSorted(p.by).slice(0, 3); const h = Math.max(1, ks.length) * ROWH; blocks.push({ p, ks, y, h }); y += h + GAP; });
  const H = Math.max(y + (rest > 0 ? 24 : 4), RH + 28), W = LX + LW + 12, ry = H / 2 - RH / 2 - (rest > 0 ? 10 : 0);
  const curve = (x1, y1, x2, y2) => `M${x1},${y1} C${x1 + (x2 - x1) * 0.5},${y1} ${x1 + (x2 - x1) * 0.5},${y2} ${x2},${y2}`;
  const lastOf = (p, k) => p.items.find((x) => x.kind === k);
  return <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="cm-svg" role="img" aria-label={`${me.name} 협업 마인드맵`} xmlns="http://www.w3.org/2000/svg" fontFamily={FONT}>
    <rect x="0" y="0" width={W} height={H} fill="#FFFFFF" />
    {blocks.map(({ p, ks, y: by, h }) => { const pcy = by + h / 2;
      return <g key={p.id}>
        <path d={curve(16 + RW, ry + RH / 2, PX, pcy)} fill="none" stroke={sel === p.id ? "#24386B" : "#9AA6C4"} strokeWidth={sel === p.id ? 2.4 : 1.6} />
        {ks.map(([k], i) => <path key={k} d={curve(PX + PW, pcy, LX, by + i * ROWH + LH / 2)} fill="none" stroke="#C3CBDD" strokeWidth="1.4" />)}
      </g>; })}
    <g>
      <rect x="16" y={ry} width={RW} height={RH} rx="12" fill="#0F1F5C" />
      <text x={16 + 14} y={ry + 25} fontSize="16" fontWeight="800" fill="#FFFFFF">{clip(me.name, 16, RW - 24)}</text>
      <text x={16 + 14} y={ry + 44} fontSize="12" fontWeight="700" fill="#C9D3F2">협업 {me.n}</text>
    </g>
    {blocks.map(({ p, ks, y: by, h }) => { const pcy = by + h / 2, on = sel === p.id, cw = textW(String(p.n), 12) + 14;
      return <g key={p.id}>
        <g role="button" tabIndex={0} className="cm-node" aria-label={`${p.name} ${p.n}`} aria-pressed={on} onClick={() => onPick(on ? "" : p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(on ? "" : p.id); } }}>
          <rect x={PX} y={pcy - PH / 2} width={PW} height={PH} rx="11" fill={on ? "#24386B" : "#FFFFFF"} stroke="#24386B" strokeWidth={on ? 2 : 1.8} />
          <text x={PX + 13} y={pcy + 5} fontSize="14" fontWeight="800" fill={on ? "#FFFFFF" : "#1B2333"}>{clip(p.name, 14, PW - cw - 30)}</text>
          <rect x={PX + PW - cw - 10} y={pcy - 10} width={cw} height="20" rx="10" fill={on ? "#FFFFFF" : "#EEF1F8"} />
          <text x={PX + PW - 10 - cw / 2} y={pcy + 4.5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#24386B">{p.n}</text>
        </g>
        {ks.map(([k, n], i) => { const ly = by + i * ROWH, it = lastOf(p, k), t = it ? (it.secret ? LOCK_T : it.title || "") : "";
          return <g key={k} role="button" tabIndex={0} className="cm-node" aria-label={`${p.name} ${KIND_L[k]} ${n}`} onClick={() => onPick(p.id)} onKeyDown={(e) => { if (e.key === "Enter") onPick(p.id); }}>
            <rect x={LX} y={ly} width={LW} height={LH} rx="10" fill="#FFFFFF" stroke="#D5DBE8" strokeWidth="1.4" />
            <text x={LX + 12} y={ly + 18} fontSize="12.5" fontWeight="800" fill="#1B2333">{KIND_L[k]} {n}</text>
            <text x={LX + 12} y={ly + 35} fontSize="11.5" fill="#5B6475">{clip(t, 11.5, LW - 24)}</text>
          </g>; })}
      </g>; })}
    {rest > 0 && <text x={PX} y={H - 10} fontSize="12" fill="#8A92A3">그 밖 {rest}명 · {ps.slice(8).map((p) => p.name).slice(0, 4).join(" · ")}{rest > 4 ? " …" : ""}</text>}
  </svg>;
}
