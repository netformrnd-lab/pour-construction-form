// ✅ 행동지표 메모(댓글·대댓글·파일·사진 붙여넣기·UTM 링크) — 계산 로직만 (화면은 App.jsx 의 AkNotesSheet)
//
// 저장 구조
//  · 댓글 1개 = 문서 1개  pour-os/ak-notes/c/{id}  (서로 덮어쓰지 않음 · 기존 규칙 pour-os/{doc=**} 로 허용)
//    { id, itemId, parentId(대댓이면 원댓글 id), text, by, byName, at, files:[{name,url,path,size,type}],
//      editedAt, edits:[{text,at}] (고치기 전 내용 보관), deleted, deletedAt, deletedBy }
//  · 삭제는 숨김(deleted:true)만 — 내용·파일은 그대로 남는다
//  · 파일은 Storage task-attachments/ak-notes/{itemId}/… (기존 규칙 task-attachments/** 로 허용)

export const NOTE_FILE_MAX = 25 * 1024 * 1024;   // 파일 1개 25MB
export const NOTE_FILE_CNT = 10;                 // 한 번에 10개

// 원댓글(오래된 순) + 각 대댓글(오래된 순)
export function noteThreads(notes, itemId) {
  const mine = (notes || []).filter((n) => n && n.itemId === itemId);
  const byAt = (a, b) => String(a.at || "").localeCompare(String(b.at || ""));
  const tops = mine.filter((n) => !n.parentId || !mine.some((m) => m.id === n.parentId)).sort(byAt);
  return tops.map((t) => ({ ...t, replies: mine.filter((r) => r.parentId === t.id).sort(byAt) }));
}
// 항목별 메모 수(숨긴 것 제외) + 최근 시각
export function noteCounts(notes) {
  const out = {};
  (notes || []).forEach((n) => { if (!n || n.deleted) return; const o = out[n.itemId] || (out[n.itemId] = { n: 0, last: "" }); o.n++; if (String(n.at) > o.last) o.last = String(n.at); });
  return out;
}

// 글 속 링크 나누기 → [{t:"text"|"url", v}]
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
export function linkParts(text) {
  const s = String(text || ""), out = []; let last = 0, m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s))) {
    let url = m[1]; const trail = (url.match(/[),.;:!?·]+$/) || [""])[0];   // 문장 끝 구두점은 링크에서 뺌
    if (trail) url = url.slice(0, -trail.length);
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    out.push({ t: "url", v: url });
    last = m.index + url.length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

// ── UTM 링크 만들기 ──
export const UTM_SOURCES = ["naver", "instagram", "youtube", "kakao", "facebook", "google", "tistory", "cafe"];
export const UTM_MEDIUMS = ["blog", "social", "cpc", "display", "influencer", "community", "email", "sms"];
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const clean = (v) => String(v || "").trim().replace(/\s+/g, "_");
// base 에 utm_* 를 붙인 주소. 원래 있던 utm_* 는 새 값으로 바꾸고, 다른 파라미터·#은 그대로. 잘못된 주소면 {err}
export function buildUtm(base, { source, medium, campaign, content, term } = {}) {
  let raw = String(base || "").trim();
  if (!raw) return { err: "주소를 넣어주세요" };
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u; try { u = new URL(raw); } catch (_) { return { err: "주소 모양이 아니에요" }; }
  if (!u.hostname.includes(".")) return { err: "주소 모양이 아니에요" };
  const vals = { utm_source: clean(source), utm_medium: clean(medium), utm_campaign: clean(campaign), utm_content: clean(content), utm_term: clean(term) };
  if (!vals.utm_source || !vals.utm_medium || !vals.utm_campaign) return { err: "source · medium · campaign 은 꼭 넣어주세요" };
  UTM_KEYS.forEach((k) => u.searchParams.delete(k));
  UTM_KEYS.forEach((k) => { if (vals[k]) u.searchParams.set(k, vals[k]); });
  return { url: u.toString() };
}
// 이미 UTM 이 붙은 주소에서 값 읽기 (메모 화면에 표 시용)
export function readUtm(url) {
  try { const u = new URL(url); const o = {}; UTM_KEYS.forEach((k) => { const v = u.searchParams.get(k); if (v) o[k.slice(4)] = v; }); return Object.keys(o).length ? o : null; } catch (_) { return null; }
}

// 붙여넣기·첨부 파일 고르기 — 크기·개수 넘는 건 이유와 함께 뺀다
export function pickFiles(files, already = 0) {
  const ok = [], bad = [];
  Array.from(files || []).forEach((f) => {
    if (!f) return;
    if (ok.length + already >= NOTE_FILE_CNT) { bad.push(`${f.name || "파일"} (한 번에 ${NOTE_FILE_CNT}개까지)`); return; }
    if ((f.size || 0) > NOTE_FILE_MAX) { bad.push(`${f.name || "파일"} (25MB 초과)`); return; }
    ok.push(f);
  });
  return { ok, bad };
}
// 붙여넣은 사진 이름 (clipboard 이미지는 image.png 로만 와서 겹침)
export const pastedName = (type, d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  const ext = (String(type || "image/png").split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
  return `붙여넣은사진_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
};
export const fileSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round((b || 0) / 1024)) + "KB");
export const isImage = (f) => /^image\//.test((f && f.type) || "") || /\.(png|jpe?g|gif|webp|heic)$/i.test((f && f.name) || "");

// ── 업무·프로젝트 댓글 · 컨펌 요청 (같은 컬렉션 pour-os/ak-notes/c) ──
// itemId: 업무 "task:{업무id}" · 프로젝트 "proj:{프로젝트id}"
// 컨펌 요청 = kind:"confirm" 원댓글 {to,toName,status:"wait"|"ok"|"fix",round,link,fileName,decidedBy,decidedAt}
//   피드백은 그 글의 답글(fb:true). 다시 올리면 새 원댓글(round+1) → 이력은 그대로 남음
export const taskNoteId = (id) => "task:" + id;
export const projNoteId = (id) => "proj:" + id;
const live = (n) => n && !n.deleted;
export function confirmsOf(notes, itemId) {
  return (notes || []).filter((n) => live(n) && n.kind === "confirm" && !n.parentId && n.itemId === itemId)
    .sort((a, b) => (a.round || 0) - (b.round || 0) || String(a.at || "").localeCompare(String(b.at || "")));
}
// 이 업무의 지금 컨펌 상태 (가장 최근 차수)
export function confirmLatest(notes, itemId) { const c = confirmsOf(notes, itemId); return c.length ? c[c.length - 1] : null; }
export const nextRound = (notes, itemId) => confirmsOf(notes, itemId).reduce((m, n) => Math.max(m, +n.round || 0), 0) + 1;
// 나에게 온 컨펌 대기 (각 업무의 최신 차수만)
export function confirmQueue(notes, uid) {
  const latest = new Map();
  (notes || []).forEach((n) => { if (!live(n) || n.kind !== "confirm" || n.parentId) return; const p = latest.get(n.itemId); if (!p || (+n.round || 0) > (+p.round || 0) || ((+n.round || 0) === (+p.round || 0) && String(n.at) > String(p.at))) latest.set(n.itemId, n); });
  const all = [...latest.values()];
  return {
    wait: all.filter((n) => n.status === "wait" && n.to === uid).sort((a, b) => String(a.at).localeCompare(String(b.at))),
    fix: all.filter((n) => n.status === "fix" && n.by === uid).sort((a, b) => String(b.decidedAt || "").localeCompare(String(a.decidedAt || ""))),
  };
}
// 새 댓글: 내 업무·내 프로젝트에 남이 쓴 글 + 내 글에 달린 답글 (본 뒤에 생긴 것만)
export function newNotesFor(notes, uid, myItems, seen, since) {
  const mine = new Set((notes || []).filter((n) => n.by === uid).map((n) => n.id));
  const items = new Set(myItems || []);
  return (notes || []).filter((n) => live(n) && n.by !== uid && /^(task|proj|akrun):/.test(String(n.itemId || "")) && (items.has(n.itemId) || (n.parentId && mine.has(n.parentId)))
    && String(n.at || "") > String((seen || {})[n.itemId] || since || ""))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
