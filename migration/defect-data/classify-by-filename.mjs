#!/usr/bin/env node
/**
 * 원본 사진 → 파일명 매칭 → 마누스 분류 그대로 적용 (Firebase Storage + Firestore)
 *
 * 사장님이 "원본 사진"을 Firebase Storage 한 폴더에 원래 파일명 그대로 올리면,
 * 이 스크립트가 파일명으로 마누스 분류(공법·하자유형·설명·라벨)를 찾아
 * 그 사진을 가리키는 defect-photos 문서를 자동 생성합니다.
 *
 * 매칭 원리:
 *   마누스 CDN 파일명 = 원본이름 + "_<해시>" (예: KakaoTalk_..._20_c03b0d53.jpg)
 *   → 해시를 뗀 원본이름으로 매칭. (defect-classification-by-filename.json 사용)
 *
 * 준비:
 *   npm i firebase-admin
 *   Firebase 콘솔 → (대상 프로젝트) → 프로젝트 설정 → 서비스 계정 → 새 비공개 키(JSON)
 *   원본 사진을 Storage 폴더에 업로드 (기본 prefix: defect-originals/)
 *
 * 실행:
 *   node classify-by-filename.mjs --key ./sa.json --bucket <프로젝트>.appspot.com
 *   # 옵션:
 *   #   --prefix  defect-originals/     Storage 내 원본 폴더(기본)
 *   #   --coll    defect-photos         쓸 Firestore 컬렉션(기본)
 *   #   --public                        업로드 파일을 공개로 전환해 공개 URL 사용(기본 on)
 *   #   --dry                           쓰지 않고 매칭 결과만 리포트
 *
 * 결과: 매칭/미매칭 목록을 콘솔에 출력하고, 미매칭은 classify-report.json 으로 저장.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };

const keyPath = opt('key');
const bucketName = opt('bucket');
const PREFIX = String(opt('prefix', 'defect-originals/')).replace(/^\/+/, '');
const COLL = opt('coll', 'defect-photos');
const DRY = !!opt('dry', false);
const MAKE_PUBLIC = opt('public', true) !== false;

if (!keyPath || keyPath === true || (!DRY && (!bucketName || bucketName === true))) {
  console.error('사용법: node classify-by-filename.mjs --key ./sa.json --bucket <프로젝트>.appspot.com [--prefix defect-originals/] [--coll defect-photos] [--dry]');
  process.exit(1);
}

const MAP = JSON.parse(readFileSync(join(__dir, 'defect-classification-by-filename.json'), 'utf8'));
const norm = (s) => decodeURIComponent(String(s).split('/').pop()).toLowerCase().trim();
const lookup = (filename) => MAP[norm(filename)] || null;
const nowIso = () => new Date().toISOString();

async function run() {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  console.log(`대상: ${sa.project_id} | bucket=${bucketName || '(dry)'} | prefix=${PREFIX} | coll=${COLL} | dry=${DRY}`);

  let files = [];
  let bucket = null, db = null;
  if (!DRY) {
    const admin = (await import('firebase-admin')).default;
    admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: bucketName });
    bucket = admin.storage().bucket();
    db = admin.firestore();
    const [objs] = await bucket.getFiles({ prefix: PREFIX });
    files = objs.filter(f => !f.name.endsWith('/'));
  } else {
    console.log('(dry) Storage 접근 없이 매핑표만 점검합니다.');
  }

  const matched = [], unmatchedFiles = [];
  const usedKeys = new Set();

  for (const f of files) {
    const rec = lookup(f.name);
    if (!rec) { unmatchedFiles.push(f.name); continue; }
    usedKeys.add(rec.key);
    let imageUrl;
    if (MAKE_PUBLIC) { try { await f.makePublic(); } catch (e) { /* uniform access 등 */ } imageUrl = `https://storage.googleapis.com/${bucketName}/${encodeURI(f.name)}`; }
    else { const [u] = await f.getSignedUrl({ action: 'read', expires: '2099-12-31' }); imageUrl = u; }

    const doc = {
      imageUrl, storagePath: f.name, originalName: rec.originalName,
      method: rec.method, methods: rec.methods, defectType: rec.defectType, defectTypes: rec.defectTypes,
      description: rec.description, label: rec.label,
      source: 'manus-rehosted', createdAt: nowIso(), updatedAt: nowIso(),
    };
    await db.collection(COLL).add(doc);
    matched.push({ file: f.name, defectType: rec.defectType, method: rec.method });
  }

  const unmatchedRecords = Object.values(MAP).filter(r => !usedKeys.has(r.key) && !r.alreadyFirebase);
  console.log(`\n매칭 성공: ${matched.length}`);
  console.log(`미매칭 업로드파일(매핑표에 없음): ${unmatchedFiles.length}`);
  console.log(`아직 안 올라온 원본(매핑표엔 있으나 파일 없음): ${unmatchedRecords.length}`);
  writeFileSync(join(__dir, 'classify-report.json'), JSON.stringify({ matched, unmatchedFiles, unmatchedRecords: unmatchedRecords.map(r => r.originalName) }, null, 2));
  console.log('리포트 저장: classify-report.json');
  if (DRY) console.log('\n※ dry 모드: 실제 원본 업로드 후 --bucket 지정해 다시 실행하세요.');
  process.exit(0);
}
run().catch(e => { console.error('실패:', e.message); process.exit(1); });
