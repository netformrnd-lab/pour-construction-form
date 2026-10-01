// ✅ 추적 링크 만들기 — 마진대시보드 [마케팅 › 링크] 와 같은 규칙 (계산만, 화면은 App.jsx 의 LinkMaker)
//
// · 저장: 업무OS 공간 pour-os/utm-links/items/{id}  (pour-app-new · 기존 규칙 pour-os/** 로 허용 — 규칙 변경 없음)
// · 짧은 링크 https://pour-construction-form.pages.dev/g?l={id} 는 바로 동작:
//     g.html 이 마진대시보드 mkt-links 에 없으면 이 공간을 찾아 이동 + 클릭 +1
// · 마진대시보드를 팀 계정으로 열면 mkt-links 로 옮겨 담는다(클릭 수 그대로) → 두 곳 같은 목록
// · 용도·올릴 곳·영문 코드 만드는 법은 대시보드 ML_PURPOSES · utmNorm · mlCode · mlDest · mlBuild 와 똑같이

export const TRACK_BASE = "https://pour-construction-form.pages.dev/g?l=";
export const trackUrl = (id) => TRACK_BASE + id;
export const LINK_COL = "pour-os/utm-links/items";

export const ML_PURPOSES = [
  { k: "광고", places: [["네이버 광고", "naver", "cpc"], ["메타 광고", "meta", "cpc"], ["구글 광고", "google", "cpc"], ["카카오 광고", "kakao", "cpc"], ["당근 광고", "daangn", "cpc"], ["쿠팡 광고", "coupang_ads", "cpc"]] },
  { k: "포스팅", places: [["네이버 블로그", "naver_blog", "post"], ["네이버 카페", "naver_cafe", "post"], ["인스타그램", "instagram", "social"], ["유튜브", "youtube", "social"], ["쇼츠·릴스", "shorts", "social"], ["스레드", "threads", "social"], ["오늘의집", "ohou", "post"]] },
  { k: "셀러·인플루언서", named: "셀러·인플루언서 이름", src: "influencer", med: "affiliate" },
  { k: "공동구매", named: "공구 진행자·채널 이름", src: "groupbuy", med: "affiliate" },
  { k: "CS·고객문자", places: [["문자(SMS)", "sms", "crm"], ["카카오 알림톡", "kakao_msg", "crm"], ["이메일", "email", "crm"], ["상담 답변", "cs", "crm"]] },
  { k: "기타", named: "어디에 쓰나요?", src: "etc", med: "referral" },
];

export function utmNorm(s) { return String(s || "").trim().toLowerCase().replace(/[\s\-.]+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, ""); }
// 한글은 UTM 에 못 쓰므로 같은 글자면 늘 같은 영문 코드
export const mlCode = (s, pfx) => { const n = utmNorm(s); if (n) return n; let h = 0; String(s || "").split("").forEach((c) => (h = (h * 31 + c.charCodeAt(0)) >>> 0)); return pfx + "_" + h.toString(36).slice(0, 6); };

// 주소 → 목적지·브랜드·꼬리표 방식
export function mlDest(url) {
  let u; try { u = new URL(url); } catch (e) { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, "");
  if (/pourstore\.(net|co\.kr)$/.test(h)) return { dest: "자사몰", brand: "POUR스토어", mode: "utm" };
  if (/grohome\.co\.kr$/.test(h)) return { dest: "자사몰", brand: "GROHOME", mode: "utm" };
  if (/smartstore\.naver\.com$|brand\.naver\.com$/.test(h)) { const st = (u.pathname.split("/")[1] || "").toLowerCase(); return { dest: "스마트스토어", brand: /groh/.test(st) ? "GROHOME" : /pour/.test(st) ? "POUR스토어" : "", mode: "nt" }; }
  if (/coupang\.com$/.test(h)) return { dest: "쿠팡", brand: "", mode: "none" };
  return { dest: "기타 사이트", brand: "", mode: "utm" };
}
// http 없이 붙여넣어도 받아준다
export const normUrl = (s) => { const t = String(s || "").trim(); if (!t) return ""; return /^https?:\/\//i.test(t) ? t : (/^[\w-]+(\.[\w-]+)+/.test(t) ? "https://" + t : t); };
export function mlBuild(url, mode, t) {
  try {
    const u = new URL(url);
    if (mode === "utm") { u.searchParams.set("utm_source", t.source); u.searchParams.set("utm_medium", t.medium); if (t.campaign) u.searchParams.set("utm_campaign", t.campaign); if (t.content) u.searchParams.set("utm_content", t.content); }
    else if (mode === "nt") { u.searchParams.set("nt_source", t.source); u.searchParams.set("nt_medium", t.medium); if (t.content) u.searchParams.set("nt_detail", t.content); if (t.campaign) u.searchParams.set("nt_keyword", t.campaign); }
    return u.toString();
  } catch (e) { return url; }
}
const p2 = (n) => String(n).padStart(2, "0");
export function mlAutoLabel(m, d = new Date()) {
  const pu = ML_PURPOSES.find((x) => x.k === m.purpose); const who = pu && pu.named ? m.partner : m.place;
  return [who || m.purpose || "링크", m.product || "", `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`].filter(Boolean).join(" · ");
}
export function genLinkId(rand = Math.random) { let s = "o"; for (let i = 0; i < 6; i++) s += Math.floor(rand() * 36).toString(36); return s; }   // 'o' = 업무OS 에서 만든 링크
// 다 골랐나? (대시보드와 같은 조건: 주소 · 용도 · 올릴 곳(또는 이름))
export function mlReady(m) { const d = mlDest(normUrl(m.url)); const pu = ML_PURPOSES.find((x) => x.k === m.purpose); return !!(d && pu && (pu.named ? String(m.partner || "").trim() : m.place)); }
// 저장할 문서 — 대시보드 mlSaveLink 와 같은 칸 + createdVia/osUser
export function mlMakeDoc(m, { id, now = new Date(), by = "", byName = "" } = {}) {
  const url0 = normUrl(m.url), det = mlDest(url0), pu = ML_PURPOSES.find((x) => x.k === m.purpose);
  if (!det || !pu) throw new Error("링크 주소와 용도를 확인해 주세요");
  let source, medium, placeName;
  if (pu.named) { placeName = String(m.partner || "").trim(); if (!placeName) throw new Error("이름을 적어 주세요"); source = pu.src; medium = pu.med; }
  else { const pl = pu.places.find((x) => x[0] === m.place); if (!pl) throw new Error("올릴 곳을 골라 주세요"); placeName = pl[0]; source = pl[1]; medium = pl[2]; }
  const campaign = m.campaign ? mlCode(m.campaign, "promo") : "";
  const label = String(m.label || "").trim() || mlAutoLabel(m, now);
  const content = mlCode(pu.named ? placeName : (m.label || placeName), "c");
  const t = { source, medium, campaign, content }, url = mlBuild(url0, det.mode, t);
  return { id, url, baseUrl: url0, label, product: m.product || "", channel: source, contentType: m.purpose, campaign, campaignName: m.campaign || "", purpose: m.purpose, place: pu.named ? "" : placeName, partner: pu.named ? placeName : "",
    dest: det.dest, brand: m.brand || det.brand || "", promoId: "", tagMode: det.mode, createdVia: "pour-os",
    utmSource: source, utmMedium: medium, utmCampaign: campaign, utmContent: content, clicks: 0, clicksByDay: {}, createdAt: now.toISOString(), createdBy: by, createdByName: byName };
}
// 최근 설정 그대로 (내가 만든 것 중 용도·올릴 곳 조합 3개)
export function recentCombos(links, me) {
  const seen = new Set(), out = [];
  [...(links || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).forEach((l) => {
    if (l.archived || !l.purpose) return; if (me && l.createdBy && l.createdBy !== me) return;
    const k = [l.purpose, l.place || "", l.partner || ""].join("|"); if (seen.has(k)) return; seen.add(k); out.push(l); });
  return out.slice(0, 3);
}
// 두 곳(대시보드 mkt-links + 업무OS) 링크 합치기 — 같은 id 는 대시보드 것을 쓴다(옮겨 담긴 것)
export function mergeLinks(mkt, os) {
  const m = new Map(); (os || []).forEach((l) => l && l.id && m.set(l.id, { ...l, _src: "os" })); (mkt || []).forEach((l) => l && l.id && !l.deleted && m.set(l.id, { ...l, _src: "mkt" }));
  return [...m.values()].filter((l) => !l.archived).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
export const isTrackUrl = (u) => /\/g\?l=([a-z0-9]+)/i.test(String(u || ""));
export const trackId = (u) => ((String(u || "").match(/\/g\?l=([a-z0-9]+)/i) || [])[1]) || "";
