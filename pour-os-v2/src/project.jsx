// 업무OS v2 — 프로젝트 (신제품·일반·흐름을 한 목록 · 한 모양으로)
// 목록 줄: 출시/마감 D-n · '지금: 누가 · 무슨 일' · '다음: 누가 · 무슨 일' → 앞사람이 끝나면 누구 차례인지 바로 보임
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, ago, hm, isMaster, activeUsers, nameOf, isDone, isMine, ownersOf, dueOf,
  projOpen, projMine, projStat, projGroups, projWhen, feedOf, taskNoteId, projNoteId, LOG_L, reqOf, riskOf, workloadOf, PROJ_CATS, catName, projCat, guessCat,
  IMP, impOf, impName, isHoldP, projStLabel, projForecast,
} from "./model.js";
import { LAUNCH_PHASES, LAUNCH_BRANDS, planNewLaunch, userByName, launchPct } from "./launch.js";
import { turnIndex, turnOf, nowNext, predLine } from "./turn.js";
import { phaseStates, previewLaunchMove } from "./views.js";
import { flowList, planFlow, flowOwners } from "./flow.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";
import { useItemNotes, Thread, FileRow } from "./task.jsx";
import { MindMap } from "./mindmap.jsx";
import { ro } from "./pick.jsx";
import { ProjEndAsk, ResumeAsk } from "./hold.jsx";

const LS = (k) => "pour-os2-" + k;
const isLaunch = (p) => !!p && String(p.id || "").startsWith("lb_");   // 신제품 보드에서 온 것·v2에서 만든 신제품
const brandName = (D, id) => ((D.brands || []).find((b) => b.id === id) || (LAUNCH_BRANDS[id] || {})).name || "";
const PH_SHORT = { plan: "기획", sample: "샘플", pack: "패킹", content: "콘텐츠", channel: "채널", stock: "입고", promo: "홍보" };
const dateOf = (p) => String(p.dueDate || p.launchDate || "").slice(0, 10);
const whoOf = (D, t) => nameOf(D.users, ownersOf(t)[0]) || t.ownerText || "담당 없음";
// 꼬리표·머리 날짜 (model.js projWhen): 출시일이 지난 신제품은 '출시 후 n일' · 빨강은 늦은 항목·막힘이 있을 때만
const whenOf = (p, tasks, key) => projWhen(p, tasks, key);
const stWord = (t) => (t.blocked ? "막힘" : t.status === "inprogress" ? "진행 중" : t.status === "review" ? "확인 중" : t.status === "hold" ? "보류" : "할 일");

// 목록 한 줄 (신제품·일반 같은 모양)
export function ProjCard({ p, D, cu, open, last, now, idx, tag2 }) {
  const key = ymd(now), launch = isLaunch(p), date = dateOf(p), w = whenOf(p, D.tasks, key);
  const nn = nowNext(p, D, idx, key);
  const ts = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed), openN = ts.filter((t) => !isDone(t)).length;
  const news = nn.next ? [] : feedOf(D, { projectId: p.id, taskIds: ts.map((t) => t.id), sinceIso: new Date(now - 7 * 864e5).toISOString() }).filter((x) => x.by !== cu.id);
  const nowL = nn.now ? `지금: ${whoOf(D, nn.now)} · ${nn.now.title}${nn.others ? ` 외 ${nn.others}명` : ""}${dueOf(nn.now) ? " · " + md(dueOf(nn.now)) : ""}` : openN ? `열린 일 ${openN} · 지금 하는 일 없음` : "열린 일 없음";
  const pre = [launch ? brandName(D, p.brand) + (p.batch ? " " + p.batch : "") : "", tag2].filter(Boolean).join(" · ");
  return <Row title={p.title} tag={w.launched ? `출시 후 ${w.after != null ? w.after : -ddays(p.launchDate, key)}일` : date ? (launch ? "출시 " : "") + ddayLabel(w.n) : "날짜 없음"} tagTone={w.late ? "red" : null}
    sub={[pre, nowL].filter(Boolean).join(" · ")}
    sub2={nn.next ? `다음: ${whoOf(D, nn.next)} · ${nn.next.title}` : news.length ? `새 소식 ${news.length} · ${ago(news[0].at, now)}` : null}
    onClick={() => open({ type: "project", id: p.id })} last={last} />;
}

export function ProjectsTab({ D, cu, open, idx: idx0 }) {
  const idx = useMemo(() => idx0 || turnIndex(D), [idx0, D]);
  const [cat, setCat] = useLocal(LS("pcat"), "all");   // 카테고리 (버전1 과 같은 분류: 신제품 출시 · 프로모션·마케팅 · 공지사항 …)
  const [scope, setScope] = useLocal(LS("pscope"), "mine"), [q, setQ] = useState(""), [more, setMore] = useState({});
  const now = new Date(), key = ymd(now);
  const openList = D.projects.filter(projOpen).map((p) => (p.dueDate || !p.launchDate ? p : { ...p, dueDate: p.launchDate }));
  const mineAll = openList.filter((p) => projMine(p, cu.id, D.tasks));
  const scoped = scope === "mine" ? mineAll : openList;
  const inCat = (p, k) => (k === "all" ? true : k === "none" ? !projCat(p) : projCat(p) === k);
  const catN = (k, a = scoped) => a.filter((p) => inCat(p, k)).length;
  const cats = [["all", "전체"], ...PROJ_CATS.filter(([k]) => catN(k, openList)), ...(catN("none", openList) ? [["none", "미분류"]] : [])];
  const cat1 = cats.some(([k]) => k === cat) ? cat : "all";
  const list = scoped.filter((p) => inCat(p, cat1));
  const elseN = scope === "mine" && cat1 !== "all" ? catN(cat1, openList) - list.length : 0;   // 내 프로젝트엔 없지만 다른 사람 프로젝트에 있는 수
  const qq = q.trim().replace(/\s/g, "").toLowerCase();
  const hit = qq ? openList.filter((p) => [p.title, nameOf(D.users, p.assigneeId), p.batch, brandName(D, p.brand), ...D.tasks.filter((t) => t.projectId === p.id).map((t) => t.title)].join(" ").replace(/\s/g, "").toLowerCase().includes(qq)) : null;
  const G = projGroups(list, key, D.tasks);   // 출시한 신제품은 남은 항목 기한으로 묶음
  const groups = [["late", "마감 지남", true], ["week", "7일 안", true], ["month", "이번 달", true], ["later", "그 뒤", true], ["none", "날짜 없음", true], ["hold", "보류", false]];
  const doneN = D.projects.filter((p) => !projOpen(p)).length;
  const card = (p, last) => <ProjCard key={p.id} p={p} D={D} cu={cu} open={open} now={now} idx={idx} last={last} />;
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>프로젝트</h1>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기 · 프로젝트·제품 이름, 책임자, 업무 제목" aria-label="프로젝트 찾기" style={inp} />
      {!hit && <Seg items={[["mine", `내 프로젝트 ${mineAll.length}`], ["all", `모든 프로젝트 ${openList.length}`]]} value={scope} onChange={setScope} />}
      {!hit && <div className="v2-chips v2-catchips" role="group" aria-label="카테고리">{cats.map(([k, l]) => <Chip key={k} on={cat1 === k} onClick={() => setCat(k)}>{l} {catN(k)}</Chip>)}</div>}
      {!hit && elseN > 0 && <div className="v2-cathint">{catName(cat1) || "미분류"} 프로젝트가 다른 사람 프로젝트에 {elseN}개 더 있어요 <TBtn onClick={() => setScope("all")}>모든 프로젝트 보기 ›</TBtn></div>}
    </header>
    {hit ? <><Head>찾은 결과 {hit.length}</Head><Card>{hit.length === 0 ? <Empty>찾는 프로젝트가 없어요</Empty> : hit.map((p, i) => card(p, i === hit.length - 1))}</Card></>
      : groups.map(([k, l, openDefault]) => { const a = G[k]; if (!a.length) return null; const m = more[k], shown = openDefault ? (m ? a : a.slice(0, 5)) : (m ? a : []);
        return <div key={k}><Head red={k === "late"} right={!openDefault && <TBtn onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length} ▾`}</TBtn>}>{l} {a.length}</Head>
          {shown.length > 0 && <Card>{shown.map((p, i) => card(p, i === shown.length - 1 && !(openDefault && a.length > 5)))}
            {openDefault && a.length > 5 && <More onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length - 5}개 더 보기 ▾`}</More>}</Card>}</div>; })}
    {!hit && list.length === 0 && <Card style={{ marginTop: 14 }}><Empty>{cat1 !== "all" ? `${catName(cat1) || "미분류"} 중 ${scope === "mine" ? "내 " : ""}프로젝트가 없어요` : scope === "mine" ? "내가 책임·담당이거나 업무를 맡은 프로젝트가 없어요" : "진행 중인 프로젝트가 없어요"}</Empty></Card>}
    {doneN > 0 && <Card style={{ marginTop: 14 }}><More onClick={() => open({ type: "doneProjects" })}>끝난 프로젝트 {doneN} ›</More></Card>}
    <div className="v2-fab"><Big onClick={() => open({ type: "newProject", cat: cat1 !== "all" && cat1 !== "none" ? cat1 : "" })}>+ 새 프로젝트</Big></div>
  </>;
}
export function DoneProjectsSheet({ D, cu, open, onBack, onClose }) {
  const [f, setF] = useState("all");
  const all = D.projects.filter((p) => !projOpen(p)).sort((a, b) => String(b.droppedAt || b.completedAt || b.dueDate || "").localeCompare(String(a.droppedAt || a.completedAt || a.dueDate || "")));
  const list = all.filter((p) => f === "all" || (f === "drop" ? p.status === "dropped" : p.status !== "dropped"));
  return <Sheet title={`끝난 프로젝트 ${all.length}`} onBack={onBack} onClose={onClose}>
    <div className="v2-chips" style={{ margin: "12px 0 8px" }}>{[["all", "모두", all.length], ["done", "완료", all.filter((p) => p.status !== "dropped").length], ["drop", "중단", all.filter((p) => p.status === "dropped").length]].map(([k, l, n]) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{l} {n}</Chip>)}</div>
    <Card>{list.length === 0 ? <Empty>없어요</Empty> : list.map((p, i) => <Row key={p.id} tag={p.status === "dropped" ? "중단" : "완료"} title={p.title} sub={[nameOf(D.users, p.assigneeId), p.status === "dropped" ? [p.droppedAt ? md(ymd(new Date(p.droppedAt))) : "", p.dropReason].filter(Boolean).join(" ") : p.completedAt ? `완료 ${md(ymd(new Date(p.completedAt)))}` : p.dueDate ? `마감 ${md(p.dueDate)}` : ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "project", id: p.id })} last={i === list.length - 1} />)}</Card>
    <div style={{ fontSize: 12.5, color: C.mute, margin: "10px 2px" }}>보류한 프로젝트는 프로젝트 목록 '보류' 묶음에 있어요</div></Sheet>;
}

// 담당별 새 일 · 지금 열린 일 (신제품·흐름 미리 보기 공용)
function WhoLoad({ D, byWho, now }) {
  return <>{Object.entries(byWho).sort((a, b) => b[1].length - a[1].length).map(([uid, a]) => { const w = workloadOf(D, uid, now);
    return <div key={uid} style={{ color: C.sub }}>{nameOf(D.users, uid) || "담당 없음"} · 새 {a.length}개 · 열린 {w.open}{w.late ? <b style={{ color: C.red }}> · 지난 일 {w.late}</b> : ""}</div>; })}</>;
}
const KINDS = [["normal", "빈 프로젝트", "이름 · 마감 · 첫 업무만 적고 시작해요"], ["launch", "신제품 출시", "출시일만 넣으면 항목 46개의 기한 · 담당 · 순서가 자동으로 들어가요"], ["flow", "흐름으로 만들기", "프로모션 8단계처럼 정해진 순서대로. 앞 단계가 끝나면 다음 담당 차례예요"]];

// 새 프로젝트 — 첫 화면은 고르기 카드 3개 (빈 프로젝트 / 신제품 출시 / 흐름으로 만들기)
export function NewProjectSheet({ D, cu, A, open, back, onBack, onClose, setToast, cat: cat0 }) {
  const [kind, setKind] = useState(cat0 === "launch" ? "launch" : "");
  const [cat, setCat] = useState(cat0 && cat0 !== "launch" ? cat0 : "");
  const [title, setTitle] = useState(""), [lead, setLead] = useState(cu.id), [due, setDue] = useState(""), [brand, setBrand] = useState(""), [tasks, setTasks] = useState(["", "", ""]), [busy, setBusy] = useState(false), [batch, setBatch] = useState("");
  const [wfId, setWfId] = useState(""), [owners, setOwners] = useState([]);
  const ref = useAutoFocus();
  const brands = (D.brands || []).filter((b) => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  const flows = useMemo(() => flowList(D), [D.workflows]);
  const wf = flows.find((w) => w.id === wfId) || null;
  const launch = kind === "launch", flow = kind === "flow";
  const plan = useMemo(() => (launch && title.trim() && brand && due ? planNewLaunch({ name: title, brand, launchDate: due, batch, leadId: lead }, D, cu) : null), [launch, title, brand, due, batch, lead, D]);
  const fplan = useMemo(() => (flow && wf && title.trim() && due ? planFlow({ wf, title, brand, leadId: lead, due, owners }, D, cu) : null), [flow, wf, title, brand, due, lead, owners, D]);
  const needBrand = kind !== "normal";   // 빈 프로젝트는 브랜드 없이도 만듦
  const ok = title.trim() && (brand || !needBrand) && (kind === "normal" || due) && (!flow || fplan) && !busy;
  const missing = [needBrand && !brand && "브랜드", kind !== "normal" && !due && (launch ? "출시일" : "마지막 단계 마감")].filter(Boolean);
  const save = async () => { if (!ok) return; setBusy(true);
    const p = launch ? await A.createLaunch(plan) : flow ? await A.createFlow(fplan, wf, owners) : await A.addProject({ title, assigneeId: lead, dueDate: due, brand, tasks, category: cat || guessCat(title) });
    setBusy(false); if (p) { setToast({ text: launch ? `신제품을 만들었어요 · 항목 ${plan.tasks.length}개` : flow ? `만들었어요 · ${fplan.tasks.length}단계 · 앞 단계가 끝나면 다음 담당 차례예요` : "프로젝트를 만들었어요" }); back(); open({ type: "project", id: p.id }); } };
  const pickBrand = (id) => { setBrand(id); if (launch) { const bm = userByName(D.users, (LAUNCH_BRANDS[id] || {}).bm); if (bm) setLead(bm.id); } };
  const pickWf = (w) => { setWfId(w.id); setOwners(flowOwners(w, cu, D.users)); };
  const now = new Date(), key = ymd(now), people = activeUsers(D.users);
  const label = (KINDS.find((k) => k[0] === kind) || [])[1];
  const foot = kind && (!flow || wf) ? <>{title.trim() && missing.length > 0 && <div style={{ fontSize: 13, color: C.sub, margin: "0 2px 8px" }}>먼저 정할 것: <b style={{ color: C.ink }}>{missing.join(" · ")}</b></div>}<Big onClick={save} disabled={!ok}>{launch ? (plan ? `만들기 · 항목 ${plan.tasks.length}개` : "만들기") : flow ? (fplan ? `만들기 · ${fplan.tasks.length}단계` : "만들기") : "만들기"}</Big></> : null;
  if (!kind) return <Sheet title="새 프로젝트" onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 14, color: C.sub, margin: "14px 2px 10px" }}>어떻게 시작할까요?</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{KINDS.map(([k, l, d]) => <button key={k} type="button" className="v2-pick" onClick={() => setKind(k)}>
      <b>{l} ›</b><span>{k === "flow" ? `${d} · ${flows.length}가지` : d}</span></button>)}</div>
  </Sheet>;
  return <Sheet title="새 프로젝트" onBack={onBack} onClose={onClose} foot={foot}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 2px 0" }}><b style={{ flex: 1, fontSize: 15, color: C.ink }}>{label}{flow && wf ? ` · ${wf.name} ${wf.stages.length}단계` : ""}</b>
      <TBtn onClick={() => (flow && wf ? setWfId("") : setKind(""))}>{flow && wf ? "다른 흐름" : "다른 방식"}</TBtn></div>
    {flow && !wf ? <><div style={{ fontSize: 13.5, color: C.sub, margin: "8px 2px 10px" }}>어떤 흐름인가요? 단계마다 업무 1건씩 생겨요.</div>
      <Card>{flows.map((w, i) => <Row key={w.id} tag={`${w.stages.length}단계`} title={w.name} sub={w.stages.map((s) => s.name).join(" → ")} onClick={() => pickWf(w)} last={i === flows.length - 1} />)}</Card></>
    : <>
    <label className="v2-lab" htmlFor="v2-np">{launch ? "제품 이름" : "이름"}</label><input id="v2-np" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={launch ? "예: 2in1 목재용 페인트" : flow ? wf.hint || "예: 10월 추석 프로모션" : "예: 10월 그로홈 기획전"} style={inp} />
    <div className="v2-lab">브랜드 <span style={{ color: C.mute, fontWeight: 600 }}>{needBrand ? "(필수)" : "(선택)"}</span></div><div className="v2-chips">{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => pickBrand(b.id)}>{b.name}</Chip>)}</div>
    <label className="v2-lab" htmlFor="v2-npd">{launch ? "출시일" : flow ? "마지막 단계 마감" : "마감"} {kind === "normal" && <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span>}</label><input id="v2-npd" type="date" value={due} min={flow ? key : undefined} onChange={(e) => setDue(e.target.value)} style={inp} />
    {launch && <><label className="v2-lab" htmlFor="v2-npb">차수 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 같이 출시하는 묶음)</span></label><input id="v2-npb" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="예: 데코라인 2차" style={inp} /></>}
    <div className="v2-lab">책임자</div><div className="v2-chips"><Chip on={lead === cu.id} onClick={() => setLead(cu.id)}>나</Chip>{lead !== cu.id && <Chip on>{nameOf(D.users, lead)}</Chip>}<select aria-label="책임자" className="v2-sel" value="" onChange={(e) => e.target.value && setLead(e.target.value)}><option value="">다른 사람 ▾</option>{people.filter((u) => u.id !== cu.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    {kind === "normal" && <><div className="v2-lab">카테고리 <span style={{ color: C.mute, fontWeight: 600 }}>{cat ? "" : guessCat(title) ? `(안 고르면 이름으로 '${catName(guessCat(title))}')` : "(선택)"}</span></div>
      <div className="v2-chips">{PROJ_CATS.filter(([k]) => k !== "launch").map(([k, l]) => <Chip key={k} on={cat === k} onClick={() => setCat(cat === k ? "" : k)}>{l}</Chip>)}</div></>}
    {kind === "normal" && <><div className="v2-lab">첫 업무 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 나중에 더 넣을 수 있어요)</span></div>
      {tasks.map((v, i) => <input key={i} value={v} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`업무 ${i + 1}`} aria-label={`첫 업무 ${i + 1}`} style={{ ...inp, marginBottom: 6 }} />)}</>}
    {flow && <><div className="v2-lab">단계와 담당 <span style={{ color: C.mute, fontWeight: 600 }}>(고른 담당은 다음에도 기본으로 나와요)</span></div>
      <Card>{wf.stages.map((s, i) => <div key={s.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: i < wf.stages.length - 1 ? `1px solid ${C.line}` : "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {s.name}</div>
          <div style={{ fontSize: 12, color: C.mute }}>{fplan ? `기한 ${md(fplan.dues[i])}` : i ? "앞 단계가 끝나면 시작" : "처음 단계"}</div></div>
        <select aria-label={`${s.name} 담당`} className="v2-sel" value={owners[i] || cu.id} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? e.target.value : x)))}>{people.map((u) => <option key={u.id} value={u.id}>{u.id === cu.id ? "나" : u.name}</option>)}</select>
      </div>)}</Card></>}
    {(launch || flow) && <><Head>미리 보기</Head>
      {launch && (!plan ? <Card><Empty>제품 이름 · 브랜드 · 출시일을 넣으면 항목별 기한과 담당이 자동으로 채워져요</Empty></Card>
        : <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          <div>항목 {plan.tasks.length}개 · 기한은 출시일에서 거꾸로 계산 (쉬는 날이면 앞 평일)</div>
          {plan.squeezed && <div style={{ color: C.ink, fontWeight: 700 }}>출시까지 8주가 안 돼서, 남은 기간에 고르게 나눠 넣었어요.</div>}
          {LAUNCH_PHASES.map((ph) => { const a = plan.tasks.filter((t) => t.phase === ph.k); if (!a.length) return null; const ds = a.map((t) => t.dueDate).sort();
            return <div key={ph.k} style={{ color: C.sub }}>{ph.name} {a.length}개 · {md(ds[0])}{ds[0] !== ds[ds.length - 1] ? `~${md(ds[ds.length - 1])}` : ""}</div>; })}
          <div style={{ marginTop: 8, fontWeight: 800, color: C.ink }}>담당별 (새 항목 · 지금 열린 일)</div>
          <WhoLoad D={D} byWho={plan.byWho} now={now} />
          <div style={{ marginTop: 8, color: C.mute, fontSize: 12.5 }}>만든 뒤 항목마다 담당·기한을 바꿀 수 있어요. 담당자 화면 '확인할 것'에 "신제품 · 항목 n개 맡김"으로 떠요.</div>
        </Card>)}
      {flow && (!fplan ? <Card><Empty>이름 · 브랜드 · 마지막 마감을 넣으면 단계마다 기한이 평일로 고르게 나뉘어 들어가요</Empty></Card>
        : <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          <div>{fplan.tasks.length}단계 · {md(fplan.dues[0])} ~ {md(fplan.dues[fplan.dues.length - 1])} (주말·공휴일 빼고)</div>
          {fplan.squeezed && <div style={{ color: C.ink, fontWeight: 700 }}>마감까지 평일이 단계보다 적어서, 같은 날에 끝내는 단계가 있어요.</div>}
          <div style={{ marginTop: 8, fontWeight: 800, color: C.ink }}>담당별 (새 단계 · 지금 열린 일)</div>
          <WhoLoad D={D} byWho={fplan.byWho} now={now} />
          <div style={{ marginTop: 8, color: C.mute, fontSize: 12.5 }}>앞 단계 담당이 '끝냈어요'를 누르면 다음 담당 화면에 '이제 내 차례'로 떠요. 다른 사람 단계는 '확인할 것'에 "항목 n개 맡김" 한 줄로 가요.</div>
        </Card>)}</>}
    </>}
  </Sheet>;
}

// 프로젝트 한 장 (실사용·관리자 공용). projectExtra: 관리자 앱 덧붙임 (출시일 옮기기 미리 보기 · 기한 다시 나누기) — (p) => element
// st/save: 시트 칸에 적어 둔 탭·펼친 단계·정보 → 업무를 열었다가 '뒤로' 오면 그대로
export function ProjectSheet({ D, cu, A, open, onBack, onClose, id, first, projectExtra, idx: idx0, st, save }) {
  const idx = useMemo(() => idx0 || turnIndex(D), [idx0, D]);
  const p = D.projects.find((x) => x.id === id);
  const member = p && projMine(p, cu.id, D.tasks);
  const [tab, setTab] = useState(() => (st && st.tab) || first || (!p || member ? "work" : "news"));   // 방금 만든 프로젝트는 업무부터
  const [doneList, setDoneList] = useState(null), [showDone, setShowDone] = useState(false), [nt, setNt] = useState(""), [nw, setNw] = useState(cu.id), [ndue, setNdue] = useState(""), [edit, setEdit] = useState(""), [now, setNow] = useState(""), [info, setInfo] = useState(!!(st && st.info)), [ld, setLd] = useState(""), [openPh, setOpenPh] = useState((st && st.openPh) || {}), [lAsk, setLAsk] = useState(null);
  const notes = useItemNotes(D, projNoteId(id));
  const [endAsk, setEndAsk] = useState(false), [resAsk, setResAsk] = useState(false);   // 끝내기·멈추기 창 · 다시 시작 창
  useEffect(() => { if (!isLaunch(p)) A.recalc(id); }, [id]);   // 열 때 진척(%)을 실제 업무 수로 다시 계산 (다르면만 저장) · 신제품은 launchPct 로 그때그때 계산하므로 저장 안 함
  useEffect(() => { if (save) save({ tab, openPh, info }); }, [tab, openPh, info]);
  if (!p) return <Sheet title="프로젝트" onBack={onBack} onClose={onClose}><Empty>이 프로젝트를 찾지 못했어요</Empty></Sheet>;
  const key = ymd(new Date()), s = projStat(p, D.tasks, key), launch = isLaunch(p), master = isMaster(cu), lead = p.assigneeId === cu.id || master;
  const date = dateOf(p), w = whenOf(p, D.tasks, key), pct = launch ? launchPct(p, D) : s.pct;
  // 출시일 바꾸기: 옮겨질 자동 기한 수를 버튼에 · 30개 이상이면 한 번 더 묻기 · 지난 날은 못 고름 (되돌리기는 A.setLaunchDate 알림)
  const mvN = launch && ld && ld >= key && ld !== p.launchDate ? previewLaunchMove(p, D, ld, key).changes.length : 0;
  const goLaunch = () => { if (mvN >= 30) setLAsk({ d: ld, n: mvN }); else { A.setLaunchDate(p, ld); setLd(""); } };
  const live = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed);
  const openT = live.filter((t) => !isDone(t));
  const myNew = openT.filter((t) => isMine(t, cu.id) && reqOf(t) && !t.ackAt && t.status === "todo");
  const nn = nowNext(p, D, idx, key);
  const hasNow = !!(p.now && p.now.text);
  const phases = launch ? phaseStates(live.filter((t) => t.launchItem), key) : null;
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
    .concat(D.notes.filter((n) => { if (n.deleted) return false; const [k, ...r] = String(n.itemId).split(":"); const ref = r.join(":"); return (k === "proj" && ref === p.id) || (k === "task" && tids.includes(ref)); }).flatMap((n) => (n.files || []).map((f) => ({ ...f, byName: n.byName, uploadedAt: f.uploadedAt || n.at, where: "댓글" }))))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  const ncount = (t) => D.notes.filter((n) => n.itemId === taskNoteId(t.id) && !n.deleted).length;
  // 항목 줄: 태그 = 위험(지남·막힘 …) → 내 차례 → 진행 중 · 부제 2줄 = 앞 일(기다리는 중일 때) · 담당 (임시)=책임자로 채움 (기본)=자주 맡던 사람
  const TRow = ({ t, indent, last }) => { const r = riskOf(t, key), tu = turnOf(t, idx, key), temp = idx.temp.has(t.id);
    const own = whoOf(D, t) + (temp ? "(임시)" : t.ownerFrom === "default" || (t.ownerAuto && !t.ownerFrom) ? "(기본)" : "");
    const tag = r ? r.label : tu.state === "ready" && isMine(t, cu.id) && !temp ? "내 차례" : t.status === "inprogress" ? "진행 중" : null;
    const wait = (tu.state === "wait" || tu.state === "late") && (tu.show || tu.open[0]);   // 보일 앞 일: 늦은 것 → 끝 예정이 가장 늦은 것
    return <div style={{ paddingLeft: indent ? 18 : 0, background: "#fff" }}><Row dim={isDone(t)} tag={tag} tagTone={r ? (r.red ? "red" : null) : tag === "내 차례" ? "turn" : null} title={t.title}
      sub={[own, dueOf(t) ? md(dueOf(t)) + (isDone(t) || r ? "" : " · " + ddayLabel(ddays(dueOf(t), key))) : "기한 미정", ncount(t) ? `댓글 ${ncount(t)}` : ""].filter(Boolean).join(" · ")}
      sub2={wait ? "앞 일: " + predLine(wait, D.users, key) : null}
      onClick={() => open({ type: "task", id: t.id })} right={isMine(t, cu.id) && t.status !== "review" ? <Act on={isDone(t)} onClick={() => (isDone(t) ? A.reopen(t) : A.finish(t))}>{isDone(t) ? "✓" : "끝냄"}</Act> : null} last={last} /></div>; };
  const goPhase = (k) => { setTab("work"); setOpenPh((o) => ({ ...o, [k]: true })); setTimeout(() => { const el = document.getElementById("v2-ph-" + k); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); };
  const flowRow = (lab, t, extra, last) => <Row key={lab} tag={lab} tagTone={lab === "지금" ? "turn" : null} title={`${whoOf(D, t)} · ${t.title}${extra || ""}`}
    sub={[dueOf(t) ? md(dueOf(t)) + " " + ddayLabel(ddays(dueOf(t), key)) : "기한 미정", lab === "다음" && t.status === "todo" ? "앞 일이 끝나면 시작" : stWord(t)].join(" · ")} onClick={() => open({ type: "task", id: t.id })} last={last} />;
  return <Sheet title="프로젝트" onBack={onBack} onClose={onClose}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "12px 0 2px" }}>
      <h2 style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 800, color: C.ink, margin: 0, lineHeight: 1.35, wordBreak: "keep-all" }}>{p.title}{impOf(p) !== "mid" && <span className={"v2-pill " + (impOf(p) === "high" ? "hi" : "lo")}>중요 {impName(impOf(p))}</span>}{projStLabel(p) !== "진행 중" && <span className="v2-pill st">{projStLabel(p)}</span>}</h2>
      {!hasNow && edit !== "now" && <TBtn onClick={() => { setNow(""); setEdit("now"); }} style={{ flex: "0 0 auto", padding: "4px 2px", fontSize: 13 }}>+ 지금 상황</TBtn>}
    </div>
    {launch && <div style={{ fontSize: 12.5, color: C.mute, fontWeight: 700 }}>출시 템플릿 · {brandName(D, p.brand)}{p.batch ? " " + p.batch : ""}</div>}
    <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4 }}>책임 {nameOf(D.users, p.assigneeId) || "없음"} · {date ? <span style={{ color: w.late ? C.red : C.sub, fontWeight: w.late ? 800 : 400 }}>{w.launched ? `출시 ${md(p.launchDate)} · 출시 후 ${w.after != null ? w.after : -ddays(p.launchDate, key)}일${w.late ? " · 늦은 항목 있음" : ""}` : `${launch ? "출시" : "마감"} ${md(date)} ${ddayLabel(w.n)}`}</span> : launch ? "출시일 미정" : "마감 없음"} · {pct}% · 남은 {openT.length}</div>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, margin: "10px 0 0", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: C.navy }} /></div>
    {(() => { if (launch || !projOpen(p) || isHoldP(p) || !openT.length) return null; const f = projForecast(p, D.tasks, key);   // 지금 속도로 언제 끝날까 (중요도와 같이 관리자 '판단 필요'에 쓰임)
      return <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>{f.eta ? <>지금 속도 주 {f.perWeek}건 · 남은 {f.left}건 → 예상 {md(f.eta)}{f.lateBy > 0 ? <b style={{ color: C.red }}> · 마감보다 {f.lateBy}일 늦음</b> : f.due ? " · 마감 안에 끝나요" : ""}</> : `최근 2주 끝낸 업무가 없어 끝나는 날을 잴 수 없어요 · 남은 ${f.left}건`}</div>; })()}
    {projOpen(p) && !isHoldP(p) && lead && <div style={{ display: "flex", justifyContent: "flex-end" }}><TBtn onClick={() => setEndAsk(true)} style={{ padding: "4px 2px", fontSize: 12.5 }}>끝내기 · 멈추기 ›</TBtn></div>}
    {isHoldP(p) && <Card style={{ marginTop: 10, padding: "12px 14px" }}><div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>보류 중{p.heldAt ? ` · ${-ddays(ymd(new Date(p.heldAt)), key)}일째` : ""}</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>{p.holdReason || "이유 없음"} · {p.holdUntil ? `다시 할 날 ${md(p.holdUntil)} (${ddayLabel(ddays(p.holdUntil, key))})` : "다시 할 날 미정"}</div>
      {lead && <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}><Act onClick={() => setResAsk(true)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>다시 시작 ›</Act><Act onClick={() => setEndAsk(true)}>이유 · 다시 할 날 바꾸기</Act></div>}</Card>}
    {!projOpen(p) && <Card style={{ marginTop: 10, padding: "12px 14px" }}><div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>{projStLabel(p)}{(p.droppedAt || p.completedAt) ? ` · ${md(ymd(new Date(p.status === "dropped" ? p.droppedAt : p.completedAt)))}` : ""}</div>
      {p.status === "dropped" && <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4 }}>{p.dropReason || "이유 없음"} · 남은 업무는 접어 뒀어요 (지우지 않음)</div>}
      {lead && <div style={{ marginTop: 10 }}><Act onClick={() => setResAsk(true)}>다시 열기</Act></div>}</Card>}
    {endAsk && <ProjEndAsk p={p} openT={openT} A={A} onNo={() => setEndAsk(false)} />}
    {resAsk && <ResumeAsk p={p} D={D} A={A} onNo={() => setResAsk(false)} />}
    {edit === "now" ? <div style={{ marginTop: 12 }}><div style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: "0 2px 6px" }}>지금 상황</div><textarea value={now} onChange={(e) => setNow(e.target.value)} rows={3} autoFocus placeholder={"목표: 무엇을 하려는지\n지금: 어디까지 왔는지"} aria-label="지금 상황" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setEdit("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={() => { A.patchProject(p, { now: { text: now.trim(), by: cu.id, byName: cu.name, at: new Date().toISOString() } }, "지금 상황 고침", (p.now && p.now.text) || ""); setEdit(""); }} style={{ flex: 1, height: 44 }}>저장</Big></div></div>
      : hasNow && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#fff", border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.navy}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><b style={{ flex: 1, fontSize: 12.5, color: C.navy }}>지금 상황</b><TBtn onClick={() => { setNow(p.now.text); setEdit("now"); }} style={{ padding: "0 2px", fontSize: 12.5 }}>고치기</TBtn></div>
        <div style={{ fontSize: 14, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2 }}><Linked text={p.now.text} /></div>
        {p.now.at && <div style={{ marginTop: 4, fontSize: 11.5, color: C.mute }}>{p.now.byName} · {ago(p.now.at)}</div>}</div>}
    {(nn.now || nn.next) && <Card style={{ marginTop: 12 }}>{nn.now && flowRow("지금", nn.now, nn.others ? ` 외 ${nn.others}명` : "", !nn.next)}{nn.next && flowRow("다음", nn.next, "", true)}</Card>}
    {phases && <div className="v2-phases" role="list" aria-label="7단계">{phases.map((ph) => <button key={ph.k} type="button" role="listitem" className={"v2-ph " + ph.state} onClick={() => goPhase(ph.k)}
      aria-label={`${ph.name} · ${ph.state === "done" ? "끝남" : `남은 ${ph.left}${ph.state === "late" ? " · 지난 항목 있음" : ""}`}`}><span className="nm">{PH_SHORT[ph.k] || ph.name}</span><span className="c">{ph.state === "done" ? "✓" : ph.left}</span></button>)}</div>}
    {projectExtra && projectExtra(p)}
    {myNew.length > 0 && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: C.soft, border: "1px solid #D7DDEE", fontSize: 14, color: C.text }}>
      <b>나에게 온 {launch ? "항목" : "업무"} {myNew.length}개</b> · 기한을 훑어보고 받아 주세요. 안 맞는 기한은 열어서 '기한 조정 요청'을 해요.
      <div style={{ marginTop: 8 }}><Act onClick={() => A.ackMany(myNew)} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>모두 받았어요</Act></div></div>}
    {launch && lead && !projectExtra && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>출시일</span><input type="date" aria-label="출시일" min={key} value={ld || p.launchDate || ""} onChange={(e) => setLd(e.target.value)} className="v2-sel" />
      {ld && ld !== p.launchDate && (ld < key ? <span style={{ fontSize: 12.5, color: C.sub }}>오늘 이후로 골라 주세요</span>
        : <Act onClick={goLaunch} style={{ background: C.navy, color: "#fff", borderColor: C.navy }}>바꾸기 · 자동 기한 같이 이동 {mvN}개</Act>)}</div>}
    {lAsk && <Ask title={`출시일을 ${md(lAsk.d)}${ro(md(lAsk.d))} 바꿀까요?`} body={`자동 기한 ${lAsk.n}개가 같이 옮겨져요 (다른 사람 항목 포함).\n5초 안에 되돌릴 수 있고, 옮기기 전 기한은 기록에 남아요.`} yes="바꾸기" onNo={() => setLAsk(null)} onYes={() => { const a = lAsk; setLAsk(null); A.setLaunchDate(p, a.d); setLd(""); }} />}

    <div style={{ margin: "18px 0 4px" }}><Seg items={[["work", `${launch ? "항목" : "업무"} ${openT.length}`], ["map", "마인드맵"], ["news", "소식"], ["files", `자료 ${files.length}`]]} value={tab} onChange={setTab} /></div>
    {tab === "work" && <>
      <Card style={{ marginTop: 10 }}><div style={{ display: "flex", gap: 6, padding: 10, flexWrap: "wrap" }}>
        <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addT(); }} placeholder="+ 업무 추가 (Enter로 계속)" aria-label="업무 추가" style={{ ...inp, flex: "1 1 180px", padding: "10px 12px", fontSize: 14 }} />
        <select aria-label="담당" value={nw} onChange={(e) => setNw(e.target.value)} className="v2-sel">{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.id === cu.id ? "나" : u.name}</option>)}</select>
        <input type="date" aria-label="기한" value={ndue} onChange={(e) => setNdue(e.target.value)} className="v2-sel" />
        <Act onClick={addT}>추가</Act></div>
        {nw !== cu.id && !ndue && <div style={{ padding: "0 12px 10px", fontSize: 12.5, color: C.sub }}>기한을 안 고르면 3일 뒤({md(addDays(key, 3))})로 맡겨요</div>}</Card>
      {(() => { let firstOpen = true; return groups.map(([k, l, f]) => { const a = openT.filter(f); if (!a.length) return null;
        const tops = top(a).sort((x, y) => (x.wfStage ?? 99) - (y.wfStage ?? 99) || String(dueOf(x) || "9").localeCompare(String(dueOf(y) || "9")));
        // 신제품: 지금 단계(처음 남은 단계)와 급한 항목이 있는 단계만 펼침 — 한 번에 볼 것만
        const hot = a.some((t) => { const r = riskOf(t, key); return r && (r.red || r.k === "start" || r.k === "today"); });
        const shown = !launch || openPh[k] != null ? (launch ? openPh[k] : true) : firstOpen || hot; firstOpen = false;
        const redH = launch && a.some((t) => { const r = riskOf(t, key); return r && r.red; });   // 빨강은 지남·막힘이 있을 때만 ('급함'은 오늘 마감·시작 전 포함)
        return <div key={k} id={"v2-ph-" + k} style={{ scrollMarginTop: 12 }}><Head red={redH} right={launch && <TBtn onClick={() => setOpenPh({ ...openPh, [k]: !shown })}>{shown ? "접기 ▴" : "펼치기 ▾"}</TBtn>}>{l} {a.length}{launch && hot ? " · 급함" : ""}</Head>
          {shown && <Card>{tops.map((t, i) => <div key={t.id}><TRow t={t} last={i === tops.length - 1 && !kidsOf(t.id, a).length} />{kidsOf(t.id, a).map((kk) => <TRow key={kk.id} t={kk} indent />)}</div>)}</Card>}</div>; }); })()}
      {openT.length === 0 && <Card style={{ marginTop: 10 }}><Empty>열린 업무가 없어요{projOpen(p) && lead ? " · 다 끝났으면 프로젝트를 완료해요" : ""}</Empty></Card>}
      {projOpen(p) && !isHoldP(p) && openT.length === 0 && lead && <Big onClick={() => A.endProject(p, "completed")} style={{ marginTop: 10 }}>프로젝트 완료</Big>}
      <Card style={{ marginTop: 14 }}><More onClick={loadDone}>{showDone ? "끝낸 업무 접기 ▴" : `끝낸 업무 ${doneList ? doneList.length : "보기"} ▾`}</More>
        {showDone && (doneList == null ? <Empty>불러오는 중…</Empty> : doneAll.length === 0 ? <Empty>끝낸 업무가 없어요</Empty> : doneAll.slice().sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || ""))).map((t, i) => <TRow key={t.id} t={t} last={i === doneAll.length - 1} />))}</Card>
    </>}
    {tab === "map" && <MindMap D={D} cu={cu} A={A} open={open} p={p} idx={idx} launch={launch} />}
    {tab === "news" && <NewsFeed D={D} p={p} feed={feed} tTitle={tTitle} open={open} />}
    {tab === "news" && <><Head>프로젝트에 한마디</Head><Thread D={D} cu={cu} A={A} notes={notes} itemId={projNoteId(p.id)} ctx={{ projectId: p.id }} /></>}
    {tab === "files" && <Card style={{ marginTop: 10 }}>{files.length === 0 ? <Empty>모인 자료가 없어요. 업무나 댓글에 파일을 올리면 여기 모여요.</Empty> : files.map((f, i) => <FileRow key={i} f={f} last={i === files.length - 1} />)}</Card>}

    <Card style={{ marginTop: 18 }}><More onClick={() => setInfo(!info)}>{info ? "정보 접기 ▴" : "정보 ▾"}</More>
      {info && <div style={{ padding: "4px 14px 14px", fontSize: 14, color: C.text, lineHeight: 1.9 }}>
        <div>책임자 <select aria-label="책임자 바꾸기" className="v2-sel" value={p.assigneeId || ""} onChange={(e) => A.patchProject(p, { assigneeId: e.target.value }, `책임자 → ${nameOf(D.users, e.target.value)}`, p.assigneeId || "")}><option value="">없음</option>{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div>함께 하는 사람 {(p.collaboratorIds || []).map((u) => nameOf(D.users, u)).filter(Boolean).join(", ") || "없음"}</div>
        {!launch && <div>마감 <input type="date" aria-label="마감 바꾸기" className="v2-sel" defaultValue={p.dueDate || ""} onBlur={(e) => { if (e.target.value !== (p.dueDate || "")) A.patchProject(p, { dueDate: e.target.value }, `마감 ${md(e.target.value) || "없음"}`, p.dueDate || ""); }} /></div>}
        <div>브랜드 <select aria-label="브랜드 바꾸기" className="v2-sel" value={p.brand || ""} onChange={(e) => A.patchProject(p, { brand: e.target.value }, `브랜드 → ${brandName(D, e.target.value) || "없음"}`, p.brand || "")}><option value="">없음</option>{(D.brands || []).filter((b) => b.active !== false || b.id === p.brand).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <span style={{ fontSize: 12.5, color: C.mute }}> 이 프로젝트 업무는 모두 이 브랜드로 봐요</span></div>
        <div>카테고리 <select aria-label="카테고리 바꾸기" className="v2-sel" value={projCat(p)} onChange={(e) => A.patchProject(p, { category: e.target.value }, `카테고리 → ${catName(e.target.value) || "미분류"}`, p.category || "")}><option value="">미분류</option>{PROJ_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {!projCat(p) && guessCat(p.title) && <TBtn onClick={() => A.patchProject(p, { category: guessCat(p.title) }, `카테고리 → ${catName(guessCat(p.title))}`, "")}>'{catName(guessCat(p.title))}'로 넣기</TBtn>}
          {p.wfId && <span style={{ fontSize: 12.5, color: C.mute }}> · 흐름 {(flowList(D).find((w) => w.id === p.wfId) || {}).name || p.wfId}</span>}</div>
        {p.memo && <div style={{ whiteSpace: "pre-wrap", color: C.sub }}>예전 메모: {p.memo}</div>}
        <div>중요도 {lead ? IMP.map(([k, l]) => <Chip key={k} on={impOf(p) === k} onClick={() => impOf(p) !== k && A.patchProject(p, { priority: k }, `중요도 → ${l}`, p.priority || "")}>{l}</Chip>) : <b>{impName(impOf(p))}</b>}
          <div style={{ fontSize: 12.5, color: C.mute, lineHeight: 1.6 }}>높음 = 날짜를 꼭 지켜야 하는 일 · 낮음 = 바쁘면 미뤄도 되는 일. 관리자 '판단 필요'(당길 것·미룰 것) 계산에 쓰여요</div></div>
        {(p.endLog || []).length > 0 && <div style={{ color: C.sub, fontSize: 13 }}>지난 멈춤·재개: {(p.endLog || []).slice(-3).map((x) => `${md(ymd(new Date(x.at)))} ${x.kind === "resume" ? "다시 시작" : x.kind === "hold" ? "보류" : x.kind === "dropped" ? "중단" : "완료"}${x.why ? `(${x.why})` : ""}`).join(" · ")}</div>}
        {projOpen(p) && !isHoldP(p) && lead && <Big tone="white" onClick={() => setEndAsk(true)} style={{ marginTop: 10 }}>끝내기 · 멈추기 (완료 · 중단 · 보류)</Big>}
      </div>}</Card>
  </Sheet>;
}

// 소식: 날짜별 묶음 · [전체 | 대화 | 바뀐 것] · 같은 일이 두 번 나오지 않게(댓글 기록은 댓글로만) · 누르면 그 업무(댓글이면 대화 칸)
// 태그 = 무슨 일인지 한눈에 · 문장 = 누가 무엇을 했는지 (예: 김송희님이 완료했어요)
const ACT_TAG = { ask: "도움 요청", askDone: "도움 해결", hold: "보류", unhold: "보류 풀기", projEnd: "끝냄·멈춤", projResume: "다시 시작", decide: "결정", done: "완료", review: "확인 요청", approve: "확인 완료", feedback: "수정 요청", add: "업무 추가", edit: "내용 수정", assign: "담당 변경", take: "이어받음", deps: "순서 변경", bulk: "한꺼번에 변경", ack: "받음", reopen: "다시 열림", launch: "신제품 시작", block: "막힘", unblock: "막힘 풀림", due: "기한 변경", dueReq: "기한 조정 요청" };
const ACT_SAY = { ask: "도움을 요청했어요", askDone: "도움 요청을 닫았어요", hold: "보류했어요", unhold: "보류를 풀었어요", projEnd: "프로젝트를 끝내거나 멈췄어요", projResume: "프로젝트를 다시 시작했어요", decide: "결정했어요", done: "완료했어요", review: "끝내고 확인을 요청했어요", approve: "확인하고 완료 처리했어요", feedback: "수정을 요청했어요", add: "새로 만들었어요", edit: "내용을 고쳤어요", assign: "담당을 바꿨어요", take: "이어받았어요", deps: "앞 일 순서를 바꿨어요", bulk: "한꺼번에 바꿨어요", ack: "받았다고 알렸어요", reopen: "다시 열었어요", launch: "신제품을 만들었어요", block: "막혔다고 알렸어요", unblock: "막힘을 풀었어요", due: "기한을 바꿨어요", dueReq: "기한 조정을 요청했어요", delete: "휴지통으로 옮겼어요" };
function NewsFeed({ D, p, feed, tTitle, open }) {
  const [f, setF] = useState("all"), [n, setN] = useState(30);
  const key = ymd(new Date()), y = addDays(key, -1), WDK = ["일", "월", "화", "수", "목", "금", "토"];
  const rows = feed.filter((x) => x.itemId !== projNoteId(p.id) && !(x.type === "log" && x.action === "comment"))
    .filter((x) => (f === "talk" ? x.type === "note" : f === "change" ? x.type === "log" : true));
  const dayL = (iso) => { const d = ymd(new Date(iso)); return d === key ? "오늘" : d === y ? "어제" : `${md(d)} (${WDK[new Date(d + "T00:00:00").getDay()]})`; };
  const clean = (x) => { const tt = x.type === "note" ? "" : x.col === "projects" ? p.title : tTitle(x.targetId) || "";
    let t = String(x.text || ""); if (tt && t.startsWith(tt + " · ")) t = t.slice(tt.length + 3); else if (tt && t === tt) t = ""; return t; };
  let last = "";
  return <>
    <div className="v2-chips" style={{ margin: "12px 0 4px" }}>{[["all", "전체"], ["talk", "대화"], ["change", "바뀐 것"]].map(([k, l]) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{l}</Chip>)}</div>
    {rows.length === 0 ? <Card style={{ marginTop: 8 }}><Empty>{f === "talk" ? "최근 대화가 없어요" : f === "change" ? "최근 바뀐 것이 없어요" : "최근 소식이 없어요"}</Empty></Card>
    : <div className="v2-news">{rows.slice(0, n).map((x) => { const dl = dayL(x.at), head = dl !== last; last = dl;
        const note = x.type === "note", tid = note ? String(x.itemId).slice(5) : x.col !== "projects" ? x.targetId : "";
        const where = note ? tTitle(tid) || "" : x.col === "projects" ? "프로젝트" : tTitle(x.targetId) || "";
        const det = note ? "" : clean(x), say = `${x.byName ? x.byName + "님이 " : ""}${note ? "댓글을 남겼어요" : ACT_SAY[x.action] || (LOG_L[x.action] ? LOG_L[x.action] + "했어요" : "바꿨어요")}`;
        const go = tid ? () => open({ type: "task", id: tid, ...(note ? { focus: "talk" } : {}) }) : null;
        return <div key={x.id}>{head && <div className="v2-news-day">{dl}</div>}
          <div className={"v2-news-row" + (go ? " go" : "")} role={go ? "button" : undefined} tabIndex={go ? 0 : undefined} onClick={go || undefined} onKeyDown={(e) => { if (go && e.key === "Enter") go(); }}>
            <span className={"v2-tag" + (note ? "" : x.action === "decide" || x.action === "done" || x.action === "approve" ? " turn" : "")}>{note ? "댓글" : ACT_TAG[x.action] || LOG_L[x.action] || "기록"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {where && <div className="w">{where}</div>}
              <div className="b">{say}{det ? <span className="d"> · {det}</span> : null}</div>
              {note && <div className="b q">{x.text}{x.files && x.files.length ? ` · 파일 ${x.files.length}` : ""}</div>}
              <div className="s">{hm(x.at)}</div></div>
            {go && <span className="arr">›</span>}</div></div>; })}
      {rows.length > n && <Card style={{ marginTop: 6 }}><More onClick={() => setN(n + 30)}>{rows.length - n}개 더 보기 ▾</More></Card>}</div>}
  </>;
}

