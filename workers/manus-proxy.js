// ============================================================
// Manus API 프록시 워커 — pour-manus-proxy
// 배포 방법:
//   1) Cloudflare Dashboard → Workers → pour-manus-proxy → Edit code
//      이 파일 전체를 복붙 → Deploy
//   2) (또는) npx wrangler deploy --config workers/wrangler.manus.toml
//
// 시크릿 (Cloudflare에 등록):
//   - MANUS_API_KEY  : 마누스 발급 키
//   - WORKER_SECRET  : 빌더와 공유하는 임의 문자열 (요청 인증용)
//
// 엔드포인트:
//   POST /create  body: { prompt, agentProfile?, workerSecret }
//                 res:  { taskId, taskTitle, taskUrl }
//   POST /status  body: { taskId, workerSecret }
//                 res:  { status, fileUrl?, fileName?, creditUsage?, taskUrl? }
// ============================================================

const MANUS_API_BASE = 'https://api.manus.ai/v1';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try { body = await request.json(); }
    catch (_) { return json({ error: 'Invalid JSON body' }, 400, origin); }

    // 워커 시크릿 검증 (랜덤 인터넷 트래픽 차단)
    if (!env.WORKER_SECRET) {
      return json({ error: 'WORKER_SECRET not configured' }, 500, origin);
    }
    if (!body || body.workerSecret !== env.WORKER_SECRET) {
      return json({ error: 'Unauthorized' }, 401, origin);
    }

    if (!env.MANUS_API_KEY) {
      return json({ error: 'MANUS_API_KEY not configured' }, 500, origin);
    }

    const path = new URL(request.url).pathname;
    if (path === '/create')   return handleCreate(body, env, origin);
    if (path === '/status')   return handleStatus(body, env, origin);
    return json({ error: 'Not found', hint: 'POST /create or /status' }, 404, origin);
  },
};

async function handleCreate(body, env, origin) {
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return json({ error: 'prompt is required' }, 400, origin);
  const agentProfile = String(body.agentProfile || 'manus-1.6');

  try {
    const r = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'API_KEY': env.MANUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, agentProfile }),
    });
    const data = await safeJson(r);
    if (!r.ok) return json({ error: 'Manus create failed', status: r.status, detail: data }, 502, origin);
    return json({
      taskId: data.task_id || data.id || null,
      taskTitle: data.task_title || data.title || null,
      taskUrl: data.task_url || data.share_url || null,
    }, 200, origin);
  } catch (e) {
    return json({ error: 'Worker fetch failed', message: String(e && e.message || e) }, 500, origin);
  }
}

async function handleStatus(body, env, origin) {
  const taskId = String(body.taskId || '').trim();
  if (!taskId) return json({ error: 'taskId is required' }, 400, origin);

  try {
    const r = await fetch(`${MANUS_API_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { 'API_KEY': env.MANUS_API_KEY },
    });
    const data = await safeJson(r);
    if (!r.ok) return json({ error: 'Manus status failed', status: r.status, detail: data }, 502, origin);

    // attachments / output 에서 파일 URL 추출 (스키마 변동 대응 — 여러 위치 검사)
    let fileUrl = null;
    let fileName = null;

    // 1) data.attachments[]
    if (Array.isArray(data.attachments)) {
      for (const a of data.attachments) {
        if (a && (a.url || a.fileUrl) && isImageish(a)) {
          fileUrl = a.url || a.fileUrl;
          fileName = a.name || a.fileName || null;
          break;
        }
      }
    }
    // 2) data.output[].content[]
    if (!fileUrl && Array.isArray(data.output)) {
      outer: for (const msg of data.output) {
        if (msg && Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c && (c.type === 'output_file' || c.type === 'output_image') && (c.fileUrl || c.url)) {
              fileUrl = c.fileUrl || c.url;
              fileName = c.fileName || c.name || null;
              break outer;
            }
          }
        }
      }
    }

    return json({
      status: data.status || 'unknown',
      fileUrl,
      fileName,
      creditUsage: data.credit_usage || null,
      taskUrl: data.task_url || data.share_url || null,
    }, 200, origin);
  } catch (e) {
    return json({ error: 'Worker fetch failed', message: String(e && e.message || e) }, 500, origin);
  }
}

function isImageish(a) {
  const n = String(a.name || a.fileName || a.url || a.fileUrl || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(n) || (a.mimeType && a.mimeType.startsWith('image/'));
}

async function safeJson(r) {
  try { return await r.json(); } catch (_) { return { _nonJson: true }; }
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
