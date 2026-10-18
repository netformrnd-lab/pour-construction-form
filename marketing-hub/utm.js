// 링크 꼬리표 — 자사몰 UTM · 스마트스토어 NT (사장님 확정 2026-10-18 2-2A "A에 해당하는 마케팅 모두 링크 utm 넣어서 관리")
//   글·메시지마다 꼬리표를 붙여 두면 카페24 애널리틱스 › 광고 유입 분석 › UTM 분석 · 스마트스토어센터 › 통계 › 마케팅 분석 › 사용자 정의 채널에서
//   어느 글·메시지가 방문·구매·매출을 데려왔는지 보인다 → 별 D 가 주 1회 읽어 허브 글 기록·볼트 '04 자료/링크 성과'에 (2-3A)
//   붙이는 때 = 나가는 순간만: 허브 [임시저장 맡기기]·[복사](글) · crew.js asksFromParse(AI 크루 보내는 할 일 · act.utm)
//   원고(볼트 노트)·허브 미리 보기는 그대로 · 업무OS 에서 링크를 눌러 열 때는 꼬리표를 떼고 연다(ui.Linked — 직원이 눌러 숫자가 부풀지 않게)
//   이미 꼬리표가 있는 링크는 그대로 · 자사몰·스마트스토어 밖 주소(인스타·쿠팡·오늘의집·카카오 …)는 안 건드림
//   ES 모듈 · 계산만 — 허브 index.html(window.MktUtm) · crew.js · 업무OS 가 같이 씀 · 시험 node marketing-hub/crew.test.mjs
export const MALL_HOSTS = ['pourstore.net', 'www.pourstore.net', 'm.pourstore.net', 'grohome.co.kr', 'www.grohome.co.kr', 'm.grohome.co.kr'];   // 카페24 자사몰 (team_link.py MALL_HOSTS 와 같게)
export const NAVER_HOSTS = ['smartstore.naver.com', 'm.smartstore.naver.com', 'brand.naver.com', 'm.brand.naver.com'];   // NT 꼬리표를 읽는 네이버 상점
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const NT_KEYS = ['nt_source', 'nt_medium', 'nt_detail', 'nt_keyword'];
// 글 채널(허브 core.js CHANNEL 열쇠) → 채널(utm_source) — 카페24 화면 '채널' · 스마트스토어 nt_source
export const POST_SOURCE = { naver_blog: 'naver_blog', tistory: 'tistory', cafe: 'naver_cafe', insta: 'instagram', kin: 'naver_kin', other: 'etc' };
export const hostOf = (url) => { const m = /^https?:\/\/([^/?#:\s]+)/i.exec(String(url || '')); return m ? m[1].toLowerCase() : ''; };
export const linkKind = (url) => { const h = hostOf(url); return MALL_HOSTS.includes(h) ? 'mall' : NAVER_HOSTS.includes(h) ? 'naver' : ''; };
const enc = (v) => encodeURIComponent(String(v == null ? '' : v).trim());
const hasKey = (base, k) => new RegExp(`[?&]${k}=`).test(base);
const splitHash = (u) => { const i = u.indexOf('#'); return i >= 0 ? [u.slice(0, i), u.slice(i)] : [u, '']; };
// 주소 하나 — 자사몰 = utm_source/medium/campaign/content · 스마트스토어 = nt_source/medium/detail/keyword (같은 값) · 이미 있으면 그대로
export function tagUrl(url, tag) {
  const u = String(url || ''), kind = linkKind(u);
  if (!kind || !tag || !tag.source) return u;
  const [base, frag] = splitHash(u);
  const ps = kind === 'mall' ? (hasKey(base, 'utm_source') ? [] : [['utm_source', tag.source], ['utm_medium', tag.medium], ['utm_campaign', tag.campaign], ['utm_content', tag.content]])
    : (hasKey(base, 'nt_source') ? [] : [['nt_source', tag.source], ['nt_medium', tag.medium], ['nt_detail', tag.campaign], ['nt_keyword', tag.content]]);
  const q = ps.filter(([, v]) => v != null && String(v).trim()).map(([k, v]) => `${k}=${enc(v)}`).join('&');
  if (!q) return u;
  return base + (base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?') + q + frag;
}
// 꼬리표 떼기 (업무OS 에서 눌러 열 때 · 허브 미리 보기) — 자사몰·스마트스토어 주소만
export function untagUrl(url) {
  const u = String(url || ''); if (!linkKind(u)) return u;
  const [base, frag] = splitHash(u), qi = base.indexOf('?'); if (qi < 0) return u;
  const keep = base.slice(qi + 1).split('&').filter((kv) => kv && ![...UTM_KEYS, ...NT_KEYS].includes(kv.split('=')[0]));
  return base.slice(0, qi) + (keep.length ? '?' + keep.join('&') : '') + frag;
}
// 글 안의 주소 — 공백·꺾쇠·따옴표·괄호·대괄호에서 끊음([링크: 라벨 → 주소] · [글](주소) 모두) · 끝의 문장부호는 주소에서 뺌
const URL_RE = /https?:\/\/[^\s<>"'`()[\]{}]+/g;
const TRAIL_RE = /[.,;:!?。、」』…]+$/;
const mapLinks = (text, f) => String(text == null ? '' : text).replace(URL_RE, (m) => { const t = (TRAIL_RE.exec(m) || [''])[0], u = t ? m.slice(0, -t.length) : m; return f(u) + t; });
export const tagLinks = (text, tag) => mapLinks(text, (u) => tagUrl(u, tag));
export const untagLinks = (text) => mapLinks(text, untagUrl);
// 글 안의 자사몰·스마트스토어 주소 수 (허브 '꼬리표 n개' 표시)
export const linkCount = (text) => { let n = 0; mapLinks(text, (u) => { if (linkKind(u)) n++; return u; }); return n; };
// 짧은 지문 (글 키) — djb2 · 36진수
export const h36 = (s) => { let h = 5381; for (const ch of String(s == null ? '' : s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
const ymdOf = (s) => /(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
const mmdd = (s) => { const m = ymdOf(s); return m ? m[2] + m[3] : ''; };
const ymOf = (s) => { const m = ymdOf(s); return m ? `${m[1]}-${m[2]}` : ''; };
// 글 키 = 세부 항목(utm_content · nt_keyword) — '1018-ab12-2' (발행 노트 날짜 · 노트 지문 4자 · 글 번호) · 허브 mkt-posts.tagKey 로 남김
export const POST_KEY_RE = /^\d{4}-[0-9a-z]{4}-\d+$/;
export const postKey = (noteId, n, date) => `${mmdd(date) || mmdd(noteId) || '0000'}-${h36(noteId).padStart(4, '0').slice(0, 4)}-${n}`;
// 허브 글 한 편 (아침 루틴 블로그·티스토리·카페·지식인·인스타) — 채널 · 유형 content · 캠페인 '2026-10_content' · 세부 = 글 키
export function postTag({ channel, noteId, n, date }) {
  const ym = ymOf(date) || ymOf(noteId);
  return { source: POST_SOURCE[channel] || 'etc', medium: 'content', campaign: `${ym ? ym + '_' : ''}content`, content: postKey(noteId, n, date) };
}
// AI 크루 보내는 할 일 (act.utm {s, m}) — 캠페인 '2026-10_gh-exp' · 세부 '1020-A3'(올린 날 · 번호) · 번호 없는 요약·글 = '1020-A'
export const ACT_KEY_RE = /^\d{4}-[A-Z]\d*$/;
export function actTag(utm, { board, act, run, n }) {
  const ym = ymOf(run);
  return { source: (utm && utm.s) || 'aicrew', medium: (utm && utm.m) || 'message', campaign: `${ym ? ym + '_' : ''}${board || 'crew'}`, content: `${mmdd(run) || '0000'}-${n || act || ''}` };
}
export const tagText = (t) => (t ? [t.source, t.medium, t.campaign, t.content].filter(Boolean).join(' · ') : '');
