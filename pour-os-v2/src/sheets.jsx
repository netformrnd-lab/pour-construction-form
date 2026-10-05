// 업무OS v2 — 시트 길잡이 (실사용·관리자가 같이 씀). 같은 대상은 어디서 열어도 같은 시트
import { Fragment } from "react";
import { TaskSheet, FixedSheet } from "./task.jsx";
import { ProjectSheet, NewProjectSheet, DoneProjectsSheet } from "./project.jsx";
import { PersonSheet, IssuesSheet, RiskSheet } from "./team.jsx";
import { AddSheet, MineSheet, FocusTriage } from "./today.jsx";
import { useTask } from "./task.jsx";
import { LockSheet } from "./secretui.jsx";
import { Sheet, Empty } from "./ui.jsx";

// extra: { [type]: (props, s) => element } — 관리자 앱 등에서 시트 종류를 덧붙일 때
// 시트마다 key(깊이·종류·id) → 업무에서 다른 업무로 넘어가도 앞 업무에 쓰던 글·고른 것·스크롤이 따라가지 않음
// save(patch): 이 시트의 쌓인 칸(stack entry)에 화면 상태를 적어 둠 → 위 시트를 닫고 돌아오면 이어서 (ctx.saveAt 이 없으면 아무것도 안 함)
export function SheetRouter({ s, depth, extra, ...ctx }) {
  const save = ctx.saveAt ? (patch) => ctx.saveAt(depth - 1, patch) : () => {};
  const p = { ...ctx, save, onBack: depth > 1 ? ctx.back : null, onClose: ctx.closeAll };
  const k = `${depth}:${s.type}:${s.id || ""}:${s.focus || ""}`;
  return <Fragment key={k}>{route(s, p, extra)}</Fragment>;
}
function route(s, p, extra) {
  if (extra && extra[s.type]) return extra[s.type](p, s);
  if (s.type === "task") return <TaskGate {...p} id={s.id} focus={s.focus} />;
  if (s.type === "fixed") return <FixedSheet {...p} id={s.id} />;
  if (s.type === "project") { const x = (p.D.projects || []).find((q) => q.id === s.id); if (x && x.locked) return <LockSheet D={p.D} x={x} kind="project" onBack={p.onBack} onClose={p.onClose} />;
    return <ProjectSheet {...p} id={s.id} first={s.first} st={s} />; }
  if (s.type === "person") return <PersonSheet {...p} id={s.id} />;
  if (s.type === "add") return <AddSheet {...p} preset={s.preset || {}} />;
  if (s.type === "newProject") return <NewProjectSheet {...p} cat={s.cat} />;
  if (s.type === "mine") return <MineSheet {...p} />;
  if (s.type === "issues") return <IssuesSheet {...p} />;
  if (s.type === "doneProjects") return <DoneProjectsSheet {...p} />;
  if (s.type === "triage") return <FocusTriage {...p} st={s} />;
  if (s.type === "risk") return <RiskSheet {...p} />;
  return null;
}

// 기밀: 허용 안 된 사람이 업무를 열면 내용 대신 안내만 (지난 업무를 서버에서 읽어 온 것도 같이)
function TaskGate(p) { const t = useTask(p.D, p.id);
  if (t && t.locked) return <LockSheet D={p.D} x={t} kind="task" onBack={p.onBack} onClose={p.onClose} />;
  if (t === null || t === undefined) return <Sheet title="업무" kind="업무" onBack={p.onBack} onClose={p.onClose}><Empty>불러오는 중…</Empty></Sheet>;   // 기밀인지 알기 전엔 내용·댓글을 안 그림
  return <TaskSheet {...p} />; }
