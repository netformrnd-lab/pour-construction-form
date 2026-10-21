// node src/feeds.test.mjs — 결과 숫자 들어온 날 · 비면 n일째 (③ · 2026-10-17 · 계산만)
import { feedRows, feedInbox, lagText, adChecker, LAG } from "./feeds.js";
import { PAUSE as PAUSE_SW } from "../../marketing-hub/crew.js"; PAUSE_SW.on = "";   // ⏸ 자동화 멈춤(2026-10-21) — 이 시험은 켜진 동작을 봄 (멈춤은 aiask.test 맨 아래)
let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) ok++; else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };
const users = [{ id: "sh", name: "김송희", role: "lead", master: true }, { id: "mj", name: "김민지" }, { id: "yj", name: "남윤정" }, { id: "cr", name: "양채림" }];
const MON = new Date("2026-10-19T10:00:00"), SAT = new Date("2026-10-17T10:00:00");
const base = (o = {}) => ({ users, loaded: true, tasks: [{ id: "fx_ad", title: "광고 확인", isFixed: true, assigneeId: "mj", assigneeIds: ["mj"] }],
  kpi: { sales: { "crm-pourstore": { checkedAt: "2026-10-19T00:30:00Z", daysTo: "2026-10-16", daysHash: "a" }, grohome: { daysTo: "2026-10-16", daysHash: "b", checkedAt: "2026-10-19T00:00:00Z" } } },
  ai: { boards: {}, mates: {} }, feeds: { ads: { last: "2026-10-16" }, hub: { counts: { stockUpTo: "2026-10-07", salesUpTo: "", adsUpTo: "" } } }, ...o });
const R = (D, now = MON) => Object.fromEntries(feedRows(D, now).map((r) => [r.key, r]));
let r = R(base());
ck("CRM 판매 = 오늘 확인 · 판매 10/16까지 · 괜찮음", !r.crm.bad && r.crm.last === "2026-10-19" && r.crm.sale === "2026-10-16" && lagText(r.crm) === "10/19");
ck("그로홈 판매 10/16 = 평일 1일 · 괜찮음 (3일부터)", !r.gh.bad && r.gh.lag === 1 && LAG.gh === 3, r.gh);
ck("광고 보고서 10/16(금) → 월요일 평일 1일 · 괜찮음", !r.ads.bad && r.ads.lag === 1, r.ads);
ck("허브 리포트(Aside) 재고 10/7 → 평일 7일째(10/9 한글날 빼고) · 비어 있음", r.hub.bad && r.hub.last === "2026-10-07" && lagText(r.hub) === "10/7 · 평일 7일째", lagText(r.hub));
r = R(base({ kpi: { sales: { "crm-pourstore": { at: "2026-10-01T00:00:00Z", months: {} }, grohome: { rows: [] } } } }));
ck("새 다리 전(checkedAt·daysHash 없음) = 첫 숫자 기다리는 중 · 경고 안 함", !r.crm.bad && r.crm.wait && !r.gh.bad && r.gh.wait && lagText(r.crm) === "첫 숫자 기다리는 중");
r = R(base({ kpi: { sales: {} } }));
ck("문서가 아예 없으면 없음 · 비어 있음", r.crm.bad && r.gh.bad && lagText(r.crm) === "없음");
r = R(base({ kpi: { sales: { "crm-pourstore": { checkedAt: "2026-10-14T03:00:00Z", daysHash: "a" }, grohome: { daysTo: "2026-10-13", daysHash: "b" } } }, feeds: { ads: { last: "" }, hub: { counts: {}, err: true } } }));
ck("CRM 10/14 확인 뒤 멈춤(평일 3일) · 그로홈 10/13(평일 4일) · 광고 없음 · 허브 못 읽음 = 확인 못 함(경고 안 함)", r.crm.bad && r.gh.bad && r.ads.bad && !r.hub.bad && lagText(r.hub) === "확인 못 함", [r.crm.lag, r.gh.lag]);
ck("광고 보고서·허브 리포트를 안 읽은 기기 = 그 줄 없음", !R(base({ feeds: {} })).ads && !R(base({ feeds: {} })).hub);
// 보드 지표: [상태]만 올라오고 지표가 2번 넘게 빔 → 그 AI 담당 · 지표가 들어오면 없음 · 3주 넘게 안 돈 보드는 없음
const boards = { "gh-conv": { at: "2026-10-16T01:00:00Z", hist: { cv_mall: { "2026-10-13": 6.1 } }, metrics: { cv_mall: { v: 6.1, date: "2026-10-13" } } }, "gh-rep": { at: "2026-10-16T01:00:00Z", hist: { rep: { "2026-10-16": 3 } } }, "gh-exp": { at: "2026-09-01T00:00:00Z", hist: {} } };
const DB = base({ ai: { boards, mates: { gyeoul: { owners: { grohome: "yj" } } } } }); r = R(DB);
ck("겨울 보드 지표 10/13 뒤 3번 비어 있음 (10/14·15·16) · 담당 남윤정", r["board:gh-conv"] && r["board:gh-conv"].who === "yj" && r["board:gh-conv"].lag === 3 && lagText(r["board:gh-conv"]) === "10/13 뒤 3번 비어 있음", r["board:gh-conv"]);
ck("지표가 들어온 보드·오래 안 돈 보드는 줄 없음", !r["board:gh-rep"] && !r["board:gh-exp"]);
const B2 = { "gh-aov": { at: "2026-10-14T00:10:00Z", hist: { aov: { "2026-10-12": 1 } } }, "gh-traffic": { at: "2026-10-19T00:10:00Z", status: { A: "대기" } }, "gh-ohou": { at: "2026-10-19T00:10:00Z", hist: { a: { "2026-10-15": 1 } } } };
r = R(base({ ai: { boards: B2, mates: {} } }));
ck("10/14 뒤 안 돈 보드(돌 날 10/15·16 놓침) = 지표 줄 없음 · 'AI 안 돎' 줄이 맡음", !r["board:gh-aov"], r["board:gh-aov"]);
ck("돌긴 하는데 지표가 한 번도 없음 = 바로 '아직 없음' · 담당 없으면 관리자", r["board:gh-traffic"] && r["board:gh-traffic"].bad && lagText(r["board:gh-traffic"]) === "아직 없음" && r["board:gh-traffic"].who === "master", r["board:gh-traffic"]);
ck("지표 10/15 뒤 2번(10/16·10/19) 비어 있음 = 줄 · 지표 날짜 = 올린 날", r["board:gh-ohou"] && r["board:gh-ohou"].lag === 2 && lagText(r["board:gh-ohou"]) === "10/15 뒤 2번 비어 있음", r["board:gh-ohou"]);
// '확인할 것'
const ids = (uid, D = DB, now = MON, seen) => feedInbox(D, uid, now, seen || {}).map((x) => x.title);
ck("관리자 '확인할 것' = 담당 없는 보드 지표 줄 2개 따로", ids("sh", base({ ai: { boards: B2, mates: {} } })).filter((t) => /지표/.test(t)).length === 2, ids("sh", base({ ai: { boards: B2, mates: {} } })));
ck("관리자 = 한 줄 '결과 숫자 n곳 비어 있음' (허브 리포트) + 담당 없는 보드는 관리자", JSON.stringify(ids("sh", base())) === JSON.stringify(["결과 숫자 1곳 비어 있음"]), ids("sh", base()));
ck("보드 담당(남윤정) = 지표 줄만 · 관리자 줄 없음", JSON.stringify(ids("yj")) === JSON.stringify(["겨울(AI) 전환 보드 지표 3번째 비어 있음"]), ids("yj"));
const DA = base({ feeds: { ads: { last: "2026-10-14" }, hub: { counts: { salesUpTo: "2026-10-16" } } } });
ck("'광고 확인' 담당(김민지) = 광고 보고서 줄 · 다른 팀원은 없음", JSON.stringify(ids("mj", DA)) === JSON.stringify(["광고 일일 보고서 (Aside) 비어 있음"]) && ids("cr", DA).length === 0 && adChecker(DA, "mj") && !adChecker(DA, "cr"), [ids("mj", DA), ids("cr", DA)]);
ck("읽음 표시 = 오늘 하루 숨김 · 쉬는 날은 없음", ids("sh", base(), MON, { [feedInbox(base(), "sh", MON)[0].id]: true }).length === 0 && ids("sh", base(), SAT).length === 0);
const line = feedInbox(base(), "sh", MON)[0];
ck("줄 모양: kind feed · 태그 결과 숫자 · 글 = 짧은 이름 + n일째", line.kind === "feed" && line.tag === "결과 숫자" && line.text === "허브 리포트 10/7 · 평일 7일째" && !line.keep, line);
console.log(`${ok}/${ok + bad} 통과${bad ? ` · ${bad} 실패` : ""}`); if (bad) process.exit(1);
