// 읽음 표시 폰·PC 같이 (사용자 결정 2026-10-13 "폰, pc 둘중 하나만봐도 연동되어 없어지게해") — 계산만 (시험 seensync.test.mjs · 쓰기는 core.useSeen)
//   서버 pour-os/v2/seen/{나} = {id, ids: {키: 읽은 때 ISO}, at} · 기기 사본 pour-os2-seen-<나> (바로 보이게 · 끊겨도 그대로)
//   키 = '확인할 것' 줄 id (nt:댓글 · ap:확인 완료 · tn:내 차례 · ai… · 묶은 줄은 a|b 와 낱개) — model.todayView · turn.js 가 읽음
//   쓰기는 바뀐 키만 (더한 키 = 읽은 때 · 뺀 키 = deleteField) → 두 기기가 동시에 읽어도 서로 안 지움
//   오래된 키 정리: 400개 넘을 때만 · 60일 넘은 것 · 한 번에 300개까지 (알림 기간은 7~14일이라 다시 뜨지 않음 · 문서 크기 한도 1MB)
export const SEEN_KEEP_DAYS = 60, SEEN_PRUNE_AT = 400, SEEN_PRUNE_MAX = 300, SEEN_UP_CHUNK = 400;

// 바뀐 키 — 더한 것(지금 없던 키) · 뺀 것([안 읽음으로])
export function seenDiff(cur, next) {
  const c = cur || {}, n = next || {};
  return { add: Object.keys(n).filter((k) => n[k] && !c[k]), del: Object.keys(c).filter((k) => c[k] && !n[k]) };
}

// 서버에 쓸 ids 칸 (merge) — 바뀐 게 없으면 null
export function seenPatch(cur, next, at, DEL, now = new Date(at)) {
  const { add, del } = seenDiff(cur, next); if (!add.length && !del.length) return null;
  const ids = {}; add.forEach((k) => { ids[k] = at; }); del.forEach((k) => { ids[k] = DEL; });
  const all = Object.keys(cur || {});
  if (all.length > SEEN_PRUNE_AT) {
    const lim = new Date(now.getTime() - SEEN_KEEP_DAYS * 864e5).toISOString();
    all.filter((k) => !(k in ids) && typeof cur[k] === "string" && cur[k] < lim).slice(0, SEEN_PRUNE_MAX).forEach((k) => { ids[k] = DEL; });
  }
  return ids;
}

// 쓴 칸을 화면 값에 (DEL 은 지움)
export function applySeen(cur, ids, isDel) {
  const o = { ...(cur || {}) };
  Object.entries(ids || {}).forEach(([k, v]) => { if (isDel(v)) delete o[k]; else o[k] = v; });
  return o;
}

// 이 기기 처음 한 번: 예전 방식(이 기기에만 저장)으로 읽은 키 중 서버에 없는 것 → 서버에 (읽은 때 = 지금 · 400개씩 나눠 씀)
export function seenUpload(local, remote, at) {
  const r = remote || {}, keys = Object.keys(local || {}).filter((k) => local[k] && !r[k]);
  const out = []; for (let i = 0; i < keys.length; i += SEEN_UP_CHUNK) out.push(Object.fromEntries(keys.slice(i, i + SEEN_UP_CHUNK).map((k) => [k, at])));
  return out;
}
