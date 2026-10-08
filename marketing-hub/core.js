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
     in: { date, sales7, salesPrev7, stock:[stockRows], advice:keywordAdvice(), sales:[{code,name,q7,r7,qp}], adsDays } */
  const OBSIDIAN_NOTE = '05 오늘 숫자';
  const OBSIDIAN_HUB = '00 허브';
  function obsidianNote(d) {
    const cell = (v) => String(v == null ? '' : v).replace(/\|/g, '/').replace(/\n/g, ' ');
    const n = (v) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR'));
    const need = d.stock.filter((r) => r.reorderNeeded);
    const a = d.advice;
    const pctTxt = d.salesPrev7 > 0 ? `${d.sales7 >= d.salesPrev7 ? '▲' : '▼'}${Math.abs(Math.round((d.sales7 - d.salesPrev7) / d.salesPrev7 * 100))}%` : '-';
    const L = [];
    L.push('---', '유형: 숫자', `기준일: ${d.date}`, `매출7일: ${Math.round(d.sales7)}`, `발주필요: ${need.length}`,
      `올릴키워드: ${a.up.length}`, `줄일키워드: ${a.down.length}`, `끌키워드: ${a.off.length}`, '---', '');
    L.push(`# 오늘 숫자 (${d.date})`, '', `> 마케팅 허브 대시보드에서 보냄. 다시 보내면 이 노트를 통째로 바꿉니다. 메모는 다른 노트에 쓰세요.`, '');
    L.push('## 요약', `- 최근 7일 매출(카페24): **${n(d.sales7)}원** (전주 대비 ${pctTxt})`,
      `- 발주 필요: **${need.length}개** · 끌 키워드 ${a.off.length} · 줄일 키워드 ${a.down.length} · 올릴 키워드 ${a.up.length} (최근 ${d.adsDays}일)`, '');
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
    return L.join('\n');
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
  const isAdminEmail = (email, roles) => !!email && (OWNER_EMAILS.includes(email) || ((roles && roles.admins) || []).includes(email));
  const isUploaderEmail = (email, roles) => !!email && ((roles && roles.uploaders) || []).includes(email);

  const api = { STORE_MODE, OPEN_ROOT, OWNER_EMAILS, storeMode, col, isAdminEmail, isUploaderEmail, CHANNELS, obsidianNote, obsidianUri, OBSIDIAN_NOTE, OBSIDIAN_HUB, OBSIDIAN_HUB_SECTION, FIELDS, channelOf, parseTable, toNumber, analyze, reducedCsv, buildDocs, hash, stockPlan, keywordAdvice, addDays, yesterdayKST, utf8Bytes, MAX_CSV_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MktCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
