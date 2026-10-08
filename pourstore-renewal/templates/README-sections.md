# POUR스토어 자사몰 — 카페24 스토어프론트 관리 미러

카페24 SmartDesign 스토어프론트에 올라가는 HTML을 **버전관리·관리용으로 정리**한 폴더.

---

## 📱 모바일 전용 섹션 규칙 (2026-10, 사용자 결정)
- **PC 화면은 사용자가 명시적으로 요청하지 않는 한 절대 바꾸지 않는다.** 모바일 개편용 신규 섹션은 기본 `display:none`, `@media (max-width:700px)`에서만 `display:block`.
- 현재 모바일 전용: 메인 `pour-01-main.html`의 `.psm1-qc`(카테고리 8개) · `.psm1-pb`(문제 카드 8장).
- 커밋 전 1280·768에서 페이지 높이·기존 요소 위치가 이전 커밋과 같은지 비교한다.
- 문제 카드 사진 = Firebase Storage `POUR스토어_리뉴얼/problem-cards/problem-N.jpg` (600×450, 4:3). 올리면 코드 수정 없이 자동 표시.
  | N | 카드 | N | 카드 | N | 카드 |
  |---|---|---|---|---|---|
  | 1 | 지붕·옥상 누수 ✅(2026-10-08) | 4 | 철재 녹 ✅(2026-10-08 교체) | 7 | 주차장 바닥 들뜸 ✅(2026-10-08) |
  | 2 | 건물 균열 ✅(2026-10-08) | 5 | 옥상 방수층 보완 ✅(2026-10-08) | 8 | 아스팔트 패임 ✅(2026-10-08) |
  | 3 | 외벽 페인트 벗겨짐 ✅(2026-10-08 교체) | 6 | 목재 색 바램 ✅(2026-10-08 교체) | 9 | 생활공간 개선 ✅(2026-10-08) |
- 카테고리 아이콘(선택) = `POUR스토어_리뉴얼/quick-icons/cat-N.png` (240×240): 1 방수 · 2 도장 · 3 균열보수 · 4 바닥보수 · 5 도로보수 · 6 보강자재 · 7 홈리페어 · 8 부자재

---

## 🧭 상단 헤더(로고·슬로건·검색창·탭) — 복사본 12곳 (⚠️ 바꿀 땐 전부 동일하게)

> 2026-10 모바일 상단 통일: 로고=동그란 엠블럼+오른쪽 "POUR스토어" 글자(PC·모바일·햄버거메뉴 동일), 슬로건 "누구나 쉽게, 오래가는 건축물 유지보수 자재의 모든 것"(Pretendard 600 12.5px, 검색창 위),
> 검색창 높이 폰 42px·PC 46px, 슬로건 PC·폰 동일 문구(Pretendard), 모바일 인기검색어 숨김, `.psm1-sticky` 크기 고정 블록(!important)으로 카페24 스킨 CSS 영향 차단, 태블릿(701~1100) 아이콘만 표시, 탭 순서 카테고리→베스트→POUR이야기. **기준본 = `common/pour-header.html`**

| 파일 | 쓰이는 곳 |
|---|---|
| `common/pour-header.html` (기준본) | 레이아웃 경유 전 페이지(상품목록·베스트 cate_no=104·검색 등) |
| `main/pour-01-main.html` | 메인 |
| `story/pour-story.html` · `story/case.html` · `story/event.html` | POUR이야기 · 시공사례 · 이벤트 |
| `construction/pour-construction-request.html` · `package/pour-package.html` | 시공문의 · 패키지 |
| `guide/guide.html` · `guide/guide-detail.html` (카페24 스킨 루트 `guide/`) | 셀프시공 |
| `delivery/delivery.html` (카페24 스킨 루트 `delivery/`) | 배송안내 |
| `category/best.html` · `category/pour-products.html` | (현재 메뉴 미사용, 동기화만 유지) |

- 독립 페이지들의 `<header>`~탭`</nav>` 블록은 기준본과 **글자 하나까지 동일**하게 유지(활성 탭은 JS가 URL 보고 자동 표시).

---

## 🟢 POUR닥터 실시간 채팅 위젯 — 어디를 고쳐야 하나 (⚠️ 꼭 읽기)

> **위젯(오른쪽 아래 채팅 버튼)을 바꿀 땐, 원본을 고친 뒤 아래 3곳에 그대로 반영하세요.**

| 구분 | 파일 | 적용 범위 |
|---|---|---|
| **원본(마스터)** | `common/pour-quickbtn.html` | 여기서 먼저 수정 (실제로는 안 실림, 관리 기준본) |
| 반영 ① | `common/pour-skin.html` | **레이아웃 타는 대부분 페이지** (전 페이지 로드) |
| 반영 ② | `main/index-main.html` | **메인**(단독 서빙, 레이아웃 안 탐) |
| 반영 ③ | `story/pour-story.html` | **POUR이야기**(단독 콘텐츠 페이지) |

- 위젯 코드는 `pour-quickbtn.html` 하나를 기준으로, **위 3곳(pour-skin·index-main·pour-story)** 을 같은 최신본으로 맞추면 전 사이트가 동일해집니다.
- **왜 3곳?** 메인·POUR이야기는 공통 레이아웃을 안 타는 단독 페이지라, pour-skin(레이아웃 경유)만으로는 위젯이 안 실립니다. 그래서 그 두 페이지는 위젯을 자체 포함합니다.
- 위젯엔 **중복 로드 방지 가드**(`window.__pourDoctorBooted`)가 있어, 한 페이지에 두 번 들어가도 1개만 뜹니다.

### 🚫 레이아웃(`layout/*.html`)에는 위젯을 넣지 마세요
- 레이아웃에 위젯을 인라인/@import하면 **카페24 스크립트 최적화(`optimizer.php`)와 충돌**해 상품/검색 페이지의 Swiper·메뉴가 깨집니다(2026-07 실제 사고 이력).
- 레이아웃은 위젯 없이 두고, 위젯은 **pour-skin(레이아웃 경유) + 단독 페이지 2곳**에서만 로드합니다.

---


> ⚠️ **레포 폴더 ≠ 카페24 폴더.**
> 이 폴더는 관리 편의를 위해 나눴을 뿐, **카페24는 전부 `pourstore_renewal/` 한 폴더(flat)**에 그대로 둡니다.
> 파일 안의 `@import` 경로(`/pourstore_renewal/…`)는 **카페24 경로**라서, 레포에서 폴더를 나눠도 바뀌지 않습니다.
> → 즉, 이 정리는 **레포만의 관리이고 카페24 조치는 필요 없습니다.**

## 폴더 구조

```
templates/
├── main/        메인(index.html) 조립 섹션
│   ├── index-main.html          ← @import 9+1개 조립 컨테이너
│   ├── pour-01-main.html        헤더·검색·인기검색어·히어로·카테고리
│   ├── pour-02-best.html        소재별 베스트
│   ├── pour-02b-vending.html    소재별 SKU 자판기
│   ├── pour-03-doctor.html      POUR닥터 배너
│   ├── pour-04-home.html        홈리페어×홈데코
│   ├── pour-05-shorts.html      숏츠 영상
│   ├── pour-06-service.html     서비스 아코디언
│   ├── pour-07-magazine.html    매거진
│   ├── pour-08-video.html       동영상 가이드
│   └── pour-09-record.html      실적·갤러리·협력사
├── search/      상품검색 결과 페이지 삽입 조각
│   └── pour-02-search-content.html   상품 아래 '관련 매거진' (pourstore-postings)
├── package/     패키지 별도 페이지 (GNB '패키지')
│   ├── pour-package.html        @import 6개 컨테이너 (별도 페이지, @layout O)
│   ├── pour-package-cate.html   cate_no=71 상품목록 상단 삽입 (JS 가드, @layout X)
│   ├── pkg-1-check.html         부위별 네비
│   ├── pkg-t-scope.html         등급 3단계
│   ├── pkg-2-best.html          베스트
│   ├── pkg-3-new.html           신규
│   ├── pkg-4-matrix.html        전체 매트릭스
│   └── pkg-5-video.html         시공 영상
├── cafe24-skin/ 카페24 네이티브 스킨 커스텀본 (pourstore_renewal 아님, 원위치 덮어쓰기)
│   └── list_product.html        상품카드 공통 스킨 — pour-card 통일 디자인(CSS)
├── _etc/        원본·시안 보관
│   ├── 패키지페이지-원본.html   (분할 전 원본, 소스 아카이브)
│   ├── main-banner-ohouse-v1.html
│   └── pour-default-detail-v1.html
└── README-sections.md
```

## 카페24 업로드 매핑 (전부 flat `pourstore_renewal/`)

| 레포 위치 | 카페24 위치 | 메인/GNB 연결 |
|---|---|---|
| `main/*` | `pourstore_renewal/*` | index.html이 `@import` |
| `search/pour-02-search-content.html` | `pourstore_renewal/pour-02-search-content.html` | 상품검색결과 스킨 맨 아래 `@import` |
| `package/*` | `pourstore_renewal/*` | GNB '패키지' → `pour-package.html` 화면 |
| `cafe24-skin/list_product.html` | 카페24 `product/list_product.html` (원위치 덮어쓰기) | 전체 상품목록 카드 공통 |
| `_etc/*` | (업로드 불필요, 아카이브) | — |

## 섹션 ↔ 데이터 ↔ 랜딩

| 섹션 | 데이터(Firestore) | 클릭 → |
|---|---|---|
| pour-01-main | `config/pourstoreHotkeywords` | 검색→`/product/search.html` |
| pour-02b-vending | (더미, 2단계 카페24 상품모듈) | `/product/list.html` |
| pour-09-record | `site-resources/pourstore-gallery`·`pourstore-partners` | pourstore.net |
| search/pour-02-search-content | `pourstore-postings` (태그 자동매칭) | 각 포스팅 링크 |
| package/pkg-5-video | `pourstore-postings` (placements⊇`pkg-video`) | 각 영상 링크 |
| package/pkg-4-matrix | `pourstore-packages` (부위×등급) | 각 상품 상세 |
| package/pkg-2-best | `pourstore-packages` (`best:true`) | 각 상품 상세 |
| package/pkg-3-new | `pourstore-packages` (`isNew:true`) | 각 상품 상세 |

> 패키지(`pourstore-packages`)는 어드민 '패키지 구성 관리'에서 상품별 `area`(부위)·`tier`(풀/부분/단순코팅)·`best`·`isNew`를 설정. 매트릭스는 부위×등급으로, 베스트/신규는 플래그로 자동 노출.

> 포스팅(`pourstore-postings`)은 어드민 '포스팅 관리'에서 등록. `placements`에 `pkg-video`를 지정하면 패키지 시공영상(pkg-5-video)에 노출. 검색 상단은 `tags` 자동매칭이라 placements 무관.

## 규칙
- 편집 시작 전 섹션은 **카페24가 source of truth**. 이 레포에서 편집·재배포할 때부터 레포가 원본.
- 이모지 미사용(인라인 SVG). 카피는 §3-5 표시광고·§3-6 금지어 준수.
- 카페24 저장은 한 파일씩(413 회피), 확인은 라이브+시크릿창.
