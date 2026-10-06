// 오른쪽으로 뻗는 마인드맵 — 자리 계산 (저장 없음 · 화면 그림만)
//  나무 = { id, kids: [...] } (root → 큰 가지 → 작은 가지 …)
//  접기: fold(id) 가 true 면 그 아래 안 그림(foldedN = 숨은 수) · 9개 이상 가지는 8개 + '+n개 더' 칸(more) — 누르면 다 펼침
export const MM = { PAD: 14, W0: 176, NW: 204, NH: 46, MH: 34, XG: 70, GAP: 10, BGAP: 8, LIMIT: 8 };

// 보일 나무: 접힌 것 · 8개 넘는 가지 정리
//  fold(n) → bool · showAll(n) → bool(그 가지 '+n개 더'를 눌렀거나 모두 펼치기)
export function visibleTree(n, fold, showAll, lim = MM.LIMIT) {
  const kids = n.kids || [];
  if (!kids.length) return { ...n, vk: [], total: 0 };
  if (n.kind !== "root" && fold(n)) return { ...n, vk: [], total: kids.length, folded: true };
  const many = kids.length > lim + 1 && !showAll(n);   // 9개면 그냥 다 (+1 칸 만들 바에)
  const shown = many ? kids.slice(0, lim) : kids;
  const vk = shown.map((k) => visibleTree(k, fold, showAll, lim));
  if (many) vk.push({ id: n.id + "~more", kind: "more", parentId: n.id, n: kids.length - lim, vk: [], total: 0 });
  return { ...n, vk, total: kids.length };
}

// 자리: 왼쪽 = root, 깊이마다 오른쪽 한 칸 · 잎은 위에서부터 차례로 · 부모는 아이들 가운데
//  rootMax = 뿌리(프로젝트) 가운데를 이 높이 안에 둠 — 가지가 길어도 처음 화면에 프로젝트가 보이게 (곡선이 아래로 뻗음)
//  → { nodes: [{...n, x, y, w, h, depth}], edges: [{from, to}], W, H }
export function layoutTree(vt, { rootMax } = {}) {
  const { PAD, W0, NW, NH, MH, XG, GAP, BGAP } = MM;
  const nodes = [], edges = []; let y = PAD, maxX = 0;
  const xOf = (d) => (d === 0 ? PAD : PAD + W0 + XG + (d - 1) * (NW + XG));
  const place = (n, d) => {
    const o = { ...n, depth: d, x: xOf(d), w: d === 0 ? W0 : NW, h: n.kind === "more" ? MH : NH };
    nodes.push(o); maxX = Math.max(maxX, o.x + o.w);
    if (!n.vk.length) { o.y = y; y += o.h + GAP; return o; }
    const ks = n.vk.map((k) => { const c = place(k, d + 1); edges.push({ from: o, to: c }); if (d === 0) y += BGAP; return c; });
    const a = ks[0], b = ks[ks.length - 1];
    o.y = (a.y + a.h / 2 + b.y + b.h / 2) / 2 - o.h / 2;
    if (o.y < PAD) o.y = PAD;
    y = Math.max(y, o.y + o.h + GAP);
    return o;
  };
  const r = place(vt, 0);
  if (rootMax && r.y + r.h / 2 > rootMax) r.y = Math.max(PAD, rootMax - r.h / 2);
  if (vt.vk.length) y -= BGAP;
  return { nodes, edges, W: Math.ceil(maxX + 40 + PAD), H: Math.ceil(Math.max(y - GAP + PAD, NH + PAD * 2)) };
}

// 곡선 (부모 오른쪽 → 아이 왼쪽)
export const curve = (x1, y1, x2, y2) => { const m = x1 + (x2 - x1) * 0.5; return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`; };

// 처음 보기 기본: 화면 폭 700 아래(폰) = 계층 · 그 위(PC) = 마인드맵 · 기기에 고른 것이 있으면 그것
export const defaultView = (saved, width) => (saved === "tree" || saved === "map" ? saved : width < 700 ? "tree" : "map");
