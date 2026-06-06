/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   pour-backup.js — Firestore 전체 백업 (마이그레이션 전)    ║
 * ║   모든 컬렉션을 JSON으로 덤프 → backup-output/<타임스탬프>/ ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * GitHub Actions에서 마이그레이션 직전에 실행하여 artifact로 보관.
 * 인증: SERVICE_ACCOUNT_KEY 환경변수(JSON) 또는 ./serviceAccountKey.json
 */

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

function loadServiceAccount() {
  if (process.env.SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
  return require("./serviceAccountKey.json");
}

admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()), projectId: "pour-app-new" });
const db = admin.firestore();

(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(process.cwd(), "backup-output", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n💾 Firestore 백업 시작 → backup-output/${stamp}/\n`);
  const cols = await db.listCollections();
  const summary = [];
  let total = 0;

  for (const c of cols) {
    const snap = await db.collection(c.id).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(outDir, `${c.id}.json`), JSON.stringify(docs, null, 2));
    summary.push({ collection: c.id, count: docs.length });
    total += docs.length;
    console.log(`  📦 ${c.id.padEnd(22)} ${docs.length}건`);
  }

  fs.writeFileSync(path.join(outDir, "_summary.json"),
    JSON.stringify({ stamp, project: "pour-app-new", total, collections: summary }, null, 2));

  console.log(`\n✅ 백업 완료: 총 ${total}건 / ${cols.length}개 컬렉션`);
  process.exit(0);
})().catch(e => { console.error("❌ 백업 실패:", e); process.exit(1); });
