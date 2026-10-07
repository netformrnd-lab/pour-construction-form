// 업무OS v2 — 찾기 시트 (사용자 요청 2026-10-07 · 계산 search.js · 쓰기 없음)
//  팀 앱 오늘 머리 [찾기] · 관리자 머리 [찾기] → 이 시트 (sheets 'search')
//  찾는 말 하나 → 업무 · 프로젝트 · 댓글 · 반복 실행 묶음 (묶음마다 30개 + 'n개 더 ▾') · [전체 | 업무 | 프로젝트 | 댓글] + [내 것만]
//  누르면 그 시트 (댓글 = 그 대화 칸 + 그 댓글 테두리 · 댓글 링크와 같은 길) · 최근 찾은 말 = 기기 저장 pour-os2-search
//  '더 오래된 것도 찾기' = 같음 조건만 한 번 읽기(끝낸 업무 · 중단한 업무 · 댓글) → 이 앱을 닫을 때까지 기억
import { useEffect, useMemo, useState } from "react";
import * as fb from "./fb.js";
import { ymd } from "./model.js";
import { searchAll, mergeOlder, marks, addRecent, OLDER_STEPS } from "./search.js";
import { C, TBtn, Chip, Head, Card, Empty, More, Sheet, useLocal, useAutoFocus } from "./ui.jsx";
import { LS } from "./core.jsx";

const PAGE = 30;
const GROUPS = [["task", "업무"], ["proj", "프로젝트"], ["note", "댓글"], ["rt", "반복 실행"]];
// 이 앱을 연 동안 기억하는 '더 오래된 것' (시트를 닫았다 열어도 다시 안 읽음)
let OLDER = null, PART = null;   // PART = 읽는 중 (실패하면 그 단계부터 다시)

// 맞은 곳 굵게
function M({ text, q }) { return <>{marks(text, q).map((x, i) => (x.b ? <b key={i} className="hit">{x.t}</b> : <span key={i}>{x.t}</span>))}</>; }

export function SearchSheet({ D, cu, open, onBack, onClose, save, s = {} }) {
  const [text, setText] = useState(s.q || ""), [q, setQ] = useState(s.q || "");
  const [f, setF] = useState(s.f || "all"), [mine, setMine] = useState(!!s.mine);
  const [more, setMore] = useState({});
  const [recent, setRecent] = useLocal(LS("search"), []);
  const [older, setOlder] = useState(OLDER), [ld, setLd] = useState(null);   // ld = {i, err}
  const ref = useAutoFocus();
  useEffect(() => { const t = setTimeout(() => { setQ(text); setMore({}); }, 200); return () => clearTimeout(t); }, [text]);
  const DD = useMemo(() => mergeOlder(D, older), [D, older]);
  const R = useMemo(() => searchAll(DD, q, { cu, uid: cu.id, mine, today: ymd(new Date()) }), [DD, q, mine, cu]);
  const n = { task: R.task.length, proj: R.proj.length, note: R.note.length, rt: R.rt.length };
  const total = n.task + n.proj + n.note + n.rt;
  // 바로 기기에 씀 (결과를 누르면 이 시트가 바로 닫혀서 state 갱신만으로는 안 남음)
  const remember = () => { if (!R.q) return; const nx = addRecent(Array.isArray(recent) ? recent : [], text); try { localStorage.setItem(LS("search"), JSON.stringify(nx)); } catch (e) { /* 저장 막힘 → 이번만 */ } setRecent(nx); };
  const go = (x) => { remember(); save({ q: text, f, mine }); open(x.go); };
  // 단계마다 하나씩 · 실패하면 그 단계부터 [다시] (앞에서 읽은 것은 다시 안 읽음)
  const loadOlder = async () => {
    const got = PART || (PART = { tasks: [], notes: [], i: 0 });
    for (let i = got.i; i < OLDER_STEPS.length; i++) { const st = OLDER_STEPS[i]; setLd({ i, err: false });
      try { got[st.key].push(...(await fb.fetchWhere(st.key, st.w))); got.i = i + 1; }
      catch (e) { console.error("[v2 찾기] 더 오래된 것 못 읽음:", st.label, e); setLd({ i, err: true }); return; } }
    OLDER = { tasks: got.tasks, notes: got.notes, at: new Date().toISOString() }; PART = null; setOlder(OLDER); setLd(null);
  };
  const shown = GROUPS.filter(([k]) => f === "all" || f === k);
  const WHY = { task: ["담당 이름", "프로젝트 이름"], proj: ["책임자 이름", "브랜드"], note: ["쓴 사람 이름", "업무·프로젝트 이름"], fx: ["담당 이름", "브랜드"], ak: ["담당 이름", "브랜드"] };
  const fieldNote = (x) => (x.field === "who" ? WHY[x.kind][0] : x.field === "where" ? WHY[x.kind][1] : "");
  const row = (x) => <button key={x.key} type="button" className="v2-srow" onClick={() => go(x)}>
    <span className="tx">
      <span className="t1">{x.tag && <span className="tag">{x.tag}</span>}{x.kind === "note" && x.reply && <span className="rp">답글 · </span>}<span className="tt"><M text={x.title} q={R.q} /></span></span>
      {x.snip && <span className="sn">메모 · <M text={x.snip} q={R.q} /></span>}
      <span className="t2">{[x.where && <M key="w" text={x.where} q={R.q} />, x.who && <M key="o" text={x.who} q={R.q} />].filter(Boolean).reduce((a, b, i) => (i ? [...a, " · ", b] : [b]), [])}</span>
      {(x.stat || x.date || fieldNote(x)) && <span className="t3">{x.stat}{x.stat && x.date ? " · " : ""}{x.date && <span className={x.red ? "red" : ""}>{x.date}</span>}{fieldNote(x) && <span className="why">{x.stat || x.date ? " · " : ""}{fieldNote(x)}에서 찾음</span>}</span>}
    </span><span className="go">›</span></button>;
  return <Sheet title="찾기" onBack={onBack} onClose={onClose}>
    <div className="v2-sbox">
      <div className="in"><input ref={ref} type="search" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setQ(text); remember(); e.currentTarget.blur(); } }}
        placeholder="업무 · 프로젝트 · 댓글 · 사람 이름" aria-label="찾는 말" enterKeyHint="search" autoComplete="off" />
        {text && <button type="button" className="x" aria-label="지우기" onClick={() => { setText(""); setQ(""); ref.current && ref.current.focus(); }}>✕</button>}</div>
      {R.q && <div className="v2-filterrow" role="group" aria-label="찾을 곳" style={{ marginTop: 8 }}><div className="v2-chips">
        <Chip on={f === "all"} onClick={() => setF("all")}>전체 {total}</Chip>
        {GROUPS.slice(0, 3).map(([k, l]) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{l} {n[k]}</Chip>)}
        <span className="sep" /><Chip on={mine} onClick={() => setMine(!mine)}>{mine ? "✓ " : ""}내 것만</Chip></div></div>}
    </div>
    {!R.q && <>
      {recent && recent.length > 0 ? <>
        <Head right={<TBtn tone="mute" onClick={() => setRecent([])}>모두 지우기</TBtn>}>최근 찾은 말</Head>
        <Card>{recent.map((r, i) => <div key={r} className="v2-srec" style={{ borderBottom: i === recent.length - 1 ? "none" : undefined }}>
          <button type="button" className="w" onClick={() => { setText(r); setQ(r); }}>{r}</button>
          <button type="button" className="x" aria-label={`${r} 지우기`} onClick={() => setRecent((l) => (l || []).filter((y) => y !== r))}>✕</button></div>)}</Card></>
        : <Card style={{ marginTop: 12 }}><Empty>업무 · 프로젝트 · 댓글 · 반복 실행을 한 번에 찾아요. 담당 이름·프로젝트 이름으로도 찾아요.</Empty></Card>}
    </>}
    {R.q && <>
      {total === 0 && <Card style={{ marginTop: 12 }}><Empty>{mine ? "내 것 중에 " : ""}찾은 게 없어요 · '{text.trim()}'{older ? "" : " · 30일보다 이전 것은 아래 [더 오래된 것도 찾기]"}</Empty></Card>}
      {shown.map(([k, l]) => { const a = R[k], lim = PAGE + (more[k] || 0); if (!a.length) return null;
        return <section key={k} aria-label={l}><Head>{l} {a.length}</Head>
          <Card>{a.slice(0, lim).map(row)}{a.length > lim && <More onClick={() => setMore((m) => ({ ...m, [k]: (m[k] || 0) + PAGE }))}>{`${a.length - lim}개 더 ▾`}</More>}</Card></section>; })}
      <div className="v2-solder">{older ? <span>30일보다 이전 것도 같이 찾았어요 · 끝낸 업무·댓글 {((older.tasks || []).length + (older.notes || []).length).toLocaleString()}건 불러옴</span>
        : ld ? (ld.err ? <><span style={{ color: C.red }}>못 불러왔어요 · {OLDER_STEPS[ld.i].label}</span><TBtn onClick={loadOlder}>다시</TBtn></>
          : <span role="status">{OLDER_STEPS[ld.i].label} 불러오는 중 · {ld.i + 1}/{OLDER_STEPS.length}</span>)
        : <><span>열린 업무 · 최근 30일 끝낸 업무 · 최근 30일 댓글 · 프로젝트 · 반복 실행에서 찾았어요</span><TBtn onClick={loadOlder}>더 오래된 것도 찾기</TBtn></>}</div>
    </>}
  </Sheet>;
}
