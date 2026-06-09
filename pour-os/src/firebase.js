// Firebase (모듈러 SDK) — pour-app-new
// 단일 공유 문서(pour-os/state)에 앱 상태를 실시간 저장/구독한다.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU",
  authDomain: "pour-app-new.firebaseapp.com",
  projectId: "pour-app-new",
  storageBucket: "pour-app-new.firebasestorage.app",
  messagingSenderId: "411031141847",
  appId: "1:411031141847:web:e658174fd4b9652cdadf92",
});

const db = getFirestore(app);

// 단일 공유 상태 문서
export const STATE_DOC = doc(db, "pour-os", "state");
export { onSnapshot, setDoc };
