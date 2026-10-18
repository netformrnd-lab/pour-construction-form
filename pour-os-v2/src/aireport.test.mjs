// node src/aireport.test.mjs — AI 크루 보고서 계산 (주기 · 기간 · 칸 · 사람 · 숫자 · '확인할 것' · 글) · 저장 없음
import * as R from "./aireport.js";
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log("✗", name, "\n  got ", JSON.stringify(got), "\n  want", JSON.stringify(want)); } else console.log("✓", name); };

// 사람: 남윤정(1팀) → 김소연(1팀 리드) → 허지은(본부장) · 김민지(2팀) → 김송희(2팀 리드 · 역할 lead) → 허지은 · 김채원(3팀 리드) → 허지은
const U = [["yj", "남윤정", "sy"], ["sy", "김소연", "hj"], ["hj", "허지은", ""], ["mj", "김민지", "sh"], ["sh", "김송희", "hj"], ["cw", "김채원", "hj"], ["off", "쉬는사람", "sy"]]
  .map(([id, name, bossId]) => ({ id, name, bossId, role: id === "sh" ? "lead" : "member", active: id !== "off" }));

// ① 주기 · 기간 (마감 = 금요일)
eq("기본 = 주간 · 2026-10-12 부터", R.cycleOf({ settings: [] }), { cycle: "week", from: "2026-10-12", at: "", byName: "" });
eq("설정 = 월간 · 바꾼 주 월요일", R.cycleOf({ settings: [{ id: "aicrew", reportCycle: { cycle: "month", from: "2026-11-04", byName: "허지은" } }] }).from, "2026-11-02");
eq("이상한 주기 = 주간", R.cycleOf({ settings: [{ id: "aicrew", reportCycle: { cycle: "year" } }] }).cycle, "week");
const W = { cycle: "week", from: "2026-10-12" };
eq("주간: 월~일 · 금 마감", R.periodOf(W, "2026-10-15"), { cycle: "week", start: "2026-10-12", end: "2026-10-18", due: "2026-10-16" });
eq("주간: 일요일도 그 주", R.periodOf(W, "2026-10-18").start, "2026-10-12");
eq("지난·다음 기간", [R.prevPeriod(W, R.periodOf(W, "2026-10-15")).start, R.nextPeriod(W, R.periodOf(W, "2026-10-15")).start], ["2026-10-05", "2026-10-19"]);
const T2 = { cycle: "2week", from: "2026-10-12" };
eq("2주: 바꾼 주부터 14일씩 · 둘째 주 금 마감", [R.periodOf(T2, "2026-10-24"), R.periodOf(T2, "2026-10-28").start, R.periodOf(T2, "2026-10-09").start], [{ cycle: "2week", start: "2026-10-12", end: "2026-10-25", due: "2026-10-23" }, "2026-10-26", "2026-09-28"]);
const M = { cycle: "month", from: "2026-10-12" };
eq("월간: 그 달 · 마지막 금요일 마감", [R.periodOf(M, "2026-10-15"), R.periodOf(M, "2026-07-02").due, R.periodOf(M, "2027-02-11").end], [{ cycle: "month", start: "2026-10-01", end: "2026-10-31", due: "2026-10-30" }, "2026-07-31", "2027-02-28"]);
eq("월간 마감은 늘 그 달 마지막 금요일", Array.from({ length: 12 }, (_, i) => { const p = R.periodOf(M, `2026-${String(i + 1).padStart(2, "0")}-10`), d = new Date(p.due + "T00:00:00"); return d.getDay() === 5 && p.due.slice(0, 7) === p.start.slice(0, 7) && new Date(d.getTime() + 7 * 864e5).getMonth() !== d.getMonth(); }).every(Boolean), true);
eq("저장된 보고서 기간 그대로", [R.periodOfDoc({ cycle: "week", start: "2026-10-12", end: "2026-10-18", due: "2026-10-16" }), R.periodOfDoc({ start: "x" })], [{ cycle: "week", start: "2026-10-12", end: "2026-10-18", due: "2026-10-16" }, null]);
eq("글: 기간 · 마감", [R.periodL(R.periodOf(W, "2026-10-15")), R.dueL(R.periodOf(W, "2026-10-15"))], ["10/12~10/18", "금 10/16 마감"]);

// ② 크루 칸 — 보드가 있는 칸만 (B2B·바라스데이 크루는 아직 없음 · 2026-10-15 '13번은 냅둬')
eq("B2C 7칸(AARRR 순서 · 봄 = 매출 볼륨(2026-10-17 사장님 정의)) + 맨 위 공통 숫자(별) · 이음·달 빼고 · B2B 크루(보드 있어도 noReport)·바라스데이 없음", [R.repSlots("b2c").map((m) => `${m.slot}:${m.name}`), R.repSlots("b2b").length, R.repSlots("bd").length, R.repCrews().map((c) => c.id)], [["공통 숫자:별", "유입:여름", "유입:가을", "전환:겨울", "재구매:우주", "매출:하늘", "매출:봄", "지인추천:바람"], 0, 0, ["b2c"]]);
eq("보고서 id = 크루-기간 시작", R.repId("b2c", R.periodOf(W, "2026-10-15")), "b2c-2026-10-12");

// ③ 칸 사람 — 담당(AI 담당) · 같이 쓰는 사람(할 일 담당) · 리드(담당 위 첫 리드 · 없으면 담당이 바로)
const mates = { gyeoul: { owners: { grohome: "yj" }, actOwners: { B: "mj", C: "mj", D: "off" }, actAk: { C: "x_rv" } }   /* 짝 = 지금 있는 할 일(C) · 겨울 E 는 2026-10-17 바람 D 로 */, yeoreum: { owners: { _: "cw" } }, haneul: { owners: { grohome: "hj" } } };
const D0 = { users: U, settings: [], ai: { mates, boards: {}, asks: [], reports: {} }, tasks: [], ak: { items: [{ id: "x_rv", name: "리뷰 신고·답글" }] } };
const slot = (id) => R.repSlots("b2c").find((m) => m.id === id);
eq("겨울: 담당 남윤정 · 같이 김민지(쉬는 사람 빼고) · 리드 김소연", R.secPeople(D0, slot("gyeoul")), { owner: "yj", writers: ["yj", "mj"], lead: "sy" });
eq("여름: 담당이 리드(김채원) = 본인이 보냄", R.secPeople(D0, slot("yeoreum")), { owner: "cw", writers: ["cw"], lead: "cw" });
eq("하늘: 담당이 본부장 = 위 리드 없음 → 본인", R.secPeople(D0, slot("haneul")).lead, "hj");
eq("봄: 담당 미정 = 아무도 없음", R.secPeople(D0, slot("bom")), { owner: "", writers: [], lead: "" });
eq("리드 찾기: 김민지 → 김송희(역할 lead) · 리드 본인 · 본부장", [R.leadOf(U, "mj"), R.leadOf(U, "sy"), R.leadOf(U, "hj")], ["sh", "sy", ""]);
eq("본부장 = 허지은", R.hqOfUsers(U), "hj");
eq("쓸 수 있는 사람: 담당·같이·리드·관리자 · 다른 팀 리드는 못 씀", ["yj", "mj", "sy", "sh", "cw"].map((id) => R.canWriteSec(D0, U.find((u) => u.id === id), slot("gyeoul"))), [true, true, true, true, false]);   // 김송희 = 관리자(역할 lead)
eq("관리자 아닌 다른 팀 사람은 못 씀", R.canWriteSec(D0, { id: "zz", name: "아무개", role: "member" }, slot("gyeoul")), false);

// ④ 칸 숫자 — 실행 업무(이번 기간 끝냄 · 남음) · 흔적(이번 기간 날짜만) · 승인 · 보드 지표(이번 ← 지난) · KPI 짝 · AI 다음
const P = R.periodOf(W, "2026-10-15"), PV = R.prevPeriod(W, P);
const tk = (id, o) => ({ id, title: `실행 · 겨울 ${id}`, aiAsk: "ai_" + id, aiMate: "gyeoul", status: "todo", assigneeId: "yj", ...o });
const D1 = { ...D0, tasks: [
  tk("e1", { status: "done", doneAt: "2026-10-14T03:00:00.000Z", aiAk: "x_rv", aiTrace: { E1: { done: true, link: "https://coupang.test/1", date: "2026-10-14" }, E2: { skip: true, note: "권한 없음", date: "2026-10-14" } } }),
  tk("e0", { status: "done", doneAt: "2026-10-08T03:00:00.000Z", aiAk: "x_rv", aiTrace: { E1: { done: true, date: "2026-10-08" } } }),   // 지난주
  tk("b1", { aiTrace: { B1: { done: true, link: "https://wing.test/9", date: "2026-10-13" } } }),   // 아직 열림 · 흔적 하나
  tk("x1", { status: "dropped" }), { id: "t9", title: "다른 일", status: "done", doneAt: "2026-10-14T03:00:00.000Z" },
  tk("p1", { aiMate: "pori", status: "done", doneAt: "2026-10-13T03:00:00.000Z" }) ],
  ai: { ...D0.ai, boards: { "gh-conv": { hist: { cv_mall: { "2026-10-09": 6.1, "2026-10-13": 7.0, "2026-10-15": 7.4 }, cv_cp: { "2026-10-14": 2.4 } }, nextHist: { "2026-10-09": "- 지난주 계획", "2026-10-16": "- 롤러 재입고 알림\n- 상세 첫 화면" } } } } };
const asks = [{ mate: "gyeoul", run: "2026-10-13", state: "ok", okAt: "2026-10-14T01:00:00.000Z" }, { mate: "gyeoul", run: "2026-10-14", state: "no", noAt: "2026-10-14T02:00:00.000Z" },
  { mate: "gyeoul", run: "2026-10-15", state: "wait" }, { mate: "gyeoul", run: "2026-10-15", act: "R", state: "back" }, { mate: "gyeoul", run: "2026-10-08", state: "ok", okAt: "2026-10-09T01:00:00.000Z" }, { mate: "bom", run: "2026-10-14", state: "wait" }];
const d = R.secData(D1, slot("gyeoul"), P, PV, asks);
eq("실행: 이번 기간 끝낸 실행 업무 1 · 남은 1 (버린 것·다른 일·지난주 빼고)", [d.doneN, d.done.map((x) => x.id), d.openN], [1, ["e1"], 1]);
eq("흔적: 이번 기간 했어요 2 · 안 함 1 · 링크", [d.trace.done, d.trace.skip, d.trace.links.map((x) => x.link)], [2, 1, ["https://coupang.test/1", "https://wing.test/9"]]);
eq("승인: 올라옴 4 · 승인 1 · 안 함 1 · 열린 것 2 · 맡긴 일 1", d.asks, { made: 4, ok: 1, no: 1, open: 2, req: 1 });
const cv = d.metrics.find((x) => x.k === "cv_mall");
eq("결과: 자사몰 전환 7.4% ← 6.1% · 목표", [cv.cur, cv.prev, R.metricLine(cv), R.trend(cv)], [{ v: 7.4, date: "2026-10-15" }, { v: 6.1, date: "2026-10-09" }, `7.4% ← 6.1% · 목표 ${cv.target}% ✓`, 1]);
eq("값 없는 지표 = —", R.metricLine(d.metrics.find((x) => x.k === "bounce")).startsWith("—"), true);   // 품절(soldout)은 2026-10-17 이음으로
eq("KPI: 짝지은 반복 실행 = 이번 기간 [했어요] 수", d.ak, [{ id: "x_rv", name: "리뷰 신고·답글", n: 1 }]);
eq("다음: AI [다음주] = 이번 기간 마지막", [d.aiNext, d.aiNextRun], ["- 롤러 재입고 알림\n- 상세 첫 화면", "2026-10-16"]);
// 2026-10-17 사장님 확정 — 단계 숫자 하나(1A) · 넘겨받은 것(넘기기 A)
eq("겨울 단계 숫자 = 구매전환율 (자사몰) 7.4% ← 6.1%", [d.stage.l, d.stage.slot, d.stage.vals.map((x) => [x.k, x.cur && x.cur.v, x.prev && x.prev.v])], ["구매전환율", "전환", [["cv_mall", 7.4, 6.1]]]);
{ const D2 = { ...D1, ai: { ...D1.ai, boards: { ...D1.ai.boards, "gh-traffic": { hist: { visit7: { "2026-10-15": 12340, "2026-10-08": 11020 } } }, "gh-conv": { hist: { ...D1.ai.boards["gh-conv"].hist, inq7: { "2026-10-14": 85 } } } } } };
  const ho = [{ id: "h1", mate: "ieum", act: "F", state: "ok", okAt: "2026-10-14T05:00:00.000Z", title: "재고 F · 품절 1", items: [{ n: "F1", c: {} }] }, { id: "h2", mate: "ieum", act: "F", state: "ok", okAt: "2026-10-08T05:00:00.000Z", title: "지난주" }, { id: "h3", mate: "ieum", act: "F", state: "ok", okAt: "2026-10-15T05:00:00.000Z", title: "끔", handoffOff: { by: "x" } }];
  const y = R.secData(D2, slot("yeoreum"), P, PV, ho), g = R.secData(D2, slot("gyeoul"), P, PV, [...asks, ...ho]);
  eq("여름 단계 숫자 = 방문(가을 보드) + 문의(겨울 보드) · 한 줄", [y.stage.vals.map((x) => x.cur && x.cur.v), R.stageLine(y.stage)], [[12340, 85], "방문·문의 수: 자사몰·스마트스토어 방문 12,340회 ← 11,020회 · 구매 전 문의 85건"]);
  eq("넘겨받은 것 = 이번 기간 최종 승인 · 끈 것·지난주 빼기 · 여름은 이음 F 안 받음", [g.inbox.map((x) => [x.id, x.name, x.act, x.at, x.n]), y.inbox], [[["h1", "이음", "F", "2026-10-14", 1]], []]);
  const tx = R.repText(R.repCrews()[0], P, [{ m: slot("gyeoul"), d: g, s: {} }], {});
  eq("글로 복사: 단계 숫자 · 넘겨받은 것 줄", [tx.includes("- 단계 숫자 구매전환율: 7.4% ← 6.1% · 목표"), tx.includes("- 넘겨받은 것: 이음 F 10/14 재고 F · 품절 1")], [true, true]);
  eq("단계 밖(별) = 단계 숫자 없음", R.secData(D2, slot("byeol"), P, PV, []).stage, null); }
eq("여름 = 옛 포리 실행 업무도 (쉬는 팀원 → 여름)", R.secData(D1, slot("yeoreum"), P, PV, []).doneN, 1);
// 변화 없음 (2026-10-17 사장님 2A "할 것이 있을 때만 승인 · 없으면 상태 한 줄 · 금요일 보고에 '변화 없음 n번'")
{ const bq = { "gh-conv": { stHist: { "2026-10-12": { A: "변화 없음", C: "표 올림" }, "2026-10-13": { A: "변화 없음", B: "막힘: 로그인", R: "맡긴 일 하는 중" }, "2026-10-14": { A: "누락 0" }, "2026-10-08": { A: "변화 없음" } }, actHist: { "2026-10-12": { C: true } } } };
  const Dq = { ...D1, ai: { ...D1.ai, boards: bq } }, aq = [{ mate: "gyeoul", board: "gh-conv", act: "A", run: "2026-10-14", state: "wait" }];
  const q = R.secData(Dq, slot("gyeoul"), P, PV, aq);
  eq("변화 없음 = 이번 기간 [상태]만 남긴 할 일 (결과 올린 날·막힘·맡긴 일·지난주 빼고 · 불러온 승인 건도 봄)", q.quiet, { A: 2 });
  eq("보고 글에 '변화 없음 n번'", R.repText({ name: "B2C 크루" }, P, [{ m: slot("gyeoul"), d: q, s: {} }], {}).includes("변화 없음 2번 (A 2)"), true);
  eq("변화 없음이 없으면 글에 안 붙음", R.repText({ name: "B2C 크루" }, P, [{ m: slot("gyeoul"), d, s: {} }], {}).includes("변화 없음"), false); }

// NPS (2026-10-18 사장님 2-1A) — 바람 C 흔적 [했어요] 점수 · 기간 끝날까지 30일 · 보드 'nps' 줄 대신
{ const nt = (id, tr, o) => ({ id, title: `실행 · 바람 ${id}`, aiAsk: "ai_" + id, aiMate: "baram", aiAct: "C", status: "todo", assigneeId: "yj", aiTrace: tr, ...o });
  const Dn = { ...D0, tasks: [nt("n1", { C1: { done: true, score: 10, date: "2026-10-14" }, C2: { done: true, score: 9, date: "2026-10-13" }, C3: { done: true, score: 7, date: "2026-10-12" }, C4: { skip: true, note: "부재중", date: "2026-10-14" } }),
      nt("n2", { C1: { done: true, score: 3, date: "2026-09-15" }, C2: { done: true, score: 10, date: "2026-10-01" } }),   // 9/15 = 이번 30일(9/19~) 밖 · 지난 기간(9/12~10/11) 안
      nt("n3", { C1: { done: true, score: 0, date: "2026-10-15" } }, { status: "dropped" }),   // 중단한 업무 = 안 셈
      nt("n4", { C1: { done: true, score: 2, date: "2026-10-15" } }, { aiAct: "A" }) ],   // 다른 할 일 = 안 셈
    ai: { ...D0.ai, boards: { "gh-ref": { hist: { nps: { "2026-10-16": 40 } } } } } };
  const nd = R.secData(Dn, slot("baram"), P, PV, []);
  eq("바람 NPS = 10/18까지 30일 · 9~10 3명 · 7~8 1명 · 중단·다른 할 일·안 함 빼고", [nd.nps.from, nd.nps.to, nd.nps.cur], ["2026-09-19", "2026-10-18", { n: 4, pro: 3, mid: 1, det: 0, nps: 75 }]);
  eq("지난 기간(10/11까지 30일) = 3점·10점", nd.nps.prev, { n: 2, pro: 1, mid: 0, det: 1, nps: 0 });
  const tn = R.repText(R.repCrews()[0], P, [{ m: slot("baram"), d: nd, s: {} }], {});
  eq("글로 복사: NPS 한 줄 · 보드 'nps' 결과 줄은 안 겹침", [tn.includes("- NPS (9/19~10/18 · [했어요] 점수): NPS 75 (4명 · 추천 3 · 중립 1 · 비추천 0) ← 지난 기간 0"), tn.includes("- 결과 NPS")], [true, false]);
  eq("NPS 할 일 없는 칸(겨울) = nps 없음 · 점수 없으면 cur null", [d.nps, R.secData({ ...D0, tasks: [] }, slot("baram"), P, PV, []).nps.cur], [null, null]); }

// ⑤ 칸 상태 · '확인할 것'
const rep = (secs, extra) => ({ "b2c-2026-10-12": { id: "b2c-2026-10-12", crew: "b2c", cycle: "week", start: "2026-10-12", end: "2026-10-18", due: "2026-10-16", secs, ...extra } });
eq("칸 상태", ["none", "draft", "done", "sent"].map((k, i) => R.secState({ secs: { a: [{}, { note: "x" }, { done: { at: "t" } }, { sent: { at: "t" }, done: { at: "t" } }][i] } }, "a")), ["none", "draft", "done", "sent"]);
const ib = (D, uid, day) => R.repInbox(D, uid, new Date(day + "T10:00:00")).map((x) => [x.tag, x.btn, x.title, !!x.red]);
eq("마감 전(목) = 줄 없음", ib(D0, "yj", "2026-10-15"), []);
eq("금요일: 남윤정 = 겨울 칸 쓰기", ib(D0, "yj", "2026-10-16"), [["주간 보고", "쓰기", "겨울 칸 쓰기 · B2C 크루", false]]);
eq("금요일: 김민지(할 일 담당)도 겨울 칸 쓰기", ib(D0, "mj", "2026-10-16").map((x) => x[2]), ["겨울 칸 쓰기 · B2C 크루"]);
eq("금요일: 김소연(리드) = 1칸 보내기 · 담당 확인 0/1", R.repInbox(D0, "sy", new Date("2026-10-16T10:00:00")).map((x) => [x.btn, x.title, x.text.split(" · ")[1]]), [["보내기", "B2C 크루 1칸 → 본부장에게 보내기", "담당 확인 0/1칸"]]);
eq("금요일: 김채원 = 여름 쓰기 + 보내기(본인이 리드)", ib(D0, "cw", "2026-10-16").map((x) => x[1]), ["쓰기", "보내기"]);
eq("금요일: 본부장 = 보낸 게 없으면 줄 없음 · 하늘 담당이라 쓰기·보내기만", ib(D0, "hj", "2026-10-16").map((x) => x[1]), ["쓰기", "보내기"]);
const D2 = { ...D0, ai: { ...D0.ai, reports: rep({ gyeoul: { note: "전환 올랐음", done: { at: "2026-10-16T05:00:00.000Z", byName: "남윤정" } } }) } };
eq("담당 [다 썼어요] → 쓰기 줄 사라짐 · 리드 확인 1/1", [ib(D2, "yj", "2026-10-16").length, R.repInbox(D2, "sy", new Date("2026-10-16T10:00:00"))[0].text.includes("담당 확인 1/1칸")], [0, true]);
const D3 = { ...D0, ai: { ...D0.ai, reports: rep({ gyeoul: { done: { at: "a" }, sent: { at: "2026-10-16T07:00:00.000Z", by: "sy", byName: "김소연" } } }) } };
eq("리드가 보냄 → 리드 줄 사라짐 · 본부장 '보고 도착'", [ib(D3, "sy", "2026-10-16").length, R.repInbox(D3, "hj", new Date("2026-10-16T16:00:00")).filter((x) => x.btn === "읽기").map((x) => [x.tag, x.title, x.whoName])], [0, [["보고 도착", "B2C 크루 주간 보고 · 1/8칸", "김소연"]]]);
const D4 = { ...D0, ai: { ...D0.ai, reports: rep({ gyeoul: { sent: { at: "2026-10-16T07:00:00.000Z", byName: "김소연" } } }, { read: { by: "hj", at: "2026-10-16T08:00:00.000Z" } }) } };
eq("본부장 [읽었어요] → 사라짐 · 그 뒤 또 보내면 다시", [R.repInbox(D4, "hj", new Date("2026-10-16T16:00:00")).filter((x) => x.btn === "읽기").length,
  R.repInbox({ ...D4, ai: { ...D4.ai, reports: rep({ gyeoul: { sent: { at: "2026-10-16T07:00:00.000Z" } }, yeoreum: { sent: { at: "2026-10-16T09:00:00.000Z", byName: "김채원" } } }, { read: { by: "hj", at: "2026-10-16T08:00:00.000Z" } }) } }, "hj", new Date("2026-10-16T16:00:00")).filter((x) => x.btn === "읽기").length], [0, 1]);
eq("다음 주 월요일: 지난 보고 안 보냈으면 빨강 '보고 지남'", ib(D0, "yj", "2026-10-19"), [["보고 지남", "쓰기", "겨울 칸 쓰기 · B2C 크루", true]]);
eq("주기를 바꾼 주 앞(그 전 기간)은 안 물음", ib({ ...D0, settings: [{ id: "aicrew", reportCycle: { cycle: "week", from: "2026-10-19" } }] }, "yj", "2026-10-19"), []);
eq("쉬는 사람·없는 사람 = 줄 없음", [R.repInbox(D0, "off", new Date("2026-10-16T10:00:00")).length, R.repInbox(D0, "nobody", new Date("2026-10-16T10:00:00")).length], [0, 0]);

// ⑥ 얼리기 · 글로 복사
const s0 = { note: "전환 올랐음", plan: "- 리뷰 이벤트", done: { byName: "남윤정" } }, sn = R.snapOf(d, s0);
eq("얼린 칸 = 숫자 + 담당 글", [sn.doneN, sn.note, sn.plan, sn.doneBy, sn.metrics.length], [1, "전환 올랐음", "- 리뷰 이벤트", "남윤정", d.metrics.length]);
const crew = { id: "b2c", short: "B2C 크루" }, txt = R.repText(crew, P, [{ m: slot("gyeoul"), d, s: s0 }], { leads: { sy: { note: "가격 실험은 다음 주 결정", byName: "김소연" } } });
eq("글: 머리 · 칸 · 실행 · 결과 · KPI · 한 줄 · 다음(AI + 사람) · 리드 한마디", [txt.split("\n")[0], txt.includes("■ 전환 · 겨울(AI) 전환마케터 · UX/UI·응대 · 담당 확인 남윤정"), txt.includes("- 실행: 실행 업무 끝냄 1건 · 흔적 2건 (안 함 1) · 승인 1건 · 올라옴 4건 · 남은 실행 1건"),
  txt.includes("- 결과 자사몰 구매전환율: 7.4% ← 6.1%"), txt.includes("- KPI 리뷰 신고·답글: +1"), txt.includes("- 다음: 롤러 재입고 알림 / 상세 첫 화면 / 리뷰 이벤트"), txt.endsWith("리드 한마디 (김소연): 가격 실험은 다음 주 결정")],
  ["[AI 크루 주간 보고] B2C 크루 · 10/12~10/18 · 금 10/16 마감", true, true, true, true, true, true]);

// ⑧ 리포트 ①②④ (2026-10-17 볼트 "주간 리포트 = AI 크루 보고서 · [다 썼어요] = 그 사람 '이번주 리포트 전달' 자동 체크 · 메모를 그 칸 위에 · 칸에 파일")
const rfx = (id, who, o = {}) => ({ id, title: "이번주 리포트 전달", isFixed: true, type: "fixed", recurType: "weekly", weekDays: ["금"], fixedTime: "11:00", assigneeId: who, assigneeIds: [who], memo: "*내용물: 전환율", ...o });
const DR = { ...D0, ai: { ...D0.ai, mates: { gyeoul: { owners: { grohome: "mj" } }, uju: { owners: { grohome: "mj" } }, yeoreum: { owners: { _: "cw" } }, byeol: { owners: { _: "yj" } } }, reports: {} },
  tasks: [rfx("rf_mj", "mj"), rfx("rf_yj", "yj"), rfx("rf_off", "mj", { paused: true, id: "rf_off" }), { id: "x1", title: "이번 주 리포트 전달 준비", isFixed: false, assigneeIds: ["mj"] }, rfx("rf_rm", "cw", { removed: { at: "2026-10-16T00:00:00Z" } })] };
const PR = R.periodOf(W, "2026-10-16");
eq("'이번주 리포트 전달' 고정업무 찾기: 내 것 · 띄어쓰기 달라도 · 멈춘·없앤·한 번짜리 빼고", [R.repFxOf(DR, "mj").id, R.repFxOf(DR, "yj").id, R.repFxOf(DR, "cw"), R.repFxOf(DR, ""), R.REP_FX_RE.test("이번 주 리포트 전달")], ["rf_mj", "rf_yj", null, null, true]);
eq("남은 내 칸 = 내가 담당인 칸 중 안 쓴 것 (방금 누른 칸은 쓴 것)", R.myRepLeft(DR, "mj", PR, { crew: "b2c", mate: "gyeoul" }).map((m) => m.id), ["uju"]);
const DR2 = { ...DR, ai: { ...DR.ai, reports: { [R.repId("b2c", PR)]: { secs: { uju: { done: { by: "mj" } }, byeol: { sent: { by: "sh" } } } } } } };
eq("다른 내 칸이 다 썼거나 보냈으면 = 없음 → 체크", [R.myRepLeft(DR2, "mj", PR, { crew: "b2c", mate: "gyeoul" }).length, R.myRepLeft(DR2, "yj", PR, null).length, R.myRepLeft(DR2, "mj", PR, null).map((m) => m.id)], [0, 0, ["gyeoul"]]);
eq("같이 쓰는 칸(할 일 담당)은 셈에서 뺌 · 담당 칸이 없으면 없음", R.myRepLeft({ ...DR, ai: { ...DR.ai, mates: { ...DR.ai.mates, gaeul: { owners: { grohome: "mj" }, actOwners: { A: "yj" } } } } }, "yj", PR, null).map((m) => m.id), ["byeol"]);
const fA = { name: "주간.html", url: "https://x/a", path: "p/a", by: "mj", uploadedAt: "2026-10-16T02:00:00Z" }, fB = { name: "캡처.png", url: "https://x/b", path: "p/b", by: "mj" };
eq("칸 파일: 아직 = 칸 files · 보냄 = 보낸 때(snap) 그대로 · 예전 보냄(snap 에 files 없음) = 칸 files · 주소 없는 것 빼고", [R.secFiles({ files: [fA, { name: "x" }] }, false).map((f) => f.name), R.secFiles({ files: [fA, fB], snap: { files: [fA] } }, true).map((f) => f.name), R.secFiles({ files: [fB], snap: {} }, true).map((f) => f.name), R.secFiles(null, false)], [["주간.html"], ["주간.html"], ["캡처.png"], []]);
eq("보낼 때 파일도 얼림 · 파일만 있어도 '쓰는 중'", [R.snapOf({ doneN: 1 }, { note: "a", files: [fA] }).files.map((f) => f.name), R.secState({ secs: { gyeoul: { files: [fA] } } }, "gyeoul")], [["주간.html"], "draft"]);
const txF = R.repText(R.repCrews()[0], PR, [{ m: slot("gyeoul"), d: { doneN: 0, openN: 0, trace: { done: 0, skip: 0 }, asks: { ok: 0, made: 0 }, metrics: [], ak: [], aiNext: "" }, s: { files: [fA, fB] } }], {});
eq("글로 복사: 파일 이름만 (주소는 안 넣음)", [txF.includes("- 파일 2개: 주간.html · 캡처.png (업무OS 보고서에서 열기)"), txF.includes("https://x/a")], [true, false]);

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
