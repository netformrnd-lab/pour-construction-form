# 분해원가 파일 보관 — Cloudflare Workers KV (2026-11-25 송희님 'KV 확정' · 카드 등록 없음)

| 무엇 | 어디에 | 보기 | 올리기·지우기 |
|---|---|---|---|
| 견적서 파일 (PDF·이미지) | KV `quote/<sha256>.<ext>` · 목록(이름·열쇠)은 `cost-names/{카드}.vfiles[줄][업체]` | 마스터·경영 열람 | 마스터 |
| 노션 견적서 파일 | 서버가 노션 임시 주소에서 받아 KV `quote/…` · 목록은 `vfiles` (kind notion + key) | 마스터·경영 열람 | 마스터(노션 가져오기) |
| 사진 원본 (이미지) | KV `photo/<sha256>.<ext>` · 열쇠는 카드 `imgOrig` (줄·업체도) | 마스터·부마스터·경영 열람 | 마스터 |
| 사진 썸네일 (긴 변 320px · 30KB 이하) | 지금처럼 카드 문서 안 (`img`) | 원가 볼 수 있는 사람 | 마스터 |

- 서버: `functions/api/cost-files/[[path]].js` (Pages Functions · 주소 `/api/cost-files/…`) · 화면: `pourstore-cost.html` 의 `FILE_STORE`
- **KV 연결 전** = 화면엔 '📦 파일 보관 준비 중'만 · 원가·일정·사진 썸네일·노션 링크 등 다른 기능은 그대로
- Firestore 보안 규칙 변경 없음

## KV 무료 한도에 맞춘 것

| KV 무료 한도 | 맞춘 것 |
|---|---|
| 값 1개 25MiB | 파일당 **20MB** |
| 저장 1GB | 견적서 창에 '보관 용량 ○MB / 1GB (○%) · 남은 ○' · **80% 넘으면 빨간 경고** · 꽉 차면 올리기 거절(507) |
| 쓰기 하루 1,000번 (UTC 0시 = 한국 오전 9시에 풀림) | '오늘 쓰기 ○/1,000번' · 900번 넘으면 경고 · 넘으면 '오전 9시에 다시 돼요'(429) |
| (지우기 없음 · 2026-11-26) | 휴지통 = 표시만 · 파일은 그대로 · 기한 없음 → 휴지통 파일도 용량에 들어감 · 꽉 차면 용량 늘리기 필요(지우지 않음) |
| 같은 내용 | 열쇠 = 내용의 SHA-256 → 같은 파일은 한 번만 보관(쓰기도 안 씀) |
| 메타데이터 1KB | 이름은 앞 60자만 (전체 이름은 Firestore 목록에) |

- 올리기 1번 ≈ 쓰기 2번(파일 + 용량 장부) · 휴지통으로·되살리기 ≈ 쓰기 2번(표시 + 장부) · **KV 값을 지우는 동작·자동 삭제 기한 없음** (2026-11-26 송희님 '영구 삭제 없음')
- 용량 장부(`meta/usage`)가 어긋나면 마스터가 `POST /api/cost-files/recount` (목록으로 다시 셈)

## Cloudflare 에서 할 일 (네임스페이스는 이미 있음)

- 네임스페이스: **pourstore-pricing-files** · id `f0e6bcdb6c4e43b087515ee42eab1231` (새로 만들지 않음)
1. Pages 프로젝트 `pour-construction-form` 에 **KV 바인딩**: 변수 이름 `QUOTE_KV` → 위 네임스페이스 — **preview·production 둘 다**
   - API: `PATCH /accounts/{계정 id}/pages/projects/pour-construction-form`
     ```json
     { "deployment_configs": {
         "preview":    { "kv_namespaces": { "QUOTE_KV": { "namespace_id": "f0e6bcdb6c4e43b087515ee42eab1231" } }, "env_vars": { "FIREBASE_PROJECT_ID": { "type": "plain_text", "value": "pourstoreproject" } } },
         "production": { "kv_namespaces": { "QUOTE_KV": { "namespace_id": "f0e6bcdb6c4e43b087515ee42eab1231" } }, "env_vars": { "FIREBASE_PROJECT_ID": { "type": "plain_text", "value": "pourstoreproject" } } } } }
     ```
   - (대시보드라면: Workers & Pages › pour-construction-form › 설정 › 바인딩 › [추가] › KV 네임스페이스)
2. **변수** `FIREBASE_PROJECT_ID` = `pourstoreproject` (위 API 에 같이 · 비어도 서버가 pourstoreproject 로 씀)
3. **다시 배포** — 바인딩은 새 배포부터 적용 (이 브랜치에 다음 푸시가 오거나 배포 › [다시 시도])
4. 확인 — 미리보기 주소에서 분해원가 › 품목 › 📎 → '보관 용량 … / 1GB' 와 [파일 고르기] 가 보이면 켜진 것
   - 또는 `https://<미리보기 주소>/api/cost-files/status` → `"ready": true`

### wrangler 설정 파일로 넣을까? → **지금처럼 API(또는 대시보드)로 넣는 것을 권장**
- 저장소에 Pages 용 `wrangler.toml`(`pages_build_output_dir`)을 두면 **그 파일이 프로젝트 설정의 원본**이 되어, 대시보드·API 로 넣은 바인딩·일반 변수는 그 파일 내용으로 바뀝니다(대시보드에서 못 고침).
- 이 프로젝트는 이미 대시보드에 문자·AI 등 변수·비밀이 여러 개라, 파일로 바꾸려면 그것들을 모두 옮겨 적어야 하고 빠뜨리면 다른 기능이 멈출 수 있음 → 이번엔 API 로 KV 바인딩만 더하는 쪽이 안전.
- (비밀 키는 어느 쪽이든 파일에 안 적고 대시보드 '비밀'로)

## 무엇이 어떻게 되나

- **올리기**: 마스터만 · PDF·JPG·PNG·GIF·WebP·HEIC (파일 첫 바이트로 확인) · 파일당 20MB
- **같은 파일 두 번** = 하나로 · 화면에 '이미 있는 파일과 같아요'
- **빼기**(견적서): '뺀 파일'로 내려가고(기한 없음) [저장]하면 파일 보관에 휴지통 '표시'만 → 언제든 [되살리기] · 파일은 그대로 · 다른 카드가 같은 파일을 쓰면 표시 안 함
- **사진**: 썸네일은 카드 안, 원본은 KV · 크게 보기 › [원본 보기]·[내려받기] · 바꾸거나 빼면 옛 사진은 카드 '뺀 것'에 남고 원본은 휴지통 표시만(파일 그대로)
- **노션 파일**: 노션 파일 주소는 1시간짜리 임시 주소 → 서버가 노션 파일 서버에서 직접 받아 보관(브라우저 CORS 없음)
  - 받는 주소: `https://file.notion.so` · `https://prod-files-secure.s3.<지역>.amazonaws.com` · `https://s3.<지역>.amazonaws.com/secure.notion-static.com/…` 만 (넘김(redirect)도 매번 검사) · 마스터만
  - `window.costImport.copyNotionFile({ quoteNotionId, name, url })` → `{ fileId, size, dedup }`
  - `applyNotion(payload)` 의 `quotes[].files[].url`(임시 주소)이 있으면 자동으로 복사해 그 견적의 📎 에 연결 · 임시 주소는 저장 안 함(노션 페이지 주소 + 보관 열쇠만) · 다음 동기화 때 같은 파일(주소의 ? 앞부분이 같음)은 다시 안 받음
  - 결과 `r.files = { copied, dedup, reused, skipped, failed, errors }` · 파일 보관이 꺼져 있으면 skipped(노션 링크만)
- **로그인 확인**: 요청마다 Firebase 토큰을 구글 공개키로 확인(프로젝트 `pourstoreproject`·만료) → 그 사람 토큰으로 `config/access` 를 읽어 보안 규칙과 같은 식으로 역할 판정(이메일 인증 필요)

## 시험 (가짜 키·가짜 KV·가짜 노션 서버 — 실제 Cloudflare·Firebase·노션 안 씀)

```bash
node files_test.mjs        # 서버 27가지: 권한·로그인 위조·크기·종류·같은 파일·휴지통(표시만·기한 없음·지우기 호출 0번)·되살리기·예전 모양 휴지통·용량 80%·꽉 참·하루 쓰기 한도·노션 복사(주소 제한·넘김·만료·20MB)
```

- 실제 Cloudflare 실행기(wrangler pages dev · 로컬 KV)에서도 화면 끝까지 확인(2026-11-25): 올리기·같은 파일·미리보기·빼기→휴지통·되살리기·사진 원본·경영 열람/부마스터 보기·노션 복사·applyNotion 파일 연결·용량 줄·KV 없을 때 '준비 중'
