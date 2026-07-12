# POUR스토어 — 카페24 반영 종합 체크리스트

브랜치 `claude/pourstore-load-speed-auuszd`. 아래 파일 내용을 복사해 카페24 해당 조각에
**한 파일씩** 붙여넣고 저장하세요. 확인은 **라이브 + 시크릿창(Ctrl+Shift+R)**.

> `admin.html`(포스팅 편집기 등)은 **카페24가 아니라 pages.dev**라 붙여넣기 불필요 — 자동 반영.

---

## A. 카페24 재업로드 (총 12개)

### 메인 페이지 섹션
- [ ] `main/pour-01-main.html` — 상단(검색+배너) *(로딩 최적화 핵심)*
- [ ] `main/pour-05-shorts.html` — 숏츠
- [ ] `main/pour-07-magazine.html` — 매거진
- [ ] `main/pour-08-video.html` — 동영상 가이드 *(시안→실데이터 연동, 관리자 영상 자동 노출)*
- [ ] `main/pour-09-record.html` — 시공현장/협력사

### 공용 헤더 (검색 등 전 페이지)
- [ ] `common/pour-header.html` *(검색 페이지 속도 핵심)*

### 검색결과 페이지
- [ ] `search/pour-02-search-content.html`

### POUR이야기 페이지 ⭐ 변경 많음
- [ ] `story/pour-story.html` — 로딩 최적화 + **아티클(게시글) 개선**:
      히어로 썸네일 축소 · 글 정렬/크기 · **강조영역(펜툴 깜빡임)** · 핫스팟 상품/설명 카드 · 카드 위치버그 수정

### 패키지 페이지 (cate_no=71)
- [ ] `package/pour-package-cate.html` — 하단 카페24 기본 정렬/보기 툴바 숨김(이질감 제거)
- [ ] `package/pkg-2-best.html` — 로딩 최적화(패키지 fetch 3→1회)
- [ ] `package/pkg-3-new.html`
- [ ] `package/pkg-4-matrix.html`
- [ ] `package/pkg-5-video.html`

---

## B. 신규 페이지 — 설계 중 (시안 확정 후 제작·업로드)
> 시안 이미지 공유 완료. 색감·구성·문구 확정되면 실제 카페24 조각으로 제작 후 이 리스트로 이동.

- [ ] `부자재·안전용품 소개` 페이지 *(시안 page1)*
- [ ] `부자재` 페이지 *(시안 page2)*
- [ ] `안전용품` 페이지 *(시안 page3)*

---

## 확인 방법
- 저장 후 **시크릿창**으로 열기 (브라우저 캐시 회피)
- 콘솔(F12)에 `[psm1] 로드`, `[psy3]`, `[psg3]`, `[pstory]`, `[psg4]`, `[ppr2~4]` 로그 → 정상
- 메인 → POUR이야기/검색 이동 시 두 번째 화면이 거의 즉시 뜨면 캐시 정상

## 주의
- 로딩 캐시 효과는 관련 파일을 **모두** 반영해야 완전(일부만 바꾸면 중복 로딩 잔존).
- Firestore 컬렉션명·보안규칙·스키마는 전혀 건드리지 않았습니다.
