# CRM(pourstorecrm) 안전 연동 — 워커 프록시 셋업

> 사내 통합봇(chat-internal.html)의 **CRM 상담봇**을 실제 CRM 데이터에 라이브로 물리는 방법.
> CRM Firestore는 개인정보 보호로 외부 읽기가 막혀 있어, **워커가 서버에서 읽고 개인정보를 제거한 뒤** 봇에 전달합니다.

## 구성요소 (repo에 준비됨)
- `workers/crm-proxy.js` — 프록시 워커
- `workers/wrangler.crm-proxy.toml` — 배포 설정
- `pourstore-renewal/chat-internal.html` — 상단 `CRM_PROXY` 에 워커 URL/시크릿 입력하면 라이브 전환

---

## 1) pourstorecrm 서비스계정 JSON 발급 (~2분)
1. Firebase 콘솔 → **pourstorecrm** 프로젝트 → ⚙️ 프로젝트 설정 → **서비스 계정** 탭
2. **새 비공개 키 생성** → JSON 파일 다운로드
3. 파일 내용 **전체**를 그대로 사용(아래 시크릿에 붙여넣기). ⚠️ 이 파일은 절대 커밋/공유 금지.

## 2) 워커 배포 (컴퓨터, ~3분)
```bash
# repo 루트에서
npx wrangler secret put WORKER_SECRET       --config workers/wrangler.crm-proxy.toml
#   → 아무 문자열(메모). 봇 인증용.
npx wrangler secret put CRM_SERVICE_ACCOUNT --config workers/wrangler.crm-proxy.toml
#   → 1)에서 받은 서비스계정 JSON '전체' 붙여넣기
npx wrangler deploy --config workers/wrangler.crm-proxy.toml
```
배포 후 URL 메모: `https://pour-crm-proxy.<계정>.workers.dev`

> CLI가 부담되면 Cloudflare 대시보드 → Workers & Pages → Create → `crm-proxy.js` 코드 붙여넣기,
> Settings → Variables and Secrets 에서 `WORKER_SECRET`·`CRM_SERVICE_ACCOUNT`(Secret) 추가.

## 3) 컬렉션명·스키마 확인 (한 번)
브라우저에서:
```
https://pour-crm-proxy.<계정>.workers.dev/crm-sample?secret=<WORKER_SECRET>&limit=3
```
- 나오는 필드 구조를 확인 → `wrangler.crm-proxy.toml` 의 `CRM_COLLECTION` 을 실제 이름으로,
  필요 시 `crm-proxy.js` 의 `CONFIG.map`(title/content/comments 필드명)을 맞춥니다.
- (이 결과를 저에게 알려주시면 매핑을 정확히 맞춰드립니다.)

## 4) 챗봇에 연결
`pourstore-renewal/chat-internal.html` 상단:
```js
const CRM_PROXY = { url: "https://pour-crm-proxy.<계정>.workers.dev", secret: "<WORKER_SECRET>" };
```
→ 저장/배포하면 CRM 상담봇이 **라이브**로 전환(시드 대신 실제 CRM Q&A).
   워커가 실패하면 자동으로 기존 시드로 폴백합니다.

---

## 보안 메모
- 서비스계정 키·`WORKER_SECRET` 은 **워커 시크릿에만** 저장(코드/깃 금지).
- 워커가 **연락처·이메일·긴 숫자를 마스킹**([연락처]/[이메일]/[번호])하고, **직원 답변(댓글)이 있는 문서만** 반환(미검증 답변 방지).
- 이름 등 자유서술 속 개인정보는 스키마 확인 후 해당 필드를 제외하도록 조정 권장.
- 필요 시 `ALLOW_ORIGIN` 을 Pages 도메인으로 제한.
