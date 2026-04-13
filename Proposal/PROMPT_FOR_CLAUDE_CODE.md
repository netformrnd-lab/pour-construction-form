# Claude Code 첫 번째 프롬프트 (복붙용)

아래 내용을 Claude Code 첫 메시지로 붙여넣으세요.
---

## 작업 요청

POUR공법 웹사이트를 개발해줘. CLAUDE.md 먼저 읽고 작업해줘.

### 기술 스택
- React + Vite + TypeScript
- Tailwind CSS
- Firebase (Firestore + Storage)
- Cloudflare Pages 배포

### 디렉토리 구조
```
/
├── CLAUDE.md                    ← 프로젝트 컨텍스트 (반드시 먼저 읽기)
├── pour_content.json            ← 추출된 PDF 콘텐츠 (95페이지, 422이미지)
├── public/
│   ├── images/                  ← 임베디드 이미지 422개
│   └── pages/                   ← 페이지 스크린샷 95개
└── scripts/
    ├── upload_to_firebase.py    ← Firebase Storage 업로드
    └── migrate_to_firestore.py  ← Firestore 마이그레이션
```

### 작업 순서
1. CLAUDE.md 읽기
2. pour_content.json 구조 파악
3. Vite + React + TS 프로젝트 초기화
4. 아래 페이지 구현

### 구현할 페이지
- `/` — 메인 랜딩 (3개 공법 소개)
- `/dual` — 듀얼강화방수 공법 상세
- `/pvc` — PVC방수 공법 상세
- `/metal` — 금속지붕/칼라강판 방수공법 상세

### 각 상세 페이지 구성
- 히어로 섹션 (page_image 사용)
- 하자유형 섹션 (type === 'problem' 페이지들)
- 해결방안 섹션 (type === 'solution' 페이지들)
- 시공순서 섹션 (type === 'process' 페이지들)
- 이미지 갤러리 (embedded_images)

### 이미지 경로 (로컬 개발 시)
- 스크린샷: `/pages/{page_image}` 
- 임베디드: `/images/{filename}`
- Firebase Storage 업로드 후: JSON의 url/page_image_url 필드 사용

### 브랜드 컬러
- 메인 오렌지: #E87722
- 다크: #1A1208
- 크림: #F7F3EE

Cloudflare Pages 배포를 위한 wrangler.toml도 세팅해줘.

---
# 이 파일 설명이 끝남. 위 --- 사이 내용만 Claude Code에 붙여넣으세요.
