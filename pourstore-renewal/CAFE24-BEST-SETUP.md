# 베스트(판매량 랭킹) 자동연동 세팅 가이드

`best.html`(베스트 페이지)은 Firestore `config/pourstoreBest` 문서를 읽어 랭킹을 보여줍니다.
이 문서를 **카페24 실제 주문 데이터**로 매일 자동 채우는 것이 `workers/cafe24-best-sync.js` 입니다.

> 연동 전에도 페이지는 동작합니다. (판매데이터가 없으면 상품을 임시로 보여주고 "집계 준비중" 안내를 띄웁니다.)

---

## 데이터 흐름

```
[카페24 주문 API] --집계(전일 기준 일/주/월, 판매수량)--> [Worker]
      [Firestore products] --상품정보(이름/가격/썸네일) 조인--> [Worker]
                                   |
                          config/pourstoreBest 기록
                                   |
                            best.html 이 읽어 표시
```

- **랭킹 기준**: 기간 내 주문 수량 합계(판매 개수) 내림차순
- **전일 기준**: 어제까지의 데이터로 일간(1일)/주간(7일)/월간(30일) 산정
- **카테고리**: 제품명 키워드로 자동 분류(패키지/방수/균열보수/도장·도색/페인트/보강자재/부자재/안전용품)

---

## 준비물 (사용자가 발급)

1. **카페24 개발자 앱** — https://developers.cafe24.com
   - 앱 생성 → `Client ID`, `Client Secret` 확보
   - 권한(Scope): **`mall.read_order`**(주문 조회) 필수, `mall.read_product` 권장
   - Redirect URI 등록(OAuth 최초 인증용)
2. **OAuth 최초 인증으로 `refresh_token` 1개 발급**
   - 인증 URL 접속 → 몰 관리자 로그인/동의 → `code` 수령 → 토큰 교환 → `refresh_token` 확보
   - (이 refresh_token은 최초 1회만 필요. 이후 Worker가 매일 자동 회전 갱신)
3. **mall_id**: `pourstore.cafe24.com` → `pourstore` (wrangler.cafe24-best.toml에 이미 기입)

---

## 배포 절차

```bash
cd workers

# 1) KV 네임스페이스 생성 → 출력된 id를 wrangler.cafe24-best.toml 의 id에 붙여넣기
npx wrangler kv namespace create CAFE24_KV --config wrangler.cafe24-best.toml

# 2) 시크릿 등록
npx wrangler secret put CAFE24_CLIENT_ID     --config wrangler.cafe24-best.toml
npx wrangler secret put CAFE24_CLIENT_SECRET  --config wrangler.cafe24-best.toml
npx wrangler secret put FIREBASE_API_KEY      --config wrangler.cafe24-best.toml   # AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU
npx wrangler secret put WORKER_SECRET         --config wrangler.cafe24-best.toml   # 임의의 긴 문자열

# 3) 배포
npx wrangler deploy --config wrangler.cafe24-best.toml

# 4) refresh_token 최초 저장 (배포된 Worker URL로)
curl -X POST https://cafe24-best-sync.<계정>.workers.dev/seed \
  -H "Content-Type: application/json" \
  -d '{"secret":"<WORKER_SECRET>","refresh_token":"<카페24 refresh_token>"}'

# 5) 즉시 1회 동기화(테스트)
curl -X POST https://cafe24-best-sync.<계정>.workers.dev/sync \
  -H "Content-Type: application/json" \
  -d '{"secret":"<WORKER_SECRET>"}'
# → {"ok":true,"basisDate":"2026-07-22","counts":{"daily":..,"weekly":..,"monthly":..}}
```

이후 매일 **KST 04:30**에 자동 실행됩니다(cron `30 19 * * *` UTC).

---

## 보안 메모

- `client_id/secret`, `WORKER_SECRET`, `FIREBASE_API_KEY`는 **Worker Secret**에만 저장(코드/깃 커밋 금지).
- 회전하는 `refresh_token`은 **Cloudflare KV**에만 저장(공개 Firestore에 두지 않음).
- Firestore에 기록되는 `config/pourstoreBest`는 상품 랭킹뿐이라 공개돼도 무방.
- Firebase 보안규칙은 변경하지 않음(`config/*`는 기존에 쓰기 허용).

## 주의 / 확장 여지

- 주문 취소·반품 반영이 필요하면 `aggregateSales()`에서 주문상태 필터(`order_status`)를 추가하세요.
- 카페24 API 버전/필드명이 몰 설정에 따라 다를 수 있으니 최초 `/sync` 응답과 로그로 검증하세요.
- 상품 6,000건(60페이지) 초과 주문일 경우 안전장치 한도를 올리세요(`aggregateSales`의 `page < 60`).
