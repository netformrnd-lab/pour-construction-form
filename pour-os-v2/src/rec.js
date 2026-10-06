// 업무OS v2 — 하루 기록 DB (반복 실행 · 고정업무 3단계 · 사용자 확정 2026-10-06 · 계산만, 저장은 core)
// pour-os/v2/checks (한 컬렉션 · 같음 조건으로만 읽음: itemId+ym · ym · date · kind)
//   · 고정업무·정한 날 체크: `${taskId}~${uid}~${date}` {kind:'fx', taskId, itemId, uid, name, date, ym, wk, brand, scope, on, at, subs?, qty, recs[]}
//   · 횟수 목표(행동지표):   `ak~${akId}~${uid}~${date}` {kind:'ak', akId, itemId, uid, name, date, ym, wk, brand, runs, qty, recs[]}
//   · 횟수 목표 체크리스트 진행 중: `ak~${akId}~${uid}~open` {kind:'akopen', akId, uid, subs:{subId: ISO}, since} — 한 바퀴 = 1회 · 날이 바뀌어도 이어짐 · 다 켜면 +1 하고 비움
//   recs: [{at, by, byName, d}]   (건수 더하기) · [{at, by, byName, set, prev}] (고치기) · [{at, by, byName, run}] (+1 · 취소 −1)
import { weekStart } from "./model.js";

export const dayIdFx = (taskId, uid, date) => `${taskId}~${uid}~${date}`;
export const dayIdAk = (akId, uid, date) => `ak~${akId}~${uid}~${date}`;
export const openIdAk = (akId, uid) => `ak~${akId}~${uid}~open`;
export const QTY_UNITS = ["건", "명", "개", "회"];
// 건수 칸 설정 (고정업무 t.qty · 횟수 목표 덧칠 fields.qty) — 단위가 없으면 꺼진 것
export const qtyCfg = (x) => (x && x.qty && x.qty.unit ? { label: String(x.qty.label || "").trim() || "건수", unit: x.qty.unit } : null);
// 사용자 결정 3: 목표 단위가 '건·명·개'면 넣은 건수가 목표에도 더해짐 · '회'면 [+1] = 1회, 건수는 날짜별 기록만 · '%'·실패 기준은 예전 그대로(건수 안 더함)
export const qtyToGoal = (it) => !!it && !it.perFail && it.unit !== "%" && ["건", "명", "개"].includes(it.unit);
// 기록 한 줄에 붙는 이름: '처리한 문의' → '문의' (짧게 · 마지막 낱말)
export const qtyShort = (cfg) => { const l = String((cfg && cfg.label) || "건수").trim(); const w = l.split(/\s+/); return w[w.length - 1] || l; };
export const qtyText = (cfg, n) => `${qtyShort(cfg)} ${n || 0}${(cfg && cfg.unit) || "건"}`;
// 숫자 칸 읽기 (쉼표·공백 허용 · 음수·소수 안 됨) → 정수 | null
export const qtyNum = (v) => { const s = String(v == null ? "" : v).replace(/[,\s]/g, ""); if (!/^\d+$/.test(s)) return null; const n = +s; return Number.isFinite(n) ? n : null; };
export const QTY_BIG = 1000;   // 이 이상이면 '맞아요?' 한 번

// 그날 문서 바탕 칸 (처음 만들 때 · merge 때 같이)
export function dayBase(kind, x, cu, date, extra) {
  const base = { kind, uid: cu.id, name: cu.name, date, ym: date.slice(0, 7), wk: weekStart(date) };
  if (kind === "ak") return { ...base, akId: x.id, itemId: x.id, brand: x.brand || "", ...(extra || {}) };
  return { ...base, taskId: x.id, itemId: x.id, brand: x.brand || "", scope: x.scope || (x.brand ? "brand" : "unset"), ...(extra || {}) };
}
// 그날 문서에 더하기 (transaction 안) — runs·qty 더함 · 기록 한 줄 · 없으면 통째로 만듦
export function dayAdd(cur, base, add, cu, at) {
  const runs = Math.max(0, (+(cur && cur.runs) || 0) + (+add.runs || 0)), qty = Math.max(0, (+(cur && cur.qty) || 0) + (+add.qty || 0));
  const rec = { at, by: cu.id, byName: cu.name, ...(add.runs ? { run: add.runs } : {}), ...(add.qty ? { d: add.qty } : {}), ...(add.via ? { via: add.via } : {}) };
  const recs = [...(((cur && cur.recs) || [])), rec].slice(-200);
  return cur ? { runs, qty, recs, at } : { ...base, runs, qty, recs, at };
}
// 그날 건수 고치기 (transaction 안) — 이전 값은 기록에
export function dayFix(cur, base, n, cu, at) {
  const prev = +(cur && cur.qty) || 0, rec = { at, by: cu.id, byName: cu.name, set: n, prev };
  const recs = [...(((cur && cur.recs) || [])), rec].slice(-200);
  return { write: cur ? { qty: n, recs, at } : { ...base, runs: 0, qty: n, recs, at }, delta: n - prev, prev };
}
// 체크리스트 한 바퀴 (횟수 목표) — 칩 하나 켜고/끄기 → {subs, complete}
//   다 켜면 complete(= +1 한 번) 이고 subs 를 비움(다음 바퀴는 빈 칩) · 목록에 없는 항목 기록은 셈에서 빼고 그대로 둠
export function roundTap(cur, list, subId, at) {
  const subs = { ...(((cur && cur.subs) || {})) };
  if (subs[subId]) delete subs[subId]; else subs[subId] = at;
  const ids = (list || []).map((x) => x.id), complete = ids.length > 0 && ids.every((id) => subs[id]);
  return { subs: complete ? {} : subs, complete, since: complete ? null : (cur && cur.since) || at };
}
export const roundOn = (cur, list) => (list || []).filter((x) => cur && cur.subs && cur.subs[x.id]).length;

// 날짜별 기록 줄 (시트 ④ · 관리자 기록 표) — docs = checks 문서들(같은 항목) → [{date, uid, name, runs, qty, on, at, n}] 최근 순
export function recRows(docs, days) {
  const keep = new Set(days || []);
  return (docs || []).filter((d) => d && d.date && (d.kind === "ak" || d.kind === "fx" || !d.kind) && (!days || keep.has(d.date)) && (d.on || +d.runs > 0 || +d.qty > 0 || (d.recs || []).length))
    .map((d) => ({ id: d.id || d._doc, date: d.date, uid: d.uid, name: d.name, runs: +d.runs || 0, qty: +d.qty || 0, on: !!d.on, at: d.at || "" }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}
// 날짜 × 사람 표 (관리자 [기록 보기 ›]) — docs(그 달) → {days:[date], people:[{uid,name}], cell(date,uid) → {runs, qty, on}}
export function recTable(docs, ym) {
  const m = {}, ppl = new Map(), dset = new Set();
  (docs || []).filter((d) => d && d.ym === ym && d.date && d.kind !== "akopen").forEach((d) => { if (!(d.on || +d.runs > 0 || +d.qty > 0)) return;
    const k = d.date + "|" + d.uid, c = (m[k] = m[k] || { runs: 0, qty: 0, on: 0 }); c.runs += +d.runs || 0; c.qty += +d.qty || 0; c.on += d.on ? 1 : 0;
    ppl.set(d.uid, d.name || d.uid); dset.add(d.date); });
  return { days: [...dset].sort(), people: [...ppl.entries()].map(([uid, name]) => ({ uid, name })).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko")), cell: (date, uid) => m[date + "|" + uid] || null };
}
// CSV (관리자 기록 표 내려받기) — 한 줄 = 그날 · 사람 · 항목
export function recCsv(docs, itemName) {
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = (docs || []).filter((d) => d && d.date && d.kind !== "akopen" && (d.on || +d.runs > 0 || +d.qty > 0)).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  return "﻿" + [["날짜", "사람", "항목", "종류", "체크·회", "건수"].map(q).join(","), ...rows.map((d) => [d.date, d.name || d.uid, itemName(d), d.kind === "ak" ? "횟수 목표" : "정한 날 체크", d.kind === "ak" ? (+d.runs || 0) : d.on ? "✓" : "", +d.qty || 0].map(q).join(","))].join("\n");
}
// 사람·항목별 오늘 건수 합 (관리자 '오늘 체크' 줄 · 오늘 화면 줄 꼬리) — docs = 오늘 문서들
export const qtySum = (docs, itemId, uid) => (docs || []).filter((d) => d && d.itemId === itemId && (!uid || d.uid === uid) && d.kind !== "akopen").reduce((a, d) => a + (+d.qty || 0), 0);
// 횟수 목표 체크리스트: 내 목록(덧칠 subsBy.<나>)이 있으면 그것 · 없으면 공통(subs)
export const akSubsOf = (it, uid) => (((it && it.subsBy && uid && Array.isArray(it.subsBy[uid]) && it.subsBy[uid].length ? it.subsBy[uid] : it && it.subs) || [])).filter((x) => x && x.id && x.title);
