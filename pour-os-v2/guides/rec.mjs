// 설명 영상 녹화 도구 (가짜 저장 장치 · 실데이터 읽기 전용 복사본 · 실제 Firestore 에 쓰지 않음)
//  - 자막은 화면 위에 그리지 않고 시각만 기록 → build.py 가 영상 아래 띠에 입힘
//  - 누르는 곳은 주황 동그라미(화면 안)로 표시
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'fs';
export const SP = '/tmp/claude-0/-home-user/d0653b74-4d54-5933-871a-3c243080459f/scratchpad';
const { pinHash } = await import('/home/user/pour-construction-form/pour-os-v2/src/sha.js');
const TEAM = SP + '/os2/tdist/index.html', ADMIN = SP + '/admin-build/tdist/admin.html';

// opts: { name:'team'|'admin'(출력 이름), w, h, dsf, now, locale(선택 · 예 'ko-KR'), pins:{id:'1234'|{invite:'4821'}}, start:'index.html'|'admin.html', patch:(st)=>void }
export async function openRec(opts) {
  const { name, w, h, dsf = 2, now = '2026-10-06T10:00:00', pins = {}, start = 'index.html', patch, locale } = opts;
  const R = JSON.parse(fs.readFileSync(SP + '/real/real.json', 'utf8'));
  const st = { v1: R.v1, v2: R.v2, meta: R.meta, writes: [] };
  Object.values(st.v2).forEach((c) => Object.entries(c).forEach(([id, d]) => { if (!d.id) d.id = id; }));
  Object.values(st.v2.users).forEach((u) => {
    u.id = u.id || u._id; delete u.pinInvite;
    const p = pins[u.id] ?? '1234';
    if (typeof p === 'string') u.pinHash = pinHash(u.id, p);
    else { u.pinHash = null; u.pinInvite = pinHash(u.id, 'inv:' + p.invite); }
  });
  if (patch) patch(st, R);
  const dir = `${SP}/guide/out/${name}`; fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(dir + '/frames', { recursive: true, force: true }); fs.mkdirSync(dir + '/frames');
  // locale 을 주면 브라우저 언어도 그 말로 (날짜 칸 모양 등 · 'ko-KR' → 2026. 10. 16.) — 안 주면 예전과 같음
  const langOpt = locale ? { args: ['--lang=' + locale], env: { ...process.env, LANG: locale.replace('-', '_') + '.UTF-8', LANGUAGE: locale.split('-')[0] } } : {};
  const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', ...langOpt });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, ...(locale ? { locale } : {}) });   // locale: 'ko-KR' 등 (안 주면 예전처럼 브라우저 기본)
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => r.fulfill({ path: r.request().url().includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }));
  await ctx.addInitScript(`try{ if(sessionStorage.__V2) window.__V2=JSON.parse(sessionStorage.__V2); }catch(e){} window.__V1_DATA=${JSON.stringify(R.v1)}; window.__V1_DOCS=${JSON.stringify(R.v1docs)}; window.__V1_LAUNCH=${JSON.stringify(R.launch)}; if(!window.__V2) window.__V2=${JSON.stringify(st)};`);
  const pg = await ctx.newPage(); const t0 = Date.now();
  // 화면 그대로(기기 픽셀) 프레임 받기 — Playwright 녹화는 고해상도로 안 키워 줘서 CDP screencast 사용
  const frames = []; let fi = 0; const cdp = await ctx.newCDPSession(pg);
  cdp.on('Page.screencastFrame', (f) => { const t = (Date.now() - t0) / 1000; const file = `frames/${String(++fi).padStart(6, '0')}.jpg`; fs.writeFileSync(dir + '/' + file, Buffer.from(f.data, 'base64')); frames.push({ t: +t.toFixed(3), file }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(w * dsf), maxHeight: Math.round(h * dsf), everyNthFrame: 1 });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  const caps = [], overflow = [];
  const T = () => +((Date.now() - t0) / 1000).toFixed(2);
  const wait = (ms) => pg.waitForTimeout(ms);
  // 자막: ch = 장 이름(예 '1 로그인') · title = 큰 글 · sub = 작은 글. 빈 title 이면 자막 없음
  const cap = async (ch, title = '', sub = '') => { caps.push({ t: T(), ch, title, sub }); const of = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => false); if (of) overflow.push({ t: T(), title }); };
  const ring = async (loc) => {
    const bb = await loc.boundingBox(); if (!bb) return;
    await pg.evaluate(({ x, y }) => { const r = document.createElement('div'); r.style.cssText = `position:fixed;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:50%;border:3px solid #F25C05;background:rgba(242,92,5,.20);z-index:2147483647;pointer-events:none;transition:all .55s ease-out`; document.body.appendChild(r); setTimeout(() => { r.style.opacity = 0; r.style.transform = 'scale(1.7)'; }, 380); setTimeout(() => r.remove(), 1000); }, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
    await wait(480);
  };
  const tap = async (loc, ms = 1000) => { loc = loc.first(); await loc.scrollIntoViewIfNeeded(); await wait(150); await ring(loc); await loc.click(); await wait(ms); };
  const type = async (loc, text, ms = 400) => { loc = loc.first(); await loc.scrollIntoViewIfNeeded(); await ring(loc); await loc.click(); await loc.pressSequentially(text, { delay: 70 }); await wait(ms); };
  // 천천히 굴리기 (보는 사람이 따라오게)
  const scroll = async (dy, steps = 8, sel = null) => { for (let i = 0; i < steps; i++) { if (sel) await pg.locator(sel).last().evaluate((el, d) => el.scrollBy(0, d), dy / steps); else await pg.mouse.wheel(0, dy / steps); await wait(60); } await wait(300); };
  const nav = (t) => pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + t) });
  const sheet = () => pg.locator('.v2-sheet').last();
  const closeAll = async () => { for (let i = 0; i < 6 && (await pg.locator('.v2-sheet').count()); i++) { await pg.keyboard.press('Escape'); await wait(250); } };
  const login = async (nm, pin = '1234', invite = null) => {
    await tap(pg.getByRole('button', { name: nm, exact: true }), 700);
    if (invite) { await type(pg.getByLabel('시작 코드'), invite, 200); }
    await type(pg.getByLabel('PIN', { exact: true }), pin, 200);
    if (await pg.getByLabel('PIN 확인').count()) { await type(pg.getByLabel('PIN 확인'), pin, 200); await tap(pg.getByRole('button', { name: 'PIN 정하고 시작' }), 1500); }
    else await tap(pg.getByRole('button', { name: '시작', exact: true }), 1500);
    await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await wait(800);
  };
  const goto = async (file) => { await pg.evaluate(() => { sessionStorage.__V2 = JSON.stringify(window.__V2); }); await pg.goto('http://v2.test/' + file); await wait(1200); };
  const shot = (p) => pg.screenshot({ path: p });
  await pg.goto('http://v2.test/' + start); await wait(900);
  const finish = async () => {
    const end = T(); const writes = await pg.evaluate(() => (window.__V2.writes || []).filter((w) => !/^\(read\)/.test(w.path)).map((w) => w.path)).catch(() => []);
    await wait(300); await cdp.send('Page.stopScreencast').catch(() => {}); await ctx.close(); await b.close();
    const video = dir + '/frames.json'; fs.writeFileSync(video, JSON.stringify(frames));
    const meta = { video, frames: frames.length, end, w, h, dsf, caps, errs, overflow, writes: writes.length };
    fs.writeFileSync(dir + '/caps.json', JSON.stringify(meta, null, 1));
    console.log(JSON.stringify({ frames: frames.length, end, caps: caps.length, errs, overflow, writes: writes.length }));
    return meta;
  };
  return { pg, ctx, cap, ring, tap, type, scroll, wait, nav, sheet, closeAll, login, goto, shot, finish, errs, T };
}
