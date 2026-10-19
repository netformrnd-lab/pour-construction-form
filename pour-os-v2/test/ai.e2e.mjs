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
import { planExec } from '../src/aiask.js';   // ⑮ NPS 실행 업무 (2026-10-18)
import { ASIDE_ADS_LAUNCH_VER as ADS_V } from '../../marketing-hub/adops.js';   // 광고 예약 글 판 (2026-10-19 규칙 안 끄기로 바뀜)

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
// 새 크루원(바람·이음·별·달)·B2B 보드(2026-10-17)는 변유림 PC — 아래 시험은 그로홈 6개 기준 (담당 미정 4명 등)
const NEWM = Object.fromEntries(['baram', 'ieum', 'byeol', 'dal', 'dandan', 'cheokcheok', 'kkomkkom', 'deundeun', 'teunteun'].map((m) => [m, { id: m, owners: { _: 'yr' } }]));   // 바람(지인추천 · 2026-10-17 AARRR)도 변유림 PC
const seed = () => ({ meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks: { t1: { id: 't1', title: '추석 이벤트 배너 문구', isFixed: false, status: 'todo', assigneeId: 'yj', assigneeIds: ['yj'], projectId: '', dueDate: '2026-10-13', createdAt: T0, statusLog: [] } },
    notes: {}, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '2' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks, aimates: NEWM, aiboards: { 'gh-conv': { id: 'gh-conv', board: 'gh-conv', metrics: { cv_mall: { v: 7.4, date: '2026-10-12' }, cv_cp: { v: 2.4, date: '2026-10-12' }, soldout: { v: 0, date: '2026-10-12' } } } } } });
let ST = seed();
// 허브 업로더 계정(window.__HUB_ROLES · 2026-10-19 사장님 3A) — 남윤정 = 전용 업로더 · 공용 'Aside' · 김채원 = 직원(업로더 아님)
const HUB_ROLES = [{ email: 'yj-aside@x.test', name: '남윤정 Aside', role: 'uploader', active: true }, { email: 'aside@x.test', name: 'Aside', role: 'uploader', active: true }, { email: 'cw@x.test', name: '김채원', role: 'staff', active: true }];
const V1D = {};   // 버전1 문서(window.__V1_DOCS) — ⑨ 반복 실행 정의

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, now = NOW, init = '' } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });   // 폰 = 한국 시각 (Aside '오늘 안 돎'은 시:분을 봄)
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`try{ if(sessionStorage.__V2) window.__V2=JSON.parse(sessionStorage.__V2); }catch(e){} window.__V1_DATA={}; window.__V1_DOCS=${JSON.stringify(V1D)}; window.__V1_LAUNCH=[]; window.__HUB_ROLES=${JSON.stringify(HUB_ROLES)}; if(!window.__V2) window.__V2=${JSON.stringify(ST)};${init}`);
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
const live = (s, key, id) => s.pg.evaluate(([k, i]) => window.__V2.v2[k] && window.__V2.v2[k][i], [key, id]);   // 열려 있는 세션의 지금 값 (doc 은 닫은 뒤 값)
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
  ok('관리자 AI 팀원 탭: B2C 크루만 · 닫힌 크루(B2B·바라스데이)는 이름 한 줄 "미생성 · 크루 설정 필요" (2026-10-17) · 원형 칸 없음 · 여름 = 아침 루틴', (await s.pg.getByText('그로홈 · POUR스토어 B2C 크루').count()) > 0 && (await s.pg.getByText('다른 채널 크루').count()) === 1 && (await s.pg.getByText('POUR스토어 B2B 크루').count()) === 1 && (await s.pg.getByText('바라스데이 크루').count()) === 1 && (await s.pg.getByText('미생성 · 크루 설정 필요').count()) === 2 && (await s.pg.getByText(/^단단 · /).count()) === 0 && (await s.pg.getByText('기본 AI 팀원 (원형)').count()) === 0 && (await s.pg.getByText('평일 06:50 블로그·재배포').count()) > 0);
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
  eq('오늘: 내 PC Aside 세팅 한 줄 (겨울 09:00)', await inbox(s.pg, '내 PC Aside 세팅 · 겨울 09:00').count(), 1);
  ok('세팅 줄 = 3단계 중 몇 단계 · 다음 할 일 (2026-10-19 사장님 2A)', (await inbox(s.pg, '내 PC Aside 세팅').first().innerText()).includes('3단계 중 0단계 끝 · 다음: ① 사이트 로그인 0/7 · 마케팅 허브 crew 화면'));
  await inbox(s.pg, '내 PC Aside 세팅').first().getByRole('button', { name: '세팅', exact: true }).click(); await s.pg.waitForTimeout(600);
  const sx = await s.S().innerText();
  ok('세팅 시트: 3단계 · 다음 할 일 · ① 사이트 ② 예약 ③ 시험 · 업로더 계정 ✓(허브 이름에 남윤정) · PC 고르기 없음', sx.includes('내 PC · AI 크루 1명') && sx.includes('3단계 중 0단계 끝') && sx.includes('다음 할 일 · ① 사이트 로그인 0/7 · 마케팅 허브 crew 화면') && sx.includes('① 사이트 로그인') && sx.includes('② 예약 넣기') && sx.includes('③ 시험 한 번') && sx.includes('업로더 계정 있음 ✓ · 남윤정 Aside') && sx.includes('겨울 · 전환마케터') && sx.includes('아직 안 올림') && !sx.includes('PC 고르기'), sx.slice(0, 600));
  ok('[열기] = 확실한 곳만 (허브 crew 화면 · 카페24 로그인 주소)', (await s.S().locator('a[aria-label="카페24 열기"]').getAttribute('href')) === 'https://eclogin.cafe24.com/Shop/' && (await s.S().locator('a[aria-label="마케팅 허브 crew 화면 열기"]').getAttribute('href')).endsWith('marketing-hub/crew.html'));
  // ① 사이트 7곳 [로그인함] → asidesetup/yj · 하나 풀었다 다시
  for (const btn of await s.S().getByRole('button', { name: /로그인함$/ }).all()) { await btn.click(); await s.pg.waitForTimeout(60); }
  await s.pg.waitForTimeout(300);
  const su1 = await live(s, 'asidesetup', 'yj');
  ok('① 다 체크 → asidesetup/yj 사이트 7곳 on · 누가 · 다음 = ② 예약', !!su1 && su1.owner === 'yj' && Object.values(su1.sites).length === 7 && Object.values(su1.sites).every((x) => x.on && x.by === 'yj' && x.byName === '남윤정') && (await s.S().innerText()).includes('다음 할 일 · ② 예약 넣기 0/2 · 겨울'), su1);
  await s.S().getByRole('button', { name: '카페24 로그인함' }).click(); await s.pg.waitForTimeout(300);
  ok('[✓ 로그인함] 다시 누르면 풀림(지우지 않고 on false) → ① 6/7', (await live(s, 'asidesetup', 'yj')).sites['카페24'].on === false && (await s.S().innerText()).includes('① 사이트 6/7'));
  await s.S().getByRole('button', { name: '카페24 로그인함' }).click(); await s.pg.waitForTimeout(300);
  // ② 예약 글 복사 → [넣었어요] (그때 예약 시각) · 고칠 것 확인
  await s.S().getByRole('button', { name: '겨울 예약 글 복사' }).click(); await s.pg.waitForTimeout(300);
  const lt = await boxOf(s.S, '겨울 예약 글 복사');
  ok('[겨울 예약 글 복사] → 예약 글 (내 PC 09:00 · 허브 겨울 보드 주소)', lt.startsWith('[AI 크루 · 겨울 (전환마케터 · UX/UI·응대)') && lt.split('\n')[0].endsWith('평일 09:00') && lt.includes('crew.html#gh-conv'));
  await s.S().getByRole('button', { name: '겨울 예약 넣었어요' }).click(); await s.pg.waitForTimeout(300);
  await s.S().getByRole('button', { name: '고칠 것 확인 글 복사' }).click(); await s.pg.waitForTimeout(300);
  ok('[고칠 것 확인 글 복사] → 내 PC 보드만', (await boxOf(s.S, '고칠 것 확인 글 복사')).startsWith('[AI 크루 · 고칠 것만 확인 — 겨울]'));
  await s.S().getByRole('button', { name: '고칠 것 확인 예약 넣었어요' }).click(); await s.pg.waitForTimeout(400);
  const su2 = await live(s, 'asidesetup', 'yj');
  ok('② [넣었어요] → runs 겨울 {on · t 09:00} · 고칠 것 확인 on · 다음 = ③ 시험', su2.runs['gh-conv'].on && su2.runs['gh-conv'].t === '09:00' && su2.runs._fix.on && (await s.S().innerText()).includes('다음 할 일 · ③ [시험 한 번]'), su2.runs);
  // ③ 시험 한 번 → 글(예약 아님) · 누른 때 남김 → 결과가 올라오면(Aside → 허브 = 다른 기기) 저절로 ✓ · 세팅 끝
  await s.S().getByRole('button', { name: '시험 한 번 — 겨울 글 복사' }).click(); await s.pg.waitForTimeout(400);
  const tt = await boxOf(s.S, '시험 한 번 — 겨울 글 복사');
  ok('[시험 한 번] → 지금 한 번 글(예약 아님) · test.at · 기다리는 중', tt.split('\n')[0].endsWith('지금 한 번 (시험 · 예약 아님)') && tt.includes('예약 작업은 만들지 않는다') && !!(await live(s, 'asidesetup', 'yj')).test.at && (await s.S().innerText()).includes('결과 기다리는 중'));
  await shot(s.pg, 'yj-setup-375'); ok('세팅 시트 넘침 없음 375', !(await over(s.pg)));
  await s.pg.evaluate(() => window.__OTHER('aiboards', 'gh-conv', { at: '2026-10-12T01:04:00.000Z' })); await s.pg.waitForTimeout(500);
  const sd = await s.S().innerText();
  ok('결과 올라옴 → ③ ✓ · 세팅 끝 ✓ · 마지막 올림', sd.includes('세팅 끝 ✓') && sd.includes('✓ 10/12 10:04 · 겨울 결과가 올라왔어요') && sd.includes('마지막 올림 10/12 10:04'), sd.slice(0, 500));
  await shot(s.pg, 'yj-setup-done-375');
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  eq('세팅 끝 → 확인할 것 세팅 줄 사라짐', await inbox(s.pg, '내 PC Aside 세팅').count(), 0);
  await s.pg.evaluate(() => window.__OTHER('aiboards', 'gh-conv', { at: null })); await s.pg.waitForTimeout(400);   // 뒤 시험(⑦ 등)은 아직 안 올린 보드로
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
  ok('AI 한 장: 보드 지표 · 할 일 · 고칠 점 · Aside 루틴 줄', tx.includes('전환 보드') && tx.includes('자사몰 구매전환율') && tx.includes('7.4%') && tx.includes('할 일 B~I') && tx.includes('구매 길 점검') && tx.includes('단계 미션 · 전환') && tx.includes('Aside 루틴 · 평일 09:00 · 내 PC') && tx.includes('횟수 (담당이 정함)') && tx.includes('B · 옵션안') && (await s.S().getByRole('button', { name: '지금 돌리기 — Aside 글 복사' }).count()) === 1 && (await s.S().locator('a[href$="crew.html#gh-conv"]').count()) > 0);
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
const AA = '새 예약 글 넣기 · 예약 2개';
{ const s = await session('hj', { w: 1280, h: 900 });
  await expand(s.pg);
  eq('관리자 오늘: AI 크루 담당 미정 4명 한 줄', await inbox(s.pg, 'AI 크루 담당 미정 4명').count(), 1);
  await inbox(s.pg, 'AI 크루 담당 미정 4명').first().getByRole('button', { name: '정하기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('[정하기] → AI 팀원 (담당 한꺼번에 정하기)', (await s.S().getByRole('button', { name: '담당 한꺼번에 정하기' }).count()) === 1);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  // 광고 Aside 예약 글 (2026-10-17 사장님 "까먹을것같은데 os 확인할것에 나오게해줘" → "Aside 예약은 김송희에게만") — 다른 관리자(허지은)에겐 안 뜸
  eq('관리자(허지은) 오늘: 광고 Aside 예약 글 줄 없음 (김송희에게만)', await inbox(s.pg, AA).count(), 0);
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

// 광고 Aside 예약 글 받는 사람 (2026-10-17 사장님 "Aside 예약은 김송희에게만 os에 알림뜨게해") — 김송희 [넣었어요] · 관리자 설정에서 바꾸기
{ let s = await session('sh');
  await expand(s.pg);
  eq('김송희 오늘: 광고 Aside 예약 글 넣기 한 줄 · 꼬리표', [await inbox(s.pg, AA).count(), await inbox(s.pg, AA).first().getByText('Aside 광고', { exact: true }).count() > 0], [1, true]);
  await shot(s.pg, 'sh-adsaside-375'); ok('김송희 오늘 넘침 없음 375', !(await over(s.pg)));
  await inbox(s.pg, AA).first().getByRole('button', { name: '넣었어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  const aa = await s.pg.evaluate(() => (window.__V2.v2.settings || {}).adsAside || null);
  eq('[넣었어요] → 줄 사라짐 · settings/adsAside 판·누가', [await inbox(s.pg, AA).count(), aa && aa.ver, aa && aa.by], [0, ADS_V, 'sh']);
  await s.close(); }
ST.v2.settings.adsAside = { ...ST.v2.settings.adsAside, ver: '2026-10-01' };   // 새 판이 나온 것처럼
{ let s = await session('hj', { admin: true, w: 1280, h: 900 });
  await s.pg.getByRole('button', { name: '설정', exact: true }).first().click(); await s.pg.waitForTimeout(500);
  ok('관리자 설정: 광고 Aside 예약 알림 · 지금 김송희 (기본)', (await s.S().innerText()).includes('지금 김송희 (기본)'));
  await s.S().getByLabel('광고 Aside 예약 알림 받는 사람').selectOption('mj'); await s.pg.waitForTimeout(600);
  let st = await s.pg.evaluate(() => window.__V2.v2.settings.adsAside);
  ok('김민지로 바꿈 → ownerId · 누가 · 토스트', st.ownerId === 'mj' && st.ownerBy === 'hj' && (await s.pg.locator('.v2-toast').innerText()).includes('광고 Aside 예약 알림 = 김민지'), st);
  await shot(s.pg, 'hj-adsaside-owner-1280');
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  eq('되돌리기 → 기본', (await s.pg.evaluate(() => window.__V2.v2.settings.adsAside)).ownerId, '');
  await s.S().getByLabel('광고 Aside 예약 알림 받는 사람').selectOption('mj'); await s.pg.waitForTimeout(600);
  await s.close(); }
{ let s = await session('ran', { admin: true });
  await s.pg.getByRole('button', { name: '설정', exact: true }).first().click(); await s.pg.waitForTimeout(500);
  ok('관리자 설정 375: 광고 Aside 예약 알림 · 지금 김민지 · 넘침 없음', (await s.S().innerText()).includes('지금 김민지') && !(await over(s.pg)));
  await shot(s.pg, 'ran-adsaside-owner-375');
  await s.close(); }
{ let s = await session('mj');
  await expand(s.pg);
  eq('받는 사람 김민지 → 김민지 오늘에 한 줄', await inbox(s.pg, AA).count(), 1);
  await s.close(); }
{ let s = await session('sh');
  await expand(s.pg);
  eq('김송희에겐 이제 없음', await inbox(s.pg, AA).count(), 0);
  await s.close(); }
ST.v2.settings.adsAside = { ...ST.v2.settings.adsAside, ver: ADS_V, ownerId: '' };   // 아래 시험은 넣은 것으로

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
  await s.pg.locator('.v2-page [role=button]').filter({ hasText: 'B2C 크루 · 할 일마다 승인 길' }).first().click(); await s.pg.waitForTimeout(500);
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
  ok('[지금 돌리기] → 세팅 시트 · 마지막 올림 10/12 · 오늘 아직 안 올림(빨강) · 지금 돌리기 글(예약 아님)', (await s.S().innerText()).includes('마지막 올림 10/12 09:10') && (await s.S().innerText()).includes('오늘 아직 안 올림') && (await s.S().getByRole('button', { name: '지금 돌리기 — 겨울 글 복사' }).count()) === 1);
  await shot(s.pg, 'yj-miss-375'); ok('안 돎 시트 넘침 없음 375', !(await over(s.pg)));
  await s.close();
  s = await session('cw', { now: '2026-10-13T11:00:00+09:00' });
  await expand(s.pg);
  eq('김채원 = 여름 세팅 안내 (담당마다 09:00 동시에)', await inbox(s.pg, '내 PC Aside 세팅 · 여름 09:00').count(), 1);
  await s.close(); }

// ⑦-1 사장님 Aside 세팅 현황 (2026-10-19 사장님 4A) — 관리자 '확인할 것' 한 줄 → 현황 시트(담당 PC 마다 단계 · 업로더 계정 · 마지막 올림·올린 계정) → 그 PC 세팅(관리자도 체크)
ST.v2.aiboards['gh-conv'].by = 'yj-aside@x.test';   // 허브 crew.html 이 올린 계정 메일
{ let s = await session('hj', { now: '2026-10-13T11:00:00+09:00' });
  await expand(s.pg);
  const ln = inbox(s.pg, 'Aside 세팅 현황');
  eq('관리자 확인할 것 = Aside 세팅 현황 한 줄', await ln.count(), 1);
  ok('세팅 현황 줄 = 담당 1/3명 끝 · 사람마다 단계 (담당 미정 크루는 셈에서 뺌)', (await ln.first().innerText()).includes('Aside 세팅 현황 · 담당 1/3명 끝') && (await ln.first().innerText()).includes('남윤정 끝 · 김채원 0/3 · 변유림 0/3'), await ln.first().innerText());
  await ln.first().click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('현황 시트: 담당 PC 마다 · 끝 ✓ · 단계 · 계정 · 마지막 올림·올린 계정 · 담당 미정 줄', tx.includes('담당 3명 · 끝 1명') && tx.includes('남윤정 PC · 크루 1명') && tx.includes('끝 ✓') && tx.includes('마지막 올림 10/12 09:10 · 겨울 · 올린 계정 남윤정 Aside') && tx.includes('김채원 PC · 크루 1명') && /사이트 0\/5\s+예약 0\/2\s+시험 —\s+계정 없음/.test(tx) && /사이트 7\/7\s+예약 2\/2\s+시험 ✓\s+계정 ✓/.test(tx) && tx.includes('담당 미정 크루 4명 · 관리자 PC'), tx.slice(0, 900));
  ok('업로더 계정 칸: 남윤정 ✓ · 김채원 아직 없음(직원 계정은 업로더 아님) · 허브 계정 화면 링크', tx.includes('✓ 남윤정 Aside') && tx.includes('아직 없음') && (await s.S().getByRole('link', { name: '허브 계정 화면 열기 ›' }).getAttribute('href')).endsWith('marketing-hub/#acct'));
  await shot(s.pg, 'hj-setup-all-375'); ok('현황 시트 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByText('김채원 PC · 크루 1명').click(); await s.pg.waitForTimeout(600);
  ok('줄 누르면 그 PC 세팅 (관리자 = 체크 가능 · PC 고르기)', (await s.S().innerText()).includes('김채원 PC · AI 크루 1명') && (await s.S().innerText()).includes('여름 · 유입마케터') && (await s.S().getByRole('button', { name: '인스타그램 로그인함' }).count()) === 1);
  await s.S().getByRole('button', { name: '인스타그램 로그인함' }).click(); await s.pg.waitForTimeout(400);
  const cs = await live(s, 'asidesetup', 'cw');
  ok('관리자가 대신 체크 → asidesetup/cw (owner cw · 누가 = 허지은)', !!cs && cs.owner === 'cw' && cs.sites['인스타그램'].on === true && cs.sites['인스타그램'].by === 'hj');
  await s.close(); }
{ let s = await session('yr', { now: '2026-10-13T11:00:00+09:00' });
  await expand(s.pg);
  eq('팀원(변유림) = 세팅 현황 줄 없음 · 내 PC 세팅 줄', [await inbox(s.pg, 'Aside 세팅 현황').count(), await inbox(s.pg, '내 PC Aside 세팅').count()], [0, 1]);
  await inbox(s.pg, '내 PC Aside 세팅').first().getByRole('button', { name: '세팅', exact: true }).click(); await s.pg.waitForTimeout(600);
  ok('변유림 세팅 시트 = 내 PC 크루 4명 · 업로더 계정 없음 안내 · 시험할 크루 = 평일 크루(바람)', (await s.S().innerText()).includes('내 PC · AI 크루 4명') && (await s.S().innerText()).includes('업로더 계정이 아직 없어요') && (await s.S().getByRole('button', { name: '시험 한 번 — 바람 글 복사' }).count()) === 1);
  eq('팀원 세팅 시트엔 PC 고르기 없음', await s.S().getByLabel('PC 고르기').count(), 0);
  await shot(s.pg, 'yr-setup-375'); ok('변유림 세팅 시트 넘침 없음 375', !(await over(s.pg)));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await s.pg.evaluate(() => { location.hash = '#s-aside'; }); await s.pg.waitForTimeout(600);   // 허브 crew 화면 맨 위 한 줄 → os2.html#s-aside (2026-10-19 사장님 1A)
  ok('링크 #s-aside → 내 PC Aside 세팅 바로 · 주소의 # 는 지움', (await s.S().innerText()).includes('내 PC · AI 크루 4명') && (await s.pg.evaluate(() => location.hash)) === '');
  await s.close(); }
{ let s = await session('hj', { admin: true, w: 1280, h: 900, now: '2026-10-13T11:00:00+09:00' });
  await s.pg.locator('.v2-nav').getByRole('button', { name: 'AI 팀원', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('관리자 AI 팀원 탭 맨 위 = Aside 세팅 현황 · 담당 1/3명 끝', (await s.pg.getByText('Aside 세팅 현황 · 담당 1/3명 끝').count()) === 1);
  await s.pg.getByText('Aside 세팅 현황 · 담당 1/3명 끝').click(); await s.pg.waitForTimeout(600);
  ok('관리자 화면에서도 현황 시트', (await s.S().innerText()).includes('남윤정 PC · 크루 1명'));
  await shot(s.pg, 'hj-setup-all-1280'); ok('현황 시트 넘침 없음 1280', !(await over(s.pg)));
  await s.close(); }
{ let s = await session('yj', { w: 768, h: 1000, now: '2026-10-13T11:00:00+09:00' });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI/).click(); await s.pg.waitForTimeout(500);
  ok('AI 팀원 맨 위 = 내 PC Aside (세팅 끝이면 단계 꼬리표 없음)', (await s.S().getByText(/^내 PC Aside · 겨울 09:00/).count()) === 1 && (await s.S().innerText()).includes('세팅 끝 · 지금 돌리기'));
  await s.S().getByText(/^내 PC Aside · 겨울 09:00/).click(); await s.pg.waitForTimeout(500);
  await shot(s.pg, 'yj-setup-768'); ok('세팅 시트 넘침 없음 768', !(await over(s.pg)));
  await s.close(); }

// ⑧ AI에게 업무 맡기기 (2026-10-15 사장님 "ai팀원에게 업무요청을 별도로해서 진행도 가능했으면") — 김채원(폰) → 겨울에게 → 취소 · 다시 맡김 → Aside 결과 → 맡긴 사람 '맡긴 일 결과' · 담당(남윤정) 승인 줄
{ let s = await session('cw', { now: '2026-10-13T11:00:00+09:00' });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI 1/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('AI에게 업무 맡기기').click(); await s.pg.waitForTimeout(500);
  ok('맡기기 시트: AI 6명 · 버튼 잠김(아직 안 고름)', (await s.S().getByText('겨울 · 전환마케터').count()) > 0 && (await s.S().getByText('봄 · MD · 볼륨(판매채널·프로모션)').count()) > 0 && await s.pg.getByRole('button', { name: 'AI 팀원을 골라 주세요' }).isDisabled());
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
//   (2026-10-17 사장님 AARRR 정의로 겨울 E 리뷰 → 바람 D · 이 시험은 같은 흐름을 겨울 G 로) 허지은 = 겨울 G 담당 김민지 · 반복 실행 짝 → 남윤정 C 승인 → 김민지 E 승인 → 김송희(리드) E 최종 → 김소연(리드) C [본부장에게도 올리기] → 허지은 C 최종 → 김민지 흔적(G1 했어요 +1 · G2 안 함) → 끝냄
V1D['state-actionKPIs'] = { items: [{ id: 'x_rv', name: '리뷰 신고·답글', cyc: 'W', goal: 10, unit: '건', who: [], active: true, startDate: '2026-09-28' }] };
const NOW9 = '2026-10-14T10:00:00+09:00';
ST.v2.aiasks.ai_gyeoul_20261014_ghconvG = ask({ id: 'ai_gyeoul_20261014_ghconvG', run: '2026-10-14', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'G', owner: 'yj', title: '전환 보드 E · 리뷰 정리', cols: ['채널', '리뷰', '링크'], items: [{ n: 'G1', c: { 채널: '쿠팡', 리뷰: '같은 문장 3건', 링크: 'https://www.coupang.com/vp/products/1' } }, { n: 'G2', c: { 채널: '네이버', 리뷰: '1점 답글', 링크: 'https://smartstore.naver.com/x/products/2' } }], exec: '승인되면 담당이 리뷰 신고·답글을 단다' });
ST.v2.aiasks.ai_gyeoul_20261014_ghconvC = ask({ id: 'ai_gyeoul_20261014_ghconvC', run: '2026-10-14', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', owner: 'yj', title: '전환 보드 C · 상세 첫 화면', cols: ['상품', '고칠 점'], items: [{ n: 'C1', c: { 상품: '유리블러', '고칠 점': '첫 화면에 가격' } }], exec: '승인되면 담당이 상세페이지를 고친다' });
{ let s = await session('hj', { now: NOW9 });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^B2C 크루 · 할 일마다 승인 길/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('겨울 · 전환마케터').click(); await s.pg.waitForTimeout(600);
  await s.S().getByText('G · 구매 미전환 고객 콜 목록·통화 스크립트 (B2C)', { exact: true }).click(); await s.pg.waitForTimeout(300);
  await s.S().getByLabel('G 할 일 담당').selectOption('mj'); await s.pg.waitForTimeout(600);
  ok('할 일 담당 → 토스트 · 열린 승인 1건 넘김', (await s.pg.locator('.v2-toast').innerText()).includes('G 담당 남윤정(AI 담당) → 김민지 · 열린 승인 1건 넘김'));
  await s.S().getByLabel('G 반복 실행 짝 더하기').selectOption('x_rv'); await s.pg.waitForTimeout(600);
  ok('반복 실행 짝 → 토스트', (await s.pg.locator('.v2-toast').innerText()).includes("G 반복 실행 짝 리뷰 신고·답글"));
  const tx = await s.S().innerText();
  ok('할 일 줄: G 담당 김민지 · 승인 담당에서 끝(콜 목록) · 반복 · B 본부장까지(판매가) · C 리드까지 (2026-10-17 승인 길)', tx.includes("담당 김민지 · 승인 담당에서 끝 · 매주 월요일 · 반복 '리뷰 신고·답글'") && tx.includes('담당 남윤정 · 승인 본부장까지(판매가 조정)') && tx.includes('담당 남윤정 · 승인 리드까지 · 히어로 4종 순서대로'), tx);
  ok('AI 한 장 머리: 할 일마다 승인 길 묶음', tx.includes('할 일마다 승인 길 · 담당에서 끝 G · 리드까지 C·H·I · 본부장까지 B'), tx);
  await s.S().getByText('B · 쿠팡 유리블러 가격·구성 재설계', { exact: true }).click(); await s.pg.waitForTimeout(300);
  ok('B 승인 길 기본 = 본부장까지 · 판매가 조정 (고르는 칸 4개)', (await s.S().getByLabel('B 승인 길').locator('option').first().innerText()).includes('기본 (본부장까지 · 판매가 조정)') && (await s.S().getByLabel('B 승인 길').locator('option').count()) === 4);
  await s.S().getByLabel('B 승인 길').selectOption('lead'); await s.pg.waitForTimeout(600);
  ok('승인 길 바꿈 → 토스트 · aimates.actPath', (await s.pg.locator('.v2-toast').innerText()).includes('B 승인 길 리드까지') && (await live(s, 'aimates', 'gyeoul')).actPath.B === 'lead');
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  ok('되돌리기 → 기본(보드대로)', (await live(s, 'aimates', 'gyeoul')).actPath.B === null && (await s.S().getByLabel('B 승인 길').inputValue()) === '');
  await shot(s.pg, 'hj-actset-375'); ok('할 일 설정 넘침 없음 375', !(await over(s.pg)));
  await s.close();
  const m = doc('aimates', 'gyeoul');
  eq('할 일 담당 · 반복 실행 짝 저장 (aimates · 기록)', [m.actOwners, m.actAk, (m.hist || []).length >= 2], [{ G: 'mj' }, { G: 'x_rv' }, true]);
  eq('열린 E 승인 → 김민지 · C 는 그대로 남윤정', [doc('aiasks', 'ai_gyeoul_20261014_ghconvG').to, doc('aiasks', 'ai_gyeoul_20261014_ghconvG').owner, doc('aiasks', 'ai_gyeoul_20261014_ghconvC').to], ['mj', 'mj', 'yj']); }
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
  ok('G 길 = 김민지 ● 담당에서 끝 (콜 목록 · 2026-10-17) · 본부장 표시 없음 · [리드에게도 올리기] 김송희', tx.includes('담당에서 끝') && tx.includes('김송희님 확인이 필요하면') && !tx.includes('허지은') && !tx.includes('본부장 승인 ·'), tx);
  await s.S().getByRole('checkbox').filter({ hasText: 'G1' }).click(); await s.S().getByRole('checkbox').filter({ hasText: 'G2' }).click();
  ok('담당 차례 = [고른 2개 최종 승인] + [리드에게도 올리기]', (await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).count()) === 1 && (await s.S().getByRole('button', { name: '리드에게도 올리기' }).count()) === 1);
  await shot(s.pg, 'mj-ownerpath-375'); ok('담당에서 끝 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '리드에게도 올리기' }).click(); await s.pg.waitForTimeout(600);
  const gl = await live(s, 'aiasks', 'ai_gyeoul_20261014_ghconvG');
  ok('리드에게도 올리기 → 김송희 · leadUp', (await s.pg.locator('.v2-toast').innerText()).includes('김송희님께 승인 요청을 보냈어요') && !!gl.leadUp && gl.to === 'sh', gl);
  await s.close(); }
{ let s = await session('sh', { now: NOW9, w: 768, h: 1000 });
  await expand(s.pg);
  await inbox(s.pg, '리뷰 정리').first().click(); await s.pg.waitForTimeout(500);
  ok('리드(김송희) = 최종 승인 · [본부장에게도 올리기] 보임', (await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).count()) === 1 && (await s.S().getByRole('button', { name: '본부장에게도 올리기' }).count()) === 1 && (await s.S().innerText()).includes('리드에서 끝나는 일이에요'));
  await shot(s.pg, 'sh-leadfinal-768'); ok('리드 최종 넘침 없음 768', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).click(); await s.pg.waitForTimeout(700);
  ok('토스트: 김민지님께 실행 업무', (await s.pg.locator('.v2-toast').innerText()).includes("김민지님께 '실행' 업무가 생겼어요"));
  await s.close();
  const d = doc('aiasks', 'ai_gyeoul_20261014_ghconvG'), x = doc('tasks', 'aix_ai_gyeoul_20261014_ghconvG');
  eq('리드 최종 승인 (본부장 안 감)', [d.state, d.okBy, d.path], ['ok', 'sh', ['mj', 'sh']]);
  eq('실행 업무 = 할 일 담당(김민지) · 번호마다 한 줄·링크 · 반복 짝', x && [x.assigneeId, x.aiAk, x.aiItems.map((y) => [y.n, y.link])], ['mj', 'x_rv', [['G1', 'https://www.coupang.com/vp/products/1'], ['G2', 'https://smartstore.naver.com/x/products/2']]]); }
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
  ok('흔적 상자: 2개 · 짝지은 반복 실행에도 +1 안내 · AI 링크 채워짐', (await s.S().innerText()).includes('2개 중 0개 남김') && (await s.S().innerText()).includes('짝지은 반복 실행(내 것)에도 +1') && (await s.S().getByLabel('G1 링크').inputValue()) === 'https://www.coupang.com/vp/products/1');
  await s.S().getByRole('button', { name: 'G1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok("G1 했어요 → 반복 '리뷰 신고·답글' +1", (await s.pg.locator('.v2-toast').innerText()).includes("반복 '리뷰 신고·답글' +1"));
  await s.S().getByRole('button', { name: 'G2 안 함' }).click(); await s.S().getByLabel('G2 안 한 이유').fill('판매자 답글 권한 없음'); await s.S().getByRole('button', { name: 'G2 안 함 남기기' }).click(); await s.pg.waitForTimeout(600);
  let k = await s.pg.evaluate(() => [window.__V2.v2.kpiact['2026-Q4'], window.__V2.v2.checks['ak~x_rv~mj~2026-10-14']]);
  eq('반복 실행 +1 = 이번 주 · 흔적(승인 id · 번호 · 링크) 같이 · 그날 기록', [k[0].w['2026-10-12'].x_rv.n, k[0].log.slice(-1)[0].ai, k[1].runs, k[1].recs.slice(-1)[0].ai.n], [1, { ask: 'ai_gyeoul_20261014_ghconvG', n: 'G1', link: 'https://www.coupang.com/vp/products/1' }, 1, 'G1']);
  await s.S().getByRole('button', { name: 'G1 되돌리기' }).click(); await s.pg.waitForTimeout(700);
  k = await s.pg.evaluate(() => window.__V2.v2.kpiact['2026-Q4'].w['2026-10-12'].x_rv.n);
  eq('되돌리기 → 반복 실행 −1', k, 0);
  await s.S().getByRole('button', { name: 'G1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('다 남김 · 했어요 1개', (await s.S().innerText()).includes('다 남김 · 했어요 1개'));
  await shot(s.pg, 'mj-trace-375'); ok('흔적 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '끝냈어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  const t = await s.pg.evaluate(() => window.__V2.v2.tasks.aix_ai_gyeoul_20261014_ghconvG);
  eq('흔적: G1 했어요 · G2 안 함(이유) · 끝냄', [t.aiTrace.G1.done, t.aiTrace.G2.skip, t.aiTrace.G2.note, t.status], [true, true, '판매자 답글 권한 없음', 'done']);
  await s.close(); }

// ⑩ AI 크루 보고 (2026-10-15 사장님 "본부장은 리드에게 매주 금요일 보고받음 · 크루 칸별 · 실행 · 결과(유입·전환) · 다음(AI 피드백 + 사람)" · "한동안 주간 → 점차 1개월")
//   금 10/16: 남윤정(겨울 담당) 칸 쓰기 → 김소연(리드) 본부장에게 보내기(되돌리기 한 번) → 허지은(본부장) 읽었어요 · 주기 월간 ↔ 주간
Object.assign(ST.v2.aiboards['gh-conv'], { hist: { cv_mall: { '2026-10-09': 6.1, '2026-10-15': 7.4 } }, nextHist: { '2026-10-16': '- 롤러 재입고 알림 켜기\n- 상세 첫 화면 시안 2개' }, next: { text: '- 롤러 재입고 알림 켜기\n- 상세 첫 화면 시안 2개', run: '2026-10-16' } });
const FRI = '2026-10-16T10:00:00+09:00', RID = 'b2c-2026-10-12';
// 리포트 ①~④ (2026-10-17 볼트): 남윤정 금요일 '이번주 리포트 전달'(메모 = 쓸 것) · 별(AI) 공통 숫자 초안 = 최종 승인
ST.v2.tasks.fx_rep_yj = { id: 'fx_rep_yj', title: '이번주 리포트 전달', isFixed: true, type: 'fixed', recurType: 'weekly', weekDays: ['금'], fixedTime: '11:00', status: 'todo', assigneeId: 'yj', assigneeIds: ['yj'], brand: 'common', scope: 'brand', memo: '*내용물: 전환율, 이탈 구간(상세페이지)\n*포인트: 이상한 것 3개', createdAt: T0, statusLog: [] };
ST.v2.aiasks.ai_byeol_20261016_opsreportA = { ...ask({ id: 'ai_byeol_20261016_opsreportA', at: '2026-10-16T00:10:00.000Z', run: '2026-10-16', mate: 'byeol', board: 'ops-report', act: 'A', owner: 'yr', title: '주간 리포트 보드 A · 공통 숫자 초안' }), state: 'ok', okAt: '2026-10-16T00:40:00.000Z', okBy: 'yr', okByName: '변유림' };
{ let s = await session('yj', { now: FRI });
  await expand(s.pg);
  eq('금요일: 남윤정 = 겨울 칸 쓰기 줄', await inbox(s.pg, '겨울 칸 쓰기 · B2C 크루').count(), 1);
  await inbox(s.pg, '겨울 칸 쓰기 · B2C 크루').first().getByRole('button', { name: '쓰기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('보고서: 이번 주 · 다음 할 일 = 내 칸 겨울 · 칸 8개 (공통 숫자 별 + AARRR 6 + 봄 MD · 2026-10-17)', tx.includes('이번 주') && tx.includes('10/12~10/18') && tx.includes('내 칸 겨울') && tx.includes('크루 칸 8'), tx.slice(0, 400));
  ok('겨울 칸: 실행 2 · 남음 1 · 흔적 2 · 안 함 1 · 전환 7.4% ← 6.1% · KPI +1 · AI 다음', tx.includes('실행 업무 끝냄 2 · 남음 1 · 흔적 2 · 안 함 1') && tx.includes('7.4% ← 6.1% · 목표 7% ✓') && tx.includes("반복 '리뷰 신고·답글' +1") && tx.includes('롤러 재입고 알림 켜기'), tx.slice(0, 900));
  ok('다른 칸은 접힘 · 담당 미정 · 한 줄 요약', tx.includes('매출 · 봄(AI)') && tx.includes('매출 · 하늘(AI)') && tx.includes('지인추천 · 바람(AI)') && tx.includes('담당 미정'));
  await s.S().getByText("내 '이번주 리포트 전달' · 쓸 것").scrollIntoViewIfNeeded(); await shot(s.pg, 'yj-report-memo-375');
  ok("리포트 ②: 내 칸 위에 '이번주 리포트 전달' 메모(쓸 것) · 다 쓰면 체크", tx.includes("내 '이번주 리포트 전달' · 쓸 것") && tx.includes('이탈 구간(상세페이지)') && tx.includes('매주 금 11:00 · 다 쓰면 체크돼요'), tx.slice(0, 700));
  // 리포트 ④: 칸에 파일 붙이기 (HTML·사진) → 하나 빼기 (올린 사람 · 올린 날)
  await s.S().getByLabel('파일 고르기').first().setInputFiles([{ name: '주간 리포트.html', mimeType: 'text/html', buffer: Buffer.from('<h1>주간</h1>') }, { name: '캡처.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) }]);
  await s.pg.waitForTimeout(900);
  ok('파일 2개 붙임 → 토스트 · 칸에 2개', (await s.pg.locator('.v2-toast').innerText()).includes('겨울 칸에 파일 2개 붙였어요') && (await s.S().innerText()).includes('직접 만든 보고서 · 파일 2'));
  eq('칸 파일 저장 (secs.gyeoul.files · 누가)', (doc0 => [doc0.secs.gyeoul.files.map((f) => f.name), doc0.secs.gyeoul.files.map((f) => f.by)])(await s.pg.evaluate(() => window.__V2.v2.aireports['b2c-2026-10-12'])), [['주간 리포트.html', '캡처.png'], ['yj', 'yj']]);
  await s.S().getByRole('button', { name: '캡처.png 빼기' }).click(); await s.pg.waitForTimeout(600);
  ok('빼기 → 토스트 · 1개 남음', (await s.pg.locator('.v2-toast').innerText()).includes('파일을 뺐어요 · 캡처.png') && (await s.S().innerText()).includes('직접 만든 보고서 · 파일 1'));
  eq('뺀 파일 = removedFiles (지우지 않음 · 칸 표시)', (doc0 => [doc0.secs.gyeoul.files.map((f) => f.name), doc0.removedFiles.map((f) => [f.name, f.mate, f.removedBy])])(await s.pg.evaluate(() => window.__V2.v2.aireports['b2c-2026-10-12'])), [['주간 리포트.html'], [['캡처.png', 'gyeoul', 'yj']]]);
  await s.S().getByLabel('겨울 한 줄').fill('전환 7.4% — 상세 첫 화면 가격 노출 효과');
  await s.S().getByLabel('겨울 다음 계획').fill('- 리뷰 이벤트 기획');
  await shot(s.pg, 'yj-report-375'); ok('보고서 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '겨울 다 썼어요' }).click(); await s.pg.waitForTimeout(600);
  ok("다 썼어요 → 토스트 = '이번주 리포트 전달' 오늘 체크 · 김소연님이 보냄 (리포트 ①)", (await s.pg.locator('.v2-toast').innerText()).includes("겨울 칸 다 썼어요 · '이번주 리포트 전달' 오늘 체크 · 김소연님이 본부장에게 보내요"), await s.pg.locator('.v2-toast').innerText());
  eq("리포트 ①: '이번주 리포트 전달' 체크 = 오늘 (남윤정)", (await s.pg.evaluate(() => window.__V2.v2.tasks.fx_rep_yj.doneDates || {})).yj, '2026-10-16');
  ok('메모 카드 = 이번 주 체크 ✓', (await s.S().innerText()).includes('매주 금 11:00 · 이번 주 체크 ✓'));
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
  eq('보냄 저장: 누가 · 얼린 숫자 · 리드 한마디 · 파일도 얼림', [r.secs.gyeoul.sent.by, r.secs.gyeoul.snap.doneN, r.secs.gyeoul.snap.trace.done, r.secs.gyeoul.snap.note, r.secs.gyeoul.snap.plan, r.leads.sy.note, r.secs.gyeoul.snap.files.map((f) => f.name)], ['sy', 2, 2, '전환 7.4% — 상세 첫 화면 가격 노출 효과', '- 리뷰 이벤트 기획', '가격 실험 결과는 다음 주에 결정', ['주간 리포트.html']]); }
{ let s = await session('hj', { now: '2026-10-16T16:00:00+09:00', w: 1280, h: 900 });
  await expand(s.pg);
  eq('본부장 = 보고 도착 줄', await inbox(s.pg, 'B2C 크루 주간 보고 · 1/8칸').count(), 1);
  await inbox(s.pg, 'B2C 크루 주간 보고 · 1/8칸').first().getByRole('button', { name: '읽기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const tx = await s.S().innerText();
  ok('본부장 보고서: 보낸 겨울 칸 펼침 · 리드 한마디 · 읽었어요', tx.includes('본부장에게 보냄 ✓ 김소연') && tx.includes('7.4% ← 6.1%') && tx.includes('리드 한마디') && tx.includes('가격 실험 결과는 다음 주에 결정') && (await s.pg.getByRole('button', { name: '읽었어요', exact: true }).count()) === 1);
  ok('리포트 ④: 본부장 = 보낸 때 파일 그대로 · 빼기 없음', tx.includes('보낸 때 파일 1') && tx.includes('주간 리포트.html') && (await s.S().getByRole('button', { name: /빼기$/ }).count()) === 0);
  await s.S().getByRole('button', { name: '공통 숫자 별 칸' }).click(); await s.pg.waitForTimeout(400);
  { const t3 = await s.S().innerText(); ok('리포트 ③: 공통 숫자 칸 = 별(AI) 초안 링크 · 최종 승인', t3.includes('별(AI) 초안 · 매주 금 09:00') && t3.includes('A · 공통 숫자 칸 초안 + 이상한 것 3개 ›') && t3.includes('10/16 · 최종 승인'), t3.slice(0, 900)); }
  await s.S().getByRole('button', { name: '보고 글로 복사' }).click(); await s.pg.waitForTimeout(300);
  const g = await boxOf(s.S, '보고 글로 복사');
  ok('보고 글: 머리 · 겨울 칸 · 결과 · 다음 · 리드 한마디 · 파일 이름(주소 없이)', g.startsWith('[AI 크루 주간 보고] B2C 크루 · 10/12~10/18') && g.includes('■ 전환 · 겨울(AI)') && g.includes('- 결과 자사몰 구매전환율: 7.4% ← 6.1%') && g.includes('리뷰 이벤트 기획') && g.includes('리드 한마디 (김소연)') && g.includes('- 파일 1개: 주간 리포트.html (업무OS 보고서에서 열기)') && !g.includes('example.test'), g.slice(0, 400));
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
  { const L = await inbox(s.pg, '본부장에게 보내기').allInnerTexts();
    ok('김채원(여름 담당 · 리드 본인) = 여름 칸 쓰기 + 보내기 3칸 (여름 + 별·바람 = 변유림 담당 → 리드 김채원 · 2026-10-17)', (await inbox(s.pg, '여름 칸 쓰기').count()) === 1 && L.length === 1 && L[0].includes('B2C 크루 3칸 → 본부장에게 보내기'), L); }
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText('크루 칸별 · 실행 · 결과 · 다음 계획 · 금요일 리드 → 본부장').click(); await s.pg.waitForTimeout(500);
  ok('더보기 › 성과 › AI 크루 보고 = 같은 화면', (await s.S().innerText()).includes('내 칸 여름'));
  await s.close(); }

// ⑪ 구글 디맨드젠 (2026-10-15 사장님 "디멘드젠광고 세팅해서 게시까지 · 내일부터 · 외주 상관없어") — 가을 H(2026-10-17 여름 F 에서 옮김) · 상품마다 승인 한 건 · 새 예산 없으면 리드(김송희)에서 끝
//   → 김송희 실행 업무: [했어요] = 신제품 '스티커 프라이머 · 디맨드젠 광고 (n/5)' +1 · 되돌리기 −1 · 예산을 적은 건(타일카펫)은 본부장까지
ST.v2.projects.lb_sp = { id: 'lb_sp', title: '스티커 프라이머', brand: 'grohome', category: 'launch', launchDate: '2026-10-16', status: 'active', assigneeId: 'sh', createdAt: T0 };
ST.v2.tasks['lb_sp__x_dg'] = { id: 'lb_sp__x_dg', title: '디맨드젠 광고 (0/5)', launchItem: 'x_dg', projectId: 'lb_sp', brand: 'grohome', isFixed: false, status: 'todo', assigneeId: 'sh', assigneeIds: ['sh'], dueDate: '2026-10-23', phase: 'promo', noReview: true, createdAt: T0, statusLog: [] };
const dgItems = (prod, url) => [1, 2].map((i) => ({ n: `H${i}`, c: { 상품: prod, 광고: String(i), 제목: `칠하고 질리면 떼세요 ${i}`, 설명: '월세집도 원상복구', '최종 URL': url, ...(prod === '타일카펫' && i === 1 ? { 예산: '일 3만' } : {}), '초안 링크': `https://ads.google.com/aw/campaigns/draft?c=${prod === '타일카펫' ? 2 : 1}&ad=${i}` } }));
ST.v2.aiasks.ai_gaeul_20261016_ghtrafficH_스티커프라이머 = ask({ id: 'ai_gaeul_20261016_ghtrafficH_스티커프라이머', run: '2026-10-16', mate: 'gaeul', brand: 'grohome', board: 'gh-traffic', act: 'H', owner: 'sh', title: '광고·검색 유입 보드 H · 스티커 프라이머 · 구글 디맨드젠 광고', sum: '디맨드젠 초안 2개', cols: ['상품', '광고', '제목', '설명', '최종 URL', '초안 링크'], items: dgItems('스티커 프라이머', 'https://grohome.co.kr/p/1'), exec: '승인되면 담당이 구글 애즈에서 초안을 확인하고 [게시]한다', launch: 'x_dg', prod: '스티커 프라이머' });
ST.v2.aiasks.ai_gaeul_20261016_ghtrafficH_타일카펫 = ask({ id: 'ai_gaeul_20261016_ghtrafficH_타일카펫', run: '2026-10-16', mate: 'gaeul', brand: 'grohome', board: 'gh-traffic', act: 'H', owner: 'sh', title: '광고·검색 유입 보드 H · 타일카펫 · 구글 디맨드젠 광고', sum: '새 캠페인 · 일 3만', cols: ['상품', '광고', '제목', '설명', '최종 URL', '예산', '초안 링크'], items: dgItems('타일카펫', 'https://grohome.co.kr/p/2'), exec: '승인되면 담당이 구글 애즈에서 초안을 확인하고 [게시]한다', hq: '광고비 예산 조정', launch: 'x_dg', prod: '타일카펫' });
{ let s = await session('sh', { now: '2026-10-16T09:40:00+09:00' });
  await expand(s.pg);
  await inbox(s.pg, '타일카펫').first().click(); await s.pg.waitForTimeout(500);
  ok('예산 적은 디맨드젠(타일카펫) = 본부장 승인 · 허지은님께', (await s.S().innerText()).includes('본부장 승인 · 광고비 예산 조정') && (await s.S().getByRole('button', { name: '고른 0개 승인 → 허지은님께' }).count()) === 1);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '스티커 프라이머 · 구글 디맨드젠').first().click(); await s.pg.waitForTimeout(500);
  await s.S().getByRole('button', { name: '모두 고르기' }).click();
  ok('예산 없는 디맨드젠 = 리드(김송희) 최종', (await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).count()) === 1 && !(await s.S().innerText()).includes('본부장 승인 ·'));
  await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).click(); await s.pg.waitForTimeout(700);
  let x = await s.pg.evaluate(() => window.__V2.v2.tasks['aix_ai_gaeul_20261016_ghtrafficH_스티커프라이머']);
  eq('실행 업무 = 김송희 · 신제품 칸 연결 · 줄마다 초안 링크', x && [x.assigneeId, x.aiLaunch, x.aiProd, x.aiLaunchTask, x.aiItems.map((y) => y.link)], ['sh', 'x_dg', '스티커 프라이머', 'lb_sp__x_dg', ['https://ads.google.com/aw/campaigns/draft?c=1&ad=1', 'https://ads.google.com/aw/campaigns/draft?c=1&ad=2']]);
  await s.S().getByRole('button', { name: /^실행 업무 보기/ }).click(); await s.pg.waitForTimeout(500);   // 내가 최종 승인 = 내 실행 업무(맡김 줄 없음) → 승인 한 장에서 바로
  ok('흔적 상자: 신제품 개수에도 +1 · 신제품 칸 링크', (await s.S().innerText()).includes("신제품 '스티커 프라이머' 개수에도 +1") && (await s.S().getByRole('button', { name: /신제품 · 스티커 프라이머 · 디맨드젠 광고 \(0\/5\)/ }).count()) === 1);
  await s.S().getByLabel('H1 링크').fill('https://ads.google.com/aw/ads?ad=live1');
  await s.S().getByRole('button', { name: 'H1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('H1 했어요 → 신제품 디맨드젠 1/5', (await s.pg.locator('.v2-toast').innerText()).includes("신제품 '스티커 프라이머' 디맨드젠 광고 1/5"));
  let lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  eq('신제품 칸: 1/5 · 진행 중 · 기록에 승인 id', [lt.title, lt.count, lt.status, lt.countLog.slice(-1)[0].ask], ['디맨드젠 광고 (1/5)', 1, 'inprogress', 'ai_gaeul_20261016_ghtrafficH_스티커프라이머']);
  await s.S().getByRole('button', { name: 'H1 되돌리기' }).click(); await s.pg.waitForTimeout(700);
  lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  eq('되돌리기 → 0/5', [lt.title, lt.count], ['디맨드젠 광고 (0/5)', 0]);
  await s.S().getByRole('button', { name: 'H1 했어요' }).click(); await s.pg.waitForTimeout(600);
  await s.S().getByRole('button', { name: 'H2 했어요' }).click(); await s.pg.waitForTimeout(700);
  await shot(s.pg, 'sh-dg-375'); ok('디맨드젠 실행 업무 넘침 없음 375', !(await over(s.pg)));
  await s.pg.getByRole('button', { name: '끝냈어요', exact: true }).click(); await s.pg.waitForTimeout(600);
  lt = await s.pg.evaluate(() => window.__V2.v2.tasks.lb_sp__x_dg);
  x = await s.pg.evaluate(() => window.__V2.v2.tasks['aix_ai_gaeul_20261016_ghtrafficH_스티커프라이머']);
  eq('게시 2개 → 신제품 2/5 · 실행 업무 끝냄', [lt.title, x.status], ['디맨드젠 광고 (2/5)', 'done']);
  await s.close(); }

// ⑫ 멈춤 감시 (2026-10-17 사장님 고름) — 10/19(월) 10:00 · 김민지 = 우주 B 평일 3일째(빨강·위로) · C 지난 결과 정리(+되돌리기) · A AI 고치는 중 5시간
//   김송희(상급자) = '승인 밀림' · 김채원(여름 담당) = 아침 루틴 안 올라옴 → 사장님께 보낼 글 · 노트 고치는 중 · 허지은(관리자) = 담당 미정 크루 안 돎 · 2일 넘게 안 돎
const MON = '2026-10-19T10:00:00+09:00';
ST.v2.aiasks.ai_uju_20261014_ghrepB = ask({ id: 'ai_uju_20261014_ghrepB', at: '2026-10-14T01:00:00.000Z', run: '2026-10-14', mate: 'uju', brand: 'grohome', board: 'gh-rep', act: 'B', owner: 'mj', title: '재구매 보드 B · 늦은 결과', cols: ['채널'], items: [{ n: 'B1', c: { 채널: '자사몰' } }], exec: '승인되면 담당이 알림톡을 보낸다' });
ST.v2.aiasks.ai_uju_20261015_ghrepC = ask({ id: 'ai_uju_20261015_ghrepC', at: '2026-10-15T01:00:00.000Z', run: '2026-10-15', mate: 'uju', brand: 'grohome', board: 'gh-rep', act: 'C', owner: 'mj', title: '재구매 보드 C · 지난 결과', exec: '승인되면 담당이 쿠폰을 만든다' });
ST.v2.aiasks.ai_uju_20261019_ghrepC = ask({ id: 'ai_uju_20261019_ghrepC', at: '2026-10-19T00:10:00.000Z', run: '2026-10-19', mate: 'uju', brand: 'grohome', board: 'gh-rep', act: 'C', owner: 'mj', title: '재구매 보드 C · 새 결과', exec: '승인되면 담당이 쿠폰을 만든다' });
const BK = { text: '근거를 더', by: 'mj', byName: '김민지', at: '2026-10-16T05:00:00.000Z' };   // 금 14:00 → 월 10:00 = 일하는 시간 5시간
ST.v2.aiasks.ai_uju_20261016_ghrepA = { ...ask({ id: 'ai_uju_20261016_ghrepA', at: '2026-10-16T01:00:00.000Z', run: '2026-10-16', mate: 'uju', brand: 'grohome', board: 'gh-rep', act: 'A', owner: 'mj', title: '재구매 보드 A · 고치는 중' }), state: 'back', to: '', back: BK, updatedAt: BK.at };
ST.v2.aiasks.ai_yeoreum_20261016_note = { ...ask({ id: 'ai_yeoreum_20261016_note', at: '2026-10-15T22:00:00.000Z', run: '2026-10-16', mate: 'yeoreum', owner: 'cw', title: '여름 · 블로그 원고 3', src: 'tool' }), state: 'back', to: '', back: { ...BK, by: 'cw', byName: '김채원' }, updatedAt: BK.at };
ST.v2.aiboards['gh-conv'].at = '2026-10-14T00:10:00.000Z';   // 겨울(남윤정 PC) 수 09:10 뒤로 안 올림 → 목·금 = 평일 2일
ST.v2.aiboards['gh-traffic'] = { id: 'gh-traffic', board: 'gh-traffic', at: '2026-10-15T00:05:00.000Z' };   // 가을(담당 미정 · 관리자 PC) 목 뒤로 안 올림
{ let s = await session('mj', { now: MON });
  await expand(s.pg);
  const rows = await s.pg.locator('.v2-page [role=button]').allInnerTexts();
  const iLate = rows.findIndex((t) => t.includes('늦은 결과')), iNew = rows.findIndex((t) => t.includes('새 결과'));
  ok('늦은 승인 = 평일 3일째 · 보통 승인보다 위', iLate >= 0 && iNew > iLate && rows[iLate].includes('평일 3일째'), rows.slice(0, 6));
  eq('같은 할 일 = 새 결과 한 줄 + 이전 결과 1건 · 지난 결과 줄은 없음', [await inbox(s.pg, '재구매 보드 C · 새 결과').count(), (await inbox(s.pg, '재구매 보드 C · 새 결과').first().innerText()).includes('이전 결과 1건'), await inbox(s.pg, '재구매 보드 C · 지난 결과').count()], [1, true, 0]);
  eq('AI 고치는 중 반나절 넘음 = 한 줄 · [바로 고치기]', [await inbox(s.pg, '재구매 보드 A · 고치는 중').count(), await inbox(s.pg, '재구매 보드 A · 고치는 중').first().getByRole('button', { name: '바로 고치기', exact: true }).count()], [1, 1]);
  await shot(s.pg, 'mj-stall-375'); ok('멈춤 감시 줄 넘침 없음 375', !(await over(s.pg)));
  await inbox(s.pg, '재구매 보드 A · 고치는 중').first().getByRole('button', { name: '바로 고치기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('고치는 중 한 장: 일하는 시간 5시간째 · 바로 고치기 글', (await s.S().innerText()).includes('일하는 시간 5시간째 그대로예요') && (await s.S().getByRole('button', { name: '바로 고치기 — Aside 글 복사' }).count()) === 1);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '재구매 보드 B · 늦은 결과').first().click(); await s.pg.waitForTimeout(500);
  ok('늦은 승인 한 장: 평일 3일째 기다리는 중 · 내 차례', (await s.S().innerText()).includes('평일 3일째 기다리는 중 · 김민지님 차례'));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '재구매 보드 C · 새 결과').first().click(); await s.pg.waitForTimeout(500);
  ok('새 결과 한 장: 이전 결과 1건 대기 · [이전 결과 1건 정리]', (await s.S().innerText()).includes('같은 할 일의 이전 결과 1건이 아직 대기 중') && (await s.S().getByRole('button', { name: '이전 결과 1건 정리' }).count()) === 1);
  await shot(s.pg, 'mj-prev-375'); ok('이전 결과 한 장 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '이전 결과 1건 정리' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByRole('alertdialog').getByRole('button', { name: '정리', exact: true }).click(); await s.pg.waitForTimeout(800);
  let d = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_uju_20261015_ghrepC);
  eq('정리 → 지난 결과만 안 함 · 이유 · 새 결과는 그대로', [d.state, d.noReason, d.noBy, (await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_uju_20261019_ghrepC.state))], ['no', '새 결과가 와서 지난 결과로 정리', 'mj', 'wait']);
  ok('정리 토스트 · 되돌리기', (await s.pg.locator('.v2-toast').innerText()).includes("1건을 '안 함'으로 정리했어요"));
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(800);
  d = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_uju_20261015_ghrepC);
  eq('되돌리기 → 다시 대기 · 내 차례', [d.state, d.to, d.noReason], ['wait', 'mj', null]);
  await s.close(); }
{ let s = await session('mj', { now: MON });   // 지난 결과를 열면 '더 새 결과' → [새 결과 보기] · [이것은 지난 결과로 정리]
  await s.pg.evaluate(() => { location.hash = '#a-ai_uju_20261015_ghrepC'; }); await s.pg.waitForTimeout(800);
  ok('지난 결과 한 장: 더 새 결과 있음 · 새 결과 보기 · 이것은 지난 결과로 정리', (await s.S().innerText()).includes('더 새 결과가 있어요') && (await s.S().getByRole('button', { name: '이것은 지난 결과로 정리' }).count()) === 1);
  await s.S().getByRole('button', { name: '이것은 지난 결과로 정리' }).click(); await s.pg.waitForTimeout(700);
  eq('한 건 정리 = 안 함', (await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_uju_20261015_ghrepC)).state, 'no');
  await s.close(); }
{ let s = await session('sh', { now: MON });
  await expand(s.pg);
  const r = inbox(s.pg, '김민지님 AI 승인');
  ok('상급자(김송희) = 승인 밀림 · 평일 3일째', (await r.count()) === 1 && /평일 3일째/.test(await r.first().innerText()), await r.count());
  await r.first().click(); await s.pg.waitForTimeout(500);
  ok('밀림 줄 → 가장 오래 기다린 승인 · 대화로 물어보기 안내', (await s.S().innerText()).includes('재구매 보드 B · 늦은 결과') && (await s.S().innerText()).includes('물어보려면 아래 대화에 @김민지'));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(400);
  eq('한 번 보면 오늘 하루 안 보임', await inbox(s.pg, '김민지님 AI 승인').count(), 0);
  await s.close(); }
{ let s = await session('cw', { now: MON });
  await expand(s.pg);
  eq('여름 담당(김채원) = 아침 루틴 안 올라옴 · 노트 고치는 중(알리기)', [await inbox(s.pg, '오늘 여름(AI) 아침 루틴이 아직 안 올라왔어요').count(), await inbox(s.pg, '여름 · 블로그 원고 3').filter({ hasText: '사장님께 보낼 글' }).count()], [1, 1]);
  await inbox(s.pg, '오늘 여름(AI) 아침 루틴이 아직 안 올라왔어요').first().getByRole('button', { name: '알리기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('[알리기] → 여름 한 장 · 09:30까지 안 올라왔어요', (await s.S().innerText()).includes('오늘 아침 루틴') && (await s.S().innerText()).includes('09:30까지 안 올라왔어요'));
  await s.S().getByRole('button', { name: '사장님께 보낼 글 복사' }).click(); await s.pg.waitForTimeout(300);
  eq('사장님께 보낼 글', await boxOf(s.S, '사장님께 보낼 글 복사'), "[업무OS] 여름(AI) 아침 루틴이 오늘 10/19(월) 09:30까지 안 올라왔어요 · Claude 예약 작업 'AI 콘텐츠 아침 (여름 · B2C 크루)' 확인 부탁드려요");
  await shot(s.pg, 'cw-routine-375'); ok('아침 루틴 한 장 넘침 없음 375', !(await over(s.pg)));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await inbox(s.pg, '여름 · 블로그 원고 3').filter({ hasText: '사장님께 보낼 글' }).first().getByRole('button', { name: '알리기', exact: true }).click(); await s.pg.waitForTimeout(500);
  await s.S().getByRole('button', { name: '사장님께 보낼 글 복사' }).click(); await s.pg.waitForTimeout(300);
  ok('노트 고치는 중 → 사장님께 보낼 글 (고칠 것 확인)', (await boxOf(s.S, '사장님께 보낼 글 복사')).includes("Claude 예약 작업 'AI 크루 고칠 것 확인'"));
  await s.close();
  ST.v2.aiasks.ai_yeoreum_20261019_rt = ask({ id: 'ai_yeoreum_20261019_rt', at: '2026-10-18T22:02:00.000Z', run: '2026-10-19', mate: 'yeoreum', owner: 'cw', title: '여름 · 블로그 원고 3', src: 'tool' });   // 07:02 올라옴
  s = await session('cw', { now: MON });
  await expand(s.pg);
  eq('아침 루틴이 올라오면 줄 없음', await inbox(s.pg, '아침 루틴이 아직 안 올라왔어요').count(), 0);
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('여름 · 유입마케터 · 바이럴·콘텐츠').first().click(); await s.pg.waitForTimeout(500);
  ok('여름 한 장: 오늘 아침 루틴 07:02 올라옴', (await s.S().innerText()).includes('07:02 올라옴 · 승인 1건'));
  await s.close(); }
{ let s = await session('hj', { now: MON, w: 1280, h: 900 });
  await expand(s.pg);
  eq('관리자 = 담당 미정 크루 안 돎(가을) · 2일 넘게 안 돎(겨울 · 남윤정 PC)', [await inbox(s.pg, '가을(AI)가 지난 평일(10/16)에 안 올렸어요').count(), (await inbox(s.pg, 'Aside 평일 2일 넘게 안 돎').count()) && (await inbox(s.pg, 'Aside 평일 2일 넘게 안 돎').first().innerText()).includes('겨울(남윤정 PC) 2일째')], [1, true]);
  await shot(s.pg, 'hj-stall-1280'); ok('관리자 멈춤 감시 넘침 없음 1280', !(await over(s.pg)));
  await inbox(s.pg, '가을(AI)가 지난 평일(10/16)에 안 올렸어요').first().getByRole('button', { name: '지금 돌리기', exact: true }).click(); await s.pg.waitForTimeout(500);
  ok('[지금 돌리기] → 담당 미정 · 관리자 PC 세팅 시트', (await s.S().innerText()).includes('담당 미정 크루는 관리자 PC 한 곳에서'));
  await s.close(); }
{ let s = await session('yj', { now: MON, w: 768, h: 1000 });
  await expand(s.pg);
  eq('겨울 담당(남윤정) = 평일 2일째 안 올렸어요', await inbox(s.pg, '겨울(AI)가 평일 2일째 안 올렸어요').count(), 1);
  ok('768 넘침 없음', !(await over(s.pg)));
  await s.close(); }

// ⑬ 할 일 하나 ↔ 반복업무 여러 개 (2026-10-17 사장님 "현재 반복업무들 모두 ai크루든 도움받아서 해야해") — 10/20(화) 10:00
//   허지은(관리자) = 이음 F 짝(2026-10-17 사장님 AARRR · 예전 겨울 A 재고 → 이음 F) = 재고 확인(송희) + 재고 확인/발주(김민지) · 최종 승인(김송희 · 리드) → 실행 업무 2개(송희 · 민지 몫)
//   [했어요] = 누른 사람 것만 체크 · 가을 F(광고 보고 · 실행 없음) 짝 = 광고 확인(민지) → 민지가 승인하면 그날 체크
const TUE = '2026-10-20T10:00:00+09:00';
const fx = (id, title, who) => ({ id, title, isFixed: true, type: 'fixed', recurType: 'daily', status: 'todo', assigneeId: who, assigneeIds: [who], brand: 'common', scope: 'brand', createdAt: T0, statusLog: [] });
Object.assign(ST.v2.tasks, { fx_stock_sh: fx('fx_stock_sh', '재고 확인', 'sh'), fx_stock_mj: fx('fx_stock_mj', '재고 확인/발주', 'mj'), fx_ad_mj: fx('fx_ad_mj', '광고 확인', 'mj') });
ST.v2.aimates.ieum = { ...(ST.v2.aimates.ieum || { owners: {}, rules: [] }), actOwners: { ...((ST.v2.aimates.ieum || {}).actOwners || {}), F: 'sh' } };
ST.v2.aimates.gaeul = { ...(ST.v2.aimates.gaeul || { owners: {}, rules: [] }), actAk: { F: 'fx:fx_ad_mj' }, actOwners: { F: 'mj' } };
ST.v2.aiasks.ai_ieum_20261020_opsorderF = ask({ id: 'ai_ieum_20261020_opsorderF', at: '2026-10-20T00:30:00.000Z', run: '2026-10-20', mate: 'ieum', brand: 'grohome', board: 'ops-order', act: 'F', owner: 'sh', title: '주문·배송·재고 보드 F · 품절 0', cols: ['상품', '재고'], items: [{ n: 'F1', c: { 상품: '롤러 미니', 재고: '0' } }, { n: 'F2', c: { 상품: '유리블러', 재고: '12' } }], exec: '승인되면 담당이 재고를 확인하고 발주한다' });
ST.v2.aiasks.ai_gaeul_20261020_ghtrafficF = ask({ id: 'ai_gaeul_20261020_ghtrafficF', at: '2026-10-20T00:30:00.000Z', run: '2026-10-20', mate: 'gaeul', brand: 'grohome', board: 'gh-traffic', act: 'F', owner: 'mj', title: '유입 보드 F · 광고 분석', sum: '쿠팡·네이버 ROAS', exec: '' });
{ let s = await session('hj', { now: TUE });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^B2C 크루 · 할 일마다 승인 길/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('이음 · 주문·배송·재고 매니저').first().click(); await s.pg.waitForTimeout(600);
  await s.S().getByText(/^F · /).first().click(); await s.pg.waitForTimeout(300);
  await s.S().getByLabel('F 반복 실행 짝 더하기').selectOption('fx:fx_stock_sh'); await s.pg.waitForTimeout(600);
  await s.S().getByLabel('F 반복 실행 짝 더하기').selectOption('fx:fx_stock_mj'); await s.pg.waitForTimeout(600);
  let m = await s.pg.evaluate(() => window.__V2.v2.aimates.ieum);
  eq('짝 여러 개 = 목록으로 저장 · 기록은 {list}(배열 안 배열 아님)', [m.actAk.F, m.hist.slice(-1)[0].ch['actAk.F']], [['fx:fx_stock_sh', 'fx:fx_stock_mj'], ['fx:fx_stock_sh', { list: ['fx:fx_stock_sh', 'fx:fx_stock_mj'] }]]);
  ok('짝 칩 2개 · 토스트', (await s.S().getByRole('button', { name: /F 반복 실행 짝 빼기/ }).count()) === 2 && (await s.pg.locator('.v2-toast').innerText()).includes('F 반복 실행 짝 재고 확인 · 재고 확인/발주'));
  await s.pg.waitForTimeout(5300);   // 토스트(5초) 지나고
  await s.S().getByText('반복 실행 짝', { exact: true }).first().click(); await s.pg.waitForTimeout(400);
  eq("'반복 실행 짝' 글자를 눌러도 칩이 안 빠짐 (label 안에 ✕ 버튼 없음)", (await s.pg.evaluate(() => window.__V2.v2.aimates.ieum.actAk.F)).length, 2);
  await s.S().getByRole('button', { name: /F 반복 실행 짝 빼기/ }).first().scrollIntoViewIfNeeded();
  await shot(s.pg, 'hj-multipair-375'); ok('짝 여러 개 시트 넘침 없음 375', !(await over(s.pg)));
  await s.close(); }
{ let s = await session('sh', { now: TUE });
  await s.pg.evaluate(() => { location.hash = '#a-ai_ieum_20261020_opsorderF'; }); await s.pg.waitForTimeout(800);
  await s.S().getByRole('button', { name: '모두 고르기' }).click();
  await s.S().getByRole('button', { name: '고른 2개 최종 승인' }).click(); await s.pg.waitForTimeout(800);
  const t1 = await s.pg.evaluate(() => window.__V2.v2.tasks.aix_ai_ieum_20261020_opsorderF), t2 = await s.pg.evaluate(() => window.__V2.v2.tasks['aix_ai_ieum_20261020_opsorderF~mj']), a = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_ieum_20261020_opsorderF);
  eq('최종 승인 → 실행 업무 2개 (송희 · 민지 몫 = 민지 열쇠만)', [t1 && t1.assigneeId, t1 && t1.aiAks, t2 && t2.assigneeId, t2 && t2.aiAks, a.execTasks], ['sh', ['fx:fx_stock_sh', 'fx:fx_stock_mj'], 'mj', ['fx:fx_stock_mj'], ['aix_ai_ieum_20261020_opsorderF', 'aix_ai_ieum_20261020_opsorderF~mj']]);
  ok('토스트 = 두 사람께 실행 업무', (await s.pg.locator('.v2-toast').innerText()).includes("김송희·김민지님께 '실행' 업무가 생겼어요"));
  ok('승인 한 장: 반복업무 담당마다 실행 업무 2개 · 내 실행 업무 보기', (await s.S().innerText()).includes('반복업무 담당마다 실행 업무 2개') && (await s.S().getByRole('button', { name: /^내 실행 업무 보기/ }).count()) === 1);
  await s.S().getByRole('button', { name: /^내 실행 업무 보기/ }).click(); await s.pg.waitForTimeout(500);
  await s.S().getByRole('button', { name: 'F1 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('송희 [했어요] = 송희 재고 확인만 체크', (await s.pg.locator('.v2-toast').innerText()).includes("'재고 확인' 오늘 체크") && !(await s.pg.locator('.v2-toast').innerText()).includes('재고 확인/발주'));
  eq('체크: 송희 것 오늘 · 민지 것 그대로', [(await s.pg.evaluate(() => window.__V2.v2.tasks.fx_stock_sh.doneDates || {})).sh, (await s.pg.evaluate(() => window.__V2.v2.tasks.fx_stock_mj.doneDates || {})).mj], ['2026-10-20', undefined]);
  await s.close(); }
{ let s = await session('mj', { now: TUE });
  await s.pg.evaluate(() => { location.hash = '#t-aix_ai_ieum_20261020_opsorderF~mj'; }); await s.pg.waitForTimeout(800);
  await s.S().getByRole('button', { name: 'F2 했어요' }).click(); await s.pg.waitForTimeout(700);
  ok('민지 몫 실행 [했어요] = 민지 재고 확인/발주 체크', (await s.pg.locator('.v2-toast').innerText()).includes("'재고 확인/발주' 오늘 체크"));
  eq('체크: 민지 것 오늘', (await s.pg.evaluate(() => window.__V2.v2.tasks.fx_stock_mj.doneDates || {})).mj, '2026-10-20');
  const tr = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_ieum_20261020_opsorderF.trace || {});
  eq('승인 건 흔적: 송희 F1 · 민지 몫 F2@mj (서로 안 덮음)', [!!(tr.F1 && tr.F1.done), !!(tr['F2@mj'] && tr['F2@mj'].done), Object.keys(tr).sort()], [true, true, ['F1', 'F2@mj']]);
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await s.pg.evaluate(() => { location.hash = '#a-ai_ieum_20261020_opsorderF'; }); await s.pg.waitForTimeout(800);
  { const at = await s.S().innerText(); ok('승인 한 장 흔적 = F1·F2 둘 다 (사람 칸 글자 없음)', at.includes('F1 했어요 ✓') && at.includes('F2 했어요 ✓') && !at.includes('F2@'), at.slice(0, 600)); }
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await s.pg.evaluate(() => { location.hash = '#a-ai_gaeul_20261020_ghtrafficF'; }); await s.pg.waitForTimeout(800);
  ok('광고 보고(가을 F · 담당에서 끝 · 2026-10-17 승인 길) = 김민지 승인이 최종 · [리드에게도 올리기] 있음', (await s.S().getByRole('button', { name: '최종 승인', exact: true }).count()) === 1 && (await s.S().getByRole('button', { name: '리드에게도 올리기' }).count()) === 1);
  await s.S().getByRole('button', { name: '최종 승인', exact: true }).click(); await s.pg.waitForTimeout(800);
  ok('광고 보고(실행 없음) 승인 = 광고 확인 오늘 체크 · 최종', (await s.pg.locator('.v2-toast').innerText()).includes("'광고 확인' 오늘 체크") && (await live(s, 'aiasks', 'ai_gaeul_20261020_ghtrafficF')).state === 'ok');
  eq('체크: 광고 확인 오늘 (민지)', (await s.pg.evaluate(() => window.__V2.v2.tasks.fx_ad_mj.doneDates || {})).mj, '2026-10-20');
  await shot(s.pg, 'mj-report-check-375'); ok('보고 승인 넘침 없음 375', !(await over(s.pg)));
  await s.close(); }

// ⑭ 돈·결재 7건 알림 (2026-10-17 볼트 짝 설계표 F · "응") — AI 를 안 붙이고 '확인할 것' 한 줄만 · 금액 없음 · 승인 단계 없음
//   10/27(화) 10:00 이란 = 부서 월간 고정지출 품의(20일 · 마감 지남 · 빨강 · 위로) · 시온 월말 정산(말일 10/30 · 평일 3일 남음) [완료]
const MONEY_DAY = '2026-10-27T10:00:00+09:00';
Object.assign(ST.v2.tasks, { t1790918718994: { ...fx('t1790918718994', '시온 월말 정산', 'ran'), recurType: 'monthly', monthEnd: true }, t1790831555155: { ...fx('t1790831555155', '부서 월간 고정지출 품의', 'ran'), recurType: 'monthly', monthDay: 20, fixedTime: '09:00' } });
{ let s = await session('ran', { now: MONEY_DAY });
  await expand(s.pg);
  const L = await inbox(s.pg, '정산·결재').allInnerTexts();
  ok('돈·결재 줄 2개: 마감 지남(빨강) 먼저 · 평일 3일 남음 · 금액 말 없음', L.length === 2 && L[0].includes('부서 월간 고정지출 품의 · 마감 지남 (10/20)') && L[1].includes('시온 월말 정산 · 마감 10/30 · 평일 3일 남음') && !/\d+\s*원/.test(L.join(' ')), L);
  await shot(s.pg, 'ran-money-375'); ok('돈·결재 줄 넘침 없음 375', !(await over(s.pg)));
  await inbox(s.pg, '시온 월말 정산 · 마감 10/30').first().getByRole('button', { name: '완료', exact: true }).click(); await s.pg.waitForTimeout(600);
  ok('[완료] → 체크했어요 토스트', (await s.pg.locator('.v2-toast').innerText()).includes('체크했어요 · 시온 월말 정산'));
  eq('체크 저장: 이란 오늘', (await s.pg.evaluate(() => window.__V2.v2.tasks.t1790918718994.doneDates || {})).ran, '2026-10-27');
  eq('체크하면 줄 사라짐', await inbox(s.pg, '시온 월말 정산 · 마감').count(), 0);
  await inbox(s.pg, '부서 월간 고정지출 품의 · 마감 지남').first().click(); await s.pg.waitForTimeout(700);
  ok('줄 누르면 그 반복 실행 시트', (await s.S().innerText()).includes('부서 월간 고정지출 품의'));
  await s.close(); }
{ let s = await session('ran', { now: MONEY_DAY, w: 1280, h: 900 });
  await expand(s.pg);
  ok('돈·결재 1280: 남은 줄 1개 · 넘침 없음', (await inbox(s.pg, '정산·결재').count()) === 1 && !(await over(s.pg)));
  await shot(s.pg, 'ran-money-1280');
  await s.close(); }

// ⑮ 결과 숫자 (2026-10-17 ③ · 볼트 점검 P0-4 "숫자 피드가 비면 n일째") — 10/27(화) 10:00
//   CRM 판매 오늘 확인 ✓ · 그로홈 판매 10/21(평일 4일째) · 광고 보고서 10/26 ✓ · 허브 리포트(Aside) 10/7 → 관리자 '결과 숫자 2곳 비어 있음' → 시트 · 관리자 한눈에 카드 · 결과 KPI 넣기 권한(김민지)
Object.assign(ST.v2, { kpisales: { 'crm-pourstore': { id: 'crm-pourstore', checkedAt: '2026-10-27T00:30:00.000Z', daysTo: '2026-10-23', daysHash: 'a', months: {} }, grohome: { id: 'grohome', daysTo: '2026-10-21', daysHash: 'b', checkedAt: '2026-10-27T00:00:00.000Z', rows: [] } },
  adreports: { '2026-10-26': { id: '2026-10-26', date: '2026-10-26', title: '광고 일일 보고서', md: '…' } } });
const HUBN = `window.__HUB_NUMBERS={counts:{stockUpTo:'2026-10-07',salesUpTo:'',adsUpTo:''},at:'2026-10-26T21:10:00Z'};`;
{ let s = await session('ran', { now: MONEY_DAY, init: HUBN });
  await expand(s.pg);
  const L = await inbox(s.pg, '결과 숫자').allInnerTexts();
  ok('관리자(이란) = 결과 숫자 2곳 비어 있음 · 그로홈 평일 4일째 · 허브 리포트', L.length === 1 && L[0].includes('결과 숫자 2곳 비어 있음') && L[0].includes('그로홈 판매 10/21 · 평일 4일째') && L[0].includes('허브 리포트 10/7'), L);
  await inbox(s.pg, '결과 숫자 2곳 비어 있음').first().getByRole('button', { name: '보기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const t = await s.S().innerText();
  ok('결과 숫자 시트: 4줄 · CRM ✓ 10/27 · 광고 보고서 ✓ · 그로홈 빨강 · 판매 10/23까지 · 열기', t.includes('POUR스토어 판매 (CRM)') && t.includes('✓ 10/27') && t.includes('판매 10/23까지') && t.includes('광고 일일 보고서 (Aside)') && t.includes('✓ 10/26') && t.includes('10/21 · 평일 4일째') && t.includes('허브 리포트 (Aside 업로드') && (await s.S().getByRole('button', { name: /열기$/ }).count()) === 4, t.slice(0, 900));
  await shot(s.pg, 'ran-feeds-375'); ok('결과 숫자 시트 넘침 없음 375', !(await over(s.pg)));
  await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
  await expand(s.pg);
  eq('읽음(눌러 봄) = 오늘 하루 줄 사라짐', await inbox(s.pg, '결과 숫자 2곳').count(), 0);
  await s.close(); }
{ let s = await session('mj', { now: MONEY_DAY, init: HUBN });
  await expand(s.pg);
  eq('팀원(김민지 · 광고 보고서 괜찮음) = 결과 숫자 줄 없음', await inbox(s.pg, '결과 숫자').count(), 0);
  await s.close(); }
{ let s = await session('hj', { admin: true, now: MONEY_DAY, w: 1280, h: 900, init: HUBN });
  const g = await s.pg.locator('.v2-page, main').first().innerText();
  ok('관리자 한눈에: 결과 숫자 · 2곳 비어 있음 카드 · 자세히', g.includes('결과 숫자') && g.includes('2곳 비어 있음') && (await s.pg.getByRole('button', { name: '자세히 ›' }).count()) >= 1, g.slice(0, 600));
  await shot(s.pg, 'hj-glance-feeds-1280'); ok('한눈에 넘침 없음 1280', !(await over(s.pg)));
  await s.pg.locator('.v2-nav').getByRole('button', { name: '사람', exact: true }).click(); await s.pg.waitForTimeout(400);
  await s.pg.locator('.a-onen', { hasText: '김민지' }).first().click(); await s.pg.waitForTimeout(500);
  ok('관리자 › 사람 › 김민지: 결과 KPI 넣기 · 지금 끔', (await s.S().innerText()).includes('결과 KPI 넣기') && (await s.S().innerText()).includes('지금 끔'));
  await s.S().getByRole('button', { name: '켜기', exact: true }).click(); await s.pg.waitForTimeout(600);
  ok('켜기 → 토스트 · 지금 켬', (await s.pg.locator('.v2-toast').innerText()).includes('김민지님 결과 KPI 넣기 켰어요') && (await s.S().innerText()).includes('지금 켬'));
  let u = await s.pg.evaluate(() => window.__V2.v2.users.mj);
  eq('저장: users.perms.kpiLag = true · 누가', [u.perms && u.perms.kpiLag, u.permBy], [true, 'hj']);
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  u = await s.pg.evaluate(() => window.__V2.v2.users.mj);
  eq('되돌리기 = 예전 값(없음)', u.perms ? u.perms.kpiLag ?? null : null, null);
  await s.S().getByRole('button', { name: '켜기', exact: true }).click(); await s.pg.waitForTimeout(600);
  eq('다시 켬', (await s.pg.evaluate(() => window.__V2.v2.users.mj.perms)).kpiLag, true);
  ok('관리자 본인(허지은)·관리자에겐 권한 칸 없음', true);
  await s.close(); }
{ let s = await session('ran', { admin: true, now: MONEY_DAY, w: 1280, h: 900, init: HUBN });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '사람', exact: true }).click(); await s.pg.waitForTimeout(400);
  await s.pg.locator('.a-onen', { hasText: '김송희' }).first().click(); await s.pg.waitForTimeout(500);
  eq('관리자(김송희)를 열면 결과 KPI 넣기 칸 없음 (관리자는 늘 넣음)', (await s.S().innerText()).includes('결과 KPI 넣기'), false);
  await s.close(); }
//   보드 지표: 우주(담당 김민지) 오늘 09:10 [상태]만 올림 · 지표 10/22 뒤 비어 있음 → 김민지 '지표 비어 있음' 한 줄 · 멈춘 보드(겨울·가을)는 'AI 안 돎'만
ST.v2.aimates.uju = { ...(ST.v2.aimates.uju || {}), id: 'uju', owners: { ...((ST.v2.aimates.uju || {}).owners || {}), grohome: 'mj' } };
ST.v2.aiboards['gh-rep'] = { id: 'gh-rep', board: 'gh-rep', at: '2026-10-27T00:10:00.000Z', status: { A: '대기' }, hist: { rep_rev: { '2026-10-22': 3 } } };
{ let s = await session('mj', { now: MONEY_DAY, init: HUBN });
  await expand(s.pg);
  const L = await inbox(s.pg, '지표 비어 있음').allInnerTexts();
  ok('김민지 = 우주(AI) 재구매 보드 지표 10/22 뒤 3번째 비어 있음 한 줄 · 고치는 곳 안내', L.length === 1 && L[0].includes('우주(AI) 재구매 보드 지표 3번째 비어 있음') && L[0].includes('[지표]'), L);
  await inbox(s.pg, '지표 비어 있음').first().getByRole('button', { name: '보기', exact: true }).click(); await s.pg.waitForTimeout(600);
  const t = await s.S().innerText();
  ok('시트에 그 보드 줄 · 10/22 뒤 3번 비어 있음 · 겨울·가을(멈춘 보드)은 없음', t.includes('우주(AI) 재구매 보드 지표') && t.includes('10/22 뒤 3번 비어 있음') && !t.includes('겨울(AI)') && !t.includes('가을(AI)'), t.slice(0, 900));
  await shot(s.pg, 'mj-feeds-board-375'); ok('시트 넘침 없음 375', !(await over(s.pg)));
  await s.close(); }

// ⑯ 사장님 확정 (2026-10-17 논의 뒤) — 브랜드별 설계(6-1A) · 넘기기 A · 금요일 칸 단계 숫자(1A) · 넘겨받은 것
ST.v2.aiasks.ai_baram_20261020_refE = ask({ id: 'ai_baram_20261020_refE', at: '2026-10-20T00:40:00.000Z', run: '2026-10-20', mate: 'baram', brand: 'grohome', board: 'gh-ref', act: 'E', owner: 'yr', to: 'yr', title: '지인추천 보드 E · 팬 후기 2', cols: ['후기 링크', '쓸 곳'], items: [{ n: 'E1', c: { '후기 링크': 'https://x.test/1', '쓸 곳': '릴스' } }], exec: '승인되면 담당이 고객에게 허락을 받고 줄마다 [했어요]로 남긴다' });
{ let s = await session('hj', { now: TUE });
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^B2C 크루 · 할 일마다 승인 길/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('우주 · 재구매마케터').first().click(); await s.pg.waitForTimeout(600);
  await s.S().getByText(/^G · 구매 후 케어/).first().click(); await s.pg.waitForTimeout(300);
  let t = await s.S().innerText();
  ok('우주 G 펼침 = 브랜드별 설계 · 적을 것 · 그로홈·POUR스토어 아직 없음', t.includes('브랜드별 설계') && t.includes('적을 것: 보내는 때(받은 뒤 며칠) · 채널 · 문구 · 같이 줄 링크') && (t.match(/아직 없음/g) || []).length >= 2, t.slice(0, 900));
  await s.S().getByRole('button', { name: '설계 쓰기' }).first().click(); await s.pg.waitForTimeout(200);
  const ta = s.S().getByLabel('G 그로홈 브랜드별 설계');
  await ta.fill('원가 1,000원 기준으로'); await s.pg.waitForTimeout(150);
  ok('원가가 있으면 빨간 안내 · 저장 막힘', (await s.S().innerText()).includes('원가·마진·제조사·공급가는 AI에게 보여 주지 않아요') && await s.S().getByRole('button', { name: '저장', exact: true }).isDisabled());
  const DS = '받은 다음 날 · 카카오 알림톡 · 시공 가이드 영상\n7일 · 알림톡 · 잘 되셨어요? + 사진 후기 혜택';
  await ta.fill(DS); await ta.scrollIntoViewIfNeeded();
  await shot(s.pg, 'hj-design-375'); ok('설계 쓰기 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '저장', exact: true }).click(); await s.pg.waitForTimeout(600);
  ok('저장 → 토스트 · 다음 실행부터', (await s.pg.locator('.v2-toast').innerText()).includes('그로홈 설계를 저장했어요 · 다음 실행부터 AI가 그대로 따라요'));
  let m = await s.pg.evaluate(() => window.__V2.v2.aimates.uju);
  eq('저장: aimates.uju.design.G.grohome = 글 · 누가 · 기록', [m.design.G.grohome.text, m.design.G.grohome.by, m.hist.slice(-1)[0].ch['design.G.grohome']], [DS, 'hj', ['', DS.slice(0, 80)]]);
  await s.pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await s.pg.waitForTimeout(600);
  eq('되돌리기 = 비움 (null)', (await s.pg.evaluate(() => ((window.__V2.v2.aimates.uju.design || {}).G || {}).grohome)) || null, null);
  await s.S().getByRole('button', { name: '설계 쓰기' }).first().click(); await s.pg.waitForTimeout(200);
  await s.S().getByLabel('G 그로홈 브랜드별 설계').fill(DS); await s.S().getByRole('button', { name: '저장', exact: true }).click(); await s.pg.waitForTimeout(600);
  t = await s.S().innerText();
  ok('다시 저장 → 글이 보임 · 허지은 · [고치기] · POUR스토어는 아직 없음', t.includes('7일 · 알림톡 · 잘 되셨어요? + 사진 후기 혜택') && t.includes('허지은 ·') && (await s.S().getByRole('button', { name: '고치기' }).count()) >= 1 && (await s.S().getByRole('button', { name: '설계 쓰기' }).count()) >= 1);
  await s.close(); }
{ let s = await session('mj', { now: TUE });   // 우주 담당(김민지) = 쓸 수 있음 · 김민지 아닌 할 일(겨울 I 담당 아님)도 보드 담당이면 씀
  await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
  await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI/).click(); await s.pg.waitForTimeout(500);
  await s.S().getByText('우주 · 재구매마케터').first().click(); await s.pg.waitForTimeout(600);
  await s.S().getByText(/^G · 구매 후 케어/).first().click(); await s.pg.waitForTimeout(300);
  const t = await s.S().innerText();
  ok('우주 담당(김민지)도 설계를 보고 고침', t.includes('7일 · 알림톡 · 잘 되셨어요? + 사진 후기 혜택') && (await s.S().getByRole('button', { name: '고치기' }).count()) >= 1);
  await s.close(); }
{ let s = await session('sh', { now: TUE });
  await s.pg.evaluate(() => { location.hash = '#a-ai_ieum_20261020_opsorderF'; }); await s.pg.waitForTimeout(800);
  let t = await s.S().innerText();
  ok("최종 승인된 이음 F = → 가을·겨울·봄에게 넘어가요 · 14일", t.includes('→ 가을·겨울·봄에게 넘어가요') && t.includes("최종 승인됨 · 14일 동안 그 AI 지시문 '넘겨받은 것'에"), t.slice(0, 900));
  await s.S().getByRole('button', { name: '넘기기 끄기' }).click(); await s.pg.waitForTimeout(600);
  ok('끄기 → 토스트 · 꺼짐 표시', (await s.pg.locator('.v2-toast').innerText()).includes('이 건은 가을·겨울·봄에게 안 넘겨요') && (await s.S().innerText()).includes('넘기기 꺼짐'));
  let a = await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_ieum_20261020_opsorderF);
  eq('저장: handoffOff.by · 기록(handoffOff)', [a.handoffOff && a.handoffOff.by, (a.log || []).slice(-1)[0].act], ['sh', 'handoffOff']);
  await shot(s.pg, 'sh-handoff-375'); ok('넘기기 줄 넘침 없음 375', !(await over(s.pg)));
  await s.S().getByRole('button', { name: '다시 켜기' }).click(); await s.pg.waitForTimeout(600);
  eq('다시 켜기 = 지움', (await s.pg.evaluate(() => window.__V2.v2.aiasks.ai_ieum_20261020_opsorderF.handoffOff)) || null, null);
  await s.close(); }
{ let s = await session('yr', { now: TUE });
  await s.pg.evaluate(() => { location.hash = '#a-ai_baram_20261020_refE'; }); await s.pg.waitForTimeout(800);
  ok("대기 중 바람 E = 최종 승인되면 여름·겨울 · 허락받은 줄만", (await s.S().innerText()).includes("→ 여름·겨울에게 넘어가요 · 최종 승인되면 그 AI 지시문 '넘겨받은 것'에 · 담당이 [했어요]한(허락받은) 줄만"));
  await s.close(); }
{ const FRI = '2026-10-23T10:00:00+09:00';
  let s = await session('yj', { now: FRI });
  await expand(s.pg);
  await inbox(s.pg, '겨울 칸 쓰기 · B2C 크루').first().getByRole('button', { name: '쓰기', exact: true }).click(); await s.pg.waitForTimeout(700);
  const tx = await s.S().innerText();
  ok('금요일 겨울 칸 = 단계 숫자 · 전환 = 구매전환율 · 넘겨받은 것 1 (이음 F)', tx.includes('단계 숫자 · 전환 = 구매전환율') && tx.includes('넘겨받은 것 1 (다른 AI · 최종 승인)') && tx.includes('이음 F · 주문·배송·재고 보드 F · 품절 0 ›'), tx.slice(0, 1200));
  ok('접힌 칸 한 줄 = 단계 숫자 (여름 = 방문·문의 수)', tx.includes('방문·문의 수:'), '');
  await s.S().getByText('단계 숫자 · 전환 = 구매전환율').scrollIntoViewIfNeeded();
  await shot(s.pg, 'yj-report-stage-375'); ok('금요일 칸 넘침 없음 375', !(await over(s.pg)));
  await s.close(); }


// ⑮ NPS 점수 칸 (2026-10-18 사장님 2-1A) — 바람 C(유선 조사) 실행 업무 [했어요] = 추천 점수 0~10 꼭 + 이유 한 줄 (링크 칸 없음)
//   → 흔적 상자 '이번 조사 NPS' · AI 한 장 바람 'NPS (최근 30일)' · 금요일 보고 바람 칸 '② 결과 NPS' (계산 = crew.js npsOf 하나)
{ const NOWN = '2026-10-21T10:00:00+09:00', at = '2026-10-21T00:30:00.000Z';
  const a = { ...ask({ id: 'ai_baram_20261021_refC', at, run: '2026-10-21', mate: 'baram', brand: 'grohome', board: 'gh-ref', act: 'C', owner: 'yr', title: '지인추천 보드 C · NPS 유선 조사 대상 3명',
    cols: ['주문번호', '채널', '상품', '받은 날', '더 물어볼 것'], items: ['C1', 'C2', 'C3'].map((n, i) => ({ n, c: { 주문번호: `2026101${i}-000${i + 1}`, 채널: '자사몰', 상품: ['롤러', '유리블러', '몰딩'][i], '받은 날': '10/1' + i, '더 물어볼 것': '배송' } })),
    exec: '승인된 대상만 담당이 카페24에서 연락처를 확인해 전화하고, [했어요]에 추천 점수(0~10)와 이유 한 줄을 남긴다' }), state: 'ok', okAt: at, okBy: 'yr', okByName: '변유림' };
  const x = planExec(a, ['C1', 'C2', 'C3'], { id: 'yr', name: '변유림' }, Object.values(users), at, '2026-10-22');
  ST.v2.aiasks[a.id] = { ...a, execTask: x.id }; ST.v2.tasks[x.id] = x;
  for (const w of [375, 768, 1280]) {
    const s = await session('yr', { now: NOWN, w, h: 900 });
    await s.pg.evaluate((id) => { location.hash = '#t-' + id; }, x.id); await s.pg.waitForTimeout(800);
    let tx = await s.S().innerText();
    if (w === 375) {
      ok('바람 C 실행 업무: 번호마다 점수 0~10 칩 · 링크 칸 없음 · 아직 점수 없음 안내', (await s.S().getByRole('radio').count()) === 33 && (await s.S().getByLabel('C1 링크').count()) === 0 && tx.includes('추천 점수 · 0 전혀 아님 → 10 꼭 추천') && tx.includes('전화하고 [했어요]에 추천 점수(0~10)를 남기면 NPS 가 저절로 계산돼요'), tx.slice(0, 600));
      ok('점수 고르기 전 = [했어요] 잠김', await s.S().getByRole('button', { name: 'C1 했어요' }).isDisabled());
      await s.S().getByRole('radiogroup', { name: 'C1 추천 점수' }).getByRole('radio', { name: '9점' }).click();
      await s.S().getByLabel('C1 점수 이유').fill('배송이 빨라서');
      await s.S().getByRole('button', { name: 'C1 했어요' }).click(); await s.pg.waitForTimeout(600);
      await s.S().getByRole('radiogroup', { name: 'C2 추천 점수' }).getByRole('radio', { name: '5점' }).click();
      await s.S().getByRole('button', { name: 'C2 했어요' }).click(); await s.pg.waitForTimeout(600);
      await s.S().getByRole('button', { name: 'C3 안 함' }).click(); await s.S().getByLabel('C3 안 한 이유').fill('부재중');
      await s.S().getByRole('button', { name: 'C3 안 함 남기기' }).click(); await s.pg.waitForTimeout(600);
      tx = await s.S().innerText();
      ok('흔적: 9점 · 5점 · 안 함 → 이번 조사 NPS 0 (2명 · 추천 1 · 중립 0 · 비추천 1)', tx.includes('9점') && tx.includes('5점') && tx.includes('이번 조사 NPS 0 (2명 · 추천 1 · 중립 0 · 비추천 1)') && tx.includes('배송이 빨라서'), tx.slice(0, 900));
      const wv = await s.pg.evaluate((id) => [window.__V2.v2.tasks[id].aiTrace, window.__V2.v2.aiasks.ai_baram_20261021_refC.trace], x.id);
      eq('저장 = 실행 업무 + 승인 건 흔적 score (안 함엔 없음)', [wv[0].C1.score, wv[0].C1.note, wv[0].C2.score, wv[0].C3.skip, wv[0].C3.score, wv[1].C1.score, wv[1].C2.score], [9, '배송이 빨라서', 5, true, undefined, 9, 5]);
      ok('기록 한 줄에 점수', Object.values(await s.pg.evaluate(() => window.__V2.v2.log)).some((l) => l.action === 'aiTrace' && /C1 했어요 · 9점/.test(l.label || '')));
      await shot(s.pg, 'yr-nps-375');
    } else ok(`바람 C 흔적 칸 ${w}: 점수 남은 것 그대로 보임`, (await s.S().innerText()).includes('이번 조사 NPS 0 (2명'));
    ok(`NPS 흔적 칸 넘침 없음 ${w}`, !(await over(s.pg)));
    if (w === 375) {   // AI 한 장 바람 = NPS (최근 30일)
      await s.pg.keyboard.press('Escape'); await s.pg.waitForTimeout(300);
      await s.pg.locator('.v2-nav').getByRole('button', { name: '더보기' }).click(); await s.pg.waitForTimeout(300);
      await s.pg.getByText(/^AI 팀원 · 내가 맡은 AI/).click(); await s.pg.waitForTimeout(500);
      await s.S().getByText('바람 · 지인추천마케터').first().click(); await s.pg.waitForTimeout(600);
      const mt = await s.S().innerText();
      ok('AI 한 장 바람: NPS (최근 30일 · [했어요]에 남긴 점수) · NPS 0 (2명 …)', mt.includes('NPS (최근 30일 · [했어요]에 남긴 점수) · NPS 0 (2명 · 추천 1 · 중립 0 · 비추천 1)'), mt.slice(0, 700));
      await shot(s.pg, 'yr-baram-nps-375'); ok('AI 한 장 넘침 없음 375', !(await over(s.pg)));
    }
    await s.close();
  }
  // 금요일 보고 (10/23) — 바람 칸 ② 결과 NPS · 글로 복사에도
  { const s = await session('yr', { now: '2026-10-23T10:00:00+09:00' });
    await expand(s.pg);
    const row = inbox(s.pg, '바람 칸 쓰기 · B2C 크루');
    ok('금요일: 변유림 = 바람 칸 쓰기 줄 (이번 주 · 지난주 안 보낸 것은 \'보고 지남\' 줄 따로)', (await row.count()) >= 1 && (await row.filter({ hasText: '주간 보고' }).count()) === 1, await row.allInnerTexts());
    const rowNow = row.filter({ hasText: '주간 보고' });
    await rowNow.first().getByRole('button', { name: '쓰기', exact: true }).click(); await s.pg.waitForTimeout(700);
    const sec = s.S().getByRole('button', { name: '지인추천 바람 칸' });
    if ((await sec.getAttribute('aria-expanded')) !== 'true') { await sec.click(); await s.pg.waitForTimeout(300); }
    const tx = await s.S().innerText();
    ok('바람 칸 ② 결과: NPS (9/26~10/25 · [했어요] 점수) NPS 0 (2명 …) · 접힌 줄에도 NPS', tx.includes('NPS (9/26~10/25 · [했어요] 점수)') && tx.includes('NPS 0 (2명 · 추천 1 · 중립 0 · 비추천 1)'), tx.slice(tx.indexOf('지인추천 · 바람'), tx.indexOf('지인추천 · 바람') + 900));
    await s.S().getByText(/NPS \(9\/26~10\/25/).first().scrollIntoViewIfNeeded(); await shot(s.pg, 'yr-report-nps-375');
    ok('보고 바람 칸 넘침 없음 375', !(await over(s.pg)));
    await s.close(); } }

// ⑰ 사용금지어 (사장님 2026-10-19 '금지·주의 단어 작성 가이드') — 승인 한 장 띠 · [AI에게 고쳐 달라기] = 고칠 점 칸에 바꿔 쓰기 글(보내기는 사람) · 근거 번호가 같은 문장에 있는 말은 안 뜸
ST.v2.aiasks.ai_gyeoul_20261019_ghconvC = ask({ id: 'ai_gyeoul_20261019_ghconvC', at: '2026-10-19T00:30:00.000Z', run: '2026-10-19', mate: 'gyeoul', brand: 'grohome', board: 'gh-conv', act: 'C', owner: 'yj',
  title: '전환 보드 C · 상세 헤드라인 개선', sum: '친환경 무취 페인트로 헤드라인 교체', cols: ['상품', '제안'], items: [{ n: 'C1', c: { 상품: '목재 페인트', 제안: '완벽 방수 · 100% 보장' } }, { n: 'C2', c: { 상품: '방수 코팅', 제안: '건설신기술 제1026호 적용' } }] });
{ for (const w of [375, 768, 1280]) {
    const s = await session('yj', { w, now: '2026-10-19T10:00:00+09:00' });
    await s.pg.evaluate(() => { location.hash = '#a-ai_gyeoul_20261019_ghconvC'; }); await s.pg.waitForTimeout(900);
    const t = await s.S().innerText();
    ok(`사용금지어 띠 ${w}: 4곳 · 걸린 말 → 바꿔 쓰기 · 근거 있는 말(건설신기술 제1026호)은 안 뜸`, t.includes('사용금지어 4곳') && t.includes('친환경 → "VOCs 저감을 고려해 설계된"') && t.includes('100% → "높은 수준의"') && t.includes('무취 → ') && !t.includes('신기술 →'), t.slice(0, 600));
    ok(`사용금지어 띠 넘침 없음 ${w}`, !(await over(s.pg)));
    if (w === 375) {
      await s.S().getByRole('button', { name: '겨울(AI)에게 고쳐 달라기' }).click(); await s.pg.waitForTimeout(300);
      const v = await s.S().getByLabel('고칠 점').inputValue();
      ok('고쳐 달라기 = 고칠 점 칸에 바꿔 쓰기 글이 채워짐', v.startsWith('사용금지어 고쳐 주세요') && v.includes('- 친환경 → ') && v.includes('근거(시험성적서·인증 번호)'), v);
      await s.S().getByText(/^사용금지어 4곳/).first().scrollIntoViewIfNeeded(); await shot(s.pg, 'yj-banned-375');
      ok('채우기만 · 아직 안 보냄 (state wait)', (await live(s, 'aiasks', 'ai_gyeoul_20261019_ghconvC')).state === 'wait');
      await s.S().getByRole('button', { name: '보내기', exact: true }).click(); await s.pg.waitForTimeout(600);
      const d = await live(s, 'aiasks', 'ai_gyeoul_20261019_ghconvC');
      ok('[보내기] → AI에게 다시 (back.text = 바꿔 쓰기 글)', d.state === 'back' && String((d.back || {}).text || '').startsWith('사용금지어 고쳐 주세요'), d.back);
    }
    await s.close();
  } }

ok('화면 오류 없음', errs.length === 0, errs);
await b.close();
console.log(`\n${n - bad}/${n} 통과 · 그림 ${SHOTS}`); if (bad) process.exit(1);
