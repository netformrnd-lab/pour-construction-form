// 업무OS v2 — 기밀 화면 조각: 자물쇠 표시 · 허용 안 된 사람이 열었을 때 · 기밀 설정 칸 (규칙은 secret.js)
import { useState } from "react";
import { secretOn, projSeen } from "./secret.js";
import { ownersOf, nameOf, isMaster, activeUsers, dueOf, md } from "./model.js";
import { C, TBtn, Chip, Sheet, Big } from "./ui.jsx";

// 작은 자물쇠 (글자 옆 표시용 · 버튼 아님)
export const Lock = ({ size = 13, color }) => <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "0 0 auto", verticalAlign: "-2px" }}>
  <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill={color || C.navy} /><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke={color || C.navy} strokeWidth="1.6" /></svg>;

// 허용 안 된 사람이 기밀을 열면 (제목·내용 없이 담당·기한만)
export function LockSheet({ D, x, kind, onBack, onClose }) {
  const who = kind === "project" ? nameOf(D.users, x && x.assigneeId) : (x ? ownersOf(x).map((id) => nameOf(D.users, id)).filter(Boolean).join(", ") : "");
  const due = x ? (kind === "project" ? x.launchDate || x.dueDate : dueOf(x)) : "";
  return <Sheet title={kind === "project" ? "기밀 프로젝트" : "기밀 업무"} kind={kind === "project" ? "프로젝트" : "업무"} head={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Lock size={18} color="#fff" />{kind === "project" ? "기밀 프로젝트" : "기밀 업무"}</span>} onBack={onBack} onClose={onClose}>
    <div className="v2-lock">
      <b>허용된 사람만 볼 수 있어요</b>
      <div>{who ? `${kind === "project" ? "책임" : "담당"} ${who}` : ""}{due ? ` · ${kind === "project" ? "마감" : "기한"} ${md(due)}` : ""}</div>
      <div className="s">봐야 하는 일이라면 {kind === "project" ? "책임자" : "담당자"}나 관리자에게 볼 수 있게 해 달라고 말해 주세요</div>
    </div>
  </Sheet>;
}

// 자동으로 볼 수 있는 사람 (고르기에서 켜진 채 잠김) — 업무의 프로젝트 책임자는 빼고(leadOf · 끌 수 있음)
function autoIds(kind, x, D) {
  if (kind === "project") return new Set([x.assigneeId, ...(x.collaboratorIds || []), x.createdBy, ...(D.tasks || []).filter((t) => t.projectId === x.id).flatMap(ownersOf)].filter(Boolean));
  return new Set([...ownersOf(x), x.requestedBy, x.createdBy].filter(Boolean));
}
// 업무의 프로젝트 책임자: 기본으로 켜져 있고 끌 수 있음(secret.deny · 사용자 결정 2026-10-07) — 담당·맡긴·만든 사람이면 자동(잠김)
const leadOf = (kind, x, D) => { if (kind !== "task") return null; const p = (D.projects || []).find((q) => q.id === x.projectId); return (p && p.assigneeId) || null; };
// 기밀로 정할 수 있는 사람: 관리자 · (프로젝트) 책임자 · (업무) 프로젝트 책임자 → 프로젝트 없는 업무는 맡긴 사람·만든 사람
export function canSecret(kind, x, D, cu) {
  if (!x || isMaster(cu)) return !!x;
  if (kind === "project") return x.assigneeId === cu.id;
  const p = (D.projects || []).find((q) => q.id === x.projectId);
  return p ? p.assigneeId === cu.id : (x.requestedBy || x.createdBy) === cu.id;
}

// 업무·프로젝트 화면의 기밀 칸: 켜져 있으면 한 줄(누가 보는지) · 정할 수 있는 사람만 [기밀로 설정] / [볼 사람 바꾸기] / [기밀 풀기]
// only: "status" = 상태 줄만(늘 보이는 자리) · "button" = 버튼·고르기만(드물게 쓰는 '더 하기'·'정보' 안) · 없으면 둘 다
export function SecretBox({ kind, x, D, cu, A, only }) {
  const [edit, setEdit] = useState(false), [sel, setSel] = useState(null), [dsel, setDsel] = useState(null);
  if (!x || x.isFixed) return null;
  const on = secretOn(x), can = canSecret(kind, x, D, cu);
  const p = kind === "task" ? (D.projects || []).find((q) => q.id === x.projectId) : null, inherit = !!p && secretOn(p);
  if (!on && !can && !inherit) return null;
  if (only === "status" && !on && !inherit) return null;
  if (only === "button" && !can) return null;
  const auto = autoIds(kind, x, D), people = activeUsers(D.users).filter((u) => !isMaster(u));
  const lead = leadOf(kind, x, D);
  if (lead && !isMaster(cu) && lead === cu.id) auto.add(lead);   // 책임자 본인이 정하면 본인은 늘 봄(정한 사람)
  const leadFree = !!lead && !auto.has(lead);   // 끌 수 있는 책임자
  const deny = (dsel || (on ? x.secret.deny || [] : [])).filter((i) => leadFree && i === lead);
  const allow = sel || (on ? x.secret.allow || [] : []);
  const seen = people.filter((u) => auto.has(u.id) || allow.includes(u.id) || (u.id === lead && !deny.includes(u.id)));
  const save = (next) => { A.setSecret(kind, x, next); setEdit(false); setSel(null); setDsel(null); };
  const open = () => { setSel(on ? x.secret.allow || [] : []); setDsel(on ? x.secret.deny || [] : []); setEdit(true); };
  return <div className="v2-secret">
    {only !== "button" && (on || inherit) && <div className="ln"><Lock /> <b>기밀</b><span>{inherit && !on ? "프로젝트가 기밀이라 이 업무도 기밀 · " : ""}관리자와 {(on ? seen : people.filter((u) => projSeen(p, u.id, D.tasks))).map((u) => (u.id === cu.id ? "나" : u.name)).join(", ") || "책임자"}만 봐요</span></div>}
    {only !== "status" && can && !edit && <div className="row">
      {on ? <><TBtn onClick={open}>볼 사람 바꾸기</TBtn><TBtn onClick={() => save(null)}>기밀 풀기</TBtn></> : <TBtn onClick={open}>기밀로 설정</TBtn>}
    </div>}
    {only !== "status" && edit && <div className="pick">
      <div className="s">볼 수 있는 사람을 골라 주세요 · 관리자는 늘 볼 수 있고, {kind === "project" ? "책임자·함께 하는 사람·그 안 업무 담당은 자동으로 봐요" : "담당·맡긴 사람은 자동으로 봐요 · 프로젝트 책임자는 기본으로 켜져 있고 끌 수 있어요"}. 나머지 팀원에겐 '기밀 업무'(자물쇠)로만 보여요</div>
      <div className="v2-chips">{people.map((u) => { const a = auto.has(u.id), isLead = leadFree && u.id === lead, k = a || (isLead ? !deny.includes(u.id) : allow.includes(u.id));
        const tap = () => { if (a) return; if (isLead) setDsel(k ? [u.id] : []); else setSel(k ? allow.filter((i) => i !== u.id) : [...allow, u.id]); };
        return <Chip key={u.id} on={k} onClick={tap} style={a ? { opacity: 0.7, cursor: "default" } : null}>{k ? "✓ " : ""}{u.id === cu.id ? "나" : u.name}{a ? " (자동)" : isLead ? " (책임자)" : ""}</Chip>; })}</div>
      <div className="row"><Big onClick={() => save({ allow: allow.filter((i) => !auto.has(i) && i !== lead), deny })} style={{ flex: 1 }}>{on ? "이대로 저장" : "기밀로 설정"}</Big><TBtn onClick={() => { setEdit(false); setSel(null); setDsel(null); }}>그만</TBtn></div>
    </div>}
  </div>;
}
