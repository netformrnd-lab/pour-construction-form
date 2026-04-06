# 넷폼알앤디 통합 프로젝트 프롬프트 v2.0

> 건축물 유지보수 전문 기업 **넷폼알앤디(NetformR&D)**의 전체 세계관, 개발 원칙, 데이터 구조를 담은 마스터 프롬프트.
> 4개 브랜드(POUR솔루션, POUR공법, POUR스토어, 그로홈)를 통합 관리하는 프로젝트.

---

## 프롬프트 구조

| PART | 파일 | 내용 |
|------|------|------|
| **1. 사업 설계** | [prompts/01-business-master.md](prompts/01-business-master.md) | 회사 구조, 브랜드 세계관, 영업 파이프라인, 사이트 운영 |
| **2. 개발 원칙** | [prompts/02-development-rules.md](prompts/02-development-rules.md) | 기술 스택, CSS 디자인 시스템, 에러 방지 규칙, 재사용 패턴 |
| **3. 파일 구조** | [prompts/03-file-templates.md](prompts/03-file-templates.md) | 프로젝트 파일 구조, 화면 설계, 임베드 구조, 호스팅 |
| **4. Firestore 스키마** | [prompts/04-firestore-schema.md](prompts/04-firestore-schema.md) | 기존 9개 + 신규 컬렉션 스키마, 상태값 상수 |

---

## 퀵 레퍼런스

### 회사 구조
```
넷폼알앤디 (모회사) — 건축물 유지보수 전문
├── POUR솔루션  → 의뢰자 (아파트/관공서/일반건물)     [블루 #2563EB]
├── POUR공법    → 시공사 (종합건설/전문건설/방수업체)   [오렌지 #E8780F]
├── POUR스토어  → B2C (셀프시공 자재 유통)            [그린 #059669]
└── 그로홈      → 홈 인테리어 (홈데코/홈리페어)        [퍼플 #6D28D9]
```

### 기술 스택 (변경 금지)
- **React 18** CDN (unpkg) + **Babel** standalone
- **Firebase 10.12.0** compat — 프로젝트: `pour-app-prod` (prod) / `pour-app-dev` (dev, 예정)
- **Cloudflare Pages** 호스팅 + **Cloudflare Workers** (SMS·Claude API·백업 프록시)
- **Claude API (Anthropic)** — 하자사진 분석·태그 생성·유사현장 매칭 (2차)
- **Kakao Maps API** — 완공현장 지도 분포도 (2차)
- **단일 HTML 파일** 패턴 (빌드 도구 없음)
- **Pretendard** 폰트, CSS 변수 (`:root` 토스 스타일)

### 파일 구조
```
pour-construction-form/
├── CLAUDE.md                   ← 이 파일 (마스터 프롬프트 v2.0)
├── prompts/                    ← 서브 프롬프트 4개
├── index.html                  ← 1차: 태블릿 상담앱 (박람회, 건드리지 말 것)
├── admin.html                  ← 1차: 영업관리센터
├── defect-diagnosis.html       ← 2차: AI 하자진단 태블릿앱 (신규)
├── inbound-form.html           ← 2차: 인바운드 셀프진단 웹폼 (신규)
├── site-solution.html          ← 2차: POUR솔루션 사이트 연동
├── site-method.html            ← 2차: POUR공법 사이트 연동
├── site-store.html             ← 2차: POUR스토어 사이트 연동
├── worker.js                   ← SMS 프록시 (기존, 건드리지 말 것)
├── workers/
│   ├── backup-cron.js          ← Cloudflare Cron — Firestore 백업 트리거
│   ├── claude-proxy.js         ← Claude API 프록시 (2차, 예정)
│   └── wrangler.backup.toml    ← Cron Worker 설정
├── backup/
│   ├── firestore-backup.js     ← Firestore → JSON → GitHub 자동 백업
│   ├── soft-delete.js          ← 소프트딜리트 유틸
│   └── package.json
├── .github/workflows/
│   └── firestore-backup.yml    ← 매일 자정 KST 자동 백업 (GitHub Actions)
├── .env.example                ← 환경변수 템플릿 (커밋 O)
├── functions/send-sms.js       ← Cloudflare Pages Function (기존)
└── poursotre/                  ← 배너/마케팅 자료 (기존)
```

### 핵심 규칙 5가지
1. **에러를 삼키지 마라** — catch에서 빈 배열 반환 금지
2. **빈 결과는 의심하라** — console.log 건수 필수
3. **Firestore orderBy 금지** — 클라이언트 정렬 사용
4. **컬렉션명 오타 주의** — 빈 스냅샷은 에러가 아님
5. **Firebase 보안규칙 변경 금지**

### 영업 파이프라인
```
아웃바운드 (오프라인 대면):
  하자진단 → 유사현장 제시 → 니즈 메모 → 본질문제 연결 → POUR공법 소개 → 경쟁 차별화 → 견적·계약

아웃바운드 (온라인):
  DM/문자/이메일 → 인바운드 웹폼 링크 → 셀프진단 → 유사현장 → 상담신청 → 리드 유입

공통 파이프라인:  신규 → 상담중 → 견적제출 → 계약예정 → 계약완료
POUR공법 입찰:    입찰등록 → 투찰완료 → 낙찰/유찰
```

### Firestore 컬렉션 (총 24개)
**기존 9개 (1차):** `leads`, `leads-store`, `leads-grohome`, `config/*`, `app-config/*`, `qr-stats`
**신규 13개 (1차):** `leads-method`, `outbound-*` (4개), `activities`, `partner-inquiries`, `dealer-inquiries`, `site-inquiries`, `site-metrics`, `site-resources`, `partner-companies`, `matching-requests`
**신규 2개 (2차):** `defect-sites`, `sales-docs`

### 환경 분리 (dev/prod)
```
개발:  Firebase 프로젝트 pour-app-dev (예정)  ← 2차 개발 시 사용
운영:  Firebase 프로젝트 pour-app-prod        ← 1차 현행 운영 중 (건드리지 말 것)

.env.dev  → pour-app-dev 연결 (git 커밋 금지)
.env.prod → pour-app-prod 연결    (git 커밋 금지)
.env.example → 템플릿 (git 커밋 O)
```

### Claude API 프록시 구조
```
태블릿 앱 / 웹폼
    ↓
Cloudflare Worker (workers/claude-proxy.js)
    ├─ API 키 서버사이드 보관 (클라이언트 노출 금지)
    ├─ WORKER_SECRET으로 요청 인증
    └─ Claude API (Vision + Text) 호출
        ↓
응답: 하자유형·부위·심각도·태그 JSON 반환
```

### 사이트 ↔ 관리센터 데이터 흐름
```
[사이트 폼] ──write──→ Firestore ──read──→ [관리센터]
                                              │
                                    승인 → SMS 발송
                                    서류 → 계약 관리
                                              │
[수치 위젯] ──read──← site-metrics ──write──← [관리센터]
```

---

## 출시 단계별 로드맵

### 1차 (완료/운영 중) — 박람회 영업 대시보드
> **index.html 절대 건드리지 말 것** — 박람회 현장 운영 중

| 작업 | 상태 |
|------|------|
| CLAUDE.md + prompts/ 서브 프롬프트 | ✅ 완료 |
| admin.html 뼈대 (사이드바 + 라우팅 + PIN) | ✅ 완료 |
| admin.html 대시보드 + Firestore 연동 | ✅ 완료 |
| admin.html 상품관리 (8개 채널 상품번호 연동) | ✅ 완료 |
| admin.html 설정 (PIN 변경) | ✅ 완료 |
| Firestore 자동 백업 시스템 (dev/prod 분리) | ✅ 완료 |

### 2차 (개발 예정) — AI 하자진단 + 영업자료 전달

| 작업 | 상태 |
|------|------|
| Firebase dev 프로젝트 생성 (`pour-app-dev`) | 🔲 월요일 |
| Claude API 키 발급 | 🔲 월요일 |
| Kakao Maps API 키 발급 | 🔲 월요일 |
| .env.dev / .env.prod 파일 작성 | 🔲 월요일 |
| Cloudflare Worker 시크릿 등록 + 백업 Worker 배포 | 🔲 월요일 |
| GitHub Actions Secrets 등록 | 🔲 월요일 |
| claude-proxy.js Worker 개발 | 🔲 대기 |
| admin.html — defect-sites 완공현장 등록 + 사진 업로드 | 🔲 대기 |
| admin.html — sales-docs 영업자료 관리 (시방서·제안서·특허) | 🔲 대기 |
| admin.html — 완공현장 지도 분포도 (Kakao Maps) | 🔲 대기 |
| defect-diagnosis.html — AI 하자진단 태블릿앱 | 🔲 대기 |
| defect-diagnosis.html — 유사현장 검색 + 시공전후 슬라이드 | 🔲 대기 |
| defect-diagnosis.html — 영업자료 즉시 전달 기능 | 🔲 대기 |
| inbound-form.html — 인바운드 셀프진단 웹폼 | 🔲 대기 |
| admin.html 사이트관리 (문의접수 + 수치 + 파트너사) | 🔲 대기 |
| admin.html 영업관리 (4개 브랜드 리드 + 칸반) | 🔲 대기 |
| site-solution.html / site-method.html / site-store.html | 🔲 대기 |

### 3차 (기획 중) — 현장 즉시 견적
| 작업 | 상태 |
|------|------|
| 도면 업로드 → Claude Vision 면적 자동 인식 | 🔲 기획 |
| 공종별 물량 산출 자동 계산 | 🔲 기획 |
| 단가 DB 관리 (어드민) | 🔲 기획 |
| 견적서 PDF 자동 생성 + 즉시 전달 | 🔲 기획 |

---

## 2차 개발 — 월요일 세팅 체크리스트

### 1. Firebase dev 프로젝트 생성
```
1) console.firebase.google.com → 프로젝트 추가
2) 프로젝트명: pour-app-dev
3) Firestore 활성화 (테스트 모드)
4) 서비스 계정 → 새 비공개 키 → JSON 다운로드
5) JSON에서 project_id / client_email / private_key 복사
```

### 2. .env.dev 파일 작성 (로컬, git 커밋 금지)
```bash
cp .env.example .env.dev
# 아래 값 채우기
FIREBASE_PROJECT_ID=pour-app-dev
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GITHUB_TOKEN=ghp_...   # repo write 권한 PAT
GITHUB_REPO=netformrnd-lab/pour-construction-form
```

### 3. Claude API 키 발급
```
console.anthropic.com → API Keys → Create Key
→ .env.dev에 CLAUDE_API_KEY=sk-ant-... 추가
```

### 4. Kakao Maps API 키 발급
```
developers.kakao.com → 앱 만들기 → JavaScript 키 복사
→ .env.dev에 KAKAO_MAP_KEY=... 추가
```

### 5. Cloudflare Worker 배포 (백업 Cron)
```bash
cd workers
npx wrangler secret put GITHUB_TOKEN --config wrangler.backup.toml
npx wrangler secret put WORKER_SECRET --config wrangler.backup.toml
npx wrangler deploy --config wrangler.backup.toml
```

### 6. GitHub Actions Secrets 등록
```
GitHub repo → Settings → Secrets and variables → Actions
추가 항목:
  PROD_FIREBASE_PROJECT_ID    = pour-app-prod
  PROD_FIREBASE_CLIENT_EMAIL  = ...
  PROD_FIREBASE_PRIVATE_KEY   = ...
  DEV_FIREBASE_PROJECT_ID     = pour-app-dev
  DEV_FIREBASE_CLIENT_EMAIL   = ...
  DEV_FIREBASE_PRIVATE_KEY    = ...
  BACKUP_GITHUB_TOKEN         = ghp_... (repo write PAT)
```

### 7. 백업 테스트
```bash
cd backup
npm install
npm run backup:dev   # dev 환경 테스트
# GitHub repo backup/firestore-snapshots 브랜치 확인
```

---

## 인증 고도화 계획 (PIN → 이메일 인증)

> 현재: localStorage PIN (SHA-256) — 기기별 개별 설정, 보안 취약
> 목표: 이메일 인증번호(OTP) 방식으로 전환

### 1단계 (현재): PIN 인증
- localStorage에 SHA-256 해시 저장
- index.html(태블릿앱)과 동일 키 공유
- PIN 변경 기능 (설정 메뉴)

### 2단계 (예정): 이메일 인증번호 방식
```
[로그인 화면]
  ① 관리자 이메일 입력 (사전 등록된 이메일만 허용)
  ② "인증번호 발송" 클릭
  ③ Cloudflare Worker → 이메일 발송 (6자리 OTP, 5분 유효)
  ④ 인증번호 입력 → 검증 → 세션 발급
```

### Firestore 스키마 (추가 예정)
```javascript
// admin-auth/config (단일 문서)
{
  allowedEmails: ["admin@netformrnd.com", "..."],
  otpExpireMinutes: 5,
  maxAttempts: 5,
}

// admin-auth-otp/{email-hash} (OTP 임시 문서)
{
  otpHash: "sha256...",
  expiresAt: "ISO",
  attempts: 0,
  createdAt: "ISO",
}
```

### 주의사항
- Cloudflare Worker에서 OTP 생성/검증 (클라이언트에서 OTP 생성 금지)
- OTP는 반드시 해시로 저장 (평문 저장 금지)
- 5회 실패 시 15분 잠금
- 기존 PIN 인증은 fallback으로 유지 가능 (오프라인 대비)
