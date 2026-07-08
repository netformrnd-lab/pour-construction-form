# seed/ — POUR스토어 가격·마진 대시보드 Firestore 시딩

대외비 데이터(매입원가·채널 공급가·채널정책·매입처 암호문)를 신규 Firebase 프로젝트
**pourstoreproject** 의 Firestore 로 옮기기 위한 로컬 실행용 도구입니다.

> ⚠️ `data.json` 과 `serviceAccountKey.json` 은 **대외비**입니다. `.gitignore` 로 제외되어
> 있으며 절대 커밋하지 마세요. 이 레포에는 **코드만** 남깁니다.

## 데이터 모델 (Firestore)

```
channels/{uid}      // 문서ID = 채널 uid(c1..c15)
  { ord, g, code, name, short, st, tgt, desc, col, role }

products/{p0000..}  // 문서ID = 'p' + 4자리(seq)
  { seq, kind:"raw"|"pkg", cat, name, spec, cost, pr:{채널uid: 공급가} }

config/secure       // { blob: "<AES-256-GCM 암호문>" }   ← 매입처·상품매칭 (복호화는 앱에서)
config/calc         // { moqTiers:[{label,f,min,max(null=∞)}], chVar:{...}, codeRank:{...} }
```

문서ID가 결정론적이라 **재실행해도 같은 문서를 덮어씁니다(멱등)**.

## 실행 절차 (로컬)

```bash
cd seed
npm install

# 1) 원본 HTML 에서 데이터 추출 → seed/data.json (값 미출력, 개수만 로그)
node extract.mjs ../POUR스토어_가격마진_대시보드.html

# 2) 서비스 계정 키 준비
#    Firebase 콘솔 → pourstoreproject → 프로젝트 설정 → 서비스 계정
#    → "새 비공개 키 생성" → 내려받은 JSON 을 seed/serviceAccountKey.json 으로 저장
#    (키의 project_id 가 pourstoreproject 인지 스크립트가 검증합니다)

# 3) 시딩 (개수만 로그)
node seed.mjs
# 원본에서 삭제된 문서까지 정리하려면:
node seed.mjs --prune
```

## 보안규칙 배포

`../pourstore.rules` 를 pourstoreproject 에 배포하세요.
(읽기 = **허용 이메일(allowlist)** 만, 쓰기 = 금지. 현재 `songhee44@netformrnd.com`.
관리자 추가 시 규칙의 `allowed()` 배열과 콘솔 Authentication 사용자 양쪽에 등록)

```bash
firebase deploy --only firestore:rules --project pourstoreproject
# firebase.json 의 firestore.rules 를 pourstore.rules 로 지정하거나 별도 config 로 배포
```

앱(`../pourstore-pricing-dashboard.html`)은 Firebase Auth(이메일/비밀번호) 로그인 후에만
데이터를 읽습니다. 계정은 Firebase 콘솔 → Authentication 에서 수동으로 생성하세요
(공개 회원가입 미사용).

## 원칙 (CLAUDE.md 준수)

- 수치 값은 터미널/로그에 출력하지 않음 — 개수만 표시
- Firestore 쿼리 `orderBy` 미사용 → 앱에서 클라이언트 정렬(seq/ord)
- 빈 결과는 `console.log` 로 건수만, `catch` 에서 빈 배열 반환 금지(throw)
- 신규 프로젝트(pourstoreproject)만 연결
