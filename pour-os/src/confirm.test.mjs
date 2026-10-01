// 업무 댓글 · 컨펌 요청 로직 테스트 — node src/confirm.test.mjs
import { taskNoteId, confirmsOf, confirmLatest, nextRound, confirmQueue, newNotesFor } from "./akNotes.js";
let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };
const T = taskNoteId("t1"), T2 = taskNoteId("t2");
const N = [
  { id: "c1", itemId: T, kind: "confirm", round: 1, status: "fix", to: "songhee", by: "chaerim", at: "2026-10-01T05:20", decidedAt: "2026-10-01T06:02" },
  { id: "f1", itemId: T, kind: "task", parentId: "c1", fb: true, by: "songhee", at: "2026-10-01T06:02" },
  { id: "c2", itemId: T, kind: "confirm", round: 2, status: "wait", to: "songhee", by: "chaerim", at: "2026-10-01T08:40" },
  { id: "c3", itemId: T2, kind: "confirm", round: 1, status: "fix", to: "songhee", by: "chaerim", at: "2026-10-01T01:00", decidedAt: "2026-10-01T02:00" },
  { id: "x", itemId: T2, kind: "confirm", round: 2, status: "wait", to: "songhee", by: "chaerim", at: "2026-10-01T03:00", deleted: true },
  { id: "m1", itemId: T2, kind: "task", by: "ran", at: "2026-10-01T09:00" },
  { id: "r1", itemId: "proj:p9", kind: "proj", parentId: "m0", by: "minji", at: "2026-10-01T09:30" },
  { id: "m0", itemId: "proj:p9", kind: "proj", by: "chaerim", at: "2026-10-01T09:10" },
];
eq("차수 순서", confirmsOf(N, T).map((n) => n.id), ["c1", "c2"]);
eq("최신 차수", confirmLatest(N, T).id, "c2");
eq("다음 차수 (숨긴 것 제외)", [nextRound(N, T), nextRound(N, T2)], [3, 2]);
const q = confirmQueue(N, "songhee");
eq("송희 컨펌 대기 = 각 업무 최신 차수 중 대기", q.wait.map((n) => n.id), ["c2"]);
eq("채림 피드백 옴 = 최신 차수가 수정 요청", confirmQueue(N, "chaerim").fix.map((n) => n.id), ["c3"]);
eq("새 댓글: 내 업무 + 내 글 답글, 본 뒤 것만", newNotesFor(N, "chaerim", [T, T2], { [T2]: "2026-10-01T08:00" }, "2026-10-01T00:00").map((n) => n.id), ["r1", "m1", "f1"]);
eq("이미 본 건 빼기", newNotesFor(N, "chaerim", [T2], { [T2]: "2026-10-01T09:00" }, "").map((n) => n.id), ["r1", "f1"]);   // f1 은 내 글(c1) 답글이라 포함
console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
