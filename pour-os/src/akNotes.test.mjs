// 행동지표 메모 로직 테스트 — node src/akNotes.test.mjs
import { noteThreads, noteCounts, linkParts, buildUtm, readUtm, pickFiles, pastedName, fileSize, isImage, NOTE_FILE_MAX } from "./akNotes.js";

let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };

// ① 댓글·대댓글
const notes = [
  { id: "a", itemId: "ak_x", at: "2026-10-01T10:00" }, { id: "b", itemId: "ak_x", at: "2026-10-01T09:00" },
  { id: "r2", itemId: "ak_x", parentId: "a", at: "2026-10-01T12:00" }, { id: "r1", itemId: "ak_x", parentId: "a", at: "2026-10-01T11:00" },
  { id: "o", itemId: "ak_y", at: "2026-10-01T08:00" }, { id: "lost", itemId: "ak_x", parentId: "gone", at: "2026-10-01T13:00" },
  { id: "d", itemId: "ak_x", at: "2026-10-01T14:00", deleted: true },
];
const th = noteThreads(notes, "ak_x");
eq("원댓글 오래된 순 (원댓글 없는 대댓은 원댓글로)", th.map((t) => t.id), ["b", "a", "lost", "d"]);
eq("대댓글 오래된 순", th.find((t) => t.id === "a").replies.map((r) => r.id), ["r1", "r2"]);
eq("항목별 수(숨긴 것 빼고)", noteCounts(notes), { ak_x: { n: 5, last: "2026-10-01T13:00" }, ak_y: { n: 1, last: "2026-10-01T08:00" } });

// ② 링크
eq("링크 나누기 · 끝 구두점 빼기", linkParts("블로그 https://blog.naver.com/a?b=1, 확인"), [{ t: "text", v: "블로그 " }, { t: "url", v: "https://blog.naver.com/a?b=1" }, { t: "text", v: ", 확인" }]);
eq("링크 없음", linkParts("그냥 글"), [{ t: "text", v: "그냥 글" }]);

// ③ UTM
eq("기본", buildUtm("pourstore.net/product/1", { source: "naver", medium: "blog", campaign: "10월 옥상방수" }).url, "https://pourstore.net/product/1?utm_source=naver&utm_medium=blog&utm_campaign=10%EC%9B%94_%EC%98%A5%EC%83%81%EB%B0%A9%EC%88%98");
eq("원래 파라미터·# 유지, 예전 utm 바꿈", buildUtm("https://a.com/p?id=3&utm_source=old#top", { source: "instagram", medium: "social", campaign: "oct", content: "reel1" }).url, "https://a.com/p?id=3&utm_source=instagram&utm_medium=social&utm_campaign=oct&utm_content=reel1#top");
eq("필수 빠지면 안내", buildUtm("a.com", { source: "naver" }).err, "source · medium · campaign 은 꼭 넣어주세요");
eq("주소 아님", buildUtm("그냥글", { source: "a", medium: "b", campaign: "c" }).err, "주소 모양이 아니에요");
eq("UTM 읽기", readUtm("https://a.com/?utm_source=naver&utm_medium=blog&utm_campaign=x"), { source: "naver", medium: "blog", campaign: "x" });
eq("UTM 없음", readUtm("https://a.com/"), null);

// ④ 파일
const r = pickFiles([{ name: "a.pdf", size: 10 }, { name: "big.mp4", size: NOTE_FILE_MAX + 1 }, { name: "b.png", size: 5 }], 8);
eq("크기·개수 넘는 건 이유와 함께 뺌", [r.ok.map((f) => f.name), r.bad], [["a.pdf", "b.png"], ["big.mp4 (25MB 초과)"]]);
eq("11번째부터는 뺌", pickFiles([{ name: "x", size: 1 }], 10).bad, ["x (한 번에 10개까지)"]);
eq("붙여넣은 사진 이름", pastedName("image/jpeg", new Date(2026, 9, 1, 9, 5, 7)), "붙여넣은사진_20261001_090507.jpg");
eq("크기 표시", [fileSize(500), fileSize(2.5 * 1048576)], ["1KB", "2.5MB"]);
eq("사진인지", [isImage({ type: "image/png" }), isImage({ name: "a.JPG" }), isImage({ name: "a.pdf", type: "application/pdf" })], [true, true, false]);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
