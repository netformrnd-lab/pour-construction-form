/**
 * POUR 사진진단 공개 프록시 Worker — pour-diagnose-proxy
 *
 * 카페24 자사몰에 임베드된 소비자 챗봇(chat-widget.html)이 "고객 사진"을
 * 안전하게 Claude 비전으로 하자유형 판별하도록 중계한다.
 *
 * 공개(Origin 화이트리스트) 워커라는 점이 claude-proxy와의 차이:
 *   - Anthropic 키는 서버(Cloudflare secret)에만 보관 → 클라이언트에 절대 노출 안 됨
 *   - WORKER_SECRET을 요구하지 않음(공개 위젯이라 시크릿을 심을 수 없음)
 *   - 대신 ALLOWED_ORIGINS로 허용 도메인만 응답 → 무단 도용 차단
 *
 * 엔드포인트:
 *   POST /diagnose
 *     body: {
 *       image: "data:image/jpeg;base64,..."  (또는 순수 base64),
 *       checklist: { buildingType, location, symptom },
 *       templates: [ { tags:[...], desc:"..." }, ... ]   // 어드민이 정리한 분류 후보
 *     }
 *     res:  { defectType, confidence(0~100), cause, solution }
 *
 * 환경변수 (wrangler secret / vars):
 *   CLAUDE_API_KEY   — Anthropic API 키 (필수, secret)
 *   ALLOWED_ORIGINS  — 콤마구분 허용 오리진 (예: "https://pour-construction-form.pages.dev,https://poursto.cafe24.com")
 *                      비워두면 모든 오리진 허용(개발용) — 운영에선 반드시 설정
 *   CLAUDE_MODEL     — (선택) 기본 "claude-haiku-4-5-20251001" (비전·저비용)
 *
 * 배포:
 *   npx wrangler deploy --config workers/wrangler.diagnose.toml
 *   npx wrangler secret put CLAUDE_API_KEY --config workers/wrangler.diagnose.toml
 */

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // base64 디코딩 전 대략치

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}
function resolveOrigin(request, env) {
  const origin = (request.headers.get('Origin') || '').replace(/\/+$/, '');
  const list = allowedOrigins(env);
  if (list.length === 0) return { allow: origin || '*', ok: true }; // 개발용: 전체 허용
  if (origin && list.includes(origin)) return { allow: origin, ok: true };
  return { allow: list[0], ok: false };
}
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

export default {
  async fetch(request, env) {
    const { allow, ok } = resolveOrigin(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(allow) });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, allow);
    if (!ok) return json({ error: 'Origin not allowed' }, 403, allow);
    if (!env.CLAUDE_API_KEY) return json({ error: 'CLAUDE_API_KEY not configured' }, 500, allow);

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (path !== '/diagnose' && path !== '/') return json({ error: 'Not found', hint: 'POST /diagnose' }, 404, allow);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, allow); }

    const parsed = parseImage(body.image);
    if (!parsed) return json({ error: 'image(base64 또는 data URL)가 필요합니다' }, 400, allow);
    if (parsed.data.length > MAX_IMAGE_BYTES * 1.4) return json({ error: '이미지가 너무 큽니다' }, 413, allow);

    const templates = Array.isArray(body.templates) ? body.templates : [];
    const checklist = body.checklist || {};
    const tagLines = templates.slice(0, 24).map((t, i) => {
      const tags = (Array.isArray(t.tags) ? t.tags : []).map(x => '#' + x).join(' ');
      return `${i + 1}) ${tags}${t.desc ? ' — ' + t.desc : ''}`;
    }).join('\n');
    const allTags = [...new Set(templates.flatMap(t => (Array.isArray(t.tags) ? t.tags : [])))];

    const system = [
      '당신은 건축물 하자 사진을 분류하는 POUR스토어 전문가입니다.',
      '주어진 사진과 아래 후보 하자유형(해시태그) 중에서 가장 적합한 유형 하나를 고르세요.',
      '반드시 제공된 태그 중에서만 defectType을 선택하고, 견적·금액은 절대 말하지 마세요.',
      '오직 아래 JSON 형식으로만 답하세요(설명·마크다운 금지):',
      '{"defectType":"<후보 태그 중 하나>","confidence":<0~100 정수>,"cause":"<원인 1~2문장, 고객 눈높이 한국어>","solution":"<해결 방향 1~2문장, POUR 공법 관점>"}',
    ].join('\n');
    const userText = [
      '[고객 체크리스트]',
      `건물유형: ${checklist.buildingType || '-'}`,
      `하자위치: ${checklist.location || '-'}`,
      `증상: ${checklist.symptom || '-'}`,
      '',
      '[후보 하자유형]',
      tagLines || '(후보 없음 — 사진으로 판단)',
      '',
      allTags.length ? `defectType은 반드시 다음 중 하나: ${allTags.join(', ')}` : '',
    ].join('\n');

    const claudeBody = {
      model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } },
          { type: 'text', text: userText },
        ],
      }],
    };

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(claudeBody),
      });
      const result = await r.json();
      if (!r.ok) {
        console.error('[diagnose] Claude error:', JSON.stringify(result).slice(0, 300));
        return json({ error: result.error?.message || 'Claude API 오류' }, r.status, allow);
      }
      const text = (result.content || []).map(c => c.text || '').join('\n');
      const out = extractJson(text);
      if (!out || !out.defectType) return json({ error: '분류 결과 파싱 실패', raw: text.slice(0, 300) }, 502, allow);
      // 화이트리스트 밖 태그 방지: 후보에 없으면 가장 가까운 후보로 보정하지 않고 그대로 두되 신뢰도만 낮춤
      let confidence = Number(out.confidence);
      if (!Number.isFinite(confidence)) confidence = 0;
      confidence = Math.max(0, Math.min(100, Math.round(confidence)));
      if (allTags.length && !allTags.includes(out.defectType)) confidence = Math.min(confidence, 40);
      return json({
        defectType: String(out.defectType).replace(/^#/, ''),
        confidence,
        cause: String(out.cause || '').trim(),
        solution: String(out.solution || '').trim(),
      }, 200, allow);
    } catch (e) {
      console.error('[diagnose] fetch failed:', e.message);
      return json({ error: e.message }, 500, allow);
    }
  },
};

function parseImage(image) {
  if (!image || typeof image !== 'string') return null;
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (m) return { mediaType: m[1], data: m[2] };
  // 순수 base64로 온 경우 jpeg로 가정
  if (/^[A-Za-z0-9+/=\s]+$/.test(image) && image.length > 100) return { mediaType: 'image/jpeg', data: image.replace(/\s/g, '') };
  return null;
}
function extractJson(text) {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}
