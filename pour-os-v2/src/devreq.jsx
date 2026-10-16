// 업무OS v2 — 개발 수정 요청 포스트잇 (사용자 요청 2026-10-16 "업무os 개발 수정 요청하는곳 만들어줘. 관리자페이지에도. 아주 간단히 메모 포스트잇형식으로 텍스트 넣고 추가로 희망 시 빠른 전달을 위해 사진 캡처 복붙으로 바로 첨부 가능하게해줘")
//   들어오는 곳: 팀 앱 더보기 › '개발 수정 요청' · 관리자 머리 [수정 요청](넓은 화면) · 관리자 설정 시트 첫 줄
//   맨 위 노란 포스트잇: 글 + 캡처 붙여넣기(Ctrl+V · 글 칸 안·밖 어디서나) · [+ 사진] · [붙이기]
//   아래 포스트잇 판 [열린 것 n | 반영함 n] · 최근 것 먼저 · 사진 작게(누르면 크게) · 쓴 사람·언제·어느 화면 · 반영하면 '반영함 ✓' + 답 한 줄
//   [반영함]·[다시 열기] = 관리자 · [떼기] = 쓴 사람(그날 안)·관리자(지우지 않음 · removed) · 저장 core.devReqAdd·devReqSet · 개발(Claude)은 pour-os-v2/tools/devreqs.py 로 읽고 답
import { useEffect, useRef, useState } from "react";
import * as fb from "./fb.js";
import { C, TBtn, Chip, Card, Empty, Sheet, Linked } from "./ui.jsx";
import { ymd, md, hm, isMaster, addDays } from "./model.js";
import { NoteFiles, useUploads, UpList, pasteFiles, usePasteFiles, PASTE_HINT } from "./files.jsx";
import { viewOnlyOn } from "./viewonly.js";

const dayOf = (iso) => { const t = iso ? new Date(iso) : null; return t && !isNaN(t) ? ymd(t) : ""; };

export function DevReqSheet({ cu, A, onBack, onClose, app }) {
  const [list, setList] = useState(null), [tab, setTab] = useState("open"), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const U = useUploads(A, "devreq"), fileRef = useRef(null), boxRef = useRef(null), ro = !!viewOnlyOn();
  useEffect(() => { const since = addDays(ymd(new Date()), -120) + "T00:00:00";   // 넉 달 (오래된 것은 개발 쪽 도구로)
    return fb.listen("devreqs", ["at", ">=", since], (x) => setList(x), (e) => { console.error("[v2 devreqs] 읽기 실패:", e); setList([]); }); }, []);
  const take = (fs) => { const room = Math.max(0, 10 - U.rows.length); if (room && fs.length) U.add(fs.slice(0, room)); };
  usePasteFiles(boxRef, take, !ro);   // 글 칸 밖에서 붙여넣어도 이 포스트잇에
  const live = (list || []).filter((r) => r && r.id && !r.removed).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const opened = live.filter((r) => r.state !== "done"), done = live.filter((r) => r.state === "done"), shown = tab === "done" ? done : opened;
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
    <div style={{ display: "flex", gap: 6, marginTop: 14 }} role="group" aria-label="요청 보기">
      <Chip on={tab === "open"} onClick={() => setTab("open")}>열린 것 {opened.length}</Chip><Chip on={tab === "done"} onClick={() => setTab("done")}>반영함 {done.length}</Chip></div>
    {list === null ? <Card style={{ marginTop: 12 }}><Empty>불러오는 중…</Empty></Card>
    : !shown.length ? <Card style={{ marginTop: 12 }}><Empty>{tab === "done" ? "아직 반영한 것이 없어요" : "열린 요청이 없어요 · 위 노란 칸에 붙여 주세요"}</Empty></Card>
    : <div className="v2-dr-list">{shown.map((r) => { const dn = r.state === "done", rm = !ro && ((r.by === cu.id && dayOf(r.at) === today) || master);
      return <div key={r.id} className={"v2-dr" + (dn ? " done" : "")} role="article" aria-label={`포스트잇 · ${r.byName || ""}`}>
        <div className="tx"><Linked text={r.text || ""} /></div>
        <NoteFiles files={r.files} />
        <div className="mt"><span className="st">{dn ? "반영함 ✓" : "열림"}</span>{r.byName || ""} · {md(dayOf(r.at))} {hm(r.at)}{r.app === "admin" ? " · 관리자 화면" : ""}{dn && r.doneByName ? ` · ${r.doneByName} ${md(dayOf(r.doneAt))}` : ""}</div>
        {r.reply && <div className="rp">답 · {r.reply}</div>}
        {(rm || (master && !ro)) && <div className="ac">{master && !ro && (dn ? <button type="button" onClick={() => A.devReqSet(r, "open")}>다시 열기</button> : <button type="button" onClick={() => A.devReqSet(r, "done")}>반영함</button>)}
          {rm && <button type="button" onClick={() => A.devReqSet(r, "remove")}>떼기</button>}</div>}
      </div>; })}</div>}
    <p style={{ fontSize: 12, color: C.mute, margin: "12px 2px 0", lineHeight: 1.6 }}>붙인 요청은 개발(Claude)이 보고 반영해요 · 반영하면 '반영함 ✓'과 답 한 줄이 붙어요 · 쓴 사람은 그날 안에 뗄 수 있어요</p>
  </Sheet>;
}
