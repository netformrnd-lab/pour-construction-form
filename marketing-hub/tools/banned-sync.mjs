// 사용금지어 사본 다시 쓰기 — 원본 marketing-hub/banned.js (사장님 2026-10-19 '금지·주의 단어 작성 가이드')
//   → marketing-hub/tools/team_link.py BANNED_START~END (+ 옆에 볼트가 있으면 pour-marketing-vault/tools/team_link.py 같은 칸)
//   → functions/api/team-ai.js · dashboard-ai.js · pourstore-renewal/assets/builder.js · pourstore-renewal/chatbot.html BANNED_RULE (팀·마진 대시보드 AI · 자사몰 리뉴얼 상세 AI · 옛 챗봇 관리센터 지시문)
//   → 옆에 pour-crm 이 있으면 src/pages/chatbot/banned.js (챗봇 · 머리 두 줄 + 원본 그대로)
// 사용: node marketing-hub/tools/banned-sync.mjs   → 바뀐 파일만 씀 · node marketing-hub/banned.test.mjs 가 같은지 봄
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as B from '../banned.js';
const here = (p) => new URL(p, import.meta.url);
const put = (u, s) => { const old = existsSync(u) ? readFileSync(u, 'utf8') : null; if (old === s) { console.log('그대로:', u.pathname); return; } writeFileSync(u, s); console.log('다시 씀:', u.pathname); };
const sync = { ver: B.BANNED_VER, src: B.BANNED_SRC, banned: B.BANNED, skip: B.BANNED_SKIP, rule: B.bannedRule() };
const json = `{"ver": ${JSON.stringify(sync.ver)}, "src": ${JSON.stringify(sync.src)},\n"banned": [\n${sync.banned.map((b) => JSON.stringify(b)).join(',\n')}\n],\n"skip": [\n${sync.skip.map((x) => JSON.stringify(x)).join(',\n')}\n],\n"rule": ${JSON.stringify(sync.rule)}}`;   // 한 줄에 한 말 (읽기 쉽게)
if (json.includes("'''")) throw new Error("목록에 ''' 가 있어 파이썬 글로 못 넣음");
for (const p of ['./team_link.py', '../../../pour-marketing-vault/tools/team_link.py']) {
  const u = here(p); if (!existsSync(u)) { console.log('없음 (건너뜀):', u.pathname); continue; }
  const s = readFileSync(u, 'utf8'), re = /# BANNED_START\nBANNED_DATA = json\.loads\(r'''[\s\S]*?'''\)\n# BANNED_END/;
  if (!re.test(s)) { console.log('⚠️ BANNED_START~END 칸이 없음 (먼저 team_link.py 를 같은 판으로):', u.pathname); continue; }
  put(u, s.replace(re, () => `# BANNED_START\nBANNED_DATA = json.loads(r'''${json}''')\n# BANNED_END`));
}
for (const f of ['../../functions/api/team-ai.js', '../../functions/api/dashboard-ai.js', '../../pourstore-renewal/assets/builder.js', '../../pourstore-renewal/chatbot.html']) {   // 팀·마진 대시보드 AI · 자사몰 리뉴얼 상세 AI · 옛 챗봇 관리센터(리뉴얼 관리자에서 연결)
  const u = here(f), s = readFileSync(u, 'utf8'), re = /(\/\* BANNED_RULE_START[^*]*\*\/\n[ \t]*)const BANNED_RULE = ".*";(\n[ \t]*\/\* BANNED_RULE_END \*\/)/;
  if (!re.test(s)) throw new Error(`${f}: BANNED_RULE 칸이 없음`);
  put(u, s.replace(re, (_, a, b) => `${a}const BANNED_RULE = ${JSON.stringify(sync.rule).replace(/`/g, '\\u0060').replace(/\$\{/g, '\\u0024{')};${b}`));
}
const crm = here('../../../pour-crm/src/pages/chatbot/banned.js');
if (existsSync(here('../../../pour-crm/src/pages/chatbot/'))) put(crm, `// 사본 — 원본 pour-construction-form/marketing-hub/banned.js (사장님 2026-10-19 사용금지어) · 고치려면 원본을 고치고 node marketing-hub/tools/banned-sync.mjs\n// CRM 챗봇: lib.js ANSWER_FORMAT_FIXED 에 bannedRule() · 상담 Inbox AI 초안 아래 bannedHits 표시\n` + readFileSync(here('../banned.js'), 'utf8'));
else console.log('없음 (건너뜀): pour-crm');
