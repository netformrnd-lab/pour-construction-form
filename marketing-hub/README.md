# POUR 마케팅 허브 — 데이터 자동 축적

> 사용자 작업지시서(2026-10-08 claude.ai 대화 정리)를 이 폴더에서 구현한 것. 옵시디언 볼트(`POUR 마케팅 허브.zip`)는 글(제품 카드·작업 기록)을, 이 대시보드는 매일 바뀌는 숫자(판매·광고·재고)를 쌓는다.

## 주소
| 화면 | 주소 | 누가 |
|---|---|---|
| 대시보드 | https://pour-construction-form.pages.dev/marketing-hub/ | 관리자 (대표 + 계정 탭에서 등록한 관리자) |
| 리포트 올리기 | https://pour-construction-form.pages.dev/marketing-hub/upload.html | Aside 전용 계정 (업로더) |

업로더 계정이 대시보드 주소로 들어오면 자동으로 올리기 화면으로 보낸다. 실제 차단은 보안 규칙이 한다.

## 확정한 것 (사용자 결정 2026-10-08)
- **전용 대시보드**를 새로 만든다. 기존 그로홈 대시보드·CRM에는 넣지 않는다.
- **Firebase는 기존 pour-app-new를 쓴다.** 컬렉션 이름은 모두 `mkt-`로 시작한다. 다른 앱 규칙은 건드리지 않는다.
- **CSV 정리는 관리자 화면에서 한다**(무료, Cloud Function 없음). Aside는 올리기만 하고, 관리자가 대시보드를 열면 쌓인 업로드를 정리한다. 열기 전까지는 정리 전 상태다.
- 권한은 Admin SDK 커스텀 클레임 대신 **역할 문서 `mkt-access/roles`**로 둔다. 소싱앱 `sourcing-access/roles`와 같은 방식이고, 서비스 계정 키가 필요 없다.

## 데이터 (pour-app-new)
| 컬렉션 | 내용 | 권한 |
|---|---|---|
| `mkt-access/roles` | `{admins:[], uploaders:[], people:{이메일:{name,role,active}}}` | 관리자 |
| `mkt-uploads/{자동}` | Aside가 올린 원본 `{channel, reportDate, csv, uploadedBy, uploaderEmail, rowCount, fileName, reduced, createdAt}` | 업로더·관리자 **새로 만들기만** · 읽기/고치기/지우기는 관리자 |
| `mkt-upload-status/{업로드 id}` | 정리 결과 `{result ok/fail, rows, docs, removed, message, uploaderEmail, processedAt…}` = 업로드 로그 | 관리자 |
| `mkt-sales/{날짜}_{채널}_{상품코드}` | `qty, revenue, orders, productCode, productName` | 관리자 |
| `mkt-ads/{날짜}_{채널}_{해시}` | `campaign, keyword, impressions, clicks, cost, revenue, roas` | 관리자 |
| `mkt-stock/{날짜}_{상품코드}` | `available, avgDailySales, daysLeft, leadTimeDays, reorderNeeded, reorderQty` | 관리자 |
| `mkt-settings/main` | 리드타임·안전재고·ROAS 기준 등 | 관리자 |
| `mkt-products/{상품코드}` | (예정) 제품 87개 마스터 · 옵시디언 `제품코드`와 같게 | 관리자 |

- **같은 날짜·채널을 다시 올리면 그날 데이터를 통째로 바꾼다.** 같은 ID는 덮어쓰고, 새 리포트에 없는 줄은 지운다. 루틴이 두 번 돌아도 중복이 생기지 않는다.
- 상품코드가 없는 리포트는 상품명으로 묶는다(`name:상품명`).
- CSV가 900KB를 넘으면 알아본 열만 남겨서 저장한다(`reduced: true`).
- 한국 관리자 사이트의 EUC-KR CSV도 읽는다.

## 계산식 (`core.js`)
- **재고(레오)**
  - 일평균 = 최근 14일 판매수량 ÷ 14 (모든 채널 합)
  - 남은 일수 = 가용재고 ÷ 일평균
  - 남은 일수 ≤ 리드타임 + 안전재고(7일)이면 발주
  - 발주 수량 = (리드타임 + 30일) × 일평균 − 가용재고
- **키워드(케이)**: 최근 7일 합계로 판단한다.
  - 끄기: 비용이 1만원 이상인데 전환매출이 0
  - 줄이기: ROAS 200% 미만
  - 올리기: ROAS 400% 이상이고 클릭 10회 이상
  - 기준값은 모두 대시보드 ⚙️ 설정에서 바꾼다.
- **채널별 열 이름**은 `core.js`의 `FIELDS`에 있다. 실제 CSV 샘플을 받으면 거기만 고친다.

## 처음 한 번 (사용자)
1. **보안 규칙 게시**: Firebase 콘솔 → pour-app-new → Firestore → 규칙 → 저장소 `firestore.rules` 전체를 붙여넣고 게시 (`FIREBASE-DEPLOY.md`). 게시 전에는 대시보드가 권한 오류를 낸다.
2. 대시보드에 대표 계정으로 로그인 → 👥 계정 → **Aside 전용 이메일**, 역할 '업로더' → 임시 비밀번호를 Aside 비밀번호 관리자에 저장한다.
3. 쇼핑몰 쪽은 조회 전용 계정만 만든다.
   - 카페24: 부운영자 (통계·주문 조회)
   - 쿠팡 Wing: 하위 사용자 (조회)
   - 네이버 광고: 뷰어

## Aside 루틴 (초안 · 실제 메뉴 경로는 샘플 받은 뒤 확정)
페이지의 고정 요소:
- `#channel` (채널) · `#report-date` (리포트 날짜) · `#csv-file` (CSV 파일) · `#csv-text` (붙여넣기)
- `#preview-button` (미리보기) · `#save-button` (저장) · `#status-message` (결과 문구)
- 결과 문구는 항상 `완료:` 또는 `실패:` / `오류:` 로 시작한다.

```
[루틴 1: 광고 리포트] 매일 08:00
1. 네이버 광고 관리자(조회 전용 계정)에서 보고서 > 키워드 보고서, 기간 "어제", CSV 다운로드.
2. https://pour-construction-form.pages.dev/marketing-hub/upload.html 을 연다. 로그인 화면이면 저장된 Aside 전용 계정으로 로그인.
3. 채널 "네이버 광고", 리포트 날짜는 그대로(기본값 = 어제), CSV 파일에 방금 받은 파일.
4. [미리보기] → "오류:"가 없으면 [저장].
5. "완료:"로 시작하는 문구가 보이면 다음으로. "실패:"면 그 문구를 결과로 남기고 종료.
6. 쿠팡 Wing 광고 보고서(어제, 키워드별)로 1~5 반복 — 채널 "쿠팡 광고".
절대 하지 말 것: 입찰가·예산·설정 변경, 결제, 이 업로드 페이지 밖 대시보드 이동.

[루틴 2: 카페24 판매] 매일 08:10 — 카페24 관리자 > 통계 > 상품별 판매(어제) → 채널 "카페24 판매"
[루틴 3: 재고] 매일 08:20 — 재고 현황(상품코드·가용재고) → 채널 "재고"   ※ 판매보다 뒤에 올릴 것
```

## 시험 (실제 DB 안 씀)
- 계산: `node marketing-hub/core.test.mjs`
- 보안 규칙: `tests/rules.test.mjs`. 에뮬레이터에서 업로더/관리자/미등록/비로그인 32개를 검사한다.
- 화면: `tests/e2e.mjs`. 계정 만들기 → 5종 업로드 → 정리 → 재업로드 시 중복 없음, 375·768·1280px 가로 넘침 없음.
- 로컬에서는 `?emu=1`로 에뮬레이터에 붙는다. localhost에서만 동작한다.

## 남은 일 (작업지시서 9장)
- [x] 2·3 권한·보안 규칙 (역할 문서 방식) + 에뮬레이터 시험
- [x] 4 입력 페이지 `upload.html`
- [x] 5 정리 (관리자 화면 방식) · 업로드 로그
- [x] 6 요약 화면 (발주 필요 · 올릴/줄일/끌 키워드 · 제품별 판매 · 📋 표 복사 → Claude·옵시디언)
- [x] 8 E2E (에뮬레이터)
- [ ] 보안 규칙 게시 (사용자 · 콘솔)
- [ ] 채널별 실제 CSV 샘플 → `FIELDS` 확정 (열린 질문 3) · 재고 출처 (열린 질문 4)
- [ ] 7 Aside 루틴 실제 메뉴 경로 확정
- [ ] 9 (선택) 옵시디언 제품 노트 속성 갱신 스크립트
- [ ] 10 (선택) 제품 87개 → 옵시디언 제품 카드 + `mkt-products`
