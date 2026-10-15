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

const a0 = askDoc({ id: "ai_gyeoul_20261012_ghconvB", mate: "gyeoul", brand: "grohome", board: "gh-conv", act: "B", run: "2026-10-12", title: "전환 보드 B · 유리블러 가격", owner: "yj", at: "2026-10-12T00:00:00.000Z",
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
const many = [1, 2, 3, 4, 5].map((i) => ({ ...a0, id: "m" + i, title: "결과 " + i }));
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
const DA = (boards, mates) => ({ users: U, ai: { ready: true, mates: mates || { gyeoul: { owners: { grohome: "yj" } }, uju: { owners: { _: "yj" } } }, boards: boards || {} } });
const at = (s) => new Date(s).toISOString();
const W11 = new Date("2026-10-14T11:00:00");
eq("담당 묶음 = 같은 PC 한 시간씩 · 미정은 맨 뒤", X.asidePlanOf(DA()).map((g) => [g.owner, g.runs.map((r) => r.board.id + " " + r.t)]),
  [["yj", ["gh-conv 09:00", "gh-rep 10:00"]], ["", ["gh-traffic 09:00", "gh-ohou 10:00", "gh-exp 11:00", "gh-aov 12:00"]]]);
const s0 = X.asideInbox(DA(), "yj", W11);
eq("처음 = 내 PC 세팅 한 줄 (안 돎 알림은 아직)", s0.map((x) => [x.kind, x.title, x.keep]), [["aiSetup", "내 PC Aside 세팅 · 겨울 09:00 · 우주 10:00", true]]);
eq("한 보드만 올라오면 남은 것만 세팅", X.asideInbox(DA({ "gh-conv": { at: at("2026-10-14T09:05:00") } }), "yj", W11).map((x) => [x.kind, x.id]), [["aiSetup", "as:yj:gh-rep"]]);
const yb = { "gh-conv": { at: at("2026-10-13T09:04:00") }, "gh-rep": { at: at("2026-10-13T10:06:00") } };
eq("어제까지 돌았는데 오늘 안 올림 = 예약 + 90분 지난 것만", X.asideInbox(DA(yb), "yj", W11).map((x) => [x.kind, x.board, !!x.red, x.id]), [["aiMiss", "gh-conv", true, "am:gh-conv:2026-10-14"]]);
eq("오후엔 둘 다", X.asideInbox(DA(yb), "yj", new Date("2026-10-14T15:00:00")).map((x) => x.board), ["gh-conv", "gh-rep"]);
eq("오늘 올렸으면 없음", X.asideInbox(DA({ ...yb, "gh-conv": { at: at("2026-10-14T09:10:00") } }), "yj", W11), []);
eq("주말·공휴일은 안 돎 알림 없음", [X.asideInbox(DA(yb), "yj", new Date("2026-10-17T15:00:00")), X.asideInbox(DA(yb), "yj", new Date("2026-10-09T15:00:00"))], [[], []]);
eq("관리자 = 담당 미정 한 줄", X.asideInbox(DA(yb), "ran", W11).map((x) => [x.kind, x.title, x.text.split(" · 담당")[0]]), [["aiOwnerless", "AI 크루 담당 미정 4명", "가을 · 봄 · 여름 · 하늘"]]);
eq("담당 아님·준비 전·없는 사람 = 없음", [X.asideInbox(DA(yb), "yr", W11), X.asideInbox({ users: U, ai: { ready: false } }, "yj", W11), X.asideInbox(DA(), "nobody", W11)], [[], [], []]);
eq("모두 담당 있으면 미정 줄 없음", X.asideInbox(DA(yb, Object.fromEntries(["bom", "yeoreum", "gaeul", "gyeoul", "haneul", "uju"].map((m) => [m, { owners: { _: "cw" } }]))), "ran", W11), []);
eq("쉬는 사람이 담당이면 미정으로", X.asidePlanOf(DA({}, { gyeoul: { owners: { _: "old" } } })).map((g) => g.owner), [""]);
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

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
