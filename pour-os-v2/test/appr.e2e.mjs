// 업무OS v2 · 구매 품의 요청 시험 — 가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: npx vite build --config test/vite.test.config.js && ADMIN=1 npx vite build --config test/vite.test.config.js
//   실행: node test/appr.e2e.mjs
//   2026-10-16 사용자 "윤미니가 업무OS에서 품의 요청 → 김송희 '확인할 것' → 하이웍스에 옮겨 적고 [품의 완료] → 요청자는 상태를 봄"
//   윤미니 쓰기(요청자 자동 · 담당 기본 김송희) → 김송희 '확인할 것' 품의 요청 n건 · 새 요청(읽음 체계) → [품의 완료](메모) → 윤미니 '품의 완료' 알림 · 내 요청 상태
//   독립 화면에서 쓴 예전 문서(담당 없음) = 김송희 · 담당 바꾸기 → 그 사람 '확인할 것' · 관리자 '나에게 온 것' · 보기 모드 저장 0건 · 375·768·1280 넘침 없음
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-16T10:00:00+09:00';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

const U = [['GM', '허지은', '공용', ''], ['songhee', '김송희', '2팀', 'GM', 'lead'], ['mini', '윤미니', '공용', 'GM'], ['ran', '이란', '2팀', 'songhee']];
const users = Object.fromEntries(U.map(([id, name, team, boss, role]) => [id, { id, name, team, role: role || 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z', ...(boss ? { bossId: boss } : {}) }]));
// 독립 화면(approval-requests.html)에서 예전에 쓴 요청 — 담당 칸 없음 → 김송희로 보여야 함
const old1 = { requester: '윤미니', topic: 'CS', docType: '지출결의서', title: '고객 환불 택배비', body: '- 금액: 4,000원', status: '품의전', doneBy: '', doneAt: null, doneMemo: '', createdAt: '2026-10-14T01:00:00.000Z', updatedAt: '2026-10-14T01:00:00.000Z', deleted: false, deletedAt: null };
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [], appr: { old1 },
  v2: { users, projects: {}, tasks: {}, notes: {}, log: {}, events: {}, brands: { pourstore: { id: 'pourstore', name: 'POUR스토어', active: true, order: '1' } },
    workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks: {}, aimates: {}, aiboards: {} } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 812, store = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR' });
  await ctx.clock.setFixedTime(new Date(NOW));
  await ctx.route(/googleapis|gstatic|firebaseio|firebasestorage/, (r) => r.abort());
  await ctx.route('http://v2.test/**', (r) => { const u = r.request().url(); if (/\.json(\?|$)/.test(u)) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ path: u.includes('admin') ? ADMIN : TEAM, contentType: 'text/html' }); });
  await ctx.addInitScript(`window.__V1_DATA={}; window.__V1_DOCS={}; window.__V1_LAUNCH=[]; if (!window.__V2) window.__V2=${store || JSON.stringify(ST)};`);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${uid} ${w}: ${e.message.slice(0, 300)}`));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|holidays/.test(m.text())) errs.push(`${uid} ${w} console: ${m.text().slice(0, 300)}`); });
  await pg.goto('http://v2.test/' + (admin ? 'os2-admin.html' : 'os2.html'));
  await pg.getByRole('button', { name: users[uid].name, exact: true }).first().click();
  await pg.getByLabel('PIN', { exact: true }).fill('1234');
  await pg.getByRole('button', { name: '시작', exact: true }).click();
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(700);
  return { pg, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const sheetOver = (pg) => pg.evaluate(() => { const s = [...document.querySelectorAll('.v2-sheet')].pop(); return !!s && [...s.querySelectorAll('*')].some((e) => e.getBoundingClientRect().right > innerWidth + 1); });
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };
const closeSheets = async (pg) => { for (let i = 0; i < 4 && await pg.locator('.v2-sheet').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } };
const sheet = (pg) => pg.locator('.v2-sheet').last();
const store = (pg) => pg.evaluate(() => JSON.stringify(window.__V2));
const apprWrites = (pg) => pg.evaluate(() => window.__V2.writes.filter((w) => w.key === 'approval-requests'));
const inboxText = (pg) => pg.locator('.v2-ts.in').innerText().catch(() => '');
const openAppr = async (pg) => { await tab(pg, '더보기'); await pg.getByRole('button', { name: /하이웍스 품의를 담당이/ }).first().click(); await pg.waitForTimeout(400); };

let S1 = null;
// ① 윤미니 (폰 375): 더보기 › 품의 요청 → 예전 요청(담당 김송희로 보임) → 쓰기 → 저장
{ const s = await session('mini'), pg = s.pg;
  await openAppr(pg);
  const t0 = await sheet(pg).innerText();
  ok('윤미니 · 품의 요청 화면 · 예전 요청이 내 요청에 · 담당 없으면 김송희', /내 요청/.test(t0) && /고객 환불 택배비/.test(t0) && /담당 김송희/.test(t0), t0.slice(0, 300));
  ok('윤미니 · 맡은 게 없으면 [내가 맡은 것] 칸 없음', !/내가 맡은 것/.test(t0));
  await sheet(pg).getByRole('button', { name: '＋ 품의 요청 쓰기' }).click(); await pg.waitForTimeout(250);
  ok('윤미니 · 쓰기 칸: 요청자 = 나 · 담당 기본 김송희', /요청자 윤미니 \(나\)/.test(await sheet(pg).innerText()) && (await sheet(pg).getByLabel('담당').inputValue()) === '김송희');
  await sheet(pg).getByRole('button', { name: '요청 올리기' }).click(); await pg.waitForTimeout(200);
  ok('윤미니 · 빈 칸이면 알려 줌 · 저장 안 함', /주제, 문서 종류, 제목, 본문을\(를\) 채워 주세요/.test(await sheet(pg).innerText()) && (await apprWrites(pg)).length === 0);
  await sheet(pg).getByRole('button', { name: '주문/발주' }).click();
  await sheet(pg).getByRole('radio', { name: /구매요청서/ }).click();
  await sheet(pg).getByLabel('제목').fill('포장 테이프 10박스');
  await sheet(pg).getByRole('button', { name: '양식 넣기' }).click();
  ok('윤미니 · [양식 넣기] = 품목·수량·금액…', /- 품목:\n- 수량:/.test(await sheet(pg).getByLabel('본문').inputValue()));
  ok('윤미니 375 · 쓰기 칸 넘침 없음', !(await over(pg)) && !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'appr-mini-write-375.png') });
  await sheet(pg).getByRole('button', { name: '요청 올리기' }).click(); await pg.waitForTimeout(500);
  const w = (await apprWrites(pg)).filter((x) => x.op === 'put');
  ok('윤미니 · 같은 컬렉션에 저장 (요청자 윤미니·번호 · 담당 김송희·번호 · 품의전)', w.length === 1 && w[0].data.requester === '윤미니' && w[0].data.requesterId === 'mini' && w[0].data.assignee === '김송희' && w[0].data.assigneeId === 'songhee' && w[0].data.status === '품의전' && w[0].data.docType === '구매요청서' && w[0].data.topic === '주문/발주', w);
  ok('윤미니 · 알림 "김송희님 확인할 것에 떠요"', /김송희님 '확인할 것'에 떠요/.test(await pg.locator('.v2-toast').innerText().catch(() => '')));
  const t1 = await sheet(pg).innerText();
  ok('윤미니 · 내 요청: 품의 전 2 · 새 요청이 맨 위 · 칸이 하나면 탭 없음', /품의 전 2/.test(t1) && t1.indexOf('포장 테이프 10박스') < t1.indexOf('고객 환불 택배비') && !(await sheet(pg).getByRole('tab').count()) && /포장 테이프 10박스/.test(t1), t1.slice(0, 300));
  await pg.screenshot({ path: path.join(SHOTS, 'appr-mini-list-375.png') });
  await closeSheets(pg); await tab(pg, '더보기');
  ok('윤미니 · 더보기 줄에 품의 전 2', /품의 전 2/.test(await pg.getByRole('button', { name: /하이웍스 품의를 담당이/ }).first().innerText()));
  S1 = await store(pg); await s.close(); }

let S2 = null;
// ② 김송희 (폰 375): 오늘 '확인할 것' → 품의 요청 2건 · 새 품의 요청 → 열어 복사 → [품의 완료](메모)
{ const s = await session('songhee', { store: S1 }), pg = s.pg;
  { const more = pg.locator('.v2-ts.in').getByText(/개 모두 보기/); if (await more.count()) { await more.first().click(); await pg.waitForTimeout(300); } }
  const ib = await inboxText(pg);
  ok('김송희 · 확인할 것: 품의 요청 2건 (처리할 때까지 남음)', /품의 요청 2건/.test(ib), ib.slice(0, 400));
  ok('김송희 · 확인할 것: 새 품의 요청 (읽음 체계)', /새 품의 요청/.test(ib) && /포장 테이프 10박스/.test(ib));
  ok('김송희 375 · 오늘 넘침 없음', !(await over(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'appr-songhee-today-375.png') });
  await pg.locator('.v2-ts.in').getByRole('button', { name: '처리하기', exact: true }).click(); await pg.waitForTimeout(400);
  const t0 = await sheet(pg).innerText();
  ok('김송희 · [처리하기] → 내가 맡은 것 · 오래된 것부터', /내가 맡은 것 2/.test(t0) && t0.indexOf('고객 환불 택배비') < t0.indexOf('포장 테이프 10박스') && /요청 윤미니/.test(t0), t0.slice(0, 400));
  await sheet(pg).getByText('포장 테이프 10박스').first().click(); await pg.waitForTimeout(400);
  const t1 = await sheet(pg).innerText();
  ok('김송희 · 한 건: 제목·본문 · 담당 · 품의 완료 칸', /- 품목:/.test(t1) && /담당 김송희/.test(t1) && /하이웍스에 올렸나요/.test(t1));
  await sheet(pg).getByRole('button', { name: '복사' }).nth(1).click(); await pg.waitForTimeout(250);
  ok('김송희 · 본문 [복사]', /본문 복사했어요/.test(await pg.locator('.v2-toast').innerText().catch(() => '')));
  ok('김송희 375 · 한 건 넘침 없음', !(await sheetOver(pg)));
  await pg.screenshot({ path: path.join(SHOTS, 'appr-songhee-one-375.png') });
  await sheet(pg).getByLabel('메모').fill('결재 2026-118');
  await sheet(pg).getByRole('button', { name: '✓ 품의 완료' }).click(); await pg.waitForTimeout(500);
  const p = (await apprWrites(pg)).filter((x) => x.op === 'patch').pop();
  ok('김송희 · [품의 완료] 저장 (누가 · 메모)', p && p.data.status === '품의완료' && p.data.doneBy === '김송희' && p.data.doneById === 'songhee' && p.data.doneMemo === '결재 2026-118', p);
  ok('김송희 · 화면이 바로 품의 완료로', /김송희 품의 완료/.test(await sheet(pg).innerText()) && /메모 결재 2026-118/.test(await sheet(pg).innerText()));
  await closeSheets(pg); await tab(pg, '오늘');
  const ib2 = await inboxText(pg);
  ok('김송희 · 확인할 것: 품의 요청 1건으로 줄고, 처리한 새 요청 줄은 사라짐', /품의 요청 1건/.test(ib2) && !/포장 테이프 10박스/.test(ib2), ib2.slice(0, 300));
  // 다른 사람이 독립 화면에서 같은 때 바꿈 → 그사이 바뀐 것을 덮지 않음
  await pg.evaluate(() => window.__APPR('old1', { status: '품의완료', doneBy: '이란', doneAt: '2026-10-16T00:30:00.000Z' })); await pg.waitForTimeout(300);
  ok('김송희 · 독립 화면에서 바뀐 것이 바로 반영 (품의 요청 줄 없어짐)', !/품의 요청 \d건/.test(await inboxText(pg)));
  await pg.evaluate(() => window.__APPR('old1', { status: '품의전', doneBy: '', doneAt: null })); await pg.waitForTimeout(300);
  S2 = await store(pg); await s.close(); }

let S3 = null;
// ③ 윤미니: '확인할 것' 품의 완료 알림 · 내 요청 상태 · 담당 바꾸기(이란)
{ const s = await session('mini', { store: S2 }), pg = s.pg;
  const ib = await inboxText(pg);
  ok('윤미니 · 확인할 것: 품의 완료 (김송희 · 메모)', /품의 완료/.test(ib) && /포장 테이프 10박스/.test(ib) && /결재 2026-118/.test(ib) && /김송희/.test(ib), ib.slice(0, 300));
  await pg.locator('.v2-ts.in').getByText('포장 테이프 10박스').first().click(); await pg.waitForTimeout(400);
  ok('윤미니 · 알림 누르면 그 요청 한 건 · 완료한 사람·메모', /김송희 품의 완료/.test(await sheet(pg).innerText()) && !(await sheet(pg).getByRole('button', { name: '✓ 품의 완료' }).count()));
  await closeSheets(pg);
  ok('윤미니 · 읽으면 확인할 것에서 사라짐', !/포장 테이프 10박스/.test(await inboxText(pg)));
  await openAppr(pg);
  const t = await sheet(pg).innerText();
  ok('윤미니 · 내 요청: 품의 완료 · 누가 · 메모 / 남은 하나는 품의 전', /김송희 품의 완료/.test(t) && /메모 결재 2026-118/.test(t) && /품의 전 1/.test(t), t.slice(0, 400));
  await sheet(pg).getByText('고객 환불 택배비').first().click(); await pg.waitForTimeout(400);
  await sheet(pg).getByLabel('담당 바꾸기').selectOption({ label: '이란' }); await pg.waitForTimeout(500);
  const p = (await apprWrites(pg)).filter((x) => x.op === 'patch').pop();
  ok('윤미니 · 담당 바꾸기 → 이란 (이름·번호)', p && p.id === 'old1' && p.data.assignee === '이란' && p.data.assigneeId === 'ran', p);
  ok('윤미니 · 요청자는 [품의 완료] 버튼 없음', !(await sheet(pg).getByRole('button', { name: '✓ 품의 완료' }).count()));
  S3 = await store(pg); await s.close(); }

// ④ 이란: 바뀐 담당 '확인할 것'에 · 김송희에겐 없어짐
{ const s = await session('ran', { store: S3 }), pg = s.pg;
  ok('이란 · 확인할 것: 품의 요청 1건', /품의 요청 1건/.test(await inboxText(pg)));
  await s.close(); }
{ const s = await session('songhee', { store: S3, admin: true, w: 1280, h: 900 }), pg = s.pg;
  await pg.getByRole('button', { name: /나에게 온 것/ }).click(); await pg.waitForTimeout(400);
  ok('김송희 관리자 1280 · 나에게 온 것: 품의 요청 없음 (담당 이란으로)', !/품의 요청 \d건/.test(await sheet(pg).innerText()));
  await closeSheets(pg); await s.close(); }

// ⑤ 관리자 화면 '나에게 온 것' · 모두 탭 담당 거르기 · 넓은 화면 (허지은 = 관리자)
{ const S4 = JSON.parse(S3); S4.appr.n2 = { ...old1, title: '사무용품', createdAt: '2026-10-16T00:40:00.000Z', updatedAt: '2026-10-16T00:40:00.000Z' };
  const s = await session('GM', { store: JSON.stringify(S4), admin: true, w: 1280, h: 900 }), pg = s.pg;
  await pg.getByRole('button', { name: /나에게 온 것/ }).click(); await pg.waitForTimeout(400);
  ok('허지은 관리자 · 담당 아니면 나에게 온 것에 없음', !/품의 요청/.test(await sheet(pg).innerText()));
  await closeSheets(pg); await s.close();
  for (const w of [375, 768, 1280]) {
    const t = await session('GM', { store: JSON.stringify(S4), w, h: w > 700 ? 900 : 812 }), q = t.pg;
    await openAppr(q);
    await q.getByRole('tab', { name: '모두' }).click(); await q.waitForTimeout(300);
    const all = await sheet(q).innerText();
    ok(`허지은 ${w} · 모두: 담당으로 거르기 (김송희 2 · 이란 1)`, /김송희 2/.test(all) && /이란 1/.test(all), all.slice(0, 300));
    await sheet(q).getByRole('button', { name: '이란 1' }).click(); await q.waitForTimeout(200);
    const f = await sheet(q).innerText();
    ok(`허지은 ${w} · 이란만`, /고객 환불 택배비/.test(f) && !/사무용품/.test(f));
    ok(`허지은 ${w} · 품의 요청 화면 넘침 없음`, !(await over(q)) && !(await sheetOver(q)));
    await q.screenshot({ path: path.join(SHOTS, `appr-all-${w}.png`) });
    await t.close(); }
}

// ⑥ 보기 모드: 허지은이 윤미니 화면을 보면 쓰기 버튼 없음 · 저장 0건
{ const s = await session('GM', { store: S3 }), pg = s.pg;
  await pg.evaluate(() => { window.location.hash = '#v-mini'; }); await pg.waitForTimeout(700);
  const w0 = await pg.evaluate(() => window.__V2.writes.length);
  await openAppr(pg);
  const t = await sheet(pg).innerText();
  ok('보기 모드 · 윤미니 요청은 보이고 [쓰기]는 없음', /포장 테이프 10박스/.test(t) && !(await sheet(pg).getByRole('button', { name: '＋ 품의 요청 쓰기' }).count()));
  await sheet(pg).getByText('고객 환불 택배비').first().click(); await pg.waitForTimeout(300);
  ok('보기 모드 · 한 건에 담당 바꾸기·고치기·지우기 없음', !(await sheet(pg).getByLabel('담당 바꾸기').count()) && !(await sheet(pg).getByRole('button', { name: '지우기' }).count()));
  ok('보기 모드 · 저장 0건', (await pg.evaluate(() => window.__V2.writes.length)) === w0);
  await s.close(); }

// ⑦ 윤미니: 고치기 · 지우기
{ const s = await session('mini', { store: S3 }), pg = s.pg;
  await openAppr(pg);
  await sheet(pg).getByText('고객 환불 택배비').first().click(); await pg.waitForTimeout(300);
  await sheet(pg).getByRole('button', { name: '고치기' }).click(); await pg.waitForTimeout(200);
  await sheet(pg).getByLabel('제목').fill('고객 환불 택배비 (2건)');
  await sheet(pg).getByRole('button', { name: '고친 내용 저장' }).click(); await pg.waitForTimeout(400);
  const p = (await apprWrites(pg)).filter((x) => x.op === 'patch').pop();
  ok('윤미니 · 고치기 저장', p && p.data.title === '고객 환불 택배비 (2건)', p);
  await sheet(pg).getByRole('button', { name: '지우기' }).click(); await pg.waitForTimeout(200);
  await pg.getByRole('alertdialog').getByRole('button', { name: '지우기' }).click(); await pg.waitForTimeout(500);
  const d = (await apprWrites(pg)).filter((x) => x.op === 'patch').pop();
  ok('윤미니 · 지우기 = 지움 표시(deleted)', d && d.data.deleted === true, d);
  ok('윤미니 · 지운 요청은 목록에서 빠짐', !/고객 환불 택배비/.test(await sheet(pg).innerText()));
  await s.close(); }

await b.close();
if (errs.length) { console.log('\n화면 오류:'); errs.forEach((e) => console.log(' ', e)); }
console.log(`\n${n - bad}/${n} 통과${errs.length ? ` · 화면 오류 ${errs.length}` : ''}`);
process.exit(bad || errs.length ? 1 : 0);
