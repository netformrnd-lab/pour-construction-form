/**
 * Firestore 데이터 마이그레이션 스크립트
 *
 * pour-app-prod → 새 Firebase 프로젝트로 전체 컬렉션 복사
 *
 * 사용법:
 *   1. .env.migrate 파일 작성 (아래 템플릿 참고)
 *   2. npm install
 *   3. npm run migrate
 *
 * .env.migrate 템플릿:
 *   # 원본 (pour-app-prod)
 *   SOURCE_PROJECT_ID=pour-app-prod
 *   SOURCE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pour-app-prod.iam.gserviceaccount.com
 *   SOURCE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *
 *   # 대상 (새 프로젝트)
 *   TARGET_PROJECT_ID=your-new-project-id
 *   TARGET_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-new-project.iam.gserviceaccount.com
 *   TARGET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */

const admin = require('firebase-admin');
const path = require('path');

// ── .env.migrate 로드 ───────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '..', '.env.migrate') });

const {
  SOURCE_PROJECT_ID,
  SOURCE_CLIENT_EMAIL,
  SOURCE_PRIVATE_KEY,
  TARGET_PROJECT_ID,
  TARGET_CLIENT_EMAIL,
  TARGET_PRIVATE_KEY,
} = process.env;

// ── 필수값 검증 ──────────────────────────────────────────
const requiredVars = {
  SOURCE_PROJECT_ID, SOURCE_CLIENT_EMAIL, SOURCE_PRIVATE_KEY,
  TARGET_PROJECT_ID, TARGET_CLIENT_EMAIL, TARGET_PRIVATE_KEY,
};
for (const [key, val] of Object.entries(requiredVars)) {
  if (!val) throw new Error(`환경 변수 누락: ${key}\n.env.migrate 파일을 확인하세요.`);
}

// ── 마이그레이션 대상 컬렉션 (전체) ──────────────────────
const COLLECTIONS = [
  // 1차 기존
  'leads',
  'leads-store',
  'leads-grohome',
  'leads-method',
  // 아웃바운드
  'outbound-solution',
  'outbound-method',
  'outbound-store',
  'outbound-grohome',
  // 활동/파트너
  'activities',
  'partner-inquiries',
  'dealer-inquiries',
  'site-inquiries',
  'site-metrics',
  'site-resources',
  'partner-companies',
  // 상품/NPS
  'products',
  'nps-surveys',
  // 2차
  'defect-sites',
  'sales-docs',
  // 설정
  'config',
  'app-config',
  // QR
  'qr-stats',
];

// ── Firebase Admin 앱 초기화 (source / target 분리) ──────
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: SOURCE_PROJECT_ID,
    clientEmail: SOURCE_CLIENT_EMAIL,
    privateKey: SOURCE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
}, 'source');

const targetApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: TARGET_PROJECT_ID,
    clientEmail: TARGET_CLIENT_EMAIL,
    privateKey: TARGET_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
}, 'target');

const sourceDb = sourceApp.firestore();
const targetDb = targetApp.firestore();

// ── 유틸: 서브컬렉션 목록 가져오기 ─────────────────────────
async function getSubcollections(docRef) {
  try {
    return await docRef.listCollections();
  } catch {
    return [];
  }
}

// ── 단일 컬렉션 복사 (서브컬렉션 포함) ─────────────────────
async function copyCollection(collectionName) {
  console.log(`\n📦 컬렉션: ${collectionName}`);

  const sourceSnap = await sourceDb.collection(collectionName).get();

  if (sourceSnap.empty) {
    console.log(`   ⏭  비어있음 — 건너뜀`);
    return { name: collectionName, count: 0, subcollections: 0 };
  }

  console.log(`   📄 문서 ${sourceSnap.size}건 발견`);

  let subcolCount = 0;

  // Firestore batch는 최대 500개 — 499개씩 나눠서 처리
  const BATCH_SIZE = 499;
  let batch = targetDb.batch();
  let batchCount = 0;

  for (const doc of sourceSnap.docs) {
    const targetRef = targetDb.collection(collectionName).doc(doc.id);
    batch.set(targetRef, doc.data());
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ✅ ${batchCount}건 배치 커밋`);
      batch = targetDb.batch();
      batchCount = 0;
    }

    // 서브컬렉션 처리 (예: products/{id}/history)
    const subcols = await getSubcollections(sourceDb.collection(collectionName).doc(doc.id));
    for (const subcol of subcols) {
      const subSnap = await subcol.get();
      if (!subSnap.empty) {
        let subBatch = targetDb.batch();
        let subBatchCount = 0;

        for (const subDoc of subSnap.docs) {
          const subTargetRef = targetDb
            .collection(collectionName)
            .doc(doc.id)
            .collection(subcol.id)
            .doc(subDoc.id);
          subBatch.set(subTargetRef, subDoc.data());
          subBatchCount++;

          if (subBatchCount >= BATCH_SIZE) {
            await subBatch.commit();
            subBatch = targetDb.batch();
            subBatchCount = 0;
          }
        }

        if (subBatchCount > 0) {
          await subBatch.commit();
        }

        subcolCount += subSnap.size;
        console.log(`   ↳ 서브컬렉션 ${subcol.id}: ${subSnap.size}건`);
      }
    }
  }

  // 남은 배치 커밋
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✅ ${collectionName}: ${sourceSnap.size}건 완료`);
  return { name: collectionName, count: sourceSnap.size, subcollections: subcolCount };
}

// ── 메인 실행 ─────────────────────────────────────────────
async function runMigration() {
  console.log('═══════════════════════════════════════════');
  console.log('  Firestore 데이터 마이그레이션');
  console.log(`  원본: ${SOURCE_PROJECT_ID}`);
  console.log(`  대상: ${TARGET_PROJECT_ID}`);
  console.log(`  컬렉션: ${COLLECTIONS.length}개`);
  console.log('═══════════════════════════════════════════');

  const results = [];
  let totalDocs = 0;
  let totalSub = 0;

  for (const col of COLLECTIONS) {
    try {
      const result = await copyCollection(col);
      results.push(result);
      totalDocs += result.count;
      totalSub += result.subcollections;
    } catch (err) {
      console.error(`   ❌ ${col} 오류: ${err.message}`);
      results.push({ name: col, count: 0, error: err.message });
    }
  }

  // ── 결과 요약 ─────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  마이그레이션 완료 요약');
  console.log('═══════════════════════════════════════════');

  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.name}: 오류 — ${r.error}`);
    } else if (r.count === 0) {
      console.log(`  ⏭  ${r.name}: 비어있음`);
    } else {
      const sub = r.subcollections > 0 ? ` (+서브컬렉션 ${r.subcollections}건)` : '';
      console.log(`  ✅ ${r.name}: ${r.count}건${sub}`);
    }
  }

  console.log(`\n  총 문서: ${totalDocs}건 + 서브컬렉션 ${totalSub}건`);
  console.log('═══════════════════════════════════════════\n');

  // 앱 정리
  await sourceApp.delete();
  await targetApp.delete();
}

runMigration().catch(err => {
  console.error('\n[마이그레이션 실패]', err);
  process.exit(1);
});
