/* POUR 마케팅 허브 — 계산만 하는 공통 로직 (화면·Firebase 없음)
   - upload.html(미리보기·검증)과 index.html(정리·요약)이 같이 쓴다
   - 시험: node marketing-hub/core.test.mjs
   - 채널별 열 이름(ALIASES)은 실제 CSV 샘플을 받으면 여기만 고친다 */
(function (root) {
  'use strict';

  // 채널 — uploads.channel 값과 같음 (firestore.rules 의 목록과도 맞출 것)
  const CHANNELS = [
    { id: 'cafe24', label: '카페24 판매', kind: 'sales' },
    { id: 'coupang_ads', label: '쿠팡 광고', kind: 'ads' },
    { id: 'naver_ads', label: '네이버 광고', kind: 'ads' },
    { id: 'stock', label: '재고', kind: 'stock' },
  ];
  const channelOf = (id) => CHANNELS.find((c) => c.id === id) || null;

  // 내부 필드 → 이 열 이름들 중 하나 (앞에 있는 것이 우선). 비교는 공백·괄호·기호를 뺀 소문자로.
  const FIELDS = {
    sales: [
      { key: 'productCode', label: '상품코드', aliases: ['자체상품코드', '상품코드', '상품번호', '품목코드'] },
      { key: 'productName', label: '상품명', aliases: ['상품명', '제품명', '품목명'] },
      { key: 'qty', label: '판매수량', aliases: ['판매수량', '주문수량', '결제수량', '수량'], number: true, required: true },
      { key: 'revenue', label: '판매금액', aliases: ['판매합계', '판매금액', '실결제금액', '결제금액', '주문금액', '매출액', '매출'], number: true },
      { key: 'orders', label: '주문건수', aliases: ['주문건수', '주문수', '결제건수'], number: true },
    ],
    ads: [
      { key: 'campaign', label: '캠페인', aliases: ['캠페인명', '캠페인'] },
      { key: 'keyword', label: '키워드', aliases: ['키워드', '검색어'], required: true },
      { key: 'impressions', label: '노출수', aliases: ['노출수', '노출'], number: true },
      { key: 'clicks', label: '클릭수', aliases: ['클릭수'], number: true },
      { key: 'cost', label: '비용', aliases: ['총비용', '광고비', '집행광고비', '비용', '소진액'], number: true, required: true },
      { key: 'revenue', label: '전환매출', aliases: ['총전환매출액14일', '총전환매출액1일', '전환매출액', '광고전환매출', '매출액'], number: true, required: true },
    ],
    stock: [
      { key: 'productCode', label: '상품코드', aliases: ['자체상품코드', '상품코드', '상품번호', '품목코드'] },
      { key: 'productName', label: '상품명', aliases: ['상품명', '제품명', '품목명'] },
      { key: 'available', label: '가용재고', aliases: ['가용재고', '현재고', '재고수량', '재고', '수량'], number: true, required: true },
      { key: 'leadTimeDays', label: '리드타임', aliases: ['리드타임', '입고소요일', '발주소요일'], number: true },
    ],
  };
  // 상품을 알아볼 열(코드 또는 이름) 중 하나는 꼭 있어야 하는 종류
  const NEEDS_PRODUCT = { sales: true, stock: true };

  const SUMMARY_WORDS = ['합계', '총계', '소계', 'total', '전체'];

  /* ── CSV / 붙여넣은 표 읽기 ───────────────────────────── */
  function parseTable(text) {
    let s = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const first = s.split('\n').find((l) => l.trim()) || '';
    const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
  }

  const norm = (h) => String(h || '').toLowerCase().replace(/[\s()[\]{}<>,.:;/\\_\-·%~'"*]/g, '').replace(/vat(포함|제외)?|원$/g, '');

  function toNumber(v) {
    if (v == null) return 0;
    const t = String(v).replace(/[,\s원₩%]/g, '');
    if (t === '' || t === '-') return 0;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  // 머리줄 위치와 열 연결을 찾는다 (리포트 위쪽 제목 줄은 건너뜀)
  function mapColumns(header, kind) {
    const hs = header.map(norm);
    const used = new Set();
    const map = {};
    for (const f of FIELDS[kind]) {
      let idx = -1;
      for (const a of f.aliases) {
        const na = norm(a);
        idx = hs.findIndex((h, i) => !used.has(i) && h === na);
        if (idx < 0) idx = hs.findIndex((h, i) => !used.has(i) && h && h.includes(na));
        if (idx >= 0) break;
      }
      if (idx >= 0) { map[f.key] = idx; used.add(idx); }
    }
    return map;
  }

  function findHeader(rows, kind) {
    let best = { at: -1, map: {}, score: 0 };
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const map = mapColumns(rows[i], kind);
      const score = Object.keys(map).length;
      if (score > best.score) best = { at: i, map, score };
    }
    return best;
  }

  /* ── 검사 + 행 만들기 (업로드 미리보기·관리자 정리 공용) ── */
  function analyze(text, channelId) {
    const ch = channelOf(channelId);
    if (!ch) return { ok: false, errors: ['채널을 고르세요.'], rows: [], header: [], preview: [] };
    const kind = ch.kind;
    const table = parseTable(text);
    if (!table.length) return { ok: false, errors: ['CSV 내용이 비어 있습니다.'], rows: [], header: [], preview: [] };
    const { at, map } = findHeader(table, kind);
    const header = at >= 0 ? table[at] : table[0];
    const errors = [];
    for (const f of FIELDS[kind]) if (f.required && map[f.key] == null) errors.push(`'${f.label}' 열이 없습니다.`);
    if (NEEDS_PRODUCT[kind] && map.productCode == null && map.productName == null) errors.push("'상품코드' 또는 '상품명' 열이 없습니다.");
    const recognized = FIELDS[kind].filter((f) => map[f.key] != null).map((f) => ({ key: f.key, label: f.label, column: header[map[f.key]] }));
    const body = at >= 0 ? table.slice(at + 1) : [];
    const preview = body.slice(0, 10);
    if (errors.length) return { ok: false, errors, rows: [], header, preview, recognized, kind };

    const rows = [];
    const bad = [];
    body.forEach((r, i) => {
      const o = {};
      for (const f of FIELDS[kind]) {
        if (map[f.key] == null) continue;
        const raw = r[map[f.key]];
        o[f.key] = f.number ? toNumber(raw) : String(raw == null ? '' : raw).trim();
        if (f.number && Number.isNaN(o[f.key])) bad.push(`${at + i + 2}번째 줄 '${f.label}' 값이 숫자가 아닙니다: ${raw}`);
      }
      const label = (o.keyword || o.productName || o.productCode || o.campaign || '').toLowerCase();
      if (SUMMARY_WORDS.some((w) => label === w || (o.campaign || '').toLowerCase() === w)) return; // 합계 줄
      if (kind === 'ads' && !o.keyword) return;
      if (kind !== 'ads' && !o.productCode && !o.productName) return;
      rows.push(o);
    });
    if (bad.length) return { ok: false, errors: bad.slice(0, 5), rows: [], header, preview, recognized, kind };
    if (!rows.length) return { ok: false, errors: ['데이터 줄이 없습니다.'], rows: [], header, preview, recognized, kind };
    return { ok: true, errors: [], rows, header, preview, recognized, kind };
  }

  // 큰 파일: 알아본 열만 남긴 CSV (Firestore 문서 1MB 한도 대비)
  function reducedCsv(result) {
    const keys = result.recognized.map((r) => r.key);
    const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [result.recognized.map((r) => esc(r.column)).join(',')]
      .concat(result.rows.map((o) => keys.map((k) => esc(o[k])).join(','))).join('\n');
  }

  /* ── 문서 ID · 정리 ───────────────────────────────────── */
  function hash(s) { // FNV-1a 32bit
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const safeId = (s) => String(s).replace(/[\/\s#?[\]]/g, '_').slice(0, 300);
  const productKey = (o) => (o.productCode ? String(o.productCode) : 'name:' + String(o.productName || '').replace(/\s+/g, ''));
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

  // 같은 날짜·채널을 다시 올리면 같은 ID → 덮어씀. 같은 키가 여러 줄(옵션별 등)이면 합친다.
  function buildDocs(result, channelId, reportDate) {
    const kind = channelOf(channelId).kind;
    const out = new Map();
    for (const o of result.rows) {
      if (kind === 'ads') {
        const campaign = o.campaign || '';
        const id = `${reportDate}_${channelId}_${hash(campaign + '|' + o.keyword)}`;
        const d = out.get(id) || { reportDate, channel: channelId, campaign, keyword: o.keyword, impressions: 0, clicks: 0, cost: 0, revenue: 0 };
        d.impressions += o.impressions || 0; d.clicks += o.clicks || 0; d.cost += o.cost || 0; d.revenue += o.revenue || 0;
        d.roas = d.cost > 0 ? round((d.revenue / d.cost) * 100, 1) : 0;
        out.set(id, d);
      } else if (kind === 'sales') {
        const pk = productKey(o);
        const id = safeId(`${reportDate}_${channelId}_${pk}`);
        const d = out.get(id) || { reportDate, channel: channelId, productCode: o.productCode || '', productName: o.productName || '', productKey: pk, qty: 0, revenue: 0, orders: 0 };
        d.qty += o.qty || 0; d.revenue += o.revenue || 0; d.orders += o.orders || 0;
        out.set(id, d);
      } else {
        const pk = productKey(o);
        const id = safeId(`${reportDate}_${pk}`);
        const d = out.get(id) || { reportDate, productCode: o.productCode || '', productName: o.productName || '', productKey: pk, available: 0 };
        d.available += o.available || 0;
        if (o.leadTimeDays) d.leadTimeDays = o.leadTimeDays;
        out.set(id, d);
      }
    }
    return out; // Map<docId, data>
  }

  /* ── 재고 (레오) ─────────────────────────────────────────
     일평균 = 최근 14일 판매수량 합 ÷ 14 (모든 채널)
     남은 일수 = 가용재고 ÷ 일평균
     발주 필요 = 남은 일수 ≤ 리드타임 + 안전재고일
     발주 수량 = (리드타임 + 30일) × 일평균 − 가용재고 (올림, 0 미만이면 0) */
  function addDays(ymd, n) {
    const [y, m, d] = ymd.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
  }
  function stockPlan(stock, salesDocs, opt = {}) {
    const days = opt.windowDays || 14;
    const lead0 = opt.defaultLeadTimeDays || 7;
    const safety = opt.safetyDays == null ? 7 : opt.safetyDays;
    const from = addDays(stock.reportDate, -(days - 1));
    let qty = 0;
    for (const s of salesDocs) {
      if (s.reportDate < from || s.reportDate > stock.reportDate) continue;
      const same = (stock.productCode && s.productCode && String(s.productCode) === String(stock.productCode)) ||
        (s.productName && stock.productName && s.productName.replace(/\s+/g, '') === stock.productName.replace(/\s+/g, ''));
      if (same) qty += s.qty || 0;
    }
    const avg = qty / days;
    const lead = stock.leadTimeDays || lead0;
    const daysLeft = avg > 0 ? round(stock.available / avg, 1) : null; // null = 최근 판매 없음
    const reorderNeeded = daysLeft != null && daysLeft <= lead + safety;
    const reorderQty = avg > 0 ? Math.max(0, Math.ceil((lead + 30) * avg - stock.available)) : 0;
    return { avgDailySales: round(avg, 2), daysLeft, leadTimeDays: lead, reorderNeeded, reorderQty };
  }

  /* ── 키워드 판단 (케이) ─────────────────────────────────
     기간 합계로 판단. 끄기: 비용 ≥ minCost 인데 전환매출 0
     줄이기: ROAS < low · 올리기: ROAS ≥ high 그리고 클릭 ≥ minClicks · 나머지 유지 */
  function keywordAdvice(adsDocs, opt = {}) {
    const low = opt.roasLow == null ? 200 : opt.roasLow;
    const high = opt.roasHigh == null ? 400 : opt.roasHigh;
    const minCost = opt.minCost == null ? 10000 : opt.minCost;
    const minClicks = opt.minClicks == null ? 10 : opt.minClicks;
    const g = new Map();
    for (const a of adsDocs) {
      const k = `${a.channel}|${a.campaign || ''}|${a.keyword}`;
      const d = g.get(k) || { channel: a.channel, campaign: a.campaign || '', keyword: a.keyword, impressions: 0, clicks: 0, cost: 0, revenue: 0, days: 0 };
      d.impressions += a.impressions || 0; d.clicks += a.clicks || 0; d.cost += a.cost || 0; d.revenue += a.revenue || 0; d.days++;
      g.set(k, d);
    }
    const list = [...g.values()].map((d) => {
      d.roas = d.cost > 0 ? round((d.revenue / d.cost) * 100, 1) : 0;
      if (d.cost >= minCost && d.revenue === 0) { d.action = 'off'; d.reason = '전환매출 없음'; }
      else if (d.cost >= minCost && d.roas < low) { d.action = 'down'; d.reason = `ROAS ${d.roas}% < ${low}%`; }
      else if (d.roas >= high && d.clicks >= minClicks) { d.action = 'up'; d.reason = `ROAS ${d.roas}% ≥ ${high}%`; }
      else { d.action = 'keep'; d.reason = d.cost < minCost ? '비용이 적어 판단 보류' : `ROAS ${d.roas}%`; }
      return d;
    });
    const by = (a) => list.filter((d) => d.action === a);
    return {
      up: by('up').sort((a, b) => b.roas - a.roas),
      down: by('down').sort((a, b) => a.roas - b.roas),
      off: by('off').sort((a, b) => b.cost - a.cost),
      keep: by('keep'),
    };
  }

  // 오늘(한국 시간) 기준 어제 YYYY-MM-DD
  function yesterdayKST(now = new Date()) {
    const k = new Date(now.getTime() + 9 * 3600 * 1000);
    k.setUTCDate(k.getUTCDate() - 1);
    return k.toISOString().slice(0, 10);
  }
  const utf8Bytes = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : Buffer.byteLength(s, 'utf8'));
  const MAX_CSV_BYTES = 900000;

  /* ── 옵시디언 노트 (대시보드 → 옵시디언 '05 오늘 숫자') ──────
     폰·PC 모두 obsidian:// 링크 한 번으로 노트를 덮어씀 (서버·비밀번호 없음)
     in: { date, sales7, salesPrev7, stock:[stockRows], advice:keywordAdvice(), sales:[{code,name,q7,r7,qp}], adsDays, voc?:vocSummary(), vocList?:[최근 메모] } */
  const OBSIDIAN_NOTE = '05 오늘 숫자';
  const OBSIDIAN_HUB = '00 허브';
  function obsidianNote(d) {
    const cell = (v) => String(v == null ? '' : v).replace(/\|/g, '/').replace(/\n/g, ' ');
    const n = (v) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR'));
    const need = d.stock.filter((r) => r.reorderNeeded);
    const a = d.advice;
    const pctTxt = d.salesPrev7 > 0 ? `${d.sales7 >= d.salesPrev7 ? '▲' : '▼'}${Math.abs(Math.round((d.sales7 - d.salesPrev7) / d.salesPrev7 * 100))}%` : '-';
    const L = [];
    const noSales = d.salesCount === 0 || (d.salesCount == null && !d.sales.length), noAds = d.adsCount === 0, noStock = d.stockCount === 0; // 리포트가 없으면 0 이 아니라 '없음' (AI 팀이 0원으로 읽지 않게 · 2026-10-12)
    L.push('---', '유형: 숫자', `기준일: ${d.date}`, `매출7일: ${noSales ? '' : Math.round(d.sales7)}`, `발주필요: ${need.length}`,
      `올릴키워드: ${a.up.length}`, `줄일키워드: ${a.down.length}`, `끌키워드: ${a.off.length}`, '---', '');
    L.push(`# 오늘 숫자 (${d.date})`, '', `> 마케팅 허브 대시보드에서 보냄. 다시 보내면 이 노트를 통째로 바꿉니다. 메모는 다른 노트에 쓰세요.`, '');
    L.push('## 요약', noSales ? '- 최근 7일 매출(카페24): **판매 리포트 없음** — 0원이 아니라 아직 안 들어옴 (Aside 업로드 확인)' : `- 최근 7일 매출(카페24): **${n(d.sales7)}원** (전주 대비 ${pctTxt})`,
      `- 발주 필요: **${need.length}개**${noStock ? ' (재고 리포트 없음)' : ''} · 끌 키워드 ${a.off.length} · 줄일 키워드 ${a.down.length} · 올릴 키워드 ${a.up.length} (최근 ${d.adsDays}일${noAds ? ' · 광고 리포트 없음' : ''})`, '');
    L.push('## 🔴 발주 필요 — [[레오]]');
    if (need.length) {
      L.push('| 제품코드 | 상품 | 가용재고 | 일평균 | 남은 일수 | 발주 수량 |', '|---|---|--:|--:|--:|--:|');
      for (const r of need) L.push(`| ${cell(r.productCode)} | ${cell(r.productName)} | ${n(r.available)} | ${r.avgDailySales} | ${r.daysLeft}일 | ${n(r.reorderQty)} |`);
    } else L.push('- 없음');
    L.push('');
    const kw = (title, list) => {
      L.push(`### ${title} ${list.length}`);
      if (!list.length) { L.push('- 없음', ''); return; }
      list.slice(0, 20).forEach((k, i) => L.push(`${i + 1}. **${cell(k.keyword)}** (${cell((channelOf(k.channel) || { label: k.channel }).label)}${k.campaign ? ' · ' + cell(k.campaign) : ''}) — ${cell(k.reason)} · 비용 ${n(k.cost)} · 전환매출 ${n(k.revenue)}`));
      L.push('');
    };
    L.push('## 🔎 키워드 — [[케이]]');
    kw('✂️ 끌 키워드', a.off); kw('⬇️ 줄일 키워드', a.down); kw('⬆️ 올릴 키워드', a.up);
    L.push('## 🛒 제품별 판매 (최근 7일, 상위 30)');
    if (d.sales.length) {
      L.push('| 제품코드 | 상품 | 7일 수량 | 7일 매출 | 전주 수량 |', '|---|---|--:|--:|--:|');
      for (const r of d.sales.slice(0, 30)) L.push(`| ${cell(r.code)} | ${cell(r.name)} | ${n(r.q7)} | ${n(r.r7)} | ${n(r.qp)} |`);
    } else L.push('- 판매 리포트 없음');
    L.push('');
    if (d.voc) { // 고객의 소리 (개인정보는 저장 때 이미 가림) — 온유가 읽음
      const v = d.voc;
      L.push(`## 🗣 고객의 소리 — [[온유]] (최근 7일 ${v.total}건 · 안 끝난 것 ${v.open})`);
      if (v.urgentItems.length || v.repeated.length) {
        L.push('### 🚨 급함');
        for (const x of v.urgentItems) L.push(`- ${cell(x.date)} **${cell(x.product)}** 하자·안전 — ${cell(x.text)}`);
        for (const x of v.repeated) L.push(`- **${cell(x.product)}** ${cell(x.type)} ${x.count}건 (7일 안 같은 이야기)`);
        L.push('');
      }
      const rows = (d.vocList || []).slice(0, 60);
      if (rows.length) {
        L.push('| 날짜 | 제품 | 종류 | 들은 곳 | 내용 | 끝남 |', '|---|---|---|---|---|---|');
        for (const x of rows) L.push(`| ${cell(x.date)} | ${cell(x.product)} | ${cell(x.type)} | ${cell(x.source)} | ${cell(x.text)} | ${x.resolved ? '✅' : ''} |`);
      } else L.push('- 메모 없음');
      L.push('');
    }
    return L.join('\n');
  }
  /* ── 오늘 숫자 계산 — 대시보드 화면 · [옵시디언으로 보내기] · scripts/mkt-numbers(매일 06:10 → AI 팀이 GitHub 볼트에 저장)가 같이 씀 (2026-10-12) ── */
  const DEFAULT_SETTINGS = { defaultLeadTimeDays: 7, safetyDays: 7, windowDays: 14, roasLow: 200, roasHigh: 400, minCost: 10000, minClicks: 10, adsDays: 7 };
  // 상품별 가장 최근 재고 → 지금 판매 기록으로 다시 계산 (발주 필요 먼저 · 남은 일수 적은 순)
  function stockRows(stock, sales, settings) {
    const latest = new Map();
    for (const d of stock) { const k = d.productKey || d.productCode || d.productName; const p = latest.get(k); if (!p || d.reportDate > p.reportDate) latest.set(k, d); }
    return [...latest.values()].map((d) => ({ ...d, ...stockPlan(d, sales, settings) }))
      .sort((a, b) => (b.reorderNeeded - a.reorderNeeded) || ((a.daysLeft == null ? 1e9 : a.daysLeft) - (b.daysLeft == null ? 1e9 : b.daysLeft)));
  }
  // 제품별 최근 7일 · 그 전 7일
  function salesRows(sales, today) {
    const a = addDays(today, -7), b = addDays(today, -14), m = new Map();
    for (const s of sales) {
      const k = s.productCode || s.productName; const r = m.get(k) || { code: s.productCode, name: s.productName, q7: 0, r7: 0, qp: 0, rp: 0, ch: new Set() };
      if (!r.name && s.productName) r.name = s.productName;
      if (s.reportDate >= a) { r.q7 += s.qty || 0; r.r7 += s.revenue || 0; r.ch.add(s.channel); } else if (s.reportDate >= b) { r.qp += s.qty || 0; r.rp += s.revenue || 0; }
      m.set(k, r);
    }
    return [...m.values()].sort((x, y) => y.r7 - x.r7 || y.q7 - x.q7);
  }
  // 어제까지 14일 날짜별 매출
  function dailyRevenue(sales, today) {
    const days = []; for (let i = 14; i >= 1; i--) days.push(addDays(today, -i));
    const sum = Object.fromEntries(days.map((d) => [d, 0]));
    for (const s of sales) if (s.reportDate in sum) sum[s.reportDate] += s.revenue || 0;
    return days.map((d) => ({ d, v: sum[d] }));
  }
  // '05 오늘 숫자' 노트 한 장 — in: { sales, ads, stock, voc(날짜 최신순), settings, today }
  function numbersNote({ sales, ads, stock, voc, settings, today }) {
    const st = { ...DEFAULT_SETTINGS, ...(settings || {}) }, dr = dailyRevenue(sales, today);
    return obsidianNote({ date: today, sales7: dr.slice(7).reduce((a, x) => a + x.v, 0), salesPrev7: dr.slice(0, 7).reduce((a, x) => a + x.v, 0),
      stock: stockRows(stock, sales, st), advice: keywordAdvice(ads, st), sales: salesRows(sales, today), adsDays: st.adsDays,
      voc: vocSummary(voc, today), vocList: voc.filter((v) => v.date >= addDays(today, -6)),
      salesCount: sales.filter((x) => x.reportDate >= addDays(today, -14)).length, adsCount: ads.length, stockCount: stock.length });
  }
  // 허브 노트 끝에 한 번 붙이는 칸 (오늘 숫자 노트를 끼워 보여 줌)
  const OBSIDIAN_HUB_SECTION = `\n\n## 📊 오늘 숫자\n> 대시보드 [옵시디언으로 보내기]를 누르면 아래가 새 숫자로 바뀝니다.\n\n![[${OBSIDIAN_NOTE}]]\n`;
  function obsidianUri(vault, file, content, mode) { // mode: 'overwrite' | 'append'
    const q = [];
    if (vault) q.push('vault=' + encodeURIComponent(vault));
    q.push('file=' + encodeURIComponent(file), 'content=' + encodeURIComponent(content), mode === 'append' ? 'append=true' : 'overwrite=true');
    return 'obsidian://new?' + q.join('&');
  }

  /* ── 저장 위치 ──────────────────────────────────────────
     'open'   = pour-os/marketing-hub/<컬렉션> — 이미 게시된 공개 규칙(pour-os/{doc=**}) 안. 규칙 게시 없이 바로 씀(임시)
                → 주소를 아는 사람은 읽고 고칠 수 있음(그로홈 대시보드와 같은 수준). 그래서 원본 CSV 는 알아본 열만 저장
     'secure' = 최상위 mkt-<컬렉션> — firestore.rules '마케팅 허브' 게시 후. 업로더는 올리기만, 나머지는 관리자만
     ※ 규칙 게시(2026-10-12 월 예정) 뒤 STORE_MODE 를 'secure' 로 바꾸고 대시보드 설정 › [임시 저장소에서 옮기기] */
  const STORE_MODE = 'open';
  const OPEN_ROOT = ['pour-os', 'marketing-hub'];
  const OWNER_EMAILS = ['netformrnd@gmail.com']; // firestore.rules mktAdmin() 와 같게
  function storeMode(loc) { // 로컬 시험(localhost)에서만 ?mode=secure|open 로 바꿔 볼 수 있음
    try {
      const l = loc || (typeof location !== 'undefined' ? location : null);
      if (l && /^(localhost|127\.0\.0\.1)$/.test(l.hostname)) {
        const m = new URLSearchParams(l.search).get('mode');
        if (m === 'open' || m === 'secure') return m;
      }
    } catch (e) { console.error('[storeMode]', e); }
    return STORE_MODE;
  }
  function col(db, name, mode) {
    return mode === 'secure' ? db.collection(name) : db.collection(OPEN_ROOT[0]).doc(OPEN_ROOT[1]).collection(name);
  }
  /* ── AI 팀 (볼트 '00 팀 운영 설계' 2절 리듬과 같게 · 바꾸면 둘 다) ──────────
     runs: dow = 요일(0 일 ~ 6 토, 한국 시간) · dom = 날짜(숫자 또는 'last' 말일) · months = 그 달만 · every+anchor = N일마다
     live = Claude 루틴이 실제로 켜졌는지 (켜면 여기를 true 로 · 설정 순서 step) · 그 팀원 일 중 아직 안 켠 것은 run.off · admin = 관리자 전용(원가)
     2026-10-10 가동: 하루(매일 배분만) · 포리 · 에코 = 루틴 'AI 콘텐츠팀 아침' 평일 06:50 한 번에(하루 → 포리 → 에코 순서) · 시간도 06:50 (2026-10-12)
     2026-10-14 사장님 "포리, 하루, 에코는 없어야지" → 그 일은 B2C 크루 여름이 이어받음(아래 CREW_LIVE) · 세 팀원은 gone(목록·오늘·7일·자동 작업에서 빠짐 · 옛 결과 이름은 그대로) */
  const WEEKDAYS = [1, 2, 3, 4, 5];
  const TEAM = [
    { id: 'haru', no: '00', name: '하루', role: '팀장 · 총괄', step: 2, live: false, gone: 'yeoreum', runs: [
      { dow: WEEKDAYS, t: '06:50', what: '오늘 주제 배분 (블로그 3 · 숏폼 1 · 지식인 4)' },
      { dow: [1], t: '09:30', what: '주간 브리핑 · 이번 주 할 일', off: true },
      { dow: [5], t: '17:00', what: '주간 회고', off: true },
      { dom: 'last', t: '17:00', what: '월간 리포트', off: true },
      { dom: 'last', months: [3, 6, 9, 12], t: '17:30', what: '다음 분기 시즌 캘린더', off: true }] },
    { id: 'pori', no: '01', name: '포리', role: '콘텐츠 마케터', step: 2, live: false, gone: 'yeoreum', runs: [
      { dow: WEEKDAYS, t: '06:50', what: '공식 블로그 원고 3 · 사진 지정 · 제목 A/B' }] },
    { id: 'luna', no: '02', name: '루나', role: '영상 마케터', step: 4, live: false, runs: [
      { dow: WEEKDAYS, t: '08:00', what: '숏폼 대본 1 → 숏폼 스튜디오' },
      { dow: [3], t: '10:00', what: '메타 광고 소재 3종' }] },
    { id: 'teo', no: '03', name: '테오', role: 'AI 상세페이지 · 외주', step: 7, live: false, runs: [] },
    { id: 'noa', no: '04', name: '노아', role: '소싱·가격 (관리자 전용)', step: 7, live: false, admin: true, runs: [] },
    { id: 'tobi', no: '05', name: '토비', role: '런칭 일정 총괄', step: 7, live: false, runs: [] },
    { id: 'moka', no: '06', name: '모카', role: '제품마스터', step: 1, live: false, runs: [] },
    { id: 'leo', no: '07', name: '레오', role: '재고·발주', step: 6, live: false, runs: [
      { dow: [1], t: '08:30', what: '발주 초안' }] },
    { id: 'kei', no: '08', name: '케이', role: '검색광고', step: 6, live: false, runs: [
      { dow: [1], t: '09:00', what: '광고 판정 · 상품명·태그 최적화' },
      { dow: [5], t: '16:00', what: '순위 모니터링' }] },
    { id: 'daon', no: '09', name: '다온', role: '커뮤니티 답변', step: 3, live: false, runs: [
      { dow: WEEKDAYS, t: '08:30', what: '지식인 답변 4' }] },
    { id: 'sora', no: '10', name: '소라', role: '인플루언서', step: 6, live: false, runs: [
      { dow: [1], t: '10:00', what: '섭외 제안 10건 (DM·이메일)' },
      { dom: 1, t: '10:30', what: '체험단 계획' }] },
    { id: 'roy', no: '11', name: '로이', role: '신제품 개발', step: 7, live: false, runs: [
      { dom: 1, t: '11:00', what: '불만 리뷰 · 경쟁사 정리' }] },
    { id: 'ria', no: '12', name: '리아', role: '리뷰·CS', step: 3, live: false, runs: [
      { dow: WEEKDAYS, t: '09:00', what: '댓글 대댓글 · 후기 답글 · 상품 Q&A' }] },
    { id: 'jay', no: '13', name: '제이', role: '프로모션', step: 6, live: false, runs: [
      { dow: [1], t: '10:00', what: '이번 주 행사 점검' },
      { dom: 20, t: '10:00', what: '다음 달 행사 준비' }] },
    { id: 'eco', no: '14', name: '에코', role: '재배포 편집', step: 2, live: false, gone: 'yeoreum', runs: [
      { dow: WEEKDAYS, t: '06:50', what: '티스토리 1 · 카페 1~2 (다시 쓴 버전)' }] },
    { id: 'nari', no: '15', name: '나리', role: '외주 원고', step: 6, live: false, runs: [
      { dow: [2, 5], t: '10:00', what: '외주 계정 글감·사진·가이드' }] },
    { id: 'onyu', no: '16', name: '온유', role: '고객 관리', step: 5, live: false, runs: [
      { dow: WEEKDAYS, t: '18:00', what: '고객의 소리 묶음 → 개선 제안' },
      { every: 14, anchor: '2026-10-12', t: '10:00', what: '리뷰 이벤트 당첨자 선정안' },
      { dom: 25, t: '10:00', what: 'NPS 분석' }] },
  ];
  // 크루 중 Claude 루틴이 실제로 도는 팀원 (2026-10-14 · 이름·역할 = crew.js CREWS · 크루 보드 결과는 crew.html)
  const CREW_LIVE = [
    { id: 'yeoreum', no: 'B2C', name: '여름', role: '노출마케터', crew: 'b2c', step: 2, live: true, runs: [
      { dow: WEEKDAYS, t: '06:50', what: '블로그 주제 3 → 공식 블로그 원고 3 → 티스토리·카페 재배포' }] },
  ];
  const teamMember = (id) => TEAM.find((m) => m.id === id || m.name === id) || CREW_LIVE.find((m) => m.id === id || m.name === id) || null;
  const teamShown = () => [...CREW_LIVE, ...TEAM.filter((m) => !m.gone)];   // 허브 '팀원' 칸 = 도는 크루 + 쉬지 않는 기본 AI 팀원
  const dowOf = (ymd) => new Date(ymd + 'T00:00:00Z').getUTCDay();
  const lastDom = (ymd) => { const d = new Date(ymd.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.getUTCDate(); };
  function runsOn(r, ymd) {
    const day = Number(ymd.slice(8, 10)), mon = Number(ymd.slice(5, 7));
    if (r.months && !r.months.includes(mon)) return false;
    if (r.dow) return r.dow.includes(dowOf(ymd));
    if (r.dom != null) return r.dom === 'last' ? day === lastDom(ymd) : day === r.dom;
    if (r.every) { const diff = Math.round((Date.parse(ymd) - Date.parse(r.anchor)) / 864e5); return diff >= 0 && diff % r.every === 0; }
    return false;
  }
  // 그날 도는 일 (시간순)
  function teamDay(ymd) {
    const out = [];
    teamShown().forEach((m, k) => { for (const r of m.runs) if (runsOn(r, ymd)) out.push({ id: m.id, name: m.name, role: m.role, live: m.live && !r.off, t: r.t, what: r.what, k }); });
    return out.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.k - b.k)); // 같은 시간이면 팀 순서 (06:50 여름 = 아침 루틴)
  }
  // 다음 차례 (now = { date:'YYYY-MM-DD', time:'HH:MM' } 한국 시간) — 정해진 일이 없으면 null
  function nextRun(m, now) {
    if (!m || !m.runs.length) return null;
    for (let i = 0; i < 400; i++) {
      const d = addDays(now.date, i);
      const hit = m.runs.filter((r) => runsOn(r, d) && (i > 0 || r.t > now.time)).sort((a, b) => (a.t < b.t ? -1 : 1))[0];
      if (hit) return { date: d, t: hit.t, what: hit.what };
    }
    return null;
  }
  const RUN_WORD = (r) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    let w;
    if (r.dow) w = r.dow.join() === WEEKDAYS.join() ? '평일' : r.dow.length === 7 ? '매일' : r.dow.map((x) => days[x]).join('·');
    else if (r.dom != null) w = `${r.months ? r.months.join('·') + '월 ' : '매월 '}${r.dom === 'last' ? '말일' : r.dom + '일'}`;
    else if (r.every) w = `${r.every}일마다`;
    return `${w} ${r.t}`;
  };
  /* ── 자동 작업 (트리거) — AI 팀 탭 '⏰ 자동 작업' (2026-10-12 사장님 "트리거 뭐뭐 설정해뒀는지 카테고리별로") ──
     AUTOMATIONS = 실제로 걸어 둔 것 (Claude 루틴 · GitHub 자동 작업 · 구글 캘린더 · Aside)
       ⚠️ 루틴·워크플로·캘린더를 만들거나 바꾸면 여기도 같이 고침 (README '자동 작업') — 화면은 이 목록만 봄
     계획 = TEAM 의 아직 안 켠 일(live false · off) → automations() 가 붙임
     status: on 동작 중 · wait 준비 중(설정 남음 · note) · plan 계획(팀원 일 · 아직 안 켬)
     run: TEAM 과 같은 모양(dow·dom·every + t) · ts = 하루 여러 번 · run 없으면 word 만 */
  const AUTO_CATS = [['content', '콘텐츠'], ['ads', '광고·행사'], ['stock', '재고·발주'], ['customer', '고객'], ['plan', '기획·보고'], ['data', '숫자·데이터'], ['ops', '백업·알림']];
  const AUTO_WHERE = { routine: 'Claude 루틴', actions: 'GitHub 자동 작업', calendar: '구글 캘린더', aside: 'Aside (회사 PC)' };
  const AUTO_STATUS = { on: '동작 중', wait: '준비 중', plan: '계획' };
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const AUTOMATIONS = [
    { id: 'ai-morning', name: 'AI 콘텐츠 아침 (여름 · B2C 크루)', cat: 'content', where: 'routine', run: { dow: WEEKDAYS, t: '06:50' }, members: ['yeoreum'], status: 'on',
      what: '오늘 숫자 받기 → 고칠 것(업무OS AI에게 다시 · 확정 규칙) → 여름: 주제 3 → 블로그 원고 3(표준 27칸) → 티스토리·카페 재배포 → GitHub 저장 → 업무OS AI 승인', ref: 'trig_01CmBYhzb9BGCv8DLX59kuGB' },   // 2026-10-14 하루·포리·에코 → 여름
    { id: 'numbers', name: '오늘 숫자 만들기', cat: 'data', where: 'actions', run: { dow: ALL_DAYS, t: '06:10' }, status: 'on', trace: 'numbers',
      what: '판매·광고·재고·고객의 소리 → 05 오늘 숫자 (원가 없음 · 대시보드와 같은 계산)', ref: 'mkt-numbers.yml' },
    { id: 'review-alarm', name: 'AI 콘텐츠 검토 알림', cat: 'ops', where: 'calendar', run: { dow: WEEKDAYS, t: '08:30' }, status: 'on',
      what: "구글 캘린더 '📝 AI 콘텐츠 검토' — 검토 대기 원고 보러 가기" },
    { id: 'usage', name: 'Firebase 사용량 · 10만 원 알림', cat: 'data', where: 'actions', run: { dow: ALL_DAYS, ts: ['00:17', '03:17', '06:17', '09:17', '12:17', '15:17', '18:17', '21:17'] }, status: 'wait', trace: 'usage',
      note: '서비스 계정 키·문자 번호·OPS_TOKEN 등록 후', what: '읽기·쓰기·예상 요금 → Firebase 사용량 화면 · 10만 원 넘으면 문자 · 월요일 9시 주간 보고', ref: 'firebase-usage.yml' },
    { id: 'backup', name: '데이터 전체 백업', cat: 'ops', where: 'actions', run: { dow: ALL_DAYS, t: '03:30' }, status: 'wait',
      note: '비공개 저장소 pour-backups 에 키 등록 후', what: 'pour-app-new 전체 → 비공개 저장소 pour-backups (바뀐 것만 · 지난 날은 기록으로)', ref: 'pour-backups/backup.yml' },
    { id: 'holidays', name: '공휴일 갱신', cat: 'ops', where: 'actions', run: { dom: 1, t: '09:17' }, status: 'on',
      what: '업무OS 기한 계산용 공휴일 목록 새로 받기', ref: 'holidays.yml' },
    { id: 'aside-upload', name: '광고·판매·재고 리포트 올리기', cat: 'data', where: 'aside', word: '매일 아침', status: 'wait',
      note: 'Aside 세팅 전 — 이게 돌아야 오늘 숫자가 채워짐', what: '카페24·쿠팡·네이버 광고·재고 리포트 → 대시보드 (upload.html)' },
    { id: 'aside-drafts', name: '글 임시저장', cat: 'content', where: 'aside', word: '맡긴 글이 있을 때', status: 'wait',
      note: 'Aside 세팅 전', what: '대시보드에서 맡긴 글 → 네이버 블로그·티스토리·카페 임시저장 (발행은 늘 사람 · drafts.html)' },
    { id: 'aside-crew', name: 'AI 크루 결과 올리기', cat: 'plan', where: 'aside', word: '보드마다 정한 때', status: 'wait',
      note: 'Aside 세팅 전 · 업무OS AI 팀원 담당 정한 뒤', what: '그로홈·POUR스토어 B2C 크루 보드(지표 · 할 일 A~E) 결과 → 업무OS AI 승인(담당 → 리드 → 본부장) · 실행은 사람 (crew.html)' },
  ];
  const MEMBER_CAT = { haru: 'plan', pori: 'content', luna: 'content', teo: 'content', noa: 'plan', tobi: 'plan', moka: 'data', leo: 'stock', kei: 'ads', daon: 'customer', sora: 'ads', roy: 'plan', ria: 'customer', jay: 'ads', eco: 'content', nari: 'content', onyu: 'customer' };
  function automations() {
    const out = AUTOMATIONS.map((a) => ({ ...a }));
    for (const m of TEAM) m.runs.forEach((r, i) => {
      if (m.gone || (m.live && !r.off)) return; // 켜진 일은 위 루틴이 함 · 쉬는 팀원(gone)은 크루가 이어받음
      out.push({ id: `plan-${m.id}-${i}`, name: `${m.name} · ${r.what}`, cat: MEMBER_CAT[m.id] || 'plan', where: 'routine', run: r, members: [m.id], status: 'plan',
        note: m.admin ? '관리자 전용' : `설정 ${m.step}순위`, what: `${m.role} — 아직 안 켬 (켜려면 Claude 에게 "${m.name} 루틴 켜 줘")` });
    });
    return out;
  }
  const autoWord = (a) => (a.word ? a.word : a.run && a.run.ts ? `${a.run.dow && a.run.dow.length === 7 ? '' : '평일 '}${24 / a.run.ts.length}시간마다` : a.run ? RUN_WORD(a.run) : '');
  // 다음 실행 (한국 시간) — 정해진 시간이 없으면 null
  function autoNext(a, now) {
    if (!a.run) return null;
    const ts = a.run.ts || [a.run.t];
    for (let i = 0; i < 400; i++) {
      const d = addDays(now.date, i);
      if (!runsOn(a.run, d)) continue;
      const t = ts.filter((x) => i > 0 || x > now.time).sort()[0];
      if (t) return { date: d, t };
    }
    return null;
  }
  function autoSummary(list) {
    const by = (k, v) => list.filter((a) => a[k] === v).length;
    return { total: list.length, on: by('status', 'on'), wait: by('status', 'wait'), plan: by('status', 'plan'),
      cats: AUTO_CATS.map(([id, label]) => ({ id, label, n: by('cat', id), set: list.filter((a) => a.cat === id && a.status !== 'plan').length })) };
  }
  function nowKST(now = new Date()) {
    const k = new Date(now.getTime() + 9 * 3600 * 1000).toISOString();
    return { date: k.slice(0, 10), time: k.slice(11, 16) };
  }

  /* ── 고객의 소리 (VOC) — 직원 메모 → 온유 ────────────────
     개인정보는 저장 전에 가림 (전화·이메일·주민번호·긴 숫자·동호수). 이름은 못 알아보므로 화면에서 '쓰지 않기' 안내 */
  const VOC_TYPES = ['불만', '문의', '요청', '칭찬', '하자·안전'];
  const VOC_SOURCES = ['전화', '채팅·톡', '게시판·리뷰', '현장·방문', '기타'];
  const VOC_URGENT_TYPE = '하자·안전';
  const VOC_REPEAT = 3; // 7일 안에 같은 제품·같은 종류가 이만큼 → 급함
  function maskPII(text) {
    let n = 0;
    const rep = (label) => () => { n++; return label; };
    let s = String(text == null ? '' : text);
    s = s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, rep('(이메일)'));
    s = s.replace(/\d{6}\s*-\s*[1-4]\d{6}/g, rep('(주민번호)'));
    s = s.replace(/\+?\d[\d\-.\s]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? (n++, '(번호)') : m));
    s = s.replace(/\d+\s*동\s*\d+\s*호/g, rep('(동호수)'));
    return { text: s, n };
  }
  function vocDoc(input) {
    const errors = [];
    const product = String(input.product || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const type = String(input.type || ''), source = String(input.source || '기타');
    const m = maskPII(String(input.text || '').replace(/\s+/g, ' ').trim());
    if (!product) errors.push('제품을 고르거나 적으세요.');
    if (!VOC_TYPES.includes(type)) errors.push('종류를 고르세요.');
    if (!VOC_SOURCES.includes(source)) errors.push('어디서 들었는지 고르세요.');
    if (m.text.length < 2) errors.push('내용을 한 줄 적으세요.');
    if (m.text.length > 300) errors.push('내용은 300자까지입니다.');
    if (errors.length) return { ok: false, errors };
    return { ok: true, errors: [], masked: m.n, doc: { product, type, source, text: m.text, masked: m.n, urgent: type === VOC_URGENT_TYPE } };
  }
  // 최근 days 일 요약 — list: [{id, date, product, type, text, resolved}]
  function vocSummary(list, today, days = 7) {
    const from = addDays(today, -(days - 1));
    const recent = list.filter((v) => v.date >= from && v.date <= today);
    const g = new Map();
    for (const v of recent) {
      const k = v.product + '|' + v.type;
      const x = g.get(k) || { key: k, product: v.product, type: v.type, count: 0, open: 0, items: [] };
      x.count++; if (!v.resolved) x.open++; x.items.push(v); g.set(k, x);
    }
    const groups = [...g.values()].sort((a, b) => b.count - a.count || (a.product < b.product ? -1 : 1));
    const byType = Object.fromEntries(VOC_TYPES.map((t) => [t, recent.filter((v) => v.type === t).length]));
    const urgentItems = list.filter((v) => v.type === VOC_URGENT_TYPE && !v.resolved);
    const repeated = groups.filter((x) => x.count >= VOC_REPEAT && x.open > 0 && x.type !== '칭찬');
    return { from, total: recent.length, open: recent.filter((v) => !v.resolved).length, byType, top: groups.slice(0, 5), groups, urgentItems, repeated };
  }

  /* ── 업무OS 다리 (pour-os/v2/links · CRM 다리와 같은 모양 · 개인정보·내용 안 보냄) ──
     src 'mkt' · kind 'aiReview' (Claude 팀원 결과 검토 — marketing-hub/tools/team_link.py 가 씀 · member · note = 볼트 노트 경로 · url = 이 허브 #team)
                · kind 'voc' (고객의 소리 급함 — 대시보드·고객의 소리 화면이 씀) */
  const HUB_URL = 'https://pour-construction-form.pages.dev/marketing-hub/';
  function vocLinks(list, today) {
    const s = vocSummary(list, today), out = [], at = new Date().toISOString();
    for (const v of s.urgentItems) out.push({ id: 'mkt-voc-' + v.id, src: 'mkt', kind: 'voc', title: `${v.product} 하자·안전`, sub: '고객의 소리 · 바로 확인', date: v.date, time: '', owner: '', url: HUB_URL + '#voc', open: true, at });
    for (const x of s.repeated) out.push({ id: 'mkt-vocg-' + hash(x.key), src: 'mkt', kind: 'voc', title: `${x.product} ${x.type} ${x.count}건`, sub: `고객의 소리 · 최근 7일 같은 이야기`, date: today, time: '', owner: '', url: HUB_URL + '#voc', open: true, at });
    return out;
  }
  function obsidianOpenUri(vault, file) {
    return 'obsidian://open?' + (vault ? 'vault=' + encodeURIComponent(vault) + '&' : '') + 'file=' + encodeURIComponent(file);
  }

  /* ── 노트 본문 보기 (대시보드 [보기] · 옵시디언 마크다운 → 안전한 HTML) ──
     지원: 머리말(--- … ---)은 숨김 · # 제목 · 표 · 목록(- · 1. · 체크박스) · > 인용 · ``` 코드 · **굵게** · `코드` · [[링크|별칭]] · [글](http…) · [사진: …]
     모든 글자는 먼저 escape → 스크립트·태그는 글자로만 보임 */
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="wl">$2</span>')
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="wl">$1</span>')
      .replace(/\[사진:\s*([^\]]*)\]/g, '<span class="ph">📷 사진: $1</span>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  function mdLite(src) {
    let lines = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
    if (lines[0] === '---') { const e = lines.indexOf('---', 1); if (e > 0) lines = lines.slice(e + 1); }
    const out = []; let i = 0;
    const P = '\u0001'; // 표 칸 안의 [[이름|별칭]] · \| 는 칸 나눔이 아님
    const cells = (l) => l.replace(/\[\[[^\]]*\]\]/g, (w) => w.replace(/\\?\|/g, P)).replace(/\\\|/g, P).trim().replace(/^\||\|$/g, '').split('|')
      .map((c) => c.trim().split(P).join('|'));
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push('<pre>' + esc(buf.join('\n')) + '</pre>'); continue; }
      let m = l.match(/^(#{1,6})\s+(.*)$/);
      if (m) { const n = Math.min(6, m[1].length + 1); out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
      if (/^\s*\|/.test(l)) {
        const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const body = rows.filter((r) => !(/^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes('-')));
        const [h, ...rest] = body, hc = h ? cells(h) : [];
        out.push('<div class="tbl"><table class="rt"><thead><tr>' + hc.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
          + rest.map((r) => '<tr>' + cells(r).map((c, k) => `<td data-l="${esc(hc[k] || '')}">${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push('<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>'); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const ol = /^\s*\d+\./.test(l), buf = [], same = ol ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
        while (i < lines.length && same.test(lines[i])) {
          let t = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
          const ck = t.match(/^\[([ xX])\]\s*(.*)$/);
          buf.push(ck ? `<li class="ck">${ck[1].trim() ? '☑' : '☐'} ${inline(ck[2])}</li>` : `<li>${inline(t)}</li>`);
        }
        out.push(ol ? '<ol>' + buf.join('') + '</ol>' : '<ul>' + buf.join('') + '</ul>'); continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      m = l.match(/^\s*\[사진:\s*([^\]]*)\]\s*$/);
      if (m) { out.push(`<div class="phb"><span class="phi">📷</span><span>${esc(m[1])}</span></div>`); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*\||\s*([-*]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++]);
      if (!buf.length) { buf.push(lines[i++]); }
      out.push('<p>' + buf.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  /* ── 노트 → 보기 좋게 나누기 (대시보드 [보기] · 2026-10-11 사장님 'UX 개선 · 실제 올리기 전 화면처럼') ──
     noteParts: 머리말 빼고 · 맨 위 '# 제목' + 인용(안내) · '## 요청 내용/입력 자료/체크' = 작성 근거(접어 둠) · 나머지 = 본문
     parsePosts: 본문에서 게시물(제목 줄이 있는 ##/### 칸)을 꺼냄 → 채널별 미리보기 · 임시저장 맡기기 */
  const META_SECTIONS = ['요청 내용', '입력 자료', '체크', '근거', '참고', '검색 의도', '제품 정보', '기획'];
  function noteParts(src) {
    let lines = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
    const props = {};
    if (lines[0] === '---') { const e = lines.indexOf('---', 1); if (e > 0) { lines.slice(1, e).forEach((l) => { const m = l.match(/^([^:]+):\s*(.*)$/); if (m) props[m[1].trim()] = m[2].trim(); }); lines = lines.slice(e + 1); } }
    let title = '', i = 0; const lead = [];
    while (i < lines.length && !/^##\s/.test(lines[i])) {
      const l = lines[i++]; const m = l.match(/^#\s+(.*)$/);
      if (m) title = m[1].trim(); else if (/^>\s?/.test(l)) lead.push(l.replace(/^>\s?/, '')); else if (l.trim()) lead.push(l);
    }
    const meta = [], main = [];
    let cur = null;
    for (; i < lines.length; i++) {
      const l = lines[i], m = l.match(/^##\s+(.*)$/);
      if (m) cur = META_SECTIONS.some((k) => m[1].trim().startsWith(k)) ? meta : main;
      if (m && /^결과물\s*$/.test(m[1].trim())) continue; // '결과물' 머리는 빼고 내용만
      (cur || main).push(l);
    }
    return { props, title, lead, meta: meta.join('\n').trim(), main: main.join('\n').trim() };
  }
  const CHANNEL = { naver_blog: '네이버 블로그', tistory: '티스토리', cafe: '네이버 카페', insta: '인스타그램', kin: '지식인', other: '게시물' };
  function channelOfHeading(h, member) {
    if (/티스토리/.test(h)) return 'tistory';
    if (/카페/.test(h)) return 'cafe';
    if (/인스타/.test(h)) return 'insta';
    if (/지식인/.test(h)) return 'kin';
    if (/블로그/.test(h)) return 'naver_blog';
    return member === 'pori' || member === 'yeoreum' ? 'naver_blog' : 'other';   // 블로그 원고 노트(예전 포리 → 2026-10-14 여름)는 채널 이름이 없으면 네이버 블로그
  }
  const TITLE_RE = /^\*\*제목(?:\s*([AB])안)?\*\*\s*[:：]\s*(.+)$/;
  function parsePosts(mainMd, member) {
    const lines = String(mainMd || '').split('\n'), heads = [];
    lines.forEach((l, i) => { const m = l.match(/^(#{2,3})\s+(.*)$/); if (m) heads.push({ i, level: m[1].length, text: m[2].trim() }); });
    const posts = [], used = new Set();
    // 게시물 머리 = 바로 아래(다음 머리 전)에 '**제목…**:' 줄이 있는 머리 · 게시물 칸 = 같은/윗 단계 머리나 다음 게시물 머리 전까지
    const isPost = heads.map((h, k) => lines.slice(h.i + 1, k + 1 < heads.length ? heads[k + 1].i : lines.length).some((l) => TITLE_RE.test(l.trim())));
    heads.forEach((h, k) => {
      if (!isPost[k]) return;
      let end = lines.length;
      for (let j = k + 1; j < heads.length; j++) if (heads[j].level <= h.level || isPost[j]) { end = heads[j].i; break; }
      const sec = lines.slice(h.i + 1, end);
      for (let x = h.i; x < end; x++) used.add(x);
      const post = { n: posts.length + 1, heading: h.text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1'),
        products: [...h.text.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1]), channel: channelOfHeading(h.text, member),
        title: '', titleB: '', tags: [], thumbs: [], notice: '', memo: '', body: '' };
      const body = []; let inThumb = false;
      for (const raw of sec) {
        const l = raw.trim(); let m;
        if ((m = l.match(TITLE_RE))) { if (m[1] === 'B') post.titleB = m[2].trim(); else post.title = m[2].trim(); inThumb = false; continue; }
        if ((m = l.match(/^\*\*채널\*\*\s*[:：]\s*(.+)$/))) { const c = Object.keys(CHANNEL).find((k) => CHANNEL[k] === m[1].trim()); if (c) post.channel = c; continue; }
        if ((m = l.match(/^\*\*(?:해시)?태그\*\*\s*[:：]\s*(.+)$/))) { post.tags = (m[1].match(/#[^\s#]+/g) || []); inThumb = false; continue; }
        if (/^\*\*썸네일[^*]*\*\*/.test(l)) { inThumb = true; const t = l.replace(/^\*\*썸네일[^*]*\*\*\s*[:：]?\s*/, ''); if (t) post.thumbs.push(t); continue; }
        if (inThumb) { if ((m = l.match(/^(?:[-*]|\d+\.)\s+(.*)$/))) { post.thumbs.push(m[1].replace(/^["“]|["”]$/g, '')); continue; } if (!l) continue; inThumb = false; }
        if ((m = l.match(/^>\s*\**(카페 규정[^*]*)\**\s*$/))) { post.notice = m[1].trim(); continue; }
        if (/^>\s*(⚠️|\**검토|\**메모)/.test(l)) { post.memo = (post.memo ? post.memo + '\n' : '') + l.replace(/^>\s?/, ''); continue; } // 팀원 내부 메모 = 게시 글에 안 넣음
        body.push(raw);
      }
      post.body = body.join('\n').replace(/^\s+|\s+$/g, '');
      posts.push(post);
    });
    // 게시물이 아닌 나머지(검토 메모 등)는 그대로 보여 줌
    const rest = lines.filter((_, i) => !used.has(i)).join('\n').trim();
    return { posts, rest };
  }
  // 편집기에 붙여 넣을 글 (마크다운 기호 없이 · 사진 자리는 [사진: …] 그대로 → 사람이 사진 넣음)
  function postPlain(md) {
    return String(md || '').split('\n').map((l) => l
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s?/, '')
      .replace(/^\s*\|?[\s:|-]+\|?\s*$/, (x) => (x.includes('-') ? '' : x))
      .replace(/^\s*\|(.*)\|\s*$/, (_, x) => x.split('|').map((c) => c.trim()).join(' · '))
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
      .replace(/^\s*\[(?:링크|버튼)\s*[:：]\s*(.+?)\s*(?:→|->)\s*(https?:\/\/\S+)\s*\]\s*$/, '$1\n$2')
      .replace(/^\s*\[(?:링크|버튼)\s*[:：]\s*(.+?)\s*(?:→|->)\s*(?:tel:)?\s*((?:0\d{1,2}-?\d{3,4}-?\d{4}|1[5-9]\d{2}-?\d{4}))\s*\]\s*$/, '$1\n📞 $2'))
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── 게시 글 칸 (2026-10-11 사장님 '블로그 포스팅 레이아웃 고도화' · 볼트 [[00 블로그 글 표준]] · 기준 글 blog.naver.com/pourstore/223879157471) ──
     원고 한 줄이 아래 모양이면 미리보기에서 실제 글처럼 보여 줌 (나머지는 mdLite 그대로):
       [썸네일: 메인 「…」 / 서브 「…」 / 구도 …]   → 대표 썸네일 시안
       > "고객 말"                                → 말풍선 (따옴표로 시작하는 인용 줄 하나 = 말풍선 하나)
       > 그 밖의 인용                             → 인용구 상자
       [사진: 유형 02 시공전 — 무엇을 · 어떤 구도로] · (사진 - …) · (사진3) → 번호 붙은 사진 자리 · '고정 …' = 늘 쓰는 이미지(후기·쇼룸·상담 배너)
       [링크: 라벨 → https://…]                   → 링크 카드 · 주소가 없으면 '주소 확인 필요'
       [링크: 1:1 맞춤 시공 상담 → 1800-8203]      → 전화 카드 (주소 대신 전화번호 · 2026-10-12 사장님)
       ### 소제목 · --- 구분선 */
  const THUMB_RE = /^\s*[[(](?:대표\s*)?썸네일\s*[:：\-—]\s*(.*?)\s*[\])]\s*$/;
  const PHOTO_RE = /^\s*(?:\[사진\s*\d*\s*[:：]\s*([^\]]*)\]|\(사진\s*\d*\s*(?:[-—:：]\s*(.*?))?\s*\))\s*$/;
  const LINK_RE = /^\s*\[(?:링크|버튼)\s*[:：]\s*(.+?)\s*(?:→|->)\s*(.*?)\s*\]\s*$/;
  const BUBBLE_RE = /^["“'‘「]/;
  const PHONE_RE = /^(?:tel:)?\s*(0\d{1,2}-?\d{3,4}-?\d{4}|1[5-9]\d{2}-?\d{4})$/; // 1800-8203 · 02-123-4567 · 010-…
  // 사진 설명 → { kind: '02 시공전' | '고정' | '', text }
  function photoParts(d) {
    let t = String(d || '').trim(), kind = '', m;
    if ((m = t.match(/^유형\s*(\d{1,2})\s*([^\s—\-:]*)\s*[—\-:]?\s*/))) { kind = (m[1].padStart(2, '0') + ' ' + m[2]).trim(); t = t.slice(m[0].length); }
    else if ((m = t.match(/^고정\s*[—\-:]?\s*/))) { kind = '고정'; t = t.slice(m[0].length); }
    return { kind, text: t.trim() };
  }
  function postBlocks(body) {
    const lines = String(body || '').replace(/\r/g, '').split('\n'), out = [];
    let buf = [], bufAt = 0, photo = 0, pos = 0;
    const flush = () => { if (buf.some((l) => l.trim())) out.push({ t: 'md', md: buf.join('\n').replace(/^\s*\n|\n\s*$/g, ''), pos: bufAt }); buf = []; };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; let m;
      const at = pos; pos += l.length + 1;
      if ((m = l.match(THUMB_RE))) { flush(); const q = [...m[1].matchAll(/「([^」]+)」/g)].map((x) => x[1]); out.push({ t: 'thumb', main: q[0] || '', sub: q[1] || '', text: m[1], pos: at }); continue; }
      if ((m = l.match(PHOTO_RE))) { flush(); out.push({ t: 'photo', n: ++photo, ...photoParts(m[1] != null ? m[1] : (m[2] || '')), pos: at }); continue; }
      if ((m = l.match(LINK_RE))) {
        flush(); const ph = m[2].match(PHONE_RE), url = /^https?:\/\/\S+$/.test(m[2]) ? m[2] : '';
        out.push(ph ? { t: 'link', label: m[1], url: '', tel: ph[1], pos: at } : { t: 'link', label: m[1], url, note: url ? '' : (m[2] || '주소 확인 필요'), pos: at }); continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { flush(); out.push({ t: 'hr', pos: at }); continue; }
      if ((m = l.match(/^(#{2,4})\s+(.*)$/))) { flush(); out.push({ t: 'h', text: m[2], pos: at }); continue; }
      if (/^>\s?/.test(l)) {
        flush(); const q = [l.replace(/^>\s?/, '')];
        while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) { i++; q.push(lines[i].replace(/^>\s?/, '')); pos += lines[i].length + 1; }
        let box = [];
        const flushBox = () => { if (box.some((x) => x.trim())) out.push({ t: 'quote', lines: box, pos: at }); box = []; };
        for (const x of q) { if (BUBBLE_RE.test(x.trim())) { flushBox(); out.push({ t: 'bubble', text: x.trim(), pos: at }); } else box.push(x); }
        flushBox(); continue;
      }
      if (!buf.length) bufAt = at;
      buf.push(l);
    }
    flush();
    return out;
  }
  // 미리보기 HTML (대시보드 [보기] · 작업대) — 모든 글자는 escape
  function postHtml(body) {
    return postBlocks(body).map((b) => {
      if (b.t === 'md') return mdLite(b.md);
      if (b.t === 'thumb') return `<figure class="pv-thumb"><div class="pv-thumb-in">${b.main ? `<b>${esc(b.main)}</b>` : '<b>대표 썸네일</b>'}${b.sub ? `<span>${esc(b.sub)}</span>` : ''}</div><figcaption><em>대표 썸네일 시안</em> ${esc(b.text.replace(/(메인|서브)\s*(문구)?\s*[:：]?\s*「[^」]*」\s*\/?\s*/g, '').trim())}</figcaption></figure>`;
      if (b.t === 'photo' && b.kind === '고정') return `<figure class="pv-ph fix"><div class="pv-ph-in"><span class="pv-ph-n">📷 사진 ${b.n}</span><span class="pv-ph-k">고정 이미지</span><b>${esc(b.text)}</b></div></figure>`; // 늘 쓰는 이미지(후기·쇼룸·상담 배너) — 사람이 넣음
      if (b.t === 'photo') return `<figure class="pv-ph"><div class="pv-ph-in"><span class="pv-ph-n">📷 사진 ${b.n}</span>${b.kind ? `<span class="pv-ph-k">유형 ${esc(b.kind)}</span>` : ''}</div><figcaption>${esc(b.text) || '<i>장면 설명 없음</i>'}</figcaption></figure>`;
      if (b.t === 'link' && b.tel) return `<a class="pv-link tel" href="tel:${esc(b.tel.replace(/-/g, ''))}"><b>${inline(b.label)}</b><span>📞 ${esc(b.tel)}</span><i>›</i></a>`;
      if (b.t === 'link') return b.url ? `<a class="pv-link" href="${esc(b.url)}" target="_blank" rel="noopener"><b>${inline(b.label)}</b><span>${esc(b.url.replace(/^https?:\/\//, '').split('/')[0])}</span><i>›</i></a>`
        : `<div class="pv-link no"><b>${inline(b.label)}</b><span>⚠️ ${esc(b.note)}</span></div>`;
      if (b.t === 'hr') return '<hr class="pv-hr">';
      if (b.t === 'h') return `<h3 class="pv-h">${inline(b.text)}</h3>`;
      if (b.t === 'bubble') return `<div class="pv-bub">${inline(b.text)}</div>`;
      if (b.t === 'quote') return `<blockquote class="pv-q">${b.lines.map(inline).join('<br>')}</blockquote>`;
      return '';
    }).join('\n');
  }
  // 편집기에 붙일 서식 글 (복사 · Aside) — 사진·썸네일 자리는 [ ] 글자 그대로(사람이 사진으로 바꿈) · 링크는 라벨 + 주소
  function pasteHtml(body, opt) {
    const al = opt && opt.center ? ' style="text-align:center"' : '';
    const p = (h) => `<p${al}>${h}</p>`;
    return postBlocks(body).map((b) => {
      if (b.t === 'md') return b.md.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => (/^\s*([-*]|\d+\.)\s|^\s*\|/.test(x) ? mdLite(x) : p(x.split('\n').map(inline).join('<br>')))).join('');
      if (b.t === 'thumb') return p(esc(`[대표 썸네일: ${b.text}]`));
      if (b.t === 'photo') { const d = `${b.kind ? (b.kind === '고정' ? '고정 ' : '유형 ' + b.kind + (b.text ? ' — ' : '')) : ''}${b.text}`; return p(esc(`[사진 ${b.n}${d ? ': ' + d : ''}]`)); }
      if (b.t === 'link' && b.tel) return p(`<b>${inline(b.label)}</b><br>📞 ${esc(b.tel)}`);
      if (b.t === 'link') return b.url ? p(`<b>${inline(b.label)}</b><br><a href="${esc(b.url)}">${esc(b.url)}</a>`) : p(esc(`[링크: ${b.label} → ${b.note}]`));
      if (b.t === 'hr') return '<hr>';
      if (b.t === 'h') return `<h3${al}>${inline(b.text)}</h3>`;
      if (b.t === 'bubble' || b.t === 'quote') return `<blockquote${al}>${(b.t === 'bubble' ? [b.text] : b.lines).map(inline).join('<br>')}</blockquote>`;
      return '';
    }).join('\n');
  }
  /* 글 구조 검사 (네이버 블로그 · 볼트 [[00 블로그 글 표준]] 최종 목차) — 사람이 볼 표시만, 막지 않음
     level: ok ✅ · warn ⚠️(사람 확인) · bad ❌(표준 순서에서 빠짐) */
  const RISKY_RE = /완벽|반영구|영구적|평생|국내\s*1위|업계\s*1위|최고의?|100\s*%|무조건|절대(?:로)?\s*(?:안|새지|깨지)/g;
  const NUM_CHECK_RE = /\d+(?:\.\d+)?\s*배|\d+\s*mm\s*이상|(?:특허|협력사|파트너사?)\s*\d|\d[\d,]*\s*(?:여\s*)?(?:개|곳|건)\s*(?:의\s*)?(?:특허|협력사|파트너)/g;
  function blogCheck(post) {
    if (!post || post.channel !== 'naver_blog') return null;
    const body = String(post.body || ''), bl = postBlocks(body), len = Math.max(1, body.length), items = [];
    const add = (k, level, msg) => items.push({ k, level, msg });
    const text = bl.filter((b) => b.t === 'md' || b.t === 'bubble' || b.t === 'quote').map((b) => b.md || b.text || b.lines.join(' ')).join('\n');
    const firstText = (text.split('\n').find((l) => l.trim()) || '').trim();
    add('greet', /^(안녕하세요|안녕하십니까|반갑습니다|여러분\s*안녕)/.test(firstText) ? 'bad' : 'ok', /^(안녕하세요|안녕하십니까|반갑습니다)/.test(firstText) ? '인사말로 시작 — 고객 말로 바로 시작' : '인사말 없이 시작');
    const thumb = bl.some((b) => b.t === 'thumb') || (post.thumbs || []).length > 0;
    add('thumb', thumb ? 'ok' : 'warn', thumb ? '대표 썸네일 지정' : '대표 썸네일 지정 없음 — [썸네일: 메인 「…」 / 서브 「…」 / 구도 …]');
    const firstH = bl.findIndex((b) => b.t === 'h' || b.t === 'link'), head = firstH < 0 ? bl : bl.slice(0, firstH);
    const bub = head.filter((b) => b.t === 'bubble').length;
    add('quotes', bub >= 2 ? 'ok' : bub === 1 ? 'warn' : 'bad', bub >= 2 ? `고객 말 ${bub}개로 시작` : `고객 말 인용 ${bub}개 — 맨 앞에 2개 (> "…")`);
    const links = bl.filter((b) => b.t === 'link'), fl = links[0], pct = (b) => Math.round((b.pos / len) * 100);
    if (!fl) add('early', 'bad', '구매 링크 없음 — 제품 추천 바로 뒤 [링크: 제품 구매 → 주소]');
    else add('early', pct(fl) <= 45 ? 'ok' : 'bad', pct(fl) <= 45 ? `제품 추천·1차 구매 링크가 앞쪽 (글의 ${pct(fl)}%)` : `첫 구매 링크가 늦음 (글의 ${pct(fl)}%) — 문제 제기 바로 뒤로`);
    const tail = links.filter((b) => b.pos / len >= 0.6).length, gh = /그로홈|grohome/i.test(post.heading || ''); // 그로홈 = 상담 창구 확인 전 → 구매 링크 하나면 됨 (표준 7절)
    add('cta', tail >= (gh ? 1 : 2) ? 'ok' : tail === 1 ? 'warn' : 'bad', tail >= (gh ? 1 : 2) ? `마지막 CTA ${tail}개 (${gh ? '구매' : '구매·상담'})` : `마지막 CTA ${tail}개 — 구매 + 1:1 상담 + 카카오톡 상담`);
    const ph = bl.filter((b) => b.t === 'photo'), thin = ph.filter((b) => b.kind !== '고정' && b.text.replace(/\s/g, '').length < 12);
    add('photos', !ph.length ? 'bad' : thin.length ? 'warn' : 'ok', !ph.length ? '사진 자리 없음' : thin.length ? `사진 ${ph.length}개 중 ${thin.length}개는 장면 설명이 짧음 (사진 ${thin.map((b) => b.n).join('·')}) — 무엇을 · 어떤 구도로` : `사진 ${ph.length}개 · 장면 설명 있음`);
    const steps = (body.match(/STEP\s*\d|^\s*\**\s*\d+\s*[.)]\s*\S/gim) || []).length;
    add('steps', steps >= 2 ? 'ok' : 'warn', steps >= 2 ? `시공·사용 순서 ${steps}단계` : '시공·사용 순서(STEP) 없음 — 시공형 제품이면 넣기');
    const tags = (post.tags || []).length;
    add('tags', tags >= 15 && tags <= 20 ? 'ok' : tags >= 10 && tags <= 25 ? 'warn' : 'bad', `해시태그 ${tags}개${tags >= 15 && tags <= 20 ? '' : ' — 15~20개'}`);
    const noUrl = links.filter((b) => !b.url && !b.tel).length;
    if (noUrl) add('url', 'warn', `링크 주소 확인 필요 ${noUrl}개`);
    const all = [post.title || '', post.titleB || '', text].join('\n');
    const risky = [...new Set(all.match(RISKY_RE) || [])], nums = [...new Set(all.match(NUM_CHECK_RE) || [])];
    if (risky.length) add('risky', 'warn', `과장 표현 확인: ${risky.join(' · ')}`);
    if (nums.length) add('nums', 'warn', `수치 근거 확인: ${nums.join(' · ')}`);
    const cnt = (lv) => items.filter((x) => x.level === lv).length;
    return { items, ok: cnt('ok'), warn: cnt('warn'), bad: cnt('bad') };
  }
  const POST_STATUS = { queued: 'Aside 대기', draft: '임시저장됨 — 발행해 주세요', published: '게시 완료', failed: '임시저장 실패' };
  const postId = (noteId, n) => `${noteId}~${n}`;
  // 임시저장(초안 저장)이 있는 채널만 Aside 에 맡김 · 지식인·인스타·그 밖은 사람이 복사해서 직접 등록 (실제 게시는 늘 사람 · 2026-10-11)
  const DRAFT_CH = ['naver_blog', 'tistory', 'cafe'];
  const canDraft = (ch) => DRAFT_CH.includes(ch);

  const isAdminEmail = (email, roles) => !!email && (OWNER_EMAILS.includes(email) || ((roles && roles.admins) || []).includes(email));
  const isUploaderEmail = (email, roles) => !!email && ((roles && roles.uploaders) || []).includes(email);
  const isStaffEmail = (email, roles) => !!email && ((roles && roles.staffs) || []).includes(email); // 직원: 고객의 소리 입력만

  const api = { STORE_MODE, OPEN_ROOT, OWNER_EMAILS, storeMode, col, isAdminEmail, isUploaderEmail, isStaffEmail,
    mdLite, noteParts, parsePosts, postPlain, postBlocks, postHtml, pasteHtml, blogCheck, photoParts, CHANNEL, POST_STATUS, postId, DRAFT_CH, canDraft, TEAM, CREW_LIVE, teamShown, teamMember, runsOn, teamDay, nextRun, RUN_WORD, nowKST, AUTO_CATS, AUTO_WHERE, AUTO_STATUS, AUTOMATIONS, automations, autoWord, autoNext, autoSummary, VOC_TYPES, VOC_SOURCES, VOC_URGENT_TYPE, VOC_REPEAT, maskPII, vocDoc, vocSummary, vocLinks, HUB_URL, obsidianOpenUri, CHANNELS, obsidianNote, obsidianUri, OBSIDIAN_NOTE, DEFAULT_SETTINGS, stockRows, salesRows, dailyRevenue, numbersNote, OBSIDIAN_HUB, OBSIDIAN_HUB_SECTION, FIELDS, channelOf, parseTable, toNumber, analyze, reducedCsv, buildDocs, hash, stockPlan, keywordAdvice, addDays, yesterdayKST, utf8Bytes, MAX_CSV_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MktCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
