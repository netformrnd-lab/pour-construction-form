# PART 4. 스키마 프롬프트 — Firestore 데이터 구조

> pour-app-new 프로젝트의 전체 Firestore 컬렉션 스키마 (기존 + 신규)

---

## §1. 기존 컬렉션 (index.html에서 사용 중)

### `leads` — POUR솔루션 박람회 리드
> 참조: index.html L1868, L4147

```javascript
{
  // 기본 정보
  name: "홍길동",                    // 성함
  phone: "010-1234-5678",           // 연락처
  email: "hong@example.com",        // 이메일 (선택)
  company: "○○건설",                // 업체명
  position: "소장",                  // 직급

  // 상담 정보
  building: "아파트",                // 건물유형 (아파트/관공서/상가/공장/학교/기타)
  day: "4/16(목)",                   // 상담일 (박람회)
  staff: "김대리",                   // 담당자
  problems: ["우레탄방수", "외벽도장"], // 선택한 공법/하자
  actions: ["현장방문", "견적서"],     // 후속 조치

  // 상태 관리
  status: "신규",                    // 신규|연락완료|계약예정|보류|기타
  memo: "3층 옥상 누수",              // 메모 텍스트
  memoImgs: ["data:image/..."],     // 메모 이미지 (base64)

  // 명함
  cardFront: "data:image/...",      // 명함 앞면
  cardBack: "data:image/...",       // 명함 뒷면

  // 메타
  source: "exhibition",             // 유입 경로
  savedAt: "2026-03-31T10:00:00Z",  // 저장 시각 (ISO)
  deletedAt: null                   // soft delete (null = 활성)
}
```

### `leads-store` — POUR스토어 리드
> 참조: index.html L3077, L3346

```javascript
{
  name: "string",
  phone: "string",
  email: "string",
  company: "string",
  position: "string",
  building: "string",
  staff: "string",
  problems: ["string"],
  actions: ["string"],
  status: "신규",          // 신규|연락완료|계약예정|보류|기타
  memo: "string",
  memoImgs: ["string"],
  source: "store",
  savedAt: "ISO",
  deletedAt: null
}
```

### `leads-grohome` — 그로홈 리드
> 참조: index.html L3715

동일 구조 (`leads`와 같음), `source: "grohome"`

### `config/casePhotos` — 시공사례 사진
> 참조: index.html L1094, L1106

```javascript
// 단일 문서 (doc ID: "casePhotos")
{
  "방수_우레탄방수": "https://...",
  "방수_시트방수": "https://...",
  "도장_외벽도장": "https://...",
  // 키: "카테고리_공법명", 값: 이미지 URL
}
```

### `config/probPhotos` — 문제 카드 이미지
> 참조: index.html L1100, L1107

```javascript
// 단일 문서 (doc ID: "probPhotos")
{
  "누수": "https://...",
  "균열": "https://...",
  "박리": "https://...",
  // 키: 문제유형, 값: 이미지 URL
}
```

### `config/staffList` — 담당자 목록
> 참조: index.html L1399, L1403

```javascript
// 단일 문서 (doc ID: "staffList")
{
  list: [
    { name: "김대리", role: "영업", phone: "010-..." },
    { name: "박과장", role: "기술", phone: "010-..." }
  ]
}
```

### `app-config/solapi` — SMS 설정
> 참조: index.html L1426, L1431

```javascript
// 단일 문서 (doc ID: "solapi")
{
  workerUrl: "https://pour-sms.workers.dev",  // Cloudflare Worker URL
  apiKey: "...",                               // Solapi API Key
  apiSecret: "...",                            // Solapi API Secret
  sender: "02-1234-5678"                       // 발신번호
}
```

### `app-config/smsTemplates` — SMS 템플릿
> 참조: index.html L1450, L1455

```javascript
// 단일 문서 (doc ID: "smsTemplates")
{
  customerThank: "[POUR] {name}님, 상담 감사합니다...",
  followUp: "[POUR] {name}님, 견적서를 보내드립니다...",
  // 키: 템플릿 ID, 값: 메시지 본문 ({변수} 치환)
}
```

### `qr-stats` — QR 추적
> 참조: index.html L4080, L4091

```javascript
// 문서 ID = 배너/카탈로그명
{
  label: "배너5",              // 표시명
  url: "https://...",          // QR 타겟 URL
  count: 42                    // 스캔 횟수
}
```

---

## §2. 신규 컬렉션 (admin.html + site-*.html)

### `leads-method` — POUR공법 시공사 리드

```javascript
{
  // 업체 정보
  companyName: "○○건설",           // 업체명
  companyType: "종합건설사",         // 종합건설사|전문건설사|방수업체|기타
  contactName: "김부장",            // 담당자명
  contactPhone: "010-1234-5678",   // 연락처
  contactEmail: "kim@company.com", // 이메일

  // 영업 정보
  channel: "입찰",                  // 입찰|수의계약|하도급|기술제안|인바운드
  projectName: "○○아파트 방수공사",  // 프로젝트명
  estimatedAmount: 50000000,       // 예상 금액
  methods: ["우레탄방수", "시트방수"], // 관련 공법

  // 상태 관리
  status: "신규",                   // 신규|상담중|견적제출|계약예정|계약완료|보류
  bidStatus: null,                  // null|입찰등록|투찰완료|낙찰|유찰
  staff: "박과장",                  // 담당자
  memo: "string",
  activities: [],                   // 활동 기록 ID 배열

  // 메타
  createdAt: "ISO",
  updatedAt: "ISO",
  deletedAt: null
}
```

### `outbound-solution` — POUR솔루션 상시 영업

```javascript
{
  // 타겟 정보
  targetName: "○○아파트",          // 건물/업체명
  targetType: "아파트",             // 건물유형
  contactName: "이소장",            // 의사결정자
  contactPhone: "010-...",
  contactEmail: "string",
  address: "부산시 해운대구...",

  // 영업 정보
  status: "신규",                   // 신규|상담중|견적제출|계약예정|계약완료|보류
  staff: "김대리",
  estimatedAmount: 0,
  methods: [],                      // 관련 공법
  memo: "string",

  // 메타
  source: "outbound",              // outbound|referral|repeat
  createdAt: "ISO",
  updatedAt: "ISO",
  nextContactDate: "2026-04-05",   // 다음 연락 예정일
  deletedAt: null
}
```

### `outbound-method` — POUR공법 상시 영업
`outbound-solution`과 동일 구조, `targetType`이 시공사 유형.

### `outbound-store` — POUR스토어 상시 영업
`outbound-solution`과 동일 구조.

### `outbound-grohome` — 그로홈 상시 영업
`outbound-solution`과 동일 구조.

### `activities` — 영업 활동 기록

```javascript
{
  leadId: "document-id",           // 관련 리드 ID
  leadCollection: "outbound-solution", // 리드가 속한 컬렉션
  type: "전화",                     // 전화|방문|메일|문자|미팅|기타
  content: "현장방문 후 견적 논의",    // 활동 내용
  staff: "김대리",                  // 활동자
  result: "견적서 요청받음",          // 결과
  createdAt: "ISO",
  nextAction: "견적서 발송",         // 다음 액션
  nextDate: "2026-04-01"           // 다음 일정
}
```

### `partner-inquiries` — 파트너사 문의/입점신청

```javascript
{
  // 문의 정보
  type: "파트너사",                  // 파트너사|입점신청
  brand: "solution",                // solution|method|store
  companyName: "○○시공",
  contactName: "김사장",
  contactPhone: "010-...",
  contactEmail: "string",
  businessNumber: "123-45-67890",   // 사업자번호
  region: "부산/경남",              // 활동 지역
  speciality: "방수",               // 전문 분야
  message: "입점 신청합니다",         // 문의 내용

  // 처리 상태
  status: "신규",                    // 신규|검토중|승인|반려|서류제출|계약완료
  assignedStaff: null,              // 담당자
  adminMemo: "",                    // 관리자 메모
  smsHistory: [],                   // SMS 발송 기록

  // 메타
  source: "site-solution",          // 유입 페이지
  createdAt: "ISO",
  updatedAt: "ISO"
}
```

### `dealer-inquiries` — 대리점 문의

```javascript
{
  type: "대리점",                    // 대리점|유통
  brand: "solution",                // solution|method|store
  companyName: "string",
  contactName: "string",
  contactPhone: "string",
  contactEmail: "string",
  businessNumber: "string",
  region: "string",
  message: "string",

  status: "신규",                    // 신규|검토중|승인|반려|계약완료
  assignedStaff: null,
  adminMemo: "",
  createdAt: "ISO",
  updatedAt: "ISO"
}
```

### `site-inquiries` — 일반 문의접수

```javascript
{
  brand: "solution",                // solution|method|store
  name: "string",
  phone: "string",
  email: "string",
  category: "제품문의",              // 제품문의|시공문의|셀프시공|기타
  message: "string",

  status: "신규",                    // 신규|답변완료|보류
  assignedStaff: null,
  reply: "",                        // 답변 내용
  createdAt: "ISO",
  updatedAt: "ISO"
}
```

### `site-metrics` — 공신력 수치

```javascript
// 단일 문서 (doc ID: "current")
{
  totalUnits: 2600000,              // 누적 시공 세대수
  totalUnitsLabel: "260만 세대",     // 표시용 텍스트
  patents: 70,                      // 특허/인증 수
  patentsLabel: "70여 개",
  partners: 250,                    // 파트너사 수
  partnersLabel: "250여 곳",
  totalArea: 1500000,               // 누적 시공 면적 (㎡)
  totalAreaLabel: "150만 ㎡",
  products: 110,                    // 제품 수
  productsLabel: "110여 개+",
  cooperatives: 250,                // 협력사 수
  cooperativesLabel: "250여 곳",

  updatedAt: "ISO",                 // 마지막 수정 시각
  updatedBy: "김대리"                // 수정자
}
```

### `site-resources` — 영업자료/시방서 링크

```javascript
{
  brand: "solution",                // solution|method|store|common
  type: "시방서",                    // 시방서|카탈로그|견적양식|인증서|기타
  title: "우레탄 방수 시방서 v2.1",
  fileUrl: "https://...",           // 파일 URL (Google Drive/클라우드)
  fileSize: "2.4MB",
  description: "string",
  isPublic: true,                   // 사이트 공개 여부
  createdAt: "ISO",
  updatedAt: "ISO"
}
```

### `partner-companies` — 파트너사 관리

```javascript
{
  // 기본 정보
  companyName: "○○시공",
  businessNumber: "123-45-67890",
  representative: "김대표",
  contactPhone: "010-...",
  contactEmail: "string",
  address: "string",
  region: "부산/경남",
  speciality: ["방수", "도장"],

  // 계약 정보
  contractStatus: "활성",            // 대기|활성|만료|해지
  contractDate: "2026-01-15",       // 계약일
  contractExpiry: "2027-01-14",     // 만료일
  grade: "A",                       // 등급 (A/B/C/D)

  // 서류
  documents: {
    businessLicense: { url: "...", uploadedAt: "ISO", verified: true },
    constructionLicense: { url: "...", uploadedAt: "ISO", verified: false },
    // 필요 서류별 업로드 상태
  },

  // 워크플로우
  inquiryId: "partner-inquiries/doc-id",  // 원본 문의 참조
  approvedAt: "ISO",
  approvedBy: "박과장",

  createdAt: "ISO",
  updatedAt: "ISO"
}
```

### `matching-requests` — (추후) 시공매칭 신청

```javascript
{
  // 고객 정보
  customerName: "string",
  customerPhone: "string",
  customerEmail: "string",
  address: "string",

  // 시공 정보
  buildingType: "아파트",
  methods: ["우레탄방수"],
  description: "5층 옥상 누수",
  estimatedBudget: "500만원 이하",
  preferredDate: "2026-04-중",

  // 매칭 결과
  matchedPartners: [
    { partnerId: "doc-id", companyName: "○○시공", score: 95 }
  ],
  selectedPartner: null,

  status: "신청",                    // 신청|매칭중|추천완료|선택완료|시공중|완료
  createdAt: "ISO",
  updatedAt: "ISO"
}
```

---

## §3. 신규 컬렉션 (2차 — defect-diagnosis.html + admin.html)

### `defect-sites` — 완공현장 (AI 유사현장 검색 DB)

> 어드민에서 등록. 영업앱에서 하자사진 촬영 시 유사현장 매칭에 사용.

```javascript
{
  // 현장 기본 정보
  siteName: "○○아파트 옥상방수",     // 현장명
  region: "경기 수원시 영통구",       // 시/구 (지도 표시용)
  address: "경기 수원시 영통구 ...",  // 상세 주소
  lat: 37.2636,                     // 위도 (Kakao Maps 마커)
  lng: 127.0286,                    // 경도
  year: 2024,                       // 시공 연도
  brand: "POUR공법",                 // POUR솔루션|POUR공법|POUR스토어|그로홈
  method: "우레탄방수",               // 적용 공법
  warrantyYears: 10,                 // 보증 기간 (년)

  // 하자 분류 (Claude Vision 태그 기준)
  defectType: "누수",                 // 누수|균열|들뜸|백화|박리|기타
  defectPart: "옥상",                 // 옥상|외벽|지하|발코니|내부|기타
  defectDetail: "슬래브 균열 동반 누수", // 상세 설명
  severity: "중",                    // 경|중|심

  // 사진 (Firebase Storage URL)
  // 파일명 규칙: {연도}_{지역}_{부위}_{하자유형}_{단계}.jpg
  // 예) 2024_수원_옥상_누수_전.jpg
  photos: {
    before: ["https://storage..."],  // 시공 전
    during: ["https://storage..."],  // 시공 중
    after:  ["https://storage..."],  // 시공 후
  },
  thumbnail: "https://storage...",   // 대표 썸네일 (after 중 1장)

  // AI 검색 태그 (Claude Vision이 생성 or 관리자 수동)
  tags: ["누수", "옥상", "균열", "우레탄", "슬래브"],

  // 결과 요약
  resultSummary: "우레탄 방수 전면 재시공, 균열 보수 병행. 10년 무하자 완료.",

  // 메타
  createdAt: "ISO",
  updatedAt: "ISO",
  createdBy: "박과장",
  deleted: false,
  deletedAt: null
}
```

**파일명 네이밍 규칙 (Manus 자동 분류 기준):**
```
{연도}_{지역}_{부위}_{하자유형}_{단계}.jpg
예시:
  2024_수원_옥상_누수_전.jpg
  2024_수원_옥상_누수_중.jpg
  2024_수원_옥상_누수_후.jpg
  2023_서울강동_외벽_균열_전.jpg
```

---

### `sales-docs` — 영업자료 관리 (시방서·제안서·소개서·특허)

> 어드민에서 업로드. 영업앱에서 상담 중 고객에게 즉시 전달.

```javascript
{
  brand: "common",               // common|solution|method|store|grohome
  category: "시방서",             // 시방서|제안서|소개서|특허|인증서|기타
  title: "우레탄 방수 시방서 v2.1",
  description: "우레탄 방수 전 공정 시방 기준서",

  // 파일
  fileUrl: "https://storage...", // Firebase Storage URL
  fileSize: "2.4MB",
  fileType: "pdf",               // pdf|pptx|docx|jpg

  // 전달 설정
  isActive: true,                // 영업앱 노출 여부
  sendMethod: ["sms", "email"],  // 전달 가능 방법

  // 통계
  sendCount: 0,                  // 발송 횟수 (자동 증가)

  // 메타
  createdAt: "ISO",
  updatedAt: "ISO",
  uploadedBy: "김대리",
  deleted: false,
  deletedAt: null
}
```

---

## §4. 컬렉션명 상수 (코드에서 사용)

```javascript
const COLLECTIONS = {
  // 기존 (index.html — 1차, 건드리지 말 것)
  LEADS: 'leads',
  LEADS_STORE: 'leads-store',
  LEADS_GROHOME: 'leads-grohome',
  CONFIG_CASE_PHOTOS: 'config',      // doc: 'casePhotos'
  CONFIG_PROB_PHOTOS: 'config',      // doc: 'probPhotos'
  CONFIG_STAFF: 'config',            // doc: 'staffList'
  APP_SOLAPI: 'app-config',          // doc: 'solapi'
  APP_SMS_TEMPLATES: 'app-config',   // doc: 'smsTemplates'
  QR_STATS: 'qr-stats',

  // 신규 (admin.html + site-*.html — 1차)
  LEADS_METHOD: 'leads-method',
  OUTBOUND_SOLUTION: 'outbound-solution',
  OUTBOUND_METHOD: 'outbound-method',
  OUTBOUND_STORE: 'outbound-store',
  OUTBOUND_GROHOME: 'outbound-grohome',
  ACTIVITIES: 'activities',
  PARTNER_INQUIRIES: 'partner-inquiries',
  DEALER_INQUIRIES: 'dealer-inquiries',
  SITE_INQUIRIES: 'site-inquiries',
  SITE_METRICS: 'site-metrics',      // doc: 'current'
  SITE_RESOURCES: 'site-resources',
  PARTNER_COMPANIES: 'partner-companies',
  MATCHING_REQUESTS: 'matching-requests',

  // 신규 (2차 — AI 하자진단)
  DEFECT_SITES: 'defect-sites',      // 완공현장 DB (AI 유사현장 검색)
  SALES_DOCS: 'sales-docs',          // 영업자료 (시방서·제안서·특허 즉시 전달)
};
```

---

## §5. 상태값 상수

```javascript
// 영업 파이프라인 상태
const LEAD_STATUS = ['신규', '상담중', '견적제출', '계약예정', '계약완료', '보류'];
const LEAD_STATUS_COLOR = {
  '신규': '#2563EB',
  '상담중': '#D97706',
  '견적제출': '#7C3AED',
  '계약예정': '#059669',
  '계약완료': '#10B981',
  '보류': '#9CA3AF'
};

// POUR공법 입찰 상태
const BID_STATUS = ['입찰등록', '투찰완료', '낙찰', '유찰'];

// 문의 처리 상태
const INQUIRY_STATUS = ['신규', '검토중', '승인', '반려', '서류제출', '계약완료'];
const INQUIRY_STATUS_COLOR = {
  '신규': '#DC2626',
  '검토중': '#D97706',
  '승인': '#059669',
  '반려': '#9CA3AF',
  '서류제출': '#7C3AED',
  '계약완료': '#10B981'
};

// 파트너사 계약 상태
const CONTRACT_STATUS = ['대기', '활성', '만료', '해지'];

// 활동 유형
const ACTIVITY_TYPES = ['전화', '방문', '메일', '문자', '미팅', '기타'];

// 하자 분류 (2차 — AI 하자진단)
const DEFECT_TYPES = ['누수', '균열', '들뜸', '백화', '박리', '기타'];
const DEFECT_PARTS = ['옥상', '외벽', '지하', '발코니', '내부', '기타'];
const DEFECT_SEVERITY = ['경', '중', '심'];
const PHOTO_STAGES = ['before', 'during', 'after']; // 시공전|시공중|시공후

// 영업자료 카테고리 (2차)
const SALES_DOC_CATEGORIES = ['시방서', '제안서', '소개서', '특허', '인증서', '기타'];
```
