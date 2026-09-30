// ✅ KPI 행동지표 · 결과 KPI · 권한(마스터·PIN) · 월말 회고 — 계산 로직만 (화면은 App.jsx)
// 기준 파일: 'POUR KPI 체크리스트'(Pour스토어 시트) — 필수 19개 + 결과 KPI 6개
//
// 저장 구조
//  · 행동지표 정의  → 공유 컬렉션 actionKPIs  (pour-os/state-actionKPIs · 멈춤만 있고 삭제 없음)
//  · 결과 KPI       → 공유 컬렉션 lagKPIs     (월별 값 monthly{YYYY-MM:{v,by,at}} — 월말 회고 때 월 1회 입력)
//  · 주별 실적      → 분기 문서 pour-os/kpi-act-YYYY-Qn  { w:{월요일:{항목id:{n,fail,by{uid:n}}}}, log:[…] }
//    +1 은 increment 로 쌓아서, 여러 사람이 동시에 눌러도 서로 덮어쓰지 않는다.

// ── 기준 데이터 ──
const MINI = "TC51U2cdFnn6Q5Y7A6o9";   // 윤미니 (어드민센터 담당자 id)
export const AK_FUNS = ["A 유입", "A 활성화", "R 재구매", "R 수익", "R 추천", "기타"];
export const AK_CYC = { W: "주간", M: "월간", Q: "분기" };
const RAW = [
  { id: "kwsel", fun: "A 유입", cyc: "M", name: "(B2C) 키워드 선정 (광고/컨텐츠)", goal: 1, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "네이버 포스팅·광고에 활용할 LVRS 키워드 선정 · 월 검색량 500~1,000 타겟" },
  { id: "c_b2c", fun: "A 유입", cyc: "W", name: "(B2C) 컨텐츠 발행 (+재활용)", goal: 4, unit: "건", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "제품·스펙·상품 기준 블로그 발행 → 티스토리·유튜브숏츠·네이버카페(전아모·인기통) 재활용" },
  { id: "c_b2b", fun: "A 유입", cyc: "W", name: "(B2B) 컨텐츠 발행 (+재활용)", goal: 2, unit: "건", who: ["ran"], whoNames: ["란"], how: "직접", desc: "자재공동구매·파트너모집·시공연결 등 B2B 서비스 포스팅 → 타 채널 재활용" },
  { id: "trial", fun: "A 유입", cyc: "M", name: "(B2B) 체험단 모집 컨텐츠 발행", goal: 1, unit: "회", who: ["ran"], whoNames: ["란"], how: "직접", desc: "전아모·인기통에 체험단 무상제공, 가입 시 5% 할인 홍보" },
  { id: "link", fun: "A 유입", cyc: "M", cycNote: "1개월 내", name: "기존 포스팅 링크 수정", goal: 100, unit: "%", step: 10, who: ["chaerim"], whoNames: ["채림"], how: "직접", desc: "아임웹 상품링크 → 카페24 상품링크로 전환" },
  { id: "influ", fun: "A 유입", cyc: "M", name: "(B2B) 인플루언서 섭외", goal: 2, unit: "건", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "박빈장·목수이박사·플로우티브이·셀프마리오·공하우스·미노팸·판곡리기술자·물먹는하마·태일방수 (총 9명)" },
  { id: "influrv", fun: "A 유입", cyc: "M", name: "인플루언서 리뷰 확보", goal: 20, unit: "건", who: ["chaerim"], whoNames: ["채림"], how: "외주", desc: "가구매·체험단 리뷰 (품목당 20건), 티블" },
  { id: "influch", fun: "A 유입", cyc: "Q", name: "인플루언서 확보", goal: 1, unit: "건", who: ["chaerim"], whoNames: ["채림"], how: "직접", desc: "인포크링크, 쿠팡파트너스 — 신규 채널 확보" },
  { id: "kwtop", fun: "A 유입", cyc: "W", name: "검색키워드 상위노출 확인", goal: 1, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "외주", desc: "광고 키워드 세팅, ROAS 저조 키워드 재검토 / 스마트스토어·쿠팡은 링크프라이스" },
  { id: "ad", fun: "A 유입", cyc: "W", name: "고객 타겟 광고 진행", goal: 2, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "외주", desc: "메타/구글애즈 디멘드젠 (비교견적 필요 · 타겟 설정 시 유튜브 광고 노출)" },
  { id: "call_b2c", fun: "A 활성화", cyc: "W", name: "(B2C) 구매 미전환 고객 전화확인", goal: 1, unit: "회", who: ["songhee"], whoNames: ["송희"], how: "직접", desc: "견적서 나간 고객 대상 — 구매 안 한 이유 문의" },
  { id: "call_b2b", fun: "A 활성화", cyc: "W", name: "(B2B) 구매 미전환 고객 전화확인", goal: 1, unit: "회", who: ["ran"], whoNames: ["란"], how: "직접", desc: "시공의뢰 중 이탈 고객 대상 — 이유 문의" },
  { id: "ux", fun: "A 활성화", cyc: "M", name: "자사몰 UX/UI 관리개선 확인", goal: 1, unit: "회", who: ["minji"], whoNames: ["민지"], how: "직접", desc: "AI 활용 개발(쿠팡/배달의민족 카피), 전화 퀵배너로 상담 유도" },
  { id: "promo", fun: "R 재구매", cyc: "M", cycNote: "1개월 내", name: "(B2B) 구매고객 프로모션 안내", goal: 100, unit: "%", step: 10, who: ["ran"], whoNames: ["란"], how: "직접", desc: "관리사무소 연락: 5~10% 신제품 구매할인 안내, 후기 작성 시 기프티콘 안내" },
  { id: "match", fun: "R 수익", cyc: "M", cycNote: "실패 건별 3회", perFail: 3, name: "(B2B) 대체 시공파트너 발굴 매칭시도", goal: 0, unit: "회", who: ["ran"], whoNames: ["란"], how: "직접", desc: "마진 붙은 견적서 전달 → 시공 진행 의사 확인, 시공매칭 이탈율 낮추기",
    why: "안 되는 이유\n1. 현장 방문 없이 산출한 경우 물량 오차, 추가구매 컴플레인, 시공자 책임감 부족 → 스토어가 관리책임\n2. 시공자는 AS 책임 부담이 없음 → 스토어가 관리책임" },
  { id: "ref", fun: "R 추천", cyc: "W", name: "(B2C/B2B) 추천제 확인 후 쿠폰 전달", goal: 1, unit: "회", who: [MINI], whoNames: ["미니"], how: "직접", desc: "구매 시 지인추천코드 입력 → 기프티콘·할인쿠폰 제공" },
  { id: "nps_b2c", fun: "R 추천", cyc: "M", name: "(B2C) NPS 만족도 조사 - 유선", goal: 2, unit: "회", who: [MINI], whoNames: ["미니"], how: "직접", desc: "구매고객 진행현황·시공 만족도 조사 + 추천제 소개" },
  { id: "nps_b2b", fun: "R 추천", cyc: "W", name: "(B2B) NPS 만족도 조사 - 유선", goal: 1, unit: "회", who: ["ran"], whoNames: ["란"], how: "직접", desc: "시공매칭 고객 진행현황·시공 만족도 조사 + 추천제 소개" },
  { id: "review", fun: "R 추천", cyc: "M", name: "(B2C) 리뷰·후기 유도 체계화", goal: 20, unit: "건", who: [MINI], whoNames: ["미니"], how: "직접", desc: "네이버 리뷰·블로그에 후기 남기면 혜택 제공" },
];
// 필수(core) = 보내준 파일의 19개 · POUR스토어 기본값. 이후 추가하는 건 core:false (추가 행동지표)
export const AK_SEED = RAW.map((x, i) => ({ ...x, id: "ak_" + x.id, core: true, active: true, brand: "POUR스토어", order: i + 1, startDate: "2026-09-28", createdAt: "2026-09-28T09:00:00.000Z", createdBy: "seed" }));   // 이번 주(9/28 주)부터 바로 체크
export const LAG_SEED = [
  { id: "lg_inflow", fun: "A 유입", name: "자사몰 월 평균 유입", goal: 4000, unit: "명", base: 2728 },
  { id: "lg_callcv", fun: "A 활성화", name: "오프라인-전화 구매전환율", goal: 60, unit: "%", base: 48.9 },
  { id: "lg_mallcv", fun: "A 활성화", name: "온라인-자사몰 구매전환율", goal: 5, unit: "%", base: 1.14 },
  { id: "lg_repurchase", fun: "R 재구매", name: "재구매율", goal: 40, unit: "%", base: 22.2 },
  { id: "lg_match", fun: "R 수익", name: "시공매칭 성사율", goal: 40, unit: "%", base: 16.5 },
  { id: "lg_nps", fun: "R 추천", name: "NPS조사 응답율", goal: null, unit: "%", base: null },
].map((x, i) => ({ ...x, order: i + 1, baseNote: "엑셀 기준값", monthly: {} }));

// ── 기존 KPI(메인KPI·서브KPI)와 연결 — 항목에 mk/sk 가 없으면 이 기본값 (행동지표 수정에서 바꿀 수 있음) ──
// 메인1 직판(mk1): 자사몰 sk1 · 마켓플레이스 sk2 · 쇼룸·전화 sk3 / 메인2 B2B(mk2): 시공매칭 sk8 / 공통: ""
const LINK_DEFAULT = {
  ak_kwsel: ["mk1", "sk1"], ak_c_b2c: ["mk1", "sk1"], ak_c_b2b: ["mk2", ""], ak_trial: ["mk2", ""], ak_link: ["mk1", "sk1"],
  ak_influ: ["mk2", ""], ak_influrv: ["mk1", "sk1"], ak_influch: ["mk1", "sk2"], ak_kwtop: ["mk1", "sk1"], ak_ad: ["mk1", "sk1"],
  ak_call_b2c: ["mk1", "sk3"], ak_call_b2b: ["mk2", ""], ak_ux: ["mk1", "sk1"], ak_promo: ["mk2", ""], ak_match: ["mk2", "sk8"],
  ak_ref: ["mk1", ""], ak_nps_b2c: ["", ""], ak_nps_b2b: ["", ""], ak_review: ["mk1", "sk1"],
  lg_inflow: ["mk1", "sk1"], lg_callcv: ["mk1", "sk3"], lg_mallcv: ["mk1", "sk1"], lg_repurchase: ["mk1", ""], lg_match: ["mk2", "sk8"], lg_nps: ["", ""],
};
export const akLink = (it) => { const d = LINK_DEFAULT[it && it.id] || ["", ""]; return { mk: it && it.mk !== undefined ? (it.mk || "") : d[0], sk: it && it.sk !== undefined ? (it.sk || "") : d[1] }; };

// ── 날짜: 주 = 월요일 시작, 그 주의 월요일이 속한 달 = 그 주의 달 (파일과 동일) ──
const p2 = (n) => String(n).padStart(2, "0");
export const akYmd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const akMonday = (d) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
export const akWeekKey = (d = new Date()) => akYmd(akMonday(d));
const parseYmd = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const akAddDays = (ymd, n) => { const d = parseYmd(ymd); d.setDate(d.getDate() + n); return akYmd(d); };
export const akQidOfWeek = (wk) => { const d = parseYmd(wk); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; };
export const akQidOfMonth = (y, m0) => `${y}-Q${Math.floor(m0 / 3) + 1}`;
export const akYm = (y, m0) => `${y}-${p2(m0 + 1)}`;
// 그 달(부터 n달)의 주 목록 — 월요일이 그 기간 안에 있는 주만
export function akWeeksIn(y, m0, n = 1) {
  const out = [], end = new Date(y, m0 + n, 0);
  for (let d = akMonday(new Date(y, m0, 1)); d <= end; d.setDate(d.getDate() + 7)) {
    const m = d.getMonth() + (d.getFullYear() - y) * 12;
    if (m >= m0 && m < m0 + n) { const s = new Date(d), e = new Date(d); e.setDate(e.getDate() + 6); out.push({ key: akYmd(s), start: akYmd(s), end: akYmd(e), label: `${s.getMonth() + 1}/${s.getDate()}`, sub: `~${e.getMonth() + 1}/${e.getDate()}` }); }
  }
  return out;
}
export const akQuarterWeeks = (y, m0) => akWeeksIn(y, Math.floor(m0 / 3) * 3, 3);
// 그 주가 속한 달(월요일 기준)
export const akMonthOfWeek = (wk) => { const d = parseYmd(wk); return { y: d.getFullYear(), m0: d.getMonth() }; };

// ── 값 읽기 ──
const raw = (docs, it, wk) => ((((docs || {})[akQidOfWeek(wk)] || {}).w || {})[wk] || {})[it.id] || null;
export function akVal(docs, it, wk) {
  const v = raw(docs, it, wk);
  if (it.perFail) return { n: Math.max(0, +(v && v.n) || 0), fail: Math.max(0, +(v && v.fail) || 0) };
  return Math.max(0, +(v && v.n) || 0);
}
export const akBy = (docs, it, wk) => { const v = raw(docs, it, wk); return (v && v.by) || {}; };
// 주간 항목: 그 주 목표 달성 여부
export const akWeekDone = (docs, it, wk) => it.cyc === "W" && !it.perFail && akVal(docs, it, wk) >= (+it.goal || 1);
// 합계 — 주간·월간 항목은 그 달 주들, 분기 항목은 그 분기 주들을 넘긴다
export function akTotal(docs, it, weeks) {
  if (it.perFail) {
    let n = 0, f = 0; weeks.forEach((w) => { const v = akVal(docs, it, w.key); n += v.n; f += v.fail; });
    const g = f * it.perFail; return { n, g, fail: f, none: g === 0, done: g > 0 && n >= g };
  }
  let n = 0; weeks.forEach((w) => { n += akVal(docs, it, w.key); });
  if (it.unit === "%") { n = Math.min(100, n); return { n, g: 100, done: n >= 100 }; }
  const g = it.cyc === "W" ? (+it.goal || 1) * weeks.length : (+it.goal || 1);
  return { n, g, done: n >= g };
}
// 행동지표 시작일 — 이 날 이전 주는 '미달'로 치지 않는다
export const akStart = (it) => String((it && (it.startDate || it.createdAt)) || "2000-01-01").slice(0, 10);
export const akCountable = (it, w) => w.end >= akStart(it);          // 그 주에 체크할 수 있나 (시작한 주 포함)
export const akFullWeek = (it, w) => w.start >= akStart(it);         // 그 주 전체가 시작 이후인가 (미달 판정용)
// 월간·분기 항목이 그 기간 중간에 시작했으면(예: 9/28 시작 → 9월·3분기) 그 기간은 '참고용' — 미달로 치지 않는다
export const akPartial = (it, weeks) => it.cyc !== "W" && !!(weeks && weeks.length) && akStart(it) > weeks[0].start;
// 기간(이 달·이 분기) 끝났는지
export const akPeriodEnd = (it, y, m0) => it.cyc === "Q" ? akYmd(new Date(y, Math.floor(m0 / 3) * 3 + 3, 0)) : akYmd(new Date(y, m0 + 1, 0));
export const akGoalText = (it) => it.perFail ? `실패 건별 ${it.perFail}회` : it.unit === "%" ? `100%${it.cycNote ? " (" + it.cycNote + ")" : ""}` : `${it.cyc === "W" ? "주" : it.cyc === "M" ? "월" : "분기"} ${it.goal}${it.unit}`;
export const akStep = (it) => it.unit === "%" ? (+it.step || 10) : 1;

// ── 담당자: id 가 있으면 id, 없으면 이름(끝글자 일치: 란→이란, 미니→윤미니)으로 찾는다 ──
export function akWho(users, it) {
  const ids = (Array.isArray(it.who) ? it.who : []).filter((id) => (users || []).some((u) => u.id === id));
  if (ids.length) return ids;
  const out = [];
  (it.whoNames || []).forEach((nm) => {
    const s = String(nm || "").replace(/\s/g, ""); if (!s) return;
    const hit = (users || []).filter((u) => { const n = String(u.name || "").replace(/\s/g, ""); return n === s || n.endsWith(s); });
    if (hit.length === 1 && !out.includes(hit[0].id)) out.push(hit[0].id);
  });
  return out;
}
export const akOrder = (a, b) => AK_FUNS.indexOf(a.fun) - AK_FUNS.indexOf(b.fun) || ({ W: 0, M: 1, Q: 2 }[a.cyc] - { W: 0, M: 1, Q: 2 }[b.cyc]) || (a.order || 0) - (b.order || 0);

// ── 결과 KPI 현재값: 가장 최근 달 입력값, 없으면 엑셀 기준값 ──
export function lagCur(it) {
  const ks = Object.keys(it.monthly || {}).filter((k) => it.monthly[k] && it.monthly[k].v != null).sort();
  if (ks.length) { const k = ks[ks.length - 1]; return { v: +it.monthly[k].v, ym: k }; }
  return { v: it.base == null ? null : +it.base, ym: null };
}
export const lagPct = (it, v) => (it.goal && v != null ? Math.round((v / it.goal) * 100) : null);

// ── 권한: 마스터(기본 김송희·이란·김소연·허지은) + 팀원별로 켜주는 권한 ──
export const DEFAULT_MASTER_NAMES = ["김송희", "이란", "김소연", "허지은"];
export const PERMS = [
  { k: "kpiCore", l: "필수 행동지표 수정·멈춤" },
  { k: "kpiLag", l: "결과 KPI 월 입력 · 월말 회고 저장" },
  { k: "tpl", l: "프로젝트 템플릿 편집" },
  { k: "proxy", l: "다른 사람 행동지표 대신 체크" },
];
export const isMaster = (u) => !!u && (u.master === true || (u.master === undefined && (u.role === "lead" || DEFAULT_MASTER_NAMES.includes(String(u.name || "").replace(/\s/g, "")))));
export const can = (u, k) => isMaster(u) || !!(u && u.perms && u.perms[k] === true);
export const roleLabel = (u) => (isMaster(u) ? "마스터" : "팀원");

// ── PIN: SHA-256 (http 테스트 환경에서도 되도록 순수 JS) ──
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
const ror = (x, n) => (x >>> n) | (x << (32 - n));
export function sha256(str) {
  const b = new TextEncoder().encode(String(str)), l = b.length;
  const buf = new Uint8Array(((l + 9 + 63) >> 6) << 6); buf.set(b); buf[l] = 0x80;
  const dv = new DataView(buf.buffer), bits = l * 8;
  dv.setUint32(buf.length - 8, Math.floor(bits / 0x100000000)); dv.setUint32(buf.length - 4, bits >>> 0);
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let i = 0; i < buf.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) { const s0 = ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10); w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H = [H[0] + a, H[1] + bb, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map((x) => x >>> 0);
  }
  return H.map((x) => x.toString(16).padStart(8, "0")).join("");
}
export const pinHash = (uid, pin) => sha256(`pour-os-pin:${uid}:${pin}`);
export const PIN_TRY_MAX = 5, PIN_LOCK_MIN = 5;

// ── 월말 회고: 매월 마지막 평일 ──
export function akRetroDay(y, m0) { const d = new Date(y, m0 + 1, 0); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return akYmd(d); }
// 오늘 보여줄 회고 알림: 이번 달 회고일 3일 전부터 → 이번 달, 새 달 10일까지 지난달 회고가 없으면 → 지난달
export function akRetroDue(today, retros) {
  const t = parseYmd(today), y = t.getFullYear(), m0 = t.getMonth();
  const done = (ym) => (retros || []).some((r) => r && r.kind === "teamMonthly" && r.month === ym);
  const prev = new Date(y, m0 - 1, 1), pym = akYm(prev.getFullYear(), prev.getMonth());
  if (t.getDate() <= 10 && !done(pym)) return { ym: pym, y: prev.getFullYear(), m0: prev.getMonth(), day: akRetroDay(prev.getFullYear(), prev.getMonth()), late: true };
  const day = akRetroDay(y, m0), ym = akYm(y, m0);
  if (today >= akAddDays(day, -3) && !done(ym)) return { ym, y, m0, day, late: today > day };
  return null;
}
