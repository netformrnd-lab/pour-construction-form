// 관리자 대시보드 (os2-admin.html) — 마스터 4명 전용 화면. 보안 경계가 아니라 화면을 나눈 것 (보안규칙 변경 없음)
// 탭 5개: 한눈에 · 사람 · 반복 실행 · 프로젝트 · 정리 / 머리 [설정] · 내 화면으로 ›
// 상세 시트는 sheets.jsx 공용 + 관리자 시트(사람 관리자판 · 설정 · 고르기 목록 · 순서 꼬임)를 덧붙임
import { useMemo, useState } from "react";
import { useBoot, Gate, useActs, LS } from "../core.jsx";
import { isMaster } from "../model.js";
import { turnIndex } from "../turn.js";
import { SheetRouter } from "../sheets.jsx";
import { C, TBtn, Toast, useLocal } from "../ui.jsx";
import { MY_URL } from "./common.jsx";
import { Glance } from "./Glance.jsx";
import { PeopleTab, PickSheet, DoneSheet } from "./People.jsx";
import { ProjectsTab, LaunchTools } from "./Projects.jsx";
import { TidyTab, OrderSheet } from "./Tidy.jsx";
import { SettingsSheet, LaunchOrderSheet } from "./Settings.jsx";
import { PersonAdmin } from "./PersonAdmin.jsx";
import { RoutineTab } from "./Routine.jsx";
import "./admin.css";

export default function AdminApp() {
  const B = useBoot(); const g = Gate({ B, title: "커머스본부 관리 대시보드" }); if (g) return g;
  if (!isMaster(B.cu)) return <NotMaster cu={B.cu} logout={B.logout} />;
  return <AdminMain key={B.cu.id} B={B} />;
}

// 같은 기기를 여러 사람이 쓰면 다른 사람으로 들어와 있을 수 있음 → 여기서 바로 바꾸기
function NotMaster({ cu, logout }) {
  return <div className="v2-center">
    <div style={{ width: "min(420px, 100%)", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.ink, lineHeight: 1.6 }}>관리자 화면은 마스터만 볼 수 있어요</p>
      {cu && <p style={{ margin: 0, fontSize: 14, color: C.sub }}>지금 {cu.name}님으로 들어와 있어요</p>}
      {logout && <button type="button" onClick={logout} className="a-mylink big" style={{ border: "none", background: "none", cursor: "pointer", font: "inherit" }}>다른 사람으로 들어가기 ›</button>}
      <a href={MY_URL} className="a-mylink big">내 화면으로 ›</a>
    </div>
  </div>;
}

const TABS = [["glance", "한눈에"], ["people", "사람"], ["routine", "반복 실행"], ["projects", "프로젝트"], ["tidy", "정리"]];

function AdminMain({ B }) {
  const { D, cu } = B;
  const [tab0, setTab] = useLocal(LS("atab-" + cu.id), "glance");
  const tab = TABS.some(([k]) => k === tab0) ? tab0 : "glance";
  const [tq, setTq] = useState("");            // 정리 탭에서 바로 열 묶음 (한눈에 위험 칸에서 넘어올 때)
  const [stack, setStack] = useState([]);      // 열린 시트들
  const [toast, setToast] = useState(null);
  const idx = useMemo(() => turnIndex(D), [D]);
  const A = useActs(D, cu, setToast, idx);
  const open = (s) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => st.slice(0, -1));
  const closeAll = () => setStack([]);
  const go = (k, q) => { setTab(k); setTq(q || ""); closeAll(); window.scrollTo(0, 0); };
  const saveAt = (i, patch) => setStack((st) => st.map((x, j) => (j === i ? { ...x, ...patch } : x)));   // 시트 화면 상태를 쌓인 칸에 적어 둠 (뒤로 와도 이어서)
  const base = { D, cu, A, idx, open, back, closeAll, saveAt, setToast, meta: B.meta, setMeta: B.setMeta, logout: B.logout, go };
  const ctx = { ...base, projectExtra: (p) => <LaunchTools p={p} {...base} /> };
  const extra = {
    person: (p, s) => <PersonAdmin {...p} id={s.id} />,
    personAdmin: (p, s) => <PersonAdmin {...p} id={s.id} />,
    settings: (p) => <SettingsSheet {...p} />,
    apick: (p, s) => <PickSheet {...p} s={s} />,
    adone: (p, s) => <DoneSheet {...p} s={s} />,
    order: (p) => <OrderSheet {...p} />,
    launchOrder: (p) => <LaunchOrderSheet {...p} />,
  };
  const top = stack[stack.length - 1];
  return <div className="v2-app a-app">
    <nav className="v2-nav" aria-label="관리 메뉴">
      <div className="v2-brand">관리 대시보드</div>
      {TABS.map(([k, l]) => <button key={k} type="button" className={"v2-tab" + (tab === k ? " on" : "")} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>{l}</button>)}
      <a className="a-navlink" href={MY_URL}>내 화면으로 ›</a>
    </nav>
    <div className="v2-main">
      <div className="v2-trial">시험판 v2 · 여기서 바꾼 건 버전1에 반영되지 않아요</div>
      <div className="v2-page">
        <div className="a-head">
          <b>관리 · {cu.name}</b>
          <span style={{ flex: 1 }} />
          <TBtn onClick={() => open({ type: "settings" })}>설정</TBtn>
          <a href={MY_URL} className="a-mylink">내 화면으로 ›</a>
        </div>
        {tab === "glance" && <Glance {...ctx} />}
        {tab === "people" && <PeopleTab {...ctx} />}
        {tab === "routine" && <RoutineTab {...ctx} />}
        {tab === "projects" && <ProjectsTab {...ctx} />}
        {tab === "tidy" && <TidyTab {...ctx} tq={tq} setTq={setTq} />}
      </div>
    </div>
    {top && <SheetRouter s={top} {...ctx} depth={stack.length} extra={extra} />}
    <Toast toast={toast} onDone={() => setToast(null)} />
  </div>;
}
