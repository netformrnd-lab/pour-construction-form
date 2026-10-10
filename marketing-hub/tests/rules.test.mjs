// 마케팅 허브 보안 규칙 시험 (Firestore 에뮬레이터 · 실제 DB 안 씀)
// 실행: 빈 폴더에서 npm i --legacy-peer-deps firebase-tools @firebase/rules-unit-testing firebase
//       이 파일을 그 폴더로 복사 →
//       npx firebase emulators:exec --only firestore --project demo-mkt "node rules.test.mjs <저장소>/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

const rulesPath = process.argv[2];
const env = await initializeTestEnvironment({
  projectId: 'demo-mkt',
  firestore: { rules: readFileSync(rulesPath, 'utf8'), host: '127.0.0.1', port: 8080 },
});

const OWNER = { uid: 'owner', email: 'netformrnd@gmail.com' };
const ADMIN2 = { uid: 'adm2', email: 'admin2@example.com' };
const ASIDE = { uid: 'aside', email: 'aside@example.com' };
const STRANGER = { uid: 'x', email: 'stranger@example.com' };
const STAFF = { uid: 'staff', email: 'cs@example.com' };

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'mkt-access/roles'), { admins: [ADMIN2.email], uploaders: [ASIDE.email], staffs: [STAFF.email], people: {} });
  await setDoc(doc(db, 'mkt-uploads/old'), { channel: 'naver_ads', reportDate: '2026-10-06', csv: 'a', uploadedBy: 'aside' });
  await setDoc(doc(db, 'mkt-sales/s1'), { qty: 1 });
  await setDoc(doc(db, 'mkt-upload-status/old'), { uploadedBy: 'aside', result: 'ok' });
  await setDoc(doc(db, 'leads/l1'), { name: '기존' });
  await setDoc(doc(db, 'sourcing-cost/c1'), { cost: 1 });
  await setDoc(doc(db, 'mkt-voc/v0'), { product: 'A', type: '불만', text: '기존' });
});

const as = (u) => (u ? env.authenticatedContext(u.uid, { email: u.email }) : env.unauthenticatedContext()).firestore();
const up = (u, extra = {}) => ({ channel: 'naver_ads', reportDate: '2026-10-07', csv: '키워드,총비용,전환매출액\n방수,1000,5000', uploadedBy: u.uid, uploaderEmail: u.email, rowCount: 1, createdAt: serverTimestamp(), ...extra });

const voc = (u, extra = {}) => ({ product: '곰팡이젤', type: '불만', source: '전화', text: '뚜껑이 새요 (번호)', masked: 1, urgent: false, date: '2026-10-10', by: u.uid, byEmail: u.email, createdAt: serverTimestamp(), ...extra });

let n = 0, failed = 0;
async function t(name, p) { n++; try { await p; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '-', e.message); } }

console.log('업로더(Aside)');
const a = as(ASIDE);
await t('uploads 새로 만들기 O', assertSucceeds(addDoc(collection(a, 'mkt-uploads'), up(ASIDE))));
await t('다른 uid 로 만들기 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { uploadedBy: 'owner' }))));
await t('다른 이메일 표기 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { uploaderEmail: 'netformrnd@gmail.com' }))));
await t('모르는 채널 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { channel: 'hack' }))));
await t('날짜 형식 틀림 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { reportDate: '어제' }))));
await t('createdAt 임의값 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { createdAt: new Date('2020-01-01') }))));
await t('정해지지 않은 칸 X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { status: 'done' }))));
await t('빈 CSV X', assertFails(addDoc(collection(a, 'mkt-uploads'), up(ASIDE, { csv: '' }))));
await t('uploads 읽기 X', assertFails(getDoc(doc(a, 'mkt-uploads/old'))));
await t('uploads 목록 X', assertFails(getDocs(collection(a, 'mkt-uploads'))));
await t('기존 업로드 덮어쓰기 X', assertFails(setDoc(doc(a, 'mkt-uploads/old'), up(ASIDE))));
await t('uploads 지우기 X', assertFails(deleteDoc(doc(a, 'mkt-uploads/old'))));
await t('sales 읽기 X', assertFails(getDoc(doc(a, 'mkt-sales/s1'))));
await t('sales 쓰기 X', assertFails(setDoc(doc(a, 'mkt-sales/s2'), { qty: 9 })));
await t('status 읽기 X', assertFails(getDoc(doc(a, 'mkt-upload-status/old'))));
await t('roles 읽기 X', assertFails(getDoc(doc(a, 'mkt-access/roles'))));
await t('roles 고치기(자기 승격) X', assertFails(updateDoc(doc(a, 'mkt-access/roles'), { admins: [ASIDE.email] })));
await t('원가(sourcing-cost) 읽기 X', assertFails(getDoc(doc(a, 'sourcing-cost/c1'))));

await t('고객의 소리 쓰기 X (업로더는 올리기만)', assertFails(addDoc(collection(a, 'mkt-voc'), voc(ASIDE))));

console.log('직원(고객의 소리)');
const st = as(STAFF);
await t('voc 새로 만들기 O', assertSucceeds(addDoc(collection(st, 'mkt-voc'), voc(STAFF))));
await t('하자·안전 O', assertSucceeds(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { type: '하자·안전', urgent: true }))));
await t('다른 uid X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { by: 'owner' }))));
await t('다른 이메일 X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { byEmail: OWNER.email }))));
await t('모르는 종류 X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { type: '스팸' }))));
await t('300자 넘음 X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { text: '가'.repeat(301) }))));
await t('처음부터 끝남 표시 X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { resolved: true }))));
await t('정해지지 않은 칸(전화번호) X', assertFails(addDoc(collection(st, 'mkt-voc'), voc(STAFF, { phone: '01012345678' }))));
await t('voc 읽기 X', assertFails(getDoc(doc(st, 'mkt-voc/v0'))));
await t('voc 목록 X', assertFails(getDocs(collection(st, 'mkt-voc'))));
await t('voc 고치기 X', assertFails(updateDoc(doc(st, 'mkt-voc/v0'), { resolved: true })));
await t('업로드 X', assertFails(addDoc(collection(st, 'mkt-uploads'), up(STAFF))));
await t('sales 읽기 X', assertFails(getDoc(doc(st, 'mkt-sales/s1'))));
await t('AI 팀 기록 읽기 X', assertFails(getDocs(collection(st, 'mkt-team'))));

console.log('관리자');
const o = as(OWNER), a2 = as(ADMIN2);
await t('대표: voc 읽기 O', assertSucceeds(getDocs(collection(o, 'mkt-voc'))));
await t('대표: voc 끝남 표시 O', assertSucceeds(updateDoc(doc(o, 'mkt-voc/v0'), { resolved: true })));
await t('대표: voc 쓰기 O', assertSucceeds(addDoc(collection(o, 'mkt-voc'), voc(OWNER))));
await t('대표: 옮기기(지난 날짜 그대로) O', assertSucceeds(setDoc(doc(o, 'mkt-voc/old2'), { product: 'A', type: '불만', text: '옛', date: '2026-10-01', createdAt: new Date('2026-10-01'), resolved: true })));
await t('대표: AI 팀 기록 쓰기 O', assertSucceeds(setDoc(doc(o, 'mkt-team/pori'), { last: 'x' })));
await t('대표: uploads 읽기 O', assertSucceeds(getDocs(collection(o, 'mkt-uploads'))));
await t('대표: sales 쓰기 O', assertSucceeds(setDoc(doc(o, 'mkt-sales/s2'), { qty: 2 })));
await t('대표: status 쓰기 O', assertSucceeds(setDoc(doc(o, 'mkt-upload-status/x'), { result: 'ok' })));
await t('대표: roles 쓰기 O', assertSucceeds(updateDoc(doc(o, 'mkt-access/roles'), { people: { a: 1 } })));
await t('대표: 업로드 O', assertSucceeds(addDoc(collection(o, 'mkt-uploads'), up(OWNER))));
await t('대표: 업로드 지우기 O', assertSucceeds(deleteDoc(doc(o, 'mkt-uploads/old'))));
await t('roles 관리자: ads 읽기 O', assertSucceeds(getDocs(collection(a2, 'mkt-ads'))));
await t('roles 관리자: stock 쓰기 O', assertSucceeds(setDoc(doc(a2, 'mkt-stock/x'), { available: 1 })));

console.log('그 밖');
const s = as(STRANGER), anon = as(null);
await t('등록 안 된 로그인: 업로드 X', assertFails(addDoc(collection(s, 'mkt-uploads'), up(STRANGER))));
await t('등록 안 된 로그인: voc X', assertFails(addDoc(collection(s, 'mkt-voc'), voc(STRANGER))));
await t('등록 안 된 로그인: sales 읽기 X', assertFails(getDoc(doc(s, 'mkt-sales/s1'))));
await t('비로그인: 업로드 X', assertFails(addDoc(collection(anon, 'mkt-uploads'), (({ uploaderEmail, ...r }) => r)(up({ uid: 'z' })))));
await t('비로그인: sales 읽기 X', assertFails(getDoc(doc(anon, 'mkt-sales/s1'))));
await t('비로그인: roles 읽기 X', assertFails(getDoc(doc(anon, 'mkt-access/roles'))));
await t('기존 공개 컬렉션(leads)은 그대로 O', assertSucceeds(getDoc(doc(anon, 'leads/l1'))));

await env.cleanup();
console.log(`\n${n - failed}/${n} 통과`);
process.exit(failed ? 1 : 0);
