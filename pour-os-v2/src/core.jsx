// 업무OS v2 — 두 앱(실사용 os2.html · 관리자 os2-admin.html)이 함께 쓰는 바탕:
// 데이터 구독 · 첫 복사 · 로그인(사람별 PIN) · 저장 동작(바뀐 칸만)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { pinHash } from "./sha.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxSubPatch, fxPeople, fxHit, weekStart,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, isHoldP, nextWorkday, setHolidayLayer, handOverOwners,
  scopeFields, brandLabel, cycleFields, FX_WD, isRemoved, fxRemoveFields, fxRestoreFields, canRemoveFx, canRemoveAk, canRenameFx, canRenameTask, canRemoveNote, canRestoreNote, scopeOf,
  canFinish, canRemoveTask, canRestoreTask, taskKids, taskRemoveFields, canRemoveProj, canRestoreProj, projRemoveFields, projTaskRemoveFields, projTaskBack,
  roadOf, catRoad, builtinRoad, cleanRoad, sameRoad, roadToStore, roadProblem, roadSwitchPlan, phaseOfTask, stageName, noStageL, canSetPhase, canEditRoad, isFlowProj, isLaunchProj, catName, projCat, roadOwn,
  canSetEst, EST_MAX,
} from "./model.js";
import { canEditTpl, canSaveTpl, TPL_MAX, TPL_NAME_MAX } from "./tpl.js";
import { planLaunchImport, relaunch, isTempOwner, LAUNCH_ITEMS } from "./launch.js";
import { nextTurnText } from "./turn.js";
import { planLaunchSync, planLaunchTrash, planRowSync, planCustomSteps } from "./lbsync.js";
import { planLaunchPush, BY as LB_BY } from "./lbpush.js";
import { redact, secretOn } from "./secret.js";
import { parseMentions, smsTarget, smsOpen, smsDue, smsText } from "./mention.js";
import { flowOwners } from "./flow.js";
import { sumAk, akWrite, countFields, countOf, baseTitle } from "./routine.js";
import { linkInbox } from "./links.js";
import { lagInbox, applyKpiOv, kpiEditWrite, newKpiId } from "./kpi2.js";
import { dayIdFx, dayIdAk, openIdAk, dayBase, dayAdd, dayFix, roundTap, qtyToGoal, akSubsOf } from "./rec.js";
import { akQidOfWeek, akWeekKey } from "../../pour-os/src/actionKpi.js";
import { C, Big, TBtn, inp, useLocal } from "./ui.jsx";

export const V1_URL = "./os.html";
export const LS = (k) => "pour-os2-" + k;   // v1(pour-os-…) 과 겹치지 않는 기기 저장 이름
export const nowIso = () => new Date().toISOString();

// 댓글 삭제 화면 반영(30일 지난 댓글은 구독 밖이라 이 기기에서 바로 숨김) — id → removed 값 · null = 되살림. 구독에 있는 댓글은 구독 값이 먼저
export const noteOver = new Map(); const noteSubs = new Set();
export const setNoteOver = (id, v) => { noteOver.set(id, v); noteSubs.forEach((f) => f()); };
export function useNoteOver() { const [v, set] = useState(0); useEffect(() => { const f = () => set((x) => x + 1); noteSubs.add(f); return () => { noteSubs.delete(f); }; }, []); return v; }
// 따로 읽은 댓글 목록에서 삭제한 것 빼기 (업무·프로젝트 대화 · 이전 소식 · 링크)
//   구독에 있으면 구독 값(D.notes = 살아 있음 · D.removedNotes = 삭제) → 이 기기에서 방금 지움/되살림(noteOver) → 그 문서의 removed
export const liveNotes = (arr, D) => { const live = new Set(((D && D.notes) || []).map((n) => n.id)), gone = (D && D.removedNoteIds) || new Set(((D && D.removedNotes) || []).map((n) => n.id));
  return (arr || []).filter((n) => n && (live.has(n.id) ? true : gone.has(n.id) ? false : noteOver.has(n.id) ? !noteOver.get(n.id) : !isRemoved(n))); };

// ───────────────── 데이터 구독 ─────────────────
// on: 사람 목록만(로그인 화면) · full: 로그인 뒤 나머지 전부 (로그인 전엔 업무·기록을 읽지 않음 — 정밀 검토 2026-10-06 · 읽기 비용)
export function useData(on, full = true) {
  const [S, setS] = useState({ users: null, projects: null, openT: null, doneT: [], notes: [], log: [], events: [], brands: [], workflows: [], mainKPIs: [], subKPIs: [], settings: [], akDef: undefined, akV1: undefined, akV2: [], links: [], lagDef: undefined, lagV2: [], kpisales: undefined, kpiOv: [], templates: undefined });
  // 이번 분기 — 켜 둔 채 날이 바뀌어도 따라감(1분마다 · 화면 다시 볼 때)
  const [akQ, setAkQ] = useState(() => akQidOfWeek(akWeekKey(new Date())));
  const [dayK, setDayK] = useState(() => ymd(new Date()));   // 오늘 (하루 기록 구독 · 날이 바뀌면 따라감)
  useEffect(() => { const f = () => { setAkQ(akQidOfWeek(akWeekKey(new Date()))); setDayK(ymd(new Date())); }; const iv = setInterval(f, 60000); document.addEventListener("visibilitychange", f);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", f); }; }, []);
  useEffect(() => { if (!on || !full) return undefined; setS((s) => ({ ...s, akV1: undefined }));
    return fb.listenV1Doc("kpi-act-" + akQ, (d) => setS((s) => ({ ...s, akV1: d })), (e) => { console.warn("[v2] 버전1 행동지표 실적 못 읽음:", e); setS((s) => ({ ...s, akV1: null })); }); }, [on, full, akQ]);
  // 하루 기록(rec.js): 오늘 문서(모두 · 오늘 건수·체크) + 횟수 목표 체크리스트 진행 중(akopen) — 같음 조건 하나씩 · 못 읽어도 앱은 그대로
  useEffect(() => { if (!on || !full) return undefined; setS((s) => ({ ...s, recToday: undefined }));
    return fb.listen("checks", ["date", "==", dayK], (x) => setS((s) => ({ ...s, recToday: x })), (e) => { console.warn("[v2] 오늘 기록 못 읽음:", e); setS((s) => ({ ...s, recToday: [] })); }); }, [on, full, dayK]);
  useEffect(() => { if (!on || !full) return undefined;
    return fb.listen("checks", ["kind", "==", "akopen"], (x) => setS((s) => ({ ...s, akOpen: x })), (e) => console.warn("[v2] 체크리스트 진행 못 읽음:", e)); }, [on, full]);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!on) return;
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString(), since14 = new Date(Date.now() - 7 * 864e5).toISOString();
    const put = (k) => (x) => setS((s) => ({ ...s, [k]: x }));
    const onE = (e) => setErr("데이터를 불러오지 못했어요 · 인터넷 연결을 확인해 주세요 (" + (e.code || e.message) + ")");
    if (!full) return fb.listen("users", null, put("users"), onE);
    const subs = [
      fb.listen("users", null, put("users"), onE),
      fb.listen("projects", null, put("projects"), onE),
      fb.listen("tasks", ["status", "in", ["todo", "inprogress", "hold", "review"]], put("openT"), onE),   // 열린 업무 + 고정업무
      fb.listen("tasks", ["doneAt", ">=", since30], put("doneT"), onE),                                    // 최근 30일 끝낸 업무
      fb.listen("notes", ["at", ">=", since30], put("notes"), onE),
      fb.listen("log", ["at", ">=", since14], put("log"), onE),   // 최근 7일만 (더 이전은 프로젝트 소식 '이전 불러오기' · 정밀 검토 2026-10-06 읽기 비용)
      fb.listen("events", null, put("events"), onE),
      fb.listen("brands", null, put("brands"), onE),
      fb.listen("workflows", null, put("workflows"), onE),
      fb.listen("mainKPIs", null, put("mainKPIs"), onE),   // 프로젝트 KPI 분류용 (읽기만)
      fb.listen("subKPIs", null, put("subKPIs"), onE),
      fb.listen("settings", null, put("settings"), (e) => console.warn("[v2] 설정(회사 쉬는 날) 불러오기 실패 · 앱은 그대로:", e)),   // 못 읽어도 앱은 그대로
      // 반복(행동지표 · routine.js): 정의·버전1 실적은 읽기만 · v2 실적 pour-os/v2/kpiact/{분기} — 못 읽어도 앱은 그대로
      fb.listenV1Doc("state-actionKPIs", (d) => put("akDef")(d), (e) => { console.warn("[v2] 행동지표 정의 못 읽음:", e); put("akDef")(null); }),
      fb.listen("kpiact", null, put("akV2"), (e) => console.warn("[v2] 행동지표 실적 못 읽음:", e)),
      fb.listen("links", ["open", "==", true], put("links"), (e) => console.warn("[v2] CRM·마진 알림 못 읽음:", e)),   // 다른 앱에서 온 할 일 한 줄 (links.js) — 못 읽어도 앱은 그대로
      // KPI(kpi2.js): 결과 KPI 정의 = 버전1 읽기만 · 월 값 = v2 lagvals · 매출 합계 = v2 kpisales(CRM · 그로홈) — 못 읽어도 앱은 그대로
      fb.listenV1Doc("state-lagKPIs", (d) => put("lagDef")(d), (e) => { console.warn("[v2] 결과 KPI 정의 못 읽음:", e); put("lagDef")(null); }),
      fb.listen("lagvals", null, put("lagV2"), (e) => console.warn("[v2] 결과 KPI 월 값 못 읽음:", e)),
      fb.listen("kpisales", null, put("kpisales"), (e) => console.warn("[v2] 매출 합계 못 읽음:", e)),
      fb.listen("kpidefs", null, put("kpiOv"), (e) => console.warn("[v2] KPI 고친 것 못 읽음:", e)),   // KPI 고치기(v2 덧칠) — 버전1 정의 위에 덮어 보임
      // 견본(템플릿 · 2026-10-07): 문서 하나에 업무 목록을 담아 따로 둠 → 업무·프로젝트 목록에 안 섞임(오늘·달력·KPI·한눈에·협업 맵·보고서·찾기에 안 나옴) — 못 읽어도 앱은 그대로
      fb.listen("templates", null, put("templates"), (e) => { console.warn("[v2] 견본 못 읽음:", e); setS((s) => ({ ...s, templates: [] })); }),
    ];
    return () => subs.forEach((u) => u && u());
  }, [on, full]);
  const D = useMemo(() => {
    const m = new Map(); S.doneT.forEach((t) => m.set(t.id, t)); (S.openT || []).forEach((t) => m.set(t.id, t));
    // 분기마다 v2 실적 · 이번 분기는 버전1 실적(읽기만)도 더함
    const docs = Object.fromEntries((S.akV2 || []).map((x) => [x.id || x._doc, sumAk(x)])); docs[akQ] = sumAk(S.akV1, (S.akV2 || []).find((x) => (x.id || x._doc) === akQ));
    // 반복 실행(횟수 목표) 정의 = 버전1 state-actionKPIs(읽기만) 위에 v2 덧칠(kpidefs coll 'actionKPIs' · 체크리스트·건수 칸·하는 법·자료·새 항목) — 덧칠은 여기 한 곳에서만 · 숨긴 것은 뺌
    const akRaw = ((S.akDef || {}).items || []).filter(Boolean);
    //   [없애기](removed · 사용자 확정 2026-10-07) = 숨긴 것과 같이 빠지고 휴지통 줄(removed)에만
    const akAll = applyKpiOv({ actionKPIs: akRaw }, S.kpiOv).actionKPIs;
    const ak = { qid: akQ, raw: akRaw, items: akAll.filter((x) => !x._hidden), removed: akAll.filter((x) => x._hidden && x._removed), docs, v2: S.akV2 || [], ready: S.akDef !== undefined && S.akV1 !== undefined, defReady: S.akDef !== undefined };
    // 없앤 한 번짜리 업무(removedTasks · 누구나 없애기 2026-10-07)도 같이 → 오늘·확인할 것·달력·프로젝트·관리자·찾기·보고서 어디에도 안 보임 · 휴지통 줄에만
    // 없앤 고정업무(removed)는 여기 한 곳에서 빼서 오늘·반복 실행·내 고정업무·관리자·사람·협업 맵 어디에도 안 보임 → 휴지통 줄(removedFx)에만
    // 없앤 프로젝트(removedProjects · 책임자·관리자 · 2026-10-07): 프로젝트와 그 안 업무(같이 없앤 것 + 혹시 남은 것)·대화·기록이 어디에도 안 보임 · 휴지통 줄에만
    //   프로젝트째 없앤 업무(removed.proj)는 업무 휴지통·'업무 없앰' 알림에도 안 나옴(removedProjTasks — 링크로 열 때만)
    const allT = [...m.values()], allP = S.projects || [], goneP = new Set(allP.filter(isRemoved).map((p) => p.id));
    const inGone = (t) => !!t && !t.isFixed && goneP.has(t.projectId);
    const goneT = new Set(allT.filter((t) => inGone(t) || (isRemoved(t) && t.removed.proj)).map((t) => t.id));
    const goneItem = (id) => { const s = String(id || ""); return (s.startsWith("proj:") && goneP.has(s.slice(5))) || (s.startsWith("task:") && goneT.has(s.slice(5))); };
    const notes0 = goneP.size ? (S.notes || []).filter((n) => !n || !goneItem(n.itemId)) : S.notes || [];
    // 삭제한 댓글(removed · 2026-10-07 '흔적 없이 숨김')은 여기서 빼서 댓글 수·새 댓글·확인할 것·내가 쓴 댓글·찾기·소식·보고서·협업 맵 어디에도 안 보임 → 관리자 휴지통(removedNotes)에만
    const notes = notes0.filter((n) => !isRemoved(n)), removedNotes = notes0.filter((n) => isRemoved(n));
    const logs = goneP.size ? (S.log || []).filter((l) => !l || !(goneP.has(l.projectId) || goneP.has(l.targetId) || goneT.has(l.targetId))) : S.log;
    return { users: S.users || [], projects: goneP.size ? allP.filter((p) => !goneP.has(p.id)) : allP, removedProjects: allP.filter((p) => goneP.has(p.id)), goneIds: goneT,
      tasks: allT.filter((t) => !isRemoved(t) && !inGone(t)), removedFx: allT.filter((t) => t.isFixed && isRemoved(t)), removedTasks: allT.filter((t) => !t.isFixed && isRemoved(t) && !goneT.has(t.id)), removedProjTasks: allT.filter((t) => goneT.has(t.id)), notes, removedNotes, removedNoteIds: new Set(removedNotes.map((n) => n.id)), log: logs, events: S.events, brands: S.brands, workflows: S.workflows, mainKPIs: S.mainKPIs || [], subKPIs: S.subKPIs || [], settings: S.settings || [], ak, links: S.links || [], linkInbox,
      kpi: { ov: S.kpiOv || [], lagRaw: ((S.lagDef || {}).items || []).filter((x) => x && x.id && !x.deleted),
        lagDefs: applyKpiOv({ lagKPIs: ((S.lagDef || {}).items || []).filter((x) => x && x.id && !x.deleted) }, S.kpiOv).lagKPIs.filter((x) => !x._hidden), lagReady: S.lagDef !== undefined, lagV2: Object.fromEntries((S.lagV2 || []).map((x) => [x.id || x._doc, x])), sales: Object.fromEntries((S.kpisales || []).map((x) => [x.id || x._doc, x])) },
      lagInbox, ready: !!S.users,
      // 견본함(templates · 2026-10-07): 살아 있는 것 = 최근 고친 순 · 없앤 것(removed) = 휴지통 줄에만
      templates: (S.templates || []).filter((x) => x && !isRemoved(x)).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))),
      removedTemplates: (S.templates || []).filter((x) => x && isRemoved(x)), tplReady: S.templates !== undefined,
      recs: { key: dayK, today: S.recToday || [], ready: S.recToday !== undefined, open: S.akOpen || [] },
      // 업무·프로젝트 첫 목록까지 받은 뒤 (그 전엔 '급한 일 없어요'·자동 반영이 빈 목록으로 돌지 않게 — 정밀 검토 2026-10-06)
      loaded: !!S.users && S.openT !== null && S.projects !== null, salesReady: S.kpisales !== undefined };
  }, [S, akQ, dayK]);
  return [D, err];
}


// 시작 순서: 복사 정보 확인 → (없으면) 첫 복사 → 데이터 구독 → 로그인. 두 앱이 같은 순서·같은 기기 로그인을 쓴다
export function useBoot() {
  const [meta, setMeta] = useState(undefined);   // undefined=확인 중, null=아직 복사 전
  const [metaErr, setMetaErr] = useState("");
  const checkMeta = () => { setMetaErr(""); fb.getMeta().then(setMeta).catch((e) => { console.error("[v2] 복사 정보 확인 실패:", e); setMetaErr("서버에 연결하지 못했어요 · 인터넷 연결을 확인하고 다시 눌러 주세요"); }); };
  useEffect(checkMeta, []);
  const [full, setFull] = useState(false);
  const [D, err] = useData(!!meta, full);
  const [me, setMe] = useLocal(LS("me"), "");
  const [key, setKey] = useLocal(LS("key"), "");
  const cu = D.users.find((u) => u.id === me);
  const authed = !!(cu && cu.active !== false && (cu.pinHash ? cu.pinHash === key : false));
  useEffect(() => { if (authed && !full) setFull(true); }, [authed]);   // 로그인 뒤부터 나머지 구독 (한번 켜면 계속)
  const [launchNew, setLaunchNew] = useState(0);
  // 쉬는 날: 매달 자동 갱신한 공식 특일 정보(holidays.json, 같은 사이트) + 회사만 쉬는 날(settings/holidays). 화면이 그리기 전에 층을 바꿔 둠
  const [holJ, setHolJ] = useState(null);
  useEffect(() => { fetch("./holidays.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.days) setHolJ(j); })
    .catch((e) => console.warn("[v2] 공휴일 자동 갱신 파일 못 읽음 · 앱 안 표로 계산:", e && e.message)); }, []);
  useMemo(() => setHolidayLayer("fetched", holJ && holJ.days), [holJ]);
  const comp = ((D.settings || []).find((x) => x.id === "holidays") || {}).days;
  useMemo(() => setHolidayLayer("company", comp), [JSON.stringify(comp || {})]);
  const synced = useRef(false);
  useEffect(() => { if (!meta || !D.loaded || !authed || synced.current) return; synced.current = true;
    syncNewLaunch(D, cu).then((n) => { if (n) setLaunchNew(n); }).catch((e) => console.error("[v2] 신제품 보드 새 제품 가져오기 실패:", e));
    const today = ymd(new Date()), k = "pour-os-v2.progSync";
    let last = ""; try { last = localStorage.getItem(k) || ""; } catch (e) { /* 저장소 막힘 → 매번 */ }
    if (isMaster(cu) && last !== today) syncProgress(D).then((n) => { try { localStorage.setItem(k, today); } catch (e) { /* 무시 */ } console.log(`[v2] 프로젝트 진척 다시 계산 · 바뀐 것 ${n}개`); }).catch((e) => console.error("[v2] 프로젝트 진척 다시 계산 실패:", e)); }, [meta, D.loaded, authed]);
  useLaunchSync(D, cu, !!(meta && D.loaded && authed));
  useSmsFlush(D, !!(meta && D.loaded && authed));
  // 기밀(secret.js): 화면에는 이 사람이 볼 수 있는 것만 — 허용 안 된 기밀은 '기밀 업무'로 바꾼 대체본 · 신제품 반영·진척 계산은 위의 원래 D 로
  const V = useMemo(() => redact(D, authed ? cu : null), [D, authed, cu]);
  return { launchNew, holJ, meta, setMeta, metaErr, checkMeta, D: V, rawD: D, err, cu, authed, signIn: (u, h) => { setMe(u.id); setKey(h); }, logout: () => { setKey(""); setMe(""); } };
}
// 프로젝트 진척(%) 하루 한 번 다시 계산: 열린 일반 프로젝트(신제품·직접 정한 % 빼고)의 전체 업무를 프로젝트별로 읽어 % 가 다르면 그 칸만 저장
//  (앱은 열린 업무 + 최근 30일 끝낸 업무만 불러오므로 오래전에 끝낸 업무까지 세려면 서버에서 따로 읽어야 함)
export async function syncProgress(D) {
  const ps = (D.projects || []).filter((p) => projOpen(p) && !p.progressManual && !String(p.id || "").startsWith("lb_"));
  let changed = 0;
  for (let i = 0; i < ps.length; i += 4) {
    await Promise.all(ps.slice(i, i + 4).map(async (p) => {
      const all = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted && !isRemoved(t));
      const pct = all.length ? Math.round((all.filter(isDone).length / all.length) * 100) : 0;
      if (Number(p.progress) !== pct) { changed++; await fb.patch("projects", p._doc || p.id, { progress: pct, updatedAt: nowIso(), v2At: nowIso() }); } }));
  }
  return changed;
}
// ── @ 태그 문자 알림 (mention.js 규칙) ──
// 큐 pour-os/v2/smsq/{사람}: {items:[{at, from, text, where, link}], lastSentAt} — 지금 보낼 수 있으면(시간 안 · 10분 지남) 바로, 아니면 10분 묶음으로 기다렸다가
// 로그인한 아무 기기나 큐를 보다가(useSmsFlush) 보낼 차례가 되면 보냄(transaction 으로 한 기기만) · 시간 밖이면 비움(앱에만)
const SMS_BASE = "https://pour-construction-form.pages.dev/pourstore-renewal/os2.html";
export async function queueMentionSms(D, cu, ids, itemId, text) {
  const [kind, ...rest] = String(itemId).split(":"), ref = rest.join(":");
  const akIt = !String(itemId).includes(":") ? ((D.ak && D.ak.items) || []).find((x) => x.id === String(itemId)) : null;   // 반복 실행(횟수 목표) 대화 → 반복 실행 보기 시트
  if (akIt) { const item = { at: new Date().toISOString(), from: cu.name, text: String(text || "").slice(0, 60), where: akIt.name || "반복 실행", link: "#r-" + encodeURIComponent(akIt.id) }, now = new Date();
    for (const uid of ids) { const u = (D.users || []).find((x) => x.id === uid); if (!smsTarget(u, cu.id) || !smsOpen(u, now)) continue;
      await fb.txDoc("smsq", uid, (cur) => ({ write: { items: [...((cur && cur.items) || []), item].slice(-20) } })); await flushSms(D.users, uid); }
    return; }
  const t = kind === "task" ? (D.tasks || []).find((x) => x.id === ref) : null, p = (D.projects || []).find((x) => x.id === (t ? t.projectId : ref));
  const up = (x, k = 0) => (x && x.parentId && k < 20 ? (D.tasks || []).find((y) => y.id === x.parentId) : null);
  let anc = false; for (let x = up(t), k = 0; x && k < 20; x = up(x, ++k)) if (secretOn(x)) anc = true;
  const secret = secretOn(t) || secretOn(p) || anc || (kind === "task" && !t) || (kind !== "task" && !p), now = new Date();   // 못 찾으면 기밀처럼(내용 안 넣음)
  const item = { at: now.toISOString(), from: cu.name, text: secret ? "기밀 업무 댓글" : String(text || "").slice(0, 60), where: secret ? "" : (t ? t.title : p ? p.title : ""), link: kind === "task" ? "#t-" + encodeURIComponent(ref) : "#p-" + encodeURIComponent(ref) };
  for (const uid of ids) {
    const u = (D.users || []).find((x) => x.id === uid);
    if (!smsTarget(u, cu.id) || !smsOpen(u, now)) continue;   // 번호 없음·안 받음·시간 밖 → 앱에만
    await fb.txDoc("smsq", uid, (cur) => ({ write: { items: [...((cur && cur.items) || []), item].slice(-20) } }));
    await flushSms(D.users, uid);
  }
}
export async function flushSms(users, uid, now = new Date()) {
  const u = (users || []).find((x) => x.id === uid); if (!u) return 0;
  const items = await fb.txDoc("smsq", uid, (cur) => {
    if (!cur || !(cur.items || []).length) return null;
    if (!smsTarget(u, "") || !smsOpen(u, now)) return { write: { items: [], droppedAt: now.toISOString(), dropped: (cur.items || []).length } };   // 시간 밖 → 앱에만
    if (!smsDue(cur, now)) return null;
    return { write: { items: [], lastSentAt: now.toISOString(), lastCount: cur.items.length }, ret: cur.items };
  });
  if (!items || !items.length) return 0;
  try { const r = await fetch("/send-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: String(u.phone).replace(/\D/g, ""), text: smsText(items, SMS_BASE) }) });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 120));
    console.log(`[v2 문자] ${u.name}님께 ${items.length}건 묶어 보냄`); return items.length; }
  catch (e) { console.error("[v2 문자] 보내기 실패:", e); await fb.txDoc("smsq", uid, () => ({ write: { lastError: String(e.message || e).slice(0, 200), lastErrorAt: now.toISOString() } })).catch((e2) => console.error("[v2 문자] 실패 기록도 못 남김:", e2)); return 0; }
}
// 로그인한 기기: 큐를 구독 → 1분마다 보낼 차례인 사람 것만 보냄
function useSmsFlush(D, on) {
  const ref = useRef({ q: [], users: [] }); ref.current.users = D.users;
  useEffect(() => { if (!on) return;
    const un = fb.listen("smsq", null, (a) => { ref.current.q = a; }, (e) => console.warn("[v2 문자] 큐 구독 실패:", e));
    const tick = () => { const now = new Date(); ref.current.q.filter((q) => (q.items || []).length && (smsDue(q, now) || !smsOpen((ref.current.users || []).find((u) => u.id === (q.id || q._doc)), now)))
      .forEach((q) => flushSms(ref.current.users, q.id || q._doc, now).catch((e) => console.error("[v2 문자] 묶음 보내기 실패:", e))); };
    const iv = setInterval(tick, 60000); return () => { clearInterval(iv); un && un(); }; }, [on]);
}
// 신제품 대시보드 → 업무OS 자동 반영 (2단계): 신제품 대시보드를 실시간으로 보다가, 제품의 updatedAt 이 업무OS 프로젝트가 마지막으로 맞춘 값(lbSyncedAt)과 다르면
//   그 프로젝트 업무를 서버에서 읽어 lbsync.planLaunchSync 로 비교 → 바뀐 칸만 조건부로 씀(그사이 업무OS에서 누가 고쳤으면 그 업무는 건너뛰고 다음에 다시)
//   v2At 은 찍지 않음(업무OS 에서 고친 게 아니라서) · 기록 1건(sync) · 업무OS 에 없는 새 제품은 syncNewLaunch 로 · 한 번에 하나씩(겹쳐 돌지 않음)
// 3단계: 업무OS 에서 바꾼 것(lbSeen 과 다른 칸)은 pushLaunchBoard 로 신제품 대시보드에 — 신제품 신호 뒤 + 업무OS 데이터가 바뀔 때마다(1.5초 모아서)
function useLaunchSync(D, cu, on) {
  const ref = useRef({ D, cu, busy: false, again: null, prods: null, run: null }); ref.current.D = D; ref.current.cu = cu;
  useEffect(() => { if (!on) return;
    const run = async (prods) => { const st = ref.current; if (prods) st.prods = prods; if (st.busy) { st.again = prods || st.again || "push"; return; } st.busy = true;
      try { if (prods) await syncLaunchBoard(prods, st.D, st.cu); } catch (e) { console.error("[v2] 신제품 대시보드 반영 실패:", e); }
      try { if (st.prods) await pushLaunchBoard(st.prods, st.D, st.cu); } catch (e) { console.error("[v2] 신제품 대시보드에 쓰기 실패:", e); }
      st.busy = false; if (st.again) { const n = st.again; st.again = null; setTimeout(() => run(n === "push" ? null : n), 500); } };
    ref.current.run = run;
    // 기기에 저장된(낡았을 수 있는) 목록으로는 반영하지 않음 — 서버에서 온 목록일 때만 (정밀 검토 2026-10-06)
    let t = null; const un = fb.listenLaunch((items, fromCache) => { if (fromCache) return; clearTimeout(t); t = setTimeout(() => run(items), 1200); });
    return () => { clearTimeout(t); un && un(); ref.current.run = null; }; }, [on]);
  useEffect(() => { const st = ref.current; if (!on || !st.run || !st.prods) return;
    const t = setTimeout(() => st.run && st.run(null), 1500); return () => clearTimeout(t); }, [on, D]);
}
// 업무OS → 신제품 대시보드 (3단계): 프로젝트마다 lbpush.planLaunchPush → 신제품 문서에 조건부로 씀(그사이 신제품에서 그 칸을 고쳤으면 건너뜀)
//   → 쓴 업무·프로젝트의 '마지막으로 본 값'(lbSeen)을 새로 (되돌아와 다시 반영되지 않게) · 하루 첫 쓰기 전에 신제품 대시보드 통째 백업
let lbBackup = "";
export async function pushLaunchBoard(prods, D, cu) {
  if (!cu || !cu.id) return { n: 0 };
  const live = (prods || []).filter((p) => p && p.name && !p.deletedAt); let n = 0;
  for (const p of live) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p.id); if (!proj || !proj.lbSeen || proj.deleted || secretOn(proj)) continue;   // 기밀 프로젝트·업무는 신제품 대시보드(로그인 없는 화면)에 안 씀
    const tasks = (D.tasks || []).filter((t) => t.projectId === proj.id && !secretOn(t)), now = nowIso(), pl = planLaunchPush(p, proj, tasks, D.users, now, cu.name, prods.structure);
    if (!pl.board) continue;
    const day = "launch-" + ymd(new Date()); if (lbBackup !== day) { await fb.backupLaunch(day, prods, cu.name, true); lbBackup = day; }
    const by = `${cu.name} (${LB_BY})`, said = pl.board.said;
    const fields = { ...pl.board.fields, ...(said.length ? { updatedAt: now, updatedBy: by, history: fb.arrayUnion({ at: now, by, text: "업무OS에서 · " + said.join(", ").slice(0, 200) }) } : {}) };
    const r = await fb.patchLaunchIf([{ id: p.id, fields, expect: pl.board.expect }]);
    if (!r.done) continue;
    const ops = pl.tasks.filter((x) => x.extra || JSON.stringify(x.lbSeen) !== JSON.stringify(x.t.lbSeen)).map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { lbSeen: x.t.lbSeen || null }, fields: { lbSeen: x.lbSeen, ...(x.extra || {}) } }));   // extra: 새 줄 번호(lbRow)
    if (ops.length) await fb.patchManyIf(ops, { noFallback: true });
    if (pl.project) await fb.patchIf("projects", proj._doc || proj.id, { lbSeen: proj.lbSeen || null }, { lbSeen: pl.project.lbSeen }, { noFallback: true });
    if (said.length) n++;
  }
  if (n) console.log(`[v2] 신제품 대시보드에 반영 · 제품 ${n}개`);
  return { n };
}
export async function syncLaunchBoard(prods, D, cu) {
  const today = ymd(new Date()); let made = 0, changed = 0;
  const live = (prods || []).filter((p) => p && p.name && !p.deletedAt);
  if (live.some((p) => ![...(D.projects || []), ...(D.removedProjects || [])].some((x) => x.id === "lb_" + p.id))) made = await syncNewLaunch(D, cu);   // 없앤 신제품 프로젝트는 있는 것으로(다시 안 만듦)
  // 4단계 ④ 직접 추가한 단계: 구조 문서의 단계마다 업무가 없으면 만들기(없을 때만) · 지운 단계의 업무는 중단(지우지 않음)
  const st0 = prods.structure, hasCustom = !!(st0 && st0.custom && Object.keys(st0.custom).length) || (D.tasks || []).some((t) => t.customStep && t.status !== "dropped");
  if (hasCustom) for (const p of live) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p.id); if (!proj || !projOpen(proj)) continue;
    const now = nowIso(), cs = planCustomSteps(p, proj, (D.tasks || []).filter((t) => t.projectId === proj.id), D.users, st0, today, now);
    const m = cs.create.length ? (await fb.createMissing(cs.create.map((d) => ({ key: "tasks", id: d.id, data: d })))).made : 0;
    if (!st0) cs.drop = [];   // 구조 문서를 못 받았으면 '지운 단계'로 보고 중단하지 않음
    const dr = cs.drop.length ? await fb.patchManyIf(cs.drop.map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { status: x.t.status || null }, fields: { ...x.fields, updatedAt: now, updatedBy: "board" } })), { noFallback: true }) : { done: 0 };
    cs.drop.length = dr.done;
    if (m || cs.drop.length) { changed += m + cs.drop.length; const id = newId("lg"); await fb.put("log", id, { id, action: "sync", col: "tasks", targetId: "", projectId: proj.id, by: "board", byName: "신제품 대시보드", at: now,
      label: `신제품 대시보드에서 · ${p.name}${m ? ` · 추가한 단계 ${cs.create.slice(0, m).map((d) => d.title).join(", ")}` : ""}${cs.drop.length ? ` · 지운 단계 ${cs.drop.length}개 중단` : ""}` }); }
  }
  // 4단계 휴지통: 신제품 대시보드에서 지운 제품 → 업무OS 프로젝트 중단(지우지 않음) · 되살리면 다시 열기 (표시 lbTrash 로 한 번만)
  for (const p of (prods || []).filter((x) => x && x.name)) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p.id); if (!proj || !!p.deletedAt === !!proj.lbTrash) continue;
    const tasks = (await fb.fetchWhere("tasks", ["projectId", "==", proj.id])).filter((t) => !t.deleted && !isRemoved(t)), now = nowIso(), tr = planLaunchTrash(p, proj, tasks, now); if (!tr) continue;
    const r = await fb.patchIf("projects", proj._doc || proj.id, { lbTrash: proj.lbTrash || null, status: proj.status || null }, { ...tr.project, updatedAt: now, updatedBy: "board",
      ...(tr.label ? { endLog: fb.arrayUnion({ kind: p.deletedAt ? "dropped" : "resume", why: tr.label, at: now, by: "board", byName: "신제품 대시보드" }) } : {}) }, { noFallback: true });
    if (!r.ok) continue;
    if (tr.tasks.length) await fb.patchManyIf(tr.tasks.map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { status: x.t.status || null }, fields: { ...x.fields, updatedAt: now, updatedBy: "board", statusLog: fb.arrayUnion({ by: "board", byName: "신제품 대시보드", at: now, status: x.fields.status }) } })), { noFallback: true });
    if (tr.label) { const id = newId("lg"); await fb.put("log", id, { id, action: "projEnd", col: "projects", targetId: proj.id, projectId: proj.id, by: "board", byName: "신제품 대시보드", at: now, label: `${p.name} · 신제품 대시보드 ${tr.label}${tr.tasks.length ? ` · 업무 ${tr.tasks.length}건` : ""}` }); changed++; }
  }
  for (const p0 of live) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p0.id); if (!proj) continue;
    const v0 = p0.updatedAt || p0.createdAt || "x", rows0 = LAUNCH_ITEMS.some((it) => (((p0.stages || {})[it.id] || {}).tasks || []).length);
    if (proj.lbSyncedAt === v0 && (p0.project || "") === (proj.lbProject || "") && (proj.lbRows || !rows0)) continue;   // 하위 프로젝트·할 일 줄은 처음 한 번 따라잡기
    // 받아 둔 목록이 그사이 낡았을 수 있음 → 쓰기 직전에 그 제품을 서버에서 다시 읽어 그 값으로 (낡은 값으로 남의 변경을 되돌리지 않게 · 정밀 검토 2026-10-06)
    const p = await fb.readLaunchProduct(p0.id); if (!p || p.deletedAt || !p.name) continue;
    const ver = p.updatedAt || p.createdAt || "x"; const rows = LAUNCH_ITEMS.some((it) => (((p.stages || {})[it.id] || {}).tasks || []).length);
    if (proj.lbSyncedAt === ver && (p.project || "") === (proj.lbProject || "") && (proj.lbRows || !rows)) continue;
    const tasks = (await fb.fetchWhere("tasks", ["projectId", "==", proj.id])).filter((t) => !t.deleted);
    const now = nowIso(), pl = planLaunchSync(p, proj, tasks, D.users, today, now, prods.structure);
    // 할 일 줄 → 하위 업무 (4단계 ③): 새 줄은 없을 때만 만들기 · 바뀐 줄은 아래 조건부 쓰기에 같이
    const rs = planRowSync(p, proj, tasks, D.users, now, prods.structure); pl.tasks.push(...rs.tasks);
    const madeRows = rs.create.length ? (await fb.createMissing(rs.create.map((d) => ({ key: "tasks", id: d.id, data: d })))).made : 0;
    const ops = pl.tasks.map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { lbSeen: x.t.lbSeen || null, v2At: x.t.v2At || null },
      fields: { ...x.fields, updatedAt: now, updatedBy: "board", ...(x.fields.status && x.fields.status !== x.t.status ? { statusLog: fb.arrayUnion({ by: "board", byName: "신제품 대시보드", at: now, status: x.fields.status }) } : {}) } }));
    const r = ops.length ? await fb.patchManyIf(ops, { noFallback: true }) : { done: 0, skipped: [] };
    // 다 들어갔을 때만 '여기까지 맞춤' 표시 → 건너뛴 업무가 있으면 다음 신호 때 다시
    await fb.patchIf("projects", proj._doc || proj.id, { lbSyncedAt: proj.lbSyncedAt || null }, { ...(pl.project ? pl.project.fields : {}), ...(r.skipped.length ? {} : { lbSyncedAt: ver, ...(rows ? { lbRows: true } : {}) }), updatedAt: now }, { noFallback: true });
    const real = pl.tasks.filter((x) => x.label && !r.skipped.includes(x.t._doc || x.t.id));
    if (madeRows) real.push(...rs.create.slice(0, madeRows).map((d) => ({ t: d, label: "할 일 줄 → 하위 업무" })));
    if (real.length || (pl.project && pl.project.label)) { changed += real.length;
      const id = newId("lg"); await fb.put("log", id, { id, action: "sync", col: "tasks", targetId: "", projectId: proj.id, by: "board", byName: "신제품 대시보드", at: now,
        label: `신제품 대시보드에서 · ${p.name}${pl.project && pl.project.label ? " · " + pl.project.label : ""}${real.length ? ` · 업무 ${real.length}건 (${[...new Set(real.flatMap((x) => x.label.split("·")))].join("·")})` : ""}`, ids: real.map((x) => x.t.id) }); }
  }
  if (made || changed) console.log(`[v2] 신제품 대시보드 반영 · 새 제품 ${made} · 바뀐 업무 ${changed}`);
  return { made, changed };
}
// 신제품 보드(버전1 launch-board) 바로 읽기: v2 에 아직 없는 제품만 새로 만든다 (이미 있는 제품·항목은 절대 덮지 않음)
//  열 때 한 번 · 버전1은 읽기만 · 쓰기 직전에 v2 프로젝트를 서버에서 다시 확인 (다른 기기가 먼저 넣었으면 건너뜀)
export async function syncNewLaunch(D, cu) {
  const prods = await fb.readV1Launch();
  const have0 = new Set([...(D.projects || []), ...(D.removedProjects || [])].map((p) => p.id));
  if (!(prods || []).some((p) => p && p.name && !p.deletedAt && !have0.has("lb_" + p.id))) return 0;
  const have = new Set((await fb.fetchWhere("projects", null)).map((p) => p.id));
  const lp = planLaunchImport(prods.filter((p) => !have.has("lb_" + p.id)), D);
  if (!lp.projects.length) return 0;
  const at = nowIso(), ids = new Set(lp.projects.map((p) => p.id));
  // 없을 때만 만들기 — 두 사람이 동시에 앱을 열어도 같은 제품을 두 번 쓰거나 먼저 고친 것을 덮지 않음
  const r = await fb.createMissing([...lp.projects.map((x) => ({ key: "projects", id: x.id, data: { ...x, syncedAt: at } })), ...lp.tasks.filter((t) => ids.has(t.projectId)).map((x) => ({ key: "tasks", id: x.id, data: x }))]);
  if (!r.made) return 0;
  const lid = newId("lg"); await fb.put("log", lid, { id: lid, action: "launch", col: "projects", targetId: "", label: `신제품 보드에서 새 제품 ${lp.projects.length}개 가져옴 (${lp.projects.map((p) => p.title).join(", ").slice(0, 120)})`, by: cu.id, byName: cu.name, at });
  console.log(`[v2] 신제품 보드 새 제품 ${lp.projects.length}개 가져옴`);
  return lp.projects.length;
}
// 공통 문지기: 확인 중 · 첫 복사 · 오류 · 로그인 화면을 대신 보여주고, 통과하면 null
export function Gate({ B, title, admin }) {
  if (B.meta === undefined) return <Splash title={title} text={B.metaErr || "불러오는 중…"} retry={B.metaErr ? B.checkMeta : null} />;
  if (B.meta === null) return <SeedGate onDone={B.setMeta} />;
  if (B.err) return <Splash title={title} text={B.err} />;
  if (!B.D.ready) return <Splash title={title} text="불러오는 중…" />;
  if (!B.authed) return <Login D={B.D} title={title} admin={admin} preset={B.cu && B.cu.active !== false ? B.cu : null} onIn={B.signIn} />;
  if (!B.D.loaded) return <Splash title={title} text="내 일 불러오는 중…" />;
  return null;
}

export function Splash({ text, retry, title }) {
  return <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{title || "커머스본부 업무OS v2"}</div>
    <div style={{ fontSize: 14, color: C.sub }}>{text}</div>
    {retry && <div style={{ width: 220 }}><Big onClick={retry}>다시 확인</Big></div>}
  </div>;
}

// 처음 한 번: v1 데이터를 읽기만 해서 v2 칸으로 복사
export function SeedGate({ onDone }) {
  const [st, setSt] = useState({ step: "ask" });
  const run = async () => {
    try {
      setSt({ step: "read" });
      const v1 = await fb.readV1State(); const notes = await fb.readV1Notes(); const prods = await fb.readV1Launch();
      const { ops, counts } = planSeed(v1, notes);
      if (!(v1.users || []).length || !(v1.tasks || []).length) throw new Error("버전1 데이터가 비어 보여요 — 복사를 멈췄어요");
      const lp = planLaunchImport(prods, { users: v1.users, workflows: v1.workflows }); ops.push(...lp.projects.map((x) => ({ key: "projects", id: x.id, data: x })), ...lp.tasks.map((x) => ({ key: "tasks", id: x.id, data: x }))); counts.launch = lp.projects.length;
      setSt({ step: "write", n: 0, total: ops.length });
      await fb.putMany(ops, (n, total) => setSt({ step: "write", n, total }));
      const m = { seededAt: nowIso(), seededBy: "첫 실행", counts, from: "pour-os/state-*", launchAt: nowIso() };
      await fb.setMeta(m); onDone(m);
    } catch (e) { console.error("[v2] 복사 실패:", e); setSt({ step: "err", msg: e.message }); }
  };
  return <div className="v2-center">
    <div style={{ width: "min(460px, 100%)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 10px" }}>업무OS v2 시험판</h1>
      <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.7, margin: "0 0 18px" }}>처음 한 번, 버전1 데이터를 v2로 복사해요.<br />버전1은 <b style={{ color: C.ink }}>읽기만</b> 하고 아무것도 바꾸지 않아요.<br />v2에서 바꾼 것은 버전1에 반영되지 않아요.</p>
      {st.step === "ask" && <Big onClick={run}>버전1 데이터 복사하기</Big>}
      {st.step === "read" && <Big disabled>버전1 읽는 중…</Big>}
      {st.step === "write" && <Big disabled>복사 중 {st.n}/{st.total}</Big>}
      {st.step === "err" && <><p style={{ color: C.red, fontSize: 14, fontWeight: 700 }}>복사하지 못했어요: {st.msg}</p><Big onClick={run}>다시 하기</Big></>}
      <p style={{ marginTop: 16 }}><a href={V1_URL} style={{ color: C.navy, fontSize: 14, fontWeight: 700 }}>버전1 열기 ›</a></p>
    </div>
  </div>;
}

// 나 고르기 + 사람별 PIN
export function Login({ D, preset, onIn, title, admin }) {
  const [u, setU] = useState(preset);
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [p3, setP3] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [lock, setLock] = useLocal(LS("pinlock"), {});
  const users = activeUsers(D.users).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const only4 = (s) => s.replace(/\D/g, "").slice(0, 4);
  const ref = useRef(null); useEffect(() => { if (u && ref.current) ref.current.focus(); }, [u]);
  if (!u) return <div className="v2-center">
    <div style={{ width: "min(520px, 100%)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 6px" }}>이 기기를 쓰는 사람을 골라 주세요</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px", lineHeight: 1.6 }}>{admin ? "관리 대시보드는 관리자만 열 수 있어요. 바꾼 것은 이 이름으로 기록에 남아요." : "체크와 댓글이 이 이름으로 남아요. 다른 사람 일은 달력 오른쪽 위 [나 ▾]에서 봐요."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {users.map((x) => <button key={x.id} type="button" onClick={() => { setU(x); setMsg(""); }} style={{ height: 56, borderRadius: 14, border: `1.5px solid ${C.line}`, background: "#fff", fontSize: 16, fontWeight: 800, color: C.ink, fontFamily: "inherit", cursor: "pointer" }}>{x.name}</button>)}
      </div>
    </div>
  </div>;
  const setMode = !u.pinHash, lk = lock[u.id] || {}, locked = lk.until && lk.until > Date.now();
  const submit = async () => {
    if (busy) return;
    if (setMode) {
      if (p1.length !== 4) return setMsg("숫자 4자리로 정해 주세요");
      if (p1 !== p2) return setMsg("두 번 입력한 PIN이 달라요");
      if (u.pinInvite) { if (locked) return;   // 시작 코드도 5번 틀리면 5분 잠금
        if (pinHash(u.id, "inv:" + p3) !== u.pinInvite) { const n = (lk.n || 0) + 1; setLock((l) => ({ ...l, [u.id]: n >= 5 ? { n: 0, until: Date.now() + 5 * 60000 } : { n } })); setP3("");
          return setMsg(n >= 5 ? "5번 틀려서 5분 동안 잠겼어요" : `시작 코드가 맞지 않아요 (${n}/5) · 관리자에게 받은 4자리를 넣어 주세요`); } }
      const h = pinHash(u.id, p1); setBusy(true);
      // 아직 PIN 이 없고 시작 코드가 그대로일 때만 저장 (다른 기기에서 먼저 정했으면 막음)
      try { const r = await fb.patchIf("users", u._doc || u.id, { pinHash: null, pinInvite: u.pinInvite || null }, { pinHash: h, pinSetAt: nowIso(), pinByCode: !!u.pinInvite, pinInvite: null });
        if (r.ok) onIn(u, h); else setMsg("다른 기기에서 방금 PIN을 정했어요 · 본인이 아니면 관리자에게 PIN 초기화를 부탁하세요"); }
      catch (e) { console.error("[v2] PIN 저장 실패:", e); setMsg("저장하지 못했어요 · 인터넷 연결을 확인해 주세요"); }
      setBusy(false); return;
    }
    if (locked) return;
    const h = pinHash(u.id, p1);
    if (h === u.pinHash) { setLock((l) => ({ ...l, [u.id]: {} })); onIn(u, h); return; }
    const n = (lk.n || 0) + 1; setLock((l) => ({ ...l, [u.id]: n >= 5 ? { n: 0, until: Date.now() + 5 * 60000 } : { n } }));
    setP1(""); setMsg(n >= 5 ? "5번 틀려서 5분 동안 잠겼어요" : `PIN이 맞지 않아요 (${n}/5)`);
  };
  return <div className="v2-center">
    <div style={{ width: "min(400px, 100%)", display: "flex", flexDirection: "column", gap: 10 }}>
      <TBtn onClick={() => { setU(null); setP1(""); setP2(""); setP3(""); setMsg(""); }} style={{ alignSelf: "flex-start" }}>‹ 다른 사람 고르기</TBtn>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: 0 }}>{u.name}</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 6px", lineHeight: 1.6 }}>{setMode ? (u.pinInvite ? "처음이에요. 관리자에게 받은 시작 코드와 내가 쓸 PIN 4자리를 넣어 주세요." : "처음이에요. 내 이름으로만 쓰도록 PIN 4자리를 정해 주세요. 정하면 관리자에게 알림이 가요.") : "PIN 4자리를 넣어 주세요. 잊었다면 관리자에게 초기화를 부탁하세요."}</p>
      {setMode && u.pinInvite && <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={p3} onChange={(e) => { setP3(only4(e.target.value)); setMsg(""); }} placeholder="시작 코드 4자리" aria-label="시작 코드" style={{ ...inp, fontSize: 20, letterSpacing: 8, textAlign: "center" }} />}
      <input ref={ref} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={p1} disabled={locked} onChange={(e) => { setP1(only4(e.target.value)); setMsg(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="PIN 4자리" aria-label="PIN" style={{ ...inp, fontSize: 20, letterSpacing: 8, textAlign: "center" }} />
      {setMode && <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={p2} onChange={(e) => { setP2(only4(e.target.value)); setMsg(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="한 번 더" aria-label="PIN 확인" style={{ ...inp, fontSize: 20, letterSpacing: 8, textAlign: "center" }} />}
      {msg && <p role="alert" style={{ margin: 0, color: C.red, fontSize: 13.5, fontWeight: 700 }}>{msg}</p>}
      <Big onClick={submit} disabled={busy || locked || p1.length !== 4 || (setMode && p2.length !== 4) || (setMode && u.pinInvite && p3.length !== 4)}>{setMode ? "PIN 정하고 시작" : "시작"}</Big>
    </div>
  </div>;
}

// ───────────────── 저장 동작 (바뀐 칸만) ─────────────────
// 흐름: 맡김(requestedBy) → 받았어요(ackAt) → 진행 → 끝냈어요(맡긴 사람이 있으면 status:"review") → 확인 완료(done) / 수정 요청(feedback)
//       기한은 맡긴 사람·책임자·마스터만 바로 바꾸고, 담당은 '기한 조정 요청'(dueReq) → 수락 시 바뀜
// idx: turn.js turnIndex(D) — 끝낼 때 "다음은 ○○님 차례예요"를 말해 주는 데 씀 (없어도 됨)
export function useActs(D, cu, setToast, idx = null) {
  const by = () => ({ by: cu.id, byName: cu.name, at: nowIso() });
  const fail = (what) => (e) => { console.error(`[v2] ${what} 실패:`, e); setToast({ text: `${what} 저장 실패 · 인터넷 연결을 확인해 주세요` }); };
  const log = (action, o) => { const id = newId("lg"); return fb.put("log", id, { id, action, ...by(), ...o }).catch(fail("기록")); };
  const tdoc = (t) => t._doc || t.id;
  const sl = (status, extra) => fb.arrayUnion({ by: cu.id, byName: cu.name, at: nowIso(), status, ...(extra || {}) });
  const recalc = async (pid) => {
    if (!pid) return; const p = D.projects.find((x) => x.id === pid); if (!p || p.progressManual) return;
    try { const all = (await fb.fetchWhere("tasks", ["projectId", "==", pid])).filter((t) => !t.isFixed && !t.deleted && !isRemoved(t));
      const pct = all.length ? Math.round((all.filter(isDone).length / all.length) * 100) : 0;
      if (Number(p.progress) !== pct) await fb.patch("projects", p._doc || p.id, { progress: pct, updatedAt: nowIso(), v2At: nowIso() }); }
    catch (e) { console.error("[v2] 진척 계산 실패:", e); }
  };
  // v2At: v2 에서 고친 표시 (다시 가져오기가 v2 에서 정리한 담당·기한을 덮지 않게)
  // extra: 기록에 더 남길 칸(예: prev 이전 값)
  // 기록: 이전 값(prev)이 있으면 바뀐 뒤 값(next)도 같이 → 업무 '기록' 탭에 '이전 → 이후'
  const nextOf = (f, extra) => (extra && extra.prev && typeof extra.prev === "object" && !Array.isArray(extra.prev) ? { next: Object.fromEntries(Object.keys(extra.prev).filter((k) => k in f).map((k) => [k, f[k] === undefined ? null : f[k]])) } : {});
  const P = (t, f, logAction, label, extra) => fb.patch("tasks", tdoc(t), { ...f, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }).then(() => { if (logAction) log(logAction, { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: label || t.title, ...(extra || {}), ...nextOf(f, extra) }); }).catch(fail("업무"));
  // 이전 값 (없던 칸은 null) — 되돌리기·기록용
  const prevOf = (t, f) => Object.fromEntries(Object.keys(f).map((k) => [k, t[k] === undefined ? null : t[k]]));
  // 되돌리기 (여러 사람이 같이 쓸 때): 내가 쓴 값이 서버에 아직 그대로인 문서만 되돌림 — 그사이 다른 사람이 바꾼 건 건너뛰고 알림
  //   ops: [{key, id, wrote(내가 쓴 칸), prev(되돌릴 값)}] · 시각 칸·arrayUnion 같은 특수 값은 비교에서 뺌
  const STAMP = new Set(["updatedAt", "updatedBy", "v2At"]);
  const plainV = (v) => v === null || typeof v !== "object" || Array.isArray(v) || (Object.getPrototypeOf(v) === Object.prototype && !v.__au && !v.__ar && !v.__del);
  const expectOf = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => !STAMP.has(k) && plainV(v)));
  const undoMany = async (ops, label, logAction = "bulk") => {
    const at = nowIso();
    try { const r = await fb.patchManyIf(ops.map((o) => ({ key: o.key, id: o.id, expect: expectOf(o.wrote), fields: { ...o.prev, updatedAt: at, updatedBy: cu.id, v2At: at } })));
      if (label) log(logAction, { col: ops[0] ? ops[0].key : "tasks", targetId: ops.length === 1 ? ops[0].id : "", label: `되돌림 · ${label}${r.skipped.length ? ` · ${r.skipped.length}건은 다른 사람이 바꿔서 그대로` : ""}`, ids: ops.map((o) => o.id) });
      setToast({ text: r.skipped.length ? (ops.length === 1 ? "그사이 다른 사람이 바꿔서 되돌리지 않았어요 · 기록 탭에서 확인해 주세요" : `되돌렸어요 · ${r.skipped.length}건은 그사이 다른 사람이 바꿔서 그대로 뒀어요`) : "되돌렸어요" });
      return r; }
    catch (e) { fail("되돌리기")(e); return null; }
  };
  const undoT = (t, wrote, prev, label, logAction = "edit") => undoMany([{ key: "tasks", id: tdoc(t), wrote, prev }], label, logAction).then((r) => { if (r && r.done && t.projectId) recalc(t.projectId); return r; });
  const A = {
    log, recalc, patchTask: P, undoMany, undoTask: undoT,
    toast: (text) => setToast({ text }),   // 화면 조각(BulkBar 등)이 결과를 알릴 때
    addTask: async (f) => {
      const id = newId("t"), at = nowIso(), p = D.projects.find((x) => x.id === f.projectId), who = f.assigneeId || cu.id;
      const t = { id, title: f.title.trim(), isFixed: false, type: "general", status: "todo", assigneeId: who, assigneeIds: [who], projectId: f.projectId || "", parentId: f.parentId || null,
        dueDate: f.dueDate || "", workDate: "", memo: "", attachments: [], weekDay: null, weekSlot: null, priority: "mid", ...(p && p.brand ? { brand: p.brand } : {}),
        ...(f.firstStep ? { firstStep: f.firstStep.trim() } : {}), ...(f.noReview ? { noReview: true } : {}), ...(who === cu.id ? { ackAt: at } : {}),
        ...(Array.isArray(f.deps) ? { deps: f.deps } : {}), ...(f.phase ? { phase: f.phase, phaseBy: cu.id, phaseAt: at } : {}), ...(f.extra || {}), v2At: at,
        requestedBy: cu.id, requestedAt: at, createdAt: at, createdBy: cu.id, statusLog: [{ by: cu.id, byName: cu.name, at, status: "todo" }], madeIn: "v2" };
      try { await fb.put("tasks", id, t); } catch (e) { fail("업무")(e); return null; }
      log("add", { col: "tasks", targetId: id, projectId: t.projectId, label: t.title + (who !== cu.id ? ` → ${nameOf(D.users, who)}` : "") });
      if (t.projectId) recalc(t.projectId);
      return t;
    },
    // 끝냈어요 — 맡긴 사람이 있으면 확인 요청, 아니면 바로 끝
    // note: 다음 사람에게 한마디(있으면 handoff 댓글로 남김 → 뒷사람 '지금 할 일' 카드의 '앞 일 마지막 말')
    finish: (t, note, opt) => { if (!(opt && opt.any) && !canFinish(t, cu)) { setToast({ text: "담당이나 관리자만 끝낼 수 있어요" }); return; }
      const proxy = !isMine(t, cu.id) && !(opt && opt.any) ? ownersOf(t)[0] || "" : "", px = proxy ? { doneBy: proxy, doneByName: nameOf(D.users, proxy) || cu.name, doneProxy: { by: cu.id, byName: cu.name, at: nowIso() } } : {};   // 관리자가 대신 끝냄: 끝낸 사람 = 담당 · 누른 사람 = 관리자(기록·상태 기록 by)
      const pxL = proxy ? ` (관리자 ${cu.name}님이 대신)` : "";
      const at = nowIso(), prev = { status: t.status, doneAt: t.doneAt || null, reviewAt: t.reviewAt || null, finishedAt: t.finishedAt || null, feedback: t.feedback || null, blocked: t.blocked || null, ackAt: t.ackAt || null };
      const nx = idx ? nextTurnText(t, idx, D.users) : { text: "" };
      if (note && note.trim()) A.addNote(taskNoteId(t.id), note.trim(), null, [], { taskId: t.id, projectId: t.projectId }, { handoff: true });
      const lead = ((D.projects || []).find((p) => p.id === t.projectId) || {}).assigneeId;
      const tail = nx.text ? ` · ${nx.text}` : nx.noOwner ? ` · 다음 일 담당이 없어서 ${lead && lead !== cu.id ? `책임자 ${nameOf(D.users, lead)}님께 알렸어요` : "담당을 정해 주세요"}` : "";
      if (needsReview(t)) {
        const f = { status: "review", reviewAt: at, reviewTo: reqOf(t), finishedAt: at, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) };
        P(t, { ...f, statusLog: sl("review", proxy ? { proxy } : undefined) }, "review", t.title + pxL);
        setToast({ text: `${nameOf(D.users, reqOf(t))}님께 확인 요청을 보냈어요${tail}`, undo: () => undoT(t, f, prev, `${t.title} · 확인 요청 취소`) });
      } else {
        const f = { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, ...px, finishedAt: at, feedback: null, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) };
        P(t, { ...f, statusLog: sl("done", proxy ? { proxy } : undefined) }, "done", t.title + pxL).then(() => t.projectId && recalc(t.projectId));
        setToast({ text: `끝냈어요${tail || " · " + t.title}`, undo: () => undoT(t, f, prev, `${t.title} · 끝냄 취소`) });
      }
    },
    // 확인 완료 → 담당 '확인할 것'에 '확인 완료'(approvedAt) · 5초 되돌리기 (확인 대기로)
    approve: (t) => { const at = nowIso(), o = ownersOf(t)[0];
      const f = { status: "done", doneAt: t.finishedAt || at, doneBy: o || cu.id, doneByName: nameOf(D.users, o) || cu.name, approvedBy: cu.id, approvedAt: at, feedback: null }, prev = prevOf(t, f);   // 상태 기록(statusLog)은 통째로 되돌리지 않음 (기록은 더하기만)
      P(t, { ...f, statusLog: sl("done", { approved: true }) }, "approve").then(() => t.projectId && recalc(t.projectId));
      setToast({ text: `확인 완료 · ${t.title}`, undo: () => undoT(t, f, prev, `${t.title} · 확인 대기로`, "approve") }); },
    sendBack: (t, text) => { P(t, { status: "inprogress", feedback: { text, ...by() }, reviewAt: null, statusLog: sl("inprogress", { feedback: true }) }, "feedback", `${t.title} · ${text.slice(0, 40)}`);
      A.addNote(taskNoteId(t.id), "수정 요청: " + text, null, [], { taskId: t.id, projectId: t.projectId }); setToast({ text: "수정 요청을 보냈어요" }); },
    reopen: (t) => P(t, { status: "todo", doneAt: null, doneBy: null, doneByName: null, reviewAt: null, statusLog: sl("todo", { reopen: true }) }, "reopen").then(() => t.projectId && recalc(t.projectId)),
    setStatus: (t, s) => P(t, { status: s, statusLog: sl(s), ...(s === "inprogress" && !t.startedAt ? { startedAt: ymd(new Date()) } : {}), ...(s === "inprogress" && !t.ackAt ? { ackAt: nowIso() } : {}) }, "edit", `${t.title} · ${STATUS_L[s]}`),
    // 보류: 이유 · 다시 볼 날을 같이 (이전 상태 holdPrev 기억 → 보류 풀기 = 그 상태로) · 다시 볼 날이 되면 담당 '확인할 것'에
    hold: (t, why, until) => P(t, { status: "hold", holdPrev: t.status === "hold" ? t.holdPrev || "todo" : t.status || "todo", holdReason: why || "", holdUntil: until || "", heldAt: nowIso(), heldBy: cu.id, statusLog: sl("hold", { why: why || "" }) },
      "hold", `${t.title} · 보류${why ? " · " + why : ""}${until ? ` · ${md(until)} 다시` : ""}`, { prev: { status: t.status || "todo" } }),
    unhold: (t) => { const s = t.holdPrev && t.holdPrev !== "hold" && t.holdPrev !== "dropped" ? t.holdPrev : "todo";
      return P(t, { status: s, holdPrev: null, holdUntil: null, holdBy: null, statusLog: sl(s, { unhold: true }) }, "unhold", `${t.title} · 보류 풀기 → ${STATUS_L[s] || "할 일"}`); },
    // 프로젝트 끝내기·멈추기 — completed 완료 · dropped 중단(열린 업무 → 'dropped'로 접음) · hold 보류(열린 업무 → 보류, holdBy 'proj'). 지우는 것 없음 · 5초 되돌리기
    endProject: async (p, kind, why, until) => {
      const at = nowIso(); let ts = [];
      if (kind !== "completed") { try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted && !isRemoved(t) && !isDone(t) && t.status !== "dropped" && !(kind === "hold" && t.status === "hold")); }
        catch (e) { fail("프로젝트 업무 불러오기")(e); return false; } }
      const pf = kind === "completed" ? { status: "completed", progress: 100, completedAt: at, completedBy: cu.id }
        : kind === "dropped" ? { status: "dropped", endPrev: p.status || "active", dropReason: why || "", droppedAt: at, droppedBy: cu.id }
        : { status: "hold", endPrev: p.status || "active", holdReason: why || "", holdUntil: until || "", heldAt: at, heldBy: cu.id };
      const tf = (t) => (kind === "dropped" ? { status: "dropped", dropPrev: t.status || "todo", droppedAt: at } : { status: "hold", holdPrev: t.status || "todo", holdBy: "proj", holdReason: why || "", heldAt: at, heldBy: cu.id });
      const tOps = ts.map((t) => { const f = tf(t); return { key: "tasks", id: tdoc(t), fields: { ...f, updatedAt: at, updatedBy: cu.id, v2At: at }, prev: prevOf(t, f) }; });
      const pPrev = prevOf(p, pf);
      try { if (tOps.length) await fb.patchMany(tOps.map(({ key, id, fields }) => ({ key, id, fields: { ...fields, statusLog: sl(fields.status, { proj: kind }) } })));
        await fb.patch("projects", p._doc || p.id, { ...pf, updatedAt: at, updatedBy: cu.id, v2At: at, endLog: fb.arrayUnion({ kind, why: why || "", until: until || "", at, by: cu.id, byName: cu.name }) }); }
      catch (e) { fail("프로젝트")(e); return false; }
      const word = kind === "completed" ? "완료" : kind === "dropped" ? "중단" : "보류";
      log("projEnd", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · ${word}${why ? " · " + why : ""}${until ? ` · ${md(until)} 다시` : ""}${ts.length ? ` · 남은 업무 ${ts.length}건 접음` : ""}`, prev: { status: p.status || "", ids: ts.map((t) => t.id) } });
      setToast({ text: `${word}했어요${ts.length ? ` · 남은 업무 ${ts.length}건 접음` : ""}`, undo: () => undoMany([{ key: "projects", id: p._doc || p.id, wrote: pf, prev: pPrev }, ...tOps.map((o) => ({ key: o.key, id: o.id, wrote: o.fields, prev: o.prev }))], `${p.title} · ${word} 취소`, "projResume") });
      if (kind === "completed") recalc(p.id);
      return true;
    },
    // 다시 시작(보류) · 다시 열기(중단·완료): 접은 업무를 이전 상태로 · shift 일만큼 기한 미루기(평일로 맞춤, 0 = 그대로)
    resumeProject: async (p, shift) => {
      const at = nowIso(), dropped = p.status === "dropped", held = isHoldP(p); let ts = [];
      try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted && !isRemoved(t) && ((dropped && t.status === "dropped") || (held && t.status === "hold" && t.holdBy === "proj"))); }
      catch (e) { fail("프로젝트 업무 불러오기")(e); return false; }
      const mv = (d) => (shift && d ? nextWorkday(addDays(String(d).slice(0, 10), shift)) : null);
      const tOps = ts.map((t) => { const s0 = (dropped ? t.dropPrev : t.holdPrev) || "todo", s = s0 === "dropped" || (!dropped && s0 === "hold") ? "todo" : s0;   // 중단 전에 보류였던 일은 보류로
        return { key: "tasks", id: tdoc(t), fields: { status: s, ...(dropped ? { dropPrev: null } : { holdPrev: null, holdBy: null }), ...(mv(t.dueDate) ? { dueDate: mv(t.dueDate) } : {}), statusLog: sl(s, { resume: true }), updatedAt: at, updatedBy: cu.id, v2At: at } }; });
      const ok = p.endPrev && !["hold", "paused", "dropped", "completed", "done"].includes(p.endPrev) ? p.endPrev : "active";
      try { if (tOps.length) await fb.patchMany(tOps);
        await fb.patch("projects", p._doc || p.id, { status: ok, holdUntil: null, resumedAt: at, resumedBy: cu.id, ...(mv(p.dueDate) && !String(p.id).startsWith("lb_") ? { dueDate: mv(p.dueDate) } : {}), updatedAt: at, updatedBy: cu.id, v2At: at, endLog: fb.arrayUnion({ kind: "resume", shift: shift || 0, at, by: cu.id, byName: cu.name }) }); }
      catch (e) { fail("프로젝트")(e); return false; }
      log("projResume", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · ${dropped ? "다시 엶" : p.status === "completed" || p.status === "done" ? "다시 엶" : "다시 시작"}${ts.length ? ` · 업무 ${ts.length}건 되돌림` : ""}${shift ? ` · 기한 ${shift}일 미룸` : ""}` });
      setToast({ text: `다시 시작했어요${ts.length ? ` · 업무 ${ts.length}건 되돌림` : ""}${shift ? ` · 기한 ${shift}일 미룸` : ""}` });
      recalc(p.id); return true;
    },
    ack: (t) => { P(t, { ackAt: nowIso(), ackBy: cu.id }, "ack"); const w = nameOf(D.users, reqOf(t) || (t.assignedBy !== cu.id ? t.assignedBy : "")); setToast({ text: w ? `받았어요 · ${w}님 화면에 '받음'으로 보여요` : "받았어요" }); },
    ackMany: (ts) => { const at = nowIso(); fb.patchMany(ts.map((t) => ({ key: "tasks", id: tdoc(t), fields: { ackAt: at, ackBy: cu.id, updatedAt: at, updatedBy: cu.id, v2At: at } }))).catch(fail("받음")); if (ts[0]) log("ack", { col: "tasks", targetId: ts[0].projectId, projectId: ts[0].projectId, label: `항목 ${ts.length}개 받음` }); setToast({ text: `${ts.length}개 받았어요` }); },
    // 처음 맡긴 사람(requestedBy)은 그대로 — 확인·기한 허락은 그 사람. 맡긴 사람 기록이 없는 일(신제품 항목 등)은 assignedBy 로 '누가 넘겼나'만 남김
    //   남의 일을 내가 가져오면(이어서 하기) 5초 되돌리기 알림 — 확인 창 없이 한 번에, 대신 되돌릴 수 있게
    // 담당 넘기기: 받는 사람 '확인할 것'에 맡김(진행 중·보류여도) · 이전 담당·맡긴 사람에게 '담당 바뀜'(handoff) · 한마디는 업무 대화에 · 5초 되돌리기
    assign: (t, uid, take, note) => {
      const at = nowIso(), was = ownersOf(t), other = was.find((x) => x !== cu.id);
      const f = { assigneeId: uid, assigneeIds: [uid], ownerAuto: false, ownerFrom: "set", ...(reqOf(t) || t.requestedBy ? { requestedBy: reqOf(t) || t.requestedBy } : { assignedBy: cu.id, assignedAt: at }),
        ...(reqOf(t) || t.requestedBy ? { requestedAt: at } : {}), ackAt: take || uid === cu.id ? at : null, handoff: { from: was, to: uid, note: (note || "").trim(), at, by: cu.id, byName: cu.name } };
      const prev = prevOf(t, f);
      const r = P(t, f, take ? "take" : "assign", `${t.title} · ${was.map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "담당 없음"} → ${nameOf(D.users, uid)}${note && note.trim() ? " · " + note.trim() : ""}`, { prev });
      if (note && note.trim()) A.addNote(taskNoteId(t.id), `담당을 ${nameOf(D.users, uid)}님에게 넘겨요 · ${note.trim()}`, null, [], { taskId: t.id, projectId: t.projectId });
      const undo = () => undoT(t, f, prev, `${t.title} · 담당 ${was.map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "없음"}`, "assign");
      if (uid === cu.id && other && !was.includes(cu.id)) setToast({ text: `${nameOf(D.users, other) || "다른 사람"}님 일을 내가 이어서 해요`, undo });
      else if (uid !== cu.id) setToast({ text: `${nameOf(D.users, uid)}님에게 넘겼어요 · '확인할 것'에 떠요`, undo });
      return r;
    },
    // 참조(CC): 담당이 아니어도 이 업무의 대화·소식을 받는 사람
    setCc: (t, ids) => P(t, { ccIds: ids }, "edit", `${t.title} · 참조 ${ids.map((x) => nameOf(D.users, x)).filter(Boolean).join("·") || "없음"}`, { prev: { ccIds: t.ccIds || [] } }),
    // 참조 한 사람 넣기/빼기 — 목록 통째가 아니라 그 사람만 (두 사람이 동시에 눌러도 서로 지우지 않음)
    toggleCc: (t, uid, on) => P(t, { ccIds: on ? fb.arrayUnion(uid) : fb.arrayRemove(uid) }, "edit", `${t.title} · 참조 ${on ? "+" : "−"} ${nameOf(D.users, uid)}`),
    // 요청 하나로: confirm 확인 받기(확인 대기 → 받는 사람이 확인/수정 요청) · help 도와주세요 · due 기한 바꾸기 — 받는 사람 '확인할 것'에
    ask: (t, kind, to, text, date) => {
      const who = nameOf(D.users, to) || "받는 사람", msg = (text || "").trim();
      if (kind === "confirm") P(t, { status: "review", reviewTo: to, reviewAt: nowIso(), finishedAt: nowIso(), feedback: null, ackAt: t.ackAt || nowIso(), statusLog: sl("review", { ask: true, to }) }, "review", `${t.title} · ${who}님께 확인 요청`);
      else if (kind === "help") P(t, { ask: { kind, to, text: msg, ...by() } }, "ask", `${t.title} · ${who}님께 도움 요청${msg ? " · " + msg.slice(0, 40) : ""}`);
      else if (kind === "due") P(t, { dueReq: { date, reason: msg, to, ...by() }, ackAt: t.ackAt || nowIso() }, "dueReq", `${t.title} · ${md(dueOf(t)) || "미정"} → ${md(date)} · ${who}님께`);
      if (msg) A.addNote(taskNoteId(t.id), `${kind === "confirm" ? "확인 요청" : kind === "help" ? "도움 요청" : "기한 조정 요청"} → ${who}님: ${msg}`, null, [], { taskId: t.id, projectId: t.projectId });
      setToast({ text: `${who}님 '확인할 것'에 보냈어요` });
    },
    closeAsk: (t, solved) => P(t, { ask: null, askDone: { kind: (t.ask || {}).kind || "", solved: !!solved, ...by() } }, "askDone", `${t.title} · ${solved ? "도움 요청 해결" : "도움 요청 거둠"}`),
    // 기한 바꾸기 — 버전1에서 온 작업일(workDate)도 같이 비움(기한 = dueDate || workDate 라서 '미정'이 안 먹던 문제). 이전 값은 기록에
    setDue: (t, d) => { const q = t.dueReq, f = { dueDate: d || "", dueAuto: false, dueReq: null, ...(t.workDate ? { workDate: "" } : {}),
        ...(q && q.by && q.by !== cu.id ? { dueReqResult: { ok: true, date: d || "", reason: d === q.date ? "" : `요청한 ${md(q.date)} 대신 ${d ? md(d) : "미정"}으로 정했어요`, ...by() } } : {}) };
      return P(t, f, "edit", `${t.title} · 기한 ${d ? md(d) : "미정"}`, { prev: { dueDate: t.dueDate || "", workDate: t.workDate || "", dueAuto: !!t.dueAuto } }); },
    // 앞 일 정하기 (deps: v1 과 같은 칸 · [] = 앞 일 없음)
    // 결정 업무: 하위 업무(option)를 '안'으로 비교 → 하나를 정하면 정한 안·이유·날짜를 남기고, 안 고른 안은 보류(지우지 않음), 결정 업무는 끝냄 → 다음 단계 담당에게 '이제 내 차례'
    setDecision: (t, on) => P(t, { decision: !!on }, "edit", `${t.title} · ${on ? "결정 업무로" : "결정 업무 풀기"}`),
    setOptInfo: (o, text) => P(o, { optInfo: String(text || "").slice(0, 120) }),
    decide: async (t, opt, reason, opts) => {
      const at = nowIso(), others = (opts || []).filter((o) => o.id !== opt.id && !isDone(o) && o.status !== "hold");
      const prevT = { decided: t.decided || null, status: t.status, doneAt: t.doneAt || null, reviewAt: t.reviewAt || null, finishedAt: t.finishedAt || null }, prevO = others.map((o) => ({ o, status: o.status, optDropped: o.optDropped || null })), prevChosen = { status: opt.status };
      try {
        await P(t, { decided: { optionId: opt.id, title: opt.title, reason: String(reason || "").trim(), by: cu.id, byName: cu.name, at } }, "decide", `${t.title} → ${opt.title}${reason && reason.trim() ? " · " + reason.trim().slice(0, 40) : ""}`);
        if (others.length) await fb.patchMany(others.map((o) => ({ key: "tasks", id: tdoc(o), fields: { status: "hold", optDropped: true, statusLog: sl("hold", { dropped: true }), updatedAt: at, updatedBy: cu.id, v2At: at } })));
        if (!isDone(opt)) await P(opt, { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, finishedAt: at, ...(opt.ackAt ? {} : { ackAt: at }), statusLog: sl("done", { chosen: true }) });
        const nx = idx ? nextTurnText(t, idx, D.users) : { text: "" };
        if (!isDone(t) && t.status !== "review") A.finish(t, "", { any: true });   // 정한 사람이 끝냄(예전 그대로) · 끝냄 알림은 아래 '정했어요' 알림으로 바뀜 (다음 차례 문구는 같이)
        setToast({ text: `정했어요 · ${opt.title}${others.length ? ` · 나머지 ${others.length}개는 보류` : ""}${nx.text ? " · " + nx.text : ""}`, undo: () => undoMany([{ key: "tasks", id: tdoc(t), wrote: { decided: { optionId: opt.id, title: opt.title, reason: String(reason || "").trim(), by: cu.id, byName: cu.name, at } }, prev: prevT },
          ...prevO.map((x) => ({ key: "tasks", id: tdoc(x.o), wrote: { status: "hold", optDropped: true }, prev: { status: x.status, optDropped: x.optDropped } })),
          ...(prevChosen.status !== "done" ? [{ key: "tasks", id: tdoc(opt), wrote: { status: "done" }, prev: { status: prevChosen.status, doneAt: null, doneBy: null, finishedAt: null } }] : [])], `${t.title} · 결정 취소`, "decide") });
      } catch (e) { fail("결정")(e); }
    },
    setDeps: (t, ids) => P(t, { deps: ids }, "deps", `${t.title} · 앞 일 ${ids.length ? ids.length + "개" : "없음"}`),
    tidySkip: (t) => P(t, { tidySkip: ymd(new Date()).slice(0, 7) }, null),
    // 여러 건 한꺼번에 (최대 100건 · 바뀐 칸만 · 이전 값을 기록에 남기고 5초 되돌리기)
    bulk: async (ts, fieldsOf, label) => {
      if (!ts.length) return false; if (ts.length > 100) { setToast({ text: "한 번에 100건까지예요" }); return false; }
      const at = nowIso(), bulkId = newId("bk");
      const ops = ts.map((t) => { const f = { ...fieldsOf(t, bulkId), updatedAt: at, updatedBy: cu.id, v2At: at }; return { key: "tasks", id: tdoc(t), fields: f, prev: Object.fromEntries(Object.keys(f).map((k) => [k, t[k] === undefined ? null : t[k]])) }; });
      try { await fb.patchMany(ops.map(({ key, id, fields }) => ({ key, id, fields }))); }
      catch (e) { fail("한꺼번에 바꾸기")(e); return false; }
      log("bulk", { col: "tasks", label: `${label} · ${ts.length}건`, ids: ts.map((t) => t.id), prev: ops.map((o) => ({ id: o.id, ...o.prev })) });
      setToast({ text: `${label} · ${ts.length}건 바꿨어요`, undo: () => undoMany(ops.map((o) => ({ key: o.key, id: o.id, wrote: o.fields, prev: o.prev })), label) });
      return true;
    },
    // 한 사람 일 한 번에 넘기기 (휴가·퇴사 · 마스터) — 업무·고정업무는 담당 칸만, 프로젝트는 책임자만 바꿈
    //   업무: 맡긴 사람(requestedBy)은 그대로 · handoff(all) + bulkId → 받는 사람 '확인할 것'에 '○○님 업무 n개 넘겨받음' 한 줄
    //   고정업무: 사람별 체크 기록은 지우지 않음 · 넘기는 사람이 정한 시간은 받는 사람에게 (받는 사람 시간이 없을 때)
    //   한 번에 쓰고, 기록에 이전 값, 5초 되돌리기
    handOver: async (from, to, items, note) => {
      const { tasks = [], fixed = [], projs = [] } = items, at = nowIso(), bulkId = newId("ho"), msg = (note || "").trim();
      const fromN = nameOf(D.users, from) || "?", toN = nameOf(D.users, to) || "?", n = tasks.length + fixed.length + projs.length;
      if (!n || !to || to === from) return false;
      const stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      const ops = [];
      tasks.forEach((t) => { const f = { ...handOverOwners(t, from, to), ownerAuto: false, ownerFrom: "set", assignedBy: cu.id, assignedAt: at, bulkId,
          handoff: { from: [from], to, note: msg, at, by: cu.id, byName: cu.name, all: true }, ...(t.status === "review" ? {} : { ackAt: to === cu.id ? at : null }) };
        ops.push({ key: "tasks", id: tdoc(t), fields: { ...f, ...stamp }, prev: { ...prevOf(t, f), ...stamp } }); });
      fixed.forEach((t) => { const f = handOverOwners(t, from, to), tb = t.timeBy || {};
        if (tb[from] && !tb[to]) f[`timeBy.${to}`] = tb[from];
        const prev = { assigneeIds: t.assigneeIds || [], assigneeId: t.assigneeId || "", ...(f[`timeBy.${to}`] ? { [`timeBy.${to}`]: null } : {}) };
        ops.push({ key: "tasks", id: tdoc(t), fields: { ...f, ...stamp }, prev: { ...prev, ...stamp } }); });
      projs.forEach((p) => ops.push({ key: "projects", id: p._doc || p.id, fields: { assigneeId: to, ...stamp }, prev: { assigneeId: p.assigneeId || "", ...stamp } }));
      try { await fb.patchMany(ops.map(({ key, id, fields }) => ({ key, id, fields }))); }
      catch (e) { fail("일 넘기기")(e); return false; }
      const label = `${fromN} → ${toN} 일 넘기기 · 업무 ${tasks.length} · 고정업무 ${fixed.length} · 프로젝트 ${projs.length}${msg ? " · " + msg.slice(0, 60) : ""}`;
      log("handover", { col: "tasks", targetId: from, label, from, to, bulkId, ids: [...tasks, ...fixed].map((t) => t.id), pids: projs.map((p) => p.id), prev: ops.map((o) => ({ key: o.key, id: o.id, ...o.prev })) });
      setToast({ text: `${toN}님에게 ${n}건 넘겼어요`, undo: () => undoMany(ops.map((o) => ({ key: o.key, id: o.id, wrote: o.fields, prev: o.prev })), `${fromN} → ${toN} 일 넘기기`, "handover") });
      return true;
    },
    // 기한 여러 개 한 번에 (최대 100건 · 이전 기한 기록 · 5초 되돌리기)
    applyDues: (changes, label) => {
      if (!changes.length) return Promise.resolve(false); if (changes.length > 100) { setToast({ text: "한 번에 100건까지예요" }); return Promise.resolve(false); }
      const at = nowIso(), prev = changes.map((x) => ({ id: tdoc(x.task), dueDate: x.task.dueDate || "" }));
      return fb.patchMany(changes.map((x) => ({ key: "tasks", id: tdoc(x.task), fields: { dueDate: x.due, updatedAt: at, updatedBy: cu.id, v2At: at } })))
        .then(() => { log("bulk", { col: "tasks", label: `${label} · ${changes.length}건`, ids: changes.map((x) => x.task.id), prev });
          setToast({ text: `${label} · ${changes.length}건`, undo: () => undoMany(changes.map((x, i) => ({ key: "tasks", id: prev[i].id, wrote: { dueDate: x.due }, prev: { dueDate: prev[i].dueDate } })), label) });
          return true; })
        .catch((e) => { fail("기한")(e); return false; });
    },
    requestDue: (t, date, reason) => { P(t, { dueReq: { date, reason: reason || "", ...by() }, ackAt: t.ackAt || nowIso() }, "dueReq", `${t.title} · ${md(dueOf(t)) || "미정"} → ${md(date)}`); setToast({ text: `${nameOf(D.users, dueApprover(t, D)) || "책임자"}님께 기한 조정을 요청했어요` }); },
    answerDue: (t, ok, reason) => { const r = t.dueReq || {};
      P(t, ok ? { dueDate: r.date, dueAuto: false, dueReq: null, dueReqResult: { ok: true, date: r.date, ...by() } } : { dueReq: null, dueReqResult: { ok: false, reason: reason || "", ...by() } }, ok ? "dueOk" : "dueNo", `${t.title} · ${ok ? "기한 " + md(r.date) : "기한 유지"}`);
      setToast({ text: ok ? `기한을 ${md(r.date)}로 바꿨어요` : "기한을 그대로 두었어요" }); },
    block: (t, reason, to) => { P(t, { blocked: { reason, to: to || "", ...by() } }, "block", `${t.title} · ${reason}`); A.addNote(taskNoteId(t.id), "막힘: " + reason, null, [], { taskId: t.id, projectId: t.projectId }); setToast({ text: `${nameOf(D.users, to) || "책임자"}님께 알렸어요 · 막힌 게 풀리면 '막힘 풀기'를 눌러요` }); },
    unblock: (t) => { const k = t.blocked || {}; return P(t, { blocked: null, unblocked: { by: cu.id, byName: cu.name, at: nowIso(), reason: k.reason || "", was: k.by || "", to: k.to || "" } }, "unblock", `${t.title} · 막힘 풀림`); },
    // 글 고치기(메모 · 지금 상황) — 고치기 시작할 때 본 버전(baseAt) 그대로일 때만 저장. 그사이 다른 사람이 고쳤으면 저장하지 않고 {conflict, cur} (내 글은 화면에 그대로)
    //   force = 그래도 내 글로 덮기 · baseAt 을 안 주면(예전 호출) 확인 없이 저장
    saveText: async (key, item, atPath, fields, baseAt, logO, force) => {
      const at = nowIso(), f = { ...fields, updatedAt: at, updatedBy: cu.id, v2At: at };
      try { const r = force || baseAt === undefined ? (await fb.patch(key, item._doc || item.id, f), { ok: true }) : await fb.patchIf(key, item._doc || item.id, { [atPath]: baseAt || null }, f);
        if (!r.ok) return { conflict: true, cur: r.cur || {} };
        if (logO) log("edit", logO); return { ok: true }; }
      catch (e) { fail("저장")(e); return { error: true }; }
    },
    setMemo: (t, memo, baseAt, force) => A.saveText("tasks", t, "memoAt", { memo, memoBy: cu.id, memoByName: cu.name, memoAt: nowIso() }, baseAt, { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 메모 고침`, prev: String(t.memo || "").slice(0, 2000) }, force),
    setProjNow: (p, text, baseAt, force) => A.saveText("projects", p, "now.at", { now: { text: String(text || "").trim(), by: cu.id, byName: cu.name, at: nowIso() } }, baseAt, { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · 지금 상황 고침`, prev: (p.now && p.now.text) || "" }, force),
    // 파일 하나 올리기 (진행률 onProg 0~1) → 올린 파일 정보 · 실패하면 throw (화면이 파일마다 [다시])
    upload: (target, f, onProg) => fb.upload(target, f, onProg),
    // files = File 또는 이미 올린 정보({url, path}) — 화면이 먼저 올리고(진행률) 여기선 기록만
    addFiles: async (t, files) => { try { const up = []; for (const f of files) up.push(f && f.url && f.path ? f : await fb.upload("task-" + t.id, f));
      await fb.patch("tasks", tdoc(t), { attachments: fb.arrayUnion(...up.map((x) => ({ ...x, by: cu.id, byName: cu.name }))), updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }); log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 파일 ${up.length}개 올림` }); setToast({ text: `파일 ${up.length}개 올렸어요` }); return true; }
      catch (e) { fail("파일")(e); return false; } },
    // 고정업무 체크 — 내 칸만 바꾸고, 체크 기록(누가 몇 시)을 따로 남김
    //   기록 문서는 merge (다시 체크하거나 취소해도 그날 문서의 다른 칸(건수·체크리스트 기록 등)을 지우지 않음)
    fxCheck: (t, on, key, at) => fb.merge("checks", `${t.id}~${cu.id}~${key}`, { kind: "fx", taskId: t.id, itemId: t.id, uid: cu.id, name: cu.name, date: key, ym: key.slice(0, 7), wk: weekStart(key), at, on }),
    fxToggle: (t) => {
      const key = ymd(new Date()), at = nowIso(), on = !fxMeDone(t, cu.id, key);
      fb.patch("tasks", tdoc(t), { ...fxCheckPatch(t, cu.id, on, key, at, cu.name), v2At: at }).catch(fail("체크"));
      A.fxCheck(t, on, key, at).catch(fail("체크 기록"));
      if (on) setToast({ text: `체크했어요 · ${fxLabel(t, cu.id)}`, undo: () => { fb.patch("tasks", tdoc(t), { ...fxCheckPatch(t, cu.id, false, key, at, cu.name), v2At: nowIso() }).catch(fail("되돌리기")); A.fxCheck(t, false, key, at).catch(fail("체크 기록")); } });
      return on;   // 화면: 켰으면 건수 칸 '몇 건이에요?'
    },
    // 체크리스트 칩 하나 (버전1과 같은 규칙: 다 켜면 내 몫 끝냄 · 끝낸 뒤 하나 풀면 내 끝냄만 지움)
    fxSub: (t, subId) => { const key = ymd(new Date()), at = nowIso(), r = fxSubPatch(t, cu.id, subId, key, at, cu.name);
      fb.patch("tasks", tdoc(t), { ...r.patch, v2At: at }).catch(fail("체크"));
      if (r.flip !== null) { A.fxCheck(t, r.flip, key, at).catch(fail("체크 기록")); if (r.flip) setToast({ text: `다 체크했어요 · ${fxLabel(t, cu.id)}` }); }
      return r.flip; },   // true = 마지막 칩으로 내 몫 끝냄 (화면: 건수 칸 묻기)
    // ── 반복 실행·고정업무 나누기 (2단계) ──
    // 브랜드·개인 정하기: picks = [{t, pick}] (pick = D.brands id | 'common' | 'me') · 바뀐 칸만 · 기록에 이전 값 · 5초 되돌리기(내가 쓴 값 그대로인 것만)
    setScopes: async (picks, label) => { const at = nowIso();
      const ops = picks.filter((x) => x && x.t && x.pick).map(({ t, pick }) => { const f = { ...scopeFields(pick), scopeBy: cu.id, scopeAt: at };
        return { key: "tasks", id: tdoc(t), t, pick, fields: f, prev: { scope: t.scope === undefined ? null : t.scope, brand: t.brand === undefined ? null : t.brand, scopeBy: t.scopeBy || null, scopeAt: t.scopeAt || null } }; });
      if (!ops.length) return false;
      const nm = (k) => (k === "me" ? "개인" : brandLabel(k, D.brands));
      try { await fb.patchMany(ops.map((o) => ({ key: o.key, id: o.id, fields: { ...o.fields, updatedAt: at, updatedBy: cu.id, v2At: at } })));
        const lab = label || (ops.length === 1 ? `${ops[0].t.title} · ${nm(ops[0].pick)}` : `브랜드·개인 정하기 · ${ops.length}개`);
        log(ops.length === 1 ? "edit" : "bulk", { col: "tasks", targetId: ops.length === 1 ? ops[0].t.id : "", label: lab, ids: ops.map((o) => o.t.id), prev: ops.length === 1 ? ops[0].prev : ops.map((o) => ({ id: o.t.id, ...o.prev })), ...(ops.length === 1 ? { next: { scope: ops[0].fields.scope, brand: ops[0].fields.brand } } : {}) });
        setToast({ text: ops.length === 1 ? `${nm(ops[0].pick)}(으)로 정했어요 · ${ops[0].t.title}` : `${ops.length}개 정했어요`, undo: () => undoMany(ops.map((o) => ({ key: o.key, id: o.id, wrote: { scope: o.fields.scope, brand: o.fields.brand }, prev: o.prev })), lab) });
        return true; }
      catch (e) { fail("브랜드 정하기")(e); return false; }
    },
    // 주기 정하기 (그로홈에서 온 고정업무 · 확인 전엔 이행률에서 뺌): picks = [{t, rt}] → recurType + cycleOk
    setCycles: async (picks, label) => { const at = nowIso();
      const ops = picks.filter((x) => x && x.t && x.rt).map(({ t, rt }) => { const f = { ...cycleFields(rt), cycleBy: cu.id, cycleAt: at };
        return { key: "tasks", id: tdoc(t), t, rt, fields: f, prev: Object.fromEntries(Object.keys(f).map((k) => [k, t[k] === undefined ? null : t[k]])) }; });
      if (!ops.length) return false;
      try { await fb.patchMany(ops.map((o) => ({ key: o.key, id: o.id, fields: { ...o.fields, updatedAt: at, updatedBy: cu.id, v2At: at } })));
        const lab = label || (ops.length === 1 ? `${ops[0].t.title} · 주기 ${({ daily: "매일", weekly: "매주", monthly: "매월" })[ops[0].rt]}` : `주기 정하기 · ${ops.length}개`);
        log(ops.length === 1 ? "edit" : "bulk", { col: "tasks", targetId: ops.length === 1 ? ops[0].t.id : "", label: lab, ids: ops.map((o) => o.t.id), prev: ops.length === 1 ? ops[0].prev : ops.map((o) => ({ id: o.t.id, ...o.prev })) });
        setToast({ text: ops.length === 1 ? `주기를 정했어요 · ${ops[0].t.title}` : `주기 ${ops.length}개 정했어요`, undo: () => undoMany(ops.map((o) => ({ key: o.key, id: o.id, wrote: { recurType: o.fields.recurType, cycleOk: true }, prev: o.prev })), lab) });
        return true; }
      catch (e) { fail("주기")(e); return false; }
    },
    // 개인 고정업무 새로 만들기 (더보기 › 내 고정업무 [+ 고정업무]) — scope 'me' · 담당 나 · v2 에서 만듦
    addFixed: async (f) => { const id = newId("t"), at = nowIso(), rt = f.recurType || "daily";
      const wd = FX_WD.filter((d) => (f.weekDays || []).includes(d));
      const subs = (f.subs || []).map((x) => String(x || "").trim()).filter(Boolean).map((title, i) => ({ id: newId("s") + i, title }));
      const t = { id, title: String(f.title || "").trim(), isFixed: true, type: "fixed", scope: "me", status: "todo", recurType: rt,
        ...(rt === "weekly" ? { weekDays: wd.length ? wd : ["월"], weekDay: (wd[0] || "월") } : {}),
        ...(rt === "monthly" ? (f.monthEnd ? { monthEnd: true, monthDay: 31 } : { monthEnd: false, monthDay: Math.min(31, Math.max(1, +f.monthDay || 1)) }) : {}),
        fixedTime: f.fixedTime || "", assigneeIds: [cu.id], assigneeId: cu.id, subsBy: subs.length ? { "*": subs } : {}, memo: "", attachments: [], paused: false,
        madeIn: "v2", createdAt: at, createdBy: cu.id, updatedAt: at, updatedBy: cu.id, v2At: at };
      if (!t.title) return null;
      try { await fb.put("tasks", id, t); log("add", { col: "tasks", targetId: id, label: `고정업무 · ${t.title}` }); setToast({ text: `고정업무를 만들었어요 · ${t.title}` }); return id; }
      catch (e) { fail("고정업무")(e); return null; }
    },
    // 체크리스트 고치기: who '*' = 공통(점 경로에 못 써서 transaction 으로 subsBy 통째) · 그 밖 = 내 목록(subsBy.<나> 점 경로)
    //   되돌리기 = 내가 쓴 목록이 아직 그대로일 때만
    setSubs: async (t, who, list, label) => { const at = nowIso(), clean = (list || []).filter((x) => x && String(x.title || "").trim()).map((x) => ({ id: x.id, title: String(x.title).trim() }));
      const prev = ((t.subsBy || {})[who]) || [], lab = label || `${t.title} · 체크리스트${who === "*" ? "(공통)" : "(내 것)"} ${clean.length}개`;
      const write = async (next, expect) => { if (who === "*") return fb.txDoc("tasks", tdoc(t), (cur) => { if (!cur) return {}; const sb = { ...(cur.subsBy || {}) };
          if (expect && !fb.sameVal(sb["*"] || [], expect)) return { ret: false };
          sb["*"] = next; return { write: { subsBy: sb, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }, ret: true }; });
        if (expect) { const r = await fb.patchIf("tasks", tdoc(t), { [`subsBy.${who}`]: expect }, { [`subsBy.${who}`]: next, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }); return r.ok; }
        await fb.patch("tasks", tdoc(t), { [`subsBy.${who}`]: next, updatedAt: at, updatedBy: cu.id, v2At: at }); return true; };
      try { await write(clean); log("edit", { col: "tasks", targetId: t.id, label: lab, prev: { subs: prev.map((x) => x.title).join(", ") }, next: { subs: clean.map((x) => x.title).join(", ") } });
        setToast({ text: "체크리스트를 고쳤어요", undo: async () => { const ok = await write(prev, clean).catch((e) => { fail("되돌리기")(e); return null; }); if (ok === false) setToast({ text: "그사이 다른 사람이 바꿔서 되돌리지 않았어요" }); else if (ok) { log("edit", { col: "tasks", targetId: t.id, label: `되돌림 · ${lab}` }); setToast({ text: "되돌렸어요" }); } } });
        return true; }
      catch (e) { fail("체크리스트")(e); return false; }
    },
    // 내 것만 (보이는 이름 labelBy.<나> · 내 시간 timeBy.<나>) — 비우면 공통 값으로
    setMine: (t, field, value, label) => { const v = String(value || "").trim(), prev = ((t[field] || {})[cu.id]) || "";
      const f = { [`${field}.${cu.id}`]: v || null }; P(t, f, "edit", label || `${t.title} · ${field === "labelBy" ? "보이는 이름" : "내 시간"} ${v || "공통으로"}`, { prev: { [field]: prev } });
      setToast({ text: field === "labelBy" ? "보이는 이름을 바꿨어요" : "내 시간을 바꿨어요", undo: () => undoT(t, f, { [`${field}.${cu.id}`]: prev || null }, `${t.title} · ${field === "labelBy" ? "보이는 이름" : "내 시간"}`) }); },
    addNote: async (itemId, text, parentId, files, ctx, extra) => {
      const id = newId("n"); const up = [];
      try { for (const f of files || []) up.push(f && f.url && f.path ? f : await fb.upload("note-" + itemId, f));
        const mentions = parseMentions(text, D.users).filter((u) => u !== cu.id);   // @이름 → 그 사람 '확인할 것' + (설정·시간 안이면) 문자
        await fb.put("notes", id, { id, itemId, parentId: parentId || null, text: text.trim(), files: up, ...by(), madeIn: "v2", ...(mentions.length ? { mentions } : {}), ...(extra || {}) });
        log("comment", { col: "notes", targetId: ctx && ctx.taskId ? ctx.taskId : itemId, projectId: (ctx && ctx.projectId) || "", label: text.trim().slice(0, 60) });
        if (mentions.length) queueMentionSms(D, cu, mentions, itemId, text).catch((e) => console.error("[v2] 문자 알림 준비 실패:", e));
        return true; }
      catch (e) { fail("댓글")(e); return false; }
    },
    // 댓글 고치기 (사용자 요청 2026-10-07 "댓글 수정은? 파일 다시 첨부하고싶을 수 있잖아") — 쓴 사람·관리자 · 지우지 않음
    //   글·파일 목록을 새로 + 이전 판은 edits[](arrayUnion · 빼낸 파일도 여기 남음 · Storage 파일은 안 지움) · editedAt/editedBy
    //   연 때 본 글·고친 시각 그대로일 때만(transaction) → 아니면 {conflict, cur} · 새로 부른 사람만 알림(mentionedAt.<사람>) · 5초 되돌리기
    //   base = {text, editedAt} (연 때 본 값) · files = 남길 파일 + 새로 올린 파일(이미 올린 정보) · opt.undo = {editedAt: 되돌릴 고친 시각}
    editNote: async (n, text, files, base, opt) => {
      if (!n || !(n.by === cu.id || isMaster(cu))) { setToast({ text: "쓴 사람만 고칠 수 있어요" }); return { error: true }; }
      const at = nowIso(), v = String(text || "").trim() || ((files || []).length ? "(파일)" : ""), fs = (files || []).map((f) => ({ ...f }));
      if (!v) return { error: true };
      const old = new Set([...(n.mentions || []), n.by]), add = parseMentions(v, D.users).filter((u) => u !== cu.id && !old.has(u));
      const undo = opt && opt.undo;
      let r;
      try { r = await fb.txDoc("notes", n._doc || n.id, (c) => {
          if (!c) return { ret: { missing: true } };
          if (!(opt && opt.force) && ((c.text || "") !== (base.text || "") || (c.editedAt || null) !== (base.editedAt || null))) return { ret: { conflict: true, cur: c } };
          if ((c.text || "") === v && fb.sameVal(c.files || [], fs)) return { ret: { same: true } };
          const prev = { text: c.text || "", files: c.files || [], at: c.editedAt || c.at || "", by: c.editedBy || c.by || "", byName: c.editedByName || c.byName || "", ...(undo ? { undone: at } : {}) };
          return { write: { text: v, files: fs, editedAt: undo ? undo.editedAt || null : at, editedBy: undo ? undo.editedBy || null : cu.id, editedByName: undo ? undo.editedByName || null : cu.name, edits: fb.arrayUnion(prev),
            ...(add.length ? { mentions: fb.arrayUnion(...add), ...Object.fromEntries(add.map((u) => ["mentionedAt." + u, at])) } : {}) }, ret: { ok: true, prev } }; }); }
      catch (e) { fail("댓글 고치기")(e); return { error: true }; }
      if (!r || r.missing) { setToast({ text: "이 댓글을 찾지 못했어요" }); return { error: true }; }
      if (r.conflict || r.same) return r;
      log("noteEdit", { col: "notes", targetId: n.id, label: `${undo ? "되돌림 · " : ""}${v.slice(0, 60)}`, prev: { text: r.prev.text.slice(0, 200), files: (r.prev.files || []).length }, next: { text: v.slice(0, 200), files: fs.length } });
      if (add.length) queueMentionSms(D, cu, add, n.itemId, v).catch((e) => console.error("[v2] 문자 알림 준비 실패:", e));
      if (!undo) setToast({ text: "댓글을 고쳤어요", undo: async () => { const b = await A.editNote({ ...n, text: v, files: fs, editedAt: at }, r.prev.text, r.prev.files, { text: v, editedAt: at }, { undo: { editedAt: n.editedAt || null, editedBy: n.editedBy || null, editedByName: n.editedByName || null } });
        if (b && b.conflict) setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); else if (b && b.ok) setToast({ text: "되돌렸어요" }); } });
      return { ok: true }; },
    // 댓글 삭제 (사용자 확정 2026-10-07 '흔적 없이 숨김') — 쓴 사람·관리자만(동작에서도 막음) · removed{at,by,byName} · 지우지 않음(파일도 Storage 그대로)
    //   화면에서 본 글·고친 시각 그대로이고 아직 삭제 안 된 것일 때만(transaction) · 기록 noteRemove(글 내용·프로젝트 없이 → 소식에 흔적 없음) · 5초 되돌리기
    noteRemove: async (n) => { if (!canRemoveNote(n, cu)) { setToast({ text: "쓴 사람이나 관리자만 삭제할 수 있어요" }); return { error: true }; }
      const rm = { at: nowIso(), by: cu.id, byName: cu.name }; let r;
      try { r = await fb.txDoc("notes", n._doc || n.id, (c) => { if (!c) return { ret: { missing: true } };
          if (isRemoved(c) || c.deleted || (c.text || "") !== (n.text || "") || (c.editedAt || null) !== (n.editedAt || null)) return { ret: { conflict: true } };
          return { write: { removed: rm }, ret: { ok: true } }; }); }
      catch (e) { fail("댓글 삭제")(e); return { error: true }; }
      if (!r || r.missing) { setToast({ text: "이 댓글을 찾지 못했어요" }); return { error: true }; }
      if (r.conflict) { setToast({ text: "그사이 다른 사람이 댓글을 바꿨어요 · 지금 댓글을 확인해 주세요" }); return r; }
      setNoteOver(n.id, rm);
      log("noteRemove", { col: "notes", targetId: n.id, itemId: n.itemId || "", label: "댓글 삭제", noteBy: n.by || "" });
      setToast({ text: "댓글을 삭제했어요", undo: () => A.noteRestore({ ...n, removed: rm }, true) });
      return { ok: true }; },
    // 되살리기 = 관리자(휴지통) · 되돌리기 = 지운 사람도 · 서버 removed 가 본 것과 같을 때만
    noteRestore: async (n, undo) => { if (!canRestoreNote(n, cu, undo)) { setToast({ text: "관리자만 되살릴 수 있어요" }); return { error: true }; }
      let r; try { r = await fb.txDoc("notes", n._doc || n.id, (c) => { if (!c) return { ret: { missing: true } };
          if (!isRemoved(c) || c.removed.at !== n.removed.at) return { ret: { conflict: true } };
          return { write: { removed: null }, ret: { ok: true } }; }); }
      catch (e) { fail("댓글 되살리기")(e); return { error: true }; }
      if (!r || r.missing) { setToast({ text: "이 댓글을 찾지 못했어요" }); return { error: true }; }
      if (r.conflict) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return r; }
      setNoteOver(n.id, null);
      log("noteRestore", { col: "notes", targetId: n.id, itemId: n.itemId || "", label: undo ? "댓글 되살림 (되돌리기)" : "댓글 되살림", noteBy: n.by || "" });
      setToast({ text: undo ? "되돌렸어요" : "댓글을 되살렸어요" });
      return { ok: true }; },
    // 새 프로젝트(빈 프로젝트): 카테고리 로드 → 고친 로드는 기본과 다를 때만 road 칸에 (2026-10-07) · 단계마다 첫 업무(phase)
    addProject: async (f) => {
      const id = newId("p"), at = nowIso();
      const p0 = { id, title: f.title.trim(), assigneeId: f.assigneeId || cu.id, collaboratorIds: [], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", dueDate: f.dueDate || "", brand: f.brand || "", group: "기타", ...(f.category ? { category: f.category } : {}), createdAt: at, createdBy: cu.id, madeIn: "v2" };
      const store = f.road && !roadProblem(f.road) ? roadToStore(p0, f.road, D, f.category || "") : null;
      const p = { ...p0, ...(store ? { road: store, roadBy: cu.id, roadAt: at } : {}) };
      try { await fb.put("projects", id, p); } catch (e) { fail("프로젝트")(e); return null; }
      log("add", { col: "projects", targetId: id, projectId: id, label: p.title + (store ? ` · 단계 ${store.map((x) => x.name).join(" → ")}` : "") });
      const road = store || catRoad(f.category || "", D);
      for (const x of (f.stageTasks || []).filter((y) => y && String(y.title || "").trim())) await A.addTask({ title: x.title, projectId: id, assigneeId: cu.id, dueDate: f.dueDate || "", ...(road.some((r) => r.k === x.k) ? { phase: x.k } : {}) });
      for (const tt of (f.tasks || []).filter((x) => x.trim())) await A.addTask({ title: tt, projectId: id, assigneeId: cu.id, dueDate: f.dueDate || "" });
      return p;
    },
    // ── 프로젝트 단계(로드) 고치기 (책임자·관리자 · 2026-10-07) — 단계 이름·순서·더하기·빼기 · 업무는 안 고침(뺀 단계 업무는 '단계 미정'으로 보임)
    //   서버 road 가 화면에서 본 값일 때만 씀 · 기본과 같으면 road null(카테고리 기본을 따라감) · 기록 · 5초 되돌리기
    setRoad: async (p, road) => {
      if (!canEditRoad(p, cu)) { setToast({ text: "책임자·관리자만 단계를 고칠 수 있어요" }); return false; }
      const prob = roadProblem(road); if (prob) { setToast({ text: prob }); return false; }
      const before = roadOf(p, D) || [], store = roadToStore(p, road, D), cur = p.road != null ? p.road : null, at = nowIso(), pid = p._doc || p.id;
      if (JSON.stringify(cur ? cleanRoad(cur) : null) === JSON.stringify(store)) return true;
      const label = `${p.title} · 단계 ${before.map((x) => x.name).join(" → ")} → ${cleanRoad(road).map((x) => x.name).join(" → ")}`;
      try { const r = await fb.patchIf("projects", pid, { road: cur }, { road: store, roadBy: cu.id, roadAt: at, updatedAt: at, updatedBy: cu.id, v2At: at });
        if (!r.ok) { setToast({ text: "그사이 다른 사람이 단계를 바꿨어요 · 지금 단계를 확인해 주세요" }); return false; }
        log("edit", { col: "projects", targetId: p.id, projectId: p.id, label, prev: { road: cur }, next: { road: store } });
        setToast({ text: "단계를 바꿨어요", undo: () => undoMany([{ key: "projects", id: pid, wrote: { road: store }, prev: { road: cur } }], label, "edit") });
        return true; }
      catch (e) { fail("단계")(e); return false; } },
    // 카테고리 바꾸기 + 로드: mode 'switch' = 새 카테고리 로드로(열쇠가 같으면 그대로 · 이름이 같으면 그 단계로 · 나머지 단계 미정) · 'keep' = 지금 단계 그대로(road 칸에 남김)
    //   'auto'(묻지 않는 곳 · 관리자 미분류 칩) = 로드가 같으면 카테고리만 · 단계가 정해진 업무가 있으면 keep · 없으면 switch
    setCategory: async (p, cat, mode = "auto") => {
      const c = cat || "", oldRoad = roadOf(p, D), curCat = p.category || "", curRoad = p.road != null ? p.road : null, pid = p._doc || p.id, at = nowIso();
      const plain = (lab) => A.patchProject(p, { category: c }, `카테고리 → ${catName(c) || "미분류"}${lab || ""}`, curCat);
      if (!oldRoad || isLaunchProj(p) || c === projCat(p)) return plain();
      const newDef = catRoad(c, D), np = { ...p, category: c };
      const byId = new Map(D.tasks.map((t) => [t.id, t])), ts = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed), ph = (t) => phaseOfTask(t, p, D, byId, oldRoad);
      let m = mode; if (m === "auto") m = sameRoad(oldRoad, newDef) ? "plain" : ts.some((t) => ph(t)) ? "keep" : "switch";
      if (m === "plain" && !roadOwn(p)) return plain();
      const store = roadToStore(np, m === "keep" || m === "plain" ? oldRoad : newDef, D, c);
      const plan = m === "switch" ? roadSwitchPlan(oldRoad, newDef, ts.filter((t) => !t.parentId || !byId.has(t.parentId) || byId.get(t.parentId).projectId !== p.id), ph) : { keep: [], move: [], loose: [] };
      if (plan.move.length > 400) { setToast({ text: "한 번에 400개까지예요" }); return false; }
      const label = `${p.title} · 카테고리 → ${catName(c) || "미분류"} · ${m === "switch" ? `단계 ${newDef.map((x) => x.name).join(" → ")}${plan.move.length ? ` (${plan.move.length}개 옮김)` : ""}${plan.loose.length ? ` · 단계 미정 ${plan.loose.length}` : ""}` : "단계 그대로"}`;
      const pf = { category: c, road: store, roadBy: cu.id, roadAt: at, updatedAt: at, updatedBy: cu.id, v2At: at };
      try { const r = await fb.txDocs([{ key: "projects", id: pid }, ...plan.move.map((x) => ({ key: "tasks", id: tdoc(x.t) }))], (curs) => {
          if (!curs[0] || (curs[0].category || "") !== curCat || !fb.sameVal(curs[0].road != null ? curs[0].road : null, curRoad)) return { ret: { conflict: true } };
          const mv = plan.move.map((x, i) => (curs[i + 1] && (curs[i + 1].phase != null ? curs[i + 1].phase : null) === (x.t.phase != null ? x.t.phase : null) ? x : null));
          return { writes: [pf, ...mv.map((x) => (x ? { phase: x.to, phaseBy: cu.id, phaseAt: at, updatedAt: at, updatedBy: cu.id, v2At: at } : null))], ret: { ok: true, moved: mv.filter(Boolean) } }; });
        if (!r || r.conflict) { setToast({ text: "그사이 다른 사람이 카테고리·단계를 바꿨어요 · 지금 값을 확인해 주세요" }); return false; }
        log("edit", { col: "projects", targetId: p.id, projectId: p.id, label, prev: { category: curCat, road: curRoad, tasks: r.moved.map((x) => ({ id: x.t.id, phase: x.t.phase != null ? x.t.phase : null })) }, next: { category: c, road: store }, ids: r.moved.map((x) => x.t.id) });
        setToast({ text: `카테고리를 바꿨어요${m === "switch" ? ` · 단계도 ${catName(c) || "미분류"} 단계로` : " · 단계는 그대로"}`, undo: () => undoMany([{ key: "projects", id: pid, wrote: { category: c, road: store }, prev: { category: curCat, road: curRoad } },
          ...r.moved.map((x) => ({ key: "tasks", id: tdoc(x.t), wrote: { phase: x.to }, prev: { phase: x.t.phase != null ? x.t.phase : null } }))], label, "edit") });
        return true; }
      catch (e) { fail("카테고리")(e); return false; } },
    // 단계 정리 [추천대로 넣기] · 여러 업무 단계 한 번에 — 업무마다 서버 단계가 본 값일 때만(그사이 바뀐 업무는 건너뜀) · 기록 1건 · 5초 되돌리기
    setPhases: async (p, picks) => {
      const road = roadOf(p, D); if (!road) return null;
      const ok = (picks || []).filter((x) => x && x.t && x.k && road.some((r) => r.k === x.k) && canSetPhase(x.t, p, cu)).slice(0, 300);
      if (!ok.length) { setToast({ text: "넣을 업무가 없어요" }); return null; }
      const at = nowIso(), cur = (t) => (t.phase != null ? t.phase : null);
      try { const r = await fb.patchManyIf(ok.map((x) => ({ key: "tasks", id: tdoc(x.t), expect: { phase: cur(x.t) }, fields: { phase: x.k, phaseBy: cu.id, phaseAt: at, updatedAt: at, updatedBy: cu.id, v2At: at } })));
        const done = ok.filter((x) => !r.skipped.includes(tdoc(x.t))); if (!done.length) { setToast({ text: "그사이 다른 사람이 단계를 바꿔서 그대로 뒀어요" }); return r; }
        const cnt = road.map((s) => [s.name, done.filter((x) => x.k === s.k).length]).filter(([, n]) => n).map(([nm, n]) => `${nm} ${n}`).join(" · ");
        const label = `${p.title} · 단계 정리 ${done.length}개 (${cnt})`;
        log("edit", { col: "tasks", targetId: done.length === 1 ? done[0].t.id : "", projectId: p.id, label, ids: done.map((x) => x.t.id), prev: { tasks: done.map((x) => ({ id: x.t.id, phase: cur(x.t) })) } });
        setToast({ text: `단계에 넣었어요 · ${done.length}개${r.skipped.length ? ` · ${r.skipped.length}개는 그사이 바뀌어서 그대로` : ""}`, undo: () => undoMany(done.map((x) => ({ key: "tasks", id: tdoc(x.t), wrote: { phase: x.k }, prev: { phase: cur(x.t) } })), label, "edit") });
        return r; }
      catch (e) { fail("단계")(e); return null; } },
    // 관리자 설정 › 카테고리 기본 로드 (settings/roads · 관리자만 · 신제품 출시는 못 바꿈) — 연 때 본 값 그대로일 때만(transaction) · 기록 · 5초 되돌리기
    //   road 칸 없는 프로젝트는 바로 따라감 · 업무는 안 고침 · 기본과 같으면 null(앱 안 기본)
    setCatRoad: async (cat, road, seen, viaUndo) => {
      if (!isMaster(cu)) { setToast({ text: "관리자만 바꿀 수 있어요" }); return false; }
      if (!cat || cat === "launch") { setToast({ text: "신제품 출시 단계는 신제품 대시보드 단계 그대로예요" }); return false; }
      const prob = roadProblem(road); if (prob) { setToast({ text: prob }); return false; }
      const clean = cleanRoad(road), store = sameRoad(clean, builtinRoad(cat)) ? null : clean, was = seen != null ? cleanRoad(seen) : null, at = nowIso();
      const entry = { at, by: cu.id, byName: cu.name, cat, prev: was, next: store };
      try { const r = await fb.txDoc("settings", "roads", (cur) => { const now = cur && cur.roads && cur.roads[cat] != null ? cur.roads[cat] : null;
          if (!fb.sameVal(now, was)) return { ret: { conflict: true } };
          return { write: cur ? { [`roads.${cat}`]: store, updatedAt: at, updatedBy: cu.id, updatedByName: cu.name, hist: fb.arrayUnion(entry) } : { roads: { [cat]: store }, updatedAt: at, updatedBy: cu.id, updatedByName: cu.name, hist: [entry] }, ret: { ok: true } }; });
        if (!r || r.conflict) { setToast({ text: "그사이 다른 관리자가 이 단계를 바꿨어요 · 지금 단계를 확인해 주세요" }); return false; }
        const label = `프로젝트 단계 · ${catName(cat) || "미분류"} · ${(was || builtinRoad(cat)).map((x) => x.name).join(" → ")} → ${clean.map((x) => x.name).join(" → ")}${viaUndo ? " (되돌리기)" : ""}`;
        log("edit", { col: "settings", targetId: "roads", label, prev: { cat, road: was }, next: { cat, road: store } });
        setToast({ text: viaUndo ? "되돌렸어요" : "기본 단계를 바꿨어요 · 단계를 따로 고치지 않은 프로젝트에 바로 보여요", ...(viaUndo ? {} : { undo: () => A.setCatRoad(cat, was || builtinRoad(cat), store, true) }) });
        return true; }
      catch (e) { fail("기본 단계")(e); return false; } },
    // 반복(행동지표) +d → v2 실적 pour-os/v2/kpiact/{분기} (transaction · 여러 사람이 같이 눌러도 안 덮임 · 버전1 실적은 읽기만) · extra {task: 같이 센 신제품 업무, fail: 실패 건, wk: 그 주(되돌리기는 처음 누른 주로)}
    //   → {n, wk} · 실패하면 null (알림)
    //   3단계: 분기 실적 + 그날 기록(checks ak~항목~나~날짜 runs) 을 한 transaction 으로 (실패 건은 그날 기록 없이) · extra.date = 그날(취소는 처음 누른 날로) · extra.via 'btn'
    akPlus: async (it, d = 1, extra) => { const at = nowIso(), date = (extra && extra.date) || ymd(new Date()), wk = (extra && extra.wk) || akWeekKey(new Date(date + "T00:00:00")), fail0 = !!(extra && extra.fail);
      const docs = [{ key: "kpiact", id: akQidOfWeek(wk) }, ...(fail0 ? [] : [{ key: "checks", id: dayIdAk(it.id, cu.id, date) }])];
      try { const n = await fb.txDocs(docs, ([q, day]) => { const a = akWrite(q, it, wk, d, cu, at, { via: "btn", ...(extra || {}), date, union: fb.arrayUnion });
          return { writes: [a.write, ...(fail0 ? [] : [dayAdd(day, dayBase("ak", it, cu, date), { runs: d, via: (extra && extra.via) || "btn" }, cu, at)])], ret: a.ret }; });
        return { n, wk, date }; }
      catch (e) { fail("반복 기록")(e); return null; } },
    // 반복 실행 그날 건수 (오늘 화면 '몇 건?' · 시트 [+ 더하기]·[고치기]) — mode 'add' 더하기 · 'set' 고치기(이전 값 기록)
    //   결정 3: 목표 단위가 건·명·개면 같은 transaction 으로 목표 실적에도 더함 (incl = 방금 [+1] 한 1건이 이 숫자에 들어 있음 → 그만큼 빼고 더함) · 회면 기록만
    akQty: async (it, n, mode = "add", extra) => { const at = nowIso(), date = (extra && extra.date) || ymd(new Date()), wk = akWeekKey(new Date(date + "T00:00:00")), toGoal = qtyToGoal(it);
      const docs = [{ key: "checks", id: dayIdAk(it.id, cu.id, date) }, ...(toGoal ? [{ key: "kpiact", id: akQidOfWeek(wk) }] : [])];
      try { return await fb.txDocs(docs, ([day, q]) => { const base = dayBase("ak", it, cu, date);
          let w, delta; if (mode === "set") { const f = dayFix(day, base, n, cu, at); w = f.write; delta = f.delta; } else { w = dayAdd(day, base, { qty: n, via: "qty" }, cu, at); delta = n - (extra && extra.incl ? 1 : 0); }
          const qw = toGoal && delta ? akWrite(q, it, wk, delta, cu, at, { via: "qty", qty: n, date, union: fb.arrayUnion }).write : null;
          return { writes: [w, qw], ret: { qty: w.qty, delta: toGoal ? delta : 0 } }; }); }
      catch (e) { fail("건수")(e); return null; } },
    // 횟수 목표 체크리스트 칩 (한 바퀴 = 1회) — 진행 중 문서(akopen) 하나 + 다 켜졌으면 분기 실적 +1 · 그날 기록 runs +1 을 한 transaction 으로 (두 번 세지 않음)
    akSub: async (it, subId) => { const at = nowIso(), date = ymd(new Date()), wk = akWeekKey(new Date(date + "T00:00:00")), list = akSubsOf(it, cu.id);
      try { return await fb.txDocs([{ key: "checks", id: openIdAk(it.id, cu.id) }, { key: "kpiact", id: akQidOfWeek(wk) }, { key: "checks", id: dayIdAk(it.id, cu.id, date) }], ([op, q, day]) => {
          const r = roundTap(op, list, subId, at), ow = op ? { subs: r.subs, since: r.since, at } : { kind: "akopen", akId: it.id, itemId: it.id, uid: cu.id, name: cu.name, subs: r.subs, since: r.since, at };
          if (!r.complete) return { writes: [ow, null, null], ret: { complete: false } };
          const a = akWrite(q, it, wk, 1, cu, at, { via: "list", date, union: fb.arrayUnion });
          return { writes: [ow, a.write, dayAdd(day, dayBase("ak", it, cu, date), { runs: 1, via: "list" }, cu, at)], ret: { complete: true, n: a.ret, wk, date } }; }); }
      catch (e) { fail("체크리스트")(e); return null; } },
    // 고정업무·정한 날 체크 그날 건수 — 더하기 = merge + increment(여러 기기 동시에 눌러도 안 빠짐 · 체크·취소해도 그대로) · 고치기 = transaction(이전 값 기록)
    fxQty: async (t, n, mode = "add", date0) => { const at = nowIso(), date = date0 || ymd(new Date()), id = dayIdFx(t.id, cu.id, date), base = dayBase("fx", t, cu, date);
      try { if (mode === "set") return await fb.txDoc("checks", id, (cur) => { const f = dayFix(cur, base, n, cu, at), w = { ...f.write, qtyAt: at }; delete w.at; return { write: w, ret: { qty: n } }; });
        await fb.merge("checks", id, { ...base, qty: fb.increment(n), qtyAt: at, recs: fb.arrayUnion({ at, by: cu.id, byName: cu.name, d: n }) }); return { qty: n }; }
      catch (e) { fail("건수")(e); return null; } },
    // ── 반복 실행(횟수 목표) 덧칠 (kpidefs/{akId} coll 'actionKPIs') ──
    // 칸 고치기 (체크리스트 subs · 건수 칸 qty · 브랜드 · 담당 who · 멈춤 paused) — 바꾼 칸만 · hist 에 이전 값 · 5초 되돌리기(같은 방법으로 이전 값)
    akSet: async (it, next, label, noUndo) => { const at = nowIso(), base = ((D.ak && D.ak.raw) || []).find((x) => x.id === it.id) || null;
      const prev = Object.fromEntries(Object.keys(next).map((k) => [k, it[k] === undefined ? null : it[k]]));
      try { const r = await fb.txDoc("kpidefs", it.id, (c) => { const w = kpiEditWrite(c, "actionKPIs", it.id, next, undefined, cu, at, base); return w ? { write: w, ret: 1 } : {}; });
        if (!r) { setToast({ text: "바뀐 것이 없어요" }); return false; }
        log("edit", { col: "kpidefs", targetId: it.id, label: `${it.name} · ${label || Object.keys(next).join("·")}`, prev, next });
        if (!noUndo) setToast({ text: `${label || "설정"}을 바꿨어요`, undo: () => A.akSet(it, prev, `${label || "설정"} 되돌림`, true) });
        return true; }
      catch (e) { fail("반복 실행")(e); return false; } },
    // 하는 법·메모 (덧칠 desc) — 고치기 시작할 때 본 descAt 그대로일 때만 (그사이 다른 사람이 고쳤으면 {conflict, cur:{memo, memoByName, memoAt}})
    akDesc: async (it, text, baseAt, force) => { const at = nowIso(), base = ((D.ak && D.ak.raw) || []).find((x) => x.id === it.id) || null;
      try { const r = await fb.txDoc("kpidefs", it.id, (c) => { const f = (c && c.fields) || {};
          if (!force && baseAt !== undefined && (f.descAt || null) !== (baseAt || null)) return { ret: { conflict: true, cur: { memo: f.desc != null ? f.desc : (base && base.desc) || "", memoByName: f.descByName || "", memoAt: f.descAt || null } } };
          const w = kpiEditWrite(c, "actionKPIs", it.id, { desc: String(text || ""), descAt: at, descBy: cu.id, descByName: cu.name }, undefined, cu, at, base); return w ? { write: w, ret: { ok: true } } : { ret: { ok: true } }; });
        if (r && r.ok) log("edit", { col: "kpidefs", targetId: it.id, label: `${it.name} · 하는 법 고침`, prev: String(it.desc || "").slice(0, 2000) });
        return r; }
      catch (e) { fail("메모")(e); return { error: true }; } },
    // 자료 올리기 → Storage task-attachments/v2/ak-<akId>/ · 덧칠 문서 맨 위 files[] (arrayUnion · hist 에 안 쌓음)
    akFiles: async (it, files) => { try { const up = []; for (const f of files) up.push({ ...(f && f.url && f.path ? f : await fb.upload("ak-" + it.id, f)), by: cu.id, byName: cu.name });
        await fb.txDoc("kpidefs", it.id, (c) => ({ write: c ? { files: fb.arrayUnion(...up) } : { coll: "actionKPIs", fields: {}, hidden: false, hist: [], created: false, files: up, at: nowIso(), by: cu.id, byName: cu.name } }));
        log("edit", { col: "kpidefs", targetId: it.id, label: `${it.name} · 파일 ${up.length}개 올림` }); setToast({ text: `파일 ${up.length}개 올렸어요` }); return true; }
      catch (e) { fail("파일")(e); return false; } },
    // [+ 반복 실행] 횟수 목표 새로 (관리자) — id v2k_act_… · 덧칠 created (버전1 문서는 그대로)
    akCreate: async (f) => { const id = newKpiId("actionKPIs"), at = nowIso(), wk = akWeekKey(new Date());
      const subs = (f.subs || []).map((x) => String(x || "").trim()).filter(Boolean).map((title, i) => ({ id: newId("s") + i, title }));
      const who = (f.who || []).filter(Boolean), fields = { name: String(f.name || "").trim(), cyc: f.cyc || "M", goal: Math.max(1, +f.goal || 1), unit: f.unit || "회", who, whoNames: who.map((u) => nameOf(D.users, u)).filter(Boolean),
        brand: f.brand || "", fun: f.fun || "기타", active: true, core: false, how: "직접", startDate: wk, order: 900, mk: "", sk: "", ...(subs.length ? { subs } : {}), ...(f.qty && f.qty.unit ? { qty: f.qty } : {}), madeIn: "v2", createdAt: at, createdBy: cu.id };
      if (!fields.name || !fields.brand) return null;
      try { await fb.txDoc("kpidefs", id, (c) => (c ? {} : { write: kpiEditWrite(null, "actionKPIs", id, fields, undefined, cu, at, null) }));
        log("add", { col: "kpidefs", targetId: id, label: `반복 실행 · ${fields.name}` }); setToast({ text: `반복 실행을 만들었어요 · ${fields.name}` }); return id; }
      catch (e) { fail("반복 실행")(e); return null; } },
    // [+ 반복 실행] 정한 날 체크 새로 (관리자) — v2 고정업무 문서 scope 'brand'
    addRoutineFixed: async (f) => { const id = newId("t"), at = nowIso(), rt = f.recurType || "daily", wd = FX_WD.filter((d) => (f.weekDays || []).includes(d)), who = (f.who || []).filter(Boolean);
      const subs = (f.subs || []).map((x) => String(x || "").trim()).filter(Boolean).map((title, i) => ({ id: newId("s") + i, title }));
      const t = { id, title: String(f.title || "").trim(), isFixed: true, type: "fixed", scope: "brand", brand: f.brand || "", scopeBy: cu.id, scopeAt: at, status: "todo", recurType: rt,
        ...(rt === "weekly" ? { weekDays: wd.length ? wd : ["월"], weekDay: wd[0] || "월" } : {}),
        ...(rt === "monthly" ? (f.monthEnd ? { monthEnd: true, monthDay: 31 } : { monthEnd: false, monthDay: Math.min(31, Math.max(1, +f.monthDay || 1)) }) : {}),
        fixedTime: f.fixedTime || "", assigneeIds: who, assigneeId: who[0] || "", subsBy: subs.length ? { "*": subs } : {}, ...(f.qty && f.qty.unit ? { qty: f.qty } : {}), memo: "", attachments: [], paused: false,
        madeIn: "v2", createdAt: at, createdBy: cu.id, updatedAt: at, updatedBy: cu.id, v2At: at };
      if (!t.title || !t.brand) return null;
      try { await fb.put("tasks", id, t); log("add", { col: "tasks", targetId: id, label: `반복 실행 · ${t.title}` }); setToast({ text: `반복 실행을 만들었어요 · ${t.title}` }); return id; }
      catch (e) { fail("반복 실행")(e); return null; } },
    // 고정업무 건수 칸 (t.qty {label, unit} | null) — 5초 되돌리기
    setQtyCfg: (t, q) => { const f = { qty: q && q.unit ? { label: String(q.label || "").trim() || "건수", unit: q.unit } : null }, prev = { qty: t.qty || null };
      P(t, f, "edit", `${t.title} · 건수 칸 ${f.qty ? `${f.qty.label}(${f.qty.unit})` : "끔"}`, { prev });
      setToast({ text: f.qty ? "건수 칸을 켰어요" : "건수 칸을 껐어요", undo: () => undoT(t, f, prev, `${t.title} · 건수 칸`) }); },
    // ── 이름 고치기 (사용자 요청 2026-10-07) — 연 때 본 이름(base) 그대로일 때만(transaction) · 그사이 바뀌었으면 {conflict, cur} · 기록 prev · 5초 되돌리기
    renameFx: async (t, title, base, noUndo) => { const v = String(title || "").trim(); if (!v) return { error: true }; if (!canRenameFx(t, cu)) { setToast({ text: "이름을 고칠 수 있는 사람이 아니에요" }); return { error: true }; }
      try { const r = await fb.txDoc("tasks", tdoc(t), (c) => { if (!c) return { ret: { error: true } }; if ((c.title || "") !== (base || "")) return { ret: { conflict: true, cur: c.title || "", by: c.updatedBy || "" } };
          if (c.title === v) return { ret: { ok: true, same: true } }; const at = nowIso(); return { write: { title: v, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: { ok: true } }; });
        if (r && r.ok && !r.same) { log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `이름 고침 · ${base} → ${v}`, prev: { title: base }, next: { title: v } });
          if (!noUndo) setToast({ text: "이름을 고쳤어요", undo: async () => { const b = await A.renameFx(t, base, v, true); if (b && b.conflict) setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); else if (b && b.ok) setToast({ text: "되돌렸어요" }); } }); }
        return r; }
      catch (e) { fail("이름")(e); return { error: true }; } },
    // 한 번짜리 업무 이름 고치기 — renameFx 와 같은 모양: 서버 이름이 화면에서 본 이름(base)일 때만 · 기록 '이름 A → B' · 5초 되돌리기
    renameTask: async (t, title, base, noUndo) => { const v = String(title || "").trim(); if (!v || v === String(base || "").trim()) return { error: true };
      if (!noUndo && !canRenameTask(t, cu, D)) { setToast({ text: "이름을 고칠 수 있는 사람이 아니에요" }); return { error: true }; }
      try { const r = await fb.txDoc("tasks", tdoc(t), (c) => { if (!c || c.isFixed || c.launchItem || isRemoved(c)) return { ret: { error: true } }; if ((c.title || "") !== (base || "")) return { ret: { conflict: true, cur: c.title || "" } };
          const at = nowIso(); return { write: { title: v, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: { ok: true } }; });
        if (r && r.conflict && !noUndo) setToast({ text: "그사이 다른 사람이 바꿨어요 · 지금 이름을 확인해 주세요" });
        if (r && r.ok) { log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `이름 ${base} → ${v}`, prev: { title: base }, next: { title: v } });
          if (!noUndo) setToast({ text: "이름을 고쳤어요", undo: async () => { const b = await A.renameTask(t, base, v, true); if (b && b.conflict) setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); else if (b && b.ok) setToast({ text: "되돌렸어요" }); } }); }
        return r; }
      catch (e) { fail("이름")(e); return { error: true }; } },
    // 횟수 목표 이름 = 덧칠 fields.name (버전1 문서 그대로 · 관리자) — 지금 보이는 이름(덧칠 → 버전1)이 base 와 같을 때만
    akRename: async (it, name, base, noUndo) => { const v = String(name || "").trim(); if (!v) return { error: true }; if (!isMaster(cu)) return { error: true };
      const at = nowIso(), b0 = ((D.ak && D.ak.raw) || []).find((x) => x.id === it.id) || null;
      try { const r = await fb.txDoc("kpidefs", it.id, (c) => { const now = ((c && c.fields) || {}).name ?? (b0 && b0.name) ?? "";
          if (now !== (base || "")) return { ret: { conflict: true, cur: now } }; const w = kpiEditWrite(c, "actionKPIs", it.id, { name: v }, undefined, cu, at, b0); return w ? { write: w, ret: { ok: true } } : { ret: { ok: true, same: true } }; });
        if (r && r.ok && !r.same) { log("edit", { col: "kpidefs", targetId: it.id, label: `이름 고침 · ${base} → ${v}`, prev: { name: base }, next: { name: v } });
          if (!noUndo) setToast({ text: "이름을 고쳤어요", undo: async () => { const b = await A.akRename(it, base, v, true); if (b && b.conflict) setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); else if (b && b.ok) setToast({ text: "되돌렸어요" }); } }); }
        return r; }
      catch (e) { fail("이름")(e); return { error: true }; } },
    // ── 없애기 · 휴지통 (사용자 확정 2026-10-07 · 목록에서 빼기 + 휴지통 · 지우지 않음) ──
    // 고정업무·정한 날 체크: removed{at,by,byName,prevPaused,scope} + paused true — 서버에 아직 안 없앤 것일 때만(transaction) · 5초 되돌리기 · 기록에 이전 값
    //   권한: 개인(me) = 본인·관리자 · 반복 실행(브랜드)·미정 = 관리자 (화면에서도 같은 규칙 model.canRemoveFx)
    fxRemove: async (t) => { if (!canRemoveFx(t, cu)) { setToast({ text: "없앨 수 있는 사람이 아니에요" }); return false; }
      const at = nowIso(), f = fxRemoveFields(t, cu, at), prev = { removed: null, paused: t.paused === undefined ? null : !!t.paused };
      try { const r = await fb.patchIf("tasks", tdoc(t), { removed: null }, { ...f, updatedAt: at, updatedBy: cu.id, v2At: at });
        if (!r.ok) { setToast({ text: "이미 없앤 것이에요" }); return false; }
        log("remove", { col: "tasks", targetId: t.id, label: `${t.title} · 없앰 (휴지통 · 지난 체크·건수·메모·파일은 그대로)`, prev, next: { removed: f.removed, paused: true } });
        setToast({ text: `없앴어요 · ${t.title}`, undo: () => A.fxRestore({ ...t, removed: f.removed, paused: true }, true) });
        return true; }
      catch (e) { fail("없애기")(e); return false; } },
    // 되살리기 = 없앨 때 그대로(멈춤 이전 값) · 서버의 removed 가 내가 본 것과 같을 때만
    fxRestore: async (t, viaUndo) => { const rm = t && t.removed; if (!rm || !canRemoveFx(t, cu)) return false;
      const at = nowIso(), f = fxRestoreFields(t);
      try { const r = await fb.patchIf("tasks", tdoc(t), { removed: rm }, { ...f, updatedAt: at, updatedBy: cu.id, v2At: at });
        if (!r.ok) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
        log("restore", { col: "tasks", targetId: t.id, label: `${t.title} · 되살림${viaUndo ? " (되돌리기)" : ""}`, prev: { removed: rm, paused: true }, next: f });
        setToast({ text: viaUndo ? "되돌렸어요" : `되살렸어요 · ${t.title}` });
        return true; }
      catch (e) { fail("되살리기")(e); return false; } },
    // ── 한 번짜리 업무 없애기 (사용자 확정 2026-10-07 "업무 삭제는 어떻게해?" → 누구나 없애기 · 지우지 않음) ──
    //   볼 수 있는 사람 누구나(기밀로 잠긴 사람은 못 봄) · removed{at,by,byName,reason,prevStatus,root,kids} · 상태는 그대로 · 하위 업무(결정 업무의 안 포함)는 같이
    //   한 transaction: 처음 업무가 서버에 아직 안 없앤 것일 때만 · 하위 업무도 아직 안 없앤 것만 · 기록 1건(prev) · 5초 되돌리기 · 진척 다시 계산
    // 신제품 단계 바꾸기(사용자 확정 2026-10-07 '둘 다 넣기'): 직접 넣은 업무만(신제품 항목 launchItem 은 신제품 대시보드 단계 그대로) · 서버 단계가 화면에서 본 값일 때만 씀
    //   k = LAUNCH_PHASES 키 · '' = 기타(단계 없음) · 기록 1건 '단계 기타 → 채널 등록' · 5초 되돌리기 · 신제품 대시보드엔 안 씀(lbpush 는 launchItem·그 하위 줄만 봄)
    //   로드(2026-10-07): 모든 로드 있는 프로젝트(신제품·일반·흐름) · k = 그 로드 열쇠 · '' = 단계 미정(신제품은 '기타') · 책임자·관리자·담당만(canSetPhase)
    setPhase: async (t, k) => { if (t.launchItem) { setToast({ text: "신제품 대시보드 항목은 대시보드 단계를 따라요" }); return false; }
      const p = (D.projects || []).find((x) => x.id === t.projectId), road = roadOf(p, D);
      if (!road) { setToast({ text: "단계가 없는 프로젝트예요" }); return false; }
      if (!canSetPhase(t, p, cu)) { setToast({ text: "책임자·관리자·담당만 단계를 바꿀 수 있어요" }); return false; }
      if (k && !road.some((x) => x.k === k)) { setToast({ text: "이 프로젝트에 없는 단계예요" }); return false; }
      const curK = phaseOfTask(t, p, D, null, road); if (curK === (k || "")) return true;
      const cur = t.phase != null ? t.phase : null, next = k || (isFlowProj(p) && Number.isInteger(t.wfStage) ? "" : null);   // 흐름 업무를 일부러 단계 미정으로 = "" (wfStage 로 안 돌아가게)
      const nm = (x) => stageName(road, x) || noStageL(p), at = nowIso(), label = `${t.title} · 단계 ${nm(curK)} → ${nm(k || "")}`;
      try { const r = await fb.patchIf("tasks", tdoc(t), { phase: cur }, { phase: next, phaseBy: cu.id, phaseAt: at, updatedAt: at, updatedBy: cu.id, v2At: at });
        if (!r.ok) { setToast({ text: "그사이 다른 사람이 단계를 바꿨어요 · 지금 단계를 확인해 주세요" }); return false; }
        log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label, prev: { phase: cur }, next: { phase: next } });
        setToast({ text: k || isLaunchProj(p) ? `'${nm(k || "")}' 단계로 옮겼어요` : `'${noStageL(p)}'으로 옮겼어요`, undo: () => undoT(t, { phase: next }, { phase: cur }, label) });
        return true; }
      catch (e) { fail("단계")(e); return false; } },
    // ── 예상 소요일 (사용자 확정 2026-10-07 ①) — 기한·앞 일을 정할 수 있는 사람(model.canSetEst) · 서버 값이 화면에서 본 값일 때만 · 기록 '예상 소요 a → b일' · 5초 되돌리기
    //   n = 1~365 평일 수 · null = 비움(미정) · 다시 가져오기가 덮지 않음(V2_TASK_ONLY estDays·estBy·estAt)
    setEst: async (t, n) => {
      const p = (D.projects || []).find((x) => x.id === t.projectId);
      if (!canSetEst(t, p, cu)) { setToast({ text: "담당·맡긴 사람·책임자·관리자만 정할 수 있어요" }); return false; }
      const v = n == null ? null : n; if (v != null && !(Number.isInteger(v) && v >= 1 && v <= EST_MAX)) { setToast({ text: `1~${EST_MAX} 사이 평일 수로 넣어 주세요` }); return false; }
      const cur = t.estDays == null ? null : t.estDays; if (cur === v) return true;
      const at = nowIso(), L = (x) => (x ? `${x}일` : "미정"), label = `${t.title} · 예상 소요 ${L(cur)} → ${L(v)}`;
      try { const r = await fb.patchIf("tasks", tdoc(t), { estDays: cur }, { estDays: v, estBy: cu.id, estAt: at, updatedAt: at, updatedBy: cu.id, v2At: at });
        if (!r.ok) { setToast({ text: "그사이 다른 사람이 예상 소요일을 바꿨어요 · 지금 값을 확인해 주세요" }); return false; }
        log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label, prev: { estDays: cur }, next: { estDays: v } });
        setToast({ text: v ? `예상 소요 ${v}일로 정했어요` : "예상 소요일을 비웠어요 (미정)", undo: () => undoT(t, { estDays: v }, { estDays: cur }, label) });
        return true; }
      catch (e) { fail("예상 소요")(e); return false; } },
    // ── 견본(템플릿 · 사용자 확정 2026-10-07 ②) — pour-os/v2/templates/{id} 문서 하나 · 고치기·없애기 = 만든 사람·관리자(tpl.canEditTpl) · 저장 = 책임자·관리자
    //   모두 조건부(transaction · 서버 지금 값이 화면에서 본 값일 때만) · 기록(col templates) · 5초 되돌리기 · 지우는 길 없음(업무 빼기 = out 표시 · 견본 없애기 = removed 휴지통)
    tplSave: async (p, doc) => {
      if (!canSaveTpl(p, cu)) { setToast({ text: "책임자·관리자만 견본으로 저장할 수 있어요" }); return null; }
      if (!doc || !(doc.tasks || []).length) { setToast({ text: "견본에 넣을 업무가 없어요" }); return null; }
      const id = newId("tp"), at = nowIso(), d = { ...doc, id, createdBy: cu.id, createdByName: cu.name || "", createdAt: at, updatedAt: at, updatedBy: cu.id, v2At: at, removed: null };
      let r; try { r = await fb.txDoc("templates", id, (c) => (c ? { ret: false } : { write: d, ret: true })); } catch (e) { fail("견본")(e); return null; }
      if (!r) { setToast({ text: "같은 번호가 있어서 저장하지 않았어요 · 다시 눌러 주세요" }); return null; }
      log("add", { col: "templates", targetId: id, label: `견본 저장 · ${d.title} · 업무 ${d.tasks.length}개 (${p.title}에서 · 원래 프로젝트는 그대로)`, srcProjectId: p.id });
      setToast({ text: `견본으로 저장했어요 · 업무 ${d.tasks.length}개 · 견본함에서 모두 볼 수 있어요`, undo: () => A.tplRemove(d, { undo: true }) });
      return d; },
    tplRename: async (tpl, name, base, noUndo) => { const v = String(name || "").trim().slice(0, TPL_NAME_MAX); if (!v || v === String(base || "").trim()) return { error: true };
      if (!canEditTpl(tpl, cu)) { setToast({ text: "만든 사람·관리자만 고칠 수 있어요" }); return { error: true }; }
      try { const r = await fb.txDoc("templates", tpl.id, (c) => { if (!c || isRemoved(c)) return { ret: { error: true } }; if ((c.title || "") !== (base || "")) return { ret: { conflict: true, cur: c.title || "" } };
          const at = nowIso(); return { write: { title: v, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: { ok: true } }; });
        if (r && r.conflict) setToast({ text: `그사이 다른 사람이 이름을 바꿨어요 · 지금 이름: ${r.cur}` });
        if (r && r.ok) { log("edit", { col: "templates", targetId: tpl.id, label: `견본 이름 ${base} → ${v}`, prev: { title: base }, next: { title: v } });
          if (!noUndo) setToast({ text: "견본 이름을 고쳤어요", undo: async () => { const b = await A.tplRename(tpl, base, v, true); if (b && b.ok) setToast({ text: "되돌렸어요" }); } }); }
        return r; }
      catch (e) { fail("견본 이름")(e); return { error: true }; } },
    // 견본 안 업무 하나 고치기 — f = {title?, estDays?} · base = 화면에서 본 값 (그 칸이 서버에서 그대로일 때만)
    tplItem: async (tpl, key, f0, base, noUndo) => {
      if (!canEditTpl(tpl, cu)) { setToast({ text: "만든 사람·관리자만 고칠 수 있어요" }); return { error: true }; }
      const f = {}; if (f0.title !== undefined) { const v = String(f0.title || "").trim().slice(0, 200); if (!v) return { error: true }; f.title = v; }
      if (f0.estDays !== undefined) { const n = f0.estDays == null ? null : f0.estDays; if (n != null && !(Number.isInteger(n) && n >= 1 && n <= EST_MAX)) { setToast({ text: `1~${EST_MAX} 사이 평일 수로 넣어 주세요` }); return { error: true }; } f.estDays = n; }
      const ks = Object.keys(f); if (!ks.length) return { error: true };
      try { const r = await fb.txDoc("templates", tpl.id, (c) => { if (!c || isRemoved(c)) return { ret: { error: true } }; const a = (c.tasks || []).slice(), i = a.findIndex((x) => x && x.key === key);
          if (i < 0 || a[i].out) return { ret: { error: true } };
          if (ks.some((k) => !fb.sameVal(a[i][k] ?? null, base[k] ?? null))) return { ret: { conflict: true } };
          if (ks.every((k) => fb.sameVal(a[i][k] ?? null, f[k] ?? null))) return { ret: { ok: true, same: true } };
          a[i] = { ...a[i], ...f }; const at = nowIso(); return { write: { tasks: a, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: { ok: true } }; });
        if (r && r.conflict) setToast({ text: "그사이 다른 사람이 이 업무를 바꿨어요 · 지금 값을 확인해 주세요" });
        if (r && r.ok && !r.same) { const L = (x) => (x ? `${x}일` : "미정"), prev = Object.fromEntries(ks.map((k) => [k, base[k] ?? null]));
          const label = `견본 ${tpl.title} · ${base.title || key}${"title" in f ? ` · 이름 → ${f.title}` : ""}${"estDays" in f ? ` · 예상 소요 ${L(base.estDays)} → ${L(f.estDays)}` : ""}`;
          log("edit", { col: "templates", targetId: tpl.id, label, prev, next: f, key });
          if (!noUndo) setToast({ text: "견본을 고쳤어요", undo: async () => { const b = await A.tplItem(tpl, key, prev, { ...base, ...f }, true); if (b && b.ok) setToast({ text: "되돌렸어요" }); } }); }
        return r; }
      catch (e) { fail("견본")(e); return { error: true }; } },
    // 견본에 업무 더하기 — it = {title, phase, estDays, parentKey} · 되돌리기 = 빼기(out)
    tplAdd: async (tpl, it) => {
      if (!canEditTpl(tpl, cu)) { setToast({ text: "만든 사람·관리자만 고칠 수 있어요" }); return null; }
      const v = String((it && it.title) || "").trim().slice(0, 200); if (!v) return null;
      const n0 = it.estDays == null ? null : it.estDays; if (n0 != null && !(Number.isInteger(n0) && n0 >= 1 && n0 <= EST_MAX)) { setToast({ text: `1~${EST_MAX} 사이 평일 수로 넣어 주세요` }); return null; }
      const at = nowIso();
      try { const r = await fb.txDoc("templates", tpl.id, (c) => { if (!c || isRemoved(c)) return { ret: { error: true } }; const a = c.tasks || [];
          if (a.filter((x) => x && !x.out).length >= TPL_MAX) return { ret: { full: true } };
          const has = new Set(a.map((x) => x && x.key)); let n = a.length + 1; while (has.has("k" + n)) n++; const key = "k" + n;
          const x = { key, title: v, parentKey: it.parentKey || null, afterKeys: [], phase: it.parentKey ? "" : it.phase || "", estDays: n0, added: { at, by: cu.id, byName: cu.name || "" } };
          return { write: { tasks: [...a, x], updatedAt: at, updatedBy: cu.id, v2At: at }, ret: { ok: true, key } }; });
        if (r && r.full) { setToast({ text: `견본 업무는 ${TPL_MAX}개까지예요` }); return null; }
        if (!r || !r.ok) { setToast({ text: "이 견본을 찾지 못했어요" }); return null; }
        log("edit", { col: "templates", targetId: tpl.id, label: `견본 ${tpl.title} · 업무 더함 · ${v}${n0 ? ` (${n0}일)` : ""}`, key: r.key });
        setToast({ text: `더했어요 · ${v}`, undo: () => A.tplOut(tpl, r.key, true, true) });
        return r.key; }
      catch (e) { fail("견본")(e); return null; } },
    // 견본 업무 빼기(on) · 되돌리기(off) — 지우지 않고 out 표시(하위 업무도 같이 · 같은 표시끼리 같이 돌아옴)
    tplOut: async (tpl, key, on, noUndo) => {
      if (!canEditTpl(tpl, cu)) { setToast({ text: "만든 사람·관리자만 고칠 수 있어요" }); return false; }
      const at = nowIso(), mark = { at, by: cu.id, byName: cu.name || "", root: key };
      let r; try { r = await fb.txDoc("templates", tpl.id, (c) => { if (!c || isRemoved(c)) return { ret: { error: true } }; const a = c.tasks || [], it = a.find((x) => x && x.key === key); if (!it) return { ret: { error: true } };
          const stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
          if (on) { if (it.out) return { ret: { already: true } }; const sub = new Set([key]);
            for (let g = true, i = 0; g && i < 50; i++) { g = false; a.forEach((x) => { if (x && !x.out && x.parentKey && sub.has(x.parentKey) && !sub.has(x.key)) { sub.add(x.key); g = true; } }); }
            return { write: { tasks: a.map((x) => (x && sub.has(x.key) && !x.out ? { ...x, out: mark } : x)), ...stamp }, ret: { ok: true, n: sub.size, title: it.title } }; }
          const m = it.out; if (!m) return { ret: { already: true } };
          const back = a.filter((x) => x && x.out && x.out.root === m.root && x.out.at === m.at).length;
          return { write: { tasks: a.map((x) => (x && x.out && x.out.root === m.root && x.out.at === m.at ? { ...x, out: null } : x)), ...stamp }, ret: { ok: true, n: back, title: it.title } }; }); }
      catch (e) { fail("견본")(e); return false; }
      if (!r || r.error) { setToast({ text: "이 업무를 찾지 못했어요" }); return false; }
      if (r.already) { setToast({ text: on ? "이미 뺀 업무예요" : "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
      log("edit", { col: "templates", targetId: tpl.id, label: `견본 ${tpl.title} · ${on ? "업무 뺌" : "업무 되돌림"} · ${r.title}${r.n > 1 ? ` (하위 ${r.n - 1}개 같이)` : ""}`, key });
      if (!noUndo && on) setToast({ text: `뺐어요 · ${r.title}${r.n > 1 ? ` · 하위 ${r.n - 1}개 같이` : ""}`, undo: () => A.tplOut(tpl, key, false, true) });
      else setToast({ text: on ? `뺐어요 · ${r.title}` : "되돌렸어요" });
      return true; },
    tplRemove: async (tpl, opt) => { const undo = !!(opt && opt.undo);
      if (!canEditTpl(tpl, cu)) { setToast({ text: "만든 사람·관리자만 없앨 수 있어요" }); return false; }
      const at = nowIso(), rm = { at, by: cu.id, byName: cu.name || "", ...(undo ? { reason: "저장 되돌림" } : {}) };
      let r; try { r = await fb.txDoc("templates", tpl.id, (c) => (!c ? { ret: "missing" } : isRemoved(c) ? { ret: "already" } : { write: { removed: rm, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: "ok" })); }
      catch (e) { fail("견본 없애기")(e); return false; }
      if (r !== "ok") { setToast({ text: r === "already" ? "이미 없앤 견본이에요" : "이 견본을 찾지 못했어요" }); return false; }
      log("remove", { col: "templates", targetId: tpl.id, label: `견본 ${tpl.title} · ${undo ? "저장 되돌림 (휴지통)" : "없앰 (휴지통 · 이 견본으로 만든 프로젝트는 그대로)"}`, prev: { removed: null }, next: { removed: rm } });
      setToast(undo ? { text: "되돌렸어요 · 견본은 휴지통(없앤 견본)에 있어요" } : { text: `없앴어요 · ${tpl.title}`, undo: () => A.tplRestore({ ...tpl, removed: rm }, true) });
      return true; },
    tplRestore: async (tpl, viaUndo) => { const rm = tpl && tpl.removed; if (!rm || !canEditTpl(tpl, cu)) return false;
      const at = nowIso(); let r;
      try { r = await fb.txDoc("templates", tpl.id, (c) => (!c || !c.removed || !fb.sameVal(c.removed, rm) ? { ret: false } : { write: { removed: null, updatedAt: at, updatedBy: cu.id, v2At: at }, ret: true })); }
      catch (e) { fail("되살리기")(e); return false; }
      if (!r) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
      log("restore", { col: "templates", targetId: tpl.id, label: `견본 ${tpl.title} · 되살림${viaUndo ? " (되돌리기)" : ""}`, prev: { removed: rm }, next: { removed: null } });
      setToast({ text: viaUndo ? "되돌렸어요" : `되살렸어요 · ${tpl.title}` });
      return true; },
    // 견본 → 새 프로젝트 (tpl.planFromTemplate) — 프로젝트 + 업무를 한 transaction(없던 번호일 때만 · addProject·createFlow 처럼 한 번에)
    //   기록 1건 · 다른 사람 업무 = 맡김 묶음(bulkId) · 5초 되돌리기 = 만든 것을 그대로(아무도 안 고쳤을 때만) 프로젝트 휴지통으로(지우지 않음 · 되살리기 가능)
    tplCreate: async (plan, tpl) => {
      if (!plan || !plan.tasks.length) { setToast({ text: "견본에 업무가 없어요" }); return null; }
      if (plan.tasks.length > 400) { setToast({ text: "한 번에 400개까지예요" }); return null; }
      const p = plan.project, docs = [{ key: "projects", id: p.id }, ...plan.tasks.map((t) => ({ key: "tasks", id: t.id }))];
      let r; try { r = await fb.txDocs(docs, (curs) => (curs.some(Boolean) ? { ret: false } : { writes: [p, ...plan.tasks], ret: true })); } catch (e) { fail("견본으로 만들기")(e); return null; }
      if (!r) { setToast({ text: "같은 번호가 이미 있어서 만들지 않았어요 · 다시 눌러 주세요" }); return null; }
      log("add", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · 견본 '${tpl.title}'으로 만듦 · 업무 ${plan.tasks.length}개${plan.end ? ` · 끝 예상 ${md(plan.end)}` : ""}`, fromTemplate: tpl.id, ids: plan.tasks.map((t) => t.id) });
      setToast({ text: `만들었어요 · 업무 ${plan.tasks.length}개${plan.end ? ` · 끝 예상 ${md(plan.end)}` : ""}`, undo: () => A.tplCreateUndo(plan) });
      return p; },
    tplCreateUndo: async (plan) => { const p = plan.project, at = nowIso(), n = plan.tasks.length, why = "견본으로 만들기 되돌림";
      const docs = [{ key: "projects", id: p.id }, ...plan.tasks.map((t) => ({ key: "tasks", id: t.id }))], stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      let r; try { r = await fb.txDocs(docs, (curs) => { if (curs.some((c) => !c || isRemoved(c) || (c.updatedAt || "") !== plan.at)) return { ret: false };
          return { writes: [{ ...projRemoveFields(curs[0], cu, at, why, n), ...stamp }, ...curs.slice(1).map((c) => ({ ...projTaskRemoveFields(c, cu, at, why, p.id), ...stamp }))], ret: true }; }); }
      catch (e) { fail("되돌리기")(e); return false; }
      if (!r) { setToast({ text: "그사이 바뀐 것이 있어서 되돌리지 않았어요 · 필요하면 프로젝트 [없애기]로 빼 주세요" }); return false; }
      log("remove", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · ${why} (휴지통 · 되살릴 수 있어요)`, prev: { removed: null }, ids: plan.tasks.map((t) => t.id) });
      setToast({ text: "되돌렸어요 · 만든 프로젝트는 휴지통(없앤 프로젝트)에 있어요" });
      return true; },
    taskRemove: async (t, reason) => { if (!canRemoveTask(t, cu)) { setToast({ text: "없앨 수 없는 업무예요" }); return false; }
      const at = nowIso(), kids = taskKids(t, D.tasks), seen = new Set([t.id, ...kids.map((x) => x.id)]);
      try { let q = [...seen];   // 불러오지 않은 하위 업무(오래전에 끝낸 것)도 서버에서 한 층씩
        for (let k = 0; k < 10 && q.length; k++) { const nx = [];
          for (const id of q) (await fb.fetchWhere("tasks", ["parentId", "==", id])).forEach((x) => { if (x && !seen.has(x.id) && !x.isFixed && !isRemoved(x)) { seen.add(x.id); kids.push(x); nx.push(x.id); } });
          q = nx; } }
      catch (e) { fail("하위 업무 불러오기")(e); return false; }
      const stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      let r;
      try { r = await fb.txDocs([t, ...kids].map((x) => ({ key: "tasks", id: tdoc(x) })), (curs) => {
          if (!curs[0] || isRemoved(curs[0])) return { ret: null };
          const ok = kids.filter((x, i) => curs[i + 1] && !isRemoved(curs[i + 1])).map((x) => x.id), root = taskRemoveFields(curs[0], cu, at, reason, t.id, ok);
          return { writes: [{ ...root, ...stamp }, ...kids.map((x, i) => (curs[i + 1] && !isRemoved(curs[i + 1]) ? { ...taskRemoveFields(curs[i + 1], cu, at, reason, t.id), ...stamp } : null))], ret: { rm: root.removed, kids: ok } }; }); }
      catch (e) { fail("없애기")(e); return false; }
      if (!r) { setToast({ text: "이미 없앤 업무예요" }); return false; }
      const n = r.kids.length;
      log("remove", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 없앰${reason ? " · " + reason : ""}${n ? ` · 하위 ${n}개 같이` : ""} (휴지통 · 댓글·파일·기록은 그대로)`, prev: { removed: null, status: t.status || "todo" }, next: { removed: r.rm }, ids: [t.id, ...r.kids] });
      [...new Set([t, ...kids].map((x) => x.projectId).filter(Boolean))].forEach((pid) => recalc(pid));
      setToast({ text: `없앴어요 · ${t.title}${n ? ` · 하위 ${n}개 같이` : ""}`, undo: () => A.taskRestore({ ...t, removed: r.rm }, true) });
      return true; },
    // 되살리기 = 없앨 때 그대로(상태는 처음부터 안 바꿈) · 서버의 removed 가 내가 본 것과 같을 때만 · 같이 없앤 하위 업무(같은 root·같은 시각)도 같이
    taskRestore: async (t, viaUndo) => { const rm = t && t.removed; if (!rm || !canRestoreTask(t, cu)) return false;
      const at = nowIso(), ids = (rm.kids || []).filter((x) => x && x !== t.id), stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      let r;
      try { r = await fb.txDocs([{ key: "tasks", id: tdoc(t) }, ...ids.map((id) => ({ key: "tasks", id }))], (curs) => {
          if (!curs[0] || !curs[0].removed || !fb.sameVal(curs[0].removed, rm)) return { ret: null };
          const back = (c) => c && c.removed && c.removed.root === t.id && c.removed.at === rm.at;
          return { writes: [{ removed: null, ...stamp }, ...ids.map((id, i) => (back(curs[i + 1]) ? { removed: null, ...stamp } : null))], ret: { n: ids.filter((id, i) => back(curs[i + 1])).length, pids: curs.filter(Boolean).map((c) => c.projectId).filter(Boolean) } }; }); }
      catch (e) { fail("되살리기")(e); return false; }
      if (!r) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
      log("restore", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 되살림${r.n ? ` · 하위 ${r.n}개 같이` : ""}${viaUndo ? " (되돌리기)" : ""}`, prev: { removed: rm }, next: { removed: null }, ids: [t.id, ...ids] });
      [...new Set(r.pids)].forEach((pid) => recalc(pid));
      setToast({ text: viaUndo ? "되돌렸어요" : `되살렸어요 · ${t.title}${r.n ? ` · 하위 ${r.n}개 같이` : ""}` });
      return true; },
    // 횟수 목표: v2 덧칠 hidden true + removed (버전1 문서는 그대로 · 관리자만)
    // ── 프로젝트 없애기 (사용자 확정 2026-10-07 · 책임자·관리자만 · 지우지 않음) ──
    //   프로젝트 removed{at,by,byName,reason,prevStatus,n} + 그 안 아직 안 없앤 업무 전부(서버에서 다시 읽음) removed{…, root: 프로젝트, proj: true} — 한 transaction
    //   서버의 프로젝트가 화면에서 본 값(상태·책임자)과 같고 아직 안 없앤 것일 때만 · 업무도 아직 안 없앤 것만 · 기록 1건 · 5초 되돌리기
    //   신제품 프로젝트(lb_)도 업무OS 문서만 — 신제품 대시보드엔 아무것도 안 씀(lbpush·lbsync 가 없앤 프로젝트를 건너뜀)
    projRemove: async (p, reason) => { if (!canRemoveProj(p, cu)) { setToast({ text: "책임자나 관리자만 없앨 수 있어요" }); return false; }
      const at = nowIso(), stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      let ts; try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => t && !t.isFixed && !isRemoved(t)); }
      catch (e) { fail("프로젝트 업무 불러오기")(e); return false; }
      if (ts.length > 450) { setToast({ text: `업무가 ${ts.length}개라 한 번에 없앨 수 없어요 · 관리자에게 알려 주세요` }); return false; }
      const live = (c) => c && !c.isFixed && !isRemoved(c) && c.projectId === p.id;
      let r;
      try { r = await fb.txDocs([{ key: "projects", id: p._doc || p.id }, ...ts.map((t) => ({ key: "tasks", id: tdoc(t) }))], (curs) => {
          const c = curs[0]; if (!c || isRemoved(c)) return { ret: { gone: true } };
          if ((c.status || "") !== (p.status || "") || (c.assigneeId || "") !== (p.assigneeId || "")) return { ret: { conflict: true } };
          const ok = ts.filter((t, i) => live(curs[i + 1])), pf = projRemoveFields(c, cu, at, reason, ok.length);
          return { writes: [{ ...pf, ...stamp }, ...ts.map((t, i) => (live(curs[i + 1]) ? { ...projTaskRemoveFields(curs[i + 1], cu, at, reason, p.id), ...stamp } : null))], ret: { rm: pf.removed, ids: ok.map((t) => t.id) } }; }); }
      catch (e) { fail("프로젝트 없애기")(e); return false; }
      if (!r || r.gone) { setToast({ text: "이미 없앤 프로젝트예요" }); return false; }
      if (r.conflict) { setToast({ text: "그사이 다른 사람이 프로젝트를 바꿔서 그대로 뒀어요 · 다시 확인해 주세요" }); return false; }
      const n = r.ids.length;
      log("remove", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · 프로젝트 없앰${reason ? " · " + reason : ""}${n ? ` · 업무 ${n}개 같이` : ""} (휴지통 · 댓글·자료·기록은 그대로)`, prev: { removed: null, status: p.status || "" }, next: { removed: r.rm }, ids: [p.id, ...r.ids] });
      setToast({ text: `없앴어요 · ${p.title}${n ? ` · 업무 ${n}개 같이` : ""}`, undo: () => A.projRestore({ ...p, removed: r.rm }, true) });
      return true; },
    // 되살리기: 서버의 removed 가 내가 본 것과 같을 때만 · 같이 없앤 업무(root = 이 프로젝트 · 같은 시각)만 같이 · 상태는 없애기 전 그대로
    projRestore: async (p, viaUndo) => { const rm = p && p.removed; if (!rm || !canRestoreProj(p, cu)) { setToast({ text: "책임자나 관리자만 되살릴 수 있어요" }); return false; }
      const at = nowIso(), stamp = { updatedAt: at, updatedBy: cu.id, v2At: at };
      let ts; try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => projTaskBack(t, p)); }
      catch (e) { fail("프로젝트 업무 불러오기")(e); return false; }
      const back = (c) => !!c && projTaskBack(c, p);
      let r;
      try { r = await fb.txDocs([{ key: "projects", id: p._doc || p.id }, ...ts.map((t) => ({ key: "tasks", id: tdoc(t) }))], (curs) => {
          const c = curs[0]; if (!c || !c.removed || !fb.sameVal(c.removed, rm)) return { ret: null };
          return { writes: [{ removed: null, ...(rm.prevStatus && c.status !== rm.prevStatus ? { status: rm.prevStatus } : {}), ...stamp }, ...ts.map((t, i) => (back(curs[i + 1]) ? { removed: null, ...stamp } : null))], ret: { n: ts.filter((t, i) => back(curs[i + 1])).length } }; }); }
      catch (e) { fail("되살리기")(e); return false; }
      if (!r) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
      log("restore", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · 프로젝트 되살림${r.n ? ` · 업무 ${r.n}개 같이` : ""}${viaUndo ? " (되돌리기)" : ""}`, prev: { removed: rm }, next: { removed: null }, ids: [p.id, ...ts.map((t) => t.id)] });
      setToast({ text: viaUndo ? "되돌렸어요" : `되살렸어요 · ${p.title}${r.n ? ` · 업무 ${r.n}개 같이` : ""}` });
      return true; },
    akRemove: async (it) => { if (!canRemoveAk(cu)) { setToast({ text: "관리자만 없앨 수 있어요" }); return false; }
      const at = nowIso(), base = ((D.ak && D.ak.raw) || []).find((x) => x.id === it.id) || null, rm = { at, by: cu.id, byName: cu.name || "" };
      try { const ok = await fb.txDoc("kpidefs", it.id, (c) => { if (c && c.hidden && c.removed) return { ret: false };
          const w = kpiEditWrite(c, "actionKPIs", it.id, {}, true, cu, at, base) || {}; return { write: { ...w, removed: rm }, ret: true }; });
        if (!ok) { setToast({ text: "이미 없앤 것이에요" }); return false; }
        log("remove", { col: "kpidefs", targetId: it.id, label: `${it.name} · 없앰 (휴지통 · 지난 기록·메모·파일은 그대로)`, prev: { hidden: false, removed: null }, next: { hidden: true, removed: rm } });
        setToast({ text: `없앴어요 · ${it.name}`, undo: () => A.akRestore({ ...it, _removed: rm }, true) });
        return true; }
      catch (e) { fail("없애기")(e); return false; } },
    akRestore: async (it, viaUndo) => { const rm = it && it._removed; if (!rm || !canRemoveAk(cu)) return false;
      const at = nowIso(), base = ((D.ak && D.ak.raw) || []).find((x) => x.id === it.id) || null;
      try { const ok = await fb.txDoc("kpidefs", it.id, (c) => { if (!c || !c.removed || !fb.sameVal(c.removed, rm)) return { ret: false };
          const w = kpiEditWrite(c, "actionKPIs", it.id, {}, false, cu, at, base) || {}; return { write: { ...w, removed: null }, ret: true }; });
        if (!ok) { setToast({ text: "그사이 다른 사람이 바꿔서 그대로 뒀어요" }); return false; }
        log("restore", { col: "kpidefs", targetId: it.id, label: `${it.name} · 되살림${viaUndo ? " (되돌리기)" : ""}`, prev: { hidden: true, removed: rm }, next: { hidden: false, removed: null } });
        setToast({ text: viaUndo ? "되돌렸어요" : `되살렸어요 · ${it.name}` });
        return true; }
      catch (e) { fail("되살리기")(e); return false; } },
    // 신제품 횟수 항목 +d (블로그 포스팅 3회 …) → count · 제목 (n/목표) · 처음 세면 진행 중 · 목표 채우면 끝냄 (transaction: 서버 지금 횟수에 더함 → 둘이 같이 눌러도 안 빠짐)
    //   횟수 항목은 버전1 업무OS 칸(osExtra)이라 신제품 문서엔 횟수·상태 모두 안 씀 · 기억(lbSeen)에 횟수가 없던 예전 업무는 지금 횟수를 기억에 같이 (버전1 횟수가 나중에 바뀌면 그 차이만 더함)
    //   → {n, g} · 실패하면 null (알림)
    launchCount: async (t, d = 1, extra) => { const at = nowIso();
      try {
        const c = await fb.txDoc("tasks", tdoc(t), (cur) => { if (!cur) return null; const x = { ...cur, id: cur.id || t.id }, r = countFields(x, d, cu, at);
          const w = { ...r.fields, updatedAt: at, updatedBy: cu.id, v2At: at, countLog: fb.arrayUnion({ at, by: cu.id, byName: cu.name, d, ...(extra || {}) }),
            ...(x.lbSeen && x.lbSeen.count === undefined ? { "lbSeen.count": countOf(x) } : {}), ...(r.fields.status && r.fields.status !== x.status ? { statusLog: sl(r.fields.status) } : {}) };
          return { write: w, ret: { n: r.n, g: r.g, st: r.fields.status || null } }; });
        if (!c) { setToast({ text: "이 업무를 찾지 못했어요" }); return null; }
        log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${baseTitle(t)} · ${c.n}/${c.g}회${extra && extra.akName ? ` (반복 '${extra.akName}' 같이)` : ""}${d < 0 ? " · 취소" : ""}` });
        if (c.st && t.projectId) recalc(t.projectId);
        return c;
      } catch (e) { fail("횟수")(e); return null; } },
    // 기밀 (secret.js): sec = { allow:[id], deny:[id](업무 · 끈 프로젝트 책임자) } 이면 켜기 · null 이면 풀기 — 정하는 사람(by)은 늘 볼 수 있음
    setSecret: (kind, x, sec) => { const dn = kind === "task" && sec ? (sec.deny || []).filter((i) => i && i !== cu.id) : [];
      const f = { secret: sec ? { on: true, allow: sec.allow || [], ...(dn.length ? { deny: dn } : {}), by: cu.id, byName: cu.name, at: nowIso() } : null }, label = sec ? `기밀 설정 (볼 사람 ${(sec.allow || []).length}명 더${dn.length ? ` · 책임자 ${nameOf(D.users, dn[0]) || ""} 끔` : ""})` : "기밀 풀기";
      if (kind === "project") return A.patchProject(x, f, label, null);
      return P(x, f, "edit", `${x.title} · ${label}`, { prev: { secret: x.secret || null } }); },
    patchProject: (p, f, label, prev) => fb.patch("projects", p._doc || p.id, { ...f, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }).then(() => log("edit", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · ${label}`, ...(prev != null ? { prev } : {}) })).catch(fail("프로젝트")),
    // 신제품: 프로젝트 + 항목 업무를 한 번에
    createLaunch: async (plan) => {
      try { await fb.putMany([{ key: "projects", id: plan.project.id, data: plan.project }, ...plan.tasks.map((t) => ({ key: "tasks", id: t.id, data: t }))]); }
      catch (e) { fail("신제품")(e); return null; }
      log("launch", { col: "projects", targetId: plan.project.id, projectId: plan.project.id, label: `${plan.project.title} · 출시 ${md(plan.project.launchDate)} · 항목 ${plan.tasks.length}개` });
      return plan.project;
    },
    // 흐름으로 만들기: 프로젝트 + 단계 업무(앞 단계를 deps 로) 한 번에 → 기본값에서 '바꾼' 단계 담당만 v2 workflows 문서에 기억(다음 기본값)
    //   팀이 같이 쓰는 설정이라: 기본값(지난번 담당 → 빈 칸이면 나)을 그대로 둔 단계는 안 씀 → 빈 칸(= 건 담당자)은 빈 칸 그대로. 바꾼 게 없으면 쓰지 않음. 이전 값은 기록에
    createFlow: async (plan, wf, owners) => {
      try { await fb.putMany([{ key: "projects", id: plan.project.id, data: plan.project }, ...plan.tasks.map((t) => ({ key: "tasks", id: t.id, data: t }))]); }
      catch (e) { fail("흐름")(e); return null; }
      log("add", { col: "projects", targetId: plan.project.id, projectId: plan.project.id, label: `${plan.project.title} · 흐름 ${plan.tasks.length}단계` });
      if (wf && wf.doc && Array.isArray(wf.doc.stages)) {
        const def = flowOwners(wf, cu, D.users), pick = {};
        wf.stages.forEach((s, i) => { if (s && s.id && owners[i] && owners[i] !== def[i] && owners[i] !== (s.ownerId || "")) pick[s.id] = owners[i]; });
        const n = Object.keys(pick).length;
        if (n) { const at = nowIso(), prev = wf.doc.stages.map((s) => ({ id: (s && s.id) || "", ownerId: (s && s.ownerId) || "" }));
          fb.patch("workflows", wf.doc._doc || wf.doc.id, { stages: wf.doc.stages.map((s) => (s && s.id && pick[s.id] ? { ...s, ownerId: pick[s.id] } : s)), updatedAt: at, updatedBy: cu.id, v2At: at })
            .then(() => log("edit", { col: "workflows", targetId: wf.doc.id || wf.id, label: `${wf.name} · 단계 담당 기억 ${n}개 (${Object.entries(pick).map(([sid, u]) => `${(wf.stages.find((s) => s.id === sid) || {}).name || sid} ${nameOf(D.users, u)}`).join(" · ")})`, prev }))
            .catch((e) => console.error("[v2] 흐름 담당 기억 실패:", e)); }
      }
      return plan.project;
    },
    // 출시일 바꾸기 → 자동 기한 항목만 같이 이동 (지난 날 안 됨 · 최대 100건 · 프로젝트와 항목을 한 번에 · 항목별 이전 기한 기록 · 5초 되돌리기)
    //   30건 이상 확인 창은 부르는 화면이 views.js previewLaunchMove(p, D, date, key).changes.length 로 먼저 띄움
    setLaunchDate: async (p, date) => {
      const key = ymd(new Date());
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setToast({ text: "출시일을 골라 주세요" }); return false; }
      if (date < key) { setToast({ text: `지난 날(${md(date)})은 출시일로 정할 수 없어요 · 오늘 이후로 골라 주세요` }); return false; }
      try {
        const all = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !isRemoved(t)); const ch = relaunch(all, date, key);
        if (ch.length > 100) { setToast({ text: "한 번에 100건까지예요" }); return false; }
        const at = nowIso(), pid = p._doc || p.id, prevP = { launchDate: p.launchDate || "", dueDate: p.dueDate || "" };
        const prevT = ch.map((x) => ({ id: x.task._doc || x.task.id, dueDate: x.task.dueDate || "" }));
        await fb.patchMany([{ key: "projects", id: pid, fields: { launchDate: date, dueDate: date, updatedAt: at, updatedBy: cu.id, v2At: at } },
          ...ch.map((x) => ({ key: "tasks", id: x.task._doc || x.task.id, fields: { dueDate: x.due, updatedAt: at, updatedBy: cu.id, v2At: at } }))]);
        log("edit", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · 출시일 ${md(p.launchDate) || "미정"} → ${md(date)} · 항목 ${ch.length}개 기한 이동`, ids: ch.map((x) => x.task.id), prev: { ...prevP, tasks: prevT } });
        setToast({ text: `출시일을 바꿨어요 · 항목 ${ch.length}개 기한도 옮겼어요`, undo: () => undoMany([{ key: "projects", id: pid, wrote: { launchDate: date, dueDate: date }, prev: prevP },
          ...ch.map((x, k) => ({ key: "tasks", id: prevT[k].id, wrote: { dueDate: x.due }, prev: { dueDate: prevT[k].dueDate } }))], `${p.title} · 출시일 ${md(date)} → ${md(prevP.launchDate) || "미정"}`, "edit") });
        return true;
      } catch (e) { fail("출시일")(e); return false; }
    },
  };
  return A;
}


// ── 버전1에서 다시 가져오기 (관리자 설정) — v2 에서 고친 문서(v2At · updatedBy · madeIn:v2)는 건너뜀 → v2 에서 정리한 담당·기한이 그대로 남음
// kind: "launch"(신제품 보드만) | "all"(전체 + 신제품). 먼저 계산해 미리 보기 숫자를 보여 주고, 확인 뒤 runReimport
// v2 에서 고친 문서: v2At · updatedBy · madeIn:v2 + (이 표시가 생기기 전에 쓴) 메모(memoAt) · 받음(ackBy) · v2 에 올린 파일
const V2_FILE = /^task-attachments\/v2\//;
// 신제품 대시보드 자동 반영(updatedBy 'board' · 메모 '신제품 대시보드')은 업무OS 에서 고친 게 아니라서 빼고 봄
//   모여라딜 OS 최신 가져오기(moysync · moyAt)가 넣거나 바꾼 문서도 버전1보다 새것이라 건너뜀
export const v2edited = (x) => !!(x && (x.v2At || x.moyAt || (x.updatedBy && x.updatedBy !== "board") || x.madeIn === "v2" || (x.memoAt && x.memoByName !== "신제품 대시보드") || x.ackBy
  || (Array.isArray(x.attachments) && x.attachments.some((a) => a && V2_FILE.test(String(a.path || ""))))));
// 이미 있는 문서에 덮어쓸 때 빼는 칸 — v2 가 주인인 칸(PIN · 주 한도 · 고정업무 사람별 체크)
//   고정업무 체크(doneDates·doneAtBy·subDone)는 버전1에도 같은 이름이 있어서 '고친 문서' 판단에는 못 쓰고, 대신 덮어쓰지 않음
export const V2_TASK_ONLY = ["scope", "scopeBy", "scopeAt", "qty", "cycleOk", "cycleBy", "cycleAt", "madeIn", "removed", "phaseBy", "phaseAt", "estDays", "estBy", "estAt", "fromTemplate", "tplKey"];   // estDays·estBy·estAt = 예상 소요일 · fromTemplate·tplKey = 견본으로 만든 업무 (2026-10-07)   // phaseBy·phaseAt = 업무OS에서 정한 신제품 단계   // removed = [없애기](휴지통) — 다시 가져오기가 되살리지 않음
export function stripV2Only(key, data, cur) {
  if (!data) return data; const d = { ...data };
  if (key === "users") Object.keys(d).forEach((f) => { if (/^pin/.test(f) || f === "weekCap") delete d[f]; });
  if (key === "projects") ["removed", "road", "roadBy", "roadAt", "fromTemplate", "fromTemplateTitle"].forEach((f) => delete d[f]);   // fromTemplate = 견본으로 만든 프로젝트(2026-10-07)   // road = 업무OS 프로젝트 단계(로드 · 2026-10-07)
  if (key === "notes") delete d.removed;   // 댓글 삭제(2026-10-07) — 다시 가져오기가 되살리지 않음   // 프로젝트 없애기(휴지통) — 다시 가져오기가 되살리지 않음
  if (key === "tasks") { ["doneDates", "doneAtBy", "subDone"].forEach((f) => delete d[f]); if ((cur && cur.isFixed) || d.isFixed) ["doneAt", "doneByName"].forEach((f) => delete d[f]);
    // 반복 실행·고정업무 나누기(2단계) · 주기 확인 · 건수 칸(3단계 예약) — v2 에서만 정하는 칸 · 정한 브랜드·반복도 버전1 값으로 안 되돌림
    V2_TASK_ONLY.forEach((f) => delete d[f]);
    if (cur && (cur.scope || cur.scopeAt)) delete d.brand;
    if (cur && cur.phaseAt) delete d.phase;   // 업무OS에서 정한 신제품 단계는 버전1·신제품 값으로 안 되돌림
    if (cur && cur.cycleOk) ["recurType", "weekDays", "weekDay", "monthDay", "monthEnd"].forEach((f) => delete d[f]);
    if (isRemoved(cur)) delete d.paused; }   // 없앤 것은 멈춤도 버전1 값으로 안 바꿈 (되살릴 때 이전 값으로)
  return d;
}
export async function planReimport(kind, D) {
  let ops = [], counts = {};
  if (kind === "all") { const v1 = await fb.readV1State(); const notes = await fb.readV1Notes(); const r = planSeed(v1, notes); ops = r.ops; counts = r.counts; if (!(v1.tasks || []).length) throw new Error("버전1 업무가 비어 보여요"); }
  const lp = planLaunchImport(await fb.readV1Launch(), D);
  ops.push(...lp.projects.map((x) => ({ key: "projects", id: x.id, data: x })), ...lp.tasks.map((x) => ({ key: "tasks", id: x.id, data: x })));
  counts.launch = lp.projects.length;
  // 덮어쓸지·새로 생길지 비교: 가져올 모든 칸(업무·프로젝트·사람·댓글·기록 …)의 v2 문서를 읽기만
  const have = {}; for (const k of [...new Set(ops.map((o) => o.key))]) have[k] = new Map((await fb.fetchWhere(k, null)).map((x) => [x._doc || x.id, x]));
  const keep = [], skip = [], fresh = [];
  ops.forEach((o) => { const cur = have[o.key] && have[o.key].get(o.id);
    if (!cur) { fresh.push(o); keep.push(o); return; }
    if (v2edited(cur)) { skip.push(o); return; }
    // 이미 있는 문서: v2 에서 정한·초기화한 PIN · 주 한도 · 고정업무 체크를 버전1 값으로 되돌리지 않게 그 칸은 빼고 씀
    keep.push({ ...o, data: stripV2Only(o.key, o.data, cur) }); });
  // 모두 merge 로 씀 (주 한도 같은 v2 전용 칸 유지)
  return { ops: keep, skip: skip.length, fresh: fresh.length, overwrite: keep.length - fresh.length, counts };
}
export async function runReimport(plan, onProgress) { await fb.putMany(plan.ops, onProgress, { merge: true }); }
