// 관리자 · 정리 — 쌓인 것을 지우지 않고 한 번에 치우기
// 묶음 목록(숫자 큰 순) → 묶음 안: 사람별·제품별 고르기(PickList) → 아래 막대(BulkBar)로 담당·기한·보류·날짜 없이 두기·담당에게 묻기
// 안전장치(pick.jsx · core.jsx bulk): 한 번에 100건 · 미리 보기 문장 · 30건 이상 확인 창 · 5초 되돌리기 · 기록(이전 값) · 삭제 없음
import { useMemo, useState } from "react";
import { ymd, md, ddays, nameOf, ownersOf, dueOf, isDone, taskNoteId, projOpen } from "../model.js";
import { groupItems } from "../views.js";
import { orderIssues, predLine } from "../turn.js";
import { PickList } from "../pick.jsx";
import { C, Act, Seg, TBtn, Head, Card, Row, Empty, Sheet, Ask } from "../ui.jsx";
import { adminQueues, SelBar, BulkPad, isLaunchP, LineBtn } from "./common.jsx";

const NAVY_BTN = { background: C.navy, color: "#fff", borderColor: C.navy };
const EMPTY_L = { blocked: "막힘", late: "기한 지난 일", order: "순서 꼬임", req: "요청", temp: "임시 담당", noDue: "기한 없음", dueReq: "기한 조정 요청" };   // 비어서 목록에 없는 묶음 이름

export function TidyTab({ D, cu, A, idx, open, tq, setTq, setToast }) {
  const now = new Date(), key = ymd(now);
  const Q = useMemo(() => adminQueues(D, idx, now), [D, idx]);
  const cur = tq ? Q.byK[tq] || { k: tq, label: EMPTY_L[tq] || "", by: "person", items: [] } : null;
  const list = <div className="a-qlist">
    <Head>정리할 묶음 {Q.all.length}</Head>
    {Q.all.length === 0 ? <Card><Empty>정리할 것이 없어요</Empty></Card>
      : <Card>{Q.all.map((q, i) => <button key={q.k} type="button" className={"a-q" + (tq === q.k ? " on" : "")} onClick={() => { setTq(q.k); window.scrollTo(0, 0); }} style={{ borderBottom: i < Q.all.length - 1 ? `1px solid ${C.line}` : "none" }} aria-current={tq === q.k ? "true" : undefined}>
        <span className="lb">{q.label}</span><b style={{ color: (q.k === "blocked" || q.k === "late" || q.k === "old") ? C.red : C.ink }}>{q.items.length}</b><span className="a-go">›</span></button>)}</Card>}
    <p className="a-hint">지우는 기능은 없어요. 담당·기한을 바꾸거나 보류·날짜 없이 두기로 치워요. 바꾸기 전 값은 기록에 남고 5초 안에 되돌릴 수 있어요.</p>
  </div>;
  return <div className={"a-tidy" + (cur ? " open" : "")}>
    {list}
    <div className="a-qbody">{cur ? <Queue key={cur.k} q={cur} D={D} cu={cu} A={A} idx={idx} open={open} setToast={setToast} back={() => setTq("")} keyd={key} />
      : <Card style={{ marginTop: 18 }} ><Empty>왼쪽에서 묶음을 고르세요</Empty></Card>}</div>
  </div>;
}

function Queue({ q, D, cu, A, idx, open, setToast, back, keyd }) {
  const ym = keyd.slice(0, 7);
  const [by, setBy] = useState(q.k === "noDue" ? "mix" : q.by), [sel, setSel] = useState(() => new Set());
  // 기한 없음: 출시일 미정 신제품을 먼저 (출시일을 정하면 항목 기한이 한 번에 채워짐), 그다음 사람별
  const undated = q.k === "noDue" ? D.projects.filter((p) => isLaunchP(p) && projOpen(p) && !p.launchDate).map((p) => ({ p, n: q.items.filter((t) => t.projectId === p.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n) : [];
  const undSet = new Set(undated.map((x) => x.p.id));
  const dr = q.k === "req" ? q.items.filter((t) => t.dueReq) : [];
  const items = q.k === "req" ? q.items.filter((t) => !t.dueReq) : q.items;
  const groups = by === "mix" ? [...groupItems(items.filter((t) => undSet.has(t.projectId)), "project", D), ...groupItems(items.filter((t) => !undSet.has(t.projectId)), "person", D)]
    : groupItems(items, by, D);
  return <>
    <div className="a-qhead">
      <TBtn onClick={back} className="a-qback" style={{ paddingLeft: 0 }}>‹ 묶음 목록</TBtn>
      <h2>{q.label || "묶음"} <span>{q.items.length}</span></h2>
    </div>
    {q.k === "dueReq" ? <DueReqList items={q.items} D={D} cu={cu} A={A} open={open} />
      : <>
        {q.k === "order" && <LineBtn onClick={() => open({ type: "order" })} label="순서 꼬임 자세히 보기">순서 꼬임 자세히 보기 · 앞 일 담당에게 묻기</LineBtn>}
        {undated.length > 0 && <UndatedLaunch list={undated} A={A} />}
        {dr.length > 0 && <><Head>기한 조정 요청 {dr.length}</Head><DueReqList items={dr} D={D} cu={cu} A={A} open={open} /></>}
        {dr.length > 0 && items.length > 0 && <Head>확인 3일 넘음 · 7일 넘게 안 받음 {items.length}</Head>}
        {items.length > 0 && <div style={{ marginTop: 12, maxWidth: 360 }}><Seg items={[...(q.k === "noDue" ? [["mix", "제품 먼저"]] : []), ["person", "사람별"], ["project", "제품별"]]} value={by} onChange={setBy} /></div>}
        {q.items.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>이 묶음은 비었어요</Empty></Card> : items.length === 0 ? null
          : <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} />}
        {q.k === "noDue" && <p className="a-hint">'날짜 없이 두기'를 고르면 이번 달({+ym.slice(5)}월)에는 다시 묻지 않아요.</p>}
      </>}
    <BulkPad on={sel.size > 0} />
    <SelBar D={D} cu={cu} A={A} sel={sel} setSel={setSel} setToast={setToast} />
  </>;
}

// 출시일 미정 제품: 줄마다 [출시일 정하기] → 출시일에서 거꾸로 항목 기한이 채워짐 (자동 기한만)
function UndatedLaunch({ list, A }) {
  const [d, setD] = useState({}), [busy, setBusy] = useState("");
  return <>
    <Head>출시일 미정 신제품 {list.length} · 항목 {list.reduce((a, x) => a + x.n, 0)}</Head>
    <Card>{list.map((x, i) => <div key={x.p.id} className="a-undated" style={{ borderBottom: i < list.length - 1 ? `1px solid ${C.line}` : "none" }}>
      <div style={{ flex: "1 1 140px", minWidth: 0 }}><b>{x.p.title}</b><div style={{ fontSize: 12.5, color: C.sub }}>출시일 미정 · 항목 {x.n}</div></div>
      <input type="date" className="v2-sel" aria-label={`${x.p.title} 출시일`} value={d[x.p.id] || ""} onChange={(e) => setD({ ...d, [x.p.id]: e.target.value })} />
      <Act onClick={async () => { if (!d[x.p.id]) return; setBusy(x.p.id); await A.setLaunchDate(x.p, d[x.p.id]); setBusy(""); }} style={d[x.p.id] ? NAVY_BTN : { opacity: 0.5 }}>{busy === x.p.id ? "정하는 중" : "출시일 정하기"}</Act>
    </div>)}</Card>
    <p className="a-hint">날짜를 고르고 [출시일 정하기]를 누르면 항목 기한이 출시일에서 거꾸로 채워져요 (주말·공휴일 건너뜀).</p>
  </>;
}

// 기한 조정 요청: 줄마다 [수락]·[그대로] + 맨 위 [모두 수락]
function DueReqList({ items, D, cu, A, open }) {
  const [ask, setAsk] = useState(false);
  const acceptAll = async () => { setAsk(false); const at = new Date().toISOString();
    await A.bulk(items, (t) => ({ dueDate: t.dueReq.date, dueAuto: false, dueReq: null, dueReqResult: { ok: true, date: t.dueReq.date, by: cu.id, byName: cu.name, at } }), "기한 조정 모두 수락"); };
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 2px 8px" }}>
      <span style={{ flex: 1, fontSize: 13.5, color: C.sub }}>담당이 바꿔 달라고 한 기한이에요</span>
      {items.length > 0 && <Act onClick={() => (items.length >= 30 ? setAsk(true) : acceptAll())} style={NAVY_BTN}>모두 수락 {items.length}</Act>}
    </div>
    <Card>{items.length === 0 ? <Empty>기한 조정 요청이 없어요</Empty> : items.map((t, i) => <Row key={t.id} title={t.title}
      sub={`${nameOf(D.users, ownersOf(t)[0]) || "담당 없음"} · ${md(dueOf(t)) || "미정"} → ${md(t.dueReq.date)}${t.dueReq.reason ? " · " + t.dueReq.reason : ""}`}
      onClick={() => open({ type: "task", id: t.id })} last={i === items.length - 1}
      right={<div style={{ display: "flex", gap: 6 }}><Act onClick={() => A.answerDue(t, true)} style={NAVY_BTN}>수락</Act><Act onClick={() => A.answerDue(t, false)}>그대로</Act></div>} />)}</Card>
    {ask && <Ask title={`${items.length}건 모두 수락할까요?`} body={"요청한 날짜로 기한을 바꿔요.\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요."} yes="모두 수락" onNo={() => setAsk(false)} onYes={acceptAll} />}
  </>;
}

// 순서 꼬임 자세히 (가)(나)(다)(라) — 줄마다 [담당에게 묻기] (앞 일 담당에게 댓글)
const ORDER_L = [
  ["a", "(가) 앞 일이 뒤 일보다 늦게 끝날 예정"],
  ["b", "(나) 앞 일이 늦어 뒤 일 기한이 3일 안"],
  ["c", "(다) 앞 일은 끝났는데 다음 담당이 없음 · 미사용 · 임시"],
  ["d", "(라) 뒤 일은 하는 중인데 앞 일은 할 일"],
];
export function OrderSheet({ D, cu, A, idx, open, onBack, onClose, setToast }) {
  const key = ymd(new Date());
  const oi = useMemo(() => orderIssues(D, idx, key), [D, idx]);
  const [asked, setAsked] = useState({});
  const who = (t) => nameOf(D.users, ownersOf(t)[0]) || "담당 없음";
  // (라)는 '할 일'로 남은 앞 일이 여럿이면 그 담당 모두에게 묻는다
  const targets = (k, t, p) => (k === "d" ? (idx.preds.get(t.id) || []).filter((x) => x.status === "todo") : [p]).filter(Boolean);
  const ask = async (k, t, p0) => { const ps = targets(k, t, p0); let n = 0;
    for (const p of ps) n += (await ask1(k, t, p)) ? 1 : 0;
    if (n) { setAsked((s) => ({ ...s, [k + t.id + p0.id]: true })); setToast({ text: `${[...new Set(ps.map(who))].join("·")}님께 물었어요` }); } };
  const ask1 = async (k, t, p) => {
    const text = k === "a" ? `앞 일 끝 예정 ${md(dueOf(p))}이 뒤 일 "${t.title}"(${who(t)}) 기한 ${md(dueOf(t))}보다 늦어요. 기한을 맞춰 주세요 · ${cu.name}`
      : k === "b" ? `이 일이 늦어져서 뒤 일 "${t.title}"(${who(t)}, 기한 ${md(dueOf(t))})이 위험해요. 언제 끝날까요? · ${cu.name}`
      : `뒤 일 "${t.title}"(${who(t)})이 이미 하는 중이에요. 이 일은 끝났나요? 끝났으면 '끝냈어요'를 눌러 주세요 · ${cu.name}`;
    return A.addNote(taskNoteId(p.id), text, null, [], { taskId: p.id, projectId: p.projectId });
  };
  const chain = (() => { const m = new Map(); oi.b.forEach((x) => { if (!x.p) return; const g = m.get(x.p.id) || { p: x.p, n: 0 }; g.n++; m.set(x.p.id, g); }); return [...m.values()].sort((a, b) => b.n - a.n); })();
  const total = oi.a.length + oi.b.length + oi.c.length + oi.d.length;
  return <Sheet title={`순서 꼬임 ${total}`} onBack={onBack} onClose={onClose}>
    <p className="a-hint" style={{ marginTop: 12 }}>앞 일 = 이 일보다 먼저 끝나야 하는 일(신제품 순서표·앞 일 지정). 같은 날 앞뒤는 꼬임으로 세지 않아요(출시 줄 '같은 날 넘김'). 둘 다 자동 기한이면 (가)에서 빼요.</p>
    {chain.length > 0 && <Card style={{ marginTop: 10, padding: "10px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{chain.slice(0, 5).map((g) => { const n = ddays(dueOf(g.p), key);
      return <div key={g.p.id}><b>{g.p.title}</b> ({who(g.p)}) {n != null && n < 0 ? <b style={{ color: C.red }}>{-n}일 지남</b> : "늦음"} → 뒤 {g.n}건 위험</div>; })}</Card>}
    {ORDER_L.map(([k, l]) => { const a = oi[k] || [];
      return <div key={k}><Head red={k === "b" && a.length > 0}>{l} {a.length}</Head>
        <Card>{a.length === 0 ? <Empty>없어요</Empty> : a.slice(0, 60).map((x, i) => { const done = asked[k + x.t.id + (x.p ? x.p.id : "")];
          return <Row key={k + x.t.id + (x.p ? x.p.id : i)} title={x.t.title}
            sub={`${who(x.t)} · ${dueOf(x.t) ? md(dueOf(x.t)) : "기한 없음"}${((D.projects || []).find((p) => p.id === x.t.projectId) || {}).title ? " · " + D.projects.find((p) => p.id === x.t.projectId).title : ""}`}
            sub2={x.p ? `앞 일: ${targets(k, x.t, x.p).map((p) => predLine(p, D.users, key)).join(" / ")}` : null} onClick={() => open({ type: "task", id: k === "c" ? x.t.id : (x.p || x.t).id })} last={i === Math.min(60, a.length) - 1}
            right={k === "c" ? <Act onClick={() => open({ type: "task", id: x.t.id })}>담당 정하기</Act>
              : x.p ? <Act onClick={() => !done && ask(k, x.t, x.p)} style={done ? { color: C.mute } : null}>{done ? "물어봄 ✓" : "담당에게 묻기"}</Act> : null} />; })}</Card></div>; })}
  </Sheet>;
}
