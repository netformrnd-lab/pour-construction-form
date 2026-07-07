# POUR스토어 자사몰 — 카페24 스토어프론트 관리 미러

카페24 SmartDesign 스토어프론트에 올라가는 HTML을 **버전관리·관리용으로 정리**한 폴더.

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
| search/pour-02-search-content | `pourstore-postings` | 각 포스팅 링크 |

## 규칙
- 편집 시작 전 섹션은 **카페24가 source of truth**. 이 레포에서 편집·재배포할 때부터 레포가 원본.
- 이모지 미사용(인라인 SVG). 카피는 §3-5 표시광고·§3-6 금지어 준수.
- 카페24 저장은 한 파일씩(413 회피), 확인은 라이브+시크릿창.
