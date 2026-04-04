/**
 * 소프트 딜리트 유틸리티
 *
 * 실수로 Firestore 문서를 영구 삭제하지 않도록
 * deleted 플래그와 deletedAt 타임스탬프를 사용합니다.
 *
 * 사용법 (admin.html, index.html에서 동일 패턴 적용):
 *
 *   // 삭제 (소프트)
 *   await softDelete(db, 'leads', docId);
 *
 *   // 복구
 *   await restore(db, 'leads', docId);
 *
 *   // 활성 문서만 쿼리 (Firestore orderBy 사용 금지 — 클라이언트 정렬)
 *   const docs = await getActive(db, 'leads');
 *   docs.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
 *
 *   // 30일 지난 소프트딜리트 문서 영구 삭제 (배치 실행용)
 *   await purgeOld(db, 'leads', 30);
 */

const SOFT_DELETE_FIELDS = {
  deleted: true,
  deletedAt: new Date().toISOString(),
};

// ── 소프트 딜리트 ─────────────────────────────────────────
async function softDelete(db, collection, docId, deletedBy = null) {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error(`문서 없음: ${collection}/${docId}`);
  if (snap.data().deleted) {
    console.warn(`이미 삭제됨: ${collection}/${docId}`);
    return;
  }

  await ref.update({
    deleted: true,
    deletedAt: new Date().toISOString(),
    ...(deletedBy && { deletedBy }),
  });

  console.log(`소프트딜리트 완료: ${collection}/${docId}`);
}

// ── 복구 ─────────────────────────────────────────────────
async function restore(db, collection, docId) {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error(`문서 없음: ${collection}/${docId}`);

  await ref.update({
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  });

  console.log(`복구 완료: ${collection}/${docId}`);
}

// ── 활성 문서만 조회 (deleted != true) ───────────────────
async function getActive(db, collection) {
  // NOTE: Firestore where + orderBy 조합은 복합 인덱스 필요 → where만 사용, 정렬은 클라이언트
  const snap = await db.collection(collection)
    .where('deleted', '!=', true)
    .get();

  console.log(`${collection} 활성 문서: ${snap.size}건`);
  return snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
}

// ── 오래된 소프트딜리트 영구 삭제 (배치) ─────────────────
async function purgeOld(db, collection, retentionDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffISO = cutoff.toISOString();

  const snap = await db.collection(collection)
    .where('deleted', '==', true)
    .get();

  const toDelete = snap.docs.filter(doc => {
    const deletedAt = doc.data().deletedAt;
    return deletedAt && deletedAt < cutoffISO;
  });

  if (toDelete.length === 0) {
    console.log(`${collection}: 영구 삭제 대상 없음`);
    return 0;
  }

  // Firestore 배치: 500건 제한
  const BATCH_SIZE = 499;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toDelete.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
  }

  console.log(`${collection}: ${deleted}건 영구 삭제 완료 (${retentionDays}일 초과)`);
  return deleted;
}

module.exports = { softDelete, restore, getActive, purgeOld };
