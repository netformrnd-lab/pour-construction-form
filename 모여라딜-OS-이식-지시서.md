# 📦 업무관리 OS 고도화 이식 지시서 (moyeoradeal-admin / moyeora-os)

> **이 문서를 받은 Claude Code에게**: 아래를 순서대로 수행하라. 대상은 이 저장소(`moyeoradeal-admin`)의 `moyeora-os/` 앱이다.
> 목표는 **넷폼알앤디에서 고도화된 업무관리 OS(POUR OS)를 moyeora-os에 반영**하되, 브랜드 값은 **`src/brand.config.js` 한 파일**로만 관리되게 만드는 것이다.
> moyeora-os는 원래 이 앱의 fork라 구조가 동일하다. **데이터는 moyeoradeal 전용 Firebase에 그대로 유지**된다(아래 §3 주의 준수).

---

## 0. 이 버전이 주는 고도화(반영 목표)
- **3중 데이터 안전망**: Firestore 분할 문서 + localStorage 미러 + IndexedDB 영구 미러·시점 스냅샷(`src/durable.js`)
- **소프트삭제 휴지통**(`trash`) — 영구삭제 없이 복구, 빈 원격으로 로컬 덮어쓰기 방지(백지 가드), 컬렉션별 1MiB 한도 가드
- **KPI ▸ 데이터** 화면: 휴지통·전체 백업(JSON)·로컬(IndexedDB) 복구 UI
- **자동화 엔진**(`src/launch.js`): 업무 완료 시 후속 업무 자동 생성·연쇄 완료(선행연결)
- **프로세스 템플릿 → SKU 출시 프로젝트 자동 생성**, 구간(세그먼트) 집계 → KPI 통합
- **AI 코치**를 `/api/coach` 프록시로(브라우저에 API 키 노출 안 함), 매출/KPI 자동집계(선행지표=진척% / 결과=매출 분리)

---

## 1. 소스 확보 — 두 경로 중 하나

### 경로 A (권장) — 포터블 폴더를 그대로 복사
넷폼알앤디가 이미 **브랜드 값 분리까지 끝낸 포터블 버전**을 아래에 올려놨다.
```
저장소: netformrnd-lab/pour-construction-form
브랜치: claude/work-os-multi-brand-d9sfym
폴더:   moyeora-os-portable/
```
접근 가능하면 이 폴더 내용으로 `moyeora-os/`를 **통째로 교체**하라(파일 목록: `src/`, `functions/api/`, `index.html`, `package.json`, `vite.config.js`, 그리고 **새 파일 `src/brand.config.js`**). 그다음 **§2(브랜드 값 채우기)만** 하면 끝. §4는 건너뛴다.

> 접근 불가(다른 조직이라 권한 없음)면 사용자에게 "netformrnd-lab/pour-construction-form의 `moyeora-os-portable/` 폴더를 압축해 첨부해달라"고 요청하거나, **경로 B**로 진행하라.

### 경로 B — 현재 moyeora-os에 브랜드 분리를 직접 적용
소스를 못 가져오면, **현재 moyeora-os 코드에 §4의 재배선을 직접 적용**하라. (기능 고도화분이 이미 반영돼 있다는 전제. 안 돼 있으면 사용자에게 포터블 폴더 전달을 요청.)

---

## 2. 브랜드 값 채우기 — `moyeora-os/src/brand.config.js`

아래 파일을 **그대로 생성**하고, `여기에-...` 부분을 moyeoradeal 값으로 채워라.

```js
// src/brand.config.js — 이 파일 하나가 브랜드의 전부. (앱 로직·기능은 그대로)
export const BRAND = {

  // 1) Firebase (필수) — moyeoradeal 전용 프로젝트 (콘솔 > 프로젝트 설정 > 웹 앱 SDK)
  //    ⚠️ POUR(pour-app-new)로 두면 두 브랜드가 같은 데이터를 공유함 — 반드시 교체!
  firebase: {
    apiKey:            "여기에-moyeoradeal-apiKey",
    authDomain:        "여기에-moyeoradeal.firebaseapp.com",
    projectId:         "여기에-moyeoradeal-projectId",
    storageBucket:     "여기에-moyeoradeal.firebasestorage.app",
    messagingSenderId: "여기에-senderId",
    appId:             "여기에-appId",
  },

  // 2) 데이터 연속성 (아주 중요 — §3 필독)
  //    Firestore 상태 문서가 저장되는 컬렉션명. {dataNamespace}/state-{키}
  //    지금 moyeora-os가 쓰던 값과 반드시 일치. fork 원본이면 대개 "pour-os".
  dataNamespace: "pour-os",
  //    기기 로컬 저장 키 접두사(localStorage/IndexedDB). 데이터 원본 아님 — 아무 값 무방.
  storagePrefix: "pour-os",

  // 3) 앱 정체성(표시용)
  appName:     "MOYEORA OS",
  appSubtitle: "업무관리",
  orgLabel:    "모여라딜",
  logoLetter:  "M",
  backupTag:   "moyeora-os",

  // 4) 브랜드 색상(표시용)
  accent:      "#F97316",
  accentLight: "#FFEDD5",
  accentDark:  "#EA580C",
  navy:        "#0F1F5C",

  // 5) AI 코치 모델 (claude-* 만 허용)
  coachModel: "claude-sonnet-4-20250514",

  // 6) CRM 임베드(선택) — POUR스토어 CRM 연동. moyeoradeal은 보통 비활성.
  crmEmbed: { enabled: false, origins: [] },
};

export const KEY = (suffix) => `${BRAND.storagePrefix}-${suffix}`;
```

> `index.html`의 `<title>`도 브랜드명으로 바꿔라(정적 파일이라 config가 안 먹음).

---

## 3. ⚠️ 데이터 연속성 — `dataNamespace` (건드리기 전 필독)
앱은 팀 데이터를 `{dataNamespace}/state-{키}` 문서로 저장한다.
- **지금 moyeora-os가 쓰던 컬렉션명과 똑같이** 맞춰야 기존 데이터가 그대로 보인다.
- 확인법: 현재 `moyeora-os/src/firebase.js`의 `doc(db, "___", "state")`의 `"___"` 값. 그 값을 `dataNamespace`에 넣어라.
- 모르겠으면 **기본값 `"pour-os"` 그대로** 두고 배포 후 데이터가 보이는지 확인. 값을 바꾸면 이전 데이터가 "안 보이게" 될 뿐(삭제 아님) — 되돌리면 다시 보인다.
- `firebase`(프로젝트)와 `dataNamespace`(컬렉션)는 **반드시 moyeoradeal 것**. POUR 값이면 데이터가 섞인다.

---

## 4. 재배선 (경로 B 전용 — 경로 A는 이미 돼 있으니 건너뜀)

현재 moyeora-os 소스에 아래 편집을 적용해, 하드코딩된 브랜드 값을 `brand.config.js` 주입으로 바꿔라.
(문자열이 정확히 안 맞으면, 같은 "의미"의 코드를 찾아 동일하게 바꿔라.)

**`src/firebase.js`**
```diff
+ import { BRAND } from "./brand.config.js";
- const app = initializeApp({ apiKey:"...", authDomain:"...", projectId:"pour-app-new", ... });
+ const app = initializeApp(BRAND.firebase);
+ const NS = BRAND.dataNamespace;
- export const STATE_DOC = doc(db, "pour-os", "state");
- export const colDoc = (key) => doc(db, "pour-os", "state-" + key);
- export const META_DOC = doc(db, "pour-os", "state-meta");
- export const LOCK_DOC = doc(db, "pour-os", "state-savelock");
+ export const STATE_DOC = doc(db, NS, "state");
+ export const colDoc = (key) => doc(db, NS, "state-" + key);
+ export const META_DOC = doc(db, NS, "state-meta");
+ export const LOCK_DOC = doc(db, NS, "state-savelock");
```

**`src/durable.js`**
```diff
+ import { BRAND } from "./brand.config.js";
- const DB_NAME = "pour-os-durable";
+ const DB_NAME = `${BRAND.storagePrefix}-durable`;
```

**`src/crmOperatorSync.js`**
```diff
+ import { BRAND } from "./brand.config.js";
+ const CRM_ENABLED = !!(BRAND.crmEmbed && BRAND.crmEmbed.enabled);
- const CRM_ORIGINS = [ "https://pourstorecrm.web.app", "https://pourstorecrm.firebaseapp.com" ];
+ const CRM_ORIGINS = (BRAND.crmEmbed && BRAND.crmEmbed.origins) || [];
```
그리고 `listenForOperator` / `initCrmOperatorSync` / `initCrmRevenueSync` 각 함수 **첫 줄**에:
```js
if (!CRM_ENABLED) return () => {};
```

**`src/App.jsx`**
```diff
+ import { BRAND, KEY } from "./brand.config.js";
// 기기 저장 키 (있는 것만)
- const LOCAL_USER_KEY = "pour-os-current-user";
- const MIRROR_KEY = "pour-os-mirror";
- const MIRROR_AT_KEY = "pour-os-mirror-at";
- const EXT_BACKUP_AT_KEY = "pour-os-ext-backup-at";
+ const LOCAL_USER_KEY = KEY("current-user");
+ const MIRROR_KEY = KEY("mirror");
+ const MIRROR_AT_KEY = KEY("mirror-at");
+ const EXT_BACKUP_AT_KEY = KEY("ext-backup-at");
// 보기모드 키
- localStorage.getItem("pour-os-view") ... localStorage.setItem("pour-os-view", ...)
+ localStorage.getItem(KEY("view")) ... localStorage.setItem(KEY("view"), ...)
// 색상 상수 C
- navy:"#0F1F5C", orange:"#F97316", orangeL:"#FFEDD5", orangeD:"#EA580C",
+ navy:BRAND.navy, orange:BRAND.accent, orangeL:BRAND.accentLight, orangeD:BRAND.accentDark,
// JSON 백업 태그·파일명 (2곳: _app:"pour-os" → _app:BRAND.backupTag, "pour-os-backup_" → `${BRAND.backupTag}-backup_`)
// AI 코치 모델 (2곳: model:"claude-sonnet-4-20250514" → model:BRAND.coachModel)
// 로고/이름 표시 (로딩·사이드바·모바일 헤더 3곳):
//   "P" → {BRAND.logoLetter},  "POUR OS" → {BRAND.appName},  "업무관리" → {BRAND.appSubtitle},
//   "POUR스토어" → {BRAND.orgLabel},  gradient "#F97316,#EA580C" → `${BRAND.accent},${BRAND.accentDark}`
```
> 그 외 앱 곳곳의 인라인 `#F97316`(주황 계열)은 기능과 무관. 브랜드색을 완전히 바꾸려면 `App.jsx`에서 `#F97316→메인색 / #FFEDD5→옅은배경 / #EA580C→진한텍스트` 일괄치환(선택).

---

## 5. Firestore / Storage 보안 규칙
moyeoradeal Firebase 규칙에 없으면 추가:
```
match /{namespace}/{doc} { allow read, write: if true; }   // namespace = dataNamespace 값 (예: /pour-os/{doc})
match /task-attachments/{allPaths=**} { allow read, write: if true; }   // Storage: task 사진 첨부
```

## 6. 빌드 · 배포 · 검증
```bash
npm install
npm run build                 # → dist/ 생성되면 재배선 성공
node src/kpi.test.mjs         # 17/17 통과 기대
node src/launch.test.mjs      # 13/13 통과 기대
```
- 배포: **Cloudflare Pages** — Build `npm run build`, Output `dist`, 환경변수 `ANTHROPIC_API_KEY`(AI 코치용).
- (선택) GitHub 자동 백업(`functions/api/backup.js`): CF Pages 환경변수 `GITHUB_TOKEN`, `GITHUB_BACKUP_REPO`(예: `moyeoradeal-lang/moyeoradeal-admin`), `GITHUB_BACKUP_DIR`(예: `moyeora-os-backups`)를 moyeoradeal 값으로. 안 넣으면 비활성.

## 7. 완료 보고
반영 후 사용자에게: ① `brand.config.js` 최종값(파이어베이스 projectId·dataNamespace), ② 빌드·테스트 결과, ③ 배포 URL, ④ 기존 데이터가 그대로 보이는지 확인 결과를 보고하라.
