# POUR OS — 데이터 안전 설계

데이터 축적·저장 안전성에 대한 구조와 복구 절차.

## 저장 구조 (v2 — 컬렉션별 분할)

앱 상태는 Firebase 프로젝트 `pour-app-new`의 Firestore에 **컬렉션별 문서로 분할** 저장된다.

| 문서 경로 | 내용 |
|---|---|
| `pour-os/state-users` | 담당자 |
| `pour-os/state-goals` | 최종목표 |
| `pour-os/state-mainKPIs` / `state-subKPIs` | 메인/서브 KPI |
| `pour-os/state-projects` | 프로젝트(매출·기여·목표지표 포함) |
| `pour-os/state-tasks` | 업무 |
| `pour-os/state-personalGoals` / `state-retros` / `state-aiReviews` / `state-events` | 개인목표·회고·AI점검·일정 |
| `pour-os/state-meta` | `{v:2}` 마이그레이션 버전 마커 |
| `pour-os/state` | **레거시 단일문서** — v1 데이터. 마이그레이션 소스로 보존(비상 백업) |

각 문서는 `{ items:[...], _updatedAt }` 형태. **Firestore 문서 한도(1 MiB)가 컬렉션마다 따로** 적용되므로 단일문서(v1) 대비 약 10배+ 여유. 변경 시 **바뀐 컬렉션 문서만** 저장하므로 서로 다른 영역을 동시에 편집해도 충돌하지 않는다.

> 보안규칙: 기존 `match /pour-os/{doc}` 가 `state-*` 형제 문서를 이미 허용 → **규칙 변경 불필요**.

## 마이그레이션 (자동·멱등)
- 앱 최초 로드 시 `state-meta.v !== 2` 이면, 레거시 `pour-os/state`(없으면 INIT)를 읽어 컬렉션별 문서로 1회 분리하고 `state-meta.v=2` 기록.
- 레거시 문서는 **삭제하지 않는다**(롤백·대조용). 여러 기기가 동시에 실행해도 같은 소스라 안전.

## 3중 안전망
1. **저장 실패 가시화** — 실패/한도임박 시 화면 상단 경고 배너(+즉시 백업 버튼). 더 이상 조용히 유실되지 않음.
2. **로컬 거울저장** — 매 저장마다 이 기기 `localStorage`(`pour-os-mirror`)에 전체 상태 사본. 원격 실패해도 기기에 생존. 탭 종료(`beforeunload`/`visibilitychange`) 시에도 flush.
3. **오프디바이스 백업**
   - 수동: KPI ▸ 데이터 추출 ▸ **전체 백업(JSON)** — 언제든 파일로.
   - 자동: GitHub Actions `pour-os-backup.yml` 가 **매일 00:05 KST** pour-os 컬렉션을 `backup/firestore-snapshots` 브랜치 `backups/prod/<날짜>/pour-os.json` 으로 적재.

용량은 KPI ▸ 데이터 추출 패널의 **게이지**(가장 큰 컬렉션 기준, 60%/85% 경고)로 상시 확인.

## GitHub 자동백업 세팅 (1회)
Repo ▸ Settings ▸ Secrets and variables ▸ Actions 에 등록:

| Secret | 값 |
|---|---|
| `POUR_OS_FIREBASE_CLIENT_EMAIL` | `pour-app-new` 서비스 계정 이메일 |
| `POUR_OS_FIREBASE_PRIVATE_KEY` | 서비스 계정 비공개키(`\n` 포함 전체) |
| `BACKUP_GITHUB_TOKEN` | 백업 브랜치에 커밋 가능한 토큰(기존 백업과 공용) |

> 서비스 계정 키: Firebase 콘솔 ▸ pour-app-new ▸ 프로젝트 설정 ▸ 서비스 계정 ▸ 새 비공개 키 생성.
> 미설정 시 워크플로는 "필수 시크릿 누락" 으로 즉시 실패하여 알려준다(데이터에는 영향 없음).

## 복구 절차
- **개별 기기에서 임시 유실 의심**: 새로고침 전에 전체 백업(JSON) 내려받기 → 보관.
- **원격 손상/되돌리기**: `backup/firestore-snapshots` 브랜치의 `backups/prod/latest/pour-os.json` 에서 해당 `state-*` 문서의 `items` 를 Firestore에 복원.
- **레거시 대조**: v1 시점 데이터는 `pour-os/state` 문서에 그대로 남아 있음.

## 남은 한계 / 다음 단계
- 같은 컬렉션을 두 명이 **동시에** 편집하면 여전히 마지막 저장이 우선(블래스트 반경은 그 컬렉션 1개로 축소됨).
- 한 컬렉션이 단독으로 1 MiB에 근접하면(게이지 85%+) **항목 단위 문서 분할(서브컬렉션)** 로 추가 개선 가능.
