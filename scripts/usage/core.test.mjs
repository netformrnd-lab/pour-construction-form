// node scripts/usage/core.test.mjs — 사용량 계산 시험 (통신 없음)
import assert from 'node:assert/strict';
import * as U from './core.mjs';
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('태평양 하루 경계 (여름: 한국 16시 · 겨울: 17시)', () => {
  assert.equal(U.ptDay('2026-10-11T06:59:00Z'), '2026-10-10');
  assert.equal(U.ptDay('2026-10-11T07:00:00Z'), '2026-10-11');
  assert.equal(U.ptDay('2026-11-10T07:30:00Z'), '2026-11-09');
  assert.equal(U.ptDay('2026-11-10T08:00:00Z'), '2026-11-10');
});
ok('한국 요일·시', () => {
  const k = U.kstParts('2026-10-12T00:20:00Z');
  assert.deepEqual(k, { date: '2026-10-12', hour: 9, wd: 1 });
});
const hourly = (day, perHour, hours = 24) => Array.from({ length: hours }, (_, h) => ({ s: new Date(Date.parse(day + 'T07:00:00Z') + h * 36e5).toISOString(), v: perHour }));
ok('시간 점 → 하루 합 · 저장 용량은 최대 · 빈 날은 앞날 용량', () => {
  const now = Date.parse('2026-10-12T00:20:00Z'); // 태평양 10/11
  const days = U.buildDays({ r: [...hourly('2026-10-09', 3000), ...hourly('2026-10-11', 1000, 17)], w: hourly('2026-10-09', 100), x: [],
    sb: [{ s: '2026-10-09T10:00:00Z', v: 2e9 }, { s: '2026-10-09T20:00:00Z', v: 3e9 }], eg: [] }, now);
  assert.deepEqual(days.map((d) => d.d), ['2026-10-09', '2026-10-10', '2026-10-11']);
  assert.equal(days[0].r, 72000); assert.equal(days[0].w, 2400); assert.equal(days[0].sb, 3e9);
  assert.equal(days[1].r, 0); assert.equal(days[1].sb, 3e9);
  assert.equal(days[2].r, 17000); assert.equal(days[2].today, true);
});
ok('예상 요금 = 무료 한도 넘은 만큼만 (+ Storage)', () => {
  assert.equal(U.dayCost({ r: 50000, w: 20000, x: 0, sb: 0, eg: 0 }).krw, 0);
  const c = U.dayCost({ r: 150000, w: 120000, x: 0, sb: 0, eg: 0 }); // 읽기 10만 초과 $0.06 + 쓰기 10만 초과 $0.18
  assert.deepEqual(c.over, { r: 100000, w: 100000, x: 0 });
  assert.equal(c.krw, Math.round(0.24 * 1400));
  assert.equal(U.dayCost({ r: 0, w: 0, x: 0, sb: 30e9, eg: 1e9 }).krw, Math.round((30 * 0.026 / 30 + 0.12) * 1400));
});
const mk = (from, n, r, w = 1000) => Array.from({ length: n }, (_, i) => { const t = new Date(from + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + i); return { d: t.toISOString().slice(0, 10), r, w, x: 0, sb: 0, eg: 0, today: false }; });
ok('이번 달 합 · 월말 예상 · 지난 7일', () => {
  const days = [...mk('2026-09-28', 13, 150000)]; days[days.length - 1].today = true; // 9/28~10/10, 오늘 = 10/10
  const s = U.summarize(days, Date.parse('2026-10-10T20:00:00Z'));
  const per = Math.round(1e5 / 1e5 * 0.06 * 1400); // 하루 84원
  assert.equal(s.ym, '2026-10'); assert.equal(s.monthFrom, '2026-10-01');
  assert.equal(s.monthKrw, per * 10);
  assert.equal(s.forecastKrw, per * 10 + per * 21);
  assert.equal(s.week.n, 7); assert.equal(s.week.avgR, 150000); assert.equal(s.week.overDays, 7); assert.equal(s.week.to, '2026-10-09');
  assert.equal(s.today.d, '2026-10-10'); assert.equal(s.yesterday.d, '2026-10-09');
});
ok('문자: 10만 원은 달마다 한 번 · 주간은 월요일 9시 뒤 한 번', () => {
  const s = { ym: '2026-10', monthKrw: 120000, week: { n: 7 } };
  const mon9 = Date.parse('2026-10-12T00:20:00Z'), mon8 = Date.parse('2026-10-11T23:50:00Z'), tue = Date.parse('2026-10-13T03:00:00Z');
  assert.deepEqual(U.decide(s, {}, mon9), { alert: true, weekly: true, weekKey: '2026-10-12' });
  assert.equal(U.decide(s, {}, mon8).weekly, false);
  assert.equal(U.decide(s, {}, tue).weekly, false);
  const sent = { alerts: { '2026-10': { sent: true } }, weekly: { '2026-10-12': { sent: true } } };
  assert.deepEqual(U.decide(s, sent, mon9), { alert: false, weekly: false, weekKey: '2026-10-12' });
  assert.equal(U.decide(s, { alerts: { '2026-10': { sent: false, err: '번호 없음' } } }, tue).alert, true); // 못 보냈으면 다음에 다시
  assert.equal(U.decide({ ...s, monthKrw: 99999 }, {}, tue).alert, false);
  assert.equal(U.decide(s, {}, tue, { alertKrw: 200000 }).alert, false);
});
ok('문자 글', () => {
  const days = mk('2026-10-01', 12, 150000); days[11].today = true;
  const s = U.summarize(days, Date.parse('2026-10-12T20:00:00Z'));
  const a = U.alertText(s, 'https://x/u'), w = U.weeklyText(s, 'https://x/u');
  assert.match(a, /이번 달 예상 요금이 100,000원을 넘었습니다/); assert.match(a, /10\/1~10\/12/); assert.match(a, /https:\/\/x\/u/);
  assert.match(w, /10\/5~10\/11/); assert.match(w, /읽기 하루 평균 150,000건/); assert.match(w, /무료 한도 넘은 날 7일/);
});
ok('Firestore 값 ↔ JS 그대로', () => {
  const o = { a: 1, b: 1.5, c: 'x', d: [1, { e: true }], f: null, g: { h: 'i' } };
  assert.deepEqual(U.fsDec(U.fsEnc(o)), o);
  assert.deepEqual(U.trimKeys({ '2026-01': 1, '2026-03': 3, '2026-02': 2 }, 2), { '2026-02': 2, '2026-03': 3 });
});
console.log(`${n}개 모두 통과`);
