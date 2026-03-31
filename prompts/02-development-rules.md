# PART 2. 개발 프롬프트 — 코딩 원칙

> 넷폼알앤디 프로젝트의 기술 스택, 코딩 규칙, 에러 방지 패턴, 재사용 컴포넌트 가이드

---

## §1. 기술 스택 (변경 금지)

### CDN 의존성
```html
<!-- React 18 (production) -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

<!-- Babel (JSX 변환) -->
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<!-- Firebase 10.12.0 compat -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
```

### Firebase 프로젝트 설정
```javascript
// 프로젝트: pour-exhibition (변경 금지)
firebase.initializeApp({
  apiKey: "AIzaSyCBGjGzaTTyIwBs_a8355KfFKaWabJT3ac",
  authDomain: "pour-exhibition.firebaseapp.com",
  projectId: "pour-exhibition",
  storageBucket: "pour-exhibition.firebasestorage.app",
  messagingSenderId: "881527274265",
  appId: "1:881527274265:web:0caad9688e30beb1ea6388"
});
const db = firebase.firestore();
```

### 폰트
```html
<!-- 메인 앱/관리센터: Pretendard -->
<link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

<!-- POUR스토어 쇼케이스: Noto Sans KR -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
```

### 아키텍처 원칙
- **단일 HTML 파일 패턴** — 각 페이지는 하나의 HTML 파일로 완결
- **서버 없음** — 정적 호스팅 (Cloudflare Pages)
- **빌드 도구 없음** — CDN 기반 런타임 변환
- **인라인 CSS** — style 태그 또는 인라인 style 속성
- **React hooks** — useState, useEffect, useRef (클래스 컴포넌트 사용 금지)

---

## §2. CSS 디자인 시스템

### 메인 앱 (index.html, admin.html) — 토스 스타일
```css
:root {
  /* 브랜드 코어 */
  --navy: #0D1B2A;
  --navy2: #1A2E42;

  /* 액센트 (주요 액션 컬러) */
  --accent: #2563EB;
  --accent-s: #1E40AF;       /* hover/active */
  --accent-l: #EFF6FF;       /* 배경 tint */
  --blue: #2563EB;
  --blue-l: #EFF6FF;
  --blue-m: #BFDBFE;

  /* 세컨더리 */
  --gold: #D97706;
  --green: #059669;
  --green-l: #ECFDF5;
  --red: #DC2626;
  --orange: #EA580C;
  --purple: #6D28D9;
  --purple-l: #F5F3FF;
  --purple-m: #EDE9FE;

  /* 텍스트 위계 (명도 차이) */
  --text: #111827;           /* 주요 텍스트 */
  --text-md: #4B5563;        /* 보조 텍스트 */
  --text-sm: #9CA3AF;        /* 비활성/힌트 */

  /* 배경 */
  --bg: #F9FAFB;
  --card: #FFFFFF;
  --border: #E5E7EB;
  --border-s: #F3F4F6;

  /* 레이아웃 */
  --r: 12px;
  --r-sm: 8px;
  --r-lg: 18px;
  --shadow: 0 1px 6px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04);
  --shadow-lg: 0 8px 32px rgba(0,0,0,.12);
}
```

### POUR스토어 쇼케이스 (poursotre/) — 따뜻한 오렌지 테마
```css
:root {
  --or: #E8780F;
  --or2: #F49A3A;
  --or-pale: rgba(232,120,15,0.08);
  --navy: #0F1F5C;
  --ink: #111827;
  --ink2: #374151;
  --muted: #6B7280;
  --light: #F9F7F4;
  --green: #03C75A;          /* 네이버 그린 (CTA) */
}
```

### 브랜드별 컬러 가이드
| 브랜드 | 주요색 | 보조색 | 용도 |
|--------|--------|--------|------|
| POUR솔루션 | `#2563EB` (블루) | `#0D1B2A` (네이비) | 신뢰, 전문성 |
| POUR공법 | `#E8780F` (오렌지) | `#0F1F5C` (네이비) | 기술력, 에너지 |
| POUR스토어 | `#059669` (그린) | `#0D1B2A` (네이비) | 접근성, 성장 |
| 그로홈 | `#6D28D9` (퍼플) | `#0D1B2A` (네이비) | 라이프스타일 |

---

## §3. 에러 방지 5대 규칙

### 규칙 A: 에러를 삼키지 마라
```javascript
// ❌ BAD — catch에서 빈 배열 반환 → 에러인지 진짜 빈 건지 구분 불가
try {
  const snap = await db.collection('leads').get();
  return snap.docs.map(d => ({id: d.id, ...d.data()}));
} catch(e) { return []; }

// ✅ GOOD — 에러를 명시적으로 처리
try {
  const snap = await db.collection('leads').get();
  console.log(`[leads] ${snap.size}건 로드`);
  return snap.docs.map(d => ({id: d.id, ...d.data()}));
} catch(e) {
  console.error('[leads] 로드 실패:', e);
  throw e; // 또는 UI에 에러 상태 표시
}
```

### 규칙 B: 빈 결과는 의심하라
```javascript
// ✅ 항상 건수를 로그에 남겨라
const snap = await db.collection('partner-inquiries').get();
console.log(`[partner-inquiries] ${snap.size}건`); // 0건이면 컬렉션명 오타 의심
```

### 규칙 C: Firestore orderBy 사용 금지
```javascript
// ❌ BAD — 인덱스 없으면 에러, 복합 쿼리 시 인덱스 필요
db.collection('leads').orderBy('savedAt', 'desc').get()

// ✅ GOOD — 전체 가져온 후 클라이언트에서 정렬
const snap = await db.collection('leads').get();
const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
docs.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
```

> 주의: 기존 index.html에서 `orderBy`를 사용하는 곳이 있으나 (leads, qr-stats),
> 신규 코드에서는 클라이언트 정렬을 기본으로 한다. 기존 코드는 이미 인덱스가 생성되어 있으므로 수정하지 않는다.

### 규칙 D: 컬렉션명 오타 주의
```javascript
// Firestore는 존재하지 않는 컬렉션을 쿼리해도 에러를 던지지 않음
// 빈 스냅샷(size: 0)을 반환할 뿐 → 오타를 알 수 없음

// ✅ 컬렉션명을 상수로 관리
const COLLECTIONS = {
  LEADS: 'leads',
  LEADS_STORE: 'leads-store',
  LEADS_GROHOME: 'leads-grohome',
  LEADS_METHOD: 'leads-method',
  PARTNER_INQUIRIES: 'partner-inquiries',
  DEALER_INQUIRIES: 'dealer-inquiries',
  SITE_METRICS: 'site-metrics',
  // ... (04-firestore-schema.md 참조)
};
```

### 규칙 E: Firebase 보안규칙 변경 금지
- 현재 보안규칙은 프로덕션 운영 중이므로 절대 변경하지 않음
- 새 컬렉션은 기존 규칙 범위 내에서 사용
- 규칙 변경이 필요한 경우 반드시 사전 협의

---

## §4. 재사용 패턴 (index.html 참조)

### PIN 인증 (SHA-256)
```javascript
// index.html L1391-1394
const ADMIN_PIN_KEY = 'pourAdminPin';
const hashPin = async (pin) => {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};
const loadAdminPin = () => localStorage.getItem(ADMIN_PIN_KEY);
const saveAdminPin = (hash) => localStorage.setItem(ADMIN_PIN_KEY, hash);
```
- admin.html에서 동일 키(`pourAdminPin`) 사용 → index.html과 PIN 공유
- PinModal 컴포넌트: L4984-5027 (setup/verify 모드, 3회 실패 30초 잠금)

### Firestore 데이터 로딩 패턴
```javascript
// 기본 패턴: Promise.all + localStorage 캐시 + Firestore 동기화
const syncFromFirestore = async (setData) => {
  try {
    const snap = await db.collection('컬렉션명').get();
    const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log(`[컬렉션명] ${docs.length}건 로드`);
    setData(docs);
  } catch(e) {
    console.error('[컬렉션명] 로드 실패:', e);
  }
};
```

### SMS 발송 (Solapi + Cloudflare Worker)
```javascript
// index.html L1469-1481
async function sendSMS(to, text) {
  const cfg = loadSolapiConfig();
  if (!cfg.workerUrl) return {success: false, error: 'Worker URL 미설정'};
  const res = await fetch(cfg.workerUrl.replace(/\/$/, '') + '/send-sms', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      to: to.replace(/[^0-9]/g, ''),
      text,
      apiKey: cfg.apiKey,
      apiSecret: cfg.apiSecret,
      sender: cfg.sender
    })
  });
  const json = await res.json();
  return res.ok ? {success: true, data: json} : {success: false, error: json.error || '발송실패'};
}
```

### 토스트 알림
```javascript
// index.html L1500-1511
function SmsToast({message, type, onDone}) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
      padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 700,
      background: type === 'success' ? '#059669' : '#DC2626', color: '#fff',
      boxShadow: '0 6px 24px rgba(0,0,0,.25)', whiteSpace: 'nowrap',
      animation: 'toastIn .25s ease'
    }}>
      {type === 'success' ? '✅' : '❌'} {message}
    </div>
  );
}

// 사용법
const [toast, setToast] = useState(null);
// 표시: setToast({msg: '저장 완료', type: 'success'});
// 렌더: {toast && <SmsToast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
```

### 탭 네비게이션 패턴
```javascript
// Array of [key, label] → map으로 렌더링
const [tab, setTab] = useState('dashboard');
{TABS.map(([k, label]) => (
  <button key={k} onClick={() => setTab(k)}
    style={{
      flex: 1, padding: '12px 0', background: 'none', border: 'none',
      color: tab === k ? '#fff' : 'rgba(255,255,255,.4)',
      fontSize: 13, fontWeight: tab === k ? 800 : 600,
      borderBottom: tab === k ? '2px solid #60A5FA' : '2px solid transparent'
    }}>
    {label}
  </button>
))}
```

---

## §5. 코딩 컨벤션

### 인라인 스타일 규칙
- 모든 스타일은 `style={{}}` 인라인으로 작성
- CSS 변수 참조: `var(--accent)` 형태
- 반복되는 스타일은 JS 객체로 추출
```javascript
const btnStyle = {padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer'};
```

### 상태 관리
- `useState` + `useEffect` 기본
- 복잡한 상태는 `useReducer` 사용 가능
- Context API 사용하지 않음 (단일 파일이므로 props 전달)

### 네이밍
- 컴포넌트: PascalCase (`ProductTable`, `SmsToast`)
- 함수/변수: camelCase (`sendSMS`, `loadAdminPin`)
- 상수: UPPER_SNAKE_CASE (`ADMIN_PIN_KEY`, `COLLECTIONS`)
- Firestore 컬렉션: kebab-case (`partner-inquiries`, `site-metrics`)

### 한국어 사용
- UI 텍스트: 한국어
- 코드 변수/함수명: 영어
- 주석: 한국어 허용 (간결하게)
- 커밋 메시지: 한국어 또는 영어 (일관성 유지)
