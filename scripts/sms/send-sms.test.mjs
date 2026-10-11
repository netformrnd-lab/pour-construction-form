// node scripts/sms/send-sms.test.mjs — 문자 함수(functions/send-sms.js) 잠금 시험 · 솔라피는 가짜(fetch 바꿈) · 실제 문자 없음
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'functions', 'send-sms.js'), 'utf8');
const tmp = join(mkdtempSync(join(tmpdir(), 'sms-')), 'send-sms.mjs'); writeFileSync(tmp, src); // functions/ 는 사이트 경로라 시험 파일을 두지 않음
const F = await import(tmp);
let sent = [], n = 0, bad = 0;
globalThis.fetch = async (url, opt) => { sent.push({ url, body: JSON.parse(opt.body), auth: opt.headers.Authorization }); return new Response(JSON.stringify({ groupId: 'g' }), { status: 200 }); };
console.warn = () => {};
const ok = (name, c) => { n++; console.log(c ? '✓' : '✗', name); if (!c) bad++; };
const call = (origin, body, env = {}, hdr = {}) => F.onRequestPost({ env, request: new Request('https://pour-construction-form.pages.dev/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), ...hdr }, body: JSON.stringify(body) }) });
const ENV = { SOLAPI_API_KEY: 'envK', SOLAPI_API_SECRET: 'envS', SOLAPI_SENDER: '0212345678' };
let r = await call('https://evil.example', { to: '01012345678', text: 'x' }, ENV); ok('다른 사이트 → 403', r.status === 403 && sent.length === 0);
r = await call('', { to: '01012345678', text: 'x' }, ENV); ok('출처 없음(서버) · 토큰 없음 → 403', r.status === 403);
r = await call('', { to: '01012345678', text: 'x' }, { ...ENV, OPS_TOKEN: 'tok123' }, { 'X-Ops-Token': 'tok123' }); ok('토큰 맞음 → 보냄', r.status === 200 && sent.length === 1);
r = await call('', { to: '01012345678', text: 'x' }, { ...ENV, OPS_TOKEN: 'tok123' }, { 'X-Ops-Token': 'tok12X' }); ok('토큰 틀림 → 403', r.status === 403 && sent.length === 1);
r = await call('https://pour-construction-form.pages.dev', { to: '010-1234-5678', text: '안녕', apiKey: 'bodyK', apiSecret: 'bodyS', sender: '0299999999' }, ENV);
ok('우리 사이트 · 환경변수 키 먼저(본문 키 무시)', r.status === 200 && sent[1].auth.includes('apiKey=envK') && sent[1].body.message.from === '0212345678');
r = await call('https://abc123.pour-construction-form.pages.dev', { to: '01012345678', text: 'x', apiKey: 'bodyK', apiSecret: 'bodyS', sender: '0299999999' }, {});
ok('미리보기 주소 · 환경변수 없음 → 본문 키(예전 앱 호환)', r.status === 200 && sent[2].auth.includes('apiKey=bodyK'));
r = await call('https://pour-construction-form.pages.dev', { to: '01012345678,01099998888', text: 'x' }, ENV); ok('번호 여러 개 → 400', r.status === 400);
r = await call('https://pour-construction-form.pages.dev', { to: '01012345678', text: 'a'.repeat(2001) }, ENV); ok('2,001자 → 400', r.status === 400);
r = await call('https://pour-construction-form.pages.dev.evil.com', { to: '01012345678', text: 'x' }, ENV); ok('비슷한 가짜 주소 → 403', r.status === 403);
const o = await F.onRequestOptions({ request: new Request('https://x/send-sms', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }) });
ok('OPTIONS: 다른 사이트엔 허용 주소 안 줌', o.headers.get('Access-Control-Allow-Origin') === 'https://pour-construction-form.pages.dev');
console.log(`${n - bad}/${n} 통과`); process.exit(bad ? 1 : 0);
