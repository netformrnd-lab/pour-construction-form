// 업무OS v2 — 결과 숫자 들어온 날 · 비면 'n일째' (③ 결과 숫자 채우기 · 2026-10-17 · 계산만 · 시험 feeds.test.mjs)
//   볼트 점검 P0-4 "허브 판매·광고·VOC 0 · 보드 지표 0 · 광고 보고서 1 → 숫자 피드가 비면 'n일째'로 경고합니다"
//   피드 = 들어오는 곳 · 마지막 날 · 늦으면 누구에게 · 어디서 고치나 (저장 없음 · 읽기만)
//     POUR스토어 판매 = kpisales/crm-pourstore (CRM 이 열려 있으면 3시간마다 · checkedAt) · 판매 마지막 날 daysTo
//     그로홈 판매 = kpisales/grohome.daysTo (그로홈 대시보드 판매 입력 마지막 날 · 업무OS 관리자 기기가 3시간마다 읽음)
//     광고 일일 보고서 = adreports 마지막 date (Aside 광고 예약 · 관리자 PC) — 관리자 + 고정업무 '광고 확인' 담당
//     허브 리포트(Aside 업로드 · 카페24·광고·재고) = 허브 '오늘 숫자' counts (매일 06:10 GitHub)
//     보드 지표 = aiboards.hist 마지막 날 — 보드는 도는데([상태]만) 지표가 비면 그 AI 담당에게
//   '확인할 것' = 관리자 한 줄 '결과 숫자 n곳 비어 있음'(오늘 하루 읽음으로 숨김) · '광고 확인' 담당 한 줄 · 보드 담당 한 줄 → 누르면 결과 숫자 시트(feedui.FeedSheet)
import { ymd, md, addDays, isOffDay, wdBetween, isMaster, fxIds, isRemoved } from "./model.js";
import { BOARDS, mateOf, isLiveBoard, PAUSE } from "../../marketing-hub/crew.js";
import { mateOwner } from "./aiask.js";

export const HUB = "../marketing-hub/";
export const LAG = { crm: 2, gh: 3, ads: 2, hub: 2, board: 2 };   // 평일 이만큼 지나면 '비어 있음' (보드 = 돌 날 수)
export const AD_FX_RE = /광고\s*확인/;
const dayOf = (iso) => { if (!iso) return ""; const s = String(iso); if (/^\d{4}-\d\d-\d\d$/.test(s)) return s; const d = new Date(s); return isNaN(d) ? "" : ymd(d); };
const maxOf = (xs) => xs.filter(Boolean).sort().pop() || "";
// last 다음 날부터 어제까지 그 보드가 돌 날 수 (dow 없으면 평일)
const runsBetween = (last, today, dow) => { let n = 0; for (let k = addDays(last, 1), i = 0; k < today && i < 92; k = addDays(k, 1), i++) { const w = new Date(k + "T00:00:00").getDay(); if (Array.isArray(dow) && dow.length ? dow.includes(w) && !isOffDay(k) : !isOffDay(k)) n++; } return n; };
export const lagText = (r) => (r.err ? "확인 못 함" : r.wait ? "첫 숫자 기다리는 중" : !r.last ? (r.unit === "run" ? "아직 없음" : "없음") : r.unit === "run" ? `${md(r.last)} 뒤 ${r.lag}번 비어 있음` : r.lag >= 1 ? `${md(r.last)} · 평일 ${r.lag}일째` : md(r.last));

// 피드 줄 — F = { ads: {last}, hub: {counts, at} } (useFeeds 가 읽음 · 못 읽었으면 그 줄은 '확인 못 함')
export function feedRows(D, now = new Date(), F = D.feeds || {}) {
  const today = ymd(now), S = (D.kpi && D.kpi.sales) || {}, out = [];
  const wd = (d) => (d ? wdBetween(d, today) : null);
  // POUR스토어 판매 (CRM) — 마지막 '확인'(checkedAt)이 오래되면 CRM 을 연 사람이 없음 → 판매 숫자 멈춤
  //   새 CRM 다리(checkedAt)가 아직 안 돌았으면 '첫 숫자 기다리는 중'(경고 안 함) · 문서가 아예 없으면 '없음'
  const crm = S["crm-pourstore"] || null, cChk = dayOf(crm && crm.checkedAt), cWait = !!crm && !crm.checkedAt;
  out.push({ key: "crm", label: "POUR스토어 판매 (CRM)", short: "CRM 판매", last: cChk, sale: (crm && crm.daysTo) || "", lag: wd(cChk), who: "master", wait: cWait, bad: !cWait && (!cChk || wd(cChk) >= LAG.crm),
    fix: "CRM(관리자·직원 누구나)을 열면 3시간마다 들어와요", url: "https://pourstorecrm.web.app/v2" });
  // 그로홈 판매 — 그로홈 대시보드 판매 입력 마지막 날 (업무OS 관리자 기기가 아직 한 번도 날짜별로 안 읽었으면 기다림)
  const gh = S.grohome || null, gTo = (gh && gh.daysTo) || "", gWait = !!gh && !gh.daysHash;
  out.push({ key: "gh", label: "그로홈 판매 (그로홈 대시보드)", short: "그로홈 판매", last: gTo, lag: wd(gTo), who: "master", wait: gWait, bad: !gWait && (!gTo || wd(gTo) >= LAG.gh),
    fix: "그로홈 대시보드 판매 입력 확인 · 업무OS 관리자 기기가 3시간마다 읽어요", url: "https://grohome-dashboard.web.app" });
  // 광고 일일 보고서 (Aside) — 못 읽었으면 '확인 못 함'(경고 안 함)
  if (F.ads !== undefined) { const a = (F.ads && F.ads.last) || "", err = !!(F.ads && F.ads.err);
    out.push({ key: "ads", label: "광고 일일 보고서 (Aside)", short: "광고 보고서", last: a, lag: wd(a), who: "ads", err, bad: !err && (!a || wd(a) >= LAG.ads),
      fix: "관리자 PC Aside 광고 예약 확인 · 허브 광고 운영 맨 위 [예약 글 복사]", url: HUB + "ads.html" }); }
  // 허브 리포트 (Aside 업로드 · 카페24·광고·재고)
  if (F.hub !== undefined) { const c = (F.hub && F.hub.counts) || {}, h = maxOf([c.salesUpTo, c.adsUpTo, c.stockUpTo]), err = !!(F.hub && F.hub.err);
    out.push({ key: "hub", label: "허브 리포트 (Aside 업로드 · 카페24·광고·재고)", short: "허브 리포트", last: h, lag: wd(h), who: "master", err, bad: !err && (!h || wd(h) >= LAG.hub),
      fix: "Aside 업로드 세팅 전 · 판매는 CRM·그로홈 숫자로 채워져요", url: HUB + "index.html" }); }
  // 보드 지표 — 보드는 도는데([상태]만 올림 = aiboards.at) 지표가 비면 · 지표 날짜 = 올린 날(crew.html run)
  //   돌 날을 놓친 보드는 'AI 안 돎' 줄(aiask.asideInbox)이 맡음 → 같은 일로 두 번 안 알림
  //   셈 = 지표 마지막 날 뒤 ~ 마지막으로 올린 날 사이 돈 날 · 지표가 한 번도 없으면 '아직 없음'(바로)
  const boards = (D.ai && D.ai.boards) || {}, mates = (D.ai && D.ai.mates) || {};
  Object.values(BOARDS).forEach((b) => { const v = boards[b.id]; if (!v || !v.at || !isLiveBoard(b.id)) return;   // 닫힌 크루 보드는 안 봄 (2026-10-17)
    const ran = dayOf(v.at), dow = b.run && b.run.dow, hist = v.hist || {}, last = maxOf(Object.values(hist).flatMap((h) => Object.keys(h || {})).concat(Object.values(v.metrics || {}).map((x) => x && x.date)));
    if (!ran || runsBetween(ran, today, dow) >= 1) return;   // 그 뒤 돌 날을 놓침 = 'AI 안 돎'
    if (last && last >= ran) return;   // 마지막 올림에 지표 있음
    const lag = last ? runsBetween(last, addDays(ran, 1), dow) : 0, m = mateOf(b.mate) || { name: b.mate };
    if (last && lag < LAG.board) return;   // 아직 셀 만큼 안 지남
    out.push({ key: "board:" + b.id, board: b.id, mate: b.mate, label: `${m.name}(AI) ${b.title} 지표`, short: `${m.name} 지표`, last, lag, unit: "run", who: mateOwner(mates[b.mate], b.brand, D.users) || "master", bad: true,
      fix: "Aside 결과에 [지표] 숫자 줄이 있는지 · 허브 crew.html 에서 붙여 넣기", url: HUB + "crew.html#" + b.id }); });
  return out;
}

// '확인할 것' 줄 — model.todayView 가 D.feedInbox 로 부름 (순환 import 피하려고)
export function feedInbox(D, uid, now = new Date(), seen = {}) {
  if (PAUSE.on) return [];   // ⏸ 자동화 멈춤 (2026-10-21) — 자동으로 채우던 숫자가 멈춰서 '비어 있음' 줄 안 띄움 (결과 숫자 시트는 그대로)
  const me = (D.users || []).find((u) => u && u.id === uid); if (!me || !D.loaded) return [];
  const today = ymd(now), rows = feedRows(D, now), out = [], master = isMaster(me);
  if (isOffDay(today)) return [];   // 쉬는 날엔 안 알림
  const mine = rows.filter((r) => r.bad && (r.who === "master" ? master : r.who === "ads" ? master || adChecker(D, uid) : r.who === uid));
  const gen = mine.filter((r) => !r.board), bd = mine.filter((r) => r.board);
  if (gen.length) { const id = `fd:${today}:${gen.map((r) => r.key).join("+")}`;
    if (!seen[id]) out.push({ kind: "feed", tag: "결과 숫자", id, title: master ? `결과 숫자 ${gen.length}곳 비어 있음` : `${gen[0].label} 비어 있음`, whoName: "결과 숫자", at: today + "T00:00:00",
      text: gen.map((r) => `${r.short} ${lagText(r)}`).join(" · ") }); }
  bd.forEach((r) => { const id = `fb:${r.board}:${today}`; if (seen[id]) return;
    out.push({ kind: "feed", tag: "지표 비어 있음", id, mate: r.mate, title: `${r.label} ${r.last ? `${r.lag}번째 비어 있음` : "아직 없음"}`, whoName: "결과 숫자", at: today + "T00:00:00", text: `${r.fix}` }); });
  return out;
}
// 고정업무 '광고 확인' 담당 (광고 일일 보고서를 매일 보는 사람 · 2026-10-16 김민지)
export const adChecker = (D, uid) => (D.tasks || []).some((t) => t && t.isFixed && !isRemoved(t) && !t.paused && AD_FX_RE.test(String(t.title || "")) && fxIds(t).includes(uid));
