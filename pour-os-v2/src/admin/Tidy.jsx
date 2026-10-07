// 관리자 · 정리 — 쌓인 것을 지우지 않고 한 번에 치우기
// 묶음 목록(숫자 큰 순) → 묶음 안: 사람별·제품별 고르기(PickList) → 아래 막대(BulkBar)로 담당·기한·보류·날짜 없이 두기·담당에게 묻기
// 안전장치(pick.jsx · core.jsx bulk): 한 번에 100건 · 미리 보기 문장 · 30건 이상 확인 창 · 5초 되돌리기 · 기록(이전 값) · 삭제 없음
import { useMemo, useState } from "react";
import { ymd, md, ddays, nameOf, ownersOf, dueOf, isDone, taskNoteId, projOpen, taskTrashRows, projTrashRows, canRestoreProj, noteTrashRows, isMaster } from "../model.js";
import { TrashList } from "../trash.jsx";
import { groupItems, previewLaunchMove } from "../views.js";
import { orderIssues, predLine } from "../turn.js";
import { PickList, ro } from "../pick.jsx";
import { C, Act, Seg, TBtn, Head, Card, Row, Empty, Sheet, Ask, More } from "../ui.jsx";
import { adminQueues, SelBar, isLaunchP, LineBtn } from "./common.jsx";

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
    {/* 없앤 프로젝트(책임자·관리자 · 2026-10-07) 전부 — 처음엔 접힘 · 되살리면 업무까지 통째로 */}
    <TrashList rows={projTrashRows(D.removedProjects)} A={A} open={open} label="없앤 프로젝트" canRestore={(r) => canRestoreProj(r.x, cu)} note="책임자·관리자가 목록에서 뺀 프로젝트예요 · 되살리면 안에 있던 업무까지 통째로 돌아와요 · 댓글·자료·기록은 그대로 · 신제품 대시보드는 안 건드려요" style={{ marginTop: 12 }} />
    {/* 없앤 업무(누구나 없애기 · 2026-10-07) 전부 — 처음엔 접힘 */}
    <TrashList rows={taskTrashRows(D.removedTasks, D.projects)} A={A} open={open} label="없앤 업무" note="팀원이 목록에서 뺀 한 번짜리 업무예요 · 되살리면 없애기 전 그대로(하위 업무도 같이) · 댓글·파일·기록은 그대로" style={{ marginTop: 12 }} />
    {/* 삭제한 댓글(쓴 사람·관리자 · 2026-10-07 '흔적 없이 숨김') — 최근 30일 안 댓글 · 처음엔 접힘 · [되살리기] 관리자 */}
    <TrashList rows={noteTrashRows(D.removedNotes, D)} A={A} open={open} label="삭제한 댓글" canRestore={() => isMaster(cu)} note="쓴 사람·관리자가 삭제한 댓글이에요 · 화면 어디에도 안 보이고 답글은 그대로 남아요 · 붙은 파일은 지우지 않아요" style={{ marginTop: 12 }} />
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
      <TBtn onClick={back} className="a-qback">‹ 묶음 목록</TBtn>
      <h2>{q.label || "묶음"} <span>{q.items.length}</span></h2>
    </div>
    {q.k === "dueReq" ? <DueReqList items={q.items} D={D} cu={cu} A={A} open={open} />
      : <>
        {q.k === "order" && <LineBtn onClick={() => open({ type: "order" })} label="순서 꼬임 자세히 보기">순서 꼬임 자세히 보기 · 앞 일 담당에게 묻기</LineBtn>}
        {undated.length > 0 && <UndatedLaunch list={undated} A={A} D={D} keyd={keyd} />}
        {dr.length > 0 && <><Head>기한 조정 요청 {dr.length}</Head><DueReqList items={dr} D={D} cu={cu} A={A} open={open} /></>}
        {dr.length > 0 && items.length > 0 && <Head>확인 3일 넘음 · 7일 넘게 안 받음 {items.length}</Head>}
        {items.length > 0 && <div style={{ marginTop: 12, maxWidth: 360 }}><Seg items={[...(q.k === "noDue" ? [["mix", "제품 먼저"]] : []), ["person", "사람별"], ["project", "제품별"]]} value={by} onChange={setBy} /></div>}
        {q.items.length === 0 ? <Card style={{ marginTop: 12 }}><Empty>이 묶음은 비었어요</Empty></Card> : items.length === 0 ? null
          : <PickList D={D} groups={groups} sel={sel} setSel={setSel} open={open} temp={idx.temp} />}
        {q.k === "noDue" && <p className="a-hint">'날짜 없이 두기'를 고르면 이번 달({+ym.slice(5)}월)에는 다시 묻지 않아요.</p>}
      </>}
    <SelBar D={D} cu={cu} A={A} sel={sel} setSel={setSel} setToast={setToast} pad />
  </>;
}

// 출시일 미정 제품: 줄마다 [출시일 정하기] → 출시일에서 거꾸로 항목 기한이 채워짐 (자동 기한만)
//   고르면 먼저 '항목 n개 기한이 채워져요' 미리 보기 · 30건 이상이면 확인 창 · 지난 날 안 됨 (되돌리기·이전 값 기록은 A.setLaunchDate)
function UndatedLaunch({ list, A, D, keyd }) {
  const [d, setD] = useState({}), [busy, setBusy] = useState(""), [ask, setAsk] = useState(null);
  const nOf = (x) => (d[x.p.id] && d[x.p.id] >= keyd ? previewLaunchMove(x.p, D, d[x.p.id], keyd).changes.length : 0);
  const run = async (x) => { const date = d[x.p.id]; if (!date || busy) return; setAsk(null); setBusy(x.p.id); const ok = await A.setLaunchDate(x.p, date); setBusy(""); if (ok !== false) setD((m) => ({ ...m, [x.p.id]: "" })); };
  const go = (x) => { const date = d[x.p.id]; if (!date || date < keyd || busy) return; const n = nOf(x); return n >= 30 && n <= 100 ? setAsk({ x, n, date }) : run(x); };
  return <>
    <Head>출시일 미정 신제품 {list.length} · 항목 {list.reduce((a, x) => a + x.n, 0)}</Head>
    <Card>{list.map((x, i) => { const date = d[x.p.id] || "", past = !!date && date < keyd, n = nOf(x);
      return <div key={x.p.id} className="a-undated" style={{ borderBottom: i < list.length - 1 ? `1px solid ${C.line}` : "none" }}>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}><b>{x.p.title}</b><div style={{ fontSize: 12.5, color: C.sub }}>출시일 미정 · 항목 {x.n}</div></div>
        <input type="date" className="v2-sel" min={keyd} aria-label={`${x.p.title} 출시일`} value={date} onChange={(e) => setD({ ...d, [x.p.id]: e.target.value })} />
        <Act onClick={() => go(x)} style={date && !past ? NAVY_BTN : { opacity: 0.5 }}>{busy === x.p.id ? "정하는 중" : "출시일 정하기"}</Act>
        {date && <div className="a-undprev" role="status">{past ? `지난 날(${md(date)})은 출시일로 정할 수 없어요 · 오늘 이후로 골라 주세요`
          : n > 100 ? `항목 ${n}개 · 한 번에 100건까지라 바꿀 수 없어요`
          : n ? `${md(date)} 출시 → 항목 ${n}개 기한이 채워져요${n >= 30 ? " · 누르면 한 번 더 물어요" : ""}` : `${md(date)} 출시 · 기한이 바뀌는 항목은 없어요`}</div>}
      </div>; })}</Card>
    <p className="a-hint">날짜를 고르고 [출시일 정하기]를 누르면 항목 기한이 출시일에서 거꾸로 채워져요 (주말·공휴일 건너뜀). 5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.</p>
    {ask && <Ask title={`항목 ${ask.n}개 기한을 채울까요?`} body={`${ask.x.p.title} 출시일을 ${md(ask.date)}${ro(md(ask.date))} 정하면 항목 ${ask.n}개 기한이 출시일에서 거꾸로 채워져요.\n5초 안에 되돌릴 수 있고, 바꾸기 전 값은 기록에 남아요.`} yes="출시일 정하기" onNo={() => setAsk(null)} onYes={() => run(ask.x)} />}
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
  const [asked, setAsked] = useState({}), [nShow, setNShow] = useState({});
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
  // 제목 숫자 = 위험 칸 · 정리 묶음과 같은 규칙: (가)+(라) (같은 일은 한 번) — (나)(다)는 '함께 볼 것'으로 따로 셈
  const total = new Set([...(oi.a || []), ...(oi.d || [])].map((x) => x.t.id)).size;
  return <Sheet title={`순서 꼬임 ${total}`} onBack={onBack} onClose={onClose}>
    <p className="a-hint" style={{ marginTop: 12 }}>순서 꼬임 {total} = (가)+(라) (같은 일은 한 번) · (나)(다)는 함께 볼 것이라 이 숫자에 안 세요. 앞 일 = 이 일보다 먼저 끝나야 하는 일(신제품 순서표·앞 일 지정). 같은 날 앞뒤는 꼬임으로 세지 않아요(출시 줄 '같은 날 넘김'). 둘 다 자동 기한이면 (가)에서 빼요.</p>
    {chain.length > 0 && <Card style={{ marginTop: 10, padding: "10px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{chain.slice(0, 5).map((g) => { const n = ddays(dueOf(g.p), key);
      return <div key={g.p.id}><b>{g.p.title}</b> ({who(g.p)}) {n != null && n < 0 ? <b style={{ color: C.red }}>{-n}일 지남</b> : "늦음"} → 뒤 {g.n}건 위험</div>; })}</Card>}
    {ORDER_L.map(([k, l]) => { const a = oi[k] || [], lim = nShow[k] || 60;
      return <div key={k}><Head red={k === "b" && a.length > 0}>{l} {a.length}{k === "b" || k === "c" ? <small className="a-also"> · 함께 볼 것</small> : null}</Head>
        <Card>{a.length === 0 ? <Empty>없어요</Empty> : a.slice(0, lim).map((x, i) => { const done = asked[k + x.t.id + (x.p ? x.p.id : "")];
          return <Row key={k + x.t.id + (x.p ? x.p.id : i)} title={x.t.title}
            sub={`${who(x.t)} · ${dueOf(x.t) ? md(dueOf(x.t)) : "기한 없음"}${((D.projects || []).find((p) => p.id === x.t.projectId) || {}).title ? " · " + D.projects.find((p) => p.id === x.t.projectId).title : ""}`}
            sub2={x.p ? `앞 일: ${targets(k, x.t, x.p).map((p) => predLine(p, D.users, key)).join(" / ")}` : null} onClick={() => open({ type: "task", id: k === "c" ? x.t.id : (x.p || x.t).id })} last={i === Math.min(lim, a.length) - 1 && a.length <= lim}
            right={k === "c" ? <Act onClick={() => open({ type: "task", id: x.t.id })}>담당 정하기</Act>
              : x.p ? <Act onClick={() => !done && ask(k, x.t, x.p)} style={done ? { color: C.mute } : null}>{done ? "물어봄 ✓" : "담당에게 묻기"}</Act> : null} />; })}
          {a.length > lim && <More onClick={() => setNShow((m) => ({ ...m, [k]: lim + 60 }))}>{a.length - lim}개 더 ▾</More>}</Card></div>; })}
  </Sheet>;
}
