// 업무OS v2 — 프로젝트 마인드맵 · 결정 업무
// 가지 = 업무, 작은 가지 = 하위 업무 (목록·달력·오늘과 같은 데이터, 따로 저장하는 것 없음)
// 큰 가지 번호 = 앞 일 순서(deps·흐름 단계·기한). 신제품은 7단계가 큰 가지
// 결정 업무(decision): 하위 업무(option)를 '안'으로 비교 → [이 안으로 정하기] → 정한 안·이유·날짜 기록, 안 고른 안은 보류(지우지 않음), 결정 업무는 끝냄
// 끌어서 순서 바꾸기는 하지 않음(실수 방지) — 순서는 업무 보기 [앞 일 바꾸기]로
import { useState } from "react";
import { ymd, md, ddays, ddayLabel, nameOf, isDone, isMine, ownersOf, dueOf, riskOf, isMaster, addDays, nextWorkday } from "./model.js";
import { LAUNCH_PHASES } from "./launch.js";
import { turnOf, predsOf } from "./turn.js";
import { phaseStates } from "./views.js";
import { C, Act, TBtn, Card, Empty, inp } from "./ui.jsx";

const PH_SHORT = { plan: "기획", sample: "샘플", pack: "패킹", content: "콘텐츠", channel: "채널 등록", stock: "창고 입고", promo: "출시 홍보" };
const who = (D, t) => nameOf(D.users, ownersOf(t)[0]) || t.ownerText || "담당 없음";
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

// 마인드맵 (프로젝트 한 장의 탭)
export function MindMap({ D, cu, A, open, p, idx, launch }) {
  const key = ymd(new Date());
  const [sel, setSel0] = useState("root"), [more, setMore] = useState({}), [nt, setNt] = useState(""), [after, setAfter] = useState(true), [kt, setKt] = useState("");
  // 가지를 누르면 요약 칸으로 (세로형일 때 요약이 지도 아래에 있어서)
  const setSel = (id) => { setSel0(id); setTimeout(() => { const side = document.querySelector(".mm-side"), map = document.querySelector(".mm-map"); if (side && map && side.getBoundingClientRect().top > map.getBoundingClientRect().bottom - 2) side.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 30); };
  const all = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const byId = new Map(all.map((t) => [t.id, t]));
  const kidsOf = (id) => orderTasks(all.filter((t) => t.parentId === id), idx);
  const tops = orderTasks(all.filter((t) => !t.parentId || !byId.has(t.parentId)), idx);
  // 큰 가지: 일반 = 맨 위 업무 / 신제품 = 7단계 (단계 아래 항목)
  const branches = launch
    ? phaseStates(all.filter((t) => t.launchItem), key).map((ph) => ({ id: "ph:" + ph.k, phase: ph, kids: orderTasks(all.filter((t) => t.phase === ph.k && (!t.parentId || !byId.has(t.parentId))), idx) })).filter((b) => b.kids.length)
    : tops.map((t) => ({ id: t.id, t, kids: kidsOf(t.id) }));
  const cur = sel === "root" || sel.startsWith("ph:") ? null : byId.get(sel);
  const lastTop = tops.filter((t) => !isDone(t)).slice(-1)[0] || tops.slice(-1)[0];
  const addTop = () => { if (!nt.trim()) return; A.addTask({ title: nt, projectId: p.id, assigneeId: cu.id, dueDate: "", noReview: true, ...(after && lastTop ? { deps: [lastTop.id] } : {}) }); setNt(""); };
  const addKid = (t) => { if (!kt.trim()) return; A.addTask({ title: kt, parentId: t.id, projectId: p.id, assigneeId: ownersOf(t)[0] || cu.id, dueDate: dueOf(t) || "", noReview: true, ...(t.decision ? { extra: { option: true } } : {}) }); setKt(""); };
  const Node = ({ t, num, cls = "" }) => { const st = nodeState(t, idx, key), r = riskOf(t, key), d = dueOf(t), kids = all.filter((x) => x.parentId === t.id).length;
    const tag = t.decision ? (t.decided ? "정함" : "결정 대기") : t.option && t.optDropped ? "보류" : null;
    return <button type="button" className={`mm-n ${st} ${cls}` + (sel === t.id ? " sel" : "")} onClick={() => setSel(t.id)} aria-pressed={sel === t.id}>
      <span className="mm-t">{num != null && <i className="mm-num">{num}</i>}{tag && <i className="mm-tag">{tag}</i>}{t.title}</span>
      <span className="mm-s">{[who(D, t), d ? md(d) + (isDone(t) ? "" : r && r.red ? " · " + r.label : "") : "", t.option && t.optInfo ? t.optInfo : "", t.decided ? "→ " + t.decided.title : "", !launch && kids && !t.decision ? `하위 ${kids}` : ""].filter(Boolean).join(" · ")}</span>
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
        {!isDone(cur) && <Act onClick={() => open({ type: "add", preset: { projectId: p.id, deps: [cur.id], dueDate: nextWorkday(addDays(dueOf(cur) && dueOf(cur) > key ? dueOf(cur) : key, 1)) } })}>+ 다음 단계</Act>}
        {!launch && !cur.parentId && !cur.decision && !isDone(cur) && <Act onClick={() => A.setDecision(cur, true)}>결정 업무로 쓰기</Act>}
      </div>
      {!cur.decision && !launch && !cur.parentId && !isDone(cur) && <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>방법이 아직 안 정해졌으면 '결정 업무로 쓰기' → 안 A · B · C를 가지로 두고 비교해 정해요.</div>}
    </Card>
    : <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>{sel.startsWith("ph:") ? (LAUNCH_PHASES.find((x) => "ph:" + x.k === sel) || {}).name : "가지 추가"}</div>
      {!launch ? <>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addTop(); }} placeholder="+ 큰 가지 (업무) 예: 생산 방안 정하기" aria-label="큰 가지 추가" style={{ ...inp, padding: "8px 10px", fontSize: 13.5 }} />
          <Act onClick={addTop}>추가</Act></div>
        {lastTop && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, marginTop: 8 }}><input type="checkbox" checked={after} onChange={(e) => setAfter(e.target.checked)} />'{lastTop.title}' 다음 순서로 (그 일이 끝나면 차례)</label>}
        <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>가지를 누르면 그 업무를 늘리거나 열 수 있어요. 가지 = 업무라 달력·오늘에도 같이 나와요.</div>
      </> : <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>신제품은 7단계가 큰 가지예요. 항목을 누르면 열거나 다음 단계를 붙일 수 있어요.</div>}
    </Card>;
  return <div className="mm-wrap">
    <div className="mm-legend"><span><i className="done" />끝남</span><span><i className="doing" />하는 중</span><span><i className="wait" />앞 일 기다림</span><span><i className="hold" />보류</span><span><i className="late" />지남·막힘</span></div>
    <div className="mm-grid">
      <div className="mm-map" role="tree" aria-label={`${p.title} 마인드맵`}>
        <button type="button" className={"mm-n root" + (sel === "root" ? " sel" : "")} onClick={() => setSel("root")}><span className="mm-t">{p.title}</span><span className="mm-s">{[nameOf(D.users, p.assigneeId) ? "책임 " + nameOf(D.users, p.assigneeId) : "", (p.launchDate || p.dueDate) ? (launch ? "출시 " : "마감 ") + md(p.launchDate || p.dueDate) : ""].filter(Boolean).join(" · ")}</span></button>
        {branches.length === 0 ? <div className="mm-branches"><div className="mm-b"><div className="mm-empty">아직 가지가 없어요 · 오른쪽(폰은 아래)에서 큰 가지를 넣어 주세요</div></div></div>
        : <div className="mm-branches">{branches.map((b, i) => <div key={b.id} className="mm-b">
            {launch ? <button type="button" className={`mm-n ${b.phase.state === "done" ? "done" : b.phase.state === "late" ? "late" : b.phase.state === "cur" ? "doing" : "wait"}` + (sel === b.id ? " sel" : "")} onClick={() => { setSel(b.id); setMore({ ...more, ["open" + b.id]: !more["open" + b.id] }); }}>
                <span className="mm-t"><i className="mm-num">{i + 1}</i>{PH_SHORT[b.phase.k] || b.phase.name}</span><span className="mm-s">{b.phase.state === "done" ? "다 끝남" : `남은 ${b.phase.left} / ${b.phase.total}`} · {more["open" + b.id] || b.phase.state === "cur" || b.phase.state === "late" ? "접기 ▴" : "펼치기 ▾"}</span></button>
              : <Node t={b.t} num={i + 1} />}
            {(!launch || more["open" + b.id] || b.phase.state === "cur" || b.phase.state === "late") && <KidList b={b} />}
          </div>)}</div>}
      </div>
      <div className="mm-side">{panel}</div>
    </div>
  </div>;
}
