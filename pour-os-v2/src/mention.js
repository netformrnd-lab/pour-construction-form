// 업무OS v2 — @ 태그 (댓글에서 사람 부르기) + 문자 알림 규칙 (계산만 · 저장·보내기는 core)
// 사용자 결정 2026-10-05: 앱 안 '확인할 것'엔 늘 · 문자는 08:00~18:00 안에서 각자 정한 시간만 · 주말·공휴일은 각자(기본 안 보냄)
//   · 10분 안에 여러 번 불리면 한 통으로 묶음 · 나·사용 안 하는 사람·번호 없는 사람에겐 문자 안 감 · 시간 밖에 불리면 앱에만(나중에 몰아서 보내지 않음)
//   · 번호는 관리자 › 사람에서 마스터가 넣음(users.phone) · 설정은 더보기 › 문자 알림(users.sms = {on, weekend, from, to})
import { isOffDay, ymd } from "./model.js";

export const SMS_FROM = "08:00", SMS_TO = "18:00", SMS_GAP_MIN = 10;
const clean = (s) => String(s || "").replace(/\s/g, "");

// 글 속 @이름 → 사람 번호들 (같은 이름 → 끝이 같은 사람이 딱 1명일 때만 · '@송희'도 김송희)
export function parseMentions(text, users) {
  const act = (users || []).filter((u) => u && u.active !== false && u.name);
  const out = new Set();
  (String(text || "").match(/@[^\s@,.!?·:;()\[\]{}"'<>]+/g) || []).forEach((tok) => {
    const n = clean(tok.slice(1)); if (n.length < 2) return;
    const ex = act.find((u) => clean(u.name) === n);
    if (ex) { out.add(ex.id); return; }
    const c = act.filter((u) => clean(u.name).endsWith(n) || n.startsWith(clean(u.name)));
    if (c.length === 1) out.add(c[0].id);
  });
  return [...out];
}
// 입력 중 '@글자' 뒤에 보일 사람 (끝에 쓰고 있는 @토막 기준)
export function mentionQuery(text) { const m = /(?:^|\s)@([^\s@]*)$/.exec(String(text || "")); return m ? m[1] : null; }
export function mentionPick(text, users, meId) {
  const q = mentionQuery(text); if (q == null) return [];
  return (users || []).filter((u) => u && u.active !== false && u.name && u.id !== meId && (!q || clean(u.name).includes(clean(q)))).slice(0, 8);
}
export const insertMention = (text, name) => String(text || "").replace(/@([^\s@]*)$/, "@" + name + " ");

// 이 사람 문자 설정 (기본: 받음 · 주말·공휴일 안 받음 · 08:00~18:00) — 시간은 08~18 밖으로 못 넓힘
export function smsPref(u) {
  const s = (u && u.sms) || {}, clamp = (v, d) => (/^\d\d:\d\d$/.test(v || "") ? (v < SMS_FROM ? SMS_FROM : v > SMS_TO ? SMS_TO : v) : d);
  return { on: s.on !== false, weekend: !!s.weekend, from: clamp(s.from, SMS_FROM), to: clamp(s.to, SMS_TO) };
}
const hhmm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
// 지금 이 사람에게 문자를 보내도 되는 시간인가
export function smsOpen(u, now = new Date()) {
  const p = smsPref(u); if (!p.on) return false;
  if (!p.weekend && isOffDay(ymd(now))) return false;
  const t = hhmm(now); return t >= p.from && t < p.to;
}
// 문자를 받을 수 있는 사람인가 (번호 · 사용 중 · 나 아님 · 받음 켬)
export const smsTarget = (u, meId) => !!u && u.active !== false && u.id !== meId && /\d{9,}/.test(String(u.phone || "").replace(/\D/g, "")) && smsPref(u).on;
// 지금 묶음을 보낼 차례인가 (마지막으로 보낸 지 10분 지남)
export const smsDue = (q, now = new Date()) => !!q && (q.items || []).length > 0 && (!q.lastSentAt || now - new Date(q.lastSentAt) >= SMS_GAP_MIN * 60000);

// 문자 한 통 글 (여러 건이면 묶어서 · 링크는 첫 건)
export function smsText(items, base) {
  const a = (items || []).slice().sort((x, y) => String(x.at).localeCompare(String(y.at))); if (!a.length) return "";
  const one = (x) => `${x.from}: "${String(x.text || "").replace(/\s+/g, " ").slice(0, 40)}"${x.where ? ` (${String(x.where).slice(0, 20)})` : ""}`;
  const link = a[a.length - 1].link ? `\n${base || ""}${a[a.length - 1].link}` : "";
  return a.length === 1 ? `[업무OS] ${one(a[0])}${link}` : `[업무OS] 나를 부른 댓글 ${a.length}건\n${a.slice(-3).map(one).join("\n")}${a.length > 3 ? `\n외 ${a.length - 3}건` : ""}${link}`;
}
