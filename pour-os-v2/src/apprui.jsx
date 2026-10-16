// 업무OS v2 — 구매 품의 요청 화면 (사용자 결정 2026-10-16 · 계산 appr.js · 두 앱 같은 시트 · sheets.jsx 'appr' · 'apprOne')
//   요청자(윤미니 등 하이웍스 못 쓰는 사람): 더보기 › 내 일 › 품의 요청 → [품의 요청 쓰기] 이 화면 안에서 · 요청자 = 나 · 담당 기본 김송희 · 내 요청 상태(품의 전/완료 · 누가 · 메모)
//   담당(김송희): '확인할 것' 품의 요청 n건 → 내가 맡은 것 → 한 건 열기 → 제목·본문 [복사] → 하이웍스에 옮겨 적고 [품의 완료](메모 선택)
//   저장 = pour-os/approval-requests/items (독립 화면 approval-requests.html 과 같은 문서) · 보기 모드는 쓰기 버튼을 숨김(저장 장치도 막음)
import { useMemo, useState } from "react";
import * as fb from "./fb.js";
import { C, Big, TBtn, Chip, Seg, Head, Card, Row, Empty, More, Sheet, Ask, inp } from "./ui.jsx";
import { isMaster, activeUsers, md, hm, ymd } from "./model.js";
import { isViewOnlyErr } from "./viewonly.js";
import { viewBlockText } from "./viewas.js";
import {
  APPR_TOPICS, APPR_DOC_TYPES, APPR_BODY_TEMPLATE, APPR_DEFAULT_ASSIGNEE, APPR_URL, apprDone, apprAssignee, apprLists, apprAssigneeNames, apprByAssignee, apprMerge,
  apprNewDoc, apprMissing, apprDonePatch, apprUndonePatch, apprAssignPatch, canApprDone, canApprEdit, canApprAssign, isApprMine, userIdByName,
} from "./appr.js";

const when = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; return `${ymd(d) === ymd(new Date()) ? "오늘" : md(ymd(d))} ${hm(iso)}`; };
const label = { fontSize: 13, fontWeight: 800, color: C.ink, margin: "14px 0 6px", display: "flex", alignItems: "center", gap: 8 };
const box = { border: `1px solid ${C.line}`, borderRadius: 12, marginTop: 10, background: "#fff", overflow: "hidden" };
const boxHd = { display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: C.soft, fontSize: 12.5, fontWeight: 800, color: C.sub };
const boxBd = { padding: "10px 12px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, color: C.text, lineHeight: 1.6 };

// 저장 (fb 직접 · 실패하면 알림 · 보기 모드는 저장 장치가 막음)
function useApprSave(cu, setToast) {
  const fail = (e) => { console.error("[품의 요청] 저장 실패:", e); setToast({ text: isViewOnlyErr(e) ? viewBlockText(cu.name) : "저장 실패 · 인터넷 연결을 확인하고 다시 눌러 주세요" }); return false; };
  const run = async (fn, okText, clashText) => { try { const r = await fn(); if (r && r.ok === false) { setToast({ text: clashText || "그사이 다른 사람이 바꿨어요 · 화면을 다시 보고 눌러 주세요" }); return false; } if (okText) setToast({ text: okText }); return true; } catch (e) { return fail(e); } };
  return {
    add: (data) => run(() => fb.addAppr(data), `요청을 올렸어요 · ${data.assignee}님 '확인할 것'에 떠요`),
    done: (r, memo) => run(() => fb.patchApprIf(r.id, { status: "품의전" }, apprDonePatch(cu, memo)), "품의 완료로 옮겼어요 · 요청자에게 알림이 가요", "그사이 다른 사람이 품의 완료로 바꿨어요"),
    undo: (r) => run(() => fb.patchApprIf(r.id, { status: "품의완료" }, apprUndonePatch()), "품의 전으로 되돌렸어요"),
    assign: (r, u) => run(() => fb.patchApprIf(r.id, { status: "품의전" }, apprAssignPatch(u)), `담당을 ${u.name}님으로 바꿨어요`),
    edit: (r, f) => run(() => fb.patchApprIf(r.id, { updatedAt: r.updatedAt || null }, { topic: f.topic, docType: f.docType, title: String(f.title).trim(), body: String(f.body).replace(/\s+$/, ""), updatedAt: new Date().toISOString() }), "고쳤어요", "그사이 다른 사람이 고쳤어요 · 다시 열어 주세요"),
    remove: (r) => { const at = new Date().toISOString(); return run(() => fb.patchApprIf(r.id, {}, { deleted: true, deletedAt: at, updatedAt: at }), "요청을 지웠어요"); },
  };
}

// 쓰기·고치기 칸 (요청자 = 로그인한 사람 · 담당 기본 김송희)
function ApprForm({ D, cu, init, onSave, onCancel, saveL = "요청 올리기" }) {
  const users = activeUsers(D.users);
  const [f, setF] = useState(() => ({ topic: "", docType: "", title: "", body: "", assignee: APPR_DEFAULT_ASSIGNEE, ...(init || {}) }));
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr(""); };
  const names = [...new Set([APPR_DEFAULT_ASSIGNEE, ...users.map((u) => u.name)])];
  const save = async () => { const miss = apprMissing(f); if (miss.length) { setErr(`${miss.join(", ")}을(를) 채워 주세요`); return; }
    setBusy(true); const ok = await onSave(f); setBusy(false); if (!ok) setErr("저장하지 못했어요 · 다시 눌러 주세요"); };
  return <div className="v2-apprform">
    {!init && <div style={{ fontSize: 13, color: C.sub, marginTop: 10 }}>요청자 <b style={{ color: C.ink }}>{cu.name}</b> (나)</div>}
    <div style={label}>주제</div>
    <div className="v2-chips">{APPR_TOPICS.map((t) => <Chip key={t} on={f.topic === t} onClick={() => set("topic", t)}>{t}</Chip>)}</div>
    <div style={label}>문서 종류 <span style={{ fontWeight: 600, fontSize: 12, color: C.mute }}>결제 방법으로 골라요</span></div>
    <div className="v2-endk" role="radiogroup" aria-label="문서 종류" style={{ marginTop: 0 }}>{APPR_DOC_TYPES.map((d) => <button key={d.v} type="button" role="radio" aria-checked={f.docType === d.v} className={"v2-endc" + (f.docType === d.v ? " on" : "")} onClick={() => set("docType", d.v)}><b>{d.v}</b><small>{d.pay}</small></button>)}</div>
    <div style={label}>제목</div>
    <input aria-label="제목" value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="예: 포장 테이프 10박스 구매" style={inp} />
    <div style={label}>본문<span style={{ flex: 1 }} /><TBtn onClick={() => set("body", f.body.trim() ? f.body.replace(/\s*$/, "") + "\n\n" + APPR_BODY_TEMPLATE : APPR_BODY_TEMPLATE)}>양식 넣기</TBtn></div>
    <textarea aria-label="본문" value={f.body} rows={8} onChange={(e) => set("body", e.target.value)} placeholder={"무엇을, 얼마나, 왜 사야 하는지 적어요\n[양식 넣기]를 누르면 칸이 채워져요"} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
    {!init && <><div style={label}>담당 <span style={{ fontWeight: 600, fontSize: 12, color: C.mute }}>하이웍스에 대신 올릴 사람</span></div>
      <select aria-label="담당" className="v2-sel" value={f.assignee} onChange={(e) => set("assignee", e.target.value)} style={{ width: "100%" }}>{names.map((n) => <option key={n} value={n}>{n}{n === APPR_DEFAULT_ASSIGNEE ? " (기본)" : ""}</option>)}</select></>}
    {err && <div role="alert" style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{err}</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}><Big tone="white" onClick={onCancel} style={{ flex: 1 }}>취소</Big><Big disabled={busy} onClick={save} style={{ flex: 2 }}>{busy ? "올리는 중…" : saveL}</Big></div>
  </div>;
}

// 목록 한 줄
function ApprRow({ r, open, showReq, last }) {
  const done = apprDone(r);
  return <Row tag={done ? "품의 완료" : "품의 전"} tagTone={done ? null : "turn"} dim={false} title={r.title || "(제목 없음)"} last={last}
    sub={[r.docType, r.topic, showReq ? `요청 ${r.requester || "?"}` : "", `담당 ${apprAssignee(r)}`, when(r.createdAt)].filter(Boolean).join(" · ")}
    sub2={done ? `${r.doneBy || "?"} 품의 완료 · ${when(r.doneAt)}${r.doneMemo ? ` · 메모 ${r.doneMemo}` : ""}` : null}
    onClick={() => open({ type: "apprOne", id: r.id, item: r })} right={<span style={{ color: C.navy, fontWeight: 800 }}>›</span>} />;
}

// 품의 요청 (더보기 › 내 일 · '확인할 것' 품의 요청 n건)
export function ApprSheet({ D, cu, open, setToast, view, onBack, onClose, s = {} }) {
  const ro = !!(view && view.by), master = isMaster(cu), users = D.users || [];
  const list = (D.appr && D.appr.list) || [], ready = !D.appr || D.appr.ready;
  const L = useMemo(() => apprLists(list, users, cu.id), [list, users, cu.id]);
  const hasAsg = L.wait.length + L.doneByMe.length > 0;
  const tabs = [["mine", `내 요청 ${L.mine.length}`], ...(hasAsg || master ? [["asg", `내가 맡은 것 ${L.wait.length}`]] : []), ...(master ? [["all", "모두"]] : [])];
  const [tab, setTab] = useState(() => (s.tab && tabs.some(([k]) => k === s.tab) ? s.tab : L.wait.length ? "asg" : "mine"));
  const [writing, setWriting] = useState(!!s.write), [who, setWho] = useState(""), [older, setOlder] = useState(null), [doneOpen, setDoneOpen] = useState(false);
  const save = useApprSave(cu, setToast);
  const loadOlder = async () => { try { const a = await fb.fetchAppr(["requester", "==", cu.name]); setOlder(apprMerge(a).filter((r) => isApprMine(r, users, cu.id))); }
    catch (e) { console.error("[품의 요청] 지난 요청 읽기 실패:", e); setToast({ text: "지난 요청을 못 읽었어요 · 다시 눌러 주세요" }); } };
  const mineAll = older ? apprMerge(L.mine, older) : L.mine;
  const allList = apprByAssignee(list, who);
  return <Sheet title="구매 품의 요청" onBack={onBack} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, margin: "12px 2px 4px", lineHeight: 1.6 }}>하이웍스 품의를 담당이 대신 올려요 · 요청을 남기면 담당(기본 {APPR_DEFAULT_ASSIGNEE}) '확인할 것'에 뜨고, 품의 완료되면 나에게 알림이 와요</div>
    {tabs.length > 1 && <div style={{ marginTop: 10 }}><Seg items={tabs} value={tab} onChange={(k) => { setTab(k); setWriting(false); }} /></div>}
    {!ready && <Card style={{ marginTop: 12 }}><Empty>불러오는 중…</Empty></Card>}
    {ready && tab === "mine" && <>
      {!ro && (writing ? <Card style={{ marginTop: 12, padding: "2px 14px 14px" }}><ApprForm D={D} cu={cu} onCancel={() => setWriting(false)}
          onSave={async (f) => { const ok = await save.add(apprNewDoc({ ...f, assigneeId: userIdByName(users, f.assignee) }, cu, users)); if (ok) setWriting(false); return ok; }} /></Card>
        : <div style={{ marginTop: 12 }}><Big onClick={() => setWriting(true)}>＋ 품의 요청 쓰기</Big></div>)}
      <Head>내 요청 {L.mineWait ? <span style={{ color: C.sub, fontWeight: 700 }}>· 품의 전 {L.mineWait}</span> : null}</Head>
      <Card>{mineAll.length ? mineAll.map((r, i) => <ApprRow key={r.id} r={r} open={open} last={i === mineAll.length - 1 && !!older} />) : <Empty>아직 올린 요청이 없어요</Empty>}
        {!older && <More onClick={loadOlder}>30일 넘은 요청도 보기 ▾</More>}</Card>
    </>}
    {ready && tab === "asg" && <>
      <Head>품의 전 {L.wait.length} <span style={{ color: C.sub, fontWeight: 700 }}>· 오래된 것부터</span></Head>
      <Card>{L.wait.length ? L.wait.map((r, i) => <ApprRow key={r.id} r={r} open={open} showReq last={i === L.wait.length - 1} />) : <Empty>품의 전 요청이 없어요 · 모두 품의 완료</Empty>}</Card>
      {L.wait.length > 0 && <div style={{ fontSize: 12.5, color: C.sub, margin: "8px 2px 0" }}>열어서 제목·본문을 [복사] → 하이웍스에 붙여 넣고 → [품의 완료]</div>}
      {L.doneByMe.length > 0 && <Card style={{ marginTop: 12 }}><More onClick={() => setDoneOpen(!doneOpen)}>{doneOpen ? "끝낸 것 접기 ▴" : `최근 끝낸 것 ${L.doneByMe.length} ▾`}</More>
        {doneOpen && L.doneByMe.map((r, i) => <ApprRow key={r.id} r={r} open={open} showReq last={i === L.doneByMe.length - 1} />)}</Card>}
    </>}
    {ready && tab === "all" && <>
      <div style={label}>담당으로 거르기</div>
      <div className="v2-chips"><Chip on={!who} onClick={() => setWho("")}>전체 {list.length}</Chip>{apprAssigneeNames(list).map((n) => <Chip key={n} on={who === n} onClick={() => setWho(n)}>{n} {apprByAssignee(list, n).length}</Chip>)}</div>
      <Card style={{ marginTop: 12 }}>{allList.length ? allList.map((r, i) => <ApprRow key={r.id} r={r} open={open} showReq last={i === allList.length - 1} />) : <Empty>요청이 없어요</Empty>}</Card>
      <div style={{ fontSize: 12.5, color: C.sub, margin: "8px 2px 0" }}>품의 전 전부 + 최근 30일 · 더 지난 것은 요청함 전체 화면에서</div>
    </>}
    <div style={{ marginTop: 16 }}><a href={APPR_URL} target="_blank" rel="noopener" style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>요청함 전체 화면 ›</a></div>
  </Sheet>;
}

// 요청 한 건 — 제목·본문 [복사] · [품의 완료](메모 선택) · 담당 바꾸기 · 고치기·지우기
export function ApprOneSheet({ D, cu, setToast, view, onBack, onClose, id, item }) {
  const ro = !!(view && view.by), master = isMaster(cu), users = D.users || [];
  const live = ((D.appr && D.appr.list) || []).find((x) => x.id === id), r = live || item || null;
  const [memo, setMemo] = useState(""), [edit, setEdit] = useState(false), [ask, setAsk] = useState(""), [busy, setBusy] = useState(false);
  const save = useApprSave(cu, setToast);
  if (!r || r.deleted) return <Sheet title="품의 요청" kind="품의 요청" onBack={onBack} onClose={onClose}><Empty>{r && r.deleted ? "지운 요청이에요" : "요청을 찾지 못했어요 · 지웠거나 30일이 지났어요"}</Empty></Sheet>;
  const done = apprDone(r), canDone = !ro && canApprDone(r, users, cu, master), canEdit = !ro && canApprEdit(r, users, cu, master), canAsg = !ro && canApprAssign(r, users, cu, master);
  const copy = async (k) => { const text = String(r[k] || ""); try { await navigator.clipboard.writeText(text); setToast({ text: `${k === "title" ? "제목" : "본문"} 복사했어요` }); }
    catch (e) { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); if (!ok) throw e; setToast({ text: `${k === "title" ? "제목" : "본문"} 복사했어요` }); }
      catch (e2) { console.error("[품의 요청] 복사 실패:", e2); setToast({ text: "복사 실패 · 글을 길게 눌러 직접 복사해 주세요" }); } } };
  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };
  const asgUsers = activeUsers(users);
  return <Sheet title={r.title || "품의 요청"} kind="품의 요청" onBack={onBack} onClose={onClose}>
    {edit ? <Card style={{ marginTop: 12, padding: "2px 14px 14px" }}><ApprForm D={D} cu={cu} init={{ topic: r.topic, docType: r.docType, title: r.title, body: r.body }} saveL="고친 내용 저장" onCancel={() => setEdit(false)}
        onSave={async (f) => { const ok = await save.edit(r, f); if (ok) setEdit(false); return ok; }} /></Card> : <>
      <div className="v2-chips" style={{ marginTop: 12 }}>
        <span className="v2-apprtag" data-done={done ? "1" : "0"}>{done ? "품의 완료" : "품의 전"}</span>
        <span className="v2-apprtag">{r.docType}</span><span className="v2-apprtag">{r.topic}</span></div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>요청 {r.requester || "?"} · {when(r.createdAt)}{r.updatedAt && r.updatedAt !== r.createdAt && !done ? ` · 고침 ${when(r.updatedAt)}` : ""} · 담당 <b style={{ color: C.ink }}>{apprAssignee(r)}</b></div>
      {done && <div style={{ background: "#EAF4EE", color: C.green, borderRadius: 12, padding: "10px 12px", marginTop: 10, fontSize: 13.5, fontWeight: 700, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>✓ {r.doneBy || "?"} 품의 완료 · {when(r.doneAt)}{r.doneMemo ? `\n메모 ${r.doneMemo}` : ""}</div>}
      <div style={box}><div style={boxHd}>제목<span style={{ flex: 1 }} /><TBtn onClick={() => copy("title")} style={{ minHeight: 28, padding: "3px 10px" }}>복사</TBtn></div><div style={boxBd}>{r.title}</div></div>
      <div style={box}><div style={boxHd}>본문<span style={{ flex: 1 }} /><TBtn onClick={() => copy("body")} style={{ minHeight: 28, padding: "3px 10px" }}>복사</TBtn></div><div style={boxBd}>{r.body}</div></div>
      {canDone && !done && <Card style={{ marginTop: 14, padding: "4px 14px 14px" }}>
        <div style={label}>하이웍스에 올렸나요?</div>
        <input aria-label="메모" value={memo} maxLength={100} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택) · 예: 결재 문서번호" style={inp} />
        <Big tone="green" disabled={busy} onClick={() => act(() => save.done(r, memo))} style={{ marginTop: 10 }}>✓ 품의 완료</Big></Card>}
      {canDone && done && <div style={{ marginTop: 12 }}><TBtn tone="mute" disabled={busy} onClick={() => act(() => save.undo(r))}>품의 전으로 되돌리기</TBtn></div>}
      {canAsg && <><div style={label}>담당 바꾸기</div>
        <select aria-label="담당 바꾸기" className="v2-sel" value={(asgUsers.find((u) => u.name === apprAssignee(r)) || {}).id || ""} disabled={busy}
          onChange={(e) => { const u = asgUsers.find((x) => x.id === e.target.value); if (u) act(() => save.assign(r, u)); }} style={{ width: "100%" }}>
          {!asgUsers.some((u) => u.name === apprAssignee(r)) && <option value="">{apprAssignee(r)}</option>}
          {asgUsers.map((u) => <option key={u.id} value={u.id}>{u.name}{u.name === APPR_DEFAULT_ASSIGNEE ? " (기본)" : ""}</option>)}</select>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>바꾸면 그 사람 '확인할 것'에 떠요</div></>}
      {canEdit && <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {!done && <TBtn onClick={() => setEdit(true)}>고치기</TBtn>}
        <TBtn tone="red" onClick={() => setAsk("del")}>지우기</TBtn></div>}
    </>}
    {ask === "del" && <Ask title="이 요청을 지울까요?" body={r.title} yes="지우기" danger onNo={() => setAsk("")} onYes={async () => { setAsk(""); if (await save.remove(r)) onBack ? onBack() : onClose(); }} />}
  </Sheet>;
}
