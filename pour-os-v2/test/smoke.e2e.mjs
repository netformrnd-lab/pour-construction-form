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
const notes = { n1: { id: 'n1', itemId: 'task:t2', text: '@김송희 소재 확인 부탁드려요', by: 'yj', byName: '남윤정', at: '2026-10-12T00:10:00.000Z', mentions: ['sh'], projectId: 'p1' },
  n2: { id: 'n2', itemId: 'task:t2', text: '확인했어요 · 내일 올릴게요', by: 'sh', byName: '김송희', at: '2026-10-12T00:20:00.000Z', projectId: 'p1' } };
const ask = (o) => askDoc({ at: T0, run: '2026-10-12', ...o });
const aiasks = {
  ai_pori_20261012_a: ask({ id: 'ai_pori_20261012_a', mate: 'pori', brand: 'pourstore', title: '포리 · 블로그 원고 3', sum: '27칸 표준', url: 'https://example.test/hub#team', owner: 'yj', exec: '승인되면 담당이 [임시저장 맡기기] 뒤 블로그에서 발행한다' }),
  ai_gyeoul_20261012_ghconvA: ask({ id: 'ai_gyeoul_20261012_ghconvA', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'A', title: '전환 보드 A · 품절 0 만들기', cols: ['상품', '채널'], items: [{ n: 'A1', c: { 상품: '롤러일체형', 채널: '쿠팡' } }], exec: '승인되면 담당이 상세페이지에 반영한다', owner: 'yj' }),
};
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects, tasks, notes, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates: { pori: { id: 'pori', owners: { _: 'yj' }, rules: [{ id: 'r1', text: '근거는 판매 데이터로' }] }, gyeoul: { id: 'gyeoul', owners: { grohome: 'yj' } } }, aiboards: {} } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, store = null, local = null } = {}) {   // store = 다른 기기가 남긴 저장 장치(폰 → PC) · local = 이 기기 localStorage 미리 넣기
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR' });
  await ctx.clock.setFixedTime(new Date(NOW));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; window.__V2=${store || JSON.stringify(ST)};`);
  if (local) await ctx.addInitScript(`try { if (!sessionStorage.__seeded) { sessionStorage.__seeded = 1; ${Object.entries(local).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join(' ')} } } catch (e) {}`);
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

let phoneStore = null;   // 375 폰에서 읽은 뒤의 서버 (→ 1280 PC 로 이어서 · 같은 서버를 보는 다른 기기)
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
    // 읽은 알림 (2026-10-13 "OS에서 읽음한거 다시보고싶어"): 위에서 '확인할 것' 댓글 줄을 눌러 열었으니(= 읽음) → 더보기 › 읽은 알림에 있음
    //   → [안 읽음으로] → 다시 '확인할 것' → [읽음 표시] → 알림 + 되돌리기 → 다시 [읽음 표시] → 사라짐
    if (w === 375) {
      await closeSheets(pg);
      const inCard = () => pg.locator('.v2-ts.in').getByText('확인했어요 · 내일 올릴게요', { exact: false }).count();
      await tab(pg, '오늘');
      ok('읽은 알림: 눌러 본 댓글은 확인할 것에서 빠짐', (await inCard()) === 0);
      await tab(pg, '더보기'); await pg.getByText('읽은 알림', { exact: true }).first().click(); await pg.waitForTimeout(400);
      const sh = pg.locator('.v2-sheet').last();
      ok('더보기 › 읽은 알림: 읽은 댓글 · 쓴 사람 · 처리해야 하는 줄(AI 승인 요청)은 없음', (await sh.getByText('확인했어요 · 내일 올릴게요', { exact: false }).count()) > 0 && (await sh.getByText('김송희', { exact: false }).count()) > 0 && (await sh.getByText('AI 승인 요청').count()) === 0);
      ok('읽은 알림 375 넘침 없음', !(await over(pg))); await pg.screenshot({ path: path.join(SHOTS, 'smoke-team-readinbox-375.png') });
      await sh.locator('button', { hasText: '안 읽음으로' }).first().click(); await pg.waitForTimeout(300);   // 줄(role=button)이 아니라 안의 진짜 버튼
      ok('안 읽음으로 → 읽은 알림에서 빠짐', (await pg.locator('.v2-sheet').last().getByText('확인했어요 · 내일 올릴게요', { exact: false }).count()) === 0);
      await closeSheets(pg); await tab(pg, '오늘');
      ok('안 읽음으로 → 다시 확인할 것에', (await inCard()) > 0);
      await pg.locator('.v2-ts.in').locator('button', { hasText: '읽음 표시' }).first().click(); await pg.waitForTimeout(300);
      ok('읽음 표시 → 사라짐 · 알림 "더보기 › 읽은 알림" + 되돌리기', (await inCard()) === 0 && /더보기 › 읽은 알림/.test(await pg.locator('.v2-toast').innerText()));
      await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(300);
      ok('되돌리기 → 다시 확인할 것에', (await inCard()) > 0);
      await pg.locator('.v2-ts.in').locator('button', { hasText: '읽음 표시' }).first().click(); await pg.waitForTimeout(300);
      ok('다시 읽음 표시 → 사라짐', (await inCard()) === 0);
      // 폰·PC 같이 (2026-10-13 "폰, pc 둘중 하나만봐도 연동되어 없어지게해"): 읽음 = 서버 seen/yj (바뀐 키만 합치기)
      const seenDoc = () => pg.evaluate(() => ((window.__V2.v2.seen || {}).yj || null));
      const sd = await seenDoc();
      ok('읽음 → 서버 seen/yj 에 그 댓글 키(읽은 때)', !!(sd && sd.ids && /^2026-/.test(sd.ids['nt:n2'] || '')), sd);
      ok('읽음 쓰기 = 합치기(merge) · 지우기는 그 키만', await pg.evaluate(() => window.__V2.writes.filter((x) => x.key === 'seen').every((x) => x.op === 'merge' && x.data && x.data.ids && Object.keys(x.data).sort().join() === 'at,id,ids')));
      // 다른 기기(PC)가 지금 [안 읽음으로] → 폰 화면에 바로 다시 뜸 · PC 가 다시 읽음 → 바로 사라짐 (다시 열지 않아도)
      await pg.evaluate(() => window.__MERGE('seen', 'yj', { ids: { 'nt:n2': { __del: true } } })); await pg.waitForTimeout(400);
      ok('PC 에서 안 읽음으로 → 폰 확인할 것에 바로 다시', (await inCard()) > 0);
      await pg.evaluate(() => window.__MERGE('seen', 'yj', { ids: { 'nt:n2': '2026-10-12T01:30:00.000Z' } })); await pg.waitForTimeout(400);
      ok('PC 에서 읽음 → 폰 확인할 것에서 바로 사라짐', (await inCard()) === 0);
      phoneStore = await pg.evaluate(() => JSON.stringify(window.__V2));
    }
    await closeSheets(pg);
    ok(`팀 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
    await s.close(); }
  // PC(1280)로 같은 서버를 열면 폰에서 읽은 댓글은 처음부터 '확인할 것'에 없고 '읽은 알림'에 있음 · PC 에서 [안 읽음으로] → 서버에서 빠짐
  if (w === 1280 && phoneStore) { const s = await session('yj', { w, h: 900, store: phoneStore }), pg = s.pg;
    const before = errs.length;
    await tab(pg, '오늘');
    const inCard = () => pg.locator('.v2-ts.in').getByText('확인했어요 · 내일 올릴게요', { exact: false }).count();
    ok('PC 1280 · 폰에서 읽은 댓글은 확인할 것에 없음', (await inCard()) === 0 && (await pg.getByText('AI 승인 요청').count()) > 0);
    await tab(pg, '더보기'); await pg.getByText('읽은 알림', { exact: true }).first().click(); await pg.waitForTimeout(400);
    const sh = pg.locator('.v2-sheet').last();
    ok('PC 1280 · 더보기 › 읽은 알림에 폰에서 읽은 댓글 · 안내 "폰·PC"', (await sh.getByText('확인했어요 · 내일 올릴게요', { exact: false }).count()) > 0 && /폰·PC 어디서 읽어도/.test(await sh.innerText()));
    await sh.locator('button', { hasText: '안 읽음으로' }).first().click(); await pg.waitForTimeout(300);
    ok('PC 1280 · 안 읽음으로 → 서버 seen/yj 에서 그 키만 빠짐', await pg.evaluate(() => { const d = window.__V2.v2.seen.yj; return !!d && !('nt:n2' in d.ids); }));
    ok('PC 1280 · 화면 오류 없음', errs.length === before, errs.slice(before));
    await s.close(); }
  // 예전 방식(이 기기에만 저장)으로 읽은 것 → 처음 열 때 서버로 한 번 올림 (다른 기기에도)
  if (w === 375) { const s = await session('sh', { w, local: { 'pour-os2-seen-sh': { 'nt:n1': true } } }), pg = s.pg;
    const before = errs.length; await pg.waitForTimeout(400);
    const d = await pg.evaluate(() => ((window.__V2.v2.seen || {}).sh || null));
    ok('예전 이 기기 읽음 → 서버 seen/sh 로 올림 (읽은 때 = 지금)', !!(d && /^2026-/.test(d.ids['nt:n1'] || '')), d);
    ok('올린 표시 pour-os2-seen-up-sh · 확인할 것에 그 댓글 없음', !!(await pg.evaluate(() => localStorage.getItem('pour-os2-seen-up-sh'))) && (await pg.locator('.v2-ts.in').getByText('소재 확인 부탁드려요', { exact: false }).count()) === 0);
    ok('예전 읽음 올리기 · 화면 오류 없음', errs.length === before, errs.slice(before));
    await s.close(); }
  // 관리자 앱 (허지은)
  { const s = await session('hj', { admin: true, w, h: w > 700 ? 900 : 812 }), pg = s.pg;
    const before = errs.length;
    // 관리자 '나에게 온 것' 아래 [읽은 알림 ›]
    await pg.getByRole('button', { name: /나에게 온 것/ }).first().click(); await pg.waitForTimeout(300);
    await pg.locator('.v2-sheet').last().getByRole('button', { name: '읽은 알림 ›' }).click(); await pg.waitForTimeout(300);
    ok(`관리자 ${w} · 나에게 온 것 › 읽은 알림`, /읽은 알림/.test(await pg.locator('.v2-sheet').last().innerText()) && !(await over(pg)));
    await closeSheets(pg);
    for (const t of ['한눈에', '사람', 'AI 팀원', '협업 맵', '반복 실행', 'KPI', '프로젝트', '정리']) {
      await tab(pg, t); ok(`관리자 ${w} · ${t} 넘침 없음`, !(await over(pg)));
      if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `smoke-admin-${t}-${w}.png`) }); }
    ok(`관리자 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
    await s.close(); }
}

// ── 할 일 바로 추가 · [시작] (2026-10-13 "할일추가를 기존 os처럼 바로 쉽게" · "시작버튼은 os버전2는 없는거 맞아?") ──
for (const w of [375, 768, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 900 : 812 }), pg = s.pg, before = errs.length;
  const box = pg.locator('.v2-ts.tod .v2-qadd'), qin = box.getByLabel('할 일 바로 추가', { exact: true });
  const T = (title) => pg.evaluate((t) => Object.values(window.__V2.v2.tasks).find((x) => x.title === t) || null, title);
  const toast = () => pg.locator('.v2-toast').innerText().catch(() => '');
  const rowOf = (title) => pg.locator('.v2-ts.tod [role=button]', { hasText: title });
  await tab(pg, '오늘');
  ok(`바로 추가 ${w} · 할 일 카드 맨 위에 입력칸 · 날짜 [오늘] 기본`, (await qin.count()) === 1 && (await box.locator('.op button[aria-pressed=true]').innerText()) === '오늘');
  // 1) 입력 → Enter = 바로 '나 · 오늘' (탭 1번 + Enter) · 칸 비우고 커서 그대로
  await qin.click(); await qin.fill('견적서 정리'); await qin.press('Enter'); await pg.waitForTimeout(400);
  const a1 = await T('견적서 정리');
  ok(`바로 추가 ${w} · Enter → 내 할 일 · 오늘 · 프로젝트 없음`, !!a1 && a1.assigneeId === 'yj' && a1.dueDate === '2026-10-12' && a1.projectId === '' && a1.status === 'todo' && a1.madeIn === 'v2', a1);
  ok(`바로 추가 ${w} · 칸 비움 · 커서 그대로 · 알림 '추가했어요 · 오늘' · 목록에 바로`, (await qin.inputValue()) === '' && (await pg.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'))) === '할 일 바로 추가' && /추가했어요 · 오늘/.test(await toast()) && (await rowOf('견적서 정리').count()) > 0);
  if (w === 375) {
    // 2) 연달아 · [추가] 버튼
    await qin.fill('샘플 발송'); await box.locator('button[type=submit]').click(); await pg.waitForTimeout(400);
    ok('바로 추가 · [추가] 버튼도 같음 · 칸 비움', !!(await T('샘플 발송')) && (await qin.inputValue()) === '');
    // 3) [내일] → 내일 마감 · 오늘 화면 [내일] 보기에 보임
    await box.locator('.op').getByRole('button', { name: '내일', exact: true }).click(); await qin.fill('배송 확인'); await qin.press('Enter'); await pg.waitForTimeout(400);
    ok('바로 추가 · [내일] → 기한 10/13 · 알림 내일', ((await T('배송 확인')) || {}).dueDate === '2026-10-13' && /추가했어요 · 내일/.test(await toast()));
    // 4) [미정] → 날짜 없이 · 알림 '날짜 없는 일'
    await box.locator('.op').getByRole('button', { name: '미정', exact: true }).click(); await qin.fill('아이디어 메모'); await qin.press('Enter'); await pg.waitForTimeout(400);
    ok('바로 추가 · [미정] → 날짜 없음 · 알림에 날짜 없는 일', ((await T('아이디어 메모')) || {}).dueDate === '' && /날짜 없는 일/.test(await toast()));
    // 5) [날짜] 고르기 → 그 날 · 프로젝트 고르기 → 그 프로젝트 · 지금 단계
    await box.locator('.op input[type=date]').fill('2026-10-16'); await pg.waitForTimeout(150);
    ok('바로 추가 · [날짜] 고르면 칩에 10/16(금)', /10\/16\(금\)/.test(await box.locator('.op .dt').innerText()));
    await box.locator('.op select').selectOption('p1'); await pg.waitForTimeout(150);
    await qin.fill('상세 이미지 교체'); await qin.press('Enter'); await pg.waitForTimeout(400);
    const a5 = await T('상세 이미지 교체');
    ok('바로 추가 · 날짜 10/16 · 프로젝트 추석 기획전 · 지금 단계 · 칩에 프로젝트 이름', !!a5 && a5.dueDate === '2026-10-16' && a5.projectId === 'p1' && !!a5.phase && a5.brand === 'pourstore' && /추석 기획전/.test(await box.locator('.op .pj').innerText()), a5);
    // 6) 되돌리기 = 없애기(휴지통 · 지우지 않음)
    await box.locator('.op').getByRole('button', { name: '오늘', exact: true }).click(); await box.locator('.op select').selectOption('');
    await qin.fill('실수로 넣은 일'); await qin.press('Enter'); await pg.waitForTimeout(400);
    await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(500);
    const a6 = await T('실수로 넣은 일');
    ok('바로 추가 · 되돌리기 → 휴지통(removed · 문서는 그대로) · 목록에서 빠짐', !!a6 && !!a6.removed && (await rowOf('실수로 넣은 일').count()) === 0, a6 && a6.removed);
    // 7) 쓰다가 [+ 맡기기] → 같은 제목으로 '할 일 추가 · 맡기기' 시트 → 김송희에게 → 칸 비움
    await qin.fill('광고 문구 검토'); await pg.getByRole('button', { name: '할 일 맡기기 · 자세히 추가' }).click(); await pg.waitForTimeout(400);
    const sh = pg.locator('.v2-sheet').last();
    ok('[+ 맡기기] → 시트 제목칸에 쓰던 글', (await sh.locator('#v2-add-title').inputValue()) === '광고 문구 검토');
    await sh.getByRole('button', { name: '김송희', exact: true }).click(); await sh.getByRole('button', { name: /김송희님에게 맡기기/ }).click(); await pg.waitForTimeout(500);
    const a7 = await T('광고 문구 검토');
    ok('[+ 맡기기] → 김송희 업무 · 바로 추가 칸 비움', !!a7 && a7.assigneeId === 'sh' && a7.requestedBy === 'yj' && (await qin.inputValue()) === '', a7 && a7.assigneeId);
    await closeSheets(pg);
    // 8) [시작] (할 일 줄마다) → 진행 중 · '시작 hh:mm' · [끝냄]만 / 진행 중 줄은 [끝냄]만
    const r1 = rowOf('견적서 정리').first();
    ok('[시작] · 할 일 줄 = [시작] [끝냄] · 진행 중 줄(배너 소재 3종) = [끝냄]만', (await r1.locator('button', { hasText: '시작' }).count()) === 1 && (await r1.locator('button', { hasText: '끝냄' }).count()) === 1
      && (await rowOf('배너 소재 3종').first().locator('button', { hasText: '시작' }).count()) === 0 && (await rowOf('배너 소재 3종').first().locator('button', { hasText: '끝냄' }).count()) === 1);
    await pg.evaluate(() => document.querySelectorAll('.v2-toast').forEach((x) => { x.style.display = 'none'; })); await pg.screenshot({ path: path.join(SHOTS, 'smoke-quickadd-375.png'), fullPage: true });
    await r1.locator('button', { hasText: '시작' }).click(); await pg.waitForTimeout(500);
    const a8 = await T('견적서 정리'), r1b = rowOf('견적서 정리').first();
    ok('[시작] → 진행 중 · 시작한 날 · 줄에 시작 hh:mm(꼬리표는 오늘 마감이 먼저) · [끝냄]만 · 업무 시트는 안 열림', !!a8 && a8.status === 'inprogress' && a8.startedAt === '2026-10-12' && /시작 \d\d:\d\d/.test(await r1b.innerText())
      && (await r1b.locator('button', { hasText: '시작' }).count()) === 0 && (await pg.locator('.v2-sheet').count()) === 0, { st: a8 && a8.status, at: a8 && a8.startedAt, row: await r1b.innerText(), sheets: await pg.locator('.v2-sheet').count() });
    // 9) 내 할 일 모두 › 맨 위에도 바로 추가 · 줄마다 [시작] [끝냄]
    await pg.getByRole('button', { name: '내 할 일 모두 ›' }).click(); await pg.waitForTimeout(400);
    const ms = pg.locator('.v2-sheet').last(), min = ms.getByLabel('할 일 바로 추가', { exact: true });
    await min.fill('주간 보고'); await min.press('Enter'); await pg.waitForTimeout(400);
    ok('내 할 일 모두 · 바로 추가 → 목록에 · [시작] [끝냄]', ((await T('주간 보고')) || {}).dueDate === '2026-10-12' && (await ms.locator('[role=button]', { hasText: '주간 보고' }).locator('button', { hasText: '시작' }).count()) === 1);
    ok('내 할 일 모두 375 넘침 없음', !(await over(pg))); await pg.screenshot({ path: path.join(SHOTS, 'smoke-quickadd-mine-375.png') });
    await closeSheets(pg);
  }
  ok(`바로 추가 ${w} · 넘침 없음`, !(await over(pg)));
  if (w !== 375) { await pg.evaluate(() => document.querySelectorAll('.v2-toast').forEach((x) => { x.style.display = 'none'; })); await pg.screenshot({ path: path.join(SHOTS, `smoke-quickadd-${w}.png`) }); }
  ok(`바로 추가 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}
await b.close();
console.log(`\n${n - bad}/${n} 통과 · 그림 ${SHOTS}`); if (bad) process.exit(1);
