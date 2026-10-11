/**
 * Cloudflare Pages Function — 솔라피 SMS 프록시
 * POST /send-sms  { to: "01012345678", text: "메시지 내용" }
 *
 * 환경변수 (Pages Settings > Variables and Secrets):
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER — 문자 키는 여기에만 (2026-10-11)
 *   OPS_TOKEN (선택) — 서버에서 부를 때(GitHub Actions 사용량 알림 등) 헤더 X-Ops-Token 으로 같은 값
 *
 * 잠금 (2026-10-11 · 사장님 "보안에 신경써줘"):
 *   - 우리 사이트에서 온 요청만 받음(Origin = pour-construction-form.pages.dev · 미리보기 주소) 또는 X-Ops-Token 이 맞을 때
 *     → 다른 웹사이트가 이 주소로 문자를 보내게 하는 일을 막음 (브라우저 밖에서 Origin 을 꾸미는 것까지는 못 막음 — 로그인 붙이기 전 1단계)
 *   - 받는 번호 1개 · 숫자 9~11자리 · 글 2,000자까지
 *   - 키는 환경변수가 먼저. 환경변수가 비었을 때만 예전처럼 요청 본문의 키를 씀
 *     (박람회 앱 index.html 은 Firestore app-config/solapi 의 키를 보냄 — 새 키를 환경변수에 넣고 옛 키를 폐기하면 본문 키는 안 씀)
 */

const SOLAPI_URL = 'https://api.solapi.com/messages/v4/send';
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?pour-construction-form\.pages\.dev$/;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGIN.test(origin) ? origin : 'https://pour-construction-form.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Ops-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function generateSignature(apiSecret, date, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(date + salt));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 같은 길이 비교 (토큰)
function sameToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request.headers.get('Origin')) });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const origin = request.headers.get('Origin') || '';
  const opsOk = sameToken(request.headers.get('X-Ops-Token') || '', env.OPS_TOKEN || '');
  if (!opsOk && !ALLOWED_ORIGIN.test(origin)) {
    console.warn('[send-sms] 막음 — 출처', origin || '(없음)');
    return jsonResponse({ error: '허용되지 않은 요청입니다' }, 403, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const { to, text, apiKey, apiSecret, sender } = body || {};
  const envReady = !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SOLAPI_SENDER);
  // 키: 환경변수 먼저 · 비었을 때만 본문(예전 앱 호환)
  const finalApiKey = envReady ? env.SOLAPI_API_KEY : apiKey;
  const finalApiSecret = envReady ? env.SOLAPI_API_SECRET : apiSecret;
  const finalSender = envReady ? env.SOLAPI_SENDER : sender;

  if (!finalApiKey || !finalApiSecret || !finalSender) {
    return jsonResponse({ error: 'API Key, Secret, 발신번호가 필요합니다' }, 400, origin);
  }

  const toNum = String(to || '').replace(/[^0-9]/g, '');
  if (!/^0\d{8,10}$/.test(toNum) || typeof text !== 'string' || !text.trim()) {
    return jsonResponse({ error: 'to(번호 1개), text 필수' }, 400, origin);
  }
  if (text.length > 2000) {
    return jsonResponse({ error: '글이 너무 깁니다(2,000자까지)' }, 400, origin);
  }

  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  const signature = await generateSignature(finalApiSecret, date, salt);
  const authorization = `HMAC-SHA256 apiKey=${finalApiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  try {
    const res = await fetch(SOLAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        message: {
          to: toNum,
          from: String(finalSender).replace(/[^0-9]/g, ''),
          text,
        },
      }),
    });

    const result = await res.json();

    if (res.ok) {
      return jsonResponse({ success: true, data: result }, 200, origin);
    } else {
      return jsonResponse({ success: false, error: result }, res.status, origin);
    }
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 502, origin);
  }
}
