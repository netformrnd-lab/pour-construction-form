// ─────────────────────────────────────────────────────────────────────────────
// brand.config.js — 이 파일 "하나만" 바꾸면 다른 브랜드로 이식됩니다.
// (POUR OS → moyeoradeal OS 등. 앱 로직·기능은 그대로, 브랜드 값만 여기서 주입)
//
// ⚠️ 채우는 순서
//   1) firebase  — moyeoradeal 전용 Firebase 콘솔 값 (필수)
//   2) dataNamespace / storagePrefix — 기존 데이터 연속성 (아주 중요, 아래 설명 필독)
//   3) 나머지(이름·색상·모델·CRM) — 표시/부가 설정
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {

  // ── 1. Firebase (필수 교체) ────────────────────────────────────────────────
  // moyeoradeal 전용 Firebase 프로젝트 값. (Firebase 콘솔 > 프로젝트 설정 > 웹 앱 SDK)
  // ※ 이 값을 POUR(pour-app-new)로 두면 두 브랜드가 같은 데이터를 공유하게 됩니다 — 반드시 교체!
  firebase: {
    apiKey:            "여기에-moyeoradeal-apiKey",
    authDomain:        "여기에-moyeoradeal.firebaseapp.com",
    projectId:         "여기에-moyeoradeal-projectId",
    storageBucket:     "여기에-moyeoradeal.firebasestorage.app",
    messagingSenderId: "여기에-senderId",
    appId:             "여기에-appId",
  },

  // ── 2. 데이터 연속성 (아주 중요) ───────────────────────────────────────────
  // Firestore 상태 문서가 저장되는 "컬렉션 이름". 앱은 이 컬렉션의
  //   {dataNamespace}/state-{키}   문서들에 팀 데이터를 나눠 저장합니다.
  //
  // ⚠️ 지금 쓰고 있는 moyeora-os가 이미 데이터를 쌓아뒀다면,
  //    그 데이터가 저장된 컬렉션 이름과 "똑같이" 맞춰야 기존 데이터가 그대로 보입니다.
  //    확인법: 현재 moyeora-os의 src/firebase.js 에서
  //            doc(db, "___", "state")  ← 이 "___" 값이 곧 dataNamespace 입니다.
  //    (원본 POUR OS를 그대로 fork 했다면 대개 "pour-os" 그대로일 확률이 높습니다.)
  //    → 확실하지 않으면 아래 기본값("pour-os")을 그대로 두고, 배포 후 데이터가
  //       보이는지 확인하세요. 값을 바꾸면 이전 데이터가 "안 보이게" 됩니다(삭제는 아님).
  dataNamespace: "pour-os",

  // 기기 로컬 저장 키 접두사 (localStorage / IndexedDB / 보기모드).
  // 같은 브라우저에서 POUR OS와 moyeora OS를 둘 다 열어도 안 섞이게 하려면 다른 값 권장.
  // (기기별 임시 미러라 데이터 원본이 아님 — 바꿔도 Firestore 데이터엔 영향 없음)
  storagePrefix: "pour-os",

  // ── 3. 앱 정체성 (표시용) ──────────────────────────────────────────────────
  appName:     "MOYEORA OS",   // 헤더/로딩에 뜨는 앱 이름
  appSubtitle: "업무관리",       // 사이드바 로고 밑 작은 글씨
  orgLabel:    "모여라딜",       // 모바일 헤더 브랜드 라벨
  logoLetter:  "M",            // 정사각 로고 안 한 글자
  backupTag:   "moyeora-os",   // JSON 백업 파일의 _app 태그 + 파일명 접두사

  // ── 4. 브랜드 색상 (표시용) ────────────────────────────────────────────────
  // 로고/헤더 포인트 색. (앱 곳곳의 인라인 "#F97316" 계열은 필요 시 일괄치환 — 적용가이드 참고)
  accent:      "#F97316",   // 메인 포인트(주황)
  accentLight: "#FFEDD5",   // 옅은 배경
  accentDark:  "#EA580C",   // 진한 텍스트/그라디언트 끝
  navy:        "#0F1F5C",   // 제목 네이비

  // ── 5. AI 코치 모델 ────────────────────────────────────────────────────────
  // functions/api/coach.js 프록시를 통해 호출. (claude-* 만 허용)
  coachModel: "claude-sonnet-4-20250514",

  // ── 6. CRM 임베드 연동 (선택) ──────────────────────────────────────────────
  // POUR스토어 CRM 안에 iframe으로 심을 때, 부모창(CRM)에서 접속자·매출을 받아오는 기능.
  // moyeoradeal에서 CRM 임베드를 안 쓰면 enabled:false 로 두면 됩니다(무동작).
  crmEmbed: {
    enabled: false,
    origins: [
      // CRM을 쓰는 경우 신뢰할 부모창 출처를 여기에:
      // "https://your-crm.web.app",
    ],
  },
};

// 파생 헬퍼 (수정 불필요) ───────────────────────────────────────────────────
export const KEY = (suffix) => `${BRAND.storagePrefix}-${suffix}`;
