// node src/refs.test.mjs — 레퍼런스 (refs.js · 2026-10-17 사장님 확정 1A·2A·3A·4A)
import assert from "node:assert/strict";
import {
  REF_KINDS, refKindsOf, cleanKinds, firstUrl, urlHost, refNewDoc, refMissing, refList, refsOfProj, refsOfTask, refMerge, refInbox, refLive, refTitle, refFirstImg, fitNames,
  canRefEdit, canRefHide, canRefFit, canRefFitAny, canRefUnfit, fitBlock, refFitMates, mateOwnerIds, refNoteId,
} from "./refs.js";
import { todayView, groupNotes } from "./model.js";
import { refRows, refLine, asideText, boardOf, REF_AI_MAX } from "../../marketing-hub/crew.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "sh", name: "김송희", master: false }, { id: "mj", name: "김민지" }, { id: "boss", name: "대표", master: true }, { id: "yj", name: "남윤정" }];
const cu = (id) => users.find((u) => u.id === id);
const now = new Date("2026-10-17T05:00:00.000Z");
const R = (o) => ({ id: "rf1", text: "이 상세페이지 첫 화면 https://example.com/p/1 구성만", url: "https://example.com/p/1", files: [], kind: "상세페이지", brand: "grohome", projectId: "", taskId: "", to: [], toAt: {}, by: "sh", byName: "김송희", at: "2026-10-17T01:00:00.000Z", updatedAt: "2026-10-17T01:00:00.000Z", fits: {}, fitMates: [], ...o });

ok("종류 칩 = 설정 → 없으면 기본 7개 · 같은 이름 한 번 · 12자", () => {
  assert.deepEqual(refKindsOf([]), REF_KINDS); assert.equal(REF_KINDS.length, 7);
  assert.deepEqual(refKindsOf([{ id: "refkinds", list: [" 상세페이지 ", "상세페이지", "", "아주아주아주아주긴종류이름입니다"] }]), ["상세페이지", "아주아주아주아주긴종류이"]);
  assert.deepEqual(refKindsOf([{ id: "refkinds", list: [] }]), REF_KINDS);   // 다 지우면 기본
  assert.equal(cleanKinds(Array.from({ length: 30 }, (_, i) => "k" + i)).length, 16);
});
ok("글 안 첫 링크 · www. → https · 끝 문장부호 뺌", () => {
  assert.equal(firstUrl("보세요 https://a.com/x?y=1, 그리고 https://b.com"), "https://a.com/x?y=1");
  assert.equal(firstUrl("www.coupang.com/vp/1."), "https://www.coupang.com/vp/1");
  assert.equal(firstUrl("링크 없음"), ""); assert.equal(urlHost("https://www.coupang.com/vp/1"), "coupang.com"); assert.equal(urlHost("x"), "");
});
ok("새 문서: 받을 사람 = @ (나 빼고) · toAt · 사진만이면 (사진) · 링크 뽑기 · 빠진 것 안내", () => {
  const d = refNewDoc({ text: "참고 www.a.com/1 @김민지", kind: "광고 소재", brand: "pourstore" }, cu("sh"), ["mj", "sh", "mj"], "2026-10-17T02:00:00.000Z");
  assert.deepEqual(d.to, ["mj"]); assert.deepEqual(d.toAt, { mj: "2026-10-17T02:00:00.000Z" }); assert.equal(d.url, "https://www.a.com/1"); assert.equal(d.by, "sh"); assert.deepEqual(d.fits, {}); assert.deepEqual(d.fitMates, []);
  const p = refNewDoc({ text: " ", kind: "촬영", files: [{ url: "u", name: "a.png" }, { name: "없음" }] }, cu("sh"), [], "t");
  assert.equal(p.text, "(사진)"); assert.equal(p.files.length, 1); assert.equal(p.files[0].by, "sh");
  assert.equal(refMissing({ text: "", kind: "" }, 0), "링크·글 한 줄이나 캡처를 붙여 주세요"); assert.equal(refMissing({ text: "x", kind: "" }, 0), "종류를 골라 주세요"); assert.equal(refMissing({ text: "", kind: "기타" }, 1), "");
});
ok("목록: 숨긴 것 빼고 · 최근 것 먼저 · 종류·브랜드(공통 = -)·내 것·프로젝트·업무·AI 핏·찾기", () => {
  const L = [R({ id: "a", at: "2026-10-15T00:00:00Z" }), R({ id: "b", at: "2026-10-16T00:00:00Z", kind: "광고 소재", brand: "" , projectId: "p1" }), R({ id: "c", removed: { at: "x" } }), R({ id: "d", at: "2026-10-14T00:00:00Z", by: "mj", taskId: "t1", fits: { gyeoul: { text: "버튼 위치만" } } })];
  assert.deepEqual(refList(L).map((r) => r.id), ["b", "a", "d"]);
  assert.deepEqual(refList(L, { kind: "광고 소재" }).map((r) => r.id), ["b"]);
  assert.deepEqual(refList(L, { brand: "-" }).map((r) => r.id), ["b"]); assert.deepEqual(refList(L, { brand: "grohome" }).map((r) => r.id), ["a", "d"]);
  assert.deepEqual(refList(L, { mine: "mj" }).map((r) => r.id), ["d"]); assert.deepEqual(refList(L, { proj: "p1" }).map((r) => r.id), ["b"]);
  assert.deepEqual(refList(L, { task: "t1" }).map((r) => r.id), ["d"]); assert.deepEqual(refList(L, { fit: "gyeoul" }).map((r) => r.id), ["d"]);
  assert.deepEqual(refList(L, { q: "버튼 위치" }).map((r) => r.id), ["d"]);   // 핏 글로도 찾음
  assert.deepEqual(refsOfProj(L, "p1", [{ id: "t1", projectId: "p1" }]).map((r) => r.id), ["b", "d"]);   // 프로젝트 칸 = 그 프로젝트 + 그 업무
  assert.deepEqual(refsOfTask(L, "t1").map((r) => r.id), ["d"]); assert.deepEqual(refsOfProj(L, "", []), []);
  assert.ok(!refLive(L[2]) && refLive(L[0]));
});
ok("합치기: 같은 id 는 updatedAt 새것", () => {
  const m = refMerge([R({ id: "x", text: "옛", updatedAt: "2026-10-01" })], [R({ id: "x", text: "새", updatedAt: "2026-10-02" }), R({ id: "y" })]);
  assert.equal(m.length, 2); assert.equal(m.find((r) => r.id === "x").text, "새");
});
ok("제목·사진·핏 이름 꼬리표", () => {
  assert.equal(refTitle(R()), "이 상세페이지 첫 화면 구성만"); assert.equal(refTitle(R({ text: "https://www.coupang.com/a" , url: "https://www.coupang.com/a" })), "coupang.com");
  assert.equal(refFirstImg(R({ files: [{ url: "p", name: "a.pdf", type: "application/pdf" }, { url: "i", name: "붙여넣은 사진.png" }] })).url, "i");
  assert.deepEqual(fitNames(R({ fits: { yeoreum: { text: "톤만" }, gaeul: { text: "" } } })), ["여름"]);
});
ok("권한: 고치기 = 올린 사람·관리자 · 숨기기 = 올린 사람 그날·관리자 · 핏 = 관리자·올린 사람·그 AI 담당 · 핏 빼기 = 남긴 사람·담당·관리자", () => {
  const r = R(), mates = { gyeoul: { owners: { grohome: "mj" } }, gaeul: { actOwners: { A: "yj" } } };
  assert.ok(canRefEdit(r, cu("sh")) && canRefEdit(r, cu("boss")) && !canRefEdit(r, cu("mj")));
  assert.ok(canRefHide(r, cu("sh"), "2026-10-17") && !canRefHide(r, cu("sh"), "2026-10-18") && canRefHide(r, cu("boss"), "2026-10-20") && !canRefHide(r, cu("mj"), "2026-10-17"));
  assert.ok(canRefFit(r, cu("mj"), "gyeoul", mates) && !canRefFit(r, cu("mj"), "gaeul", mates) && canRefFit(r, cu("yj"), "gaeul", mates) && canRefFit(r, cu("sh"), "uju", mates));
  assert.ok(canRefFitAny(r, cu("mj"), mates) && !canRefFitAny(R({ by: "boss" }), { id: "x", name: "남" }, mates));
  const f = R({ fits: { gyeoul: { text: "버튼만", by: "sh" } } });
  assert.ok(canRefUnfit(f, cu("sh"), "gyeoul", mates) && canRefUnfit(f, cu("mj"), "gyeoul", mates) && !canRefUnfit(f, cu("yj"), "gyeoul", mates) && !canRefUnfit(f, cu("sh"), "gaeul", mates));
  assert.ok(!canRefEdit(R({ removed: { at: "x" } }), cu("sh")));   // 숨긴 것은 고치지 않음
  assert.deepEqual(mateOwnerIds({ owners: { _: "a", grohome: "b" }, actOwners: { A: "a", B: "c" } }).sort(), ["a", "b", "c"]);
});
ok("핏 글 막기: 비면 · 원가·마진·제조사·공급가(핏 · 레퍼런스 글)", () => {
  assert.equal(fitBlock(R(), "첫 화면만"), ""); assert.match(fitBlock(R(), " "), /한 줄/); assert.match(fitBlock(R(), "마진 좋은 구성"), /AI가 볼 수 없어요/);
  assert.match(fitBlock(R({ text: "제조사 ○○ 상세" }), "구성만"), /레퍼런스 글에/);
});
ok("핏 남길 AI = 지금 쓰는 크루(B2C)만 · 닫힌 크루(B2B·바라스데이) 빼고", () => {
  const ids = refFitMates().map((m) => m.id);
  assert.ok(["yeoreum", "gaeul", "gyeoul", "uju", "haneul", "bom", "baram"].every((x) => ids.includes(x)));
  assert.ok(!ids.includes("dandan") && !ids.includes("saessak"));
});
ok("'확인할 것': 받을 사람만 · 7일 · 읽으면 사라짐 · 내가 올린 것·숨긴 것 안 뜸 · 고치며 새로 부른 사람은 그때부터", () => {
  const D = { users, projects: [{ id: "p1", title: "그로홈 상세 리뉴얼" }], refs: { list: [R({ to: ["mj"], toAt: { mj: "2026-10-17T01:00:00.000Z" }, projectId: "p1" }), R({ id: "rf2", to: ["mj"], removed: { at: "x" } }), R({ id: "rf3", to: ["mj"], toAt: { mj: "2026-10-01T00:00:00.000Z" }, at: "2026-10-01T00:00:00.000Z" })] } };
  const L = refInbox(D, "mj", now, {});
  assert.equal(L.length, 1); assert.equal(L[0].kind, "ref"); assert.equal(L[0].refId, "rf1"); assert.match(L[0].text, /상세페이지 · 그로홈 · 그로홈 상세 리뉴얼/);
  assert.equal(refInbox(D, "mj", now, { [L[0].id]: true }).length, 0); assert.equal(refInbox(D, "sh", now, {}).length, 0); assert.equal(refInbox(D, "yj", now, {}).length, 0);
  // 고치며 나중에 부름 → toAt 기준
  const D2 = { ...D, refs: { list: [R({ at: "2026-10-01T00:00:00.000Z", to: ["yj"], toAt: { yj: "2026-10-16T00:00:00.000Z" } })] } };
  assert.equal(refInbox(D2, "yj", now, {}).length, 1);
});
ok("todayView: 레퍼런스 줄 + 대화 댓글(올린 사람·받을 사람·말한 사람) → 같은 레퍼런스끼리 한 줄", () => {
  const D = { users, tasks: [], projects: [], notes: [
      { id: "n1", itemId: refNoteId("rf1"), by: "mj", byName: "김민지", text: "이 버튼 좋네요", at: "2026-10-17T03:00:00.000Z" },
      { id: "n2", itemId: refNoteId("rf1"), by: "yj", byName: "남윤정", text: "저도요", at: "2026-10-17T04:00:00.000Z" },
      { id: "n3", itemId: refNoteId("rf9"), by: "mj", byName: "김민지", text: "@김송희 이것도", at: "2026-10-17T04:10:00.000Z", mentions: ["sh"] }],
    refs: { list: [R({ to: ["mj"] })] }, refInbox };
  const v = todayView(D, "sh", now, {});
  const g = v.inbox.find((x) => x.refId === "rf1"); assert.ok(g && g.n === 2 && /새 댓글 2/.test(g.title));   // 올린 사람에게 묶은 한 줄
  const m = v.inbox.find((x) => x.kind === "mention"); assert.equal(m.refId, "rf9");   // 숨겨진·못 읽은 레퍼런스여도 @ 는 옴
  const v2 = todayView(D, "mj", now, {}); assert.ok(v2.inbox.some((x) => x.kind === "ref" && x.refId === "rf1"));   // 받을 사람 = 공유 줄
  assert.ok(!v2.inbox.some((x) => x.kind === "note" && x.refId === "rf1" && x.whoName === "김민지"));   // 내 댓글은 안 뜸
  assert.equal(groupNotes([{ id: "a", refId: "r", title: "t", at: "1" }, { id: "b", refId: "r", title: "t", at: "2" }]).length, 1);
});
ok("AI 지시문 (crew.refRows · 4A): 그 AI 핏이 있는 것만 · 숨긴 것·원가 말 빼고 · 전화·메일 가림 · 최근 핏 8개 · 새것 먼저", () => {
  const L = [R({ id: "a", fits: { gyeoul: { text: "첫 화면 구성만 · 문의 010-1234-5678", byName: "김민지", at: "2026-10-16T01:00:00.000Z" } }, files: [{ name: "캡처.png", url: "https://x/1.png" }, { name: "x", url: "javascript:1" }] }),
    R({ id: "b", fits: { gyeoul: { text: "톤만", at: "2026-10-17T01:00:00.000Z" } }, url: "ftp://bad" }), R({ id: "c", fits: { gyeoul: { text: "x" } }, removed: { at: "y" } }),
    R({ id: "d", fits: { gyeoul: { text: "마진 구조만" } } }), R({ id: "e", text: "공급가 비교표", fits: { gyeoul: { text: "표만" } } }), R({ id: "f", fits: { yeoreum: { text: "썸네일만" } } }),
    ...Array.from({ length: 10 }, (_, i) => R({ id: "z" + i, fits: { gyeoul: { text: "옛 핏 " + i, at: `2026-09-0${i % 9 + 1}T00:00:00.000Z` } } }))];
  const rows = refRows(L, "gyeoul");
  assert.equal(rows.length, REF_AI_MAX); assert.deepEqual(rows.slice(0, 2).map((r) => r.id), ["b", "a"]);
  assert.ok(!rows.some((r) => ["c", "d", "e", "f"].includes(r.id)));
  const a = rows.find((r) => r.id === "a"); assert.match(a.fit, /010-\*\*\*\*-\*\*\*\*/); assert.equal(a.files.length, 1); assert.equal(a.brand, "그로홈"); assert.equal(a.at, "2026-10-16");
  assert.equal(rows.find((r) => r.id === "b").url, "");   // http(s) 만
  assert.equal(refLine(a), "- 상세페이지 · 그로홈 · 10/16 핏(김민지) — 쓸 부분: 첫 화면 구성만 · 문의 010-****-****");
  const t = asideText(boardOf("gh-conv"), { refs: rows });
  assert.ok(t.includes("■ 참고 레퍼런스 — 사람이 업무OS 레퍼런스에 '겨울 핏'을 남긴 것만") && t.includes("쓸 부분: 톤만") && t.includes("사진: 캡처.png https://x/1.png") && t.includes("그대로 베끼지 않는다"));
  assert.ok(t.indexOf("■ 참고 레퍼런스") < t.indexOf("■ 1. 지표"));
  assert.ok(!asideText(boardOf("gh-conv"), { refs: [] }).includes("■ 참고 레퍼런스") && !asideText(boardOf("gh-conv")).includes("■ 참고 레퍼런스"));   // 없으면 칸도 없음
});
console.log(`${n}개 통과`);
