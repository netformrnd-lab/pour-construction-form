/**
 * POUR솔루션 — 솔라피 SMS 프록시 (Cloudflare Worker)
 *
 * 배포 방법:
 *   1. Cloudflare 계정 생성 (무료) → https://dash.cloudflare.com
 *   2. Node.js 설치 후 터미널에서:
 *        npx wrangler init solapi-proxy
 *        (이 파일을 생성된 프로젝트의 src/index.js에 복사)
 *   3. 시크릿 등록:
 *        npx wrangler secret put SOLAPI_API_KEY
 *        npx wrangler secret put SOLAPI_API_SECRET
 *        npx wrangler secret put SOLAPI_SENDER    (발신번호, 예: 01012345678)
 *   4. 배포:
 *        npx wrangler deploy
 *   5. 배포 후 표시되는 URL을 앱 설정에 입력
 *      (예: https://solapi-proxy.your-subdomain.workers.dev)
 *
 * 엔드포인트:
 *   POST /send-sms   { to: "01012345678", text: "메시지 내용" }
 *   → 솔라피 API로 문자 발송
 */

const SOLAPI_URL = 'https://api.solapi.com/messages/v4/send';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** HMAC-SHA256 서명 생성 (Web Crypto API) */
async function generateSignature(apiSecret, date, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const message = date + salt;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') return corsResponse();

    // POST /send-sms 만 허용
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/send-sms') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    // 환경변수 확인
    if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SOLAPI_SENDER) {
      return jsonResponse({ error: 'Server config missing' }, 500);
    }

    // 요청 파싱
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const { to, text } = body;
    if (!to || !text) {
      return jsonResponse({ error: 'to, text 필수' }, 400);
    }

    // 솔라피 HMAC 인증
    const date = new Date().toISOString();
    const salt = crypto.randomUUID();
    const signature = await generateSignature(env.SOLAPI_API_SECRET, date, salt);
    const authorization = `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;

    // 솔라피 API 호출
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
            from: env.SOLAPI_SENDER.replace(/[^0-9]/g, ''),
            text: text,
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
  },
};
