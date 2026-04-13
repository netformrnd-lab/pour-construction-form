# POUR공법 웹 프로젝트 — Claude Code 컨텍스트

## 개발 스택
- **Frontend**: React + Vite (Cloudflare Pages 배포)
- **Backend/DB**: Firebase (Firestore + Storage + Auth)
- **배포**: Cloudflare Pages (GitHub 연동 자동 배포)
- **이미지 호스팅**: Firebase Storage
- **버전관리**: GitHub

## 프로젝트 개요
넷폼알앤디(NetForm R&D)의 POUR공법 브랜드 웹사이트.
3가지 방수 공법 제품 소개 및 기술 제안서를 웹으로 전환한 사이트.

## 핵심 데이터 파일
```
pour_content.json        ← PDF에서 추출한 전체 콘텐츠 (95페이지, 422개 이미지)
public/images/           ← PDF 임베디드 이미지 422개 (JPG/PNG)
public/pages/            ← 페이지 전체 스크린샷 95개 (JPG, 1440×810)
scripts/                 ← 유틸리티 스크립트
```

## pour_content.json 구조

```json
{
  "dual":  { "name": "듀얼강화방수", "total_pages": 34, "pages": [...] },
  "pvc":   { "name": "PVC방수",      "total_pages": 34, "pages": [...] },
  "metal": { "name": "금속지붕/칼라강판", "total_pages": 27, "pages": [...] }
}
```

### 페이지 오브젝트 구조
```json
{
  "page": 1,
  "type": "intro",          // intro|problem|solution|process|spec|other
  "title": "페이지 제목",
  "text": "추출된 텍스트 (띄어쓰기 이슈 있음 — 텍스트보다 page_image 우선 사용)",
  "page_image": "dual_page_01.jpg",          // public/pages/ 폴더
  "embedded_images": [
    {
      "filename": "dual_p01_img00.jpeg",     // public/images/ 폴더
      "width": 3707,
      "height": 2476,
      "format": "jpeg"
    }
  ],
  "image_count": 2
}
```

### 페이지 타입 분포
| type     | 의미         | 페이지 수 |
|----------|------------|---------|
| intro    | 회사소개/개요   | 7       |
| problem  | 하자유형/문제   | 54      |
| solution | 해결방안/제품특징 | 9       |
| process  | 시공순서      | 12      |
| spec     | 시험성적서     | 2       |
| other    | 기타        | 11      |

## 이미지 파일 명명 규칙
- 페이지 스크린샷: `{product}_page_{nn}.jpg` → `dual_page_01.jpg`
- 임베디드 이미지: `{product}_p{nn}_img{nn}.{ext}` → `dual_p03_img00.jpeg`
- product: `dual` | `pvc` | `metal`

## Firebase 설정
```javascript
// Firebase Storage 버킷에 public/images/, public/pages/ 업로드 후
// pour_content.json의 이미지 경로를 Storage URL로 업데이트할 것
// scripts/upload_to_firebase.py 실행
```

## 개발 지침

### 이미지 사용 원칙
- **page_image (스크린샷)**: 슬라이드 전체 보여줄 때 사용
- **embedded_images**: 개별 사진/다이어그램 갤러리에 사용
- 텍스트는 PowerPoint→PDF 변환으로 띄어쓰기가 붙어있을 수 있음
  → UI 텍스트는 JSON text 필드 대신 직접 작성 권장

### POUR 브랜드 컬러
```css
--pour-orange: #E87722;   /* 메인 */
--pour-dark:   #1A1208;   /* 배경 다크 */
--pour-brown:  #3D2B1F;   /* 서브 다크 */
--pour-cream:  #F7F3EE;   /* 배경 라이트 */
```

### Cloudflare Pages 배포
```bash
npm run build   # dist/ 생성
# GitHub push → Cloudflare Pages 자동 배포
```

### 주요 제품 정보 (POUR공법)
- 누적 시공 세대: 240만+
- 전국 파트너사: 250곳+
- 2025년 누적 거래액: 850억+
- 특허기술: 50개+
- 건설신기술: 국토교통부 지정 1026호
- GS건설 & 호반 SI 투자 유치
- 강남제비스코 공동 R&D
- 서울과기대 공동연구

## 작업 우선순위 (추천 순서)
1. `scripts/upload_to_firebase.py` 실행 → 이미지 Storage 업로드
2. Vite + React 프로젝트 초기화
3. pour_content.json을 Firebase Firestore로 마이그레이션 (선택)
4. 3개 공법 랜딩페이지 구현
5. Cloudflare Pages 배포 설정
