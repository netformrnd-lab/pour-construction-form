# POUR Ops Center — 인수인계 프롬프트 (이 파일을 새 대화에 첨부해서 이어가세요)

> 이 문서 하나로 현재 상태를 완전히 파악할 수 있습니다. 코드 기준으로 판단하고,
> 작업 전 반드시 `pour-operations-center.html`의 실제 코드를 확인하세요.

---

## 0. 한 줄 요약
POUR스토어(방수코팅제 OBM) **경영 의사결정 대시보드**. 단일 HTML 파일(Vanilla JS, React 없음).
프로모션 마진·BEP·MOQ·마케팅 ROAS·B2B 견적·채널배분 등을 한 화면에서 계산.
Firebase(이메일 로그인 + 데이터 저장) 연동. **원가 대외비 보호를 위한 Firebase 이전이 진행 중(Phase 2 남음).**

---

## 1. 핵심 정보

- **메인 파일**: `pour-operations-center.html` (약 5,000줄, CSS+JS 인라인, 단일 파일)
- **브랜치**: `claude/pour-ops-center-setup-xo4qad` (모든 작업이 여기 커밋됨)
- **레포**: `netformrnd-lab/pour-construction-form` (현재 공개 — 비공개 전환 예정)
- **임시 접속 링크(현재 공개라 동작)**:
  `https://raw.githack.com/netformrnd-lab/pour-construction-form/claude/pour-ops-center-setup-xo4qad/pour-operations-center.html`
- **정식 주소(미설정)**: GitHub Pages는 main 머지 필요(피처 브랜치는 환경 제한으로 막힘).

### Firebase (별도 계정, 운영 DB와 격리)
- 프로젝트: **`pour-2aa48`**, 앱 인스턴스 이름 **`opsCenter`** (코드 상단 `OPS_DB_CONFIG`에 이미 입력됨)
- 인증: 이메일/비밀번호. 등록 관리자: **`songhee44@netformrnd.com`**
- 로그인 게이트: 인증 전 `body.locked`로 `.shell` 숨김(fail-closed). `setupAuthGate()`.
- 컬렉션:
  - `price-table/current` — 원가표(대외비). `{json:"<PRICE_TABLE JSON>", count, updatedAt}` (Phase 2용, 아직 비어있음)
  - `ops-snapshots` — 전체 상태 백업
  - `ops-strategy-scenarios` — 전략 시나리오
  - `ops-cost-profiles` — 원가 프로파일
  - `ops-b2b-quotes` — B2B 견적 이력

---

## 2. 절대 규칙 (지키지 않으면 안 됨)
1. **`PRICE_TABLE` 값은 수정 금지** (원가/판매가 데이터 정합성). 위치만 Firebase로 이동.
2. 모든 이벤트는 **기존 `document.addEventListener` 블록 안에** 추가 (중복 리스너 금지).
3. 계산 함수 시그니처 유지: `promoCalc(prod)`(개당 계산만, qty는 호출측), `calcTierPrice(prod,tier)`.
4. 새 CSS는 `</style>` 직전, CSS 변수 활용: `--g`(초록/수익) `--r`(빨강/손실) `--am`(주황/경고) `--b`(파랑/B2B) `--ink`(다크).
5. 렌더 함수는 `var el=document.getElementById(..); if(!el) return;` 가드.
6. 작업 후 **헤드리스 브라우저로 전 탭 무에러 확인 + 수치 손계산 대조** (아래 11번).

---

## 3. 탭 구조 (data-ntab / panel-id)
`overview · promo · mkt · summary · utm · products · pricing · moq · strategy`
- 🏠 Overview / 🏷 프로모션(4단계 위저드) / 📢 마케팅 채널 ROAS / 📊 성과요약 / 🔗 UTM /
  📦 상품·원가 / 💰 가격 설계(원가 프로파일) / 📊 MOQ 단가표 / **⚡ 전략(핵심 의사결정)**

---

## 4. 완료된 기능 (전부 구현·검증·커밋됨)

### CLAUDE.md 원본 TASK
- TASK 1: MOQ 셀 총순익 (이후 라벨형으로 개편: 마진율·개당마진·개당매출 / 총마진·총매출)
- TASK 2: ⚡전략 대시보드 탭
- TASK 3: OBM 역산(BEP/트래픽/발주) — 이후 일부 일원화/확장

### TASK_ADDITIONS.md (TASK 4~8) — 전부 완료
- **TASK 4 (가장 중요)**: 진짜 손익분기 BEP — **고정비 포함**. 월 고정비(인건비/임대료/시스템/기타)
  입력 → 상품별·할인별 공헌이익, BEP수량(=배분고정비÷공헌이익), BEP매출. 고정비 배분 균등/매출비중.
  *기존 BEP는 변동비만 봤던 오류를 교정함.*
- TASK 5: B2C 역산 — 허용할인 = **고정비 포함 BEP할인율 × 0.9**(+마진 바닥선 병기), 광고비 한도/일예산/
  방문자/클릭·노출(CTR). OBM① 간이 BEP는 제거하고 TASK 4로 **일원화**.
- TASK 6: MOQ 시뮬레이터 견적서 출력(인쇄 시 순익·마진 숨김, 고객사/유효기간). `printQuoteDoc()` 공용.
- TASK 7: 발주 역산 확장 — 현재재고·리드타임 → 발주수량·운전자금·재고소진예상일·발주권장일.
- TASK 8: 채널 배분에 필요광고비 컬럼(온라인=매출÷ROAS) + 순익최대 추천배분 텍스트.

### 추가로 구현된 전략 탭 카드들
- 📈 볼륨 우선 결정뷰(총매출·총순익 2축, 총순익/총매출 최대 지점 + 탄력성)
- ④ 채널 배분(채널 **추가/삭제** + 단가소스 선택[직접입력 포함] + 수수료% + 필요광고비 + 추천)
- ⑤ 세트 구매유인 최소할인 ⑥ 파트너 공급가 역산 ⑦ 수출가 FOB/CIF 역산
- B2B 견적서 양식 커스터마이즈(공급자/고객/유효기간/부가세, 견적번호 자동)

### 인프라
- 🔒 Firebase 이메일 로그인 게이트
- ☁ 클라우드 동기화(전체상태/시나리오/원가프로파일/B2B견적 + **원가 업로드 버튼**)
- 원가 Firebase 로더(`loadPriceTable`) + 폴백(하드코드) — **Phase 1 완료**

---

## 5. 핵심 계산 공식 (검증된 로직)
```
// 변동비 개당
변동비 = 매입가(cost) + 판매가×수수료율 + 배송비 + 광고비
공헌이익 = 판매가 - 변동비
// 채널 수수료율: 자사몰=PG만(기본4%), 쿠팡/온라인마켓=PG+15%, 총판/오프라인/파트너=PG만
// 판매가 역산(원가→판매가)
P = 고정원가 / (1 - 목표마진율 - 수수료율)
// 진짜 BEP (고정비 포함, TASK 4)
BEP수량 = 배분고정비 ÷ 공헌이익 ;  BEP매출 = BEP수량 × 판매가
// B2C 허용할인 (TASK 5)
고정비/개 = 월고정비 ÷ 예상판매량(=목표매출÷객단가)
BEP할인율 = (1 - (매입가+배송+고정비/개)/(정가×(1-PG))) × 100
허용할인 = BEP할인율 × 0.9
// ROAS / 광고예산
광고비한도 = 목표매출 ÷ (목표ROAS÷100) ;  ROAS = 매출÷광고비×100
// 발주 (TASK 7)
목표재고 = 월판매 + 일판매×안전일 ; 발주수량 = max(0, 목표재고 - 현재고)
```

---

## 6. ⚠️ 진행 중 작업 — 원가 Firebase 이전 (Phase 2가 남음)

### 배경 / 보안 갭 (CONTEXT.md 기준)
원칙: **대외비(원가)는 Firebase에만, GitHub엔 로직만.**
현실: `PRICE_TABLE`(97개, `cost` 포함)이 HTML에 하드코딩 → 공개 레포 + **git 히스토리**에 노출.
+ 현재 Firestore 규칙이 `ops-*` 열림(`if true`)이라 ops 데이터도 누구나 접근 가능.

### Phase 1 — 완료(커밋됨)
- `loadPriceTable()`: 로그인 후 `price-table/current` 읽어 `PRICE_TABLE` 대체 + 재렌더, 실패 시 하드코드 폴백.
- `uploadPriceTable()` + "☁ 원가 Firebase 업로드(최초 1회)" 버튼(전략탭 클라우드 카드).
- (헤드리스 검증: 폴백 97건, Firebase 데이터 주입 시 교체·재렌더 OK)

### 사용자가 해야 할 일 (Phase 2 전제) — **아직 안 됨**
1. **Firestore 규칙 게시** (아래 7번 규칙) — `price-table` 추가 + 전체 로그인 필수로 잠금.
2. **레포 비공개** (단, 팀원 협업자 등록 확인 먼저 / githack·htmlpreview 막힘 → 접속경로 별도 마련).
3. **앱에서 원가 업로드 1회**: 로그인 → ⚡전략 → 클라우드 카드 → "원가 Firebase 업로드" 클릭 →
   새로고침 후 콘솔에 `[price-table] Firebase 로드: 97건` 확인.

### Phase 2 — 위 3개 끝난 뒤 Claude가 할 일
- `pour-operations-center.html`에서 **하드코드 `PRICE_TABLE` 배열(약 97줄, no:1~97)을 빈 배열로 교체**
  (`var PRICE_TABLE=[];`) → GitHub엔 로직만 남김.
- 단, **앱은 로그인+Firebase 로드 후에만 데이터가 차므로**, 로드 실패 시 화면에 명확한 안내가 뜨도록
  처리(현재 폴백이 하드코드라 제거 후엔 "원가 로드 실패" 안내 + 재시도 필요).
- 제거 후 사용자 브라우저(로그인)에서 정상 동작 확인까지 받기.
- (선택) git 히스토리의 과거 원가 정리는 레포 비공개로 갈음 권장(히스토리 재작성은 위험).

---

## 7. 게시할 Firestore 규칙 (최종, 로그인 필수)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /price-table/{doc}            { allow read, write: if request.auth != null; }
    match /ops-snapshots/{doc}          { allow read, write: if request.auth != null; }
    match /ops-strategy-scenarios/{doc} { allow read, write: if request.auth != null; }
    match /ops-cost-profiles/{doc}      { allow read, write: if request.auth != null; }
    match /ops-b2b-quotes/{doc}         { allow read, write: if request.auth != null; }
    match /{document=**}                { allow read, write: if false; }
  }
}
```
> 게시 후 검증 방법: 비로그인 REST 쓰기가 403(PERMISSION_DENIED)로 막히면 성공.
> (이메일/비번 로그인은 도메인 제한 없음 → 임시 링크에서도 로그인 동작)

---

## 8. 주요 함수 위치 (검색 키워드)
- `var PRICE_TABLE=[` — 원가표(Phase 2에서 비울 대상)
- `promoCalc` `calcTierPrice` — 핵심 단가 계산
- `recalcBep` / `renderBepRows` — TASK 4 고정비 BEP
- `recalcStrategyB2C` `bepFixedTotal` — TASK 5
- `printQuoteDoc` `printB2bQuote` `printMoqQuote` `quoteLinesFrom` — 견적서
- `recalcStrategyOBM` — 트래픽/발주(②③)
- `renderChannelAlloc` `chanList` `chanAutoAlloc` `CHAN_SRC` — 채널 배분(추가가능)
- `renderVolumeView` — 볼륨 결정뷰
- `recalcSet` / `renderPartnerSupply` / `renderExportPrice` — ⑤⑥⑦
- `loadPriceTable` `uploadPriceTable` `rerenderData` — 원가 Firebase 연동
- `setupAuthGate` `doLogin` `initOpsDb` `OPS_DB_CONFIG` — 인증/DB
- `STRAT_INPUT_IDS` / `collectFullState` `applyFullState` — 전략 입력 저장/복원
  (새 입력 추가 시 여기 등록해야 저장됨)

---

## 9. 별도 GitHub 레포로 분리 시
- 단일 파일이라 `pour-operations-center.html` + (선택) `CONTEXT.md` `HANDOFF.md`만 옮기면 됨.
- `OPS_DB_CONFIG`(Firebase 웹 config)는 그대로 사용 가능(같은 pour-2aa48 프로젝트).
- 새 레포가 공개면 똑같은 원가 노출 이슈 → **비공개 권장** 또는 Phase 2(하드코드 제거) 먼저.
- 접속: 비공개면 githack 불가 → GitHub Pages(유료) / Cloudflare Pages / 로컬 파일.

---

## 10. 새 대화에서 첫 지시 예시 (복붙용)
```
이 HANDOFF.md를 읽고 POUR Ops Center 작업을 이어줘.
파일: pour-operations-center.html (브랜치 claude/pour-ops-center-setup-xo4qad 또는 새 레포).
- 먼저 PRICE_TABLE, promoCalc, calcTierPrice, recalcBep, loadPriceTable 코드를 확인해.
- 내가 [규칙 게시 / 레포 비공개 / 앱에서 원가 업로드]를 끝냈는지 알려줄게.
  ( ) 다 했으면 → Phase 2: HTML에서 하드코드 PRICE_TABLE 제거(빈 배열) + 로드 실패 안내 처리 + 검증.
  ( ) 아직이면 → 7번 규칙·업로드 절차부터 안내.
- PRICE_TABLE 값 수정 금지, 이벤트는 기존 리스너 안에, 작업 후 헤드리스로 전탭 무에러 + 수치 검증.
```

---

## 11. 검증 기준값 (헤드리스 손계산 대조용)
```
[기본 단가]
- 코트재Ⅰ 20kg: 매입가 60,000 / 자사몰 정가 142,000
- 자사몰 PG4%·택배3,000 기준
[MOQ] 50개 마진35% → 단가 103,300원, 개당순익 36,168원 → 총마진 1,808,400(50개)
[프로모션] 할인10% → 판매가 127,800원
[TASK4 BEP] 월고정비 500만, 트랩100시트포함(no.89) 30%할인 → 공헌이익 7,479원,
  배분고정비 250만(균등2상품) → BEP수량 335개 / BEP매출 4,807,250원
  코트재Ⅰ 0% → BEP 35개. 예상 200+150개 → 월순익 +10,785,850(커버율 316%)
[TASK5 B2C] 정가142,000·고정비500만·목표매출2,500만·객단가142,000 →
  고정비/개 28,400, BEP할인율 33.0% → 허용할인 29.7% (마진바닥선은 37.5%로 더 높음=덜 보수적)
[TASK7 발주] 월300·재고50·안전7·리드14 → 발주320개/1,920만원, 소진 5일후
[채널] 자사몰 마진 ~51.6% > 파트너 42.5% > 오프라인 41.9% > 총판 41.5% > 쿠팡 34.3%
```

---

## 12. 커밋 히스토리 요약 (브랜치)
baseline → TASK1 MOQ총순익 → TASK2·3 전략탭+OBM → ④채널 → ⑤세트 → ⑥파트너 → ⑦수출 →
견적서양식 → 채널추가 → MOQ셀 라벨형 → 볼륨뷰 → ④순익집중 → 클라우드동기화 → 로그인게이트 →
TASK4 고정비BEP → TASK5 B2C일원화 → TASK6 MOQ견적 → TASK7 발주확장 → TASK8 채널광고비 →
CONTEXT.md → 원가Firebase Phase1(로더+업로드) → (HANDOFF.md)

*끝. 막히면 코드 기준으로 판단하고, 수치는 항상 손계산과 대조하세요.*
