// 업무OS v2 — 레퍼런스 화면 (사용자 확정 2026-10-17 · 계산 refs.js · 저장 core.refAdd·refEdit·refHide·refFit·refUnfit·refKindsSet)
//   모두 보는 곳(RefSheet · 더보기 › 레퍼런스 · 관리자 머리 [레퍼런스]): 위 올리기 칸(링크·글 한 줄 · 캡처 Ctrl+V · [+ 사진] · @받을 사람 · 종류 · 브랜드 · 연결) → [올리기]
//     아래 거르기(종류 · 브랜드 · 찾기 · AI 핏 있는 것) · 카드(사진 · 종류 · 한 줄 · 링크 · 누가·언제 · 받을 사람 · 연결 · AI 핏 · 대화 수) → 누르면 한 장
//   한 장(RefOneSheet): 글·사진·링크 · 연결(프로젝트 ›·업무 ›) · [고치기]·[숨기기] · AI 핏(그 AI · 쓸 부분 한 줄 · [빼기]) · 대화(댓글 itemId 'ref:<id>')
//   프로젝트 자료 탭 · 업무 화면(RefStrip): 그 프로젝트·업무에 연결한 것 + [+ 레퍼런스](그 연결로 올리기 칸이 열림)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { C, TBtn, Chip, Card, Empty, Sheet, Head, Row, Linked, More, inp } from "./ui.jsx";
import { md, hm, isMaster, nameOf, projOpen, projMine, projLabel, projLabelOf, isRemoved } from "./model.js";
import { NoteFiles, useUploads, UpList, pasteFiles, usePasteFiles, PASTE_HINT } from "./files.jsx";
import { mentionPick, insertMention, parseMentions } from "./mention.js";
import { Thread, useItemNotes } from "./task.jsx";
import { viewOnlyOn } from "./viewonly.js";
import { BRAND_L } from "../../marketing-hub/crew.js";
import {
  refKindsOf, refList, refLive, refMerge, refsOfProj, refsOfTask, refNoteId, refMissing, refTitle, refFirstImg, urlHost, fitNames, refFitMates, refMateName, dayOf,
  canRefEdit, canRefHide, canRefFit, canRefFitAny, canRefUnfit, fitBlock, mateOwnerIds, REF_FIT_DEFAULT, REF_FILES_MAX, REF_TEXT_MAX, REF_FIT_MAX, REF_LIVE_DAYS, REF_KINDS,
} from "./refs.js";

// 구독(최근 90일) 밖에서 따로 읽은 것 — [이전 것 불러오기] · 프로젝트·업무 칸 · 한 장을 id 로 → 이 기기 화면 모두가 같이 봄
const extra = new Map(), subs = new Set();
const addExtra = (rows) => { let ch = false; (rows || []).forEach((r) => { if (r && r.id) { extra.set(r.id, r); ch = true; } }); if (ch) subs.forEach((f) => f()); };
export function useRefs(D) {
  const [v, setV] = useState(0);
  useEffect(() => { const f = () => setV((x) => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return useMemo(() => refMerge([...extra.values()], (D.refs && D.refs.list) || []), [D.refs, v]);
}
const old90 = () => new Date(Date.now() - REF_LIVE_DAYS * 864e5).toISOString();
// 프로젝트·업무가 90일보다 오래됐으면 그 연결로 한 번 더 읽음 (최근 것은 구독에 다 있음)
function useLinkedFetch(field, id, createdAt) {
  useEffect(() => { if (!id || (createdAt && String(createdAt) >= old90())) return;
    fb.fetchWhere("refs", [field, "==", id]).then(addExtra).catch((e) => console.error(`[v2 refs ${field}] 읽기 실패:`, e)); }, [field, id]);
}
const brandsOf = (brands) => (brands || []).filter((b) => b && b.active !== false && b.id !== "common").sort((a, b) => (+a.order || 0) - (+b.order || 0));
const brandName = (id, brands) => (brands || []).find((b) => b && b.id === id)?.name || BRAND_L[id] || "";
const noteCount = (D, id) => (D.notes || []).filter((n) => n && n.itemId === refNoteId(id) && !n.deleted).length;

// ───────── 올리기 칸 (모두 보는 곳 맨 위 · 프로젝트·업무에서 [+ 레퍼런스]) ─────────
function RefNew({ D, cu, A, preset, app, onDone }) {
  const kinds = refKindsOf(D.settings), brands = brandsOf(D.brands);
  const [text, setText] = useState(""), [kind, setKind] = useState(preset.kind || ""), [brand, setBrand] = useState(preset.brand || ""), [proj, setProj] = useState(preset.projectId || ""), [task, setTask] = useState(preset.taskId || ""), [busy, setBusy] = useState(false), [tried, setTried] = useState(false);
  const U = useUploads(A, "ref"), fileRef = useRef(null), boxRef = useRef(null), taRef = useRef(null);
  const take = (fs) => { const room = Math.max(0, REF_FILES_MAX - U.rows.length); if (room && fs.length) U.add(fs.slice(0, room)); };
  usePasteFiles(boxRef, take, true);
  const pick = mentionPick(text, D.users, cu.id), tagged = parseMentions(text, D.users).filter((id) => id !== cu.id);
  const miss = refMissing({ text, kind }, U.rows.length), tk = task ? D.tasks.find((t) => t.id === task) : null;
  const myP = useMemo(() => (D.projects || []).filter((p) => projOpen(p) && !isRemoved(p)).sort((a, b) => (projMine(b, cu.id, D.tasks) ? 1 : 0) - (projMine(a, cu.id, D.tasks) ? 1 : 0) || String(a.title || "").localeCompare(String(b.title || ""))), [D.projects, D.tasks, cu.id]);
  const send = async () => { setTried(true); if (miss || busy || U.busy) return; setBusy(true);
    try { await U.flow(); const rows = U.cur(); if (rows.some((r) => r.st !== "ok")) return;
      const r = await A.refAdd({ text, kind, brand, projectId: proj, taskId: task, files: rows.map((x) => x.meta), app });
      if (r) { setText(""); U.clear(); setTried(false); if (onDone) onDone(r); } }
    finally { setBusy(false); } };
  return <div ref={boxRef} className="v2-rf-new" role="group" aria-label="레퍼런스 올리기">
    <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={REF_TEXT_MAX} rows={3} aria-label="레퍼런스 글"
      placeholder={`링크를 붙이고 무엇을 참고할지 한 줄 (예: 첫 화면 구성만)\n@이름 = 받을 사람(선택)${PASTE_HINT ? ` · ${PASTE_HINT}` : ""}`}
      onPaste={(e) => { const f = pasteFiles(e); if (!f.length) return; if (!e.clipboardData.getData("text/plain")) e.preventDefault(); take(f); }} />
    {pick.length > 0 && <div className="v2-chips" role="listbox" aria-label="받을 사람 고르기">{pick.map((u) => <Chip key={u.id} onClick={() => { setText(insertMention(text, u.name)); setTimeout(() => taRef.current && taRef.current.focus(), 0); }}>@{u.name}</Chip>)}</div>}
    {tagged.length > 0 && <div className="v2-rf-hint">받을 사람 {tagged.map((id) => nameOf(D.users, id)).join(" · ")} · 그 사람 '확인할 것'에 떠요 (다른 사람도 여기서 봐요)</div>}
    <UpList U={U} onDrop={(k) => U.drop(k)} />
    <div className="v2-rf-l">종류</div>
    <div className="v2-chips" role="group" aria-label="종류 고르기">{kinds.map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</Chip>)}</div>
    <div className="v2-rf-l">브랜드 <span>(선택)</span></div>
    <div className="v2-chips" role="group" aria-label="브랜드 고르기"><Chip on={!brand} onClick={() => setBrand("")}>공통</Chip>{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => setBrand(b.id)}>{b.name}</Chip>)}</div>
    <div className="v2-rf-l">연결 <span>(선택 · 그 프로젝트·업무 화면에도 보여요)</span></div>
    {tk ? <div className="v2-chips"><Chip on onClick={() => setTask("")}>업무 · {tk.title} ✕</Chip>{tk.projectId && <span className="v2-rf-hint" style={{ margin: 0 }}>{projLabelOf(D, tk.projectId)}</span>}</div>
      : <select className="v2-sel" value={proj} onChange={(e) => setProj(e.target.value)} aria-label="프로젝트 연결" style={{ width: "100%", maxWidth: 420 }}>
        <option value="">프로젝트 연결 안 함</option>{myP.map((p) => <option key={p.id} value={p.id}>{projLabel(p, D)}</option>)}</select>}
    <div className="v2-dr-row">
      <TBtn onClick={() => fileRef.current && fileRef.current.click()} disabled={busy || U.busy}>+ 사진</TBtn>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden aria-label="붙일 사진" onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; take(f); }} />
      <span className="v2-dr-hint" style={{ color: tried && miss ? C.red : undefined }}>{tried && miss ? miss : PASTE_HINT ? "캡처 → Ctrl+V 면 바로 붙어요" : "캡처는 [+ 사진]으로"}</span>
      <TBtn v="solid" disabled={busy || U.busy || (!text.trim() && !U.rows.length)} onClick={send} style={{ minWidth: 72, height: 36 }}>{busy || U.busy ? "올리는 중" : "올리기"}</TBtn></div>
  </div>;
}

// ───────── 카드 (목록 한 장) ─────────
function RefCard({ D, r, onOpen }) {
  const img = refFirstImg(r), host = r.url ? urlHost(r.url) : "", fits = fitNames(r), nN = noteCount(D, r.id), bn = brandName(r.brand, D.brands);
  const to = (r.to || []).map((id) => nameOf(D.users, id)).filter(Boolean), pj = r.projectId ? projLabelOf(D, r.projectId) : "", tk = r.taskId ? (D.tasks.find((t) => t.id === r.taskId) || {}).title : "";
  return <button type="button" className="v2-rf" onClick={onOpen} aria-label={`레퍼런스 · ${r.kind} · ${refTitle(r)}`}>
    {img && <span className="th"><img src={img.url} alt="" loading="lazy" decoding="async" /></span>}
    <span className="bd">
      <span className="tg"><b>{r.kind || "기타"}</b>{bn && <i>{bn}</i>}{fits.length > 0 && <em>AI 핏 {fits.join("·")}</em>}</span>
      <span className="tx">{refTitle(r)}</span>
      {host && <span className="ln">🔗 {host}</span>}
      {(pj || tk) && <span className="ln">{tk ? `업무 · ${tk}` : `프로젝트 · ${pj}`}</span>}
      <span className="mt">{r.byName || nameOf(D.users, r.by)} · {md(dayOf(r.at))}{to.length ? ` · → ${to.join("·")}` : ""}{nN ? ` · 대화 ${nN}` : ""}{(r.files || []).length > 1 ? ` · 사진 ${(r.files || []).length}` : ""}</span>
    </span>
  </button>;
}

// ───────── 모두 보는 곳 ─────────
// s = {preset:{projectId, taskId, kind}, f:{proj, task, fit, kind}, app}
export function RefSheet({ D, cu, A, open, onBack, onClose, s = {} }) {
  const all = useRefs(D), ro = !!viewOnlyOn(), master = isMaster(cu);
  const f0 = s.f || {}, kinds = refKindsOf(D.settings), brands = brandsOf(D.brands);
  const [fk, setFk] = useState(f0.kind || ""), [fbr, setFbr] = useState(""), [q, setQ] = useState(""), [fit, setFit] = useState(f0.fit || ""), [mine, setMine] = useState(false), [scope, setScope] = useState(f0.proj ? "proj" : f0.task ? "task" : "");
  const [older, setOlder] = useState(""), [kEdit, setKEdit] = useState(false);
  const list = refList(all, { kind: fk, brand: fbr, q, fit, mine: mine ? cu.id : "", proj: scope === "proj" ? f0.proj : "", task: scope === "task" ? f0.task : "" }, D);
  const loadOld = async () => { if (older) return; setOlder("loading");
    try { addExtra(await fb.fetchWhere("refs", ["updatedAt", "<", old90()])); setOlder("done"); } catch (e) { console.error("[v2 refs] 이전 것 불러오기 실패:", e); setOlder("fail"); } };
  const scopeL = scope === "proj" ? `프로젝트 · ${projLabelOf(D, f0.proj) || ""}` : scope === "task" ? `업무 · ${(D.tasks.find((t) => t.id === f0.task) || {}).title || ""}` : "";
  return <Sheet title="레퍼런스" kind="업무OS" head="레퍼런스" path="팀이 같이 보는 참고 자료 · 링크·캡처 한 장 + 무엇을 참고할지 한 줄" onBack={onBack} onClose={onClose}>
    {!ro && <div style={{ marginTop: 12 }}><RefNew D={D} cu={cu} A={A} preset={s.preset || {}} app={s.app} /></div>}
    <div className="v2-rf-filter" role="group" aria-label="레퍼런스 거르기">
      {scopeL && <div className="v2-chips"><Chip on onClick={() => setScope("")}>{scopeL} ✕</Chip></div>}
      <div className="v2-chips" role="group" aria-label="종류로 거르기"><Chip on={!fk} onClick={() => setFk("")}>전체</Chip>{kinds.map((k) => <Chip key={k} on={fk === k} onClick={() => setFk(fk === k ? "" : k)}>{k}</Chip>)}</div>
      <div className="v2-rf-frow">
        <select className="v2-sel" value={fbr} onChange={(e) => setFbr(e.target.value)} aria-label="브랜드로 거르기"><option value="">브랜드 모두</option><option value="-">공통</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="v2-sel" value={fit} onChange={(e) => setFit(e.target.value)} aria-label="AI 핏으로 거르기"><option value="">AI 핏 모두</option>{refFitMates().map((m) => <option key={m.id} value={m.id}>{m.name} 핏</option>)}</select>
        <Chip on={mine} onClick={() => setMine(!mine)}>내가 올린 것</Chip>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기" aria-label="레퍼런스 찾기" className="v2-rf-q" style={{ ...inp, height: 38, padding: "0 12px", fontSize: 16 }} />
      </div>
    </div>
    {!(D.refs && D.refs.ready) ? <Card style={{ marginTop: 12 }}><Empty>불러오는 중…</Empty></Card>
      : !list.length ? <Card style={{ marginTop: 12 }}><Empty>{fk || fbr || q || fit || mine || scope ? "맞는 레퍼런스가 없어요 · 거르기를 풀어 보세요" : "아직 올린 레퍼런스가 없어요 · 위 칸에 링크나 캡처를 붙여 주세요"}</Empty></Card>
      : <div className="v2-rf-list">{list.map((r) => <RefCard key={r.id} D={D} r={r} onOpen={() => open({ type: "ref", id: r.id })} />)}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      <TBtn tone="mute" onClick={loadOld} disabled={older === "loading" || older === "done"}>{older === "loading" ? "불러오는 중…" : older === "done" ? "이전 것까지 다 봤어요" : older === "fail" ? "못 불러왔어요 · 다시 ›" : `${REF_LIVE_DAYS}일보다 이전 것 불러오기 ›`}</TBtn>
      {master && !ro && <TBtn tone="mute" onClick={() => setKEdit(!kEdit)}>{kEdit ? "종류 고치기 닫기" : "종류 고치기"}</TBtn>}</div>
    {kEdit && master && <KindsEdit D={D} A={A} onDone={() => setKEdit(false)} />}
    <p style={{ fontSize: 12, color: C.mute, margin: "12px 2px 0", lineHeight: 1.6 }}>누구나 올려요 · 모두 봐요 · 받을 사람(@)은 '확인할 것'에도 떠요 · AI 크루는 사람이 'AI 핏'(어느 부분만 쓸지)을 남긴 것만 그 부분만 참고해요 · 올린 사람은 그날 안에 숨길 수 있어요(지우지 않음)</p>
  </Sheet>;
}

// 종류 칩 고치기 (관리자) — 한 줄에 하나 · 비우면 기본
function KindsEdit({ D, A, onDone }) {
  const cur = refKindsOf(D.settings), [v, setV] = useState(cur.join("\n")), [busy, setBusy] = useState(false);
  return <Card style={{ marginTop: 10, padding: 12 }}>
    <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 6 }}>종류를 한 줄에 하나씩 (12자 · 16개까지) · 바꿔도 이미 올린 것의 종류는 그대로예요 · 다 지우면 기본({REF_KINDS.join(" · ")})</div>
    <textarea value={v} onChange={(e) => setV(e.target.value)} rows={7} aria-label="레퍼런스 종류" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>취소</TBtn>
      <TBtn v="solid" disabled={busy} onClick={async () => { setBusy(true); const ok = await A.refKindsSet(v.split("\n")); setBusy(false); if (ok) onDone(); }}>종류 저장</TBtn></div>
  </Card>;
}

// ───────── 한 장 ─────────
function useRef1(D, all, id) {
  const live = all.find((r) => r.id === id), [miss, setMiss] = useState(false);
  useEffect(() => { if (live || miss) return; fb.fetchWhere("refs", ["id", "==", id]).then((a) => { if (a.length) addExtra(a); else setMiss(true); }).catch((e) => { console.error("[v2 ref] 불러오기 실패:", e); setMiss(true); }); }, [id, !!live]);
  return live || (miss ? false : undefined);
}
export function RefOneSheet({ D, cu, A, open, onBack, onClose, id, focus, note }) {
  const all = useRefs(D), r = useRef1(D, all, id), notes = useItemNotes(D, refNoteId(id)), ro = !!viewOnlyOn();
  const [mode, setMode] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { if (focus !== "talk" || !r) return; const h = setTimeout(() => { const el = document.getElementById("v2-rf-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150); return () => clearTimeout(h); }, [focus, !!r]);
  if (r === undefined) return <Sheet title="레퍼런스" kind="레퍼런스" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (r === false) return <Sheet title="레퍼런스" kind="레퍼런스" onBack={onBack} onClose={onClose}><Empty>이 레퍼런스를 찾지 못했어요</Empty></Sheet>;
  const gone = !refLive(r), bn = brandName(r.brand, D.brands), to = (r.to || []).map((x) => nameOf(D.users, x)).filter(Boolean);
  const pj = r.projectId ? (D.projects || []).find((p) => p.id === r.projectId) : null, tk = r.taskId ? D.tasks.find((t) => t.id === r.taskId) : null;
  const mates = (D.ai && D.ai.mates) || {}, fits = Object.entries(r.fits || {}).filter(([, v]) => v && String(v.text || "").trim()).sort((a, b) => String(b[1].at || "").localeCompare(String(a[1].at || "")));
  const canFit = !ro && !gone && canRefFitAny(r, cu, mates);
  return <Sheet title="레퍼런스" kind="레퍼런스" head={refTitle(r)} path={[r.kind, bn].filter(Boolean).join(" · ")} onBack={onBack} onClose={onClose}>
    {gone && <div className="v2-rf-gone">숨긴 레퍼런스예요 · {r.removed.byName || ""} {md(dayOf(r.removed.at))} · 목록·AI 지시문에서 빠졌어요{isMaster(cu) && !ro && <> · <TBtn onClick={() => A.refShow(r)}>다시 보이기</TBtn></>}</div>}
    {mode === "edit" ? <RefEdit D={D} cu={cu} A={A} r={r} onDone={() => setMode("")} />
      : <Card style={{ marginTop: 12, padding: "12px 14px" }}>
        <div className="v2-rf-tags"><b>{r.kind || "기타"}</b>{bn && <i>{bn}</i>}</div>
        <div style={{ fontSize: 15, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6 }}><Linked text={r.text || ""} /></div>
        <div style={{ marginTop: 8 }}><NoteFiles files={r.files} /></div>
        <div style={{ fontSize: 12.5, color: C.mute, marginTop: 8, lineHeight: 1.6 }}>{r.byName || nameOf(D.users, r.by)} · {md(dayOf(r.at))} {hm(r.at)}{r.editedAt ? ` · 고침 ${r.editedByName || ""} ${md(dayOf(r.editedAt))}` : ""}{to.length ? ` · 받을 사람 ${to.join("·")}` : ""}</div>
        {(pj || tk) && <div className="v2-chips" style={{ marginTop: 8 }}>
          {tk && <Chip onClick={() => open({ type: "task", id: tk.id })}>업무 · {tk.title} ›</Chip>}
          {pj && <Chip onClick={() => open({ type: "project", id: pj.id, first: "files" })}>프로젝트 · {projLabel(pj, D)} ›</Chip>}
          {!pj && tk && tk.projectId && <Chip onClick={() => open({ type: "project", id: tk.projectId, first: "files" })}>프로젝트 · {projLabelOf(D, tk.projectId)} ›</Chip>}</div>}
        {!ro && !gone && (canRefEdit(r, cu) || canRefHide(r, cu)) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {canRefEdit(r, cu) && <TBtn onClick={() => setMode("edit")}>고치기</TBtn>}
          {canRefHide(r, cu) && <TBtn tone="red" disabled={busy} onClick={async () => { setBusy(true); await A.refHide(r); setBusy(false); }}>숨기기</TBtn>}</div>}
      </Card>}
    <Head right={canFit && mode !== "fit" && <TBtn onClick={() => setMode("fit")}>+ AI 핏 남기기</TBtn>}>AI 핏 {fits.length}</Head>
    <div style={{ fontSize: 12.5, color: C.sub, margin: "-2px 2px 8px", lineHeight: 1.6 }}>핏을 남긴 AI만 다음 루틴부터 '쓸 부분'만 참고해요 (그대로 베끼지 않아요) · 남기는 사람 = 관리자 · 올린 사람 · 그 AI 담당</div>
    {mode === "fit" && <FitNew D={D} cu={cu} A={A} r={r} mates={mates} onDone={() => setMode("")} />}
    {fits.length > 0 ? <Card>{fits.map(([k, v], i) => <div key={k} className="v2-rf-fit" role="group" aria-label={`${refMateName(k)} 핏`} style={{ borderBottom: i < fits.length - 1 ? `1px solid ${C.line}` : "none" }}>
        <div className="hd"><b>{refMateName(k)}</b><span>{v.byName || ""} · {md(dayOf(v.at))}</span>{!ro && canRefUnfit(r, cu, k, mates) && <TBtn tone="mute" onClick={() => A.refUnfit(r, k)} aria-label={`${refMateName(k)} 핏 빼기`}>빼기</TBtn>}</div>
        <div className="tx">쓸 부분 · {v.text}</div></div>)}</Card>
      : mode !== "fit" && <Card><Empty>아직 AI 핏이 없어요 · AI가 이 레퍼런스를 쓰려면 [+ AI 핏 남기기]로 어느 부분만 쓸지 남겨 주세요</Empty></Card>}
    <div id="v2-rf-talk" style={{ scrollMarginTop: 8 }}><Head>대화 {notes.filter((x) => !x.deleted).length}</Head></div>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={refNoteId(r.id)} ctx={{ projectId: r.projectId || "" }} hl={note} readOnly={gone} />
  </Sheet>;
}

// AI 핏 남기기 — AI 고르기(종류에 맞춰 하나 골라 둠 · 내가 담당인 AI 먼저) + 쓸 부분 한 줄
function FitNew({ D, cu, A, r, mates, onDone }) {
  const ms = refFitMates().filter((m) => canRefFit(r, cu, m.id, mates)), def = REF_FIT_DEFAULT[r.kind];
  const mineFirst = ms.slice().sort((a, b) => (mateOwnerIds(mates[b.id]).includes(cu.id) ? 1 : 0) - (mateOwnerIds(mates[a.id]).includes(cu.id) ? 1 : 0));
  const [mate, setMate] = useState(ms.some((m) => m.id === def) ? def : (mineFirst[0] || {}).id || ""), cur = ((r.fits || {})[mate] || {}).text || "";
  const [t, setT] = useState(cur), [busy, setBusy] = useState(false);
  useEffect(() => { setT(((r.fits || {})[mate] || {}).text || ""); }, [mate]);
  const why = t.trim() ? fitBlock(r, t) : "";
  return <Card style={{ padding: 12, marginBottom: 10 }}>
    <div className="v2-rf-l" style={{ marginTop: 0 }}>어느 AI가</div>
    <div className="v2-chips" role="group" aria-label="핏 남길 AI">{mineFirst.map((m) => <Chip key={m.id} on={mate === m.id} onClick={() => setMate(m.id)}>{m.name}{(r.fits || {})[m.id] ? " ✓" : ""}</Chip>)}</div>
    {mate && <div style={{ fontSize: 12, color: C.mute, margin: "6px 2px 0" }}>{(ms.find((m) => m.id === mate) || {}).role || ""}</div>}
    <div className="v2-rf-l">어느 부분만 쓰게 할까요?</div>
    <textarea value={t} onChange={(e) => setT(e.target.value)} rows={2} maxLength={REF_FIT_MAX} aria-label="쓸 부분" placeholder="예: 첫 화면 구성과 버튼 위치만 · 색·문구는 쓰지 않음" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
    {why && <div style={{ fontSize: 12.5, color: C.red, marginTop: 6 }}>{why}</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>취소</TBtn>
      <TBtn v="solid" disabled={busy || !mate || !t.trim() || !!why} onClick={async () => { setBusy(true); const ok = await A.refFit(r, mate, t); setBusy(false); if (ok) onDone(); }}>{cur ? "핏 바꾸기" : "핏 남기기"}</TBtn></div>
  </Card>;
}

// 고치기 — 글 · 종류 · 브랜드 · 프로젝트 연결 (사진은 그대로 · 연 때 본 판 그대로일 때만)
function RefEdit({ D, cu, A, r, onDone }) {
  const kinds = refKindsOf(D.settings), brands = brandsOf(D.brands);
  const [text, setText] = useState(r.text === "(사진)" ? "" : r.text || ""), [kind, setKind] = useState(r.kind || ""), [brand, setBrand] = useState(r.brand || ""), [proj, setProj] = useState(r.projectId || ""), [busy, setBusy] = useState(false), [clash, setClash] = useState(false);
  const base = useRef(r.updatedAt || null), taRef = useRef(null);
  const pick = mentionPick(text, D.users, cu.id);
  const ps = (D.projects || []).filter((p) => (projOpen(p) && !isRemoved(p)) || p.id === r.projectId);
  const kindsAll = kind && !kinds.includes(kind) ? [...kinds, kind] : kinds;
  const save = async () => { setBusy(true); const res = await A.refEdit(r, { text, kind, brand, projectId: proj }, base.current); setBusy(false);
    if (res && res.conflict) setClash(true); else if (res && (res.ok || res.same)) onDone(); };
  return <Card style={{ marginTop: 12, padding: 12 }}>
    <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={REF_TEXT_MAX} aria-label="레퍼런스 글 고치기" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
    {pick.length > 0 && <div className="v2-chips" role="listbox" aria-label="받을 사람 고르기" style={{ marginTop: 6 }}>{pick.map((u) => <Chip key={u.id} onClick={() => { setText(insertMention(text, u.name)); setTimeout(() => taRef.current && taRef.current.focus(), 0); }}>@{u.name}</Chip>)}</div>}
    <div className="v2-rf-l">종류</div>
    <div className="v2-chips" role="group" aria-label="종류 바꾸기">{kindsAll.map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}</div>
    <div className="v2-rf-l">브랜드</div>
    <div className="v2-chips" role="group" aria-label="브랜드 바꾸기"><Chip on={!brand} onClick={() => setBrand("")}>공통</Chip>{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => setBrand(b.id)}>{b.name}</Chip>)}</div>
    {!r.taskId && <><div className="v2-rf-l">프로젝트 연결</div>
      <select className="v2-sel" value={proj} onChange={(e) => setProj(e.target.value)} aria-label="프로젝트 연결 바꾸기" style={{ width: "100%", maxWidth: 420 }}><option value="">연결 안 함</option>{ps.map((p) => <option key={p.id} value={p.id}>{projLabel(p, D)}</option>)}</select></>}
    {clash && <div style={{ fontSize: 13, color: C.red, marginTop: 8, lineHeight: 1.6 }}>그사이 다른 사람이 이 레퍼런스를 고쳤어요 · 닫고 다시 열어 지금 글을 본 뒤 고쳐 주세요</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>취소</TBtn><TBtn v="solid" disabled={busy || clash} onClick={save}>{busy ? "저장 중" : "저장"}</TBtn></div>
  </Card>;
}

// ───────── 프로젝트 자료 탭 · 업무 화면 칸 ─────────
// projectId 만 = 그 프로젝트 + 그 프로젝트 업무에 연결한 것 · taskId = 그 업무에 연결한 것 · always = 없어도 칸을 보임(프로젝트 자료 탭)
export function RefStrip({ D, open, projectId, taskId, createdAt, always }) {
  const all = useRefs(D);
  useLinkedFetch(taskId ? "taskId" : "projectId", taskId || projectId, createdAt);
  const rows = taskId ? refsOfTask(all, taskId) : refsOfProj(all, projectId, D.tasks), ro = !!viewOnlyOn();
  const t = taskId ? D.tasks.find((x) => x.id === taskId) : null;
  const add = () => open({ type: "refs", preset: taskId ? { taskId, projectId: (t && t.projectId) || "" } : { projectId }, f: taskId ? { task: taskId } : { proj: projectId } });
  if (!rows.length && !always) return null;
  return <><Head right={!ro && <TBtn onClick={add}>+ 레퍼런스</TBtn>}>레퍼런스 {rows.length}</Head>
    {rows.length ? <Card>{rows.slice(0, 4).map((r, i) => { const img = refFirstImg(r);
        return <Row key={r.id} title={refTitle(r)} sub={`${r.kind || "기타"} · ${r.byName || ""} · ${md(dayOf(r.at))}${fitNames(r).length ? ` · AI 핏 ${fitNames(r).join("·")}` : ""}`} onClick={() => open({ type: "ref", id: r.id })}
          right={img ? <img src={img.url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} /> : <span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={i === Math.min(rows.length, 4) - 1 && rows.length <= 4} />; })}
        {rows.length > 4 && <More onClick={() => open({ type: "refs", f: taskId ? { task: taskId } : { proj: projectId } })}>레퍼런스 모두 보기 {rows.length} ›</More>}</Card>
      : <Card><Empty>연결한 레퍼런스가 없어요 · [+ 레퍼런스]로 링크·캡처를 붙이면 여기와 '레퍼런스'에 같이 보여요</Empty></Card>}</>;
}
// 더보기 · AI 한 장에 쓰는 숫자 (최근 90일 · 숨긴 것 빼고)
export const refCount = (D, f) => refList((D.refs && D.refs.list) || [], f || {}).length;
