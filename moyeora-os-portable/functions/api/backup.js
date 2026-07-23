// Cloudflare Pages Function — 전체 상태(JSON)를 GitHub에 커밋(오프디바이스 자동 백업).
// 토큰은 서버(환경변수)에만 보관 — 클라이언트에 노출되지 않음.
//
// 필요한 Cloudflare Pages 환경변수 (Settings ▸ Environment variables):
//   GITHUB_TOKEN          : GitHub PAT (contents: read/write 권한)  ★필수★
//   GITHUB_BACKUP_REPO    : "owner/name" 예: netformrnd-lab/pour-construction-form  ★필수★
//   GITHUB_BACKUP_BRANCH  : 커밋 브랜치 (선택, 기본 main)
//   GITHUB_BACKUP_DIR     : 백업 폴더 (선택, 기본 pour-os-backups)
//
// POST /api/backup   body: { content: "<JSON 문자열>", reason?: "..." }
//   → GITHUB_BACKUP_DIR/state-YYYY-MM-DD.json 으로 그날 파일을 갱신 커밋
// GET  /api/backup   → { ok, configured, repo }  (설정 여부 확인용)

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function onRequestGet({ env }) {
  return json({ ok: true, configured: !!(env.GITHUB_TOKEN && env.GITHUB_BACKUP_REPO), repo: env.GITHUB_BACKUP_REPO || null });
}

export async function onRequestPost({ request, env }) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_BACKUP_REPO;
  const branch = env.GITHUB_BACKUP_BRANCH || "main";
  const dir = (env.GITHUB_BACKUP_DIR || "pour-os-backups").replace(/\/+$/, "");
  if (!token || !repo) {
    return json({ ok: false, configured: false, error: "GITHUB_TOKEN / GITHUB_BACKUP_REPO 미설정 — Cloudflare Pages 환경변수에 추가하세요." });
  }
  // 출처 제한(선택) — POUR_ALLOWED_ORIGINS 설정 시 그 출처만 레포 쓰기 허용(무단 커밋 차단)
  const allow = (env.POUR_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length) {
    const origin = request.headers.get("origin") || "";
    const ref = request.headers.get("referer") || "";
    if (!allow.some((a) => origin === a || ref.startsWith(a))) return json({ ok: false, error: "forbidden origin" }, 403);
  }
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "잘못된 요청(JSON)" }, 400); }
  const content = body && body.content;
  if (typeof content !== "string" || !content) return json({ ok: false, error: "content 없음" }, 400);
  if (content.length > 40 * 1024 * 1024) return json({ ok: false, error: "백업 용량 초과(40MB)" }, 413);

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const path = `${dir}/state-${ymd}.json`;
  const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "User-Agent": "pour-os-backup", "Content-Type": "application/json" };

  // 같은 날 파일이 있으면 sha를 받아 갱신
  let sha;
  try {
    const g = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
    if (g.status === 200) { const j = await g.json(); sha = j.sha; }
  } catch (_) {}

  let put;
  try {
    put = await fetch(apiBase, {
      method: "PUT", headers,
      body: JSON.stringify({ message: `pour-os 자동 백업 ${now.toISOString()}${body.reason ? " (" + body.reason + ")" : ""}`, content: base64Utf8(content), branch, sha }),
    });
  } catch (e) { return json({ ok: false, error: "GitHub 연결 실패: " + (e && e.message || e) }); }

  if (!put.ok) { const t = await put.text().catch(() => ""); return json({ ok: false, error: `GitHub ${put.status}: ${t.slice(0, 200)}` }); }
  const pj = await put.json().catch(() => ({}));
  return json({ ok: true, path, commit: pj.commit && pj.commit.sha, at: now.toISOString() });
}
