// 업무OS v2 · 관리자 화면(os2-admin.html) 사용 설명 영상 — PC 가로 1280×720 · 자막만(목소리 없음)
// 가짜 저장 장치 + 실데이터 읽기 전용 복사본 · 시계 2026-10-06(화) 10:00 고정 · 실제 Firestore 에 쓰지 않음
// 실행: cd guide && timeout 900 node admin.mjs  →  python3 build.py out/admin landscape out/admin.mp4 ...
// v2 (검토 반영): 9장 구성 · 브라우저 언어 ko-KR(날짜 칸 한국어) · 자막 기호는 [ ] → › · ✓ 만
import { openRec, SP } from './rec.mjs';

// 시범 첫날처럼: 마스터 4명 + 준비 장면에 쓰는 김민지만 PIN 있음, 나머지 팀원은 아직 PIN 없음 (설정 › 시작 코드 장면용)
const KEEP = new Set(['songhee', 'ran', 'gKKfVXIm6aWJRiwZCt90', 'GM', 'minji']);
const r = await openRec({
  name: 'admin', w: 1280, h: 720, dsf: 1.5, start: 'index.html', now: '2026-10-06T10:00:00', locale: 'ko-KR',
  patch: (st) => { Object.values(st.v2.users).forEach((u) => { if (!KEEP.has(u.id)) { u.pinHash = null; delete u.pinInvite; } }); },
});
const { pg, cap, tap, wait, login, scroll, closeAll, goto, sheet } = r;

// ── 도우미 ──
// 자막: 앞 자막이 읽을 시간(글자 수 ÷ 7초, 최소 2.5초 + 여유)만큼 보였는지 확인한 뒤 다음 자막
// hold(early): 다음 화면으로 넘어가는 동작을 앞 자막 끝나기 early ms 전에 시작 (동작이 끝나야 다음 자막이 뜨므로 앞 자막은 충분히 보임)
let last = null;
const MARGIN = 0.3;
const hold = async (early = 0) => { if (last) { const rem = last.need * 1000 - early - (Date.now() - last.at); if (rem > 0) await wait(rem); } };
const say = async (ch, title, sub = '') => {
  await hold();
  await cap(ch, title, sub);
  last = { at: Date.now(), need: Math.max(2.5, (title + sub).replace(/\s/g, '').length / 7) + MARGIN };
};
// '불러오는 중'이 사라질 때까지 기다림 (멈춘 화면이 영상에 안 나오게)
const settle = async (ms = 700) => {
  await pg.waitForFunction(() => !/불러오는 중/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => console.log('[settle] 아직 불러오는 중'));
  await wait(ms);
};
const nav = (t) => pg.locator('.v2-nav').getByRole('button', { name: t, exact: true });
const go = async (t) => { await tap(nav(t), 400); await settle(200); };
const toTop = async () => { await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(900); };
const pageScroll = async (dy, steps = 10) => { await pg.mouse.move(900, 380); await scroll(dy, steps); };
const SHEET_BODY = '.v2-sheet > div:nth-child(2)';
// 시트 안에서 그 줄이 위에서 top px 자리에 오도록 천천히 굴림
const sheetTo = async (loc, top = 70, steps = 10) => {
  const dy = await loc.first().evaluate((el, top) => { const b = el.closest('.v2-sheet > div:nth-child(2)'); return el.getBoundingClientRect().top - b.getBoundingClientRect().top - top; }, top);
  await scroll(dy, steps, SHEET_BODY);
};

// ── 준비 (첫 자막 전 · 영상에서 잘림): 김민지가 팀원 앱에서 [막혔어요] 1건 + [요청 › 도와주세요] 1건을 김송희에게 ──
await login('김민지');
await pg.getByText('스티커 라벨 기획·카피', { exact: true }).first().click(); await wait(1200);
await sheet().getByRole('button', { name: '막혔어요', exact: true }).click(); await wait(300);
await sheet().getByLabel('막힌 이유').fill('라벨 문구 최종본을 아직 못 받았어요'); await wait(200);
await sheet().getByRole('button', { name: '알리기', exact: true }).click(); await wait(800);
await closeAll();
await pg.getByText('설명서 기획·카피', { exact: true }).first().click(); await wait(1200);
await sheet().getByRole('button', { name: '요청', exact: true }).click(); await wait(400);
await pg.getByRole('radio', { name: /도와주세요/ }).click(); await wait(200);
await pg.getByLabel('받을 사람').selectOption('songhee'); await wait(200);
await pg.getByLabel('요청 내용').fill('실사 확인 날짜를 같이 정해 주세요'); await wait(200);
await pg.getByRole('dialog', { name: '요청 보내기' }).getByRole('button', { name: '보내기', exact: true }).click(); await wait(800);
await closeAll();
// 이 기기에서 나가기 → 관리자 화면 첫 화면(사람 고르기)
await pg.evaluate(() => { localStorage.removeItem('pour-os2-me'); localStorage.removeItem('pour-os2-key'); });
await goto('admin.html');
await pg.getByText('이 기기를 쓰는 사람을 골라 주세요').waitFor({ timeout: 20000 });
// 화면 갱신 보장: 화면 녹화(CDP screencast)는 바뀐 화면만 보내는데, 마지막 변화가 빠지면 이전 화면(예: '불러오는 중')이 몇 초 남는 일이 있어
// 구석 1px 점의 투명도를 0.5초마다 아주 조금 바꿔 새 프레임이 계속 오게 함 (눈에 안 보임 · 앱 동작과 무관)
await pg.evaluate(() => { const d = document.createElement('div'); d.id = '__nudge'; d.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;z-index:2147483646;pointer-events:none;background:rgba(244,245,248,0.01)'; document.body.appendChild(d); let k = 0; setInterval(() => { k = 1 - k; d.style.background = k ? 'rgba(244,245,248,0.02)' : 'rgba(244,245,248,0.01)'; }, 500); });
await wait(800);

// ═════════ 1 들어가기 ═════════
await say('1 들어가기', '관리자 화면은 마스터 4명만 들어와요', '김송희 · 이란 · 김소연 · 허지은 · 다른 이름은 들어와도 막혀요');
await say('1 들어가기', '이름을 누르고 팀원 앱과 같은 PIN 4자리를 넣어요', '영상 속 PIN은 연습용이에요');
await wait(400);
await login('김송희');
await settle(300);

// ═════════ 2 시범 첫날 ═════════
await say('2 시범 첫날', '시범 첫날엔 먼저 오른쪽 위 [설정]을 눌러요', '');
await wait(900);
await tap(pg.locator('.a-head').getByRole('button', { name: '설정', exact: true }), 700);
await say('2 시범 첫날', '[시작 코드 7명 한꺼번에 만들기] → 확인 창 [만들기]', '아직 PIN 없는 7명 · 코드를 받은 본인만 처음 PIN을 정해요');
await wait(1900);
await tap(sheet().getByRole('button', { name: /한꺼번에 만들기/ }), 1500);
await tap(pg.getByRole('alertdialog').getByRole('button', { name: '만들기', exact: true }), 700);
await say('2 시범 첫날', '사람마다 4자리 시작 코드가 생겨요', '영상 속 코드는 연습용 · 창을 닫으면 다시 못 봐요 · 잊으면 사람 보기에서 다시 만들기');
// 시험용 브라우저(http)엔 클립보드가 없어 복사 함수만 흉내 (실제 화면에선 그대로 복사됨)
await pg.evaluate(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) { /* 무시 */ } });
await say('2 시범 첫날', '[목록 복사] 뒤 한 사람씩 본인에게만 보내요', '팀원은 처음 들어갈 때 시작 코드와 새 PIN을 넣어요 · 코드는 연습용');
await wait(300);
await tap(sheet().getByRole('button', { name: '목록 복사', exact: true }), 600);
await hold(1100);
await sheetTo(sheet().getByRole('button', { name: /버전1 신제품 보드 다시 가져오기/ }), 300, 10);
await say('2 시범 첫날', '아래 버전1 다시 가져오기는 시범 중엔 누르지 않아요', '그사이 고친 것을 덮을 수 있어요');
await hold(500);
await closeAll(); await wait(300);

// ═════════ 3 한눈에 ═════════
await say('3 한눈에', '[한눈에] 맨 위 네 칸 · 막힘 · 지남 · 순서 꼬임 · 요청', '빨간 숫자부터 봐요 · 도움 요청은 요청 칸 말고 [나에게 온 것]에 와요');
await hold(1300);
await tap(pg.locator('.a-rc').first(), 500); await settle(200);
await say('3 한눈에', '칸을 누르면 [정리]의 그 묶음으로 바로 가요', '팀원 앱에서 김민지님이 [막혔어요]를 누른 일이에요');
await hold(1000);
await go('한눈에');
await say('3 한눈에', '판단 필요 · 당겨야 할 것과 미뤄도 되는 것', '중요 높음인데 늦어질 듯한 것 · 중요 낮음인데 한도 넘은 사람 일');
await hold(1100);
await pageScroll(640, 10);
await say('3 한눈에', '팀 달력 · 숫자는 그날 마감 수 · 진할수록 많아요', '빨강은 지난 날에 남은 일 · 한 사람 하루 8건 넘음');
await hold(1300);
await tap(pg.locator('.v2-calc[aria-label^="10월 8일"]'), 500);
await say('3 한눈에', '날을 누르면 오른쪽에 사람별로 묶여요', '이름을 펼쳐 골라서 담당·기한을 한꺼번에 바꿔요');
await wait(1500);
await tap(pg.locator('.a-grp').first(), 600);
await hold(900);
await toTop();

// ═════════ 4 나에게 온 것 ═════════
await say('4 나에게 온 것', '오른쪽 위 [나에게 온 것]을 눌러요', '팀원 앱의 확인할 것과 같아요');
await wait(1500);
await tap(pg.getByRole('button', { name: /^나에게 온 것/ }), 700);
await say('4 나에게 온 것', '도움 요청 · 막힘 · PIN 처음 정함 · 댓글이 한 줄씩 와요', '시범 첫 주엔 PIN 처음 정함 줄을 꼭 봐요 · 본인이 아니면 [PIN 초기화]');
await wait(2600);
await r.ring(sheet().getByText(/PIN을 정했어요/).first());
await hold(1300);
await tap(sheet().getByRole('button', { name: '답하기', exact: true }), 700); await settle(200);
await say('4 나에게 온 것', '[답하기]를 누르면 그 업무 대화 칸으로 가요', '여기 남긴 댓글은 김민지님 확인할 것에 가요');
await hold(900);
await scroll(-900, 8, SHEET_BODY);
await say('4 나에게 온 것', '도움 요청은 [해결됐어요]를 눌러야 사라져요', '답만 하면 [나에게 온 것]에 그대로 남아요');
await wait(700);
await r.ring(sheet().getByRole('button', { name: '해결됐어요', exact: true }));
await hold(500);
await closeAll(); await wait(200);

// ═════════ 5 사람 ═════════
await go('사람');
await say('5 사람', '[사람] 한 주 표 · 사람마다 반복 업무와 프로젝트 업무', '칸 숫자는 해야 할 것 중 한 개수 · 이름 아래 위험·주의는 밀린 정도');
await hold(1300);
const minji = pg.locator('.a-oner').filter({ hasText: '김민지' });
await tap(minji.locator('.a-k').first(), 600); await settle(200);
await say('5 사람', '반복 칸을 누르면 고정업무 요일 칸과 행동지표 실적이 나와요', '고정업무는 요일별 · 행동지표는 이 주 목표와 실적');
await hold(1600);
await closeAll(); await wait(200);
await tap(minji.locator('.a-onen'), 600);
await say('5 사람', '이름을 누르면 그 사람 요약이 열려요', '기한 지킴 비율 · 지남 · 앞으로 2주 마감 · 기다리는 뒤 일');
await hold(1200);
await sheetTo(sheet().getByText('휴대폰 번호 (문자 알림)', { exact: true }), 60, 12);
await say('5 사람', '휴대폰 번호를 넣으면 댓글에서 불릴 때 문자도 가요', '번호가 없으면 앱에만 떠요');
await hold(1200);
await scroll(3000, 10, SHEET_BODY);
await say('5 사람', '맨 아래 주 한도 · [일 넘기기 ›] · [PIN 초기화]', '휴가·퇴사 땐 일 넘기기 · PIN 초기화 뒤엔 새 시작 코드를 본인에게');
await hold(400);
await closeAll(); await wait(200);

// ═════════ 6 반복 실행 ═════════
await go('반복 실행');
await say('6 반복 실행', '[반복 실행] 고정업무를 오늘 · 이번 주 · 이번 달 몇 개 했는지 봐요', '줄마다 맡은 사람 · 체크한 사람은 ✓');
await wait(1600);
await pageScroll(560, 10);
await hold(1800);
await toTop();
await tap(pg.getByRole('tab', { name: /^행동지표/ }), 500); await settle(200);
await say('6 반복 실행', '[행동지표]는 KPI 목표 횟수를 주간 · 월간 · 분기마다 채웠는지 봐요', '기록은 팀원 앱 오늘 할 횟수 [+1]');

// ═════════ 7 KPI ═════════
await hold(1100);
await go('KPI');
await say('7 KPI', '[KPI]는 브랜드 칩을 고르고 결과 KPI부터 봐요', '이번 달 값과 목표');
await hold(2200);
await pageScroll(560, 10);
await tap(pg.getByRole('button', { name: /자사몰 매출 \(OWN\)/ }), 500);
await say('7 KPI', '최종 목표 → 메인 KPI → 서브 KPI', 'CRM 자동은 숫자 출처 · [움직이는 것]을 누르면 연결된 반복·프로젝트');
await hold(2200);
await toTop();
await tap(pg.getByRole('button', { name: /^월말 입력/ }), 600);
await say('7 KPI', '월말엔 [월말 입력]으로 결과 KPI 숫자를 넣어요', '브랜드별로 나뉘어 있어요 · 바뀐 것만 저장돼요');
await hold(1400);
await closeAll(); await wait(200);
await tap(pg.getByRole('button', { name: 'KPI 고치기', exact: true }), 500);
await say('7 KPI', '[KPI 고치기]로 이름 · 목표 · 단위를 고쳐요', '지우기 대신 숨기기 · 버전1 KPI 화면은 그대로');
await hold(700);
await tap(pg.getByRole('button', { name: '고치기 끝', exact: true }), 300);

// ═════════ 8 프로젝트 ═════════
await go('프로젝트');
await say('8 프로젝트', '[프로젝트] 주별 표는 카테고리별로 주마다 봐요', '큰 숫자는 그 주 마감인데 안 끝난 업무 · 카테고리 이름을 누르면 펼쳐져요');
await wait(2800);
await tap(pg.locator('.a-cwg .a-wkn').first(), 600);
await hold(1300);
await tap(pg.getByRole('tab', { name: '단계', exact: true }), 500); await settle(200);
await say('8 프로젝트', '[단계]는 프로젝트마다 단계 띠와 지금 → 다음', '신제품은 기획부터 홍보까지 7칸');
await wait(1500);
await pageScroll(260, 8);
await hold(1800);
await toTop();
await tap(pg.getByRole('tab', { name: '8주 축', exact: true }), 500);
await say('8 프로젝트', '[8주 축]은 주마다 안 끝난 마감 업무 수를 보여 줘요', '굵은 테두리 칸이 출시·마감 주예요');

// ═════════ 9 정리 ═════════
await hold(1100);
await go('정리');
await say('9 정리', '[정리]에선 쌓인 일을 묶음별로 치워요', '지우는 기능은 없어요 · 신제품 임시 담당도 여기서 정해요');
await wait(2400);
await r.ring(pg.locator('.a-q').filter({ hasText: '임시 담당' }).first());
await hold(1300);
await tap(pg.locator('.a-q').filter({ hasText: '기한 지난 일' }), 600);
await say('9 정리', '사람마다 [이 묶음 모두 고르기] → 아래 막대에서 바꿔요', '기한 · 담당 · 보류 · 날짜 없이 두기 · 담당에게 묻기는 30건까지');
await wait(500);
// 사람 묶음 4개(김민지 · 김소연 · …)만 골라 30건 넘게 → 확인 창 장면. 버튼을 화면 가운데로 굴린 뒤 누를 때마다 동그라미 + 0.6초 쉼
const allBtn = pg.locator('.a-qbody').getByRole('button', { name: '이 묶음 모두 고르기', exact: true });
for (let i = 0; i < 4 && (await allBtn.count()); i++) { await allBtn.first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(450); await tap(allBtn, 600); }
const nSel = await pg.locator('.v2-bulk').innerText().catch(() => ''); console.log('[pick]', nSel.split('\n')[0]);
await tap(pg.locator('.v2-bulk').getByRole('button', { name: '기한 ▾' }), 600);
await tap(pg.locator('.v2-bulk').getByRole('button', { name: /^다음 주/ }), 600);
await hold(900);
await tap(pg.locator('.v2-bulk').getByRole('button', { name: '이대로 바꾸기' }), 500);
await say('9 정리', '30건 이상이면 한 번 더 물어요', '한 번에 100건까지');
await hold(700);
await tap(pg.getByRole('alertdialog').getByRole('button', { name: '바꾸기', exact: true }), 300);
await say('9 정리', '바꾼 뒤 5초 안에 [되돌리기]를 누르면 그대로 돌아와요', '연습이라 되돌렸어요 · 실제론 사람별로 고르거나 담당에게 묻기부터');
await wait(1400);
await tap(pg.locator('.v2-toast').getByRole('button', { name: '되돌리기' }), 300);
// 목록이 다시 채워질 때까지 기다린 뒤 잠깐 더 머묾 (되돌린 것이 눈에 보이게)
await pg.waitForFunction(() => { const b = document.querySelector('.a-qbody'); return b && !/비었어요/.test(b.innerText); }, null, { timeout: 10000 }).catch(() => console.log('[undo] 목록이 아직 비어 있음'));
await wait(1800);
await hold();
await wait(300);
await r.finish();
