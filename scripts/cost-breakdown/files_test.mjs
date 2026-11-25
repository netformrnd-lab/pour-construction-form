// 분해원가 파일 보관(R2) 서버 함수 시험 — 가짜 로그인 키 · 가짜 버킷 · 가짜 config/access (실제 Cloudflare·Firebase 안 씀)
// 사용: node files_test.mjs [functions/api/cost-files/[[path]].js]
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import assert from "node:assert"; import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, "..", "..", "functions", "api", "cost-files", "[[path]].js");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "costfiles-")), "fn.mjs"); fs.copyFileSync(src, tmp);
const { onRequest } = await import(pathToFileURL(tmp).href);

// ── 가짜 구글 로그인 키 (kid k1) + 다른 키(k9 · 서명 위조용)
const PROJECT = "pourstoreproject", JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const gen = () => crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const K1 = await gen(), K9 = await gen();
const pub1 = { ...(await crypto.subtle.exportKey("jwk", K1.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const b64u = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
async function token(email, o = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: "RS256", kid: o.kid || "k1", typ: "JWT" };
  const pay = { iss: "https://securetoken.google.com/" + (o.proj || PROJECT), aud: o.proj || PROJECT, sub: "u-" + email, email, email_verified: o.verified !== false, iat: now - 10, exp: o.exp ?? now + 3600, auth_time: now - 10 };
  const h = b64u(JSON.stringify(head)), p = b64u(JSON.stringify(pay));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", (o.signWith || K1).privateKey, new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64u(new Uint8Array(sig));
}
// ── 가짜 config/access (보안 규칙과 같은 칸)
let accessFail = false;
const arr = (l) => ({ arrayValue: { values: l.map((s) => ({ stringValue: s })) } });
const ACCESS = { fields: { masterEmail: { stringValue: "owner@test.kr" }, masterEmails: arr(["m2@test.kr"]), subMasterEmails: arr(["sub@test.kr"]), mgmtEmails: arr(["mgmt@test.kr"]), teamEmails: arr(["team@test.kr"]), allowedEmails: arr(["reader@test.kr"]) } };
let fetches = 0;
globalThis.fetch = async (url, init = {}) => {
  fetches++; url = String(url);
  if (url === JWKS) return new Response(JSON.stringify({ keys: [pub1] }), { status: 200 });
  if (url === `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/config/access`) {
    if (accessFail) return new Response("{}", { status: 500 });
    assert.ok(/^Bearer .+\..+\..+$/.test((init.headers || {}).Authorization || ""), "config/access 는 그 사람 토큰으로 읽음");
    return new Response(JSON.stringify(ACCESS), { status: 200 });
  }
  throw new Error("예상 밖 fetch " + url);
};
// ── 가짜 R2 버킷 (R2 API 모양: put/get/head/delete/list)
class MemR2 {
  constructor() { this.m = new Map(); }
  _o(key, v, body) { return { key, size: v.data.byteLength, uploaded: v.uploaded, httpMetadata: v.httpMetadata, customMetadata: v.customMetadata, etag: "e" + key.length,
    writeHttpMetadata: (h) => { if (v.httpMetadata && v.httpMetadata.contentType) h.set("Content-Type", v.httpMetadata.contentType); },
    ...(body ? { body: new Blob([v.data]).stream(), arrayBuffer: async () => v.data.buffer.slice(v.data.byteOffset, v.data.byteOffset + v.data.byteLength) } : {}) }; }
  async put(key, data, o = {}) { const u8 = data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : new Uint8Array(await new Response(data).arrayBuffer());
    if (o.sha256) { const h = Buffer.from(await crypto.subtle.digest("SHA-256", u8)).toString("hex"); assert.equal(h, o.sha256, "put sha256 확인"); }
    this.m.set(key, { data: u8, uploaded: new Date(), httpMetadata: o.httpMetadata || {}, customMetadata: o.customMetadata || {} }); return this._o(key, this.m.get(key)); }
  async get(key) { const v = this.m.get(key); return v ? this._o(key, v, true) : null; }
  async head(key) { const v = this.m.get(key); return v ? this._o(key, v) : null; }
  async delete(keys) { [].concat(keys).forEach((k) => this.m.delete(k)); }
  async list(o = {}) { const objects = [...this.m.keys()].filter((k) => k.startsWith(o.prefix || "")).sort().slice(0, o.limit || 1000).map((k) => this._o(k, this.m.get(k))); return { objects, truncated: false }; }
}
let R2 = new MemR2(), waits = [];
const BASE = "https://x.pour-construction-form.pages.dev/api/cost-files/";
async function call(p, { method = "GET", tok, body, headers = {}, bind = true, env = {} } = {}) {
  const [pth, qs] = p.split("?");
  const req = new Request(BASE + p, { method, body, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), ...headers } });
  const res = await onRequest({ request: req, env: { ...(bind ? { QUOTE_FILES: R2 } : {}), FIREBASE_PROJECT_ID: PROJECT, ...env }, params: { path: pth.split("/").filter(Boolean) }, waitUntil: (pr) => waits.push(pr) });
  const ct = res.headers.get("Content-Type") || ""; const data = /json/.test(ct) ? await res.json() : new Uint8Array(await res.arrayBuffer());
  return { s: res.status, d: data, h: res.headers };
}
let n = 0; const ok = async (name, f) => { await f(); n++; console.log("  ✓", name); };
const PDF = new TextEncoder().encode("%PDF-1.4\n가짜 견적서 1\n%%EOF"), PDF2 = new TextEncoder().encode("%PDF-1.7\n가짜 견적서 2\n%%EOF");
const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3]);
const HEIC = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);
const T = { owner: await token("owner@test.kr"), m2: await token("m2@test.kr"), sub: await token("sub@test.kr"), mgmt: await token("mgmt@test.kr"), team: await token("team@test.kr"), reader: await token("reader@test.kr"),
  unver: await token("owner@test.kr", { verified: false }), forged: await token("owner@test.kr", { signWith: K9 }), otherProj: await token("owner@test.kr", { proj: "other-app" }), expired: await token("owner@test.kr", { exp: Math.floor(Date.now() / 1000) - 600 }), badKid: await token("owner@test.kr", { kid: "zz" }) };
const up = (kind, tok, body, name = "견적서 11월.pdf") => call("upload?kind=" + kind, { method: "POST", tok, body, headers: { "X-File-Name": encodeURIComponent(name) } });

console.log("■ 준비 상태 (버킷 연결 전·후)");
await ok("연결 전: status ready=false · 올리기 = 503 '파일 보관 준비 중' (로그인 확인도 안 함)", async () => {
  const s = await call("status", { bind: false }); assert.equal(s.s, 200); assert.equal(s.d.ready, false);
  const u = await call("upload?kind=quote", { method: "POST", bind: false, tok: T.owner, body: PDF }); assert.equal(u.s, 503); assert.match(u.d.error, /준비 중/); });
await ok("연결 후: status ready=true · 20MB · 휴지통 30일", async () => { const s = await call("status"); assert.equal(s.d.ready, true); assert.equal(s.d.maxMB, 20); assert.equal(s.d.trashDays, 30); });

console.log("■ 로그인 확인");
await ok("토큰 없음·서명 위조·다른 프로젝트·만료·모르는 키 = 401", async () => {
  for (const t of [undefined, T.forged, T.otherProj, T.expired, T.badKid, "abc.def"]) { const r = await up("quote", t, PDF); assert.equal(r.s, 401, String(r.d.error)); } });
await ok("config/access 를 못 읽으면 503 (몰래 허락하지 않음)", async () => { accessFail = true; const r = await up("quote", T.owner, PDF); accessFail = false; assert.equal(r.s, 503); assert.equal(R2.m.size, 0); });

console.log("■ 견적서 (보기 = 마스터·경영 열람 · 올리기·지우기 = 마스터)");
let qkey;
await ok("마스터(소유자) 올리기 → quote/<sha256>.pdf · 이름 그대로", async () => {
  const r = await up("quote", T.owner, PDF); assert.equal(r.s, 200, JSON.stringify(r.d)); qkey = r.d.key;
  assert.match(qkey, /^quote\/[0-9a-f]{64}\.pdf$/); assert.equal(r.d.dup, false); assert.equal(r.d.type, "application/pdf"); assert.equal(r.d.name, "견적서 11월.pdf"); assert.equal(R2.m.size, 1); });
await ok("같은 파일 두 번 = 하나로 (dup true · 버킷 1개) · 추가 마스터도 올리기 됨", async () => {
  const r = await up("quote", T.m2, PDF, "다른 이름.pdf"); assert.equal(r.s, 200); assert.equal(r.d.key, qkey); assert.equal(r.d.dup, true); assert.equal(R2.m.size, 1); });
await ok("부마스터·경영 열람·팀원·허용목록·이메일 미인증 마스터 = 올리기 403", async () => {
  for (const t of [T.sub, T.mgmt, T.team, T.reader, T.unver]) { const r = await up("quote", t, PDF2); assert.equal(r.s, 403); } assert.equal(R2.m.size, 1); });
await ok("보기: 마스터·경영 열람 200 (PDF · nosniff · 이름) / 부마스터·팀원 403", async () => {
  for (const t of [T.owner, T.mgmt]) { const r = await call("file/" + qkey, { tok: t }); assert.equal(r.s, 200); assert.deepEqual([...r.d], [...PDF]);
    assert.equal(r.h.get("Content-Type"), "application/pdf"); assert.equal(r.h.get("X-Content-Type-Options"), "nosniff"); assert.match(r.h.get("Content-Disposition"), /filename\*=UTF-8''%EA%B2%AC/); }
  for (const t of [T.sub, T.team, T.reader]) assert.equal((await call("file/" + qkey, { tok: t })).s, 403); });
await ok("PDF·이미지 아닌 파일 = 415 · 20MB 넘음 = 413 · 빈 파일 = 400", async () => {
  assert.equal((await up("quote", T.owner, new TextEncoder().encode("<html><script>alert(1)</script>"), "x.pdf")).s, 415);
  assert.equal((await up("quote", T.owner, new Uint8Array(20 * 1024 * 1024 + 1).fill(37))).s, 413);
  assert.equal((await up("quote", T.owner, new Uint8Array(0))).s, 400); assert.equal(R2.m.size, 1); });
await ok("이상한 열쇠(경로 바꾸기·휴지통 직접·다른 모양) = 400", async () => {
  for (const k of ["file/quote/../photo/x.pdf", "file/trash/" + qkey, "file/quote/abc.pdf", "file/quote/" + "a".repeat(64) + ".exe"]) assert.equal((await call(k, { tok: T.owner })).s, 400, k); });

console.log("■ 지우기 → 휴지통 30일 → 되살리기");
await ok("경영 열람은 지우기 403 · 마스터 지우기 → trash/ 로 옮김 · 보면 410", async () => {
  assert.equal((await call("file/" + qkey, { method: "DELETE", tok: T.mgmt })).s, 403);
  const r = await call("file/" + qkey, { method: "DELETE", tok: T.owner }); assert.equal(r.s, 200); assert.equal(r.d.trashed, true);
  assert.ok(!R2.m.has(qkey)); assert.ok(R2.m.has("trash/" + qkey)); assert.equal(R2.m.get("trash/" + qkey).customMetadata.deletedBy, "owner@test.kr");
  const g = await call("file/" + qkey, { tok: T.owner }); assert.equal(g.s, 410); assert.match(g.d.error, /30일/); await Promise.all(waits); });
await ok("휴지통 목록 = 마스터만 (이름·지운 사람·정리 날짜)", async () => {
  const l = await call("trash", { tok: T.owner }); assert.equal(l.s, 200); assert.equal(l.d.files.length, 1); assert.equal(l.d.files[0].key, qkey); assert.equal(l.d.files[0].name, "견적서 11월.pdf");
  assert.equal((await call("trash", { tok: T.mgmt })).s, 403); });
await ok("되살리기 = 마스터만 → 다시 보임 · 휴지통에서 빠짐", async () => {
  assert.equal((await call("restore/" + qkey, { method: "POST", tok: T.mgmt })).s, 403);
  const r = await call("restore/" + qkey, { method: "POST", tok: T.owner }); assert.equal(r.s, 200); assert.ok(R2.m.has(qkey)); assert.ok(!R2.m.has("trash/" + qkey));
  assert.equal((await call("file/" + qkey, { tok: T.mgmt })).s, 200); assert.equal(R2.m.get(qkey).customMetadata.deletedAt, undefined); });
await ok("30일 지난 휴지통 파일은 지울 때 같이 정리 · 29일 된 것은 남김", async () => {
  R2.m.set("trash/quote/" + "1".repeat(64) + ".pdf", { data: PDF, uploaded: new Date(Date.now() - 31 * 864e5), httpMetadata: {}, customMetadata: {} });
  R2.m.set("trash/quote/" + "2".repeat(64) + ".pdf", { data: PDF, uploaded: new Date(Date.now() - 29 * 864e5), httpMetadata: {}, customMetadata: {} });
  waits = []; await call("file/" + qkey, { method: "DELETE", tok: T.owner }); await Promise.all(waits);
  assert.ok(!R2.m.has("trash/quote/" + "1".repeat(64) + ".pdf")); assert.ok(R2.m.has("trash/quote/" + "2".repeat(64) + ".pdf")); assert.ok(R2.m.has("trash/" + qkey)); });

console.log("■ 사진 원본 (보기 = 마스터·부마스터·경영 열람 · 올리기 = 마스터)");
let pkey;
await ok("마스터 PNG·HEIC 올리기 · PDF 는 사진으로 못 올림(415) · 부마스터 올리기 403", async () => {
  const r = await up("photo", T.owner, PNG, "용기.png"); assert.equal(r.s, 200); pkey = r.d.key; assert.match(pkey, /^photo\/[0-9a-f]{64}\.png$/);
  assert.match((await up("photo", T.owner, HEIC, "IMG_0001.HEIC")).d.key, /\.heic$/);
  assert.equal((await up("photo", T.owner, PDF2)).s, 415); assert.equal((await up("photo", T.sub, PNG)).s, 403); });
await ok("사진 보기: 마스터·부마스터·경영 열람 200 / 팀원·허용목록 403 · 견적서 열쇠는 부마스터가 못 봄", async () => {
  for (const t of [T.owner, T.sub, T.mgmt]) assert.equal((await call("file/" + pkey, { tok: t })).s, 200);
  for (const t of [T.team, T.reader]) assert.equal((await call("file/" + pkey, { tok: t })).s, 403);
  const q = await up("quote", T.owner, PDF2); assert.equal((await call("file/" + q.d.key, { tok: T.sub })).s, 403); });
await ok("같은 내용이라도 견적서·사진은 따로 (quote/ · photo/)", async () => { const a = await up("quote", T.owner, PNG, "견적 캡처.png"); assert.match(a.d.key, /^quote\//); assert.notEqual(a.d.key, pkey); });
await ok("사진 지우기 = 마스터만", async () => { assert.equal((await call("file/" + pkey, { method: "DELETE", tok: T.sub })).s, 403); assert.equal((await call("file/" + pkey, { method: "DELETE", tok: T.owner })).s, 200); });
console.log(`✓ ${n}가지 모두 통과 (가짜 키·가짜 버킷 · 바깥 요청 ${fetches}번 모두 가짜)`);
