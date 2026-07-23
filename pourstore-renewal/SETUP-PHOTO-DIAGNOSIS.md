# 사진 진단(하자매칭) — 셋업/운영 가이드

> 고객이 카페24 챗봇에서 **사진 첨부 + 간단 설문**을 하면
> **유사 하자사진 · 문제원인 · 해결방안 · 추천상품**을 맞춤 안내합니다.
>
> - 사진 정리(관리): `pourstore-renewal/admin.html` → **AI 챗봇센터 → 공법분석(하자사진)**
> - 고객 화면(위젯): `pourstore-renewal/chat-widget.html` (카페24 iframe 임베드)
> - (선택) AI 사진판별 워커: `workers/pour-diagnose-proxy.js`

---

## 구조 한눈에

```
[어드민 공법분석]  하자사진 등록/태깅 + 분류템플릿(원인·해결·추천상품)
        │  Firestore: defect-photos, defect-templates  (pour-app-new)
        ▼
[고객 챗봇 위젯]  건물유형·위치·증상 체크 + 사진첨부
        │  ① 설문 즉석매칭(무료·즉시)  →  유사사진·원인·해결·상품 카드
        │  ② (선택) 사진 AI판별 → pour-diagnose-proxy(Claude 비전)로 하자유형 정밀화
        ▼
        1:1 문의 연결 + defect-diagnosis 기록(어드민 후속)
```

**마누스와의 관계**: 마누스가 정리해 준 하자뷰어(예: `hajaviewer-….manus.space`)의 사진은
어드민 **공법분석 → 📥 마누스 연동**(URL/JSON)으로 가져와 `defect-photos`에 쌓습니다.
실시간 챗봇 매칭은 응답 속도를 위해 Claude 비전으로 처리합니다(마누스 태스크 API는 수 분·파일 결과라 실시간 채팅에 부적합).

---

## 0단계 — 어드민에서 사진 정리 (필수, 설정 불필요)

1. `admin.html` → **공법분석(하자사진)** 진입.
2. **📋 분류 템플릿**에서 하자유형별로 입력(챗봇이 이 값으로 답합니다):
   - 해시태그(예: `#누수`), 적용 공법, **문제 원인**, **해결 방안**, **추천 상품**(자사몰 products 검색해 지정), 기준사진.
   - 처음이면 **초기화** 버튼으로 기본 템플릿을 깔고 다듬으세요.
3. **+ 사진 등록** 또는 **📥 마누스 연동**으로 하자사진을 쌓습니다(공법·태그 복수 지정).
   - 사진의 태그가 템플릿 태그와 맞아야 유사사진이 매칭됩니다.

> 이 단계만 해도 위젯이 **즉석 매칭**으로 동작합니다(아래 1단계).

---

## 1단계 — 위젯 즉석 매칭 (설정 불필요, 바로 동작)

`chat-widget.html`은 API 키 없이도 동작합니다.
고객이 **증상 체크리스트**를 고르면 `defect-templates`/`defect-photos`에서 매칭해
원인·해결·유사사진·추천상품 카드를 보여줍니다. 사진은 첨부만 받아 기록/후속상담에 씁니다.

**카페24에 붙이기** — 퀵배너/페이지에 iframe 임베드:
```html
<iframe src="https://pour-construction-form.pages.dev/pourstore-renewal/chat-widget.html"
        style="width:100%;max-width:520px;height:660px;border:0;border-radius:16px;
               box-shadow:0 8px 30px rgba(15,31,92,.12)"></iframe>
```

**값 교체** (`chat-widget.html` 상단):
```js
const CONTACT  = { inquiryUrl: "https://www.pourstore.net", tel: "" };  // 1:1 문의 URL / 전화
const DIAGNOSE = { proxyUrl: "", storeOrigin: "" };                     // storeOrigin에 자사몰 도메인 넣으면 상품링크가 자사몰로 열림
```
- `storeOrigin` 예: `"https://poursto.cafe24.com"` 또는 `"https://www.pourstore.net"`
  (비우면 추천상품 링크가 상대경로로 열려 자사몰 밖에서는 안 열릴 수 있음)

---

## 2단계 — (선택) 사진 AI 판별 붙이기

사진 자체를 AI가 읽어 하자유형까지 판별하려면 공개 진단 워커를 배포합니다.
**키는 서버에만 저장**되고 위젯엔 URL만 넣으므로 공개 페이지에서도 안전합니다.

```bash
cd workers
# 1) Anthropic 키를 서버 시크릿으로 등록
npx wrangler secret put CLAUDE_API_KEY --config wrangler.diagnose.toml
# 2) 허용 도메인 설정: wrangler.diagnose.toml 의 ALLOWED_ORIGINS 에 자사몰 도메인 추가
#    예) ALLOWED_ORIGINS = "https://pour-construction-form.pages.dev,https://poursto.cafe24.com"
# 3) 배포
npx wrangler deploy --config wrangler.diagnose.toml
```
> CLI가 부담되면 Cloudflare 대시보드 → Workers & Pages → Create → `pour-diagnose-proxy.js` 붙여넣기,
> Settings → Variables에서 `CLAUDE_API_KEY`(Secret), `ALLOWED_ORIGINS`(Plaintext) 등록.

배포 후 나온 URL을 위젯에 입력:
```js
const DIAGNOSE = { proxyUrl: "https://pour-diagnose-proxy.<계정>.workers.dev", storeOrigin: "https://…" };
```

- 동작: 첨부 사진 → 워커(Claude 비전) → `{defectType, confidence, cause, solution}` → 그 유형으로 템플릿·유사사진 재매칭. 실패하면 자동으로 설문 즉석매칭으로 폴백.
- 비용: Haiku 기준 1건 수 원 수준. 후보 태그 밖 결과는 신뢰도를 자동 하향.

---

## 데이터 위치 (Firestore / Storage · pour-app-new)

| 컬렉션/경로 | 용도 | 쓰는 곳 |
|---|---|---|
| `defect-photos` | 하자사진 라이브러리 | 어드민 공법분석 |
| `defect-templates` | 분류·원인·해결·추천상품 | 어드민 공법분석 |
| `products` | 추천상품 후보(읽기) | 어드민 |
| `defect-diagnosis` | 고객 진단 기록(사진·체크·매칭결과) | 위젯 |
| Storage `defect-diagnosis/` | 고객 첨부 사진 | 위젯 |

> 보안규칙은 기존 개방 규칙을 그대로 사용(변경 없음). 운영 강화가 필요하면 별도 협의.

---

## 운영 팁

- 매칭이 약하면 **템플릿 태그 ↔ 사진 태그**를 맞추고, 하자유형별 사진을 3장 이상 확보하세요.
- 추천상품이 안 뜨면 해당 하자 템플릿에 **추천 상품**을 지정했는지 확인.
- 고객이 남긴 사진/체크는 `defect-diagnosis`에 쌓이니, 주기적으로 확인해 실제 상담·지식 보강에 활용하세요.
