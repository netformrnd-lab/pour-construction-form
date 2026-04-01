# 넷폼알앤디 통합 프로젝트 프롬프트 v1.0

> 건축물 유지보수 전문 기업 **넷폼알앤디(NetformR&D)**의 전체 세계관, 개발 원칙, 데이터 구조를 담은 마스터 프롬프트.
> 4개 브랜드(POUR솔루션, POUR공법, POUR스토어, 그로홈)를 통합 관리하는 프로젝트.

---

## 프롬프트 구조

| PART | 파일 | 내용 |
|------|------|------|
| **1. 사업 설계** | [prompts/01-business-master.md](prompts/01-business-master.md) | 회사 구조, 브랜드 세계관, 영업 파이프라인, 사이트 운영 |
| **2. 개발 원칙** | [prompts/02-development-rules.md](prompts/02-development-rules.md) | 기술 스택, CSS 디자인 시스템, 에러 방지 규칙, 재사용 패턴 |
| **3. 파일 구조** | [prompts/03-file-templates.md](prompts/03-file-templates.md) | 프로젝트 파일 구조, 화면 설계, 임베드 구조, 호스팅 |
| **4. Firestore 스키마** | [prompts/04-firestore-schema.md](prompts/04-firestore-schema.md) | 기존 9개 + 신규 13개 컬렉션 스키마, 상태값 상수 |

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
- **Firebase 10.12.0** compat — 프로젝트: `pour-exhibition`
- **Cloudflare Pages** 호스팅
- **단일 HTML 파일** 패턴 (빌드 도구 없음)
- **Pretendard** 폰트, CSS 변수 (`:root` 토스 스타일)

### 파일 구조
```
pour-construction-form/
├── CLAUDE.md              ← 이 파일 (마스터 프롬프트)
├── prompts/               ← 서브 프롬프트 4개
├── index.html             ← 태블릿 상담앱 (기존, 5,300+줄)
├── admin.html             ← 영업관리센터 (신규)
├── site-solution.html     ← POUR솔루션 사이트 연동 (신규)
├── site-method.html       ← POUR공법 사이트 연동 (신규)
├── site-store.html        ← POUR스토어 사이트 연동 (신규)
├── worker.js              ← SMS 프록시 (기존)
├── functions/send-sms.js  ← Cloudflare Pages Function (기존)
└── poursotre/             ← 배너/마케팅 자료 (기존)
```

### 핵심 규칙 5가지
1. **에러를 삼키지 마라** — catch에서 빈 배열 반환 금지
2. **빈 결과는 의심하라** — console.log 건수 필수
3. **Firestore orderBy 금지** — 클라이언트 정렬 사용
4. **컬렉션명 오타 주의** — 빈 스냅샷은 에러가 아님
5. **Firebase 보안규칙 변경 금지**

### 영업 파이프라인
```
공통:    신규 → 상담중 → 견적제출 → 계약예정 → 계약완료
POUR공법: 입찰등록 → 투찰완료 → 낙찰/유찰
```

### Firestore 컬렉션 (총 22개)
**기존 9개:** `leads`, `leads-store`, `leads-grohome`, `config/*`, `app-config/*`, `qr-stats`
**신규 13개:** `leads-method`, `outbound-*` (4개), `activities`, `partner-inquiries`, `dealer-inquiries`, `site-inquiries`, `site-metrics`, `site-resources`, `partner-companies`, `matching-requests`

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

## 구현 로드맵

| 순서 | 작업 | 상태 |
|------|------|------|
| 1 | CLAUDE.md + prompts/ 서브 프롬프트 | ✅ 완료 |
| 2 | admin.html 뼈대 (사이드바 + 라우팅 + PIN) | ✅ 완료 |
| 3 | admin.html 대시보드 + Firestore 연동 | ✅ 완료 |
| 3-1 | admin.html 상품관리 (8개 채널 상품번호 연동) | ✅ 완료 |
| 3-2 | admin.html 설정 (PIN 변경) | ✅ 완료 |
| 4 | admin.html 사이트관리 (문의접수 + 수치 + 파트너사) | 🔲 대기 |
| 5 | admin.html 영업관리 (4개 브랜드 리드 + 칸반) | 🔲 대기 |
| 6 | admin.html 공통 (담당자 + SMS + 설정) | 🔲 대기 |
| 7 | site-solution.html (문의폼 + 수치 위젯) | 🔲 대기 |
| 8 | site-method.html (시공사 문의 + 수치) | 🔲 대기 |
| 9 | site-store.html (대리점 문의 + 수치) | 🔲 대기 |
| 10 | index.html 연동 (관리센터 바로가기 링크) | 🔲 대기 |
| 11 | 관리센터 인증 고도화 (이메일 인증) | 🔲 대기 |

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

### 기술 구현 방향
```
인증 흐름:
[admin.html] → POST /auth/send-otp → [Cloudflare Worker]
                                          │
                                    Firestore에 OTP 저장
                                    (해시, 만료시각, 시도횟수)
                                          │
                                    이메일 발송 (Resend/SendGrid/Solapi)
                                          │
[admin.html] → POST /auth/verify-otp → [Cloudflare Worker]
                                          │
                                    OTP 검증 → JWT/세션토큰 반환
                                          │
[admin.html] → sessionStorage에 토큰 저장 → 인증 완료
```

### Firestore 스키마 (추가 예정)
```javascript
// admin-auth/config (단일 문서)
{
  allowedEmails: ["admin@netformrnd.com", "..."],  // 허용 이메일 목록
  otpExpireMinutes: 5,
  maxAttempts: 5,
}

// admin-auth-otp/{email-hash} (OTP 임시 문서)
{
  otpHash: "sha256...",        // OTP 해시
  expiresAt: "ISO",            // 만료 시각
  attempts: 0,                 // 시도 횟수
  createdAt: "ISO",
}
```

### 주의사항
- Cloudflare Worker에서 OTP 생성/검증 (클라이언트에서 OTP 생성 금지)
- OTP는 반드시 해시로 저장 (평문 저장 금지)
- 5회 실패 시 15분 잠금
- 기존 PIN 인증은 fallback으로 유지 가능 (오프라인 대비)
