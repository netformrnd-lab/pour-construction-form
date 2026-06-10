// Cloudflare Pages Function — Anthropic 프록시 (AI 코치)
// 클라이언트가 /api/coach 로 POST → 서버에서 키를 붙여 Anthropic으로 전달.
// (브라우저에 API 키를 노출하지 않기 위함)
// 환경변수: ANTHROPIC_API_KEY  (CF Pages > Settings > Environment variables)
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
