// node src/airt.test.mjs — AI 크루 ↔ 반복 실행 (계산만 · 2026-10-16)
import { rtKey, isFxKey, fxIdOf, actTitle, pairActs, rtPairs, rtAiNow, rtSuggest, pairLabel, NO_ACT, akKeys, pairVal, taskAks, keyOwners, countKeys, splitExec, keyName, SPLIT_MAX, liveAk, liveActOwners, fxTimeCome, normK } from "./airt.js";
import { brId } from "./routine.js";

let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) { ok++; } else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };

// 1. 열쇠
ck("열쇠: 여러 번 = id · 정한 날 = fx:id", rtKey("ak", "ak_ux") === "ak_ux" && rtKey("fx", "t1") === "fx:t1" && isFxKey("fx:t1") && !isFxKey("ak_ux") && fxIdOf("fx:t1") === "t1" && fxIdOf("ak_ux") === "");
// 2. 할 일 이름 · 짝 지을 수 있는 할 일 (실행 한 줄 있는 것 + 아침 루틴)
ck("할 일 이름: 겨울 C · 여름 아침 루틴 · 없는 글자", actTitle("gyeoul", "C").startsWith("상세페이지") && actTitle("yeoreum", NO_ACT) === "아침 루틴 원고" && actTitle("gyeoul", NO_ACT) === "" && actTitle("gyeoul", "Z") === "");
const pa = pairActs("yeoreum").map((a) => a.c), pg = pairActs("gyeoul").map((a) => a.c), pu = pairActs("uju").map((a) => a.c);
ck("짝 지을 할 일: 여름 = 아침 루틴 + 실행 있는 것 (2026-10-17 메타 C·발굴 E·디맨드젠 F 는 옮김 · J A/B 실험 새로)", JSON.stringify(pa) === JSON.stringify([NO_ACT, "A", "B", "D", "G", "H", "I", "J"]), pa);
ck("짝 지을 할 일: 우주 A(자동 측정) 빠짐 · 겨울 F 는 가을 F 로 합침 · 우주 D·E·F 는 바람·봄으로 (2026-10-17)", JSON.stringify(pg) === JSON.stringify(["B", "C", "G", "H", "I"]) && JSON.stringify(pu) === JSON.stringify(["B", "C", "G", "H"]) && JSON.stringify(pairActs("baram").map((a) => a.c)) === JSON.stringify(["A", "B", "C", "D", "E"]) && JSON.stringify(pairActs("ieum").map((a) => a.c)) === JSON.stringify(["A", "B", "C", "D", "E", "F"]), { pg, pu });   // 2026-10-17 사장님 정의: 겨울 A → 이음 F · E → 바람 D · 새 겨울 H·I · 우주 G·H · 바람 E
ck("쉬는 AI(포리)는 없음", pairActs("pori").length === 0);
const pga = pairActs("gaeul").map((a) => a.c);
ck("광고 할 일(외주 + 내부 관리 · 2026-10-16): 가을 D 쿠팡·E 네이버·G 메타(여름 C 에서)·H 디맨드젠·I 오늘의집 짝 지을 수 있음 · F 광고 보고도(승인 = 그날 체크 · 2026-10-17) · A 감시는 빠짐", JSON.stringify(pga) === JSON.stringify(["B", "D", "E", "F", "G", "H", "I", "J"]), { pa, pga });   // J = 키워드·소재 A/B 실험 (2026-10-17)
ck("지금 있는 할 일의 짝·담당만 (옮긴 옛 글자 여름 C 빼고 · 옛 기록은 그대로 둠)", JSON.stringify([liveAk("yeoreum", { actAk: { C: "ak_gh_ad", A: ["ak_gh_influch"], [NO_ACT]: "ak_c_b2c", Z: "x", B: "" } }), liveActOwners("uju", { actOwners: { D: "mini", B: "minji", E: "minji", C: "" } }), liveAk("x", null)]) === JSON.stringify([{ A: ["ak_gh_influch"], [NO_ACT]: ["ak_c_b2c"] }, { B: "minji" }, {}]));
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
ck("추천: 여름 D 공구 ← '(B2B)' 인플루언서 공동구매 제안(B2C 크루가 함) · 여름 A ← 그로홈 인플루언서 확보 · 여름 G ← 그로홈 인플루언서 리뷰 확보(보드 브랜드 먼저 · 2026-10-17 G)", by["yeoreum.D"] === "ak_gh_gb" && by["yeoreum.A"] === "ak_gh_influch" && by["yeoreum.G"] === "ak_gh_influrv", by);
ck("추천: B2B 보드 = 이름에 B2B 있는 것 · POUR스토어 것 (단단 체험단 · 척척 미전환·이탈자 · 튼튼 NPS·위탁) · B2C 겨울 G·바람 C(NPS · 2026-10-17 우주 F 에서) 는 (B2C) 것", by["dandan.B"] === "ak_trial" && by["cheokcheok.B"] === "ak_call_b2b" && by["cheokcheok.C"] === "akmuw1ygt4" && by["teunteun.A"] === "ak_nps_b2b" && by["teunteun.B"] === "ak_gh_resale" && by["gyeoul.G"] === "ak_call_b2c" && by["baram.C"] === "ak_nps_b2c", by);
ck("추천: B2B 보드는 B2B 표시 없는 업무를 안 가져감 ('체험단 모집 공지' = 여름 A · 그로홈·POUR스토어 둘 다) · 시공의뢰 이탈자는 B2B(척척 C)", ["grohome", "pourstore"].every((br) => { const x = rtSuggest([{ key: "fx:c1", name: "체험단 모집 공지", brand: br, kind: "fx", owners: ["cr"] }], {}); return x.length === 1 && x[0].mate === "yeoreum" && x[0].act === "A"; }) && rtSuggest([{ key: "fx:c2", name: "시공의뢰 이탈자 재연락", brand: "pourstore", kind: "fx" }], {})[0].mate === "cheokcheok");
ck("추천: AARRR 정리 (2026-10-17) — 추천제 = 바람 A · 타겟 광고 = 가을 G(그로홈 먼저) · 광고 확인 = 가을 F", by["baram.A"] === "ak_ref" && by["gaeul.G"] === "ak_gh_ad" && rtSuggest([{ key: "fx:ad", name: "광고 확인", brand: "common", kind: "fx", owners: ["mj"] }], {})[0].act === "F", by);
ck("추천: 겨울 C ← 상세페이지 고도화 · 봄 H ← 그로홈 프로모션 진행(2026-10-17 우주 E 에서) · 자사몰 UX/UI = 겨울 C(전환 · 볼트 설계표 E) — 할 일 하나엔 추천 하나라 상세가 먼저면 UX 는 추천 없음", by["gyeoul.C"] === "ak_gh_detail" && by["bom.H"] === "ak_gh_promo" && !by["uju.B"] && !Object.values(by).includes("ak_ux") && rtSuggest([{ key: "ak_ux", name: "자사몰 UX/UI 관리개선 확인", brand: "pourstore", kind: "ak" }], {})[0].mate === "gyeoul", by);
ck("추천: 바람 B ← 리뷰 프로모션 진행확인(2026-10-17 우주 D 에서) · 바람 D ← 리뷰·후기 유도(2026-10-17 겨울 E 에서 · 인플루언서 리뷰 아님)", by["baram.B"] === "ak_gh_rvpromo" && by["baram.D"] === "ak_review", by);
ck("추천: 할 일 하나엔 반복 실행 하나 · 반복 실행 하나엔 할 일 하나", new Set(S.map((s) => s.key)).size === S.length && new Set(S.map((s) => s.mate + s.act)).size === S.length);
ck("추천: 담당 한 명이면 그 사람(결과 확인·실행) · 여럿이면 비움", S.find((s) => s.key === "ak_gh_detail").owner === "u_ak_gh_detail" && S.find((s) => s.key === "ak_c_b2c").owner === "");
ck("추천: 아침 루틴(_)은 할 일 담당 안 정함", rtSuggest([{ key: "k1", name: "블로그 포스팅", brand: "pourstore", kind: "ak", owners: ["yj"] }], {})[0].owner === "");
const S2 = rtSuggest(rows, { gyeoul: { actAk: { C: "ak_ux" } } }), by2 = Object.fromEntries(S2.map((s) => [s.mate + "." + s.act, s.key]));
ck("추천: 이미 짝 지은 할 일·반복 실행은 건너뜀 · 옮긴 옛 글자 짝은 안 막음", !by2["gyeoul.C"] && !Object.values(by2).includes("ak_ux") && by2["bom.H"] === "ak_gh_promo" && rtSuggest(rows, { uju: { actAk: { E: "ak_gh_promo" } } }).some((x) => x.key === "ak_gh_promo" && x.mate === "bom"), by2);
const S3 = rtSuggest([{ key: "fx:f1", name: "리뷰 관리", brand: "grohome", kind: "fx" }], {});
ck("추천: 정한 날 체크도 (여러 번 하는 것이 없으면)", S3.length === 1 && S3[0].mate === "baram" && S3[0].act === "D", S3);
ck("추천: 재고·품절 = 이음 F (2026-10-17 · 비즈로지컴·쿠팡 로켓그로스)", rtSuggest([{ key: "fx:st", name: "주간 재고 점검", brand: "common", kind: "fx" }], {}).map((s) => s.mate + s.act).join() === "ieumF");

// 6. 할 일 하나 ↔ 열쇠 여러 개 (2026-10-17 사장님 "현재 반복업무들 모두 ai크루든 도움받아서 해야해")
ck("짝 값: 예전 글자 하나 · 목록 · 빈 값 · 같은 것 하나로", JSON.stringify([akKeys("ak_a"), akKeys(["ak_a", "fx:t1", "ak_a", ""]), akKeys(null), akKeys("")]) === JSON.stringify([["ak_a"], ["ak_a", "fx:t1"], [], []]));
ck("저장 모양: 없음 null · 하나 = 글자(예전과 같음) · 여럿 = 목록", pairVal([]) === null && pairVal(["ak_a"]) === "ak_a" && JSON.stringify(pairVal(["ak_a", "ak_b", "ak_a"])) === JSON.stringify(["ak_a", "ak_b"]));
ck("실행 업무 열쇠: aiAks 먼저 · 예전 aiAk", JSON.stringify([taskAks({ aiAks: ["a", "b"], aiAk: "a" }), taskAks({ aiAk: "x" }), taskAks({}), taskAks(null)]) === JSON.stringify([["a", "b"], ["x"], [], []]));
const PM = rtPairs({ yeoreum: { actAk: { A: ["ak_influch", "ak_gh_influch", "fx:t9"] } }, ieum: { actAk: { F: ["fx:s1", "fx:m1"] } }, gyeoul: { actAk: { A: ["fx:old"], C: "ak_gh_detail" } } });   // 겨울 A = 2026-10-17 이음 F 로 옮긴 옛 글자 → 안 셈
ck("짝 목록: 목록이면 열쇠마다 · 옮긴 옛 글자 빼고", PM.get("ak_influch")[0].act === "A" && PM.get("ak_gh_influch")[0].mate === "yeoreum" && PM.get("fx:t9")[0].act === "A" && PM.get("fx:s1")[0].mate === "ieum" && PM.get("fx:m1")[0].act === "F" && PM.get("ak_gh_detail")[0].act === "C" && !PM.has("fx:old"), [...PM.keys()]);
const S4 = rtSuggest(rows, { gyeoul: { actAk: { C: ["ak_gh_detail", "ak_ux"] } } }), by4 = Object.fromEntries(S4.map((s) => [s.mate + "." + s.act, s.key]));
ck("추천: 목록에 있는 열쇠도 이미 짝 지은 것", !by4["gyeoul.C"] && !Object.values(by4).includes("ak_ux") && !Object.values(by4).includes("ak_gh_detail"), by4);
// 누른 사람 것만 · 실행 브랜드와 맞는 것만 (실데이터 모양: 채림 인플루언서 POUR·그로홈 · 송희·미니 재고 · 전체 고정업무)
const DK = { users: [{ id: "chaerim", name: "양채림" }, { id: "songhee", name: "김송희" }, { id: "mini", name: "윤미니" }, { id: "minji", name: "김민지" }, { id: "old", name: "퇴사", active: false }],
  ak: { items: [{ id: "ak_influch", name: "인플루언서 확보", who: ["chaerim"], brand: "POUR스토어" }, { id: "ak_gh_influch", name: "인플루언서 확보", who: ["chaerim"], brand: "grohome" }, { id: "ak_kwtop", name: "검색키워드 상위노출 확인", who: ["songhee", "chaerim"], brand: "pourstore" }, { id: "ak_kwsel", name: "키워드 선정", whoNames: ["송희"], brand: "POUR스토어" }] },
  tasks: [{ id: "s1", isFixed: true, title: "재고 확인", assigneeIds: ["songhee"], brand: "common" }, { id: "m1", isFixed: true, title: "재고 확인/발주", assigneeIds: ["mini"], brand: "common" }, { id: "all", isFixed: true, title: "KPI 기재", forAll: true, brand: "common" },
    { id: "g1", isFixed: true, title: "오픈채팅 배포", assigneeIds: ["chaerim"], brand: "grohome" }, { id: "x1", isFixed: true, title: "퇴사자 일", assigneeIds: ["old"] },
    { id: "k3", isFixed: true, title: "주간 미팅", assigneeIds: ["songhee", "chaerim", "mini"], brand: "common" }] };
ck("열쇠 이름 · 담당 (이름으로 맞춘 행동지표 · '전체' 고정업무는 따로 정한 사람 없음 · 쉬는 사람 빼고)", keyName(DK, "fx:s1") === "재고 확인" && keyName(DK, "ak_kwsel") === "키워드 선정" && keyName(DK, "fx:없음") === ""
  && JSON.stringify([keyOwners(DK, "ak_kwsel"), keyOwners(DK, "ak_kwtop"), keyOwners(DK, "fx:all"), keyOwners(DK, "fx:x1")]) === JSON.stringify([["songhee"], ["songhee", "chaerim"], [], []]), [keyOwners(DK, "ak_kwsel"), keyOwners(DK, "fx:all")]);
const tA = { aiAks: ["ak_influch", "ak_gh_influch", "fx:g1", "fx:all"], brand: "grohome" };
ck("[했어요] 셀 열쇠: 그로홈 실행 = 그로홈 인플루언서 + 그로홈 체크 + 전체 체크 (POUR 것은 안 셈)", countKeys(DK, tA, "chaerim").map((x) => x.key).join() === "ak_gh_influch,fx:g1,fx:all", countKeys(DK, tA, "chaerim").map((x) => x.key));
ck("[했어요] 셀 열쇠: 남의 것은 안 셈 (송희가 누르면 전체 체크만)", countKeys(DK, tA, "songhee").map((x) => x.key).join() === "fx:all");
ck("[했어요] 셀 열쇠: 담당을 아무도 안 정한 반복 실행 = 누른 사람에게 셈", countKeys({ ...DK, ak: { items: [{ id: "ak_free", name: "빈 담당", who: [] }] } }, { aiAk: "ak_free" }, "mini").length === 1);
{ // 달 A keyBy '신제품' (2026-10-17) — 본부장 신제품 상시 업무 8개 중 그 줄 이름이 든 것만 · 이름이 없거나 안 맞으면 정한 날 체크는 안 셈 · 여러 번 하는 것은 그대로
  const fxT = (id, title) => ({ id, title, isFixed: true, assigneeIds: ["GM"], brand: "grohome" });
  const DH = { users: [{ id: "GM", name: "허지은" }], ak: { items: [{ id: "ak_launch", name: "신제품 출시", who: ["GM"], brand: "grohome" }] }, tasks: [fxT("s1", "신제품 출시 :스티커페인트 제조사(용인) RnD/기획/인증/디자인"), fxT("h1", "신제품출시 : 헤라형 줄눈 제조사 소싱/기획/인증/디자인"), fxT("h2", "신제품출시 : 헤라형 줄눈보수제 제조사 소싱/기획/인증/디자인"), fxT("w1", "월 2회 신제품 출시")] };
  const tD = { aiBoard: "hq-plan", aiAct: "A", brand: "grohome", aiAks: ["fx:s1", "fx:h1", "fx:h2", "fx:w1", "ak_launch"] };
  const k = (p) => countKeys(DH, tD, "GM", "", p).map((x) => x.key).join();
  ck("[했어요] 달 A 신제품 이름 짝: 스티커페인트 = 그 체크만 · 헤라형 줄눈 = 둘 · 없는 이름·빈 이름 = 정한 날 체크 없음 · 행동지표는 늘 · 다른 할 일은 이름 안 봄", k("스티커 페인트") === "fx:s1,ak_launch" && k("헤라형 줄눈") === "fx:h1,fx:h2,ak_launch" && k("루바보드") === "ak_launch" && k("") === "ak_launch" && countKeys(DH, { ...tD, aiAct: "D" }, "GM", "", "루바보드").length === 5, [k("스티커 페인트"), k("헤라형 줄눈"), k("루바보드")]);
  ck("이름 비교 = 띄어쓰기·기호 무시", normK("신제품 출시 :스티커페인트") === "신제품출시스티커페인트" && normK(" 헤라형/줄눈 ") === "헤라형줄눈");
  ck("보고 승인 그날 체크 = 그 체크 시각이 됐을 때만 (시각 없으면 됨)", fxTimeCome("08:40", "10:00") && !fxTimeCome("16:30", "10:00") && fxTimeCome("16:30", "16:30") && fxTimeCome("", "07:00") && fxTimeCome(null, "07:00"));
}
ck("[했어요] 셀 열쇠: 브랜드 섞인 결과(실행 브랜드 없음) = 내 것 모두", countKeys(DK, { aiAks: ["ak_influch", "ak_gh_influch"] }, "chaerim").length === 2 && countKeys(DK, { aiAk: "ak_kwtop" }, "songhee")[0].kind === "ak");
// 그 줄 브랜드('브랜드' 칸 · aiItems[n].b) — 있으면 그 브랜드 + 브랜드 없는 열쇠만 · 없으면 실행 브랜드 → 같은 게 없으면 내 것 모두 (2026-10-17)
ck("[했어요] 줄 브랜드 POUR스토어 = POUR 인플루언서 + 전체 체크 (이름 'POUR스토어' 도 같은 브랜드)", countKeys(DK, tA, "chaerim", "pourstore").map((x) => x.key).join() === "ak_influch,fx:all", countKeys(DK, tA, "chaerim", "pourstore").map((x) => x.key));
ck("[했어요] 줄 브랜드가 내 열쇠 브랜드와 다르면 안 셈 (그로홈 줄 · 채림 POUR 키워드만)", countKeys(DK, { aiAks: ["ak_kwtop"], brand: "grohome" }, "chaerim", "grohome").length === 0);
ck("[했어요] 줄 브랜드 없고 그로홈 보드에 POUR 짝 하나뿐 = 셈 (겨울 E 리뷰·후기 유도 같은 것)", countKeys(DK, { aiAks: ["ak_kwtop"], brand: "grohome" }, "chaerim").map((x) => x.key).join() === "ak_kwtop");
// 열쇠 담당별 실행 업무 (겨울 A 송희·미니 · 가을 E 민지 실행 + 송희 키워드 선정)
const ex = { id: "aix_q", assigneeId: "songhee", assigneeIds: ["songhee"], brand: "grohome", ackAt: "T", aiAk: "fx:s1", aiAks: ["fx:s1", "fx:m1"] };
const sp = splitExec(DK, ex, ["fx:s1", "fx:m1", "fx:all"], { id: "songhee" }, "T2");
ck("실행 업무 나눔: 실행 담당(송희) 말고 열쇠 담당(미니) 몫 하나 · 그 사람 열쇠만 · id~사람 · 받음 표시 없음 · '전체' 고정업무로는 안 나눔", sp.length === 1 && sp[0].id === "aix_q~mini" && sp[0].assigneeId === "mini" && sp[0].aiAks.join() === "fx:m1" && sp[0].aiAk === "fx:m1" && !("ackAt" in sp[0]), sp);
const sp2 = splitExec(DK, { ...ex, assigneeId: "minji", assigneeIds: ["minji"], brand: "pourstore" }, ["ak_kwsel", "ak_gh_influch", "fx:x1"], { id: "minji" }, "T2");
ck("실행 업무 나눔: 실행 담당이 열쇠 담당이 아니어도 · 브랜드 칸 없는 결과면 열쇠 담당 모두 · 쉬는 사람은 빼고", sp2.map((x) => x.id + ":" + x.aiAks.join("+")).join() === "aix_q~songhee:ak_kwsel,aix_q~chaerim:ak_gh_influch", sp2.map((x) => x.id));
const exB = { ...ex, aiItems: [{ n: "B1", t: "그로홈 키워드", b: "grohome" }, { n: "B2", t: "브랜드 칸 비움" }, { n: "B3", t: "POUR 키워드", b: "pourstore" }] };
const sp3 = splitExec(DK, exB, ["ak_kwtop"], { id: "songhee" }, "T2");
ck("실행 업무 나눔: 번호 = 그 사람 열쇠 브랜드 줄 + 브랜드 칸 빈 줄 (채림 POUR 키워드 → B2·B3)", sp3.length === 1 && sp3[0].assigneeId === "chaerim" && sp3[0].aiItems.map((x) => x.n).join() === "B2,B3", sp3.map((x) => [x.assigneeId, (x.aiItems || []).map((y) => y.n)]));
ck("실행 업무 나눔: 셀 줄이 없으면 안 만듦 (모두 그로홈 줄 · POUR 열쇠 담당)", splitExec(DK, { ...ex, aiItems: [{ n: "B1", b: "grohome" }] }, ["ak_kwtop"], { id: "songhee" }, "T2").length === 0);
ck(`실행 업무 나눔: ${SPLIT_MAX + 1}명+ 같이 하는 일(주간 미팅)은 안 나눔 — 누른 사람 몫만`, splitExec(DK, ex, ["fx:k3"], { id: "songhee" }, "T2").length === 0 && countKeys(DK, { aiAks: ["fx:k3"] }, "mini").length === 1);
ck("실행 업무 나눔: 누른 사람 몫이면 받음 표시 · 실행 없으면 없음", splitExec(DK, ex, ["fx:m1"], { id: "mini" }, "T2")[0].ackAt === "T2" && splitExec(DK, null, ["fx:m1"], null, "T").length === 0);
const n3 = rtAiNow("ak_gh_influch", PM.get("ak_gh_influch"), [], [{ id: "aix_z", aiAsk: "z", aiAk: "ak_influch", aiAks: ["ak_influch", "ak_gh_influch"], status: "todo", assigneeIds: ["chaerim"], aiItems: [{ n: "A1" }] }], "chaerim");
ck("남은 AI 일: 실행 업무 열쇠 목록(aiAks)으로 찾음", n3.exec.map((t) => t.id).join() === "aix_z", n3.exec.map((t) => t.id));

console.log(`${ok}/${ok + bad} 통과${bad ? ` · ${bad} 실패` : ""}`);
process.exit(bad ? 1 : 0);
