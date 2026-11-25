/**
 * Cloudflare Pages Function — 분해원가 파일 보관 (Cloudflare R2) · 2026-11-25 송희님 '① R2 확정'
 *
 *   견적서 파일(PDF·이미지)  kind = quote : 보기 = 마스터·경영 열람 · 올리기·지우기·되살리기 = 마스터
 *   사진 원본(이미지)         kind = photo : 보기 = 마스터·부마스터·경영 열람 · 올리기·지우기 = 마스터
 *   (카드 안 작은 썸네일은 그대로 Firestore 카드 문서에 — 여기는 원본 큰 사진만)
 *
 *   GET    /api/cost-files/status                      → { ready, maxMB, trashDays }        (로그인 없이 · 버킷 연결 여부만)
 *   POST   /api/cost-files/upload?kind=quote|photo      본문 = 파일 그대로 · X-File-Name = encodeURIComponent(이름)
 *                                                       → { key, size, type, name, dup }      같은 파일(내용이 같음)이면 하나로(dup: true)
 *   GET    /api/cost-files/file/<kind>/<sha256>.<ext>   → 파일
 *   DELETE /api/cost-files/file/<kind>/<sha256>.<ext>   → 휴지통(trash/…)으로 · 30일 뒤 정리
 *   POST   /api/cost-files/restore/<kind>/<sha256>.<ext> → 휴지통에서 되살림
 *   GET    /api/cost-files/trash                        → 휴지통 목록 (마스터)
 *
 * 보안
 *   · 요청마다 Authorization: Bearer <Firebase ID 토큰> — 구글 공개키로 서명·발급 프로젝트(FIREBASE_PROJECT_ID)·만료 확인
 *   · 역할 = 그 사람 토큰으로 Firestore config/access 를 읽어 보안 규칙과 같은 식으로 판정
 *       마스터 = 이메일 인증 + (masterEmail 또는 masterEmails) · 부마스터 = 이메일 인증 + subMasterEmails · 경영 열람 = 이메일 인증 + mgmtEmails
 *   · 파일 내용 첫 바이트로 종류 확인(PDF·JPEG·PNG·GIF·WebP·HEIC만) · 파일당 20MB · 열쇠 = 내용의 SHA-256 (이름·경로를 사용자가 못 정함)
 *   · 버킷은 공개 안 함 — 이 함수로만 읽고 씀
 *
 * 설정 (Cloudflare › Workers & Pages › pour-construction-form › 설정 — 프로덕션·미리보기 둘 다)
 *   · 바인딩: R2 버킷  변수 이름 QUOTE_FILES → 버킷 pour-quote-files
 *   · 변수: FIREBASE_PROJECT_ID = pourstoreproject   (비면 pourstoreproject)
 *   · 바인딩이 없으면 status.ready = false → 화면은 '파일 보관 준비 중'만 보이고 다른 기능은 그대로
 */
const MAX_BYTES = 20 * 1024 * 1024;
const TRASH_DAYS = 30;
const TRASH = 'trash/';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?pour-construction-form\.pages\.dev$/;
const KINDS = {
  quote: { read: ['master', 'mgmt'], write: ['master'], pdf: true, label: '견적서' },
  photo: { read: ['master', 'sub', 'mgmt'], write: ['master'], pdf: false, label: '사진 원본' },
};
const KEY_RE = /^(quote|photo)\/([0-9a-f]{64})\.(pdf|jpg|png|gif|webp|heic)$/;

/* ── 응답 ── */
function cors(request) {
  const o = request.headers.get('Origin');
  return o && ALLOWED_ORIGIN.test(o)
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
}
function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(request) } });
}
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

/* ── Firebase 로그인 확인 (functions/api/team-ai.js 와 같은 방식) ── */
function b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlJson(s) { return JSON.parse(new TextDecoder().decode(b64urlBytes(s))); }
let jwksCache = { at: 0, keys: [] };
async function jwks() {
  if (Date.now() - jwksCache.at < 3600e3 && jwksCache.keys.length) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new HttpError(503, '로그인 확인 키를 받지 못했어요 (' + r.status + ')');
  const j = await r.json();
  jwksCache = { at: Date.now(), keys: j.keys || [] };
  return jwksCache.keys;
}
async function verifyIdToken(token, projectId) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new HttpError(401, '로그인 정보가 없어요');
  const [h, p, s] = parts;
  let head, pay;
  try { head = b64urlJson(h); pay = b64urlJson(p); } catch (e) { throw new HttpError(401, '로그인 정보 형식이 달라요'); }
  if (head.alg !== 'RS256') throw new HttpError(401, '로그인 정보 형식이 달라요');
  let jwk = (await jwks()).find(k => k.kid === head.kid);
  if (!jwk) { jwksCache.at = 0; jwk = (await jwks()).find(k => k.kid === head.kid); }
  if (!jwk) throw new HttpError(401, '로그인 확인 키가 맞지 않아요');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new HttpError(401, '로그인 정보가 올바르지 않아요');
  const now = Math.floor(Date.now() / 1000);
  if (pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId) throw new HttpError(401, '다른 앱의 로그인이에요');
  if (!pay.exp || pay.exp < now - 60) throw new HttpError(401, '로그인이 만료됐어요 · 새로고침 후 다시 해 주세요');
  if (pay.iat && pay.iat > now + 300) throw new HttpError(401, '로그인 정보 시간이 맞지 않아요');
  if (!pay.sub) throw new HttpError(401, '로그인 정보가 올바르지 않아요');
  return { uid: pay.sub, email: String(pay.email || '').toLowerCase(), verified: pay.email_verified === true };
}
/* 역할: 그 사람 토큰으로 config/access 읽기 (규칙상 로그인한 사람은 읽기 가능) — 보안 규칙 isMaster·isSubMaster·isMgmt 와 같은 식 */
function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  if ('booleanValue' in v) return v.booleanValue;
  return null;
}
async function rolesOf(projectId, token, user) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/access`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return new Set();
  if (!r.ok) throw new HttpError(503, '계정 권한을 확인하지 못했어요 (' + r.status + ')');
  const f = (await r.json()).fields || {};
  const lc = a => (Array.isArray(a) ? a : []).map(x => String(x || '').toLowerCase());
  const e = user.email, out = new Set();
  if (!e || !user.verified) return out;   // 규칙과 같이 이메일 인증 필요
  if (e === String(fsVal(f.masterEmail) || '').toLowerCase() || lc(fsVal(f.masterEmails)).includes(e)) out.add('master');
  if (lc(fsVal(f.subMasterEmails)).includes(e)) out.add('sub');
  if (lc(fsVal(f.mgmtEmails)).includes(e)) out.add('mgmt');
  return out;
}
async function authed(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HttpError(401, '로그인 정보가 없어요');
  const projectId = env.FIREBASE_PROJECT_ID || 'pourstoreproject';
  const user = await verifyIdToken(m[1].trim(), projectId);
  user.roles = await rolesOf(projectId, m[1].trim(), user);
  return user;
}
function need(user, list, what) {
  if (!list.some(r => user.roles.has(r))) throw new HttpError(403, what + ' 권한이 없어요');
}

/* ── 파일 종류: 첫 바이트로 확인 ── */
function sniff(u8) {
  const at = (i, arr) => arr.every((b, k) => u8[i + k] === b);
  const asc = (i, n) => String.fromCharCode(...u8.slice(i, i + n));
  if (u8.length >= 5 && asc(0, 5) === '%PDF-') return { type: 'application/pdf', ext: 'pdf', pdf: true };
  if (u8.length >= 3 && at(0, [0xFF, 0xD8, 0xFF])) return { type: 'image/jpeg', ext: 'jpg' };
  if (u8.length >= 8 && at(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return { type: 'image/png', ext: 'png' };
  if (u8.length >= 6 && (asc(0, 6) === 'GIF87a' || asc(0, 6) === 'GIF89a')) return { type: 'image/gif', ext: 'gif' };
  if (u8.length >= 12 && asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  if (u8.length >= 12 && asc(4, 4) === 'ftyp' && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(asc(8, 4))) return { type: 'image/heic', ext: 'heic' };
  return null;
}
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '_').trim().slice(0, 200) || '파일';
function keyFrom(parts) {
  const key = parts.join('/');
  const m = key.match(KEY_RE);
  if (!m) throw new HttpError(400, '파일 열쇠가 올바르지 않아요');
  return { key, kind: m[1] };
}

/* ── 휴지통 정리: 30일 지난 것 (지울 때·되살릴 때·목록 볼 때 같이) ── */
async function purge(bucket) {
  const limit = Date.now() - TRASH_DAYS * 864e5, old = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const l = await bucket.list({ prefix: TRASH, limit: 1000, cursor });
    for (const o of l.objects || []) if (new Date(o.uploaded).getTime() < limit) old.push(o.key);
    if (!l.truncated) break; cursor = l.cursor;
  }
  for (let i = 0; i < old.length; i += 1000) await bucket.delete(old.slice(i, i + 1000));
  if (old.length) console.log(`[cost-files] 휴지통 ${old.length}개 정리 (${TRASH_DAYS}일 지남)`);
  return old.length;
}

/* ── 처리 ── */
async function handle(context) {
  const { request, env, params } = context;
  const parts = [].concat(params.path || []).filter(Boolean);
  const route = parts[0] || '', method = request.method;
  const bucket = env.QUOTE_FILES && typeof env.QUOTE_FILES.get === 'function' ? env.QUOTE_FILES : null;

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (route === 'status' && method === 'GET') return json(request, { ok: true, ready: !!bucket, maxMB: MAX_BYTES / 1048576, trashDays: TRASH_DAYS });
  if (!bucket) return json(request, { ok: false, ready: false, error: '파일 보관 준비 중이에요 (Cloudflare R2 연결 전)' }, 503);

  const user = await authed(request, env);

  if (route === 'upload' && method === 'POST') {
    const kind = new URL(request.url).searchParams.get('kind') || '';
    const K = KINDS[kind]; if (!K) throw new HttpError(400, '파일 종류(kind)가 올바르지 않아요');
    need(user, K.write, K.label + ' 올리기');
    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > MAX_BYTES) throw new HttpError(413, `파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) throw new HttpError(400, '빈 파일이에요');
    if (buf.byteLength > MAX_BYTES) throw new HttpError(413, `파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`);
    const t = sniff(new Uint8Array(buf, 0, Math.min(64, buf.byteLength)));
    if (!t || (t.pdf && !K.pdf)) throw new HttpError(415, K.pdf ? 'PDF·이미지(JPG·PNG·GIF·WebP·HEIC)만 올릴 수 있어요' : '이미지(JPG·PNG·GIF·WebP·HEIC)만 올릴 수 있어요');
    const sha = hex(await crypto.subtle.digest('SHA-256', buf));
    const key = `${kind}/${sha}.${t.ext}`;
    let name = ''; try { name = cleanName(decodeURIComponent(request.headers.get('X-File-Name') || '')); } catch (e) { name = '파일'; }
    const had = await bucket.head(key);
    if (!had) await bucket.put(key, buf, { httpMetadata: { contentType: t.type }, customMetadata: { name: encodeURIComponent(name), by: user.email, at: new Date().toISOString() }, sha256: sha });
    console.log(`[cost-files] ${had ? '같은 파일 있음' : '올림'} ${key} · ${buf.byteLength}B · ${user.email}`);
    return json(request, { ok: true, key, size: buf.byteLength, type: t.type, name, dup: !!had });
  }

  if (route === 'file' && (method === 'GET' || method === 'HEAD')) {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, K.read, K.label + ' 보기');
    const obj = await bucket.get(key);
    if (!obj) {
      const tr = await bucket.head(TRASH + key);
      throw new HttpError(tr ? 410 : 404, tr ? `지운 파일이에요 (휴지통 ${TRASH_DAYS}일 보관 중 · 마스터가 되살릴 수 있어요)` : '파일이 없어요');
    }
    const q = new URL(request.url).searchParams.get('name');
    let name = q ? cleanName(q) : ''; if (!name) { try { name = cleanName(decodeURIComponent((obj.customMetadata || {}).name || '')); } catch (e) { name = '파일'; } }
    const h = new Headers(cors(request));
    if (typeof obj.writeHttpMetadata === 'function') obj.writeHttpMetadata(h);
    if (!h.get('Content-Type')) h.set('Content-Type', 'application/octet-stream');
    h.set('Content-Disposition', `inline; filename="file.${key.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    h.set('Cache-Control', 'private, no-store');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; sandbox");
    if (obj.size != null) h.set('Content-Length', String(obj.size));
    return new Response(method === 'HEAD' ? null : obj.body, { status: 200, headers: h });
  }

  if (route === 'file' && method === 'DELETE') {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, K.write, K.label + ' 지우기');
    const obj = await bucket.get(key);
    if (!obj) { const tr = await bucket.head(TRASH + key); if (tr) return json(request, { ok: true, key, trashed: true, already: true }); throw new HttpError(404, '파일이 없어요'); }
    const body = await obj.arrayBuffer();
    await bucket.put(TRASH + key, body, { httpMetadata: obj.httpMetadata, customMetadata: { ...(obj.customMetadata || {}), deletedAt: new Date().toISOString(), deletedBy: user.email } });
    await bucket.delete(key);
    console.log(`[cost-files] 휴지통으로 ${key} · ${user.email}`);
    if (context.waitUntil) context.waitUntil(purge(bucket).catch(e => console.error('[cost-files] 휴지통 정리 실패', e)));
    return json(request, { ok: true, key, trashed: true, purgeAfterDays: TRASH_DAYS });
  }

  if (route === 'restore' && method === 'POST') {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, ['master'], K.label + ' 되살리기');
    const tr = await bucket.get(TRASH + key);
    if (!tr) { if (await bucket.head(key)) return json(request, { ok: true, key, restored: true, already: true }); throw new HttpError(404, `휴지통에 없어요 (${TRASH_DAYS}일이 지나 정리됐을 수 있어요)`); }
    if (!(await bucket.head(key))) {
      const md = { ...(tr.customMetadata || {}) }; delete md.deletedAt; delete md.deletedBy;
      await bucket.put(key, await tr.arrayBuffer(), { httpMetadata: tr.httpMetadata, customMetadata: md });
    }
    await bucket.delete(TRASH + key);
    console.log(`[cost-files] 되살림 ${key} · ${user.email}`);
    return json(request, { ok: true, key, restored: true });
  }

  if (route === 'trash' && method === 'GET') {
    need(user, ['master'], '휴지통 보기');
    await purge(bucket);
    const l = await bucket.list({ prefix: TRASH, limit: 1000, include: ['customMetadata'] });
    const files = (l.objects || []).map(o => {
      const md = o.customMetadata || {}; let name = ''; try { name = decodeURIComponent(md.name || ''); } catch (e) { name = ''; }
      const del = md.deletedAt || new Date(o.uploaded).toISOString();
      return { key: o.key.slice(TRASH.length), size: o.size, name, deletedAt: del, deletedBy: md.deletedBy || '', purgeAt: new Date(new Date(o.uploaded).getTime() + TRASH_DAYS * 864e5).toISOString() };
    });
    return json(request, { ok: true, files, truncated: !!l.truncated });
  }

  throw new HttpError(404, '없는 주소예요');
}

export async function onRequest(context) {
  try { return await handle(context); }
  catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error('[cost-files] 오류', e);
    return json(context.request, { ok: false, error: e.message || String(e) }, status);
  }
}
