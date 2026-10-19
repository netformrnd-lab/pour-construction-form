// 업무OS v2 — 반복 실행 입력 자료 (계산만 · 저장 없음 · 시험 rtinput.test.mjs)
//   2026-10-19 김송희 "김민지님 금 16:30 사장님 보고(반복 실행)는 그대로 두되, 입력 자료는 그날 아침 adreports 주간 보고서를 쓰도록 안내해 주세요"
//   → 이름이 맞는 반복 실행(정한 날 체크)의 오늘 줄 아래 · 시트 위에 '입력 · 광고 주간 보고서 10/23(금) 08:30 ›' (허브 ads.html#{그 금요일}-weekly · 새 창)
//   실데이터(업무 메모)는 고치지 않음 — 규칙은 여기 한 곳 (이름이 바뀌면 re 를 고침)
import { HUB_ADS, AD_ROUTINE, weeklyIdOf } from "../../marketing-hub/adops.js";
import { ymd } from "./model.js";

const DOW = "일월화수목금토";
const dayL = (k) => { const d = new Date(k + "T00:00:00"); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
// 가장 가까운 지난 금요일 (금요일이면 그날) — 광고 주간 보고서는 금 08:30 에 올라옴 (김송희 Aside '광고' 루틴 · 예전 금 16:00)
export const lastFri = (key) => { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); return ymd(d); };
export const RT_INPUTS = [
  { k: "adsWeekly", re: /광고\s*주간\s*분석/, what: "광고 주간 보고서",
    of: (key) => { const fri = lastFri(key); return { date: fri, when: `${dayL(fri)} ${AD_ROUTINE.at}`, url: `${HUB_ADS}#${weeklyIdOf(fri)}`,
      why: `그날 아침 ${AD_ROUTINE.owner} Aside '${AD_ROUTINE.project}' 루틴이 올린 것 (예전 금 16:00 → 금 ${AD_ROUTINE.at}) · 이번 주 배운 것 · 다음 주 바꿀 안 · 메타 판정` }; } },
];
// 이 반복 실행의 입력 자료 → {k, what, date, when, url, why} | null (고정업무 · 이름이 맞을 때만 · 없앤 것 빼고)
export function rtInputOf(t, key) {
  if (!t || !t.isFixed || t.removed || !key) return null;
  const r = RT_INPUTS.find((x) => x.re.test(String(t.title || "")));
  return r ? { k: r.k, what: r.what, ...r.of(key) } : null;
}
