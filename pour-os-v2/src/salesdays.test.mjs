// node src/salesdays.test.mjs — 날짜·채널·상품별 판매 (③ 결과 숫자 · 2026-10-17 · 계산만)
import { rollDays, hashOf, spanFrom, DAY_SPAN, DAY_MAX } from "./salesdays.js";
import { ghDays } from "./ghsales.js";
let ok = 0, bad = 0;
const ck = (name, cond, info) => { if (cond) ok++; else { bad++; console.log("✕", name, info === undefined ? "" : JSON.stringify(info)); } };
ck("35일 · 하루 300줄", DAY_SPAN === 35 && DAY_MAX === 300 && spanFrom("2026-10-17") === "2026-09-13");
const R = [{ date: "2026-10-15", c: "쿠팡", p: "유리블러 페인트", q: 2, r: 72000 }, { date: "2026-10-15", c: "쿠팡", p: "유리블러  페인트", q: 1, r: 36000 }, { date: "2026-10-15", c: "자사몰", p: "철제용 브러쉬 페인트", q: 6, r: 143400 },
  { date: "2026-10-14T09:00:00", c: "", p: "", q: "3", r: "1000.4" }, { date: "2026-09-01", c: "쿠팡", p: "옛 것", q: 1, r: 1 }, { date: "2026-10-18", c: "쿠팡", p: "내일", q: 1, r: 1 }, { date: "", c: "쿠팡", p: "날짜 없음", q: 1, r: 1 }, null];
const d = rollDays(R, "2026-10-17");
ck("같은 날·채널·상품(띄어쓰기 달라도) 한 줄 · 큰 금액 먼저 · 기간 밖·날짜 없음 빼고", JSON.stringify(d.days["2026-10-15"]) === JSON.stringify([{ c: "자사몰", p: "철제용 브러쉬 페인트", q: 6, r: 143400 }, { c: "쿠팡", p: "유리블러 페인트", q: 3, r: 108000 }]) && !d.days["2026-09-01"] && !d.days["2026-10-18"], d.days);
ck("빈 채널 = 기타 · 빈 상품 = (이름 없음) · 숫자 글자도 더함 · 금액 반올림", JSON.stringify(d.days["2026-10-14"]) === JSON.stringify([{ c: "기타", p: "(이름 없음)", q: 3, r: 1000 }]), d.days["2026-10-14"]);
ck("from · to(판매가 있는 마지막 날) · n · 날짜 순서", d.from === "2026-09-13" && d.to === "2026-10-15" && d.n === 3 && Object.keys(d.days).join() === "2026-10-14,2026-10-15", d);
ck("없으면 빈 것", JSON.stringify(rollDays([], "2026-10-17")) === JSON.stringify({ from: "2026-09-13", to: "", days: {}, n: 0 }));
const many = Array.from({ length: 320 }, (_, i) => ({ date: "2026-10-16", c: "쿠팡", p: "상품" + i, q: 1, r: i }));
ck("하루 300줄까지 (금액 큰 순)", rollDays(many, "2026-10-17").days["2026-10-16"].length === 300 && rollDays(many, "2026-10-17").days["2026-10-16"][0].p === "상품319");
ck("지문: 같은 내용 = 같음 · 다르면 다름", hashOf(d.days) === hashOf(rollDays(R, "2026-10-17").days) && hashOf(d.days) !== hashOf(rollDays(R.slice(1), "2026-10-17").days));
const big = []; for (let k = 0; k < 35; k++) { const dd = new Date(2026, 9, 17 - k), d0 = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`; for (let i = 0; i < 300; i++) big.push({ date: d0, c: "스마트스토어", p: "아주 긴 상품 이름 테스트 " + "가".repeat(40) + i, q: 1, r: i }); }
const bd = rollDays(big, "2026-10-17");
ck("문서 한도(1MB) 넘치면 오래된 날부터 뺌 · from 은 남은 첫날 · 최근 날은 남음", JSON.stringify(bd.days).length * 2 <= 600000 && !!bd.days["2026-10-17"] && bd.from === Object.keys(bd.days)[0] && bd.from > "2026-09-13" && bd.n === Object.values(bd.days).reduce((a, x) => a + x.length, 0), [bd.from, bd.n, JSON.stringify(bd.days).length]);
// 그로홈 대시보드 salesRecords 모양 (실데이터 2026-10-15) → 채널 = platform 그대로
const gh = ghDays([{ date: "2026-10-15", platform: "자사몰", productName: "철제용 브러쉬 페인트", quantity: 6, totalPrice: 143400 }, { date: "2026-10-15", platform: "위탁판매", productName: "유리블러 페인트", quantity: 1, totalPrice: 36000 }], "2026-10-17");
ck("그로홈: platform → 채널 · productName·quantity·totalPrice", JSON.stringify(gh.days["2026-10-15"]) === JSON.stringify([{ c: "자사몰", p: "철제용 브러쉬 페인트", q: 6, r: 143400 }, { c: "위탁판매", p: "유리블러 페인트", q: 1, r: 36000 }]) && gh.to === "2026-10-15", gh);
console.log(`${ok}/${ok + bad} 통과${bad ? ` · ${bad} 실패` : ""}`); if (bad) process.exit(1);
