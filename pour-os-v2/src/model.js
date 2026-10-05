// 업무OS v2 — 계산 로직만 (화면은 App.jsx, 저장은 fb.js)
//
// 저장 구조 (v1 과 완전히 분리 · 보안규칙 pour-os/{doc=**} 안이라 규칙 변경 없음)
//  · pour-os/v2                     복사 정보 {seededAt, seededBy, counts}
//  · pour-os/v2/<키>/{id}           1건 = 문서 1개 (업무·프로젝트·사람·댓글·기록 …)
//      → 서로 다른 업무를 동시에 고쳐도 덮어쓰지 않음. 같은 업무도 바뀐 칸만 저장(updateDoc)
//  · pour-os/v2/checks/{업무~사람~날짜}  고정업무 체크 기록 (누가 몇 시에 했나)
//  · v1 문서(pour-os/state-*, ak-notes)는 읽기만 한다. 절대 쓰지 않는다.

// ── 날짜 (기기 날짜 기준 — v1 의 '아침 9시 전 체크가 전날로' 문제 없음) ──
export const pad2 = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const addDays = (key, n) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const FX_WD = ["월", "화", "수", "목", "금", "토", "일"];
export const weekStart = (key) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const ddays = (due, today) => (due ? Math.round((new Date(String(due).slice(0, 10) + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null);
export const ddayLabel = (n) => (n == null ? "" : n < 0 ? `${-n}일 지남` : n === 0 ? "오늘" : `D-${n}`);
export const md = (key) => { if (!key) return ""; const s = String(key).slice(0, 10).split("-"); return s.length < 3 ? String(key) : `${+s[1]}/${+s[2]}`; };
export const hm = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export function ago(iso, now = new Date()) {
  if (!iso) return ""; const t = new Date(iso); if (isNaN(t)) return "";
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "방금"; if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}일 전`;
  return md(ymd(t));
}
export const dayTitle = (now) => `${now.getMonth() + 1}월 ${now.getDate()}일 (${WD[now.getDay()]})`;
// 공휴일 (기한 계산에서 건너뜀 · 달력 날짜 회색). 2026~2028 · 노동절(5/1)·제헌절(7/17)은 2026년부터 공휴일
// 음력(설·추석·부처님오신날)·선거일·임시공휴일은 해마다 달라짐 → 6단계에서 공식 특일 정보로 매달 자동 확인 예정
export const KR_HOLIDAYS = {
  "2026-01-01": "신정", "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴", "2026-03-01": "삼일절", "2026-03-02": "삼일절 대체공휴일",
  "2026-05-01": "노동절", "2026-05-05": "어린이날", "2026-05-24": "부처님오신날", "2026-05-25": "부처님오신날 대체공휴일", "2026-06-03": "지방선거일",
  "2026-06-06": "현충일", "2026-07-17": "제헌절", "2026-08-15": "광복절", "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절", "2026-10-05": "개천절 대체공휴일", "2026-10-09": "한글날", "2026-12-25": "성탄절",
  "2027-01-01": "신정", "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴", "2027-02-09": "설날 대체공휴일",
  "2027-03-01": "삼일절", "2027-05-01": "노동절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날", "2027-06-06": "현충일",
  "2027-07-17": "제헌절", "2027-07-19": "제헌절 대체공휴일", "2027-08-15": "광복절", "2027-08-16": "광복절 대체공휴일",
  "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴", "2027-10-03": "개천절", "2027-10-04": "개천절 대체공휴일",
  "2027-10-09": "한글날", "2027-10-11": "한글날 대체공휴일", "2027-12-25": "성탄절", "2027-12-27": "성탄절 대체공휴일",
  "2028-01-01": "신정", "2028-01-25": "설날 연휴", "2028-01-26": "설날", "2028-01-27": "설날 연휴", "2028-03-01": "삼일절",
  "2028-04-12": "국회의원 선거일", "2028-05-01": "노동절", "2028-05-02": "부처님오신날", "2028-05-05": "어린이날", "2028-06-06": "현충일",
  "2028-07-17": "제헌절", "2028-08-15": "광복절", "2028-10-02": "추석 연휴", "2028-10-03": "추석 · 개천절", "2028-10-04": "추석 연휴",
  "2028-10-05": "추석 대체공휴일", "2028-10-09": "한글날", "2028-12-25": "성탄절",
};
// 쉬는 날 더하기 층: fetched = 매달 자동 갱신한 공식 특일 정보(holidays.json) · company = 회사만 쉬는 날(관리자 설정). 위 표는 못 읽을 때의 대비
const HOL_LAYERS = { fetched: {}, company: {} }; let HOL_EXTRA = {};
export const setHolidayLayer = (name, days) => { HOL_LAYERS[name] = days && typeof days === "object" ? days : {}; HOL_EXTRA = { ...HOL_LAYERS.fetched, ...HOL_LAYERS.company }; };
export const holidayLayer = (name) => HOL_LAYERS[name] || {};
export const holidayName = (key) => KR_HOLIDAYS[key] || HOL_LAYERS.company[key] || HOL_LAYERS.fetched[key] || "";
export const isOffDay = (key) => { const w = new Date(key + "T00:00:00").getDay(); return w === 0 || w === 6 || !!KR_HOLIDAYS[key] || !!HOL_EXTRA[key]; };
export const prevWorkday = (key) => { let k = key; for (let i = 0; i < 14 && isOffDay(k); i++) k = addDays(k, -1); return k; };
export const nextWorkday = (key) => { let k = key; for (let i = 0; i < 14 && isOffDay(k); i++) k = addDays(k, 1); return k; };

// ── 사람 ──
export const DEFAULT_MASTER_NAMES = ["김송희", "이란", "김소연", "허지은"];
const norm = (s) => String(s || "").replace(/\s/g, "");
export const isMaster = (u) => !!u && (u.master === true || (u.master === undefined && (u.role === "lead" || DEFAULT_MASTER_NAMES.includes(norm(u.name)))));
export const activeUsers = (users) => (users || []).filter((u) => u && u.active !== false);
export const nameOf = (users, id) => ((users || []).find((u) => u.id === id) || {}).name || "";

// ── 업무 ──
export const STATUS_L = { todo: "할 일", inprogress: "진행 중", hold: "보류", done: "끝남", dropped: "중단(접음)" };
export const isDone = (t) => t && t.status === "done";
export const isOneOff = (t) => t && !t.isFixed;
export const ownersOf = (t) => (Array.isArray(t.assigneeIds) && t.assigneeIds.length ? t.assigneeIds : t.assigneeId ? [t.assigneeId] : []);
export const isMine = (t, uid) => !!t && (t.assigneeId === uid || ownersOf(t).includes(uid));
export const dueOf = (t) => String(t.dueDate || t.workDate || "").slice(0, 10);

// ── 고정업무 (v1 과 같은 칸을 그대로 읽고 씀: doneDates·doneAtBy·subDone 는 사람별 칸) ──
export const fxIds = (t) => ownersOf(t);
export const fxWeekDays = (t) => { const a = Array.isArray(t.weekDays) && t.weekDays.length ? t.weekDays : [t.weekDay || "월"]; return FX_WD.filter((d) => a.includes(d)); };
export const fxIsMine = (t, uid) => (t.forAll ? true : fxIds(t).includes(uid));
export const fxPeople = (users, t) => (t.forAll ? activeUsers(users).map((u) => u.id) : fxIds(t).filter((id) => { const u = (users || []).find((x) => x.id === id); return !u || u.active !== false; }));
const lastDay = (key) => { const d = new Date(key.slice(0, 7) + "-01T00:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.getDate(); };
// 그 달 마지막 평일 (주말·공휴일이면 앞 평일)
export const monthEndWorkday = (key) => prevWorkday(key.slice(0, 7) + "-" + pad2(lastDay(key)));
// 고정업무 할 날 — 모든 화면이 이 규칙 하나: 쉬는 날(주말·공휴일)에는 없음 · 매일 = 평일 · 매주 정한 요일이 쉬는 날이면 앞 평일로
//  · 매월 정한 날(31일 → 그 달 말일)이 쉬는 날이면 앞 평일(그 달을 넘어가면 뒤 평일) · 말일(평일) = 그 달 마지막 평일
const fxMonthDay = (t, key) => { if (t.monthEnd) return monthEndWorkday(key); const d = key.slice(0, 7) + "-" + pad2(Math.min(Number(t.monthDay || 1), lastDay(key)));
  if (!isOffDay(d)) return d; const p = prevWorkday(d); return p.slice(0, 7) === d.slice(0, 7) ? p : nextWorkday(d); };
export const fxDueOn = (t, key) => { if (isOffDay(key)) return false; const rt = t.recurType || "daily";
  if (rt === "monthly") return key === fxMonthDay(t, key);
  if (rt === "weekly") { const days = fxWeekDays(t); for (let k = 0; k < 7; k++) { const x = addDays(key, k); if (k > 0 && !isOffDay(x)) break; if (days.includes(WD[new Date(x + "T00:00:00").getDay()])) return true; } return false; }
  return true; };
// 이번 주기(매주 = 이번 주 · 매월 = 이번 달)에 지나간 할 날을 못 했으면 그 날 (매일은 없음) → 오늘 화면 '밀림'
// 매주: 이번 주 할 날이 쉬는 날이라 지난주(금 등)로 당겨진 것도 이번 주 몫으로 셈 (예: 월요일 대체공휴일 → 지난 금요일) — 원래 요일 날짜(fxOrigin)가 이번 주 안이면
const fxOrigin = (t, d) => { const days = fxWeekDays(t); for (let k = 0; k < 7; k++) { const x = addDays(d, k); if (k > 0 && !isOffDay(x)) break; if (days.includes(WD[new Date(x + "T00:00:00").getDay()])) return x; } return d; };
export const fxMissOf = (t, uid, key) => { const rt = t.recurType || "daily"; if (rt === "daily") return "";
  const ws = rt === "weekly" ? weekStart(key) : "", from = rt === "weekly" ? addDays(ws, -6) : key.slice(0, 7) + "-01"; let last = "";
  for (let d = from; d < key; d = addDays(d, 1)) if (fxDueOn(t, d) && (rt !== "weekly" || d >= ws || fxOrigin(t, d) >= ws)) last = d; if (!last) return "";
  const done = fxDoneOn(t, uid), d0 = done ? String(done).slice(0, 10) : ""; return d0 && (fxHit(t, d0, last) || d0 > last) ? "" : last; };
export const fxDoneOn = (t, uid) => (t.doneDates && Object.prototype.hasOwnProperty.call(t.doneDates, uid) ? t.doneDates[uid] : t.assigneeId === uid ? t.doneDate : null);
export const fxHit = (t, d, key) => { if (!d) return false; const rt = t.recurType || "daily";
  if (rt === "weekly") { const days = fxWeekDays(t); if (days.length <= 1) return d >= weekStart(key) && d <= key;
    for (let i = 0; i < 7; i++) { const k = addDays(key, -i); if (fxDueOn(t, k)) return d >= k && d <= key; } return false; }   // 가장 가까운 할 날(쉬는 날이면 앞 평일로 옮긴 날) 뒤 체크
  if (rt === "monthly") return String(d).slice(0, 7) === key.slice(0, 7);
  return d === key; };
export const fxMeDone = (t, uid, key) => fxHit(t, fxDoneOn(t, uid), key);
export const fxCount = (users, t, key) => { const ids = fxPeople(users, t); return [ids.filter((id) => fxMeDone(t, id, key)).length, ids.length]; };
export const fxTime = (t, uid) => (uid && t.timeBy && t.timeBy[uid]) || t.fixedTime || "";
export const fxMin = (t, uid) => { const m = /^(\d{1,2}):(\d{2})/.exec(fxTime(t, uid)); return m ? +m[1] * 60 + +m[2] : 9999; };
export const fxLabel = (t, uid) => (uid && t.labelBy && t.labelBy[uid]) || t.title || "";
export const fxSubs = (t, uid) => ((t.subsBy && (t.subsBy[uid] && t.subsBy[uid].length ? t.subsBy[uid] : t.subsBy["*"])) || []).filter((x) => x && x.title);
export const fxRecurL = (t) => { const rt = t.recurType || "daily"; if (rt === "weekly") { const a = fxWeekDays(t); return "매주 " + (a.length === 5 && !a.includes("토") && !a.includes("일") ? "평일" : a.join("·")); } if (rt === "monthly") return t.monthEnd ? "매월 말일(평일)" : `매월 ${t.monthDay || 1}일`; return "매일"; };
export const fxDoneWord = (t) => ({ weekly: "이번 주 완료", monthly: "이번 달 완료" }[t.recurType] || "오늘 완료");
// 체크/해제 → 바뀐 칸만 (점 경로) — 다른 사람 체크를 덮어쓰지 않음
export function fxCheckPatch(t, uid, on, key, at, name) {
  const p = { [`doneDates.${uid}`]: on ? key : null, [`doneAtBy.${uid}`]: on ? at : null };
  if (on) { p.doneAt = at; p.doneByName = name || ""; }
  fxSubs(t, uid).forEach((x) => { p[`subDone.${uid}.${x.id}`] = on ? key : null; });
  return p;
}

// ── 업무 흐름 규칙 (맡김 → 받음 → 진행 → 끝냄 → 확인) ──
// 다른 사람이 맡긴 일이면 맡긴 사람 id
export const reqOf = (t) => (t && t.requestedBy && !ownersOf(t).includes(t.requestedBy) ? t.requestedBy : "");
// 끝내면 맡긴 사람이 확인하는 일인가 (신제품 항목처럼 noReview 면 바로 끝)
export const needsReview = (t) => !!reqOf(t) && !t.noReview;
// 기한을 바꿀 때 허락할 사람: 맡긴 사람 → (신제품 항목이면) 제품 책임자(담당이 아닐 때) → 없음
// (예전 업무처럼 맡긴 사람 기록이 없는 일은 담당이 바로 바꿈. 신제품 항목은 출시일에 걸리므로 책임자 허락)
export function dueApprover(t, D) {
  const r = reqOf(t); if (r) return r;
  if (!t.launchItem) return "";
  const p = (D.projects || []).find((x) => x.id === t.projectId);
  return p && p.assigneeId && !ownersOf(t).includes(p.assigneeId) ? p.assigneeId : "";
}
// 요청(확인 받기 · 도와주세요 · 기한 바꾸기 · 막힘)을 받을 사람 기본값: 맡긴 사람 → 넘겨준 사람 → 프로젝트 책임자 → 마스터 (나는 빼고) — 아무에게도 안 가는 요청이 없게
export function askTo(t, D, me) {
  const p = (D.projects || []).find((x) => x.id === t.projectId), act = (u) => u && u !== me && (D.users || []).some((x) => x.id === u && x.active !== false);
  for (const u of [reqOf(t), t.assignedBy, p && p.assigneeId]) if (act(u)) return u;
  const m = (D.users || []).find((u) => u.active !== false && u.id !== me && isMaster(u)); return m ? m.id : "";
}
export const canSetDue = (t, uid, D, master) => !!master || !dueApprover(t, D) || dueApprover(t, D) === uid;
// 위험 신호 한 개 (가장 급한 것)
export function riskOf(t, key) {
  if (!t || isDone(t)) return null;
  if (t.status === "hold") return { k: "hold", label: t.holdUntil ? `보류 · ${md(t.holdUntil)} 다시` : "보류" };   // 보류는 '지남'(빨강)으로 보이지 않게 먼저
  const n = ddays(dueOf(t), key);
  if (t.blocked) return { k: "blocked", label: "막힘", red: true };
  if (n != null && n < 0 && t.status !== "review") return { k: "late", label: `${-n}일 지남`, red: true };
  if (t.status === "review") return { k: "review", label: "확인 대기" };
  if (t.feedback) return { k: "feedback", label: "수정 요청" };   // 빨강은 지남·막힘에만
  if (n === 0) return { k: "today", label: "오늘 마감" };
  if (n != null && n <= 2 && t.status === "todo") return { k: "start", label: n === 1 ? "내일 마감 · 시작 전" : "D-2 · 시작 전" };
  if (n === 1) return { k: "soon", label: "내일 마감" };
  return null;
}
// 지금 할 일 고르는 순서 (한 번에 하나): 수정 요청 → 지난 일 → 진행 중 → 오늘 마감 → 곧 마감(시작 전) → 마감 가까운 순 → 날짜 없음
// fresh = 방금 앞 일이 끝나 '이제 내 차례'가 된 일 (turn.js). 기한 7일 안이면 지난 일보다 먼저, 아니면 진행 중 다음
//   2주 넘게 지난 일(OLD_LATE)은 '지금 할 일' 카드를 차지하지 않음 — 오늘·곧 마감 다음 (지난 일 숫자·'하나씩 정리하기'에는 그대로)
export const OLD_LATE = 14;
export function focusRank(t, key, fresh) {
  const n = ddays(dueOf(t), key);
  if (t.feedback) return 0; if (fresh && n != null && n <= 7) return 0.5; if (n != null && n < 0 && n >= -OLD_LATE) return 1; if (t.status === "inprogress") return 2;
  if (fresh) return 2.5; if (n === 0) return 3; if (n != null && n < 0) return 4.5; if (n != null && n <= 2) return 4; if (n != null) return 5; return 6;
}

// ── 오늘 화면 ──
// seen: {id:true} 이 기기에서 이미 본 것 (댓글·결과 알림만. 할 일이 남은 알림은 처리해야 사라짐)
// T (turn.js turnsOf 결과, 없어도 됨): {temp:Set 임시 담당, fresh:Set 이제 내 차례, inbox:[차례 알림], shownNotes:Set 카드에 보이는 앞 일 마지막 말, predIds:Set 내 일의 앞 일}
export function todayView(D, uid, now = new Date(), seen = {}, T = null) {
  const temp = (T && T.temp) || new Set(), fresh = (T && T.fresh) || new Set();
  const key = ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const tasks = D.tasks || [], users = D.users || [];
  // 오늘 고정업무 — 오늘 해당분만, 시간순
  const fxMiss = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && !fxDueOn(t, key)).map((t) => ({ t, miss: fxMissOf(t, uid, key) })).filter((x) => x.miss)
    .map((x) => ({ ...x, min: fxMin(x.t, uid), me: false }));   // 이번 주·달에 못 한 매주·매월 고정업무 → 할 때까지 '밀림'
  const fx = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && fxDueOn(t, key))
    .map((t) => ({ t, min: fxMin(t, uid), me: fxMeDone(t, uid, key) })).concat(fxMiss)
    .sort((a, b) => a.min - b.min || fxLabel(a.t, uid).localeCompare(fxLabel(b.t, uid)));
  const fixed = { left: fx.filter((x) => !x.me).map((x) => ({ ...x, late: !!x.miss || (x.min < 9999 && x.min < nowMin) })).sort((a, b) => (b.miss ? 1 : 0) - (a.miss ? 1 : 0)), done: fx.filter((x) => x.me), total: fx.length };
  // 내 할 일 (확인 대기·보류 빼고) — 지금 할 일 순서대로
  const open = tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const active = open.filter((t) => t.status !== "review" && t.status !== "hold" && !temp.has(t.id));   // 임시 담당(책임자로 채운 신제품 항목)은 '정리'로만
  const impP = Object.fromEntries((D.projects || []).map((p) => [p.id, IMP_RANK[impOf(p)]]));   // 같은 순위·같은 날이면 중요 높은 프로젝트 일 먼저
  const ranked = active.map((t) => ({ t, r: focusRank(t, key, fresh.has(t.id)), n: ddays(dueOf(t), key), risk: riskOf(t, key), fresh: fresh.has(t.id) }))
    .sort((a, b) => a.r - b.r || (a.n ?? 999) - (b.n ?? 999) || (impP[a.t.projectId] ?? 1) - (impP[b.t.projectId] ?? 1) || String(a.t.title).localeCompare(String(b.t.title)));
  const focus = ranked.filter((x) => x.r <= 4);              // 오늘 화면에 보일 급한 일
  const late = ranked.filter((x) => x.n != null && x.n < 0);  // 지난 일 정리 대상
  const doing = open.filter((t) => t.status === "inprogress").length;
  // 확인할 것
  const myProj = new Set((D.projects || []).filter((p) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid)).map((p) => p.id));
  const projAll = new Set([...myProj, ...tasks.filter((t) => !t.isFixed && t.projectId && isMine(t, uid)).map((t) => t.projectId)]);   // 프로젝트 한마디는 그 프로젝트 업무 담당에게도 (업무 댓글은 그대로 책임자·함께)
  const since = new Date(now - 7 * 86400000).toISOString();
  const inbox = []; const launchNew = {}, bulkNew = {};
  // '이제 내 차례' 카드에 '앞 일 마지막 말'로 보이는 댓글 하나만 댓글 줄로 또 띄우지 않음 (T.shownNotes · 없으면 예전처럼 앞 일들의 한마디)
  const shown = T && T.shownNotes instanceof Set ? T.shownNotes : null;
  const freshPreds = new Set(); if (!shown && T && T.byTask) fresh.forEach((id) => ((T.byTask.get(id) || {}).preds || []).forEach((p) => freshPreds.add(p.id)));
  const predIds = (T && T.predIds instanceof Set) ? T.predIds : new Set();   // 내 열린 일의 앞 일 → 거기 남긴 한마디는 프로젝트 멤버가 아니어도 나에게
  tasks.forEach((t) => {
    if (isDone(t) && !t.isFixed && t.approvedAt && t.approvedAt >= since && t.approvedBy !== uid && isMine(t, uid) && !seen["ap:" + t.id + t.approvedAt])
      inbox.push({ kind: "approved", tag: "확인 완료", id: "ap:" + t.id + t.approvedAt, taskId: t.id, title: t.title, who: t.approvedBy, at: t.approvedAt, text: "끝난 일로 확인됐어요" });
    if (isDone(t) || t.isFixed) return;
    const mine = isMine(t, uid);
    const ub = t.unblocked;
    if (ub && ub.at >= since && ub.by !== uid && !t.blocked && (mine || ub.was === uid || ub.to === uid) && !seen["ub:" + t.id + ub.at])
      inbox.push({ kind: "unblocked", tag: "막힘 풀림", id: "ub:" + t.id + ub.at, taskId: t.id, title: t.title, who: ub.by, whoName: ub.byName, at: ub.at, text: ub.reason ? `풀림 · ${ub.reason}` : "막힌 게 풀렸어요" });
    if (mine && t.feedback && t.status !== "review") inbox.push({ kind: "feedback", tag: "수정 요청", id: "fb:" + t.id, taskId: t.id, title: t.title, who: t.feedback.by, whoName: t.feedback.byName, at: t.feedback.at, text: t.feedback.text, keep: true });
    else if (mine && (reqOf(t) || (t.assignedBy && t.assignedBy !== uid)) && !t.ackAt && (t.status === "todo" || (t.handoff && t.handoff.to === uid && t.handoff.by !== uid)) && !temp.has(t.id)) {
      if (t.bulkId) { const g = (bulkNew[t.bulkId] = bulkNew[t.bulkId] || { n: 0, who: t.assignedBy, at: t.assignedAt, pid: t.projectId, pids: new Set(), ids: [], from: t.handoff && t.handoff.all ? t.handoff.from : null }); g.n++; g.ids.push(t.id); g.pids.add(t.projectId || ""); }
      else if (t.launchItem) { const g = (launchNew[t.projectId] = launchNew[t.projectId] || { n: 0, who: t.assignedBy || t.requestedBy, at: t.assignedAt || t.requestedAt }); g.n++; }
      else inbox.push({ kind: "assigned", tag: "맡김", id: "as:" + t.id, taskId: t.id, title: t.title, who: reqOf(t) || t.assignedBy, at: (reqOf(t) && t.requestedAt) || t.assignedAt || t.requestedAt, text: dueOf(t) ? `기한 ${md(dueOf(t))}` : "", keep: true });
    }
    if (t.dueReq && (t.dueReq.to || dueApprover(t, D)) === uid) inbox.push({ kind: "dueReq", tag: "기한 조정", id: "dq:" + t.id, taskId: t.id, title: t.title, who: t.dueReq.by, whoName: t.dueReq.byName, at: t.dueReq.at, text: `${md(dueOf(t)) || "미정"} → ${md(t.dueReq.date)}${t.dueReq.reason ? " · " + t.dueReq.reason : ""}`, keep: true });
    if (t.status === "review" && (t.reviewTo || reqOf(t)) === uid) inbox.push({ kind: "review", tag: "확인 요청", id: "rv:" + t.id, taskId: t.id, title: t.title, who: ownersOf(t)[0], at: t.reviewAt || t.updatedAt, text: "끝냈어요 · 확인해 주세요", keep: true });
    if (t.blocked && !mine && (t.blocked.to === uid || reqOf(t) === uid || dueApprover(t, D) === uid || ((D.projects || []).find((p) => p.id === t.projectId) || {}).assigneeId === uid)) inbox.push({ kind: "blocked", tag: "막힘", red: true, id: "bk:" + t.id, taskId: t.id, title: t.title, who: t.blocked.by, whoName: t.blocked.byName, at: t.blocked.at, text: t.blocked.reason, keep: true });
    if (t.ask && t.ask.kind === "help" && t.ask.to === uid) inbox.push({ kind: "help", tag: "도움 요청", id: "hp:" + t.id + t.ask.at, taskId: t.id, title: t.title, who: t.ask.by, whoName: t.ask.byName, at: t.ask.at, text: t.ask.text || "", keep: true });
    if (t.handoff && t.handoff.by !== uid && t.handoff.at >= since && !seen["ho:" + t.id + t.handoff.at] && ((t.handoff.from || []).includes(uid) || reqOf(t) === uid) && t.handoff.to !== uid) inbox.push({ kind: "handed", tag: "담당 바뀜", id: "ho:" + t.id + t.handoff.at, taskId: t.id, title: t.title, who: t.handoff.by, whoName: t.handoff.byName, at: t.handoff.at, text: `${(t.handoff.from || []).map((x) => nameOf(users, x)).filter(Boolean).join("·") || "담당 없음"} → ${nameOf(users, t.handoff.to) || "?"}${t.handoff.note ? " · " + t.handoff.note : ""}` });
    if (mine && t.status === "hold" && t.holdUntil && t.holdUntil <= key && !t.holdBy) inbox.push({ kind: "holdDue", tag: "다시 볼 날", id: "hd:" + t.id + ":" + t.holdUntil, taskId: t.id, title: t.title, who: t.heldBy, at: t.holdUntil + "T00:00:00", text: `보류${t.holdReason ? " · " + t.holdReason : ""} · ${md(t.holdUntil)}에 다시 보기로 함`, keep: true });
    if (mine && t.dueReqResult && !seen["dr:" + t.id + t.dueReqResult.at]) inbox.push({ kind: "dueRes", tag: t.dueReqResult.ok ? "기한 바뀜" : "기한 유지", id: "dr:" + t.id + t.dueReqResult.at, taskId: t.id, title: t.title, who: t.dueReqResult.by, whoName: t.dueReqResult.byName, at: t.dueReqResult.at, text: t.dueReqResult.ok ? `새 기한 ${md(dueOf(t))}` : t.dueReqResult.reason || "기한은 그대로예요" });
  });
  Object.entries(launchNew).forEach(([pid, g]) => { const p = (D.projects || []).find((x) => x.id === pid);
    inbox.push({ kind: "launchNew", tag: "신제품", id: "ln:" + pid, projectId: pid, title: `${p ? p.title : "신제품"} · 항목 ${g.n}개 맡김`, who: g.who, at: g.at, text: "열어서 기한을 확인하고 '받았어요'를 눌러 주세요", keep: true }); });
  Object.entries(bulkNew).forEach(([bid, g]) => { const p = (D.projects || []).find((x) => x.id === g.pid);
    const one = g.pids.size === 1 && g.pid, fromN = g.from ? g.from.map((x) => nameOf(users, x)).filter(Boolean).join("·") : "";
    inbox.push({ kind: "bulk", tag: g.from ? "넘겨받음" : "맡김", id: "bl:" + bid, bulkIds: g.ids, projectId: one ? g.pid : null, mine: !one, title: g.from ? `${fromN || "다른 사람"}님 업무 ${g.n}개 넘겨받음` : `${one && p ? p.title + " · " : ""}항목 ${g.n}개 맡김`, who: g.who, at: g.at, text: "기한을 확인하고 '받았어요'를 눌러 주세요", keep: true }); });
  // PIN을 처음 정한 사람 (시작 코드 없이) → 마스터에게 7일 동안 — 본인이 아니면 사람 보기에서 PIN 초기화
  if (isMaster(users.find((u) => u.id === uid))) users.forEach((u) => { if (u.id !== uid && u.pinSetAt && u.pinSetAt >= since && !u.pinByCode && !seen["pn:" + u.id + u.pinSetAt])
    inbox.push({ kind: "pinNew", tag: "PIN 처음 정함", id: "pn:" + u.id + u.pinSetAt, personId: u.id, title: `${u.name}님이 PIN을 정했어요`, who: u.id, at: u.pinSetAt, text: "본인이 맞는지 확인해 주세요 · 아니면 PIN 초기화" }); });
  // 보류한 프로젝트 '다시 할 날'이 되면 책임자에게 (다시 시작하거나 날짜를 바꿀 때까지)
  (D.projects || []).forEach((p) => { if (isHoldP(p) && p.holdUntil && p.holdUntil <= key && p.assigneeId === uid) inbox.push({ kind: "projHoldDue", tag: "다시 할 날", id: "ph:" + p.id + ":" + p.holdUntil, projectId: p.id, title: p.title, who: p.heldBy, at: p.holdUntil + "T00:00:00", text: `보류${p.holdReason ? " · " + p.holdReason : ""} · ${md(p.holdUntil)}에 다시 하기로 함`, keep: true }); });
  if (T && Array.isArray(T.inbox)) T.inbox.forEach((x) => inbox.push(x));
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const talked = new Set((D.notes || []).filter((n) => n && n.by === uid && !n.deleted).map((n) => n.itemId));   // 내가 말한 대화 → 답이 오면 나에게도
  (D.notes || []).forEach((n) => {
    if (!n || n.deleted || n.by === uid || (n.at || "") < since || seen["nt:" + n.id]) return;
    const [kind, ...rest] = String(n.itemId || "").split(":"); const ref = rest.join(":");
    let hit = null;
    if (kind === "task") { const t = taskById[ref]; if (shown ? shown.has(n.id) : n.handoff && freshPreds.has(ref)) return;
      if (t && (n.to === uid || isMine(t, uid) || reqOf(t) === uid || myProj.has(t.projectId) || (t.ccIds || []).includes(uid) || talked.has(n.itemId) || (n.handoff && predIds.has(ref)))) hit = { taskId: ref, title: t.title }; }
    else if (kind === "proj" && (projAll.has(ref) || talked.has(n.itemId))) { const p = (D.projects || []).find((x) => x.id === ref); hit = { projectId: ref, title: p ? p.title : "프로젝트" }; }
    if (hit) inbox.push({ kind: "note", tag: "댓글", id: "nt:" + n.id, ...hit, who: n.by, whoName: n.byName, at: n.at, text: n.text });
  });
  const ORDER = { feedback: 0, review: 1, dueReq: 2, help: 2.5, blocked: 3, handed: 7.5, turnAgain: 3.5, turnLate: 4, turnOrder: 5, nextNoOwner: 6, assigned: 7, bulk: 7, launchNew: 8, holdDue: 8.5, projHoldDue: 8.5, dueRes: 9, approved: 9, unblocked: 9, pinNew: 9.5, note: 10 };
  inbox.sort((a, b) => (ORDER[a.kind] ?? 11) - (ORDER[b.kind] ?? 11) || String(b.at || "").localeCompare(String(a.at || "")));
  const userName = (id) => nameOf(users, id);
  // 끝낸 시각은 UTC(toISOString) → 기기 날짜로 바꿔 비교 (아침 9시 전에 끝낸 일도 오늘)
  const localDay = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? ymd(d) : ""; };
  const doneToday = fixed.done.length + tasks.filter((t) => isOneOff(t) && isMine(t, uid) && (isDone(t) || t.status === "review") && localDay(t.doneAt || t.reviewAt) === key).length;
  const oneOffOpen = open.length;   // 0이면 '고정업무만 하는 사람' — 오늘 고정업무를 처음부터 펼침
  return { key, fixed, ranked, todo: ranked, focus, late, doing, inbox, userName, left: fixed.left.length + focus.length, doneToday, oneOffOpen, freshN: ranked.filter((x) => x.fresh).length };
}

// ── 맡긴 일 (지시자) ──
export function assignedByMe(D, uid, now = new Date()) {
  const key = ymd(now), wk = new Date(now - 7 * 86400000).toISOString();
  const mine = (D.tasks || []).filter((t) => !t.isFixed && reqOf(t) === uid);
  const g = { review: [], dueReq: [], blocked: [], late: [], risk: [], notAck: [], doing: [], waiting: [], done: [] };
  mine.forEach((t) => {
    if (isDone(t)) { if (String(t.doneAt || "") >= wk && !t.launchItem) g.done.push(t); return; }
    const r = riskOf(t, key);
    if (t.status === "review") g.review.push(t); else if (t.dueReq) g.dueReq.push(t); else if (t.blocked) g.blocked.push(t);
    else if (r && r.k === "late") g.late.push(t); else if (r && (r.k === "start" || r.k === "today")) g.risk.push(t);
    else if (t.launchItem) return;   // 신제품 항목은 제품 화면에서 (여기엔 급한 것만)
    else if (!t.ackAt && t.status === "todo") g.notAck.push(t); else if (t.status === "inprogress") g.doing.push(t); else g.waiting.push(t);
  });
  const byDue = (a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"));
  Object.values(g).forEach((a) => a.sort(byDue));
  return g;
}

// ── 업무량 (맡기기 전에 보기) — 앞으로 14일 날짜별 마감 수 ──
// skip: 빼고 셀 업무 id Set (예: 임시 담당)
export function workloadOf(D, uid, now = new Date(), days = 14, skip = null) {
  const key = ymd(now);
  const open = (D.tasks || []).filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid) && t.status !== "review" && !(skip && skip.has(t.id)));
  const byDay = {}; open.forEach((t) => { const d = dueOf(t); if (d) (byDay[d] = byDay[d] || []).push(t); });
  const week = [...Array(days)].map((_, i) => { const d = addDays(key, i); return { date: d, list: byDay[d] || [], wd: WD[new Date(d + "T00:00:00").getDay()] }; });
  const late = open.filter((t) => { const n = ddays(dueOf(t), key); return n != null && n < 0 && t.status !== "hold"; });
  return { open: open.length, doing: open.filter((t) => t.status === "inprogress").length, late: late.length, week, dueOn: (d) => byDay[d] || [] };
}
// 기한 지킨 비율 (최근 30일) — 담당이 끝낸 시각(finishedAt, 확인이 늦어도 담당 기준) · 확인 대기도 끝낸 것으로
//   + 아직 안 끝냈는데 최근 30일 안 기한이 이미 지난 일은 '못 지킴'으로 셈 (안 끝내고 두면 %가 오르던 것 바로잡음)
//   보류·중단·임시 담당(책임자로 채운 신제품 항목)은 빼고
export function onTimeOf(D, uid, now = new Date(), days = 30) {
  const since = new Date(now - days * 86400000).toISOString(), key = ymd(now), from = ymd(new Date(now - days * 86400000));
  const endOf = (t) => String(t.finishedAt || t.doneAt || t.reviewAt || "");
  const mine = (D.tasks || []).filter((t) => isOneOff(t) && isMine(t, uid) && dueOf(t));
  const done = mine.filter((t) => (isDone(t) || t.status === "review") && endOf(t) >= since);
  const ok = done.filter((t) => ymd(new Date(endOf(t))) <= dueOf(t)).length;
  const miss = mine.filter((t) => !isDone(t) && !["review", "hold", "dropped"].includes(t.status) && !(t.launchItem && (t.ownerFrom === "lead" || (!t.ownerFrom && t.ownerAuto))) && dueOf(t) >= from && dueOf(t) < key).length;
  const n = done.length + miss;
  return { n, ok, miss, pct: n ? Math.round((ok / n) * 100) : null };
}

// ── 프로젝트 ──
export const projOpen = (p) => p && p.status !== "completed" && p.status !== "done" && p.status !== "dropped" && !p.archived;   // 보류(hold)는 열린 것(보류 묶음) · 중단(dropped)은 끝난 것
export const projMine = (p, uid, tasks) => p.assigneeId === uid || (p.collaboratorIds || []).includes(uid) || (tasks || []).some((t) => t.projectId === p.id && !t.isFixed && isMine(t, uid));
// 프로젝트 진척 % — 모든 화면이 이 값 하나만 씀 (신제품 lb_ 은 launchPct). 저장된 progress = 전체 업무(오래전에 끝낸 것 포함)로 계산한 값:
//  업무를 끝내거나 다시 열 때 · 프로젝트를 열 때 · 마스터가 앱을 열면 하루 한 번 열린 프로젝트 전체를 다시 계산
export const projPct = (p) => Math.max(0, Math.min(100, Math.round(Number(p && p.progress) || 0)));
export function projStat(p, tasks, key) {
  const mine = (tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const open = mine.filter((t) => !isDone(t));
  const next = open.filter((t) => t.status !== "hold").sort((a, b) => (a.status === "inprogress" ? -1 : 0) - (b.status === "inprogress" ? -1 : 0) || String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9")))[0] || null;
  const n = ddays(p.dueDate, key);
  const pct = projPct(p);
  return { open: open.length, next, n, pct, late: n != null && n < 0 };
}
// 프로젝트 날짜 하나 → { date, n(D-day), late(빨강), launched(출시함), after(출시 후 며칠) }
// 출시일이 지난 신제품(lb_): 출시 뒤 항목(리뷰·체험단·광고)이 남아 있으므로 날짜 = 남은 항목의 가장 늦은 기한(없으면 출시일+21일),
//   빨강 = 남은 항목이 실제로 지났거나 막혔을 때만. 그 밖의 프로젝트: 날짜 = 마감(없으면 출시일), 빨강 = 날짜 지남
export function projWhen(p, tasks, key) {
  const ld = String((p && p.launchDate) || "").slice(0, 10);
  if (String((p && p.id) || "").startsWith("lb_") && ld && ld < key) {
    const open = (tasks || []).filter((t) => t && t.projectId === p.id && !t.isFixed && !isDone(t) && t.status !== "review");
    const dues = open.map(dueOf).filter(Boolean).sort(), date = dues.length ? dues[dues.length - 1] : addDays(ld, 21);
    const late = open.some((t) => { const r = riskOf(t, key); return !!r && (r.k === "late" || r.k === "blocked"); });
    return { date, n: ddays(date, key), late, launched: true, after: -ddays(ld, key) };
  }
  const date = String((p && (p.dueDate || p.launchDate)) || "").slice(0, 10), n = ddays(date, key);
  return { date, n, late: n != null && n < 0, launched: false };
}
// ── 프로젝트 카테고리 (버전1 WF_CATS 와 같은 키 · p.category 칸 그대로) ──
export const PROJ_CATS = [["launch", "신제품 출시"], ["marketing", "프로모션·마케팅"], ["notice", "공지사항"], ["system", "시스템 구축"], ["sales", "영업·B2B"], ["ops", "상시 운영"]];
export const catName = (k) => (PROJ_CATS.find((c) => c[0] === k) || [])[1] || "";
const WF_CAT = { wf_promo: "marketing", wf_cpc: "marketing", wf_blog: "marketing", wf_review: "marketing", wf_shorts: "marketing", wf_seller: "marketing", wf_event: "marketing",
  wf_notice: "notice", wf_sys: "system", wf_dealer: "sales", wf_order: "ops", wf_return: "ops", wf_stock: "ops", wf_launch: "launch" };
export const wfCat = (id) => WF_CAT[id] || "";
// 저장된 카테고리 → (없으면) 신제품(lb_) → 흐름 종류. 끝내 없으면 "" = 미분류 (이름으로 짐작은 '추천'으로만)
export const projCat = (p) => (p && PROJ_CATS.some((c) => c[0] === p.category) ? p.category : p && String(p.id || "").startsWith("lb_") ? "launch" : (p && wfCat(p.wfId)) || "");
const CAT_RULES = [["launch", /출시|신제품|SKU/i], ["sales", /대리점|B2B|파트너|판매가|영업|관리주체/i], ["ops", /주문|발주|재고|반품|\bCS\b|배송/i],
  ["marketing", /광고|프로모션|마케팅|콘텐츠|후기|NPS|박람회|기부|체험단|블로그|이벤트|기획전/i], ["notice", /공지|휴무|품절/], ["system", /리뉴얼|구축|개발|시스템|CRM|어드민|프로세스|자동화|매거진/i]];
export const guessCat = (title) => { const t = String(title || ""); for (const [k, re] of CAT_RULES) if (re.test(t)) return k; return ""; };
// 묶음: 마감 지남 · 이번 달 · 그 뒤 · 마감 없음 · 보류
// tasks 를 주면 projWhen 날짜로 묶음 (출시한 신제품은 남은 항목 기한으로 · 늦은 항목 없이 날짜만 지났으면 '7일 안'). 2개만 주면 예전처럼 마감(dueDate)으로
export function projGroups(list, key, tasks) {
  const ym = key.slice(0, 7), wkEnd = addDays(key, 6), g = { late: [], week: [], month: [], later: [], none: [], hold: [] };   // week = 7일 안 (주말에도 다음 주 초가 보이게)
  const dOf = new Map(list.map((p) => { if (!tasks) return [p, String(p.dueDate || "").slice(0, 10)];
    const w = projWhen(p, tasks, key); return [p, w.launched && !w.late && w.date && w.date < key ? key : w.date]; }));
  list.forEach((p) => { if (p.status === "hold" || p.status === "paused") return g.hold.push(p);
    const d = dOf.get(p); if (!d) return g.none.push(p);
    if (d < key) g.late.push(p); else if (d <= wkEnd) g.week.push(p); else if (d.slice(0, 7) === ym) g.month.push(p); else g.later.push(p); });
  const byDue = (a, b) => String(dOf.get(a) || "").localeCompare(String(dOf.get(b) || "")) || String(a.title).localeCompare(String(b.title));
  Object.values(g).forEach((a) => a.sort(byDue));
  return g;
}

// ── 사람 한 줄 요약 (팀 탭) ──
export function personStat(D, uid, key) {
  const tasks = D.tasks || [];
  const open = tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const late = open.filter((t) => { const n = ddays(dueOf(t), key); return n != null && n < 0 && t.status !== "hold"; });
  const fx = tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, uid) && fxDueOn(t, key));
  const fxDone = fx.filter((t) => fxMeDone(t, uid, key));
  let last = "";
  tasks.forEach((t) => { const a = (t.doneAtBy && t.doneAtBy[uid]) || (t.doneBy === uid ? t.doneAt : ""); if (a && a > last) last = a; });
  (D.notes || []).forEach((n) => { if (n.by === uid && (n.at || "") > last) last = n.at; });
  (D.log || []).forEach((l) => { if (l.by === uid && (l.at || "") > last) last = l.at; });
  return { inprog: open.filter((t) => t.status === "inprogress").length, open: open.length, late: late.length, fxDone: fxDone.length, fxTotal: fx.length, last };
}
// 담당 정리 필요: 담당 없음 · 미사용 담당
export function ownerIssues(D) {
  const users = D.users || [], off = new Set(users.filter((u) => u.active === false).map((u) => u.id)), ids = new Set(users.map((u) => u.id));
  const out = [];
  (D.tasks || []).forEach((t) => { if (isDone(t) || t.paused) return; const o = t.isFixed && t.forAll ? ["*"] : ownersOf(t);
    if (!o.length) out.push({ t, why: "담당 없음" }); else if (o.every((id) => id !== "*" && (off.has(id) || !ids.has(id)))) out.push({ t, why: "미사용 담당" }); });
  return out;
}

// ── 소식 (댓글 + 기록) ──
export const LOG_L = { decide: "결정", add: "새로 만듦", edit: "고침", done: "끝냄", reopen: "다시 엶", assign: "담당 바꿈", handover: "일 넘김", sync: "신제품 대시보드에서", take: "이어받음", comment: "댓글", delete: "휴지통으로",
  ack: "받음", dueReq: "기한 조정 요청", dueOk: "기한 조정 수락", dueNo: "기한 유지", review: "확인 요청", approve: "확인 완료", feedback: "수정 요청", block: "막힘", unblock: "막힘 풀림", launch: "신제품 만듦", bulk: "한꺼번에 바꿈", deps: "앞 일 바꿈", ask: "도움 요청", askDone: "도움 요청 닫음", hold: "보류", unhold: "보류 풀기", projEnd: "프로젝트 끝냄·멈춤", projResume: "프로젝트 다시 시작" };
export function feedOf(D, { projectId, taskIds, sinceIso } = {}) {
  const tset = taskIds ? new Set(taskIds) : null;
  const notes = (D.notes || []).filter((n) => !n.deleted && (!sinceIso || (n.at || "") >= sinceIso)).filter((n) => {
    if (!projectId && !tset) return true; const [k, ...r] = String(n.itemId || "").split(":"); const ref = r.join(":");
    return (k === "proj" && ref === projectId) || (k === "task" && tset && tset.has(ref)); })
    .map((n) => ({ type: "note", id: "n" + n.id, at: n.at, by: n.by, byName: n.byName, text: n.text, itemId: n.itemId, files: n.files || [] }));
  const logs = (D.log || []).filter((l) => (!sinceIso || (l.at || "") >= sinceIso)).filter((l) => {
    if (!projectId && !tset) return true; return l.projectId === projectId || (tset && tset.has(l.targetId)); })
    .map((l) => ({ type: "log", id: "l" + l.id, at: l.at, by: l.by, byName: l.byName, text: l.label || "", action: l.action, targetId: l.targetId, col: l.col }));
  return [...notes, ...logs].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

// ── 댓글 묶기 (원댓글 + 대댓글) ──
export function threads(notes, itemId) {
  const mine = (notes || []).filter((n) => n && n.itemId === itemId && !n.deleted);
  const byAt = (a, b) => String(a.at || "").localeCompare(String(b.at || ""));
  const tops = mine.filter((n) => !n.parentId || !mine.some((m) => m.id === n.parentId)).sort(byAt);
  return tops.map((t) => ({ ...t, replies: mine.filter((r) => r.parentId === t.id).sort(byAt) }));
}
export const taskNoteId = (id) => "task:" + id;
export const projNoteId = (id) => "proj:" + id;

// ── 새 id ──
export const newId = (pre) => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── v1 → v2 복사 계획 (읽기만 한 v1 데이터 → v2 문서 목록) ──
// v1 키(pour-os/state-<키>) 를 v2 의 같은 이름 칸으로. meta·savelock 은 저장 장치라 옮기지 않음.
export const V1_SKIP = new Set(["meta", "savelock"]);
export const docIdOf = (key, it, i) => String((key === "trash" && it && it._tid) || (it && it.id) || `_i${i}`).replace(/[/\s]/g, "_").slice(0, 300) || `_i${i}`;
export function planSeed(v1, notes = []) {
  const ops = [], counts = {};
  Object.entries(v1 || {}).forEach(([key, items]) => {
    if (V1_SKIP.has(key) || !Array.isArray(items)) return;
    const seenIds = new Set();
    items.forEach((it, i) => { if (!it || typeof it !== "object") return; let id = docIdOf(key, it, i); if (seenIds.has(id)) id = id + "_" + i; seenIds.add(id);
      ops.push({ key: key === "activityLog" ? "log" : key, id, data: it }); });
    counts[key === "activityLog" ? "log" : key] = items.length;
  });
  (notes || []).forEach((n, i) => { if (n && typeof n === "object") ops.push({ key: "notes", id: docIdOf("notes", n, i), data: n }); });
  counts.notes = (notes || []).length;
  return { ops, counts };
}
export const COUNT_L = { tasks: "업무", projects: "프로젝트", users: "사람", notes: "댓글", log: "기록", events: "일정", goals: "목표", mainKPIs: "메인 KPI", subKPIs: "서브 KPI", workflows: "흐름", trash: "휴지통", launch: "신제품" };

// ── 일정(달력) ──
// 달력 칸: 일요일 시작(일 맨 왼쪽 · 토 맨 오른쪽) 6주 이내. 이번 달 밖 날짜는 out:true
export function monthGrid(ym) {
  const first = new Date(ym + "-01T00:00:00"), start = new Date(first); start.setDate(1 - first.getDay());
  const weeks = []; const d = new Date(start);
  for (let w = 0; w < 6; w++) { const row = []; for (let i = 0; i < 7; i++) { const k = ymd(d); row.push({ date: k, out: k.slice(0, 7) !== ym }); d.setDate(d.getDate() + 1); }
    if (w >= 4 && row.every((c) => c.out)) break; weeks.push(row); }
  return weeks;
}
export const shiftMonth = (ym, n) => { const d = new Date(ym + "-01T00:00:00"); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
// 달력에 올릴 업무 (거르기: 프로젝트·담당·끝난 것 · noTemp: 빼고 셀 임시 담당 Set)
export function calItems(D, f = {}, key) {
  return (D.tasks || []).filter((t) => isOneOff(t) && dueOf(t) && (f.showDone || !isDone(t))
    && (!f.projectId || t.projectId === f.projectId) && (!f.uid || isMine(t, f.uid)) && !(f.noTemp && f.noTemp.has(t.id)))
    .map((t) => ({ t, date: dueOf(t), risk: riskOf(t, key) }));
}
// 프로젝트가 잘 가고 있나: 위험(지난 항목·막힘 또는 마감 7일 안인데 60% 미만) · 주의(곧 마감인데 시작 전 · 담당 없음) · 순조
// 이번 주(월~일) 내 완료율: 전체 = 이번 주 마감인 내 일(보류 빼고) + 이번 주에 끝낸 일 · 완료 = 이번 주에 끝낸(확인 대기 포함) · 진행 · 지남(지금 기준)
export function weekMine(D, uid, key) {
  const ws = weekStart(key), we = addDays(ws, 6), a = new Date(ws + "T00:00:00").toISOString(), b = new Date(addDays(we, 1) + "T00:00:00").toISOString();
  const mine = (D.tasks || []).filter((t) => isOneOff(t) && isMine(t, uid)), fin = (t) => String(t.finishedAt || t.doneAt || t.reviewAt || "");
  const doneW = mine.filter((t) => (isDone(t) || t.status === "review") && fin(t) >= a && fin(t) < b);
  const due = mine.filter((t) => { const d = dueOf(t); return d && d >= ws && d <= we && t.status !== "hold" && t.status !== "dropped"; });
  const total = new Set([...due.map((t) => t.id), ...doneW.map((t) => t.id)]).size;
  const open = (t) => !isDone(t) && t.status !== "review" && t.status !== "hold" && t.status !== "dropped";
  return { ws, we, total, done: doneW.length, doing: mine.filter((t) => t.status === "inprogress").length, late: mine.filter((t) => open(t) && dueOf(t) && dueOf(t) < key).length, pct: total ? Math.round((doneW.length / total) * 100) : null };
}
// ── 프로젝트 끝내기 · 멈추기 · 중요도 ──
// status: 진행(active 등) · completed 완료(다 해서 끝냄) · dropped 중단(안 하기로 함 · 남은 업무는 'dropped'로 접음, 지우지 않음) · hold 보류(나중에 다시 · 남은 업무는 보류로 접음, 다시 시작하면 되돌림)
export const projStLabel = (p) => (!p ? "" : p.status === "completed" || p.status === "done" ? "완료" : p.status === "dropped" ? "중단" : p.status === "hold" || p.status === "paused" ? "보류" : "진행 중");
export const isHoldP = (p) => !!p && (p.status === "hold" || p.status === "paused");
export const IMP = [["high", "높음"], ["mid", "보통"], ["low", "낮음"]];
export const impOf = (p) => (p && ["high", "mid", "low"].includes(p.priority) ? p.priority : "mid");   // 중요도 = 버전1 priority 칸 그대로 (없으면 보통)
export const impName = (k) => (IMP.find((x) => x[0] === k) || [])[1] || "보통";
export const IMP_RANK = { high: 0, mid: 1, low: 2 };
export const HOLD_WHY = ["다른 일이 먼저", "자료·답 기다림", "결정·예산 대기", "시즌·일정 미룸"];
export const DROP_WHY = ["안 하기로 결정", "조건이 안 맞음", "다른 프로젝트로 합침", "시기를 놓침"];
const workdaysIn = (a, b) => { let n = 0, d = a; while (d < b) { d = addDays(d, 1); if (!isOffDay(d)) n++; } return n; };   // (a, b] 평일 수
// 예상 끝나는 날 = 남은 업무 ÷ 최근 2주(평일 10일) 끝낸 속도 · 평일로 셈. 속도가 0이면 잴 수 없음(eta "")
export function projForecast(p, tasks, key) {
  const ts = (tasks || []).filter((t) => t.projectId === p.id && !t.isFixed);
  const left = ts.filter((t) => !isDone(t) && t.status !== "hold" && t.status !== "dropped").length;
  const since = new Date(new Date(key + "T00:00:00").getTime() - 14 * 86400000).toISOString();
  const done14 = ts.filter((t) => isDone(t) && String(t.finishedAt || t.doneAt || "") >= since).length;
  const due = String(p.dueDate || p.launchDate || "").slice(0, 10), perWeek = Math.round((done14 / 2) * 10) / 10;
  if (!left || !done14) return { left, done14, perWeek, eta: "", lateBy: 0, due };
  let need = Math.ceil(left / (done14 / 10)), d = key; while (need > 0) { d = addDays(d, 1); if (!isOffDay(d)) need--; }
  return { left, done14, perWeek, eta: d, lateBy: due && d > due ? workdaysIn(due, d) : 0, due };
}
// 관리자 '판단 필요': 당겨야 할 것(중요 높음인데 늦어질 듯 · 마감 지남 · 속도 없이 마감 2주 안) · 미뤄도 되는 것(중요 낮음 업무가 이번 주 한도 넘은 사람에게 있음)
export function judgeOf(D, key) {
  const ws = weekStart(key), we = addDays(ws, 6);
  const open = (D.tasks || []).filter((t) => isOneOff(t) && !isDone(t) && t.status !== "hold" && t.status !== "review");
  const wk = {}; open.forEach((t) => { const d = dueOf(t); if (d && d >= ws && d <= we) ownersOf(t).forEach((u) => { wk[u] = (wk[u] || 0) + 1; }); });
  const cap = (u) => Number(((D.users || []).find((x) => x.id === u) || {}).weekCap) || 15;
  const pull = [], push = [];
  (D.projects || []).filter((p) => projOpen(p) && !isHoldP(p)).forEach((p) => {
    const imp = impOf(p), mine = open.filter((t) => t.projectId === p.id);
    if (imp === "high") { const f = projForecast(p, D.tasks, key), n = f.due ? ddays(f.due, key) : null, blocked = mine.filter((t) => t.blocked).length;
      const why = !f.left ? "" : n != null && n < 0 ? `마감 ${md(f.due)} 지남 · 남은 ${f.left}` : f.eta && f.lateBy > 0 ? `예상 ${md(f.eta)} · 마감 ${md(f.due)}보다 ${f.lateBy}일 늦음` : !f.eta && n != null && n <= 14 && f.left >= 3 ? `최근 2주 끝낸 업무 0 · 마감 D-${n} · 남은 ${f.left}` : "";
      if (why) pull.push({ p, f, why, blocked, score: (n != null && n < 0 ? 100 : 0) + f.lateBy + (f.eta ? 0 : 20) }); }
    if (imp === "low") { const wkT = mine.filter((t) => { const d = dueOf(t); return d && d >= ws && d <= we; });
      const ppl = [...new Set(wkT.flatMap((t) => ownersOf(t)))].filter((u) => wk[u] > cap(u)).map((u) => { const k = wkT.filter((t) => ownersOf(t).includes(u)).length; return { u, n: wk[u], cap: cap(u), k }; });
      if (ppl.length) push.push({ p, ppl, tasks: wkT.filter((t) => ownersOf(t).some((u) => ppl.some((x) => x.u === u))) }); }
  });
  return { pull: pull.sort((a, b) => b.score - a.score), push: push.sort((a, b) => b.tasks.length - a.tasks.length), ws, we };
}
export function projHealth(p, D, key, pctOf = null) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed), open = ts.filter((t) => !isDone(t));
  const late = open.filter((t) => { const r = riskOf(t, key); return r && (r.k === "late" || r.k === "blocked"); }).length;
  const start = open.filter((t) => { const r = riskOf(t, key); return r && (r.k === "start" || r.k === "today"); }).length;
  const noOwner = open.filter((t) => !ownersOf(t).length).length;
  const pct = pctOf ? pctOf(p) : projPct(p), n = ddays(p.dueDate, key);
  const allDone = open.length === 0 && (ts.length > 0 || pct >= 100);   // 업무 다 끝남 → 프로젝트 완료 처리 신호 (오래전에 끝낸 업무는 안 불러와도 % 로 앎)
  const why = [];
  if (late) why.push(`지난 일 ${late}`); if (n != null && n < 0 && open.length) why.push(`마감 ${-n}일 지남`); else if (n != null && n <= 7 && pct < 60 && open.length) why.push(`마감 D-${n}인데 ${pct}%`);
  const level = why.length ? "위험" : start || noOwner ? "주의" : "순조";
  if (start) why.push(`시작 전 ${start}`); if (noOwner) why.push(`담당 없음 ${noOwner}`);
  const next = open.filter((t) => dueOf(t)).sort((a, b) => String(dueOf(a)).localeCompare(String(dueOf(b))))[0] || null;
  return { level, why, late, start, open: open.length, pct, n, next, allDone };
}
// 사람 일정이 잘 맞게 가나: 지남·시작 전·기한 지킴 % + 앞으로 4주 주별 마감 수
export function personHealth(D, uid, now = new Date()) {
  const key = ymd(now), w = workloadOf(D, uid, now, 28), ot = onTimeOf(D, uid, now);
  const open = (D.tasks || []).filter((t) => isOneOff(t) && !isDone(t) && isMine(t, uid));
  const start = open.filter((t) => { const r = riskOf(t, key); return r && r.k === "start"; }).length;
  const weeks = [0, 1, 2, 3].map((i) => w.week.slice(i * 7, i * 7 + 7).reduce((a, d) => a + d.list.length, 0));
  const noDue = open.filter((t) => !dueOf(t) && t.status !== "hold").length;
  const level = w.late >= 3 || (ot.pct != null && ot.pct < 60) ? "위험" : w.late || start || Math.max(...weeks) >= 15 ? "주의" : "순조";
  return { ...w, ot, start, weeks, noDue, level };
}

// ── 한 사람 일 한 번에 넘기기 (휴가·퇴사 · 관리자) ──
// 묶음: 진행 중 · 할 일 · 보류 · 확인 대기(끝냈고 확인만 남음) · 고정업무('전체' 담당은 빼고) · 책임 프로젝트(열린 것)
// 끝낸 일·중단한 일은 그대로 (기록은 그 사람 이름으로 남음)
export const HAND_GROUPS = [["doing", "진행 중"], ["todo", "할 일"], ["hold", "보류"], ["review", "확인 대기"], ["fixed", "고정업무"], ["proj", "책임 프로젝트"]];
export const handOverPlan = (D, uid) => {
  const g = { doing: [], todo: [], hold: [], review: [], fixed: [], proj: [] };
  (D.tasks || []).forEach((t) => {
    if (t.isFixed) { if (!t.forAll && fxIds(t).includes(uid)) g.fixed.push(t); return; }
    if (isDone(t) || t.status === "dropped" || !isMine(t, uid)) return;
    g[t.status === "inprogress" ? "doing" : t.status === "hold" ? "hold" : t.status === "review" ? "review" : "todo"].push(t);
  });
  (D.projects || []).forEach((p) => { if (p.assigneeId === uid && projOpen(p)) g.proj.push(p); });
  const byDue = (a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"));
  ["doing", "todo", "hold", "review"].forEach((k) => g[k].sort(byDue));
  return g;
};
// 담당 칸만 바꿈: 넘기는 사람 자리에 받는 사람 (여러 담당이면 나머지는 그대로 · 이미 있으면 한 번만)
export const handOverOwners = (t, from, to) => {
  const cur = ownersOf(t), next = [...new Set((cur.length ? cur : [from]).map((x) => (x === from ? to : x)))];
  return { assigneeIds: next, assigneeId: next[0] || "" };
};

// ── 팀 (5단계 · 사용자 결정 2026-10-05): 사람에 팀 한 번 → 프로젝트는 책임자 팀으로 자동 · 해외 하위 프로젝트(신제품 lbProject)는 3팀 · 예외만 프로젝트 team 칸
export const TEAMS = ["1팀", "2팀", "3팀", "공용"];
// 기본값(신제품 대시보드 조직도 + 사용자 정정): 관리자 › 사람에서 바꾸면 users.team 이 이김
export const DEFAULT_TEAMS = { 김소연: "1팀", 남윤정: "1팀", 용정하: "1팀", 이우민: "1팀", 김송희: "2팀", 김민지: "2팀", 양채림: "2팀", 이란: "2팀", 김채원: "3팀", 변유림: "3팀", 허지은: "공용", 윤미니: "공용" };
export const teamOf = (u) => (!u ? "" : u.team || DEFAULT_TEAMS[norm(u.name)] || "");
export const projTeamAuto = (p, users) => (p && p.lbProject ? "3팀" : teamOf((users || []).find((u) => u.id === (p && p.assigneeId))));
export const projTeam = (p, users) => (p && p.team) || projTeamAuto(p, users);
