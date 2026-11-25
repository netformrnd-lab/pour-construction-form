/**
 * Cloudflare Pages Function — 분해원가 파일 보관 (Cloudflare Workers KV · 카드 등록 없음) · 2026-11-25 송희님 'KV 확정'
 *
 *   견적서 파일(PDF·이미지)  kind = quote : 보기 = 마스터·경영 열람 · 올리기·지우기·되살리기 = 마스터
 *   사진 원본(이미지)         kind = photo : 보기 = 마스터·부마스터·경영 열람 · 올리기·지우기 = 마스터
 *   (카드 안 작은 썸네일은 그대로 Firestore 카드 문서에 — 여기는 원본 큰 사진만)
 *
 *   GET    /api/cost-files/status                       → { ready, store, maxMB, trashDays, limitMB, dayWrites }   (로그인 없이 · 연결 여부만)
 *   GET    /api/cost-files/usage                        → 쓴 용량·남은 용량(1GB 중)·80% 경고·오늘 쓰기 횟수   (원가 볼 수 있는 사람)
 *   POST   /api/cost-files/upload?kind=quote|photo       본문 = 파일 · X-File-Name = encodeURIComponent(이름) → { key, size, type, name, dup }
 *   POST   /api/cost-files/notion-copy                   { url, name, quoteNotionId } → 노션 파일 서버에서 직접 받아 견적서로 보관 (마스터)
 *                                                        → { fileId, key, size, type, name, dedup }
 *   GET    /api/cost-files/file/<kind>/<sha256>.<ext>    → 파일
 *   DELETE /api/cost-files/file/<kind>/<sha256>.<ext>    → 휴지통(trash/… · 30일 뒤 KV 가 스스로 지움)
 *   POST   /api/cost-files/restore/<kind>/<sha256>.<ext> → 휴지통에서 되살림
 *   GET    /api/cost-files/trash                         → 휴지통 목록 (마스터)
 *   POST   /api/cost-files/recount                       → 용량 다시 세기 (마스터 · 숫자가 어긋났을 때)
 *
 * KV 무료 한도에 맞춤: 값 1개 25MiB → 파일당 20MB · 저장 1GB → 남은 용량 표시·80% 경고·꽉 차면 거절
 *                    · 쓰기 하루 1,000번(한국 오전 9시에 풀림) → 넘으면 안내 · 같은 파일(내용 SHA-256)은 한 번만
 * 보안
 *   · 요청마다 Authorization: Bearer <Firebase ID 토큰> — 구글 공개키로 서명·발급 프로젝트(FIREBASE_PROJECT_ID)·만료 확인
 *   · 역할 = 그 사람 토큰으로 Firestore config/access 를 읽어 보안 규칙과 같은 식으로 판정
 *       마스터 = 이메일 인증 + (masterEmail 또는 masterEmails) · 부마스터 = 이메일 인증 + subMasterEmails · 경영 열람 = 이메일 인증 + mgmtEmails
 *   · 파일 내용 첫 바이트로 종류 확인(PDF·JPEG·PNG·GIF·WebP·HEIC만) · 열쇠 = 내용의 SHA-256 (이름·경로를 사용자가 못 정함)
 *   · 노션 복사는 노션 파일 서버 주소만(https · file.notion.so · prod-files-secure.s3.*.amazonaws.com · s3.*.amazonaws.com/secure.notion-static.com/…)
 *     — 다른 주소로 넘기는(redirect) 것도 매번 같은 검사
 *
 * 설정 (Pages 프로젝트 pour-construction-form · 프로덕션·미리보기 둘 다)
 *   · KV 바인딩: 변수 이름 QUOTE_KV → 네임스페이스 pourstore-pricing-files (id f0e6bcdb6c4e43b087515ee42eab1231)
 *   · 변수: FIREBASE_PROJECT_ID = pourstoreproject   (비면 pourstoreproject)
 *   · 바인딩이 없으면 status.ready = false → 화면은 '파일 보관 준비 중'만 보이고 다른 기능은 그대로
 */
const MAX_BYTES = 20 * 1024 * 1024;
const LIMIT_BYTES = 1024 * 1024 * 1024;   // KV 무료 저장 1GB
const WARN_PCT = 80;
const DAY_WRITES = 1000;                  // KV 무료 쓰기 하루 1,000번 (UTC 0시 = 한국 오전 9시에 풀림)
const TRASH_DAYS = 30;
const TRASH = 'trash/';
const USAGE_KEY = 'meta/usage';
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
class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }

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

/* ── KV: 한도 오류 → 알아듣는 말 ── */
const dayUtc = () => new Date().toISOString().slice(0, 10);
function kvErr(e, what) {
  const m = String((e && e.message) || e);
  if (/limit|exceed|quota|429|too many/i.test(m)) return new HttpError(429, `오늘 파일 보관 쓰기 한도(하루 ${DAY_WRITES.toLocaleString()}번)를 넘었어요 · 한국 시간 오전 9시에 다시 돼요`, { limit: 'day-writes' });
  console.error('[cost-files] KV ' + what + ' 실패', e);
  return new HttpError(502, `파일 보관(KV) ${what} 실패: ${m.slice(0, 120)}`);
}
async function kvPut(kv, key, value, opt, what) { try { await kv.put(key, value, opt); } catch (e) { throw kvErr(e, what); } }
async function exists(kv, key) {   // 값 전체를 받지 않고 있는지만 (읽기 1번)
  const v = await kv.get(key, { type: 'stream' });
  if (v && typeof v.cancel === 'function') { try { await v.cancel(); } catch (e) {} }
  return !!v;
}
/* 용량·오늘 쓰기 장부 (meta/usage) — 올리기·지우기·되살리기 때 같이 고침(쓰기 1번 더) · 휴지통은 목록으로 셈(30일 뒤 KV 가 지우면 저절로 빠짐) */
async function readUsage(kv) {
  let u = null; try { u = await kv.get(USAGE_KEY, { type: 'json' }); } catch (e) { u = null; }
  return u && u.live ? u : null;
}
async function recount(kv) {
  const live = { bytes: 0, files: 0 };
  for (const prefix of ['quote/', 'photo/']) {
    let cursor;
    for (let i = 0; i < 20; i++) {
      const l = await kv.list({ prefix, cursor, limit: 1000 });
      for (const k of l.keys || []) { live.bytes += Number((k.metadata || {}).s || 0); live.files++; }
      if (l.list_complete !== false || !l.cursor) break; cursor = l.cursor;
    }
  }
  return live;
}
async function trashSum(kv) {
  const t = { bytes: 0, files: 0 }; let cursor;
  for (let i = 0; i < 10; i++) {
    const l = await kv.list({ prefix: TRASH, cursor, limit: 1000 });
    for (const k of l.keys || []) { t.bytes += Number((k.metadata || {}).s || 0); t.files++; }
    if (l.list_complete !== false || !l.cursor) break; cursor = l.cursor;
  }
  return t;
}
async function usageNow(kv) {
  let u = await readUsage(kv);
  if (!u) u = { live: await recount(kv), day: dayUtc(), w: 0 };
  const trash = await trashSum(kv), used = u.live.bytes + trash.bytes;
  const w = u.day === dayUtc() ? u.w : 0;
  return { live: u.live, trash, usedBytes: used, limitBytes: LIMIT_BYTES, pct: Math.round((used / LIMIT_BYTES) * 1000) / 10, warn: used >= LIMIT_BYTES * WARN_PCT / 100,
    today: { date: dayUtc(), writes: w, limit: DAY_WRITES, warn: w >= DAY_WRITES * 0.9 } };
}
async function bump(kv, dBytes, dFiles, writes) {
  const u = (await readUsage(kv)) || { live: await recount(kv), day: dayUtc(), w: 0 };
  if (u.day !== dayUtc()) { u.day = dayUtc(); u.w = 0; }
  u.live = { bytes: Math.max(0, u.live.bytes + dBytes), files: Math.max(0, u.live.files + dFiles) };
  u.w += writes + 1; u.at = new Date().toISOString();
  try { await kv.put(USAGE_KEY, JSON.stringify(u)); } catch (e) { console.warn('[cost-files] 용량 장부 못 고침 (다음에 다시 셈)', e); }
}

/* ── 보관 (올리기·노션 복사 같은 길) ── */
async function store(kv, kind, buf, name, user) {
  const K = KINDS[kind];
  if (!buf.byteLength) throw new HttpError(400, '빈 파일이에요');
  if (buf.byteLength > MAX_BYTES) throw new HttpError(413, `파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`);
  const t = sniff(new Uint8Array(buf, 0, Math.min(64, buf.byteLength)));
  if (!t || (t.pdf && !K.pdf)) throw new HttpError(415, K.pdf ? 'PDF·이미지(JPG·PNG·GIF·WebP·HEIC)만 보관할 수 있어요' : '이미지(JPG·PNG·GIF·WebP·HEIC)만 보관할 수 있어요');
  const sha = hex(await crypto.subtle.digest('SHA-256', buf));
  const key = `${kind}/${sha}.${t.ext}`;
  if (await exists(kv, key)) { console.log(`[cost-files] 같은 파일 있음 ${key} · ${user.email}`); return { key, size: buf.byteLength, type: t.type, name, dup: true }; }
  const u = await usageNow(kv);
  if (u.usedBytes + buf.byteLength > LIMIT_BYTES) throw new HttpError(507, `보관 용량이 모자라요 (1GB 중 ${u.pct}% 사용) · 휴지통이 비거나 안 쓰는 파일을 빼면 다시 돼요`, { usage: u });
  if (u.today.writes >= DAY_WRITES) throw new HttpError(429, `오늘 파일 보관 쓰기 한도(하루 ${DAY_WRITES.toLocaleString()}번)를 넘었어요 · 한국 시간 오전 9시에 다시 돼요`, { limit: 'day-writes' });
  await kvPut(kv, key, buf, { metadata: { n: name.slice(0, 60), t: t.type, s: buf.byteLength, by: user.email.slice(0, 80), at: new Date().toISOString() } }, '쓰기');
  await bump(kv, buf.byteLength, 1, 1);
  console.log(`[cost-files] 보관 ${key} · ${buf.byteLength}B · ${user.email}`);
  return { key, size: buf.byteLength, type: t.type, name, dup: false };
}

/* ── 노션 파일 주소만 (임시 주소 · 1시간) ── */
function notionHostOk(u) {
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'file.notion.so' || h === 'secure.notion-static.com') return true;
  if (/^prod-files-secure\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(h)) return true;
  if (/^s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(h) && u.pathname.startsWith('/secure.notion-static.com/')) return true;
  return false;
}
async function fetchNotion(url0) {
  let url = url0;
  for (let hop = 0; hop < 4; hop++) {
    let u; try { u = new URL(url); } catch (e) { throw new HttpError(400, '노션 파일 주소가 올바르지 않아요'); }
    if (!notionHostOk(u)) throw new HttpError(400, hop ? '노션 파일이 다른 주소로 넘어가요 (노션 파일 서버만 받아요)' : '노션 파일 서버 주소만 받을 수 있어요 (file.notion.so · prod-files-secure.s3…amazonaws.com)');
    const r = await fetch(u.toString(), { redirect: 'manual', headers: { 'User-Agent': 'pour-cost-files/1' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('Location')) { url = new URL(r.headers.get('Location'), u).toString(); continue; }
    if (r.status === 403 || r.status === 400) throw new HttpError(410, '노션 파일 주소가 만료됐어요 (1시간짜리) · 노션에서 다시 보내 주세요');
    if (!r.ok) throw new HttpError(502, `노션 파일을 받지 못했어요 (${r.status})`);
    const len = Number(r.headers.get('Content-Length') || 0);
    if (len > MAX_BYTES) throw new HttpError(413, `노션 파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`);
    const reader = r.body.getReader(), chunks = []; let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.byteLength; if (n > MAX_BYTES) { try { await reader.cancel(); } catch (e) {} throw new HttpError(413, `노션 파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`); } chunks.push(value); }
    const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
    return out.buffer;
  }
  throw new HttpError(502, '노션 파일 주소가 너무 여러 번 넘어가요');
}

/* ── 처리 ── */
async function handle(context) {
  const { request, env, params } = context;
  const parts = [].concat(params.path || []).filter(Boolean);
  const route = parts[0] || '', method = request.method;
  const kv = env.QUOTE_KV && typeof env.QUOTE_KV.get === 'function' && typeof env.QUOTE_KV.put === 'function' ? env.QUOTE_KV : null;

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (route === 'status' && method === 'GET') return json(request, { ok: true, ready: !!kv, store: 'kv', maxMB: MAX_BYTES / 1048576, trashDays: TRASH_DAYS, limitMB: LIMIT_BYTES / 1048576, warnPct: WARN_PCT, dayWrites: DAY_WRITES });
  if (!kv) return json(request, { ok: false, ready: false, error: '파일 보관 준비 중이에요 (Cloudflare KV 연결 전)' }, 503);

  const user = await authed(request, env);

  if (route === 'usage' && method === 'GET') {
    need(user, ['master', 'sub', 'mgmt'], '보관 용량 보기');
    return json(request, { ok: true, ...(await usageNow(kv)) });
  }

  if (route === 'upload' && method === 'POST') {
    const kind = new URL(request.url).searchParams.get('kind') || '';
    const K = KINDS[kind]; if (!K) throw new HttpError(400, '파일 종류(kind)가 올바르지 않아요');
    need(user, K.write, K.label + ' 올리기');
    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > MAX_BYTES) throw new HttpError(413, `파일이 너무 커요 (${MAX_BYTES / 1048576}MB까지)`);
    let name = ''; try { name = cleanName(decodeURIComponent(request.headers.get('X-File-Name') || '')); } catch (e) { name = '파일'; }
    const r = await store(kv, kind, await request.arrayBuffer(), name, user);
    return json(request, { ok: true, ...r });
  }

  if (route === 'notion-copy' && method === 'POST') {
    need(user, ['master'], '노션 파일 복사');
    let b = {}; try { b = await request.json(); } catch (e) { throw new HttpError(400, '요청 모양이 달라요 ({ url, name, quoteNotionId })'); }
    const url = String(b.url || '').trim();
    if (!url) throw new HttpError(400, '노션 파일 주소(url)가 없어요');
    const buf = await fetchNotion(url);
    let name = cleanName(b.name || ''); if (name === '파일') { try { name = cleanName(decodeURIComponent(new URL(url).pathname.split('/').pop() || '')); } catch (e) { name = '노션 파일'; } }
    const r = await store(kv, 'quote', buf, name, user);
    console.log(`[cost-files] 노션 복사 ${String(b.quoteNotionId || '').slice(0, 40)} → ${r.key}${r.dup ? ' (같은 파일)' : ''}`);
    return json(request, { ok: true, fileId: r.key, key: r.key, size: r.size, type: r.type, name: r.name, dedup: r.dup });
  }

  if (route === 'file' && (method === 'GET' || method === 'HEAD')) {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, K.read, K.label + ' 보기');
    const { value, metadata } = await kv.getWithMetadata(key, { type: 'stream' });
    if (!value) {
      const tr = await exists(kv, TRASH + key);
      throw new HttpError(tr ? 410 : 404, tr ? `지운 파일이에요 (휴지통 ${TRASH_DAYS}일 보관 중 · 마스터가 되살릴 수 있어요)` : '파일이 없어요');
    }
    const md = metadata || {}, q = new URL(request.url).searchParams.get('name');
    const name = q ? cleanName(q) : cleanName(md.n || '');
    const h = new Headers(cors(request));
    h.set('Content-Type', md.t || 'application/octet-stream');
    h.set('Content-Disposition', `inline; filename="file.${key.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    h.set('Cache-Control', 'private, no-store');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; sandbox");
    if (md.s) h.set('Content-Length', String(md.s));
    if (method === 'HEAD') { try { await value.cancel(); } catch (e) {} return new Response(null, { status: 200, headers: h }); }
    return new Response(value, { status: 200, headers: h });
  }

  if (route === 'file' && method === 'DELETE') {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, K.write, K.label + ' 지우기');
    const { value, metadata } = await kv.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!value) { if (await exists(kv, TRASH + key)) return json(request, { ok: true, key, trashed: true, already: true }); throw new HttpError(404, '파일이 없어요'); }
    await kvPut(kv, TRASH + key, value, { expirationTtl: TRASH_DAYS * 86400, metadata: { ...(metadata || {}), del: new Date().toISOString(), dby: user.email.slice(0, 80) } }, '휴지통 쓰기');
    try { await kv.delete(key); } catch (e) { throw kvErr(e, '지우기'); }
    await bump(kv, -Number((metadata || {}).s || value.byteLength), -1, 1);
    console.log(`[cost-files] 휴지통으로 ${key} · ${user.email}`);
    return json(request, { ok: true, key, trashed: true, purgeAfterDays: TRASH_DAYS });
  }

  if (route === 'restore' && method === 'POST') {
    const { key, kind } = keyFrom(parts.slice(1)); const K = KINDS[kind];
    need(user, ['master'], K.label + ' 되살리기');
    const { value, metadata } = await kv.getWithMetadata(TRASH + key, { type: 'arrayBuffer' });
    if (!value) { if (await exists(kv, key)) return json(request, { ok: true, key, restored: true, already: true }); throw new HttpError(404, `휴지통에 없어요 (${TRASH_DAYS}일이 지나 정리됐을 수 있어요)`); }
    let added = false;
    if (!(await exists(kv, key))) { const md = { ...(metadata || {}) }; delete md.del; delete md.dby; await kvPut(kv, key, value, { metadata: md }, '되살리기'); added = true; }
    try { await kv.delete(TRASH + key); } catch (e) { throw kvErr(e, '휴지통 지우기'); }
    if (added) await bump(kv, Number((metadata || {}).s || value.byteLength), 1, 1);
    console.log(`[cost-files] 되살림 ${key} · ${user.email}`);
    return json(request, { ok: true, key, restored: true });
  }

  if (route === 'trash' && method === 'GET') {
    need(user, ['master'], '휴지통 보기');
    const l = await kv.list({ prefix: TRASH, limit: 1000 });
    const files = (l.keys || []).map(k => { const md = k.metadata || {};
      return { key: k.name.slice(TRASH.length), size: Number(md.s || 0), name: md.n || '', deletedAt: md.del || '', deletedBy: md.dby || '', purgeAt: k.expiration ? new Date(k.expiration * 1000).toISOString() : '' }; });
    return json(request, { ok: true, files, truncated: l.list_complete === false });
  }

  if (route === 'recount' && method === 'POST') {
    need(user, ['master'], '용량 다시 세기');
    const old = (await readUsage(kv)) || { day: dayUtc(), w: 0 };
    const u = { live: await recount(kv), day: old.day === dayUtc() ? old.day : dayUtc(), w: old.day === dayUtc() ? (old.w || 0) + 1 : 1, at: new Date().toISOString() };
    await kvPut(kv, USAGE_KEY, JSON.stringify(u), {}, '용량 장부 쓰기');
    return json(request, { ok: true, ...(await usageNow(kv)) });
  }

  throw new HttpError(404, '없는 주소예요');
}

export async function onRequest(context) {
  try { return await handle(context); }
  catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError) || status === 500) console.error('[cost-files] 오류', e);
    return json(context.request, { ok: false, error: e.message || String(e), ...((e && e.extra) || {}) }, status);
  }
}
