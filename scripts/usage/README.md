# Firebase 사용량 (pour-app-new)

사용자 결정(2026-10-11): "매일 한도 측정 보게 하고, 매주 한도 보고 · 한화 10만 원 넘으면 문자"

| 무엇 | 어디 |
|---|---|
| 화면 | https://pour-construction-form.pages.dev/firebase-usage.html (업무OS 더보기 › 관리자 › Firebase 사용량) |
| 측정 | GitHub Actions `firebase-usage.yml` — 3시간마다 (한국 00:17 · 03:17 · 06:17 · 09:17 …) |
| 저장 | Firestore `pour-os/v2/usage/pour-app-new` (문서 하나 · 화면은 이것만 읽음) |
| 문자 | 이번 달 예상 요금이 10만 원(`vars.USAGE_ALERT_KRW`)을 넘으면 그 달 1번 · 한국 월요일 9시 뒤 주간 보고 1번 · 같은 사이트 `/send-sms`(솔라피) |
| 계산 | `core.mjs` (시험 `node scripts/usage/core.test.mjs`) · 실행 `run.mjs` · 화면·실행 시험 `node scripts/usage/e2e.mjs` (가짜 서버 · 실제 요청 없음) |

## 계산
- 하루 = 태평양 시간 하루 (무료 한도가 태평양 자정 = 한국 16시, 11월~3월은 17시에 다시 채워짐 · 구글 청구 달도 태평양 시간)
- Cloud Monitoring 지표: Firestore `document/read_ops_count`·`write_ops_count`·`delete_ops_count`(없으면 `read_count` 등) · Storage `total_bytes`·`network/sent_bytes_count` — 1시간 칸으로 받아 하루로 더함
- 예상 요금(Blaze 기준) = 하루 무료(읽기 5만 · 쓰기 2만 · 삭제 2만) 넘은 만큼 × 10만 건당 $0.06 · $0.18 · $0.02(다중 리전 값 = 넉넉하게) + Storage 저장 GB당 월 $0.026 · 내려받기 GB당 $0.12(무료분 안 뺌) · 1달러 1,400원(`vars.USAGE_FX`)
- 실제 청구 금액은 Google Cloud 결제 화면이 정답 → 결제 › 예산 및 알림(예산 10만 원 · 50·90·100% 메일)도 같이 걸어 둠
- 못 읽은 지표는 0으로 두지 않고 화면 빨간 칸 + 실행 실패로 보임

## 처음 한 번 (사용자 · PC)
1. Firebase 콘솔 › 프로젝트 설정 › 서비스 계정 › **새 비공개 키 생성** (JSON 파일)
2. GitHub `pour-construction-form` › Settings › Secrets and variables › Actions › New repository secret
   - `POUR_OS_FIREBASE_CLIENT_EMAIL` = JSON 의 `client_email`
   - `POUR_OS_FIREBASE_PRIVATE_KEY` = JSON 의 `private_key` (-----BEGIN 부터 END----- 까지 그대로)
   - `ALERT_PHONE` = 문자 받을 휴대폰 번호
   - `OPS_TOKEN` = 아무 긴 글자(직접 정함) — **Cloudflare Pages › 설정 › 환경변수 `OPS_TOKEN` 에도 같은 값** (문자 함수가 우리 사이트 밖에서 온 요청은 이 토큰으로만 받음 · 2026-10-11)
3. Google Cloud 콘솔 › IAM › 위 `client_email` 계정 › 역할 추가 **모니터링 뷰어(Monitoring Viewer)**
4. GitHub › Actions › Firebase 사용량 › Run workflow → 화면에 첫 측정 (실패 글에 'Cloud Monitoring API has not been used'가 보이면 Google Cloud › API › Cloud Monitoring API [사용] 후 다시)
- 키는 채팅·메일로 보내지 않고 GitHub 시크릿에만 넣음
- 같은 시크릿으로 `firestore-rules-deploy.yml`(규칙 배포)도 동작함 — main 의 `firestore.rules` 가 바뀌거나 Run workflow 를 누를 때만 배포
- 백업은 **비공개 저장소 `netformrnd-lab/pour-backups`** 가 매일 한국 03:30 스스로 함 (2026-10-11) — Blaze 전환 뒤 그 저장소 Settings › Secrets 에 같은 `POUR_OS_FIREBASE_CLIENT_EMAIL` · `POUR_OS_FIREBASE_PRIVATE_KEY` 를 넣으면 시작
  - 이 저장소의 예전 백업 잡(`pour-os-backup.yml` · `firestore-backup.yml`)은 변수 `BACKUP_REPO` 가 없으면 돌지 않음(그대로 둠) — 이 저장소는 Cloudflare Pages 가 브랜치마다 공개 미리보기를 만들어서 백업을 두면 안 됨
