// 업무OS v2 — 월말 보고서 화면 (③ 사용자 확정 2026-10-06 · 시안 step9 · step10)
//  달 ‹ › · 범위(브랜드 · 프로젝트 하나) → 바로 미리 보기(초안 = 지금 값) · 팀원도 봄
//  관리자: 한 줄 정리 · [이 달 보고서 확정](지금 값을 얼려 reports/{id}.data) · [공유 링크 만들기](os2-report.html#id~token · 로그인 없이 보기만)
//          [더 하기 ▾] 공유 끄기 · 공유 내용 지금 값으로 · 공유에서 금액 숨기기 · 다시 확정 · 관리자 메모(댓글·회의록·대표님 피드백 — 관리자만 · 공유 링크엔 안 실림)
//  쓰기: pour-os/v2/reports/{id} · reporthist/{id~시각}(다시 확정 전 확정본) · reportnotes/{id} — 지우지 않음
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { ymd, md, isMaster, newId } from "./model.js";
import { C, Big, TBtn, Chip, Head, Card, Empty, Sheet, Ask, inp } from "./ui.jsx";
import { LS, nowIso } from "./core.jsx";
import { useLocal } from "./ui.jsx";
import { useKpiDefs } from "./kpiui.jsx";
import { visibleDefs } from "./kpi2.js";
import { reportBrand, reportProject, reportProjects, reportId, newToken, shareUrl, ymAdd, mLabel, monthRange, confirmWrite, shareOnWrite, shareOffWrite, refreshWrite, moneyWrite, summaryWrite, NOTE_KINDS, noteDoc } from "./report.js";
import { ReportView } from "./reportview.jsx";

const clean = (x) => JSON.parse(JSON.stringify(x));   // Firestore 는 undefined 를 못 받음
const brandsOf = (D) => (D.brands || []).filter((b) => b && b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
// 30일보다 이전 끝낸 업무(앱은 30일만 불러옴) — 그 달을 볼 때 한 번 읽음 (읽기만)
export function useDoneSince(D, from) {
  const need = !!from && from < ymd(new Date(Date.now() - 29 * 864e5));
  const [got, setGot] = useState({});
  useEffect(() => { if (!need || got[from]) return; let on = true;
    fb.fetchWhere("tasks", ["doneAt", ">=", new Date(from + "T00:00:00").toISOString()]).then((x) => { if (on) setGot((g) => ({ ...g, [from]: x })); })
      .catch((e) => { console.error("[보고서] 지난 끝낸 업무 못 읽음:", e); if (on) setGot((g) => ({ ...g, [from]: "err" })); });
    return () => { on = false; }; }, [need, from]);
  return useMemo(() => {
    const extra = need && Array.isArray(got[from]) ? got[from] : [];
    if (!extra.length) return { tasks: D.tasks, ready: !need || !!got[from], err: got[from] === "err" };
    const m = new Map(extra.map((t) => [t.id, t])); (D.tasks || []).forEach((t) => m.set(t.id, t));
    return { tasks: [...m.values()], ready: true, err: false };
  }, [D.tasks, need, from, got[from]]);
}
function useProjTasks(D, pid) {
  const [got, setGot] = useState({});
  useEffect(() => { if (!pid || got[pid]) return; let on = true;
    fb.fetchWhere("tasks", ["projectId", "==", pid]).then((x) => { if (on) setGot((g) => ({ ...g, [pid]: x })); })
      .catch((e) => { console.error("[보고서] 프로젝트 업무 못 읽음:", e); if (on) setGot((g) => ({ ...g, [pid]: "err" })); });
    return () => { on = false; }; }, [pid]);
  return useMemo(() => { if (!pid) return null; const x = got[pid]; if (!x) return null; if (x === "err") return "err";
    const m = new Map(x.map((t) => [t.id, t])); (D.tasks || []).filter((t) => t.projectId === pid).forEach((t) => m.set(t.id, t)); return [...m.values()]; }, [pid, got[pid], D.tasks]);
}
// 그 달 보고서 문서들 (확정본 · 공유 · 한 줄 정리)
function useReportDocs(ym) {
  const [docs, setDocs] = useState(null);
  useEffect(() => { setDocs(null); return fb.listen("reports", ["ym", "==", ym], (x) => setDocs(Object.fromEntries(x.map((d) => [d.id || d._doc, d]))), (e) => { console.warn("[보고서] 문서 못 읽음:", e); setDocs({}); }); }, [ym]);
  return docs;
}

export function ReportSheet(p) { return <Sheet title="월말 보고서" onBack={p.onBack} onClose={p.onClose}><ReportBody {...p} /></Sheet>; }

export function ReportBody({ D, cu, open, setToast, inline }) {
  const key = ymd(new Date()), ymNow = key.slice(0, 7);
  const [ym, setYm] = useState(ymNow);
  const bs = brandsOf(D);
  const [sc0, setSc] = useLocal(LS("rp-scope"), { kind: "brand", key: "pourstore" });
  const projList = useMemo(() => reportProjects(D.projects, ym), [D.projects, ym]);
  const sc = sc0 && sc0.kind === "project" ? (D.projects.some((x) => x.id === sc0.key) ? sc0 : { kind: "brand", key: (bs[0] || { id: "pourstore" }).id })
    : { kind: "brand", key: bs.some((b) => b.id === (sc0 && sc0.key)) ? sc0.key : (bs[0] || { id: "pourstore" }).id };
  const K0 = useKpiDefs(D), K = useMemo(() => (K0 ? visibleDefs(K0) : null), [K0]);
  const r = monthRange(ym), M = useDoneSince(D, r.from);
  const PT = useProjTasks(D, sc.kind === "project" ? sc.key : "");
  const docs = useReportDocs(ym);
  const id = reportId(sc.key, ym), cur = docs ? docs[id] || null : undefined;
  const X = { users: D.users, brands: D.brands, projects: D.projects, tasks: M.tasks, K, sales: D.kpi.sales, lagDefs: D.kpi.lagDefs, lagV2: D.kpi.lagV2, ak: D.ak, key };
  const proj = sc.kind === "project" ? D.projects.find((x) => x.id === sc.key) : null;
  const liveData = useMemo(() => { if (sc.kind === "brand") return K && M.ready ? reportBrand(X, sc.key, ym) : null;
    return Array.isArray(PT) ? reportProject(X, proj, PT, ym) : null; }, [sc.kind, sc.key, ym, K, M.tasks, M.ready, PT, D.projects, D.kpi, D.ak, D.users]);
  const final = cur && cur.status === "final" && cur.data;
  const [showLive, setShowLive] = useState(false);
  useEffect(() => setShowLive(false), [id]);
  const shown = final && !showLive ? cur.data : liveData && { ...liveData, summary: (cur && cur.summary) || "" };
  const admin = isMaster(cu);
  const goProject = (pid) => { setSc({ kind: "project", key: pid }); window.scrollTo && window.scrollTo(0, 0); };
  const loading = sc.kind === "brand" ? !K || !M.ready : PT === null;
  const failed = M.err || PT === "err";
  return <div className="rp-wrap">
    {!inline && <p className="rp-lead">업무OS 기록과 매출(POUR스토어 CRM · 그로홈 대시보드)로 자동으로 만들어져요</p>}
    <div className="rp-month" role="group" aria-label="달 고르기">
      <TBtn onClick={() => setYm(ymAdd(ym, -1))} aria-label="지난달">‹ {mLabel(ymAdd(ym, -1))}</TBtn>
      <b>{ym.slice(0, 4)}년 {mLabel(ym)}</b>
      <TBtn onClick={() => setYm(ymAdd(ym, 1))} disabled={ym >= ymNow} aria-label="다음 달">{mLabel(ymAdd(ym, 1))} ›</TBtn>
    </div>
    <div className="v2-filterrow rp-scope" aria-label="범위">
      <div className="v2-chips" role="group" aria-label="브랜드">{bs.map((b) => <Chip key={b.id} on={sc.kind === "brand" && sc.key === b.id} onClick={() => setSc({ kind: "brand", key: b.id })}>{b.name}</Chip>)}</div>
      <span className="sep" />
      <select className="v2-sel rp-psel" aria-label="프로젝트 하나 고르기" value={sc.kind === "project" ? sc.key : ""} onChange={(e) => e.target.value && setSc({ kind: "project", key: e.target.value })}>
        <option value="">프로젝트 하나 ▾</option>
        {proj && !projList.some((x) => x.id === proj.id) && <option value={proj.id}>{proj.title}</option>}
        {projList.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
      </select>
    </div>
    {sc.kind === "project" && proj && <div className="rp-crumb"><TBtn v="plain" onClick={() => setSc({ kind: "brand", key: (bs[0] || { id: "pourstore" }).id })}>‹ 브랜드 보고서로</TBtn><TBtn v="plain" onClick={() => open({ type: "project", id: proj.id })}>프로젝트 화면 ›</TBtn></div>}
    <StatusLine cur={cur} final={final} showLive={showLive} setShowLive={setShowLive} />
    {failed && <Card style={{ marginTop: 10 }}><Empty>업무를 불러오지 못했어요 · 인터넷 연결을 확인해 주세요</Empty></Card>}
    {!failed && (loading || !shown) ? <Card style={{ marginTop: 10 }}><Empty>{loading ? "보고서를 만드는 중이에요" : "이 프로젝트는 보고서를 만들 수 없어요"}</Empty></Card>
      : !failed && <ReportView data={shown} money final={!!final && !showLive} finalAt={final && cur.final && cur.final.at} onProject={goProject} onTask={(tid) => open({ type: "task", id: tid })} />}
    {admin && liveData && docs && <AdminTools D={D} cu={cu} id={id} cur={cur} live={liveData} setToast={setToast} final={final} />}
    {!admin && cur && cur.share && cur.share.on && <ShareLine id={id} cur={cur} setToast={setToast} />}
    {admin && docs && <ReportNotes id={id} cu={cu} setToast={setToast} title={(shown && shown.title) || ""} />}
  </div>;
}
function StatusLine({ cur, final, showLive, setShowLive }) {
  if (cur === undefined) return null;
  const sh = cur && cur.share && cur.share.on;
  return <div className="rp-status">
    <span>{final ? `확정 ${md(String(cur.final.at).slice(0, 10))} · ${cur.final.byName || ""}${showLive ? " · 지금 값 보는 중" : " · 확정 뒤 바뀐 것은 안 보여요"}` : "초안 · 지금 값으로 바뀌어요"}{sh ? " · 공유 중" : ""}</span>
    {final && <TBtn onClick={() => setShowLive(!showLive)}>{showLive ? "확정본 보기" : "지금 값 보기"}</TBtn>}
  </div>;
}
function copyText(u, setShow, setToast) {
  try { navigator.clipboard.writeText(u).then(() => { setShow(""); setToast && setToast({ text: "공유 링크를 복사했어요" }); }, () => setShow(u)); } catch (e) { setShow(u); }
}
function ShareLine({ id, cur, setToast }) {
  const [show, setShow] = useState(""); const u = shareUrl(window.location.href, id, cur.share.token);
  return <div className="rp-tools"><TBtn onClick={() => copyText(u, setShow, setToast)}>공유 링크 복사</TBtn>
    {show && <input readOnly value={show} autoFocus onFocus={(e) => e.target.select()} aria-label="복사할 링크" style={{ ...inp, marginTop: 6, fontSize: 12.5, padding: "8px 10px" }} />}</div>;
}

function AdminTools({ D, cu, id, cur, live, setToast, final }) {
  const [more, setMore] = useState(false), [ask, setAsk] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState("");
  const [sum, setSum] = useState(null); const sumV = sum != null ? sum : (cur && cur.summary) || "";
  useEffect(() => { setSum(null); setShow(""); setMore(false); }, [id]);
  const sh = cur && cur.share && cur.share.on, mLbl = `${mLabel(live.ym)} ${live.name}`;
  const run = async (label, fn) => { if (busy) return; setBusy(true);
    try { const r = await fn(nowIso()); setToast && setToast({ text: r === null ? "바뀐 것이 없어요" : label }); return r; }
    catch (e) { console.error("[보고서] 저장 실패:", e); setToast && setToast({ text: "저장하지 못했어요 · 인터넷 연결을 확인해 주세요" }); return false; }
    finally { setBusy(false); } };
  const tx = (mk) => (at) => fb.txDoc("reports", id, (c) => { const w = mk(c, at); return w ? { write: clean(w), ret: 1 } : {}; });
  const confirm = () => run(`${mLbl} 보고서를 확정했어요`, (at) => cur && cur.status === "final"
    ? fb.txDocs([{ key: "reports", id }, { key: "reporthist", id: `${id}~${at.replace(/[:.]/g, "")}` }], ([c]) => ({ writes: [clean(confirmWrite(c, live, cu, at)), c && c.data ? clean({ reportId: id, data: c.data, final: c.final || null, savedAt: at, savedBy: cu.id }) : null], ret: 1 }))
    : tx((c, a) => confirmWrite(c, live, cu, a))(at));
  const shareOn = async () => { const tk = newToken(); const r = await run("공유 링크를 만들었어요 · 복사해서 보내요", tx((c, a) => shareOnWrite(c, live, cu, a, tk)));
    if (r) copyText(shareUrl(window.location.href, id, tk), setShow, null); };
  const u = sh ? shareUrl(window.location.href, id, cur.share.token) : "";
  return <div className="rp-admin">
    {!final && <><Head>한 줄 정리 (고쳐 쓸 수 있어요)</Head>
      <textarea value={sumV} onChange={(e) => setSum(e.target.value)} rows={2} aria-label="한 줄 정리" placeholder="예: 매출 목표 96% · 쿠팡 광고 2회 모자람 → 11월 로켓그로스 입점으로 보완" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
      {sum != null && sum.trim() !== ((cur && cur.summary) || "") && <div style={{ marginTop: 6 }}><TBtn v="solid" disabled={busy} onClick={async () => { const r = await run("한 줄 정리를 저장했어요", tx((c, a) => summaryWrite(c, live, sum, cu, a))); if (r !== false) setSum(null); }}>한 줄 정리 저장</TBtn></div>}</>}
    <div className="rp-tools">
      {!final && <TBtn v="solid" disabled={busy} onClick={() => setAsk("confirm")}>이 달 보고서 확정</TBtn>}
      {sh ? <TBtn disabled={busy} onClick={() => copyText(u, setShow, setToast)}>공유 링크 복사</TBtn> : <TBtn disabled={busy} onClick={shareOn}>공유 링크 만들기</TBtn>}
      <TBtn onClick={() => setMore(!more)} aria-expanded={more}>{more ? "접기 ▴" : "더 하기 ▾"}</TBtn>
    </div>
    {show && <input readOnly value={show} autoFocus onFocus={(e) => e.target.select()} aria-label="복사할 링크" style={{ ...inp, marginTop: 6, fontSize: 12.5, padding: "8px 10px" }} />}
    {more && <div className="v2-more" role="group" aria-label="더 하기">
      {sh && <TBtn v="soft" disabled={busy} onClick={() => run("공유를 껐어요 · 예전 링크는 이제 안 열려요", tx((c, a) => shareOffWrite(c, cu, a)))}>공유 끄기</TBtn>}
      {sh && !final && <TBtn v="soft" disabled={busy} onClick={() => run("공유 내용을 지금 값으로 바꿨어요", tx((c, a) => refreshWrite(c, live, cu, a)))}>공유 내용 지금 값으로</TBtn>}
      <TBtn v="soft" disabled={busy} onClick={() => run(cur && cur.hideMoney ? "공유 링크에 금액을 보여요" : "공유 링크에서 금액을 숨겨요", tx((c, a) => moneyWrite(c, live, !(cur && cur.hideMoney), cu, a)))}>{cur && cur.hideMoney ? "공유에서 금액 보이기" : "공유에서 금액 숨기기"}</TBtn>
      {final && <TBtn v="soft" disabled={busy} onClick={() => setAsk("again")}>다시 확정 (지금 값으로)</TBtn>}
    </div>}
    <p className="rp-hint">공유 링크 = 로그인 없이 보기만 · 언제든 끄기 · 관리자 메모는 안 실려요 · 기밀 업무·프로젝트는 빠져요{cur && cur.hideMoney ? " · 지금 공유에서 금액 숨김" : ""}</p>
    {ask && <Ask title={ask === "again" ? "지금 값으로 다시 확정할까요?" : `${mLbl} 보고서를 확정할까요?`}
      body={ask === "again" ? "지금 값으로 다시 얼려 둬요.\n이전 확정본은 기록(보관)에 남아요." : "지금 값으로 얼려 둬요.\n뒤에 업무·매출이 바뀌어도 이 보고서는 그대로예요."}
      yes="확정" onNo={() => setAsk("")} onYes={() => { setAsk(""); confirm(); }} />}
  </div>;
}

// 관리자 메모 — 관리자 누구나 쓰고 관리자만 봄 · 공유 링크에는 안 실림 (pour-os/v2/reportnotes · 더하기만)
export function ReportNotes({ id, cu, setToast, title }) {
  const [notes, setNotes] = useState(null), [kind, setKind] = useState(""), [txt, setTxt] = useState(""), [ttl, setTtl] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setNotes(null); setKind(""); return fb.listen("reportnotes", ["reportId", "==", id], (x) => setNotes(x), (e) => { console.warn("[보고서 메모] 못 읽음:", e); setNotes([]); }); }, [id]);
  if (!isMaster(cu)) return null;
  const list = [...(notes || [])].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const KL = Object.fromEntries(NOTE_KINDS);
  const save = async () => { if (!txt.trim() || busy) return; setBusy(true);
    try { const at = nowIso(), nid = newId("rn"); await fb.txDoc("reportnotes", nid, (c) => (c ? {} : { write: noteDoc(id, kind, txt, ttl, cu, at) }));
      setTxt(""); setTtl(""); setKind(""); setToast && setToast({ text: `${KL[kind]}을 남겼어요 · 관리자만 봐요` }); }
    catch (e) { console.error("[보고서 메모] 저장 실패:", e); setToast && setToast({ text: "저장하지 못했어요 · 인터넷 연결을 확인해 주세요" }); }
    finally { setBusy(false); } };
  return <div className="rp-notes">
    <Head right={<span className="rp-cnt">{list.length}</span>}>관리자 메모 · 관리자만 보여요</Head>
    {list.length > 0 && <Card>{list.map((n, i) => <div key={n.id || i} className="rp-note" style={{ borderBottom: i === list.length - 1 ? "none" : undefined }}>
      <div className="r1"><b>{KL[n.kind] || "메모"}{n.title ? ` · ${n.title}` : ""}</b><span>{n.byName || ""} · {md(String(n.at || "").slice(0, 10))}</span></div>
      <div className="t">{n.text}</div></div>)}</Card>}
    {notes && !list.length && <p className="rp-hint" style={{ marginTop: 0 }}>{title ? `'${title}'에 ` : ""}아직 메모가 없어요</p>}
    <div className="rp-tools">{NOTE_KINDS.map(([k, l]) => <TBtn key={k} v={kind === k ? "solid" : "soft"} onClick={() => setKind(kind === k ? "" : k)}>{l}</TBtn>)}</div>
    {kind && <div style={{ marginTop: 8 }}>
      {kind === "minutes" && <input value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="회의 이름 (예: 11/3 월말 회의)" aria-label="회의 이름" style={{ ...inp, marginBottom: 6, padding: "9px 12px", fontSize: 14 }} />}
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={3} aria-label={`${KL[kind]} 내용`} placeholder={kind === "ceo" ? "대표님 말씀 (예: 자사몰은 좋음. 쿠팡은 단가부터 다시 보자)" : kind === "minutes" ? "정한 것 · 할 일" : "댓글"} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
      <div style={{ marginTop: 6 }}><Big onClick={save} disabled={!txt.trim() || busy}>{busy ? "남기는 중" : `${KL[kind]} 남기기`}</Big></div>
    </div>}
    <p className="rp-hint">공유 링크(로그인 없음)에는 관리자 메모가 아예 실리지 않아요</p>
  </div>;
}
