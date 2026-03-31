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
| 2 | admin.html 뼈대 (사이드바 + 라우팅 + PIN) | 🔲 대기 |
| 3 | admin.html 대시보드 + Firestore 연동 | 🔲 대기 |
| 4 | admin.html 사이트관리 (문의접수 + 수치 + 파트너사) | 🔲 대기 |
| 5 | admin.html 영업관리 (4개 브랜드 리드 + 칸반) | 🔲 대기 |
| 6 | admin.html 공통 (담당자 + SMS + 설정) | 🔲 대기 |
| 7 | site-solution.html (문의폼 + 수치 위젯) | 🔲 대기 |
| 8 | site-method.html (시공사 문의 + 수치) | 🔲 대기 |
| 9 | site-store.html (대리점 문의 + 수치) | 🔲 대기 |
| 10 | index.html 연동 (관리센터 바로가기 링크) | 🔲 대기 |
