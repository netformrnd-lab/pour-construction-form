/**
 * Cloudflare Pages Function — 상품 링크에서 썸네일·상품명·가격 추출
 * GET /product-info?url=<상품 페이지 URL>
 * (브라우저는 CORS 때문에 다른 사이트를 직접 못 읽어서, 서버에서 대신 읽어 og 태그 등을 파싱)
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}
function pick(html, re) { const m = html.match(re); return m ? m[1].trim() : ''; }
function decodeEntities(s) {
  if (!s) return '';
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
}

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestGet(context) {
  const target = new URL(context.request.url).searchParams.get('url');
  if (!target || !/^https?:\/\//i.test(target)) {
    return json({ error: '유효한 상품 URL이 필요합니다.' }, 400);
  }
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; POURbot/1.0)', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      redirect: 'follow',
    });
    const html = await res.text();

    let thumb = pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    let name = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
      || pick(html, /<title[^>]*>([^<]+)<\/title>/i);
    let price = pick(html, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i)
      || pick(html, /id=["']span_product_price_text["'][^>]*>([^<]+)</i)
      || pick(html, /"salePrice"\s*:\s*"?([0-9,]+)"?/i)
      || pick(html, /"price"\s*:\s*"?([0-9,]+)"?/i);

    // JSON-LD 보강
    if (!price || !name || !thumb) {
      const ld = pick(html, /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
      if (ld) {
        try {
          const j = JSON.parse(ld);
          const off = j.offers && (Array.isArray(j.offers) ? j.offers[0] : j.offers);
          if (!price && off && off.price) price = String(off.price);
          if (!name && j.name) name = j.name;
          if (!thumb && j.image) thumb = Array.isArray(j.image) ? j.image[0] : j.image;
        } catch (e) { /* ignore */ }
      }
    }

    if (thumb && thumb.startsWith('//')) thumb = 'https:' + thumb;
    if (price) { const n = price.replace(/[^0-9]/g, ''); price = n ? Number(n).toLocaleString('ko-KR') + '원' : ''; }

    return json({ ok: true, name: decodeEntities(name), price: price, thumb: thumb });
  } catch (e) {
    return json({ error: '페이지를 읽지 못했어요: ' + (e && e.message ? e.message : String(e)) }, 502);
  }
}
