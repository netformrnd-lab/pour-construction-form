# POUR스토어 폰트 시스템 (Font Style Prompt)

> 목적: 자사몰(pourstore.cafe24.com) 전 화면의 폰트 사용을 **일관**되게 유지.
> 톤: "오늘의집처럼 친근하고 귀여운데, 본문은 깔끔하게 읽히는" 느낌.
> 새 조각/페이지를 만들 때 **이 문서 규칙을 그대로 따른다.**

---

## 1. 폰트 패밀리 (3종 — 역할 고정)

| 역할 | 폰트 | 성격 | 로드 |
|------|------|------|------|
| **기본(Base)** — 본문·UI·숫자·영문 | `Pretendard Variable` (fallback: Pretendard) | 깔끔·가독 | `pretendardvariable.css` |
| **큰 제목(Display)** — 섹션 대표 헤드라인 | **`Do Hyeon`** (도현체) | 굵고 둥근 임팩트 | Google Fonts `Do+Hyeon` |
| **강조(Accent)** — 따뜻한 메시지·포인트 라벨 | **`Jua`** (주아체) | 말랑·친근 | Google Fonts `Jua` |

- **Do Hyeon**과 **Jua**는 둘 다 **웨이트 400 하나뿐** → **굵기로 강약 금지.** 강조는 **색(#E8780F)·크기**로만.
- 두 폰트 모두 **숫자·영문 가독성이 약함** → 숫자/통계·영문 스펙은 반드시 Pretendard.
- 본문(2줄 이상 문단)은 **항상 Pretendard**.

### 언제 Do Hyeon vs Jua?
- **Do Hyeon** = 정보성·내비게이션형 큰 제목. 예) "지금 많이 찾는 자재", "POUR 영상으로 쉽게 배우기", "전국 시공 현장", "우리 집, 이렇게 바꿨어요"
- **Jua** = 감성·따뜻한 짧은 카피 + 포인트 라벨. 예) "저희가 있어요", "혼자 하는 게 아니에요", "궁금하면 바로 물어보세요", "데이터로 풀고"(포인트)

### 로드 스니펫
큰 제목을 쓰는 조각은 Do Hyeon을, 감성 카피를 쓰는 조각은 Jua를 로드(둘 다 쓰면 둘 다).
로딩 지연(FOUT) 최소화를 위해 `preconnect`를 함께 건다.
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Jua&display=swap">
```
```css
/* <style> @import 방식 조각 — @import는 반드시 다른 규칙보다 위 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable.css');
@import url('https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Jua&display=swap');
```
> ⚠️ Google 한글 폰트는 수십 개 unicode-range 서브셋으로 나뉘어 **lazy-load**된다.
> `display=swap`이라 폰트 도착 전엔 Pretendard로 잠깐 폴백됐다가 스왑된다(정상). preconnect로 스왑을 앞당긴다.

---

## 2. 요소별 규칙

| 요소 | 폰트 | 두께 | 자간 | 비고 |
|------|------|------|------|------|
| 섹션 대표 제목 h2 / 히어로 큰 제목 | **Do Hyeon** | 400 | -0.01em | 정보성 헤드라인 |
| 감성 카피·짧은 메시지 제목 | **Jua** | 400 | -0.01em | "저희가 있어요" 류 |
| 카드 소제목·포인트 라벨 | **Jua** | 400 | 0 ~ -0.01em | 예: "데이터로 풀고" |
| 본문 문단·설명(lead/desc) | Pretendard | 500 | -0.02em | |
| **콘텐츠 카드 제목(기사·영상 제목)** | Pretendard | 700–800 | -0.03em | **커스텀폰트 금지**(가독성·말줄임) |
| **큰 숫자·통계**(2,600,000 등) | Pretendard | 900 | -0.03em | **커스텀폰트 금지** |
| 버튼 / CTA | Pretendard | 800 | -0.02em | |
| 칩·태그·kicker·eyebrow | Pretendard | 700–800 | 0.02~0.14em | 영문 라벨 포함 |

### 표준 CSS (복붙용)
```css
/* 큰 제목 */
.어떤-큰제목 { font-family:'Do Hyeon','Pretendard Variable',Pretendard,sans-serif; font-weight:400; letter-spacing:-0.01em; line-height:1.24; color:#111111; }
/* 감성 강조 */
.어떤-강조 { font-family:'Jua','Pretendard Variable',Pretendard,sans-serif; font-weight:400; letter-spacing:-0.01em; color:#111111; }
/* 강조 단어: 색으로만(굵게 X) */
.or { color:#E8780F; }
```

---

## 3. 컬러(강조) — 폰트 강약의 대체 수단
- 강조 오렌지: `#E8780F` (--or)
- 본문 먹색: `#111111` / 서브 회갈색: `#6B5B4B`, `#8A7362`
- 특정 단어 강조는 `<span class="or">`로 **색만** 바꾼다(굵게 X — 두 커스텀폰트는 400뿐).

---

## 4. 적용 현황 (2026-07 기준)
- **Do Hyeon(큰 제목)**: pour-02-best, pour-02b-vending, pour-04-home, pour-05-shorts,
  pour-07-magazine, pour-08-video, pour-09-record(갤러리·협력사 제목), story(섹션 제목·브랜드 헤딩)
- **Jua(강조·메시지)**: pour-03-doctor("궁금하면 바로 물어보세요"), pour-06-service("저희가 있어요"),
  story(히어로 h1·포인트 라벨·"혼자 아니에요" 안심밴드), common/pour-safety-banner
- **Pretendard 유지(의도적)**: 모든 콘텐츠 카드 제목, 통계 숫자, 검색/입력 UI

---

## 5. 하지 말 것 (안티패턴)
- ❌ Do Hyeon/Jua에 `font-weight:700/900` 지정 (400만 존재 → 가짜 볼드 합성, 뭉개짐)
- ❌ 본문 문단 전체를 커스텀폰트로 (읽기 피로)
- ❌ 숫자/가격/영문 스펙을 커스텀폰트로 (정렬·가독성 저하)
- ❌ 커스텀폰트 제목에 `letter-spacing:-0.04em` 이상 좁히기 (글자 붙음)
- ❌ Do Hyeon과 Jua를 한 제목 안에서 섞기 (한 요소=한 폰트)
