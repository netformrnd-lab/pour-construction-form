// 업무OS v2 — AI 크루 ↔ 반복 실행 화면 조각 (계산 airt.js · 저장 core.rtPairMany · mateActSet · 2026-10-16)
//   AiLine: 오늘 반복 실행 줄 'AI 겨울 · 확인할 결과 1 · 실행 2 ›' (나를 기다릴 때만)
//   RtAiCard: 반복 실행 시트 'AI 크루' 칸 — 짝(누르면 그 AI) · 남은 AI 일 · 짝 없으면 추천 [짝 짓기] · [AI에게 맡기기 ›]
//   AiPairPanel: 관리자 반복 실행 'AI 크루 짝 n / m · 추천 k' [추천대로 k개 짝 짓기] · 줄마다 [짝 짓기]·[풀기]
//   RtSelect: AI 팀원 할 일마다 '반복 실행 짝' 고르기 (여러 번 하는 것 + 정한 날 체크)
import { useMemo, useState } from "react";
import { C, TBtn, Act, Head, Card, Row, inp, useLocal } from "./ui.jsx";
import { LS } from "./core.jsx";
import { md, isMaster, nameOf, scopeOf, fxPeople } from "./model.js";
import { canReq } from "../../marketing-hub/crew.js";
import { rtPairs, rtAiNow, rtSuggest, pairLabel, fxIdOf, rtKey, isFxKey } from "./airt.js";
import { brId } from "./routine.js";
import { akWho } from "../../pour-os/src/actionKpi.js";

const stopKey = (e) => { if (e.key !== "Escape") e.stopPropagation(); };
const canPair = (cu, mates, mid) => isMaster(cu) || Object.values(((mates || {})[mid] || {}).owners || {}).includes(cu.id);

export function AiLine({ ai, open }) {
  if (!ai || (!ai.wait.length && !ai.exec.length)) return null;
  const w = ai.wait.length, x = ai.exec.length, names = [...new Set(ai.pairs.map((p) => p.mateName))].join("·");
  const go = (e) => { e.stopPropagation(); if (w) open({ type: "aiask", id: ai.wait[0].id }); else open({ type: "task", id: ai.exec[0].id }); };
  return <button type="button" className="v2-rtai" onClick={go} onKeyDown={stopKey} aria-label={`AI ${names}${w ? ` 확인할 결과 ${w}` : ""}${x ? ` 실행 ${x}` : ""}`}>
    <b>AI {names}</b>{w ? ` · 확인할 결과 ${w}` : ""}{x ? ` · 실행 ${x}` : ""} ›</button>;
}

// 반복 실행 시트 'AI 크루' 칸 — kind 'ak'(여러 번) | 'fx'(정한 날 체크) · rkey = airt.rtKey
export function RtAiCard({ D, cu, A, open, rkey, name, brand, kind, owners }) {
  const mates = (D.ai && D.ai.mates) || {};
  const pairs = useMemo(() => rtPairs(mates).get(rkey) || [], [mates, rkey]);
  const ai = rtAiNow(rkey, pairs, (D.ai && D.ai.asks) || [], D.tasks || [], cu.id);
  const sug = pairs.length ? null : rtSuggest([{ key: rkey, name, brand: brId(brand), kind, owners }], mates)[0] || null;
  const reqMate = pairs.map((p) => p.mate).find(canReq) || (sug && canReq(sug.mate) ? sug.mate : "");
  const what = kind === "fx" ? "오늘 체크" : "+1";
  const stat = (p) => { const same = (a) => a.mate === p.mate && (p.act === "_" ? !a.act || a.act === "_" : a.act === p.act);
    const w = ai ? ai.wait.filter(same).length : 0, last = ((D.ai && D.ai.asks) || []).filter(same).sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")))[0];
    return [w ? `확인할 결과 ${w}` : "", last ? `최근 결과 ${md(String(last.run || last.createdAt || "").slice(0, 10))}` : "아직 결과 없음"].filter(Boolean).join(" · "); };
  return <>
    <Head>AI 크루</Head>
    <Card>
      {pairs.map((p) => <Row key={p.mate + p.act} title={pairLabel(p)} sub={stat(p)} onClick={() => open({ type: "aiMate", id: p.mate })}
        right={canPair(cu, mates, p.mate) ? <Act onClick={() => A.rtPairMany([{ mate: p.mate, act: p.act, key: "" }], { text: `짝을 풀었어요 · ${pairLabel(p)}` })} aria-label={`${pairLabel(p)} 짝 풀기`}>짝 풀기</Act> : null} />)}
      {ai && ai.wait.length > 0 && <Row tag="내 차례" title={`확인할 결과 ${ai.wait.length}건`} sub={ai.wait[0].title} onClick={() => open({ type: "aiask", id: ai.wait[0].id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} />}
      {ai && ai.exec.length > 0 && <Row tag="실행" title={`실행 업무 ${ai.exec.length}건`} sub={`[했어요]마다 여기 ${what} · ${ai.exec[0].title}`} onClick={() => open({ type: "task", id: ai.exec[0].id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} />}
      {!pairs.length && <Row title="도와주는 AI 크루가 아직 없어요" sub={sug ? `추천 · ${pairLabel(sug)}` : "AI 팀원 화면의 할 일마다 '반복 실행 짝'을 정해요"}
        right={sug && canPair(cu, mates, sug.mate) ? <Act onClick={() => A.rtPairMany([{ mate: sug.mate, act: sug.act, key: rkey, owner: sug.owner }])} aria-label={`${pairLabel(sug)} 짝 짓기`}>짝 짓기</Act> : null} />}
      {reqMate && <Row title="AI에게 맡기기" sub="이 반복 실행에 쓸 것 · 무엇을 · 몇 개 · 언제까지 → 결과는 승인으로 와요" onClick={() => open({ type: "aiReq", mate: reqMate, preset: { title: `${name} — `, body: `반복 실행 '${name}'에 쓸 것` } })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last />}
    </Card>
    <p style={{ fontSize: 12, color: C.mute, margin: "6px 2px 0", lineHeight: 1.6 }}>짝이면: AI 결과 승인 → 실행 업무에서 번호마다 [했어요] = 여기 {what}{kind === "fx" ? "(아직이면)" : ""} · 실제 반영은 늘 사람</p>
  </>;
}

// 반복 실행 후보 줄 (관리자 'AI 크루 짝' · 추천 계산) — 여러 번(사용 중 · 안 멈춘 것) + 정한 날 체크(브랜드 정한 것 · 브랜드 미정 · 멈추지 않은 것)
export function rtRows(D, inBrand = () => true) {
  const ak = ((D.ak && D.ak.items) || []).filter((it) => it && it.id && it.active !== false && !it.paused && inBrand(it.brand))
    .map((it) => ({ key: rtKey("ak", it.id), name: it.name || "", brand: brId(it.brand), kind: "ak", owners: akWho(D.users, it) }));
  const fx = (D.tasks || []).filter((t) => t.isFixed && !t.paused && !t.deleted && scopeOf(t) !== "me" && inBrand(t.brand))
    .map((t) => ({ key: rtKey("fx", t.id), name: t.title || "", brand: brId(t.brand), kind: "fx", owners: fxPeople(D.users, t) }));
  return [...ak, ...fx];
}

export function AiPairPanel({ D, cu, A, open, rows }) {
  const mates = (D.ai && D.ai.mates) || {}, P = useMemo(() => rtPairs(mates), [mates]);
  const sug = useMemo(() => rtSuggest(rows.filter((r) => !P.has(r.key)), mates), [rows, mates, P]);
  const paired = rows.filter((r) => P.has(r.key));
  const [on, setOn] = useLocal(LS("araipair"), true), [all, setAll] = useState(false), [busy, setBusy] = useState(false);
  const run = async (list) => { if (busy) return; setBusy(true); try { await A.rtPairMany(list); } finally { setBusy(false); } };
  const go = (r) => open(r.kind === "fx" ? { type: "fixed", id: fxIdOf(r.key) } : { type: "routine", id: r.key });
  const shownP = all ? paired : paired.slice(0, 4);
  return <div className="a-rtset">
    <div className="a-rtseth"><button type="button" className="a-rtnoh" aria-expanded={on} onClick={() => setOn(!on)}>AI 크루 짝 <b>{paired.length}</b> / {rows.length} · AI 결과를 실행하면 그 반복 실행에 바로 셈 · 추천 {sug.length} {on ? "▴" : "▾"}</button>
      {sug.length > 0 && <TBtn v="soft" disabled={busy} onClick={() => run(sug)}>추천대로 {sug.length}개 짝 짓기</TBtn>}</div>
    {on && <>
      {sug.map((x) => <div key={x.key} className="a-rtsrow">
        <button type="button" className="a-rtname" onClick={() => go(x)}><b>{x.name}</b><small>추천 · {pairLabel(x)}{x.owner ? ` · 결과 확인·실행 ${nameOf(D.users, x.owner)}` : ""}</small></button>
        <div className="a-rtschips" role="group" aria-label={`${x.name} AI 짝`}><button type="button" className="rec" disabled={busy} onClick={() => run([x])}>짝 짓기</button></div>
      </div>)}
      {shownP.map((r) => <div key={r.key} className="a-rtsrow">
        <button type="button" className="a-rtname" onClick={() => go(r)}><b>{r.name}</b><small>AI {P.get(r.key).map(pairLabel).join(" · ")}</small></button>
        {P.get(r.key).every((p) => canPair(cu, mates, p.mate)) && <div className="a-rtschips" role="group" aria-label={`${r.name} AI 짝 풀기`}><button type="button" disabled={busy} onClick={() => run(P.get(r.key).map((p) => ({ mate: p.mate, act: p.act, key: "" })))}>풀기</button></div>}
      </div>)}
      {paired.length > 4 && <button type="button" className="a-rtmore" onClick={() => setAll(!all)}>{all ? "접기 ▴" : `짝 지은 것 ${paired.length - 4}개 더 ▾`}</button>}
      <div className="a-rtsnote">짝이면 AI 결과를 최종 승인한 뒤 실행 업무 번호마다 [했어요] = 그 반복 실행 +1 (정한 날 체크는 오늘 체크) · 추천은 이름 낱말로 고른 것이라 맞지 않으면 [풀기] · 결과 확인·실행은 반복 실행 담당 한 명에게 · 5초 안에 되돌릴 수 있어요</div></>}
  </div>;
}

// AI 팀원 할 일 '반복 실행 짝' 고르기 — 여러 번 하는 것 + 정한 날 체크(브랜드 정한 것·미정)
export function RtSelect({ D, value, onChange, label }) {
  const rows = useMemo(() => rtRows(D), [D.ak, D.tasks]);
  const ak = rows.filter((r) => r.kind === "ak"), fx = rows.filter((r) => r.kind === "fx").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const has = !value || rows.some((r) => r.key === value);
  return <select value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ ...inp, width: "auto", maxWidth: 240, padding: "6px 8px", fontSize: 13 }}>
    <option value="">없음</option>
    {!has && <option value={value}>{isFxKey(value) ? "(없앤 체크)" : "(없앤 반복 실행)"}</option>}
    {ak.length > 0 && <optgroup label="여러 번 하는 것">{ak.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>}
    {fx.length > 0 && <optgroup label="정한 날 체크">{fx.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>}
  </select>;
}
