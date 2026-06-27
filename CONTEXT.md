# 프로젝트 컨텍스트 (CONTEXT.md)

> ⚠️ 이 파일은 Pour Ops Center 작업 맥락 요약입니다. 코드 기준으로 판단하세요.

---

## 프로젝트 개요

- **프로젝트명**: Pour Ops Center (운영센터)
- **목적**: 마케팅 예산 산출, BEP(손익분기점) 측정, MOQ 순익·매출 예산 계산기
- **브랜치**: `claude/pour-ops-center-setup-xo4qad`
- **메인 파일**: `pour-operations-center.html` (단일 HTML, React 없음, Vanilla JS)

---

## 기술 스택

- **프론트엔드**: HTML / CSS / JavaScript (단일 파일, 인라인)
- **데이터베이스**: Firebase (프로젝트 `pour-2aa48`) — compat SDK 10.12.0
- **인증**: Firebase 이메일/비밀번호 (로그인 게이트, `body.locked`)
- **버전관리**: GitHub `netformrnd-lab/pour-construction-form` (공개)

---

## 보안 구조 (목표 vs 현실)

**목표**: 원가 등 대외비 수치는 Firebase에만, GitHub엔 로직만.

**현실 (2026-06-27 기준) — ⚠️ 목표와 어긋남**:
- `PRICE_TABLE`(97개 상품, 원가 `cost` 포함)이 **HTML에 하드코딩** → 공개 레포에 그대로 노출.
- 같은 원가가 **git 히스토리(커밋 1989d16~)에도 잔존** → 현재 파일에서 지워도 과거 커밋엔 남음.
- Firestore 보안 규칙이 **아직 미게시(`if true`)** → apiKey만으로 누구나 읽기/쓰기 가능.

**→ 보안 완성에 필요한 선행 결정 (사용자 몫)**:
1. GitHub 레포 **비공개 전환** (또는 현재 가격 공개 수용) — 히스토리 노출의 유일한 즉효 해결.
2. Firestore 규칙 **게시** (`if request.auth != null`) — 이게 없으면 Firebase 이전이 무의미.

---

## 현재 상태 및 다음 작업

### 완료된 기능
- ⚡ 전략 대시보드: 볼륨 우선 결정뷰, B2C 역산(고정비 BEP 기반 허용할인), B2B 견적(견적서 양식),
  진짜 BEP(고정비 포함, TASK 4), OBM 트래픽/발주 역산, 채널 배분(추가/삭제·필요광고비·추천),
  세트 최소할인, 파트너 공급가, 수출가 FOB/CIF.
- 🏷 프로모션 마진(4단계 위저드), 📢 마케팅 채널 ROAS, 📊 MOQ 단가표(총마진/총매출, 견적서 출력).
- 💰 가격 설계(원가 프로파일), 🔗 UTM, 📦 상품·원가.
- 🔒 Firebase 이메일 로그인 게이트(fail-closed).
- ☁ 클라우드 동기화: 전체 상태·전략 시나리오·원가 프로파일·B2B 견적 이력 (ops-* 컬렉션).

### 진행 중
- 보안 아키텍처 정렬: `PRICE_TABLE`(대외비) → Firebase 이전, GitHub은 로직만.

### 다음 할 일 (순서)
1. (사용자) 레포 비공개 전환 결정 + Firestore 인증 규칙 게시.
2. `PRICE_TABLE` → Firestore 컬렉션(`price-table`) 마이그레이션 + 로그인 후 런타임 로드.
3. HTML에서 하드코딩 원가 제거(향후 커밋 클린) + (선택) git 히스토리 정리.

### 특이사항 / 주의사항
- `PRICE_TABLE` **값은 수정 금지**(데이터 정합성) — 위치만 Firebase로 이동.
- 모든 계산 함수(`promoCalc`, `calcTierPrice`, `recalcBep` 등)는 `PRICE_TABLE` 배열을 전제 →
  Firebase 로드 후 같은 배열을 채우는 방식으로 이전하면 로직 변경 최소화.
- 임시 링크: githack(`raw.githack.com/.../pour-operations-center.html`). 정식 주소는 GitHub Pages(main 머지 필요).

---

*Pour Ops Center · 작업 시마다 갱신*
