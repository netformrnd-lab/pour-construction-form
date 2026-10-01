# CLAUDE.md — POUR OS

넷폼 **브랜드커머스팀**의 업무·매출 관리 모바일 웹앱. (React SPA)
이 문서는 Claude Code가 이 저장소에서 작업할 때 따라야 할 컨텍스트·규칙이다.

---

## 무엇인가
- 팀 **최종목표**(2026 매출 **10억**)를 → 메인KPI → 서브KPI → 프로젝트(활동) → 업무(Task)로 쪼개 추적하고, **성과(매출)**를 기록하는 앱.
- 모바일 우선. iPhone에서 탭 테스트하며 사용.
- 사용자: 팀원 4명 (송희=lead, 민지, 란, 채림). 앱 우상단에서 담당자 전환.

## 제품 정의 · 철학 (북극성)

**정의**
> 팀 최종목표를 매일의 업무 실행과 연결하고, 누가 무슨 활동으로 얼마를 벌었는지까지 자동 집계·기록하는 업무관리 도구.

**핵심 원칙 — 데이터 자산화**
> "기록되지 않은 업무 = 하지 않은 것."

매일의 활동이 남아야 자산이 된다. 안 남으면 자산이 안 된다.
→ **이게 데이터 영속화가 1순위인 진짜 이유다.** 영속화·이력 보존은 부가기능이 아니라 이 앱의 존재 이유. (현재 인메모리 = 최우선 보완 대상)

## 스택 / 실행
- **Vite + React 18**, 순수 인라인 스타일(토스 스타일), 한국어 UI. 외부 UI 라이브러리 없음.
- `npm run dev` — UI 개발 (localhost:5173)
- `npm run build` → `dist/` (정적). `npm run cf:dev` — Cloudflare Functions 포함 로컬(AI 코치 테스트).
- **배포**: Cloudflare Pages. Build `npm run build`, Output `dist`. 환경변수 `ANTHROPIC_API_KEY`.
- **상태 영속화(구현됨, 3중 안전망)**: Firestore(`pour-os/state-{컬렉션}` 분할 문서, 실시간 구독) **+** localStorage 미러 **+** IndexedDB 영구 미러·시점 스냅샷(`src/durable.js`). 삭제는 **소프트삭제(휴지통 `trash`)** 로만 — `rm`은 영구삭제 금지, 복구 가능. 빈 원격 문서로 로컬을 덮어쓰지 않음(백지 가드). 컬렉션별 1MiB 한도 가드. KPI▸데이터에 휴지통·전체 백업(JSON)·로컬(IndexedDB) 복구 UI.
  - ⚠️ 데이터 영구삭제 경로를 새로 만들지 말 것. 삭제는 항상 `rm`/`rmNested`(휴지통 경유).

## 파일 구조
- `src/App.jsx` — 앱 전체(현재 단일 파일 ~1,600줄). 모든 컴포넌트·데이터·헬퍼가 여기 있음.
- `src/main.jsx` — 엔트리.
- `functions/api/coach.js` — Anthropic 프록시(AI 코치). 클라이언트는 `/api/coach`로 POST.
- `index.html` — Pretendard / IBM Plex Mono 폰트 로드.

> 단일 파일이라 한 번에 보기 편하지만 길다. **모듈 분리(컴포넌트/데이터/헬퍼)는 점진적으로**, 전면 재작성 말고 타겟 수정 선호. 분리 시에도 동작 동일성 유지.

---

## 데이터 모델 (가장 중요 — 손대기 전 숙지)

계층: **최종목표(goals) → 메인KPI(mainKPIs) → 서브KPI(subKPIs) → 프로젝트(projects) → 업무(tasks)**

```
goals[g1] 매출 10억
└ mainKPIs (메인KPI)
   ├ mk1 메인1 직판 5억        (unit:"원", 채널 수동 입력)
   ├ mk2 메인2 B2B 5억         (unit:"원", 프로젝트 성과 자동 집계)
   └ mk3 메인3 운영 4모듈       (unit:"모듈", 수동)
   └ subKPIs (단가/채널별)
      └ projects (= 선행지표, progress%)  + dealerType(거래처유형) 태그
         └ tasks
```

### 핵심 개념 — 선행지표 vs 결과 (절대 혼동 금지)
- **선행지표 = 프로젝트 `progress`(%)** — "활동을 얼마나 했나".
- **결과 = 매출** — "그 활동으로 실제 얼마 벌었나". 프로젝트 `resultValue`(원)에 기록.

### 매출 집계 규칙 (헬퍼 `skCur` / `mkCur`)
- **메인KPI2(mk2) 서브KPI**: `currentValue`를 쓰지 않고 **자식 프로젝트 `resultValue` 합계**로 자동 계산.
- **메인KPI1(mk1) 서브KPI**: 채널 매출 = subKPI `currentValue` **수동 입력**.
- **메인KPI3(mk3)**: 모듈/% 수동.
- mainKPI(원) = 자식 subKPI 합계. goal = mainKPI(원) 합계.
- 즉 **매출 입력은 메인KPI2의 프로젝트 `resultValue` 한 곳** → 거래처유형별·단가별·메인KPI2·최종목표가 전부 파생. 단일 소스.

### 거래처유형 (SSOT)
- `DEALER_TYPES`(13종) + `DT` 룩업. 색상군: 개인=회색 / P4파트너=파랑 / P3대리점=주황 / 유통·셀러=보라 / G채널=초록.
- 프로젝트마다 `dealerType` 태그(누가 사는가). 거래처유형 ≠ 단가 ≠ 페르소나. (자세한 정의는 별도 마스터프롬프트 v3.1)
- `H`(이관)·`M`(시공매칭)은 거래처유형이 아니라 **거래 성격** → 거래처유형 카드엔 안 잡히고 단가 subKPI(sk_h, sk8)로만 집계.

### 매출 입력 UX
- KPI → 메인KPI2 펼침 → "거래처유형별 매출" 카드의 **`✏️ 입력`** 버튼 → `salesOpen` 시트.
- 시트: 메인KPI2 프로젝트를 단가 서브KPI별로 묶어, 거래처유형 배지 + 금액 input. 한 화면에서 입력 → 자동 반영.
- **프로젝트 안으로 들어가서 입력하지 않는다** (그 여정은 의도적으로 제거함). 입력은 이 시트 한 곳.
- 거래처유형별/단가별 표는 **읽기 전용 현황(보기)**. 입력은 버튼/시트.

---

### ✅ KPI 행동지표 · 권한 · 월말 회고 (2026-10)
- 로직은 `src/actionKpi.js` (+ `actionKpi.test.mjs`). 화면은 App.jsx 의 `AkBoard`·`AkTodayCard`·`AkRetroSheet`·`PinSheet`.
- 정의 `actionKPIs`(필수 core / 추가, 삭제 없이 active:false 로 멈춤) · 결과 KPI `lagKPIs`(monthly{YYYY-MM}) · 월말 회고 `retros`(kind:"teamMonthly").
- 주별 실적은 공유 컬렉션이 아니라 분기 문서 `pour-os/kpi-act-YYYY-Qn` 에 **increment** 로 쌓는다(동시 +1 덮어쓰기 방지). 백업(JSON·외부)에 `kpiAct` 로 포함.
- KPI 화면은 **한 화면**(탭 없음, 전체 맵만 따로): 최종목표 → 메인KPI(서브KPI·매출 입력 그대로) → 결과 KPI·행동지표 표(메인KPI별 묶음) → 프로젝트 활동지표(선행) → 팀·데이터. 행동지표·결과 KPI 의 메인KPI 연결은 `akLink()`(mk/sk 없으면 기본 연결표).
- 권한: `isMaster()`(기본 김송희·이란·김소연·허지은) + `can(user, "kpiCore"|"kpiLag"|"tpl"|"proxy")`. 마스터 전환 시 4자리 PIN(해시 저장). 로그인 없는 구조라 PIN 은 화면 단 보호다.

### ✅ 브랜드별 관리 · 그로홈 · 매출 자동 연결 · 반복 실행 (2026-10)
- 로직은 `src/brand.js` (+ `brand.test.mjs`). 화면은 App.jsx 의 `BrandBar`·`RoutinePage`·`KpiFlow`·`ExecBoard`.
- 브랜드 목록 `brands`(pourstore·grohome, 마스터가 추가). 기록의 브랜드: 목표 brand → 메인KPI·서브KPI 따라감 → 프로젝트(brand 없으면 메인KPI) → 업무(프로젝트). brand 없는 예전 데이터 = POUR스토어, 고정업무·프로젝트 없는 업무 = 공통.
- 브랜드 보기(`brandView`)는 오늘·KPI·반복 실행·프로젝트에만, 고른 브랜드+공통. 저장 데이터는 안 바뀜. 백업(ExportPanel)은 항상 전체 원본 `Dall`.
- 그로홈: 목표 g_gh 10억 = ghk1 온라인 7.86억(ghs1 자사몰 2.8 · ghs2 쿠팡·오늘의집 3.4 · ghs3 CPC 1.66) + ghk2 B2B·제휴 2.14억(ghs4 철물점 0.85 · ghs5 위탁 0.57 · ghs6 공동구매 0.72) — 그로홈 대시보드 kpiTargets 와 같은 값. 행동지표 10(ak_gh_*)·결과 KPI 9(lg_gh_*)는 KPI 체크리스트 엑셀 '그로홈' 시트. 기존 DB엔 `seedMissing()`이 빠진 id 만 1회 채움(휴지통에 있으면 안 넣음).
- 매출 자동 연결: 마진대시보드 매출 화면(`loadSales`)이 브랜드·월·채널 합계를 `pour-os/sales-rollup` {rows:[{b,ym,ch,amt}],at,by} 에 씀(그로홈·POUR 두 기록 다 읽었을 때만). OS 는 서브KPI `salesCh`(없으면 `SALES_CH_DEFAULT`) 채널의 그 해 합계를 화면값으로(`withAutoSales`). `salesAuto:false` 면 예전처럼 수동. 메인2(mk2) 규칙은 그대로(프로젝트 매출 합계).
- ⚠️ CRM(pour-crm `pourOsSync`)이 `channelCode`(OWN·MK·SHOW·P3~P6·SUB)로 POUR CRM 매출을 서브KPI에 넣는다(crmSynced:true). 그로홈 서브KPI는 channelCode 를 비우고 `badge` 로 표시(`fixGhSubs` 가 예전 코드 정정). crmSynced 칸은 마진대시보드 값으로 덮지 않는다(CRM 이 원본).
- 실행 현황: 행동지표 달성률 · 고정업무 체크율 · 프로젝트 진척을 **합치지 않고 따로**, 메인KPI별로 결과(매출 달성률)와 나란히. 위 버튼 [전체|행동지표|고정업무|프로젝트].
- 메뉴 "반복 실행"(page routine, 예전 fixed 도 여기로) = 고정업무 + 행동지표 한 화면 두 칸.

### ✅ 행동지표 메모 (2026-10)
- 로직 `src/akNotes.js` (+ `akNotes.test.mjs`), 화면 `AkNotesSheet`·`NoteComposer`·`UtmPanel` (행동지표 표 각 줄의 "메모 N" 버튼).
- 댓글 1개 = 문서 1개 `pour-os/ak-notes/c/{id}` {itemId,parentId,text,files,by,at,edits[],deleted}. 대댓글은 parentId(한 단계). 수정 시 이전 글 `edits` 에 보관, 삭제는 `deleted:true` 숨김만(되돌리기 가능).
- 파일·붙여넣은 사진: Storage `task-attachments/ak-notes/{itemId}/…` (기존 규칙 범위 — 규칙 변경 없음). 25MB·한 번에 10개.
- UTM 링크: 주소 + source·medium·campaign(+content) → 메모에 넣기/복사. 글 속 UTM 링크는 배지로 표시.
- 백업(JSON·외부)에 `akNotes` 로 포함.
- 고정업무 메모도 같은 컬렉션(kind:"fixed", itemId=업무 id) · 같은 시트(AkNotesSheet item._kind="fixed").
- 오늘 행동지표 카드: 메모 버튼 · −1(이번 주 값이 있을 때) · +1 뒤 7초 "되돌리기" · 그로홈 등 브랜드 표시.

### ✅ 추적 링크 만들기 (2026-10) — 마진대시보드와 연동
- 로직 `src/linkMaker.js` (+ `linkMaker.test.mjs` — 대시보드 파일의 ML_PURPOSES·utmNorm·mlCode·mlDest·mlBuild 와 같은 결과인지 직접 비교). 화면 `UtmPanel`(메모 칸 "링크 만들기").
- 대시보드 링크(mkt-links)는 pourstoreproject · 생성은 팀 로그인 계정만(규칙) → 업무OS는 `pour-os/utm-links/items/{id}`(id 'o'+6자)에 저장. 짧은 링크 `https://pour-construction-form.pages.dev/g?l={id}` 는 g.html 이 mkt-links 에 없으면 이 공간에서 찾아 이동·클릭 +1.
- 마진대시보드를 팀 계정으로 열면 `importOsLinks()`가 같은 id 로 mkt-links 에 옮겨 담음(클릭 수 그대로, createdVia:'pour-os', 업무OS 쪽엔 importedAt 만 표시). "만든 링크" 탭은 두 곳 합친 목록(mkt-links 공개 읽기).

### ✅ 고정업무 담당자별 시간 (2026-10)
- 한 고정업무를 여러 명이 맡아도 `timeBy{uid:"HH:MM"}`로 사람마다 시간이 다를 수 있음(없으면 기본 fixedTime). `fixedTimeFor(t,uid)`·`byFixedTimeFor(uid)`.
- 담당자별 **보이는 이름** `labelBy{uid}` · **하위 체크리스트** `subsBy{uid|"*":[{id,title}]}`(사람별 목록, 없으면 공통 "*") · 체크 상태 `subDone{uid:{subId:날짜}}`. 그 사람 항목을 다 체크하면 그 사람 체크(doneDates) 자동 완료(`fixedSubPatch`), 큰 체크박스는 전부 체크/해제(`fixedToggleAll`).
- 고정업무 메모는 **담당자별** — itemId `업무id~사람id`(`fixedNoteId`). 반복 실행 화면 메모는 담당자 탭(예전 업무id 메모는 '이전 메모' 탭으로 그대로).
- 체크 시 `doneAtBy{uid:ISO}`(체크 시각)도 저장 → 반복 실행 화면 한 줄에서 "✓이름 08:47 / 이름 09:20(예정)"으로 전원 확인 여부를 봄.

### ✅ 쉽게 쓰기 정리 (2026-10, 대표 요청 "간단명료하게")
- 일은 세 가지로만 부른다 — **할 일**(한 번 하면 끝 · 직접 등록/프로젝트) · **고정업무**(정해진 주기 반복 · 체크) · **행동지표**(KPI 목표 횟수 · +1). 색 `KIND_C`(task 네이비 · fixed 청록 · ak 보라), 머리글 `KindHead`(제목+한 줄 설명).
- 오늘 화면: 나/팀 토글 없음(팀 현황은 KPI), '이번 주 명심할 것' 숨김(weekGoals 데이터는 그대로), 위 숫자 3개 = 세 가지 일(누르면 그 칸으로). 행동지표 카드는 주간/월간/분기로 묶음.
- KPI 화면: 최종목표·실행 현황·메인KPI만 펼침, 나머지(흐름·입력 방법·행동지표 표·활동지표·팀·데이터)는 `Fold`(접힘, 펼친 상태 기기별 기억). 설명은 한 줄.
- %는 소수 1자리(fmtPct).

### ✅ 정리 1·2단계 (2026-10, 대표 승인)
- 표기: 행동지표 = **행동지표(선행지표)**, 결과 KPI = **결과 KPI(후행지표)** (`AK_LABEL`·`LAG_LABEL`). 프로젝트 진척은 '진척'으로만.
- +1 하면 그 1건 기록 창(메모·링크·파일, 건너뛰기 · 끄기 `pour-os-ak-rec`) → ak-notes 에 `count{wk,n,at}`.
- 업무 수정창: 상태 할일·완료(진행중·보류는 더보기), 마감일은 필요할 때만, 실제 시작·완료일 접기. 고정업무 수정창: 상태·이력·마감일 숨김, `paused`(잠시 멈춤 — 오늘·실행 현황 제외, 반복 실행 아래 '멈춘 고정업무'), 연결 프로젝트 접힘.
- 오늘 블록: 주간 배치·내 캘린더·팀 활동·내 프로젝트 기본 접힘(손잡이 메뉴로 접기/펼치기).
- 아래 탭: 오늘·반복 실행·KPI·프로젝트·일정·더보기 (그로스보드는 더보기). KPI 전체 맵은 위 링크로.
- 템플릿 이름: '템플릿'(manuals) · '출시 템플릿'(launchTemplates). 구간 KPI 편집은 이미 구간이 있는 프로젝트에만.
- 안 쓰던 화면 코드(TeamToday·ProcessEditorPage·ShareFlowPage·GamePage·ProjWeekGoals) 제거 — 데이터 영향 없음.

### ✅ 시장조사 ↔ 프로젝트 연결 (2026-10)
- 로직 `src/research.js` (+ `research.test.mjs`), 화면 `ResearchLink`(프로젝트 시트 '시장조사' 칸) · `useResearchIndex`.
- 시장조사 페이지(`/Market-Research/`)가 체크 저장 후·불러온 뒤 체크한 제품 요약을 `pour-os/research-index/items/market-research-deco2` 에 씀(사진 제외, 바뀐 때만). 원본 체크는 그대로 `sourcing-os/market-research-deco2`. 규칙 변경 없음.
- 프로젝트 `researchIds:[]` 로 연결 → '샘플 구매 N개 → 업무로'·'더 찾기 M개 → 업무로'. 업무에 `fromResearch:"보고서:번호:종류"` 를 남겨 같은 체크는 두 번 안 만듦. 연결 해제는 연결만 지움(업무는 그대로).

### ✅ 5인 시나리오 점검으로 고친 것 (2026-10)
- CRM 임베드 접속자 자동 선택: 담당자 목록이 DB에서 늦게 와도 다시 찾음(`crmPend`) — 나중에 추가된 사람(김소연·윤미니)이 기본 사람으로 남던 문제.
- 실행 현황 행동지표: 오늘 화면과 같은 기준(이번 주가 속한 달, 주=월요일의 달)으로 집계하고 그 분기 문서를 읽음 — 10/1~10/4 처럼 달 경계 주에 0%로 보이던 문제.
- 금액 입력(`MoneyInput`): 만 칸에 10만 이상·억 칸에 1000 이상을 적으면 원으로 적은 숫자로 봄(1,200만 → 1,200억 저장 실수 방지).

### ✅ 업무플로우 = 런칭보드처럼 목록 1개 (2026-10, 대표 승인)
- 카테고리마다 `WfList` 하나: 위 칩(전체·흐름별, 진행 수)으로 거르기 · 건 1개 = 1줄(이름 · 다음 단계(담당) · 단계 칩 눌러 체크) · '+ 새 건'(`WfNewSheet`: 흐름 고르기 → 이름 → 담당·마감) · 흐름을 고르면 단계·담당 줄과 '단계·담당' 버튼. 예전 흐름별 보드 13개 쌓기(WfBoard)는 없앰.
- 단계 담당이 비어 있으면 안내 한 줄(정하면 다음 사람 오늘 '내 차례'에 뜸). 고른 칩은 기기별 기억 `pour-os-wf-sel-{카테고리}`.
- 저장 구조 그대로(tasks wfId·wfChecks·wfData) — 오늘 내 차례·달력·프로젝트 진척·CaseSheet·WfSettingsSheet 재사용. 신제품은 런칭보드(pour-os/launch-board/products, pour-app-new) 그대로.

### ✅ 프로젝트 카드 = 신제품 출시 로드맵처럼 (2026-10, 대표 승인)
- `SimpleProjects` 진행 탭: 마감 묶음 머리(`projGroups`: 마감 지남 · 이번 달 마감 · 다음 달 이후 · 마감 없음 · 업무 다 끝남) + 짧은 카드 `ProjCard`(이름·D-day·% / 관리·다음 할 일(담당) / 칩).
- 칩(`projChips`): 업무가 상위·하위로 묶인 프로젝트는 단계별(상위 업무, 나머지 '기타'), 아니면 담당자별 완료/전체(남은 것 많은 순 4개 + "+N"). 초록 ✓=다 끝남, 테두리=다음 할 일이 있는 칸. 칩을 누르면 프로젝트 창이 그 사람·단계 업무만 걸러 열림(`focus`, '전체 보기 ✕'로 해제).
- 칩 수는 지금 남아 있는 업무 기준(보관함으로 옮긴 완료 업무는 %에만 포함).

## 규칙 (반드시 준수)

### Firebase / Firestore (연동 시)
- **`orderBy` 쿼리 금지** → 받아서 **클라이언트 정렬**.
- catch에서 빈 배열 반환 금지. 빈 결과는 `console.log`로 건수 확인.
- (기존 프로젝트 관례) 컬렉션 예: `leads-store`, `dealer-inquiries(brand:'store')`, `site-metrics` 등.

### 디자인
- 브랜드 컬러: 오렌지 `#F25C05`/`#F97316`, 네이비 `#0F1F5C`, 크림/베이지 `#FFFBF5`/`#F9FAFB`.
- 폰트: Pretendard(한글), IBM Plex Mono(숫자/코드), Bebas Neue(영문 디스플레이).
- "절제된 대기업 커머스 스타일" — 글로우/그라디언트 텍스트/무거운 그림자 금지.
- 인라인 스타일 객체 패턴 유지. 컴포넌트는 함수형. 모바일 `maxWidth:480`.
- **(2026-10 대표 요청) 기업용처럼 간결하게**: 토스식 밝은 파랑(#3182F6 등) 쓰지 않음 → 기본색 네이비 `#24386B`/`#0F1F5C`, 사이드바 `#1B2438`, 배경 `#F4F5F7`. 상태색도 채도 낮춤(초록 `#2F7D57`·빨강 `#B4383F`·주황 `#B26A12`). 그라디언트 금지.
- **아이콘(이모지) 쓰지 않기** — 메뉴·제목·버튼은 글자로. 기능 기호(✓ ✕ ▾ ▴ → ‹ ›)만 허용. 아이콘만 있는 버튼 금지(수정·삭제처럼 글자로).
- 데이터에 저장된 예전 밝은 색(담당자·일정 유형)은 `toneC()`로 화면에서만 차분하게 바꿔 보여준다(저장값은 그대로).

### 기타
- 한국어 라벨 유지.
- 표시광고법: 제품 카피류에 "완벽/강력/방지" 등 단정 표현 회피(브랜드 표준). 이 앱은 직접 관련 적지만 카피 작성 시 적용.
- 표시·집계 수치는 임의 추정/조작 금지(소스 충실).

---

## 알려진 작업 / 로드맵
1. (이식 완료) AI 코치 → `/api/coach` 프록시 (브라우저에 키 노출 안 함). 모델 문자열은 `src/App.jsx`의 fetch body에서 갱신 가능.
2. **상태 영속화** — 현재 새로고침 시 초기화. localStorage 또는 Firebase로.
3. **Firestore 백엔드** — 위 규칙 준수(orderBy 금지, 클라 정렬).
4. **모듈 분리** — `src/App.jsx`를 컴포넌트/데이터(INIT)/헬퍼로 분리(점진적, 동작 동일성 유지).
5. 매출 로그(날짜·메모), KPI v6 세부지표.

## 첫 작업으로 추천 (Claude Code에게)
- "src/App.jsx를 components/ data/ lib/ 로 분리해줘. 동작은 그대로." 또는
- "상태를 localStorage에 영속화해줘(키 godsaeng-os-v2). 깨지지 않게."
