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
import { TodayTab, TurnSheet, MyTidySheet, UpTurnsSheet, ReadInboxSheet } from "./today.jsx";
import { MoreTab, AssignedSheet, MyFixedSheet, AddFixedSheet, MyNotesSheet } from "./more.jsx";
import { turnIndex, turnsOf } from "./turn.js";
import { SheetRouter } from "./sheets.jsx";
import { MyKpiSheet, LagSheet, useGhRefresh, KpiEditSheet } from "./kpiui.jsx";
import { ReportSheet } from "./reportui.jsx";
import { GrowthSheet } from "./growthui.jsx";
import { SearchSheet } from "./searchui.jsx";
import { TaskSheet, FixedSheet, openTask } from "./task.jsx";
import { ProjectsTab, ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { CalendarTab } from "./schedule.jsx";
import { planLaunchImport, relaunch } from "./launch.js";
import { C, Big, TBtn, Act, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, Toast, inp, useLocal, useAutoFocus, Linked, useBackClose, parseAppHash } from "./ui.jsx";

export const BUILD = "v2-3단계 1003 실사용·관리자";
import { useBoot, Gate, useActs, useSeen, V1_URL, LS, nowIso } from "./core.jsx";
import { setViewOnly } from "./viewonly.js";
import { canView, viewTarget, viewHash, viewActs, viewBlockText } from "./viewas.js";
import { redactAs } from "./secret.js";
import { ViewAsSheet, ViewBar, ViewFrame } from "./viewasui.jsx";

// ───────────────── 앱 (실사용) ─────────────────
export default function App() {
  const B = useBoot();
  const g = Gate({ B });
  if (g) { setViewOnly(null); return g; }   // 로그인 화면(PIN 정하기 등)은 늘 쓸 수 있게
  return <Shell B={B} />;
}

// ───────────────── 보기 모드 (viewas.js · 2026-10-15 "리드부터는 관리자모드가 아닌 일반 보기모드를 이름 선택해서 화면 볼 수 있게해") ─────────────────
// 리드·본부장·관리자가 이름을 골라 그 사람 화면을 읽기만 — 더보기 › 팀원 화면 보기 · 사람 화면 · 링크 …os2.html#v-사람ID
//   쓰기 잠금(viewonly.js)은 그리기 전에 켬 → 그 사람 화면이 열리며 저절로 쓰는 것(읽음·진척 등)도 막힘 · 화면 데이터 = 두 사람 모두 볼 수 있는 것만(redactAs)
function Shell({ B }) {
  const [as, setAs] = useState(() => viewHash(window.location.hash));
  const [back, setBack] = useState("");   // [내 화면으로] 때 열 탭 (보기 시작한 곳)
  useEffect(() => { const go = () => { const id = viewHash(window.location.hash); if (!id) return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); setAs(id); };
    go(); window.addEventListener("hashchange", go); return () => window.removeEventListener("hashchange", go); }, []);
  const who = as ? viewTarget(B.D.users, B.cu, as) : null;
  setViewOnly(who ? { as: who.id, by: B.cu.id } : null);
  const VD = useMemo(() => (who ? redactAs(B.rawD, B.cu, who) : null), [who, B.rawD, B.cu]);
  const go = (id) => { setBack("more"); setAs(id); window.scrollTo(0, 0); }, exit = () => { setAs(""); window.scrollTo(0, 0); };
  if (who) return <Main key={"v-" + who.id} D={VD} cu={who} meta={B.meta} setMeta={B.setMeta} logout={exit} view={{ by: B.cu, exit, go }} />;
  return <Main key={B.cu.id} D={B.D} cu={B.cu} meta={B.meta} setMeta={B.setMeta} logout={B.logout} view={canView(B.D.users, B.cu) ? { go } : null} tab0={back} />;
}

// ───────────────── 메인 화면 ─────────────────
// view: 보기 모드면 {by: 연 사람, exit, go} (읽기만) · 리드·본부장·관리자의 내 화면이면 {go} (팀원 화면 보기) · 그 밖은 null
function Main({ D, cu, meta, setMeta, logout, view = null, tab0 = "" }) {
  const ro = !!(view && view.by);
  const [start] = useLocal(LS("start-" + cu.id), "today");
  const [tab, setTab] = useState(tab0 || (start === "calendar" ? "calendar" : "today"));
  const [stack, setStack] = useState([]);   // 열린 시트들 [{type, id, ...}]
  const [toast, setToast0] = useState(null);
  // 보기 모드: 저장 실패 알림('인터넷 연결…')은 '보기 모드라 바꾸지 않았어요'로 (직접 저장하는 화면 조각도 같이)
  const setToast = ro ? (t) => setToast0(t && /실패/.test(String(t.text || "")) ? { text: viewBlockText(cu.name) } : t) : setToast0;
  const [seen, setSeen] = useSeen(cu.id, ro);   // 읽음 표시 — 폰·PC 같이 (서버 seen/{나} · 2026-10-13) · 보기 모드는 그 사람 것을 읽기만
  // '이제 내 차례' 알림 기준 시각: 버전1 데이터를 처음 복사한 때 (복사해 온 예전 끝냄으로는 알림을 띄우지 않음 · 14일 지난 것도 안 띄움)
  // 앱을 처음 여는 사람도 그 사이 v2 에서 앞사람이 끝낸 일은 '이제 내 차례'로 바로 보임
  const since = meta.seededAt || "";
  const idx = useMemo(() => turnIndex(D), [D]);
  const T = useMemo(() => turnsOf(D, idx, cu.id, new Date(), seen, since), [D, idx, cu.id, seen, since]);
  const TV = useMemo(() => todayView(D, cu.id, new Date(), seen, T), [D, cu.id, seen, T]);
  const A0 = useActs(D, cu, setToast, idx);
  const A = ro ? viewActs(A0, () => setToast0({ text: viewBlockText(cu.name) })) : A0;   // 보기 모드: 바꾸는 버튼은 저장 없이 알림만
  const open = (s) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => st.slice(0, -1));
  const closeAll = () => setStack([]);
  useBackClose(stack.length, setStack);   // 폰 뒤로 = 맨 위 시트만 닫기
  // 링크로 열기: …os2.html#t-업무ID / #p-프로젝트ID (업무·프로젝트 화면의 '링크 복사') / #r-반복실행ID (문자 알림) → 로그인 뒤 그 화면 바로
  //   댓글 링크 '~c-댓글ID' (대화의 [링크 복사]) → 대화 칸으로 가서 그 댓글에 잠깐 테두리 (프로젝트는 소식 탭 '프로젝트에 한마디') · 로그인한 채로 링크를 열어도(hashchange)
  const Dref = useRef(D); Dref.current = D;
  useEffect(() => { const go = () => { const h = parseAppHash(window.location.hash); if (!h) return; const { kind, id, note } = h;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      const nt = note ? { focus: "talk", note } : {};
      if (kind === "p") open({ type: "project", id, ...(note ? { first: "news", note } : {}) }); else if (kind === "r") open({ type: "routine", id, ...nt });
      else if (kind === "a") open({ type: "aiask", id, ...nt });   // AI 승인 링크 (#a-승인ID · 허브·문자에서)
      else if (kind === "s") open({ type: id === "all" ? "aiSetupAll" : "aiSetup" });   // Aside 세팅 (#s-aside · 허브 crew 화면 맨 위 한 줄 · 2026-10-19 사장님 1A) · #s-all = 세팅 현황
      else { const t = Dref.current.tasks.find((x) => x.id === id) || (Dref.current.removedFx || []).find((x) => x.id === id) || (Dref.current.removedTasks || []).find((x) => x.id === id); open({ type: t && t.isFixed ? "fixed" : "task", id, ...nt }); } };
    go(); window.addEventListener("hashchange", go); return () => window.removeEventListener("hashchange", go); }, []);
  // 시트 화면 상태(지난 일 정리 몇 번째 · 내 정리 탭·고른 것 · 프로젝트 탭)를 그 시트 칸에 적어 둠 → 위 시트에서 '뒤로' 오면 이어서
  const saveAt = (i, patch) => setStack((st) => st.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  useGhRefresh(D, ro ? null : cu);   // 그로홈 매출 합계 (마스터 기기 · 3시간에 한 번 · 보기 모드는 안 함)
  const ctx = { D, cu, A, open, back, closeAll, saveAt, seen, setSeen, setToast, TV, T, idx, meta, setMeta, logout, setTab, BUILD, view };
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
    myNotes: (p) => <MyNotesSheet {...p} />,
    readInbox: (p) => <ReadInboxSheet {...p} />,   // 읽은 알림 (2026-10-13 · 더보기 › 내 일)
    myKpi: (p) => <MyKpiSheet {...p} goToday={() => { setTab("today"); closeAll(); window.scrollTo(0, 0); }} />,
    lagInput: (p, s) => <LagSheet {...p} s={s} />,
    kpiEdit: (p, s) => <KpiEditSheet {...p} s={s} />,
    reports: (p) => <ReportSheet {...p} />,     // 월말 보고서 (reportui.jsx)
    growth: (p) => <GrowthSheet {...p} />,      // 그로스보드 v2 (growthui.jsx)
    search: (p, s) => <SearchSheet {...p} s={s} />,   // 찾기 (searchui.jsx · 오늘 머리 [찾기])
    viewAs: (p) => <ViewAsSheet {...p} />,      // 팀원 화면 보기 (viewasui.jsx · 리드·본부장·관리자)
  };
  return <div className="v2-app">
    <nav className="v2-nav" aria-label="메뉴">
      <div className="v2-brand">업무OS <span style={{ color: C.mute, fontWeight: 700 }}>v2</span></div>
      {TABS.map(([k, l]) => <button key={k} type="button" className={"v2-tab" + (tab === k ? " on" : "")} aria-current={tab === k ? "page" : undefined} onClick={() => { setTab(k); closeAll(); window.scrollTo(0, 0); }}>
        {l}{k === "today" && badge > 0 && <span className="v2-badge">{badge}</span>}
      </button>)}
    </nav>
    <div className="v2-main">
      {ro ? <ViewBar cu={cu} view={view} open={open} />
        : <div className="v2-trial">시험판 · 버전1 {at ? md(ymd(new Date(at))) : ""} 데이터 · 여기서 바꾼 건 버전1에 안 가요 <a href={V1_URL}>버전1 열기 ›</a></div>}
      <div className={"v2-page" + (tab === "today" ? " v2-today" : "")}>
        {tab === "today" && <TodayTab {...ctx} />}
        {tab === "calendar" && <CalendarTab {...ctx} />}
        {tab === "projects" && <ProjectsTab {...ctx} />}
        {tab === "more" && <MoreTab {...ctx} />}
      </div>
    </div>
    {top && <SheetRouter s={top} {...ctx} depth={stack.length} extra={extra} />}
    {ro && <ViewFrame cu={cu} sheet={!!top} />}
    <Toast toast={toast} onDone={() => setToast0(null)} />
  </div>;
}
