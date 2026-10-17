// 업무OS v2 — 시트 길잡이 (실사용·관리자가 같이 씀). 같은 대상은 어디서 열어도 같은 시트
import { Fragment } from "react";
import { TaskSheet } from "./task.jsx";
import { RoutineSheet } from "./rtsheet.jsx";
import { ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { PersonSheet, IssuesSheet, RiskSheet } from "./team.jsx";
import { AddSheet, MineSheet, FocusTriage } from "./today.jsx";
import { useTask } from "./task.jsx";
import { LockSheet } from "./secretui.jsx";
import { TplSaveSheet, TplBoxSheet, TplSheet, TplNewSheet } from "./tplui.jsx";
import { AiAskSheet, AiMateSheet, AiTeamSheet, AiSetupSheet, AiReqSheet } from "./aiui.jsx";
import { AiReportSheet } from "./aireport.jsx";
import { ApprSheet, ApprOneSheet } from "./apprui.jsx";
import { Sheet, Empty } from "./ui.jsx";
import { DevReqSheet, DevPlanSheet } from "./devreq.jsx";
import { RefSheet, RefOneSheet } from "./refui.jsx";
import { FeedSheet } from "./feedui.jsx";

// extra: { [type]: (props, s) => element } — 관리자 앱 등에서 시트 종류를 덧붙일 때
// 시트마다 key(깊이·종류·id) → 업무에서 다른 업무로 넘어가도 앞 업무에 쓰던 글·고른 것·스크롤이 따라가지 않음
// save(patch): 이 시트의 쌓인 칸(stack entry)에 화면 상태를 적어 둠 → 위 시트를 닫고 돌아오면 이어서 (ctx.saveAt 이 없으면 아무것도 안 함)
export function SheetRouter({ s, depth, extra, ...ctx }) {
  const save = ctx.saveAt ? (patch) => ctx.saveAt(depth - 1, patch) : () => {};
  const p = { ...ctx, save, onBack: depth > 1 ? ctx.back : null, onClose: ctx.closeAll };
  const k = `${depth}:${s.type}:${s.id || ""}:${s.focus || ""}:${s.note || ""}`;
  return <Fragment key={k}>{route(s, p, extra)}</Fragment>;
}
function route(s, p, extra) {
  if (extra && extra[s.type]) return extra[s.type](p, s);
  if (s.type === "task") return <TaskGate {...p} id={s.id} focus={s.focus} note={s.note} />;
  if (s.type === "fixed" || s.type === "routine") return <RoutineSheet {...p} type={s.type} id={s.id} focus={s.focus} note={s.note} />;   // 고정업무·정한 날 체크 / 횟수 목표 — 한 부품 (rtsheet.jsx)
  if (s.type === "project") { const x = (p.D.projects || []).find((q) => q.id === s.id); if (x && x.locked) return <LockSheet D={p.D} x={x} kind="project" onBack={p.onBack} onClose={p.onClose} />;
    return <ProjectSheet {...p} id={s.id} first={s.first} note={s.note} st={s} />; }
  if (s.type === "person") return <PersonSheet {...p} id={s.id} />;
  if (s.type === "add") return <AddSheet {...p} preset={s.preset || {}} />;
  if (s.type === "newProject") return <NewProjectSheet {...p} cat={s.cat} />;
  if (s.type === "mine") return <MineSheet {...p} />;
  if (s.type === "issues") return <IssuesSheet {...p} />;
  if (s.type === "doneProjects") return <DoneProjectsSheet {...p} />;
  if (s.type === "triage") return <FocusTriage {...p} st={s} />;
  if (s.type === "risk") return <RiskSheet {...p} />;
  // 견본(템플릿 · 2026-10-07 ②): 견본함 · 견본 한 장 · 견본으로 저장 · 견본으로 새 프로젝트 (두 앱 같은 시트)
  if (s.type === "templates") return <TplBoxSheet {...p} />;
  if (s.type === "template") return <TplSheet {...p} id={s.id} />;
  if (s.type === "tplSave") return <TplSaveSheet {...p} id={s.id} />;
  if (s.type === "tplNew") return <TplNewSheet {...p} id={s.id} />;
  // AI 팀원 · AI 승인 (2026-10-12 · aiui.jsx · 두 앱 같은 시트)
  if (s.type === "aiask") return <AiAskSheet {...p} id={s.id} focus={s.focus} note={s.note} />;
  if (s.type === "aiMate") return <AiMateSheet {...p} id={s.id} />;
  if (s.type === "aiTeam") return <AiTeamSheet {...p} />;
  if (s.type === "aiSetup") return <AiSetupSheet {...p} owner={s.owner} />;   // 내 PC Aside 세팅 (2026-10-15)
  if (s.type === "aiReq") return <AiReqSheet {...p} mate={s.mate} preset={s.preset} />;
  if (s.type === "devreq") return <DevReqSheet {...p} app={s.app} tab0={s.tab} />;
  if (s.type === "devplan") return <DevPlanSheet {...p} ym={s.ym} />;   // 이달 개발 목록 (2026-10-17 · 김송희 확인 → 주말 개발)
  // 레퍼런스 (2026-10-17 · refui.jsx · 두 앱 같은 시트): 모두 보는 곳(종류·브랜드·연결로 거르기 · 올리기) · 한 장(AI 핏 · 대화)
  if (s.type === "refs") return <RefSheet {...p} s={s} />;
  if (s.type === "ref") return <RefOneSheet {...p} id={s.id} focus={s.focus} note={s.note} />;   // 개발 수정 요청 포스트잇 (2026-10-16 · 팀 앱·관리자 같은 시트)   // AI에게 업무 맡기기 (2026-10-15)
  // 구매 품의 요청 (2026-10-16 · apprui.jsx · 두 앱 같은 시트): 목록(내 요청 · 내가 맡은 것 · 모두) · 한 건
  if (s.type === "appr") return <ApprSheet {...p} s={s} />;
  if (s.type === "apprOne") return <ApprOneSheet {...p} id={s.id} item={s.item} />;
  if (s.type === "aiReport") return <AiReportSheet {...p} crew={s.crew} start={s.start} />;   // AI 크루 보고서 (2026-10-15 · 크루 칸별 · 금요일 리드 → 본부장)
  if (s.type === "feeds") return <FeedSheet {...p} />;   // 결과 숫자 · 들어온 날 (2026-10-17 · feedui.jsx)
  return null;
}

// 기밀: 허용 안 된 사람이 업무를 열면 내용 대신 안내만 (지난 업무를 서버에서 읽어 온 것도 같이)
function TaskGate(p) { const t = useTask(p.D, p.id);
  if (t && t.locked) return <LockSheet D={p.D} x={t} kind="task" onBack={p.onBack} onClose={p.onClose} />;
  if (t === null || t === undefined) return <Sheet title="업무" kind="업무" onBack={p.onBack} onClose={p.onClose}><Empty>불러오는 중…</Empty></Sheet>;   // 기밀인지 알기 전엔 내용·댓글을 안 그림
  return <TaskSheet {...p} />; }
