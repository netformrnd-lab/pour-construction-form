# POUR OS

넷폼알앤디 브랜드커머스팀 **업무·매출 관리 앱** (React SPA, Vite).

> **팀 최종목표를 매일의 업무 실행과 연결하고, 누가 무슨 활동으로 얼마를 벌었는지까지 자동 집계·기록하는 업무관리 도구.**
>
> "기록되지 않은 업무 = 하지 않은 것." — 매일의 실행이 남아 자산이 된다. (그래서 데이터 영속화가 1순위)

모바일 우선. 최종목표(10억) → 메인KPI → 서브KPI → 프로젝트(활동) → 업무.

---

## 1. 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173  (UI 개발)
```

이게 끝. UI는 바로 뜬다. (AI 코치만 아래 2번 필요)

## 2. AI 코치까지 로컬에서 테스트 (선택)

AI 코치는 `functions/api/coach.js`(Cloudflare Function)가 Anthropic 키를 붙여 호출한다.
Vite 단독(`npm run dev`)에선 `/api/coach`가 없어 AI 코치만 동작 안 함 — 정상이다.
전체(함수 포함)로 보려면:

```bash
cp .dev.vars.example .dev.vars     # 파일 열어 ANTHROPIC_API_KEY 입력
npm run build
npm run cf:dev                     # functions/api/coach 포함 서빙
```

## 3. Claude Code로 개발

이 폴더에서:

```bash
claude
```

`CLAUDE.md`에 **데이터 모델 · 규칙 · 로드맵**이 들어있어 Claude Code가 자동 참고한다.
예시 작업:
- "src/App.jsx를 components / data / lib 로 분리해줘. 동작 그대로."
- "상태를 localStorage(키 godsaeng-os-v2)에 영속화해줘."
- "Firestore 연동해줘. orderBy 금지, 클라이언트 정렬."

## 4. 배포 (Cloudflare Pages)

**방법 A — GitHub 연결 (권장, 자동 빌드)**
1. 이 폴더를 GitHub 저장소로 push.
2. Cloudflare Pages → Create → 저장소 연결.
3. Build command: `npm run build` / Output directory: `dist`.
4. Settings → Environment variables → `ANTHROPIC_API_KEY` 추가.
5. push 할 때마다 자동 배포.

**방법 B — 수동**
```bash
npm run build
npx wrangler pages deploy dist     # 또는 dist/ 폴더를 Pages에 드래그
```

---

## 구조
```
pour-os/
├── index.html              # 폰트(Pretendard / IBM Plex Mono) + 루트
├── src/
│   ├── main.jsx            # 엔트리
│   └── App.jsx             # 앱 전체 (단일 파일, 점진적 분리 예정)
├── functions/api/coach.js  # AI 코치 — Anthropic 프록시 (/api/coach)
├── CLAUDE.md               # Claude Code용 프로젝트 규칙·데이터 모델
└── vite.config.js
```

자세한 규칙은 **CLAUDE.md** 참고.
