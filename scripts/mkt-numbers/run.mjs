// 마케팅 허브 '오늘 숫자' — GitHub Actions mkt-numbers.yml 이 매일 한국 06:10 실행 (사장님 2026-10-12 "숫자도 옵시디언 없이 GitHub 로")
//   대시보드와 같은 데이터·같은 계산(marketing-hub/core.js numbersNote) → pour-os/marketing-hub/mkt-notes/today-numbers {body, date, at, counts}
//   → AI 팀 아침 루틴(06:50)이 볼트 tools/team_link.py numbers 로 받아 '05 오늘 숫자.md' 로 저장·커밋 (옵시디언 앱·버튼 없이 GitHub 에 쌓임)
// 읽는 곳: core.js STORE_MODE 와 같은 자리 (open = pour-os/marketing-hub/<컬렉션> · 공개 규칙이라 키만으로 읽음)
//   secure 로 바꾼 뒤엔 MKT_MODE=secure + 서비스 계정(SA_EMAIL·SA_KEY) 으로 최상위 mkt-* 를 읽음 · 결과 문서는 늘 open 자리(루틴은 로그인이 없음)
// 내용: 판매·광고·재고 숫자 + 고객의 소리(저장 때 번호 가림) — 원가 없음 (원가는 마진 대시보드에만)
// 시험용 환경변수: FS_BASE(에뮬레이터) · TODAY(YYYY-MM-DD) · DRY=1(쓰지 않고 출력만)
import { createRequire } from 'node:module';
import { createSign } from 'node:crypto';
import { fsDec, fsEnc } from '../usage/core.mjs';
const C = createRequire(import.meta.url)('../../marketing-hub/core.js');

const E = process.env;
const KEY = 'AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU'; // 웹 설정용 공개 키 (화면 코드에 이미 있는 값)
const DOCS = (E.FS_BASE || 'https://firestore.googleapis.com') + '/v1/projects/pour-app-new/databases/(default)/documents';
const MODE = E.MKT_MODE === 'secure' ? 'secure' : C.STORE_MODE;
const OPEN = DOCS + '/' + C.OPEN_ROOT.join('/');              // pour-os/marketing-hub
const READ_PARENT = MODE === 'secure' ? DOCS : OPEN;        // runQuery 부모 (최상위 / pour-os/marketing-hub)
const OUT = OPEN + '/mkt-notes/today-numbers';
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const TODAY = E.TODAY || kst();

let TOK = '';
async function token() {
  if (!E.SA_EMAIL || !E.SA_KEY) return '';
  const b64u = (x) => Buffer.from(x).toString('base64url'), iat = Math.floor(Date.now() / 1000), aud = 'https://oauth2.googleapis.com/token';
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), body = b64u(JSON.stringify({ iss: E.SA_EMAIL, aud, iat, exp: iat + 3600, scope: 'https://www.googleapis.com/auth/datastore' }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(String(E.SA_KEY).replace(/\\n/g, '\n'), 'base64url');
  const r = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`서비스 계정 로그인 실패 ${r.status}`);
  return j.access_token;
}
const auth = (u) => (TOK ? { url: u, headers: { Authorization: `Bearer ${TOK}` } } : { url: u + (u.includes('?') ? '&' : '?') + 'key=' + KEY, headers: {} });

async function query(coll, field, from) {
  const { url, headers } = auth(READ_PARENT + ':runQuery');
  const q = { structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: field }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: from } } } } };
  const r = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new Error(`[${coll}] 읽기 실패 ${r.status}: ${(j && j.error && j.error.message) || ''}`);
  const rows = j.filter((x) => x.document).map((x) => ({ id: x.document.name.split('/').pop(), ...fsDec({ mapValue: { fields: x.document.fields || {} } }) }));
  console.log(`[${coll}] ${rows.length}건 (${field} ≥ ${from})`);
  return rows;
}
async function settings() {
  const { url, headers } = auth((MODE === 'secure' ? DOCS : OPEN) + '/mkt-settings/main');
  const r = await fetch(url, { headers });
  if (r.status === 404) { console.log('[mkt-settings] 없음 → 기본값'); return {}; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`[mkt-settings] 읽기 실패 ${r.status}`);
  return fsDec({ mapValue: { fields: j.fields || {} } });
}

async function main() {
  TOK = await token();
  const st = { ...C.DEFAULT_SETTINGS, ...(await settings()) };
  const [sales, ads, stock, voc] = await Promise.all([
    query('mkt-sales', 'reportDate', C.addDays(TODAY, -28)),
    query('mkt-ads', 'reportDate', C.addDays(TODAY, -st.adsDays)),
    query('mkt-stock', 'reportDate', C.addDays(TODAY, -30)),
    query('mkt-voc', 'date', C.addDays(TODAY, -29)),
  ]);
  voc.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const body = C.numbersNote({ sales, ads, stock, voc, settings: st, today: TODAY });
  const latest = (rows, f) => rows.reduce((m, x) => (x[f] > m ? x[f] : m), '');
  const counts = { sales: sales.length, ads: ads.length, stock: stock.length, voc: voc.length, salesUpTo: latest(sales, 'reportDate'), adsUpTo: latest(ads, 'reportDate'), stockUpTo: latest(stock, 'reportDate') };
  console.log(`[오늘 숫자] ${TODAY} · ${body.length}자 · 판매 ${counts.salesUpTo || '-'}까지 · 광고 ${counts.adsUpTo || '-'}까지 · 재고 ${counts.stockUpTo || '-'}까지`);
  if (!sales.length && !ads.length && !stock.length) console.log('::warning::판매·광고·재고 리포트가 하나도 없음 — Aside 업로드가 멈췄는지 확인');
  if (E.DRY) { console.log(body); return 0; }
  const doc = { body, date: TODAY, at: new Date().toISOString(), counts, from: 'scripts/mkt-numbers' };
  const { url, headers } = auth(OUT);
  const r = await fetch(url, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsEnc(doc).mapValue.fields }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(`저장 실패 ${r.status}: ${(j.error && j.error.message) || ''}`); }
  console.log('[오늘 숫자] 저장 → pour-os/marketing-hub/mkt-notes/today-numbers');
  return 0;
}
main().then((c) => process.exit(c), (e) => { console.error(`::error::${e.message}`); process.exit(1); });
