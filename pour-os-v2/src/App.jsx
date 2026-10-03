// 업무OS v2 (시험판) — 탭 4개: 오늘 · 프로젝트 · 팀 · 더보기
// v1(os.html) 과 데이터가 완전히 분리되어 있다. 여기서 바꾼 것은 v1 에 반영되지 않는다.
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover,
} from "./model.js";
import { TodayTab, AddSheet, MineSheet, FocusTriage } from "./today.jsx";
import { TaskSheet, FixedSheet, openTask } from "./task.jsx";
import { ProjectsTab, ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { ScheduleTab } from "./schedule.jsx";
import { TeamTab, PersonSheet, IssuesSheet, RiskSheet } from "./team.jsx";
import { planLaunchImport, relaunch } from "./launch.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked } from "./ui.jsx";

export const BUILD = "v2-2단계 1003b 일정";
import { useBoot, Gate, useActs, V1_URL, LS, nowIso } from "./core.jsx";

// ───────────────── 앱 (실사용) ─────────────────
export default function App() {
  const B = useBoot();
  const g = Gate({ B });
  if (g) return g;
  return <Main key={B.cu.id} D={B.D} cu={B.cu} meta={B.meta} setMeta={B.setMeta} logout={B.logout} />;
}

// ───────────────── 메인 화면 ─────────────────
function Main({ D, cu, meta, setMeta, logout }) {
  const [tab, setTab] = useState("today");   // 열면 항상 오늘부터
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
  const TABS = [["today", "오늘"], ["projects", "프로젝트"], ["schedule", "일정"], ["team", "팀"], ["more", "더보기"]];
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
        {tab === "schedule" && <ScheduleTab {...ctx} />}
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
  if (s.type === "triage") return <FocusTriage {...p} />;
  if (s.type === "risk") return <RiskSheet {...p} />;
  return null;
}
function MoreTab({ D, cu, meta, setMeta, logout, setToast }) {
  const [ask, setAsk] = useState(""), [st, setSt] = useState("");
  const reseed = async () => { setAsk(""); try { setSt("버전1 읽는 중…"); const v1 = await fb.readV1State(); const notes = await fb.readV1Notes();
      const { ops, counts } = planSeed(v1, notes); if (!(v1.tasks || []).length) throw new Error("버전1 업무가 비어 보여요");
      const lp = planLaunchImport(await fb.readV1Launch(), { users: D.users, workflows: v1.workflows }); ops.push(...lp.projects.map((x) => ({ key: "projects", id: x.id, data: x })), ...lp.tasks.map((x) => ({ key: "tasks", id: x.id, data: x }))); counts.launch = lp.projects.length;
      await fb.putMany(ops, (n, t) => setSt(`복사 중 ${n}/${t}`), { merge: true }); const m = { reseededAt: nowIso(), reseededBy: cu.name, counts }; await fb.setMeta(m); setMeta({ ...meta, ...m }); setSt(""); setToast({ text: "버전1에서 다시 가져왔어요" }); }
    catch (e) { console.error("[v2] 다시 가져오기 실패:", e); setSt(""); setToast({ text: "가져오지 못했어요: " + e.message }); } };
  const c = meta.counts || {};
  const lbN = D.projects.filter((p) => String(p.id || "").startsWith("lb_")).length;
  const importLaunch = async () => { setAsk(""); try { setSt("신제품 보드 읽는 중…"); const lp = planLaunchImport(await fb.readV1Launch(), D);
      await fb.putMany([...lp.projects.map((x) => ({ key: "projects", id: x.id, data: x })), ...lp.tasks.map((x) => ({ key: "tasks", id: x.id, data: x }))], (n, t) => setSt(`복사 중 ${n}/${t}`), { merge: true });
      await fb.setMeta({ launchAt: nowIso(), counts: { ...c, launch: lp.projects.length } }); setMeta({ ...meta, launchAt: nowIso(), counts: { ...c, launch: lp.projects.length } }); setSt(""); setToast({ text: `신제품 ${lp.projects.length}개 · 항목 ${lp.tasks.length}개를 가져왔어요` }); }
    catch (e) { console.error("[v2] 신제품 가져오기 실패:", e); setSt(""); setToast({ text: "가져오지 못했어요: " + e.message }); } };
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
      {isMaster(cu) ? <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <Big tone={lbN ? "white" : "navy"} disabled={!!st} onClick={() => setAsk("launch")}>{st || (lbN ? `버전1 신제품 보드 다시 가져오기 (지금 ${lbN}개)` : "버전1 신제품 보드 가져오기")}</Big>
        <Big tone="white" disabled={!!st} onClick={() => setAsk("reseed")}>{st || "버전1 전체 다시 가져오기"}</Big></div> : <div style={{ marginTop: 6 }}>가져오기는 마스터만 할 수 있어요</div>}
    </Card>
    <p style={{ textAlign: "center", fontSize: 12, color: C.mute, margin: "24px 0 8px" }}>업무OS {BUILD}</p>
    {ask === "out" && <Ask title="다른 사람으로 쓰기" body={"이 기기에서 나가요.\n다시 들어올 때 이름과 PIN을 넣어요."} yes="나가기" onNo={() => setAsk("")} onYes={() => { setAsk(""); logout(); }} />}
    {ask === "launch" && <Ask title="신제품 보드 가져오기" body={"버전1 신제품 보드(런칭보드)를 읽기만 해서 v2로 가져와요.\n· 제품 1개 = 프로젝트 1개, 항목마다 업무 1건\n· 기한이 빈 항목은 출시일에서 거꾸로 계산해 넣어요\n· 담당이 빈 항목은 그 항목을 가장 많이 맡은 사람(기본 담당)으로 넣어요\n· 버전1 신제품 보드는 바뀌지 않아요"} yes="가져오기" onNo={() => setAsk("")} onYes={importLaunch} />}
    {ask === "reseed" && <Ask title="버전1에서 다시 가져오기" body={"버전1의 지금 데이터로 v2를 덮어써요.\n· 버전1은 읽기만 해요(바뀌지 않아요)\n· v2에서 새로 만든 업무·댓글은 그대로 남아요\n· v2에서 고친 버전1 업무는 버전1 내용으로 돌아가요\n· v2에서 정한 PIN·지금 상황 같은 v2 전용 칸은 그대로예요"} yes="가져오기" onNo={() => setAsk("")} onYes={reseed} />}
  </>;
}
