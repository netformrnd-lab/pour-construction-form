/**
 * Cloudflare Pages Function — 마진 대시보드 💬 AI 비서
 *
 *   POST /api/dashboard-ai
 *   Authorization: Bearer <Firebase ID 토큰 (pourstoreproject — 마진 대시보드 로그인)>
 *   body: { text, status:{…대시보드 현황 요약…}, history:[{나,AI}] }
 *   → { ok, plan, usage, model, role }
 *     plan.intent  = answer(질문에 답) | draft(링크·행사·문구 초안)
 *     plan.reply   = 답변 글
 *     plan.links / plan.promos / plan.messages = 초안 (대시보드에서 사람이 [만들기]를 눌러야 저장)
 *
 * 권한: 관리자 전용 — 로그인 확인 → config/access 를 그 사람 토큰으로 읽어 마스터·부마스터인지 확인.
 *   그 밖의 계정(팀원)은 거절한다. 팀원용 AI 는 팀 대시보드에서 따로(원가 없는 칸만 허락해서) 쓴다.
 *
 * 환경변수 (Cloudflare Pages > Settings > Variables and Secrets)
 *   ANTHROPIC_API_KEY        필수 (소싱앱 AI와 같은 키)
 *   DASHBOARD_FIREBASE_PROJECT  선택 — 기본 pourstoreproject
 *
 * 빌드 도구·npm 없이 배포하는 프로젝트라(sourcing-ai.js 와 같은 방식) Anthropic 호출은 fetch 로 한다.
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
  };
}
/* ── 응답 형식 ── */
const N = t => ({ anyOf: [{ type: t }, { type: 'null' }] });   // null 허용 칸은 16개까지(API 한도) — 글자 칸 label·memo·gift·txt 는 빈 글자로 받고 서버에서 null 로 바꾼다
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
          place: N('string'), partner: N('string'), url: N('string'), promoId: N('string'), product: N('string'), label: { type: 'string' },
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
              v: N('number'), n: N('number'), m: N('number'), min: N('number'), gift: { type: 'string' }, txt: { type: 'string' },
            },
          },
          memo: { type: 'string' },
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

/* BANNED_RULE_START — 사용금지어 (사장님 2026-10-19 · 원본 marketing-hub/banned.js bannedRule · node marketing-hub/tools/banned-sync.mjs 가 다시 씀 · 손으로 고치지 않음) */
const BANNED_RULE = "■ 사용금지어 — POUR스토어·그로홈 (사장님 '금지·주의 단어 작성 가이드' 2026-10-19 · 상세페이지·글·광고·메시지·답변·제목·해시태그 모두)\n- 근거(시험성적서·인증서) 없이 아래 말을 쓰지 않는다 → 화살표 뒤 말로 바꿔 쓴다. 근거가 있으면 근거(번호·기관·연도)를 같은 문장에 같이 쓸 때만 쓴다 · 근거를 지어내지 않는다\n- 단정·최상급: 100% → 높은 수준의, 대부분의 / 독보적 → 차별화된, 독자 개발한 / 무결점 → 결함을 줄인, 품질 관리를 거친 / 압도적 → 우수한, 뛰어난 / 영구·반영구 → 오래 유지되도록 설계된, 장기간 성능을 유지하는 / 완벽 → 우수한, 꼼꼼하게 마감되는 / 완전(차단·방수) → 효과적으로 차단하는, 방수 성능이 우수한 / 유일 → 차별화된, 독자적인 / 절대(~하지 않는) → ~을 줄여 주는, ~에 강한 / 최고 → 우수한, 높은 수준의 / 최초 → 새롭게 개발한, 독자 개발한 / 평생 → 오랫동안, 장기간\n- 성분·성능: 무수축 → 수축을 줄인, 수축이 적은 / 무알칼리 → 알칼리 성분을 줄인 / 무용제 → 용제 사용을 줄인\n- 항균·곰팡이: 항균·살균·세균·바이러스·99.9% → 위생적인 관리에 유리한, 청결 유지에 도움을 주는 / 소독 → 청결 유지에 도움을 주는 / 곰팡이 방지·억제·차단·제거 → 곰팡이가 생기기 쉬운 환경을 줄여 주는, 습기 관리에 유리한 / 탈취 → 냄새 관리에 도움을 주는\n- 환경·인체 안전: 유해물질·VOCs ○% 저감 → VOCs 저감을 고려해 설계된 / 저 VOC → VOCs 함량 ○ g/L (기준 ○ g/L 이하) / ZERO·제로·○○-free → 휘발성유기화합물(VOCs) 기준 적합 / ○○ 무함유·없음·미사용 → 기준치 이하 검출 시 카드뮴 기준 적합 / 유해물질 없음·중금속·포름알데히드 → ○○ 기준 적합 / 불검출 → 기준치 이하 검출 시 ○○ 기준 적합 / 무첨가 → ○○(물질명) 무첨가(원료 배합 기준) / VOC → 휘발성유기화합물(VOCs) 기준 적합(시험성적서 ○○호) / 친환경·에코 → VOCs 저감을 고려해 설계된 / 무독성·무해·인체에 안전 → VOCs 저감을 고려해 설계된 / 안전한 → 사용 환경을 고려한 / 무공해·저공해·오염 없는 → ○○(이유)로 수질오염 저감에 기여 / 무취·냄새 없는 → 냄새가 적은, 냄새 부담을 줄인 / 천연 → ○○ 원료 ○% 사용 / 저탄소·탄소중립·넷제로 → 쓰지 않음 / 생분해·자연분해 → 쓰지 않음 / 오존 친화·오존층 → ○○(물질명) 미사용\n- 인증·성능: 공인(시험)기관 인증 → 공인기관 시험분석 결과 ○○ 기준 적합(시험성적서 ○○호) / 환경표지·품질인증·KC·ISO 등 → (인증 취득 시 기재) 또는 빼기 / 신기술 → 새롭게 개발한 공법 / 실용신안·디자인등록·상표등록 → 빼기 / 출원 → 특허 출원 중(출원번호 ○○) / 수상 → ○○상 수상(주최 ○○, 2026) / 선정 → ○○ 우수제품 선정(조달청, 2026) / 불연·준불연 → (시험성적서 보유 시 기재) 또는 빼기 / 내화 → (시험성적서 보유 시 기재) 또는 빼기 / 에너지 절감·냉난방비 절약 → 에너지 효율을 고려한 / 인증 → (인증 취득 시 기재) 또는 빼기\n- 숫자·성능은 확인한 시험성적서 값만 (예: KTR 공인시험 결과) · 시험성적서는 인증이 아니다 · 건설신기술은 \"제1026호\"처럼 번호와 함께";
/* BANNED_RULE_END */

const SYSTEM = `당신은 넷폼의 커머스 브랜드 POUR스토어(건축 유지보수 자재)·GROHOME(셀프 인테리어)의 "마진 대시보드" AI 비서입니다.
팀원은 주로 폰으로 짧게 묻습니다. 한국어로, 짧고 친절하게 답합니다.

[intent]
- answer: 현황 질문("어제 매출?", "이번 달 잘 된 링크", "출시준비 뭐 남았어?", "단종예정 재고"). reply 에 답, 초안 배열은 모두 빈 배열.
- draft: 무언가를 만들어 달라는 요청(링크, 행사/프로모션, 고객 문자·안내 문구). 초안을 채우고 reply 에 한두 줄 설명.
질문과 요청이 섞이면 draft 로 하고 reply 에 답도 씁니다.

[답하는 법]
- "대시보드 현황(JSON)"만 근거로 답합니다. 없는 정보는 "대시보드에 아직 없어요"라고 말합니다. 숫자를 지어내지 않습니다.
- 금액은 1,234,000원처럼 쉼표. 목록은 줄바꿈과 "· ". 중요한 이름은 **굵게**. 10줄 이내.
- 관리자(마스터·부마스터) 전용입니다. 원가·이익·마진·제조사 실제 이름까지 현황에 있으면 써도 됩니다.
- 이전 대화(history)가 있으면 이어서 답합니다.

[링크 초안 links]
- 용도 purpose: 광고 · 포스팅 · 셀러·인플루언서 · 공동구매 · CS·고객문자 · 기타 중 하나.
- place: 광고·포스팅·CS·고객문자는 places 목록의 이름 그대로(예: "네이버 블로그", "인스타그램", "메타 광고", "문자(SMS)"). 셀러·인플루언서·공동구매·기타는 null.
- partner: 셀러·인플루언서·공동구매는 사람/채널 이름(메시지에 있는 그대로), 기타는 쓰임새. 나머지는 null.
- url: 메시지에 적힌 주소만(http로 시작). 없으면 null — 대시보드가 붙여넣기를 받습니다. 주소를 지어내지 않습니다.
- promoId: 연결할 행사가 현황 promos 에 있으면 그 id, 아니면 null. product: 현황 products 의 name 그대로, 없으면 null.
- label: 짧은 제목(선택, 없으면 빈 글자 ""). 여러 곳에 올린다고 하면 곳마다 링크 1개.
[행사 초안 promos]
- 이름 짧게. reason 은 재고소진·신제품·시즌·재구매·기타. 날짜는 YYYY-MM-DD(오늘 today 기준, 모르면 null).
- productKeys 는 현황 products 의 key 만. channels 는 현황 salesChannels 에 있는 이름만(없으면 빈 배열 = 전체).
- mech.t: disc(할인율 v%) · nm(n+m 증정) · second(두 번째 v% 할인) · coupon(v원 쿠폰, min개 이상) · gift(사은품 gift) · point(v% 적립) · etc(txt).
  쓰지 않는 칸은 null(글자 칸 gift·txt·memo 는 빈 글자 ""). role.cost=true 이고 products 에 cost·retail 이 있으면 역마진이 나지 않는 구성을 고르고 memo 에 이유를 적습니다.
[문구 초안 messages]
- 고객 문자·안내·게시글 문구. 브랜드 톤: POUR스토어=친절·실용, GROHOME=가볍고 친근. 과장·보증 약속·확정 견적 금지.
- 링크가 들어갈 자리는 {링크} 로 쓰고 linkIdx 에 links 배열 번호(0부터). 링크가 없으면 null.
- 문자는 90자 안팎(짧게), 알림톡·게시글은 조금 길어도 됩니다.
[사용금지어 — 문구·행사 이름·답에 모두]
${BANNED_RULE}`;

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'AI 키가 아직 등록되지 않았어요 — Cloudflare › Workers & Pages › pour-construction-form › 설정(Settings) › 변수 및 비밀(Variables and Secrets)에 ANTHROPIC_API_KEY(비밀)를 넣고 [배포 다시 하기]를 눌러 주세요 (관리자 1회)' }, 500);
  const projectId = env.DASHBOARD_FIREBASE_PROJECT || 'pourstoreproject';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  let who, acc;
  try { who = await verifyIdToken(token, projectId); } catch (e) { return json({ ok: false, error: e.message || '로그인 확인 실패' }, 401); }
  try { acc = await readAccess(projectId, token); } catch (e) { return json({ ok: false, error: e.message }, 403); }
  const isMaster = acc.masters.includes(who.email), isSub = acc.subs.includes(who.email);
  if (!isMaster && !isSub) return json({ ok: false, error: '관리자(마스터·부마스터) 전용 AI예요 (' + who.email + ')' }, 403);
  const cost = true;
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: '요청을 읽지 못했어요' }, 400); }
  const text = String(body.text || '').slice(0, MAX_TEXT).trim();
  if (!text) return json({ ok: false, error: '보낼 내용이 없어요' }, 400);
  const status = body.status && typeof body.status === 'object' ? body.status : {};
  status.role = { cost, email: who.email };
  const statusTxt = JSON.stringify(status).slice(0, 300000);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(h => ({ 나: String((h && h.나) || '').slice(0, 400), AI: String((h && h.AI) || '').slice(0, 800) }));
  const content = [{ type: 'text', text: '대시보드 현황(JSON · 답과 초안의 근거):\n' + statusTxt, cache_control: { type: 'ephemeral' } }];
  if (history.length) content.push({ type: 'text', text: '이전 대화(오래된 것부터):\n' + JSON.stringify(history) });
  content.push({ type: 'text', text: '팀원 메시지:\n' + text });
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
    console.error('[dashboard-ai] Anthropic 오류', r.status, msg);
    return json({ ok: false, error: 'AI 응답 실패: ' + msg }, 502);
  }
  if (j.stop_reason === 'refusal') return json({ ok: false, error: 'AI가 이 요청에는 답하지 않았어요. 다르게 물어봐 주세요.' }, 200);
  if (j.stop_reason === 'max_tokens') return json({ ok: false, error: '답이 너무 길어 끊겼어요. 나눠서 물어봐 주세요.' }, 200);
  const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let plan;
  try { plan = JSON.parse(txt); } catch (e) {
    console.error('[dashboard-ai] 응답 해석 실패', txt.slice(0, 300));
    return json({ ok: false, error: 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.' }, 200);
  }
  // 현황에 없는 값은 지운다(지어낸 id·주소 방지)
  const keys = new Set((status.products || []).map(p => p && p.key)), promoIds = new Set((status.promos || []).map(p => p && p.id));
  plan.links = (plan.links || []).map(l => ({ ...l, url: /^https?:\/\//.test(l.url || '') && text.includes(l.url) ? l.url : null, promoId: promoIds.has(l.promoId) ? l.promoId : null }));
  plan.promos = (plan.promos || []).map(p => ({ ...p, productKeys: (p.productKeys || []).filter(k => keys.has(k)) }));
  // 빈 글자로 받은 칸 → null (화면 코드는 null 기준)
  const e2n = v => (typeof v === 'string' && !v.trim()) ? null : v;
  plan.links = plan.links.map(l => ({ ...l, label: e2n(l.label) }));
  plan.promos = plan.promos.map(p => ({ ...p, memo: e2n(p.memo), mech: p.mech ? { ...p.mech, gift: e2n(p.mech.gift), txt: e2n(p.mech.txt) } : p.mech }));
  plan.messages = (plan.messages || []).map(m => ({ ...m, linkIdx: Number.isInteger(m.linkIdx) && m.linkIdx >= 0 && m.linkIdx < plan.links.length ? m.linkIdx : null }));
  return json({ ok: true, plan, model: j.model || MODEL, usage: j.usage || null, role: { cost }, by: who.email });
}
