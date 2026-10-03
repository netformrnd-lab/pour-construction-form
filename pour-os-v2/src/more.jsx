// 업무OS v2 — 더보기 (나와 관련된 도구만) · 내가 맡긴 일 · 내 고정업무
import { useState } from "react";
import { ymd, md, hm, isMaster, nameOf, ownersOf, dueOf, riskOf, assignedByMe, fxIsMine, fxRecurL, fxTime, fxLabel, fxMeDone, COUNT_L } from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, useLocal } from "./ui.jsx";
import { V1_URL, LS } from "./core.jsx";

const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
const ASG = [["review", "확인해 주세요", true], ["dueReq", "기한 조정 요청", true], ["blocked", "막힘", true], ["late", "기한 지남", true], ["risk", "곧 마감인데 시작 전", true], ["notAck", "아직 안 받음", true], ["doing", "진행 중", true], ["waiting", "받고 대기 중", false], ["done", "최근 7일 끝남", false]];

export function MoreTab({ D, cu, meta, logout, open, BUILD }) {
  const [ask, setAsk] = useState(""), [start, setStart] = useLocal(LS("start-" + cu.id), "today"), [news, setNews] = useLocal(LS("news3-" + cu.id), true);
  const G = assignedByMe(D, cu.id, new Date()), gN = Object.values(G).reduce((a, b) => a + b.length, 0), urgent = G.review.length + G.dueReq.length + G.blocked.length;
  const myFx = D.tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, cu.id)).length;
  const c = meta.counts || {};
  const at = meta.reseededAt || meta.seededAt;
  const arrow = <span style={{ color: C.navy, fontWeight: 800 }}>›</span>;
  return <>
    <header style={{ padding: "14px 2px 6px" }}><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>더보기</h1></header>
    {news && <Card style={{ marginTop: 8, padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
      <b>바뀐 점</b> · 팀 탭이 없어지고 달력이 생겼어요. 동료가 지금 하는 일은 달력 오른쪽 위 [나 ▾], 프로젝트의 '지금 → 다음', 업무의 '앞 일 · 다음 일'에서 봐요. 팀 전체 현황은 관리자 화면에 있어요.
      <div><TBtn onClick={() => setNews(false)} style={{ paddingLeft: 0 }}>알겠어요</TBtn></div></Card>}
    <Head>나</Head>
    <Card><Row title={cu.name} sub={isMaster(cu) ? "마스터" : "팀원"} last={false} />
      <Row title="다른 사람으로 쓰기" sub="이 기기에서 나가고 이름을 다시 골라요" onClick={() => setAsk("out")} right={arrow} last /></Card>
    <Head>내 일</Head>
    <Card>
      <Row title={`내가 맡긴 일 ${gN}`} tag={urgent ? `처리할 것 ${urgent}` : null} sub="확인 요청 · 기한 조정 · 막힘 · 아직 안 받음" onClick={() => open({ type: "assigned" })} right={arrow} last={false} />
      <Row title="내 할 일 모두" sub="할 일 · 진행 · 확인 대기 · 보류 · 끝남" onClick={() => open({ type: "mine" })} right={arrow} last={false} />
      <Row title={`내 고정업무 ${myFx}`} sub="매일 · 매주 · 매월" onClick={() => open({ type: "myFixed" })} right={arrow} last />
    </Card>
    <Head>앱을 열면 먼저</Head>
    <div style={{ margin: "0 0 4px" }}><Seg items={[["today", "오늘"], ["calendar", "달력"]]} value={start} onChange={setStart} /></div>
    {isMaster(cu) && <><Head>관리자</Head><Card><a href="./os2-admin.html" style={{ textDecoration: "none" }}><Row title="관리자 화면" sub="팀 달력 · 사람별 일정 · 프로젝트 위험 · 한꺼번에 정리 · 가져오기" right={arrow} last /></a></Card></>}
    <Head>시험판 안내</Head>
    <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.75 }}>
      <div>· 버전1 데이터를 복사해서 따로 저장해요({at ? `${md(ymd(new Date(at)))} ${hm(at)} 복사` : "-"}). 여기서 바꾼 것은 버전1에 반영되지 않아요.</div>
      <div>· {Object.entries(c).filter(([k]) => COUNT_L[k]).map(([k, v]) => `${COUNT_L[k]} ${v}`).join(" · ")}</div>
      <a href={V1_URL} style={{ display: "inline-block", marginTop: 6, color: C.navy, fontWeight: 800 }}>버전1 열기 ›</a>
    </Card>
    <p style={{ textAlign: "center", fontSize: 12, color: C.mute, margin: "24px 0 8px" }}>업무OS {BUILD}</p>
    {ask === "out" && <Ask title="다른 사람으로 쓰기" body={"이 기기에서 나가요.\n다시 들어올 때 이름과 PIN을 넣어요."} yes="나가기" onNo={() => setAsk("")} onYes={() => { setAsk(""); logout(); }} />}
  </>;
}

// 내가 맡긴 일 (지시자) — 위에서부터 처리
export function AssignedSheet({ D, cu, A, open, onBack, onClose }) {
  const [more, setMore] = useState({});
  const key = ymd(new Date()), G = assignedByMe(D, cu.id, new Date()), gN = Object.values(G).reduce((a, b) => a + b.length, 0);
  return <Sheet title={`내가 맡긴 일 ${gN}`} onBack={onBack} onClose={onClose} foot={<Big onClick={() => open({ type: "add" })}>+ 맡기기</Big>}>
    {gN === 0 && <Card style={{ marginTop: 12 }}><Empty>아직 맡긴 일이 없어요</Empty></Card>}
    {ASG.map(([k, l, def]) => { const a = G[k]; if (!a.length) return null; const m = more[k], shown = def ? (m ? a : a.slice(0, 6)) : m ? a : [];
      return <div key={k}><Head red={k === "late" || k === "blocked"} right={(!def || a.length > 6) && <TBtn onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : def ? `${a.length - 6}개 더 ▾` : `${a.length} ▾`}</TBtn>}>{l} {a.length}</Head>
        {shown.length > 0 && <Card>{shown.map((t, i) => { const r = riskOf(t, key);
          const act = k === "review" ? <Act onClick={() => A.approve(t)} style={BTN_ON}>확인</Act> : k === "dueReq" ? <Act onClick={() => A.answerDue(t, true)} style={BTN_ON}>수락</Act> : null;
          return <Row key={t.id} tag={k === "dueReq" ? `→ ${md(t.dueReq.date)}` : r && k !== "review" ? r.label : null} tagTone={r && r.red ? "red" : null} title={t.title}
            sub={[nameOf(D.users, ownersOf(t)[0]) || "담당 없음", dueOf(t) ? `기한 ${md(dueOf(t))}` : "기한 미정", t.ackAt ? "받음" : "", k === "blocked" ? t.blocked.reason : k === "dueReq" ? t.dueReq.reason : ""].filter(Boolean).join(" · ")}
            onClick={() => open({ type: "task", id: t.id })} right={act} last={i === shown.length - 1} />; })}</Card>}</div>; })}
  </Sheet>;
}

// 내 고정업무 (매일 · 매주 · 매월)
export function MyFixedSheet({ D, cu, open, onBack, onClose }) {
  const key = ymd(new Date());
  const all = D.tasks.filter((t) => t.isFixed && fxIsMine(t, cu.id));
  const g = [["daily", "매일"], ["weekly", "매주"], ["monthly", "매월"]].map(([k, l]) => [l, all.filter((t) => (t.recurType || "daily") === k && !t.paused)]);
  const paused = all.filter((t) => t.paused);
  return <Sheet title={`내 고정업무 ${all.length}`} onBack={onBack} onClose={onClose}>
    {g.map(([l, a]) => a.length > 0 && <div key={l}><Head>{l} {a.length}</Head><Card>{a.sort((x, y) => String(fxTime(x, cu.id) || "99").localeCompare(String(fxTime(y, cu.id) || "99"))).map((t, i) =>
      <Row key={t.id} title={fxLabel(t, cu.id)} sub={[fxRecurL(t), fxTime(t, cu.id) || "시간 상관없음"].join(" · ")} tag={fxMeDone(t, cu.id, key) ? "✓" : null} onClick={() => open({ type: "fixed", id: t.id })} last={i === a.length - 1} />)}</Card></div>)}
    {paused.length > 0 && <><Head>멈춤 {paused.length}</Head><Card>{paused.map((t, i) => <Row key={t.id} dim title={fxLabel(t, cu.id)} sub={fxRecurL(t)} onClick={() => open({ type: "fixed", id: t.id })} last={i === paused.length - 1} />)}</Card></>}
    {!all.length && <Card style={{ marginTop: 12 }}><Empty>맡은 고정업무가 없어요</Empty></Card>}
  </Sheet>;
}
