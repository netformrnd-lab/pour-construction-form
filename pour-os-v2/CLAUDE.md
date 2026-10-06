# 업무OS v2 (시험판) — pour-os-v2/

두 앱이 같은 데이터를 씀:
- **실사용 앱** `https://pour-construction-form.pages.dev/pourstore-renewal/os2.html` — 팀원 모두. 오늘 · 달력 · 프로젝트 · 더보기
- **관리자 화면** `https://pour-construction-form.pages.dev/pourstore-renewal/os2-admin.html` — 마스터 4명만(isMaster). 한눈에 · 사람 · 협업 맵 · 반복 실행 · KPI([KPI | 월말 보고서 | 그로스보드]) · 프로젝트 · 정리 · 설정
- **월말 보고서 공유 페이지** `https://pour-construction-form.pages.dev/pourstore-renewal/os2-report.html#<보고서id>~<열쇠>` — 로그인 없이 보기만 (reports 문서 하나만 읽음)
- v1 은 `os.html` 그대로.
- 신제품 보드 바로 읽기(core.syncNewLaunch): 두 앱 모두 로그인 뒤 한 번 버전1 `pour-os/launch-board/products` 를 읽어 v2 에 없는 제품(lb_<id>)만 프로젝트·항목으로 새로 만듦. 이미 있는 제품·항목은 덮지 않음(바뀐 출시일·체크는 관리자 설정 › 신제품 보드 다시 가져오기). 쓰기 전 v2 프로젝트를 서버에서 다시 확인 · 기록에 남김
- 빌드: `cd pour-os-v2 && ./build.sh` (실사용 → os2.html, 관리자 → os2-admin.html, 공유 보고서(report.html · src/report-main.jsx) → os2-report.html 셋 다 복사)
  (node_modules 는 `../pour-os/node_modules` 심볼릭 링크 — 같은 패키지)
- 테스트: `node src/model.test.mjs` · `launch.test.mjs` · `turn.test.mjs` · `views.test.mjs` · `flow.test.mjs` · `routine.test.mjs` 등 src/*.test.mjs (계산). 화면 시험은 가짜 저장 장치로만 — 실제 Firestore 에 쓰지 않음.

## v1 보호 (가장 중요)
- 쓰기는 오직 `pour-os/v2/**` 와 Storage `task-attachments/v2/**`. v1 문서(`pour-os/state-*`, `pour-os/ak-notes/c`)는 **읽기만**.
- 기기 저장 이름도 `pour-os2-…` 로 따로 (v1 `pour-os-…` 와 안 겹침).
- 보안규칙 `pour-os/{doc=**}` · `task-attachments/**` 안이라 **규칙 변경 없음**.

## 저장 구조
- `pour-os/v2` — 복사 정보 {seededAt, counts, reseededAt, reseededBy}
- `pour-os/v2/<키>/{id}` — 1건 = 문서 1개 (tasks · projects · users · notes · log · events · brands …). 바뀐 칸만 `updateDoc`.
- 고정업무 체크: 업무의 `doneDates.<사람>` 등 사람별 칸만 점 경로로 저장 + `pour-os/v2/checks/{업무~사람~날짜}` 기록.
- 처음 열 때 '버전1 데이터 복사하기'(읽기 전용 복사). 마스터는 관리자 화면 › 설정 › '버전1에서 다시 가져오기'(merge — v2 전용 칸 유지).
- 읽기 비용: 열린 업무 + 최근 30일 끝낸 업무 + 최근 30일 댓글 + 14일 기록만 구독. 나머지는 열 때 조건 조회.

## 여러 사람이 같이 쓸 때 (10단계)
- 쓰기는 바뀐 칸만(updateDoc) · 기록·상태 기록·끝내기 기록·파일은 arrayUnion(더하기만) · 고정업무 체크는 사람별 점 경로 — 원래 안 겹침
- fb.patchIf / patchManyIf: 서버 지금 값이 기대값과 같을 때만 씀(transaction). 연결이 끊겨 확인을 못 하면 예전처럼 그냥 씀
- 되돌리기(core.undoMany/undoTask): 내가 쓴 값이 아직 그대로인 문서만 되돌리고, 그사이 다른 사람이 바꾼 건 건너뛰고 '그사이 다른 사람이 바꿔서…' 알림 (끝냄·확인·담당·결정·한꺼번에·일 넘기기·기한·출시일·프로젝트 끝내기·고정업무 담당)
- 메모·지금 상황(core.saveText): 고치기 시작할 때 본 버전(memoAt · now.at) 그대로일 때만 저장 → 겹치면 ui.Clash(그 사람 글 보여 주기 · [그 글에 내 글 붙여서 다시 보기] [내 글로 저장]) · 내 글은 지우지 않음
- 참조 = 한 사람씩 arrayUnion/arrayRemove(A.toggleCc) · 회사 쉬는 날 = fb.merge days.날짜(빼기는 deleteField) · PIN 처음 정하기 = 아직 PIN 없을 때만(patchIf) · 신제품 보드 새 제품 = fb.createMissing(없을 때만 만들기)
- 시험: 가짜 저장 장치 window.__OTHER(key,id,fields) 로 '다른 사람이 지금 바꿈' 흉내 (os2/t25 · admin t15)

## 신제품 대시보드 ↔ 업무OS 양쪽 (사용자 결정 2026-10-05 · 방식 (나))
- v2 가 신제품 대시보드 문서(pour-os/launch-board/products)에도 씀 — 이 곳만 '쓰기는 v2 만' 규칙의 예외. 단계 칸만, 조건부(fb.patchLaunchIf), 지우지 않음, 큰 쓰기 전 통째 백업(fb.backupLaunch → pour-os/v2/backups)
- 정해진 것: 기한 = 업무OS 자동 기한도 신제품 대시보드에 '자동' 표시로 채움(사람이 고친 기한은 그대로) · 카테고리 대시보드 = 업무OS 안 탭 (+ 프로젝트에 '대시보드 만들기' 버튼은 나중에) · 댓글·자료·요청·담당 넘기기·보류는 업무OS에만, 신제품 대시보드엔 개수 + '업무OS에서 열기 ›'
- 1단계(완료): 담당 = 업무OS 사람 기준. launch-board.html 이 pour-os/v2/users 를 읽기만 해서 담당 고르기 목록(사용 중인 사람 + 외주) · 저장은 이름(owner, 버전1·소싱앱·가격 대시보드 호환) + ownerIds · 이름 규칙 launch.osIdOf(같은 이름 → 끝이 같은 사람 1명일 때만) = launch-board osIdOf 와 같은 계산(둘 다 고칠 것) · 관리자 설정 '신제품 대시보드 연결 › 담당 맞추기'(admin/LaunchLink.jsx · launch.planOwnerIds: 미리 보기 → 백업 → ownerIds 만 더함, 그사이 담당이 바뀐 제품은 건너뜀) · 가져오기(planLaunchImport)는 ownerIds 가 있으면 여러 명 그대로
- 2단계(완료): 신제품 대시보드 → 업무OS 자동 반영 (core.useLaunchSync · syncLaunchBoard · lbsync.planLaunchSync · 시험 lbsync.test.mjs · os2/t26). 두 앱 모두 로그인 뒤 신제품 대시보드를 실시간 구독(fb.listenLaunch) → 제품 updatedAt ≠ 프로젝트 lbSyncedAt 인 것만 그 프로젝트 업무를 읽어 비교(평소엔 읽기 0). 칸마다 lbSeen(마지막으로 본 신제품 값: 업무 status·owners·due·note / 프로젝트 launchDate·name)과 3-way: 신제품만 바뀜 → 넣음 · 둘 다 → 나중 쪽(단계 updatedAt vs v2At) · 처음엔 v2At 없는 업무만 신제품 값으로. 신제품 빈 담당·빈 마감은 업무OS 값을 안 지움(마감을 지우면 자동 기한으로). 해당 없음 = status dropped + lbSkip + skipItems(지우지 않음). 출시일 바뀌면 자동 기한 업무만 옮김. 프로젝트째 보류·중단으로 접힌 업무는 상태 안 건드림. 쓰기는 patchManyIf(expect lbSeen·v2At) · v2At 안 찍음 · updatedBy 'board' · 기록 1건(action sync '신제품 대시보드에서'). 다 들어갔을 때만 lbSyncedAt 올림(건너뛴 업무는 다음에 다시). 새 제품은 syncNewLaunch(가져올 때 lbSeen·lbSyncedAt 같이)
- 출시일·기한 쉽게 바꾸기(launchfix.jsx): 신제품 프로젝트 맨 위, 출시 전에 끝낼 항목(launch.preLaunchItem = off<0) 중 기한이 출시일보다 뒤인 게 있거나 출시일이 지났는데 남은 항목이 있을 때만 빨간 테두리 카드 → [출시일 1주 미루기 · 2주 · 날짜] / [출시일 그대로 · 남은 항목 기한 다시 나누기(rebalanceLaunch · 출시일이 오늘·지났으면 안내만)] → 미리 보기(옮겨질 수 · 사람이 정한 기한 그대로 · 늦음 a → b) → A.setLaunchDate / A.applyDues (30개 이상 확인 창 · 5초 되돌리기). 책임자·마스터만 버튼. 오늘·달력 '곧 내 차례'의 '출시보다 늦음' 줄은 책임자·마스터에게 '고치기 ›'(그 프로젝트). '출시보다 늦음'(turn.js)은 출시 전 항목만 — 광고·리뷰·체험단처럼 출시일·출시 뒤 할 일은 아님. 업무 기한 칩에 '출시 전 평일'
- 3단계(완료): 업무OS → 신제품 대시보드 (core.pushLaunchBoard · lbpush.planLaunchPush · 시험 lbpush.test.mjs). 신제품 신호 뒤 + 업무OS 데이터가 바뀔 때마다(1.5초 모아서) 같은 lbSeen 으로 비교: 업무OS만 바뀐 칸 → 신제품 문서 stages.<id>.* 에 patchLaunchIf(expect 단계 updatedAt · 출시일·이름은 그 값) → 성공하면 업무·프로젝트 lbSeen 새로(patchManyIf expect 옛 lbSeen · 되돌아와 다시 반영 안 됨). 상태 V2B(확인 대기 = 신제품 'doing' → 신제품에서 [컨펌] = 승인), 해당 없음 = skip, 프로젝트째 접힌 업무는 상태 안 씀. 담당 = 이름(", ") + ownerIds, 업무OS에 없는 이름(외주…)은 남김. 기한: 사람이 정한 날 그대로 · 자동 기한은 날짜 + dueAuto(같은 날짜 문자열 — 신제품에서 날짜를 바꾸면 자동 표시가 저절로 풀려 '사람이 정한 마감'이 됨 · launch.itemState 가 dueAuto===due 면 due '' + autoDue 로 읽음) · 신제품 '미정'(dueTbd)이면 안 덮음 · 자동 날짜만 채울 땐 단계 updatedAt·기록 안 바꿈. 실제 바뀐 게 있으면 제품 updatedAt·updatedBy '이름 (업무OS)'·history '업무OS에서 · …'. 하루 첫 쓰기 전 backups/launch-YYYY-MM-DD(없을 때만). 업무OS(osExtra) 칸·v2에서 만든 새 제품(lb_v2…)은 신제품 대시보드에 안 씀. 바로가기: launch-board.html 제품 화면에 '업무OS에서 열기 ›'(os2.html#p-lb_<id>) · 단계마다 댓글·자료·기한 요청 수 + '업무OS · 컨펌 요청 ›'(#t-<업무 id>) · 확인 대기 표시(pour-os/v2 tasks·notes 읽기만) · 업무OS 신제품 프로젝트 머리에 '신제품 대시보드에서 보기 ›'(/launch-board?p=<id>)
- 4단계(완료 · 시험 lbsync.test · lbpush.test · os2/t30~t32): ① 휴지통 = 신제품 대시보드 deletedAt → 업무OS 프로젝트 중단(dropReason '신제품 대시보드 휴지통' · 열린 업무 dropped + dropPrev + trashBy 'board', 지우지 않음) · 되살리면 다시 열기(trashBy 업무만 이전 상태) · 업무OS에서 이미 끝낸/중단한 건 표시만(lbTrash 'kept') — lbsync.planLaunchTrash. 해외 하위 프로젝트 = 제품 project → proj.lbProject · lbProjectName(구조 문서 projects 이름 · fb.listenLaunch 가 items.structure 로 넘김) · 목록·머리에 표시 · 처음 채울 땐 기록 없음. ② 마감 미정 = 신제품 dueTbd ↔ 업무OS 기한 없음 + 자동 아님(lbsync.v2Due · 비교 값 "tbd") · 자동 기한으로 안 덮음. ③ 할 일 줄 = stages.<id>.tasks[] ↔ 하위 업무(parentId = 항목 업무 · lbRow = 줄 id · 제목 = 내용 첫 줄 · 메모 = 내용) · 내용·담당·마감 3-way(lbSeen) · 줄에 상태 없음(진행은 업무OS만) · 줄 지우면 하위 업무 중단(lbRowGone) · 업무OS에서 새로 만든 하위 업무는 줄 추가 · 줄 날짜 없음 = 미정 · 처음 한 번 기존 줄 따라잡기(proj.lbRows) — lbsync.planRowSync · lbpush 같은 단계 쓰기에 tasks 배열. ④ 직접 추가한 단계 = 구조 문서 custom/order → launch.customItems(영역 P1 기획→plan · P2→pack · P3·P4→content · P5→channel, 자동 기한 = 그 영역 바로 앞 기본 단계 off → 업무 lbOff) · 열린 신제품마다 업무가 없으면 만들기(createMissing · 담당 = 칸 담당 → 책임자) · 단계 지우면 업무 중단(lbStepGone) — lbsync.planCustomSteps · 상태·담당 등은 launchItemsOf(structure) 로 같이 맞춤. 단계 순서(order)는 신제품 화면에서만
- 5단계(완료 · 시험 os2/t33 · admin t17): 프로젝트 탭 [목록 | 간트 | 대시보드](catdash.CatDash) — 신제품 출시 = 제품 × 7단계 표(칸 = 남은 항목 · 빨강 = 지남/출시보다 늦음 · 진한 칸 = 지금 하는 단계 · ✓ · 누르면 그 프로젝트 그 단계 펼침) + 요약(이번 달 출시 · 출시보다 늦는 항목 · 확인 대기) · 다른 카테고리 = 프로젝트 × [지금 · 다음 · 진척 · 마감] + 요약(진행 중 · 지난 업무 · 평균 진척) · 표는 가로로만 밀림(첫 열 고정). 프로젝트 한 장 '대시보드 만들기 ›'(책임자·관리자 · p.dash) → [대시보드] 탭(catdash.ProjDash: [상태별 | 담당별(남은 일)] 칸 · 카드 누르면 업무 · '대시보드 없애기'는 업무 그대로)
- 팀(사용자 결정 2026-10-05): model.TEAMS 1팀·2팀·3팀·공용 · 사람 팀 = users.team → 없으면 DEFAULT_TEAMS(조직도 + 정정: 이우민 1팀 · 윤미니 공용 · 허지은 공용) · 관리자 › 사람 '팀' 칩 · 프로젝트 팀 = p.team(정보 칩 · 기본 '자동') → 자동 = 해외 하위 프로젝트(lbProject)면 3팀, 아니면 책임자 팀(model.projTeam). 프로젝트 탭 위 [모든 팀 | 1팀 | 2팀 | 3팀 …] 칩(목록·간트·대시보드 공통)
- @ 태그 문자 알림(완료 · 사용자 결정 2026-10-05 · mention.js · smsui.jsx · 시험 mention.test.mjs · os2/t34 · admin t17): 댓글 칸에 '@' → 사람 고르기(mentionPick · 끝 토막 기준) · 저장 때 parseMentions(@이름 · 끝이 같은 사람 1명이면 '@송희'도) → notes.mentions · 받는 사람 '확인할 것'에 '@ 나를 부름'(kind mention · [답하기] → 그 대화 칸) · 문자: smsTarget(번호 users.phone · 사용 중 · 나 아님 · 켬) + smsOpen(각자 users.sms {on, weekend, from, to} · 시간은 08:00~18:00 안에서만 · 주말·공휴일은 본인 선택, 기본 안 받음) → 큐 pour-os/v2/smsq/{사람}(fb.txDoc transaction) → 마지막으로 보낸 지 10분 지났으면 바로, 아니면 묶음으로 기다림 · 로그인한 아무 기기나 큐를 구독하다 1분마다 보낼 차례인 것만(core.useSmsFlush · 한 기기만 보냄) · 시간 밖이 되면 큐 비움(앱에만 · 몰아서 안 보냄) · 보내기 = 같은 사이트 /send-sms(functions/send-sms.js · 솔라피 키는 Pages 환경변수) · 실패하면 smsq.lastError · 기밀 업무 댓글은 문자에 내용 안 넣음. 번호는 관리자 › 사람 › 휴대폰 번호(마스터 · 화면엔 가려서), 설정은 더보기 › 문자 알림
- 반복 ↔ 신제품 같이 세기(완료 · 사용자 결정 2026-10-05 '설정 없이' · 시안 mockups/step6b · routine.js · routineui.jsx · 시험 routine.test.mjs · os2/t35): 오늘 '이번 주 할 횟수' = 내 행동지표(akWho · 사용 중) 이번 기간 n/목표(주간 = 이번 주 · 월간 = 이번 달 · 분기) [+1] (% 항목 +10% · 실패 기준 항목은 [실패 +1]도). 실적 = 버전1 kpi-act-YYYY-Qn(읽기만) + v2 pour-os/v2/kpiact/{YYYY-Qn}(같은 모양 · fb.txDoc transaction · log 에 누가·언제·같이 센 업무) 합(routine.sumAk) — 관리자 사람·반복 실행도 같은 합. 짝 = 행동지표 이름 낱말(괄호 안 말 빼고 · 체험단 빼고: 컨텐츠·포스팅·블로그 → 블로그 포스팅 · 숏폼·릴스 → 숏폼 생성 · 광고 → 메타 광고·디맨드젠) ↔ 신제품 횟수 항목(목표 n회). 반복 [+1] → 내 열린 횟수 항목(진짜 담당 먼저 · 없으면 책임자로 채운 임시 담당 · 브랜드가 다르면 따로(같은 브랜드끼리만) · 출시 21일 전~45일 뒤 또는 기한 2주 전~3주 뒤 · 최대 5개): 1개면 같이 세고 그 줄 아래 '○○ 블로그 포스팅에도 셌어요 (n/3) · 취소'(취소 = 방금 누른 것 통째로 · 반복 −1 + 신제품 −1 · 처음 누른 주로) · 여러 개면 그 자리에서 '어느 제품 포스팅이에요?' 칩 + 해당 없음(반복은 이미 +1) · 없으면 '셌어요 · 취소'(취소 = 반복 −1). 업무 화면(횟수 항목) '횟수 n/목표' [+1](담당·책임자·마스터 · 다 채우면·확인 대기면 버튼 없음 · 취소 = 통째로) → 내 반복 짝 1개면 같이 · 여러 개면 고르기. 횟수 → 업무 count · 제목 (n/목표) · 처음 세면 진행 중 · 목표 채우면 끝냄 · 줄이면 다시 진행 중 (core.launchCount = 업무 문서 transaction 으로 서버 지금 횟수에 더함 · countLog · 실패하면 '셌어요' 안 띄움). 두 번 눌림 막기(누르는 동안 버튼 잠금). 분기는 켜 둔 채 날이 바뀌어도 따라감. 횟수 항목은 신제품 문서의 버전1 업무OS 칸(osExtra)이라 업무OS v2 는 쓰지 않음(읽기만: 버전1에서 바뀐 만큼(차이)만 업무OS 횟수에 더함 · v2 에서 센 건 안 덮음 · 횟수 항목 상태는 합친 횟수로만 정함). 업무량: 반복 실적과 신제품 항목은 각각 한 번씩만(같은 +1 이 반복 칸에 1 · 프로젝트 칸엔 항목 1건)
- CRM·마진 → 업무OS 다리(완료 · 사용자 결정 2026-10-05 · links.js · 시험 links.test.mjs · os2/t36): 다른 앱이 pour-os/v2/links/{id} 에 '할 일 한 줄'을 씀(업무OS 는 읽기만 · fb.listen open==true) = {src crm|margin, kind recall·visit·dealerOrder·quoteAccepted·dealerChat·lowStock·bigDeal(큰 건)·marginLow(마진 낮음)·priceReq(가격 컨펌), title(이름·업체명), sub, date(이날부터 보임), time, owner(이름), ownerOsId, url, open} — 전화번호·주소·상담 내용 없음. 받는 사람 = ownerOsId → 이름 끝이 같은 사람 1명(1글자 이름은 안 맞춤) · 없으면 마스터. '확인할 것'에 태그(재통화·방문예약·대리점 발주…) + 'CRM ›'(그 앱 그 화면 새 창) · 지난 날짜는 빨강 'n일 지남' · keep(읽음 표시로 안 사라짐 · 그 앱에서 처리되면 open:false 로 사라짐). CRM 쪽 = pour-crm 저장소 src/utils/osBridge.js + hooks/useOsBridge.js(CRM 로그인 세션에서 상담·대리점 발주·채팅 실시간 · 재고 위험·매출은 3시간에 한 번) · 상담 '담당 (업무OS)' 고르기(owner·ownerOsId, 비어 있으면 작성자). 매출(원본 = CRM) 월·채널 합계 → pour-os/v2/kpisales/crm-pourstore (2단계 KPI 화면이 읽음). 마진 낮음·가격 컨펌 = 아래 '⑤ 마진 v2 (폰)'
- ② KPI 화면(완료 · 사용자 결정 2026-10-05 · 시안 step8 · kpi2.js · kpiui.jsx · ghsales.js · 시험 kpi2.test.mjs · admin t18 · os2/t37): 정의(최종목표·메인KPI·서브KPI·결과 KPI·행동지표) = 버전1 문서 읽기만(state-goals·mainKPIs·subKPIs·lagKPIs·actionKPIs) · 합계 규칙은 버전1 kpi.js(skCur·mkCur)·brand.js(withAutoSales) 그대로. 매출: POUR스토어 = CRM 이 버전1 서브KPI(채널 코드)에 넣는 누계(crmSynced → 'CRM 자동') · 그로홈 = 그로홈 대시보드 salesRecords 를 REST 로 읽기만 → pour-os/v2/kpisales/grohome {rows:[{b,ym,ch,amt}], n, at, checkedAt}(마스터 기기 · 3시간에 한 번 · 실패하면 30분 뒤 · 0건이면 예전 합계 유지 · 바뀐 게 없으면 checkedAt 만). 관리자 화면 'KPI' 탭(KpiBoard): 브랜드 칩(브랜드 따로) → 결과 KPI(이번 달 값/목표 · 5개 넘으면 더 보기) → 최종 목표(네이비 띠) → 메인KPI → 서브KPI(값/목표 · 어디서 온 숫자: CRM 자동 · 그로홈 대시보드 자동 · 프로젝트 매출 합계 · 직접 입력) · 누르면 '움직이는 것' = 연결된 행동지표(akLink · 이번 기간 n/목표 · 담당) + 열린 프로젝트(subKPIId/mainKPIId · 진행 %, 누르면 프로젝트). 더보기 › 내 KPI(MyKpiSheet): 내 행동지표·내 프로젝트(책임자·함께)가 걸린 KPI 만 · [오늘 할 횟수 보러 가기]. 결과 KPI 월말 입력(LagSheet · 마스터·결과 KPI 권한 can kpiLag · 나머지는 보기만): 달 ‹ › · 브랜드별 · 목표·지난 값 · 숫자만 · 바뀐 것만 저장 → pour-os/v2/lagvals/{결과KPI id} {monthly:{YYYY-MM:{v,by,byName,at}}, hist[]}(fb.txDoc · 비우면 v:null + 이력 · 버전1 monthly 는 읽기만 — 화면 값 = v2 있으면 v2, 없으면 버전1). 알림: 마스터·권한자 '확인할 것'에 '10월 결과 KPI 넣기 · n개 남음 · 브랜드별 수'(kind lagDue · 마지막 평일 3일 전부터 그 달, 새 달 10일까지 지난달 · 다 넣으면 사라짐 · [넣기] → 입력 시트). KPI 고치기(사용자 결정 2026-10-05 · 마스터 · 시험 kpi2.test · admin t19): 관리자 KPI 탭 [KPI 고치기] → 줄마다 [고치기]·[+ 메인KPI/서브KPI/결과 KPI/최종 목표 추가] → KpiEditSheet(이름 · 목표 · 단위 · 짧은 이름/연도/기준값/묶음 · 서브KPI 지금 값은 사람이 넣는 칸만(kpi2.skManual — CRM·매출 자동·프로젝트 합계·출시 수는 못 넣음, 넣으면 manualOverride)) · 지우기 없음 → 숨기기/다시 보이기(숨긴 것 목록 · 메인KPI를 숨기면 그 서브KPI도). 저장 = pour-os/v2/kpidefs/{id} {coll, fields(바꾼 칸), hidden, created(v2에서 새로 만든 것 · id v2k_…), hist[{at,by,byName,ch:{칸:[이전,이후]}}]}(fb.txDoc) · 버전1 정의 문서 위에 덧칠(kpi2.applyKpiOv · 화면 계산은 visibleDefs) — 버전1 KPI 화면 값은 그대로(v1 은 읽기만). 결과 KPI 정의도 같은 덧칠(core D.kpi.lagRaw → lagDefs)
- ③ 그로스보드 v2 + 월말 보고서 — 1단계(완료 2026-10-06 · 아래 '월말 보고서 · 그로스보드 v2') → 2단계(완료 2026-10-06 · 아래 '그로홈 대시보드 ↔ 업무OS 쌍방향'): 목표·결과 KPI·보고서 링크 · 그로홈 그로스보드 할 일 = 업무OS 업무 → ④ CRM v2 폰(완료) → ⑤ 마진 v2 폰(완료 2026-10-06 · 아래) · 관리자 협업 맵(완료 2026-10-06 · 아래 '협업 맵')
- 시험: scratchpad/lb (launch-board.html 을 가짜 Firebase compat 로 띄움) · admin t16

## 월말 보고서 · 그로스보드 v2 (③ 1단계 · 사용자 확정 2026-10-06 · 시안 step8 ③ · step9 · step10 ① · step11 ③ · 시험 report.test.mjs · os2/t43 · admin t26)
- 들어가는 곳: 팀 앱 더보기 › '성과' › 그로스보드 · 월말 보고서(시트 growth · reports) / 관리자 KPI 탭 위 [KPI | 월말 보고서 | 그로스보드](기기 기억 pour-os2-kview-<나> · 기본 KPI)
- 계산 report.js(저장 없음) · 화면 reportui.jsx(ReportBody · AdminTools · ReportNotes) · 한 장 그리기 reportview.jsx(앱·공유 페이지 같이) · 공유 페이지 report-main.jsx
- 월말 보고서 = 달 ‹ › + 범위(브랜드 칩 · '프로젝트 하나 ▾') → 바로 미리 보기. 초안 = 지금 값(계속 바뀜) · 팀원도 봄 · 매출 금액 기본 보임
  · 브랜드: 머리(매출 목표 n% 달성 · 매출(월 목표 = 그 해 브랜드 최종 목표 ÷ 12) · 끝낸 프로젝트 · 반복 일 %) → 한 줄 정리 → 채널별 매출(POUR스토어 = kpisales/crm-pourstore months · 그로홈 = kpisales/grohome rows · 그 밖 브랜드는 매출 원본 없음) + 올해 누계/누계 목표 → 결과 KPI(그 달 · v2 먼저) → 끝낸 프로젝트(completedAt·endLog 그 달) → 진행 중 프로젝트 → 반복 일 달성(횟수 목표 · 주간 = 주 수 × 목표 · 월간 = 목표 · 분기 = 목표 ÷ 3 · %·실패 기준 뺌 · 다른 분기는 버전1 kpi-act-분기 읽기만 + v2 kpiact 합 · 못 읽으면 '—') → 지난 일·막힘(그 달 기한인데 기한 안에 못 끝낸 것) → 다음 달에 할 것(다음 달 마감·출시)
  · 프로젝트 브랜드 = 브랜드 칸 → 메인KPI 브랜드(버전1 projBrand) · 둘 다 없으면 이름에 브랜드 이름이 하나 있으면 그 브랜드(report.projBrandR · '그로홈 기부')
  · 프로젝트: 진척(끝낸 업무/전체) · 그 달 끝낸 업무 · 늦은 업무 · 기간 · 그 달 흐름(끝낸 순 · 늦음 n일 · 자료 n) · 남은 일 · 담당별. 업무는 그 프로젝트 전부를 열 때 한 번 읽음(fetchWhere projectId) · 브랜드 보고서 프로젝트 줄 누르면 그 프로젝트 보고서
  · 30일보다 이전 달: 끝낸 업무를 그 달 1일부터 한 번 읽음(reportui.useDoneSince · fetchWhere doneAt >= · 읽기만)
  · 기밀 업무·프로젝트(그 안 업무·하위 업무 포함)는 보는 사람과 상관없이 보고서·그로스보드에 아예 안 넣음(report.hiddenSet)
- 저장 pour-os/v2/reports/{브랜드id|프로젝트id}-{YYYY-MM}(report.reportId) = {kind brand|project, key, ym, title, status draft|final, data(확정본 또는 초안 공유본), dataAt, final{at,by,byName}, share{on, token, at, by}, hideMoney, summary·summaryAt·summaryBy·summaryHist[], log[]} — fb.txDoc · 지우지 않음
  · 관리자: 한 줄 정리(초안일 때 · summaryWrite) · [이 달 보고서 확정](확인 창 → confirmWrite: 지금 값을 data 로 얼림 · 뒤에 바뀌어도 그대로 · 화면은 확정본 + [지금 값 보기]) · [공유 링크 만들기](새 열쇠 · 초안이면 지금 값을 공유본으로) / [공유 링크 복사] · [더 하기 ▾] 공유 끄기(예전 링크 안 열림 · 다시 만들면 새 열쇠) · 공유 내용 지금 값으로(초안) · 공유에서 금액 숨기기/보이기 · 다시 확정(이전 확정본 → pour-os/v2/reporthist/{id}~시각 · txDocs 한 번에)
  · 팀원: 보기만 · 공유 중이면 [공유 링크 복사]
- 공유 링크 = os2-report.html#<id>~<열쇠>(report.shareUrl — 관리자·팀 앱 어디서 복사해도 같은 폴더의 os2-report.html) · 로그인 없이 보기만 · 읽는 것은 fb.getOne('reports', id) 하나뿐 · 열쇠가 다르거나 공유가 꺼지면 '공유가 꺼졌거나 바뀐 링크예요' · 확정본은 얼린 한 줄 정리, 초안 공유본은 지금 한 줄 정리 · 금액 숨김이면 금액 대신 % · noindex
- 관리자 메모 = pour-os/v2/reportnotes/{id} {reportId, kind comment|minutes|ceo, title(회의 이름), text, by, byName, at} — 관리자 누구나 [댓글 · 회의록 · 대표님 피드백] 더하기만 · 관리자 화면에서만 구독(reportId ==) · 보고서 문서(data)에 안 들어감 · 공유 페이지는 이 모음을 절대 안 읽음
- 그로스보드 v2(growth.js · growthui.jsx · 저장·쓰기 없음): [나 | 우리 팀(model.teamOf) | 모두(관리자만)] · [이번 달 | 지난달 | 반기] → 뿌리(기간 · 누구 · KPI n) → KPI(kpiBoard 의 메인·서브KPI · % · 어디서 온 숫자 · 브랜드) → 프로젝트(subKPIId → mainKPIId · 연결 없으면 'KPI 연결 없음') · 반복(행동지표 akLink · 담당 akWho) → 그 기간에 끝낸 일(담당이 그 사람들) · 프로젝트 없는 끝낸 일은 '프로젝트 없는 일' · 끝낸 일 있는 KPI 먼저. 프로젝트 = 그 사람들이 맡은(책임·함께·열린 업무) 열린/그 기간 끝낸 프로젝트 또는 그 기간 끝낸 일이 있는 것
  · [계층 | 마인드맵](처음 폰 계층 · PC 마인드맵 · 기기 기억 pour-os2-gbview) · 마인드맵 = mmlayout(visibleTree·layoutTree·curve) + 프로젝트 마인드맵 모양(mindmap.NST) · KPI 누르면 접기/펼치기 · 프로젝트·끝낸 일·반복 누르면 그 시트 · [화면에 맞추기] [모두 펼치기] [그림으로 저장](svgpng.savePng · 그로스보드_<누구>_<기간>_<날짜>.png) · 반기 등 30일 넘는 기간은 끝낸 업무를 한 번 더 읽음
- 한계: 'Firestore 규칙이 pour-os/** 공개'라 관리자 메모·보고서 문서·공유 열쇠 확인은 화면에서만 지킴(기밀과 같음) — 문서 id 를 알고 API 로 직접 읽는 것은 못 막음 · 공유 페이지의 금액 숨김도 화면에서만(문서에는 금액이 있음)
- 2단계(완료) = 아래 '그로홈 대시보드 ↔ 업무OS 쌍방향'

## 그로홈 대시보드 ↔ 업무OS 쌍방향 (③ 2단계 · 사용자 확정 2026-10-06 "그로홈대시보드 읽고 쓰기도 해야해 쌍방향으로" · "그로홈 그로스보드 할 일 = 업무OS 업무로 같이 쓰기" · 시안 step10 ② · 시험 그로홈 저장소 osCalc.test.mjs · scratchpad/ghos/t1 · os2/t44 · admin t27)
- 그로홈 쪽 코드 = netformrnd-lab/grohome 저장소 `src/osLink.js`(pour-app-new 두 번째 앱 'pourOs') · `src/osCalc.js`(계산) · `src/OsLink.jsx`(화면) · 규칙은 그 저장소 CLAUDE.md. 그로홈은 pour-app-new 의 `pour-os/v2/**` 만 읽고 씀(tasks · projects · log · lagvals · kpidefs · reports 읽기 · users 읽기) — 버전1 문서·신제품 대시보드는 안 건드림 · 지우기 없음 · 보안규칙 변경 없음
- 같은 문서를 양쪽이 씀 → 업무OS 쪽은 따로 할 일 없음(구독 그대로): 결과 KPI = lagvals/{id}.monthly[YYYY-MM](kpi2.lagWrite 모양 · 그로홈은 연 때 본 값과 다르면 안 덮음) · 채널 목표 = kpidefs/ghs1~6 fields.targetValue(kpiEditWrite 모양 · hist · 그로홈은 업무OS 관리자만 · 연 뒤 업무OS에서 고쳤으면 안 덮음) · 월말 보고서 = 그로홈이 reports/grohome-YYYY-MM 읽기만 → share.on 이면 '10월 보고서 보기 ›'(os2-report.html#id~열쇠) · reportnotes(관리자 메모)는 안 읽음
- 그로홈 그로스보드 업무 = 업무OS 업무: 프로젝트 gh_kpi_<그로홈 KPI id>(brand grohome · 버전1 '그로홈 가져오기'가 만든 5개 + 그로홈에서 새 KPI 첫 업무 때 없을 때만 만듦 · 카테고리 ops) · 업무 = 버전1 가져오기 gh_gb_<그로홈 id> 177개 + 그로홈에서 새로 만든 것(madeIn 'grohome' · core.addTask 와 같은 칸) · ghKrId(KR) · parentId(그로홈 '이어서 추가') · 메모 줄 '분기: / 이유: / 결과:' + 칸 ghQuarter · ghWhy · ghResult · 담당 못 맞춘 이름 ghAssigneeName
  · 그로홈에서 고치기 = 바뀐 칸만 + 기대값(서버 지금 값이 본 값과 같을 때만 · transaction · 연결이 끊기면 안 씀) · v2At·updatedAt·updatedBy · statusLog arrayUnion · log 1건(via 'grohome') · 메모를 다시 쓰면 memoAt·memoBy·memoByName 도(업무OS 메모 고치기가 겹침을 앎) · 상태 계획/진행중/완료 = todo/inprogress/done(확인 요청 없이 바로 끝 · doneBy) · [삭제] = dropped + dropPrev(지우지 않음) · 끝내면 프로젝트 progress 다시 계산(core.recalc 와 같음)
  · 누가: 그로홈엔 로그인이 없어 화면의 '업무OS에 남는 이름'(기기 저장) → launch.osIdOf 와 같은 이름 규칙으로 업무OS 사람 → by = 그 id · byName '이름 (그로홈)' / 못 맞추면 by 'grohome' · '그로홈 대시보드'. 업무OS 화면엔 기록·상태 기록·메모 수정자에 그 이름이 그대로 보임. 관리자 버튼(목표 고치기 · 옮기기)·결과 KPI 넣기(can kpiLag)는 그 이름의 권한으로 화면에서만 막음(본인 확인 아님)
  · 예전 그로홈 gbTasks: 업무OS 에 gh_gb_ 가 있으면 업무OS 것만 보임 · 없는 것만 그로홈 원본 그대로(그 업무만 예전처럼 그로홈에 고침) · 그로홈 관리자 [업무OS로 옮기기] = 없는 것만 createMissing(ghImport 모양) · 이미 있는 것은 업무OS 내용 그대로(덮지 않음) · 그로홈 원본은 지우지 않고 movedTo·movedAt·movedBy
  · 업무OS 에서 그 프로젝트에 KR 없이 만든 업무는 그로홈에서 'KR 미정 (업무OS에서 추가)' 아래
- 업무OS 화면: 업무(프로젝트 gh_kpi_) '그로홈 그로스보드 업무 · 그로홈 대시보드에서 보기 ›'(model.ghDashUrl = grohome-dashboard.web.app/?m=kpi.growthBoard&t=<업무 id> → 그로홈이 그 업무를 열어 줌) · 담당이 비고 ghAssigneeName 이 있으면 '그로홈 담당 이름' · 프로젝트 머리 '그로홈 그로스보드 KPI · 그로홈 대시보드에서 보기 ›' · 관리자 KPI 탭 그로홈 아래 안내 줄에 '그로홈 대시보드에서 보기 ›'
- 한계: 그로홈의 결과 KPI 정의는 버전1 GH_LAG_SEED 복사본 + kpidefs 덧칠(버전1 문서를 안 읽음 · 2026-10 실데이터와 같음) → 버전1 결과 KPI 문서를 직접 고치면 그로홈엔 안 보임(고치기는 업무OS 'KPI 고치기'로) · 버전1 monthly(2026-10 전 달 값)는 그로홈에 안 보임 · 그로홈 자체 KPI·KR 구조(gbConfig)와 리뷰관리 카드 값(settings/reviewAchievement)은 그로홈에만 · 'Firestore 규칙이 pour-os/** 공개'라 그로홈 쪽 권한도 화면에서만

## 반복 실행 · 고정업무 정리 (사용자 확정 2026-10-06 · 시안 mockups/step13-routine-fixed.png)
- 개념: 반복 실행 = 브랜드 운영(브랜드 꼭 · 관리자가 브랜드별로 봄 · 모양 둘: 정한 날 체크 / 횟수 목표) · 고정업무 = 나만의 알림(브랜드 없음 · 본인이 만들고 고침). 체크리스트·오늘 건수·메모·자료·대화는 셋 다 같은 칸·같은 버튼
- 결정: 브랜드 없는 고정업무 28개 → '공통 운영' 묶음(가상 브랜드 상수 · D.brands 에 없음) / 브랜드별 / 개인 4개 · 관리자 [추천대로 정하기] + 줄마다 바꾸기 + 5초 되돌리기 · 오늘 화면에서 브랜드 정한 체크는 '반복 실행' 카드 '오늘 체크' 묶음 · 건수 단위가 '회'면 [+1]=1회(건수는 날짜별 기록만), '건·명·개'면 넣은 숫자가 목표에도 더해짐 · 그로홈 52개는 주기 제안까지(확인 전엔 이행률에서만 뺌)
- 1단계(완료 · 새 저장 칸 없음 · 시험 model.test fxSubPatch · routine.test periodLabel/brandName · os2/t38 · admin t21):
  · 오늘 고정업무 줄(ui.Row below 칸): 내 체크리스트 칩(today.FxChips · fxSubs) — 끝낸 줄('끝낸 고정업무 ▾')에도 · 제목 옆 a/b(model.fxSubCount) · 2줄 = 시간 · (매주·매월) · n/m명 체크. 칩 하나 = 그 항목만(A.fxSub → model.fxSubPatch = 버전1 fixedSubPatch 규칙: 다 켜면 내 몫 끝냄 doneDates·doneAtBy · 끝낸 뒤 하나 풀면 내 끝냄만 지움 · 다른 칩·다른 사람 칸 그대로) · [완료] = 칩 모두. 칩은 줄 누르기로 안 번짐(Enter·Space 만 막음 · Esc 는 시트 닫기 그대로). 7개 이상 = 6개 + '외 n개 ›'(고정업무 시트)
  · 체크 기록 pour-os/v2/checks/{업무~사람~날짜}: fb.put → fb.merge(A.fxCheck · kind 'fx' · itemId · ym · wk) — 다시 체크·취소·되돌리기해도 그날 문서의 다른 칸(건수·기록) 안 지움
  · '할 횟수' 카드: 줄마다 기간 + 숫자 + 단위('이번 주 1 / 4건' · '10월 0 / 1회' · '4분기 0 / 1건' · '10월 30 / 100%' · 실패 기준 '10월 시도 n / g회 · 실패 f건 × k') · 담당 2명+ '내 몫 n' · 순서 주 → 월 → 분기 · 브랜드 이름 routine.brandName(b, D.brands)(bmuqo9k5u → 모여라딜). 기간 이름 routine.periodLabel = periodWeeks 가 고른 달(이번 주 월요일의 달 → 10/1(목)은 '9월')
  · 고정업무 시트: [메모 쓰기/고치기](A.setMemo · 겹치면 Clash) · 자료(A.addFiles → task-attachments/v2/task-<id>/ · 댓글 파일 같이) — 담당·관리자 · '예전 내 메모 n ▾'(버전1 사람별 메모 notes itemId `${업무}~${나}` · 읽기만)
  · 고친 것: 관리자 8주 축 칸 농도(.a-axr .c.w1~w3)·진한 칸 '▴출시/마감' 흰 칩 · 사람 반복 칸 안내 '버전1 기록 + 업무OS [+1] 합' · 관리자 로그인 안내(팀원용 [나 ▾] 안내 대신 관리자 안내 · Gate admin) · 화면 말 '마스터' → '관리자'(코드 이름 isMaster 그대로)
- 2단계(완료 · 시험 model.test scopeOf·공통 운영·주기 제안·오늘 나누기 · routine.test brandName common · workload.test 확인 전 빼기 · os2/t39 · admin t22):
  · 저장 칸(업무 · v2 만): scope 'brand'|'me'(model.scopeOf = scope → 브랜드 있으면 brand → 없으면 'unset' 브랜드 미정 · 숨기지 않음) · scopeBy·scopeAt · 주기 cycleOk·cycleBy·cycleAt · qty(3단계 예약). 다시 가져오기(core.stripV2Only · V2_TASK_ONLY)는 이 칸들 + 정한 브랜드(scope·scopeAt 있으면) + 확인한 주기(cycleOk 면 recurType·weekDays·monthDay·monthEnd)를 안 덮음
  · 공통 운영 = 가상 브랜드 model.COMMON_BRAND {id 'common'} (D.brands 에 없음) · 이름 brandLabel / routine.brandName · 칩 목록 brandsWithCommon(사용 중 브랜드 순서 + 공통 운영)
  · 추천표 model.SCOPE_REC(실데이터 2026-10-06 브랜드 없는 고정업무 28개 → 공통 14 · POUR스토어 8 · 개인 4 · 그로홈 2) · 표에 없으면 scopeRec 가 이름으로 짐작 · 1탭 = A.setScopes([{t,pick}]) (scopeFields: 개인 = scope me + brand null) · 기록 prev · 5초 되돌리기(undoMany)
  · 오늘: model.todayView → fixed(개인·미정 = '오늘' 카드 고정업무) / routine(브랜드 = '반복 실행' 카드 '오늘 체크 · n개 남음' · 시간 순서 · 같은 줄·칩 · 5개 넘으면 더 ▾ · '끝낸 체크 n ▾' · 꼬리표 밀림/시간 지남 → 브랜드 여럿일 때만 짧은 이름) · 남은 일·끝낸 일 수는 둘 다. routineui.RoutineCard 머리 '반복 실행' 하나 · 안에 오늘 체크(today.RoutineChecks) → '횟수'(행동지표 [+1]) · 폰은 '오늘' 바로 아래
  · 더보기 › 내 고정업무: '고정업무(내 것)'(개인·미정) / '내가 맡은 반복 실행'(정한 날 체크 + 내가 담당인 횟수 목표 = D.ak.items(버전1 + v2 덧칠·새로 만든 것) · routine.myRoutine · 줄 '횟수 목표 · 10월 0 / 1회 · 브랜드' → 반복 실행 시트 · 멈춘 것은 '멈춤') + 아래 [+ 고정업무] → more.AddFixedSheet(이름 · 매일/매주 요일/매월 n일·말일 · 시간 · 체크리스트 Enter 추가) → A.addFixed(scope me · 담당 나 · madeIn v2 · subsBy '*')
  · 고정업무 시트(종류 칩 '반복 실행'/'고정업무' · 경로 '반복 실행 · 브랜드 · 반복 시간' / '고정업무 · (브랜드 미정) · …') [더 하기 ▾](task.FxMore): 체크리스트 고치기(SubsEdit [공통 | 내 것] · 칩 ✕ · Enter 추가 · 같은 항목 id 그대로 → A.setSubs: 공통 '*' = fb.txDoc 로 subsBy 통째 · 내 것 = subsBy.<나> 점 경로 · 되돌리기는 내가 쓴 목록 그대로일 때만) · 보이는 이름·내 시간(labelBy.<나>·timeBy.<나> · A.setMine) · 브랜드·개인 바꾸기(ScopeEdit 1탭) · 반복·시간(RecurEdit) · 담당(관리자). 권한: 개인 = 본인 다 · 반복 실행의 공통 체크리스트·브랜드·반복·담당 = 관리자 · 담당은 내 체크리스트·이름·시간·메모·파일 · 미정은 예전처럼(담당·관리자 반복, 브랜드는 관리자)
  · 관리자 반복 실행: 안내 '반복 실행 = 브랜드가 문제없이 돌아가게 하는 일 · 개인 고정업무는 [개인]에서' · [전체 | 오늘 체크 n | 횟수 n | 개인 n] · 브랜드 칩 + 공통 운영(미정 고정업무를 모든 브랜드에 '공통'으로 섞던 규칙 없앰) · 맨 위 UnsetPanel '브랜드 안 정한 고정업무 n · 반복 실행이면 브랜드를 골라 주세요'(줄마다 [브랜드들 · 공통 운영 · 개인] · 추천 칩 '추천' · [추천대로 n개 정하기] 30개 이상 확인 창) · 개인 = 사람별 n/m 만(브랜드 칸·%에 안 넣음)
  · 그로홈 52개(반복 칸 빈 것 · model.cyclePending = isFixed && !recurType && !cycleOk): cycleGuess = 메모 '주기: …' → 이름 순으로 월1회·매월 → 매월 / 주n회·매주 → 매주 / 상시·매일·전일·금일·오전·오후 → 매일(제안 28 = 매일 22 · 매주 4 · 매월 2 · 말 없음 24) · countHint '횟수 후보'(주·월 2회+ · 2주 · 블로그·오픈채팅·홍보·체험단·인플루언서·섭외·게시글·공동구매·출시·영업·컨텍 = 21) · 관리자 CyclePanel '주기 확인 필요 n · 제안 m' [제안대로 적용](A.setCycles · 매주=월 · 매월=1일 · cycleOk) + 줄마다 [매일 매주 매월] · 확인 전엔 목록·오늘엔 그대로 보이고 달성률(관리자 오늘 체크 칸 · 사람 반복 칸 합계·topMiss)에서만 뺌(workload items.pending)
- 3단계(완료 · 시험 rec.test.mjs · kpi2.test 반복 실행 덧칠 · os2/t40 · admin t23):
  · fb.txDocs(docs, fn) = 여러 문서 한 transaction(fn(curs) → {writes[], ret} · 없던 문서는 set) · fb.increment · fetchWhere/listen 조건 여러 개([[칸,'==',값],…] 같음끼리만 · 복합 색인 없음)
  · 하루 기록 DB pour-os/v2/checks (계산 rec.js): 고정업무·정한 날 체크 `${업무}~${사람}~${날짜}` {kind 'fx', …, on, qty, qtyAt, recs[]} · 횟수 목표 `ak~${akId}~${사람}~${날짜}` {kind 'ak', akId, itemId, uid, name, date, ym, wk, brand, runs, qty, recs[]} · 체크리스트 진행 중 `ak~${akId}~${사람}~open` {kind 'akopen', subs, since}(한 바퀴 = 1회 · 날이 바뀌어도 이어짐 · 다 켜면 +1 하고 비움). 읽기: 오늘 = date==오늘 실시간(D.recs.today) · 진행 중 = kind=='akopen'(D.recs.open) · 시트 = itemId+ym(이번 달·14일 전 달) · 관리자 표 = ym. 사람(admin/People useChecks)은 kind 없음·'fx' 만
  · 쓰기(core): A.akPlus = 분기 실적(kpiact) + 그날 문서 runs 한 transaction(log 한 줄에 date·via·qty?) · A.akSub = akopen + (다 켜면) kpiact +1 + 그날 runs 한 transaction · A.akQty(add|set) = 그날 qty(+ 목표 단위 건·명·개면 같은 transaction 으로 kpiact 에도 · incl = 방금 [+1] 한 1건이 숫자에 들어 있음) · A.fxQty = 더하기 merge+increment(체크·취소해도 qty 그대로) · 고치기 txDoc(recs 에 prev). 37건은 37줄이 아니라 한 줄
  · 결정 3 단위: 목표 '회' = [+1] 1회 · 건수는 기록만 / '건·명·개' = 넣은 숫자가 목표에도(rec.qtyToGoal) / '%'·실패 기준은 예전 그대로
  · 건수 칸 qty {label, unit}: 고정업무 = t.qty(시트 [더 하기 ▾] 건수 칸 · A.setQtyCfg) · 횟수 목표 = 덧칠 fields.qty. 처음엔 모두 꺼짐
  · 반복 실행(횟수 목표) 덧칠 = pour-os/v2/kpidefs/{akId} coll 'actionKPIs'(kpi2 KCOLL · KCOLL_L '반복 실행'): fields subs(공통)·subsBy.<사람>(내 것)·qty·desc/descAt/descBy(하는 법)·brand·who·paused · 문서 맨 위 files[](arrayUnion · Storage task-attachments/v2/ak-<akId>/) → 항목 _files · 버전1 29개는 goal·cyc·unit 을 덮지 않음(applyKpiOv AK_LOCK) · 새 항목([+ 반복 실행] 횟수 목표)은 created(id v2k_act_…). 덧칠 적용은 core D.ak.items 한 곳(숨긴 것 뺌 · D.ak.raw = 버전1) → admin/Routine · People useRepInputs · kpi2.kpiBoard · 오늘 카드
  · 오늘: 건수 칸 켠 고정업무 줄은 [완료]·마지막 칩 뒤 '오늘 처리한 문의 몇 건이에요? [ ]건 [남기기] [건너뛰기]'(recui.QtyAsk · 숫자 키패드 · 바로 포커스 · 1000 이상 '맞아요?') → '오늘 문의 23건 · 고치기' · 묻는 중·방금 남긴 줄은 끝낸 줄이어도 그 자리(today.todayRows) · 2줄에 다른 사람 것까지 '모두 문의 n건'. 횟수 줄: '· 오늘 전화 37건' · [+1] → '셌어요 · 취소' + '오늘 전화 몇 건? (건 단위면 방금 1건 포함)' · [건수 넣기] 늘 · 체크리스트 있으면 [+1] 대신 칩(akopen) → 다 켜면 '1회 셌어요 · 취소' → 건수 줄 · 줄 이름 누르면 반복 실행 시트. 탭 수(375): CS 마지막 칩 → 23 → [남기기] = 2탭 + 숫자 · 고객안내전화 [+1] → 37 → [남기기] = 2탭 + 숫자
  · 반복 실행 보기 시트(rtsheet.RoutineSheet type 'fixed'|'routine' · sheets 'routine'): 머리 '반복 실행 · 브랜드 · 월 1회' → ① '10월 1 / 1회 ✓ · 담당' + 막대 ② 체크리스트 칩(한 바퀴) ③ 오늘 건수 [+ 더하기][고치기] ④ 날짜별 기록 14일(recui.RecList · 누르면 그 기록에 댓글 extra rec{date,uid,qty,runs} · 꼬리표 '10/6 기록 · 37건' · 줄에 '메모 n') ⑤ 하는 법·메모(A.akDesc · descAt 비교 transaction · Clash) ⑥ 자료(A.akFiles · 댓글 파일 같이) ⑦ 대화(itemId = akId · 버전1 메모 복사본 이어짐) · 아래 [+1](담당) · [더 하기 ▾] 체크리스트(관리자 공통 · 담당 내 것) · 건수 칸 · 브랜드 · 담당 · 목표(새로 만든 것만) · 잠시 멈추기(관리자 · A.akSet 5초 되돌리기). 고정업무 시트도 ③④ + [더 하기 ▾] 건수 칸
  · @부르기: model.todayView ':' 없는 itemId = 행동지표 id → {akId, title}(부름·내가 말한 대화) · today.openInbox → open({type:'routine'}) · core.queueMentionSms 링크 #r-<akId>(App 해시 #r-) · useItemNotes 기밀 판단은 task: 만
  · 관리자 반복 실행: [+ 반복 실행](admin/RoutineAdd.AddRoutineSheet · [정한 날 체크 | 횟수 목표] · 이름 · 브랜드 꼭(공통 운영 포함) · 담당 · 반복 또는 주/월/분기 + 숫자 + 회/건 · 체크리스트 · 건수 칸 → A.addRoutineFixed(scope brand) / A.akCreate) · [기록 보기 ›](RecBookSheet · 날짜 × 사람 '회 · 건' · ‹ › · [더 하기 ▾] CSV 반복실행_기록_YYYY-MM.csv) · 오늘 체크 줄 '문의 23건' · '메모 n · 파일 n' · 횟수 표 주 칸 아래 회색 그 주 건수 · '10월 전화 49건' · 이름 누르면 시트 · '새로 만듦'·'멈춤' 꼬리표

## 파일 미리 보기 · 올리기 진행 · 댓글 링크 (사용자 요청 2026-10-06 · files.jsx · 시험 os2/t41 · admin t25)
- 댓글 파일(task.Thread → files.NoteFiles · 업무·고정업무·반복 실행·프로젝트 한마디 모두): 사진 = 그 자리 작은 그림(loading lazy · 높이 180 안 · 2장 이상은 반씩) → 누르면 전체 화면(ImgViewer: ✕ 닫기 · ‹ 이전 · 다음 › · ← → · 밀어서 · 새 창에서 열기 · Esc 는 보기만 닫고 시트는 그대로 — 창 keydown 을 capture 로 먼저 받음) · PDF = '이름 · 크기' + [PDF 미리보기] → PdfViewer(iframe · [새 창에서 열기] 늘 같이 · 안내 '안 보이면 새 창에서') · 그 밖 = 이름 · 크기 · [열기]. 사진이 안 읽히면(onError) 파일 줄로. fileKind = type image/*·.png…(heic 는 파일) / application/pdf·.pdf
- 자료 목록(업무 파일 · 고정업무·반복 실행 자료 · 프로젝트 자료 탭) = files.FileList(같은 보기 · 줄 오른쪽 '크게 보기 ›' / '미리보기 ›' / '열기 ›' · 크기). 예전 task.FileRow 는 files.FileRow 로 옮김(task.jsx 가 다시 내보냄)
- 올리기(files.useUploads · UpList · UpBtn): fb.upload(target, file, onProg) = uploadBytesResumable 진행률 → 파일마다 막대 · 머리 'n/m 올리는 중 · 45%' · 올리는 동안 [+ 파일 올리기]·[+ 파일]·[남기기] 잠금('올리는 중') · 실패한 파일만 빨강 '못 올렸어요' [다시] [빼기](이미 올린 파일은 다시 안 올림) · 자료는 올라간 것부터 A.addFiles/akFiles(이미 올린 정보 {url,path} 를 받으면 기록만 · true/false) · 저장만 실패하면 '저장 못 했어요' [다시] = 저장만. 댓글은 [남기기] 때 파일을 올리고 다 올라가야 댓글 저장(A.addNote 도 이미 올린 정보 받음) · 하나라도 실패면 댓글 안 남기고 '못 올린 파일이 있어서 아직 안 남겼어요' → [다시] 성공하면 바로 남김. 가짜 저장 장치 fb.fake.js upload = 진행 4단계(window.__UP_MS) · __UP_FAIL(이름 정규식) · __UP_FAIL_ONCE
- 댓글 링크: 댓글·답글마다 작은 줄 [답글 | 링크 복사] → ui.appLink(kind, id, 댓글id) = os2.html#t-업무~c-댓글 (프로젝트 #p- · 반복 실행 #r- · 고정업무는 #t-) · 관리자에서 복사해도 팀 앱 주소 · '✓ 복사했어요' · 클립보드가 막히면 그 댓글 아래 링크 칸. 앱(App.jsx · ui.parseAppHash · 로그인 뒤 + 로그인한 채로 hashchange): 업무·고정업무·반복 실행 = 대화 칸(focus talk) · 프로젝트 = 소식 탭(first news, '프로젝트에 한마디') → Thread hl: 그 댓글로 스크롤(가운데) + 네이비 테두리 2초(.v2-note.hl) · 이 대화 목록(useItemNotes = itemId 전체 · .ready)에 없으면 id 로 한 번 읽음(notes id==) · 그래도 없으면 '이 댓글을 찾지 못했어요'. 기밀은 그대로 LockSheet(댓글 안 읽음)
- 예전 체크 기록: 1단계 전 checks 문서({taskId, uid, name, date, at, on} · itemId·ym·kind 없음)도 고정업무 시트 '날짜별 기록'에 — recui.useRecs(legacy) 가 v2 시작~1단계 날짜(LEGACY_REC 2026-10-02~10-06) 중 14일 안의 날만 taskId+date 같음 조건으로 읽어 id 로 합침(그 뒤엔 안 읽음 · 쓰기 없음)
- 내가 쓴 댓글(사용자 요청 2026-10-06 · more.MyNotesSheet · sheets 'myNotes'): 더보기 › 내 일 › '내가 쓴 댓글 · 오늘 n' + 오늘 화면 '오늘' 카드 아래 '오늘 내가 쓴 댓글 n ›'(n>0 일 때만). 칩 [오늘 | 7일 | 30일](기본 오늘 · 수) · 날짜 머리(오늘 · 어제 · 10/3(토)) · 최신 먼저 · 줄 = 어디(업무·고정업무·반복 실행·프로젝트 · 이름) + 글 2줄(@이름 그대로 · 답글은 '답글 · ') + 시각 · 답글 n · 파일 n + 첫 사진 작은 그림 → 누르면 댓글 링크와 같은 길(대화 칸·소식 탭 + 그 댓글 테두리). 읽기만 · 이미 불러온 D.notes(최근 30일) 에서 by == 나(more.myNotesOf · noteWhere) · 기밀은 보이는 규칙 그대로(허용 안 된 업무 댓글은 D 에서 빠져 있음)
- 내 할 일 모두 날짜 칩(사용자 요청 2026-10-06 · today.MineSheet · MINE_DATES · mineDateHit · mineDateHead): 상태 칩 줄 아래 [전체 · 지난 일 · 오늘 · 내일 · 이번 주(월~일) · 다음 주 · 날짜 없음 · 날짜 고르기 ▾](수 = 지금 상태·찾기 기준) — 날짜 고르기 = 시작 날짜 하나(하루) 또는 시작~끝 · 상태 칩·찾기와 같이 걸림 · 기한(dueOf) 기준(이 목록은 일회성 업무만) · 전체면 날짜 머리(지난 일 빨강 · 오늘 · 내일 · 10/9(금) … · 날짜 없음)로 묶음(끝남은 끝낸 순 그대로) · 칩 줄은 .v2-filterrow(자기 칸에서만 옆으로) · 마지막 고른 것 기기 저장 pour-os2-mine-date-<나>
- 한글 파일 이름: 시험 브라우저(헤드리스 Chromium)는 LANG 이 UTF-8 이 아니면 한글 이름을 'download'로 바꿈 → 시험은 launch env LANG=C.UTF-8 (실제 브라우저는 a.download 그대로)

## 7일 시범 전 정밀 검토 (2026-10-06 · 실데이터 읽기 전용 복사본 + 코드 검토 4갈래)
- 실데이터 복사본(사람 12명 모두): 화면 오류 0 · 375 넘침 0 · 열기만 해서 쓰는 것 0 (신제품 반영은 이미 맞춰진 상태)
- 신제품 자동 반영 안전: 기기 저장(fromCache) 목록으로는 반영 안 함 · 반영 직전 그 제품을 서버에서 다시 읽음(fb.readLaunchProduct — 낡은 목록으로 남의 변경을 되돌리지 않게) · 자동 쓰기는 연결이 끊기면 확인 없이 쓰지 않음(patchIf/patchManyIf opt.noFallback) · 구조 문서가 없으면 '지운 단계' 중단 안 함
- 로딩: 로그인 전엔 사람 목록만 구독(useData on/full) · 로그인 뒤 업무·프로젝트 첫 목록까지 받은 다음 화면(D.loaded · '내 일 불러오는 중…') — 자동 반영·진척 계산도 loaded 뒤 · 기록(log) 구독 7일 · 기밀이 하나도 없으면 redact 바로 통과
- 확인할 것 정리: CRM 같은 종류 4줄 이상이면 한 줄('재고 위험 54건') · 재고 위험은 빨강 아님 + 읽음으로 오늘 하루 숨김 · 결과 KPI 월말 알림은 2026-10 부터(kpi2.LAG_START) · 'PIN 처음 정함' 여러 명이면 한 줄 · '앞 일 늦음'은 내 기한 −3~+7일 · 둘 다 자동 기한이면 뺌
- PIN 시작 코드 한꺼번에(관리자 설정 맨 위 · admin/Settings.BulkCodes): PIN 없는 사용 중인 사람 모두 4자리 → 해시만 pinInvite(patchIf 아직 PIN 없을 때만) · 코드는 화면에 한 번 + 목록 복사
- KPI: 관리자 KPI 탭 월말 입력 버튼 = 알림과 같은 달 · % 서브KPI(직접 안 넣음 + 연결 프로젝트) = '프로젝트 진척 평균'(kpi2.pctAuto · 직접 입력 칸 아님) · 고치기는 바꾼 칸만 보냄 · 연도 4자리 · 결과 KPI 값 쉼표 허용 · 그로홈 채널 이름 공백 정리 · 그로홈 매출 읽기는 저장된 합계를 받은 뒤(D.salesReady) · 80쪽 넘으면 저장 안 함 · 0건이면 저장 안 함
- CRM 다리(pour-crm #435): 발주·채팅 구독 오류 때 그 종류 줄을 닫지 않음 · 계산이 그대로면 안 읽고 안 씀 · 열린 줄만 읽음 · 도는 중 바뀐 건 다시 · 재고 위험은 방금 계산한 때만
- 남은 것(시범 중 보기): 읽기 비용(앱을 30분 넘게 닫았다 열 때 약 2,000건 — Storage 가 *.firebasestorage.app 라 Blaze 요금제 → 무료 한도를 넘어도 막히지 않고 12명 기준 하루 100원 안팎) · 문자 보내기 실패 시 다시 보내지 않음(lastError 만) · 버전1에서 다시 가져오기는 시범 중 쓰지 말 것(그사이 고친 것을 덮을 수 있음)

## 기밀 업무·프로젝트 (사용자 결정 2026-10-05 · 화면 숨김 먼저, 진짜 잠금은 로그인 방식 바꿀 때)
- 칸 secret = {on, allow:[id], by, byName, at} (업무·프로젝트). 규칙 secret.js · 화면 secretui.jsx · 시험 secret.test.mjs · os2/t29 · lb/t2
- 마스터(isMaster — 기본 김송희·이란·김소연·허지은)는 다 봄. 팀원은 허용된 사람만: 프로젝트 = 책임자·함께 하는 사람·만든 사람·정한 사람·그 안 업무 담당 + 고른 사람 / 업무 = 담당·참조·맡긴 사람·만든 사람·정한 사람·프로젝트 책임자 + 고른 사람. 프로젝트가 기밀이면 그 안 업무도. 반복(고정) 업무는 대상 아님
- core.useBoot 가 화면용 D = secret.redact(원래 D, 나) 를 돌려줌(rawD 는 원래): 허용 안 된 것은 대체본(제목 '기밀 업무'/'기밀 프로젝트', 메모·자료·사유·피드백 비움 · 담당·기한·상태·순서 칸은 그대로 → 바쁜 건 보임), 그 업무·프로젝트의 댓글·기록은 뺌. ui.Row 가 그 제목이면 자물쇠. 열면 LockSheet('허용된 사람만 볼 수 있어요' + 담당·기한). 서버에서 따로 읽는 것(지난 업무 useTask · 프로젝트 끝낸 업무·이전 소식)도 viewTasks·viewLogs 로
- 대체본은 저장에 쓰지 않음: 신제품 대시보드 반영(useLaunchSync)·진척 계산은 원래 D. 기밀 프로젝트·업무는 신제품 대시보드에 안 씀(pushLaunchBoard) · launch-board.html 은 업무OS 기밀 업무·프로젝트의 개수·바로가기를 안 보임
- 숨김 보강(정밀 검토 2026-10-05): 상위 업무가 기밀이면 하위 업무(안·할 일 줄)도 · 대체본은 남길 칸만 골라 담음(lockTask/lockProj 허용 목록 → 요청·막힘 글·안 정보·결정·사유 모두 빠짐) · 요청을 받은 사람(확인 reviewTo · 도움·기한·막힘 .to)은 자동 허용 · 업무 화면은 기밀인지 알기 전엔 '불러오는 중'(TaskGate) · 잠긴 업무 댓글은 읽지 않음 · 어느 업무인지 못 찾는 댓글(30일 넘은 업무)·기밀 하위 업무 댓글은 문자에 내용 안 넣음
- 정하기: 업무·프로젝트 화면 SecretBox [기밀로 설정 · 볼 사람 바꾸기 · 기밀 풀기] — 관리자 · 프로젝트 책임자 · (프로젝트 없는 업무) 맡긴/만든 사람. A.setSecret · 기록 남음
- 한계: 화면에서만 숨김 — 브라우저 개발자도구로 데이터를 직접 보는 것은 못 막음(보안규칙 변경은 따로 협의)

## 로그인
- 사람 고르기 → PIN 4자리(처음이면 정하기). 해시는 v1 과 같은 계산(`pour-os-pin:<id>:<pin>`) → 마스터의 기존 PIN 그대로.
- 5번 틀리면 5분 잠금. 마스터가 사람 보기에서 PIN 초기화.

## 파일
- 공용: `report.js`·`reportui.jsx`·`reportview.jsx`(월말 보고서) · `growth.js`·`growthui.jsx`(그로스보드 v2) · `core.jsx`(로그인·구독·useActs 쓰기·다시 가져오기) · `model.js`(계산) · `launch.js`(신제품·순서표·공휴일 기한) · `turn.js`(앞 일 → 내 차례, 저장 안 함) · `views.js`(달력 칸·사람×주·출시 줄·정리 묶음) · `flow.js`(흐름으로 만들기) · `cal.jsx`(월 달력) · `pick.jsx`(고르기 목록·한꺼번에 바꾸기) · `sheets.jsx`(시트 길잡이) · `task.jsx` · `project.jsx` · `mindmap.jsx`(마인드맵 [계층 | 마인드맵]·결정 업무) · `mmlayout.js`(마인드맵 자리 계산) · `svgpng.js`(SVG → PNG 저장 · 글자 폭 · 협업 맵과 공용) · `files.jsx`(파일 미리 보기·올리기 진행) · `ui.jsx`
- 실사용: `App.jsx` · `today.jsx` · `schedule.jsx`(달력 탭) · `more.jsx`
- 관리자: `admin/*` (AdminApp · Glance · People · Collab · PersonAdmin · Projects · Tidy · Settings · common · admin.css) · 협업 맵 계산 `collab.js`
- 시트 머리(시안 A · ui.Sheet kind/path/onPath/head): 네이비 띠 + 오른쪽 흰 종류 칩(업무 · 고정업무 · 프로젝트/신제품 프로젝트 · 사람 · 일 넘기기) + 어디 속한 건지(업무 = '프로젝트 · 이름 ›' 누르면 그 프로젝트) + 큰 제목(2줄까지). 제목은 머리에만(본문엔 위험·중요도 칩만)
- 사용 빈도별 노출(사용자 결정 2026-10-05 · 자주 쓰는 것만 늘 보이고 드문 것은 접기): 업무 동작 줄 = 시작했어요 · 막혔어요 · (보류 중일 때만) 보류 풀기 · 담당 바꾸기 · 요청 · 기한 + [더 하기 ▾] → 보류 · 참조 · 결정 업무로 쓰기 · 기밀로 설정 · 업무 링크 복사(.v2-more). 프로젝트 = [정보 · 더 하기 ▾] 안에 대시보드 만들기 · 기밀로 설정 · 끝내기·멈추기(정보 칸 책임자·시작·마감·브랜드·카테고리·팀·중요도는 책임자·마스터만 바꿈, 다른 사람은 보기만). 끝낸·확인 대기 업무도 [더 하기 ▾](기밀·링크 복사 · 보류는 진행 중일 때만). 켜져 있는 상태(기밀 · 참조)만 한 줄 표시(SecretBox only='status' · '참조 이름 · 바꾸기 ›'). 새 기능 버튼도 이 규칙으로 — 자주 누를 것만 밖에
- 고도화(사용자 결정 2026-10-05 '1~7 다 좋고'): ① 추가 버튼 = 오른쪽 아래 작은 알약(.v2-fab · 목록·[+1] 안 가림) ② 프로젝트 탭 팀·카테고리 칩 한 줄 옆으로 밀기(.v2-filterrow) · 관리자 반복 실행 브랜드·사람도 ③ 카테고리 대시보드(일반) 폰(700px 아래)은 카드(이름·지금·진척 막대·마감) ④ 업무 화면 대화를 순서·메모 위로 ⑤ '요청' 창은 [확인 받기 · 도와주세요] 둘만 — 기한은 업무 화면 [기한 바꾸기]/[기한 조정 요청] 하나로 ⑥ 사람 위험 = 진짜 내 일(임시 담당 신제품 항목 빼고) 지남 5개+ 또는 기한 지킴 60% 미만(5건 넘게 셀 때만) · '지금 상황 없음 n' 머리에 한 번 ⑦ 업무 시작일은 있을 때만 '기간' 줄 · 고치기는 [더 하기 ▾]. 그 밖: 관리자 한눈에 '끝났거나 멈춘 프로젝트'는 한 줄로 접음 · 관리자 머리 폰에서 '관리 ·' 뺌 · 진한 달력 칸의 출시·마감 칩 흰 바탕 · 문자 번호 없으면 설정 흐리게
- 버튼(ui.TBtn v): 글자만 버튼 없음 — line(흰 바탕 + 테두리, 기본) · soft(연한 네이비, 업무 동작 줄) · solid(진한 네이비, 그 줄에서 가장 자주 누르는 1개 · 시작했어요) · plain(문장 안 링크만)
- 디자인: 네이비 #24386B/#0F1F5C, 배경 #F4F5F8, 빨강은 지남·막힘(관리자는 한도 넘음 포함)에만. 이모지·아이콘 버튼·그라디언트 없음. 기호는 ✓ ✕ ▾ ▴ → ‹ › 만.

## 실사용 앱 (3단계)
- 오늘: 지금 할 일 카드 1장('이제 내 차례 · ○○님이 "…"을 끝냈어요' + 앞 일 마지막 말) → 확인할 것 → 오늘(고정업무 접기 · 일회성 3줄) → 곧 내 차례 → 내 정리 한 줄. 배지 = 확인할 것 + 이제 내 차례
- 다가오는 내 차례(turn.upcomingTurns · upLine): 다른 사람의 앞 일을 기다리는 내 일마다 한 줄 = 내 일 · 프로젝트(출시/마감 D-n) · '앞: 누가 "무엇" 상태 · 끝 예정 → 내 기한'. 태그 = 여유 n일(앞 일 끝 예정 다음 날~내 기한 평일 수) · 여유 1일/당일 이어받기(빠듯) · 늦을 수 있음(앞 일 예정 > 내 기한) · 출시/마감보다 늦음 · 앞 일 n일 지남·막힘·보류(빨강, '묻기' → 앞 일 대화) · 날짜 없음. 앞 일이 모두 내 일이면 뺌. 달력 칸 칩 '→ 내 일 제목 +n'(위험이면 빨강) · 고른 날 줄 · 7일 '곧 내 차례' 수(7일 안, 위험이면 빨강) → '다가오는 내 차례' 목록(7일 안 · 그 뒤 · 날짜 없음) · 오늘 화면 '곧 내 차례'도 같은 줄
- 달력 칸은 일요일 시작(일 맨 왼쪽 · 토 맨 오른쪽, model.monthGrid) · 빨간 날(일요일·공휴일·회사 쉬는 날 이름 있는 날) 날짜 빨강, 토요일 파랑(머리·날짜·7일 보기) — 사람 표·주별 표의 "주"(월~일 집계)는 그대로. 공휴일 표 model.KR_HOLIDAYS = 2026~2028(노동절·제헌절·선거일·대체공휴일 포함)
- 폰 뒤로(ui.useBackClose): 시트를 열 때 브라우저 기록을 쌓고 뒤로 = 맨 위 시트만 닫기, 앱 안에서 닫으면 쌓은 기록도 걷음 (두 앱 같음)
- 프로젝트 % = model.projPct(저장된 progress) 하나 (신제품은 launchPct). 업무 끝냄·다시 열기·프로젝트 열 때 + 마스터가 앱을 열면 하루 한 번 core.syncProgress(열린 일반 프로젝트 전체 업무로 다시 계산, 다른 것만 저장). 열린 업무 0 = projHealth.allDone → 관리자 목록 '업무 다 끝남 · 완료하기 ›'
- 프로젝트 끝내기·멈추기(hold.jsx · core endProject/resumeProject, 책임자·마스터): 완료(completed · 열린 업무 0일 때) · 중단(dropped + dropReason · 열린 업무 → status 'dropped' + dropPrev, 지우지 않음 · projOpen 아님) · 보류(hold + holdReason · holdUntil · 열린 업무 → hold + holdBy 'proj' + holdPrev). 다시 시작/다시 열기 = 접은 업무 이전 상태로(중단 전 보류였던 일은 보류로) + 기한 n일 미루기(평일 맞춤 · 신제품은 출시일 바꾸기로). endLog 에 기록, 5초 되돌리기(끝내기). 다시 할 날이 되면 책임자 '확인할 것'(projHoldDue)
- 업무 보류 = 이유 칩(꼭) + 다시 볼 날(선택) 창(HoldAsk · HoldBtn · 정리 막대 여러 건). holdPrev 기억 → 보류 풀기 = 이전 상태. 다시 볼 날이 되면 담당 '확인할 것'(holdDue, [다시 시작]). riskOf 는 보류를 '지남' 빨강보다 먼저 '보류 · m/d 다시'로. 관리자 정리 '보류' 묶음(프로젝트째 보류는 빼고)
- 중요도 = 프로젝트 priority(high/mid/low, 버전1 값 그대로, 없으면 보통) · 정보에서 책임자·마스터가 칩으로. 제목 옆 '중요 높음/낮음'. 예상 끝나는 날 model.projForecast = 남은 업무 ÷ 최근 2주(평일 10일) 끝낸 수. 관리자 한눈에 '판단 필요'(admin/Judge.jsx · model.judgeOf): 당겨야 할 것(높음 · 마감 지남/예상 늦음/속도 0인데 마감 2주 안) · 미뤄도 되는 것(낮음 업무가 이번 주 주 한도 넘은 사람에게 → [1주 미루기] 미리 보기 → applyDues 5초 되돌리기) · 끝났거나 멈춘 프로젝트 [모두|완료|중단|보류]. 오늘 '지금 할 일'·관리자 목록 정렬에 같은 순위면 중요 높음 먼저
- 요청 하나로(asks.jsx · core ask/closeAsk): 업무 [요청] → [확인 받기(내 일 → 확인 대기 reviewTo) · 도와주세요(t.ask, 한마디 꼭) · 기한 바꾸기(dueReq.to)] + 받을 사람(기본 model.askTo = 맡긴 사람 → 넘겨준 사람 → 프로젝트 책임자 → 마스터, 나·미사용 빼고). 받는 사람 '확인할 것'(help · review · dueReq)에. '막혔어요'도 blocked.to = askTo → 아무에게도 안 가는 요청 없음. 도움 요청 띠: 받는 사람 [대화로 답하기 · 해결됐어요] · 보낸 사람 [요청 거두기] (askDone 기록)
- 담당 넘기기: 이름 고르기 → '○○님에게 넘기기' 확인 줄 + 한마디(선택, 업무 대화에도) → t.handoff {from,to,note,by,at} · 받는 사람은 진행 중·보류여도 '맡김'(받았어요) · 이전 담당·맡긴 사람은 '담당 바뀜'(handed) · 5초 되돌리기
- 한 사람 일 한 번에 넘기기(휴가·퇴사 · 관리자 사람 보기 › '일 넘기기 ›' · admin/HandOver.jsx · model.handOverPlan/handOverOwners · core.handOver): 묶음 [진행 중 · 할 일 · 보류 · 확인 대기(기본 끔) · 고정업무('전체' 빼고) · 책임 프로젝트] + 받는 사람 한 명 + 한마디 → 업무는 그 사람 자리만 받는 사람으로(여러 담당이면 나머지 그대로) · 맡긴 사람 그대로 · handoff{all} + bulkId → 받는 사람 '확인할 것'에 '○○님 업무 n개 넘겨받음' 한 줄([받았어요] · 누르면 내 할 일 모두) · 고정업무 체크 기록 그대로, 넘기는 사람 시간은 받는 사람에게(없을 때) · 프로젝트는 책임자만 · 끝낸 일·중단한 일은 그대로 · 30건 이상 확인 창 · 기록 1건(handover, 이전 값) · 5초 되돌리기
- 오래 멈춘 프로젝트(8단계): 프로젝트 한 장 소식·자료 탭 아래 '30일보다 이전 소식·자료 불러오기 ›' → 누를 때 한 번만 읽음(끝낸 업무 전체 · log projectId · 업무 대화 itemId in 30개씩) · 읽기만 · 실패하면 '못 불러왔어요 · 다시'
- 지금 할 일 카드: 2주(model.OLD_LATE=14일) 넘게 지난 일은 순위 4.5(오늘·곧 마감 다음) — 지난 일 수·'하나씩 정리하기'에는 그대로
- 기한 지킴 %(model.onTimeOf): 담당이 끝낸 시각(finishedAt) 기준 · 확인 대기도 끝낸 것 · 최근 30일 안 기한이 지났는데 안 끝낸 일(보류·중단·임시 담당 빼고)은 못 지킴(miss)으로 셈
- PIN 선점 막기(9단계): 마스터가 사람 보기 › PIN 칸에서 '시작 코드 만들기'(4자리 무작위 · 해시만 users.pinInvite · 화면·알림에 한 번만) → 코드가 있는 사람은 PIN을 처음 정할 때 시작 코드도 넣어야 함(5번 틀리면 5분 잠금). 'PIN 초기화' = PIN 지우고 시작 코드 새로. 코드 없이 PIN을 정하면 마스터 '확인할 것'에 'PIN 처음 정함'(7일 · 본인 아니면 초기화). 다시 가져오기는 pin* 칸을 덮지 않음
- 빠졌던 알림(9단계): '확인 완료'(approvedAt → 담당) · '막힘 풀림'(unblocked → 막힌 사람·받은 사람·담당) · 기한 조정 요청이 걸린 일의 기한을 맡긴 사람이 그냥 바꾸면 요청한 사람에게 '기한 바뀜'(dueReqResult). 확인 완료는 5초 되돌리기(확인 대기로). 정리 '확인 대기 3일 넘음'의 묻기는 확인할 사람(reviewTo → 맡긴 사람)에게(댓글 to). 끝낸 업무를 못 불러오면 '못 불러왔어요'(없어요로 안 보임)
- 용어: 지남 = 기한이 지난 일회성 업무(빨강) · 밀림 = 할 날을 못 한 매주·매월 고정업무 · 시간 지남 = 오늘 고정업무 정한 시간이 지남 · 지난 일 = 지남 업무 묶음 이름
- 참조(CC): 업무 [참조] 칩 → t.ccIds — 담당이 아니어도 그 업무 대화가 '확인할 것'에. 업무·프로젝트 대화에 한 번이라도 말한 사람에게도 답이 감(talked)
- 관리자 머리 '나에게 온 것 n'(today.InboxSheet · inboxFns) = 팀원 '확인할 것'과 같은 계산·줄·버튼, 읽음 표시도 같은 기기 저장
- 업무 화면 [대화 | 기록] 탭: 기록 = 상태 기록(statusLog) + log(targetId). core P 가 prev 를 남기면 next 도 같이 저장 → '이전 → 이후' 칩(담당 · 기한 · 시작 · 상태 · 참조 · 다시 볼 날 · 중요도)
- 기간: 업무 startDate(담당·마스터가 날짜 칸) · 프로젝트 startDate(정보) — 간트 막대 시작에 씀
- 링크: '업무 링크 복사' · ui.appLink/CopyLink → 실사용 앱 주소 os2.html#t-ID (#p-ID 프로젝트 · #r-ID 반복 실행 · 댓글 = '~c-댓글ID' 붙임 → 아래 '댓글 링크'). 관리자에서 복사해도 실사용 앱 주소. 앱은 로그인 뒤 해시를 읽어 그 시트를 열고 해시를 지움(App.jsx). 클립보드가 막히면 링크 칸을 보여 줌. 업무 번호(DL-1 같은)는 기존 업무 1,800여 건에 번호를 새로 써야 해서 넣지 않음
- 오늘 머리 '이번 주 완료율'(model.weekMine · 월~일): 전체 = 이번 주 마감 내 일(보류 빼고) + 이번 주에 끝낸 일 · 완료 · 진행 · 지남. 누르면 내 할 일 모두. 나만 봄
- 간트(gantt.jsx): 팀원 프로젝트 [목록 | 간트] (내 프로젝트/모든 프로젝트 · 카테고리 그대로 · '내 업무만') · 관리자 프로젝트 [간트]. [8주 | 4개월], 막대 = 시작 → 끝(마감·출시, 없으면 업무 마지막 기한) + 진척 진하게, 오늘 세로줄, 보류 회색, 남은 업무가 있는데 끝이 지남 = 빨간 테두리. 30줄씩 더 보기. 가로로만 밀림
- 고정업무 할 날 규칙 하나(model.fxDueOn — 오늘·달력·고정업무 화면·반복 실행·사람 표가 모두 이것): 쉬는 날(주말·공휴일)엔 없음 · 매일 = 평일 · 매주 정한 요일이 쉬는 날이면 앞 평일 · 매월 정한 날이 쉬는 날이면 앞 평일(그 달을 넘어가면 뒤 평일) · 말일(평일) 그대로. fxHit(여러 요일)은 옮겨진 할 날 기준. 밀림(model.fxMissOf): 매주·매월은 이번 주·달에 지나간 할 날을 못 했으면 오늘 '밀림 m/d'(빨강)로 할 때까지 · 이번 주 할 날이 쉬는 날이라 지난주로 당겨진 것(예: 월 대체공휴일 → 지난 금)도 이번 주 몫으로 셈 · 매일은 없음
- 고정업무 담당 바꾸기(마스터, task.FxOwners): 여러 명 칩 또는 '전체'(forAll) · 사람마다 시간·이름·체크 기록은 지우지 않음 · 5초 되돌리기. 관리자 반복 실행 위 '담당 없는 고정업무 n'(담당이 비었거나 모두 미사용) → 눌러서 담당 정하기
- 쉬는 날 층(model.setHolidayLayer): 앱 안 표 KR_HOLIDAYS(2026~2028) + fetched = pourstore-renewal/holidays.json(매달 1일 .github/workflows/holidays.yml → scripts/holidays/sync.mjs 가 공공데이터포털 '한국천문연구원 특일 정보'로 올해·내년을 받아 저장 · 시크릿 DATA_GO_KR_KEY, 바뀐 날이 있으면 ANTHROPIC_API_KEY 로 Claude(claude-opus-5-5, effort low, fallbacks "default")가 한 줄 확인 → last.note) + company = 회사만 쉬는 날(관리자 설정 · settings/holidays 문서). 앱은 열 때 ./holidays.json 을 읽고(못 읽으면 표로 계산) 화면을 그리기 전에 층을 바꿈(core.useBoot). 관리자 설정 '쉬는 날'에 자동 갱신 마지막 날짜·최근 바뀐 것·회사 쉬는 날 넣기/빼기
- 프로젝트 한마디(proj: 댓글)는 책임자·함께 하는 사람 + 그 프로젝트 업무 담당의 '확인할 것'에 (업무 댓글은 그대로)
- 달력: 위에 7일 한눈에(7일 안 마감 · 지난 일 · 7일 안 출시 · 곧 내 차례), [월 | 7일 · 제목까지]. 월 달력(폰도 칸마다 제목 칩 2개 + '+n', 칸 농도 = 그날 마감 수, ▴ 출시·마감, → 내 차례 시작, ✓ 다 끝냄, 공휴일 회색). [나 ▾]로 동료 달력(보기만)·프로젝트(그 프로젝트 모든 사람 항목). 날짜 없는 일은 칸을 눌러 기한 정하기
- 프로젝트: 신제품·일반 한 목록(마감 지남 · 7일 안 · 이번 달 · 그 뒤 · 날짜 없음 · 보류). 줄 = '지금: 누가 · 일' / '다음: 누가 · 일'(turn.js nowNext)
  - + 새 프로젝트: 빈 프로젝트 / 신제품 출시 / 흐름으로 만들기(v1 workflows 12종, 단계마다 업무 1건 + 앞 단계 deps, 단계 기한은 평일로 고르게 · 마지막 단계만 고른 마감, 기본값에서 바꾼 단계 담당만 v2 workflows stages[].ownerId 에 기억 + 기록)
  - 출시일이 지난 신제품은 '출시 후 n일'(projWhen), 늦은 항목·막힘이 있을 때만 빨강
  - 프로젝트 한 장(제목은 늘 '프로젝트'): 지금 → 다음 줄, 신제품 7단계 띠(누르면 그 단계 펼침), 담당 (임시)=책임자로 채움 · (기본)=자주 맡던 사람
- 프로젝트 한 장 [업무 | 마인드맵 | 소식 | 자료] — 마인드맵(mindmap.jsx): 가지 = 업무, 작은 가지 = 하위 업무(따로 저장 없음). 큰 가지 번호 = 앞 일 순서(deps·흐름 단계·기한), 신제품은 7단계가 큰 가지. 모양: 끝남 채움 · 하는 중 굵은 테두리 · 앞 일 기다림 점선 · 보류 회색 · 지남 빨강. 계층 보기는 마인드맵 칸이 900px 넘을 때만 가로형(프로젝트 한 장 패널은 세로형). 끌어서 순서 바꾸기 없음 · 아래 '오른쪽으로 뻗는 마인드맵 보기'
- 프로젝트 한 장 머리: '지금 상황'은 비어 있으면 제목 오른쪽 위 '+ 지금 상황' 버튼만, 적으면 진행 막대 아래 칸(고치기). 정보: 책임자 · 마감 · 브랜드(업무는 프로젝트 브랜드를 따름) · 카테고리(p.category, 미분류면 이름으로 짐작한 추천 버튼)
- 소식 탭: [전체 | 대화 | 바뀐 것], 날짜별(오늘·어제·날짜) 묶음, 댓글 기록(log comment)은 댓글로 한 번만, 줄마다 쉬운 태그(완료·업무 추가·내용 수정·담당 변경…) + 문장('김송희님이 완료했어요') · 어느 업무 · 시각, 누르면 그 업무(댓글이면 대화 칸). 아래 '프로젝트에 한마디'
- 프로젝트 카테고리(버전1 WF_CATS 와 같은 키): 신제품 출시 · 프로모션·마케팅 · 공지사항 · 시스템 구축 · 영업·B2B · 상시 운영 · 미분류. model.js projCat = p.category → lb_ 이면 신제품 → 흐름 종류(wfCat). 목록 위 카테고리 칩(수), 내 프로젝트에 없으면 '다른 사람 프로젝트에 n개 더' 안내. 새 프로젝트: 빈 프로젝트는 카테고리 칩(안 고르면 이름으로 짐작), 흐름은 흐름 종류, 신제품은 launch. (KPI별 보기는 없앰 · mainKPIs·subKPIs 는 반복 실행 묶음용으로 읽기만 구독)
- 결정 업무(task.decision): 방법이 안 정해진 일 → 하위 업무를 '안'(option, optInfo = 단가·MOQ·납기 한 줄)으로 비교 → [이 안으로 정하기](이유 선택) → task.decided {optionId,title,reason,by,at} 기록, 안 고른 안은 보류(optDropped, 지우지 않음), 결정 업무는 끝냄 → 다음 단계 담당에게 '이제 내 차례'. 5초 되돌리기
- 업무 보기: 순서 칸(앞 일 · 남긴 말 · 자료 n ›, 다음 일, [+ 다음 일 맡기기] [앞 일 바꾸기]), 앞 일 늦음 띠, 끝낼 때 '다음 사람에게 한마디'(notes.handoff)
- 고정업무 보기: 담당·마스터는 '반복 · 시간 바꾸기'(매일 / 매주 요일 여러 개 / 매월 1~31일 · 말일(평일 기준) + 기본 시간). 말일(평일) = monthEnd:true(monthDay 31 유지) → 그 달 마지막 평일(주말·공휴일이면 앞 평일, model.monthEndWorkday). 사람마다 정한 시간(timeBy)은 그대로. 기록에 이전 값
- 더보기: 내가 맡긴 일 · 내 할 일 모두 · 내 고정업무 · 시작 화면(오늘/달력) · (마스터) 관리자 화면 ›

## 차례 계산 (turn.js, 저장 안 함)
- 앞 일 = ① deps(v1 과 같은 칸, [] 는 '앞 일 없음') ② 신제품 순서표 LAUNCH_AFTER — 건너뛴 항목(project.skipItems)·선택 항목만 거슬러 올라가고, 그 밖에 안 불러온 항목(30일 넘게 전에 끝남)은 끝난 것으로 ③ 담당 다른 하위 업무. 끝난 앞 일 = done 또는 review
- 화면에 보일 앞 일 = turnOf().show (늦은 것 → 끝 예정이 가장 늦은 것). 앞 일이 수정 요청 뒤 다시 끝나면: 할 일이면 다시 '이제 내 차례'(seenKey 에 끝난 시각), 하는 중이면 확인할 것 '앞 일 다시 끝남'
- '이제 내 차례' = 앞 일이 다 끝났고, 마지막 앞 일 담당이 나와 다르고, 끝난 때가 처음 복사(meta.seededAt) 뒤 · 14일 안 · 안 본 것. 같은 사람이 잇는 단계는 알림 없음
- 임시 담당(책임자로 채운 신제품 항목)은 실사용 화면에 안 띄우고 책임자 '내 정리'·관리자 '정리'로만

## 관리자 화면 (admin/)
- 한눈에: 위험 칸(막힘 · 지남 · 순서 꼬임 · 요청) → 정리 묶음, 임시 담당 한 줄, 한도 넘는 사람 한 줄, 팀 달력(한 사람 하루 8건 넘으면 빨강) + 고른 날 사람별 묶음 → 고르기 → 한꺼번에 바꾸기, 사람×4주
- 업무는 2가지로 본다(관리자): **반복 업무** = 고정업무(v2 isFixed) + 행동지표(버전1 actionKPIs, 읽기만) · **프로젝트 업무** = 기한 있는 한 번짜리 일. 계산은 admin/workload.js(weekLoad · fxWeek · 시험 workload.test.mjs)
- 사람: [한 주 | 4주 | 14일]. 한 주(기본) = 사람 × [반복 업무 | 프로젝트 업무], 주(월~일) ‹ › 넘기기. 칸 = 한 것/해야 할 것 · 초록 막대 · 못 함(지난 날에 안 한 것) · 남음(오늘부터) · 아래 회색 = 가장 많이 못 한 것 2개, 더 못 한 쪽 테두리 빨강. 위 한 줄 = 못 한 게 많은 사람 3 + 반복만/프로젝트만 하는 사람. 반복 칸 → RepSheet(고정업무 요일 칸 ✓/못 함/남음 · 행동지표 이 주 목표·실적), 프로젝트 칸 → 그 주 업무 목록(고르기·담당 바꾸기). 고정업무 할 날: 매일=평일, 매주=정한 요일(요일 하나면 그 주 아무 날 체크 인정), 매월=그 달 안 체크 · 체크 = v2 checks(on) + 버전1에서 온 마지막 체크 날(doneDates). 행동지표 이 주 목표 = 주간 goal · 월간 ÷4 · 분기 ÷13(올림), %·실패 기준 항목 제외, 실적 = 버전1 kpi-act by[사람]. 4주 = 사람 × 4주(월~일) [모두 | 프로젝트 업무 | 반복 업무] · 칸 큰 숫자 = 아직 안 한 것 · 초록 완료 · 이름 아래 이번 주 할 양(프로젝트·반복) · 빨간 숫자(주 한도)는 [프로젝트 업무]에서만. 4주/14일 표(주 한도 weekCap 넘으면 빨강, 칸 → 그 주 일 고르기), 사람 관리자판(기한 지킴 %, 기다리는 뒤 일, 주 한도, PIN 초기화)
- 반복 실행(admin/Routine.jsx, 버전1 반복 실행 모양): [전체 | 오늘 체크 | 횟수 | 개인](2단계 · 위 '반복 실행 · 고정업무 정리') · 브랜드 칩(+ 공통 운영) · 사람 칩. 오늘 체크 = v2 업무 isFixed 중 브랜드 정한 것(scope brand), 매일(오늘)·매주(이번 주)·매월(이번 달) n/m 달성 카드 + 줄마다 사람 ✓, 줄은 정한 시간 순서(고른 사람 시간 → 사람 중 가장 이른 시간, 시간 없음은 아래 · 줄에 hh:mm). 행동지표 = 버전1 `pour-os/state-actionKPIs` 와 `pour-os/kpi-act-YYYY-Qn` 을 읽기만(fb.listenV1Doc) + 업무OS 오늘 [+1] 실적(pour-os/v2/kpiact) 합, 계산은 `pour-os/src/actionKpi.js` 그대로 import · 필수/추가 · 주간/월간·분기 · 달 넘기기 · 주간/월간/분기 달성 카드 · 주요 KPI → AARRR → 주기 묶음. 기록은 업무OS 오늘 '이번 주 할 횟수' [+1](버전1에서 한 것도 합쳐 보임)
- 프로젝트: [주별 표 | 단계 | 8주 축] (기본 주별 표). 주별 표 = 카테고리 × 주(월~일, 지난 주부터 4주, ‹ ›) · 칸 큰 숫자 = 그 주 마감 아직 안 끝난 업무(지난 주 빨강 = 못 끝냄) · 초록 완료 = 그 주 끝낸 업무 · 지남 칸 · 카테고리 누르면 그 안 프로젝트 줄(지남 많은 순, 8개 + 더 보기) · 칸 → 업무 목록(PickSheet pids, 여러 사람, 고르기·담당 바꾸기) · 위 한 줄 = 밀리는 카테고리. 단계 보기 = 모든 프로젝트 한 모양 — 카테고리 칩 → 날짜(출시일·마감)별 묶음(날짜 없음·보류는 맨 아래) → 줄마다 위험 등급 · 이름 · 단계 띠 · %(지남 n) + '지금 업무(담당) → 다음'. 띠 칸: 신제품 = 7단계(묶음 머리에 단계 이름, 숫자 = 남은 항목), 그 밖 = 업무 하나 = 한 칸(앞 일 순서, 8개 넘으면 ✓n 묶음 + +n), % = 불러온 위 층 업무 끝낸 비율. [단계 | 8주 축] (8주 축도 모든 프로젝트). 미분류 칩에서 줄마다 카테고리 고르기·추천, 프로젝트 한 장 덧붙임(출시일 옮기기 미리 보기 · 기한 고르게 다시 나누기 · 항목 골라서 한꺼번에)
- 정리: 임시 담당 · 기한 없음 · 30일 넘게 지남 · 담당 없음 · 기한 조정 요청 · 막힘 · 순서 꼬임 · 다음 차례 담당 없음 · 확인 대기. 한꺼번에 바꾸기는 한 번 100건, 30건 이상 확인 창, 5초 되돌리기, 기록에 이전 값. 삭제 없음
- 설정: 버전1에서 다시 가져오기(미리 보기 숫자 → 확인 → 쓰기 직전에 다시 비교 → merge). v2 에서 고친 문서(v2At·메모·파일·받음)는 건너뛰고, 이미 있는 문서의 v2 전용 칸(PIN·주 한도·고정업무 체크)은 덮지 않음. 주 한도, 신제품 순서표·공휴일 보기
- 출시일 정하기·옮기기·기한 다시 나누기: 옮겨질 항목 수를 먼저 보여 주고 30개 이상이면 확인 창, 지난 날짜 안 됨, 5초 되돌리기, 기록에 항목별 이전 기한. 보류·확인 대기 항목은 안 옮김

## 오른쪽으로 뻗는 마인드맵 보기 (사용자 확정 2026-10-05~06 · 시안 mockups/step11-mindmap-right.png · 시험 mmlayout.test.mjs · os2/t42)
- 프로젝트 한 장 [마인드맵] 탭 위 [계층 | 마인드맵](mindmap.MindMap → TreeMap 예전 그대로 / RightMap) · 처음엔 폰(700px 아래) 계층 · PC 마인드맵(mmlayout.defaultView) · 고른 것 기기 기억 pour-os2-mmview
- 그림(SVG): 왼쪽 프로젝트 → 큰 가지(앞 일 순서 번호 · 신제품 = 7단계 '기획 0/4') → 작은 가지(하위 업무 · 그 아래도) · 곡선 연결(지남 가지로 가는 선은 연한 빨강) · 모양은 계층과 같음(끝남 채움 · 하는 중 굵은 테두리 · 앞 일 기다림 점선 · 보류 회색 · 지남 빨강 테두리) · 둘째 줄 = 담당 · 기한(지남 n일) · 끝난 것 '✓ m/d' · 결정 대기/정함
- 누르기: 업무 가지 = 업무 시트 · 신제품 단계 = 접기/펼치기 · 가지 오른쪽 작은 칸 '‹'(접기) / '+n'(펼치기) · 가지 9개 이상 = 8개 + '+n개 더 ▾'(누르면 그 가지 다) · 기본 접힘 = 다 끝난 신제품 단계만
- 아래 [화면에 맞추기 / 원래 크기](칸 안에 한눈에 · 줄임만) · [모두 펼치기] · [끝낸 것 접기] · [그림으로 저장]
- 칸 안에서만 밀림(.mm-rbox overflow auto · 높이 화면 70%·최대 760 · 페이지는 안 밀림) · PC 마우스는 끌어서 밀기(끌었으면 누름으로 안 침) · 프로젝트는 가지가 길어도 처음 화면 안(layoutTree rootMax)
- 그림으로 저장 = svgpng.savePng(협업 맵과 같은 함수 — admin/Collab 에서 옮김 · SVG → canvas → PNG 2배 · 위에 '마인드맵 · 프로젝트 · 날짜 기준') · 파일 이름 마인드맵_<프로젝트>_<날짜>.png(fileSafe) · 지금 보이는 대로(접은 것 그대로)
- 쓰기 없음(보기·접기·저장) · 일반 프로젝트는 그림 아래 '큰 가지 넣기' 칸(계층 보기의 가지 추가와 같은 A.addTask)
- 자리 계산 mmlayout.js(visibleTree · layoutTree · curve · MM 크기) — 저장 없음

## 협업 맵 (관리자 탭 · 사용자 확정 2026-10-05~06 · 시안 mockups/step12-collab-map.png · 시험 collab.test.mjs · admin t24)
- 탭 '협업 맵'(admin/Collab.jsx, 사람 다음) · 계산 collab.js(collabOf · partnersOf · loners · circleLayout) — **저장 없음 · 쓰기 0**, 이미 불러온 D(업무·댓글·프로젝트·사람)만 읽음
- 두 사람 사이 6가지: 같이 맡음(담당 여럿 · 고정업무는 '전체'·멈춤 빼고) · 맡김(requestedBy·assignedBy → 담당) · 이어받음(turn.js 앞 일이 기간 안에 끝나 다음 담당에게 + t.handoff) · 확인·도움 요청(reviewTo · ask · dueReq · blocked, 요청마다 1) · 같은 업무 대화(업무마다 짝마다 1 · @ 부름 포함) · 같은 프로젝트(열린 프로젝트마다 1 · 무게 1/3). 화면 숫자 n = 무게 합(반올림), 종류별 칸은 센 수 그대로
- 기간 [7 | 30(기본) | 90일] · 종류 칩(모두 · 6가지). 업무는 기간 안에 살아 있던 것(열림 · 그 기간에 끝냄). 앱은 끝낸 업무·댓글을 30일만 불러오므로 90일이면 '최근 30일 끝낸 업무까지만 셈' 안내(더 읽지 않음)
- 빼는 것: 사용 안 하는 사람 · 나와 나 · 임시 담당(idx.temp) · 지운·중단 업무 · 기밀은 secret.js 기준(관리자는 다 봄 · 목록엔 '기밀' 표시 · 그림 속 제목은 '기밀 업무')
- [팀 전체] 원 둘레 팀 순서(1팀 · 2팀 · 3팀 · 공용 · 팀 사이 빈 칸 · 늘 같은 자리) · 동그라미 크기 = 협업 수 · 선 굵기 = 짝 수 · 팀 = 연한 네이비 칸 · 누르면 그 사람 + 오른쪽 '많이 협업하는 짝'(10 + 더 보기) + 한 줄(많이 하는 짝 3 · 혼자 일이 많은 사람 = 열린 일 5개+ 인데 협업이 중간값 아래). 폰(700px 아래)은 그림 대신 짝 순위
- [한 사람] 사람 칩 또는 동그라미 → 오른쪽으로 뻗는 마인드맵(그 사람 → 협업한 사람 8명(많은 순) → 종류 3개 + 최근 일 제목) · 칸 안에서만 옆으로 밀림 · [화면에 맞추기] · 사람을 누르면 같이 한 일 목록(종류 · 누가 → 누구 · 날짜, 누르면 업무/프로젝트 시트 · 대화는 대화 칸) · '○○ 맵 ›'
- [그림으로 저장] = 지금 그림 SVG → canvas → PNG(svgpng.savePng · 2배 · 위에 '협업 맵 · 누구 · 최근 n일 · 날짜 기준' 한 줄 · 외부 라이브러리·전송 없음) · 파일 이름 한글 협업맵_<이름|팀>_<n>일_<날짜>.png (Blob + a.download · 파일 이름에 못 쓰는 글자만 뺌)
- 폰 하단 탭 7개 → 420px 아래 탭 글자 12px

## 2단계 — 기한 안에 끝내는 흐름 (Asana·Linear·Basecamp 방식 참고, ADHD 친화)
- 흐름: 맡김(requestedBy) → 받았어요(ackAt) → 진행 → 끝냈어요 → (맡긴 사람이 있으면) 확인 요청 status:"review" → 확인 완료(done) / 수정 요청(feedback, 다시 진행)
  - 끝낸 시각(finishedAt)은 담당이 누른 때 → '기한 지킴 %'는 확인이 늦어도 담당 기준
  - 내 일·하위 업무·신제품 항목은 noReview(바로 끝)
- 기한: 다른 사람에게 맡길 땐 기한 필수(미정 없음). 기한 조정 요청은 지금 기한과 같은 날을 못 고름(칩에서 빠지고 직접 고르면 안내). 담당은 맡긴 사람이 정한 기한을 바로 못 바꾸고 '기한 조정 요청'(dueReq) → 맡긴 사람이 수락/그대로(dueReqResult)
  - 허락할 사람 = 맡긴 사람 → (신제품 항목이면) 제품 책임자. 예전 업무(맡긴 사람 기록 없음)는 담당이 바로 바꿈
- 막혔어요(blocked) → 맡긴 사람·책임자 '확인할 것'에 + 댓글로도 남김. 담당 바꿔도 처음 맡긴 사람은 유지
- 오늘: '지금 할 일' 카드 1장(수정 요청 → 지난 일 → 진행 중 → 오늘 마감 → 곧 마감 순), 지난 일은 카드에서 바로 끝냄·새 기한·보류, '하나씩 정리하기'(한 화면 하나)
  - 진행 중 4개 이상이면 '하나씩 끝내기' 안내(WIP 제한). 첫 걸음(firstStep) 칸
- 맡기기 화면: 고른 사람의 2주 날짜별 마감 수(5건 이상 진하게) · 지난 일 · 기한 지킴 % → 띠에서 날짜를 눌러 기한 지정
- 맡긴 일(더보기 › 내가 맡긴 일) = 확인해 주세요 · 기한 조정 · 막힘 · 지남 · 곧 마감인데 시작 전 · 아직 안 받음 …
- 신제품(launch.js): 제품 = 프로젝트(id lb_…) + 항목마다 업무. 출시일에서 거꾸로 기한(주말→금, 8주 안 되면 남은 기간에 고르게, 지난 날 안 됨)
  - 기본 담당 = 그 항목을 가장 많이 맡은 사람 → wf_launch 기본 → 제품 책임자(ownerAuto)
  - 출시일 바꾸면 자동 기한(dueAuto) 항목만 이동. 담당자에겐 '신제품 · 항목 n개 맡김' 한 줄 → '모두 받았어요'
  - v1 런칭보드는 관리자 화면 › 설정 › '버전1 신제품 보드 다시 가져오기'(마스터, 읽기만)
- 테스트: `node src/model.test.mjs` · `node src/launch.test.mjs` (계산) + 가짜 저장소 화면 시나리오(실데이터 복사본, 실제 DB 쓰기 없음)

## 위험 등급 (관리자)
- personHealth — 위험 = 지난 일 3+ 또는 기한 지킴 60% 미만, 주의 = 지난 일·시작 전 있음 또는 한 주 15건+
- projHealth — 위험 = 지난 항목·막힘 또는 마감 7일 안인데 60% 미만, 주의 = 시작 전·담당 없음 (신제품 %는 launchPct)
- 끝난 업무는 최근 30일 것만 불러와서 지난 달 달력의 '끝낸 일'은 비어 보일 수 있음

## ⑤ 마진 v2 (폰) (사용자 확정 2026-10-05 · 시안 step7 ④⑤ · 완료 2026-10-06)
- 주소 `https://pour-construction-form.pages.dev/pourstore-margin2.html` (루트 한 파일 · React 18 UMD + htm(바벨 없음 — 폰에서 빨리 뜨게) · Firebase compat 10.12.0) · 버전1 `pourstore-pricing-dashboard.html` 은 그대로(안 고침)
- 같은 프로젝트 pourstoreproject · 같은 로그인(이메일) · 위 [업무 › | CRM › | 마진] 스위치 · CRM v2 의 '마진 ›'(관리자만)이 여기로 옴(pour-crm MARGIN_URL)
- 아래 탭 [상품 · 마진 낮음 · 가격 계산 · 재고·유통기한 · 더보기] (일반 계정은 마진 낮음 없음 4개) · 제품 = 아래에서 올라오는 시트(네이비 머리 · 채널별 마진 막대 · 낮으면 빨강) · 폰 뒤로 = 시트만 닫기 · 해시 #p-<제품 hash> · #low · #req
- 권한(버전1 config/access 판정 그대로 · M2C.roleOf): 마스터(masterEmail·masterEmails + 이메일 인증) = 원가·개당 이익(원)·마진 % / 부마스터(subMasterEmails + 인증) = 마진 %만(원가·이익 금액은 '가려짐' — 화면에서만 · 계산엔 씀) / 일반(allowedEmails·teamEmails · 인증 안 한 마스터) = 판매가만 · 팀용 단가표만 읽음(products·원가 문서 안 읽음 · 쓰기 0) · 그 밖 = '볼 수 없어요'. 일반 계정 업체단가 동작은 손대지 않음(버전1 그대로)
- 숫자: 가격 = team-catalog/current(버전1 관리자 화면이 계산해 저장하는 채널별 판매가 · '단가표 m/d 기준') · 원가 = products(이름 변경 prod-rename 반영)·products-added + prod-cost 우선 + prod-ship(택배비) · 마진 = (판매가 × (1 − 채널 수수료 config/calc.chVar) − 원가 − 택배비) ÷ 판매가 · 수수료 0 채널은 버전1 가격정책표 마진과 같음 · 소수 한 자리 · 세트는 마진 안 셈(PC) · 기준 마진 = product-meta/margin-v2 {threshold} (기본 15% · 마스터만 바꿈)
- 마진 낮음 → 업무OS: [업무OS로 보내기](줄마다) · [안 보낸 n건 모두 보내기](30건 넘으면 확인) · 받는 사람 = 관리자(업무OS 마스터) 또는 업무OS 사람 고르기 → pour-os/v2/links/margin-low-<hash> {src margin, kind marginLow, title '제품 · 채널', sub '마진 n% (기준 15%) · 가격 확인', url 마진 v2 #p-, owner·ownerOsId} (원가·금액 없음) · 보낸 줄은 '업무OS에서 열기 ›'. 원가 권한 계정이 마진 v2 를 열 때 열린 마진 줄 정리(M2C.planLinkSync): 기준을 넘으면 open:false(지우지 않음) · % 바뀌면 sub 고침 · 승인·반려된 요청 줄 닫음 · CRM 줄은 안 건드림
- 가격 바꾸기 요청(마스터·부마스터 · 그로홈 채널·세트 빼고): 채널 칩 + 새 가격(100원 올림 · 마진 a → b 미리 보기) + 한마디 → 버전1 개정안 product-meta/pricing-draft 에 transaction 으로 더함(정가 = retail[pKey] · 그 밖 = ovr["pKey|uid"] · 다른 칸 그대로 · meta.status '대기' · note '폰 요청: …') + 업무OS 한 줄 kind priceReq('가격 컨펌' · 관리자에게 · url #req). 승인·반려는 버전1 PC 가격정책표 개정안 그대로(승인하면 CRM price-book 도 버전1 규칙대로). 더보기 '가격 요청 · 승인 대기'(개정안 칸 모두) + 마스터 [PC 가격정책표에서 승인 ›]
- 가격 계산: 제품 고르기(선택) → 채널 칩 → 판매가·수수료·원가·택배비 → 마진 · 개당 · 목표 마진이면 필요한 판매가(저장 없음). 부마스터는 고른 제품 원가 칸 '가려짐'(그 원가로 계산 · 금액 안 보임)
- 재고·유통기한: 공용 DB commerce-division expiryLots/{pour|grohome} 읽기만 → 상품코드별 합 · 가장 빠른 기한 · n일 남음(30일 안·지남 빨강) · 주문함(onOrder) · [유통기한 빠른 순 | 재고 적은 순] · 브랜드 · 찾기. 올리기·재고 충전 계산은 PC
- 매출 = CRM 원본 → '이번 달 매출 ›' = pourstorecrm.web.app/v2#sales (CRM v2 매출 탭)
- 시험: scratchpad m2/calc.test.mjs(계산 · <script id="m2calc"> 만 꺼내 돌림) · m2/t1.mjs(가짜 Firebase compat 여러 앱 · 마스터/부마스터/일반/팀/인증 전/권한 없음/로그인 · 375·768·1280 · 실패 처리) · 업무OS links.test(bigDeal·marginLow·priceReq 태그) · pour-crm scratchpad crm2/t3m.mjs
- 한계: 가격은 단가표(버전1 관리자 화면을 누군가 열어야 새로 계산·저장) 기준 · 승인·반려 뒤 업무OS 요청 줄은 원가 권한 계정이 마진 v2 를 다음에 열 때 닫힘 · 버전1을 열어 둔 채 개정안을 고치면 버전1 이 통째로 저장해서 폰 요청을 덮을 수 있음(버전1 동작 그대로) · 'pour-os/** 공개' 규칙이라 업무OS 줄의 마진 %는 화면에서만 지켜짐
