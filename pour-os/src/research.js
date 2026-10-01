// ✅ 시장조사 ↔ 프로젝트 연결 — 계산만 (화면은 App.jsx 의 ResearchLink)
// · 시장조사 페이지(/Market-Research/ 등)가 체크한 제품을 업무OS 공간 pour-os/research-index/items/{보고서id} 에 요약해 둔다
//   { title, url, total, buy, more, items:[{no,name,cat,ch,sale,link,buy,more}], updatedAt }
// · 프로젝트는 researchIds:[보고서id] 로 연결 → '샘플 구매'·'비슷한 거 더 찾기' 체크를 업무로 한 번에 만든다(이미 만든 건 건너뜀)
export const RESEARCH_COL = "pour-os/research-index/items";
export const RESEARCH_BASE = "https://pour-construction-form.pages.dev";
export const researchUrl = (r) => (/^https?:/.test(String(r && r.url || "")) ? r.url : RESEARCH_BASE + (r && r.url || "/"));
export const KIND_LABEL = { buy: "샘플 구매", more: "비슷한 거 더 찾기" };
export const researchKey = (repId, no, kind) => `${repId}:${no}:${kind}`;
// 아직 업무로 안 만든 체크 항목
export function researchTodo(rep, tasks, kind) {
  if (!rep || !Array.isArray(rep.items)) return [];
  const made = new Set((tasks || []).map((t) => t && t.fromResearch).filter(Boolean));
  return rep.items.filter((it) => it && it[kind] && !made.has(researchKey(rep.id, it.no, kind)));
}
const won = (n) => (n == null || n === "" ? "" : Math.round(+n).toLocaleString("ko-KR") + "원");
export function researchTask(rep, it, kind, proj, seq) {
  const title = kind === "buy" ? `샘플 구매 · ${it.name}` : `비슷한 제품 더 찾기 · ${it.name}`;
  const memo = [`시장조사: ${rep.title || rep.id}`, [it.cat, it.ch, won(it.sale)].filter(Boolean).join(" · "), it.link || ""].filter(Boolean).join("\n");
  return { title, projectId: proj.id, assigneeId: proj.assigneeId || "", type: "general", status: "todo", isFixed: false, weekDay: null, weekSlot: null, workDate: "", dueDate: "", memo, attachments: [], seq: seq || 0, exec: "self", execNote: "", fromResearch: researchKey(rep.id, it.no, kind) };
}
