// @ 태그 · 문자 알림 규칙 (mention.js) 계산 시험
import assert from "node:assert/strict";
import * as M from "./mention.js";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };
const users = [{ id: "sh", name: "김송희", phone: "01011112222" }, { id: "mj", name: "김민지", phone: "010-3333-4444", sms: { weekend: true } }, { id: "wm", name: "이우민" }, { id: "old", name: "김보성", active: false, phone: "01055556666" }];
const at = (s) => new Date(s);   // 기기 시각 그대로 (KST 기기 가정)
ok("@이름 · @짧은 이름 → 사람 · 없는 이름·사용 안 하는 사람은 빼고 · 겹쳐도 한 번", () => {
  assert.deepEqual(M.parseMentions("@김송희 확인 부탁 @민지 도 봐 주세요 @김송희", users).sort(), ["mj", "sh"]);
  assert.deepEqual(M.parseMentions("@김보성 @없는사람 이메일 a@b.com", users), []);
});
ok("입력 중 '@' 뒤 고르기 · 넣기", () => {
  assert.deepEqual(M.mentionPick("확인 @김", users, "sh").map((u) => u.id), ["mj"]);
  assert.equal(M.mentionPick("확인 @", users, "sh").length, 2); assert.deepEqual(M.mentionPick("이메일 a@b", users, "sh"), []);
  assert.equal(M.insertMention("확인 @민", "김민지"), "확인 @김민지 ");
});
ok("문자 받을 사람: 번호 있음 · 사용 중 · 나 아님 · 켬", () => {
  assert.equal(M.smsTarget(users[0], "mj"), true); assert.equal(M.smsTarget(users[0], "sh"), false);
  assert.equal(M.smsTarget(users[2], "sh"), false); assert.equal(M.smsTarget(users[3], "sh"), false);
  assert.equal(M.smsTarget({ ...users[0], sms: { on: false } }, "mj"), false);
});
ok("시간: 평일 08:00~18:00 · 주말·공휴일은 본인 설정 · 각자 시간은 08~18 안에서만", () => {
  assert.equal(M.smsOpen(users[0], at("2026-10-07T09:30:00")), true);   // 수
  assert.equal(M.smsOpen(users[0], at("2026-10-07T07:59:00")), false);
  assert.equal(M.smsOpen(users[0], at("2026-10-07T18:00:00")), false);
  assert.equal(M.smsOpen(users[0], at("2026-10-10T10:00:00")), false);   // 토
  assert.equal(M.smsOpen(users[1], at("2026-10-10T10:00:00")), true);    // 주말 받음
  assert.equal(M.smsOpen(users[0], at("2026-10-09T10:00:00")), false);   // 한글날
  const u = { ...users[0], sms: { from: "06:00", to: "23:00" } }; assert.deepEqual([M.smsPref(u).from, M.smsPref(u).to], ["08:00", "18:00"]);
  assert.equal(M.smsOpen({ ...users[0], sms: { from: "13:00", to: "15:00" } }, at("2026-10-07T12:00:00")), false);
});
ok("10분 묶음: 마지막으로 보낸 지 10분 안이면 기다림 · 글은 한 통에", () => {
  assert.equal(M.smsDue({ items: [{}], lastSentAt: "2026-10-07T00:55:00.000Z" }, new Date("2026-10-07T01:00:00Z")), false);
  assert.equal(M.smsDue({ items: [{}], lastSentAt: "2026-10-07T00:50:00.000Z" }, new Date("2026-10-07T01:00:00Z")), true);
  assert.equal(M.smsDue({ items: [] }, new Date()), false);
  const one = M.smsText([{ at: "1", from: "김송희", text: "시안 확인 부탁해요", where: "스티커 라벨", link: "#t-x" }], "https://x/os2.html");
  assert.ok(one.startsWith("[업무OS] 김송희: \"시안 확인 부탁해요\" (스티커 라벨)") && one.endsWith("https://x/os2.html#t-x"));
  const many = M.smsText([1, 2, 3, 4].map((i) => ({ at: String(i), from: "김민지", text: "글" + i, link: "#t-" + i })), "B");
  assert.ok(/나를 부른 댓글 4건/.test(many) && /외 1건/.test(many) && many.endsWith("B#t-4"));
});
console.log(`${n}개 모두 통과`);
