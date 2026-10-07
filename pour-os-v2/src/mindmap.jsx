// 업무OS v2 — 프로젝트 마인드맵 · 결정 업무
// 가지 = 업무, 작은 가지 = 하위 업무 (목록·달력·오늘과 같은 데이터, 따로 저장하는 것 없음)
// 큰 가지 번호 = 앞 일 순서(deps·흐름 단계·기한). 신제품은 7단계가 큰 가지 · 로드(2026-10-07): 일반·흐름도 단계가 큰 가지(빈 단계 · 맨 끝 '단계 미정')
//   그로홈 KPI(gh_kpi_)만 예전처럼 맨 위 업무가 큰 가지
// 결정 업무(decision): 하위 업무(option)를 '안'으로 비교 → [이 안으로 정하기] → 정한 안·이유·날짜 기록, 안 고른 안은 보류(지우지 않음), 결정 업무는 끝냄
// 끌어서 순서 바꾸기는 하지 않음(실수 방지) — 순서는 업무 보기 [앞 일 바꾸기]로
import { useEffect, useMemo, useRef, useState } from "react";
import { ymd, md, ddays, ddayLabel, nameOf, isDone, isMine, ownersOf, dueOf, riskOf, isMaster, addDays, nextWorkday, roadOf, roadStates, phaseOfTask, curStage, estOf } from "./model.js";
import { projEstimate, tplRoad, tplLive, tplKind } from "./tpl.js";
import { LAUNCH_PHASES } from "./launch.js";
import { turnOf, predsOf } from "./turn.js";
import { phaseStates } from "./views.js";
import { C, Act, TBtn, Card, Empty, Seg, inp, useLocal } from "./ui.jsx";
import { LS } from "./core.jsx";
import { visibleTree, layoutTree, curve, defaultView, MM } from "./mmlayout.js";
import { savePng, clip, textW, fileSafe, SVG_FONT } from "./svgpng.js";

const PH_SHORT = { plan: "기획", sample: "샘플", pack: "패킹", content: "콘텐츠", channel: "채널 등록", stock: "창고 입고", promo: "출시 홍보" };
// 예상 소요(2026-10-07 ①): 업무 가지 'n일' · 단계 가지 = 그 단계 걸리는 평일(겹친 것 빼고) · 프로젝트 = '예상 n일' (tpl.projEstimate)
const estL = (t) => (estOf(t) ? `${estOf(t)}일` : "");
const spanL = (E, k) => { const s = E && E.stage && E.stage.get(k); return s && s.span ? `${s.span}일` : ""; };
const who = (D, t) => nameOf(D.users, ownersOf(t)[0]) || t.ownerText || "담당 없음";
// 로드 단계 가지 (일반·흐름): 모든 단계(빈 단계 포함) + 맨 끝 '단계 미정'(업무가 있을 때만) · 상태는 model.roadStates
const PH_CLS = { done: "done", late: "late", cur: "doing", todo: "wait", none: "" };
const phSub = (ph) => (ph.state === "done" ? "다 끝남" : ph.state === "none" ? "비어 있어요" : `남은 ${ph.left} / ${ph.total}`);
export function roadBranches(road, all, phOf, isTop, idx, key) {
  const out = roadStates(road, all, phOf, key).map((ph) => ({ id: "ph:" + ph.k, phase: ph, kids: orderTasks(all.filter((t) => isTop(t) && phOf(t) === ph.k), idx) }));
  const u = all.filter((t) => isTop(t) && !phOf(t));
  if (u.length) out.push({ id: "ph:", phase: roadStates([{ k: "", name: "단계 미정" }], u, () => "", key)[0], kids: orderTasks(u, idx) });
  return out;
}
// 가지 모양: done 끝남 · doing 하는 중 · wait 앞 일 기다림 · hold 보류 · late 지남·막힘 · (없음) 할 일
export function nodeState(t, idx, key) {
  if (isDone(t)) return "done";
  if (t.status === "hold") return "hold";
  const r = riskOf(t, key); if (r && r.red) return "late";
  if (t.status === "inprogress" || t.status === "review") return "doing";
  const tu = turnOf(t, idx, key); if (tu.state === "wait" || tu.state === "late") return "wait";
  return "";
}
// 같은 층 업무 순서: 앞 일 깊이(같은 프로젝트 안) → 흐름 단계 → 기한 → 만든 때
export function orderTasks(ts, idx) {
  const ids = new Set(ts.map((t) => t.id)), memo = {};
  const depth = (t, seen = new Set()) => { if (memo[t.id] != null) return memo[t.id]; if (seen.has(t.id)) return 0; seen.add(t.id);
    const ps = predsOf(t, idx).filter((p) => ids.has(p.id)); return (memo[t.id] = ps.length ? Math.max(...ps.map((p) => depth(p, seen) + 1)) : 0); };
  return ts.slice().sort((a, b) => depth(a) - depth(b) || (a.wfStage ?? 99) - (b.wfStage ?? 99) || String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

// 결정 업무 칸 (마인드맵 옆 요약 · 업무 보기 공용)
export function DecisionBlock({ D, cu, A, t, open, compact }) {
  const [pick, setPick] = useState(""), [why, setWhy] = useState(""), [nt, setNt] = useState(""), [edit, setEdit] = useState(""), [info, setInfo] = useState("");
  const opts = (D.tasks || []).filter((x) => x.parentId === t.id).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  const p = (D.projects || []).find((x) => x.id === t.projectId);
  const can = isMine(t, cu.id) || t.requestedBy === cu.id || (p && p.assigneeId === cu.id) || isMaster(cu);
  const dec = t.decided, L = (i) => "안 " + String.fromCharCode(65 + i);
  const add = () => { if (!nt.trim()) return; A.addTask({ title: nt, parentId: t.id, projectId: t.projectId, assigneeId: cu.id, dueDate: dueOf(t) || "", noReview: true, extra: { option: true } }); setNt(""); };
  return <div>
    {dec && <div style={{ padding: "10px 12px", borderRadius: 12, background: C.soft, fontSize: 13.5, color: C.text, marginBottom: 8, lineHeight: 1.55 }}>
      <b style={{ color: C.ink }}>정함 · {dec.title}</b><div style={{ color: C.sub, fontSize: 12.5 }}>{dec.byName} · {md(String(dec.at).slice(0, 10))}{dec.reason ? ` · 이유: ${dec.reason}` : ""}</div></div>}
    {opts.length === 0 && <Empty>아직 안이 없어요. 아래에 비교할 안을 넣어 주세요 (예: 해외 OEM · 국내 제조사 · 수입)</Empty>}
    {opts.map((o, i) => { const chosen = dec && dec.optionId === o.id, dropped = o.optDropped || (dec && !chosen && o.status === "hold");
      return <div key={o.id} style={{ padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <b style={{ flex: "0 0 auto", minWidth: 36, fontSize: 13, color: dropped ? C.mute : C.ink, paddingTop: 1 }}>{L(i)}</b>
          <div role="button" tabIndex={0} onClick={() => open({ type: "task", id: o.id })} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dropped ? C.mute : C.text }}>{o.title}{chosen ? " · 정함" : dropped ? " · 보류" : ""}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, wordBreak: "break-word" }}>{o.optInfo || "단가 · MOQ · 납기 같은 비교 내용을 적어 두세요"}{` · ${who(D, o)}`}</div>
          </div>
          {can && !dec && <TBtn onClick={() => { setEdit(edit === o.id ? "" : o.id); setInfo(o.optInfo || ""); }} style={{ padding: "2px 2px", fontSize: 12.5 }}>적기</TBtn>}
        </div>
        {edit === o.id && <div style={{ display: "flex", gap: 6, marginTop: 6 }}><input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="예: 단가 3,200원 · MOQ 3,000 · 납기 45일" aria-label={`${o.title} 비교 내용`} style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
          <Act onClick={() => { A.setOptInfo(o, info); setEdit(""); }}>저장</Act></div>}
        {can && !dec && !isDone(t) && (pick === o.id
          ? <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="정한 이유 (선택 · 예: 납기가 짧고 MOQ가 낮아요)" aria-label="정한 이유" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>정하면 이유와 날짜가 기록에 남고, 다른 안은 보류로 남아요(지우지 않음). '{t.title}'은 끝냄이 되어 다음 단계 담당에게 차례가 넘어가요. 5초 안에 되돌릴 수 있어요.</div>
              <div style={{ display: "flex", gap: 6 }}><Act onClick={() => setPick("")}>취소</Act><Act onClick={() => { A.decide(t, o, why, opts); setPick(""); setWhy(""); }} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>{L(i)}로 정하기</Act></div></div>
          : !dropped ? <div style={{ marginTop: 6 }}><Act onClick={() => setPick(o.id)}>이 안으로 정하기</Act></div> : null)}
      </div>; })}
    {can && !dec && !isDone(t) && <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} placeholder="+ 안 추가 (예: 국내 제조사)" aria-label="안 추가" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
      <Act onClick={add}>추가</Act></div>}
    {!compact && can && !dec && !isDone(t) && <div style={{ marginTop: 6 }}><TBtn tone="mute" onClick={() => A.setDecision(t, false)} style={{ padding: "4px 0", fontSize: 12.5 }}>결정 업무 풀기 (보통 업무로)</TBtn></div>}
  </div>;
}

// 마인드맵 (프로젝트 한 장의 탭) — [계층 | 마인드맵] 두 보기 (기기마다 기억 · 처음엔 폰 계층 · PC 마인드맵)
export function MindMap(props) {
  const [saved, setView] = useLocal(LS("mmview"), null);
  const view = defaultView(saved, typeof window !== "undefined" ? window.innerWidth : 1280);
  return <div className="mm-wrap">
    <div className="mm-seg"><Seg items={[["tree", "계층"], ["map", "마인드맵"]]} value={view} onChange={setView} /></div>
    {view === "map" ? <RightMap {...props} /> : <TreeMap {...props} />}
  </div>;
}

const Legend = () => <div className="mm-legend"><span><i className="done" />끝남</span><span><i className="doing" />하는 중</span><span><i className="wait" />앞 일 기다림</span><span><i className="hold" />보류</span><span><i className="late" />지남·막힘</span></div>;

// 계층형 (예전 그대로)
function TreeMap({ D, cu, A, open, p, idx, launch }) {
  const key = ymd(new Date());
  const E = useMemo(() => projEstimate(p, D, key), [p, D, key]);
  const [sel, setSel0] = useState("root"), [more, setMore] = useState({}), [nt, setNt] = useState(""), [after, setAfter] = useState(true), [kt, setKt] = useState("");
  // 가지를 누르면 요약 칸으로 (세로형일 때 요약이 지도 아래에 있어서)
  const setSel = (id) => { setSel0(id); setTimeout(() => { const side = document.querySelector(".mm-side"), map = document.querySelector(".mm-map"); if (side && map && side.getBoundingClientRect().top > map.getBoundingClientRect().bottom - 2) side.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 30); };
  const all = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const byId = new Map(all.map((t) => [t.id, t]));
  const kidsOf = (id) => orderTasks(all.filter((t) => t.parentId === id), idx);
  const tops = orderTasks(all.filter((t) => !t.parentId || !byId.has(t.parentId)), idx);
  // 큰 가지: 일반 = 맨 위 업무 / 신제품 = 7단계 (단계 아래 항목)
  const road = launch ? null : roadOf(p, D), phOf = (t) => phaseOfTask(t, p, D, byId, road), isTop = (t) => !t.parentId || !byId.has(t.parentId);
  const branches = launch
    ? phaseStates(all.filter((t) => t.launchItem), key).map((ph) => ({ id: "ph:" + ph.k, phase: ph, kids: orderTasks(all.filter((t) => t.phase === ph.k && (!t.parentId || !byId.has(t.parentId))), idx) })).filter((b) => b.kids.length)
    : road ? roadBranches(road, all, phOf, isTop, idx, key) : tops.map((t) => ({ id: t.id, t, kids: kidsOf(t.id) }));
  const rStates = road ? branches.filter((b) => b.phase.k).map((b) => b.phase) : [], [rk, setRk] = useState(null), addK = rk != null ? rk : curStage(rStates);
  const selPh = sel.startsWith("ph:") ? branches.find((b) => b.id === sel) : null;
  const cur = sel === "root" || sel.startsWith("ph:") ? null : byId.get(sel);
  const lastTop = tops.filter((t) => !isDone(t)).slice(-1)[0] || tops.slice(-1)[0];
  const addTop = () => { if (!nt.trim()) return; A.addTask({ title: nt, projectId: p.id, assigneeId: cu.id, dueDate: "", noReview: true, ...(road ? (selPh && selPh.phase.k ? { phase: selPh.phase.k } : addK ? { phase: addK } : {}) : after && lastTop ? { deps: [lastTop.id] } : {}) }); setNt(""); };
  const addKid = (t) => { if (!kt.trim()) return; A.addTask({ title: kt, parentId: t.id, projectId: p.id, assigneeId: ownersOf(t)[0] || cu.id, dueDate: dueOf(t) || "", noReview: true, ...(t.decision ? { extra: { option: true } } : {}) }); setKt(""); };
  const Node = ({ t, num, cls = "" }) => { const st = nodeState(t, idx, key), r = riskOf(t, key), d = dueOf(t), kids = all.filter((x) => x.parentId === t.id).length;
    const tag = t.decision ? (t.decided ? "정함" : "결정 대기") : t.option && t.optDropped ? "보류" : null;
    return <button type="button" className={`mm-n ${st} ${cls}` + (sel === t.id ? " sel" : "")} onClick={() => setSel(t.id)} aria-pressed={sel === t.id}>
      <span className="mm-t">{num != null && <i className="mm-num">{num}</i>}{tag && <i className="mm-tag">{tag}</i>}{t.title}</span>
      <span className="mm-s">{[who(D, t), d ? md(d) + (isDone(t) ? "" : r && r.red ? " · " + r.label : "") : "", estL(t), t.option && t.optInfo ? t.optInfo : "", t.decided ? "→ " + t.decided.title : "", !launch && kids && !t.decision ? `하위 ${kids}` : ""].filter(Boolean).join(" · ")}</span>
    </button>; };
  const KidList = ({ b }) => { const lim = more[b.id] ? 99 : 6, ks = b.kids;
    if (!ks.length) return null;
    return <div className="mm-kids">{ks.slice(0, lim).map((k) => <div key={k.id} className="mm-k"><Node t={k} /></div>)}
      {ks.length > lim && <div className="mm-k"><button type="button" className="mm-more" onClick={() => setMore({ ...more, [b.id]: true })}>{ks.length - lim}개 더 ▾</button></div>}</div>; };
  const panel = cur ? <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, wordBreak: "keep-all" }}>{cur.title}</div>
      <div style={{ fontSize: 12.5, color: C.sub, margin: "2px 0 8px" }}>{[who(D, cur), dueOf(cur) ? `기한 ${md(dueOf(cur))} ${isDone(cur) ? "" : ddayLabel(ddays(dueOf(cur), key))}` : "기한 미정", isDone(cur) ? "끝남" : cur.status === "hold" ? "보류" : cur.status === "inprogress" ? "진행 중" : "할 일"].join(" · ")}</div>
      {cur.decision && <DecisionBlock D={D} cu={cu} A={A} t={cur} open={open} compact />}
      {!cur.decision && !isDone(cur) && <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input value={kt} onChange={(e) => setKt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addKid(cur); }} placeholder="+ 작은 가지 (하위 업무)" aria-label="하위 업무 추가" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
        <Act onClick={() => addKid(cur)}>추가</Act></div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <Act onClick={() => open({ type: "task", id: cur.id })} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>업무 열기 ›</Act>
        {!isDone(cur) && <Act onClick={() => open({ type: "add", preset: { projectId: p.id, deps: [cur.id], dueDate: nextWorkday(addDays(dueOf(cur) && dueOf(cur) > key ? dueOf(cur) : key, 1)), ...(road && phOf(cur) ? { phase: phOf(cur) } : {}) } })}>+ 다음 단계</Act>}
        {!launch && !cur.parentId && !cur.decision && !isDone(cur) && <Act onClick={() => A.setDecision(cur, true)}>결정 업무로 쓰기</Act>}
      </div>
      {!cur.decision && !launch && !cur.parentId && !isDone(cur) && <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>방법이 아직 안 정해졌으면 '결정 업무로 쓰기' → 안 A · B · C를 가지로 두고 비교해 정해요.</div>}
    </Card>
    : <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>{selPh ? (launch ? (LAUNCH_PHASES.find((x) => "ph:" + x.k === sel) || {}).name : selPh.phase.name) : road ? "업무 추가" : "가지 추가"}</div>
      {road ? (selPh && !selPh.phase.k ? <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>단계를 정하면 그 단계 가지로 옮겨져요 · 업무를 열어 [더 하기 ▾] › [단계 바꾸기]</div> : <>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addTop(); }} placeholder={selPh ? `+ ${selPh.phase.name}에 업무` : "+ 업무 (단계 가지 아래로)"} aria-label={selPh ? `${selPh.phase.name} 단계에 업무 추가` : "마인드맵 업무 추가"} style={{ ...inp, flex: "1 1 160px", minWidth: 0, padding: "8px 10px", fontSize: 13.5 }} />
          {!selPh && <select aria-label="넣을 단계" value={addK} onChange={(e) => setRk(e.target.value)} className="v2-sel">{rStates.map((x) => <option key={x.k} value={x.k}>{x.name}</option>)}</select>}
          <Act onClick={addTop}>추가</Act></div>
        <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>큰 가지 = 프로젝트 단계 · 단계를 누르면 그 단계에 바로 넣어요. 가지 = 업무라 달력·오늘에도 같이 나와요.</div></>)
      : !launch ? <>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addTop(); }} placeholder="+ 큰 가지 (업무) 예: 생산 방안 정하기" aria-label="큰 가지 추가" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
          <Act onClick={addTop}>추가</Act></div>
        {lastTop && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, marginTop: 8 }}><input type="checkbox" checked={after} onChange={(e) => setAfter(e.target.checked)} />'{lastTop.title}' 다음 순서로 (그 일이 끝나면 차례)</label>}
        <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>가지를 누르면 그 업무를 늘리거나 열 수 있어요. 가지 = 업무라 달력·오늘에도 같이 나와요.</div>
      </> : <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>신제품은 7단계가 큰 가지예요. 항목을 누르면 열거나 다음 단계를 붙일 수 있어요.</div>}
    </Card>;
  return <>
    <Legend />
    <div className="mm-grid">
      <div className="mm-map" role="tree" aria-label={`${p.title} 마인드맵`}>
        <button type="button" className={"mm-n root" + (sel === "root" ? " sel" : "")} onClick={() => setSel("root")}><span className="mm-t">{p.title}</span><span className="mm-s">{[nameOf(D.users, p.assigneeId) ? "책임 " + nameOf(D.users, p.assigneeId) : "", (p.launchDate || p.dueDate) ? (launch ? "출시 " : "마감 ") + md(p.launchDate || p.dueDate) : "", E.has ? `예상 ${E.total}일` : ""].filter(Boolean).join(" · ")}</span></button>
        {branches.length === 0 ? <div className="mm-branches"><div className="mm-b"><div className="mm-empty">아직 가지가 없어요 · 오른쪽(폰은 아래)에서 큰 가지를 넣어 주세요</div></div></div>
        : <div className="mm-branches">{branches.map((b, i) => <div key={b.id} className="mm-b">
            {launch ? <button type="button" className={`mm-n ${b.phase.state === "done" ? "done" : b.phase.state === "late" ? "late" : b.phase.state === "cur" ? "doing" : "wait"}` + (sel === b.id ? " sel" : "")} onClick={() => { setSel(b.id); setMore({ ...more, ["open" + b.id]: !more["open" + b.id] }); }}>
                <span className="mm-t"><i className="mm-num">{i + 1}</i>{PH_SHORT[b.phase.k] || b.phase.name}</span><span className="mm-s">{b.phase.state === "done" ? "다 끝남" : `남은 ${b.phase.left} / ${b.phase.total}`}{spanL(E, b.phase.k) ? ` · ${spanL(E, b.phase.k)}` : ""} · {more["open" + b.id] || b.phase.state === "cur" || b.phase.state === "late" ? "접기 ▴" : "펼치기 ▾"}</span></button>
              : b.phase ? <button type="button" className={`mm-n ${PH_CLS[b.phase.state] || ""}` + (sel === b.id ? " sel" : "")} onClick={() => { setSel(b.id); setMore({ ...more, ["fold" + b.id]: !more["fold" + b.id] }); }}>
                <span className="mm-t">{b.phase.k ? <i className="mm-num">{i + 1}</i> : null}{b.phase.name}</span><span className="mm-s">{phSub(b.phase)}{spanL(E, b.phase.k) ? ` · ${spanL(E, b.phase.k)}` : ""}{b.kids.length ? ` · ${more["fold" + b.id] ? "펼치기 ▾" : "접기 ▴"}` : ""}</span></button>
              : <Node t={b.t} num={i + 1} />}
            {(launch ? more["open" + b.id] || b.phase.state === "cur" || b.phase.state === "late" : !b.phase || !more["fold" + b.id]) && <KidList b={b} />}
          </div>)}</div>}
      </div>
      <div className="mm-side">{panel}</div>
    </div>
  </>;
}

// ── 오른쪽으로 뻗는 마인드맵 (시안 step11 · 사용자 확정 2026-10-05~06) ──
// 왼쪽 프로젝트 → 큰 가지(앞 일 순서 번호 · 신제품 = 7단계) → 작은 가지(하위 업무) · 곡선 연결
// 가지를 누르면 그 업무 시트 · 오른쪽 작은 칸(‹ / +n)을 누르면 접기·펼치기 · 9개 이상은 8개 + '+n개 더'
// 칸 안에서만 밀림(옆·아래 · PC 는 끌어서) · [화면에 맞추기] · [그림으로 저장] PNG · 쓰기 없음
export const NST = {
  "": { fill: "#FFFFFF", stroke: "#D5DBE8", sw: 1.5, t: "#1B2333", s: "#5B6475" },
  done: { fill: "#E7ECF7", stroke: "#E7ECF7", sw: 1.5, t: "#24386B", s: "#5B6475" },
  doing: { fill: "#FFFFFF", stroke: "#24386B", sw: 2.2, t: "#1B2333", s: "#5B6475" },
  wait: { fill: "#FFFFFF", stroke: "#B7BFD0", sw: 1.5, dash: "5 4", t: "#5B6475", s: "#8A92A3" },
  hold: { fill: "#F4F5F8", stroke: "#D5D9E2", sw: 1.5, t: "#8A92A3", s: "#8A92A3" },
  late: { fill: "#FFFFFF", stroke: "#B4383F", sw: 2.2, t: "#1B2333", s: "#B4383F" },
};
const phState = (ph) => (ph.state === "done" ? "done" : ph.state === "late" ? "late" : ph.state === "cur" ? "doing" : ph.state === "none" ? "" : "wait");

// 나무 만들기 (이미 불러온 업무만 · 저장 없음)
export function mindTree({ D, p, idx, launch, key }) {
  const all = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const byId = new Map(all.map((t) => [t.id, t]));
  const kidsBy = new Map(); all.forEach((t) => { if (t.parentId && byId.has(t.parentId)) { if (!kidsBy.has(t.parentId)) kidsBy.set(t.parentId, []); kidsBy.get(t.parentId).push(t); } });
  const isTop = (t) => !t.parentId || !byId.has(t.parentId);
  const tnode = (t, seen, num) => { if (seen.has(t.id)) return null; const s2 = new Set(seen).add(t.id);
    const ks = orderTasks(kidsBy.get(t.id) || [], idx).map((k) => tnode(k, s2)).filter(Boolean);
    return { id: t.id, kind: "task", t, num, st: nodeState(t, idx, key), kids: ks }; };
  const road = launch ? null : roadOf(p, D);
  const kids = launch
    ? phaseStates(all.filter((t) => t.launchItem), key).map((ph, i) => ({ ph, i, ts: orderTasks(all.filter((t) => t.phase === ph.k && isTop(t)), idx) })).filter((x) => x.ts.length)
      .map((x, j) => ({ id: "ph:" + x.ph.k, kind: "phase", ph: x.ph, num: j + 1, st: phState(x.ph), kids: x.ts.map((t) => tnode(t, new Set())).filter(Boolean) }))
    : road ? roadBranches(road, all, (t) => phaseOfTask(t, p, D, byId, road), isTop, idx, key).map((b, j) => ({ id: b.id, kind: "phase", ph: b.phase, num: b.phase.k ? j + 1 : null, st: phState(b.phase), kids: b.kids.map((t) => tnode(t, new Set())).filter(Boolean) }))
    : orderTasks(all.filter(isTop), idx).map((t, i) => tnode(t, new Set(), i + 1)).filter(Boolean);
  return { id: "root", kind: "root", kids, count: all.length };
}
const nodeDone = (n) => (n.kind === "phase" ? n.ph.state === "done" : n.kind === "task" ? isDone(n.t) : false);

// tpl: 견본 보기(읽기만 · 2026-10-07 ②) = {tree, rootSub, subOf} — 상태 모양·진척 칸·가지 넣기 없음 · 업무 가지를 눌러도 아무것도 안 열림
function RightMap({ D, cu, A, open, p, idx, launch, tpl }) {
  const key = ymd(new Date());
  const E = useMemo(() => (tpl ? null : projEstimate(p, D, key)), [p, D, key, tpl]);
  const tree = useMemo(() => (tpl ? tpl.tree : mindTree({ D, p, idx, launch, key })), [D, p, idx, launch, key, tpl]);
  // 접기: 기본 = 신제품의 다 끝난 단계만 접음 · 사람이 누른 것은 fold[id] 로 · 모두 펼치기 = all
  const [fold, setFold] = useState({}), [more, setMore] = useState({}), [all, setAll] = useState(false), [fit, setFit] = useState(false);
  const isFold = (n) => (fold[n.id] != null ? fold[n.id] : !all && n.kind === "phase" && n.ph.state === "done");
  const vt = visibleTree(tree, isFold, (n) => all || !!more[n.id]);
  const maxH = typeof window !== "undefined" ? Math.min(Math.round(window.innerHeight * 0.7), 760) : 600;
  const L = layoutTree(vt, { rootMax: Math.max(120, Math.round(maxH / 2) - 20) });
  const box = useRef(null), svgRef = useRef(null), drag = useRef(null);
  const [bw, setBw] = useState(0);
  useEffect(() => { const m = () => box.current && setBw(box.current.clientWidth); m(); window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }, []);
  const sc = fit && bw ? Math.min(1, (bw - 4) / L.W, (maxH - 4) / L.H) : 1;
  const toggle = (n) => setFold({ ...fold, [n.id]: !isFold(n) });
  const foldDone = () => { const f = {}; const walk = (n) => { (n.kids || []).forEach((k) => { if ((k.kids || []).length) f[k.id] = nodeDone(k); walk(k); }); }; walk(tree); setAll(false); setMore({}); setFold(f); };
  const openAll = () => { setAll(true); setFold({}); };
  const tap = (n) => { if (n.kind === "task") { if (!tpl) open({ type: "task", id: n.t.id }); } else if (n.kind === "phase") toggle(n); else if (n.kind === "more") setMore({ ...more, [n.parentId]: true }); };
  const save = () => (tpl ? savePng(svgRef.current, `견본 마인드맵 · ${p.title} · ${key} 기준`, `견본_${fileSafe(p.title, "견본")}_${key}.png`) : savePng(svgRef.current, `마인드맵 · ${p.title} · ${key} 기준`, `마인드맵_${fileSafe(p.title, "프로젝트")}_${key}.png`));
  // PC 마우스로 끌어서 밀기 (손가락은 원래 밀림) · 끌었으면 누름으로 안 침
  const onDown = (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; const b = box.current; drag.current = { x: e.clientX, y: e.clientY, l: b.scrollLeft, t: b.scrollTop, moved: false }; };
  const onMove = (e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return; d.moved = true; box.current.scrollLeft = d.l - dx; box.current.scrollTop = d.t - dy; };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && d.moved) { box.current.__moved = true; setTimeout(() => { if (box.current) box.current.__moved = false; }, 0); } };
  const onClickCap = (e) => { if (box.current && box.current.__moved) { e.stopPropagation(); e.preventDefault(); } };

  // 뿌리 칸이 좁아서(176) 예상 소요가 있으면 날짜 → 예상 → 책임 순 (책임은 머리에도 있음)
  const leadL = nameOf(D.users, p.assigneeId) ? "책임 " + nameOf(D.users, p.assigneeId) : "", dateL = (p.launchDate || p.dueDate) ? (launch ? "출시 " : "마감 ") + md(p.launchDate || p.dueDate) : "";
  const rootSub = tpl ? tpl.rootSub : (E && E.has ? [dateL, `예상 ${E.total}일`, leadL] : [leadL, dateL]).filter(Boolean).join(" · ");
  const subOf = (n) => { if (tpl) return tpl.subOf(n); if (n.kind === "phase") return [phSub(n.ph), spanL(E, n.ph.k)].filter(Boolean).join(" · ");
    const t = n.t, d = dueOf(t), r = riskOf(t, key);
    const tag = t.decision ? (t.decided ? "정함 → " + t.decided.title : "결정 대기") : t.option && t.optDropped ? "보류" : "";
    return [isDone(t) ? "✓" + (d ? " " + md(d) : "") : "", who(D, t), !isDone(t) && d ? md(d) + (r && r.red ? " · " + r.label : "") : "", estL(t), tag].filter(Boolean).join(" · "); };
  const titleOf = (n) => (n.kind === "phase" ? (launch ? PH_SHORT[n.ph.k] : "") || n.ph.name : n.t.title);
  const pill = (n) => { const ks = n.kids || []; if (!ks.length || tpl) return ""; if (n.kind === "phase") return `${n.ph.total - n.ph.left}/${n.ph.total}`; return `${ks.filter(nodeDone).length}/${ks.length}`; };
  const lateTo = (n) => n.st === "late";
  const kb = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  return <>
    {!tpl && <Legend />}
    <div className="mm-rmap">
      <div ref={box} className={"mm-rbox" + (fit ? " fit" : "")} style={{ maxHeight: maxH }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClickCapture={onClickCap}>
        <svg ref={svgRef} viewBox={`0 0 ${L.W} ${L.H}`} width={Math.round(L.W * sc)} height={Math.round(L.H * sc)} className="mm-svg" role="group" aria-label={`${p.title} 마인드맵 (오른쪽으로 뻗는 보기)`} xmlns="http://www.w3.org/2000/svg" fontFamily={SVG_FONT}>
          <rect x="0" y="0" width={L.W} height={L.H} fill="#FFFFFF" />
          {L.edges.map(({ from: a, to: b }) => { const hasT = a.kind !== "root" && a.total > 0, x1 = a.x + a.w + (hasT ? 30 : 0);
            return <path key={a.id + ">" + b.id} d={curve(x1, a.y + a.h / 2, b.x, b.y + b.h / 2)} fill="none" stroke={lateTo(b) ? "#D89A9E" : a.kind === "root" ? "#9AA6C4" : "#C3CBDD"} strokeWidth={a.kind === "root" ? 1.7 : 1.4} />; })}
          {L.nodes.map((n) => {
            if (n.kind === "root") return <g key="root" className="mm-node root" aria-label={`프로젝트 ${p.title}`}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="12" fill="#0F1F5C" />
              <text x={n.x + 12} y={n.y + 19} fontSize="13.5" fontWeight="800" fill="#FFFFFF">{clip(p.title, 13.5, n.w - 22)}</text>
              <text x={n.x + 12} y={n.y + 36} fontSize="11" fontWeight="700" fill="#C9D3F2">{clip(rootSub || `업무 ${tree.count}`, 11, n.w - 22)}</text>
            </g>;
            if (n.kind === "more") return <g key={n.id} role="button" tabIndex={0} className="mm-node more" aria-label={`${n.n}개 더 보기`} onClick={() => tap(n)} onKeyDown={kb(() => tap(n))}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" fill="#EEF1F8" stroke="#D5DBE8" strokeWidth="1.2" />
              <text x={n.x + 12} y={n.y + 22} fontSize="12.5" fontWeight="800" fill="#24386B">+{n.n}개 더 ▾</text>
            </g>;
            const S = NST[n.st] || NST[""], pl = pill(n), pw = pl ? textW(pl, 11) + 12 : 0, nw = n.num != null ? 22 : 0;
            const title = titleOf(n), sub = subOf(n);
            return <g key={n.id} data-id={n.id}>
              <g role="button" tabIndex={0} className="mm-node" aria-label={`${n.num != null ? n.num + " " : ""}${title}${sub ? " · " + sub : ""}`} onClick={() => tap(n)} onKeyDown={kb(() => tap(n))}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="11" fill={S.fill} stroke={S.stroke} strokeWidth={S.sw} strokeDasharray={S.dash || undefined} />
                {n.num != null && <><circle cx={n.x + 19} cy={n.y + 15} r="8.5" fill="#24386B" /><text x={n.x + 19} y={n.y + 19} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#FFFFFF">{n.num}</text></>}
                <text x={n.x + 11 + nw} y={n.y + 19} fontSize="13" fontWeight="800" fill={S.t}>{clip(title, 13, n.w - 22 - nw - (pw ? pw + 6 : 0))}</text>
                {pl && <><rect x={n.x + n.w - pw - 8} y={n.y + 7} width={pw} height="17" rx="8.5" fill={n.st === "done" ? "#FFFFFF" : "#EEF1F8"} /><text x={n.x + n.w - 8 - pw / 2} y={n.y + 19.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#24386B">{pl}</text></>}
                <text x={n.x + 11} y={n.y + 36} fontSize="11" fill={S.s}>{clip(sub, 11, n.w - 22)}</text>
              </g>
              {n.total > 0 && <g role="button" tabIndex={0} className="mm-node tog" aria-label={`${title} ${n.folded ? "펼치기" : "접기"}`} aria-expanded={!n.folded} onClick={() => toggle(n)} onKeyDown={kb(() => toggle(n))}>
                <rect x={n.x + n.w + 4} y={n.y + n.h / 2 - 11} width="26" height="22" rx="11" fill={n.folded ? "#24386B" : "#FFFFFF"} stroke="#C3CBDD" strokeWidth="1.2" />
                <text x={n.x + n.w + 17} y={n.y + n.h / 2 + 4} textAnchor="middle" fontSize={n.folded ? 10.5 : 12} fontWeight="800" fill={n.folded ? "#FFFFFF" : "#24386B"}>{n.folded ? "+" + n.total : "‹"}</text>
              </g>}
            </g>; })}
        </svg>
      </div>
      {!tree.kids.length && <div className="mm-empty" style={{ padding: "8px 12px" }}>아직 가지가 없어요{launch || tpl ? "" : " · 아래에서 큰 가지를 넣어 주세요"}</div>}
      <div className="mm-foot">
        <TBtn onClick={() => setFit(!fit)}>{fit ? "원래 크기" : "화면에 맞추기"}</TBtn>
        <TBtn onClick={openAll}>모두 펼치기</TBtn>
        <TBtn onClick={foldDone}>끝낸 것 접기</TBtn>
        <TBtn onClick={save}>그림으로 저장</TBtn>
      </div>
    </div>
    <div className="mm-hint">{tpl ? "견본 마인드맵 · 단계 → 업무(예상 소요일) · 오른쪽 작은 칸(‹ · +n)을 누르면 접기·펼치기 · 고치기는 [목록]에서" : "가지를 누르면 그 업무 · 오른쪽 작은 칸(‹ · +n)을 누르면 접기·펼치기 · 그림은 이 칸 안에서 옆으로 밀어서 봐요"}</div>
    {!launch && !tpl && <AddBranch D={D} cu={cu} A={A} p={p} idx={idx} />}
  </>;
}

// 큰 가지 넣기 (마인드맵 보기 아래 · 계층 보기의 '가지 추가'와 같은 쓰기)
function AddBranch({ D, cu, A, p, idx }) {
  const [nt, setNt] = useState(""), [after, setAfter] = useState(true), [rk, setRk] = useState(null);
  const all = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), ids = new Set(all.map((t) => t.id));
  const tops = orderTasks(all.filter((t) => !t.parentId || !ids.has(t.parentId)), idx);
  const lastTop = tops.filter((t) => !isDone(t)).slice(-1)[0] || tops.slice(-1)[0];
  // 로드(일반·흐름): 큰 가지 = 단계 → 넣을 단계 고르기(기본 = 지금 단계)
  const road = roadOf(p, D), byId = new Map(all.map((t) => [t.id, t])), rs = road ? roadStates(road, all, (t) => phaseOfTask(t, p, D, byId, road), ymd(new Date())) : [], addK = rk != null ? rk : curStage(rs);
  const add = () => { if (!nt.trim()) return; A.addTask({ title: nt, projectId: p.id, assigneeId: cu.id, dueDate: "", noReview: true, ...(road ? (addK ? { phase: addK } : {}) : after && lastTop ? { deps: [lastTop.id] } : {}) }); setNt(""); };
  if (road) return <Card style={{ padding: "12px 14px", marginTop: 10 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} placeholder="+ 업무 (단계 가지 아래로)" aria-label="마인드맵 업무 추가" style={{ ...inp, flex: "1 1 160px", minWidth: 0, padding: "8px 10px", fontSize: 13.5 }} />
      <select aria-label="넣을 단계" value={addK} onChange={(e) => setRk(e.target.value)} className="v2-sel">{rs.map((x) => <option key={x.k} value={x.k}>{x.name}</option>)}</select>
      <Act onClick={add}>추가</Act></div>
  </Card>;
  return <Card style={{ padding: "12px 14px", marginTop: 10 }}>
    <div style={{ display: "flex", gap: 6 }}>
      <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} placeholder="+ 큰 가지 (업무) 예: 생산 방안 정하기" aria-label="큰 가지 추가" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
      <Act onClick={add}>추가</Act></div>
    {lastTop && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, marginTop: 8 }}><input type="checkbox" checked={after} onChange={(e) => setAfter(e.target.checked)} />'{lastTop.title}' 다음 순서로 (그 일이 끝나면 차례)</label>}
  </Card>;
}

// 견본 마인드맵 (견본 한 장 [마인드맵] · 읽기만): 견본 → 단계(업무 n개 · 걸리는 평일) → 업무(n일 · 담당) → 하위 업무
export function TplMap({ D, tpl, E }) {
  const road = tplRoad(tpl), live = tplLive(tpl), ks = new Set(live.map((x) => x.key)), noL = tplKind(tpl) === "launch" ? "기타" : "단계 미정";
  const esOf = (x) => ((E.node.get(x.key) || {}).es || 0), ord = new Map(live.map((x, i) => [x.key, i])), sortT = (a) => a.slice().sort((x, y) => esOf(x) - esOf(y) || ord.get(x.key) - ord.get(y.key));
  const tnode = (x, seen) => { if (seen.has(x.key)) return null; const s2 = new Set(seen).add(x.key);
    return { id: "k:" + x.key, kind: "task", t: { id: x.key, title: x.title, x }, st: "", kids: live.filter((k) => k.parentKey === x.key).map((k) => tnode(k, s2)).filter(Boolean) }; };
  const tops = live.filter((x) => !x.parentKey || !ks.has(x.parentKey));
  const ph = (k, name, num, a) => ({ id: "ph:" + k, kind: "phase", ph: { k, name, state: "todo", left: a.length, total: a.length }, num, st: "", kids: sortT(a).map((x) => tnode(x, new Set())).filter(Boolean) });
  const kids = road.map((s, i) => ph(s.k, s.name, i + 1, tops.filter((x) => x.phase === s.k)));
  const un = tops.filter((x) => !road.some((s) => s.k === x.phase)); if (un.length) kids.push(ph("", noL, null, un));
  const tree = { id: "root", kind: "root", kids, count: live.length };
  const subOf = (n) => { if (n.kind === "phase") { const sp = n.ph.k && E.stage.get(n.ph.k); return n.ph.total ? `업무 ${n.ph.total}개${sp && sp.span ? ` · ${sp.span}일` : ""}` : "비어 있어요"; }
    const x = n.t.x; return [estOf(x) ? `${estOf(x)}일` : "소요일 미정", tpl.withOwners && x.assigneeId ? nameOf(D.users, x.assigneeId) : ""].filter(Boolean).join(" · "); };
  const rootSub = [`업무 ${live.length}개`, E.has ? `예상 ${E.total}일` : "예상 소요 미정"].join(" · ");
  return <div className="mm-wrap"><RightMap D={D} p={{ id: "tpl:" + tpl.id, title: tpl.title || "견본" }} launch={false} tpl={{ tree, rootSub, subOf }} /></div>;
}
