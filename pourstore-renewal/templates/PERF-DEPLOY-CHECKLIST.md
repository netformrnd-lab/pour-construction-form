# POUR스토어 로딩 속도 개선 — 카페24 반영 체크리스트

브랜치 `claude/pourstore-load-speed-auuszd` 의 아래 파일 내용을 복사해
카페24 해당 조각에 **한 파일씩** 붙여넣고 저장하세요.
확인은 **라이브 + 시크릿창(Ctrl+Shift+R)**.

## 무엇이 바뀌었나 (동작·데이터 변화 없음)
- 순차 로딩 → **병렬 로딩** (한 번에 시작)
- 화면 상단 **배너 먼저 렌더** (회색 박스 대기 최소화)
- `window.__pcache` **공유 캐시**: 같은 페이지 중복 fetch 제거 + `sessionStorage` 5분 재사용
- Firestore·SDK·폰트 **preconnect** + **modulepreload**(SDK 조기 다운로드)
- 폰트 render-blocking `@import` 제거 → `<link>` 조기 로드(검색 진입 깜빡임/FOUC 감소)

> ※ 로딩 최적화 3차(폰트/SDK)는 아래 **동일 11개 파일**에 이미 포함됨 — 추가 업로드 파일 없음.

## 재업로드 대상 (총 11개)

### 메인 페이지 섹션
- [ ] `main/pour-01-main.html` — 상단(검색+배너) *(핵심)*
- [ ] `main/pour-05-shorts.html` — 숏츠
- [ ] `main/pour-07-magazine.html` — 매거진
- [ ] `main/pour-08-video.html` — 동영상 가이드 *(신규: 시안→실데이터 연동. 관리자 영상 자동 노출)*
- [ ] `main/pour-09-record.html` — 시공현장/협력사

### 공용 헤더 (검색 등 전 페이지)
- [ ] `common/pour-header.html` *(검색 페이지 속도 핵심)*

### 검색결과 페이지
- [ ] `search/pour-02-search-content.html`

### POUR이야기 페이지
- [ ] `story/pour-story.html` — 포스팅 2회→1회 + 헤더 데이터 캐시 재사용

### 패키지 페이지 (pkg 4개 → 패키지 fetch 3회→1회)
- [ ] `package/pkg-2-best.html`
- [ ] `package/pkg-3-new.html`
- [ ] `package/pkg-4-matrix.html`
- [ ] `package/pkg-5-video.html`

## 확인 방법
- 저장 후 시크릿창으로 열기 (브라우저 캐시 회피)
- 개발자도구(F12) 콘솔에 `[psm1] ... 로드`, `[psy3]`, `[psg3]`, `[pstory]`, `[ppr2~4]` 로그가 뜨면 정상
- 메인 → POUR이야기/검색으로 이동 시 두 번째 화면이 거의 즉시 뜨는지 체감 확인 (캐시 동작)

## 주의
- 11개를 **모두** 반영해야 캐시 효과가 완전합니다(일부만 바꾸면 중복 로딩이 남음).
- Firestore 컬렉션명·보안규칙·스키마는 전혀 건드리지 않았습니다.
