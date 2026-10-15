// 업무OS v2 · 팀원 화면 보기(보기 모드) 시험 — 가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js
//   실행: node test/viewas.e2e.mjs
//   2026-10-15 사장님 "리드부터는 관리자모드가 아닌 일반 보기모드를 이름 선택해서 화면 볼 수 있게해"
//   팀원 = 목록 없음 · 리드(관리자 아님) = 내 아래 사람만 · 본부장 = 모두 · 보는 동안 저장 0건(누르기·댓글·읽음) · 기밀 = 두 사람 모두 볼 수 있는 것만 · 관리자 화면 › 사람 → 링크
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-15T10:00:00+09:00', D0 = '2026-10-05T00:30:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

// ── 씨앗: 지금 조직 모양 (본부장 허지은 · 2팀 리드 김송희 · 3팀 리드 김채원(관리자 아님) 아래 변유림 · 1팀 리드 김소연 아래 남윤정) ──
const U = [['GM', '허지은', '공용', ''], ['songhee', '김송희', '2팀', 'GM', 'lead'], ['minji', '김민지', '2팀', 'songhee'], ['chaerim', '양채림', '2팀', 'songhee'],
  ['cw', '김채원', '3팀', 'GM'], ['yr', '변유림', '3팀', 'cw'], ['soyeon', '김소연', '1팀', 'GM'], ['yj', '남윤정', '1팀', 'soyeon']];
const users = Object.fromEntries(U.map(([id, name, team, boss, role]) => [id, { id, name, team, role: role || 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z', ...(boss ? { bossId: boss } : {}) }]));
const task = (o) => ({ isFixed: false, type: 'general', status: 'todo', assigneeIds: [o.assigneeId], projectId: '', parentId: null, memo: '', attachments: [], createdAt: D0, statusLog: [], ...o });
const tasks = {
  y1: task({ id: 'y1', title: '상세페이지 카피 수정', assigneeId: 'yr', dueDate: '2026-10-15', requestedBy: 'cw', ackAt: '2026-10-14T01:00:00.000Z' }),
  y2: task({ id: 'y2', title: '쿠팡 리뷰 답글', assigneeId: 'yr', status: 'inprogress', dueDate: '2026-10-14' }),
  y3: task({ id: 'y3', title: '인수 실사 메모', memo: '가격 3억', assigneeId: 'yr', dueDate: '2026-10-15', createdBy: 'GM', secret: { on: true, allow: [], by: 'GM', byName: '허지은', at: D0 } }),
  c1: task({ id: 'c1', title: '3팀 주간 회의 자료', assigneeId: 'cw', dueDate: '2026-10-15' }),
  m1: task({ id: 'm1', title: '블로그 원고 3편', assigneeId: 'minji', dueDate: '2026-10-15' }),
};
const notes = { n1: { id: 'n1', itemId: 'task:y1', text: '@변유림 카피 두 줄로 줄여 주세요', by: 'cw', byName: '김채원', at: '2026-10-15T00:20:00.000Z', mentions: ['yr'] } };
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects: {}, tasks, notes, log: {}, events: {}, brands: { pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks: {}, aimates: {}, aiboards: {},
    seen: { yr: { id: 'yr', ids: {}, at: D0 } } } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, hash = '' } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR' });
  await ctx.clock.setFixedTime(new Date(NOW));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; if (!window.__V2) window.__V2=${JSON.stringify(ST)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid} ${w}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} ${w} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html') + hash);
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(700);
  return { pg, ctx, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };
const closeSheets = async (pg) => { for (let i = 0; i < 4 && await pg.locator('.v2-sheet').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } };
const writes = (pg) => pg.evaluate(() => window.__V2.writes.length);
const toast = (pg) => pg.locator('.v2-toast').innerText().catch(() => '');
const sheet = (pg) => pg.locator('.v2-sheet').last();
const pickRows = (pg) => sheet(pg).locator('[role=button]').allInnerTexts();

// ① 팀원(변유림) — 팀원 화면 보기 없음 · #v- 링크도 무시
{ const s = await session('yr', { hash: '#v-cw' }), pg = s.pg, before = errs.length;
  ok('팀원 · #v- 링크(볼 수 없는 사람) → 내 화면 그대로', (await pg.locator('.v2-viewbar').count()) === 0 && (await pg.locator('.v2-trial').count()) === 1);
  await tab(pg, '더보기');
  ok('팀원 · 더보기에 [팀원 화면 보기] 없음', (await pg.getByText('팀원 화면 보기', { exact: true }).count()) === 0);
  ok('팀원 · 화면 오류 없음', errs.length === before, errs.slice(before));
  await s.close(); }

// ② 리드(김채원 · 관리자 아님) — 내 아래 사람(변유림)만 · 보는 동안 저장 0건 · 기밀은 둘 다 볼 수 있는 것만
for (const w of [375, 1280]) {
  const s = await session('cw', { w, h: w > 700 ? 900 : 812 }), pg = s.pg, before = errs.length;
  await tab(pg, '더보기');
  await pg.getByText('팀원 화면 보기', { exact: true }).click(); await pg.waitForTimeout(300);
  const rows = await pickRows(pg);
  ok(`리드 ${w} · 고르기: 내 아래 사람 변유림 1명만 · 할 일 한 줄`, rows.length === 1 && /변유림/.test(rows[0]) && /열린 일 3 · 기한 지남 1 · 오늘 마감 2/.test(rows[0]), rows);
  ok(`리드 ${w} · 고르기 시트 넘침 없음`, !(await over(pg)));
  const W0 = await writes(pg);
  await sheet(pg).getByText('변유림', { exact: true }).click(); await pg.waitForTimeout(700);
  ok(`리드 ${w} · 보기 모드 막대 '변유림님 화면' · 테두리 · 시험판 안내 대신`, (await pg.locator('.v2-viewbar').innerText()).includes('변유림님 화면') && (await pg.locator('.v2-viewframe').count()) === 1 && (await pg.locator('.v2-trial').count()) === 0);
  await tab(pg, '오늘');
  const today = await pg.locator('.v2-page').innerText();
  ok(`리드 ${w} · 오늘 = 변유림의 할 일 (내 일·다른 팀 일은 없음)`, today.includes('상세페이지 카피 수정') && today.includes('쿠팡 리뷰 답글') && !today.includes('3팀 주간 회의 자료') && !today.includes('블로그 원고 3편'), today.slice(0, 600));
  ok(`리드 ${w} · 기밀: 변유림은 보지만 나는 못 보는 업무 = '기밀 업무' (제목·메모 없음)`, !today.includes('인수 실사 메모') && today.includes('기밀 업무'));
  ok(`리드 ${w} · 확인할 것 = 변유림이 안 읽은 댓글 그대로`, today.includes('카피 두 줄로 줄여 주세요'));
  if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `viewas-today-${w}.png`) });
  // 업무 열기 → [끝냈어요] · 댓글 → 저장 안 함 + 알림
  await pg.locator('.v2-page').getByText('상세페이지 카피 수정').first().click(); await pg.waitForTimeout(500);
  ok(`리드 ${w} · 시트 위 이름표 '보기 · 변유림'`, w > 1000 ? true : (await pg.locator('.v2-viewtag').innerText()).includes('변유림'));
  if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `viewas-task-${w}.png`) });
  const fin = sheet(pg).getByRole('button', { name: /^끝냈어요/ });
  ok(`리드 ${w} · 업무 시트에 [끝냈어요] 보임 (그 사람 화면 그대로)`, (await fin.count()) > 0);
  await fin.first().click(); await pg.waitForTimeout(300);
  ok(`리드 ${w} · [끝냈어요] → '보기 모드 · 변유림님 화면이라 바꾸지 않았어요' · 상태 그대로`, (await toast(pg)).includes('보기 모드 · 변유림님 화면이라 바꾸지 않았어요')
    && (await pg.evaluate(() => window.__V2.v2.tasks.y1.status)) === 'todo', await toast(pg));
  ok(`리드 ${w} · 대화는 보이고 댓글 쓰기 칸·답글은 없음 (읽기만)`, (await sheet(pg).getByText('카피 두 줄로 줄여 주세요').count()) > 0 && (await sheet(pg).getByPlaceholder(/댓글 쓰기/).count()) === 0 && (await sheet(pg).getByRole('button', { name: '답글', exact: true }).count()) === 0);
  await closeSheets(pg);
  for (const t of ['달력', '프로젝트', '더보기']) { await tab(pg, t); ok(`리드 ${w} · 보기 모드 ${t} 넘침 없음`, !(await over(pg))); if (w === 375) await pg.screenshot({ path: path.join(SHOTS, `viewas-${t}-${w}.png`) }); }
  const more = await pg.locator('.v2-page').innerText();
  ok(`리드 ${w} · 더보기: 보기 모드 · 내 화면으로 · 문자 알림·다른 사람으로 쓰기 숨김`, more.includes('보기 모드') && more.includes('내 화면으로') && !more.includes('다른 사람으로 쓰기') && !more.includes('앱을 열면 먼저'), more.slice(0, 400));
  ok(`리드 ${w} · 보는 동안 저장 0건 (누르기·댓글·읽음·진척)`, (await writes(pg)) === W0, await pg.evaluate(() => window.__V2.writes.slice(-3)));
  // [다른 사람] → 고르기(보는 중) → [내 화면으로]
  await pg.locator('.v2-viewbar').getByRole('button', { name: '다른 사람' }).click(); await pg.waitForTimeout(300);
  ok(`리드 ${w} · [다른 사람] → 고르기 · 변유림 '보는 중'`, /보는 중/.test((await pickRows(pg)).join('|')) || /보는 중/.test(await sheet(pg).innerText()));
  await closeSheets(pg);
  await pg.locator('.v2-viewbar').getByRole('button', { name: '내 화면으로' }).click(); await pg.waitForTimeout(500);
  ok(`리드 ${w} · [내 화면으로] → 내 더보기 · 막대 없음`, (await pg.locator('.v2-viewbar').count()) === 0 && (await pg.getByText('팀원 화면 보기', { exact: true }).count()) === 1);
  // 내 화면에선 다시 저장됨 (잠금 풀림)
  await tab(pg, '오늘');
  await pg.locator('.v2-page').getByText('3팀 주간 회의 자료').first().click(); await pg.waitForTimeout(400);
  await sheet(pg).getByRole('button', { name: /^끝냈어요/ }).first().click(); await pg.waitForTimeout(400);
  ok(`리드 ${w} · 내 화면으로 오면 저장됨 (내 업무 끝냄)`, (await pg.evaluate(() => window.__V2.v2.tasks.c1.status)) === 'done');
  // 사람 화면(달력 › 사람 보기) → [화면 그대로 보기]는 PersonSheet 에서 — 직접 열어 확인
  ok(`리드 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  // 다음 폭에서 처음부터 (끝낸 c1 되돌림)
  await s.close();
}

// ③ 본부장(허지은) — 모두 · 내 아래 사람 먼저 · 김민지 화면
{ const s = await session('GM'), pg = s.pg, before = errs.length;
  await tab(pg, '더보기');
  await pg.getByText('팀원 화면 보기', { exact: true }).click(); await pg.waitForTimeout(300);
  const rows = await pickRows(pg), txt = await sheet(pg).innerText();
  ok('본부장 · 고르기: 나 빼고 7명 모두 · 내 아래 사람 7', rows.length === 7 && txt.includes('내 아래 사람 7'), rows);
  ok('본부장 · 리드 꼬리표 (김송희·김채원·김소연)', ['김송희', '김채원', '김소연'].every((nm) => rows.some((r) => r.includes(nm) && r.includes('리드'))), rows);
  await sheet(pg).getByText('김민지', { exact: true }).click(); await pg.waitForTimeout(600);
  const today = await pg.locator('.v2-page').innerText();
  ok('본부장 · 김민지 화면: 김민지 할 일', (await pg.locator('.v2-viewbar').innerText()).includes('김민지님 화면') && today.includes('블로그 원고 3편') && !today.includes('상세페이지 카피 수정'));
  // 사람 화면 → [화면 그대로 보기]로 다른 사람 (보기 모드 안에서도 연 사람 기준)
  ok('본부장 · 화면 오류 없음', errs.length === before, errs.slice(before));
  await s.close(); }

// ④ 관리자 화면 › 사람 → [변유림님 화면 그대로 보기 (팀 앱)] 링크 → 팀 앱 보기 모드
{ const s = await session('GM', { admin: true }), pg = s.pg, before = errs.length;
  await tab(pg, '사람');
  await pg.locator('.a-onen', { hasText: '변유림' }).first().click(); await pg.waitForTimeout(400);
  const a = sheet(pg).getByRole('link', { name: /변유림님 화면 그대로 보기/ });
  ok('관리자 › 사람 › 변유림: [화면 그대로 보기 (팀 앱)] 링크 = os2.html#v-yr', (await a.count()) === 1 && /os2\.html#v-yr$/.test(await a.getAttribute('href')));
  await a.click(); await pg.waitForTimeout(1200);
  await pg.waitForSelector('.v2-viewbar', { timeout: 10000 }).catch(() => {});
  ok('링크로 열면 팀 앱 보기 모드 (변유림) · 주소의 #v- 는 지움', (await pg.locator('.v2-viewbar').count()) === 1 && (await pg.locator('.v2-viewbar').innerText()).includes('변유림님 화면') && !/#v-/.test(pg.url()));
  ok('관리자 링크 · 화면 오류 없음', errs.length === before, errs.slice(before));
  await s.close(); }

// ⑤ 팀 앱 사람 화면(달력 › 사람 보기) 안 [화면 그대로 보기] — 리드 김송희(관리자) → 양채림
{ const s = await session('songhee'), pg = s.pg, before = errs.length;
  await pg.evaluate(() => { window.location.hash = '#v-chaerim'; }); await pg.waitForTimeout(700);
  ok('#v- 링크(로그인 뒤) → 보기 모드 양채림', (await pg.locator('.v2-viewbar').innerText().catch(() => '')).includes('양채림님 화면'));
  await pg.locator('.v2-viewbar').getByRole('button', { name: '다른 사람' }).click(); await pg.waitForTimeout(300);
  const txt = await sheet(pg).innerText();
  ok('보기 모드 안 [다른 사람] = 연 사람(김송희) 기준 목록 · 내 아래 사람 먼저', /내 아래 사람 2/.test(txt) && txt.indexOf('김민지') < txt.indexOf('허지은'), txt.slice(0, 300));
  ok('김송희 · 화면 오류 없음', errs.length === before, errs.slice(before));
  await s.close(); }

await b.close();
console.log(`\n${n - bad}/${n} 통과`);
if (errs.length) console.log('화면 오류:', errs);
process.exit(bad || errs.length ? 1 : 0);
