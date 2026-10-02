// ✅ 모여라딜 OS → 커머스본부 업무OS 한 번 옮기기 (계산 로직만 — 화면은 App.jsx)
//
// 원본: Firebase 프로젝트 moyeora-deal-manager · moyeoradeal-os/state-<키> (읽기만, 지우지 않음)
// 규칙
//  · id 앞에 "md_" — KPI 번호(mk1·mk2·mk3)가 커머스본부와 겹쳐 덮어쓰지 않도록
//  · 연결(목표→메인KPI→서브KPI→프로젝트→업무, 하위 업무)은 새 id 로 그대로 이음
//  · 사람: 같은 이름의 업무OS 담당자로 붙임(김송희·용정하). 없는 사람(봇 등)은 담당 비움
//  · 브랜드: 모여라딜 브랜드(brandId). 프로젝트 이름에 '바라스데이'·'그로홈'이 있으면 그 브랜드
//  · 이미 들어간 id 는 건너뜀 → 두 번 눌러도 중복 없음
//  · 휴지통·설정(eventTypes 등)은 옮기지 않음(원본에 그대로)
export const MOY_FIREBASE = { projectId: "moyeora-deal-manager", apiKey: "AIzaSyAQf_Cu9wMji5QsMBQns5eg6nOD_vmrZMs", ns: "moyeoradeal-os" };
export const MOY_KEYS = ["users", "goals", "mainKPIs", "subKPIs", "projects", "tasks", "activityLog"];
export const MD = "md_";
const mid = (id) => (id == null || id === "" ? id : String(id).startsWith(MD) ? String(id) : MD + id);

// Firestore REST 값 → 일반 값
export function fsVal(x) {
  if (x == null) return null;
  const k = Object.keys(x)[0], y = x[k];
  if (k === "mapValue") return Object.fromEntries(Object.entries(y.fields || {}).map(([a, b]) => [a, fsVal(b)]));
  if (k === "arrayValue") return (y.values || []).map(fsVal);
  if (k === "integerValue") return Number(y);
  if (k === "doubleValue") return Number(y);
  if (k === "nullValue") return null;
  return y;
}
// REST 목록 응답 → {키: items[]}
export function parseMoyDocs(json) {
  const out = {};
  (json && json.documents || []).forEach((d) => {
    const name = String(d.name || "").split("/").pop();
    if (!name.startsWith("state-")) return;
    const f = Object.fromEntries(Object.entries(d.fields || {}).map(([a, b]) => [a, fsVal(b)]));
    if (Array.isArray(f.items)) out[name.slice(6)] = f.items;
  });
  return out;
}

// 원본 + 현재 업무OS 상태 → 옮길 목록
export function planMoyImport(src, D, { brandId }) {
  const users = D.users || [], brands = D.brands || [];
  const norm = (s) => String(s || "").replace(/\s/g, "");
  const userMap = {}; const unmatched = [];
  (src.users || []).forEach((u) => { const hit = users.find((x) => norm(x.name) && norm(x.name) === norm(u.name)); if (hit) userMap[u.id] = hit.id; else { userMap[u.id] = ""; unmatched.push(u.name || u.id); } });
  const uid = (id) => (id ? (userMap[id] !== undefined ? userMap[id] : "") : id);
  const brandByName = (t) => { const s = norm(t);
    for (const b of brands) if (b && b.id !== brandId && norm(b.name) && s.includes(norm(b.name))) return b.id;
    return brandId; };
  const have = (k) => new Set((D[k] || []).map((x) => x.id));
  const fresh = (k, list) => { const h = have(k); return list.filter((x) => !h.has(x.id)); };

  const goalIds = new Set((src.goals || []).map((g) => g.id)), mkIds = new Set((src.mainKPIs || []).map((m) => m.id)),
    skIds = new Set((src.subKPIs || []).map((s) => s.id)), pIds = new Set((src.projects || []).map((p) => p.id)), tIds = new Set((src.tasks || []).map((t) => t.id));
  const from = { importedFrom: "moyeoradeal-os" };
  const goals = (src.goals || []).map((g) => ({ ...g, ...from, id: mid(g.id), brand: brandId }));
  const mainKPIs = (src.mainKPIs || []).map((m) => ({ ...m, ...from, id: mid(m.id), goalId: goalIds.has(m.goalId) ? mid(m.goalId) : "", brand: brandId }));
  const subKPIs = (src.subKPIs || []).map((s) => ({ ...s, ...from, id: mid(s.id), mainKPIId: mkIds.has(s.mainKPIId) ? mid(s.mainKPIId) : "" }));
  const projects = (src.projects || []).map((p) => { const own = brandByName(p.title);
    return { ...p, ...from, id: mid(p.id), brand: own, mainKPIId: own === brandId && mkIds.has(p.mainKPIId) ? mid(p.mainKPIId) : "", subKPIId: own === brandId && skIds.has(p.subKPIId) ? mid(p.subKPIId) : "",
      assigneeId: uid(p.assigneeId), collaboratorIds: (p.collaboratorIds || []).map(uid).filter(Boolean) }; });
  const tasks = (src.tasks || []).map((t) => { const pj = pIds.has(t.projectId) ? mid(t.projectId) : "";
    return { ...t, ...from, id: mid(t.id), projectId: pj, parentId: tIds.has(t.parentId) ? mid(t.parentId) : (t.parentId ? null : t.parentId),
      assigneeId: uid(t.assigneeId), ...(Array.isArray(t.assigneeIds) ? { assigneeIds: t.assigneeIds.map(uid).filter(Boolean) } : {}),
      ...(pj ? {} : { brand: brandId }) }; });
  const logs = (src.activityLog || []).map((e) => ({ ...e, id: mid(e.id), by: uid(e.by) || null, targetId: e.targetId ? mid(e.targetId) : e.targetId, imported: "모여라딜 OS" }));
  const adds = { goals: fresh("goals", goals), mainKPIs: fresh("mainKPIs", mainKPIs), subKPIs: fresh("subKPIs", subKPIs), projects: fresh("projects", projects), tasks: fresh("tasks", tasks) };
  const counts = Object.fromEntries(Object.entries(adds).map(([k, v]) => [k, { add: v.length, total: (src[k] || []).length }]));
  counts.activityLog = { add: logs.length, total: logs.length };
  const otherBrand = projects.filter((p) => p.brand !== brandId).map((p) => ({ title: p.title, brand: p.brand }));
  return { adds, logs, counts, userMap, unmatched, otherBrand, nothing: Object.values(adds).every((v) => !v.length) };
}
