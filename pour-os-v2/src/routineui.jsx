// 업무OS v2 — 반복(행동지표) [+1] ↔ 신제품 횟수 항목 같이 세기 화면 (규칙 routine.js · 시안 mockups/step6b)
//   오늘: '할 횟수' 줄마다 [+1] → 끝. 짝이 1개면 같이 세고 그 줄 아래 한 줄 + 취소(방금 누른 것 통째로) · 여러 개면 그 자리에서 한 번 고르기 · 없으면 '셌어요 · 취소'
//   업무(신제품 횟수 항목): '횟수 n/목표' [+1] → 내 반복 짝이 1개면 같이 · 여러 개면 고르기 · 없으면 항목만
import { useState } from "react";
import { C, Head, Card, More } from "./ui.jsx";
import { myRoutine, launchMatches, akMatches, countOf, targetOf, baseTitle, periodWeeks, akLaunchItems, brId, brandName } from "./routine.js";
import { isDone } from "./model.js";
import { akTotal } from "../../pour-os/src/actionKpi.js";

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
export function RoutineCard({ D, cu, A, keyd }) {
  const [line, setLine] = useState(null), [busy, setBusy] = useState(""), [all, setAll] = useState(false);
  const ak = D.ak || {};
  if (!ak.ready || !(ak.items || []).length) return null;
  const rows = myRoutine(ak.items, D.users, cu.id, ak.docs, keyd);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 4);
  const multiBrand = new Set(rows.map((r) => brId(r.it.brand)).filter(Boolean)).size > 1;   // 브랜드가 여럿이면 줄마다 브랜드 (비슷한 이름 구별)
  const tOf = (id) => (D.tasks || []).find((t) => t.id === id);
  // 한 번에 하나만 (두 번 눌러 두 번 세지 않게)
  const once = async (fn) => { if (busy) return; setBusy("1"); try { await fn(); } finally { setBusy(""); } };
  const plus = (r, fail) => once(async () => {
    const a = await A.akPlus(r.it, 1, fail ? { fail: true } : null); if (!a) return;
    const base = { id: r.it.id, wk: a.wk, fail };
    if (fail || r.it.perFail || r.it.unit === "%") { setLine({ ...base, kind: "plain" }); return; }
    const c = launchMatches(r.it, D, cu.id, keyd);
    if (c.length === 1) { const res = await A.launchCount(c[0], 1, { ak: r.it.id, akName: r.it.name }); setLine(res ? { ...base, kind: "linked", tid: c[0].id, n: res.n, g: res.g } : { ...base, kind: "plain" }); }
    else if (c.length > 1) setLine({ ...base, kind: "ask", cands: c.map((t) => t.id) });
    else setLine({ ...base, kind: "plain" });
  });
  // 취소 = 방금 누른 것 통째로 (반복 −1 + 같이 센 신제품 −1) · 처음 누른 주로
  const undo = (r, L) => once(async () => { setLine(null);
    await A.akPlus(r.it, -1, { wk: L.wk, ...(L.fail ? { fail: true } : {}) });
    if (L.kind === "linked") { const t = tOf(L.tid); if (t) await A.launchCount(t, -1, { ak: r.it.id, undo: true }); } });
  const pick = (r, L, o) => once(async () => { const t = tOf(o.k); if (!t) { setLine(null); return; }
    const res = await A.launchCount(t, 1, { ak: r.it.id, akName: r.it.name }); setLine(res ? { ...L, kind: "linked", tid: t.id, n: res.n, g: res.g } : { ...L, kind: "plain" }); });
  const lineFor = (r) => { const L = line; if (!L || L.id !== r.it.id) return null;
    if (L.kind === "plain") return <Line onUndo={() => undo(r, L)}>{L.fail ? "실패 1건 남겼어요" : "셌어요"}</Line>;
    if (L.kind === "linked") { const t = tOf(L.tid);
      return <Line onUndo={() => undo(r, L)}>{t ? `${pTitle(D, t)} '${baseTitle(t)}'에도 셌어요 (${L.n}/${L.g})` : "신제품 항목에도 셌어요"}</Line>; }
    const cands = L.cands.map(tOf).filter(Boolean), many = new Set(cands.map((t) => t.projectId)).size < cands.length;
    return <Pick q={`어느 제품 ${askWord(r.it)}이에요?`} opts={cands.map((t) => ({ k: t.id, l: pTitle(D, t) + (many ? ` · ${baseTitle(t)}` : "") }))} onNone={() => setLine({ ...L, kind: "plain" })} onPick={(o) => pick(r, L, o)} />; };
  return <>
    <Head right={rows.some((r) => r.it.cyc !== "W") ? <span style={{ fontSize: 12, color: C.mute, fontWeight: 700 }}>주 → 월 → 분기</span> : null}>할 횟수</Head>
    <Card>
      {shown.map((r, i) => { const t = r.tot, done = t.done, u = unitOf(r.it);
        return <div key={r.it.id} className="v2-rtrow" style={{ borderBottom: i === shown.length - 1 && rows.length <= 4 ? 0 : undefined }}>
          <div className="r1"><div className="t"><b>{r.it.name}</b>
            <span>{r.per} {r.it.perFail ? <>시도 <b className="num">{t.n}</b> / {t.g || 0}회 · 실패 {t.fail}건 × {r.it.perFail}</> : <><b className="num">{t.n}</b> / {t.g}{u}{done ? " ✓" : ""}</>}{r.owners >= 2 && !r.it.perFail ? ` · 내 몫 ${r.me}${u === "%" ? "%" : ""}` : ""}{multiBrand && r.it.brand ? ` · ${brandName(r.it.brand, D.brands)}` : ""}</span></div>
            {r.it.perFail && <button type="button" className="v2-rtplus soft" disabled={!!busy} onClick={() => plus(r, true)} aria-label={`${r.it.name} 실패 1건`}>실패 +1</button>}
            <button type="button" className={"v2-rtplus" + (done ? " soft" : "")} disabled={!!busy} onClick={() => plus(r)} aria-label={`${r.it.name} ${plusL(r.it)}`}>{plusL(r.it)}</button></div>
          {lineFor(r)}
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
