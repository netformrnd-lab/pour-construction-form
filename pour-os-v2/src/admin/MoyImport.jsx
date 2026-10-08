// 관리자 · 설정 › 모여라딜 OS 최신 데이터 가져오기 (사용자 결정 2026-10-08 '새 것 + 업무OS에서 안 고친 것만 최신으로' · 계속 맞추기 없음 · 버튼 한 번)
//  [무엇이 들어올지 보기] = 모여라딜 OS 를 REST 로 읽기만 + 업무OS v2 의 모여라딜 문서·댓글·기록을 읽기만 → moysync.planMoySync (쓰기 0)
//  [확인 — n건 넣기] = 새 것 createMissing(없을 때만) · 최신으로 = patchManyIf(미리 볼 때 본 값 그대로일 때만 · 연결이 끊기면 안 씀) · 모여라딜 활동 기록(없을 때만)
//     → meta.moyImport {at, by, counts, kept(업무OS 것으로 정한 id · 다음번에도 그대로)} · 기록 1건(action moyImport · 바꾼 칸의 이전 값 prev) · [최신으로 바꾼 n건 되돌리기]
//  쓰기는 pour-os/v2 만 · 지우기·숨기기 없음 · 업무OS 휴지통에 있는 것은 그대로
import { useState } from "react";
import * as fb from "../fb.js";
import { md, ymd, hm, isMaster } from "../model.js";
import { nowIso } from "../core.jsx";
import { MOY_FROM, MOY_COLS, MOY_L, MOY_WHY, planMoySync, readMoySrc, moyKeptNext } from "../moysync.js";
import { C, TBtn, Card } from "../ui.jsx";

const FL = { title: "이름", status: "상태", statusLog: "상태 기록", dueDate: "기한", assigneeId: "담당", assigneeIds: "담당", collaboratorIds: "함께", memo: "메모", parentId: "상위 업무", projectId: "프로젝트",
  currentValue: "지금 값", targetValue: "목표", valueHistory: "값 기록", valueAt: "값", priority: "중요도", workDate: "작업일", attachments: "파일", mainKPIId: "KPI", subKPIId: "KPI", brand: "브랜드", doneAt: "끝낸 때", doneBy: "끝낸 사람", doneByName: "끝낸 사람", recurType: "반복", weekDay: "요일", monthDay: "날짜", fixedTime: "시간", group: "묶음", unit: "단위" };
const fl = (fs) => [...new Set((fs || []).map((f) => FL[f] || f))].join(" · ");
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const kinds = (c) => MOY_COLS.filter((k) => c[k]).map((k) => `${MOY_L[k]} ${c[k]}`).join(" · ");
const sum = (c) => MOY_COLS.reduce((a, k) => a + (c[k] || 0), 0);
const when = (iso) => (iso ? `${md(ymd(new Date(iso)))} ${hm(iso)}` : "");

function Few({ rows, line, n0 = 5, label }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const vis = all ? rows : rows.slice(0, n0);
  return <div className="a-moyl" aria-label={label}>{vis.map((r) => <div key={r.key + r.id} className="ln">{line(r)}</div>)}
    {rows.length > n0 && <TBtn v="plain" onClick={() => setAll(!all)} style={{ padding: "2px 0", minHeight: 28 }}>{all ? "접기 ▴" : `${rows.length - n0}개 더 ▾`}</TBtn>}</div>;
}

export function MoyImport({ D, cu, A, meta, setMeta, setToast }) {
  const [st, setSt] = useState(null);   // {step:'load'|'ready'|'run'|'done'|'err', plan, n, total, msg, r, doneUpd, kept0}
  if (!isMaster(cu)) return null;
  const last = meta && meta.moyImport;
  // ① 미리 보기 (읽기만)
  const load = async () => {
    setSt({ step: "load" });
    try {
      const src = await readMoySrc((u) => fetch(u));
      const got = await Promise.all(MOY_COLS.map((k) => fb.fetchWhere(k, ["importedFrom", "==", MOY_FROM])));
      const V = Object.fromEntries(MOY_COLS.map((k, i) => [k, got[i].map((x) => ({ ...x, id: x.id || x._doc }))]));
      const ids = MOY_COLS.flatMap((k) => V[k].map((x) => x.id));
      const nids = [...V.projects.map((p) => "proj:" + p.id), ...V.tasks.map((t) => "task:" + t.id)];
      const notes = (await Promise.all(chunk(nids, 30).map((c) => fb.fetchWhere("notes", ["itemId", "in", c])))).flat();
      const logs = (await Promise.all(chunk(ids, 30).map((c) => fb.fetchWhere("log", ["targetId", "in", c])))).flat()
        .filter((l) => l && l.importedFrom !== MOY_FROM && !l.imported);   // 모여라딜에서 가져온 기록은 업무OS 손길이 아님
      let m = meta; try { m = (await fb.getMeta()) || meta; } catch (e) { console.warn("[모여라딜 가져오기] 복사 정보 다시 읽기 실패 · 화면 값으로:", e); }
      const kept0 = (m && m.moyImport && m.moyImport.kept) || [];
      const plan = planMoySync(src, { ...V, users: D.users || [], brands: D.brands || [], noteItems: new Set(notes.map((n) => n.itemId)), logTargets: new Set(logs.map((l) => l.targetId)),
        kpiOv: new Set(((D.kpi && D.kpi.ov) || []).map((o) => o.id || o._doc)), sticky: new Set(kept0) }, { at: nowIso(), cu: { id: cu.id, name: cu.name } });
      if (plan.error) throw new Error(plan.error);
      console.log("[모여라딜 가져오기] 미리 보기", plan.counts);
      setSt({ step: "ready", plan, kept0 });
    } catch (e) { console.error("[모여라딜 가져오기] 읽기 실패:", e); setSt({ step: "err", msg: e.message || String(e) }); }
  };
  // ② 넣기 (조건부 · 묶음)
  const run = async () => {
    const pl = st.plan, total = pl.add.length + pl.upd.length + pl.logs.length, r = { made: 0, had: 0, done: 0, skipped: [], logs: 0 }; let n = 0;
    setSt({ ...st, step: "run", n: 0, total });
    const tick = (k) => { n += k; setSt((s) => ({ ...s, n })); };
    try {
      for (const part of chunk(pl.add, 100)) { const x = await fb.createMissing(part.map((o) => ({ key: o.key, id: o.id, data: o.data }))); r.made += x.made; r.had += x.skipped; tick(part.length); }
      for (const part of chunk(pl.upd, 50)) { const x = await fb.patchManyIf(part.map((o) => ({ key: o.key, id: o.id, expect: o.expect, fields: o.fields })), { noFallback: true }); r.done += x.done; r.skipped.push(...x.skipped); tick(part.length); }
      for (const part of chunk(pl.logs, 200)) { const x = await fb.createMissing(part.map((e) => ({ key: "log", id: e.id, data: e }))); r.logs += x.made; tick(part.length); }
      const skip = new Set(r.skipped), doneUpd = pl.upd.filter((o) => !skip.has(o.id));
      const counts = { add: r.made, upd: r.done, keep: pl.keep.length, skipped: r.skipped.length, logs: r.logs };
      const mm = { moyImport: { at: pl.at, by: cu.id, byName: cu.name, counts, kept: moyKeptNext(st.kept0, pl) } };
      await fb.setMeta(mm); setMeta && setMeta({ ...(meta || {}), ...mm });
      // 기록: 바꾼 칸의 이전 값(되돌리기용) — 크면 백업 문서로
      const prev = { upd: doneUpd.map((o) => ({ key: o.key, id: o.id, prev: o.prev, next: o.fields })), made: pl.add.map((o) => ({ key: o.key, id: o.id })) };
      const big = JSON.stringify(prev).length > 400000, bid = "moy-" + pl.at.replace(/[^0-9]/g, "").slice(0, 14);
      if (big) await fb.put("backups", bid, { id: bid, kind: "moyImport", at: pl.at, by: cu.id, count: doneUpd.length, json: JSON.stringify(prev) });
      A.log("moyImport", { col: "meta", targetId: "", label: `모여라딜 OS 최신 데이터 가져오기 · 새로 ${r.made} · 최신으로 ${r.done} · 업무OS 것 그대로 ${pl.keep.length}${r.skipped.length ? ` · 그사이 바뀌어 건너뜀 ${r.skipped.length}` : ""}${r.logs ? ` · 활동 기록 ${r.logs}` : ""}`,
        ids: [...pl.add.map((o) => o.id), ...doneUpd.map((o) => o.id)], ...(big ? { prevRef: "backups/" + bid } : { prev }) });
      setSt({ step: "done", plan: pl, r, doneUpd });
      setToast({ text: `가져왔어요 · 새로 ${r.made} · 최신으로 ${r.done}${r.skipped.length ? ` · ${r.skipped.length}건은 그사이 바뀌어서 그대로 뒀어요` : ""}` });
    } catch (e) { console.error("[모여라딜 가져오기] 넣기 실패:", e); setSt({ step: "err", msg: `${e.message || e} · 다시 보기를 누르면 들어간 것은 빼고 다시 셀 수 있어요`, partial: { ...r, n } }); }
  };
  // ③ 방금 최신으로 바꾼 것 되돌리기 (그사이 아무도 안 고친 것만)
  const undo = async () => {
    const ops = st.doneUpd; setSt({ ...st, step: "undo" });
    try { const x = await fb.patchManyIf(ops.map((o) => ({ key: o.key, id: o.id, expect: o.fields, fields: o.prev })), { noFallback: true });
      A.log("moyImport", { col: "meta", targetId: "", label: `모여라딜 OS 가져오기 되돌림 · ${x.done}건${x.skipped.length ? ` · ${x.skipped.length}건은 그사이 바뀌어 그대로` : ""}`, ids: ops.map((o) => o.id) });
      setToast({ text: x.skipped.length ? `되돌렸어요 · ${x.skipped.length}건은 그사이 바뀌어서 그대로 뒀어요` : "되돌렸어요" });
      setSt({ ...st, step: "done", doneUpd: [], undone: x.done }); }
    catch (e) { console.error("[모여라딜 가져오기] 되돌리기 실패:", e); setSt({ ...st, step: "done" }); setToast({ text: "되돌리지 못했어요 · 인터넷 연결을 확인해 주세요" }); }
  };
  const pl = st && st.plan, c = pl && pl.counts;
  const userLine = pl && pl.people.map((p) => `${p.from} → ${p.to || "담당 비움"}`).join(" · ");
  return <div className="a-moy"><Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
    <div style={{ color: C.text }}>모여라딜 OS를 <b>읽기만</b> 해서 업무OS에 없는 새 것과, 업무OS에서 안 고친 것만 최신으로 바꿔요. 업무OS에서 고친 것·휴지통에 있는 것은 그대로예요. 지우는 것은 없어요.</div>
    {last && last.at && <div style={{ marginTop: 4 }}>지난번 {when(last.at)} · {last.byName || ""} · 새로 {(last.counts && last.counts.add) || 0} · 최신으로 {(last.counts && last.counts.upd) || 0}</div>}
    {(!st || st.step === "err") && <div style={{ marginTop: 10 }}><TBtn v="solid" onClick={load}>무엇이 들어올지 보기</TBtn></div>}
    {st && st.step === "err" && <p role="alert" style={{ margin: "8px 0 0", color: C.ink, fontWeight: 800 }}>{st.partial ? "넣다가 멈췄어요" : "못 읽었어요"}: {st.msg}</p>}
    {st && st.step === "load" && <div role="status" style={{ marginTop: 10, color: C.ink, fontWeight: 800 }}>모여라딜 OS 읽고 비교하는 중…</div>}
    {pl && (st.step === "ready" || st.step === "run") && <div className="a-prev" role="status">
      <div className="a-moyg">
        <div className="a-moyn"><span>새로</span><b>{sum(c.add)}</b><i>{kinds(c.add) || "없음"}</i></div>
        <div className="a-moyn"><span>최신으로 바뀜</span><b>{sum(c.upd)}</b><i>{kinds(c.upd) || "없음"}</i></div>
        <div className="a-moyn"><span>업무OS에서 고쳐서 그대로</span><b>{sum(c.keep)}</b><i>{kinds(c.keep) || "없음"}</i></div>
        <div className="a-moyn"><span>같음</span><b>{c.same}</b><i>바꿀 것 없음</i></div>
      </div>
      {pl.add.length > 0 && <><div className="a-moyh">새로 {pl.add.length}</div><Few label="새로 들어올 것" rows={pl.add} line={(r) => <>{MOY_L[r.key]} · <b>{r.title}</b>{r.fold ? ` · ${r.fold === "dropped" ? "중단" : "보류"}으로 접음` : ""}</>} /></>}
      {pl.upd.length > 0 && <><div className="a-moyh">최신으로 바뀜 {pl.upd.length}</div><Few label="최신으로 바뀔 것" rows={pl.upd} line={(r) => <>{MOY_L[r.key]} · <b>{r.title}</b> · {fl(r.changed)}</>} /></>}
      {pl.keep.length > 0 && <><div className="a-moyh">업무OS에서 고쳐서 그대로 {pl.keep.length}</div><Few label="그대로 둘 것" rows={pl.keep} line={(r) => <>{MOY_L[r.key]} · <b>{r.title}</b> · {MOY_WHY[r.why] || r.why}</>} /></>}
      {pl.trash.length > 0 && <><div className="a-moyh">업무OS 휴지통에 있어 그대로 {pl.trash.length}</div><Few label="휴지통" rows={pl.trash} line={(r) => <>{MOY_L[r.key]} · <b>{r.title}</b></>} /></>}
      {pl.gone.length > 0 && <><div className="a-moyh">모여라딜에서 없어진 것 {pl.gone.length}건 (업무OS엔 그대로)</div><Few label="모여라딜에서 없어진 것" rows={pl.gone} line={(r) => <>{MOY_L[r.key]} · <b>{r.title}</b></>} /></>}
      <div className="a-moyh">사람</div><div>{userLine || "모여라딜 사람 없음"}</div>
      <div className="a-moyh">브랜드</div>
      <div>프로젝트 {pl.brands.map((b) => `${b.name} ${b.n}`).join(" · ")} <span style={{ color: C.mute }}>(이름에 바라스데이·그로홈 같은 다른 브랜드가 있으면 그 브랜드 · 프로젝트 없는 업무는 {pl.brand.name})</span></div>
      {pl.otherNew.length > 0 && <div>새 프로젝트 중 다른 브랜드: {pl.otherNew.map((x) => `${x.title} → ${x.brand}`).join(" · ")}</div>}
      {c.folded > 0 && <div style={{ marginTop: 6 }}>업무OS에서 중단·보류한 프로젝트에 들어오는 열린 업무 {c.folded}건은 그 프로젝트처럼 접어요</div>}
      <div style={{ marginTop: 6 }}>{c.logs ? `모여라딜 활동 기록 ${c.logs}건도 같이 넣어요 (새로·최신으로 바뀌는 것만)` : "같이 넣을 활동 기록 없음"} · 설정·휴지통·일정 종류는 안 가져와요</div>
      {st.step === "run" ? <div style={{ marginTop: 10 }}>
        <div style={{ color: C.ink, fontWeight: 800 }}>넣는 중 {st.n}/{st.total}</div>
        <div className="a-moybar" role="progressbar" aria-valuemin={0} aria-valuemax={st.total} aria-valuenow={st.n}><i style={{ width: `${st.total ? Math.round((st.n / st.total) * 100) : 0}%` }} /></div>
      </div> : pl.nothing ? <div style={{ marginTop: 10 }}><div style={{ color: C.green, fontWeight: 800 }}>새로 넣거나 바꿀 것이 없어요 · 이미 최신이에요</div><div style={{ marginTop: 8 }}><TBtn onClick={() => setSt(null)}>닫기</TBtn></div></div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}><TBtn v="solid" onClick={run}>확인 — {pl.n}건 넣기</TBtn><TBtn onClick={() => setSt(null)}>그만</TBtn></div>}
    </div>}
    {st && (st.step === "done" || st.step === "undo") && <div className="a-prev" role="status">
      <div style={{ color: C.ink, fontWeight: 800 }}>넣었어요 · 새로 {st.r.made} · 최신으로 {st.r.done}{st.r.logs ? ` · 활동 기록 ${st.r.logs}` : ""}</div>
      {st.r.had > 0 && <div>그사이 누가 먼저 만든 {st.r.had}건은 그대로 뒀어요</div>}
      {st.r.skipped.length > 0 && <div>그사이 업무OS에서 바뀐 {st.r.skipped.length}건은 그대로 뒀어요 (다시 보기로 확인)</div>}
      {st.undone != null && <div>방금 최신으로 바꾼 것 {st.undone}건을 되돌렸어요</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {st.doneUpd && st.doneUpd.length > 0 && <TBtn disabled={st.step === "undo"} onClick={undo}>{st.step === "undo" ? "되돌리는 중" : `최신으로 바꾼 ${st.doneUpd.length}건 되돌리기`}</TBtn>}
        <TBtn onClick={load}>다시 보기</TBtn></div>
    </div>}
  </Card></div>;
}
