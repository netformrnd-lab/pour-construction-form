# 업무OS v2 (시험판) — pour-os-v2/

- 주소: `https://pour-construction-form.pages.dev/pourstore-renewal/os2.html` (v1 은 `os.html` 그대로)
- 빌드: `cd pour-os-v2 && npx vite build && cp dist/index.html ../pourstore-renewal/os2.html`
  (node_modules 는 `../pour-os/node_modules` 심볼릭 링크 — 같은 패키지)
- 테스트: `node src/model.test.mjs` (계산 로직). 화면 시험은 가짜 저장 장치로만 — 실제 Firestore 에 쓰지 않음.

## v1 보호 (가장 중요)
- 쓰기는 오직 `pour-os/v2/**` 와 Storage `task-attachments/v2/**`. v1 문서(`pour-os/state-*`, `pour-os/ak-notes/c`)는 **읽기만**.
- 기기 저장 이름도 `pour-os2-…` 로 따로 (v1 `pour-os-…` 와 안 겹침).
- 보안규칙 `pour-os/{doc=**}` · `task-attachments/**` 안이라 **규칙 변경 없음**.

## 저장 구조
- `pour-os/v2` — 복사 정보 {seededAt, counts, reseededAt, reseededBy}
- `pour-os/v2/<키>/{id}` — 1건 = 문서 1개 (tasks · projects · users · notes · log · events · brands …). 바뀐 칸만 `updateDoc`.
- 고정업무 체크: 업무의 `doneDates.<사람>` 등 사람별 칸만 점 경로로 저장 + `pour-os/v2/checks/{업무~사람~날짜}` 기록.
- 처음 열 때 '버전1 데이터 복사하기'(읽기 전용 복사). 마스터는 더보기 › '버전1에서 다시 가져오기'(merge — v2 전용 칸 유지).
- 읽기 비용: 열린 업무 + 최근 30일 끝낸 업무 + 최근 30일 댓글 + 14일 기록만 구독. 나머지는 열 때 조건 조회.

## 로그인
- 사람 고르기 → PIN 4자리(처음이면 정하기). 해시는 v1 과 같은 계산(`pour-os-pin:<id>:<pin>`) → 마스터의 기존 PIN 그대로.
- 5번 틀리면 5분 잠금. 마스터가 사람 보기에서 PIN 초기화.

## 화면 (1단계)
- 탭 4개: 오늘(확인할 것 · 오늘 고정업무 · 할 일) / 프로젝트 / 팀(사람 · 소식) / 더보기
- 업무 보기: 요약 → 메모 → 하위 업무 → 대화 → 파일 → 기록. 남의 일은 '내가 이어서 하기'.
- 프로젝트 한 장: 지금 상황 + 다음 할 일 → [업무 | 소식 | 자료] → 정보.
- 디자인: 네이비 #24386B/#0F1F5C, 배경 #F4F5F8, 빨강은 '지남'에만. 이모지·아이콘 버튼·그라디언트 없음.
