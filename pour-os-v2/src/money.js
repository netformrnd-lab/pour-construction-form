// 업무OS v2 — 돈·결재 알림 (계산만 · 저장 없음 · 시험 money.test.mjs)
//   사장님 결정 2026-10-17 (볼트 짝 설계표 F · "응"): 돈·결재 7건은 AI 크루를 붙이지 않음 — AI 는 금액·원가를 안 봄
//   → '정산서 받았나 · 마감일' 알림만 · 승인 단계 없이 그 고정업무 담당 '확인할 것' 한 줄 (끝내면 반복 실행에서 체크 → 줄 사라짐)
//   매월 = 마감(그 달 할 날) 평일 MONEY_LEAD 일 전부터 · 지나면 빨강 '마감 지남' · 매일 = 그 시각 + 1시간이 지나도 체크 전이면
//   금액·거래처 단가는 이 줄 어디에도 안 씀 (고정업무 제목만)
//   줄 [완료](chk) = 그 고정업무 오늘 체크(A.fxToggle · 5초 되돌리기) · 빨강 = 위로(ord ORD_RED)
//   지난달 마감 지남 = 읽음으로 닫는 줄(keep 아님 · [완료] 없음) — 매월 체크는 그 달 몫이라 새 달에 체크하면 이번 달 몫이 끝난 것으로 보여서
import { ymd, md, hm, addDays, isRemoved, fxIds, fxDueOn, fxMeDone, fxMissOf, fxMonthDay, fxTime, wdBetween } from "./model.js";

// 고정업무 id → 알림 한 줄 (볼트 설계표 F 의 7건 · 담당은 고정업무 담당 그대로)
export const MONEY_FX = {
  t1790728334599: "하이웍스 품의 — 올라온 품의가 있는지",
  t1790831555155: "부서 월간 고정지출 품의 — 이번 달 품의를 올렸는지",
  t1790899441313: "한진택배 품의 — 청구서 받았는지 · 품의 작성",
  t1790918718994: "시온 월말 정산 — 정산서 받았는지",
  t1790926024678: "나비엠알오 월말 정산 — 정산서 받았는지",
  tmuxckq6adiw5: "철물점 월말 정산서 — 보낼 정산서가 준비됐는지",
  tmuxe3zc8mukt: "3PL 정산서 — 받았는지 · 확인·정산",
};
export const MONEY_LEAD = 3, MONEY_LATE = 5, ORD_RED = 1.9;   // 매월 = 마감 평일 3일 전부터 · 지난달 마감을 못 했으면 새 달 평일 5일 동안 · 빨강 줄 = 기한 조정 요청보다 위
const addMin = (t, n) => { const x = Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5)) + n; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

// 나에게 온 돈·결재 줄 — kind 'money' · keep(끝낼 때까지) · 마감 지남 = red · 누르면 그 고정업무(taskId)
export function moneyInbox(D, uid, now = new Date()) {
  const key = ymd(now), nowHM = hm(now), out = [];
  ((D && D.tasks) || []).forEach((t) => {
    if (!t || !t.isFixed || !MONEY_FX[t.id] || isRemoved(t) || t.paused || !fxIds(t).includes(uid)) return;
    const rt = t.recurType || "daily", why = MONEY_FX[t.id];
    const base = { kind: "money", tag: "정산·결재", taskId: t.id, keep: true, whoName: "정산·결재 알림" };
    if (rt === "monthly") {
      if (fxMeDone(t, uid, key)) return;   // 이번 달 했으면 없음
      const due = fxMonthDay(t, key), miss = fxMissOf(t, uid, key);   // 밀림 = 만들기 전 할 날은 안 셈 (model.fxMissOf)
      if (miss) return out.push({ ...base, id: `mn:${t.id}:${miss}`, red: true, ord: ORD_RED, chk: true, at: miss + "T00:00:00", title: `${t.title} · 마감 지남 (${md(miss)})`, text: `${why} · 끝냈으면 [완료] · 금액은 업무OS 에 쓰지 않아요` });
      // 지난달 마감(말일 등)을 못 했으면 새 달 평일 MONEY_LATE 일 동안 빨강 — 이번 달 체크가 지난달 몫까지 되는 모델이라 체크하면 사라짐
      const pk = addDays(key.slice(0, 7) + "-01", -1), pd = fxMonthDay(t, pk), born = String(t.createdAt || "").slice(0, 10);
      if (!fxMeDone(t, uid, pk) && (!born || born <= pd) && wdBetween(pd, key) <= MONEY_LATE && !fxMeDone(t, uid, key))
        return out.push({ ...base, keep: false, id: `mn:${t.id}:${pd}`, red: true, ord: ORD_RED, at: pd + "T00:00:00", title: `${t.title} · 지난달 마감 지남 (${md(pd)})`, text: `${why} · 지난달 체크가 없어요 · 끝냈으면 읽음 표시로 닫기 (반복 실행 체크는 이번 달 몫) · 금액은 업무OS 에 쓰지 않아요` });
      if (key > due) return;   // 이번 달 할 날이 만들기 전이었음 → 다음 달부터
      const left = wdBetween(key, due);
      if (key !== due && left > MONEY_LEAD) return;
      return out.push({ ...base, id: `mn:${t.id}:${due}`, chk: true, at: key + "T00:00:00", title: `${t.title} · ${key === due ? "오늘 마감" : `마감 ${md(due)} · 평일 ${left}일 남음`}`, text: `${why} · 끝내면 [완료] · 금액은 업무OS 에 쓰지 않아요` });
    }
    if (!fxDueOn(t, key) || fxMeDone(t, uid, key)) return;   // 매일·매주 = 오늘 할 날 · 그 시각 + 1시간 지나도 체크 전
    const tm = fxTime(t, uid); if (tm && addMin(tm, 60) > nowHM) return;
    out.push({ ...base, id: `mn:${t.id}:${key}`, chk: true, at: key + "T" + (tm || "09:00") + ":00", title: `${t.title} · 아직 체크 전${tm ? ` (${tm})` : ""}`, text: `${why} · 끝내면 [완료]` });
  });
  return out;
}
// 다음 마감 (관리자·시험용) — 매월 = 이번 달 할 날 · 지났으면 다음 달
export const moneyDue = (t, key) => { const d = fxMonthDay(t, key); return d >= key ? d : fxMonthDay(t, addDays(d.slice(0, 7) + "-28", 7)); };
