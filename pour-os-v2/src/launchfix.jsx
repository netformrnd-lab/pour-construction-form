// 업무OS v2 — 신제품 '출시보다 늦는 항목' 바로 고치기 카드 (프로젝트 한 장 맨 위 · 문제가 있을 때만)
// 늦는 항목 = 출시 전에 끝낼 열린 항목(끝냄·확인 대기·보류·해당 없음 빼고) 중 기한이 출시일보다 뒤 (turn.js '출시보다 늦음'과 같은 기준)
// [출시일 1주 미루기] [2주] [날짜 고르기] → 미리 보기(옮겨질 자동 기한 n개 · 사람이 정한 기한 n개 그대로 · 늦음 a → b) → [이대로 바꾸기] (A.setLaunchDate · 5초 되돌리기 · 신제품 대시보드엔 3단계부터)
// [출시일 그대로 · 남은 항목 기한 다시 나누기] → launch.rebalanceLaunch 미리 보기 → A.applyDues
// 책임자·마스터만 버튼 · 그 밖엔 안내 + 책임자에게 묻기
import { useState } from "react";
import { ymd, md, addDays, nextWorkday, dueOf, isDone, nameOf, isMaster } from "./model.js";
import { rebalanceLaunch, preLaunchItem } from "./launch.js";
import { previewLaunchMove } from "./views.js";
import { C, Big, TBtn, Ask } from "./ui.jsx";

const openItem = (t) => t.launchItem && !isDone(t) && !["review", "dropped", "hold"].includes(t.status);
export function launchLate(p, D) {
  const ts = (D.tasks || []).filter((t) => t.projectId === p.id && openItem(t));
  return { open: ts, late: p.launchDate ? ts.filter((t) => preLaunchItem(t.launchItem) && dueOf(t) && dueOf(t) > p.launchDate) : [] };   // 출시 전에 끝낼 항목만
}

export function LaunchFix({ p, D, A, cu, open }) {
  const key = ymd(new Date()), [sel, setSel] = useState(""), [busy, setBusy] = useState(false), [ask, setAsk] = useState(false);
  if (!p || !p.launchDate) return null;
  const { open: openT, late } = launchLate(p, D), passed = p.launchDate < key;
  if (!late.length && !(passed && openT.length)) return null;
  const can = p.assigneeId === cu.id || isMaster(cu);
  const base = p.launchDate > key ? p.launchDate : key, d1 = nextWorkday(addDays(base, 7)), d2 = nextWorkday(addDays(base, 14));
  const projTasks = (D.tasks || []).filter((t) => t.projectId === p.id && t.launchItem);
  // 미리 보기
  let pv = null;
  if (sel && sel !== "rb") { const m = previewLaunchMove(p, D, sel, key), nd = new Map(m.changes.map((x) => [x.task.id, x.due]));
    pv = { kind: "move", n: m.changes.length, keep: m.keep, after: openT.filter((t) => preLaunchItem(t.launchItem) && (nd.get(t.id) || dueOf(t)) > sel).length, changes: m.changes }; }
  const rb = p.launchDate > key ? rebalanceLaunch(projTasks, p.launchDate, key) : [];
  if (sel === "rb") { const nd = new Map(rb.map((x) => [x.task.id, x.due]));
    pv = { kind: "rb", n: rb.length, keep: openT.filter((t) => !t.dueAuto).length, after: openT.filter((t) => preLaunchItem(t.launchItem) && (nd.get(t.id) || dueOf(t)) > p.launchDate).length, changes: rb }; }
  const go = async () => { setAsk(false); setBusy(true);
    const ok = sel === "rb" ? await A.applyDues(rb, `${p.title} 출시일 그대로 · 남은 항목 기한 다시 나누기`) : await A.setLaunchDate(p, sel);
    setBusy(false); if (ok) setSel(""); };
  const head = late.length ? `출시일(${md(p.launchDate)})보다 늦는 항목 ${late.length}개` : `출시일(${md(p.launchDate)})이 지났는데 남은 항목 ${openT.length}개`;
  return <div className="v2-lfix" role="region" aria-label="출시일·기한 고치기">
    <b className="h">{head}</b>
    <div className="s">{can ? "출시일을 미루거나, 출시일은 두고 남은 항목 기한을 당겨요" : `책임 ${nameOf(D.users, p.assigneeId) || "없음"}님이 출시일이나 기한을 고칠 수 있어요`}</div>
    {can ? <>
      <div className="row">
        <TBtn v={sel === d1 ? "solid" : "soft"} onClick={() => setSel(sel === d1 ? "" : d1)}>출시일 1주 미루기 → {md(d1)}</TBtn>
        <TBtn v={sel === d2 ? "solid" : "soft"} onClick={() => setSel(sel === d2 ? "" : d2)}>2주 → {md(d2)}</TBtn>
        <input type="date" className="v2-sel" aria-label="새 출시일 고르기" min={key} value={sel && sel !== "rb" && sel !== d1 && sel !== d2 ? sel : ""} onChange={(e) => setSel(e.target.value)} />
      </div>
      <div className="row"><TBtn v={sel === "rb" ? "solid" : "line"} disabled={!rb.length} onClick={() => setSel(sel === "rb" ? "" : "rb")}>출시일 그대로 · 남은 항목 기한 다시 나누기</TBtn></div>
      {!rb.length && <div className="s">출시일이 오늘이거나 지나서 기한을 나눌 날이 없어요 · 출시일을 미뤄 주세요</div>}
      {pv && <div className="pv" role="status">
        <div>미리 보기 · {pv.kind === "move" ? <b>출시일 {md(p.launchDate)} → {md(sel)}</b> : <b>출시일 {md(p.launchDate)} 그대로</b>}</div>
        <div>{pv.kind === "move" ? "자동 기한" : "남은"} 항목 <b>{pv.n}개</b>가 {pv.kind === "move" ? "같이 옮겨져요" : "출시일 안으로 다시 나뉘어요"}</div>
        <div>사람이 정한 기한 {pv.keep}개는 그대로 · 출시보다 늦음 {late.length} → <b>{pv.after}</b>{pv.after ? " (남은 건 업무에서 기한 바꾸기)" : ""}</div>
        {pv.n > 100 ? <div className="s">한 번에 100개까지라 나눠서 해 주세요</div>
          : <Big disabled={busy || !pv.n} onClick={() => (pv.n >= 30 ? setAsk(true) : go())} style={{ marginTop: 10 }}>{busy ? "바꾸는 중…" : pv.n ? "이대로 바꾸기" : "옮겨질 항목이 없어요"}</Big>}
        <div className="s" style={{ textAlign: "center" }}>5초 안에 되돌릴 수 있어요</div>
      </div>}
    </> : <div className="row"><TBtn v="soft" onClick={() => open({ type: "project", id: p.id, first: "news" })}>책임자에게 묻기 ›</TBtn></div>}
    {ask && pv && <Ask title={pv.kind === "move" ? "출시일 바꾸기" : "기한 다시 나누기"} body={`${pv.n}개 항목 기한이 바뀌어요.\n5초 안에 되돌릴 수 있어요.`} yes="바꾸기" onNo={() => setAsk(false)} onYes={go} />}
  </div>;
}
