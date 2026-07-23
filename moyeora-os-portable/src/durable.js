// IndexedDB 영구 보관 — localStorage(~5MB)를 넘는 대용량도 안전 보관 + 시점별 스냅샷(롤백용).
// 기존 Firestore/localStorage 경로에 "추가만" 되는 3차 안전망. 어떤 호출도 throw로 앱을 깨지 않도록 .catch로 사용.
import { BRAND } from "./brand.config.js";
const DB_NAME = `${BRAND.storagePrefix}-durable`;
const STORE = "kv";
let _dbp = null;

function db() {
  if (_dbp) return _dbp;
  _dbp = new Promise((res, rej) => {
    try {
      if (typeof indexedDB === "undefined") return rej(new Error("no-indexeddb"));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error("idb-open"));
    } catch (e) { rej(e); }
  });
  return _dbp;
}

function put(key, val) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(val, key);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
function get(key) {
  return db().then(d => new Promise((res, rej) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function delKey(key) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, "readwrite");
    t.objectStore(STORE).delete(key);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  }));
}
function allKeys() {
  return db().then(d => new Promise((res, rej) => {
    const r = d.transaction(STORE).objectStore(STORE).getAllKeys();
    r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
  }));
}

// 전체 상태 거울 — 항상 최신본 1개
export function idbSaveMirror(shared) { return put("mirror", { at: new Date().toISOString(), data: shared }); }
export function idbLoadMirror() { return get("mirror"); }

// 시점 스냅샷 — 최근 SNAP_KEEP개만 보관(오래된 것 자동 정리)
const SNAP_PREFIX = "snap:";
const SNAP_KEEP = 24;
export async function idbPushSnapshot(shared) {
  const at = new Date().toISOString();
  await put(SNAP_PREFIX + at, { at, data: shared });
  try {
    const keys = (await allKeys()).filter(k => typeof k === "string" && k.startsWith(SNAP_PREFIX)).sort();
    for (let i = 0; i < keys.length - SNAP_KEEP; i++) await delKey(keys[i]);
  } catch (_) {}
}
export async function idbListSnapshots() {
  const keys = (await allKeys()).filter(k => typeof k === "string" && k.startsWith(SNAP_PREFIX)).sort().reverse();
  return keys.map(k => ({ key: k, at: k.slice(SNAP_PREFIX.length) }));
}
export function idbGetSnapshot(key) { return get(key); }
