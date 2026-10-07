# POUR스토어 OS2 사용 안내 페이지

## 목표
`pour-app-guide.html`의 긴 스크롤형 영상 매뉴얼 흐름을 참고해, `os2.html`(팀원용 업무OS)과 `os2-admin.html`(관리자 대시보드)의 역할·주요 사용법·운영 루프를 한 페이지에서 안내한다.

## 구현 방식
- 기존 저장소의 정적 HTML/Cloudflare Pages 구조를 그대로 사용한다.
- 새 페이지는 `pourstore-renewal/os2-guide.html`에 독립 정적 HTML로 추가한다.
- 기존 페이지를 직접 임베드하지 않고, 실제 기능을 설명하는 CSS 목업과 탭 인터랙션으로 로딩 비용과 인증/데이터 노출을 피한다.
- 실제 사용자 화면과 관리자 화면으로 이동할 수 있는 CTA를 제공한다.
- `/pourstore-renewal/os2-guide` extensionless 경로는 `_redirects`에서 새 HTML로 연결한다.

## 디자인
- **Design Movement**: 운영 매뉴얼을 제품 랜딩처럼 정리하는 editorial product documentation.
- **Core Principles**: 역할이 즉시 보이는 2-lane 구조, 한 화면 한 메시지, 기록의 흐름을 시각화, 모바일 우선 가독성.
- **Color Philosophy**: 네이비는 신뢰·관리, 블루는 실행·담당, 바이올렛은 관리자 판단, 민트는 완료와 건강한 흐름을 표현한다.
- **Layout Paradigm**: 중앙 카드 그리드보다 좌우 역할 레일과 세로 스토리텔링을 사용한다.
- **Signature Elements**: sticky step rail, 디바이스 목업, 숫자 배지와 상태 칩.
- **Interaction Philosophy**: 읽는 사람이 자신의 역할을 고르면 관련 설명과 목업이 즉시 강조된다.
- **Animation**: 섹션 진입 fade-up, 목업 상태 전환, 과도하지 않은 pulse.
- **Typography System**: Pretendard 단독, 큰 900 weight 헤드라인과 12–15px 본문 대비.
- **Brand Essence**: 누베오 팀이 POUR스토어의 업무를 누비며 기록과 다음 일을 놓치지 않도록 돕는 운영 가이드. 성격은 명확함·차분함·실행 중심.
- **Brand Voice**: “오늘 할 일을 열고, 다음 사람에게 흐름을 넘겨요.” / “관리자는 문제를 찾는 대신, 다음 행동을 정리해요.”
- **Wordmark & Logo**: 둥근 사각형 안에 N을 넣은 누베오 운영 배지.
- **Signature Brand Color**: `#4F7CFF` 실행 블루.

## 구조
- `#start`: 두 화면의 역할과 진입 링크
- `#member`: 사용자 화면의 4탭과 업무 실행 흐름
- `#admin`: 관리자 화면의 현황·사람·프로젝트·정리·보고
- `#loop`: 데이터 흐름과 일상 운영 루프
- `#check`: 첫 사용 체크리스트와 주의사항
