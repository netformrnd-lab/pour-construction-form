#!/usr/bin/env node
/**
 * seed.mjs — seed/data.json 을 신규 Firebase 프로젝트(pourstoreproject) Firestore 에 시딩
 *
 * 사전 준비:
 *   1) node extract.mjs <원본HTML>   → seed/data.json 생성
 *   2) Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *      → 내려받은 JSON 을  seed/serviceAccountKey.json  으로 저장 (⚠️ 커밋 금지)
 *   3) npm install   (seed/ 에서)
 *
 * 실행:  node seed.mjs            (업서트만)
 *        node seed.mjs --prune    (data.json 에 없는 기존 문서까지 정리)
 *
 * 특성:
 *   · 멱등(idempotent) — 문서ID가 결정론적(uid / p+seq)이라 재실행해도 같은 문서를 덮어씀
 *   · 값은 출력하지 않음 — 개수만 로그
 *   · 실패는 삼키지 않고 throw (CLAUDE.md 규칙)
 *   · Admin SDK 는 보안규칙을 우회하므로 시딩에는 인증 게이트 영향 없음
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import admin from 'firebase-admin';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PROJECT_ID = 'pourstoreproject';
const PRUNE = process.argv.includes('--prune');

// ── 입력 로드 ──
const dataPath = path.join(__dirname, 'data.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌ seed/data.json 이 없습니다. 먼저 `node extract.mjs <원본HTML>` 을 실행하세요.');
  process.exit(1);
}
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ seed/serviceAccountKey.json 이 없습니다.');
  console.error('   Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 이 경로에 저장하세요.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
if (serviceAccount.project_id !== PROJECT_ID) {
  console.error(`❌ 서비스 계정 키의 project_id(${serviceAccount.project_id}) 가 대상(${PROJECT_ID}) 과 다릅니다.`);
  console.error('   신규 프로젝트만 연결해야 합니다 — 키를 다시 확인하세요.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
const db = admin.firestore();

const pid = seq => 'p' + String(seq).padStart(4, '0');

// 배치 500개 제한 대응
async function commitInChunks(ops) {
  let batch = db.batch();
  let n = 0, total = 0;
  for (const op of ops) {
    op(batch); n++; total++;
    if (n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
  return total;
}

async function main() {
  // ── channels ──
  const chOps = data.channels.map(c => b => b.set(db.collection('channels').doc(c.uid), c));
  const chN = await commitInChunks(chOps);
  console.log(`[channels] ${chN}건 업서트`);

  // ── products ──
  const prOps = data.products.map(p => b => b.set(db.collection('products').doc(pid(p.seq)), p));
  const prN = await commitInChunks(prOps);
  console.log(`[products] ${prN}건 업서트`);

  // ── config ──
  await db.collection('config').doc('secure').set(data.config.secure);
  await db.collection('config').doc('calc').set(data.config.calc);
  console.log(`[config] 2건 업서트 (secure · calc)`);

  // ── prune (선택) ──
  if (PRUNE) {
    const keepCh = new Set(data.channels.map(c => c.uid));
    const keepPr = new Set(data.products.map(p => pid(p.seq)));
    const [chSnap, prSnap] = await Promise.all([
      db.collection('channels').get(),
      db.collection('products').get(),
    ]);
    const delOps = [];
    chSnap.forEach(d => { if (!keepCh.has(d.id)) delOps.push(b => b.delete(d.ref)); });
    prSnap.forEach(d => { if (!keepPr.has(d.id)) delOps.push(b => b.delete(d.ref)); });
    const delN = await commitInChunks(delOps);
    console.log(`[prune] ${delN}건 삭제 (data.json 에 없는 기존 문서)`);
  }

  console.log('✅ 시딩 완료.');
}

main().catch(e => {
  console.error('❌ 시딩 실패:', e);
  process.exit(1);
});
