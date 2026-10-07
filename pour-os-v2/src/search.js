// 업무OS v2 — 찾기 (사용자 요청 2026-10-07 "검색기능넣어서 업무, 프로젝트, 댓글 바로 찾을 수 있게해줘")
// 계산만 (저장·쓰기 없음) · 화면은 searchui.jsx · 시험 search.test.mjs
//  · 찾는 곳 = 이미 불러온 것(열린 업무 · 30일 안 끝낸 업무 · 30일 안 댓글 · 프로젝트 · 반복 실행) + '더 오래된 것도 찾기'로 한 번 읽은 것(older)
//  · 맞추기 = 대소문자·띄어쓰기 무시 · 글 안에 들어 있으면 (초성 찾기 없음) · 담당 이름·프로젝트 이름으로도
//  · 기밀: 화면 D(secret.redact 뒤)에서 잠긴 것(locked)은 아예 안 넣음 · 따로 읽은 지난 업무·댓글도 같은 규칙(secret.taskSeen)
import { nameOf, ownersOf, isMine, dueOf, md, STATUS_L, projStLabel, brandLabel, scopeOf, fxIsMine, fxIds, fxRecurL, isMaster, trashRows, isRemoved } from "./model.js";
import { taskSeen, seeAll, lockTask } from "./secret.js";

// 띄어쓰기 없애고 소문자로
export const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
// 글(text) 안에서 찾는 말(q · norm 한 것)의 원래 자리 [시작, 끝) — 띄어쓰기를 건너뛰며 맞춤 · 없으면 null
export function hitAt(text, q) {
  const s = String(text || ""); if (!q) return null;
  const map = [], chars = [];
  for (let i = 0; i < s.length; i++) { if (/\s/.test(s[i])) continue; map.push(i); chars.push(s[i].toLowerCase()); }
  const k = chars.join("").indexOf(q); if (k < 0) return null;
  return [map[k], map[k + q.length - 1] + 1];
}
// 굵게 칠할 조각 [{t, b}] — 맞은 곳만 b
export function marks(text, q) {
  const s = String(text || ""), h = hitAt(s, q); if (!h) return [{ t: s, b: false }];
  return [{ t: s.slice(0, h[0]), b: false }, { t: s.slice(h[0], h[1]), b: true }, { t: s.slice(h[1]), b: false }].filter((x) => x.t);
}
// 긴 글(메모·댓글)은 맞은 곳 앞뒤만 (한 줄로)
export function snippet(text, q, n = 36) {
  const s = String(text || "").replace(/\s+/g, " ").trim(), h = hitAt(s, q);
  if (!h || s.length <= n * 2) return s;
  const a = Math.max(0, h[0] - Math.floor(n / 2)), b = Math.min(s.length, h[1] + n);
  return (a > 0 ? "…" : "") + s.slice(a, b) + (b < s.length ? "…" : "");
}
export const has = (text, q) => !!q && norm(text).includes(q);

// 댓글이 어디 것인지 + 여는 길 (내가 쓴 댓글 · 찾기 같이)
export function noteWhere(D, n) {
  const id = String(n.itemId || ""), ci = id.indexOf(":"), k = ci > 0 ? id.slice(0, ci) : "", ref = ci > 0 ? id.slice(ci + 1) : id;
  if (k === "task") { const t = (D.tasks || []).find((x) => x.id === ref) || (D.removedFx || []).find((x) => x.id === ref);   // 없앤 고정업무 대화도 그 시트로
    return { kind: t && t.isFixed ? (t.scope === "brand" ? "반복 실행" : "고정업무") : "업무", title: t ? t.title : "지난 업무", t, go: { type: t && t.isFixed ? "fixed" : "task", id: ref, focus: "talk", note: n.id } }; }
  if (k === "proj") { const p = (D.projects || []).find((x) => x.id === ref); return { kind: "프로젝트", title: p ? p.title : "프로젝트", p, go: { type: "project", id: ref, first: "news", note: n.id } }; }
  if (!k && id.includes("~")) { const tid = id.split("~")[0], t = (D.tasks || []).find((x) => x.id === tid); return { kind: "고정업무 메모", title: t ? t.title : "고정업무", t, go: { type: "fixed", id: tid } }; }
  const it = ((D.ak && D.ak.items) || []).find((x) => x.id === id) || ((D.ak && D.ak.removed) || []).find((x) => x.id === id);
  return { kind: "반복 실행", title: it ? it.name : "반복 실행", go: { type: "routine", id, focus: "talk", note: n.id } };
}

// '더 오래된 것도 찾기'로 읽은 것(older = {tasks, notes})을 화면 D 에 합침 — 이미 있는 것은 그대로 · 기밀은 secret 규칙대로
//   지난 업무: viewTasks 와 같이 허용 안 된 기밀은 대체본(locked → 찾기에서 빠짐)
//   댓글: 잠긴 업무·프로젝트 것 · (관리자 아니면) 어느 업무인지 못 찾는 것은 뺌
export function mergeOlder(D, older) {
  if (!older) return D;
  const u = D.viewer, all = seeAll(u), have = new Set((D.tasks || []).map((t) => t.id));
  const pm = new Map((D.projects || []).map((p) => [p.id, p]));
  const goneP = new Set((D.removedProjects || []).map((p) => p.id)), gone = new Set([...(D.goneIds || []), ...(older.tasks || []).filter((t) => t && (goneP.has(t.projectId) || (isRemoved(t) && t.removed.proj))).map((t) => t.id)]);   // 없앤 프로젝트(휴지통)의 업무·대화도 찾기에 안 나옴
  const raw = (older.tasks || []).filter((t) => t && t.id && !have.has(t.id) && !t.deleted && !t.isFixed && !isRemoved(t) && !goneP.has(t.projectId));   // 없앤 업무는 찾기에 안 나옴(휴지통에만)
  const pool = [...(D.tasks || []), ...raw];
  const add = all ? raw : raw.map((t) => (taskSeen(t, pm.get(t.projectId) || null, u.id, pool) ? t : lockTask(t)));
  const tasks = [...(D.tasks || []), ...add];
  const lockedT = new Set([...(D.lockedT || []), ...add.filter((t) => t.locked).map((t) => t.id)]), lockedP = D.lockedP || new Set();
  const known = new Set(tasks.map((t) => t.id)); (D.removedFx || []).forEach((t) => known.add(t.id));
  const hidden = (n) => { const s = String(n.itemId || ""); if (s.startsWith("task:")) { const id = s.slice(5); return lockedT.has(id) || gone.has(id) || (!all && !known.has(id)); } if (s.startsWith("proj:")) return lockedP.has(s.slice(5)) || goneP.has(s.slice(5)); return false; };
  const nHave = new Set((D.notes || []).map((n) => n.id));
  const notes = [...(D.notes || []).filter((n) => !(n && String(n.itemId || "").startsWith("task:") && lockedT.has(String(n.itemId).slice(5)))),
    ...(older.notes || []).filter((n) => n && n.id && !nHave.has(n.id) && !n.deleted && !hidden(n))];
  return { ...D, tasks, notes, lockedT };
}

const TSTAT = (t) => (t.status === "review" ? "확인 대기" : t.status === "dropped" ? "중단" : STATUS_L[t.status] || "할 일");
const FIELD_RANK = { title: 0, text: 0, memo: 1, who: 2, where: 2 };
// 사람 이름들
const names = (D, ids) => (ids || []).map((id) => nameOf(D.users, id)).filter(Boolean);

// 찾기 — q(그대로 넣은 글) · opt {uid, mine, cu} → { q, task, proj, note, rt } (각 줄 {key, kind, id, title, field, snip, where, who, stat, date, done, red, tag, go})
export function searchAll(D, q0, opt = {}) {
  const q = norm(q0), out = { q, task: [], proj: [], note: [], rt: [] }; if (!q) return out;
  const uid = opt.uid || (opt.cu && opt.cu.id) || "", mine = !!opt.mine, master = isMaster(opt.cu);
  const pm = new Map((D.projects || []).map((p) => [p.id, p]));
  const today = opt.today || "";
  // 업무 (일회성)
  (D.tasks || []).forEach((t) => {
    if (!t || t.isFixed || t.deleted || t.locked) return;
    if (mine && !(isMine(t, uid) || t.requestedBy === uid || t.assignedBy === uid || (t.ccIds || []).includes(uid) || t.createdBy === uid)) return;
    const p = pm.get(t.projectId), pLocked = p && p.locked, who = names(D, ownersOf(t)).join(", ") || t.ghAssigneeName || "";
    const where = p && !pLocked ? p.title : t.brand ? brandLabel(t.brand, D.brands) : "";
    const field = has(t.title, q) ? "title" : has(t.memo, q) ? "memo" : has(who, q) ? "who" : where && has(where, q) ? "where" : null; if (!field) return;
    const done = t.status === "done" || t.status === "dropped", due = dueOf(t);
    out.task.push({ key: "t:" + t.id, kind: "task", id: t.id, title: t.title || "(제목 없음)", field, snip: field === "memo" ? snippet(t.memo, q) : "", where, who, stat: TSTAT(t), done,
      date: done ? (t.doneAt ? md(String(t.doneAt).slice(0, 10)) + " 끝냄" : "") : due ? "기한 " + md(due) : "", red: !done && !!due && !!today && due < today && t.status !== "hold",
      sort: done ? "1" + (9e15 - Date.parse(t.doneAt || 0)) : "0" + (due || "9999"), go: { type: "task", id: t.id } });
  });
  // 프로젝트
  (D.projects || []).forEach((p) => {
    if (!p || p.deleted || p.locked) return;
    if (mine && !(p.assigneeId === uid || (p.collaboratorIds || []).includes(uid) || p.createdBy === uid)) return;
    const who = nameOf(D.users, p.assigneeId), where = [brandLabel(p.brand, D.brands), p.lbProjectName].filter(Boolean).join(" · ");
    const nowT = p.now && typeof p.now === "object" ? p.now.text : "";
    const field = has(p.title, q) ? "title" : has(p.memo, q) ? "memo" : has(nowT, q) ? "memo" : has(who, q) ? "who" : has(where, q) ? "where" : null; if (!field) return;
    const st = projStLabel(p), done = st === "완료" || st === "중단", d = String(p.launchDate || p.dueDate || "").slice(0, 10);
    out.proj.push({ key: "p:" + p.id, kind: "proj", id: p.id, title: p.title || "(이름 없음)", field, snip: field === "memo" ? snippet(has(p.memo, q) ? p.memo : nowT, q) : "", where, who, stat: st, done,
      date: d ? (p.launchDate ? "출시 " : "마감 ") + md(d) : "", sort: (done ? "1" : "0") + (d || "9999"), go: { type: "project", id: p.id } });
  });
  // 댓글
  (D.notes || []).forEach((n) => {
    if (!n || n.deleted || !n.text) return;
    if (mine && n.by !== uid) return;
    const iid = String(n.itemId || ""); if (!iid.includes(":") && iid.includes("~") && iid.split("~")[1] !== uid && !master) return;   // 버전1 사람별 고정업무 메모 = 본인·관리자만
    const who = n.byName || nameOf(D.users, n.by), w = noteWhere(D, n);
    if ((w.t && w.t.locked) || (w.p && w.p.locked)) return;
    const field = has(n.text, q) ? "text" : has(who, q) ? "who" : has(w.title, q) ? "where" : null; if (!field) return;
    out.note.push({ key: "n:" + n.id, kind: "note", id: n.id, title: snippet(n.text, q, 44), field, where: `${w.kind} · ${w.title}`, who, reply: !!n.parentId, stat: "", done: false,
      date: n.at ? md(String(n.at).slice(0, 10)) : "", at: n.at || "", sort: String(9e15 - Date.parse(n.at || 0)), go: w.go });
  });
  // 반복 실행 · 고정업무 (남의 개인 고정업무는 본인·관리자만)
  const rtPush = (x, extra) => out.rt.push({ stat: "", done: false, date: "", ...x, ...extra });
  (D.tasks || []).forEach((t) => {
    if (!t || !t.isFixed || t.deleted) return;
    const sc = scopeOf(t), myFx = fxIsMine(t, uid) || t.createdBy === uid;
    if (sc === "me" && !myFx && !master) return;
    if (mine && !myFx) return;
    const who = t.forAll ? "전체" : names(D, fxIds(t)).join(", "), br = sc === "brand" ? brandLabel(t.brand, D.brands) : "", lb = (t.labelBy || {})[uid] || "";
    const field = has(t.title, q) || has(lb, q) ? "title" : has(who, q) ? "who" : br && has(br, q) ? "where" : null; if (!field) return;
    rtPush({ key: "f:" + t.id, kind: "fx", id: t.id, title: t.title || "", field, where: sc === "brand" ? `반복 실행 · ${br || "브랜드"}` : sc === "me" ? "고정업무 · 개인" : "고정업무", who, stat: t.paused ? "멈춤" : fxRecurL(t), sort: "0" + (t.title || ""), go: { type: "fixed", id: t.id } });
  });
  ((D.ak && D.ak.items) || []).forEach((it) => {
    if (!it || !it.id) return;
    const ids = Array.isArray(it.who) ? it.who : [], me = ids.includes(uid) || (it.whoNames || []).includes(nameOf(D.users, uid));
    if (mine && !me) return;
    const who = (it.whoNames && it.whoNames.length ? it.whoNames : names(D, ids)).join(", "), br = brandLabel(it.brand, D.brands);
    const field = has(it.name, q) ? "title" : has(who, q) ? "who" : br && has(br, q) ? "where" : null; if (!field) return;
    rtPush({ key: "a:" + it.id, kind: "ak", id: it.id, title: it.name || "", field, where: `횟수 목표 · ${br || "브랜드"}`, who, stat: it.active === false ? "멈춤" : "", sort: "0" + (it.name || ""), go: { type: "routine", id: it.id } });
  });
  // 없앤 것(휴지통) — 볼 수 있는 사람만 (관리자 = 전부 · 팀원 = 내 개인 고정업무만 · model.trashRows 와 같음)
  const tr = master ? trashRows(D.removedFx, D.ak && D.ak.removed, D.brands) : trashRows(D.removedFx, null, D.brands, uid);
  tr.forEach((r) => {
    if (mine && !(r.kind === "fx" ? fxIsMine(r.x, uid) || r.x.createdBy === uid : (r.x.who || []).includes(uid))) return;
    const field = has(r.name, q) ? "title" : has(r.sub, q) ? "where" : null; if (!field) return;
    rtPush({ key: (r.kind === "fx" ? "f:" : "a:") + r.id, kind: r.kind, id: r.id, title: r.name, field, where: r.sub, who: r.byName ? `${r.byName} 없앰` : "", stat: "", date: r.at ? md(String(r.at).slice(0, 10)) : "", tag: "없앤 것", removed: true,
      sort: "1" + (r.name || ""), go: r.kind === "fx" ? { type: "fixed", id: r.id } : { type: "routine", id: r.id } });
  });
  const by = (a, b) => (FIELD_RANK[a.field] - FIELD_RANK[b.field]) || String(a.sort).localeCompare(String(b.sort));
  ["task", "proj", "note", "rt"].forEach((k) => out[k].sort(by));
  return out;
}

// 최근 찾은 말 (기기 저장 · 최근 것 먼저 · 8개)
export const RECENT_MAX = 8;
export function addRecent(list, q) { const s = String(q || "").trim(); if (!s) return list || []; return [s, ...(list || []).filter((x) => norm(x) !== norm(s))].slice(0, RECENT_MAX); }

// '더 오래된 것도 찾기' 읽기 단계 — 같음 조건만(orderBy 없음) · 단계마다 하나씩
export const OLDER_STEPS = [
  { key: "tasks", w: ["status", "==", "done"], label: "끝낸 업무" },
  { key: "tasks", w: ["status", "==", "dropped"], label: "중단한 업무" },
  { key: "notes", w: null, label: "댓글" },
];
