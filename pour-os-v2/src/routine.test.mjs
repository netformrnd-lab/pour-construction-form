// node src/routine.test.mjs — 반복(행동지표) ↔ 신제품 횟수 항목 같이 세기 (계산만)
import { akLaunchItems, countOf, baseTitle, countFields, sumAk, myRoutine, launchMatches, akMatches, akWrite, periodLabel, brandName } from "./routine.js";
import { AK_SEED } from "../../pour-os/src/actionKpi.js";
import { planLaunchSync } from "./lbsync.js";
import { planLaunchPush } from "./lbpush.js";

let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) { ok++; } else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };
const ak = (id) => AK_SEED.find((x) => x.id === id);

// 1. 낱말 짝 (괄호 안 말은 안 봄 · 체험단 빼기)
ck("컨텐츠 발행 → 블로그", JSON.stringify(akLaunchItems(ak("ak_c_b2c"))) === '["x_blog"]', akLaunchItems(ak("ak_c_b2c")));
ck("고객 타겟 광고 → 메타·디맨드젠", JSON.stringify(akLaunchItems(ak("ak_ad"))) === '["x_meta","x_dg"]');
ck("키워드 선정 (광고/컨텐츠) → 없음", akLaunchItems(ak("ak_kwsel")).length === 0, akLaunchItems(ak("ak_kwsel")));
ck("체험단 모집 컨텐츠 → 없음", akLaunchItems(ak("ak_trial")).length === 0);
ck("NPS → 없음", akLaunchItems(ak("ak_nps_b2c")).length === 0);
ck("숏폼 이름 → 숏폼", JSON.stringify(akLaunchItems({ name: "숏폼 업로드" })) === '["x_short"]');

// 2. 횟수 · 제목
const T = (o) => ({ id: "lb_p1__x_blog", projectId: "lb_p1", launchItem: "x_blog", title: "블로그 포스팅 (1/3)", status: "todo", assigneeId: "songhee", assigneeIds: ["songhee"], ...o });
ck("제목에서 횟수", countOf(T()) === 1);
ck("count 칸 먼저", countOf(T({ count: 2 })) === 2);
ck("횟수 뺀 제목", baseTitle(T()) === "블로그 포스팅");
const cu = { id: "songhee", name: "김송희" }, at = "2026-10-05T01:00:00.000Z";
let c = countFields(T(), 1, cu, at);
ck("+1 → 2/3 · 진행 중", c.n === 2 && c.fields.title === "블로그 포스팅 (2/3)" && c.fields.status === "inprogress" && c.fields.startedAt === "2026-10-05", c);
c = countFields(T({ count: 2, status: "inprogress" }), 1, cu, at);
ck("목표 채우면 끝냄", c.fields.status === "done" && c.fields.finishedAt === at && c.fields.doneBy === "songhee", c.fields);
c = countFields(T({ count: 3, status: "done" }), -1, cu, at);
ck("되돌리면 다시 진행 중", c.fields.status === "inprogress" && c.fields.doneAt === null && c.n === 2, c.fields);
c = countFields(T({ count: 0 }), -1, cu, at);
ck("0 아래로 안 내려감", c.n === 0);

// 3. 실적 더하기 · 쓰기
const v1 = { w: { "2026-10-05": { ak_c_b2c: { n: 2, by: { songhee: 2 } } } } };
const v2 = { w: { "2026-10-05": { ak_c_b2c: { n: 1, fail: 0, by: { songhee: 1 } } } } };
const s = sumAk(v1, v2, null);
ck("버전1 + v2 합", s.w["2026-10-05"].ak_c_b2c.n === 3 && s.w["2026-10-05"].ak_c_b2c.by.songhee === 3, s);
let w = akWrite(null, ak("ak_c_b2c"), "2026-10-05", 1, cu, at, {});
ck("새 문서 쓰기", w.write.w["2026-10-05"].ak_c_b2c.n === 1 && w.write.log.length === 1 && w.ret === 1, w);
w = akWrite({ w: { "2026-10-05": { ak_c_b2c: { n: 3, by: { songhee: 3 } } } }, log: [] }, ak("ak_c_b2c"), "2026-10-05", -1, cu, at, { task: "x" });
ck("있는 문서 −1", w.write["w.2026-10-05.ak_c_b2c.n"] === 2 && w.write["w.2026-10-05.ak_c_b2c.by.songhee"] === 2 && w.write.log[0].task === "x", w.write);
w = akWrite({ w: {} }, ak("ak_link"), "2026-10-05", 1, cu, at, {});
ck("% 항목은 step(10)씩", w.write["w.2026-10-05.ak_link.n"] === 10);
w = akWrite({ w: {} }, ak("ak_match"), "2026-10-05", 1, cu, at, { fail: true });
ck("실패 건은 fail 만", w.write["w.2026-10-05.ak_match.fail"] === 1 && w.write["w.2026-10-05.ak_match.n"] === 0);

// 4. 내 반복 줄 (주간·월간)
const users = [{ id: "songhee", name: "김송희" }, { id: "ran", name: "이란" }];
const docs = { "2026-Q4": sumAk(v1, v2) };
const rows = myRoutine(AK_SEED, users, "songhee", docs, "2026-10-07");
const rb = rows.find((r) => r.it.id === "ak_c_b2c");
ck("송희 반복에 컨텐츠 발행 3/4", rb && rb.tot.n === 3 && rb.tot.g === 4 && rb.per === "이번 주", rb && rb.tot);
ck("이란 것은 안 보임", !rows.some((r) => r.it.id === "ak_c_b2b"));
ck("월간 항목 = 실제 달 '10월'", rows.find((r) => r.it.id === "ak_kwsel").per === "10월");
ck("순서 주 → 월 → 분기", rows.map((r) => ({ W: 0, M: 1, Q: 2 })[r.it.cyc]).every((v, i, a) => !i || a[i - 1] <= v), rows.map((r) => r.it.cyc).join(""));
{ const r2 = myRoutine([{ ...ak("ak_c_b2c"), who: ["chaerim", "songhee"] }], [...users, { id: "chaerim", name: "이채림" }], "songhee", docs, "2026-10-07").find((r) => r.it.id === "ak_c_b2c");
  ck("담당 수(내 몫 표시용)", r2.owners === 2 && r2.me === 3, r2 && [r2.owners, r2.me]); }

// 4b. 기간 이름 · 브랜드 이름
ck("2026-10-06 주간 → 이번 주", periodLabel({ cyc: "W" }, "2026-10-06") === "이번 주");
ck("2026-10-06 월간 → 10월", periodLabel({ cyc: "M" }, "2026-10-06") === "10월");
ck("2026-10-01 월간 → 9월 (이번 주 월요일 9/28 의 달)", periodLabel({ cyc: "M" }, "2026-10-01") === "9월", periodLabel({ cyc: "M" }, "2026-10-01"));
ck("2026-10-06 분기 → 4분기", periodLabel({ cyc: "Q" }, "2026-10-06") === "4분기");
ck("2026-10-01 분기 → 3분기", periodLabel({ cyc: "Q" }, "2026-10-01") === "3분기");
const BRS = [{ id: "pourstore", name: "POUR스토어" }, { id: "bmuqo9k5u", name: "모여라딜" }, { id: "bmupq52c0", name: "바라스데이" }];
ck("brandName id → 모여라딜", brandName("bmuqo9k5u", BRS) === "모여라딜");
ck("brandName 이름 그대로", brandName("POUR스토어", BRS) === "POUR스토어" && brandName("pourstore", BRS) === "POUR스토어");
ck("brandName 목록 없어도 아는 이름", brandName("grohome") === "그로홈" && brandName("", BRS) === "");

// 5. 짝 찾기
const D = { users, projects: [{ id: "lb_p1", title: "스티커 프라이머", status: "active", launchDate: "2026-10-16" }, { id: "lb_p2", title: "타일카펫", status: "active", launchDate: "2026-10-20" }, { id: "lb_p3", title: "끝난 제품", status: "completed", launchDate: "2026-10-16" }, { id: "lb_p9", title: "먼 제품", status: "active", launchDate: "2027-03-01" }],
  tasks: [T(), T({ id: "lb_p2__x_blog", projectId: "lb_p2" }), T({ id: "lb_p3__x_blog", projectId: "lb_p3" }), T({ id: "lb_p1__x_meta", launchItem: "x_meta", title: "메타 광고 올리기 (0/5)", assigneeId: "ran", assigneeIds: ["ran"] }),
    T({ id: "lb_p4__x_blog", projectId: "lb_p1", status: "done", count: 3 }), T({ id: "lb_p9__x_blog", projectId: "lb_p9" })] };
let m = launchMatches(ak("ak_c_b2c"), D, "songhee", "2026-10-07");
ck("짝 2개(열린 프로젝트 · 내 것 · 목표 전)", m.map((t) => t.id).join() === "lb_p1__x_blog,lb_p2__x_blog", m.map((t) => t.id));
m = launchMatches(ak("ak_ad"), D, "songhee", "2026-10-07");
ck("광고: 남의 항목은 안 셈", m.length === 0);
const D2 = { ...D, tasks: [...D.tasks.map((t) => (t.id === "lb_p2__x_blog" ? { ...t, ownerAuto: true, ownerFrom: "lead" } : t))] };
m = launchMatches(ak("ak_c_b2c"), D2, "songhee", "2026-10-07");
ck("진짜 담당이 있으면 임시 담당(책임자로 채운) 항목은 빼기", m.map((t) => t.id).join() === "lb_p1__x_blog", m.map((t) => t.id));
ck("항목 → 반복 짝", akMatches(T(), AK_SEED, users, "songhee").map((x) => x.id).join() === "ak_c_b2c");
ck("항목 → 이란은 B2B 컨텐츠 발행", akMatches(T(), AK_SEED, users, "ran").map((x) => x.id).join() === "ak_c_b2b");
ck("항목 → 담당 아닌 사람 짝 없음", akMatches(T(), AK_SEED, [...users, { id: "minji", name: "김민지" }], "minji").length === 0);

// 6. 신제품 대시보드 count 양쪽
const p = { id: "p1", name: "스티커 프라이머", launchDate: "2026-10-16", stages: {}, osExtra: { x_blog: { count: 2, status: "doing", owner: "김송희", updatedAt: "2026-10-05T02:00:00.000Z" } }, updatedAt: "x" };
const proj = { id: "lb_p1", title: "스티커 프라이머", launchDate: "2026-10-16", lbSeen: { launchDate: "2026-10-16", name: "스티커 프라이머" } };
let t = T({ lbSeen: { status: "doing", owners: ["songhee"], due: "", note: "", count: 1 }, status: "inprogress", dueAuto: true, dueDate: "2026-10-30" });
let pl = planLaunchSync(p, proj, [t], users, "2026-10-05", at, null);
let x = pl.tasks.find((y) => y.t.id === t.id);
ck("신제품 횟수 2 → 업무 2/3", x && x.fields.count === 2 && x.fields.title === "블로그 포스팅 (2/3)" && x.fields.lbSeen.count === 2, x && x.fields);
t = T({ count: 2, lbSeen: { status: "doing", owners: ["songhee"], due: "", note: "", count: 1 }, status: "inprogress", dueAuto: true, dueDate: "2026-10-30", v2At: "2026-10-05T03:00:00.000Z" });
const p1 = { ...p, osExtra: { x_blog: { count: 1, status: "doing", owner: "김송희", updatedAt: "2026-10-05T00:00:00.000Z" } } };
pl = planLaunchSync(p1, proj, [t], users, "2026-10-05", at, null); x = pl.tasks.find((y) => y.t.id === t.id);
ck("v2에서 센 횟수는 버전1 값으로 안 덮임", !x || x.fields.count === undefined, x && x.fields);
pl = planLaunchPush(p1, proj, [t], users, at, "김송희", null);
ck("버전1 칸(osExtra)엔 안 씀", !pl.board || !Object.keys(pl.board.fields).some((k) => k.startsWith("osExtra")), pl.board && pl.board.fields);
// 6b. 버전1 횟수가 바뀌면 그 차이만 더함 (v2 에서 센 것 그대로) · 상태도 합친 횟수로
t = T({ count: 2, lbSeen: { status: "doing", owners: ["songhee"], due: "", note: "", count: 1 }, status: "inprogress", dueAuto: true, dueDate: "2026-10-30", v2At: "2026-10-05T03:00:00.000Z" });
const p2 = { ...p, osExtra: { x_blog: { count: 2, status: "doing", owner: "김송희", updatedAt: "2026-10-05T04:00:00.000Z" } } };
pl = planLaunchSync(p2, proj, [t], users, "2026-10-05", at, null); x = pl.tasks.find((y) => y.t.id === t.id);
ck("v2 2 + 버전1 +1 = 3 → 끝냄", x && x.fields.count === 3 && x.fields.status === "done" && x.fields.title === "블로그 포스팅 (3/3)", x && x.fields);
t = T({ count: 3, status: "done", lbSeen: { status: "doing", owners: ["songhee"], due: "", note: "", count: 2 }, dueAuto: true, dueDate: "2026-10-30", v2At: "2026-10-05T03:00:00.000Z" });
const p3 = { ...p, osExtra: { x_blog: { count: 1, status: "doing", owner: "김송희", updatedAt: "2026-10-05T04:00:00.000Z" } } };
pl = planLaunchSync(p3, proj, [t], users, "2026-10-05", at, null); x = pl.tasks.find((y) => y.t.id === t.id);
ck("버전1 −1 → 2/3 · 다시 진행 중", x && x.fields.count === 2 && x.fields.status === "inprogress" && x.fields.doneAt === null, x && x.fields);
// 7. 브랜드
const gh = { id: "ak_gh_ad", name: "고객 타겟 광고", brand: "grohome", who: ["songhee"], cyc: "W", goal: 2, active: true };
ck("그로홈 광고 ↔ 그로홈 제품만", akMatches({ launchItem: "x_meta" }, [ak("ak_ad"), gh], users, "songhee", "grohome").map((x) => x.id).join() === "ak_gh_ad");
ck("POUR스토어 광고 ↔ pourstore 제품", akMatches({ launchItem: "x_meta" }, [ak("ak_ad"), gh], users, "songhee", "pourstore").map((x) => x.id).join() === "ak_ad");
ck("제품 브랜드 없으면 둘 다", akMatches({ launchItem: "x_meta" }, [ak("ak_ad"), gh], users, "songhee", "").length === 2);
ck("브랜드가 다르면 짝 없음 (POUR스토어 컨텐츠 ↔ 그로홈 제품)", akMatches({ launchItem: "x_blog" }, [ak("ak_c_b2c")], users, "songhee", "grohome").length === 0);
const Dg = { ...D, projects: D.projects.map((p) => (p.id === "lb_p2" ? { ...p, brand: "grohome" } : { ...p, brand: "pourstore" })) };
m = launchMatches(ak("ak_c_b2c"), Dg, "songhee", "2026-10-07");
ck("반복 → 같은 브랜드 제품만(있으면)", m.map((t) => t.id).join() === "lb_p1__x_blog", m.map((t) => t.id));
m = launchMatches({ ...ak("ak_c_b2c"), brand: "barasday" }, Dg, "songhee", "2026-10-07");
ck("반복 → 같은 브랜드 없으면 짝 없음", m.length === 0);
console.log(`${ok} 통과 · ${bad} 실패`); if (bad) process.exit(1);
