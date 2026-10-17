// 업무OS v2 — AI 크루 ↔ 반복 실행 (계산만 · 저장은 core · 사용자 요청 2026-10-16 "ai크루를 활용해서 반복업무들을 해결하는건데 이거 연관해서 이용하기 좋게 세팅해줘")
//   짝 = pour-os/v2/aimates/{AI}.actAk.{할 일 글자} = 반복 실행 열쇠 · 할 일 글자 '_' = 할 일 글자가 없는 결과(여름 아침 루틴 원고)
//     열쇠: 여러 번 하는 것 = 행동지표 id · 정한 날 체크 = 'fx:' + 고정업무 id
//   AI 결과 최종 승인 → 실행 업무(aiAk = 그 열쇠) → 번호마다 [했어요] = 여러 번 +1 / 정한 날 체크 = 오늘 체크(아직이면 · core.aiTrace)
//   화면: 오늘 '반복 실행' 줄 'AI 겨울 · 확인할 결과 1 · 실행 2 ›' · 반복 실행 시트 'AI 크루' 칸(짝 · 추천 · 맡기기) · 관리자 반복 실행 'AI 크루 짝' 칸([추천대로 짝 짓기])
//   2026-10-17 사장님 "현재 반복업무들 모두 ai크루든 도움받아서 해야해" → 할 일 하나 ↔ 열쇠 여러 개(actAk 값 = 열쇠 하나(예전) 또는 목록 · akKeys)
//     [했어요] = 누른 사람이 그 열쇠 담당인 것만 · 실행 브랜드와 맞는 것만 (countKeys) · 열쇠 담당이 실행 담당과 다르면 그 사람 몫 실행 업무도 (splitExec)
//     실행이 없는 보고(광고 보고 F)는 담당이 승인하면 그 사람 정한 날 체크를 그날 체크 (core.aiPass)
import { mateOf, boardOf, actOf, execOf, GONE } from "../../marketing-hub/crew.js";
import { traceLeft } from "./aiask.js";
import { isDone, isMine, fxIds, fxIsMine } from "./model.js";
import { akWho } from "../../pour-os/src/actionKpi.js";
import { brId } from "./routine.js";

export const FX_KEY = "fx:", NO_ACT = "_";
export const rtKey = (kind, id) => (kind === "fx" ? FX_KEY + id : String(id || ""));
export const isFxKey = (k) => String(k || "").startsWith(FX_KEY);
export const fxIdOf = (k) => (isFxKey(k) ? String(k).slice(FX_KEY.length) : "");
// 짝 값 → 열쇠 목록 (예전 글자 하나 · 목록 · 빈 값) / 저장 모양 (없음 null · 하나 = 글자(예전과 같음) · 여럿 = 목록)
export const akKeys = (v) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).filter((k) => typeof k === "string" && k))];
export const pairVal = (ks) => { const a = akKeys(ks); return !a.length ? null : a.length === 1 ? a[0] : a; };
// 실행 업무의 짝 열쇠 (aiAks 목록 · 예전 aiAk 하나)
export const taskAks = (t) => akKeys(t && (Array.isArray(t.aiAks) && t.aiAks.length ? t.aiAks : t.aiAk));
const fxOf = (D, k) => ((D && D.tasks) || []).find((x) => x && x.id === fxIdOf(k) && x.isFixed) || null;
const akOf = (D, k) => (((D && D.ak && D.ak.items) || []).find((x) => x && x.id === k)) || null;
// 열쇠 이름 (정한 날 체크 = 고정업무 이름 · 여러 번 = 반복 실행 이름 · 없앤 것 '')
export const keyName = (D, k) => (isFxKey(k) ? (fxOf(D, k) || {}).title || "" : (akOf(D, k) || {}).name || "");
// 열쇠 담당 (따로 정한 사람만 · '전체' 고정업무는 빼고 · 쉬는 사람 빼고) — 열쇠 담당별 실행 업무를 나눌 때
export function keyOwners(D, k) {
  const act = (id) => ((D && D.users) || []).some((u) => u && u.id === id && u.active !== false);
  if (isFxKey(k)) { const t = fxOf(D, k); return t && !t.forAll ? fxIds(t).filter(act) : []; }
  const it = akOf(D, k); return it ? akWho((D && D.users) || [], it).filter(act) : [];
}
// 실행 브랜드와 맞나 — 실행 업무 브랜드가 없거나(브랜드 섞인 결과) 열쇠 브랜드가 없거나 공통 운영이면 맞음
export const keyBrandOk = (keyBrand, execBrand) => { const kb = brId(keyBrand), eb = brId(execBrand); return !eb || !kb || kb === "common" || kb === eb; };
// [했어요] 한 번에 셀 열쇠 = 누른 사람이 그 열쇠 담당 + 실행 브랜드와 맞음 → [{key, kind 'ak'|'fx', it|ft}] (남의 것은 안 건드림 · 2026-10-17)
//   담당을 아무도 안 정한 반복 실행은 누른 사람에게 셈(남의 것이 아니라서 · 예전처럼)
export function countKeys(D, t, uid) {
  return taskAks(t).map((k) => {
    if (isFxKey(k)) { const ft = fxOf(D, k); return ft && fxIsMine(ft, uid) && keyBrandOk(ft.brand, t && t.brand) ? { key: k, kind: "fx", ft } : null; }
    const it = akOf(D, k), ow = it ? akWho((D && D.users) || [], it) : [];
    return it && (!ow.length || ow.includes(uid)) && keyBrandOk(it.brand, t && t.brand) ? { key: k, kind: "ak", it } : null;
  }).filter(Boolean);
}
// 열쇠 담당별 실행 업무 (2026-10-17 · 같은 할 일을 여러 사람이 쓰는 칸: 겨울 A 송희·미니 · 가을 B 송희·채림 · 가을 E 송희·이란 · 별 A …)
//   실행 담당(ex.assigneeId)이 아닌 열쇠 담당마다 같은 승인 번호의 실행 업무 하나 더 (id = 실행 id~사람 · 그 사람 열쇠만 · 실행 브랜드와 맞는 열쇠만)
export function splitExec(D, ex, keys, cu, at) {
  if (!ex) return [];
  const main = ex.assigneeId, by = new Map();
  akKeys(keys).forEach((k) => {
    const kb = isFxKey(k) ? (fxOf(D, k) || {}).brand : (akOf(D, k) || {}).brand; if (!keyBrandOk(kb, ex.brand)) return;
    keyOwners(D, k).forEach((u) => { if (u === main) return; if (!by.has(u)) by.set(u, []); by.get(u).push(k); }); });
  return [...by.entries()].map(([u, ks]) => { const { ackAt, ...rest } = ex;
    return { ...rest, id: `${ex.id}~${u}`, assigneeId: u, assigneeIds: [u], aiAk: ks[0], aiAks: ks, ...(cu && u === cu.id ? { ackAt: at } : {}) }; });
}
// 할 일 글자 → 보이는 이름 ('_' = 아침 루틴 원고)
export function actTitle(mateId, act) {
  const m = mateOf(mateId); if (!m) return "";
  if (act === NO_ACT) return m.routine ? "아침 루틴 원고" : "";
  const a = m.board ? actOf(m.board, act) : null; return a && !a.admin ? a.t : "";
}
// 짝 지을 수 있는 할 일 = 실행 한 줄이 있는 것(최종 승인 뒤 실행 업무 → [했어요]) + 아침 루틴 · 쉬는 AI 는 없음
export function pairActs(mateId) {
  const m = mateOf(mateId); if (!m || GONE[mateId]) return [];
  const b = m.board ? boardOf(m.board) : null;
  return [...(m.routine ? [{ c: NO_ACT, t: "아침 루틴 원고" }] : []), ...((b && b.actions) || []).filter((a) => !a.admin && execOf(a)).map((a) => ({ c: a.c, t: a.t }))];
}
// 짝 목록: 열쇠 → [{mate, mateName, act, actT}] (쉬는 AI · 없는 할 일 · 빈 값은 뺌)
export function rtPairs(mates) {
  const out = new Map();
  Object.entries(mates || {}).forEach(([mid, doc]) => {
    const m = mateOf(mid); if (!m || GONE[mid]) return;
    Object.entries((doc && doc.actAk) || {}).forEach(([act, v]) => {
      const t = actTitle(mid, act); if (!t) return;
      akKeys(v).forEach((key) => { if (!out.has(key)) out.set(key, []); out.get(key).push({ mate: mid, mateName: m.name, act, actT: t }); });
    });
  });
  return out;
}
// 그 짝의 결과인가 (승인 건) — '_' = 할 일 글자 없는 결과
const askHit = (a, p) => !!a && a.mate === p.mate && (p.act === NO_ACT ? !a.act || a.act === NO_ACT : a.act === p.act);
// 지금 나에게 남은 AI 일: wait = 확인할 결과(승인 내 차례) · exec = 내 실행 업무(흔적 남음) · last = 그 짝의 마지막 결과 · 짝이 없으면 null
export function rtAiNow(key, pairs, asks, tasks, uid) {
  const ps = pairs || []; if (!ps.length) return null;
  const hit = (a) => ps.some((p) => askHit(a, p));
  const wait = (asks || []).filter((a) => a && a.state === "wait" && a.to === uid && hit(a));
  const exec = (tasks || []).filter((t) => t && t.aiAsk && taskAks(t).includes(key) && !isDone(t) && t.status !== "dropped" && isMine(t, uid) && traceLeft(t) > 0);
  const last = (asks || []).filter(hit).sort((p, q) => String(q.createdAt || "").localeCompare(String(p.createdAt || "")))[0] || null;
  return { pairs: ps, wait, exec, last };
}
// 추천 짝 (실데이터 반복 실행 30 · 정한 날 체크 보고 고름 · 2026-10-16) — 반복 실행 이름(괄호 안 말 빼고) 낱말 → AI 할 일
//   할 일 하나엔 반복 실행 하나(위 줄 먼저) · 여러 번 하는 것(KPI 로 셈) 먼저 → 그 보드 브랜드와 같은 것 먼저 → 목록 순서 · 이미 짝 지은 할 일·반복 실행은 건너뜀
export const RT_AI_HINTS = [
  { re: /블로그|포스팅|컨텐츠|콘텐츠|원고/, mate: "yeoreum", act: NO_ACT },
  { re: /릴스|숏폼|쇼츠|숏츠/, mate: "yeoreum", act: "B" },
  { re: /공동구매|공구/, mate: "yeoreum", act: "D" },
  { re: /인플루언서|쿠팡\s*파트너스|체험단/, mate: "yeoreum", act: "A" },
  { re: /상세/, mate: "gyeoul", act: "C" },
  { re: /리뷰.*(프로모션|이벤트|할인|혜택)|사진\s*후기/, mate: "uju", act: "D" },
  { re: /리뷰.*(답글|답변|정리|유도|체계|관리)|후기\s*유도/, mate: "gyeoul", act: "E" },
  { re: /프로모션|캠페인|시즌/, mate: "uju", act: "E" },
  { re: /재구매|알림톡/, mate: "uju", act: "C" },
  { re: /UX|UI/i, mate: "uju", act: "B" },
  { re: /세트|키트|추가\s*구성|객단가/, mate: "haneul", act: "A" },
];
const bare = (s) => String(s || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
// rows = [{key, name, brand(보드 brand 와 같은 id · grohome·pourstore …), kind 'ak'|'fx', owners?}] → [{key, name, kind, mate, mateName, act, actT, owner?}]
export function rtSuggest(rows, mates) {
  const usedAct = new Set(), usedKey = new Set();
  Object.entries(mates || {}).forEach(([mid, doc]) => Object.entries((doc && doc.actAk) || {}).forEach(([act, v]) => { const ks = akKeys(v); if (ks.length) { usedAct.add(mid + "." + act); ks.forEach((k) => usedKey.add(k)); } }));
  const out = [];
  RT_AI_HINTS.forEach((h) => {
    const k = h.mate + "." + h.act; if (usedAct.has(k) || !pairActs(h.mate).some((a) => a.c === h.act)) return;
    const bb = ((boardOf((mateOf(h.mate) || {}).board) || {}).brand) || "";
    const cand = (rows || []).map((r, i) => ({ r, i })).filter(({ r }) => r && r.key && !usedKey.has(r.key) && h.re.test(bare(r.name)));
    if (!cand.length) return;
    const score = ({ r, i }) => (r.kind === "ak" ? 0 : 2000) + (bb && r.brand === bb ? 0 : 1000) + i;
    const { r } = cand.sort((a, b) => score(a) - score(b))[0];
    usedAct.add(k); usedKey.add(r.key);
    out.push({ key: r.key, name: r.name, kind: r.kind, mate: h.mate, mateName: (mateOf(h.mate) || {}).name || h.mate, act: h.act, actT: actTitle(h.mate, h.act), owner: h.act !== NO_ACT && (r.owners || []).length === 1 ? r.owners[0] : "" });   // 아침 루틴은 AI 담당(owners)이 받음 → 할 일 담당 없음
  });
  return out;
}
// 짝 한 줄 이름 ('겨울 · C 상세페이지 이탈 지점 진단…' · 아침 루틴 = '여름 · 아침 루틴 원고')
export const pairLabel = (p) => `${p.mateName} · ${p.act === NO_ACT ? "" : p.act + " "}${p.actT}`;
