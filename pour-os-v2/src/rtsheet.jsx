// 업무OS v2 — 반복 실행 보기 · 고정업무 보기 (한 부품 · type 'fixed' | 'routine' · 시안 mockups/step13 · 3단계 2026-10-06)
//   'fixed'   = 고정업무·정한 날 체크(v2 업무 문서) → task.FixedSheet (메모·자료·대화 + 오늘 건수 · 날짜별 기록)
//   'routine' = 횟수 목표(버전1 행동지표 + v2 덧칠 kpidefs/{akId}) → 아래 AkSheet
//   늘 보이는 순서: ① 이번 기간 한 줄 ② 체크리스트 칩 ③ 오늘 건수 ④ 날짜별 기록(14일) ⑤ 하는 법·메모 ⑥ 자료 ⑦ 대화 · 아래 큰 버튼 [+1] · 드문 것 [더 하기 ▾]
//   권한: 관리자 = 공통 체크리스트 · 건수 칸 · 브랜드 · 담당 · 멈춤 · (새로 만든 항목만) 목표 / 담당 = 내 체크리스트 · 메모 · 파일
import { useEffect, useRef, useState } from "react";
import { C, Big, TBtn, Chip, Seg, Head, Card, Empty, Sheet, inp, Linked, Clash } from "./ui.jsx";
import { ymd, ago, isMaster, activeUsers, nameOf, newId, brandsWithCommon, brandKey, canRemoveAk } from "./model.js";
import { RemoveAsk, RemovedNote } from "./trash.jsx";
import { FixedSheet, Thread, useItemNotes, QtyCfgEdit } from "./task.jsx";
import { FileList, useUploads, UpList, UpBtn } from "./files.jsx";
import { periodWeeks, periodLabel, brandName } from "./routine.js";
import { akTotal, akWho, akGoalText, akStep } from "../../pour-os/src/actionKpi.js";
import { qtyCfg, qtyText, qtyShort, qtyToGoal, akSubsOf, openIdAk, dayIdAk, roundOn } from "./rec.js";
import { QtyAsk, DayQty, RecList, useRecs, qtyAfterQ } from "./recui.jsx";

export function RoutineSheet(p) { return p.type === "routine" ? <AkSheet {...p} /> : <FixedSheet {...p} />; }
const unitOf = (it) => (it.unit === "%" ? "%" : it.unit || "회");
const plusL = (it) => (it.unit === "%" ? `+${it.step || 10}%` : "+1");


function AkSheet({ D, cu, A, onBack, onClose, id, focus, note }) {
  const ak = D.ak || {}, it = (ak.items || []).find((x) => x.id === id);
  const notes = useItemNotes(D, id);   // 대화 itemId = 행동지표 id (버전1 메모 복사본이 이어짐)
  const [tick, setTick] = useState(0), [rec, setRec] = useState(null), [line, setLine] = useState(null), [busy, setBusy] = useState(false);
  const [editMemo, setEditMemo] = useState(false), [memo, setMemo] = useState(""), [memoBase, setMemoBase] = useState(null), [clash, setClash] = useState(null);
  const U = useUploads(A, "ak-" + id, (metas) => A.akFiles(it, metas));
  const R = useRecs(D, id, tick);
  const toTalk = () => setTimeout(() => { const el = document.getElementById("v2-rt-talk"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  useEffect(() => { if (focus === "talk" && it) toTalk(); }, [focus, !!it]);
  const gone = !it ? (ak.removed || []).find((x) => x.id === id) : null;   // 없앤 것(휴지통 · 링크로 열었을 때) → 맨 위 '없앤 반복 실행이에요 · [되살리기]' + 지난 기록·대화
  if (gone) return <Sheet title="반복 실행" kind="반복 실행" head={gone.name} path={`반복 실행 · ${brandName(gone.brand, D.brands) || "브랜드 없음"} · ${akGoalText(gone)}`} onBack={onBack} onClose={onClose}>
    <RemovedNote what="없앤 반복 실행이에요" rm={gone._removed} can={canRemoveAk(cu)} onRestore={async () => { const ok = await A.akRestore(gone); if (ok) (onBack || onClose)(); }} />
    <RecList D={D} docs={R.docs} ready={R.ready} cfg={qtyCfg(gone)} kind="ak" notes={notes} keyd={(D.recs && D.recs.key) || ymd(new Date())} onPick={() => {}} />
    <div id="v2-rt-talk" style={{ scrollMarginTop: 8 }}><Head>대화</Head></div>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={gone.id} ctx={{}} link={{ kind: "r", id: gone.id }} hl={note} cfg={qtyCfg(gone)} />
  </Sheet>;
  if (!it) return <Sheet title="반복 실행" kind="반복 실행" onBack={onBack} onClose={onClose}><Empty>{ak.defReady ? "이 반복 실행을 찾지 못했어요" : "불러오는 중…"}</Empty></Sheet>;
  const key = (D.recs && D.recs.key) || ymd(new Date()), who = akWho(D.users, it), mine = who.includes(cu.id), master = isMaster(cu);
  const tot = akTotal(ak.docs || {}, it, periodWeeks(it, key)), u = unitOf(it), cfg = qtyCfg(it), subs = akSubsOf(it, cu.id);
  const op = ((D.recs && D.recs.open) || []).find((d) => (d.id || d._doc) === openIdAk(it.id, cu.id)), onN = roundOn(op, subs);
  const myDay = (R.docs || []).find((d) => (d.id || d._doc) === dayIdAk(it.id, cu.id, key)), myQty = +(myDay && myDay.qty) || 0;
  const pct = tot.g ? Math.min(100, Math.round((tot.n / tot.g) * 100)) : 0;
  const once = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); setTick((x) => x + 1); } };
  const plus = () => once(async () => { const a = await A.akPlus(it, 1, { via: "btn" }); if (a) setLine({ kind: "plus", wk: a.wk, date: a.date, ask: !!cfg && !it.perFail && it.unit !== "%" }); });
  const chip = (x) => once(async () => { const r = await A.akSub(it, x.id); if (r && r.complete) setLine({ kind: "round", wk: r.wk, date: r.date, ask: !!cfg }); });
  const undo = () => once(async () => { const L = line; setLine(null); if (L) await A.akPlus(it, -1, { wk: L.wk, date: L.date, via: "undo" }); });
  const saveQty = (n) => once(async () => { const L = line, r = await A.akQty(it, n, "add", { incl: !!L && (L.kind === "plus" || L.kind === "round") }); if (r) setLine({ ...L, ask: false, saved: myQty + n }); });
  const desc = it.desc || "", descAt = it.descAt || null;
  const saveMemo = async (force) => { const r = await A.akDesc(it, memo, memoBase, force === true); if (r && r.conflict) setClash(r.cur); else if (r && r.ok) { setClash(null); setEditMemo(false); } };
  const files = [...(it._files || []).map((f) => ({ ...f, where: "반복 실행" })), ...notes.filter((n) => !n.deleted).flatMap((n) => (n.files || []).map((f) => ({ ...f, by: n.by, byName: n.byName, uploadedAt: f.uploadedAt || n.at, where: "댓글" })))];
  const canFiles = mine || master;
  return <Sheet title="반복 실행" kind="반복 실행" head={it.name} path={`반복 실행 · ${brandName(it.brand, D.brands) || "브랜드 없음"} · ${akGoalText(it)}${it.paused ? " · 멈춤" : ""}`} onBack={onBack} onClose={onClose}
    foot={mine && !it.paused ? <Big disabled={busy} onClick={plus}>{plusL(it)}</Big> : null}>
    <Card style={{ marginTop: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 15, color: C.ink }}><b style={{ fontSize: 17 }}>{periodLabel(it, key)} {it.perFail ? `시도 ${tot.n} / ${tot.g || 0}회` : `${tot.n} / ${tot.g}${u}`}{tot.done ? " ✓" : ""}</b>
        <span style={{ color: C.sub, fontSize: 13 }}> · 담당 {who.map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "없음"}</span></div>
      <div className="v2-prog" aria-hidden="true"><i style={{ width: pct + "%" }} /></div>
      {line && <div className="v2-rtline" role="status"><div>{line.kind === "round" ? "1회 셌어요" : "셌어요"}{line.saved != null && cfg ? ` · 오늘 ${qtyText(cfg, line.saved)}` : ""}</div><button type="button" onClick={undo}>취소</button></div>}
      {line && line.ask && cfg && <QtyAsk cfg={cfg} busy={busy} q={qtyAfterQ(it, cfg)} onSave={saveQty} onSkip={() => setLine({ ...line, ask: false })} />}
    </Card>
    {subs.length > 0 && <><Head right={<span style={{ fontSize: 12.5, color: C.mute, fontWeight: 700 }}>{onN}/{subs.length} · 다 하면 1회</span>}>체크리스트</Head>
      <div className="v2-chips">{subs.map((x) => { const on = !!(op && op.subs && op.subs[x.id]); return <Chip key={x.id} on={on} onClick={() => (mine ? chip(x) : null)}>{on ? "✓ " : ""}{x.title}</Chip>; })}</div></>}
    {cfg && mine && <DayQty cfg={cfg} mine={myQty} can extra={it.unit && ["건", "명", "개"].includes(it.unit) && !it.perFail ? `넣은 ${cfg.unit} 수가 목표(${akGoalText(it)})에도 더해져요` : "날짜별 기록으로 남아요 · 목표는 [+1]로 세요"}
      onAdd={(n) => once(async () => { await A.akQty(it, n, "add"); })} onSet={(n) => once(async () => { await A.akQty(it, n, "set"); })} />}
    <RecList D={D} docs={R.docs} ready={R.ready} cfg={cfg} kind="ak" notes={notes} keyd={key} onPick={(r) => { setRec({ date: r.date, uid: r.uid, qty: r.qty, runs: r.runs, name: r.name }); toTalk(); }} />
    <Head right={(mine || master) && !editMemo && <TBtn onClick={() => { setMemo(desc); setMemoBase(descAt); setClash(null); setEditMemo(true); }}>{desc ? "메모 고치기" : "메모 쓰기"}</TBtn>}>하는 법 · 메모</Head>
    {editMemo ? <div><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} aria-label="하는 법 · 메모" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setEditMemo(false)} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={saveMemo} style={{ flex: 1, height: 44 }}>메모 저장</Big></div>
      {clash && <Clash who={clash.memoByName} at={clash.memoAt} text={clash.memo} onMerge={() => { setMemo(`${clash.memo || ""}\n\n${memo}`.trim()); setMemoBase(clash.memoAt || null); setClash(null); }} onMine={() => saveMemo(true)} />}</div>
    : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: desc ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65, wordBreak: "break-word" }}>{desc ? <Linked text={desc} /> : "적어 둔 하는 법이 없어요"}</div>{descAt && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>{it.descByName || nameOf(D.users, it.descBy)} · {ago(descAt)} 고침</div>}</Card>}
    <Head right={canFiles && <UpBtn U={U} />}>자료 {files.length}</Head>
    <UpList U={U} style={{ marginBottom: 8 }} />
    <FileList files={files} />
    <div id="v2-rt-talk" style={{ scrollMarginTop: 8 }}><Head>대화</Head></div>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={it.id} ctx={{}} link={{ kind: "r", id: it.id }} hl={note} rec={rec ? { date: rec.date, uid: rec.uid, qty: rec.qty, runs: rec.runs } : null} onRec={setRec} cfg={cfg} />
    <AkMore it={it} D={D} cu={cu} A={A} mine={mine} master={master} onGone={() => (onBack || onClose)()} />
  </Sheet>;
}

// [더 하기 ▾] — 체크리스트 고치기(관리자 공통 · 담당 내 것) · 건수 칸 · 브랜드 · 담당 · 멈추기 · 목표(새로 만든 것만) — 관리자
//   [없애기](관리자 · 사용자 확정 2026-10-07) = 덧칠 hidden + removed → 휴지통(관리자 반복 실행 아래 '없앤 것') · 5초 되돌리기 · 시트 닫음
function AkMore({ it, D, cu, A, mine, master, onGone }) {
  const [more, setMore] = useState(false), [mode, setMode] = useState(""), [busy, setBusy] = useState(false);
  const remove = async () => { if (busy) return; setBusy(true); const ok = await A.akRemove(it); setBusy(false); if (ok) { setMode(""); onGone && onGone(); } };
  if (!mine && !master) return null;
  const go = (m) => { setMore(false); setMode(m); }, done = () => setMode("");
  return <div style={{ marginTop: 12 }}>
    <TBtn onClick={() => { setMore(!more); setMode(""); }} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn>
    {more && <div className="v2-more" role="group" aria-label="더 하기">
      <TBtn v="soft" onClick={() => go("subs")}>체크리스트 고치기</TBtn>
      {master && <TBtn v="soft" onClick={() => go("qty")}>건수 칸</TBtn>}
      {master && <TBtn v="soft" onClick={() => go("brand")}>브랜드</TBtn>}
      {master && <TBtn v="soft" onClick={() => go("who")}>담당 바꾸기</TBtn>}
      {master && it._new && <TBtn v="soft" onClick={() => go("goal")}>목표</TBtn>}
      {master && <TBtn v="soft" onClick={() => { setMore(false); A.akSet(it, { paused: !it.paused }, it.paused ? "다시 시작" : "잠시 멈춤"); }}>{it.paused ? "다시 시작" : "잠시 멈추기"}</TBtn>}
      {canRemoveAk(cu) && <TBtn tone="red" onClick={() => go("remove")}>없애기</TBtn>}
    </div>}
    {mode === "remove" && <RemoveAsk what="이 반복 실행을" busy={busy} onNo={done} onYes={remove} where="관리자 › 반복 실행 아래 '없앤 것'" />}
    {mode === "subs" && <AkSubsEdit it={it} cu={cu} A={A} canCommon={master} canMine={mine} onDone={done} />}
    {mode === "qty" && <QtyCfgEdit cfg={qtyCfg(it)} note={["건", "명", "개"].includes(it.unit) && !it.perFail ? `목표 단위가 '${it.unit}'라서 넣은 숫자가 목표에도 더해져요` : "목표는 [+1]로 세고, 건수는 날짜별 기록으로만 남아요"}
      onSave={async (q) => { await A.akSet(it, { qty: q && q.unit ? q : null }, q ? "건수 칸" : "건수 칸 끔"); done(); }} onDone={done} />}
    {mode === "brand" && <Card style={{ marginTop: 10, padding: "12px 14px" }}><div className="v2-chips" role="group" aria-label="브랜드">{brandsWithCommon(D.brands).map((b) => { const on = brandKey(it.brand, D.brands) === b.id;
      return <Chip key={b.id} on={on} onClick={async () => { if (!on) await A.akSet(it, { brand: b.id }, "브랜드"); done(); }}>{on ? "✓ " : ""}{b.name}</Chip>; })}</div></Card>}
    {mode === "who" && <AkWho it={it} D={D} A={A} onDone={done} />}
    {mode === "goal" && <AkGoal it={it} A={A} onDone={done} />}
  </div>;
}
function AkSubsEdit({ it, cu, A, canCommon, canMine, onDone }) {
  const [who, setWho] = useState(canCommon ? "*" : cu.id);
  const init = (w) => ((w === "*" ? it.subs : ((it.subsBy || {})[w])) || []).filter((x) => x && x.title).map((x) => ({ id: x.id, title: x.title }));
  const [list, setList] = useState(() => init(canCommon ? "*" : cu.id)), [v, setV] = useState("");
  const pick = (w) => { setWho(w); setList(init(w)); setV(""); };
  const add = () => { const x = v.trim(); if (!x) return; setList([...list, { id: newId("s"), title: x }]); setV(""); };
  const save = async () => { const all = [...list, ...(v.trim() ? [{ id: newId("s"), title: v.trim() }] : [])];
    const ok = await A.akSet(it, who === "*" ? { subs: all } : { subsBy: { ...(it.subsBy || {}), [cu.id]: all } }, who === "*" ? "체크리스트(공통)" : "체크리스트(내 것)"); if (ok) onDone(); };
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    {canCommon && canMine && <Seg items={[["*", "공통"], [cu.id, "내 것"]]} value={who} onChange={pick} />}
    <div style={{ fontSize: 12.5, color: C.sub }}>{who === "*" ? "담당 모두에게 보여요 · 다 체크하면 1회로 세요" : "나만 보는 목록이에요 · 비우면 공통 목록을 써요"}</div>
    {list.length > 0 ? <div className="v2-chips">{list.map((x, i) => <Chip key={x.id || i} on onClick={() => setList(list.filter((_, j) => j !== i))}>{x.title} ✕</Chip>)}</div> : <div style={{ fontSize: 13, color: C.mute }}>항목이 없어요 · 없으면 [+1]로 세요</div>}
    <div style={{ display: "flex", gap: 8 }}><input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="새 항목" aria-label="체크리스트 항목" style={{ ...inp, flex: 1, minWidth: 0, padding: "9px 12px" }} /><TBtn onClick={add} disabled={!v.trim()}>추가</TBtn></div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" onClick={save}>저장 · {list.length + (v.trim() ? 1 : 0)}개</TBtn></div>
  </Card>;
}
function AkWho({ it, D, A, onDone }) {
  const users = activeUsers(D.users), [sel, setSel] = useState(() => akWho(D.users, it));
  const save = async () => { const ok = await A.akSet(it, { who: sel, whoNames: sel.map((x) => nameOf(D.users, x)).filter(Boolean) }, "담당"); if (ok) onDone(); };
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>담당 (여러 명 가능)</div>
    <div className="v2-chips">{users.map((u) => { const k = sel.includes(u.id); return <Chip key={u.id} on={k} onClick={() => setSel(k ? sel.filter((x) => x !== u.id) : [...sel, u.id])}>{k ? "✓ " : ""}{u.name}</Chip>; })}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" onClick={save} disabled={!sel.length}>저장 · {sel.length}명</TBtn></div>
  </Card>;
}
// 목표 (v2 에서 새로 만든 항목만 · 버전1 29개는 목표·주기·단위를 안 바꿈)
function AkGoal({ it, A, onDone }) {
  const [cyc, setCyc] = useState(it.cyc || "M"), [goal, setGoal] = useState(String(it.goal || 1)), [unit, setUnit] = useState(it.unit || "회");
  const g = Math.max(1, Math.floor(+goal || 0));
  return <Card style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <Seg items={[["W", "주"], ["M", "월"], ["Q", "분기"]]} value={cyc} onChange={setCyc} />
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><input inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ""))} aria-label="목표 숫자" style={{ ...inp, width: 90, padding: "9px 12px" }} />
      {["회", "건"].map((x) => <Chip key={x} on={unit === x} onClick={() => setUnit(x)}>{x}</Chip>)}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><TBtn tone="mute" onClick={onDone}>그만</TBtn><TBtn v="solid" disabled={!+goal} onClick={async () => { const ok = await A.akSet(it, { cyc, goal: g, unit }, "목표"); if (ok) onDone(); }}>저장 · {cyc === "W" ? "주" : cyc === "M" ? "월" : "분기"} {g}{unit}</TBtn></div>
  </Card>;
}
