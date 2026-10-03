// 업무OS v2 — 프로젝트 · 신제품
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, WD, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, canSetDue, riskOf, assignedByMe, workloadOf, onTimeOf,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, phaseOf } from "./launch.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";
import { useTask, useItemNotes, Thread, FileRow, openTask } from "./task.jsx";

const LS = (k) => "pour-os2-" + k;
const isLaunch = (p) => !!p && String(p.id || "").startsWith("lb_");   // 신제품 보드에서 온 것·v2에서 만든 신제품
const brandName = (D, id) => ((D.brands || []).find((b) => b.id === id) || (LAUNCH_BRANDS[id] || {})).name || "";

export function ProjCard({ p, D, cu, open, last, now }) {
  const key = ymd(now), s = projStat(p, D.tasks, key);
  const since = new Date(now - 7 * 864e5).toISOString();
  const mineT = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed);
  const lateN = mineT.filter((t) => { const r = riskOf(t, key); return r && (r.k === "late" || r.k === "blocked"); }).length;
  const news = feedOf(D, { projectId: p.id, taskIds: mineT.map((t) => t.id), sinceIso: since }).filter((x) => x.by !== cu.id);
  if (isLaunch(p)) return <Row title={p.title} tag={p.launchDate ? `출시 ${ddayLabel(s.n)}` : "출시일 미정"} tagTone={s.late ? "red" : null}
    sub={[brandName(D, p.brand) + (p.batch ? " " + p.batch : ""), p.launchDate ? `출시 ${md(p.launchDate)}` : "", `${s.pct}%`, `남은 항목 ${s.open}`].filter(Boolean).join(" · ")}
    sub2={[lateN ? `지난 항목 ${lateN}` : "", s.next ? `다음: ${s.next.title} (${nameOf(D.users, s.next.assigneeId) || "담당 없음"})` : ""].filter(Boolean).join(" · ") || null}
    onClick={() => open({ type: "project", id: p.id })} last={last} />;
  return <Row title={p.title} tag={s.n != null ? ddayLabel(s.n) : null} tagTone={s.late ? "red" : null}
    sub={[nameOf(D.users, p.assigneeId) ? `책임 ${nameOf(D.users, p.assigneeId)}` : "책임 없음", `${s.pct}%`, `열린 업무 ${s.open}`, lateN ? `지난 업무 ${lateN}` : ""].filter(Boolean).join(" · ")}
    sub2={[s.next ? `다음: ${s.next.title} (${nameOf(D.users, s.next.assigneeId) || "담당 없음"})` : "", news.length ? `새 소식 ${news.length} · ${ago(news[0].at, now)}` : ""].filter(Boolean).join(" · ") || null}
    onClick={() => open({ type: "project", id: p.id })} last={last} />;
}
export function ProjectsTab({ D, cu, open }) {
  const [scope, setScope] = useLocal(LS("pscope"), "mine"), [kind, setKind] = useLocal(LS("pkind"), "all"), [q, setQ] = useState(""), [more, setMore] = useState({});
  const now = new Date(), key = ymd(now);
  const openList = D.projects.filter(projOpen);
  const byKind = (a) => (kind === "launch" ? a.filter(isLaunch) : kind === "normal" ? a.filter((p) => !isLaunch(p)) : a);
  const mineAll = openList.filter((p) => projMine(p, cu.id, D.tasks));
  const list = byKind(scope === "mine" ? mineAll : openList);
  const qq = q.trim().replace(/\s/g, "").toLowerCase();
  const hit = qq ? openList.filter((p) => [p.title, nameOf(D.users, p.assigneeId), p.batch, ...D.tasks.filter((t) => t.projectId === p.id).map((t) => t.title)].join(" ").replace(/\s/g, "").toLowerCase().includes(qq)) : null;
  const G = projGroups(list, key);
  const groups = [["late", "마감 지남", true], ["month", "이번 달 마감", true], ["later", "그 뒤", true], ["none", kind === "launch" ? "출시일 미정" : "마감 없음", true], ["hold", "보류", false]];
  const doneN = D.projects.filter((p) => !projOpen(p)).length;
  const base = scope === "mine" ? mineAll : openList;
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>프로젝트</h1>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기 · 프로젝트·제품 이름, 책임자, 업무 제목" aria-label="프로젝트 찾기" style={inp} />
      {!hit && <Seg items={[["mine", `내 프로젝트 ${mineAll.length}`], ["all", `모든 프로젝트 ${openList.length}`]]} value={scope} onChange={setScope} />}
      {!hit && <div className="v2-chips">{[["all", "전체", base.length], ["launch", "신제품", base.filter(isLaunch).length], ["normal", "일반", base.filter((p) => !isLaunch(p)).length]].map(([k, l, n]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{l} {n}</Chip>)}</div>}
    </header>
    {hit ? <><Head>찾은 결과 {hit.length}</Head><Card>{hit.length === 0 ? <Empty>찾는 프로젝트가 없어요</Empty> : hit.map((p, i) => <ProjCard key={p.id} p={p} D={D} cu={cu} open={open} now={now} last={i === hit.length - 1} />)}</Card></>
      : groups.map(([k, l, openDefault]) => { const a = G[k]; if (!a.length) return null; const m = more[k], shown = openDefault ? (m ? a : a.slice(0, 5)) : (m ? a : []);
        return <div key={k}><Head red={k === "late"} right={!openDefault && <TBtn onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length} ▾`}</TBtn>}>{l} {a.length}</Head>
          {shown.length > 0 && <Card>{shown.map((p, i) => <ProjCard key={p.id} p={p} D={D} cu={cu} open={open} now={now} last={i === shown.length - 1 && !(openDefault && a.length > 5)} />)}
            {openDefault && a.length > 5 && <More onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length - 5}개 더 보기 ▾`}</More>}</Card>}</div>; })}
    {!hit && list.length === 0 && <Card style={{ marginTop: 14 }}><Empty>{scope === "mine" ? "내가 책임·담당이거나 업무를 맡은 프로젝트가 없어요" : "진행 중인 프로젝트가 없어요"}</Empty></Card>}
    {doneN > 0 && <Card style={{ marginTop: 14 }}><More onClick={() => open({ type: "doneProjects" })}>끝난 프로젝트 {doneN} ›</More></Card>}
    <div className="v2-fab"><Big onClick={() => open({ type: "newProject" })}>+ 새 프로젝트 · 신제품</Big></div>
  </>;
}
export function DoneProjectsSheet({ D, cu, open, onBack, onClose }) {
  const list = D.projects.filter((p) => !projOpen(p)).sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")));
  return <Sheet title={`끝난 프로젝트 ${list.length}`} onBack={onBack} onClose={onClose}><div style={{ height: 12 }} /><Card>{list.map((p, i) => <Row key={p.id} title={p.title} sub={[nameOf(D.users, p.assigneeId), p.dueDate ? `마감 ${md(p.dueDate)}` : ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "project", id: p.id })} last={i === list.length - 1} />)}</Card></Sheet>;
}
// 새 프로젝트 / 신제품 — 신제품은 출시일만 넣으면 항목 기한·담당이 자동으로 들어가고, 담당별 부담을 미리 보여준다
export function NewProjectSheet({ D, cu, A, open, back, onBack, onClose, setToast }) {
  const [kind, setKind] = useState("normal");
  const [title, setTitle] = useState(""), [lead, setLead] = useState(cu.id), [due, setDue] = useState(""), [brand, setBrand] = useState(""), [tasks, setTasks] = useState(["", "", ""]), [busy, setBusy] = useState(false), [batch, setBatch] = useState("");
  const ref = useAutoFocus();
  const brands = (D.brands || []).filter((b) => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  const launch = kind === "launch";
  const plan = useMemo(() => (launch && title.trim() && brand && due ? planNewLaunch({ name: title, brand, launchDate: due, batch, leadId: lead }, D, cu) : null), [launch, title, brand, due, batch, lead, D]);
  const ok = title.trim() && brand && (!launch || due) && !busy;
  const save = async () => { if (!ok) return; setBusy(true);
    const p = launch ? await A.createLaunch(plan) : await A.addProject({ title, assigneeId: lead, dueDate: due, brand, tasks });
    setBusy(false); if (p) { setToast({ text: launch ? `신제품을 만들었어요 · 항목 ${plan.tasks.length}개` : "프로젝트를 만들었어요" }); back(); open({ type: "project", id: p.id }); } };
  const pickBrand = (id) => { setBrand(id); if (launch) { const bm = userByName(D.users, (LAUNCH_BRANDS[id] || {}).bm); if (bm) setLead(bm.id); } };
  const now = new Date();
  return <Sheet title={launch ? "새 신제품" : "새 프로젝트"} onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!ok}>{launch ? (plan ? `만들기 · 항목 ${plan.tasks.length}개` : "만들기") : "만들기"}</Big>}>
    <div style={{ marginTop: 12 }}><Seg items={[["normal", "일반 프로젝트"], ["launch", "신제품 출시"]]} value={kind} onChange={setKind} /></div>
    <label className="v2-lab" htmlFor="v2-np">{launch ? "제품 이름" : "이름"}</label><input id="v2-np" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={launch ? "예: 2in1 목재용 페인트" : "예: 10월 그로홈 기획전"} style={inp} />
    <div className="v2-lab">브랜드</div><div className="v2-chips">{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => pickBrand(b.id)}>{b.name}</Chip>)}</div>
    <label className="v2-lab" htmlFor="v2-npd">{launch ? "출시일" : "마감"} {!launch && <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span>}</label><input id="v2-npd" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inp} />
    {launch && <><label className="v2-lab" htmlFor="v2-npb">차수 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 같이 출시하는 묶음)</span></label><input id="v2-npb" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="예: 데코라인 2차" style={inp} /></>}
    <div className="v2-lab">책임자</div><div className="v2-chips"><Chip on={lead === cu.id} onClick={() => setLead(cu.id)}>나</Chip>{lead !== cu.id && <Chip on>{nameOf(D.users, lead)}</Chip>}<select aria-label="책임자" className="v2-sel" value="" onChange={(e) => e.target.value && setLead(e.target.value)}><option value="">다른 사람 ▾</option>{activeUsers(D.users).filter((u) => u.id !== cu.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    {!launch && <><div className="v2-lab">첫 업무 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 나중에 더 넣을 수 있어요)</span></div>
      {tasks.map((v, i) => <input key={i} value={v} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`업무 ${i + 1}`} aria-label={`첫 업무 ${i + 1}`} style={{ ...inp, marginBottom: 6 }} />)}</>}
    {launch && <><Head>미리 보기</Head>
      {!plan ? <Card><Empty>제품 이름 · 브랜드 · 출시일을 넣으면 항목별 기한과 담당이 자동으로 채워져요</Empty></Card>
        : <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          <div>항목 {plan.tasks.length}개 · 기한은 출시일에서 거꾸로 계산 (주말이면 금요일)</div>
          {plan.squeezed && <div style={{ color: C.ink, fontWeight: 700 }}>출시까지 8주가 안 돼서, 남은 기간에 고르게 나눠 넣었어요.</div>}
          {LAUNCH_PHASES.map((ph) => { const a = plan.tasks.filter((t) => t.phase === ph.k); if (!a.length) return null; const ds = a.map((t) => t.dueDate).sort();
            return <div key={ph.k} style={{ color: C.sub }}>{ph.name} {a.length}개 · {md(ds[0])}{ds[0] !== ds[ds.length - 1] ? `~${md(ds[ds.length - 1])}` : ""}</div>; })}
          <div style={{ marginTop: 8, fontWeight: 800, color: C.ink }}>담당별 (새 항목 · 지금 열린 일)</div>
          {Object.entries(plan.byWho).sort((a, b) => b[1].length - a[1].length).map(([uid, a]) => { const w = workloadOf(D, uid, now);
            return <div key={uid} style={{ color: C.sub }}>{nameOf(D.users, uid) || "담당 없음"} · 새 {a.length}개 · 열린 {w.open}{w.late ? <b style={{ color: C.red }}> · 지난 일 {w.late}</b> : ""}</div>; })}
          <div style={{ marginTop: 8, color: C.mute, fontSize: 12.5 }}>만든 뒤 항목마다 담당·기한을 바꿀 수 있어요. 담당자 화면 '확인할 것'에 "신제품 · 항목 n개 맡김"으로 떠요.</div>
        </Card>}</>}
  </Sheet>;
}
// projectExtra: 관리자 앱이 넣는 덧붙임 (출시일 옮기기 미리 보기 · 기한 다시 나누기 등) — (p) => element
export function ProjectSheet({ D, cu, A, open, onBack, onClose, id, first, projectExtra }) {
  const p = D.projects.find((x) => x.id === id);
  const member = p && projMine(p, cu.id, D.tasks);
  const [tab, setTab] = useState(() => first || (!p || member ? "work" : "news"));   // 방금 만든 프로젝트는 업무부터
  const [doneList, setDoneList] = useState(null), [showDone, setShowDone] = useState(false), [nt, setNt] = useState(""), [nw, setNw] = useState(cu.id), [ndue, setNdue] = useState(""), [edit, setEdit] = useState(""), [now, setNow] = useState(""), [info, setInfo] = useState(false), [ld, setLd] = useState(""), [openPh, setOpenPh] = useState({});
  const notes = useItemNotes(D, projNoteId(id));
  useEffect(() => { A.recalc(id); }, [id]);   // 열 때 진척(%)을 실제 업무 수로 다시 계산 (다르면만 저장)
  if (!p) return <Sheet title="프로젝트" onBack={onBack} onClose={onClose}><Empty>이 프로젝트를 찾지 못했어요</Empty></Sheet>;
  const key = ymd(new Date()), s = projStat(p, D.tasks, key), launch = isLaunch(p), master = isMaster(cu), lead = p.assigneeId === cu.id || master;
  const live = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed);
  const openT = live.filter((t) => !isDone(t));
  const myNew = openT.filter((t) => isMine(t, cu.id) && reqOf(t) && !t.ackAt && t.status === "todo");
  const loadDone = () => { setShowDone(!showDone); if (doneList == null) fb.fetchWhere("tasks", ["projectId", "==", p.id]).then((a) => setDoneList(a.filter((t) => isDone(t) && !t.isFixed))).catch((e) => { console.error(e); setDoneList([]); }); };
  const doneAll = doneList || live.filter(isDone);
  const top = (a) => a.filter((t) => !t.parentId || !a.some((x) => x.id === t.parentId));
  const kidsOf = (pid, a) => a.filter((t) => t.parentId === pid);
  const groups = launch ? LAUNCH_PHASES.map((ph) => [ph.k, ph.name, (t) => t.phase === ph.k]).concat([["etc", "기타", (t) => !t.phase]])
    : [["inprogress", "진행 중", (t) => t.status === "inprogress"], ["todo", "할 일", (t) => (t.status || "todo") === "todo"], ["review", "확인 대기", (t) => t.status === "review"], ["hold", "보류", (t) => t.status === "hold"]];
  const addT = () => { if (!nt.trim()) return; A.addTask({ title: nt, projectId: p.id, assigneeId: nw, dueDate: ndue || (nw !== cu.id ? addDays(key, 3) : ""), noReview: nw === cu.id }); setNt(""); };
  const tids = [...new Set([...live, ...(doneList || [])].map((t) => t.id))];
  const feed = feedOf({ ...D, notes: [...D.notes, ...notes.filter((n) => !D.notes.some((m) => m.id === n.id))] }, { projectId: p.id, taskIds: tids });
  const tTitle = (tid) => ((D.tasks.find((t) => t.id === tid) || (doneList || []).find((t) => t.id === tid)) || {}).title;
  const files = [...live, ...(doneList || [])].flatMap((t) => (t.attachments || []).map((f) => ({ ...f, where: t.title })))
    .concat(D.notes.filter((n) => { const [k, ...r] = String(n.itemId).split(":"); const ref = r.join(":"); return (k === "proj" && ref === p.id) || (k === "task" && tids.includes(ref)); }).flatMap((n) => (n.files || []).map((f) => ({ ...f, byName: n.byName, uploadedAt: f.uploadedAt || n.at, where: "댓글" }))))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  const ncount = (t) => D.notes.filter((n) => n.itemId === taskNoteId(t.id)).length;
  const TRow = ({ t, indent, last }) => { const r = riskOf(t, key);
    return <div style={{ paddingLeft: indent ? 18 : 0, background: "#fff" }}><Row dim={isDone(t)} tag={r ? r.label : null} tagTone={r && r.red ? "red" : null} title={t.title}
      sub={[(nameOf(D.users, t.assigneeId) || t.ownerText || "담당 없음") + (t.ownerAuto ? "(기본)" : ""), dueOf(t) ? md(dueOf(t)) + (isDone(t) || r ? "" : " · " + ddayLabel(ddays(dueOf(t), key))) : "기한 미정", ncount(t) ? `댓글 ${ncount(t)}` : ""].filter(Boolean).join(" · ")}
      onClick={() => open({ type: "task", id: t.id })} right={isMine(t, cu.id) && t.status !== "review" ? <Act on={isDone(t)} onClick={() => (isDone(t) ? A.reopen(t) : A.finish(t))}>{isDone(t) ? "✓" : "끝냄"}</Act> : null} last={last} /></div>; };
  return <Sheet title={launch ? "신제품" : "프로젝트"} onBack={onBack} onClose={onClose}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 4px", lineHeight: 1.35, wordBreak: "keep-all" }}>{p.title}</h2>
    <div style={{ fontSize: 13.5, color: C.sub }}>{launch && <>{brandName(D, p.brand)}{p.batch ? " " + p.batch : ""} · </>}책임 {nameOf(D.users, p.assigneeId) || "없음"} · {p.dueDate ? <span style={{ color: s.late ? C.red : C.sub, fontWeight: s.late ? 800 : 400 }}>{launch ? "출시" : "마감"} {md(p.dueDate)} {ddayLabel(s.n)}</span> : launch ? "출시일 미정" : "마감 없음"} · {s.pct}% · 남은 {s.open}</div>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, margin: "10px 0 0", overflow: "hidden" }}><div style={{ width: s.pct + "%", height: "100%", background: C.navy }} /></div>
    {projectExtra && projectExtra(p)}
    {myNew.length > 0 && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: C.soft, border: "1px solid #D7DDEE", fontSize: 14, color: C.text }}>
      <b>나에게 온 항목 {myNew.length}개</b> · 기한을 훑어보고 받아 주세요. 안 맞는 기한은 항목을 열어 '기한 조정 요청'을 해요.
      <div style={{ marginTop: 8 }}><Act onClick={() => A.ackMany(myNew)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>모두 받았어요</Act></div></div>}
    {launch && lead && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>출시일</span><input type="date" aria-label="출시일" value={ld || p.launchDate || ""} onChange={(e) => setLd(e.target.value)} className="v2-sel" />
      {ld && ld !== p.launchDate && <Act onClick={() => { A.setLaunchDate(p, ld); setLd(""); }} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>바꾸기 · 자동 기한 같이 이동</Act>}</div>}

    <Head right={edit !== "now" && <TBtn onClick={() => { setNow((p.now && p.now.text) || ""); setEdit("now"); }}>{p.now && p.now.text ? "고치기" : "적기"}</TBtn>}>지금 상황</Head>
    {edit === "now" ? <div><textarea value={now} onChange={(e) => setNow(e.target.value)} rows={3} placeholder={"목표: 무엇을 하려는지\n지금: 어디까지 왔는지"} aria-label="지금 상황" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setEdit("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={() => { A.patchProject(p, { now: { text: now.trim(), by: cu.id, byName: cu.name, at: new Date().toISOString() } }, "지금 상황 고침", (p.now && p.now.text) || ""); setEdit(""); }} style={{ flex: 1, height: 44 }}>저장</Big></div></div>
      : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: p.now && p.now.text ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.now && p.now.text ? <Linked text={p.now.text} /> : "처음 보는 사람이 바로 알 수 있게 목표와 지금 상황을 두 줄로 적어 주세요"}</div>
        {s.next && <div style={{ marginTop: 8, fontSize: 13.5, color: C.ink, fontWeight: 700 }}>다음 할 일: {s.next.title} ({nameOf(D.users, s.next.assigneeId) || "담당 없음"})</div>}
        {p.now && p.now.at && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>마지막 수정 {p.now.byName} · {ago(p.now.at)}</div>}</Card>}

    <div style={{ margin: "18px 0 4px" }}><Seg items={[["work", `${launch ? "항목" : "업무"} ${openT.length}`], ["news", "소식"], ["files", `자료 ${files.length}`]]} value={tab} onChange={setTab} /></div>
    {tab === "work" && <>
      <Card style={{ marginTop: 10 }}><div style={{ display: "flex", gap: 6, padding: 10, flexWrap: "wrap" }}>
        <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addT(); }} placeholder="+ 업무 추가 (Enter로 계속)" aria-label="업무 추가" style={{ ...inp, flex: "1 1 180px", padding: "10px 12px", fontSize: 14 }} />
        <select aria-label="담당" value={nw} onChange={(e) => setNw(e.target.value)} className="v2-sel">{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.id === cu.id ? "나" : u.name}</option>)}</select>
        <input type="date" aria-label="기한" value={ndue} onChange={(e) => setNdue(e.target.value)} className="v2-sel" />
        <Act onClick={addT}>추가</Act></div>
        {nw !== cu.id && !ndue && <div style={{ padding: "0 12px 10px", fontSize: 12.5, color: C.sub }}>기한을 안 고르면 3일 뒤({md(addDays(key, 3))})로 맡겨요</div>}</Card>
      {(() => { let firstOpen = true; return groups.map(([k, l, f]) => { const a = openT.filter(f); if (!a.length) return null; const tops = top(a).sort((x, y) => String(dueOf(x) || "9").localeCompare(String(dueOf(y) || "9")));
        // 신제품: 지금 단계(처음 남은 단계)와 급한 항목이 있는 단계만 펼침 — 한 번에 볼 것만
        const hot = a.some((t) => { const r = riskOf(t, key); return r && (r.red || r.k === "start" || r.k === "today"); });
        const shown = !launch || openPh[k] != null ? (launch ? openPh[k] : true) : firstOpen || hot; firstOpen = false;
        return <div key={k}><Head red={launch && hot} right={launch && <TBtn onClick={() => setOpenPh({ ...openPh, [k]: !shown })}>{shown ? "접기 ▴" : "펼치기 ▾"}</TBtn>}>{l} {a.length}{launch && hot ? " · 급함" : ""}</Head>
          {shown && <Card>{tops.map((t, i) => <div key={t.id}><TRow t={t} last={i === tops.length - 1 && !kidsOf(t.id, a).length} />{kidsOf(t.id, a).map((kk) => <TRow key={kk.id} t={kk} indent />)}</div>)}</Card>}</div>; }); })()}
      {openT.length === 0 && <Card style={{ marginTop: 10 }}><Empty>열린 업무가 없어요</Empty></Card>}
      <Card style={{ marginTop: 14 }}><More onClick={loadDone}>{showDone ? "끝낸 업무 접기 ▴" : `끝낸 업무 ${doneList ? doneList.length : "보기"} ▾`}</More>
        {showDone && (doneList == null ? <Empty>불러오는 중…</Empty> : doneAll.length === 0 ? <Empty>끝낸 업무가 없어요</Empty> : doneAll.slice().sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || ""))).map((t, i) => <TRow key={t.id} t={t} last={i === doneAll.length - 1} />))}</Card>
    </>}
    {tab === "news" && <>
      <Head>프로젝트 대화</Head>
      <Thread D={D} cu={cu} A={A} notes={notes} itemId={projNoteId(p.id)} ctx={{ projectId: p.id }} />
      <Head>업무 소식</Head>
      <Card>{feed.filter((x) => x.itemId !== projNoteId(p.id)).slice(0, 30).map((x, i, arr) => <Row key={x.id} title={x.type === "note" ? x.text : x.text || LOG_L[x.action]} sub={`${x.byName || ""} · ${x.type === "note" ? "댓글" : LOG_L[x.action] || "기록"}${x.type === "note" ? " · " + (tTitle(String(x.itemId).slice(5)) || "") : ""} · ${ago(x.at)}`} onClick={() => { const tid = x.type === "note" ? String(x.itemId).slice(5) : x.targetId; if (tid && x.col !== "projects") open({ type: "task", id: tid }); }} last={i === arr.length - 1} />)}
        {feed.filter((x) => x.itemId !== projNoteId(p.id)).length === 0 && <Empty>최근 소식이 없어요</Empty>}</Card>
    </>}
    {tab === "files" && <Card style={{ marginTop: 10 }}>{files.length === 0 ? <Empty>모인 자료가 없어요. 업무나 댓글에 파일을 올리면 여기 모여요.</Empty> : files.map((f, i) => <FileRow key={i} f={f} last={i === files.length - 1} />)}</Card>}

    <Card style={{ marginTop: 18 }}><More onClick={() => setInfo(!info)}>{info ? "정보 접기 ▴" : "정보 ▾"}</More>
      {info && <div style={{ padding: "4px 14px 14px", fontSize: 14, color: C.text, lineHeight: 1.9 }}>
        <div>책임자 <select aria-label="책임자 바꾸기" className="v2-sel" value={p.assigneeId || ""} onChange={(e) => A.patchProject(p, { assigneeId: e.target.value }, `책임자 → ${nameOf(D.users, e.target.value)}`, p.assigneeId || "")}><option value="">없음</option>{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div>함께 하는 사람 {(p.collaboratorIds || []).map((u) => nameOf(D.users, u)).filter(Boolean).join(", ") || "없음"}</div>
        {!launch && <div>마감 <input type="date" aria-label="마감 바꾸기" className="v2-sel" defaultValue={p.dueDate || ""} onBlur={(e) => { if (e.target.value !== (p.dueDate || "")) A.patchProject(p, { dueDate: e.target.value }, `마감 ${md(e.target.value) || "없음"}`, p.dueDate || ""); }} /></div>}
        <div>브랜드 {brandName(D, p.brand) || "없음"} · 분류 {p.group || "-"}</div>
        {p.memo && <div style={{ whiteSpace: "pre-wrap", color: C.sub }}>예전 메모: {p.memo}</div>}
        {projOpen(p) && openT.length === 0 && lead && <Big onClick={() => A.patchProject(p, { status: "completed", progress: 100 }, "프로젝트 완료", p.status)} style={{ marginTop: 10 }}>프로젝트 완료</Big>}
      </div>}</Card>
  </Sheet>;
}
