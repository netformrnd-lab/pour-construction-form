# Firebase 배포 가이드

POUR스토어 운영 시스템의 Firestore 보안 규칙 배포 방법.

## 빠른 배포 (5분, Firebase Console)

브라우저에서 직접 배포 — 가장 간단한 방법.

### 1단계 — Firebase Console 접속

1. https://console.firebase.google.com 접속
2. 프로젝트 선택: **pour-app-new**

### 2단계 — Firestore 규칙 페이지 이동

1. 좌측 메뉴 → **빌드** → **Firestore Database**
2. 상단 탭 → **규칙** (Rules)

### 3단계 — 규칙 복사·붙여넣기

1. 이 저장소의 [`firestore.rules`](./firestore.rules) 파일 내용 전체 복사
2. Firebase Console 규칙 편집기에 붙여넣기
3. 우측 상단 **게시** (Publish) 클릭

### 4단계 — 검증

1. 규칙 게시 직후 https://pour-construction-form.pages.dev/pourstore-renewal/admin 접속
2. PIN `1234` 로그인 → 대리점 등록 시도
3. 정상 저장되면 ✅
4. "Permission denied" 에러 시 → 규칙 콘솔 다시 확인

---

## 자동 배포 (선택사항, Firebase CLI)

CI/CD 또는 정기 업데이트 시 사용. 모바일에선 어려움.

### 사전 준비

```bash
npm install -g firebase-tools
firebase login
firebase use pour-app-new
```

### 배포

```bash
firebase deploy --only firestore:rules
```

---

## 인덱스 (현재 불필요)

POUR스토어 어드민은 단일 필드 `where` 쿼리만 사용 (`dealerId == X`). 복합 인덱스 불필요.

추후 다음 쿼리가 필요할 때만 인덱스 생성:
- `where('dealerId', '==', X).orderBy('createdAt', 'desc')` ← 복합 인덱스 필요
- 그 외 다중 필드 정렬·필터

---

## 보안 단계별 강화 로드맵

| 단계 | 내용 | 시점 |
|---|---|---|
| **현재 (MVP)** | 모든 collection read/write 허용 | 초기 운영·테스트 |
| **1단계** | Firebase Auth 인증 필수 | 외부 사용자 다수 도달 후 |
| **2단계** | Custom Claims로 역할 분리 (admin/dealer/partner) | 권한 분리 필요 시 |
| **3단계** | 필드 검증 + 소유권 체크 | 운영 안정화 후 |

각 단계 코드 예시는 `firestore.rules` 하단 주석 참조.

---

## 트러블슈팅

### "Missing or insufficient permissions"
- 원인: 규칙이 게시되지 않았거나 컬렉션명이 규칙과 불일치
- 해결: Firebase Console → Firestore → 규칙 → 게시 클릭

### "FirebaseError: Failed to get document"
- 원인: 네트워크 또는 프로젝트 ID 불일치
- 해결: 어드민 HTML의 `projectId: "pour-app-new"` 확인

### 규칙 변경 후에도 차단됨
- 원인: 캐시
- 해결: 시크릿 모드로 재접속 또는 페이지 강제 새로고침

---

## 컬렉션별 용도 (참고)

| 컬렉션 | 사용처 | 비고 |
|---|---|---|
| `matching-requests` | 시공연결 신청 | admin + portal(파트너) |
| `partner-companies` | 파트너사 | admin + portal 로그인 |
| `dealers` | 대리점 | admin + portal/kiosk 로그인 |
| `dealer-orders` | 주문 (자사몰+매장+전화) | admin + portal + kiosk |
| `purchase-orders` | 발주 (대리점→본사) | admin |
| `site-inquiries` | 문의 (자사몰·카카오·전화) | admin |
| `matching-rules` | 매칭 룰 (현재 코드 내장) | admin |

기존 박람회 컬렉션(`leads`, `config`, `qr-stats` 등)은 건드리지 말 것.
