# POUR스토어 소비자용 챗봇 v1 — 셋업/운영 가이드

> 화면: `pourstore-renewal/chat-widget.html`
> Pages URL: https://pour-construction-form.pages.dev/pourstore-renewal/chat-widget.html
> 관리센터(봇/지식): `pourstore-renewal/chatbot.html`

## 무엇인가
- 일반 고객(B2C·자사몰)이 제품 사용·시공 궁금증을 묻는 **소비자용 챗봇**.
- 답변 방식: **검색(키워드·태그 매칭)**. Anthropic 키·워커 **불필요**, 즉시 동작, 안전(견적/타사/과장 배제).
- 지식 = **인라인 시드(CRM 상담 Q&A 소비자톤)** + Firestore `chatbot-kb`(audience `b2c`/`store`/전체) **병합**.
- 못 맞추는 질문은 **1:1 문의로 연결**하고, 모든 질문을 `chatbot-consumer-logs`에 기록 → 팀이 보고 지식 보강(진화 루프).

## 진화(지식 추가) 방법
1. 관리센터 `chatbot.html` → 지식베이스 → **+ 지식 추가**(Q&A) 로 새 상담 사례 입력.
   - audience에 `b2c`(또는 비워두면 전체) 지정 → 소비자 챗봇에 자동 반영.
2. `chatbot-consumer-logs`(Firestore)에서 **매칭 안 된 질문(matched=null)** 을 주기적으로 확인 → 자주 나오는 질문을 지식으로 승격.

## 상담 연결 값 교체 (chat-widget.html 상단 `CONTACT`)
```js
const CONTACT = {
  inquiryUrl: "https://www.pourstore.net",  // ← 실제 1:1 문의/게시판 URL로 교체
  tel: ""                                    // ← 전화번호 넣으면 전화 버튼 노출 (예: "1577-0000")
};
```

## 카페24 자사몰에 붙이기(선택)
- 퀵배너/페이지에 iframe 임베드:
```html
<iframe src="https://pour-construction-form.pages.dev/pourstore-renewal/chat-widget.html"
        style="width:100%;max-width:520px;height:640px;border:0;border-radius:16px;box-shadow:0 8px 30px rgba(15,31,92,.12)"></iframe>
```

## Firestore
- 읽기: `chatbot-kb` (관리센터와 공용)
- 쓰기: `chatbot-consumer-logs` (신규, 질문 로그)
  - 규칙이 막혀 쓰기 실패 시(F12 콘솔 확인) `chatbot-consumer-logs` read/write 규칙을 콘솔에서 게시.

## 다음(v1.1~)
- 대리점주용 / 사내팀원용 챗봇(같은 엔진, audience `b2b`/`internal`).
- 라이브 CRM(`pourstorecrm`) 연동: 그 프로젝트 웹 config + 컬렉션 스키마 확보 후 어댑터 연결.
- (선택) Claude 워커 연결 시 검색 결과를 근거로 한 자연어 답변으로 업그레이드.
