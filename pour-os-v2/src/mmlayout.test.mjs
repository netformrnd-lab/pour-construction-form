// 마인드맵 오른쪽으로 뻗는 보기 — 자리 계산 시험 (node src/mmlayout.test.mjs)
import assert from "node:assert/strict";
import { visibleTree, layoutTree, defaultView, curve, MM } from "./mmlayout.js";
let n = 0; const t = (name, fn) => { fn(); n++; };
const leaf = (id) => ({ id, kind: "task", kids: [] });
const br = (id, k) => ({ id, kind: "task", kids: Array.from({ length: k }, (_, i) => leaf(`${id}.${i}`)) });
const root = (kids) => ({ id: "root", kind: "root", kids });
const no = () => false;

t("기본 보기: 폰 계층 · PC 마인드맵 · 고른 것 기억", () => {
  assert.equal(defaultView(null, 375), "tree"); assert.equal(defaultView(null, 699), "tree"); assert.equal(defaultView(null, 700), "map"); assert.equal(defaultView(null, 1280), "map");
  assert.equal(defaultView("map", 375), "map"); assert.equal(defaultView("tree", 1280), "tree"); assert.equal(defaultView("x", 1280), "map");
});
t("8개 넘는 가지는 8개 + '+n개 더' · 9개는 다 · 모두 보기면 다", () => {
  const v = visibleTree(root([br("a", 20), br("b", 9)]), no, no);
  assert.equal(v.vk[0].vk.length, 9); assert.equal(v.vk[0].vk[8].kind, "more"); assert.equal(v.vk[0].vk[8].n, 12); assert.equal(v.vk[0].vk[8].parentId, "a");
  assert.equal(v.vk[1].vk.length, 9); assert.ok(v.vk[1].vk.every((x) => x.kind !== "more"));
  const v2 = visibleTree(root([br("a", 20)]), no, (x) => x.id === "a"); assert.equal(v2.vk[0].vk.length, 20);
  const big = visibleTree(root(Array.from({ length: 30 }, (_, i) => br("p" + i, 3))), no, no); assert.equal(big.vk.length, 9); assert.equal(big.vk[8].n, 22);
});
t("접으면 아래 안 그림 · 숨은 수 · root 는 안 접힘", () => {
  const v = visibleTree(root([br("a", 3), br("b", 2)]), (x) => x.id === "a" || x.id === "root", no);
  assert.equal(v.vk.length, 2); assert.equal(v.vk[0].vk.length, 0); assert.equal(v.vk[0].folded, true); assert.equal(v.vk[0].total, 3); assert.equal(v.vk[1].vk.length, 2);
});
t("자리: 왼쪽 → 오른쪽 · 부모는 아이 가운데 · 겹치지 않음", () => {
  const L = layoutTree(visibleTree(root([br("a", 3), leaf("b"), br("c", 12)]), no, no));
  const by = Object.fromEntries(L.nodes.map((x) => [x.id, x]));
  assert.equal(by.root.x, MM.PAD); assert.ok(by.a.x > by.root.x + by.root.w); assert.ok(by["a.0"].x > by.a.x + by.a.w);
  const mid = (x) => x.y + x.h / 2; assert.ok(Math.abs(mid(by.a) - (mid(by["a.0"]) + mid(by["a.2"])) / 2) < 0.01);
  const cols = {}; L.nodes.forEach((x) => (cols[x.x] = cols[x.x] || []).push(x));
  Object.values(cols).forEach((c) => { c.sort((p, q) => p.y - q.y); for (let i = 1; i < c.length; i++) assert.ok(c[i].y >= c[i - 1].y + c[i - 1].h, `겹침 ${c[i - 1].id} ${c[i].id}`); });
  L.nodes.forEach((x) => { assert.ok(x.x + x.w <= L.W && x.y + x.h <= L.H && x.y >= 0, x.id); });
  assert.equal(L.edges.length, L.nodes.length - 1); assert.ok(by["c~more"]);
});
t("빈 나무 · 곡선", () => {
  const L = layoutTree(visibleTree(root([]), no, no)); assert.equal(L.nodes.length, 1); assert.ok(L.H >= MM.NH);
  assert.equal(curve(0, 0, 10, 10), "M0,0 C5,0 5,10 10,10");
});
t("큰 프로젝트(120개)도 그림 크기 한정", () => {
  const L = layoutTree(visibleTree(root(Array.from({ length: 15 }, (_, i) => br("p" + i, 8))), no, no));
  assert.ok(L.nodes.length < 90 && L.H < 4200, `${L.nodes.length} ${L.H}`);
});
console.log(`${n}개 통과`);
