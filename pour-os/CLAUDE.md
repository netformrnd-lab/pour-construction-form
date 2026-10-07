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
- **그로홈 매출은 그로홈 대시보드 원본을 직접**(2026-10): `sales-rollup` 이 한 번도 안 생겨 그로홈 KPI가 0원이던 문제 → 업무OS가 그로홈 매출 `salesRecords`(date·platform·totalPrice — 2026-10-07부터 pour-app-new 의 `pour-os/grohome/salesRecords`, 그 전엔 grohome-dashboard 프로젝트)를 REST로 읽기만 해서 `ghSalesRows`(채널 이름 맞춤 `ghChannel`: G마켓·옥션→옥션·지마켓, 도매꾹·도매매→도매꾹·도매매, '오늘의 집'→오늘의집)로 합계 → `mergeRoll`(그로홈 줄은 이것만, 두 번 안 셈) → `withAutoSales`. 기기에 합계만 `pour-os-gh-sales` 보관·1시간마다 새로. 저장 안 함. 나비엠알오·카카오쇼핑·박람회·토스쇼핑은 연결표에 없어 '안 들어간 채널'로.
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

### ✅ 업무 댓글 · 컨펌 요청 (2026-10, 대표 승인)
- 로직 `src/akNotes.js`(taskNoteId·projNoteId·confirmLatest·nextRound·confirmQueue·newNotesFor, 테스트 `confirm.test.mjs`), 화면 `ThreadPanel`·`ThreadSheet`·`TodayThreads`·`NoteBadge`.
- 행동지표 메모와 같은 컬렉션 `pour-os/ak-notes/c/{id}`(댓글 1개=문서 1개, 숨김만·되돌리기). itemId 업무 `task:{id}` · 프로젝트 `proj:{id}`. 파일은 `task-attachments/ak-notes/task_{id}/…`(규칙 변경 없음). 백업 akNotes 에 그대로 포함.
- 붙은 곳: 업무 수정창(고정업무 제외 — 고정업무는 담당자별 메모 그대로) · 업무플로우 건 상세 · 프로젝트 창('프로젝트 대화'). 업무 줄엔 '댓글 N'·컨펌 상태 표시.
- 컨펌 요청 = kind:"confirm" 원댓글 {to,status wait|ok|fix,round,link,fileName}. 받는 사람은 아무나(프로젝트 관리 담당이 기본). 받는 사람은 [승인]·[승인 + 완료]·[수정 요청](피드백=답글 fb:true). 수정 요청이면 요청자에게 'N차 올리기' → 새 원댓글(round+1), 이력 그대로. 승인 시 업무에 `confirmed{by,at,round}`.
- 댓글·메모 시각은 `noteAt()` — 저장은 UTC ISO, 보이기는 기기 시간대 "2026.10.01 (목) 14:06"(예전엔 UTC 를 잘라 9시간 늦게 보였음). 수정하면 '수정됨 {시각}'(이전 글은 edits). '삭제'는 한 번 더 확인 후 deleted:true(숨김) — '삭제된 댓글 · 이름 · 시각' + 쓴 사람·마스터는 되돌리기.
- 오늘 맨 위 `TodayThreads`: 컨펌 대기(나에게 온 최신 차수) · 피드백 옴(내 요청이 수정 요청) · 새 댓글(내 업무·내가 관리하는 프로젝트·내 글 답글, 본 뒤 생긴 것 — 기기별 `pour-os-seen-{uid}`, 처음엔 최근 7일).

### ✅ 행동지표 체크리스트 (2026-10, 대표 요청)
- 로직 `src/akRuns.js`(+ `akRuns.test.mjs`), 화면 `AkRunSteps`·`AkRunSheet`·`startAkRun`·`toggleAkRun` · 편집은 `AkEditSheet` '체크리스트 (선택)'.
- 행동지표마다 선택 `steps:[{id,title,owner,confirm}]`(고정업무 하위 체크리스트처럼 항목별 추가, 없으면 예전처럼 +1). 담당 비우면 '시작한 사람'.
- 있으면 오늘 카드 버튼이 '+ 시작' → 실행 1건 = 문서 1개 `pour-os/ak-runs/r/{id}` {akId,title,steps(그때 목록),checks,by,status,counted}. 오늘 그 줄 아래 펼쳐서 체크.
- 다 체크하면 그 행동지표 +1(akBump · 마지막 체크한 날의 주 · 시작한 사람 실적) + ak-notes 에 '체크리스트 완료' 기록(count.run). 하나 풀면 −1(처음 센 주), 다시 다 하면 +1 — 두 번 안 셈(counted).
- confirm 단계: 'AkRunSheet' 댓글에서 컨펌 요청(받는 사람=그 단계 담당) → 승인되면 자동 체크(ThreadPanel onApproved). 다음 단계 담당은 오늘 '체크리스트 내 차례'. 백업에 akRuns 포함.

### ✅ 반복 흐름 = 업무플로우 하나로 (2026-10, 정리 A)
- 업무플로우와 행동지표 체크리스트를 합침. 흐름 정의는 workflows 하나(단계·담당·`confirm`), 선택 `akId`(다 끝나면 +1 할 행동지표 — 행동지표 하나엔 흐름 하나).
- 체크는 모두 `wfToggle(D,wf,t,sid,cu,up)` → `caseToggleCalc`(workflow.js): 연결 흐름이면 다 체크 시 akBump +1(건 담당 실적·그 주, t.akCounted) + ak-notes '흐름 완료' 기록, 풀면 −1.
- 컨펌 단계: 건 창(CaseSheet)·오늘 ThreadSheet 의 컨펌 요청 승인 → `caseConfirmStage` 자동 체크. 흐름 건엔 '승인 + 완료' 버튼 없음(단계로 완료).
- 행동지표 수정창 '반복 흐름 (선택)': 연결 흐름을 고르거나 새로 만들고(보일 곳=카테고리) 단계 편집 = 그 흐름 편집. 예전 steps 는 지우지 않고 `stepsMovedTo` 표시(예전 실행 ak-runs 는 그대로 동작).
- 오늘 행동지표 줄: 연결 흐름이 있으면 '+ 시작' → 건(task wfId) 생성·그 자리 체크리스트. 프로젝트 화면 흐름 목록에 '+ 흐름 추가', 단계·담당 창에 이름·보일 곳·연결 행동지표·컨펌.

### ✅ 신제품 창 = 프로젝트 창 모양 (2026-10, 정리 B)
- `LaunchProductSheet`: 위 관리 담당·출시일, 진척 상자(%·항목 완료), 단계 칩, 항목 목록, 아래 안내·'빈 칸에 기본 담당 넣기'·제품 대화(ThreadPanel itemId `proj:lb:{제품id}`). '업무OS' 꼬리표 없앰.
- 담당은 런칭보드와 같은 글자 이름 그대로 저장(호환). 고르기 = 업무OS 사람(전체 이름) · 외주 · 외부(업무OS 밖, 예: 이우민·정하) · '+ 외부 담당 직접 입력'. 보이기: 업무OS 사람이면 그 이름(줄임 이름도 nameMatch), 아니면 '외부: 이름'(주황).

### ✅ 프로젝트 화면 한 목록 · 만들기 하나 (2026-10, 정리 D)
- 카테고리 화면 = `WfList` 하나: 프로젝트 카드(ProjCard) + 흐름 건 줄을 한 목록으로, 마감 묶음(마감 지남·이번 달·다음 달 이후·마감 없음·업무 다 끝남). 위 진행/완료 · 내 것만, 칩 한 줄(가로 스크롤) 전체·프로젝트·흐름별.
- 만들기는 위 '+ 새로 만들기' 하나 → `NewThingSheet`(프로젝트 / 반복 흐름 1건 / 신제품 ↗ 런칭보드). 예전 '+ 새 프로젝트'·'+ 새 건'·'+ 새 제품' 버튼 없앰(전체 화면 SimpleProjects 는 hideNew).

### ✅ 용어·정리 버튼 (2026-10, 정리 C·E)
- 화면 말은 두 가지만: **책임자**(프로젝트·흐름·신제품 1명, 카드엔 '책임 이름') · **담당**(단계·업무). '워크플로우' → '흐름'(오늘 '흐름 — 내 차례'). 데이터 칸 이름(assigneeId·ownerId·lead)은 그대로.
- '업무 다 끝남 · 완료 처리 대기' 묶음 머리에 '모두 완료 처리 (n)'(`BulkDone` — 마스터·그 프로젝트 책임자만, 한 번 더 확인, 상태만 completed). 업무 0개 프로젝트는 마스터에게 '보류로 옮기기' 안내. 보류 프로젝트·건은 맨 아래 '보류' 묶음.

### ✅ 이름 · 담당 변경 이력 (2026-10, 대표 요청)
- 앱 이름 **커머스본부 업무OS**(사이드바·헤더·로딩·탭 제목, 로고 글자 '커'). 화면에서 '반복 흐름/흐름' → **워크플로우**.
- 담당·책임자 변경 이력: 공통 저장 `up()` 에서 `ownerChanges()` 가 업무 담당·프로젝트 책임자·워크플로우 책임자/단계 담당·행동지표 담당이 바뀌면 `ownerLog[{at,by,byName,what,from,to}]`(이름) 누적. 화면 `OwnerLog`(접힘) — 프로젝트 창·업무 수정창·워크플로우 단계·담당 창·행동지표 수정창. 신제품은 런칭보드 history 의 '{항목} · 담당 …' / 책임자 기록을 항목·창에 표시.

### ✅ 바라스데이 브랜드 · 차수 이름·포스트잇 (2026-10, 대표 요청)
- 바라스데이는 대표가 '브랜드 추가'로 직접 만든 브랜드를 쓴다. 기본값(BRAND_SEED)에 넣었던 `barasday` 는 뺐고, 이미 들어간 곳은 `fixBrandDup`(브랜드 바 로드 후 1회)이 휴지통으로 옮기고 그 브랜드로 된 기록을 직접 만든 브랜드로 옮김 + 직접 만든 쪽에 `status:"prep"`(준비중). 준비중 브랜드 보기에서 KPI 화면은 '런칭 준비 중' 안내만. 업무·프로젝트·워크플로우·신제품은 그대로 관리.
- 프로젝트 창 '브랜드' 고르기(비우면 연결 KPI 따라감), 새 프로젝트는 지금 보는 브랜드가 기본.
- 출시 차수 묶기: 브랜드 칩은 런칭 브랜드 전부(POUR스토어·그로홈·바라스데이). 기존 차수를 고르고 이름을 바꾸면 그 차수 제품 모두 새 이름(런칭보드 batch). 차수 포스트잇(표식·메모)은 `wf_launch.batchNotes["브랜드|차수"]` — 로드맵 차수 머리에 노란 메모.
- **차수 편집 간소화 (2026-10)**: 차수 머리는 한 줄(출시일 칩 · 차수 이름 · 브랜드 · N개·평균% · + 메모 · 편집) + 포스트잇 있으면 한 줄 더. '차수 묶기' 버튼·큰 편집 창(BatchSheet) 없앰. 같은 차수 = 같은 출시일. 차수 묶음 순서 = 출시일 빠른 순(`launchGroupsOf`, launch.js) → 날짜 없는 차수 → 차수 미정 맨 뒤.
  - 로드맵 차수 머리(`BatchHead`): [이름·출시일] → 그 줄이 입력칸 → 저장하면 이 차수 제품 모두(이름·출시일). 출시일이 제각각이면 '출시일 제각각 · 하나로 맞추기'. 포스트잇은 그 자리에서 탭해 고치기/떼기, 없으면 '+ 포스트잇 붙이기'.
  - 차수 없는 제품은 '차수 미정' 묶음. 맨 아래 '+ 새 차수 만들기'(`NewBatch`: 브랜드·이름·출시일·제품 칩).
  - 제품 창: 차수 선택(기존/차수 없음/+ 새 차수) → 들어가면 출시일이 그 차수 날짜로 맞춰짐. 출시일을 바꾸면 같은 차수 제품 모두 바뀜.
  - 일정(달력): 같은 차수·같은 출시일 제품(2개+)은 막대 하나 "브랜드 차수 (출시 MM-DD) · N개", 같은 차수의 같은 단계·같은 마감도 하나로. 누르면 `BatchViewSheet`(제품별 진행·다음 할 일) → 제품을 누르면 제품 창.

### ✅ 오늘 '내 차례'의 신제품 항목 → 제품 창 + 항목 대화 (2026-10, 대표 요청)
- 오늘 블록 이름 '내 차례 — 워크플로우·신제품'. 신제품 줄: 윗줄 "신제품 · 브랜드 차수", 본문 "제품명 › 항목", 아래 "단계 · 마감 · 댓글 N".
- 줄을 누르면 그 자리에서 `LaunchProductSheet`(focusId=항목) — 그 항목이 펼쳐지고 스크롤됨.
- 항목마다 대화 `ThreadPanel` itemId=`proj:lb:{제품id}:{항목id}`(`lbItemNoteId`) — 댓글·대댓글·사진/파일·컨펌 요청(기본 받는 사람=제품 책임자). 항목 줄에 '댓글 N'.
- 오늘 '새 댓글'에 내가 담당인 신제품 항목 대화 + 내가 책임자인 제품 대화도 포함.

### ✅ 신제품 항목 체크리스트 — 기본 틀 (2026-10, 대표 요청)
- 기본 틀: `wf_launch.checkTpl[항목id]=[{id,name}]` — 로드맵 [기본 틀] 창(기본 담당과 같은 창)에서 항목별로 편집, 또는 제품 창 항목에서 '모든 제품에'로 추가.
- 제품별: 런칭보드 문서 `osExtra[항목id].checks={list?,done}` — list 가 없으면 기본 틀을 그대로 씀(틀 수정이 바로 반영). '이 제품만' 추가·✕ 빼기를 하면 그 제품만 자기 목록(list) — '기본 틀로 되돌리기'(list:null)·'이 목록을 기본 틀로'.
- 계산 `lbChecks(p,it,tpl)`(workflow.js). 항목 줄·오늘 내 차례에 '체크 n/t'. 다 체크하면 '항목 완료로' 버튼(자동 완료 아님). 건수형(＋/−) 항목은 체크리스트 없음.

### ✅ 그로스보드 마인드맵 간결화 (2026-10, 대표 요청)
- 업무가 7건 이상인 프로젝트는 업무 가지를 다 펼치지 않음(`pushTaskBranch`): 남은 일 중 진행 중 먼저 최대 3개 + "외 N건 · 완료 x/y · z%" 한 칸. 6건 이하는 예전처럼 하위까지 전부. 프로젝트 칸에 '업무 N' 칩. 화면·이미지 저장(PNG) 모두 같은 규칙(개인·팀·KPI별 맵).

### ✅ 모여라딜 OS → 업무OS 한 번 옮기기 (2026-10, 대표 요청: ① 한 번 옮기기 · ②③ 추천대로)
- 원본: Firebase `moyeora-deal-manager` · `moyeoradeal-os/state-*` — REST로 읽기만(지우지 않음). 계산은 `moyImport.js`(`planMoyImport`, 테스트 `moyImport.test.mjs`).
- 마스터 전용: KPI ▸ 데이터 백업·복구 ▸ **모여라딜 OS 가져오기** → '무엇이 들어올지 보기'(건수·사람·브랜드 미리보기) → '확인 — N건 넣기'.
- id 앞 `md_`(KPI 번호 mk1~3 충돌 방지) · 연결(목표→KPI→서브→프로젝트→업무·하위업무) 유지 · 브랜드 '모여라딜'(이름에 바라스데이·그로홈 있는 프로젝트는 그 브랜드, 모여라딜 KPI 연결은 끊음) · 프로젝트 없는 업무는 brand=모여라딜.
- 사람: 같은 이름의 업무OS 담당자(김송희·용정하). 없는 사람(봇)은 담당 비움. 활동 기록은 `archiveMove("log")`로 월별 보관함에 바로(현재 기록 밀어내지 않음). 휴지통·eventTypes 는 옮기지 않음.
- `importBulk`(App): 이미 있는 id 건너뜀 → 두 번 눌러도 중복 없음. 넣은 항목엔 `importedFrom:"moyeoradeal-os"`.

### ✅ 그로홈 대시보드 업무 → 업무OS 한 번 옮기기 · 담당자 미사용 (2026-10, 대표 결정: 업무는 업무OS 에서만)
- 원본 = 그로홈 대시보드 데이터의 employees·fixedTasks·etcTasks·leadingTasks·monthlyTasks·gbTasks — REST로 읽기만(대시보드 화면·데이터 그대로). 2026-10-07 그로홈 데이터 이사 뒤 위치 = pour-app-new 의 `pour-os/grohome/<컬렉션>`(`GH_FIREBASE.root`) · 옛 grohome-dashboard 프로젝트는 무료 요금제 하루 읽기 한도로 막혀 이사(원본 보관). 계산 `ghImport.js`(`planGhImport`, 테스트 `ghImport.test.mjs`).
- 모두 그로홈 브랜드, id 앞 `gh_`. 고정업무→고정업무(HH:MM 이면 시간, '상시' 등은 메모) · 기타/선행/월간→할 일(완료·마감 그대로) · KPI 업무 트리→분야별 프로젝트 5개(`gh_kpi_{분야}`) + 업무·하위 업무(분기·이유·결과 메모, krId 는 ghKrId).
- 사람: 같은 이름 담당자. 없는 사람(김보성·이채은)은 담당자로 추가(`gh_u_…`) + `active:false`(미사용). 예전 번호만 남은 담당은 비움.
- 화면: KPI ▸ 데이터 백업·복구 — 공용 `ImportPanel`(`IMPORT_SRC.moy`·`IMPORT_SRC.gh`), 마스터만. 미리보기 → 확인 → `importBulk`(users 포함) · 두 번 눌러도 중복 없음.
- **담당자 미사용** `users[].active===false`: 기록·이름 찾기는 그대로(D.users 전체), 담당 고르기·사람 바꾸기·팀 목록에서만 뺌(`actList(list, keep)` — 지금 골라져 있는 사람은 계속 보임). 담당자 화면 '미사용으로'/'다시 사용'(마스터, 나 자신 제외).

### ✅ 브랜드 여러 개 함께 보기 (2026-10, 대표 요청 — 김송희 POUR스토어+그로홈 겸업)
- 상단 브랜드 바: 누르면 켜고 다시 누르면 끔(여러 개 가능), '전체'는 모두, 다 끄면 전체. 저장값 `localStorage pour-os-brand` = "all" | "pourstore" | "pourstore,grohome" (이 기기 기준 기억, 예전 한 개 값 그대로 호환).
- `brandView(D, sel, def)` — 고른 브랜드들 + 공통. `_brands`=고른 목록, `_brand`=새로 만들 때 들어갈 브랜드(여러 개면 '새로 만들면 [브랜드]' 칩으로 고름, `localStorage pour-os-brand-new`). `toggleBrand(cur,id)`.
- 여러 개를 볼 때만 줄 앞에 작은 브랜드 표시(`BrandTag`: 행동지표·업무·프로젝트 카드, 공통은 표시 안 함). KPI '런칭 준비 중' 안내는 준비중 브랜드 하나만 골랐을 때만.

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
