// 업무OS v2 — 저장 장치 (Firebase pour-app-new)
//
// 쓰기는 오직 pour-os/v2/** 와 Storage task-attachments/v2/** 에만 한다. (v1 데이터 보호)
// 예외(사용자 결정 2026-10 · 신제품 대시보드 양쪽 쓰기): 신제품 대시보드 pour-os/launch-board/products/* 의 단계 칸만 조건부로 (patchLaunchIf) — 지우지 않음, 쓰기 전 백업
// v1 문서(pour-os/state-*, pour-os/ak-notes/c)는 '버전1에서 가져오기' 때 읽기만 한다.
// 보안규칙: 기존 pour-os/{doc=**} · task-attachments/** 허용 범위 안 → 규칙 변경 없음.
import { initializeApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore,
  doc, collection, query, where, onSnapshot, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, writeBatch, arrayUnion, arrayRemove, deleteField, runTransaction,
} from "firebase/firestore";
import { getStorage, ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";

const app = initializeApp({
  apiKey: "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU",
  authDomain: "pour-app-new.firebaseapp.com",
  projectId: "pour-app-new",
  storageBucket: "pour-app-new.firebasestorage.app",
  messagingSenderId: "411031141847",
  appId: "1:411031141847:web:e658174fd4b9652cdadf92",
});
// 기기 저장(다시 열 때 바뀐 것만 받아 빠르고 읽기 비용도 적게). 안 되는 브라우저면 기본으로.
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { console.warn("[v2] 기기 저장 사용 불가 — 기본 모드:", e.message); db = getFirestore(app); }
const storage = getStorage(app);

const ROOT = ["pour-os", "v2"];
const v2col = (key) => collection(db, ...ROOT, key);
const v2doc = (key, id) => doc(db, ...ROOT, key, String(id));
const META = doc(db, ...ROOT);

const toItems = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id, _doc: d.id }));

// 실시간 구독 — w: null 이면 전체, [칸, 연산, 값] 이면 조건 (orderBy 안 씀 · 정렬은 화면에서)
export function listen(key, w, cb, onErr) {
  const q = w ? query(v2col(key), where(w[0], w[1], w[2])) : v2col(key);
  return onSnapshot(q, (snap) => { const items = toItems(snap); console.log(`[v2 ${key}${w ? " " + w.join(" ") : ""}] ${items.length}건${snap.metadata.fromCache ? " (기기 저장)" : ""}`); cb(items, snap.metadata.fromCache); },
    (e) => { console.error(`[v2 ${key}] 구독 실패:`, e); onErr && onErr(e); });
}
export async function fetchWhere(key, w) {
  const snap = await getDocs(w ? query(v2col(key), where(w[0], w[1], w[2])) : v2col(key));
  const items = toItems(snap); console.log(`[v2 ${key} ${w ? w.join(" ") : "전체"}] ${items.length}건`); return items;
}
// 복사 정보 — 서버에서 직접 확인(기기 저장의 빈 값으로 판단하지 않음)
export async function getMeta() { const s = await getDocFromServer(META); return s.exists() ? s.data() : null; }
export async function setMeta(data) { await setDoc(META, data, { merge: true }); }
// 새 문서(통째로) · 바뀐 칸만(점 경로 "doneDates.songhee")
export async function put(key, id, data) { await setDoc(v2doc(key, id), data); }
// 문서가 없어도 되는 합치기 쓰기 — 맵 안 칸 하나만 넣고 뺄 때 (예: 회사 쉬는 날 days.날짜). 다른 사람이 넣은 칸은 그대로
export async function merge(key, id, data) { await setDoc(v2doc(key, id), data, { merge: true }); }
export async function patch(key, id, fields) { await updateDoc(v2doc(key, id), fields); }
// 여러 건 한 번에 (400건씩 나눔)
export async function putMany(ops, onProgress, opt) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db); ops.slice(i, i + 400).forEach((o) => (opt && opt.merge ? b.set(v2doc(o.key, o.id), o.data, { merge: true }) : b.set(v2doc(o.key, o.id), o.data)));
    await b.commit(); onProgress && onProgress(Math.min(ops.length, i + 400), ops.length);
  }
}
// 여러 건의 바뀐 칸만 한 번에 (400건씩) — [{key, id, fields}]
export async function patchMany(ops, onProgress) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db); ops.slice(i, i + 400).forEach((o) => b.update(v2doc(o.key, o.id), o.fields));
    await b.commit(); onProgress && onProgress(Math.min(ops.length, i + 400), ops.length);
  }
}
// v1 읽기 전용
export async function readV1State() {
  const snap = await getDocs(collection(db, "pour-os"));
  const out = {};
  snap.docs.forEach((d) => { if (!d.id.startsWith("state-")) return; const x = d.data(); if (Array.isArray(x.items)) out[d.id.slice(6)] = x.items; });
  console.log(`[v1 읽기] ${Object.keys(out).length}개 칸`);
  return out;
}
export async function readV1Launch() { const snap = await getDocs(collection(db, "pour-os", "launch-board", "products")); console.log(`[v1 신제품 읽기] ${snap.size}건`); return snap.docs.map((d) => ({ ...d.data(), id: d.id })); }
// v1 문서 하나 실시간 읽기 (관리자 반복 실행: state-actionKPIs · kpi-act-YYYY-Qn) — 읽기만, 쓰지 않음
export function listenV1Doc(id, cb, onErr) {
  return onSnapshot(doc(db, "pour-os", String(id)), (s) => { const d = s.exists() ? s.data() : null; console.log(`[v1 ${id} 읽기] ${d ? "있음" : "없음"}`); cb(d); },
    (e) => { console.error(`[v1 ${id}] 읽기 실패:`, e); onErr && onErr(e); });
}
export async function readV1Notes() { const snap = await getDocs(collection(db, "pour-os", "ak-notes", "c")); console.log(`[v1 댓글 읽기] ${snap.size}건`); return snap.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id })); }
// 파일 올리기 (task-attachments/v2/{대상}/…)
export async function upload(target, file) {
  const safe = String(file.name || "file").replace(/[^\w.\-가-힣]/g, "_").slice(-80);
  const path = `task-attachments/v2/${String(target).replace(/[^\w\-]/g, "_")}/${Date.now()}_${safe}`;
  const r = sref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
  return { name: file.name || "file", url: await getDownloadURL(r), path, size: file.size || 0, type: file.type || "", uploadedAt: new Date().toISOString() };
}
export { arrayUnion, arrayRemove, deleteField };

// ── 여러 사람이 같이 쓸 때: 조건부 쓰기 (서버의 지금 값을 확인하고 씀) ──
// expect = {칸(점 경로 가능): 기대값}. 지금 서버 값이 모두 같을 때만 fields 를 씀 → 그사이 다른 사람이 바꾼 것을 덮지 않음
// 인터넷이 끊겨 확인을 못 하면(transaction 실패) 예전처럼 그냥 씀 — 기기에 쌓였다가 연결되면 올라감
const stable = (v) => JSON.stringify(v === undefined ? null : v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => ((o[kk] = x[kk]), o), {}) : x));
const valAt = (d, path) => String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
export const sameVal = (a, b) => stable(a) === stable(b);
const fits = (cur, expect) => !!cur && Object.keys(expect || {}).every((k) => sameVal(valAt(cur, k), expect[k]));
const offline = (e) => e && /unavailable|offline|network/i.test(String(e.code || e.message || ""));
export async function patchIf(key, id, expect, fields) {
  try { return await runTransaction(db, async (tx) => { const r = v2doc(key, id), s = await tx.get(r); const cur = s.exists() ? s.data() : null;
      if (!fits(cur, expect)) return { ok: false, cur }; tx.update(r, fields); return { ok: true, cur }; }); }
  catch (e) { if (!offline(e)) throw e; console.warn("[v2] 확인 없이 저장(연결 끊김):", e.message); await updateDoc(v2doc(key, id), fields); return { ok: true, cur: null, unchecked: true }; }
}
// 여러 문서 — 문서마다 검사, 그사이 남이 바꾼 문서는 건너뜀. ops: [{key, id, fields, expect}] → {done, skipped:[id]}
export async function patchManyIf(ops) {
  let done = 0; const skipped = [];
  for (let i = 0; i < ops.length; i += 100) {
    const part = ops.slice(i, i + 100);
    try { const r = await runTransaction(db, async (tx) => { const snaps = await Promise.all(part.map((o) => tx.get(v2doc(o.key, o.id)))), ok = [], no = [];
        part.forEach((o, j) => { const cur = snaps[j].exists() ? snaps[j].data() : null; if (fits(cur, o.expect)) { tx.update(v2doc(o.key, o.id), o.fields); ok.push(o.id); } else no.push(o.id); });
        return { ok, no }; });
      done += r.ok.length; skipped.push(...r.no); }
    catch (e) { if (!offline(e)) throw e; console.warn("[v2] 확인 없이 되돌림(연결 끊김):", e.message); await patchMany(part); done += part.length; }
  }
  console.log(`[v2 조건부 쓰기] ${done}건 · 건너뜀 ${skipped.length}건`); return { done, skipped };
}
// 없을 때만 만들기 (두 사람이 동시에 열어 같은 문서를 두 번 만들거나 덮지 않게). ops: [{key, id, data}] → {made, skipped}
export async function createMissing(ops) {
  let made = 0, skipped = 0;
  for (let i = 0; i < ops.length; i += 200) {
    const part = ops.slice(i, i + 200);
    const r = await runTransaction(db, async (tx) => { const snaps = await Promise.all(part.map((o) => tx.get(v2doc(o.key, o.id)))); let m = 0;
      part.forEach((o, j) => { if (!snaps[j].exists()) { tx.set(v2doc(o.key, o.id), o.data); m++; } }); return m; });
    made += r; skipped += part.length - r;
  }
  console.log(`[v2 없을 때만 만들기] ${made}건 · 이미 있음 ${skipped}건`); return { made, skipped };
}

// ── 신제품 대시보드 (pour-os/launch-board/products) 쓰기 — 단계 칸만, 서버 지금 값이 기대값과 같을 때만 ──
const LB = (id) => doc(db, "pour-os", "launch-board", "products", String(id));
export async function patchLaunchIf(ops) {   // ops: [{id, fields, expect}] → {done, skipped}
  let done = 0; const skipped = [];
  for (let i = 0; i < ops.length; i += 100) {
    const part = ops.slice(i, i + 100);
    const r = await runTransaction(db, async (tx) => { const snaps = await Promise.all(part.map((o) => tx.get(LB(o.id)))), ok = [], no = [];
      part.forEach((o, j) => { const cur = snaps[j].exists() ? snaps[j].data() : null; if (fits(cur, o.expect)) { tx.update(LB(o.id), o.fields); ok.push(o.id); } else no.push(o.id); });
      return { ok, no }; });
    done += r.ok.length; skipped.push(...r.no);
  }
  console.log(`[신제품 대시보드 쓰기] ${done}건 · 건너뜀 ${skipped.length}건`); return { done, skipped };
}
// 쓰기 전 통째 백업 (v2 안 backups/{id} · 문서 하나 1MB 안 · 되돌릴 때 이 값으로)
// once: 같은 번호 백업이 이미 있으면 그대로 둠 (하루 첫 백업을 남김)
export async function backupLaunch(id, products, by, once) {
  const json = JSON.stringify(products); if (json.length > 900000) throw new Error("백업이 너무 커요 (" + json.length + "자)");
  const data = { id, kind: "launch-board", at: new Date().toISOString(), by, count: products.length, json };
  if (!once) { await setDoc(v2doc("backups", id), data); return true; }
  return runTransaction(db, async (tx) => { const r = v2doc("backups", id); if ((await tx.get(r)).exists()) return false; tx.set(r, data); return true; });
}
// 신제품 대시보드 제품 실시간 구독 (읽기 · board-structure 문서는 뺌)
export function listenLaunch(cb, onErr) {
  return onSnapshot(collection(db, "pour-os", "launch-board", "products"), (snap) => {
    const all = snap.docs.map((d) => ({ ...d.data(), id: d.id })), items = all.filter((x) => !x.__structure);
    items.structure = all.find((x) => x.__structure) || null;   // 단계 구조·해외 하위 프로젝트 이름 (읽기만)
    console.log(`[신제품 대시보드] ${items.length}건${snap.metadata.fromCache ? " (기기 저장)" : ""}`); cb(items, snap.metadata.fromCache);
  }, (e) => { console.error("[신제품 대시보드] 구독 실패:", e); onErr && onErr(e); });
}
// 문서 하나를 읽고-판단하고-쓰기 (transaction) · fn(cur) → { write?: fields, ret? } — 없으면 만들고(set) 있으면 바뀐 칸만(update)
export async function txDoc(key, id, fn) {
  return runTransaction(db, async (tx) => { const r = v2doc(key, id), s = await tx.get(r), cur = s.exists() ? s.data() : null, out = fn(cur) || {};
    if (out.write) { if (s.exists()) tx.update(r, out.write); else tx.set(r, { id, ...out.write }); } return out.ret ?? null; });
}
