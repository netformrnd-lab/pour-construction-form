// 업무OS v2 — AI 크루 ↔ 반복 실행 (계산만 · 저장은 core · 사용자 요청 2026-10-16 "ai크루를 활용해서 반복업무들을 해결하는건데 이거 연관해서 이용하기 좋게 세팅해줘")
//   짝 = pour-os/v2/aimates/{AI}.actAk.{할 일 글자} = 반복 실행 열쇠 · 할 일 글자 '_' = 할 일 글자가 없는 결과(여름 아침 루틴 원고)
//     열쇠: 여러 번 하는 것 = 행동지표 id · 정한 날 체크 = 'fx:' + 고정업무 id
//   AI 결과 최종 승인 → 실행 업무(aiAk = 그 열쇠) → 번호마다 [했어요] = 여러 번 +1 / 정한 날 체크 = 오늘 체크(아직이면 · core.aiTrace)
//   화면: 오늘 '반복 실행' 줄 'AI 겨울 · 확인할 결과 1 · 실행 2 ›' · 반복 실행 시트 'AI 크루' 칸(짝 · 추천 · 맡기기) · 관리자 반복 실행 'AI 크루 짝' 칸([추천대로 짝 짓기])
import { mateOf, boardOf, actOf, execOf, GONE } from "../../marketing-hub/crew.js";
import { traceLeft } from "./aiask.js";
import { isDone, isMine } from "./model.js";

export const FX_KEY = "fx:", NO_ACT = "_";
export const rtKey = (kind, id) => (kind === "fx" ? FX_KEY + id : String(id || ""));
export const isFxKey = (k) => String(k || "").startsWith(FX_KEY);
export const fxIdOf = (k) => (isFxKey(k) ? String(k).slice(FX_KEY.length) : "");
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
    Object.entries((doc && doc.actAk) || {}).forEach(([act, key]) => {
      const t = key ? actTitle(mid, act) : ""; if (!t) return;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ mate: mid, mateName: m.name, act, actT: t });
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
  const exec = (tasks || []).filter((t) => t && t.aiAsk && t.aiAk === key && !isDone(t) && t.status !== "dropped" && isMine(t, uid) && traceLeft(t) > 0);
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
  Object.entries(mates || {}).forEach(([mid, doc]) => Object.entries((doc && doc.actAk) || {}).forEach(([act, key]) => { if (key) { usedAct.add(mid + "." + act); usedKey.add(key); } }));
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
