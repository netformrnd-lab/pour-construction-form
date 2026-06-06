# KPI Flow 마이그레이션 — 폰 전용 실행 가이드

PC 없이 GitHub Actions로 **배포 + 백업 + 마이그레이션**을 완료하는 방법.

---

## 0. 사전 조건 — 워크플로우를 main에 병합
`workflow_dispatch`는 **기본 브랜치(main)에 워크플로우 파일이 있어야** Actions 탭에 "Run workflow" 버튼이 뜹니다.
→ `claude/admin-access-mobile-L1h8O` 브랜치를 **main에 병합(PR Merge)** 하세요. (폰 GitHub 앱에서 가능)

---

## 1. GitHub Secrets 등록 (폰 브라우저)

저장소 → **Settings → Secrets and variables → Actions → New repository secret**

### ① SERVICE_ACCOUNT_KEY  (필수)
- Firebase 콘솔(console.firebase.google.com) → **pour-app-new** → ⚙️ 프로젝트 설정 → **서비스 계정** → **새 비공개 키 생성** → JSON 다운로드
- 폰에서: 다운로드된 JSON 파일을 텍스트 앱으로 열어 **전체 내용 복사**
- Secret 이름: `SERVICE_ACCOUNT_KEY`
- 값: 복사한 **JSON 전체** (`{ "type": "service_account", ... }` 통째로)

### ② FIREBASE_TOKEN  (선택 — 없어도 됨)
- 이 토큰은 `firebase login:ci`로 만드는데 **PC가 필요**합니다.
- **폰만 쓴다면 등록하지 마세요.** 워크플로우가 자동으로 `SERVICE_ACCOUNT_KEY`(서비스계정)로 배포합니다.
- (PC가 있고 토큰을 쓰고 싶을 때만) `firebase login:ci` 결과값을 `FIREBASE_TOKEN`으로 등록.

> 💡 서비스계정 권한: "새 비공개 키"로 받은 계정은 보통 Editor 권한이라 규칙·인덱스 배포가 됩니다.
> 만약 배포 단계에서 권한 오류가 나면, 콘솔 IAM에서 그 서비스계정에
> **Firebase Rules Admin** + **Cloud Datastore Index Admin** 역할을 추가하세요.

---

## 2. 실행 (Actions 탭)

저장소 → **Actions → "KPI Flow — Migrate & Deploy" → Run workflow** → `action` 선택:

| 선택지 | 하는 일 | 데이터 변경 |
|--------|---------|------------|
| **dry-run** | 백업 + 마이그레이션 **미리보기**(생성 예정 건수만 출력) | ❌ 없음 |
| **deploy-only** | firestore 규칙·인덱스만 배포 | 규칙/인덱스만 |
| **full-migrate** | 배포 + 백업 + **실제 마이그레이션** | ✅ 신규 컬렉션 생성 |

### 권장 순서
1. **dry-run** 먼저 실행 → 로그에서 생성 예정 건수 확인 + **백업 artifact 다운로드**(Actions 실행 페이지 하단 Artifacts)
2. 이상 없으면 **full-migrate** 실행 → 실제 적용
3. 새 앱(pour-firebase.js 기반)에서 데이터 확인

---

## 3. 안전장치 요약
- **추가형**: 기존 `pour-*`·`staff`는 **읽기만**. 삭제·수정 없음. 잘못돼도 신규 컬렉션만 지우면 롤백.
- **재실행 안전**: 모든 신규 문서가 결정적 ID `set(merge)` → 두 번 돌려도 중복 안 생김.
- **백업 우선**: full-migrate도 마이그레이션 **직전 전체 백업**을 artifact로 남김 (30일 보관).

---

## 4. 알아둘 점
- **인덱스 빌드 시간**: 배포 후 Firestore가 인덱스를 만드는 데 몇 분 걸릴 수 있음 (콘솔 → Firestore → 색인에서 상태 확인).
- **events 단일필드 인덱스**: `firestore.indexes.json`의 `events`(date 1개) 항목은 배포 시 "불필요" 경고가 날 수 있음. 오류로 막히면 그 한 줄만 지우고 다시 실행. (date 단일 정렬은 자동 색인이라 없어도 동작)
- **신규 11개 컬렉션 규칙**: 현재 MVP 정책대로 `allow read, write: if true`. 운영 안정화 후 인증 기반으로 강화 권장.
</content>
