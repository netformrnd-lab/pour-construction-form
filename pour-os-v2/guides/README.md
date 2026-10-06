# 업무OS v2 사용법 영상 (자막만)

- 팀원 앱(폰 세로) `team.mjs` · 관리자 화면(PC 가로) `admin.mjs` — 2026-10-06 제작
- 영상 파일(mp4)은 이 저장소가 공개라 올리지 않음 (실제 업무 이름·매출 숫자가 나옴). 사내 채널로만 공유.
- 만드는 법: 가짜 저장 장치 빌드(scratchpad os2/tdist · admin-build/tdist) + 실데이터 읽기 전용 복사본(real.json, 저장소에 안 올림)
  1. `node team.mjs` (rec.mjs: Playwright + CDP 화면 캡처 · 구글 주소 모두 막음 → 실제 Firestore 에 안 씀 · 시계 2026-10-06 10:00 고정)
  2. `python3 build.py out/team portrait out/team.mp4 "<제목>" "<줄|줄>" "<끝 카드>"` (자막 = Pretendard ASS · 앞뒤 카드)
  3. `python3 frames.py out/team out/team.mp4` (자막마다 1장 · 읽을 시간 검사)
- 목소리: 음성 파일 받는 주소가 작업 환경 네트워크 정책에 막혀 자막만.
