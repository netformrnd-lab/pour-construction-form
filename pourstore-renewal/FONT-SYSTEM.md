# POUR스토어 폰트 시스템 (Font Style Prompt)

> 목적: 자사몰(pourstore.cafe24.com) 전 화면의 폰트 사용을 **일관**되게 유지.
> 톤: "오늘의집처럼 친근하고 귀여운데, 본문은 깔끔하게 읽히는" 느낌.
> 새 조각/페이지를 만들 때 **이 문서 규칙을 그대로 따른다.**

---

## 1. 폰트 패밀리 (2종만 사용)

| 역할 | 폰트 | 로드 |
|------|------|------|
| **기본(Base)** — 본문·UI·숫자·영문 | `Pretendard Variable` (fallback: Pretendard, system) | `pretendardvariable.css` |
| **강조(Display)** — 제목·짧은 라벨 | `Jua` (배민 주아체 계열, 둥글고 귀여움) | `https://fonts.googleapis.com/css2?family=Jua&display=swap` |

- Jua는 **웨이트가 400 하나뿐**이다. → **굵기로 강약을 주지 않는다.** 강조는 **색(오렌지)·크기**로만.
- Jua는 **숫자·영문 가독성이 약하다.** → 숫자/영문 위주 요소는 반드시 Pretendard.
- 본문(2줄 이상 문단)은 **항상 Pretendard** (장문 가독성).

### 로드 스니펫
조각 상단에 Pretendard와 함께 Jua를 같이 로드한다.
```html
<!-- <link> 방식 조각 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">
```
```css
/* <style> @import 방식 조각 — @import는 반드시 다른 규칙보다 위 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/[email protected]/dist/web/variable/pretendardvariable.css');
@import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
```

---

## 2. 요소별 규칙

| 요소 | 폰트 | 두께 | 자간(letter-spacing) | 비고 |
|------|------|------|------|------|
| 히어로 h1 / 섹션 대표 제목 h2 | **Jua** | 400 | **-0.01em** | 자간 너무 좁히지 말 것(Jua는 여백 필요) |
| 카드 소제목·포인트 라벨(짧은 강조) | **Jua** | 400 | 0 ~ -0.01em | 예: "데이터로 풀고" |
| 본문 문단·설명(lead/desc) | Pretendard | 500 | -0.02em | |
| **콘텐츠 카드 제목(기사·영상 제목)** | Pretendard | 700–800 | -0.03em | **Jua 금지**(가독성·말줄임) |
| **큰 숫자·통계**(2,600,000 등) | Pretendard | 900 | -0.03em | **Jua 금지**(임팩트·정렬) |
| 버튼 / CTA | Pretendard | 800 | -0.02em | |
| 칩·태그·kicker·eyebrow | Pretendard | 700–800 | 0.02~0.14em | 영문 라벨 포함 |

### Display 제목 표준 CSS (복붙용)
```css
.어떤-제목 {
  font-family:'Jua','Pretendard Variable',Pretendard,sans-serif;
  font-weight:400;
  letter-spacing:-0.01em;
  line-height:1.24~1.28;
  color:#111111;
}
/* 강조 단어: 색으로만 */
.어떤-제목 .or { color:#E8780F; }   /* font-weight 그대로 400 */
```

---

## 3. 컬러(강조) — 폰트 강약의 대체 수단
- 강조 오렌지: `#E8780F` (--or)
- 본문 먹색: `#111111` / 서브 회갈색: `#6B5B4B`, `#8A7362`
- Jua 제목에서 특정 단어 강조는 `<span class="or">` 로 **색만** 바꾼다(굵게 X).

---

## 4. 적용 현황 (2026-07 기준)
- **적용됨(Display=Jua)**: pour-02-best, pour-02b-vending, pour-03-doctor, pour-04-home,
  pour-05-shorts, pour-06-service, pour-07-magazine, pour-08-video, pour-09-record(갤러리·협력사 제목),
  story/pour-story(히어로·섹션·브랜드·포인트·안심밴드), common/pour-safety-banner
- **의도적 Pretendard 유지**: 모든 콘텐츠 카드 제목, 통계 숫자(pour-09 실적, 히어로 카운터), 검색창/입력 UI
- **미적용(검토 대상)**: pour-01-main 검색 슬로건(현재 시머 효과 유지 위해 Pretendard) — 필요 시 전환 가능

---

## 5. 하지 말 것 (안티패턴)
- ❌ Jua에 `font-weight:700/900` 지정 (400만 존재 → 브라우저가 가짜 볼드 합성, 뭉개짐)
- ❌ 본문 문단 전체를 Jua로 (읽기 피로)
- ❌ 숫자/가격/영문 스펙을 Jua로 (정렬·가독성 저하)
- ❌ Jua 제목에 `letter-spacing:-0.04em` 이상 좁히기 (글자 붙음)
