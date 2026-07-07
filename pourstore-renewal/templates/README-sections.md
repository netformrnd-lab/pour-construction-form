# POUR스토어 자사몰 메인 — 섹션 관리 (카페24 스마트디자인)

카페24 메인(`index.html`)이 `@import`로 9개 섹션을 조립. 각 섹션 파일은
카페24 `pourstore_renewal/` 폴더에 존재하며, 이 `templates/` 폴더가 **버전관리 미러**.

> 원칙: 편집을 시작하지 않은 섹션은 **카페24가 원본(source of truth)**.
> 이 저장소 파일을 편집·재배포할 때부터 이쪽이 원본이 됨.

## 조립 순서 (index-main.html)

| # | 파일 | 스코프 | 역할 | 연결 데이터(Firestore) | 클릭 → 랜딩 |
|---|------|--------|------|------------------------|-------------|
| 1 | `pour-01-main.html` | `.psm1` | 헤더(로고·검색·인기검색어·자동완성)+히어로+카테고리 | `config/pourstoreHotkeywords` | 검색→`/product/search.html` |
| 2 | `pour-02-best.html` | `.psm2` | 소재별(철재/목재/돌·시멘트) 베스트 상품 가로슬라이드 | (정적, 추후 상품연동) | 상품 상세 |
| 3 | `pour-03-doctor.html` | `.pdq` | POUR닥터 1:1 무료 진단 배너 | — | `./pour-doctor.html` |
| 4 | `pour-04-home.html` | `.psh` | 홈리페어×홈데코 큐레이션(캐러셀+재질필터) | (정적, 추후 상품연동) | 상품 리스트 |
| 5 | `pour-05-shorts.html` | `.psy3` | 숏츠(1분 시공) 세로영상 그리드 | (정적, 추후 영상연동) | 영상 |
| 6 | `pour-06-service.html` | `.psv2` | 서비스 안내 아코디언(대리점/파트너/쇼룸) | — | pourstore.net |
| 7 | `pour-07-magazine.html` | `.psg3` | 매거진(노하우·사례) 그리드 | (정적, 추후 게시판연동) | 게시글 |
| 8 | `pour-08-video.html` | `.psg4` | 동영상 가이드(피처+미니리스트) | (정적, 추후 영상연동) | 영상 |
| 9 | `pour-09-record.html` | `.pst2` | 실적 수치+시공현장 갤러리+협력사 로고 | `site-resources/pourstore-gallery`, `site-resources/pourstore-partners` | pourstore.net |

## 별도 조각 (메인 조립에 미포함)

| 파일 | 위치 | 역할 | 데이터 |
|------|------|------|--------|
| `pour-02-search-content.html` | 카페24 상품검색결과 스킨 상단 | 검색 상단 '관련 컨텐츠' 카드 | `pourstore-postings` |

## 랜딩 페이지 작업 (TODO)

9번(실적)을 제외한 섹션들은 클릭 시 이동할 **랜딩 페이지**가 필요.
일부는 작업됨/일부 미작업 — 작업 시 사용자와 협의 후 진행.

- [ ] pour-01 히어로/카테고리 링크 목적지 확정
- [ ] pour-02 소재별 베스트 → 실제 상품/분류 연결
- [ ] pour-03 `pour-doctor.html` 랜딩
- [ ] pour-04 홈리페어×홈데코 → 상품 리스트 연결
- [ ] pour-05 숏츠 → 영상 페이지
- [ ] pour-06 서비스 → 대리점/파트너/쇼룸 랜딩
- [ ] pour-07 매거진 → 게시글
- [ ] pour-08 동영상 가이드 → 영상 페이지
