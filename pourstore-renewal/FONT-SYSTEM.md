# POUR스토어 폰트 시스템 (Font Style Prompt)

> 목적: 자사몰(pourstore.cafe24.com) 전 화면의 폰트를 **통일감 있고 또렷하게** 유지.
> 원칙: **구조는 Pretendard로 또렷하게, 귀여움은 포인트에만.** (오늘의집 방식)
> 새 조각/페이지는 **이 문서 규칙을 그대로 따른다.**

---

## 1. 폰트 패밀리 (역할 고정)

| 역할 | 폰트 | 성격 | 로드 |
|------|------|------|------|
| **기본/제목/숫자 = 거의 전부** | `Pretendard Variable` (fallback: Pretendard) | 깔끔·또렷·프리미엄 | `pretendardvariable.css` |
| **감성 포인트만** | `Jua` (주아체) | 말랑·친근 | Google Fonts `Jua` |

- **모든 섹션 제목·본문·숫자·UI = Pretendard.** 굵기(weight)로 위계를 만든다.
- **Jua는 "감성 포인트" 딱 몇 곳에만.** 굵기 400 하나뿐 → 큰 정보성 제목에 쓰면 얇고 없어보임 → 쓰지 말 것.
- (참고) 도현·검은고딕 등은 헤딩에 쓰지 않는다. story 포스팅 에디터의 **본문 글꼴 선택지**로만 로드됨.

### Jua를 쓰는 "감성 포인트"란?
따뜻하게 말 거는 **짧은 카피 딱 1줄**. 예)
- "저희가 있어요" (pour-06 서비스)
- "셀프시공, 혼자 하는 게 아니에요" (안심밴드)
- "궁금하면 바로 물어보세요" (pour-03 닥터)
→ **섹션 대표 제목·정보성 제목·페이지 히어로 제목·카드 라벨에는 쓰지 않는다.**
  (한 블록 안에서 Jua 제목 + Pretendard 본문/라벨을 섞으면 이상해 보임 → Jua는 그 블록의 "한 줄"만.)

### 로드 스니펫
Jua를 쓰는 조각만 Jua를 로드(안 쓰면 Pretendard만).
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">
```
> Google 한글 Jua는 서브셋 lazy-load라 `display=swap`으로 잠깐 Pretendard 폴백 후 스왑됨(정상).

---

## 2. 요소별 규칙 (하나의 스케일)

| 요소 | 폰트 | 두께 | 크기(PC) | 자간 | line-height |
|------|------|------|------|------|------|
| 섹션 대표 제목 h2 | Pretendard | **900** | **30px**(히어로만 40px) | **-0.035em** | 1.25 |
| story 내부 섹션 제목 | Pretendard | 800 | 22px | -0.03em | 1.3 |
| kicker / eyebrow | Pretendard | 800 | 12px | 0.04em | — |
| 부제(sub/desc) | Pretendard | 500 | 14px | -0.02em | 1.5 |
| 본문 문단 | Pretendard | 500 | 14~15px | -0.02em | 1.7 |
| 콘텐츠 카드 제목(기사·영상) | Pretendard | 700–800 | — | -0.03em | 1.4 |
| 큰 숫자·통계 | Pretendard | 900 | — | -0.03em | 1 |
| 버튼 / CTA | Pretendard | 800 | — | -0.02em | — |
| **감성 포인트 카피** | **Jua** | 400 | 상황별 | -0.01em | 1.3 |

### 표준 CSS (복붙용)
```css
/* 섹션 대표 제목 — 전 섹션 동일 */
.어떤-제목 { font-weight:900; letter-spacing:-0.035em; line-height:1.25; color:#111111; }   /* font-family 생략 → Pretendard 상속 */
/* 감성 포인트만 */
.감성카피 { font-family:'Jua','Pretendard Variable',Pretendard,sans-serif; font-weight:400; letter-spacing:-0.01em; }
/* 강조 단어: 색으로만 */
.or { color:#E8780F; }
```

---

## 3. 강조 = 색 (굵기 아님)
- 강조 오렌지 `#E8780F` (--or). 제목 안 특정 단어는 `<span class="or">`로 **색만**.
- Pretendard 제목은 이미 900이라 더 굵게 X. Jua는 400뿐이라 굵게 불가 → 무조건 색으로.

---

## 4. 적용 현황 (2026-07 기준)
- **Pretendard 900 섹션 제목**: pour-02-best, pour-02b-vending, pour-04-home, pour-05-shorts,
  pour-07-magazine, pour-08-video, pour-09-record, story(섹션 제목·브랜드 헤딩)
- **Jua 감성 포인트(각 1줄만)**: pour-03-doctor("궁금하면 바로 물어보세요"),
  pour-06-service("저희가 있어요"), story 안심밴드("혼자 하는 게 아니에요"), common/pour-safety-banner
- **Pretendard 유지**: story 히어로 h1·포인트 라벨·안심밴드 카드 라벨, 콘텐츠 카드 제목, 통계 숫자, 검색 UI

---

## 5. 하지 말 것
- ❌ 정보성 섹션 제목을 Jua/도현 등 커스텀폰트로 (얇고 없어보임 → 통일감 깨짐)
- ❌ Jua/커스텀폰트에 weight 700/900 (400뿐 → 가짜볼드 뭉개짐)
- ❌ 섹션마다 제목 크기·자간 제각각 (30px/-0.035em로 통일, 히어로만 예외)
- ❌ 강조를 굵기로 (색 #E8780F로만)
- ❌ 숫자/영문 스펙을 커스텀폰트로
