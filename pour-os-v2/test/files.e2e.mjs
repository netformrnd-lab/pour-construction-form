// 업무OS v2 · 붙여넣기 첨부 · 올린 파일 빼기(올린 날만) · 개발 수정 요청 포스트잇 시험 (2026-10-16)
//   사장님: "댓글이나 업무, 프로젝트에 파일첨부에 사진첨부 시 복붙으로도 넣을 수 있게하고 파일 넣은것을 삭제하고 재첨부 가능하게해. 단, 삭제는 다음날 넘어가면 못하게 막아"
//           "업무os 개발 수정 요청하는곳 만들어줘. 관리자페이지에도. 아주 간단히 메모 포스트잇형식으로 … 사진 캡처 복붙으로 바로 첨부"
//   가짜 저장 장치 · 실제 Firestore 에 안 씀 · 구글 주소 모두 막음
//   준비: ai.e2e.mjs 와 같은 빌드 · 실행: node test/files.e2e.mjs (SHOTS=폴더)
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinHash } from '../src/sha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEAM = path.join(here, 'out/team/index.html'), ADMIN = path.join(here, 'out/admin/admin.html');
const SHOTS = process.env.SHOTS || path.join(here, 'out/shots'); fs.mkdirSync(SHOTS, { recursive: true });
const NOW = '2026-10-16T14:00:00+09:00', TODAY = '2026-10-16T01:00:00.000Z', YDAY = '2026-10-15T01:00:00.000Z', D0 = '2026-10-01T00:30:00.000Z';
let n = 0, bad = 0; const errs = [];
const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };

const U = [['yj', '남윤정', '1팀'], ['sh', '김송희', '2팀'], ['hj', '허지은', '공용']];
const users = Object.fromEntries(U.map(([id, name, team]) => [id, { id, name, team, role: 'member', color: '#24386B', pinHash: pinHash(id, '1234'), pinSetAt: '2026-10-01T00:00:00.000Z' }]));
const file = (name, at, by, type = 'image/png') => ({ name, url: 'https://example.test/' + encodeURIComponent(name), path: `task-attachments/v2/task-t1/${name}`, size: 2048, type, uploadedAt: at, by, byName: users[by].name });
const tasks = {
  t1: { id: 't1', title: '상세페이지 시안 정리', isFixed: false, type: 'general', status: 'inprogress', assigneeId: 'yj', assigneeIds: ['yj'], projectId: 'p1', parentId: null, memo: '', dueDate: '2026-10-20', createdAt: D0, statusLog: [],
    attachments: [file('오늘 사진.png', TODAY, 'yj'), file('어제 견적.pdf', YDAY, 'yj', 'application/pdf'), file('김송희 파일.png', TODAY, 'sh')] },
};
const notes = {
  n1: { id: 'n1', itemId: 'task:t1', text: '오늘 올린 댓글', by: 'yj', byName: '남윤정', at: TODAY, projectId: 'p1', files: [{ name: '댓글 사진.png', url: 'https://example.test/c1.png', path: 'task-attachments/v2/note-task_t1/c1.png', size: 1000, type: 'image/png', uploadedAt: TODAY }] },
  n2: { id: 'n2', itemId: 'task:t1', text: '어제 올린 댓글', by: 'yj', byName: '남윤정', at: YDAY, projectId: 'p1', files: [{ name: '어제 댓글 사진.png', url: 'https://example.test/c2.png', path: 'task-attachments/v2/note-task_t1/c2.png', size: 1000, type: 'image/png', uploadedAt: YDAY }] },
};
const projects = { p1: { id: 'p1', title: '그로홈 상세 고도화', category: 'marketing', ownerId: 'yj', memberIds: [], status: 'active', startDate: '2026-10-01', dueDate: '2026-10-31', brand: 'grohome', createdAt: D0 } };
const devreqs = { dr0: { id: 'dr0', text: '반복 실행 줄이 너무 길어요', files: [], by: 'yj', byName: '남윤정', at: YDAY, app: 'team', state: 'open', updatedAt: YDAY } };
const ST = { meta: { seededAt: '2026-10-01T00:00:00.000Z', counts: {} }, writes: [],
  v2: { users, projects, tasks, notes, log: {}, events: {}, brands: { grohome: { id: 'grohome', name: '그로홈', active: true, order: '1' } }, workflows: {}, mainKPIs: {}, subKPIs: {}, settings: {}, kpiact: {}, links: {}, lagvals: {}, kpisales: {}, kpidefs: {}, templates: {}, checks: {}, aiasks: {}, aimates: {}, aiboards: {}, devreqs } };

const b = await pkg.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8' } });
async function session(uid, { admin = false, w = 375, h = 900 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
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
  await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await pg.waitForTimeout(800);
  return { pg, close: () => ctx.close() };
}
const over = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const tab = async (pg, name) => { await pg.locator('.v2-nav').getByRole('button', { name: new RegExp('^' + name + '(\\s*\\d+)?$') }).click(); await pg.waitForTimeout(450); };
const toast = (pg) => pg.locator('.v2-toast').innerText().catch(() => '');
const S = (pg) => pg.locator('.v2-sheet').last();
// 클립보드 붙여넣기 (캡처 사진 = 이름 image.png) — sel 이 있으면 그 칸에, 없으면 화면(body)에
const paste = (pg, sel) => pg.evaluate((sel) => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'image.png', { type: 'image/png' }));
  const el = sel ? document.querySelector(sel) : document.body; if (sel) el.focus(); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, sel || null);
const doc = (pg, k, id) => pg.evaluate(([k, id]) => window.__V2.v2[k][id], [k, id]);

// ── ① 업무 시트: [빼기]는 오늘 내가 올린 파일만 · 빼기 → 되돌리기 · 화면에 붙여넣기 = 파일 ──
for (const w of [375, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 1000 : 1400 }), pg = s.pg, before = errs.length;
  await pg.evaluate(() => window.__OPEN && 0); await tab(pg, '프로젝트'); await pg.getByText('그로홈 상세 고도화').first().click(); await pg.waitForTimeout(500);
  await S(pg).getByText('상세페이지 시안 정리').first().click(); await pg.waitForTimeout(500);
  const fileRow = (nm) => S(pg).locator('div', { has: pg.getByRole('button', { name: `${nm} 빼기` }) }).first();
  const rmBtn = (nm) => S(pg).getByRole('button', { name: `${nm} 빼기` });
  ok(`업무 ${w} · [빼기] = 오늘 내가 올린 것(파일·댓글 사진)만 · 어제 것·남의 것은 없음`, (await rmBtn('오늘 사진.png').count()) === 1 && (await rmBtn('댓글 사진.png').count()) === 1
    && (await rmBtn('어제 견적.pdf').count()) === 0 && (await rmBtn('김송희 파일.png').count()) === 0 && (await rmBtn('어제 댓글 사진.png').count()) === 0);
  ok(`업무 ${w} · 안내 '오늘 내가 올린 파일만 [빼기]' · PC면 붙여넣기 안내`, (await S(pg).innerText()).includes('오늘 내가 올린 파일만 [빼기]') && (w < 700 || (await S(pg).innerText()).includes('Ctrl+V')));
  ok(`업무 ${w} · 넘침 없음`, !(await over(pg)));
  if (w === 375) {
    await rmBtn('오늘 사진.png').scrollIntoViewIfNeeded();
    await pg.screenshot({ path: path.join(SHOTS, 'files-task-375.png') });
    await rmBtn('오늘 사진.png').click(); await pg.waitForTimeout(500);
    let t = await doc(pg, 'tasks', 't1');
    ok('[빼기] → 목록에서 빠짐 · removedFiles 에 누가·언제 · 토스트 다시 올릴 수 있어요', !t.attachments.some((f) => f.name === '오늘 사진.png') && t.removedFiles.some((f) => f.name === '오늘 사진.png' && f.removedBy === 'yj') && /파일을 뺐어요 · 오늘 사진.png/.test(await toast(pg)));
    await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(500);
    t = await doc(pg, 'tasks', 't1');
    ok('되돌리기 → 다시 목록에', t.attachments.some((f) => f.name === '오늘 사진.png'));
    await rmBtn('댓글 사진.png').click(); await pg.waitForTimeout(500);
    ok('댓글 사진 [빼기] → 댓글 파일에서 빠짐', !(await doc(pg, 'notes', 'n1')).files.length && (await doc(pg, 'notes', 'n1')).removedFiles.length === 1);
    // 화면(글 칸 밖)에 붙여넣기 → 이 업무 파일로 바로 올림
    await paste(pg, null); await pg.waitForTimeout(900);
    t = await doc(pg, 'tasks', 't1');
    ok('화면에 캡처 붙여넣기 → 업무 파일로 · 이름 붙여넣은 사진 MMDD-hhmmss.png', t.attachments.some((f) => /^붙여넣은 사진 1016-14\d{4}\.png$/.test(f.name) && f.by === 'yj'), t.attachments.map((f) => f.name));
    // 댓글 칸에 붙여넣기 → 그 댓글에 붙음
    await paste(pg, '.v2-sheet:last-of-type textarea[aria-label="댓글"]'); await pg.waitForTimeout(300);
    ok('댓글 칸에 붙여넣기 → 올릴 파일 줄', (await S(pg).locator('.v2-uplist').innerText()).includes('붙여넣은 사진'));
    await S(pg).getByRole('button', { name: '남기기' }).click(); await pg.waitForTimeout(900);
    const nn = await pg.evaluate(() => Object.values(window.__V2.v2.notes).find((x) => x.itemId === 'task:t1' && x.text === '(파일)'));
    ok('남기기 → 댓글에 붙여넣은 사진', !!nn && nn.files.length === 1 && /^붙여넣은 사진/.test(nn.files[0].name), nn);
    // 어제 댓글 고치기: 붙은 파일은 '올린 날만 빼요'
    await S(pg).locator('#v2-n-n2').locator('..').getByRole('button', { name: '고치기' }).first().click(); await pg.waitForTimeout(300);
    ok('어제 댓글 고치기: 어제 파일은 [빼기] 없이 올린 날만 빼요', (await S(pg).locator('.v2-nedit').innerText()).includes('올린 날만 빼요') && (await S(pg).locator('.v2-nedit').getByRole('button', { name: '어제 댓글 사진.png 빼기' }).count()) === 0);
  }
  ok(`업무 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}

// ── ② 개발 수정 요청 포스트잇 (팀 앱) ──
for (const w of [375, 768, 1280]) {
  const s = await session('yj', { w, h: w > 700 ? 1000 : 1200 }), pg = s.pg, before = errs.length;
  await tab(pg, '더보기'); await pg.getByText('개발 수정 요청', { exact: true }).first().click(); await pg.waitForTimeout(500);
  ok(`포스트잇 ${w} · 시트 · 어제 붙인 요청(열린 것 1) · 어제 것은 [떼기] 없음`, (await S(pg).innerText()).includes('열린 것 1') && (await S(pg).innerText()).includes('반복 실행 줄이 너무 길어요') && (await S(pg).getByRole('button', { name: '떼기' }).count()) === 0);
  if (w === 375 || w === 1280) {
    await S(pg).getByLabel('수정 요청').fill('관리자 화면 반복 실행에서 주별 표가 안 열려요');
    await paste(pg, 'textarea[aria-label="수정 요청"]'); await pg.waitForTimeout(300);
    ok(`포스트잇 ${w} · 글 칸에 캡처 붙여넣기 → 올릴 사진 줄`, (await S(pg).locator('.v2-uplist').innerText()).includes('붙여넣은 사진'));
    await S(pg).getByRole('button', { name: '붙이기' }).click(); await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => Object.values(window.__V2.v2.devreqs).find((x) => x.text === '관리자 화면 반복 실행에서 주별 표가 안 열려요'));
    ok(`포스트잇 ${w} · [붙이기] → 저장(글 · 사진 · 쓴 사람 · 팀 앱 · 열림) · 판에 열린 것 2`, !!r && r.files.length === 1 && /^붙여넣은 사진/.test(r.files[0].name) && r.by === 'yj' && r.app === 'team' && r.state === 'open' && (await S(pg).innerText()).includes('열린 것 2'), r);
    if (w === 375) await pg.screenshot({ path: path.join(SHOTS, 'devreq-375.png'), fullPage: true });
    await S(pg).getByRole('button', { name: '떼기' }).first().click(); await pg.waitForTimeout(500);
    ok(`포스트잇 ${w} · 오늘 붙인 것 [떼기] → 빠짐(지우지 않음 removed) · 되돌리기`, (await S(pg).innerText()).includes('열린 것 1') && !!(await pg.evaluate(() => Object.values(window.__V2.v2.devreqs).find((x) => x.text.startsWith('관리자 화면')).removed)));
    await pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }).click(); await pg.waitForTimeout(500);
    ok(`포스트잇 ${w} · 되돌리기 → 다시 열린 것 2`, (await S(pg).innerText()).includes('열린 것 2'));
  }
  ok(`포스트잇 ${w} · 팀원은 [반영함] 없음 · 넘침 없음`, (await S(pg).getByRole('button', { name: '반영함', exact: true }).count()) === 0 && !(await over(pg)));
  ok(`포스트잇 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}

// ── ③ 관리자: 머리 [수정 요청](넓은 화면) · 좁으면 설정 첫 줄 · [반영함] ──
for (const w of [375, 1280]) {
  const s = await session('hj', { admin: true, w, h: w > 700 ? 1000 : 1200 }), pg = s.pg, before = errs.length;
  const headBtn = pg.locator('.a-head').getByRole('button', { name: '개발 수정 요청 포스트잇' });
  if (w >= 600) { ok(`관리자 ${w} · 머리 [수정 요청] 보임`, await headBtn.isVisible()); await headBtn.click(); }
  else { ok(`관리자 ${w} · 머리 [수정 요청]은 숨김(넘침 막기) · 설정 첫 줄`, !(await headBtn.isVisible()) && !(await over(pg)));
    await pg.locator('.a-head').getByRole('button', { name: '설정' }).click(); await pg.waitForTimeout(400); await S(pg).getByText('개발 수정 요청', { exact: true }).click(); }
  await pg.waitForTimeout(500);
  ok(`관리자 ${w} · 포스트잇 판 · [반영함]`, (await S(pg).innerText()).includes('반복 실행 줄이 너무 길어요') && (await S(pg).getByRole('button', { name: '반영함', exact: true }).count()) === 1);
  await S(pg).getByRole('button', { name: '반영함', exact: true }).click(); await pg.waitForTimeout(500);
  const r = await doc(pg, 'devreqs', 'dr0');
  ok(`관리자 ${w} · [반영함] → done · 누가 · 반영함 1`, r.state === 'done' && r.doneBy === 'hj' && (await S(pg).innerText()).includes('반영함 1'));
  if (w === 1280) await pg.screenshot({ path: path.join(SHOTS, 'devreq-admin-1280.png') });
  ok(`관리자 ${w} · 넘침 없음`, !(await over(pg)));
  ok(`관리자 ${w} · 화면 오류 없음`, errs.length === before, errs.slice(before));
  await s.close();
}
await b.close();
console.log(`\n${n - bad}/${n} 통과${bad ? ` · ${bad} 실패` : ''}${errs.length ? '\n화면 오류:\n' + errs.join('\n') : ''}`);
process.exit(bad || errs.length ? 1 : 0);
