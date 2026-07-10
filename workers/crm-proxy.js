/**
 * CRM 프록시 Worker — pourstorecrm(고객 상담 CRM) 안전 연동
 *
 * 목적: CRM Firestore는 외부 읽기가 차단되어 있어(개인정보 보호) 브라우저에서 못 읽음.
 *       이 워커가 서버에서 '서비스계정'으로 읽고 → 개인정보(연락처/이메일/이름) 제거 →
 *       기술 Q&A만 사내 챗봇(chat-internal.html)에 반환한다.
 *
 * 엔드포인트:
 *   GET /crm-kb?secret=...            — PII 제거된 Q&A 배열 반환(챗봇이 호출)
 *   GET /crm-sample?secret=...&limit=3 — 원본 필드 구조 확인용(스키마 튜닝, 관리자만)
 *
 * 환경변수(wrangler secret):
 *   WORKER_SECRET         — 클라이언트 인증용 시크릿 (필수)
 *   CRM_SERVICE_ACCOUNT   — pourstorecrm 서비스계정 JSON 전체 (필수)
 * [vars] (wrangler.toml)
 *   CRM_PROJECT_ID = "pourstorecrm"
 *   CRM_COLLECTION = "posts"          — 실제 컬렉션명으로 조정
 *   ALLOW_ORIGIN   = "*"              — 필요 시 Pages 도메인으로 제한
 *
 * 필드 매핑은 CONFIG.map 에서 조정(스키마 확인 후). 기본은 흔한 이름을 추정.
 */

const CONFIG = {
  scope: 'https://www.googleapis.com/auth/datastore',
  pageSize: 300,
  cacheTtl: 120, // 초
  // 문서 → Q&A 매핑 후보 필드명(우선순위 순). 스키마 확인 후 정리 권장.
  map: {
    title:    ['title', 'subject', '제목', 'productName', 'product', '제품', '제품명'],
    content:  ['content', 'body', 'question', '문의내용', '내용', 'desc', 'description'],
    // 답변(직원 댓글) — 배열이면 각 항목의 text/본문을 이어붙임
    comments: ['comments', 'replies', 'answers', '댓글', 'reply'],
    commentText: ['text', 'body', 'content', 'message', '내용', 'comment'],
    tags:     ['tags', 'category', '분류', 'product', '제품', 'productName'],
  },
};

export default {
  async fetch(request, env) {
    const origin = (env.ALLOW_ORIGIN || '*');
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const secret = url.searchParams.get('secret') || request.headers.get('X-Worker-Secret');
    if (!secret || secret !== env.WORKER_SECRET) {
      return json({ error: '인증 실패' }, 401, cors);
    }
    if (!env.CRM_SERVICE_ACCOUNT) {
      return json({ error: 'CRM_SERVICE_ACCOUNT 미설정' }, 500, cors);
    }

    const projectId = env.CRM_PROJECT_ID || 'pourstorecrm';
    const collection = env.CRM_COLLECTION || 'posts';

    try {
      const token = await getAccessToken(env.CRM_SERVICE_ACCOUNT, CONFIG.scope);
      const docs = await listDocs(projectId, collection, token, CONFIG.pageSize);

      if (url.pathname.endsWith('/crm-sample')) {
        const lim = Math.min(parseInt(url.searchParams.get('limit') || '3', 10), 10);
        const sample = docs.slice(0, lim).map(d => ({
          id: d._id,
          fields: Object.fromEntries(Object.entries(d).filter(([k]) => k !== '_id')
            .map(([k, v]) => [k, preview(v)])),
        }));
        return json({ collection, count: docs.length, sample }, 200, cors);
      }

      // /crm-kb — PII 제거 Q&A
      const items = docs.map(mapDoc).filter(x => x && x.a);
      const res = json({ collection, count: items.length, items }, 200, cors);
      return res;
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, cors);
    }
  },
};

/* ───────── 서비스계정 → OAuth 액세스 토큰 (JWT RS256) ───────── */
async function getAccessToken(saJson, scope) {
  const sa = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPk(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const resp = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('토큰 발급 실패: ' + JSON.stringify(data));
  return data.access_token;
}

async function importPk(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
function b64url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ───────── Firestore REST 읽기(관리자 토큰) ───────── */
async function listDocs(projectId, collection, token, pageSize) {
  const out = [];
  let pageToken = '';
  do {
    const u = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodeURIComponent(collection)}?pageSize=${pageSize}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    if (d.error) throw new Error('Firestore: ' + d.error.message);
    (d.documents || []).forEach(doc => {
      const o = { _id: doc.name.split('/').pop() };
      for (const [k, v] of Object.entries(doc.fields || {})) o[k] = decode(v);
      out.push(o);
    });
    pageToken = d.nextPageToken || '';
  } while (pageToken && out.length < 2000);
  return out;
}
function decode(v) {
  const t = Object.keys(v)[0];
  const x = v[t];
  switch (t) {
    case 'stringValue': return x;
    case 'integerValue': return parseInt(x, 10);
    case 'doubleValue': return x;
    case 'booleanValue': return x;
    case 'timestampValue': return x;
    case 'nullValue': return null;
    case 'mapValue': return Object.fromEntries(Object.entries(x.fields || {}).map(([k, w]) => [k, decode(w)]));
    case 'arrayValue': return (x.values || []).map(decode);
    default: return x;
  }
}

/* ───────── 문서 → Q&A + PII 제거 ───────── */
function pick(obj, names) { for (const n of names) if (obj[n] != null && obj[n] !== '') return obj[n]; return null; }

function mapDoc(doc) {
  const title = pick(doc, CONFIG.map.title);
  const content = pick(doc, CONFIG.map.content);
  let answer = '';
  const comments = pick(doc, CONFIG.map.comments);
  if (Array.isArray(comments)) {
    answer = comments.map(c => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object') return pick(c, CONFIG.map.commentText) || '';
      return '';
    }).filter(Boolean).join('\n\n');
  } else if (typeof comments === 'string') {
    answer = comments;
  }
  // 답변이 없으면(직원 댓글 없음) 스킵 → 미검증 답변 방지
  if (!answer) return null;

  const q = [title, content].filter(Boolean).join(' — ');
  let tagsRaw = pick(doc, CONFIG.map.tags);
  const tags = Array.isArray(tagsRaw) ? tagsRaw : (tagsRaw ? [tagsRaw] : []);
  // 제목/제품명에서 키워드 보강
  if (title) tags.push(title);

  return {
    q: scrub(q).slice(0, 300),
    a: scrub(answer).slice(0, 1500),
    tags: tags.map(scrub).filter(Boolean).slice(0, 12),
  };
}

// 개인정보 마스킹: 전화/이메일/긴 숫자 제거
function scrub(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[이메일]')
    .replace(/01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '[연락처]')
    .replace(/\b0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, '[연락처]')
    .replace(/\b\d{6,}\b/g, '[번호]')
    .trim();
}

function preview(v) {
  const t = Array.isArray(v) ? 'array(' + v.length + ')' : typeof v;
  let s = '';
  try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch { s = String(v); }
  return t + ': ' + (s || '').slice(0, 120);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + CONFIG.cacheTtl, ...(cors || {}) },
  });
}
