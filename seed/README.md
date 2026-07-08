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
config/access       // { masterEmail, allowedEmails:[...], masterPhone, otpWorkerUrl }  ← 앱에서 생성/관리
config/master-otp   // { codeHash, expiresAt, attempts, pendingEmail, pendingPhone }  ← OTP Worker 가 임시 사용
```

### 마스터 변경 SMS-OTP (workers/pour-master-otp.js)
- 마스터 계정 변경(`masterEmail`)은 **현재 마스터 휴대폰으로 온 6자리 SMS 코드**를 확인해야만 됩니다.
- `masterEmail`·`masterPhone` 은 Firestore 규칙상 **클라이언트에서 변경 불가** → 변경은 서비스계정(Admin)으로
  동작하는 이 Worker 만 수행합니다(앱 코드·개발자도구로 우회 불가). 휴대폰번호는 최초 1회만 앱에서 등록.
- 배포: `workers/wrangler.master-otp.toml` 참고(서비스계정 키 + Solapi 시크릿 등록 후 deploy).
  배포 URL 을 앱 [계정 관리] > "OTP Worker URL" 에 저장하면 활성화됩니다.

### 계정 기반 접근 제어(config/access) — 3중 방어
- **열람 허용목록(allowedEmails)**: 여기 있는 계정만 채널·제품·마진 등 데이터를 읽습니다.
  목록에 없는 계정은 **로그인해도 아무것도 못 봅니다**(서버 강제, `isAllowedReader()`).
- **마스터(masterEmail) + 이메일 인증**: 대외비 암호문 `config/secure`(공급업체·매입처·매칭)는
  마스터 계정이 이메일 인증(`email_verified`)까지 완료했을 때만 읽습니다.
- 판정은 모두 **Firestore 보안규칙(서버)** 에서 강제 → 클라이언트 HTML/JS 수정·개발자도구로도 우회 불가.
- 지정/변경은 앱의 **[계정 관리]** 탭에서:
  - 최초 1회: 지정 마스터(`songhee44@netformrnd.com`)가 로그인+이메일 인증 후 "마스터로 설정".
  - 마스터 변경: 현재 마스터 + 이메일 인증만. 허용목록 추가/삭제: 마스터만.
- 콘솔에서 미리 만들려면 `{ masterEmail:"songhee44@netformrnd.com", allowedEmails:["songhee44@netformrnd.com"] }`.

> ⚠️ **콘솔(console.firebase.google.com) 접근은 이 규칙과 별개**입니다. 프로젝트 IAM 권한을 가진
> 구글 계정은 규칙과 무관하게 raw 데이터를 봅니다(공급업체는 여전히 AES 암호문). 프로젝트 설정 →
> 사용자 및 권한에서 콘솔 접근 인원을 최소화하세요. 앱 로그인 계정으로는 콘솔에 들어갈 수 없습니다.

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

`../pourstore.rules` 를 pourstoreproject 에 배포하세요. (읽기 = 로그인 사용자만, 쓰기 = 금지)

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
