/**
 * Claude API 프록시 Worker
 * - 클라이언트에서 API 키 노출 방지
 * - WORKER_SECRET으로 요청 인증
 * - Claude Vision (이미지 분석) + Text + PDF document 지원
 *
 * 엔드포인트:
 *   POST /            — Claude API 메시지 호출 (기존)
 *   POST /fetch-url   — 외부 URL 본문을 텍스트로 추출 (CORS 우회)
 *
 * 환경변수 (wrangler secret):
 *   CLAUDE_API_KEY  — Anthropic API 키
 *   WORKER_SECRET   — 클라이언트 인증용 시크릿
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'POST only' }, 405);
    }

    // 시크릿 인증 — 헤더 또는 바디(workerSecret)로 모두 허용
    let body = {};
    try { body = await request.json(); } catch {}
    const secret = request.headers.get('X-Worker-Secret') || body.workerSecret;
    if (!secret || secret !== env.WORKER_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

    if (path === '/fetch-url') {
      return handleFetchUrl(body);
    }

    // 기본: Claude API 메시지 릴레이
    return handleClaudeMessage(body, env);
  },
};

async function handleClaudeMessage(body, env) {
  const { messages, model, max_tokens, system } = body;
  if (!messages || !Array.isArray(messages)) {
    return jsonResponse({ error: 'messages 배열이 필요합니다' }, 400);
  }
  const claudeBody = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 2048,
    messages,
  };
  if (system) claudeBody.system = system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeBody),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('[claude-proxy] API error:', JSON.stringify(result));
      return jsonResponse({ error: result.error?.message || 'Claude API 오류', detail: result }, response.status);
    }
    return jsonResponse(result);
  } catch (e) {
    console.error('[claude-proxy] Error:', e.message);
    return jsonResponse({ error: e.message }, 500);
  }
}

async function handleFetchUrl(body) {
  const { url } = body;
  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'url 필수' }, 400);
  }
  let parsed;
  try { parsed = new URL(url); } catch {
    return jsonResponse({ error: '유효하지 않은 URL' }, 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return jsonResponse({ error: 'http(s)://만 허용' }, 400);
  }
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PourBuilder/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.8',
      },
      redirect: 'follow',
      cf: { cacheTtl: 60 },
    });
    if (!r.ok) {
      return jsonResponse({ error: `HTTP ${r.status} ${r.statusText}` }, 502);
    }
    const ct = r.headers.get('content-type') || '';
    if (!/(text\/html|application\/xhtml|text\/plain)/.test(ct)) {
      return jsonResponse({ error: '텍스트 페이지가 아닙니다 (' + ct + ')' }, 415);
    }
    const html = await r.text();
    if (html.length > 8 * 1024 * 1024) {
      return jsonResponse({ error: '페이지가 너무 큽니다 (8MB 초과)' }, 413);
    }
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const text = htmlToText(html).slice(0, 80000);
    return jsonResponse({
      text,
      title: titleMatch ? decodeEntities(titleMatch[1]).trim() : '',
      url: parsed.toString(),
      length: text.length,
    });
  } catch (e) {
    console.error('[fetch-url] Error:', e.message);
    return jsonResponse({ error: e.message }, 502);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .split('\n').map(line => decodeEntities(line).replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
