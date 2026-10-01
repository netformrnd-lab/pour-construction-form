// ✅ 행동지표 체크리스트 — 계산만 (화면은 App.jsx 의 AkRunCard·AkRunSheet)
// · 행동지표마다 체크리스트(steps)를 선택으로 둔다: [{id,title,owner,confirm}] — 없으면 예전처럼 +1
// · '시작'하면 실행 1건 = 문서 1개 pour-os/ak-runs/r/{id} {akId,title,steps(그때 목록),checks,by,status,counted}
// · 다 체크하면 그 행동지표 +1 (마지막 체크한 날의 주, 시작한 사람 실적) · 하나를 풀면 −1 (두 번 안 셈)
// · confirm 단계는 컨펌 요청이 승인되면 자동 체크
export const RUN_COL = "pour-os/ak-runs/r";
export const runNoteId = (id) => "akrun:" + id;
export const cleanSteps = (a) => (Array.isArray(a) ? a : []).map((s) => ({ id: s.id || "st" + Math.random().toString(36).slice(2, 8), title: String(s.title || "").trim(), owner: s.owner || "", confirm: !!s.confirm })).filter((s) => s.title);
export const runSteps = (run) => (run && Array.isArray(run.steps) ? run.steps : []);
export const runChecks = (run) => (run && run.checks) || {};
export const runNext = (run) => runSteps(run).find((s) => !runChecks(run)[s.id]) || null;
export const runProgress = (run) => { const st = runSteps(run), ck = runChecks(run); return { done: st.filter((s) => ck[s.id]).length, total: st.length }; };
export const runAllDone = (run) => { const p = runProgress(run); return p.total > 0 && p.done === p.total; };
// 다음 단계 담당 (단계 담당이 비면 시작한 사람)
export const runTurnOwner = (run) => { const nx = runNext(run); return nx ? (nx.owner || run.by || "") : ""; };
// 한 단계 체크/해제 → {patch, count:+1|-1|0, wk}
export function runToggle(run, sid, actor, wkOf, now = new Date()) {
  const ck = { ...runChecks(run) };
  if (ck[sid]) delete ck[sid]; else ck[sid] = { at: now.toISOString(), by: actor ? actor.id : "", byName: actor ? actor.name || "" : "" };
  const next = { ...run, checks: ck };
  const all = runAllDone(next);
  const patch = { checks: ck, status: all ? "done" : "open", updatedAt: now.toISOString() };
  let count = 0, wk = "";
  if (all && !run.counted) { wk = wkOf(now); count = 1; patch.counted = { wk, at: now.toISOString() }; patch.doneAt = now.toISOString(); }
  else if (!all && run.counted) { wk = run.counted.wk; count = -1; patch.counted = null; patch.doneAt = null; }
  return { patch, count, wk };
}
// 컨펌 승인 → 아직 안 한 첫 컨펌 단계 id
export const runConfirmStep = (run) => { const ck = runChecks(run); const s = runSteps(run).find((x) => x.confirm && !ck[x.id]); return s ? s.id : null; };
// 오늘: 내 차례인 실행 (시작한 사람 것은 행동지표 칸에서 보이므로 mineOnly=false 면 남이 시작한 것만)
export function runTurns(runs, uid, { exceptMine = false } = {}) {
  return (runs || []).filter((r) => r && !r.deleted && r.status !== "done" && runTurnOwner(r) === uid && (!exceptMine || r.by !== uid))
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
export const openRunsOf = (runs, akId) => (runs || []).filter((r) => r && !r.deleted && r.akId === akId && r.status !== "done").sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
