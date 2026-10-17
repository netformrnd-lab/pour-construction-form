// 그로홈 매출 → 업무OS (② KPI · 사용자 결정 2026-10-05 '매출은 원래 있던 곳 하나 · 양쪽에서 같은 값')
// 그로홈 대시보드 매출(pour-app-new 의 pour-os/grohome/salesRecords)을 읽기만 해서 브랜드·월·채널 합계로 → pour-os/v2/kpisales/grohome {rows, at, n}
//  · 2026-10-07 그로홈 데이터 이사: grohome-dashboard 프로젝트(무료 요금제 하루 읽기 한도) → pour-app-new pour-os/grohome (원본은 지우지 않음)
//  · 버전1 업무OS 와 같은 방법(REST · 날짜·채널·금액 칸만) · 그로홈 대시보드에는 쓰지 않음
//  · 3시간에 한 번, 마스터 기기에서만 (팀원은 저장된 합계만 읽음) · 바뀐 게 없으면 안 씀
//  · ③ 결과 숫자 (2026-10-17): 같은 읽기로 최근 35일 날짜·채널·상품별 판매 → pour-os/v2/salesdays/grohome (salesdays.js · 허브·'05 오늘 숫자'가 읽음)
//    kpisales/grohome 에 daysTo(판매가 있는 마지막 날)·daysHash(지문 · 같으면 큰 문서 안 씀)·daysAt
import * as fb from "./fb.js";
import { ghSalesRows } from "./kpi2.js";
import { rollDays, hashOf } from "./salesdays.js";
import { ymd } from "./model.js";

const GH = { projectId: "pour-app-new", apiKey: "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU", root: "pour-os/grohome" };   // 그로홈 데이터 자리(공개 키 · 버전1과 같음)
export const GH_EVERY = 3 * 60 * 60 * 1000;
const num = (f) => Number((f || {}).integerValue || (f || {}).doubleValue || (f || {}).stringValue || 0);

export async function readGhRecords() {
  if (typeof window !== "undefined" && window.__GH_RECORDS) return window.__GH_RECORDS;   // 시험용
  if (fb.NO_NET) throw new Error("가짜 저장 장치(시험) — 밖으로 안 읽음");
  const all = []; let tok = "";
  for (let i = 0; i < 80; i++) {
    const u = `https://firestore.googleapis.com/v1/projects/${GH.projectId}/databases/(default)/documents/${GH.root}/salesRecords?pageSize=300&mask.fieldPaths=date&mask.fieldPaths=platform&mask.fieldPaths=totalPrice&mask.fieldPaths=productName&mask.fieldPaths=quantity&key=${GH.apiKey}${tok ? "&pageToken=" + encodeURIComponent(tok) : ""}`;
    const r = await fetch(u); const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
    (j.documents || []).forEach((d) => { const f = d.fields || {}; all.push({ date: (f.date || {}).stringValue || "", platform: String((f.platform || {}).stringValue || "").replace(/\s+/g, " ").trim(), totalPrice: num(f.totalPrice), productName: (f.productName || {}).stringValue || "", quantity: num(f.quantity) }); });
    tok = j.nextPageToken || ""; if (!tok) break;
  }
  if (tok) throw new Error(`그로홈 매출이 ${all.length}건을 넘어 다 못 읽음 — 합계 저장 안 함`);   // 덜 읽은 합계로 덮지 않게
  return all;
}
// 오래됐으면 새로 읽어 저장 → 저장했으면 true
// 그로홈 판매 → 날짜·채널·상품 (계산만 · 시험 salesdays.test.mjs)
export const ghDays = (recs, today) => rollDays((recs || []).map((x) => ({ date: x.date, c: x.platform, p: x.productName, q: x.quantity, r: x.totalPrice })), today);
export async function refreshGhSales(cur, byName) {
  const recs = await readGhRecords(), rows = ghSalesRows(recs);
  console.log(`[그로홈 매출] 대시보드 ${recs.length}건 → 합계 ${rows.length}줄`);
  if (!recs.length) { console.warn("[그로홈 매출] 0건이라 예전 합계 그대로 둠"); return false; }
  const at = new Date().toISOString(), dd = ghDays(recs, ymd(new Date())), daysHash = hashOf(dd.days);
  let dayF = { daysTo: dd.to, daysHash, daysAt: at };
  // 날짜별 판매 (③) — 지문이 바뀐 때만 큰 문서를 씀 · 못 쓰면 예전 표시 그대로(다음에 다시) · 월 합계는 그대로 이어감
  if (!cur || cur.daysHash !== daysHash) {
    try { await fb.put("salesdays", "grohome", { id: "grohome", brand: "grohome", src: "grohome-dashboard", ...dd, at, by: byName || "" }); console.log(`[그로홈 판매] ${dd.from}~${dd.to} · ${dd.n}줄 → salesdays/grohome`); }
    catch (e) { console.error("[그로홈 판매] 날짜별 저장 실패:", e); dayF = { daysTo: (cur && cur.daysTo) || "", daysHash: (cur && cur.daysHash) || "", daysAt: (cur && cur.daysAt) || "" }; }
  }
  if (cur && fb.sameVal(cur.rows || [], rows)) { await fb.merge("kpisales", "grohome", { checkedAt: at, ...dayF }); return false; }
  await fb.put("kpisales", "grohome", { id: "grohome", brand: "grohome", src: "grohome-dashboard", rows, n: recs.length, at, checkedAt: at, by: byName || "", ...dayF });
  return true;
}
