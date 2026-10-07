// 업무OS v2 — 프로젝트 단계(로드) 화면 조각 (사용자 확정 2026-10-07 '카테고리별 로드')
// RoadEdit = 단계 고치기(이름 · ▴▾ 순서 · ✕ 빼기 · + 더하기 · 저장은 부르는 쪽) · RoadBox = 프로젝트 [정보 · 더 하기 ▾] 안 '단계' 줄 + [단계 고치기]
// StageSortCard = '단계 정리 n개' (단계 미정 업무 + 추천 · [추천대로 넣기] · 칩 하나로 넣기) · CatRoadAsk = 카테고리를 바꿀 때 '단계도 바꿀까요?'
import { useState } from "react";
import { C, TBtn, Chip, Card, Act, Ask, inp } from "./ui.jsx";
import {
  cleanRoad, newStageKey, roadProblem, ROAD_MAX, STAGE_NAME_MAX, stageName, stageSortRows, roadOwn, isFlowProj, isLaunchProj, canEditRoad, catRoad, projCat, catName,
  roadSwitchPlan, sameRoad, projLeadOrMaster,
} from "./model.js";

export const roadLine = (road) => (road || []).map((s) => s.name).join(" → ");

// 단계 고치기 — road 를 바로 고쳐 onChange 로 (열쇠는 그대로 · 새 단계는 새 열쇠) · counts = {열쇠: 업무 수}(뺄 때 알려 주기)
export function RoadEdit({ road, onChange, counts, label = "단계 고치기" }) {
  const [nm, setNm] = useState("");
  const set = (i, v) => onChange(road.map((s, j) => (j === i ? { ...s, name: v.slice(0, STAGE_NAME_MAX) } : s)));
  const mv = (i, d) => { const j = i + d; if (j < 0 || j >= road.length) return; const a = road.slice(); [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const add = () => { const v = nm.trim(); if (!v || road.length >= ROAD_MAX) return; onChange([...road, { k: newStageKey(road), name: v.slice(0, STAGE_NAME_MAX) }]); setNm(""); };
  return <div className="v2-roadedit" role="group" aria-label={label}>
    {road.map((s, i) => <div key={s.k} className="v2-re-row">
      <span className="n">{i + 1}</span>
      <input value={s.name} onChange={(e) => set(i, e.target.value)} aria-label={`${i + 1}단계 이름`} maxLength={STAGE_NAME_MAX} style={{ ...inp, padding: "8px 10px", fontSize: 14 }} />
      {counts && counts[s.k] ? <span className="c">업무 {counts[s.k]}</span> : null}
      <TBtn aria-label={`${i + 1}단계 위로`} disabled={i === 0} onClick={() => mv(i, -1)} style={{ minWidth: 34, padding: "0 6px" }}>▴</TBtn>
      <TBtn aria-label={`${i + 1}단계 아래로`} disabled={i === road.length - 1} onClick={() => mv(i, 1)} style={{ minWidth: 34, padding: "0 6px" }}>▾</TBtn>
      <TBtn aria-label={`${i + 1}단계 빼기`} tone="mute" disabled={road.length <= 1} onClick={() => onChange(road.filter((_, j) => j !== i))} style={{ minWidth: 34, padding: "0 6px" }}>✕</TBtn>
    </div>)}
    {road.length < ROAD_MAX ? <div className="v2-re-add">
      <input value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} maxLength={STAGE_NAME_MAX} placeholder="+ 단계 더하기 (예: 검수)" aria-label="새 단계 이름" style={{ ...inp, padding: "8px 10px", fontSize: 14 }} />
      <Act onClick={add}>더하기</Act></div>
      : <div style={{ fontSize: 12.5, color: C.sub, padding: "6px 2px" }}>단계는 {ROAD_MAX}개까지예요</div>}
  </div>;
}

// 프로젝트 [정보 · 더 하기 ▾] 안 '단계' 줄 — 책임자·관리자만 [단계 고치기] (신제품·그로홈 KPI 는 보기만)
//   뺀 단계에 업무가 있으면 먼저 묻기('단계 미정'으로 · 업무는 그대로) · 저장 = A.setRoad(조건부 · 기록 · 5초 되돌리기)
export function RoadBox({ p, D, cu, A, road, phOf, tasks }) {
  const [edit, setEdit] = useState(null), [ask, setAsk] = useState(null), [busy, setBusy] = useState(false);
  if (!road) return null;
  const can = canEditRoad(p, cu), flow = isFlowProj(p), own = roadOwn(p), def = catRoad(projCat(p), D);
  const counts = {}; (tasks || []).forEach((t) => { const k = phOf(t); if (k) counts[k] = (counts[k] || 0) + 1; });
  const where = isLaunchProj(p) ? "신제품 대시보드 7단계" : flow ? "흐름 단계" : own ? "이 프로젝트만" : `${catName(projCat(p)) || "미분류"} 기본`;
  const prob = edit ? roadProblem(edit) : "";
  const save = async (force) => { if (!edit || prob || busy) return;
    const gone = road.filter((s) => counts[s.k] && !edit.some((x) => x.k === s.k));
    if (gone.length && !force) { setAsk(gone); return; }
    setAsk(null); setBusy(true); const ok = await A.setRoad(p, edit); setBusy(false); if (ok) setEdit(null); };
  return <div className="v2-roadbox">
    <div>단계 <b>{roadLine(road)}</b> <span style={{ fontSize: 12.5, color: C.mute }}>· {where}</span></div>
    {can && !edit && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}><TBtn v="soft" onClick={() => setEdit(road.map((s) => ({ ...s })))}>단계 고치기</TBtn></div>}
    {edit && <div style={{ marginTop: 6 }}>
      <RoadEdit road={edit} onChange={setEdit} counts={counts} label="프로젝트 단계 고치기" />
      {prob && <div role="status" style={{ fontSize: 12.5, color: C.ink, fontWeight: 700, margin: "4px 2px" }}>{prob}</div>}
      <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "4px 2px" }}>이름을 바꾸거나 순서를 바꿔도 업무는 그 단계에 그대로 있어요 · 뺀 단계의 업무는 '단계 미정'으로 가요(지우지 않아요)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        <TBtn v="solid" disabled={!!prob || busy} onClick={() => save(false)}>{busy ? "저장 중" : "저장"}</TBtn>
        <TBtn onClick={() => { setEdit(null); setAsk(null); }}>그만</TBtn>
        {own && !flow && !sameRoad(edit, def) && <TBtn tone="mute" onClick={() => setEdit(def.map((s) => ({ ...s })))}>카테고리 기본으로</TBtn>}
      </div></div>}
    {ask && <Ask title="단계를 빼요" body={`${ask.map((s) => `'${s.name}' 업무 ${counts[s.k]}개`).join(" · ")}는 '단계 미정'으로 옮겨져요.\n업무는 지우지 않아요 · 5초 안에 되돌릴 수 있어요.`} yes="빼고 저장" onNo={() => setAsk(null)} onYes={() => save(true)} />}
  </div>;
}

// 카테고리 바꿀 때 '단계도 바꿀까요?' (책임자·관리자) — [새 단계로 바꾸기] [지금 단계 그대로] [그만]
export function CatRoadAsk({ p, D, A, cat, road, phOf, tasks, onDone }) {
  const [busy, setBusy] = useState(false);
  const nr = catRoad(cat, D), plan = roadSwitchPlan(road, nr, tasks, phOf);
  const go = async (mode) => { if (busy) return; setBusy(true); const ok = await A.setCategory(p, cat, mode); setBusy(false); if (ok !== false) onDone(); };
  return <div className="v2-catask" role="group" aria-label="카테고리 바꾸기">
    <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>'{catName(cat) || "미분류"}'(으)로 바꿔요 · 단계도 바꿀까요?</div>
    <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.65, marginTop: 4 }}>
      <div>지금 단계: {roadLine(road)}</div>
      <div>새 단계: <b style={{ color: C.text }}>{roadLine(nr)}</b></div>
      {(plan.keep.length + plan.move.length + plan.loose.length) > 0 && <div>바꾸면 업무 {plan.keep.length + plan.move.length}개는 같은 단계로{plan.loose.length ? ` · ${plan.loose.length}개는 '단계 미정'으로 (업무는 지우지 않아요)` : ""}</div>}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <TBtn v="solid" disabled={busy} onClick={() => go("switch")}>새 단계로 바꾸기</TBtn>
      <TBtn disabled={busy} onClick={() => go("keep")}>지금 단계 그대로</TBtn>
      <TBtn tone="mute" onClick={onDone}>그만</TBtn>
    </div>
  </div>;
}

// '단계 정리 n개' — 단계 미정인 열린 위 업무 + 추천 단계 · [추천대로 넣기](한 번에 · 조건부 · 5초 되돌리기) · 칩 하나 = 그 업무만
//   책임자·관리자 = 모든 업무 · 담당 = 내 업무만 (model.stageSortRows) · 신제품(기타)은 없음
export function StageSortCard({ p, D, cu, A, road, phOf }) {
  const [busy, setBusy] = useState(""), [more, setMore] = useState(false);
  const rows = stageSortRows(p, D, cu, road, phOf);
  if (!rows.length) return null;
  const sug = rows.filter((r) => r.sug), shown = more ? rows : rows.slice(0, 5), mineOnly = !projLeadOrMaster(p, cu);
  const all = async () => { if (busy) return; setBusy("all"); await A.setPhases(p, sug.map((r) => ({ t: r.t, k: r.sug }))); setBusy(""); };
  const one = async (t, k) => { if (busy) return; setBusy(t.id); await A.setPhase(t, k); setBusy(""); };
  return <Card style={{ marginTop: 10 }}>
    <div className="v2-sort" role="group" aria-label="단계 정리">
      <div className="hd"><b>{mineOnly ? "내 업무 " : ""}단계 정리 {rows.length}개</b>
        {sug.length > 0 && <TBtn v="solid" disabled={!!busy} onClick={all}>{busy === "all" ? "넣는 중" : `추천대로 넣기 · ${sug.length}개`}</TBtn>}</div>
      <div className="sub">아직 단계가 없는 업무예요 · 추천을 보고 한 번에 넣거나, 업무마다 단계를 눌러요{sug.length < rows.length ? ` · 추천 없는 ${rows.length - sug.length}개는 직접 골라요` : ""}</div>
      {shown.map(({ t, sug: k }) => <div key={t.id} className="row">
        <div className="tt">{t.title}</div>
        <div className="v2-chips" role="group" aria-label={`${t.title} 단계`}>{road.map((s) => <Chip key={s.k} on={false} onClick={() => one(t, s.k)} style={s.k === k ? { borderColor: C.navy, color: C.navy, background: C.soft } : null}>{s.name}{s.k === k ? " · 추천" : ""}</Chip>)}</div>
      </div>)}
      {rows.length > 5 && <div style={{ padding: "4px 0 2px" }}><TBtn tone="mute" onClick={() => setMore(!more)}>{more ? "접기 ▴" : `${rows.length - 5}개 더 ▾`}</TBtn></div>}
    </div>
  </Card>;
}
