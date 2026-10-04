// 관리자 · 한 사람 일 한 번에 넘기기 (휴가·퇴사)
// 묶음마다 켜고 끄기(기본: 진행 중 · 할 일 · 보류 · 고정업무 · 책임 프로젝트 켬, 확인 대기는 끔 — 이미 끝낸 일이라)
// 받는 사람 한 명 → 미리 보기(묶음별 제목) → 넘기기(30건 이상이면 확인 창) → 5초 되돌리기. 끝낸 일·기록은 그대로
import { useState } from "react";
import { md, dueOf, nameOf, activeUsers, HAND_GROUPS, handOverPlan } from "../model.js";
import { C, Big, TBtn, Chip, Head, Card, Row, Empty, Sheet, Ask, inp } from "../ui.jsx";
import { pName } from "./common.jsx";

export function HandOver({ D, cu, A, open, onBack, onClose, id }) {
  const u = (D.users || []).find((x) => x.id === id);
  const [on, setOn] = useState({ doing: true, todo: true, hold: true, review: false, fixed: true, proj: true });
  const [to, setTo] = useState(""), [note, setNote] = useState(""), [show, setShow] = useState(""), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  if (!u) return <Sheet title="일 넘기기" onBack={onBack} onClose={onClose}><Empty>찾지 못했어요</Empty></Sheet>;
  const g = handOverPlan(D, u.id), users = activeUsers(D.users).filter((x) => x.id !== u.id);
  const pick = { tasks: ["doing", "todo", "hold", "review"].filter((k) => on[k]).flatMap((k) => g[k]), fixed: on.fixed ? g.fixed : [], projs: on.proj ? g.proj : [] };
  const n = pick.tasks.length + pick.fixed.length + pick.projs.length, total = HAND_GROUPS.reduce((s, [k]) => s + g[k].length, 0);
  const toN = nameOf(D.users, to);
  const go = async () => { setAsk(false); setBusy(true); const ok = await A.handOver(u.id, to, pick, note); setBusy(false); if (ok) setDone(true); };
  const foot = done ? <Big tone="white" onClick={onBack || onClose}>닫기</Big>
    : <Big disabled={!to || !n || busy} onClick={() => (n >= 30 ? setAsk(true) : go())}>{busy ? "넘기는 중" : !to ? "받는 사람을 골라 주세요" : !n ? "넘길 일을 골라 주세요" : `${toN}님에게 ${n}건 넘기기`}</Big>;
  const rowOf = (k, x, last) => k === "proj"
    ? <Row key={x.id} title={x.title} sub={[x.dueDate ? `마감 ${md(x.dueDate)}` : "마감 없음", x.status === "hold" ? "보류" : ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "project", id: x.id })} last={last} />
    : <Row key={x.id} title={x.title} sub={k === "fixed" ? (x.assigneeIds || []).length > 1 ? `함께 ${x.assigneeIds.map((y) => nameOf(D.users, y)).filter(Boolean).join("·")}` : "혼자 맡음"
      : [dueOf(x) ? md(dueOf(x)) : "기한 없음", pName(D, x.projectId), ownersOf2(x) > 1 ? "여러 명 담당" : ""].filter(Boolean).join(" · ")} onClick={() => open({ type: x.isFixed ? "fixed" : "task", id: x.id })} last={last} />;
  return <Sheet title={`${u.name}님 일 넘기기`} onBack={onBack} onClose={onClose} foot={foot}>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6, marginTop: 12 }}>휴가·퇴사 때 {u.name}님이 맡은 일을 한 사람에게 한 번에 넘겨요. 끝낸 일과 기록은 그대로 두고, 맡긴 사람도 바뀌지 않아요.</div>
    {done ? <Card style={{ marginTop: 14, padding: "14px" }}><div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.6 }}>{toN}님에게 넘겼어요. {toN}님 '확인할 것'에 '{u.name}님 업무 넘겨받음' 한 줄로 떠요.</div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>잘못 넘겼으면 아래 알림의 '되돌리기'를 눌러요 (5초)</div></Card>
    : total === 0 ? <Card style={{ marginTop: 14 }}><Empty>{u.name}님이 맡은 열린 일이 없어요</Empty></Card>
    : <>
      <Head>받는 사람</Head>
      <select aria-label="받는 사람" className="v2-sel" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%" }}><option value="">고르기 ▾</option>{users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <Head>넘길 일 · {n}건</Head>
      <div className="v2-chips">{HAND_GROUPS.map(([k, l]) => <Chip key={k} on={on[k] && g[k].length > 0} onClick={() => g[k].length && setOn({ ...on, [k]: !on[k] })} style={g[k].length ? null : { opacity: 0.45 }}>{on[k] && g[k].length ? "✓ " : ""}{l} {g[k].length}</Chip>)}</div>
      {g.review.length > 0 && !on.review && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>확인 대기 {g.review.length}건은 이미 끝낸 일이라 기본으로 빼 두었어요 (수정 요청이 오면 {u.name}님에게 가요)</div>}
      {HAND_GROUPS.filter(([k]) => on[k] && g[k].length).map(([k, l]) => { const a = g[k], open1 = show === k;
        return <div key={k}><Head right={<TBtn onClick={() => setShow(open1 ? "" : k)}>{open1 ? "접기 ▴" : "보기 ▾"}</TBtn>}>{l} {a.length}</Head>
          {open1 ? <Card>{a.slice(0, 60).map((x, i) => rowOf(k, x, i === Math.min(a.length, 60) - 1 && a.length <= 60))}{a.length > 60 && <div style={{ padding: "10px 14px", fontSize: 12.5, color: C.sub, borderTop: `1px solid ${C.line}` }}>그 밖에 {a.length - 60}건도 같이 넘어가요</div>}</Card>
            : <Card style={{ padding: "10px 14px", fontSize: 13.5, color: C.text }}>{a.slice(0, 3).map((x) => x.title).join(" · ")}{a.length > 3 ? ` 외 ${a.length - 3}건` : ""}</Card>}</div>; })}
      <Head>한마디 (선택)</Head>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="넘기는 한마디" placeholder="예: 10/7~10/18 휴가 · 급한 건 먼저 봐 주세요" style={{ ...inp, resize: "vertical" }} />
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>
        {to ? `${toN}님 '확인할 것'에 한 줄로 떠요 · ` : ""}여러 명이 같이 맡은 일은 {u.name}님 자리만 바뀌어요 · 고정업무 체크 기록은 지우지 않아요{to ? ` · 돌아오면 사람 › ${toN} › 일 넘기기로 다시 돌려줄 수 있어요` : ""}</div>
    </>}
    {ask && <Ask title="일 넘기기" body={`${u.name}님 일 ${n}건을 ${toN}님에게 넘길까요?\n업무 ${pick.tasks.length} · 고정업무 ${pick.fixed.length} · 프로젝트 ${pick.projs.length}`} yes="넘기기" onNo={() => setAsk(false)} onYes={go} />}
  </Sheet>;
}
const ownersOf2 = (t) => (Array.isArray(t.assigneeIds) && t.assigneeIds.length ? t.assigneeIds.length : 1);
