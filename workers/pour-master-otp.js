/**
 * POUR스토어 가격대시보드 — 마스터 계정 변경 SMS-OTP Worker (Cloudflare Worker)
 * ────────────────────────────────────────────────────────────────────────
 * 목적: "마스터 계정 변경"을 반드시 (1)현재 마스터 로그인 + (2)이메일 인증 +
 *       (3)현재 마스터 휴대폰으로 받은 일회용 SMS 코드 확인 을 거쳐야만 가능하게 함.
 *  · Firestore config/access 의 masterEmail/masterPhone 은 클라이언트에서 수정 불가(규칙).
 *    변경은 이 Worker(서비스계정=Admin)만 수행 → 앱 코드/개발자도구로는 못 바꿈.
 *
 * 배포:
 *   cd workers
 *   npx wrangler secret put FB_PROJECT_ID     --config wrangler.master-otp.toml   # pourstoreproject
 *   npx wrangler secret put FB_CLIENT_EMAIL   --config wrangler.master-otp.toml   # 서비스계정 이메일
 *   npx wrangler secret put FB_PRIVATE_KEY    --config wrangler.master-otp.toml   # 서비스계정 개인키(PEM, \n 포함 그대로)
 *   npx wrangler secret put SOLAPI_API_KEY    --config wrangler.master-otp.toml
 *   npx wrangler secret put SOLAPI_API_SECRET --config wrangler.master-otp.toml
 *   npx wrangler secret put SOLAPI_SENDER     --config wrangler.master-otp.toml   # 발신번호
 *   npx wrangler deploy --config wrangler.master-otp.toml
 *   → 배포 URL 을 앱 [계정 관리] > "OTP Worker URL" 에 입력
 *
 * 엔드포인트 (POST JSON):
 *   /request  { idToken, newEmail, newPhone? }  → 현재 마스터폰으로 코드 발송
 *   /confirm  { idToken, code }                 → 코드 확인 후 마스터 변경
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

/* ── base64url ── */
const b64urlBuf = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/* ── 서비스계정 → Firestore REST 액세스 토큰 (JWT-bearer) ── */
let _tok = null, _tokExp = 0;
async function importPkcs8(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
async function getAccessToken(env) {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: env.FB_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
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

/* ── Firebase ID 토큰 검증 (RS256, JWK) ── */
let _jwks = null, _jwksExp = 0;
async function getJwks() {
  if (_jwks && Date.now() < _jwksExp) return _jwks;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  _jwks = await res.json();
  const cc = res.headers.get('cache-control') || ''; const m = cc.match(/max-age=(\d+)/);
  _jwksExp = Date.now() + ((m ? +m[1] : 3600) * 1000);
  return _jwks;
}
async function verifyIdToken(idToken, projectId) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('토큰 형식 오류');
  const [h, p, s] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('aud 불일치');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('iss 불일치');
  if (payload.exp < now) throw new Error('토큰 만료');
  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('서명 키 없음');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('서명 검증 실패');
  return payload; // {email, email_verified, ...}
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

/* ── 현재 마스터 인증 확인 (공통) ── */
async function requireMaster(env, token, idToken) {
  const payload = await verifyIdToken(idToken, env.FB_PROJECT_ID);
  if (!payload.email_verified) throw new Error('이메일 인증이 필요합니다.');
  const access = fields(await fsGet(env, token, 'config/access'));
  if (!access.masterEmail) throw new Error('마스터 계정이 아직 설정되지 않았습니다.');
  if (String(payload.email).toLowerCase() !== String(access.masterEmail).toLowerCase()) throw new Error('현재 마스터 계정만 변경할 수 있습니다.');
  return { payload, access };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    for (const k of ['FB_PROJECT_ID', 'FB_CLIENT_EMAIL', 'FB_PRIVATE_KEY', 'SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER'])
      if (!env[k]) return json({ error: '서버 설정 누락: ' + k }, 500);

    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    let body; try { body = await request.json(); } catch { return json({ error: 'JSON 오류' }, 400); }

    try {
      const token = await getAccessToken(env);

      if (path.endsWith('/request')) {
        const { idToken, newEmail, newPhone } = body;
        if (!isEmail(newEmail)) return json({ error: '새 마스터 이메일 형식 오류' }, 400);
        const { access } = await requireMaster(env, token, idToken);
        if (!access.masterPhone) return json({ error: '마스터 휴대폰번호가 등록돼 있지 않습니다. 앱 [계정 관리]에서 먼저 등록하세요.' }, 400);
        const otp = genOtp();
        await fsPatch(env, token, 'config/master-otp', {
          codeHash: await sha256hex(otp), expiresAt: Date.now() + 180000, attempts: 0,
          pendingEmail: String(newEmail), pendingPhone: String(newPhone || access.masterPhone), requestedBy: String(access.masterEmail), createdAt: Date.now(),
        });
        await sendSms(env, access.masterPhone, `[POUR 대시보드] 마스터 계정 변경 인증코드: ${otp} (3분 유효). 요청하지 않았다면 무시하세요.`);
        return json({ ok: true });
      }

      if (path.endsWith('/confirm')) {
        const { idToken, code } = body;
        const { payload, access } = await requireMaster(env, token, idToken);
        const otp = fields(await fsGet(env, token, 'config/master-otp'));
        if (!otp.codeHash) return json({ error: '진행 중인 변경 요청이 없습니다.' }, 400);
        if (Date.now() > (otp.expiresAt || 0)) { await fsDelete(env, token, 'config/master-otp'); return json({ error: '인증코드가 만료되었습니다. 다시 요청하세요.' }, 400); }
        if ((otp.attempts || 0) >= 5) { await fsDelete(env, token, 'config/master-otp'); return json({ error: '시도 횟수를 초과했습니다. 다시 요청하세요.' }, 400); }
        if ((await sha256hex(String(code || ''))) !== otp.codeHash) {
          await fsPatch(env, token, 'config/master-otp', { attempts: (otp.attempts || 0) + 1 });
          return json({ error: '인증코드가 일치하지 않습니다.' }, 400);
        }
        const cur = Array.isArray(access.allowedEmails) ? access.allowedEmails : [];
        const nextAllowed = Array.from(new Set([...cur.map(String), String(otp.pendingEmail)]));
        await fsPatch(env, token, 'config/access', {
          masterEmail: String(otp.pendingEmail), masterPhone: String(otp.pendingPhone),
          allowedEmails: nextAllowed, updatedAt: Date.now(), updatedBy: String(payload.email),
        });
        await fsDelete(env, token, 'config/master-otp');
        return json({ ok: true, newMaster: otp.pendingEmail });
      }

      return json({ error: 'Not found (use /request or /confirm)' }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 400);
    }
  },
};
