// 업무OS v2 — 두 앱(실사용 os2.html · 관리자 os2-admin.html)이 함께 쓰는 바탕:
// 데이터 구독 · 첫 복사 · 로그인(사람별 PIN) · 저장 동작(바뀐 칸만)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { pinHash } from "./sha.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover,
} from "./model.js";
import { planLaunchImport, relaunch, isTempOwner } from "./launch.js";
import { nextTurnText } from "./turn.js";
import { flowOwners } from "./flow.js";
import { C, Big, TBtn, inp, useLocal } from "./ui.jsx";

export const V1_URL = "./os.html";
export const LS = (k) => "pour-os2-" + k;   // v1(pour-os-…) 과 겹치지 않는 기기 저장 이름
export const nowIso = () => new Date().toISOString();

// ───────────────── 데이터 구독 ─────────────────
export function useData(on) {
  const [S, setS] = useState({ users: null, projects: [], openT: [], doneT: [], notes: [], log: [], events: [], brands: [], workflows: [] });
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
    ];
    return () => subs.forEach((u) => u && u());
  }, [on]);
  const D = useMemo(() => {
    const m = new Map(); S.doneT.forEach((t) => m.set(t.id, t)); S.openT.forEach((t) => m.set(t.id, t));
    return { users: S.users || [], projects: S.projects, tasks: [...m.values()], notes: S.notes, log: S.log, events: S.events, brands: S.brands, workflows: S.workflows, ready: !!S.users };
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
  return { meta, setMeta, metaErr, checkMeta, D, err, cu, authed, signIn: (u, h) => { setMe(u.id); setKey(h); }, logout: () => { setKey(""); setMe(""); } };
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
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
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
      const h = pinHash(u.id, p1); setBusy(true);
      try { await fb.patch("users", u._doc || u.id, { pinHash: h, pinSetAt: nowIso() }); onIn(u, h); }
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
      <TBtn onClick={() => { setU(null); setP1(""); setP2(""); setMsg(""); }} style={{ alignSelf: "flex-start", paddingLeft: 0 }}>‹ 다른 사람 고르기</TBtn>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: 0 }}>{u.name}</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 6px", lineHeight: 1.6 }}>{setMode ? "처음이에요. 내 이름으로만 쓰도록 PIN 4자리를 정해 주세요." : "PIN 4자리를 넣어 주세요. 잊었다면 마스터에게 초기화를 부탁하세요."}</p>
      <input ref={ref} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={p1} disabled={locked} onChange={(e) => { setP1(only4(e.target.value)); setMsg(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="PIN 4자리" aria-label="PIN" style={{ ...inp, fontSize: 20, letterSpacing: 8, textAlign: "center" }} />
      {setMode && <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={p2} onChange={(e) => { setP2(only4(e.target.value)); setMsg(""); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="한 번 더" aria-label="PIN 확인" style={{ ...inp, fontSize: 20, letterSpacing: 8, textAlign: "center" }} />}
      {msg && <p role="alert" style={{ margin: 0, color: C.red, fontSize: 13.5, fontWeight: 700 }}>{msg}</p>}
      <Big onClick={submit} disabled={busy || locked || p1.length !== 4 || (setMode && p2.length !== 4)}>{setMode ? "PIN 정하고 시작" : "시작"}</Big>
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
    try { const all = (await fb.fetchWhere("tasks", ["projectId", "==", pid])).filter((t) => !t.isFixed);
      const pct = all.length ? Math.round((all.filter(isDone).length / all.length) * 100) : 0;
      if (Number(p.progress) !== pct) await fb.patch("projects", p._doc || p.id, { progress: pct, updatedAt: nowIso(), v2At: nowIso() }); }
    catch (e) { console.error("[v2] 진척 계산 실패:", e); }
  };
  // v2At: v2 에서 고친 표시 (다시 가져오기가 v2 에서 정리한 담당·기한을 덮지 않게)
  // extra: 기록에 더 남길 칸(예: prev 이전 값)
  const P = (t, f, logAction, label, extra) => fb.patch("tasks", tdoc(t), { ...f, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }).then(() => { if (logAction) log(logAction, { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: label || t.title, ...(extra || {}) }); }).catch(fail("업무"));
  // 이전 값 (없던 칸은 null) — 되돌리기·기록용
  const prevOf = (t, f) => Object.fromEntries(Object.keys(f).map((k) => [k, t[k] === undefined ? null : t[k]]));
  const A = {
    log, recalc, patchTask: P,
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
        P(t, { status: "review", reviewAt: at, reviewTo: reqOf(t), finishedAt: at, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }), statusLog: sl("review") }, "review");
        setToast({ text: `${nameOf(D.users, reqOf(t))}님께 확인 요청을 보냈어요${tail}`, undo: () => P(t, prev) });
      } else {
        P(t, { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, finishedAt: at, feedback: null, blocked: null, ...(t.ackAt ? {} : { ackAt: at, ackBy: cu.id }), statusLog: sl("done") }, "done").then(() => t.projectId && recalc(t.projectId));
        setToast({ text: `끝냈어요${tail || " · " + t.title}`, undo: () => P(t, prev).then(() => t.projectId && recalc(t.projectId)) });
      }
    },
    approve: (t) => { const at = nowIso(), o = ownersOf(t)[0];
      P(t, { status: "done", doneAt: t.finishedAt || at, doneBy: o || cu.id, doneByName: nameOf(D.users, o) || cu.name, approvedBy: cu.id, approvedAt: at, feedback: null, statusLog: sl("done", { approved: true }) }, "approve").then(() => t.projectId && recalc(t.projectId));
      setToast({ text: `확인 완료 · ${t.title}` }); },
    sendBack: (t, text) => { P(t, { status: "inprogress", feedback: { text, ...by() }, reviewAt: null, statusLog: sl("inprogress", { feedback: true }) }, "feedback", `${t.title} · ${text.slice(0, 40)}`);
      A.addNote(taskNoteId(t.id), "수정 요청: " + text, null, [], { taskId: t.id, projectId: t.projectId }); setToast({ text: "수정 요청을 보냈어요" }); },
    reopen: (t) => P(t, { status: "todo", doneAt: null, doneBy: null, doneByName: null, reviewAt: null, statusLog: sl("todo", { reopen: true }) }, "reopen").then(() => t.projectId && recalc(t.projectId)),
    setStatus: (t, s) => P(t, { status: s, statusLog: sl(s), ...(s === "inprogress" && !t.startedAt ? { startedAt: ymd(new Date()) } : {}), ...(s === "inprogress" && !t.ackAt ? { ackAt: nowIso() } : {}) }, "edit", `${t.title} · ${STATUS_L[s]}`),
    ack: (t) => { P(t, { ackAt: nowIso(), ackBy: cu.id }, "ack"); const w = nameOf(D.users, reqOf(t) || (t.assignedBy !== cu.id ? t.assignedBy : "")); setToast({ text: w ? `받았어요 · ${w}님 화면에 '받음'으로 보여요` : "받았어요" }); },
    ackMany: (ts) => { const at = nowIso(); fb.patchMany(ts.map((t) => ({ key: "tasks", id: tdoc(t), fields: { ackAt: at, ackBy: cu.id, updatedAt: at, updatedBy: cu.id, v2At: at } }))).catch(fail("받음")); if (ts[0]) log("ack", { col: "tasks", targetId: ts[0].projectId, projectId: ts[0].projectId, label: `항목 ${ts.length}개 받음` }); setToast({ text: `${ts.length}개 받았어요` }); },
    // 처음 맡긴 사람(requestedBy)은 그대로 — 확인·기한 허락은 그 사람. 맡긴 사람 기록이 없는 일(신제품 항목 등)은 assignedBy 로 '누가 넘겼나'만 남김
    //   남의 일을 내가 가져오면(이어서 하기) 5초 되돌리기 알림 — 확인 창 없이 한 번에, 대신 되돌릴 수 있게
    assign: (t, uid, take) => {
      const f = { assigneeId: uid, assigneeIds: [uid], ownerAuto: false, ownerFrom: "set", ...(reqOf(t) || t.requestedBy ? { requestedBy: reqOf(t) || t.requestedBy } : { assignedBy: cu.id, assignedAt: nowIso() }),
        ...(reqOf(t) || t.requestedBy ? { requestedAt: nowIso() } : {}), ackAt: take || uid === cu.id ? nowIso() : null };
      const was = ownersOf(t), other = was.find((x) => x !== cu.id), prev = prevOf(t, f);
      const r = P(t, f, take ? "take" : "assign", `${t.title} · ${nameOf(D.users, t.assigneeId) || "담당 없음"} → ${nameOf(D.users, uid)}`, { prev });
      if (uid === cu.id && other && !was.includes(cu.id)) setToast({ text: `${nameOf(D.users, other) || "다른 사람"}님 일을 내가 이어서 해요`, undo: () => P(t, prev, "assign", `되돌림 · ${t.title} · 담당 ${nameOf(D.users, other) || "이전"}`) });
      return r;
    },
    // 기한 바꾸기 — 버전1에서 온 작업일(workDate)도 같이 비움(기한 = dueDate || workDate 라서 '미정'이 안 먹던 문제). 이전 값은 기록에
    setDue: (t, d) => { const f = { dueDate: d || "", dueAuto: false, dueReq: null, ...(t.workDate ? { workDate: "" } : {}) };
      return P(t, f, "edit", `${t.title} · 기한 ${d ? md(d) : "미정"}`, { prev: { dueDate: t.dueDate || "", workDate: t.workDate || "", dueAuto: !!t.dueAuto } }); },
    // 앞 일 정하기 (deps: v1 과 같은 칸 · [] = 앞 일 없음)
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
      setToast({ text: `${label} · ${ts.length}건 바꿨어요`, undo: () => fb.patchMany(ops.map((o) => ({ key: o.key, id: o.id, fields: o.prev }))).then(() => log("bulk", { col: "tasks", label: `되돌림 · ${label}`, ids: ts.map((t) => t.id) })).catch(fail("되돌리기")) });
      return true;
    },
    // 기한 여러 개 한 번에 (최대 100건 · 이전 기한 기록 · 5초 되돌리기)
    applyDues: (changes, label) => {
      if (!changes.length) return Promise.resolve(false); if (changes.length > 100) { setToast({ text: "한 번에 100건까지예요" }); return Promise.resolve(false); }
      const at = nowIso(), prev = changes.map((x) => ({ id: tdoc(x.task), dueDate: x.task.dueDate || "" }));
      return fb.patchMany(changes.map((x) => ({ key: "tasks", id: tdoc(x.task), fields: { dueDate: x.due, updatedAt: at, updatedBy: cu.id, v2At: at } })))
        .then(() => { log("bulk", { col: "tasks", label: `${label} · ${changes.length}건`, ids: changes.map((x) => x.task.id), prev });
          setToast({ text: `${label} · ${changes.length}건`, undo: () => fb.patchMany(prev.map((x) => ({ key: "tasks", id: x.id, fields: { dueDate: x.dueDate, updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() } }))).then(() => log("bulk", { col: "tasks", label: `되돌림 · ${label}`, ids: changes.map((x) => x.task.id) })).catch(fail("되돌리기")) });
          return true; })
        .catch((e) => { fail("기한")(e); return false; });
    },
    requestDue: (t, date, reason) => { P(t, { dueReq: { date, reason: reason || "", ...by() }, ackAt: t.ackAt || nowIso() }, "dueReq", `${t.title} · ${md(dueOf(t)) || "미정"} → ${md(date)}`); setToast({ text: `${nameOf(D.users, dueApprover(t, D)) || "책임자"}님께 기한 조정을 요청했어요` }); },
    answerDue: (t, ok, reason) => { const r = t.dueReq || {};
      P(t, ok ? { dueDate: r.date, dueAuto: false, dueReq: null, dueReqResult: { ok: true, date: r.date, ...by() } } : { dueReq: null, dueReqResult: { ok: false, reason: reason || "", ...by() } }, ok ? "dueOk" : "dueNo", `${t.title} · ${ok ? "기한 " + md(r.date) : "기한 유지"}`);
      setToast({ text: ok ? `기한을 ${md(r.date)}로 바꿨어요` : "기한을 그대로 두었어요" }); },
    block: (t, reason) => { P(t, { blocked: { reason, ...by() } }, "block", `${t.title} · ${reason}`); A.addNote(taskNoteId(t.id), "막힘: " + reason, null, [], { taskId: t.id, projectId: t.projectId }); setToast({ text: "알렸어요 · 막힌 게 풀리면 '막힘 풀기'를 눌러요" }); },
    unblock: (t) => P(t, { blocked: null }, "unblock"),
    setMemo: (t, memo) => fb.patch("tasks", tdoc(t), { memo, memoBy: cu.id, memoByName: cu.name, memoAt: nowIso(), updatedAt: nowIso(), updatedBy: cu.id, v2At: nowIso() }).then(() => log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 메모 고침`, prev: String(t.memo || "").slice(0, 2000) })).catch(fail("메모")),
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
      const p = { id, title: f.title.trim(), assigneeId: f.assigneeId || cu.id, collaboratorIds: [], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", dueDate: f.dueDate || "", brand: f.brand || "", group: "기타", createdAt: at, createdBy: cu.id, madeIn: "v2" };
      try { await fb.put("projects", id, p); } catch (e) { fail("프로젝트")(e); return null; }
      log("add", { col: "projects", targetId: id, projectId: id, label: p.title });
      for (const tt of (f.tasks || []).filter((x) => x.trim())) await A.addTask({ title: tt, projectId: id, assigneeId: cu.id, dueDate: f.dueDate || "" });
      return p;
    },
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
        setToast({ text: `출시일을 바꿨어요 · 항목 ${ch.length}개 기한도 옮겼어요`, undo: () => { const u = nowIso();
          return fb.patchMany([{ key: "projects", id: pid, fields: { ...prevP, updatedAt: u, updatedBy: cu.id, v2At: u } }, ...prevT.map((x) => ({ key: "tasks", id: x.id, fields: { dueDate: x.dueDate, updatedAt: u, updatedBy: cu.id, v2At: u } }))])
            .then(() => log("edit", { col: "projects", targetId: p.id, projectId: p.id, label: `되돌림 · ${p.title} · 출시일 ${md(date)} → ${md(prevP.launchDate) || "미정"} · 항목 ${prevT.length}개`, ids: ch.map((x) => x.task.id) })).catch(fail("되돌리기")); } });
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
export const v2edited = (x) => !!(x && (x.v2At || x.updatedBy || x.madeIn === "v2" || x.memoAt || x.ackBy
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
