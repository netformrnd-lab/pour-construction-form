# 분해원가 견적서 파일 — 저장소 고르기 (2026-11-25)

업체 견적(업체 × 구성요소)마다 견적서를 여러 개 붙입니다. 견적서엔 업체 실명이 있으니 **마스터·경영 열람만** 봅니다(부마스터·팀원 안 됨).

- 파일 **목록**(이름·종류·주소)은 어느 저장소든 `cost-names/{카드}.vfiles[줄][업체]` 에 둡니다 — 지금 보안 규칙 그대로(마스터·경영 열람만 읽기, 마스터만 쓰기).
- 화면 코드: `pourstore-cost.html` 의 `FILE_STORE` (`mode: "link"` → `"r2"` 또는 `"gcs"`).

## 지금 (송희님 답 전)

| 방식 | 상태 |
|---|---|
| ③ 노션 견적서 페이지·파일 **링크** | ✅ 동작 — 📎 → [링크 붙이기] · 노션 가져오기의 `files` 도 여기로 |
| ① Cloudflare R2 + Pages Functions | 구조만 (화면의 올리기·미리보기·내려받기 코드는 준비, 서버 쪽은 고르면 추가) |
| ② Firebase Storage | 구조만 (Blaze 요금제 필요) |

## ① Cloudflare R2 를 고르면 — 할 일 (송희님 또는 담당)

1. **R2 버킷 만들기**: Cloudflare 대시보드 › R2 › [버킷 만들기] → 이름 `pour-quote-files` · 공개 접근 **끔** (기본값 그대로).
2. **Pages 에 버킷 연결**: Workers & Pages › `pour-construction-form` › 설정 › 바인딩 › [추가] › R2 버킷 → 변수 이름 `QUOTE_FILES` · 버킷 `pour-quote-files` → **프로덕션·미리보기 둘 다**.
3. **환경 변수**: 같은 설정 › 변수 → `FIREBASE_PROJECT_ID` = `pourstoreproject` (프로덕션·미리보기).
4. 여기까지 되면 알려 주세요 → Claude 가 `functions/api/quote-files/[[path]].js` 를 추가하고 화면 `FILE_STORE.mode` 를 `"r2"` 로 바꿉니다.
   - 요청마다 파이어베이스 로그인 토큰 확인(구글 공개키로 서명·프로젝트·만료) → `config/access` 로 마스터·경영 열람인지 확인
   - 올리기 = 마스터만 · PDF·이미지만 · 파일당 20MB · 보기·내려받기 = 마스터·경영 열람
5. 미리보기 주소에서 올리기·미리보기·내려받기 시험 → "올려".

- 비용: R2 저장 10GB/월 무료, 내려받기(전송) 무료. 견적서 PDF 수천 장 수준이면 0원.
- Firestore 보안 규칙 변경 없음.

## ② Firebase Storage 를 고르면

1. Firebase 콘솔 › pourstoreproject › 요금제 **Blaze**(종량제)로 올리기 (무료 한도 5GB 안이면 0원이지만 카드 등록 필요).
2. Storage 시작 → **Storage 보안 규칙**(Firestore 규칙과 별개 파일)에 '마스터·경영 열람만 읽기, 마스터만 쓰기' 규칙을 붙여 넣기 — Claude 가 규칙 전문을 드립니다.
3. 화면에 `firebase-storage-compat` 스크립트 추가 + `FILE_STORE.mode = "gcs"` (Claude).

## ③ 노션 링크만 쓰면

할 일 없음. 파일은 노션에 두고, 분해원가에는 링크만. (노션 페이지 권한이 있는 사람만 열림)
