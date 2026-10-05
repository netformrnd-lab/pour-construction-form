// 그로홈 매출 → 업무OS (② KPI · 사용자 결정 2026-10-05 '매출은 원래 있던 곳 하나 · 양쪽에서 같은 값')
// 그로홈 대시보드(grohome-dashboard salesRecords)를 읽기만 해서 브랜드·월·채널 합계로 → pour-os/v2/kpisales/grohome {rows, at, n}
//  · 버전1 업무OS 와 같은 방법(REST · 날짜·채널·금액 칸만) · 그로홈 대시보드에는 쓰지 않음
//  · 3시간에 한 번, 마스터 기기에서만 (팀원은 저장된 합계만 읽음) · 바뀐 게 없으면 안 씀
import * as fb from "./fb.js";
import { ghSalesRows } from "./kpi2.js";

const GH = { projectId: "grohome-dashboard", apiKey: "AIzaSyBp6S2Fln8cCXBHKpREfguRfLkL2oEYZ3k" };   // 그로홈 대시보드 웹 설정(공개 키 · 버전1과 같음)
export const GH_EVERY = 3 * 60 * 60 * 1000;
const num = (f) => Number((f || {}).integerValue || (f || {}).doubleValue || (f || {}).stringValue || 0);

export async function readGhRecords() {
  if (typeof window !== "undefined" && window.__GH_RECORDS) return window.__GH_RECORDS;   // 시험용
  const all = []; let tok = "";
  for (let i = 0; i < 80; i++) {
    const u = `https://firestore.googleapis.com/v1/projects/${GH.projectId}/databases/(default)/documents/salesRecords?pageSize=300&mask.fieldPaths=date&mask.fieldPaths=platform&mask.fieldPaths=totalPrice&key=${GH.apiKey}${tok ? "&pageToken=" + encodeURIComponent(tok) : ""}`;
    const r = await fetch(u); const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
    (j.documents || []).forEach((d) => { const f = d.fields || {}; all.push({ date: (f.date || {}).stringValue || "", platform: (f.platform || {}).stringValue || "", totalPrice: num(f.totalPrice) }); });
    tok = j.nextPageToken || ""; if (!tok) break;
  }
  return all;
}
// 오래됐으면 새로 읽어 저장 → 저장했으면 true
export async function refreshGhSales(cur, byName) {
  const recs = await readGhRecords(), rows = ghSalesRows(recs);
  console.log(`[그로홈 매출] 대시보드 ${recs.length}건 → 합계 ${rows.length}줄`);
  if (!recs.length && cur && (cur.rows || []).length) { console.warn("[그로홈 매출] 0건이라 예전 합계 그대로 둠"); return false; }
  const at = new Date().toISOString();
  if (cur && fb.sameVal(cur.rows || [], rows)) { await fb.merge("kpisales", "grohome", { checkedAt: at }); return false; }
  await fb.put("kpisales", "grohome", { id: "grohome", brand: "grohome", src: "grohome-dashboard", rows, n: recs.length, at, checkedAt: at, by: byName || "" });
  return true;
}
