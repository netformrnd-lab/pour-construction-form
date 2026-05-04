/**
 * Cloudflare Pages Function — 상품 상세페이지 프록시
 *
 * 어드민에서 수정 → 이 URL은 항상 최신 내용을 보여줌
 *
 * 사용법:
 *   /api/product-img?id={상품ID}         → 전체 상세페이지 HTML (이미지+텍스트)
 *   /api/product-img?id={상품ID}&n=0     → 상세HTML에서 n번째 이미지만 프록시
 *   /api/product-img?id={상품ID}&mode=img → detailImages 배열의 이미지 (Storage 업로드분)
 *
 * 캐시: 10분 (s-maxage=600) — 수정 후 최대 10분 내 반영
 */

const FIRESTORE_PROJECT = 'pour-app-new';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;
const CACHE_SEC = 600; // 10분

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function extractValue(field) {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.arrayValue) return (field.arrayValue.values || []).map(extractValue);
  if (field.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) obj[k] = extractValue(v);
    return obj;
  }
  return null;
}

// HTML에서 img src 추출
function extractImgUrls(html) {
  const urls = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) urls.push(m[1]);
  return urls;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const productId = url.searchParams.get('id');
  const imgIndex = url.searchParams.get('n');
  const mode = url.searchParams.get('mode'); // 'img' = detailImages 배열 사용

  if (!productId) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Firestore에서 상품 읽기
    const docRes = await fetch(`${FIRESTORE_BASE}/products/${productId}`);
    if (!docRes.ok) {
      const errText = await docRes.text();
      return new Response(JSON.stringify({ error: 'Product not found', detail: errText }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    const docData = await docRes.json();
    const fields = docData.fields || {};
    const detailHtml = extractValue(fields.detailHtml) || '';
    const detailImages = extractValue(fields.detailImages) || [];
    const name = extractValue(fields.name) || '상품 상세';

    // ── 이미지 프록시 모드 ──
    if (imgIndex !== null && imgIndex !== undefined) {
      const idx = parseInt(imgIndex, 10);
      let imageUrl = null;

      if (mode === 'img') {
        // detailImages 배열에서 (Storage 업로드된 이미지)
        imageUrl = detailImages[idx]?.url;
      } else {
        // detailHtml에서 img src 추출
        const imgUrls = extractImgUrls(detailHtml);
        imageUrl = imgUrls[idx];
      }

      if (!imageUrl) {
        return new Response(JSON.stringify({
          error: 'Image not found',
          index: idx,
          availableFromHtml: extractImgUrls(detailHtml).length,
          availableFromArray: detailImages.length,
        }), {
          status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }

      // 프로토콜 보정 (//ecimg... → https://ecimg...)
      if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch image', url: imageUrl }), {
          status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }

      return new Response(await imgRes.arrayBuffer(), {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': `public, max-age=${CACHE_SEC}, s-maxage=${CACHE_SEC}`,
        },
      });
    }

    // ── 전체 상세페이지 HTML 렌더링 모드 ──
    let bodyHtml = detailHtml;

    if (!bodyHtml && detailImages.length > 0) {
      bodyHtml = detailImages
        .map(img => `<img src="${img?.url || ''}" style="width:100%;display:block;" alt="${name}">`)
        .join('\n');
    }

    if (!bodyHtml) {
      return new Response(JSON.stringify({ error: 'No detail content', productId }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(renderPage(name, bodyHtml), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_SEC}, s-maxage=${CACHE_SEC}`,
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', message: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function renderPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,sans-serif;background:#fff;max-width:860px;margin:0 auto;}
img{max-width:100%;height:auto;display:block;}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
