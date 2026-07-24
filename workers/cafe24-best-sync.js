/**
 * Cloudflare Worker — 카페24 판매량 → Firestore 베스트 랭킹 동기화
 *
 * 역할:
 *   - 매일(전일 기준) 카페24 주문 데이터를 집계해 상품별 판매 개수를 계산
 *   - 일간(1일)/주간(7일)/월간(30일) 랭킹을 카테고리별로 산정
 *   - 결과를 Firestore  config/pourstoreBest  문서에 기록
 *   - POUR스토어 best.html 이 이 문서를 읽어 화면에 표시
 *
 * 보안 설계:
 *   - 카페24 client_id/secret/mall_id = Worker Secret (평문 노출 금지)
 *   - 회전하는 refresh_token = Cloudflare KV(CAFE24_KV)에 보관 (공개 Firestore에 저장 금지)
 *   - 출력물(config/pourstoreBest)만 Firestore에 기록 (상품 랭킹이라 공개돼도 무방)
 *
 * 배포:
 *   npx wrangler deploy --config workers/wrangler.cafe24-best.toml
 * 시크릿:
 *   npx wrangler secret put CAFE24_CLIENT_ID     --config workers/wrangler.cafe24-best.toml
 *   npx wrangler secret put CAFE24_CLIENT_SECRET  --config workers/wrangler.cafe24-best.toml
 *   npx wrangler secret put FIREBASE_API_KEY      --config workers/wrangler.cafe24-best.toml
 *   npx wrangler secret put WORKER_SECRET         --config workers/wrangler.cafe24-best.toml
 * 최초 1회 refresh_token 심기:
 *   POST /seed  { "secret":"<WORKER_SECRET>", "refresh_token":"<카페24 OAuth로 발급받은 refresh_token>" }
 *
 * 엔드포인트:
 *   POST /sync  { secret }              → 즉시 동기화 (수동 실행/테스트)
 *   POST /seed  { secret, refresh_token} → refresh_token 초기 저장/교체
 *   GET  /health                        → 상태 확인
 */

const FS_PROJECT = 'pour-app-new';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

// ── 카테고리 분류(제품명 키워드) — best.html / pour-products.html 과 동일 규칙 ──
const TAB_RULES = [
  ['패키지',   ['패키지','세트','키트','도구세트']],
  ['안전용품', ['안전','세이프티','절연화','현장화','작업화','주방화','크린룸화','안전화','마스크','장갑','방진','안전모','벨트','칼라콘','꼬깔','목토시','넥워머','보안경','글러브','조끼','발등보호대','압박밴드','보안면','귀마개','각반']],
  ['보강자재', ['탄성강화','모체강화','강화파우더','후커','드라이비트','코너비드','보강매쉬','드라이비트매쉬','페이퍼팬벤트','팬벤트']],
  ['방수',     ['방수','우레탄','실란트','PVC시트','씰코트','씰패치','씰코팅','방수밀대','방수페인트','드림코트']],
  ['균열보수', ['균열','크랙','퍼티','씰프로','인젝션','후레슁','후레싱','포트홀','아스콘','유화프라이머','아스팔트프라이머']],
  ['페인트',   ['제비스코','에폭시','우방코트','프라이머','도료','락카','에나멜','바니쉬','매직칼라','라이닝','실러','코트재','써밋페인트','강화재','방청','녹방지']],
  ['도장·도색',['붓','로라','롤러','로러','하나로','리필','트레이','도색통','공캔','신나통','스프레이건','스프레이','도색','풀솔','빽붓','극세사','로라대','노즐','코킹건','펌프','믹서','샌더','교반','브러쉬']],
  ['부자재',   ['헤라','스크래퍼','스크레퍼','바닥칼','밀대','고대','미장','흙손','사포','연마','테이프','커버링','보양','마스킹','한냉사','아사','빠데판','여과지','와이어브러쉬','록타이트','접착제','비드','골판지']],
];
const CATS = ['패키지','방수','균열보수','도장·도색','페인트','보강자재','부자재','안전용품','기타'];
function classify(name) {
  const n = String(name || '').replace(/\s+/g, '');
  for (const [cat, kws] of TAB_RULES) for (const k of kws) if (n.indexOf(k.replace(/\s+/g, '')) >= 0) return cat;
  return '기타';
}

// ── 날짜(KST 전일 기준) ──
function kstYesterdayRange(days) {
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  const end = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - 24 * 3600 * 1000); // 어제
  const start = new Date(end.getTime() - (days - 1) * 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ── Firestore 값 인코더(REST 타입 JSON) ──
function encodeVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeVal) } };
  if (typeof v === 'object') { const f = {}; for (const k of Object.keys(v)) f[k] = encodeVal(v[k]); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}
function decodeVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) { const o = {}; const f = (v.mapValue.fields) || {}; for (const k of Object.keys(f)) o[k] = decodeVal(f[k]); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeVal);
  return null;
}

// ── 카페24 access_token 발급(refresh_token 회전) ──
async function getAccessToken(env) {
  const refresh = await env.CAFE24_KV.get('refresh_token');
  if (!refresh) throw new Error('KV에 refresh_token 없음 — /seed 로 최초 저장 필요');
  const basic = btoa(`${env.CAFE24_CLIENT_ID}:${env.CAFE24_CLIENT_SECRET}`);
  const res = await fetch(`https://${env.CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basic}` },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('카페24 토큰 갱신 실패: ' + JSON.stringify(j));
  // 회전된 refresh_token 저장(다음 실행 대비)
  if (j.refresh_token) await env.CAFE24_KV.put('refresh_token', j.refresh_token);
  return j.access_token;
}

// ── 카페24 주문 집계 → { product_no: soldQty } ──
async function aggregateSales(env, accessToken, startDate, endDate) {
  const qty = {};
  const limit = 100;
  let offset = 0, page = 0;
  const apiVer = env.CAFE24_API_VERSION || '2024-06-01';
  while (page < 60) { // 최대 6000건 안전장치
    const url = `https://${env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/orders`
      + `?start_date=${startDate}&end_date=${endDate}&date_type=order_date`
      + `&embed=items&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Cafe24-Api-Version': apiVer } });
    if (!res.ok) throw new Error(`주문조회 실패(${res.status}): ` + (await res.text()).slice(0, 300));
    const j = await res.json();
    const orders = j.orders || [];
    for (const o of orders) {
      const items = o.items || [];
      for (const it of items) {
        // 취소/반품 수량 제외(주문 수량 기준)
        const pno = String(it.product_no || '');
        const q = Number(it.quantity || 0);
        if (!pno || !q) continue;
        qty[pno] = (qty[pno] || 0) + q;
      }
    }
    if (orders.length < limit) break;
    offset += limit; page += 1;
  }
  return qty;
}

// ── Firestore products 전체 로드 → code(product_no) → 정보 맵 ──
async function loadProductMap(apiKey) {
  const map = {};
  let pageToken = '';
  do {
    const url = `${FS_BASE}/products?key=${apiKey}&pageSize=300` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('products 로드 실패: ' + res.status);
    const j = await res.json();
    for (const doc of (j.documents || [])) {
      const f = doc.fields || {};
      const g = (k) => decodeVal(f[k]);
      const code = String((g('channels') && g('channels').imweb) || g('imwebId') || '').trim();
      if (!code) continue;
      map[code] = {
        code,
        name: g('name') || '',
        brand: g('brand') || 'POUR스토어',
        thumb: g('thumbnail') || '',
        price: g('price') || 0,
        salePrice: g('salePrice') || 0,
        salesStatus: g('salesStatus') || '',
        link: '/product/detail.html?product_no=' + encodeURIComponent(code),
      };
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return map;
}

// ── 한 기간의 랭킹 산정 → { 전체:[...], 카테고리:[...] } ──
function buildPeriodRanking(qtyMap, prodMap) {
  const rows = [];
  for (const code of Object.keys(qtyMap)) {
    const p = prodMap[code];
    if (!p || !p.name) continue; // 카탈로그에 없는 상품(옵션/사은품 등) 제외
    rows.push({ ...p, soldQty: qtyMap[code], _tab: classify(p.name) });
  }
  rows.sort((a, b) => b.soldQty - a.soldQty);
  const out = { 전체: rows.slice(0, 100) };
  for (const c of CATS) out[c] = rows.filter((r) => r._tab === c).slice(0, 100);
  return out;
}

// ── 전체 동기화 ──
async function syncAll(env) {
  const accessToken = await getAccessToken(env);
  const prodMap = await loadProductMap(env.FIREBASE_API_KEY);
  const periodsDef = { daily: 1, weekly: 7, monthly: 30 };
  const periods = {};
  let basisDate = '';
  for (const [name, days] of Object.entries(periodsDef)) {
    const { start, end } = kstYesterdayRange(days);
    basisDate = end;
    const qty = await aggregateSales(env, accessToken, start, end);
    periods[name] = buildPeriodRanking(qty, prodMap);
  }
  const docBody = { fields: {
    basisDate: encodeVal(basisDate),
    updatedAt: encodeVal(new Date().toISOString()),
    periods: encodeVal(periods),
  } };
  const res = await fetch(`${FS_BASE}/config/pourstoreBest?key=${env.FIREBASE_API_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(docBody),
  });
  if (!res.ok) throw new Error('config/pourstoreBest 기록 실패: ' + (await res.text()).slice(0, 300));
  const counts = Object.fromEntries(Object.entries(periods).map(([k, v]) => [k, (v.전체 || []).length]));
  return { basisDate, counts };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncAll(env).then(
      (r) => console.log('[best-sync] 완료', JSON.stringify(r)),
      (e) => console.error('[best-sync] 실패', e && e.message),
    ));
  },
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'cafe24-best-sync' });
    if (request.method === 'POST' && url.pathname === '/seed') {
      const b = await request.json().catch(() => ({}));
      if (b.secret !== env.WORKER_SECRET) return json({ error: 'unauthorized' }, 401);
      if (!b.refresh_token) return json({ error: 'refresh_token 필요' }, 400);
      await env.CAFE24_KV.put('refresh_token', String(b.refresh_token));
      return json({ ok: true, seeded: true });
    }
    if (request.method === 'POST' && url.pathname === '/sync') {
      const b = await request.json().catch(() => ({}));
      if (b.secret !== env.WORKER_SECRET) return json({ error: 'unauthorized' }, 401);
      try { return json({ ok: true, ...(await syncAll(env)) }); }
      catch (e) { return json({ error: String(e && e.message || e) }, 500); }
    }
    return json({ error: 'not found' }, 404);
  },
};
