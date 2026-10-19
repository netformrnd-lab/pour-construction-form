// node src/rtinput.test.mjs — 반복 실행 입력 자료 (2026-10-19 김송희 · 김민지 금 16:30 보고 = 그날 아침 광고 주간 보고서)
import { rtInputOf, lastFri } from "./rtinput.js";
import { HUB_ADS } from "../../marketing-hub/adops.js";
let n = 0, bad = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log("✗", name, "\n  got ", JSON.stringify(got), "\n  want", JSON.stringify(want)); } else console.log("✓", name); };
eq("지난 금요일 (금요일이면 그날 · 토·일·월~목 = 지난 금)", ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-29", "2026-10-30", "2026-11-02"].map(lastFri),
  ["2026-10-23", "2026-10-23", "2026-10-23", "2026-10-23", "2026-10-23", "2026-10-30", "2026-10-30"]);
const t = { id: "tmvbfgkwhtmms", isFixed: true, title: "광고 주간 분석 보고 (사장님께)", recurType: "weekly", weekDays: ["금"], fixedTime: "16:30" };
const x = rtInputOf(t, "2026-10-23");
eq("광고 주간 분석 보고 = 그날 아침 08:30 주간 보고서 · 허브 주소 #그 금요일-weekly", [x.k, x.what, x.when, x.url, x.date], ["adsWeekly", "광고 주간 보고서", "10/23(금) 08:30", `${HUB_ADS}#2026-10-23-weekly`, "2026-10-23"]);
eq("설명 = 김송희 Aside 광고 루틴 · 예전 16:00 → 08:30", x.why, "그날 아침 김송희 Aside '광고' 루틴이 올린 것 (예전 금 16:00 → 금 08:30) · 이번 주 배운 것 · 다음 주 바꿀 안 · 메타 판정");
eq("월요일에 열면 지난 금요일 보고서", rtInputOf(t, "2026-10-26").url, `${HUB_ADS}#2026-10-23-weekly`);
eq("이름이 다르면 · 한 번짜리 업무 · 없앤 것 · 날짜 없음 = 없음", [rtInputOf({ ...t, title: "광고 확인" }, "2026-10-23"), rtInputOf({ ...t, isFixed: false }, "2026-10-23"), rtInputOf({ ...t, removed: { at: "x" } }, "2026-10-23"), rtInputOf(t, ""), rtInputOf(null, "2026-10-23")], [null, null, null, null, null]);
eq("띄어쓰기 달라도 (광고주간분석)", rtInputOf({ ...t, title: "광고주간분석 보고" }, "2026-10-23").k, "adsWeekly");
console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
