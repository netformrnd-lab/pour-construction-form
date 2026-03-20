/**
 * Cloudflare Pages Function — 솔라피 SMS 프록시
 * POST /send-sms  { to: "01012345678", text: "메시지 내용" }
 *
 * 환경변수 (Pages Settings > Variables and Secrets):
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
 */

const SOLAPI_URL = 'https://api.solapi.com/messages/v4/send';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { env } = context;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { to, text, apiKey, apiSecret, sender } = body;

  // 요청 본문의 credentials 우선, 없으면 환경변수 fallback
  const finalApiKey = apiKey || env.SOLAPI_API_KEY;
  const finalApiSecret = apiSecret || env.SOLAPI_API_SECRET;
  const finalSender = sender || env.SOLAPI_SENDER;

  if (!finalApiKey || !finalApiSecret || !finalSender) {
    return jsonResponse({ error: 'API Key, Secret, 발신번호가 필요합니다' }, 400);
  }

  if (!to || !text) {
    return jsonResponse({ error: 'to, text 필수' }, 400);
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
          to: to.replace(/[^0-9]/g, ''),
          from: finalSender.replace(/[^0-9]/g, ''),
          text,
        },
      }),
    });

    const result = await res.json();

    if (res.ok) {
      return jsonResponse({ success: true, data: result });
    } else {
      return jsonResponse({ success: false, error: result }, res.status);
    }
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 502);
  }
}
