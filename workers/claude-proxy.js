/**
 * Claude API 프록시 Worker
 * - 클라이언트에서 API 키 노출 방지
 * - WORKER_SECRET으로 요청 인증
 * - Claude Vision (이미지 분석) + Text 지원
 *
 * 환경변수 (wrangler secret):
 *   CLAUDE_API_KEY  — Anthropic API 키
 *   WORKER_SECRET   — 클라이언트 인증용 시크릿
 */

export default {
  async fetch(request, env) {
    // CORS 프리플라이트
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'POST only' }, 405);
    }

    // 시크릿 인증
    const secret = request.headers.get('X-Worker-Secret');
    if (!secret || secret !== env.WORKER_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    try {
      const body = await request.json();
      const { messages, model, max_tokens, system } = body;

      if (!messages || !Array.isArray(messages)) {
        return jsonResponse({ error: 'messages 배열이 필요합니다' }, 400);
      }

      // Claude API 호출
      const claudeBody = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 2048,
        messages,
      };
      if (system) claudeBody.system = system;

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
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
