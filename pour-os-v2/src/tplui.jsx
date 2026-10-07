// 업무OS v2 — 견본(템플릿) 화면 (사용자 확정 2026-10-07 ②) · 계산은 tpl.js · 저장은 core.jsx A.tpl*
//  ① 견본으로 저장: 프로젝트 [정보 · 더 하기 ▾] › [견본으로 저장] (책임자·관리자) → 이름 · '담당도 같이 저장'(기본 끔) · 업무 n개 + 예상 소요 → [견본 저장]
//  ② 견본함: 프로젝트 탭 [견본 n] · 더보기 › 견본함 — 모두 봄 · 줄 = 이름 · 업무 n개 · 예상 소요 n일 · 만든 사람
//  ③ 견본 한 장: [목록 | 마인드맵] · [이 견본으로 새 프로젝트] · 만든 사람·관리자만 업무 이름·소요일 고치기 · 빼기 · 더하기 · [더 하기 ▾] 이름 고치기 · 없애기(휴지통)
//  ④ 견본으로 새 프로젝트: 이름 · 책임자 · 시작일(오늘부터) · 브랜드 · 담당(견본 담당 → 책임자 · 업무마다 바꾸기) → 미리 보기 '업무 n개 · 끝 예상 M/D' → [만들기]
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { ymd, md, nameOf, activeUsers, isRemoved, estOf, estClean, EST_MAX, workloadOf, projLabel } from "./model.js";
import { tplEst, tplLive, tplRoad, tplKind, canEditTpl, canSaveTpl, planTemplate, planFromTemplate, tplOwnerOf, KIND_L, TPL_MAX, TPL_NAME_MAX } from "./tpl.js";
import { LAUNCH_BRANDS } from "./launch.js";
import { flowList } from "./flow.js";
import { C, Big, TBtn, Chip, Seg, Head, Card, Row, Empty, Sheet, inp, useLocal, useAutoFocus } from "./ui.jsx";
import { RemovedNote } from "./trash.jsx";
import { TplMap } from "./mindmap.jsx";

const LS = (k) => "pour-os2-" + k;
const arrow = <span style={{ color: C.navy, fontWeight: 800 }}>›</span>;
const daysL = (n) => (n ? `${n}일` : "미정");
export const tplSub = (D, t) => { const E = tplEst(t); return [`업무 ${tplLive(t).length}개`, E.has ? `예상 소요 ${E.total}일` : "예상 소요 미정", t.createdByName || nameOf(D.users, t.createdBy)].filter(Boolean).join(" · "); };
export function TplRow({ D, t, onClick, last }) {
  return <Row title={t.title || "(이름 없음)"} tag={KIND_L[tplKind(t)] || null} sub={tplSub(D, t)} onClick={onClick} right={arrow} last={last} />;
}

// ① 견본으로 저장 — 그 프로젝트 업무 전부를 서버에서 한 번 읽음(끝낸 지 30일 넘은 업무까지) · 못 읽으면 화면에 있는 것만 + 안내
export function TplSaveSheet({ D, cu, A, open, back, onBack, onClose, id }) {
  const p = (D.projects || []).find((x) => x.id === id);
  const [title, setTitle] = useState(p ? p.title || "" : ""), [own, setOwn] = useState(false), [all, setAll] = useState(null), [err, setErr] = useState(false), [busy, setBusy] = useState(false);
  const ref = useAutoFocus();
  useEffect(() => { if (!p) return; let on = true; fb.fetchWhere("tasks", ["projectId", "==", p.id]).then((a) => on && setAll(a)).catch((e) => { console.error("[v2] 견본: 프로젝트 업무 불러오기 실패:", e); if (on) setErr(true); }); return () => { on = false; }; }, [id]);
  const tasks = all || (err && p ? (D.tasks || []).filter((t) => t.projectId === p.id) : null);
  const plan = useMemo(() => (p && tasks ? planTemplate(p, D, tasks, { title, withOwners: own, cu, users: D.users }) : null), [p, tasks, title, own, D]);
  if (!p) return <Sheet title="견본으로 저장" kind="견본" onBack={onBack} onClose={onClose}><Empty>이 프로젝트를 찾지 못했어요</Empty></Sheet>;
  if (!canSaveTpl(p, cu)) return <Sheet title="견본으로 저장" kind="견본" head={projLabel(p, D)} onBack={onBack} onClose={onClose}><Empty>책임자·관리자만 견본으로 저장할 수 있어요{p.secret && p.secret.on ? " · 기밀 프로젝트는 견본으로 못 만들어요" : ""}</Empty></Sheet>;
  const E = plan && plan.est, road = tplRoad(plan ? plan.doc : null), ok = !!plan && plan.n > 0 && !!title.trim() && !busy;
  const save = async () => { if (!ok) return; setBusy(true); const d = await A.tplSave(p, { ...plan.doc, title: title.trim() }); setBusy(false); if (d) { back(); open({ type: "template", id: d.id }); } };
  return <Sheet title="견본으로 저장" kind="견본" head={projLabel(p, D)} path="프로젝트 · 견본으로 저장" onBack={onBack} onClose={onClose}
    foot={<Big onClick={save} disabled={!ok}>{busy ? "저장하는 중…" : plan ? `견본 저장 · 업무 ${plan.n}개` : "견본 저장"}</Big>}>
    <label className="v2-lab" htmlFor="v2-tpn">견본 이름</label>
    <input id="v2-tpn" ref={ref} value={title} maxLength={TPL_NAME_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="예: 기획전 기본 순서" style={inp} />
    <div className="v2-lab">담당</div>
    <div className="v2-chips"><Chip on={own} onClick={() => setOwn(!own)}>{own ? "✓ " : ""}담당도 같이 저장</Chip></div>
    <div className="v2-tplnote">{own ? "업무마다 지금 담당이 새 프로젝트의 기본 담당이 돼요 (사용 안 하는 사람은 책임자로)" : "끄면 새 프로젝트에서 모두 책임자로 시작해요 · 만들 때 바꿀 수 있어요"}</div>
    <Head>저장할 것</Head>
    <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.75 }}>
      {!plan ? <div style={{ color: C.mute }}>업무를 불러오는 중…</div> : <>
        <div className="v2-tplsum"><b>업무 {plan.n}개</b> · {E.has ? `예상 소요 ${E.total}일` : "예상 소요 미정"}{E.missing ? ` · 소요일 미정 ${E.missing}개` : ""}</div>
        {road.length > 0 && <div style={{ color: C.sub }}>단계 {road.map((s) => s.name).join(" → ")}</div>}
        {(plan.skipped > 0 || plan.secret > 0) && <div style={{ color: C.sub }}>빼는 것: {[plan.skipped ? `중단·해당 없음 ${plan.skipped}개` : "", plan.secret ? `기밀 업무 ${plan.secret}개` : ""].filter(Boolean).join(" · ")}</div>}
        {plan.cut > 0 && <div style={{ color: C.ink, fontWeight: 700 }}>업무가 많아서 {TPL_MAX}개까지만 넣어요 · {plan.cut}개 빠져요</div>}
        {!E.has && plan.n > 0 && <div style={{ color: C.mute, fontSize: 12.5 }}>업무 시트 [더 하기 ▾] › '예상 소요'를 넣으면 견본에서 끝나는 날을 미리 볼 수 있어요</div>}
        {err && <div style={{ color: C.mute, fontSize: 12.5 }}>서버에서 못 불러와서 화면에 있는 업무만 넣어요 (끝낸 지 30일 넘은 업무는 빠질 수 있어요)</div>}</>}
    </Card>
    <ul className="v2-tplul">
      <li>복사: 업무 이름 · 하위 업무 · 앞 일 순서 · 단계 · 예상 소요일{own ? " · 담당" : ""}</li>
      <li>안 복사: 날짜 · 상태 · 댓글 · 파일 · 기록</li>
      <li>이 프로젝트는 그대로예요 · 견본은 팀 모두가 보고, 고치기는 나와 관리자만 해요</li>
    </ul>
  </Sheet>;
}

// ② 견본함 (모두 봄)
export function TplBoxSheet({ D, open, onBack, onClose }) {
  const list = D.templates || [];
  return <Sheet title={`견본함 ${list.length}`} onBack={onBack} onClose={onClose}>
    <div className="v2-tplnote" style={{ margin: "12px 2px 10px" }}>프로젝트 모양(업무 · 앞 일 순서 · 단계 · 예상 소요일)을 견본으로 두고 새 프로젝트를 바로 만들어요 · 모두 볼 수 있고, 고치기는 만든 사람·관리자만 해요</div>
    <Card>{!D.tplReady ? <Empty>불러오는 중…</Empty> : list.length === 0 ? <Empty>아직 견본이 없어요 · 프로젝트 [정보 · 더 하기 ▾] › [견본으로 저장]으로 만들어요</Empty>
      : list.map((t, i) => <TplRow key={t.id} D={D} t={t} onClick={() => open({ type: "template", id: t.id })} last={i === list.length - 1} />)}</Card>
  </Sheet>;
}

// ③ 견본 한 장
export function TplSheet({ D, cu, A, open, onBack, onClose, id }) {
  const tpl = (D.templates || []).find((x) => x.id === id) || (D.removedTemplates || []).find((x) => x.id === id);
  const [view, setView] = useLocal(LS("tplview"), "list");
  const [sel, setSel] = useState(""), [nm, setNm] = useState(""), [es, setEs] = useState(""), [more, setMore] = useState(false), [mode, setMode] = useState(""), [tn, setTn] = useState(""), [busy, setBusy] = useState(false);
  const [aT, setAT] = useState(""), [aP, setAP] = useState(null), [aE, setAE] = useState("");
  const E = useMemo(() => (tpl ? tplEst(tpl) : null), [tpl]);
  if (!tpl) return <Sheet title="견본" kind="견본" onBack={onBack} onClose={onClose}><Empty>{D.tplReady ? "이 견본을 찾지 못했어요" : "불러오는 중…"}</Empty></Sheet>;
  const rm = isRemoved(tpl), can = canEditTpl(tpl, cu) && !rm, road = tplRoad(tpl), kind = tplKind(tpl), live = tplLive(tpl), ks = new Set(live.map((x) => x.key));
  const kidsOf = (k) => live.filter((x) => x.parentKey === k), tops = live.filter((x) => !x.parentKey || !ks.has(x.parentKey));
  const esOf = (x) => ((E.node.get(x.key) || {}).es || 0), ord = new Map(live.map((x, i) => [x.key, i]));
  const sortT = (a) => a.slice().sort((x, y) => esOf(x) - esOf(y) || ord.get(x.key) - ord.get(y.key));
  const noL = kind === "launch" ? "기타" : "단계 미정", groups = [...road.map((s, i) => ({ k: s.k, name: s.name, num: i + 1 })), { k: "", name: noL, num: null }];
  const inGrp = (g) => sortT(tops.filter((x) => (g.k ? x.phase === g.k : !road.some((s) => s.k === x.phase))));
  const src = (D.projects || []).find((p) => p.id === tpl.srcProjectId);
  const who = (x) => (tpl.withOwners && x.assigneeId ? nameOf(D.users, x.assigneeId) : "");
  const pick = (x) => { if (!can) return; if (sel === x.key) { setSel(""); return; } setSel(x.key); setNm(x.title || ""); setEs(x.estDays ? String(x.estDays) : ""); };
  const saveItem = async (x) => { const n = estClean(es); if (Number.isNaN(n)) return; const f = {}; if (nm.trim() && nm.trim() !== x.title) f.title = nm.trim(); if ((n || null) !== (x.estDays || null)) f.estDays = n;
    if (!Object.keys(f).length) { setSel(""); return; } setBusy(true); const r = await A.tplItem(tpl, x.key, f, { title: x.title, estDays: x.estDays || null }); setBusy(false); if (r && r.ok) setSel(""); };
  const outItem = async (x) => { setBusy(true); const ok = await A.tplOut(tpl, x.key, true); setBusy(false); if (ok) setSel(""); };
  const addOk = !!aT.trim() && !Number.isNaN(estClean(aE)), addK = aP != null ? aP : (road[0] || {}).k || "";
  const addItem = async () => { if (!addOk) return; setBusy(true); const k = await A.tplAdd(tpl, { title: aT.trim(), phase: addK, estDays: estClean(aE) }); setBusy(false); if (k) { setAT(""); setAE(""); } };
  // 업무 줄 (함수로 그림 — 안의 입력 칸이 글자마다 다시 만들어지지 않게)
  const item = (x, kid) => { const on = sel === x.key, n = estOf(x), ed = on && can, bad = Number.isNaN(estClean(es));
    const sub = [daysL(n), who(x), (x.afterKeys || []).filter((k) => ks.has(k)).length ? `앞 일 ${(x.afterKeys || []).filter((k) => ks.has(k)).length}` : "", kidsOf(x.key).length ? `하위 ${kidsOf(x.key).length}` : ""].filter(Boolean).join(" · ");
    return <div key={x.key} className={"v2-tpli" + (kid ? " kid" : "") + (on ? " on" : "")}>
      {can ? <button type="button" className="hd" onClick={() => pick(x)} aria-expanded={on} aria-label={`${x.title} 고치기`}><span className="t">{x.title}</span><span className="s">{sub}</span></button>
        : <div className="hd"><span className="t">{x.title}</span><span className="s">{sub}</span></div>}
      {ed && <div className="ed">
        <input value={nm} onChange={(e) => setNm(e.target.value)} aria-label={`${x.title} 이름`} maxLength={200} style={{ ...inp, flex: "1 1 180px", minWidth: 0, padding: "9px 12px", fontSize: 14 }} />
        <label className="v2-more-date">예상 소요 <input type="number" inputMode="numeric" min={1} max={EST_MAX} value={es} onChange={(e) => setEs(e.target.value)} aria-label={`${x.title} 예상 소요일`} className="v2-sel v2-estin" /> 일</label>
        {bad && <div className="v2-tplerr">1~{EST_MAX} 사이 평일 수로 넣어 주세요 (비우면 미정)</div>}
        <div className="bt"><TBtn v="solid" disabled={busy || bad || !nm.trim()} onClick={() => saveItem(x)}>저장</TBtn><TBtn onClick={() => setSel("")}>닫기</TBtn><span style={{ flex: 1 }} /><TBtn tone="red" disabled={busy} onClick={() => outItem(x)}>빼기</TBtn></div>
      </div>}
    </div>; };
  const listView = <>{groups.map((g) => { const a = inGrp(g); if (!a.length && (!g.k || !road.length)) return null; const sp = g.k && E.stage.get(g.k);
      return <div key={g.k || "none"} className="v2-tplg" id={"v2-tg-" + (g.k || "none")}>
        <div className="v2-tplst"><b>{g.num != null ? `${g.num} ` : ""}{g.name}</b><span>{a.length ? `업무 ${a.length}개${sp && sp.span ? ` · ${sp.span}일` : ""}` : "비어 있어요"}</span></div>
        {a.length > 0 && <Card>{a.flatMap((x) => [item(x), ...kidsOf(x.key).flatMap((k) => [item(k, true), ...kidsOf(k.key).map((kk) => item(kk, true))])])}</Card>}
      </div>; })}
    {can && <Card style={{ marginTop: 14 }}><div className="v2-tpladd">
      <input value={aT} onChange={(e) => setAT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addItem(); }} placeholder="+ 견본에 업무 더하기" aria-label="견본에 업무 더하기" maxLength={200} style={{ ...inp, flex: "1 1 180px", minWidth: 0, padding: "9px 12px", fontSize: 14 }} />
      {road.length > 0 && <select aria-label="넣을 단계" value={addK} onChange={(e) => setAP(e.target.value)} className="v2-sel">{road.map((s) => <option key={s.k} value={s.k}>{s.name}</option>)}<option value="">{noL}</option></select>}
      <label className="v2-more-date"><input type="number" inputMode="numeric" min={1} max={EST_MAX} value={aE} onChange={(e) => setAE(e.target.value)} placeholder="소요" aria-label="더할 업무 예상 소요일" className="v2-sel v2-estin" /> 일</label>
      <TBtn v="soft" disabled={!addOk || busy} onClick={addItem}>더하기</TBtn></div></Card>}</>;
  return <Sheet title="견본" kind="견본" head={tpl.title || "(이름 없음)"} path={`견본함${KIND_L[kind] ? " · " + KIND_L[kind] : ""}`} onBack={onBack} onClose={onClose}
    foot={rm ? null : <Big onClick={() => open({ type: "tplNew", id: tpl.id })}>이 견본으로 새 프로젝트</Big>}>
    {rm && <RemovedNote what="없앤 견본이에요" rm={tpl.removed} can={canEditTpl(tpl, cu)} busy={busy} onRestore={async () => { setBusy(true); await A.tplRestore(tpl); setBusy(false); }} />}
    <div className="v2-tplinfo"><b>업무 {live.length}개 · {E.has ? `예상 소요 ${E.total}일` : "예상 소요 미정"}</b>{E.missing ? <span> · 소요일 미정 {E.missing}개</span> : null}</div>
    <div className="v2-tplnote">{tpl.createdByName || nameOf(D.users, tpl.createdBy) || "누군가"} 만듦 · {md(String(tpl.createdAt || "").slice(0, 10))}{tpl.srcTitle ? ` · '${tpl.srcTitle}'에서` : ""}{tpl.withOwners ? " · 담당도 저장" : ""}{road.length ? ` · 단계 ${road.map((s) => s.name).join(" → ")}` : ""}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 0" }}>
      {src && <TBtn onClick={() => open({ type: "project", id: src.id })}>원래 프로젝트 ›</TBtn>}
      {can && <TBtn onClick={() => setMore(!more)} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn>}</div>
    {more && can && <div className="v2-more" role="group" aria-label="더 하기">
      <TBtn v="soft" onClick={() => { setMore(false); setTn(tpl.title || ""); setMode("name"); }}>이름 고치기</TBtn>
      <TBtn tone="red" onClick={() => { setMore(false); setMode("rm"); }}>없애기</TBtn></div>}
    {mode === "name" && can && (() => { const v = tn.trim(), ok = !!v && v !== String(tpl.title || "").trim(), go = async () => { if (!ok || busy) return; setBusy(true); const r = await A.tplRename(tpl, v, tpl.title || ""); setBusy(false); if (r && r.ok) setMode(""); };
      return <div className="v2-rename" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0" }}><input value={tn} onChange={(e) => setTn(e.target.value)} autoFocus maxLength={TPL_NAME_MAX} aria-label="견본 새 이름" onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) go(); if (e.key === "Escape") setMode(""); }} style={{ ...inp, flex: "1 1 200px", minWidth: 0 }} />
        <div style={{ display: "flex", gap: 8 }}><TBtn v="solid" onClick={go} disabled={!ok || busy}>저장</TBtn><TBtn onClick={() => setMode("")}>취소</TBtn></div></div>; })()}
    {mode === "rm" && can && <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>이 견본을 견본함에서 뺄까요?</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
        <li>견본함 · 새 프로젝트 고르기에서 빠져요</li><li>이 견본으로 만든 프로젝트는 그대로예요</li><li>더보기 · 관리자 정리 '없앤 견본'에서 되살릴 수 있어요</li></ul>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={() => setMode("")}>그만</TBtn><TBtn tone="red" disabled={busy} onClick={async () => { setBusy(true); const ok = await A.tplRemove(tpl); setBusy(false); if (ok) (onBack || onClose)(); }}>없애기</TBtn></div></Card>}
    {!can && !rm && <div className="v2-tplnote" style={{ marginTop: 8 }}>고치기는 만든 사람({tpl.createdByName || nameOf(D.users, tpl.createdBy) || "-"})·관리자만 해요 · 새 프로젝트는 누구나 만들어요</div>}
    {can && <div className="v2-tplnote" style={{ marginTop: 8 }}>업무를 누르면 이름 · 예상 소요일을 고치거나 뺄 수 있어요</div>}
    <div style={{ margin: "14px 0 4px" }}><Seg items={[["list", `목록 ${live.length}`], ["map", "마인드맵"]]} value={view} onChange={setView} /></div>
    {view === "map" ? <TplMap D={D} tpl={tpl} E={E} /> : listView}
  </Sheet>;
}

// ④ 견본으로 새 프로젝트 — 누구나 · 시작일부터 앞 일 순서대로 평일 기한 · 한 번에 만듦(되돌리기 5초)
export function TplNewSheet({ D, cu, A, open, closeAll, onBack, onClose, id }) {
  const tpl = (D.templates || []).find((x) => x.id === id), key = ymd(new Date());
  const [title, setTitle] = useState(tpl ? tpl.title || "" : ""), [lead, setLead] = useState(cu.id), [start, setStart] = useState(key), [brand, setBrand] = useState(tpl ? tpl.brand || "" : "");
  const [owners, setOwners] = useState({}), [ow, setOw] = useState(false), [busy, setBusy] = useState(false);
  const ref = useAutoFocus();
  const past = !!start && start < key;
  const plan = useMemo(() => (tpl && title.trim() && !past ? planFromTemplate(tpl, { title, leadId: lead, start, brand, owners }, D, cu, key) : null), [tpl, title, lead, start, brand, owners, D, past]);
  if (!tpl) return <Sheet title="견본으로 새 프로젝트" kind="견본" onBack={onBack} onClose={onClose}><Empty>{D.tplReady ? "이 견본을 찾지 못했어요 (없앤 견본일 수 있어요)" : "불러오는 중…"}</Empty></Sheet>;
  const kind = tplKind(tpl), launch = kind === "launch", people = activeUsers(D.users), live = tplLive(tpl);
  const brands = (D.brands || []).filter((b) => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  const brandL = (b) => ((D.brands || []).find((x) => x.id === b) || LAUNCH_BRANDS[b] || {}).name || "";
  const ok = !!plan && !busy && (!launch || !!brand);
  const missing = [!title.trim() && "이름", launch && !brand && "브랜드", past && "시작일"].filter(Boolean);
  const save = async () => { if (!ok) return; setBusy(true); const pl = planFromTemplate(tpl, { title, leadId: lead, start, brand, owners }, D, cu, ymd(new Date()), new Date().toISOString());
    const p = await A.tplCreate(pl, tpl); setBusy(false); if (p) { closeAll(); open({ type: "project", id: p.id }); } };
  const wf = kind === "flow" ? (flowList(D).find((w) => w.id === tpl.wfId) || {}).name : "";
  const ownL = (x) => { const o = tplOwnerOf(tpl, x, { leadId: lead, owners }, D, cu); return o.id; };
  return <Sheet title="견본으로 새 프로젝트" kind="견본" head={tpl.title} path="견본함 · 새 프로젝트" onBack={onBack} onClose={onClose}
    foot={<>{missing.length > 0 && <div style={{ fontSize: 13, color: C.sub, margin: "0 2px 8px" }}>먼저 정할 것: <b style={{ color: C.ink }}>{missing.join(" · ")}</b></div>}
      <Big onClick={save} disabled={!ok}>{busy ? "만드는 중…" : plan ? `만들기 · 업무 ${plan.tasks.length}개` : "만들기"}</Big></>}>
    <label className="v2-lab" htmlFor="v2-tnn">{launch ? "제품 이름" : "프로젝트 이름"}</label>
    <input id="v2-tnn" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 11월 기획전" style={inp} />
    <label className="v2-lab" htmlFor="v2-tns">시작일 <span style={{ color: C.mute, fontWeight: 600 }}>(오늘부터 · 쉬는 날이면 다음 평일)</span></label>
    <input id="v2-tns" type="date" value={start} min={key} onChange={(e) => setStart(e.target.value || key)} style={inp} />
    {past && <div className="v2-tplerr">지난 날은 고를 수 없어요 · 오늘({md(key)})부터 골라 주세요</div>}
    <div className="v2-lab">책임자</div><div className="v2-chips"><Chip on={lead === cu.id} onClick={() => setLead(cu.id)}>나</Chip>{lead !== cu.id && <Chip on>{nameOf(D.users, lead)}</Chip>}<select aria-label="책임자" className="v2-sel" value="" onChange={(e) => e.target.value && setLead(e.target.value)}><option value="">다른 사람 ▾</option>{people.filter((u) => u.id !== cu.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="v2-lab">브랜드 <span style={{ color: C.mute, fontWeight: 600 }}>{launch ? "(필수)" : "(선택)"}</span></div>
    <div className="v2-chips">{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => setBrand(brand === b.id && !launch ? "" : b.id)}>{b.name}</Chip>)}</div>
    <div className="v2-lab">담당</div>
    <div className="v2-tplnote">{tpl.withOwners ? "견본에 저장한 담당대로 (사용 안 하는 사람은 책임자로)" : `모두 책임자(${lead === cu.id ? "나" : nameOf(D.users, lead)})로`} · 다른 사람 업무는 그 사람 '확인할 것'에 맡김으로 떠요</div>
    <div style={{ marginTop: 6 }}><TBtn onClick={() => setOw(!ow)} aria-expanded={ow}>{ow ? "업무마다 담당 접기 ▴" : "업무마다 담당 바꾸기 ▾"}</TBtn></div>
    {ow && <Card style={{ marginTop: 8 }}>{live.map((x, i) => <div key={x.key} className={"v2-tplown" + (x.parentKey ? " kid" : "")} style={{ borderBottom: i < live.length - 1 ? `1px solid ${C.line}` : "none" }}>
      <span className="t">{x.title}</span>
      <select aria-label={`${x.title} 담당`} className="v2-sel" value={ownL(x)} onChange={(e) => setOwners({ ...owners, [x.key]: e.target.value })}>{people.map((u) => <option key={u.id} value={u.id}>{u.id === cu.id ? "나" : u.name}</option>)}</select></div>)}</Card>}
    <Head>미리 보기</Head>
    {!plan ? <Card><Empty>이름과 시작일을 넣으면 업무마다 기한이 평일로 들어가요</Empty></Card>
      : <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.75 }}>
        <div className="v2-tplprev"><b>업무 {plan.tasks.length}개 · {plan.end ? `끝 예상 ${md(plan.end)}` : "끝 예상 미정"}</b></div>
        <div style={{ color: C.sub }}>시작 {md(plan.start)}{plan.end ? ` → ${md(plan.end)} · 평일 ${plan.total}일 (주말·쉬는 날 빼고)` : " · 견본에 예상 소요일이 없어서 끝 날짜를 못 정해요"}</div>
        {launch && <div style={{ color: C.sub }}>출시일 {plan.launchDate ? md(plan.launchDate) : "미정"} (출시 전 항목이 끝나는 날) · 업무OS에서만 쓰는 신제품이라 신제품 대시보드엔 안 들어가요{brand ? ` · ${brandL(brand)}` : ""}</div>}
        {kind === "flow" && <div style={{ color: C.sub }}>흐름{wf ? ` '${wf}'` : ""} · 앞 단계 업무가 모두 끝나야 다음 단계 차례예요</div>}
        {plan.noDue > 0 && <div style={{ color: C.sub }}>소요일 미정 {plan.noDue}개는 기한 없이 만들어요 (나중에 기한을 넣어요)</div>}
        <div style={{ marginTop: 8, fontWeight: 800, color: C.ink }}>담당별 (새 업무 · 지금 열린 일)</div>
        {Object.entries(plan.byWho).sort((a, b) => b[1].length - a[1].length).map(([uid, a]) => { const w = workloadOf(D, uid, new Date());
          return <div key={uid} style={{ color: C.sub }}>{nameOf(D.users, uid) || "담당 없음"} · 새 {a.length}개 · 열린 {w.open}{w.late ? <b style={{ color: C.red }}> · 지난 일 {w.late}</b> : ""}</div>; })}
        <div style={{ marginTop: 8, color: C.mute, fontSize: 12.5 }}>만든 뒤 업무마다 담당·기한을 바꿀 수 있어요 · 만들고 5초 안에 되돌리면 통째로 휴지통으로 가요</div>
      </Card>}
  </Sheet>;
}

// '+ 새 프로젝트' › '견본으로 만들기' — 견본 고르기
export function TplPick({ D, open }) {
  const list = D.templates || [];
  return <Card>{!D.tplReady ? <Empty>불러오는 중…</Empty> : list.length === 0 ? <Empty>아직 견본이 없어요 · 프로젝트 [정보 · 더 하기 ▾] › [견본으로 저장]으로 먼저 만들어요</Empty>
    : list.map((t, i) => <TplRow key={t.id} D={D} t={t} onClick={() => open({ type: "tplNew", id: t.id })} last={i === list.length - 1} />)}</Card>;
}
