// 모여라딜 OS 최신 데이터 가져오기 계산 시험 — node src/moysync.test.mjs (저장 없음)
import { planMoySync, moyHash, moyDiff, moyEdited, moyKeptNext, readMoySrc, MOY_BASE, isEmptyV } from "./moysync.js";
import { planMoyImport } from "../../pour-os/src/moyImport.js";
import { moyOver, kpiDefs } from "./kpi2.js";
import fs from "fs";
let pass = 0, fail = 0;
const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log(`${ok ? "✓" : "✕"} ${n}${ok ? "" : ` → ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`); ok ? pass++ : fail++; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const A0 = "2026-07-01T00:00:00.000Z", AFTER = "2026-10-06T08:00:00.000Z", NOW = "2026-10-08T12:00:00.000Z";
const sl = (status, at, by = "yongjeongha") => ({ status, at, by, byName: by === "songhee" ? "김송희" : "용정하" });
const T = (id, o) => ({ id, title: id, isFixed: false, type: "general", status: "todo", assigneeId: "yongjeongha", assigneeIds: ["yongjeongha"], parentId: null, projectId: "p1", dueDate: "", memo: "", attachments: [], statusLog: [sl("todo", A0)], ...o });
// 버전1 가져오기(2026-10-02) 때의 모여라딜 원본
const base = {
  users: [{ id: "songhee", name: "김송희" }, { id: "yongjeongha", name: "용정하" }, { id: "bot1", name: "봇" }],
  goals: [{ id: "g1", title: "하반기 1억", targetValue: 100000000, unit: "원" }],
  mainKPIs: [{ id: "mk1", goalId: "g1", title: "성장", targetValue: 4 }],
  subKPIs: [{ id: "sk_deal", mainKPIId: "mk1", title: "진행 공구 수", currentValue: 3, valueHistory: [{ at: A0, value: 3 }] }],
  projects: [{ id: "p1", title: "공구", status: "active", mainKPIId: "mk1", subKPIId: "sk_deal", assigneeId: "yongjeongha", collaboratorIds: ["songhee", "bot1"], progress: 50 },
    { id: "p2", title: "바라스데이 공구", status: "active", mainKPIId: "mk1", assigneeId: "yongjeongha", collaboratorIds: [] },
    { id: "p4", title: "업무OS에서 중단한 것", status: "active", assigneeId: "yongjeongha", collaboratorIds: [] },
    { id: "p6", title: "업무OS 휴지통 프로젝트", status: "active", assigneeId: "yongjeongha", collaboratorIds: [] }],
  tasks: ["t1", "t2", "t3", "t4", "t5", "t6", "t10", "t13", "t14"].map((id) => T(id))
    .concat([T("t11", { isFixed: true, recurType: "daily", doneDates: { yongjeongha: "2026-09-30" } }), T("t12", { projectId: "", brand: undefined })]),
  activityLog: [{ id: "l0", by: "yongjeongha", targetId: "t4", at: "2026-09-01T00:00:00.000Z", action: "edit", col: "tasks", label: "t4" }],
};
const users = [{ id: "songhee", name: "김송희" }, { id: "u9", name: "용정하" }, { id: "x", name: "이란" }];
const brands = [{ id: "pourstore", name: "POUR스토어" }, { id: "grohome", name: "그로홈" }, { id: "bB", name: "바라스데이" }, { id: "bM", name: "모여라딜" }];
// v2 지금 = 버전1 가져오기 결과 복사본 + 업무OS 손길
const v1 = planMoyImport(base, { users, brands }, { brandId: "bM" }).adds;
const V0 = { users, brands, ...clone(v1) };
const tv = (id) => V0.tasks.find((t) => t.id === "md_" + id), pv = (id) => V0.projects.find((p) => p.id === "md_" + id);
Object.assign(tv("t3"), { title: "업무OS에서 이름 바꿈", updatedBy: "songhee", updatedAt: "2026-10-05T00:00:00.000Z", v2At: "2026-10-05T00:00:00.000Z" });
tv("t4").memo = "버전1 때 업무OS에서 쓴 메모";   // 표시 없이 다름 (원본엔 바뀐 증거 없음)
tv("t5").memo = "업무OS 메모?";                   // 댓글 있음
tv("t6").removed = { at: "2026-10-07T00:00:00.000Z", by: "songhee", byName: "김송희" };
tv("t13").statusLog.push(sl("inprogress", "2026-10-03T00:00:00.000Z", "songhee")); tv("t13").status = "inprogress";
tv("t14").dueDate = "2026-10-20";               // 업무OS 기록 있음
Object.assign(pv("p4"), { status: "dropped", endPrev: "active", dropReason: "안 하기로 결정", updatedBy: "songhee", v2At: "2026-10-05T00:00:00.000Z", endLog: [{ kind: "dropped", at: "2026-10-05T00:00:00.000Z", by: "songhee" }] });
pv("p1").progress = 100; pv("p1").v2At = "2026-10-06T00:00:00.000Z";   // 진척 % 다시 계산만 (사람 손길 아님)
pv("p6").removed = { at: "2026-10-07T00:00:00.000Z", by: "songhee", byName: "김송희" };
V0.tasks.push({ ...clone(tv("t1")), id: "md_t_gone", title: "모여라딜에서 지운 것" });
tv("t11").doneDates = { u9: "2026-10-07" }; tv("t11").v2At = "2026-10-07T00:00:00.000Z";   // 고정업무 체크(업무OS 가 주인)
// 지금 모여라딜 원본
const src = clone(base);
const st = (id) => src.tasks.find((t) => t.id === id);
st("t2").title = "모여라딜에서 이름 바꿈"; st("t2").status = "inprogress"; st("t2").statusLog.push(sl("inprogress", AFTER));
st("t3").title = "모여라딜에서도 바꿈"; st("t3").statusLog.push(sl("done", AFTER)); st("t3").status = "done";
st("t5").memo = "모여라딜 메모"; st("t5").statusLog.push(sl("inprogress", AFTER)); st("t5").status = "inprogress";
st("t6").title = "휴지통 것을 모여라딜에서 바꿈"; st("t6").statusLog.push(sl("inprogress", AFTER));
st("t13").title = "상태 바꾼 것 이름"; st("t14").dueDate = "2026-10-09";
st("t11").doneDates = { yongjeongha: "2026-10-08" };
src.subKPIs[0].currentValue = 5; src.subKPIs[0].valueHistory.push({ at: AFTER, value: 5 });
src.projects.push({ id: "p3", title: "그로홈 협업", status: "active", mainKPIId: "mk1", assigneeId: "bot1", collaboratorIds: [] }, { id: "p5", title: "새 공구 2", status: "active", mainKPIId: "mk1", subKPIId: "sk_deal", assigneeId: "yongjeongha", collaboratorIds: ["songhee"] });
src.tasks.push(T("t7", { parentId: "t1", assigneeId: "bot1", assigneeIds: ["bot1"], status: "inprogress" }), T("t8", { projectId: "p4", status: "todo" }), T("t9", { projectId: "" }), T("t15", { projectId: "p4", status: "done", doneAt: AFTER }), T("t16", { projectId: "p6" }));
src.tasks = src.tasks.filter((t) => t.id !== "t_gone");
src.activityLog.push({ id: "l1", by: "yongjeongha", targetId: "t2", at: AFTER, action: "edit", col: "tasks", label: "t2" }, { id: "l2", by: "yongjeongha", targetId: "t7", at: AFTER, action: "add", col: "tasks", label: "t7" },
  { id: "l3", by: "bot1", targetId: "t4", at: "2026-09-02T00:00:00.000Z", action: "edit", col: "tasks", label: "t4 옛 기록" }, { id: "l4", by: "yongjeongha", targetId: "t3", at: AFTER, action: "edit", col: "tasks", label: "t3" });
src.settings = [{ id: "s" }]; src.trash = [{ _tid: "tr1", title: "휴지통" }]; src.eventTypes = [{ id: "e" }];
const ctx = { noteItems: new Set(["task:md_t5"]), logTargets: new Set(["md_t14"]), kpiOv: new Set(), sticky: new Set() };
const cu = { id: "songhee", name: "김송희" };
const pl = planMoySync(src, { ...V0, ...ctx }, { at: NOW, cu });
const ids = (a) => a.map((x) => x.id).sort();

eq("새 것 = md_ 없는 것만 (프로젝트 2 · 업무 5 · KPI 0)", [ids(pl.add), pl.counts.add], [["md_p3", "md_p5", "md_t15", "md_t16", "md_t7", "md_t8", "md_t9"], { goals: 0, mainKPIs: 0, subKPIs: 0, projects: 2, tasks: 5 }]);
eq("최신으로 = 업무OS에서 안 고침 + 모여라딜에서 바뀐 증거 (업무 t2 · 서브KPI 값)", ids(pl.upd), ["md_sk_deal", "md_t2"]);
eq("업무OS에서 고쳐서 그대로 + 이유", pl.keep.map((x) => [x.id, x.why]).sort(), [["md_p4", "v2"], ["md_t13", "status"], ["md_t14", "log"], ["md_t3", "v2"], ["md_t4", "v1"], ["md_t5", "note"]]);
eq("휴지통 것은 그대로 (되살리지 않음) · 모여라딜에서 없어진 것은 목록만", [ids(pl.trash), ids(pl.gone)], [["md_t6"], ["md_t_gone"]]);
eq("같음: 진척 %만 다른 프로젝트 · 고정업무 체크만 다른 것 · 다른 KPI", ["md_p1", "md_t11", "md_g1", "md_mk1", "md_t1"].every((id) => ![...pl.add, ...pl.upd, ...pl.keep, ...pl.trash].some((x) => x.id === id)), true);
const u2 = pl.upd.find((x) => x.id === "md_t2");
eq("최신으로: 바뀐 칸만 + 기대값 = 미리 본 값 + 손길 표시가 없을 때만", [u2.changed, u2.fields.title, u2.fields.status, u2.expect.title, u2.expect.status, u2.expect.updatedBy, u2.expect.removed, u2.expect.v2At],
  [["status", "statusLog", "title"], "모여라딜에서 이름 바꿈", "inprogress", "t2", "todo", null, null, null]);
eq("이전 값 남김(되돌리기) · moyAt · moySeen = 원본 지문", [u2.prev.title, u2.prev.status, u2.prev.moySeen, u2.fields.moyAt, u2.fields.moySeen === moyHash("tasks", { ...v1.tasks.find((t) => t.id === "md_t2"), ...{ title: "모여라딜에서 이름 바꿈", status: "inprogress", statusLog: st("t2").statusLog } })], ["t2", "todo", null, NOW, true]);
const sk = pl.upd.find((x) => x.id === "md_sk_deal");
eq("서브KPI: 값 기록이 2026-10-02 뒤에 늘면 모여라딜에서 바뀐 것 → 지금 값 · 기록", [sk.changed, sk.fields.currentValue], [["currentValue", "valueHistory"], 5]);
// 새 문서 모양 = 버전1 moyImport 결과와 같음(+ moyAt · moySeen)
const imp = planMoyImport(src, { users, brands }, { brandId: "bM" }).adds;
const same = pl.add.filter((x) => !x.fold).every((x) => { const ref = imp[x.key].find((y) => y.id === x.id); const { moyAt, moySeen, ...d } = x.data; return JSON.stringify(d) === JSON.stringify(ref) && moyAt === NOW && moySeen === moyHash(x.key, ref); });
eq("새 문서 = 버전1 가져오기와 같은 모양(md_ id · 연결 · importedFrom) + moyAt · moySeen", same, true);
const a = (id) => pl.add.find((x) => x.id === id).data;
eq("연결: 하위 업무 parentId md_ · 프로젝트 md_ · KPI md_", [a("md_t7").parentId, a("md_t7").projectId, a("md_p5").mainKPIId, a("md_p5").subKPIId, a("md_t7").importedFrom], ["md_t1", "md_p1", "md_mk1", "md_sk_deal", "moyeoradeal-os"]);
eq("사람: 같은 이름 → 업무OS 사람 · 봇 → 담당 비움", [a("md_t7").assigneeId, a("md_t7").assigneeIds, a("md_p5").collaboratorIds, a("md_p3").assigneeId, pl.people], ["", [], ["songhee"], "", [{ from: "김송희", to: "김송희" }, { from: "용정하", to: "용정하" }, { from: "봇", to: "" }]]);
eq("브랜드: 이름에 그로홈 → 그로홈(KPI 연결 끊음) · 새 공구 → 모여라딜 · 프로젝트 없는 업무 → 모여라딜", [a("md_p3").brand, a("md_p3").mainKPIId, a("md_p5").brand, a("md_t9").brand, pl.otherNew, pl.brands.map((b) => [b.name, b.n])],
  ["grohome", "", "bM", "bM", [{ title: "그로홈 협업", brand: "그로홈" }], [["모여라딜", 4], ["바라스데이", 1], ["그로홈", 1]]]);
const t8 = a("md_t8");
eq("업무OS에서 중단한 프로젝트에 새로 들어오는 열린 업무는 접음(dropPrev · 상태 기록) · 끝낸 업무는 그대로", [t8.status, t8.dropPrev, t8.droppedAt, t8.statusLog.slice(-1)[0].proj, pl.add.find((x) => x.id === "md_t8").fold, a("md_t15").status, pl.counts.folded], ["dropped", "todo", NOW, "dropped", "dropped", "done", 1]);
eq("휴지통 프로젝트 아래 새 업무는 만들되 프로젝트는 그대로(되살리지 않음)", [!!a("md_t16"), pl.upd.some((x) => x.id === "md_p6")], [true, false]);
eq("활동 기록: 새로·최신으로 바뀌는 것만 · md_ · 사람 바꿈 · 프로젝트 · 버전1 가져오기 전 기록 빼고", pl.logs.map((l) => [l.id, l.targetId, l.by, l.projectId, l.importedFrom]),
  [["md_l1", "md_t2", "u9", "md_p1", "moyeoradeal-os"], ["md_l2", "md_t7", "u9", "md_p1", "moyeoradeal-os"]]);
eq("설정·휴지통·일정 종류는 안 가져옴", Object.keys(pl.counts.src).sort(), ["goals", "mainKPIs", "projects", "subKPIs", "tasks"]);

// 적용 흉내 → 두 번째 미리 보기 (중복 없음 · 새로 0)
const apply = (V, p) => { const W = clone(V);
  p.add.forEach((o) => { W[o.key].push(clone(o.data)); });
  p.upd.forEach((o) => { const d = W[o.key].find((x) => x.id === o.id); Object.assign(d, clone(o.fields)); });
  return W; };
const V1 = apply(V0, pl), kept1 = moyKeptNext([], pl);
const pl2 = planMoySync(src, { ...V1, ...ctx, sticky: new Set(kept1) }, { at: NOW, cu });
eq("두 번째: 새로 0 · 최신으로 0 · 그대로 같음(+ 접어 넣은 새 업무) · nothing", [pl2.add.length, pl2.upd.length, ids(pl2.keep), pl2.nothing], [0, 0, [...ids(pl.keep), "md_t8"].sort(), true]);
eq("다음번 '그대로' 목록 = 지난 것 + 이번 것 (한 번 업무OS 것이면 계속)", moyKeptNext(["md_old"], pl), ["md_old", "md_p4", "md_t13", "md_t14", "md_t3", "md_t4", "md_t5"]);
// 지난번 넣은 뒤(moySeen): 업무OS에서 바뀜 → 그대로 · 모여라딜만 바뀜 → 기록 없어도 최신으로
const V2 = clone(V1); V2.tasks.find((t) => t.id === "md_t2").memo = "업무OS에서 손으로 고침(표시 없이)";
const src3 = clone(src); src3.tasks.find((t) => t.id === "t7").title = "모여라딜에서만 바꿈";   // 활동 기록 없음
src3.tasks.find((t) => t.id === "t2").title = "모여라딜에서 또 바꿈";
const pl3 = planMoySync(src3, { ...V2, ...ctx, sticky: new Set(kept1) }, { at: NOW, cu });
eq("moySeen: 업무OS에서 바뀐 것 → 그대로(seen) · 모여라딜만 바뀐 것 → 최신으로", [pl3.keep.find((x) => x.id === "md_t2") && pl3.keep.find((x) => x.id === "md_t2").why, ids(pl3.upd)], ["seen", ["md_t7"]]);
// 접은 새 업무는 다음번엔 업무OS 것(seen)
eq("접은 새 업무는 다음번에 '업무OS 것'으로 그대로", (pl3.keep.find((x) => x.id === "md_t8") || {}).why, "v2");
// 그대로 목록(sticky)에 있으면 모여라딜 증거가 있어도 그대로 · KPI 고치기 덧칠이 있으면 그대로
const pl4 = planMoySync(src, { ...V0, ...ctx, sticky: new Set(["md_t2"]), kpiOv: new Set(["md_sk_deal"]) }, { at: NOW, cu });
eq("지난번 그대로 → 계속 그대로(kept) · KPI 고치기 → 그대로(kpi)", [pl4.keep.find((x) => x.id === "md_t2").why, pl4.keep.find((x) => x.id === "md_sk_deal").why], ["kept", "kpi"]);
eq("모여라딜 브랜드가 없으면 멈춤", !!planMoySync(src, { ...V0, brands: brands.filter((b) => b.id !== "bM") }, {}).error, true);
// 작은 규칙
eq("빈 값은 같음(없음 = '' = [] = {} = false = null) · 진척·시각 표시는 비교 안 함", [moyDiff("tasks", { a: "", b: [], c: false, d: null, progress: 1 }, { e: {}, progress: 9, v2At: "x", updatedAt: "y" }), isEmptyV(0)], [[], false]);
eq("고정업무 끝냄·사람별 체크는 비교 안 함", moyDiff("tasks", { isFixed: true, doneAt: "a", doneDates: { a: 1 }, subDone: { x: 1 } }, { isFixed: true, doneAt: "b", doneByName: "x", doneAtBy: { a: 2 } }), []);
eq("업무OS 손길: 진척 다시 계산(v2At 만)은 손길 아님 · updatedBy 는 손길", [moyEdited("projects", { id: "a", progress: 1 }, { id: "a", progress: 9, v2At: "t" }), moyEdited("projects", { id: "a" }, { id: "a", updatedBy: "u" })], ["", "v2"]);
eq("지문: 칸 순서·빈 칸과 상관없이 같음", moyHash("tasks", { a: 1, b: "", c: [1] }) === moyHash("tasks", { c: [1], a: 1, z: null }), true);
eq("MOY_BASE = 2026-10-02 버전1 가져오기 바로 전", MOY_BASE, "2026-10-02T10:00:00.000Z");
// KPI 화면 덧칠: moyAt 있는 v2 정의만 버전1 위에(같은 id 바꿈 · 없으면 더함)
const lst = moyOver([{ id: "md_mk1", title: "옛" }, { id: "mk1", title: "커머스" }], [{ id: "md_mk1", title: "새", moyAt: NOW, _doc: "md_mk1" }, { id: "md_mk9", title: "새 KPI", moyAt: NOW }, { id: "md_mk2", title: "표시 없음" }]);
eq("KPI 화면: moyAt 있는 것만 덮고 더함", lst.map((x) => [x.id, x.title, x._doc === undefined]), [["md_mk1", "새", true], ["mk1", "커머스", true], ["md_mk9", "새 KPI", true]]);
eq("kpiDefs 에 moy 를 안 주면 예전 그대로", JSON.stringify(kpiDefs({ goals: { items: [{ id: "g" }] }, mainKPIs: { items: [] }, subKPIs: { items: [] }, lagKPIs: { items: [] } })), JSON.stringify({ goals: [{ id: "g" }], mainKPIs: [], subKPIs: [], lagKPIs: [] }));
// 버전1 다시 가져오기는 moyAt 문서를 건너뜀
eq("버전1 다시 가져오기(core.v2edited): moyAt 문서는 업무OS 것으로 보고 건너뜀", /export const v2edited = \(x\) => !!\(x && \(x\.v2At \|\| x\.moyAt \|\|/.test(fs.readFileSync(new URL("./core.jsx", import.meta.url), "utf8")), true);
// 원본 읽기 (가짜 fetch · 쪽 넘김 · 실패)
const docs = (names, tok) => ({ ok: true, json: async () => ({ documents: names.map((n) => ({ name: "projects/moyeora-deal-manager/databases/(default)/documents/moyeoradeal-os/state-" + n, fields: { items: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: n + "1" } } } }] } } } })), ...(tok ? { nextPageToken: tok } : {}) }) });
const urls = [];
const got = await readMoySrc(async (u) => { urls.push(u); return u.includes("pageToken=") ? docs(["tasks"]) : docs(["projects"], "N2"); });
eq("원본 읽기: 쪽 넘김 · state-* → 키별 items · REST 주소(moyeora-deal-manager · 읽기만)", [Object.keys(got).sort(), urls.length, /moyeora-deal-manager\/databases\/\(default\)\/documents\/moyeoradeal-os\?pageSize=300/.test(urls[0])], [["projects", "tasks"], 2, true]);
let err = ""; try { await readMoySrc(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "막힘" } }) })); } catch (e) { err = e.message; }
eq("원본 읽기 실패는 숨기지 않고 알림", err, "막힘");
console.log(`\n${fail ? "✕" : "✓"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
