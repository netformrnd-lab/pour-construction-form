// crmOperatorSync.js
// ─────────────────────────────────────────────────────────────
// POUR OS ↔ POUR스토어 CRM  담당자 자동 매칭 (POUR OS 수신측)
//
// CRM(임베드 부모창)이 넘겨준 "접속자(이름·이메일)"를 받아서,
// POUR OS 담당자 목록과 대조해 이름 또는 이메일이 같은 담당자를 찾아준다.
//
// 전달 경로 2가지를 모두 지원한다.
//   (1) 임베드 주소 쿼리 파라미터: ?op_email=...&op_name=...&op_role=...
//   (2) postMessage: { type:"CRM_OPERATOR", payload:{ email, name, role } }
//
// 사용법은 이 파일 맨 아래 "사용 예시" 참고.
// ─────────────────────────────────────────────────────────────

// CRM이 호스팅되는 출처(도메인). 여기 목록에서 온 메시지만 신뢰한다.
// ※ CRM에 커스텀 도메인을 붙이면 그 주소도 아래 배열에 추가.
const CRM_ORIGINS = [
  "https://pourstorecrm.web.app",
  "https://pourstorecrm.firebaseapp.com",
];

// 1) 임베드 주소(URL) 쿼리에서 접속자 읽기 — 기본 경로
export function readOperatorFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const email = (q.get("op_email") || "").trim();
  const name  = (q.get("op_name")  || "").trim();
  const role  = (q.get("op_role")  || "").trim();
  if (!email && !name) return null;
  return { email, name, role, source: "url" };
}

// 2) 이름/이메일로 담당자 매칭
//    - 이메일 완전일치(대소문자 무시) 우선 → 이름 완전일치 → 못 찾으면 null
//    - operators: 담당자 배열. 각 항목에 email / name 필드가 있다고 가정.
//      (필드명이 다르면 getEmail/getName 로 뽑아내도록 아래 인자 조정)
export function matchOperator(operators, incoming, opts = {}) {
  if (!incoming || !Array.isArray(operators)) return null;
  const getEmail = opts.getEmail || ((o) => o.email);
  const getName  = opts.getName  || ((o) => o.name);

  const email = (incoming.email || "").trim().toLowerCase();
  const name  = (incoming.name  || "").trim();

  // 이메일 우선 매칭
  if (email) {
    const hit = operators.find(
      (o) => String(getEmail(o) || "").trim().toLowerCase() === email
    );
    if (hit) return hit;
  }
  // 이름 매칭
  if (name) {
    const hit = operators.find(
      (o) => String(getName(o) || "").trim() === name
    );
    if (hit) return hit;
  }
  return null;
}

// 3) 부모(CRM)에게 "준비됨" 신호 보내고, postMessage 로 접속자 수신 대기
//    onOperator(incoming) 콜백으로 {email, name, role} 전달.
//    반환값은 정리(cleanup) 함수.
export function listenForOperator(onOperator) {
  // 부모에게 "나 준비됐어" → CRM이 CRM_OPERATOR 메시지를 보내줌
  try {
    if (window.parent && window.parent !== window) {
      // READY 신호는 민감정보가 없으므로 "*" 로 보내도 안전
      window.parent.postMessage({ type: "POUR_OS_READY" }, "*");
    }
  } catch (_) { /* 임베드 아님 — 무시 */ }

  const handler = (e) => {
    if (!CRM_ORIGINS.includes(e.origin)) return;         // CRM 출처만 신뢰
    if (e.data && e.data.type === "CRM_OPERATOR" && e.data.payload) {
      onOperator({ ...e.data.payload, source: "postMessage" });
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

// 4) 통합 진입점: URL + postMessage 둘 다 처리
//    onOperator(incoming) 는 접속자 정보를 받을 때마다 호출된다.
export function initCrmOperatorSync(onOperator) {
  const fromUrl = readOperatorFromUrl();
  if (fromUrl) onOperator(fromUrl);          // URL 값이 있으면 즉시 1회
  return listenForOperator(onOperator);      // 이후 postMessage 도 수신
}

// ── CRM 누적 매출 수신 ──────────────────────────────────────────
// CRM이 넘긴 누적 매출을 받는다. (담당자와 동일하게 URL + postMessage 지원)
//   (1) URL: ?crm_rev=220016538&crm_rev_target=1000000000&crm_rev_shipped=...&crm_rev_past=...
//   (2) postMessage: { type:"CRM_REVENUE", payload:{ total, target, shipped, past, updatedAt } }
export function readRevenueFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const num = (k) => { const v = Number(q.get(k)); return isFinite(v) ? v : 0; };
  const total = num("crm_rev"), target = num("crm_rev_target");
  if (!total && !target) return null;
  return { total, target, shipped: num("crm_rev_shipped"), past: num("crm_rev_past"), source: "url" };
}

// onRevenue({ total, target, shipped, past }) 콜백. 반환값은 정리(cleanup) 함수.
export function initCrmRevenueSync(onRevenue) {
  const fromUrl = readRevenueFromUrl();
  if (fromUrl) onRevenue(fromUrl);           // URL 값이 있으면 즉시 1회
  const handler = (e) => {
    if (!CRM_ORIGINS.includes(e.origin)) return;                 // CRM 출처만 신뢰
    if (e.data && e.data.type === "CRM_REVENUE" && e.data.payload) {
      onRevenue({ ...e.data.payload, source: "postMessage" });
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/* ─────────────────────────────────────────────────────────────
   사용 예시 A) React — 담당자 컨텍스트/최상위 컴포넌트

   import { initCrmOperatorSync, matchOperator } from "./crmOperatorSync";

   useEffect(() => {
     // 담당자목록: POUR OS가 이미 들고 있는 담당자 배열
     const stop = initCrmOperatorSync((incoming) => {
       const matched = matchOperator(담당자목록, incoming);
       if (matched) {
         set현재담당자(matched);            // ← POUR OS의 "현재 담당자" 설정 함수
         console.log("CRM 접속자 자동 매칭:", matched.name);
       } else {
         console.warn("일치하는 담당자 없음:", incoming);
       }
     });
     return stop;                            // 언마운트 시 정리
   }, [담당자목록]);

   ─────────────────────────────────────────────────────────────
   사용 예시 B) 순수 JS

   import { initCrmOperatorSync, matchOperator } from "./crmOperatorSync";

   initCrmOperatorSync((incoming) => {
     const matched = matchOperator(내담당자배열, incoming);
     if (matched) 담당자선택(matched);
   });

   ※ 담당자 필드명이 email/name 이 아니면:
     matchOperator(list, incoming, {
       getEmail: (o) => o.mail,   // 예: 이메일 필드가 mail
       getName:  (o) => o.userName,
     })
   ───────────────────────────────────────────────────────────── */
