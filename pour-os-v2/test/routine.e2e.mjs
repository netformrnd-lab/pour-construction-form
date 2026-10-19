// 업무OS v2 · 반복 실행 한 목록 시험 (2026-10-16 사장님 "반복실행에 오늘체크와 횟수 구분된게 혼란스럽고 어렵게 느껴져")
//   가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: ai.e2e.mjs 와 같은 빌드 (npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js)
//   실행: node test/routine.e2e.mjs (SHOTS=폴더 → 화면 사진)
//   오늘 '반복 실행' = 정한 날 체크 + 횟수 목표 한 목록 · 늦은 것 → 시간 순서 → 시간 없는 체크 → 횟수(주 → 월 → 분기) · 끝낸 것 n ▾ · 375 · 768 · 1280
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-15T10:30:00+09:00', D0 = '2026-10-01T00:30:00.000Z';   // 목요일 10:30 (이번 주 = 10/12 월)
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

// ── 씨앗: 남윤정(나) · 김송희 · 허지은(관리자) ──
const U = [['yj', '남윤정', '1팀'], ['sh', '김송희', '2팀'], ['hj', '허지은', '공용']];
const users = Object.fromEntries(U.map(([id, name, team]) => [id, { id, name, team, role: 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z' }]));
const fx = (o) => ({ isFixed: true, recurType: 'daily', assigneeId: 'yj', assigneeIds: ['yj'], status: 'todo', scope: 'brand', brand: 'pourstore', doneDates: {}, createdAt: D0, statusLog: [], ...o });
const tasks = {
  f1: fx({ id: 'f1', title: '오전 CS 확인', fixedTime: '10:00', subsBy: { '*': [{ id: 's1', title: '네이버' }, { id: 's2', title: '쿠팡' }] } }),
  f2: fx({ id: 'f2', title: '오후 발주 확인', fixedTime: '15:00', qty: { label: '발주', unit: '건' } }),
  f3: fx({ id: 'f3', title: '주간 재고 점검', recurType: 'weekly', weekDays: ['월'], fixedTime: '11:00' }),   // 월요일에 못 함 → 밀림 10/12
  f4: fx({ id: 'f4', title: '그로홈 리뷰 답글', brand: 'grohome' }),   // 시간 없음
  f5: fx({ id: 'f5', title: '아침 메일 확인', fixedTime: '09:00', doneDates: { yj: '2026-10-15' } }),   // 오늘 끝냄
  m1: fx({ id: 'm1', title: '내 메모 정리', scope: 'me', brand: '', fixedTime: '17:00' }),   // 개인 고정업무 → '할 일' 카드
};
// 횟수 목표 = 버전1 행동지표(읽기만) — 이번 주 고객안내전화 1/4 · 체험단 1/1(끝) · 10월 블로그 2/8
const AK = [
  { id: 'x_call', name: '고객안내전화', cyc: 'W', goal: 4, unit: '건', who: ['yj'], brand: 'pourstore', active: true, core: true, startDate: '2026-09-01', qty: { label: '전화', unit: '건' } },
  { id: 'x_sub', name: '상세페이지 점검', cyc: 'W', goal: 2, unit: '회', who: ['yj'], brand: 'pourstore', active: true, startDate: '2026-09-01', subs: [{ id: 'a', title: '사진' }, { id: 'b', title: '문구' }] },
  { id: 'x_done', name: '체험단 모집 공지', cyc: 'W', goal: 1, unit: '회', who: ['yj'], brand: 'pourstore', active: true, startDate: '2026-09-01' },
  { id: 'x_blog', name: '블로그 포스팅', cyc: 'M', goal: 8, unit: '회', who: ['yj'], brand: 'pourstore', active: true, core: true, startDate: '2026-09-01' },
  { id: 'x_case', name: '시공사례 업로드', cyc: 'Q', goal: 3, unit: '건', who: ['yj', 'sh'], brand: 'grohome', active: true, startDate: '2026-09-01' },
];
const V1 = { 'state-actionKPIs': { items: AK },
  'kpi-act-2026-Q4': { w: { '2026-10-12': { x_call: { n: 1, by: { yj: 1 } }, x_done: { n: 1, by: { yj: 1 } } }, '2026-10-05': { x_blog: { n: 2, by: { yj: 2 } } } } } };
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks, notes: {}, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks: {}, aimates: {}, aiboards: {} } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, now = NOW } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route(/pages\.dev/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>hub</title>허브 화면 (시험)' }));   // 허브 새 창 (광고 운영 · 2026-10-19)
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS=${JSON.stringify(V1)}; window.__V1_LAUNCH=[]; window.__V2=${JSON.stringify(ST)};`);
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
const shot = async (pg, loc, name) => { await loc.scrollIntoViewIfNeeded(); await pg.waitForTimeout(150); await loc.screenshot({ path: path.join(SHOTS, name) }); };

const MODE = process.env.MODE || 'check';   // before = 지금 화면 사진만
const ORDER = ['주간 재고 점검', '오전 CS 확인', '오후 발주 확인', '그로홈 리뷰 답글', '고객안내전화', '상세페이지 점검', '블로그 포스팅', '시공사례 업로드'];
const SUBS = { '주간 재고 점검': '매주 월 11:00', '오전 CS 확인': '매일 10:00', '오후 발주 확인': '매일 15:00', '그로홈 리뷰 답글': '매일', '고객안내전화': '이번 주 1 / 4건', '상세페이지 점검': '이번 주 0 / 2회', '블로그 포스팅': '10월 2 / 8회', '시공사례 업로드': '4분기 0 / 3건 · 내 몫 0' };
for (const w of [375, 768, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 1000 : 1400 }), pg = s.pg, before = errs.length;
  await tab(pg, '오늘');
  const card = pg.locator('.v2-ts.rt'), rows = card.locator('[role=button]');
  const rowOf = (name) => card.locator('[role=button]', { hasText: name }).first();
  const head = () => card.locator('h3').innerText();
  const v2n = (id, wk = '2026-10-12') => pg.evaluate(([id, wk]) => { const d = (window.__V2.v2.kpiact || {})['2026-Q4']; return ((((d || {}).w || {})[wk] || {})[id] || {}).n || 0; }, [id, wk]);
  ok(`팀 ${w} · 반복 실행 카드 보임`, (await card.count()) === 1);
  await shot(pg, card, `rt-${MODE}-today-${w}.png`);
  if (MODE === 'before') { await s.close(); continue; }
  // ① 한 목록: 머리 하나 · '오늘 체크'·'횟수' 칸 이름 없음 · 순서 = 밀림 → 시간 → 시간 없는 체크 → 횟수(주 → 월 → 분기) · 2줄 = 얼마나 자주
  const txt = await card.innerText(), names = await rows.evaluateAll((els) => els.map((e) => e.innerText));
  ok(`팀 ${w} · 머리 '반복 실행 · 8개 남음' 하나 · '오늘 체크'·'횟수' 칸 없음`, (await head()).startsWith('반복 실행 · 8개 남음') && !txt.includes('오늘 체크') && !/^횟수$/m.test(txt) && !txt.includes('주 → 월 → 분기'), txt.slice(0, 200));
  ok(`팀 ${w} · 줄 순서 (밀림 → 시간 → 시간 없는 체크 → 횟수 주 → 월 → 분기)`, ORDER.every((nm, i) => (names[i] || '').includes(nm)) && names.length === ORDER.length, names.map((x) => x.split('\n').slice(0, 2).join(' ')));
  for (const [nm, sb] of Object.entries(SUBS)) ok(`팀 ${w} · ${nm} 2줄 '${sb}'`, (await rowOf(nm).innerText()).includes(sb), await rowOf(nm).innerText());
  ok(`팀 ${w} · 버튼 자리 하나: 체크 = [완료] · 횟수 = [+1] · 끝낸 것 2 ▾`, (await rowOf('주간 재고 점검').getByRole('button', { name: '완료', exact: true }).count()) === 1 && (await rowOf('고객안내전화').getByRole('button', { name: '고객안내전화 +1' }).count()) === 1 && txt.includes('끝낸 것 2 ▾'));
  ok(`팀 ${w} · 넘침 없음`, !(await over(pg)));
  if (w === 375) {
    // ② [+1] → '셌어요 · 취소' + 건수 묻기 → 건너뛰기 → 취소 = 통째로 되돌림 · [건수 넣기] → 남기기 → 2줄 '오늘 전화 2건' (단위 '건'이라 목표에도 더해짐)
    await rowOf('고객안내전화').getByRole('button', { name: '고객안내전화 +1' }).click(); await pg.waitForTimeout(400);
    const r1 = rowOf('고객안내전화');
    ok('[+1] → 셌어요 · 건수 묻기 · 이번 주 2 / 4건 · 머리 그대로 8개', (await r1.innerText()).includes('셌어요') && (await r1.innerText()).includes('이번 주 2 / 4건') && (await r1.locator('.v2-qty').count()) === 1 && (await head()).startsWith('반복 실행 · 8개 남음') && (await v2n('x_call')) === 1);
    await shot(pg, card, 'rt-after-plus-375.png');
    await r1.locator('.v2-qty').getByRole('button', { name: '건너뛰기' }).click(); await pg.waitForTimeout(300);
    await rowOf('고객안내전화').getByRole('button', { name: '취소', exact: true }).click(); await pg.waitForTimeout(400);
    ok('취소 → 이번 주 1 / 4건 (방금 누른 것 통째로)', (await rowOf('고객안내전화').innerText()).includes('이번 주 1 / 4건') && (await v2n('x_call')) === 0);
    await rowOf('고객안내전화').getByRole('button', { name: '건수 넣기' }).click(); await pg.waitForTimeout(300);
    await rowOf('고객안내전화').locator('.v2-qty input').fill('2'); await rowOf('고객안내전화').locator('.v2-qty').getByRole('button', { name: '남기기' }).click(); await pg.waitForTimeout(400);
    ok('건수 넣기 2 → 남겼어요 · 2줄 이번 주 3 / 4건 · 오늘 전화 2건', (await rowOf('고객안내전화').innerText()).includes('오늘 전화 2건 남겼어요') && (await rowOf('고객안내전화').innerText()).includes('이번 주 3 / 4건 · 오늘 전화 2건'), await rowOf('고객안내전화').innerText());
    // ③ [완료](건수 칸 있음) → 그 자리에서 건수 묻기 · 머리 7개 → 건너뛰기 → 끝낸 것 3
    await rowOf('오후 발주 확인').getByRole('button', { name: '완료', exact: true }).click(); await pg.waitForTimeout(400);
    ok('[완료] → 그 자리 건수 묻기 · ✓ 취소 · 머리 7개 남음', (await rowOf('오후 발주 확인').locator('.v2-qty').count()) === 1 && (await rowOf('오후 발주 확인').getByRole('button', { name: '✓ 취소' }).count()) === 1 && (await head()).startsWith('반복 실행 · 7개 남음')
      && (await pg.evaluate(() => window.__V2.v2.tasks.f2.doneDates.yj)) === '2026-10-15');
    await rowOf('오후 발주 확인').getByRole('button', { name: '건너뛰기' }).click(); await pg.waitForTimeout(400);
    ok('건너뛰기 → 남은 목록에서 빠짐 · 끝낸 것 3 ▾', (await card.locator('[role=button]', { hasText: '오후 발주 확인' }).count()) === 0 && (await card.innerText()).includes('끝낸 것 3 ▾'));
    // ④ 끝낸 것 펼치기 → 체크(✓ 취소) + 다 채운 횟수([+1]) 같이 · 거기서 [+1] → 그 자리에 '셌어요'
    await card.getByRole('button', { name: '끝낸 것 3 ▾' }).click(); await pg.waitForTimeout(300);
    const after = await rows.evaluateAll((els) => els.map((e) => e.innerText));
    ok('끝낸 것: 아침 메일 확인(매일 09:00 · ✓) · 오후 발주 확인 · 체험단 모집 공지(이번 주 1 / 1회 ✓)', after.some((x) => x.includes('아침 메일 확인') && x.includes('매일 09:00 · ✓')) && after.some((x) => x.includes('오후 발주 확인')) && after.some((x) => x.includes('체험단 모집 공지') && x.includes('이번 주 1 / 1회 ✓')));
    await shot(pg, card, 'rt-after-done-375.png');
    await rowOf('체험단 모집 공지').getByRole('button', { name: '체험단 모집 공지 +1' }).click(); await pg.waitForTimeout(400);
    const after2 = await rows.evaluateAll((els) => els.map((e) => e.innerText));
    ok('끝낸 것에서 [+1] → 그 자리(끝낸 것 아래)에 셌어요 · 2 / 1회', after2.findIndex((x) => x.includes('체험단 모집 공지')) > after2.findIndex((x) => x.includes('아침 메일 확인')) && (await rowOf('체험단 모집 공지').innerText()).includes('셌어요') && (await rowOf('체험단 모집 공지').innerText()).includes('이번 주 2 / 1회'));
    await rowOf('체험단 모집 공지').getByRole('button', { name: '취소', exact: true }).click(); await pg.waitForTimeout(300);
    // ⑤ 체크리스트 횟수: 칩 둘 다 → 1회 셌어요 · 이번 주 1 / 2회
    await rowOf('상세페이지 점검').getByRole('button', { name: '사진' }).click(); await pg.waitForTimeout(300);
    await rowOf('상세페이지 점검').getByRole('button', { name: '문구' }).click(); await pg.waitForTimeout(400);
    ok('체크리스트 한 바퀴 → 1회 셌어요 · 이번 주 1 / 2회 · 머리 7개 그대로', (await rowOf('상세페이지 점검').innerText()).includes('1회 셌어요') && (await rowOf('상세페이지 점검').innerText()).includes('이번 주 1 / 2회') && (await head()).startsWith('반복 실행 · 7개 남음'));
    // ⑥ 키보드: [+1] 에서 Enter = 세기만 (시트 안 열림)
    await rowOf('블로그 포스팅').getByRole('button', { name: '블로그 포스팅 +1' }).focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
    ok('[+1] 에서 Enter → 세기만 · 시트 안 열림', (await rowOf('블로그 포스팅').innerText()).includes('10월 3 / 8회') && (await pg.locator('.v2-sheet').count()) === 0);
    await rowOf('블로그 포스팅').getByRole('button', { name: '취소', exact: true }).click(); await pg.waitForTimeout(300);
    // ⑦ 줄 누르기 = 그 반복 실행 시트 (횟수 · 체크 같은 길)
    await rowOf('시공사례 업로드').locator('span', { hasText: '시공사례 업로드' }).first().click(); await pg.waitForTimeout(500);
    ok('횟수 줄 누르기 → 반복 실행 시트', (await pg.locator('.v2-sheet').last().innerText()).includes('시공사례 업로드'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    await rowOf('주간 재고 점검').locator('span', { hasText: '주간 재고 점검' }).first().click(); await pg.waitForTimeout(500);
    ok('체크 줄 누르기 → 그 시트', (await pg.locator('.v2-sheet').last().innerText()).includes('주간 재고 점검'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    // ⑧ 접기 → '다음 · 11:00 주간 재고 점검 ▾' 한 줄 · 이 기기 기억 · 누르면 펼침
    await card.getByRole('button', { name: '접기 ▴', exact: true }).click(); await pg.waitForTimeout(300);
    ok('접기 → 다음 한 줄 · 버튼 없음 · 기기 기억', (await card.innerText()).includes('다음 · 11:00 주간 재고 점검 ▾') && (await card.getByRole('button', { name: '완료', exact: true }).count()) === 0 && (await pg.evaluate(() => localStorage.getItem('pour-os2-rtfold'))) === 'true');
    await shot(pg, card, 'rt-after-fold-375.png');
    await card.getByRole('button', { name: /다음 · 11:00 주간 재고 점검/ }).click(); await pg.waitForTimeout(300);
    ok('다음 줄 누르기 → 펼침', (await card.getByRole('button', { name: '완료', exact: true }).count()) >= 3);
    ok('375 · 넘침 없음 (누른 뒤)', !(await over(pg)));
  }
  ok(`팀 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}
// ── 관리자: [반복 실행 n | 개인 n] 한 판 · 매일 · 매주 · 매월 · 분기 · 주별 표(접힘) · [+ 반복 실행] '얼마나 자주 해요?' ──
for (const w of [375, 768, 1280]) {
  const s = await session('hj', { admin: true, w, h: w > 700 ? 1000 : 1600 }), pg = s.pg, before = errs.length;
  await tab(pg, '반복 실행');
  const main = pg.locator('main').first(), grp = (l) => pg.locator('.a-rtgrp', { has: pg.locator('.a-rtgh b', { hasText: new RegExp('^' + l + '$') }) });
  const tabs = await pg.getByRole('tab').allInnerTexts();
  ok(`관리자 ${w} · 세그 [반복 실행 10 | 개인 1] (오늘 체크·횟수 칸 없음)`, tabs.includes('반복 실행 10') && tabs.includes('개인 1') && !tabs.some((x) => /오늘 체크|^횟수/.test(x)), tabs);
  const heads = await pg.locator('.a-rtgh').allInnerTexts();
  ok(`관리자 ${w} · 묶음 = 매일 오늘 1/4 · 매주 이번 주 1/4 · 매월 이번 달 0/1 · 분기 이번 분기 0/1`, heads.map((x) => x.replace(/\s+/g, ' ')).join(' | ') === '매일 오늘 1 / 4 | 매주 이번 주 1 / 4 | 매월 이번 달 0 / 1 | 분기 이번 분기 0 / 1', heads);
  const wk = await grp('매주').innerText();
  ok(`관리자 ${w} · 매주 묶음에 체크(주간 재고 점검 매주 월 11:00)와 여러 번(고객안내전화 주 4건 · 남윤정 1 · 1/4)이 같이`, wk.includes('주간 재고 점검') && wk.includes('매주 월 11:00') && wk.includes('고객안내전화') && wk.includes('주 4건') && /남윤정 1/.test(wk) && wk.includes('1/4'), wk.slice(0, 300));
  ok(`관리자 ${w} · 분기 묶음 시공사례 업로드 담당 2명 칸`, /남윤정 0/.test(await grp('분기').innerText()) && /김송희 0/.test(await grp('분기').innerText()));
  ok(`관리자 ${w} · 주별 표는 접혀 있음`, (await pg.getByRole('heading', { name: /^주별 표/ }).count()) === 0);
  await pg.getByRole('button', { name: /주별 표 · 여러 번 하는 반복 실행/ }).click(); await pg.waitForTimeout(400);
  ok(`관리자 ${w} · 주별 표 펼치면 버전1 표(주 칸)`, (await pg.getByRole('heading', { name: /^주별 표/ }).count()) === 1 && (await pg.locator('.a-akrow').count()) >= 4);
  ok(`관리자 ${w} · 넘침 없음`, !(await over(pg)));
  await pg.screenshot({ path: path.join(SHOTS, `rt-${MODE}-admin-${w}.png`), fullPage: true });
  await pg.getByRole('button', { name: /주별 표 · 여러 번 하는 반복 실행/ }).click(); await pg.waitForTimeout(200);
  if (w === 375) {
    // [+ 반복 실행] → '얼마나 자주 해요?' 칩 6개 → '주 ○번' = 한 주에 몇 번 → 저장 → 매주 묶음에 바로
    await pg.getByRole('button', { name: '+ 반복 실행' }).click(); await pg.waitForTimeout(400);
    const sh = pg.locator('.v2-sheet').last();
    const chips = await sh.getByRole('group', { name: '얼마나 자주' }).getByRole('button').allInnerTexts();
    ok('만들기: 얼마나 자주 해요? [매일 매주 매월 주 ○번 월 ○번 분기 ○번] · 종류 고르기 없음', chips.join(' ') === '매일 매주 매월 주 ○번 월 ○번 분기 ○번' && !(await sh.innerText()).includes('정한 날 체크 |') && !(await sh.innerText()).includes('어떤 반복이에요'), chips);
    await sh.getByRole('button', { name: '주 ○번' }).click(); await pg.waitForTimeout(150);
    ok('주 ○번 → 한 주에 몇 번? · [+1] 안내', (await sh.innerText()).includes('한 주에 몇 번?') && (await sh.innerText()).includes('할 때마다 [+1]'));
    await sh.getByLabel('반복 실행 이름').fill('리뷰 답글 달기'); await sh.getByRole('group', { name: '브랜드' }).getByRole('button', { name: 'POUR스토어' }).click();
    await sh.getByRole('group', { name: '담당' }).getByRole('button', { name: '남윤정' }).click(); await sh.getByLabel('목표 숫자').fill('3');
    await pg.screenshot({ path: path.join(SHOTS, 'rt-after-add-375.png') });
    await sh.getByRole('button', { name: '저장' }).click(); await pg.waitForTimeout(600);
    ok('저장 → 매주 묶음에 리뷰 답글 달기 · 주 3회', (await grp('매주').innerText()).includes('리뷰 답글 달기') && (await grp('매주').innerText()).includes('주 3회'));
    // 매주 → 요일 칩 · 시간 → 정한 날 체크로 저장
    await pg.getByRole('button', { name: '+ 반복 실행' }).click(); await pg.waitForTimeout(400);
    const sh2 = pg.locator('.v2-sheet').last();
    await sh2.getByRole('button', { name: '매주', exact: true }).click(); await pg.waitForTimeout(150);
    ok('매주 → 요일 칩 · [완료] 안내', (await sh2.getByRole('group', { name: '요일' }).count()) === 1 && (await sh2.innerText()).includes('정한 날에 한 번 [완료]'));
    await sh2.getByLabel('반복 실행 이름').fill('금요일 정산 확인'); await sh2.getByRole('group', { name: '브랜드' }).getByRole('button', { name: 'POUR스토어' }).click();
    await sh2.getByRole('group', { name: '담당' }).getByRole('button', { name: '남윤정' }).click();
    await sh2.getByRole('group', { name: '요일' }).getByRole('button', { name: '월' }).click(); await sh2.getByRole('group', { name: '요일' }).getByRole('button', { name: '금' }).click();
    await sh2.getByRole('button', { name: '저장' }).click(); await pg.waitForTimeout(600);
    ok('저장 → 매주 묶음에 금요일 정산 확인 · 매주 금', (await grp('매주').innerText()).includes('금요일 정산 확인') && (await grp('매주').innerText()).includes('매주 금'));
  }
  ok(`관리자 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}
// ── 반복 실행 입력 자료 (2026-10-19 김송희 "김민지님 금 16:30 사장님 보고(반복 실행)는 그대로 두되, 입력 자료는 그날 아침 adreports 주간 보고서를 쓰도록 안내") ──
//   금요일 오늘 줄 아래 '입력 · 광고 주간 보고서 10/16(금) 08:30 ›' (허브 ads.html#그 금요일-weekly 새 창 · 줄 누르기로 안 번짐) · 시트 '입력 자료' 칸 · 다른 반복 실행엔 없음 · 375·768·1280
ST.v2.tasks.f_adw = fx({ id: 'f_adw', title: '광고 주간 분석 보고 (사장님께)', recurType: 'weekly', weekDays: ['금'], fixedTime: '16:30', brand: 'common', memo: 'Aside 가 금 16:00 에 올린 주간 광고 보고서를 보고 …' });
for (const w of [375, 768, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 1000 : 1400, now: '2026-10-16T10:30:00+09:00' }), pg = s.pg, before = errs.length;   // 금요일 10:30
  await tab(pg, '오늘');
  const card = pg.locator('.v2-ts.rt'), row = card.locator('[role=button]', { hasText: '광고 주간 분석 보고' }).first();
  const pill = row.locator('a.v2-rtin');
  ok(`입력 자료 ${w}: 금요일 줄 아래 '입력 · 광고 주간 보고서 10/16(금) 08:30 ›' · 다른 줄엔 없음`, (await pill.count()) === 1 && (await pill.innerText()).replace(/\s+/g, ' ').trim() === '입력 · 광고 주간 보고서 10/16(금) 08:30 ›' && (await card.locator('a.v2-rtin').count()) === 1, await card.innerText());
  ok(`입력 자료 ${w}: 주소 = 허브 광고 운영 #2026-10-16-weekly · 새 창`, (await pill.getAttribute('href')) === 'https://pour-construction-form.pages.dev/marketing-hub/ads.html#2026-10-16-weekly' && (await pill.getAttribute('target')) === '_blank');
  const [pop] = await Promise.all([pg.waitForEvent('popup'), pill.click()]); await pg.waitForTimeout(300);
  ok(`입력 자료 ${w}: 누르면 새 창(그 주간 보고서) · 시트는 안 열림`, pop.url().endsWith('/marketing-hub/ads.html#2026-10-16-weekly') && (await pg.locator('.v2-sheet').count()) === 0, pop.url());
  await pop.close();
  if (w === 375) await shot(pg, row, 'rt-input-row-375.png');
  ok(`입력 자료 ${w}: 넘침 없음`, !(await over(pg)));
  await row.click(); await pg.waitForTimeout(500);
  const sh = pg.locator('.v2-sheet').last(), st = await sh.innerText();
  ok(`입력 자료 ${w}: 시트 '입력 자료' 칸 = 광고 주간 보고서 · 10/16(금) 08:30 · 김송희 Aside 광고 루틴 · 예전 16:00 → 08:30 · [열기 ›]`, st.includes('입력 자료') && st.includes('광고 주간 보고서 · 10/16(금) 08:30') && st.includes("그날 아침 김송희 Aside '광고' 루틴이 올린 것 (예전 금 16:00 → 금 08:30)") && (await sh.getByRole('button', { name: '광고 주간 보고서 10/16(금) 08:30 열기' }).count()) === 1, st.slice(0, 400));
  const [pop2] = await Promise.all([pg.waitForEvent('popup'), sh.getByRole('button', { name: '광고 주간 보고서 10/16(금) 08:30 열기' }).click()]);
  ok(`입력 자료 ${w}: 시트 [열기 ›] = 같은 주간 보고서`, pop2.url().endsWith('#2026-10-16-weekly'), pop2.url()); await pop2.close();
  if (w === 375) { await pg.screenshot({ path: path.join(SHOTS, 'rt-input-sheet-375.png') }); }
  ok(`입력 자료 ${w}: 시트 넘침 없음 · 화면 오류 없음`, !(await over(pg)) && errs.length === before, errs.slice(before));
  await s.close();
}
{ const s = await session('yj', { now: '2026-10-19T10:30:00+09:00' }), pg = s.pg;   // 월요일: 오늘 줄엔 없음(금요일 일) · 시트를 열면 지난 금요일 보고서
  await tab(pg, '오늘');
  ok('입력 자료 월요일: 오늘 목록엔 안 보임 (금요일 반복 실행)', (await pg.locator('a.v2-rtin').count()) === 0);
  await s.close(); }
await b.close();
console.log(`\n${n - bad}/${n} 통과${bad ? ` · ${bad} 실패` : ''}${errs.length ? '\n화면 오류:\n' + errs.join('\n') : ''}`);
process.exit(bad || errs.length ? 1 : 0);
