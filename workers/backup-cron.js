/**
 * Cloudflare Worker — Firestore 백업 Cron Trigger
 *
 * 역할:
 *   - 매일 자정 KST에 GitHub Actions 백업 워크플로우를 트리거
 *   - GitHub Actions 단독으로도 작동하지만, Cloudflare Cron을 이중 안전망으로 사용
 *
 * 배포:
 *   npx wrangler deploy --config workers/wrangler.backup.toml
 *
 * 시크릿 등록:
 *   npx wrangler secret put GITHUB_TOKEN --config workers/wrangler.backup.toml
 *   npx wrangler secret put WORKER_SECRET --config workers/wrangler.backup.toml
 *
 * 엔드포인트:
 *   POST /trigger-backup  { secret: "...", env: "production" }  → 수동 트리거
 *   GET  /health                                                 → 상태 확인
 */

const GITHUB_API = 'https://api.github.com';
const GITHUB_REPO = 'netformrnd-lab/pour-construction-form';
const WORKFLOW_FILE = 'firestore-backup.yml';

// ── CORS 헤더 ─────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── GitHub Actions 워크플로우 트리거 ──────────────────────
async function triggerGitHubWorkflow(token, environment = 'production') {
  const url = `${GITHUB_API}/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'POUR-Backup-Worker/1.0',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { environment },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API 오류 ${res.status}: ${text}`);
  }

  return true;
}

// ── Cron 핸들러 (자동 실행) ───────────────────────────────
export default {
  // Cron Trigger — wrangler.backup.toml의 crons 설정에 따라 자동 실행
  async scheduled(event, env, ctx) {
    console.log(`[POUR 백업 Cron] 실행: ${new Date().toISOString()}`);

    try {
      await triggerGitHubWorkflow(env.GITHUB_TOKEN, 'production');
      console.log('[완료] GitHub Actions 트리거 성공');
    } catch (err) {
      console.error('[실패]', err.message);
      // Cron에서는 에러를 throw해도 재시도 없음 — 로그로만 기록
    }
  },

  // HTTP 핸들러 — 수동 트리거 + 헬스체크
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // GET /health
    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        service: 'pour-backup-cron',
        time: new Date().toISOString(),
      });
    }

    // POST /trigger-backup — 수동 트리거 (관리자 전용)
    if (url.pathname === '/trigger-backup' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'JSON 파싱 오류' }, 400);
      }

      // 시크릿 검증
      if (body.secret !== env.WORKER_SECRET) {
        return json({ error: '인증 실패' }, 401);
      }

      const environment = body.env === 'development' ? 'development' : 'production';

      try {
        await triggerGitHubWorkflow(env.GITHUB_TOKEN, environment);
        return json({ ok: true, message: `${environment} 백업 트리거 완료` });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: '404 Not Found' }, 404);
  },
};
