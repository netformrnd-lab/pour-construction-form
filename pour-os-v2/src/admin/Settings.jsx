// 관리자 · 설정 (머리 [설정] 버튼 · 시트)
// 버전1에서 다시 가져오기(미리 보기 → 확인 → 가져오기, v2에서 고친 문서는 건너뜀) · 사람별 주 한도 · 신제품 순서표(읽기 전용) · 공휴일 · 이 기기에서 나가기
import { useState } from "react";
import * as fb from "../fb.js";
import { planReimport, runReimport, nowIso } from "../core.jsx";
import { md, hm, ymd, activeUsers, isMaster, KR_HOLIDAYS, COUNT_L, holidayLayer, ROAD_CATS, LAUNCH_ROAD, catRoad, builtinRoad, roadsDoc, roadOwn, isFlowProj, isLaunchProj, isGhProj, projOpen, projCat, phaseOfTask, roadProblem, sameRoad, cleanRoad } from "../model.js";
import { RoadEdit, roadLine } from "../roadui.jsx";
import { LAUNCH_PHASES, LAUNCH_AFTER, LAUNCH_ITEMS } from "../launch.js";
import { C, Big, Act, TBtn, Head, Card, Row, Empty, Sheet, Ask, More, inp } from "../ui.jsx";
import { wdOf } from "./common.jsx";
import { LaunchOwnerSync } from "./LaunchLink.jsx";
import { MoyImport } from "./MoyImport.jsx";
import { pinHash } from "../sha.js";

const KIND_L = { launch: "버전1 신제품 보드 다시 가져오기", all: "버전1 전체 다시 가져오기" };
const NAVY_BTN = { background: C.navy, color: "#fff", borderColor: C.navy };
const itemName = (id) => (LAUNCH_ITEMS.find((i) => i.id === id) || {}).name || id;

export function SettingsSheet({ D, cu, A, meta, setMeta, logout, onBack, onClose, setToast, holJ }) {
  const [st, setSt] = useState(null);   // {kind, step:'plan'|'ready'|'run'|'err', plan, n, total, msg}
  const [ask, setAsk] = useState(""), [caps, setCaps] = useState({}), [busy, setBusy] = useState(false), [showAfter, setShowAfter] = useState(false), [showHol, setShowHol] = useState(false);
  const c = (meta && meta.counts) || {};
  const users = activeUsers(D.users).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  // ① 미리 보기 (읽기만: v1 읽기 + v2 목록 읽기 · 쓰기 없음)
  const plan = async (kind) => {
    setSt({ kind, step: "plan" });
    try { const p = await refine(await planReimport(kind, D)); setSt({ kind, step: "ready", plan: p }); }
    catch (e) { console.error("[v2 관리] 가져오기 미리 보기 실패:", e); setSt({ kind, step: "err", msg: e.message }); }
  };
  // planReimport 가 모든 칸을 비교하고, 이미 있는 사람의 PIN 칸은 빼고 씀 → 버전1 PIN 으로 돌아가는 사람 없음
  const refine = async (p) => ({ ...p, pinBack: [] });
  // ② 확인 뒤 가져오기 (merge · 건너뛴 문서는 바꾸지 않음)
  //   미리 본 뒤에 다른 사람이 고친 문서를 덮지 않게, 쓰기 바로 전에 다시 계산 → 숫자가 달라졌으면 쓰지 않고 새 숫자로 다시 물음
  const same = (a, b) => a.overwrite === b.overwrite && a.skip === b.skip && a.fresh === b.fresh;
  const run = async () => {
    setAsk(""); const { kind, plan: p0 } = st;
    try {
      setSt({ kind, step: "plan", plan: p0 });
      const p = await refine(await planReimport(kind, D));
      if (!same(p, p0)) { setSt({ kind, step: "ready", plan: p, was: p0 }); return; }
      setSt({ kind, step: "run", plan: p, n: 0, total: p.ops.length });
      await runReimport(p, (n, total) => setSt((s) => ({ ...s, n, total })));
      const m = kind === "all" ? { reseededAt: nowIso(), reseededBy: cu.name, counts: { ...c, ...p.counts } } : { launchAt: nowIso(), counts: { ...c, launch: p.counts.launch } };
      await fb.setMeta(m); setMeta({ ...(meta || {}), ...m });
      A.log("edit", { col: "meta", label: `${KIND_L[kind]} · 덮어씀 ${p.overwrite} · 건너뜀 ${p.skip} · 새로 ${p.fresh}` });
      setToast({ text: `가져왔어요 · v2에서 고친 문서 ${p.skip}개는 그대로 뒀어요` }); setSt(null);
    } catch (e) { console.error("[v2 관리] 다시 가져오기 실패:", e); setSt({ kind, step: "err", msg: e.message }); }
  };
  const changed = users.filter((u) => caps[u.id] !== undefined && caps[u.id] !== "" && Number(caps[u.id]) !== (Number(u.weekCap) || 15));
  const saveCaps = async () => {
    if (changed.some((u) => !(Number(caps[u.id]) >= 1 && Number(caps[u.id]) <= 99))) { setToast({ text: "주 한도는 1~99 사이 숫자로 넣어 주세요" }); return; }
    setBusy(true);
    try { await fb.patchMany(changed.map((u) => ({ key: "users", id: u._doc || u.id, fields: { weekCap: Math.round(Number(caps[u.id])) } })));
      A.log("edit", { col: "users", label: `주 한도 ${changed.map((u) => `${u.name} ${Math.round(Number(caps[u.id]))}`).join(" · ")}`, prev: changed.map((u) => ({ id: u.id, weekCap: u.weekCap || null })) });
      setToast({ text: `${changed.length}명 주 한도를 바꿨어요` }); setCaps({}); }
    catch (e) { console.error("[v2 관리] 주 한도 저장 실패:", e); setToast({ text: "주 한도 저장 실패 · 인터넷 연결을 확인해 주세요" }); }
    setBusy(false);
  };
  // 쉬는 날 = 앱 안 표 + 매달 자동 갱신(공식 특일 정보) + 회사만 쉬는 날(여기서 마스터가 넣고 뺌 · settings/holidays)
  const y0 = ymd(new Date()).slice(0, 4), comp = ((D.settings || []).find((x) => x.id === "holidays") || {}).days || {}, fetched = holidayLayer("fetched");
  const holM = {}; [[KR_HOLIDAYS, "기본"], [fetched, "자동"], [comp, "회사"]].forEach(([m, src]) => Object.entries(m || {}).forEach(([d, n]) => { if (d >= y0) holM[d] = holM[d] ? { ...holM[d], srcs: [...new Set([...holM[d].srcs, src])] } : { n, srcs: [src] }; }));
  const hol = Object.entries(holM).sort((a, b) => a[0].localeCompare(b[0]));
  const [cd, setCd] = useState(""), [cn, setCn] = useState(""), [cBusy, setCBusy] = useState(false);
  // 날짜 하나만 넣고 뺌(days.날짜) — 두 마스터가 동시에 넣어도 서로 지우지 않음
  const saveComp = async (d, name, label) => { setCBusy(true);
    try { await fb.merge("settings", "holidays", { id: "holidays", days: { [d]: name == null ? fb.deleteField() : name }, updatedAt: nowIso(), updatedBy: cu.id }); A.log("edit", { col: "settings", targetId: "holidays", label: `회사 쉬는 날 · ${label}`, prev: { [d]: comp[d] || null } }); setToast({ text: `회사 쉬는 날 · ${label}` }); }
    catch (e) { console.error("[v2 관리] 회사 쉬는 날 저장 실패:", e); setToast({ text: "저장 실패 · 인터넷 연결을 확인해 주세요" }); }
    setCBusy(false); };
  const addComp = () => { if (!cd || !cn.trim() || cBusy) return; saveComp(cd, cn.trim(), `${md(cd)} ${cn.trim()} 넣음`); setCd(""); setCn(""); };
  const last = holJ && holJ.last;
  return <Sheet title="설정" onBack={onBack} onClose={onClose}>
    <BulkCodes D={D} cu={cu} A={A} setToast={setToast} />
    <Head>신제품 대시보드 연결</Head>
    <LaunchOwnerSync D={D} cu={cu} A={A} setToast={setToast} />
    <Head>버전1에서 다시 가져오기</Head>
    <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <div>복사한 때: {meta && meta.reseededAt ? `${md(ymd(new Date(meta.reseededAt)))} ${hm(meta.reseededAt)} · ${meta.reseededBy || ""}` : meta && meta.seededAt ? `${md(ymd(new Date(meta.seededAt)))} ${hm(meta.seededAt)}` : "-"}{meta && meta.launchAt ? ` · 신제품 ${md(ymd(new Date(meta.launchAt)))} ${hm(meta.launchAt)}` : ""}</div>
      <div>{Object.entries(c).filter(([k]) => COUNT_L[k]).map(([k, v]) => `${COUNT_L[k]} ${v}`).join(" · ")}</div>
      <div style={{ marginTop: 6 }}>버전1은 읽기만 해요. v2에서 고친 문서(담당·기한·메모·파일을 정리한 업무, v2에서 만든 것)는 건너뛰어서 그대로 남아요. PIN · 주 한도 · 고정업무 체크도 그대로예요.</div>
      {(!st || st.step === "err") && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <Big tone="white" onClick={() => plan("launch")}>{KIND_L.launch} · 미리 보기</Big>
        <Big tone="white" onClick={() => plan("all")}>{KIND_L.all} · 미리 보기</Big></div>}
      {st && st.step === "err" && <p role="alert" style={{ margin: "10px 0 0", color: C.ink, fontWeight: 800 }}>가져오지 못했어요: {st.msg}</p>}
      {st && st.step === "plan" && <div style={{ marginTop: 10 }}><Big disabled>버전1 읽고 비교하는 중…</Big></div>}
      {st && st.step === "run" && <div style={{ marginTop: 10 }}><Big disabled>가져오는 중 {st.n}/{st.total}</Big></div>}
      {st && st.step === "ready" && <div className="a-prev" role="status" style={{ marginTop: 10 }}>
        <div><b>{KIND_L[st.kind]}</b></div>
        {st.was && <div style={{ color: C.ink, fontWeight: 800 }}>미리 본 뒤에 바뀐 문서가 있어서 다시 셌어요 (전에는 덮어쓸 {st.was.overwrite} · 건너뜀 {st.was.skip} · 새로 {st.was.fresh}). 숫자를 보고 다시 눌러 주세요.</div>}
        <div>덮어쓸 문서 <b>{st.plan.overwrite}</b> · v2에서 고쳐서 건너뛰는 문서 <b>{st.plan.skip}</b> · 새로 생기는 문서 <b>{st.plan.fresh}</b></div>
        {st.plan.pinBack && st.plan.pinBack.length > 0 && <div>· 버전1에 PIN이 있는 {st.plan.pinBack.join("·")}님은 버전1 PIN으로 돌아가요</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Act onClick={() => setAsk("run")} style={NAVY_BTN}>가져오기</Act><Act onClick={() => setSt(null)}>그만</Act></div>
      </div>}
    </Card>

    {isMaster(cu) && <><Head>모여라딜 OS 최신 데이터 가져오기</Head>
      <MoyImport D={D} cu={cu} A={A} meta={meta} setMeta={setMeta} setToast={setToast} /></>}

    <Head right={changed.length > 0 && <Act onClick={saveCaps} style={NAVY_BTN}>{busy ? "저장 중" : `${changed.length}명 저장`}</Act>}>사람별 주 한도</Head>
    <Card>{users.map((u, i) => <div key={u.id} className="a-caprow" style={{ borderBottom: i < users.length - 1 ? `1px solid ${C.line}` : "none" }}>
      <b>{u.name}</b><span className="sub">{u.weekCap ? `지금 ${u.weekCap}건` : "기본 15건"}</span>
      <input type="number" inputMode="numeric" min={1} max={99} aria-label={`${u.name} 주 한도`} placeholder={String(Number(u.weekCap) || 15)} value={caps[u.id] ?? ""} onChange={(e) => setCaps({ ...caps, [u.id]: e.target.value.replace(/\D/g, "").slice(0, 2) })} style={{ ...inp, width: 76, padding: "8px 10px", fontSize: 14 }} />
    </div>)}</Card>
    <p className="a-hint">한 주 마감이 한도를 넘으면 사람 표에서 숫자가 빨갛게 보여요. 저장하는 건 한도 숫자 하나뿐이에요.</p>

    <Head>프로젝트 단계(로드) <span style={{ fontWeight: 600, color: C.mute }}>(카테고리 기본)</span></Head>
    <RoadDefaults D={D} cu={cu} A={A} />

    <Head>신제품 순서표 <span style={{ fontWeight: 600, color: C.mute }}>(보기만)</span></Head>
    <Card><More onClick={() => setShowAfter(!showAfter)}>{showAfter ? "접기 ▴" : "항목별 앞 일 보기 ▾"}</More>
      {showAfter && <LaunchOrderView />}</Card>

    <Head>쉬는 날 <span style={{ fontWeight: 600, color: C.mute }}>(기한 · 달력 · 고정업무에서 건너뜀)</span></Head>
    <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.sub, lineHeight: 1.7 }}>
      <div><b style={{ color: C.ink }}>공휴일 자동 갱신</b> · {holJ ? `매달 1일 공식 특일 정보 확인 · 마지막 ${md(ymd(new Date(holJ.updatedAt)))}` : "아직 자동 갱신 파일이 없어요 (서비스 키를 넣으면 다음 달 1일부터 · 지금은 앱 안 표로 계산)"}</div>
      {holJ && <div>{last && last.note ? `최근 바뀐 것: ${last.note}${last.at ? ` (${md(ymd(new Date(last.at)))})` : ""}` : "최근 바뀐 것 없음"}</div>}
      <div style={{ marginTop: 10 }}><b style={{ color: C.ink }}>회사만 쉬는 날</b> · 창립기념일 · 여름휴가처럼 회사 전체가 쉬는 날</div>
      {Object.keys(comp).length === 0 ? <div>아직 없어요</div> : Object.entries(comp).sort().map(([d, n]) => <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, color: C.text }}>{d.slice(0, 4)}년 {md(d)} ({wdOf(d)}) {n}</span>
        <TBtn tone="mute" disabled={cBusy} onClick={() => saveComp(d, null, `${md(d)} ${n} 뺌`)}>빼기</TBtn></div>)}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <input type="date" aria-label="회사 쉬는 날 날짜" value={cd} onChange={(e) => setCd(e.target.value)} className="v2-sel" />
        <input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="이름 (예: 창립기념일)" aria-label="회사 쉬는 날 이름" style={{ ...inp, flex: "1 1 140px", width: "auto", padding: "8px 10px", fontSize: 14 }} />
        <Act onClick={addComp} style={cd && cn.trim() ? NAVY_BTN : { opacity: 0.5 }}>{cBusy ? "저장 중" : "넣기"}</Act></div>
    </Card>
    <Card style={{ marginTop: 8 }}><More onClick={() => setShowHol(!showHol)}>{showHol ? "접기 ▴" : `올해부터 쉬는 날 ${hol.length}일 보기 ▾`}</More>
      {showHol && <div style={{ padding: "4px 14px 14px", fontSize: 13, color: C.text, lineHeight: 1.75 }}>{hol.map(([d, x]) => <div key={d}>{d.slice(0, 4)}년 {md(d)} ({wdOf(d)}) {x.n} <span style={{ color: C.mute }}>· {x.srcs.join("·")}</span></div>)}</div>}</Card>

    <Head>이 기기</Head>
    <Card><Row title={`${cu.name} · 관리자`} sub="이 기기에서 나가고 이름을 다시 골라요" onClick={() => setAsk("out")} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last /></Card>

    {ask === "run" && st && st.plan && <Ask title={KIND_L[st.kind]} body={`덮어쓸 문서 ${st.plan.overwrite} · 건너뛰는 문서 ${st.plan.skip} · 새로 생기는 문서 ${st.plan.fresh}\n· v2에서 정리한 담당·기한은 그대로 남아요 (메모·파일도)\n· 버전1은 읽기만 해요(바뀌지 않아요)\n· PIN · 주 한도 · 고정업무 체크 같은 v2 전용 칸은 그대로예요\n· 누르면 한 번 더 비교한 뒤 가져와요${st.plan.pinBack && st.plan.pinBack.length ? `\n· ${st.plan.pinBack.join("·")}님 PIN은 버전1 PIN으로 돌아가요` : ""}`} yes="가져오기" onNo={() => setAsk("")} onYes={run} />}
    {ask === "out" && <Ask title="이 기기에서 나가기" body={"다시 들어올 때 이름과 PIN을 넣어요."} yes="나가기" onNo={() => setAsk("")} onYes={() => { setAsk(""); logout(); }} />}
  </Sheet>;
}

// 신제품 순서표 (읽기 전용) — 설정 · 프로젝트 탭에서 같이 엶
export function LaunchOrderView() {
  return <div style={{ padding: "4px 14px 14px", fontSize: 13, color: C.text, lineHeight: 1.75 }}>
    <div style={{ color: C.sub, marginBottom: 6 }}>항목마다 '앞'에 적힌 일이 모두 끝나야 그 항목 차례예요. 고치기는 BM 확인 뒤에 만들어요.</div>
    <div style={{ color: C.ink, fontWeight: 700, marginBottom: 6 }}>기본 담당 흐름: 정하 → 민지 → 우민 / 소연 → 채림 → 우민 → 지은 → 민지 / 미니</div>
    {LAUNCH_PHASES.map((ph) => <div key={ph.k} style={{ marginTop: 8 }}><b style={{ color: C.ink }}>{ph.name}</b>
      {ph.items.map((it) => <div key={it.id}>· {it.name} <span style={{ color: C.sub }}>· {(LAUNCH_AFTER[it.id] || []).length ? "앞: " + LAUNCH_AFTER[it.id].map(itemName).join(", ") : "시작 항목"}</span></div>)}</div>)}
  </div>;
}
export function LaunchOrderSheet({ onBack, onClose }) {
  return <Sheet title="신제품 순서표" onBack={onBack} onClose={onClose}><Card style={{ marginTop: 12 }}><LaunchOrderView /></Card></Sheet>;
}

// PIN 시작 코드 한꺼번에 (정밀 검토 2026-10-06 · 시범 첫날 남의 이름으로 PIN을 먼저 정하는 것 막기)
//  PIN 없는 사용 중인 사람마다 4자리 → 해시만 users.pinInvite (아직 PIN 없을 때만 · patchIf) · 코드는 이 화면에 한 번만 · 이미 코드가 있던 사람은 새 코드로 바뀜
export function BulkCodes({ D, cu, A, setToast }) {
  const need = activeUsers(D.users).filter((u) => !u.pinHash).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  const [codes, setCodes] = useState(null), [busy, setBusy] = useState(false), [ask, setAsk] = useState(false);
  if (!need.length && !codes) return null;
  const make = async () => {
    setAsk(false); setBusy(true); const out = [], at = nowIso();
    try {
      for (const u of need) {
        const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
        const r = await fb.patchIf("users", u._doc || u.id, { pinHash: null }, { pinInvite: pinHash(u.id, "inv:" + c), pinInviteAt: at, pinInviteBy: cu.id });
        if (r.ok) out.push({ name: u.name, code: c }); else out.push({ name: u.name, code: "", note: "그사이 PIN을 정함" });
      }
      A.log("edit", { col: "users", targetId: "", label: `시작 코드 한꺼번에 만듦 · ${out.filter((x) => x.code).length}명` });
      setCodes(out); setToast({ text: `시작 코드 ${out.filter((x) => x.code).length}명 만들었어요 · 이 화면을 닫으면 다시 볼 수 없어요` });
    } catch (e) { console.error("[v2 관리] 시작 코드 한꺼번에 실패:", e); setToast({ text: "저장 실패 · 인터넷 연결을 확인해 주세요" }); if (out.length) setCodes(out); }
    setBusy(false);
  };
  const text = (codes || []).filter((x) => x.code).map((x) => `${x.name} ${x.code}`).join("\n");
  const copy = () => { try { navigator.clipboard.writeText(text).then(() => setToast({ text: "복사했어요" }), () => setToast({ text: "복사가 막혀 있어요 · 화면을 보고 알려 주세요" })); } catch (_) { setToast({ text: "복사가 막혀 있어요 · 화면을 보고 알려 주세요" }); } };
  return <>
    <Head>PIN 시작 코드</Head>
    <Card style={{ padding: "12px 14px" }}>
      {!codes ? <>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>PIN 없는 사람 {need.length}명 · {need.map((u) => u.name).join(" · ")}<br /><span style={{ color: C.sub, fontSize: 12.5 }}>시작 코드가 있으면 그 코드를 받은 본인만 처음 PIN을 정할 수 있어요 (이름만 골라 남의 PIN을 먼저 정하는 것 막기)</span></div>
        <div style={{ marginTop: 10 }}><TBtn v="solid" disabled={busy} onClick={() => setAsk(true)}>{busy ? "만드는 중" : `시작 코드 ${need.length}명 한꺼번에 만들기`}</TBtn></div>
      </> : <>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>한 사람씩 본인에게만 알려 주세요 · 이 화면을 닫으면 다시 볼 수 없어요(잊으면 사람 보기에서 다시 만들기)</div>
        {codes.map((x) => <div key={x.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}><b>{x.name}</b>
          <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: 4, fontWeight: 800, color: x.code ? C.ink : C.mute }}>{x.code || x.note}</span></div>)}
        <div style={{ marginTop: 10 }}><TBtn onClick={copy}>목록 복사</TBtn></div>
      </>}
    </Card>
    {ask && <Ask title="시작 코드 한꺼번에 만들기" body={`PIN 없는 ${need.length}명에게 새 시작 코드를 만들어요.\n이미 코드를 받은 사람도 새 코드로 바뀌어요.\n코드는 이 화면에 한 번만 보여요.`} yes="만들기" onNo={() => setAsk(false)} onYes={make} />}
  </>;
}

// 프로젝트 단계(로드) 카테고리 기본 (사용자 확정 2026-10-07 '카테고리별 로드') — settings/roads {roads:{카테고리: [{k,name}]}} · 관리자만 · A.setCatRoad(조건부 · 기록 · 5초 되돌리기)
//   단계를 따로 고치지 않은 열린 프로젝트(road 칸 없음 · 흐름 빼고)는 바로 따라감 · 업무는 안 고침 · 신제품 출시는 신제품 대시보드 7단계 그대로(보기만)
export function RoadDefaults({ D, cu, A }) {
  const [edit, setEdit] = useState(null), [ask, setAsk] = useState(null), [busy, setBusy] = useState(false);   // edit {cat, road, seen}
  const doc = roadsDoc(D), stored = (cat) => (doc && doc.roads && doc.roads[cat] != null ? doc.roads[cat] : null);
  const follow = (cat) => (D.projects || []).filter((p) => projOpen(p) && !isLaunchProj(p) && !isGhProj(p.id) && !isFlowProj(p) && !roadOwn(p) && (projCat(p) || "none") === cat);
  const prob = edit ? roadProblem(edit.road) : "";
  const goneN = (cat, road) => { const keep = new Set(road.map((x) => x.k)); let n = 0, ps = 0;
    follow(cat).forEach((p) => { const m = (D.tasks || []).filter((t) => t.projectId === p.id && !t.isFixed && !isDoneT(t) && (() => { const k = phaseOfTask(t, p, D); return k && !keep.has(k); })()).length; if (m) { n += m; ps++; } });
    return { n, ps }; };
  const save = async (force) => { if (!edit || prob || busy) return; const g = goneN(edit.cat, edit.road);
    if (g.n && !force) { setAsk(g); return; }
    setAsk(null); setBusy(true); const ok = await A.setCatRoad(edit.cat, edit.road, edit.seen); setBusy(false); if (ok) setEdit(null); };
  return <Card style={{ padding: "12px 14px", fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
    <div style={{ color: C.sub, fontSize: 12.5 }}>새 프로젝트를 만들 때 카테고리를 고르면 이 단계가 깔려요. 여기서 바꾸면 단계를 따로 고치지 않은 진행 중 프로젝트에 바로 보여요(업무는 그대로 · 뺀 단계의 업무는 '단계 미정'으로).</div>
    <div className="a-roadrow"><div><b>신제품 출시</b> <span style={{ color: C.mute, fontSize: 12.5 }}>· 신제품 대시보드 7단계 그대로 · 여기서는 못 바꿔요</span></div><div className="ln">{roadLine(LAUNCH_ROAD)}</div></div>
    {ROAD_CATS.map(([cat, l]) => { const r = catRoad(cat === "none" ? "" : cat, D), n = follow(cat).length, on = edit && edit.cat === cat;
      return <div key={cat} className="a-roadrow">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ flex: "1 1 auto" }}>{l}</b>
          <span style={{ color: C.mute, fontSize: 12.5 }}>{stored(cat) ? "바꾼 단계" : "앱 기본"} · 따르는 프로젝트 {n}개</span>
          {!on && <TBtn v="soft" onClick={() => { setAsk(null); setEdit({ cat, road: r.map((x) => ({ ...x })), seen: stored(cat) }); }} aria-label={`${l} 단계 고치기`}>고치기</TBtn>}</div>
        {!on ? <div className="ln">{roadLine(r)}</div> : <div style={{ marginTop: 6 }}>
          <RoadEdit road={edit.road} onChange={(road) => setEdit({ ...edit, road })} label={`${l} 기본 단계 고치기`} />
          {prob && <div role="status" style={{ fontSize: 12.5, color: C.ink, fontWeight: 700 }}>{prob}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            <TBtn v="solid" disabled={!!prob || busy || sameRoad(edit.road, r)} onClick={() => save(false)}>{busy ? "저장 중" : "저장"}</TBtn>
            <TBtn onClick={() => { setEdit(null); setAsk(null); }}>그만</TBtn>
            {!sameRoad(edit.road, builtinRoad(cat)) && <TBtn tone="mute" onClick={() => setEdit({ ...edit, road: builtinRoad(cat).map((x) => ({ ...x })) })}>앱 기본으로</TBtn>}
          </div></div>}
      </div>; })}
    {ask && <Ask title="단계를 빼요" body={`이 카테고리를 따르는 프로젝트 ${ask.ps}개의 업무 ${ask.n}개가 '단계 미정'으로 보여요.\n업무는 지우지 않아요 · 프로젝트 화면 '단계 정리'에서 다시 넣을 수 있어요 · 5초 안에 되돌릴 수 있어요.`} yes="빼고 저장" onNo={() => setAsk(null)} onYes={() => save(true)} />}
  </Card>;
}
const isDoneT = (t) => t && (t.status === "done" || t.status === "dropped");
