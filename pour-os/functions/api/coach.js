// Cloudflare Pages Function — Anthropic 프록시 (AI 코치)
// 클라이언트가 /api/coach 로 POST → 서버에서 키를 붙여 Anthropic으로 전달.
// (브라우저에 API 키를 노출하지 않기 위함)
// 환경변수:
//   ANTHROPIC_API_KEY      (필수) — CF Pages > Settings > Environment variables
//   POUR_ALLOWED_ORIGINS   (선택) — 콤마구분 허용 출처. 설정 시 그 출처에서 온 요청만 허용(공개 프록시 남용 차단).
// 비용 폭주 방지: 모델은 claude-* 만 허용, max_tokens 상한 강제.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const MAX_TOKENS = 2048;

export async function onRequestPost({ request, env }) {
  try {
    // ① 출처 제한(선택) — 설정돼 있으면 허용 목록의 출처만
    const allow = (env.POUR_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allow.length) {
      const origin = request.headers.get("origin") || "";
      const ref = request.headers.get("referer") || "";
      if (!allow.some((a) => origin === a || ref.startsWith(a))) return J({ error: "forbidden origin" }, 403);
    }
    const body = await request.json();
    // ② 모델 화이트리스트 — 당신 키로 임의(고가) 모델 호출 차단
    if (typeof body.model !== "string" || !body.model.startsWith("claude-")) return J({ error: "model not allowed" }, 400);
    // ③ 토큰 상한 — 한 요청당 비용 블래스트 차단
    body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    return J({ error: String(e) }, 500);
  }
}
