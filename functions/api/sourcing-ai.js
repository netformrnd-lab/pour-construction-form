/**
 * Cloudflare Pages Function — 소싱앱 💬 AI 정리함
 *
 *   POST /api/sourcing-ai
 *   Authorization: Bearer <Firebase ID 토큰>   (소싱앱에 로그인한 사람만)
 *   body: { text, atts:[{i,kind,name,url?,data?,mime?,frames?:[dataURL]}], links:[{url,title,site}],
 *           lockId, items:[{id,name,goods,maker,type,brand,concept,samples:[{type,name}]}],
 *           status:{…현황 요약…}, history:[{나,AI}] }
 *   → { ok, plan, usage, model }
 *     plan.intent = answer(질문에 답) | organize(칸에 넣기) | collect(수집함에 새로) | start(제조사 제품에서 시작)
 *     plan.reply  = 질문 답변 글, plan.actions = 넣을 것 "제안" (앱에서 확인 후에만 반영)
 *
 * 환경변수 (Cloudflare Pages > Settings > Variables and Secrets)
 *   ANTHROPIC_API_KEY      필수 (다른 AI 기능과 같은 키)
 *   SOURCING_AI_EMAILS     선택 — 쉼표로 구분한 허용 이메일. 비우면 로그인한 모든 계정 허용
 *   FIREBASE_PROJECT_ID    선택 — 기본 pour-app-new
 *
 * 이 프로젝트는 빌드 도구·npm 없이 배포하므로(기존 coach.js 와 같은 방식) Anthropic 호출은 fetch 로 한다.
 * 사진·PDF 는 Firebase Storage 주소만 받아 서버에서 직접 내려받는다(다른 주소는 거부 — 임의 주소 요청 방지).
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const MODEL = 'claude-opus-5';
const MAX_TEXT = 6000;
const MAX_ATTS = 10;
const MAX_IMG = 5 * 1024 * 1024;
const MAX_PDF = 20 * 1024 * 1024;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

/* ── Firebase 로그인 확인 (ID 토큰 서명·만료·프로젝트 검사) ── */
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
  if (!r.ok) throw new Error('로그인 확인 키를 받지 못했어요 (' + r.status + ')');
  const j = await r.json();
  jwksCache = { at: Date.now(), keys: j.keys || [] };
  return jwksCache.keys;
}
async function verifyIdToken(token, projectId) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('로그인 정보가 없어요');
  const [h, p, s] = parts;
  const head = b64urlJson(h), pay = b64urlJson(p);
  if (head.alg !== 'RS256') throw new Error('로그인 정보 형식이 달라요');
  let jwk = (await jwks()).find(k => k.kid === head.kid);
  if (!jwk) { jwksCache.at = 0; jwk = (await jwks()).find(k => k.kid === head.kid); }
  if (!jwk) throw new Error('로그인 확인 키가 맞지 않아요');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('로그인 정보가 올바르지 않아요');
  const now = Math.floor(Date.now() / 1000);
  if (pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('다른 앱의 로그인이에요');
  if (!pay.exp || pay.exp < now - 60) throw new Error('로그인이 만료됐어요 · 새로고침 후 다시 시도해 주세요');
  if (!pay.sub) throw new Error('로그인 정보가 올바르지 않아요');
  return { uid: pay.sub, email: (pay.email || '').toLowerCase() };
}

/* ── 첨부 내려받기 (Firebase Storage 주소만) ── */
function storageUrlOk(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname === 'firebasestorage.googleapis.com'; } catch (e) { return false; }
}
function bytesB64(buf) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function fetchB64(url, max) {
  if (!storageUrlOk(url)) throw new Error('허용되지 않은 파일 주소');
  const r = await fetch(url);
  if (!r.ok) throw new Error('파일을 받지 못했어요 (' + r.status + ')');
  const buf = await r.arrayBuffer();
  if (buf.byteLength > max) throw new Error('파일이 너무 커요');
  return { data: bytesB64(buf), type: (r.headers.get('content-type') || '').split(';')[0] };
}
function dataUrlParts(d) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(d || '');
  return m ? { type: m[1], data: m[2] } : null;
}
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/* ── 응답 형식 (앱이 그대로 읽어 확인 카드로 보여줌) ── */
const N = t => ({ anyOf: [{ type: t }, { type: 'null' }] });
const NE = vals => ({ anyOf: [{ type: 'string', enum: vals }, { type: 'null' }] });
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'reply', 'mentions', 'target', 'summary', 'actions', 'questions'],
  properties: {
    intent: { type: 'string', enum: ['answer', 'organize', 'collect', 'start'] },
    reply: N('string'),
    mentions: { type: 'array', items: { type: 'string' } },
    target: {
      type: 'object', additionalProperties: false,
      required: ['mode', 'itemId', 'newName', 'maker', 'variants', 'reason'],
      properties: {
        mode: { type: 'string', enum: ['none', 'existing', 'new', 'start', 'unsure'] },
        itemId: N('string'),
        newName: N('string'),
        maker: N('string'),
        variants: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
    },
    summary: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['op', 'media', 'url', 'sampleType', 'name', 'price', 'cur', 'moq', 'where', 'field', 'text', 'whose', 'why'],
        properties: {
          op: { type: 'string', enum: ['ref_link', 'ref_media', 'sample', 'request', 'packing', 'shot', 'spec', 'cert', 'doc', 'memo'] },
          media: { type: 'array', items: { type: 'integer' } },
          url: N('string'),
          sampleType: NE(['maker', 'rival']),
          name: N('string'),
          price: N('number'),
          cur: NE(['원', '$', '¥']),
          moq: N('number'),
          where: N('string'),
          field: NE(['specLine', 'spec', 'goods', 'concept', 'target', 'diff', 'cost', 'moq', 'lead', 'unitLabel', 'customs']),
          text: N('string'),
          whose: NE(['ours', 'rival']),
          why: { type: 'string' },
        },
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `당신은 넷폼(POUR스토어·GROHOME) 소싱팀 앱 "소싱앱"의 AI 도우미입니다. 담당자는 주로 폰으로 짧게 씁니다.
메시지를 보고 intent 를 하나 고릅니다.

[intent]
- answer: 현황을 묻는 질문("샘플 기다리는 거 뭐 있어?", "이번 주 할 일", "코트재 마진 얼마야?", "KP방수재에 전달 안 한 요청").
  → reply 에 답을 씁니다. actions 는 빈 배열, target.mode="none".
- organize: 이미 있는 아이템에 정보를 넣는 것(샘플 가격·요청사항·패킹·촬영·스펙·인증·서류·참고 링크/사진).
- collect: 새로 본 아이템을 수집함에 넣는 것(처음 보는 SNS·1688 링크, 매장 사진, "이거 괜찮아 보임", 이름만 적기).
  → target.mode="new", newName 에 짧은 이름. 링크는 ref_link, 사진은 ref_media, 나머지 말은 memo 로.
- start: 제조사 제품을 보고 판매 컨셉을 잡는 것("KP방수재 코트재 20kg으로 셀프 방수 키트 만들자").
  → target.mode="start", maker=제조사명, newName=제조사 원래 제품명, variants=판매할 파생 상품 이름들(없으면 빈 배열).
  제품 정보(단가·MOQ·스펙·컨셉)가 있으면 actions 로 함께 넣습니다(원본 제품에 들어감).
질문과 정보가 섞여 있으면 정보 쪽 intent 를 고르고 reply 에 짧게 답도 씁니다.

[answer 쓰는 법]
- "앱 현황(JSON)"만 근거로 답합니다. 없는 정보는 "앱에 아직 없어요"라고 말합니다. 숫자를 지어내지 않습니다.
- 한국어, 짧고 친절하게. 목록은 줄바꿈과 "· " 로. 중요한 이름은 **굵게**. 5~10줄 이내.
- 이야기한 아이템 id 를 mentions 에 넣습니다(앱에서 바로 열기 버튼이 됨). id 는 앱 현황에 있는 것만.
- 이전 대화(history)가 있으면 이어서 답합니다("그거 마진은?" → 앞에서 말한 아이템).

[대상 아이템 고르기 — organize]
- lockId 가 있으면 target.mode="existing", itemId=lockId.
- 없으면 items(이름·판매명·제조사·컨셉·샘플 이름)와 비교해 가장 맞는 것. type "수집"은 수집함 아이템입니다.
- 판단이 어려우면 mode="unsure" 와 reason. itemId 는 items 안의 id 만.

[칸(op) 설명]
- ref_link: 참고 링크(틱톡·유튜브·인스타·1688·알리바바·경쟁사 상품 페이지). url 필수. 링크마다 1개.
- ref_media: 참고용 캡처·사진·영상. media 에 첨부 번호.
- sample: 샘플 카드. sampleType maker=제조사/공장 샘플, rival=경쟁사 제품(시장조사). name=제조사명 또는 경쟁 제품명.
  price·cur(원/$/¥)·moq·where(판매처·구매처·산지)·text(평가 메모)·media(샘플 사진) 를 아는 만큼만.
  판매처 가격(쿠팡·스마트스토어 등 시장가)은 rival 샘플로 넣습니다.
- request: 제조사에 요청할 것("~해달라고", "~바꿔야", "~확인 필요"). name=제조사명, text=요청 한 줄. 요청마다 1개.
- packing: 패킹 자료. whose=rival(경쟁사 패킹, name=경쟁 제품명) 또는 ours(우리 패킹 아이디어). text=메모, media=사진.
- shot: 촬영 컷 아이디어("이런 장면 찍자"). name=컷 제목(짧게), text=연출 메모, media=참고 장면.
- spec: 판매세팅 값. field=specLine(스펙 한 줄 추가), spec(대표 규격), goods(판매 상품명), concept(컨셉 한 줄), target(타겟),
  diff(차별점), cost(단가 숫자, 원), moq(숫자), lead(납기), unitLabel(개·kg·L 등), customs(통관·물류). 값은 text 에.
- cert: 필요한 인증. name=인증 이름, price=비용(원, 모르면 null).
- doc: 시험성적서·MSDS·인증서·견적서 같은 서류 사진/PDF. name 에 종류(시험성적서|MSDS|인증서|추가서류), media 에 첨부 번호.
- memo: 위 어디에도 안 맞는 메모. text 에.

[규칙]
- 첨부가 있으면 모든 첨부 번호를 어떤 op 의 media 에 한 번 이상 넣습니다. 애매하면 ref_media.
- 한 메시지의 여러 정보는 op 를 나눕니다. 같은 정보를 두 번 넣지 않습니다.
- 숫자는 메시지에 적힌 값만. 추측한 가격·MOQ 를 만들지 않습니다. 모르는 칸은 null.
- 1달러=$, 위안=¥, 원=원. "1.2불"=1.2 $.
- why 는 짧은 근거(15자 이내). summary 는 한 줄 요약(30자 이내). 쓰지 않는 필드는 null, media 는 빈 배열.`;

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'AI 키가 아직 등록되지 않았어요 (Cloudflare 환경변수 ANTHROPIC_API_KEY)' }, 500);
  const projectId = env.FIREBASE_PROJECT_ID || 'pour-app-new';
  let who;
  try {
    const auth = request.headers.get('Authorization') || '';
    who = await verifyIdToken(auth.replace(/^Bearer\s+/i, ''), projectId);
  } catch (e) {
    return json({ ok: false, error: e.message || '로그인 확인 실패' }, 401);
  }
  const allow = (env.SOURCING_AI_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(who.email)) return json({ ok: false, error: '이 계정은 AI 정리를 쓸 수 없어요 (' + who.email + ')' }, 403);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: '요청을 읽지 못했어요' }, 400); }
  const text = String(body.text || '').slice(0, MAX_TEXT);
  const atts = Array.isArray(body.atts) ? body.atts.slice(0, MAX_ATTS) : [];
  const links = Array.isArray(body.links) ? body.links.slice(0, 10) : [];
  const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
  const lockId = body.lockId && items.some(x => x && x.id === body.lockId) ? String(body.lockId) : null;
  const statusTxt = body.status ? JSON.stringify(body.status).slice(0, 240000) : '';
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(h => ({ 나: String((h && h.나) || '').slice(0, 400), AI: String((h && h.AI) || '').slice(0, 600) }));
  if (!text.trim() && !atts.length && !links.length) return json({ ok: false, error: '보낼 내용이 없어요' }, 400);

  // 사용자 메시지 구성: 앱 현황(같은 대화에서 재사용 → 캐시) → 첨부(번호 표시) → 링크·아이템 목록 → 이전 대화 → 메모
  const content = [];
  if (statusTxt) content.push({ type: 'text', text: '앱 현황(JSON · 질문에 답할 때 근거):\n' + statusTxt, cache_control: { type: 'ephemeral' } });
  const skipped = [];
  for (const a of atts) {
    const i = Number(a.i);
    const label = `첨부 #${i} (${a.kind === 'video' ? '영상' : a.kind === 'pdf' ? 'PDF' : '사진'}${a.name ? ' · ' + String(a.name).slice(0, 40) : ''})`;
    try {
      if (a.kind === 'image') {
        let img = a.data ? dataUrlParts(a.data) : null;
        if (!img && a.url) { const f = await fetchB64(a.url, MAX_IMG); img = { type: IMG_TYPES.includes(f.type) ? f.type : 'image/jpeg', data: f.data }; }
        if (!img) throw new Error('사진 없음');
        content.push({ type: 'text', text: label });
        content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } });
      } else if (a.kind === 'pdf') {
        const f = await fetchB64(a.url, MAX_PDF);
        content.push({ type: 'text', text: label });
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
      } else if (a.kind === 'video') {
        const frames = (Array.isArray(a.frames) ? a.frames : []).slice(0, 4).map(dataUrlParts).filter(Boolean);
        content.push({ type: 'text', text: label + (frames.length ? ` — 영상에서 뽑은 장면 ${frames.length}장` : ' — 장면을 뽑지 못함(파일 이름만 참고)') });
        frames.forEach(fr => content.push({ type: 'image', source: { type: 'base64', media_type: fr.type, data: fr.data } }));
      } else {
        content.push({ type: 'text', text: label + ' — 파일(내용 미확인)' });
      }
    } catch (e) {
      skipped.push({ i, error: e.message || String(e) });
      content.push({ type: 'text', text: label + ' — 내용을 읽지 못함' });
    }
  }
  const ctx = {
    lockId,
    links: links.map(l => ({ url: String(l.url || '').slice(0, 500), title: String(l.title || '').slice(0, 120), site: String(l.site || '').slice(0, 30) })),
    items: items.map(x => ({
      id: String(x.id || ''), name: String(x.name || '').slice(0, 60), goods: String(x.goods || '').slice(0, 60),
      maker: String(x.maker || '').slice(0, 40), type: String(x.type || '').slice(0, 10), brand: String(x.brand || '').slice(0, 20),
      concept: String(x.concept || '').slice(0, 80),
      samples: (Array.isArray(x.samples) ? x.samples : []).slice(0, 12).map(s => ({ type: s.type === 'rival' ? 'rival' : 'maker', name: String(s.name || '').slice(0, 40) })),
    })),
  };
  content.push({ type: 'text', text: '앱 정보(JSON):\n' + JSON.stringify(ctx) });
  if (history.length) content.push({ type: 'text', text: '이전 대화(오래된 것부터):\n' + JSON.stringify(history) });
  content.push({ type: 'text', text: '담당자 메시지:\n' + (text.trim() || '(메모 없음 — 첨부만 보냄)') });

  let r, j;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        fallbacks: 'default',
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content }],
      }),
    });
    j = await r.json().catch(() => null);
  } catch (e) {
    return json({ ok: false, error: 'AI 서버에 연결하지 못했어요: ' + (e.message || e) }, 502);
  }
  if (!r.ok || !j) {
    const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
    console.error('[sourcing-ai] Anthropic 오류', r.status, msg);
    return json({ ok: false, error: 'AI 정리 실패: ' + msg }, 502);
  }
  if (j.stop_reason === 'refusal') return json({ ok: false, error: 'AI가 이 내용은 정리하지 않았어요. 메모만 남겨 두었어요.' }, 200);
  if (j.stop_reason === 'max_tokens') return json({ ok: false, error: '내용이 너무 길어 정리가 끊겼어요. 나눠서 보내 주세요.' }, 200);
  const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let plan;
  try { plan = JSON.parse(txt); } catch (e) {
    console.error('[sourcing-ai] 응답 해석 실패', txt.slice(0, 300));
    return json({ ok: false, error: 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.' }, 200);
  }
  plan.target = plan.target || { mode: 'none' };
  if (lockId && plan.intent === 'organize') plan.target = Object.assign({}, plan.target, { mode: 'existing', itemId: lockId });
  if (plan.target.mode === 'existing' && !items.some(x => x.id === plan.target.itemId)) plan.target.mode = 'unsure';
  plan.mentions = (plan.mentions || []).filter(id => items.some(x => x.id === id) || statusTxt.includes('"' + id + '"'));
  return json({ ok: true, plan, skipped, model: j.model || MODEL, usage: j.usage || null, by: who.email });
}
