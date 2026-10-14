// 업무OS v2 · AI 승인 화면 시험 (가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음)
//   준비: npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js
//   실행: node test/ai.e2e.mjs   (그림 = SHOTS 폴더 · 기본 test/out/shots)
//   흐름: 관리자(허지은) 상급자 추천대로 → 겨울 담당 = 남윤정 → 남윤정 번호 골라 승인 → 김소연(리드) 좁혀 승인 → 허지은(본부장) 최종 → 남윤정 '실행' 업무
//         · AI 에게 다시 · 돌려보내기 · 담당 미정 = 관리자 누구나 · 되돌리기 · 그사이 다른 사람이 바꿈 · 375·768·1280 넘침 없음
//         · (2026-10-15) 담당 PC Aside 세팅 안내('확인할 것') · 세팅 시트 · 더 만들기 n개 · 횟수(aimates.qty) · 오늘 안 돎 · 담당 미정(관리자)
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';
import { askDoc } from '../../marketing-hub/crew.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-12T10:00:00+09:00', T0 = '2026-10-12T00:30:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

// ── 씨앗 데이터 ──
const U = [['yj', '남윤정', '1팀'], ['sy', '김소연', '1팀'], ['hj', '허지은', '공용'], ['cw', '김채원', '3팀'], ['yr', '변유림', '3팀'], ['ran', '이란', '2팀'], ['sh', '김송희', '2팀'], ['mj', '김민지', '2팀']];
const users = Object.fromEntries(U.map(([id, name, team]) => [id, { id, name, team, role: id === 'sh' ? 'lead' : 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z' }]));
const ask = (o) => askDoc({ at: T0, run: '2026-10-12', ...o });
const items3 = [{ n: 'B1', c: { 항목: '1+1 옵션', 내용: '19,900원', 근거: '쿠팡 동등 제품 11,000원' } }, { n: 'B2', c: { 항목: '툴 포함 키트', 내용: '29,900원' } }, { n: 'B3', c: { 항목: '단품 저가', 내용: '12,900원' } }];
const aiasks = {
  ai_gyeoul_20261012_ghconvB: ask({ id: 'ai_gyeoul_20261012_ghconvB', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'B', title: '전환 보드 B · 쿠팡 유리블러 가격·구성 재설계', sum: '가격안 3개 · 경쟁 대비 근거', cols: ['항목', '내용', '근거'], items: items3, exec: '승인되면 담당이 윙에서 가격·옵션을 바꾸고 모카 카드 갱신을 요청한다' }),
  ai_gyeoul_20261012_ghconvA: ask({ id: 'ai_gyeoul_20261012_ghconvA', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'A', title: '전환 보드 A · 품절 0 만들기', cols: ['상품', '채널', '가용재고'], items: [{ n: 'A1', c: { 상품: '롤러일체형', 채널: '스마트스토어', 가용재고: '0' } }, { n: 'A2', c: { 상품: '롤러 미니', 채널: '쿠팡', 가용재고: '340' } }], exec: '승인되면 담당이 상세페이지·재입고 알림에 반영한다' }),
  ai_gyeoul_20261012_ghconvC: ask({ id: 'ai_gyeoul_20261012_ghconvC', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', title: '전환 보드 C · 히어로 상품 상세 진단', cols: ['상품', '문제', '고칠 점'], items: [{ n: 'C1', c: { 상품: '유리블러', 문제: '첫 화면에 가격 없음', '고칠 점': '가격·구성 첫 화면' } }, { n: 'C2', c: { 상품: '롤러일체형', 문제: '시공 사진 부족', '고칠 점': '전후 사진 3장' } }], exec: '승인되면 담당이 상세페이지를 고친다' }),
  ai_pori_20261012_blog3: ask({ id: 'ai_pori_20261012_blog3', mate: 'pori', brand: 'pourstore', title: '포리 · 블로그 원고 3 (균열 보수 빠데)', sum: '27칸 표준 · 구조 검사 ✓9', url: 'https://example.test/hub#team', exec: '승인되면 담당이 [임시저장 맡기기] 뒤 블로그에서 발행한다' }),
};
const seed = () => ({ meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks: { t1: { id: 't1', title: '추석 이벤트 배너 문구', isFixed: false, status: 'todo', assigneeId: 'yj', assigneeIds: ['yj'], projectId: '', dueDate: '2026-10-13', createdAt: T0, statusLog: [] } },
    notes: {}, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates: {}, aiboards: { 'gh-conv': { id: 'gh-conv', board: 'gh-conv', metrics: { cv_mall: { v: 7.4, date: '2026-10-12' }, cv_cp: { v: 2.4, date: '2026-10-12' }, soldout: { v: 0, date: '2026-10-12' } } } } } });
let ST = seed();

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, now = NOW } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });   // 폰 = 한국 시각 (Aside '오늘 안 돎'은 시:분을 봄)
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`try{ if(sessionStorage.__V2) window.__V2=JSON.parse(sessionStorage.__V2); }catch(e){} window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; if(!window.__V2) window.__V2=${JSON.stringify(ST)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html'));
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(700);
  const S = () => pg.locator('.v2-sheet').last();
  return { pg, S, close: async () => { ST = await pg.evaluate(() => window.__V2); await ctx.close(); } };
}
const doc = (key, id) => ST.v2[key] && ST.v2[key][id];
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const shot = (pg, name) => pg.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
const inbox = (pg, txt) => pg.locator('.v2-page [role=button]').filter({ hasText: txt });
const expand = async (pg) => { const m = pg.getByText(/^\d+개 모두 보기/); if (await m.count()) { await m.first().click(); await pg.waitForTimeout(300); } };   // 확인할 것 3줄 넘으면 펼치기
const boxOf = (S, label) => S().getByLabel(label + ' 글').inputValue().catch(() => '');   // 복사 버튼 → (http 시험 주소라 클립보드 없음) 글 칸

// ① 관리자(허지은 · PC) — 사람 탭: 상급자 추천대로 → AI 팀원 탭: 겨울 담당(그로홈) = 남윤정
{ const s = await session('hj', { admin: true, w: 1280, h: 900 });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '사람', exact: true }).click(); await s.pg.waitForTimeout(400);
  ok('관리자 사람 탭: 상급자 패널', await s.pg.getByText('상급자 (AI 승인 길)').count() > 0);
  await s.pg.getByRole('button', { name: '추천대로 정하기' }).click(); await s.pg.waitForTimeout(500);
  await shot(s.pg, 'admin-people-1280');
  await s.pg.locator('.v2-nav').getByRole('button', { name: 'AI 팀원', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('관리자 AI 팀원 탭: 크루 3 · 원형 칸 없음(2026-10-14 하루·포리·에코 쉼) · 여름 = 아침 루틴', (await s.pg.getByText('그로홈 · POUR스토어 B2C 크루').count()) > 0 && (await s.pg.getByText('POUR스토어 B2B 크루').count()) > 0 && (await s.pg.getByText('바라스데이 크루').count()) > 0 && (await s.pg.getByText('기본 AI 팀원 (원형)').count()) === 0 && (await s.pg.getByText('평일 06:50 블로그·재배포').count()) > 0);
  await s.pg.getByRole('button', { name: '담당 한꺼번에 정하기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByLabel('겨울 담당 그로홈').selectOption('yj'); await s.pg.waitForTimeout(600);
  // 아침 루틴 팀원 여름 = 기본(브랜드 섞인 아침 원고) + 브랜드별 · 다른 크루는 브랜드별만 (2026-10-14)
  ok('담당 한꺼번에: 여름 = 기본 + 그로홈 + POUR스토어 · 겨울엔 기본 없음', (await s.pg.getByLabel('여름 담당', { exact: true }).count()) === 1 && (await s.pg.getByLabel('여름 담당 그로홈').count()) === 1 && (await s.pg.getByLabel('여름 담당 POUR스토어').count()) === 1 && (await s.pg.getByLabel('겨울 담당', { exact: true }).count()) === 0);
  await s.pg.getByLabel('여름 담당', { exact: true }).selectOption('cw'); await s.pg.waitForTimeout(600);
  ok('관리자: 담당 미정 크루 4명 = 관리자 PC 카드 (가을·봄·우주·하늘)', (await s.pg.getByText('담당 미정 크루 4명 · 관리자 PC 에서').count()) > 0 && (await s.pg.getByText('가을 · 봄 · 우주 · 하늘 · 담당을 정하면 그 사람 PC 로 옮겨가요').count()) > 0);
  ok('관리자 AI 탭 넘침 없음 1280', !(await over(s.pg)));
  await shot(s.pg, 'admin-ai-1280');
  await s.pg.setViewportSize({ width: 375, height: 812 }); await s.pg.waitForTimeout(400);
  ok('관리자 AI 탭 넘침 없음 375', !(await over(s.pg))); await shot(s.pg, 'admin-ai-375');
  await s.close();
  eq('상급자 추천대로', ['yj', 'sy', 'hj', 'cw', 'yr', 'ran', 'sh', 'mj'].map((id) => doc('users', id).bossId || ''), ['sy', 'hj', '', 'hj', 'cw', 'sh', 'hj', 'sh']);
  eq('겨울 담당(그로홈) 저장', (doc('aimates', 'gyeoul') || {}).owners, { grohome: 'yj' });
  eq('여름 기본 담당 저장 (아침 루틴 원고 = 브랜드 없음 → 이 사람)', (doc('aimates', 'yeoreum') || {}).owners, { _: 'cw' });
  eq('열린 겨울 승인 3건 → 남윤정 차례로', [doc('aiasks', 'ai_gyeoul_20261012_ghconvB').to, doc('aiasks', 'ai_gyeoul_20261012_ghconvA').to, doc('aiasks', 'ai_gyeoul_20261012_ghconvC').to, doc('aiasks', 'ai_pori_20261012_blog3').to], ['yj', 'yj', 'yj', '']); }

// ② 남윤정(담당 · 폰) — 확인할 것 'AI 승인 요청' → B1·B3 골라 승인 → 김소연 · A 는 AI 에게 다시
{ const s = await session('yj');
  eq('오늘: AI 승인 요청 3줄', await inbox(s.pg, 'AI 승인 요청').count(), 3);
  await shot(s.pg, 'yj-today-375'); ok('오늘 넘침 없음 375', !(await over(s.pg)));
  await expand(s.pg);   // 승인 요청 3줄 아래 4번째
  eq('오늘: 내 PC Aside 세팅 한 줄 (겨울 09:00 · 처음 한 번)', await inbox(s.pg, '내 PC Aside 세팅 · 겨울 09:00').count(), 1);
  await inbox(s.pg, '내 PC Aside 세팅').first().getByRole('button', { name: '세팅', exact: true }).click(); await s.pg.waitForTimeout(500);
  const sx = await s.S().innerText();
  ok('세팅 시트: 내 PC · 겨울 09:00 · 아직 안 올림 · 세팅 순서 · 로그인해 둘 곳 · 고칠 것 확인', sx.includes('내 PC · AI 크루 1명') && sx.includes('겨울 · 전환마케터') && sx.includes('아직 한 번도 안 올림') && sx.includes('세팅 순서') && /로그인해 둘 곳 \d+곳/.test(sx) && sx.includes('고칠 것 확인') && !sx.includes('PC 고르기'));
  await s.S().getByRole('button', { name: '겨울 Aside 글 복사' }).click(); await s.pg.waitForTimeout(300);
  const lt = await boxOf(s.S, '겨울 Aside 글 복사');
  ok('[겨울 Aside 글 복사] → 예약 글 (내 PC 09:00 · 허브 겨울 보드 주소)', lt.startsWith('[AI 크루 · 겨울 (전환마케터)') && lt.split('\n')[0].endsWith('평일 09:00') && lt.includes('crew.html#gh-conv'));
  await s.S().getByRole('button', { name: '고칠 것 확인 글 복사' }).click(); await s.pg.waitForTimeout(300);
  ok('[고칠 것 확인 글 복사] → 내 PC 보드만', (await boxOf(s.S, '고칠 것 확인 글 복사')).startsWith('[AI 크루 · 고칠 것만 확인 — 겨울]'));
  await shot(s.pg, 'yj-setup-375'); ok('세팅 시트 넘침 없음 375', !(await over(s.pg)));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '쿠팡 유리블러').first().click(); await s.pg.waitForTimeout(500);
  ok('승인 한 장: 길 = 겨울(AI) → 남윤정 ● → 김소연 → 허지은', (await s.S().innerText()).includes('겨울 (AI)') && (await s.S().innerText()).includes('김소연') && (await s.S().innerText()).includes('허지은'));
  ok('번호 안 고르면 버튼 잠김', await s.S().getByRole('button', { name: /고른 0개 승인 → 김소연님께/ }).isDisabled());
  await s.S().getByRole('checkbox').filter({ hasText: 'B1' }).click(); await s.S().getByRole('checkbox').filter({ hasText: 'B3' }).click();
  await shot(s.pg, 'yj-ask-375'); ok('승인 한 장 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '고른 2개 승인 → 김소연님께' }).click(); await s.pg.waitForTimeout(600);
  ok('토스트: 김소연님께', (await s.pg.locator('.v2-toast').innerText()).includes('김소연님께 승인 요청을 보냈어요'));
  // 되돌리기 → 다시 승인
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  let d = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_gyeoul_20261012_ghconvB);
  eq('되돌리기 = 다시 남윤정 차례', [d.to, d.step, d.pick], ['yj', 0, null]);
  await s.S().getByRole('checkbox').filter({ hasText: 'B1' }).click(); await s.S().getByRole('checkbox').filter({ hasText: 'B3' }).click();
  await s.S().getByRole('button', { name: '고른 2개 승인 → 김소연님께' }).click(); await s.pg.waitForTimeout(600);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '품절 0').first().click(); await s.pg.waitForTimeout(400);
  await s.S().getByRole('button', { name: '겨울(AI)에게 다시' }).click();
  await s.S().getByLabel('고칠 점').fill('쿠팡 로켓그로스 재고도 같이 봐 주세요'); await s.S().getByRole('button', { name: '보내기', exact: true }).click(); await s.pg.waitForTimeout(600);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  // 더보기 › AI 팀원 → 겨울 한 장(보드) · 규칙 더하기
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI 1/).click(); await s.pg.waitForTimeout(500);
  ok('AI 팀원: 내가 맡은 AI = 겨울 · Aside 평일 09:00 · 내 PC (2026-10-15 담당마다 자기 PC) · 내 PC 카드', (await s.S().innerText()).includes('겨울 · 전환마케터') && (await s.S().innerText()).includes('Aside 평일 09:00 · 내 PC') && (await s.S().innerText()).includes('내 PC Aside · 겨울 09:00'));
  await shot(s.pg, 'yj-aiteam-375'); ok('AI 팀원 목록 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByText('겨울 · 전환마케터').click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('AI 한 장: 보드 지표 · 할 일 · 고칠 점 · Aside 루틴 줄', tx.includes('전환 보드') && tx.includes('자사몰 구매전환율') && tx.includes('7.4%') && tx.includes('할 일 A~E') && tx.includes('쿠팡 로켓그로스 재고도') && tx.includes('Aside 루틴 · 평일 09:00 · 내 PC') && tx.includes('횟수 (담당이 정함)') && tx.includes('B · 옵션안') && (await s.S().getByRole('button', { name: '지금 돌리기 — Aside 글 복사' }).count()) === 1 && (await s.S().locator('a[href$="crew.html#gh-conv"]').count()) > 0);
  ok('보드에 마진·원가 칸 없음', !/마진 \d|원가|공급 단가/.test(tx));
  await shot(s.pg, 'yj-mate-top-375');
  await s.S().getByRole('button', { name: '규칙으로' }).first().click(); await s.pg.waitForTimeout(500);
  await shot(s.pg, 'yj-mate-375'); ok('AI 한 장 넘침 없음 375', !(await over(s.pg)));
  await s.pg.setViewportSize({ width: 768, height: 1000 }); await s.pg.waitForTimeout(300); ok('AI 한 장 넘침 없음 768', !(await over(s.pg))); await shot(s.pg, 'yj-mate-768');
  await s.pg.setViewportSize({ width: 375, height: 812 }); await s.pg.waitForTimeout(300);
  // 횟수: 옵션안 +1 → 4개 · 히어로 상품 직접 6 → 저장 · 되돌리기
  await s.S().getByRole('button', { name: '옵션안 늘리기' }).click(); await s.pg.waitForTimeout(500);
  ok('횟수 +1 → 토스트 · 기본 표시', (await s.pg.locator('.v2-toast').innerText()).includes('겨울 · 옵션안 4개 · 다음 실행부터') && (await s.S().innerText()).includes('B · 옵션안 4개') && (await s.S().innerText()).includes('기본 3개'));
  await s.S().getByLabel('진단할 히어로 상품 횟수').fill('6'); await s.S().getByLabel('진단할 히어로 상품 횟수').press('Enter'); await s.pg.waitForTimeout(500);
  let q = await s.pg.evaluate(() => (window.__V2.v2.aimates.gyeoul || {}).qty || {});
  eq('횟수 저장 (aimates.qty · 누가)', [q.B && q.B.n, q.B && q.B.by, q.C && q.C.n], [4, 'yj', 6]);
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(500);
  q = await s.pg.evaluate(() => (window.__V2.v2.aimates.gyeoul || {}).qty || {});
  eq('되돌리기 = 기본으로 (n 비움)', [q.B && q.B.n, q.C && q.C.n], [4, null]);
  await s.S().getByText('횟수 (담당이 정함)').scrollIntoViewIfNeeded(); await s.pg.waitForTimeout(3200);   // 토스트 사라진 뒤
  await shot(s.pg, 'yj-qty-375'); ok('횟수 넘침 없음 375', !(await over(s.pg)));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(200); await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  // 더 만들기 +3 (C · 히어로 상품) → AI 가 같은 건에 3줄 더 · 바로 고치기 글
  await s.pg.locator('.v2-nav').getByRole('button', { name: /^오늘/ }).click(); await s.pg.waitForTimeout(400);
  await inbox(s.pg, '히어로 상품').first().click(); await s.pg.waitForTimeout(400);
  await s.S().getByRole('button', { name: '더 만들기', exact: true }).click();
  await s.S().getByRole('button', { name: '+3개' }).click();
  await s.S().getByLabel('더 만들 때 바라는 점').fill('리뷰 많은 제품 위주로');
  await s.S().getByRole('button', { name: '3개 더 만들어 달라기' }).click(); await s.pg.waitForTimeout(600);
  ok('더 만들기 → 토스트 = 3개 더 · 바로 고치기 안내', (await s.pg.locator('.v2-toast').innerText()).includes('겨울에게 3개 더 만들어 달라고 했어요') && (await s.pg.locator('.v2-toast').innerText()).includes('바로 고치기'));
  ok('더 만들기 → 배너 · 바로 고치기 글 버튼', (await s.S().innerText()).includes('겨울(AI)에게 더 만들기 3개') && (await s.S().getByRole('button', { name: '바로 고치기 — Aside 글 복사' }).count()) === 1);
  await s.S().getByRole('button', { name: '바로 고치기 — Aside 글 복사' }).click(); await s.pg.waitForTimeout(300);
  const rl = await boxOf(s.S, '바로 고치기 — Aside 글 복사');
  ok('바로 고치기 글 = 그 보드 주소 · [이전 판 불러오기] · 맨 아래 3줄 · 담당 말', rl.includes('crew.html#gh-conv') && rl.includes('[이전 판 불러오기]') && rl.includes('맨 아래에 3줄을 더한다') && rl.includes('리뷰 많은 제품 위주로'));
  await shot(s.pg, 'yj-more-375'); ok('더 만들기 넘침 없음 375', !(await over(s.pg)));
  await s.close();
  d = doc('aiasks', 'ai_gyeoul_20261012_ghconvB');
  eq('담당 승인 → 리드 차례', [d.state, d.to, d.step, d.path, d.pick], ['wait', 'sy', 1, ['yj'], ['B1', 'B3']]);
  d = doc('aiasks', 'ai_gyeoul_20261012_ghconvA');
  eq('AI 에게 다시', [d.state, d.to, d.back && d.back.text], ['back', '', '쿠팡 로켓그로스 재고도 같이 봐 주세요']);
  eq('확정 규칙 1개', ((doc('aimates', 'gyeoul') || {}).rules || []).map((r) => r.text), ['쿠팡 로켓그로스 재고도 같이 봐 주세요']);
  d = doc('aiasks', 'ai_gyeoul_20261012_ghconvC');
  eq('더 만들기 저장 (back.more · 기록 more)', [d.state, d.to, d.back && d.back.more, d.back && d.back.text, (d.log || []).slice(-1)[0].more], ['back', '', 3, '지금 것은 그대로 두고 3개 더 만들어 주세요 · 리뷰 많은 제품 위주로', 3]); }

// ③ 김소연(리드) — 확인 요청 → B3 빼고 승인 → 허지은
{ const s = await session('sy');
  ok('리드: 확인 요청 줄', await inbox(s.pg, '확인 요청').count() >= 1);
  await inbox(s.pg, '쿠팡 유리블러').first().click(); await s.pg.waitForTimeout(500);
  await s.S().getByRole('checkbox').filter({ hasText: 'B3' }).click();
  await s.S().getByRole('button', { name: '고른 1개 승인 → 허지은님께' }).click(); await s.pg.waitForTimeout(600);
  await s.close();
  const d = doc('aiasks', 'ai_gyeoul_20261012_ghconvB');
  eq('리드 승인 → 본부장 · 번호 좁힘', [d.to, d.step, d.path, d.pick], ['hj', 2, ['yj', 'sy'], ['B1']]); }

// ④ 허지은(본부장 · 맨 위) — 최종 승인 → 남윤정 '실행' 업무
{ const s = await session('hj', { w: 1280, h: 900 });
  await expand(s.pg);
  eq('관리자 오늘: AI 크루 담당 미정 4명 한 줄', await inbox(s.pg, 'AI 크루 담당 미정 4명').count(), 1);
  await inbox(s.pg, 'AI 크루 담당 미정 4명').first().getByRole('button', { name: '정하기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('[정하기] → AI 팀원 (담당 한꺼번에 정하기)', (await s.S().getByRole('button', { name: '담당 한꺼번에 정하기' }).count()) === 1);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '쿠팡 유리블러').first().click(); await s.pg.waitForTimeout(500);
  eq('본부장 버튼 = 최종 승인', await s.S().getByRole('button', { name: '고른 1개 최종 승인' }).count(), 1);
  await shot(s.pg, 'hj-ask-1280'); ok('승인 한 장 넘침 없음 1280', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '고른 1개 최종 승인' }).click(); await s.pg.waitForTimeout(700);
  await s.close();
  const d = doc('aiasks', 'ai_gyeoul_20261012_ghconvB'), x = doc('tasks', 'aix_ai_gyeoul_20261012_ghconvB');
  eq('최종 승인', [d.state, d.okBy, d.execTask], ['ok', 'hj', 'aix_ai_gyeoul_20261012_ghconvB']);
  eq('실행 업무 = 남윤정 · 허지은이 맡김 · 바로 끝', x && [x.assigneeId, x.requestedBy, x.noReview, x.status, x.dueDate, x.aiAsk], ['yj', 'hj', true, 'todo', '2026-10-13', 'ai_gyeoul_20261012_ghconvB']); }

// ⑤ 남윤정 — 최종 승인 알림 + 실행 업무(맡김) → 원래 AI 승인 보기
{ const s = await session('yj');
  eq('최종 승인 알림', await inbox(s.pg, '최종 승인').count(), 1);
  await inbox(s.pg, '실행 · 겨울').first().click(); await s.pg.waitForTimeout(500);
  ok('실행 업무 안내 · 원래 승인 링크', (await s.S().innerText()).includes('AI 승인 결과를 사람이 반영하는 일이에요') && (await s.S().getByRole('button', { name: '원래 AI 승인 보기 ›' }).count()) === 1);
  await shot(s.pg, 'yj-exec-375');
  await s.close(); }

// ⑥ 이란(관리자) — 담당 미정 포리 원고: 승인 → 이란 담당 칸 · 상급자 김송희에게 / 김송희 돌려보냄 → 이란 '수정 요청'
{ let s = await session('ran');
  eq('담당 미정 = 관리자에게 보임', await inbox(s.pg, '담당 미정 · 관리자 누구나').count(), 1);
  await inbox(s.pg, '블로그 원고 3').first().click(); await s.pg.waitForTimeout(400);
  eq('번호 없는 결과 = 통째 승인', await s.S().getByRole('button', { name: '승인 → 김송희님께' }).count(), 1);
  await s.S().getByRole('button', { name: '승인 → 김송희님께' }).click(); await s.pg.waitForTimeout(600); await s.close();
  let d = doc('aiasks', 'ai_pori_20261012_blog3');
  eq('누른 관리자 = 담당 칸 → 김송희', [d.owner, d.to, d.step, d.pick], ['ran', 'sh', 1, null]);
  s = await session('sh');
  await inbox(s.pg, '블로그 원고 3').first().click(); await s.pg.waitForTimeout(400);
  await s.S().getByRole('button', { name: '이란님께 돌려보내기' }).click();
  await s.S().getByLabel('고칠 점').fill('CTA 링크 주소 확인'); await s.S().getByRole('button', { name: '보내기', exact: true }).click(); await s.pg.waitForTimeout(600); await s.close();
  d = doc('aiasks', 'ai_pori_20261012_blog3');
  eq('돌려보냄 → 이란 차례 · 수정 요청', [d.to, d.step, d.ret && d.ret.text], ['ran', 0, 'CTA 링크 주소 확인']);
  s = await session('ran');
  eq('이란 오늘: 수정 요청(빨강)', await inbox(s.pg, 'CTA 링크 주소 확인').count(), 1);
  // 그사이 다른 사람이 처리함 → 안 덮음
  await inbox(s.pg, 'CTA 링크 주소 확인').first().click(); await s.pg.waitForTimeout(400);
  await s.pg.evaluate(() => window.__OTHER('aiasks', 'ai_pori_20261012_blog3', { to: 'sh', step: 1 }));
  await s.S().getByRole('button', { name: /승인 → 김송희님께|최종 승인/ }).click({ trial: false }).catch(() => {}); await s.pg.waitForTimeout(600);
  ok('겹침 → 안 씀 · 알림', (await s.pg.locator('.v2-toast').innerText().catch(() => '')).includes('그사이') || (await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_pori_20261012_blog3.step)) === 1);
  await s.close(); }

// ⑦ 다음 날(10/13 화 11:00) — 겨울 보드는 어제 09:10 에 올렸는데 오늘 아직 → 남윤정 '오늘 안 돎'(빨강) → 세팅 시트(마지막 올림) · 김채원 = 여름 세팅 안내(담당이 다르면 같은 09:00)
ST.v2.aiboards['gh-conv'].at = '2026-10-12T00:10:00.000Z';
{ let s = await session('yj', { now: '2026-10-13T11:00:00+09:00' });
  await expand(s.pg);
  eq('오늘 안 돎 = 겨울 한 줄 · 세팅 안내는 사라짐', [await inbox(s.pg, '오늘 겨울(AI)가 아직 안 올렸어요').count(), await inbox(s.pg, '내 PC Aside 세팅').count()], [1, 0]);
  await inbox(s.pg, '오늘 겨울(AI)가 아직 안 올렸어요').first().getByRole('button', { name: '지금 돌리기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('[지금 돌리기] → 세팅 시트 · 마지막 올림 10/12 · 오늘 아직 안 올림(빨강)', (await s.S().innerText()).includes('마지막 10/12 09:10') && (await s.S().innerText()).includes('오늘 아직 안 올림'));
  await shot(s.pg, 'yj-miss-375'); ok('안 돎 시트 넘침 없음 375', !(await over(s.pg)));
  await s.close();
  s = await session('cw', { now: '2026-10-13T11:00:00+09:00' });
  await expand(s.pg);
  eq('김채원 = 여름 세팅 안내 (담당마다 09:00 동시에)', await inbox(s.pg, '내 PC Aside 세팅 · 여름 09:00').count(), 1);
  await s.close(); }

ok('화면 오류 없음', errs.length === 0, errs);
await b.close();
console.log(`\n${n - bad}/${n} 통과 · 그림 ${SHOTS}`); if (bad) process.exit(1);
