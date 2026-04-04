/**
 * Firestore → JSON 자동 백업 스크립트
 *
 * 동작:
 *   1. Firestore 지정 컬렉션 전체 읽기 (소프트딜리트 포함)
 *   2. JSON 파일로 로컬 저장
 *   3. GitHub repo backup 브랜치에 자동 커밋
 *
 * 실행:
 *   npm run backup:dev    (개발 환경)
 *   npm run backup:prod   (프로덕션 환경)
 */

const admin = require('firebase-admin');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

// ── 환경 변수 로드 ───────────────────────────────────────
const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  GITHUB_TOKEN,
  GITHUB_REPO,
  GITHUB_BACKUP_BRANCH = 'backup/firestore-snapshots',
  BACKUP_COLLECTIONS = 'leads,leads-store,leads-grohome,leads-method,activities,site-resources,partner-companies',
  NODE_ENV = 'development',
} = process.env;

// ── 필수값 검증 ──────────────────────────────────────────
const required = { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GITHUB_TOKEN, GITHUB_REPO };
for (const [key, val] of Object.entries(required)) {
  if (!val) throw new Error(`환경 변수 누락: ${key}`);
}

// ── Firebase Admin 초기화 ────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ── 유틸: 날짜 문자열 ─────────────────────────────────────
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── 유틸: Firestore Timestamp → ISO 문자열 변환 ──────────
function serializeDoc(data) {
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val.toDate === 'function') {
      result[key] = val.toDate().toISOString();
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = serializeDoc(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ── 컬렉션 전체 읽기 (소프트딜리트 포함) ───────────────────
async function readCollection(collectionName) {
  console.log(`  읽는 중: ${collectionName}`);
  const snapshot = await db.collection(collectionName).get();
  console.log(`  → ${snapshot.size}건 (deleted 포함)`);

  return snapshot.docs.map(doc => ({
    _id: doc.id,
    ...serializeDoc(doc.data()),
  }));
}

// ── GitHub 브랜치 존재 확인 / 없으면 생성 ──────────────────
async function ensureBranch([owner, repo]) {
  try {
    await octokit.repos.getBranch({ owner, repo, branch: GITHUB_BACKUP_BRANCH });
  } catch (e) {
    if (e.status === 404) {
      const { data: mainRef } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
      await octokit.git.createRef({
        owner, repo,
        ref: `refs/heads/${GITHUB_BACKUP_BRANCH}`,
        sha: mainRef.object.sha,
      });
      console.log(`  브랜치 생성: ${GITHUB_BACKUP_BRANCH}`);
    } else {
      throw e;
    }
  }
}

// ── GitHub에 파일 커밋 ────────────────────────────────────
async function commitToGitHub(owner, repo, filePath, content, message) {
  const encoded = Buffer.from(content, 'utf-8').toString('base64');

  // 기존 파일 SHA 조회 (업데이트 시 필요)
  let sha;
  try {
    const { data } = await octokit.repos.getContent({
      owner, repo, path: filePath, ref: GITHUB_BACKUP_BRANCH,
    });
    sha = data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: filePath,
    message,
    content: encoded,
    branch: GITHUB_BACKUP_BRANCH,
    ...(sha && { sha }),
  });
}

// ── 메인 백업 실행 ────────────────────────────────────────
async function runBackup() {
  const timestamp = getTimestamp();
  const env = NODE_ENV === 'production' ? 'prod' : 'dev';
  const collections = BACKUP_COLLECTIONS.split(',').map(c => c.trim()).filter(Boolean);
  const [owner, repo] = GITHUB_REPO.split('/');

  console.log(`\n[POUR 백업 시작] ${timestamp} / 환경: ${env}`);
  console.log(`프로젝트: ${FIREBASE_PROJECT_ID}`);
  console.log(`컬렉션: ${collections.join(', ')}\n`);

  // 로컬 임시 폴더
  const localDir = path.join(__dirname, `tmp-backup-${timestamp}`);
  fs.mkdirSync(localDir, { recursive: true });

  // GitHub 브랜치 확인
  await ensureBranch([owner, repo]);

  const summary = { timestamp, env, project: FIREBASE_PROJECT_ID, collections: {} };

  for (const col of collections) {
    try {
      const docs = await readCollection(col);
      const json = JSON.stringify(docs, null, 2);

      // 로컬 저장
      const localFile = path.join(localDir, `${col}.json`);
      fs.writeFileSync(localFile, json, 'utf-8');

      // GitHub 커밋
      const githubPath = `backups/${env}/${timestamp}/${col}.json`;
      await commitToGitHub(
        owner, repo, githubPath, json,
        `backup(${env}): ${col} — ${docs.length}건 [${timestamp}]`
      );

      // 최신 스냅샷도 latest/ 에 덮어쓰기 (빠른 조회용)
      const latestPath = `backups/${env}/latest/${col}.json`;
      await commitToGitHub(
        owner, repo, latestPath, json,
        `backup(${env}): latest ${col} 갱신`
      );

      summary.collections[col] = { count: docs.length, status: 'ok' };
      console.log(`  ✓ ${col}: ${docs.length}건 커밋 완료`);
    } catch (err) {
      summary.collections[col] = { status: 'error', error: err.message };
      console.error(`  ✗ ${col}: 오류 — ${err.message}`);
    }
  }

  // 요약 파일 커밋
  const summaryPath = `backups/${env}/latest/_summary.json`;
  await commitToGitHub(
    owner, repo, summaryPath,
    JSON.stringify(summary, null, 2),
    `backup(${env}): 요약 갱신 [${timestamp}]`
  );

  // 로컬 임시 파일 정리
  fs.rmSync(localDir, { recursive: true, force: true });

  console.log(`\n[완료] 백업 성공 — ${Object.keys(summary.collections).length}개 컬렉션`);
  return summary;
}

runBackup().catch(err => {
  console.error('[백업 실패]', err);
  process.exit(1);
});
