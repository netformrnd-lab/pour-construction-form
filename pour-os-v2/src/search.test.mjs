// node src/search.test.mjs — 찾기 계산 (search.js)
import assert from "node:assert/strict";
import * as S from "./search.js";
import { redact } from "./secret.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };

const users = [{ id: "boss", name: "김송희", master: true }, { id: "a", name: "양채림", master: false }, { id: "b", name: "이우민", master: false }];
const base = () => ({ ready: true, users, brands: [{ id: "pourstore", name: "POUR스토어" }],
  projects: [{ id: "p1", title: "10월 프로모션", assigneeId: "a", brand: "pourstore", status: "active", dueDate: "2026-10-30" },
    { id: "p2", title: "비밀 인수", assigneeId: "boss", status: "active", secret: { on: true, allow: [], by: "boss" } }],
  tasks: [{ id: "t1", title: "상세페이지 수정", projectId: "p1", assigneeId: "a", status: "todo", dueDate: "2026-10-01", memo: "배너 문구 바꾸기" },
    { id: "t2", title: "택배 단가 확인", assigneeId: "b", status: "done", doneAt: "2026-10-05T03:00:00Z" },
    { id: "t3", title: "인수 가격 협상", projectId: "p2", assigneeId: "boss", status: "todo" },
    { id: "f1", title: "오전 CS 확인", isFixed: true, scope: "brand", brand: "pourstore", assigneeIds: ["a", "b"], recurType: "daily" },
    { id: "f2", title: "개인 메일 정리", isFixed: true, scope: "me", assigneeIds: ["b"], recurType: "daily" }],
  removedFx: [{ id: "f9", title: "예전 CS 메모", isFixed: true, scope: "me", assigneeIds: ["a"], removed: { at: "2026-10-06T00:00:00Z", by: "a", byName: "양채림", scope: "me" } },
    { id: "f8", title: "예전 CS 공지", isFixed: true, scope: "brand", brand: "pourstore", assigneeIds: ["b"], removed: { at: "2026-10-06T00:00:00Z", by: "boss", byName: "김송희", scope: "brand" } }],
  notes: [{ id: "n1", itemId: "task:t1", text: "배너 시안 올렸어요", by: "b", byName: "이우민", at: "2026-10-06T01:00:00Z" },
    { id: "n2", itemId: "proj:p1", text: "일정 공유", by: "a", byName: "양채림", at: "2026-10-05T01:00:00Z" },
    { id: "n3", itemId: "task:t3", text: "인수 가격 3억", by: "boss", byName: "김송희", at: "2026-10-05T01:00:00Z" },
    { id: "n4", itemId: "f2~b", text: "CS 개인 메모", by: "b", at: "2026-10-05T01:00:00Z" },
    { id: "n5", itemId: "task:t1", text: "지운 댓글 배너", by: "a", deleted: true, at: "2026-10-05T01:00:00Z" }],
  ak: { items: [{ id: "ak1", name: "블로그 포스팅", who: ["a"], whoNames: ["양채림"], brand: "pourstore" }], removed: [{ id: "ak9", name: "예전 CS 전화", who: ["b"], brand: "pourstore", _removed: { at: "2026-10-06T00:00:00Z", by: "boss", byName: "김송희" } }] },
  log: [] });
const cuA = users[1], cuB = users[2], cuBoss = users[0];
const view = (u) => redact(base(), u);

ok("norm · hitAt: 대소문자·띄어쓰기 무시 · 원래 자리", () => {
  assert.equal(S.norm(" POUR 스토어 "), "pour스토어");
  assert.deepEqual(S.hitAt("상세 페이지 수정", S.norm("세페")), [1, 4]);
  assert.deepEqual(S.marks("상세 페이지 수정", S.norm("페이지수")).map((x) => [x.t, x.b]), [["상세 ", false], ["페이지 수", true], ["정", false]]);
  assert.equal(S.hitAt("abc", "zz"), null);
  assert.equal(S.marks("abc", "zz")[0].b, false);
});
ok("snippet: 긴 글은 맞은 곳 앞뒤만", () => {
  const long = "가".repeat(80) + "배너" + "나".repeat(80); const s = S.snippet(long, "배너", 10);
  assert.ok(s.startsWith("…") && s.endsWith("…") && s.includes("배너") && s.length < 40);
});
ok("빈 말이면 아무것도 없음", () => { const r = S.searchAll(view(cuA), "  ", { cu: cuA }); assert.equal(r.task.length + r.proj.length + r.note.length + r.rt.length, 0); });
ok("업무 제목 · 메모 · 담당 이름 · 프로젝트 이름으로 찾기 (제목 맞은 것 먼저)", () => {
  const D = view(cuA);
  assert.deepEqual(S.searchAll(D, "상세페이지", { cu: cuA }).task.map((x) => x.id), ["t1"]);
  const m = S.searchAll(D, "배너 문구", { cu: cuA }).task[0]; assert.equal(m.field, "memo"); assert.ok(m.snip.includes("배너 문구"));
  assert.equal(S.searchAll(D, "이우민", { cu: cuA }).task[0].id, "t2");
  const p = S.searchAll(D, "10월프로모션", { cu: cuA }); assert.equal(p.task[0].id, "t1"); assert.equal(p.task[0].field, "where"); assert.equal(p.proj[0].id, "p1");
});
ok("업무 줄: 어디 · 담당 · 상태 · 기한(지남 빨강) / 끝낸 일은 끝낸 날", () => {
  const D = view(cuA), t = S.searchAll(D, "상세", { cu: cuA, today: "2026-10-07" }).task[0];
  assert.equal(t.where, "10월 프로모션"); assert.equal(t.who, "양채림"); assert.equal(t.stat, "할 일"); assert.equal(t.date, "기한 10/1"); assert.equal(t.red, true);
  assert.deepEqual(t.go, { type: "task", id: "t1" });
  const d = S.searchAll(D, "택배", { cu: cuA }).task[0]; assert.equal(d.stat, "끝남"); assert.ok(/10\/5 끝냄/.test(d.date)); assert.equal(d.done, true);
});
ok("열린 일이 끝낸 일보다 먼저", () => {
  const D = view(cuA); D.tasks.push({ id: "t5", title: "택배 회수", assigneeId: "a", status: "todo" });
  assert.deepEqual(S.searchAll(D, "택배", { cu: cuA }).task.map((x) => x.id), ["t5", "t2"]);
});
ok("기밀: 허용 안 된 팀원은 기밀 업무·프로젝트·그 댓글이 안 나옴 (제목·글 모두) · 관리자는 나옴", () => {
  for (const w of ["인수", "기밀", "3억", "김송희"]) { const r = S.searchAll(view(cuA), w, { cu: cuA });
    assert.ok(!r.task.some((x) => x.id === "t3"), w); assert.ok(!r.proj.some((x) => x.id === "p2"), w); assert.ok(!r.note.some((x) => x.id === "n3"), w); }
  const R = S.searchAll(view(cuBoss), "인수", { cu: cuBoss }); assert.ok(R.task.some((x) => x.id === "t3") && R.proj.some((x) => x.id === "p2") && R.note.some((x) => x.id === "n3"));
});
ok("댓글: 글 · 쓴 사람 · 있는 곳 → 그 대화 칸 + 그 댓글로 (지운 댓글 빼고)", () => {
  const r = S.searchAll(view(cuA), "배너", { cu: cuA });
  assert.deepEqual(r.note.map((x) => x.id), ["n1"]);
  assert.deepEqual(r.note[0].go, { type: "task", id: "t1", focus: "talk", note: "n1" }); assert.equal(r.note[0].where, "업무 · 상세페이지 수정"); assert.equal(r.note[0].who, "이우민");
  const p = S.searchAll(view(cuA), "일정", { cu: cuA }).note[0]; assert.deepEqual(p.go, { type: "project", id: "p1", first: "news", note: "n2" });
});
ok("버전1 사람별 고정업무 메모(업무~사람)는 본인·관리자만", () => {
  assert.equal(S.searchAll(view(cuA), "개인 메모", { cu: cuA }).note.length, 0);
  assert.equal(S.searchAll(view(cuB), "개인 메모", { cu: cuB }).note.length, 1);
  assert.equal(S.searchAll(view(cuBoss), "개인 메모", { cu: cuBoss }).note.length, 1);
});
ok("반복 실행: 정한 날 체크 · 횟수 목표 · 남의 개인 고정업무는 본인·관리자만", () => {
  const a = S.searchAll(view(cuA), "CS", { cu: cuA }).rt;
  assert.ok(a.some((x) => x.id === "f1" && x.where === "반복 실행 · POUR스토어" && x.stat === "매일"));
  assert.ok(!a.some((x) => x.id === "f2"));
  assert.equal(S.searchAll(view(cuB), "메일 정리", { cu: cuB }).rt[0].id, "f2");
  assert.equal(S.searchAll(view(cuBoss), "메일 정리", { cu: cuBoss }).rt[0].id, "f2");
  const k = S.searchAll(view(cuA), "블로그", { cu: cuA }).rt[0]; assert.deepEqual(k.go, { type: "routine", id: "ak1" }); assert.equal(k.where, "횟수 목표 · POUR스토어");
});
ok("없앤 것: 팀원 = 내 개인 고정업무만 '없앤 것' · 관리자 = 전부(횟수 목표 포함)", () => {
  const a = S.searchAll(view(cuA), "예전", { cu: cuA }).rt; assert.deepEqual(a.map((x) => [x.id, x.tag]), [["f9", "없앤 것"]]);
  assert.equal(S.searchAll(view(cuB), "예전", { cu: cuB }).rt.length, 0);
  const m = S.searchAll(view(cuBoss), "예전", { cu: cuBoss }).rt; assert.deepEqual(m.map((x) => x.id).sort(), ["ak9", "f8", "f9"]); assert.ok(m.every((x) => x.tag === "없앤 것" && x.removed));
  assert.deepEqual(m.find((x) => x.id === "ak9").go, { type: "routine", id: "ak9" });
});
ok("없앤 것은 살아 있는 반복 실행보다 뒤", () => {
  const m = S.searchAll(view(cuBoss), "CS", { cu: cuBoss }).rt; const i1 = m.findIndex((x) => x.id === "f1"), i8 = m.findIndex((x) => x.id === "f8"); assert.ok(i1 >= 0 && i8 > i1);
});
ok("내 것만: 업무(담당·맡긴) · 프로젝트(책임·함께) · 댓글(내가 씀) · 반복(내 담당)", () => {
  const D = view(cuB), r = S.searchAll(D, "택배", { cu: cuB, mine: true }); assert.equal(r.task.length, 1);
  assert.equal(S.searchAll(view(cuA), "택배", { cu: cuA, mine: true }).task.length, 0);
  assert.equal(S.searchAll(view(cuA), "배너", { cu: cuA, mine: true }).note.length, 0);
  assert.equal(S.searchAll(view(cuB), "배너", { cu: cuB, mine: true }).note.length, 1);
  assert.equal(S.searchAll(view(cuB), "프로모션", { cu: cuB, mine: true }).proj.length, 0);
  assert.equal(S.searchAll(view(cuA), "블로그", { cu: cuA, mine: true }).rt.length, 1);
  assert.equal(S.searchAll(view(cuB), "블로그", { cu: cuB, mine: true }).rt.length, 0);
});
ok("더 오래된 것 합치기: 없던 끝낸 업무·댓글만 더함 · 기밀 지난 업무와 그 댓글은 팀원에게 안 나옴 · 못 찾는 업무 댓글은 팀원에게 안 나옴", () => {
  const older = { tasks: [{ id: "t2", title: "택배 단가 확인 (다른 본)", status: "done" }, { id: "o1", title: "작년 택배 계약", assigneeId: "b", status: "done", doneAt: "2026-07-01T00:00:00Z" },
      { id: "o2", title: "작년 비밀 택배", assigneeId: "boss", status: "done", secret: { on: true, allow: [], by: "boss" } }, { id: "o3", title: "고정 택배", isFixed: true, status: "done" }],
    notes: [{ id: "n1", itemId: "task:t1", text: "배너 시안 올렸어요" }, { id: "on1", itemId: "task:o1", text: "택배 계약서 받음", by: "b", at: "2026-07-01T00:00:00Z" },
      { id: "on2", itemId: "task:o2", text: "비밀 택배 단가", by: "boss", at: "2026-07-01T00:00:00Z" }, { id: "on3", itemId: "task:gone", text: "택배 어디 갔지", by: "b", at: "2026-07-01T00:00:00Z" },
      { id: "on4", itemId: "task:o1", text: "택배 지운 것", deleted: true }] };
  const DA = S.mergeOlder(view(cuA), older), r = S.searchAll(DA, "택배", { cu: cuA });
  assert.deepEqual(r.task.map((x) => x.id).sort(), ["o1", "t2"]);
  assert.equal(DA.tasks.find((t) => t.id === "t2").title, "택배 단가 확인");   // 이미 있던 것 그대로
  assert.ok(!JSON.stringify(r).includes("비밀"));
  assert.deepEqual(r.note.map((x) => x.id), ["on1"]);
  assert.equal(DA.notes.filter((x) => x.id === "n1").length, 1);
  const DB = S.mergeOlder(view(cuBoss), older), rb = S.searchAll(DB, "택배", { cu: cuBoss });
  assert.deepEqual(rb.task.map((x) => x.id).sort(), ["o1", "o2", "t2"]); assert.deepEqual(rb.note.map((x) => x.id).sort(), ["on1", "on2", "on3"]);
  assert.equal(S.mergeOlder(view(cuA), null).tasks.length, view(cuA).tasks.length);
});
ok("최근 찾은 말: 앞에 · 같은 말(띄어쓰기 무시) 하나만 · 8개까지", () => {
  let l = []; for (let i = 0; i < 10; i++) l = S.addRecent(l, "말" + i);
  assert.equal(l.length, 8); assert.equal(l[0], "말9");
  l = S.addRecent(l, " 말 5 "); assert.equal(l[0], "말 5"); assert.equal(l.filter((x) => S.norm(x) === "말5").length, 1);
  assert.deepEqual(S.addRecent(["a"], "  "), ["a"]);
});
ok("더 오래된 것 읽기 = 같음 조건만 (orderBy·범위 없음)", () => {
  assert.ok(S.OLDER_STEPS.every((s) => s.w === null || (s.w[1] === "==" && !Array.isArray(s.w[0]))));
});
ok("noteWhere: 반복 실행 댓글 · 없앤 고정업무 대화", () => {
  const D = view(cuBoss);
  assert.deepEqual(S.noteWhere(D, { id: "x", itemId: "ak1" }).go, { type: "routine", id: "ak1", focus: "talk", note: "x" });
  assert.equal(S.noteWhere(D, { id: "y", itemId: "task:f9" }).kind, "고정업무");
});
console.log(`search.test: ${n}개 통과`);
