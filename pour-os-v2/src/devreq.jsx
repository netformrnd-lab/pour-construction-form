// 업무OS v2 — 개발 수정 요청 포스트잇 (사용자 요청 2026-10-16 "업무os 개발 수정 요청하는곳 만들어줘. 관리자페이지에도. 아주 간단히 메모 포스트잇형식으로 텍스트 넣고 추가로 희망 시 빠른 전달을 위해 사진 캡처 복붙으로 바로 첨부 가능하게해줘")
//   들어오는 곳: 팀 앱 더보기 › '개발 수정 요청' · 관리자 머리 [수정 요청](넓은 화면) · 관리자 설정 시트 첫 줄
//   맨 위 노란 포스트잇: 글 + 캡처 붙여넣기(Ctrl+V · 글 칸 안·밖 어디서나) · [+ 사진] · [붙이기]
//   아래 포스트잇 판 [열린 것 n | 반영함 n] · 최근 것 먼저 · 사진 작게(누르면 크게) · 쓴 사람·언제·어느 화면 · 반영하면 '반영함 ✓' + 답 한 줄
//   [반영함]·[다시 열기] = 관리자 · [떼기] = 쓴 사람(그날 안)·관리자(지우지 않음 · removed) · 저장 core.devReqAdd·devReqSet · 개발(Claude)은 pour-os-v2/tools/devreqs.py 로 읽고 답
//   월 1회 자동 개발(2026-10-17 사장님 확정 5A~9A · devplan.js): 판 위 한 줄 = 이달 개발 일정(누르면 '이달 개발 목록') · [안 함] 칸 = 확인하는 사람이 안 하기로 한 것(까닭 · 관리자 [다시 열기])
//   DevPlanSheet = 이달 개발 목록: 포스트잇마다 [이번에·다음 달·안 함] + 한 줄 → [확인] (확인하는 사람 = 기본 김송희 · 관리자 · 월요일 09:00 ~ 금요일 · 주말 개발 전까지 다시 확인 가능)
import { useEffect, useMemo, useRef, useState } from "react";
import * as fb from "./fb.js";
import { C, Big, TBtn, Chip, Card, Empty, Sheet, Linked, Head, Row, Seg, inp } from "./ui.jsx";
import { ymd, md, hm, isMaster, addDays, nameOf, activeUsers } from "./model.js";
import { planNow, planWindow, planStage, planItems, planLine, canPick, canConfirm, devReviewer, devPlanDoc, carried, pickLeft, planCount, ymLabel, STAGE_L, DEV_PICKS, DEV_PICK_L, DEV_REVIEWER_DEFAULT, DEV_NOTE_MAX } from "./devplan.js";
import { NoteFiles, useUploads, UpList, pasteFiles, usePasteFiles, PASTE_HINT } from "./files.jsx";
import { viewOnlyOn } from "./viewonly.js";

const dayOf = (iso) => { const t = iso ? new Date(iso) : null; return t && !isNaN(t) ? ymd(t) : ""; };

export function DevReqSheet({ D, cu, A, open, onBack, onClose, app, tab0 }) {
  const [list, setList] = useState(null), [tab, setTab] = useState(tab0 === "done" || tab0 === "no" ? tab0 : "open"), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const U = useUploads(A, "devreq"), fileRef = useRef(null), boxRef = useRef(null), ro = !!viewOnlyOn();
  useEffect(() => { const since = addDays(ymd(new Date()), -120) + "T00:00:00";   // 넉 달 (오래된 것은 개발 쪽 도구로)
    return fb.listen("devreqs", ["at", ">=", since], (x) => setList(x), (e) => { console.error("[v2 devreqs] 읽기 실패:", e); setList([]); }); }, []);
  const take = (fs) => { const room = Math.max(0, 10 - U.rows.length); if (room && fs.length) U.add(fs.slice(0, room)); };
  usePasteFiles(boxRef, take, !ro);   // 글 칸 밖에서 붙여넣어도 이 포스트잇에
  const live = (list || []).filter((r) => r && r.id && !r.removed).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const opened = live.filter((r) => r.state !== "done" && r.state !== "no"), done = live.filter((r) => r.state === "done"), nos = live.filter((r) => r.state === "no"), shown = tab === "done" ? done : tab === "no" ? nos : opened;
  const w = planNow(), plan = D && D.dev ? D.dev.plans[w.ym] : null, st = planStage(w, plan), rvName = D ? nameOf(D.users, devReviewer(D)) : "";
  const master = isMaster(cu), today = ymd(new Date());
  const can = !ro && (text.trim() || U.rows.length) && !busy && !U.busy;
  const send = async () => { if (!can) return; setBusy(true);
    try { await U.flow(); const rows = U.cur(); if (rows.some((r) => r.st !== "ok")) return;
      const r = await A.devReqAdd({ text, files: rows.map((x) => x.meta), app }); if (r) { setText(""); U.clear(); setTab("open"); } }
    finally { setBusy(false); } };
  return <Sheet title="개발 수정 요청" kind="업무OS" head="개발 수정 요청" path="불편한 점 · 고칠 점을 포스트잇으로 붙여요" onBack={onBack} onClose={onClose}>
    {!ro && <div ref={boxRef} className="v2-dr-new" style={{ marginTop: 12 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} aria-label="수정 요청"
        placeholder={`어디가 · 어떻게 불편한지 한 줄이면 돼요${PASTE_HINT ? `\n${PASTE_HINT}` : ""}`}
        onPaste={(e) => { const f = pasteFiles(e); if (!f.length) return; if (!e.clipboardData.getData("text/plain")) e.preventDefault(); take(f); }} />
      <UpList U={U} onDrop={(k) => U.drop(k)} />
      <div className="v2-dr-row">
        <TBtn onClick={() => fileRef.current && fileRef.current.click()} disabled={busy || U.busy}>+ 사진</TBtn>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden aria-label="붙일 사진" onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; take(f); }} />
        <span className="v2-dr-hint">{PASTE_HINT ? "캡처 → Ctrl+V 면 바로 붙어요" : "캡처는 [+ 사진]으로"}</span>
        <TBtn v="solid" disabled={!can} onClick={send} style={{ minWidth: 72, height: 36 }}>{busy || U.busy ? "붙이는 중" : "붙이기"}</TBtn></div>
    </div>}
    {D && D.dev && open && <button type="button" className="v2-dp-line" onClick={() => open({ type: "devplan", ym: w.ym })} aria-label="이달 개발 목록 보기">
      <b>월 1회 개발</b> {planLine(w, plan, st, rvName)} <span>›</span></button>}
    <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }} role="group" aria-label="요청 보기">
      <Chip on={tab === "open"} onClick={() => setTab("open")}>열린 것 {opened.length}</Chip><Chip on={tab === "done"} onClick={() => setTab("done")}>반영함 {done.length}</Chip>{nos.length > 0 && <Chip on={tab === "no"} onClick={() => setTab("no")}>안 함 {nos.length}</Chip>}</div>
    {list === null ? <Card style={{ marginTop: 12 }}><Empty>불러오는 중…</Empty></Card>
    : !shown.length ? <Card style={{ marginTop: 12 }}><Empty>{tab === "done" ? "아직 반영한 것이 없어요" : tab === "no" ? "안 하기로 한 것이 없어요" : "열린 요청이 없어요 · 위 노란 칸에 붙여 주세요"}</Empty></Card>
    : <div className="v2-dr-list">{shown.map((r) => { const dn = r.state === "done", no = r.state === "no", rm = !ro && ((r.by === cu.id && dayOf(r.at) === today) || master);
      const inPlan = !dn && !no && plan && plan.state === "ok" && r.planYm === w.ym && r.planPick ? `${ymLabel(w.ym)} 개발 · ${DEV_PICK_L[r.planPick] || ""}` : "";
      return <div key={r.id} className={"v2-dr" + (dn ? " done" : no ? " no" : "")} role="article" aria-label={`포스트잇 · ${r.byName || ""}`}>
        <div className="tx"><Linked text={r.text || ""} /></div>
        <NoteFiles files={r.files} />
        <div className="mt"><span className="st">{dn ? "반영함 ✓" : no ? "안 함" : inPlan || "열림"}</span>{r.byName || ""} · {md(dayOf(r.at))} {hm(r.at)}{r.app === "admin" ? " · 관리자 화면" : ""}{dn && r.doneByName ? ` · ${r.doneByName} ${md(dayOf(r.doneAt))}` : ""}{no && r.noByName ? ` · ${r.noByName} ${md(dayOf(r.noAt))}` : ""}</div>
        {r.reply && <div className="rp">답 · {r.reply}</div>}
        {no && <div className="rp">까닭 · {r.noReason || "이번엔 안 하기로 했어요"}</div>}
        {(rm || (master && !ro)) && <div className="ac">{master && !ro && (dn || no ? <button type="button" onClick={() => A.devReqSet(r, "open")}>다시 열기</button> : <button type="button" onClick={() => A.devReqSet(r, "done")}>반영함</button>)}
          {rm && <button type="button" onClick={() => A.devReqSet(r, "remove")}>떼기</button>}</div>}
      </div>; })}</div>}
    <p style={{ fontSize: 12, color: C.mute, margin: "12px 2px 0", lineHeight: 1.6 }}>붙인 요청은 한 달에 한 번 모아서 개발해요 — 그 달 마지막 월요일에 목록이 서고 {rvName || DEV_REVIEWER_DEFAULT}님이 금요일까지 고르면 그 주 토·일에 개발(Claude)이 반영해요 · 반영하면 '반영함 ✓'과 답 한 줄이 붙고 쓴 사람 '확인할 것'에도 떠요 · 쓴 사람은 그날 안에 뗄 수 있어요</p>
  </Sheet>;
}

// ───────── 이달 개발 목록 (월 1회 자동 개발 · 2026-10-17 사장님 확정 5A~9A · devplan.js) ─────────
//   그 달 마지막 월요일 09:00 = 열린 포스트잇이 목록 → 확인하는 사람(기본 김송희)·관리자가 포스트잇마다 [이번에·다음 달·안 함] + 한 줄 → [확인] (금요일까지)
//   확인하면 그 주 토·일에 개발(Claude · 예약 작업)이 [이번에] 고른 것 중 작은 것(화면·버튼·문구·버그)을 반영 · 큰 것은 정리표로 사장님께 · 끝나면 요약이 여기와 '확인할 것'에
export function DevPlanSheet({ D, cu, A, open, onBack, onClose, ym }) {
  const w = ym ? planWindow(ym) : planNow(), plans = (D.dev && D.dev.plans) || {}, plan = plans[w.ym] || null, st = planStage(w, plan), ro = !!viewOnlyOn();
  const can = !ro && canConfirm(D, cu) && canPick(w, plan), rvName = nameOf(D.users, devReviewer(D)) || "관리자", carry = carried(plans, w.ym);
  const reqById = useMemo(() => Object.fromEntries(((D.dev && D.dev.reqs) || []).map((r) => [r.id, r])), [D.dev]);
  // 목록: 확인한 계획이 있으면 그 칸 + 그 뒤에 붙은 열린 것 · 없으면 지금 열린 포스트잇 (먼저 붙인 것 먼저)
  const items = useMemo(() => { const open0 = planItems(D.dev && D.dev.reqs), seen = new Set();
    const fromPlan = ((plan && plan.items) || []).map((x) => { seen.add(x.id); return { ...x, ...(reqById[x.id] || {}), id: x.id }; });
    return [...fromPlan, ...(st === "wait" || st === "review" || st === "late" || st === "ok" ? open0.filter((r) => !seen.has(r.id)) : [])]; }, [plan, D.dev, st]);
  const [picks, setPicks] = useState(() => Object.fromEntries(((plan && plan.items) || []).map((x) => [x.id, x.pick])));
  const [notes, setNotes] = useState(() => Object.fromEntries(((plan && plan.items) || []).map((x) => [x.id, x.note || ""])));
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState(!plan), touched = useRef(false);
  // 계획이 시트를 연 뒤에 들어오면(구독이 늦게 옴) 아직 아무것도 안 골랐을 때만 그 값으로
  useEffect(() => { if (!plan || touched.current) return; setPicks(Object.fromEntries((plan.items || []).map((x) => [x.id, x.pick]))); setNotes(Object.fromEntries((plan.items || []).map((x) => [x.id, x.note || ""]))); setEditing(false); }, [plan && plan.confirmedAt]);
  const left = pickLeft(items, picks), c = planCount(plan), dd = plan && plan.devDone;
  const others = Object.values(plans).filter((p) => p && p.ym && p.ym !== w.ym).sort((a, b) => String(b.ym).localeCompare(String(a.ym)));
  const red = st === "late" || st === "missed";
  const head = st === "wait" ? `${md(w.monday)}(월) 09:00에 목록이 서요 · 지금은 포스트잇만 붙여 두면 돼요`
    : st === "review" || st === "late" ? `${rvName}님이 ${md(w.due)}(금)까지 포스트잇마다 골라 [확인] → ${md(w.devDays[0])}~${md(w.devDays[1])} 주말 개발 · 확인이 없으면 이번 달은 쉬고 다음 달 목록에 그대로예요`
    : st === "ok" ? `확인함 · ${plan.confirmedByName || ""} ${md(String(plan.confirmedAt || "").slice(0, 10))} · 이번에 ${c.now}개를 ${md(w.devDays[0])}~${md(w.devDays[1])} 주말에 개발해요 · 금요일까지 다시 고칠 수 있어요`
    : st === "dev" ? `주말 개발 중 · 이번에 ${c.now}개 · 끝나면 포스트잇에 '반영함 ✓ · 답'이 붙어요`
    : st === "done" ? `개발 끝 · ${md(String(dd.at).slice(0, 10))} · 반영 ${(dd.done || []).length}개${(dd.later || []).length ? ` · 다음 달 ${(dd.later || []).length}개` : ""}`
    : st === "missed" ? "금요일까지 확인이 없어 이번 달 개발은 쉬어요 · 열린 포스트잇은 다음 달 목록에 그대로예요" : "개발 날이 지났어요";
  const confirm = async () => { setBusy(true); const ok = await A.devPlanConfirm(w.ym, items, picks, notes); setBusy(false); if (ok) setEditing(false); };
  const pickAll = () => { touched.current = true; setPicks((p) => ({ ...Object.fromEntries(items.map((r) => [r.id, "now"])), ...Object.fromEntries(Object.entries(p).filter(([, v]) => DEV_PICK_L[v])) })); };
  return <Sheet title="이달 개발 목록" kind="업무OS" head={`${ymLabel(w.ym)} 개발 목록`} path={`${md(w.monday)}(월) 목록 → ${md(w.due)}(금)까지 ${rvName}님 확인 → ${md(w.devDays[0])}~${md(w.devDays[1])} 주말 개발`} onBack={onBack} onClose={onClose}>
    <div className={"v2-dp-st" + (red ? " red" : st === "done" || st === "ok" ? " ok" : "")} role="status"><b>{STAGE_L[st]}</b> {head}</div>
    {dd && <Card style={{ marginTop: 10, padding: "12px 14px" }}><div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{dd.summary || "요약 없음"}</div>
      {(dd.later || []).length > 0 && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>다음 달로: {(dd.later || []).map((x) => `${String((reqById[x.id] || {}).text || x.id).slice(0, 24)}${x.why ? ` (${x.why})` : ""}`).join(" · ")}</div>}</Card>}
    {!items.length ? <Card style={{ marginTop: 12 }}><Empty>{st === "wait" ? "열린 포스트잇이 없어요" : "이번 달 목록에 든 포스트잇이 없어요"}</Empty></Card>
      : <>{can && editing && left > 0 && <div style={{ marginTop: 12 }}><TBtn onClick={pickAll}>남은 {left}개 모두 '이번에'</TBtn></div>}
        <div className="v2-dp-list">{items.map((r) => { const pk = picks[r.id], live = reqById[r.id] || r, gone = live.state === "done" ? "반영함 ✓" : live.state === "no" && pk !== "no" ? "안 함" : "";
          return <div key={r.id} className={"v2-dr" + (live.state === "done" ? " done" : "")} role="article" aria-label={`목록 포스트잇 · ${r.byName || ""}`}>
            <div className="tx"><Linked text={live.text || r.text || ""} /></div>
            <NoteFiles files={live.files} />
            <div className="mt">{r.byName || ""} · {md(dayOf(r.at))}{carry[r.id] ? ` · ${carry[r.id]}` : ""}{gone ? ` · ${gone}` : ""}</div>
            {live.reply && <div className="rp">답 · {live.reply}</div>}
            {can && editing ? <>
              <div style={{ marginTop: 8 }}><Seg items={DEV_PICKS} value={pk || ""} onChange={(v) => { touched.current = true; setPicks((p) => ({ ...p, [r.id]: v })); }} /></div>
              <input value={notes[r.id] || ""} onChange={(e) => { touched.current = true; setNotes((n) => ({ ...n, [r.id]: e.target.value })); }} maxLength={DEV_NOTE_MAX} aria-label="한 줄" placeholder={pk === "no" ? "까닭 한 줄 (요청한 사람에게 보여요)" : "한 줄 (선택 · 개발에게 전할 말)"} style={{ ...inp, marginTop: 6, padding: "8px 10px", fontSize: 16, background: "rgba(255,255,255,.8)" }} /></>
              : pk && <div className="rp"><b>{DEV_PICK_L[pk]}</b>{r.note ? ` · ${r.note}` : ""}</div>}
          </div>; })}</div>
        {can && (editing ? <div style={{ position: "sticky", bottom: 0, background: C.bg, padding: "10px 0 4px", marginTop: 6 }}>
            <Big onClick={confirm} disabled={busy || left > 0} style={{ width: "100%" }}>{busy ? "저장 중" : left ? `${left}개 더 골라 주세요` : plan ? "다시 확인" : "확인"}</Big></div>
          : <div style={{ marginTop: 10 }}><TBtn onClick={() => setEditing(true)}>다시 고르기</TBtn></div>)}</>}
    {!can && (st === "review" || st === "late") && <p style={{ fontSize: 12.5, color: C.sub, margin: "10px 2px 0", lineHeight: 1.6 }}>고르기는 {rvName}님·관리자가 해요 · 의견은 포스트잇을 하나 더 붙여 남겨 주세요</p>}
    {others.length > 0 && <><Head>지난 개발</Head><Card>{others.slice(0, 6).map((p, i) => { const cc = planCount(p), d2 = p.devDone;
      return <Row key={p.ym} title={`${ymLabel(p.ym)} · ${d2 ? `반영 ${(d2.done || []).length}개` : STAGE_L[planStage(planWindow(p.ym), p)]}`} sub={`이번에 ${cc.now} · 다음 달 ${cc.later} · 안 함 ${cc.no}${p.confirmedByName ? ` · ${p.confirmedByName} 확인` : ""}`} onClick={() => open({ type: "devplan", ym: p.ym })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} last={i === Math.min(others.length, 6) - 1} />; })}</Card></>}
    <p style={{ fontSize: 12, color: C.mute, margin: "12px 2px 0", lineHeight: 1.6 }}>주말 개발 = [이번에] 고른 것 중 화면·버튼·문구·버그 · 흐름을 바꾸는 큰 것은 정리표로 사장님께 먼저 물어요 · 로그인·보안 규칙·실데이터 한꺼번에 바꾸기는 주말 자동으로 하지 않아요 · 시험을 통과한 것만 올려요</p>
  </Sheet>;
}

// 관리자 설정: 이달 개발 목록 확인하는 사람 (settings/devplan.reviewerId · 비우면 기본 김송희 → 없으면 관리자 누구나)
export function DevReviewerPick({ D, A }) {
  const cur = devPlanDoc(D).reviewerId || "", who = devReviewer(D), us = activeUsers(D.users);
  return <><Head>이달 개발 목록 확인</Head>
    <Card><div style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>그 달 마지막 월요일에 목록이 서면 '확인할 것'에 뜨고 금요일까지 고르는 사람 · 지금 <b>{nameOf(D.users, who) || "관리자 누구나"}</b>{cur ? "" : " (기본)"}</div>
      <select value={cur} onChange={(e) => A.devReviewerSet(e.target.value)} style={{ ...inp, fontSize: 16, marginTop: 8, width: "100%", maxWidth: 360 }} aria-label="이달 개발 목록 확인하는 사람">
        <option value="">기본 ({DEV_REVIEWER_DEFAULT} · 없으면 관리자 누구나)</option>
        {us.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select></div></Card></>;
}
