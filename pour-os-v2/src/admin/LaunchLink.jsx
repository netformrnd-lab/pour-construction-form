// 관리자 · 설정 › 신제품 대시보드 연결 — 1단계: 기존 담당 이름을 업무OS 사람으로 맞추기
// 미리 보기(이름 → 사람 · 칸 수 · 못 맞춘 이름) → 확인 → 통째 백업(v2 backups) → 단계마다 ownerIds 만 추가 (담당 이름은 그대로 · 그사이 담당이 바뀐 제품은 건너뜀)
import { useState } from "react";
import * as fb from "../fb.js";
import { nameOf } from "../model.js";
import { planOwnerIds } from "../launch.js";
import { C, Big, Card, Ask } from "../ui.jsx";

export function LaunchOwnerSync({ D, cu, A, setToast }) {
  const [st, setSt] = useState(null), [ask, setAsk] = useState(false);
  const plan = async () => { setSt({ step: "load" });
    try { const prods = await fb.readV1Launch(); setSt({ step: "ready", prods, pl: planOwnerIds(prods, D.users) }); }
    catch (e) { console.error("[v2 관리] 신제품 대시보드 읽기 실패:", e); setSt({ step: "err", msg: e.message }); } };
  const run = async () => { setAsk(false); const { prods, pl } = st; setSt({ ...st, step: "run" });
    try {
      const at = new Date().toISOString(), bid = "lb-owners-" + at.replace(/[^0-9]/g, "").slice(0, 14);
      await fb.backupLaunch(bid, prods, cu.id);
      const byP = {}; pl.changes.forEach((c) => { (byP[c.pid] = byP[c.pid] || []).push(c); });
      const ops = Object.entries(byP).map(([pid, cs]) => ({ id: pid,
        expect: Object.fromEntries(cs.map((c) => [`stages.${c.sid}.owner`, c.owner])),
        fields: { ...Object.fromEntries(cs.map((c) => [`stages.${c.sid}.ownerIds`, c.ids])), history: fb.arrayUnion({ at, by: `[업무OS] ${cu.name}`, text: `담당 ${cs.length}칸을 업무OS 사람으로 맞춤 (이름은 그대로)` }) } }));
      const r = await fb.patchLaunchIf(ops);
      A.log("edit", { col: "launch-board", targetId: "", label: `신제품 대시보드 담당 맞춤 · 제품 ${r.done}개 · ${pl.changes.length}칸${r.skipped.length ? ` · 그사이 바뀐 ${r.skipped.length}개 건너뜀` : ""} · 백업 ${bid}` });
      setSt({ step: "done", r, bid, n: pl.changes.length });
      setToast({ text: `담당 맞췄어요 · 제품 ${r.done}개${r.skipped.length ? ` · ${r.skipped.length}개는 그사이 바뀌어서 건너뜀` : ""}` });
    } catch (e) { console.error("[v2 관리] 담당 맞추기 실패:", e); setSt({ step: "err", msg: e.message }); }
  };
  const pl = st && st.pl;
  return <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
    <div style={{ color: C.text }}>신제품 대시보드 담당 이름(민지·정하 …)을 업무OS 사람과 이어요. <b>담당 이름은 바꾸지 않고</b> 사람 번호만 더해요. 쓰기 전에 신제품 대시보드 전체를 백업해요.</div>
    {(!st || st.step === "err") && <div style={{ marginTop: 10 }}><Big tone="white" onClick={plan}>담당 맞추기 · 미리 보기</Big></div>}
    {st && st.step === "err" && <p role="alert" style={{ margin: "10px 0 0", color: C.ink, fontWeight: 800 }}>못 했어요: {st.msg}</p>}
    {st && st.step === "load" && <div style={{ marginTop: 10 }}><Big disabled>신제품 대시보드 읽는 중…</Big></div>}
    {st && (st.step === "ready" || st.step === "run") && <div role="status" style={{ marginTop: 10 }}>
      <div><b style={{ color: C.ink }}>제품 {pl.products}개 · {pl.changes.length}칸</b>을 맞춰요</div>
      {pl.pairs.map(([k, n]) => { const [nm, id] = k.split("→"); return <div key={k}>{nm} → <b style={{ color: C.ink }}>{nameOf(D.users, id) || id}</b> · {n}칸</div>; })}
      {pl.miss.length > 0 ? <div style={{ marginTop: 6, color: C.ink }}>못 맞춘 이름 (그대로 둠): {pl.miss.map(([n, c]) => `${n} ${c}칸`).join(" · ")}</div> : <div style={{ marginTop: 6 }}>못 맞춘 이름 없음</div>}
      {pl.changes.length === 0 ? <div style={{ marginTop: 8 }}>이미 모두 맞춰져 있어요</div>
        : <div style={{ display: "flex", gap: 8, marginTop: 10 }}><Big tone="white" onClick={() => setSt(null)} style={{ flex: 1 }}>그만</Big><Big disabled={st.step === "run"} onClick={() => setAsk(true)} style={{ flex: 2 }}>{st.step === "run" ? "맞추는 중…" : `맞추기 · ${pl.changes.length}칸`}</Big></div>}
    </div>}
    {st && st.step === "done" && <div role="status" style={{ marginTop: 10, color: C.text }}>맞췄어요 · 제품 {st.r.done}개{st.r.skipped.length ? ` · 그사이 바뀐 ${st.r.skipped.length}개는 건너뜀(다시 미리 보기)` : ""} · 백업 {st.bid}</div>}
    {ask && <Ask title="담당 맞추기" body={`신제품 대시보드 ${pl.changes.length}칸에 업무OS 사람 번호를 더할까요?\n담당 이름은 그대로예요. 먼저 전체를 백업해요.`} yes="맞추기" onNo={() => setAsk(false)} onYes={run} />}
  </Card>;
}
