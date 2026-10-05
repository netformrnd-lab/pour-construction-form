// 업무OS v2 — 두 앱(실사용 os2.html · 관리자 os2-admin.html)이 함께 쓰는 바탕:
// 데이터 구독 · 첫 복사 · 로그인(사람별 PIN) · 저장 동작(바뀐 칸만)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { pinHash } from "./sha.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover, isHoldP, nextWorkday, setHolidayLayer, handOverOwners,
} from "./model.js";
import { planLaunchImport, relaunch, isTempOwner } from "./launch.js";
import { nextTurnText } from "./turn.js";
import { planLaunchSync, planLaunchTrash } from "./lbsync.js";
import { planLaunchPush, BY as LB_BY } from "./lbpush.js";
import { redact, secretOn } from "./secret.js";
import { flowOwners } from "./flow.js";
import { C, Big, TBtn, inp, useLocal } from "./ui.jsx";

export const V1_URL = "./os.html";
export const LS = (k) => "pour-os2-" + k;   // v1(pour-os-…) 과 겹치지 않는 기기 저장 이름
export const nowIso = () => new Date().toISOString();

// ───────────────── 데이터 구독 ─────────────────
export function useData(on) {
  const [S, setS] = useState({ users: null, projects: [], openT: [], doneT: [], notes: [], log: [], events: [], brands: [], workflows: [], mainKPIs: [], subKPIs: [], settings: [] });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!on) return;
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString(), since14 = new Date(Date.now() - 14 * 864e5).toISOString();
    const put = (k) => (x) => setS((s) => ({ ...s, [k]: x }));
    const onE = (e) => setErr("데이터를 불러오지 못했어요 · 인터넷 연결을 확인해 주세요 (" + (e.code || e.message) + ")");
    const subs = [
      fb.listen("users", null, put("users"), onE),
      fb.listen("projects", null, put("projects"), onE),
      fb.listen("tasks", ["status", "in", ["todo", "inprogress", "hold", "review"]], put("openT"), onE),   // 열린 업무 + 고정업무
      fb.listen("tasks", ["doneAt", ">=", since30], put("doneT"), onE),                                    // 최근 30일 끝낸 업무
      fb.listen("notes", ["at", ">=", since30], put("notes"), onE),
      fb.listen("log", ["at", ">=", since14], put("log"), onE),
      fb.listen("events", null, put("events"), onE),
      fb.listen("brands", null, put("brands"), onE),
      fb.listen("workflows", null, put("workflows"), onE),
      fb.listen("mainKPIs", null, put("mainKPIs"), onE),   // 프로젝트 KPI 분류용 (읽기만)
      fb.listen("subKPIs", null, put("subKPIs"), onE),
      fb.listen("settings", null, put("settings"), (e) => console.warn("[v2] 설정(회사 쉬는 날) 불러오기 실패 · 앱은 그대로:", e)),   // 못 읽어도 앱은 그대로
    ];
    return () => subs.forEach((u) => u && u());
  }, [on]);
  const D = useMemo(() => {
    const m = new Map(); S.doneT.forEach((t) => m.set(t.id, t)); S.openT.forEach((t) => m.set(t.id, t));
    return { users: S.users || [], projects: S.projects, tasks: [...m.values()], notes: S.notes, log: S.log, events: S.events, brands: S.brands, workflows: S.workflows, mainKPIs: S.mainKPIs || [], subKPIs: S.subKPIs || [], settings: S.settings || [], ready: !!S.users };
  }, [S]);
  return [D, err];
}


// 시작 순서: 복사 정보 확인 → (없으면) 첫 복사 → 데이터 구독 → 로그인. 두 앱이 같은 순서·같은 기기 로그인을 쓴다
export function useBoot() {
  const [meta, setMeta] = useState(undefined);   // undefined=확인 중, null=아직 복사 전
  const [metaErr, setMetaErr] = useState("");
  const checkMeta = () => { setMetaErr(""); fb.getMeta().then(setMeta).catch((e) => { console.error("[v2] 복사 정보 확인 실패:", e); setMetaErr("서버에 연결하지 못했어요 · 인터넷 연결을 확인하고 다시 눌러 주세요"); }); };
  useEffect(checkMeta, []);
  const [D, err] = useData(!!meta);
  const [me, setMe] = useLocal(LS("me"), "");
  const [key, setKey] = useLocal(LS("key"), "");
  const cu = D.users.find((u) => u.id === me);
  const authed = !!(cu && cu.active !== false && (cu.pinHash ? cu.pinHash === key : false));
  const [launchNew, setLaunchNew] = useState(0);
  // 쉬는 날: 매달 자동 갱신한 공식 특일 정보(holidays.json, 같은 사이트) + 회사만 쉬는 날(settings/holidays). 화면이 그리기 전에 층을 바꿔 둠
  const [holJ, setHolJ] = useState(null);
  useEffect(() => { fetch("./holidays.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.days) setHolJ(j); })
    .catch((e) => console.warn("[v2] 공휴일 자동 갱신 파일 못 읽음 · 앱 안 표로 계산:", e && e.message)); }, []);
  useMemo(() => setHolidayLayer("fetched", holJ && holJ.days), [holJ]);
  const comp = ((D.settings || []).find((x) => x.id === "holidays") || {}).days;
  useMemo(() => setHolidayLayer("company", comp), [JSON.stringify(comp || {})]);
  const synced = useRef(false);
  useEffect(() => { if (!meta || !D.ready || !authed || synced.current) return; synced.current = true;
    syncNewLaunch(D, cu).then((n) => { if (n) setLaunchNew(n); }).catch((e) => console.error("[v2] 신제품 보드 새 제품 가져오기 실패:", e));
    const today = ymd(new Date()), k = "pour-os-v2.progSync";
    let last = ""; try { last = localStorage.getItem(k) || ""; } catch (e) { /* 저장소 막힘 → 매번 */ }
    if (isMaster(cu) && last !== today) syncProgress(D).then((n) => { try { localStorage.setItem(k, today); } catch (e) { /* 무시 */ } console.log(`[v2] 프로젝트 진척 다시 계산 · 바뀐 것 ${n}개`); }).catch((e) => console.error("[v2] 프로젝트 진척 다시 계산 실패:", e)); }, [meta, D.ready, authed]);
  useLaunchSync(D, cu, !!(meta && D.ready && authed));
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
      const all = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted);
      const pct = all.length ? Math.round((all.filter(isDone).length / all.length) * 100) : 0;
      if (Number(p.progress) !== pct) { changed++; await fb.patch("projects", p._doc || p.id, { progress: pct, updatedAt: nowIso(), v2At: nowIso() }); } }));
  }
  return changed;
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
    let t = null; const un = fb.listenLaunch((items) => { clearTimeout(t); t = setTimeout(() => run(items), 1200); });
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
    const tasks = (D.tasks || []).filter((t) => t.projectId === proj.id && !secretOn(t)), now = nowIso(), pl = planLaunchPush(p, proj, tasks, D.users, now, cu.name);
    if (!pl.board) continue;
    const day = "launch-" + ymd(new Date()); if (lbBackup !== day) { await fb.backupLaunch(day, prods, cu.name, true); lbBackup = day; }
    const by = `${cu.name} (${LB_BY})`, said = pl.board.said;
    const fields = { ...pl.board.fields, ...(said.length ? { updatedAt: now, updatedBy: by, history: fb.arrayUnion({ at: now, by, text: "업무OS에서 · " + said.join(", ").slice(0, 200) }) } : {}) };
    const r = await fb.patchLaunchIf([{ id: p.id, fields, expect: pl.board.expect }]);
    if (!r.done) continue;
    const ops = pl.tasks.filter((x) => JSON.stringify(x.lbSeen) !== JSON.stringify(x.t.lbSeen)).map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { lbSeen: x.t.lbSeen || null }, fields: { lbSeen: x.lbSeen } }));
    if (ops.length) await fb.patchManyIf(ops);
    if (pl.project) await fb.patchIf("projects", proj._doc || proj.id, { lbSeen: proj.lbSeen || null }, { lbSeen: pl.project.lbSeen });
    if (said.length) n++;
  }
  if (n) console.log(`[v2] 신제품 대시보드에 반영 · 제품 ${n}개`);
  return { n };
}
export async function syncLaunchBoard(prods, D, cu) {
  const today = ymd(new Date()); let made = 0, changed = 0;
  const live = (prods || []).filter((p) => p && p.name && !p.deletedAt);
  if (live.some((p) => !(D.projects || []).some((x) => x.id === "lb_" + p.id))) made = await syncNewLaunch(D, cu);
  // 4단계 휴지통: 신제품 대시보드에서 지운 제품 → 업무OS 프로젝트 중단(지우지 않음) · 되살리면 다시 열기 (표시 lbTrash 로 한 번만)
  for (const p of (prods || []).filter((x) => x && x.name)) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p.id); if (!proj || !!p.deletedAt === !!proj.lbTrash) continue;
    const tasks = (await fb.fetchWhere("tasks", ["projectId", "==", proj.id])).filter((t) => !t.deleted), now = nowIso(), tr = planLaunchTrash(p, proj, tasks, now); if (!tr) continue;
    const r = await fb.patchIf("projects", proj._doc || proj.id, { lbTrash: proj.lbTrash || null, status: proj.status || null }, { ...tr.project, updatedAt: now, updatedBy: "board",
      ...(tr.label ? { endLog: fb.arrayUnion({ kind: p.deletedAt ? "dropped" : "resume", why: tr.label, at: now, by: "board", byName: "신제품 대시보드" }) } : {}) });
    if (!r.ok) continue;
    if (tr.tasks.length) await fb.patchManyIf(tr.tasks.map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { status: x.t.status || null }, fields: { ...x.fields, updatedAt: now, updatedBy: "board", statusLog: fb.arrayUnion({ by: "board", byName: "신제품 대시보드", at: now, status: x.fields.status }) } })));
    if (tr.label) { const id = newId("lg"); await fb.put("log", id, { id, action: "projEnd", col: "projects", targetId: proj.id, projectId: proj.id, by: "board", byName: "신제품 대시보드", at: now, label: `${p.name} · 신제품 대시보드 ${tr.label}${tr.tasks.length ? ` · 업무 ${tr.tasks.length}건` : ""}` }); changed++; }
  }
  for (const p of live) {
    const proj = (D.projects || []).find((x) => x.id === "lb_" + p.id); if (!proj) continue;
    const ver = p.updatedAt || p.createdAt || "x"; if (proj.lbSyncedAt === ver && (p.project || "") === (proj.lbProject || "")) continue;   // 하위 프로젝트는 처음 한 번 따라잡기
    const tasks = (await fb.fetchWhere("tasks", ["projectId", "==", proj.id])).filter((t) => !t.deleted);
    const now = nowIso(), pl = planLaunchSync(p, proj, tasks, D.users, today, now, prods.structure);
    const ops = pl.tasks.map((x) => ({ key: "tasks", id: x.t._doc || x.t.id, expect: { lbSeen: x.t.lbSeen || null, v2At: x.t.v2At || null },
      fields: { ...x.fields, updatedAt: now, updatedBy: "board", ...(x.fields.status && x.fields.status !== x.t.status ? { statusLog: fb.arrayUnion({ by: "board", byName: "신제품 대시보드", at: now, status: x.fields.status }) } : {}) } }));
    const r = ops.length ? await fb.patchManyIf(ops) : { done: 0, skipped: [] };
    // 다 들어갔을 때만 '여기까지 맞춤' 표시 → 건너뛴 업무가 있으면 다음 신호 때 다시
    await fb.patchIf("projects", proj._doc || proj.id, { lbSyncedAt: proj.lbSyncedAt || null }, { ...(pl.project ? pl.project.fields : {}), ...(r.skipped.length ? {} : { lbSyncedAt: ver }), updatedAt: now });
    const real = pl.tasks.filter((x) => x.label && !r.skipped.includes(x.t._doc || x.t.id));
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
  const have0 = new Set((D.projects || []).map((p) => p.id));
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
export function Gate({ B, title }) {
  if (B.meta === undefined) return <Splash title={title} text={B.metaErr || "불러오는 중…"} retry={B.metaErr ? B.checkMeta : null} />;
  if (B.meta === null) return <SeedGate onDone={B.setMeta} />;
  if (B.err) return <Splash title={title} text={B.err} />;
  if (!B.D.ready) return <Splash title={title} text="불러오는 중…" />;
  if (!B.authed) return <Login D={B.D} title={title} preset={B.cu && B.cu.active !== false ? B.cu : null} onIn={B.signIn} />;
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
export function Login({ D, preset, onIn, title }) {
  const [u, setU] = useState(preset);
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [p3, setP3] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [lock, setLock] = useLocal(LS("pinlock"), {});
  const users = activeUsers(D.users).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const only4 = (s) => s.replace(/\D/g, "").slice(0, 4);
  const ref = useRef(null); useEffect(() => { if (u && ref.current) ref.current.focus(); }, [u]);
  if (!u) return <div className="v2-center">
    <div style={{ width: "min(520px, 100%)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 6px" }}>이 기기를 쓰는 사람을 골라 주세요</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px", lineHeight: 1.6 }}>체크와 댓글이 이 이름으로 남아요. 다른 사람 일은 달력 오른쪽 위 [나 ▾]에서 봐요.</p>
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
          return setMsg(n >= 5 ? "5번 틀려서 5분 동안 잠겼어요" : `시작 코드가 맞지 않아요 (${n}/5) · 마스터에게 받은 4자리를 넣어 주세요`); } }
      const h = pinHash(u.id, p1); setBusy(true);
      // 아직 PIN 이 없고 시작 코드가 그대로일 때만 저장 (다른 기기에서 먼저 정했으면 막음)
      try { const r = await fb.patchIf("users", u._doc || u.id, { pinHash: null, pinInvite: u.pinInvite || null }, { pinHash: h, pinSetAt: nowIso(), pinByCode: !!u.pinInvite, pinInvite: null });
        if (r.ok) onIn(u, h); else setMsg("다른 기기에서 방금 PIN을 정했어요 · 본인이 아니면 마스터에게 PIN 초기화를 부탁하세요"); }
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
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 6px", lineHeight: 1.6 }}>{setMode ? (u.pinInvite ? "처음이에요. 마스터에게 받은 시작 코드와 내가 쓸 PIN 4자리를 넣어 주세요." : "처음이에요. 내 이름으로만 쓰도록 PIN 4자리를 정해 주세요. 정하면 마스터에게 알림이 가요.") : "PIN 4자리를 넣어 주세요. 잊었다면 마스터에게 초기화를 부탁하세요."}</p>
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
    try { const all = (await fb.fetchWhere("tasks", ["projectId", "==", pid])).filter((t) => !t.isFixed && !t.deleted);
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
        ...(Array.isArray(f.deps) ? { deps: f.deps } : {}), ...(f.extra || {}), v2At: at,
        requestedBy: cu.id, requestedAt: at, createdAt: at, createdBy: cu.id, statusLog: [{ by: cu.id, byName: cu.name, at, status: "todo" }], madeIn: "v2" };
      try { await fb.put("tasks", id, t); } catch (e) { fail("업무")(e); return null; }
      log("add", { col: "tasks", targetId: id, projectId: t.projectId, label: t.title + (who !== cu.id ? ` → ${nameOf(D.users, who)}` : "") });
      if (t.projectId) recalc(t.projectId);
      return t;
    },
    // 끝냈어요 — 맡긴 사람이 있으면 확인 요청, 아니면 바로 끝
    // note: 다음 사람에게 한마디(있으면 handoff 댓글로 남김 → 뒷사람 '지금 할 일' 카드의 '앞 일 마지막 말')
    finish: (t, note) => {
      const at = nowIso(), prev = { status: t.status, doneAt: t.doneAt || null, reviewAt: t.reviewAt || null, finishedAt: t.finishedAt || null, feedback: t.feedback || null, blocked: t.blocked || null, ackAt: t.ackAt || null };
      const nx = idx ? nextTurnText(t, idx, D.users) : { text: "" };
      if (note && note.trim()) A.addNote(taskNoteId(t.id), note.trim(), null, [], { taskId: t.id, projectId: t.projectId }, { handoff: true });
      const lead = ((D.projects || []).find((p) => p.id === t.projectId) || {}).assigneeId;
      const tail = nx.text ? ` · ${nx.text}` : nx.noOwner ? ` · 다음 일 담당이 없어서 ${lead && lead !== cu.id ? `책임자 ${nameOf(D.users, lead)}님께 알렸어요` : "담당을 정해 주세요"}` : "";
      if (needsReview(t)) {
        const f = { status: "review", reviewAt: at, reviewTo: reqOf(t), finishedAt: at, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) };
        P(t, { ...f, statusLog: sl("review") }, "review");
        setToast({ text: `${nameOf(D.users, reqOf(t))}님께 확인 요청을 보냈어요${tail}`, undo: () => undoT(t, f, prev, `${t.title} · 확인 요청 취소`) });
      } else {
        const f = { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, finishedAt: at, feedback: null, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }) };
        P(t, { ...f, statusLog: sl("done") }, "done").then(() => t.projectId && recalc(t.projectId));
        setToast({ text: `끝냈어요${tail || " · " + t.title}`, undo: () => undoT(t, f, prev, `${t.title} · 끝냄 취소`) });
      }
    },
    // 확인 완료 → 담당 '확인할 것'에 '확인 완료'(approvedAt) · 5초 되돌리기 (확인 대기로)
    approve: (t) => { const at = nowIso(), o = ownersOf(t)[0];
      const f = { status: "done", doneAt: t.finishedAt || at, doneBy: o || cu.id, doneByName: nameOf(D.users, o) || cu.name, approvedBy: cu.id, approvedAt: at, feedback: null }, prev = { ...prevOf(t, f), statusLog: t.statusLog || [] };
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
      if (kind !== "completed") { try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted && !isDone(t) && t.status !== "dropped" && !(kind === "hold" && t.status === "hold")); }
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
      try { ts = (await fb.fetchWhere("tasks", ["projectId", "==", p.id])).filter((t) => !t.isFixed && !t.deleted && ((dropped && t.status === "dropped") || (held && t.status === "hold" && t.holdBy === "proj"))); }
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
        if (!isDone(t) && t.status !== "review") A.finish(t);   // 끝냄 알림은 아래 '정했어요' 알림으로 바뀜 (다음 차례 문구는 같이)
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
    addFiles: async (t, files) => { try { const up = []; for (const f of files) up.push(await fb.upload("task-" + t.id, f));
      await fb.patch("tasks", tdoc(t), { attachments: fb.arrayUnion(...up.map((x) => ({ ...x, by: cu.id, byName: cu.name }))), updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }); log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 파일 ${up.length}개 올림` }); setToast({ text: `파일 ${up.length}개 올렸어요` }); }
      catch (e) { fail("파일")(e); } },
    // 고정업무 체크 — 내 칸만 바꾸고, 체크 기록(누가 몇 시)을 따로 남김
    fxToggle: (t) => {
      const key = ymd(new Date()), at = nowIso(), on = !fxMeDone(t, cu.id, key);
      fb.patch("tasks", tdoc(t), { ...fxCheckPatch(t, cu.id, on, key, at, cu.name), v2At: at }).catch(fail("체크"));
      fb.put("checks", `${t.id}~${cu.id}~${key}`, { taskId: t.id, uid: cu.id, name: cu.name, date: key, at, on }).catch(fail("체크 기록"));
      if (on) setToast({ text: `체크했어요 · ${fxLabel(t, cu.id)}`, undo: () => { fb.patch("tasks", tdoc(t), { ...fxCheckPatch(t, cu.id, false, key, at, cu.name), v2At: nowIso() }).catch(fail("되돌리기")); fb.put("checks", `${t.id}~${cu.id}~${key}`, { taskId: t.id, uid: cu.id, name: cu.name, date: key, at, on: false }); } });
    },
    fxSub: (t, subId) => { const key = ymd(new Date()); const cur = (((t.subDone || {})[cu.id]) || {})[subId]; fb.patch("tasks", tdoc(t), { [`subDone.${cu.id}.${subId}`]: fxHit(t, cur, key) ? null : key, v2At: nowIso() }).catch(fail("체크")); },
    addNote: async (itemId, text, parentId, files, ctx, extra) => {
      const id = newId("n"); const up = [];
      try { for (const f of files || []) up.push(await fb.upload("note-" + itemId, f));
        await fb.put("notes", id, { id, itemId, parentId: parentId || null, text: text.trim(), files: up, ...by(), madeIn: "v2", ...(extra || {}) });
        log("comment", { col: "notes", targetId: ctx && ctx.taskId ? ctx.taskId : itemId, projectId: (ctx && ctx.projectId) || "", label: text.trim().slice(0, 60) }); return true; }
      catch (e) { fail("댓글")(e); return false; }
    },
    addProject: async (f) => {
      const id = newId("p"), at = nowIso();
      const p = { id, title: f.title.trim(), assigneeId: f.assigneeId || cu.id, collaboratorIds: [], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", dueDate: f.dueDate || "", brand: f.brand || "", group: "기타", ...(f.category ? { category: f.category } : {}), createdAt: at, createdBy: cu.id, madeIn: "v2" };
      try { await fb.put("projects", id, p); } catch (e) { fail("프로젝트")(e); return null; }
      log("add", { col: "projects", targetId: id, projectId: id, label: p.title });
      for (const tt of (f.tasks || []).filter((x) => x.trim())) await A.addTask({ title: tt, projectId: id, assigneeId: cu.id, dueDate: f.dueDate || "" });
      return p;
    },
    // 기밀 (secret.js): sec = { allow:[id] } 이면 켜기 · null 이면 풀기 — 정하는 사람(by)은 늘 볼 수 있음
    setSecret: (kind, x, sec) => { const f = { secret: sec ? { on: true, allow: sec.allow || [], by: cu.id, byName: cu.name, at: nowIso() } : null }, label = sec ? `기밀 설정 (볼 사람 ${(sec.allow || []).length}명 더)` : "기밀 풀기";
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
        const all = await fb.fetchWhere("tasks", ["projectId", "==", p.id]); const ch = relaunch(all, date, key);
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
export const v2edited = (x) => !!(x && (x.v2At || (x.updatedBy && x.updatedBy !== "board") || x.madeIn === "v2" || (x.memoAt && x.memoByName !== "신제품 대시보드") || x.ackBy
  || (Array.isArray(x.attachments) && x.attachments.some((a) => a && V2_FILE.test(String(a.path || ""))))));
// 이미 있는 문서에 덮어쓸 때 빼는 칸 — v2 가 주인인 칸(PIN · 주 한도 · 고정업무 사람별 체크)
//   고정업무 체크(doneDates·doneAtBy·subDone)는 버전1에도 같은 이름이 있어서 '고친 문서' 판단에는 못 쓰고, 대신 덮어쓰지 않음
export function stripV2Only(key, data, cur) {
  if (!data) return data; const d = { ...data };
  if (key === "users") Object.keys(d).forEach((f) => { if (/^pin/.test(f) || f === "weekCap") delete d[f]; });
  if (key === "tasks") { ["doneDates", "doneAtBy", "subDone"].forEach((f) => delete d[f]); if ((cur && cur.isFixed) || d.isFixed) ["doneAt", "doneByName"].forEach((f) => delete d[f]); }
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
