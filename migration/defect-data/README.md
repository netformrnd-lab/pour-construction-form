# 공법분석(하자사진) 데이터 이전 — pour-app-new → pourstorecrm

현재 어드민 **공법분석**에 쌓인 하자사진 데이터를 CRM 레포(`pourstorecrm`)에서 쓰도록 옮기는 자료입니다.

## 들어있는 것

| 파일 | 내용 |
|---|---|
| `defect-photos.json` | **하자사진 174장** (마누스 임포트 160 + 수동 14). 각 항목에 `method/methods[]`, `defectType/defectTypes[]`, `imageUrl`, `description`, `label`, `source` |
| `defect-templates.json` | 하자 분류 템플릿 1건(`type`,`keywords`,`desc`) |
| `defect-config.json` | `config/defectTypesMeta` — 태그 메타 11개(라벨·순서·대표사진 등) |
| `import-to-crm.mjs` | 위 JSON을 pourstorecrm Firestore로 넣는 스크립트 |

> 이 JSON은 `pour-app-new` Firestore에서 그대로 추출한 값입니다(읽기 규칙이 열려 있어 그대로 export).

## 이미지 위치 (중요)

- **160장 → 마누스 CDN** (`d2xsxph8kpxj0f.cloudfront.net`, 출처 `hajaviewer-….manus.space`)
- **14장 → pour-app-new 스토리지** (`firebasestorage.googleapis.com`)

둘 다 **공개 URL**이라 CRM에서 `imageUrl` 그대로 `<img>` 로 바로 표시됩니다(프로젝트가 달라도 URL 참조는 무관).
단, 마누스 CDN이 내려가면 160장이 깨질 수 있으니 **장기 보관이 필요하면 자체 스토리지로 재호스팅**을 권장합니다(선택).

## CRM으로 넣기

```bash
# CRM 레포(또는 로컬)에서
npm i firebase-admin

# pourstorecrm 서비스계정 키 발급:
#   Firebase 콘솔 → pourstorecrm → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON)

# 미리보기(쓰지 않고 건수만)
node import-to-crm.mjs --key ./pourstorecrm-sa.json --dry

# 실제 이전 (원본 문서 ID 유지)
node import-to-crm.mjs --key ./pourstorecrm-sa.json
```

옵션:
- `--photos <컬렉션명>` (기본 `defect-photos`) / `--templates <컬렉션명>` (기본 `defect-templates`)
- `--config <문서경로>` (기본 `config/defectTypesMeta`, `skip`이면 생략)
- `--new-ids` 자동 ID로 새로 생성(기본은 원본 ID 유지 → 재실행 시 덮어쓰기)

각 문서에는 `migratedFrom:"pour-app-new"`, `migratedAt` 이 함께 기록됩니다.

## 데이터 스키마 요약 (defect-photos)

```jsonc
{
  "id": "0EWaxST9fJdZKyykNu75",
  "method": "POUR 기타 방수 공법",          // 대표 공법(구 단일 필드)
  "methods": ["…"],                          // 복수 공법(있는 경우)
  "defectType": "탈락",                       // 대표 하자유형
  "defectTypes": ["…"],                       // 복수 태그(있는 경우)
  "label": "탈락45",
  "description": "바닥면의 도장재가 광범위하게 벗겨져…",
  "imageUrl": "https://d2xsxph8kpxj0f.cloudfront.net/…jpg",
  "source": "manus",                          // manus | manual
  "sourceUrl": "https://hajaviewer-….manus.space",
  "createdAt": "2026-04-10T07:51:57.748Z",
  "updatedAt": "…"
}
```

> 마누스가 만든 하자유형/공법 명칭이 자유롭게 들어있습니다(예: `공기포 발생`, `장시간 물고임`, `POUR 기타 방수 공법`).
> CRM에서 정규 명칭으로 정리하려면 임포트 후 매핑 테이블로 일괄 치환하는 것을 권장합니다.

## 원본 사진 재호스팅 + 똑같이 자동분류 (선택, 권장)

마누스 CDN 의존을 없애고 **원본 사진을 내 Firebase에 올려** 동일 분류로 정리하려면:

1. **매핑표**: `defect-classification-by-filename.json`
   - 마누스가 붙인 `_<해시>`를 뗀 **원본 파일명 → 분류(공법·하자유형·설명·라벨)** 표.
   - 예: `KakaoTalk_20251021_153916658_20.jpg` → `{ defectType:"탈락", method:"POUR 기타 방수 공법", … }`
2. **원본 업로드**: 원본 사진을 **원래 파일명 그대로** Firebase Storage 한 폴더(기본 `defect-originals/`)에 올립니다.
3. **자동분류 실행**:
   ```bash
   npm i firebase-admin
   node classify-by-filename.mjs --key ./sa.json --bucket <프로젝트>.appspot.com --dry   # 매칭 미리보기
   node classify-by-filename.mjs --key ./sa.json --bucket <프로젝트>.appspot.com          # 실제 생성
   ```
   - 올라온 파일을 파일명으로 매칭 → 그 사진을 가리키는 `defect-photos` 문서를 마누스 분류 그대로 생성(`source:"manus-rehosted"`).
   - 매칭/미매칭 결과를 `classify-report.json`으로 남깁니다.

**주의**
- 원본은 **마누스가 해시 붙이기 전 파일명**이어야 매칭됩니다(카톡 원본명 유지 등).
- **파일명 중복 7건**(`KakaoTalk_20251021_153916658_01/03/05/06/07/10/18.jpg`) — 마누스가 같은 카톡앨범을 두 번 임포트한 흔적이라 수동 확인 권장.
- **이미 Firebase에 있는 14장**은 재호스팅 불필요(매핑표에서 `alreadyFirebase:true`로 제외).

## 데이터 재추출(원본이 바뀌었을 때)

`pour-app-new`의 `defect-photos`/`defect-templates`는 읽기가 열려 있어 인증 없이 다시 뽑을 수 있습니다:

```
GET https://firestore.googleapis.com/v1/projects/pour-app-new/databases/(default)/documents/defect-photos?pageSize=300
```
(페이지네이션은 `nextPageToken` 사용)
