// 업무OS v2 — 반복(행동지표) [+1] ↔ 신제품 횟수 항목 같이 세기 화면 (규칙 routine.js · 시안 mockups/step6b)
//   오늘: '할 횟수' 줄마다 [+1] → 끝. 짝이 1개면 같이 세고 그 줄 아래 한 줄 + 취소(방금 누른 것 통째로) · 여러 개면 그 자리에서 한 번 고르기 · 없으면 '셌어요 · 취소'
//   업무(신제품 횟수 항목): '횟수 n/목표' [+1] → 내 반복 짝이 1개면 같이 · 여러 개면 고르기 · 없으면 항목만
import { useState } from "react";
import { C, Head, Card, More } from "./ui.jsx";
import { myRoutine, launchMatches, akMatches, countOf, targetOf, baseTitle, periodWeeks, akLaunchItems, brId, brandName } from "./routine.js";
import { isDone } from "./model.js";
import { akTotal } from "../../pour-os/src/actionKpi.js";
import { qtyCfg, qtyText, qtySum, akSubsOf, openIdAk, roundOn } from "./rec.js";
import { QtyAsk, qtyAfterQ } from "./recui.jsx";

const unitOf = (it) => (it.unit === "%" ? "%" : it.unit || "회");
const plusL = (it) => (it.unit === "%" ? `+${it.step || 10}%` : "+1");
const askWord = (it) => { const g = akLaunchItems(it); return g.includes("x_blog") ? "포스팅" : g.includes("x_short") ? "숏폼" : g.includes("x_meta") ? "광고" : "일"; };
const pTitle = (D, t) => ((D.projects || []).find((p) => p.id === t.projectId) || {}).title || "신제품";

function Line({ children, onUndo, undoL = "취소" }) {
  return <div className="v2-rtline" role="status"><div>{children}</div>{onUndo && <button type="button" onClick={onUndo}>{undoL}</button>}</div>;
}
function Pick({ q, opts, onPick, onNone }) {
  return <div className="v2-rtline ask" role="group" aria-label={q}><div style={{ width: "100%" }}>{q}
    <div className="v2-rtchips">{opts.map((o) => <button type="button" key={o.k} onClick={() => onPick(o)}>{o.l}</button>)}<button type="button" className="no" onClick={onNone}>해당 없음</button></div></div></div>;
}

// 오늘 화면 '할 횟수' (내 행동지표가 없으면 안 보임) · 줄마다 기간 + 숫자 + 단위: '이번 주 1 / 4건' · '10월 0 / 1회' · '4분기 0 / 1건' · '10월 30 / 100%' · 담당 2명+ '내 몫 n' · 순서 주 → 월 → 분기
// 2단계: 카드 머리 '반복 실행' 하나 · 안에 '오늘 체크'(checks = 오늘 화면이 만든 줄 묶음 · 브랜드 정한 고정업무) → '횟수'(행동지표 [+1])
export function RoutineCard({ D, cu, A, keyd, checks, open }) {
  const [line, setLine] = useState(null), [busy, setBusy] = useState(""), [all, setAll] = useState(false);
  const ak = D.ak || {};
  const rows = ak.ready && (ak.items || []).length ? myRoutine(ak.items, D.users, cu.id, ak.docs, keyd) : [];
  if (!rows.length && !checks) return null;
  const shown = all ? rows : rows.slice(0, 4);
  const multiBrand = new Set(rows.map((r) => brId(r.it.brand)).filter(Boolean)).size > 1;   // 브랜드가 여럿이면 줄마다 브랜드 (비슷한 이름 구별)
  const tOf = (id) => (D.tasks || []).find((t) => t.id === id);
  // 한 번에 하나만 (두 번 눌러 두 번 세지 않게)
  const once = async (fn) => { if (busy) return; setBusy("1"); try { await fn(); } finally { setBusy(""); } };
  const today = (D.recs && D.recs.today) || [], opens = (D.recs && D.recs.open) || [];
  const myQty = (it) => qtySum(today, it.id, cu.id);
  const qAsk = (it, fail) => !fail && !!qtyCfg(it) && !it.perFail && it.unit !== "%";   // 건수 칸을 켠 항목: 센 뒤 '몇 건?' 한 줄
  // 3단계: [+1] = 분기 실적 + 그날 기록(한 transaction) · 건수 칸을 켰으면 그 줄에 '셌어요 · 오늘 전화 몇 건? [ ]건 [남기기] · 취소'
  const plus = (r, fail) => once(async () => {
    const a = await A.akPlus(r.it, 1, fail ? { fail: true } : { via: "btn" }); if (!a) return;
    const base = { id: r.it.id, wk: a.wk, date: a.date, fail, ask: qAsk(r.it, fail) };
    if (fail || r.it.perFail || r.it.unit === "%") { setLine({ ...base, kind: "plain" }); return; }
    const c = launchMatches(r.it, D, cu.id, keyd);
    if (c.length === 1) { const res = await A.launchCount(c[0], 1, { ak: r.it.id, akName: r.it.name }); setLine(res ? { ...base, kind: "linked", tid: c[0].id, n: res.n, g: res.g } : { ...base, kind: "plain" }); }
    else if (c.length > 1) setLine({ ...base, kind: "ask", cands: c.map((t) => t.id) });
    else setLine({ ...base, kind: "plain" });
  });
  // 취소 = 방금 누른 것 통째로 (반복 −1 + 같이 센 신제품 −1) · 처음 누른 주로
  const undo = (r, L) => once(async () => { setLine(null);
    await A.akPlus(r.it, -1, { wk: L.wk, date: L.date, via: "undo", ...(L.fail ? { fail: true } : {}) });
    if (L.kind === "linked") { const t = tOf(L.tid); if (t) await A.launchCount(t, -1, { ak: r.it.id, undo: true }); } });
  const pick = (r, L, o) => once(async () => { const t = tOf(o.k); if (!t) { setLine(null); return; }
    const res = await A.launchCount(t, 1, { ak: r.it.id, akName: r.it.name }); setLine(res ? { ...L, kind: "linked", tid: t.id, n: res.n, g: res.g } : { ...L, kind: "plain" }); });
  // 체크리스트가 있는 항목: [+1] 대신 칩(한 바퀴 = 1회 · 날이 바뀌어도 이어짐) · 다 켜면 저절로 +1 → '1회 셌어요 · 취소' → 건수 줄
  const chip = (r, x) => once(async () => { const res = await A.akSub(r.it, x.id); if (res && res.complete) setLine({ id: r.it.id, wk: res.wk, date: res.date, kind: "round", ask: qAsk(r.it) }); });
  const saveQty = (r, L, n) => once(async () => { const res = await A.akQty(r.it, n, "add", { incl: !!L && L.kind !== "qty" }); if (res) setLine(L && L.kind !== "qty" ? { ...L, ask: false, saved: n } : { id: r.it.id, kind: "qtydone", n }); else if (!L || L.kind === "qty") setLine(null); });
  const qtyRow = (r, L) => { const cfg = qtyCfg(r.it); if (!cfg || !L) return null;
    if (L.ask) return <QtyAsk cfg={cfg} q={L.kind === "qty" ? undefined : qtyAfterQ(r.it, cfg)} busy={!!busy} onSave={(n) => saveQty(r, L, n)} onSkip={() => setLine(L.kind === "qty" ? null : { ...L, ask: false })} skipL={L.kind === "qty" ? "그만" : "건너뛰기"} />;
    return null; };
  const lineFor = (r) => { const L = line; if (!L || L.id !== r.it.id) return null; const cfg = qtyCfg(r.it);
    if (L.kind === "qty") return qtyRow(r, L);
    if (L.kind === "qtydone") return <Line onUndo={() => setLine({ id: r.it.id, kind: "fix" })} undoL="고치기">오늘 {qtyText(cfg, myQty(r.it))} 남겼어요</Line>;
    if (L.kind === "fix") return <QtyAsk cfg={cfg} mode="set" init={myQty(r.it)} busy={!!busy} onSave={(n) => once(async () => { await A.akQty(r.it, n, "set"); setLine(null); })} onSkip={() => setLine(null)} skipL="그만" />;
    const done = L.saved != null && cfg ? ` · 오늘 ${qtyText(cfg, myQty(r.it))}` : "";
    if (L.kind === "round") return <><Line onUndo={() => undo(r, L)}>1회 셌어요{done}</Line>{qtyRow(r, L)}</>;
    if (L.kind === "plain") return <><Line onUndo={() => undo(r, L)}>{L.fail ? "실패 1건 남겼어요" : "셌어요"}{done}</Line>{qtyRow(r, L)}</>;
    if (L.kind === "linked") { const t = tOf(L.tid);
      return <><Line onUndo={() => undo(r, L)}>{t ? `${pTitle(D, t)} '${baseTitle(t)}'에도 셌어요 (${L.n}/${L.g})` : "신제품 항목에도 셌어요"}{done}</Line>{qtyRow(r, L)}</>; }
    const cands = L.cands.map(tOf).filter(Boolean), many = new Set(cands.map((t) => t.projectId)).size < cands.length;
    return <Pick q={`어느 제품 ${askWord(r.it)}이에요?`} opts={cands.map((t) => ({ k: t.id, l: pTitle(D, t) + (many ? ` · ${baseTitle(t)}` : "") }))} onNone={() => setLine({ ...L, kind: "plain" })} onPick={(o) => pick(r, L, o)} />; };
  return <>
    <Head>반복 실행</Head>
    <Card>
      {checks}
      {rows.length > 0 && <div className="v2-rtsub"><b>횟수</b>{rows.some((r) => r.it.cyc !== "W") && <span>주 → 월 → 분기</span>}</div>}
      {shown.map((r, i) => { const t = r.tot, done = t.done, u = unitOf(r.it), cfg = qtyCfg(r.it), subs = akSubsOf(r.it, cu.id), op = opens.find((d) => (d.id || d._doc) === openIdAk(r.it.id, cu.id));
        const L = line && line.id === r.it.id ? line : null, canQty = cfg && !r.it.perFail && r.it.unit !== "%" && !(L && (L.ask || L.kind === "fix"));   // [건수 넣기]는 늘 (묻는 중일 때만 숨김)
        return <div key={r.it.id} className="v2-rtrow" style={{ borderBottom: i === shown.length - 1 && rows.length <= 4 ? 0 : undefined }}>
          <div className="r1"><div className="t" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => open && open({ type: "routine", id: r.it.id })} onKeyDown={(e) => { if (e.key === "Enter" && open) open({ type: "routine", id: r.it.id }); }}><b>{r.it.name}</b>
            <span>{r.per} {r.it.perFail ? <>시도 <b className="num">{t.n}</b> / {t.g || 0}회 · 실패 {t.fail}건 × {r.it.perFail}</> : <><b className="num">{t.n}</b> / {t.g}{u}{done ? " ✓" : ""}</>}{r.owners >= 2 && !r.it.perFail ? ` · 내 몫 ${r.me}${u === "%" ? "%" : ""}` : ""}{multiBrand && r.it.brand ? ` · ${brandName(r.it.brand, D.brands)}` : ""}{cfg ? ` · 오늘 ${qtyText(cfg, myQty(r.it))}` : ""}{subs.length ? ` · 체크리스트 ${roundOn(op, subs)}/${subs.length}` : ""}</span></div>
            {r.it.perFail && <button type="button" className="v2-rtplus soft" disabled={!!busy} onClick={() => plus(r, true)} aria-label={`${r.it.name} 실패 1건`}>실패 +1</button>}
            {!subs.length && <button type="button" className={"v2-rtplus" + (done ? " soft" : "")} disabled={!!busy} onClick={() => plus(r)} aria-label={`${r.it.name} ${plusL(r.it)}`}>{plusL(r.it)}</button>}</div>
          {subs.length > 0 && <div className="v2-fxchips" role="group" aria-label={`${r.it.name} 체크리스트 · 다 하면 1회`}>{subs.map((x) => { const on = !!(op && op.subs && op.subs[x.id]);
            return <button key={x.id} type="button" className={on ? "on" : ""} aria-pressed={on} disabled={!!busy} onClick={() => chip(r, x)}>{on ? "✓ " : ""}{x.title}</button>; })}</div>}
          {lineFor(r)}
          {canQty && <button type="button" className="v2-rtqbtn" onClick={() => setLine({ id: r.it.id, kind: "qty", ask: true })}>건수 넣기</button>}
        </div>; })}
      {rows.length > 4 && <More onClick={() => setAll(!all)}>{all ? "접기 ▴" : `${rows.length - 4}개 더 ▾`}</More>}
    </Card>
  </>;
}

// 업무 화면: 신제품 횟수 항목 '횟수 n/목표' [+1]
export function CountBox({ t, D, cu, A, can }) {
  const [line, setLine] = useState(null), [busy, setBusy] = useState(false);
  const g = targetOf(t), n = countOf(t), ak = D.ak || {};
  if (!g) return null;
  const items = (ak.items || []);
  const akTot = (id) => { const it = items.find((x) => x.id === id); if (!it) return null; const r = akTotal(ak.docs || {}, it, periodWeeks(it, ymdNow())); return `${r.n}/${r.g}`; };
  const itOf = (id) => items.find((x) => x.id === id);
  const once = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const plus = () => once(async () => {
    const c = await A.launchCount(t, 1); if (!c) return;
    const m = ak.ready ? akMatches(t, items, D.users, cu.id, ((D.projects || []).find((p) => p.id === t.projectId) || {}).brand) : [];
    if (m.length === 1) { const r = await A.akPlus(m[0], 1, { task: t.id }); setLine(r ? { kind: "linked", it: m[0].id, wk: r.wk } : { kind: "plain" }); }
    else if (m.length > 1) setLine({ kind: "ask", ids: m.map((x) => x.id) });
    else setLine({ kind: "plain" });
  });
  // 취소 = 방금 누른 것 통째로 (횟수 −1 + 같이 센 반복 −1)
  const undo = (L) => once(async () => { setLine(null); await A.launchCount(t, -1, { undo: true });
    if (L.kind === "linked" && itOf(L.it)) await A.akPlus(itOf(L.it), -1, { task: t.id, wk: L.wk }); });
  return <div className="v2-count">
    <div className="r1"><div className="t">횟수 <b className="num">{n}</b> / {g}{n >= g ? " ✓" : ""}<span>한 번 할 때마다 눌러 주세요 · 반복 횟수에도 같이 들어가요</span></div>
      {can && n < g && !isDone(t) && !["dropped", "review"].includes(t.status) && <button type="button" className="v2-rtplus" disabled={busy} onClick={plus} aria-label={`${baseTitle(t)} +1`}>+1</button>}</div>
    {line && line.kind === "plain" && <Line onUndo={() => undo(line)}>셌어요 ({n}/{g})</Line>}
    {line && line.kind === "linked" && itOf(line.it) && <Line onUndo={() => undo(line)}>반복 '{itOf(line.it).name}'에도 셌어요{akTot(line.it) ? ` (${akTot(line.it)})` : ""}</Line>}
    {line && line.kind === "ask" && <Pick q="어느 반복에 같이 셀까요?" opts={line.ids.map(itOf).filter(Boolean).map((it) => ({ k: it.id, l: it.name }))} onNone={() => setLine({ kind: "plain" })}
      onPick={(o) => once(async () => { const it = itOf(o.k); const r = it ? await A.akPlus(it, 1, { task: t.id }) : null; setLine(r ? { kind: "linked", it: o.k, wk: r.wk } : { kind: "plain" }); })} />}
  </div>;
}
const ymdNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
