// 관리자 · 한눈에 '판단 필요' — 중요도 × 예상 끝나는 날(남은 업무 ÷ 최근 2주 속도)
//  당겨야 할 것: 중요 높음인데 마감 지남 · 예상일이 마감보다 늦음 · 최근 2주 끝낸 업무 0인데 마감 2주 안
//  미뤄도 되는 것: 중요 낮음 업무가 이번 주 한도 넘은 사람에게 있음 → [1주 미루기](미리 보기 → 5초 되돌리기)
//  끝났거나 멈춘 프로젝트: [모두 | 완료 | 중단 | 보류] + 이유 · 날짜 (지운 것 없음, 누르면 그 프로젝트)
import { useMemo, useState } from "react";
import { md, addDays, ymd, nextWorkday, nameOf, dueOf, judgeOf, projOpen, isHoldP, projStLabel } from "../model.js";
import { C, Chip, Head, Card, Row, Empty, More, Act, Ask } from "../ui.jsx";

const stK = (p) => (isHoldP(p) ? "hold" : p.status === "dropped" ? "drop" : "done");
const endAt = (p) => String((isHoldP(p) ? p.heldAt : p.status === "dropped" ? p.droppedAt : p.completedAt) || p.updatedAt || "");
const NAVY = { background: C.navy, color: "#fff", borderColor: C.navy };

export function Judge({ D, A, open, keyd }) {
  const J = useMemo(() => judgeOf(D, keyd), [D, keyd]);
  const [ask, setAsk] = useState(null), [f, setF] = useState("all"), [n, setN] = useState(5), [endOpen, setEndOpen] = useState(false);   // 끝난·멈춘 프로젝트는 드물게 봄 → 한 줄로 접어 둠
  const ended = useMemo(() => D.projects.filter((p) => !projOpen(p) || isHoldP(p)).sort((a, b) => endAt(b).localeCompare(endAt(a))), [D.projects]);
  const cnt = (k) => ended.filter((p) => k === "all" || stK(p) === k).length;
  const list = ended.filter((p) => f === "all" || stK(p) === f);
  const push1w = (x) => setAsk({ x, changes: x.tasks.map((t) => ({ task: t, due: nextWorkday(addDays(dueOf(t), 7)) })) });
  const after = (x) => x.ppl.map((y) => `${nameOf(D.users, y.u)} ${y.n}건 → ${y.n - y.k}건 (주 한도 ${y.cap})`).join(" · ");
  return <>
    <Head>판단 필요 {J.pull.length + J.push.length}</Head>
    <Card>
      <div className="a-jh">당겨야 할 것 <small>중요 높음 · 늦어질 듯</small><b>{J.pull.length}</b></div>
      {J.pull.length === 0 ? <Empty>중요 '높음' 프로젝트가 예정대로 가요</Empty> : J.pull.slice(0, 6).map((x, i) => <Row key={x.p.id} tag="높음" title={x.p.title}
        sub={[x.why, x.blocked ? `막힌 일 ${x.blocked}` : "", nameOf(D.users, x.p.assigneeId) ? `책임 ${nameOf(D.users, x.p.assigneeId)}` : "책임 없음"].filter(Boolean).join(" · ")}
        onClick={() => open({ type: "project", id: x.p.id })} right={<Act onClick={() => open({ type: "project", id: x.p.id })}>사람·기한 보기</Act>} last={i === Math.min(6, J.pull.length) - 1 && J.push.length === 0} />)}
      <div className="a-jh" style={{ borderTop: `1px solid ${C.line}` }}>미뤄도 되는 것 <small>중요 낮음 · 한도 넘은 사람</small><b>{J.push.length}</b></div>
      {J.push.length === 0 ? <Empty>이번 주 미룰 것이 없어요</Empty> : J.push.slice(0, 6).map((x, i) => <Row key={x.p.id} tag="낮음" title={x.p.title}
        sub={`이번 주 이 프로젝트 업무 ${x.tasks.length}건 미루면 ${after(x)}`} onClick={() => open({ type: "project", id: x.p.id })}
        right={<Act onClick={() => push1w(x)} style={NAVY}>1주 미루기</Act>} last={i === Math.min(6, J.push.length) - 1} />)}
    </Card>
    <Card style={{ marginTop: 14 }}><More onClick={() => setEndOpen(!endOpen)}>{endOpen ? "끝났거나 멈춘 프로젝트 접기 ▴" : `끝났거나 멈춘 프로젝트 ${ended.length} ▾`}</More></Card>
    {endOpen && <><div className="v2-chips" role="group" aria-label="끝난 프로젝트 거르기" style={{ marginTop: 8 }}>{[["all", "모두"], ["done", "완료"], ["drop", "중단"], ["hold", "보류"]].map(([k, l]) => <Chip key={k} on={f === k} onClick={() => { setF(k); setN(5); }}>{l} {cnt(k)}</Chip>)}</div>
    <Card style={{ marginTop: 8 }}>{list.length === 0 ? <Empty>없어요</Empty> : list.slice(0, n).map((p, i) => <Row key={p.id} title={p.title}
      sub={[`${projStLabel(p)}${endAt(p) ? " " + md(ymd(new Date(endAt(p)))) : ""}`, isHoldP(p) ? (p.holdUntil ? `다시 할 날 ${md(p.holdUntil)}` : "다시 할 날 미정") : "", isHoldP(p) ? p.holdReason : p.status === "dropped" ? p.dropReason : "", p.status === "dropped" ? "남은 업무 접음" : ""].filter(Boolean).join(" · ")}
      onClick={() => open({ type: "project", id: p.id })} last={i === Math.min(n, list.length) - 1 && list.length <= n} />)}
      {list.length > n && <More onClick={() => setN(n + 10)}>{list.length - n}개 더 보기 ▾</More>}</Card></>}
    {ask && <Ask title={`${ask.x.p.title} · 1주 미루기`} yes={`${ask.changes.length}건 미루기`} onNo={() => setAsk(null)}
      body={`${ask.changes.slice(0, 5).map((c) => `${c.task.title} ${md(dueOf(c.task))} → ${md(c.due)}`).join("\n")}${ask.changes.length > 5 ? `\n외 ${ask.changes.length - 5}건` : ""}\n\n${after(ask.x)} · 5초 안에 되돌릴 수 있어요`}
      onYes={() => { A.applyDues(ask.changes, `${ask.x.p.title} · 1주 미루기`); setAsk(null); }} />}
  </>;
}
