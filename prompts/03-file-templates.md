# PART 3. 템플릿 프롬프트 — 파일 구조

> 프로젝트 전체 파일 구조, 각 파일의 역할, admin.html 화면 구조, site-*.html 임베드 구조

---

## §1. 프로젝트 파일 구조

```
pour-construction-form/
│
├── CLAUDE.md                  ← 통합 프롬프트 (마스터)
├── prompts/                   ← 서브 프롬프트 폴더
│   ├── 01-business-master.md      PART 1: 사업 설계
│   ├── 02-development-rules.md    PART 2: 개발 원칙
│   ├── 03-file-templates.md       PART 3: 파일 구조 (이 문서)
│   └── 04-firestore-schema.md     PART 4: Firestore 스키마
│
├── index.html                 ← 태블릿 상담앱 (기존, POUR솔루션 박람회)
│   └── React 18 CDN + Babel + Firebase
│   └── 5,300+ 줄, AdminScreen 내장
│   └── Cloudflare Pages 호스팅
│
├── admin.html                 ← 영업관리센터 (신규)
│   └── CRM + 사이트관리 + 영업관리 통합
│   └── 동일 기술스택 (React 18 CDN + Babel + Firebase)
│   └── PIN 인증 (index.html과 공유)
│
├── site-solution.html         ← POUR솔루션 사이트 연동 페이지 (신규)
│   └── 파트너사/대리점 문의 + 공신력 수치
│   └── 아임웹 자사몰에 iframe 임베드
│
├── site-method.html           ← POUR공법 사이트 연동 페이지 (신규)
│   └── 시공사 문의 + 기술제안 + 공신력 수치
│   └── 아임웹 자사몰에 iframe 임베드
│
├── site-store.html            ← POUR스토어 사이트 연동 페이지 (신규)
│   └── 대리점/유통 문의 + 공신력 수치
│   └── 아임웹 자사몰에 iframe 임베드
│
├── worker.js                  ← Cloudflare Worker SMS 프록시 (기존)
│   └── Solapi API 중계
│
├── functions/
│   └── send-sms.js            ← Cloudflare Pages Function (기존)
│
└── poursotre/                 ← 배너/마케팅 자료 (기존)
    ├── index.html                 POUR스토어 쇼케이스 (B2C)
    ├── banner5.html               로고+슬로건 배너 (4500×1500mm)
    ├── banner6.html               제품 홍보 배너
    ├── 흰-로고.png
    ├── 1.배경x_로고.png
    ├── 시공사례.jpg
    ├── 개별 상담 존.png
    ├── 공법 소개 존.png
    ├── 자재 소개 존.png
    └── [ 방수, 보수 자재 ].jpg
```

---

## §2. admin.html 영업관리센터 화면 구조

### 전체 레이아웃
```
┌─────────────────────────────────────────────────────────┐
│  ■ 넷폼알앤디 영업관리센터              [담당자명] [로그아웃] │  ← 헤더 (56px)
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  📊 대시보드   │          메인 콘텐츠 영역                  │
│              │                                          │
│  ── 영업 ──  │                                          │
│  🏢 POUR솔루션 │                                          │
│    ├ 박람회리드 │                                          │
│    └ 아웃바운드 │                                          │
│  🔧 POUR공법  │                                          │
│    ├ 시공사리드 │                                          │
│    └ 아웃바운드 │                                          │
│  🛒 POUR스토어 │                                          │
│  🏠 그로홈     │                                          │
│              │                                          │
│  ── 사이트 ── │                                          │
│  📬 문의접수   │                                          │
│  📊 공신력수치 │                                          │
│  📎 영업자료   │                                          │
│  🏢 파트너사   │                                          │
│              │                                          │
│  ── 공통 ──  │                                          │
│  👥 담당자    │                                          │
│  💬 SMS설정  │                                          │
│  ⚙ 설정      │                                          │
│              │                                          │
│  ── 바로가기 ─ │                                          │
│  📱 태블릿앱   │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  사이드바 260px (접이식)  │  메인 콘텐츠 (flex: 1)          │
└─────────────────────────────────────────────────────────┘
```

### 화면별 상세

#### 1. 대시보드
```
┌──────────────────────────────────────────┐
│  오늘의 리드                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │ 솔루션│ │ 공법 │ │스토어│ │그로홈│            │
│  │  5  │ │  3  │ │  8  │ │  2  │            │
│  └────┘ └────┘ └────┘ └────┘            │
│                                          │
│  파이프라인 요약                             │
│  신규(12) → 상담중(8) → 견적(5) → 계약(3)   │
│                                          │
│  최근 문의접수 (사이트)                       │
│  ┌─ 파트너사 문의 3건 ──────────────┐       │
│  │ ● ○○건설 | 10분 전 | 신규          │       │
│  └────────────────────────────┘       │
│                                          │
│  공신력 수치 현황                            │
│  260만 세대 | 70여 특허 | 250여 파트너사       │
└──────────────────────────────────────────┘
```

#### 2. 영업 리드 관리 (브랜드별)
```
┌──────────────────────────────────────────┐
│  POUR솔루션 > 아웃바운드 영업                 │
│                                          │
│  [+ 신규등록]  [검색...]  [상태▼] [담당자▼]  │
│                                          │
│  ┌─ 칸반 보드 ─────────────────────┐     │
│  │ 신규  │ 상담중 │ 견적  │ 계약예정 │ 완료 │     │
│  │ ┌──┐ │ ┌──┐  │ ┌──┐ │ ┌──┐  │ ┌──┐│     │
│  │ │카드│ │ │카드│  │ │카드│ │ │카드│  │ │카드││     │
│  │ └──┘ │ └──┘  │ └──┘ │ └──┘  │ └──┘│     │
│  └──────────────────────────────┘     │
│                                          │
│  또는 리스트 뷰 (토글)                       │
│  ┌───┬────┬───┬───┬───┬──┐             │
│  │체크│ 업체명 │ 담당│ 상태 │ 연락처│ 날짜│             │
│  ├───┼────┼───┼───┼───┼──┤             │
│  │ ☐ │ ○○건설│ 김대리│ 상담중│ 010-│ 3/31│             │
│  └───┴────┴───┴───┴───┴──┘             │
└──────────────────────────────────────────┘
```

#### 3. 문의접수 관리 (사이트 연동)
```
┌──────────────────────────────────────────┐
│  문의접수 관리                               │
│                                          │
│  [전체] [파트너사] [대리점] [일반]  [검색...]   │
│                                          │
│  ┌───┬────┬────┬───┬────┬──┐           │
│  │상태│ 문의유형│ 업체/성함│ 브랜드│ 접수일  │ 액션│           │
│  ├───┼────┼────┼───┼────┼──┤           │
│  │🔴 │파트너사│ ○○건설 │솔루션│ 3/31 │[상세]│           │
│  │🟡 │대리점 │ △△방수 │공법  │ 3/30 │[상세]│           │
│  │🟢 │파트너사│ □□시공 │스토어│ 3/29 │[상세]│           │
│  └───┴────┴────┴───┴────┴──┘           │
│                                          │
│  상세 드로어 (행 클릭)                       │
│  ┌─────────────────────────┐            │
│  │ 업체명: ○○건설                  │            │
│  │ 문의유형: 파트너사 입점신청         │            │
│  │ 상태: [신규 ▼] → 검토중/승인/계약  │            │
│  │ 담당자: [배정 ▼]                │            │
│  │ [SMS 발송] [메모 추가]          │            │
│  └─────────────────────────┘            │
└──────────────────────────────────────────┘
```

#### 4. 공신력 수치 관리
```
┌──────────────────────────────────────────┐
│  공신력 수치 관리                            │
│  ⓘ 수정 시 3개 사이트(솔루션/공법/스토어)에      │
│    실시간 반영됩니다                          │
│                                          │
│  ┌────────────────────────────┐         │
│  │ 누적 시공 세대수   [2,600,000] 세대 │         │
│  │ 특허/인증 수       [70      ] 여 개  │         │
│  │ 파트너사 수        [250     ] 여 곳  │         │
│  │ 누적 시공 면적     [1,500,000] ㎡    │         │
│  │ 제품 수           [110     ] 여 개+  │         │
│  │ 협력사 수          [250     ] 여 곳  │         │
│  └────────────────────────────┘         │
│                                          │
│  [저장] [미리보기]                           │
│                                          │
│  마지막 수정: 2026-03-31 15:30               │
└──────────────────────────────────────────┘
```

---

## §3. site-*.html 사이트 연동 페이지 구조

### 공통 HTML 템플릿
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{브랜드명} — 넷폼알앤디</title>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <style>
    /* 브랜드 컬러 CSS 변수 */
    :root { --brand: {브랜드 주요색}; --navy: #0D1B2A; }
  </style>
</head>
<body>
  <!-- 1. 공신력 수치 위젯 -->
  <section id="metrics-widget"></section>

  <!-- 2. 문의 폼 -->
  <section id="inquiry-form"></section>

  <script>
    firebase.initializeApp({/* pour-exhibition config */});
    const db = firebase.firestore();

    // 공신력 수치 실시간 표출
    db.collection('site-metrics').doc('current').onSnapshot(doc => {
      if (doc.exists) renderMetrics(doc.data());
    });

    // 문의 폼 제출 → Firestore 저장
    async function submitInquiry(data) {
      await db.collection('{컬렉션명}').add({
        ...data,
        brand: '{브랜드코드}',
        status: '신규',
        createdAt: new Date().toISOString()
      });
    }
  </script>
</body>
</html>
```

### 아임웹 임베드 방법
```html
<!-- 아임웹 사이트에서 HTML 위젯으로 삽입 -->
<iframe
  src="https://{호스팅주소}/site-solution.html"
  width="100%"
  height="800"
  frameborder="0"
  style="border:none; border-radius:12px;">
</iframe>

<!-- 또는 특정 섹션만 임베드 (URL 파라미터) -->
<iframe src="https://{호스팅주소}/site-solution.html?section=metrics" ...></iframe>
<iframe src="https://{호스팅주소}/site-solution.html?section=inquiry" ...></iframe>
```

---

## §4. 기존 코드 재사용 매핑

| 재사용 패턴 | index.html 위치 | 재사용처 |
|------------|----------------|---------|
| Firebase 초기화 | L22-30 | 전체 파일 |
| CSS :root 변수 | L38-57 | admin.html 디자인 시스템 |
| PIN 인증 (SHA-256) | `hashPin()` L1392, `PinModal` L4984-5027 | admin.html 인증 |
| Firestore CRUD | `syncFromFirestore` 패턴 L1103-1118 | 데이터 로드/저장 |
| 테이블 필터/정렬/CSV | AdminScreen list 탭 L4160-4170 | 리드 관리 테이블 |
| SmsToast 알림 | `SmsToast` L1500-1511 | 전역 알림 |
| SMS 발송 | `sendSMS()` L1469-1481 | 승인 시 문자 발송 |
| PhotoSlot 이미지 | `PhotoSlot` L4017-4073 | 영업자료 이미지 |

---

## §5. 호스팅 구조

```
Cloudflare Pages
├── / → index.html (태블릿 상담앱)
├── /admin → admin.html (영업관리센터)
├── /site-solution → site-solution.html
├── /site-method → site-method.html
├── /site-store → site-store.html
└── /poursotre/ → poursotre/index.html (스토어 쇼케이스)
```

### Cloudflare Pages 라우팅
기존 Cloudflare Pages 설정 유지. 새 HTML 파일은 자동으로 라우팅됨.
`/admin` → `admin.html`, `/site-solution` → `site-solution.html` 등.
