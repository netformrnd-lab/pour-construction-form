// 업무OS v2 — 업무OS → 신제품 대시보드 반영 (3단계 · 계산만, 저장은 core.pushLaunchBoard)
// lbsync(신제품 → 업무OS)와 같은 '마지막으로 본 값'(lbSeen)으로 비교:
//   업무OS 값이 기억과 다르고 + 신제품 대시보드 값은 기억 그대로 → 신제품 대시보드에 씀 + 기억을 새 값으로
//   둘 다 바뀌었으면 lbsync 와 같은 규칙: 나중에 바뀐 쪽 (업무OS가 나중이면 여기서 씀 · 신제품이 나중이면 lbsync 가 업무OS 로)
// 기한: 사람이 정한 날 → 그 날 · 자동 기한 → 날짜 + 자동 표시(dueAuto: 같은 날짜 문자열 · 신제품에서 날짜를 바꾸면 자동 표시가 저절로 풀림)
// 신제품 대시보드 칸(lb)만 · 업무OS 추가 칸(osExtra)은 버전1 몫이라 안 씀 · 마감 '미정'(dueTbd)·추가 할 일 줄은 4단계
import { LAUNCH_ITEMS } from "./launch.js";
import { V2B, boardVals, v2Due, TBD } from "./lbsync.js";
import { ownersOf, dueOf, nameOf } from "./model.js";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const split = (v) => String(v || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
const LB_ITEMS = LAUNCH_ITEMS.filter((i) => i.lb);
export const BY = "업무OS";

// 업무OS 업무 → 신제품 말 (status: null 이면 상태는 건드리지 않음 — 프로젝트째 접힌 업무)
export function v2Vals(t) {
  const folded = t.holdBy === "proj" || (t.status === "dropped" && !t.lbSkip);
  return { status: folded ? null : t.status === "dropped" ? "skip" : V2B[t.status] || "todo", owners: ownersOf(t), due: v2Due(t), note: t.memo || "", auto: t.dueAuto ? dueOf(t) : "" };
}

// p: 신제품 대시보드 제품 · proj: lb_ 프로젝트 · tasks: 그 프로젝트 업무 · who: 바꾼 사람 이름
// → { board: {fields, expect, said[]} | null, tasks: [{t, lbSeen}], project: {lbSeen} | null }
export function planLaunchPush(p, proj, tasks, users, now, who) {
  const f = {}, expect = {}, said = [], seenOut = [];
  const byItem = new Map((tasks || []).filter((t) => t.launchItem && !t.isFixed && !t.deleted && t.lbSeen).map((t) => [t.launchItem, t]));
  LB_ITEMS.forEach((it) => {
    const t = byItem.get(it.id); if (!t) return;
    const s = ((p.stages || {})[it.id]) || {}, b = boardVals(p, it, users), base = t.lbSeen, v = v2Vals(t), sid = "stages." + it.id + ".";
    const sf = {}, seen = { ...base }, mine = [];
    // 업무OS만 바뀜 → 씀 · 둘 다 바뀜 → lbsync 와 똑같은 규칙으로 나중 쪽 (업무OS v2At 이 신제품 단계 updatedAt 보다 나중이면 업무OS 값)
    const v2Newer = !!t.v2At && t.v2At > (b.at || "");
    const push = (k) => !same(v[k], base[k]) && !same(v[k], b[k]) && (same(b[k], base[k]) || v2Newer);
    if (v.status && push("status")) {
      Object.assign(sf, { status: v.status, doneAt: v.status === "done" ? t.finishedAt || t.doneAt || now : "", doneBy: v.status === "done" ? t.doneByName || nameOf(users, ownersOf(t)[0]) || who : "" });
      seen.status = v.status; mine.push(v.status === "done" ? "컨펌 완료" : v.status === "skip" ? "해당 없음" : v.status === "doing" ? "진행 중" : v.status === "hold" ? "보류" : "할 일");
    }
    if (v.owners.length && !t.ownerAuto && push("owners")) {   // 업무OS가 임시·기본으로 채운 담당은 안 씀 (사람이 고른 담당만)
      const keep = split(s.owner).filter((n) => !(users || []).some((u) => u.name === n || n.endsWith(u.name) || u.name.endsWith(n)));   // 외주 이름 등은 그대로
      Object.assign(sf, { owner: [...v.owners.map((id) => nameOf(users, id)).filter(Boolean), ...keep].join(", "), ownerIds: v.owners });
      seen.owners = v.owners; mine.push("담당");
    }
    // 마감: 미정(tbd) → 신제품 '마감 미정' · 사람이 정한 날 → 그 날 · 자동 → 자동 날짜 + 표시 (미정 칸은 늘 같이 맞춤)
    if (push("due")) { Object.assign(sf, v.due === TBD ? { due: "", dueAuto: "", dueTbd: true } : { due: v.due || v.auto, dueAuto: v.due ? "" : v.auto, dueTbd: false }); seen.due = v.due; mine.push("마감"); }
    // 둘 다 자동 기한이면 신제품 대시보드 마감 칸에 자동 날짜만 채움/고침 (기록 없이 · 마감 '미정'·컨펌 완료·해당 없음 칸은 그대로)
    else if (!v.due && !b.due && v.auto && !s.dueTbd && b.status !== "done" && b.status !== "skip" && ((s.due || "") !== v.auto || (s.dueAuto || "") !== v.auto)) Object.assign(sf, { due: v.auto, dueAuto: v.auto });
    if (push("note")) { Object.assign(sf, { note: v.note }); seen.note = v.note; mine.push("진행사항"); }
    if (!Object.keys(sf).length) return;
    Object.entries(sf).forEach(([k, x]) => { f[sid + k] = x; });
    if (mine.length) { f[sid + "updatedAt"] = now; f[sid + "updatedBy"] = who + " (" + BY + ")"; said.push(it.name + " " + mine.join("·")); }   // 자동 날짜만 채운 건 '고친 시각'을 안 바꿈
    expect[sid + "updatedAt"] = s.updatedAt ?? null;   // 그사이 신제품 대시보드에서 이 칸을 고쳤으면 통째로 다음에
    seenOut.push({ t, lbSeen: seen });
  });
  // 제품: 출시일 · 이름
  let project = null; const pb = proj.lbSeen || null;
  if (pb) { const pf = {}, pSeen = { ...pb };
    if ((proj.launchDate || "") !== (pb.launchDate || "") && (p.launchDate || "") === (pb.launchDate || "") && proj.launchDate) { pf.launchDate = proj.launchDate; pSeen.launchDate = proj.launchDate; said.unshift("출시일 " + proj.launchDate); expect.launchDate = p.launchDate ?? null; }
    if ((proj.title || "") !== (pb.name || "") && (p.name || "") === (pb.name || "") && proj.title) { pf.name = proj.title; pSeen.name = proj.title; said.unshift("이름"); expect.name = p.name ?? null; }
    Object.assign(f, pf); if (Object.keys(pf).length) project = { lbSeen: pSeen }; }
  if (!Object.keys(f).length) return { board: null, tasks: [], project: null };
  return { board: { fields: f, expect, said }, tasks: seenOut, project };
}
