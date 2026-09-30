// 행동지표·권한·PIN·월말 회고 로직 테스트 — node src/actionKpi.test.mjs
import { createHash } from "node:crypto";
import { AK_SEED, LAG_SEED, akWeeksIn, akQuarterWeeks, akWeekKey, akQidOfWeek, akVal, akTotal, akWeekDone, akWho, lagCur, lagPct, akPartial,
  isMaster, can, sha256, pinHash, akRetroDay, akRetroDue, akGoalText, akAddDays } from "./actionKpi.js";

let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };

// ① 기준 데이터 — 파일의 필수 19개 · 결과 KPI 6개
eq("필수 행동지표 19개", AK_SEED.length, 19);
eq("전부 필수·진행 중", AK_SEED.every((x) => x.core && x.active), true);
eq("id 중복 없음", new Set(AK_SEED.map((x) => x.id)).size, 19);
eq("주간 8 · 월간 10 · 분기 1", ["W", "M", "Q"].map((c) => AK_SEED.filter((x) => x.cyc === c).length), [8, 10, 1]);
eq("결과 KPI 6개", LAG_SEED.length, 6);

// ② 주 나누기 — 월요일이 그 달에 있는 주만 (2026년 10월: 10/5·12·19·26)
eq("10월 주", akWeeksIn(2026, 9).map((w) => w.key), ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
eq("9월 주 (9/28 월요일은 9월)", akWeeksIn(2026, 8).map((w) => w.key), ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
eq("4분기 주 수", akQuarterWeeks(2026, 10).length, 13);
eq("목요일 → 그 주 월요일", akWeekKey(new Date(2026, 9, 1)), "2026-09-28");
eq("주 → 분기 문서 (9/28 주는 3분기)", akQidOfWeek("2026-09-28"), "2026-Q3");
eq("7일 더하기", akAddDays("2026-09-28", 7), "2026-10-05");

// ③ 값·합계
const it = (id) => AK_SEED.find((x) => x.id === "ak_" + id);
const docs = { "2026-Q4": { w: {
  "2026-10-05": { ak_c_b2c: { n: 4 }, ak_link: { n: 30 }, ak_match: { n: 2, fail: 1 }, ak_influrv: { n: 8 } },
  "2026-10-12": { ak_c_b2c: { n: 2 }, ak_link: { n: 80 }, ak_match: { n: 1 }, ak_influrv: { n: 12 } },
} } };
const oct = akWeeksIn(2026, 9);
eq("주간 그 주 값", akVal(docs, it("c_b2c"), "2026-10-05"), 4);
eq("주간 달성(4/4)", akWeekDone(docs, it("c_b2c"), "2026-10-05"), true);
eq("주간 미달(2/4)", akWeekDone(docs, it("c_b2c"), "2026-10-12"), false);
eq("주간 월 합계 = 주 목표 × 주 수", akTotal(docs, it("c_b2c"), oct), { n: 6, g: 16, done: false });
eq("월간 합계 달성(20/20)", akTotal(docs, it("influrv"), oct), { n: 20, g: 20, done: true });
eq("% 항목은 더해서 100에서 멈춤", akTotal(docs, it("link"), oct), { n: 100, g: 100, done: true });
eq("매칭: 실패 1건 → 3회 필요, 3회 시도 → 달성", akTotal(docs, it("match"), oct), { n: 3, g: 3, fail: 1, none: false, done: true });
eq("음수는 0으로", akVal({ "2026-Q4": { w: { "2026-10-05": { ak_ad: { n: -2 } } } } }, it("ad"), "2026-10-05"), 0);
eq("목표 문구", [akGoalText(it("c_b2c")), akGoalText(it("link")), akGoalText(it("match")), akGoalText(it("influch"))], ["주 4건", "100% (1개월 내)", "실패 건별 3회", "분기 1건"]);

eq("9/28 시작한 월간 항목의 9월은 참고용", akPartial(it("influrv"), akWeeksIn(2026, 8)), true);
eq("10월은 정상 집계", akPartial(it("influrv"), akWeeksIn(2026, 9)), false);
eq("주간 항목은 해당 없음", akPartial(it("c_b2c"), akWeeksIn(2026, 8)), false);
// ④ 담당자 찾기 — id 우선, 없으면 이름 끝글자
const users = [{ id: "songhee", name: "김송희" }, { id: "ran", name: "이란" }, { id: "chaerim", name: "양채림" }, { id: "minji", name: "김민지" }, { id: "TC51U2cdFnn6Q5Y7A6o9", name: "윤미니" }, { id: "GM", name: "허지은" }, { id: "gK", name: "김소연" }];
eq("미니 → 윤미니", akWho(users, it("ref")), ["TC51U2cdFnn6Q5Y7A6o9"]);
eq("id 없으면 이름으로: 란 → 이란", akWho(users, { who: ["x"], whoNames: ["란"] }), ["ran"]);
eq("겹치는 이름은 안 고름", akWho([{ id: "a", name: "김지" }, { id: "b", name: "이지" }], { whoNames: ["지"] }), []);

// ⑤ 결과 KPI 현재값
eq("입력 없으면 엑셀 기준값", lagCur(LAG_SEED[0]), { v: 2728, ym: null });
eq("가장 최근 달 값", lagCur({ ...LAG_SEED[0], monthly: { "2026-10": { v: 3100 }, "2026-11": { v: 3300 } } }), { v: 3300, ym: "2026-11" });
eq("달성률", lagPct(LAG_SEED[0], 3000), 75);
eq("목표 미정은 null", lagPct(LAG_SEED[5], 10), null);

// ⑥ 권한
eq("기본 마스터 4명", users.filter(isMaster).map((u) => u.name), ["김송희", "이란", "허지은", "김소연"]);
eq("마스터 해제하면 팀원", isMaster({ name: "이란", master: false }), false);
eq("팀원 권한은 켜준 것만", [can({ name: "양채림", perms: { kpiLag: true } }, "kpiLag"), can({ name: "양채림" }, "kpiCore")], [true, false]);
eq("마스터는 모든 권한", can({ name: "허지은" }, "proxy"), true);

// ⑦ PIN 해시 — node crypto 와 같은 값
const h = (s) => createHash("sha256").update(s).digest("hex");
eq("sha256 빈 문자열", sha256(""), h(""));
eq("sha256 abc", sha256("abc"), h("abc"));
eq("sha256 한글·긴 문자열", sha256("마스터 PIN 테스트 ".repeat(20)), h("마스터 PIN 테스트 ".repeat(20)));
eq("PIN 해시는 사람마다 다름", pinHash("songhee", "1234") !== pinHash("ran", "1234"), true);

// ⑧ 월말 회고 — 매월 마지막 평일
eq("10월 회고일 10/30(금)", akRetroDay(2026, 9), "2026-10-30");
eq("5월 회고일 5/29(금) — 5/31 일요일", akRetroDay(2026, 4), "2026-05-29");
eq("10/20엔 알림 없음", akRetroDue("2026-10-20", [{ kind: "teamMonthly", month: "2026-09" }]), null);
eq("10/27부터 이번 달 회고 알림", akRetroDue("2026-10-27", [{ kind: "teamMonthly", month: "2026-09" }]), { ym: "2026-10", y: 2026, m0: 9, day: "2026-10-30", late: false });
eq("11/3 · 10월 회고 안 했으면 계속", akRetroDue("2026-11-03", []).ym, "2026-10");
eq("11/3 · 10월 회고 했으면 없음", akRetroDue("2026-11-03", [{ kind: "teamMonthly", month: "2026-10" }]), null);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
