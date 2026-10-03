// 관리자 대시보드 — 탭들이 같이 쓰는 작은 조각과 계산 (저장하지 않음)
import { useEffect, useRef } from "react";
import { ymd, addDays, ddays, md, isDone, ownersOf, dueOf, reqOf, nameOf } from "../model.js";
import { tidyQueues, dayLoadDelta } from "../views.js";
import { BulkBar } from "../pick.jsx";
import { C } from "../ui.jsx";

export const MY_URL = "./os2.html";   // 실사용 화면 (같은 폴더)
export const isLaunchP = (p) => String((p && p.id) || "").startsWith("lb_");
export const openOneOff = (t) => !!t && !t.isFixed && !isDone(t) && t.status !== "review" && t.status !== "hold";
export const WDK = ["일", "월", "화", "수", "목", "금", "토"];
export const wdOf = (key) => WDK[new Date(key + "T00:00:00").getDay()];
export const pName = (D, pid) => ((D.projects || []).find((p) => p.id === pid) || {}).title || "";

// 위험 등급 꼬리표 (관리자에만) — 빨강은 지남·막힘·한도 넘음에만 쓰므로 '위험'은 진한 네이비 바탕
const LV = { 위험: { c: "#fff", bg: C.ink }, 주의: { c: C.navy, bg: C.soft }, 순조: { c: C.green, bg: "#EAF4EE" } };
export const Lv = ({ v, small }) => <span className={"a-lv" + (small ? " sm" : "")} style={{ color: (LV[v] || LV.순조).c, background: (LV[v] || LV.순조).bg }}>{v}</span>;

// 정리 묶음 = views.tidyQueues + 한눈에 위험 칸이 여는 묶음 2개(지남 · 요청)
//  지남 = 기한이 지난 열린 일(확인 대기·보류 빼고) · 요청 = 기한 조정 요청 + 3일 넘은 확인 요청 + 7일 넘게 안 받은 맡김
export function adminQueues(D, idx, now) {
  const key = ymd(now), base = tidyQueues(D, idx, now), temp = (idx && idx.temp) || new Set();
  const open = (D.tasks || []).filter((t) => !t.isFixed && !isDone(t));
  const d7 = new Date(now - 7 * 864e5).toISOString();
  const late = open.filter((t) => t.status !== "review" && t.status !== "hold" && dueOf(t) && dueOf(t) < key);
  const req = open.filter((t) => t.dueReq
    || (t.status === "review" && t.reviewAt && ddays(String(t.reviewAt).slice(0, 10), key) < -3)
    || ((reqOf(t) || (t.assignedBy && !ownersOf(t).includes(t.assignedBy))) && !t.ackAt && t.status === "todo" && !temp.has(t.id) && String(t.requestedAt || t.assignedAt || "9") < d7));
  const extra = [
    { k: "late", label: "기한 지난 일", by: "person", items: late },
    { k: "req", label: "요청 (기한 조정 · 3일 넘은 확인 · 7일 넘게 안 받은 맡김)", by: "person", items: req },
  ];
  const all = [...base, ...extra.filter((x) => x.items.length)].sort((a, b) => b.items.length - a.items.length);
  const byK = Object.fromEntries([...base, ...extra].map((x) => [x.k, x]));
  return { all, byK, n: (k) => (byK[k] ? byK[k].items.length : 0) };
}

// 미리 보기 문장용: 옮겨지는 기한 때문에 가장 많이 줄어드는 날 · 가장 많이 늘어나는 날
export function dayDelta(D, changes) {
  const { before, after } = dayLoadDelta(D, changes);
  const olds = [...new Set(changes.map((x) => dueOf(x.task)).filter(Boolean))].sort((a, b) => (before[b] || 0) - (before[a] || 0));
  const news = [...new Set(changes.map((x) => x.due).filter(Boolean))].sort((a, b) => ((after[b] || 0) - (before[b] || 0)) - ((after[a] || 0) - (before[a] || 0)));
  const out = [];
  if (olds[0]) out.push({ d: olds[0], b: before[olds[0]] || 0, a: Math.max(0, after[olds[0]] || 0) });
  if (news[0] && news[0] !== olds[0]) out.push({ d: news[0], b: before[news[0]] || 0, a: after[news[0]] || 0 });
  return out;
}
// 사람별 이번 주(오늘부터 7일) 마감 수 변화 — 많이 바뀐 사람 순
export function weekDelta(D, changes, key) {
  const a = key, b = addDays(key, 6), inW = (d) => !!d && d >= a && d <= b;
  const before = {}, after = {};
  (D.tasks || []).filter(openOneOff).forEach((t) => { const d = dueOf(t); if (inW(d)) { const u = ownersOf(t)[0] || ""; before[u] = (before[u] || 0) + 1; } });
  Object.assign(after, before);
  changes.forEach((x) => { const t = x.task; if (!openOneOff(t)) return; const u = ownersOf(t)[0] || ""; if (inW(dueOf(t))) after[u] = (after[u] || 0) - 1; if (inW(x.due)) after[u] = (after[u] || 0) + 1; });
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((u) => u && (before[u] || 0) !== (after[u] || 0))
    .map((u) => ({ u, b: before[u] || 0, a: after[u] || 0 })).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
}
export const deltaLine = (D, changes, key) => {
  const dd = dayDelta(D, changes).map((x) => `${md(x.d)} 마감 ${x.b} → ${x.a}`);
  const wd = weekDelta(D, changes, key).slice(0, 2).map((x) => `${nameOf(D.users, x.u)} 이번 주 ${x.b} → ${x.a}`);
  return [...dd, ...wd];
};

// 고른 업무 아래 막대 (100건 넘으면 먼저 알려 줌)
export function SelBar({ D, cu, A, sel, setSel, setToast }) {
  const was = useRef(0);
  useEffect(() => { if (sel.size > 100 && was.current <= 100 && setToast) setToast({ text: "한 번에 100건까지예요 · 몇 묶음을 풀어 주세요" }); was.current = sel.size; }, [sel.size]);
  if (!sel.size) return null;
  return <>
    {sel.size > 100 && <div className="a-limit" role="alert">{sel.size}건 골랐어요 · 한 번에 100건까지예요</div>}
    <BulkBar D={D} cu={cu} A={A} ids={sel} clear={() => setSel(new Set())} />
  </>;
}
// 고르기 막대가 내용을 가리지 않게 아래 여백
export const BulkPad = ({ on }) => (on ? <div style={{ height: 150 }} aria-hidden="true" /> : null);

// 한 줄 버튼 (네이비 글자, 누르면 이동)
export function LineBtn({ children, onClick, label }) {
  return <button type="button" className="a-linebtn" onClick={onClick} title={label}><span className="tx">{children}</span><span className="a-go">›</span></button>;
}
