#!/usr/bin/env node
/**
 * 공법분석(하자사진) 데이터 → pourstorecrm 임포트 스크립트
 *
 * pour-app-new(현 어드민 공법분석)에서 뽑은 JSON을 pourstorecrm Firestore로 옮깁니다.
 * CRM 레포/로컬 어디서든 pourstorecrm 서비스계정만 있으면 실행됩니다.
 *
 * 준비:
 *   npm i firebase-admin
 *   Firebase 콘솔 → pourstorecrm → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON)
 *
 * 실행:
 *   node import-to-crm.mjs --key ./pourstorecrm-sa.json
 *   # 옵션:
 *   #   --photos    <컬렉션명>   (기본 defect-photos)
 *   #   --templates <컬렉션명>   (기본 defect-templates)
 *   #   --config    <문서경로>   (기본 config/defectTypesMeta, 'skip'이면 생략)
 *   #   --dry                    쓰지 않고 건수만 출력
 *   #   --keep-ids               원본 문서 ID 유지(기본). --new-ids 면 자동 ID로 새로 생성
 *
 * 이미지: imageUrl은 그대로 옮겨집니다(마누스 CDN/파이어스토리지 공개 URL).
 *   → CRM에서 URL로 바로 표시됩니다. 마누스 CDN 의존이 부담되면 재호스팅은 별도 진행.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };

const keyPath = opt('key');
const PHOTOS_COLL = opt('photos', 'defect-photos');
const TEMPLATES_COLL = opt('templates', 'defect-templates');
const CONFIG_DOC = opt('config', 'config/defectTypesMeta');
const DRY = !!opt('dry', false);
const NEW_IDS = !!opt('new-ids', false);

if (!keyPath || keyPath === true) {
  console.error('사용법: node import-to-crm.mjs --key ./pourstorecrm-sa.json [--photos defect-photos] [--templates defect-templates] [--config config/defectTypesMeta] [--dry] [--new-ids]');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
if (sa.project_id !== 'pourstorecrm') {
  console.warn(`⚠️  서비스계정 project_id가 '${sa.project_id}' 입니다(예상: pourstorecrm). 계속하려면 5초 대기…`);
}
let db = null;
if (!DRY) {
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  db = admin.firestore();
}

const load = (f) => { try { return JSON.parse(readFileSync(join(__dir, f), 'utf8')); } catch { return null; } };
const photos = load('defect-photos.json') || [];
const templates = load('defect-templates.json') || [];
const config = load('defect-config.json');

const stamp = { migratedFrom: 'pour-app-new', migratedAt: new Date().toISOString() };

async function importColl(coll, rows) {
  if (!rows.length) { console.log(`· ${coll}: 0건(스킵)`); return; }
  console.log(`· ${coll}: ${rows.length}건 ${DRY ? '(dry)' : '쓰기…'}`);
  if (DRY) return;
  let n = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + 400)) {
      const { id, ...data } = row;
      const ref = (NEW_IDS || !id) ? db.collection(coll).doc() : db.collection(coll).doc(id);
      batch.set(ref, { ...data, ...stamp }, { merge: true });
      n++;
    }
    await batch.commit();
    console.log(`  …${Math.min(i + 400, rows.length)}/${rows.length}`);
  }
  console.log(`  ✓ ${coll} ${n}건 완료`);
}

(async () => {
  console.log(`대상 프로젝트: ${sa.project_id} | dry=${DRY} | ids=${NEW_IDS ? '새로' : '유지'}`);
  await importColl(PHOTOS_COLL, photos);
  await importColl(TEMPLATES_COLL, templates);
  if (config && CONFIG_DOC && CONFIG_DOC !== 'skip') {
    const { id, ...data } = config;
    console.log(`· ${CONFIG_DOC}: 태그 ${(data.tags || []).length}개 ${DRY ? '(dry)' : '쓰기…'}`);
    if (!DRY) {
      const [c, d] = CONFIG_DOC.split('/');
      await db.collection(c).doc(d).set({ ...data, ...stamp }, { merge: true });
      console.log('  ✓ config 완료');
    }
  }
  console.log('끝.');
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
