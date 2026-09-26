/**
 * Cloudflare Pages Function — 소싱 링크 → 대표이미지(썸네일)·제목
 *
 *   GET /api/link-thumb?url=<링크>   → { ok, thumb, title, site }  (못 찾으면 ok:false)
 *   GET /api/link-thumb?img=<이미지URL> → 이미지 바이트 그대로 (CORS 허용)
 *
 * 소싱앱(Sourcing/Sourcing-os.html)에서 링크를 넣으면 이 함수로 썸네일을 찾고,
 * img 모드로 받아 Firebase Storage 에 올려 둔다(틱톡·인스타 이미지 주소는 며칠 뒤 만료되기 때문).
 *
 *  · 유튜브: 영상 ID 로 바로 (i.ytimg.com)
 *  · 틱톡: 공식 oEmbed
 *  · 그 외(인스타·1688·알리바바·스마트스토어·쿠팡 등): 페이지의 og:image / twitter:image / JSON-LD
 *    — 로그인 벽·봇 차단이 있는 사이트는 실패할 수 있다(그때는 ok:false, 앱은 조용히 넘어감).
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const UA_BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const MAX_IMG = 8 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...CORS },
  });
}
function decode(s) {
  return (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).trim();
}
function meta(html, key) {
  const k = key.replace(/[:.]/g, '\\$&');
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, 'i'));
  if (a) return decode(a[1]);
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, 'i'));
  return b ? decode(b[1]) : '';
}
function absUrl(u, base) {
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  try { return new URL(u, base).href; } catch (e) { return ''; }
}
function siteOf(u) {
  const h = (() => { try { return new URL(u).hostname; } catch (e) { return ''; } })();
  if (/tiktok|douyin/.test(h)) return '틱톡';
  if (/instagram|instagr\.am/.test(h)) return '인스타';
  if (/youtube|youtu\.be/.test(h)) return '유튜브';
  if (/1688\./.test(h)) return '1688';
  if (/alibaba\./.test(h)) return '알리바바';
  if (/aliexpress\./.test(h)) return '알리';
  return h.replace(/^www\./, '');
}
function youtubeId(u) {
  const m = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
async function getText(url, ua) {
  const r = await fetch(url, {
    headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8,zh;q=0.7' },
    redirect: 'follow',
  });
  return { ok: r.ok, url: r.url || url, text: await r.text() };
}
/* 페이지 HTML 에서 대표이미지·제목 찾기 */
function fromHtml(html, base) {
  let thumb = meta(html, 'og:image:secure_url') || meta(html, 'og:image') || meta(html, 'twitter:image') || meta(html, 'twitter:image:src');
  let title = meta(html, 'og:title') || meta(html, 'twitter:title');
  if (!thumb || !title) {
    const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(html)) && (!thumb || !title)) {
      try {
        const arr = [].concat(JSON.parse(m[1]));
        for (const j of arr) {
          if (!thumb && j.image) thumb = Array.isArray(j.image) ? (j.image[0].url || j.image[0]) : (j.image.url || j.image);
          if (!title && j.name) title = j.name;
        }
      } catch (e) { /* 깨진 JSON-LD 는 건너뜀 */ }
    }
  }
  if (!thumb) {   // 1688·알리바바: 상품 이미지 CDN 주소를 본문에서 직접
    const a = html.match(/https?:\/\/(?:cbu01|img|sc\d+|ae\d+)\.alicdn\.com\/[^"'\s\\]+?\.(?:jpg|jpeg|png|webp)/i);
    if (a) thumb = a[0];
  }
  if (!title) { const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) title = decode(t[1]); }
  return { thumb: absUrl(typeof thumb === 'string' ? thumb : '', base), title: (title || '').slice(0, 120) };
}

async function lookup(url) {
  const site = siteOf(url);
  const yt = youtubeId(url);
  if (yt) {
    let title = '';
    try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url)); if (r.ok) title = (await r.json()).title || ''; } catch (e) { /* 제목은 없어도 됨 */ }
    return { ok: true, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, title, site };
  }
  if (site === '틱톡') {
    try {
      const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), { headers: { 'User-Agent': UA_BROWSER } });
      if (r.ok) { const j = await r.json(); if (j.thumbnail_url) return { ok: true, thumb: j.thumbnail_url, title: j.title || '', site }; }
    } catch (e) { console.warn('[link-thumb] tiktok oembed 실패', e && e.message); }
  }
  // 일반 페이지 — 브라우저 UA 로 먼저, 안 되면 크롤러 UA(인스타 등은 크롤러에게만 og 태그를 줌)
  const order = site === '인스타' ? [UA_CRAWLER, UA_BROWSER] : [UA_BROWSER, UA_CRAWLER];
  let last = { thumb: '', title: '' };
  for (const ua of order) {
    try {
      const r = await getText(url, ua);
      const got = fromHtml(r.text, r.url);
      if (got.thumb) return { ok: true, thumb: got.thumb, title: got.title, site };
      if (got.title && !last.title) last = got;
    } catch (e) { console.warn('[link-thumb] 페이지 읽기 실패', ua.slice(0, 12), e && e.message); }
  }
  return { ok: false, thumb: '', title: last.title || '', site, error: '대표이미지를 찾지 못했어요' };
}

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestGet(context) {
  const q = new URL(context.request.url).searchParams;
  const img = q.get('img');
  if (img) {
    if (!/^https?:\/\//i.test(img)) return json({ ok: false, error: '이미지 주소가 올바르지 않아요' }, 400);
    try {
      const r = await fetch(img, { headers: { 'User-Agent': UA_BROWSER, 'Accept': 'image/*' }, redirect: 'follow' });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !/^image\//i.test(type)) return json({ ok: false, error: '이미지를 받지 못했어요 (' + r.status + ')' }, 502);
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_IMG) return json({ ok: false, error: '이미지가 너무 커요' }, 413);
      return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', ...CORS } });
    } catch (e) {
      return json({ ok: false, error: '이미지를 받지 못했어요: ' + (e && e.message ? e.message : String(e)) }, 502);
    }
  }
  const url = q.get('url');
  if (!url || !/^https?:\/\//i.test(url)) return json({ ok: false, error: '링크(https://…)가 필요해요' }, 400);
  try { return json(await lookup(url)); }
  catch (e) { return json({ ok: false, error: '링크를 읽지 못했어요: ' + (e && e.message ? e.message : String(e)) }, 502); }
}
