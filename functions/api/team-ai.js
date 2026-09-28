/**
 * Cloudflare Pages Function — 팀 대시보드 💬 AI 비서 (팀원용 · 원가 없음)
 *
 *   POST /api/team-ai
 *   Authorization: Bearer <Firebase ID 토큰 (pourstoreproject)>
 *   body: { text, status:{…}, history:[{나,AI}] }  →  { ok, plan }   (응답 형식은 관리자용 dashboard-ai.js 와 같음)
 *
 * 보안: 관리자용과 통로를 나눈다.
 *   · 팀원(teamEmails)·허용목록·마스터 누구나 쓸 수 있지만, AI 에게 가는 현황은 서버가 "허락한 칸만" 새로 조립한다.
 *     (칸 이름으로 골라 지우는 방식이 아니라, 목록에 있는 칸만 옮겨 담는 방식 → 새 칸이 생겨도 새어 나가지 않음)
 *   · 허락한 칸: 제품명·규격·브랜드·상태·코드·판매가(정가)·제조사 가칭·재고·출시 다음 할 일 / 매출 합계 / 행사 결과(판매·매출·배수) / 링크 클릭
 *   · 원가·이익·마진·업체단가·제조사 실제 이름은 어떤 경우에도 담지 않는다.
 *
 * 환경변수: ANTHROPIC_API_KEY (같은 키) · DASHBOARD_FIREBASE_PROJECT (선택, 기본 pourstoreproject)
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const MODEL = 'claude-opus-5';
const MAX_TEXT = 4000;
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

/* ── 허용목록 확인: 그 사람 토큰으로 config/access 를 읽는다(규칙상 로그인한 사람은 읽기 가능) ── */
function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  if ('booleanValue' in v) return v.booleanValue;
  return null;
}
async function readAccess(projectId, token) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/access`, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('계정 권한을 확인하지 못했어요 (' + r.status + ')');
  const d = await r.json(); const f = d.fields || {};
  const lc = a => (Array.isArray(a) ? a : []).map(x => String(x || '').toLowerCase());
  return {
    masters: [String(fsVal(f.masterEmail) || '').toLowerCase(), ...lc(fsVal(f.masterEmails))].filter(Boolean),
    subs: lc(fsVal(f.subMasterEmails)),
    allowed: lc(fsVal(f.allowedEmails)),
    team: lc(fsVal(f.teamEmails)),
  };
}
/* ── 허락한 칸만 옮겨 담기 ── */
const S = (v, n = 120) => (v == null ? '' : String(v).slice(0, n));
const Nn = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
function safeStatus(st) {
  st = st && typeof st === 'object' ? st : {};
  const out = {
    today: S(st.today, 10),
    brands: arr(st.brands, 5).map(b => S(b, 20)),
    places: {},
    salesChannels: arr(st.salesChannels, 60).map(c => S(c, 40)),
    products: arr(st.products, 600).map(p => ({
      key: S(p && p.key, 200), name: S(p && p.name, 80), spec: S(p && p.spec, 40),
      brand: arr(p && p.brand, 3).map(b => S(b, 20)), group: S(p && p.group, 10), code: S(p && p.code, 20),
      retail: Nn(p && p.retail), makerAlias: S(p && p.makerAlias, 12), stock: Nn(p && p.stock), next: S(p && p.next, 60),
    })),
    sales: null,
    promos: arr(st.promos, 100).map(p => ({
      id: S(p && p.id, 40), name: S(p && p.name, 60), status: S(p && p.status, 6), start: S(p && p.start, 10), end: S(p && p.end, 10),
      reason: S(p && p.reason, 10), mech: S(p && p.mech, 40), products: arr(p && p.products, 10).map(x => S(x, 80)), channels: arr(p && p.channels, 10).map(x => S(x, 40)),
      result: p && p.result ? { qty: Nn(p.result.qty), amt: Nn(p.result.amt), mult: Nn(p.result.mult), incAmt: Nn(p.result.incAmt), spend: Nn(p.result.spend) } : null,
    })),
    links: arr(st.links, 250).map(l => ({
      id: S(l && l.id, 20), label: S(l && l.label, 60), purpose: S(l && l.purpose, 12), place: S(l && l.place, 40), dest: S(l && l.dest, 12),
      brand: S(l && l.brand, 12), clicks: Nn(l && l.clicks), clicks7: Nn(l && l.clicks7), created: S(l && l.created, 10), promo: S(l && l.promo, 60),
      orders: Nn(l && l.orders), revenue: Nn(l && l.revenue), spend: Nn(l && l.spend),
    })),
  };
  if (st.places && typeof st.places === 'object') for (const [k, v] of Object.entries(st.places).slice(0, 10)) out.places[S(k, 20)] = Array.isArray(v) ? v.slice(0, 12).map(x => S(x, 30)) : null;
  if (st.sales && typeof st.sales === 'object') {
    const byDay = {};
    for (const [d, m] of Object.entries(st.sales.byDay || {}).slice(0, 40)) {
      const o = {}; for (const [k, v] of Object.entries(m || {}).slice(0, 60)) o[S(k, 60)] = { amt: Nn(v && v.amt), qty: Nn(v && v.qty) };
      byDay[S(d, 10)] = o;
    }
    out.sales = { note: S(st.sales.note, 80), byDay, top30: arr(st.sales.top30, 40).map(t => ({ name: S(t && t.name, 80), amt: Nn(t && t.amt), qty: Nn(t && t.qty), brand: S(t && t.brand, 20) })) };
  }
  return out;
}

/* ── 응답 형식 ── */
const N = t => ({ anyOf: [{ type: t }, { type: 'null' }] });
const PURPOSES = ['광고', '포스팅', '셀러·인플루언서', '공동구매', 'CS·고객문자', '기타'];
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['intent', 'reply', 'links', 'promos', 'messages'],
  properties: {
    intent: { type: 'string', enum: ['answer', 'draft'] },
    reply: { type: 'string' },
    links: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['purpose', 'place', 'partner', 'url', 'promoId', 'product', 'label'],
        properties: {
          purpose: { type: 'string', enum: PURPOSES },
          place: N('string'), partner: N('string'), url: N('string'), promoId: N('string'), product: N('string'), label: N('string'),
        },
      },
    },
    promos: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'reason', 'startDate', 'endDate', 'productKeys', 'channels', 'mech', 'memo'],
        properties: {
          name: { type: 'string' },
          reason: { anyOf: [{ type: 'string', enum: ['재고소진', '신제품', '시즌', '재구매', '기타'] }, { type: 'null' }] },
          startDate: N('string'), endDate: N('string'),
          productKeys: { type: 'array', items: { type: 'string' } },
          channels: { type: 'array', items: { type: 'string' } },
          mech: {
            type: 'object', additionalProperties: false,
            required: ['t', 'v', 'n', 'm', 'min', 'gift', 'txt'],
            properties: {
              t: { type: 'string', enum: ['disc', 'nm', 'second', 'coupon', 'gift', 'point', 'etc'] },
              v: N('number'), n: N('number'), m: N('number'), min: N('number'), gift: N('string'), txt: N('string'),
            },
          },
          memo: N('string'),
        },
      },
    },
    messages: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'text', 'linkIdx'],
        properties: { title: { type: 'string' }, text: { type: 'string' }, linkIdx: N('integer') },
      },
    },
  },
};

const SYSTEM = `당신은 넷폼의 커머스 브랜드 POUR스토어(건축 유지보수 자재)·GROHOME(셀프 인테리어)의 "팀 대시보드" AI 비서입니다.
팀원은 주로 폰으로 짧게 묻습니다. 한국어로, 짧고 친절하게 답합니다.
이 대화에는 원가·이익·마진·업체단가·제조사 실제 이름이 들어 있지 않습니다. 그런 것을 물으면 "관리자에게 확인해 주세요"라고 답하고 추측하지 않습니다.

[intent]
- answer: 현황 질문("어제 매출?", "이번 달 잘 된 링크", "단종예정 재고", "코트재 정가 얼마?"). reply 에 답, 초안 배열은 모두 빈 배열.
- draft: 무언가를 만들어 달라는 요청(링크, 행사/프로모션, 고객 문자·안내 문구). 초안을 채우고 reply 에 한두 줄 설명.
질문과 요청이 섞이면 draft 로 하고 reply 에 답도 씁니다.

[답하는 법]
- "현황(JSON)"만 근거로 답합니다. 없는 정보는 "대시보드에 아직 없어요". 숫자를 지어내지 않습니다.
- 금액은 1,234,000원처럼 쉼표. 목록은 줄바꿈과 "· ". 중요한 이름은 **굵게**. 10줄 이내.
- 제조사는 가칭(makerAlias, 예: A사)으로만 말합니다.
- 이전 대화(history)가 있으면 이어서 답합니다.

[링크 초안 links]
- purpose: 광고 · 포스팅 · 셀러·인플루언서 · 공동구매 · CS·고객문자 · 기타.
- place: 광고·포스팅·CS·고객문자는 places 목록 이름 그대로. 그 밖엔 null. partner: 셀러·인플루언서·공동구매는 이름, 기타는 쓰임새, 나머지 null.
- url: 메시지에 적힌 주소만(없으면 null, 지어내지 않음). promoId: 현황 promos 의 id 또는 null. product: 현황 products 의 name 또는 null. label: 짧은 제목(선택).
[행사 초안 promos]
- 이름 짧게. reason: 재고소진·신제품·시즌·재구매·기타. 날짜 YYYY-MM-DD(today 기준, 모르면 null).
- productKeys 는 현황 products 의 key 만. channels 는 salesChannels 에 있는 이름만(없으면 빈 배열).
- mech.t: disc(v%) · nm(n+m) · second(두 번째 v%) · coupon(v원, min개 이상) · gift(gift) · point(v%) · etc(txt). 안 쓰는 칸 null.
- 이익·역마진은 이 대화에서 판단할 수 없습니다. memo 에 "저장 전에 관리자가 역마진을 확인해 주세요"라고 적습니다.
[문구 초안 messages]
- 브랜드 톤: POUR스토어=친절·실용, GROHOME=가볍고 친근. 과장·보증 약속·확정 견적 금지. 고객 개인정보를 넣지 않습니다.
- 링크 자리는 {링크}, linkIdx 에 links 번호(0부터). 없으면 null. 문자는 90자 안팎.`;

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'AI 키가 아직 등록되지 않았어요 — Cloudflare › Workers & Pages › pour-construction-form › 설정(Settings) › 변수 및 비밀(Variables and Secrets)에 ANTHROPIC_API_KEY(비밀)를 넣고 [배포 다시 하기]를 눌러 주세요 (관리자 1회)' }, 500);
  const projectId = env.DASHBOARD_FIREBASE_PROJECT || 'pourstoreproject';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  let who, acc;
  try { who = await verifyIdToken(token, projectId); } catch (e) { return json({ ok: false, error: e.message || '로그인 확인 실패' }, 401); }
  try { acc = await readAccess(projectId, token); } catch (e) { return json({ ok: false, error: e.message }, 403); }
  const e = who.email;
  if (![...acc.masters, ...acc.subs, ...acc.allowed, ...acc.team].includes(e)) return json({ ok: false, error: '이 계정은 팀원·허용목록에 없어요 (' + e + ')' }, 403);
  let body;
  try { body = await request.json(); } catch (err) { return json({ ok: false, error: '요청을 읽지 못했어요' }, 400); }
  const text = String(body.text || '').slice(0, MAX_TEXT).trim();
  if (!text) return json({ ok: false, error: '보낼 내용이 없어요' }, 400);
  const status = safeStatus(body.status);
  const statusTxt = JSON.stringify(status);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(h => ({ 나: String((h && h.나) || '').slice(0, 400), AI: String((h && h.AI) || '').slice(0, 800) }));
  const content = [{ type: 'text', text: '현황(JSON · 답과 초안의 근거 · 원가 없음):\n' + statusTxt, cache_control: { type: 'ephemeral' } }];
  if (history.length) content.push({ type: 'text', text: '이전 대화(오래된 것부터):\n' + JSON.stringify(history) });
  content.push({ type: 'text', text: '팀원 메시지:\n' + text });
  let r, j;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, fallbacks: 'default', system: SYSTEM, output_config: { format: { type: 'json_schema', schema: SCHEMA } }, messages: [{ role: 'user', content }] }),
    });
    j = await r.json().catch(() => null);
  } catch (err) { return json({ ok: false, error: 'AI 서버에 연결하지 못했어요: ' + (err.message || err) }, 502); }
  if (!r.ok || !j) { const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status); console.error('[team-ai] Anthropic 오류', r.status, msg); return json({ ok: false, error: 'AI 응답 실패: ' + msg }, 502); }
  if (j.stop_reason === 'refusal') return json({ ok: false, error: 'AI가 이 요청에는 답하지 않았어요. 다르게 물어봐 주세요.' }, 200);
  if (j.stop_reason === 'max_tokens') return json({ ok: false, error: '답이 너무 길어 끊겼어요. 나눠서 물어봐 주세요.' }, 200);
  const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let plan;
  try { plan = JSON.parse(txt); } catch (err) { console.error('[team-ai] 응답 해석 실패', txt.slice(0, 300)); return json({ ok: false, error: 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.' }, 200); }
  const keys = new Set(status.products.map(p => p.key)), promoIds = new Set(status.promos.map(p => p.id));
  plan.links = (plan.links || []).map(l => ({ ...l, url: /^https?:\/\//.test(l.url || '') && text.includes(l.url) ? l.url : null, promoId: promoIds.has(l.promoId) ? l.promoId : null }));
  plan.promos = (plan.promos || []).map(p => ({ ...p, productKeys: (p.productKeys || []).filter(k => keys.has(k)) }));
  plan.messages = (plan.messages || []).map(m => ({ ...m, linkIdx: Number.isInteger(m.linkIdx) && m.linkIdx >= 0 && m.linkIdx < plan.links.length ? m.linkIdx : null }));
  return json({ ok: true, plan, model: j.model || MODEL, usage: j.usage || null, role: { cost: false }, by: e });
}
