// 모여라딜 OS → 업무OS v2 최신 데이터 한 번 더 가져오기 (사용자 결정 2026-10-08 '새 것 + 업무OS에서 안 고친 것만 최신으로') — 계산만, 저장 없음
//
// 원본: Firebase moyeora-deal-manager · moyeoradeal-os/state-* (REST 로 읽기만 · 지우지 않음)
// 받는 곳: pour-os/v2/{goals · mainKPIs · subKPIs · projects · tasks · log} 만 (버전1 문서는 안 건드림)
// 옮기는 규칙(id md_ · 연결 · 사람 · 브랜드)은 버전1 moyImport.planMoyImport 를 그대로 씀 → 새 문서는 v2 에 이미 있는 md_ 문서와 같은 모양
//
// 나누기 (문서마다)
//  · 새 것: md_ id 가 v2 에 없음 → 만듦(없을 때만) + moyAt · moySeen(넣은 내용의 지문)
//      업무OS에서 중단·보류한 프로젝트에 새로 들어오는 열린 업무는 그 프로젝트처럼 접음(중단 dropPrev · 보류 holdPrev — 업무OS endProject 와 같은 칸)
//  · 같음: 비교 칸이 모두 같음 → 안 씀
//  · 최신으로: 다름 + 업무OS에서 안 고침 + 모여라딜에서 바뀐 증거 → 바뀐 칸만(조건부 · 미리 볼 때 본 값 그대로일 때만)
//  · 업무OS에서 고쳐서 그대로: 아래 '업무OS에서 고친 것' 하나라도 · 또는 다른데 모여라딜에서 바뀐 증거가 없음(버전1 때 업무OS에서 고친 것)
//  · 휴지통: 업무OS 휴지통(removed)에 있는 것 → 그대로(되살리지 않음)
//  · 모여라딜에서 없어진 것: v2 엔 있는데 원본에 없음 → 그대로(지우지도 숨기지도 않음) · 목록만
//
// '업무OS에서 고친 것' (moyEdited — 하나라도 있으면 그대로 둠)
//  ① updatedBy 가 있음(업무OS v2 의 모든 고치기가 남김 · 진척 % 다시 계산·고정업무 체크는 v2At 만 남겨서 빼고 봄)
//  ② 모여라딜이 안 만드는 칸에 값이 있음(madeIn · memoAt · ackBy · phase · estDays · scope · secret · endLog · dropPrev · ownerLog · progressManual … 업무OS(버전1·v2)에서만 생기는 칸)
//  ③ 상태 기록(statusLog)에 모여라딜에 없는 줄이 있음(업무OS에서 상태를 바꿈)
//  ④ 업무OS 댓글이 있음 · ⑤ 업무OS 기록(log targetId)이 있음(모여라딜에서 가져온 기록 빼고) · ⑥ KPI 고치기 덧칠(kpidefs)이 있음
//  ⑦ 지난번 이 가져오기가 '그대로' 로 정한 것(meta.moyImport.kept — 한 번 업무OS 것이면 계속) · ⑧ 지난번 넣은 뒤 업무OS에서 내용이 바뀜(moySeen ≠ 지금 내용)
// '모여라딜에서 바뀐 증거': moySeen 이 있으면 원본 지문 ≠ moySeen · 없으면(버전1 때 들어온 것) 2026-10-02 버전1 가져오기 뒤 모여라딜 활동 기록·상태 기록·KPI 값 기록에 그 항목이 있음
// 비교에서 빼는 칸: 진척 %(양쪽이 다시 계산) · 고정업무 사람별 체크(업무OS 가 주인) · 시각 표시(v2At · updatedAt) · 빈 값(없음 = "" = [] = {} = false = null)
import { MOY_FIREBASE, parseMoyDocs, planMoyImport } from "../../pour-os/src/moyImport.js";
import { isRemoved } from "./model.js";

export { MOY_FIREBASE, parseMoyDocs };
export const MOY_FROM = "moyeoradeal-os";
export const MOY_BASE = "2026-10-02T10:00:00.000Z";   // 버전1 '모여라딜 OS 가져오기'(코드 2026-10-02 10:15Z · 첫 업무OS 손길 11:05Z) 바로 전
export const MOY_COLS = ["goals", "mainKPIs", "subKPIs", "projects", "tasks"];
export const MOY_L = { goals: "최종 목표", mainKPIs: "메인KPI", subKPIs: "서브KPI", projects: "프로젝트", tasks: "업무" };
export const MOY_WHY = { v2: "업무OS에서 고침", status: "업무OS에서 상태 바꿈", note: "댓글 있음", log: "업무OS 기록 있음", kpi: "KPI 고치기", kept: "지난번에도 업무OS 것", seen: "지난번 넣은 뒤 업무OS에서 고침", v1: "버전1 때 업무OS에서 고친 것" };
const KIND_ORDER = Object.fromEntries(MOY_COLS.map((k, i) => [k, i]));

const IGN = new Set(["id", "_doc", "_id", "_new", "v2At", "updatedAt", "progress", "moyAt", "moySeen", "importedFrom", "removed"]);   // removed(휴지통)는 따로 봄
const IGN_TASK = new Set(["doneDates", "doneAtBy", "subDone"]);         // 고정업무 사람별 체크 — 업무OS 가 주인(다시 가져오기 stripV2Only 와 같음)
const IGN_FIX = new Set(["doneAt", "doneBy", "doneByName"]);           // 고정업무 끝냄 표시도
const ignored = (key, x, k) => IGN.has(k) || (key === "tasks" && (IGN_TASK.has(k) || (x && x.isFixed && IGN_FIX.has(k))));
export const isEmptyV = (v) => v == null || v === "" || v === false || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
const stable = (v) => JSON.stringify(v === undefined ? null : v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => ((o[kk] = x[kk]), o), {}) : x));
const same = (a, b) => stable(isEmptyV(a) ? null : a) === stable(isEmptyV(b) ? null : b);
// 비교할 내용(빈 칸·뺄 칸 없이)
export function moyContent(key, x) {
  const o = {}; Object.keys(x || {}).sort().forEach((k) => { if (!ignored(key, x, k) && !isEmptyV(x[k])) o[k] = x[k]; }); return o;
}
// 지문 (cyrb53 · 문자열) — 같은 내용이면 늘 같음
export function moyHash(key, x) {
  const s = stable(moyContent(key, x)); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "m" + (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
// 다른 칸 (원본 S 기준 · 둘 중 하나에만 있어도)
export function moyDiff(key, S, V) {
  const ks = new Set([...Object.keys(S || {}), ...Object.keys(V || {})]);
  return [...ks].filter((k) => !ignored(key, S, k) && !ignored(key, V, k) && !same(S[k], V[k])).sort();
}
const slKey = (e) => `${(e && e.status) || ""}|${(e && e.at) || ""}`;
// 업무OS에서 고친 것인지 (이유 열쇠 · 없으면 "")
export function moyEdited(key, S, V, ctx = {}) {
  if (ctx.sticky && ctx.sticky.has(V.id)) return "kept";
  if (ctx.kpiOv && ctx.kpiOv.has(V.id)) return "kpi";
  if (V.updatedBy) return "v2";
  if (Object.keys(V).some((k) => !ignored(key, V, k) && !isEmptyV(V[k]) && !(k in S))) return "v2";
  const sl = new Set((Array.isArray(S.statusLog) ? S.statusLog : []).map(slKey));
  if ((Array.isArray(V.statusLog) ? V.statusLog : []).some((e) => !sl.has(slKey(e)))) return "status";
  const nid = key === "projects" ? "proj:" + V.id : key === "tasks" ? "task:" + V.id : "";
  if (nid && ctx.noteItems && ctx.noteItems.has(nid)) return "note";
  if (ctx.logTargets && ctx.logTargets.has(V.id)) return "log";
  if (V.moySeen && moyHash(key, V) !== V.moySeen) return "seen";
  return "";
}
// 모여라딜에서 2026-10-02 버전1 가져오기 뒤에 바뀐 증거 (moySeen 없는 문서용)
const srcTouched = (S, srcId, touched, base) => touched.has(srcId)
  || (Array.isArray(S.statusLog) && S.statusLog.some((e) => e && String(e.at || "") > base))
  || (Array.isArray(S.valueHistory) && S.valueHistory.some((e) => e && String(e.at || "") > base))
  || String(S.valueAt || "") > base;
const OPEN = new Set(["todo", "inprogress", "review"]);

// 원본 + v2 지금 → 미리 보기 · 쓸 것
//  V = {users, brands, goals, mainKPIs, subKPIs, projects, tasks (v2 의 importedFrom 'moyeoradeal-os' 문서 · 휴지통 포함),
//       noteItems: Set('task:id'|'proj:id'), logTargets: Set(id — 업무OS 기록), kpiOv: Set(id), sticky: Set(id)}
//  opt = {at(지금 ISO), cu{id,name}, base(MOY_BASE)}
export function planMoySync(src, V, opt = {}) {
  const at = opt.at || new Date().toISOString(), base = opt.base || MOY_BASE, cu = opt.cu || { id: "", name: "" };
  const brand = (V.brands || []).find((b) => b && /모여라딜/.test(String(b.name || "")));
  if (!brand) return { error: "업무OS에 '모여라딜' 브랜드가 없어요 · 브랜드를 먼저 만들어 주세요" };
  const pl = planMoyImport(src, { users: V.users || [], brands: V.brands || [] }, { brandId: brand.id });   // 버전1 옮기기 규칙 그대로 (모두 '새 것'으로 계산 → 아래에서 v2 와 비교)
  const ctx = { noteItems: V.noteItems, logTargets: V.logTargets, kpiOv: V.kpiOv, sticky: V.sticky };
  const touched = new Set((src.activityLog || []).filter((e) => e && String(e.at || "") > base && e.targetId).map((e) => String(e.targetId)));
  const unmd = (id) => String(id).replace(/^md_/, "");
  const vProj = new Map((V.projects || []).map((p) => [p.id, p]));
  const add = [], upd = [], keep = [], trash = [], gone = []; let same0 = 0, folded = 0;
  const title = (x) => String((x && (x.title || x.name)) || "").trim() || (x && x.id) || "";
  MOY_COLS.forEach((key) => {
    const have = new Map((V[key] || []).filter((x) => x && x.id).map((x) => [x.id, x]));
    const mapped = pl.adds[key] || [], srcIds = new Set(mapped.map((x) => x.id));
    mapped.forEach((S) => {
      const cur = have.get(S.id);
      if (!cur) {
        let data = { ...S };
        // 업무OS에서 중단·보류한 프로젝트 → 새 열린 업무도 그 프로젝트처럼 접음 (끝낸 업무는 그대로)
        const vp = key === "tasks" && !S.isFixed && S.projectId ? vProj.get(S.projectId) : null, ps = vp && !isRemoved(vp) ? vp.status : "";
        if (vp && OPEN.has(S.status || "todo") && (ps === "dropped" || ps === "hold" || ps === "paused")) {
          const drop = ps === "dropped", s0 = S.status || "todo";
          data = { ...data, status: drop ? "dropped" : "hold", ...(drop ? { dropPrev: s0, droppedAt: at } : { holdPrev: s0, holdBy: "proj", holdReason: vp.holdReason || "", heldAt: at, heldBy: cu.id }),
            statusLog: [...(Array.isArray(S.statusLog) ? S.statusLog : []), { status: drop ? "dropped" : "hold", at, by: cu.id, byName: cu.name, proj: drop ? "dropped" : "hold" }] };
          folded++;
        }
        add.push({ key, id: S.id, title: title(S), data: { ...data, moyAt: at, moySeen: moyHash(key, S) }, fold: data.status !== S.status ? data.status : "" });
        return;
      }
      const d = moyDiff(key, S, cur);
      if (!d.length) { same0++; return; }
      const row = { key, id: S.id, title: title(cur), fields: d };
      if (isRemoved(cur)) { trash.push(row); return; }
      const why = moyEdited(key, S, cur, ctx);
      if (why) { keep.push({ ...row, why }); return; }
      const srcCh = cur.moySeen ? moyHash(key, S) !== cur.moySeen : srcTouched(S, unmd(S.id), touched, base);
      if (!srcCh) { keep.push({ ...row, why: "v1" }); return; }
      const fields = {}, expect = {}, prev = {};
      d.forEach((k) => { fields[k] = S[k] === undefined ? null : S[k]; expect[k] = cur[k] === undefined ? null : cur[k]; prev[k] = expect[k]; });
      ["v2At", "updatedBy", "removed", "moySeen"].forEach((k) => { if (!(k in expect)) expect[k] = cur[k] === undefined ? null : cur[k]; });
      prev.moyAt = cur.moyAt || null; prev.moySeen = cur.moySeen || null;
      upd.push({ ...row, title: title(S), fields: { ...fields, moyAt: at, moySeen: moyHash(key, S) }, expect, prev, changed: d });
    });
    have.forEach((x, id) => { if (String(id).startsWith("md_") && !srcIds.has(id) && !isRemoved(x)) gone.push({ key, id, title: title(x) }); });
  });
  const ord = (a, b) => KIND_ORDER[a.key] - KIND_ORDER[b.key] || String(a.title).localeCompare(String(b.title), "ko");
  [add, upd, keep, trash, gone].forEach((a) => a.sort(ord));
  // 활동 기록: 새로 넣거나 최신으로 바꾸는 것의 모여라딜 기록만 (버전1 가져오기 뒤 · 새 것은 전부) → pour-os/v2/log/md_<기록 id> (없을 때만)
  const addIds = new Set(add.map((x) => x.id)), updIds = new Set(upd.map((x) => x.id)), pOf = new Map([...(pl.adds.tasks || []).map((t) => [t.id, t.projectId || ""])]);
  const logs = (pl.logs || []).filter((e) => e && e.targetId && (addIds.has(e.targetId) || (updIds.has(e.targetId) && String(e.at || "") > base)))
    .map((e) => ({ ...e, importedFrom: MOY_FROM, projectId: e.col === "projects" ? e.targetId : pOf.get(e.targetId) || "" }));
  // 사람 · 브랜드
  const uName = (id) => ((V.users || []).find((u) => u.id === id) || {}).name || "";
  const people = (src.users || []).map((u) => ({ from: u.name || u.id, to: pl.userMap[u.id] ? uName(pl.userMap[u.id]) : "" }));
  const bName = (id) => ((V.brands || []).find((b) => b.id === id) || {}).name || id;
  const bc = {}; (pl.adds.projects || []).forEach((p) => { bc[p.brand] = (bc[p.brand] || 0) + 1; });
  const brands = Object.entries(bc).sort((a, b) => (a[0] === brand.id ? -1 : b[0] === brand.id ? 1 : b[1] - a[1])).map(([id, n]) => ({ id, name: bName(id), n }));
  const otherNew = add.filter((x) => x.key === "projects" && x.data.brand !== brand.id).map((x) => ({ title: x.title, brand: bName(x.data.brand) }));
  const cnt = (a) => Object.fromEntries(MOY_COLS.map((k) => [k, a.filter((x) => x.key === k).length]));
  const counts = { add: cnt(add), upd: cnt(upd), keep: cnt(keep), trash: trash.length, gone: gone.length, same: same0, logs: logs.length, folded,
    src: Object.fromEntries(MOY_COLS.map((k) => [k, (src[k] || []).length])) };
  return { at, brand: { id: brand.id, name: brand.name }, add, upd, keep, trash, gone, logs, people, brands, otherNew, counts,
    n: add.length + upd.length, nothing: !add.length && !upd.length };
}
// 다음번 '그대로' 목록 (한 번 업무OS 것이면 계속) — 지난 목록 + 이번 '그대로'
export const moyKeptNext = (prev, plan) => [...new Set([...(prev || []), ...plan.keep.map((x) => x.id)])].sort();

// 원본 읽기 (REST · 읽기만) — fetchFn 은 window.fetch (시험은 가짜)
export async function readMoySrc(fetchFn) {
  const { projectId, apiKey, ns } = MOY_FIREBASE; const docs = []; let tok = "";
  for (let i = 0; i < 20; i++) {
    const r = await fetchFn(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${ns}?pageSize=300&key=${apiKey}${tok ? "&pageToken=" + encodeURIComponent(tok) : ""}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.error && j.error.message) || "HTTP " + r.status);
    docs.push(...((j && j.documents) || [])); tok = (j && j.nextPageToken) || ""; if (!tok) break;
  }
  const src = parseMoyDocs({ documents: docs });
  console.log("[모여라딜 가져오기] 원본", Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.length])));
  if (!(src.tasks || []).length && !(src.projects || []).length) throw new Error("원본에서 업무·프로젝트를 찾지 못했어요");
  return src;
}
