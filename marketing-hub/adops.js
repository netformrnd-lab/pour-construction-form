// 광고 운영 · AI 팀 매뉴얼 (허브 ads.html · ai-manual.html · 업무OS 링크 같이 씀 · 계산만 · 저장·Firebase 없음 · ES 모듈)
//   시험 node marketing-hub/adops.test.mjs
// 사용자 결정 2026-10-15 "광고 운영 내재화 + AI팀 매뉴얼 화면 (Aside 연동)":
//   · Aside 가 매일 08:30 메타·쿠팡·네이버 광고 일일 보고서 → pour-os/v2/adreports/{YYYY-MM-DD} {date, title, md, summary, offs(JSON 글), longtail(JSON 글 · 없을 수 있음), by:'aside', at}
//   · 매뉴얼 → pour-os/v2/aimanuals/{id} {id, title, md, src, at} (ad-ops-team · ad-ops-playbook)
//   · 두 경로는 Aside 전용 쓰기 — 화면은 읽기만 (pour-os-v2/CLAUDE.md)
//   · 운영 기준 = 데일리그로스 메타 운영 제안(2026.10.15): 메타 캠페인 3개 고정(신규 60 · 리타겟 10 · 테스트 30) · 금요일 판정(증액 350%+ 2주 +20% · 유지 200~350% · 종료 180% 미만 2주 · 구매 10건 전 보류)
//     쿠팡 롱테일 400~500% · 수익률 300% · 입찰 100원부터

export const HUB_ADS = 'https://pour-construction-form.pages.dev/marketing-hub/ads.html';
export const HUB_MANUAL = 'https://pour-construction-form.pages.dev/marketing-hub/ai-manual.html';

// 광고 AI팀 = B2C 크루 6명의 광고 몫 (매뉴얼 ad-ops-team 표와 같게 · 고치면 둘 다) — 제안서에 없는 분담 = 출처 [Aside 추가] (제안서 원래 역할 = PROPOSAL_ROLES)
export const AD_ROLES = {
  gaeul: { ad: '쿠팡·네이버 검색광고', when: '매일 08:30 보고서 · 월 1회 구조 재편안', does: '키워드 보고서 분석 · 롱테일 확정/후보 · 효율 없는 키워드 자동 OFF · 수동 캠페인 이동 제안 · 입찰 100원 원칙', exec: '쿠팡 구조 변경 = 본부장님 · 네이버 = 링크프라이스' },
  gyeoul: { ad: '메타 판정', when: '매일 08:30 · 금 16:00 판정', does: '7일·14일 ROAS · 구매 수 · 학습 상태 · 자사몰 MER · 효율 없는 메타 광고 자동 OFF · 금요일 증액/유지/종료 판정표', exec: '예산 변경 = 담당' },
  yeoreum: { ad: '메타 소재', when: '월 브리프 · 매일 슬롯 상태', does: '소재 테스트 슬롯 관리 · 새 앵글 2~3안 브리프 · 9:16·1:1 규격 · 지면(스토리·AN) 점검', exec: '디자인 마케터·담당' },
  haneul: { ad: '오퍼', when: '주 1회', does: '리타겟팅 오퍼(1+1·세트·가격 박스) 설계 · 객단가 추적', exec: '담당 (마진 확인 = 관리자)' },
  uju: { ad: '리타겟팅', when: '주 1회', does: '리타겟팅 세트 성과(장바구니·상세 30일 · 구매자 제외) 점검 · 구매자 제외 타겟 최신화', exec: '담당' },
  bom: { ad: '오늘의집 광고', when: '매일 10:00 (크루 보드)', does: '오늘의집 광고(오하우스애즈) ROAS 300% 기준 운영안', exec: '담당' },
};
// JSON 글 칸 읽기 (offs · longtail) — 없으면 {has:false} · 못 읽으면 {has:true, bad:true}
export function jsonField(v) {
  if (v == null || v === '') return { has: false, val: null };
  if (typeof v !== 'string') return { has: true, val: v };
  try { return { has: true, val: JSON.parse(v) }; } catch (e) { return { has: true, bad: true, val: null }; }
}
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim(); return ''; };
const MEDIA = [[/메타|meta|facebook|페이스북|인스타/i, '메타'], [/쿠팡|coupang/i, '쿠팡'], [/네이버|naver/i, '네이버'], [/오늘의집|ohou/i, '오늘의집']];
export const mediaL = (s) => { const x = String(s || ''); for (const [re, l] of MEDIA) if (re.test(x)) return l; return x; };
// 끈 것 한 줄 → {date, media, campaign, target, reason, action} (Aside 가 쓰는 열쇠 이름이 바뀌어도 읽게 · 글 한 줄이면 대상)
export function offRow(o, date) {
  if (o == null) return null;
  if (typeof o !== 'object') return { date, media: '', campaign: '', target: String(o), reason: '', action: 'OFF' };
  const d = pick(o, ['date', '날짜', 'day']);
  return { date: /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : date,
    media: mediaL(pick(o, ['media', 'channel', 'platform', '매체', '채널'])),
    campaign: pick(o, ['campaign', '캠페인', 'campaignName']),
    target: pick(o, ['target', '대상', 'keyword', '키워드', 'ad', '광고', 'adset', '광고세트', 'name', 'item']),
    reason: pick(o, ['reason', '근거', 'why', 'basis', 'rule', '규칙', 'metric']),
    action: pick(o, ['action', '조치', 'act', 'result', '결과']) || 'OFF' };
}
// 보고서 하나의 끈 것 (offs 가 배열 · {items|offs|list: 배열} 모두)
export function offsOf(rep) {
  const f = jsonField(rep && rep.offs); if (!f.has || f.bad) return { has: f.has, bad: !!f.bad, rows: [] };
  const v = f.val, arr = Array.isArray(v) ? v : v && typeof v === 'object' ? (v.items || v.offs || v.list || v.rows || []) : [];
  return { has: true, bad: false, rows: (Array.isArray(arr) ? arr : []).map((o) => offRow(o, rep.date || '')).filter(Boolean) };
}
// 새 롱테일 수 — 배열 = 길이 · {new|added|신규 …} = 그 수 · 없으면 null(카드 숨김)
export function longtailCount(rep) {
  const f = jsonField(rep && rep.longtail); if (!f.has || f.bad) return null;
  const v = f.val, n = (x) => (Array.isArray(x) ? x.length : typeof x === 'number' ? x : null);
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') for (const k of ['new', 'added', 'newCount', '신규', '새', '새 롱테일', 'confirmed', '확정']) { const x = n(v[k]); if (x != null) return x; }
  return null;
}
// 날짜 (YYYY-MM-DD · 한국 날짜 글) — 이번 주 = 월요일 시작
const dt = (s) => new Date(s + 'T00:00:00Z');
export const weekStart = (s) => { const d = dt(s), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };
export const monthOf = (s) => String(s || '').slice(0, 7);
// 보고서 최신순 (날짜 글 비교 · Firestore orderBy 안 씀)
export const sortReports = (reps) => [...(reps || [])].filter((r) => r && r.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
// 모든 보고서의 끈 것 → 최신순 줄 + 주간·월간 개수
export function offLog(reps, today) {
  const rows = []; let has = false;
  sortReports(reps).forEach((r) => { const x = offsOf(r); if (x.has && !x.bad) has = true; rows.push(...x.rows); });
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const wk = new Map(), mo = new Map();
  rows.forEach((r) => { if (!r.date) return; const w = weekStart(r.date), m = monthOf(r.date); wk.set(w, (wk.get(w) || 0) + 1); mo.set(m, (mo.get(m) || 0) + 1); });
  const tw = today ? weekStart(today) : '', tm = today ? monthOf(today) : '';
  return { has, rows, thisWeek: wk.get(tw) || 0, thisMonth: mo.get(tm) || 0,
    weeks: [...wk.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([w, n]) => ({ w, n })),
    months: [...mo.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([m, n]) => ({ m, n })) };
}
// 위 카드 (최신 보고서 요약 · 이번 주 끈 것 · 새 롱테일) — 칸이 없으면 null = 숨김
export function topCards(reps, today) {
  const s = sortReports(reps), last = s[0] || null, log = offLog(s, today);
  return { last, summary: last ? String(last.summary || '') : '', offsWeek: log.has ? log.thisWeek : null, longtail: last ? longtailCount(last) : null };
}
// 주 이름 '10/12 주'
export const weekL = (w) => `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))} 주`;

// ── 제안서 검증 (2026-10-15 사장님 "진짜 목적은 데일리그로스 「넷폼_메타운영_제안서_202610」이 정답인지 실제 운영 데이터로 검증") ──
//   데이터 pour-os/v2/proposal/dailygrowth-202610 {title, at, by, json(JSON 글: baseline · structure · hypotheses[H1~H6] · gaps_20261015 · source_rule)} — Aside 가 매일 갱신 · 읽기만
//   칸이 문서 바로 아래(baseline 등 · JSON 글이어도)에 있어도 읽음 · roles · rules · pages 가 오면 기본값 대신 그것
// 출처 배지 3종 — 모든 규칙·매뉴얼 표시에 붙임
export const SRC = { P: '제안서', K: '김송희 관리방안', A: 'Aside 추가' };
export const srcKind = (s) => (/제안서/.test(s) ? 'p' : /김송희|관리방안/.test(s) ? 'k' : /aside/i.test(s) ? 'a' : 'x');
export const srcText = (src, page) => (src === SRC.P && page ? `${SRC.P} p${page}` : src || '');
// 글 안의 [제안서 p12] · [김송희 관리방안] · [Aside 추가] → 배지 (mdLite 로 escape 한 HTML 위에서 · 대괄호 글자만 바꿈)
export const SRC_TAG_RE = /\[(제안서(?:\s*p\.?\s*\d+(?:\s*[-~,]\s*\d+)?)?|김송희\s*관리방안|Aside\s*추가)\]/gi;
export const srcTags = (html) => String(html || '').replace(SRC_TAG_RE, (m, t) => `<span class="src s-${srcKind(t)}">${t.replace(/\s+/g, ' ')}</span>`);
export const countSrcTags = (md) => { const c = { p: 0, k: 0, a: 0 }; String(md || '').replace(SRC_TAG_RE, (m, t) => { const k = srcKind(t); if (c[k] != null) c[k]++; return m; }); return c; };

export const PROPOSAL_ID = 'dailygrowth-202610';
// 기준선 (제안서 · 문서가 비어도 보이게)
export const BASELINE_DEFAULT = { meta_roas_jan_sep: 205, meta_roas_sep: 286, meta_roas_target_dec: 350, mall_mer_jan_sep: 310, mall_mer_sep: 415 };
// 제안서의 원래 역할 (크루 분담은 제안서에 없음 = Aside 추가)
export const PROPOSAL_ROLES = [
  { who: '넷폼 퍼포먼스 마케터', does: '메타 일일 운영 · 금요일 판정', src: SRC.P },
  { who: '디자인 마케터 · 외주', does: '소재 제작', src: SRC.P },
  { who: '본부장', does: '예산 · 목표 결정', src: SRC.P },
  { who: '쿠팡 · 네이버', does: '쿠팡 = 본부장님 · 네이버 = 링크프라이스 운영 그대로 유지', src: SRC.P },
];
// 운영 규칙 (출처별) — 문서 rules 가 오면 그것 · 쪽수는 pages{structure, judge, live, coupang}
export const RULES_DEFAULT = [
  { k: 'structure', m: '메타', t: '캠페인 3개 고정 — ① 신규 판매 60% · ② 리타겟팅 10% · ③ 소재 테스트 30%', src: SRC.P },
  { k: 'judge', m: '메타', t: '금요일 판정 — 증액 350%+ 2주 → 예산 +20% · 유지 200~350% → 소재 1안 교체 · 종료 180% 미만 2주 → OFF · 구매 10건 전 보류', src: SRC.P },
  { k: 'coupang', m: '쿠팡', t: '수익률 300% · 롱테일 400~500% · 입찰 100원부터 · 키워드 보고서로 효율 없는 키워드 끄기', src: SRC.K },
  { k: 'autooff', m: '공통', t: '규칙 안 효율 없는 광고·키워드 자동 OFF 만 Aside 가 직접 (쿠팡 하루 20개 · 메타 3개까지) — 그 밖 실행은 사람', src: SRC.A },
];
const objOf = (v) => { const f = jsonField(v); return f.has && !f.bad ? f.val : null; };
export function parseProposal(doc) {
  if (!doc) return null;
  const j = objOf(doc.json) || {}, g = (k) => (doc[k] != null ? objOf(doc[k]) : null) ?? j[k];
  const pages = g('pages') || {};
  const rules = (Array.isArray(g('rules')) && g('rules').length ? g('rules') : RULES_DEFAULT).map((r) => ({ ...r, page: r.page || (r.k && pages[r.k]) || null }));
  const gapsKey = Object.keys({ ...j, ...doc }).filter((k) => /^gaps/.test(k)).sort().pop();
  return { title: doc.title || j.title || '', at: doc.at || j.at || '', by: doc.by || '',
    baseline: { ...BASELINE_DEFAULT, ...(g('baseline') || {}) }, structure: g('structure') || {},
    hypotheses: (g('hypotheses') || []).filter(Boolean), gaps: (gapsKey ? g(gapsKey) : []) || [], gapsAt: gapsKey ? (gapsKey.match(/(\d{8})/) || [])[1] || '' : '',
    roles: (Array.isArray(g('roles')) && g('roles').length ? g('roles') : PROPOSAL_ROLES), rules, sourceRule: g('source_rule') || '', actual: g('actual') || null };
}
export const HYP_STATUS = ['미시작', '진행', '통과', '미달', '보류'];
export const hypStatus = (s) => { const x = String(s || ''); return HYP_STATUS.find((h) => x.includes(h)) || (/pass|ok/i.test(x) ? '통과' : /fail/i.test(x) ? '미달' : /run|doing/i.test(x) ? '진행' : '미시작'); };
export const hypCount = (hs) => { const c = Object.fromEntries(HYP_STATUS.map((h) => [h, 0])); (hs || []).forEach((h) => { c[hypStatus(h.status)]++; }); return c; };

// 실제 값 (최신 보고서) — 보고서 metrics(JSON 글 {meta_roas, mall_mer, total_mer}) → 제안서 문서 actual → 보고서 글(요약·본문)에서 읽음(추정)
const num = (s) => { const v = Number(String(s).replace(/,/g, '')); return isFinite(v) ? v : null; };
const firstNum = (txt, res) => { for (const re of res) { const m = re.exec(txt); if (m) return num(m[1]); } return null; };
export function actualOf(rep, prop) {
  const out = { meta_roas: null, mall_mer: null, total_mer: null, date: rep ? rep.date : '', how: {} };
  const put = (o, how) => { if (!o) return; ['meta_roas', 'mall_mer', 'total_mer'].forEach((k) => { if (out[k] == null && o[k] != null && num(o[k]) != null) { out[k] = num(o[k]); out.how[k] = how; } }); };
  if (rep) put(objOf(rep.metrics), '보고서 숫자');
  if (prop && prop.actual) put(prop.actual, '제안서 문서');
  if (rep) {
    const txt = `${rep.summary || ''}\n${rep.md || ''}`;
    const t = { meta_roas: firstNum(txt, [/메타[^\n%]{0,40}?ROAS\s*(\d[\d,]*(?:\.\d+)?)\s*%/, /메타\s*(\d[\d,]*(?:\.\d+)?)\s*%/]),
      mall_mer: firstNum(txt, [/자사몰\s*MER[^\n%\d(]{0,20}(\d[\d,]*(?:\.\d+)?)\s*%/]), total_mer: firstNum(txt, [/합산\s*MER[^\n%\d(]{0,20}(\d[\d,]*(?:\.\d+)?)\s*%/]) };
    put(t, '보고서 글에서 읽음');
  }
  return out;
}

// ── 메타 판정 로그 (금요일 증액/유지/종료/보류) ──
//   보고서 judges(JSON 글 [{date, campaign, target, roas7, roas14, purchases, verdict, reason}]) → 없으면 본문 md 표 중 '판정' 칸이 있는 표
//   기준(제안서): 구매 10건 전 보류 · 350%+ 2주 증액 · 200~350% 유지 · 180% 미만 2주 종료 → 기준대로면 '일치' · 180~200% = 제안서에 없는 구간
export const JUDGE = ['증액', '유지', '종료', '보류'];
export const verdictOf = (s) => { const x = String(s || ''); return /증액|스케일|scale|up/i.test(x) ? '증액' : /보류|hold|대기/i.test(x) ? '보류' : /종료|off|중단|끄|끔/i.test(x) ? '종료' : /유지|keep|교체/i.test(x) ? '유지' : ''; };
export function expectVerdict(r) {
  if (r.purchases != null && r.purchases < 10) return { v: '보류', why: '구매 10건 전' };
  const roas = r.roas14 ?? r.roas;
  if (roas == null) return { v: '', why: 'ROAS 없음' };
  if (roas >= 350) return { v: '증액', why: `350%+${r.roas14 == null ? ' (2주 확인 필요)' : ''}` };
  if (roas < 180) return { v: '종료', why: `180% 미만${r.roas14 == null ? ' (2주 확인 필요)' : ''}` };
  if (roas >= 200) return { v: '유지', why: '200~350%' };
  return { v: '', why: '180~200% · 제안서 기준 없음' };
}
const mdCells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
function judgeFromMd(md, date) {
  const lines = String(md || '').split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
    const body = rows.filter((r) => !(/^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes('-')));
    const h = mdCells(body[0] || ''), vi = h.findIndex((c) => /판정/.test(c)); if (vi < 0) continue;
    const ix = (re) => h.findIndex((c) => re.test(c));
    const ti = ix(/캠페인|세트|소재|광고|대상/), r14 = ix(/14|2주/), r7 = ix(/ROAS/), pi = ix(/구매/), ri = ix(/근거|이유/);
    body.slice(1).forEach((l) => { const c = mdCells(l);
      out.push({ date, campaign: '', target: ti >= 0 ? c[ti] : c[0], roas14: r14 >= 0 && /ROAS|%/.test(h[r14] + c[r14]) ? num((c[r14] || '').replace(/[^\d.,]/g, '')) : null,
        roas: r7 >= 0 ? num((c[r7] || '').replace(/[^\d.,]/g, '')) : null, purchases: pi >= 0 ? num((c[pi] || '').replace(/[^\d.]/g, '')) : null, verdictRaw: c[vi] || '', reason: ri >= 0 ? c[ri] : '' }); });
  }
  return out;
}
const nn = (v) => (v == null || v === '' ? null : num(String(v).replace(/[^\d.,-]/g, '')));
export function judgeLog(reps) {
  const rows = [];
  sortReports(reps).forEach((r) => {
    const f = objOf(r.judges ?? r.metaJudges ?? r.verdicts), arr = Array.isArray(f) ? f : f && Array.isArray(f.items) ? f.items : null;
    const got = arr ? arr.map((o) => ({ date: (/^\d{4}-\d{2}-\d{2}/.test(o.date || '') ? o.date.slice(0, 10) : r.date), campaign: o.campaign || o.캠페인 || '', target: o.target || o.대상 || o.ad || o.adset || '',
      roas14: nn(o.roas14 ?? o.roas2w), roas: nn(o.roas ?? o.roas7), purchases: nn(o.purchases ?? o.구매), verdictRaw: o.verdict || o.판정 || '', reason: o.reason || o.근거 || '' }))
      : judgeFromMd(r.md, r.date);
    got.forEach((x) => { x.verdict = verdictOf(x.verdictRaw); const e = expectVerdict(x); x.expect = e.v; x.expectWhy = e.why;
      x.match = !x.verdict || !e.v ? '판단 불가' : x.verdict === e.v ? '일치' : '다름'; rows.push(x); });
  });
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const c = Object.fromEntries(JUDGE.map((j) => [j, 0])); rows.forEach((x) => { if (c[x.verdict] != null) c[x.verdict]++; });
  return { rows, count: c, diff: rows.filter((x) => x.match === '다름').length };
}
