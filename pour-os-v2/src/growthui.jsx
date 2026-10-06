// 업무OS v2 — 그로스보드 v2 화면 (③ 사용자 확정 2026-10-06 · 시안 step8 ③ · step11 ③)
//  KPI → 프로젝트·반복 → 끝낸 일 · [나 | 우리 팀 | 모두(관리자)] · [이번 달 | 지난달 | 반기] · [계층 | 마인드맵](폰 계층 · PC 마인드맵 · 기기 기억)
//  마인드맵 = 프로젝트 마인드맵과 같은 자리 계산(mmlayout.js) · [그림으로 저장] PNG(svgpng.js) · 저장(쓰기) 없음
import { useEffect, useMemo, useRef, useState } from "react";
import { ymd, isMaster, nameOf, teamOf } from "./model.js";
import { C, TBtn, Chip, Seg, Card, Empty, Sheet, useLocal } from "./ui.jsx";
import { LS } from "./core.jsx";
import { useKpiDefs } from "./kpiui.jsx";
import { growthTree, periodOf, peopleOf } from "./growth.js";
import { useDoneSince } from "./reportui.jsx";
import { visibleTree, layoutTree, curve, defaultView } from "./mmlayout.js";
import { savePng, clip, textW, fileSafe, SVG_FONT } from "./svgpng.js";
import { NST } from "./mindmap.jsx";

export function GrowthSheet(p) { return <Sheet title="그로스보드" onBack={p.onBack} onClose={p.onClose}><GrowthBody {...p} /></Sheet>; }

export function GrowthBody({ D, cu, open }) {
  const key = ymd(new Date()), admin = isMaster(cu);
  const [sc0, setSc] = useLocal(LS("gb-scope"), "me"), sc = sc0 === "all" && !admin ? "me" : ["me", "team", "all"].includes(sc0) ? sc0 : "me";
  const [pk, setPk] = useLocal(LS("gb-period"), "month");
  const [v0, setV] = useLocal(LS("gbview"), "");
  const view = defaultView(v0, typeof window !== "undefined" ? window.innerWidth : 1280);
  const period = periodOf(pk, key);
  const K = useKpiDefs(D), M = useDoneSince(D, period.from);
  const uids = useMemo(() => peopleOf(D.users, cu.id, sc), [D.users, cu.id, sc]);
  const team = teamOf(cu);
  const rootName = sc === "me" ? cu.name : sc === "team" ? (team || cu.name) : "모두";
  const tree = useMemo(() => (K && M.ready ? growthTree({ users: D.users, brands: D.brands, projects: D.projects, tasks: M.tasks, K, ak: D.ak, gh: D.kpi.sales.grohome, lagV2: D.kpi.lagV2, key }, { uids, period, rootName }) : null),
    [K, M.ready, M.tasks, D.users, D.brands, D.projects, D.ak, D.kpi, key, uids, pk, rootName]);
  const tap = (n) => { if (n.kind === "task") open({ type: "task", id: n.tid }); else if (n.kind === "proj") open({ type: "project", id: n.pid }); else if (n.kind === "ak") open({ type: "routine", id: n.akId }); };
  const c = tree && tree.count;
  return <div className="gb-wrap">
    <div className="v2-filterrow" aria-label="보는 범위">
      <div className="v2-chips" role="group" aria-label="누구">{[["me", "나"], ["team", team ? `우리 팀 (${team})` : "우리 팀"], ...(admin ? [["all", "모두"]] : [])].map(([k, l]) => <Chip key={k} on={sc === k} onClick={() => setSc(k)}>{l}</Chip>)}</div>
      <span className="sep" />
      <div className="v2-chips" role="group" aria-label="기간">{[["month", "이번 달"], ["prev", "지난달"], ["half", "반기"]].map(([k, l]) => <Chip key={k} on={pk === k} onClick={() => setPk(k)}>{l}</Chip>)}</div>
    </div>
    <div className="mm-seg gb-seg"><Seg items={[["tree", "계층"], ["map", "마인드맵"]]} value={view} onChange={setV} /></div>
    {M.err && <Card style={{ marginTop: 10 }}><Empty>지난 끝낸 업무를 불러오지 못했어요 · 최근 30일만 보여요</Empty></Card>}
    {!tree ? <Card style={{ marginTop: 10 }}><Empty>그로스보드를 만드는 중이에요</Empty></Card> : <>
      <p className="gb-sum">{period.label} · {rootName} · KPI {c.kpi} · 프로젝트 {c.proj} · 끝낸 일 {c.done}{c.ak ? ` · 반복 ${c.ak}` : ""}</p>
      {!tree.kids.length ? <Card><Empty>이 기간에 {sc === "me" ? "내" : "우리"} KPI·프로젝트·끝낸 일이 없어요</Empty></Card>
        : view === "map" ? <GMap tree={tree} tap={tap} caption={`그로스보드 · ${rootName} · ${period.label} · ${key} 기준`} file={`그로스보드_${fileSafe(rootName, "나")}_${fileSafe(period.label, "기간")}_${key}.png`} />
        : <GTree tree={tree} tap={tap} />}
    </>}
    <p className="mm-hint">KPI → 그 KPI를 움직이는 프로젝트·반복 → 그 기간에 끝낸 일 · 따로 저장하는 것 없이 업무·프로젝트·KPI 연결 그대로 그려요 · 기밀 업무·프로젝트는 빠져요</p>
  </div>;
}

// 폰: 계층
function GTree({ tree, tap }) {
  const [more, setMore] = useState({});
  const Node = ({ n, d }) => { const ks = n.kids || [], lim = d >= 2 ? 6 : 99, all = more[n.id], shown = all ? ks : ks.slice(0, lim);
    const go = n.kind === "task" || n.kind === "proj" || n.kind === "ak";
    return <div className={"gb-b d" + d}>
      <button type="button" className={"gb-n " + n.kind + " " + (n.st || "")} onClick={go ? () => tap(n) : undefined} disabled={!go} aria-label={`${n.title}${n.sub ? " · " + n.sub : ""}`}>
        <span className="t">{n.title}{go ? " ›" : ""}</span>{n.sub ? <span className="s">{n.sub}</span> : null}</button>
      {shown.length > 0 && <div className="gb-kids">{shown.map((k) => <Node key={k.id} n={k} d={d + 1} />)}
        {ks.length > shown.length && <button type="button" className="mm-more" onClick={() => setMore({ ...more, [n.id]: true })}>+{ks.length - shown.length}개 더 ▾</button>}</div>}
    </div>; };
  return <div className="gb-tree">
    <div className="gb-root"><b>{tree.title}</b><span>{tree.sub}</span></div>
    {tree.kids.map((k) => <Node key={k.id} n={k} d={1} />)}
  </div>;
}

// PC: 오른쪽으로 뻗는 마인드맵 (프로젝트 마인드맵과 같은 자리 계산 · 모양 규칙)
function GMap({ tree, tap, caption, file }) {
  const [fold, setFold] = useState({}), [more, setMore] = useState({}), [all, setAll] = useState(false), [fit, setFit] = useState(false);
  const isFold = (n) => (fold[n.id] != null ? fold[n.id] : false);
  const vt = visibleTree(tree, isFold, (n) => all || !!more[n.id]);
  const maxH = typeof window !== "undefined" ? Math.min(Math.round(window.innerHeight * 0.7), 760) : 600;
  const L = layoutTree(vt, { rootMax: Math.max(120, Math.round(maxH / 2) - 20) });
  const box = useRef(null), svgRef = useRef(null), drag = useRef(null);
  const [bw, setBw] = useState(0);
  useEffect(() => { const m = () => box.current && setBw(box.current.clientWidth); m(); window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }, []);
  const sc = fit && bw ? Math.min(1, (bw - 4) / L.W, (maxH - 4) / L.H) : 1;
  const toggle = (n) => setFold({ ...fold, [n.id]: !isFold(n) });
  const onTap = (n) => { if (n.kind === "more") setMore({ ...more, [n.parentId]: true }); else if (n.kind === "kpi") toggle(n); else tap(n); };
  const onDown = (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; const b = box.current; drag.current = { x: e.clientX, y: e.clientY, l: b.scrollLeft, t: b.scrollTop, moved: false }; };
  const onMove = (e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return; d.moved = true; box.current.scrollLeft = d.l - dx; box.current.scrollTop = d.t - dy; };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && d.moved) { box.current.__moved = true; setTimeout(() => { if (box.current) box.current.__moved = false; }, 0); } };
  const onClickCap = (e) => { if (box.current && box.current.__moved) { e.stopPropagation(); e.preventDefault(); } };
  const kb = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const pill = (n) => (n.kind === "kpi" ? (n.kids || []).length : n.kind === "proj" && n.n ? n.n : "");
  return <>
    <div className="mm-rmap gb-map">
      <div ref={box} className={"mm-rbox" + (fit ? " fit" : "")} style={{ maxHeight: maxH }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClickCapture={onClickCap}>
        <svg ref={svgRef} viewBox={`0 0 ${L.W} ${L.H}`} width={Math.round(L.W * sc)} height={Math.round(L.H * sc)} className="mm-svg gb-svg" role="group" aria-label="그로스보드 마인드맵" xmlns="http://www.w3.org/2000/svg" fontFamily={SVG_FONT}>
          <rect x="0" y="0" width={L.W} height={L.H} fill="#FFFFFF" />
          {L.edges.map(({ from: a, to: b }) => { const hasT = a.kind !== "root" && a.total > 0, x1 = a.x + a.w + (hasT ? 30 : 0);
            return <path key={a.id + ">" + b.id} d={curve(x1, a.y + a.h / 2, b.x, b.y + b.h / 2)} fill="none" stroke={b.st === "late" ? "#D89A9E" : a.kind === "root" ? "#9AA6C4" : "#C3CBDD"} strokeWidth={a.kind === "root" ? 1.7 : 1.4} />; })}
          {L.nodes.map((n) => {
            if (n.kind === "root") return <g key="root" className="mm-node root" aria-label={`그로스보드 ${tree.title}`}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="12" fill="#0F1F5C" />
              <text x={n.x + 12} y={n.y + 19} fontSize="13.5" fontWeight="800" fill="#FFFFFF">{clip(tree.title, 13.5, n.w - 22)}</text>
              <text x={n.x + 12} y={n.y + 36} fontSize="11" fontWeight="700" fill="#C9D3F2">{clip(tree.sub, 11, n.w - 22)}</text></g>;
            if (n.kind === "more") return <g key={n.id} role="button" tabIndex={0} className="mm-node more" aria-label={`${n.n}개 더 보기`} onClick={() => onTap(n)} onKeyDown={kb(() => onTap(n))}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" fill="#EEF1F8" stroke="#D5DBE8" strokeWidth="1.2" />
              <text x={n.x + 12} y={n.y + 22} fontSize="12.5" fontWeight="800" fill="#24386B">+{n.n}개 더 ▾</text></g>;
            const S = n.kind === "kpi" ? { fill: "#FFFFFF", stroke: n.st === "wait" ? "#B7BFD0" : "#24386B", sw: 1.6, dash: n.st === "wait" ? "5 4" : null, t: "#0F1F5C", s: "#5B6475" } : n.kind === "ak" ? { fill: "#24386B", stroke: "#24386B", sw: 1.5, t: "#FFFFFF", s: "#C9D3F2" } : NST[n.st] || NST[""];
            const pl = String(pill(n) || ""), pw = pl ? textW(pl, 11) + 12 : 0;
            return <g key={n.id} data-id={n.id}>
              <g role="button" tabIndex={0} className="mm-node" aria-label={`${n.title}${n.sub ? " · " + n.sub : ""}`} onClick={() => onTap(n)} onKeyDown={kb(() => onTap(n))}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="11" fill={S.fill} stroke={S.stroke} strokeWidth={S.sw} strokeDasharray={S.dash || undefined} />
                <text x={n.x + 11} y={n.y + 19} fontSize="13" fontWeight="800" fill={S.t}>{clip(n.title, 13, n.w - 22 - (pw ? pw + 6 : 0))}</text>
                {pl && <><rect x={n.x + n.w - pw - 8} y={n.y + 7} width={pw} height="17" rx="8.5" fill={n.kind === "ak" ? "#FFFFFF" : "#EEF1F8"} /><text x={n.x + n.w - 8 - pw / 2} y={n.y + 19.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#24386B" style={{ fontVariantNumeric: "tabular-nums" }}>{pl}</text></>}
                <text x={n.x + 11} y={n.y + 36} fontSize="11" fill={S.s}>{clip(n.sub || "", 11, n.w - 22)}</text>
              </g>
              {n.total > 0 && <g role="button" tabIndex={0} className="mm-node tog" aria-label={`${n.title} ${n.folded ? "펼치기" : "접기"}`} aria-expanded={!n.folded} onClick={() => toggle(n)} onKeyDown={kb(() => toggle(n))}>
                <rect x={n.x + n.w + 4} y={n.y + n.h / 2 - 11} width="26" height="22" rx="11" fill={n.folded ? "#24386B" : "#FFFFFF"} stroke="#C3CBDD" strokeWidth="1.2" />
                <text x={n.x + n.w + 17} y={n.y + n.h / 2 + 4} textAnchor="middle" fontSize={n.folded ? 10.5 : 12} fontWeight="800" fill={n.folded ? "#FFFFFF" : "#24386B"}>{n.folded ? "+" + n.total : "‹"}</text>
              </g>}
            </g>; })}
        </svg>
      </div>
      <div className="mm-foot">
        <TBtn onClick={() => setFit(!fit)}>{fit ? "원래 크기" : "화면에 맞추기"}</TBtn>
        <TBtn onClick={() => { setAll(true); setFold({}); }}>모두 펼치기</TBtn>
        <TBtn onClick={() => savePng(svgRef.current, caption, file)}>그림으로 저장</TBtn>
      </div>
    </div>
    <p className="mm-hint">KPI를 누르면 접기·펼치기 · 프로젝트·끝낸 일을 누르면 그 화면 · 그림은 이 칸 안에서 옆으로 밀어서 봐요</p>
  </>;
}
