# 분해원가(원가 분해) 시험 도구 (가짜 숫자만)

`pourstore-cost.html`(원가 분해 화면)의 계산이 송희님 엑셀 '표준_원가계산기_v7'과 같은지,
`pourstore.rules`를 고쳐도 기존 자리 결과가 그대로인지 다시 확인할 때 씁니다.
**실제 원가·제조사 이름이 든 파일은 이 폴더(저장소)에 넣지 않습니다.**

## 1. 엑셀 식 ↔ 화면 계산 대조

```bash
pip install openpyxl
python3 make_fake_v7.py fake_v7.xlsx
```

```bash
soffice --headless --calc --convert-to xlsx:"Calc MS Excel 2007 XML" --outdir out fake_v7.xlsx
```

```bash
npm i xlsx@0.18.5 && node compare_v7.js out/fake_v7.xlsx
```

- `make_fake_v7.py`: v7 모양(A5~B11 기본 정보 · D5~E10 범위·유효기간·향료 · G9 배합량 · J9 향료 직접 · 12행 머리글 · 13~32행 구성요소)에
  작업 지시서의 식을 그대로 넣은 가짜 엑셀 + '판매가' 시트(3채널 × 목표 마진 40/30/20%)
- LibreOffice 가 식을 계산해 두면, `compare_v7.js`가 화면의 계산 블록(`<script id="pcc-core">`)으로 같은 시트를 읽어 줄마다 비교
- 실제 v7 파일은 화면의 [📥 엑셀 올리기] 미리 보기가 같은 비교를 해 줍니다('엑셀 값과 같음 ✓ / 다름 n칸')

## 2. 보안 규칙 전후 대조 (에뮬레이터)

```bash
npm i firebase-tools@13 @firebase/rules-unit-testing@3
git show origin/main:pourstore.rules > old.rules
npx firebase emulators:exec --only firestore --project demo-old "node rules_diff.test.js old.rules ../../pourstore.rules"
```

- 가짜 계정 11종(마스터·추가 마스터·부마스터·인증 안 한 부마스터·열람·팀원·경영 열람·인증 안 한 경영 열람·경영+열람·목록 밖·로그인 안 함)
  × 모든 자리 × 읽기·목록·만들기·고치기·지우기 → 기존 자리는 옛 규칙과 결과가 같아야 하고, 새 자리(cost-*)만 기대대로

## 3. 업체 여러 곳 · 통화 · 생산 방식 기본 줄 (2026-11-25 분해원가)

```bash
node vendors_test.js
```

- 구성요소마다 A 주 · B 서브 · C… 중 '적용' 업체로 완제품 원가 · 업체 비교(최저가·바꾸면 ±·MOQ 차이) · 외화 × 환율 · 예전 카드(업체 칸 없음) = A 업체 하나 · 카드 상태(확정/임시) · 기본 줄
- 엑셀 v7 대조(1번)는 그대로 통과해야 함 — 통화 칸이 빈 줄(원화)은 예전 식 그대로

## 4. 견적서 파일 · 노션 가져오기 (2026-11-25 밤)

- 견적서 저장소 고르기·Cloudflare R2 켜는 순서: [QUOTE_FILES.md](QUOTE_FILES.md)
- 노션 → 분해원가 `window.costImport.applyNotion(payload)` · 줄 목록 엑셀/CSV 올리기 — 모양·규칙: [NOTION_IMPORT.md](NOTION_IMPORT.md)
