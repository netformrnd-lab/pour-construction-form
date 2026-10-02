// 업무OS v2 (시험판) — 탭 4개: 오늘 · 프로젝트 · 팀 · 더보기
// v1(os.html) 과 데이터가 완전히 분리되어 있다. 여기서 바꾼 것은 v1 에 반영되지 않는다.
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { pinHash } from "./sha.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
} from "./model.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";

export const BUILD = "v2-1단계 1002";
const V1_URL = "./os.html";
const LS = (k) => "pour-os2-" + k;   // v1(pour-os-…) 과 겹치지 않는 기기 저장 이름
const nowIso = () => new Date().toISOString();

// ───────────────── 데이터 구독 ─────────────────
function useData(on) {
  const [S, setS] = useState({ users: null, projects: [], openT: [], doneT: [], notes: [], log: [], events: [], brands: [] });
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
    ];
    return () => subs.forEach((u) => u && u());
  }, [on]);
  const D = useMemo(() => {
    const m = new Map(); S.doneT.forEach((t) => m.set(t.id, t)); S.openT.forEach((t) => m.set(t.id, t));
    return { users: S.users || [], projects: S.projects, tasks: [...m.values()], notes: S.notes, log: S.log, events: S.events, brands: S.brands, ready: !!S.users };
  }, [S]);
  return [D, err];
}

// ───────────────── 앱 ─────────────────
export default function App() {
  const [meta, setMeta] = useState(undefined);   // undefined=확인 중, null=아직 복사 전
  const [metaErr, setMetaErr] = useState("");
  const checkMeta = () => { setMetaErr(""); fb.getMeta().then(setMeta).catch((e) => { console.error("[v2] 복사 정보 확인 실패:", e); setMetaErr("서버에 연결하지 못했어요 · 인터넷 연결을 확인하고 다시 눌러 주세요"); }); };
  useEffect(checkMeta, []);
  const [D, err] = useData(!!meta);
  const [me, setMe] = useLocal(LS("me"), "");
  const [key, setKey] = useLocal(LS("key"), "");
  const cu = D.users.find((u) => u.id === me);
  const authed = cu && cu.active !== false && (cu.pinHash ? cu.pinHash === key : false);

  if (meta === undefined) return <Splash text={metaErr || "불러오는 중…"} retry={metaErr ? checkMeta : null} />;
  if (meta === null) return <SeedGate onDone={setMeta} />;
  if (err) return <Splash text={err} />;
  if (!D.ready) return <Splash text="불러오는 중…" />;
  if (!authed) return <Login D={D} preset={cu && cu.active !== false ? cu : null} onIn={(u, h) => { setMe(u.id); setKey(h); }} />;
  return <Main key={cu.id} D={D} cu={cu} meta={meta} setMeta={setMeta} logout={() => { setKey(""); setMe(""); }} />;
}

function Splash({ text, retry }) {
  return <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>커머스본부 업무OS v2</div>
    <div style={{ fontSize: 14, color: C.sub }}>{text}</div>
    {retry && <div style={{ width: 220 }}><Big onClick={retry}>다시 확인</Big></div>}
  </div>;
}

// 처음 한 번: v1 데이터를 읽기만 해서 v2 칸으로 복사
function SeedGate({ onDone }) {
  const [st, setSt] = useState({ step: "ask" });
  const run = async () => {
    try {
      setSt({ step: "read" });
      const v1 = await fb.readV1State(); const notes = await fb.readV1Notes();
      const { ops, counts } = planSeed(v1, notes);
      if (!(v1.users || []).length || !(v1.tasks || []).length) throw new Error("버전1 데이터가 비어 보여요 — 복사를 멈췄어요");
      setSt({ step: "write", n: 0, total: ops.length });
      await fb.putMany(ops, (n, total) => setSt({ step: "write", n, total }));
      const m = { seededAt: nowIso(), seededBy: "첫 실행", counts, from: "pour-os/state-*" };
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
function Login({ D, preset, onIn }) {
  const [u, setU] = useState(preset);
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [lock, setLock] = useLocal(LS("pinlock"), {});
  const users = activeUsers(D.users).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const only4 = (s) => s.replace(/\D/g, "").slice(0, 4);
  const ref = useRef(null); useEffect(() => { if (u && ref.current) ref.current.focus(); }, [u]);
  if (!u) return <div className="v2-center">
    <div style={{ width: "min(520px, 100%)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 6px" }}>이 기기를 쓰는 사람을 골라 주세요</h1>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px", lineHeight: 1.6 }}>체크와 댓글이 이 이름으로 남아요. 다른 사람 일은 팀 탭에서 보면 돼요.</p>
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
function useActs(D, cu, setToast) {
  const by = () => ({ by: cu.id, byName: cu.name, at: nowIso() });
  const fail = (what) => (e) => { console.error(`[v2] ${what} 실패:`, e); setToast({ text: `${what} 저장 실패 · 인터넷 연결을 확인해 주세요` }); };
  const log = (action, o) => { const id = newId("lg"); return fb.put("log", id, { id, action, ...by(), ...o }).catch(fail("기록")); };
  const tdoc = (t) => t._doc || t.id;
  const recalc = async (pid) => {
    if (!pid) return; const p = D.projects.find((x) => x.id === pid); if (!p || p.progressManual) return;
    try { const all = (await fb.fetchWhere("tasks", ["projectId", "==", pid])).filter((t) => !t.isFixed);
      const pct = all.length ? Math.round((all.filter(isDone).length / all.length) * 100) : 0;
      if (Number(p.progress) !== pct) await fb.patch("projects", p._doc || p.id, { progress: pct, updatedAt: nowIso() }); }
    catch (e) { console.error("[v2] 진척 계산 실패:", e); }
  };
  const A = {
    log,
    addTask: async (f) => {
      const id = newId("t"), at = nowIso(), p = D.projects.find((x) => x.id === f.projectId);
      const t = { id, title: f.title.trim(), isFixed: false, type: "general", status: "todo", assigneeId: f.assigneeId || cu.id, assigneeIds: [f.assigneeId || cu.id], projectId: f.projectId || "", parentId: f.parentId || null,
        dueDate: f.dueDate || "", workDate: "", memo: "", attachments: [], weekDay: null, weekSlot: null, priority: "mid", ...(p && p.brand ? { brand: p.brand } : {}),
        requestedBy: cu.id, requestedAt: at, createdAt: at, createdBy: cu.id, statusLog: [{ by: cu.id, byName: cu.name, at, status: "todo" }], madeIn: "v2" };
      try { await fb.put("tasks", id, t); } catch (e) { fail("업무")(e); return null; }
      log("add", { col: "tasks", targetId: id, projectId: t.projectId, label: t.title + (t.assigneeId !== cu.id ? ` → ${nameOf(D.users, t.assigneeId)}` : "") });
      if (t.projectId) recalc(t.projectId);
      return t;
    },
    patchTask: (t, f, logAction, label) => fb.patch("tasks", tdoc(t), { ...f, updatedAt: nowIso(), updatedBy: cu.id }).then(() => { if (logAction) log(logAction, { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: label || t.title }); }).catch(fail("업무")),
    setDone: (t, on) => {
      const at = nowIso(), prev = t.status;
      const f = on ? { status: "done", doneAt: at, doneBy: cu.id, doneByName: cu.name, statusLog: fb.arrayUnion({ by: cu.id, byName: cu.name, at, status: "done" }) }
        : { status: "todo", doneAt: null, doneBy: null, doneByName: null, statusLog: fb.arrayUnion({ by: cu.id, byName: cu.name, at, status: "todo", reopen: true }) };
      A.patchTask(t, f, on ? "done" : "reopen").then(() => t.projectId && recalc(t.projectId));
      setToast({ text: on ? `끝냈어요 · ${t.title}` : `다시 열었어요 · ${t.title}`, undo: () => A.patchTask(t, on ? { status: prev === "done" ? "todo" : prev, doneAt: null, doneBy: null, doneByName: null } : { status: "done", doneAt: t.doneAt || at, doneBy: t.doneBy || cu.id, doneByName: t.doneByName || cu.name }).then(() => t.projectId && recalc(t.projectId)) });
    },
    setStatus: (t, s) => A.patchTask(t, { status: s, statusLog: fb.arrayUnion({ by: cu.id, byName: cu.name, at: nowIso(), status: s }), ...(s === "inprogress" && !t.startedAt ? { startedAt: ymd(new Date()) } : {}) }, "edit", `${t.title} · ${STATUS_L[s]}`),
    assign: (t, uid, take) => A.patchTask(t, { assigneeId: uid, assigneeIds: [uid], requestedBy: cu.id, requestedAt: nowIso() }, take ? "take" : "assign", `${t.title} · ${nameOf(D.users, t.assigneeId) || "담당 없음"} → ${nameOf(D.users, uid)}`),
    setDue: (t, d) => A.patchTask(t, { dueDate: d || "" }, "edit", `${t.title} · 마감 ${d ? md(d) : "미정"}`),
    setMemo: (t, memo) => fb.patch("tasks", tdoc(t), { memo, memoBy: cu.id, memoByName: cu.name, memoAt: nowIso() }).then(() => log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 메모 고침`, prev: String(t.memo || "").slice(0, 2000) })).catch(fail("메모")),
    addFiles: async (t, files) => { try { const up = []; for (const f of files) up.push(await fb.upload("task-" + t.id, f));
      await fb.patch("tasks", tdoc(t), { attachments: fb.arrayUnion(...up.map((x) => ({ ...x, by: cu.id, byName: cu.name }))) }); log("edit", { col: "tasks", targetId: t.id, projectId: t.projectId || "", label: `${t.title} · 파일 ${up.length}개 올림` }); setToast({ text: `파일 ${up.length}개 올렸어요` }); }
      catch (e) { fail("파일")(e); } },
    // 고정업무 체크 — 내 칸만 바꾸고, 체크 기록(누가 몇 시)을 따로 남김
    fxToggle: (t) => {
      const key = ymd(new Date()), at = nowIso(), on = !fxMeDone(t, cu.id, key);
      fb.patch("tasks", tdoc(t), fxCheckPatch(t, cu.id, on, key, at, cu.name)).catch(fail("체크"));
      fb.put("checks", `${t.id}~${cu.id}~${key}`, { taskId: t.id, uid: cu.id, name: cu.name, date: key, at, on }).catch(fail("체크 기록"));
      if (on) setToast({ text: `체크했어요 · ${fxLabel(t, cu.id)}`, undo: () => { fb.patch("tasks", tdoc(t), fxCheckPatch(t, cu.id, false, key, at, cu.name)); fb.put("checks", `${t.id}~${cu.id}~${key}`, { taskId: t.id, uid: cu.id, name: cu.name, date: key, at, on: false }); } });
    },
    fxSub: (t, subId) => { const key = ymd(new Date()); const cur = (((t.subDone || {})[cu.id]) || {})[subId]; fb.patch("tasks", tdoc(t), { [`subDone.${cu.id}.${subId}`]: fxHit(t, cur, key) ? null : key }).catch(fail("체크")); },
    addNote: async (itemId, text, parentId, files, ctx) => {
      const id = newId("n"); const up = [];
      try { for (const f of files || []) up.push(await fb.upload("note-" + itemId, f));
        await fb.put("notes", id, { id, itemId, parentId: parentId || null, text: text.trim(), files: up, ...by(), madeIn: "v2" });
        log("comment", { col: "notes", targetId: ctx && ctx.taskId ? ctx.taskId : itemId, projectId: (ctx && ctx.projectId) || "", label: text.trim().slice(0, 60) }); return true; }
      catch (e) { fail("댓글")(e); return false; }
    },
    addProject: async (f) => {
      const id = newId("p"), at = nowIso();
      const p = { id, title: f.title.trim(), assigneeId: f.assigneeId || cu.id, collaboratorIds: [], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", dueDate: f.dueDate || "", brand: f.brand || "", group: "기타", createdAt: at, createdBy: cu.id, madeIn: "v2" };
      try { await fb.put("projects", id, p); } catch (e) { fail("프로젝트")(e); return null; }
      log("add", { col: "projects", targetId: id, projectId: id, label: p.title });
      for (const tt of (f.tasks || []).filter((x) => x.trim())) await A.addTask({ title: tt, projectId: id, assigneeId: cu.id });
      return p;
    },
    patchProject: (p, f, label, prev) => fb.patch("projects", p._doc || p.id, { ...f, updatedAt: nowIso(), updatedBy: cu.id }).then(() => log("edit", { col: "projects", targetId: p.id, projectId: p.id, label: `${p.title} · ${label}`, ...(prev != null ? { prev } : {}) })).catch(fail("프로젝트")),
    recalc,
  };
  return A;
}

// ───────────────── 메인 화면 ─────────────────
function Main({ D, cu, meta, setMeta, logout }) {
  const [tab, setTab] = useLocal(LS("tab-" + cu.id), "today");   // 사람마다 마지막 탭 기억
  const [stack, setStack] = useState([]);   // 열린 시트들 [{type, id, ...}]
  const [toast, setToast] = useState(null);
  const [seen, setSeen] = useLocal(LS("seen-" + cu.id), {});
  const A = useActs(D, cu, setToast);
  const open = (s) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => st.slice(0, -1));
  const closeAll = () => setStack([]);
  const now = new Date();
  const TV = useMemo(() => todayView(D, cu.id, new Date(), seen), [D, cu.id, seen]);
  const ctx = { D, cu, A, open, back, closeAll, seen, setSeen, setToast, TV, meta, setMeta, logout, setTab };
  const top = stack[stack.length - 1];
  const TABS = [["today", "오늘"], ["projects", "프로젝트"], ["team", "팀"], ["more", "더보기"]];
  return <div className="v2-app">
    <nav className="v2-nav" aria-label="메뉴">
      <div className="v2-brand">업무OS <span style={{ color: C.mute, fontWeight: 700 }}>v2</span></div>
      {TABS.map(([k, l]) => <button key={k} type="button" className={"v2-tab" + (tab === k ? " on" : "")} aria-current={tab === k ? "page" : undefined} onClick={() => { setTab(k); closeAll(); window.scrollTo(0, 0); }}>
        {l}{k === "today" && TV.inbox.length > 0 && <span className="v2-badge">{TV.inbox.length}</span>}
      </button>)}
    </nav>
    <div className="v2-main">
      <div className="v2-trial">시험판 v2 · 여기서 바꾼 건 버전1에 반영되지 않아요 <a href={V1_URL}>버전1 열기 ›</a></div>
      <div className="v2-page">
        {tab === "today" && <TodayTab {...ctx} />}
        {tab === "projects" && <ProjectsTab {...ctx} />}
        {tab === "team" && <TeamTab {...ctx} />}
        {tab === "more" && <MoreTab {...ctx} />}
      </div>
    </div>
    {top && <SheetRouter s={top} {...ctx} depth={stack.length} />}
    <Toast toast={toast} onDone={() => setToast(null)} />
  </div>;
}

function SheetRouter({ s, depth, ...ctx }) {
  const p = { ...ctx, onBack: depth > 1 ? ctx.back : null, onClose: ctx.closeAll };
  if (s.type === "task") return <TaskSheet {...p} id={s.id} />;
  if (s.type === "fixed") return <FixedSheet {...p} id={s.id} />;
  if (s.type === "project") return <ProjectSheet {...p} id={s.id} first={s.first} />;
  if (s.type === "person") return <PersonSheet {...p} id={s.id} />;
  if (s.type === "add") return <AddSheet {...p} preset={s.preset || {}} />;
  if (s.type === "newProject") return <NewProjectSheet {...p} />;
  if (s.type === "mine") return <MineSheet {...p} />;
  if (s.type === "issues") return <IssuesSheet {...p} />;
  if (s.type === "doneProjects") return <DoneProjectsSheet {...p} />;
  return null;
}
const openTask = (open, t) => open({ type: t.isFixed ? "fixed" : "task", id: t.id });

// ───────────────── 오늘 ─────────────────
function TodayTab({ D, cu, A, open, TV, seen, setSeen }) {
  const now = new Date();
  const [showFxDone, setShowFxDone] = useState(false), [allInbox, setAllInbox] = useState(false);
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  const nextFx = TV.fixed.left.find((x) => !x.late && x.min < 9999);
  const inbox = allInbox ? TV.inbox : TV.inbox.slice(0, 3);
  const openInbox = (x) => { setSeen((s) => ({ ...s, [x.id]: true })); if (x.taskId) { const t = D.tasks.find((y) => y.id === x.taskId); t ? openTask(open, t) : open({ type: "task", id: x.taskId }); } else if (x.projectId) open({ type: "project", id: x.projectId, first: "news" }); };
  return <>
    <header style={{ padding: "14px 2px 2px" }}>
      <div style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>{dayTitle(now)} · {cu.name}</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 800, color: C.ink }}>남은 일 {TV.left} · 끝낸 일 {TV.doneToday}</h1>
      {nextFx && <div style={{ fontSize: 13.5, color: C.sub }}>다음: {fxTime(nextFx.t, cu.id)} {fxLabel(nextFx.t, cu.id)}</div>}
    </header>
    <div className="v2-cols">
      <div>
        <Head right={TV.inbox.length > 0 && <TBtn tone="mute" onClick={() => setSeen((s) => ({ ...s, ...Object.fromEntries(TV.inbox.map((x) => [x.id, true])) }))}>모두 확인</TBtn>}>확인할 것 {TV.inbox.length}</Head>
        <Card>
          {TV.inbox.length === 0 && <Empty>새로 온 일이나 댓글이 없어요</Empty>}
          {inbox.map((x, i) => <Row key={x.id} tag={x.tag} title={x.title} sub={`${x.whoName || TV.userName(x.who) || "누군가"} · ${ago(x.at, now)}${x.text ? " · " + x.text : ""}`} onClick={() => openInbox(x)} right={<Act onClick={() => openInbox(x)}>보기</Act>} last={i === inbox.length - 1 && TV.inbox.length <= 3} />)}
          {TV.inbox.length > 3 && <More onClick={() => setAllInbox(!allInbox)}>{allInbox ? "접기 ▴" : `${TV.inbox.length}개 모두 보기 ▾`}</More>}
        </Card>
        <Head>오늘 고정업무 {TV.fixed.done.length}/{TV.fixed.total}</Head>
        <Card>
          {TV.fixed.total === 0 && <Empty>오늘 할 고정업무가 없어요</Empty>}
          {TV.fixed.left.map((x, i) => { const t = x.t, [a, b] = fxCount(D.users, t, TV.key), subs = fxSubs(t, cu.id);
            return <Row key={t.id} tag={x.late ? "지남" : null} tagTone="red" title={fxLabel(t, cu.id)} sub={[fxTime(t, cu.id) || "시간 상관없음", t.recurType && t.recurType !== "daily" ? fxRecurL(t) : "", b > 1 ? `${a}/${b}명` : "", subs.length ? `체크리스트 ${subs.length}개` : ""].filter(Boolean).join(" · ")}
              onClick={() => open({ type: "fixed", id: t.id })} right={<Act onClick={() => A.fxToggle(t)}>완료</Act>} last={i === TV.fixed.left.length - 1 && !TV.fixed.done.length} />; })}
          {TV.fixed.done.length > 0 && <More onClick={() => setShowFxDone(!showFxDone)}>{showFxDone ? "끝낸 일 접기 ▴" : `끝낸 일 ${TV.fixed.done.length} ▾`}</More>}
          {showFxDone && TV.fixed.done.map((x) => <Row key={x.t.id} dim title={fxLabel(x.t, cu.id)} sub={`✓ ${hm(x.t.doneAtBy && x.t.doneAtBy[cu.id])}`} onClick={() => open({ type: "fixed", id: x.t.id })} right={<Act on onClick={() => A.fxToggle(x.t)}>✓ 취소</Act>} />)}
        </Card>
      </div>
      <div>
        <Head right={<TBtn onClick={() => open({ type: "mine" })}>내 할 일 모두 ›</TBtn>}>할 일 {TV.focus.length}</Head>
        <Card>
          {TV.focus.length === 0 && <Empty>급한 할 일이 없어요{TV.todo.length ? ` · 나머지 ${TV.todo.length}개는 '내 할 일 모두'에서 볼 수 있어요` : ""}</Empty>}
          {TV.focus.slice(0, 8).map((x, i) => { const t = x.t;
            return <Row key={t.id} tag={x.r === 0 ? ddayLabel(x.n) : x.r === 1 ? "진행 중" : x.r === 2 ? "오늘" : ddayLabel(x.n)} tagTone={x.r === 0 ? "red" : null} title={t.title}
              sub={[pName(t.projectId), t.requestedBy && t.requestedBy !== cu.id ? `${nameOf(D.users, t.requestedBy)}님이 맡김` : ""].filter(Boolean).join(" · ") || null} onClick={() => open({ type: "task", id: t.id })} right={<Act onClick={() => A.setDone(t, true)}>완료</Act>} last={i === Math.min(8, TV.focus.length) - 1 && TV.focus.length <= 8} />; })}
          {TV.focus.length > 8 && <More onClick={() => open({ type: "mine" })}>{TV.focus.length - 8}개 더 · 내 할 일 모두 ›</More>}
        </Card>
      </div>
    </div>
    <div className="v2-fab"><Big onClick={() => open({ type: "add" })}>+ 할 일 추가</Big></div>
  </>;
}

// 할 일 추가 (하나로 통일)
function AddSheet({ D, cu, A, onBack, onClose, preset, setToast }) {
  const [title, setTitle] = useState(""), [who, setWho] = useState(preset.assigneeId || cu.id), [when, setWhen] = useState(preset.dueDate ? "date" : "today"), [date, setDate] = useState(preset.dueDate || "");
  const [pid, setPid] = useState(preset.projectId || ""), [keep, setKeep] = useState(false), [busy, setBusy] = useState(false);
  const ref = useAutoFocus();
  const today = ymd(new Date()), fri = (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return ymd(d); })();
  const due = when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : when === "week" ? fri : when === "date" ? date : "";
  const users = activeUsers(D.users);
  const recent = useMemo(() => { const c = {}; D.tasks.forEach((t) => { if (t.requestedBy === cu.id && t.assigneeId && t.assigneeId !== cu.id) c[t.assigneeId] = Math.max(c[t.assigneeId] || 0, Date.parse(t.requestedAt || 0) || 0); });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id]) => users.find((u) => u.id === id)).filter(Boolean).slice(0, 5); }, [D.tasks]);
  const quick = [cu, ...recent.filter((u) => u.id !== cu.id)];
  if (who && !quick.some((u) => u.id === who)) { const u = users.find((x) => x.id === who); if (u) quick.push(u); }
  const myProj = D.projects.filter((p) => projOpen(p) && projMine(p, cu.id, D.tasks)).slice(0, 4);
  if (pid && !myProj.some((p) => p.id === pid)) { const p = D.projects.find((x) => x.id === pid); if (p) myProj.unshift(p); }
  const other = who !== cu.id;
  const save = async () => { if (!title.trim() || busy) return; setBusy(true);
    const t = await A.addTask({ title, assigneeId: who, dueDate: due, projectId: pid });
    setBusy(false); if (!t) return;
    setToast({ text: other ? `${nameOf(D.users, who)}님에게 맡겼어요` : "추가했어요" });
    if (keep) setTitle(""); else (onBack || onClose)(); };
  return <Sheet title="할 일 추가" onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!title.trim() || busy || (when === "date" && !date)}>{other ? `${nameOf(D.users, who)}님에게 맡기기` : "추가"}</Big>}>
    <label className="v2-lab" htmlFor="v2-add-title">무엇을</label>
    <input id="v2-add-title" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) save(); }} placeholder="할 일 제목" style={inp} />
    <div className="v2-lab">누가</div>
    <div className="v2-chips">{quick.map((u) => <Chip key={u.id} on={who === u.id} onClick={() => setWho(u.id)}>{u.id === cu.id ? "나" : u.name}</Chip>)}
      <select aria-label="다른 사람" value={quick.some((u) => u.id === who) ? "" : who} onChange={(e) => e.target.value && setWho(e.target.value)} className="v2-sel"><option value="">다른 사람 ▾</option>{users.filter((u) => !quick.some((q) => q.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="v2-lab">언제까지</div>
    <div className="v2-chips">{[["today", "오늘"], ["tomorrow", "내일"], ["week", "이번 주"], ["date", "날짜"], ["none", "미정"]].map(([k, l]) => <Chip key={k} on={when === k} onClick={() => setWhen(k)}>{l}</Chip>)}</div>
    {when === "date" && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" style={{ ...inp, marginTop: 8 }} />}
    <div className="v2-lab">프로젝트 <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span></div>
    <div className="v2-chips"><Chip on={!pid} onClick={() => setPid("")}>없음</Chip>{myProj.map((p) => <Chip key={p.id} on={pid === p.id} onClick={() => setPid(p.id)} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</Chip>)}
      <select aria-label="다른 프로젝트" value="" onChange={(e) => e.target.value && setPid(e.target.value)} className="v2-sel"><option value="">다른 프로젝트 ▾</option>{D.projects.filter(projOpen).filter((p) => !myProj.some((m) => m.id === p.id)).sort((a, b) => String(a.title).localeCompare(String(b.title), "ko")).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 14, color: C.sub }}><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ width: 18, height: 18 }} />계속 추가 (저장 뒤에도 이 창 유지)</label>
    {other && <p style={{ fontSize: 13, color: C.sub, marginTop: 10 }}>{nameOf(D.users, who)}님의 오늘 화면 '확인할 것'에 '맡김'으로 떠요.</p>}
  </Sheet>;
}

// ───────────────── 업무 보기 (요약 → 메모 → 대화 → 파일 → 기록) ─────────────────
function useTask(D, id) {
  const live = D.tasks.find((t) => t.id === id);
  const [extra, setExtra] = useState(null);
  useEffect(() => { if (!live && !extra) fb.fetchWhere("tasks", ["id", "==", id]).then((a) => setExtra(a[0] || false)).catch((e) => { console.error("[v2] 업무 불러오기 실패:", e); setExtra(false); }); }, [id, !!live]);
  return live || extra;
}
function useItemNotes(D, itemId) {
  const [old, setOld] = useState([]);
  useEffect(() => { fb.fetchWhere("notes", ["itemId", "==", itemId]).then(setOld).catch((e) => console.error("[v2] 댓글 불러오기 실패:", e)); }, [itemId]);
  return useMemo(() => { const m = new Map(); old.forEach((n) => m.set(n.id, n)); D.notes.forEach((n) => { if (n.itemId === itemId) m.set(n.id, n); }); return [...m.values()]; }, [old, D.notes, itemId]);
}
function TaskSheet({ D, cu, A, open, onBack, onClose, id }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const [mode, setMode] = useState(""), [memo, setMemo] = useState(""), [showLog, setShowLog] = useState(false), [logs, setLogs] = useState(null), [sub, setSub] = useState("");
  const fileRef = useRef(null);
  if (t === undefined || t === null) return <Sheet title="업무" onBack={onBack} onClose={onClose}><Empty>불러오는 중…</Empty></Sheet>;
  if (t === false) return <Sheet title="업무" onBack={onBack} onClose={onClose}><Empty>이 업무를 찾지 못했어요 (휴지통이나 보관함으로 갔을 수 있어요)</Empty></Sheet>;
  const key = ymd(new Date()), mine = isMine(t, cu.id), done = isDone(t), n = ddays(dueOf(t), key);
  const p = D.projects.find((x) => x.id === t.projectId), owners = ownersOf(t).map((u) => nameOf(D.users, u) || "(없는 사람)");
  const kids = D.tasks.filter((x) => x.parentId === t.id), parent = t.parentId ? D.tasks.find((x) => x.id === t.parentId) : null;
  const files = [...(t.attachments || []).map((f) => ({ ...f, where: "업무" })), ...notes.flatMap((nn) => (nn.files || []).map((f) => ({ ...f, by: nn.by, byName: nn.byName, uploadedAt: f.uploadedAt || nn.at, where: "댓글" })))];
  const loadLogs = () => { setShowLog(!showLog); if (logs == null) fb.fetchWhere("log", ["targetId", "==", t.id]).then(setLogs).catch((e) => { console.error(e); setLogs([]); }); };
  const hist = [...(t.statusLog || []).map((s, i) => ({ id: "s" + i, at: s.at, who: s.byName || nameOf(D.users, s.by), text: s.reopen ? "다시 엶" : STATUS_L[s.status] || s.status })),
    ...(logs || []).map((l) => ({ id: l.id, at: l.at, who: l.byName, text: (LOG_L[l.action] || l.action) + (l.label && l.label !== t.title ? " · " + l.label.replace(t.title + " · ", "") : "") }))].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const users = activeUsers(D.users);
  return <Sheet title="업무" onBack={onBack} onClose={onClose}
    foot={done ? <Big tone="white" onClick={() => A.setDone(t, false)}>다시 열기</Big> : mine ? <Big onClick={() => A.setDone(t, true)}>완료</Big> : <Big onClick={() => A.assign(t, cu.id, true)}>내가 이어서 하기</Big>}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 6px", lineHeight: 1.35, wordBreak: "keep-all" }}>{t.title}</h2>
    <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <span>담당 {owners.join(", ") || "없음"}</span> · <span style={{ color: n != null && n < 0 && !done ? C.red : C.sub, fontWeight: n != null && n < 0 && !done ? 800 : 400 }}>{dueOf(t) ? `마감 ${md(dueOf(t))}${done ? "" : " · " + ddayLabel(n)}` : "마감 미정"}</span> · <b style={{ color: C.ink }}>{STATUS_L[t.status] || t.status}</b>
      {p && <div><TBtn onClick={() => open({ type: "project", id: p.id })} style={{ padding: "2px 0" }}>프로젝트 · {p.title} ›</TBtn></div>}
      {parent && <div><TBtn onClick={() => open({ type: "task", id: parent.id })} style={{ padding: "2px 0" }}>상위 업무 · {parent.title} ›</TBtn></div>}
      {t.requestedBy && t.requestedBy !== ownersOf(t)[0] && <div>{nameOf(D.users, t.requestedBy)}님이 {md(ymd(new Date(t.requestedAt)))}에 맡김</div>}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, margin: "6px -4px 0" }}>
      {!done && mine && t.status !== "inprogress" && <TBtn onClick={() => A.setStatus(t, "inprogress")}>시작했어요</TBtn>}
      {!done && t.status !== "hold" && <TBtn onClick={() => A.setStatus(t, "hold")}>보류</TBtn>}
      {!done && t.status === "hold" && <TBtn onClick={() => A.setStatus(t, "todo")}>보류 풀기</TBtn>}
      <TBtn onClick={() => setMode(mode === "who" ? "" : "who")}>담당 바꾸기</TBtn>
      <TBtn onClick={() => setMode(mode === "due" ? "" : "due")}>날짜 바꾸기</TBtn>
    </div>
    {mode === "who" && <div className="v2-chips" style={{ padding: "8px 0" }}>{users.map((u) => <Chip key={u.id} on={t.assigneeId === u.id} onClick={() => { A.assign(t, u.id, u.id === cu.id); setMode(""); }}>{u.id === cu.id ? "나" : u.name}</Chip>)}</div>}
    {mode === "due" && <div className="v2-chips" style={{ padding: "8px 0" }}>{[["오늘", key], ["내일", addDays(key, 1)], ["다음 주", addDays(key, 7)], ["미정", ""]].map(([l, d]) => <Chip key={l} onClick={() => { A.setDue(t, d); setMode(""); }}>{l}</Chip>)}<input type="date" aria-label="날짜 고르기" defaultValue={dueOf(t)} onChange={(e) => { if (e.target.value) { A.setDue(t, e.target.value); setMode(""); } }} className="v2-sel" /></div>}

    <Head right={mode !== "memo" && <TBtn onClick={() => { setMemo(t.memo || ""); setMode("memo"); }}>{t.memo ? "메모 고치기" : "메모 쓰기"}</TBtn>}>메모</Head>
    {mode === "memo" ? <div><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} aria-label="메모" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setMode("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={() => { A.setMemo(t, memo); setMode(""); }} style={{ flex: 1, height: 44 }}>메모 저장</Big></div></div>
      : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65, wordBreak: "break-word" }}>{t.memo ? <Linked text={t.memo} /> : "메모가 없어요. 하는 법이나 진행 상황을 적어 두면 다른 사람이 바로 이어받을 수 있어요."}</div>{t.memoAt && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>마지막 수정 {t.memoByName || nameOf(D.users, t.memoBy)} · {ago(t.memoAt)}</div>}</Card>}

    {(kids.length > 0 || !done) && <>
      <Head>하위 업무 {kids.filter(isDone).length}/{kids.length}</Head>
      <Card>
        {kids.map((k, i) => <Row key={k.id} dim={isDone(k)} title={k.title} sub={nameOf(D.users, k.assigneeId)} onClick={() => open({ type: "task", id: k.id })} right={<Act on={isDone(k)} onClick={() => A.setDone(k, !isDone(k))}>{isDone(k) ? "✓" : "완료"}</Act>} last={false} />)}
        <div style={{ display: "flex", gap: 8, padding: 10 }}><input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate }); setSub(""); } }} placeholder="+ 하위 업무" aria-label="하위 업무 추가" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} />
          <Act onClick={() => { if (sub.trim()) { A.addTask({ title: sub, parentId: t.id, projectId: t.projectId, assigneeId: t.assigneeId || cu.id, dueDate: t.dueDate }); setSub(""); } }}>추가</Act></div>
      </Card></>}

    <Head>대화 {notes.filter((x) => !x.deleted).length}</Head>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id, projectId: t.projectId }} />

    <Head right={<><TBtn onClick={() => fileRef.current && fileRef.current.click()}>+ 파일 올리기</TBtn><input ref={fileRef} type="file" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) A.addFiles(t, f); }} /></>}>파일 {files.length}</Head>
    <Card>{files.length === 0 ? <Empty>올린 파일이 없어요</Empty> : files.map((f, i) => <FileRow key={i} f={f} D={D} last={i === files.length - 1} />)}</Card>

    <Head right={<TBtn onClick={loadLogs}>{showLog ? "접기 ▴" : "펼치기 ▾"}</TBtn>}>기록</Head>
    {showLog && <Card>{logs == null ? <Empty>불러오는 중…</Empty> : hist.length === 0 ? <Empty>기록이 없어요</Empty> : hist.map((h, i) => <div key={h.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < hist.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 13.5 }}><span style={{ color: C.mute, flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }}>{h.at ? `${md(ymd(new Date(h.at)))} ${hm(h.at)}` : "-"}</span><span style={{ color: C.text, minWidth: 0, wordBreak: "break-word" }}>{h.who ? h.who + " · " : ""}{h.text}</span></div>)}</Card>}
  </Sheet>;
}
function FileRow({ f, last }) {
  const img = /^image\//.test(f.type || "");
  return <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: last ? "none" : `1px solid ${C.line}`, textDecoration: "none", color: C.text }}>
    {img ? <img src={f.url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: C.soft, color: C.navy, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{String(f.name || "").split(".").pop().slice(0, 4).toUpperCase() || "파일"}</span>}
    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><span style={{ fontSize: 12, color: C.mute }}>{[f.byName, f.where, f.uploadedAt ? md(ymd(new Date(f.uploadedAt))) : ""].filter(Boolean).join(" · ")}</span></span>
    <span style={{ color: C.navy, fontSize: 13, fontWeight: 800 }}>열기 ›</span>
  </a>;
}

// 대화 (댓글 + 대댓글 + 파일)
function Thread({ D, cu, A, notes, itemId, ctx }) {
  const th = threads(notes, itemId);
  const [text, setText] = useState(""), [reply, setReply] = useState(null), [files, setFiles] = useState([]), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const send = async () => { if ((!text.trim() && !files.length) || busy) return; setBusy(true);
    const ok = await A.addNote(itemId, text || "(파일)", reply, files, ctx); setBusy(false); if (ok) { setText(""); setFiles([]); setReply(null); } };
  const Note = ({ n, child }) => <div style={{ padding: child ? "8px 0 0 14px" : "12px 14px", borderLeft: child ? `2px solid ${C.line}` : "none", marginTop: child ? 6 : 0 }}>
    <div style={{ fontSize: 12.5, color: C.mute }}><b style={{ color: C.ink }}>{n.byName || nameOf(D.users, n.by)}</b> · {ago(n.at)}</div>
    <div style={{ fontSize: 14.5, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2, wordBreak: "break-word" }}><Linked text={n.text} /></div>
    {(n.files || []).map((f, i) => <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4, marginRight: 8, fontSize: 13, color: C.navy, fontWeight: 700 }}>{f.name} ›</a>)}
  </div>;
  return <Card>
    {th.length === 0 && <Empty>아직 대화가 없어요. 진행 상황이나 궁금한 점을 남겨 주세요.</Empty>}
    {th.map((n) => <div key={n.id} style={{ borderBottom: `1px solid ${C.line}` }}><Note n={n} />
      <div style={{ padding: "0 14px 10px" }}>{n.replies.map((r) => <Note key={r.id} n={r} child />)}<TBtn onClick={() => setReply(reply === n.id ? null : n.id)} style={{ padding: "6px 0", fontSize: 12.5 }}>{reply === n.id ? "답글 취소" : "답글"}</TBtn></div></div>)}
    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {reply && <div style={{ fontSize: 12.5, color: C.sub }}>{(th.find((x) => x.id === reply) || {}).byName}님 글에 답글</div>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={reply ? "답글 쓰기" : "댓글 쓰기 · 진행 상황, 피드백, 링크"} aria-label="댓글" style={{ ...inp, resize: "vertical", fontSize: 14.5 }} />
      {files.length > 0 && <div style={{ fontSize: 13, color: C.sub }}>{files.map((f) => f.name).join(", ")} <TBtn tone="mute" onClick={() => setFiles([])}>✕</TBtn></div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TBtn onClick={() => fileRef.current && fileRef.current.click()}>+ 파일</TBtn><input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles([...e.target.files].slice(0, 10)); e.target.value = ""; }} />
        <span style={{ flex: 1 }} /><Act onClick={send} style={{ background: C.navy, color: "#fff", borderColor: C.navy, opacity: (text.trim() || files.length) && !busy ? 1 : 0.45 }}>{busy ? "올리는 중" : "남기기"}</Act>
      </div>
    </div>
  </Card>;
}

// ───────────────── 고정업무 보기 ─────────────────
function FixedSheet({ D, cu, A, onBack, onClose, id }) {
  const t = useTask(D, id);
  const notes = useItemNotes(D, taskNoteId(id));
  const [checks, setChecks] = useState(null);
  useEffect(() => { fb.fetchWhere("checks", ["taskId", "==", id]).then(setChecks).catch((e) => { console.error(e); setChecks([]); }); }, [id, t && JSON.stringify(t.doneAtBy || {})]);
  if (!t) return <Sheet title="고정업무" onBack={onBack} onClose={onClose}><Empty>{t === false ? "이 고정업무를 찾지 못했어요" : "불러오는 중…"}</Empty></Sheet>;
  const key = ymd(new Date()), mine = fxIsMine(t, cu.id), me = fxMeDone(t, cu.id, key), subs = fxSubs(t, cu.id), people = fxPeople(D.users, t);
  const days = [...Array(7)].map((_, i) => addDays(key, -i));
  const byDay = {}; (checks || []).filter((c) => c.on).forEach((c) => { (byDay[c.date] = byDay[c.date] || []).push(c); });
  return <Sheet title="고정업무" onBack={onBack} onClose={onClose} foot={mine ? <Big tone={me ? "white" : "navy"} onClick={() => A.fxToggle(t)}>{me ? "✓ 체크 취소" : fxDoneWord(t)}</Big> : null}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 4px" }}>{fxLabel(t, cu.id)}</h2>
    <div style={{ fontSize: 13.5, color: C.sub }}>{fxRecurL(t)} · {fxTime(t, cu.id) || "시간 상관없음"} · 담당 {people.length}명{t.paused ? " · 멈춤" : ""}</div>
    {mine && subs.length > 0 && <><Head>체크리스트</Head><div className="v2-chips">{subs.map((x) => { const ok = fxHit(t, ((t.subDone || {})[cu.id] || {})[x.id], key); return <Chip key={x.id} on={ok} onClick={() => A.fxSub(t, x.id)}>{ok ? "✓ " : ""}{x.title}</Chip>; })}</div></>}
    <Head>누가 했나</Head>
    <Card>{people.length === 0 ? <Empty>담당이 없어요</Empty> : people.map((uid, i) => { const ok = fxMeDone(t, uid, key), at = t.doneAtBy && t.doneAtBy[uid];
      return <div key={uid} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: i < people.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 14 }}><b style={{ flex: 1, color: C.text }}>{nameOf(D.users, uid) || uid}</b><span style={{ color: ok ? C.green : C.mute, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{ok ? `✓ ${hm(at)}` : `아직${fxTime(t, uid) ? ` (예정 ${fxTime(t, uid)})` : ""}`}</span></div>; })}</Card>
    <Head>최근 7일</Head>
    <Card>{checks == null ? <Empty>불러오는 중…</Empty> : days.map((d, i) => <div key={d} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < 6 ? `1px solid ${C.line}` : "none", fontSize: 13.5 }}><span style={{ width: 52, color: C.mute, fontVariantNumeric: "tabular-nums" }}>{md(d)}</span><span style={{ flex: 1, color: C.text }}>{fxDueOn(t, d) ? ((byDay[d] || []).map((c) => `${c.name} ${hm(c.at)}`).join(" · ") || "-") : <span style={{ color: C.mute }}>쉬는 날</span>}</span></div>)}
      <div style={{ padding: "8px 14px", fontSize: 12, color: C.mute, borderTop: `1px solid ${C.line}` }}>v2에서 체크한 것부터 쌓여요</div></Card>
    <Head>하는 법 · 메모</Head>
    <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: t.memo ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{t.memo ? <Linked text={t.memo} /> : "적어 둔 하는 법이 없어요"}</div></Card>
    <Head>대화</Head>
    <Thread D={D} cu={cu} A={A} notes={notes} itemId={taskNoteId(t.id)} ctx={{ taskId: t.id }} />
  </Sheet>;
}

// ───────────────── 프로젝트 ─────────────────
function ProjCard({ p, D, cu, open, last, now }) {
  const key = ymd(now), s = projStat(p, D.tasks, key);
  const since = new Date(now - 7 * 864e5).toISOString();
  const tids = new Set(D.tasks.filter((t) => t.projectId === p.id).map((t) => t.id));
  const news = feedOf(D, { projectId: p.id, taskIds: [...tids], sinceIso: since }).filter((x) => x.by !== cu.id);
  return <Row title={p.title} tag={s.n != null ? ddayLabel(s.n) : null} tagTone={s.late ? "red" : null}
    sub={[nameOf(D.users, p.assigneeId) ? `책임 ${nameOf(D.users, p.assigneeId)}` : "책임 없음", `${s.pct}%`, `열린 업무 ${s.open}`].join(" · ")}
    sub2={[s.next ? `다음: ${s.next.title} (${nameOf(D.users, s.next.assigneeId) || "담당 없음"})` : "", news.length ? `새 소식 ${news.length} · ${ago(news[0].at, now)}` : ""].filter(Boolean).join(" · ") || null}
    onClick={() => open({ type: "project", id: p.id })} last={last} />;
}
function ProjectsTab({ D, cu, open }) {
  const [scope, setScope] = useLocal(LS("pscope"), "mine"), [q, setQ] = useState(""), [more, setMore] = useState({});
  const now = new Date(), key = ymd(now);
  const openList = D.projects.filter(projOpen);
  const list = scope === "mine" ? openList.filter((p) => projMine(p, cu.id, D.tasks)) : openList;
  const qq = q.trim().replace(/\s/g, "").toLowerCase();
  const hit = qq ? openList.filter((p) => [p.title, nameOf(D.users, p.assigneeId), ...D.tasks.filter((t) => t.projectId === p.id).map((t) => t.title)].join(" ").replace(/\s/g, "").toLowerCase().includes(qq)) : null;
  const G = projGroups(list, key);
  const groups = [["late", "마감 지남", true], ["month", "이번 달 마감", true], ["later", "그 뒤", true], ["none", "마감 없음", true], ["hold", "보류", false]];
  const doneN = D.projects.filter((p) => !projOpen(p)).length;
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>프로젝트</h1>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기 · 프로젝트 이름, 책임자, 업무 제목" aria-label="프로젝트 찾기" style={inp} />
      {!hit && <Seg items={[["mine", `내 프로젝트 ${openList.filter((p) => projMine(p, cu.id, D.tasks)).length}`], ["all", `모든 프로젝트 ${openList.length}`]]} value={scope} onChange={setScope} />}
    </header>
    {hit ? <><Head>찾은 결과 {hit.length}</Head><Card>{hit.length === 0 ? <Empty>찾는 프로젝트가 없어요</Empty> : hit.map((p, i) => <ProjCard key={p.id} p={p} D={D} cu={cu} open={open} now={now} last={i === hit.length - 1} />)}</Card></>
      : groups.map(([k, l, openDefault]) => { const a = G[k]; if (!a.length) return null; const m = more[k], shown = openDefault ? (m ? a : a.slice(0, 5)) : (m ? a : []);
        return <div key={k}><Head red={k === "late"} right={!openDefault && <TBtn onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length} ▾`}</TBtn>}>{l} {a.length}</Head>
          {shown.length > 0 && <Card>{shown.map((p, i) => <ProjCard key={p.id} p={p} D={D} cu={cu} open={open} now={now} last={i === shown.length - 1 && !(openDefault && a.length > 5)} />)}
            {openDefault && a.length > 5 && <More onClick={() => setMore({ ...more, [k]: !m })}>{m ? "접기 ▴" : `${a.length - 5}개 더 보기 ▾`}</More>}</Card>}</div>; })}
    {!hit && list.length === 0 && <Card style={{ marginTop: 14 }}><Empty>{scope === "mine" ? "내가 책임·담당이거나 업무를 맡은 프로젝트가 없어요" : "진행 중인 프로젝트가 없어요"}</Empty></Card>}
    {doneN > 0 && <Card style={{ marginTop: 14 }}><More onClick={() => open({ type: "doneProjects" })}>끝난 프로젝트 {doneN} ›</More></Card>}
    <div className="v2-fab"><Big onClick={() => open({ type: "newProject" })}>+ 새 프로젝트</Big></div>
  </>;
}
function DoneProjectsSheet({ D, cu, open, onBack, onClose }) {
  const list = D.projects.filter((p) => !projOpen(p)).sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")));
  return <Sheet title={`끝난 프로젝트 ${list.length}`} onBack={onBack} onClose={onClose}><div style={{ height: 12 }} /><Card>{list.map((p, i) => <Row key={p.id} title={p.title} sub={[nameOf(D.users, p.assigneeId), p.dueDate ? `마감 ${md(p.dueDate)}` : ""].filter(Boolean).join(" · ")} onClick={() => open({ type: "project", id: p.id })} last={i === list.length - 1} />)}</Card></Sheet>;
}
function NewProjectSheet({ D, cu, A, open, back, onBack, onClose, setToast }) {
  const [title, setTitle] = useState(""), [lead, setLead] = useState(cu.id), [due, setDue] = useState(""), [brand, setBrand] = useState(""), [tasks, setTasks] = useState(["", "", ""]), [busy, setBusy] = useState(false);
  const ref = useAutoFocus();
  const brands = (D.brands || []).filter((b) => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  const save = async () => { if (!title.trim() || !brand || busy) return; setBusy(true); const p = await A.addProject({ title, assigneeId: lead, dueDate: due, brand, tasks }); setBusy(false);
    if (p) { setToast({ text: "프로젝트를 만들었어요" }); back(); open({ type: "project", id: p.id }); } };
  return <Sheet title="새 프로젝트" onBack={onBack} onClose={onClose} foot={<Big onClick={save} disabled={!title.trim() || !brand || busy}>만들기</Big>}>
    <label className="v2-lab" htmlFor="v2-np">이름</label><input id="v2-np" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 10월 그로홈 기획전" style={inp} />
    <div className="v2-lab">브랜드</div><div className="v2-chips">{brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => setBrand(b.id)}>{b.name}</Chip>)}</div>
    <div className="v2-lab">책임자</div><div className="v2-chips"><Chip on={lead === cu.id} onClick={() => setLead(cu.id)}>나</Chip><select aria-label="책임자" className="v2-sel" value={lead === cu.id ? "" : lead} onChange={(e) => e.target.value && setLead(e.target.value)}><option value="">다른 사람 ▾</option>{activeUsers(D.users).filter((u) => u.id !== cu.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <label className="v2-lab" htmlFor="v2-npd">마감 <span style={{ color: C.mute, fontWeight: 600 }}>(선택)</span></label><input id="v2-npd" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inp} />
    <div className="v2-lab">첫 업무 <span style={{ color: C.mute, fontWeight: 600 }}>(선택 · 나중에 더 넣을 수 있어요)</span></div>
    {tasks.map((v, i) => <input key={i} value={v} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`업무 ${i + 1}`} aria-label={`첫 업무 ${i + 1}`} style={{ ...inp, marginBottom: 6 }} />)}
  </Sheet>;
}
function ProjectSheet({ D, cu, A, open, onBack, onClose, id, first }) {
  const p = D.projects.find((x) => x.id === id);
  const member = p && projMine(p, cu.id, D.tasks);
  const [tab, setTab] = useState(first || (member ? "work" : "news"));
  const [doneList, setDoneList] = useState(null), [showDone, setShowDone] = useState(false), [nt, setNt] = useState(""), [nw, setNw] = useState(cu.id), [edit, setEdit] = useState(""), [now, setNow] = useState(""), [info, setInfo] = useState(false);
  const notes = useItemNotes(D, projNoteId(id));
  useEffect(() => { A.recalc(id); }, [id]);   // 열 때 진척(%)을 실제 업무 수로 다시 계산 (다르면만 저장)
  if (!p) return <Sheet title="프로젝트" onBack={onBack} onClose={onClose}><Empty>이 프로젝트를 찾지 못했어요</Empty></Sheet>;
  const key = ymd(new Date()), s = projStat(p, D.tasks, key);
  const live = D.tasks.filter((t) => t.projectId === p.id && !t.isFixed);
  const openT = live.filter((t) => !isDone(t));
  const loadDone = () => { setShowDone(!showDone); if (doneList == null) fb.fetchWhere("tasks", ["projectId", "==", p.id]).then((a) => setDoneList(a.filter((t) => isDone(t) && !t.isFixed))).catch((e) => { console.error(e); setDoneList([]); }); };
  const doneAll = doneList || live.filter(isDone);
  const top = (a) => a.filter((t) => !t.parentId || !a.some((x) => x.id === t.parentId));
  const kidsOf = (pid, a) => a.filter((t) => t.parentId === pid);
  const groups = [["inprogress", "진행 중"], ["todo", "할 일"], ["review", "확인 요청"], ["hold", "보류"]];
  const addT = () => { if (!nt.trim()) return; A.addTask({ title: nt, projectId: p.id, assigneeId: nw }); setNt(""); };
  const tids = [...new Set([...live, ...(doneList || [])].map((t) => t.id))];
  const feed = feedOf({ ...D, notes: [...D.notes, ...notes.filter((n) => !D.notes.some((m) => m.id === n.id))] }, { projectId: p.id, taskIds: tids });
  const tTitle = (tid) => ((D.tasks.find((t) => t.id === tid) || (doneList || []).find((t) => t.id === tid)) || {}).title;
  const files = [...live, ...(doneList || [])].flatMap((t) => (t.attachments || []).map((f) => ({ ...f, where: t.title })))
    .concat(D.notes.filter((n) => { const [k, ...r] = String(n.itemId).split(":"); const ref = r.join(":"); return (k === "proj" && ref === p.id) || (k === "task" && tids.includes(ref)); }).flatMap((n) => (n.files || []).map((f) => ({ ...f, byName: n.byName, uploadedAt: f.uploadedAt || n.at, where: "댓글" }))))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  const TRow = ({ t, indent, last }) => <div style={{ paddingLeft: indent ? 18 : 0, background: "#fff" }}><Row dim={isDone(t)} title={t.title} sub={[nameOf(D.users, t.assigneeId) || "담당 없음", dueOf(t) ? ddayLabel(ddays(dueOf(t), key)) : "", (D.notes.filter((n) => n.itemId === taskNoteId(t.id)).length || "") && `댓글 ${D.notes.filter((n) => n.itemId === taskNoteId(t.id)).length}`].filter(Boolean).join(" · ")} onClick={() => open({ type: "task", id: t.id })} right={isMine(t, cu.id) ? <Act on={isDone(t)} onClick={() => A.setDone(t, !isDone(t))}>{isDone(t) ? "✓" : "완료"}</Act> : null} last={last} /></div>;
  return <Sheet title="프로젝트" onBack={onBack} onClose={onClose}>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: "12px 0 4px", lineHeight: 1.35, wordBreak: "keep-all" }}>{p.title}</h2>
    <div style={{ fontSize: 13.5, color: C.sub }}>책임 {nameOf(D.users, p.assigneeId) || "없음"} · {p.dueDate ? <span style={{ color: s.late ? C.red : C.sub, fontWeight: s.late ? 800 : 400 }}>마감 {md(p.dueDate)} {ddayLabel(s.n)}</span> : "마감 없음"} · {s.pct}% · 열린 업무 {s.open}</div>
    <div style={{ height: 6, background: "#E8EBF2", borderRadius: 3, margin: "10px 0 0", overflow: "hidden" }}><div style={{ width: s.pct + "%", height: "100%", background: C.navy }} /></div>

    <Head right={edit !== "now" && <TBtn onClick={() => { setNow((p.now && p.now.text) || ""); setEdit("now"); }}>{p.now && p.now.text ? "고치기" : "적기"}</TBtn>}>지금 상황</Head>
    {edit === "now" ? <div><textarea value={now} onChange={(e) => setNow(e.target.value)} rows={3} placeholder={"목표: 무엇을 하려는지\n지금: 어디까지 왔는지"} aria-label="지금 상황" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><Big tone="white" onClick={() => setEdit("")} style={{ flex: 1, height: 44 }}>취소</Big><Big onClick={() => { A.patchProject(p, { now: { text: now.trim(), by: cu.id, byName: cu.name, at: nowIso() } }, "지금 상황 고침", (p.now && p.now.text) || ""); setEdit(""); }} style={{ flex: 1, height: 44 }}>저장</Big></div></div>
      : <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 14.5, color: p.now && p.now.text ? C.text : C.mute, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.now && p.now.text ? <Linked text={p.now.text} /> : "처음 보는 사람이 바로 알 수 있게 목표와 지금 상황을 두 줄로 적어 주세요"}</div>
        {s.next && <div style={{ marginTop: 8, fontSize: 13.5, color: C.ink, fontWeight: 700 }}>다음 할 일: {s.next.title} ({nameOf(D.users, s.next.assigneeId) || "담당 없음"})</div>}
        {p.now && p.now.at && <div style={{ marginTop: 6, fontSize: 12, color: C.mute }}>마지막 수정 {p.now.byName} · {ago(p.now.at)}</div>}</Card>}

    <div style={{ margin: "18px 0 4px" }}><Seg items={[["work", `업무 ${openT.length}`], ["news", "소식"], ["files", `자료 ${files.length}`]]} value={tab} onChange={setTab} /></div>
    {tab === "work" && <>
      <Card style={{ marginTop: 10 }}><div style={{ display: "flex", gap: 6, padding: 10, flexWrap: "wrap" }}>
        <input value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addT(); }} placeholder="+ 업무 추가 (Enter로 계속)" aria-label="업무 추가" style={{ ...inp, flex: "1 1 180px", padding: "10px 12px", fontSize: 14 }} />
        <select aria-label="담당" value={nw} onChange={(e) => setNw(e.target.value)} className="v2-sel">{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.id === cu.id ? "나" : u.name}</option>)}</select>
        <Act onClick={addT}>추가</Act></div></Card>
      {groups.map(([st, l]) => { const a = openT.filter((t) => (t.status || "todo") === st); if (!a.length) return null; const tops = top(a);
        return <div key={st}><Head>{l} {a.length}</Head><Card>{tops.map((t, i) => <div key={t.id}><TRow t={t} last={i === tops.length - 1 && !kidsOf(t.id, a).length} />{kidsOf(t.id, a).map((k) => <TRow key={k.id} t={k} indent />)}</div>)}</Card></div>; })}
      {openT.length === 0 && <Card style={{ marginTop: 10 }}><Empty>열린 업무가 없어요</Empty></Card>}
      <Card style={{ marginTop: 14 }}><More onClick={loadDone}>{showDone ? "끝낸 업무 접기 ▴" : `끝낸 업무 ${doneList ? doneList.length : "보기"} ▾`}</More>
        {showDone && (doneList == null ? <Empty>불러오는 중…</Empty> : doneAll.length === 0 ? <Empty>끝낸 업무가 없어요</Empty> : doneAll.sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || ""))).map((t, i) => <TRow key={t.id} t={t} last={i === doneAll.length - 1} />))}</Card>
    </>}
    {tab === "news" && <>
      <Head>프로젝트 대화</Head>
      <Thread D={D} cu={cu} A={A} notes={notes} itemId={projNoteId(p.id)} ctx={{ projectId: p.id }} />
      <Head>업무 소식</Head>
      <Card>{feed.filter((x) => x.itemId !== projNoteId(p.id)).slice(0, 30).map((x, i, arr) => <Row key={x.id} title={x.type === "note" ? x.text : x.text || LOG_L[x.action]} sub={`${x.byName || ""} · ${x.type === "note" ? "댓글" : LOG_L[x.action] || "기록"}${x.type === "note" ? " · " + (tTitle(String(x.itemId).slice(5)) || "") : ""} · ${ago(x.at)}`} onClick={() => { const tid = x.type === "note" ? String(x.itemId).slice(5) : x.targetId; if (tid && x.col !== "projects") open({ type: "task", id: tid }); }} last={i === arr.length - 1} />)}
        {feed.filter((x) => x.itemId !== projNoteId(p.id)).length === 0 && <Empty>최근 소식이 없어요</Empty>}</Card>
    </>}
    {tab === "files" && <Card style={{ marginTop: 10 }}>{files.length === 0 ? <Empty>모인 자료가 없어요. 업무나 댓글에 파일을 올리면 여기 모여요.</Empty> : files.map((f, i) => <FileRow key={i} f={f} last={i === files.length - 1} />)}</Card>}

    <Card style={{ marginTop: 18 }}><More onClick={() => setInfo(!info)}>{info ? "정보 접기 ▴" : "정보 ▾"}</More>
      {info && <div style={{ padding: "4px 14px 14px", fontSize: 14, color: C.text, lineHeight: 1.9 }}>
        <div>책임자 <select aria-label="책임자 바꾸기" className="v2-sel" value={p.assigneeId || ""} onChange={(e) => A.patchProject(p, { assigneeId: e.target.value }, `책임자 → ${nameOf(D.users, e.target.value)}`, p.assigneeId || "")}><option value="">없음</option>{activeUsers(D.users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div>함께 하는 사람 {(p.collaboratorIds || []).map((u) => nameOf(D.users, u)).filter(Boolean).join(", ") || "없음"}</div>
        <div>마감 <input type="date" aria-label="마감 바꾸기" className="v2-sel" defaultValue={p.dueDate || ""} onBlur={(e) => { if (e.target.value !== (p.dueDate || "")) A.patchProject(p, { dueDate: e.target.value }, `마감 ${md(e.target.value) || "없음"}`, p.dueDate || ""); }} /></div>
        <div>브랜드 {((D.brands || []).find((b) => b.id === p.brand) || {}).name || "없음"} · 분류 {p.group || "-"}</div>
        {p.memo && <div style={{ whiteSpace: "pre-wrap", color: C.sub }}>예전 메모: {p.memo}</div>}
        {projOpen(p) && openT.length === 0 && (p.assigneeId === cu.id || isMaster(cu)) && <Big onClick={() => A.patchProject(p, { status: "completed", progress: 100 }, "프로젝트 완료", p.status)} style={{ marginTop: 10 }}>프로젝트 완료</Big>}
      </div>}</Card>
  </Sheet>;
}

// ───────────────── 팀 ─────────────────
function TeamTab({ D, cu, open }) {
  const [seg, setSeg] = useLocal(LS("teamseg"), "people"), [chip, setChip] = useState("all"), [n, setN] = useState(20);
  const key = ymd(new Date()), now = new Date();
  const users = activeUsers(D.users).filter((u) => u.id !== cu.id).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const issues = isMaster(cu) ? ownerIssues(D) : [];
  const feed = feedOf(D, { sinceIso: new Date(now - 7 * 864e5).toISOString() }).filter((x) => chip === "all" || (chip === "talk" ? x.type === "note" : x.type === "log"));
  const tTitle = (id) => (D.tasks.find((t) => t.id === id) || D.projects.find((p) => p.id === id) || {}).title || "";
  const goFeed = (x) => { if (x.type === "note") { const [k, ...r] = String(x.itemId).split(":"); const ref = r.join(":"); if (k === "task") open({ type: "task", id: ref }); else if (k === "proj") open({ type: "project", id: ref, first: "news" }); }
    else if (x.col === "projects") open({ type: "project", id: x.targetId }); else if (x.targetId && x.col === "tasks") { const t = D.tasks.find((y) => y.id === x.targetId); t ? openTask(open, t) : open({ type: "task", id: x.targetId }); } };
  const me = personStat(D, cu.id, key);
  return <>
    <header style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 10 }}><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>팀</h1><Seg items={[["people", "사람"], ["news", "소식"]]} value={seg} onChange={setSeg} /></header>
    {seg === "people" ? <>
      <Card style={{ marginTop: 12 }}><Row title={`나 · ${cu.name}`} sub={`진행 ${me.inprog} · 열린 업무 ${me.open}${me.late ? ` · 밀림 ${me.late}` : ""} · 고정 ${me.fxDone}/${me.fxTotal}`} onClick={() => open({ type: "mine" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={!issues.length} />
        {issues.length > 0 && <Row tag="마스터" title={`담당 정리 필요 ${issues.length}`} sub="담당이 없거나 미사용인 사람이 맡은 일" onClick={() => open({ type: "issues" })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last />}</Card>
      <Head>팀원 {users.length}</Head>
      <Card>{users.map((u, i) => { const s = personStat(D, u.id, key);
        return <Row key={u.id} title={u.name} tag={s.late ? `밀림 ${s.late}` : null} tagTone="red" sub={`진행 ${s.inprog} · 열린 업무 ${s.open} · 고정 ${s.fxDone}/${s.fxTotal}${s.last ? " · " + ago(s.last, now) : ""}`} onClick={() => open({ type: "person", id: u.id })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={i === users.length - 1} />; })}</Card>
    </> : <>
      <div className="v2-chips" style={{ marginTop: 12 }}>{[["all", "전체"], ["talk", "대화"], ["log", "변경·완료"]].map(([k, l]) => <Chip key={k} on={chip === k} onClick={() => setChip(k)}>{l}</Chip>)}</div>
      <Card style={{ marginTop: 10 }}>{feed.length === 0 ? <Empty>최근 7일 소식이 없어요</Empty> : feed.slice(0, n).map((x, i) => <Row key={x.id} title={x.type === "note" ? `${x.byName} · ${tTitle(String(x.itemId).split(":").slice(1).join(":")) || "대화"}` : `${x.byName} · ${LOG_L[x.action] || "기록"}`} sub={x.text} sub2={ago(x.at, now)} onClick={() => goFeed(x)} last={i === Math.min(n, feed.length) - 1 && feed.length <= n} />)}
        {feed.length > n && <More onClick={() => setN(n + 20)}>더 보기 ▾</More>}</Card>
    </>}
  </>;
}
function PersonSheet({ D, cu, A, open, onBack, onClose, id, setToast }) {
  const u = D.users.find((x) => x.id === id); const [ask, setAsk] = useState(false);
  if (!u) return <Sheet title="사람" onBack={onBack} onClose={onClose}><Empty>찾지 못했어요</Empty></Sheet>;
  const key = ymd(new Date()), s = personStat(D, u.id, key);
  const open1 = D.tasks.filter((t) => isOneOff(t) && !isDone(t) && isMine(t, u.id));
  const doing = open1.filter((t) => t.status === "inprogress"), next = open1.filter((t) => t.status === "todo").sort((a, b) => String(dueOf(a) || "9").localeCompare(String(dueOf(b) || "9"))).slice(0, 5);
  const projs = D.projects.filter((p) => projOpen(p) && p.assigneeId === u.id);
  const fx = D.tasks.filter((t) => t.isFixed && !t.paused && fxIsMine(t, u.id) && fxDueOn(t, key));
  const talk = D.notes.filter((n) => n.by === u.id && !n.deleted).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  const L = ({ a, empty, render }) => <Card>{a.length === 0 ? <Empty>{empty}</Empty> : a.map((x, i) => render(x, i === a.length - 1))}</Card>;
  return <Sheet title={u.name} onBack={onBack} onClose={onClose} foot={<Big onClick={() => open({ type: "add", preset: { assigneeId: u.id } })}>{u.name}님에게 업무 맡기기</Big>}>
    <div style={{ marginTop: 12, padding: "10px 12px", background: C.soft, borderRadius: 12, fontSize: 13, color: C.ink }}>보기만 하는 화면이에요. 댓글은 내 이름({cu.name})으로 남아요.</div>
    <div style={{ fontSize: 14, color: C.sub, margin: "12px 2px 0" }}>진행 {s.inprog} · 열린 업무 {s.open}{s.late ? ` · 밀림 ${s.late}` : ""} · 오늘 고정 {s.fxDone}/{s.fxTotal}{s.last ? ` · 마지막 활동 ${ago(s.last)}` : ""}</div>
    <Head>지금 하는 일 {doing.length}</Head><L a={doing} empty="진행 중인 일이 없어요" render={(t, last) => <Row key={t.id} title={t.title} sub={dueOf(t) ? ddayLabel(ddays(dueOf(t), key)) : null} onClick={() => open({ type: "task", id: t.id })} last={last} />} />
    <Head>다음 할 일</Head><L a={next} empty="남은 할 일이 없어요" render={(t, last) => <Row key={t.id} title={t.title} sub={dueOf(t) ? `${md(dueOf(t))} · ${ddayLabel(ddays(dueOf(t), key))}` : "마감 미정"} onClick={() => open({ type: "task", id: t.id })} last={last} />} />
    <Head>책임 프로젝트 {projs.length}</Head><L a={projs} empty="책임 프로젝트가 없어요" render={(p, last) => <Row key={p.id} title={p.title} sub={(p.now && p.now.text ? p.now.text.split("\n")[0] : "지금 상황 미작성")} onClick={() => open({ type: "project", id: p.id, first: "news" })} last={last} />} />
    <Head>오늘 고정업무 {fx.filter((t) => fxMeDone(t, u.id, key)).length}/{fx.length}</Head><L a={fx} empty="오늘 고정업무가 없어요" render={(t, last) => <Row key={t.id} title={fxLabel(t, u.id)} sub={fxMeDone(t, u.id, key) ? `✓ ${hm(t.doneAtBy && t.doneAtBy[u.id])}` : `아직${fxTime(t, u.id) ? ` · 예정 ${fxTime(t, u.id)}` : ""}`} onClick={() => open({ type: "fixed", id: t.id })} last={last} />} />
    <Head>최근 대화</Head><L a={talk} empty="최근 30일 대화가 없어요" render={(n, last) => <Row key={n.id} title={n.text} sub={ago(n.at)} onClick={() => { const [k, ...r] = String(n.itemId).split(":"); if (k === "task") open({ type: "task", id: r.join(":") }); else if (k === "proj") open({ type: "project", id: r.join(":"), first: "news" }); }} last={last} />} />
    {isMaster(cu) && u.id !== cu.id && u.pinHash && <div style={{ marginTop: 18 }}><TBtn tone="red" onClick={() => setAsk(true)}>{u.name}님 PIN 초기화</TBtn></div>}
    {ask && <Ask title="PIN 초기화" body={`${u.name}님의 v2 PIN을 지울까요?\n본인이 다음에 열 때 새로 정해요. (버전1 PIN은 그대로예요)`} yes="초기화" danger onNo={() => setAsk(false)} onYes={() => { fb.patch("users", u._doc || u.id, { pinHash: null, pinResetBy: cu.id, pinResetAt: nowIso() }).then(() => setToast({ text: "PIN을 초기화했어요" })).catch((e) => { console.error(e); setToast({ text: "초기화 실패" }); }); setAsk(false); }} />}
  </Sheet>;
}
function MineSheet({ D, cu, A, open, onBack, onClose }) {
  const [st, setSt] = useState("todo"), [q, setQ] = useState("");
  const key = ymd(new Date());
  const mine = D.tasks.filter((t) => isOneOff(t) && isMine(t, cu.id));
  const by = { todo: mine.filter((t) => t.status === "todo" || t.status === "review"), inprogress: mine.filter((t) => t.status === "inprogress"), hold: mine.filter((t) => t.status === "hold"), done: mine.filter(isDone) };
  const qq = q.trim().toLowerCase();
  const list = (qq ? mine.filter((t) => String(t.title).toLowerCase().includes(qq)) : by[st]).slice().sort((a, b) => st === "done" ? String(b.doneAt || "").localeCompare(String(a.doneAt || "")) : String(dueOf(a) || "9999").localeCompare(String(dueOf(b) || "9999")));
  const pName = (pid) => (D.projects.find((p) => p.id === pid) || {}).title || "";
  return <Sheet title="내 할 일 모두" onBack={onBack} onClose={onClose}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="내 업무 찾기" aria-label="내 업무 찾기" style={inp} />
      {!qq && <Seg items={[["todo", `할 일 ${by.todo.length}`], ["inprogress", `진행 ${by.inprogress.length}`], ["hold", `보류 ${by.hold.length}`], ["done", `끝남 ${by.done.length}`]]} value={st} onChange={setSt} />}
    </div>
    <Card style={{ marginTop: 12 }}>{list.length === 0 ? <Empty>없어요</Empty> : list.map((t, i) => <Row key={t.id} dim={isDone(t)} title={t.title} sub={[dueOf(t) ? (isDone(t) ? md(dueOf(t)) : ddayLabel(ddays(dueOf(t), key))) : "날짜 없음", pName(t.projectId)].filter(Boolean).join(" · ")} tag={!isDone(t) && dueOf(t) && ddays(dueOf(t), key) < 0 ? "지남" : null} tagTone="red" onClick={() => open({ type: "task", id: t.id })} right={isDone(t) ? null : !dueOf(t) ? <Act onClick={() => A.setDue(t, key)}>오늘 하기</Act> : <Act onClick={() => A.setDone(t, true)}>완료</Act>} last={i === list.length - 1} />)}</Card>
    {st === "done" && !qq && <p style={{ fontSize: 12.5, color: C.mute, margin: "10px 2px" }}>최근 30일에 끝낸 업무만 보여요</p>}
  </Sheet>;
}
function IssuesSheet({ D, open, onBack, onClose }) {
  const a = ownerIssues(D);
  return <Sheet title={`담당 정리 필요 ${a.length}`} onBack={onBack} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "12px 2px" }}>담당이 없거나 '미사용' 사람이 맡은 일이에요. 눌러서 '담당 바꾸기'로 정리해 주세요.</p>
    <Card>{a.map((x, i) => <Row key={x.t.id} tag={x.why} tagTone="red" title={x.t.title} sub={[x.t.isFixed ? "고정업무" : "업무", ownersOf(x.t).map((u) => nameOf(D.users, u) || "(없는 사람)").join(", ")].filter(Boolean).join(" · ")} onClick={() => openTask(open, x.t)} last={i === a.length - 1} />)}</Card>
  </Sheet>;
}

// ───────────────── 더보기 ─────────────────
function MoreTab({ D, cu, meta, setMeta, logout, setToast }) {
  const [ask, setAsk] = useState(""), [st, setSt] = useState("");
  const reseed = async () => { setAsk(""); try { setSt("버전1 읽는 중…"); const v1 = await fb.readV1State(); const notes = await fb.readV1Notes();
      const { ops, counts } = planSeed(v1, notes); if (!(v1.tasks || []).length) throw new Error("버전1 업무가 비어 보여요");
      await fb.putMany(ops, (n, t) => setSt(`복사 중 ${n}/${t}`), { merge: true }); const m = { reseededAt: nowIso(), reseededBy: cu.name, counts }; await fb.setMeta(m); setMeta({ ...meta, ...m }); setSt(""); setToast({ text: "버전1에서 다시 가져왔어요" }); }
    catch (e) { console.error("[v2] 다시 가져오기 실패:", e); setSt(""); setToast({ text: "가져오지 못했어요: " + e.message }); } };
  const c = meta.counts || {};
  return <>
    <header style={{ padding: "14px 2px 6px" }}><h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>더보기</h1></header>
    <Head>나</Head>
    <Card><Row title={cu.name} sub={isMaster(cu) ? "마스터" : "팀원"} last={false} />
      <Row title="다른 사람으로 쓰기" sub="이 기기에서 나가고 이름을 다시 골라요" onClick={() => setAsk("out")} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last /></Card>
    <Head>시험판 안내</Head>
    <Card style={{ padding: "12px 14px", fontSize: 14, color: C.text, lineHeight: 1.75 }}>
      <div>· v2는 버전1 데이터를 복사해서 따로 저장해요. 여기서 바꾼 것은 버전1에 반영되지 않아요.</div>
      <div>· 실제 업무는 계속 버전1에서 해 주세요. v2는 써 보고 불편한 점을 알려 주는 용도예요.</div>
      <div>· 업무 1건이 문서 1개로 저장돼서, 여러 사람이 동시에 고쳐도 서로 덮어쓰지 않아요.</div>
      <a href={V1_URL} style={{ display: "inline-block", marginTop: 6, color: C.navy, fontWeight: 800 }}>버전1 열기 ›</a>
    </Card>
    <Head>데이터</Head>
    <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <div>복사한 때: {meta.reseededAt ? `${md(ymd(new Date(meta.reseededAt)))} ${hm(meta.reseededAt)} · ${meta.reseededBy}` : meta.seededAt ? `${md(ymd(new Date(meta.seededAt)))} ${hm(meta.seededAt)}` : "-"}</div>
      <div>{Object.entries(c).filter(([k]) => COUNT_L[k]).map(([k, v]) => `${COUNT_L[k]} ${v}`).join(" · ")}</div>
      {isMaster(cu) ? <div style={{ marginTop: 10 }}><Big tone="white" disabled={!!st} onClick={() => setAsk("reseed")}>{st || "버전1에서 다시 가져오기"}</Big></div> : <div style={{ marginTop: 6 }}>다시 가져오기는 마스터만 할 수 있어요</div>}
    </Card>
    <p style={{ textAlign: "center", fontSize: 12, color: C.mute, margin: "24px 0 8px" }}>업무OS {BUILD}</p>
    {ask === "out" && <Ask title="다른 사람으로 쓰기" body={"이 기기에서 나가요.\n다시 들어올 때 이름과 PIN을 넣어요."} yes="나가기" onNo={() => setAsk("")} onYes={() => { setAsk(""); logout(); }} />}
    {ask === "reseed" && <Ask title="버전1에서 다시 가져오기" body={"버전1의 지금 데이터로 v2를 덮어써요.\n· 버전1은 읽기만 해요(바뀌지 않아요)\n· v2에서 새로 만든 업무·댓글은 그대로 남아요\n· v2에서 고친 버전1 업무는 버전1 내용으로 돌아가요\n· v2에서 정한 PIN·지금 상황 같은 v2 전용 칸은 그대로예요"} yes="가져오기" onNo={() => setAsk("")} onYes={reseed} />}
  </>;
}
