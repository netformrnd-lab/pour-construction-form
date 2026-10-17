// 업무OS v2 — AI 크루 ↔ 반복 실행 (계산만 · 저장은 core · 사용자 요청 2026-10-16 "ai크루를 활용해서 반복업무들을 해결하는건데 이거 연관해서 이용하기 좋게 세팅해줘")
//   짝 = pour-os/v2/aimates/{AI}.actAk.{할 일 글자} = 반복 실행 열쇠 · 할 일 글자 '_' = 할 일 글자가 없는 결과(여름 아침 루틴 원고)
//     열쇠: 여러 번 하는 것 = 행동지표 id · 정한 날 체크 = 'fx:' + 고정업무 id
//   AI 결과 최종 승인 → 실행 업무(aiAk = 그 열쇠) → 번호마다 [했어요] = 여러 번 +1 / 정한 날 체크 = 오늘 체크(아직이면 · core.aiTrace)
//   화면: 오늘 '반복 실행' 줄 'AI 겨울 · 확인할 결과 1 · 실행 2 ›' · 반복 실행 시트 'AI 크루' 칸(짝 · 추천 · 맡기기) · 관리자 반복 실행 'AI 크루 짝' 칸([추천대로 짝 짓기])
//   2026-10-17 사장님 "현재 반복업무들 모두 ai크루든 도움받아서 해야해" → 할 일 하나 ↔ 열쇠 여러 개(actAk 값 = 열쇠 하나(예전) 또는 목록 · akKeys)
//     [했어요] = 누른 사람이 그 열쇠 담당인 것만 · 실행 브랜드와 맞는 것만 (countKeys) · 열쇠 담당이 실행 담당과 다르면 그 사람 몫 실행 업무도 (splitExec)
//     실행이 없는 보고(광고 보고 F)는 담당이 승인하면 그 사람 정한 날 체크를 그날 체크 (core.aiPass)
import { mateOf, boardOf, actOf, execOf, GONE, isLiveMate } from "../../marketing-hub/crew.js";
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
// 열쇠 브랜드 (정한 날 체크 = 고정업무 브랜드 · 여러 번 = 반복 실행 브랜드) · 없거나 공통 운영 = 브랜드 없는 열쇠
const brandOfKey = (D, k) => brId(isFxKey(k) ? (fxOf(D, k) || {}).brand : (akOf(D, k) || {}).brand);
const noBrand = (b) => !b || b === "common";
// [했어요] 한 번에 셀 열쇠 = 누른 사람이 그 열쇠 담당인 것 (남의 것은 안 건드림 · 담당을 아무도 안 정한 반복 실행은 누른 사람 것) → 브랜드로 고름 (2026-10-17)
//   그 줄 브랜드(itemBrand = 실행 업무 aiItems[n].b · 표의 '브랜드' 칸)가 있으면 그 브랜드 열쇠 + 브랜드 없는 열쇠만
//   없으면 실행 업무 브랜드(보드 브랜드)와 같은 열쇠 + 브랜드 없는 열쇠 · 같은 게 하나도 없으면 내 열쇠 모두
//     (B2C 크루는 두 브랜드를 같이 봄 — 그로홈 보드 할 일에 POUR스토어 반복 실행 하나만 짝지은 것(겨울 E 리뷰·후기 유도)도 셈)
//   → [{key, kind 'ak'|'fx', it|ft}]
//   보드 할 일이 keyBy(달 A '신제품')면 정한 날 체크는 그 줄 이름(itemProd)이 제목에 들어간 것만 (본부장 신제품 상시 업무 8개가 한 번에 체크되지 않게 · 2026-10-17) · 여러 번 하는 것(행동지표)은 그대로
export const normK = (s) => String(s || "").replace(/[\s·:/()\-_,.]/g, "").toLowerCase();
export function countKeys(D, t, uid, itemBrand, itemProd) {
  const act = t && t.aiBoard && t.aiAct ? actOf(t.aiBoard, t.aiAct) : null, kp = act && act.keyBy ? normK(itemProd) : null;
  const mine = taskAks(t).map((k) => {
    if (isFxKey(k)) { const ft = fxOf(D, k); return ft && fxIsMine(ft, uid) ? { key: k, kind: "fx", ft, b: brId(ft.brand) } : null; }
    const it = akOf(D, k), ow = it ? akWho((D && D.users) || [], it) : [];
    return it && (!ow.length || ow.includes(uid)) ? { key: k, kind: "ak", it, b: brId(it.brand) } : null;
  }).filter(Boolean).filter((x) => kp === null || x.kind !== "fx" || (!!kp && normK(x.ft.title).includes(kp)));
  const ib = brId(itemBrand), eb = ib || brId(t && t.brand);
  if (!eb || eb === "common") return mine;
  return ib || mine.some((x) => x.b === eb) ? mine.filter((x) => x.b === eb || noBrand(x.b)) : mine;
}
// 열쇠 담당별 실행 업무 (2026-10-17 · 같은 할 일을 여러 사람이 쓰는 칸: 겨울 A 송희·미니 · 가을 B 송희·채림 · 가을 E 송희·이란 …)
//   실행 담당(ex.assigneeId)이 아닌 열쇠 담당마다 같은 승인의 실행 업무 하나 더 (id = 실행 id~사람 · 그 사람 열쇠만)
//   · 번호 = 그 사람 열쇠가 셀 수 있는 줄만 (그 줄 브랜드가 그 사람 열쇠 브랜드이거나 브랜드 칸이 없는 줄) — 셀 줄이 없으면 안 만듦
//   · 여럿(SPLIT_MAX 넘게)이 같이 하는 일(KPI 기재·주간 미팅 등)은 나누지 않음 — 누른 사람 몫만 셈
export const SPLIT_MAX = 2;
export function splitExec(D, ex, keys, cu, at) {
  if (!ex) return [];
  const main = ex.assigneeId, by = new Map();
  akKeys(keys).forEach((k) => { const ow = keyOwners(D, k); if (ow.length > SPLIT_MAX) return;
    ow.forEach((u) => { if (u === main) return; if (!by.has(u)) by.set(u, []); by.get(u).push(k); }); });
  const items = ex.aiItems || [];
  return [...by.entries()].map(([u, ks]) => {
    const kbs = ks.map((k) => brandOfKey(D, k)), anyBare = kbs.some(noBrand);
    const its = anyBare ? items : items.filter((x) => !x.b || kbs.includes(brId(x.b)));
    if (items.length && !its.length) return null;
    const { ackAt, ...rest } = ex;
    return { ...rest, id: `${ex.id}~${u}`, assigneeId: u, assigneeIds: [u], aiAk: ks[0], aiAks: ks, aiItems: its, ...(cu && u === cu.id ? { ackAt: at } : {}) }; }).filter(Boolean);
}
// 보고 승인 = 그날 체크는 그 체크의 시각이 됐을 때만 (금 16:30 '광고 주간 분석 보고'가 아침 보고 승인으로 미리 체크되지 않게 · 시각 없으면 됨 · 2026-10-17)
export const fxTimeCome = (hhmm, nowHM) => !hhmm || String(hhmm).slice(0, 5) <= String(nowHM || "").slice(0, 5);
// 할 일 글자 → 보이는 이름 ('_' = 아침 루틴 원고)
export function actTitle(mateId, act) {
  const m = mateOf(mateId); if (!m) return "";
  if (act === NO_ACT) return m.routine ? "아침 루틴 원고" : "";
  const a = m.board ? actOf(m.board, act) : null; return a && !a.admin ? a.t : "";
}
// 짝 지을 수 있는 할 일 = 실행 한 줄이 있는 것(최종 승인 뒤 실행 업무 → [했어요]) + 광고 보고(report · 승인하면 짝 정한 날 체크 · 2026-10-17) + 아침 루틴 · 쉬는 AI · 닫힌 크루(B2B·바라스데이 · 2026-10-17)는 없음
export const pairable = (a) => !!a && !a.admin && (!!execOf(a) || !!a.report);
export function pairActs(mateId) {
  const m = mateOf(mateId); if (!m || GONE[mateId] || !isLiveMate(mateId)) return [];
  const b = m.board ? boardOf(m.board) : null;
  return [...(m.routine ? [{ c: NO_ACT, t: "아침 루틴 원고" }] : []), ...((b && b.actions) || []).filter(pairable).map((a) => ({ c: a.c, t: a.t }))];
}
// 지금 있는 할 일의 짝만 (옮긴 옛 글자 · 없앤 할 일의 옛 짝은 빼고 · 2026-10-17 AARRR 정리 — 옛 짝 기록은 aimates 에 그대로) → {글자: 열쇠 목록}
export function liveAk(mateId, doc) {
  const out = {}; Object.entries((doc && doc.actAk) || {}).forEach(([act, v]) => { const ks = akKeys(v); if (ks.length && actTitle(mateId, act)) out[act] = ks; });
  return out;
}
export const liveActOwners = (mateId, doc) => Object.fromEntries(Object.entries((doc && doc.actOwners) || {}).filter(([act, u]) => u && actTitle(mateId, act)));
// 짝 목록: 열쇠 → [{mate, mateName, act, actT}] (쉬는 AI · 닫힌 크루 · 없는 할 일 · 빈 값은 뺌 — 닫힌 크루의 옛 짝 기록은 aimates 에 그대로)
export function rtPairs(mates) {
  const out = new Map();
  Object.entries(mates || {}).forEach(([mid, doc]) => {
    const m = mateOf(mid); if (!m || GONE[mid] || !isLiveMate(mid)) return;
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
//   차례대로 고름 (먼저 고른 열쇠는 뒤에서 안 씀) — B2B 보드 힌트(seg 'B2B' · 이름에 B2B 있는 것만 · loose 힌트(시공 이탈·매칭)는 B2B 표시가 없어도 · '(B2C)' 빼고)를 먼저 · 그다음 B2C 크루 (2026-10-17)
//     B2C 쪽은 '(B2B)' 이름을 뒤로 미룸(빼지는 않음 — 여름 D ← '(B2B) 인플루언서 공동구매 제안'처럼 B2C 크루가 하는 것도 있음)
export const RT_AI_HINTS = [
  { re: /체험단/, mate: "dandan", act: "B", seg: "B2B" },
  { re: /인플루언서\s*섭외/, mate: "dandan", act: "C", seg: "B2B" },
  { re: /컨텐츠|콘텐츠/, mate: "dandan", act: "A", seg: "B2B" },
  { re: /미전환/, mate: "cheokcheok", act: "B", seg: "B2B" },
  { re: /이탈/, mate: "cheokcheok", act: "C", seg: "B2B", loose: true },   // loose = 이름에 B2B 가 없어도 (시공의뢰 이탈자 = B2B 문의)
  { re: /시공\s*파트너|매칭/, mate: "kkomkkom", act: "A", seg: "B2B", loose: true },
  { re: /프로모션/, mate: "deundeun", act: "A", seg: "B2B" },
  { re: /NPS|만족도/, mate: "teunteun", act: "A", seg: "B2B" },
  { re: /위탁|도매|철물점/, mate: "teunteun", act: "B", seg: "B2B" },
  { re: /인플루언서.*리뷰|리뷰\s*회수/, mate: "yeoreum", act: "G" },
  { re: /포스팅\s*링크|링크\s*수정/, mate: "yeoreum", act: "H" },
  { re: /오픈\s*채팅|셀러오션|샐러오션/, mate: "yeoreum", act: "I" },
  { re: /미전환/, mate: "gyeoul", act: "G" },
  { re: /추천제|추천\s*쿠폰|지인\s*추천|친구\s*추천/, mate: "baram", act: "A" },   // 2026-10-17 지인추천 = 바람
  { re: /NPS|만족도/, mate: "baram", act: "C" },
  { re: /광고\s*(확인|점검|보고)/, mate: "gaeul", act: "F" },   // 광고 보고 F (승인 = 그날 체크) · 주간 분석 보고(금 오후)는 아침 보고로 미리 체크되지 않게 사람이 따로
  { re: /타겟\s*광고|메타\s*광고|인스타\s*광고/, mate: "gaeul", act: "G" },   // 2026-10-17 광고는 가을 (예전 여름 C)
  { re: /블로그|포스팅|컨텐츠|콘텐츠|원고/, mate: "yeoreum", act: NO_ACT },
  { re: /릴스|숏폼|쇼츠|숏츠/, mate: "yeoreum", act: "B" },
  { re: /공동구매|공구/, mate: "yeoreum", act: "D" },
  { re: /인플루언서|쿠팡\s*파트너스|체험단/, mate: "yeoreum", act: "A" },
  { re: /상세/, mate: "gyeoul", act: "C" },
  { re: /리뷰.*(프로모션|이벤트|할인|혜택)|사진\s*후기/, mate: "baram", act: "B" },
  { re: /리뷰.*(답글|답변|정리|유도|체계|관리)|후기\s*유도/, mate: "baram", act: "D" },   // 2026-10-17 사장님 AARRR 정의 · 리뷰·만족 = 지인추천 (겨울 E → 바람 D)
  { re: /프로모션|캠페인|시즌/, mate: "bom", act: "H" },   // 2026-10-17 프로모션 = 봄(MD)
  { re: /리스팅|아이템\s*위너|리셀러/, mate: "bom", act: "F" },
  { re: /재구매|알림톡/, mate: "uju", act: "C" },
  { re: /UX|UI/i, mate: "gyeoul", act: "C" },   // 자사몰 UX/UI = 전환 (2026-10-17 AARRR · 볼트 설계표 E 'ak_ux → 겨울 C')
  { re: /세트|키트|추가\s*구성|객단가/, mate: "haneul", act: "A" },
  { re: /재고|품절/, mate: "ieum", act: "F" },   // 2026-10-17 재고 = 이음 한 명 (비즈로지컴·쿠팡 로켓그로스 · 겨울 A·별 B 에서)
];
const bare = (s) => String(s || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
// rows = [{key, name, brand(보드 brand 와 같은 id · grohome·pourstore …), kind 'ak'|'fx', owners?}] → [{key, name, kind, mate, mateName, act, actT, owner?}]
export function rtSuggest(rows, mates) {
  const usedAct = new Set(), usedKey = new Set();
  Object.entries(mates || {}).forEach(([mid, doc]) => { if (!isLiveMate(mid)) return; Object.entries(liveAk(mid, doc)).forEach(([act, ks]) => { usedAct.add(mid + "." + act); ks.forEach((k) => usedKey.add(k)); }); });   // 닫힌 크루의 옛 짝은 '이미 짝'으로 안 셈 → B2C 크루 추천에 다시 나옴
  const out = [];
  RT_AI_HINTS.forEach((h) => {
    const k = h.mate + "." + h.act; if (usedAct.has(k) || !pairActs(h.mate).some((a) => a.c === h.act)) return;
    const bb = ((boardOf((mateOf(h.mate) || {}).board) || {}).brand) || "";
    const b2bOnly = (name) => /\(\s*B2B\s*\)/i.test(String(name || "")), b2cOnly = (name) => /\(\s*B2C\s*\)/i.test(String(name || ""));
    const b2bOk = (r) => !b2cOnly(r.name) && (h.loose || /B2B/i.test(String(r.name || "")));   // B2B 보드 = 이름에 B2B 있는 것만 (시공 이탈·매칭 = loose) — '체험단 모집 공지' 같은 B2C 업무는 안 가져감 (2026-10-17)
    const cand = (rows || []).map((r, i) => ({ r, i })).filter(({ r }) => r && r.key && !usedKey.has(r.key) && !(h.seg === "B2B" && !b2bOk(r)) && h.re.test(bare(r.name)));
    if (!cand.length) return;
    const score = ({ r, i }) => (r.kind === "ak" ? 0 : 4000) + (bb && r.brand === bb ? 0 : 2000) + ((h.seg === "B2B" ? !/B2B/i.test(String(r.name || "")) : b2bOnly(r.name)) ? 1000 : 0) + i;
    const { r } = cand.sort((a, b) => score(a) - score(b))[0];
    usedAct.add(k); usedKey.add(r.key);
    out.push({ key: r.key, name: r.name, kind: r.kind, mate: h.mate, mateName: (mateOf(h.mate) || {}).name || h.mate, act: h.act, actT: actTitle(h.mate, h.act), owner: h.act !== NO_ACT && (r.owners || []).length === 1 ? r.owners[0] : "" });   // 아침 루틴은 AI 담당(owners)이 받음 → 할 일 담당 없음
  });
  return out;
}
// 짝 한 줄 이름 ('겨울 · C 상세페이지 이탈 지점 진단…' · 아침 루틴 = '여름 · 아침 루틴 원고')
export const pairLabel = (p) => `${p.mateName} · ${p.act === NO_ACT ? "" : p.act + " "}${p.actT}`;
