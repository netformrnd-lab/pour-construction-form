// node src/aiask.test.mjs — AI 승인 계산 (AI → 담당 → 리드 → 본부장 · 저장 없음)
import * as X from "./aiask.js";
import { askDoc, askFromReq, reqDoc } from "../../marketing-hub/crew.js";
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log("✗", name, "\n  got ", JSON.stringify(got), "\n  want", JSON.stringify(want)); } else console.log("✓", name); };

// 사람: 남윤정(1팀 팀원) → 김소연(1팀 리드) → 허지은(본부장) · 김채원(3팀 리드) · 변유림(3팀) · 이란(관리자) · 쉬는 사람
const U = [
  { id: "yj", name: "남윤정", bossId: "sy" }, { id: "sy", name: "김소연", master: true, bossId: "hj" }, { id: "hj", name: "허지은", master: true },
  { id: "cw", name: "김채원", bossId: "hj" }, { id: "yr", name: "변유림", bossId: "cw" }, { id: "ran", name: "이란", master: true },
  { id: "sh", name: "김송희", role: "lead", bossId: "hj" }, { id: "old", name: "퇴사", active: false }, { id: "gm", name: "김민지", bossId: "old" },
];
const me = (id) => U.find((u) => u.id === id);
eq("상급자", [X.bossOf("yj", U), X.bossOf("sy", U), X.bossOf("hj", U), X.bossOf("gm", U)], ["sy", "hj", "", ""]);   // 쉬는 사람은 상급자로 안 침
eq("담당 = 브랜드별 → 기본 · 쉬는 사람 빼고", [X.mateOwner({ owners: { grohome: "yj", _: "cw" } }, "grohome", U), X.mateOwner({ owners: { grohome: "yj", _: "cw" } }, "pourstore", U), X.mateOwner({ owners: { _: "old" } }, "", U)], ["yj", "cw", ""]);

const a0 = askDoc({ id: "ai_gyeoul_20261012_ghconvB", mate: "gyeoul", brand: "grohome", board: "gh-conv", act: "B", hq: "판매가 조정", exec: "승인되면 담당이 윙에서 가격·옵션을 바꾼다", run: "2026-10-12", title: "전환 보드 B · 유리블러 가격", owner: "yj", at: "2026-10-12T00:00:00.000Z",
  cols: ["항목", "내용", "근거"], items: [{ n: "B1", c: { 항목: "1+1", 내용: "19,900원", 근거: "경쟁 11,000원" } }, { n: "B2", c: { 항목: "키트", 내용: "툴 포함" } }, { n: "B3", c: { 항목: "단품", 내용: "저가" } }], exec: "승인되면 담당이 윙에서 가격·옵션을 바꾼다" });
eq("누를 수 있나", [X.canAct(a0, me("yj")), X.canAct(a0, me("yr")), X.canAct(a0, me("ran")), X.canBack(a0, me("yj")), X.canRet(a0, me("yj"))], [true, false, true, true, false]);
eq("번호 골라야 승인", [X.pickOk(a0, []), X.pickOk(a0, ["B1"]), X.pickOk({ items: [] }, null)], [false, true, true]);

// ① 담당 승인 → 김소연(리드)
const T1 = "2026-10-12T01:00:00.000Z";
const p1 = X.planPass(a0, me("yj"), U, ["B1", "B3"], T1);
eq("담당 승인 → 리드", [p1.next, p1.final, p1.fields.to, p1.fields.step, p1.fields.path, p1.fields.pick, p1.fields.state], ["sy", false, "sy", 1, ["yj"], ["B1", "B3"], undefined]);
eq("기대값 = 연 때 본 차례", p1.expect, { state: "wait", to: "yj", step: 0, ver: 1 });
eq("기록 한 줄", [p1.entry.act, p1.entry.to, p1.entry.pick, p1.entry.step], ["up", "sy", ["B1", "B3"], 0]);
const a1 = { ...a0, ...p1.fields };
eq("길 보기 (리드 차례)", X.chainOf(a1, U).map((x) => [x.name, x.st]), [["남윤정", "done"], ["김소연", "now"], ["허지은", "next"]]);
// ② 리드 → 본부장
const p2 = X.planPass(a1, me("sy"), U, ["B1"], T1);
eq("리드 승인 → 본부장 · 번호 좁힘", [p2.next, p2.fields.to, p2.fields.step, p2.fields.path, p2.fields.pick], ["hj", "hj", 2, ["yj", "sy"], ["B1"]]);
const a2 = { ...a1, ...p2.fields };
// ③ 본부장 = 맨 위 → 최종 승인
const p3 = X.planPass(a2, me("hj"), U, ["B1"], T1);
eq("본부장 = 최종 승인", [p3.final, p3.fields.state, p3.fields.to, p3.fields.okBy, p3.fields.owner, p3.entry.act], [true, "ok", "", "hj", "yj", "ok"]);
const a3 = { ...a2, ...p3.fields };
eq("끝난 뒤 길 = 승인한 사람만", X.chainOf(a3, U).map((x) => x.name), ["남윤정", "김소연", "허지은"]);
// 실행 업무 (담당 · 고른 번호 · 사람이 반영)
const ex = X.planExec(a3, ["B1"], me("hj"), U, T1, "2026-10-13");
eq("실행 업무 = 담당에게", [ex.id, ex.assigneeId, ex.requestedBy, ex.noReview, ex.status, ex.dueDate, ex.aiAsk, ex.brand, ex.madeIn], ["aix_ai_gyeoul_20261012_ghconvB", "yj", "hj", true, "todo", "2026-10-13", "ai_gyeoul_20261012_ghconvB", "grohome", "v2"]);
eq("실행 이름 · 메모", [ex.title, ex.memo.split("\n").slice(0, 3)], ["실행 · 겨울 B · 유리블러 가격 (B1)", ["승인되면 담당이 윙에서 가격·옵션을 바꾼다", "승인 번호 1개", "- B1 · 1+1 · 19,900원 · 경쟁 11,000원"]]);
eq("보고만이면 실행 업무 없음", X.planExec({ ...a3, exec: "" }, null, me("hj"), U, T1, ""), null);
// 그 줄 브랜드 ('브랜드' 칸 → aiItems[].b · 2026-10-17 · [했어요] 때 그 브랜드 반복 실행만 셈)
eq("실행 업무 번호마다 브랜드 (그로홈·POUR스토어·비움)", X.planExec({ ...a3, cols: ["상품", "브랜드"], items: [{ n: "B1", c: { 상품: "롤러", 브랜드: "그로홈" } }, { n: "B2", c: { 상품: "방수재", 브랜드: "POUR스토어" } }, { n: "B3", c: { 상품: "브러쉬" } }] }, ["B1", "B2", "B3"], me("hj"), U, T1, "").aiItems.map((x) => x.b || ""), ["grohome", "pourstore", ""]);
eq("브랜드 글자 읽기", ["그로홈", "GROHOME", "pour스토어", "포어스토어", "POUR 스토어", "", "바라스데이"].map(X.itemBrandOf), ["grohome", "grohome", "pourstore", "pourstore", "pourstore", "", ""]);
eq("실행 업무 번호마다 상품 이름(p · 신제품 → 상품 · 40자) · 없으면 없음 (2026-10-17 달 A 이름 짝)", X.planExec({ ...a3, cols: ["신제품", "단계"], items: [{ n: "A1", c: { 신제품: " 스티커페인트 ", 단계: "기획" } }, { n: "A2", c: { 상품: "롤러" } }, { n: "A3", c: { 단계: "x" } }] }, ["A1", "A2", "A3"], me("hj"), U, T1, "").aiItems.map((x) => x.p || ""), ["스티커페인트", "롤러", ""]);
eq("다시 올린 판은 실행 id 다름", X.planExec({ ...a3, ver: 2 }, ["B1"], me("hj"), U, T1, "").id, "aix_ai_gyeoul_20261012_ghconvB_2");

// 상급자가 돌려보냄 → 담당 차례 다시 (수정 요청)
const r = X.planRet(a1, me("sy"), "근거를 쿠팡 기준으로", T1);
eq("돌려보냄 → 담당", [r.fields.to, r.fields.step, r.fields.path, r.fields.ret.text, r.entry.act, r.entry.step], ["yj", 0, [], "근거를 쿠팡 기준으로", "ret", 1]);
eq("돌려받은 건 다시 리드로", X.planPass({ ...a1, ...r.fields }, me("yj"), U, ["B1"], T1).fields.to, "sy");
// 담당 → AI 에게 다시
const b = X.planBack(a0, me("yj"), "경쟁사 3곳 더", T1);
eq("AI 에게 다시", [b.fields.state, b.fields.to, b.fields.back.text, b.fields.pick, b.entry.act], ["back", "", "경쟁사 3곳 더", null, "back"]);
eq("고치는 중 길 = 담당부터", X.chainOf({ ...a0, ...b.fields }, U).map((x) => [x.name, x.st]), [["남윤정", "wait"], ["김소연", "next"], ["허지은", "next"]]);
// 안 함
const d = X.planDrop(a1, me("sy"), "이번 달은 가격 그대로", T1);
eq("안 함", [d.fields.state, d.fields.noBy, d.fields.noReason, d.entry.act], ["no", "sy", "이번 달은 가격 그대로", "no"]);

// 담당 미정 → 관리자 누구나 · 누른 관리자가 담당 칸
const u0 = { ...a0, owner: "", to: "" };
eq("담당 미정 = 관리자만", [X.canAct(u0, me("ran")), X.canAct(u0, me("yj"))], [true, false]);
const pu = X.planPass(u0, me("ran"), U, ["B2"], T1);
eq("관리자가 담당 칸 → 그 사람 상급자 없음 = 최종", [pu.final, pu.fields.owner, pu.fields.path], [true, "ran", ["ran"]]);
eq("관리자 대신 누름 = proxy", X.planPass(a1, me("ran"), U, ["B1"], T1).entry.proxy, "sy");
// 상급자 고리·없는 사람 → 거기서 끝
const L = [{ id: "a", name: "가", bossId: "b" }, { id: "b", name: "나", bossId: "a" }];
eq("고리면 멈춤", X.planPass({ ...a0, to: "b", path: ["a"], step: 1, owner: "a" }, L[1], L, ["B1"], T1).final, true);
eq("고리 막기", [X.bossLoop(L, "a", "b"), X.bossLoop(U, "hj", "yj"), X.bossLoop(U, "yr", "hj")], [true, true, false]);

// '확인할 것'
const asks = [a1, { ...u0, id: "u1" }, { ...a0, id: "r1", ...r.fields }, { ...a3, id: "f1", okBy: "hj", okAt: "2026-10-12T02:00:00.000Z", okByName: "허지은" }];
const now = new Date("2026-10-12T05:00:00.000Z");
eq("리드 = 확인 요청", X.askInbox(asks, U, "sy", {}, now).map((x) => [x.kind, x.tag, x.title, x.text]), [["ai", "확인 요청", "전환 보드 B · 유리블러 가격", "승인하고 넘김 · 2개 고름 · 겨울 (AI) 결과"], ["ai", "AI 승인 요청", "전환 보드 B · 유리블러 가격", "그로홈 · 제안 3개 · 번호 골라 승인 · 담당 미정 · 관리자 누구나"]]);
eq("담당 = 수정 요청(빨강) + 최종 승인 알림", X.askInbox(asks, U, "yj", {}, now).map((x) => [x.kind, x.tag, !!x.red, x.text]), [["ai", "수정 요청", true, "김소연: 근거를 쿠팡 기준으로"], ["aiDone", "최종 승인", false, "실행 업무가 생겼어요 · 사람이 반영해 주세요"]]);
eq("읽은 최종 승인은 안 보임", X.askInbox(asks, U, "yj", { ["ao:f1" + "2026-10-12T02:00:00.000Z"]: true }, now).length, 1);
eq("팀원은 남의 것 안 보임", X.askInbox(asks, U, "yr", {}, now), []);
const many = ["A", "B", "C", "D", "E"].map((c, i) => ({ ...a0, id: "m" + i, act: c, title: "결과 " + (i + 1) }));   // 할 일이 다른 결과 5건 (같은 할 일이면 '이전 결과'로 묶임 · 아래)
const g = X.askInbox(many, U, "yj", {}, now);
eq("같은 AI 4건 넘으면 한 줄", [g.length, g[0].kind, g[0].title, g[0].mate], [1, "aiGroup", "겨울 결과 5건", "gyeoul"]);

// 성과 (고도화)
const S = X.mateStats([{ ...a0, ...b.fields, updatedAt: T1, log: [...a0.log, b.entry] }, { ...a3, id: "f1", updatedAt: T1, log: [...a0.log, p1.entry, r.entry, p3.entry] }, { ...a0, id: "x", ...d.fields, updatedAt: T1, log: [d.entry] }], "gyeoul", "2026-10-11");
eq("성과", [S.wait, S.back, S.ok, S.no, S.redo, S.ret, S.rate], [0, 1, 1, 1, 1, 1, 50]);
eq("고칠 점 최신순", S.notes.map((x) => x.act), ["back", "ret", "no"]);
eq("같은 지적 두 번 → 규칙 권유", X.repeatNotes([{ text: "근거를 더 넣어 주세요" }, { text: "근거를 더 넣어 주세요!" }, { text: "가격" }]).map((x) => x.text), ["근거를 더 넣어 주세요"]);

// 상급자 추천 (3팀 리드 김채원 · 본부장 허지은)
const R = X.bossRec([{ id: "hj", name: "허지은" }, { id: "sy", name: "김소연" }, { id: "sh", name: "김송희" }, { id: "cw", name: "김채원" }, { id: "yr", name: "변유림" }, { id: "yj", name: "남윤정" }, { id: "mj", name: "김민지" }, { id: "mn", name: "윤미니" }, { id: "x", name: "새사람" }, { id: "o", name: "쉼", active: false }]);
eq("상급자 추천", R, { hj: "", sy: "hj", sh: "hj", cw: "hj", yr: "cw", yj: "sy", mj: "sh", mn: "hj", x: "hj" });

// 더 만들기 n개 (2026-10-15 · 담당이 횟수를 늘려 다시)
const bm = X.planBack(a0, me("yj"), X.moreText(2, "리뷰 많은 제품"), T1, 2);
eq("더 만들기 = back.more · 기록에도", [bm.fields.state, bm.fields.back.more, bm.entry.more, bm.fields.back.text], ["back", 2, 2, "지금 것은 그대로 두고 2개 더 만들어 주세요 · 리뷰 많은 제품"]);
eq("더 만들기 없음 · 상한 · 음수", ["more" in b.fields.back, "more" in b.entry, X.planBack(a0, me("yj"), "x", T1, 999).fields.back.more, "more" in X.planBack(a0, me("yj"), "x", T1, -3).fields.back], [false, false, X.MORE_MAX, false]);

eq("더 만들기는 고칠 점이 아님 · 따로 셈", (() => { const S2 = X.mateStats([{ ...a0, ...bm.fields, updatedAt: T1, log: [...a0.log, bm.entry] }, { ...a0, id: "y", ...b.fields, updatedAt: T1, log: [b.entry] }], "gyeoul", "2026-10-11"); return [S2.redo, S2.more, S2.notes.map((x) => x.text)]; })(), [2, 1, ["경쟁사 3곳 더"]]);

// Aside 담당 PC — '확인할 것' (기기 시각 = 한국 · 10/14 수 · 10/17 토 · 10/9 한글날)
const at = (s) => new Date(s).toISOString();
const RT = (day, hm = "07:01") => ({ id: "ai_yeoreum_rt_" + day + hm, mate: "yeoreum", src: "tool", board: "", act: "", state: "wait", to: "", createdAt: at(`${day}T${hm}:00`), updatedAt: at(`${day}T${hm}:00`) });   // 아침 루틴 노트 승인 (team_link open)
//   새 보드(이음·별·달 · B2B 5 · 2026-10-17)는 cw PC — 아래 시험은 그로홈 보드 기준 (2026-10-17 바람 gh-ref 더함)
const NEWM = Object.fromEntries(["ieum", "byeol", "dal", "dandan", "cheokcheok", "kkomkkom", "deundeun", "teunteun"].map((m) => [m, { owners: { _: "cw" } }]));
const DA = (boards, mates, settings, asks) => ({ users: U, settings: settings || [{ id: "adsAside", ver: "2026-10-16" }], ai: { ready: true, mates: mates || { gyeoul: { owners: { grohome: "yj" } }, uju: { owners: { _: "yj" } }, ...NEWM }, boards: boards || {},
  asks: asks || ["2026-10-14", "2026-10-17", "2026-10-09"].map((d) => RT(d)) } });   // 광고 예약 글은 넣은 것으로 · 아침 루틴은 돈 것으로 (아래 따로 시험)
const W11 = new Date("2026-10-14T11:00:00");
eq("담당 묶음 = 같은 PC 한 시간씩 · 미정은 맨 뒤", X.asidePlanOf(DA()).filter((g) => g.owner !== "cw").map((g) => [g.owner, g.runs.map((r) => r.board.id + " " + r.t)]),
  [["yj", ["gh-conv 09:00", "gh-rep 10:00"]], ["", ["gh-traffic 09:00", "gh-ohou 10:00", "gh-exp 11:00", "gh-ref 12:00", "gh-aov 13:00"]]]);
eq("새 보드 한 PC = 요일이 다르면 같은 시각도 · 겹치면 뒤로 (시각 순) · 닫힌 B2B 크루 보드는 안 돎 (2026-10-17)", X.asidePlanOf(DA()).find((g) => g.owner === "cw").runs.map((r) => r.board.id + " " + r.t),
  ["ops-report 09:00", "hq-plan 09:00", "ops-order 15:00"]);
const s0 = X.asideInbox(DA(), "yj", W11);
eq("처음 = 내 PC 세팅 한 줄 (안 돎 알림은 아직)", s0.map((x) => [x.kind, x.title, x.keep]), [["aiSetup", "내 PC Aside 세팅 · 겨울 09:00 · 우주 10:00", true]]);
eq("처음 세팅 줄 = 3단계 중 몇 단계 · 다음 할 일 (2026-10-19 사장님 2A)", s0.map((x) => [x.id, x.owner, x.text]), [["asu:yj", "yj", "3단계 중 0단계 끝 · 다음: ① 사이트 로그인 0/7 · 마케팅 허브 crew 화면"]]);
eq("한 보드만 올라와도 체크 전이면 세팅 줄 그대로 (③ 시험만 ✓)", X.asideInbox(DA({ "gh-conv": { at: at("2026-10-14T09:05:00") } }), "yj", W11).map((x) => [x.kind, x.id, x.text]), [["aiSetup", "asu:yj", "3단계 중 1단계 끝 · 다음: ① 사이트 로그인 0/7 · 마케팅 허브 crew 화면"]]);
const yb = { "gh-conv": { at: at("2026-10-13T09:04:00") }, "gh-rep": { at: at("2026-10-13T10:06:00") } };
eq("어제까지 돌았는데 오늘 안 올림 = 예약 + 90분 지난 것만", X.asideInbox(DA(yb), "yj", W11).map((x) => [x.kind, x.board, !!x.red, x.id]), [["aiMiss", "gh-conv", true, "am:gh-conv:2026-10-14"]]);
eq("오후엔 둘 다", X.asideInbox(DA(yb), "yj", new Date("2026-10-14T15:00:00")).map((x) => x.board), ["gh-conv", "gh-rep"]);
eq("오늘 올렸으면 없음", X.asideInbox(DA({ ...yb, "gh-conv": { at: at("2026-10-14T09:10:00") } }), "yj", W11), []);
eq("주말·공휴일은 안 돎 알림 없음", [X.asideInbox(DA(yb), "yj", new Date("2026-10-17T15:00:00")), X.asideInbox(DA(yb), "yj", new Date("2026-10-09T15:00:00"))], [[], []]);
eq("관리자 = 담당 미정 한 줄", X.asideInbox(DA(yb), "ran", W11).filter((x) => x.kind !== "aiSetupAll").map((x) => [x.kind, x.title, x.text.split(" · 담당")[0]]), [["aiOwnerless", "AI 크루 담당 미정 5명", "가을 · 봄 · 여름 · 바람 · 하늘"]]);
// 광고 Aside 예약 글 (2026-10-17 사장님 "까먹을것같은데 os 확인할것에 나오게해줘") — 받는 사람 한 줄(keep) · 넣은 판이 지금 판보다 옛것일 때만
//   받는 사람 (2026-10-17 사장님 "Aside 예약은 김송희에게만 os에 알림뜨게해") = settings/adsAside.ownerId → 김송희 → 없으면 관리자 누구나
{ const k = (st, uid, users) => X.asideInbox({ ...DA(yb, undefined, st), ...(users ? { users } : {}) }, uid, W11).filter((x) => x.kind === "adsAside").map((x) => [x.id, x.title, x.keep]);
  const L = [["aa:2026-10-16", "새 예약 글 넣기 · 예약 2개", true]];
  eq("광고 예약 글: 안 넣었으면 김송희(기본)에게만 한 줄 · 다른 관리자·팀원엔 없음", [k([], "sh"), k([], "ran"), k([], "yj")], [L, [], []]);
  eq("광고 예약 글: 넣었으면(지금 판 · 더 새 판) 없음 · 옛 판이면 다시", [k([{ id: "adsAside", ver: "2026-10-16" }], "sh"), k([{ id: "adsAside", ver: "2026-10-20" }], "sh"), k([{ id: "adsAside", ver: "2026-10-15" }], "sh").length], [[], [], 1]);
  eq("받는 사람 바꿈(ownerId 김민지) → 김민지만 · 김송희 없음", [k([{ id: "adsAside", ownerId: "gm" }], "gm"), k([{ id: "adsAside", ownerId: "gm" }], "sh")], [L, []]);
  eq("받는 사람이 쉬면(퇴사) 기본 김송희 · 김송희도 없으면 관리자 누구나", [k([{ id: "adsAside", ownerId: "old" }], "sh"), k([], "ran", U.filter((u) => u.id !== "sh")), k([], "yj", U.filter((u) => u.id !== "sh"))], [L, L, []]);
  eq("받는 사람 계산 · [넣었어요] 할 수 있는 사람(받는 사람 · 관리자)", [X.adsAsideOwner({ users: U, settings: [] }), X.adsAsideOwner({ users: U, settings: [{ id: "adsAside", ownerId: "gm" }] }), X.adsAsideOwner({ users: U.filter((u) => u.id !== "sh"), settings: [] }), X.canAdsAside({ users: U, settings: [] }, me("sh")), X.canAdsAside({ users: U, settings: [] }, me("ran")), X.canAdsAside({ users: U, settings: [] }, me("yj"))], ["sh", "gm", "", true, true, false]);
  eq("광고 예약 글 판 읽기 (settings/adsAside · 없으면 빈 글)", [X.adsAsideVer({ settings: [{ id: "adsAside", ver: "2026-10-16" }] }), X.adsAsideVer({ settings: [] }), X.adsAsideVer({})], ["2026-10-16", "", ""]); }
eq("담당 아님·준비 전·없는 사람 = 없음", [X.asideInbox(DA(yb), "yr", W11), X.asideInbox({ users: U, ai: { ready: false } }, "yj", W11), X.asideInbox(DA(), "nobody", W11)], [[], [], []]);
eq("모두 담당 있으면 미정 줄 없음 (세팅 현황 줄만)", X.asideInbox(DA(yb, Object.fromEntries(["bom", "yeoreum", "gaeul", "gyeoul", "haneul", "uju", "baram", ...Object.keys(NEWM)].map((m) => [m, { owners: { _: "cw" } }]))), "ran", W11).map((x) => x.kind), ["aiSetupAll"]);
eq("쉬는 사람이 담당이면 미정으로", X.asidePlanOf(DA({}, { gyeoul: { owners: { _: "old" } } })).map((g) => g.owner), [""]);
// Aside 세팅 3단계 (2026-10-19 사장님 확정 1A~4A) — asidesetup/{담당} 체크 · 시험 = 보드가 올라오면 저절로 ✓ · 끝 = 셋 다 또는 모든 크루가 한 번 이상 올라옴
{ const SU = (setups, boards) => ({ ...DA(boards || {}), ai: { ...DA(boards || {}).ai, setups: setups || {} } });
  const gy = (D) => X.asidePlanOf(D).find((g) => g.owner === "yj"), so = (setups, boards, now = W11) => { const D = SU(setups, boards); return X.setupOf(D, gy(D), now); };
  const s0 = so();
  eq("세팅 처음: 사이트 7곳(허브 + 겨울·우주 6곳) · 예약 3(크루 2 + 고칠 것 확인) · 다음 = ① 허브", [s0.s1, s0.s2, s0.s3.done, s0.k, s0.step, s0.done, s0.sites[0].hub, s0.sites.map((x) => x.key).slice(0, 3)],
    [{ n: 0, of: 7, done: false }, { n: 0, of: 3, moved: 0, done: false }, false, 0, 1, false, true, ["마케팅허브crew화면", "카페24", "스마트스토어센터"]]);
  eq("[열기] 주소 = 확실한 곳만 (카페24 있음 · 허브 줄은 화면이 넣음)", [s0.sites[0].u, s0.sites.find((x) => x.s === "카페24").u, s0.sites.find((x) => x.s === "쿠팡윙").u], ["", "https://eclogin.cafe24.com/Shop/", "https://wing.coupang.com/"]);
  const allSites = Object.fromEntries(s0.sites.map((x) => [x.key, { on: true, at: "x" }]));
  const s1 = so({ yj: { sites: allSites } });
  eq("① 다 체크 → 다음 = ② 예약 (겨울부터)", [s1.s1.done, s1.k, s1.step, s1.next], [true, 1, 2, "② 예약 넣기 0/3 · 겨울"]);
  const runs = { "gh-conv": { on: true, t: "09:00", at: at("2026-10-14T08:30:00") }, "gh-rep": { on: true, t: "10:00", at: at("2026-10-14T08:31:00") }, _fix: { on: true, at: at("2026-10-14T08:32:00") } };
  const s2 = so({ yj: { sites: allSites, runs } });
  eq("② 다 넣음 → 다음 = ③ 시험", [s2.s2, s2.step, s2.next], [{ n: 3, of: 3, moved: 0, done: true }, 3, "③ [시험 한 번]"]);
  const s3 = so({ yj: { sites: allSites, runs, test: { at: at("2026-10-14T10:50:00"), board: "gh-conv" } } });
  eq("③ 시험 누름 · 아직 → 기다리는 중 → 30분 넘으면 확인 안내", [s3.next, s3.test.waitMin, so({ yj: { sites: allSites, runs, test: { at: at("2026-10-14T10:20:00") } } }).next],
    ["③ 시험 결과 기다리는 중 · 올라오면 저절로 ✓", 10, "③ 시험 결과가 40분째 안 올라왔어요 · Aside 화면에서 멈춘 곳 확인"]);
  const s4 = so({ yj: { sites: allSites, runs, test: { at: at("2026-10-14T10:50:00") } } }, { "gh-conv": { at: at("2026-10-14T10:58:00") } });
  eq("시험 결과 올라옴 → ✓ · 셋 다 = 끝 · 세팅 줄 사라짐", [s4.s3.done, s4.test.lastAt, s4.test.lastBoard.id, s4.done, s4.step, s4.next, X.asideInbox(SU({ yj: { sites: allSites, runs } }, { "gh-conv": { at: at("2026-10-14T10:58:00") } }), "yj", W11).filter((x) => x.kind === "aiSetup").length],
    [true, at("2026-10-14T10:58:00"), "gh-conv", true, 0, "세팅 끝 · 평일마다 이 PC 에서 돌아요", 0]);
  eq("체크를 안 했어도 모든 크루가 한 번 이상 올라오면 끝 (예전 기준)", [so({}, yb).done, so({}, yb).k], [true, 1]);
  const mv = so({ yj: { sites: allSites, runs: { ...runs, "gh-rep": { on: true, t: "11:00", at: "x" } } } }, yb);
  eq("예약 시각이 바뀐 크루 = 끝 아님 · 다시 넣기 안내 (모두 올라왔어도)", [mv.done, mv.s2.moved, mv.step, mv.next], [false, 1, 2, "② 예약 시각이 바뀐 크루 1명 · 우주 11:00 → 10:00 · 예약을 고쳐 주세요"]);
  eq("체크 풀기(on false) = 안 한 것 · 사이트 열쇠는 이름에서 기호만 뺌", [so({ yj: { sites: { ...allSites, 카페24: { on: false } } } }).s1.n, X.siteKey("네이버 검색광고 (그로홈 광고 계정)"), X.siteKey("POUR스토어 블로그·티스토리·네이버 카페"), X.setupDocId(""), X.setupDocId("yj")],
    [6, "네이버검색광고그로홈광고계정", "POUR스토어블로그티스토리네이버카페", "_none", "yj"]);
  // 예약을 넣었는데 한 번도 안 올라옴 (missSince) — 넣은 날 예약 시각 전이면 그날부터 · 쉬는 날엔 0
  eq("넣은 뒤 안 올라옴 날 수", [X.missSince(at("2026-10-13T08:00:00"), "09:00", W11), X.missSince(at("2026-10-13T10:30:00"), "09:00", W11), X.missSince(at("2026-10-13T10:30:00"), "09:00", new Date("2026-10-14T10:00:00")), X.missSince(at("2026-10-14T08:00:00"), "09:00", new Date("2026-10-14T10:00:00")), X.missSince(at("2026-10-13T08:00:00"), "09:00", new Date("2026-10-17T15:00:00")), X.missSince("", "09:00", W11)],
    [2, 1, 0, 0, 0, 0]);
  eq("주 1회 크루(월)는 그 요일만", [X.missSince(at("2026-10-13T08:00:00"), "09:00", new Date("2026-10-19T11:00:00"), [1]), X.missSince(at("2026-10-13T08:00:00"), "09:00", new Date("2026-10-16T15:00:00"), [1])], [1, 0]);
  const nv = X.asideInbox(SU({ yj: { runs: { "gh-conv": { on: true, t: "09:00", at: at("2026-10-13T08:00:00") } } } }), "yj", W11).filter((x) => x.kind === "aiMiss");
  eq("예약 넣었는데 한 번도 안 올림 = 담당 '안 돎' 빨강 (평일 n일째)", nv.map((x) => [x.board, x.title, !!x.red]), [["gh-conv", "겨울(AI) 예약을 넣었는데 아직 한 번도 안 올렸어요 · 평일 2일째", true]]);
  eq("[넣었어요] 전·올린 적 없음 = 안 돎 없음 (세팅 줄 몫)", X.asideInbox(SU({}), "yj", W11).filter((x) => x.kind === "aiMiss").length, 0);
  // 관리자 세팅 현황 (4A) — 담당 PC 마다 · 담당 미정 크루는 셈에서 뺌 · 읽음 = 오늘 하루
  const sa = (setups, boards, seen) => X.asideInbox(SU(setups, boards), "ran", W11, seen).filter((x) => x.kind === "aiSetupAll").map((x) => [x.id, x.title, x.text]);
  eq("관리자 = Aside 세팅 현황 한 줄 (끝 안 난 담당이 있을 때)", sa({ yj: { sites: allSites } }), [["asa:2026-10-14", "Aside 세팅 현황 · 담당 0/2명 끝", "남윤정 1/3 · 김채원 0/3 · 업로더 계정은 허브 '계정'에서 담당마다 하나씩"]]);
  eq("읽으면 오늘 하루 숨김 · 팀원엔 없음", [sa({}, {}, { "asa:2026-10-14": true }).length, X.asideInbox(SU({}), "yj", W11).filter((x) => x.kind === "aiSetupAll").length], [0, 0]);
  const allDone = { ...yb, "ops-report": { at: at("2026-10-13T09:00:00") }, "hq-plan": { at: at("2026-10-13T09:00:00") }, "ops-order": { at: at("2026-10-13T15:00:00") } };
  eq("담당 모두 끝 = 줄 없음 (담당 미정 크루가 남아도)", sa({}, allDone), []);
  const rows = X.setupRows(SU({}, allDone));
  eq("현황 줄 = 계획 순서 · 이름 · 담당 미정은 맨 뒤", rows.map((x) => [x.owner, x.name, x.done]), [["yj", "남윤정", true], ["cw", "김채원", true], ["", "담당 미정 · 관리자 PC", false]]);
  // 업로더 계정 (3A) — 허브 people 중 사용 중인 업로더 · 이름에 담당 이름 · 끝이 같은 이름 하나
  const P = [{ email: "a@x", name: "Aside", role: "uploader" }, { email: "m@x", name: "김민지 Aside", role: "uploader" }, { email: "s@x", name: "송희", role: "uploader" }, { email: "c@x", name: "남윤정", role: "staff" }, { email: "o@x", name: "변유림", role: "uploader", active: false }];
  eq("업로더 계정 맞추기", [X.uploaderOf(P, "김민지").email, X.uploaderOf(P, "김송희").email, X.uploaderOf(P, "남윤정"), X.uploaderOf(P, "변유림"), X.uploaderOf(null, "김민지"), X.uploaderOf(P, "김")], ["m@x", "s@x", null, null, undefined, null]);
  eq("올린 계정 이름 (aiboards.by 메일 → 허브 이름 · 모르면 빈 글)", [X.accountName(P, "M@x"), X.accountName(P, "z@x"), X.accountName(null, "a@x")], ["김민지 Aside", "", ""]); }
eq("안 돎 판단 = 세팅 시트와 같은 계산", [X.missedOn(yb["gh-conv"], "09:00", W11), X.missedOn(yb["gh-rep"], "10:00", W11), X.missedOn(null, "09:00", W11), X.missedOn(yb["gh-conv"], "09:00", new Date("2026-10-17T15:00:00"))], [true, false, false, false]);
eq("그날 올렸나", [X.ranOn({ at: at("2026-10-14T00:10:00") }, "2026-10-14"), X.ranOn({ at: at("2026-10-13T23:50:00") }, "2026-10-14"), X.ranOn(null, "2026-10-14")], [true, false, false]);

// 맡긴 일 결과 (2026-10-15) — 맡긴 사람(담당 아님)에게 판마다 한 번 · 담당이면 승인 줄만
{
  const rq = reqDoc({ id: "rq_gyeoul_x1", mate: "gyeoul", title: "상세 이탈 진단", by: "cw", byName: "김채원", at: "2026-10-12T01:00:00.000Z" });
  const ra = askFromReq(rq, { sum: "3곳", items: [{ n: "R1", c: { 항목: "리뷰" } }], cols: ["항목"] }, { run: "2026-10-12", at: "2026-10-12T03:00:00.000Z", owner: "yj" });
  const nw = new Date("2026-10-12T05:00:00.000Z");
  eq("맡긴 사람 = '맡긴 일 결과' 한 줄 (승인 대기)", X.askInbox([ra], U, "cw", {}, nw).map((x) => [x.kind, x.tag, x.title, x.text, x.aiId]), [["aiDone", "맡긴 일 결과", "맡긴 일 · 상세 이탈 진단", "남윤정님 승인 대기 · 결과 먼저 보기", ra.id]]);
  eq("담당 = 승인 줄만 (맡긴 일 결과 줄 없음)", X.askInbox([ra], U, "yj", {}, nw).map((x) => x.tag), ["AI 승인 요청"]);
  eq("읽으면 사라짐 · 다음 판이면 다시", [X.askInbox([ra], U, "cw", { ["ar:" + ra.id + ":1"]: true }, nw).length, X.askInbox([{ ...ra, ver: 2 }], U, "cw", { ["ar:" + ra.id + ":1"]: true }, nw).length], [0, 1]);
  eq("최종 승인 뒤", X.askInbox([{ ...ra, state: "ok", okBy: "hj", okAt: "2026-10-12T04:00:00.000Z", updatedAt: "2026-10-12T04:00:00.000Z" }], U, "cw", {}, nw).map((x) => x.text), ["최종 승인됐어요"]);
}

// 최종 승인 = 리드 (2026-10-15 사장님 "본부장은 승인없고 리드에게 보고 · 광고비 예산 조정, 원가조정, 판매가조정만 본부장 승인")
{
  const c0 = askDoc({ id: "c0", mate: "gyeoul", brand: "grohome", board: "gh-conv", act: "C", run: "2026-10-15", title: "전환 보드 C · 상세", owner: "yj", at: T1, exec: "승인되면 담당이 상세에 올린다" });
  eq("본부장 승인 이유: 판매가 = 보드 할 일 · 상세 = 없음 · 실행 없는 보고 = 없음", [X.hqOf(a0, null), X.hqOf(c0, null), X.hqOf({ ...a0, exec: "" }, null)], ["판매가 조정", "", ""]);
  eq("관리자가 할 일마다 켜고 끔(actHq)", [X.hqOf(c0, { actHq: { C: true } }), X.hqOf(a0, { actHq: { B: false } })], ["관리자 지정", ""]);
  eq("옛 승인(hq 칸 없음) = 보드 정의대로 (리셀러 · 2026-10-17 겨울 D → 봄 G)", X.hqOf({ board: "gh-ohou", act: "G", exec: "x" }, null), "판매가 조정");
  const q1 = { ...c0, ...X.planPass(c0, me("yj"), U, null, T1).fields };
  eq("담당 → 리드 (상세)", [q1.to, q1.step], ["sy", 1]);
  const q2 = X.planPass(q1, me("sy"), U, null, T1, { hq: "" });
  eq("리드 = 최종 (본부장 안 감)", [q2.final, q2.fields.state, q2.fields.okBy], [true, "ok", "sy"]);
  eq("길 보기: 리드에서 끝", X.chainOf(q1, U, "").map((x) => x.name), ["남윤정", "김소연"]);
  eq("[본부장에게도 올리기] 보임 = 리드 차례 · 본부장 승인 일 아님", [X.canUpHQ(q1, me("sy"), U, ""), X.canUpHQ(q1, me("sy"), U, "판매가 조정"), X.canUpHQ(c0, me("yj"), U, "")], [true, false, false]);
  const q3 = X.planPass(q1, me("sy"), U, null, T1, { hq: "", up: true });
  eq("[본부장에게도 올리기] → 본부장 · 표시 남음", [q3.next, q3.fields.to, !!q3.fields.hqUp, q3.entry.hqUp], ["hj", "hj", true, true]);
  eq("올린 뒤 길·이유", [X.chainOf({ ...q1, ...q3.fields }, U).map((x) => x.name), X.hqOf({ ...q1, ...q3.fields }, null)], [["남윤정", "김소연", "허지은"], "본부장 확인 요청"]);
  eq("판매가 = 리드 → 본부장 → 최종", [X.planPass(a1, me("sy"), U, ["B1"], T1, { hq: "판매가 조정" }).next, X.planPass(a2, me("hj"), U, ["B1"], T1, { hq: "판매가 조정" }).final], ["hj", true]);
  eq("리드가 담당 = 혼자 최종 (본부장 승인 일 아님)", X.planPass({ ...c0, owner: "sh", to: "sh" }, me("sh"), U, null, T1, { hq: "" }).final, true);
  eq("리드가 담당 · 판매가 = 본부장으로", X.planPass({ ...c0, owner: "sh", to: "sh" }, me("sh"), U, null, T1, { hq: "판매가 조정" }).next, "hj");
  eq("팀원 → 바로 위가 본부장(리드 아님) = 본부장으로 (리드 대신)", X.planPass({ ...c0, owner: "cw", to: "cw" }, me("cw"), [...U.filter((u) => u.id !== "cw"), { id: "cw", name: "공용팀원", bossId: "hj" }], null, T1, { hq: "" }).next, "hj");
  eq("리드 · 본부장 알아보기", [X.isLeadU(U, "sy"), X.isLeadU(U, "sh"), X.isLeadU(U, "yj"), X.isHQ(U, "hj"), X.isHQ(U, "sy")], [true, true, false, true, false]);
  eq("할 일 담당 → 없으면 AI 담당 · 쉬는 사람은 빼고", [X.actOwner({ owners: { grohome: "yj" }, actOwners: { A: "gm" } }, "grohome", "A", U), X.actOwner({ owners: { grohome: "yj" }, actOwners: { A: "gm" } }, "grohome", "B", U), X.actOwner({ owners: { grohome: "yj" }, actOwners: { A: "old" } }, "grohome", "A", U)], ["gm", "yj", "yj"]);
}

// 승인 길 세 단계 (2026-10-17 사장님 1A "점검·분석·목록·장부 = 담당에서 끝 · 밖으로 나가는 것 = 리드까지 · 광고비·원가·판매가 = 본부장까지 · 할 일마다 바꿈")
{
  const g0 = askDoc({ id: "g0", mate: "ieum", brand: "", board: "ops-order", act: "A", run: "2026-10-19", title: "주문 마감 대조", owner: "yj", at: T1, exec: "승인되면 담당이 빠진 주문을 넣는다" });
  const c0 = askDoc({ id: "c0b", mate: "gyeoul", brand: "grohome", board: "gh-conv", act: "C", run: "2026-10-19", title: "상세", owner: "yj", at: T1, exec: "승인되면 상세에 올린다" });
  eq("기본 길: inner = 담당에서 끝 · 상세 = 리드까지 · 판매가 = 본부장까지 · 실행 없는 광고 보고(가을 F inner) = 담당", [X.pathOf(g0, null), X.pathOf(c0, null), X.pathOf(a0, null), X.pathOf({ board: "gh-traffic", act: "F", exec: "" }, null)], ["owner", "lead", "hq", "owner"]);
  eq("관리자 덧칠 actPath > 예전 actHq > 보드 · 실행 없는 일은 본부장 안 감", [X.pathOf(g0, { actPath: { A: "lead" } }), X.pathOf(c0, { actPath: { C: "owner" } }), X.pathOf(c0, { actPath: { C: "hq" } }), X.pathOf(c0, { actHq: { C: true } }), X.pathOf(a0, { actPath: { B: "lead" }, actHq: { B: true } }), X.pathOf({ board: "gh-traffic", act: "F", exec: "" }, { actPath: { F: "hq" } })], ["lead", "owner", "hq", "hq", "lead", "lead"]);
  eq("hqOf = 길이 본부장까지일 때만 (관리자 지정 · 보드 이유)", [X.hqOf(c0, { actPath: { C: "hq" } }), X.hqOf(a0, { actPath: { B: "lead" } }), X.hqOf(g0, null)], ["관리자 지정", "", ""]);
  const o1 = X.planPass(g0, me("yj"), U, null, T1, { path: X.pathOf(g0, null) });
  eq("담당에서 끝 = 담당 승인이 최종", [o1.final, o1.fields.state, o1.fields.okBy, o1.fields.to], [true, "ok", "yj", ""]);
  eq("길 보기: 담당에서 끊김", X.chainOf(g0, U, "", "owner").map((x) => [x.name, x.st]), [["남윤정", "now"]]);
  eq("[리드에게도 올리기] 보임 = 담당에서 끝 · 담당 차례 · 위 사람 있음 (리드 → 본부장이면 안 보임)", [X.upLeadTo(g0, me("yj"), U, "owner"), X.upLeadTo(g0, me("yj"), U, "lead"), X.upLeadTo({ ...g0, owner: "sh", to: "sh" }, me("sh"), U, "owner"), X.upLeadTo(g0, me("yr"), U, "owner")], ["sy", "", "", ""]);
  const o2 = X.planPass(g0, me("yj"), U, null, T1, { path: "owner", up: "lead" });
  eq("[리드에게도 올리기] → 리드 · 표시 leadUp · 그 뒤 길 = 리드까지", [o2.next, o2.fields.step, !!o2.fields.leadUp, o2.entry.leadUp, !!o2.fields.hqUp, X.pathOf({ ...g0, ...o2.fields }, null)], ["sy", 1, true, true, false, "lead"]);
  const g1 = { ...g0, ...o2.fields };
  eq("올린 뒤 리드 = 최종 (본부장 안 감)", X.planPass(g1, me("sy"), U, null, T1, { hq: "", path: X.pathOf(g1, null) }).final, true);
  eq("올린 뒤 길 보기 = 담당 ✓ → 리드 ●", X.chainOf(g1, U, "", X.pathOf(g1, null)).map((x) => [x.name, x.st]), [["남윤정", "done"], ["김소연", "now"]]);
  eq("돌려보내기·AI에게 다시 = leadUp 지움", [X.planRet(g1, me("sy"), "다시", T1).fields.leadUp, X.planBack(g0, me("yj"), "다시", T1).fields.leadUp], [null, null]);
  eq("담당 미정 · 관리자가 누름 = 최종 (담당에서 끝)", X.planPass({ ...g0, owner: "", to: "" }, me("ran"), U, null, T1, { path: "owner" }).final, true);
  eq("위로 올라간 옛 건(step 1)은 길을 '담당에서 끝'으로 바꿔도 그 단계에서 이어짐", X.planPass({ ...g0, to: "sy", step: 1, path: ["yj"] }, me("sy"), U, null, T1, { hq: "", path: "owner" }).final, true);
  eq("길 이름", [X.PATH_L.owner, X.PATH_L.lead, X.PATH_L.hq, X.pathDef(g0), X.pathDef(a0)], ["담당에서 끝", "리드까지", "본부장까지", "owner", "hq"]);
}

// [본부장에게도 올리기]는 판마다 · 흔적(실행 업무 번호마다 했어요/안 함 · 2026-10-15 "마케터들은 업무 흔적 꼭 · AI가 세팅 · 사람이 확인 · KPI 추적")
{
  const up = { ...a1, hqUp: { by: "sy", byName: "김소연", at: T1 }, to: "hj", step: 2, path: ["yj", "sy"] };
  eq("돌려보내기·AI에게 다시 = 올리기 표시 지움", [X.planRet(up, me("hj"), "다시", T1).fields.hqUp, X.planBack({ ...up, to: "yj", step: 0 }, me("yj"), "다시", T1).fields.hqUp], [null, null]);
  eq("링크 칸 먼저 · 없으면 아무 칸의 주소", [X.firstUrl({ 계정: "@roller", 링크: "https://instagram.com/p/abc", 메모: "http://x.test" }), X.firstUrl({ 메모: "보기 https://blog.naver.com/a/1 참고" }), X.firstUrl({ 이름: "없음" })], ["https://instagram.com/p/abc", "https://blog.naver.com/a/1", ""]);
  const inf = { ...a0, act: "A", board: "gh-exp", cols: ["계정", "링크", "제안"], items: [{ n: "A1", c: { 계정: "@paint_kim", 링크: "https://instagram.com/paint_kim", 제안: "쿠팡파트너스 DM" } }, { n: "A2", c: { 계정: "@diy_lee", 링크: "", 제안: "DM" } }, { n: "A3", c: { 계정: "@x", 링크: "https://instagram.com/x" } }] };
  const ex = X.planExec(inf, ["A1", "A2"], me("hj"), U, T1, "2026-10-16", { ak: "x_insta" });
  eq("실행 업무 = 승인 번호마다 한 줄·링크(AI 가 채움) · 반복 실행 짝 · 할 일·보드", [ex.aiItems, ex.aiAk, ex.aiAct, ex.aiBoard], [[{ n: "A1", t: "@paint_kim · 쿠팡파트너스 DM", link: "https://instagram.com/paint_kim" }, { n: "A2", t: "@diy_lee · DM", link: "" }], "x_insta", "A", "gh-exp"]);
  eq("흔적 남은 수: 둘 다 아직", [X.traceLeft(ex), X.traceDoneN(ex)], [2, 0]);
  const t1 = { ...ex, aiTrace: { A1: { done: true, link: "https://instagram.com/p/dm1" } } };
  eq("A1 했어요 → 하나 남음", [X.traceLeft(t1), X.traceDoneN(t1), X.traceOf(t1, "A1").link], [1, 1, "https://instagram.com/p/dm1"]);
  eq("A2 안 함(이유)도 남긴 것 → 0 · 했어요는 1", [X.traceLeft({ ...t1, aiTrace: { ...t1.aiTrace, A2: { skip: true, note: "답장 없음" } } }), X.traceDoneN({ ...t1, aiTrace: { ...t1.aiTrace, A2: { skip: true } } })], [0, 1]);
  const one = X.planExec({ ...a0, items: [] }, null, me("hj"), U, T1, "");
  eq("번호 없는 실행 = 한 줄 흔적 하나", [X.traceList(one).map((x) => x.n), X.traceLeft(one)], [["_"], 1]);
  eq("AI 실행 업무가 아니면 흔적 없음", [X.traceLeft({ id: "t" }), X.traceLeft(null)], [0, 0]);
}

// 디맨드젠 (2026-10-15) — 승인 건 상품 → 신제품 칸(x_dg) · 실행 업무에 칸 id · 이름 띄어쓰기 무시
{
  const D = { tasks: [{ id: "lb_a__x_dg", projectId: "a", launchItem: "x_dg", title: "디맨드젠 광고 (1/5)", status: "inprogress", assigneeId: "sh", brand: "grohome" },
    { id: "lb_b__x_dg", projectId: "b", launchItem: "x_dg", title: "디맨드젠 광고 (0/5)", status: "todo", assigneeId: "sh", brand: "grohome" }],
    projects: [{ id: "a", title: "스티커 프라이머", brand: "grohome", launchDate: "2026-10-16" }, { id: "b", title: "스티커프라이머", brand: "grohome", launchDate: "2026-10-16", lbProject: "amazon-jp" }] };
  eq("상품 → 신제품 칸 (아마존 트랙 빼고)", [X.launchTaskOf(D, { launch: "x_dg", prod: "스티커프라이머" }), X.launchTaskOf(D, { launch: "x_dg", prod: "없음" }), X.launchTaskOf(D, { prod: "스티커 프라이머" })], ["lb_a__x_dg", "", ""]);
  const dg = { ...a0, act: "F", board: "gh-exp", mate: "yeoreum", launch: "x_dg", prod: "스티커 프라이머", cols: ["상품", "광고", "제목", "초안 링크"], items: [{ n: "F1", c: { 상품: "스티커 프라이머", 광고: "1", 제목: "칠하고 질리면 떼세요", "초안 링크": "https://ads.google.com/aw/c=1" } }] };
  const ex = X.planExec(dg, ["F1"], me("hj"), U, T1, "2026-10-16", { launchTask: "lb_a__x_dg" });
  eq("실행 업무 = 신제품 칸 · 상품 · 줄마다 초안 링크(AI 채움)", [ex.aiLaunch, ex.aiProd, ex.aiLaunchTask, ex.aiItems[0].link, ex.aiItems[0].t], ["x_dg", "스티커 프라이머", "lb_a__x_dg", "https://ads.google.com/aw/c=1", "스티커 프라이머 · 1 · 칠하고 질리면 떼세요"]);
  eq("신제품 칸 아닌 실행 업무엔 없음", X.planExec(a0, ["B1"], me("hj"), U, T1, "").aiLaunch, undefined);
}

// 쉬는 AI(하루·포리·에코 · crew.GONE) 담당 미정 승인 — '확인할 것'·내 차례 수에서 빠지고 AI 팀원 화면 정리 목록에만 (2026-10-15 페르소나 시험: 관리자 4명에게 6줄씩)
{ const gone = [askDoc({ id: "ai_haru_20261014_x", mate: "haru", title: "하루 · 오늘 배분", run: "2026-10-14", at: "2026-10-13T21:53:51.000Z" }), askDoc({ id: "ai_pori_20261013_y", mate: "pori", title: "포리 · 블로그 원고 3", run: "2026-10-13", at: "2026-10-12T21:54:17.000Z" }),
    { ...askDoc({ id: "ai_eco_20261014_z", mate: "eco", title: "에코 · 재배포", run: "2026-10-14", at: "2026-10-13T21:54:04.000Z" }), to: "sy" }];
  const live = askDoc({ id: "ai_yeoreum_20261015_w", mate: "yeoreum", title: "여름 · 블로그 원고 3", run: "2026-10-15", at: "2026-10-14T21:53:26.000Z" });
  const all = [...gone, live].map((a) => ({ ...a, state: "wait", to: a.to || "" }));
  eq("쉬는 AI 담당 미정 = 관리자 '확인할 것'에 없음 · 사람에게 넘어간 것(to)은 그대로 · 지금 AI 는 그대로", X.askInbox(all, U, "sy", {}, now).map((x) => x.aiId).sort(), ["ai_eco_20261014_z", "ai_yeoreum_20261015_w"]);
  eq("정리 목록 = 쉬는 AI 담당 미정만 (최근 것 먼저)", X.goneWaits(all).map((a) => a.id), ["ai_haru_20261014_x", "ai_pori_20261013_y"]);
  eq("내 차례 수도 같게 (관리자 김소연 2 = 에코(내 차례) + 여름(담당 미정))", [X.myTurnN(all, me("sy")), X.myTurnN(all, me("ran")), X.myTurnN(all, me("yj"))], [2, 1, 0]);
}

// 멈춤 감시 (2026-10-17 사장님 고름 "멈춤 감시") — 승인 지연(평일 1일 빨강 · 2일 상급자) · AI 고치는 중(반나절) · 이전 결과 정리 · AI 안 돎(담당 미정 · 2일 넘게 · 아침 루틴)
{
  const L = (s) => new Date(s);   // 기기 시각 (한국) · 10/9 금 한글날 · 10/17 토
  const w = (t) => ({ ...a0, id: "w_" + t, updatedAt: at(t), createdAt: at(t) });
  eq("기다린 평일: 월 10시 들어옴 → 월 0 · 화 1 · 수 2", [X.waitWd(w("2026-10-12T10:00:00"), L("2026-10-12T17:00:00")), X.waitWd(w("2026-10-12T10:00:00"), L("2026-10-13T08:00:00")), X.waitWd(w("2026-10-12T10:00:00"), L("2026-10-14T08:00:00"))], [0, 1, 2]);
  eq("18시 뒤·주말에 들어온 건 다음 평일부터 · 공휴일은 안 셈", [X.waitWd(w("2026-10-16T19:00:00"), L("2026-10-19T09:00:00")), X.waitWd(w("2026-10-17T10:00:00"), L("2026-10-20T09:00:00")), X.waitWd(w("2026-10-08T10:00:00"), L("2026-10-12T09:00:00"))], [0, 1, 1]);
  eq("일하는 시간: 월 17:30 → 화 10:00 = 90분 · 화 12:30 = 240분 · 금 17:00 → 월 09:30 = 90분(주말 안 셈)", [X.workMin(at("2026-10-12T17:30:00"), L("2026-10-13T10:00:00")), X.workMin(at("2026-10-12T17:30:00"), L("2026-10-13T12:30:00")), X.workMin(at("2026-10-16T17:00:00"), L("2026-10-19T09:30:00"))], [90, 240, 90]);

  const lt = w("2026-10-12T10:00:00"), nowW = L("2026-10-14T10:00:00");
  const ib = X.askInbox([lt], U, "yj", {}, nowW)[0];
  eq("평일 2일째 = 빨강 · 위로(ord) · 글 앞에 '평일 2일째'", [ib.kind, ib.red, ib.ord, ib.text.split(" · ")[0]], ["ai", true, X.ORD_LATE, "평일 2일째"]);
  eq("오늘 들어온 건 보통 줄", (() => { const x = X.askInbox([w("2026-10-14T09:00:00")], U, "yj", {}, nowW)[0]; return [x.red, "ord" in x]; })(), [false, false]);
  eq("상급자 = '승인 밀림' 한 줄", X.askInbox([lt], U, "sy", {}, nowW).map((x) => [x.kind, x.title, x.aiId, x.red, x.keep]), [["aiLate", "남윤정님 AI 승인 1건 · 평일 2일째", lt.id, true, undefined]]);
  eq("관리자도 = 한 줄로 모아(상급자 줄과 따로 · id alm) · 관리자 아닌 팀원은 안 봄 · 1일째는 아직", [X.askInbox([lt], U, "hj", {}, nowW).map((x) => [x.kind, x.id, x.title]), X.askInbox([lt], U, "ran", {}, nowW).length, X.askInbox([lt], U, "yr", {}, nowW).length, X.askInbox([lt], U, "sy", {}, L("2026-10-13T10:00:00"))],
    [[["aiLate", "alm:yj:2026-10-14", "남윤정님 AI 승인 1건 · 평일 2일째"]], 1, 0, []]);
  eq("내가 상급자면 내 줄만 (관리자 모음엔 안 넣음)", X.askInbox([lt], U, "sy", {}, nowW).map((x) => x.id), ["al:yj:2026-10-14"]);
  eq("읽으면 오늘 하루 안 보임 · 다음 날 다시", [X.askInbox([lt], U, "sy", { "al:yj:2026-10-14": true }, nowW).length, X.askInbox([lt], U, "sy", { "al:yj:2026-10-14": true }, L("2026-10-15T09:00:00")).length, X.askInbox([lt], U, "hj", { "alm:yj:2026-10-14": true }, nowW).length], [0, 1, 0]);
  const top = { ...lt, id: "lt_top", to: "hj", step: 2, path: ["yj", "sy"] };
  eq("상급자 없는 사람(본부장) = 관리자 모두 · 본인·팀원 빼고", ["sy", "ran", "sh", "hj", "yj"].map((u) => X.askInbox([top], U, u, {}, nowW).filter((x) => x.kind === "aiLate").length), [1, 1, 1, 0, 0]);
  eq("상급자가 쉬는 사람이면 관리자에게 · '상급자 없음'", X.askInbox([{ ...lt, id: "lt_gm", to: "gm" }], U, "ran", {}, nowW).map((x) => [x.title, x.text.endsWith("상급자 없음")]), [["김민지님 AI 승인 1건 · 평일 2일째", true]]);
  eq("관리자 = 여러 명이면 한 줄 '승인 밀림 n명' · 가장 오래 기다린 승인으로", X.askInbox([lt, { ...lt, id: "lt_gm", to: "gm", updatedAt: at("2026-10-08T10:00:00") }], U, "ran", {}, nowW).map((x) => [x.title, x.text, x.aiId]), [["AI 승인 밀림 2명 · 길게는 평일 3일째", "김민지 1건 · 남윤정 1건", "lt_gm"]]);
  const lateMany = many.map((x) => ({ ...x, updatedAt: at("2026-10-12T10:00:00") }));
  eq("같은 AI 묶음에 늦은 것 = 빨강·위로·'늦은 것 n건'", (() => { const x = X.askInbox(lateMany, U, "yj", {}, nowW)[0]; return [x.kind, x.red, x.ord, x.text.split(" · ")[0]]; })(), ["aiGroup", true, X.ORD_LATE, "늦은 것 5건"]);

  const bk = { ...a0, id: "bk1", state: "back", to: "", owner: "yj", back: { text: "다시", by: "yj", byName: "남윤정", at: at("2026-10-14T09:00:00") }, updatedAt: at("2026-10-14T09:00:00") };
  const n14 = L("2026-10-14T14:00:00");
  eq("AI 고치는 중 = 일하는 시간 4시간(반나절) 넘으면 담당에게", [X.askInbox([bk], U, "yj", {}, L("2026-10-14T12:00:00")).length, X.askInbox([bk], U, "yj", {}, n14).map((x) => [x.kind, x.tag, x.red, x.text.split(" · ")[0]])], [0, [["aiStuck", "AI 고치는 중", true, "보낸 뒤 일하는 시간 5시간째 그대로"]]]);
  eq("보드 건 = [바로 고치기] · 노트 건 = 사장님께 보낼 글", [X.askInbox([bk], U, "yj", {}, n14)[0].text.split(" · ")[1], X.askInbox([{ ...bk, board: "" }], U, "yj", {}, n14)[0].text.split(" · ")[1]], ["누르면 [바로 고치기] 글", "누르면 사장님께 보낼 글"]);
  eq("담당 미정이면 관리자 · 다른 팀원은 안 봄 · 읽으면 오늘 하루", [X.askInbox([{ ...bk, owner: "" }], U, "ran", {}, n14).length, X.askInbox([bk], U, "yr", {}, n14).length, X.askInbox([bk], U, "yj", { "ab:bk1:1:2026-10-14": true }, n14).length], [1, 0, 0]);
  eq("사장님께 보낼 글 (고칠 것 확인)", X.stuckAlert(bk, n14), "[업무OS] 겨울(AI)에게 다시 보낸 '전환 보드 B · 유리블러 가격' — 일하는 시간 5시간째 그대로예요 · Claude 예약 작업 'AI 크루 고칠 것 확인' 확인 부탁드려요");

  const v = (id, t, extra = {}) => ({ ...a0, id, createdAt: at(t), updatedAt: at(t), log: [{ at: at(t), act: "ask" }], ...extra });
  const p1 = v("p1", "2026-10-14T09:00:00"), p2 = v("p2", "2026-10-15T09:00:00"), p3 = v("p3", "2026-10-16T09:00:00"), n16 = L("2026-10-16T10:00:00");
  const ci = X.askInbox([p1, p2, p3], U, "yj", {}, n16);
  eq("같은 할 일 = 가장 새 결과 한 줄 + '이전 결과 2건' (지난 것의 늦음은 안 셈)", [ci.length, ci[0].aiId, ci[0].text.split(" · ").pop(), ci[0].red], [1, "p3", "이전 결과 2건", false]);
  eq("상급자 밀림도 가장 새 결과로만 셈", X.askInbox([p1, p2, p3], U, "sy", {}, n16), []);
  eq("AI 가 고쳐 다시 올린 판(redo)이 가장 새 결과", X.askInbox([{ ...p1, ver: 2, log: [...p1.log, { at: at("2026-10-16T09:30:00"), act: "redo" }] }, p3], U, "yj", {}, n16).map((x) => x.aiId), ["p1"]);
  eq("할 일·상품·브랜드가 다르면 따로 · 맡긴 일(R)·노트(보드 없음)·위 단계는 안 묶음", X.waitHeads([p2, p3, v("q1", "2026-10-15T09:00:00", { act: "C" }), v("q2", "2026-10-15T09:00:00", { prod: "다른 상품" }), v("q3", "2026-10-15T09:00:00", { brand: "pourstore" }),
    v("q4", "2026-10-15T09:00:00", { act: "R" }), v("q5", "2026-10-15T09:00:00", { board: "", act: "" }), v("q6", "2026-10-15T09:00:00", { step: 1, to: "sy" })]).heads.size, 7);
  eq("상급자가 돌려보낸 지난 결과(수정 요청)는 안 묶음 · 따로 빨강", X.askInbox([{ ...p1, ret: { text: "근거", byName: "김소연", at: at("2026-10-15T09:00:00") } }, p3], U, "yj", {}, n16).map((x) => [x.aiId, x.tag]), [["p1", "수정 요청"], ["p3", "AI 승인 요청"]]);
  eq("내 차례 수도 지난 결과는 하나로", [X.myTurnN([p1, p2, p3], me("yj")), X.myTurnN([p1, p2, p3, v("q9", "2026-10-15T09:00:00", { act: "C" })], me("yj"))], [1, 2]);
  eq("승인 한 장: 지난 결과(최근 것 먼저) · 더 새 결과", [X.prevWaits([p1, p2, p3], p3).map((x) => x.id), X.newerOf([p1, p2, p3], p1).id, X.newerOf([p1, p2, p3], p3), X.prevWaits([p1, p2, { ...p3, step: 1 }], { ...p3, step: 1 }).map((x) => x.id)], [["p2", "p1"], "p3", null, ["p2", "p1"]]);
  const up3 = { ...p3, step: 1, to: "sy", path: ["yj"] };   // 가장 새 결과를 담당이 승인해 위로 올림 → 남은 지난 결과 줄에 '더 새 결과 있음'
  eq("더 새 결과가 위로 올라감 = 남은 지난 결과 줄에 '더 새 결과 있음 · 정리해 주세요' · 묶음은 그 아래 것까지", (() => { const r = X.askInbox([p1, p2, up3], U, "yj", {}, n16); return [r.length, r[0].aiId, r[0].text.split(" · ").slice(-3)]; })(), [1, "p2", ["이전 결과 1건", "더 새 결과 있음", "정리해 주세요"]]);
}
// AI 안 돎 — 담당 미정 크루 · 평일 2일 넘게 · 아침 루틴 (멈춤 감시 ④)
{
  const un = { "gh-traffic": { at: at("2026-10-13T09:05:00") } };   // 가을 = 담당 미정 → 관리자 PC 에서 돌던 것
  eq("담당 미정 크루가 안 올림 = 관리자에게 한 줄 · 팀원엔 없음", [X.asideInbox(DA(un), "ran", W11).filter((x) => x.kind === "aiMiss").map((x) => [x.id, x.title, x.owner]), X.asideInbox(DA(un), "yj", W11).filter((x) => x.kind === "aiMiss").length],
    [[["amu:gh-traffic:2026-10-14", "오늘 가을(AI)가 아직 안 올렸어요", ""]], 0]);
  const lg = { "gh-conv": { at: at("2026-10-08T09:05:00") }, "gh-rep": { at: at("2026-10-14T10:05:00") } };   // 겨울(남윤정 PC) = 10/8 뒤로 안 올림 (10/9 한글날 빼고)
  eq("담당 = '평일 n일째'", X.asideInbox(DA(lg), "yj", W11).filter((x) => x.kind === "aiMiss").map((x) => x.title), ["겨울(AI)가 평일 3일째 안 올렸어요"]);
  eq("평일 2일 넘게 = 관리자 한 줄 (그 PC · 일수)", X.asideInbox(DA(lg), "ran", W11).filter((x) => x.kind === "aiMissLong").map((x) => [x.title, x.text, x.owner]), [["Aside 평일 2일 넘게 안 돎 · 1명", "겨울(남윤정 PC) 3일째 · 그 PC·Aside 를 확인해 주세요", "yj"]]);
  eq("관리자 줄은 읽으면 오늘 하루 숨김 · 담당 줄(처리해야 사라짐)은 그대로", [X.asideInbox(DA(lg), "ran", W11, { "aml:gh-conv:2026-10-14": true }).filter((x) => x.kind === "aiMissLong").length, X.asideInbox(DA(lg), "yj", W11, { "am:gh-conv:2026-10-14": true }).filter((x) => x.kind === "aiMiss").length], [0, 1]);
  eq("다음 평일 아침(예약 전)에도 지난 평일 못 올린 것", X.asideInbox(DA({ "gh-conv": { at: at("2026-10-13T09:05:00") }, "gh-rep": { at: at("2026-10-14T10:05:00") } }), "yj", new Date("2026-10-15T08:00:00")).filter((x) => x.kind === "aiMiss").map((x) => x.title), ["겨울(AI)가 지난 평일(10/14)에 안 올렸어요"]);
  eq("안 올린 평일 수 = 쉬는 날엔 0", [X.missDays(lg["gh-conv"], "09:00", W11), X.missDays(lg["gh-conv"], "09:00", new Date("2026-10-17T15:00:00")), X.missDays(null, "09:00", W11)], [3, 0, 0]);
  // 주 1~2회 보드 (2026-10-17 · 달 월 · 별 금 · B2B) — 도는 요일만 셈
  const mon = { at: at("2026-10-12T09:05:00") };
  eq("주 1회 보드(월): 다른 요일엔 안 돎 아님 · 월요일 예약 + 90분 지나면 1 · 다음 날엔 '지난 돌 날' 1", [X.missDays(mon, "09:00", new Date("2026-10-16T15:00:00"), [1]), X.missDays(mon, "09:00", new Date("2026-10-19T11:00:00"), [1]), X.missDays(mon, "09:00", new Date("2026-10-19T10:00:00"), [1]), X.missDays(mon, "09:00", new Date("2026-10-20T15:00:00"), [1]), X.missedOn(mon, "09:00", new Date("2026-10-20T15:00:00"), [1])],
    [0, 1, 0, 1, false]);
  eq("주 2회(월·목) = 그 사이 목요일도 셈 · 요일 없으면 예전(평일)", [X.missDays(mon, "10:00", new Date("2026-10-19T12:00:00"), [1, 4]), X.missDays(mon, "10:00", new Date("2026-10-19T12:00:00"))], [2, 5]);

  const rm = (asks, uid, t, mates, seen) => X.asideInbox(DA({}, mates, undefined, asks), uid, new Date(t), seen).filter((x) => x.kind === "aiRoutine").map((x) => [x.id, x.title]);
  const yeo = { yeoreum: { owners: { _: "cw" } } };
  eq("아침 루틴: 09:30 전엔 없음 · 지나면 여름 담당·관리자 · 다른 팀원 없음", [rm([], "cw", "2026-10-14T09:20:00", yeo), rm([], "cw", "2026-10-14T09:31:00", yeo), rm([], "ran", "2026-10-14T09:31:00", yeo).length, rm([], "yr", "2026-10-14T09:31:00", yeo).length],
    [[], [["amr:yeoreum:2026-10-14", "오늘 여름(AI) 아침 루틴이 아직 안 올라왔어요"]], 1, 0]);
  eq("오늘 올라옴 = 없음 · 자정 넘어 늦게 올라온 전날 몫은 안 셈 · 쉬는 날·멈춘 루틴(routineOff) = 없음 · 읽으면 오늘 하루", [rm([RT("2026-10-14")], "cw", "2026-10-14T10:00:00", yeo), rm([RT("2026-10-14", "00:09")], "cw", "2026-10-14T10:00:00", yeo).length,
    rm([], "cw", "2026-10-17T10:00:00", yeo), rm([], "cw", "2026-10-14T10:00:00", { yeoreum: { owners: { _: "cw" }, routineOff: true } }), rm([], "cw", "2026-10-14T10:00:00", yeo, { "amr:yeoreum:2026-10-14": true })], [[], 1, [], [], []]);
  eq("쉬는 AI(포리) 이름으로 올라온 노트도 셈 · 보드 결과는 안 셈", [rm([{ ...RT("2026-10-14"), mate: "pori" }], "cw", "2026-10-14T10:00:00", yeo), rm([{ ...RT("2026-10-14"), board: "gh-exp", src: "crew" }], "cw", "2026-10-14T10:00:00", yeo).length], [[], 1]);
  eq("사장님께 보낼 글 (아침 루틴)", X.routineAlert("여름", new Date("2026-10-14T10:00:00")), "[업무OS] 여름(AI) 아침 루틴이 오늘 10/14(수) 09:30까지 안 올라왔어요 · Claude 예약 작업 'AI 콘텐츠 아침 (여름 · B2C 크루)' 확인 부탁드려요");
}

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
