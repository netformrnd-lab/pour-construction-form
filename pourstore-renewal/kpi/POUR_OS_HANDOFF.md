# POUR OS — 개발 인수인계 문서

> **현재 버전**: v21 (단일 HTML 파일 / `pour-os-v21.html`)
> **목적**: 클로드 코드(claude-code)로 인수해 향후 작업 진행
> **작성일**: 2026-05-12

---

## 0. 우선 해결 (CRITICAL — 클로드 코드에 부탁)

**문제**: 새 컴퓨터/브라우저에서 HTML 다운로드 후 열면 **KPI·OKR이 안 보임**.

**원인**:
- 시드 데이터(`POUR_SEED_DATA`)는 HTML 안에 임베드되어 있지만, `seedOKRIfFresh()`가 비활성화됨 (v12에서 의도적 disable)
- 시드 적용 트리거는 두 가지뿐:
  1. **마이그레이션 모달** — `LEGACY_KEYS` 중 하나라도 localStorage에 있을 때만 (`pour-os-v5` ~ `pour-os-v20`)
  2. **m1 첫 진입 시 자동 시드** — KPI(`seedKpisIfFresh`)와 반복업무(`seedRecurringIfFresh`)만 호출됨. v12 트리 시드는 비활성화

→ 새 사용자는 LEGACY 키 없음 → 마이그레이션 모달 안 뜸 → v12 트리 시드 안 됨

**해결 방안**:
- `selectMember('m1')` 시점에 `state.objectives.length === 0`이면 자동으로 v12 트리 시드
- 또는 첫 진입 시 "샘플 데이터로 시작" / "빈 상태로 시작" 선택 모달 표시
- `seedOKRIfFresh()` 함수는 이미 코드에 존재하지만 호출이 막혀 있음. 활성화하면 됨

```js
// pour-os-v21.html 에서 selectMember 내부
function selectMember(id) {
  state.currentMember = id;
  if (id === 'm1') {
    seedKpisIfFresh();
    seedRecurringIfFresh();
    // 👇 추가 필요
    if (!state.objectives || state.objectives.length === 0) {
      seedOKRIfFresh();
    }
  }
  saveState();
  navigate('dashboard');
}
```

---

## 1. 프로젝트 개요

### 1.1 비즈니스 컨텍스트
- **회사**: 넷폼알앤디 (Netform R&D) — 모회사
- **브랜드 4종**:
  - POUR솔루션 (B2B 컨설팅/시공)
  - POUR공법 (B2B 기술 자재 공급)
  - **POUR스토어** (B2C/B2B 자가시공 자재 리테일) — 메인
  - 그로홈 (홈인테리어 라이프스타일)
- **팀 규모**: 대표 + 마케팅 + 영업 = 3명
- **인증**: 국토교통부 건설신기술 제1026호
- **개발 파트너**: 강남제비스코, 서울과학기술대학교

### 1.2 POUR OS의 정체
**작은 팀 전체 운영 시스템** — Notion·Asana 없이 단일 HTML로 모두 처리.

핵심:
- 대시보드 (주간 업무 배치)
- 통합 캘린더 (업무·일정·고객 이벤트·프로젝트)
- 회의록 (액션 → task 자동 동기화)
- 반복업무 (엑셀 방식 + 대시보드 고정 표시 토글)
- 매뉴얼 (1938개 SOP 항목)
- OKR/KR/KPI 4단 트리
- 프로젝트 진척도
- 주간 보고서 (전사·개인)
- 전략 체계 페이지 (자동 갱신)

### 1.3 통합 계획
POUR OS는 별도 도메인이 아닌, **어드민센터 안 "전략 실행" 메뉴**로 임베드 예정.
- 어드민센터: 회원·매출·CRM·POUR OS 통합 운영 콘솔
- 어드민센터 개발 진행 중

---

## 2. 멤버 구성

| ID | 이름 | 역할 | 색상 | 이니셜 |
|---|---|---|---|---|
| `m1` | 대표 | 전략/기획 | `#e8632a` (주황) | 대 |
| `m2` | 마케팅 | 마케팅 | `#3b82f6` (파랑) | 마 |
| `m3` | 영업 | 영업 | `#22c55e` (초록) | 영 |

---

## 3. 데이터 모델 (state)

```javascript
state = {
  // 멤버 관리
  currentMember: 'm1',  // 현재 로그인 멤버 ID
  members: [
    { id: 'm1', name: '대표', role: '전략/기획', color: '#e8632a', initial: '대' },
    { id: 'm2', name: '마케팅', role: '마케팅', color: '#3b82f6', initial: '마' },
    { id: 'm3', name: '영업', role: '영업', color: '#22c55e', initial: '영' }
  ],

  // OKR 4단 트리 (v12)
  objectives: [
    // { id, memberId, title, year, target, current, unit, description }
  ],
  keyResults: [
    // { id, objectiveId, title, target, current, unit, channel('inbound'|'outbound'|'ops'), description }
  ],
  kpis: [
    // { id, memberId, keyResultId, name, target, baseline, unit,
    //   source('auto'|'auto-progress'|'manual'), current, history, description }
  ],
  projects: [
    // { id, memberId, kpiId, contribution, name, category, status, progress,
    //   ownerId, collaboratorIds: [], description, dueDate, linkedMeetingId? }
  ],

  // 일상 업무
  tasks: [
    // { id, memberId, title, done, doneAt?, projectId, priority,
    //   weekDay, recurringId?, performedDate?, originalAssignee?,  // 대무용
    //   time?, dueDate?, isFixed, notes: [], attachments: [],
    //   linkedMeetingId?, linkedActionItemId?, pulledToday?, status }
  ],
  recurringTasks: [
    // { id, memberId, assignees: 'all' | ['m1','m2'] | 'm1', title,
    //   recurType('daily'|'weekly'|'monthly'),
    //   weekDay?(월~일), monthDay?(1-31 또는 'last'),
    //   time, priority, projectId, pinned: bool (v21: 대시보드 고정),
    //   description, active, createdAt }
  ],

  // 회의 + 일정 + 고객 이벤트
  meetings: [
    // { id, memberId, title, date, time, type, place, agenda,
    //   attendees: [], actionItems: [
    //     { id, text, assignee, dueDate, priority, done,
    //       linkedTaskId?, linkedProjectId?  // task와 자동 동기화
    //     }
    //   ], createdAt }
  ],
  scheduleEvents: [
    // { id, title, date, time, type, color, memberId }
    // 박람회, 외부 약속 등 자유 일정
  ],
  customerEvents: [
    // { id, customerType('B2C'|'B2B'), eventKind, title, startDate, endDate?, time,
    //   status('기획'|'진행 중'|'완료'|'취소'), ownerId, channels: [],
    //   target, expectedReach?, budget?, notes, attachments, createdAt }
  ],

  // 기타
  journals: [],       // 일지
  fixedTasks: [],     // 사용 안 함 (deprecated, tasks 안의 isFixed 사용)
  apiKey: ''          // Claude API 키 (선택)
}
```

### 3.1 KPI 산출 방식 (`source` 필드)

| `source` | 산출 방식 | 사용처 예시 |
|---|---|---|
| `auto` | `baseline + Σ(contribution × progress / 100)` | SKU 30개, 위탁 20곳 (count-based) |
| `auto-progress` | 연결된 프로젝트들의 progress 평균 (%) | 운영 시스템 완성도 |
| `manual` | 직접 입력 | 매출, 전환율 (외부 지표) |

### 3.2 활동 점수 (Activity Score)

```js
Score = 생성 task × 1 + 완료 task × 3 + 메모 × 1 + 첨부 × 1
calcActivityScore(memberId, projectId, fromDate, toDate)
buildContributionMatrix(fromDate, toDate)
```

---

## 4. 시드 데이터 (JSON)

> **별도 파일 첨부**:
> - `seed-okr-v12.json` — Objectives 2개, KRs 3개, KPIs 9개, Projects 17개
> - `seed-recurring.json` — 반복업무 15개
> - `seed-manual.json` — 매뉴얼 23 카테고리 / 1938 항목

### 4.1 OKR 트리 요약

**O1. 2026년 매출 10억 달성**
- KR1. 인바운드 판매 7억
  - KPI: SKU 증식 30개 (baseline 24) [auto]
    - 프로젝트: 코트재 파생 (8), 탑코트재 파생 (8), 써밋페인트 파생 (5), 상품 콘텐츠 패키지 (셋업)
  - KPI: 위탁판매 20곳 (baseline 0) [auto]
    - 프로젝트: 스마트스토어 개설 프로세스 구축 (셋업)
  - KPI: 전문시공인 콘텐츠 12건 [auto]
    - 프로젝트: 콘텐츠 정책 (셋업), 공구로운생활 협업
  - KPI: 자사몰 전환율 5% [manual]
    - 프로젝트: 카페24 리뉴얼, POUR 길잡이, CRM 센터, 자사몰 포스팅
- KR2. 아웃바운드 판매 6억
  - KPI: 오프라인 입점 12곳 [auto]
    - 프로젝트: 대리점 정책 (셋업), 대리점 수원점
  - KPI: 파트너사 매칭 50건 [manual]
    - 프로젝트: 파트너사 자동매칭 시스템

**O2. 2026년 운영 시스템 완성**
- KR3. 핵심 운영 시스템 3종 평균 완성도 100%
  - KPI: 매출관리 [auto-progress] → 매출관리 시스템 개발
  - KPI: 매뉴얼 정리율 [auto-progress] → 업무 매뉴얼 제작·관리
  - KPI: 어드민센터 완성도 [auto-progress] → 어드민센터 개발

총: O 2개 / KR 3개 / KPI 9개 / Project 17개

### 4.2 반복업무 요약 (15개)

**매일 (6)** - 모두 m1 담당
- 09:00 CS 확인 (이메일·채널톡·카톡·문자·게시판)
- 09:00 주문 확인
- 13:30 주문 마감 및 발주 처리
- 14:00 CS 확인 2차
- 17:00 출고 및 송장번호 확인
- 17:15 금일 주문내역 공유 (잔디)

**매주 (4)**
- 월 09:30 저번 주 리뷰 + 이번 주 보고 (10분) — 전체
- 금 17:00 금주 업무 정리 + KPI 수동 기재 — 전체
- 금 17:30 금주 매출 엑셀 등록 — m1
- 금 18:00 금주 상담 데이터 보고 — m1

**매월 (5)**
- 1일 10:00 한진택배 계산서 발급 — m1
- 5일 10:00 고정지출 폼 입력 — m1
- 25일 10:00 세이고 정산 확인 — m1
- 25일 14:00 나비엠알오·제비스코 등 위탁판매 정산 — m1
- 말일 17:00 전시장 청소 — 전체 (오산 쇼룸)

---

## 5. 핵심 기능 명세

### 5.1 대시보드 (`renderDashboard`)
- **주간 업무 배치** — 월~금, 각 요일당 5개 슬롯 (클릭 → 미완료 task 선택)
- **오늘 업무** — 표 형식 (제목·프로젝트·우선순위·마감·첨부·완료일·상태)
- **고정 업무** — `state.tasks` 중 `isFixed: true` (v21에서 `recurringTasks.pinned` 자동 동기화)
- **진행 프로젝트** — 진행률 표시
- **이번 주 KPI** — 단기 목표 4개 카드
- **헤더 버튼**: "🔁 반복업무" / "+ 오늘 업무 추가"

### 5.2 통합 캘린더 (`renderUnifiedCalendar`)
3개 뷰 모드:
- **📅 월간** — 그리드 (셀 110px 고정, table-layout: fixed)
- **📋 리스트** — 날짜별 그룹 + 오늘 배지
- **📊 통계** — 종류별 카드 + 고객 이벤트 상태별 + 전체 일정

필터 4종:
- ⚠ 업무 마감 (빨강) — `state.tasks` 중 dueDate 있음
- 📅 회의·약속 (파랑) — `scheduleEvents` + `meetings`
- 🎁 고객 이벤트 (B2C 분홍 / B2B 보라) — `customerEvents`
- 🎯 프로젝트 (보라) — `projects.dueDate`

추가 메뉴: 일정·약속 / 회의록 / 고객 이벤트 3종 선택

### 5.3 회의록 + 액션 자동 동기화 (v20 핵심)
- 회의 저장 시 액션 아이템 → 자동으로 task 생성 (`linkedMeetingId`, `linkedTaskId`)
- 액션에 "📁 프로젝트로 승격" 체크 시 → task 대신 새 프로젝트 생성
- 액션 체크 → 연결 task의 `done`도 동기화
- 회의록 카드에 액션마다 📌업무 또는 📁프로젝트 배지 표시

### 5.4 반복업무 (v20-21 핵심)
- **엑셀 방식 표** — 우선순위 / 담당 / 주기 / 요일·일자 / 시간 / 업무 내용 / 프로젝트 / 📌 / 액션
- **빠른 추가 행** — 하단에 인라인 입력 (Enter 키 즉시 추가)
- **📌 토글** — 대시보드 우측 "고정업무" 영역 표시 여부
- **정렬**: 주기(매주→매월→매일) + 시간
- **자동 인스턴스 생성** — `generateRecurringForToday()`:
  - 매일: 매일 새 인스턴스
  - 매주: 해당 요일에 새 인스턴스
  - 매월: 해당 일자(또는 마지막 날)에 새 인스턴스
  - `pinned=true`인 반복업무 인스턴스 → `task.isFixed=true` 자동 설정
  - dedup: `recurringId + performedDate + memberId`

### 5.5 매뉴얼
- 그리드 모드 (23 카테고리 카드)
- 검색 모드 (전체에서 키워드 매칭)
- 상세 모드 (카테고리 클릭 → 번호 매김 항목 리스트)
- 통계: 전체 카테고리 / 항목 수 / 평균

### 5.6 대무 시스템 (substitute)
- A의 task를 B가 대신 수행할 때 `substituteTask(taskId)` 호출
- `originalAssignee` 필드에 원 담당자 저장 + `memberId`를 현재 멤버로 변경
- 복원: `restoreTaskAssignee(taskId)`
- 활용처: 대표 부재 시 마케팅이 대신 처리

### 5.7 전략 체계 페이지 (`renderPlaybook`)
- state를 실시간 읽어 자동 갱신
- 회사 소개 + 4단 트리 다이어그램 + 등록 통계 + OKR 트리 + 반복업무 + 팀 + KPI 산출 방식 + 보고 흐름 + 외부 매핑

---

## 6. UI/UX 패턴 (v19+ 통일)

### 6.1 페이지 구조
```html
<div class="page-header">
  <div>
    <div class="page-title">📋 페이지 제목</div>
    <div class="page-subtitle">부제목/설명</div>
  </div>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm">보조 액션</button>
    <button class="btn btn-primary btn-sm">주 액션</button>
  </div>
</div>
<div class="page-content">
  <!-- 통계 카드 4개 -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
    <div class="card" style="padding:14px;text-align:center">...</div>
  </div>

  <!-- 섹션 -->
  <div class="section-title">📝 섹션 제목 <span class="count">N</span></div>
  <!-- 리스트/카드 -->
</div>
```

### 6.2 버튼 3종
- `btn-primary btn-sm` — 주황 (액션)
- `btn-ghost btn-sm` — 회색 외곽선 (보조)
- `btn-icon` — 아이콘만 (편집·삭제·설정)

### 6.3 색상 시스템
| 의미 | 색상 |
|---|---|
| Accent (브랜드) | `#e8632a` (POUR 주황) |
| Blue (정보) | `#3b82f6` |
| Green (완료) | `#22c55e` |
| Yellow (경고/우선순위 중간) | `#eab308` |
| Red (긴급/우선순위 높음) | `#ef4444` |
| Pink (B2C 고객) | `#ec4899` |
| Purple (B2B 고객) | `#8b5cf6` |
| Indigo (프로젝트) | `#6366f1` |
| Sky (회의록) | `#0ea5e9` |

### 6.4 캘린더 CSS (셀 고정)
```css
.cal-table { table-layout: fixed; }
.cal-table th, .cal-table td { width: calc(100% / 7); }
.cal-cell { height: 110px; vertical-align: top; overflow: hidden; }
.cal-cell.empty { background: var(--bg); cursor: default; height: 110px; }
```

---

## 7. 주요 함수 레퍼런스

### 7.1 시드 함수
- `seedKpisIfFresh()` — m1 첫 진입 시 KPI 시드 (현재 호출됨)
- `seedOKRIfFresh()` — v12 트리 시드 (**현재 비활성, 클로드 코드에서 활성화 필요**)
- `seedRecurringIfFresh()` — 반복업무 15개 시드 (현재 호출됨)

### 7.2 핵심 로직
- `generateRecurringForToday()` — 오늘 인스턴스 생성, dedup 처리
- `isRecurringAssignedToMe(r, memberId)` — assignees가 'all' / 배열 / 단일 처리
- `substituteTask(taskId)` — 대무 시작
- `restoreTaskAssignee(taskId)` — 대무 종료
- `toggleRecurringPinned(id)` — 📌 토글 + 오늘 인스턴스 isFixed 동기화
- `toggleActionItem(meetingId, actionId)` — 액션 체크 + linkedTask 동기화
- `calcDday(dateStr)` — D-day 계산 (D-3, D-day, D+5 등)
- `calcActivityScore(memberId, projectId, from, to)` — 활동 점수
- `buildContributionMatrix(from, to)` — 멤버×프로젝트 매트릭스

### 7.3 캘린더
- `getAllCalendarEvents(year, month)` — 모든 종류 통합 추출
- `renderUnifiedCalendar()` — 통합 캘린더
- `openCalendarEvent(kind, originalId)` — 클릭 시 해당 편집 모달
- `openCalendarAddMenu(dateStr)` — 추가 메뉴 (3종 선택)

---

## 8. localStorage 키

### 현재
- `pour-os-v21` — 메인 state
- `pour-os-last-backup` — 마지막 백업 타임스탬프

### LEGACY (마이그레이션 대상)
`pour-os-v5` ~ `pour-os-v20` — 발견 시 마이그레이션 모달 표시

---

## 9. 외부 시스템 매핑

### 9.1 인프라
| 용도 | 시스템 |
|---|---|
| 박람회 앱 | Firebase Firestore (project: `pour-exhibition`) |
| 어드민센터 | (개발 중) localStorage `pa_` prefix |
| 호스팅 | Cloudflare Pages (드래그앤드롭) |
| 마스터 프롬프트 | GitHub `prompts/01-business-master.md` |

### 9.2 e-Commerce
- **현재**: 아임웹 → **이전**: 카페24 (PG 등록 중)
- **3PL 체인**: 사방넷 → dada → 세이고
- **물류 3거점**: 세이고(부천) / 원스톱(오산) / 용인공장

### 9.3 판매 채널 (7개)
1. pourstore.net (자사몰)
2. 네이버 스마트스토어
3. 11번가
4. G마켓
5. 옥션
6. 오늘의집
7. 쿠팡

### 9.4 CS 채널
채널톡, 카카오톡, 전화, 오산 쇼룸 (대면)

---

## 10. 개발 히스토리 (v5 → v21)

| 버전 | 핵심 변경 |
|---|---|
| v5~v10 | 기본 골격, OKR 1.0, 대시보드 |
| v11 | O→KR→KPI→Project 4단 트리 |
| v12 | O2 운영 시스템 추가 (총 2/3/9/17) |
| v13 | 인라인 빠른 추가, 모바일 반응형 |
| v14 | 반복업무 컬렉션 추가, 14개 시드 |
| v15 | 다중 담당자 + 대무 + 주간 보고 (15개 반복으로) |
| v16 | 보고 전사/개인 토글, 기여도 매트릭스, 활동 점수 |
| v17 | 전략 체계 페이지 (자동 갱신) |
| v18 | 고객 이벤트 (B2C/B2B) 추가, 캘린더 통합 표시 |
| v19 | **캘린더 통합** (3 메뉴 → 1), 회의록·매뉴얼 UI 통일, 캘린더 셀 110px 고정, "회의·약속" 라벨 |
| v20 | **반복업무 엑셀 방식**, **회의록 액션 → task 자동 동기화** (linkedMeetingId), 프로젝트 승격 |
| v21 | **고정업무 ↔ 반복업무 통합** (recurringTasks.pinned), 대시보드 우측 영역 자동 표시 |

---

## 11. 다음 작업 우선순위 (클로드 코드용)

### 🔴 즉시 (CRITICAL)
1. **자동 시드 fix** — 새 다운로드 후 v12 트리 자동 시드 (위 0번 항목)
2. **첫 진입 모달** — "샘플 시드로 시작" vs "빈 상태로 시작" 선택

### 🟡 곧
3. **회의록 수정 모달 통합** — 현재 수정은 제목·안건만 가능, 액션 통합 방식과 동일하게
4. **task에서 회의록 역방향 링크** — task에 "이 task는 X 회의에서 결정됨" 표시
5. **매출 엑셀 업로드 파서** — 채널별 매출 → `KR.current` 자동 합산
6. **CRM 센터 ↔ POUR OS 동기화** — `customerEvents` 컬렉션 export/sync

### 🟢 나중
7. POUR OS를 어드민센터에 임베드 (어드민센터 개발 완료 후)
8. 빠른 검색 (Cmd+K)
9. Multi-filter + 사용자별 필터 저장
10. Undo (실수 복구)
11. CSV/JSON export
12. Light mode
13. POUR AI 빌드 후 (pour-ai.com) 플로팅 버튼 링크 업데이트

---

## 12. 비즈니스 룰 (절대 잊지 말 것)

### 12.1 표시광고법 준수
**금지어 → 대체어**:
- "강력한" → "효과적인"
- "빠른" → 시간/조건 명시
- "한번에 차단" → "차단 효과", "억제", "저감", "보강", "예방", "케어", "보호", "방지"

→ 모든 제품 카피·콘텐츠는 표시광고법 가이드 확인 후 발행

### 12.2 파트너 시스템 분리
- **POUR공법 협력사** ≠ **POUR스토어 파트너사**
- 협력사: 입찰·계약 B2B
- 파트너사: 유통·매칭
- 한 회사가 양쪽 모두에 속하거나, 한 쪽만, 또는 어디도 아닐 수 있음

### 12.3 가격 티어 (정확히)
- 스마트스토어 온라인 위탁 공급가 = 별도 (낮은) 티어
- 11번가·오늘의집 = 표준 소매가 (티어 8)
- 잘못 매기면 마진 깨짐

### 12.4 매뉴얼 ≠ 프로젝트
- 매뉴얼: SOP (반복적 작업 기준)
- 프로젝트: 목표 달성형 (KPI 연결, progress 추적)

---

## 13. 작업 스타일 가이드

### 13.1 사용자(멋쟁이) 선호
- **한국어 직설적·간결**
- 빠른 결정·실행, 긴 회의 싫어함
- 문제 자가 진단 선호 ("디자인 장난하나" → 사용자 피드백 시 명확히)
- HTML/CSS 목업 → Playwright 렌더 → 확인 → Figma 임포트
- 단일 HTML 파일 배포 선호 (Cloudflare Pages 드래그앤드롭)

### 13.2 코드 검증 패턴
```bash
# Syntax 체크
node -e "
const fs = require('fs');
const html = fs.readFileSync('pour-os-v21.html', 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(js);
console.log('✓ OK');
"

# Playwright 시각 테스트
import { chromium } from 'playwright';
// ... 페이지 로드, 클릭, 스크린샷
```

### 13.3 작업 순서
1. v(N) → v(N+1) 복사
2. STORE_KEY 업데이트
3. LEGACY_KEYS에 v(N) 추가
4. 코드 변경
5. node 문법 체크
6. Playwright 시각 테스트
7. `present_files` 로 outputs 전달

---

## 14. 첨부 파일

이 문서와 함께 전달:
- `pour-os-v21.html` — 최신 코드
- `seed-okr-v12.json` — OKR 트리 시드 (2 + 3 + 9 + 17)
- `seed-recurring.json` — 반복업무 15개
- `seed-manual.json` — 매뉴얼 23 카테고리 / 1938 항목

코드에서 시드 추출:
```js
const POUR_SEED_DATA = { manual: [...], v12Tree: {...}, recurringSeed: [...] };
```

---

## 15. 연락

- 도메인: pourstore.net / poursolution.net / pour1.net / netformrnd.com / grohome.co.kr
- 주요 색상: `#e8632a` (POUR 주황)
- 폰트: Pretendard (한국어)

**문서 끝.** 클로드 코드에서 작업 시작 시 0번부터 처리하면 됩니다.
