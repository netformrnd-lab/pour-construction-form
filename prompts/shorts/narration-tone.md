# POUR 숏폼 나레이션 말투 기준 (모든 편 공통)

> 사용자 지정 기준 (2026.10.02). 숏폼 나레이션은 이 문서를 따른다.

## 기본 목소리
- Higgsfield 음성(Seed Audio) · **Harrison** (차분한 남성 설명 톤) — voice_id `573e5163-59b3-4926-aab1-951ef2985f81`, preset
- 타입캐스트를 쓸 때는 30~40대 남성, 차분하고 믿음직한 설명 톤 캐릭터 선택

## 말투 프롬프트 — 한국어
30~40대 남성 건축 전문가가 옆에서 차근차근 설명해 주는 말투.
차분하고 믿음직하게, 너무 빠르지 않게 또박또박 말한다.
광고 성우처럼 과장하거나 들뜨지 않고, 친한 기술자가 "이게 이래서 새는 거예요" 하고 알려 주는 느낌.
문장 끝은 내려서 단정하게 맺는다.
쉼표에서는 짧게 숨을 쉬고, 강조어 바로 앞에서 반 박자 쉰 뒤 그 단어를 조금 더 힘주어 말한다.
문제를 말할 때는 진지하게, 해결책을 말할 때는 자신 있고 밝게 톤을 살짝 올린다.

## 말투 프롬프트 — English
A calm, trustworthy Korean male construction expert in his 30s-40s, explaining clearly at a natural, unhurried pace.
Not a hyped commercial announcer - like a friendly experienced contractor explaining "this is why it leaks."
End sentences with a settled, falling tone. Breathe briefly at commas.
Pause for half a beat right before the key word, then stress it slightly.
Serious tone for the problem, confident and slightly brighter tone for the solution.

## 설정값
- 속도: 타입캐스트 1.0~1.05배 / Higgsfield speech_rate 0~+10 / +20 이상 금지
- 후크(첫 문장)·핵심 메시지 묶음만: 감정·톤 한 단계↑, 속도 0.95배 (Higgsfield: speech_rate −5, expression_intensity 한 단계↑)
- 나머지 묶음: 기본 차분 톤 (대비가 있어야 강조가 들림)
- Seed Audio는 말투 문장을 별도로 받는 칸이 없다 → 말투는 **대본의 문장 구조(쉼표·짧은 문장·질문형)** 와 설정값으로 만든다. 말투 문장을 대본에 섞으면 그대로 읽어 버리므로 넣지 않는다.

## 생성 방법
- 문장 하나씩 따로 만들지 않는다. 컷 하나 분량(2~3문장)을 한 번에 생성한다.
- 이어 붙이기: 파일 앞뒤 긴 무음만 0.1초 남기고 자름(문장 사이 숨소리 유지) / 묶음 사이 0.4~0.6초 / 접합부 30ms 크로스페이드
- 배경음악은 나레이션보다 −18~−20dB

## 대본 쓰는 법
- 초당 4.5~5음절 (20초 90~100 / 30초 135~150음절). 길면 문장을 줄이고 속도는 올리지 않는다.
- 한 문장 25음절 이하. "~합니다" 반복 금지, "~거든요/~죠/~예요"·질문형 섞기 (가볍거나 장난스러운 말투 X)
- 강조어는 컷마다 1개, 전체 4~6개
  - 강조어 바로 앞에서 쉰다: "물이 새는 곳은, 【모서리】입니다."
  - 강조어를 문장 끝이나 짧은 단독 문장으로: "범인은 비가 아닙니다. 【햇빛】이에요."
  - 대비는 짝을 맞춘다: "달궈지면 늘고, 식으면 줄어듭니다."
- 발음대로 적는다: 3개월→삼 개월 / KS→케이에스 / 336%→삼백삼십육 퍼센트 / 40℃→사십 도 / POUR→포어 (자막은 POUR)

## ★ 시공 구간 예외 규칙 (강제, 2026.10.03)
- 시공 방법을 말하는 구간만은 한 톤 밝고 경쾌하게: "쓱 붙이고, 싹 바르고, 덮고, 쏙 꽂으면 끝! 누구나 할 수 있어요."
- 의성어(쓱·싹·쏙) + 짧은 동사, 전문 용어·주의사항 나열 금지, 마지막에 격려 한 마디 필수 ("야, 너도 할 수 있어" 느낌)
- 자세한 기준: `prompts/06-sales-shorts-system.md` ★ 시공 장면 강제 지침
