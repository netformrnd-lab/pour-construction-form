// 업무OS v2 — 더보기 (나와 관련된 도구만) · 내가 맡긴 일 · 내 고정업무
import { useState } from "react";
import { ymd, md, hm, isMaster, nameOf, ownersOf, dueOf, riskOf, assignedByMe, fxIsMine, fxRecurL, fxTime, fxLabel, fxMeDone, COUNT_L, scopeOf, brandLabel, FX_WD } from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, useLocal, inp } from "./ui.jsx";
import { V1_URL, LS } from "./core.jsx";
import { SmsSettings } from "./smsui.jsx";
import { myRoutine, brandName } from "./routine.js";
import { akWho } from "../../pour-os/src/actionKpi.js";

const BTN_ON = { background: C.navy, color: "#fff", borderColor: C.navy };
const ASG = [["review", "확인해 주세요", true], ["dueReq", "기한 조정 요청", true], ["blocked", "막힘", true], ["late", "기한 지남", true], ["risk", "곧 마감인데 시작 전", true], ["notAck", "아직 안 받음", true], ["doing", "진행 중", true], ["waiting", "받고 대기 중", false], ["done", "최근 7일 끝남", false]];

export function MoreTab({ D, cu, meta, logout, open, BUILD, setToast }) {
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
      <div><TBtn onClick={() => setNews(false)}>알겠어요</TBtn></div></Card>}
    <Head>나</Head>
    <Card><Row title={cu.name} sub={isMaster(cu) ? "관리자" : "팀원"} last={false} />
      <Row title="다른 사람으로 쓰기" sub="이 기기에서 나가고 이름을 다시 골라요" onClick={() => setAsk("out")} right={arrow} last /></Card>
    <Head>내 일</Head>
    <Card>
      <Row title={`내가 맡긴 일 ${gN}`} tag={urgent ? `처리할 것 ${urgent}` : null} sub="확인 요청 · 기한 조정 · 막힘 · 아직 안 받음" onClick={() => open({ type: "assigned" })} right={arrow} last={false} />
      <Row title="내 할 일 모두" sub="할 일 · 진행 · 확인 대기 · 보류 · 끝남" onClick={() => open({ type: "mine" })} right={arrow} last={false} />
      <Row title={`내 고정업무 ${myFx}`} sub="매일 · 매주 · 매월" onClick={() => open({ type: "myFixed" })} right={arrow} last={false} />
      <Row title="내 KPI" sub="내 반복·내 프로젝트가 움직이는 KPI" onClick={() => open({ type: "myKpi" })} right={arrow} last />
    </Card>
    <Head>문자 알림</Head>
    <SmsSettings cu={cu} setToast={setToast} />
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

// 내 고정업무 — [+ 고정업무] · 두 묶음: '고정업무(내 것)'(개인·브랜드 미정) / '내가 맡은 반복 실행'(브랜드 정한 것)
export function MyFixedSheet({ D, cu, open, onBack, onClose }) {
  const key = ymd(new Date());
  const all = D.tasks.filter((t) => t.isFixed && fxIsMine(t, cu.id));
  const RT = { daily: 0, weekly: 1, monthly: 2 };
  const sortF = (a) => [...a].sort((x, y) => (RT[x.recurType || "daily"] ?? 0) - (RT[y.recurType || "daily"] ?? 0) || String(fxTime(x, cu.id) || "99").localeCompare(String(fxTime(y, cu.id) || "99")));
  const live = all.filter((t) => !t.paused), paused = all.filter((t) => t.paused);
  const mine = sortF(live.filter((t) => scopeOf(t) !== "brand")), rt = sortF(live.filter((t) => scopeOf(t) === "brand"));
  // 횟수 목표 반복 실행(버전1 행동지표 + v2 에서 만든 것 · 덧칠 D.ak.items) 중 내가 담당 — 누르면 반복 실행 시트
  const ak = D.ak || {}, akRows = myRoutine(ak.items || [], D.users, cu.id, ak.docs || {}, key);
  const akPaused = (ak.items || []).filter((it) => it && it.paused && it.active !== false && !it.deleted && akWho(D.users, it).includes(cu.id));
  const rtN = rt.length + akRows.length;
  const akRow = (r, i, a) => { const it = r.it, u = it.unit === "%" ? "%" : it.unit || "회";
    return <Row key={"ak" + it.id} title={it.name} tag={r.tot.done ? "✓" : null}
      sub={[`횟수 목표 · ${r.per} ${it.perFail ? `시도 ${r.tot.n} / ${r.tot.g || 0}회` : `${r.tot.n} / ${r.tot.g}${u}`}`, brandName(it.brand, D.brands) || ""].filter(Boolean).join(" · ")}
      onClick={() => open({ type: "routine", id: it.id })} last={i === a.length - 1} />; };
  const row = (t, i, a) => <Row key={t.id} title={fxLabel(t, cu.id)} sub={[fxRecurL(t), fxTime(t, cu.id) || "시간 상관없음", scopeOf(t) === "brand" ? brandLabel(t.brand, D.brands) : scopeOf(t) === "unset" ? "브랜드 미정" : ""].filter(Boolean).join(" · ")}
    tag={fxMeDone(t, cu.id, key) ? "✓" : null} onClick={() => open({ type: "fixed", id: t.id })} last={i === a.length - 1} />;
  return <Sheet title={`내 고정업무 ${all.length}`} onBack={onBack} onClose={onClose} foot={<Big onClick={() => open({ type: "addFixed" })}>+ 고정업무</Big>}>
    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 12, lineHeight: 1.6 }}>고정업무 = 내가 빠뜨리지 않으려고 쓰는 알림이에요 · 반복 실행 = 브랜드 운영이라 관리자가 정해요</div>
    <Head>고정업무(내 것) {mine.length}</Head>
    <Card>{mine.length ? mine.map(row) : <Empty>아직 없어요 · 아래 [+ 고정업무]로 만들어요</Empty>}</Card>
    {rtN > 0 && <><Head>내가 맡은 반복 실행 {rtN}</Head><Card>{rt.map((t, i) => row(t, i, akRows.length ? [...rt, ...akRows] : rt))}{akRows.map((r, i) => akRow(r, i, akRows))}</Card></>}
    {paused.length + akPaused.length > 0 && <><Head>멈춤 {paused.length + akPaused.length}</Head><Card>{paused.map((t, i) => <Row key={t.id} dim title={fxLabel(t, cu.id)} sub={fxRecurL(t)} onClick={() => open({ type: "fixed", id: t.id })} last={!akPaused.length && i === paused.length - 1} />)}
      {akPaused.map((it, i) => <Row key={"ak" + it.id} dim title={it.name} sub="횟수 목표 · 멈춤" onClick={() => open({ type: "routine", id: it.id })} last={i === akPaused.length - 1} />)}</Card></>}
  </Sheet>;
}

// 고정업무 새로 만들기 (한 시트에서 끝): 이름 · 반복(매일 / 매주 요일 / 매월 n일·말일) · 시간(선택) · 체크리스트(선택) → 개인 고정업무(scope me · 담당 나)
export function AddFixedSheet({ A, onBack, onClose }) {
  const [f, setF] = useState({ title: "", rt: "daily", wd: ["월"], mday: "1", time: "", subs: [] }), [sub, setSub] = useState(""), [busy, setBusy] = useState(false);
  const ok = f.title.trim() && (f.rt !== "weekly" || f.wd.length > 0);
  const addSub = () => { const v = sub.trim(); if (!v) return; setF({ ...f, subs: [...f.subs, v] }); setSub(""); };
  const save = async () => { if (!ok || busy) return; setBusy(true);
    const id = await A.addFixed({ title: f.title, recurType: f.rt, weekDays: f.wd, monthDay: f.mday === "end" ? 31 : +f.mday, monthEnd: f.mday === "end", fixedTime: f.time, subs: [...f.subs, ...(sub.trim() ? [sub.trim()] : [])] });
    setBusy(false); if (id) onBack ? onBack() : onClose(); };
  const lab = { fontSize: 13, fontWeight: 800, color: C.ink, margin: "16px 0 6px" };
  return <Sheet title="고정업무 만들기" kind="고정업무" head="고정업무 만들기" onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!ok || busy}>저장</Big>}>
    <div style={lab}>이름</div>
    <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="예: 오전 메일 확인" aria-label="고정업무 이름" style={inp} autoFocus />
    <div style={lab}>반복</div>
    <Seg items={[["daily", "매일"], ["weekly", "매주"], ["monthly", "매월"]]} value={f.rt} onChange={(rt) => setF({ ...f, rt })} />
    {f.rt === "weekly" && <div className="v2-chips" style={{ marginTop: 8 }} role="group" aria-label="요일">{FX_WD.map((d) => <Chip key={d} on={f.wd.includes(d)} onClick={() => setF({ ...f, wd: f.wd.includes(d) ? f.wd.filter((x) => x !== d) : FX_WD.filter((x) => x === d || f.wd.includes(x)) })}>{d}</Chip>)}</div>}
    {f.rt === "monthly" && <select aria-label="매월 날짜" className="v2-sel" style={{ marginTop: 8 }} value={f.mday} onChange={(e) => setF({ ...f, mday: e.target.value })}>
      {[...Array(31)].map((_, i) => <option key={i} value={String(i + 1)}>{i + 1}일</option>)}<option value="end">말일 (평일 기준)</option></select>}
    <div style={{ fontSize: 12, color: C.mute, marginTop: 6 }}>주말·공휴일이면 앞 평일에 떠요 · 매일은 평일만</div>
    <div style={lab}>시간 <span style={{ color: C.mute, fontWeight: 700 }}>(선택)</span></div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="time" aria-label="시간" className="v2-sel" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />{f.time && <TBtn onClick={() => setF({ ...f, time: "" })}>시간 지우기</TBtn>}</div>
    <div style={lab}>체크리스트 <span style={{ color: C.mute, fontWeight: 700 }}>(선택)</span></div>
    {f.subs.length > 0 && <div className="v2-chips" style={{ marginBottom: 8 }}>{f.subs.map((x, i) => <Chip key={i} on onClick={() => setF({ ...f, subs: f.subs.filter((_, j) => j !== i) })}>{x} ✕</Chip>)}</div>}
    <div style={{ display: "flex", gap: 8 }}><input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} placeholder="예: 하이웍스" aria-label="체크리스트 항목" style={{ ...inp, flex: 1, minWidth: 0 }} /><TBtn onClick={addSub} disabled={!sub.trim()}>추가</TBtn></div>
    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 18 }}>저장하면 오늘 화면 고정업무에 바로 떠요 · 나만 보는 개인 고정업무예요</div>
  </Sheet>;
}
