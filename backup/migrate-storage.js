/**
 * Firebase Storage 파일 마이그레이션 스크립트
 *
 * pour-app-prod Storage → pour-app-new Storage로 모든 파일 복사
 * + Firestore 내 Storage URL 일괄 업데이트
 * + index.html 하드코딩 URL은 별도 수동 처리
 *
 * 사용법:
 *   node migrate-storage.js
 */

const admin = require('firebase-admin');
const path = require('path');

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
  if (!val) throw new Error(`환경 변수 누락: ${key}`);
}

// ── Firebase Admin 앱 초기화 ─────────────────────────────
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: SOURCE_PROJECT_ID,
    clientEmail: SOURCE_CLIENT_EMAIL,
    privateKey: SOURCE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: `${SOURCE_PROJECT_ID}.firebasestorage.app`,
}, 'source');

const targetApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: TARGET_PROJECT_ID,
    clientEmail: TARGET_CLIENT_EMAIL,
    privateKey: TARGET_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: `${TARGET_PROJECT_ID}.firebasestorage.app`,
}, 'target');

const sourceBucket = sourceApp.storage().bucket();
const targetBucket = targetApp.storage().bucket();
const sourceDb = sourceApp.firestore();
const targetDb = targetApp.firestore();

// ── Storage 파일 복사 ─────────────────────────────────────
async function copyStorageFiles() {
  console.log('\n📦 Storage 파일 목록 조회 중...');

  const [files] = await sourceBucket.getFiles();

  if (files.length === 0) {
    console.log('   ⏭  Storage에 파일이 없습니다.');
    return { copied: 0, failed: 0, urlMap: {} };
  }

  console.log(`   📄 ${files.length}개 파일 발견\n`);

  let copied = 0;
  let failed = 0;
  const urlMap = {}; // old URL -> new URL 매핑

  for (const file of files) {
    try {
      const filePath = file.name;
      console.log(`   복사 중: ${filePath}`);

      // 파일 다운로드
      const [content] = await file.download();
      const [metadata] = await file.getMetadata();

      // 대상 버킷에 업로드
      const targetFile = targetBucket.file(filePath);
      await targetFile.save(content, {
        contentType: metadata.contentType || 'application/octet-stream',
        metadata: {
          metadata: metadata.metadata || {},
        },
      });

      // 공개 URL 생성 (다운로드 토큰 포함)
      const { v4: uuidv4 } = require('uuid');
      const token = uuidv4();
      await targetFile.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
      });

      const oldUrl = `https://firebasestorage.googleapis.com/v0/b/${SOURCE_PROJECT_ID}.firebasestorage.app/o/${encodeURIComponent(filePath).replace(/%2F/g, '%2F')}?alt=media`;
      const newUrl = `https://firebasestorage.googleapis.com/v0/b/${TARGET_PROJECT_ID}.firebasestorage.app/o/${encodeURIComponent(filePath).replace(/%2F/g, '%2F')}?alt=media&token=${token}`;

      urlMap[oldUrl] = newUrl;

      copied++;
      console.log(`   ✅ ${filePath}`);
    } catch (err) {
      failed++;
      console.error(`   ❌ ${file.name}: ${err.message}`);
    }
  }

  console.log(`\n   Storage 복사 완료: ${copied}건 성공, ${failed}건 실패`);
  return { copied, failed, urlMap };
}

// ── Firestore 내 Storage URL 업데이트 ────────────────────
async function updateFirestoreUrls(urlMap) {
  console.log('\n📝 Firestore 내 Storage URL 업데이트 중...');

  const oldBucket = `${SOURCE_PROJECT_ID}.firebasestorage.app`;
  const newBucket = `${TARGET_PROJECT_ID}.firebasestorage.app`;

  // config 컬렉션의 문서들 (casePhotos, probPhotos 등)
  const configDocs = ['casePhotos', 'probPhotos', 'staffList'];
  let updated = 0;

  for (const docId of configDocs) {
    try {
      const doc = await targetDb.collection('config').doc(docId).get();
      if (!doc.exists) continue;

      let data = JSON.stringify(doc.data());
      const hadOldUrl = data.includes(oldBucket);

      if (hadOldUrl) {
        // 모든 old bucket 참조를 new bucket으로 교체
        data = data.replace(new RegExp(oldBucket.replace(/\./g, '\\.'), 'g'), newBucket);

        await targetDb.collection('config').doc(docId).set(JSON.parse(data));
        updated++;
        console.log(`   ✅ config/${docId}: URL 업데이트 완료`);
      } else {
        console.log(`   ⏭  config/${docId}: 변경 없음`);
      }
    } catch (err) {
      console.error(`   ❌ config/${docId}: ${err.message}`);
    }
  }

  // leads 컬렉션 문서들도 확인
  const leadsCollections = ['leads', 'leads-store', 'leads-grohome', 'leads-method'];
  for (const colName of leadsCollections) {
    try {
      const snap = await targetDb.collection(colName).get();
      for (const doc of snap.docs) {
        let data = JSON.stringify(doc.data());
        if (data.includes(oldBucket)) {
          data = data.replace(new RegExp(oldBucket.replace(/\./g, '\\.'), 'g'), newBucket);
          await targetDb.collection(colName).doc(doc.id).set(JSON.parse(data));
          updated++;
          console.log(`   ✅ ${colName}/${doc.id}: URL 업데이트`);
        }
      }
    } catch (err) {
      console.error(`   ❌ ${colName}: ${err.message}`);
    }
  }

  console.log(`\n   Firestore URL 업데이트: ${updated}건`);
}

// ── 메인 실행 ─────────────────────────────────────────────
async function run() {
  console.log('═══════════════════════════════════════════');
  console.log('  Firebase Storage 마이그레이션');
  console.log(`  원본: ${SOURCE_PROJECT_ID}`);
  console.log(`  대상: ${TARGET_PROJECT_ID}`);
  console.log('═══════════════════════════════════════════');

  // 1. Storage 파일 복사
  const { copied, failed, urlMap } = await copyStorageFiles();

  // 2. Firestore URL 업데이트
  await updateFirestoreUrls(urlMap);

  console.log('\n═══════════════════════════════════════════');
  console.log('  완료!');
  console.log(`  Storage: ${copied}건 복사`);
  console.log('  ⚠️  index.html의 하드코딩 URL도 업데이트 필요');
  console.log('═══════════════════════════════════════════\n');

  await sourceApp.delete();
  await targetApp.delete();
}

run().catch(err => {
  console.error('\n[마이그레이션 실패]', err);
  process.exit(1);
});
