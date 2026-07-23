// Firebase (모듈러 SDK) — 브랜드 값은 src/brand.config.js 에서 주입
// v2: 앱 상태를 컬렉션별 문서({dataNamespace}/state-<collection>)로 분할 저장 → 1MiB 한도·동시편집 충돌 완화.
// (레거시 단일 문서 {dataNamespace}/state 는 마이그레이션 소스 + 비상 백업으로 보존)
import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, onSnapshot, setDoc, getDoc, getDocs, runTransaction } from "firebase/firestore";
import { getStorage, ref as sref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { BRAND } from "./brand.config.js";

const app = initializeApp(BRAND.firebase);
const NS = BRAND.dataNamespace;   // Firestore 상태 문서가 저장되는 컬렉션명

const db = getFirestore(app);

// 레거시 단일 상태 문서 (마이그레이션 소스 + 비상 백업)
export const STATE_DOC = doc(db, NS, "state");
// v2: 컬렉션별 분할 문서 — 보안규칙 `match /{NS}/{doc}` 로 허용돼 있어야 함(아래 적용가이드 참고)
export const colDoc = (key) => doc(db, NS, "state-" + key);
export const META_DOC = doc(db, NS, "state-meta");
// 저장 잠금(동시편집 시 best-effort 직렬화)
export const LOCK_DOC = doc(db, NS, "state-savelock");
export { db, runTransaction };
// 임의 컬렉션/문서 참조 — 외부 마스터(어드민센터 staff 컬렉션 = 담당자 관리) 읽기용
export const extDoc = (col, id) => doc(db, col, id);
export const extCol = (name) => collection(db, name);
export { onSnapshot, setDoc, getDoc, getDocs };

// Storage — task 사진 첨부 (경로: task-attachments/{taskId}/{filename})
const storage = getStorage(app);
export async function uploadTaskPhoto(taskId, file) {
  const path = `task-attachments/${taskId}/${Date.now()}_${(file.name||"photo").replace(/[^\w.\-]/g,"_")}`;
  const r = sref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { name: file.name||"photo", url, path, size: file.size||0, type: file.type||"", uploadedAt: new Date().toISOString() };
}
export async function deleteTaskPhoto(path) {
  try { await deleteObject(sref(storage, path)); } catch(e) { console.warn("[pour-os] 첨부 삭제 실패(무시):", e.message); }
}
