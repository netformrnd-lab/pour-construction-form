// 업무OS v2 (시험판) 실사용 앱 — 탭 4개: 오늘 · 달력 · 프로젝트 · 더보기 (팀 전체 현황은 관리자 화면 os2-admin.html)
// v1(os.html) 과 데이터가 완전히 분리되어 있다. 여기서 바꾼 것은 v1 에 반영되지 않는다.
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import {
  ymd, addDays, ddays, ddayLabel, md, hm, ago, dayTitle, isMaster, activeUsers, nameOf, STATUS_L, isDone, isOneOff, isMine, ownersOf, dueOf,
  fxIsMine, fxDueOn, fxMeDone, fxCount, fxTime, fxLabel, fxSubs, fxRecurL, fxDoneWord, fxCheckPatch, fxPeople, fxHit,
  todayView, projOpen, projMine, projStat, projGroups, personStat, ownerIssues, feedOf, threads, taskNoteId, projNoteId, newId, planSeed, COUNT_L, LOG_L,
  reqOf, needsReview, dueApprover,
} from "./model.js";
import { TodayTab, TurnSheet, MyTidySheet, UpTurnsSheet } from "./today.jsx";
import { MoreTab, AssignedSheet, MyFixedSheet, AddFixedSheet } from "./more.jsx";
import { turnIndex, turnsOf } from "./turn.js";
import { SheetRouter } from "./sheets.jsx";
import { MyKpiSheet, LagSheet, useGhRefresh, KpiEditSheet } from "./kpiui.jsx";
import { TaskSheet, FixedSheet, openTask } from "./task.jsx";
import { ProjectsTab, ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { CalendarTab } from "./schedule.jsx";
import { planLaunchImport, relaunch } from "./launch.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked, useBackClose } from "./ui.jsx";

export const BUILD = "v2-3단계 1003 실사용·관리자";
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
  const [start] = useLocal(LS("start-" + cu.id), "today");
  const [tab, setTab] = useState(start === "calendar" ? "calendar" : "today");
  const [stack, setStack] = useState([]);   // 열린 시트들 [{type, id, ...}]
  const [toast, setToast] = useState(null);
  const [seen, setSeen] = useLocal(LS("seen-" + cu.id), {});
  // '이제 내 차례' 알림 기준 시각: 버전1 데이터를 처음 복사한 때 (복사해 온 예전 끝냄으로는 알림을 띄우지 않음 · 14일 지난 것도 안 띄움)
  // 앱을 처음 여는 사람도 그 사이 v2 에서 앞사람이 끝낸 일은 '이제 내 차례'로 바로 보임
  const since = meta.seededAt || "";
  const idx = useMemo(() => turnIndex(D), [D]);
  const T = useMemo(() => turnsOf(D, idx, cu.id, new Date(), seen, since), [D, idx, cu.id, seen, since]);
  const TV = useMemo(() => todayView(D, cu.id, new Date(), seen, T), [D, cu.id, seen, T]);
  const A = useActs(D, cu, setToast, idx);
  const open = (s) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => st.slice(0, -1));
  const closeAll = () => setStack([]);
  useBackClose(stack.length, setStack);   // 폰 뒤로 = 맨 위 시트만 닫기
  // 링크로 열기: …os2.html#t-업무ID / #p-프로젝트ID (업무·프로젝트 화면의 '링크 복사') / #r-반복실행ID (문자 알림) → 로그인 뒤 그 화면 바로
  useEffect(() => { const m = /^#(t|p|r)-(.+)$/.exec(window.location.hash || ""); if (!m) return; const id = decodeURIComponent(m[2]);
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (m[1] === "p") open({ type: "project", id }); else if (m[1] === "r") open({ type: "routine", id }); else { const t = D.tasks.find((x) => x.id === id); open({ type: t && t.isFixed ? "fixed" : "task", id }); } }, []);
  // 시트 화면 상태(지난 일 정리 몇 번째 · 내 정리 탭·고른 것 · 프로젝트 탭)를 그 시트 칸에 적어 둠 → 위 시트에서 '뒤로' 오면 이어서
  const saveAt = (i, patch) => setStack((st) => st.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  useGhRefresh(D, cu);   // 그로홈 매출 합계 (마스터 기기 · 3시간에 한 번)
  const ctx = { D, cu, A, open, back, closeAll, saveAt, seen, setSeen, setToast, TV, T, idx, meta, setMeta, logout, setTab, BUILD };
  const top = stack[stack.length - 1];
  const TABS = [["today", "오늘"], ["calendar", "달력"], ["projects", "프로젝트"], ["more", "더보기"]];
  const badge = TV.inbox.length + TV.freshN;
  const at = meta.reseededAt || meta.seededAt;
  const extra = {
    turns: (p) => <TurnSheet {...p} />,
    upturns: (p) => <UpTurnsSheet {...p} />,
    myTidy: (p, s) => <MyTidySheet {...p} tab0={s.tab} st={s} />,
    assigned: (p) => <AssignedSheet {...p} />,
    myFixed: (p) => <MyFixedSheet {...p} />,
    addFixed: (p) => <AddFixedSheet {...p} />,
    myKpi: (p) => <MyKpiSheet {...p} goToday={() => { setTab("today"); closeAll(); window.scrollTo(0, 0); }} />,
    lagInput: (p, s) => <LagSheet {...p} s={s} />,
    kpiEdit: (p, s) => <KpiEditSheet {...p} s={s} />,
  };
  return <div className="v2-app">
    <nav className="v2-nav" aria-label="메뉴">
      <div className="v2-brand">업무OS <span style={{ color: C.mute, fontWeight: 700 }}>v2</span></div>
      {TABS.map(([k, l]) => <button key={k} type="button" className={"v2-tab" + (tab === k ? " on" : "")} aria-current={tab === k ? "page" : undefined} onClick={() => { setTab(k); closeAll(); window.scrollTo(0, 0); }}>
        {l}{k === "today" && badge > 0 && <span className="v2-badge">{badge}</span>}
      </button>)}
    </nav>
    <div className="v2-main">
      <div className="v2-trial">시험판 · 버전1 {at ? md(ymd(new Date(at))) : ""} 데이터 · 여기서 바꾼 건 버전1에 안 가요 <a href={V1_URL}>버전1 열기 ›</a></div>
      <div className="v2-page">
        {tab === "today" && <TodayTab {...ctx} />}
        {tab === "calendar" && <CalendarTab {...ctx} />}
        {tab === "projects" && <ProjectsTab {...ctx} />}
        {tab === "more" && <MoreTab {...ctx} />}
      </div>
    </div>
    {top && <SheetRouter s={top} {...ctx} depth={stack.length} extra={extra} />}
    <Toast toast={toast} onDone={() => setToast(null)} />
  </div>;
}
