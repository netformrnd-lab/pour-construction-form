// 관리자 · 일의 양 계산 (저장하지 않음) — 업무를 2가지로만 본다
//  반복 업무 = 고정업무(v2 tasks isFixed) + 행동지표(버전1 actionKPIs, 읽기만)
//  프로젝트 업무 = 기한 있는 한 번짜리 일(고정업무 아님)
//  주 = 월~일. 지난 날에 안 한 것 = 못 함, 오늘부터 남은 것 = 남음
import { addDays, isDone, isMine, dueOf, isOffDay, fxPeople, fxDueOn, fxDoneOn, ownersOf } from "../model.js";
import { akBy, akWho, akStart } from "../../../pour-os/src/actionKpi.js";

const openOneOff = (t) => !!t && !t.isFixed && !isDone(t) && t.status !== "review" && t.status !== "hold";   // common.jsx 와 같은 기준 (계산 시험용으로 여기 둠)
export const finAt = (t) => String((t && (t.finishedAt || t.doneAt)) || "");
const iso0 = (d) => new Date(d + "T00:00:00").toISOString();   // 그 날 0시(이 기기 시각) → 끝낸 시각과 비교
const WDK = ["일", "월", "화", "수", "목", "금", "토"];

// 고정업무 한 건의 그 주 할 날들 → 날마다 { d, done, state: ok | miss | left }
//  매일: 평일만 · 그 날 체크 / 매주: 정한 요일, 요일이 하나면 그 주 아무 날 체크도 인정 / 매월: 그 달 안 체크
export function fxWeek(t, uid, from, key, checks) {
  const rt = t.recurType || "daily", to = addDays(from, 6);
  const mine = (checks || []).filter((c) => c && c.on && c.taskId === t.id && c.uid === uid).map((c) => c.date);
  const last = fxDoneOn(t, uid); if (last && !mine.includes(String(last).slice(0, 10))) mine.push(String(last).slice(0, 10));   // 체크 기록 전(버전1에서 복사한) 마지막 체크 날도 인정
  const days = [...Array(7)].map((_, i) => addDays(from, i)).filter((d) => fxDueOn(t, d) && (rt !== "daily" || !isOffDay(d)));
  const single = rt === "weekly" && days.length === 1;
  return days.map((d) => {
    const done = rt === "monthly" ? mine.some((x) => x.slice(0, 7) === d.slice(0, 7) && x <= to)
      : single ? mine.some((x) => x >= from && x <= to) : mine.includes(d);
    return { d, wd: WDK[new Date(d + "T00:00:00").getDay()], done, state: done ? "ok" : d < key ? "miss" : "left" };
  });
}
// 행동지표 한 건의 그 주 목표: 주간 = goal · 월간 = goal÷4 · 분기 = goal÷13 (올림). %·실패 기준 항목은 빼고
export const akWeekGoal = (it) => { const g = +it.goal || 1; return it.cyc === "W" ? g : it.cyc === "Q" ? Math.ceil(g / 13) : Math.ceil(g / 4); };
export const akCountable = (it) => it && it.active !== false && !it.perFail && it.unit !== "%";

// 한 사람 · 한 주
export function weekLoad({ D, uid, from, key, checks, akItems, akDocs, temp, noTemp }) {
  const to = addDays(from, 6), past = to < key;
  // 프로젝트 업무
  const open = (D.tasks || []).filter((t) => openOneOff(t) && isMine(t, uid) && dueOf(t) >= from && dueOf(t) <= to && !(noTemp && temp && temp.has(t.id)));
  const doneL = (D.tasks || []).filter((t) => !t.isFixed && isDone(t) && isMine(t, uid) && finAt(t) >= iso0(from) && finAt(t) < iso0(addDays(to, 1)));
  const late = open.filter((t) => dueOf(t) < key);
  const one = { open: open.length, late: late.length, left: open.length - late.length, done: doneL.length, total: open.length + doneL.length, tempN: temp ? open.filter((t) => temp.has(t.id)).length : 0 };
  // 반복 업무
  const items = [];
  (D.tasks || []).filter((t) => t.isFixed && !t.paused && !t.deleted && fxPeople(D.users, t).includes(uid)).forEach((t) => {
    const days = fxWeek(t, uid, from, key, checks); if (!days.length) return;
    const done = days.filter((x) => x.done).length, miss = days.filter((x) => x.state === "miss").length;
    items.push({ kind: "fx", id: t.id, title: t.title, due: days.length, done, miss, left: days.length - done - miss, days });
  });
  (akItems || []).filter((it) => akCountable(it) && akWho(D.users, it).includes(uid) && akStart(it) <= to).forEach((it) => {
    const goal = akWeekGoal(it), got = +((akBy(akDocs || {}, it, from) || {})[uid] || 0), done = Math.min(got, goal), short = goal - done;
    items.push({ kind: "ak", id: it.id, title: it.name, due: goal, done, got, miss: past ? short : 0, left: past ? 0 : short, cyc: it.cyc, unit: it.unit || "" });
  });
  const sum = (k) => items.reduce((a, x) => a + x[k], 0);
  const rep = { due: sum("due"), done: sum("done"), miss: sum("miss"), left: sum("left"), items };
  return { one, rep };
}
// 칸 아래 한 줄: 가장 많이 못 한(남은) 것 2개
export const topMiss = (items, n = 2) => items.filter((x) => x.miss + x.left > 0).sort((a, b) => b.miss - a.miss || b.left - a.left).slice(0, n)
  .map((x) => `${x.title.length > 10 ? x.title.slice(0, 10) + "…" : x.title} ${x.miss || x.left}`).join(" · ");
// 프로젝트 칸 아래 한 줄
export const ownersLine = (t, users) => ownersOf(t).map((id) => ((users || []).find((u) => u.id === id) || {}).name).filter(Boolean).join(", ");
