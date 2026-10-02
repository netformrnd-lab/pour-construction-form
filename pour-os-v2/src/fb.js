// 업무OS v2 — 저장 장치 (Firebase pour-app-new)
//
// 쓰기는 오직 pour-os/v2/** 와 Storage task-attachments/v2/** 에만 한다. (v1 데이터 보호)
// v1 문서(pour-os/state-*, pour-os/ak-notes/c)는 '버전1에서 가져오기' 때 읽기만 한다.
// 보안규칙: 기존 pour-os/{doc=**} · task-attachments/** 허용 범위 안 → 규칙 변경 없음.
import { initializeApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore,
  doc, collection, query, where, onSnapshot, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, writeBatch, arrayUnion,
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
export async function patch(key, id, fields) { await updateDoc(v2doc(key, id), fields); }
// 여러 건 한 번에 (400건씩 나눔)
export async function putMany(ops, onProgress, opt) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db); ops.slice(i, i + 400).forEach((o) => (opt && opt.merge ? b.set(v2doc(o.key, o.id), o.data, { merge: true }) : b.set(v2doc(o.key, o.id), o.data)));
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
export async function readV1Notes() { const snap = await getDocs(collection(db, "pour-os", "ak-notes", "c")); console.log(`[v1 댓글 읽기] ${snap.size}건`); return snap.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id })); }
// 파일 올리기 (task-attachments/v2/{대상}/…)
export async function upload(target, file) {
  const safe = String(file.name || "file").replace(/[^\w.\-가-힣]/g, "_").slice(-80);
  const path = `task-attachments/v2/${String(target).replace(/[^\w\-]/g, "_")}/${Date.now()}_${safe}`;
  const r = sref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
  return { name: file.name || "file", url: await getDownloadURL(r), path, size: file.size || 0, type: file.type || "", uploadedAt: new Date().toISOString() };
}
export { arrayUnion };
