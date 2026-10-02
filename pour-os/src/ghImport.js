// ✅ 그로홈 대시보드 업무 → 커머스본부 업무OS 한 번 옮기기 (계산 로직만 — 화면은 App.jsx)
//
// 원본: Firebase 프로젝트 grohome-dashboard (읽기만, 지우지 않음 — 대시보드 화면은 그대로 둠)
//  · employees(담당자) · fixedTasks(고정업무) · etcTasks(기타 업무) · leadingTasks(선행 업무) · monthlyTasks(월간 업무) · gbTasks(KPI 업무 트리)
// 규칙 (대표 결정: 업무는 업무OS 에서만 · 김보성·이채은은 담당자로 추가하되 '미사용')
//  · 모두 그로홈 브랜드. id 앞에 "gh_" → 두 번 눌러도 중복 없음
//  · 고정업무 → 고정업무(시간이 'HH:MM'이면 그 시간, '상시'·'주 2회' 같은 말은 메모)
//  · 기타·선행·월간 업무 → 할 일(완료 여부·마감일 그대로, 메모에 어디서 왔는지)
//  · KPI 업무 트리 → KPI 분야(제품·판매·운영·마케팅·브랜드)마다 프로젝트 1개 + 그 아래 업무·하위 업무(분기·이유·결과는 메모)
//  · 사람: 같은 이름의 업무OS 담당자. 없는 사람은 새 담당자로 추가하고 active:false(미사용)
import { fsVal } from "./moyImport.js";

export const GH_FIREBASE = { projectId: "grohome-dashboard", apiKey: "AIzaSyBp6S2Fln8cCXBHKpREfguRfLkL2oEYZ3k" };
export const GH_COLS = ["employees", "fixedTasks", "etcTasks", "leadingTasks", "monthlyTasks", "gbTasks"];
export const GH_KPI_LABEL = { product: "제품", sales: "판매", operations: "운영", marketing: "마케팅", brand: "브랜드" };

// REST 목록 응답 → [{_id, ...칸}]
export function parseGhCol(json) {
  return (json && json.documents || []).map((d) => ({ ...Object.fromEntries(Object.entries(d.fields || {}).map(([a, b]) => [a, fsVal(b)])), _id: String(d.name || "").split("/").pop() }));
}
const asBool = (v) => v === true || v === "true" || v === "True";
const norm = (s) => String(s || "").replace(/\s/g, "");
export const ghUserId = (name) => "gh_u_" + [...norm(name)].map((c) => c.charCodeAt(0).toString(36)).join("");
const hhmm = (s) => { const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/); return m ? String(m[1]).padStart(2, "0") + ":" + m[2] : null; };
const timesOf = (v) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === "object" ? x.time : x)).filter(Boolean).map(String);

export function planGhImport(src, D, { brandId = "grohome" } = {}) {
  const users = D.users || [];
  const empName = Object.fromEntries((src.employees || []).map((e) => [e._id, e.name || ""]));
  const allNames = [...new Set([...(src.employees || []).map((e) => e.name), ...(src.gbTasks || []).map((t) => t.assignee)].filter((n) => norm(n)))];
  const byName = {}; const newUsers = [];
  allNames.forEach((n) => { const hit = users.find((u) => norm(u.name) === norm(n));
    if (hit) byName[norm(n)] = hit.id;
    else { const id = ghUserId(n); byName[norm(n)] = id; if (!users.some((u) => u.id === id)) newUsers.push({ id, name: String(n).trim(), role: "member", color: "#8B95A1", active: false, importedFrom: "grohome-dashboard" }); } });
  const uidOfName = (n) => (norm(n) ? byName[norm(n)] || "" : "");
  const uidOfEmp = (eid) => uidOfName(empName[eid]);
  const from = { importedFrom: "grohome-dashboard", brand: brandId };
  const base = (t) => ({ ...from, attachments: [], parentId: null, projectId: "", weekDay: null, weekSlot: null, workDate: "" });
  const tasks = [];
  (src.fixedTasks || []).forEach((r) => { const u = uidOfEmp(r.employeeId); const ts = timesOf(r.times); const t0 = ts.map(hhmm).find(Boolean) || null; const words = ts.filter((x) => !hhmm(x));
    tasks.push({ ...base(r), id: "gh_fx_" + r._id, title: String(r.content || "").trim() || "(이름 없음)", isFixed: true, type: "fixed", status: "todo", assigneeId: u, assigneeIds: u ? [u] : [], forAll: false,
      fixedTime: t0, doneDates: {}, memo: ["그로홈 대시보드 고정업무", words.length ? "주기: " + words.join(", ") : "", ts.length > 1 ? "시간: " + ts.join(", ") : ""].filter(Boolean).join(" · "), createdAt: r.createdAt || "" }); });
  const once = (list, kind, label) => (list || []).forEach((r) => { const u = uidOfEmp(r.employeeId); const done = asBool(r.completed);
    tasks.push({ ...base(r), id: `gh_${kind}_` + r._id, title: String(r.content || "").trim() || "(이름 없음)", isFixed: false, type: "general", status: done ? "done" : "todo", assigneeId: u,
      ...(done && r.createdAt ? { doneAt: r.createdAt } : {}), dueDate: r.dueDate || "", priority: r.priority || "mid", memo: "그로홈 대시보드 " + label, createdAt: r.createdAt || "" }); });
  once(src.etcTasks, "etc", "기타 업무"); once(src.leadingTasks, "lead", "선행 업무"); once(src.monthlyTasks, "mon", "월간 업무");
  // KPI 업무 트리
  const gb = src.gbTasks || [];
  const key = {}; gb.forEach((r) => { key[r._id] = r._id; if (r.id) key[r.id] = r._id; });
  const ST = { "완료": "done", "진행중": "inprogress", "계획": "todo" };
  const kpis = [...new Set(gb.map((r) => r.kpiId || "etc"))];
  const projects = kpis.map((k) => { const rows = gb.filter((r) => (r.kpiId || "etc") === k);
    const cnt = {}; rows.forEach((r) => { const u = uidOfName(r.assignee); if (u && !newUsers.some((x) => x.id === u)) cnt[u] = (cnt[u] || 0) + 1; });
    const lead = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    return { id: "gh_kpi_" + k, title: `그로홈 KPI 업무 · ${GH_KPI_LABEL[k] || k}`, ...from, assigneeId: lead ? lead[0] : "", collaboratorIds: [], status: "active", priority: "mid", progress: 0, resultValue: 0, mainKPIId: "", subKPIId: "", group: "기타", memo: "그로홈 대시보드 KPI 업무에서 옮김" }; });
  gb.forEach((r) => { const pid = r.parentId && r.parentId !== "None" ? key[r.parentId] : null;
    tasks.push({ ...base(r), id: "gh_gb_" + r._id, title: String(r.title || "").trim() || "(이름 없음)", isFixed: false, type: "general", status: ST[r.status] || "todo",
      projectId: "gh_kpi_" + (r.kpiId || "etc"), parentId: pid ? "gh_gb_" + pid : null, assigneeId: uidOfName(r.assignee), ghKrId: r.krId || "",
      memo: [r.quarter ? "분기: " + r.quarter : "", r.why ? "이유: " + r.why : "", r.result ? "결과: " + r.result : ""].filter(Boolean).join("\n") }); });
  const fresh = (k, list) => { const h = new Set((D[k] || []).map((x) => x.id)); return list.filter((x) => !h.has(x.id)); };
  const adds = { users: fresh("users", newUsers), projects: fresh("projects", projects), tasks: fresh("tasks", tasks) };
  const cnt = (pre) => ({ add: adds.tasks.filter((t) => t.id.startsWith(pre)).length, total: tasks.filter((t) => t.id.startsWith(pre)).length });
  const counts = { fixed: cnt("gh_fx_"), etc: cnt("gh_etc_"), lead: cnt("gh_lead_"), mon: cnt("gh_mon_"), gb: cnt("gh_gb_"), projects: { add: adds.projects.length, total: projects.length }, users: { add: adds.users.length, total: newUsers.length } };
  const matched = allNames.filter((n) => !newUsers.some((u) => norm(u.name) === norm(n))).map((n) => String(n).trim());
  const noOwner = tasks.filter((t) => !t.assigneeId).length;
  return { adds, logs: [], counts, matched, newUsers: newUsers.map((u) => u.name), noOwner, nothing: Object.values(adds).every((v) => !v.length) };
}
