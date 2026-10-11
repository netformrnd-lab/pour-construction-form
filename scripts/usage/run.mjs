// Firebase(pour-app-new) 사용량 측정 — GitHub Actions firebase-usage.yml 이 3시간마다 실행
//   Cloud Monitoring(Firestore 읽기·쓰기·삭제 + Storage) → 하루 사용량·예상 요금 → pour-os/v2/usage/pour-app-new (화면 /firebase-usage.html)
//   이번 달 예상 요금 ALERT_KRW(기본 10만 원) 넘으면 문자 1번(그 달) · 한국 월요일 9시 뒤 주간 보고 문자 1번
// 환경변수: SA_EMAIL · SA_KEY(서비스 계정 · '모니터링 뷰어' 역할) · ALERT_PHONE(문자 받을 번호) · OPS_TOKEN(/send-sms 서버 토큰 · Cloudflare 와 같은 값) · ALERT_KRW · FX
//   시험용: NOW · TOKEN_URL · MON_BASE · FS_BASE · SMS_URL (가짜 서버 — scripts/usage/e2e.mjs)
// 계산은 core.mjs (저장·통신 없음)
import { createSign } from 'node:crypto';
import * as U from './core.mjs';

const E = process.env;
const PROJECT = E.PROJECT || 'pour-app-new';
const TOKEN_URL = E.TOKEN_URL || 'https://oauth2.googleapis.com/token';
const MON = E.MON_BASE || 'https://monitoring.googleapis.com';
const FS = E.FS_BASE || 'https://firestore.googleapis.com';
const SMS_URL = E.SMS_URL || 'https://pour-construction-form.pages.dev/send-sms';
const PAGE_URL = E.PAGE_URL || 'https://pour-construction-form.pages.dev/firebase-usage.html';
const DOC = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/pour-os/v2/usage/${PROJECT}`;
const now = E.NOW ? Date.parse(E.NOW) : Date.now();
const opt = { alertKrw: Number(E.ALERT_KRW) || U.ALERT_KRW, fx: Number(E.FX) || U.FX, price: U.PRICE };

const b64u = (s) => Buffer.from(s).toString('base64url');
async function token() {
  const iat = Math.floor(Date.now() / 1000), key = String(E.SA_KEY).replace(/\\n/g, '\n');
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: E.SA_EMAIL, aud: TOKEN_URL, iat, exp: iat + 3600,
    scope: 'https://www.googleapis.com/auth/monitoring.read https://www.googleapis.com/auth/datastore' }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key, 'base64url');
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`서비스 계정 로그인 실패 ${r.status}: ${j.error_description || j.error || ''}`);
  return j.access_token;
}

// 지표 하나 — 최근 36일 · 1시간 칸 · 모든 시계열 합
async function series(tok, type, gauge) {
  const pts = []; let page = '';
  do {
    const q = new URLSearchParams({
      filter: `metric.type="${type}"`, 'interval.startTime': new Date(now - 36 * 864e5).toISOString(), 'interval.endTime': new Date(now).toISOString(),
      'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': gauge ? 'ALIGN_MAX' : 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    if (page) q.set('pageToken', page);
    const r = await fetch(`${MON}/v3/projects/${PROJECT}/timeSeries?${q}`, { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${(j.error && j.error.message) || ''}`.trim());
    for (const ts of j.timeSeries || []) for (const p of ts.points || []) {
      const v = p.value || {};
      pts.push({ s: (p.interval && (p.interval.startTime || p.interval.endTime)) || '', v: Number(v.int64Value ?? v.doubleValue ?? 0) });
    }
    page = j.nextPageToken || '';
  } while (page);
  return pts;
}

async function readState(tok) {
  const r = await fetch(DOC, { headers: { Authorization: `Bearer ${tok}` } });
  if (r.status === 404) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`저장 문서 읽기 실패 ${r.status}: ${(j.error && j.error.message) || ''}`); // 못 읽고 진행하면 같은 알림을 또 보낼 수 있음 → 멈춤
  return U.fsDec({ mapValue: { fields: j.fields || {} } });
}
async function writeDoc(tok, obj) {
  const r = await fetch(DOC, { method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: U.fsEnc(obj).mapValue.fields }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(`저장 실패 ${r.status}: ${(j.error && j.error.message) || ''}`); }
}
async function sms(text) {
  const to = String(E.ALERT_PHONE || '').replace(/[^0-9]/g, '');
  if (!to) return { ok: false, err: '문자 받을 번호(ALERT_PHONE) 없음' };
  try {
    const r = await fetch(SMS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(E.OPS_TOKEN ? { 'X-Ops-Token': E.OPS_TOKEN } : {}) }, body: JSON.stringify({ to, text }) }); // /send-sms 는 우리 사이트 아니면 이 토큰을 봄
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, err: `문자 실패 ${r.status}: ${j.error || ''}` };
  } catch (e) { return { ok: false, err: `문자 실패: ${e.message}` }; }
}

async function main() {
  if (!E.SA_EMAIL || !E.SA_KEY) {
    console.log('::warning::서비스 계정 시크릿(POUR_OS_FIREBASE_CLIENT_EMAIL · POUR_OS_FIREBASE_PRIVATE_KEY)이 없어 측정을 건너뜀');
    return 0;
  }
  const tok = await token();
  const got = {}, used = {}, errors = {};
  for (const [k, m] of Object.entries(U.METRICS)) {
    const errs = [];
    for (const name of m.names) {
      try {
        const pts = await series(tok, name, m.gauge);
        console.log(`[사용량] ${k} ${name} · 점 ${pts.length}개`);
        if (!got[k] || (!got[k].length && pts.length)) { got[k] = pts; used[k] = name; }
        if (pts.length) break; // 값이 있으면 다음 이름은 안 봄
      } catch (e) { errs.push(`${name}: ${e.message}`); console.error(`[사용량] ${k} ${name} 실패: ${e.message}`); }
    }
    if (!got[k]) { got[k] = []; errors[k] = errs.join(' / '); }
  }
  const state = await readState(tok);
  const s = U.summarize(U.buildDays(got, now), now, opt);
  const alerts = { ...(state.alerts || {}) }, weekly = { ...(state.weekly || {}) };
  const d = U.decide(s, { alerts, weekly }, now, opt), at = new Date().toISOString();
  let fail = Object.keys(errors).some((k) => U.METRICS[k].need);
  if (d.alert) {
    const r = await sms(U.alertText(s, PAGE_URL, opt));
    alerts[s.ym] = { at, krw: s.monthKrw, sent: r.ok, err: r.err || '' };
    console.log(r.ok ? `[사용량] 10만 원 알림 문자 보냄 (${s.monthKrw}원)` : `::error::10만 원 알림 문자 못 보냄 — ${r.err}`);
    if (!r.ok) fail = true;
  }
  if (d.weekly) {
    const r = await sms(U.weeklyText(s, PAGE_URL, opt));
    weekly[d.weekKey] = { at, sent: r.ok, err: r.err || '' };
    console.log(r.ok ? '[사용량] 주간 보고 문자 보냄' : `::error::주간 보고 문자 못 보냄 — ${r.err}`);
    if (!r.ok) fail = true;
  }
  await writeDoc(tok, {
    at, project: PROJECT, today: s.today, yesterday: s.yesterday, week: s.week, days: s.days,
    month: { ym: s.ym, from: s.monthFrom, krw: s.monthKrw, forecastKrw: s.forecastKrw },
    free: U.FREE, price: opt.price, fx: opt.fx, alertKrw: opt.alertKrw, phoneSet: !!String(E.ALERT_PHONE || '').trim(),
    used, errors, alerts: U.trimKeys(alerts, 12), weekly: U.trimKeys(weekly, 8),
  });
  console.log(`[사용량] 오늘(태평양 ${s.today.d}) 읽기 ${s.today.r} · 쓰기 ${s.today.w} · 삭제 ${s.today.x} · 이번 달 예상 ${s.monthKrw}원 · 월말 ${s.forecastKrw}원`);
  if (Object.keys(errors).length) console.log(`::${fail ? 'error' : 'warning'}::못 읽은 지표 — ${Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
  return fail ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(`::error::${e.message}`); process.exit(1); });
