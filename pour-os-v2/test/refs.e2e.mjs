// 업무OS v2 · 레퍼런스 공유 · 월 1회 자동 개발 시험 (2026-10-17 사장님 확정 1A~4A · 5A~9A) — 가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js
//   실행: node test/refs.e2e.mjs (SHOTS=폴더)
//   ① 김송희: 더보기 › 레퍼런스 → 링크·글 한 줄 + @김민지 + 캡처 + 종류·브랜드 → [올리기] → 카드 · 375·768·1280 넘침 없음
//   ② 김민지: '확인할 것' 레퍼런스 줄 → 한 장 → AI 핏(내가 담당인 겨울만 · 원가 말 막음) → [빼기]·되돌리기 → 대화 한마디
//   ③ 김송희: 대화 줄 · [고치기](종류 · @남윤정 새로) · [숨기기]·되돌리기 · 남윤정은 고치기·숨기기 없음
//   ④ 프로젝트 자료 탭(오래된 레퍼런스도 연결로 읽음) · [+ 레퍼런스] = 그 프로젝트로 · 업무 [+ 레퍼런스] = 그 업무로
//   ⑤ 관리자: 머리 [레퍼런스] · [종류 고치기] · 좁은 화면 설정 줄
//   ⑥ 이달 개발 목록: 화(목록 뒤) 김송희 '확인할 것' → [이번에·다음 달·안 함] + 한 줄 → [확인] · 안 함 = 요청한 사람 '확인할 것' · 목요일 빨강 · 개발 끝 줄 · 포스트잇 판 한 줄·안 함 칸
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-17T14:00:00+09:00', D0 = '2026-05-01T00:30:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 500)); } };

const U = [['boss', '허지은', '공용', '', true], ['sh', '김송희', '2팀'], ['mj', '김민지', '2팀'], ['yj', '남윤정', '1팀']];
const users = Object.fromEntries(U.map(([id, name, team, , master]) => [id, { id, name, team, role: 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z', ...(master ? { master: true } : { master: false }) }]));
const projects = { p1: { id: 'p1', title: '그로홈 상세 고도화', category: 'marketing', assigneeId: 'yj', collaboratorIds: ['sh'], status: 'active', startDate: '2026-05-01', dueDate: '2026-11-30', brand: 'grohome', createdAt: D0 } };
const tasks = { t1: { id: 't1', title: '상세페이지 시안 정리', isFixed: false, type: 'general', status: 'inprogress', assigneeId: 'yj', assigneeIds: ['yj'], projectId: 'p1', parentId: null, memo: '', dueDate: '2026-10-20', createdAt: '2026-10-10T00:00:00.000Z', statusLog: [] } };
// 오래된 레퍼런스(구독 90일 밖) — 프로젝트 칸이 그 연결로 한 번 더 읽어 보여야 함
const refs = { rfOld: { id: 'rfOld', text: '봄 시즌 상세 첫 화면 참고 https://old.example.com/a', url: 'https://old.example.com/a', files: [], kind: '상세페이지', brand: 'grohome', projectId: 'p1', taskId: '', to: [], toAt: {}, by: 'yj', byName: '남윤정', at: '2026-06-01T01:00:00.000Z', updatedAt: '2026-06-01T01:00:00.000Z', fits: {}, fitMates: [] } };
const aimates = { gyeoul: { id: 'gyeoul', owners: { grohome: 'mj', pourstore: 'mj' } } };
const devreqs = {
  dr1: { id: 'dr1', text: '반복 실행 줄이 너무 길어요', files: [], by: 'mj', byName: '김민지', at: '2026-10-05T01:00:00.000Z', app: 'team', state: 'open', updatedAt: '2026-10-05T01:00:00.000Z' },
  dr2: { id: 'dr2', text: '달력 주 시작을 월요일로', files: [], by: 'yj', byName: '남윤정', at: '2026-10-12T01:00:00.000Z', app: 'team', state: 'open', updatedAt: '2026-10-12T01:00:00.000Z' },
};
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects, tasks, notes: {}, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '1' }, pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '2' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks: {}, aimates, aiboards: {}, refs, devreqs, devplans: {} } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 900, store = null, now = NOW } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.clock.setFixedTime(new Date(now));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  const sent = []; await ctx.route('http://v2.test/send-sms', (r) => { sent.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });   // 문자 = 보낸 척만
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; if (!window.__V2) window.__V2=${store || JSON.stringify(ST)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid}${admin ? ' 관리자' : ''} ${w}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} ${w} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html'));
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector(admin ? '.a-head' : '.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(800);
  return { pg, sent, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const sheetOver = (pg) => pg.evaluate(() => { const s = [...document.querySelectorAll('.v2-sheet')].pop(); return !!s && [...s.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }); });
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };
const closeSheets = async (pg) => { for (let i = 0; i < 5 && await pg.locator('.v2-sheet').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } };
const S = (pg) => pg.locator('.v2-sheet').last();
const store = (pg) => pg.evaluate(() => JSON.stringify(window.__V2));
const doc = (pg, k, id) => pg.evaluate(([k, id]) => (window.__V2.v2[k] || {})[id], [k, id]);
const docs = (pg, k) => pg.evaluate((k) => Object.values(window.__V2.v2[k] || {}), k);
const toast = (pg) => pg.locator('.v2-toast').innerText().catch(() => '');
const inboxText = async (pg) => { const more = pg.locator('.v2-ts.in').getByText(/개 모두 보기/); if (await more.count()) { await more.first().click(); await pg.waitForTimeout(300); } return pg.locator('.v2-ts.in').innerText().catch(() => ''); };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201aa2bd3f80000000049454e44ae426082', 'hex');
const openRefs = async (pg) => { await tab(pg, '더보기'); await pg.getByRole('button', { name: /팀이 같이 보는 참고 자료/ }).first().click(); await pg.waitForTimeout(500); };

// ① 김송희 375: 올리기 (종류 빠지면 안내 · @김민지 · 캡처 · 브랜드) → 카드
let S1;
{ const s = await session('sh'), pg = s.pg;
  await openRefs(pg);
  ok('① 레퍼런스 화면 · 올리기 칸 · 거르기 · 빈 목록 안내 없음(오래된 것은 구독 밖)', (await S(pg).getByLabel('레퍼런스 글').count()) === 1 && (await S(pg).getByRole('group', { name: '종류로 거르기' }).count()) === 1);
  await S(pg).getByLabel('레퍼런스 글').fill('이 상세페이지 첫 화면 https://example.com/p/1 구성만 참고 @김민지 ');
  ok('① @김민지 → 받을 사람 안내', /받을 사람 김민지/.test(await S(pg).innerText()));
  await S(pg).getByRole('button', { name: '올리기', exact: true }).click(); await pg.waitForTimeout(250);
  ok('① 종류 안 고르면 안내 · 저장 안 함', /종류를 골라 주세요/.test(await S(pg).innerText()) && (await docs(pg, 'refs')).length === 1);
  await S(pg).getByRole('group', { name: '종류 고르기' }).getByRole('button', { name: '상세페이지' }).click();
  await S(pg).getByRole('group', { name: '브랜드 고르기' }).getByRole('button', { name: '그로홈' }).click();
  await S(pg).getByLabel('붙일 사진').setInputFiles({ name: 'capture.png', mimeType: 'image/png', buffer: PNG });
  await pg.waitForTimeout(200);
  ok('① 375 · 올리기 칸 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'refs-new-375.png'), fullPage: true });
  await S(pg).getByRole('button', { name: '올리기', exact: true }).click(); await pg.waitForTimeout(700);
  const r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('① 저장: 받을 사람 김민지 · 종류·브랜드 · 링크 뽑기 · 사진 1 · 핏 비어 있음', !!r && r.to.join() === 'mj' && !!r.toAt.mj && r.kind === '상세페이지' && r.brand === 'grohome' && r.url === 'https://example.com/p/1' && r.files.length === 1 && r.fitMates.length === 0, r);
  ok('① 알림: 김민지님 확인할 것에 떠요', /김민지님 '확인할 것'에 떠요/.test(await toast(pg)));
  ok('① 카드: 종류 · 한 줄 · 링크 주소 · 받을 사람', /상세페이지/.test(await S(pg).locator('.v2-rf').first().innerText()) && /example\.com/.test(await S(pg).locator('.v2-rf').first().innerText()) && /→ 김민지/.test(await S(pg).locator('.v2-rf').first().innerText()));
  ok('① 오래된 것(90일 밖)은 목록에 없음 → [이전 것 불러오기]', (await S(pg).locator('.v2-rf').count()) === 1);
  await S(pg).getByRole('button', { name: /이전 것 불러오기/ }).click(); await pg.waitForTimeout(400);
  ok('① [이전 것 불러오기] → 오래된 것까지', (await S(pg).locator('.v2-rf').count()) === 2 && /이전 것까지 다 봤어요/.test(await S(pg).innerText()));
  await S(pg).getByRole('group', { name: '종류로 거르기' }).getByRole('button', { name: '광고 소재' }).click(); await pg.waitForTimeout(200);
  ok('① 종류로 거르기 → 없음 안내', (await S(pg).locator('.v2-rf').count()) === 0 && /맞는 레퍼런스가 없어요/.test(await S(pg).innerText()));
  await S(pg).getByRole('group', { name: '종류로 거르기' }).getByRole('button', { name: '전체' }).click();
  await pg.screenshot({ path: path.join(SHOTS, 'refs-list-375.png'), fullPage: true });
  S1 = await store(pg); await s.close(); }
for (const w of [768, 1280]) { const s = await session('sh', { w, h: 1000, store: S1 }), pg = s.pg;
  await openRefs(pg); await pg.waitForTimeout(300);
  ok(`① ${w} · 레퍼런스 화면 넘침 없음 · 카드 보임`, !(await over(pg)) && !(await sheetOver(pg)) && (await S(pg).locator('.v2-rf').count()) === 1);
  await pg.screenshot({ path: path.join(SHOTS, `refs-list-${w}.png`) });
  await s.close(); }

// ② 김민지 375: '확인할 것' → 한 장 → AI 핏 (겨울만 · 원가 말 막음) → 빼기·되돌리기 → 대화
let S2;
{ const s = await session('mj', { store: S1 }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('② 김민지 확인할 것: 레퍼런스 · 나에게 공유', /레퍼런스/.test(ib) && /나에게 공유했어요/.test(ib) && /이 상세페이지 첫 화면/.test(ib), ib.slice(0, 300));
  await pg.locator('.v2-ts.in').getByText(/이 상세페이지 첫 화면/).first().click(); await pg.waitForTimeout(500);
  const t0 = await S(pg).innerText();
  ok('② 한 장: 글 · 링크 · 받을 사람 · AI 핏 0 · 대화', /example\.com\/p\/1/.test(t0) && /받을 사람 김민지/.test(t0) && /AI 핏 0/.test(t0) && /대화 0/.test(t0), t0.slice(0, 400));
  ok('② 김민지는 고치기·숨기기 없음', (await S(pg).getByRole('button', { name: '고치기', exact: true }).count()) === 0 && (await S(pg).getByRole('button', { name: '숨기기', exact: true }).count()) === 0);
  await S(pg).getByRole('button', { name: '+ AI 핏 남기기' }).click(); await pg.waitForTimeout(250);
  const chips = await S(pg).getByRole('group', { name: '핏 남길 AI' }).getByRole('button').allInnerTexts();
  ok('② 고를 수 있는 AI = 내가 담당인 겨울만 · 상세페이지 = 겨울 골라 둠', chips.join() === '겨울' && (await S(pg).getByRole('group', { name: '핏 남길 AI' }).getByRole('button', { name: '겨울' }).getAttribute('aria-pressed')) === 'true', chips);
  await S(pg).getByLabel('쓸 부분').fill('마진 좋은 구성만');
  ok('② 원가·마진 말 → 막음 · 버튼 꺼짐', /AI가 볼 수 없어요/.test(await S(pg).innerText()) && await S(pg).getByRole('button', { name: '핏 남기기' }).isDisabled());
  await S(pg).getByLabel('쓸 부분').fill('첫 화면 구성과 버튼 위치만 · 색·문구는 쓰지 않음');
  await S(pg).getByRole('button', { name: '핏 남기기' }).click(); await pg.waitForTimeout(500);
  let r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('② 핏 저장: fits.gyeoul · fitMates · 기록', r.fits.gyeoul && r.fits.gyeoul.text.startsWith('첫 화면 구성과 버튼 위치만') && r.fits.gyeoul.by === 'mj' && r.fitMates.join() === 'gyeoul' && (r.fitLog || []).length === 1, r);
  ok('② 알림 · 줄', /겨울 핏을 남겼어요/.test(await toast(pg)) && /쓸 부분 · 첫 화면 구성과 버튼 위치만/.test(await S(pg).innerText()));
  await S(pg).getByRole('button', { name: '겨울 핏 빼기' }).click(); await pg.waitForTimeout(400);
  r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('② [빼기] → fits·fitMates 에서 빠짐', !r.fits.gyeoul && r.fitMates.length === 0);
  await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(400);
  r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('② 되돌리기 → 핏 다시', r.fits.gyeoul && r.fitMates.join() === 'gyeoul');
  await S(pg).getByLabel('댓글').fill('버튼 위치 좋네요 · 다음 상세에 써 볼게요'); await S(pg).getByRole('button', { name: '남기기', exact: true }).click(); await pg.waitForTimeout(500);
  const nt = (await docs(pg, 'notes')).find((x) => String(x.itemId).startsWith('ref:'));
  ok('② 대화 한마디 = 댓글 itemId ref:<id>', !!nt && nt.itemId === 'ref:' + r.id && nt.by === 'mj');
  ok('② 375 · 한 장 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'refs-one-375.png'), fullPage: true });
  await closeSheets(pg);
  ok('② 읽은 뒤 확인할 것에서 사라짐', !/나에게 공유했어요/.test(await inboxText(pg)));
  S2 = await store(pg); await s.close(); }

// ③ 김송희: 대화 줄 → 고치기(종류 · @남윤정) → 숨기기·되돌리기 / 남윤정: 고치기·숨기기 없음 · 새로 부른 줄
let S3;
{ const st2 = JSON.parse(S2); Object.assign(st2.v2.users.mj, { phone: '010-3333-4444', sms: { on: true, weekend: true } });   // @ 문자 확인용 (토요일이라 주말 받음)
  const s = await session('sh', { store: JSON.stringify(st2) }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('③ 김송희 확인할 것: 내 레퍼런스에 단 댓글', /댓글/.test(ib) && /버튼 위치 좋네요/.test(ib), ib.slice(0, 300));
  await pg.locator('.v2-ts.in').getByText(/버튼 위치 좋네요/).first().click(); await pg.waitForTimeout(500);
  ok('③ 댓글 줄 → 그 레퍼런스 한 장', /AI 핏 1/.test(await S(pg).innerText()) && /쓸 부분 · 첫 화면 구성과/.test(await S(pg).innerText()));
  await S(pg).getByRole('button', { name: '고치기', exact: true }).click(); await pg.waitForTimeout(250);
  await S(pg).getByLabel('레퍼런스 글 고치기').fill('이 상세페이지 첫 화면 https://example.com/p/1 구성만 참고 @김민지 @남윤정 ');
  await S(pg).getByRole('group', { name: '종류 바꾸기' }).getByRole('button', { name: '패키지·디자인' }).click();
  await S(pg).getByRole('button', { name: '저장', exact: true }).click(); await pg.waitForTimeout(500);
  let r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('③ 고치기: 종류 · 받을 사람 +남윤정(toAt) · 이전 판 edits', r.kind === '패키지·디자인' && r.to.includes('yj') && !!r.toAt.yj && (r.edits || []).length === 1 && r.edits[0].kind === '상세페이지', r);
  ok('③ 고치기 알림 = 새로 부른 사람만', /남윤정님에게도 알렸어요/.test(await toast(pg)) && !/김민지님에게도/.test(await toast(pg)));
  await S(pg).getByRole('button', { name: '숨기기', exact: true }).click(); await pg.waitForTimeout(400);
  r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('③ [숨기기](그날 · 올린 사람) → removed · 숨김 띠', !!(r.removed && r.removed.by === 'sh') && /숨긴 레퍼런스예요/.test(await S(pg).innerText()));
  await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(400);
  r = (await docs(pg, 'refs')).find((x) => x.by === 'sh');
  ok('③ 되돌리기 → 다시 보임', !r.removed);
  await S(pg).getByLabel('댓글').fill('@김민지 이 버튼 위치로 해 볼까요'); await S(pg).getByRole('button', { name: '남기기', exact: true }).click(); await pg.waitForTimeout(800);
  ok('③ 레퍼런스 대화 @ → 문자 = "레퍼런스 · 종류" (기밀·엉뚱한 링크 아님)', s.sent.length === 1 && /레퍼런스 · 패키지·디자인/.test(s.sent[0].text) && !/기밀/.test(s.sent[0].text) && !/#p-/.test(s.sent[0].text), s.sent);
  S3 = await store(pg); await s.close(); }
{ const s = await session('yj', { store: S3 }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('③ 남윤정: 고치며 새로 부름 → 확인할 것', /나에게 공유했어요/.test(ib), ib.slice(0, 300));
  await pg.locator('.v2-ts.in').getByText(/나에게 공유했어요/).first().click(); await pg.waitForTimeout(500);
  ok('③ 남윤정: 고치기·숨기기·핏 남기기 없음 (올린 사람·관리자·AI 담당 아님)', (await S(pg).getByRole('button', { name: '고치기', exact: true }).count()) === 0 && (await S(pg).getByRole('button', { name: '숨기기', exact: true }).count()) === 0 && (await S(pg).getByRole('button', { name: '+ AI 핏 남기기' }).count()) === 0);
  await s.close(); }

// ④ 프로젝트 자료 탭 · 업무 [+ 레퍼런스]
let S4;
{ const s = await session('yj', { store: S3 }), pg = s.pg;
  await tab(pg, '프로젝트'); await pg.getByText('그로홈 상세 고도화').first().click(); await pg.waitForTimeout(500);
  await S(pg).getByRole('tab', { name: /^자료/ }).click(); await pg.waitForTimeout(600);
  const t0 = await S(pg).innerText();
  ok('④ 프로젝트 자료 탭: 레퍼런스 칸 · 오래된 연결 레퍼런스도 (연결로 한 번 더 읽음)', /레퍼런스 1/.test(t0) && /봄 시즌 상세 첫 화면 참고/.test(t0), t0.slice(0, 300));
  ok('④ 오래된 프로젝트만 연결로 읽음 (projectId == p1)', (await pg.evaluate(() => (window.__V2.fetches || []).filter((f) => f.key === 'refs' && f.w && f.w[0] === 'projectId').length)) === 1);
  await S(pg).getByRole('button', { name: '+ 레퍼런스' }).first().click(); await pg.waitForTimeout(400);
  ok('④ [+ 레퍼런스] → 그 프로젝트로 거른 목록 + 연결이 골라진 올리기 칸', /프로젝트 · 그로홈 상세 고도화 ✕/.test(await S(pg).innerText()) && (await S(pg).getByLabel('프로젝트 연결').inputValue()) === 'p1');
  await S(pg).getByLabel('레퍼런스 글').fill('경쟁 상세 구성표 https://compare.example.com/x');
  await S(pg).getByRole('group', { name: '종류 고르기' }).getByRole('button', { name: '촬영' }).click();
  await S(pg).getByRole('button', { name: '올리기', exact: true }).click(); await pg.waitForTimeout(600);
  ok('④ 프로젝트로 올림 → 그 목록에 바로', (await docs(pg, 'refs')).some((x) => x.projectId === 'p1' && x.kind === '촬영' && x.by === 'yj') && (await S(pg).locator('.v2-rf').count()) === 2);
  await closeSheets(pg); await tab(pg, '프로젝트'); await pg.getByText('그로홈 상세 고도화').first().click(); await pg.waitForTimeout(500);
  await S(pg).getByText('상세페이지 시안 정리').first().click(); await pg.waitForTimeout(500);
  await S(pg).getByRole('button', { name: '이 업무에 레퍼런스 붙이기' }).click(); await pg.waitForTimeout(400);
  ok('④ 업무 [+ 레퍼런스] → 업무 연결 칩', /업무 · 상세페이지 시안 정리 ✕/.test(await S(pg).innerText()));
  await S(pg).getByLabel('레퍼런스 글').fill('시안 색 조합 참고');
  await S(pg).getByRole('group', { name: '종류 고르기' }).getByRole('button', { name: '패키지·디자인' }).click();
  await S(pg).getByRole('button', { name: '올리기', exact: true }).click(); await pg.waitForTimeout(600);
  ok('④ 업무로 올림 (taskId · 그 업무의 프로젝트)', (await docs(pg, 'refs')).some((x) => x.taskId === 't1' && x.projectId === 'p1'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok('④ 업무 화면에 레퍼런스 칸', /레퍼런스 1/.test(await S(pg).innerText()) && /시안 색 조합 참고/.test(await S(pg).innerText()));
  ok('④ 375 · 업무 화면 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  S4 = await store(pg); await s.close(); }

// ⑤ 관리자: 머리 [레퍼런스] · [종류 고치기] · 좁은 화면 설정 줄
{ const s = await session('boss', { admin: true, w: 1280, h: 1000, store: S4 }), pg = s.pg;
  await pg.getByRole('button', { name: '레퍼런스 · 팀이 같이 보는 참고 자료' }).click(); await pg.waitForTimeout(500);
  ok('⑤ 관리자 1280 · 머리 [레퍼런스] → 같은 화면 · 카드', (await S(pg).locator('.v2-rf').count()) >= 3);
  await S(pg).getByRole('button', { name: '종류 고치기' }).click(); await pg.waitForTimeout(200);
  await S(pg).getByLabel('레퍼런스 종류').fill('상세페이지\n광고 소재\n숏폼·릴스\n블로그·콘텐츠\n패키지·디자인\n촬영\n오프라인 홍보물\n기타');
  await S(pg).getByRole('button', { name: '종류 저장' }).click(); await pg.waitForTimeout(400);
  const st = await doc(pg, 'settings', 'refkinds');
  ok('⑤ 종류 고치기 → settings/refkinds · 칩에 바로', st && st.list.includes('오프라인 홍보물') && (await S(pg).getByRole('group', { name: '종류 고르기' }).getByRole('button', { name: '오프라인 홍보물' }).count()) === 1, st);
  ok('⑤ 1280 · 넘침 없음', !(await over(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'refs-admin-1280.png') });
  await s.close(); }
{ const s = await session('boss', { admin: true, w: 375, h: 900, store: S4 }), pg = s.pg;
  await pg.getByRole('button', { name: '설정', exact: true }).click(); await pg.waitForTimeout(400);
  const t = await S(pg).innerText();
  ok('⑤ 관리자 375 · 설정 첫 줄: 레퍼런스 · 개발 수정 요청 · 이달 개발 목록 · 확인하는 사람(기본 김송희)', /레퍼런스/.test(t) && /이달 개발 목록/.test(t) && /지금 김송희 \(기본\)/.test(t), t.slice(0, 400));
  await s.close(); }

// ⑥ 이달 개발 목록 — 화요일(목록 뒤) 김송희 확인 · 목요일 빨강 · 개발 끝
const TUE = '2026-10-27T10:00:00+09:00', THU = '2026-10-29T10:00:00+09:00';
let S6;
{ const s = await session('sh', { now: TUE }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('⑥ 김송희 화: 확인할 것 "10월 개발 목록 2개" [확인하기]', /10월 개발 목록 2개/.test(ib) && /10\/30\(금\)까지/.test(ib), ib.slice(0, 300));
  await pg.locator('.v2-ts.in').getByRole('button', { name: '확인하기', exact: true }).click(); await pg.waitForTimeout(500);
  const t0 = await S(pg).innerText();
  ok('⑥ 이달 개발 목록: 일정 · 포스트잇 2 · [확인] 꺼짐(2개 더)', /10\/26\(월\) 목록 → 10\/30\(금\)까지 김송희님 확인 → 10\/31~11\/1 주말 개발/.test(t0) && (await S(pg).locator('.v2-dp-list .v2-dr').count()) === 2 && await S(pg).getByRole('button', { name: '2개 더 골라 주세요' }).isDisabled(), t0.slice(0, 400));
  const cards = S(pg).locator('.v2-dp-list .v2-dr');
  await cards.nth(0).getByRole('tab', { name: '이번에' }).click();
  await cards.nth(1).getByRole('tab', { name: '안 함' }).click();
  await cards.nth(1).getByLabel('한 줄').fill('달력 설정에 이미 있어요');
  ok('⑥ 375 · 목록 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'devplan-375.png'), fullPage: true });
  await S(pg).getByRole('button', { name: '확인', exact: true }).click(); await pg.waitForTimeout(600);
  const p = await doc(pg, 'devplans', '2026-10'), d1 = await doc(pg, 'devreqs', 'dr1'), d2 = await doc(pg, 'devreqs', 'dr2');
  ok('⑥ [확인] → devplans/2026-10 (확인한 사람 · 고른 것 · 한 줄)', p && p.state === 'ok' && p.confirmedBy === 'sh' && p.items.map((x) => x.id + ':' + x.pick).join() === 'dr1:now,dr2:no' && p.items[1].note === '달력 설정에 이미 있어요', p);
  ok('⑥ 포스트잇: 이번에 = planYm·planPick · 안 함 = state no + 까닭', d1.planYm === '2026-10' && d1.planPick === 'now' && d1.state === 'open' && d2.state === 'no' && d2.noReason === '달력 설정에 이미 있어요' && d2.noBy === 'sh', [d1, d2]);
  ok('⑥ 알림: 주말 개발 · 금요일까지 다시', /10\/31~11\/1 주말에 개발해요/.test(await toast(pg)));
  ok('⑥ 확인 뒤 상태 띠 · [다시 고르기]', /확인함/.test(await S(pg).innerText()) && (await S(pg).getByRole('button', { name: '다시 고르기' }).count()) === 1);
  await closeSheets(pg); await tab(pg, '오늘');
  ok('⑥ 확인하면 확인할 것에서 사라짐', !/개발 목록 2개/.test(await inboxText(pg)));
  S6 = await store(pg); await s.close(); }
{ const s = await session('yj', { now: TUE, store: S6 }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('⑥ 남윤정(요청한 사람): 안 함 · 까닭', /안 함/.test(ib) && /까닭 · 달력 설정에 이미 있어요/.test(ib), ib.slice(0, 300));
  await tab(pg, '더보기'); await pg.getByRole('button', { name: /불편한 점 · 고칠 점을 포스트잇으로/ }).first().click(); await pg.waitForTimeout(500);
  const t = await S(pg).innerText();
  ok('⑥ 포스트잇 판: 월 1회 개발 한 줄 · 열린 것 1(10월 개발 · 이번에) · 안 함 1', /월 1회 개발/.test(t) && /10월 개발 확인함 · 이번에 1개/.test(t) && /열린 것 1/.test(t) && /안 함 1/.test(t) && /10월 개발 · 이번에/.test(t), t.slice(0, 500));
  await S(pg).getByRole('button', { name: /^안 함 1/ }).click(); await pg.waitForTimeout(200);
  ok('⑥ 안 함 칸: 까닭', /까닭 · 달력 설정에 이미 있어요/.test(await S(pg).innerText()));
  ok('⑥ 375 · 포스트잇 판 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  await S(pg).getByRole('button', { name: /^열린 것/ }).click(); await pg.waitForTimeout(200);
  await S(pg).getByRole('button', { name: '이달 개발 목록 보기' }).click(); await pg.waitForTimeout(400);
  ok('⑥ 남윤정(확인하는 사람 아님): 목록은 보기만 (고르기 없음)', (await S(pg).getByRole('tab', { name: '이번에' }).count()) === 0 && /확인함/.test(await S(pg).innerText()));
  await s.close(); }
for (const w of [768, 1280]) { const s = await session('sh', { now: TUE, w, h: 1000 }), pg = s.pg;
  await pg.locator('.v2-ts.in').getByRole('button', { name: '확인하기', exact: true }).click(); await pg.waitForTimeout(500);
  ok(`⑥ ${w} · 이달 개발 목록 넘침 없음`, !(await over(pg)) && !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, `devplan-${w}.png`) });
  await S(pg).getByRole('button', { name: "남은 2개 모두 '이번에'" }).click(); await pg.waitForTimeout(200);
  ok(`⑥ ${w} · [남은 2개 모두 '이번에'] → 다 골라짐 · [확인] 켜짐 (저장은 안 함)`, (await S(pg).locator('[role=tab][aria-selected=true]', { hasText: '이번에' }).count()) === 2 && !(await S(pg).getByRole('button', { name: '확인', exact: true }).isDisabled()) && !(await doc(pg, 'devplans', '2026-10')));
  await s.close(); }
{ const s = await session('sh', { now: THU }), pg = s.pg;
  const first = await pg.locator('.v2-ts.in').innerText().catch(() => '');
  ok('⑥ 목요일 확인 전: 빨강 · 맨 위 · "내일까지"', /10월 개발 목록 2개/.test(first) && /내일까지/.test(first) && first.indexOf('10월 개발 목록') < 80, first.slice(0, 200));
  ok('⑥ 목요일: 확인하는 사람 본인 기기에선 문자 안 보냄 (앱에 빨강 줄)', s.sent.length === 0);
  await s.close(); }
{ // 목요일 문자 한 번 (7A '목요일 한 번 더 알림') — 김송희 번호·문자 켬 · 다른 사람(김민지) 기기가 보냄 · 그 달 한 번만
  const st = JSON.parse(JSON.stringify(ST)); Object.assign(st.v2.users.sh, { phone: '010-1111-2222', sms: { on: true } });
  const s = await session('mj', { now: THU, store: JSON.stringify(st) }), pg = s.pg; await pg.waitForTimeout(1500);
  const rem = await doc(pg, 'settings', 'devplan');
  ok('⑥ 목요일 문자: 김송희 번호로 한 통 · "10월 개발 목록 2개 · 내일(금)까지 확인해 주세요" · remind.2026-10', s.sent.length === 1 && s.sent[0].to === '01011112222' && /10월 개발 목록 2개 · 내일\(금\)까지 확인해 주세요/.test(s.sent[0].text) && !!(rem && rem.remind && rem.remind['2026-10']), [s.sent, rem]);
  const S7 = await store(pg); await s.close();
  const s2 = await session('yj', { now: THU, store: S7 }); await s2.pg.waitForTimeout(1500);
  ok('⑥ 목요일 문자: 다른 기기가 또 열어도 다시 안 보냄 (그 달 한 번)', s2.sent.length === 0);
  await s2.close(); }
{ const st = JSON.parse(S6); st.v2.devplans['2026-10'].devStartedAt = '2026-10-31T00:10:00.000Z'; st.v2.devplans['2026-10'].devDone = { at: '2026-11-01T06:00:00.000Z', summary: '반복 실행 줄을 두 줄로 줄였어요', done: ['dr1'], later: [] };
  Object.assign(st.v2.devreqs.dr1, { state: 'done', doneAt: '2026-11-01T05:00:00.000Z', doneBy: 'claude', doneByName: 'Claude(개발)', reply: '줄을 두 줄로 줄였어요', updatedAt: '2026-11-01T05:00:00.000Z' });
  const SUN = '2026-11-01T18:00:00+09:00';
  { const s = await session('sh', { now: SUN, store: JSON.stringify(st) }), pg = s.pg;
    const ib = await inboxText(pg);
    ok('⑥ 개발 끝: 김송희 "10월 개발 끝 · 반영 1개" + 요약', /10월 개발 끝 · 반영 1개/.test(ib) && /두 줄로 줄였어요/.test(ib), ib.slice(0, 300));
    await pg.locator('.v2-ts.in').getByText(/10월 개발 끝/).first().click(); await pg.waitForTimeout(400);
    ok('⑥ 개발 끝 줄 → 목록(개발 끝 · 요약 · 반영함 ✓)', /개발 끝/.test(await S(pg).innerText()) && /반영함 ✓/.test(await S(pg).innerText()));
    await s.close(); }
  { const s = await session('mj', { now: SUN, store: JSON.stringify(st) }), pg = s.pg;
    const ib = await inboxText(pg);
    ok('⑥ 김민지(요청한 사람): 반영함 · 답', /반영함/.test(ib) && /답 · 줄을 두 줄로 줄였어요/.test(ib), ib.slice(0, 300));
    await s.close(); }
}

console.log(errs.length ? '\n화면 오류:\n' + errs.join('\n') : '\n화면 오류 없음');
await b.close();
console.log(`${n - bad}/${n} 통과`); process.exit(bad || errs.length ? 1 : 0);
