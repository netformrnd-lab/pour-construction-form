# 노션 → 분해원가 가져오기 (2026-11-25)

매일 19:00 Aside 가 **마스터로 로그인한 분해원가 화면**에서 부릅니다.

```js
// 화면이 데이터를 다 불러올 때까지 기다린 뒤
for (let i = 0; i < 60 && !(window.costImport && window.costImport.ready()); i++) await new Promise((r) => setTimeout(r, 500));
const r = await window.costImport.applyNotion(payload);
// r = { added, updated, unchanged, deleted, unmatched: [...], errors: [...] }
```

**권장: Aside 는 `pourstore-cost.html` 을 바로 엽니다**(가격·마진 대시보드와 같은 로그인 · 1MB 대시보드를 안 기다림). 대시보드 안에서 부르려면 제품 › 분해원가를 연 뒤 틀(iframe `#costFrame`)의 `contentWindow.costImport`.

## payload

```js
{ source: "notion", syncedAt: "2026-11-25T19:00:00+09:00",
  partial: false,   // 선택 · true = 일부만 보냄(이때는 '노션에서 삭제됨' 표시를 안 함)
  suppliers: [{ notionId, name, region: "국내" | "해외", note }],
  quotes: [{ notionId, supplierNotionId, quoteNo, quoteDate, validUntil, currency, vat: "V+" | "V-" | "V?", notionUrl,
             files: [{ name, notionUrl }],
             lines: [{ notionId, product: { code?, name, spec? }, component: { kind, name, per?, use? },
                       unitPrice, moq, leadTime, note, currency?, vat? }] }] }
```

- `currency`: `KRW`·`원`·빈칸 = 원화 · `USD`·`CNY`·`JPY`·`EUR` = 외화(카드의 환율로 원화) · 줄에 `currency`/`vat` 가 있으면 견적 값 대신 그 줄 값
- `component.kind`: 분해원가 구분(내용물·충전 · 용기 · 캡 · 라벨 · 단상자 · 파우치 · 구성품 · 아웃박스 · 향료 · OEM 단가 · 공임 · 간접비 · 1회 비용 · 입고 이동 · 수입 물류 · 관세 · 기타) — 다른 글자도 그대로 받음
- `component.per`(`개당`|`1회`)·`use` 는 **새 줄을 만들 때만** 씀 (운임·관세처럼 한 번 내는 돈은 `1회`)
- 날짜: `2026-11-20` · `2026.11.20` · `2026/11/20` 모두 됨

## 규칙

| 무엇 | 어떻게 |
|---|---|
| 품목 찾기 | 자체상품코드 → 제품명+규격 → (가격정책표에 없는 품목이면) 카드 품목+규격 → 못 찾으면 **연결 필요** |
| 연결 필요 | 분해원가 › [노션 연결 필요 n] 에서 카드나 가격표 제품을 한 번 고르면 기억(`cost-names/_notion.links`) → 다음부터 자동 |
| 가격표엔 있는데 카드가 없음 | 노션 줄로 새 카드(생산 방식 = 공급업체가 넷폼이면 자체생산, 그 밖 국내 OEM) |
| 구성요소 | 같은 이름의 줄 · 없으면 새 줄 |
| 업체 칸 | 노션 줄 id 로 찾음 → 없으면 같은 업체 이름으로 손으로 넣어 둔 칸 → 빈 칸(기본 A) → 없으면 새 업체(B·C…) |
| 노션이 원본 (매번 새 값) | 업체 단가·통화·부가세·MOQ·리드타임·견적일·유효기간·견적 번호·비고·견적서·노션 주소·업체 이름 — 화면에선 '노션' 꼬리표 + 잠금 + [노션에서 고치기] |
| 대시보드만 (절대 안 바꿈) | 적용 업체 · 사용량 · 개당/1회 · 제조 단가 포함 · 메모 · 가격정책표 반영(자동 반영 없음) |
| 같은 것 다시 | 같은 노션 id 는 몇 번 돌려도 같은 결과 · 바뀐 것 없으면 저장 안 함 |
| 노션에서 사라짐 | 지우지 않고 '노션에서 삭제됨' 표시 (계산엔 그대로 · 빼려면 화면에서 ✕) |
| 기록 | 실행마다 `cost-names/_notion.runs`(최근 30번) · 바뀐 카드는 카드 이력에 '노션 동기화: …' |

- 숫자 세는 법: 노션 줄 하나마다 added(새 업체 칸·새 줄·새 카드) / updated(값이 바뀜) / unchanged · deleted = 이번에 '노션에서 삭제됨'으로 표시한 업체 칸 수
- 업체 실명·견적서·노션 주소는 `cost-names`(마스터·경영 열람만) · 카드엔 가칭(A사·B사)만 — 보안 규칙 변경 없음
