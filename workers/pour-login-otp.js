/**
 * POUR스토어 가격대시보드 — SMS-OTP 로그인 Worker (Cloudflare Worker)
 * ────────────────────────────────────────────────────────────────────────
 * 목적: 비밀번호 없이 "휴대폰 SMS 인증코드"만으로 대시보드에 로그인.
 *   · 이메일 입력 → 해당 계정에 등록된 휴대폰으로 6자리 코드 발송
 *   · 코드 확인 → Firebase Auth 유저 보장(+emailVerified=true) → 커스텀 토큰 발급
 *   · 클라이언트는 signInWithCustomToken 으로 로그인 → Firestore 보안규칙 그대로 통과
 *
 * 왜 커스텀 토큰인가:
 *   Firestore 보안규칙(pourstore.rules)이 request.auth.token.email / email_verified 로
 *   허용목록·마스터를 서버에서 강제한다. 로그인 수단을 SMS 로 바꾸더라도 이 규칙을
 *   유지하려면 결국 "그 이메일로 Firebase 세션"이 있어야 한다. 이 Worker(서비스계정=Admin)가
 *   OTP 검증 후 해당 이메일 유저를 emailVerified=true 로 보장하고 커스텀 토큰을 발급한다.
 *   → 앱 코드/개발자도구로는 우회 불가(코드는 코드를 못 만든다: OTP·서비스계정이 서버에만 있음).
 *
 * 배포:
 *   cd workers
 *   npx wrangler secret put FB_PROJECT_ID     --config wrangler.login-otp.toml   # pourstoreproject
 *   npx wrangler secret put FB_CLIENT_EMAIL   --config wrangler.login-otp.toml   # 서비스계정 client_email
 *   npx wrangler secret put FB_PRIVATE_KEY    --config wrangler.login-otp.toml   # 서비스계정 private_key(PEM, \n 포함 그대로)
 *   npx wrangler secret put FB_API_KEY        --config wrangler.login-otp.toml   # 웹 API 키(firebaseConfig.apiKey — 신규 유저 생성용)
 *   npx wrangler secret put SOLAPI_API_KEY    --config wrangler.login-otp.toml
 *   npx wrangler secret put SOLAPI_API_SECRET --config wrangler.login-otp.toml
 *   npx wrangler secret put SOLAPI_SENDER     --config wrangler.login-otp.toml   # 발신번호
 *   npx wrangler deploy --config wrangler.login-otp.toml
 *   → 배포 URL 을 대시보드 로그인 화면 하단 "SMS 로그인 설정"(또는 [계정 관리])에 입력
 *
 * 엔드포인트 (POST JSON):
 *   /request  { email }        → 그 계정에 등록된 휴대폰으로 코드 발송  → { ok, phoneMasked }
 *   /confirm  { email, code }  → 코드 확인 후 커스텀 토큰 발급          → { ok, customToken, verifyDays }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

const OTP_TTL_MS = 180000;        // 코드 유효시간 3분
const OTP_MAX_ATTEMPTS = 5;       // 코드 입력 최대 시도
const VERIFY_DAYS = 3;            // 이메일(SMS) 인증 재요구 주기(일) — 클라이언트가 참고

/* ── base64url ── */
const b64urlBuf = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ── 서비스계정 → Google OAuth 액세스 토큰 (JWT-bearer) ──
   scope: datastore(Firestore REST) + identitytoolkit(Auth Admin) */
let _tok = null, _tokExp = 0;
async function importPkcs8(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
async function getAccessToken(env) {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  const now = Math.floor(Date.now() / 1000);
  const scope = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit';
  const claim = { iss: env.FB_CLIENT_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64urlStr(JSON.stringify(claim));
  const key = await importPkcs8((env.FB_PRIVATE_KEY || '').replace(/\\n/g, '\n'));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + b64urlBuf(sig);
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt });
  const j = await res.json();
  if (!j.access_token) throw new Error('access token 발급 실패: ' + JSON.stringify(j));
  _tok = j.access_token; _tokExp = Date.now() + (j.expires_in || 3600) * 1000;
  return _tok;
}

/* ── Firestore REST 값 변환 ── */
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
}
function fromFs(val) {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return +val.integerValue;
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFs);
  if ('mapValue' in val) return Object.fromEntries(Object.entries(val.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return null;
}
const fields = (doc) => { const o = {}; const f = (doc && doc.fields) || {}; for (const k in f) o[k] = fromFs(f[k]); return o; };
const docUrl = (env, path) => `https://firestore.googleapis.com/v1/projects/${env.FB_PROJECT_ID}/databases/(default)/documents/${path}`;
async function fsGet(env, token, path) {
  const res = await fetch(docUrl(env, path), { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('fsGet ' + res.status + ' ' + (await res.text()));
  return await res.json();
}
async function fsPatch(env, token, path, obj) {
  const mask = Object.keys(obj).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const res = await fetch(docUrl(env, path) + '?' + mask, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFs(v)])) }) });
  if (!res.ok) throw new Error('fsPatch ' + res.status + ' ' + (await res.text()));
  return await res.json();
}
async function fsDelete(env, token, path) {
  await fetch(docUrl(env, path), { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
}

/* ── Firebase Auth Admin (Identity Toolkit REST) ── */
// 이메일로 유저 조회 → localId (없으면 null)
async function authLookup(env, token, email) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FB_PROJECT_ID}/accounts:lookup`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: [email] }),
  });
  if (!res.ok) throw new Error('authLookup ' + res.status + ' ' + (await res.text()));
  const j = await res.json();
  return (j.users && j.users[0]) || null;
}
// 신규 유저 생성(웹 API 키) → localId. 이미 있으면 null 반환(EMAIL_EXISTS).
async function authSignUp(env, email) {
  const randPw = 'Sms!' + b64urlBuf(crypto.getRandomValues(new Uint8Array(18)));  // 임의 비번(사용 안 함 — SMS 로그인 전용)
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: randPw, returnSecureToken: false }),
  });
  const j = await res.json();
  if (res.ok && j.localId) return j.localId;
  const msg = (j.error && j.error.message) || '';
  if (msg.includes('EMAIL_EXISTS')) return null;         // 이미 존재 → 조회로 전환
  throw new Error('authSignUp 실패: ' + msg);
}
// emailVerified=true 로 갱신(Admin)
async function authSetVerified(env, token, localId) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FB_PROJECT_ID}/accounts:update`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId, emailVerified: true }),
  });
  if (!res.ok) throw new Error('authSetVerified ' + res.status + ' ' + (await res.text()));
}
// 이메일 → localId 보장(없으면 생성) + emailVerified=true
async function ensureVerifiedUser(env, token, email) {
  let user = await authLookup(env, token, email);
  if (!user) { const id = await authSignUp(env, email); user = id ? { localId: id, emailVerified: false } : await authLookup(env, token, email); }
  if (!user || !user.localId) throw new Error('유저 생성/조회 실패');
  if (!user.emailVerified) await authSetVerified(env, token, user.localId);
  return user.localId;
}
// Firebase 커스텀 토큰 발급(서비스계정 서명, 클라이언트 signInWithCustomToken 용)
async function mintCustomToken(env, uid) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: env.FB_CLIENT_EMAIL, sub: env.FB_CLIENT_EMAIL,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    uid, iat: now, exp: now + 3600, claims: { sms_login: true },
  };
  const unsigned = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64urlStr(JSON.stringify(claim));
  const key = await importPkcs8((env.FB_PRIVATE_KEY || '').replace(/\\n/g, '\n'));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return unsigned + '.' + b64urlBuf(sig);
}

/* ── OTP · Solapi ── */
function genOtp() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0] % 1000000).padStart(6, '0'); }
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function solapiSign(secret, date, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sendSms(env, to, text) {
  const date = new Date().toISOString(), salt = crypto.randomUUID();
  const sig = await solapiSign(env.SOLAPI_API_SECRET, date, salt);
  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${sig}` },
    body: JSON.stringify({ message: { to: to.replace(/[^0-9]/g, ''), from: env.SOLAPI_SENDER.replace(/[^0-9]/g, ''), text } }),
  });
  if (!res.ok) throw new Error('SMS 발송 실패: ' + (await res.text()));
}

const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || ''));
const lc = (e) => String(e || '').trim().toLowerCase();
const otpKey = (email) => 'login-otp/' + lc(email).replace(/[^a-z0-9]+/g, '_');
const maskPhone = (p) => { const d = String(p || '').replace(/[^0-9]/g, ''); return d.length < 4 ? '****' : '***' + d.slice(-4); };

// 이메일이 허용 계정인지 + 코드 받을 휴대폰 조회 (config/access 기준)
function resolveAccount(access, email) {
  const e = lc(email);
  const master = lc(access.masterEmail);
  const masters = [master, ...((Array.isArray(access.masterEmails) ? access.masterEmails : []).map(lc))].filter(Boolean);
  const allowed = (Array.isArray(access.allowedEmails) ? access.allowedEmails : []).map(lc);
  const isMaster = masters.includes(e);
  const isAllowed = isMaster || allowed.includes(e);
  const phones = access.loginPhones || {};
  // 이메일별 등록 휴대폰 우선. 소유자 마스터는 masterPhone 을 기본값으로.
  let phone = '';
  for (const k in phones) { if (lc(k) === e) { phone = phones[k]; break; } }
  if (!phone && e === master) phone = access.masterPhone || '';
  return { isAllowed, phone: String(phone || '').replace(/[^0-9]/g, '') };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    for (const k of ['FB_PROJECT_ID', 'FB_CLIENT_EMAIL', 'FB_PRIVATE_KEY', 'FB_API_KEY', 'SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER'])
      if (!env[k]) return json({ error: '서버 설정 누락: ' + k }, 500);

    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    let body; try { body = await request.json(); } catch { return json({ error: 'JSON 형식 오류' }, 400); }

    try {
      const token = await getAccessToken(env);
      const accessDoc = await fsGet(env, token, 'config/access');
      const access = accessDoc ? fields(accessDoc) : null;

      if (path.endsWith('/request')) {
        const email = lc(body.email);
        if (!isEmail(email)) return json({ error: '이메일 형식이 올바르지 않습니다.' }, 400);
        if (!access || !access.masterEmail) return json({ error: '아직 초기 설정 전입니다. 비밀번호로 로그인하세요.' }, 400);
        const { isAllowed, phone } = resolveAccount(access, email);
        if (!isAllowed) return json({ error: '허용된 계정이 아닙니다. 관리자에게 문의하세요.' }, 403);
        if (!phone || phone.length < 10) return json({ error: '이 계정에 등록된 휴대폰이 없습니다. 관리자에게 등록을 요청하거나 비밀번호로 로그인하세요.' }, 400);
        const otp = genOtp();
        await fsPatch(env, token, otpKey(email), {
          codeHash: await sha256hex(otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, email, phone, createdAt: Date.now(),
        });
        await sendSms(env, phone, `[POUR 대시보드] 로그인 인증코드: ${otp} (3분 유효). 본인이 요청하지 않았다면 무시하세요.`);
        return json({ ok: true, phoneMasked: maskPhone(phone) });
      }

      if (path.endsWith('/confirm')) {
        const email = lc(body.email), code = String(body.code || '').trim();
        if (!isEmail(email)) return json({ error: '이메일 형식이 올바르지 않습니다.' }, 400);
        const key = otpKey(email);
        const rec = fields(await fsGet(env, token, key));
        if (!rec.codeHash) return json({ error: '진행 중인 인증 요청이 없습니다. 코드를 다시 요청하세요.' }, 400);
        if (Date.now() > (rec.expiresAt || 0)) { await fsDelete(env, token, key); return json({ error: '인증코드가 만료되었습니다. 다시 요청하세요.' }, 400); }
        if ((rec.attempts || 0) >= OTP_MAX_ATTEMPTS) { await fsDelete(env, token, key); return json({ error: '시도 횟수를 초과했습니다. 다시 요청하세요.' }, 400); }
        if ((await sha256hex(code)) !== rec.codeHash) {
          await fsPatch(env, token, key, { attempts: (rec.attempts || 0) + 1 });
          return json({ error: '인증코드가 일치하지 않습니다.' }, 400);
        }
        // 코드 일치 → 유저 보장 + 커스텀 토큰
        const uid = await ensureVerifiedUser(env, token, email);
        const customToken = await mintCustomToken(env, uid);
        await fsDelete(env, token, key);
        return json({ ok: true, customToken, verifyDays: VERIFY_DAYS });
      }

      return json({ error: 'Not found (use /request or /confirm)' }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 400);
    }
  },
};
