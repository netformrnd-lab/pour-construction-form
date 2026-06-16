// Firebase (모듈러 SDK) — pour-app-new
// v2: 앱 상태를 컬렉션별 문서(pour-os/state-<collection>)로 분할 저장 → 1MiB 한도·동시편집 충돌 완화.
// (레거시 단일 문서 pour-os/state 는 마이그레이션 소스 + 비상 백업으로 보존)
import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, onSnapshot, setDoc, getDoc, getDocs } from "firebase/firestore";
import { getStorage, ref as sref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const app = initializeApp({
  apiKey: "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU",
  authDomain: "pour-app-new.firebaseapp.com",
  projectId: "pour-app-new",
  storageBucket: "pour-app-new.firebasestorage.app",
  messagingSenderId: "411031141847",
  appId: "1:411031141847:web:e658174fd4b9652cdadf92",
});

const db = getFirestore(app);

// 레거시 단일 상태 문서 (마이그레이션 소스 + 비상 백업)
export const STATE_DOC = doc(db, "pour-os", "state");
// v2: 컬렉션별 분할 문서 — 기존 보안규칙 `match /pour-os/{doc}` 으로 이미 허용되어 규칙 변경 불필요
export const colDoc = (key) => doc(db, "pour-os", "state-" + key);
export const META_DOC = doc(db, "pour-os", "state-meta");
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
