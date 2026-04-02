/**
 * Cloudflare Pages Function — 상품 상세 이미지 프록시
 *
 * 고정 URL로 마켓 상세설명에 등록하면, 어드민에서 이미지 교체 시 자동 반영.
 *
 * 사용법:
 *   /api/product-img?id={상품ID}&n={이미지순번}
 *   /api/product-img?id={상품ID}&n=0  → 첫번째 상세이미지
 *   /api/product-img?id={상품ID}       → 전체 상세페이지 HTML 렌더링
 *
 * 원리:
 *   1. Firestore REST API로 상품 데이터 읽기
 *   2. detailImages[n].url 에서 실제 이미지를 fetch
 *   3. 이미지 바이너리를 그대로 응답 (Cache-Control: 1시간)
 *   → 마켓에서는 이 URL을 <img src="...">로 등록
 *   → 어드민에서 이미지 교체 → Firestore 업데이트 → 캐시 만료 후 자동 반영
 */

const FIRESTORE_PROJECT = 'pour-exhibition';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Firestore REST 응답에서 값 추출
function extractValue(field) {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.arrayValue) return (field.arrayValue.values || []).map(extractValue);
  if (field.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      obj[k] = extractValue(v);
    }
    return obj;
  }
  return null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const productId = url.searchParams.get('id');
  const imgIndex = url.searchParams.get('n');

  if (!productId) {
    return new Response('Missing id parameter', { status: 400, headers: CORS_HEADERS });
  }

  try {
    // Firestore REST API로 상품 문서 읽기
    const docUrl = `${FIRESTORE_BASE}/products/${productId}`;
    const docRes = await fetch(docUrl);
    if (!docRes.ok) {
      return new Response('Product not found', { status: 404, headers: CORS_HEADERS });
    }
    const docData = await docRes.json();
    const fields = docData.fields || {};

    // n 파라미터가 있으면 → 특정 이미지 프록시
    if (imgIndex !== null && imgIndex !== undefined) {
      const detailImages = extractValue(fields.detailImages) || [];
      const idx = parseInt(imgIndex, 10);

      if (idx < 0 || idx >= detailImages.length) {
        return new Response('Image index out of range', { status: 404, headers: CORS_HEADERS });
      }

      const imageUrl = detailImages[idx]?.url;
      if (!imageUrl) {
        return new Response('Image URL not found', { status: 404, headers: CORS_HEADERS });
      }

      // 실제 이미지를 fetch해서 프록시
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return new Response('Failed to fetch image', { status: 502, headers: CORS_HEADERS });
      }

      const imgBody = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

      return new Response(imgBody, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1시간 캐시
        },
      });
    }

    // n 파라미터가 없으면 → 전체 상세페이지 HTML 렌더링
    const detailHtml = extractValue(fields.detailHtml) || '';
    const name = extractValue(fields.name) || '상품 상세';

    if (!detailHtml) {
      // detailHtml이 없으면 detailImages로 대체
      const detailImages = extractValue(fields.detailImages) || [];
      if (detailImages.length === 0) {
        return new Response('No detail content', { status: 404, headers: CORS_HEADERS });
      }
      const imgsHtml = detailImages
        .map(img => `<img src="${img?.url || ''}" style="width:100%;display:block;" alt="${name}">`)
        .join('\n');
      return new Response(renderPage(name, imgsHtml), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    return new Response(renderPage(name, detailHtml), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });

  } catch (e) {
    return new Response('Internal error: ' + e.message, { status: 500, headers: CORS_HEADERS });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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
