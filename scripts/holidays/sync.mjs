// 업무OS 공휴일 자동 갱신 — 매달 1일 GitHub Actions(.github/workflows/holidays.yml)가 실행
//  1) 공공데이터포털 '한국천문연구원 특일 정보'(getRestDeInfo)에서 올해·내년 공휴일(대체공휴일·임시공휴일·선거일 포함)을 읽어
//  2) pourstore-renewal/holidays.json 에 저장 → 업무OS v2 두 앱이 열 때 읽어 기한·달력·고정업무 계산에 씀 (못 읽으면 앱 안 표로 계산)
//  3) 새로 생기거나 바뀐·없어진 날이 있으면 Claude 가 요일·이름이 맞는지 한 줄로 확인 (ANTHROPIC_API_KEY 가 있을 때만) → 관리자 설정 화면에 보임
// 시크릿: DATA_GO_KR_KEY(꼭) · ANTHROPIC_API_KEY(선택). 키가 없으면 아무것도 바꾸지 않고 끝남
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.HOLIDAYS_OUT || path.resolve(here, "../../pourstore-renewal/holidays.json");
const KEY = (process.env.DATA_GO_KR_KEY || "").trim();
const API = process.env.DATA_GO_KR_URL || "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const wd = (d) => WD[new Date(d + "T00:00:00Z").getUTCDay()];
const pad = (n) => String(n).padStart(2, "0");

// 한 달 치 공휴일 → [["2026-10-09", "한글날"], …]
async function month(y, m) {
  const sk = KEY.includes("%") ? KEY : encodeURIComponent(KEY);   // 인코딩 키 · 디코딩 키 둘 다 받음
  const res = await fetch(`${API}?serviceKey=${sk}&solYear=${y}&solMonth=${pad(m)}&numOfRows=50&_type=json`);
  const text = await res.text();
  if (!res.ok) throw new Error(`특일 정보 ${y}-${pad(m)}: HTTP ${res.status} ${text.slice(0, 200)}`);
  let j; try { j = JSON.parse(text); } catch { throw new Error(`특일 정보 ${y}-${pad(m)}: JSON 이 아니에요 (서비스 키·활용 신청 승인을 확인) ${text.slice(0, 200)}`); }
  const h = j && j.response && j.response.header;
  if (!h || h.resultCode !== "00") throw new Error(`특일 정보 ${y}-${pad(m)}: ${h ? `${h.resultCode} ${h.resultMsg}` : "응답 모양이 달라요"}`);
  const items = j.response.body && j.response.body.items && j.response.body.items.item;
  return (!items ? [] : Array.isArray(items) ? items : [items])
    .filter((x) => x && x.isHoliday === "Y" && x.locdate)
    .map((x) => { const s = String(x.locdate); return [`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, String(x.dateName || "공휴일").trim()]; });
}

// 바뀐 날을 Claude 가 한 줄로 확인 (요일·이름이 상식에 맞는지 · 대체공휴일이 평일인지)
async function askClaude(lines) {
  const client = new Anthropic();   // ANTHROPIC_API_KEY 를 환경에서 읽음
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",   // 안전 분류기가 거절하면 서버가 권장 모델로 다시 실행
    output_config: { effort: "low" },
    system: "너는 한국 회사 업무 관리 앱의 공휴일 데이터를 점검하는 도우미야. 대한민국 관공서 공휴일 규칙(일요일·설·추석 연휴, 대체공휴일은 평일, 선거일·임시공휴일)에 비추어 아래 바뀐 날들이 이상하지 않은지 보고, 팀원이 읽을 한국어 한 줄로만 답해. 이상한 점이 있으면 '확인 필요:'로 시작해. 다른 설명이나 줄바꿈 없이 한 줄만.",
    messages: [{ role: "user", content: `공공데이터포털 '한국천문연구원 특일 정보'에서 이번에 바뀐 쉬는 날:\n${lines.join("\n")}` }],
  });
  if (res.stop_reason === "refusal") { console.warn("Claude 가 답하지 않았어요 (refusal) — 기본 문장을 씀"); return ""; }
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").replace(/\s+/g, " ").trim();
  return text.slice(0, 200);
}

async function main() {
  if (!KEY) { console.log("DATA_GO_KR_KEY 가 없어요 — 건너뜀. 공공데이터포털 '한국천문연구원 특일 정보' 활용 신청 후 받은 서비스 키를 GitHub 시크릿 DATA_GO_KR_KEY 에 넣어 주세요."); return; }
  const now = new Date(), y0 = now.getFullYear(), years = [y0, y0 + 1];
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
  const days = { ...((prev && prev.days) || {}) }, added = [], removed = [];
  for (const y of years) {
    const got = {};
    for (let m = 1; m <= 12; m++) for (const [d, n] of await month(y, m)) got[d] = got[d] && !got[d].includes(n) ? `${got[d]} · ${n}` : n;
    const cnt = Object.keys(got).length;
    if (cnt < 10) { console.log(`${y}년: ${cnt}일만 받았어요 → 아직 발표 전으로 보고 예전 값 그대로`); continue; }   // 내년은 발표 전이면 비어 있음
    for (const d of Object.keys(days).filter((k) => k.startsWith(`${y}-`))) if (!(d in got)) { removed.push({ date: d, name: days[d] }); delete days[d]; }
    for (const [d, n] of Object.entries(got)) { if (days[d] !== n) added.push({ date: d, name: n, was: days[d] || "" }); days[d] = n; }
    console.log(`${y}년: ${cnt}일`);
  }
  const lines = [...added.map((x) => `${x.date}(${wd(x.date)}) ${x.name}${x.was ? ` (전: ${x.was})` : ""} — 새로/바뀜`), ...removed.map((x) => `${x.date}(${wd(x.date)}) ${x.name} — 빠짐`)];
  let last = (prev && prev.last) || null;
  if (lines.length) {
    const first = !prev;
    let note = first ? `처음 가져옴 · ${Object.keys(days).length}일` : `바뀐 날 ${lines.length}개: ${lines.slice(0, 4).map((l) => l.split(" — ")[0]).join(", ")}${lines.length > 4 ? " 외" : ""}`;
    if (!first && process.env.ANTHROPIC_API_KEY) {
      try { note = (await askClaude(lines)) || note; }
      catch (e) { console.error("Claude 확인 실패 — 기본 문장으로 계속:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e.message); }
    }
    last = { at: now.toISOString(), added, removed, note };
    console.log("바뀐 것:", note);
  } else console.log("바뀐 것 없음");
  const sorted = Object.fromEntries(Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])));
  fs.writeFileSync(OUT, JSON.stringify({ updatedAt: now.toISOString(), source: "공공데이터포털 · 한국천문연구원 특일 정보 (getRestDeInfo)", years, days: sorted, last }, null, 2) + "\n");
  console.log(`저장: ${path.relative(process.cwd(), OUT)} · ${Object.keys(sorted).length}일`);
}
main().catch((e) => { console.error("공휴일 자동 갱신 실패:", e.message); process.exit(1); });
