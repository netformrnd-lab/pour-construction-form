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
import { askDoc, askFromReq } from '../../marketing-hub/crew.js';

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
  ai_gyeoul_20261012_ghconvB: ask({ id: 'ai_gyeoul_20261012_ghconvB', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'B', title: '전환 보드 B · 쿠팡 유리블러 가격·구성 재설계', sum: '가격안 3개 · 경쟁 대비 근거', cols: ['항목', '내용', '근거'], items: items3, hq: '판매가 조정', exec: '승인되면 담당이 윙에서 가격·옵션을 바꾸고 모카 카드 갱신을 요청한다' }),
  ai_gyeoul_20261012_ghconvA: ask({ id: 'ai_gyeoul_20261012_ghconvA', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'A', title: '전환 보드 A · 품절 0 만들기', cols: ['상품', '채널', '가용재고'], items: [{ n: 'A1', c: { 상품: '롤러일체형', 채널: '스마트스토어', 가용재고: '0' } }, { n: 'A2', c: { 상품: '롤러 미니', 채널: '쿠팡', 가용재고: '340' } }], exec: '승인되면 담당이 상세페이지·재입고 알림에 반영한다' }),
  ai_gyeoul_20261012_ghconvC: ask({ id: 'ai_gyeoul_20261012_ghconvC', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', title: '전환 보드 C · 히어로 상품 상세 진단', cols: ['상품', '문제', '고칠 점'], items: [{ n: 'C1', c: { 상품: '유리블러', 문제: '첫 화면에 가격 없음', '고칠 점': '가격·구성 첫 화면' } }, { n: 'C2', c: { 상품: '롤러일체형', 문제: '시공 사진 부족', '고칠 점': '전후 사진 3장' } }], exec: '승인되면 담당이 상세페이지를 고친다' }),
  ai_bom_20261012_blog3: ask({ id: 'ai_bom_20261012_blog3', mate: 'bom', brand: 'pourstore', title: '봄 · 블로그 원고 3 (균열 보수 빠데)', sum: '27칸 표준 · 구조 검사 ✓9', url: 'https://example.test/hub#team', exec: '승인되면 담당이 [임시저장 맡기기] 뒤 블로그에서 발행한다' }),
  ai_pori_20261012_old: ask({ id: 'ai_pori_20261012_old', mate: 'pori', brand: 'pourstore', title: '포리 · 예전 원고 (쉬는 AI)', url: 'https://example.test/hub#team' }),   // 2026-10-14 쉼 → '확인할 것' 아님 · AI 팀원 '쉬는 AI 승인 대기'
};
const seed = () => ({ meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks: { t1: { id: 't1', title: '추석 이벤트 배너 문구', isFixed: false, status: 'todo', assigneeId: 'yj', assigneeIds: ['yj'], projectId: '', dueDate: '2026-10-13', createdAt: T0, statusLog: [] } },
    notes: {}, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates: {}, aiboards: { 'gh-conv': { id: 'gh-conv', board: 'gh-conv', metrics: { cv_mall: { v: 7.4, date: '2026-10-12' }, cv_cp: { v: 2.4, date: '2026-10-12' }, soldout: { v: 0, date: '2026-10-12' } } } } } });
let ST = seed();
const V1D = {};   // 버전1 문서(window.__V1_DOCS) — ⑨ 반복 실행 정의

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, now = NOW } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });   // 폰 = 한국 시각 (Aside '오늘 안 돎'은 시:분을 봄)
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`try{ if(sessionStorage.__V2) window.__V2=JSON.parse(sessionStorage.__V2); }catch(e){} window.__V1_DATA={}; window.__V1_DOCS=${JSON.stringify(V1D)}; window.__V1_LAUNCH=[]; if(!window.__V2) window.__V2=${JSON.stringify(ST)};`);
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
  eq('열린 겨울 승인 3건 → 남윤정 차례로', [doc('aiasks', 'ai_gyeoul_20261012_ghconvB').to, doc('aiasks', 'ai_gyeoul_20261012_ghconvA').to, doc('aiasks', 'ai_gyeoul_20261012_ghconvC').to, doc('aiasks', 'ai_bom_20261012_blog3').to], ['yj', 'yj', 'yj', '']); }

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
  ok('AI 한 장: 보드 지표 · 할 일 · 고칠 점 · Aside 루틴 줄', tx.includes('전환 보드') && tx.includes('자사몰 구매전환율') && tx.includes('7.4%') && tx.includes('할 일 A~F') && tx.includes('쿠팡 로켓그로스 재고도') && tx.includes('Aside 루틴 · 평일 09:00 · 내 PC') && tx.includes('횟수 (담당이 정함)') && tx.includes('B · 옵션안') && (await s.S().getByRole('button', { name: '지금 돌리기 — Aside 글 복사' }).count()) === 1 && (await s.S().locator('a[href$="crew.html#gh-conv"]').count()) > 0);
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

// ⑤ 남윤정 — 최종 승인 알림 + 실행 업무(맡김) → 흔적 남기기(승인 번호 B1 · 2026-10-15) → 끝냈어요
{ const s = await session('yj');
  eq('최종 승인 알림', await inbox(s.pg, '최종 승인').count(), 1);
  await inbox(s.pg, '실행 · 겨울').first().click(); await s.pg.waitForTimeout(500);
  const tx = await s.S().innerText();
  ok('실행 업무: 흔적 남기기 · 승인 번호 B1 한 줄(AI 가 채움) · AI 승인 보기', tx.includes('흔적 남기기') && tx.includes('1개 중 0개 남김') && tx.includes('1+1 옵션 · 19,900원') && !tx.includes('B3') && (await s.S().getByRole('button', { name: 'AI 승인 보기 ›' }).count()) === 1);
  ok('흔적 전 = 끝내기 잠김', await s.pg.getByRole('button', { name: '흔적을 남기면 끝낼 수 있어요 · 1개 남음' }).isDisabled());
  await shot(s.pg, 'yj-exec-375'); ok('실행 업무 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: 'B1 안 함' }).click(); await s.S().getByRole('button', { name: 'B1 안 함 남기기' }).click(); await s.pg.waitForTimeout(400);
  ok('안 함은 이유가 있어야', (await s.pg.locator('.v2-toast').innerText()).includes('안 한 이유'));
  await s.S().getByRole('button', { name: '취소', exact: true }).click();
  await s.S().getByLabel('B1 링크').fill('https://wing.coupang.com/vendor/items/123');
  await s.S().getByRole('button', { name: 'B1 했어요' }).click(); await s.pg.waitForTimeout(600);
  ok('[했어요] → 토스트 · 다 남김', (await s.pg.locator('.v2-toast').innerText()).includes('흔적을 남겼어요') && (await s.S().innerText()).includes('다 남김 · 했어요 1개'));
  let w = await s.pg.evaluate(() => [window.__V2.v2.tasks.aix_ai_gyeoul_20261012_ghconvB, window.__V2.v2.aiasks.ai_gyeoul_20261012_ghconvB]);
  eq('흔적 저장 = 실행 업무 + 승인 건', [w[0].aiTrace.B1.done, w[0].aiTrace.B1.link, w[0].aiTrace.B1.by, w[1].trace.B1.link], [true, 'https://wing.coupang.com/vendor/items/123', 'yj', 'https://wing.coupang.com/vendor/items/123']);
  await s.pg.getByRole('button', { name: '끝냈어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  w = await s.pg.evaluate(() => window.__V2.v2.tasks.aix_ai_gyeoul_20261012_ghconvB);
  eq('흔적 다 남김 → 끝냄', w.status, 'done');
  await s.close(); }

// ⑥ 이란(관리자) — 담당 미정 봄 원고: 승인 → 이란 담당 칸 · 상급자 김송희에게 / 김송희 돌려보냄 → 이란 '수정 요청'
{ let s = await session('ran');
  eq('담당 미정 = 관리자에게 보임 (쉬는 AI 포리 것은 안 뜸)', [await inbox(s.pg, '담당 미정 · 관리자 누구나').count(), await inbox(s.pg, '예전 원고').count()], [1, 0]);
  await inbox(s.pg, '블로그 원고 3').first().click(); await s.pg.waitForTimeout(400);
  eq('번호 없는 결과 = 통째 승인', await s.S().getByRole('button', { name: '승인 → 김송희님께' }).count(), 1);
  await s.S().getByRole('button', { name: '승인 → 김송희님께' }).click(); await s.pg.waitForTimeout(600); await s.close();
  let d = doc('aiasks', 'ai_bom_20261012_blog3');
  eq('누른 관리자 = 담당 칸 → 김송희', [d.owner, d.to, d.step, d.pick], ['ran', 'sh', 1, null]);
  s = await session('sh');
  await inbox(s.pg, '블로그 원고 3').first().click(); await s.pg.waitForTimeout(400);
  await s.S().getByRole('button', { name: '이란님께 돌려보내기' }).click();
  await s.S().getByLabel('고칠 점').fill('CTA 링크 주소 확인'); await s.S().getByRole('button', { name: '보내기', exact: true }).click(); await s.pg.waitForTimeout(600); await s.close();
  d = doc('aiasks', 'ai_bom_20261012_blog3');
  eq('돌려보냄 → 이란 차례 · 수정 요청', [d.to, d.step, d.ret && d.ret.text], ['ran', 0, 'CTA 링크 주소 확인']);
  s = await session('ran');
  eq('이란 오늘: 수정 요청(빨강)', await inbox(s.pg, 'CTA 링크 주소 확인').count(), 1);
  // 그사이 다른 사람이 처리함 → 안 덮음
  await inbox(s.pg, 'CTA 링크 주소 확인').first().click(); await s.pg.waitForTimeout(400);
  await s.pg.evaluate(() => window.__OTHER('aiasks', 'ai_bom_20261012_blog3', { to: 'sh', step: 1 }));
  await s.S().getByRole('button', { name: /승인 → 김송희님께|최종 승인/ }).click({ trial: false }).catch(() => {}); await s.pg.waitForTimeout(600);
  ok('겹침 → 안 씀 · 알림', (await s.pg.locator('.v2-toast').innerText().catch(() => '')).includes('그사이') || (await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_bom_20261012_blog3.step)) === 1);
  await s.close(); }

// ⑥-2 쉬는 AI(포리) 담당 미정 승인 — '확인할 것'엔 없고 · 더보기 › AI 팀원 '쉬는 AI 승인 대기' → [모두 '안 함'으로 정리] (2026-10-15 페르소나 시험)
{ const s = await session('ran');
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  ok('더보기 AI 팀원: 쉬는 AI 담당 미정은 승인 차례로 안 셈', !(await s.pg.locator('.v2-page').innerText()).includes('승인 차례'));
  await s.pg.locator('.v2-page [role=button]').filter({ hasText: '크루(브랜드·고객별)' }).first().click(); await s.pg.waitForTimeout(500);
  ok('AI 팀원: 쉬는 AI 승인 대기 1건 · 포리 · 예전 원고', (await s.S().innerText()).includes('쉬는 AI 승인 대기 1건') && (await s.S().getByText('포리 · 예전 원고 (쉬는 AI)').count()) === 1);
  await shot(s.pg, 'ran-gone-375');
  await s.S().getByRole('button', { name: /모두 '안 함'으로 정리/ }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByRole('alertdialog').getByRole('button', { name: '정리', exact: true }).click(); await s.pg.waitForTimeout(800);
  const d = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_pori_20261012_old);
  eq('정리 → 안 함 · 이유 · 누른 관리자 기록', [d.state, /쉬는 AI/.test(d.noReason || ''), d.noBy], ['no', true, 'ran']);
  ok('정리 뒤 카드 사라짐', (await s.S().getByText('쉬는 AI 승인 대기').count()) === 0);
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

// ⑧ AI에게 업무 맡기기 (2026-10-15 사장님 "ai팀원에게 업무요청을 별도로해서 진행도 가능했으면") — 김채원(폰) → 겨울에게 → 취소 · 다시 맡김 → Aside 결과 → 맡긴 사람 '맡긴 일 결과' · 담당(남윤정) 승인 줄
{ let s = await session('cw', { now: '2026-10-13T11:00:00+09:00' });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI 1/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('AI에게 업무 맡기기').click(); await s.pg.waitForTimeout(500);
  ok('맡기기 시트: AI 6명 · 버튼 잠김(아직 안 고름)', (await s.S().getByText('겨울 · 전환마케터').count()) > 0 && (await s.S().getByText('봄 · 오늘의집 MD').count()) > 0 && await s.pg.getByRole('button', { name: 'AI 팀원을 골라 주세요' }).isDisabled());
  await s.S().getByText('겨울 · 전환마케터').click(); await s.S().getByText('상품 상세 이탈 진단 1건').click();
  await s.S().getByText('표', { exact: true }).click(); await s.S().getByText('3개', { exact: true }).click(); await s.S().getByText('내일', { exact: true }).click();
  await s.S().getByLabel('자세히').fill('쿠팡 유리블러 상세 · 리뷰가 맨 끝이라 이탈');
  await shot(s.pg, 'cw-req-375'); ok('맡기기 시트 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '겨울(AI)에게 맡기기' }).click(); await s.pg.waitForTimeout(600);
  let rq = Object.values(await s.pg.evaluate(() => window.__V2.v2.aireqs || {}));
  eq('맡긴 일 저장: 겨울 · 전환 보드 · 표 3개 · 내일 · 대기 · 맡긴 사람', rq.map((r) => [r.mate, r.board, r.title, r.shape, r.n, r.due, r.state, r.by]), [['gyeoul', 'gh-conv', '상품 상세 이탈 진단 1건', '표', 3, '2026-10-14', 'open', 'cw']]);
  ok('맡긴 뒤: 지금 바로 글 · 하나 더', (await s.S().innerText()).includes('겨울(AI)에게 맡겼어요') && (await s.S().getByRole('button', { name: '하나 더 맡기기' }).count()) === 1);
  await s.S().getByRole('button', { name: '지금 바로 — Aside 글 복사' }).click(); await s.pg.waitForTimeout(300);
  ok('[지금 바로] 글 = 겨울 보드 주소 · [이 일 하기]', (await boxOf(s.S, '지금 바로 — Aside 글 복사')).startsWith('[AI 크루 · 겨울 · 맡긴 일 바로 하기]') && (await boxOf(s.S, '지금 바로 — Aside 글 복사')).includes('crew.html#gh-conv'));
  await shot(s.pg, 'cw-req-sent-375');
  ok('내가 맡긴 일: 대기 · 겨울(AI)', (await s.S().innerText()).includes('대기') && (await s.S().innerText()).includes('겨울(AI)'));
  await s.S().getByRole('button', { name: '맡긴 일 취소 상품 상세 이탈 진단 1건' }).click(); await s.pg.waitForTimeout(500);
  eq('취소 = cancel', Object.values(await s.pg.evaluate(() => window.__V2.v2.aireqs)).map((r) => r.state), ['cancel']);
  await s.S().getByRole('button', { name: '하나 더 맡기기' }).click(); await s.pg.waitForTimeout(300);
  await s.S().getByText('겨울 · 전환마케터').click(); await s.S().getByLabel('무엇을').fill('리뷰 불만 유형 정리');
  await s.pg.getByRole('button', { name: '겨울(AI)에게 맡기기' }).click(); await s.pg.waitForTimeout(600);
  await s.close(); }
// Aside 가 crew.html 에서 [이 일 하기] → [R] 결과 → 승인 한 건 + 맡긴 일 done (허브 쪽 쓰기를 같은 모양으로)
{ const r = Object.values(ST.v2.aireqs).find((x) => x.state === 'open'), at = '2026-10-13T02:30:00.000Z';
  const a = askFromReq(r, { sum: '불만 4유형', cols: ['유형', '건수'], items: [{ n: 'R1', c: { 유형: '냄새', 건수: '12' } }] }, { run: '2026-10-13', at, owner: 'yj' });
  ST.v2.aiasks[a.id] = a; Object.assign(ST.v2.aireqs[r.id], { state: 'done', askId: a.id, doneAt: at, updatedAt: at });
  let s = await session('cw', { now: '2026-10-13T11:40:00+09:00' });
  await expand(s.pg);
  eq('맡긴 사람(김채원) = 맡긴 일 결과 한 줄', await inbox(s.pg, '맡긴 일 · 리뷰 불만 유형 정리').count(), 1);
  await inbox(s.pg, '맡긴 일 · 리뷰 불만 유형 정리').first().click(); await s.pg.waitForTimeout(500);
  ok('누르면 그 승인 한 장 (남윤정 차례)', (await s.S().innerText()).includes('리뷰 불만 유형 정리') && (await s.S().innerText()).includes('남윤정'));
  await s.close();
  s = await session('yj', { now: '2026-10-13T11:40:00+09:00' });
  await expand(s.pg);
  eq('담당(남윤정) = AI 승인 요청 줄', await inbox(s.pg, '맡긴 일 · 리뷰 불만 유형 정리').count(), 1);
  await s.close(); }

// ⑨ (2026-10-15 사장님) 최종 승인 = 리드 · 본부장 승인 = 광고비 예산·원가·판매가 조정만 · 할 일 담당(재고·주문 = 윤미니 / 상세 = 김민지 같은) · 흔적 → 반복 실행 +1(KPI)
//   허지은 = 겨울 E 담당 김민지 · 반복 실행 짝 → 남윤정 C 승인 → 김민지 E 승인 → 김송희(리드) E 최종 → 김소연(리드) C [본부장에게도 올리기] → 허지은 C 최종 → 김민지 흔적(E1 했어요 +1 · E2 안 함) → 끝냄
V1D['state-actionKPIs'] = { items: [{ id: 'x_rv', name: '리뷰 신고·답글', cyc: 'W', goal: 10, unit: '건', who: [], active: true, startDate: '2026-09-28' }] };
const NOW9 = '2026-10-14T10:00:00+09:00';
ST.v2.aiasks.ai_gyeoul_20261014_ghconvE = ask({ id: 'ai_gyeoul_20261014_ghconvE', run: '2026-10-14', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'E', owner: 'yj', title: '전환 보드 E · 리뷰 정리', cols: ['채널', '리뷰', '링크'], items: [{ n: 'E1', c: { 채널: '쿠팡', 리뷰: '같은 문장 3건', 링크: 'https://www.coupang.com/vp/products/1' } }, { n: 'E2', c: { 채널: '네이버', 리뷰: '1점 답글', 링크: 'https://smartstore.naver.com/x/products/2' } }], exec: '승인되면 담당이 리뷰 신고·답글을 단다' });
ST.v2.aiasks.ai_gyeoul_20261014_ghconvC = ask({ id: 'ai_gyeoul_20261014_ghconvC', run: '2026-10-14', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', owner: 'yj', title: '전환 보드 C · 상세 첫 화면', cols: ['상품', '고칠 점'], items: [{ n: 'C1', c: { 상품: '유리블러', '고칠 점': '첫 화면에 가격' } }], exec: '승인되면 담당이 상세페이지를 고친다' });
{ let s = await session('hj', { now: NOW9 });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^크루\(브랜드·고객별\) · 담당 → 리드 승인/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('겨울 · 전환마케터').click(); await s.pg.waitForTimeout(600);
  await s.S().getByText('E · 리뷰 정리 + 진짜 포토리뷰 확보', { exact: true }).click(); await s.pg.waitForTimeout(300);
  await s.S().getByLabel('E 할 일 담당').selectOption('mj'); await s.pg.waitForTimeout(600);
  ok('할 일 담당 → 토스트 · 열린 승인 1건 넘김', (await s.pg.locator('.v2-toast').innerText()).includes('E 담당 남윤정(AI 담당) → 김민지 · 열린 승인 1건 넘김'));
  await s.S().getByLabel('E 반복 실행 짝').selectOption('x_rv'); await s.pg.waitForTimeout(600);
  ok('반복 실행 짝 → 토스트', (await s.pg.locator('.v2-toast').innerText()).includes("E 반복 실행 짝 리뷰 신고·답글"));
  const tx = await s.S().innerText();
  ok('할 일 줄: E 담당 김민지 · 반복 · B 본부장 승인(판매가) · C 리드에서 끝', tx.includes("담당 김민지 · 매일 11:00 · 반복 '리뷰 신고·답글'") && tx.includes('담당 남윤정 · 본부장 승인(판매가 조정)') && tx.includes('담당 남윤정 · 히어로 4종 순서대로'));
  await s.S().getByText('B · 쿠팡 유리블러 가격·구성 재설계', { exact: true }).click(); await s.pg.waitForTimeout(300);
  ok('B 본부장 승인 기본 = 받음 · 판매가 조정', (await s.S().getByLabel('B 본부장 승인').locator('option').first().innerText()).includes('받음 · 판매가 조정'));
  await shot(s.pg, 'hj-actset-375'); ok('할 일 설정 넘침 없음 375', !(await over(s.pg)));
  await s.close();
  const m = doc('aimates', 'gyeoul');
  eq('할 일 담당 · 반복 실행 짝 저장 (aimates · 기록)', [m.actOwners, m.actAk, (m.hist || []).length >= 2], [{ E: 'mj' }, { E: 'x_rv' }, true]);
  eq('열린 E 승인 → 김민지 · C 는 그대로 남윤정', [doc('aiasks', 'ai_gyeoul_20261014_ghconvE').to, doc('aiasks', 'ai_gyeoul_20261014_ghconvE').owner, doc('aiasks', 'ai_gyeoul_20261014_ghconvC').to], ['mj', 'mj', 'yj']); }
{ let s = await session('yj', { now: NOW9 });
  await expand(s.pg);
  eq('남윤정: E 는 안 보임(김민지 담당) · C 는 보임', [await inbox(s.pg, '리뷰 정리').count(), await inbox(s.pg, '상세 첫 화면').count()], [0, 1]);
  await inbox(s.pg, '상세 첫 화면').first().click(); await s.pg.waitForTimeout(500);
  ok('C 길 = 남윤정 → 김소연 (리드에서 끝)', (await s.S().innerText()).includes('김소연') && !(await s.S().innerText()).includes('허지은'));
  await s.S().getByRole('checkbox').filter({ hasText: 'C1' }).click();
  await s.S().getByRole('button', { name: '고른 1개 승인 → 김소연님께' }).click(); await s.pg.waitForTimeout(600);
  await s.close(); }
{ let s = await session('mj', { now: NOW9 });
  await expand(s.pg);
  eq('김민지: E 승인 요청', await inbox(s.pg, '리뷰 정리').count(), 1);
  await inbox(s.pg, '리뷰 정리').first().click(); await s.pg.waitForTimeout(500);
  const tx = await s.S().innerText();
  ok('E 길 = 김민지 ● → 김송희 (본부장 없음) · 본부장 표시 없음', tx.includes('김민지') && tx.includes('김송희') && !tx.includes('허지은') && !tx.includes('본부장 승인 ·'));
  await s.S().getByRole('checkbox').filter({ hasText: 'E1' }).click(); await s.S().getByRole('checkbox').filter({ hasText: 'E2' }).click();
  await s.S().getByRole('button', { name: '고른 2개 승인 → 김송희님께' }).click(); await s.pg.waitForTimeout(600);
  await s.close(); }
{ let s = await session('sh', { now: NOW9, w: 768, h: 1000 });
  await expand(s.pg);
  await inbox(s.pg, '리뷰 정리').first().click(); await s.pg.waitForTimeout(500);
  ok('리드(김송희) = 최종 승인 · [본부장에게도 올리기] 보임', (await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).count()) === 1 && (await s.S().getByRole('button', { name: '본부장에게도 올리기' }).count()) === 1 && (await s.S().innerText()).includes('리드에서 끝나는 일이에요'));
  await shot(s.pg, 'sh-leadfinal-768'); ok('리드 최종 넘침 없음 768', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).click(); await s.pg.waitForTimeout(700);
  ok('토스트: 김민지님께 실행 업무', (await s.pg.locator('.v2-toast').innerText()).includes("김민지님께 '실행' 업무가 생겼어요"));
  await s.close();
  const d = doc('aiasks', 'ai_gyeoul_20261014_ghconvE'), x = doc('tasks', 'aix_ai_gyeoul_20261014_ghconvE');
  eq('리드 최종 승인 (본부장 안 감)', [d.state, d.okBy, d.path], ['ok', 'sh', ['mj', 'sh']]);
  eq('실행 업무 = 할 일 담당(김민지) · 번호마다 한 줄·링크 · 반복 짝', x && [x.assigneeId, x.aiAk, x.aiItems.map((y) => [y.n, y.link])], ['mj', 'x_rv', [['E1', 'https://www.coupang.com/vp/products/1'], ['E2', 'https://smartstore.naver.com/x/products/2']]]); }
{ let s = await session('sy', { now: NOW9 });
  await inbox(s.pg, '상세 첫 화면').first().click(); await s.pg.waitForTimeout(500);
  eq('리드(김소연) C = 최종 승인 버튼', await s.S().getByRole('button', { name: '고른 1개 최종 승인' }).count(), 1);
  await s.S().getByRole('button', { name: '본부장에게도 올리기' }).click(); await s.pg.waitForTimeout(600);
  ok('토스트: 허지은님께', (await s.pg.locator('.v2-toast').innerText()).includes('허지은님께 승인 요청을 보냈어요'));
  await s.close();
  const d = doc('aiasks', 'ai_gyeoul_20261014_ghconvC');
  eq('본부장에게도 올리기 = 허지은 차례 · 누가 올렸나', [d.state, d.to, d.step, d.hqUp && d.hqUp.by], ['wait', 'hj', 2, 'sy']); }
{ let s = await session('hj', { now: NOW9, w: 1280, h: 900 });
  await expand(s.pg);
  await inbox(s.pg, '상세 첫 화면').first().click(); await s.pg.waitForTimeout(500);
  ok('본부장: 본부장 확인 요청 표시 · 최종 승인', (await s.S().innerText()).includes('본부장 승인 · 본부장 확인 요청') && (await s.S().getByRole('button', { name: '고른 1개 최종 승인' }).count()) === 1);
  await s.S().getByRole('button', { name: '고른 1개 최종 승인' }).click(); await s.pg.waitForTimeout(600);
  await s.close();
  eq('본부장 최종 → 남윤정 실행 업무', [doc('aiasks', 'ai_gyeoul_20261014_ghconvC').state, (doc('tasks', 'aix_ai_gyeoul_20261014_ghconvC') || {}).assigneeId], ['ok', 'yj']); }
{ let s = await session('mj', { now: NOW9 });
  await inbox(s.pg, '실행 · 겨울').first().click(); await s.pg.waitForTimeout(500);
  ok('흔적 상자: 2개 · 짝지은 반복 실행에도 +1 안내 · AI 링크 채워짐', (await s.S().innerText()).includes('2개 중 0개 남김') && (await s.S().innerText()).includes('짝지은 반복 실행에도 +1') && (await s.S().getByLabel('E1 링크').inputValue()) === 'https://www.coupang.com/vp/products/1');
  await s.S().getByRole('button', { name: 'E1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok("E1 했어요 → 반복 '리뷰 신고·답글' +1", (await s.pg.locator('.v2-toast').innerText()).includes("반복 '리뷰 신고·답글' +1"));
  await s.S().getByRole('button', { name: 'E2 안 함' }).click(); await s.S().getByLabel('E2 안 한 이유').fill('판매자 답글 권한 없음'); await s.S().getByRole('button', { name: 'E2 안 함 남기기' }).click(); await s.pg.waitForTimeout(600);
  let k = await s.pg.evaluate(() => [window.__V2.v2.kpiact['2026-Q4'], window.__V2.v2.checks['ak~x_rv~mj~2026-10-14']]);
  eq('반복 실행 +1 = 이번 주 · 흔적(승인 id · 번호 · 링크) 같이 · 그날 기록', [k[0].w['2026-10-12'].x_rv.n, k[0].log.slice(-1)[0].ai, k[1].runs, k[1].recs.slice(-1)[0].ai.n], [1, { ask: 'ai_gyeoul_20261014_ghconvE', n: 'E1', link: 'https://www.coupang.com/vp/products/1' }, 1, 'E1']);
  await s.S().getByRole('button', { name: 'E1 되돌리기' }).click(); await s.pg.waitForTimeout(700);
  k = await s.pg.evaluate(() => window.__V2.v2.kpiact['2026-Q4'].w['2026-10-12'].x_rv.n);
  eq('되돌리기 → 반복 실행 −1', k, 0);
  await s.S().getByRole('button', { name: 'E1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('다 남김 · 했어요 1개', (await s.S().innerText()).includes('다 남김 · 했어요 1개'));
  await shot(s.pg, 'mj-trace-375'); ok('흔적 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '끝냈어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  const t = await s.pg.evaluate(() => window.__V2.v2.tasks.aix_ai_gyeoul_20261014_ghconvE);
  eq('흔적: E1 했어요 · E2 안 함(이유) · 끝냄', [t.aiTrace.E1.done, t.aiTrace.E2.skip, t.aiTrace.E2.note, t.status], [true, true, '판매자 답글 권한 없음', 'done']);
  await s.close(); }

// ⑩ AI 크루 보고 (2026-10-15 사장님 "본부장은 리드에게 매주 금요일 보고받음 · 크루 칸별 · 실행 · 결과(유입·전환) · 다음(AI 피드백 + 사람)" · "한동안 주간 → 점차 1개월")
//   금 10/16: 남윤정(겨울 담당) 칸 쓰기 → 김소연(리드) 본부장에게 보내기(되돌리기 한 번) → 허지은(본부장) 읽었어요 · 주기 월간 ↔ 주간
Object.assign(ST.v2.aiboards['gh-conv'], { hist: { cv_mall: { '2026-10-09': 6.1, '2026-10-15': 7.4 } }, nextHist: { '2026-10-16': '- 롤러 재입고 알림 켜기\n- 상세 첫 화면 시안 2개' }, next: { text: '- 롤러 재입고 알림 켜기\n- 상세 첫 화면 시안 2개', run: '2026-10-16' } });
const FRI = '2026-10-16T10:00:00+09:00', RID = 'b2c-2026-10-12';
{ let s = await session('yj', { now: FRI });
  await expand(s.pg);
  eq('금요일: 남윤정 = 겨울 칸 쓰기 줄', await inbox(s.pg, '겨울 칸 쓰기 · B2C 크루').count(), 1);
  await inbox(s.pg, '겨울 칸 쓰기 · B2C 크루').first().getByRole('button', { name: '쓰기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('보고서: 이번 주 · 다음 할 일 = 내 칸 겨울 · 칸 6개', tx.includes('이번 주') && tx.includes('10/12~10/18') && tx.includes('내 칸 겨울') && tx.includes('크루 칸 6'));
  ok('겨울 칸: 실행 2 · 남음 1 · 흔적 2 · 안 함 1 · 전환 7.4% ← 6.1% · KPI +1 · AI 다음', tx.includes('실행 업무 끝냄 2 · 남음 1 · 흔적 2 · 안 함 1') && tx.includes('7.4% ← 6.1% · 목표 7% ✓') && tx.includes("반복 '리뷰 신고·답글' +1") && tx.includes('롤러 재입고 알림 켜기'), tx.slice(0, 900));
  ok('다른 칸은 접힘 · 담당 미정 · 한 줄 요약', tx.includes('채널 · 봄(AI)') && tx.includes('담당 미정'));
  await s.S().getByLabel('겨울 한 줄').fill('전환 7.4% — 상세 첫 화면 가격 노출 효과');
  await s.S().getByLabel('겨울 다음 계획').fill('- 리뷰 이벤트 기획');
  await shot(s.pg, 'yj-report-375'); ok('보고서 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '겨울 다 썼어요' }).click(); await s.pg.waitForTimeout(600);
  ok('다 썼어요 → 토스트 = 김소연님이 보냄', (await s.pg.locator('.v2-toast').innerText()).includes('겨울 칸 다 썼어요 · 김소연님이 본부장에게 보내요'));
  ok('카드 그대로 펼침 · 다 썼어요 ✓ · 다시 고치기', (await s.S().innerText()).includes('다 썼어요 ✓ 남윤정') && (await s.S().getByRole('button', { name: '다시 고치기' }).count()) === 1);
  await s.close();
  const r = doc('aireports', RID);
  eq('보고서 저장: 주간 · 기간 · 겨울 칸 글 · 담당 확인', r && [r.crew, r.cycle, r.start, r.end, r.due, r.secs.gyeoul.note, r.secs.gyeoul.plan, r.secs.gyeoul.done.by], ['b2c', 'week', '2026-10-12', '2026-10-18', '2026-10-16', '전환 7.4% — 상세 첫 화면 가격 노출 효과', '- 리뷰 이벤트 기획', 'yj']); }
{ let s = await session('mj', { now: FRI });
  await expand(s.pg);
  eq('김민지(같이 쓰는 사람) = 겨울 칸은 다 써서 줄 없음', await inbox(s.pg, '겨울 칸 쓰기').count(), 0);
  await s.close(); }
{ let s = await session('sy', { now: '2026-10-16T15:00:00+09:00' });
  await expand(s.pg);
  eq('리드(김소연) = 1칸 보내기 줄', await inbox(s.pg, 'B2C 크루 1칸 → 본부장에게 보내기').count(), 1);
  await inbox(s.pg, 'B2C 크루 1칸 → 본부장에게 보내기').first().getByRole('button', { name: '보내기', exact: true }).click(); await s.pg.waitForTimeout(600);
  ok('다음 할 일 = 다 모였어요 · 보내기', (await s.S().innerText()).includes('담당 확인 1/1칸 · 다 모였어요'));
  await s.pg.getByLabel('리드 한마디').fill('가격 실험 결과는 다음 주에 결정');
  await shot(s.pg, 'sy-report-375'); ok('리드 보고서 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '본부장에게 보내기 · 1칸' }).click(); await s.pg.waitForTimeout(600);
  ok('보냄 → 토스트', (await s.pg.locator('.v2-toast').innerText()).includes('본부장에게 보냈어요 · 1칸 (겨울)'));
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  eq('되돌리기 = 다시 담당 확인', await s.pg.evaluate(() => window.__V2.v2.aireports['b2c-2026-10-12'].secs.gyeoul.sent), null);
  await s.pg.getByRole('button', { name: '본부장에게 보내기 · 1칸' }).click(); await s.pg.waitForTimeout(600);
  ok('보낸 칸 = 본부장에게 보냄 ✓ · 한 줄', (await s.S().innerText()).includes('본부장에게 보냄 ✓ 김소연') && (await s.S().innerText()).includes('한 줄: 전환 7.4%'));
  await s.close();
  const r = doc('aireports', RID);
  eq('보냄 저장: 누가 · 얼린 숫자 · 리드 한마디', [r.secs.gyeoul.sent.by, r.secs.gyeoul.snap.doneN, r.secs.gyeoul.snap.trace.done, r.secs.gyeoul.snap.note, r.secs.gyeoul.snap.plan, r.leads.sy.note], ['sy', 2, 2, '전환 7.4% — 상세 첫 화면 가격 노출 효과', '- 리뷰 이벤트 기획', '가격 실험 결과는 다음 주에 결정']); }
{ let s = await session('hj', { now: '2026-10-16T16:00:00+09:00', w: 1280, h: 900 });
  await expand(s.pg);
  eq('본부장 = 보고 도착 줄', await inbox(s.pg, 'B2C 크루 주간 보고 · 1/6칸').count(), 1);
  await inbox(s.pg, 'B2C 크루 주간 보고 · 1/6칸').first().getByRole('button', { name: '읽기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('본부장 보고서: 보낸 겨울 칸 펼침 · 리드 한마디 · 읽었어요', tx.includes('본부장에게 보냄 ✓ 김소연') && tx.includes('7.4% ← 6.1%') && tx.includes('리드 한마디') && tx.includes('가격 실험 결과는 다음 주에 결정') && (await s.pg.getByRole('button', { name: '읽었어요', exact: true }).count()) === 1);
  await s.S().getByRole('button', { name: '보고 글로 복사' }).click(); await s.pg.waitForTimeout(300);
  const g = await boxOf(s.S, '보고 글로 복사');
  ok('보고 글: 머리 · 겨울 칸 · 결과 · 다음 · 리드 한마디', g.startsWith('[AI 크루 주간 보고] B2C 크루 · 10/12~10/18') && g.includes('■ 전환 · 겨울(AI)') && g.includes('- 결과 자사몰 구매전환율: 7.4% ← 6.1%') && g.includes('리뷰 이벤트 기획') && g.includes('리드 한마디 (김소연)'), g.slice(0, 400));
  await shot(s.pg, 'hj-report-1280'); ok('본부장 보고서 넘침 없음 1280', !(await over(s.pg)));
  await s.pg.getByLabel('본부장 한마디').fill('좋아요 · 리뷰 이벤트 진행');
  await s.pg.getByRole('button', { name: '읽었어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  // 주기: 관리자(허지은) 월간 → 다시 주간
  await s.S().getByRole('tab', { name: '월간', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('주기 월간 → 토스트', (await s.pg.locator('.v2-toast').innerText()).includes('AI 크루 보고 = 월간'));
  const cyc = await s.pg.evaluate(() => window.__V2.v2.settings.aicrew.reportCycle);
  eq('주기 저장 = 월간 · 바꾼 주 월요일 · 누가', [cyc.cycle, cyc.from, cyc.by], ['month', '2026-10-12', 'hj']);
  await s.S().getByRole('tab', { name: '주간', exact: true }).click(); await s.pg.waitForTimeout(500);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await expand(s.pg);
  eq('읽은 뒤 = 보고 도착 줄 사라짐', await inbox(s.pg, 'B2C 크루 주간 보고').count(), 0);
  await s.close();
  const r = doc('aireports', RID);
  eq('읽음 저장 · 주기 다시 주간', [r.read.by, r.read.note, doc('settings', 'aicrew').reportCycle.cycle], ['hj', '좋아요 · 리뷰 이벤트 진행', 'week']); }
{ let s = await session('cw', { now: FRI, w: 375 });
  await expand(s.pg);
  eq('김채원(여름 담당 · 리드 본인) = 여름 칸 쓰기 + 보내기', [await inbox(s.pg, '여름 칸 쓰기').count(), await inbox(s.pg, 'B2C 크루 1칸 → 본부장에게 보내기').count()], [1, 1]);
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText('크루 칸별 · 실행 · 결과 · 다음 계획 · 금요일 리드 → 본부장').click(); await s.pg.waitForTimeout(500);
  ok('더보기 › 성과 › AI 크루 보고 = 같은 화면', (await s.S().innerText()).includes('내 칸 여름'));
  await s.close(); }

// ⑪ 구글 디맨드젠 (2026-10-15 사장님 "디멘드젠광고 세팅해서 게시까지 · 내일부터 · 외주 상관없어") — 여름 F · 상품마다 승인 한 건 · 새 예산 없으면 리드(김송희)에서 끝
//   → 김송희 실행 업무: [했어요] = 신제품 '스티커 프라이머 · 디맨드젠 광고 (n/5)' +1 · 되돌리기 −1 · 예산을 적은 건(타일카펫)은 본부장까지
ST.v2.projects.lb_sp = { id: 'lb_sp', title: '스티커 프라이머', brand: 'grohome', category: 'launch', launchDate: '2026-10-16', status: 'active', assigneeId: 'sh', createdAt: T0 };
ST.v2.tasks['lb_sp__x_dg'] = { id: 'lb_sp__x_dg', title: '디맨드젠 광고 (0/5)', launchItem: 'x_dg', projectId: 'lb_sp', brand: 'grohome', isFixed: false, status: 'todo', assigneeId: 'sh', assigneeIds: ['sh'], dueDate: '2026-10-23', phase: 'promo', noReview: true, createdAt: T0, statusLog: [] };
const dgItems = (prod, url) => [1, 2].map((i) => ({ n: `F${i}`, c: { 상품: prod, 광고: String(i), 제목: `칠하고 질리면 떼세요 ${i}`, 설명: '월세집도 원상복구', '최종 URL': url, ...(prod === '타일카펫' && i === 1 ? { 예산: '일 3만' } : {}), '초안 링크': `https://ads.google.com/aw/campaigns/draft?c=${prod === '타일카펫' ? 2 : 1}&ad=${i}` } }));
ST.v2.aiasks.ai_yeoreum_20261016_ghexpF_스티커프라이머 = ask({ id: 'ai_yeoreum_20261016_ghexpF_스티커프라이머', run: '2026-10-16', mate: 'yeoreum', brand: 'grohome', board: 'gh-exp', act: 'F', owner: 'sh', title: 'AI 노출 보드 F · 스티커 프라이머 · 구글 디맨드젠 광고', sum: '디맨드젠 초안 2개', cols: ['상품', '광고', '제목', '설명', '최종 URL', '초안 링크'], items: dgItems('스티커 프라이머', 'https://grohome.co.kr/p/1'), exec: '승인되면 담당이 구글 애즈에서 초안을 확인하고 [게시]한다', launch: 'x_dg', prod: '스티커 프라이머' });
ST.v2.aiasks.ai_yeoreum_20261016_ghexpF_타일카펫 = ask({ id: 'ai_yeoreum_20261016_ghexpF_타일카펫', run: '2026-10-16', mate: 'yeoreum', brand: 'grohome', board: 'gh-exp', act: 'F', owner: 'sh', title: 'AI 노출 보드 F · 타일카펫 · 구글 디맨드젠 광고', sum: '새 캠페인 · 일 3만', cols: ['상품', '광고', '제목', '설명', '최종 URL', '예산', '초안 링크'], items: dgItems('타일카펫', 'https://grohome.co.kr/p/2'), exec: '승인되면 담당이 구글 애즈에서 초안을 확인하고 [게시]한다', hq: '광고비 예산 조정', launch: 'x_dg', prod: '타일카펫' });
{ let s = await session('sh', { now: '2026-10-16T09:40:00+09:00' });
  await expand(s.pg);
  await inbox(s.pg, '타일카펫').first().click(); await s.pg.waitForTimeout(500);
  ok('예산 적은 디맨드젠(타일카펫) = 본부장 승인 · 허지은님께', (await s.S().innerText()).includes('본부장 승인 · 광고비 예산 조정') && (await s.S().getByRole('button', { name: '고른 0개 승인 → 허지은님께' }).count()) === 1);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '스티커 프라이머 · 구글 디맨드젠').first().click(); await s.pg.waitForTimeout(500);
  await s.S().getByRole('button', { name: '모두 고르기' }).click();
  ok('예산 없는 디맨드젠 = 리드(김송희) 최종', (await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).count()) === 1 && !(await s.S().innerText()).includes('본부장 승인 ·'));
  await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).click(); await s.pg.waitForTimeout(700);
  let x = await s.pg.evaluate(() => window.__V2.v2.tasks['aix_ai_yeoreum_20261016_ghexpF_스티커프라이머']);
  eq('실행 업무 = 김송희 · 신제품 칸 연결 · 줄마다 초안 링크', x && [x.assigneeId, x.aiLaunch, x.aiProd, x.aiLaunchTask, x.aiItems.map((y) => y.link)], ['sh', 'x_dg', '스티커 프라이머', 'lb_sp__x_dg', ['https://ads.google.com/aw/campaigns/draft?c=1&ad=1', 'https://ads.google.com/aw/campaigns/draft?c=1&ad=2']]);
  await s.S().getByRole('button', { name: /^실행 업무 보기/ }).click(); await s.pg.waitForTimeout(500);   // 내가 최종 승인 = 내 실행 업무(맡김 줄 없음) → 승인 한 장에서 바로
  ok('흔적 상자: 신제품 개수에도 +1 · 신제품 칸 링크', (await s.S().innerText()).includes("신제품 '스티커 프라이머' 개수에도 +1") && (await s.S().getByRole('button', { name: /신제품 · 스티커 프라이머 · 디맨드젠 광고 \(0\/5\)/ }).count()) === 1);
  await s.S().getByLabel('F1 링크').fill('https://ads.google.com/aw/ads?ad=live1');
  await s.S().getByRole('button', { name: 'F1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('F1 했어요 → 신제품 디맨드젠 1/5', (await s.pg.locator('.v2-toast').innerText()).includes("신제품 '스티커 프라이머' 디맨드젠 광고 1/5"));
  let lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  eq('신제품 칸: 1/5 · 진행 중 · 기록에 승인 id', [lt.title, lt.count, lt.status, lt.countLog.slice(-1)[0].ask], ['디맨드젠 광고 (1/5)', 1, 'inprogress', 'ai_yeoreum_20261016_ghexpF_스티커프라이머']);
  await s.S().getByRole('button', { name: 'F1 되돌리기' }).click(); await s.pg.waitForTimeout(700);
  lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  eq('되돌리기 → 0/5', [lt.title, lt.count], ['디맨드젠 광고 (0/5)', 0]);
  await s.S().getByRole('button', { name: 'F1 했어요' }).click(); await s.pg.waitForTimeout(600);
  await s.S().getByRole('button', { name: 'F2 했어요' }).click(); await s.pg.waitForTimeout(700);
  await shot(s.pg, 'sh-dg-375'); ok('디맨드젠 실행 업무 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '끝냈어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  x = await s.pg.evaluate(() => window.__V2.v2.tasks['aix_ai_yeoreum_20261016_ghexpF_스티커프라이머']);
  eq('게시 2개 → 신제품 2/5 · 실행 업무 끝냄', [lt.title, x.status], ['디맨드젠 광고 (2/5)', 'done']);
  await s.close(); }

ok('화면 오류 없음', errs.length === 0, errs);
await b.close();
console.log(`\n${n - bad}/${n} 통과 · 그림 ${SHOTS}`); if (bad) process.exit(1);
