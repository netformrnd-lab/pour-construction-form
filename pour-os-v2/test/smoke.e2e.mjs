// 업무OS v2 · 화면 한 바퀴 시험 (가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음)
//   준비: ai.e2e.mjs 와 같은 빌드 (npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js)
//   실행: node test/smoke.e2e.mjs
//   팀 앱(오늘 · 달력 · 프로젝트 · 더보기 + 업무·프로젝트·AI 팀원 시트) · 관리자 앱(모든 탭) 을 375·1280 으로 열어 화면 오류 · 가로 넘침이 없는지
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';
import { askDoc } from '../../marketing-hub/crew.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-12T10:00:00+09:00', T0 = '2026-10-12T00:30:00.000Z', D0 = '2026-10-05T00:30:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

// ── 씨앗: 사람 4 · 일반 프로젝트 1(업무 4 · 앞 일 · 하위 업무 · 댓글) · 고정업무 1 · 신제품 없음 · AI 승인 2 ──
const U = [['yj', '남윤정', '1팀'], ['sy', '김소연', '1팀'], ['hj', '허지은', '공용'], ['sh', '김송희', '2팀']];
const users = Object.fromEntries(U.map(([id, name, team]) => [id, { id, name, team, role: 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z', ...(id === 'yj' ? { bossId: 'sy' } : id === 'sy' ? { bossId: 'hj' } : {}) }]));
const task = (o) => ({ isFixed: false, type: 'general', status: 'todo', assigneeIds: [o.assigneeId], projectId: 'p1', parentId: null, memo: '', attachments: [], createdAt: D0, statusLog: [], ...o });
const tasks = {
  t1: task({ id: 't1', title: '추석 기획전 상세 문구', assigneeId: 'yj', status: 'done', doneAt: '2026-10-08T05:00:00.000Z', finishedAt: '2026-10-08T05:00:00.000Z', dueDate: '2026-10-08', phase: 'plan' }),
  t2: task({ id: 't2', title: '배너 소재 3종', assigneeId: 'yj', status: 'inprogress', dueDate: '2026-10-13', deps: ['t1'], phase: 'make' }),
  t3: task({ id: 't3', title: '배너 사이즈 정리', assigneeId: 'yj', parentId: 't2', dueDate: '2026-10-13' }),
  t4: task({ id: 't4', title: '광고 집행', assigneeId: 'sh', dueDate: '2026-10-09', deps: ['t2'], phase: 'run', requestedBy: 'yj' }),
  f1: { id: 'f1', title: 'CS 문의 확인', isFixed: true, recurType: 'daily', assigneeId: 'yj', assigneeIds: ['yj'], status: 'todo', brand: 'pourstore', scope: 'brand', subs: [{ id: 's1', text: '네이버' }, { id: 's2', text: '쿠팡' }], doneDates: {}, createdAt: D0, statusLog: [] },
};
const projects = { p1: { id: 'p1', title: '추석 기획전', category: 'marketing', ownerId: 'yj', memberIds: ['sh'], status: 'active', startDate: '2026-10-01', dueDate: '2026-10-20', brand: 'pourstore', progress: 25, createdAt: D0 } };
const notes = { n1: { id: 'n1', itemId: 'task:t2', text: '@김송희 소재 확인 부탁드려요', by: 'yj', byName: '남윤정', at: '2026-10-12T00:10:00.000Z', mentions: ['sh'], projectId: 'p1' } };
const ask = (o) => askDoc({ at: T0, run: '2026-10-12', ...o });
const aiasks = {
  ai_pori_20261012_a: ask({ id: 'ai_pori_20261012_a', mate: 'pori', brand: 'pourstore', title: '포리 · 블로그 원고 3', sum: '27칸 표준', url: 'https://example.test/hub#team', owner: 'yj', exec: '승인되면 담당이 [임시저장 맡기기] 뒤 블로그에서 발행한다' }),
  ai_gyeoul_20261012_ghconvA: ask({ id: 'ai_gyeoul_20261012_ghconvA', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'A', title: '전환 보드 A · 품절 0 만들기', cols: ['상품', '채널'], items: [{ n: 'A1', c: { 상품: '롤러일체형', 채널: '쿠팡' } }], exec: '승인되면 담당이 상세페이지에 반영한다', owner: 'yj' }),
};
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects, tasks, notes, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates: { pori: { id: 'pori', owners: { _: 'yj' }, rules: [{ id: 'r1', text: '근거는 판매 데이터로' }] }, gyeoul: { id: 'gyeoul', owners: { grohome: 'yj' } } }, aiboards: {} } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR' });
  await ctx.clock.setFixedTime(new Date(NOW));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; window.__V2=${JSON.stringify(ST)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid}${admin ? ' 관리자' : ''} ${w}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} ${w} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html'));
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(700);
  return { pg, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };   // '오늘 3' 처럼 배지 붙음
const closeSheets = async (pg) => { for (let i = 0; i < 4 && await pg.locator('.v2-sheet').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } };

for (const w of [375, 1280]) {
  // 팀 앱 (남윤정)
  { const s = await session('yj', { w, h: w > 700 ? 900 : 812 }), pg = s.pg;
    const before = errs.length;
    for (const t of ['오늘', '달력', '프로젝트', '더보기']) { await tab(pg, t); ok(`팀 ${w} · ${t} 넘침 없음`, !(await over(pg))); if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `smoke-team-${t}-${w}.png`) }); }
    await tab(pg, '오늘');
    ok(`팀 ${w} · 오늘: 확인할 것에 AI 승인 요청 · 할 일 · 고정업무`, (await pg.getByText('AI 승인 요청').count()) > 0 && (await pg.getByText('배너 소재 3종').count()) > 0 && (await pg.getByText('CS 문의 확인').count()) > 0);
    await pg.getByText('배너 소재 3종').first().click(); await pg.waitForTimeout(500);
    ok(`팀 ${w} · 업무 시트 열림 · 대화`, (await pg.locator('.v2-sheet').count()) > 0 && (await pg.getByText('소재 확인 부탁드려요').count()) > 0);
    ok(`팀 ${w} · 업무 시트 넘침 없음`, !(await over(pg)));
    await closeSheets(pg);
    await tab(pg, '프로젝트'); await pg.getByText('추석 기획전').first().click(); await pg.waitForTimeout(500);
    ok(`팀 ${w} · 프로젝트 시트 · 단계 묶음`, (await pg.locator('.v2-sheet').count()) > 0 && (await pg.getByText('소재 제작').count()) > 0);
    for (const t of ['마인드맵', '소식', '자료']) { const bt = pg.locator('.v2-sheet').last().getByRole('button', { name: t, exact: true }); if (await bt.count()) { await bt.first().click(); await pg.waitForTimeout(350); } }
    ok(`팀 ${w} · 프로젝트 탭들 넘침 없음`, !(await over(pg)));
    await closeSheets(pg);
    await tab(pg, '더보기'); await pg.getByText(/^AI 팀원 · 내가 맡은 AI 2/).first().click(); await pg.waitForTimeout(500);
    ok(`팀 ${w} · 더보기 › AI 팀원 시트 (내가 맡은 AI = 포리 · 겨울)`, (await pg.getByText('기본 AI 팀원 (원형)').count()) > 0 && (await pg.locator('.v2-sheet').last().getByText('겨울', { exact: false }).count()) > 0 && !(await over(pg)));
    if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `smoke-team-aiteam-${w}.png`) });
    await closeSheets(pg);
    ok(`팀 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
    await s.close(); }
  // 관리자 앱 (허지은)
  { const s = await session('hj', { admin: true, w, h: w > 700 ? 900 : 812 }), pg = s.pg;
    const before = errs.length;
    for (const t of ['한눈에', '사람', 'AI 팀원', '협업 맵', '반복 실행', 'KPI', '프로젝트', '정리']) {
      await tab(pg, t); ok(`관리자 ${w} · ${t} 넘침 없음`, !(await over(pg)));
      if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `smoke-admin-${t}-${w}.png`) }); }
    ok(`관리자 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
    await s.close(); }
}
await b.close();
console.log(`\n${n - bad}/${n} 통과 · 그림 ${SHOTS}`); if (bad) process.exit(1);
