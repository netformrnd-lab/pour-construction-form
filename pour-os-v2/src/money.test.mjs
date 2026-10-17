// node src/money.test.mjs — 돈·결재 알림 (계산만 · 2026-10-17 · 날짜 = 기기 시각)
import { moneyInbox, MONEY_FX, MONEY_LEAD, MONEY_LATE, ORD_RED } from "./money.js";
import { todayView } from "./model.js";
let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) ok++; else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };
const fx = (id, title, who, o = {}) => ({ id, title, isFixed: true, type: "fixed", status: "todo", assigneeId: who, assigneeIds: [who], brand: "common", createdAt: "2026-09-01T00:00:00.000Z", ...o });
const T = [fx("t1790918718994", "시온 월말 정산", "ran", { recurType: "monthly", monthEnd: true }), fx("t1790831555155", "부서 월간 고정지출 품의", "sh", { recurType: "monthly", monthDay: 20, fixedTime: "09:00" }),
  fx("t1790728334599", "하이웍스 품의 확인", "sh", { recurType: "daily", fixedTime: "10:00" }), fx("tx_other", "다른 고정업무", "sh", { recurType: "daily" }), fx("tmuxe3zc8mukt", "3pl 정산서 확인 및 정산", "mini", { recurType: "monthly", monthEnd: true, assigneeIds: ["mini", "sh"] })];
const D = (tasks) => ({ tasks: tasks || T });
const at = (s) => new Date(s);
const L = (uid, now, tasks) => moneyInbox(D(tasks), uid, at(now)).map((x) => [x.taskId, x.title, !!x.red]);
ck("7건 정의 · 마감 3평일 · 지난달 5평일", Object.keys(MONEY_FX).length === 7 && MONEY_LEAD === 3 && MONEY_LATE === 5);
// 매월 말일(10/30 금 = 10월 마지막 평일)
ck("말일 정산: 평일 4일 넘게 남음 = 없음", L("ran", "2026-10-23T10:00:00").length === 0, L("ran", "2026-10-23T10:00:00"));
ck("말일 정산: 평일 3일 남음 = 한 줄", JSON.stringify(L("ran", "2026-10-27T10:00:00")) === JSON.stringify([["t1790918718994", "시온 월말 정산 · 마감 10/30 · 평일 3일 남음", false]]), L("ran", "2026-10-27T10:00:00"));
ck("말일 정산: 오늘 마감", L("ran", "2026-10-30T09:00:00")[0][1] === "시온 월말 정산 · 오늘 마감", L("ran", "2026-10-30T09:00:00"));
ck("이번 달 체크했으면 없음", L("ran", "2026-10-30T09:00:00", [{ ...T[0], doneDates: { ran: "2026-10-29" } }]).length === 0);
ck("지난달 말일을 못 했으면 새 달 평일 5일 동안 빨강 · 그 뒤 없음 · 이번 달 체크하면 없음", JSON.stringify(L("ran", "2026-11-03T10:00:00")) === JSON.stringify([["t1790918718994", "시온 월말 정산 · 지난달 마감 지남 (10/30)", true]]) && L("ran", "2026-11-09T10:00:00").length === 0 && L("ran", "2026-11-03T10:00:00", [{ ...T[0], doneDates: { ran: "2026-11-02" } }]).length === 0, [L("ran", "2026-11-03T10:00:00"), L("ran", "2026-11-09T10:00:00")]);
ck("지난달에 했으면 새 달엔 없음", L("ran", "2026-11-03T10:00:00", [{ ...T[0], doneDates: { ran: "2026-10-30" } }]).length === 0);
ck("만들기 전 마감은 안 셈", L("ran", "2026-11-03T10:00:00", [{ ...T[0], createdAt: "2026-11-01T00:00:00.000Z" }]).length === 0);
// 실데이터 (2026-10-17): 3PL 정산서 = 매월 5일(10/5 대체공휴일 → 10/2) · 10/7 에 만듦 → 이번 달은 '마감 지남' 아님 · 다음 달 11/5 평일 3일 전부터
const pl = { ...T[4], monthEnd: false, monthDay: 5, createdAt: "2026-10-07T00:49:24.392Z" };
ck("만든 날이 이번 달 마감 뒤 = 이번 달 줄 없음 · 다음 달 마감 앞 3평일부터", L("mini", "2026-10-19T10:00:00", [pl]).length === 0 && L("mini", "2026-10-30T10:00:00", [pl]).length === 0 && JSON.stringify(L("mini", "2026-11-02T10:00:00", [pl])) === JSON.stringify([["tmuxe3zc8mukt", "3pl 정산서 확인 및 정산 · 마감 11/5 · 평일 3일 남음", false]]), [L("mini", "2026-10-19T10:00:00", [pl]), L("mini", "2026-11-02T10:00:00", [pl])]);
ck("만든 날이 없는 예전 것 = 이번 달 체크가 없으면 마감 지남 (시온 · 10/5 대체공휴일 → 10/2)", JSON.stringify(L("ran", "2026-10-19T10:00:00", [{ ...T[0], monthEnd: false, monthDay: 5, createdAt: undefined }])) === JSON.stringify([["t1790918718994", "시온 월말 정산 · 마감 지남 (10/2)", true]]), L("ran", "2026-10-19T10:00:00", [{ ...T[0], monthEnd: false, monthDay: 5, createdAt: undefined }]));
// 매월 20일 (10/20 화)
ck("20일 품의: 마감 지나고 체크 전 = 빨강 · 그 전 3평일 = 한 줄", L("sh", "2026-10-21T11:30:00").some((x) => x[1] === "부서 월간 고정지출 품의 · 마감 지남 (10/20)" && x[2]) && L("sh", "2026-10-15T11:30:00").some((x) => x[1] === "부서 월간 고정지출 품의 · 마감 10/20 · 평일 3일 남음"), [L("sh", "2026-10-21T11:30:00"), L("sh", "2026-10-15T11:30:00")]);
// 매일 10:00
ck("매일 10:00: 11:00 전엔 없음 · 11:00 넘고 체크 전 = 한 줄 · 체크하면 없음 · 쉬는 날 없음", !L("sh", "2026-10-21T10:59:00").some((x) => x[0] === "t1790728334599") && L("sh", "2026-10-21T11:01:00").some((x) => x[1] === "하이웍스 품의 확인 · 아직 체크 전 (10:00)") && !L("sh", "2026-10-21T11:01:00", [{ ...T[2], doneDates: { sh: "2026-10-21" } }]).length && !L("sh", "2026-10-24T11:01:00").some((x) => x[0] === "t1790728334599"));
ck("다른 고정업무·남의 것·멈춘 것·없앤 것은 없음", !L("sh", "2026-10-21T11:01:00").some((x) => x[0] === "tx_other") && L("yj", "2026-10-27T11:00:00").length === 0 && !L("sh", "2026-10-21T11:01:00", [{ ...T[2], paused: true }]).length && !L("sh", "2026-10-21T11:01:00", [{ ...T[2], removed: { at: "x" } }]).length);
ck("여러 담당 정산서 = 둘 다에게 (각자 체크)", L("mini", "2026-10-28T10:00:00").length === 1 && L("sh", "2026-10-28T10:00:00").some((x) => x[0] === "tmuxe3zc8mukt") && !L("sh", "2026-10-28T10:00:00", [{ ...T[4], doneDates: { sh: "2026-10-28" } }]).length && L("mini", "2026-10-28T10:00:00", [{ ...T[4], doneDates: { sh: "2026-10-28" } }]).length === 1);
const x0 = moneyInbox(D(), "ran", at("2026-10-27T10:00:00"))[0];
ck("줄 모양: 정산·결재 · 끝낼 때까지(keep) · 누르면 그 고정업무 · 금액 말 없음", x0.kind === "money" && x0.tag === "정산·결재" && x0.keep && x0.taskId === "t1790918718994" && x0.id === "mn:t1790918718994:2026-10-30" && !/\d+\s*원|금액:/.test(x0.title + x0.text) && x0.text.includes("금액은 업무OS 에 쓰지 않아요"), x0);
// [완료] 버튼 · 빨강 위로 · 지난달 줄은 읽음으로 닫음 (2026-10-17)
const R = (uid, now, tasks) => moneyInbox(D(tasks), uid, at(now));
const late = R("sh", "2026-10-21T11:30:00").find((x) => x.taskId === "t1790831555155"), last = R("ran", "2026-11-03T10:00:00")[0], soon = R("ran", "2026-10-27T10:00:00")[0], day = R("sh", "2026-10-21T11:01:00").find((x) => x.taskId === "t1790728334599");
ck("마감 지남 = 빨강 · 위로(ord) · [완료] · 끝낼 때까지", late.red && late.ord === ORD_RED && late.chk && late.keep, late);
ck("마감 전·오늘 마감·매일 = [완료] · 빨강 아님", soon.chk && !soon.red && soon.keep && day.chk && !day.red && day.keep, [soon, day]);
ck("지난달 마감 지남 = 빨강 · [완료] 없음 · 읽음으로 닫음(keep 아님)", last.red && !last.chk && last.keep === false && last.ord === ORD_RED && last.text.includes("읽음 표시로 닫기"), last);
// 오늘 화면 '확인할 것' (model.todayView 가 D.moneyInbox 로 받음 · 순환 import 피하려고)
const users = [{ id: "sh", name: "김송희" }, { id: "ran", name: "이란" }, { id: "mini", name: "윤미니" }];
const DV = (tasks) => ({ users, projects: [], notes: [], tasks: tasks || T, moneyInbox });
const kinds = (uid, now, seen, tasks) => todayView(DV(tasks), uid, at(now), seen || {}).inbox.filter((x) => x.kind === "money").map((x) => x.id);
ck("확인할 것에 줄 · D.moneyInbox 없으면 없음", kinds("ran", "2026-10-27T10:00:00").length === 1 && !todayView({ users, projects: [], notes: [], tasks: T }, "ran", at("2026-10-27T10:00:00")).inbox.some((x) => x.kind === "money"));
ck("읽음 표시: 끝낼 때까지 줄은 그대로 · 지난달 줄은 숨김", kinds("ran", "2026-10-27T10:00:00", { "mn:t1790918718994:2026-10-30": true }).length === 1 && kinds("ran", "2026-11-03T10:00:00", { "mn:t1790918718994:2026-10-30": true }).length === 0);
const iv = todayView(DV(), "sh", at("2026-10-21T11:30:00"), {}).inbox.filter((x) => x.kind === "money");
ck("빨강(마감 지남) 줄이 매일 줄보다 위", iv.length === 2 && iv[0].red && iv[0].taskId === "t1790831555155" && iv[1].taskId === "t1790728334599", iv.map((x) => x.title));
console.log(`${ok}/${ok + bad} 통과${bad ? ` · ${bad} 실패` : ""}`); if (bad) process.exit(1);
