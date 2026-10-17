// node src/airt.test.mjs — AI 크루 ↔ 반복 실행 (계산만 · 2026-10-16)
import { rtKey, isFxKey, fxIdOf, actTitle, pairActs, rtPairs, rtAiNow, rtSuggest, pairLabel, NO_ACT, akKeys, pairVal, taskAks, keyOwners, keyBrandOk, countKeys, splitExec, keyName } from "./airt.js";
import { brId } from "./routine.js";

let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) { ok++; } else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };

// 1. 열쇠
ck("열쇠: 여러 번 = id · 정한 날 = fx:id", rtKey("ak", "ak_ux") === "ak_ux" && rtKey("fx", "t1") === "fx:t1" && isFxKey("fx:t1") && !isFxKey("ak_ux") && fxIdOf("fx:t1") === "t1" && fxIdOf("ak_ux") === "");
// 2. 할 일 이름 · 짝 지을 수 있는 할 일 (실행 한 줄 있는 것 + 아침 루틴)
ck("할 일 이름: 겨울 C · 여름 아침 루틴 · 없는 글자", actTitle("gyeoul", "C").startsWith("상세페이지") && actTitle("yeoreum", NO_ACT) === "아침 루틴 원고" && actTitle("gyeoul", NO_ACT) === "" && actTitle("gyeoul", "Z") === "");
const pa = pairActs("yeoreum").map((a) => a.c), pg = pairActs("gyeoul").map((a) => a.c), pu = pairActs("uju").map((a) => a.c);
ck("짝 지을 할 일: 여름 = 아침 루틴 + 실행 있는 것 (E 발굴은 실행 없음)", pa[0] === NO_ACT && pa.includes("A") && pa.includes("D") && !pa.includes("E"), pa);
ck("짝 지을 할 일: 겨울 F(외주 보고) · 우주 A(자동 측정) 빠짐", !pg.includes("F") && pg.includes("C") && pg.includes("E") && !pu.includes("A") && pu.includes("E"), { pg, pu });
ck("쉬는 AI(포리)는 없음", pairActs("pori").length === 0);
const pga = pairActs("gaeul").map((a) => a.c);
ck("광고 할 일(외주 + 내부 관리 · 2026-10-16): 여름 C 메타 · 가을 D 쿠팡·E 네이버 짝 지을 수 있음 · F 광고 보고는 빠짐", pa.includes("C") && pga.includes("D") && pga.includes("E") && !pga.includes("F"), { pa, pga });
// 3. 짝 목록
const mates = { gyeoul: { actAk: { C: "ak_gh_detail", E: "" } }, yeoreum: { actAk: { [NO_ACT]: "ak_c_b2c", A: "fx:f9" } }, pori: { actAk: { A: "ak_x" } }, uju: { actAk: { Z: "ak_y" } } };
const P = rtPairs(mates);
ck("짝 목록: 빈 값·쉬는 AI·없는 할 일 뺌", P.size === 3 && P.get("ak_gh_detail")[0].mate === "gyeoul" && P.get("ak_c_b2c")[0].act === NO_ACT && P.get("fx:f9")[0].act === "A" && !P.has("ak_x") && !P.has("ak_y"), [...P.keys()]);
ck("짝 한 줄 이름", pairLabel(P.get("ak_c_b2c")[0]) === "여름 · 아침 루틴 원고" && pairLabel(P.get("ak_gh_detail")[0]).startsWith("겨울 · C 상세페이지"));
// 4. 지금 나에게 남은 AI 일
const asks = [
  { id: "a1", mate: "gyeoul", act: "C", state: "wait", to: "minji", createdAt: "2026-10-15T01:00:00Z" },
  { id: "a2", mate: "gyeoul", act: "C", state: "wait", to: "songhee", createdAt: "2026-10-15T02:00:00Z" },
  { id: "a3", mate: "gyeoul", act: "E", state: "wait", to: "minji", createdAt: "2026-10-15T03:00:00Z" },
  { id: "a4", mate: "yeoreum", state: "wait", to: "minji", createdAt: "2026-10-14T01:00:00Z" },   // 아침 루틴(글자 없음)
  { id: "a5", mate: "yeoreum", act: "A", state: "wait", to: "minji", createdAt: "2026-10-14T01:00:00Z" },
];
const tasks = [
  { id: "aix_a0", aiAsk: "a0", aiAk: "ak_gh_detail", status: "todo", assigneeIds: ["minji"], aiItems: [{ n: "C1" }, { n: "C2" }], aiTrace: { C1: { done: true } } },
  { id: "aix_b0", aiAsk: "b0", aiAk: "ak_gh_detail", status: "todo", assigneeIds: ["minji"], aiItems: [{ n: "C1" }], aiTrace: { C1: { skip: true } } },   // 흔적 다 남김
  { id: "aix_c0", aiAsk: "c0", aiAk: "ak_gh_detail", status: "done", assigneeIds: ["minji"], aiItems: [{ n: "C1" }] },
  { id: "aix_d0", aiAsk: "d0", aiAk: "ak_gh_detail", status: "todo", assigneeIds: ["songhee"], aiItems: [{ n: "C1" }] },
];
const n1 = rtAiNow("ak_gh_detail", P.get("ak_gh_detail"), asks, tasks, "minji");
ck("남은 AI 일: 내 차례 결과(같은 할 일만) · 내 실행(흔적 남은 것만) · 마지막 결과", n1.wait.map((a) => a.id).join() === "a1" && n1.exec.map((t) => t.id).join() === "aix_a0" && n1.last.id === "a2", { w: n1.wait.map((a) => a.id), x: n1.exec.map((t) => t.id), l: n1.last && n1.last.id });
const n2 = rtAiNow("ak_c_b2c", P.get("ak_c_b2c"), asks, tasks, "minji");
ck("아침 루틴 짝 = 글자 없는 결과만", n2.wait.map((a) => a.id).join() === "a4", n2.wait.map((a) => a.id));
ck("짝 없으면 null", rtAiNow("ak_ux", P.get("ak_ux"), asks, tasks, "minji") === null);
// 5. 추천 짝 — 실데이터 반복 실행 30 + 정한 날 체크 몇 개
const LIVE = [   // 실데이터 반복 실행(행동지표) 30 · 2026-10-16 · [id, 이름, 브랜드, 담당 수]
  ["ak_kwsel", "(B2C) 키워드 선정 (광고/컨텐츠)", "POUR스토어", 1],
  ["ak_c_b2c", "(B2C) 컨텐츠 발행 (+재활용)", "pourstore", 2],
  ["ak_c_b2b", "(B2B) 컨텐츠 발행 (+재활용)", "POUR스토어", 1],
  ["ak_trial", "(B2B) 체험단 모집 컨텐츠 발행", "POUR스토어", 1],
  ["ak_link", "기존 포스팅 링크 수정", "POUR스토어", 1],
  ["ak_influ", "(B2B) 인플루언서 섭외", "pourstore", 1],
  ["ak_influrv", "인플루언서 리뷰 확보", "POUR스토어", 1],
  ["ak_influch", "인플루언서 확보", "POUR스토어", 1],
  ["ak_kwtop", "검색키워드 상위노출 확인", "pourstore", 2],
  ["ak_ad", "고객 타겟 광고 진행", "POUR스토어", 1],
  ["ak_call_b2c", "(B2C) 구매 미전환 고객 전화확인", "pourstore", 1],
  ["ak_call_b2b", "(B2B) 구매 미전환 고객 전화확인", "pourstore", 1],
  ["ak_ux", "자사몰 UX/UI 관리개선 확인", "POUR스토어", 1],
  ["ak_promo", "(B2B) 구매고객 프로모션 안내", "POUR스토어", 1],
  ["ak_match", "(B2B) 대체 시공파트너 발굴 매칭시도", "POUR스토어", 1],
  ["ak_ref", "(B2C/B2B) 추천제 확인 후 쿠폰 전달", "POUR스토어", 1],
  ["ak_nps_b2c", "(B2C) NPS 만족도 조사 - 유선", "POUR스토어", 1],
  ["ak_nps_b2b", "(B2B) NPS 만족도 조사 - 유선", "pourstore", 1],
  ["ak_review", "(B2C) 리뷰·후기 유도 체계화", "POUR스토어", 1],
  ["ak_gh_kwtop", "검색키워드 상위노출", "grohome", 1],
  ["ak_gh_ad", "고객 타겟 광고", "grohome", 1],
  ["ak_gh_influrv", "인플루언서 리뷰 확보", "grohome", 1],
  ["ak_gh_influch", "인플루언서 확보", "grohome", 1],
  ["ak_gh_detail", "상세페이지 고도화", "grohome", 1],
  ["ak_gh_promo", "프로모션 진행", "grohome", 1],
  ["ak_gh_gb", "(B2B) 인플루언서 공동구매 제안", "grohome", 1],
  ["ak_gh_resale", "(B2B) 위탁판매·도매꾹·도매매 / 철물점", "grohome", 1],
  ["ak_gh_launch", "신제품 출시", "grohome", 1],
  ["ak_gh_rvpromo", "리뷰 프로모션 진행확인", "grohome", 1],
  ["akmuw1ygt4", "시공의뢰 이탈자 재연락", "pourstore", 1],
];
const rows = [
  ...LIVE.map(([id, name, brand, n]) => ({ key: id, name, brand: brId(brand), kind: "ak", owners: n === 1 ? ["u_" + id] : ["u1", "u2"].slice(0, n) })),
  { key: "fx:f1", name: "리뷰 관리", brand: "grohome", kind: "fx", owners: ["nam"] },
  { key: "fx:f2", name: "공식 블로그 관리", brand: "grohome", kind: "fx", owners: ["nam"] },
  { key: "fx:f3", name: "쿠팡 파트너스 확대", brand: "grohome", kind: "fx", owners: ["nam"] },
];
const S = rtSuggest(rows, {}), by = Object.fromEntries(S.map((s) => [s.mate + "." + s.act, s.key]));
ck("추천: 여름 아침 루틴 ← (B2C) 컨텐츠 발행", by["yeoreum._"] === "ak_c_b2c", by);
ck("추천: 여름 D 공구 ← 인플루언서 공동구매 제안 · 여름 A ← 그로홈 인플루언서 리뷰 확보(보드 브랜드 먼저)", by["yeoreum.D"] === "ak_gh_gb" && by["yeoreum.A"] === "ak_gh_influrv", by);
ck("추천: 겨울 C ← 상세페이지 고도화 · 우주 E ← 그로홈 프로모션 진행 · 우주 B ← 자사몰 UX/UI", by["gyeoul.C"] === "ak_gh_detail" && by["uju.E"] === "ak_gh_promo" && by["uju.B"] === "ak_ux", by);
ck("추천: 우주 D ← 리뷰 프로모션 진행확인 · 겨울 E ← 리뷰·후기 유도(인플루언서 리뷰 아님)", by["uju.D"] === "ak_gh_rvpromo" && by["gyeoul.E"] === "ak_review", by);
ck("추천: 할 일 하나엔 반복 실행 하나 · 반복 실행 하나엔 할 일 하나", new Set(S.map((s) => s.key)).size === S.length && new Set(S.map((s) => s.mate + s.act)).size === S.length);
ck("추천: 담당 한 명이면 그 사람(결과 확인·실행) · 여럿이면 비움", S.find((s) => s.key === "ak_gh_detail").owner === "u_ak_gh_detail" && S.find((s) => s.key === "ak_c_b2c").owner === "");
ck("추천: 아침 루틴(_)은 할 일 담당 안 정함", rtSuggest([{ key: "k1", name: "블로그 포스팅", brand: "pourstore", kind: "ak", owners: ["yj"] }], {})[0].owner === "");
const S2 = rtSuggest(rows, { gyeoul: { actAk: { C: "ak_ux" } } }), by2 = Object.fromEntries(S2.map((s) => [s.mate + "." + s.act, s.key]));
ck("추천: 이미 짝 지은 할 일·반복 실행은 건너뜀", !by2["gyeoul.C"] && !Object.values(by2).includes("ak_ux") && by2["uju.E"] === "ak_gh_promo", by2);
const S3 = rtSuggest([{ key: "fx:f1", name: "리뷰 관리", brand: "grohome", kind: "fx" }], {});
ck("추천: 정한 날 체크도 (여러 번 하는 것이 없으면)", S3.length === 1 && S3[0].mate === "gyeoul" && S3[0].act === "E", S3);

// 6. 할 일 하나 ↔ 열쇠 여러 개 (2026-10-17 사장님 "현재 반복업무들 모두 ai크루든 도움받아서 해야해")
ck("짝 값: 예전 글자 하나 · 목록 · 빈 값 · 같은 것 하나로", JSON.stringify([akKeys("ak_a"), akKeys(["ak_a", "fx:t1", "ak_a", ""]), akKeys(null), akKeys("")]) === JSON.stringify([["ak_a"], ["ak_a", "fx:t1"], [], []]));
ck("저장 모양: 없음 null · 하나 = 글자(예전과 같음) · 여럿 = 목록", pairVal([]) === null && pairVal(["ak_a"]) === "ak_a" && JSON.stringify(pairVal(["ak_a", "ak_b", "ak_a"])) === JSON.stringify(["ak_a", "ak_b"]));
ck("실행 업무 열쇠: aiAks 먼저 · 예전 aiAk", JSON.stringify([taskAks({ aiAks: ["a", "b"], aiAk: "a" }), taskAks({ aiAk: "x" }), taskAks({}), taskAks(null)]) === JSON.stringify([["a", "b"], ["x"], [], []]));
const PM = rtPairs({ yeoreum: { actAk: { A: ["ak_influch", "ak_gh_influch", "fx:t9"] } }, gyeoul: { actAk: { A: ["fx:s1", "fx:m1"], C: "ak_gh_detail" } } });
ck("짝 목록: 목록이면 열쇠마다", PM.get("ak_influch")[0].act === "A" && PM.get("ak_gh_influch")[0].mate === "yeoreum" && PM.get("fx:t9")[0].act === "A" && PM.get("fx:s1")[0].mate === "gyeoul" && PM.get("fx:m1")[0].act === "A" && PM.get("ak_gh_detail")[0].act === "C", [...PM.keys()]);
const S4 = rtSuggest(rows, { gyeoul: { actAk: { C: ["ak_gh_detail", "ak_ux"] } } }), by4 = Object.fromEntries(S4.map((s) => [s.mate + "." + s.act, s.key]));
ck("추천: 목록에 있는 열쇠도 이미 짝 지은 것", !by4["gyeoul.C"] && !Object.values(by4).includes("ak_ux") && !Object.values(by4).includes("ak_gh_detail"), by4);
// 누른 사람 것만 · 실행 브랜드와 맞는 것만 (실데이터 모양: 채림 인플루언서 POUR·그로홈 · 송희·미니 재고 · 전체 고정업무)
const DK = { users: [{ id: "chaerim", name: "양채림" }, { id: "songhee", name: "김송희" }, { id: "mini", name: "윤미니" }, { id: "minji", name: "김민지" }, { id: "old", name: "퇴사", active: false }],
  ak: { items: [{ id: "ak_influch", name: "인플루언서 확보", who: ["chaerim"], brand: "POUR스토어" }, { id: "ak_gh_influch", name: "인플루언서 확보", who: ["chaerim"], brand: "grohome" }, { id: "ak_kwtop", name: "검색키워드 상위노출 확인", who: ["songhee", "chaerim"], brand: "pourstore" }, { id: "ak_kwsel", name: "키워드 선정", whoNames: ["송희"], brand: "POUR스토어" }] },
  tasks: [{ id: "s1", isFixed: true, title: "재고 확인", assigneeIds: ["songhee"], brand: "common" }, { id: "m1", isFixed: true, title: "재고 확인/발주", assigneeIds: ["mini"], brand: "common" }, { id: "all", isFixed: true, title: "KPI 기재", forAll: true, brand: "common" },
    { id: "g1", isFixed: true, title: "오픈채팅 배포", assigneeIds: ["chaerim"], brand: "grohome" }, { id: "x1", isFixed: true, title: "퇴사자 일", assigneeIds: ["old"] }] };
ck("열쇠 이름 · 담당 (이름으로 맞춘 행동지표 · '전체' 고정업무는 따로 정한 사람 없음 · 쉬는 사람 빼고)", keyName(DK, "fx:s1") === "재고 확인" && keyName(DK, "ak_kwsel") === "키워드 선정" && keyName(DK, "fx:없음") === ""
  && JSON.stringify([keyOwners(DK, "ak_kwsel"), keyOwners(DK, "ak_kwtop"), keyOwners(DK, "fx:all"), keyOwners(DK, "fx:x1")]) === JSON.stringify([["songhee"], ["songhee", "chaerim"], [], []]), [keyOwners(DK, "ak_kwsel"), keyOwners(DK, "fx:all")]);
ck("브랜드 맞나: 실행 브랜드 없음·열쇠 브랜드 없음·공통 운영 = 맞음 · 이름/영문 같음", keyBrandOk("POUR스토어", "pourstore") && keyBrandOk("grohome", "") && keyBrandOk("", "grohome") && keyBrandOk("common", "grohome") && !keyBrandOk("POUR스토어", "grohome"));
const tA = { aiAks: ["ak_influch", "ak_gh_influch", "fx:g1", "fx:all"], brand: "grohome" };
ck("[했어요] 셀 열쇠: 그로홈 실행 = 그로홈 인플루언서 + 그로홈 체크 + 전체 체크 (POUR 것은 안 셈)", countKeys(DK, tA, "chaerim").map((x) => x.key).join() === "ak_gh_influch,fx:g1,fx:all", countKeys(DK, tA, "chaerim").map((x) => x.key));
ck("[했어요] 셀 열쇠: 남의 것은 안 셈 (송희가 누르면 전체 체크만)", countKeys(DK, tA, "songhee").map((x) => x.key).join() === "fx:all");
ck("[했어요] 셀 열쇠: 담당을 아무도 안 정한 반복 실행 = 누른 사람에게 셈", countKeys({ ...DK, ak: { items: [{ id: "ak_free", name: "빈 담당", who: [] }] } }, { aiAk: "ak_free" }, "mini").length === 1);
ck("[했어요] 셀 열쇠: 브랜드 섞인 결과(실행 브랜드 없음) = 내 것 모두", countKeys(DK, { aiAks: ["ak_influch", "ak_gh_influch"] }, "chaerim").length === 2 && countKeys(DK, { aiAk: "ak_kwtop" }, "songhee")[0].kind === "ak");
// 열쇠 담당별 실행 업무 (겨울 A 송희·미니 · 가을 E 민지 실행 + 송희 키워드 선정)
const ex = { id: "aix_q", assigneeId: "songhee", assigneeIds: ["songhee"], brand: "grohome", ackAt: "T", aiAk: "fx:s1", aiAks: ["fx:s1", "fx:m1"] };
const sp = splitExec(DK, ex, ["fx:s1", "fx:m1", "fx:all"], { id: "songhee" }, "T2");
ck("실행 업무 나눔: 실행 담당(송희) 말고 열쇠 담당(미니) 몫 하나 · 그 사람 열쇠만 · id~사람 · 받음 표시 없음 · '전체' 고정업무로는 안 나눔", sp.length === 1 && sp[0].id === "aix_q~mini" && sp[0].assigneeId === "mini" && sp[0].aiAks.join() === "fx:m1" && sp[0].aiAk === "fx:m1" && !("ackAt" in sp[0]), sp);
const sp2 = splitExec(DK, { ...ex, assigneeId: "minji", assigneeIds: ["minji"], brand: "pourstore" }, ["ak_kwsel", "ak_gh_influch", "fx:x1"], { id: "minji" }, "T2");
ck("실행 업무 나눔: 실행 담당이 열쇠 담당이 아니어도 · 실행 브랜드와 안 맞는 열쇠·쉬는 사람은 빼고", sp2.map((x) => x.id + ":" + x.aiAks.join("+")).join() === "aix_q~songhee:ak_kwsel", sp2.map((x) => x.id));
ck("실행 업무 나눔: 누른 사람 몫이면 받음 표시 · 실행 없으면 없음", splitExec(DK, ex, ["fx:m1"], { id: "mini" }, "T2")[0].ackAt === "T2" && splitExec(DK, null, ["fx:m1"], null, "T").length === 0);
const n3 = rtAiNow("ak_gh_influch", PM.get("ak_gh_influch"), [], [{ id: "aix_z", aiAsk: "z", aiAk: "ak_influch", aiAks: ["ak_influch", "ak_gh_influch"], status: "todo", assigneeIds: ["chaerim"], aiItems: [{ n: "A1" }] }], "chaerim");
ck("남은 AI 일: 실행 업무 열쇠 목록(aiAks)으로 찾음", n3.exec.map((t) => t.id).join() === "aix_z", n3.exec.map((t) => t.id));

console.log(`${ok}/${ok + bad} 통과${bad ? ` · ${bad} 실패` : ""}`);
process.exit(bad ? 1 : 0);
