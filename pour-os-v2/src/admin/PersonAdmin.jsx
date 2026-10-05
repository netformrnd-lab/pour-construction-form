// 관리자 · 사람 보기 (넓힌 판) — 실사용판 내용(지금 하는 일 · 다음 할 일 · 2주 띠 · 책임 프로젝트 · 최근 대화)에 더해
// 열린 · 지남 · 곧 마감인데 시작 전 · 진행 중 · 최근 30일 기한 지킴 % · 기한 없음 · 이 사람을 기다리는 뒤 일 · 주 한도 · PIN 초기화 · [이 사람에게 맡기기]
// 새로 저장하는 개인 평가 값은 없다 (있는 데이터에서 계산만). 주 한도(users.weekCap)·PIN 초기화만 users 문서에 씀
import { useState } from "react";
import * as fb from "../fb.js";
import { pinHash } from "../sha.js";
import { ymd, ddays, ddayLabel, md, ago, hm, isDone, isOneOff, isMine, ownersOf, dueOf, nameOf, riskOf, projOpen, personHealth, onTimeOf, fxIsMine, fxDueOn, fxMeDone, fxLabel, fxTime, TEAMS, teamOf, DEFAULT_TEAMS } from "../model.js";
import { nextsOf } from "../turn.js";
import { C, Big, TBtn, Act, Head, Card, Row, Empty, Sheet, Ask, More, inp, Chip } from "../ui.jsx";
import { Lv, pName } from "./common.jsx";
import { PhoneEdit } from "../smsui.jsx";

export function PersonAdmin({ D, cu, A, idx, open, onBack, onClose, id, setToast }) {
  const u = (D.users || []).find((x) => x.id === id);
  const [ask, setAsk] = useState(false), [code, setCode] = useState(""), [all, setAll] = useState(false), [wOpen, setWOpen] = useState(false), [cap, setCap] = useState(""), [busy, setBusy] = useState(false), [wn, setWn] = useState(40);
  if (!u) return <Sheet title="사람" kind="사람" onBack={onBack} onClose={onClose}><Empty>찾지 못했어요</Empty></Sheet>;
  const now = new Date(), key = ymd(now), h = personHealth(D, u.id, now), ot = onTimeOf(D, u.id, now);
  const open1 = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, u.id));
  const doing = open1.filter((t) => t.status === "inprogress");
  const todoAll = open1.filter((t) => t.status !== "inprogress").sort((a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"))), next = all ? todoAll : todoAll.slice(0, 5);
  const temp = open1.filter((t) => idx.temp.has(t.id)).length;
  // 이 사람을 기다리는 뒤 일: 이 사람의 열린 일 다음 차례인 다른 사람의 일 (이 사람이 늦으면 막히는 일)
  const wm = new Map(); open1.forEach((t) => nextsOf(t, idx).forEach((n) => { if (!isDone(n) && !n.isFixed && !ownersOf(n).includes(u.id) && !wm.has(n.id)) wm.set(n.id, { n, t }); }));
  const waiting = [...wm.values()].sort((a, b) => String(dueOf(a.n) || "9").localeCompare(String(dueOf(b.n) || "9")));
  const waitWho = [...new Set(waiting.map((x) => ownersOf(x.n)[0]).filter(Boolean))].map((x) => nameOf(D.users, x)).filter(Boolean);
  const projs = D.projects.filter((p) => projOpen(p) && p.assigneeId === u.id);
  const fx = D.tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, u.id) && fxDueOn(t, key));
  const talk = D.notes.filter((n) => n.by === u.id && !n.deleted).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  const curCap = Number(u.weekCap) || 15;
  const saveCap = async () => { const v = Math.round(Number(cap)); if (!v || v < 1 || v > 99) { setToast({ text: "1~99 사이 숫자로 넣어 주세요" }); return; }
    setBusy(true);
    try { await fb.patch("users", u._doc || u.id, { weekCap: v }); A.log("edit", { col: "users", targetId: u.id, label: `${u.name} · 주 한도 ${curCap} → ${v}`, prev: curCap }); setToast({ text: `${u.name}님 주 한도를 ${v}건으로 바꿨어요` }); setCap(""); }
    catch (e) { console.error("[v2 관리] 주 한도 저장 실패:", e); setToast({ text: "주 한도 저장 실패 · 인터넷 연결을 확인해 주세요" }); }
    setBusy(false); };
  // 시작 코드: 4자리 무작위 → 해시만 저장(users.pinInvite) · 화면에 한 번만 보여 줌. 코드가 있으면 PIN을 처음 정할 때 꼭 넣어야 함 (이름만 골라 남의 PIN을 먼저 정하는 것 막기)
  const makeCode = async (reset) => { const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0"), at = new Date().toISOString();
    try { await fb.patch("users", u._doc || u.id, { pinInvite: pinHash(u.id, "inv:" + c), pinInviteAt: at, pinInviteBy: cu.id, ...(reset ? { pinHash: null, pinResetBy: cu.id, pinResetAt: at } : {}) });
      A.log("edit", { col: "users", targetId: u.id, label: `${u.name} · ${reset ? "PIN 초기화 + " : ""}시작 코드 만듦` }); setCode(c); setToast({ text: `${reset ? "PIN 초기화 · " : ""}시작 코드 ${c} · ${u.name}님에게만 알려 주세요` }); }
    catch (e) { console.error("[v2 관리] 시작 코드 저장 실패:", e); setToast({ text: "저장 실패 · 인터넷 연결을 확인해 주세요" }); } };
  const L = ({ a, empty, render, more }) => <Card>{a.length === 0 ? <Empty>{empty}</Empty> : a.map((x, i) => render(x, i === a.length - 1 && !more))}{more || null}</Card>;
  const stat = [
    ["열린", h.open], ["지남", h.late, h.late > 0], ["곧 마감인데 시작 전", h.start], ["진행 중", h.doing, false, h.doing >= 6],
    ["기한 지킴", ot.pct != null ? `${ot.pct}%` : "-"], ["기한 없음", h.noDue], ["기다리는 뒤 일", waiting.length],
  ];
  return <Sheet title={u.name} kind="사람" path="관리자 · 사람" onBack={onBack} onClose={onClose} foot={<Big onClick={() => open({ type: "add", preset: { assigneeId: u.id } })}>{u.name}님에게 맡기기</Big>}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}><Lv v={h.level} /><span style={{ fontSize: 13, color: C.sub }}>{u.master || u.role === "lead" ? "마스터 · " : ""}{temp ? `임시 담당 ${temp}건 포함 · ` : ""}{ot.n ? `최근 30일 기한 있는 일 ${ot.n}건 중 ${ot.ok}건 지킴${ot.miss ? ` (아직 못 끝낸 ${ot.miss}건 포함)` : ""}` : "최근 30일 기한 있는 일 없음"}</span></div>
    <div className="a-stat" role="list">{stat.map(([l, v, red, bold]) => <div key={l} role="listitem"><b style={{ color: red ? C.red : C.ink, fontWeight: bold ? 900 : 800 }}>{v}</b><span>{l}</span></div>)}</div>

    <Head>앞으로 2주 마감</Head>
    <div className="v2-strip" aria-label="2주 일정">{h.week.slice(0, 14).map((d) => <div key={d.date} className={"v2-day" + (d.wd === "토" || d.wd === "일" ? " we" : "")} style={{ cursor: "default" }}><span>{d.date === key ? "오늘" : md(d.date)}</span><span>{d.wd}</span><b className={d.list.length >= 5 ? "hv" : ""} style={d.list.length > 8 ? { color: "#fff", background: C.red, borderRadius: 6, padding: "0 5px" } : null}>{d.list.length ? d.list.length + "건" : "-"}</b></div>)}</div>
    <div style={{ fontSize: 12.5, color: C.sub, margin: "6px 2px 0" }}>4주 주별 마감 {h.weeks.map((n, i) => <b key={i} style={{ color: n > curCap ? C.red : C.ink, marginLeft: 6 }}>{n}</b>)} · 주 한도 {curCap}</div>

    <Head right={waiting.length > 0 && <TBtn onClick={() => setWOpen(!wOpen)}>{wOpen ? "접기 ▴" : "보기 ▾"}</TBtn>}>이 사람을 기다리는 뒤 일 {waiting.length}</Head>
    {waiting.length === 0 ? <Card><Empty>이 사람 다음 차례로 기다리는 다른 사람 일이 없어요</Empty></Card>
      : !wOpen ? <Card style={{ padding: "10px 14px", fontSize: 13.5, color: C.text }}>{waitWho.slice(0, 5).join(" · ")}{waitWho.length > 5 ? ` 외 ${waitWho.length - 5}명` : ""} · 이 사람이 늦으면 같이 밀려요</Card>
      : <L a={waiting.slice(0, wn)} empty="" more={waiting.length > wn && <More onClick={() => setWn(wn + 40)}>{waiting.length - wn}개 더 ▾</More>}
        render={(x, last) => <Row key={x.n.id} title={x.n.title} sub={[nameOf(D.users, ownersOf(x.n)[0]) || "담당 없음", dueOf(x.n) ? md(dueOf(x.n)) : "기한 없음", pName(D, x.n.projectId), `앞 일 ${x.t.title}${dueOf(x.t) ? ` (${md(dueOf(x.t))})` : ""}`].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: x.n.id })} last={last} />} />}

    <Head>지금 하는 일 {doing.length}</Head><L a={doing} empty="진행 중인 일이 없어요" render={(t, last) => <Row key={t.id} title={t.title} sub={[dueOf(t) ? `${md(dueOf(t))} · ${ddayLabel(ddays(dueOf(t), key))}` : "기한 없음", pName(D, t.projectId)].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: t.id })} last={last} />} />
    <Head right={todoAll.length > 5 && <TBtn onClick={() => setAll(!all)}>{all ? "접기 ▴" : `모두 ${todoAll.length} ▾`}</TBtn>}>다음 할 일 {todoAll.length}</Head>
    <L a={next} empty="남은 할 일이 없어요" render={(t, last) => { const r = riskOf(t, key); return <Row key={t.id} tag={r ? r.label : idx.temp.has(t.id) ? "임시" : null} tagTone={r && r.red ? "red" : null} title={t.title} sub={[dueOf(t) ? md(dueOf(t)) : "기한 없음", ((D.projects.find((p) => p.id === t.projectId) || {}).title) || ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: t.id })} last={last} />; }} />
    <Head>책임 프로젝트 {projs.length}</Head><L a={projs} empty="책임 프로젝트가 없어요" render={(p, last) => <Row key={p.id} title={p.title} sub={(p.now && p.now.text ? p.now.text.split("\n")[0] : "지금 상황 미작성")} onClick={() => open({ type: "project", id: p.id })} last={last} />} />
    <Head>오늘 고정업무 {fx.filter((t) => fxMeDone(t, u.id, key)).length}/{fx.length}</Head><L a={fx} empty="오늘 고정업무가 없어요" render={(t, last) => <Row key={t.id} title={fxLabel(t, u.id)} sub={fxMeDone(t, u.id, key) ? `✓ ${hm(t.doneAtBy && t.doneAtBy[u.id])}` : `아직${fxTime(t, u.id) ? ` · 예정 ${fxTime(t, u.id)}` : ""}`} onClick={() => open({ type: "fixed", id: t.id })} last={last} />} />
    <Head>최근 대화</Head><L a={talk} empty="최근 30일 대화가 없어요" render={(n, last) => <Row key={n.id} title={n.text} sub={ago(n.at)} onClick={() => { const [k, ...r] = String(n.itemId).split(":"); if (k === "task") open({ type: "task", id: r.join(":"), focus: "talk" }); else if (k === "proj") open({ type: "project", id: r.join(":"), first: "news" }); }} last={last} />} />

    <Head>휴대폰 번호 (문자 알림)</Head>
    <PhoneEdit u={u} A={A} setToast={setToast} />
    <Head>팀</Head>
    <Card style={{ padding: "12px 14px" }}>
      <div className="v2-chips">{TEAMS.map((t) => <Chip key={t} on={teamOf(u) === t} onClick={async () => { if (teamOf(u) === t) return; const prev = teamOf(u);
        try { await fb.patch("users", u._doc || u.id, { team: t }); A.log("edit", { col: "users", targetId: u.id, label: `${u.name} · 팀 ${prev || "없음"} → ${t}`, prev }); setToast({ text: `${u.name}님 팀을 ${t}으로 바꿨어요` }); }
        catch (e) { console.error("[v2] 팀 저장 실패:", e); setToast({ text: "팀 저장 실패 · 인터넷 연결을 확인해 주세요" }); } }}>{t}</Chip>)}</div>
      <div style={{ fontSize: 12.5, color: C.mute, marginTop: 8, lineHeight: 1.6 }}>{u.team ? "직접 정한 팀" : DEFAULT_TEAMS[String(u.name || "").replace(/\s/g, "")] ? "기본값(조직도)" : "아직 없음"} · 프로젝트 팀은 책임자 팀으로 자동으로 정해져요</div>
    </Card>
    <Head>주 한도</Head>
    <Card style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>한 주 마감이 <b>{curCap}건</b>을 넘으면 사람 표에서 숫자가 빨갛게 보여요{u.weekCap ? "" : " (기본값)"}.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <input type="number" inputMode="numeric" min={1} max={99} value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder={String(curCap)} aria-label="주 한도" style={{ ...inp, width: 96, padding: "9px 12px" }} />
        <span style={{ fontSize: 13.5, color: C.sub }}>건</span><span style={{ flex: 1 }} />
        <Act onClick={saveCap} style={cap && !busy ? { background: C.navy, color: "#fff", borderColor: C.navy } : { opacity: 0.5 }}>{busy ? "저장 중" : "한도 저장"}</Act>
      </div>
    </Card>
    <Head>휴가 · 퇴사</Head>
    <Card style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>맡은 업무·고정업무·책임 프로젝트를 한 사람에게 한 번에 넘겨요</div>
      <Act onClick={() => open({ type: "handOver", id: u.id })}>일 넘기기 ›</Act></Card>
    {u.id !== cu.id && <>
      <Head>PIN</Head>
      <Card style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{u.pinHash ? `PIN 있음${u.pinSetAt ? ` · ${md(String(u.pinSetAt).slice(0, 10))}에 정함${u.pinByCode ? " (시작 코드로)" : ""}` : ""}` : u.pinInvite ? "PIN 없음 · 시작 코드를 만들어 두었어요 (코드가 있어야 PIN을 정할 수 있어요)" : "PIN 없음 · 아무나 이 이름으로 PIN을 먼저 정할 수 있어요. 시작 코드를 만들어 본인에게만 알려 주세요"}</div>
        {code ? <div role="status" style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.6 }}>시작 코드 <b style={{ fontSize: 22, letterSpacing: 6, fontVariantNumeric: "tabular-nums" }}>{code}</b><br /><span style={{ fontSize: 12.5, color: C.sub }}>{u.name}님에게만 알려 주세요 · 이 화면을 닫으면 다시 볼 수 없어요</span></div>
          : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!u.pinHash && <Act onClick={() => makeCode(false)}>{u.pinInvite ? "시작 코드 다시 만들기" : "시작 코드 만들기"}</Act>}
            {u.pinHash && <Act onClick={() => setAsk(true)}>PIN 초기화</Act>}</div>}
      </Card></>}
    {ask && <Ask title="PIN 초기화" body={`${u.name}님의 v2 PIN을 지우고 시작 코드를 새로 만들까요?\n본인이 시작 코드로 PIN을 다시 정해요. (버전1 PIN은 그대로예요)`} yes="초기화" onNo={() => setAsk(false)} onYes={() => { setAsk(false); makeCode(true); }} />}
  </Sheet>;
}
