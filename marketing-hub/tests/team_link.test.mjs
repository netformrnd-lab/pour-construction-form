// team_link.py 시험 — Firestore 에뮬레이터에서만 (실제 DB 안 씀)
//   실행: (rules.test.mjs 와 같은 폴더 준비) npx firebase emulators:exec --only firestore --project pour-app-new "node team_link.test.mjs"
//   TOOLS = team_link.py 가 있는 폴더 (기본 ../tools)
import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const TOOLS = process.env.TOOLS || join(dirname(fileURLToPath(import.meta.url)), '../tools');
const E = 'http://127.0.0.1:8080/v1/projects/pour-app-new/databases/(default)/documents';
const H = { 'content-type': 'application/json', Authorization: 'Bearer owner' };
let n = 0, bad = 0; const ok = (name, c, info) => { n++; if (c) console.log('✓', name); else { bad++; console.log('✗', name, info === undefined ? '' : JSON.stringify(info).slice(0, 500)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const enc = (v) => v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
const dec = (v) => { const [k, x] = Object.entries(v)[0]; return k === 'nullValue' ? null : k === 'integerValue' ? Number(x) : k === 'arrayValue' ? (x.values || []).map(dec) : k === 'mapValue' ? Object.fromEntries(Object.entries(x.fields || {}).map(([a, b]) => [a, dec(b)])) : x; };
const put = (path, obj) => fetch(`${E}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) }) }).then((r) => r.json());
const getDoc = async (path) => { const r = await fetch(`${E}/${path}`, { headers: H }); if (!r.ok) return null; const j = await r.json(); return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, dec(v)])); };
const vault = mkdtempSync(join(tmpdir(), 'vault-')); mkdirSync(join(vault, '02 팀원')); mkdirSync(join(vault, '03 작업'));
const NOTE = '03 작업/2026-10-12 블로그 원고 3.md';
writeFileSync(join(vault, NOTE), '# 블로그 원고 3\n\n## 결과물\n\n## 1. 균열 보수 — POUR스토어\n\n**제목**: 시험\n');
const tl = (...args) => { try { return { out: execFileSync('python3', [join(TOOLS, 'team_link.py'), ...args], { env: { ...process.env, MKT_VAULT: vault, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, encoding: 'utf8' }), code: 0 }; }
  catch (e) { return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status }; } };

// 씨앗: 업무OS 사람 · 여름(B2C 크루 · 2026-10-14 아침 루틴) 담당 = 남윤정(POUR스토어) · 쉬는 포리의 옛 규칙
await put('pour-os/v2/users/yj', { id: 'yj', name: '남윤정' });
await put('pour-os/v2/users/old', { id: 'old', name: '퇴사', active: false });
await put('pour-os/v2/aimates/yeoreum', { id: 'yeoreum', owners: { pourstore: 'yj', _: 'old' }, rules: [{ id: 'r1', text: '근거는 쿠팡 판매 데이터로', at: '2026-10-12T00:00:00Z', byName: '남윤정' }, { id: 'r2', text: '끈 규칙', off: { at: 'x' } }],
  qty: { blog: { n: 5, byName: '남윤정', at: '2026-10-15T01:00:00Z' }, cafe: { n: null, byName: '남윤정', at: '2026-10-15T01:00:00Z' } } });   // 2026-10-15 횟수 (담당이 정함 · null = 기본)
await put('pour-os/v2/aimates/pori', { id: 'pori', rules: [{ id: 'p1', text: '포리 때 규칙: 제목에 지역명', at: '2026-10-11T00:00:00Z', byName: '남윤정' }] });

// ① 처음 올림 → 승인 한 건 (크루 b2c · 담당 = 브랜드 담당) + 노트 본문
let r = tl('open', '여름', '블로그 원고 3', NOTE, '2026-10-12', '--brand', 'pourstore');
ok('open 성공', r.code === 0 && /업무OS 승인 올림/.test(r.out) && /본문 올림/.test(r.out), r.out);
const id = (/(ai_yeoreum_20261012_[0-9a-f]{8})/.exec(r.out) || [])[1];
let a = await getDoc('pour-os/v2/aiasks/' + id);
eq('승인 문서 = 여름(B2C 크루) · 남윤정 차례', a && [a.crew, a.mate, a.mateName, a.brand, a.board, a.owner, a.to, a.step, a.state, a.ver, a.pick, a.note, a.src, a.title], ['b2c', 'yeoreum', '여름', 'pourstore', '', 'yj', 'yj', 0, 'wait', 1, null, NOTE, 'tool', '여름 · 블로그 원고 3']);
ok('결과 전체 보기 = 허브 노트', a && a.url.includes('/marketing-hub/#note-mkt-ai-yeoreum-2026-10-12-') && a.noteId.startsWith('mkt-ai-yeoreum-2026-10-12-'));
ok('실행 한 줄 = 발행은 사람', a && /발행은 사람/.test(a.exec));
const nt = await getDoc('pour-os/marketing-hub/mkt-notes/' + a.noteId);
ok('허브 노트 본문', nt && nt.body.includes('블로그 원고 3') && nt.member === 'yeoreum');
// 쉬는 하루·포리·에코 = 새로 올리기 막음 (여름으로)
for (const g of ['포리', '하루', 'eco']) { r = tl('open', g, '블로그 원고 3', NOTE, '2026-10-12'); ok(`${g} 쉼 → 안 올림 · 여름 안내`, r.code !== 0 && /쉬어요/.test(r.out) && /open 여름/.test(r.out), r.out); }
// ② 'AI 에게 다시' 받은 뒤 같은 노트로 다시 → 같은 건의 2번째 판
await put('pour-os/v2/aiasks/' + id, { ...a, state: 'back', to: '', back: { text: 'CTA 링크 확인', byName: '남윤정', at: '2026-10-12T01:00:00Z' } });
// 쉬기 전 포리가 올렸다가 돌려받은 옛 건 (2026-10-13 아침) → 여름이 이어받아 고침
const OLD = '03 작업/2026-10-13 블로그 원고 3.md', oldId = 'ai_pori_20261013_0a1b2c3d';
writeFileSync(join(vault, OLD), '# 블로그 원고 3 (10/13)\n\n## 결과물\n\n## 1. 곰팡이 — 그로홈\n\n**제목**: 옛 판\n');
await put('pour-os/v2/aiasks/' + oldId, { id: oldId, crew: 'base', mate: 'pori', mateName: '포리', brand: 'pourstore', board: '', act: '', run: '2026-10-13', title: '포리 · 블로그 원고 3', note: OLD, noteId: 'mkt-ai-pori-2026-10-13-0a1b2c3d',
  owner: '', to: '', step: 0, state: 'back', ver: 1, back: { text: '옛 포리 건 고칠 것', byName: '남윤정', at: '2026-10-13T02:00:00Z', more: 2 }, log: [{ at: '2026-10-13T00:00:00Z', by: 'ai:pori', byName: '포리 (AI)', act: 'ask' }], createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T02:00:00Z', src: 'tool' });
// 크루(Aside 보드) 건·크루 보드 규칙은 아침 루틴 feedback 에 안 나옴 (crew.html 에서 다시)
await put('pour-os/v2/aiasks/ai_gyeoul_20261012_C', { id: 'ai_gyeoul_20261012_C', crew: 'b2c', mate: 'gyeoul', mateName: '겨울', board: 'gh-conv', act: 'C', title: '겨울 · C', state: 'back', back: { text: '크루 고칠 것' }, run: '2026-10-12', updatedAt: '2026-10-12T01:00:00Z' });
await put('pour-os/v2/aimates/gyeoul', { id: 'gyeoul', rules: [{ id: 'g1', text: '크루 규칙' }] });
r = tl('feedback', '30');
ok('feedback: 고칠 것(여름 + 쉬는 포리 옛 건) · 규칙(켠 것만)', /고쳐서 다시 올릴 것 2건/.test(r.out) && r.out.includes('CTA 링크 확인') && r.out.includes('옛 포리 건 고칠 것') && r.out.includes('근거는 쿠팡 판매 데이터로') && r.out.includes('포리 때 규칙') && !r.out.includes('끈 규칙'), r.out);
ok('feedback: 크루 보드 건·크루 보드 규칙 빠짐', !r.out.includes('크루 고칠 것') && !r.out.includes('크루 규칙'), r.out);
r = tl('feedback', '14', '여름');
ok('feedback 여름 = 하루·포리·에코 옛 것도', /팀원: 여름 · 하루 · 포리 · 에코/.test(r.out) && /고쳐서 다시 올릴 것 2건/.test(r.out) && r.out.includes('근거는 쿠팡') && r.out.includes('포리 때 규칙') && !r.out.includes('크루 고칠 것'), r.out);
ok('feedback 여름: ■ 횟수(담당이 정한 블로그 원고 5편 · 나머지 기본) · 더 만들기 2개 (2026-10-15)', r.out.includes('■ 횟수') && r.out.includes('여름: 블로그 원고 5편 (담당 남윤정 · 10/15 · 기본 3편)') && r.out.includes('여름: 티스토리 글 1편 (기본)') && r.out.includes('여름: 카페 글 2편 (기본)') && /→ 더 만들기 2개: 지금 노트의 글은 그대로/.test(r.out) && r.out.indexOf('■ 횟수') < r.out.indexOf('■ 확정 규칙'), r.out);
r = tl('backs', '여름');
ok('backs 여름 = 고쳐서 다시 수만 짧게 (한 시간마다 확인 · 더 만들기 표시 · 보드 건 빠짐)', /^고쳐서 다시 2건 — 자세히/.test(r.out) && r.out.includes('더 만들기 2개') && !r.out.includes('크루 고칠 것') && !r.out.includes('■'), r.out);
r = tl('backs', '하루', '에코');
ok('backs 하루·에코 = 0건 · 할 일 없음', /^고쳐서 다시 0건 — 할 일 없음/.test(r.out.trim()), r.out);
r = tl('feedback', '14', '하루', '에코');
ok('feedback 팀원만: 하루·에코 = 고칠 것 0', /팀원: 하루 · 에코/.test(r.out) && /고쳐서 다시 올릴 것 0건/.test(r.out) && !r.out.includes('근거는 쿠팡'), r.out);
r = tl('feedback', '겨울');
ok('feedback 겨울: 보드 건은 crew.html 에서 (0) · 규칙은 보임 · 횟수 칸 없음(보드 횟수는 crew.html 지시문)', /고쳐서 다시 올릴 것 0건/.test(r.out) && r.out.includes('크루 규칙') && !r.out.includes('■ 횟수'), r.out);
r = tl('open', '여름', '블로그 원고 3', NOTE, '2026-10-13', '--brand', 'pourstore');
ok('다시 올림 = 같은 건', r.code === 0 && r.out.includes(id) && /2번째 판/.test(r.out), r.out);
a = await getDoc('pour-os/v2/aiasks/' + id);
eq('2번째 판 = 담당 차례 · 돌려받은 말 비움', [a.state, a.to, a.step, a.ver, a.back, a.log.map((x) => x.act)], ['wait', 'yj', 0, 2, null, ['ask', 'redo']]);
// 포리 옛 건 → 여름이 같은 노트로 다시 = 같은 건의 2번째 판 · 이름은 여름으로
r = tl('open', '여름', '블로그 원고 3', OLD, '2026-10-14', '--brand', 'pourstore');
ok('쉬는 포리 옛 건 = 여름이 이어받아 2번째 판', r.code === 0 && r.out.includes(oldId) && /2번째 판/.test(r.out), r.out);
const ao = await getDoc('pour-os/v2/aiasks/' + oldId);
eq('이어받은 건 = 여름 · b2c · 담당 차례', [ao.mate, ao.mateName, ao.crew, ao.title, ao.state, ao.to, ao.ver, ao.noteId, ao.log.map((x) => x.byName)], ['yeoreum', '여름', 'b2c', '여름 · 블로그 원고 3', 'wait', 'yj', 2, 'mkt-ai-pori-2026-10-13-0a1b2c3d', ['포리 (AI)', '여름 (AI)']]);
const nto = await getDoc('pour-os/marketing-hub/mkt-notes/mkt-ai-pori-2026-10-13-0a1b2c3d');
ok('이어받은 건 허브 노트 = 여름 · 새 본문', nto && nto.member === 'yeoreum' && nto.body.includes('옛 판'), nto);
// ③ 위로 올라간 뒤엔 그대로 (새 날짜로)
await put('pour-os/v2/aiasks/' + id, { ...a, to: 'sy', step: 1, path: ['yj'] });
writeFileSync(join(vault, NOTE), '# 블로그 원고 3\n\n몰래 바뀐 판\n');
r = tl('open', '여름', '블로그 원고 3', NOTE, '2026-10-12', '--brand', 'pourstore');
ok('위로 올라간 건 안 고침', r.code !== 0 && /이미 올라가 있어요/.test(r.out), r.out);
a = await getDoc('pour-os/v2/aiasks/' + id);
eq('그대로', [a.to, a.step, a.ver], ['sy', 1, 2]);
const nt2 = await getDoc('pour-os/marketing-hub/mkt-notes/' + a.noteId);
ok('상급자가 보는 본문도 그대로', nt2 && !nt2.body.includes('몰래 바뀐 판'), nt2 && nt2.body);
// ④ 담당이 쉬는 사람이면 관리자 누구나 · 노아(관리자 전용)는 안 올림
r = tl('open', '여름', '지식인 4', '03 작업/없는 노트.md', '2026-10-12');
const id2 = (/(ai_yeoreum_20261012_[0-9a-f]{8})/.exec(r.out) || [])[1];
const a2 = await getDoc('pour-os/v2/aiasks/' + id2);
eq('기본 담당이 쉬면 담당 미정', a2 && [a2.owner, a2.to, a2.brand], ['', '', '']);
ok('노트 없으면 본문 없이', /노트 파일 없음/.test(r.out));
r = tl('open', '노아', '가격표', NOTE);
ok('노아는 안 올림', r.code !== 0 && /관리자 전용/.test(r.out), r.out);
r = tl('rules', '여름'); ok('rules', r.out.includes('근거는 쿠팡 판매 데이터로') && !r.out.includes('끈 규칙'));
r = tl('asks'); ok('asks: 모두 진행 4건 (크루 보드 포함)', /진행 4건/.test(r.out) && r.out.includes('2단계'), r.out);
r = tl('asks', '여름'); ok('asks 여름: 3건 (이어받은 포리 옛 건 포함)', /진행 3건/.test(r.out), r.out);

// ⑤ 요청 과다(429 · 2026-10-12 아침 루틴에서 실제로 남) → 2·4초 뒤 다시 → 받음 (가짜 서버 · numbers · 실제 DB 아님)
let hits = 0;
const srv = http.createServer((q, s) => { hits++; if (hits <= 2) { s.writeHead(429, { 'content-type': 'application/json' }); s.end('{"error":{"code":429}}'); return; }
  s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ fields: { body: { stringValue: '# 05 오늘 숫자\n시험\n' }, date: { stringValue: '2026-10-12' } } })); });
await new Promise((res) => srv.listen(8095, '127.0.0.1', res));
const t0 = Date.now(); let rr;
try { rr = await promisify(execFile)('python3', [join(TOOLS, 'team_link.py'), 'numbers'], { env: { ...process.env, MKT_VAULT: vault, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8095' }, encoding: 'utf8' }); }
catch (e) { rr = { stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
srv.close();
ok('429 두 번 → 다시 받아 저장 (2·4초 기다림)', hits === 3 && /저장/.test(rr.stdout) && /429 — 2초 뒤 다시/.test(rr.stderr) && Date.now() - t0 >= 5500 && readFileSync(join(vault, '05 오늘 숫자.md'), 'utf8').includes('시험'), { hits, out: rr.stdout, err: rr.stderr });

console.log(`\n${n - bad}/${n} 통과`); if (bad) process.exit(1);
