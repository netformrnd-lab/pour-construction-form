// 업무OS v2 — 레퍼런스 공유 (사용자 확정 2026-10-17 · 계산만 · 화면 refui.jsx · 저장 core.refAdd·refEdit·refHide·refFit · 시험 refs.test.mjs)
//   사장님 "업무os에 팀원에게 레퍼런스 공유하고싶은데 … 단순히 채팅을 만들어서 전달하면 그사람만 알게되어서 다른사람은 모르는문제" → 확정 1A 2A 3A 4A
//   1A 업무OS '레퍼런스' 한 곳(모두 봄 · 더보기 · 관리자 머리) + 프로젝트·업무에 연결하면 그 화면(프로젝트 자료 탭 · 업무 파일 위)에도
//   2A 종류 칩(관리자가 고침 · settings/refkinds) + 브랜드 + 프로젝트·업무 연결(선택)
//   3A 올릴 때 받을 사람 @(선택) → 그 사람 '확인할 것' 한 줄(읽으면 사라짐 · 7일) · 다른 사람은 '레퍼런스'에서
//   4A AI 크루도 씀 — "크루가 찾아오면 사람이 핏을 해당레퍼런스에 ~~부분만 사용 이런식으로 표식남기면 이용 하게끔"
//      = 사람이 'AI 핏'(그 AI · 어느 부분만 쓸지 한 줄)을 남긴 것만 그 AI 지시문 '■ 참고 레퍼런스'에 (crew.js refRows · crew.html · team_link.py feedback)
//   공통: 링크·캡처(Ctrl+V)·사진 + '무엇을 참고할지' 한 줄 · 누구나 올림 · 대화(댓글 itemId 'ref:<id>') · 숨김만(올린 사람 그날 · 관리자 · 지우지 않음)
//   저장 pour-os/v2/refs/{id} {id, text, url(글 안 첫 링크), files[], kind, brand, projectId, taskId, to[], toAt{사람: 때}, by, byName, at, updatedAt,
//     fits {AI: {text, by, byName, at}}, fitMates [AI](crew.html 이 array-contains 로 읽음), fitLog[], edits[], removed? {at, by, byName}}
import { ymd, isMaster, nameOf, projLabelOf } from "./model.js";
import { liveCrews, designBad, BRAND_L } from "../../marketing-hub/crew.js";

export const REF_KINDS = ["상세페이지", "광고 소재", "숏폼·릴스", "블로그·콘텐츠", "패키지·디자인", "촬영", "기타"];
export const REF_TEXT_MAX = 1000, REF_FIT_MAX = 300, REF_FILES_MAX = 10, REF_KIND_MAX = 16, REF_KIND_LEN = 12, REF_DAYS = 7;
export const REF_LIVE_DAYS = 90;   // 앱이 늘 구독하는 기간 (더 오래된 것은 [이전 것 불러오기] · 프로젝트·업무 칸은 그 연결로 한 번 더 읽음)
// 종류 → 핏 남길 때 먼저 골라 둘 AI (사람이 바꿈)
export const REF_FIT_DEFAULT = { "상세페이지": "gyeoul", "광고 소재": "gaeul", "숏폼·릴스": "yeoreum", "블로그·콘텐츠": "yeoreum", "패키지·디자인": "gyeoul", "촬영": "yeoreum" };
const DAY = 864e5;
export const refNoteId = (id) => "ref:" + id;
export const dayOf = (iso) => { const t = iso ? new Date(iso) : null; return t && !isNaN(t) ? ymd(t) : ""; };
export const refLive = (r) => !!r && !!r.id && !(r.removed && r.removed.at);

// 종류 칩 = settings/refkinds.list (관리자) → 없으면 기본 7개 · 같은 이름 한 번 · 12자 · 16개까지
export const cleanKinds = (list) => [...new Set((list || []).map((x) => String(x || "").replace(/\s+/g, " ").trim().slice(0, REF_KIND_LEN)).filter(Boolean))].slice(0, REF_KIND_MAX);
export const refKindsOf = (settings) => { const d = (settings || []).find((x) => x && (x.id || x._doc) === "refkinds"), l = cleanKinds(d && d.list); return l.length ? l : REF_KINDS.slice(); };
// 글 안 첫 링크 (www. 로 시작하면 https 를 붙임)
export function firstUrl(text) {
  const m = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/i.exec(String(text || "")); if (!m) return "";
  const u = m[1].replace(/[),.。·]+$/, ""); return (/^www\./i.test(u) ? "https://" + u : u).slice(0, 500);
}
export const urlHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

// AI 핏을 남길 수 있는 AI = 지금 쓰는 크루의 크루원 (닫힌 크루 빼고) · 단계 순서
export const refFitMates = () => liveCrews().flatMap((c) => (c.members || []).filter((m) => m && m.board).map((m) => ({ id: m.id, name: m.name, role: m.role, slot: m.slot, color: m.color })));
export const refMateName = (id) => (refFitMates().find((m) => m.id === id) || {}).name || id;
// 그 AI 담당(업무OS AI 팀원 · 브랜드별 · 할 일별)인 사람들
export const mateOwnerIds = (mateDoc) => [...new Set([...Object.values((mateDoc && mateDoc.owners) || {}), ...Object.values((mateDoc && mateDoc.actOwners) || {})].filter(Boolean))];

// 누가 무엇을 하나 — 고치기 = 올린 사람·관리자 · 숨기기 = 올린 사람(그날 안)·관리자 · 핏 = 관리자·올린 사람·그 AI 담당 · 핏 빼기 = 핏 남긴 사람·그 AI 담당·관리자
export const canRefEdit = (r, cu) => !!cu && refLive(r) && (isMaster(cu) || r.by === cu.id);
export const canRefHide = (r, cu, today = ymd(new Date())) => !!cu && refLive(r) && (isMaster(cu) || (r.by === cu.id && dayOf(r.at) === today));
export const canRefFit = (r, cu, mateId, mates) => !!cu && refLive(r) && (isMaster(cu) || r.by === cu.id || mateOwnerIds(((mates || {})[mateId]) || null).includes(cu.id));
export const canRefFitAny = (r, cu, mates) => !!cu && refLive(r) && (isMaster(cu) || r.by === cu.id || refFitMates().some((m) => mateOwnerIds(((mates || {})[m.id]) || null).includes(cu.id)));
export const canRefUnfit = (r, cu, mateId, mates) => { const f = r && r.fits && r.fits[mateId]; return !!cu && !!f && (isMaster(cu) || f.by === cu.id || mateOwnerIds(((mates || {})[mateId]) || null).includes(cu.id)); };
// 핏 글을 막을 때 (AI 가 보면 안 되는 말 · 레퍼런스 글에 있어도 막음) → 막는 까닭 · 괜찮으면 ''
export const fitBlock = (r, text) => (!String(text || "").trim() ? "어느 부분만 쓰게 할지 한 줄 써 주세요" : designBad(text) ? "원가·마진·제조사·공급가가 있으면 AI가 볼 수 없어요 · 그 말을 빼고 써 주세요"
  : designBad(r && r.text) ? "이 레퍼런스 글에 원가·마진·제조사·공급가 말이 있어 AI에게 줄 수 없어요 · 글을 고친 뒤 남겨 주세요" : "");

// 새 레퍼런스 문서 (올리기) · to = 글 안 @이름 (나 빼고)
export function refNewDoc(f, cu, toIds, now = new Date().toISOString()) {
  const text = String(f.text || "").trim().slice(0, REF_TEXT_MAX), files = (f.files || []).filter((x) => x && x.url).slice(0, REF_FILES_MAX).map((x) => ({ ...x, by: cu.id, byName: cu.name }));
  const to = [...new Set((toIds || []).filter((id) => id && id !== cu.id))].slice(0, 20);
  return { text: text || (files.length ? "(사진)" : ""), url: firstUrl(text), files, kind: String(f.kind || "").trim(), brand: f.brand || "", projectId: f.projectId || "", taskId: f.taskId || "",
    to, toAt: Object.fromEntries(to.map((id) => [id, now])), by: cu.id, byName: cu.name, at: now, updatedAt: now, fits: {}, fitMates: [], app: f.app === "admin" ? "admin" : "team" };
}
// 올리기 전 빠진 것 → 화면 안내
export const refMissing = (f, filesN) => (!String(f.text || "").trim() && !filesN ? "링크·글 한 줄이나 캡처를 붙여 주세요" : !String(f.kind || "").trim() ? "종류를 골라 주세요" : "");

// 목록: 살아 있는 것 · 최근 것 먼저 · f = {kind, brand, q, mine(나 id), proj, task, fit(AI id)}
export function refList(list, f = {}, D = null) {
  const q = String(f.q || "").replace(/\s+/g, "").toLowerCase();
  const hit = (r) => { if (!q) return true; const s = [r.text, r.byName, r.kind, BRAND_L[r.brand] || "", D ? projLabelOf(D, r.projectId) : "", ...Object.values(r.fits || {}).map((x) => x && x.text)].join(" ").replace(/\s+/g, "").toLowerCase(); return s.includes(q); };
  return (list || []).filter(refLive).filter((r) => (!f.kind || r.kind === f.kind) && (!f.brand || (f.brand === "-" ? !r.brand : r.brand === f.brand)) && (!f.mine || r.by === f.mine)
      && (!f.proj || r.projectId === f.proj) && (!f.task || r.taskId === f.task) && (!f.fit || !!(r.fits && r.fits[f.fit])) && hit(r))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}
// 프로젝트 칸 = 그 프로젝트에 연결한 것 + 그 프로젝트 업무에 연결한 것 · 업무 칸 = 그 업무에 연결한 것
export const refsOfProj = (list, pid, tasks) => { if (!pid) return []; const ts = new Set((tasks || []).filter((t) => t && t.projectId === pid).map((t) => t.id)); return refList(list).filter((r) => r.projectId === pid || (r.taskId && ts.has(r.taskId))); };
export const refsOfTask = (list, tid) => (tid ? refList(list).filter((r) => r.taskId === tid) : []);
// 여러 갈래로 읽은 것 합치기 (구독 · 이전 것 · 프로젝트·업무로 한 번 더 읽은 것) — 같은 id 는 updatedAt 이 새것
export function refMerge(...lists) { const m = new Map(); lists.forEach((l) => (l || []).forEach((x) => { if (!x || !x.id) return; const o = m.get(x.id); if (!o || String(x.updatedAt || "") >= String(o.updatedAt || "")) m.set(x.id, x); })); return [...m.values()]; }
// 핏 남긴 AI 이름들 (카드 꼬리표)
export const fitNames = (r) => Object.keys((r && r.fits) || {}).filter((k) => r.fits[k] && String(r.fits[k].text || "").trim()).map(refMateName);
export const refFirstImg = (r) => ((r && r.files) || []).find((f) => f && f.url && (/^image\//.test(String(f.type || "")) || /\.(png|jpe?g|gif|webp|heic)$/i.test(String(f.name || ""))));
export const refTitle = (r) => { const t = String((r && r.text) || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim(); return (t || (r && r.url ? urlHost(r.url) : "") || (r && r.kind) || "레퍼런스").slice(0, 60); };

// '확인할 것' 줄 (model.todayView 가 D.refInbox 로 부름 · 순환 import 피하려고)
//   받을 사람(@) = 올린 뒤 7일 · 한 번 읽으면 사라짐(읽은 알림으로) · 내가 올린 것·숨긴 것은 안 뜸
export function refInbox(D, uid, now = new Date(), seen = {}) {
  const since = new Date(now.getTime() - REF_DAYS * DAY).toISOString(), out = [];
  ((D && D.refs && D.refs.list) || []).filter(refLive).forEach((r) => {
    if (r.by === uid || !(r.to || []).includes(uid)) return;
    const at = ((r.toAt || {})[uid]) || r.at || ""; if (at < since) return;
    const id = "rf:" + r.id + ":" + at; if (seen[id]) return;
    const where = [r.kind, BRAND_L[r.brand] || "", r.projectId ? projLabelOf(D, r.projectId) : ""].filter(Boolean).join(" · ");
    out.push({ kind: "ref", tag: "레퍼런스", id, refId: r.id, title: refTitle(r), who: r.by, whoName: r.byName || nameOf(D.users, r.by), at, text: `${where}${where ? " · " : ""}나에게 공유했어요` });
  });
  return out;
}
// 대화(댓글) 줄 — model.todayView 댓글 고리에서: 올린 사람 · 받을 사람 · 내가 말한 대화 · @ 부름
export const refNoteHit = (r, uid, talked, ment) => !!ment || !!talked || (!!r && (r.by === uid || (r.to || []).includes(uid)));
