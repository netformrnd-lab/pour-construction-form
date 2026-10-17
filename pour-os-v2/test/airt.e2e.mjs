// 업무OS v2 · AI 크루 ↔ 반복 실행 시험 (2026-10-16 사장님 "ai크루를 활용해서 반복업무들을 해결하는건데 이거 연관해서 이용하기 좋게 세팅해줘")
//   가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: ai.e2e.mjs 와 같은 빌드 (npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js)
//   실행: node test/airt.e2e.mjs (SHOTS=폴더 → 화면 사진)
//   ① 관리자 반복 실행 'AI 크루 짝' 추천 → [추천대로 짝 짓기] → 저장(actAk · actOwners) · 되돌리기
//   ② 팀 앱 오늘 반복 실행 줄 'AI 겨울 · 확인할 결과 1 · 실행 1 ›' · 시트 'AI 크루' 칸 · [AI에게 맡기기] 미리 채움 · 실행 [했어요] = +1 / 정한 날 체크 오늘 체크
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';
import { askDoc } from '../../marketing-hub/crew.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-15T10:30:00+09:00', D0 = '2026-10-01T00:30:00.000Z', T0 = '2026-10-15T00:10:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

const U = [['yj', '남윤정', '1팀'], ['sh', '김송희', '2팀'], ['hj', '허지은', '공용']];
const users = Object.fromEntries(U.map(([id, name, team]) => [id, { id, name, team, role: 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z' }]));
const fx = (o) => ({ isFixed: true, recurType: 'daily', assigneeId: 'yj', assigneeIds: ['yj'], status: 'todo', scope: 'brand', brand: 'pourstore', doneDates: {}, createdAt: D0, statusLog: [], ...o });
const exec = (o) => ({ isFixed: false, type: 'general', status: 'todo', assigneeId: 'yj', assigneeIds: ['yj'], projectId: '', parentId: null, memo: '', attachments: [], createdAt: T0, statusLog: [], noReview: true, madeIn: 'v2', aiMate: 'gyeoul', aiBoard: 'gh-conv', ...o });
const tasks = {
  f1: fx({ id: 'f1', title: '오전 CS 확인', fixedTime: '10:00' }),
  f3: fx({ id: 'f3', title: '주간 재고 점검', recurType: 'weekly', weekDays: ['월'], fixedTime: '11:00' }),
  f4: fx({ id: 'f4', title: '그로홈 리뷰 답글', brand: 'grohome' }),
  m1: fx({ id: 'm1', title: '내 메모 정리', scope: 'me', brand: '', fixedTime: '17:00' }),
  // 최종 승인 뒤 실행 업무 (짝 = 상세페이지 점검 · 그로홈 리뷰 답글)
  aix_c0: exec({ id: 'aix_c0', title: '실행 · 겨울 C · 상세 첫 화면 (C1)', aiAsk: 'ai_gyeoul_20261014_c0', aiAct: 'C', aiAk: 'x_sub', aiItems: [{ n: 'C1', t: '상세 첫 화면 문구 고치기', link: '' }], dueDate: '2026-10-15' }),
  aix_e0: exec({ id: 'aix_e0', title: '실행 · 바람 D · 리뷰 답글 (D1)', aiMate: 'baram', aiBoard: 'gh-ref', aiAsk: 'ai_baram_20261014_e0', aiAct: 'D', aiAk: 'fx:f4', aiItems: [{ n: 'D1', t: '리뷰 답글 3개 게시', link: '' }], dueDate: '2026-10-15' }),   // 리뷰 = 바람 D (2026-10-17 겨울 E 에서)
};
const AK = [
  { id: 'x_call', name: '고객안내전화', cyc: 'W', goal: 4, unit: '건', who: ['yj'], brand: 'pourstore', active: true, core: true, startDate: '2026-09-01' },
  { id: 'x_sub', name: '상세페이지 점검', cyc: 'W', goal: 2, unit: '회', who: ['yj'], brand: 'grohome', active: true, startDate: '2026-09-01' },
  { id: 'x_done', name: '체험단 모집 공지', cyc: 'W', goal: 1, unit: '회', who: ['yj', 'sh'], brand: 'pourstore', active: true, startDate: '2026-09-01' },
  { id: 'x_blog', name: '블로그 포스팅', cyc: 'M', goal: 8, unit: '회', who: ['yj'], brand: 'pourstore', active: true, core: true, startDate: '2026-09-01' },
];
const V1 = { 'state-actionKPIs': { items: AK }, 'kpi-act-2026-Q4': { w: { '2026-10-05': { x_blog: { n: 2, by: { yj: 2 } } } } } };
const ask = (o) => askDoc({ at: T0, run: '2026-10-15', ...o });
const aiasks = {
  // 실행 업무의 승인 건 (최종 승인 끝)
  ai_gyeoul_20261014_c0: { ...ask({ id: 'ai_gyeoul_20261014_c0', run: '2026-10-14', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', title: '전환 보드 C · 상세 첫 화면', items: [{ n: 'C1', c: { 상품: '롤러일체형' } }], exec: '승인되면 담당이 상세에 올린다', owner: 'yj' }), state: 'ok', execTask: 'aix_c0' },
  ai_baram_20261014_e0: { ...ask({ id: 'ai_baram_20261014_e0', run: '2026-10-14', mate: 'baram', brand: 'grohome', board: 'gh-ref', act: 'D', title: '지인추천 보드 D · 리뷰 답글', items: [{ n: 'D1', c: { 상품: '롤러일체형' } }], exec: '승인되면 담당이 답글을 게시한다', owner: 'yj' }), state: 'ok', execTask: 'aix_e0' },
  ai_gyeoul_20261015_c1: ask({ id: 'ai_gyeoul_20261015_c1', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', title: '전환 보드 C · 상세 첫 화면 다시', cols: ['상품', '고칠 곳'], items: [{ n: 'C1', c: { 상품: '롤러일체형', '고칠 곳': '첫 화면 문구' } }], exec: '승인되면 담당이 상세에 올린다', owner: 'yj' }),
};
const brands = { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } };
const mates0 = { gyeoul: { id: 'gyeoul', owners: { grohome: 'sh' } }, yeoreum: { id: 'yeoreum', owners: { _: 'sh' } } };
const store = (aimates) => ({ meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks, notes: {}, log: {}, events: {}, brands, workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates, aiboards: {}, aireqs: {} } });

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, st } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.clock.setFixedTime(new Date(NOW));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS=${JSON.stringify(V1)}; window.__V1_LAUNCH=[]; window.__V2=${JSON.stringify(st)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid}${admin ? ' 관리자' : ''} ${w}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} ${w} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html'));
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(800);
  return { pg, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };
const mates = (pg) => pg.evaluate(() => window.__V2.v2.aimates);
const toast = (pg) => pg.locator('.v2-toast').innerText().catch(() => '');

// ── ① 관리자: 'AI 크루 짝' 추천 → [추천대로 짝 짓기] ──
for (const w of [375, 1280]) {
  const s = await session('hj', { admin: true, w, h: w > 700 ? 1000 : 1600, st: store(mates0) }), pg = s.pg, before = errs.length;
  await tab(pg, '반복 실행');
  const panel = pg.locator('.a-rtset', { has: pg.getByRole('button', { name: /^AI 크루 짝/ }) });
  const head = () => panel.getByRole('button', { name: /^AI 크루 짝/ }).innerText();
  ok(`관리자 ${w} · AI 크루 짝 0 / 7 · 추천 5`, /AI 크루 짝 0 \/ 7 .*추천 5/.test(await head()), await head());
  const sug = await panel.locator('.a-rtsrow').allInnerTexts();
  ok(`관리자 ${w} · 추천: 블로그 포스팅 ← 여름 아침 루틴 · 체험단 ← 여름 A · 상세페이지 ← 겨울 C · 그로홈 리뷰 답글(체크) ← 바람 D · 주간 재고 점검 ← 이음 F (2026-10-17)`,
    sug.some((x) => x.includes('블로그 포스팅') && x.includes('여름 · 아침 루틴 원고')) && sug.some((x) => x.includes('체험단 모집 공지') && x.includes('여름 · A '))
    && sug.some((x) => x.includes('상세페이지 점검') && x.includes('겨울 · C ') && x.includes('결과 확인·실행 남윤정')) && sug.some((x) => x.includes('그로홈 리뷰 답글') && x.includes('바람 · D ')) && sug.some((x) => x.includes('주간 재고 점검') && x.includes('이음 · F ')), sug);
  ok(`관리자 ${w} · 넘침 없음`, !(await over(pg)));
  await panel.screenshot({ path: path.join(SHOTS, `airt-admin-${w}.png`) });
  if (w === 375) {
    await panel.getByRole('button', { name: '추천대로 5개 짝 짓기' }).click(); await pg.waitForTimeout(700);
    const m = await mates(pg);
    ok('추천대로 → 토스트 · 짝 5개 저장(아침 루틴 _ · A · C · 바람 D=fx:f4 · 이음 F=fx:f3) · 담당 한 명이면 할 일 담당(_ 빼고)', /AI 짝 5개를 정했어요/.test(await toast(pg))
      && m.yeoreum.actAk._ === 'x_blog' && m.yeoreum.actAk.A === 'x_done' && m.gyeoul.actAk.C === 'x_sub' && m.baram.actAk.D === 'fx:f4' && m.ieum.actAk.F === 'fx:f3'
      && m.gyeoul.actOwners.C === 'yj' && m.baram.actOwners.D === 'yj' && !(m.yeoreum.actOwners || {}).A && !(m.yeoreum.actOwners || {})._, m);
    ok('짝 지은 뒤: AI 크루 짝 5 / 7 · 추천 0 · 한 판 줄에 AI 이름', /AI 크루 짝 5 \/ 7 .*추천 0/.test(await head()) && (await pg.locator('.a-rtgrp', { hasText: '상세페이지 점검' }).innerText()).includes('AI 겨울'));
    await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(700);
    const m2 = await mates(pg);
    ok('되돌리기 → 짝·할 일 담당 이전 값', !m2.gyeoul.actAk.C && !((m2.baram || {}).actAk || {}).D && !((m2.ieum || {}).actAk || {}).F && !m2.yeoreum.actAk._ && !m2.gyeoul.actOwners.C, m2);
    // 줄 하나만 [짝 짓기]
    await panel.locator('.a-rtsrow', { hasText: '상세페이지 점검' }).getByRole('button', { name: '짝 짓기' }).click(); await pg.waitForTimeout(600);
    ok('줄 [짝 짓기] → 그 짝만', (await mates(pg)).gyeoul.actAk.C === 'x_sub' && !(((await mates(pg)).baram || {}).actAk || {}).D);
  }
  ok(`관리자 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}

// ── ② 팀 앱 (남윤정): 짝 지은 뒤 ──
const mates1 = { gyeoul: { id: 'gyeoul', owners: { grohome: 'yj' }, actAk: { C: 'x_sub' }, actOwners: { C: 'yj' } }, baram: { id: 'baram', owners: { grohome: 'yj' }, actAk: { D: 'fx:f4' }, actOwners: { D: 'yj' } }, yeoreum: { id: 'yeoreum', owners: { _: 'yj' }, actAk: { _: 'x_blog' } } };   // 리뷰 = 바람 D (2026-10-17)
for (const w of [375, 768, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 1000 : 1400, st: store(mates1) }), pg = s.pg, before = errs.length;
  await tab(pg, '오늘');
  const card = pg.locator('.v2-ts.rt'), rowOf = (name) => card.locator('[role=button]', { hasText: name }).first();
  ok(`팀 ${w} · 상세페이지 점검 줄 'AI 겨울 · 확인할 결과 1 · 실행 1 ›'`, (await rowOf('상세페이지 점검').locator('.v2-rtai').innerText()).replace(/\s+/g, ' ').trim() === 'AI 겨울 · 확인할 결과 1 · 실행 1 ›', await rowOf('상세페이지 점검').innerText());
  ok(`팀 ${w} · 그로홈 리뷰 답글(정한 날 체크) 줄 'AI 바람 · 실행 1' · 블로그 포스팅은 기다리는 것 없음 → 줄 없음`, (await rowOf('그로홈 리뷰 답글').locator('.v2-rtai').innerText()).includes('실행 1') && (await rowOf('블로그 포스팅').locator('.v2-rtai').count()) === 0);
  ok(`팀 ${w} · 넘침 없음`, !(await over(pg)));
  if (w === 375) {
    await card.screenshot({ path: path.join(SHOTS, 'airt-today-375.png') });
    await rowOf('상세페이지 점검').locator('.v2-rtai').click(); await pg.waitForTimeout(500);
    ok('AI 줄 → 확인할 결과(승인 한 장)', (await pg.locator('.v2-sheet').last().innerText()).includes('상세 첫 화면 다시'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    // 시트 'AI 크루' 칸
    await rowOf('블로그 포스팅').locator('span', { hasText: '블로그 포스팅' }).first().click(); await pg.waitForTimeout(500);
    let sh = pg.locator('.v2-sheet').last();
    ok('블로그 포스팅 시트: AI 크루 = 여름 · 아침 루틴 원고 · [AI에게 맡기기]', (await sh.innerText()).includes('여름 · 아침 루틴 원고') && (await sh.getByText('AI에게 맡기기', { exact: true }).count()) === 1);
    await sh.screenshot({ path: path.join(SHOTS, 'airt-sheet-375.png') });
    await sh.getByText('AI에게 맡기기', { exact: true }).click(); await pg.waitForTimeout(500);
    sh = pg.locator('.v2-sheet').last();
    ok('[AI에게 맡기기] → 여름에게 · 무엇을 = 블로그 포스팅 — (미리 채움)', (await sh.getByLabel('무엇을').inputValue()) === '블로그 포스팅 — ' && (await sh.getByRole('button', { name: '여름(AI)에게 맡기기' }).count()) === 1);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    await rowOf('고객안내전화').locator('span', { hasText: '고객안내전화' }).first().click(); await pg.waitForTimeout(500);
    ok('짝도 추천도 없는 반복 실행: 아직 없어요 · 정하는 곳 안내 · [짝 짓기] 없음', (await pg.locator('.v2-sheet').last().innerText()).includes('도와주는 AI 크루가 아직 없어요') && (await pg.locator('.v2-sheet').last().getByRole('button', { name: /짝 짓기/ }).count()) === 0);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    // 실행 업무 [했어요] → 여러 번 +1
    await rowOf('상세페이지 점검').locator('span', { hasText: '상세페이지 점검' }).first().click(); await pg.waitForTimeout(500);
    await pg.locator('.v2-sheet').last().getByText('실행 업무 1건', { exact: true }).click(); await pg.waitForTimeout(500);
    await pg.locator('.v2-sheet').last().getByRole('button', { name: 'C1 했어요' }).click(); await pg.waitForTimeout(700);
    const k = await pg.evaluate(() => ((((window.__V2.v2.kpiact || {})['2026-Q4'] || {}).w || {})['2026-10-12'] || {}).x_sub || {});
    ok("실행 [C1 했어요] → 반복 '상세페이지 점검' +1", /반복 '상세페이지 점검' \+1/.test(await toast(pg)) && k.n === 1, { k, t: await toast(pg) });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    // 정한 날 체크 짝: [했어요] → 오늘 체크
    await rowOf('그로홈 리뷰 답글').locator('.v2-rtai').click(); await pg.waitForTimeout(500);
    await pg.locator('.v2-sheet').last().getByRole('button', { name: 'D1 했어요' }).click(); await pg.waitForTimeout(700);
    ok("실행 [D1 했어요] → '그로홈 리뷰 답글' 오늘 체크", /'그로홈 리뷰 답글' 오늘 체크/.test(await toast(pg)) && (await pg.evaluate(() => window.__V2.v2.tasks.f4.doneDates.yj)) === '2026-10-15', await toast(pg));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    ok('오늘 카드: 그로홈 리뷰 답글은 끝낸 것으로', (await card.locator('[role=button]', { hasText: '그로홈 리뷰 답글' }).count()) === 0 && (await card.innerText()).includes('끝낸 것'));
    ok('375 · 넘침 없음 (누른 뒤)', !(await over(pg)));
  }
  ok(`팀 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}
await b.close();
console.log(`\n${n - bad}/${n} 통과${bad ? ` · ${bad} 실패` : ''}${errs.length ? '\n화면 오류:\n' + errs.join('\n') : ''}`);
process.exit(bad || errs.length ? 1 : 0);
