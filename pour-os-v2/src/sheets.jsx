// 업무OS v2 — 시트 길잡이 (실사용·관리자가 같이 씀). 같은 대상은 어디서 열어도 같은 시트
import { TaskSheet, FixedSheet } from "./task.jsx";
import { ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { PersonSheet, IssuesSheet, RiskSheet } from "./team.jsx";
import { AddSheet, MineSheet, FocusTriage } from "./today.jsx";

// extra: { [type]: (props, s) => element } — 관리자 앱 등에서 시트 종류를 덧붙일 때
export function SheetRouter({ s, depth, extra, ...ctx }) {
  const p = { ...ctx, onBack: depth > 1 ? ctx.back : null, onClose: ctx.closeAll };
  if (extra && extra[s.type]) return extra[s.type](p, s);
  if (s.type === "task") return <TaskSheet {...p} id={s.id} focus={s.focus} />;
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

