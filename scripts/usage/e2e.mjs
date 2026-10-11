// 사용량 측정 화면·실행 시험 — 가짜 서버(로그인·Monitoring·Firestore·문자)로만 · 실제 Google/문자 요청 없음
//   node scripts/usage/e2e.mjs   (OUT=<스크린샷 폴더> 선택 · PW=<playwright index.mjs> 선택)
import { createServer } from 'node:http';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const OUT = process.env.OUT || ''; if (OUT) mkdirSync(OUT, { recursive: true });
const { chromium } = await import(process.env.PW || '/opt/node22/lib/node_modules/playwright/index.mjs');
let fails = 0; const check = (n, c) => { console.log(c ? '  ✓' : '  ✗', n); if (!c) fails++; };

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const DOCP = '/v1/projects/pour-app-new/databases/(default)/documents/pour-os/v2/usage/pour-app-new';
const S = { doc: null, sms: [], tokens: 0, mon: [], fail429: false, perHour: 5000 };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PATCH,POST,OPTIONS' };
const send = (res, code, obj, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors, ...h }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
// 시간별 점: 그 구간의 매 시각 — 읽기는 perHour, 쓰기 300, Storage 2GB, 내려받기 0.1GB/시간
const PTD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' });
const hourly = (q, v) => { const out = [], a = Date.parse(q.get('interval.startTime')), b = Date.parse(q.get('interval.endTime'));
  for (let t = Math.ceil(a / 36e5) * 36e5; t + 36e5 <= b; t += 36e5) out.push({ interval: { startTime: new Date(t).toISOString(), endTime: new Date(t + 36e5).toISOString() }, value: v }); return out; };
const MON = {
  // 읽기: 태평양 짝수 날은 한도 안(하루 36,000) · 홀수 날은 한도 넘음(하루 120,000)
  'firestore.googleapis.com/document/read_ops_count': (q) => [{ points: hourly(q, null).map((p) => ({ ...p, value: { int64Value: String(Number(PTD.format(new Date(p.interval.startTime)).slice(8)) % 2 ? S.perHour : 1500) } })) }],
  'firestore.googleapis.com/document/write_ops_count': () => 'err400',            // → write_count 로 넘어감
  'firestore.googleapis.com/document/write_count': (q) => [{ points: hourly(q, { int64Value: '300' }) }],
  'firestore.googleapis.com/document/delete_ops_count': () => [],
  'firestore.googleapis.com/document/delete_count': () => [],
  'storage.googleapis.com/storage/v2/total_bytes': () => 'err403',
  'storage.googleapis.com/storage/total_bytes': (q) => [{ points: hourly(q, { doubleValue: 2e9 }) }],
  'storage.googleapis.com/network/sent_bytes_count': (q) => [{ points: hourly(q, { int64Value: String(1e8) }) }],
};
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (u.pathname === '/firebase-usage.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(readFileSync(join(ROOT, 'firebase-usage.html'))); return; }
  if (u.pathname === '/token' && req.method === 'POST') {
    const a = new URLSearchParams(await body(req)).get('assertion') || '', [h, c, sig] = a.split('.');
    const good = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig || '', 'base64url'));
    const claim = JSON.parse(Buffer.from(c || 'e30', 'base64url').toString());
    if (!good || !/monitoring\.read/.test(claim.scope) || claim.iss !== 'usage@pour-app-new.iam.gserviceaccount.com') return send(res, 400, { error: 'invalid_grant', error_description: '서명 틀림' });
    S.tokens++; return send(res, 200, { access_token: 'tok', expires_in: 3600 });
  }
  if (u.pathname === '/v3/projects/pour-app-new/timeSeries') {
    if (req.headers.authorization !== 'Bearer tok') return send(res, 401, { error: { message: 'no auth' } });
    const type = (u.searchParams.get('filter').match(/metric\.type="([^"]+)"/) || [])[1]; S.mon.push(type);
    const f = MON[type]; const r = f ? f(u.searchParams) : [];
    if (r === 'err400') return send(res, 400, { error: { message: 'Cannot find metric' } });
    if (r === 'err403') return send(res, 403, { error: { message: 'Permission monitoring.timeSeries.list denied' } });
    return send(res, 200, { timeSeries: r });
  }
  if (u.pathname === DOCP || u.pathname === DOCP.replace('pour-app-new', 'none')) {
    if (u.pathname !== DOCP) return send(res, 404, { error: { message: 'not found' } });
    if (req.method === 'GET') {
      if (S.fail429 && u.searchParams.get('key')) return send(res, 429, { error: { message: 'Quota exceeded.' } });
      return S.doc ? send(res, 200, { name: 'x', fields: S.doc }) : send(res, 404, { error: { message: 'not found' } });
    }
    if (req.method === 'PATCH') { if (req.headers.authorization !== 'Bearer tok') return send(res, 401, {}); S.doc = JSON.parse(await body(req)).fields; return send(res, 200, { fields: S.doc }); }
  }
  if (u.pathname === '/send-sms' && req.method === 'POST') { S.sms.push(JSON.parse(await body(req))); return send(res, 200, { ok: true }); }
  send(res, 404, { error: { message: 'no route ' + u.pathname } });
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const { fsDec } = await import('./core.mjs');
const doc = () => fsDec({ mapValue: { fields: S.doc || {} } });
// 가짜 서버가 같은 프로세스라 spawnSync 는 막힘 → 비동기로 기다림
const run = (env) => new Promise((ok) => {
  const c = spawn(process.execPath, [join(HERE, 'run.mjs')], { env: { PATH: process.env.PATH,
    SA_EMAIL: 'usage@pour-app-new.iam.gserviceaccount.com', SA_KEY: PEM.replace(/\n/g, '\\n'), TOKEN_URL: BASE + '/token', MON_BASE: BASE, FS_BASE: BASE,
    SMS_URL: BASE + '/send-sms', ALERT_PHONE: '010-1234-5678', ...env } });
  let out = ''; c.stdout.on('data', (b) => (out += b)); c.stderr.on('data', (b) => (out += b));
  c.on('close', (code) => ok({ code, out }));
});

console.log('1) 실행 — 월요일 9:20(한국) · 기준 1,000원으로 낮춰 알림까지');
let r = await run({ NOW: '2026-10-12T00:20:00Z', ALERT_KRW: '1000' });
check('끝남(0) · 토큰 1번', r.code === 0 && S.tokens === 1);
let d = doc();
check('지표 이름: 쓰기·저장 용량은 다음 이름으로 넘어감 · 못 읽은 것 없음', d.used.w.endsWith('/write_count') && d.used.sb.endsWith('storage/total_bytes') && Object.keys(d.errors).length === 0);
check('오늘(태평양 10/11) 17시간 · 읽기 85,000 · 쓰기 5,100', d.today.d === '2026-10-11' && d.today.r === 85000 && d.today.w === 5100);
check('지난 7일 = 10/4~10/10 · 하루 읽기 평균 72,000 · 최대 120,000 · 한도 넘은 날 3', d.week.from === '2026-10-04' && d.week.to === '2026-10-10' && d.week.avgR === 72000 && d.week.maxR === 120000 && d.week.overDays === 3);
check('이번 달 합 > 0 · 월말 예상 ≥ 이번 달', d.month.krw > 1000 && d.month.forecastKrw >= d.month.krw);
check('문자 2통: 알림 + 주간 보고 (번호 숫자만)', S.sms.length === 2 && S.sms[0].to === '01012345678' && /이번 달 예상 요금이 1,000원을 넘었습니다/.test(S.sms[0].text) && /주간 사용량/.test(S.sms[1].text) && /firebase-usage\.html/.test(S.sms[1].text));
check('보낸 기록 저장', d.alerts['2026-10'].sent === true && d.weekly['2026-10-12'].sent === true && d.phoneSet === true);
console.log(r.out.split('\n').filter((l) => /사용량\]/.test(l)).slice(-2).join('\n'));

console.log('2) 3시간 뒤 다시 — 같은 알림·주간 보고는 안 보냄');
r = await run({ NOW: '2026-10-12T03:20:00Z', ALERT_KRW: '1000' });
check('끝남(0) · 문자 그대로 2통', r.code === 0 && S.sms.length === 2);

console.log('3) 화요일 · 번호 없음 · 새 달 알림 필요 → 빨간 실패 + 기록');
r = await run({ NOW: '2026-11-03T03:20:00Z', ALERT_KRW: '10', ALERT_PHONE: '' });
d = doc();
check('실패(1) · 못 보낸 이유 저장 · 문자 없음', r.code === 1 && d.alerts['2026-11'] && d.alerts['2026-11'].sent === false && /ALERT_PHONE/.test(d.alerts['2026-11'].err) && S.sms.length === 2 && d.phoneSet === false);

console.log('4) 시크릿 없음 → 건너뜀(0) · 키 틀림 → 실패(1)');
r = await run({ SA_EMAIL: '', SA_KEY: '', NOW: '2026-11-03T03:20:00Z' }); check('시크릿 없음 = 건너뜀', r.code === 0 && /건너뜀/.test(r.out));
const bad = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
r = await run({ SA_KEY: bad, NOW: '2026-11-03T03:20:00Z' }); check('키 틀림 = 실패 + 이유', r.code === 1 && /서비스 계정 로그인 실패/.test(r.out));

console.log('5) 화면 375 · 768 · 1280');
await run({ NOW: '2026-10-12T03:20:00Z', ALERT_KRW: '100000' }); // 10월 보기로 되돌림(알림 기록은 그대로)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const hits = []; // 실제 Google 로 나가는 요청이 없어야 함
for (const w of [375, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }), p = await ctx.newPage();
  await p.route(/firestore\.googleapis\.com|googleapis\.com/, (rt) => { hits.push(rt.request().url()); rt.abort(); });
  await p.goto(`${BASE}/firebase-usage.html?src=${encodeURIComponent(BASE + DOCP + '?key=x')}`);
  await p.waitForSelector('.big');
  const txt = await p.textContent('main');
  check(`${w}: 오늘 읽기·이번 달·지난 7일·날짜별`, /읽기 · 한도 넘음/.test(txt) && /이번 달 예상 요금/.test(txt) && /무료 한도 넘은 날 3일/.test(txt) && (await p.$$('tbody tr')).length === 14);
  check(`${w}: 가로 넘침 없음`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check(`${w}: 막대 30개 · 점선 한도`, (await p.$$('#chart .hit')).length === 30 && /무료 한도 5만/.test(await p.textContent('#chart')) && (await p.$$('#chart path[fill="#DC2626"]')).length > 0 && (await p.$$('#chart path[fill="#2563EB"]')).length > 0);
  await p.click('#more-days'); check(`${w}: 모두 보기 → 35일`, (await p.$$('tbody tr')).length === 35);
  const hit = await p.$('#chart .hit[data-i="29"]'); await hit.click();
  check(`${w}: 막대 누르면 숫자`, await p.isVisible('#tip') && /진행 중/.test(await p.textContent('#tip')));
  if (OUT) await p.screenshot({ path: `${OUT}/usage-${w}.png`, fullPage: true });
  await ctx.close();
}
{ const ctx = await b.newContext({ viewport: { width: 375, height: 700 } }), p = await ctx.newPage();
  S.fail429 = true; await p.goto(`${BASE}/firebase-usage.html?src=${encodeURIComponent(BASE + DOCP + '?key=x')}`); await p.waitForSelector('.msg');
  check('한도 다 씀(429) 안내', /무료 읽기 한도를 다 써서/.test(await p.textContent('.msg'))); S.fail429 = false;
  await p.goto(`${BASE}/firebase-usage.html?src=${encodeURIComponent(BASE + DOCP.replace('pour-app-new', 'none') + '?key=x')}`); await p.waitForSelector('.msg');
  check('측정 전(404) 안내', /아직 측정 전/.test(await p.textContent('.msg')));
  if (OUT) await p.screenshot({ path: `${OUT}/usage-empty-375.png` });
  await ctx.close(); }
await b.close(); srv.close();
check('실제 Google 요청 0', hits.length === 0);
console.log(fails ? `실패 ${fails}` : '전부 통과'); process.exit(fails ? 1 : 0);
