// 업무OS v2 화면 시험용 가짜 저장 장치 — src/fb.js 와 같은 이름의 함수들을 메모리로 (실제 Firestore·Storage 에 절대 안 씀)
//   빌드: npx vite build --config test/vite.test.config.js (src/fb.js → 이 파일로 바꿔 끼움)
//   데이터: window.__V2 = { v2: {키: {id: 문서}}, meta: {...}, writes: [] } · 버전1 읽기 = window.__V1_DATA · __V1_DOCS · __V1_LAUNCH
//   시험 도구: window.__OTHER(키, id, 칸) = '다른 사람이 지금 바꿈' · window.__V2.writes = 쓴 기록 · window.__FETCH_FAIL(정규식) · __UP_MS · __UP_FAIL
import { guardWrite } from "../src/viewonly.js";   // 보기 모드 쓰기 잠금 — 진짜 저장 장치와 같은 자리에서 막음
const W = typeof window !== "undefined" ? window : globalThis;
const ST = () => { if (!W.__V2) W.__V2 = { v2: {}, meta: null, writes: [] }; if (!W.__V2.v2) W.__V2.v2 = {}; if (!W.__V2.writes) W.__V2.writes = []; return W.__V2; };
const col = (key) => { const s = ST(); if (!s.v2[key]) s.v2[key] = {}; return s.v2[key]; };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const save = () => { try { sessionStorage.__V2 = JSON.stringify(ST()); } catch (_) {} };

// 특수 값 (core.jsx plainV 가 __au·__ar·__del 로 알아봄)
export const arrayUnion = (...v) => ({ __au: v });
export const arrayRemove = (...v) => ({ __ar: v });
export const deleteField = () => ({ __del: true });
export const increment = (n) => ({ __inc: n });
const isSp = (v) => v && typeof v === "object" && !Array.isArray(v) && (v.__au || v.__ar || v.__del || v.__inc !== undefined);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function applyV(cur, v) {
  if (v && v.__au) { const a = Array.isArray(cur) ? cur.slice() : []; v.__au.forEach((x) => { if (!a.some((y) => same(y, x))) a.push(clone(x)); }); return a; }
  if (v && v.__ar) { return (Array.isArray(cur) ? cur : []).filter((y) => !v.__ar.some((x) => same(x, y))); }
  if (v && v.__inc !== undefined) return (Number(cur) || 0) + v.__inc;
  return clone(v);
}
function setPath(doc, path, v) {
  const ks = String(path).split("."); let o = doc;
  for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== "object") o[ks[i]] = {}; o = o[ks[i]]; }
  const k = ks[ks.length - 1]; if (v && v.__del) delete o[k]; else o[k] = applyV(o[k], v);
}
// set 할 때(점 경로 아님): 맵 안의 특수 값도 풀어서
function deep(v) { if (isSp(v)) return v.__del ? undefined : applyV(undefined, v); if (v && typeof v === "object" && !Array.isArray(v)) { const o = {}; Object.entries(v).forEach(([k, x]) => { const y = deep(x); if (y !== undefined) o[k] = y; }); return o; } return clone(v); }
function mergeDeep(cur, v) { const o = { ...(cur || {}) }; Object.entries(v || {}).forEach(([k, x]) => { if (x && x.__del) delete o[k]; else if (isSp(x)) o[k] = applyV(o[k], x); else if (x && typeof x === "object" && !Array.isArray(x)) o[k] = mergeDeep(o[k] && typeof o[k] === "object" ? o[k] : {}, x); else o[k] = clone(x); }); return o; }

// 진짜 Firestore 처럼 배열 안 배열은 거절 (2026-10-16 · 반복 실행 덧칠 기록 hist 의 [이전 목록, 이후 목록]이 실제로는 저장 실패였는데 가짜 저장 장치가 받아 줘서 시험이 못 잡았음)
function noNest(v, where, inArr) {
  if (Array.isArray(v)) { if (inArr) throw new Error(`시험: Nested arrays are not supported (${where})`); v.forEach((x) => noNest(x, where, true)); return; }
  if (v && typeof v === "object") { if (v.__au || v.__ar) { (v.__au || v.__ar).forEach((x) => noNest(x, where, true)); return; } Object.values(v).forEach((x) => noNest(x, where, false)); }
}
const valAt = (d, p) => String(p).split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
const stable = (v) => JSON.stringify(v === undefined ? null : v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => ((o[kk] = x[kk]), o), {}) : x));
export const sameVal = (a, b) => stable(a) === stable(b);
const fits = (cur, expect) => !!cur && Object.keys(expect || {}).every((k) => sameVal(valAt(cur, k), expect[k]));

function match(d, w) {
  if (!w) return true;
  const cs = Array.isArray(w[0]) ? w : [w];
  return cs.every(([f, op, v]) => { const x = valAt(d, f);
    if (op === "==") return sameVal(x, v); if (op === "in") return (v || []).some((y) => sameVal(x, y)); if (op === "array-contains") return Array.isArray(x) && x.some((y) => sameVal(y, v));
    if (x == null) return false; if (op === ">=") return x >= v; if (op === "<=") return x <= v; if (op === ">") return x > v; if (op === "<") return x < v; return false; });
}
const items = (key, w) => Object.entries(col(key)).map(([id, d]) => ({ ...clone(d), id: (d && d.id) || id, _doc: id })).filter((d) => match(d, w));

// 구독
const subs = new Set();
const notify = () => { save(); subs.forEach((s) => { const x = s.one != null ? oneOf(s.key, s.one) : items(s.key, s.w); const sig = JSON.stringify(x); if (sig !== s.last) { s.last = sig; s.cb(x, false); } }); };
let pend = false; const kick = () => { if (pend) return; pend = true; setTimeout(() => { pend = false; notify(); }, 0); };
const oneOf = (key, id) => { const d = col(key)[id]; return d ? { ...clone(d), id: d.id || id } : null; };
// 문서 하나 (읽음 표시 seen/{나}) · window.__LISTEN_FAIL(정규식) = 구독 실패 시험
export function listenOne(key, id, cb, onErr) { const f = W.__LISTEN_FAIL; if (f && f.test(key)) { setTimeout(() => onErr && onErr(new Error("시험: 구독 실패 " + key)), 0); return () => {}; }
  const s = { key, one: String(id), cb, last: null }; subs.add(s); setTimeout(() => { if (!subs.has(s)) return; const x = oneOf(key, s.one); s.last = JSON.stringify(x); cb(x, false); }, 0); return () => subs.delete(s); }
export function listen(key, w, cb) { const s = { key, w, cb, last: null }; subs.add(s); setTimeout(() => { if (!subs.has(s)) return; const x = items(key, w); s.last = JSON.stringify(x); cb(x, false); }, 0); return () => subs.delete(s); }
const rec = (op, key, id, data) => { ST().writes.push({ op, key, id, data: clone(data), at: Date.now() }); };

export async function getOne(key, id) { const d = col(key)[id]; return d ? { ...clone(d), id: d.id || id } : null; }
export async function fetchWhere(key, w) { const f = W.__FETCH_FAIL; if (f && f.test(key)) { W.__FETCH_FAIL = null; throw new Error("시험: 읽기 실패 " + key); } (ST().fetches = ST().fetches || []).push({ key, w }); return items(key, w); }
export async function getMeta() { return clone(ST().meta); }
export async function setMeta(data) { guardWrite(); noNest(data, "meta"); ST().meta = mergeDeep(ST().meta, data); save(); }
export async function put(key, id, data) { guardWrite(); noNest(data, `${key}/${id}`); col(key)[id] = deep(data); rec("put", key, id, data); kick(); }
export async function merge(key, id, data) { guardWrite(); noNest(data, `${key}/${id}`); col(key)[id] = mergeDeep(col(key)[id], data); rec("merge", key, id, data); kick(); }
export async function patch(key, id, fields) { guardWrite(); noNest(fields, `${key}/${id}`); const d = col(key)[id]; if (!d) throw new Error(`시험: 없는 문서 ${key}/${id}`); Object.entries(fields).forEach(([k, v]) => setPath(d, k, v)); rec("patch", key, id, fields); kick(); }
export async function putMany(ops, onProgress, opt) { guardWrite(); ops.forEach((o) => noNest(o.data, `${o.key}/${o.id}`)); ops.forEach((o) => { col(o.key)[o.id] = opt && opt.merge ? mergeDeep(col(o.key)[o.id], o.data) : deep(o.data); rec("put", o.key, o.id, o.data); }); onProgress && onProgress(ops.length, ops.length); kick(); }
export async function patchMany(ops, onProgress) { guardWrite(); for (const o of ops) await patch(o.key, o.id, o.fields); onProgress && onProgress(ops.length, ops.length); }
export async function patchIf(key, id, expect, fields) { guardWrite(); const d = col(key)[id] || null; if (!fits(d, expect)) return { ok: false, cur: clone(d) }; await patch(key, id, fields); return { ok: true, cur: clone(d) }; }
export async function patchManyIf(ops) { guardWrite(); let done = 0; const skipped = []; for (const o of ops) { const d = col(o.key)[o.id]; if (fits(d, o.expect)) { await patch(o.key, o.id, o.fields); done++; } else skipped.push(o.id); } return { done, skipped }; }
export async function createMissing(ops) { guardWrite(); ops.forEach((o) => noNest(o.data, `${o.key}/${o.id}`)); let made = 0, skipped = 0; ops.forEach((o) => { if (col(o.key)[o.id]) skipped++; else { col(o.key)[o.id] = deep(o.data); rec("put", o.key, o.id, o.data); made++; } }); kick(); return { made, skipped }; }
export async function txDoc(key, id, fn) { guardWrite(); const cur = col(key)[id] ? clone(col(key)[id]) : null, out = fn(cur) || {};
  if (out.write) { if (cur) await patch(key, id, out.write); else await put(key, id, { id, ...out.write }); } return out.ret ?? null; }
export async function txDocs(docs, fn) { guardWrite(); const curs = docs.map((d) => (col(d.key)[d.id] ? clone(col(d.key)[d.id]) : null)), out = fn(curs) || {};
  for (let i = 0; i < (out.writes || []).length; i++) { const w = out.writes[i]; if (!w) continue; if (curs[i]) await patch(docs[i].key, docs[i].id, w); else await put(docs[i].key, docs[i].id, { id: docs[i].id, ...w }); } return out.ret ?? null; }

// 버전1 읽기 (읽기만)
export async function readV1State() { return clone(W.__V1_DATA || {}); }
export async function readV1Launch() { return clone(W.__V1_LAUNCH || []); }
export async function getHubNumbers() { if (W.__HUB_FAIL) throw new Error("시험: 허브 숫자 못 읽음"); return clone(W.__HUB_NUMBERS || { counts: {}, at: "" }); }   // 결과 숫자 (2026-10-17)
export function listenV1Doc(id, cb) { setTimeout(() => cb(clone((W.__V1_DOCS || {})[id] || null)), 0); return () => {}; }
export async function readV1Notes() { return clone(W.__V1_NOTES || []); }
export function listenLaunch(cb) { setTimeout(() => { const a = clone(W.__V1_LAUNCH || []); a.structure = null; cb(a, false); }, 0); return () => {}; }
export async function readLaunchProduct(id) { return clone((W.__V1_LAUNCH || []).find((x) => x.id === id) || null); }
export async function patchLaunchIf(ops) { guardWrite(); return { done: 0, skipped: ops.map((o) => o.id) }; }
export async function backupLaunch() { guardWrite(); return true; }
// 파일 (가짜 주소 · 진행 4단계)
export async function upload(target, file, onProg) { guardWrite();
  const f = W.__UP_FAIL; if (f && f.test(String(file && file.name))) { if (W.__UP_FAIL_ONCE) W.__UP_FAIL = null; throw new Error("시험: 올리기 실패"); }
  for (let i = 1; i <= 4; i++) { await new Promise((r) => setTimeout(r, (W.__UP_MS || 40) / 4)); onProg && onProg(i / 4); }
  return { name: file.name || "file", url: "https://example.test/" + encodeURIComponent(file.name || "file"), path: `task-attachments/v2/${target}/${Date.now()}_${file.name || "file"}`, size: file.size || 0, type: file.type || "", uploadedAt: new Date().toISOString() };
}
export const NO_NET = true;
// 다른 사람이 지금 바꿈 (겹침 시험)
// 다른 기기가 지금 씀 (합치기 쓰기 · 읽음 표시 폰·PC 시험) — 문서가 없으면 만듦
W.__MERGE = (key, id, data) => { col(key)[id] = mergeDeep(col(key)[id], data); kick(); return true; };
W.__OTHER = (key, id, fields) => { const d = col(key)[id]; if (!d) return false; Object.entries(fields).forEach(([k, v]) => setPath(d, k, v)); kick(); return true; };
W.__FB_FAKE = true;

// 구매 품의 요청 (pour-os/approval-requests/items · 진짜는 v2 밖) — 가짜는 window.__V2.appr = {id: 문서} · 쓴 기록 key "approval-requests"
const AK = "approval-requests";
const apprCol = () => { const s = ST(); if (!s.appr) s.appr = {}; return s.appr; };
const apprItems = (w) => Object.entries(apprCol()).map(([id, d]) => ({ ...clone(d), id: (d && d.id) || id, _doc: id })).filter((d) => match(d, w));
const apprSubs = new Set();
export function listenAppr(w, cb) { const s = { key: AK, w, cb, last: null, appr: true }; apprSubs.add(s); setTimeout(() => { if (!apprSubs.has(s)) return; const x = apprItems(w); s.last = JSON.stringify(x); cb(x); }, 0); return () => apprSubs.delete(s); }
const apprKick = () => setTimeout(() => { save(); apprSubs.forEach((s) => { const x = apprItems(s.w), sig = JSON.stringify(x); if (sig !== s.last) { s.last = sig; s.cb(x); } }); }, 0);
export async function fetchAppr(w) { return apprItems(w); }
export async function addAppr(data) { guardWrite(); noNest(data, AK); const id = "aq" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); apprCol()[id] = deep(data); rec("put", AK, id, data); apprKick(); return id; }
export async function patchApprIf(id, expect, fields) { guardWrite(); noNest(fields, `${AK}/${id}`); const d = apprCol()[id] || null; if (!fits(d, expect)) return { ok: false, cur: clone(d) };
  Object.entries(fields).forEach(([k, v]) => setPath(d, k, v)); rec("patch", AK, id, fields); apprKick(); return { ok: true, cur: clone(d) }; }
// 시험 도구: 독립 화면(approval-requests.html)에서 누가 지금 새 요청을 올림 · 고침
W.__APPR = (id, data) => { apprCol()[id] = { ...(apprCol()[id] || {}), ...clone(data) }; apprKick(); };
