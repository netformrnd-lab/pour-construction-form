# POUR스토어 업무관리 — 데이터 & Firebase 연결 정보 종합 참고 문서

> 다른 업무관리 웹앱 개발·데이터 이관용 레퍼런스.
> 출처: `pourstore-renewal/admin.html` (KPI 업무관리센터) + `firestore.rules` + `storage.rules`
> 정리일: 2026-06-06

---

## ⚠️ 먼저 읽어주세요 — 데이터 2종류 구분

| 종류 | 위치 | 이 문서 포함 여부 |
|------|------|-----------------|
| **① 구조/시드 데이터** (OKR·KPI 트리, 55개 프로젝트, 기본 task) | 코드에 하드코딩 | ✅ 전부 포함 (`workmgmt-seed-data.json`) |
| **② 실시간 운영 데이터** (현재 진척도%, KPI 실적값, 실제 작성된 task·반복업무, 담당자 실 ID) | Firestore `pour-app-new` | ❌ 미포함 — 별도 export 필요 (아래 §6 참고) |

**다른 앱에 "구조"를 그대로 옮길 거면 ①(JSON)만으로 충분합니다.**
실제 입력된 매출/진척도/완료여부까지 옮기려면 ②를 Firestore에서 내보내야 합니다.

---

## 1. Firebase 연결 정보 (클라이언트 SDK)

```javascript
// Firebase 10.12.0 compat SDK 사용
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>

firebase.initializeApp({
  apiKey: "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU",
  authDomain: "pour-app-new.firebaseapp.com",
  projectId: "pour-app-new",
  storageBucket: "pour-app-new.firebasestorage.app",
  messagingSenderId: "411031141847",
  appId: "1:411031141847:web:e658174fd4b9652cdadf92"
});
const db = firebase.firestore();
const storage = firebase.storage();
```

- **프로젝트 ID**: `pour-app-new` (단일 프로젝트로 통합 운영)
- **Auth**: 사용 안 함 (Firebase Authentication 미사용). 앱 자체 PIN(SHA-256, localStorage) 방식.
- **Storage 버킷**: `pour-app-new.firebasestorage.app`
- **콘솔**: https://console.firebase.google.com/project/pour-app-new
- ⚠️ 이 config의 apiKey는 클라이언트 공개키(원래 노출되는 값)이며, 실제 보안은 아래 **보안 규칙**으로 통제됨.

---

## 2. 업무관리(KPI센터) Firestore 컬렉션 구조

> 모든 문서는 `staffId`(staff 컬렉션 doc.id)로 소유자 식별. 컬렉션명은 kebab-case.

| 상수 | 컬렉션명 | 용도 | 핵심 필드 |
|------|---------|------|----------|
| `STAFF` | `staff` | 담당자 마스터 | name, kpiMemberId, kpiInitial, kpiColor, favoriteProjectIds[] |
| `POUR_OBJECTIVES` | `pour-objectives` | 목표(O) | title, year, target, current, unit, description |
| `POUR_KEYRESULTS` | `pour-keyresults` | 핵심결과(KR) | objectiveId, title, target, current, unit, channel('inbound'\|'outbound'\|'ops') |
| `POUR_KPIS` | `pour-kpis` | 지표(결과지표+활동지표) | staffId, keyResultId, projectId, kind('result'\|'activity'), name, target, baseline, unit, source('manual'\|'auto-progress'), current, history[], period |
| `POUR_PROJECTS` | `pour-projects` | 프로젝트(실행단위) | staffId(owner), keyResultId, projectCode, name, category, status, progress(0~100), assigneeStaffIds[], priority, description, dueDate |
| `POUR_TASKS` | `pour-tasks` | 업무(task) | staffId, title, done, doneAt, priority, projectId, weekDay, weekSlot, dueDate, isFixed, recurringId, performedDate, notes(string), attachments[] |
| `POUR_RECURRING` | `pour-recurring` | 반복(고정)업무 | staffId, assigneeStaffIds[]\|'all', title, recurType('daily'\|'weekly'\|'monthly'), weekDay, monthDay, time, priority, projectId, pinned, active |
| `POUR_MEETINGS` | `pour-meetings` | 회의 | title, date, time, type, place, agenda, attendeeStaffIds[], actionItems[] |
| `POUR_JOURNALS` | `pour-journals` | 업무일지 | staffId, staffName, date, projectId, content, hoursSpent, progressDelta, mood, attachments[] |
| `POUR_AI_REVIEWS` | `pour-ai-reviews` | AI 주간점검 | weekOf, snapshot{}, llm{}, insights{}, abTests[], rawText |
| `WORK_CHANNELS` | `work-channels` | KR 하위 거래채널 | code, krGroup, name, target, unit, status, order |

### 데이터 모델 관계도
```
pour-objectives (목표 1개: 2026 매출 10억)
   └─ pour-keyresults (KR1·KR2·KR3)
        ├─ pour-kpis (kind='result', 결과지표 — 매출 등 수동입력)
        └─ pour-projects (실행 프로젝트 55개, keyResultId로 KR 연결)
             ├─ pour-kpis (kind='activity', 활동지표 — 주간 선행지표, projectId 참조)
             └─ pour-tasks (개별 업무, projectId 참조)

pour-recurring (반복업무 정의) ──매일 자동생성──> pour-tasks (오늘 인스턴스, recurringId 보유)
staff (담당자) ──staffId/assigneeStaffIds──> 모든 컬렉션
```

### task 필드 상세 (pour-tasks)
- `done`(bool), `doneAt`(ISO|null), `priority`('high'|'mid'|'low')
- `weekDay`('월'~'일'), `weekSlot`(1~5, 주간 우선순위 슬롯), `dueDate`('YYYY-MM-DD')
- `isFixed`(bool, 📌고정), `recurringId`(반복업무 연결), `performedDate`('YYYY-MM-DD')
- `notes`(**문자열** — 빠른 메모), `attachments`([{name,url,path,size,contentType,uploadedAt}])
- `status`('active'|'hold'|'stopped'|'resume')
- 공통 audit: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

---

## 3. 보안 규칙 (firestore.rules)

> 현재 운영 방식: **모든 업무관리 컬렉션 `allow read, write: if true`** (앱 PIN으로만 통제, 서버측 인증 없음).
> 다른 앱 개발 시 참고만 하고, 신규 앱에서는 Auth 기반 규칙 권장.

```
match /staff/{doc}            { allow read, write: if true; }
match /pour-tasks/{doc}       { allow read, write: if true; }
match /pour-recurring/{doc}   { allow read, write: if true; }
match /pour-projects/{doc}    { allow read, write: if true; }
match /pour-objectives/{doc}  { allow read, write: if true; }
match /pour-keyresults/{doc}  { allow read, write: if true; }
match /pour-kpis/{doc}        { allow read, write: if true; }
match /pour-meetings/{doc}    { allow read, write: if true; }
match /pour-journals/{doc}    { allow read, write: if true; }
match /pour-ai-reviews/{doc}  { allow read, write: if true; }
match /work-channels/{doc}    { allow read, write: if true; }
```

## 4. Storage 규칙 (storage.rules) — task 첨부 관련
```
// task 첨부 사진 경로: task-attachments/{taskId}/{filename}
match /task-attachments/{allPaths=**} { allow read, write: if true; }
// 그 외 정의 안 된 경로는 모두 거부
match /{allPaths=**} { allow read, write: if false; }
```

---

## 5. 담당자(staff) 키 매핑

> 시드 데이터의 `ownerKey`/`collabKeys`는 staff 컬렉션의 `kpiMemberId`와 매칭됨.
> 이름 자동추론 규칙: 이름에 '송희'→songhee, '민지'→minji, '란'→ran (채림은 수동/직접).

| kpiMemberId(키) | 이름(추정) | 역할 |
|----------------|-----------|------|
| `songhee` | 송희 | 자사몰 구축·B2B 협약·운영시스템·전략기획 (owner 다수) |
| `minji` | 민지 | SKU 세팅·콘텐츠·CS·위탁판매처·벤처나라 |
| `ran` | 란 | 광고·키워드·대리점·조달청 영업·CRM/매출 시스템 |
| `chaerim` | 채림 | 사후관리·CS·운영 인프라(주문·발주·재고·반품) |

⚠️ 실제 staff 문서의 `id`·이름·연락처는 Firestore `staff` 컬렉션에서 확인(§6 export).

---

## 6. 실시간 운영 데이터(②) 내보내는 방법

코드 시드(①)가 아닌 **실제 입력된 값**(진척도·KPI 실적·작성된 task)은 Firestore에 있습니다. 3가지 방법:

### 방법 A — 앱에 "전체 내보내기" 버튼 추가 (모바일 추천)
admin.html에 모든 `pour-*` + `staff` 컬렉션을 JSON 한 파일로 받는 버튼을 추가할 수 있습니다.
→ 요청 시 바로 구현해 드립니다 (PC·콘솔 불필요, 폰에서 클릭→다운로드).

### 방법 B — Firebase 콘솔/CLI export (PC 필요)
```
gcloud firestore export gs://pour-app-new.firebasestorage.app/backups/manual
# 또는 콘솔 > Firestore > 가져오기/내보내기
```

### 방법 C — 기존 백업 시스템 활용
이 저장소 `backup/firestore-backup.js` + GitHub Actions(매일 자정 KST)가
Firestore → JSON → GitHub로 자동 백업 중. 단, 서비스계정 키(.env) 필요.

---

## 7. 첨부 파일

- **`workmgmt-seed-data.json`** — OKR/KPI 트리 + 55개 프로젝트(담당자·우선순위·활동지표·기본 task) 전체. 다른 앱에 바로 import용 구조화 데이터.
</content>
</invoke>
