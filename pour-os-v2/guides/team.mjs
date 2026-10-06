// 업무OS v2 · 팀원 앱 사용 설명 영상 (폰 세로 390×844) — 자막만, 목소리 없음
// 실행: cd guide && timeout 900 node team.mjs → build.py → frames.py
// 데이터: 실데이터 읽기 전용 복사본 + 가짜 저장 장치 (구글 주소는 rec.mjs 가 막음 · 실제 Firestore 에 쓰지 않음)
//  · 영상용 바꿈(patch): 김민지의 지난 일 10개 중 7개 기한을 앞날로 옮김 (팀 전체가 보는 영상에 한 사람의 '지남 10'이 크게 나오지 않게) → 처음 카드에 '기한 일부 조정'으로 밝힘
import { openRec, SP } from './rec.mjs';

const MOVE = { t1781245519541_2: '2026-10-14', t1786004860891: '2026-10-15', t1788251514271: '2026-10-16', t1790729541120: '2026-10-07', t1790812186446: '2026-10-07', t1790812233606: '2026-10-08', t1790820622832: '2026-10-09' };
const patch = (st) => { for (const [id, d] of Object.entries(MOVE)) { const t = st.v2.tasks[id]; if (!t) throw new Error('영상용 바꿈: 업무 없음 ' + id); t.dueDate = d; } };

const r = await openRec({ name: 'team', w: 390, h: 844, dsf: 2, start: 'index.html', locale: 'ko-KR', patch, pins: { minji: { invite: '4821' } }, now: '2026-10-06T10:00:00' });
const { pg, cap, tap, type, wait, login, nav, closeAll } = r;
const S = () => pg.locator('.v2-sheet').last();

// 자막: 앞 자막이 읽을 만큼(≥ max(2.5초, 글자수/7초) + 여유 M) 떠 있은 뒤에 다음 자막
const M = 0.2;
let last = null;
const need = (t, s) => Math.max(2.5, ((t || '') + (s || '')).replace(/ /g, '').length / 7);
const el = () => (last ? (Date.now() - last.t0) / 1000 : 99);
async function say(ch, title, sub = '') {
  if (last) { const rem = last.need + M - el(); if (rem > 0) await wait(rem * 1000); }
  await cap(ch, title, sub);
  last = { t0: Date.now(), need: need(title, sub) };
}
async function settle() { if (last) { const rem = last.need + M - el(); if (rem > 0) await wait(rem * 1000); } }
// 자막이 일부(frac) 읽힌 뒤 동작 (남은 시간은 다음 say 가 채움)
async function after(frac = 0.6) { if (last) { const rem = last.need * frac - el(); if (rem > 0) await wait(rem * 1000); } }
// 천천히 그 칸으로 굴리기
async function see(loc, block = 'start', ms = 700) { await loc.first().evaluate((e, b) => e.scrollIntoView({ behavior: 'smooth', block: b }), block); await wait(ms); }
async function top(ms = 600) { await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(ms); }
// 짚어 주기: 주황 테두리 (ms 동안 · 기다리지 않음 — 화면을 굴리지 않을 때만)
async function box(loc, ms = 1800, pad = 4) {
  const bb = await loc.first().boundingBox().catch(() => null); if (!bb) return;
  await pg.evaluate(({ x, y, w, h, ms, pad }) => { const d = document.createElement('div'); d.className = 'rec-box';
    d.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border-radius:10px;border:3px solid #F25C05;box-shadow:0 0 0 4px rgba(242,92,5,.18);z-index:2147483647;pointer-events:none;transition:opacity .3s`;
    document.body.appendChild(d); setTimeout(() => { d.style.opacity = 0; }, ms); setTimeout(() => d.remove(), ms + 400); }, { x: bb.x, y: bb.y, w: bb.width, h: bb.height, ms, pad });
}
// 크게 보기: 달력 칸 몇 개를 복사해 크게 (폰에서 작은 ▴ · → 칩이 보이게) — ms 뒤 사라짐
async function zoomCells(days, { scale = 2.1, y = null, ms = 3000 } = {}) {
  await pg.evaluate(({ days, scale, y, ms }) => {
    const cal = document.querySelector('.v2-cal'); if (!cal) return;
    const cells = [...cal.querySelectorAll('.v2-calc')].filter((c) => days.some((d) => { const l = c.getAttribute('aria-label') || ''; return l.startsWith(d + ',') || l.startsWith(d + ' '); }));
    if (!cells.length) return;
    const r0 = cells[0].getBoundingClientRect();
    const wrap = document.createElement('div'); wrap.className = cal.className + ' rec-zoom';
    const gap = 4, padd = 6, W = cells.reduce((a, c) => a + c.getBoundingClientRect().width, 0) + gap * (cells.length - 1) + padd * 2, H = r0.height + padd * 2;
    const left = Math.max(6, (innerWidth - W * scale) / 2), topY = y != null ? y : Math.min(innerHeight - H * scale - 90, r0.bottom + 14);
    wrap.style.cssText = `position:fixed;left:${left}px;top:${topY}px;display:flex;gap:${gap}px;padding:${padd}px;background:#fff;border:2px solid #F25C05;border-radius:12px;box-shadow:0 10px 30px rgba(15,31,92,.35);transform:scale(${scale});transform-origin:0 0;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .25s`;
    cells.forEach((c) => { const b = c.getBoundingClientRect(), k = c.cloneNode(true); k.style.width = b.width + 'px'; k.style.height = b.height + 'px'; k.style.flex = '0 0 auto'; wrap.appendChild(k); });
    document.body.appendChild(wrap); requestAnimationFrame(() => { wrap.style.opacity = 1; });
    setTimeout(() => { wrap.style.opacity = 0; }, ms); setTimeout(() => wrap.remove(), ms + 400);
  }, { days, scale, y, ms });
}
// 빠르게 쓰기 (긴 글)
async function typeQ(loc, text, delay = 40, ms = 300) { loc = loc.first(); await loc.scrollIntoViewIfNeeded(); await r.ring(loc); await loc.click(); await loc.pressSequentially(text, { delay }); await wait(ms); }
const inboxRow = (txt) => pg.locator('.v2-page [role=button]').filter({ hasText: txt }).first();

// ───────── 준비 작업 (첫 자막 전 · 영상에서 잘림) ─────────
// 김송희(마스터)로 들어가 실제 화면으로 ① 김민지에게 일 맡기기(기한 10/8) ② 내 일에 [요청] → 확인 받기 → 김민지 ③ 맡긴 일 대화에서 @김민지 부르기 → 나가기
await login('김송희', '1234');
await tap(pg.getByRole('button', { name: '+ 할 일 추가' }), 500);
await type(S().locator('#v2-add-title'), '추석 이벤트 배너 문구 정리', 100);
await S().getByLabel('다른 사람').selectOption({ label: '김민지' }); await wait(300);
await tap(S().getByRole('option').filter({ hasText: '10/8' }), 300);
await tap(S().getByRole('button', { name: /김민지님에게 맡기기/ }), 900);
await tap(pg.getByRole('button', { name: '+ 할 일 추가' }), 500);
await type(S().locator('#v2-add-title'), '10월 그로홈 메인 배너 시안', 100);
await tap(S().getByRole('button', { name: '추가', exact: true }), 900);
await tap(pg.getByRole('button', { name: '내 할 일 모두 ›' }), 600);
await type(S().getByLabel('내 업무 찾기'), '메인 배너 시안', 300);
await tap(S().getByText('10월 그로홈 메인 배너 시안').first(), 800);
await tap(S().getByRole('button', { name: '요청', exact: true }), 600);
{ const dlg = pg.getByRole('dialog', { name: '요청 보내기' });
  await tap(dlg.getByRole('radio', { name: /확인 받기/ }), 300);
  await dlg.getByLabel('받을 사람').selectOption({ label: '김민지' });
  await type(dlg.getByLabel('요청 내용'), '1안·2안 중 골라 주세요', 200);
  await tap(dlg.getByRole('button', { name: '보내기' }), 900); }
await closeAll();
await tap(nav('더보기'), 600);
await tap(pg.getByText(/^내가 맡긴 일 \d+/), 700);
await tap(S().getByText('추석 이벤트 배너 문구 정리').first(), 800);
{ const ta = S().getByLabel('댓글');
  await type(ta, '@김민', 300);
  await tap(S().getByRole('listbox', { name: '부를 사람' }).getByRole('button', { name: '@김민지' }), 300);
  await ta.press('End'); await ta.pressSequentially('지난달 배너 문구 참고해 주세요', { delay: 20 });
  await tap(S().getByRole('button', { name: '남기기' }), 900); }
await closeAll();
await tap(nav('더보기'), 500);
await tap(pg.getByText('다른 사람으로 쓰기'), 500);
await tap(pg.getByRole('button', { name: '나가기' }), 900);
await pg.evaluate(() => window.scrollTo(0, 0)); await wait(800);

// ───────── 1 처음 들어가기 ─────────
// 원칙: 자막을 먼저 띄우고 → 그 자막이 말하는 곳을 짚거나 누름 (새 화면이 앞 자막 아래에 오래 남지 않게)
const C1 = '1 처음 들어가기';
await say(C1, '내 이름을 눌러요', '이 폰을 쓰는 사람을 골라요');
await after(0.8);
await tap(pg.getByRole('button', { name: '김민지', exact: true }), 300);
await say(C1, '처음 한 번만: 시작 코드와 내 PIN 두 번', '관리자(마스터)에게 받은 4자리 시작 코드 · 영상 속 코드·PIN은 연습용');
await type(pg.getByLabel('시작 코드'), '4821', 250);
await type(pg.getByLabel('PIN', { exact: true }), '1234', 250);
await type(pg.getByLabel('PIN 확인'), '1234', 250);
await say(C1, '한 번 들어가면 이 폰에선 계속 열려 있어요', '5번 틀리면 5분 잠겨요 · 잊으면 관리자에게 PIN 초기화 부탁');
await after(0.92);
await tap(pg.getByRole('button', { name: 'PIN 정하고 시작' }), 0);
await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await wait(250);

// ───────── 2 오늘 화면 ─────────
const C2 = '2 오늘 화면';
await say(C2, '맨 위: 남은 일 · 이번 주 완료율', '빨간 숫자는 기한이 지난 일 · 누르면 내 할 일 모두');
await box(pg.locator('.v2-page header'), 2600, 6);
await say(C2, '아래 탭 4개', '오늘 · 달력 · 프로젝트 · 더보기');
await box(pg.locator('.v2-nav'), 2000, 2);

// ───────── 3 지금 할 일 ─────────
const C3 = '3 지금 할 일';
await say(C3, '지금 할 일 카드 1장', '지난 일이면 [끝냈어요] · 새 기한 · [보류] 중 하나');
await after(0.9);
await tap(pg.locator('.v2-page').getByRole('button', { name: /^다음 주 / }).first(), 250);
await say(C3, '내 일은 새 기한을 누르면 바로 바뀌어요', '카드엔 다음 일이 올라와요 · 잘못 눌렀으면 [되돌리기] (5초)');
await after(1.0);
await tap(pg.getByRole('button', { name: /하나씩 정리하기/ }), 200);
await say(C3, "'지난 일 하나씩 정리하기'", '한 화면에 하나씩: [끝냈어요] · 새 기한 · 보류 · [건너뛰기]');
await after(0.55);
await tap(S().getByRole('button', { name: '건너뛰기' }), 400);
await after(1.0);
await closeAll();

// ───────── 4 확인할 것 ─────────
const C4 = '4 확인할 것';
await say(C4, '확인할 것: 나에게 온 요청·알림', '줄을 누르면 열리고, 오른쪽 버튼은 바로 처리 · 알림만 온 건 [읽음 표시]');
await see(pg.getByText(/^확인할 것 \d/), 'start', 650);
await box(pg.getByText(/^확인할 것 \d/).locator('xpath=../following-sibling::*[1]'), 2200, 3);
await wait(2000);
await box(pg.getByRole('button', { name: '읽음 표시', exact: true }), 1600, 3);
await say(C4, "'@ 나를 부름' → [답하기]", '그 대화로 바로 가서 답을 남겨요');
await after(0.3);
await tap(pg.getByRole('button', { name: '답하기', exact: true }), 600);
await typeQ(S().getByLabel('댓글'), '네, 오늘 할게요', 40, 100);
await tap(S().getByRole('button', { name: '남기기' }), 400);
await tap(S().getByRole('button', { name: /^‹ / }), 200);
await say(C4, "'맡김' → [받았어요]", "기한을 보고 눌러요 · 맡긴 사람에게 '받음'으로 보여요");
await see(pg.getByText(/^확인할 것 \d/), 'start', 500);
await after(0.5);
await tap(pg.getByRole('button', { name: '받았어요', exact: true }), 600);
await say(C4, "'확인 요청'은 줄을 눌러 열어요", '보고 [확인 완료] · 고칠 게 있으면 [수정 요청] · 줄의 [확인]은 바로 확인 완료');
await box(inboxRow('10월 그로홈 메인 배너 시안'), 1300, 2); await wait(1100);
await tap(inboxRow('10월 그로홈 메인 배너 시안').getByText('10월 그로홈 메인 배너 시안'), 700);
await box(S().getByRole('button', { name: '수정 요청', exact: true }), 1700, 3);
await box(S().getByRole('button', { name: '확인 완료', exact: true }), 1700, 3);
await after(1.0);
await tap(S().getByRole('button', { name: /^‹ / }), 150);

// ───────── 5 고정업무 · 할 횟수 ─────────
const C5 = '5 고정업무 · 할 횟수';
await say(C5, '고정업무: 매일·매주·매월 정해진 일', "'고정업무 n개 남음 ▾'을 펼쳐 했으면 [완료]");
await see(pg.getByText(/고정업무 \d+개 남음/), 'center', 600);
await tap(pg.getByText(/고정업무 \d+개 남음/), 600);
await tap(pg.locator('.v2-page').getByRole('button', { name: '완료', exact: true }).first(), 400);
await after(1.0);
await say(C5, '할 횟수: 이번 주·이번 달 몇 번 할지 정한 일', '한 횟수와 목표가 보여요');
await see(pg.getByText(/^할 횟수|^이번 주 할 횟수/), 'start', 600);
await after(0.8);
await tap(pg.getByRole('button', { name: '상세페이지 고도화 +1' }), 250);
await say(C5, '한 번 할 때마다 [+1]', "바로 '셌어요' · 잘못 눌렀으면 [취소]");

// ───────── 6 업무 한 장 ─────────
const C6 = '6 업무 한 장';
await say(C6, '[내 할 일 모두 ›]: 내 일 전부', '찾기 칸에 제목을 넣고 줄을 눌러 열어요');
await see(pg.getByRole('button', { name: '내 할 일 모두 ›' }), 'center', 600);
await tap(pg.getByRole('button', { name: '내 할 일 모두 ›' }), 400);
await typeQ(S().getByLabel('내 업무 찾기'), '설명서', 90, 400);
await after(0.9);
await tap(S().locator('[role=button]').filter({ hasText: '타일카펫' }).filter({ hasText: '설명서 기획·카피' }).first(), 200);
await say(C6, '업무 한 장: 맨 위 담당 · 기한 · 상태', '하기 시작하면 [시작했어요]');
await box(S().getByText(/^담당 /).locator('xpath=..'), 1600, 4);
await after(0.7);
await tap(S().getByRole('button', { name: '시작했어요' }), 500);
await say(C6, '[막혔어요]: 이유를 적고 [알리기]', "맡긴 사람(없으면 책임자)의 '확인할 것'에 떠요");
await tap(S().getByRole('button', { name: '막혔어요' }), 300);
await box(S().getByText(/의 '확인할 것'에 떠요/), 2400, 3);
await after(1.0);
await tap(S().getByRole('button', { name: '막혔어요' }), 150);
await say(C6, '[요청]: 확인 받기 · 도와주세요', "고른 사람의 '확인할 것'에 떠요");
await tap(S().getByRole('button', { name: '요청', exact: true }), 300);
await after(1.0);
await tap(pg.getByRole('dialog', { name: '요청 보내기' }).getByRole('button', { name: '취소' }), 150);
await say(C6, '맡은 일의 기한은 [기한 조정 요청]', '맡긴 사람(신제품은 책임자)이 수락하면 바뀌어요 · 내 일은 바로 바꿔요');
await tap(S().getByRole('button', { name: '기한 조정 요청' }), 300);
await box(S().getByText(/님이 수락하면 기한이 바뀌어요/), 2600, 3);
await after(1.0);
await tap(S().getByRole('button', { name: '기한 조정 요청' }), 150);
{ const ta = S().getByLabel('댓글');
  await say(C6, '대화에 @를 치면 이름 목록이 떠요', "부른 사람 '확인할 것'에 떠요 · 문자 켠 사람은 문자도");
  await see(ta, 'center', 500);
  await typeQ(ta, '@이우', 110, 300);
  await box(S().getByRole('listbox', { name: '부를 사람' }), 1300, 3); await wait(1000);
  await tap(S().getByRole('listbox', { name: '부를 사람' }).getByRole('button', { name: '@이우민' }), 200);
  await ta.press('End'); await ta.pressSequentially('문구 오늘 드릴게요', { delay: 40 }); await wait(150);
  await after(1.0);
  await tap(S().getByRole('button', { name: '남기기' }), 200); }
await say(C6, '순서: 앞 일 · 다음 일', '끝낼 때 다음 사람에게 한마디를 남길 수 있어요');
await see(S().getByText('순서', { exact: true }), 'start', 600);
await box(S().getByText('순서', { exact: true }).locator('xpath=../following-sibling::*[1]'), 1500, 3); await wait(900);
await typeQ(S().getByLabel('다음 사람에게 한마디'), '문구는 대화에 있어요', 45, 150);
await after(1.0);
await say(C6, '끝내면 다음 차례를 알려 줘요', "다음 사람에게 '이제 내 차례'가 떠요");
await tap(S().getByRole('button', { name: '끝냈어요', exact: true }), 300);
await box(pg.locator('.v2-toast'), 2400, 3);
await after(1.0);
await closeAll();

// ───────── 7 할 일 추가 · 맡기기 ─────────
const C7 = '7 할 일 추가';
await say(C7, '[+ 할 일 추가]', '내 일도, 남에게 맡길 일도 여기서');
await box(pg.getByRole('button', { name: '+ 할 일 추가' }), 1000, 4); await wait(600);
await tap(pg.getByRole('button', { name: '+ 할 일 추가' }), 400);
await typeQ(S().locator('#v2-add-title'), '설명서 사진 보정', 55, 100);
await say(C7, '다른 사람을 고르면 그 사람 2주 일정', '숫자는 그날 마감 수 · 맡길 땐 기한을 꼭');
{ const sel = S().getByLabel('다른 사람'); await r.ring(sel); await sel.selectOption({ label: '이우민' }); await wait(450); }
await box(S().locator('.v2-strip'), 1800, 3);
await wait(1000);
await box(S().locator('.v2-day').filter({ hasText: '건' }).first(), 1400, 3);
await after(0.85);
await tap(S().getByRole('option').filter({ hasText: '10/9' }), 300);
await say(C7, "맡기면 그 사람 '확인할 것'에 떠요", '받았는지는 더보기 › 내가 맡긴 일');
await tap(S().getByRole('button', { name: /이우민님에게 맡기기/ }), 300);

// ───────── 8 달력 ─────────
const C8 = '8 달력';
await after(1.0);
await say(C8, '달력 맨 위: 7일 한눈에', '7일 안 마감 · 지난 일 · 출시 · 곧 내 차례');
await tap(nav('달력'), 400);
await box(pg.locator('.v2-wkstat'), 2400, 4);
await say(C8, '월 달력: 칸마다 그날 마감', '진할수록 많아요 · ▴ 출시·마감 · → 내 차례 시작');
await zoomCells(['10월 5일', '10월 6일', '10월 7일'], { scale: 2.15, ms: 3800 });
await settle();
await say(C8, '곧 내 차례: 앞 일이 끝나면 할 내 일', '열면 7일 뒤까지 모두 · 빨강은 늦을 수 있어요 · [묻기]로 앞사람에게');
await box(pg.locator('.v2-wkstat').getByRole('button', { name: /곧 내 차례/ }), 900, 3); await wait(500);
await tap(pg.locator('.v2-wkstat').getByRole('button', { name: /곧 내 차례/ }), 400);
await after(1.0);
await closeAll();
await say(C8, '[나 ▾]로 동료 · 프로젝트 달력', '동료 달력은 보기만 · [✕ 풀기]로 돌아와요');
await tap(pg.locator('.v2-calright button'), 650);
await tap(S().getByText('이우민', { exact: true }).first(), 700);
await box(pg.getByText(/달력 · 보기만 해요/).locator('xpath=..'), 1800, 3);
await wait(2000);
await tap(pg.getByRole('button', { name: '거르기 풀기' }), 300);

// ───────── 9 프로젝트 ─────────
const C9 = '9 프로젝트';
await say(C9, '프로젝트 목록', "줄마다 '지금 · 다음' 누가 무슨 일");
await tap(nav('프로젝트'), 400);
await see(pg.getByText(/^이번 달 \d/), 'start', 600);
await settle();
await say(C9, '프로젝트 한 장', '지금 → 다음 · 신제품은 7단계 띠 · 가운데 탭 4개');
await tap(pg.getByText('2in1 목재용 페인트', { exact: true }).first(), 500);
await box(S().getByRole('tab', { name: '마인드맵' }).locator('xpath=..'), 1800, 3);
await settle();
await say(C9, '탭 [항목·업무] [마인드맵] [소식] [자료]', '마인드맵은 업무 순서를 가지로 보여 줘요');
await tap(S().getByRole('tab', { name: '마인드맵' }), 400);
await see(S().getByRole('tab', { name: '마인드맵' }), 'start', 500);
await after(1.0);
await closeAll();
await say(C9, '[간트]: 프로젝트 기간을 막대로', '세로줄은 오늘 · 진한 부분은 진척');
await top(400);
await box(pg.getByRole('tab', { name: '간트' }), 900, 3); await wait(500);
await tap(pg.getByRole('tab', { name: '간트' }), 600);
{ // 진척이 가장 긴 막대 + 오늘 세로줄 짚기
  const g = await pg.evaluate(() => { let best = null, bw = 0; document.querySelectorAll('.v2-gtr .bar').forEach((b) => { const s = b.querySelector('s'), w = s ? s.getBoundingClientRect().width : 0; if (w > bw) { bw = w; best = b; } });
    if (best) best.setAttribute('data-rec', 'gbar');
    const now = document.querySelector('.v2-gtr.hd .now'), gt = document.querySelector('.v2-gt'); if (!now || !gt) return null;
    const a = now.getBoundingClientRect(), b = gt.getBoundingClientRect(); return { x: a.left + a.width / 2, y: b.top, h: Math.min(b.bottom, innerHeight - 70) - b.top }; });
  if (g) await pg.evaluate(({ x, y, h }) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${x - 6}px;top:${y}px;width:12px;height:${h}px;border-radius:6px;border:3px solid #F25C05;z-index:2147483647;pointer-events:none;transition:opacity .3s`; document.body.appendChild(d); setTimeout(() => { d.style.opacity = 0; }, 1300); setTimeout(() => d.remove(), 1700); }, g);
  await wait(1400);
  await box(pg.locator('[data-rec=gbar]'), 1800, 5); }

// ───────── 10 더보기 ─────────
const C10 = '10 더보기';
await after(1.0);
await say(C10, '더보기: 나와 관련된 것만', '내가 맡긴 일 · 내 할 일 모두 · 내 고정업무 · 내 KPI');
await tap(nav('더보기'), 400);
await box(pg.getByText('내 일', { exact: true }).locator('xpath=../following-sibling::*[1]'), 2200, 3);
await settle();
await say(C10, '내가 맡긴 일', '급한 것부터: 확인해 주세요 · 기한 조정 · 막힘 · 아직 안 받음 등');
await tap(pg.getByText(/^내가 맡긴 일 \d+/), 400);
await after(1.0);
await closeAll();
await say(C10, '문자 알림 · 앱을 열면 먼저', '@로 불렸을 때 문자 받을 시간 · 처음 화면 고르기');
await see(pg.getByText('문자 알림', { exact: true }), 'start', 650);

// ───────── 11 나가기 · 다시 들어오기 (PIN만 넣는 화면) ─────────
const C11 = '11 나가기 · 다시 들어오기';
await after(1.0);
await say(C11, '같이 쓰는 기기면 [다른 사람으로 쓰기]', '이 기기에서 나가요 · 다음 사람이 자기 이름으로 들어와요');
await see(pg.getByText('다른 사람으로 쓰기', { exact: true }), 'center', 600);
await tap(pg.getByText('다른 사람으로 쓰기', { exact: true }), 500);
await box(pg.getByRole('alertdialog'), 1400, 3); await wait(900);
await tap(pg.getByRole('button', { name: '나가기' }), 300);
await settle();
await say(C11, '다시 들어올 땐 이름 누르고 PIN 4자리만', '시작 코드는 처음 한 번만 · 다른 폰·PC에서도 같은 PIN');
await tap(pg.getByRole('button', { name: '김민지', exact: true }), 500);
await type(pg.getByLabel('PIN', { exact: true }), '1234', 300);
await after(0.9);
await tap(pg.getByRole('button', { name: '시작', exact: true }), 0);
await pg.waitForSelector('.v2-nav', { timeout: 20000 }); await wait(200);

// ───────── 12 하루 쓰는 순서 ─────────
const C12 = '12 하루 쓰는 순서';
await say(C12, '아침: [오늘]을 열어요', '남은 일 · 지금 할 일 카드부터');
await box(pg.locator('.v2-nav').getByRole('button', { name: /^오늘/ }), 1400, 3);
await settle();
await say(C12, '다음: 확인할 것을 비워요', '[받았어요] · [답하기] · 확인 요청은 열어 보고 [확인 완료]');
await see(pg.getByText(/^확인할 것 \d/), 'start', 600);
await box(inboxRow('10월 그로홈 메인 배너 시안'), 1000, 2); await wait(800);
await tap(inboxRow('10월 그로홈 메인 배너 시안').getByText('10월 그로홈 메인 배너 시안'), 600);
await tap(S().getByRole('button', { name: '확인 완료', exact: true }), 700);
await after(1.0);
await closeAll();
await say(C12, '그리고 지금 할 일을 하나씩', '끝나면 [끝냈어요] · 막히면 업무를 열어 [막혔어요]');
await top(500);
await settle();
await wait(300);
await r.finish();
