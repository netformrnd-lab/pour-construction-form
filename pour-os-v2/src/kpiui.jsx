// 업무OS v2 — KPI 화면 (② 사용자 결정 2026-10-05 · 시안 mockups/step8)
//  · 관리자 KPI(관리자 화면 'KPI' 탭): 브랜드 → 결과 KPI(월 값) → 최종목표 → 메인KPI → 서브KPI(채널) · 누르면 그 KPI 를 움직이는 행동지표·프로젝트
//  · 내 KPI(더보기): 내가 맡은 행동지표·내 프로젝트가 움직이는 KPI 만
//  · 결과 KPI 월말 입력(LagSheet): 마스터·결과 KPI 권한 · pour-os/v2/lagvals/{결과KPI id} 에만 저장(버전1 값은 읽기만, 지우지 않음)
// 계산은 kpi2.js · 정의는 버전1 문서 읽기만 · 매출: POUR스토어 = CRM(버전1 서브KPI 에 CRM 이 넣는 누계) · 그로홈 = 그로홈 대시보드(ghsales.js)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { ymd, md, isMaster, nameOf } from "./model.js";
import { kpiDefs, kpiBoard, myKpi, lagAt, lagLatest, lagGoal, lagPct, lagMissing, lagWrite, lagBrand, canLag, fmtV, KCOLL_L, skManual, kpiEditWrite, newKpiId, goalBrandOf, mkBrand, lagDue } from "./kpi2.js";
import { AK_FUNS } from "../../pour-os/src/actionKpi.js";
import { refreshGhSales, GH_EVERY } from "./ghsales.js";
import { C, Big, TBtn, Chip, Head, Card, Empty, More, Sheet, inp, useLocal } from "./ui.jsx";
import { LS, nowIso } from "./core.jsx";

// 버전1 KPI 정의 문서 실시간 읽기 (결과 KPI 정의는 core 가 이미 읽음)
export function useKpiDefs(D) {
  const [docs, setDocs] = useState({});
  useEffect(() => {
    const un = ["goals", "mainKPIs", "subKPIs"].map((k) => fb.listenV1Doc("state-" + k, (d) => setDocs((s) => ({ ...s, [k]: d || null })), (e) => { console.warn(`[v2 KPI] 버전1 ${k} 못 읽음:`, e); setDocs((s) => ({ ...s, [k]: null })); }));
    return () => un.forEach((u) => u && u());
  }, []);
  const lag = D.kpi && D.kpi.lagReady ? { items: D.kpi.lagRaw } : undefined, ov = D.kpi && D.kpi.ov;
  return useMemo(() => kpiDefs({ ...docs, lagKPIs: lag }, ov || []), [docs, lag && lag.items, ov]);
}
// 그로홈 매출 합계 새로 읽기 — 마스터 기기에서 3시간에 한 번 (실패하면 30분 뒤 다시)
export function useGhRefresh(D, cu) {
  const busy = useRef(false); const g = (D.kpi && D.kpi.sales && D.kpi.sales.grohome) || null; const ready = !!(D.kpi && D.loaded && D.salesReady);   // 저장된 합계를 받은 뒤에만 (3시간 규칙이 첫 화면에서 무시되지 않게)
  useEffect(() => {
    if (!ready || !isMaster(cu) || busy.current) return;
    const last = g ? Date.parse(g.checkedAt || g.at || "") || 0 : 0; if (Date.now() - last < GH_EVERY) return;
    let tried = 0; try { tried = +localStorage.getItem(LS("ghtry")) || 0; } catch (_) {}
    if (Date.now() - tried < 30 * 60 * 1000) return;
    busy.current = true; try { localStorage.setItem(LS("ghtry"), String(Date.now())); } catch (_) {}
    refreshGhSales(g, cu.name).catch((e) => console.warn("[그로홈 매출] 읽기 실패 · 예전 합계 그대로 · 30분 뒤 다시:", e)).finally(() => { busy.current = false; });
  }, [ready, g && (g.checkedAt || g.at), cu && cu.id]);
}

const brandsOf = (D) => (D.brands || []).filter((b) => b && b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
const ymNow = () => ymd(new Date()).slice(0, 7);
const ymAdd = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mLabel = (ym) => `${+ym.slice(5, 7)}월`;
const Bar = ({ pct, red }) => <div className="v2-kbar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, background: red ? C.red : C.navy }} /></div>;
const Src = ({ s }) => <span className={"v2-ksrc" + (s.auto ? " auto" : "")}>{s.t}</span>;
const pctT = (p) => (p == null ? "" : ` · ${p}%`);

// ── 관리자 KPI ──
export function KpiBoard({ D, cu, open }) {
  const K = useKpiDefs(D);
  const bs = brandsOf(D), [b0, setB] = useLocal(LS("kbrand"), "pourstore"), brand = bs.some((x) => x.id === b0) ? b0 : (bs[0] || { id: "pourstore" }).id;
  const key = ymd(new Date()), ym = key.slice(0, 7);
  const B = useMemo(() => kpiBoard(K, { brands: D.brands, projects: D.projects, ak: D.ak, gh: D.kpi.sales.grohome, lagV2: D.kpi.lagV2, users: D.users, key }, brand), [K, D.brands, D.projects, D.ak, D.kpi, D.users, key, brand]);
  const [openK, setOpenK] = useState(""), [lagAll, setLagAll] = useState(false), [ed0, setEd] = useState(false), ed = ed0 && isMaster(cu);
  const E = (coll, id, extra) => open({ type: "kpiEdit", coll, id, brand, ...(extra || {}) });
  const EdLine = ({ children }) => ed ? <div className="v2-kedit">{children}</div> : null;
  const bname = (bs.find((x) => x.id === brand) || { name: brand }).name;
  if (!K) return <Card style={{ marginTop: 12 }}><Empty>KPI를 불러오는 중이에요</Empty></Card>;
  const due = lagDue(key, B.lags, D.kpi.lagV2), inYm = due ? due.ym : ym;   // 새 달 10일까지는 지난달 (알림과 같은 달)
  const miss = lagMissing(B.lags, D.kpi.lagV2, inYm).length;
  const gh = brand === "grohome" && D.kpi.sales.grohome;
  return <div className="v2-kpi">
    <div className="v2-filterrow" style={{ marginTop: 4 }} aria-label="브랜드 고르기">
      <div className="v2-chips" role="group" aria-label="브랜드">{bs.map((x) => <Chip key={x.id} on={brand === x.id} onClick={() => { setB(x.id); setOpenK(""); }}>{x.name}</Chip>)}</div>
    </div>
    {isMaster(cu) && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><TBtn v={ed ? "solid" : "line"} onClick={() => setEd(!ed)}>{ed ? "고치기 끝" : "KPI 고치기"}</TBtn></div>}
    {ed && <p className="v2-kednote">줄마다 [고치기]로 이름·목표·단위를 바꾸고, [+ 추가]로 새로 만들어요 · 지우기 대신 숨기기(다시 보이기 가능) · 고친 것은 업무OS v2 에만 저장되고 버전1 KPI 화면엔 그대로예요</p>}
    <p className="a-hint" style={{ margin: "10px 2px 0" }}>{bname} · {mLabel(ym)} · {md(key)} 기준{gh ? ` · 그로홈 매출 ${md(ymd(new Date(gh.checkedAt || gh.at)))} 읽음` : ""} · 숫자는 사람이 안 넣어도 되는 것만 자동</p>
    <Head right={ed ? <TBtn onClick={() => E("lagKPIs", "", { isNew: true })}>+ 결과 KPI 추가</TBtn> : canLag(cu) && B.lags.length > 0 && <TBtn v={miss ? "solid" : "line"} onClick={() => open({ type: "lagInput", ym: inYm, brand })}>{miss ? `월말 입력 · ${mLabel(inYm)} ${miss}개 남음` : "월말 입력"}</TBtn>}>결과 KPI · {mLabel(ym)}</Head>
    {B.lags.length ? <Card>{(lagAll ? B.lags : B.lags.slice(0, 5)).map((it, i, arr) => { const a = lagAt(it, D.kpi.lagV2, ym), L = lagLatest(it, D.kpi.lagV2, ym), g = lagGoal(it), v = a ? a.v : null, p = lagPct(it, v);
      return <div key={it.id} className="v2-krow" style={{ borderBottom: i === arr.length - 1 && B.lags.length <= 5 ? "none" : undefined }}>
        <div className="r1"><b>{it.name}</b><span>{fmtV(v, it.unit)}{g != null ? ` / ${fmtV(g, it.unit)}` : ""}</span></div>
        {v != null && g != null && <Bar pct={p} />}
        <div className="s">{v == null ? (L.v != null ? `${L.ym ? mLabel(L.ym) : "기준값"} ${fmtV(L.v, it.unit)} · 이번 달 아직` : "아직 값 없음") : `${a.byName || ""}${a.at ? " · " + md(ymd(new Date(a.at))) : ""}`}{it.fun ? ` · ${it.fun}` : ""}{it._ov || it._new ? " · v2에서 고침" : ""}</div>
        {ed && <div style={{ marginTop: 6 }}><TBtn onClick={() => E("lagKPIs", it.id)}>고치기</TBtn></div>}
      </div>; })}{B.lags.length > 5 && <More onClick={() => setLagAll(!lagAll)}>{lagAll ? "접기 ▴" : `${B.lags.length - 5}개 더 보기 ▾`}</More>}</Card> : <Card><Empty>이 브랜드는 결과 KPI가 아직 없어요</Empty></Card>}
    {!B.goals.length && <Card style={{ marginTop: 14 }}><Empty>{bname}은 아직 KPI 목표가 없어요{isMaster(cu) ? " · [KPI 고치기] › [+ 최종 목표 추가]로 만들어요" : ""}</Empty></Card>}
    {ed && <div style={{ marginTop: 10 }}><TBtn onClick={() => E("goals", "", { isNew: true })}>+ 최종 목표 추가</TBtn></div>}
    {B.goals.map((G) => <div key={G.g.id}>
      <div className="v2-khero"><div className="k">최종 목표 · {G.g.year || ""}</div><div className="t">{G.g.title}</div>
        {G.target > 0 && <><div className="n"><b>{fmtV(G.cur, "원")}</b><span> / {fmtV(G.target, "원")}{pctT(G.pct)}</span></div><Bar pct={G.pct} /></>}
        {ed && <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}><TBtn onClick={() => E("goals", G.g.id)}>고치기</TBtn><TBtn onClick={() => E("mainKPIs", "", { isNew: true, goalId: G.g.id })}>+ 메인KPI 추가</TBtn></div>}</div>
      {G.mks.map((M) => { const ko = openK === M.mk.id;
        return <Card key={M.mk.id} style={{ marginTop: 10 }}>
          <button type="button" className="v2-krow btn" aria-expanded={ko} onClick={() => setOpenK(ko ? "" : M.mk.id)}>
            <div className="r1"><b>{M.mk.krKey ? <span className="kk">{M.mk.krKey}</span> : null}{M.mk.title}</b><span>{fmtV(M.cur, M.mk.unit)} / {fmtV(M.target, M.mk.unit)}{pctT(M.pct)}</span></div>
            <Bar pct={M.pct} />
            {(M.mv.aks.length > 0 || M.mv.ps.length > 0) && <div className="s">움직이는 것 {M.mv.aks.length + M.mv.ps.length} {ko ? "▴" : "▾"}</div>}
          </button>
          <EdLine><TBtn onClick={() => E("mainKPIs", M.mk.id)}>고치기</TBtn><TBtn onClick={() => E("subKPIs", "", { isNew: true, mainKPIId: M.mk.id })}>+ 서브KPI 추가</TBtn></EdLine>
          {ko && <Movers D={D} mv={M.mv} open={open} />}
          {M.subs.map((S) => { const so = openK === S.sk.id, nm = S.mv.aks.length + S.mv.ps.length;
            return <div key={S.sk.id}>
              <button type="button" className="v2-krow btn sub" aria-expanded={so} onClick={() => setOpenK(so ? "" : S.sk.id)}>
                <div className="r1"><b>{S.sk.title}</b><span>{fmtV(S.cur, S.sk.unit)}{S.target ? ` / ${fmtV(S.target, S.sk.unit)}` : ""}{pctT(S.pct)}</span></div>
                <Bar pct={S.pct} />
                <div className="s"><Src s={S.src} />{nm ? ` · 움직이는 것 ${nm} ${so ? "▴" : "▾"}` : " · 연결된 행동지표·프로젝트 없음"}</div>
              </button>
              <EdLine><TBtn onClick={() => E("subKPIs", S.sk.id)}>고치기</TBtn>{skManual(S.sk, D.projects) && <span className="h">지금 값도 여기서</span>}</EdLine>
              {so && <Movers D={D} mv={S.mv} open={open} />}
            </div>; })}
        </Card>; })}
    </div>)}
    {ed && <HiddenList K={K} brand={brand} D={D} E={E} />}
    <p className="a-hint" style={{ margin: "14px 2px 0" }}>매출: POUR스토어 = CRM · 그로홈 = 그로홈 대시보드{isMaster(cu) ? " · KPI·목표는 [KPI 고치기]에서" : ""}</p>
  </div>;
}
function Movers({ D, mv, open }) {
  return <div className="v2-kmv">
    {mv.aks.map((a) => <div key={a.it.id} className="ln"><span className="tg">반복</span><span className="nm">{a.it.name}</span>
      <span className="v">{a.per} {a.n}/{a.g || "-"}{a.who.length ? " · " + a.who.map((u) => nameOf(D.users, u)).join("·") : ""}</span></div>)}
    {mv.ps.map((x) => <button key={x.p.id} type="button" className="ln go" onClick={() => open({ type: "project", id: x.p.id })}><span className="tg">프로젝트</span><span className="nm">{x.p.title}</span>
      <span className="v">진행 {x.pct}% · {nameOf(D.users, x.p.assigneeId) || "책임자 없음"} ›</span></button>)}
  </div>;
}

// ── 내 KPI (더보기) ──
export function MyKpiSheet({ D, cu, open, onBack, onClose, goToday }) {
  const K = useKpiDefs(D); const key = ymd(new Date());
  const rows = useMemo(() => !K ? null : brandsOf(D).map((b) => ({ b, r: myKpi(kpiBoard(K, { brands: D.brands, projects: D.projects, ak: D.ak, gh: D.kpi.sales.grohome, lagV2: D.kpi.lagV2, users: D.users, key }, b.id), cu.id) })).filter((x) => x.r.length), [K, D, cu.id, key]);
  return <Sheet title="내 KPI" onBack={onBack} onClose={onClose} foot={goToday && <Big onClick={goToday}>오늘 할 횟수 보러 가기 ›</Big>}>
    <p style={{ margin: "10px 2px 0", fontSize: 13, color: C.sub, lineHeight: 1.6 }}>내가 맡은 반복(행동지표)과 내 프로젝트가 어느 KPI를 움직이는지</p>
    {!rows && <Card style={{ marginTop: 12 }}><Empty>불러오는 중이에요</Empty></Card>}
    {rows && !rows.length && <Card style={{ marginTop: 12 }}><Empty>아직 나와 연결된 KPI가 없어요</Empty></Card>}
    {(rows || []).map(({ b, r }) => <div key={b.id}>
      <Head>{b.name}</Head>
      <Card>{r.map((x, i) => { const t = x.x.sk || x.mk, u = t.unit;
        return <div key={t.id + x.kind} className="v2-krow" style={{ borderBottom: i === r.length - 1 ? "none" : undefined }}>
          <div className="r1"><b>{t.title}</b><span>{x.x.pct != null ? `${x.x.pct}%` : fmtV(x.x.cur, u)}</span></div>
          <Bar pct={x.x.pct} />
          <div className="s">{fmtV(x.x.cur, u)}{x.x.target ? ` / ${fmtV(x.x.target, u)}` : ""}{x.x.src ? <> · <Src s={x.x.src} /></> : null}</div>
          {x.aks.length > 0 && <div className="s">내 반복: {x.aks.map((a) => `${a.it.name.replace(/^\([^)]*\)\s*/, "")} ${a.n}/${a.g || "-"}`).join(" · ")}</div>}
          {x.ps.map((q) => <button key={q.p.id} type="button" className="v2-klink" onClick={() => open({ type: "project", id: q.p.id })}>내 프로젝트: {q.p.title} (진행 {q.pct}%) ›</button>)}
        </div>; })}</Card>
    </div>)}
  </Sheet>;
}

// ── 결과 KPI 월말 입력 ──
export function LagSheet({ D, cu, s, onBack, onClose, setToast }) {
  const [ym, setYm] = useState(s.ym || ymNow()), edit = canLag(cu);
  const bs = brandsOf(D), lags = (D.kpi && D.kpi.lagDefs) || [], v2 = (D.kpi && D.kpi.lagV2) || {};
  const groups = bs.map((b) => ({ b, l: lags.filter((it) => lagBrand(it, D.brands) === b.id).sort((x, y) => (+x.order || 0) - (+y.order || 0)) })).filter((g) => g.l.length)
    .sort((x, y) => (x.b.id === s.brand ? -1 : y.b.id === s.brand ? 1 : 0));
  const [val, setVal] = useState({}), [busy, setBusy] = useState(false);
  useEffect(() => setVal({}), [ym]);
  const cur = (it) => { const a = lagAt(it, v2, ym); return a ? String(a.v) : ""; };
  const shown = (it) => (val[it.id] !== undefined ? val[it.id] : cur(it));
  const nv = (x) => String(x || "").replace(/,/g, "").trim();   // 1,000 처럼 쉼표 넣어도 됨
  const changed = lags.filter((it) => val[it.id] !== undefined && nv(val[it.id]) !== cur(it));
  const bad = changed.filter((it) => nv(val[it.id]) !== "" && !isFinite(+nv(val[it.id])));
  const miss = lagMissing(lags, v2, ym).length;
  const save = async () => {
    if (!changed.length || bad.length || busy) return; setBusy(true); let n = 0;
    try { const at = nowIso();
      for (const it of changed) { const v = nv(val[it.id]); const r = await fb.txDoc("lagvals", it.id, (c) => { const w = lagWrite(c, it, ym, v, cu, at); return w ? { write: w, ret: 1 } : {}; }); n += r || 0; }
      setVal({}); setToast && setToast({ text: `${mLabel(ym)} 결과 KPI ${n}개 저장했어요` });
    } catch (e) { console.error("[결과 KPI] 저장 실패:", e); setToast && setToast({ text: "저장하지 못했어요 · 인터넷 연결을 확인해 주세요" }); }
    finally { setBusy(false); }
  };
  return <Sheet title="결과 KPI 월말 입력" onBack={onBack} onClose={onClose}
    foot={edit ? <Big onClick={save} disabled={!changed.length || !!bad.length || busy}>{busy ? "저장하는 중" : bad.length ? "숫자만 넣어 주세요" : changed.length ? `${changed.length}개 저장` : "바뀐 값 없음"}</Big> : null}>
    <div className="v2-kmonth">
      <TBtn onClick={() => setYm(ymAdd(ym, -1))} aria-label="지난달">‹</TBtn><b>{ym.slice(0, 4)}년 {mLabel(ym)}</b>
      <TBtn onClick={() => setYm(ymAdd(ym, 1))} disabled={ym >= ymNow()} aria-label="다음 달">›</TBtn>
      <span className="m">{miss ? `모두 ${miss}개 남음` : "다 넣었어요 ✓"}</span>
    </div>
    {!edit && <p style={{ margin: "8px 2px 0", fontSize: 13, color: C.sub }}>보기만 할 수 있어요 · 넣기는 관리자·결과 KPI 권한</p>}
    {!lags.length && <Card style={{ marginTop: 12 }}><Empty>{D.kpi && D.kpi.lagReady ? "결과 KPI가 아직 없어요" : "불러오는 중이에요"}</Empty></Card>}
    {groups.map(({ b, l }) => <div key={b.id}><Head>{b.name} {l.length}</Head><Card>{l.map((it, i) => { const prev = lagLatest(it, v2, ymAdd(ym, -1)), g = lagGoal(it), a = lagAt(it, v2, ym), x = shown(it);
      const wrong = nv(x) !== "" && !isFinite(+nv(x));
      return <label key={it.id} className="v2-klag" style={{ borderBottom: i === l.length - 1 ? "none" : undefined }}>
        <div className="l"><b>{it.name}</b>
          <span>{g != null ? `목표 ${fmtV(g, it.unit)}` : "목표 없음"} · {prev.v != null ? `${prev.ym ? mLabel(prev.ym) : "기준값"} ${fmtV(prev.v, it.unit)}` : "지난 값 없음"}{a && a.byName ? ` · ${a.byName} 넣음` : ""}</span></div>
        <div className="in"><input value={x} disabled={!edit} inputMode="decimal" aria-label={`${it.name} ${mLabel(ym)} 값`} placeholder="—"
          onChange={(e) => setVal((v) => ({ ...v, [it.id]: e.target.value }))} style={{ ...inp, padding: "9px 10px", textAlign: "right", borderColor: wrong ? C.red : val[it.id] !== undefined && nv(x) !== cur(it) ? C.navy : C.line }} />
          <span className="u">{it.unit || ""}</span></div>
      </label>; })}</Card></div>)}
    <p style={{ margin: "14px 2px 0", fontSize: 12.5, color: C.mute, lineHeight: 1.6 }}>버전1에서 넣은 값도 같이 보여요 · 여기서 고친 값은 업무OS v2 에만 저장돼요(버전1 값은 그대로) · 지우면 빈 값으로 남고 이전 값은 기록에 남아요</p>
  </Sheet>;
}

// ── KPI 고치기 (마스터) ──
// 숨긴 것 (이 브랜드) — 다시 보이기
function HiddenList({ K, brand, D, E }) {
  const D0 = { goals: K.goals, mainKPIs: K.mainKPIs, brands: D.brands };
  const inB = (c, x) => c === "goals" ? goalBrandOf(x, D.brands) === brand : c === "mainKPIs" ? mkBrand(x, D0) === brand
    : c === "subKPIs" ? (() => { const m = K.mainKPIs.find((y) => y.id === x.mainKPIId); return m ? mkBrand(m, D0) === brand : false; })() : lagBrand(x, D.brands) === brand;
  const hid = ["goals", "mainKPIs", "subKPIs", "lagKPIs"].flatMap((c) => (K[c] || []).filter((x) => x._hidden && inB(c, x)).map((x) => ({ c, x })));
  if (!hid.length) return null;
  return <><Head>숨긴 것 {hid.length}</Head><Card>{hid.map(({ c, x }, i) => <div key={x.id} className="v2-krow" style={{ borderBottom: i === hid.length - 1 ? "none" : undefined }}>
    <div className="r1"><b style={{ color: C.mute }}>{x.title || x.name}</b><span>{KCOLL_L[c]}</span></div>
    <div style={{ marginTop: 6 }}><TBtn onClick={() => E(c, x.id)}>고치기 · 다시 보이기</TBtn></div></div>)}</Card></>;
}
const UNITS = ["원", "%", "건", "개", "명", "회", "모듈", "지표"];
const num = (v) => (String(v).trim() === "" ? null : +String(v).replace(/,/g, "").trim());
export function KpiEditSheet({ D, cu, s, onBack, onClose, setToast }) {
  const K = useKpiDefs(D), coll = s.coll, isNew = !!s.isNew;
  const it = !K || isNew ? null : (K[coll] || []).find((x) => x.id === s.id);
  const base = it && !it._new ? it : null;   // 버전1 원래 값(덧칠 전)은 서버 문서 base 로 기억
  const nm = coll === "lagKPIs" ? "name" : "title";
  const init = useMemo(() => {
    const x = it || {}; const f = { [nm]: x[nm] || "", unit: x.unit || (coll === "lagKPIs" ? "%" : "원") };
    if (coll === "goals") Object.assign(f, { targetValue: x.targetValue ?? "", year: x.year || String(new Date().getFullYear()) });
    if (coll === "mainKPIs") Object.assign(f, { targetValue: x.targetValue ?? "", krKey: x.krKey || "" });
    if (coll === "subKPIs") Object.assign(f, { targetValue: x.targetValue ?? "", currentValue: x.currentValue ?? "" });
    if (coll === "lagKPIs") Object.assign(f, { goal: x.goal ?? "", base: x.base ?? "", fun: x.fun || "기타" });
    return f;
  }, [it && it.id, K ? 1 : 0]);
  const [f, setF] = useState(null), [busy, setBusy] = useState(false);
  const v = f || init, set = (k, x) => setF({ ...v, [k]: x });
  if (!isMaster(cu)) return <Sheet title="KPI 고치기" onBack={onBack} onClose={onClose}><Card style={{ marginTop: 12 }}><Empty>KPI는 관리자만 고칠 수 있어요</Empty></Card></Sheet>;
  if (!K) return <Sheet title="KPI 고치기" onBack={onBack} onClose={onClose}><Card style={{ marginTop: 12 }}><Empty>불러오는 중이에요</Empty></Card></Sheet>;
  if (!isNew && !it) return <Sheet title="KPI 고치기" onBack={onBack} onClose={onClose}><Card style={{ marginTop: 12 }}><Empty>그 KPI를 찾지 못했어요</Empty></Card></Sheet>;
  const numK = coll === "lagKPIs" ? ["goal", "base"] : coll === "subKPIs" ? ["targetValue", "currentValue"] : ["targetValue"];
  const manual = coll !== "subKPIs" || (isNew || skManual(it, D.projects));
  const bad = numK.filter((k) => !(k === "currentValue" && !manual) && String(v[k] ?? "").trim() !== "" && !isFinite(num(v[k])));
  const noName = !String(v[nm] || "").trim(), badYear = coll === "goals" && !/^20\d\d$/.test(String(v.year || "").trim());
  const save = async (hide) => {
    if (busy || (hide === undefined && (bad.length || noName || badYear))) return; setBusy(true);
    try {
      const at = nowIso(), id = isNew ? newKpiId(coll) : it.id, next = {};
      if (hide === undefined) {
        // 내가 바꾼 칸만 보냄 (시트를 연 뒤 다른 마스터가 고친 칸을 되돌리지 않게 · 새로 만들 땐 전부)
        Object.entries(v).forEach(([k, x]) => { if (k === "currentValue" && !manual) return; if (!isNew && String(x ?? "") === String(init[k] ?? "")) return; next[k] = numK.includes(k) ? num(x) : String(x ?? "").trim(); });
        if (coll === "subKPIs" && manual && next.currentValue != null && (isNew || num(init.currentValue) !== next.currentValue)) next.manualOverride = true;
        if (isNew) {
          if (coll === "goals") next.brand = s.brand;
          if (coll === "lagKPIs") Object.assign(next, { brand: s.brand, order: 900, baseNote: "업무OS에서 추가", monthly: {} });
          if (coll === "mainKPIs") Object.assign(next, { goalId: s.goalId, order: 90 });
          if (coll === "subKPIs") Object.assign(next, { mainKPIId: s.mainKPIId, order: 90, salesAuto: false, channelCode: "" });
        }
      }
      const r = await fb.txDoc("kpidefs", id, (c) => { const w = kpiEditWrite(c, coll, id, next, hide, cu, at, base); return w ? { write: w, ret: 1 } : {}; });
      setToast && setToast({ text: !r ? "바뀐 것이 없어요" : hide === true ? "숨겼어요 · 숨긴 것에서 다시 보일 수 있어요" : hide === false ? "다시 보이게 했어요" : isNew ? `${KCOLL_L[coll]}를 추가했어요` : "저장했어요" });
      if (r) (onBack || onClose)();
    } catch (e) { console.error("[KPI 고치기] 저장 실패:", e); setToast && setToast({ text: "저장하지 못했어요 · 인터넷 연결을 확인해 주세요" }); }
    finally { setBusy(false); }
  };
  const fld = (label, k, ph, mode) => <label className="v2-kfld"><span>{label}</span><input value={v[k] ?? ""} inputMode={mode} placeholder={ph || ""} onChange={(e) => set(k, e.target.value)} style={{ ...inp, borderColor: bad.includes(k) ? C.red : C.line }} /></label>;
  const ov = !isNew && (D.kpi.ov || []).find((o) => o.id === it.id);
  return <Sheet title={isNew ? `${KCOLL_L[coll]} 추가` : `${KCOLL_L[coll]} 고치기`} onBack={onBack} onClose={onClose}
    foot={<Big onClick={() => save()} disabled={busy || !!bad.length || noName || badYear}>{busy ? "저장하는 중" : noName ? "이름을 넣어 주세요" : badYear ? "연도는 2026처럼 넣어 주세요" : bad.length ? "숫자만 넣어 주세요" : isNew ? "추가" : "저장"}</Big>}>
    {it && it._hidden && <p className="v2-kednote" style={{ marginTop: 12 }}>지금 숨겨져 있어요</p>}
    {fld("이름", nm, coll === "subKPIs" ? "예: 자사몰 매출" : "")}
    {coll === "mainKPIs" && fld("짧은 이름 (선택)", "krKey", "예: 메인1")}
    {coll === "goals" && fld("연도", "year", "2026", "numeric")}
    {coll === "lagKPIs" ? fld("목표 (비우면 목표 없음)", "goal", "", "decimal") : fld("목표", "targetValue", "", "decimal")}
    <div className="v2-kfld"><span>단위</span><div className="v2-chips" style={{ flexWrap: "wrap" }}>{UNITS.map((u) => <Chip key={u} on={v.unit === u} onClick={() => set("unit", u)}>{u}</Chip>)}</div></div>
    {coll === "lagKPIs" && fld("기준값 (선택)", "base", "", "decimal")}
    {coll === "lagKPIs" && <div className="v2-kfld"><span>묶음</span><div className="v2-chips" style={{ flexWrap: "wrap" }}>{AK_FUNS.map((u) => <Chip key={u} on={v.fun === u} onClick={() => set("fun", u)}>{u}</Chip>)}</div></div>}
    {coll === "subKPIs" && (manual ? fld("지금 값 (직접 입력)", "currentValue", "", "decimal")
      : <p className="v2-kednote">지금 값은 자동이에요({it.crmSynced ? "CRM" : it.launchCount ? "신제품 출시 수" : it.unit === "%" ? "연결된 프로젝트 진척 평균" : it.unit === "원" && it.mainKPIId !== "mk2" ? "매출 자동 연결" : "프로젝트 합계"}) · 이름·목표·단위만 바꿀 수 있어요</p>)}
    {!isNew && <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
      {it._hidden ? <TBtn onClick={() => save(false)} disabled={busy}>다시 보이기</TBtn> : <TBtn tone="mute" onClick={() => save(true)} disabled={busy}>숨기기</TBtn>}
    </div>}
    {ov && (ov.hist || []).length > 0 && <><Head>바뀐 기록</Head><Card>{(ov.hist || []).slice(-5).reverse().map((h, i, a) => <div key={i} className="v2-krow" style={{ borderBottom: i === a.length - 1 ? "none" : undefined }}>
      <div className="s" style={{ marginTop: 0 }}>{md(ymd(new Date(h.at)))} · {h.byName} · {Object.entries(h.ch || {}).map(([k, [a0, b0]]) => k === "_hidden" ? (b0 ? "숨김" : "다시 보임") : `${FL[k] || k} ${a0 ?? "—"} → ${b0 ?? "—"}`).join(" · ")}</div></div>)}</Card></>}
    <p className="v2-kednote" style={{ marginTop: 14 }}>고친 것은 업무OS v2 에만 저장돼요 · 버전1 KPI 화면 값은 그대로 · 지우기 대신 숨기기</p>
  </Sheet>;
}
const FL = { title: "이름", name: "이름", targetValue: "목표", goal: "목표", unit: "단위", currentValue: "지금 값", base: "기준값", krKey: "짧은 이름", year: "연도", fun: "묶음", manualOverride: "직접 입력" };
