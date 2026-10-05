// 관리자 · 반복 실행 — 버전1 '반복 실행' 화면 모양: [전체 | 고정업무 | 행동지표] · 브랜드 · 사람
//  고정업무(v2 업무 isFixed): 매일=오늘 · 매주=이번 주 · 매월=이번 달 체크 수 (사람마다 1칸)
//  행동지표(AARRR): 정의 = 버전1 state-actionKPIs · 주별 실적 = 버전1 kpi-act-YYYY-Qn(읽기만) + 업무OS 오늘 화면 [+1] 기록(pour-os/v2/kpiact) 합계
import { useEffect, useMemo, useState } from "react";
import * as fb from "../fb.js";
import { ymd, md, activeUsers, nameOf, fxPeople, fxMeDone, fxRecurL, fxDueOn, fxDoneOn, fxMin, fxIds } from "../model.js";
import {
  AK_FUNS, AK_CYC, akYmd, akWeeksIn, akQuarterWeeks, akQidOfMonth, akVal, akWeekDone, akTotal, akCountable, akFullWeek, akPartial, akPeriodEnd, akGoalText, akWho, akOrder, akLink,
} from "../../../pour-os/src/actionKpi.js";
import { C, Chip, Seg, TBtn, Card, Empty, useLocal } from "../ui.jsx";
import { LS } from "../core.jsx";
import { sumAk } from "../routine.js";

// 버전1 문서 하나 실시간 읽기 (d: undefined = 불러오는 중, null = 없음)
function useV1Doc(id) {
  const [st, setSt] = useState({ id: "", d: undefined, err: "" });
  useEffect(() => { if (!id) return undefined; setSt({ id, d: undefined, err: "" });
    return fb.listenV1Doc(id, (d) => setSt({ id, d, err: "" }), (e) => setSt({ id, d: null, err: e.code || e.message || "읽기 실패" })); }, [id]);
  return st.id === id ? st : { id, d: undefined, err: "" };
}

const RT = [["daily", "매일", "오늘"], ["weekly", "매주", "이번 주"], ["monthly", "매월", "이번 달"]];
const tile = (l, d, t, sub) => <div className="a-rtile"><span className="l">{l}</span>
  {t ? <b className="v">{d}<small> / {t} 달성</small></b> : <b className="v none">해당 없음</b>}
  <div className="track"><i style={{ width: `${t ? Math.min(100, (d / t) * 100) : 0}%` }} /></div>{sub && <span className="s">{sub}</span>}</div>;

export function RoutineTab({ D, open }) {
  const [sec, setSec] = useLocal(LS("arsec"), "all"), [brand, setBrand] = useLocal(LS("arbrand"), "all"), [who, setWho] = useLocal(LS("arwho"), "all");
  const users = activeUsers(D.users), brands = (D.brands || []).filter((b) => b.active !== false).sort((a, b) => (+a.order || 0) - (+b.order || 0));
  const bkey = (v) => { const s = String(v || ""); const b = (D.brands || []).find((x) => x.id === s || x.name === s); return b ? b.id : s; };
  const inBrand = (v, def) => brand === "all" || (bkey(v) || def) === brand || (!v && !def);   // 브랜드 없는 고정업무 = 공통 (모든 브랜드에서 보임)
  const now = new Date(), key = ymd(now);
  // 고정업무
  const fxAll = (D.tasks || []).filter((t) => t.isFixed && !t.deleted);
  const fx = fxAll.filter((t) => !t.paused && inBrand(t.brand, ""));
  // 행동지표 (버전1 읽기)
  const def = useV1Doc("state-actionKPIs");
  const akAll = useMemo(() => (Array.isArray(def.d && def.d.items) ? def.d.items : []).filter((x) => x && x.id).sort(akOrder), [def.d]);
  const ak = akAll.filter((it) => it.active !== false && inBrand(it.brand, "pourstore"));
  const whoOfAk = (it) => akWho(D.users, it);
  // 사람 칩: 보이는 고정업무·행동지표에 들어 있는 사람
  const ppl = users.filter((u) => (sec !== "ak" && fx.some((t) => fxPeople(D.users, t).includes(u.id))) || (sec !== "fixed" && ak.some((it) => whoOfAk(it).includes(u.id))));
  const who1 = who === "all" || ppl.some((u) => u.id === who) ? who : "all";
  return <>
    <div className="a-rthead">
      <div style={{ flex: "1 1 260px", maxWidth: 420 }}><Seg items={[["all", "전체"], ["fixed", `고정업무 ${fx.length}`], ["ak", `행동지표 ${ak.length}`]]} value={sec} onChange={setSec} /></div>
      <span className="a-hint" style={{ margin: 0 }}>고정업무 = 반복 체크 · 행동지표 = KPI 목표 횟수 (보기만)</span>
    </div>
    <div className="v2-chips" role="group" aria-label="브랜드" style={{ marginTop: 10 }}>
      <Chip on={brand === "all"} onClick={() => setBrand("all")}>전체 브랜드</Chip>
      {brands.map((b) => <Chip key={b.id} on={brand === b.id} onClick={() => setBrand(b.id)}>{b.name}</Chip>)}
    </div>
    <div className="v2-chips" role="group" aria-label="사람" style={{ marginTop: 6 }}>
      <Chip on={who1 === "all"} onClick={() => setWho("all")}>모든 사람</Chip>
      {ppl.map((u) => <Chip key={u.id} on={who1 === u.id} onClick={() => setWho(u.id)}>{u.name}</Chip>)}
    </div>
    {sec !== "ak" && <FixedBoard D={D} fx={fx} paused={fxAll.filter((t) => t.paused && inBrand(t.brand, "")).length} who={who1} keyD={key} open={open} />}
    {sec !== "fixed" && <AkBoard D={D} items={ak} ready={def.d !== undefined} err={def.err} who={who1} whoOf={whoOfAk} />}
  </>;
}

// ── 고정업무: 매일 · 매주 · 매월 카드 + 줄마다 사람 체크 ──
function FixedBoard({ D, fx, paused, who, keyD, open }) {
  const [more, setMore] = useState({}), [noOn, setNoOn] = useState(false);
  const noOwner = (D.tasks || []).filter((t) => t.isFixed && !t.paused && !t.deleted && fxPeople(D.users, t).length === 0);   // 담당이 비었거나 모두 미사용 → 어디에도 안 보이던 고정업무
  const pairs = (t) => fxPeople(D.users, t).filter((u) => who === "all" || u === who);
  const rows = fx.filter((t) => pairs(t).length);
  const by = (rt) => rows.filter((t) => (t.recurType || "daily") === rt);
  const cnt = (list) => { let d = 0, n = 0; list.forEach((t) => pairs(t).forEach((u) => { n++; if (fxMeDone(t, u, keyD)) d++; })); return [d, n]; };
  // 시간 순서: 고른 사람의 시간(사람마다 다르게 정한 시간) → 아무 사람 중 가장 이른 시간 → 시간 없음은 맨 아래
  const tmin = (t) => Math.min(...(who === "all" ? [undefined, ...fxPeople(D.users, t)] : [who]).map((u) => fxMin(t, u)));
  const tlab = (t) => { const m = tmin(t); return m >= 9999 ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const today = (t) => (t.recurType || "daily") !== "daily" || fxDueOn(t, keyD);
  return <section aria-label="고정업무" className="a-rtsec">
    <h2 className="a-rth">고정업무 <span>정한 시간 순서 · 체크하면 끝 · 사람마다 한 칸{paused ? ` · 멈춘 ${paused}개 빼고` : ""}</span></h2>
    {noOwner.length > 0 && <div className="a-rtno"><button type="button" className="a-rtnoh" aria-expanded={noOn} onClick={() => setNoOn(!noOn)}>담당 없는 고정업무 <b>{noOwner.length}</b> · 누가 할지 정해 주세요 {noOn ? "▴" : "▾"}</button>
      {noOn && noOwner.map((t) => <button key={t.id} type="button" className="a-rtname" onClick={() => open({ type: "fixed", id: t.id })}><b>{t.title}</b><small>{fxRecurL(t)} · 전 담당 {fxIds(t).map((u) => nameOf(D.users, u)).filter(Boolean).join("·") || "없음"} · 눌러서 담당 정하기</small></button>)}</div>}
    <div className="a-rtiles">{RT.map(([rt, l, w]) => { const [d, n] = cnt(by(rt).filter(today)); return <div key={rt}>{tile(`${l} · ${w}`, d, n, n ? `${Math.round((d / n) * 100)}%` : "")}</div>; })}</div>
    {rows.length === 0 ? <Card style={{ marginTop: 10 }}><Empty>고른 조건에 맞는 고정업무가 없어요</Empty></Card>
    : RT.map(([rt, l, w]) => { const a = by(rt).sort((x, y) => tmin(x) - tmin(y) || String(x.title).localeCompare(String(y.title), "ko")); if (!a.length) return null;
      const m = more[rt], shown = m ? a : a.slice(0, 8), [d, n] = cnt(a);
      return <div key={rt} className="a-rtgrp">
        <div className="a-rtgh"><b>{l}</b><span>{w} {d} / {n}</span></div>
        <div className="a-rtlist">{shown.map((t) => { const ps = pairs(t), dn = ps.filter((u) => fxMeDone(t, u, keyD)).length;
          return <div key={t.id} className={"a-rtrow" + (dn === ps.length ? " all" : "")}>
            <button type="button" className="a-rtname" onClick={() => open({ type: "fixed", id: t.id })}><b>{t.title}</b><small>{tlab(t) ? `${tlab(t)} · ` : "시간 없음 · "}{fxRecurL(t)}{t.brand ? ` · ${((D.brands || []).find((b) => b.id === t.brand) || {}).name || ""}` : " · 공통"}</small></button>
            <div className="a-rtppl">{ps.map((u) => { const ok = fxMeDone(t, u, keyD), last = fxDoneOn(t, u);
              return <span key={u} className={"a-rtp" + (ok ? " ok" : "")} title={last ? `마지막 체크 ${md(last)}` : "체크 기록 없음"}>{ok ? "✓ " : ""}{nameOf(D.users, u) || "?"}</span>; })}</div>
            <span className="a-rtn">{dn}/{ps.length}</span>
          </div>; })}</div>
        {a.length > 8 && <button type="button" className="a-rtmore" onClick={() => setMore({ ...more, [rt]: !m })}>{m ? "접기 ▴" : `${a.length - 8}개 더 보기 ▾`}</button>}
      </div>; })}
  </section>;
}

// ── 행동지표: 버전1 표와 같은 계산 (주간 칸 · 월간·분기 누적), 주요 KPI → AARRR → 주기 ──
function AkBoard({ D, items, ready, err, who, whoOf }) {
  const today = akYmd(new Date());
  const [anchor, setAnchor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [kind, setKind] = useLocal(LS("arkind"), "all"), [cyc, setCyc] = useLocal(LS("arcyc"), "all"), [selKey, setSelKey] = useState(null);
  const y = anchor.getFullYear(), m0 = anchor.getMonth(), q = Math.floor(m0 / 3) + 1;
  const WK = akWeeksIn(y, m0), WQ = akQuarterWeeks(y, m0);
  const SEL = WK.find((w) => w.key === selKey) || WK.find((w) => w.start <= today && today <= w.end) || WK[0];
  const qid = akQidOfMonth(y, m0), act = useV1Doc("kpi-act-" + qid), v2q = ((D.ak && D.ak.v2) || []).find((x) => (x.id || x._doc) === qid);
  const docs = act.d || v2q ? { [qid]: sumAk(act.d, v2q) } : {};   // 버전1 실적(읽기만) + 업무OS 오늘 화면 [+1](v2 kpiact)
  const list = items.filter((it) => (who === "all" || whoOf(it).includes(who)) && (kind === "all" || (kind === "core" ? !!it.core : !it.core)) && (cyc === "all" || (cyc === "W" ? it.cyc === "W" : it.cyc !== "W")));
  const wksFor = (it) => (it.cyc === "Q" ? WQ : WK).filter((w) => it.cyc !== "W" || akCountable(it, w));
  const tot = (it) => akTotal(docs, it, wksFor(it));
  const part = (it) => akPartial(it, it.cyc === "Q" ? WQ : WK);
  const Wi = list.filter((it) => it.cyc === "W" && !it.perFail && akCountable(it, SEL)), Mi = list.filter((it) => it.cyc === "M" && !tot(it).none && !part(it)), Qi = list.filter((it) => it.cyc === "Q" && !part(it));
  const wd = Wi.filter((it) => akWeekDone(docs, it, SEL.key)).length, mdn = Mi.filter((it) => tot(it).done).length, qd = Qi.filter((it) => tot(it).done).length;
  const wRatio = (w) => { const l = list.filter((i) => i.cyc === "W" && !i.perFail && akCountable(i, w)); return l.length ? `${l.filter((i) => akWeekDone(docs, i, w.key)).length}/${l.length}` : ""; };
  const mks = [...(D.mainKPIs || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const mkOf = (it) => { const k = akLink(it).mk; return mks.some((m) => m.id === k) ? k : ""; };
  const groups = [...mks.map((m) => ({ key: m.id, m })), { key: "", m: null }];
  const cell = (it, w) => { const n = akVal(docs, it, w.key), goal = +it.goal || 1, done = n >= goal, fut = w.start > today, past = w.end < today, pre = !akCountable(it, w);
    const cls = pre && !n ? "pre" : done ? "done" : fut ? "fut" : past && akFullWeek(it, w) ? "miss" : n > 0 ? "part" : "";
    return <span key={w.key} className={"a-akc " + cls + (SEL.key === w.key ? " sel" : "")} title={`${w.label} 주 ${n}/${goal}`}>{pre && !n ? "–" : done && goal === 1 ? "✓" : `${n}/${goal}`}</span>; };
  const span = (it) => { const t = tot(it), past = akPeriodEnd(it, y, m0) < today, pct = t.g ? Math.min(100, (t.n / t.g) * 100) : 0;
    const cls = t.done ? "done" : past && !t.none && !part(it) ? "miss" : t.n > 0 ? "part" : "";
    const val = it.unit === "%" ? `${t.n}%` : t.none ? (t.n ? `${t.n}회 시도` : "매칭 실패 없음") : `${t.n} / ${t.g}${it.unit || ""}`;
    const state = t.done ? "달성" : part(it) ? "시작한 달 · 참고" : t.none || it.unit === "%" ? "" : `${Math.round(pct)}%`;
    return <div className={"a-aksp " + cls}><i style={{ width: `${pct}%` }} /><b>{val}</b>{state && <span>{state}</span>}<em>{it.cyc === "Q" ? `${q}분기 누적` : `${m0 + 1}월 누적`}</em></div>; };
  const row = (it) => { const t = tot(it);
    return <div key={it.id} className="a-akrow">
      <div className="a-akn"><b>{it.name}</b>
        <span className="tags">{whoOf(it).map((id) => <span key={id} className="tg">{nameOf(D.users, id)}</span>)}{!whoOf(it).length && <span className="tg mute">담당 미정</span>}{it.how === "외주" && <span className="tg">외주</span>}{!it.core && <span className="tg">추가</span>}<span className="goal">{akGoalText(it)}</span></span></div>
      {it.cyc === "W" ? <><div className="a-akw">{WK.map((w) => cell(it, w))}</div><div className={"a-akt" + (t.done ? " done" : "")}><b>{t.n} / {t.g}</b><span>{wksFor(it).length}주 합계</span></div></> : span(it)}
    </div>; };
  return <section aria-label="행동지표" className="a-rtsec">
    <h2 className="a-rth">행동지표 <span>KPI · 주기별 목표 횟수 · 기록은 팀 앱 오늘 '할 횟수' [+1] (버전1에서 한 것도 합쳐 보여요)</span></h2>
    {err && <div className="a-rterr" role="alert">버전1 행동지표를 읽지 못했어요 ({err})</div>}
    <div className="a-rtbar">
      <div className="a-rtseg"><Seg items={[["all", "전체"], ["core", "필수"], ["add", "추가"]]} value={kind} onChange={setKind} /></div>
      <div className="a-rtseg"><Seg items={[["all", "전체"], ["W", "주간"], ["M", "월간·분기"]]} value={cyc} onChange={setCyc} /></div>
      <div className="a-rtnav"><TBtn onClick={() => { setAnchor(new Date(y, m0 - 1, 1)); setSelKey(null); }}>‹</TBtn><b>{y}년 {m0 + 1}월</b><TBtn onClick={() => { setAnchor(new Date(y, m0 + 1, 1)); setSelKey(null); }}>›</TBtn>
        <TBtn onClick={() => { const t = new Date(); setAnchor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelKey(null); }}>이번 달</TBtn></div>
    </div>
    <div className="a-rtiles">{tile(`주간 · ${SEL ? SEL.label : ""} 주`, wd, Wi.length)}{tile(`월간 · ${m0 + 1}월`, mdn, Mi.length)}{tile(`분기 · ${y}년 ${q}분기`, qd, Qi.length)}</div>
    <div className="a-akweeks" role="group" aria-label="주 고르기">{WK.map((w) => <button key={w.key} type="button" aria-pressed={SEL.key === w.key} onClick={() => setSelKey(w.key)}>
      <b>{w.label}</b><span>{w.start <= today && today <= w.end ? "이번 주" : w.sub}</span><span>{wRatio(w)}</span></button>)}</div>
    {!ready || act.d === undefined ? <Card style={{ marginTop: 10 }}><Empty>버전1 행동지표를 불러오는 중…</Empty></Card>
    : list.length === 0 ? <Card style={{ marginTop: 10 }}><Empty>고른 조건에 맞는 행동지표가 없어요</Empty></Card>
    : groups.map((g) => { const gl = list.filter((it) => mkOf(it) === g.key); if (!gl.length) return null;
      return <div key={g.key || "none"} className="a-akgrp">
        <div className="a-akmk"><b>{g.m ? `${g.m.krKey ? g.m.krKey + " · " : ""}${g.m.title}` : "공통 · 주요 KPI 연결 없음"}</b><span>행동지표 {gl.length}개</span></div>
        {AK_FUNS.map((f) => { const fl = gl.filter((i) => (AK_FUNS.includes(i.fun) ? i.fun : "기타") === f); if (!fl.length) return null; const [gk, ...rest] = f.split(" ");
          return <div key={f} className="a-akfun"><div className="a-akfh"><span className="k">{gk === "기타" ? "·" : gk}</span><b>{rest.join(" ") || f}</b><small>{fl.length}개</small></div>
            {["W", "M", "Q"].map((c) => { const cl = fl.filter((i) => i.cyc === c); if (!cl.length) return null;
              return <div key={c} className="a-akcyc"><span className="cl">{AK_CYC[c]}</span><div className="rows">{cl.map(row)}</div></div>; })}</div>; })}
      </div>; })}
    <p className="a-hint">칸: ✓/숫자 = 그 주 한 횟수 / 목표 · 빨강 = 지난 주 미달 · 흐림 = 아직 안 온 주 · 월간·분기는 막대로 누적</p>
  </section>;
}
