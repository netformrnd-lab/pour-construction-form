# POUR스토어 챗봇센터 — 셋업 가이드 (1차)

> 페이지: `pourstore-renewal/chatbot.html`
> 어드민센터(`admin.html`) 사이드바 → **💬 AI 챗봇센터 → 챗봇 관리센터**로 진입
> PIN은 어드민센터와 공통(기본 `1234`)

---

## 0. 키 없이 지금 바로 되는 것 (설정 불필요)

아래는 Anthropic 키/워커 없이도 동작합니다. 미리 해두면 봇이 더 똑똑해집니다.

- **봇 스튜디오 → 「🌱 기본 봇 4종 생성」** : 내부/B2C/B2B/자사몰 봇이 톤·가드레일 시드된 채로 생성
- **지식베이스 → 「📥 매뉴얼 임포트」** : 기존 CS 매뉴얼/SOP 붙여넣기 → 자동 분할 저장
- **지식베이스 → 「+ 지식 추가」** : FAQ 직접 입력
- **대시보드 / 대화 로그 / 분석** : 화면 확인 (대화가 쌓이면 채워짐)

> ⚠️ **실제 AI 답변(플레이그라운드 대화)** 만 아래 1~3단계 셋업이 끝나야 동작합니다.

---

## 1. Cloudflare Worker 배포 (컴퓨터 필요, ~3분)

LLM 백엔드는 기존 `workers/claude-proxy.js`를 그대로 씁니다.

```bash
# repo 루트에서
cd workers

# 1) 클라이언트 인증용 시크릿 등록 (아무 문자열, 메모해둘 것)
npx wrangler secret put WORKER_SECRET --config wrangler.claude-proxy.toml

# 2) 배포
npx wrangler deploy --config wrangler.claude-proxy.toml
```

배포가 끝나면 출력되는 URL을 메모합니다:
`https://pour-claude-proxy.<본인계정>.workers.dev`

> CLI가 부담되면 Cloudflare 대시보드(웹) → Workers & Pages → Create → 코드 붙여넣기로도 가능.

---

## 2. Anthropic API 키 발급 (~2분)

1. https://console.anthropic.com/settings/keys → **Create Key**
2. `sk-ant-...` 키 복사
3. 신규 가입 시 무료 체험 크레딧(약 $5)으로 테스트 가능. 소진 후엔 결제수단(선불 충전) 등록 필요 — **자동 과금 폭탄 없음**(크레딧 없으면 그냥 멈춤).

---

## 3. 챗봇센터 설정 입력 (~1분)

챗봇센터 → **⚙️ 설정 → 🔌 AI 워커 연결** 에 입력:

| 항목 | 값 |
|---|---|
| Worker URL | 1단계에서 받은 `https://...workers.dev` |
| Worker Secret | 1단계에서 정한 `WORKER_SECRET` |
| Anthropic API Key | 2단계 `sk-ant-...` |
| 기본 모델 | **Haiku 4.5** (무료한도/저비용 권장) |
| 기본 최대 토큰 | 1024 |

> 설정은 **이 브라우저(localStorage)에만** 저장됩니다. 사용할 기기에서 각각 입력.

---

## 4. 동작 확인

**플레이그라운드** → 봇 선택(내부 팀봇) → 질문 입력 → 답변 + 하단에 토큰·예상비용(₩) 표시되면 성공.
이후 대화는 **대화 로그**에 저장되고 **대시보드**에 비용·사용량·인기질문이 집계됩니다.

---

## 비용 메모 (Haiku 기준 추정)

- 대화 1건(약 5턴) ≈ **$0.01~0.03 = 약 15~40원**
- 한국어는 토큰을 더 써서 1.2~1.3배로 보면 안전
- 대시보드에서 **내부용 / 고객용 비용 분리 + 월말 예상**을 실시간 확인

---

## 데이터 위치 (Firestore, 신규 컬렉션 — 기존과 충돌 없음)

| 컬렉션 | 용도 |
|---|---|
| `chatbot-bots` | 봇 프로필 |
| `chatbot-kb` | 지식베이스(FAQ·문서) |
| `chatbot-sessions` | 대화 세션 로그 |
| `chatbot-leads` | (예정) 고객 핸드오프 |

---

## 다음 단계 (참고)

- **2차** : 고객 CS봇 B2C/B2B 다듬기 + 로그→FAQ 승격 운영 정착
- **3차** : Cafe24 자사몰 임베드 위젯(`chat-widget.html`)
  - 공개 엔드포인트 보안(Origin 화이트리스트·Rate limit·세션토큰)
  - 출력 후처리 가드레일(금액 차단), PII 분리·마스킹, SSE 스트리밍
